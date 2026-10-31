# Lane C architecture map — adding a complete v3 monster (tide_harpooner, reed_heron, crag_axeman, kite_fencer, steppe_spiralhorn)

Written 2026-10-31 by the lane-C architect on `claude/kart-c` (HEAD 6924dd6, base 684e290). Every command marked
**[ran]** was executed on this tree on that day, and its output was read; unmarked commands and options are quoted from
the tool's own header comment. Paths are repo-relative unless absolute.
Read alongside: `CLAUDE.md`, `docs/v3/PARALEL_OTURUMLAR.md` (lane rules), `docs/v3/YENI_KARTLAR.md` §5, §5.1, §5.2, the
C1, C7, C8, C9 and C11 sections and the owner decisions, `docs/v3/REHBER.md` (rule ids), and `docs/v3/TEMPO.md`.

Shorthand: `<id>` is the card id, `$W` is your worktree (`/home/user/wt/<id>`), and `$SP` is your scratchpad.
Git history does NOT show how the aces were built: everything up to 8cfa8ff is one squashed checkpoint. Learn from
the files, not from `git log -p`.

---

## 0. One-screen summary

| Piece | New per-card files (yours alone) | One-line edits in shared files |
|---|---|---|
| Sprite rig | `src/art/monsters-v3/<id>.ts` (MonsterArt), `<id>-rig.ts`, `<id>-anims.ts`, `<id>-kit.ts` / `-maps.ts` / `-fx.ts` | none (glob registry) |
| Card art | `src/art/cardart-v3/<id>.ts` (88×68 big + hand-tuned 44×34 small) → wired through `MonsterArt.portrait` | none |
| Cut-in (tide_harpooner only) | `src/art/cutins-v3/tide_harpooner.ts` | none (glob) |
| Sounds | `src/audio/v3/<id>.ts` (recipes + the CharacterSounds voice object) | `src/audio/sounds.ts` (import + spread), `src/audio/sfx.ts` (type import + union member), `src/cinematics/_v3/sound.ts` (import + `CHARACTER_SOUNDS` entry) |
| Cinematics | `src/cinematics/kartc/<id>.ts` (+ helpers) — strike, summon, death and flip flourishes, special moments | none (the loader globs `src/cinematics/**`) |
| Presentation recipe (recommended) | `src/presentation/cards/<id>.ts` | none (glob) |
| Scenarios | `src/duel/scenarios/<id>.ts` | none (glob) |
| Tests (recommended) | `tests/art/<id>.test.ts` | none |
| tide_harpooner only | — | `src/duel/HumanInput.ts`: one hook call in `pickZone`'s reject branch (§7a) |

The anchors for the shared one-line edits are in Appendix C. Each card gets its own anchor, so the five branches merge
without conflicts. The one exception is the `CHARACTER_SOUNDS` object, which has only three slots; Appendix C says how
to resolve it.

---

## 1. Anatomy of a full-quality v3 monster

### 1.1 The contract (`src/art/types.ts`, extend only)

`MonsterArt` fields that a v3 monster fills:

| Field | Meaning / house practice |
|---|---|
| `id` | the card id (must be in `MONSTER_IDS`, `src/data/cards.ts`) |
| `w`, `h` | the frame size. Use the v1 size class plus a margin so that no pose touches the edge (margin ≥ 2, edge px 0: KK-3). Today's v3 frames: crystal_wyrm 116×104 (v1 96), abyss_magus 112×116, stone_sentinel 72×80 (v1 64), steel_silencer 116×96, grim_warden 128×116, seal_head 100×94 (v1 48), seal_arm_r 80×106, seal_leg_l 112×64 **[ran: vite-node size dump]** |
| `anchorX`, `anchorY` | the ground point between the feet. KK-5: the feet band stays fixed in idle, guard, toGuard and fromGuard. `points().feet` must equal the anchor there (tests check this) |
| `hover` | px above the ground (fliers / floaters), else 0 |
| `muzzle`, `core` | the fixed fallbacks of `points()` |
| `anims` | `Record<'idle'\|'roar'\|'attack'\|'hit'\|'guard', AnimSpec>`. Every `AnimSpec` has `frames`, `fps`, `loop`, `holds[]` (length = frames, 40–200 ms each, HA-2) and `marks` |
| `attackImpactFrame` | = the attack's `release` / `impact` mark |
| `draw(p, anim, f, o?)` | deterministic. `o.lightFrom` is `'left'` (P1) or `'right'` (the P2 relight sheet). Finish with `p.outline(PAL.ink)`. Light pixels (eyes, glows) go AFTER the outline and are not outlined (IŞ-9) |
| `extraAnims` + `drawExtra` | `summon death revive special hitHeavy hitMagic victory toGuard fromGuard` |
| `weight` | `heavy \| mediumHeavy \| medium \| mediumLight \| light \| floater \| caster`. It drives the kit's hit-stop, shake and knock (`src/duel/motion.ts`). contactStopMs: heavy 100–130, mediumHeavy 80–110, medium 60–80, mediumLight 40–60, light 40, floater 30–40, caster 60 |
| `points(anim, f)` | per-frame `muzzle core head hand staff claw feet grip`. HA-25: `muzzle` sits on the real source in EVERY frame (monster-gates checks it). Strikes read it with `u.art.points(...)` / `u.framePoint(x, y)` |
| `p2: 'relight'` | **mandatory** (IŞ-1). The P2 sheet is drawn with `lightFrom: 'right'` and then flipped. Hand maps come in two versions, `_L` / `_R` (IŞ-2, see `abyss_magus-maps.ts`) |
| `knock` / `poseKnockPx` | `'pose'` when your recoil poses draw part of the push themselves; the default `'sprite'` lets the kit push |
| `joints()` | optional (read by sameness and by the hit kit's measured hip travel) |
| `portrait(p)` | the 44×34 card art. Use `p.blit(renderArt(card, 0).smallPx, 0, 0)` (§4.2) |
| `bodyPlan` | only plan members (biped / serpent). Lane C rigs are hand-made, so leave it unset |

### 1.2 Required anims and marks

The marks come from `REHBER` HA-1 and are enforced by `src/art/rigkit/validate.ts` `validateArt` and
`tools/lib/framelib.ts` `REQUIRED_MARKS`.

| Anim | Required marks | Frames (REHBER §4.9, normal tier; ace column in brackets) | Notes |
|---|---|---|---|
| idle (loop) | — | ≥ 12 f, 1.6–2.0 s (wyrm 20 f 1.98 s) | HA-16 seam ≤ 1.4, HA-17 max Δ ≤ 1.8 × idleΔ, HA-18 liveliness ≥ 15 %. YENI_KARTLAR asks for 16 f (18 f for spiralhorn) |
| guard (loop) | — | ≥ 6 f | HA-19: guard Δ is 0.3–0.8 × idleΔ (calm, not dead) |
| toGuard / fromGuard | — | 5–7 f, ≤ 0.4 s (HA-29) | mandatory when idle f0 ↔ guard f0 ≥ 3 × idleΔ (HA-20). toGuard ends on guard f0, fromGuard on idle f0 |
| attack | `charge`, `release` (= `impact`), `contact` (melee / beam; a projectile's contact belongs to the cinematic), `recover` | ≥ 10 f | HA-3: the longest frame is the full wind-up just before release; release ≤ 70 ms; contact 50–90 ms. The declaration holds the frame at `charge` (`battle/declare.ts`) |
| roar | `charge`, `release`, `recover` | ≥ 9 f | the summon reveal and the cut-in |
| hit | `impact` = `contact` = 0, `recover` | 5–6 f | HA-4: f0 40–60 ms, f1 40–70 ms, recover at 240–370 ms |
| hitHeavy, hitMagic | same as hit | ≥ 7 f | all three hit anims are mandatory |
| summon | `land` | ≥ 10 f | the kit's hologram runs ≤ 300 ms (EF-11). Lane C entrances are mostly card-drawn: the art's pose plus the cinematic |
| death | `impact` = `contact` = 0, `dissolve` | ≥ 8 f, ≤ 0.9 s | the body breaks as matter on the last frame (death kit). Your unique finale (§5.2) lives in these poses |
| revive | `land` | ≥ 10 f | HA-28: the reverse of the death, not a second summon |
| special | `charge`, `release`, `recover` | ≥ 10 f if the card has an effect pose | lane C signature moments (Körfez kalkanı, the kite's lift-off) may be card cinematics on top of base anims |
| victory | — | optional | not played anywhere today |

Every one-shot must end on idle f0 (HA-14: out ≤ 1.2; the slice gets 0). Attack, roar and special start close to idle
(HA-15: in ≤ 2.0). **KK-13: ≤ 140 frames per side, ≤ 8 ms per frame.** The per-side sheet bytes (`w·h·4·frames`, MB = 10⁶)
must fit the size class:

| Card | Class (`--class`) | Byte budget per side | Max frames at a plausible frame size |
|---|---|---|---|
| tide_harpooner (80, ace ★) | `ace` | 7 MB | 120×104 → 140 (the KK-13 frame cap binds first) · 128×116 → 117 |
| reed_heron, crag_axeman, steppe_spiralhorn (64) | `medium` | 3.6 MB | 88×80 → 127 · 96×88 → 106 |
| kite_fencer (48) | `small` | 2.2 MB | 72×64 → 119 · 80×72 → 95 |

⚠ `tools/monster-gates.ts` auto-classes ANY v3 art without a `bodyPlan` as `ace` (`framelib.sizeClass`). Always pass
`--class` yourself.

### 1.3 File split (copy the hand-made pattern of steel_silencer, grim_warden, the seal set and crystal_wyrm)

- `<id>.ts` holds only the MonsterArt object (steel_silencer.ts is 13 lines). It wires `draw` and `drawExtra` to
  `drawX(p, framePose(anim, f), o?.lightFrom ?? 'left')`, `points` to `framePoints`, and `portrait` to the card art.
- `<id>-rig.ts` turns a `Pose` into pixels. It exports `W H AX GY` (or `CX CY`), the `Pose` type, `pose()` and
  `drawX(p, pose, light)`. Use value planes, creases, cast shadows, rim light, `outline(PAL.ink)` and a crumb pass
  (IŞ-3 … IŞ-9; `src/art/rigkit` has `composite`, `edges`, `light`, `raster` and `passes`: cracks, crumble, dissolve,
  drain, foam, gather, motes, reassemble, split).
- `<id>-anims.ts` holds the pose tables (key poses plus whole-pixel in-betweens, see `mix`/`snap` in
  `steel_silencer-anims.ts`), `ANIMS`, `EXTRA_ANIMS`, `IMPACT`, `MUZZLE`, `framePose(anim, f)` and
  `framePoints(anim, f)`. Build the specs with `spec(frames, fps, loop, holds, marks)`.
- `<id>-kit.ts` / `-maps.ts` / `-fx.ts` hold material planes, the hand maps (`_L` / `_R`) and effect painters.
- The plan-based examples (`_magma_titan.ts`, `_coral_serpent.ts`, `stone_sentinel.ts`) use `planArt(biped|serpent, MEMBER)`
  with a `distinction` card. **They are still worth reading for their `distinction` text.** It is the best written
  model of "how this monster differs" (silhouette / rhythm / idle / guard / signature part / material / signature move).
  Write the same card at the top of your `<id>.ts`, even though lane C rigs are hand-made.

### 1.4 What "best examples" really means today

- `crystal_wyrm` and `abyss_magus` are the slice aces (L5: hand-made rigs, every part custom).
- `magma_titan` and `coral_serpent` v3 arts are **NOT live**. Their entry files are `_magma_titan.ts` and
  `_coral_serpent.ts`, and the registry ignores `_*.ts`. In the v3 look they still play their v1 sprite (sameness reports
  their tracks as `proxy`). Read their rigs and their `strikes-a` / `summon-a` cinematics, but do not expect their v3
  sheets in films.
- `steel_silencer`, `grim_warden` and `seal_*` are live hand-made v3 arts. steel_silencer has NO cinematic of its own
  (the default path, `src/duel/scenarios/steel_silencer.ts` says so). Its film (`ssAttack`) shows what lane C must NOT
  ship: the generic lunge, a `whoosh` + `slash`, and a dust puff that fails palcheck (§8.6).

---

## 2. Registration, placeholders, exclusions

- `src/art/monsters/index.ts`: `REGISTRY_V3` is filled from an eager `import.meta.glob(['../monsters-v3/*.ts',
  '!../monsters-v3/_*.ts', …])`. Any module whose default export has an `id` registers. **Dropping
  `src/art/monsters-v3/<id>.ts` is the whole registration.** It is only used when `LOOK_V3` (`?look=v3`).
  `monsterArt(id)` resolves to: v3 art (v3 look) → v1 art → `placeholderFor(id)`.
- Placeholders: `MONSTER_IDS.indexOf(id) >= 12` gets `placeholderTotem(id)` (`_placeholder-new.ts`, a crystal totem in
  the attribute colour, 48/64/80 frames by `SIZE_CLASS`; lane C cards are not listed there, so they get 64), and
  `straw_decoy_token` gets `_placeholder-token.ts`. The **v1 look keeps the totem forever**, because lane C has no v1 file.
  That is correct: v1 must stay byte-identical. Do not add `src/art/monsters/<id>.ts`.
- Helper files (`<id>-rig.ts` …) ARE matched by the glob and imported eagerly at boot. Their default export is
  undefined, so they are skipped, but their top level RUNS at boot for everyone. Keep top-level code cheap (lazy caches),
  or you push boot time over the KK-13 limit (`?test` boot ≤ A3 base + 20 %).
- The exclusion line in `index.ts` (`'!../monsters-v3/hourglass_imp.ts', shield_titan, venom_drake, wisp_imp`, comment:
  "failed the distinction / gate review, 30 Oct") keeps finished-looking arts OFF:
  - hourglass_imp and shield_titan are **biped plan members**. They share the skeleton family and the plan machinery
    of stone_sentinel and magma_titan (`planArt(biped, …)`). The in-code reason is the 30 Oct "distinction / gate review";
    no written report survives in the repo. Their own tests still fail (`hourglass_imp … is registered as v3 art`,
    `shield_titan … the death ends in a low heap`): those are the known failures.
  - venom_drake is a member of coral_serpent's `serpent` plan. It was excluded by the same review, and the owner said
    it "looks bad" (lane A redesigns it).
  - wisp_imp is a hand-made rig. It was excluded and is being redesigned as R3 (lane B).
  - **Lesson for lane C:** a different paint job on a shared skeleton or rhythm is rejected. Give each monster its
    own silhouette, its own rhythm (holds), its own idle lead part and its own material death. Prove it with sameness
    (§8.4) against the "En yakın kart" of YENI_KARTLAR, and write the distinction card.
- A draft that is not ready: name it `_<id>.ts`. It stays unregistered, and you can still render it with
  `--art src/art/monsters-v3/_<id>.ts` (monster-sheet, sameness).

---

## 3. Presentation: recipe + the card's own cinematics

### 3.1 How cinematics are found and chained

- `src/cinematics/index.ts` imports `_defaults` (priority −100), then **every** `.ts` under `src/cinematics/` except
  `_core/**`, `_defaults/**`, `index.ts` and `api.ts`, in path order. A module that throws is logged and skipped.
  Put yours in `src/cinematics/kartc/<id>.ts`; the folder name is free.
- API (`src/cinematics/api.ts`): `registerStrike(monsterId, fn, {priority, name})`,
  `registerCardHook(cardId, kind, handler, opts)`, `registerEvent(type, handler)`, `registerObserver(fn)`,
  `fx` (= `_core/helpers.ts`), `strikeFor`, `listHandlers`.
- Chain order (`_core/registry.ts`): higher priority first; at equal priority card hooks beat event handlers; at equal
  priority and specificity the LATER registration wins. `ctx.base()` runs the next handler. A strike calls
  `s.base?.()` (the strike chain falls back to the battle's generic strike).
- Priorities in use: defaults −100, per-card files 0, the **recipe layer 10** (`recipe/install.ts RECIPE_PRIORITY`).
  A card that has a recipe and wants to own a part either marks it `custom` (then the recipe registers nothing for it,
  and your priority-0 file plays it) or registers above 10 (e.g. 20) and falls back with `ctx.base()`.
- Card hook kinds (`CardHookEvents`): `summon flip tribute tributed attackDeclare attack defend activate effect target
  destroyed destroys toGraveyard equip field statChange damage lpGain discard negate`. Lane C uses `summon`
  (normal / tribute / special; `from: 'field'` is a flip summon → `ctx.base()`), `tribute` (keyed by the monster being
  tribute-summoned), `destroyed` (its death), `flip`, `statChange` (the Tidal Bay ±400) and `attackDeclare`.
- **LOOK_V3 gating (v1 must stay byte-identical):** every handler starts with `if (!LOOK_V3) return ctx.base();` and
  every strike with `if (!LOOK_V3) return s.base?.();` (pattern: `strikes/seal_leg_r.ts`). Never change a shared kit's
  default, never consume shared random streams at import time, never touch v1 code paths.

### 3.2 What a strike gets (`StrikeArgs`, `_core/types.ts`) and the battle around it

`s.ctx` (battle ctx: `ev.result`, `ctx.state` / `stateNext` / `after`), `s.scene`, `s.attacker` / `s.target`
(`MonsterUnit`), `s.to` (the target core or the defending duelist's chest), `s.toGround`, `s.direct`, `s.blocked`,
`s.power` (1–3), and `s.impact(at?)`. Call `s.impact` **exactly once, on the contact frame**: the battle handler
(`battle/battle.ts` battleV3) then runs the contact flash (`_v3/flash.ts`), the hit-stop by your weight class, the
shake, the reaction kit (`_v3/react.ts` picks hit / hitHeavy / hitMagic by blow kind and power), the damage number
ON the contact frame (`_v3/number.ts`), LP, deaths (in parallel with your recovery), the backlash when you lose, and
the guard break. Resolve when the attacker is home. Also call `u.rest()` and restore the sprite position.

Useful `MonsterUnit` API (`src/duel/MonsterUnit.ts`): `play(anim,{hold})`, `playRange(anim, from, to)`,
`playToFrame`, `pose(anim, f)`, `frameInfo()`, `frameMs`, `rangeMs`, `animMs`, `markFrame(anim, mark, fb)`,
`markMs`, `impactFrame`, `impactMs`, `framePoint(fx, fy)` (art px → world, flip aware), `worldPoint('feet'|…)`,
`core()`, `muzzle()`, `home`, `rest0`, `flipX`, `has(anim)`, `setAura(key, Disposable|null)` / `hasAura` / `aura`
(persistent overlays that ride the unit), and `claim()`.

Helpers to reuse: `strikes-a/_kit.ts` (seeded `seed`/`RR`, `animate`, `sleep`, `onFrame`, `Sparks`, `FloorMarks`,
`whiteFlash`, `layer`, `followLight`, `playSfx`), `strikes-b/_kit.ts` (`groundRing`, `sourceOwnsDeath`),
`_v3/spellfx.ts` (`fxRng`, `dropArcs`, `shards`, `steamThreads`, `rimClimb`, `steppedColumn`), `view/light`
(`lightFlash`, `lightPool`, `lightBeam`: stepped light, EF-6), `vfx/core` (`shake`, `hitStop(scene, ms)`),
`_v3/clash.ts strikeStartFrame(u)` (continue from the declaration's held charge frame), and `_v3/warm.ts warmPoses`.

**Hit-stop per storyboard:** the kit's stop on `s.impact` comes from `weight` (above). For extra beats call
`hitStop(scene, ms)` yourself: reed_heron's 40 / 40 ms micro-stops on pokes 1–2, then `s.impact()` on poke 3 (80 ms
needs `mediumHeavy` or a manual stop), and kite_fencer's 60 ms on the 1st attack versus 80 ms on the 2nd. The show
clock stretches every stop by the v3 tempo (`TEMPO.md`: hit-stop real time ≈ ms × 1.35 × 1.15).

### 3.3 The shared v3 kit (what you get for free, and what you replace)

| Kit file | Gives |
|---|---|
| `_v3/react.ts` | `reactHit` / `reactGuard`: the target's recoil pose by blow kind (your recipe's `attack.blow`, else `STRIKE_KIND`, default physical), the knock by weight, `afterContact` |
| `_v3/flash.ts` | `contactFlash`: a local white band ≤ 34/40/45 % of the silhouette (EF-3). Light bodies get a 1-px rim instead |
| `_v3/number.ts` | `impactNumber` on the contact frame (EF-9) |
| `_v3/death.ts` | `deathV3(ctx, { fallback, onBurst })`: plays YOUR `death` pose from the recoil it was left in (posematch), the accent of `deathPreset(id).accent` from the `dissolve` mark, the body breaking as `deathPreset(id).material` on the last frame, the card born on that burst frame and flown to the graveyard (EF-12; it consumes the `toGraveyard`). It also plays your voice's `deathStart` (f1), `dissolve`, `afterDissolve[]` and `burst` |
| `_v3/guardbreak.ts` | a defense-position death that never jumps out of the guard |
| `_v3/summon.ts` | `summonPose(scene, u, {ramp, onLand, onPeak})` (≤ 300 ms holo onset), `poseEntrance` (the generic entrance on your summon pose), `holoOnset` |
| `summon-a/_kit.ts` | `signatureSummon(id, legacyEntrance, { v3: async (S) => … })` / `runSummon`: the card slam, the hidden unit, a `Stage` with `S.pose()`, `S.climax()` (**the ace cut-in plays here**: `cutIn = ace && tribute`), `S.roar`, `S.finale`, `S.glow`, `S.own`. The kit heals the unit even when your entrance throws |
| `_v3/cutin.ts` | `cutInV3` (band, ≤ 0.9 s, rhythm from recipe `cutIn.rhythm` or `presets.ts RHYTHM`), `warmCutinP2` |
| `_v3/card.ts` | `cardLeaves` (card continuity, if you write a death without deathV3) |
| `_v3/sound.ts` | `play`, `start` (a handle, `stop(ms)`), `atFrame`, `atMark`, `holdCharge` / `takeCharge` (the declaration's charge sound handed to the strike), `quietCombat` (skips the shared combat sound that you score yourself), `hush`, `fade`, `panAt` |
| `_v3/budget.ts` | `LP_ROLL_MAX_MS 400`, `DECLARE_MAX_MS 300`, `DEATH_AFTER_CONTACT_MS 150` |

### 3.4 The presentation recipe (`src/presentation/cards/<id>.ts`): recommended shape

`src/presentation/registry.ts` globs `./cards/*.ts`. The file name MUST equal `default.id` (it throws otherwise, and
every page breaks). The bridge rule (`v3Recipe`) reads it only in the v3 look and only once v3 art exists. It feeds:
`deathPreset` (`death.material / accent`), `monsterGlow` (`light.glow`, which overrides the shared `MONSTER_GLOW` row;
**prefer this over editing `view/light/profiles.ts`**), `strikeLight`, `blowKindOf` (`attack.blow`), `materialOf` /
`hitSoundFor` (`body`), `soundsOf` (`voice`), `cutInRhythm` (`cutIn.rhythm`), `isRanged` and `roarPeak`.

Constraints found in the tests (`tests/presentation/recipes.test.ts`, `accessors-v3.test.ts`):
- `tier: 'ace'` and `cutIn` are allowed only when `CardDef.ace` is true (only tide_harpooner).
- `voice: { custom: '<id>' }` needs a `CHARACTER_SOUNDS['<id>']` entry. A `VoicePreset` needs an interpreted palette,
  and **only `'rumble'` exists**. So lane C uses `{ custom }` + a CHARACTER_SOUNDS entry (§5).
- `attack.from` must be a key of `points('attack', releaseFrame)` of your art.
- The recipe layer builds only `attack.type: 'throw'` and `summon.style: 'assemble'`. Mark `custom.strike` and
  `custom.summon`.
- **Gotcha:** `accessors-v3.test.ts` requires that a recipe which marks ALL of strike, summon, death and flip `custom`
  reproduce today's tables exactly (it is meant for the slice aces). A lane C recipe with `body` set cannot do that,
  because `materialOf` would no longer be null. So leave **`death` and `flip` on the recipe layer**: the recipe death
  is `deathV3` with your recipe's material and accent, your art's `death` pose, `hooks.onDeath` and `death.onBurst`;
  the recipe flip is the v3 flip with your accent. Add your unique finale and flip flourish with your own
  `registerCardHook(id, 'destroyed' | 'flip', …, { priority: 20 })` that starts its watcher FX (pattern:
  `crystalBreakV3` in `strikes-a/crystal_wyrm.ts`, which follows the death frames with `onFrame` and bursts when the kit
  hides the sprite) and then `return ctx.base()`. In a destroy hook, first check
  `if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();`.
- `body.physical` must be a known material (`src/art/materials/defs/*`). Only `crystal metal cloth stone` (and via
  `same`: hide → crystal, shadow → cloth, bone / moss / runeGold → stone) have hit sounds. `water`, `scale` and
  `basalt` give null, so the generic impact plays when YOUR monster is struck. Adding a generated hit material means
  editing `GENERATED_HIT_MATERIALS` (`src/audio/v3/materials.ts`), which is pinned to `['stone']` by
  `tests/art/materials.test.ts:324` (not ours). Coordinate with the orchestrator first; do not do it alone.

Template (adapt the values):

```ts
// src/presentation/cards/crag_axeman.ts
import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';
export default {
  id: 'crag_axeman',
  tier: 'normal',
  body: { physical: 'stone' },
  attack: { type: 'melee', blow: 'physical', from: 'grip', vfx: 'axeSplit', tone: PAL.gold4 },
  summon: { style: 'rift', matter: 'stone' },
  death: { material: 'light', accent: 'stone' },   // §5.2: NOT a stone finale (that belongs to R1 / stone_sentinel)
  flip: { accent: 'dust' },
  voice: { custom: 'crag_axeman' },
  light: { glow: { emissive: [[PAL.gold4, 1], [PAL.gold3, 0.6]], halo: 0.5, pool: 0.9 }, strike: PAL.gold4 },
  custom: { strike: true, summon: true, effect: true, revive: true, position: true },
} satisfies PresentationRecipe;
```

No recipe at all is also legal: the shared tables already hold rows for the five cards (`_v3/presets.ts DEATH_PRESETS`,
`view/light/profiles.ts MONSTER_GLOW`), you edit only your own row in place, and `materialOf` stays null.

### 3.5 Time budgets (gate: game-time ms from `measure --look v3` ≤ REHBER §5 × 1.45)

| Event (REHBER §5) | Scene budget | Gate (game ms, × 1.45) | Lane C storyboard |
|---|---|---|---|
| attack on a monster (incl. its death) | 1.6–2.2 s | ≤ 3.19 s | harpooner 2.6, axeman 2.6, heron 2.4, spiralhorn 2.5, kite 1.8 / 2.2 |
| direct attack | ~1.6 s | ~2.32 s | harpoon into the LP panel |
| declaration | ≤ 0.3 s | ≤ 0.435 s | `DECLARE_MAX_MS` |
| tribute (ace) summon + cut-in | 2.5–3.0 s | ≤ 4.35 s | harpooner 2.4 s + cut-in |
| destroy (death + card in the graveyard) | ≤ 1.4 s | ≤ 2.03 s | |
| cut-in | ≤ 1.0 s | `CUTIN_V3_MAX_MS` 900 (scene, clamped) | |
| position 0.4 s / flip 0.6 s / revive ≤ 2.1 s / LP ≤ 0.4 s | | × 1.45 | |
| number − contact | ±17 ms | `numberAfterContactMs` | automatic if you call `s.impact` on the contact frame |

YENI_KARTLAR durations are 1× targets that already include the ~25 % slow-down. Check them with the `ready` column of
`tools/measure.mjs` (`inputReadyMs`: action start → input back). Reference values: `ssAttack` ready 2583 ms,
`ssKill` 2783 ms, contact 750 / 933 ms **[ran]**. `&tempo=1` gives the old scene timing.

---

## 4. Cut-ins and card art

### 4.1 Cut-in (tide_harpooner only: `CardDef.ace` true, Sv5, one tribute)

- File: `src/art/cutins-v3/tide_harpooner.ts`. It default-exports a `CutinFactory` `(kit) => CutinArt` (see
  `cutins-v3/steel_silencer.ts`): `w: 200, h: 144`, `frames`, `fps`, `holds[]` (played once, last frame held),
  `accent` / `accentDark` (palette), `p2: 'relight'`, and `draw(p, f, { lightFrom })`. Paint it at cut-in density;
  never upscale the sprite. `src/art/cutins/index.ts` globs `../cutins-v3/*.ts` under LOOK_V3, and
  `src/boot/25-cutins.ts` builds the textures `cutin:<id>` (+ `cutin:<id>:p2`).
- It plays from `summon-a/_kit.ts` `S.climax()` (or `poseEntrance`) when `ace && tribute`. Rhythm comes from the recipe
  `cutIn: { rhythm: { flare, slam, exit } }` (clamped by `cutInRhythm`; defaults 290 / 370 / 700 / close 120). The
  storyboard: "kabuk ağzının karanlığında parlayan iki göz sapı".
- Preview **[ran]**: `node tools/shot.mjs "?dev=cutin&id=steel_silencer&look=v3&sheet=1&player=2" --out $SP/cutin.png --wait 1500`
  (`&sheet=1` all frames, `&player=2` the relit P2 set, `&frame=N`, `&eyes=1` the lens-glint search).
- Test pattern: the last test of `tests/art/seal_arm_r.test.ts` (200×144, `holds.length === frames`, palette only in
  both lights, > 4000 opaque px).

### 4.2 Card art (88×68 big + hand-tuned 44×34 small)

- Contract `src/art/cardart-v3/_types.ts` `CardArtV3`: `id`, `focus` (big px), `focusSmall?`, `frames?` / `holdMs?`,
  `big(l, f)` and `small(l, f, big)`. There are three layers: backdrop (2–3 flat bands + ONE stepped light shape),
  subject (ink outline) and light (never outlined). Without `small` you get a blind `autoSmall`, which is a draft.
  The style sheet is `docs/v3/KART_RESIMLERI.md` §1–§10 (no dither or gradients, ≤ 20 colours, ≤ 6 in the backdrop,
  subject fill 60–75 %, isolated ≤ 10 %, outline ≥ 90 % ink, focus inside `focusBox`).
- **Wiring for a monster** (seal pattern, no shared file): in `src/art/monsters-v3/<id>.ts`
  `import card from '../cardart-v3/<id>'; import { renderArt } from '../cardart-v3/_kit';` and
  `portrait(p) { p.blit(renderArt(card, 0).smallPx, 0, 0); }`. `src/art/cards.ts` reads `monsterArt(id).portrait`, so
  the v3 face shows it only under `?look=v3`. The big 88×68 is the authoring master: no in-game screen shows it today.
  `cardface-v3/index.ts ART` is for spells and traps; do not add to it.
- The KART_RESIMLERI §9 render script lived in a deleted scratchpad. Use the probe in Appendix B **[ran on
  seal_arm_r]**: it prints the §10 numbers (`artStats`) and writes big ×3 / small ×6 / small ×1 PNGs. In game, look at
  the face with `?dev=cards&mode=x3&page=N&look=v3`.
- Storyboards: harpooner "ay ışığında kabuk ağzından çıkan yengeç, zıpkın sağ üste taşar, en parlak nokta zıpkın ucu";
  heron "sisli sazlık, tek ayak, gaga ay ışığında tek çizgi"; axeman "savuruşun tepesinde, balta başı doğan güneş gibi";
  kite "gün batımında ipinden yükselen eskrimci, açık uçurtma pelerini"; spiralhorn "batan güneşin önünde havada
  antilop, sarmal boynuzlar silüet".

---

## 5. Sound

### 5.1 Adding synthesized sounds (pattern: `src/audio/v3/dawn.ts`)

1. Create `src/audio/v3/<id>.ts`:
   ```ts
   import type { Recipe } from '../sounds';
   import type { CharacterSounds } from '../../cinematics/_v3/sound';   // type-only: no runtime cycle
   import { midiHz } from '../synth';
   import { clank, crack, drone, glassBell, growl, link, puff, sweep, thump } from './kit';
   export const V3_HARPOONER_RECIPES = {
     harpRopeSpin: { cap: 2, gap: 0.05, verb: 0.3, play(v) { sweep(v, 0, 0.42, [600, 1800, 900], 0.12, { q: 2, pan: [-0.2, 0.2] }); } },
     // …one recipe per beat; the names are camelCase with a unique per-card prefix
   } satisfies Record<string, Recipe>;
   export type HarpoonerSfxName = keyof typeof V3_HARPOONER_RECIPES;
   export const HARPOONER_VOICE = {
     roar: 'harpConchCall', arrive: 'harpSandSlide', land: 'harpShellTok', charge: 'harpRopeSpin', release: 'harpLoose',
     impact: 'harpWetTok', deathStart: 'harpRetract', dissolve: 'harpSandHiss', burst: 'harpShellBury',
     reviveGather: 'harpTideIn', reviveLand: 'harpShellTok',
   } satisfies CharacterSounds;
   ```
   `Recipe` (`src/audio/sounds.ts`): `{ verb?, cap?, gap?, duck?, vary?, play(v: Voice) }`. Duck ≥ 0.55 for big moments,
   ≤ 0.3 for small ones (SE-7).
2. Register it with one-line edits (anchors in Appendix C): `src/audio/sounds.ts` gets
   `import { V3_HARPOONER_RECIPES } from './v3/tide_harpooner';` and `...V3_HARPOONER_RECIPES,` inside `RECIPES`.
   `src/audio/sfx.ts` gets `import type { HarpoonerSfxName } from './v3/tide_harpooner';` and `| HarpoonerSfxName` in
   the `SfxName` union. **The `sfx.play` / `start` / `hush` / `fade` API itself never changes.**
3. Voice: in `src/cinematics/_v3/sound.ts` add `import { HARPOONER_VOICE } from '../../audio/v3/tide_harpooner';` and
   the entry `tide_harpooner: HARPOONER_VOICE,` in `CHARACTER_SOUNDS`. Without it, `soundsOf(id)` is null, so the
   declaration charge, the death kit's beats, the cut-in's voice hand-off and the direct-hit ducking all fall back to
   GENERIC sounds. The roles are `roar arrive land charge [swing] release impact [deathStart] dissolve
   [afterDissolve] burst reviveGather reviveLand` (SE-3). `charge`, `arrive` and `reviveGather` are sustained: start
   them with `start()` and stop them on the mark that ends their picture (SE-2).
4. Building blocks (`src/audio/v3/kit.ts`): `thump(v,t,f0,f1,g,dec,{drive})`, `crack(v,t,g,{hp,lp,n,gap})`,
   `puff(v,t,g,dec,lp,{kind})`, `sweep(v,t,d,[f0,fPeak,f1],g,{q,pan,kind,peakAt})`,
   `clank(v,f,t,g,dec,{ratio,index,click})`, `link(v,f,t,g,dec)`, `glassBell(v,f,t,g,dec)`, `glassRain(v,{…})`,
   `glassReverse(v,f,t,g,rise)` (**R2's identity: at most a hidden filler for us**), `drone(v,t,d,f,g,{lp,tritone,beat})`
   and `growl(v,t,GrowlParams)`. Voice primitives (`src/audio/synth.ts`): `v.tone`, `v.noise`, `v.filt`, `v.bell`,
   `v.drive`, `v.panner`, `v.lfo`, `v.wander`, `v.flutter`, `v.ring`, `v.crackle`, `v.bursts`, `v.r()` (seeded) and
   `perc`, `ahr`, `swell`, `midiHz`.
5. **Identity rules (YENI_KARTLAR §5.1).** Harpooner: 220 Hz rope tension, a wet rope + seashell, a conch "uuu"
   (conical breath). Heron: a 2.4 kHz beak "tak", reed + mist, a wing "fuff" over a frog chorus bed. Axeman: a 90 Hz
   gravel crunch (short `thump` + grainy noise), stone + fur, a crack "running" L→R. Kite: a thin 4 kHz "tsst", steel
   needle + kite cloth, the hum of a taut string. Spiralhorn: a 3 kHz grass rustle, horn + hoof, a spiral-horn flute
   (wind note). Only R3 may use a pillow "pof". Do not share a signature sound with any other card (SE-4: same-role
   LSD median ≥ 15 dB, min ≥ 10 dB; SE-5: material hits ≥ 9 dB apart).

### 5.2 Triggering sounds on the animation (zero drift, SE-1)

```ts
import { atFrame, atMark, play, start, takeCharge, panAt, quietCombat } from '../_v3/sound';
const pan = panAt(u.home.x);
const ch = takeCharge(u, 'harpRopeSpin', { volume: 0.85, pan });        // continues the declaration's charge voice
atMark(u, 'attack', 'release', () => { ch.stop(80); play('harpLoose', { pan }); });
atFrame(u, 'attack', u.markFrame('attack', 'recover', 9), () => play('harpReel', { pan }));
```

`atFrame` fires in the tick where the sprite shows the frame (via `animationupdate`). It is cancelled if the anim is
replaced first. Sounds tied to effect objects (the flying harpoon, the crack running) are fired from your `onFrame`
clock or scene `sleep`, never from `setTimeout` or wall time.

### 5.3 Evaluating a sound WITHOUT EARS (three tools, all [ran])

1. **One sound as a picture:** `node tools/shot.mjs "?dev=audio&page=one&name=<sfx>&log=1" --out $SP/<sfx>.png --wait 3000`
   (~25 s). It shows the raw versus chain waveform, RMS and a log spectrogram (40 Hz – 16 kHz), and prints
   `len / raw pk / chain pk / loud / rms` to the console. Example: `wyrmRoar len 1.93s raw pk 0.93 chain pk 0.86 loud
   -7.4 dB rms -12.2 dB`. `&page=grid` and `&page=spec&p=0..3` show all sounds; red means clipping or silence.
2. **Numbers + WAV + LSD (Appendix A, `sfx-probe.mjs`):**
   `node shots/tools/sfx-probe.mjs harpRopeSpin harpLoose --against wyrmRoar,magusCall,dawnPlant --out shots/sfx-probe`
   (~22 s). Per sound it prints len, peak dBFS, rms, the loudest 50 ms and its time, spectral centroid, dominant Hz,
   onset times and a 1/3-octave A-weighted profile bar chart. It writes `<name>.wav` (44.1 kHz 16-bit stereo,
   deterministic seed) + `probe.json`, and a pairwise LSD matrix (SE-4 / SE-5). **[ran]**
   `wyrmRoar` centroid 375 Hz, dominant 43 Hz; `magusCall` centroid 88 Hz, onsets 0.02 / 0.44 / 0.60 s; LSD
   wyrmRoar × magusCall 12.5 dB. Check the §5.1 identity numerically: the harpooner's dominant ≈ 220 Hz, the heron's
   tak ≈ 2.4 kHz band peak, the kite's tsst ≈ 4 kHz.
3. **In context, with the picture's timing:**
   `node tools/clip.mjs "?dev=duel&s=<key>&look=v3&zones=5" --out $SP/clip/<key>.mp4 --music off --scale 1` (~25 s).
   It writes `.mp4` (for the owner's ears) + `.wav` + `.json`. The JSON's `sfx[]` has `{frame, ms, name, played,
   opts}`, plus `marks`, `numbers` and `levels`. The log prints `peak -2.1 dBFS … clipped samples 0` (SE-6: true peak
   ≤ −1 dBFS). `--solo a,b` hears one sound in context. `--marker a,b` adds a white box on the frame where a sound
   becomes audible (A/V sync). Feed the WAV to `ffmpeg` / `ffprobe` (both installed) for more numbers. The
   `?dev=audio&page=mix` page renders cue lists offline (`renderScene` in `src/audio/sfx.ts`).

---

## 6. Scenarios, films and sheets

### 6.1 Per-card scenario file (`src/duel/scenarios/<id>.ts`, glob-merged by `src/duel/scenarios.ts`)

Pattern (from `scenarios/steel_silencer.ts` and `b2.ts`). Use a unique key prefix per card: `harp*`, `heron*`,
`axe*`, `kite*`, `horn*` (none exist today). Stage 5 zones explicitly (`zones: 5`) so the 3→5 lane auto-shift never
moves your UI-step coordinates.

```ts
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
const N = null;
const attack = (a: number, t: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone: a, targetZone: t });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) =>
  ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: tributes.map((t) => D.uid(t, player)) });
const S: Record<string, Scenario> = {
  harpSummon:   { desc: 'Kabuk Zıpkıncı: tribute summon (1 tribute, cut-in)', stage: { zones: 5, p0: { hand: ['tide_harpooner'], monsters: [N, N, 'stone_sentinel', N, N] } }, steps: [summon('tide_harpooner', 2, ['stone_sentinel'])] },
  harpSummonP2: { desc: '… P2', stage: { zones: 5, active: 1, p1: { hand: ['tide_harpooner'], monsters: [N, N, 'ember_wolf', N, N] } }, steps: [summon('tide_harpooner', 2, ['ember_wolf'], 1)] },
  harpAttack:   { desc: 'attacks and destroys', stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] }, p1: { monsters: [N, N, { id: 'volt_lizard', position: 'attack' }, N, N] } }, steps: [attack(2, 2)] },
  harpAttackP2: { desc: '… as P2', stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'volt_lizard', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'tide_harpooner', N, N] } }, steps: [attack(2, 2, 1)] },
  harpDirect:   { desc: 'direct attack: the rope into the LP panel', stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] } }, steps: [attack(2, null)] },
  harpHit:      { desc: 'struck by a weaker attacker (400 vs 1700): withstands, the attacker breaks', stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'lumen_sprite', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'attack' }, N, N] } }, steps: [attack(2, 2)] },
  harpKill:     { desc: 'destroyed in battle (2500 vs 1700)', stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crystal_wyrm', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'attack' }, N, N] } }, steps: [attack(2, 2)] },
  harpGuard:    { desc: 'defense holds (ATK 1500 vs DEF 1500)', stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'volt_lizard', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'defense' }, N, N] } }, steps: [attack(2, 2)] },
  harpGuardDies:{ desc: 'dies in defense (1700 vs DEF 1500)', stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'ember_wolf', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'defense' }, N, N] } }, steps: [attack(2, 2)] },
  harpBayOn:    { desc: 'Gelgit Körfezi activates: the shroud ring', stage: { zones: 5, p0: { hand: ['tidal_bay'], monsters: [N, N, 'tide_harpooner', N, N] } }, steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('tidal_bay', 0) })] },
  harpShroud:   { desc: 'KORUNUYOR: P2 clicks the shrouded harpooner (rejected), then attacks the other monster', stage: { zones: 5, phase: 'battle', active: 1, p0: { field: 'tidal_bay', monsters: [N, N, 'tide_harpooner', 'stone_sentinel', N] }, p1: { monsters: [N, N, 'crystal_wyrm', N, N] } },
                  steps: [{ ui: 'move', at: { unit: [1, 2] }, ms: 120 }, { ui: 'click', at: { unit: [1, 2] }, ms: 300 },
                          { ui: 'move', at: { unit: [0, 2] }, ms: 150 }, { ui: 'click', at: { unit: [0, 2] }, ms: 700 },   // rejected: shrouded
                          { ui: 'move', at: { unit: [0, 3] }, ms: 150 }, { ui: 'click', at: { unit: [0, 3] } }] },
};
export default S;
```

Stage keys (`src/duel/scenario.ts`): `p0/p1: { hand, deck, graveyard, monsters: MonSpec[], spellTraps, field, lp,
normalSummonUsed }`, plus `turn`, `active`, `phase`, `first`, `rng`, `zones`. `MonSpec = id | { id, position,
faceUp, enteredTurn, attacks, posChanged }`. `attacks: 1` stages kite_fencer's SECOND attack. Two `attack(...)` steps in
one scenario film both attacks: `kiteDouble: { stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'kite_fencer',
N, N] }, p1: { monsters: [N, 'lumen_sprite', 'hourglass_imp', N, N] } }, steps: [attack(2, 1), attack(2, 2)] }` (kite ATK
900 beats 400 and 500; mind the ATKs: ember_wolf 1700, volt_lizard 1500, shade_assassin 1900 and wing_lady 1300 all
kill it). Also
cover: defense death (`{position:'defense'}` + a strong attacker), the attacker losing (attack into a higher-ATK
target), flip (`{ faceUp: false }` + `{ type: 'flipSummon', player, zone }`), position change
(`{ type: 'changePosition', player, zone }`), and revive with `soul_recall` (see `suRevive` in
`scenarios/summon-a.ts`). UI steps: `{ ui: 'move'|'click'|'key'|'wait', at: { hand | zone: [p, spot, i] | unit: [p, i]
| menu: id | button | xy }, ms }` (examples: `a6Invalid` in `a6-base.ts`, `a6TargetAttack` in `a6-flow.ts`). For monsters
use `unit` targets with a `move` before each `click`: in my live check, `zone` clicks on the attacker's tile did not
select it.

**Verified live [ran]** (shot.mjs `--eval` with `__neon.duel.restart({ stage })` / `dispatch` / `ui`, i.e. the
DuelScene QA API `src/scenes/DuelScene.ts DuelQa`):
- the harpShroud stage: legal attacks `[[2,3]]` only (the harpooner is not a target). The unit-click steps above give
  `attackDeclare, battle:3:targetDestroyed, …`, with 0 handler errors;
- the kiteDouble stage: after the 1st attack `attacksThisTurn 1`, and the legal attacks are `[[2,2]]` (monster only).
  After the 2nd: `attacksThisTurn 2`, 0 legal attacks;
- a Bay with the harpooner as the only target: legal `[[2,null]]` (direct);
- harpBayOn: events `activate, fieldSpell, statChange:1700->2100`.
This is a cheap way to probe the engine without writing a scenario file:
`node tools/shot.mjs "?dev=duel&s=ssAttack&look=v3&zones=5" --eval "$(cat probe.js)" --out x.png --timeout 120000 | grep MYTAG`.

### 6.2 Films (deterministic; `--fresh` restarts the duel under a frozen, stepped clock)

**[ran]** `node tools/shot.mjs "?dev=duel&s=ssAttack&look=v3&zones=5" --fresh --film 12 --every 150 --cols 4 --clip 120,60,400,220 --out $SP/ssAttack.png`
(1 min 23 s under load). Options: `--film N --every MS --start MS --cols C`, `--clip x,y,w,h` (game px; the centre lane
on the 5+5 board is around x 200–340), `--scale 3` (zoom; the film default is 1), `--frames DIR` (every frame as PNG,
input for palcheck / GIFs), `--step MS` (single frame). Critique rounds: film P1 + P2, summon / tribute / attack /
direct / hit / guard / kill / blocked / loser, plus the signature moment, and LOOK at every PNG with the Read tool.
Use `--every 33` for frame-exact inspection of a contact.

### 6.3 Sheets (Node, no browser: 5–20 s)

- **[ran]** `npx vite-node tools/monster-sheet.ts --id <id> --look v3 --anims all --points --out shots/sheet-<id>`, then
  the same with `--p2` (P2 as shown on screen, relit + mirrored). It writes `<id>-v3[-p2]-<anim>.png` strips ×3 (frame
  index, hold, marks in the header, red frame edges where the drawing touches), `-all.png`, and `.txt` / `.json`
  (bbox, margin, isolated px, Δ, in / out, seam). Add `--art src/art/monsters-v3/_<id>.ts` for an unregistered draft
  and `--anims attack,death --scale 4 --cols 8` to focus.
- In game: **[ran]** `node tools/shot.mjs "?dev=monster&id=<id>&look=v3&mode=board" --out $SP/b.png --wait 800` (1×
  on tiles). Other modes: `mode=sheet` (base five only; `&anim=` for one), `mode=live` (P1 + flipped P2 playing),
  `&markers=1`. `?dev=monsters&look=v3&anim=idle` shows the whole roster.

---

## 7. Engine facts for the lane C special moments

### 7a. tide_harpooner: `tidalBayShroud` ("Körfez kalkanı" + "KORUNUYOR")

- The rule is a **pure legality filter; there is no engine event for it.** `src/engine/query.ts`: `tidalBayActive(s)`
  (a face-up `fieldTidalBay` in EITHER player's field slot) and `shrouded(s, uid)` (a face-up harpooner while the Bay is
  active). `spellTargetable` and `controlTargetable` exclude shrouded monsters. `src/engine/legal.ts`: the attack list
  uses `attackable(t) = !!t && !shrouded(s, t.uid)`; with no attackable monster the direct attack becomes legal (lines
  ~133–149); spell target generation skips it (`destroyOpponentMonster` ~171, `forceDefense` ~235, the control spells,
  …). The bot (`src/engine/bot.ts`) never tries an illegal move, so the shroud only "happens" on screen when a
  **person** clicks it.
- UI path: `src/duel/HumanInput.ts` `zoneFlow` (battle phase, ~line 558). The attacker click builds `targets` from the
  legal attacks. If a direct attack is legal (the harpooner is the only opponent monster), a menu opens with
  "Doğrudan Saldır" only. Otherwise `pickZone(refs, …)` (~line 860) waits for a candidate click. A click on any other
  zone, the shrouded harpooner included, goes to the reject branch:
  `if (aim) this.rejectHit(h); else sfx.play('uiError') … hud.flashHint('İşaretli hedeflerden birine tıkla')`.
  Spell targets come through the same `pickZone` (`handFlow` → `activateSpell` targets). **Hook point:** add ONE line
  at the top of that reject branch:
  `if (LOOK_V3 && shroudReject(this.scene, this.views, this.state, h)) return;`. Put `shroudReject` in your own
  file (e.g. `src/cinematics/kartc/tide_harpooner-shroud.ts`). It returns false unless `h` is a monster zone whose
  slot is shrouded (`shrouded(state, slot.uid)`); otherwise it plays the reticle sliding off the wave wall, the
  "KORUNUYOR" stamp and the "şlup" sound, and flashes its own hint. Keep the a6v1 films `a6Invalid` / `a6Reject`
  identical: they never click a harpooner, and the call is LOOK_V3-gated.
- **The ring while the Bay is up:** the Bay's activation emits `fieldSpell {active:true}`, then a `statChange` for every
  face-up monster whose stats changed (`rules.ts ~518–534`), so the harpooner gets +400 → 2100.
  `registerCardHook('tide_harpooner', 'statChange', async (ctx) => { await ctx.base(); if (LOOK_V3 && shrouded(ctx.stateNext, ctx.ev.uid)) ctx.unit(ctx.ev.uid)?.setAura('bayShroud', ring(…)); }, { priority: 20 })`.
  The Bay leaving emits a `statChange` back, so clear the aura then. A harpooner **summoned or flipped while the Bay
  is already up gets no statChange**: attach the aura at the end of your summon / flip handler too. A
  `registerObserver` on `fieldSpell` / `summon` / `flip` / `destroy` / `controlChange` that re-syncs the aura is the
  robust alternative. Do NOT register a hook on `tidal_bay` itself (no lane owns it). Cinematics may import
  `src/engine/query.ts`; only `src/presentation/**` must not.
- Staging: `p0/p1: { field: 'tidal_bay' }` puts the Bay face-up and active (`scenario.ts:131`).

### 7b. kite_fencer: `doubleAttackMonster`

- `legal.ts`: `double = effect === 'doubleAttackMonster'`, it may attack while `attacksThisTurn ≤ 1`, and
  `second = attacksThisTurn > 0` offers no direct attack. `rules.ts declareAttack` does `slot.attacksThisTurn++` and
  then emits `attackDeclare`. `_core/project.ts` replays that increment, so **inside the strike** read
  `const slot = s.ctx.state.players[s.ctx.ev.player].monsters[s.ctx.ev.attackerZone]; const nth = slot?.attacksThisTurn ?? 1;`.
  `nth === 1` is the first attack (1.8 s, a straight lunge, 60 ms stop, then one cape panel lights on the way home);
  `nth === 2` is the second (2.2 s, the kite rise and pendulum, 80 ms stop, the panel goes dark). Neither the `battle`
  nor the `attackDeclare` event carries a count; the projected state does.
- An attack negated by `chains_of_light` has no `battle`; the declaration already counted it. The counter resets in
  `beginTurn` (`rules.ts:376`).
- "Remaining attack" indicator: `u.setAura('kitePanel', panelAura(...))` when the first strike finishes. Clear it on
  the second strike's start and on `phaseChange` / `turnStart` (`registerObserver((ev) => …)`, LOOK_V3-gated). It is a
  Disposable (`{ destroy() }`) drawn with `onFrame` on the current frame's silhouette (pattern: `duel/auras-v3.ts`
  `flameAuraV3`).
- Also film `battle_cry` (one direct 1900 + one monster attack) and `wing_lady` (1200). YENI_KARTLAR C9 lists them.

### 7c. Direct attacks (the harpoon in the LP panel)

`s.direct === true`, `s.to` = the defending duelist's chest (`fx.duelistPoint(ctx, p)`). The LP readout:
`fx.lpPoint(ctx, defender)` = `ctx.views.hud.lpXY(defender)` (HUD / screen space; the HUD does not shake or pan).
`fx.directImpact(ctx, at, ref)` maps screen ↔ world when the camera has leaned. The battle (battleV3 `direct`) puts the
spark, shake and 110 ms stop at the duelist; your rope can overshoot to the LP number and stick there (draw it at HUD
depth, whole pixels), with the number and LP roll following the `damage` event. No new camera move (EF-8).

### 7d. Other engine facts lane C needs

- Tribute: harpooner Sv5 = 1 tribute (`tributeNeed`). It is the only ace in lane C, so the cut-in plays when
  `ace && tribute` (`summon-a/_kit.ts runSummon`).
- Tidal Bay also gives +400 to reed_heron (→ 1800, a WATER Su-type); wing_lady gives +300 to kite_fencer and
  steppe_spiralhorn (WIND). These are `statChange` events, handled by the generic `flow/stats.ts` (do not override it).
- Mass destroys (`void_eye`, `massDestroy` → per-card `destroy`) and `controlChange` (puppet_string / soul_leash) reach
  your `destroyed` hook with `reason: 'effect'` and `sourceUid` set. `sourceOwnsDeath(ctx)` decides who animates the
  death.

---

## 8. Gates (exact commands; every one [ran] on this tree unless noted)

All heavy tools start their own Vite + Chromium. Run them **one at a time, `--jobs 1–2`**: the machine had load
average > 20 during these runs.

### 8.1 Typecheck **[ran]**

`npm run typecheck` → no output = clean (1 min 44 s under load). Errors in files you do not own are other lanes' WIP.

### 8.2 Tests **[ran]**

`npm test -- --maxWorkers=2 --minWorkers=1` (8.5 min). Result on the clean base: 11 failed files. The known failures
are `dusk_ashen`, `hourglass_imp`, `shield_titan` and the `cardface-v3` G1 (lane D's scrap_raiders). **Seven more
failures were only `Test timed out in 5000ms` under load** (`coral_serpent` crumbs, `grim_warden` / `seal_*` card
picture, `deck/match`). Re-running exactly those files passed (53/53) **[ran]**:
`npx vitest run tests/art/coral_serpent.test.ts tests/art/grim_warden.test.ts tests/art/seal_arm_l.test.ts tests/art/seal_arm_r.test.ts tests/art/seal_leg_l.test.ts tests/art/seal_leg_r.test.ts tests/deck/match.test.ts --testTimeout=120000 --maxWorkers=2 --minWorkers=1`.
Rule: any NEW red test must be re-run with `--testTimeout=120000` before you call it real. Add your own
`tests/art/<id>.test.ts` (template: `tests/art/steel_silencer.test.ts`: every anim with holds, `validateArt(art, {
tier: 'normal', attack: 'melee' })` without errors, deterministic frames, P2 keeps the silhouette, size; plus the card
art budget test of `tests/art/seal_arm_r.test.ts`). New registered arts and recipes automatically enter
`tests/presentation/recipes.test.ts`, `accessors-v3.test.ts` (§3.4 gotcha), `tests/art/p2-paint.test.ts` and the
monster-timing tests.

### 8.3 Sheet gates **[ran on crystal_wyrm]**

```
npx vite-node tools/monster-sheet.ts --id <id> --look v3 --anims all --points       --out shots/gates-<id>
npx vite-node tools/monster-sheet.ts --id <id> --look v3 --anims all --points --p2  --out shots/gates-<id>
npx vite-node tools/monster-gates.ts shots/gates-<id>/<id>-v3.json shots/gates-<id>/<id>-v3-p2.json --class <ace|medium|small>
```

Classes: tide_harpooner `ace`; reed_heron, crag_axeman and steppe_spiralhorn `medium`; kite_fencer `small`. Exit 0 =
every gate passes, 2 = a FAIL. crystal_wyrm printed `24 rows: 20 ok, 0 FAIL, 2 known, 1 n/a, 1 info`, with rows KK-3
(margins, HA-14 … HA-20, IŞ-10 idle ≤ 10 % / body ≤ 15 % / effect ≤ 20 %, ref), KK-4 (HA-21 contact local < 50 % incl.
every idle phase, HA-11), KK-5 (HA-9 feet), KK-6 (HA-1 marks, HA-25 muzzle each frame), IŞ-1 (P2 lit from the screen's
top-left) and KK-13 (frames ≤ 140, ms / frame ≤ 8, bytes / side). `known` is reserved for the frozen slice. A lane C
art must reach `0 FAIL` with no `known` of its own. Pass `--ref none`: the default reference for a card without an
approved still is v1 idle f0, which for lane C is the placeholder totem. The on-screen half of KK-4: **[ran]**
`node tools/contact-probe.mjs --scenarios <yourKill>,<yourHit> --jobs 1 --out shots/probe-<id>.json --txt shots/probe-<id>.txt`
(it ends with `resting contacts failing: 0`; `--png DIR` writes ×3 strips).

### 8.4 Sameness **[ran on steel_silencer]**

`npx vite-node tools/sameness.ts --look v3 --ids <id> --against all --out shots/same-<id>` (37 s; add
`--art src/art/monsters-v3/_<id>.ts` for a draft). It writes `sameness.txt / .json` and an overlay PNG
`<id>__<other>.png` for every UYARI / KALIR pair (LOOK at them). Columns: KEY, MOTsig, MOTloop, MOTavg, SI, RHYTHM,
SIL0, HEAT, PAL; letters G / U / K = GEÇER / UYARI / KALIR. With `--against all` **every pair is "out of plan"**: a KALIR
there shows as `U!` and only blocks via a blind eye test (REHBER KK-15). Exit 1 (some UYARI) is normal. Read it like this:
- Ignore rows against the 30-odd **placeholder totems** (the other new cards, `src proxy`). Their proxy MOT gives
  meaningless UYARIs (steel_silencer vs every polar_* totem: MOTsig 0.78 U).
- Judge the rows against real v3 arts (`src points`) and against the YENI_KARTLAR "En yakın kart": harpooner ×
  coral_serpent / tide_golem; heron × storm_hawk / shade_assassin; axeman × stone_sentinel (v3, biped); kite ×
  storm_hawk / wisp_imp; spiralhorn × ember_wolf. Any `U!` (a metric at the KALIR line) against them needs a fix or a
  written distinction plus the blind test (`--blind DIR --key-out KEYDIR`, `--score`).
- Gate pairs between two hand-made lane C arts appear only when both are in one tree. After the merge the lane runs
  `--ids tide_harpooner,reed_heron,crag_axeman,kite_fencer,steppe_spiralhorn` (exit 2 = a KALIR = blocked).

### 8.5 v1 must be byte-identical **[ran, both IDENTICAL]**

```
node tools/filmdiff.mjs --set v1   --base /home/user/yugioh/shots/v3/a3/baseline/v1films     --jobs 2 --out shots/fd-v1
node tools/filmdiff.mjs --set a6v1 --base /home/user/yugioh/shots/v3/a56/baseline/a6v1films  --jobs 2 --out shots/fd-a6v1
```

v1: `all 17 film(s) IDENTICAL [986 s]` (16.5 min at load ~20). a6v1: run with `--only a6Reject,a6Hover` →
`all 2 film(s) IDENTICAL (subset …) [23 s]`. The full set is 26 films (~10–30 min). `node tools/filmdiff.mjs --list
--set a6v1` lists them. A DIFFERS writes `<out>/<film>.diff/fNNNN.png` (base | now | red changes). The baselines exist
ONLY in the main tree; always use the absolute `--base`. The frames are deleted when all films are IDENTICAL
(`--keep` keeps them).

### 8.6 Palette, white and bands (palcheck) **[ran]**

```
node tools/shot.mjs "?dev=duel&s=<key>&look=v3&zones=5" --fresh --film 40 --every 66 --frames shots/pal-<key> --out shots/pal-<key>.png
node tools/palcheck.mjs shots/pal-<key> --every 66 --clip <effect region x,y,w,h>     # exit 0 pass, 2 fail
```

Film WITHOUT `--clip` (white % and rows are measured on the whole 640×360 frame); `--clip` only sets the off-palette
region. Gates (`--rules a5`, the default): Δoff ≤ 1 pt versus frame 0, off ≤ 50 %, white ≤ 1.5 %, rowWhite ≤ 60 %. ⚠
The DEFAULT path already fails it: `ssAttack` (steel_silencer's generic strike) gave `Δoff 5.25 pt`, `white 2.56 %` at
the contact (alpha-blended dust: `#676776 ≈ stone2 Δ17`, `#b2b2c3 ≈ mist`). So your own effects must use palette steps
only (no alpha, no ADD tints). When the shared kit (damage number, generic flash) is the cause, show it with the
`worst-frame off-palette colours` list, or compare with `--vs <dir with a same-named film>`.

### 8.7 Camera never changes (measure --camera-gate) **[ran: live measure + offline gate against the real base]**

The base `/home/user/yugioh/shots/v3/kartc/camera-base.json` exists (look v3, git 6924dd6 = the 684e290 code). Its
15 keys are `saWyrmAtk saWyrmBlocked saMagusAtk saMagusEffect suWyrm suRevive spBolt tbChains smbPos flowTurnP1 suMagus
spRecallSet tbMirror flowLethal flowSurrender`. Measure those (they prove the shared camera did not move) PLUS your new
keys, one run:

```
B=saWyrmAtk,saWyrmBlocked,saMagusAtk,saMagusEffect,suWyrm,suRevive,spBolt,tbChains,smbPos,flowTurnP1,suMagus,spRecallSet,tbMirror,flowLethal,flowSurrender
node tools/measure.mjs --scenarios $B,harpSummon,harpAttack,harpDirect,harpKill,harpGuard --look v3 --jobs 2 \
  --out shots/m-<id>.json --camera-gate /home/user/yugioh/shots/v3/kartc/camera-base.json        # exit 3 = a camera FAIL
node tools/measure.mjs --camera-gate /home/user/yugioh/shots/v3/kartc/camera-base.json shots/m-<id>.json   # offline re-check
```

Per scenario: `zoom.max = 1` and `camera.closeUpCalls = 0`. For a key in the base, also `focusCalls` equal and
`maxScrollPx` within one frame of camera motion. Your new keys are not in the base, so they get **`NOBASE`**: only zoom
and close-ups are checked. Therefore also compare `camera.focusCalls` / `maxScrollPx` of your keys by hand with the
generic battle. **[ran]** `node tools/measure.mjs --scenarios ssAttack,ssKill --look v3 --jobs 1 --out $SP/m.json`
(2.5 min): `ssAttack … contact 750 number 750 zoom 1 cam 2f/18px … ready 2583`, `ssKill … contact 933 … cam 2f/19px …
ready 2783`. The offline gate against the real base printed `ssAttack: camera ok — NOBASE (…); focus 2, maxScroll 18`,
`ssKill: … focus 2, maxScroll 19`, `camera gate: 0 ok, 2 ok without a base (NOBASE), 0 FAIL`, exit 0. Never call
`ctx.focus(…, { closeUp: true })` and never add pans (EF-8). The same JSON gives the budgets (§3.5: the `ready` and
`contact` columns, and `numberAfterContactMs`) and the sound timeline (`sfx[]` vs `anims[]`: SE-1 sync ≤ 1 frame).

---

## 9. Definition of done for one lane C monster (PARALEL_OTURUMLAR → files)

- [ ] **Rig**: `src/art/monsters-v3/<id>.ts` + `-rig/-anims/-kit(-maps,-fx).ts`. Base 5 + summon, death, revive,
      hitHeavy, hitMagic, toGuard, fromGuard (+ special / victory as needed). Marks per §1.2, `p2: 'relight'`, points
      every frame, `weight` chosen against the storyboard hit-stop. A distinction card in the header comment.
- [ ] **Sheets**: P1 + P2 ×3, every anim, ≥ 3 critique rounds (KK-2). `monster-gates --class …` 0 FAIL.
      `contact-probe` 0 failing.
- [ ] **Sameness** `--against all` read; no `U!` against the closest relatives (or a blind test passed).
- [ ] **Card art**: `src/art/cardart-v3/<id>.ts` big + hand small. The probe passes the §10 numbers (offPalette 0,
      isolated ≤ 0.10, colours ≤ 20, focusOk, fill 0.60–0.75). Wired through `portrait`. Checked at 1× in
      `?dev=cards&mode=x3&look=v3`.
- [ ] **Cut-in** (harpooner): `src/art/cutins-v3/tide_harpooner.ts`, relit P2, recipe rhythm, `?dev=cutin` checked.
- [ ] **Sounds**: `src/audio/v3/<id>.ts` (every beat of summon, attack(s), hit, death, signature, idle details as
      storyboarded) + the CharacterSounds voice. The three registry edits (Appendix C). Probe: §5.1 identity numbers, LSD ≥ 10
      dB against the neighbours in the same role, chain peak < 0.98, clip true peak ≤ −1 dBFS, a sound MP4 delivered.
- [ ] **Cinematics** (`src/cinematics/kartc/<id>.ts`, LOOK_V3-gated): unique summon (tribute + cut-in for the
      harpooner), a unique attack (kite: two different attacks), a unique death finale (§5.2 table; the generic dissolve
      only in the last 150 ms), the effect / signature moment (§7), and flip / position / revive flourishes. Sounds on
      marks.
- [ ] **Recipe** `src/presentation/cards/<id>.ts` (or table rows edited in place). `recipes.test` + `accessors-v3.test`
      green.
- [ ] **Scenarios** `src/duel/scenarios/<id>.ts`: summon (+ P2), attack (+ P2), direct, hit, kill (+ P2), guard,
      loser, flip, signature (Bay on / shroud UI / double attack / battle_cry …).
- [ ] **Budgets**: `measure --look v3` ready / contact within §3.5. Number − contact = 0 ± 17 ms.
- [ ] **Gates before every push**: typecheck clean · `npm test` no new failures (re-run red ones with a long
      timeout) · filmdiff v1 17/17 + a6v1 26/26 IDENTICAL (absolute bases) · camera gate exit 0 · palcheck on your
      films.
- [ ] **Docs**: a row in `docs/v3/oturum-c.md` (status, evidence paths under `shots/`, open issues). Commit + push per
      the lane rules.

---

## 10. Pitfalls found

1. **v3 drafts that look done are not live**: magma_titan and coral_serpent v3 are `_`-prefixed. Four arts are
   explicitly excluded. Check what plays with `?dev=monster&id=…&look=v3` or `hasMonsterArtV3`.
2. **Recipe all-custom trap** (§3.4): all four parts custom + any table difference breaks `accessors-v3.test.ts`.
   Leave death and flip on the recipe and decorate them at priority 20.
3. **A CHARACTER_SOUNDS entry is mandatory for a unique voice**: without it the kits play generic sounds in your
   declaration, death and cut-in. A VoicePreset needs a palette interpreter, and only `rumble` exists.
4. **Struck-body sound**: only crystal / metal / cloth / stone hit recipes exist. `GENERATED_HIT_MATERIALS` is pinned
   by a test you do not own.
5. **monster-gates class**: auto = `ace` for every hand-made v3 art. Pass `--class`. KK-13: ≤ 140 frames / side,
   ≤ 8 ms / frame (P2 doubles the paint, but lazily; the first P2 use must not freeze > 50 ms → warm your poses with
   `warmPoses(id, player, [...])` at the start of your summon / declare).
6. **IŞ-10 noise**: isolated / opaque idle mean ≤ 10 %, body frames ≤ 15 %, effect frames ≤ 20 %. Fur, reeds, mist,
   grass and kite cloth are speckle magnets: use flat 2-px bands and a crumb pass; draw motes as light, not matter.
7. **Determinism**: films and measure re-seed the module streams and step the clock. Use `seed(...)` / `RR` (strikes
   kits) or `fxRng(seed)`, the scene clock (`ctx.wait`, `sleep(scene)`, `onFrame` dt) and never `Math.random`,
   `Date.now`, `performance.now` or `setTimeout` for timing. The hit-stop and tempo flow only through the show clock.
8. **v1 byte-identity**: gate every registration by LOOK_V3. Do not edit shared kit defaults or v1 branches. No module
   top-level work that consumes shared RNG or creates textures in v1. Do not add v1 art for the new cards.
9. **Things that break the page for everyone in your tree**: a throwing module in an eager glob
   (`src/art/monsters-v3/*`, `src/duel/scenarios/*`, `src/presentation/cards/*` with a wrong `id`, `src/art/cutins-v3/*`).
   The cinematics loader survives a throwing file (it logs `[cinematics] failed to load …`), but your handlers are then
   missing. Read the shot.mjs console output (`[pageerror]`, `[console.error]`) after every film.
10. **Boot cost**: every `src/art/monsters-v3/*.ts` helper runs at boot; heavy tables must be lazy.
11. **Load-induced timeouts**: vitest's 5 s default fails heavy art tests on the shared machine. Re-run with
    `--testTimeout=120000` before trusting a red. Keep `--jobs 1–2` for filmdiff / measure / contact-probe. Never leave
    servers running (every tool closes its own Vite / Chromium; kill strays with `pkill -f "tools/shot.mjs"` only for
    your own runs).
12. **palcheck**: film without `--clip`, or white % is over-counted. Alpha / ADD effects push off-palette.
13. **UI hook for the shroud** lives in shared `HumanInput.ts`: one LOOK_V3-gated line, no change to v1 reject
    behaviour (a6v1 films `a6Invalid`, `a6Reject`).
14. **Second attack count**: read `ctx.state` (projected) — `attacksThisTurn` already includes the current declaration.
15. **Death finale table §5.2**: the axeman splits along its own crack ("taşa dönme yok"; the stone / ash finale belongs
    to R1 and stone_sentinel). The harpooner retreats into the shell and the shell buries itself (the harpoon stays
    0.5 s). The heron steps back into the mist (only the reeds remain). The kite's string snaps and the cape flies
    off-screen. The spiralhorn becomes a seed / grass cloud on the wind. The shared table rows today (axeman stone/stone,
    kite plant/light …) are placeholders. Set yours in the recipe.
16. **Entrances**: "climbing out of the ground" belongs to R2 and C10 only; a dive from the sky belongs to storm_hawk
    only. The kite's falling kite and the spiralhorn's leap in from off-screen must not read as a dive.
17. **Colour**: `cyan` / `crim` are player colours, `teal` means spell and `mag` means trap. None of them on monster
    bodies (accents only). The palcheck palette is the 69 `PAL` colours.

---

## Appendix A — `sfx-probe.mjs` (tested; keep untracked, e.g. `$W/shots/tools/sfx-probe.mjs`)

`shots/` is git-ignored. From `$W/shots/tools/`, node resolves `vite` / `playwright-core` through `$W/node_modules`.
Run it from the worktree root: `node shots/tools/sfx-probe.mjs <sfx> [<sfx> …] [--against a,b] [--out DIR] [--pitch P] [--raw] [--seconds S]`.

```js
#!/usr/bin/env node
// sfx-probe — evaluate synthesized sounds WITHOUT EARS. Renders each named sfx OFFLINE in headless Chromium through
// the real master chain (src/audio/sfx.ts renderSfx, seed 1234), writes <out>/<name>.wav (44.1 kHz 16-bit stereo) +
// probe.json, prints len / peak / rms / loudest 50 ms / centroid / dominant Hz / onsets / 1/3-octave A-weighted
// profile, and a pairwise LSD matrix (dB) over the sounds + --against (SE-4: ≥ 10 min / ≥ 15 median per role; SE-5 ≥ 9).
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = { out: 'shots/sfx-probe', seconds: '4', pitch: '1', against: '' };
const names = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--raw') opt.raw = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = argv[++i];
  else names.push(a);
}
const against = opt.against ? opt.against.split(',').filter(Boolean) : [];
if (!names.length) { console.error('usage: node sfx-probe.mjs <sfxName>... [--out DIR] [--seconds S] [--pitch P] [--raw] [--against a,b]'); process.exit(2); }
const root = process.cwd();
const outDir = path.resolve(root, opt.out);
fs.mkdirSync(outDir, { recursive: true });
function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of fs.readdirSync(base).sort().reverse()) {
    const p = path.join(base, d, 'chrome-linux', 'chrome');
    if (/^chromium-\d+$/.test(d) && fs.existsSync(p)) return p;
  }
  return undefined;
}
const server = await createServer({ root, logLevel: 'error', server: { port: 5900 + Math.floor(Math.random() * 90), host: '127.0.0.1', strictPort: false, hmr: false }, clearScreen: false });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: chromePath(), args: ['--autoplay-policy=no-user-gesture-required'] });
let code = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(base + '?dev=font&test=1', { waitUntil: 'load' });          // the lightest page that boots the module graph
  await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout: 120000 });
  const res = await page.evaluate(async ({ list, seconds, pitch, raw }) => {
    const S = await import('/src/audio/sfx.ts');
    const A = await import('/src/audio/analyze.ts');
    const known = new Set(S.SFX_NAMES);
    const out = {};
    const aW = (f) => { const f2 = f * f; const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)); return 20 * Math.log10(ra) + 2.0; };
    const centres = []; for (let k = -13; k <= 12; k++) centres.push(1000 * Math.pow(2, k / 3));   // 50 Hz … 16 kHz
    const fft = (re, im) => {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
      for (let L = 2; L <= n; L <<= 1) { const ang = (-2 * Math.PI) / L, wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < n; i += L) { let cr = 1, ci = 0;
          for (let k = 0; k < L / 2; k++) { const a = i + k, c = a + L / 2; const tr = re[c] * cr - im[c] * ci, ti = re[c] * ci + im[c] * cr;
            re[c] = re[a] - tr; im[c] = im[a] - ti; re[a] += tr; im[a] += ti; const n2 = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = n2; } } }
    };
    for (const name of list) {
      if (!known.has(name)) { out[name] = { error: 'unknown SfxName (not spread into RECIPES?)' }; continue; }
      const b = await S.renderSfx(name, { seconds, chain: !raw, opts: { pitch }, seed: 1234 });
      if (!b) { out[name] = { error: 'render failed' }; continue; }
      const st = A.stats(b), m = A.mono(b), sr = b.sampleRate, N = 4096;
      const len = Math.max(N, Math.min(m.length, Math.ceil((st.len + 0.05) * sr)));
      const pow = new Float64Array(N / 2), re = new Float64Array(N), im = new Float64Array(N);
      let frames = 0;
      for (let s = 0; s + N <= len; s += N / 2) {
        for (let i = 0; i < N; i++) { re[i] = (m[s + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))); im[i] = 0; }
        fft(re, im); for (let i = 0; i < N / 2; i++) pow[i] += re[i] * re[i] + im[i] * im[i]; frames++;
      }
      let num = 0, den = 0, best = 0, bestI = 1;
      for (let i = 1; i < N / 2; i++) { const f = (i * sr) / N; num += f * pow[i]; den += pow[i]; if (f > 30 && pow[i] > best) { best = pow[i]; bestI = i; } }
      const bands = centres.map((fc) => { const lo = fc / Math.pow(2, 1 / 6), hi = fc * Math.pow(2, 1 / 6); let e = 0;
        for (let i = Math.max(1, Math.floor((lo * N) / sr)); i <= Math.min(N / 2 - 1, Math.ceil((hi * N) / sr)); i++) e += pow[i];
        return 10 * Math.log10(e / Math.max(1, frames) + 1e-20) + aW(fc); });
      const top = Math.max(...bands), prof = bands.map((d) => Math.max(-60, d - top));
      const w = Math.floor(sr * 0.01), env = [];
      for (let i = 0; i + w <= m.length; i += w) { let s = 0; for (let j = 0; j < w; j++) s += m[i + j] * m[i + j]; env.push(10 * Math.log10(s / w + 1e-20)); }
      const envTop = Math.max(...env), onsets = [];
      for (let i = 1; i < env.length; i++) if (env[i] - env[i - 1] >= 9 && env[i] > envTop - 30) onsets.push(+(i * 0.01).toFixed(2));
      const pcm = [];
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(Math.min(c, b.numberOfChannels - 1)); const n = Math.min(d.length, Math.ceil((st.len + 0.3) * sr));
        const i16 = new Int16Array(n); for (let i = 0; i < n; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
        let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); pcm.push(btoa(s)); }
      out[name] = { len: +st.len.toFixed(3), peakDb: +(20 * Math.log10(st.peak + 1e-12)).toFixed(2), rmsDb: +st.rmsDb.toFixed(1), loudDb: +st.maxWinDb.toFixed(1), loudAt: +st.peakAt.toFixed(3),
        centroidHz: Math.round(num / den), dominantHz: Math.round((bestI * sr) / N), onsets, profile: prof.map((x) => +x.toFixed(1)), sr, pcm };
    }
    return { centres: centres.map((c) => Math.round(c)), out };
  }, { list: [...new Set([...names, ...against])], seconds: Number(opt.seconds), pitch: Number(opt.pitch), raw: !!opt.raw });
  const wav = (pL, pR, sr) => { const L = Buffer.from(pL, 'base64'), R = Buffer.from(pR, 'base64'); const n = Math.min(L.length, R.length) / 2; const data = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) { data.writeInt16LE(L.readInt16LE(i * 2), i * 4); data.writeInt16LE(R.readInt16LE(i * 2), i * 4 + 2); }
    const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
    h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40); return Buffer.concat([h, data]); };
  const json = { centres: res.centres, sounds: {} };
  for (const name of Object.keys(res.out)) {
    const r = res.out[name];
    if (r.error) { console.log(`${name}: ${r.error}`); code = 1; continue; }
    fs.writeFileSync(path.join(outDir, `${name}.wav`), wav(r.pcm[0], r.pcm[1], r.sr)); delete r.pcm; json.sounds[name] = r;
    if (!names.includes(name)) continue;
    console.log(`\n${name}  len ${r.len}s  peak ${r.peakDb} dBFS  rms ${r.rmsDb} dB  loudest50ms ${r.loudDb} dB @${r.loudAt}s  centroid ${r.centroidHz} Hz  dominant ${r.dominantHz} Hz`);
    console.log(`  onsets (s): ${r.onsets.join(' ') || '-'}`);
    r.profile.forEach((d, i) => console.log(`  ${String(res.centres[i]).padStart(6)} Hz ${'#'.repeat(Math.max(0, Math.round((60 + d) / 2))).padEnd(30)} ${d}`));
  }
  const ok = Object.keys(json.sounds);
  if (ok.length > 1) {
    const lsd = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
    console.log('\nLSD matrix (dB):'); console.log(''.padEnd(22) + ok.map((n) => n.slice(0, 10).padStart(11)).join(''));
    json.lsd = {};
    for (const a of ok) { json.lsd[a] = {}; let line = a.slice(0, 21).padEnd(22);
      for (const b of ok) { const v = lsd(json.sounds[a].profile, json.sounds[b].profile); json.lsd[a][b] = +v.toFixed(1); line += (a === b ? '-' : v.toFixed(1)).padStart(11); }
      console.log(line); }
  }
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(json, null, 1));
  console.log(`\nwrote ${path.relative(root, outDir)}/{${ok.join(',')}}.wav + probe.json`);
} catch (e) { console.error(e); code = 1; } finally { await browser.close(); await server.close(); }
process.exit(code);
```

The probe's LSD (RMS dB difference of level-normalised, A-weighted 1/3-octave profiles, floored at −60 dB) is close to
REHBER SE-4's measure but not identical to the A2 tool (which was a scratch script). Use it to compare, and say so in
your evidence.

## Appendix B — `cardart-probe.ts` (tested on seal_arm_r; keep untracked, e.g. `$W/shots/tools/cardart-probe.ts`)

Run: `npx vite-node shots/tools/cardart-probe.ts -- src/art/cardart-v3/<id>.ts --out shots/cardart-<id>` (from the
worktree root). Output on seal_arm_r: `big {"colors":19,"backdropColors":6,"offPalette":0,"isolated":0.014,
"subjectFill":0.62,"outlineInk":0.88,"focusOk":true,…}`, `small {…"subjectFill":0.64,"outlineInk":1,…}`.

```ts
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const args = process.argv.slice(2).filter((a) => a !== '--');
const file = args.find((a) => a.endsWith('.ts'));
const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : 'shots/cardart-probe');
const frame = args.includes('--frame') ? Number(args[args.indexOf('--frame') + 1]) : 0;
if (!file) throw new Error('usage: npx vite-node cardart-probe.ts -- src/art/cardart-v3/<id>.ts [--out DIR] [--frame N]');
const kit = await import(path.resolve('src/art/cardart-v3/_kit.ts'));
const card = (await import(path.resolve(file))).default;
const r = kit.renderArt(card, frame);
function png(px: { w: number; h: number; data: ArrayLike<number> }, k: number): Buffer {
  const W = px.w * k, H = px.h * k, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) { const s = (Math.floor(y / k) * px.w + Math.floor(x / k)) * 4, d = y * (W * 4 + 1) + 1 + x * 4; for (let c = 0; c < 4; c++) raw[d + c] = px.data[s + c]; } }
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = T[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(outDir, { recursive: true });
const id = card.id as string;
fs.writeFileSync(path.join(outDir, `${id}-big-x3.png`), png(r.bigPx, 3));
fs.writeFileSync(path.join(outDir, `${id}-small-x6.png`), png(r.smallPx, 6));
fs.writeFileSync(path.join(outDir, `${id}-small-x1.png`), png(r.smallPx, 1));
console.log(id, 'frame', frame, 'auto small (blind reduction, a DRAFT):', !card.small);
console.log('big  ', JSON.stringify(kit.artStats(r.big, r.bigPx, card.focus)));
console.log('small', JSON.stringify(kit.artStats(r.small, r.smallPx, card.focusSmall ?? [card.focus[0] / 2, card.focus[1] / 2])));
```

## Appendix C — shared-file anchors (insert ONE line AFTER the quoted line; distinct anchors merge cleanly)

Checked with a scratch git repo: two branches that insert after two different (even consecutive) lines merge without a
conflict, but two inserts after the SAME line conflict. Each card therefore has its own anchor in every shared file:

| File | tide_harpooner | reed_heron | crag_axeman | kite_fencer | steppe_spiralhorn |
|---|---|---|---|---|---|
| `src/audio/sounds.ts` import | `import { V3_RECIPES } from './v3/slice';` | `… from './v3/voices';` | `… from './v3/dawn';` | `… from './v3/ui-flow';` | `… from './v3/materials';` |
| `src/audio/sounds.ts` spread (in `RECIPES`) | `  ...V3_RECIPES,` | `  ...V3_VOICE_RECIPES, // …` | `  ...V3_DAWN_RECIPES, // …` | `  ...UI_FLOW_RECIPES, // …` | `  ...V3_MATERIAL_RECIPES, // …` |
| `src/audio/sfx.ts` type import | `import type { V3SfxName } from './v3/slice';` | `… from './v3/voices';` | `… from './v3/dawn';` | `… from './v3/ui-flow';` | `… from './v3/materials';` |
| `src/audio/sfx.ts` union member | `  \| V3SfxName` | `  \| V3VoiceSfxName` | `  \| DawnSfxName` | `  \| V3SpellSfxName` | `  \| V3MaterialSfxName` |
| `src/cinematics/_v3/sound.ts` import | `import { hitSfxName } from '../../audio/v3/materials';` | `import { voiceSounds } from '../../audio/v3/voices';` | `import type { MaterialId } from '../../art/materials';` | `import { v3Recipe } from '../../presentation/registry';` | `import type { BlowKind } from './blow';` |
| `CHARACTER_SOUNDS` entry (`  <id>: <ID>_VOICE,`) | after `export const CHARACTER_SOUNDS: … = {` | after the `  },` that closes `crystal_wyrm` | after the `  },` that closes `abyss_magus` (just before `};`) | same slot as axeman ⚠ | same slot as axeman ⚠ |

The object has only three clean slots. The kite and spiralhorn entries therefore conflict with axeman's, and with each
other, at merge time. Resolve by keeping all lines: it is a pure union with no logic. Other lanes (A, B, D, E) touch the
same registries; the orchestrator resolves those cross-lane unions. Never reorder or reformat these lists.
