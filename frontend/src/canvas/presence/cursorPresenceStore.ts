import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { RemoteCursor, RemoteCursorSample, RemoteCursorTrack } from "./types";

type CursorPresenceListener = () => void;

const CURSOR_RENDER_DELAY_MS = 75;
const MAX_CURSOR_SAMPLES = 8;
const CURSOR_SAMPLE_RETENTION_MS = 250;

function getMonotonicNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export interface CursorPresenceStore {
  subscribe(listener: CursorPresenceListener): () => void;
  getSnapshot(): ReadonlyMap<string, RemoteCursorTrack>;
  upsertCursor(cursor: RemoteCursor): void;
  removeCursor(userId: string): void;
  clear(): void;
}

function trimSamples(
  samples: RemoteCursorSample[],
  now: number,
): RemoteCursorSample[] {
  const cutoff = now - CURSOR_SAMPLE_RETENTION_MS;
  const retained = samples.filter((sample) => sample.receivedAt >= cutoff);
  return retained.slice(-MAX_CURSOR_SAMPLES);
}

function interpolateTrack(
  track: RemoteCursorTrack,
  renderAt: number,
): RemoteCursor {
  const samples = track.samples;
  const earliest = samples[0];
  const latest = samples[samples.length - 1];

  if (samples.length === 1 || renderAt <= earliest.receivedAt) {
    return {
      userId: track.userId,
      x: earliest.x,
      y: earliest.y,
    };
  }

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const next = samples[index];
    if (renderAt > next.receivedAt) {
      continue;
    }

    const span = next.receivedAt - previous.receivedAt;
    const progress =
      span <= 0
        ? 1
        : Math.max(0, Math.min(1, (renderAt - previous.receivedAt) / span));

    return {
      userId: track.userId,
      x: previous.x + (next.x - previous.x) * progress,
      y: previous.y + (next.y - previous.y) * progress,
    };
  }

  return {
    userId: track.userId,
    x: latest.x,
    y: latest.y,
  };
}

/**
 * Creates an isolated buffered store for remote cursor presence.
 *
 * Cursor movement is high-frequency ephemeral state. Keeping it outside the
 * main Canvas component prevents remote pointer packets from invalidating the
 * full scene tree on every update, and keeping a short sample history lets the
 * overlay render slightly in the past for smoother interpolation.
 */
export function createCursorPresenceStore(): CursorPresenceStore {
  let cursors = new Map<string, RemoteCursorTrack>();
  const listeners = new Set<CursorPresenceListener>();

  const emitChange = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setSnapshot = (next: Map<string, RemoteCursorTrack>) => {
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
      const now = getMonotonicNow();
      const existing = cursors.get(cursor.userId);
      const latestSample = existing?.samples[existing.samples.length - 1];
      if (latestSample && latestSample.x === cursor.x && latestSample.y === cursor.y) {
        return;
      }

      const next = new Map(cursors);
      next.set(cursor.userId, {
        userId: cursor.userId,
        samples: trimSamples(
          [
            ...(existing?.samples ?? []),
            {
              x: cursor.x,
              y: cursor.y,
              receivedAt: now,
            },
          ],
          now,
        ),
      });
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
 * Subscribes a cursor-only view to interpolated remote cursor positions.
 *
 * Rendering about one packet behind real time gives the overlay two real
 * samples to blend between, which feels smoother than snapping to the latest
 * jittery arrival time.
 */
export function useInterpolatedRemoteCursors(
  store: CursorPresenceStore,
): ReadonlyMap<string, RemoteCursor> {
  const tracks = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const [frameNow, setFrameNow] = useState(() => getMonotonicNow());

  useEffect(() => {
    if (tracks.size === 0) {
      return undefined;
    }

    let frameId = 0;
    const tick = (timestamp: number) => {
      setFrameNow(timestamp);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [tracks.size]);

  return useMemo(() => {
    const renderAt = frameNow - CURSOR_RENDER_DELAY_MS;
    const rendered = new Map<string, RemoteCursor>();

    for (const [userId, track] of tracks) {
      rendered.set(userId, interpolateTrack(track, renderAt));
    }

    return rendered;
  }, [frameNow, tracks]);
}
