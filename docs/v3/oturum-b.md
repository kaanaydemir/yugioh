# Lane B session log — grim_warden (R2), wisp_imp (R3), mudgrasp_spirit (C10), hollow_ogre (C6)

Branch `claude/kart-b`. Brief: `docs/v3/PARALEL_OTURUMLAR.md`. Builder handbook (architecture map, registration
points, event shapes, gates): `docs/v3/oturum-b/HANDBOOK.md`. Per-card working notes: `docs/v3/oturum-b/<id>.md`.

## Shared-file edits made by lane B (all additive)
- `src/audio/sfx.ts`: `| KartBSfxName` (+ type import).
- `src/audio/sounds.ts`: `...KART_B_RECIPES` (+ import).
- `src/cinematics/_v3/sound.ts`: `...KART_B_VOICES` inside `CHARACTER_SOUNDS` (+ import).
- Lane sound index `src/audio/v3/kart-b.ts` + per-card `src/audio/v3/<id>.ts`. Cinematics: `src/cinematics/kart-b/`.

## Environment note
Headless Chromium path: the tools look for `<PLAYWRIGHT_BROWSERS_PATH>/chromium-*/chrome-linux/chrome`; this container ships
`chrome-linux64`. Run tools with `PLAYWRIGHT_BROWSERS_PATH=<dir with a chromium-1243/chrome-linux symlink>`.
v1 baselines were filmed at 684e290 (before any lane B edit): `shots/v3/a3/baseline/v1films`, `shots/v3/a56/baseline/a6v1films`.

## Status
| Card | Rig | Card art | Cut-in | Cinematics | SFX | Critique rounds | Gates |
|---|---|---|---|---|---|---|---|
| grim_warden | WIP | WIP | WIP | – | – | 0 | – |
| wisp_imp | WIP | WIP | n/a | – | – | 0 | – |
| mudgrasp_spirit | WIP | WIP | n/a | – | – | 0 | – |
| hollow_ogre | – | – | n/a | – | – | 0 | – |

Checkpoint 2026-10-31 18:10 UTC (8af5386): build stage in progress — grim_warden and wisp_imp rigs + card art, grim cut-in, mudgrasp_spirit rig underway; hollow_ogre queued.
