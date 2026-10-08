"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LifeIcon from "@/components/life-icon";
import { H, HISCORE_KEY, W } from "@/game/constants";
import { Sfx } from "@/game/audio";
import { GameEngine } from "@/game/engine";
import { buildWalls, renderFrame } from "@/game/render";
import { DOWN, LEFT, RIGHT, UP } from "@/game/constants";
import { ST } from "@/game/types";
import type { Dir, Hud } from "@/game/types";

function loadHighScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem(HISCORE_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(n: number): void {
  try {
    localStorage.setItem(HISCORE_KEY, String(n));
  } catch {
    /* private mode etc. */
  }
}

export default function PacGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      const sfx = new Sfx();
      const eng = new GameEngine(sfx);
      eng.hiscore = loadHighScore();
      eng.onHighScore = saveHighScore;
      sfxRef.current = sfx;
      engineRef.current = eng;
    }
    return engineRef.current;
  }, []);

  // Game loop: fixed-step simulation + canvas render, HUD synced to
  // React state only when it changes.
  useEffect(() => {
    const eng = getEngine();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const walls = buildWalls();
    let lastTs = 0;
    let lastHudJson = "";
    let raf = 0;
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (!lastTs) lastTs = ts;
      let dt = (ts - lastTs) / 1000;
      lastTs = ts;
      if (dt > 0.25) dt = 0.25;
      if (dt <= 0) return;
      eng.step(dt);
      renderFrame(ctx, eng, walls);
      const h = eng.hud();
      const j = JSON.stringify(h);
      if (j !== lastHudJson) {
        lastHudJson = j;
        setHud(h);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getEngine]);

  // Keyboard.
  useEffect(() => {
    const eng = getEngine();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      let d: Dir | null = null;
      if (k === "ArrowUp" || k === "w" || k === "W") d = UP;
      else if (k === "ArrowDown" || k === "s" || k === "S") d = DOWN;
      else if (k === "ArrowLeft" || k === "a" || k === "A") d = LEFT;
      else if (k === "ArrowRight" || k === "d" || k === "D") d = RIGHT;
      if (d) {
        e.preventDefault();
        eng.dismissReady();
        eng.setWant(d);
      } else if (k === "p" || k === "P" || k === "Escape") {
        eng.togglePause();
      } else if (k === "m" || k === "M") {
        if (sfxRef.current) sfxRef.current.muted = !sfxRef.current.muted;
      } else if (k === "Enter" || k === " ") {
        e.preventDefault();
        sfxRef.current?.ensure();
        eng.primaryAction();
      }
      sfxRef.current?.ensure();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [getEngine]);

  // React attaches touchmove as passive, so preventDefault needs a
  // native listener to stop page scrolling while swiping.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    stage.addEventListener("touchmove", prevent, { passive: false });
    return () => stage.removeEventListener("touchmove", prevent);
  }, []);

  const handleTouchEnd = (e: React.TouchEvent) => {
    const eng = getEngine();
    const s0 = touchStart.current;
    touchStart.current = null;
    if (!s0) return;
    const t0 = e.changedTouches[0];
    const dx = t0.clientX - s0.x;
    const dy = t0.clientY - s0.y;
    if (eng.state === ST.READY || eng.state === ST.OVER) {
      eng.primaryAction();
      return;
    }
    if (Math.hypot(dx, dy) < 20) return;
    eng.setWant(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
  };

  const overlay = hud?.overlay ?? null;

  return (
    <div className="flex w-full flex-col items-center gap-2.5 p-3">
      <div className="flex w-full max-w-[480px] items-start justify-between">
        <div>
          <div className="mb-1 text-[11px] tracking-[2px] text-[#8f8fff]">SCORE</div>
          <div className="text-[22px] font-bold text-[#ffe600] [text-shadow:0_0_8px_rgba(255,230,0,0.45)] max-[420px]:text-lg">
            {hud?.score ?? 0}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] tracking-[2px] text-[#8f8fff]">LEVEL</div>
          <div className="text-[22px] font-bold text-white max-[420px]:text-lg">
            {hud?.level ?? 1}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-[11px] tracking-[2px] text-[#8f8fff]">HIGH</div>
          <div className="text-[22px] font-bold text-[#ffe600] [text-shadow:0_0_8px_rgba(255,230,0,0.45)] max-[420px]:text-lg">
            {hud?.high ?? 0}
          </div>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative w-full max-w-[480px] touch-none"
        onTouchStart={(e) => {
          sfxRef.current?.ensure();
          const t0 = e.changedTouches[0];
          touchStart.current = { x: t0.clientX, y: t0.clientY };
        }}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          e.preventDefault();
          sfxRef.current?.ensure();
          getEngine().primaryAction();
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block h-auto w-full border-2 border-[#191970] shadow-[0_0_24px_rgba(40,40,255,0.25)] [image-rendering:pixelated]"
        />
        {overlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#00000a]/70 p-4 text-center">
            <div className="text-2xl font-extrabold tracking-[6px] text-[#ffe600] [text-shadow:0_0_14px_rgba(255,230,0,0.6)] max-[420px]:text-xl">
              {overlay.title}
            </div>
            <div className="text-xs leading-[1.9] tracking-[2px] text-[#cfd2ff]">
              {overlay.lines.map((line, i) => (
                <div key={i}>{line || "\u00A0"}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-[480px] items-center justify-between">
        <div className="flex min-h-5 items-center gap-1.5">
          {Array.from({ length: Math.max(0, (hud?.lives ?? 3) - 1) }, (_, i) => (
            <LifeIcon key={i} />
          ))}
        </div>
        <div className="text-right text-[10px] tracking-[1px] text-[#666aa8] max-[420px]:hidden">
          ARROWS / WASD MOVE · P PAUSE · ENTER START
        </div>
      </div>
    </div>
  );
}
