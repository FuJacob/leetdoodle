import { useSyncExternalStore } from "react";
import type { RemoteCursor } from "./types";

type CursorPresenceListener = () => void;

export interface CursorPresenceStore {
  subscribe(listener: CursorPresenceListener): () => void;
  getSnapshot(): ReadonlyMap<string, RemoteCursor>;
  upsertCursor(cursor: RemoteCursor): void;
  removeCursor(userId: string): void;
  clear(): void;
}

/**
 * Creates an isolated latest-wins store for remote cursor presence.
 *
 * Cursor movement is high-frequency ephemeral state. Keeping it outside the
 * main Canvas component prevents remote pointer packets from invalidating the
 * full scene tree on every update.
 */
export function createCursorPresenceStore(): CursorPresenceStore {
  let cursors = new Map<string, RemoteCursor>();
  const listeners = new Set<CursorPresenceListener>();

  const emitChange = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setSnapshot = (next: Map<string, RemoteCursor>) => {
    cursors = next;
    emitChange();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return cursors;
    },
    upsertCursor(cursor) {
      const existing = cursors.get(cursor.userId);
      if (existing && existing.x === cursor.x && existing.y === cursor.y) {
        return;
      }

      const next = new Map(cursors);
      next.set(cursor.userId, cursor);
      setSnapshot(next);
    },
    removeCursor(userId) {
      if (!cursors.has(userId)) return;

      const next = new Map(cursors);
      next.delete(userId);
      setSnapshot(next);
    },
    clear() {
      if (cursors.size === 0) return;
      setSnapshot(new Map());
    },
  };
}

/**
 * Subscribes a cursor-only view to the latest remote cursor snapshot.
 *
 * This keeps the cursor overlay reactive without pulling high-frequency
 * presence updates through the Canvas render path.
 */
export function useRemoteCursors(
  store: CursorPresenceStore,
): ReadonlyMap<string, RemoteCursor> {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
