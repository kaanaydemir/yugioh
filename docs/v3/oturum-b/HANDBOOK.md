# Lane B builder handbook: a complete v3 presentation for one monster card

**Lane B cards:** `grim_warden` (R2), `wisp_imp` (R3), `mudgrasp_spirit` (C10), `hollow_ogre` (C6).

- **Repo and branch:** `/home/user/yugioh`, branch `claude/kart-b`, HEAD `684e290`.
- **What was verified:** I re-read the code behind every load-bearing claim in the five research reports: registries, hook kinds, engine event order, helper signatures and shared-file line numbers.
- **What was not verified:** commands marked *(not run)* come from the tool headers and docs. Nobody has executed them in this checkout.

**Read first:** `docs/GAME_DESIGN.md`, then `docs/v3/YENI_KARTLAR.md` (§5, §5.1 sound ownership, §5.2 death endings, and the card's own section R2, R3, C6 or C10), then `docs/v3/REHBER.md` and `docs/v3/TEMPO.md`. The brief is `docs/v3/PARALEL_OTURUMLAR.md`.

**Golden rule:** every summon, attack, death and effect must be unique to the card, and the sound counts as much as the picture. If a moment looks or sounds shared, redo it.

---

## 0. Definition of done (per card)

1. **Sprite rig** in `src/art/monsters-v3/`, drawn for P1 and P2 (`p2: 'relight'`).
   - Base anims: idle, roar, attack, hit, guard.
   - Mandatory extras: summon, death, revive, hitHeavy, hitMagic.
   - toGuard and fromGuard when idle f0 and guard f0 differ a lot (HA-20).
   - A `special` anim for the signature effect.
2. **Card art** (`src/art/cardart-v3/<id>.ts`): big 88×68 and a hand-tuned small 44×34. It reaches the game through `portrait()` on the MonsterArt.
3. **Cut-in** (`src/art/cutins-v3/grim_warden.ts`). grim_warden is the only ace in the lane, so it is the only card that needs one.
4. **v3 cinematics** in new files: a unique summon, a strike (attack), a death, and the effect.
   - grim_warden: the drain.
   - wisp_imp: the feather pillow.
   - mudgrasp_spirit: the pin.
   - hollow_ogre: planting seeds in its hollow, which is also the banish presentation.
5. **Unique synthesized SFX**: a per-card recipe file plus a `CHARACTER_SOUNDS` voice entry, with extra beats fired from the cinematics.
6. **Scenarios** for P1 and P2: summon, attack, direct attack, blocked attack, death, effect, guard. Film each one and look at the PNG.
7. **Gates green** (§9). Keep `docs/v3/oturum-b.md` current with per-card status, evidence paths and open issues.
8. **At least 3 critique rounds** per card: film, LOOK, critique (use independent critic agents), fix.

**Commits:** the brief says lanes commit and push their own branch with the trailer, and never open a PR. Follow whatever your orchestrator task says on this; CLAUDE.md's default is not to commit.

---

## 1. File layout per card

`<id>` is the card id. Every file below is new and owned by lane B, unless it is marked "shared".

| Purpose | Path | Notes |
|---|---|---|
| Sprite shell | `src/art/monsters-v3/<id>.ts` | Default-exports `MonsterArt`. **Registers automatically**, so draft it as `_<id>.ts` and rename when it is ready. |
| Rig | `src/art/monsters-v3/<id>-rig.ts` | `W,H,AX,GY`, `interface Pose`, `NEUTRAL`, skeleton, part painters, `draw<Name>(p, pose, lightFrom)` |
| Anims | `src/art/monsters-v3/<id>-anims.ts` | `ANIMS`, `EXTRA_ANIMS`, `IMPACT`, `MUZZLE`, cached `framePose(anim,f)`, `framePoints(anim,f)` |
| Maps / kit / fx | `src/art/monsters-v3/<id>-maps.ts`, `-kit.ts`, `-fx.ts` | Hand maps as `_L`/`_R` pairs (`MapPair` from `rigkit/maps.ts`) |
| Card art | `src/art/cardart-v3/<id>.ts` | `CardArtV3` with `big()` and a hand-made `small()` |
| Cut-in (grim only) | `src/art/cutins-v3/grim_warden.ts` | `CutinFactory`, 200×144, `holds.length === frames`, `p2: 'relight'` |
| Cinematics | `src/cinematics/kart-b/<id>.ts` | The glob `./**/*.ts` in `src/cinematics/index.ts` picks up any subfolder. Files starting with `_` in subfolders are imported too, so `kart-b/_kit.ts` must have no side effects beyond exports. |
| Sound recipes | `src/audio/v3/<id>.ts` | `<ID>_RECIPES`, `<Id>SfxName`, `<ID>_VOICE` |
| Lane sound index | `src/audio/v3/kart-b.ts` | `KART_B_RECIPES`, `KartBSfxName`, `KART_B_VOICES`. One shared line per registry. |
| Scenarios | `src/duel/scenarios/<id>.ts` (extend the existing `grim_warden.ts`) | `export default { key: Scenario }`, merged by the glob at `src/duel/scenarios.ts:252` |
| Tests | `tests/art/<id>.test.ts` | Rewrite `grim_warden.test.ts`, extend `wisp_imp.test.ts`, add files for mud and ogre |
| Optional recipe | `src/presentation/cards/<id>.ts` | Only for a cut-in rhythm (grim). See the priority pitfall in §6.0. |
| Optional material | `src/art/materials/defs/<newid>.ts` | `status:'draft'`, `firstUser` must be in `MONSTER_IDS`. Do not edit verified defs such as `bone.ts`. |

---

## 2. Every registration point

| What | File | Exact pattern / one-line edit |
|---|---|---|
| Sprite (v3) | `src/art/monsters/index.ts:31-36` (eager glob of `../monsters-v3/*.ts`, minus `_*.ts`, minus the exclusions) | New cards: just create `monsters-v3/<id>.ts`. **wisp_imp: delete only** `'!../monsters-v3/wisp_imp.ts'` from the exclusion line and leave the other three entries untouched. grim_warden: overwrite in place. |
| Card picture on the face | the card's own `monsters-v3/<id>.ts` | `portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); }` with `import card from '../cardart-v3/<id>'; import { renderArt } from '../cardart-v3/_kit';`. This is the pattern at `monsters-v3/seal_head.ts:35`. |
| Cut-in | `src/art/cutins/index.ts:576` (glob `../cutins-v3/*.ts`, v3 only) | Create the file; boot step `src/boot/25-cutins.ts` builds `cutin:<id>`. The P2 sheet is lazy (`warmCutinP2`). |
| Cut-in rhythm | `src/cinematics/_v3/presets.ts` `RHYTHM` (shared, additive), or `src/presentation/cards/grim_warden.ts` `cutIn:{rhythm}` | Default `{flare:290, slam:370, exit:700, close:120}`, clamped to `exit ≤ 900 − close` |
| Death material preset | `src/cinematics/_v3/presets.ts:43,45,62,66` (`DEATH_PRESETS`, shared) | Edit only your own line. **mudgrasp must stop being `'stone'`**: stone/ash endings are reserved, so use `'water'`. Values: `crystal\|shadow\|stone\|light\|plant\|fire\|water`. |
| Light layer glow | `src/view/light/profiles.ts:75,77,94,98` (`MONSTER_GLOW`, shared) | Replace your own entry. The emissive list matches **pixel colours across the whole sprite**, so never list a body tone. Suggestions are in §4.6. |
| Cinematics | any `src/cinematics/kart-b/<id>.ts` | `registerCardHook / registerStrike / registerEvent` at top level, gated on `LOOK_V3`, explicit `priority`, `name: 'kart-b:<id>:<part>'` |
| Banish handler (ogre) | your `kart-b/hollow_ogre.ts` | `registerEvent('banish', h, { priority: 1, name: 'kart-b:hollow_ogre:banish' })`. The placeholder `b2:banish` is at priority 0 in `b2/placeholders.ts:260`; **do not edit that file**. |
| SFX union | `src/audio/sfx.ts:28,62` (shared) | `import type { KartBSfxName } from './v3/kart-b';` and `\| KartBSfxName` next to `\| DawnSfxName` |
| SFX recipes | `src/audio/sounds.ts:13,1092` (shared) | `import { KART_B_RECIPES } from './v3/kart-b';` and `...KART_B_RECIPES,` next to `...V3_DAWN_RECIPES,` |
| Character voice | `src/cinematics/_v3/sound.ts:176` (`CHARACTER_SOUNDS`, shared) | `import { KART_B_VOICES } from '../../audio/v3/kart-b';` and `...KART_B_VOICES,` inside the literal after `abyss_magus`. This is a spread inside the definition, not a read, so `table-access.test` still passes. |
| −400 timing (grim) | `src/cinematics/battle/plates.ts` / `declare.ts:374` (shared) | Coordinated small change. See §6.4. |
| Scenarios | `src/duel/scenarios/<id>.ts` | `export default { gwDrain: {...}, ... } satisfies Record<string, Scenario>`. Keys are global; use the prefixes `gw*`, `wi*`, `mg*`, `ho*`. All four prefixes are confirmed free except `gw`, which already belongs to lane B. |

There are **no boot files** for monster art. `src/boot/20-monsters.ts` calls `buildAllMonsters`, which paints sheets `mon:<id>` and `mon:<id>:p2` with frames `<anim>:<i>`. Read timing only through `src/art/animtime.ts` (`animSpec`, `frameMs`, `animLengthMs`), because Phaser's `duration` ignores holds.

---

## 3. Keeping v1 identical (KK-9)

- `LOOK_V3` is exported from `src/view/layout.ts` and decided once at module init.
- The v1 look never loads `monsters-v3` or `cutins-v3`.
- Never add files under `src/art/monsters/` (the v1 registry). `tests/duel/monster-timing.test.ts` also forbids `holds` there.
- **Every cinematic registration must be gated.** The safest form registers nothing in v1:

```ts
import { LOOK_V3 } from '../../view/layout';
if (LOOK_V3) registerCardHook('mudgrasp_spirit', 'effect', mudPinV3, { priority: 20, name: 'kart-b:mudgrasp_spirit:effect' });
```

- **Do not call `signatureSummon(...)` unconditionally** for grim_warden or wisp_imp. It registers a `'summon'` hook in v1 too (`summon-a/_kit.ts:681`), which would change v1 films. Use `if (LOOK_V3) signatureSummon(...)`, or call `runSummon` inside your own gated hook.
- Sounds: `soundsOf()` returns null in v1. Any direct `play()` in your files must sit on a v3-only path, because `measure --compare` includes `sfx[]`.

---

## 4. Sprite rig (`src/art/types.ts` contract)

### 4.1 Architecture

Build all four as **hand-built rigs**, using the pattern of `steel_silencer.ts`, `crystal_wyrm.ts` and `abyss_magus.ts`. The reasons:

- grim_warden is an ace, and body-plan members cannot be `tier:'ace'`.
- wisp_imp (a ghost) and mudgrasp_spirit (half-buried, many arms) fit no plan.
- hollow_ogre could use `bodyplans/biped`, but then it is sameness-gated in-plan against stone_sentinel, titan and shield. Hand-built avoids that.

An optional middle path gives auto-marks, the appended end pose and HA lint: `definePose` (`rigkit/pose.ts`), then `compileAnims` (`rigkit/anim.ts`), then `toMonsterArt`.

Minimal shell (the exact shape of `steel_silencer.ts`):

```ts
import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/hollow_ogre';
import { renderArt } from '../cardart-v3/_kit';
import { AX, GY, H, W, drawOgre } from './hollow_ogre-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './hollow_ogre-anims';
const art: MonsterArt = {
  id: 'hollow_ogre', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: 48, y: 50 },
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'heavy', p2: 'relight',
  draw(p: PixelCanvas, a: MonsterAnim, f: number, o?: DrawOpts) { drawOgre(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, a: MonsterAnimExtra, f: number, o?: DrawOpts) { drawOgre(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  points(a: AnyMonsterAnim, f: number): MonsterPoints { return framePoints(a, f); },
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
};
export default art;
```

Spec helper (from the old `grim_warden-anims.ts`):

```ts
const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']) => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });
attack: spec(13, 10, false, [80,100,190,150,50,60,70,90,100,110,120,130,140], { charge:1, release:5, impact:5, contact:6, recover:8 }),
```

### 4.2 Marks (HA-1, `tools/lib/framelib.ts` `REQUIRED_MARKS`)

| anim | required marks |
|---|---|
| attack, roar, special | `charge` < `release` (= `impact`, same frame) < `recover`. Attack also needs `contact`; for a projectile, contact can live in the cinematic. |
| hit, hitHeavy, hitMagic | `impact` = `contact` = 0, plus `recover` |
| death | `impact` = `contact` = 0, plus `dissolve` |
| summon, revive | `land` |

`attackImpactFrame` must equal attack `release`.

### 4.3 Holds (validateArt `src/art/rigkit/validate.ts`)

- **HA-2:** every frame holds 40–200 ms.
- **HA-3 (attack):** the longest frame is in anticipation (charge ≤ f < release). The release frame holds ≤ 70 ms. The contact frame holds 50–90 ms. Recovery holds never get shorter.
- **HA-4 (hit\*):** f0 40–60 ms, f1 40–70 ms, recover starts at 240–370 ms, each recovery frame 70–150 ms.
- **HA-5:** an anim may not hold every frame for the same time.
- **HA-29:** toGuard and fromGuard have 5–7 frames and last ≤ 400 ms.
- **HA-14:** a one-shot's last frame equals idle f0 (toGuard is measured against guard f0), with out ≤ 1.2 × idleΔ. **A hand-built table must append that frame itself.** death and victory are exempt.

**Frame counts.** Normal-tier minimums are idle ≥ 12, guard ≥ 6, attack ≥ 10, roar ≥ 9, hit 5–6, hitHeavy/hitMagic ≥ 7, summon ≥ 10, death ≥ 8 and ≤ 900 ms, revive ≥ 10. The specs ask for 20-frame idles on R2 and R3 and 16-frame idles on C6 and C10.

**Long story beats belong to the cinematic, not the sprite.** The sprite `death` stays ≤ 0.9 s. These beats are cinematic work:

- the wisp's 2.0 s pillow
- the mud spirit's 1.6 s lock on the attacker
- the warden's 1.4 s siphon thread
- the ogre's per-seed loop

### 4.4 Light, outline, palette, noise

- **Light.** `lightOf(o)` from `src/art/rigkit/light.ts`. Decide each part's light and shadow from the light (IŞ-2); do not mirror afterwards. Hand maps need `_L`/`_R` pairs. Emissive pixels are identical in both versions. The P1 and P2 silhouettes must match exactly.
- **Outline.** Call `p.outline(PAL.ink)` once, after the body, then draw the lights. Lights are never outlined: lantern soul-fire, the warden's single eye, the wisp's dot eyes, the hollow eyes and knot-lights, the mud-spirit eyes.
- **Interior seams** are one-step-darker creases (`composite`, `seamFrom`, `stepDown`), never ink.
- **Bands.** 2–4 flat bands per part, each ≥ 2 px. No gradients, no dither, no `bevel()`.
  - Cleanup: `despeckle` and `cleanCrumbs`.
  - At most one glint per anim (`twinkle`).
- **Palette.** `PAL`/`RAMPS` only, ≤ 20 body colours per frame, ≤ 5 tones per material.
  - **Never use `cyan`, `crim`, `teal` or `mag` in a monster body.** The old `grim_warden-kit.ts` `LINING` uses crim; do not reuse it.

  | card | spec ramps |
  |---|---|
  | R2 grim_warden | `void`, `stone` + `PAL.steel`, `leaf3`/`leaf4` soul fire, `earth` |
  | R3 wisp_imp | `mist`/`white`, `void`, `gold` |
  | C6 hollow_ogre | `earth` bark, dark `leaf` moss, `void` hollow and seeds, pale `gold` eyes |
  | C10 mudgrasp_spirit | `earth`, `stone`, `void` |

- **Noise (IŞ-10).** Isolated-pixel share: idle mean ≤ 10 %, body frames ≤ 15 %, effect frames ≤ 20 %.
- **Rigid parts** (cage helm, clay mask, lantern body) move by whole pixels and never rotate fractionally in idle (IŞ-12).

### 4.5 Frame size, budget, weight, points

- **Margins.** ≥ 2 px of empty margin on every frame of every anim (Sİ-2).
- **Feet.** Walker feet never move in idle, guard, toGuard or fromGuard (HA-9). The wisp is a floater (`hover` > 0): `points().feet` stays fixed, the baseline stays within ±1 px, and dx = 0 in transitions (HA-10).
- **KK-13 budget.** `w*h*4*frames` must fit the class budget, ≤ 140 frames and ≤ 8 ms per frame.
  - The auto-class treats **every hand-built v3 art as "ace" (7 MB)**. Gate with an explicit `--class`: grim `large` (5 MB), mud and ogre `medium` (3.6 MB), wisp `small` (2.2 MB).
  - The old 128×116 warden can afford only 84 frames at large. Use a tighter frame, around 112×108.
  - Mud or ogre at about 96×88 can afford about 106 frames.
  - Wisp at 72×62 can afford about 123 frames.
- **Weight.** It sets the contact hit-stop (`src/duel/motion.ts` `MOTION_PROFILES`).
  - ogre: `heavy` (100–130 ms)
  - grim: `heavy` (spec 100 ms)
  - mud: `medium` (60–80 ms)
  - wisp: the spec says 60 ms but `floater` gives 30–40 ms. Either use `mediumLight` with a hover, or call `stopTime` in the strike. Write down which one you chose.
- **Points (HA-25).** `points(anim, f)` gives a position for every frame. Projectiles and threads leave from `muzzle` on `release`.

  | card | points |
  |---|---|
  | grim | `muzzle` = lantern, `staff`/`grip` = spade-halberd, `head` = cage eye |
  | wisp | `muzzle` = face / feather-dart origin |
  | mud | `hand`/`muzzle` = throwing palm |
  | ogre | `muzzle`/`grip` = club head, `hand` = root tip, `core` = hollow |

  Clamp every point above the ground during sink-in summons with `Math.min(groundY, …)`.

### 4.6 Light layer and materials

- **`MONSTER_GLOW`** (`src/view/light/profiles.ts`):
  - grim: `[T(PAL.leaf4,1), T(PAL.leaf3,0.7)]`, plus the eye tone if it is not a body tone, and `spill: PAL.leaf3`
  - ogre: `gold3`/`gold4` eyes, `void3`/`void4` knots
  - mud: `void3`/`void4` eyes
  - wisp: `void4` (plus `gold4` if the eyes use it), **never** `white` or `mist`

  The placeholders list `earth4` and `white`, which floods the bodies. Fix them.
- **Materials.** There is no wood, mud, feather or lantern-glass material. Hand-built rigs can keep local tone sets. A new def must be a draft that passes `tests/art/materials.test.ts`: palette only, strictly increasing luminance, ≤ 5 tones, ring kind in `['bar','fm','flutter','rumble']`.

---

## 5. Card art and cut-in

### 5.1 `CardArtV3` (`src/art/cardart-v3/_types.ts`)

```ts
interface CardArtV3 { id; focus: [x,y] /*BIG px, inside focusBox x12–75 y8–53*/; focusSmall?: [x,y];
  frames?: number; holdMs?: number; big(l: ArtLayers, f): void; small?(l: ArtLayers, f, big: ArtLayers): void; }
// ArtLayers = { size, backdrop, subject, light }  composited backdrop → subject → light
```

- **Kit:** `src/art/cardart-v3/_kit.ts`.
  - `paintBackdrop(l.backdrop, 'DARK' | 'EARTH', { focus, horizon })`
  - `ink(subject)`, `rim(subject, PAL.void3 /*DARK*/ | PAL.earth3 /*EARTH*/, {skip})`
  - `steppedDisc`/`steppedEllipse`/`shape`, `patch(p, rows, key, x, y)`, `reduceSubject`, `recolor`
  - `artStats(l, px, focus, focusIsOwn)`, `renderArt(art, f)`
- **Budgets:** subject fill 0.6–0.75, isolated ≤ 0.1, colours ≤ 20, backdrop colours ≤ 6.
- **Forbidden:** dither, `vgrad`/`rgrad`, `artGlow`, `mix()`, alpha below 255, `bevel()`, `Math.random`. Do not copy anything from `src/art/cardart/index.ts`.
- **Small art must be hand-made.** A missing `small` gives `autoSmall`, which is a draft and does not pass. The face paints over small-art columns x 0 and 43 and rows 0 and 33, so put nothing important there.
- **Check the 16×12 downsample.** That is how the mini card on the field shows it.
- **Model to copy:** `src/art/cardart-v3/crystal_wyrm.ts` (native redraw: polygons → ink → rim; small = approved map + `patch`). Pattern B (EPX of the sprite, then hand-fix) is in `wisp_imp.ts` and `ashen_drake.ts`. The `epx` and `stripOutline` helpers are local copies in those files.
- **What the game reads:** only `smallPx` of frame 0 (`cardArtCanvas`, `src/art/cards.ts` ~571). The big art and the living frames are judged in renders and tests.

**Per-card content** (from the spec):

| card | backdrop | content |
|---|---|---|
| grim | DARK | Warden in graveyard mist, lantern held out toward the viewer as the brightest point (leaf4, light layer), cage-eye light. "L" silhouette. |
| wisp | DARK, eclipse as moon | White and lilac feather ghost peeking out of a heap of feathers. One loose feather in the light layer. Dark face hollow with two dot eyes that must survive at 1× and 16×12. |
| mud | EARTH | Cracked clay mask, mud hands reaching toward the viewer (bleeding off the bottom edge is allowed). Violet eyes in the light layer. |
| ogre | EARTH tones; the spec's "night forest" must use EARTH tones | Glowing hollow with two gold eyes, club set with violet seeds. Two lights that still read as one focus (`brightOff`). |

**Render the big art (no in-game preview).** A scratch script already exists *(untested)*:

```sh
cd /home/user/yugioh && npx vite-node /tmp/claude-0/-home-user-yugioh/77596f6a-069b-5204-8bfc-ba0d0b8509ca/scratchpad/understand/render-cardart.ts -- --id <id> --out <scratch>/cardart/<id>
```

**In-game faces:**

```sh
node tools/shot.mjs "?dev=hatcard&id=<id>&look=v3" --scale 3 --out <scratch>/<id>-card.png
```

### 5.2 Cut-in (grim_warden only)

```ts
import type { CutinFactory } from '../cutins/index';
const f: CutinFactory = (kit) => ({ id:'grim_warden', w:200, h:144, frames:6, fps:10, accent: PAL.leaf4, accentDark: PAL.leaf2,
  holds:[260,120,100,100,160,620], p2:'relight', draw(p, frame, o) { /* lightOf(o?.lightFrom) banding; p.outline(PAL.ink); then light pass */ } });
export default f;
```

- **Size.** Keep it 200×144 (k = 1). Never draw small and enlarge.
- **Kit.** Avoid `kit.glow`, `dissolveRows` and dithered `Mat`s.
- **Lens glint.** `findEye` scans **f0** for the brightest pixel with luminance ≥ 0.6, in the top 45 % and right 60 % of the bounding box. Make the cage eye's white core the clear winner, or keep the lantern out of that region on f0. Check with `&eyes=1`.
- **Playback.** The cut-in only plays as the v3 band (`cutInV3`, ≤ 900 ms) when the summon runs through `runSummon`, where `S.climax()` fires once on `ace && tribute`. Today grim falls to `_defaults/summon.ts`, which plays the old 1.55 s v1 `cutIn`.
- **Rewrite the old file.** The current `cutins-v3/grim_warden.ts` imports `LINING`, `bolt` and `fork` from the old kit and fx files. Rewrite it in the same change as the rig.

---

## 6. Cinematics

### 6.0 API and chain (`src/cinematics/api.ts` → `_core/registry.ts`)

```ts
registerEvent(type, handler, { priority?, name? })        registerCardHook(cardId, kind, handler, opts?)
registerStrike(monsterId, (s: StrikeArgs) => Promise<void>, opts?)    registerObserver((ev, ctx) => void)  // sync bookkeeping
fx.*  (re-export of _core/helpers)
```

- **Chain order.** Higher priority runs first. At equal priority, card hooks run before event handlers, and the later registration first. `await ctx.base()` runs the next handler.
- **Priorities in use:** defaults −100; per-card, battle and b2 files 0; recipe layer 10 (only if `src/presentation/cards/<id>.ts` exists).
- **If you add a recipe file** (for the grim rhythm), either set `custom: { summon:true, strike:true, death:true, flip:true, effect:true }` or register your hooks at `{ priority: 20 }`.
- **Hook kinds** (`Director.hookKeys`, `_core/Director.ts:403-451`):

  | event | hook kind |
  |---|---|
  | summon | `summon` |
  | tribute | `tribute` (by summoned card), then `tributed` |
  | battle | `attack` (attacker), `defend` (target) |
  | activate | `effect` when `kind:'monsterEffect'` |
  | destroy | `destroyed` (victim), `destroys` (source) |
  | statChange | `statChange` |

  **`banish` and `positionChange` have no card hook.** They are reachable only through `registerEvent`.
- **Context** (`_core/types.ts`):
  - events: `ctx.ev`, `ctx.index`, `ctx.events`, `ctx.state` / `stateNext`
  - lookups: `ctx.cardId(uid)`, `ctx.unit(uid)`, `ctx.locate(uid,'next')`
  - queue: `ctx.findType(type, pred, {from, until})`, `ctx.consumeAt(i)`, `ctx.play(i, hints)`
  - persistence: `ctx.keep(key, Disposable)` / `ctx.take(key)` survive into the next batch only while `after.pending` is set
  - views and sound: `ctx.views.field`, `ctx.sfx`
- After every event the Director syncs views to the projected state. Anything you animate but do not consume is replayed by the default handler.
- **Camera rule (EF-8).** No new `ctx.focus`, close-up or zoom. `measure --camera-gate` requires `focusCalls` equal to the base and `zoom.max = 1`. Do not copy `ctx.focus` from the old magma_titan file.

### 6.1 Summon

Build on `src/cinematics/summon-a/_kit.ts`:

```ts
export async function runSummon(ctx: SummonCtx, entrance: (S: Stage) => Promise<void>, v3Entrance?: (S: Stage) => Promise<void>): Promise<void>
export function signatureSummon(id, entrance, o?: { v3?: (S: Stage) => Promise<void> }): void   // NOT look-gated itself
```

- `runSummon` slams the card (skipped with `hints.noCard`, which the tribute flow passes), calls `field.addUnit(..., {hidden:true})`, builds the `Stage`, and runs `v3Entrance` only if `LOOK_V3 && unit.has('summon')`. It always heals the unit at the end.
- **Stage members:** `scene, unit, sprite, home, player, dir, ace, big, tribute, cutIn, ramp, pose({onLand,onPeak,ramp,hologram}), climax(), roar(), finale(), openCircle(), glow(), own(), wait()`.
- **Wiring:**

```ts
if (LOOK_V3) registerCardHook('grim_warden', 'summon', async (ctx) => {
  if (ctx.ev.from === 'field') return ctx.base();
  await runSummon(ctx, async (S) => { /* fallback without pose */ }, graveRiseV3 /* S.pose(...) + await S.climax() on peak */);
}, { priority: 20, name: 'kart-b:grim_warden:summon' });
```

- **Tributes.** `summon-a/tribute.ts` (registerEvent `'tribute'`) handles the tribute streams, then `ctx.play(summonIdx, { tribute:true, noCard:true })`.
- **References:** `summon-a/crystal_wyrm.ts:406` and `summon-a/abyss_magus.ts:364` (signatureSummon with a `v3` entrance), `_v3/summon.ts` `poseEntrance`.
- **Sounds.** Play `arrive` with `start()` and stop it on `land` yourself. Play `roar` on the peak. Under v3 the cut-in plays `voice.roar` on the eye flare.

### 6.2 Attack (strike)

```ts
registerStrike('hollow_ogre', (s) => (LOOK_V3 ? clubV3(s) : s.base ? s.base() : Promise.resolve()), { name: 'kart-b:hollow_ogre:strike' });
// StrikeArgs: ctx, scene, attacker, target|null, to, toGround, direct, blocked, power 1|2|3, impact(at?), impacted, base?
```

- **Model:** `strikes-a/crystal_wyrm.ts:937` (`prismBreathV3`). For grim and wisp, which exist in v1, the v1 branch must reproduce today's behaviour exactly. Either `s.base?.()` or a check that no v1 strike existed before.
- **Steps inside the strike:**
  1. Start from the declaration hold: `strikeStartFrame(u)` (`_v3/clash.ts:132`).
  2. Play `u.playRange('attack', f0)` and read marks with `u.markFrame('attack','release'|'contact'|'recover', fb)`.
  3. Call `s.impact()` **once**, on the contact frame. Resolve when the attacker is home.
- **Around the strike,** `battleV3` (`battle/battle.ts:355`) handles reactions, the impact number on contact, the death 150 ms after contact, and battle triggers.
- **Hit reactions** come from the struck art's hit, hitHeavy, hitMagic, guard and toGuard poses, plus its weight and material. You do not register them per card. A full custom reaction is a `'defend'` hook (rarely needed). mudgrasp, as a wall, needs strong guard and toGuard poses because `reactGuard` and `guardbreak.ts` use them.

### 6.3 Death

**Option (a), preferred when a final shatter fits.** Draw the unique ending into the sprite `death` anim and call `deathV3`:

```ts
if (LOOK_V3) registerCardHook('hollow_ogre', 'destroyed', (ctx) => {
  if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();   // strikes-b/_kit.ts:383
  return deathV3(ctx, { fallback: () => ctx.base(), onBurst: (u, at) => { /* last sprout withers */ } });  // _v3/death.ts:282
}, { priority: 20, name: 'kart-b:hollow_ogre:death' });
```

`deathV3` claims the `toGraveyard`, plays the death pose, starts the preset accent at `dissolve`, and ends in the material shatter on the last frame. It plays the `soundsOf(id)` roles `deathStart`, `dissolve`, `afterDissolve` and `burst`.

**Option (b): no shatter.** Use this for mudgrasp (flows back into the tile) and grim (empty shroud collapses). Copy the bookkeeping from `deathV3` (`_v3/death.ts:282-340`) or `strikes-a/_kit.ts:762` `flavoredDeath`:

```ts
const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid,
  { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange' });
if (gi >= 0) ctx.consumeAt(gi);
const { tile } = field.release(ev.uid); unit.badge.setVisible(false); unit.posed = true;
ctx.scene.events.emit('v3:dying', unit);
// ... your animation ... call (ctx.hints as {onBorn?}).onBorn?.() when the card is born
await cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, unit) });  // _v3/card.ts:79,194
unit.retire(); field.forget(ev.uid); ctx.scene.events.emit('v3:dead', unit);
```

Budget: destruction ≤ 1.4 s scene time (≤ 2.03 s game time). Endings must not collide (§5.2): stone/ash belongs only to R1 and stone_sentinel.

### 6.4 Effect events for our four cards

Every effect starts with this event (`engine/rules.ts:873`):

```ts
{ type:'activate'; player; uid; cardId; kind:'monsterEffect'; from:'monster'|'graveyard'; zone: number|null }
```

---

**grim_warden: `declareAtkDebuff400`** (`rules.ts:1804`; `query.ts:266` sets `targetDebuffBy`)

- **When:** only when the target is face-up in **attack** position with ATK > 0. A defense or face-down target, a direct attack, or a negated attack (`attackNegated`) produces no activation.
- **Order:** the activation is emitted after the trap window and **before** `battle`.

  ```
  attackDeclare → [decision(trapResponse) | batch 2: responseDeclined] → activate(grim) → battle(targetValue already −400) → damage? → destroy? → toGraveyard?
  ```

- **Hook:** `registerCardHook('grim_warden','effect', …)`.

  ```ts
  const bi = ctx.findType('battle', (e) => e.attackerUid === ctx.ev.uid);
  const tUid = (ctx.events[bi] as EvOf<'battle'>).targetUid;
  const hold = ctx.take('attack');                       // declaration AttackHold
  dropCharge(attackerUnit, 120);                          // the held charge sound would drone under the 1.4 s siphon
  await u.asClaimant(() => u.playRange('special', 0, undefined, { hold: true }));
  // thread from u's muzzle (lantern) to target; at the drain beat: showBattlePlates(ctx-like, attacker, target)  (battle/plates.ts:21)
  holdFrame(u, 'attack', declarePoseFrame(u));            // summon-a/_kit.ts:130 or battle/_kit.ts:176; clash.ts:120
  if (hold) ctx.keep('attack', hold);                     // or the strike restarts from frame 0
  ```

- **Shared-file issue.** `battle/declare.ts:374` already calls `showBattlePlates`, which shows the −400 at declaration, before the trap window. R2 wants the drop at the drain. That needs a small coordinated change in `plates.ts`/`declare.ts`: skip the target debuff at declaration when the attacker's effect is `declareAtkDebuff400`.
  - Use `showBattlePlates` rather than `u.setStats`, because only it adds the unit to `tinted`, so `restoreBattlePlates` rolls it back.
  - If the shared change is refused, the drain must instead visually "justify" an already-dropped badge. Record the choice in `oturum-b.md`.
- **"Lantern keeps the colour until end of turn":** a `setAura('grimLantern', …)` cleared by an observer on `turnStart` (§6.5).

---

**wisp_imp: `noBattleDamageOnDestroy`** (`rules.ts:1795-1811`)

- **When:** only when damage > 0 would hit the wisp's controller **and** the wisp really dies (a guardian_charm save does not count).
- **Order:** there is **no `damage` event**.

  ```
  battle → activate(wisp, player = wisp's controller) → destroy(wisp,'battle') → toGraveyard
  ```

- **Prevented amount:** not in the event. Compute it from the battle event:

  ```ts
  const b = ctx.events[ctx.index - 1] as EvOf<'battle'>;
  const prevented = Math.abs(b.attackerAtk - (b.targetValue ?? 0));
  ```

- **Pitfall.** `isBreak` (`battle/battle.ts:66`) stops the battle's consequence scan at the `activate`. So `battleV3` does **not** take the wisp's death on the contact frame: the hit reaction is non-lethal and springs back. The death plays later via `fx.playBattleTriggers`, which runs the activation and then the destroy.
  - Make the effect hook own the death: `const di = ctx.findType('destroy', e => e.uid === ctx.ev.uid); … await ctx.play(di, { pillow: true, hit: false });`.
  - The `'destroyed'` hook branches on `ctx.hints.pillow` (the cushion burst and "pof") versus no hint (killed in defense: no event, feathers in the wind, **no pof**).
  - The alternative, a one-line `isBreak` exception in `battle.ts` (shared), needs orchestrator approval.
- **Picture:** feathers fly to `fx.lpPoint(ctx, ctx.ev.player)` and cushion the LP panel. `impactNumber(scene, x, y, prevented, …)` (`_v3/number.ts:67`) squashes to "0 · KORUNDU".

---

**mudgrasp_spirit: `defenseAttackedPin`** (`rules.ts:1823` queues the task; `mudPin` at `rules.ts:1057`)

- **When:** the target was in defense (face-down included; a face-down mud first gets `flip(cause:'attacked')` before `battle`). It resolves **even if mudgrasp died**.
- **Order:**

  ```
  battle(targetPosition:'defense') → [damage(pierce)] / [destroy(mud) → toGraveyard]
  → activate(mud, from:'monster'|'graveyard', zone|null)
  → positionChange{ player: attackerCtrl, uid: attackerUid, zone, position:'defense' }   // only if attacker was face-up ATK
  ```

- **State only:** `lockPositionTurn = turn + 2`. There is **no lock event**. `plateLock` (`engine/query.ts:296`) makes the attacker's badge show the gold padlock (`'kneel'`) automatically in v3, through `FieldView.sync` → `u.setLock`.
- **Hook:** `registerCardHook('mudgrasp_spirit','effect', …)`.
  1. Find the attacker by scanning back for the last `battle` with `targetUid === ctx.ev.uid`.
  2. `const pi = ctx.findType('positionChange', e => e.uid === attackerUid)`.
  3. Run your 1.6 s grab, then either `ctx.consumeAt(pi)` and turn the attacker yourself (toGuard pose, `unit.setPosition('defense', true)`, tile rotate), or `await ctx.play(pi)` for the generic turn.
- **If you neither consume nor play it,** `positionV3` (`summon-b/position.ts:119`) plays it afterwards. `positionChange` is not in `TRIGGER_RUN` (`_core/helpers.ts:623`).
- `ctx.unit(ctx.ev.uid)` may be null if mud died. Fall back to `zoneXY(player,'monster',zone)` or the last known spot.
- The persistent mud ring is an aura (§6.5).

---

**hollow_ogre: `banishGraveBoost400`** (`rules.ts:948-1012`)

- **Trigger:** action `{type:'activateMonster', player, zone}` in the main phase, face-up.
- **Graveyard has ≤ 1 monster:** one batch.

  ```
  activate(ogre) → banish{owner, uid, cardId, from:'graveyard', sourceUid: ogreUid} → statChange{uid: ogre, atk, def, prevAtk, prevDef}
  ```

- **Graveyard has ≥ 2 monsters:** two batches.
  - Batch 1: `activate(ogre) → decision{pending:{kind:'chooseCount', player, sourceUid, min:1, max:2}}`.
  - Batch 2, after `{type:'chooseCount', player, n}`: `banish × k → statChange(+400·k)`. **No activate in batch 2.**
- **Which cards:** the k **oldest** graveyard monsters (`graveyard.filter(isMonster).slice(0,k)`), not the top card.
- **Pattern:**
  1. In the `'effect'` hook, start the reach and anticipation and `ctx.keep('ogre:reach', handle)`. It survives into batch 2 because `pending` is set.
  2. One `registerEvent('banish', …, {priority: 1})` handler takes over:

  ```ts
  if (LOOK_V3) registerEvent('banish', async (ctx) => {
    const src = ctx.ev.sourceUid;
    if (src === null || ctx.cardId(src) !== 'hollow_ogre') return ctx.base();
    const group = [ctx.index];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (e.type === 'banish' && e.sourceUid === src) { group.push(i); ctx.consumeAt(i); } else break;
    }
    const si = ctx.findType('statChange', (e) => e.uid === src);
    const reach = ctx.take('ogre:reach');            // null in the single-batch path
    // per seed: graveyard pile → seed arc → root tip → knot light (+400 tick); then ctx.play(si) or consumeAt(si) + own badge roll
  }, { priority: 1, name: 'kart-b:hollow_ogre:banish' });
  ```

- **Views:** `ctx.views.field.pile(owner,'graveyard')` → `PileView { set(count, top), topXY(), bump(), count }`. A board slot exists at `zoneXY(p,'banish',0)` but there is **no banish pile view**.
- **Missing from `fx.resolutionRun`:** `banish` and `positionChange` are not collected there.

### 6.5 Persistent status visuals (mud ring, grim lantern colour)

- **Aura slots:** `MonsterUnit.setAura(key, Disposable|null)` (`MonsterUnit.ts:1080`). They are destroyed on retire. Custom keys are not reconciled by `FieldView.sync`: a unit rebuilt by sync loses them.
- **Model:** `src/duel/auras-v3.ts` `flameAuraV3`.
- **Expiry:** nothing expires auras for you. Clear them with an observer:

```ts
const pinned = new Set<number>();
if (LOOK_V3) registerObserver((ev, ctx) => {
  if (ev.type !== 'turnStart' && ev.type !== 'phaseChange' && ev.type !== 'controlChange' && ev.type !== 'destroy') return;
  for (const uid of [...pinned]) {
    const loc = ctx.locate(uid, 'next');
    const slot = loc && ctx.stateNext.players[loc.player].monsters[loc.index];
    if (!slot || slot.lockPositionTurn === undefined || ctx.stateNext.turn > slot.lockPositionTurn) { ctx.unit(uid)?.setAura('mudPin', null); pinned.delete(uid); }
  }
});
```

### 6.6 Determinism

- Seed every random stream per uid; `runSummon` calls `seed(uid*31+zone*7+player)`.
- Reset module-level streams in `src/duel/seeds.ts` `onDuelStart`. Otherwise `--fresh` films and `measure` drift.
- Card-art and cut-in painters must never use `Math.random`.

---

## 7. Sound

### 7.1 Wiring (hand-made route; the preset-palette route is closed)

- `voice: VoicePreset` palettes other than `'rumble'` fail `tests/presentation/recipes.test.ts` and `voices.test.ts`.
- **A `CHARACTER_SOUNDS[id]` entry alone is enough.** `soundsOf(id)` falls back to it when there is no recipe.
- **Model to copy:** `src/audio/v3/dawn.ts` (one file with `V3_DAWN_RECIPES`, typed `Recipe` from `../sounds`, built from `./kit` blocks and `Voice` primitives).

```ts
// src/audio/v3/hollow_ogre.ts
import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';   // TYPE-ONLY (runtime import = cycle)
import { midiHz } from '../synth';
import { crack, puff, sweep, thump } from './kit';
export const HOLLOW_OGRE_RECIPES = {
  ogreCrush: { cap: 2, gap: 0.05, verb: 0.35, duck: 0.6, play(v) { thump(v, 0, 140, 52, 0.5, 0.25); crack(v, 0.01, 0.2, { n: 3 }); } },
  ogreKnot:  { cap: 6, gap: 0.008, verb: 0.3, duck: 0.25, play(v) { /* hollow 300–600 Hz ring */ } },
  // ...
} satisfies Record<string, Recipe>;
export type HollowOgreSfxName = keyof typeof HOLLOW_OGRE_RECIPES;
export const HOLLOW_OGRE_VOICE = { roar:'ogreClubSlam', arrive:'ogreLogFall', land:'ogreStake', charge:'ogreClubLift',
  release:'ogreSwing', impact:'ogreCrush', dissolve:'ogreRootsRetract', burst:'ogreCollapse',
  reviveGather:'ogreReviveGather', reviveLand:'ogreReviveLand' } satisfies CharacterSounds;
```

- **Required roles:** every `CharacterSounds` role except `swing`, `deathStart` and `afterDissolve`, **including the revive pair**, because soul_recall can revive any card.
- `kart-b.ts` spreads all four recipe sets and maps `KART_B_VOICES = { grim_warden: GRIM_WARDEN_VOICE, … }`.
- Then add the three one-line shared edits from §2.

### 7.2 Kit blocks (`src/audio/v3/kit.ts`)

`glassBell`, `glassReverse`, `glassRain`, `crack`, `thump`, `puff`, `sweep`, `clank`, `link`, `drone`, `growl`, `scaled`, `BAR_MODES`, plus the `Voice` primitives in `src/audio/synth.ts`. **Write no new DSP files** (SE-3).

Recipe fields: `{verb, cap(4), gap(0.02 s), duck, vary, play(v)}`. Duck big beats ≥ 0.55 and small ones ≤ 0.3.

### 7.3 Who fires what

| role | fired by |
|---|---|
| `charge` | **`battle/declare.ts:413`** (`holdCharge`) for **every** v3 card with a voice. Taken over by `takeCharge(u, name, opts)` only within 320 ms. |
| `impact` | Your strike. Once a voice exists, `_v3/react.ts strikerScores()` **stops playing the generic impact**. |
| `roar` | `_v3/cutin.ts` eye flare (ace) |
| `deathStart`, `dissolve`, `afterDissolve`, `burst` | `_v3/death.ts` (option-a deaths) |
| `reviveGather`, `reviveLand` | `spells/soul_recall.ts` |
| everything else | your cinematic: `atFrame(u, anim, f, cb)`, `atMark(u, anim, mark, cb, {fallback})`, `start(name,{pan})` → `h.stop(ms)`, `play(name,{volume,pan})`, `panAt(x)`, `hush([...], fn)`, `quietCombat(fn)`, `dropCharge(u, ms)`, all from `src/cinematics/_v3/sound.ts` |

- **Ship the voice entry in the same change as the strike and death cinematics.** Otherwise contacts go silent and charges are left hanging.
- **One recipe per synced beat, fired on its own frame.** Recipe internals run in real time and do not follow tempo, speed or hit-stop.
  - Sustained sounds: `start()`, write them longer than the picture, and `stop()` on the end mark.
  - `pitch` also changes duration.
  - Repeated micro-beats need `gap: 0.005–0.01` and `cap ≥ 6`: the wisp's 6 jabs, the ogre's per-seed sounds. Otherwise they are dropped at 3×.
- **Idle SFX:** the spec asks for them, but **no infrastructure exists**. It would mean a new per-unit `animationupdate` listener: sparse, very quiet, v3 only, and it shifts measure `sfx[]`. Raise it with the orchestrator before building.
- **Struck-body hits on wood (C6) and mud (C10)** have no generated material sound (`GENERATED_HIT_MATERIALS` is pinned to `['stone']`). They fall back to the generic sound unless the orchestrator approves a change. Your own `impact` accent still carries the identity when your card is the striker.

### 7.4 Ownership (§5.1), so nothing collides

| card | identity | must avoid |
|---|---|---|
| R2 grim_warden | Pendulum-chain creak (`link`, slow and periodic, not a rattle). **Sole owner of `glassReverse`, descending.** Lantern glass in a darker key than the wyrm's E-major pentatonic. | Idle `drone` not on D/G# saw-tritone (the magus). Helm `clank` away from ratio 1.41 at 470–760 Hz. |
| R3 wisp_imp | 5 kHz feather rustle, formant "uu". **The game's only pillow "pof"**, on the event path only. | Wind path without pof. Not C8's "fuff", not straw rustle. |
| C10 mudgrasp_spirit | 600 Hz suction "şlop". **Owner of the slow `growl` moan** (low grit, own formants). | Glubs lower and thicker than the A5 spring bubbles and C8's frogs. Death is liquid draining, never dry crumble or a 28 Hz swell. |
| C6 hollow_ogre | 180 Hz wood creak. Knot "tok" as a hollow 300–600 Hz ring. | Not S1's ratchet, not S9's dry stake click, not the stone-grind rumble palette. Seed whistle distinct from C3's wind ring. |

### 7.5 Offline checks (agents cannot hear)

```sh
node tools/shot.mjs "?dev=audio&page=one&name=ogreKnot&log=1" --out <scratch>/ogreKnot.png
#   waveform + spectrogram + stats; an unknown name silently falls back to roarBig — check the title
node tools/clip.mjs "?dev=duel&s=hoEat2&look=v3" --music off --marker ogreKnot --out shots/v3/kart-b/clips/hoEat2.mp4
#   writes .mp4 + .wav + .json; peak ≤ −1 dBFS, 0 clipped; send the MP4 to the user (KK-12)
```

- `measure.mjs` `sfx[]` lists `play()` calls only, not `start()` voices.
- The SE-4/SE-5 separation scripts are not in the repo. Write a numpy 1/3-octave comparison over the WAVs in the scratchpad if you need one.

---

## 8. Scenarios and filming

### 8.1 Writing scenarios (`src/duel/scenarios.ts`, `src/duel/scenario.ts`)

```ts
import type { Action, CardId, PlayerId } from '../../engine/types';
import type { Scenario, Step } from '../scenarios';
const attack = (az: number, tz: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone: az, targetZone: tz });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: tributes.map((t) => D.uid(t, player)) });
export default {
  mgPin: { desc: 'ember_wolf attacks defending mudgrasp: blocked + pin',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'mudgrasp_spirit', position: 'defense' }] } },
    steps: [attack(0, 0)] },
} satisfies Record<string, Scenario>;
```

- **Stage options:** `MonSpec = id | {id, position?, faceUp?(true), enteredTurn?, attacks?, posChanged?}`. Monsters default to `enteredTurn = turn−1`, so they can attack.
- **Graveyard:** index 0 is the oldest card, which is what the ogre eats first. There is no `banished` field.
- **Steps:** an `attack` step needs `phase:'battle'` or a preceding `{type:'enterBattle'}`. Uids must come from the function form `(D) => …`.
- **Ogre steps:** `{type:'activateMonster', player:0, zone:1}` then `{type:'chooseCount', player:0, n:2}`.
- **Lanes:** 3-zone stages are auto-centred onto the 5-lane board. Do not mix in indices 3–4 (any array longer than 3 disables the shift), or use `zones:5` explicitly as `b2.ts` does.
- **Stats:** crystal_wyrm 2800, abyss_magus 2300, magma_titan 2100, ember_wolf 1700, reed_heron 1400, stone_sentinel 500/2100, grim 2500/1200, wisp 300/200, mud 700/1800, ogre 1400/900.

**Scenario keys to build** (each needs P1 and P2, KK-7/8):

| card | keys |
|---|---|
| grim_warden | existing `gwSummon(P2)`, `gwAttack(P2)`, `gwHit`, `gwKill(P2)`, `gwGuard`, `m1Debuff`. Add `gwDrainSurvive` (vs crystal_wyrm + `dragon_blade` equipped), `gwNegated` (chains_of_light: no drain), `gwFaceDown` (no event), `gwDirect`. |
| wisp_imp | `m1Imp` exists. Add `wiSummon(P2)`, `wiCushionAtk(P2)` (ember_wolf attacks an ATK-position wisp: 1400 prevented), `wiDefDies` (no event: wind), `wiDirect`, `wiGuard`. |
| mudgrasp_spirit | add `mgSummon(P2)`, `mgSet`, `mgPin(P2)`, `mgPinFlip` (face-down), `mgPinKill` (crystal_wyrm: mud liquefies **and** the pin resolves), `mgPinLock` (+ two `endTurn`: the aura persists and then clears), `mgAttack`, `mgKill`. |
| hollow_ogre | `b2Ogre` has no steps. Add `hoSummon(P2)`, `hoEat2` (graveyard `['ember_wolf','storm_hawk','judgment_bolt']`, activate + chooseCount 2), `hoEat1Prompt`, `hoEat1Auto` (one monster: no prompt), `hoEatAttack` (2200 vs heron), `hoEatP2`, `hoAttack`, `hoKill`. |

### 8.2 Filming (`tools/shot.mjs`). Always use `--fresh`, always `&look=v3`, always READ the PNG.

```sh
node tools/shot.mjs "?dev=duel&s=gwSummon&look=v3" --fresh --film 32 --every 160 --cols 8 --out shots/v3/kart-b/grim/gwSummon.png
node tools/shot.mjs "?dev=duel&s=gwAttack&look=v3" --fresh --film 24 --every 120 --cols 6 --out shots/v3/kart-b/grim/gwAttack.png
# contact zoom, every game frame (find --start from measure contactMs):
node tools/shot.mjs "?dev=duel&s=gwAttack&look=v3" --fresh --film 12 --every 17 --start 1500 --clip 220,90,200,140 --scale 3 --cols 4 --out shots/v3/kart-b/grim/contact.png
# frames for palcheck:
node tools/shot.mjs "?dev=duel&s=mgPin&look=v3" --fresh --film 120 --every 17 --frames shots/v3/kart-b/mud/mgPin-frames --out shots/v3/kart-b/mud/mgPin-all.png
```

- Game time is about 1.35× scene time at the v3 tempo. `&tempo=1` gives the pre-tempo speed; `&speed=2|3` checks SÜ-3.

**Sheets** (always pass `--out`; the default writes into the repo):

```sh
npx vite-node tools/monster-sheet.ts --id <id> --look v3 --anims all --scale 3 --points --out <dir>
npx vite-node tools/monster-sheet.ts --id <id> --look v3 --anims all --scale 3 --points --p2 --out <dir>-p2
npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/_<id>.ts --look v3 --anims all --scale 3 --out <dir>
#   drafts / excluded wisp; outputs <id>-v3[-p2]-<anim>.png, -all.png, .json
node tools/shot.mjs "?dev=monster&id=<id>&look=v3&mode=board" --out <png>          # 1× scale check on tiles
node tools/shot.mjs "?dev=cutin&look=v3&id=grim_warden" --film 12 --every 80 --cols 4 --out <png>   # also &sheet=1, &player=2, &eyes=1&frame=0
```

- `?dev=monster` sheet mode shows **only the base 5 anims**. Live mode flips P1 but does not relight it, and it shows only registered arts.

---

## 9. Gates and thresholds

**Before touching any cinematic,** take the camera base and the card-hash baselines. **No camera base exists in this checkout.**

```sh
node tools/measure.mjs --look v3 --scenarios 'gw*,m1Debuff,m1Imp,b2Ogre,b2WipeAuto' --jobs 2 --out <scratch>/camera-base.json
npx vite-node tools/card-hash.ts --look v1 --out <scratch>/ch-v1-before.json
npx vite-node tools/card-hash.ts --look v3 --out <scratch>/ch-v3-before.json
```

New keys are reported NOBASE, which checks zoom and close-ups only. You can re-base them on the placeholder cinematics as soon as the scenario exists.

| Gate | Command | Pass |
|---|---|---|
| Types | `npm run typecheck` | clean (ignore files you do not own) |
| Tests | `npm test` | no new failures. Known failures: dusk_ashen, hourglass_imp, shield_titan. Rewrite `tests/art/grim_warden.test.ts` (it pins the old blade: contact 6, bbox ≥ 90×83, muzzle x > 105). Extend `wisp_imp.test.ts`; add `hollow_ogre.test.ts` and `mudgrasp_spirit.test.ts`. |
| v1 identical | `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` and `--set a6v1 --base shots/v3/a56/baseline/a6v1films` | 17/17 and 26/26 IDENTICAL |
| Camera | `node tools/measure.mjs --look v3 --scenarios '…' --out now.json --camera-gate <scratch>/camera-base.json` | `zoom.max = 1`, `closeUpCalls = 0`, `focusCalls` equal to the base, `maxScrollPx` within ±1 frame. Exit 3 = fail. |
| Palette | `node tools/palcheck.mjs <frames-dir> --every 17 --clip x,y,w,h` | a5 rules: Δoff ≤ 1 pt, off ≤ 50 %, white ≤ 1.5 %, rowWhite ≤ 60 %. Exit 2 = fail. |
| Sprite gates | `npx vite-node tools/monster-gates.ts <dir>/<id>-v3.json <dir>-p2/<id>-v3-p2.json --class large\|medium\|small --ref none` | see the KK-3 to KK-13 list below. Exit 0 = pass, 2 = fail. |
| validateArt | in the card's test: `validateArt(art, 'normal')` | no errors |
| Contact on screen | `node tools/contact-probe.mjs --scenarios gwAttack,gwKill,mgPinKill,hoEatAttack --png <dir> --out <json>` | screen ≤ sheet + 5 points |
| Sameness (KK-15) | `npx vite-node tools/sameness.ts --look v3 --ids <id> --against all --out <dir>` (use `--art` for drafts) | KEY < 0.62, MOTsig < 0.55, MOTloop < 0.65, MOTavg < 0.45, SI < 0.35. A UYARI needs a distinction header comment plus a blind test. Closest pairs to watch: ogre × thorn_lurker and the bipeds, grim × abyss_magus and steel_silencer, wisp × lumen_sprite, mud × thorn_lurker. |
| Card hash | `card-hash --look v1 --compare before` must be identical; `--look v3 --compare` with `--allow` limited to our 4 ids | `deterministic: true` |
| Card face | `npx vitest run tests/art/cardface-v3.test.ts` | pass |
| Budgets (by hand from measure JSON) | `node tools/measure.mjs --scenarios 'gw*,wi*,mg*,ho*,m1Debuff,m1Imp' --look v3 --out m.json` | see the budget table below |

**Sprite-gate rows** (`monster-gates`):

- **KK-3:** margin ≥ 2 and edge px 0; HA-14 out ≤ 1.2; HA-15 in ≤ 2.0; HA-16 seam ≤ 1.4; HA-17 idle max Δ ≤ 1.8 × idleΔ; HA-18 liveliness ≥ 15 %; HA-19 guard Δ 0.3–0.8 × idleΔ; HA-20 to/fromGuard when needed; IŞ-10 noise.
- **KK-4:** hit\* and death f0 differ from **every** idle frame by < 50 % (HA-21 phase). Keep idle motion local.
- **KK-5:** feet (HA-9) or floater feet (HA-10).
- **KK-6:** marks and muzzle on every frame.
- **IŞ-1:** lit bias in both views.
- **KK-13:** frames ≤ 140, ≤ 8 ms per frame, bytes within the class budget.

**Budgets** (REHBER §5 × 1.45 game clock; check `events[].dur`, `busyToInputMs`, `numberAfterContactMs` by hand):

| event | game-clock limit |
|---|---|
| attack on a monster | ≤ 3.19 s |
| direct attack | ≤ 2.32 s |
| declaration | ≤ 0.435 s |
| ace tribute summon with cut-in | ≤ 4.35 s |
| death | ≤ 2.03 s |
| monster effect | ≤ 2.32 s |
| flip | ≤ 0.87 s |
| position change | ≤ 0.58 s |
| cut-in | ≤ 0.9 s scene |
| number vs contact | ±17 ms |

The spec storyboards are longer than these limits: grim summon 3.8 s and attack 2.8 s; ogre 0.8 s + k × 0.7 s. Fit them inside, or justify the overrun in `oturum-b.md`.

**Sheet hash:** `sheet-hash --look v3` will report grim_warden changed. That is expected; note it in `oturum-b.md`.

---

## 10. Pitfalls (consolidated)

1. **New `monsters-v3/<id>.ts` files register immediately** and appear in other lanes' films and the sheet hash. Draft as `_<id>.ts`.
2. **wisp_imp stays invisible in v3** until its exclusion entry is removed. Use `--art` until then.
3. **Rewriting the grim and wisp rigs breaks importers.**
   - `cutins-v3/grim_warden.ts` imports the old kit and fx (`LINING`, `bolt`, `fork`).
   - `cardart-v3/grim_warden.ts` crops the old sprite geometry.
   - `cardart-v3/wisp_imp.ts` imports `drawWisp, pose, CX, CY, W, H, paintFeather` from `-rig`.
   - `tests/art/grim_warden.test.ts` pins the old geometry.

   Rewrite them all in one change.
4. **Never use `crim`, `cyan`, `teal` or `mag` in bodies.** That includes the old `LINING`.
5. **Fix the `MONSTER_GLOW` placeholders.** `earth4` and `white` are body tones and flood the halo.
6. **`DEATH_PRESETS` mudgrasp is `'stone'`.** That contradicts the liquid ending and the reserved stone ending.
7. **KK-13 auto-classes hand-built v3 art as ace.** Always pass `--class`.
8. **`signatureSummon` is not look-gated.** Gate it for grim and wisp, which exist in v1.
9. **Recipe files register at priority 10.** If you add `presentation/cards/<id>.ts`, use priority 20 or `custom`.
10. **grim's −400 shows at declaration** (`declare.ts:374`). Retiming it needs the shared `plates.ts` change. Re-`keep('attack', hold)` after the siphon, or the strike restarts from frame 0. `dropCharge` at the siphon start, or the charge drones on.
11. **wisp's death is not taken at contact** (`isBreak`). The effect hook must `ctx.play(destroyIdx, {pillow:true})`. Pof only on that path.
12. **mudgrasp's `positionChange` is replayed generically** unless you consume or play it. Mud may already be dead (`from:'graveyard'`, `unit` null). The lock has no event; the padlock badge is automatic.
13. **The ogre's banish has no card hook and is split across two batches** when the player chooses a count. Use `registerEvent('banish', …, {priority:1})` with `ctx.keep`/`ctx.take`, and gather all banishes plus the statChange. Do not edit `b2/placeholders.ts`.
14. **No new `ctx.focus` or zoom.** `focusCalls` must equal the base.
15. **Card-art borders** (x 0/43, rows 0/33) are covered by the face. `autoSmall` is a draft. Only `smallPx` f0 is shown in the game.
16. **Cut-in glint:** f0, upper-right region. Do not let the lantern outshine the cage eye.
17. **Recipe timing is real time, triggers are show time.** One recipe per beat. Small `gap` for repeated beats.
18. **Adding `CHARACTER_SOUNDS[id]`** turns off the generic impact and turns on the declaration charge. Ship it with the strike.
19. **Idle SFX and wood/mud struck-hit materials** need orchestrator decisions. Ask before building.
20. **Always pass `--out` to a scratch or `shots/v3/kart-b` path.** Read every PNG.

---

## 11. Reference implementations to copy from

| Need | Path |
|---|---|
| Hand-built ace rig (shell / rig / anims / maps split) | `src/art/monsters-v3/crystal_wyrm*.ts`, `abyss_magus*.ts`, `steel_silencer*.ts` |
| Rigkit grammar / body plan | `src/art/rigkit/{pose,anim,validate,light,raster,maps}.ts`, `src/art/bodyplans/biped`, `monsters-v3/stone_sentinel*.ts` |
| Floater framework, feather painter | old `src/art/monsters-v3/wisp_imp-rig.ts` (`paintFeather`, whole-pixel ellipse, `Burst`), `wisp_imp-anims.ts` (table builder) |
| Compositor, bands, IK, floor cut by `oy` | old `src/art/monsters-v3/grim_warden-kit.ts` (`Comp`, `bands`, `ribbon`; **not** `LINING`), `grim_warden-rig.ts`, `grim_warden-fx.ts` (`dust`, `motes`, `eyeGlow`) |
| Card art, native redraw | `src/art/cardart-v3/crystal_wyrm.ts` |
| Card art, EPX + fix | `src/art/cardart-v3/ashen_drake.ts`, `wisp_imp.ts` |
| Portrait wiring | `src/art/monsters-v3/seal_head.ts:35` |
| Cut-in | `src/art/cutins-v3/*.ts` (crystal_wyrm, abyss_magus), `src/cinematics/_v3/cutin.ts:144` |
| Signature summon | `src/cinematics/summon-a/crystal_wyrm.ts:406`, `summon-a/abyss_magus.ts:364`, `summon-a/_kit.ts:620-692` |
| v3 strike | `src/cinematics/strikes-a/crystal_wyrm.ts:937` (`prismBreathV3`), `strikes-a/abyss_magus.ts:187` |
| Effect hook | `src/cinematics/strikes-a/abyss_magus.ts:316`, `strikes-b/lumen_sprite.ts:346`, `strikes-b/thorn_lurker.ts:570`, `strikes-a/tide_golem.ts:194` |
| Custom death | `src/cinematics/strikes-a/crystal_wyrm.ts:1001`, `strikes-a/abyss_magus.ts:485`, `_v3/death.ts:282`, `strikes-a/_kit.ts:762`, `traps/_chasm_v3.ts` (bookkeeping incl. `v3:dying`/`v3:dead`) |
| Aura | `src/duel/auras-v3.ts` (`flameAuraV3`) |
| Sound file | `src/audio/v3/dawn.ts`; voices in `src/cinematics/_v3/sound.ts:176`; ace sets in `src/audio/v3/slice.ts` |
| Scenario files | `src/duel/scenarios/grim_warden.ts`, `mart_ashen_drake.ts`, `monsters1.ts`, `b2.ts` |
| Art tests | `tests/art/steel_silencer.test.ts`; the last test in `tests/art/grim_warden.test.ts` (card art + cut-in template) |

---

## 12. Per-card status today

**Common to all four:** there are **no lane-B cinematics anywhere** in `src/cinematics`. The only mentions are the `DEATH_PRESETS` lines in `_v3/presets.ts` and the generic `b2:banish` placeholder. Every moment falls to the defaults. None of the four has a `CHARACTER_SOUNDS` entry, a presentation recipe, or any sound recipe.

### grim_warden (R2): Lv6 ace, 2500/1200, DARK, effect `declareAtkDebuff400`

- **Sprite.** The old "grave knight" (horned skull, greatblade, violet lightning) is **registered** in v3:
  - `src/art/monsters-v3/grim_warden.ts` plus `-rig`/`-anims`/`-kit`/`-fx`
  - 128×116, AX 59, GY 108, 13 anims, 116 frames, weight `heavy`, `p2:'relight'`

  It must be fully redesigned as the lantern warden: tattered shroud, iron cage-helm with a single eye light, soul lantern on a chain, spade-halberd, "L" silhouette. Aim for a tighter frame (about 112×108) to fit the `large` budget.
- **Card art** `cardart-v3/grim_warden.ts`: a 1:1 crop of the old sprite. It is not wired (no `portrait`), so the face shows `monsterCropArt` on the old backdrop. Redraw it and wire `portrait`.
- **Cut-in** `cutins-v3/grim_warden.ts`: the old skull design (6 frames, holds `[260,120,100,100,160,620]`). It uses crim `LINING`. Rewrite it.
- **Cinematics.** None. The summon plays the v1 `cutIn` via the defaults; the effect plays the generic activate.
- **Presets and glow.** Preset `shadow/crystal`. Glow lists the lightning tones (`void4`, `white`, `mag4`); change it to `leaf4`/`leaf3`.
- **Test.** `tests/art/grim_warden.test.ts` pins the old design; rewrite it.
- **Scenarios.** `gwSummon`, `gwSummonP2`, `gwAttack`, `gwAttackP2`, `gwHit`, `gwKill`, `gwKillP2`, `gwGuard`, `m1Debuff`.
- **To do:** the −400 retiming, the drain cinematic (§6.4), the lantern aura until end of turn.

### wisp_imp (R3): Lv1, 300/200, DARK, effect `noBattleDamageOnDestroy`

- **Sprite.** The old "dark-violet puffball" exists (`monsters-v3/wisp_imp*.ts`: 72×62, anchor (34,57), hover 4, floater, 13 anims) but is **excluded** at `src/art/monsters/index.ts:35`. The game shows the totem placeholder.
  - Redesign it as a white-lilac teardrop of feathers with a question-mark tail and a dark face hollow with two dot eyes.
  - Remove the exclusion when it is ready.
- **Card art** `cardart-v3/wisp_imp.ts`: EPX of the old rig. It imports the old rig exports and is not wired. Rewrite it and wire `portrait`.
- **Test.** `tests/art/wisp_imp.test.ts` is generic: validateArt, extras, contact mark, relight, palette, determinism. It imports the file directly. Extend it with card-art checks.
- **Presets and glow.** Preset `shadow/shadow`. Glow lists `white`, a body tone; fix it.
- **Scenarios.** `m1Imp` (wisp attacks stone_sentinel and dies: the effect). Also `m1Board5` and `jobb-ui`.
- **To do:** pillow effect and death ownership (§6.4), the defense "wind" death, the hit-stop weight decision.

### mudgrasp_spirit (C10): Lv4, 700/1800, EARTH, effect `defenseAttackedPin`

- **Sprite.** No v3 file; it shows the totem placeholder (64 class). Build the half-buried mud spirit: cracked clay mask, several arms, violet eyes.
- **Card art and test.** None.
- **Presets and glow.** Preset `stone/shadow` (**wrong**: use a liquid ending, e.g. `water`). Glow is a placeholder listing `earth4`, which floods the body; use `void3`/`void4`.
- **Scenarios.** It only appears face-down in `b2Wipe` and `b2WipeAuto` (destroyed by lane E's void_eye). **There is no pin scenario.** Create `src/duel/scenarios/mudgrasp_spirit.ts`.
- **To do:** pin effect plus the `positionChange` takeover plus the `mudPin` aura with observer expiry (§6.4–6.5); liquid death using option (b); strong guard and toGuard poses.

### hollow_ogre (C6): Lv4, 1400/900, EARTH, effect `banishGraveBoost400` (ignition, once per turn)

- **Sprite.** No v3 file; it shows the totem placeholder (64 class). Build the hollow-log giant: bark, dark moss, glowing hollow with gold eyes, violet knot-lights and seeds, club.
- **Card art and test.** None.
- **Presets and glow.** Preset `plant/stone`: material `plant` fits the roots ending, and the `stone` accent should be reconsidered against §5.2. Glow is a placeholder (`earth4`); use `gold3`/`gold4` and `void3`/`void4`.
- **Banish presentation.** Only `b2:banish` (`b2/placeholders.ts:260`: a whoosh, a spark and "OYUNDAN ÇIKTI"). Lane B owns replacing it, at priority 1, in its own file.
- **Scenarios.** `b2Ogre` (graveyard ember_wolf, storm_hawk, judgment_bolt; **no steps**, hand-play only) and `b2QuickOwn` (static). Create `src/duel/scenarios/hollow_ogre.ts` with the `activateMonster` and `chooseCount` steps.
- **To do:** the two-batch effect plus banish handler (§6.4), the boosted attack variant (pollen when boosted), the roots-retract death.
