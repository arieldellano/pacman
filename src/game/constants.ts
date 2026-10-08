import type { Dir } from "./types";

export const T = 16; // tile size (px)
export const COLS = 28;
export const ROWS = 31;
export const W = COLS * T; // 448
export const H = ROWS * T; // 496

export const MAZE: readonly string[] = [
  "############################",
  "#..o.........##........o...#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "######.#####.##.#####.######",
  "######.##..........##.######",
  "######.##.### ####.##.######",
  "######.##.#gggggg#.##.######",
  "..........#gggggg#..........",
  "######.##.#gggggg#.##.######",
  "######.##.########.##.######",
  "######.##..........##.######",
  "######.##.########.##.######",
  "######.##.########.##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#...##................##...#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#..o...##....##....##..o...#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

export const DOOR = { c: 13, r: 12 };
export const PSTART = { c: 13, r: 23 };

export const UP: Dir = { x: 0, y: -1 };
export const DOWN: Dir = { x: 0, y: 1 };
export const LEFT: Dir = { x: -1, y: 0 };
export const RIGHT: Dir = { x: 1, y: 0 };
export const DIRS: readonly Dir[] = [UP, LEFT, DOWN, RIGHT];

/** Scatter(0) / chase(1) phase schedule: [mode, seconds]. */
export const PHASES: ReadonlyArray<readonly [mode: number, seconds: number]> = [
  [0, 4],
  [1, 12],
  [0, 4],
  [1, 15],
  [0, 4],
  [1, 15],
  [0, 4],
  [1, 999999],
];

export interface GhostDef {
  name: string;
  color: string;
  scatter: { c: number; r: number };
  start: { c: number; r: number };
  houseT: number;
}

export const GHOST_DEFS: readonly GhostDef[] = [
  { name: "blinky", color: "#ff0000", scatter: { c: 25, r: 1 }, start: { c: 13, r: 11 }, houseT: -1 },
  { name: "pinky", color: "#ffb8ff", scatter: { c: 2, r: 1 }, start: { c: 13, r: 14 }, houseT: 1 },
  { name: "inky", color: "#00ffff", scatter: { c: 25, r: 29 }, start: { c: 11, r: 14 }, houseT: 3 },
  { name: "clyde", color: "#ffb852", scatter: { c: 2, r: 29 }, start: { c: 15, r: 14 }, houseT: 5 },
];

export const HISCORE_KEY = "pacLikeHiscore";
