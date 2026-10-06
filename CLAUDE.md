# Neon Düello — notes for contributors (humans and agents)

Isometric pixel-art, two-player (hot-seat) card duel inspired by Yu-Gi-Oh! Speed Duels.
**The #1 priority is animation quality.** Read `docs/GAME_DESIGN.md` (Turkish) before working:
rules, the 20 cards, art direction, the animation bible and per-card storyboards live there.

## Stack & commands
- Phaser 3.90 + TypeScript (strict) + Vite. No external image/audio assets: all art is drawn in code
  with `PixelCanvas` (`src/art/pixel.ts`), all sound is synthesized (WebAudio).
- `npm run typecheck` — tsc. `npm test` — vitest (engine). `npm run build` — production build.
- `node tools/shot.mjs "?dev=<preview>&..." --out shots/<name>.png` — headless screenshot (WebGL works).
  - `--film 12 --every 80 --cols 4` — deterministic filmstrip (game time is frozen and stepped).
  - `--clip x,y,w,h` (game pixels) to zoom in; `--scale 3` for more detail; `--eval "js"` to drive the page.
  - Always LOOK at the PNG you produce (Read tool) — that is how you verify art and animation.
- Dev previews: `src/dev/previews/<name>.ts` (auto-discovered, opened with `?dev=<name>`).
  `?dev=monster&id=<id>` (sheet/live/board modes) and `?dev=monsters` exist already.

## Conventions
- Resolution 640×360, `pixelArt: true`. Integer pixel positions for anything crisp.
- UI text is Turkish (use correct letters: ç ğ ı İ ö ş ü). Code, identifiers and comments are English.
- Colors only from `src/art/palette.ts` (`PAL`, `RAMPS`, `ATTRIBUTE_RAMP`, `PLAYER_COLOR`...).
- Screen positions only via `src/view/layout.ts` (`zoneXY`, `isoToScreen`, `DEPTH`, `UI`).
- Monsters are drawn facing RIGHT; player 2 uses flipX.
- Boot-time texture generation goes in `src/boot/NN-<name>.ts` (auto-discovered, ordered by NN).
- Promise-based animation helpers: `src/vfx/core.ts` (`tween`, `wait`, `shake`, `flash`, `hitStop`).
- Shared contracts — do not rename/remove, only extend additively: `src/data/cards.ts`,
  `src/engine/types.ts`, `src/art/types.ts`, `src/view/layout.ts`, `src/ui/text.ts` (API),
  `src/audio/sfx.ts` (API), `src/vfx/core.ts`.
- Several agents work in this tree at the same time. Only edit the files you own for your task;
  `tsc` errors in files you do not own are someone else's work in progress — ignore them.
- Never commit; the orchestrator commits.
