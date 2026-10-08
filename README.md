# Pac-Man-Like

A classic Pac-Man-style arcade game built with [Next.js](https://nextjs.org), React 19, TypeScript, and Tailwind CSS 4. Canvas rendering, WebAudio synth SFX, keyboard + touch controls, and a persistent high score.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Controls:** Arrow keys / WASD to move · `P` pause · `Enter`/space start · `M` mute · swipe on mobile.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server (Turbopack)     |
| `npm run build`   | Production build                     |
| `npm run start`   | Serve the production build           |
| `npm test`        | Run the Vitest suite                 |
| `npm run lint`    | Run ESLint                           |

## Architecture

The game logic is fully decoupled from the DOM so it runs in Node for tests:

```
src/
├── app/                  # Next.js App Router shell
│   ├── layout.tsx        # Metadata, fonts, dark game shell
│   ├── page.tsx          # Renders <PacGame />
│   └── globals.css       # Tailwind 4 theme
├── components/
│   ├── pac-game.tsx      # Client component: canvas, HUD, input, rAF loop
│   └── life-icon.tsx     # SVG life indicator
└── game/
    ├── constants.ts      # Maze data, tile size, ghost defs, phase schedule
    ├── types.ts          # Shared types (Pac, Ghost, Hud, game states)
    ├── maze.ts           # Pure grid helpers (centers, edges, tunnel wrap)
    ├── engine.ts         # GameEngine: state machine, AI, scoring (no DOM)
    ├── render.ts         # Canvas frame rendering + pre-rendered wall cache
    ├── audio.ts          # WebAudio Sfx (lazy context, synth blips)
    └── engine.test.ts    # Vitest suite: maze, setup, and gameplay sims
```

- `GameEngine` advances with fixed 60 Hz substeps (`step(dt)`) and exposes a
  `hud()` snapshot; the React component polls it and only re-renders when a
  value changes.
- The high score is persisted to `localStorage` under `pacLikeHiscore`.
- Ghosts use the classic scatter/chase phase schedule with per-ghost
  personalities (Blinky, Pinky, Inky, Clyde), a ghost house, tunnel wrap,
  power-pellet fright mode, and an eyes return-to-house state.
