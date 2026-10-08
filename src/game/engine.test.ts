import { describe, expect, it } from "vitest";
import {
  COLS,
  DOOR,
  GHOST_DEFS,
  LEFT,
  MAZE,
  PSTART,
  ROWS,
  W,
} from "./constants";
import { GameEngine } from "./engine";
import { ccx, tileOf } from "./maze";
import { ST } from "./types";
import type { GhostState } from "./types";

const STEP = 1 / 60;

function isWallTile(c: number, r: number): boolean {
  if (r < 0 || r >= ROWS) return true;
  c = ((c % COLS) + COLS) % COLS;
  const ch = MAZE[r][c];
  return ch === "#" || ch === "g";
}

describe("maze data", () => {
  it("has the classic 28x31 dimensions", () => {
    expect(COLS).toBe(28);
    expect(ROWS).toBe(31);
    expect(MAZE.length).toBe(31);
    expect(MAZE.every((r) => r.length === 28)).toBe(true);
  });

  it("has 300 foods (296 dots + 4 pellets)", () => {
    const all = MAZE.join("");
    expect(all.split("").filter((ch) => ch === "." || ch === "o").length).toBe(300);
    expect(all.split("").filter((ch) => ch === "o").length).toBe(4);
  });

  it("places starts, door, and house correctly", () => {
    expect(MAZE[PSTART.r][PSTART.c]).toBe(".");
    expect(PSTART).toEqual({ c: 13, r: 23 });
    expect(DOOR).toEqual({ c: 13, r: 12 });
    expect(MAZE[DOOR.r][DOOR.c]).toBe(" ");
    expect(MAZE[11][13]).toBe("."); // blinky starts on floor above door
    expect(MAZE[14][13]).toBe("g"); // pinky
    expect(MAZE[14][11]).toBe("g"); // inky
    expect(MAZE[14][15]).toBe("g"); // clyde
    for (const d of GHOST_DEFS) {
      expect(MAZE[d.scatter.r][d.scatter.c], `${d.name} scatter tile is floor`).toBe(".");
    }
  });

  it("tunnels wrap horizontally only", () => {
    const eng = new GameEngine();
    expect(eng.wallAtPac(28, 14)).toBe(false); // right edge wraps to col 0
    expect(eng.wallAtPac(-1, 14)).toBe(false); // left edge wraps to col 27
    expect(eng.wallAtPac(13, -1)).toBe(true); // no vertical wrap
    expect(eng.wallAtPac(28, 1)).toBe(true); // non-tunnel edge stays wall
    expect(eng.wallAtPac(-1, 29)).toBe(true);
  });

  it("door and house block pac but door passes ghosts", () => {
    const eng = new GameEngine();
    expect(eng.wallAtPac(13, 12)).toBe(true); // door blocks pac
    expect(eng.wallAtPac(14, 13)).toBe(true); // house blocks pac
    expect(eng.wallAtGhost(13, 12)).toBe(false); // door passes ghosts
    expect(eng.wallAtGhost(13, 14)).toBe(true); // house interior blocks roaming ghosts
  });
});

describe("game setup", () => {
  it("starts with 300 dots and correct entity positions", () => {
    const eng = new GameEngine();
    expect(eng.dotCount).toBe(300);
    expect(eng.pac.x).toBe(ccx(13));
    expect(eng.pac.y).toBe(ccx(23));
    expect(eng.ghosts[0]).toMatchObject({
      name: "blinky",
      state: "out",
      x: ccx(13),
      y: ccx(11),
    });
    expect(eng.ghosts[1]).toMatchObject({ name: "pinky", state: "house", x: ccx(13), y: ccx(14) });
    expect(eng.ghosts[2]).toMatchObject({ name: "inky", state: "house", x: ccx(11), y: ccx(14) });
    expect(eng.ghosts[3]).toMatchObject({ name: "clyde", state: "house", x: ccx(15), y: ccx(14) });
  });

  it("high score persistence hook fires on new records", () => {
    const eng = new GameEngine();
    const saved: number[] = [];
    eng.onHighScore = (n) => saved.push(n);
    eng.score = 0;
    eng.hiscore = 0;
    (eng as unknown as { addScore(n: number): void }).addScore(50);
    expect(eng.hiscore).toBe(50);
    expect(saved).toEqual([50]);
  });
});

describe("gameplay simulation", () => {
  it("runs 60 seconds without breaking: pac moves, ghosts roam, dots are eaten", () => {
    const eng = new GameEngine();
    eng.state = ST.PLAY;
    eng.setWant(LEFT);
    let pacMoved = 0;
    let pinkyOut = false;
    let inkyOut = false;
    let clydeOut = false;
    for (let i = 0; i < 60 * 60; i++) {
      eng.step(STEP);
      pacMoved = Math.max(pacMoved, Math.abs(eng.pac.x - ccx(13)) + Math.abs(eng.pac.y - ccx(23)));
      if (eng.ghosts[1].state === "out") pinkyOut = true;
      if (eng.ghosts[2].state === "out") inkyOut = true;
      if (eng.ghosts[3].state === "out") clydeOut = true;
      if (eng.state !== ST.PLAY && i < 60 * 10) break;
    }
    expect(pacMoved).toBeGreaterThan(8);
    expect(pinkyOut).toBe(true);
    expect(inkyOut).toBe(true);
    expect(clydeOut).toBe(true);
    expect(eng.dotCount).toBeLessThan(300);
  });

  it("pac wraps through the tunnel", () => {
    const eng = new GameEngine();
    eng.resetPositions();
    for (const g of eng.ghosts) {
      g.state = "house";
      g.houseT = 1e9;
      g.dir = { x: 0, y: 0 };
    }
    eng.state = ST.PLAY;
    eng.pac.x = ccx(0);
    eng.pac.y = ccx(14);
    eng.pac.dir = { ...LEFT };
    eng.pac.want = { ...LEFT };
    let wrapped = false;
    for (let i = 0; i < 300; i++) {
      eng.step(STEP);
      if (eng.pac.x > 300) {
        wrapped = true;
        break;
      }
      if (eng.state !== ST.PLAY) break;
    }
    expect(wrapped).toBe(true);
    expect(eng.pac.x).toBeGreaterThanOrEqual(0);
    expect(eng.pac.x).toBeLessThan(W);
  });

  it("eaten (eyes) ghost returns to the house", () => {
    const eng = new GameEngine();
    eng.resetPositions();
    const g = eng.ghosts[1];
    g.state = "eyes";
    g.x = ccx(13);
    g.y = ccx(11);
    g.dir = { x: 0, y: 1 };
    for (let i = 0; i < 60 * 10 && (g.state as GhostState) !== "house"; i++) eng.step(STEP);
    expect(g.state).toBe("house");
    expect(Math.abs(g.x - ccx(13))).toBeLessThan(1.5);
    expect(Math.abs(g.y - ccx(14))).toBeLessThan(1.5);
  });

  it.each([1, 2, 3])("ghost %i exits the house without clipping a wall", (idx) => {
    const eng = new GameEngine();
    const gg = eng.ghosts[idx];
    for (const o of eng.ghosts)
      if (o !== gg) {
        o.state = "house";
        o.houseT = 1e9;
      }
    gg.state = "house";
    gg.houseT = 0.05;
    eng.state = ST.PLAY;
    let wallTicks = 0;
    let outTicks = 0;
    let becameOut = false;
    for (let i = 0; i < 60 * 10; i++) {
      eng.step(STEP);
      const st = gg.state as GhostState;
      if (st === "out" || st === "eyes") {
        becameOut = true;
        outTicks++;
        const tc = tileOf(gg);
        if (isWallTile(tc.c, tc.r)) wallTicks++;
        if (outTicks >= 40 && !isWallTile(tc.c, tc.r)) break;
      }
    }
    expect(becameOut).toBe(true);
    expect(wallTicks).toBe(0);
  });

  it("phase clock advances during fright (pellets do not extend phases)", () => {
    const eng = new GameEngine();
    eng.state = ST.PLAY;
    for (const o of eng.ghosts) {
      o.state = "house";
      o.houseT = 1e9;
      o.frightened = false;
    }
    eng.modeIdx = 0;
    eng.modeT = 4.0;
    eng.frightT = 3.0;
    const before = eng.modeT;
    for (let i = 0; i < 30; i++) eng.step(STEP);
    expect(eng.frightT).toBeGreaterThan(0);
    expect(eng.modeT).toBeLessThan(before);
  });

  it("power pellet frightens roaming ghosts; eating one scores 200", () => {
    const eng = new GameEngine();
    eng.state = ST.PLAY;
    eng.resetPositions();
    // A roaming ghost near pac, and a pellet under pac.
    const g = eng.ghosts[0];
    g.state = "out";
    g.x = eng.pac.x + 40;
    g.y = eng.pac.y;
    const tile = tileOf(eng.pac);
    eng.dots[tile.r][tile.c] = "o";
    eng.score = 0;
    eng.step(STEP);
    expect(g.frightened).toBe(true);
    // Now bring it into contact: it should be eaten and score 200.
    g.x = eng.pac.x + 5;
    g.y = eng.pac.y;
    eng.step(STEP);
    expect(g.state).toBe("eyes");
    expect(eng.score).toBe(250); // 50 pellet + 200 first ghost in combo
  });
});
