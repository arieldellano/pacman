import { T, W } from "./constants";
import type { Movable, Vec } from "./types";

/** Center x/y of a tile in canvas pixels. */
export const ccx = (c: number): number => (c + 0.5) * T;

export const atCenter = (e: Vec): boolean =>
  Math.abs(e.x % T - T / 2) < 1e-6 && Math.abs(e.y % T - T / 2) < 1e-6;

export const tileOf = (e: Vec): { c: number; r: number } => ({
  c: Math.floor(e.x / T),
  r: Math.floor(e.y / T),
});

/** Wrap an entity horizontally through the tunnel rows. */
export function wrapX(e: Vec): void {
  if (e.x >= W) e.x -= W;
  else if (e.x < 0) e.x += W;
}

export function snapCenter(e: Vec): void {
  e.x = Math.round(e.x / T - 0.5) * T + T / 2;
  e.y = Math.round(e.y / T - 0.5) * T + T / 2;
}

/**
 * Move an entity along its axis-aligned direction by `dist` pixels,
 * constrained to the tile grid. Stops at tile edges so that direction
 * decisions happen exactly on tile centers.
 */
export function stepEdge(e: Movable, dist: number): void {
  let rem = dist;
  while (rem > 1e-9) {
    if (atCenter(e)) {
      if (!e.dir || (e.dir.x === 0 && e.dir.y === 0)) {
        snapCenter(e);
        return;
      }
      const d = Math.min(rem, T);
      e.x += e.dir.x * d;
      e.y += e.dir.y * d;
      rem -= d;
    } else {
      const v = e.dir.x ? e.x : e.y;
      const s = e.dir.x || e.dir.y;
      let n = (Math.floor(v / T) + 0.5) * T;
      if (s === 1 && n - v < 1e-9) n += T;
      if (s === -1 && v - n < 1e-9) n -= T;
      const edge = Math.abs(n - v);
      const d = Math.min(rem, edge);
      if (e.dir.x) e.x += e.dir.x * d;
      else e.y += e.dir.y * d;
      rem -= d;
      if (rem > 1e-9) return;
    }
  }
}
