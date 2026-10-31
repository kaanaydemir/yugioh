# Kül Ejderi (`ashen_drake`): design and build plan (lane A, R1, NO rebirth) — revision 2

KARANLIK / Ejderha · Sv7 · 2400/2000 · ★ As (2 tributes → cut-in) · `effect: 'none'` (vanilla, owner decision 2026-10-31 #2).
Source spec: `docs/v3/YENI_KARTLAR.md` §8 R1 (identity, idle, summon, attack, death, SFX), §5 / §5.1 / §5.2. Rules: `docs/v3/REHBER.md`.
Time: scene ms (the code's numbers). Game time is ×1.35 (`V3_TEMPO`), hit-stop ×1.55. The limit is REHBER §5 × 1.45 (`docs/v3/TEMPO.md`).
Sounds play in REAL time; every sustained sound is sized against scene ms × 1.35 (§6.2).
This document is the blueprint for the builders. Every path, function and API named here was read in the tree on 2026-10-31 (commit 7cc7e70). Revision 2 answers critique round 1; the log is §11.

---

## 0. One-paragraph pitch

A **vulture made of compressed ash and coal**. It perches hunched on its talons with its wings drawn over its shoulders like a hooded cloak; a bony claw spur pokes up from each wing wrist.
The long neck hangs forward and down in an S, and the skull peers out from under the hood. Its only real light is an **ember heart** inside the rib cage. That heart beats twice, slow and low, every two seconds (50 Hz lub-DUB). The cloak never stops moving: a ripple runs through its plates, ash flakes peel off its ember-lit hem, drift, and settle back.
It does not breathe fire. **It breathes ash.** A grey, ember-studded pyroclastic bank hugs the floor, tumbling backwards on itself, and swallows the target. Then everything goes silent — the embers in it go dark one by one, the hall dims. Then **every buried ember ignites at once** with a delayed "VUF", and the target stands as a black silhouette inside an orange blaze. The soot trail lights back toward the drake like a fuse, and its own heart answers with a lub-DUB while embers spill out between its ribs.
When it dies it crumbles from the top down into a heap of ash, its core falls into the heap, the heap cools, and the wind takes it — all but one last ember, which beats once more and rides the card to the graveyard.

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
Rhythm per HA-8: charge→release **510 ms** (f1 110 + f2–f5 400; wyrm 460, magus 500): still the slowest wind-up of the aces, and the declaration already shows f1.

### 1.5 P2 relight
- `p2: 'relight'`. Draw with `lightOf('right')` (`src/art/rigkit/light.ts`, the standard vector).
- **Do not keep** the old gbuf's private vector (−0.8, −0.56, 0.46). It breaks IŞ-1 comparability.
- Hand maps (cloak plates, skull planes) get `_L` / `_R` versions (IŞ-2, as `abyss_magus-maps.ts`).
- Ember pixels, eyes, brazier and `void2` spine tips are identical in both sheets. The rim moves to the other side. **The opaque mask is identical** (dusk_ashen test: P2 opaque diff 0): flakes and plate lifts are placed by the same seeds in both lights.

---

## 2. Distinction card (the `distinction` block of the art file)

```ts
distinction: {
  silhouette: 'a hunched vulture perch: both wing wrists pulled up above and behind the head into a hooded ash cloak (an inverted U) with a bony claw spur on each wrist, a long S-neck hanging the skull out forward and DOWN from under the hood, two gripping talons, a tail curling up into a small brazier flame; taller than wide, nothing upright',
  rhythm: 'slow and patient: a double heartbeat, a 510 ms wind-up, a breath that rolls rather than fires, a held silence, then everything at once; recoveries settle like falling ash',
  idle: '20 f / 2.0 s: the ember heart beats twice (lub-DUB) once per loop; a plate ripple runs through the cloak every frame; a 3-step breath; the S-neck undulates; the tail sweeps; flakes peel off the hem and re-join; the brazier flickers',
  guard: 'the cocoon: the cloak closes fully round the body, the head tucked under the hood edge, only one eye and a slit of heart-glow showing; the hem embers dim to fire1 and breathe plate by plate',
  signaturePart: 'the ember heart seen through the rib cage (the only real light) and the ember-eaten hem of the ash-plate cloak',
  material: 'compressed ash and coal on the stone ramp with compression strata, a violet void2 rim, ember light only inside the ribs / hem / eyes / brazier; dies as a soft ash heap that cools and is blown away',
  signatureMove: 'Kül Fırtınası Nefesi: the head drops to the floor and exhales a pyroclastic bank of ash that hugs the floor and swallows the target; silence; every buried ember ignites at once (the delayed VUF); the soot trail burns back like a fuse and the heart answers, embers spilling between the ribs',
},
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
| `grim_warden` R2 (DARK, lane B) | DARK, a hooded dark mass with a skull peeking out | The warden is a shroud with a lantern and ghost-green light. **Ours** has wrist claw spurs breaking the hood line, a lit `stone3` peak edge, warm embers, a long S-neck hanging below the shoulders and visible talons. Add it to the KK-1 silhouette check. |

---

## 3. Rig approach

### 3.1 Choice: hand rig + G-buffer (ace tier, L5 custom), on the rigkit core, with compiled anim tables
- **No body plan fits** (`src/art/bodyplans/` has `biped` and the serpent plan). An ace is L5 custom (REHBER §0.2).
- **Follow `crystal_wyrm`'s craft, on the shared core** (`src/art/rigkit/*`: `Raster` / `Workspace`, `lightOf`, `despeckle`, `composite` + creases, `edgePaint`, `cracksOn`, `crumblePass` / `drawDebris`). The old `ashen_drake-gbuf.ts` helpers (`gTube`, `gFacet`, `ik`) may be ported; not its light vector.
- **Motion:** `definePose` (`src/art/rigkit/pose.ts`) + `compileAnims` / `toMonsterArt` (`src/art/rigkit/anim.ts`), marks by name.
  - Regions (`REGION_IDS`): `head` = skull + jaw + crest, `chest` = ribs + heart, `wingN` / `wingF` = the cloaks, `lower` = talons, `hips` = pelvis, `tail` = tail + brazier, `extra` = flakes.
  - Escape hatch: per-frame patches (`AnimDef.frames`) for summon / death / revive.
- **Cloak = plate field.** Each cloak is ~22 plates in wing space, rows from the wrist down to the hem, placed by the wing's 3 bones. A plate has `lift` (0 seated … 1 detached) and `ripple` (0/1 px offset, the idle wave) and, for the summon, `seated` (bool, accretion order).
- **Ember pass after the outline**: heart, rib-gap light, hem lip (inside row), eyes, throat, brazier, rib spill, `heat` scalar (0 dull … 1 rest … 2 white).

### 3.2 Pose fields (`AshenPose`, sketch)
`hip [x, y]`, `crouch`, `chestLift` (0/1/2 steps), `ribSpread`, `ribFlex` (spill opening), `heat`, `heatEdge`, `neckS [a0, a1, a2]`, `neckWave` (1-px undulation phase), `headPitch`, `headTilt`, `jaw`, `eye` (0/1/2), `crestFlare`, `wingN { wrist, open, mantle }`, `wingF { … }`, `plateRipple` (row phase), `plateLift[]`, `spill` (0 none … 1 pouring … 2 cooled fan), `talonGrip`, `tailCurl`, `tailSweep`, `brazier`, `smoke`, `boneBuild` (summon bone mask 0–1), `platesSeated` (summon accretion count 0–44), `crumble` (death), `heapHidden` (death f9+: the art draws no heap, §4.8), `reform` (revive: plates seated count), `smearFrom`.

### 3.3 Files (all per-card; old content replaced)

| File | Role |
|---|---|
| `src/art/monsters-v3/ashen_drake.ts` | the MonsterArt (rewritten): `toMonsterArt(...)`, anchor, `weight: 'heavy'`, `p2: 'relight'`, `knock: 'pose'` + `poseKnockPx`, `distinction`, re-exports (`ASHEN_MOUTH`, `ASHEN_BUILD` per-frame summon table, `framePose`) |
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
  death: { shatter: 'ash' /* §5.6: 'stone' until the orchestrator adds 'ash' */, accent: 'fire', pass: 'crumble', revive: 'reassemble' /* type value only: the art draws its revive by hand, §4.9 */ },
  matter: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.fire3],   // verify luminance order in the test; else end on stone4
  sound: { same: 'stone' },                                    // phase 1 (§6.5)
  light: { glow: PAL.fire3, pool: PAL.fire3 },
} satisfies MaterialDef;
```

---

## 4. Animations

Every one-shot ends on idle f0 (HA-14 out = 0). Holds 40–200 ms (HA-2). Release ≤ 70 ms; the longest attack frame is an anticipation frame; contact holds 50–90 ms; recoveries lengthen (HA-3, `src/art/rigkit/validate.ts:139-150`).
Total **133 frames** (≤ 140, KK-13). Sheet bytes 120 × 104 × 4 × 133 = **6.64 MB / side** (ace ≤ 7 MB).

| Anim | f | ms | Marks | Note |
|---|---|---|---|---|
| idle (loop) | 20 | 2000 | — | double heartbeat |
| guard (loop) | 8 | 1280 | — | cocoon |
| toGuard / fromGuard | 6 / 6 | 390 / 390 | — | the only pose a v3 position change plays |
| attack | 14 | 1370 | charge 1, release 6, contact 9, recover 10 | f9 (90 ms) is held by the cinematic; f10–f12 = the rib spill |
| roar | 12 | 1250 | charge 1, release 4, recover 8 | the mantle + rib spill; a duel-end bonus only (§5.7) |
| hit | 6 | 510 | contact 0, recover 3 | |
| hitHeavy | 8 | 680 | contact 0, recover 4 | |
| hitMagic | 8 | 620 | contact 0, recover 4 | |
| summon | 14 | 1350 | land 1 | bones bottom-up + cloak accretion; driven frame by frame (§5.1) |
| death | 12 | 860 | contact 0, dissolve 5 | top-down crumble; from f9 the heap is the cinematic's (§4.8) |
| revive | 12 | 1190 | land 6 | plates fly in one by one, each re-lit by a heartbeat |
| victory | 7 | 960 | — | the mantle held (required by `dusk_ashen.test.ts`' 13-anim list) |
| special | — | — | — | NOT drawn (vanilla) |

### 4.1 idle: 20 f, 2.0 s, with a liveliness budget (HA-18 ≥ 15 %)
Holds: `110 70 80 110 100 100 110 110 100 100 100 100 110 110 100 100 90 90 100 120` (sum 2000).
At ≈ 3100 opaque px, 15 % means **≈ 465 changed px per frame on average**. Every part's Δ is budgeted:

| Part | Period | Motion | Δ px / frame (est.) |
|---|---|---|---|
| **Cloak plate ripple** | 20, a wave hem → wrist on BOTH cloaks | every frame one plate row (of ~8 per cloak) shifts 1 px down-and-back and the row above it returns: tone bands and the row's lower crease move. Like the wyrm's membrane waves. | **180–240** |
| **Breath** | 10, 3 steps | chest + hood + wrists: 0 → +1 → +2 → +1 → 0 px (not a hold): f0–f9 and f10–f19 | **90–140** (on 8 of 10 frames) |
| **Neck S undulation** | 10 | the middle segment slides 1 px forward / back; the skull follows 1 frame later (lag 1) | **50–70** |
| **Tail sweep** | 20, continuous | the mid-tail moves 1 px every 2 frames through a ±2 px arc, +2 frames after the hips; stays above row 94 | **30–40** |
| **Heart** | 20 | f0 **LUB** (5×4 `fire4`, leaks +1 tone, ribs 1 px out), f1 relax, f2 **DUB** (4×3), rest | **20–40** on beats |
| Head scan | 20 | 1 px forward f5–f8, a jaw-line tilt f8–f11 (the vulture peer) | 20–30 |
| Flakes | 20 | three flakes at f3, f9, f15 lift (`fire2` lip), drift 2–3 px back/up over 3 frames, re-seat; ≤ 2 airborne | 10–20 |
| Hem shimmer | 10 | `fire1` ↔ `fire2` steps travelling 4 px per frame along the inside row | 8–12 |
| Nostril smoke | 20 | one 2-px `stone2` curl f12–f15 | 4–6 |
| Brazier | 5 | 3 flame silhouettes + 1 low | 6–10 |

Sum ≈ 420–600 px → **≈ 14–19 %**. **Measure HA-18 on idle f0–f3 first** (a 4-frame partial loop through the gates) before drawing the rest; if under 15 %, widen the ripple to 2 rows per frame. Never all parts on the same frame (HA-6). Seam HA-16 ≤ 1.4; HA-17 ≤ 1.8 (the LUB frame is the largest jump: heart growth ≤ 2 px); HA-21 phase < 50 %.

### 4.2 guard: 8 f, 1.28 s, "the cocoon"
Holds `150 160 160 170 150 160 160 170`.
Both cloaks closed in front of the body, overlapping at the chest; the near wrist (with its spur) at head height; the skull tucked under the hood edge, near eye `fire3`; a 2-px slit of heart glow at the overlap; hem `fire1`. **The tail curls BEHIND the talons with its tip at y ≤ 92** (≥ 1 px above row 94; HA-9).
Breath travels one part per frame: plate row 1 → row 2 → the slit glow steps `fire2` → `fire3` → the head settles → the brazier flickers. HA-19 target 0.45 × idleΔ.

### 4.3 toGuard / fromGuard: 6 f each, ≤ 0.4 s
- **toGuard** `50 60 60 70 70 80`: wrists rise → the hood opens wide (HA-13 in-between) → cloaks sweep forward (the head clear of the sweep, HA-29) → overlap closes → settle → guard f0.
- **fromGuard** `60 60 70 70 60 70`: the reverse with a mantle-open in-between, ending on idle f0. Talons and tail stay out of rows 94–99 throughout.

### 4.4 attack "Kül Fırtınası Nefesi": 14 f, 1.37 s

| f | ms | Mark | Pose |
|---|---|---|---|
| 0 | 60 | | idle f0 + plate row 1 lifts |
| 1 | 110 | **charge** | the head lifts out of the S, wrists rise, the cloak starts to unwrap. **The declaration holds this frame.** |
| 2 | 90 | | wings half open: plate undersides `fire1` / `fire2`; flakes start streaming INTO the ribs; `heat` 1.4 |
| 3 | 110 | | inhale: neck in a tight S, ribs spread 2 px, wings wide; `heat` 1.8 |
| 4 | **150** | | full wind-up (the longest frame, HA-3): head high and back, jaw shut, light between the teeth; heart 2×2 `white` |
| 5 | 50 | (swing) | the head whips forward and down; crest streams back |
| 6 | 70 | **release** | head DOWN at floor level, jaw wide; muzzle ≈ (106, 88); 2-px smear behind the skull (HA-12) |
| 7 | 80 | | exhale: the wings pump forward over the cloud; heart `fire3` |
| 8 | 90 | | the exhale tails off; heart `fire2` (spent) |
| 9 | **90** | **contact** | **the watch**: head low and tilted, jaw half shut, eye on the target, wings half open. HA-3 compliant 90 ms nominal; the cinematic **holds it with `holdFrame(u, 'attack', 9)`** through the silence and the fuse (§5.2), like the magus' aim frame. |
| 10 | 100 | **recover** | **the heart answers** (when the fuse reaches the jaw): LUB, `fire4`; the rib bars flex open 1 px (`ribFlex`) |
| 11 | 110 | | **the rib spill** (Kor Dökülmesi): `fire3` / `fire2` 1-px grains pour out BETWEEN the rib bars and run down over the talons like sand through a grate; DUB; the head lifts |
| 12 | 120 | | the spill cools at the talons into a small `fire1` / `stone2` ash FAN (not a puddle); wings fold over the shoulders |
| 13 | 140 | | (appended end = idle f0; the cinematic continues the fan as a floor mark) |

charge→release = 110 + 90 + 110 + 150 + 50 = **510 ms**. Strike start (f2) → release = **400 ms**. HA-15 in ≤ 2.0. Points: `muzzle` every frame (HA-25); on f6–f8 it is at floor height.
The spill never touches rows < 2 px from the frame edge; the fan sits on rows 96–99 only in f12 (attack is not an HA-9 anim).

### 4.5 roar "Kor Dökülmesi" (mantle + rib spill): 12 f, 1.25 s — a bonus pose
**Where it plays (verified):** only at the duel end (`flow/end.ts`, `v3small/end.ts` call `u.play('roar')` with no character sound) and the dev sheet. The v3 position change never roars (`summon-b/position.ts:11`), and v3 has no special-summon source. The signature spill is therefore GUARANTEED by the attack recovery (§4.4 f10–f12) and the summon (§4.7 f11–f12); the roar is the long form.

| f | ms | Mark | Pose |
|---|---|---|---|
| 0 | 80 | | idle f0, LUB |
| 1 | 110 | **charge** | DUB; head draws back under the hood; wrists rise |
| 2 | 160 | | the **mantle**: both wings spread forward and DOWN into a canopy over the floor in front, the head low under it |
| 3 | 60 | | the jaw drops (in-between) |
| 4 | 110 | **release** | jaw wide, a hollow roar; **the ribs flare open and embers pour out between the bars** over the talons; crest flared, `heat` 1.9 |
| 5 | 90 | | the grains run down the talons |
| 6 | 90 | | the canopy shudders: row-1 plates lift (`fire2` lips) |
| 7 | 90 | | flakes shaken off (≤ 3) |
| 8 | 100 | **recover** | the ribs close; the spill at the talons cools to `fire1` |
| 9 | 110 | | the wings fold back up |
| 10 | 120 | | the fan is `stone2` / `stone1` ash; the hood re-forms |
| 11 | 130 | | (appended end = idle f0) |

Margin ≥ 2 px to the frame edge (Sİ-2).

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
| 11 | 110 | | | | **rib spill**: the ribs flex, embers pour out between the bars over the talons |
| 12 | 130 | | | | the spill cools into an ash fan; the neck lowers into the S |
| 13 | 120 | | | | (appended end = idle f0) |

### 4.8 death: 12 f, 0.86 s (`contact` 0, `dissolve` 5): top-down, and the heap belongs to the cinematic
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

### 4.9 revive: 12 f, 1.19 s (`land` 6): plates fly in one by one, each re-lit by a heartbeat (never the summon, HA-28; never the sentinel's reassemble path)
Holds `80 90 70 90 90 100 110 90 100 110 120 130`.
- f0: a low ash heap (drawn by the art here: no shatter follows a revive), the heart's eye in it.
- f1–f2: the heart beats twice inside the heap (`fire2` → `fire4` → `fire3` → `fire4`); the heap's top lifts.
- f3–f5: the bones stand up out of the heap bottom-up, bare and grey, the heart rising into the ribs.
- f6 **land**: the talons grip.
- f7–f10: **the plates fly in one at a time** from the heap (4–6 per frame, wrist first this time), and every seated plate's hem lip lights `fire2` on the frame it lands, keyed to a heart pulse (the heart steps `fire3` ↔ `fire4` each frame): the drake is re-lit plate by plate.
- f11: first breath, LUB-DUB → idle f0.

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

### 5.1 Summon (signature entrance, tribute ace): budget 2.5–3.0 s scene → ≤ 4.35 s game
`signatureSummon('ashen_drake', (S) => S.ctx.base(), { v3: ashenRiseV3 })` inside `if (LOOK_V3)`. The tribute stream before it is the shared `summon-a/tribute.ts` (≈ 0.55 s).
**The unit is driven directly, as `summon-a/crystal_wyrm.ts`'s climax path does, not through `S.pose` / `summonPose`** (which plays the whole anim with no frame hold, `_v3/summon.ts:83`): `u.pose('summon', 0)` → `await u.playToFrame('summon', 8)` → `holdFrame(u, 'summon', 8)` → `await S.climax()` → `await playFrom(u, 'summon', 9)`.
**The tornado band follows the SHOWN frame**: an `onFrame` callback reads the unit's current summon frame and places the ribbon band on `ASHEN_BUILD[f].boneY` (±6 px), and spawns the flying plates for `ASHEN_BUILD[f + 1].seats` one frame ahead so they land on the frame that seats them. No clock drives the band.

| scene ms | Visual | Light / floor | Sound |
|---|---|---|---|
| 0–200 | **Ash mound**: a stepped ellipse mound grows on the tile (`stone1` base, `stone2` flank, `stone3` 1-px crest), 0 → 24×9 px; 4 dust puffs slide out | — (no generic circle) | `fade(['summonCharge'], 160)`; `ashenMound` |
| 200–330 | **A single ember falls** from y −90: 1 px `fire4`, 2-px `fire2` trail, wobbling ±1 px | `followLight` `fire3` r 8, 0.3 | — |
| 330 | it **touches** the mound top: a 3-px `fire4` star, 1 frame | | `ashenEmber` |
| 330–450 | **Ring ignition**: two flames chase round the mound's base ellipse (r 28×12) from the back, meeting at the front | `lightPool(home, { color: fire2, spill: fire1, radius: 30, intensity: 0.6, anim: 'flicker' })` | `ashenKindle` (pans round with the ring) |
| 450 | the pose starts (driven, f0); the mound lifts into the **ash tornado** | pool → 0.9 | `start('ashenTornado')` |
| 450–990 | **The tornado builds it**: 10 stacked ellipse ribbons (`stone1` / `stone2` / `stone3`, 2 px tall), rotating by whole-pixel phase steps, 34 → 44 px wide, the band on the shown frame's bone line. **Plates** (2×2 / 2×3, `stone2` / `stone1`) are flung out of the ribbons on short arcs and stick onto the cloak in scattered patches (the art seats them). 12 embers orbit in the ribbons. | floor: ash grains rain off the column's skirt (`blob` `stone1`, life 900) | `land` f1 (530): `ashenTalon` · f3 (670): `ashenHeartbeat` 0.9 (**the chest "güm"**) |
| 990 (f7) | **The wings burst out of the storm**: the column explodes into the last 16 loose plates + 10 ember sparks (gravity 160, drag 2). **No drawn ring here.** | `lightFlash(fire3, r 36, 260 ms, { ring: true })` (the only ring at this beat) | `ashenTornado` handle `.stop(90)` · `ashenRoar` is NOT here (the cut-in owns it) |
| 1050 (f8 held) | **The cut-in** (`S.climax()`): the band passes under the tile (EF-10); ash flakes drift through it | the pool holds at 0.6 | the cut-in flare plays the CHARACTER `roar` = `ashenRoar` |
| 1050 + 720 = 1770 | the band exits → `playFrom(u, 'summon', 9)` | | |
| 1860 (f10) | **the cloak slams over the shoulders → LANDING ASH SHOCK**: `S.finale({ ring: 92, ramp: RAMPS.stone, freezeMs: 50, shake: 3, playerRing: false, sfx: null })` — the kit's shockwave is **the one ring** (EF-7); 8 ash billows (stepped discs, `stone3` / `stone2` / `stone1`) **ride its front** as debris, not a second ring | **1 s grey dust layer**: sparse 2×1 `stone1` clumps on the tile + 4 neighbours, fading `stone1` → `night2` → gone by +1000; `lightFlash(fire2, r 30)` under the chest | `ashenLand` (played by us, since `sfx: null`) |
| 1960–2200 (f11–f12) | **the rib spill**: embers pour between the rib bars over the talons (the art), + 6 `Sparks` 'px' `fire3` → `fire1` grains at `ASHEN_RIBS` falling to the floor; the fan becomes a floor mark (`blob` `stone1` / `fire1` rim, life 1400) | a `fire2` pool r 10 at the talons, 0.4 → 0 over 300 ms | `ashenSpill` |
| 2200–2320 | f13 → idle | the main pool fades out over 240 ms | — |

- Entrance ≈ 2.32 s + tribute ≈ 0.55 s ≈ **2.87 s scene → ≈ 3.9 game** (≤ 4.35).
- Cut-in rhythm (recipe): `{ flare: 300, slam: 430, exit: 720 }`, close 120.
- **Without a cut-in** (`S.cutIn` false; no v3 source today): no hold on f8; `ashenRoar` 0.75 plays at f7; the finale at f10 as above.
- **P2:** offsets mirrored with `S.dir`; the tornado rotates the other way.
- **No "climbing from the floor"** (§5: only R2 and C10): the storm BUILDS it.

### 5.2 Attack vs monster (it wins): budget 1.6–2.2 s scene → ≤ 3.19 s game
`registerStrike('ashen_drake', ashStormV3, { name: 'strikes-a:ashen_drake' })` inside `if (LOOK_V3)`. The strike starts on `strikeStartFrame(u) + 1` (the declaration showed f1).
**Budget math (§11 #1):** the target's death + card flight starts 150 ms after contact (`DEATH_AFTER_CONTACT_MS`, `_v3/budget.ts:14`) and ends the scenario; measured contact → end on existing strikes is 1.13–1.77 s game. So contact must land ≤ **0.78 s scene** after the strike start: (0.233 + 0.78) × 1.35 ≈ 1.37 s game + ≤ 1.77 = **≤ 3.14 s** (limit 3.19). Target ≈ 2.9 s.
Let T = cone travel = `clamp(dist × 1.6, 200, 240)` ms; swallow at 400 + T (600–640); silence **140 ms** (never < 120); **contact at 740–780**.

| scene ms | Attacker | Visual | Light | Sound |
|---|---|---|---|---|
| 0 | f2 | flakes peel off the opening cloak and stream INTO the rib cage (6–10 `stone2` / `fire2` motes per 100 ms, sucked to `points().core`): it feeds its heart with its own cloak | `lightPool(home, fire2 → fire3, r 28, 0.15 → 0.8, 'flicker')` | `takeCharge(u, 'ashenInhale')` (from the declaration) |
| 0–400 | f2–f5 | the heart heats; f4: 1 px `white` between the teeth | `followLight(mouth, fire3, r 10)` | |
| 400 | f6 release | **the ASH BANK** is born at `muzzle` ON the floor (§5.2.1) | jaw light fades (140) | charge handle `.stop(30)`; `play('ashenExhale')`; `start('ashenRoll', { pan })` |
| 400 → 400+T | f6–f8, then `holdFrame(u, 'attack', 9)` when f9 is reached | the bank ROLLS to the target, 10 → 28 px tall; its leading edge leaves a **soot trail** (`blob` `stone0`, rx 3, life 1400; positions kept for the fuse) | a dim `fire1` pool travels with the bank (0.2) | at 400 + ⅔T: `play('ashenHush')` + `fade(['ashenRoll'], 40)` |
| 400+T | f9 held | **SWALLOW**: the front billow settles over the target (no crest, no crash: the bank simply arrives and its top lip keeps rolling backwards). A LATTICE veil with 1–2 px gaps every 4 px, ≤ 70 % of its height (EF-2) | the travelling pool goes out; **`lightDim(scene, -0.3, 60)`** (floodlights dip, not a wash) | (the hush's ember ticks fall here) |
| +0…+140 | f9 held | **SILENCE**: the veil hangs almost still; its buried embers go DARK in 3 visible steps (each step one third of them `fire2` → `fire1` → gone), each step heard as a tiny descending tick | the darkest beat | `ashenHush` ticks (3, descending) |
| contact − 70 | f9 held | the last embers flicker INWARD toward the target centre on this frame (1 px) | | `play('ashenSuck')` |
| **contact (740–780)** | f9 held | **IGNITION**: `s.impact(at)`. Frame 0 = the kit's `contactFlash` (§5.2.2). EVERY ember in the veil turns `fire4` / `white` on the same frame; over the next 2 frames the billows step inside-out to `fire2` / `fire3` bands (stepped, no alpha); on those 2 frames the target is a **black silhouette** with 1–2 px `fire3` / `fire4` flame tongues | `lightFlash(at, fire3, r 40, 300, { ring: true, intensity: 1 })` + `lightPool(at, fire3 → fire2, r 30, 1.2, 'flicker')`; **`lightDim(scene, 0, 300)`** | `play('ashenIgnite')` (the VUF at t = 0) + the struck body (kit) |
| contact + hit-stop | | the hit-stop (heavy 115–130) holds; shake from the kit 3 / 4 px | | |
| +0 … +440 | | **burn-off**: flames lick up 3 frames, then the veil burns away top-down into falling ash flakes (gravity 120, flutter 12) and cooling embers; the silhouette overlay has already dropped (2 frames) | **floor scorch**: `blob` `stone0` rx 14 + 6 `crack`s `[fire2, fire1, stone0]`, life 1400 | `ashenIgnite`'s crackle tail |
| +130 … +370 | f9 held → f10 | **THE FUSE BACK** (bold idea #1): the soot trail lights in a chain from the target back to the jaw in 4 stepped segments, 60 ms each (`fire3` → `fire1` → `stone0` per segment), each smaller. When it reaches the jaw: `playFrom(u, 'attack', 10)` — **the heart answers LUB-DUB** and the **rib spill** pours (f10–f12) | a small `fire2` flash per segment (r 8 → 5) | `ashenFuse` (vuf-vuf-vuf, shrinking) then `ashenHeartbeat` 0.8 at the jaw |
| +370 … +740 | f10–f13 | the spill cools at the talons; a floor fan mark continues it (`blob` `stone1` + `fire1` rim, life 1400) | `fire2` pool r 10 at the talons, 0.4 → 0 | `ashenSpill` 0.7 |
| parallel | | the target's death starts 150 ms after contact | | |

The fuse and the spill run INSIDE the target's death (≥ 1.1 s), so they cost no time. **Re-measure `kaAdAtk` against the target with the longest death (crystal_wyrm-class death if lethal; use `kaAdAtk` vs magma_titan and `kaAdAtkLongDeath` §8.5) before KK-1.**

#### 5.2.1 The ash bank (`ashCone` in `-fx.ts`): a pyroclastic flow, not a wave
- 7–10 **billows**: stepped discs with three bands (`stone3` top lip toward the light, `stone2` body, `stone1` underside), on the floor line, ry = 0.55 rx.
- **They tumble BACKWARDS**: each billow's top lip moves 1 px per frame TOWARD the attacker while the billow advances, so the bank boils over itself like a pyroclastic flow. **No rising lip, no crest, no crash**: the bank's top edge stays lower at the front than in the middle (a nose that hugs the floor), the opposite of `tide_golem`'s cresting wave.
- New billows spawn at the muzzle every 40 ms for the first 160 ms, then the bank travels as one, its tail thinning.
- 14 buried embers: 1 px `fire2`, blinking slowly (2 on / 3 off).
- Width = the tile's width at the target; iso 2:1 axes.
- No alpha, no ADD blend (EF-7). It is lighter than the floor (`stone2` / `stone3` over `night2`) but far darker than any other breath in the game (no fire, no light until the ignition).

#### 5.2.2 Flash, silhouette and EF-3 (card-level exception, logged for the orchestrator)
- EF-3 says the sprite's own colour is not painted. **R1 itself asks for "hedef turuncu içinde kara silüet"**: this is the card-level exception, cited from YENI_KARTLAR §8 R1, logged in `docs/v3/oturum-a.md` for the orchestrator.
- **Frame order:** ignition frame 0 = the react kit's `contactFlash` (`_v3/react.ts:603`, the sacred 1–2 frame flash, YENI §5). Its tint is `o.ramp[4]` of the react ramp: the strike passes the drake's fire ramp so the tint is `fire4`. **Verify** in `kaAdAtk` frames that the ramp reaching `react` for this attacker is the fire ramp (from the recipe `light.strike`); if it is not, ask the orchestrator for the additive hook — do not paint over the kit's flash.
- Frames +1 and +2 = the `ink` silhouette overlay (from `currentPixels(target)`) + flame tongues. The overlay's depth is **below** the flash image, so if the flash runs 3 frames (heavy) the flash still wins its frames.
- After +2 the target's own reaction / death pose shows.

### 5.3 Direct attack: budget ~1.6 s scene → ≤ 2.32 s game
- The same cuts: f2–f5 400 ms; the bank rolls to the duelist's podium (`s.toGround`, `clamp(dist × 1.6, 200, 260)`) and swallows the podium base (veil 22 px). Silence **120 ms**.
- Ignition: a 3-frame column of flame up the podium front + a podium scorch + a 3-segment fuse back. Shake 3. LP flow.
- Contact ≤ 0.78 s scene → ≈ 1.37 s game; + hit-stop + LP flow (≤ 0.4) + settle ≈ **2.1–2.2 s game**.
- If over 2.32: travel 200 flat, silence 120 (the floor).

### 5.4 Blocked (the defender survives in guard; film vs `polar_sovereign` DEF 2800)
- The bank **piles up against the guard plane**: the billows splay sideways and climb the front face.
- Silence 120 ms. The ignition happens ONLY on the front face (a 3-frame wall of flame); half of it rolls back toward the drake (a 30-px backwash cooling to ash). No fuse (the trail does not light: nothing burned).
- The target is NOT blackened. The kit's guard reaction plays.
- Sound: `ashenSnuff` at the pile-up, then `ashenSuck` + `ashenIgnite` at volume 0.6, pitch 0.85.

### 5.5 Losing (vs `crystal_wyrm` 2800 in attack position) and the tie
- Swallow and silence as normal. The fire **does not take**: only 3 embers pop (`ashenSputter`).
- On that frame the defender's answer comes back along the line (EF-13, `backlash(scene, from, to, ramp)`) and hits the drake → its death (§5.6). The fizzled veil sinks as grey ash in 300 ms.
- **Tie** (`steel_silencer` 2400): the full ignition AND the backlash on the same frame; no fuse (the drake is dying).

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
  3. **The ember that won't die** (bold idea #2): the heart's last `fire1` pixel stays after the heap is gone, pulses once (`fire1` → `fire2` → `fire1`, a faint double tick `ashenLastBeat`), then, if the kit exposes the graveyard card's sprite, rides its flight as a 1-px trailing ember and goes out on landing; otherwise it goes out in place after the pulse. Verify which in the kit before building.
  4. A faint grey stain on the tile (`blob` `stone0`, life 1200) fades last.
- The handler resolves when the card lands (the kit's rule); the heap layer finishes on its own.
- **In defense** the kit's guard break opens the cocoon into death f0. **By spell** (Yıldırım Hükmü): same handler.
- **Sound** (CHARACTER roles): `deathStart` `ashenCrackle`, `dissolve` `ashenCrumble`, `afterDissolve [[3, 'ashenCoreDrop', 0.9]]`, `burst` `ashenCool`; `ashenLastBeat` from `ashHeapBurst`.

### 5.7 Signature moments (vanilla ace: the rebirth is dropped)
1. **The delayed ignition + the fuse back** (attack): swallow, silence (embers going dark, the hall dimming, three falling ticks), VUF, black silhouette in orange, and the trail burning back to the drake's own heart. Never shortened below 120 ms of silence, at any outcome.
2. **"Kor Dökülmesi", the rib spill**: the heart flares and embers pour out between the rib bars like sand through a grate, cooling to an ash fan. **Guaranteed** on every attack win (f10–f12, after the fuse) and every summon (f11–f12, after the shock). The long form (mantle + roar) plays at the duel end.
3. **The double heartbeat** as a leitmotif: the summon's chest "güm", the fuse's arrival, the revive's plate-by-plate re-lighting, the last ember. No other **v3-look** card has a double low beat (`magma_titan`'s v1 summon has 3 chest thuds, `summon-a/magma_titan.ts:312`; v1 only).

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
| EF-3 | ignition frame 0 = the kit flash (tinted `fire4`); frames +1/+2 = the ink silhouette (R1 card-level exception, logged); overlay depth below the flash |
| EF-4 | white ≤ 1.5 % of the screen |
| EF-6 | every light stepped; `lightDim` −0.3 is a floodlight dip, not a wash |
| EF-7 | exactly one ring per beat: f7 = `lightFlash` ring only; f10 = the finale's shockwave only (billows ride it); `playerRing: false` |
| EF-8 | no `ctx.focus` |
| EF-11 | no hologram in the summon |
| EF-12 | the death continues the reaction; the card is born on the burst frame; the heap is drawn once |
| EF-13 | the losing ranged attacker is answered along its line |

---

## 6. SFX design (`src/audio/v3/ashen.ts`, kit blocks + Voice primitives only)

### 6.1 Identity
**R1 Kül Ejderi:** main pitch / colour = **50 Hz double ember heartbeat** (lub 62 → 46 Hz, DUB 170 ms later 56 → 42 Hz), **made audible on small speakers** by a 2nd/3rd-harmonic layer, a 150–180 Hz band-passed knock and the 160 / 320 Hz rib-tube band. Signature material = ash + ember. Distinguishing layer = **the delayed ignition**: a held breath (descending ember ticks), a suck, then a low-pass that slams open.
Palette: no glass, no saw drones, no FM metal. Brown and pink noise, low sine thumps with harmonics, a hollow two-tube rib resonance (160 / 320 Hz band-passes), dry ember crackle (`crack` 1.5–4 kHz).
Target A-weighted centre ≈ 900–1300 Hz, energy < 600 Hz ≈ 0.6.

### 6.2 Recipes
Sustained sounds follow `wyrmBreathCharge` (`src/audio/v3/slice.ts:202`): rise for D, a plateau, a long natural fade, and the cinematic stops them on the mark with `handle.stop(ms)`. Lengths are sized in REAL seconds against scene × 1.35.

| Name | Role / when | Recipe (kit blocks) | duck |
|---|---|---|---|
| `ashenHeartbeat` | summon f3, fuse arrival, layered into land / reviveBeat / lastBeat | per beat: `thump(v, t, 62, 46, 0.55, 0.16, { drive: 1.5 })` + **the audible body**: the same thump `{ drive: 2.5 }` an octave up at 0.25 (2nd/3rd harmonics), a 165 Hz band-passed knock `puff(v, t, 0.05, 0.25, 165, { kind: 'pink', q: 4 })`, the rib tubes `sweep(v, t, 0.18, [160, 170, 160], 0.05, { q: 8 })` + `[320, 340, 320]` 0.03; DUB at t = 0.17 (56 → 42, 0.4, 0.2, all layers × 0.8); an ember tick `crack(v, 0.24, 0.05, { hp: 2200, lp: 6000, n: 2, gap: 0.03, dec: 0.004 })` | 0.3 |
| `ashenMound` | `arrive` | `puff(v, 0, 0.3, 0.4, 600, { kind: 'brown' })`; sand trickle `crack(v, 0.03, 0.06, { hp: 3000, lp: 7000, n: 10, gap: 0.03, dec: 0.004 })`; `sweep(v, 0, 0.35, [900, 600, 300], 0.04, { kind: 'pink' })` | 0.2 |
| `ashenEmber` | the ember touches the mound | `v.tone('sine', 2200, { g: perc(0.06, 0.12, 0.0005) })` + 3300 at 0.02 + `crack(v, 0, 0.08, { hp: 5000, dec: 0.003 })` | 0 |
| `ashenKindle` | ring ignition | `sweep(v, 0, 0.14, [500, 2400, 1200], 0.12, { kind: 'pink', pan: [-0.5, 0.5], peakAt: 0.3 })`; `puff(v, 0.02, 0.2, 0.3, 1800, { kind: 'brown' })`; `crack(v, 0.05, 0.08, { hp: 1800, n: 4, gap: 0.04, dec: 0.006 })` | 0.25 |
| `ashenTornado` (sustained) | the build; `.stop(90)` on f7 | D = 0.5 rise, plateau to **1.4 s**, natural fade to 1.7: two rising pink sweeps `[200, 900, 1600]` / `[250, 1100, 1800]` (q 2, panned apart) reaching their top at D and holding; a brown rumble (160 Hz low-pass, `v.wander` gain); grains `crack` n 40, gap 0.03, hp 3500, density rising to D then steady. Covers 540 scene × 1.35 ≈ 0.73 s with slack for slow-motion. | 0.4 |
| `ashenTalon` | `land` (f1) | `thump(v, 0, 110, 50, 0.4, 0.3, { drive: 1.5 })`; scrape `crack(v, 0, 0.12, { hp: 2500, lp: 5000, n: 3, gap: 0.012, dec: 0.01 })`; `puff(v, 0.005, 0.2, 0.3, 900, { kind: 'brown' })` | 0.3 |
| `ashenRoar` | `roar` (cut-in flare) | `growl(v, 0, { d: 1.6, f: [46, 74, 64, 52, 36], formants: [260, 540, 1350], g: 0.9, grit: 6.5, rasp: 55 })`; hollow ribs `sweep(v, 0.05, 1.4, [150, 200, 150], 0.12, { kind: 'pink', q: 8 })` + `[300, 400, 300]` q 9, 0.06; the heartbeat at 0 (0.7); tail: ember crackle `crack(v, 0.9, 0.12, { hp: 1500, lp: 6000, n: 6, gap: 0.08, dec: 0.01 })` + a pink hiss hp 3 kHz fading 0.8 s. No glassRain, no bar partials. | 0.65 |
| `ashenLand` | the f10 slam (played by us; finale `sfx: null`) | `thump(v, 0, 70, 30, 0.8, 0.6, { drive: 3 })`; `puff(v, 0.004, 0.5, 0.9, 1200, { kind: 'brown' })`; settling `sweep(v, 0.05, 1.0, [1200, 600, 300], 0.08, { kind: 'pink' })`; heartbeat at 0.25 (0.6) | 0.6 |
| `ashenSpill` (new) | the rib spill (attack f11, summon f11) | sand through a grate: `crack(v, 0, 0.5, { hp: 2800, lp: 7000, n: 26, gap: 0.018, dec: 0.003 })` with density falling; a soft `sweep(v, 0, 0.5, [2400, 1400, 700], 0.05, { kind: 'pink', q: 1.5 })`; a cooling hiss `v.noise('white')` hp 5000, 0.04, fading 0.6 s | 0.25 |
| `ashenInhale` (sustained) | `charge` (declaration → release); `.stop(30)` on f6 | D = 0.45 rise: reversed pink `sweep [600, 1600, 2800]` 0.12 reaching its top at D, then a **plateau to 1.1 s** (the held breath, a narrow 2.8 kHz band with a slow wobble), natural fade to 1.4; rib rattle `v.flutter(22, …)` on a 900 Hz band-pass through the plateau; two quickening heart thumps (48 Hz, with the harmonic layer) at 0.3 and 0.42. Covers (0.233 + 0.40) × 1.35 ≈ 0.86 s real with slack. | 0.3 |
| `ashenExhale` | `release` | `puff(v, 0, 0.45, 0.35, 2500, { kind: 'pink' })`; `thump(v, 0, 80, 40, 0.4, 0.25)`; `crack(v, 0.01, 0.06, { hp: 2500, n: 3, gap: 0.02 })` | 0.35 |
| `ashenRoll` (sustained) | the bank travels; `fade(['ashenRoll'], 40)` at ⅔T | `sweep(v, 0, 1.2, [800, 1800, 2500], 0.12, { kind: 'pink', q: 1.1, peakAt: 0.6, pan })`; a tumbling growl (brown, 180 Hz low-pass, amplitude wander 6–9 Hz); sparse ember ticks `crack` n 8 | 0.3 |
| `ashenHush` | at ⅔ of the travel (≈ 70–80 ms scene before the swallow) | the duck carrier: a brown swell under a 120 Hz low-pass, 0.04 peak at 0.1, gone by 0.35; **3 descending ember ticks** as the embers go dark: `v.tone('sine', 3200 / 2600 / 2100, { g: perc(0.03 → 0.02 → 0.012, 0.04, 0.0005) })` at 0.12 / 0.19 / 0.26 s (each with a 1-grain `crack` hp 4000). Starting early gives the 0.7 duck its 50–200 ms to dip (SE-7) before the silence. | **0.7** |
| `ashenSuck` (new, split) | 70 ms scene before `s.impact` | `sweep(v, 0, 0.09, [180, 600, 1400], 0.05, { kind: 'brown', peakAt: 0.95 })` | 0.3 |
| `ashenIgnite` | `impact` (the VUF; **the whomp at t = 0**) | the whomp `thump(v, 0, 90, 34, 0.7, 0.45, { drive: 2.5 })` + `puff(v, 0, 0.6, 0.5, 2600, { kind: 'brown', att: 0.002 })` + the low-pass slam `sweep(v, 0, 0.9, [400, 3200, 900], 0.22, { kind: 'pink', q: 0.9, peakAt: 0.06 })` + `crack(v, 0.002, 0.5, { hp: 900, lp: 5000, n: 3, gap: 0.009, dec: 0.02 })`; the fire bed (brown, 300 Hz band-pass, 1.0 s decay); sizzle `crack(v, 0.13, 0.12, { hp: 2500, n: 8, gap: 0.06 })`. (The chest's answer moved to the fuse.) | **0.8** |
| `ashenFuse` (new) | the fuse back | 4 shrinking whomps at 0 / 0.08 / 0.16 / 0.24 s real: `thump(90 → 34)` levels 0.35 / 0.25 / 0.17 / 0.11 + `puff(…, 2000 → 1200, brown)`, each panned from the target toward the attacker (`pan` interpolated) | 0.3 |
| `ashenSputter` | the losing ignition | three weak brown `puff`s (lp 1400, 0.12) at 0 / 0.09 / 0.2 + `crack` n 3 + a falling `sweep [900, 400, 200]` | 0.3 |
| `ashenSnuff` | the blocked pile-up | `puff(v, 0, 0.35, 0.3, 900, { kind: 'brown' })`; a muffled `sweep [300, 900, 300]` q 2, 0.12 | 0.3 |
| `ashenCrackle` | `deathStart` | `crack(v, 0, 0.2, { hp: 1800, lp: 6000, n: 6, gap: 0.03, dec: 0.008 })`; `thump(v, 0, 70, 40, 0.25, 0.2)` | 0.3 |
| `ashenCrumble` | `dissolve` | descending trickle `sweep(v, 0, 0.6, [3000, 1800, 700], 0.1, { kind: 'pink' })`; grains `crack` n 20, hp 3500, dec 0.004, gap 0.025; `puff(v, 0.1, 0.25, 0.5, 700, { kind: 'brown' })` | 0.35 |
| `ashenCoreDrop` | `afterDissolve +3` | a muffled `thump(v, 0, 120, 60, 0.35, 0.2)` under a 600 Hz low-pass; a hiss start (white hp 4000, 0.4 s) | 0.3 |
| `ashenCool` | `burst` | the cooling hiss (white hp 5000, 1.0 s); the gust `sweep(v, 0.25, 0.8, [400, 1400, 500], 0.14, { kind: 'pink', pan: [-0.4, 0.6] })`; the last 3 crackles | 0.3 |
| `ashenLastBeat` (new) | the last ember's pulse | the heartbeat at 0.25 level, the sub-thumps removed (only the knock + rib tube + tick): a faint double tick | 0 |
| `ashenReviveGather` (sustained) | `reviveGather` | D 0.6 rise, plateau to 1.2, fade 1.5: rising pink `sweep [300, 1200, 2400]`, accelerating grains, 2 soft heart beats in the heap at 0.15 / 0.32 | 0.4 |
| `ashenReviveBeat` | `reviveLand` | the heartbeat ×2 at 1.4× level + `ashenKindle`'s puff | 0.5 |

- Export `V3_ASHEN_RECIPES`, `type AshenSfxName`, `ASHEN_SUSTAINED = ['ashenTornado', 'ashenInhale', 'ashenRoll', 'ashenReviveGather']`.
- Levels: `ashenIgnite`, `ashenRoar`, `ashenLand` peak ≤ −1 dBFS after `V3_CEILING` (SE-6).
- **Sync (SE-1):** `clip --marker ashenIgnite` must land on the ignition frame (≤ 1 frame); `ashenSuck` precedes it by 70 ms scene (≈ 95 ms real) on the frame the embers flicker inward.

### 6.3 Distinctness (SE-4)

| Neighbour | Risk | Why it stays apart |
|---|---|---|
| `stone_sentinel` (voice 'rumble', ≈ 49 Hz) | the same low register | Its rumble is unpitched brown noise with gravel. Ours is a PITCHED double thump with audible harmonics, a 165 Hz knock and silence between the beats. Measure LSD on `land` / `burst` / `dissolve`; if < 15 dB, move the heartbeat to 54 / 48 Hz and raise the rib band. |
| `abyss_magus` (36.7 Hz saw drone) | dark, low | No saw, no drone; all our lows are percussive. |
| `crystal_wyrm` | dragon roar | Formants 260 / 540 / 1350 vs 330 / 760 / 1950; rasp 55 vs 34; no glass tail. |
| `magma_titan` (v1 `earthQuake` / `impactHeavy`; v1 summon 3 chest thuds) | fire + weight; repeated thuds | We never use `earthQuake` or `impactHeavy` (the finale's default is turned off with `sfx: null`). Our beats are a pair with harmonics and a rib tube, and the "only double low beat" claim is scoped to the v3 look. |
| `tide_golem` | a rolling mass | Its wave is water (bubbles, splash). Ours is dry pink hiss + tumbling brown + ember ticks. |
| `ember_wolf` (v1 fire crackle) | crackle | Ours is sparse dry ticks; a fire bed only for 1 s after the ignition. |
| `venom_drake` (lane-mate) | drip / hiss | No liquid drips; the spill is dry grains through a grate. LSD vs its roles. |
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

### 6.5 The struck body (SE-5)
- **Phase 1:** `body: { physical: 'ash' }` with `ash.sound = { same: 'stone' }` (the stone/ash family, §5.2).
- **Phase 2 (orchestrator):** an own ash hit (`GENERATED_HIT_MATERIALS` in `src/audio/v3/materials.ts` + the pinned `tests/art/materials.test.ts:324-325`). Ask first (§10 Q2).

---

## 7. Card art and cut-in

### 7.1 Card art (`src/art/cardart-v3/ashen_drake.ts`, `CardArtV3`)
- **Subject (R1):** the drake perched on an ash heap at the cliff edge, ash streams blowing **to the RIGHT** (R1), the ember chest, a dark violet sky.
- **Backdrop:** `paintBackdrop(p, 'DARK', { focus, pool: true })` (`fire1` stepped pool under the heap).
- **big 88×68 — crop chosen (§11 #21):** the idle f0 pixels 1:1 from the hood peak to the knees (frame y ≈ 10 → 74, 64 rows) + **the talons sunk into the heap**: a new stepped `stone1` / `stone2` mound fills the bottom 8 rows of the card and covers the cut at the knees, so the heap reads and the hood keeps its full inverted U and spurs. 4 rows of air above the spurs.
  - Subject 60–75 % of the area, head in the right third.
  - The eclipse crown 4 px behind the hood peak.
  - **Ash streams (R1, blowing right):** 3 flat 2-px ribbons of `stone1` / `stone2` from the hem and the heap's top drifting RIGHT, passing **below** the jaw line and ending ≥ 4 px before the right edge; the air in front of the eye stays clear.
  - **The brightest point** = the heart (`fire4` + one `gold4`) at ≈ (46, 34).
- **small 44×34:** a tighter 1:1 crop: skull, hood edge with one spur, the heart. Hand-check at ×6; `patch`; never `autoSmall`.
- **Living frames: 3** (rest / LUB / dub), `holdMs` ≈ [1400, 150, 450] (one 2 s heartbeat cycle): frame 1 heart + rib leaks one step brighter, frame 2 half a step. Palette steps only, no motion.
- **Wire it:** `src/art/cardface-v3/index.ts` `ART.ashen_drake` + the import.
- Acceptance: off-palette 0, isolated ≤ 10 %, checker ≤ 0.5 %, ≤ 20 tones (backdrop ≤ 6), outline ≥ 90 % ink (the hem lip is inside the outline), focus in the box.

### 7.2 Cut-in portrait (`src/art/cutins-v3/ashen_drake.ts`, 200×144, `p2: 'relight'`)
- **Concept "Başlık" (the hood):** the near cloak's wrist (with its claw spur) and hood fill the upper-left two thirds; 6–8 px plates, two tones (`stone2` / `stone1`), ember-eaten lower edges inside the outline. The skull emerges toward the right and down, crest streaming back. Below the jaw, **the rib cage with the heart — the slam's subject**. Key light top-left, `void2` rim.

| f | hold | Pose |
|---|---|---|
| 0 | 180 | the stare: the head deep in the hood's shadow, eye `fire1`; one flake leaving the hem |
| 1 | 120 | the eye ignites (`fire4`); LUB |
| 2 | 120 | **flare (≈ 300 ms)**: the hood lifts, the jaw cracks open (a hollow roar, no drool), throat `fire3`; DUB |
| 3 | 140 | **slam (≈ 420)**: **the ribs flare with light** — every rib gap `fire3` / `fire4`, the bars flexing open, a burst of ember grains spilling OUT between the bars; the eye `white` core |
| 4 | 340 | held: grains stream down through the rib bars, flakes lift off the hood |

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
  attack: { type: 'beam', blow: 'magic', from: 'muzzle', vfx: 'ashCone', tone: PAL.fire3, ranged: true, blocked: 'splash' },
  summon: { style: 'vortex', matter: 'stone', roarPeak: 4 },
  death: { material: 'stone', accent: 'fire' },   // → { material: 'ash', accent: 'fire' } the day 'ash' lands (§5.6)
  flip: { accent: 'sparks', ramp: 'fire' },
  voice: { custom: 'ashen_drake' },
  light: {
    glow: { emissive: [[PAL.fire4, 1], [PAL.gold4, 1], [PAL.fire3, 0.75], [PAL.fire2, 0.3]], halo: 0.55, pool: 0.8, spill: PAL.void2 },
    strike: PAL.fire3,
  },
  cutIn: { rhythm: { flare: 300, slam: 430, exit: 720 } },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
```
- No edit to `_v3/presets.ts` / `view/light/profiles.ts` v1 rows.

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
  - The `'ash'` `ShatterMaterial` (§5.6, three files).
  - `shots/kart-a/camera-base.json`: add the new `kaAd*` keys (a measured base run) before the camera gate is used.
- Nothing in `src/data/cards.ts`.

### 8.5 Scenarios: `src/duel/scenarios/kart_a_ashen_drake.ts` (new)
Effect-free opponents are preferred so the films show only this card (`src/data/cards.ts` checked).

| Key | Stage / steps | Films |
|---|---|---|
| `kaAdSummon` / `kaAdSummonP2` | tribute summon (P1 / P2) | the full entrance + cut-in |
| `kaAdAtk` / `kaAdAtkP2` | vs `magma_titan` (2100, attack position; its effect is on summon only) | swallow → silence → ignition → fuse → kill, power 2 |
| `kaAdAtkWeak` | vs `lumen_sprite` (400, attack position; its effect is on normal summon only) | dmg 2000 → **power 3** (≥ 1600) |
| `kaAdAtkLongDeath` | vs `abyss_magus` (2300, attack position; set on the field, so its tribute effect does not fire) | the budget check against a long ace death |
| `kaAdDirect` / `kaAdDirectP2` | the opponent has no monster | the direct attack |
| `kaAdBlocked` | vs `polar_sovereign` in DEFENSE (2800; its effect only triggers on its destruction) | the pile-up, the wall ignition, the LP loss |
| `kaAdDefWin` | vs `stone_sentinel` in defense (2100 < 2400, vanilla) | the target's guard break |
| `kaAdLose` / `kaAdLoseP2` | vs `crystal_wyrm` (2800, vanilla) | the sputter, the backlash, the drake's death |
| `kaAdTie` | vs `steel_silencer` (2400; `trapLock` is passive) | ignition + backlash, both die |
| `kaAdHit` | the drake in DEFENSE, attacked by `volt_lizard` (1500; its effect needs its own destruction) | the cocoon holds |
| `kaAdKill` / `kaAdKillP2` | attacked by `crystal_wyrm` (2800) | hitMagic → death → the heap |
| `kaAdKillPhys` | attacked by `polar_sovereign` (3000) | hitHeavy → death |
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
Thresholds (P1 and P2): Sİ-2 margin ≥ 2 px; HA-14 ≤ 1.2; HA-15 ≤ 2.0; HA-16 ≤ 1.4; HA-17 ≤ 1.8; **HA-18 ≥ 15 % (measured first on idle f0–f3, §4.1)**; HA-19 0.3–0.8; HA-20 ≤ 400 ms; HA-21 < 50 %; IŞ-10 ≤ 10 / 15 / 20 %; **HA-9 rows 94–99 fixed in idle / guard / toGuard / fromGuard (tail included)**; HA-1 / HA-25; IŞ-1 litBias > 0; KK-13; ≤ 20 colours; exactly 1 `gold4` in idle / guard / hit frames; **HA-3 attack: longest f4, release f6 ≤ 70, contact f9 50–90**.

**KK-1 reference gate:** idle f0 first, next to `crystal_wyrm`, `magma_titan`, `venom_drake` (lane-mate) and `grim_warden` at ×3 and ×1 on the board; the §1.3 contrast check; IoU low against all four. A critic approves before any anim.

### 9.2 Films (P1 and P2; LOOK at every PNG)
```sh
for s in kaAdSummon kaAdSummonP2; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 24 --every 160 --start 300 --cols 6 --out $O/$s.png; done
for s in kaAdAtk kaAdAtkP2 kaAdAtkWeak kaAdAtkLongDeath kaAdDirect kaAdDirectP2 kaAdBlocked kaAdDefWin kaAdLose kaAdLoseP2 kaAdTie kaAdChains kaAdMirror; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 20 --every 100 --start 200 --cols 5 --out $O/$s.png; done
for s in kaAdHit kaAdKill kaAdKillP2 kaAdKillPhys kaAdGuardKill kaAdBolt kaAdRevive kaAdPos kaAdFlip; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 16 --every 100 --start 200 --cols 4 --out $O/$s.png; done
# swallow → silence → ignition → fuse, frame by frame at 3x (set --start from measure's contactMs − 250):
node tools/shot.mjs "?dev=duel&s=kaAdAtk&look=v3" --fresh --film 30 --every 17 --start <contact-250> --clip 260,90,260,150 --scale 3 --cols 6 --out $O/ignite-x3.png
node tools/shot.mjs "?dev=duel&s=kaAdKill&look=v3" --fresh --film 80 --every 17 --frames $O/killframes --out $O/kill-all.png
node tools/shot.mjs "?dev=cutin&id=ashen_drake&look=v3" --scale 2 --out $O/cutin.png
node tools/shot.mjs "?dev=cutin&id=ashen_drake&look=v3&player=2" --scale 2 --out $O/cutin-p2.png
```
- Check on the ignite strip: frame 0 kit flash tinted `fire4`, frames +1/+2 ink silhouette, one ring, the fuse reaching the jaw on f10.
- Check on the kill strip: the heap drawn once (no rubble flying out of a heap that stays), the last ember.
- Card art: the KART_RESIMLERI §9 render script with `--painter src/art/cardart-v3/ashen_drake.ts --frames` (3 frames), plus `?dev=cards3`.

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
| summon (tribute ace) | ≤ 4350 | ≈ 3900 |
| attack vs monster (incl. `kaAdAtkLongDeath`) | ≤ 3190 | ≈ 2900 |
| direct | ≤ 2320 | ≈ 2150 |
| declaration | ≤ 435 | |
| destroy | ≤ 2030 | |
| revive | ≤ 3050 | |
| position | ≤ 580 | fromGuard only |
| cut-in | ≤ 900 (scene) | |
| LP flow | ≤ 400 | |

- The number at contact ±17 ms; the contact is the ignition.
- `palcheck`: off-palette Δ ≤ 1 point; white ≤ 1.5 %; no row > 60 % white.
- Clips: true peak ≤ −1 dBFS, 0 clipped; `--marker ashenIgnite` on the ignition frame (≤ 1 frame, also at `&speed=3`); the sustained sounds still audible at their marks (no gap before `.stop`).
- **Small speakers:** render the heartbeat through a 150 Hz high-pass (a laptop proxy); the double beat must still read (≥ −30 dBFS RMS in the 150–400 Hz band per beat).
- SE-4 LSD vs `crystal_wyrm`, `abyss_magus`, `stone_sentinel`, `tide_golem`, and the lane-mates' roles: median ≥ 15 dB, min ≥ 10 dB.
- Camera gate passes (`zoom.max` = 1) against `shots/kart-a/camera-base.json` after its `kaAd*` keys exist.

### 9.4 Repo gates
```sh
npm run typecheck && npm test
node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films          # 17/17 IDENTICAL
node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films     # 26/26 IDENTICAL
grep -n "setScale\|setAngle" src/cinematics/strikes-a/ashen_drake*.ts src/cinematics/summon-a/ashen_drake.ts   # must be empty
```
- **Known failures, honestly:** `hourglass_imp`, `shield_titan` (+ lane D's `scrap_raiders` G1) are other owners'. `dusk_ashen` today fails on the OLD drake; after this rebuild it must pass for the drake half: all 13 anims (victory included), `validateArt` normal tier clean except HA-1 attack/death notes, P2 opaque diff 0. If its `dusk_sorcerer` half still fails, that is the dusk owner's.
- **`tests/art/ashen_drake.test.ts` (rewritten):** 13 anims with holds and marks (attack: charge 1, release 6, contact 9, recover 10; death: dissolve 5; summon / revive: land); `validateArt(art, { tier: 'ace' })` clean; deterministic; P2 opaque diff 0; the vulture shape (idle f0 w/h 0.75–1.05; opaque 2900–3500; the topmost opaque row at x < the skull's x; the skull's lowest row ≥ 30 px below the hood peak); HA-9 rows incl. the tail; margins; exactly one `gold4` in idle f0; no `night0` pixel outside the rib-cavity box in idle f0; death f11 opaque ≤ 40 px (the near-empty frame); card art (3 frames, both sizes) and cut-in within budget.
- `tests/presentation/recipes.test.ts` covers the recipe; `tests/art/materials.test.ts` covers `ash.ts`.
- Sameness: `npx vite-node tools/sameness.ts --look v3 --ids ashen_drake,crystal_wyrm,venom_drake,magma_titan,grim_warden` (report) + a blind silhouette test.

### 9.5 Critique rounds (≥ 3)
- Round 1 (done for the design: §11). Build round 1: idle f0 + idle / guard sheets. Round 2: all sheets + attack / summon films. Round 3: every film + clips + gates. Evidence paths in `docs/v3/oturum-a.md`.

---

## 10. Risks and open questions

### Risks
1. **The veil vs EF-2.** Lattice veil, ≤ 70 % of the height. If it fails on the 3× strip, lower it to the waist.
2. **The silence must read as intent.** 140 ms scene ≈ 190 ms game. Carried by: the embers going dark in 3 visible steps with 3 audible falling ticks, the floodlight dip, the music duck started before the swallow, the attacker's held watch pose. Test with an outside viewer.
3. **The attack budget.** Worst case ≈ 3.14 s against 3.19. If `kaAdAtkLongDeath` exceeds it: travel 200 flat, silence 120. Never cut the fuse (it is parallel) or the silence below 120.
4. **Lane-mate overlap.** `venom_drake` silhouette and "liquid from the mouth" motifs; ours keeps the hood above the head and spills from the ribs only.
5. **Heartbeat vs `stone_sentinel` (49 Hz).** Measure LSD early (§6.3).
6. **Frame budget** 133 / 140. Victory is the first to cut, but `dusk_ashen.test.ts` requires it; cut roar frames instead (12 → 10).
7. **HA-18 with a calm creature.** Budgeted per part (§4.1) and measured on f0–f3 first.
8. **`ash` shatter not approved.** Then the stone preset breaks a near-empty frame; the identity holds through the heap layer (§5.6).
9. **The react ramp tint.** If the kit's flash for this attacker is not `fire4`, an additive hook is needed (§5.2.2).
10. **Card art / cut-in import the rig**: land in one commit.

### Open questions (for the orchestrator / owner)
- **Q1 (board heartbeat, bold idea #3).** While the drake is on the field, its tile light pool would pulse lub-dub every 2 s (a stepped double flicker of its glow). This needs one shared light-animation addition (a `pulse: 'double'` mode in the light layer) and a matching ambient tick system for the sound. Not built without approval; the living card art (3 frames, §7.1) carries the beat meanwhile.
- **Q2.** Own struck-body sound (`hitAsh*`, §6.5 phase 2)?
- **Q3 (asked NOW, plan of record).** The additive `'ash'` `ShatterMaterial` (§5.6) in `vfx/shatter.ts`, `_v3/presets.ts` `MATTER_RAMP`, `_v3/death.ts` `ACCENTS`.
- **Q4.** The trap ramp one-liners in `_mirror_v3.ts` and `chains_of_light.ts` (§8.4).
- **Q5.** The `kaAd*` keys in `shots/kart-a/camera-base.json` (§8.4).
- **Q6.** R1 card-level EF-3 exception (the ink silhouette, §5.2.2): please confirm and log.
- **Q7.** `_placeholder-new.ts` size (`ashen_drake: 80`): leave (v1 byte-identical).

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
| B2 | bold | the ember that won't die | **Adopted** (§5.6 step 3), with a fallback if the card sprite is not exposed. |
| B3 | bold | the board heartbeat | **Partly adopted:** the 3-frame living card art now; the tile pulse needs a shared light addition → Q1. |
