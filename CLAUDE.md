# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page vanilla JS Tetris implementation. No dependencies, no build step, no package.json. Three files: `index.html` (DOM/canvas structure), `style.css` (dark/retro arcade theme), `game.js` (all game logic, ~300 lines).

## Running the game

No install/build required — open directly or serve statically:

```bash
open index.html                # macOS, or just open in a browser
python3 -m http.server 8000    # or: npx serve .
```

There is no test suite, linter, or build tool configured in this repo.

## Architecture (game.js)

Everything lives in one file with module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — there is no class/module structure, just top-level functions operating on shared globals.

- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: hardcoded as square matrices in `PIECES`. Rotation (`rotateCW`) is a matrix transpose + reverse, not stored per-piece states.
- **Collision** (`collide`): checks piece cells against board bounds and locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` until a non-colliding position is found, else the rotation is discarded.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and drops the piece one row when it exceeds `dropInterval`.
- **Line clearing** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.
- **Rendering**: `draw()` redraws the full board canvas each frame (grid, locked blocks, ghost, current piece); `drawNext()` renders the preview piece on a separate small canvas.

Control flow: `init()` sets up state and calls `spawn()` + starts the loop → `spawn()` promotes `next` to `current` and generates a new `next`, checking for game-over collision on spawn → `keydown` handler dispatches move/rotate/soft-drop/hard-drop/pause, each followed by `updateHUD()`.

## Tunable constants (top of game.js)

`COLS`, `ROWS`, `BLOCK` (cell px size), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` width/height in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).
