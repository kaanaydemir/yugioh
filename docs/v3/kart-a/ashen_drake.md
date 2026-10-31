# Kül Ejderi (`ashen_drake`): design and build plan (lane A, R1, NO rebirth)

KARANLIK / Ejderha · Sv7 · 2400/2000 · ★ As (2 tributes → cut-in) · `effect: 'none'` (vanilla, owner decision 2026-10-31 #2).
Source spec: `docs/v3/YENI_KARTLAR.md` §8 R1 (identity, idle, summon, attack, death, SFX), §5 / §5.1 / §5.2. Rules: `docs/v3/REHBER.md`.
Time: scene ms (the code's numbers). Game time is ×1.35 (`V3_TEMPO`), hit-stop ×1.55. The limit is REHBER §5 × 1.45 (`docs/v3/TEMPO.md`).
This document is the blueprint for the builders. Every path, function and API named here was read in the tree on 2026-10-31 (commit 7cc7e70).

---

## 0. One-paragraph pitch

A **vulture made of compressed ash and coal**. It perches hunched on its talons with its wings drawn over its shoulders like a hooded cloak.
The long neck hangs forward and down in an S, and the skull peers out from under the hood. Its only real light is an **ember heart** inside the rib cage. That heart beats twice, slow and low, every two seconds (50 Hz lub-DUB). The cloak never stops moving: ash flakes peel off its ember-lit hem, drift, and settle back.
It does not breathe fire. **It breathes ash.** A grey, ember-studded bank of ash rolls along the floor and swallows the target. Then everything goes silent. Then **every buried ember ignites at once** with a delayed "VUF", and the target stands as a black silhouette inside an orange blaze.
When it dies it crumbles from the top down into a heap of ash, its core falls into the heap, the heap cools, and the wind takes it.

---

## 1. Identity and silhouette

### 1.1 Why the current v3 art fails (it is replaced entirely)
Filmed: `?dev=monster&id=ashen_drake&look=v3` (sheet and board mode, evidence `<scratch>/kart-a/ad_cur.png`, `board_ashen_drake.png`).
- **Wrong animal.** It is a low quadruped that walks on its front knuckles (144×88 frame, w/h ≈ 1.9). R1 asks for a hunched vulture perch. On the board at 1× it reads as a flat grey lump that sits lower than the 64-px class monsters next to it.
- **It speaks the Titan's material language.** Orange lava seams run over the whole grey body, the haunch, the spine and the wing bones. That is exactly `magma_titan`'s lava-seam rule (`src/art/materials/defs/lava.ts`). The card reads as "lava rock lizard", not "ash and ember". R1's "nearest card: magma_titan, difference: ash, not lava" is violated.
- **No single brightest point.** The cracks glow everywhere at the same value, so the eye has nowhere to land (KART_RESIMLERI §3 "en parlak tek nokta", REHBER Sİ-6).
- **The wings are not ash layers.** They are a ragged dark-red membrane triangle, not shingled ash plates with ember edges that flake and re-form.
- **Rhythm and weight clash.** The `heavy` pounce and wing-slam attack and the head-low growl share the Titan's and the wolf's vocabulary. The idle is 14 f with ash noise particles, not the 20 f double heartbeat.
- Its card art (`src/art/cardart-v3/ashen_drake.ts`) and cut-in (`src/art/cutins-v3/ashen_drake.ts`) are made from that rig (they import `drawDrake` and `drawPose`), so both are redone with it.
- `tests/art/ashen_drake.test.ts` pins the old design ("low, wide quadruped", ratio > 1.4, `contact` 6). It is rewritten with the new art (§9).

### 1.2 The new silhouette (what reads at 1×)
Frame **120×104** (ace class, 1 art px = 1 game px). Anchor **(52, 99)**: the ground line between the gripping talons. `hover: 0`, `weight: 'heavy'` (§1.4).
idle f0 target: bbox ≈ **74 w × 84 h**, opaque **2900–3400 px**. That is ace mass, close to the wyrm's 3404, but taller than it is wide (w/h ≈ 0.9).

Key shapes, back to front (P1 view, facing right):

| Shape | Where (frame px, idle f0) | Read at 1× |
|---|---|---|
| **The hood**: both wing wrists hunched up ABOVE and behind the head, the cloak falling from them | near wrist peak ≈ (60, 12), far wrist peak ≈ (40, 16, one value darker); hem ≈ y 78 | an inverted U, a "shoulders-up" vulture block. This is the silhouette hook. |
| **The S-neck and skull** hanging out from under the hood | neck root (64, 40) → down-forward S → skull (86–100, 48–60), snout pointing to the floor ahead | a hook shape under the hood; the head is LOWER than the shoulders |
| **The smoke-spine crest** | 5 tapering spines along the skull and neck top, tips curling back like smoke | jagged dark fringe on the head |
| **The rib cage** at the cloak's front opening | (48–66, 46–70) | dark bars with the ember heart glowing between them: the brightest point |
| **The talons** gripping the floor | x 44–62, y 92–99 | two clenched three-toed feet, knees hidden under the cloak |
| **The tail** sweeping back and curling up into the **brazier tip** | from the hips (40, 82) back to (12, 92), tip raised to (8, 84) | a low curl with a small live flame at its end: the second light |

Proportions: the cloak is **~55 %** of the opaque area, the skull + neck **~15 %**, the talons + tail **~20 %**, the ribs and heart **~10 %**.
Nothing about it is upright or proud. The crystal wyrm stands tall with its chest up. This one stoops, peers and waits.

### 1.3 Materials and ramps (palette only: `src/art/palette.ts`)

| Material | Tones | Plane rule | Notes |
|---|---|---|---|
| **Compressed ash hide / bone** (skull, neck, ribs, talons, tail) | `PAL.stone0` (shadow, undersides), `stone1` (mid), `stone2` (lit plane), `stone3` (1-px lit edge only, IŞ-8) | 3 planes + crease, thresholds as `src/art/materials/defs/stone.ts` | skull top = the largest calm lit plane. No masonry courses: the texture is **compression strata**, 1-px `stone0` lines along the bone every 4–5 px, only on the mid / shadow planes (MA-2). |
| **Ash cloak plates** (the wings) | `stone1` (lit plate), `stone0` (plate shadow), `night0` (deep fold), hem lip `fire1`, hot hem `fire2` | shingled plates 3–4 px tall, 2 tones each, overlapping downward like roof tiles; each plate's lower edge 1 px darker (IŞ-5 crease) | **The hem is ember-eaten**: a 1-px `fire1` lip on every lower plate edge. A flake that is lifting off shows `fire2` (`fire3` only on the one flake detaching right now). |
| **Smoke spines** (crest, elbow spurs) | `stone1` → `void1` body, `void2` tips | 2 tones, ≥ 2 px wide at the base (no 1-px spikes) | the DARK attribute's accent: a cool violet against the warm embers |
| **Ember (LIGHT, drawn after the outline, never outlined; IŞ-9)** | `fire1` dim, `fire2`, `fire3`, `fire4` heart, **ONE `gold4` pixel** in the heart at rest | heart ≤ 5×4 px at rest (≤ 7×6 at full heat), glowing through 3 rib gaps; eyes 1 px `fire3` (2 px `fire4` when lit); brazier flame 2–3 tones, ≥ 3 silhouettes per loop | the lava rule's twin (lava.ts "exactly one gold4 at rest"): `white` only at full heat (attack f3–f4, summon f3, revive's last beat) |
| **Rim light (IŞ-7)** | `PAL.void2`, one continuous 1-px line on the shadow-side contour | — | a cold violet arena reflection. It separates the dark body from the navy floor and is NOT the Titan's `stone3` / `fire1` edge. |

- Colours per frame ≤ 20 (IŞ-11). Ramps used: `RAMPS.stone`, `RAMPS.fire` (fire1–fire4), `RAMPS.void` (void1–void2), `PAL.night0`, `PAL.gold4` (1 px), `PAL.ink` outline. No P1 / P2 colours in the body.
- **Brightest point:** the ember heart in the rib cage (`fire4` + the single `gold4`). The eyes and the brazier stay ≤ `fire3` at rest, so the heart wins every frame.
- **Not lava:** there are NO seams across the hide. Light exists only (a) inside the rib cage, (b) on the cloak hem, (c) in the eyes and the throat, (d) at the tail brazier. This is the single most important difference from `magma_titan`.

### 1.4 Weight class
`weight: 'heavy'` (`src/duel/motion.ts`: hit-stop 100–130 ms by power, shake 3–4 px, guard push 0/0/1).
R1's "hit-stop 120 ms" maps to heavy power 2–3 (115–130 ms) through the kit's `reactStopMs`. The body is hollow, but a 2400 ace that holds its blow should feel slow.
The SILENCE before the ignition is the strike's own pre-contact beat (§5.2), not hit-stop.
Rhythm per HA-8: charge→release **550 ms** (wyrm 460, magus 500). The longest wind-up of the aces suits the slowest-breathing monster.

### 1.5 P2 relight
- `p2: 'relight'`. Draw with `lightOf('right')` (`src/art/rigkit/light.ts`, the standard vector `LIGHT_V_LEFT` (−0.5, −0.74, 0.46)).
- **Do not keep** the old gbuf's private vector (−0.8, −0.56, 0.46) in `ashen_drake-gbuf.ts`. It breaks IŞ-1 comparability.
- Hand maps (the cloak plates, the skull planes) get `_L` / `_R` versions (IŞ-2, as in `abyss_magus-maps.ts`).
- Ember pixels, the eyes, the brazier flame and the `void2` spine tips are identical in both sheets. The `void2` rim moves to the other contour side.
- The ash flakes drift BEHIND the creature (frame −x). `flipX` mirrors them correctly for P2.

---

## 2. Distinction card (the `distinction` block of the art file)

```ts
distinction: {
  silhouette: 'a hunched vulture perch: both wing wrists pulled up above and behind the head into a hooded ash cloak (an inverted U), a long S-neck hanging the skull out forward and DOWN from under the hood, two gripping talons, a tail curling up into a small brazier flame; taller than wide, nothing upright',
  rhythm: 'slow and patient: long stillness, a double heartbeat, a 550 ms wind-up, a breath that rolls rather than fires, a held silence, then everything at once; recoveries settle like falling ash',
  idle: '20 f / 2.0 s: the ember heart beats twice (lub-DUB) once per loop; the head scans with a vulture tilt; ash flakes peel off the hem, drift and re-join; a smoke curl from the nostrils; the brazier flickers',
  guard: 'the cocoon: the cloak closes fully round the body, the head tucked under the hood\'s edge, only one eye and a slit of heart-glow showing; the hem embers dim to fire1 and breathe plate by plate',
  signaturePart: 'the ember heart seen through the rib cage (the only real light) and the ember-eaten hem of the ash-plate cloak',
  material: 'compressed ash and coal on the stone ramp with compression strata, a violet void2 rim, ember light only inside the ribs / hem / eyes / brazier; dies as an ash heap (the stone/ash ending, shared only with stone_sentinel, §5.2)',
  signatureMove: 'Kül Fırtınası Nefesi: the head drops to the floor and exhales a rolling bank of ash that swallows the target; silence; every buried ember ignites at once (the delayed VUF)',
},
```

**Nearest cards and how this one differs:**

| Card | Overlap | Difference |
|---|---|---|
| `crystal_wyrm` (ace dragon, beam) | ace dragon, breath attack, cut-in | Upright, bright white glass, an instant prism BEAM that hits on release. **This one** stoops, is dark, rolls a SLOW ground-level cloud, and its hit comes LATE after a silence. The roar is hollow and raspy with no glass. |
| `magma_titan` (stone + lava, heavy) | dark stone + fire tones, heavy | Lava seams over the whole body, a fist, a fireball. **This one** has no seams; the fire lives inside the rib cage and on a hem. The material is ash, not basalt; the motion is a perch, not a stomp. |
| `venom_drake` (lane-mate redesign, long-necked dragon) | long neck, dragon | Green-black serpent, sway and snap, a spit jet. **This one** is a hunched cloaked bird of prey with a rolling cloud. The two lane-A designers must cross-check silhouettes (§10 R4). |
| `ember_wolf` (fire, embers) | ember particles | The wolf's whole body burns. Here the embers are buried and dark until the single ignition. Its death material is `fire`; ours is ash / stone. |
| `stone_sentinel` (stone death) | the stone / ash crumble ending (§5.2 allows exactly these two) | The sentinel breaks into rubble that bounces. Ours crumbles top-down into ONE soft heap that cools and is blown away (§5.4). |
| `grim_warden` R2 (DARK, lane B) | DARK, smoke, green ghost fire | Ghost light, a lantern, a shroud. Ours has warm embers and no hanging lights. |

---

## 3. Rig approach

### 3.1 Choice: hand rig + G-buffer (ace tier, L5 custom), on the rigkit core, with compiled anim tables
- **No body plan fits.** `src/art/bodyplans/` has only `biped` (humanoid) and the serpent plan in `coral_serpent-plan.ts` (used by `venom_drake`). A perching winged dragon with a cloak is neither, and an ace is L5 custom by definition (REHBER §0.2).
- **Follow `crystal_wyrm`'s craft, on the shared core.** Use `src/art/rigkit/*` (`Raster` / `Workspace`, `lightOf`, `despeckle`, `composite` + creases, `edgePaint`, `castShadow`-style passes, `cracksOn`, `crumblePass` / `drawDebris`, `dissolvePass`). Do not copy a private pipeline again. The old `ashen_drake-gbuf.ts` (G layers, `gTube`, `gFacet`, `ik`, `rimLight`, `edgePaint`) is a valid reference, and its useful helpers may be ported. A3 says new monsters use the shared modules.
- **Motion:** `definePose` (`src/art/rigkit/pose.ts`) for the PoseKit and `compileAnims` + `toMonsterArt` (`src/art/rigkit/anim.ts`). The beats then get the marks by name (`charge`, `release`, `contact`, `recover`, `land`, `dissolve`, `struck`).
  - The compiler enforces out = 0 (HA-14), the struck frame moves its region only (HA-21), follow / lag (HA-6), the phases wrap (HA-7) and the smear is limited to the release (HA-12).
  - Regions (`REGION_IDS`) map as: `head` = skull + jaw + crest, `chest` = ribs + heart, `wingN` / `wingF` = the near / far cloak, `lower` = talons, `hips` = pelvis, `tail` = tail + brazier, `extra` = the flake set.
  - Escape hatch: per-frame patches (`AnimDef.frames`) for the summon / death / revive mask frames.
- **Cloak = plate field, not a membrane.** Each cloak is a list of ~22 plates in wing space, rows from the wrist down to the hem. A plate is a quad with its own normal, so it gets 2 tones. The rig places the plates by the wing's 3 bones (shoulder → wrist → 3 finger bones hidden inside the cloak).
  - A plate has a `lift` (0 = seated, 1 = detached): seated plates draw normally; lifted plates draw offset along the drift vector with a `fire2` lower lip; detached plates become flakes drawn by the art (1–2 px, max 3 per frame).
  - The flake budget keeps IŞ-10 noise ≤ 10 % in idle.
- **Ember pass after the outline.** It covers the heart, the rib-gap light, the hem lip, the eyes, the throat, the brazier and a `heat` scalar per frame (0 = dull … 1 = rest … 2 = white).

### 3.2 Pose fields (`AshenPose`, sketch)
`hip [x, y]`, `crouch` (0 rest … 1 sunk), `chestLift`, `ribSpread`, `heat` (heart), `heatEdge` (hem), `neckS [a0, a1, a2]` (three segment angles), `headPitch`, `headTilt`, `jaw` (0–1), `eye` (0 dark / 1 lit / 2 blaze), `crestFlare`, `wingN { wrist [x, y], open 0–1, mantle 0–1 }`, `wingF { … }`, `plateLift` (array per row for the flake wave), `talonGrip`, `tailCurl`, `tailSweep`, `brazier` (flame phase 0–1), `smoke` (nostril puff phase), `build` (summon mask height 0–1), `crumble` (death 0–1), `reform` (revive 0–1), `smearFrom` (release only).

### 3.3 Files (all per-card; old content replaced)

| File | Role |
|---|---|
| `src/art/monsters-v3/ashen_drake.ts` | the MonsterArt (rewritten): `toMonsterArt(...)` shell, anchor, core, muzzle, `weight: 'heavy'`, `p2: 'relight'`, `knock: 'pose'` + `poseKnockPx`, the `distinction` doc block, re-exports for the cut-in / card art / cinematics (`ASHEN_MOUTH`, `framePose`) |
| `src/art/monsters-v3/ashen_drake-gbuf.ts` | rewritten as the material table on rigkit (`materialTable(...)`): hide / bone, cloak plates (lit / shadow), spines, far side; frame consts `W = 120, H = 104, AX = 52, GY = 99` |
| `src/art/monsters-v3/ashen_drake-rig.ts` | the skeleton: hips → spine → S-neck (3 segments) → skull; legs IK to the fixed talons; tail chain (6 links) + brazier; rib cage drawn as bars over the dark cavity |
| `src/art/monsters-v3/ashen_drake-cloak.ts` (new) | the plate field: plate layout per wing (`_L` / `_R` tone maps), lift / flake logic, the hem lip, the mantle / cocoon / burst shapes |
| `src/art/monsters-v3/ashen_drake-ember.ts` (new) | the light pass after the outline: heart (heat → tones), rib-gap leaks, eyes, throat, brazier flame silhouettes, the summon build-line lip, the death crumble glow |
| `src/art/monsters-v3/ashen_drake-anims.ts` | the PoseKit (`definePose`), all loop / anim tables (§4), `points()` |
| `src/art/materials/defs/ash.ts` (new) | MaterialDef `ash` (draft, firstUser `ashen_drake`): stone ramp, `rim: PAL.void2`, `emissive` fire tones `pulse: 'breath'`, `interior: 'embers'`, `hit.debris: 'ember'`, `death { shatter: 'stone', accent: 'fire', pass: 'crumble', revive: 'reassemble' }`, `sound: { same: 'stone' }` (phase 1, see §6.5), `light { glow: fire3, pool: fire3 }` |
| `src/art/cutins-v3/ashen_drake.ts` | rewritten portrait (§7.2) |
| `src/art/cardart-v3/ashen_drake.ts` | rewritten card art (§7.1) |
| `src/presentation/cards/ashen_drake.ts` (new) | the recipe (§8.2) |
| `src/cinematics/strikes-a/ashen_drake.ts` (new) | strike "Kül Fırtınası Nefesi" (all outcomes) + the death hook |
| `src/cinematics/strikes-a/ashen_drake-fx.ts` (new) | drawing helpers: `ashCone`, `ashVeil`, `ignite`, `burnSilhouette`, `ashHeapBurst`, `scorch` (no top-level registration; harmless to the loader) |
| `src/cinematics/summon-a/ashen_drake.ts` (new) | signature entrance (mound → ember → ring → tornado → cut-in → shock ring) |
| `src/audio/v3/ashen.ts` (new) | `V3_ASHEN_RECIPES`, `AshenSfxName`, `ASHEN_SUSTAINED` (§6) |
| `src/duel/scenarios/kart_a_ashen_drake.ts` (new) | the filming scenarios (§8.5) |
| `tests/art/ashen_drake.test.ts` | rewritten for the new design (§9.3) |

Keep `src/duel/scenarios/mart_ashen_drake.ts` as it is: its keys `ad*` do not collide. Its `adKill` does not actually kill (windmane 2300 < 2400); the new file supersedes it.

---

## 4. Animations

Every one-shot ends on idle f0 (the compiler appends it; HA-14 out = 0). Holds are 40–200 ms (HA-2). The release is ≤ 70 ms, the longest wind-up frame is the one before the swing (HA-3), and recoveries lengthen 100 → 140 (HA-3).
Total **133 frames** (≤ 140, KK-13). Sheet bytes 120 × 104 × 4 × 133 = **6.64 MB / side** (ace ≤ 7 MB).

| Anim | f | ms | Marks | Note |
|---|---|---|---|---|
| idle (loop) | 20 | 2000 | — | double heartbeat |
| guard (loop) | 8 | 1280 | — | cocoon |
| toGuard / fromGuard | 6 / 6 | 390 / 390 | — | HA-20 is expected to trigger (cloak closes) |
| attack | 14 | 1550 | charge 1, release 6, contact 9, recover 10 | f9 is the cinematic's hold frame |
| roar | 12 | 1250 | charge 1, release 4, recover 8 | the "ember spill + mantle" signature pose |
| hit | 6 | 510 | impact = contact 0, recover 3 | |
| hitHeavy | 8 | 680 | impact = contact 0, recover 4 | |
| hitMagic | 8 | 620 | impact = contact 0, recover 4 | |
| summon | 14 | 1350 | land 1 | bottom-up build, cut-in held on f8 |
| death | 12 | 860 | impact = contact 0, dissolve 5 | crumbles top-down into a heap |
| revive | 12 | 1190 | land 6 | the heap re-forms bottom-up with the binding glow |
| victory (optional) | 7 | 960 | — | the mantle held; nothing plays it today (§10.4) |
| special | — | — | — | NOT drawn: a vanilla card. The roar is its signature pose. |

### 4.1 idle: 20 f, 2.0 s (YENI R1 "20 f, double heartbeat")
Holds: `110 70 80 110 100 100 110 110 100 100 100 100 110 110 100 100 90 90 100 120` (sum 2000; it lingers on the beats).
Overlapping parts with their own phases (HA-6: ≥ 3 phases, ≥ 2 periods, never all moving at once):

| Part | Period | Motion |
|---|---|---|
| **Heart** | 20 (one double beat per loop) | f0 **LUB**: heart `fire4` grows to 5×4, rib-gap leaks step up one tone, ribs push 1 px out. f1 relaxes. f2 **DUB** (weaker): 4×3, the leaks step up only on the centre gap. f3–f19 rest (`fire3` heart, one `gold4` core pixel). |
| Chest breath | 10 | rib cage and hood +1 px up on f4–f7 and f14–f17. The talons never move (HA-9). |
| Head scan | 20 | the skull slides 1 px forward f5–f8 and tilts on f8–f11 (a 1-px jaw-line shift, the vulture's sideways peer), then back. +1 frame lag after the chest (follow, lag 1). |
| Cloak plates | 20, a wave travelling hem → wrist | three flakes on staggered phases (f3, f9, f15): each lifts (`fire2` lip), drifts 2–3 px back and up over 3 frames, then re-seats. A flake never leaves the frame, and at most 2 are airborne on any frame. |
| Hem ember shimmer | 10 | `fire1` ↔ `fire2` steps travelling along the hem, 4 px per frame |
| Nostril smoke | 20 | one 2-px `stone2` curl on f12, rising and gone by f15 |
| Tail brazier | 5 (×4 per loop) | 3 distinct flame silhouettes + 1 low (`fire2` outer, `fire3`, `fire4` core) |
| Tail sweep | 20 | tail mid ±1 px, +2 frames after the hips |

Numbers: liveliness HA-18 ≥ 15 % (target 17–20 %). Seam HA-16 ≤ 1.4. Max Δ HA-17 ≤ 1.8 × idleΔ: the beat frame is the biggest jump, so keep the heart growth ≤ 2 px. HA-21 phase < 50 % in every idle frame.

### 4.2 guard: 8 f, 1.28 s, "the cocoon"
Holds `150 160 160 170 150 160 160 170`.
Pose: both cloaks closed in front of the body, overlapping at the chest. The far cloak is behind, one value darker. The near wrist is at head height. The skull is tucked down under the hood's edge with only the near eye showing (`fire3` 1 px). A 2-px slit of heart glow shows where the cloaks overlap. The hem embers are `fire1` only. The tail curls round the talons.
Breath travels one part per frame (as the wyrm's guard): plate row 1 lifts 1 px → row 2 → the slit glow steps up (`fire2` → `fire3`) → the head settles → the tail tip flickers. HA-19: guard Δ 0.3–0.8 × idleΔ (target 0.45).

### 4.3 toGuard / fromGuard: 6 f each, ≤ 0.4 s
- **toGuard** `50 60 60 70 70 80`: f0 the wrists rise. f1 the hood opens wide (a real in-between, HA-13). f2 the cloaks sweep forward round the body; the head starts to tuck but stays clear of the sweep (HA-29). f3 the overlap closes. f4 settle −1 px. f5 = guard f0.
- **fromGuard** `60 60 70 70 60 70`: the reverse with a mantle-open in-between (f2), ending on idle f0. The talons stay fixed.

### 4.4 attack "Kül Fırtınası Nefesi": 14 f, 1.55 s

| f | ms | Mark | Pose |
|---|---|---|---|
| 0 | 60 | | idle f0 + the cloak twitches (plates row 1 lift) |
| 1 | 90 | **charge** | the head lifts out of the S, the wrists rise, the cloak starts to unwrap. **The declaration holds this frame** (`battle/declare.ts`). |
| 2 | 110 | | wings half open: the plate undersides show `fire1` / `fire2` (R1 "kor alt yüzler"); the heart swells, `heat` 1.4 |
| 3 | 130 | | inhale: the neck draws back into a tight S, the ribs spread 2 px, the wings wide (a full span, the hood gone); `heat` 1.8 (gold) |
| 4 | **170** | | full wind-up (the longest frame, HA-3): head high and back, jaw shut, light leaking between the teeth; the heart white-hot (2×2 `white`, `heat` 2.2) |
| 5 | 50 | (swing) | the head whips forward and down; the crest streams back |
| 6 | 70 | **release** (+ impact) | the head is DOWN at floor level, the jaw wide; the exhale leaves the mouth at the floor. **Muzzle ≈ (106, 88).** Smear 2 px behind the skull (HA-12). |
| 7 | 90 | | exhale: the wings pump forward (a vulture's mantle over the cloud); the heart dims to `fire3` (spent) |
| 8 | 110 | | the exhale tails off; the heart is `fire2`: all its embers went into the cloud |
| 9 | 200 | **contact** | **the watch**: the head low and tilted, the jaw half shut, the eye on the target, the wings still half open. The cinematic holds this frame until the ignition (HA-2 allows a ≤ 200 ms nominal hold that the cinematic stretches, as the magus' aim f8). |
| 10 | 100 | **recover** | the ignition answers in its own chest: the heart flares back to `fire4` for this frame (a sympathetic beat), the head lifts |
| 11 | 110 | | the wings fold over the shoulders |
| 12 | 120 | | the cloak settles, the neck returns to the S |
| 13 | 140 | | (appended end = idle f0) |

charge→release = 90 + 110 + 130 + 170 + 50 = **550 ms**. HA-15 in ≤ 2.0 (f0 is near idle f0).
Points: `muzzle` = the mouth on EVERY frame (HA-25). On f6–f8 it is at floor height, so the cone is born ON the floor.

### 4.5 roar "Kor Dökülmesi" (the ember spill + mantle): 12 f, 1.25 s, the vanilla ace's signature pose
Played by: the summon without a cut-in (special summons), `summon-b/position.ts` (defense → attack, capped by its peak), the duel end's winners (`flow/end.ts`, `v3small/end.ts`) and the victory hold.

| f | ms | Mark | Pose |
|---|---|---|---|
| 0 | 80 | | idle f0, the heart beats LUB |
| 1 | 110 | **charge** | DUB; the head draws back under the hood; the wrists rise |
| 2 | 160 | | the longest: the **mantle**. Both wings spread forward and DOWN into a canopy over the floor in front (a vulture over its prey), the head low under it. |
| 3 | 60 | | the jaw drops (in-between) |
| 4 | 110 | **release** | the jaw wide: **embers pour from the mouth like molten drool**, a 1–2 px `fire3` / `fire2` stream to the floor. Crest flared, heart `heat` 1.9. |
| 5 | 90 | | the stream breaks into drops; a `fire2` puddle of 3 px on the floor line (drawn in-frame, under the jaw) |
| 6 | 90 | | the canopy shudders: row-1 plates lift on both wings (`fire2` lips) |
| 7 | 90 | | flakes shaken off (≤ 3) |
| 8 | 100 | **recover** | the jaw closes; the puddle cools (`fire1`) |
| 9 | 110 | | the wings fold back up over the shoulders |
| 10 | 120 | | the puddle is `stone1` ash; the hood re-forms |
| 11 | 130 | | (appended end = idle f0) |

Margin: the canopy and the stream must keep ≥ 2 px to the frame edge (Sİ-2). The puddle sits on rows y 97–99.

### 4.6 hit (6 f), hitHeavy (8 f), hitMagic (8 f)
All share: f0 = struck contact frame, **only the struck region moves** (head + chest regions; the talons, tail and far cloak stay idle f0; HA-21 < 50 %, target 30–40 %); f1 = the in-between (`recoil()`, HA-22).

- **hit** `50 70 120 100 90 80`: the skull snaps back up under the hood, eye shut (dark), the ribs knocked in 1 px; a puff of 3 flakes knocked off the near hem (in-frame); the heart **skips** (dims one tone for f0–f1). Then the head peers back down. recover f3 (240 ms).
- **hitHeavy** `60 70 100 110 90 90 80 80`: a harder compression; the hood collapses on the near side (wrist drops 3 px); one talon lifts and steps back (the only frame pair where a foot moves, HA-9), the knees take the load, the step back in. The heart gutters to `fire2`. recover f4. `poseKnockPx [1, 2, 2]`.
- **hitMagic** `50 60 80 80 100 90 80 80`: the spell lights the ember inside it. The heart and ALL rib gaps flare to `fire4` / `white`, the eyes blaze (`eye: 2`), the hem lip runs `fire3` along every plate (an overload, the lava rule's exception kind). The body is rigid and shudders 1 px (the cloak a frame behind), then the light falls back. recover f4.

### 4.7 summon: 14 f, 1.35 s (`land` 1), built bottom-up, `hologram: false`
The art draws the body only below a **build line** (`build` 0 → 1, frame y 99 → 6). Above the line, nothing. On the line there is a 1-px `fire2` ember lip (light, not outlined), with 2–3 ash grains `stone2` just above it.
The cinematic's tornado ribbons cover the line (§5.1). The body is in its true colours for 100 % of the pose (EF-11: no hologram).

| f | ms | Mark | build top | What is complete |
|---|---|---|---|---|
| 0 | 80 | | y 96 | talon tips, tail brazier (lit) |
| 1 | 70 | **land** | y 86 | both talons gripping, the legs; the weight is on the floor |
| 2 | 70 | | y 74 | belly, tail, lower ribs |
| 3 | 90 | | y 60 | the full rib cage; **the heart ignites: LUB-DUB** (`heat` 2.1, white 2×2 for this frame) |
| 4 | 70 | | y 48 | shoulders, wing roots; the wings are shredded ribbons of ash (plates scattered on the line) |
| 5 | 70 | | y 36 | the S-neck; the wrists up |
| 6 | 90 | | full | the skull and crest; the eyes dark |
| 7 | 60 | | | **peak**: the wings BURST open out of the storm (a full span, plates flying); the eyes ignite |
| 8 | 200 | | | the spread held (**the cut-in plays on this frame**: the cinematic holds it) |
| 9 | 90 | | | the wings start to fold |
| 10 | 100 | | | the cloak slams down over the shoulders (**the shock ring beat**, the finale) |
| 11 | 110 | | | shake out: 3 flakes off the hem, the hem lips flare `fire2` |
| 12 | 130 | | | the neck lowers into the S |
| 13 | 120 | | | (appended end = idle f0) |

### 4.8 death: 12 f, 0.86 s (`impact = contact` 0, `dissolve` 5): top-down into a heap
It continues from the lethal reaction (`_v3/posematch.ts`). f0 = hitHeavy f0 lit like hitMagic f0 when the blow is magic (as the magus, HA-24).
Crumble: `crumblePass` (`src/art/rigkit/passes/crumble.ts`) with an **ASH style**: groove `stone0`, chunk = the hide / cloak tones, recess `night0`, lip `stone2`, glow `[fire1, fire2]` in the cracks. The origin is the crest (the top), the front runs DOWN, and the debris falls into ONE heap at the talons (centreX = 52, floorY = 99).

| f | ms | Pose |
|---|---|---|
| 0 | 50 | struck (the lethal contact) |
| 1 | 60 | the reel: the head thrown up, the cloak flared |
| 2 | 60 | the heart flickers `fire4` → `fire2`; the hem lips go out |
| 3 | 70 | the knees buckle, the perch sinks 3 px |
| 4 | 60 | the crest starts to smoke (2 `stone2` curls) |
| 5 | 70 | **dissolve**: the crumble starts at the crest; the skull top caves into ash |
| 6 | 70 | the skull and neck collapse into the chest; the cloak plates slide down the back in sheets |
| 7 | 70 | the cloak gone to the shoulders; the rib cage exposed, **the heart hangs bare in the ribs** (the brightest it has been since the blow) |
| 8 | 80 | the ribs fold; **the heart drops** 6 px into the rising heap |
| 9 | 80 | the heap: a soft cone (lit top `stone2`, mid `stone1`, base `stone0`, ≈ 30 × 14 px), the heart glowing `fire3` through a 2-px gap; the tail still out with its brazier |
| 10 | 90 | the brazier tips over into the heap; the heart dims to `fire2` |
| 11 | 100 | the last frame: the heap, one `fire1` eye of the heart, one smoke curl |

The kit breaks the body from f11 (the heap) as its material (§5.4). Destroy total ≤ 1.4 s scene (pose 0.86 + 2 burst frames + flight ≈ 0.3).

### 4.9 revive: 12 f, 1.19 s (`land` 6), never the summon replayed (HA-28)
Holds `80 90 70 90 90 100 110 90 100 110 120 130`.
- f0: the heap (= death f11).
- f1–f2: the heart beats twice inside the heap (`fire2` → `fire4` → `fire3` → `fire4`).
- f3–f5: `crumblePass` read at 1 − t (the reassemble): the ash flies BACK UP the paths it fell along, bottom-up this time. The closing cracks carry the binding glow `fire2` / `fire3` (the style's `glow`).
- f6 **land**: the talons grip.
- f7–f9: the cloak plates fly in from the floor and lock row by row (hem first, wrist last).
- f10: the first breath (chest up, LUB-DUB).
- f11: settle → idle f0.

### 4.10 points()
- `muzzle`: the mouth, every frame.
- `core`: the heart; it falls on death f8–f11 and rises on revive.
- `head`: the skull centre.
- `claw`: the near talon.
- `feet`: the anchor.
- Default `core`: (55, 60).
- Also export `ASHEN_MOUTH(anim, frame)` like `CRYSTAL_WYRM_MOUTH`, for the strike's frame-exact cone origin.

---

## 5. Cinematic storyboards

Kit APIs used (verified):
- `src/cinematics/strikes-a/_kit.ts`: `Sparks`, `FloorMarks` (`blob`, `flame`, `crack`), `layer`, `animate`, `onFrame`, `overlay`, `currentPixels`, `holdFrame`, `seed`, `RR`.
- `src/view/light`: `lightPool`, `lightFlash`, `lightBeam`; `followLight` from the strikes-a kit.
- `shake` (`src/vfx/core`), `stopTime` (`src/vfx/combat`).
- `src/cinematics/_v3/sound.ts`: `takeCharge`, `start`, `play`, `fade`, `atMark`, `panAt`.
- `strikeStartFrame` (`_v3/clash.ts`), `backlash` (`_v3/clash.ts`), `contactFlash` (`_v3/flash.ts`).
- `u.playToFrame`, `u.playRange`, `u.rangeMs`, `u.markFrame`.
- Everything stays on whole pixels and palette tones (EF-7), the light is stepped (EF-6), there is no camera move (EF-8), no `setScale` / `setAngle` (HA-11), and there is no full-screen wash (EF-4).

### 5.1 Summon (signature entrance, tribute ace): budget 2.5–3.0 s scene → ≤ 4.35 s game
Registered with `signatureSummon('ashen_drake', s => s.base?.() …, { v3: ashenRiseV3 })` inside `if (LOOK_V3)` (`src/cinematics/summon-a/_kit.ts`). The tribute stream before it is the shared `summon-a/tribute.ts` (≈ 0.5 s).
Times are scene ms from the entrance start (the card on the tile):

| ms | Visual | Light / floor | Sound |
|---|---|---|---|
| 0–200 | **Ash mound**: a stepped ellipse mound grows on the tile (`stone1` base, `stone2` flank, `stone3` 1-px lit crest), 0 → 24×9 px; 4 dust puffs (`Sparks` 'puff', `stone2`) slide out on the floor | — (dark; the attribute circle is NOT opened: no generic circle) | `ashenMound` (`fade(['summonCharge'], 160)` first) |
| 200–330 | **A single ember falls** from y −90 above the tile: 1 px `fire4` with a 2-px `fire2` trail, wobbling ±1 px | `followLight` `fire3` r 8, intensity 0.3 | — |
| 330 | it **touches** the mound top: a 3-px `fire4` star, 1 frame | | `ashenEmber` (a single sine ping) |
| 330–450 | **Ring ignition**: two flames chase round the mound's base ellipse (r 28×12) from the back, meeting at the front; ring tones `fire2` → `fire3`, 2 px thick | `lightPool(home, { color: PAL.fire2, spill: PAL.fire1, radius: 30, intensity: 0.6, anim: 'flicker' })` | `ashenKindle` (a small VUF that pans round with the ring) |
| 450 | the pose starts (`S.pose({ hologram: false, ramp: RAMPS.stone, onLand })`); the mound lifts into the **ash tornado** | pool → 0.9 | `start('ashenTornado')` |
| 450–1090 | **The tornado builds it bottom-up**: 10 stacked ellipse ribbons (`stone1` / `stone2` / `stone3`, each 2 px tall), rotating by whole-pixel phase steps, 34 → 44 px wide. The ribbon band always covers the build line ±6 px (above the line, the column; below it, the finished body in true colours). 12 embers orbit in the ribbons (`fire3` / `fire4`, 1 px). The column rises with the line. | floor: ash grains rain off the column's skirt (FloorMarks `blob` `stone1`, life 900) | `land` f1 (≈ 530): `ashenTalon` · f3 (≈ 700): `ashenHeartbeat` 0.9 (**the chest "güm"**) |
| 1090 (f7) | **The wings burst out of the storm**: the column explodes outward into 28 ash plates (2×2 / 2×3 `stone1` / `stone2` with a `fire2` lip, gravity 160, drag 2) + 10 ember sparks; one 2-frame ring (`stone3`) | `lightFlash(fire3, r 36, 260 ms, { ring: true })` | `fade(['ashenTornado'], 90)` · `ashenRoar` is NOT here (the cut-in owns it) |
| 1180 (f8 held) | **The cut-in** (`S.climax()`): the band passes under the tile (EF-10); ash flakes drift through the frame | the pool holds at 0.6 | the cut-in flare plays the CHARACTER `roar` = `ashenRoar` |
| 1180 + 720 = 1900 | the band exits → f9–f10: the cloak slams over the shoulders → **LANDING ASH SHOCK RING**: a low ring of rolling ash (stepped ellipse ring 3 px, `stone3` front / `stone2` / `stone1` tail) runs 0 → 64 px over 380 ms, plus `S.finale({ ring: 92, ramp: RAMPS.stone, freezeMs: 50 })` | **1 s grey dust layer**: a floor overlay of sparse 2×1 `stone1` clumps on the tile + its 4 neighbours, fading out in 3 palette steps (`stone1` → `night2` → gone) by +1000 ms; `lightFlash(fire2, r 30)` under the chest | `ashenLand` (thump + wide brown puff + heartbeat tail), `shake` 3 px (the finale's) |
| 1900–2350 | f11–f13: shake out, settle, idle | the pool fades out over 240 ms | — |

- Entrance ≈ 2.35 s + tribute ≈ 0.55 s ≈ **2.9 s scene → ≈ 3.9 s game** (≤ 4.35).
- Cut-in rhythm (recipe `cutIn.rhythm`): `{ flare: 300, slam: 430, exit: 720 }`, close 120 (default). Heavier and slower than the magus, close to the Titan's slam.
- **Without a cut-in** (a special summon by another card; v3 has no such source today, but keep the path): no hold on f8; the `roar` plays from f7. Its release beat is the "ember spill" (`ashenRoar` at 0.75), then the finale.
- **P2:** every offset is mirrored with `S.dir`; the tornado's rotation direction mirrors too.
- **No "climbing from the floor"** (§5: only R2 and C10): the body is BUILT by the storm, it does not crawl out of the tile.

### 5.2 Attack vs monster (it wins): budget 1.6–2.2 s scene → ≤ 3.19 s game
`registerStrike('ashen_drake', ashStormV3)` inside `if (LOOK_V3)`, in `src/cinematics/strikes-a/ashen_drake.ts`. The strike starts on `strikeStartFrame(u) + 1` (the declaration already showed f1, ≤ 233 ms).

| scene ms | Attacker frame | Visual | Light | Sound |
|---|---|---|---|---|
| 0 | f2 | flakes peel off the opening cloak and stream INTO the rib cage (6–10 `stone2` / `fire2` motes per 100 ms, sucked to `points().core`): it feeds its heart with its own cloak. This is NOT the wyrm's motes into the mouth. | `lightPool(home, fire2 → fire3, r 28, 0.15 → 0.8 over the charge, 'flicker')` | `takeCharge(u, 'ashenInhale')` (continues from the declaration) |
| 0–460 | f2–f5 | the heart heats; at f4 1 px `white` leaks between the teeth | `followLight(mouth, fire3, r 10)` | |
| 460 | f6 release | **the ASH CONE** is born at `muzzle` ON the floor: a rolling bank of grey ash (§5.2.1) | the jaw light fades (140) | `chargeSnd.stop(30)`, `play('ashenExhale')`, `start('ashenRoll', { pan })` |
| 460–880 | f6–f9 (f9 held) | the cone ROLLS to the target: travel = clamp(dist × 2.6, 300, 480) ms; it grows from 10 px tall at the mouth to 28 px at the target; its leading edge leaves a **soot trail** (FloorMarks `blob` `stone0`, rx 3, life 1400) | a dim `fire1` pool travels with the cone's embers (0.2) | |
| 880 | f9 held | **SWALLOW**: the front billow climbs the target. The veil is a LATTICE of billows with 1–2 px gaps every 4 px, so the target's silhouette shows through (EF-2: the signature effect is not shrunk; the "see-through pattern" route). The billows cover ≤ 70 % of its height. | the target tile's light dims: `dimPulse` is NOT used (no screen dim); instead the travelling pool goes out | `fade(['ashenRoll'], 60)` |
| 880–1060 | f9 held | **SILENCE** (180 ms): the veil hangs almost still (billows drift 1 px per 60 ms); the buried embers go DARK one by one (`fire2` → `fire1` → gone, 3 per 34 ms) | the light is all gone (the darkest beat of the strike) | `play('ashenHush')` (a quiet reverse brown swell that ducks the music 0.7: the hall goes quiet) |
| **1060** | f9 → f10 | **IGNITION** = contact: `s.impact(at)` (the number, the reaction, the hit-stop come from here). EVERY ember in the veil turns `fire4` / `white` on the same frame; in 2 frames the billows step from the inside out to `fire2` / `fire3` bands (stepped, no alpha); the target becomes a **black silhouette** (an `overlay(target, pc)` that paints its current opaque pixels `PAL.ink`, ringed by 1–2 px `fire3` / `fire4` flame tongues, regenerated every frame from `currentPixels(target)`) | `lightFlash(at, fire3, r 40, 300, { ring: true, intensity: 1 })` + `lightPool(at, fire3 → fire2, r 30, 1.2, 'flicker')` (stepped) | `play('ashenIgnite')` (the VUF) + the struck body's material (kit) |
| 1060 + hit-stop | | the hit-stop (heavy: 115–130 ms by power) holds the ignition frame; `contactFlash` ≤ 40 % stays on the contact side (EF-3); the silhouette stays | shake from the kit: 3 px (power 2) / 4 (power 3) | |
| +0 … +440 | f10–f13 | **burn-off**: flames lick up for 3 frames, then the veil burns away top-down into falling ash flakes (`stone2` / `stone3` 1–2 px, gravity 120, flutter 12) and cooling embers (`fire4` → `fire2` → `stone1`); the black-silhouette overlay drops after 2 frames (the target's own reaction / death pose shows) | **floor scorch**: FloorMarks `blob` `stone0` rx 14 + 6 `crack`s `[fire2, fire1, stone0]`, life 1400 | `ashenIgnite`'s own crackle tail |
| parallel | | the target's death starts `DEATH_AFTER_CONTACT_MS` (150) after contact (`_v3/budget.ts`) | | |

Total ≈ 0.23 (declaration) + 1.06 + 0.12 (stop) + 0.47 (recover in parallel with the death) ≈ **1.88 s scene → ≈ 2.65 s game** (≤ 3.19).

#### 5.2.1 The ash cone (the strike's own drawing, `ashCone` in `-fx.ts`)
- A list of 7–10 **billows**. Each is a stepped disc with three bands: `stone3` top lip toward the light, `stone2` body, `stone1` underside. It sits on the floor line with ry = 0.55 rx.
- They ROLL: each billow's top lip moves forward 1 px per frame while the billow advances, so it tumbles rather than slides.
- New billows spawn at the muzzle every 40 ms for the first 160 ms, then the bank travels as one, its tail thinning.
- 14 buried embers: 1 px `fire2`, blinking slowly (2 frames on / 3 off).
- Width = the tile's width at the target. The ellipse axes follow the iso floor (2:1).
- No alpha and no ADD blend (EF-7): it is matter, dark and sinister. It is the only breath attack in the game that is DARKER than the floor.

### 5.3 Direct attack: budget ~1.6 s scene → ≤ 2.32 s game
- Same build, with these changes: the cone rolls to the duelist's podium (`s.toGround`, travel 520 ms) and swallows the podium base (the veil 22 px tall). The silence is **120 ms**.
- The ignition is a column of flame up the podium's front (3 frames) and a scorch on the podium floor. Shake 3. LP flow.
- Total ≈ 0.23 + 0.46 + 0.52 + 0.12 + 0.25 ≈ **1.58 s scene → ≈ 2.2 s game**.
- **Risk:** it is tight against 2.32. If it is over, shorten the travel to 440 and the silence to 100.

### 5.4 Blocked (the defender survives in guard, e.g. `shield_titan` DEF 2600)
- The cone cannot swallow a guard: it **piles up against the guard plane**. The billows splay sideways and climb the front face; none pass behind it.
- Silence **120 ms**. Then the ignition happens ONLY on the front face: a wall of flame on the guard plane (3 frames). Half of it rolls back toward the drake (a backwash 30 px long along the attack line, cooling to ash).
- The target is NOT blackened: its guard holds. The kit's guard reaction plays (`reactGuard`, push 0/0/1).
- Sound: `ashenSnuff` (the ash thudding on the wall) at the pile-up, then `ashenIgnite` at 0.6 volume with its low-pass closed (a separate recipe variant is not needed: pass `volume` 0.6 and `pitch` 0.85).

### 5.5 Losing (the attacker is destroyed, e.g. vs `crystal_wyrm` 2800 in attack position) and the tie
- Swallow and silence as normal. Then the fire **does not take**: only 3 embers pop (`ashenSputter`: three weak puffs).
- On that same frame the defender's answer comes back along the attack line (EF-13, `backlash(scene, from, to, ramp)` with the defender's matter ramp) and hits the drake on the contact frame.
- The drake's lethal reaction → its death (§5.6). The fizzled veil sinks to the floor as grey ash in 300 ms.
- **Tie** (`steel_silencer` 2400, both destroyed): the full ignition AND the backlash on the same frame.

### 5.6 Death (attack and defense): ≤ 1.4 s scene → ≤ 2.03 s game. Final material per §5.2: the ash heap.
- **Handler:** `registerCardHook('ashen_drake', 'destroyed', ctx => deathV3(ctx, { fallback: () => ctx.base(), onBurst: ashHeapBurst }))` inside `if (LOOK_V3)` (`src/cinematics/_v3/death.ts`).
  - The kit plays the death pose (§4.8) from the reaction.
  - The accent starts from `dissolve` (accent **`fire`**: ember motes rising off the crumbling body, `fire4` → `fire1`; floor light `fire3` that dims).
  - The kit breaks the body from the last frame as **`stone`** (`deathPreset` from the recipe).
  - Card continuity is the kit's: the card is born on the burst frame and flies to the graveyard.
  - In defense the kit's guard break (`_v3/guardbreak.ts`) opens the cocoon into death f0.
- **What makes the ending ours (`ashHeapBurst(u, at)`, on the burst frame):**
  1. **The heap stays.** A copy of the heap pixels from death f11 (`currentPixels(u)` just before the burst) is kept as a floor layer at `DEPTH.TILE_FX + 6`, with the heart's `fire1` eye. The stone shatter on a 30 × 14 heap is only small chunks slumping (preset speed 0.55, up 5–35), which reads as the heap settling.
  2. **It cools**: the heart eye steps `fire2` → `fire1` → `stone1` over 360 ms (3 steps), and one last smoke curl rises.
  3. **The wind takes it**: from +420 ms a gust (direction: away from the owner's side, P1 → +x, P2 → −x) strips the heap from the top in rows. Each row becomes 1–2 px `stone2` / `stone1` particles (`Sparks` 'px', vx 60–110, vy −10…−30, drag 1.2, life 500–800, stepped blink-out). The heap is gone by +1000 ms.
  4. A faint grey stain on the tile (FloorMarks `blob` `stone0`, life 1200) fades last.
- The debris finish on their own: the handler still resolves when the card lands (the kit's rule).
- **Death in attack** (the strike's loser, the kill scenarios): the death pose continues from hitMagic / hitHeavy f0 as planned (`takePlannedEntry`).
- **Death by spell** (Yıldırım Hükmü): same handler (`sourceOwnsDeath` → `ctx.base()` only when the source animates the death itself).
- **Sound** (CHARACTER roles through the kit): `deathStart` `ashenCrackle` (f1), `dissolve` `ashenCrumble` (f5), `afterDissolve [[3, 'ashenCoreDrop', 0.9]]` (f8, the heart drops), `burst` `ashenCool` (the hiss + the gust).

### 5.7 Signature moments (vanilla ace: the rebirth is dropped)
The owner dropped the rebirth rule (Sahip kararları #2), so the R1 "Küllerinden doğuş" moment does not exist. The proposal replaces it with three moments that need no rule:
1. **The delayed ignition** (attack, §5.2): the card's identity beat. The silence before the VUF is the thing players will remember. It is never shortened below 100 ms, at any outcome.
2. **"Kor Dökülmesi" (the ember spill + mantle, roar §4.5)**: plays on the position change to attack (generic `summon-b/position.ts`), the summon without a cut-in, and the duel-end win. Its sound is `ashenRoar` with the heartbeat at the start.
3. **The double heartbeat** as a leitmotif: the summon's chest "güm", the roar's start, the revive's first breath, the ignition's tail (§6). No other card has a double low beat (§5.1), so it brands every big moment of this card.

No `effect` hook and no `special` anim: the card has no engine effect to tie them to (an `effect` with no event would be dead code).

### 5.8 Revive (Ruh Çağrısı / `soul_recall`): budget ≤ 2.1 s scene
- Generic v3 revive on the `revive` pose (§4.9). The `soul_recall` v3 handler plays it; nothing is registered here.
- Sounds through the CHARACTER roles: `reviveGather` `ashenReviveGather` (sustained, stopped on `land`) and `reviveLand` `ashenReviveBeat` (the heartbeat ×2, bigger).
- Verify in `kaAdRevive` that the pose and sounds play (the A3 bridge uses `soundsOf`).

### 5.9 Flip and position
- **Flip** (a tribute-set drake flipped): phase 1 = the recipe's default flip (`flip: { accent: 'dust', ramp: 'stone' }`, the stone/ash family, §5.2-safe). Phase 2 (optional, after the critique rounds): its own flip, where the card turns, the cloak unfolds out of guard f0 (`fromGuard`) and 6 ash flakes peel off.
- **Position change:** generic (`summon-b/position.ts`, roar peak capped at 900 ms). The roar's release (f4, 460 ms) is the beat.

### 5.10 EF checklist (for the critic)

| Rule | What to check |
|---|---|
| EF-2 | the veil is a lattice and the silhouette reads through it |
| EF-3 | `contactFlash` ≤ 40 %; the black-silhouette overlay is a reaction tint of the TARGET's own pixels for ≤ 2 frames + hit-stop (state it in the critique). It is not a flash. |
| EF-4 | white ≤ 1.5 % of the screen: only ember pixels are white, on one frame |
| EF-6 | every light is a stepped pool or flash, no halo |
| EF-8 | no `ctx.focus` (the old wyrm path had one) |
| EF-11 | no hologram in the summon |
| EF-12 | the death continues the reaction; the card is born on the burst frame |
| EF-13 | the losing ranged attacker is answered along its line |

---

## 6. SFX design (`src/audio/v3/ashen.ts`, built only from `src/audio/v3/kit.ts` blocks + Voice primitives)

### 6.1 Identity (the §5.1 row)
**R1 Kül Ejderi:** main pitch / colour = **50 Hz double ember heartbeat** (lub 62 → 46 Hz, DUB 170 ms later 56 → 42 Hz). Signature material = ash + ember. Distinguishing layer = **the delayed ignition "VUF"**: a sucked-in brown swell, a gap, then a low-pass that slams open.
Palette: no glass, no saw drones, no FM metal. Brown and pink noise, low sine thumps, a hollow two-tube rib-cage resonance (160 / 320 Hz band-passes) and dry ember crackle (`crack` at 1.5–4 kHz).
Target A-weighted centre (median) ≈ 900–1300 Hz (the wyrm is 1758, the magus 764), energy < 600 Hz ≈ 0.6.

### 6.2 Recipes

| Name | Role / when | Recipe (kit blocks) | duck |
|---|---|---|---|
| `ashenHeartbeat` | summon f3, roar f0 (via the cinematic), layered into roar / land / reviveBeat | `thump(v, 0, 62, 46, 0.55, 0.16, { drive: 1.5 })`; `puff(v, 0.002, 0.12, 0.12, 220, { kind: 'brown' })`; `thump(v, 0.17, 56, 42, 0.4, 0.2, { drive: 1.2 })`; `puff(v, 0.172, 0.09, 0.14, 200, { kind: 'brown' })`; `crack(v, 0.24, 0.05, { hp: 2200, lp: 6000, n: 2, gap: 0.03, dec: 0.004 })` (an ember tick after the DUB) | 0.3 |
| `ashenMound` | `arrive` | `puff(v, 0, 0.3, 0.4, 600, { kind: 'brown' })`; a sand trickle `crack(v, 0.03, 0.06, { hp: 3000, lp: 7000, n: 10, gap: 0.03, dec: 0.004 })`; `sweep(v, 0, 0.35, [900, 600, 300], 0.04, { kind: 'pink' })` | 0.2 |
| `ashenEmber` | the ember touches the mound | `v.tone('sine', 2200, { g: perc(0.06, 0.12, 0.0005) })` + `v.tone('sine', 3300, { g: perc(0.02, 0.06, 0.0005) })` + `crack(v, 0, 0.08, { hp: 5000, dec: 0.003 })` (a pure tick, NOT bar modes) | 0 |
| `ashenKindle` | the ring ignition | `sweep(v, 0, 0.14, [500, 2400, 1200], 0.12, { kind: 'pink', pan: [-0.5, 0.5], peakAt: 0.3 })`; `puff(v, 0.02, 0.2, 0.3, 1800, { kind: 'brown' })`; `crack(v, 0.05, 0.08, { hp: 1800, n: 4, gap: 0.04, dec: 0.006 })` | 0.25 |
| `ashenTornado` (sustained) | the build, `start` / `stop` on f7 | two rising sweeps `sweep(v, 0, 0.75, [200, 900, 1600], 0.14, { kind: 'pink', q: 2, pan: [-0.4, 0.4] })` and `[250, 1100, 1800]` panned the other way; a brown rumble `v.noise('brown', …)` through a 160 Hz low-pass with `v.wander` on the gain; grains: `crack` n 24, gap 0.03, hp 3500, rising level ("taneli brown", R1) | 0.4 |
| `ashenTalon` | `land` (f1) | `thump(v, 0, 110, 50, 0.4, 0.3, { drive: 1.5 })`; talon scrape `crack(v, 0, 0.12, { hp: 2500, lp: 5000, n: 3, gap: 0.012, dec: 0.01 })`; `puff(v, 0.005, 0.2, 0.3, 900, { kind: 'brown' })` | 0.3 |
| `ashenRoar` | `roar` (the cut-in flare, the roar release) | `growl(v, 0, { d: 1.6, f: [46, 74, 64, 52, 36], formants: [260, 540, 1350], g: 0.9, grit: 6.5, rasp: 55 })`: lower formants and a faster, rougher rasp than the wyrm's (330 / 760 / 1950, rasp 34). **Hollow ribs:** `sweep(v, 0.05, 1.4, [150, 200, 150], 0.12, { kind: 'pink', q: 8 })` + `[300, 400, 300]` q 9, 0.06. The heartbeat layered at 0 (0.7). **Tail:** an ember crackle `crack(v, 0.9, 0.12, { hp: 1500, lp: 6000, n: 6, gap: 0.08, dec: 0.01 })` + an ash hiss `v.noise('pink')` high-passed at 3 kHz fading over 0.8 s. **No glassRain, no bar partials.** | 0.65 |
| `ashenLand` | the shock ring (finale) | `thump(v, 0, 70, 30, 0.8, 0.6, { drive: 3 })`; `puff(v, 0.004, 0.5, 0.9, 1200, { kind: 'brown' })`; dust settling `sweep(v, 0.05, 1.0, [1200, 600, 300], 0.08, { kind: 'pink' })`; the heartbeat at 0.25 (0.6) | 0.6 |
| `ashenInhale` (sustained) | `charge` (declaration → release) | reversed pink `sweep(v, 0, 0.55, [600, 1600, 2800], 0.12, { kind: 'pink', peakAt: 0.9 })`; rib rattle `v.flutter(22, …)` on a 900 Hz band-pass; two quickening small thumps (48 Hz) at 0.3 and 0.42 (the heart speeds up) | 0.3 |
| `ashenExhale` | `release` | `puff(v, 0, 0.45, 0.35, 2500, { kind: 'pink' })`; `thump(v, 0, 80, 40, 0.4, 0.25)`; `crack(v, 0.01, 0.06, { hp: 2500, n: 3, gap: 0.02 })` | 0.35 |
| `ashenRoll` (sustained) | the cone travels | the R1 "kül üfleme": `sweep(v, 0, 1.2, [800, 1800, 2500], 0.12, { kind: 'pink', q: 1.1, peakAt: 0.6, pan })`; the rolling growl: brown noise through a 180 Hz low-pass with an amplitude wander at 6–9 Hz (the tumbling); sparse ember ticks `crack` n 8 | 0.3 |
| `ashenHush` | the silence | a reversed brown swell `v.noise('brown', { g: [[0, 0.0001], [0.16, 0.04, 'e'], [0.18, 0.0001, 'e']] })` through a 120 Hz low-pass: felt, barely heard. **Its job is the duck.** | **0.7** |
| `ashenIgnite` | `impact` (the VUF) | (1) the suck: `sweep(v, 0, 0.07, [180, 600, 1400], 0.05, { kind: 'brown', peakAt: 0.95 })`. (2) at 0.07 **the whomp**: `thump(v, 0.07, 90, 34, 0.7, 0.45, { drive: 2.5 })` + `puff(v, 0.07, 0.6, 0.5, 2600, { kind: 'brown', att: 0.002 })` + the low-pass slam `sweep(v, 0.07, 0.9, [400, 3200, 900], 0.22, { kind: 'pink', q: 0.9, peakAt: 0.06 })` + a heavy crack `crack(v, 0.072, 0.5, { hp: 900, lp: 5000, n: 3, gap: 0.009, dec: 0.02 })`. (3) the fire bed: brown noise on a 300 Hz band-pass decaying 1.0 s. (4) a sizzle: `crack(v, 0.2, 0.12, { hp: 2500, n: 8, gap: 0.06 })`. (5) the heartbeat at 0.5 (0.5): the drake's own chest answers. | **0.8** |
| `ashenSputter` | the losing ignition | three weak `puff`s (brown, lp 1400, 0.12) at 0 / 0.09 / 0.2 + `crack` n 3 + a falling `sweep [900, 400, 200]` | 0.3 |
| `ashenSnuff` | the blocked pile-up | `puff(v, 0, 0.35, 0.3, 900, { kind: 'brown' })`; a muffled `sweep [300, 900, 300]` q 2, 0.12 | 0.3 |
| `ashenCrackle` | `deathStart` | `crack(v, 0, 0.2, { hp: 1800, lp: 6000, n: 6, gap: 0.03, dec: 0.008 })`; `thump(v, 0, 70, 40, 0.25, 0.2)` | 0.3 |
| `ashenCrumble` | `dissolve` | a descending trickle `sweep(v, 0, 0.6, [3000, 1800, 700], 0.1, { kind: 'pink' })`; grains `crack` n 20, hp 3500, dec 0.004, gap 0.025; `puff(v, 0.1, 0.25, 0.5, 700, { kind: 'brown' })` | 0.35 |
| `ashenCoreDrop` | `afterDissolve +3` | a muffled `thump(v, 0, 120, 60, 0.35, 0.2)` under a 600 Hz low-pass; a hiss start (`v.noise('white')` hp 4000, 0.4 s) | 0.3 |
| `ashenCool` | `burst` | the cooling hiss: `v.noise('white', { g: [[0, 0], [0.05, 0.06], [1.0, 0.0001, 'e']] })` hp 5000; the gust: `sweep(v, 0.25, 0.8, [400, 1400, 500], 0.14, { kind: 'pink', pan: [-0.4, 0.6] })`; the last 3 crackles | 0.3 |
| `ashenReviveGather` (sustained) | `reviveGather` | the reverse of the crumble: a rising `sweep [300, 1200, 2400]` 0.9 s pink + accelerating grains (`crack` with the density front-loaded at the end) + the heart inside the heap (2 soft beats at 0.15 / 0.32) | 0.4 |
| `ashenReviveBeat` | `reviveLand` | the heartbeat ×2 at 1.4× level + `ashenKindle`'s puff | 0.5 |

- Export `V3_ASHEN_RECIPES`, `type AshenSfxName = keyof typeof V3_ASHEN_RECIPES`, and `ASHEN_SUSTAINED = ['ashenTornado', 'ashenInhale', 'ashenRoll', 'ashenReviveGather']`.
- Levels: the big beats (`ashenIgnite`, `ashenRoar`, `ashenLand`) must still peak ≤ −1 dBFS after `V3_CEILING` (SE-6).

### 6.3 Distinctness (SE-4) against every §5.1 identity and the aces

| Neighbour | Risk | Why it stays apart |
|---|---|---|
| `stone_sentinel` (voice 'rumble', key 31 = G1 ≈ 49 Hz) | the same low register | Its rumble is unpitched brown noise with gravel. Ours is a PITCHED, enveloped double thump with silence between the beats. Measure the LSD on `land` / `burst` / `dissolve`. If it is < 15 dB, move the heartbeat to 54 / 48 Hz and raise the rib-tube band. |
| `abyss_magus` (D1 36.7 Hz saw drone) | dark, low | We use no saw and no drone. All our low energy is percussive. |
| `crystal_wyrm` | dragon roar | Our formants are 260 / 540 / 1350 vs 330 / 760 / 1950. Our rasp is 55 vs 34. There is no glass tail; our tail is ember crackle + hiss. |
| `magma_titan` (old v1 sfx `earthQuake` / `impactHeavy`) | fire + weight | We never use `earthQuake`; the VUF's suck-gap-slam envelope is unique. |
| `ember_wolf` (v1 fire crackle) | crackle | Ours is sparse dry ticks, never a continuous fire bed except the 1 s after the ignition. |
| C3 `cloud_hatchling` (lane-mate) | the "wind ring" whistle | We use no tonal whistle; the gust in `ashenCool` is broadband pink. |
| C5 Akıncılar 70 Hz motor, C7 90 Hz gravel, C10 600 Hz suction, C12–C15 110 Hz beating | — | none of their layers are used |
| R2 `glassReverse` | — | **never used** (R2's sole identity) |
| R3 the only "pof" | — | `ashenSnuff` / `ashenMound` are brown low-pass thuds, not the cushion "pof" (soft 300 Hz formant): keep them < 900 Hz and attackless |

### 6.4 Registration (additive)
- `src/audio/sounds.ts`: `import { V3_ASHEN_RECIPES } from './v3/ashen';` and `...V3_ASHEN_RECIPES, // Kül Ejderi (./v3/ashen.ts)` next to the `...V3_DAWN_RECIPES` line (1092).
- `src/audio/sfx.ts`: `import type { AshenSfxName } from './v3/ashen';` and `| AshenSfxName` in the `SfxName` union (next to `| DawnSfxName`).
- `src/cinematics/_v3/sound.ts` `CHARACTER_SOUNDS`, one entry after `abyss_magus`:
  ```ts
  ashen_drake: { roar: 'ashenRoar', arrive: 'ashenMound', land: 'ashenTalon', charge: 'ashenInhale', release: 'ashenExhale', impact: 'ashenIgnite', deathStart: 'ashenCrackle', dissolve: 'ashenCrumble', afterDissolve: [[3, 'ashenCoreDrop', 0.9]], burst: 'ashenCool', reviveGather: 'ashenReviveGather', reviveLand: 'ashenReviveBeat' },
  ```
  The recipe's `voice: { custom: 'ashen_drake' }` reads it through `soundsOf`. `tests/presentation/recipes.test.ts` checks that the entry exists.

### 6.5 The struck body (SE-5)
- **Phase 1:** `body: { physical: 'ash' }` with `ash.sound = { same: 'stone' }`. A blow on the drake plays `hitStone*`. That is the stone/ash family, sanctioned by §5.2 as shared by this card and the sentinel.
- **Phase 2 (needs the orchestrator):** an own ash hit (rumble f 52, grit 1.8, surf 1200 Hz, sizzle 2600) means adding `'ash'` to `GENERATED_HIT_MATERIALS` in `src/audio/v3/materials.ts`. `tests/art/materials.test.ts:324-325` pins that list to `['stone']`, so that test file must be updated in the same change. That is a shared-test edit: ask first (§10 Q2).

---

## 7. Card art and cut-in

### 7.1 Card art (`src/art/cardart-v3/ashen_drake.ts`, `CardArtV3`; `docs/v3/KART_RESIMLERI.md`)
- **Subject (R1):** the drake perched on an ash heap at the cliff edge, ash streams blowing from the cloak, the ember chest, a dark violet sky.
- **Backdrop:** the KARANLIK recipe `paintBackdrop(p, 'DARK', { focus })`: `night0` / `void0` sky, `ink` floor + `void1` horizon, the eclipse crown `void1` / `void2` / `void3` with a `night0` centre. Use `{ pool: true }` for a `fire1` stepped pool under the heap.
- **big 88×68:** the sprite's idle f0 pixels at 1:1 (§5 "the v3 monster's frame pixels").
  - Crop: the hood, the skull, the rib cage and the talon tops; the heap is a new stepped `stone1` / `stone2` mound under it.
  - The subject fills 60–75 % of the visible area, with the head in the right third (facing right, ≥ 4 px of air ahead).
  - The eclipse crown sits 4 px behind the hood peak, so the hood's inverted U is read against the crown.
  - Ash streams: 3 flat 2-px ribbons of `stone1` / `stone2` from the hem trailing left (behind, so the space ahead stays clear).
  - The arena rim `void2` stays (it IS the card light's rim colour `void3` → recolour with `recolor` to `void3`).
  - **The brightest point** = the heart (`fire4` + one `gold4`) at ≈ (46, 34), inside the focus box.
- **small 44×34:** a tighter 1:1 crop of the same frame: the skull, the hood edge and the heart only. Heart ≈ (22, 19), eye ≈ (33, 12); 2 px of air above the hood. Hand-check at ×6; fix stray pixels with `patch`. Never `autoSmall`.
- **Living frames:** 2 (`frames: 2`, `holdMs` ≈ [700, 300]). Frame 1 = the heart one step brighter (the beat). Only a palette step; no motion (§10 "yalnız palet döngüsü").
- **Wire it:** `src/art/cardface-v3/index.ts` `ART`, one line next to the others:
  ```ts
  ashen_drake: (p) => { p.blit(renderArt(ashenDrake, 0).smallPx, 0, 0); },
  ```
  plus `import ashenDrake from '../cardart-v3/ashen_drake';`. `hasV3Art` then requires the v3 sprite to be registered: it is.
- Acceptance (§10 of KART_RESIMLERI): off-palette 0, isolated ≤ 10 %, checker ≤ 0.5 %, ≤ 20 tones (backdrop ≤ 6), outline ≥ 90 % ink, the focus inside the box.

### 7.2 Cut-in portrait (`src/art/cutins-v3/ashen_drake.ts`, `CutinFactory`, 200×144, `p2: 'relight'`)
- **Concept "Başlık" (the hood):**
  - The near cloak's wrist and hood fill the upper-left two thirds as a dark shingled mass. The plates are drawn at the cut-in's density: 6–8 px plates, two tones each, ember-eaten lower edges `fire1` / `fire2`.
  - The skull emerges from under the hood toward the right and down, the crest of smoke spines streaming back (`stone1` → `void1`, `void2` tips).
  - Below the jaw, the rib cage with the heart.
  - One key light from the top-left, flat planes, 1-px ink outline, `void2` rim on the shadow side. It is painted natively, not upscaled.
- **Frames and holds** (played once, the last held; `holds` must sum to ≤ 900):

| f | hold | Pose |
|---|---|---|
| 0 | 180 | the stare: the head deep in the hood's shadow, the eye a dull `fire1`; one ash flake leaving the hem |
| 1 | 120 | the eye ignites (`fire4`); the heart beats (LUB) |
| 2 | 120 | **flare (≈ 300 ms)**: the hood lifts, the jaw cracks open, the throat glows `fire3`; DUB |
| 3 | 140 | **slam (≈ 420)**: the jaw wide, the ember spill pours over the lower teeth (`fire3` / `fire4` stream); the eye `white` core |
| 4 | 340 | held (the band closes on it): the spill drips, flakes lift off the hood |

- `accent: PAL.fire3`, `accentDark: PAL.fire1` (the runtime speed lines and burst: ember on violet).
- The lens glint (`cutin.ts` picks the brightest isolated pixel of f0's head region) must be the eye. Keep the heart OUT of f0's head region, or make the f0 eye the only `fire4`.
- The P2 set is relit by `o.lightFrom` (the ember and the eye are identical).
- Preview: `?dev=cutin&id=ashen_drake&look=v3` and `&player=2`.

---

## 8. Integration plan (exact registration points; v1 stays byte-identical)

### 8.1 Why v1 is safe
- `ashen_drake` has no v1 art (`MONSTER_IDS` index ≥ 12 → `placeholderTotem`, `src/art/monsters/index.ts`).
- The v3 art is read only under `LOOK_V3` (`monsterArt`). The recipe is read only through `v3Recipe` (`LOOK_V3` + v3 art).
- Cut-ins-v3 register only under `LOOK_V3` (`src/art/cutins/index.ts:577`). The card face changes only under `V3_CARDS`.
- **Every cinematic registration must sit inside `if (LOOK_V3) { … }`.** Do not register a v1 path; v1 keeps the defaults it has today. Prove it with filmdiff (§9).

### 8.2 The recipe: `src/presentation/cards/ashen_drake.ts` (new, auto-discovered)
```ts
import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';
export default {
  id: 'ashen_drake',
  tier: 'ace',
  body: { physical: 'ash' },
  attack: { type: 'beam', blow: 'magic', from: 'muzzle', vfx: 'ashCone', tone: PAL.fire3, ranged: true, blocked: 'splash' },
  summon: { style: 'vortex', matter: 'stone', roarPeak: 4 },
  death: { material: 'stone', accent: 'fire' },
  flip: { accent: 'dust', ramp: 'stone' },
  voice: { custom: 'ashen_drake' },
  light: {
    glow: { emissive: [[PAL.fire4, 1], [PAL.gold4, 1], [PAL.fire3, 0.75], [PAL.fire2, 0.3]], halo: 0.55, pool: 0.8, spill: PAL.void2 },
    strike: PAL.fire3,
  },
  cutIn: { rhythm: { flare: 300, slam: 430, exit: 720 } },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
```
- The recipe replaces the bridged table values in the v3 look: `DEATH_PRESETS` (`deathPreset`), `MONSTER_GLOW` (`monsterGlow`), `STRIKE_KIND` (`blowKindOf`), `materialOf`, `soundsOf`, `cutInRhythm`, the battle kit's ranged / roar peak.
- **No edit to `src/cinematics/_v3/presets.ts` or `src/view/light/profiles.ts` is needed.** Their v1 rows (`ashen_drake: { material: 'shadow', accent: 'fire' }`, the violet glow) stay as v1 data, untouched.
- `custom.flip` is unset → `recipe/install.ts` registers the default flip (priority 10) in v3 only. Position and revive are generic.

### 8.3 Cinematic hooks (all inside `if (LOOK_V3)`)

| File | Call | Event |
|---|---|---|
| `src/cinematics/strikes-a/ashen_drake.ts` | `registerStrike('ashen_drake', ashStormV3, { name: 'strikes-a:ashen_drake' })` | the battle strike motion (all outcomes via `s.blocked`, `s.direct`, `s.ctx.ev.result`) |
| same | `registerCardHook('ashen_drake', 'destroyed', ashenDeathV3, { name: 'strikes-a:ashen_drake:death' })` → `deathV3(ctx, { fallback, onBurst: ashHeapBurst })` (return `ctx.base()` for non-monster / `sourceOwnsDeath`) | `destroy` |
| `src/cinematics/summon-a/ashen_drake.ts` | `signatureSummon('ashen_drake', (S) => S.ctx.base(), { v3: ashenRiseV3 })`. The v1 `entrance` is never reached because the call is inside `if (LOOK_V3)`; still give it a safe body. | `summon` (normal / tribute / special; `from: 'field'` → base) |

Priorities: 0 (the recipe layer registers nothing for custom parts). The loader imports every `src/cinematics/**/*.ts` in path order (`src/cinematics/index.ts`).

### 8.4 Other one-line edits
- `src/audio/sounds.ts` + `src/audio/sfx.ts` (§6.4).
- `src/cinematics/_v3/sound.ts` `CHARACTER_SOUNDS.ashen_drake` (§6.4).
- `src/art/cardface-v3/index.ts` `ART.ashen_drake` (§7.1).
- `src/art/materials/defs/ash.ts`: a new file (auto-discovered by `src/art/materials/index.ts`).
- Nothing in `src/data/cards.ts` (the rules are final; `effect: 'none'`).
- Optional, after acceptance: the flavour `'Kül yağmurunun içinden doğan kara ejder. Nefesi gökyüzünü karartır.'` still fits; no change is required.

### 8.5 Scenarios: `src/duel/scenarios/kart_a_ashen_drake.ts` (new)
Auto-discovered by `src/duel/scenarios.ts:252` (`import.meta.glob('./scenarios/*.ts')`). Use the `Scenario` / `Step` shapes of `mart_ashen_drake.ts`.

| Key | Stage / steps | Films |
|---|---|---|
| `kaAdSummon` / `kaAdSummonP2` | hand `ashen_drake`, two monsters; tribute summon (P1 / P2) | the full entrance + cut-in |
| `kaAdAtk` / `kaAdAtkP2` | battle; vs `magma_titan` (2100) in attack position | swallow → silence → ignition → kill |
| `kaAdAtkWeak` | vs `storm_hawk` (1000) in attack position | power 3 (heavy hit-stop 130, shake 4) |
| `kaAdDirect` / `kaAdDirectP2` | the opponent has no monster; `attack(0, null)` | the direct attack |
| `kaAdBlocked` | vs `shield_titan` in DEFENSE (2600) | the pile-up, the wall ignition, the LP loss |
| `kaAdDefWin` | vs `tide_golem` in defense (2000 < 2400) | the destroy in defense (guard break of the TARGET) |
| `kaAdLose` / `kaAdLoseP2` | vs `crystal_wyrm` (2800) in attack position | the sputter, the backlash, the drake's death in attack |
| `kaAdTie` | vs `steel_silencer` (2400) | the ignition + the backlash, both die |
| `kaAdHit` | the drake in DEFENSE (DEF 2000), attacked by `volt_lizard` (1500) | its guard reaction (cocoon holds) |
| `kaAdKill` / `kaAdKillP2` | the drake in attack position, attacked by `crystal_wyrm` (2800) | hitMagic → death → the ash heap (the magic blow path) |
| `kaAdKillPhys` | the drake in attack position, attacked by `polar_sovereign` (3000) | hitHeavy → death (the physical blow path) |
| `kaAdGuardKill` | the drake in DEFENSE, attacked by `crystal_wyrm` | death from the cocoon (guard break) |
| `kaAdBolt` | `judgment_bolt` destroys the drake (copy the activate step shape from `src/duel/scenarios.ts` ~l.230) | the spell death |
| `kaAdRevive` | drake in the graveyard; `soul_recall` (step as `scenarios.ts` l.237) | the revive pose + sounds |
| `kaAdPos` | the drake in defense; `{ type: 'changePosition', player: 0, zone: 0 }` | fromGuard + the ember-spill roar |
| `kaAdFlip` | a face-down drake (`faceUp: false`); `flipSummon` | the recipe flip |

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
node tools/shot.mjs "?dev=monster&id=ashen_drake&look=v3&mode=board" --out $O/board.png     # 1x read on the floor
node tools/shot.mjs "?dev=monster&id=ashen_drake&look=v3&mode=live&scale=3" --out $O/live.png
```

Thresholds (all must pass, P1 and P2):
- **Sİ-2:** margin ≥ 2 px, 0 edge pixels on every frame.
- **Motion:** HA-14 out ≤ 1.2 (target 0); HA-15 in ≤ 2.0; HA-16 seam ≤ 1.4; HA-17 ≤ 1.8; HA-18 ≥ 15 %; HA-19 0.3–0.8.
- **HA-20:** toGuard / fromGuard ≤ 400 ms.
- **HA-21:** < 50 % (sheet and every idle phase).
- **IŞ-10 noise:** idle mean ≤ 10 %, body frames ≤ 15 %, effect frames ≤ 20 %. Watch the flakes and the summon / death grains.
- **HA-9:** the lowest 6 rows are fixed in idle / guard / toGuard / fromGuard.
- **HA-1:** marks present. **HA-25:** the muzzle on every frame.
- **IŞ-1:** litBias > 0 on both views.
- **KK-13:** ≤ 140 frames, ≤ 8 ms / frame, ≤ 7 MB per side.
- **Colours:** ≤ 20 per frame; exactly 1 `gold4` pixel in idle / guard / hit frames (a grep on the JSON colours, or a test).

**KK-1 reference frame gate:** draw idle f0 first. Render it next to `crystal_wyrm` and `magma_titan` idle f0 at ×3 and ×1 on the board. A critic approves BEFORE any anim is drawn. Record the IoU against both; it must be low (distinct silhouettes).

### 9.2 Films (every moment, P1 and P2; LOOK at every PNG)
```sh
for s in kaAdSummon kaAdSummonP2; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 24 --every 160 --start 300 --cols 6 --out $O/$s.png; done
for s in kaAdAtk kaAdAtkP2 kaAdAtkWeak kaAdDirect kaAdDirectP2 kaAdBlocked kaAdDefWin kaAdLose kaAdLoseP2 kaAdTie; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 20 --every 100 --start 200 --cols 5 --out $O/$s.png; done
for s in kaAdHit kaAdKill kaAdKillP2 kaAdKillPhys kaAdGuardKill kaAdBolt kaAdRevive kaAdPos kaAdFlip; do node tools/shot.mjs "?dev=duel&s=$s&look=v3" --fresh --film 16 --every 100 --start 200 --cols 4 --out $O/$s.png; done
# the signature beat frame by frame at 3x (swallow → silence → ignition), clip around the target tile:
node tools/shot.mjs "?dev=duel&s=kaAdAtk&look=v3" --fresh --film 24 --every 17 --start 1150 --clip 300,90,220,150 --scale 3 --cols 6 --out $O/ignite-x3.png
node tools/shot.mjs "?dev=duel&s=kaAdKill&look=v3" --fresh --film 60 --every 17 --frames $O/killframes --out $O/kill-all.png
node tools/shot.mjs "?dev=cutin&id=ashen_drake&look=v3" --scale 2 --out $O/cutin.png
node tools/shot.mjs "?dev=cutin&id=ashen_drake&look=v3&player=2" --scale 2 --out $O/cutin-p2.png
```
- Find the exact ignition time with `measure` first (`contactMs`) and set `--start` to it minus ~250.
- Card art: the KART_RESIMLERI §9 render script (path in that doc) with `--painter src/art/cardart-v3/ashen_drake.ts --frames`, plus `?dev=cards3` for the face in hand and in the 2× panel.

### 9.3 Timing, palette, white, sound, camera
```sh
node tools/measure.mjs --scenarios 'kaAd*' --look v3 --jobs 2 --out $O/measure-v3.json
node tools/contact-probe.mjs --scenarios kaAdHit,kaAdKill,kaAdKillPhys --png $O/probe
node tools/shot.mjs "?dev=duel&s=kaAdAtk&look=v3" --fresh --film 120 --every 17 --frames $O/atkframes --out $O/atk-all.png
node tools/palcheck.mjs $O/atkframes --clip 120,40,400,230          # also killframes, summon frames
node tools/clip.mjs "?dev=duel&s=kaAdAtk&look=v3" --music off --marker ashenIgnite --out $O/clips/kaAdAtk.mp4
node tools/clip.mjs "?dev=duel&s=kaAdSummon&look=v3" --out $O/clips/kaAdSummon.mp4      # with music (ducking)
node tools/clip.mjs "?dev=duel&s=kaAdKill&look=v3" --music off --out $O/clips/kaAdKill.mp4
node tools/measure.mjs --scenarios 'kaAd*' --look v3 --jobs 2 --norender --out $O/cam-now.json && node tools/measure.mjs --camera-gate <base.json> $O/cam-now.json
```

Thresholds (game ms at 1×, from the action to input return):

| Moment | Limit | Target |
|---|---|---|
| summon (tribute ace) | ≤ 4350 | ≈ 3900 |
| attack vs monster | ≤ 3190 | ≈ 2650 |
| direct | ≤ 2320 | ≈ 2200 |
| declaration | ≤ 435 | |
| destroy | ≤ 2030 | |
| revive | ≤ 3050 | |
| position | ≤ 580 (roar cap as the generic) | |
| cut-in | ≤ 900 (scene) | |
| LP flow | ≤ 400 | |

- The number appears at contact ±17 ms. The contact is the ignition, not the swallow.
- `palcheck`: off-palette Δ ≤ 1 point vs frame 0; white ≤ 1.5 %; no row > 60 % white; no new bands.
- Clips: true peak ≤ −1 dBFS, 0 clipped samples. The `--marker ashenIgnite` box sits on the ignition frame (≤ 1 frame, SE-1, also at `&speed=3`).
- SE-4: an offline 1/3-octave LSD of every role vs `crystal_wyrm`, `abyss_magus`, the `stone_sentinel` voice and the lane-mates' roles. Median ≥ 15 dB, min ≥ 10 dB.
- The camera gate passes; `zoom.max` = 1.

### 9.4 Repo gates (before every push)
```sh
npm run typecheck && npm test        # known failures only: dusk_ashen, hourglass_imp, shield_titan (+ lane D's scrap_raiders G1)
node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films          # 17/17 IDENTICAL
node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films     # 26/26 IDENTICAL
grep -n "setScale\|setAngle" src/cinematics/strikes-a/ashen_drake*.ts src/cinematics/summon-a/ashen_drake.ts   # must be empty
```

Rewrite `tests/art/ashen_drake.test.ts` (it is this card's file). Checks:
- All 13 anims exist with holds and the marks of §4 (attack: charge 1, release 6, contact 9, recover 10; death: dissolve 5; summon / revive: land).
- `validateArt(art, { tier: 'ace' })` is clean.
- Drawing is deterministic.
- P2 keeps the silhouette.
- **The vulture shape** (replaces the quadruped test): idle f0 w/h between 0.75 and 1.05; opaque 2900–3500; the topmost opaque row lies at x < the skull's x (the hood rises behind the head); the skull's lowest row is below the hood peak by ≥ 30 px.
- The talons are fixed (HA-9 rows).
- Every frame keeps its margin.
- Exactly one `gold4` in idle f0.
- The card art (both sizes) and the cut-in (both lights) are within budget.

`tests/presentation/recipes.test.ts` covers the recipe automatically.
Sameness: `npx vite-node tools/sameness.ts --look v3 --ids ashen_drake,crystal_wyrm,venom_drake,magma_titan` (report only; different plans). Plus a blind silhouette test by a critic.

### 9.5 Critique rounds (≥ 3, independent critics)
- **Round 1:** the idle f0 reference + idle / guard sheets. Silhouette, materials, the brightest point.
- **Round 2:** all sheets ×3 P1 / P2 + the attack and summon films.
- **Round 3:** every film + clips + gates.

Findings are written with rule ids (IŞ-, HA-, EF-, SE-). Log the evidence paths in `docs/v3/oturum-a.md`.

---

## 10. Risks and open questions

### Risks
1. **The veil vs EF-2.** A cloud that "swallows" the target is exactly what EF-2 restricts. Mitigation: the lattice veil (§5.2), at most 70 % of the height, and the silhouette readable through it. The critic must judge it on the 3× ignition strip. If it fails, lower the veil to the waist and let the flames do the swallowing.
2. **The silence must read as intent, not lag.** 180 ms scene ≈ 245 ms game with nothing moving can look like a hitch. Mitigation:
   - the embers going dark one by one (visible motion);
   - the music duck (`ashenHush` 0.7);
   - the attacker's watch pose (f9, head tilted).
   Test with an outside viewer.
3. **Rubble vs heap.** The kit's `stone` shatter on the heap frame may read as Sentinel rubble. Mitigation: the heap is low and soft, with our cooling + wind `onBurst`. Fallback (needs the orchestrator): an additive `'ash'` `ShatterMaterial` (in `vfx/shatter.ts` `SHATTER_MATERIALS` + `_v3/presets.ts` `MATTER_RAMP` + `_v3/death.ts` `ACCENTS`) with low speed, `floor: 'rest'`, wind drift. Three shared files: ask first.
4. **Lane-mate overlap.** `venom_drake` is also being redesigned as a long-necked dragon. Compare idle f0 silhouettes at 1× before KK-1 approval. Ours keeps the hood above the head; theirs must not.
5. **The 50 Hz heartbeat vs `stone_sentinel`'s G1 rumble (49 Hz).** Measure the LSD early; retune if needed (§6.3).
6. **Direct attack budget** (≈ 2.2 / 2.32 s): little slack (§5.3).
7. **The frame budget** (133 / 140) leaves 7 frames. Do not add a special. Victory is the first to cut if needed.
8. **The weight class change** (`heavy`, from the old art's `heavy` to the same, but now on a slimmer body). The kit's shake 3–4 px and guard push are fine; the HA-8 ordering vs the Titan (also heavy) must keep charge→release ≥ the Titan's (550 ms vs its table).
9. **The old `ashen_drake-gbuf.ts` light vector** is non-standard; reusing the file as-is would fail IŞ-1 comparisons. Port the helpers, not the vector.
10. **Card art / cut-in import the rig.** All three must land in one commit or typecheck breaks.

### Open questions (for the orchestrator / owner)
- **Q1.** Is a sparse **ambient idle heartbeat** sound wanted? The R1 SFX lists "idle: 50 Hz double heartbeat", but the game has no idle-sound system. Today the heartbeat plays only at cinematic beats (§5.7). An ambient tick on the field would need a new shared observer: it is not proposed without approval.
- **Q2.** Own struck-body sound (`hitAsh*`, §6.5 phase 2): may lane A add `'ash'` to `GENERATED_HIT_MATERIALS` and update the pinned test?
- **Q3.** May lane A add an `'ash'` `ShatterMaterial` if the stone heap reads as rubble (Risk 3)?
- **Q4.** Flip: is the stone/ash recipe flip enough, or does the owner want its own ash-cloak flip (§5.9, phase 2)?
- **Q5.** Should the size class in `_placeholder-new.ts` (`ashen_drake: 80`) be updated? It only affects the v1 placeholder, so the proposal is to leave it (v1 must stay byte-identical).
