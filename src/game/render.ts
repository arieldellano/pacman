import { COLS, DOOR, H, MAZE, ROWS, T, W } from "./constants";
import { ccx } from "./maze";
import { ST } from "./types";
import type { GameEngine } from "./engine";
import type { Ghost } from "./types";

export interface WallCache {
  normal: HTMLCanvasElement;
  flash: HTMLCanvasElement;
}

function buildWallsCanvas(color: string, glow: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.strokeStyle = color;
  x.lineWidth = 2;
  x.lineCap = "round";
  x.shadowColor = glow;
  x.shadowBlur = 6;
  const open = (c2: number, r2: number) =>
    c2 < 0 || r2 < 0 || c2 >= COLS || r2 >= ROWS ? false : MAZE[r2][c2] !== "#";
  for (let r = 0; r < ROWS; r++)
    for (let c2 = 0; c2 < COLS; c2++) {
      if (MAZE[r][c2] !== "#") continue;
      const px = c2 * T;
      const py = r * T;
      if (open(c2, r - 1)) {
        x.beginPath();
        x.moveTo(px + 2, py + 2);
        x.lineTo(px + T - 2, py + 2);
        x.stroke();
      }
      if (open(c2, r + 1)) {
        x.beginPath();
        x.moveTo(px + 2, py + T - 2);
        x.lineTo(px + T - 2, py + T - 2);
        x.stroke();
      }
      if (open(c2 - 1, r)) {
        x.beginPath();
        x.moveTo(px + 2, py + 2);
        x.lineTo(px + 2, py + T - 2);
        x.stroke();
      }
      if (open(c2 + 1, r)) {
        x.beginPath();
        x.moveTo(px + T - 2, py + 2);
        x.lineTo(px + T - 2, py + T - 2);
        x.stroke();
      }
    }
  return c;
}

/** Pre-render the wall layers once; reuse them every frame. */
export function buildWalls(): WallCache {
  return {
    normal: buildWallsCanvas("#2a2af0", "#4040ff"),
    flash: buildWallsCanvas("#ffffff", "#ffffff"),
  };
}

function drawDots(ctx: CanvasRenderingContext2D, eng: GameEngine): void {
  if (!eng.dots.length) return;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = eng.dots[r][c];
      if (ch !== "." && ch !== "o") continue;
      const x = ccx(c);
      const y = ccx(r);
      if (ch === ".") {
        ctx.fillStyle = "#ffb894";
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const rad = 4.5 + Math.sin(eng.t * 7) * 1.3;
        ctx.fillStyle = "#ffd9c0";
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
}

function angOf(d: { x: number; y: number }): number {
  if (d.x === 1) return 0;
  if (d.x === -1) return Math.PI;
  if (d.y === -1) return -Math.PI / 2;
  if (d.y === 1) return Math.PI / 2;
  return 0;
}

function drawPac(ctx: CanvasRenderingContext2D, eng: GameEngine): void {
  const x = eng.pac.x;
  const y = eng.pac.y;
  const R = T * 0.46;
  if (eng.state === ST.DIE) {
    const p = 1 - Math.max(0, eng.dieT) / 1.6;
    const open = Math.min(Math.PI, 0.2 + p * 2.6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, p - 0.6) / 0.4);
    ctx.translate(x, y);
    ctx.rotate(p * Math.PI * 2);
    ctx.fillStyle = "#ffe600";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, open, Math.PI * 2 - open);
    ctx.fill();
    ctx.restore();
    return;
  }
  let open = 0.05 + 0.3 * (0.5 + 0.5 * Math.sin(eng.pac.mouth * 2));
  if (!eng.pac.moving) open = 0.25;
  const a = angOf(eng.pac.dir);
  ctx.fillStyle = "#ffe600";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, R, a + open, a + Math.PI * 2 - open);
  ctx.fill();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  dir: { x: number; y: number },
  scale: number,
): void {
  const off = 0.35 * r * scale;
  for (const s of [-1, 1]) {
    const ex = x + s * r * 0.38;
    const ey = y - r * 0.12;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.3 * scale, r * 0.38 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1933c8";
    ctx.beginPath();
    ctx.arc(ex + dir.x * off * 0.6, ey + dir.y * off * 0.6, r * 0.16 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, eng: GameEngine, g: Ghost): void {
  const x = g.x;
  let y = g.y;
  if (g.state === "house") y += Math.sin(eng.t * 5 + g.ph) * 2;
  const r = T * 0.44;
  const eyesOnly = g.state === "eyes" || g.state === "entering";
  if (!eyesOnly) {
    let body = g.color;
    let face: string | null = null;
    if (g.frightened) {
      const blink = eng.frightT < 2 && ((eng.t * 8) | 0) % 2 === 0;
      body = blink ? "#f0f0f0" : "#2135c8";
      face = blink ? "#2135c8" : "#fff";
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, Math.PI * 2);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x + (r * 2) / 3, y + r * 0.62);
    ctx.lineTo(x + r / 3, y + r);
    ctx.lineTo(x, y + r * 0.62);
    ctx.lineTo(x - r / 3, y + r);
    ctx.lineTo(x - (r * 2) / 3, y + r * 0.62);
    ctx.lineTo(x - r, y + r);
    ctx.closePath();
    ctx.fill();
    if (face) {
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.1, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.35, y - r * 0.1, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = face;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y + r * 0.4);
      ctx.lineTo(x - r * 0.3, y + r * 0.2);
      ctx.lineTo(x, y + r * 0.4);
      ctx.lineTo(x + r * 0.3, y + r * 0.2);
      ctx.lineTo(x + r * 0.6, y + r * 0.4);
      ctx.stroke();
      return;
    }
    drawEyes(ctx, x, y, r, g.dir, 1);
  } else {
    drawEyes(ctx, x, y, r, g.dir, 1.25);
  }
}

function drawFloats(ctx: CanvasRenderingContext2D, eng: GameEngine): void {
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  for (const f of eng.floats) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = "#fff";
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

/** Draw one full frame from engine state. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  eng: GameEngine,
  walls: WallCache,
): void {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(
    eng.state === ST.LEVELUP && ((eng.t * 4) | 0) % 2 === 0 ? walls.flash : walls.normal,
    0,
    0,
  );
  ctx.fillStyle = "#ffb8ff";
  ctx.fillRect(ccx(DOOR.c) - 5, ccx(DOOR.r) + T / 2 - 1.5, 10, 3);
  drawDots(ctx, eng);
  for (const g of eng.ghosts) drawGhost(ctx, eng, g);
  drawPac(ctx, eng);
  drawFloats(ctx, eng);
}
