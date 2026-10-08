import {
  COLS,
  DOOR,
  DIRS,
  GHOST_DEFS,
  MAZE,
  PHASES,
  PSTART,
  ROWS,
  T,
  W,
} from "./constants";
import { atCenter, ccx, stepEdge, tileOf, wrapX } from "./maze";
import { ST } from "./types";
import type {
  Dir,
  FloatText,
  GameState,
  Ghost,
  Hud,
  Overlay,
  Pac,
} from "./types";

/** Sound effects sink, provided by the UI layer. */
export interface SfxEmitter {
  waka(): void;
  pellet(): void;
  ghost(): void;
  die(): void;
  level(): void;
  life(): void;
}

const ZERO: Dir = { x: 0, y: 0 };

/**
 * Pac-Man game logic. Fully DOM-free so it can run in tests; the UI
 * layer drives `step(dt)` from a requestAnimationFrame loop and polls
 * `hud()` for React state.
 */
export class GameEngine {
  state: GameState = ST.READY;
  score = 0;
  hiscore = 0;
  lives = 3;
  level = 1;
  t = 0;

  pac: Pac = {
    x: ccx(PSTART.c),
    y: ccx(PSTART.r),
    dir: { ...ZERO },
    want: { ...ZERO },
    speed: 72,
    mouth: 0,
    moving: false,
  };
  ghosts: Ghost[] = [];
  dots: string[][] = [];
  dotCount = 0;
  floats: FloatText[] = [];

  frightT = 0;
  combo = 0;
  modeIdx = 0;
  modeT = 4;
  dieT = 0;
  overlay: Overlay | null = null;

  /** Called whenever the high score increases; the UI persists it. */
  onHighScore: ((n: number) => void) | null = null;

  private sfx: SfxEmitter | null;
  private extraGiven = false;
  private readyT = 0;
  private lvT = 0;

  constructor(sfx?: SfxEmitter) {
    this.sfx = sfx ?? null;
    this.startGame();
  }

  // ------------------------------------------------------------------
  // maze queries
  // ------------------------------------------------------------------

  wallAtPac(c: number, r: number): boolean {
    if (r < 0 || r >= ROWS) return true;
    c = ((c % COLS) + COLS) % COLS;
    const ch = MAZE[r][c];
    if (ch === "#" || ch === "g") return true;
    if (c === DOOR.c && r === DOOR.r) return true;
    return false;
  }

  wallAtGhost(c: number, r: number): boolean {
    if (r < 0 || r >= ROWS) return true;
    c = ((c % COLS) + COLS) % COLS;
    const ch = MAZE[r][c];
    return ch === "#" || ch === "g";
  }

  // ------------------------------------------------------------------
  // setup
  // ------------------------------------------------------------------

  private makeGhosts(): void {
    this.ghosts = GHOST_DEFS.map((d) => ({
      name: d.name,
      color: d.color,
      scatter: d.scatter,
      x: ccx(d.start.c),
      y: ccx(d.start.r),
      dir: { ...ZERO },
      state: d.houseT < 0 ? "out" : "house",
      houseT: d.houseT < 0 ? 0 : d.houseT,
      frightened: false,
      ph: Math.random() * 6,
    }));
  }

  resetPositions(): void {
    this.pac.x = ccx(PSTART.c);
    this.pac.y = ccx(PSTART.r);
    this.pac.dir = { ...ZERO };
    this.pac.want = { ...ZERO };
    this.pac.mouth = 0;
    this.pac.moving = false;
    this.frightT = 0;
    this.combo = 0;
    this.modeIdx = 0;
    this.modeT = 4;
    this.makeGhosts();
  }

  private initDots(): void {
    this.dots = MAZE.map((row) => row.split(""));
    this.dotCount = 0;
    for (const row of this.dots)
      for (const ch of row) if (ch === "." || ch === "o") this.dotCount++;
  }

  startGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.extraGiven = false;
    this.initDots();
    this.resetPositions();
    this.t = 0;
    this.state = ST.READY;
    this.readyT = 1.2;
    this.showOverlay("PAC-LIKE", [
      "EAT EVERY DOT",
      "AVOID THE GHOSTS",
      "",
      "ARROWS / WASD TO MOVE",
      "P TO PAUSE",
    ]);
  }

  // ------------------------------------------------------------------
  // input
  // ------------------------------------------------------------------

  setWant(d: Dir): void {
    this.pac.want = d;
    // Reversing is instant; a stopped pac takes the input on the next
    // tile-center decision.
    if (
      d.x === -this.pac.dir.x &&
      d.y === -this.pac.dir.y &&
      (this.pac.dir.x || this.pac.dir.y)
    ) {
      this.pac.dir = { ...d };
    }
  }

  /** Arrow/WASD pressed: starts the run from the READY screen. */
  dismissReady(): void {
    if (this.state === ST.READY) {
      this.state = ST.PLAY;
      this.overlay = null;
    }
  }

  /** Enter / space / tap: restart after game over, start from READY. */
  primaryAction(): void {
    if (this.state === ST.OVER) this.startGame();
    else this.dismissReady();
  }

  togglePause(): void {
    if (this.state === ST.PLAY) {
      this.state = ST.PAUSE;
      this.showOverlay("PAUSED", ["PRESS P TO RESUME"]);
    } else if (this.state === ST.PAUSE) {
      this.state = ST.PLAY;
      this.overlay = null;
    }
  }

  // ------------------------------------------------------------------
  // scoring
  // ------------------------------------------------------------------

  private addScore(n: number): void {
    this.score += n;
    if (!this.extraGiven && this.score >= 10000) {
      this.extraGiven = true;
      this.lives++;
      this.sfx?.life();
    }
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      this.onHighScore?.(this.hiscore);
    }
  }

  hud(): Hud {
    return {
      score: this.score,
      high: Math.max(this.hiscore, this.score),
      level: this.level,
      lives: this.lives,
      overlay: this.overlay,
    };
  }

  private showOverlay(title: string, lines: string[]): void {
    this.overlay = { title, lines };
  }

  // ------------------------------------------------------------------
  // movement helpers
  // ------------------------------------------------------------------

  private pacDecide(): void {
    const { c, r } = tileOf(this.pac);
    const w = this.pac.want;
    if ((w.x || w.y) && !this.wallAtPac(c + w.x, r + w.y))
      this.pac.dir = { ...w };
    if (
      (this.pac.dir.x || this.pac.dir.y) &&
      this.wallAtPac(c + this.pac.dir.x, r + this.pac.dir.y)
    )
      this.pac.dir = { x: 0, y: 0 };
  }

  private targetFor(g: Ghost): { c: number; r: number } {
    const pc = tileOf(this.pac);
    if (g.name === "blinky") return pc;
    if (g.name === "pinky")
      return { c: pc.c + this.pac.dir.x * 4, r: pc.r + this.pac.dir.y * 4 };
    if (g.name === "inky") {
      const b = tileOf(this.ghosts[0]);
      const ax = pc.c + this.pac.dir.x * 2;
      const ay = pc.r + this.pac.dir.y * 2;
      return { c: 2 * ax - b.c, r: 2 * ay - b.r };
    }
    const dt =
      (g.x - this.pac.x) * (g.x - this.pac.x) +
      (g.y - this.pac.y) * (g.y - this.pac.y);
    return dt > 64 * T * T ? pc : g.scatter;
  }

  private aiPick(g: Ghost, wallFn: (c: number, r: number) => boolean): void {
    const { c, r } = tileOf(g);
    const opts: Dir[] = [];
    for (const d of DIRS) {
      const nc = c + d.x;
      const nr = r + d.y;
      if (wallFn(nc, nr)) continue;
      if (d.x === -g.dir.x && d.y === -g.dir.y) continue;
      if (g.state === "out" && nc === DOOR.c && nr === DOOR.r) continue;
      opts.push(d);
    }
    if (!opts.length) {
      g.dir = { x: -g.dir.x, y: -g.dir.y };
      return;
    }
    if (g.state === "out" && g.frightened) {
      g.dir = { ...opts[(Math.random() * opts.length) | 0] };
      return;
    }
    const target =
      g.state === "eyes"
        ? DOOR
        : PHASES[this.modeIdx][0] === 0
          ? g.scatter
          : this.targetFor(g);
    let best = opts[0];
    let bd = Infinity;
    for (const d of opts) {
      const dc =
        (c + d.x - target.c) * (c + d.x - target.c) +
        (r + d.y - target.r) * (r + d.y - target.r);
      if (dc < bd) {
        bd = dc;
        best = d;
      }
    }
    g.dir = { ...best };
  }

  private outDecide(g: Ghost): void {
    this.aiPick(g, (c, r) => this.wallAtGhost(c, r));
  }

  private leaveDecide(g: Ghost): void {
    // Finish the exit one tile above the door, in the corridor, where
    // LEFT/RIGHT are legal; the door's own left/right neighbours are walls.
    const cx = ccx(DOOR.c);
    const exitY = ccx(DOOR.r - 1);
    if (Math.abs(g.x - cx) > 0.5) g.dir = { x: Math.sign(cx - g.x), y: 0 };
    else if (g.y > exitY + 0.5) g.dir = { x: 0, y: -1 };
    else if (atCenter(g) && g.y <= exitY + 0.5) {
      g.state = "out";
      g.dir = Math.random() < 0.5 ? { x: -1, y: 0 } : { x: 1, y: 0 };
      g.frightened = this.frightT > 0;
    }
  }

  private enterDecide(g: Ghost): void {
    g.dir = { x: 0, y: 1 };
    if (atCenter(g) && Math.abs(g.y - ccx(14)) < 0.6) {
      g.state = "house";
      g.houseT = 0.6;
      g.x = ccx(DOOR.c);
      g.y = ccx(14);
    }
  }

  private eatDot(): void {
    const { c, r } = tileOf(this.pac);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    const ch = this.dots[r][c];
    if (ch === ".") {
      this.dots[r][c] = " ";
      this.dotCount--;
      this.addScore(10);
      this.sfx?.waka();
    } else if (ch === "o") {
      this.dots[r][c] = " ";
      this.dotCount--;
      this.addScore(50);
      this.sfx?.pellet();
      this.combo = 0;
      this.frightT = Math.max(2.5, 6 - (this.level - 1) * 0.5);
      for (const g of this.ghosts) if (g.state === "out") g.frightened = true;
    }
  }

  private updatePac(dt: number): void {
    if (atCenter(this.pac)) this.pacDecide();
    this.pac.moving = !!(this.pac.dir.x || this.pac.dir.y);
    if (this.pac.moving) {
      stepEdge(this.pac, this.pac.speed * dt);
      wrapX(this.pac);
      this.pac.mouth += dt * 9;
    }
  }

  private ghostSpeed(g: Ghost): number {
    const lv = Math.min(this.level - 1, 6) * 3;
    if (g.state === "leaving") return 55;
    if (g.state === "entering") return 60;
    if (g.state === "eyes") return 175 + lv;
    if (g.frightened) return 45;
    return 62 + lv;
  }

  private updateGhost(g: Ghost, dt: number): void {
    if (g.state === "house") {
      g.houseT -= dt;
      if (g.houseT <= 0) {
        g.state = "leaving";
        g.dir = { x: 0, y: 0 };
      }
      return;
    }
    if (g.state === "eyes" && atCenter(g)) {
      const { c, r } = tileOf(g);
      if (c === DOOR.c && r === DOOR.r) g.state = "entering";
    }
    if (atCenter(g)) {
      if (g.state === "leaving") this.leaveDecide(g);
      else if (g.state === "entering") this.enterDecide(g);
      else this.outDecide(g);
    }
    stepEdge(g, this.ghostSpeed(g) * dt);
    wrapX(g);
  }

  private checkCollisions(): void {
    for (const g of this.ghosts) {
      if (g.state !== "out") continue;
      let dx = g.x - this.pac.x;
      const dy = g.y - this.pac.y;
      if (dx > W / 2) dx -= W;
      else if (dx < -W / 2) dx += W;
      if (dx * dx + dy * dy > 81) continue;
      if (g.frightened) {
        const pts = 200 * Math.pow(2, Math.min(this.combo, 3));
        this.combo++;
        this.addScore(pts);
        this.sfx?.ghost();
        this.floats.push({ x: g.x, y: g.y, txt: String(pts), life: 1 });
        g.frightened = false;
        g.state = "eyes";
      } else {
        this.state = ST.DIE;
        this.dieT = 1.6;
        this.sfx?.die();
        return;
      }
    }
  }

  // ------------------------------------------------------------------
  // state machine
  // ------------------------------------------------------------------

  private updatePlay(dt: number): void {
    // Fright and the scatter/chase phase clock run independently:
    // eating a power pellet must not extend the current phase.
    if (this.frightT > 0) {
      this.frightT -= dt;
      if (this.frightT <= 0) {
        this.frightT = 0;
        for (const g of this.ghosts)
          if (g.state === "out") g.frightened = false;
      }
    }
    this.modeT -= dt;
    if (this.modeT <= 0) {
      this.modeIdx = Math.min(this.modeIdx + 1, PHASES.length - 1);
      this.modeT = PHASES[this.modeIdx][1];
    }
    this.updatePac(dt);
    this.eatDot();
    for (const g of this.ghosts) this.updateGhost(g, dt);
    this.checkCollisions();
    if (this.state !== ST.PLAY) return;
    for (let i = this.floats.length - 1; i >= 0; i--) {
      this.floats[i].life -= dt;
      this.floats[i].y -= dt * 12;
      if (this.floats[i].life <= 0) this.floats.splice(i, 1);
    }
    if (this.dotCount === 0) {
      this.state = ST.LEVELUP;
      this.lvT = 2;
      this.sfx?.level();
    }
  }

  private finishDeath(): void {
    this.lives--;
    if (this.lives <= 0) {
      this.state = ST.OVER;
      this.onHighScore?.(this.hiscore);
      this.showOverlay("GAME OVER", [
        "SCORE " + this.score,
        "HIGH " + Math.max(this.hiscore, this.score),
        "",
        "PRESS ENTER TO RESTART",
      ]);
    } else {
      this.resetPositions();
      this.state = ST.READY;
      this.readyT = 1;
      this.showOverlay("READY", ["PREPARE TO EAT", "", "ARROWS / WASD TO MOVE"]);
    }
  }

  private tick(sdt: number): void {
    this.t += sdt;
    if (this.state === ST.READY) {
      this.readyT -= sdt;
      if (this.readyT <= 0) {
        this.state = ST.PLAY;
        this.overlay = null;
      }
    } else if (this.state === ST.DIE) {
      this.dieT -= sdt;
      if (this.dieT <= 0) this.finishDeath();
    } else if (this.state === ST.LEVELUP) {
      this.lvT -= sdt;
      if (this.lvT <= 0) {
        this.level++;
        this.initDots();
        this.resetPositions();
        this.state = ST.READY;
        this.readyT = 0.8;
        this.showOverlay("LEVEL " + this.level, [
          "GET READY",
          "",
          "THE GHOSTS ARE FASTER NOW",
        ]);
      }
    } else if (this.state === ST.PLAY) {
      this.updatePlay(sdt);
    }
  }

  /**
   * Advance the simulation by a variable frame time using fixed 60 Hz
   * substeps (matches the original update loop).
   */
  step(dt: number): void {
    let n = Math.max(1, Math.round(dt * 60));
    while (n-- > 0 && this.state !== ST.PAUSE) this.tick(1 / 60);
  }
}
