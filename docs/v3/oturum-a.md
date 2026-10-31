# Lane A session log — ashen_drake · venom_drake · cloud_hatchling

Branch `claude/kart-a` (from 684e290). Brief: `docs/v3/PARALEL_OTURUMLAR.md`.

## Status

| Card | Design | Sprite rig (P1/P2) | Card art | Cut-in | Cinematics | SFX | Critique rounds | Gates | Pushed |
|---|---|---|---|---|---|---|---|---|---|
| ashen_drake (R1, no rebirth) | in progress | — | — | — | — | — | 0 | — | — |
| venom_drake (full redesign) | in progress | — | — | — | — | — | 0 | — | — |
| cloud_hatchling (C3 + aged form) | in progress | — | — | n/a (not ace) | — | — | 0 | — | — |

## Environment notes
- The container's Chromium lives at `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`, but the tools look for
  `chromium-*/chrome-linux/chrome`. Run browser tools with `PLAYWRIGHT_BROWSERS_PATH=<dir>` pointing to a folder
  that holds `chromium-9999/chrome-linux/chrome` → that binary (a symlink). Tools are not modified.
- `shots/` is gitignored, so the v1 gate baselines were filmed at the lane's start commit (684e290):
  `shots/v3/a3/baseline/v1films` and `shots/v3/a56/baseline/a6v1films`.
- Known test failures at start (4): cardface-v3 G1 (scrap_raiders, lane D), dusk_ashen, hourglass_imp, shield_titan.

## Design docs
- `docs/v3/kart-a/ashen_drake.md`, `docs/v3/kart-a/venom_drake.md`, `docs/v3/kart-a/cloud_hatchling.md`

## Open issues
- (none yet)
