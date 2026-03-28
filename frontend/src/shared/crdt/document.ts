import {
  blockKey,
  blockOrderKey,
  opKey,
  type ActorId,
  type Block,
  type BlockId,
  type CharRef,
  type CrdtOp,
  type DeletedRange,
  type StateVector,
  type TextEdit,
} from "./types";

const ROOT_ANCHOR = "__root__";
const SEED_ACTOR = "__seed__";

function refKey(ref: CharRef): string {
  return `${blockKey(ref.blockId)}#${ref.offset}`;
}

function anchorKey(after: CharRef | null): string {
  return after ? refKey(after) : ROOT_ANCHOR;
}

/**
 * CRDTDocument is a block-based RGA-style text CRDT implementation.
 *
 * Why this shape?
 * - Map<ID, Block> gives O(1) lookup for remote references.
 * - `after` references define replica-stable order (no raw position over network).
 * - deletedRanges preserve history required for concurrent reconciliation.
 *
 * This implementation intentionally favors clarity and correctness first.
 * The index rebuild is O(N), which we will replace with a weighted tree/skip-list
 * in a later optimization pass.
 */
export class CRDTDocument {
  private readonly actor: ActorId;

  // Local monotonic sequence used to mint operation IDs for this replica.
  private localSeq = 0;

  // Authoritative storage: block identity -> block data.
  private readonly blocksById = new Map<string, Block>();

  // Applied operation keys for idempotency.
  private readonly seenOps = new Set<string>();

  // Ops waiting on missing dependencies (e.g., delete arrives before referenced insert).
  private readonly pendingOps = new Map<string, CrdtOp>();

  // Durable-ish in-memory op log for state-vector sync.
  private readonly opLog: CrdtOp[] = [];

  // Replica knowledge frontier used by sync_request/sync_response.
  private readonly stateVector: StateVector = {};

  // Derived visible index: editor position -> CharRef.
  private visibleRefs: CharRef[] = [];

  // Reverse lookup: CharRef -> editor position.
  private readonly visiblePositionByRef = new Map<string, number>();

  // Cached plaintext view of visible characters.
  private visibleText = "";

  constructor(actor: ActorId, initialText = "") {
    this.actor = actor;
    this.bootstrapFromText(initialText);
    this.rebuildVisibleIndex();
  }

  /**
   * One-time bootstrap from authoritative plain text (e.g., node snapshot).
   *
   * We do NOT put this into opLog because it did not happen as a replicated op.
   * It is equivalent to loading a snapshot before replaying operations.
   */
  private bootstrapFromText(text: string): void {
    if (!text) return;

    const seedId: BlockId = { actor: SEED_ACTOR, seq: 0 };
    this.blocksById.set(blockKey(seedId), {
      id: seedId,
      after: null,
      text,
      deletedRanges: [],
    });
  }

  /** Returns current materialized visible text for editor rendering. */
  getText(): string {
    return this.visibleText;
  }

  /** Position lookup used by UI adapters. */
  charRefAt(position: number): CharRef | null {
    if (position < 0 || position >= this.visibleRefs.length) return null;
    return this.visibleRefs[position];
  }

  /** Reverse lookup used by delete operations and cursor translation. */
  positionOfCharRef(ref: CharRef): number {
    return this.visiblePositionByRef.get(refKey(ref)) ?? -1;
  }

  /**
   * Applies local editor edits and returns replicated CRDT ops to broadcast.
   *
   * Input edit positions are in the PRE-CHANGE coordinate system (CodeMirror).
   * As we apply one edit, following edit positions must be shifted.
   */
  applyLocalEdits(edits: TextEdit[]): CrdtOp[] {
    const ops: CrdtOp[] = [];
    let cumulativeShift = 0;

    for (const edit of edits) {
      const from = edit.from + cumulativeShift;
      const to = edit.to + cumulativeShift;
      const deleteLength = Math.max(0, to - from);

      if (deleteLength > 0) {
        const deleteOp = this.createLocalDelete(from, deleteLength);
        if (deleteOp) {
          this.applyOperation(deleteOp, true);
          ops.push(deleteOp);
        }
      }

      if (edit.insert.length > 0) {
        const insertOp = this.createLocalInsert(from, edit.insert);
        this.applyOperation(insertOp, true);
        ops.push(insertOp);
      }

      cumulativeShift += edit.insert.length - Math.max(0, edit.to - edit.from);
    }

    return ops;
  }

  /** Applies one remote op. Returns true if integrated now, false if pending. */
  applyRemote(op: CrdtOp): boolean {
    return this.applyOperation(op, false);
  }

  /** Copy of current vector for sync requests. */
  getStateVector(): StateVector {
    return { ...this.stateVector };
  }

  /** Return only ops the remote replica has not seen yet. */
  getOpsSince(remoteVector: StateVector): CrdtOp[] {
    return this.opLog.filter((op) => {
      const seenSeq = remoteVector[op.actor] ?? -1;
      return op.seq > seenSeq;
    });
  }

  private createLocalInsert(position: number, text: string): CrdtOp {
    const after = position <= 0 ? null : this.charRefAt(position - 1);

    return {
      kind: "insert",
      actor: this.actor,
      seq: this.localSeq++,
      after,
      text,
    };
  }

  private createLocalDelete(position: number, length: number): CrdtOp | null {
    const from = this.charRefAt(position);
    if (!from) return null;

    return {
      kind: "delete",
      actor: this.actor,
      seq: this.localSeq++,
      from,
      length,
    };
  }

  /**
   * Core op application with idempotency + pending dependency handling.
   *
   * `mustApply=true` is for local ops. If a local op cannot apply, that's a bug
   * in position/anchor translation and we throw to surface it early.
   */
  private applyOperation(op: CrdtOp, mustApply: boolean): boolean {
    const key = opKey(op);
    if (this.seenOps.has(key)) return false;
    if (this.pendingOps.has(key)) return false;

    const applied = this.tryApply(op);
    if (!applied) {
      if (mustApply) {
        throw new Error(`Local CRDT op could not be applied: ${key}`);
      }
      this.pendingOps.set(key, op);
      return false;
    }

    this.finalizeAppliedOperation(op);
    this.drainPendingOps();
    return true;
  }

  private tryApply(op: CrdtOp): boolean {
    if (op.kind === "insert") {
      return this.tryApplyInsert(op);
    }
    return this.tryApplyDelete(op);
  }

  /** Insert depends on anchor existence when `after` is non-null. */
  private tryApplyInsert(op: Extract<CrdtOp, { kind: "insert" }>): boolean {
    if (op.after && !this.hasAnchor(op.after)) {
      return false;
    }

    const id = { actor: op.actor, seq: op.seq };
    const key = blockKey(id);

    if (!this.blocksById.has(key)) {
      this.blocksById.set(key, {
        id,
        after: op.after,
        text: op.text,
        deletedRanges: [],
      });
    }

    return true;
  }

  /**
   * Delete depends on resolving starting CharRef.
   *
   * If start ref is not currently visible, we treat as already applied/no-op.
   * This keeps idempotency under concurrent double-deletes.
   */
  private tryApplyDelete(op: Extract<CrdtOp, { kind: "delete" }>): boolean {
    const startPos = this.positionOfCharRef(op.from);
    if (startPos < 0) {
      return true;
    }

    const targets: CharRef[] = [];
    for (let i = 0; i < op.length; i++) {
      const ref = this.charRefAt(startPos + i);
      if (!ref) break;
      targets.push(ref);
    }

    for (const ref of targets) {
      this.markDeleted(ref);
    }

    return true;
  }

  private finalizeAppliedOperation(op: CrdtOp): void {
    this.seenOps.add(opKey(op));
    this.opLog.push(op);
    this.stateVector[op.actor] = Math.max(this.stateVector[op.actor] ?? -1, op.seq);

    // Keep local sequence ahead of anything we've observed for this actor.
    if (op.actor === this.actor) {
      this.localSeq = Math.max(this.localSeq, op.seq + 1);
    }

    this.rebuildVisibleIndex();
  }

  /**
   * Re-attempt pending ops after each successful integration.
   *
   * This is the CRDT equivalent of dependency resolution: once an insert arrives,
   * previously blocked ops that referenced it may become applicable.
   */
  private drainPendingOps(): void {
    let progressed = true;

    while (progressed) {
      progressed = false;

      for (const [key, pending] of Array.from(this.pendingOps.entries())) {
        if (!this.tryApply(pending)) continue;

        this.pendingOps.delete(key);
        this.finalizeAppliedOperation(pending);
        progressed = true;
      }
    }
  }

  private hasAnchor(ref: CharRef): boolean {
    const block = this.blocksById.get(blockKey(ref.blockId));
    if (!block) return false;
    return ref.offset >= 0 && ref.offset < block.text.length;
  }

  private markDeleted(ref: CharRef): void {
    const block = this.blocksById.get(blockKey(ref.blockId));
    if (!block) return;

    block.deletedRanges = mergeRanges([...block.deletedRanges, { start: ref.offset, end: ref.offset + 1 }]);
  }

  /**
   * Rebuild visible linear index from logical block graph.
   *
   * Ordering rule:
   * 1) Parent-child relation from `after` references.
   * 2) Concurrent siblings (same anchor) sorted by block ID tiebreaker.
   */
  private rebuildVisibleIndex(): void {
    const childrenByAnchor = new Map<string, Block[]>();

    for (const block of this.blocksById.values()) {
      const key = anchorKey(block.after);
      const siblings = childrenByAnchor.get(key) ?? [];
      siblings.push(block);
      childrenByAnchor.set(key, siblings);
    }

    for (const siblings of childrenByAnchor.values()) {
      siblings.sort((a, b) => blockOrderKey(a.id).localeCompare(blockOrderKey(b.id)));
    }

    const nextRefs: CharRef[] = [];
    const nextChars: string[] = [];

    // Guard against malformed cyclic input from untrusted peers.
    const visitedBlocks = new Set<string>();

    const emitChildren = (anchor: string): void => {
      const children = childrenByAnchor.get(anchor) ?? [];

      for (const child of children) {
        const childKey = blockKey(child.id);
        if (visitedBlocks.has(childKey)) continue;
        visitedBlocks.add(childKey);

        for (let offset = 0; offset < child.text.length; offset++) {
          if (!isDeleted(offset, child.deletedRanges)) {
            const ref: CharRef = { blockId: child.id, offset };
            nextRefs.push(ref);
            nextChars.push(child.text[offset]);
          }

          // Always emit descendants even when this character is tombstoned.
          emitChildren(`${childKey}#${offset}`);
        }
      }
    };

    emitChildren(ROOT_ANCHOR);

    this.visibleRefs = nextRefs;
    this.visibleText = nextChars.join("");
    this.visiblePositionByRef.clear();

    nextRefs.forEach((ref, index) => {
      this.visiblePositionByRef.set(refKey(ref), index);
    });
  }
}

function isDeleted(offset: number, ranges: DeletedRange[]): boolean {
  for (const range of ranges) {
    if (offset >= range.start && offset < range.end) return true;
  }
  return false;
}

function mergeRanges(ranges: DeletedRange[]): DeletedRange[] {
  if (ranges.length <= 1) return ranges;

  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: DeletedRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const tail = merged[merged.length - 1];

    if (current.start > tail.end) {
      merged.push(current);
      continue;
    }

    tail.end = Math.max(tail.end, current.end);
  }

  return merged;
}
