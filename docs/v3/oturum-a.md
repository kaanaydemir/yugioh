# Lane A session log — ashen_drake · venom_drake · cloud_hatchling

Branch `claude/kart-a` (from 684e290). Brief: `docs/v3/PARALEL_OTURUMLAR.md`.

## Status

| Card | Design | Sprite rig (P1/P2) | Card art | Cut-in | Cinematics | SFX | Critique rounds | Gates | Pushed |
|---|---|---|---|---|---|---|---|---|---|
| ashen_drake (R1, no rebirth) | done (rev 3) | — | — | — | — | — | 0 | — | — |
| venom_drake (full redesign) | done (rev 3) | — | — | — | — | — | 0 | — | — |
| cloud_hatchling (C3 + aged form) | done (rev 3) | — | — | n/a (not ace) | — | — | 0 | — | — |

## Environment notes
- The container's Chromium lives at `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`, but the tools look for
  `chromium-*/chrome-linux/chrome`. Run browser tools with `PLAYWRIGHT_BROWSERS_PATH=<dir>` pointing to a folder
  that holds `chromium-9999/chrome-linux/chrome` → that binary (a symlink). Tools are not modified.
- `shots/` is gitignored, so the v1 gate baselines were filmed at the lane's start commit (684e290):
  `shots/v3/a3/baseline/v1films` and `shots/v3/a56/baseline/a6v1films`.
- Known test failures at start (4): cardface-v3 G1 (scrap_raiders, lane D), dusk_ashen, hourglass_imp, shield_titan.

## Where we are (WIP checkpoint, 2026-10-31 ~20:00 UTC)
- Done + pushed: design docs rev 3 (3 rounds of design critique), shared infrastructure + its adversarial-verify fixes.
- Running (build workflow `kart-a-build`, run wf_cf41a606-b86): sprite builds of ashen_drake (new vulture-perch rig:
  gbuf/rig/cloak/ember/anims; old quadruped kept under `_ashen_legacy/` until the build ends) and venom_drake
  (scorpion wyvern: gbuf/rig/holes/anims, registered as `venom_drake-wyvern.ts`; old serpent files deleted).
  WIP: `tests/art/venom_drake.test.ts` still imports the deleted file (being rewritten by the builder).
- Next per card: 3 sheet-critique rounds → card art (+cut-in) + critique → cinematics + SFX → 3 film-critique rounds
  (visual + sound/timing critics) → gates → 3 adversarial verifiers → commit/push. cloud_hatchling starts when a
  builder slot frees (2 concurrent agents on this 4-CPU container).

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

## Shared infrastructure (lane A)
Built once, before the card builders start (2026-10-31), from the APPROVED asks above. Everything is additive:
a unit / monster / recipe without the new feature takes exactly today's code path (v1 and v3). Builders: do not
edit these shared files again for these features; extend the registries / data named below.

### Files and what was added (API for builders)
| File | Added |
|---|---|
| `src/vfx/shatter.ts` | `ShatterMaterial` += `'ash' \| 'acid'` (+ `SHATTER_MATERIALS_LIST`); `SHATTER_MATERIALS.ash` (blueprint §5.6: settles, no white / shake / stop; `moteVx` drift with the blow) and `.acid` (placeholder: small wet pieces drop and rest, leaf → void, no white). New optional `MaterialPreset.moteVx` (sideways mote drift along `push.x`; absent = today's ±12). **Variant-aware**: a sprite showing a variant sheet (`mon:<id>:<name>[:p2]`) breaks as the variant art's own pixels, cached as `shatter:<id>:<name>:<anim>:<f>[:p2]`. |
| `src/cinematics/_v3/presets.ts` | `MATTER_RAMP.ash = RAMPS.stone` (fire1 is darker than stone3, so no ember tone on top), `MATTER_RAMP.acid = [void0, void1, leaf1, leaf2, leaf3]` (venom's matter). |
| `src/cinematics/_v3/death.ts` | `ACCENTS.ash` (placeholder: grey puffs sift down and settle, fire2 floor light, no pool) and `ACCENTS.acid` (venom §5.4 exactly: falling leaf3/leaf2 drops `floor: true`, default flicker, pool `[leaf1, void0, ink, leaf3]`, `orbit: null`, leaf3 light). `AccentSpec.orbit?: number \| null` (the pool's 3 orbiting pixels; default `PAL.white`, null = none) and `emit.flicker?` (default = today's rule). `bodyPixels` reads `unitFrame` (cache key + variant tag); kit deaths use `soundsOfUnit(u)`. |
| `src/art/materials/types.ts` | `RingSpec` `'crackle'` gains optional `dec?: PerWeight` (default `[0.25, 0.4]`; Magic = 0.6 × Heavy), `knock?: number` (tonal sine knock Hz, × 1.25 light, falls to half), `rattle?: number` (2 extra clicks at that band on Heavy). |
| `src/audio/v3/materials.ts` | `'crackle'` in `RING_KINDS` + its interpreter in `ring()` (a click train at `hp`, `rate`/s, front-loaded; never a pitched ring). `GENERATED_HIT_MATERIALS = ['stone', 'ash', 'venomscale', 'hatchhide']` → `hitAsh*`, `hitVenomscale*`, `hitHatchhide*` (Light / Heavy / Magic) exist in `SfxName` / `RECIPES`. `hitSfxName` follows `sound.same`, so hatchhide plays `hitCloth*` until its def gets its own `MaterialSound` (phase 2 needs no shared edit). |
| `src/art/materials/defs/ash.ts`, `venomscale.ts`, `hatchhide.ts` (new) | **Placeholders from the blueprints; the card builder owns each file from now on.** `ash`: §3.4 + `ASH_SOUND` (`crackle` hp 2200, rate 60), `death { shatter: 'ash', accent: 'fire' }`. `venomscale`: venom §3 + ring `{ crackle, hp 6500, rate 260, dec [0.12, 0.35], knock 120, rattle 4200 }` (= the blueprint's `case 'crackle'`), `death { shatter: 'acid', accent: 'acid' }` (deviation: the materials test pins `matter = MATTER_RAMP[death.shatter]`; the recipe still breaks the body as `shadow` + `acid`). `hatchhide`: §1.3 tones, `sound: { same: 'cloth' }` (phase 1). |
| `tests/art/materials.test.ts` | the pinned list / names updated additively; a crackle block (interpretable, deterministic, ringless, distinct per weight / material; hitSfxName routing). |
| `src/presentation/types.ts` | `attack.ramp?: RampName` on `PresentationRecipe`. |
| `src/cinematics/battle/battle.ts` | the `aRamp` of `battleV3` only: `v3Recipe(attacker.cardId)?.attack.ramp` → `RAMPS[ramp]` before `physicalThrow`'s greys and the attribute ramp (the v1 branch is untouched). |
| `src/cinematics/traps/_mirror_v3.ts` | `STRIKE_RAMP.ashen_drake = RAMPS.fire`; the intercepted charge voice via `soundsOfUnit(u)`. |
| `src/cinematics/traps/chains_of_light.ts` | `CHARGE.ashen_drake = [fire4, fire3, stone2, stone1]`; charge voice via `soundsOfUnit(u)`. |
| `src/cinematics/_v3/sound.ts` | `VARIANT_SOUNDS: Record<'<cardId>:<variant>', Partial<CharacterSounds>>` (empty) and `soundsOfUnit(u)` (= `soundsOf(u.cardId)` without a variant); `holdCharge` uses it. |
| `src/art/variants.ts` (new) | `registerMonsterVariant(id, { name, art(), when(slot), rewind?, rewindSfx? })`, `slotVariant` (null unless LOOK_V3), `variantArt`, `variantSheetKey` (`mon:<id>:<name>` / `…:p2` for a relight art), `variantOfSheetKey`, `ensureVariantSheet` (prepare, no paint), `warmVariant` (both players, every anim, background), `rewindAnims(id, variant)` / `rewindSfx` (the lane-D contract; default `[summon reversed]`). |
| `src/duel/unit-variant.ts` (new) | `syncUidVariants` records every slot, face-down too (a grown hatchling under magic_hat keeps `permAtk`; the reveal's flip builds the unit before the next sync, so it is grown from frame 0, §3.3 kaChGrownHat). `variantOf(u)`, `variantTag(u)` (`''` / `':grown'`, for per-card pixel caches), `setUnitVariant(u, name)` (upgrade-only; records the uid, warms, `u.setArt`), `syncUidVariants(scene, state)`, `syncSlotVariant(u, id, slot)`, `uidVariant`, `unitFrame(u, anim, f, o?)` (= `monsterFrame(u.cardId…)` without a variant), `unitSheetKey(u)` (= `monsterSheetKey(id, player)` without a variant), `installUnitVariants()` (v3 only). |
| `src/duel/MonsterUnit.ts` | `art` not readonly; `animSheetKey`; statics `sheetFor? / animSheetFor? / animKeyFor? / onBuilt?` (installed by unit-variant in v3 only); private `animKey(anim)` at the 8 `monsterAnimKey(this.cardId…)` sites; `ownsKey(k)` + the `syncSheet` guard; `setArt(art)` (shadow re-keyed from the new idle 0, applyFacing, a resting loop restarts on the new keys); `top` via `artFrame(this.art…)`; `onBuilt` as the constructor's last step. |
| `src/duel/FieldView.ts` | `installUnitVariants()` at module load; `if (LOOK_V3) syncUidVariants(scene, state)` at the top of `sync`; `if (LOOK_V3) syncSlotVariant(u, cardId, slot)` after `const u = e.unit!`. |
| `src/cinematics/_core/project.ts` | **v3 only (`LOOK_V3`)**: a `jesterAging` `activate` (monsterEffect) on a face-up slot without `permAtk` marks the uid; that uid's next `statChange` (rules.ts callCoin: activate, then permAtk / permDef inside one `withStats`) sets `permAtk = atk − prevAtk`, `permDef = def − prevDef` on the projected slot. So the count-up still animates (the sync after the activate shows the baby values) and every frontier sync after it keeps the grown badge and form. v1 keeps today's projection byte for byte. (Lane B's `boostAtk` gap is not part of this change.) |
| `src/duel/scenario.ts` | `MonSpec` += `permAtk? / permDef?` (stages a grown hatchling). |
| step-8 sweep | `strikes-a/_kit.ts currentPixels`, `strikes-b/_kit.ts framePixelsOf / glintPoint (key + tag) / worldBox`, `traps/_chains.ts` (2), `_v3/death.ts bodyPixels`, `_v3/summon.ts poseSpan`, `_v3/card.ts`, `duel/auras-v3.ts equipAnchor (key + tag)` → `unitFrame`; `_v3/warm.ts warmUnitPoses(u, anims)` (new; used by `battle/declare.ts`) and `spells/_blade_v3.ts warmBond` → `unitSheetKey(u)`; voices at `_mirror_v3`, `chains_of_light`, `_v3/death.ts` (2), `holdCharge`, `recipe/flip.ts` (the rise), `recipe/strike.ts throwStrike`, `recipe/summon.ts assemble` → `soundsOfUnit(u)` (the flip accents' `soundsOf(id)` stay: they get a card id, no unit). Not touched (as planned): `duel/warm.ts`, `view/light/glow.ts`, `LightLayer.ts`. |
| `tests/duel/unit-variant.test.ts` (new) | registry, hooks null without a variant, upgrade-only swap, P2 relit sheet, `ownsKey`, the swap persisting across resyncs (stale snapshot, rebuilt unit, re-summoned baby, a face-down grown uid built grown), the projected growth landing at the statChange (baby up to it, the engine's 2300 / 1700 after), a statChange without the growth activate projecting nothing. |

### How builders use it
- **ash / acid death:** recipe `death: { material: 'ash', accent: 'fire' }` (ashen) / `death: { material: 'shadow', accent: 'acid' }` (venom). Tune `SHATTER_MATERIALS.ash/.acid` and `ACCENTS.ash/.acid` values in place (placeholders), keep the keys.
- **struck body:** set the def's `sound` (ash / venomscale already own one; hatchhide: replace `{ same: 'cloth' }` with a `MaterialSound`). A `crackle` ring takes `hp`, `rate`, optional `dec`, `knock`, `rattle`. SE-5 LSD checks are the builder's.
- **attack.ramp:** `attack: { …, ramp: 'fire' }` in the recipe (ashen_drake) → the kit's contact-flash tint, sparks and hit reaction use `RAMPS.fire`.
- **trap ramps:** already in (`STRIKE_RAMP.ashen_drake`, `CHARGE.ashen_drake`); change the values there if the art needs it.
- **variant (cloud_hatchling):** `registerMonsterVariant('cloud_hatchling', { name: 'grown', art: () => grownArt, when: (s) => monsterDef('cloud_hatchling').effect === 'jesterAging' && s.permAtk !== undefined, rewind: [{ anim: 'special', reverse: true }, { anim: 'summon', reverse: true }], rewindSfx: 'hatchVoiceCrackRev' })` from a module that does NOT default-export the grown art (a default export in `src/art/monsters-v3/*.ts` would be read as the card's v3 art); the growth cinematic calls `setUnitVariant(u, 'grown')` at special f15 and `warmVariant(scene, id, 'grown')` early; cinematics test `variantOf(u) === 'grown'` and read pixels with `unitFrame(u, …)`. Grown voice: add `VARIANT_SOUNDS['cloud_hatchling:grown'] = { roar: …, charge: … }` (one additive entry in `_v3/sound.ts`, or assign it from the card's own module) and use `soundsOfUnit(u)`. Stage films with `{ id: 'cloud_hatchling', permAtk: 1200, permDef: 800 }`.

### Gates (shared step)
- `npm run typecheck`: clean.
- `npm test`: 1322 passed, 4 failed = exactly the 4 known at start (cardface-v3 G1, dusk_ashen, hourglass_imp,
  shield_titan); +10 new tests (tests/duel/unit-variant.test.ts 8, materials crackle 2), all pass.
- `filmdiff --set v1 --base shots/v3/a3/baseline/v1films`: **17/17 IDENTICAL** (`shots/kart-a/shared/v1films`).
- `filmdiff --set a6v1 --base shots/v3/a56/baseline/a6v1films`: **26/26 IDENTICAL** (`shots/kart-a/shared/a6v1films`).
- v3 identity (extra): the slice set + sbSentinelDies, tbChains, tbBlocked, saTitanP2Blocked filmed at HEAD in a
  clean worktree (`shots/kart-a/shared/v3base-head`) vs this tree (`shots/kart-a/shared/v3cmp`): every frame is
  pixel-identical outside the arena's ambient side holograms / sky flyers, which differ between two runs of HEAD
  itself too (`shots/kart-a/shared/v3head-self`: HEAD vs HEAD also DIFFERS there), so v3 is unchanged on the board.
- `node tools/palcheck.mjs shots/kart-a/shared/v3cmp --vs shots/kart-a/shared/v3base-head`: all 29 PASS (every
  number equal to the base; the absolute a5 rule FAILs of those films are pre-existing, identical in the base).

### Verifier round 1 fixes (2026-10-31)
1. **HIGH, fixed: the growth projection broke the stat count-up (v1 and v3).** The engine emits the hatchling's
   `activate` before the `statChange` of the same `withStats`; projecting `permAtk` at the activate made the
   frontier sync after it jump the badge to 2300 / 1700, so the count-up had nothing to roll. Now (project.ts)
   the activate only marks the uid, the growth lands at that uid's `statChange` with the event's own deltas
   (`atk − prevAtk`, `def − prevDef`; no hard-coded 1200 / 800), and all of it is behind `LOOK_V3` (v1 keeps
   the old projection exactly, rollback included). A statChange without the growth activate (an equip) projects
   nothing. Evidence `shots/kart-a/shared/coinwin/` (`?dev=duel&s=b2CoinWinAuto`, `--fresh --every 66`, 140 f,
   pre-change export vs this tree): **v1 140/140 frames identical** (`L_head_v1` vs `L_cur_v1`); **v3** the
   count-up rolls again (`cmp_v3.png`: 1100 → 2126 → 2272 → 2300 / 1700, identical to the pre-change film up to
   f0122). From f0123 v3 differs on the badge only: the pre-change film's late rollback sync restarted the roll
   and left the plate stuck at the roll's 1.3× punch scale for good (`T_head_v3`, 20 s, `cmpT_v3.png` top row);
   now the roll finishes and the plate settles back to 1× (bottom row). That is the intended v3 change.
2. **MEDIUM, fixed: a grown hatchling revealed from magic_hat built as a baby.** `syncUidVariants` records every
   slot, face-down included (only units read the map, and only face-up slots build units). Test updated: a
   face-down grown uid is `'grown'` and a unit built for it is grown in its constructor.
3. **LOW, fixed:** `recipe/flip.ts` (the rise voice), `recipe/strike.ts throwStrike`, `recipe/summon.ts assemble`
   use `soundsOfUnit(u)`. `recipe/flip.ts:40` (the `dust` accent) stays `soundsOf(id)`: the accent function gets
   a card id, not a unit (its signature lives in `summon-b/flip.ts`, not ours).
4. **NIT, fixed:** the v1 branch of `battle/battle.ts` is reverted to HEAD~1 byte for byte; only `battleV3`'s
   `aRamp` reads `attack.ramp`.
5. **NIT, fixed:** `ACCENTS.acid` no longer sets `flicker: false` (= venom §5.4 exactly; the optional
   `emit.flicker` stays available to the builder).
6. **NIT:** gone with fix 1.

Gates after the fixes: `npm run typecheck` clean · `npm test` 1323 passed, 4 failed (the same 4 known) ·
`filmdiff --set v1` **17/17 IDENTICAL** (`shots/kart-a/shared/v1films2`) · `filmdiff --set a6v1` **26/26
IDENTICAL** (`shots/kart-a/shared/a6v1films2`) · v3 slice set vs `v3base-head` (`shots/kart-a/shared/v3cmp2`):
2 films identical, the others differ only in the side holograms / sky flyers (HEAD vs HEAD differs the same way,
e.g. suWyrm f0027 2160 px at x 552–623 in `v3head-self`) · `palcheck v3cmp2 --vs v3base-head`: 14/15 films
PASS; saWyrmBlocked FAILs by 0.01 pt (Δoff 1.44 vs 1.43) in one frame (t = 462), whose only differing pixels
are the ambient sky-flyer band (x 32–606, y 94–111), which differs between two HEAD runs as well; not this change.

## Open issues
- Owner question: ambient idle sounds per monster. Owner silent → lane-A choice: NOT built (no ambient-sound system;
  three cards ticking/dripping between actions would clutter the board mix). Idle identities play inside cinematics.
- Owner question (venom_drake §10.1). Owner silent → lane-A choice: only the venom_drake DEATH scar lasts the duel
  (memorable, flavor-true "nothing grows again"); attack scars fade after ~2.4 s so they never read as a game mechanic.
