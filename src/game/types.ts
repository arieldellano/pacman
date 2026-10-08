export interface Vec {
  x: number;
  y: number;
}

/** A grid-moving entity with a direction. */
export interface Movable extends Vec {
  dir: Dir;
}

export type Dir = Vec;

export type GhostState = "house" | "leaving" | "out" | "eyes" | "entering";

export interface Pac {
  x: number;
  y: number;
  dir: Dir;
  want: Dir;
  speed: number;
  mouth: number;
  moving: boolean;
}

export interface Ghost {
  name: string;
  color: string;
  scatter: { c: number; r: number };
  x: number;
  y: number;
  dir: Dir;
  state: GhostState;
  houseT: number;
  frightened: boolean;
  /** Random phase offset for the in-house bobbing animation. */
  ph: number;
}

export interface FloatText {
  x: number;
  y: number;
  txt: string;
  life: number;
}

export const ST = {
  READY: 0,
  PLAY: 1,
  DIE: 2,
  OVER: 3,
  LEVELUP: 4,
  PAUSE: 5,
} as const;

export type GameState = (typeof ST)[keyof typeof ST];

export interface Overlay {
  title: string;
  lines: string[];
}

export interface Hud {
  score: number;
  high: number;
  level: number;
  lives: number;
  overlay: Overlay | null;
}
