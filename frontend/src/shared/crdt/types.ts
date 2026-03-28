/**
 * ActorId identifies one editor replica (usually one browser tab/session).
 *
 * CRDT correctness depends on IDs being globally unique and monotonically
 * increasing per actor. We use userId as actor ID and keep a local seq counter.
 */
export type ActorId = string;

/**
 * Globally unique block identity.
 *
 * Why actor+seq instead of random UUID?
 * - Sequence numbers give natural causal ordering within one actor.
 * - Actor+seq is compact and deterministic (easy to compare and debug).
 * - State vectors are defined over "max seq seen per actor".
 */
export interface BlockId {
  actor: ActorId;
  seq: number;
}

/**
 * A stable reference to one character inside one block.
 *
 * We never reference text by absolute position over the network because
 * positions drift under concurrency. CharRef stays valid even when content
 * before it changes.
 */
export interface CharRef {
  blockId: BlockId;
  offset: number; // zero-based index into block.text
}

/**
 * Half-open interval [start, end) marking deleted characters inside a block.
 *
 * We use tombstones/ranges instead of physical deletion in the hot path so
 * concurrent operations that reference old characters still resolve safely.
 */
export interface DeletedRange {
  start: number;
  end: number;
}

/**
 * One CRDT text chunk inserted as a contiguous run.
 *
 * Chunking is the first major production optimization versus per-char objects.
 * A burst of typing can stay in one block, reducing allocation and metadata.
 */
export interface Block {
  id: BlockId;
  after: CharRef | null; // insertion anchor; null means document start
  text: string;
  deletedRanges: DeletedRange[];
}

/**
 * State vector: per actor, highest op sequence integrated by this replica.
 *
 * Used for efficient reconnection: peers can send only ops that the requester
 * has not seen yet instead of full-document replay.
 */
export type StateVector = Record<ActorId, number>;

export interface InsertOp {
  kind: "insert";
  actor: ActorId;
  seq: number;
  after: CharRef | null;
  text: string;
}

export interface DeleteOp {
  kind: "delete";
  actor: ActorId;
  seq: number;
  from: CharRef;
  length: number;
}

export type CrdtOp = InsertOp | DeleteOp;

/**
 * Local editor diff shape used at the UI boundary.
 *
 * from/to are in the pre-change document coordinate space (CodeMirror format).
 * insert is replacement text (possibly empty for pure deletion).
 */
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

export function blockKey(id: BlockId): string {
  return `${id.actor}:${id.seq}`;
}

export function opKey(op: CrdtOp): string {
  return `${op.actor}:${op.seq}`;
}

/**
 * Deterministic order key for concurrent inserts anchored at the same CharRef.
 *
 * If two replicas insert after the same anchor concurrently, every peer must
 * choose the same relative order to converge. actor+seq is our tiebreaker.
 */
export function blockOrderKey(id: BlockId): string {
  return `${id.actor}:${String(id.seq).padStart(12, "0")}`;
}
