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

## Lane-A decisions on the design docs' "orchestrator asks" (2026-10-31)
All are ADDITIVE shared-file changes, built once by a single shared-infrastructure step before the card
builders start (so three builders never edit the same shared file at once). The merging orchestrator should
review these lines first.
- APPROVED: new `ShatterMaterial`s `'ash'` (ashen_drake) and `'acid'` (venom_drake) + `MATTER_RAMP` /
  `_v3/death.ts ACCENTS` entries (+ `AccentSpec.orbit` option); the `'crackle'` ring interpreter in the
  materials sound path; `GENERATED_HIT_MATERIALS` entries for the lane-A struck-body sounds + the pinned test
  updated additively.
- APPROVED: `attack.ramp?: RampName` on `PresentationRecipe` and its use in `battle/battle.ts` (fire flash for
  the ash ignition instead of the DARK violet).
- APPROVED: one-line ramp entries for ashen_drake / venom_drake in `traps/_mirror_v3.ts STRIKE_RAMP` and
  `traps/chains_of_light.ts CHARGE`.
- APPROVED: the cloud_hatchling grown-form variant mechanism (additive hooks in `MonsterUnit.ts`, two lines in
  `FieldView.ts`, unit-sheet-aware lookups at the listed call sites, `VARIANT_SOUNDS`), gated so units without a
  variant behave byte-identically.
- APPROVED: hatchling growth drops the "forward ratchet" layer of YENI §5.1 (ratchet = dial_jester's layer;
  back-to-back they would blur). Owner may veto.
- READING: "kalıcı" = permanent while the slot stays on the field (M14). A returned/re-summoned hatchling is a baby.
- Frame-budget class: ashen_drake and venom_drake gated as `ace`; cloud_hatchling sheets as `medium`.
- DECLINED for now (owner question): per-monster ambient idle sound (ashen heartbeat, hatchling hiccup, venom
  drip). No ambient-sound system exists; idle sounds play only inside cinematics.
- DECLINED (optional asks): soul_recall `revived` hook, per-strike hit-volume, cut-in band-mask hook.
- venom_drake art registers under a new filename (`venom_drake-wyvern.ts`) so `src/art/monsters/index.ts`
  (shared with lane B's exclusions) is never edited.

## Open issues
- Owner question: ambient idle sounds per monster (see above).
- Owner question (venom_drake §10.1): only the death scar lasts the duel; attack scars fade after ~2.4 s.
