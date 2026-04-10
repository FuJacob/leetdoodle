import type { CanvasPresenceUser } from "../../shared/events";

export type CollabUser = CanvasPresenceUser;

export interface RemoteCursor {
  userId: string;
  x: number; // world-space
  y: number;
}

export interface RemoteCursorSample {
  x: number;
  y: number;
  receivedAt: number;
}

export interface RemoteCursorTrack {
  userId: string;
  samples: RemoteCursorSample[];
}

export interface RemoteStroke {
  points: Array<[number, number]>;
  thickness: number;
}
