# Kül Ejderi (`ashen_drake`): design and build plan (lane A, R1, NO rebirth) — revision 3

KARANLIK / Ejderha · Sv7 · 2400/2000 · ★ As (2 tributes → cut-in) · `effect: 'none'` (vanilla, owner decision 2026-10-31 #2).
Source spec: `docs/v3/YENI_KARTLAR.md` §8 R1 (identity, idle, summon, attack, death, SFX), §5 / §5.1 / §5.2. Rules: `docs/v3/REHBER.md`.
Time: scene ms (the code's numbers). Game time is ×1.35 (`V3_TEMPO`), hit-stop ×1.55. The limit is REHBER §5 × 1.45 (`docs/v3/TEMPO.md`).
Sounds play in REAL time; every sustained sound is sized against scene ms × 1.35 (§6.2).
This document is the blueprint for the builders. Every path, function and API named here was read in the tree on 2026-10-31 (commit 7cc7e70; revision 3 re-checked at 4933a32). Revision 2 answers critique round 1 (§11); revision 3 answers critique round 2 (§12).

---

## 0. One-paragraph pitch

A **vulture made of compressed ash and coal**. It perches hunched on its talons with its wings drawn over its shoulders like a hooded cloak; a bony claw spur pokes up from each wing wrist.
The long neck hangs forward and down in an S, and the skull peers out from under the hood. Its only real light is an **ember heart** inside the rib cage. That heart beats twice, slow and low, every two seconds (50 Hz lub-DUB). The cloak never stops moving: a ripple runs through its plates, ash flakes peel off its ember-lit hem, drift, and settle back.
It does not breathe fire. **It breathes its own cloak.** As it winds up, the hood plates tear off and are sucked into its ribs until it stands as bare bones round a white-hot heart; then it exhales them as a grey, ember-studded pyroclastic bank that hugs the floor, tumbling backwards on itself, and swallows the target. Then everything goes silent but one heartbeat — LUB — the embers in the bank go dark, the hall dims. **The VUF lands where the DUB should be**: every buried ember ignites at once and the target stands as a black silhouette inside an orange blaze. The soot trail lights back toward the drake like a fuse, embers spill out between its ribs, and the cloak re-grows plate by plate with ember welds. Ash flakes keep snowing on the burnt tile for a few seconds after.
When it dies it crumbles from the top down into a heap of ash, its core falls into the heap, the heap cools, and the wind takes it. The last ember pulses once and goes out: nothing comes back (vanilla, no rebirth).

---

## 1. Identity and silhouette

### 1.1 Why the current v3 art fails (it is replaced entirely)
Filmed: `?dev=monster&id=ashen_drake&look=v3` (sheet and board mode, evidence `<scratch>/kart-a/ad_cur.png`, `board_ashen_drake.png`).
- **Wrong animal.** It is a low quadruped that walks on its front knuckles (144×88 frame, w/h ≈ 1.9). R1 asks for a hunched vulture perch. On the board at 1× it reads as a flat grey lump that sits lower than the 64-px class monsters next to it.
- **It speaks the Titan's material language.** Orange lava seams run over the whole grey body. That is exactly `magma_titan`'s lava-seam rule (`src/art/materials/defs/lava.ts`). R1's "nearest card: magma_titan, difference: ash, not lava" is violated.
- **No single brightest point.** The cracks glow everywhere at the same value (KART_RESIMLERI §3, REHBER Sİ-6).
- **The wings are not ash layers.** They are a ragged dark-red membrane triangle.
- **Rhythm and weight clash.** The `heavy` pounce and the head-low growl share the Titan's and the wolf's vocabulary. The idle is 14 f, not the 20 f double heartbeat.
- Its card art and cut-in import `drawDrake` / `drawPose` from that rig, so both are redone with it.
- `tests/art/ashen_drake.test.ts` pins the old design AND `tests/art/dusk_ashen.test.ts` imports the art too (13 anims, `validateArt` normal tier, P2 opaque diff 0). Both are handled in §9.4.

### 1.2 The new silhouette (what reads at 1×)
Frame **120×104** (ace class, 1 art px = 1 game px). Anchor **(52, 99)**: the ground line between the gripping talons. `hover: 0`, `weight: 'heavy'` (§1.4).
idle f0 target: bbox ≈ **74 w × 84 h**, opaque **2900–3400 px** (wyrm 3404), w/h ≈ 0.9.

Key shapes, back to front (P1 view, facing right):

| Shape | Where (frame px, idle f0) | Read at 1× |
|---|---|---|
| **The hood**: both wing wrists hunched up ABOVE and behind the head, the cloak falling from them | near wrist peak ≈ (60, 12), far wrist peak ≈ (40, 16, one value darker); hem ≈ y 78 | an inverted U, a "shoulders-up" vulture block. This is the silhouette hook. |
| **The wrist spurs** | a 2–3 px wide, 5 px tall bony claw on each wrist peak, leaning back; `stone3` lit top edge on the peaks | breaks the hood's curve so it can NOT read as a robe / hood (R2 `grim_warden` is a hooded shroud) |
| **The S-neck and skull** hanging out from under the hood | neck root (64, 40) → down-forward S → skull (86–100, 48–60), snout pointing to the floor ahead | a hook shape under the hood; the head is LOWER than the shoulders |
| **The smoke-spine crest** | 5 tapering spines along the skull and neck top, tips curling back | jagged dark fringe on the head |
| **The rib cage** at the cloak's front opening | (48–66, 46–70) | bars with the ember heart glowing between them: the brightest point |
| **The talons** gripping the floor | x 44–62, y 92–99 | two clenched three-toed feet |
| **The tail** sweeping back and curling up into the **brazier tip** | from the hips (40, 82) back to (12, 91), tip raised to (8, 83). **No tail pixel ever enters rows 94–99** (HA-9) in idle / guard / toGuard / fromGuard. | a low curl with a small live flame at its end: the second light |

Proportions: the cloak **~55 %**, skull + neck **~15 %**, talons + tail **~20 %**, ribs and heart **~10 %**.
Nothing about it is upright or proud. The crystal wyrm stands tall with its chest up. This one stoops, peers and waits.

### 1.3 Materials and ramps (palette only: `src/art/palette.ts`)

| Material | Tones | Plane rule | Notes |
|---|---|---|---|
| **Compressed ash hide / bone** (skull, neck, ribs, talons, tail) | `stone1` (shadow, undersides), `stone2` (mid), `stone3` (lit plane), `stone0` only for creases / strata | 3 planes + crease | skull top = the largest calm lit plane. Texture = **compression strata**: 1-px darker lines along the bone every 4–5 px, only on the mid / shadow planes (MA-2). |
| **Ash cloak plates** (the wings) | lit plate `stone2`, plate shadow `stone1`, deep folds `stone0`; hem ember lip `fire1`, lifting flake `fire2` | shingled plates 3–4 px tall, 2 tones each, overlapping downward like roof tiles; each plate's lower edge 1 px darker (IŞ-5 crease) | **`night0` is NOT used on the cloak** (§11 #14: it melts into the floor). The wrist peaks get a 1-px `stone3` lit top edge. **The ember lip sits on the row INSIDE the ink outline**, never on it (≥ 90 % ink contour, §11 #19). |
| **Rib cavity** | `night0` (the only place it appears), behind the rib bars | — | the dark that makes the heart glow |
| **Smoke spines** (crest, wrist spurs' tips) | `stone1` → `void1` body, `void2` tips | 2 tones, ≥ 2 px wide at the base | the DARK attribute's cool accent |
| **Ember (LIGHT, drawn after the outline, never outlined; IŞ-9)** | `fire1` dim, `fire2`, `fire3`, `fire4` heart, **ONE `gold4` pixel** in the heart at rest | heart ≤ 5×4 px at rest (≤ 7×6 at full heat), glowing through 3 rib gaps; eyes 1 px `fire3`; brazier flame ≥ 3 silhouettes per loop | `white` only at full heat (attack f4, summon f3) |
| **Rim light (IŞ-7)** | `PAL.void2`, one continuous 1-px line on the shadow-side contour | — | separates the dark body from the navy floor; NOT the Titan's edge |

- Colours per frame ≤ 20 (IŞ-11). No P1 / P2 colours in the body.
- **Brightest point:** the ember heart (`fire4` + the single `gold4`). Eyes and brazier ≤ `fire3` at rest.
- **Not lava:** NO seams across the hide. Light exists only (a) inside the rib cage, (b) on the cloak hem, (c) in the eyes and the throat, (d) at the tail brazier.
- **1× contrast gate:** before KK-1, render idle f0 on the board and check the cloak's mean luminance is ≥ 2 palette steps above the floor (`night1` / `night2`) on the lit side. The cloak's average tone is `stone1`/`stone2`, the board's `night1`/`night2`.

### 1.4 Weight class
`weight: 'heavy'` (`src/duel/motion.ts`: hit-stop 100–130 ms by power, shake 3–4 px, guard push 0/0/1).
R1's "hit-stop 120 ms" maps to heavy power 2–3 through the kit's `reactStopMs`.
The SILENCE before the ignition is the strike's own pre-contact beat (§5.2), not hit-stop.
Rhythm per HA-8: charge→release **490 ms** (f1 110 + f2–f5 380; wyrm 460, magus 500): one of the slowest wind-ups of the aces, and the declaration already shows f1. The patience lives in the 160 ms silence after the swallow, not in the wind-up.

### 1.5 P2 relight
- `p2: 'relight'`. Draw with `lightOf('right')` (`src/art/rigkit/light.ts`, the standard vector).
- **Do not keep** the old gbuf's private vector (−0.8, −0.56, 0.46). It breaks IŞ-1 comparability.
- Hand maps (cloak plates, skull planes) get `_L` / `_R` versions (IŞ-2, as `abyss_magus-maps.ts`).
- Ember pixels, eyes, brazier and `void2` spine tips are identical in both sheets. The rim moves to the other side. **The opaque mask is identical** (dusk_ashen test: P2 opaque diff 0): flakes and plate lifts are placed by the same seeds in both lights.

---

## 2. Distinction card (`ASHEN_DISTINCTION`, a separate export of the art file)

`distinction` is NOT an `ArtShell` field (`src/art/rigkit/anim.ts:277`). Export it on its own from `ashen_drake.ts` as `export const ASHEN_DISTINCTION: DistinctionCard = { … }` (type from `src/art/bodyplans/types.ts:158`), where the sameness review reads it.

```ts
export const ASHEN_DISTINCTION: DistinctionCard = {
  silhouette: 'a hunched vulture perch: both wing wrists pulled up above and behind the head into a hooded ash cloak (an inverted U) with a bony claw spur on each wrist, a long S-neck hanging the skull out forward and DOWN from under the hood, two gripping talons, a tail curling up into a small brazier flame; taller than wide, nothing upright',
  rhythm: 'slow and patient: a double heartbeat, a 490 ms wind-up that strips its own cloak, a breath that rolls rather than fires, a silence holding one heartbeat, then everything at once on the second beat; recoveries re-grow the cloak plate by plate',
  idle: '20 f / 2.0 s: the ember heart beats twice (lub … DUB, a 130 ms relax between) once per loop, so its floor pool double-pulses; a plate ripple travels hem → wrist with a 2-frame dwell per row; a 3-step breath; the S-neck undulates; the tail sweeps; flakes peel off the hem and re-join; the brazier flickers',
  guard: 'the cocoon: the cloak closes fully round the body, the head tucked under the hood edge, only one eye and a slit of heart-glow showing; the hem embers dim to fire1 and breathe plate by plate',
  signaturePart: 'the ember heart seen through the rib cage (the only real light) and the ember-eaten hem of the ash-plate cloak',
  material: 'compressed ash and coal on the stone ramp with compression strata, a violet void2 rim, ember light only inside the ribs / hem / eyes / brazier; dies as a soft ash heap that cools and is blown away',
  signatureMove: 'Kül Fırtınası Nefesi: the hood plates tear off into the ribs until the drake is bare bones round a white heart; the head drops to the floor and exhales them as a pyroclastic bank of ash that hugs the floor and swallows the target; a silence holding one heartbeat (LUB); every buried ember ignites at once on the second beat (the delayed VUF); the soot trail burns back like a fuse, embers spill between the ribs and the cloak re-grows plate by plate',
};
```

**Nearest cards and how this one differs:**

| Card | Overlap | Difference |
|---|---|---|
| `crystal_wyrm` (ace dragon, beam) | ace dragon, breath attack, cut-in | Upright, bright glass, an instant prism BEAM. **This one** stoops, is dark, rolls a SLOW ground-level cloud, and hits LATE after a silence. Hollow raspy roar, no glass. |
| `magma_titan` (stone + lava, heavy) | dark stone + fire tones, heavy | Lava seams, a fist, a fireball, rubble death. **This one** has no seams; fire lives in the ribs and on a hem. Ash, not basalt; a perch, not a stomp; dies as a soft heap (§5.6, own `ash` shatter). |
| `tide_golem` (plays in v3) | a mass rolling across the tiles over the target; a summon that builds the body bottom → top | The golem's wave **rises, crests and crashes** over the target; its summon is a spout. **Our** bank hugs the floor with NO rising lip and its billows tumble **backwards** (top lip rolling toward the attacker, pyroclastic flow); it never crashes — it settles, then ignites. Our summon builds the cloak by **accretion** (plates flying out of the tornado and sticking in scattered patches), never a straight build line. |
| `venom_drake` (lane-mate, long-necked dragon) | long neck, dragon | Its leitmotif is the fang drip, a dripping cut-in and a puddle death. **Ours** never drips from the mouth: the spill comes OUT OF THE RIB CAGE like sand through a grate and cools into an ash FAN, not a puddle. Silhouettes cross-checked (§10 R4). |
| `ember_wolf` (fire, embers) | ember particles | The wolf's whole body burns. Our embers are buried and dark until the single ignition. |
| `stone_sentinel` (stone death) | the stone / ash ending family (§5.2) | The sentinel's rubble bounces. Ours is ONE soft heap that cools and blows away (own `ash` shatter: floor rest, no flash, no shake). |
| `coral_serpent` (v3, water) | a ribbon coiling round the body in the summon | Its water ribbon coils DOWN round the body (`summon-a/coral_serpent.ts:105`), wet and blue. **Our** ribbons RISE (the tornado lifts from the mound), are dry grey `stone1`–`stone3` bands with orbiting embers, and the body is built by plates accreting out of them, not revealed by an unwinding coil. |
| `storm_hawk` (wind) | a spiral column; a helix trail | Its entrance is a wind spiral DESCENDING onto the tile with a white-teal helix trail and a hologram scan (`summon-b/storm_hawk.ts:7, 107`). **Ours** rises, has no scan and no trail, and is a slow, heavy ash column that sheds 2×2 / 2×3 plates and grains onto the floor, never a trail; its exit is a burst of loose plates, not a dive. |
| `grim_warden` R2 (DARK, lane B) | DARK, a hooded dark mass with a skull peeking out | The warden is a shroud with a lantern and ghost-green light. **Ours** has wrist claw spurs breaking the hood line, a lit `stone3` peak edge, warm embers, a long S-neck hanging below the shoulders and visible talons. Add it to the KK-1 silhouette check. |

---

## 3. Rig approach

### 3.1 Choice: hand rig + G-buffer (ace tier, L5 custom), on the rigkit core, with compiled anim tables
- **No body plan fits** (`src/art/bodyplans/` has `biped` and the serpent plan). An ace is L5 custom (REHBER §0.2).
- **Follow `crystal_wyrm`'s craft, on the shared core** (`src/art/rigkit/*`: `Raster` / `Workspace`, `lightOf`, `despeckle`, `composite` + creases, `edgePaint`, `cracksOn`, `crumblePass` / `drawDebris`). The old `ashen_drake-gbuf.ts` helpers (`gTube`, `gFacet`, `ik`) may be ported; not its light vector.
- **Motion:** `definePose` (`src/art/rigkit/pose.ts`) + `compileAnims` / `toMonsterArt` (`src/art/rigkit/anim.ts`), marks by name.
  - Regions (`REGION_IDS`): `head` = skull + jaw + crest, `chest` = ribs + heart, `wingN` / `wingF` = the cloaks, `lower` = talons, `hips` = pelvis, `tail` = tail + brazier, `extra` = flakes.
  - Escape hatch: per-frame patches (`AnimDef.frames`) for summon / death / revive.
- **Cloak = plate field.** Each cloak is ~22 plates in wing space, rows from the wrist down to the hem, placed by the wing's 3 bones. A plate has `lift` (0 seated … 1 detached) and `ripple` (0/1 px offset, the idle wave) and, for the summon and the attack, `seated` (bool, accretion order). The attack's tear-off (f2–f4) un-seats plates in the REVERSE of the accretion order and its re-growth (f10–f13) re-seats them in the accretion order: one table (`ASHEN_BUILD.order`) drives both.
- **Ember pass after the outline**: heart, rib-gap light, hem lip (inside row), eyes, throat, brazier, rib spill, `heat` scalar (0 dull … 1 rest … 2 white).

### 3.2 Pose fields (`AshenPose`, sketch)
`hip [x, y]`, `crouch`, `chestLift` (0/1/2 steps), `ribSpread`, `ribFlex` (spill opening), `heat`, `heatEdge`, `neckS [a0, a1, a2]`, `neckWave` (1-px undulation phase), `headPitch`, `headTilt`, `jaw`, `eye` (0/1/2), `crestFlare`, `wingN { wrist, open, mantle }`, `wingF { … }`, `plateRipple` (row phase), `plateLift[]`, `spill` (0 none … 1 pouring … 2 cooled fan), `talonGrip`, `tailCurl`, `tailSweep`, `brazier`, `smoke`, `boneBuild` (summon bone mask 0–1), `platesSeated` (accretion count 0–44: the summon build, the attack tear-off / re-growth), `crumble` (death), `heapHidden` (death f9+: the art draws no heap, §4.8), `reform` (revive: plates seated count), `smearFrom`.

### 3.3 Files (all per-card; old content replaced)

| File | Role |
|---|---|
| `src/art/monsters-v3/ashen_drake.ts` | the MonsterArt (rewritten): `{ ...toMonsterArt(shell, anims), knock: 'pose', poseKnockPx: [1, 2, 2] }` (`knock` / `poseKnockPx` are NOT `ArtShell` fields, `rigkit/anim.ts:277`: spread them onto the result), anchor, `weight: 'heavy'`, `p2: 'relight'`; separate exports `ASHEN_DISTINCTION` (§2), `ASHEN_MOUTH`, `ASHEN_RIBS`, `ASHEN_BUILD` (per-frame accretion table, shared by the summon and the attack re-growth), `framePose` |
| `src/art/monsters-v3/ashen_drake-gbuf.ts` | rewritten as the material table on rigkit; frame consts `W = 120, H = 104, AX = 52, GY = 99` |
| `src/art/monsters-v3/ashen_drake-rig.ts` | the skeleton: hips → spine → S-neck (3 segments) → skull; legs IK to fixed talons; tail chain (6 links) + brazier; rib cage bars over the `night0` cavity |
| `src/art/monsters-v3/ashen_drake-cloak.ts` (new) | the plate field: layout per wing (`_L` / `_R`), ripple, lift / flake logic, hem lip, mantle / cocoon / burst shapes, the summon accretion order |
| `src/art/monsters-v3/ashen_drake-ember.ts` (new) | the light pass: heart, rib-gap leaks, rib spill grains, eyes, throat, brazier, the death crumble glow |
| `src/art/monsters-v3/ashen_drake-anims.ts` | PoseKit, all anim tables (§4), `points()` |
| `src/art/materials/defs/ash.ts` (new) | the full MaterialDef `ash` (§3.4) |
| `src/art/cutins-v3/ashen_drake.ts` | rewritten portrait (§7.2) |
| `src/art/cardart-v3/ashen_drake.ts` | rewritten card art (§7.1) |
| `src/presentation/cards/ashen_drake.ts` (new) | the recipe (§8.2) |
| `src/cinematics/strikes-a/ashen_drake.ts` (new) | strike "Kül Fırtınası Nefesi" (all outcomes) + the death hook |
| `src/cinematics/strikes-a/ashen_drake-fx.ts` (new) | `ashCone`, `ashVeil`, `ignite`, `burnSilhouette`, `fuseBack`, `ribFan`, `ashHeap` (the death heap layer), `lastEmber`, `scorch` (no top-level registration) |
| `src/cinematics/summon-a/ashen_drake.ts` (new) | signature entrance (§5.1) |
| `src/audio/v3/ashen.ts` (new) | `V3_ASHEN_RECIPES`, `AshenSfxName`, `ASHEN_SUSTAINED` (§6) |
| `src/duel/scenarios/kart_a_ashen_drake.ts` (new) | the filming scenarios (§8.5) |
| `tests/art/ashen_drake.test.ts` | rewritten (§9.4) |

Keep `src/duel/scenarios/mart_ashen_drake.ts` as it is (keys `ad*` do not collide).

### 3.4 The `ash` material (full definition; `materials.test.ts`: palette-only, ≤ 5 ramp tones, luminance increasing)
```ts
export default {
  id: 'ash', status: 'draft', firstUser: 'ashen_drake',
  draw: {
    ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3],
    th: [-0.9, -0.2, 0.5],
    farShift: 1,
    far: { ramp: [PAL.stone0, PAL.stone0, PAL.stone1, PAL.stone2], th: [-0.9, -0.2, 0.5] },
    seam: 'stepDown', crease: 'stepDown2',
    edge: { hi: PAL.stone3, lo: null, lit: 0.4, dark: -0.35 },   // never stone4: ash has no hard edge
    rim: PAL.void2,
    glint: null,                                               // ash does not glint
    texture: { kind: 'grain', density: 5 },                    // the compression strata
    emissive: { tones: [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4], pulse: 'breath' },
    interior: 'embers',
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.stone1, PAL.stone2, PAL.fire2, PAL.fire3], debris: 'ember', flash: PAL.fire4 },
  death: { shatter: 'stone', accent: 'fire', pass: 'crumble', revive: 'reassemble' /* type value only: the art draws its revive by hand, §4.9 */ },
  matter: RAMPS.stone,                                         // = MATTER_RAMP[death.shatter] (tests/art/materials.test.ts:170)
  sound: { same: 'stone' },                                    // ONLY until the 'ash' hit material lands (§6.5, asked now)
  light: { glow: PAL.fire3, pool: PAL.fire3 },
} satisfies MaterialDef;
```
- **Why `'stone'` today:** `materials.test.ts:166-170` requires `death.shatter` to be a key of `MATTER_RAMP` and `matter` to EQUAL `MATTER_RAMP[death.shatter]`; `'ash'` is not a `ShatterMaterial` yet, so it would not compile either.
- **The switch, the day the orchestrator adds `'ash'` (§5.6, Q3):** the `Record<ShatterMaterial, …>` types force all of these in one change: `MATTER_RAMP.ash` (`_v3/presets.ts:92`, = `[stone0, stone1, stone2, stone3, fire1]` only if the luminance test allows, else `RAMPS.stone`), `ACCENTS.ash` (`_v3/death.ts:72`), `SHATTER_MATERIALS.ash` + `SHATTER_MATERIALS_LIST` (`vfx/shatter.ts:324-325, 395`). Then `ash.ts` takes `shatter: 'ash'`, `matter: MATTER_RAMP.ash`, and the recipe takes `death: { material: 'ash', accent: 'fire' }`.
- **`sound`** switches from `{ same: 'stone' }` to its own `MaterialSound` (`ASH_SOUND`, §6.5) the day `'ash'` joins `GENERATED_HIT_MATERIALS`.

---

## 4. Animations

Every one-shot ends on idle f0 (HA-14 out = 0), except `victory`, which ends on its held cooled-fan frame (HA-2 exempts a held last frame). Holds 40–200 ms (HA-2). Hit and death marks carry BOTH `impact: 0` and `contact: 0` (`validate.ts:125-127`). Release ≤ 70 ms; the longest attack frame is an anticipation frame; contact holds 50–90 ms; recoveries lengthen (HA-3, `src/art/rigkit/validate.ts:139-150`).
Total **133 frames** (20 + 8 + 6 + 6 + 14 + 9 + 6 + 8 + 8 + 14 + 12 + 12 + 10; ≤ 140, KK-13). Sheet bytes 120 × 104 × 4 × 133 = **6.64 MB / side** (ace ≤ 7 MB).

| Anim | f | ms | Marks | Note |
|---|---|---|---|---|
| idle (loop) | 20 | 2000 | — | double heartbeat (LUB f0 · relax f1 ≥ 130 · DUB f2) |
| guard (loop) | 8 | 1280 | — | cocoon |
| toGuard / fromGuard | 6 / 6 | 390 / 390 | — | the only pose a v3 position change plays |
| attack | 14 | 1350 | charge 1, release 6, contact 9, recover 10 | f2–f4 the cloak tears off into the ribs; f9 (90 ms) is held by the cinematic; f10–f13 = the rib spill + the cloak re-growth |
| roar | 9 | 860 | charge 1, release 4, recover 6 | the compact spill; dev sheet / non-victory fallbacks only (§4.5) |
| hit | 6 | 510 | impact 0, contact 0, recover 3 | |
| hitHeavy | 8 | 680 | impact 0, contact 0, recover 4 | |
| hitMagic | 8 | 620 | impact 0, contact 0, recover 4 | |
| summon | 14 | 1350 | land 1 | bones bottom-up + cloak accretion; driven frame by frame (§5.1) |
| death | 12 | 860 | impact 0, contact 0, dissolve 5 | top-down crumble; from f9 the heap is the cinematic's (§4.8) |
| revive | 12 | 1180 | land 6 | plates fly in one by one, each re-lit by a heartbeat |
| victory | 10 | 1270 (last frame held) | — | **"Kor Dökülmesi", the long form**: the mantle + rib spill, ending on the held cooled-fan frame (§4.5). This is what the v3 duel end plays (`v3small/end.ts:780`). |
| special | — | — | — | NOT drawn (vanilla) |

### 4.1 idle: 20 f, 2.0 s, with a liveliness budget (HA-18 ≥ 15 %)
Holds: `110 130 100 110 100 100 110 110 100 100 100 100 100 100 90 90 90 90 80 90` (sum **2000**; the 130 ms relax on f1 is taken from f12–f19).

**The double pulse (the board heartbeat, no shared change needed).** `LightLayer.ts:915-921` already drives the monster's floor pool from each frame's emissive energy, smoothed with a 110 ms constant. So the heart itself is the light's metronome:
- f0 **LUB** 110 ms: heart 5×4 `fire4` + the `gold4`, leaks +1 tone, ribs 1 px out (energy peak 1).
- f1 **relax ≥ 130 ms**: the heart drops to **`fire2`, BELOW rest** (no `fire4`, no `gold4` on this frame only; the HA "exactly one `gold4`" check exempts idle f1), so the smoothed energy actually falls between the beats.
- f2 **DUB** 100 ms: heart 4×3 `fire4` + `gold4` (energy peak 2, a little lower than the LUB).
- f3–f19 rest: heart 3×3 `fire3` + 1 `fire4` + the `gold4`.
- **Emissive weights** (recipe `light.glow.emissive`, §8.2): `[[fire4, 1], [gold4, 1], [fire3, 0.4]]`; `fire2` and `fire1` are NOT weighted, so the hem shimmer and the lip steps add nothing. The brazier and the eyes keep a CONSTANT `fire3` pixel count per frame (shape changes, count ±1), so they add no noise either.
- **Proof:** a 1× board strip `--film 40 --every 50` (§9.2) must show the pool's two steps up and the drop between them every 2 s. If the 110 ms smoothing still merges them, lengthen f1 to 150 (from f18/f19).

At ≈ 3100 opaque px, 15 % means **≈ 465 changed px per frame on average**. Every part's Δ is budgeted:

| Part | Period | Motion | Δ px / frame (est.) |
|---|---|---|---|
| **Cloak plate ripple** | 20, a wave hem → wrist | **one row moves per frame, alternating cloaks** (near on even frames, far on odd), and **every row dwells 2 frames** before it returns: no row on either cloak changes on two consecutive frames (IŞ-10 boiling guard). | **90–120** |
| **Breath** | 10, 3 steps | the WHOLE hood mass (chest + both cloaks + wrists + spurs) rises 0 → +1 → +2 → +1 → 0 px (not a hold): f0–f9 and f10–f19 | **130–180** (on 8 of 10 frames) |
| **Neck S undulation** | 10 | the middle segment AND the skull slide 1 px forward / back, the skull 1 frame behind (lag 1) | **70–100** |
| **Tail sweep** | 20, continuous | the mid-tail moves 1 px every 2 frames through a ±2 px arc, +2 frames after the hips; stays above row 94 | **30–40** |
| **Heart** | 20 | LUB f0 / relax f1 / DUB f2 (above) | **20–40** on f0–f2 |
| Head scan | 20 | 1 px forward f5–f8, a jaw-line tilt f8–f11 (the vulture peer) | 20–30 |
| Flakes | 20 | three flakes at f3, f9, f15 lift (`fire2` lip), drift 2–3 px back/up over 3 frames, re-seat; ≤ 2 airborne | 10–20 |
| Hem shimmer | 10 | `fire1` ↔ `fire2` steps travelling 4 px per frame along the inside row | 8–12 |
| Nostril smoke | 20 | one 2-px `stone2` curl f12–f15 | 4–6 |
| Brazier | 5 | 3 flame silhouettes + 1 low (constant `fire3` count) | 6–10 |

Sum ≈ 400–560 px → **≈ 13–18 %**: the budget leans on the breath and the neck, not on the cloak texture. **Measure HA-18 on idle f0–f3 first** (a 4-frame partial loop through the gates) before drawing the rest; if under 15 %, add a slow far-cloak sway (the far wrist 1 px every 5 frames, 40–60 px) — never a faster ripple. Never all parts on the same frame (HA-6). Seam HA-16 ≤ 1.4; HA-17 ≤ 1.8 (the LUB frame is the largest jump: heart growth ≤ 2 px); HA-21 phase < 50 %; IŞ-10 checked on the cloak region alone.

**Idle SOUND is NOT delivered by this plan.** R1 asks for an idle 50 Hz heartbeat, crackle and smoke breath; no per-monster idle-sound system exists (the board is silent between actions). It is an explicit orchestrator ask (§10 Q1), not a promise of this card.

### 4.2 guard: 8 f, 1.28 s, "the cocoon"
Holds `150 160 160 170 150 160 160 170`.
Both cloaks closed in front of the body, overlapping at the chest; the near wrist (with its spur) at head height; the skull tucked under the hood edge, near eye `fire3`; a 2-px slit of heart glow at the overlap; hem `fire1`. **The tail curls BEHIND the talons with its tip at y ≤ 92** (≥ 1 px above row 94; HA-9).
Breath travels one part per frame: plate row 1 → row 2 → the slit glow steps `fire2` → `fire3` → the head settles → the brazier flickers. HA-19 target 0.45 × idleΔ.

### 4.3 toGuard / fromGuard: 6 f each, ≤ 0.4 s
- **toGuard** `50 60 60 70 70 80`: wrists rise → the hood opens wide (HA-13 in-between) → cloaks sweep forward (the head clear of the sweep, HA-29) → overlap closes → settle → guard f0.
- **fromGuard** `60 60 70 70 60 70`: the reverse with a mantle-open in-between, ending on idle f0. Talons and tail stay out of rows 94–99 throughout.

### 4.4 attack "Kül Fırtınası Nefesi": 14 f, 1.35 s — "the cloak is the ammunition"
The hood plates are visibly torn off and sucked into the ribs on f2–f4; at f4 the drake is **bare bones with a white heart** (the wing bones remain as bare finger struts with the wrist spurs: a skeletal-wing silhouette, a huge 1× read change). The bank it exhales IS that cloak. In recovery the cloak re-grows plate by plate with `fire2` ember welds, re-using the summon's accretion order (`ASHEN_BUILD.order`, §3.1). R1's "constantly flaking and re-forming wings" becomes the attack's grammar.

| f | ms | Mark | Pose |
|---|---|---|---|
| 0 | 60 | | idle f0 + plate row 1 lifts |
| 1 | 110 | **charge** | the head lifts out of the S, wrists rise, the cloak starts to unwrap. **The declaration holds this frame.** |
| 2 | 90 | | wings half open: plate undersides `fire1` / `fire2`; **the hem rows tear off** (≈ 14 plates un-seated, reverse accretion order); torn plates are drawn as 2×2 / 2×3 chips on their way INTO the rib gaps; `heat` 1.4 |
| 3 | 110 | | inhale: neck in a tight S, ribs spread 2 px, wings wide; **≈ 16 more plates torn**, the chips stream into the ribs; `heat` 1.8 |
| 4 | **130** | | full wind-up (the longest frame, HA-3): **the last plates gone, bare bones round a white heart** (2×2 `white` + `fire4` ring); head high and back, jaw shut, light between the teeth |
| 5 | 50 | (swing) | the head whips forward and down; crest streams back; the bare wing struts snap forward |
| 6 | 70 | **release** | head DOWN at floor level, jaw wide; muzzle ≈ (106, 88); 2-px smear behind the skull (HA-12) |
| 7 | 80 | | exhale: the bare wing struts pump forward over the cloud; heart `fire3` |
| 8 | 90 | | the exhale tails off; heart `fire2` (spent) |
| 9 | **90** | **contact** | **the watch**: bare-boned, head low and tilted, jaw half shut, eye on the target, struts half open. HA-3 compliant 90 ms nominal; the cinematic **holds it with `holdFrame(u, 'attack', 9)`** through the silence (§5.2), like the magus' aim frame. |
| 10 | 100 | **recover** | **the heart answers** (when the fuse reaches the jaw): `fire4`; the rib bars flex open 1 px (`ribFlex`); **re-growth 1**: ≈ 14 hem plates re-seat, each with a 1-frame `fire2` weld on its inside row |
| 11 | 110 | | **the rib spill** (§4.4.1); re-growth 2 (≈ 28 seated); the head lifts |
| 12 | 120 | | the spill cools at the talons into a small `fire1` / `stone2` ash FAN (not a puddle); re-growth 3 (≈ 40); wings fold over the shoulders |
| 13 | 140 | | all 44 seated, the welds cooled (appended end = idle f0; the cinematic continues the fan as a floor mark) |

charge→release = 110 + 90 + 110 + 130 + 50 = **490 ms**. Strike start (f2) → release = **380 ms**. HA-15 in ≤ 2.0. Points: `muzzle` every frame (HA-25); on f6–f8 it is at floor height.
- **HA-17 risk (f1 → f4):** the cloak is ~55 % of the silhouette; the tear is spread evenly over three frames (≈ 14 / 16 / 14 plates) and each frame keeps the wrist peaks and spurs, so no frame-to-frame jump removes more than ~20 % of the opaque mask. Gate it on the first attack sheet; if HA-17 > 1.8, let 6 plates survive to f5 and go with the swing.
- The opaque mask changes heavily during the attack; P2 relight keeps it identical (same seeds).
- The spill never touches rows < 2 px from the frame edge; the fan sits on rows 96–99 only in f12 (attack is not an HA-9 anim).

#### 4.4.1 The rib spill at 1× (attack f11, summon f11, victory f5–f6)
1-px grains inside a 74×84 body read only as a shimmer, so the spill is specified for the board:
- **≥ 30 lit px per spill frame** (`fire3` / `fire2`, `fire4` only at the gap mouths).
- **Two 2-px-wide streams** pouring from 2 rib gaps (the lowest two), running down over the talons, plus scattered 1-px grains around them.
- The cinematic adds 6–8 `Sparks` 'px' grains (`fire3` → `fire1`) from `ASHEN_RIBS` that **reach the floor** and a `fire2` light pool step at the talons (r 10, 0.4 → 0 over 300 ms).
- **Verify on the 1× board strip**, not only on the ×3 sheet (§9.2).

### 4.5 victory "Kor Dökülmesi" (the long form, 10 f) and roar (compact, 9 f)
**Where they play (verified):** the v3 duel end (`v3small/end.ts:777-783`) plays `victory` with `hold: true` whenever the unit has it, and only falls back to `roar` otherwise; the v3 position change (`summon-b/position.ts:11`) and the v3 flip never roar. So the long form IS the victory, and the roar is the small fallback.

**victory, 10 f** (holds `80 110 160 60 110 100 100 120 140 290`, sum 1270; the last frame is held by the end screen):

| f | Pose |
|---|---|
| 0 | idle f0, LUB |
| 1 | DUB; head draws back under the hood; wrists rise |
| 2 | the **mantle**: both wings spread forward and DOWN into a canopy over the floor in front, the head low under it |
| 3 | the jaw drops (in-between) |
| 4 | jaw wide, the hollow roar silhouette; **the ribs flare open** (`heat` 1.9), crest flared |
| 5 | the spill pours between the bars over the talons (§4.4.1, two streams) |
| 6 | the grains run down the talons; the canopy shudders, row-1 plates lift (`fire2` lips) |
| 7 | the ribs close; the spill at the talons cools to `fire1`; ≤ 3 flakes shaken off |
| 8 | the wings fold back up over the shoulders; the fan `stone2` / `fire1` |
| 9 | **held**: the hood re-formed, head low in the S, the cooled `stone2` / `stone1` fan at the talons, the heart at rest. Not idle f0 (the fan stays): HA-2 exempts the held last frame. |

Sound: the end screen plays its shared `roarBig` sting (`end.ts:788`); there is no per-card victory role. Optional ask Q8 (§10).

**roar, 9 f** (holds `70 100 120 50 100 90 100 110 120`, sum **860**): idle f0 → charge (wrists up) → a half mantle → jaw → **release** (ribs flare, a short spill) → grains → **recover** (ribs close) → the fan cools → appended idle f0. Shown on the dev sheet; it plays in game only for a path that has no `victory` (none in v3 today).

Margin ≥ 2 px to the frame edge (Sİ-2) for both.

### 4.6 hit (6 f), hitHeavy (8 f), hitMagic (8 f)
f0 = struck frame, only the struck region moves (HA-21 target 30–40 %); f1 = the in-between (`recoil()`, HA-22).
- **hit** `50 70 120 100 90 80`: the skull snaps back up under the hood, eye shut, ribs in 1 px, 3 flakes knocked off; the heart **skips** (one tone down f0–f1). recover f3 (240 ms).
- **hitHeavy** `60 70 100 110 90 90 80 80`: the hood collapses on the near side (wrist −3 px), one talon steps back and in (the only foot move, HA-9 does not cover hits), heart `fire2`. recover f4. `poseKnockPx [1, 2, 2]`.
- **hitMagic** `50 60 80 80 100 90 80 80`: the spell lights the ember inside: heart and ALL rib gaps `fire4` / `white`, eyes blaze, the hem lip runs `fire3`; rigid 1-px shudder, cloak a frame behind. recover f4.

### 4.7 summon: 14 f, 1.35 s (`land` 1), bones bottom-up + cloak by ACCRETION, `hologram: false`
Two separate builds, so no frame shows a straight build edge:
1. **Bones** (talons, legs, ribs, neck, skull) are masked below `boneBuild` (frame y 99 → 6). There is **no lip on the bone line**: the cinematic's tornado ribbons cover it ±6 px (§5.1). Above the line, nothing.
2. **The cloak** is built by plates **flying out of the tornado and sticking** in scattered patches: each frame seats the next N plates in a seeded order that is hem-first but spread across both cloaks (row k seats only when ≥ 60 % of row k+1 is seated). A plate seats with a 1-frame `fire2` lip (the ember weld) on its inside row, then its true tones. The unseated plates are drawn by the cinematic as flying 2×2 / 2×3 chips that land on their slots (`ASHEN_BUILD[f].seats` exports each frame's newly seated plate positions).
The body is in its true colours for 100 % of the pose (EF-11).

| f | ms | Mark | boneBuild top | plates seated | What is complete |
|---|---|---|---|---|---|
| 0 | 80 | | y 96 | 0 | talon tips, the tail brazier (lit) |
| 1 | 70 | **land** | y 86 | 0 | both talons gripping, the legs |
| 2 | 70 | | y 74 | 4 (hem patches) | belly, tail, lower ribs |
| 3 | 90 | | y 60 | 10 | the rib cage; **the heart ignites: LUB-DUB** (`heat` 2.1, white 2×2) |
| 4 | 70 | | y 48 | 18 | shoulders, wing roots; the cloak a patchwork of seated plates and gaps |
| 5 | 70 | | y 36 | 28 | the S-neck; the wrists up |
| 6 | 90 | | full | 38 | skull and crest; eyes dark |
| 7 | 60 | | | 44 (all) | **peak**: the wings BURST open (full span, loose plates flying); eyes ignite |
| 8 | 200 | | | | the spread; **the cinematic holds this frame through the cut-in** (`holdFrame`) |
| 9 | 90 | | | | the wings start to fold |
| 10 | 100 | | | | the cloak slams down over the shoulders (**the shock ring beat**) |
| 11 | 110 | | | | **rib spill** (§4.4.1: ≥ 30 lit px, two 2-px streams): the ribs flex, embers pour out between the bars over the talons. **the cinematic resolves when f12 starts**; f12–f13 play on in the background (§5.1) |
| 12 | 130 | | | | the spill cools into an ash fan; the neck lowers into the S |
| 13 | 120 | | | | (appended end = idle f0) |

### 4.8 death: 12 f, 0.86 s (`impact` 0, `contact` 0, `dissolve` 5): top-down, and the heap belongs to the cinematic
Continues from the lethal reaction (`_v3/posematch.ts`). Crumble: `crumblePass` with an **ASH style** (groove `stone0`, recess `night0`, lip `stone2`, glow `[fire1, fire2]`), origin the crest, front running DOWN.
**Rule (§11 #4):** the heap is drawn ONLY by the cinematic layer (`ashHeap`, from f9 on). The art's f9–f11 draw only what is still falling or standing above the heap, so the kit's shatter of the last frame breaks a near-empty frame and nothing is drawn twice.

| f | ms | Pose |
|---|---|---|
| 0 | 50 | struck (the lethal contact) |
| 1 | 60 | the reel: head thrown up, cloak flared |
| 2 | 60 | the heart flickers `fire4` → `fire2`; the hem lips go out |
| 3 | 70 | the knees buckle, the perch sinks 3 px |
| 4 | 60 | the crest smokes (2 `stone2` curls) |
| 5 | 70 | **dissolve**: the crumble starts at the crest |
| 6 | 70 | skull and neck collapse into the chest; cloak plates slide down in sheets |
| 7 | 70 | the cloak gone to the shoulders; **the heart hangs bare in the ribs** |
| 8 | 80 | the ribs fold; **the heart drops** 6 px; the lower body crumbles into falling grains |
| 9 | 80 | (heap now in the cinematic layer) the last rib stubs and the tail with its brazier; the heart at the heap-top position |
| 10 | 90 | the brazier tips over and falls (into the layer's heap); the heart `fire2` |
| 11 | 100 | near-empty: the heart's `fire1` eye + 3–4 brazier embers only (≈ 10–20 px) |

Destroy total ≤ 1.4 s scene (pose 0.86 + burst + flight ≈ 0.3).

### 4.9 revive: 12 f, 1.18 s (`land` 6): plates fly in one by one, each re-lit by a heartbeat (never the summon, HA-28; never the sentinel's reassemble path)
Holds `80 90 70 90 90 100 110 90 100 110 120 130`.
- f0: a low ash heap (drawn by the art here: no shatter follows a revive), the heart's eye in it.
- f1–f2: the heart beats twice inside the heap (`fire2` → `fire4` → `fire3` → `fire4`); the heap's top lifts.
- f3–f5: the bones stand up out of the heap bottom-up, bare and grey, the heart rising into the ribs.
- f6 **land**: the talons grip.
- f7–f10: **the plates fly in one at a time** from the heap (4–6 per frame, wrist first this time), and every seated plate's hem lip lights `fire2` on the frame it lands, keyed to a heart pulse (the heart steps `fire3` ↔ `fire4` each frame): the drake is re-lit plate by plate.
- f11: first breath, LUB-DUB → idle f0. (Holds sum **1180**.)

### 4.10 points()
`muzzle` (every frame), `core` (the heart; falls on death f8–f11, rises on revive), `head`, `claw`, `feet`, default `core` (55, 60). Export `ASHEN_MOUTH(anim, frame)` and `ASHEN_RIBS(anim, frame)` (the spill origin) and `ASHEN_BUILD` (§4.7).

---

## 5. Cinematic storyboards

Kit APIs used (verified):
- `src/cinematics/strikes-a/_kit.ts`: `Sparks`, `FloorMarks` (`blob`, `flame`, `crack`), `layer`, `animate`, `onFrame`, `overlay`, `currentPixels`, `holdFrame`, `playFrom`, `seed`, `RR`, `sourceOwnsDestroy`.
- `src/cinematics/summon-a/_kit.ts`: `signatureSummon`, `holdFrame`, `playFrom`, `untilFrame`, `S.climax`, `S.finale`, `S.ctx.base()`.
- `src/view/light`: `lightPool`, `lightFlash`, `lightDim` (`index.ts:166`); `followLight` from the strikes-a kit.
- `shake` (`src/vfx/core`), `stopTime` (`src/vfx/combat`).
- `src/cinematics/_v3/sound.ts`: `takeCharge`, `start` (handle `.stop(ms)`), `play`, `fade`, `atMark`, `atFrame`, `panAt`.
- `strikeStartFrame`, `backlash` (`_v3/clash.ts`), `deathV3` (`_v3/death.ts`, `onBurst`).
- `u.playToFrame`, `u.playRange`, `u.rangeMs`, `u.markFrame`.
- Whole pixels and palette tones (EF-7), stepped light (EF-6), no camera move (EF-8), no `setScale` / `setAngle` (HA-11), no full-screen wash (EF-4).

### 5.1 Summon (signature entrance, tribute ace): entrance ≤ 1.95 s scene (+ the tribute stream) → ≤ 4.35 s game
`signatureSummon('ashen_drake', (S) => S.ctx.base(), { v3: ashenRiseV3 })` inside `if (LOOK_V3)`.
**Budget math (verified):** the tribute stream before us is the shared `summon-a/tribute.ts`: a 300 ms card fly (`:104`), then the streams of 420–440 + 90·(n−1) ms (`:140-158`), then the slam. `summon-a/crystal_wyrm.ts:265` measures it: "the summon starts ≈ 1.17 s in". So the entrance itself gets **≤ 4.35 / 1.35 − 1.17 ≈ 2.05 s scene**; the plan lands at **1.88 s** (pre-pose 260 + f0–f6 540 + f7 60 + the f8 hold under the cut-in 720 + f9–f11 300 → resolve at 1880), inside the ≤ 1.95 s target. **Total ≈ 1.17 + 1.88 = 3.05 s scene ≈ 4.12 s game** (≤ 4.35). Re-run `kaAdSummon` in `measure` with placeholder frames (correct holds, blank art) **before drawing any summon frame**.
**The unit is driven directly, as `summon-a/crystal_wyrm.ts`'s climax path does, not through `S.pose` / `summonPose`** (which plays the whole anim with no frame hold, `_v3/summon.ts:83`): `u.pose('summon', 0)` → `await u.playToFrame('summon', 8)` → `holdFrame(u, 'summon', 8)` → `await S.climax()` → `bg(playFrom(u, 'summon', 9))` → `await untilFrame(u, 'summon', 12)` → **resolve**. The f12–f13 cooling, the fan floor mark, the pool fade and the grey dust layer run in `bg()` (each checks `u.retired`).
**The tornado band follows the SHOWN frame**: an `onFrame` callback reads the unit's current summon frame and places the ribbon band on `ASHEN_BUILD[f].boneY` (±6 px), and spawns the flying plates for `ASHEN_BUILD[f + 1].seats` one frame ahead so they land on the frame that seats them. No clock drives the band.

| scene ms | Visual | Light / floor | Sound |
|---|---|---|---|
| 0–120 | **Ash mound**: a stepped ellipse mound grows on the tile (`stone1` base, `stone2` flank, `stone3` 1-px crest), 0 → 24×9 px; 4 dust puffs slide out | — (no generic circle) | `fade(['summonCharge'], 120)`; `ashenMound` |
| 40–160 (parallel with the mound) | **A single ember falls** from y −90: 1 px `fire4`, 2-px `fire2` trail, wobbling ±1 px | `followLight` `fire3` r 8, 0.3 | — |
| 160 | it **touches** the mound top: a 3-px `fire4` star, 1 frame | | `ashenEmber` |
| 160–260 | **Ring ignition**: two flames chase round the mound's base ellipse (r 28×12) from the back, meeting at the front | `lightPool(home, { color: fire2, spill: fire1, radius: 30, intensity: 0.6, anim: 'flicker' })` | `ashenKindle` (pans round with the ring) |
| 260 | the pose starts (driven, f0); the mound lifts into the **ash tornado** | pool → 0.9 | `start('ashenTornado')` |
| 260–800 | **The tornado builds it** (f0–f6): 10 stacked ellipse ribbons (`stone1` / `stone2` / `stone3`, 2 px tall) **RISING** by whole-pixel phase steps, 34 → 44 px wide, the band on the shown frame's bone line. **Plates** (2×2 / 2×3, `stone2` / `stone1`) are flung out of the ribbons on short arcs and stick onto the cloak in scattered patches (the art seats them). 12 embers orbit in the ribbons. | floor: ash grains rain off the column's skirt (`blob` `stone1`, life 900) | `land` f1 (340): `ashenTalon` · f3 (480): `ashenHeartbeat` 0.9 (**the chest "güm"**) |
| 800 (f7) | **The wings burst out of the storm**: the column explodes into the last 16 loose plates + 10 ember sparks (gravity 160, drag 2). **No drawn ring here.** | `lightFlash(fire3, r 36, 260 ms, { ring: true })` (the only ring at this beat) | `ashenTornado` handle `.stop(90)` · `ashenRoar` is NOT here (the cut-in owns it) |
| 860 (f8 held) | **The cut-in** (`S.climax()`): the band passes under the tile (EF-10); ash flakes drift through it | the pool holds at 0.6 | the cut-in flare plays the CHARACTER `roar` = `ashenRoar` |
| 860 + 720 = 1580 | the band exits → `bg(playFrom(u, 'summon', 9))` | | |
| 1670 (f10) | **the cloak slams over the shoulders → LANDING ASH SHOCK**: `S.finale({ ring: 92, ramp: RAMPS.stone, freezeMs: 50, shake: 3, playerRing: false, sfx: null })` — the kit's shockwave is **the one ring** (EF-7); 8 ash billows (stepped discs, `stone3` / `stone2` / `stone1`) **ride its front** as debris, not a second ring | **1 s grey dust layer** (bg): sparse 2×1 `stone1` clumps on the tile + 4 neighbours, fading `stone1` → `night2` → gone by +1000; `lightFlash(fire2, r 30)` under the chest | `ashenLand` (played by us, since `sfx: null`) |
| 1770–1880 (f11) | **the rib spill** (§4.4.1) + 6–8 `Sparks` 'px' `fire3` → `fire1` grains from `ASHEN_RIBS` reaching the floor | a `fire2` pool step r 10 at the talons | `ashenSpill` |
| **1880 (f12 starts)** | **the cinematic resolves.** In `bg()`: the spill cools into the fan; the fan becomes a floor mark (`blob` `stone1` / `fire1` rim, life 1400); f13 → idle | the talon pool 0.4 → 0 over 300 ms; the main pool fades over 240 ms | (the `ashenSpill` tail rings on) |

- Entrance ≈ **1.88 s** + tribute ≈ 1.17 s ≈ **3.05 s scene → ≈ 4.12 s game** (≤ 4.35; ≈ 0.23 s margin, which covers the 2nd tribute's +90 ms stream and frame quantisation). If `measure` reads over 4.25: f7 60 → 40 and f9 90 → 70.
- Cut-in rhythm (recipe): `{ flare: 300, slam: 430, exit: 720 }`, close 120. The portrait's frames are aligned to it (§7.2).
- **Without a cut-in** (`S.cutIn` false; no v3 source today): no hold on f8; `ashenRoar` 0.75 plays at f7; the finale at f10 as above; the entrance shrinks by ≈ 0.66 s.
- **P2:** offsets mirrored with `S.dir`; the tornado rotates the other way.
- **No "climbing from the floor"** (§5: only R2 and C10): the storm BUILDS it.

### 5.2 Attack vs monster (it wins): budget 1.6–2.2 s scene → ≤ 3.19 s game
`registerStrike('ashen_drake', ashStormV3, { name: 'strikes-a:ashen_drake' })` inside `if (LOOK_V3)`. The strike starts on `strikeStartFrame(u) + 1` (the declaration showed f1).
**Budget math (§11 #1):** the target's death + card flight starts 150 ms after contact (`DEATH_AFTER_CONTACT_MS`, `_v3/budget.ts:14`) and ends the scenario; measured contact → end on existing strikes is 1.13–1.77 s game. So contact must land ≤ **0.78 s scene** after the strike start: (0.233 + 0.78) × 1.35 ≈ 1.37 s game + ≤ 1.77 = **≤ 3.14 s** (limit 3.19). With f4 at 130 (was 150) the timeline below has **20 ms scene of standing slack**; target ≈ 2.9 s.
Let T = cone travel = `clamp(dist × 1.6, 200, 240)` ms; swallow at 380 + T (580–620); silence **160 ms scene ≈ 216 ms real** (never < 140); **contact at 740–780**.

**When the strike resolves (§12 #3).** `battle.ts:228` / `:577` await the whole strike (`Promise.race([strike, wait(6000)])`), and `strikeDone` gates the attacker's own death (`battle.ts:553`). So:
- **win / direct:** the strike resolves at **contact + the kit's hit-stop**; the fuse, the spill, the re-growth (f10–f13) and the ash snow run fire-and-forget (`void …`, as the other strikes-a files do), each checking `u.retired`. The battle only needs `strikeDone`; the anim keeps the sprite until f13 hands it back to idle. **Verify** on `kaAdDirect` that nothing in the battle tail re-poses the attacker before f13 (if it does, the re-growth is cut short — then resolve after f10, still inside the budget).
- **lose / tie:** resolve AT contact (the attacker's death must start), no fuse.

| scene ms | Attacker | Visual | Light | Sound |
|---|---|---|---|---|
| 0 | f2 | **the cloak tears**: the hem plates rip off as 2×2 / 2×3 chips and are SUCKED INTO the rib gaps (the art draws the chips on the frame; the cinematic adds 6–10 `stone2` / `fire2` motes per 100 ms to `points().core`): it feeds its heart with its own cloak | `lightPool(home, fire2 → fire3, r 28, 0.15 → 0.8, 'flicker')` | `takeCharge(u, 'ashenInhale')` (from the declaration) |
| 0–380 | f2–f5 | the tear finishes at f4: **bare bones round a white heart**; f4: 1 px `white` between the teeth | `followLight(mouth, fire3, r 10)` | (`ashenInhale` carries 3 plate-rip "tch" grains on f2–f4, §6.2) |
| 380 | f6 release | **the ASH BANK** is born at `muzzle` ON the floor (§5.2.1): the cloak, exhaled | jaw light fades (140) | charge handle `.stop(30)`; `play('ashenExhale')`; `start('ashenRoll', { pan })` |
| 380 → 380+T | f6–f8, then `holdFrame(u, 'attack', 9)` when f9 is reached | the bank ROLLS to the target, 10 → 28 px tall; its leading edge leaves a **soot trail** (`blob` `stone0`, rx 3, life 1400; positions kept for the fuse) | a dim `fire1` pool travels with the bank (0.2) | at swallow − 40: `play('ashenHush')` (the duck, §6.2) + `fade(['ashenRoll'], 40)` |
| 380+T | f9 held | **SWALLOW**: the front billow settles over the target (no crest, no crash: the bank simply arrives and its top lip keeps rolling backwards). A LATTICE veil with 1–2 px gaps every 4 px, ≤ 70 % of its height (EF-2) | the travelling pool goes out; **`lightDim(scene, -0.3, 60)`** (floodlights dip, not a wash) | **`play('ashenLub', { pan: target })`: the ONE event of the silence** |
| swallow + 0 | f9 held | **LUB, the countdown begins** (bold idea 2): the drake's heart beats once — a `lightPool` pulse at `points().core` (r 8, `fire3` 0 → 0.7 → 0 in 3 stepped frames; light only, no paint on the sprite) — and on the same frame **the target tile's floor light dips one step** (the veil's dim `fire1` underglow goes out) | | `ashenLub` (≤ 60 ms real to −40 dBFS) |
| +0 … +160 | f9 held | **SILENCE**: the veil hangs almost still; its buried embers go DARK in 3 visible steps (each step one third of them `fire2` → `fire1` → gone) — **visual only, no ticks** | the darkest beat | **nothing**: ≥ 100 ms real under −40 dBFS (`--music off`) between the LUB's tail and the suck (gate, §9.3) |
| contact − 40 | f9 held | the last embers flicker INWARD toward the target centre on this frame (1 px) | | `play('ashenSuck')` (≈ 54 ms real lead) |
| **contact (740–780)** | f9 held | **IGNITION — the VUF lands where the DUB should be**: `s.impact(at)`. Frame 0 = the kit's `contactFlash` (§5.2.2). EVERY ember in the veil turns `fire4` / `white` on the same frame; over the next 2 frames the billows step inside-out to `fire2` / `fire3` bands (stepped, no alpha); the target is a **black silhouette** with 1–2 px `fire3` / `fire4` flame tongues (§5.2.2 frame order) | `lightFlash(at, fire3, r 40, 300, { ring: true, intensity: 1 })` + `lightPool(at, fire3 → fire2, r 30, 1.2, 'flicker')`; **`lightDim(scene, 0, 300)`** | `play('ashenIgnite')` (the VUF at t = 0) + the struck body (kit) |
| contact + hit-stop | | the hit-stop (heavy 115–130) holds; shake from the kit 3 / 4 px. **The strike resolves here** (win / direct). | | |
| +0 … +440 (bg) | | **burn-off**: flames lick up 3 frames, then the veil burns away top-down into falling ash flakes (gravity 120, flutter 12) and cooling embers | **floor scorch**: `blob` `stone0` rx 14 + 6 `crack`s `[fire2, fire1, stone0]`, life 1400 | `ashenIgnite`'s crackle tail |
| +130 … +370 (bg) | f9 held → f10 | **THE FUSE BACK**: the soot trail lights in a chain from the target back to the jaw in 4 stepped segments, 60 ms each (`fire3` → `fire1` → `stone0` per segment), each smaller. When it reaches the jaw: `playFrom(u, 'attack', 10)` — **the heart answers** and the **rib spill** pours (§4.4.1) while the cloak re-grows (f10–f13) | a small `fire2` flash per segment (r 8 → 5) | `ashenFuse` (vuf-vuf-vuf, shrinking) then `ashenHeartbeat` 0.8 at the jaw |
| +370 … +740 (bg) | f10–f13 | the spill cools at the talons; a floor fan mark continues it (`blob` `stone1` + `fire1` rim, life 1400); the plates fly back onto the cloak with `fire2` welds | `fire2` pool step r 10 at the talons, 0.4 → 0 | `ashenSpill` 0.7 + `ashenRegrow` (§6.2) |
| +440 … +3400 (bg) | | **ash snow** (bold idea 3, golden rule 2): 6–10 single `stone2` / `stone1` flakes (1 px, a few 2×1) drift down onto the scorched tile from ≈ 40 px above it, one every ≈ 300 ms, flutter ±1 px, each settling for 400 ms then blinking out. **Flakes only, never a tile scar** (clear of `venom_drake`'s "the scar remembers"). Killed on the spot if a unit is summoned on that tile or the tile is cleared. | — | silent |
| parallel | | the target's death starts 150 ms after contact | | |

**Re-measure `kaAdAtk` (vs `stone_sentinel`, the primary film, §8.5) and `kaAdAtkLongDeath` before KK-1**; measure with blank placeholder frames first, as for the summon.

#### 5.2.1 The ash bank (`ashCone` in `-fx.ts`): a pyroclastic flow, not a wave
- 7–10 **billows**: stepped discs with three bands (`stone3` top lip toward the light, `stone2` body, `stone1` underside), on the floor line, ry = 0.55 rx.
- **They tumble BACKWARDS**: each billow's top lip moves 1 px per frame TOWARD the attacker while the billow advances, so the bank boils over itself like a pyroclastic flow. **No rising lip, no crest, no crash**: the bank's top edge stays lower at the front than in the middle (a nose that hugs the floor), the opposite of `tide_golem`'s cresting wave.
- New billows spawn at the muzzle every 40 ms for the first 160 ms, then the bank travels as one, its tail thinning.
- **It is the cloak**: the first billows carry 6–8 recognisable 2×3 plate chips (`stone2` with a `stone1` crease) tumbling in their lip for the first 120 ms before they break into billow bands, so the eye links the stripped hood to the bank.
- 14 buried embers: 1 px `fire2`, blinking slowly (2 on / 3 off).
- Width = the tile's width at the target; iso 2:1 axes.
- No alpha, no ADD blend (EF-7). It is lighter than the floor (`stone2` / `stone3` over `night2`) but far darker than any other breath in the game (no fire, no light until the ignition).

#### 5.2.2 Flash, silhouette and EF-3 (card-level exception, logged for the orchestrator)
- EF-3 says the sprite's own colour is not painted. **R1 itself asks for "hedef turuncu içinde kara silüet"**: this is the card-level exception, cited from YENI_KARTLAR §8 R1, logged in `docs/v3/oturum-a.md` for the orchestrator.
- **The kit's flash would be VIOLET today (verified).** `battle/battle.ts:106` (and `:377`) sets `aRamp = ATTRIBUTE_RAMP[attacker.attribute]` = the void ramp for DARK; it feeds the hit reaction, so `contactFlash` gets `tint: o.ramp[4]` = `void4` and `combatImpact`'s sparks are void (`_v3/react.ts:603, 613`, `blow: 'magic'` takes `o.ramp`). `s.impact(at)` takes no ramp and the recipe's `light.strike` only sets the floor light. **Asked NOW (Q9, additive):** `attack.ramp?: RampName` on `PresentationRecipe` (`src/presentation/types.ts:110`), and in `battle.ts:106` / `:377`: `const vr = attacker && v3Recipe(attacker.cardId)?.attack.ramp; aRamp = vr ? RAMPS[vr] : …existing…` (at `:377` the check goes before `physicalThrow`). Our recipe then sets `attack.ramp: 'fire'`. Without the hook the signature frame is violet: **KK-1 for the attack does not pass without it.**
- The flash's CORE stays `surf.flash`, the target's material colour (the kit's rule, not ours to override); with the hook, the tint and the sparks are fire and the orange is carried by the veil bands, the flame tongues and the light.
- **Frame order and coverage:** the flash covers only 34–45 % of the silhouette (`FLASH_COVER`) and runs **3 frames on a heavy hit** (2 on a light one). So:
  - frame 0 = the kit flash alone;
  - frames +1 … +(flash end) = the `ink` silhouette overlay (from `currentPixels(target)`, the target's CURRENT frame each frame) **under** the flash image (depth below it), so the uncovered 55–66 % reads black inside the orange;
  - then the silhouette stays **2 more frames after the flash ends** (+3, +4 on heavy; +2, +3 on light) with the flame tongues, so the black shape is seen clean at least twice.
  - After that the target's own reaction / death pose shows.
- Primary proof film: `kaAdAtk` vs `stone_sentinel` (a real v3 rig, §8.5), at ×3 frame by frame.

### 5.3 Direct attack: budget ~1.6 s scene → ≤ 2.32 s game
- The same cuts: f2–f5 380 ms (the cloak tears the same way); the bank rolls to the duelist's podium (`s.toGround`, `clamp(dist × 1.6, 200, 240)`) and swallows the podium base (veil 22 px). Silence **160 ms** with the LUB (floor 140).
- Ignition: a 3-frame column of flame up the podium front + a podium scorch + a 3-segment fuse back + the ash snow on the podium base.
- **The strike resolves at contact + hit-stop** (§5.2); the fuse, the spill and f10–f13 run in the background, because `battle.ts` awaits the whole strike and nothing on a direct attack runs longer than it.
- Budget: contact ≤ 0.78 s scene → ≈ 1.37 s game; + hit-stop (130 × 1.55 ≈ 0.2) + LP flow (≤ 0.4) + settle ≈ **2.0–2.15 s game** (≤ 2.32). (Rev. 2 awaited the fuse + `playFrom(10)`: ≈ 2.5 s, over.)
- If still over 2.32: travel 200 flat, silence 140 (the floor).

### 5.4 Blocked (the defender survives in guard; film vs `polar_sovereign` DEF 2800, provisional: lane D is rebuilding that card)
- The bank **piles up against the guard plane**: the billows splay sideways and climb the front face.
- Silence 140 ms with the LUB. The ignition happens ONLY on the front face (a 3-frame wall of flame); half of it rolls back toward the drake (a 30-px backwash cooling to ash). No fuse (the trail does not light: nothing burned).
- The target is NOT blackened. The kit's guard reaction plays.
- The drake survives bare-boned: at the backwash's end `void playFrom(u, 'attack', 10)` re-grows the cloak (f10–f13). The spill on f11 still plays (one attack anim, no variant): it reads as the heart's frustrated answer; the cinematic adds no fuse and no fan mark.
- The strike resolves at contact + hit-stop; the re-growth runs in the background.
- Sound: `ashenSnuff` at the pile-up, then `ashenSuck` + `ashenIgnite` at volume 0.6, pitch 0.85.

### 5.5 Losing (vs `crystal_wyrm` 2800 in attack position) and the tie
- Swallow, LUB and silence as normal. The fire **does not take**: only 3 embers pop (`ashenSputter`).
- On that frame the defender's answer comes back along the line (EF-13, `backlash(scene, from, to, ramp)`) and hits the drake → its death (§5.6). The fizzled veil sinks as grey ash in 300 ms; 8–10 of its plate chips fly BACK toward the drake on the backlash line (the cloak trying to come home), and the reaction's contact flash covers the drake's bare → cloaked frame change (the hit / death anims are drawn cloaked).
- **The strike resolves AT contact** (`strikeDone` gates the attacker's own death, `battle.ts:553`); no fuse, no re-growth.
- **Tie** (`steel_silencer` 2400): the full ignition AND the backlash on the same frame; no fuse (the drake is dying); resolves at contact.

### 5.6 Death (attack and defense): ≤ 1.4 s scene → ≤ 2.03 s game. The ash heap.
- **Handler:** `registerCardHook('ashen_drake', 'destroyed', ashenDeathV3, { name: 'strikes-a:ashen_drake:death' })` inside `if (LOOK_V3)`; `ashenDeathV3` returns `ctx.base()` when `sourceOwnsDestroy(ctx)` (strikes-a's own helper, `strikes-a/_kit.ts:725`), else arms `atFrame(u, 'death', 9, () => heap.start())` (`_v3/sound.ts:86`) and calls `deathV3(ctx, { fallback: () => ctx.base(), onBurst: ashHeapBurst })`.
- **Material (plan of record, needs the orchestrator now, §10 Q3):** an additive `'ash'` `ShatterMaterial` in `src/vfx/shatter.ts` (`SHATTER_MATERIALS` + `SHATTER_MATERIALS_LIST`), `_v3/presets.ts` `MATTER_RAMP` and `_v3/death.ts` `ACCENTS`:
  ```ts
  ash: { brick: [1, 2], speed: 0.15, up: [0, 6], gravity: 120, drag: 2.2, life: [600, 900], floor: 'rest', bounce: 0, flutter: 6, attract: 0,
         flash: [PAL.stone1], late: [PAL.stone1, PAL.stone0], lateAt: 0.5, blinkAt: 0.8,
         shards: 0, shardColors: [], shardShape: 'px',
         motes: 8, moteColors: [PAL.stone2, PAL.stone1], moteVy: [-14, -4], moteShape: 'puff' /* + sideways drift */,
         ring: null, shake: 0, stopMs: 0, pitch: 0.8 }
  ```
  No white, no shake, no stop: ash does not break, it settles. The recipe then reads `death: { material: 'ash', accent: 'fire' }`, which differs from `magma_titan`'s `{ stone, fire }`.
  **Until then:** `death: { material: 'stone', accent: 'fire' }` breaks only the near-empty f11 (≈ 10–20 px of embers), so the Titan-identical preset produces almost nothing on screen; the identity is the heap layer.
- **The heap (`ashHeap` in `-fx.ts`, the ONLY heap):** started on death f9 at the talons (`DEPTH.TILE_FX + 6`): a soft cone grows over f9–f11 from the grains the art drops (lit top `stone2`, mid `stone1`, base `stone0`, ≈ 30 × 14 px), the heart glowing `fire3` through a 2-px gap, the brazier embers falling into it.
- **`ashHeapBurst(u, at)` on the burst frame:**
  1. **It cools**: the heart eye steps `fire2` → `fire1` → `stone1` over 360 ms; one last smoke curl.
  2. **The wind takes it**: from +420 ms a gust (P1 → +x, P2 → −x) strips the heap top-down in rows into 1–2 px `stone2` / `stone1` particles (`Sparks` 'px', vx 60–110, vy −10…−30, drag 1.2, life 500–800, stepped blink-out). Gone by +1000.
  3. **The last ember goes out** (in place; `onBurst(u, at)` gets no card handle, `_v3/death.ts:269`, so there is no "rides the card" branch): the heart's last `fire1` pixel stays after the heap is gone, pulses once (`fire1` → `fire2` → `fire1`, the faint double tick `ashenLastBeat`), then **visibly dies**: `fire1` → `stone0` in a 2-frame blink and a 2-px `stone2` smoke curl rising 4 px and blinking out. With no rebirth rule, an ember that survived would read as a rebirth promise, so it must end dark.
  4. A faint grey stain on the tile (`blob` `stone0`, life 1200) fades last.
- The handler resolves when the card lands (the kit's rule); the heap layer finishes on its own (≈ 1 s after the destroy). **The layer is killed at once if another monster is summoned on that tile** (it polls the tile's occupant each tick and destroys itself, ember included), so a new arrival never stands in a ghost heap.
- **In defense** the kit's guard break opens the cocoon into death f0. **By spell** (Yıldırım Hükmü): same handler.
- **Sound** (CHARACTER roles): `deathStart` `ashenCrackle`, `dissolve` `ashenCrumble`, `afterDissolve [[3, 'ashenCoreDrop', 0.9]]`, `burst` `ashenCool`; `ashenLastBeat` from `ashHeapBurst`.

### 5.7 Signature moments (vanilla ace: the rebirth is dropped)
1. **The delayed ignition + the fuse back** (attack, THE signature): the cloak torn into the ribs ("the cloak is the ammunition"), the bank exhaled, swallow, the one LUB, silence (embers going dark, the hall dimming), the VUF landing where the DUB should be, black silhouette in orange, the trail burning back to the drake's own heart, the cloak re-growing plate by plate. Never shortened below 140 ms of silence, at any outcome.
2. **"Kor Dökülmesi", the rib spill**: the heart flares and embers pour out between the rib bars like sand through a grate, cooling to an ash fan. **Guaranteed** on every attack win (f11, after the fuse) and every summon (f11, after the shock). The long form (mantle + spill, ending on the held fan) is the **`victory`** the v3 duel end actually plays (§4.5).
3. **The double heartbeat** as a leitmotif: the board pool's double pulse every 2 s (§4.1), the summon's chest "güm", the attack's countdown (LUB … VUF), the fuse's arrival, the revive's plate-by-plate re-lighting, the last ember. No other **v3-look** card has a double low beat (`magma_titan`'s v1 summon has 3 chest thuds, `summon-a/magma_titan.ts:312`; v1 only).

No `effect` hook and no `special` anim.

### 5.8 Revive (`soul_recall`): budget ≤ 2.1 s scene
- Generic v3 revive on the `revive` pose (§4.9). Sounds: `reviveGather` `ashenReviveGather` (stopped on `land`) and `reviveLand` `ashenReviveBeat`. The plate re-lighting (f7–f10) is in the art; no extra hook.
- Verify in `kaAdRevive`.

### 5.9 Flip and position
- **Flip:** recipe `flip: { accent: 'sparks', ramp: 'fire' }` (ember motes, not the sentinel's `{ dust, stone }`). Phase 2 (optional): its own flip (cloak unfolds out of guard f0, 6 flakes peel off).
- **Position change:** generic v3 (`summon-b/position.ts`): it plays only `toGuard` / `fromGuard` and **never roars**. `kaAdPos` expects only `fromGuard`.

### 5.10 EF checklist (for the critic)

| Rule | What to check |
|---|---|
| EF-2 | the veil is a lattice and the silhouette reads through it |
| EF-3 | ignition frame 0 = the kit flash (tinted `fire4` via the Q9 ramp hook); the ink silhouette from +1 under the flash and 2 frames past its end (R1 card-level exception, logged) |
| EF-4 | white ≤ 1.5 % of the screen |
| EF-6 | every light stepped; `lightDim` −0.3 is a floodlight dip, not a wash |
| EF-7 | exactly one ring per beat: f7 = `lightFlash` ring only; f10 = the finale's shockwave only (billows ride it); `playerRing: false` |
| EF-8 | no `ctx.focus` |
| EF-11 | no hologram in the summon |
| EF-12 | the death continues the reaction; the card is born on the burst frame; the heap is drawn once; the last ember goes out |
| EF-13 | the losing ranged attacker is answered along its line |

---

## 6. SFX design (`src/audio/v3/ashen.ts`, kit blocks + Voice primitives only)

### 6.1 Identity
**R1 Kül Ejderi:** main pitch / colour = **50 Hz double ember heartbeat** (lub 62 → 46 Hz, DUB 170 ms later 56 → 42 Hz), **made audible on small speakers** by a 2nd/3rd-harmonic layer, a 150–180 Hz band-passed knock and the 160 / 320 Hz rib-tube band. Signature material = ash + ember. Distinguishing layer = **the delayed ignition**: a held breath holding ONE heartbeat (LUB), true silence, a short suck, then the VUF on the second beat — a brown-noise low-pass that slams open. (Rev. 2's three descending ember ticks are deleted: `venom_drake` owns "three dry fizz ticks in a held-breath silence", `venom_drake.md:153, 599`.)
Palette: no glass, no saw drones, no FM metal. Brown and pink noise, low sine thumps with harmonics, a hollow two-tube rib resonance (160 / 320 Hz band-passes), dry ember crackle (`crack` 1.5–4 kHz).
Target A-weighted centre ≈ 900–1300 Hz, energy < 600 Hz ≈ 0.6.

### 6.2 Recipes
Sustained sounds follow `wyrmBreathCharge` (`src/audio/v3/slice.ts:202`): rise for D, a plateau, a long natural fade, and the cinematic stops them on the mark with `handle.stop(ms)`. Lengths are sized in REAL seconds against scene × 1.35.

| Name | Role / when | Recipe (kit blocks) | duck |
|---|---|---|---|
| `ashenHeartbeat` | summon f3, fuse arrival, layered into land / reviveBeat / lastBeat | per beat: `thump(v, t, 62, 46, 0.55, 0.16, { drive: 1.5 })` + **the audible body**: the same thump `{ drive: 2.5 }` an octave up at 0.25 (2nd/3rd harmonics), a 165 Hz band-passed knock `v.noise('pink', { t, g: perc(0.05, 0.08), to: v.filt('bandpass', 165, 4, { t }) })` (`puff` is a low-pass with no `q`, `kit.ts:95`), the rib tubes `sweep(v, t, 0.18, [160, 170, 160], 0.05, { q: 8 })` + `[320, 340, 320]` 0.03; DUB at t = 0.17 (56 → 42, 0.4, 0.2, all layers × 0.8); an ember tick `crack(v, 0.24, 0.05, { hp: 2200, lp: 6000, n: 2, gap: 0.03, dec: 0.004 })` | 0.3 |
| `ashenMound` | `arrive` | `puff(v, 0, 0.3, 0.4, 600, { kind: 'brown' })`; sand trickle `crack(v, 0.03, 0.06, { hp: 3000, lp: 7000, n: 10, gap: 0.03, dec: 0.004 })`; `sweep(v, 0, 0.35, [900, 600, 300], 0.04, { kind: 'pink' })` | 0.2 |
| `ashenEmber` | the ember touches the mound | `v.tone('sine', 2200, { g: perc(0.06, 0.12, 0.0005) })` + 3300 at 0.02 + `crack(v, 0, 0.08, { hp: 5000, dec: 0.003 })` | 0 |
| `ashenKindle` | ring ignition | `sweep(v, 0, 0.14, [500, 2400, 1200], 0.12, { kind: 'pink', pan: [-0.5, 0.5], peakAt: 0.3 })`; `puff(v, 0.02, 0.2, 0.3, 1800, { kind: 'brown' })`; `crack(v, 0.05, 0.08, { hp: 1800, n: 4, gap: 0.04, dec: 0.006 })` | 0.25 |
| `ashenTornado` (sustained) | the build; `.stop(90)` on f7 | D = 0.5 rise, plateau to **1.4 s**, natural fade to 1.7: two rising pink sweeps `[200, 900, 1600]` / `[250, 1100, 1800]` (q 2, panned apart) reaching their top at D and holding; a brown rumble (160 Hz low-pass, `v.wander` gain); grains `crack` n 40, gap 0.03, hp 3500, density rising to D then steady. Covers 540 scene × 1.35 ≈ 0.73 s with slack for slow-motion. | 0.4 |
| `ashenTalon` | `land` (f1) | `thump(v, 0, 110, 50, 0.4, 0.3, { drive: 1.5 })`; scrape `crack(v, 0, 0.12, { hp: 2500, lp: 5000, n: 3, gap: 0.012, dec: 0.01 })`; `puff(v, 0.005, 0.2, 0.3, 900, { kind: 'brown' })` | 0.3 |
| `ashenRoar` | `roar` (cut-in flare) | `growl(v, 0, { d: 1.6, f: [46, 74, 64, 52, 36], formants: [260, 540, 1350], g: 0.9, grit: 6.5, rasp: 55 })`; hollow ribs `sweep(v, 0.05, 1.4, [150, 200, 150], 0.12, { kind: 'pink', q: 8 })` + `[300, 400, 300]` q 9, 0.06; the heartbeat at 0 (0.7); tail: ember crackle `crack(v, 0.9, 0.12, { hp: 1500, lp: 6000, n: 6, gap: 0.08, dec: 0.01 })` + a pink hiss hp 3 kHz fading 0.8 s. No glassRain, no bar partials. | 0.65 |
| `ashenLand` | the f10 slam (played by us; finale `sfx: null`) | `thump(v, 0, 70, 30, 0.8, 0.6, { drive: 3 })`; `puff(v, 0.004, 0.5, 0.9, 1200, { kind: 'brown' })`; settling `sweep(v, 0.05, 1.0, [1200, 600, 300], 0.08, { kind: 'pink' })`; heartbeat at 0.25 (0.6) | 0.6 |
| `ashenSpill` (new) | the rib spill (attack f11, summon f11) | sand through a grate: `crack(v, 0, 0.5, { hp: 2800, lp: 7000, n: 26, gap: 0.018, dec: 0.003 })` with density falling; a soft `sweep(v, 0, 0.5, [2400, 1400, 700], 0.05, { kind: 'pink', q: 1.5 })`; a cooling hiss `v.noise('white')` hp 5000, 0.04, fading 0.6 s | 0.25 |
| `ashenInhale` (sustained) | `charge` (declaration → release); `.stop(30)` on f6 | **plate rips**: 3 dry "tch" tears (a 6 ms pink burst through `v.filt('bandpass', 1800, 2)` + `crack` n 2, hp 2500) at 0.30 / 0.42 / 0.55 s real (the f2–f4 tear, with slack); D = 0.45 rise: reversed pink `sweep [600, 1600, 2800]` 0.12 reaching its top at D, then a **plateau to 1.1 s** (the held breath, a narrow 2.8 kHz band with a slow wobble), natural fade to 1.4; rib rattle `v.flutter(22, …)` on a 900 Hz band-pass through the plateau; two quickening heart thumps (48 Hz, with the harmonic layer) at 0.3 and 0.42. Covers (0.233 + 0.38) × 1.35 ≈ 0.86 s real with slack. | 0.3 |
| `ashenExhale` | `release` | `puff(v, 0, 0.45, 0.35, 2500, { kind: 'pink' })`; `thump(v, 0, 80, 40, 0.4, 0.25)`; `crack(v, 0.01, 0.06, { hp: 2500, n: 3, gap: 0.02 })` | 0.35 |
| `ashenRoll` (sustained) | the bank travels; `fade(['ashenRoll'], 40)` at swallow − 40 ms scene | `sweep(v, 0, 1.2, [800, 1800, 2500], 0.12, { kind: 'pink', q: 1.1, peakAt: 0.6, pan })`; a tumbling growl (brown, 180 Hz low-pass, amplitude wander 6–9 Hz); sparse ember ticks `crack` n 8 | 0.3 |
| `ashenHush` | swallow − 40 ms scene (≈ 54 ms real before the swallow), with `fade(['ashenRoll'], 40)` | **the duck carrier only, and it ends at the swallow**: the roll's last collapse, a brown `fff` under a 300 Hz low-pass, 0.03 peak at 0.015 s, gone by 0.05 s. **No ticks.** The engine's duck ramps 30 ms, holds 200 ms, then recovers (`audio/engine.ts:313-323`), so the music is at its lowest across the whole 216 ms silence. Depth: `amount` 0.95 → gain 0.525 (−5.6 dB; the engine's maximum is −6 dB at 1.0). | **0.95** |
| `ashenLub` (new) | the swallow (t = 0 of the silence), panned to the TARGET | **the one event of the silence**: the drake's LUB carried to the target: `thump(v, 0, 62, 46, 0.35, 0.05, { drive: 1.5 })` + the harmonic layer `thump(v, 0, 124, 92, 0.15, 0.04, { drive: 2.5 })` + the 165 Hz knock (dec 0.03) + the rib tube 160 Hz (dec 0.04). **Under −40 dBFS by +60 ms real** (gate), so ≥ 100 ms of real silence follows before the suck. | 0 |
| `ashenSuck` (new, split) | 40 ms scene (≈ 54 ms real) before `s.impact` | `sweep(v, 0, 0.055, [180, 600, 1400], 0.05, { kind: 'brown', peakAt: 0.95 })` — it peaks into the VUF | 0 |
| `ashenIgnite` | `impact` (the VUF = the DUB that never came; **the whomp at t = 0**) | the whomp `thump(v, 0, 90, 34, 0.7, 0.45, { drive: 2.5 })` (the DUB's pitch contour, an octave of weight up) + `puff(v, 0, 0.6, 0.5, 2600, { kind: 'brown', att: 0.002 })` + **the low-pass slam**: `v.noise('brown', { g: perc(0.25, 0.9, 0.002), to: v.filt('lowpass', [[0, 300], [0.03, 6000, 'e'], [0.9, 800, 'e']], 0.9) })` (it OPENS, then closes) + `crack(v, 0.002, 0.5, { hp: 900, lp: 5000, n: 3, gap: 0.009, dec: 0.02 })`; the fire bed (brown, 300 Hz band-pass, 1.0 s decay); sizzle `crack(v, 0.13, 0.12, { hp: 2500, n: 8, gap: 0.06 })`. | **0.8** |
| `ashenFuse` (new) | the fuse back | 4 shrinking whomps at 0 / 0.08 / 0.16 / 0.24 s real: `thump(90 → 34)` levels 0.35 / 0.25 / 0.17 / 0.11 + `puff(…, 2000 → 1200, brown)`, each panned from the target toward the attacker (`pan` interpolated) | 0.3 |
| `ashenSputter` | the losing ignition | three weak brown `puff`s (lp 1400, 0.12) at 0 / 0.09 / 0.2 + `crack` n 3 + a falling `sweep [900, 400, 200]` | 0.3 |
| `ashenSnuff` | the blocked pile-up | `puff(v, 0, 0.35, 0.3, 900, { kind: 'brown' })`; a muffled `sweep [300, 900, 300]` q 2, 0.12 | 0.3 |
| `ashenCrackle` | `deathStart` | `crack(v, 0, 0.2, { hp: 1800, lp: 6000, n: 6, gap: 0.03, dec: 0.008 })`; `thump(v, 0, 70, 40, 0.25, 0.2)` | 0.3 |
| `ashenCrumble` | `dissolve` | descending trickle `sweep(v, 0, 0.6, [3000, 1800, 700], 0.1, { kind: 'pink' })`; grains `crack` n 20, hp 3500, dec 0.004, gap 0.025; `puff(v, 0.1, 0.25, 0.5, 700, { kind: 'brown' })` | 0.35 |
| `ashenCoreDrop` | `afterDissolve +3` | a muffled `thump(v, 0, 120, 60, 0.35, 0.2)` under a 600 Hz low-pass; a hiss start (white hp 4000, 0.4 s) | 0.3 |
| `ashenCool` | `burst` | the cooling hiss (white hp 5000, 1.0 s); the gust `sweep(v, 0.25, 0.8, [400, 1400, 500], 0.14, { kind: 'pink', pan: [-0.4, 0.6] })`; the last 3 crackles | 0.3 |
| `ashenRegrow` (new) | attack f10–f12 (with `ashenSpill`), the blocked re-growth | the cloak re-seating: 10–14 soft "tk" welds (`crack` n 12, gap 0.035, hp 1600, lp 4000, dec 0.006, gain falling) + a 0.25 s pink `sweep [600, 1200, 900]` 0.03; quieter and lower than the spill so the two stay apart | 0.15 |
| `ashenLastBeat` (new) | the last ember's pulse | the heartbeat at 0.25 level, the sub-thumps removed (only the knock + rib tube + tick): a faint double tick; then a 0.15 s white hiss hp 5000 at 0.02 as it goes out | 0 |
| `ashenReviveGather` (sustained) | `reviveGather` | D 0.6 rise, plateau to 1.2, fade 1.5: rising pink `sweep [300, 1200, 2400]`, accelerating grains, 2 soft heart beats in the heap at 0.15 / 0.32 | 0.4 |
| `ashenReviveBeat` | `reviveLand` | the heartbeat ×2 at 1.4× level + `ashenKindle`'s puff | 0.5 |

- Export `V3_ASHEN_RECIPES`, `type AshenSfxName`, `ASHEN_SUSTAINED = ['ashenTornado', 'ashenInhale', 'ashenRoll', 'ashenReviveGather']`.
- Levels: `ashenIgnite`, `ashenRoar`, `ashenLand` peak ≤ −1 dBFS after `V3_CEILING` (SE-6).
- **Sync (SE-1):** `clip --marker ashenIgnite` must land on the ignition frame (≤ 1 frame); `ashenSuck` precedes it by 40 ms scene (≈ 54 ms real) on the frame the embers flicker inward; `ashenLub` lands on the swallow frame.
- **The silence gate (SE, §9.3):** on the `--music off` clip, between the end of `ashenRoll` and the onset of `ashenSuck` there are ≥ 100 ms real under −40 dBFS, and the only event in that span is `ashenLub`. On the music clip the duck is visibly ≥ 5 dB down across the silence.

### 6.3 Distinctness (SE-4)

| Neighbour | Risk | Why it stays apart |
|---|---|---|
| `stone_sentinel` (voice 'rumble', ≈ 49 Hz) | the same low register | Its rumble is unpitched brown noise with gravel. Ours is a PITCHED double thump with audible harmonics, a 165 Hz knock and silence between the beats. Measure LSD on `land` / `burst` / `dissolve`; if < 15 dB, move the heartbeat to 54 / 48 Hz and raise the rib band. |
| `abyss_magus` (36.7 Hz saw drone) | dark, low | No saw, no drone; all our lows are percussive. |
| `crystal_wyrm` | dragon roar | Formants 260 / 540 / 1350 vs 330 / 760 / 1950; rasp 55 vs 34; no glass tail. |
| `magma_titan` (v1 `earthQuake` / `impactHeavy`; v1 summon 3 chest thuds) | fire + weight; repeated thuds | We never use `earthQuake` or `impactHeavy` (the finale's default is turned off with `sfx: null`). Our beats are a pair with harmonics and a rib tube, and the "only double low beat" claim is scoped to the v3 look. |
| `tide_golem` | a rolling mass | Its wave is water (bubbles, splash). Ours is dry pink hiss + tumbling brown + ember ticks. |
| `ember_wolf` (v1 fire crackle) | crackle | Ours is sparse dry ticks; a fire bed only for 1 s after the ignition. |
| `venom_drake` (lane-mate) | drip / hiss; a held-breath silence with three dry fizz ticks | No liquid drips; the spill is dry grains through a grate. Our silence holds ONE low heartbeat and otherwise true silence: no ticks. LSD vs its roles. |
| C3 `cloud_hatchling` (lane-mate) | the wind ring whistle | No tonal whistle; our gust is broadband pink. |
| R2 `glassReverse` | — | never used |
| R3 the "pof" | — | `ashenSnuff` / `ashenMound` are brown low-pass thuds < 900 Hz, attackless |

### 6.4 Registration (additive)
- `src/audio/sounds.ts`: `import { V3_ASHEN_RECIPES } from './v3/ashen';` + `...V3_ASHEN_RECIPES,` next to `...V3_DAWN_RECIPES`.
- `src/audio/sfx.ts`: `import type { AshenSfxName } from './v3/ashen';` + `| AshenSfxName`.
- `src/cinematics/_v3/sound.ts` `CHARACTER_SOUNDS`, after `abyss_magus`:
  ```ts
  ashen_drake: { roar: 'ashenRoar', arrive: 'ashenMound', land: 'ashenTalon', charge: 'ashenInhale', release: 'ashenExhale', impact: 'ashenIgnite', deathStart: 'ashenCrackle', dissolve: 'ashenCrumble', afterDissolve: [[3, 'ashenCoreDrop', 0.9]], burst: 'ashenCool', reviveGather: 'ashenReviveGather', reviveLand: 'ashenReviveBeat' },
  ```

### 6.5 The struck body (SE-5): an own `ash` hit, asked NOW
`sound: { same: 'stone' }` would make every blow on the drake sound like `stone_sentinel` for the whole duel (`hitStone*`), against the SFX golden rule and SE-5. So the own ash hit is the plan of record, asked now (Q2), not a phase 2:
- **The ask (additive, other owners' files):** `GENERATED_HIT_MATERIALS = ['stone', 'ash']` (`src/audio/v3/materials.ts:119`) + the pinned lists in `tests/art/materials.test.ts:324-325` (`['stone', 'ash']`, and the six `hitStone* / hitAsh*` names). The `'crackle'` `RingSpec` kind already exists in the type (`src/art/materials/types.ts:55`) but has **no interpreter yet** ("A4"): the ask includes its interpreter in `materials.ts` (a `crack` train high-passed at `hp`, `rate` grains / s, decaying over 0.25 s Light / 0.4 s Heavy).
- **`ASH_SOUND` (data in `ash.ts`):**
  ```ts
  sound: {
    thump: [140, 70, 0.3, 0.1],            // a soft, dead knock: compressed ash, no ring
    surf: [1200, 0.18],                    // a pink-noise surface puff around 1.2 kHz (the ash cloud off the body)
    ring: { kind: 'crackle', hp: 2200, rate: 60 },   // the ember tail: dry crackle, never a pitched ring
    sizzle: 1800,                          // the magic variant: embers flaring under the spell
  },
  ```
- **SE-5 / SE-4 check:** LSD of `hitAshHeavy` vs `hitStoneHeavy` ≥ 15 dB median (no 49 Hz rumble, no gravel; a crackle tail instead).
- **Until it lands** the def keeps `{ same: 'stone' }` and this is logged as an open SE-5 gap in `docs/v3/oturum-a.md`, **not** shipped as the final design.

## 7. Card art and cut-in

### 7.1 Card art (`src/art/cardart-v3/ashen_drake.ts`, `CardArtV3`)
- **Subject (R1):** the drake perched on an ash heap at the cliff edge, ash streams blowing **to the RIGHT** (R1), the ember chest, a dark violet sky.
- **Backdrop:** `paintBackdrop(p, 'DARK', { focus, pool: true })` (`fire1` stepped pool under the heap).
- **big 88×68 — crop chosen (§11 #21):** the idle f0 pixels 1:1 from the hood peak to the knees (frame y ≈ 10 → 74, 64 rows) + **the talons sunk into the heap**: a new stepped `stone1` / `stone2` mound fills the bottom 8 rows of the card and covers the cut at the knees, so the heap reads and the hood keeps its full inverted U and spurs. 4 rows of air above the spurs.
  - Subject 60–75 % of the area, head in the right third.
  - The eclipse crown 4 px behind the hood peak.
  - **Ash streams (R1, blowing right):** 3 flat 2-px ribbons of `stone1` / `stone2` led from the **cloak hem's edge** (the wings' flaking edge, R1 "from the wings") and one from the heap's top, drifting RIGHT, passing **below** the jaw line and ending ≥ 4 px before the right edge; the air in front of the eye stays clear.
  - **The brightest point** = the heart (`fire4` + one `gold4`) at ≈ (46, 34).
- **small 44×34: the SAME composition**, made from the big one (KART_RESIMLERI: "one composition, small made from big then patched"): the big 88×68 reduced 2:1 (nearest, then re-quantised to the palette), then hand-patched at ×6: the heart re-placed as a 2×2 `fire4` + 1 `gold4`, the spur and the hood edge re-inked 1 px, the streams thinned to 1 px. `patch`, never `autoSmall`, never a different crop.
- **Living frames:** none in game. `cardface-v3/index.ts` blits only `renderArt(x, 0).smallPx` (verified), so extra frames would be gallery-only. One frame per size; the heartbeat is carried on the board by the floor-pool double pulse (§4.1), not by the card.
- **Wire it:** `src/art/cardface-v3/index.ts` `ART.ashen_drake` + the import.
- Acceptance: off-palette 0, isolated ≤ 10 %, checker ≤ 0.5 %, ≤ 20 tones (backdrop ≤ 6), outline ≥ 90 % ink (the hem lip is inside the outline), focus in the box.

### 7.2 Cut-in portrait (`src/art/cutins-v3/ashen_drake.ts`, 200×144, `p2: 'relight'`)
- **Concept "Başlık" (the hood):** the near cloak's wrist (with its claw spur) and hood fill the upper-left two thirds; 6–8 px plates, two tones (`stone2` / `stone1`), ember-eaten lower edges inside the outline. The skull emerges toward the right and down, crest streaming back. Below the jaw, **the rib cage with the heart — the slam's subject**. Key light top-left, `void2` rim.

| f | hold | Pose |
|---|---|---|
| 0 | 180 | the stare: the head deep in the hood's shadow, eye `fire1`; one flake leaving the hem |
| 1 | 120 | the eye ignites (`fire4`); LUB |
| 2 | 130 | **flare (at 300 ms)**: the hood lifts, the jaw cracks open (a hollow roar, no drool), throat `fire3`; DUB |
| 3 | 140 | **slam (at 430, = the recipe's `slam: 430`)**: **the ribs flare with light** — every rib gap `fire3` / `fire4`, the bars flexing open, a burst of ember grains spilling OUT between the bars; the eye `white` core |
| 4 | 330 | held: grains stream down through the rib bars, flakes lift off the hood |

- `accent: PAL.fire3`, `accentDark: PAL.fire1`.
- The lens glint picks the brightest isolated pixel of f0's head region: make the f0 eye the only `fire4` in it.
- P2 via `o.lightFrom`. Preview `?dev=cutin&id=ashen_drake&look=v3` (+ `&player=2`).

---

## 8. Integration plan (v1 stays byte-identical)

### 8.1 Why v1 is safe
- No v1 art (`placeholderTotem`). The v3 art / recipe / cut-ins are read only under `LOOK_V3`; the card face under `V3_CARDS`.
- **Every cinematic registration sits inside `if (LOOK_V3) { … }`.** Prove with filmdiff (§9).

### 8.2 The recipe: `src/presentation/cards/ashen_drake.ts`
```ts
import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';
export default {
  id: 'ashen_drake',
  tier: 'ace',
  body: { physical: 'ash' },
  attack: { type: 'beam', blow: 'magic', from: 'muzzle', vfx: 'ashCone', tone: PAL.fire3, ranged: true, blocked: 'splash' /* , ramp: 'fire' — added the day the Q9 hook lands (§5.2.2) */ },
  summon: { style: 'vortex', matter: 'stone', roarPeak: 4 },
  death: { material: 'stone', accent: 'fire' },   // → { material: 'ash', accent: 'fire' } the day 'ash' lands (§5.6)
  flip: { accent: 'sparks', ramp: 'fire' },
  voice: { custom: 'ashen_drake' },
  light: {
    glow: { emissive: [[PAL.fire4, 1], [PAL.gold4, 1], [PAL.fire3, 0.4]], halo: 0.55, pool: 0.8, spill: PAL.void2 },   // no fire2 / fire1: the pool follows the heart only (§4.1)
    strike: PAL.fire3,
  },
  cutIn: { rhythm: { flare: 300, slam: 430, exit: 720 } },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
```
- No edit to `_v3/presets.ts` / `view/light/profiles.ts` v1 rows.
- **No `custom.flip`** (and no other custom part): an all-custom recipe makes `accessors-v3.test.ts` compare against `DEATH_PRESETS.ashen_drake = { shadow, fire }` (`_v3/presets.ts:42`) and the old `MONSTER_GLOW` row (`profiles.ts:74`). The flip stays the recipe's `{ sparks, fire }`.

### 8.3 Cinematic hooks (all inside `if (LOOK_V3)`)

| File | Call | Event |
|---|---|---|
| `src/cinematics/strikes-a/ashen_drake.ts` | `registerStrike('ashen_drake', ashStormV3, { name: 'strikes-a:ashen_drake' })` | battle strike (all outcomes) |
| same | `registerCardHook('ashen_drake', 'destroyed', ashenDeathV3, { name: 'strikes-a:ashen_drake:death' })` (`sourceOwnsDestroy` → `ctx.base()`) | `destroy` |
| `src/cinematics/summon-a/ashen_drake.ts` | `signatureSummon('ashen_drake', (S) => S.ctx.base(), { v3: ashenRiseV3 })` | `summon` |

### 8.4 Other one-line edits
- `src/audio/sounds.ts`, `src/audio/sfx.ts`, `_v3/sound.ts` `CHARACTER_SOUNDS` (§6.4); `cardface-v3/index.ts` (§7.1); `materials/defs/ash.ts` (new).
- **Orchestrator asks (other owners' files; additive one-liners):**
  - `src/cinematics/traps/_mirror_v3.ts:1441` `STRIKE_RAMP`: `ashen_drake: RAMPS.fire` (today it falls back to `ATTRIBUTE_RAMP.DARK`, so the reflected breath is a violet bolt).
  - `src/cinematics/traps/chains_of_light.ts:210` `CHARGE`: `ashen_drake: [PAL.fire4, PAL.fire3, PAL.stone2, PAL.stone1]` (today it falls back to the generic gold glow).
  - The `'ash'` `ShatterMaterial` (§5.6, three files + `MATTER_RAMP` / `ACCENTS`, §3.4).
  - **Q9:** `attack.ramp?: RampName` on `PresentationRecipe` + its use at `battle/battle.ts:106, 377` (§5.2.2). Blocks the attack's KK-1.
  - **Q2:** `'ash'` in `GENERATED_HIT_MATERIALS` + the crackle ring interpreter + the pinned test (§6.5).
  - `shots/kart-a/camera-base.json`: add the new `kaAd*` keys (a measured base run) before the camera gate is used.
- Nothing in `src/data/cards.ts`.

### 8.5 Scenarios: `src/duel/scenarios/kart_a_ashen_drake.ts` (new)
Effect-free opponents are preferred so the films show only this card (`src/data/cards.ts` checked).

| Key | Stage / steps | Films |
|---|---|---|
| `kaAdSummon` / `kaAdSummonP2` | tribute summon (P1 / P2) | the full entrance + cut-in (measured with blank frames first, §5.1) |
| `kaAdBoard` | the drake idle on the field for 4 s next to a v3 neighbour | the floor-pool double pulse (§4.1) |
| `kaAdSummonOnHeap` | the drake dies, then a monster is summoned on the same tile within 1 s | the heap layer is killed (§5.6) |
| `kaAdAtk` / `kaAdAtkP2` | **primary** — vs `stone_sentinel` in ATTACK position (ATK 500, vanilla, a registered v3 rig) | dmg 1900 → **power 3**, posematch, the ink silhouette over a real v3 frame; swallow → LUB → silence → ignition → fuse → kill |
| `kaAdAtkTitan` | secondary — vs `magma_titan` (2100, attack; effect on summon only). **It still shows a v1 sprite in v3**: timing / budget only, not an art proof | power 2 |
| `kaAdAtkLongDeath` | vs `abyss_magus` (2300, attack position; set on the field, so its tribute effect does not fire; v3 rig) | the budget check against a long ace death |
| `kaAdDirect` / `kaAdDirectP2` | the opponent has no monster | the direct attack |
| `kaAdBlocked` | vs `polar_sovereign` in DEFENSE (2800; its effect only triggers on its destruction). **Provisional**: v1 sprite in v3 and lane D is rebuilding the card; re-film when it lands | the pile-up, the wall ignition, the LP loss, the bare-bone re-growth |
| `kaAdDefWin` | vs `stone_sentinel` in defense (2100 < 2400, vanilla) | the target's guard break |
| `kaAdLose` / `kaAdLoseP2` | vs `crystal_wyrm` (2800, vanilla) | the sputter, the backlash, the drake's death |
| `kaAdTie` | vs `steel_silencer` (2400; `trapLock` is passive) | ignition + backlash, both die |
| `kaAdHit` | the drake in DEFENSE, attacked by `volt_lizard` (1500; its effect needs its own destruction; v1 sprite in v3, the drake's side is what is filmed) | the cocoon holds |
| `kaAdKill` / `kaAdKillP2` | attacked by `crystal_wyrm` (2800) | hitMagic → death → the heap |
| `kaAdKillPhys` | attacked by `polar_sovereign` (3000). **Provisional** (as above) | hitHeavy → death |
| `kaAdGuardKill` | the drake in DEFENSE, attacked by `crystal_wyrm` | death from the cocoon |
| `kaAdBolt` | `judgment_bolt` destroys the drake | the spell death |
| `kaAdRevive` | `soul_recall` | the plate-by-plate revive + sounds |
| `kaAdPos` | the drake in defense; `changePosition` | **`fromGuard` only** (no roar in v3) |
| `kaAdFlip` | a face-down drake; `flipSummon` | the recipe flip (`sparks` / fire) |
| `kaAdChains` | the drake attacks into a set `chains_of_light` | the caught breath (ramp after the ask) |
| `kaAdMirror` | the drake attacks into a set `mirror_barrier` | the reflected breath (ramp after the ask) |

---

## 9. Verification plan

```sh
B=/tmp/claude-0/-home-user-yugioh/0bb2f57e-e830-54e9-b1e3-c08756cc3a08/scratchpad
export PLAYWRIGHT_BROWSERS_PATH=$B/pwb
O=$B/kart-a/ad
```

### 9.1 Sheets and gates (every round)
```sh
npx vite-node tools/monster-sheet.ts --id ashen_drake --look v3 --anims all --scale 3 --points --out $O/sheet
npx vite-node tools/monster-sheet.ts --id ashen_drake --look v3 --anims all --scale 3 --points --p2 --out $O/sheet-p2
npx vite-node tools/monster-gates.ts $O/sheet/ashen_drake-v3.json $O/sheet-p2/ashen_drake-v3-p2.json --class ace --ref none
node tools/shot.mjs "?dev=monster&id=ashen_drake&look=v3&mode=board" --out $O/board.png
node tools/shot.mjs "?dev=monster&id=ashen_drake&look=v3&mode=live&scale=3" --out $O/live.png
```
Thresholds (P1 and P2): Sİ-2 margin ≥ 2 px; HA-14 ≤ 1.2; HA-15 ≤ 2.0; HA-16 ≤ 1.4; HA-17 ≤ 1.8; **HA-18 ≥ 15 % (measured first on idle f0–f3, §4.1)**; HA-19 0.3–0.8; HA-20 ≤ 400 ms; HA-21 < 50 %; IŞ-10 ≤ 10 / 15 / 20 %; **HA-9 rows 94–99 fixed in idle / guard / toGuard / fromGuard (tail included)**; HA-1 / HA-25; IŞ-1 litBias > 0; KK-13; ≤ 20 colours; exactly 1 `gold4` in idle / guard / hit frames (except idle f1, the relax frame, which has none); **HA-3 attack: longest f4, release f6 ≤ 70, contact f9 50–90**.

**KK-1 reference gate:** idle f0 first, next to `crystal_wyrm`, `magma_titan`, `venom_drake` (lane-mate) and `grim_warden` at ×3 and ×1 on the board; the §1.3 contrast check; IoU low against all four. A critic approves before any anim.

### 9.2 Films (P1 and P2; LOOK at every PNG)
```sh
for s in kaAdSummon kaAdSummonP2; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 24 --every 160 --start 300 --cols 6 --out $O/$s.png; done
for s in kaAdAtk kaAdAtkP2 kaAdAtkTitan kaAdAtkLongDeath kaAdDirect kaAdDirectP2 kaAdBlocked kaAdDefWin kaAdLose kaAdLoseP2 kaAdTie kaAdChains kaAdMirror; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 20 --every 100 --start 200 --cols 5 --out $O/$s.png; done
for s in kaAdHit kaAdKill kaAdKillP2 kaAdKillPhys kaAdGuardKill kaAdBolt kaAdRevive kaAdPos kaAdFlip; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 16 --every 100 --start 200 --cols 4 --out $O/$s.png; done
# swallow → silence → ignition → fuse, frame by frame at 3x (set --start from measure's contactMs − 250):
node tools/shot.mjs "?dev=duel&s=kaAdAtk&look=v3" --fresh --film 30 --every 17 --start <contact-250> --clip 260,90,260,150 --scale 3 --cols 6 --out $O/ignite-x3.png
node tools/shot.mjs "?dev=duel&s=kaAdKill&look=v3" --fresh --film 80 --every 17 --frames $O/killframes --out $O/kill-all.png
node tools/shot.mjs "?dev=cutin&id=ashen_drake&look=v3" --scale 2 --out $O/cutin.png
node tools/shot.mjs "?dev=cutin&id=ashen_drake&look=v3&player=2" --scale 2 --out $O/cutin-p2.png
# the board heartbeat and the spill at 1x (no --scale): the pool must double-pulse every 2 s
node tools/shot.mjs "?dev=duel&s=kaAdBoard&look=v3" --fresh --film 40 --every 50 --cols 8 --out $O/board-pulse.png
node tools/shot.mjs "?dev=duel&s=kaAdAtk&look=v3" --fresh --film 24 --every 33 --start <contact+100> --cols 6 --out $O/spill-1x.png
node tools/shot.mjs "?dev=duel&s=kaAdSummonOnHeap&look=v3" --fresh --film 20 --every 100 --cols 5 --out $O/heap-kill.png
```
- Check on the ignite strip: the bare-bone drake on the held f9; the LUB pulse at the swallow; frame 0 kit flash tinted `fire4` (NOT `void4`: needs Q9); the ink silhouette under the flash from +1 and 2 frames past its end; one ring; the fuse reaching the jaw on f10; the cloak re-grown by f13.
- Check on `board-pulse.png`: two pool steps up with a visible drop between them, once per 2 s. Check on `spill-1x.png`: the spill reads at 1× (≥ 30 lit px, two streams, grains on the floor); the ash snow on the scorched tile and no tile scar.
- Check on the kill strip: the heap drawn once (no rubble flying out of a heap that stays), the last ember pulsing once and going OUT (`stone0` + smoke curl). Check on `heap-kill.png`: the heap vanishes on the new summon's arrival.
- Card art: the KART_RESIMLERI §9 render script with `--painter src/art/cardart-v3/ashen_drake.ts` (one frame per size; small vs big side by side to prove the same composition), plus `?dev=cards3`.

### 9.3 Timing, palette, white, sound, camera
```sh
node tools/measure.mjs --scenarios 'kaAd*' --look v3 --jobs 2 --out $O/measure-v3.json
node tools/contact-probe.mjs --scenarios kaAdHit,kaAdKill,kaAdKillPhys --png $O/probe
node tools/shot.mjs "?dev=duel&s=kaAdAtk&look=v3" --fresh --film 120 --every 17 --frames $O/atkframes --out $O/atk-all.png
node tools/palcheck.mjs $O/atkframes --clip 120,40,400,230
node tools/clip.mjs "?dev=duel&s=kaAdAtk&look=v3" --music off --marker ashenIgnite --out $O/clips/kaAdAtk.mp4
node tools/clip.mjs "?dev=duel&s=kaAdAtk&look=v3" --out $O/clips/kaAdAtk-music.mp4     # the hush duck must be audible BEFORE the VUF
node tools/clip.mjs "?dev=duel&s=kaAdSummon&look=v3" --out $O/clips/kaAdSummon.mp4
node tools/clip.mjs "?dev=duel&s=kaAdKill&look=v3" --music off --out $O/clips/kaAdKill.mp4
node tools/measure.mjs --scenarios 'kaAd*' --look v3 --jobs 2 --norender --out $O/cam-now.json && node tools/measure.mjs --camera-gate shots/kart-a/camera-base.json $O/cam-now.json
```

| Moment | Limit (game ms) | Target |
|---|---|---|
| summon (tribute ace, tribute stream included) | ≤ 4350 | ≈ 4120 |
| attack vs monster (incl. `kaAdAtkLongDeath`) | ≤ 3190 | ≈ 2900 |
| direct | ≤ 2320 | ≈ 2100 |
| declaration | ≤ 435 | |
| destroy | ≤ 2030 | |
| revive | ≤ 3050 | |
| position | ≤ 580 | fromGuard only |
| cut-in | ≤ 900 (scene) | |
| LP flow | ≤ 400 | |

- The number at contact ±17 ms; the contact is the ignition.
- `palcheck`: off-palette Δ ≤ 1 point; white ≤ 1.5 %; no row > 60 % white.
- **Silence gate:** on `clips/kaAdAtk.mp4` (`--music off`), ≥ 100 ms real under −40 dBFS between the roll's end and the suck's onset, with `ashenLub` the only event in the window; on `kaAdAtk-music.mp4` the music ≥ 5 dB down across the silence.
- Clips: true peak ≤ −1 dBFS, 0 clipped; `--marker ashenIgnite` on the ignition frame (≤ 1 frame, also at `&speed=3`); the sustained sounds still audible at their marks (no gap before `.stop`).
- **Small speakers:** render the heartbeat through a 150 Hz high-pass (a laptop proxy); the double beat must still read (≥ −30 dBFS RMS in the 150–400 Hz band per beat).
- SE-4 LSD vs `crystal_wyrm`, `abyss_magus`, `stone_sentinel`, `tide_golem`, and the lane-mates' roles: median ≥ 15 dB, min ≥ 10 dB. `hitAsh*` vs `hitStone*` once Q2 lands (§6.5).
- Camera gate passes (`zoom.max` = 1) against `shots/kart-a/camera-base.json` after its `kaAd*` keys exist.

### 9.4 Repo gates
```sh
npm run typecheck && npm test
node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films          # 17/17 IDENTICAL
node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films     # 26/26 IDENTICAL
grep -n "setScale\|setAngle" src/cinematics/strikes-a/ashen_drake*.ts src/cinematics/summon-a/ashen_drake.ts   # must be empty
```
- **Known failures, honestly:** `hourglass_imp`, `shield_titan` (+ lane D's `scrap_raiders` G1) are other owners'. `dusk_ashen` today fails on the OLD drake; after this rebuild it must pass for the drake half: all 13 anims (victory included), `validateArt` normal tier clean except HA-1 attack/death notes, P2 opaque diff 0. If its `dusk_sorcerer` half still fails, that is the dusk owner's.
- **`tests/art/ashen_drake.test.ts` (rewritten):** 13 anims with holds and marks (attack: charge 1, release 6, contact 9, recover 10; hits and death: impact 0 + contact 0; death: dissolve 5; summon / revive: land; idle holds sum 2000 with f1 ≥ 130; victory 10 f); attack f4 opaque mask ≤ 60 % of idle f0 (the cloak really is gone); `validateArt(art, { tier: 'ace' })` clean; deterministic; P2 opaque diff 0; the vulture shape (idle f0 w/h 0.75–1.05; opaque 2900–3500; the topmost opaque row at x < the skull's x; the skull's lowest row ≥ 30 px below the hood peak); HA-9 rows incl. the tail; margins; exactly one `gold4` in idle f0; no `night0` pixel outside the rib-cavity box in idle f0; death f11 opaque ≤ 40 px (the near-empty frame); card art (1 frame, both sizes) and cut-in within budget; `ASHEN_DISTINCTION` exported with all seven fields.
- `tests/presentation/recipes.test.ts` covers the recipe; `tests/art/materials.test.ts` covers `ash.ts`.
- Sameness: `npx vite-node tools/sameness.ts --look v3 --ids ashen_drake,crystal_wyrm,venom_drake,magma_titan,grim_warden` (report) + a blind silhouette test.

### 9.5 Critique rounds (≥ 3)
- Round 1 (done for the design: §11). Build round 1: idle f0 + idle / guard sheets. Round 2: all sheets + attack / summon films. Round 3: every film + clips + gates. Evidence paths in `docs/v3/oturum-a.md`.

---

## 10. Risks and open questions

### Risks
1. **The veil vs EF-2.** Lattice veil, ≤ 70 % of the height. If it fails on the 3× strip, lower it to the waist.
2. **The silence must read as intent.** 160 ms scene ≈ 216 ms real. Carried by: the bare-boned drake frozen on its watch frame, the ONE LUB (with the target tile's light dip), the embers going dark in 3 visible steps, the floodlight dip, the music duck (−5.6 dB) held across it, and ≥ 100 ms of true silence. Test with an outside viewer.
3. **The attack budget.** Worst case ≈ 3.14 s against 3.19 with 20 ms scene standing slack (f4 130). If `kaAdAtkLongDeath` exceeds it: travel 200 flat, silence 140. Never cut the fuse (it is background) or the silence below 140.
4. **The ramp hook (Q9) is a hard dependency.** Without it the signature frame is violet (§5.2.2). Ask first; build the strike meanwhile and film it, but do not submit the attack for KK-1 without it.
5. **The cloak tear vs HA-17 / identity.** A bare-boned drake for ≈ 0.6 s of every attack: check that the 1× bare frame still reads as THIS drake (spurs, S-neck, heart) and that HA-17 holds (§4.4 fallback).
6. **Lane-mate overlap.** `venom_drake` silhouette and "liquid from the mouth" motifs, and its "fizz ticks in a held silence" (we deleted ours); ours keeps the hood above the head, spills from the ribs only, and fills the silence with a heartbeat.
7. **Heartbeat vs `stone_sentinel` (49 Hz).** Measure LSD early (§6.3).
8. **Frame budget** 133 / 140. Victory (10) is the long form and stays; roar is already at its 9 f minimum; any extra goes to idle / guard.
9. **HA-18 with a calm creature** and the 2-frame ripple dwell. Budgeted per part (§4.1, breath + neck carry it) and measured on f0–f3 first.
10. **`ash` shatter / `ash` hit not approved.** Then the stone preset breaks a near-empty frame (the heap layer carries the identity) and the struck body is `hitStone*` (an open SE-5 gap, logged).
11. **The board double pulse depends on the light layer's 110 ms smoothing.** Proven on `board-pulse.png`; fallback f1 150.
12. **Background tails after the strike resolves** (fuse, re-growth, ash snow): if a later action re-poses the attacker, the re-growth is cut. Verify on `kaAdDirect` and on a two-attack turn.
13. **Card art / cut-in import the rig**: land in one commit.

### Open questions (for the orchestrator / owner)
- **Q1 (idle SOUND, R1).** R1's idle 50 Hz heartbeat, crackle and smoke breath are **not delivered**: no per-monster idle-sound system exists. Proposal: a card-owned aura through `MonsterUnit.setAura` (as `flow/stats.ts:88` does for the volcano) that plays a very quiet `ashenLub`/DUB pair synced to idle f0 / f2, with its own throttle (≤ 1 per 2 s, only while no cinematic runs, only for the active player's view) and no duck. Needs an owner decision on ambient monster sound. (The board LIGHT heartbeat needs nothing shared: §4.1.)
- **Q2 (asked NOW).** Own struck-body sound: `'ash'` in `GENERATED_HIT_MATERIALS` + the `'crackle'` ring interpreter + the pinned test (§6.5).
- **Q3 (asked NOW, plan of record).** The additive `'ash'` `ShatterMaterial` (§5.6) in `vfx/shatter.ts`, `_v3/presets.ts` `MATTER_RAMP`, `_v3/death.ts` `ACCENTS` (§3.4 lists the switch).
- **Q4.** The trap ramp one-liners in `_mirror_v3.ts` and `chains_of_light.ts` (§8.4).
- **Q5.** The `kaAd*` keys in `shots/kart-a/camera-base.json` (§8.4).
- **Q6.** R1 card-level EF-3 exception (the ink silhouette, §5.2.2): please confirm and log.
- **Q7.** `_placeholder-new.ts` size (`ashen_drake: 80`): leave (v1 byte-identical).
- **Q8 (optional).** A per-card `victory` sound role in `CHARACTER_SOUNDS` (the end plays the shared `roarBig` today, `v3small/end.ts:788`); ours would be a quiet `ashenSpill` + one heartbeat.
- **Q9 (asked NOW, blocks the attack's KK-1).** `attack.ramp?: RampName` on `PresentationRecipe` and its use in `battle/battle.ts:106, 377` (§5.2.2).

---

## 11. Critique log (round 1, independent critic)

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| 1 | BLOCKER | attack over budget (contact ≈ 1.75 s game + death gap) | **Fixed.** f2–f5 = 90/110/150/50 (400 ms), travel `clamp(dist × 1.6, 200, 240)` (critic said 1.8 / 300; tightened so the worst case still lands contact ≤ 780 ms scene), silence 140 (floor 120). Worst ≈ 3.14 s; `kaAdAtkLongDeath` added; direct gets the same cuts (§5.2, §5.3). |
| 2 | BLOCKER | f9 200 ms fails HA-3 (contact 50–90, longest frame) | **Fixed** (verified `validate.ts:144-147`). f9 = 90, held by `holdFrame(u, 'attack', 9)`; f4 150 is the longest. |
| 3 | BLOCKER | the roar spill almost never plays | **Fixed** (verified `position.ts:11`, roar only at duel end). The rib spill is now in the attack recovery (f10–f12) and the summon (f11–f12); the position claim deleted; `kaAdPos` expects `fromGuard` only. |
| 4 | MAJOR | death = Titan's preset; stone rubble bounces; heap drawn twice | **Fixed.** The `'ash'` shatter is the plan of record and asked now (Q3, full spec); death f9–f11 draw no heap, the heap lives only in the cinematic layer from f9 (armed by `atFrame`); f11 near-empty. |
| 5 | MAJOR | `S.finale` adds `impactHeavy`, 4 rings, shake 4 | **Fixed** (verified `_kit.ts:549-561`). `S.finale({ ring: 92, ramp: RAMPS.stone, freezeMs: 50, shake: 3, playerRing: false, sfx: null })`; the kit shockwave is the one ring, billows ride it; the f7 drawn ring removed (the `lightFlash` ring stays); `ashenLand` played by us. |
| 6 | MAJOR | `S.pose` cannot hold f8; timeline wrong | **Fixed** (verified `_v3/summon.ts:83`). Driven unit (`playToFrame` → `holdFrame` → `climax` → `playFrom`); timeline recomputed (f7 990, f8 1050); the band follows the shown frame via `ASHEN_BUILD`. |
| 7 | MAJOR | generic scan-line build; strike copies `tide_golem` | **Fixed.** Cloak built by plate accretion in scattered patches, no lip on the bone line; the bank hugs the floor with billows tumbling backwards, no crest / crash; `tide_golem` added to the table. |
| 8 | MAJOR | mouth drool / puddle overlaps `venom_drake` | **Fixed.** The spill comes out of the rib cage like sand through a grate and cools into an ash fan; the cut-in slam shows the ribs flaring. |
| 9 | MAJOR | sustained sounds shorter than their pictures | **Fixed.** Inhale: rise 0.45 + plateau to 1.1 s + fade; tornado: plateau to 1.4 s; both stopped on the mark (`wyrmBreathCharge` pattern). |
| 10 | MAJOR | the VUF lands ~95 ms late | **Fixed.** Split into `ashenSuck` (70 ms scene before impact, embers flicker inward) and `ashenIgnite` (whomp at t = 0); marker check kept. |
| 11 | MAJOR | the silence will not read | **Fixed.** `ashenHush` moved to ⅔ of the travel; `fade(['ashenRoll'], 40)`; 3 descending ember ticks; `lightDim(-0.3, 60)` → `lightDim(0, 300)` (verified `view/light/index.ts:166`). |
| 12 | MAJOR | black silhouette vs EF-3 and the react flash | **Fixed.** Cited R1 as a card-level exception (Q6, logged); frame order flash → 2 ink frames; overlay below the flash. Note: `s.impact` takes no ramp (verified `_core/types.ts:151`); the tint comes from the react ramp, to be verified (§5.2.2, Risk 9). |
| 13 | MAJOR | HA-18 at risk | **Fixed.** Per-part Δ budget (plate ripple every frame, 3-step breath, neck undulation, continuous tail sweep), measured on f0–f3 first. |
| 14 | MAJOR | dark cloak melts into the board; robe read vs `grim_warden` | **Fixed.** Cloak `stone2` / `stone1` / `stone0`, `night0` only in the rib cavity; `stone3` wrist edge + claw spur; `grim_warden` in the table and KK-1. |
| 15 | MINOR | `dusk_ashen.test.ts` also imports the art | **Fixed.** Listed; victory kept for its 13 anims; known-failure list rewritten. |
| 16 | MINOR | wrong power / effect-polluted scenarios | **Fixed** (verified ATKs and effects in `cards.ts`, threshold in `battle/battle.ts:70`). Weak → `lumen_sprite` (power 3); DefWin → `stone_sentinel`; Blocked → `polar_sovereign` DEF 2800. |
| 17 | MINOR | traps fall back to the wrong ramp | **Accepted, partly corrected:** Mirror falls back to the DARK attribute ramp (violet); Chains falls back to gold, not violet. Asks + `kaAdChains` / `kaAdMirror` added. |
| 18 | MINOR | `ash` MaterialDef incomplete | **Fixed.** Full definition in §3.4. |
| 19 | MINOR | hem lip on the outline | **Fixed.** The lip sits on the row inside the outline (§1.3, §7.1). |
| 20 | MINOR | three API precision errors | **Fixed.** `S.ctx.base()`; `sourceOwnsDestroy` (strikes-a) named; `shots/kart-a/camera-base.json` + the key ask. |
| 21 | MINOR | "darker than floor"; streams direction; card crop | **Fixed.** Wording corrected; streams follow R1 (right, below the jaw line); crop = hood to knees with the talons sunk in the heap. |
| 22 | MINOR | guard tail breaks HA-9 | **Fixed.** The tail curls behind the talons, tip ≤ y 92, never in rows 94–99. |
| 23 | MINOR | heartbeat inaudible on small speakers; Titan v1 thuds | **Fixed.** Harmonic layer (drive 2.5), 165 Hz knock, rib tubes; a high-pass check; the claim scoped to the v3 look. |
| 24 | MINOR | flip / revive equal the sentinel's | **Fixed.** Flip `{ sparks, fire }`; the revive seats plates one by one, each re-lit by a heart pulse. |
| B1 | bold | the fuse back | **Adopted** (§5.2): 4 stepped segments, `ashenFuse`, ends in the heart's lub-DUB and the rib spill; parallel to the death, no time cost. |
| B2 | bold | the ember that won't die | **Adopted** in rev. 2; **changed in rev. 3** (§12 #17): it goes out in place, no card ride. Was: adopted (§5.6 step 3), with a fallback if the card sprite is not exposed. |
| B3 | bold | the board heartbeat | **Partly adopted** in rev. 2; superseded in rev. 3 (§12 #7: the pool already follows the frames; the living card art is gallery-only, §12 #15). |

---

## 12. Critique log (round 2, independent critic, checked against 5d7c8ca / 4933a32)

Every claim was re-read in the code before it was accepted.

| # | Sev. | Finding | Resolution |
|---|---|---|---|
| 1 | BLOCKER | summon over budget: the tribute stream is ≈ 1.17 s, not 0.55 | **Fixed** (verified `summon-a/crystal_wyrm.ts:265`, `tribute.ts:104, 140-158`). Pre-pose cut to 260 ms (mound 0–120, ember 40–160 in parallel, ring 160–260); the cinematic resolves when f12 starts and runs f12–f13, the fan, the pools and the dust layer in `bg()`. Entrance 1.88 s → total ≈ 3.05 s scene ≈ 4.12 s game. Measure with blank frames before drawing (§5.1). |
| 2 | BLOCKER | the ignition flash would be violet | **Fixed by an ask** (verified `battle.ts:106, 377`, `react.ts:603, 613`). Q9 asks for `attack.ramp?: RampName` + its use in `battle.ts`; the recipe adds `ramp: 'fire'` when it lands; the attack's KK-1 is blocked until then. The ink silhouette now runs from +1 UNDER the flash and 2 frames past its end (the flash covers only 34–45 %, 3 frames heavy) (§5.2.2). |
| 3 | MAJOR | direct attack over budget (the strike is awaited whole) | **Fixed** (verified `battle.ts:228, 553, 577`). Win / direct resolve at contact + hit-stop; the fuse, the spill, f10–f13 and the ash snow are fire-and-forget. Lose / tie resolve at contact (`strikeDone` gates the attacker's death). Direct ≈ 2.0–2.15 s game (§5.2, §5.3). |
| 4 | MAJOR | the silence holds three ticks + the suck, and copies venom's device | **Fixed** (verified `venom_drake.md:153, 599`). Ticks deleted (the dark steps stay visual). The silence (now 160 ms scene ≈ 216 real, paid for by f4 150 → 130) holds ONE event, `ashenLub` panned to the target; the suck lead shortened to 40 ms scene; gate ≥ 100 ms real under −40 dBFS; `ashenHush` is now only a duck carrier ending at the swallow, duck 0.95 (the engine's max is −6 dB, `audio/engine.ts:313`). Merged with bold idea 2 (below): the critic proposed the DUB; we use the LUB so that **the VUF lands where the DUB should be**. |
| 5 | MAJOR | the roar never plays in v3; `victory` does | **Fixed** (verified `v3small/end.ts:777-783`). `victory` (10 f) IS the long form: mantle + rib spill, ending on the held cooled-fan frame; `roar` cut to the 9 f compact spill (dev sheet / fallback). Frame total stays 133. Q8 (optional) asks for a victory sound role. |
| 6 | MAJOR | `ash.ts` fails `materials.test.ts:170` and the typecheck | **Fixed** (verified `materials.test.ts:166-170`, `shatter.ts:324`). `shatter: 'stone'`, `matter: RAMPS.stone` now; the full `'ash'` switch (`MATTER_RAMP`, `ACCENTS`, `SHATTER_MATERIALS(_LIST)`) is listed in §3.4. |
| 7 | MAJOR | the board heartbeat needs no shared change, but the idle timing kills it; idle SFX not delivered | **Fixed** (verified `LightLayer.ts:905-921`, 110 ms smoothing). Idle f0 LUB 110 / f1 relax 130 with the heart at `fire2` / f2 DUB 100, time taken from f12–f19 (sum 2000). Emissive weights `[[fire4,1],[gold4,1],[fire3,0.4]]`, brazier / eye `fire3` counts constant. Proof on a 1× `--film 40 --every 50` board strip (`kaAdBoard`). Idle SOUND stated as NOT delivered; Q1 asks for a card-owned `setAura` with its own throttle. |
| 8 | MAJOR | every hit on the drake sounds like `stone_sentinel` | **Fixed by an ask NOW** (verified `materials.ts:119`, test `:324-325`, `RingSpec` `'crackle'` at `materials/types.ts:55` — which has **no interpreter yet**, so the ask includes it). `ASH_SOUND` specified (soft thump, 1.2 kHz pink surface, crackle tail); the stone fallback is logged as an open SE-5 gap (§6.5). |
| 9 | MAJOR | most film targets show v1 sprites | **Fixed** (verified ATK 500 and power `battle.ts:70-72`). Primary `kaAdAtk` vs `stone_sentinel` in attack (power 3, v3 rig); `kaAdAtkTitan` secondary (timing only); `kaAdAtkWeak` removed; the `polar_sovereign` films marked provisional. |
| 10 | MINOR | `puff` has no `q` | **Fixed** (verified `kit.ts:95`): the knock is `v.noise('pink', { …, to: v.filt('bandpass', 165, 4) })`. |
| 11 | MINOR | the "low-pass slam" was a band-pass sweep | **Fixed**: brown noise through `v.filt('lowpass', [[0, 300], [0.03, 6000, 'e'], [0.9, 800, 'e']], 0.9)`. |
| 12 | MINOR | the rib spill may not read at 1× | **Fixed**: ≥ 30 lit px per spill frame, two 2-px streams from 2 gaps, `Sparks` to the floor, a `fire2` pool step; verified on a 1× strip (§4.4.1, §9.2). |
| 13 | MINOR | `coral_serpent` and `storm_hawk` missing from the table | **Fixed** (verified `coral_serpent.ts:105`, `storm_hawk.ts:7, 107`): rows added (ours rises, builds by accretion, dry grey with embers, no trail / scan). |
| 14 | MINOR | `distinction` / `knock` / `poseKnockPx` not `ArtShell` fields; death marks; `custom.flip` | **Fixed** (verified `anim.ts:277`, `bodyplans/types.ts:158`, `validate.ts:125-127`, `presets.ts:42`, `profiles.ts:74`). `ASHEN_DISTINCTION` exported separately; `knock` / `poseKnockPx` spread onto the `toMonsterArt` result; hits and death carry `impact: 0` + `contact: 0`; no custom flip (stated in §8.2). |
| 15 | MINOR | card art: living frames never shown; the small is a different crop; streams from the wings | **Fixed** (verified `cardface-v3/index.ts` blits `renderArt(x, 0).smallPx`). One frame per size; the small is the big reduced 2:1 then patched; the streams lead from the cloak hem edge. |
| 16 | MINOR | arithmetic | **Fixed**: idle sums 2000; revive 1180 (heading and text); cut-in f2 120 → 130 so f3 starts at 430 = the recipe's slam (f4 340 → 330, total 900); attack f4 150 → 130 (still the longest) as standing slack. |
| 17 | MINOR | the last ember: no card handle; must go out; heap must die on a new summon | **Fixed** (verified `death.ts:269`). In-place ending only, `fire1` → `stone0` blink + 2-px smoke curl; the heap layer kills itself when the tile is occupied (`kaAdSummonOnHeap`). |
| 18 | MINOR | cloak ripple risks boiling (IŞ-10) | **Fixed**: one row per frame alternating cloaks, each row dwells 2 frames; HA-18 now carried by the whole-hood breath and the neck + skull undulation (§4.1), fallback a slow far-cloak sway. |
| B1 | bold | "the cloak is the ammunition" | **Adopted** (§4.4, §5.2): f2–f4 tear the plates into the ribs, f4 bare bones + white heart, the bank is the exhaled cloak (plate chips in its first billows), f10–f13 re-grow it with `fire2` welds in the shared `ASHEN_BUILD` order; `ashenInhale` plate rips and `ashenRegrow`. HA-17 risk gated with a fallback. |
| B2 | bold | "the heartbeat is the countdown" | **Adopted, merged with #4**: the LUB at the swallow (panned to the target, the target tile's light dips one step), true silence, the VUF where the DUB should be. |
| B3 | bold | a living board for free | **Adopted**: the double-pulsing floor pool (#7) + 6–10 ash flakes snowing on the scorched tile for ≈ 3 s after each ignition, flakes only, never a scar, killed on a new summon. |

**Rejected / not taken as written:** none of the findings. Two were adapted: #4 uses the LUB rather than the DUB in the silence (so the ignition itself completes the heartbeat), and #1's "pose at 260" is kept but the measured entrance is 1.88 s rather than the critic's tighter sketch, which still fits the ≤ 1.95 s target.

