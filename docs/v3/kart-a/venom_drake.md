# Zehir Ejderi (`venom_drake`): v3 redesign blueprint (lane A)

KARANLIK / Ejderha · Sv5 · 2000/1500 · size class 80 · ★ ace (1 tribute → cut-in) · effect `none`
Flavor: *"Pullarından sızan zehir, geçtiği toprağı bir daha yeşertmez."* The card data stays the same
(src/data/cards.ts). Only the presentation is new: the sprite, every animation, the cinematics, the SFX,
the card art and the cut-in.

This document is the blueprint the builder agents follow. Every path, function and API below was
checked against the tree on 2026-10-31 (branch base 6178b55). Rule ids (IŞ, MA, Sİ, HA, SÜ, EF, SE,
KK) refer to docs/v3/REHBER.md. All ms are **scene ms** (the code's own durations). The game clock is
×1.35 (V3_TEMPO), hit-stop is ×≈1.55, and budgets are measured as REHBER §5 × 1.45 (docs/v3/TEMPO.md).

---

## 0. Why the current versions fail (evidence: monster-sheet renders in the scratch dir `kart-a/venom/`)

**v1 / the game today (`src/art/monsters/_placeholder-new.ts`, kind `'fang'`).** The v3 registry
excludes `src/art/monsters-v3/venom_drake.ts` (src/art/monsters/index.ts line 35), so both looks draw
the generic violet "crystal totem" with a white diamond: a 4-frame, 667 ms loop and a 4-frame attack
that pops (out 2.69×). It is not a dragon. Nothing in it is about venom.

**The failed v3 attempt (`src/art/monsters-v3/venom_drake*.ts`, the `serpent` plan of coral_serpent).**
- **It is coral_serpent recoloured.** It uses the same plan (`coral_serpent-plan.ts`), the same
  frame (88×92, anchor 34,86), the same planted coil, the same S-neck and the same "coil back, snap,
  jet" rhythm. Sameness and the owner's eye both read it as the water serpent in green.
- **The colour says plant, not venom.** The whole hide is the `leaf` ramp (leaf0–leaf3). That is
  thorn_lurker's and the WIND attribute's language. Because the body and the venom are the same
  green, the venom cannot glow against the body: the "signature" vein is a 1-px lime line wandering
  over a green body, so it reads as noise. Idle isolated pixels are about 207 of 2259 (9.2 %), right
  at the IŞ-10 ceiling, and most of them are the vein.
- **It does not read as a dragon at 1×.** The head hangs snout-down, the "wing-fins" are invisible,
  and there is no wing, no leg and no mass. At 1× on the board it is a thin green hook.
- **Its motion is static.** The idle is 10 frames in which only the head drifts (idleΔ 609, and frames
  f3/f4/f9 change 78–264 px). The guard is a lump (1080 ms of near-identical frames).
- **The death melts into a flat green smear** with no final material that is its own. The
  "sludge + bone" idea was right, but it was drawn as a puddle-coloured version of the body.
- **There is no signature.** The attack is a short green dribble from the mouth. Nothing about it
  could not belong to any other monster.

**The cure.** Give it a silhouette that no other card has, separate the BODY colour (dark violet)
from the VENOM colour (acid chartreuse) so the venom glows, and make corrosion the signature. Venom
eats holes into its victim and leaves permanent dead ground on the board. That is the flavor text
made literal.

---

## 1. Identity and silhouette

**Concept: the Scorpion Wyvern ("Akrep Kuyruklu Vivern").** A low-slung, heavy-shouldered
**wyvern**: two thick hind legs and **wing-arms planted on their knuckles** as forelegs, like a
pterosaur on the ground. The membranes are folded along the arms and hang like a ragged cape. Its
**tail rises from the rump in a tall scorpion arch over its own back**, and its tip is a swollen
**venom bulb with a hooked stinger** poised above its head, pointing at the enemy. Under the jaw
hangs a **translucent throat sac** that glows and swells. Along the spine runs a row of **hollow
weep-quills**, each with a bead of venom. Venom seeps from the seams between the scales (the flavor).
Heraldic wyverns carry a venomous tail sting, so the design is both classical and unmistakable.

**The 1× read (the "C over a bar"):** a low horizontal body (the bar) plus a tall arch that curls
FORWARD over the body (the C), with a bright point at the top-front. No other card has an arch that
curls forward over its own back:
- crystal_wyrm stands upright on two legs with spread wings.
- ashen_drake R1 perches tall and hunched like a vulture, with its tail trailing.
- coral_serpent is a coil with a rising neck.
- volt_lizard is a small lizard whose tail curls up BEHIND it, not over it.
- thorn_lurker is a plant bulb.

| Item | Value |
|---|---|
| Size class | 80 (Büyük). Target idle f0 bbox ≈ 70×74, opaque ≈ 2300–2600 px (between magus 2094 and titan 2575, REHBER §3 table) |
| Frame | **100×92** (no v1 offset: a full redesign; Sİ-5 IoU is waived by the owner's "full redesign" decision, so record the waiver in the art header) |
| Anchor | (48, 86): the ground line between the hind feet (x 34–44) and the planted wing-knuckles (x 60–68). `GY = 86` |
| Hover | 0 (feet and knuckles planted; HA-9) |
| Weight | `medium` (hit-stop 60–80, shake 2 px, recover 280 "steady"; HA-8 ordering: charge→release 440 ms < the wyrm's 460) |
| Facing | right (P2 = flipX + `p2: 'relight'`) |
| Key layout at idle f0 (P1) | hind feet y 86 at x 34–44; knuckles y 86 at x 60–68; barrel back line y ≈ 52; head low and forward, snout tip ≈ (90, 58), eye ≈ (82, 52); throat sac under the jaw ≈ (80–86, 60–66); tail root ≈ (24, 54) → arch apex ≈ (30, 12) → **bulb centre ≈ (56, 16)**, stinger tip ≈ (64, 21) pointing forward-down |
| Margins | ≥ 3 px at idle; the attack wind-up pulls the bulb back to x ≈ 26 and the release throws it to x ≈ 84, y ≈ 20, both inside the frame with ≥ 2 px (Sİ-2) |

**Materials, ramps (palette.ts only; IŞ-11 ≤ 20 colours per frame):**

| Material | Tones (dark → light) | Notes |
|---|---|---|
| **Hide** (new material `venomscale`) | `PAL.night0` underside / creases · `void0` shadow · `void1` mid · `void2` lit · `void3` 1-px lit edge only (IŞ-8) | Deep oily violet-black. The largest lit plane (back, top of head, top of the tail arch) is calm `void2`. Scale rows are 2-px `void0` teeth every ≈ 5 px, only on the mid/shadow boundary (the serpent rule, MA-2) |
| Rim light (IŞ-7) | `leaf1` (one colour) | The toxic under-glow: a 1-px rim on the shadow side, as if lit by the venom. P2 uses the same tone |
| **Bone / chitin** (claws, horns, the last 2 tail segments, the stinger hook, belly plates) | `stone1` shadow · `stone2` mid · `stone3` lit · `stone4` 1-px edge | Belly plates are a band of `stone2` with `stone1` seams every 3 px |
| **Membrane** (folded wing cape) | `void0` web · `void1` lit panel · `night0` crease; **2–3 eaten holes** (real transparent holes in the silhouette, 2–3 px, ringed by a 1-px `leaf1` edge) | Holes are a silhouette detail visible at 1×. One fold line per panel (the glass rule) |
| **Venom** (light, drawn after the outline, never outlined: IŞ-9) | `leaf2` deep · `leaf3` body · `leaf4` hot · **`gold4` core pixel** | Chartreuse acid. The bulb, the sac interior, the bead on each quill, drops, the seams on `dissolve` |
| Eye | `gold3` 1×2 px with a 1-px `ink` vertical slit | Must stay dimmer than the bulb core |

**Brightest point:** the venom bulb's single `gold4` core pixel inside a `leaf4` ring (the cut-in's
lens glint and the card art's focus too). The sac is second (`leaf3`), the eyes third (`gold3`).

**P2 relight notes:** draw P2 with `{ lightFrom: 'right' }` (as ashen_drake.ts / crystal_wyrm.ts
`render()` do with `setLight`). Hide planes, chitin and membrane panels swap lit / shadow sides. The
venom, eye, sac and holes are self-lit or absent, so they are identical in both sets (IŞ-2). The
`leaf1` rim stays on the side away from the screen light.

**Why it is not ashen_drake (lane A sibling, R1):** ashen is a tall, hunched **vulture** perch in
ash grey and ember orange with an S-neck hanging DOWN, a tail TRAILING behind into a brazier, and
wings worn like a cloak on the shoulders. Venom is a LOW, WIDE crawler in violet and chartreuse with
its wings planted as forelegs and its tail ARCHED UP AND FORWARD over the head. Ashen's identity is
ash, ember, heartbeat and delayed ignition. Venom's is acid, holes, fizz and permanent scars. The
lane-A agents must cross-check the two sheets side by side once both idle f0 exist (KK-1).

---

## 2. Distinction card (the `distinction` field of the art module)

```ts
distinction: {
  silhouette: 'a LOW wide wyvern on four points (two thick hind legs + two wing-arms planted on the knuckles, membranes folded as a ragged cape) with a tall SCORPION ARCH of tail rising off the rump and curling FORWARD over its own back, a swollen venom bulb and hooked stinger poised above its head; a translucent throat sac under a long low jaw; a row of hollow weep-quills on the spine — "a C curled over a bar"',
  rhythm: 'stalk and sting: a trembling, swelling wind-up (the bulb pulses three times, the tail draws back over the rump), a 50 ms whip over the head, then a held, watching follow-through while the glob is in the air; reactions are short flinches with a rattle',
  idle: 'breath in the barrel, the throat sac pulsing on its own period, the tail arch swaying the bulb ±2 px a beat behind the rump, the head scanning low, a bead of venom swelling on the fang and falling to the floor where it hisses, one weep-quill beading at a time down the spine',
  guard: 'the wing-arms lift and fold forward over the head into a holed membrane shield, the tail lowers over it with the stinger cocked above the shield rim, still glowing',
  signaturePart: 'the venom bulb (gold4 core, leaf4 ring) on the scorpion arch: the brightest point of the card',
  material: 'oily violet-black scales (void ramp) seeping chartreuse acid (leaf2–leaf4 + gold4) from their seams; bone-grey chitin (stone) for claws, horns and stinger; the death eats the hide to the bone and leaves a permanent etched scar on the tile',
  signatureMove: 'the venom mortar: the tail flings a glob in a high arc; it splats, clings and EATS HOLES into the victim (stepped holes with acid rims and steam), and the floor where it splashed stays dead for the rest of the duel',
},
```

Nearest existing cards and how this one differs:

| Card | What is shared | What makes venom different |
|---|---|---|
| crystal_wyrm (ace dragon) | dragon, ace, ranged | Wyrm: upright biped, a beam from the mouth, glass and light. Venom: a low quadruped wyvern, a projectile lobbed from the TAIL, acid that eats. Colours do not overlap (cyan / white vs violet / chartreuse) |
| ashen_drake (R1) | DARK dragon, lane A | See §1. Ash cone + delayed ignition vs glob + corrosion. Vertical vulture vs low crawler |
| coral_serpent | the old plan | No coil, no S-neck, no jet. The arch is a tail, not a neck |
| volt_lizard | four-legged reptile with a raised tail | Volt is small, gold and electric with its tail BEHIND. Venom is size 80, violet, with the arch OVER the body and wings as forelegs |
| thorn_lurker | green / poison feel | The body is no longer green. Green appears only as light (venom) |
| magma_titan / stone_sentinel (throw) | lobbed projectile | Theirs is a boulder or magma rock from the hand. Venom's is a liquid glob from a stinger with a dripping trail, a splat and holes |
| grim_warden (R2) | pale green light | Warden's ghost fire is pale green with white. Venom's acid has a gold4 core, so it reads chartreuse and liquid, not flame. Cross-check the R2 lane's sheet |

---

## 3. Rig approach

**Decision: a hand-made rig with a G-buffer pipeline, following crystal_wyrm / ashen_drake (ace
craft), built on the shared `src/art/rigkit` primitives. Do NOT use a body plan.**

Why:
- No plan exists for a wyvern-quadruped with a forward tail arch. `src/art/bodyplans/` holds only
  `biped`, and the serpent plan is what failed.
- The signature parts (an arch whose bulb is a point every frame, membranes with real holes, a sac
  that swells, a death that eats the hide down to a skeleton) need part-level control that only a
  hand rig gives.
- It is an ace. REHBER §0.2 says an ace gets a fully custom rig with hand-placed part maps.
- ashen_drake-gbuf.ts proves the pattern: the crystal pipeline (G-buffer layers → value-plane
  quantization → 4-neighbour despeckle → junction creases → selective edge paint → rim light) with
  its own frame and materials. The builder copies that **structure** but takes the passes from
  `src/art/rigkit` (`raster`, `composite`, `edges`, `light`, `passes/{dissolve,drain,crumble,gather,reassemble}`)
  wherever the rigkit has them, so no pipeline code is copied again.

**Files to CREATE** (new per-card files; the old serpent files are deleted by the builder of the
sprite, after the new art draws):

| File | Content |
|---|---|
| `src/art/monsters-v3/venom_drake-gbuf.ts` | `W = 100`, `H = 92`, `GY = 86`; `setLight('left' \| 'right')`; the material tables (hide `venomscale`, chitin, membrane, venom light) with seam / crease step tables; vector helpers (or import them from rigkit/geom) |
| `src/art/monsters-v3/venom_drake-rig.ts` | `Pose` type + `drawWyvern(p, pose)`. Skeleton: hip, barrel, shoulder; 2 hind legs (IK to fixed feet); 2 wing-arms (IK to fixed knuckles; elbow → wrist → 3 finger bones carrying the folded membrane); neck (3 joints) → head (jaw angle, eye open/slit/shut, sac inflation 0–3); a **tail chain of 9 segments** (7 hide + 2 chitin) with a per-segment bend + the bulb (swell 0–3, glow 0–3) + the stinger hook; 5 weep-quills (bead size 0–2 each). Death / revive passes: `seamGlow`, `eatHide(k)` (hide pixels removed in part space by a seeded noise threshold k, exposing the drawn skeleton layer), `skeleton(k)`, `puddle(k)` |
| `src/art/monsters-v3/venom_drake-skel.ts` | The skeleton layer (skull, ribs, spine, tail vertebrae, the wing bones) drawn in `stone1–stone4` under the hide. Only death / revive use it (the rig hides it otherwise) |
| `src/art/monsters-v3/venom_drake-anims.ts` | Pose tables for every anim, holds, marks, `ANIMS`, `EXTRA_ANIMS`, `IMPACT`, `drawPose(anim, frame)`, `framePoints(anim, frame)`, `MUZZLE`; the exported beat frames `BEATS = { swell: [2,3,4], whip: 5, watch: 8, spread: 9, cut: 10, weep: 4 … }` for the cinematics (like crystal's `SPREAD_F` / `CUT_F` and the sentinel's `BEATS`) |
| `src/art/monsters-v3/venom_drake.ts` | The MonsterArt (rewritten): `id`, `w/h`, `anchorX 48`, `anchorY 86`, `hover 0`, `muzzle`, `core`, `anims`, `attackImpactFrame`, `weight: 'medium'`, `p2: 'relight'`, `draw` / `extraAnims` / `drawExtra` / `points`, the `distinction` card (§2) as an exported constant, and the header comment (anim list, the frame, the Sİ-5 waiver) |
| `src/art/materials/defs/venomscale.ts` | MaterialDef `venomscale` (status `draft`, firstUser `venom_drake`): draw tones from §1, `texture: { kind: 'scales', density: 5 }`, `rim: PAL.leaf1`, `emissive: { tones: [gold4, leaf4, leaf3], pulse: 'breath' }`, `hit: { sparks: [leaf1, leaf2, leaf3, leaf4], debris: 'drop', flash: PAL.leaf4 }`, its own `sound` (see §6: a wet leathery knock, NOT `same: 'scale'`) |
| `src/art/cutins-v3/venom_drake.ts` | The 200×144 ace portrait, `p2: 'relight'`, `holds` (§7) |
| `src/art/cardart-v3/venom_drake.ts` | REWRITE (today it imports the deleted `venom_drake-head.ts`) |
| `src/presentation/cards/venom_drake.ts` | The recipe (§8.1) |
| `src/cinematics/kart-a/venom_drake-strike.ts` | `registerStrike` (mortar, direct spray, blocked, lose) |
| `src/cinematics/kart-a/venom_drake-summon.ts` | `signatureSummon` v3 entrance + flip handler |
| `src/cinematics/kart-a/venom_drake-death.ts` | `registerCardHook('venom_drake','destroyed', …)`: the melt watcher + the puddle + the scar |
| `src/cinematics/kart-a/venom_drake-acid.ts` | The shared visuals of this card (not exported to others): `drawGlob(px, at, vel, frame)`, `acidHoles(u, at)` overlay, `steamThreads`, `splatCrown`, and **the persistent scar store** (`scarTile(ctx, key, at, level)`, reset on `onDuelStart`) |
| `src/audio/v3/venom.ts` | `V3_VENOM_RECIPES`, `type VenomSfxName`, `V3_VENOM_SUSTAINED` (§6) |
| `src/duel/scenarios/kart_a_venom_drake.ts` | QA scenarios (§8.3) |
| `tests/art/venom_drake.test.ts` | REWRITE for the hand rig (validateArt clean at tier `ace`, all anims and marks, the muzzle on every frame, feet fixed, the P2 relight silhouette equal mirrored, the death leaving < 10 % of idle opaque at the last frame, the card art painting at both sizes inside the palette) |

**Files to DELETE** (only after the new art draws and the card art no longer imports them):
`venom_drake-body.ts`, `-build.ts`, `-fx.ts`, `-head.ts`, `-parts.ts`, `-types.ts` in
`src/art/monsters-v3/`.

Budget (KK-13, class "large" ≤ 5 MB uncropped per side). With 100×92×4 B = 36.8 KB per frame, the
anim list below is **129 frames ≈ 4.75 MB** per side. Do not add frames beyond 132 without shrinking
the frame. Paint P2 lazily (the existing warm path). Keep every frame ≤ 8 ms to draw.

---

## 4. Animations

Holds are in ms per frame. Every one-shot ends exactly on idle f0 (out = 0). Everything below obeys
HA-2 (40–200 ms per frame, with the stated exceptions) and HA-3 / HA-4. The tier is ace (§4.9).

### Points (HA-25), every frame of every anim
- `muzzle` = **the stinger tip** (the projectile and spray leave from here). Even during death it
  follows the stinger until the tail hits the floor.
- `staff` = the **bulb centre** (the cut-in / summon ignition and the light-layer follow-light).
- `head` = the mouth corner (the hiss spray in roar and the summon inhale target).
- `core` = the throat sac / chest (it sinks in the death).
- `claw` = the near wing-knuckle.
- `feet` = (48, 86).

### idle: 18 f, ≈ 2.0 s loop
Holds: `110 120 130 120 110 100 110 120 140 110 120 130 120 110 100 110 120 140` (they slow at the
breath peaks, HA-5).
- Barrel breath: period 9 f (down 1 px at f3–f5 and f12–f14). The hind knees take the load, the feet
  do not move (HA-9).
- Throat sac: period 6 f, inflation 0 → 1 → 2 → 1, phase +1 frame behind the barrel.
- Tail arch: period 18 f. The rump leads, the mid arch is +1 frame behind, the bulb +2 frames. The
  bulb drifts x ±2, y ±1. The bulb's glow steps 1 → 2 → 1 on its own period of 9 f (out of phase with
  the sac).
- Head: a slow low scan over 18 f (±1 px, a tilt drawn by the jaw / eye map), +1 frame behind the
  barrel. One blink-to-slit at f8.
- Membrane cape: settles +2 frames after the shoulder (drape).
- **Fang drip:** a bead swells on the fang f0–f11 (1 → 2 → 3 px), falls f12–f14 (the drop is drawn
  in the sprite down to y 85), splashes f15 (a 3-px crown), and leaves a 1-px `leaf1` etch dot that
  steps out f16–f17. The loop seam is clean.
- **Weep-quills:** one quill beads at a time, front to back, 3 frames each (6 quills → 18 f).
- Targets: idleΔ / opaque ≥ 15 % (HA-18), max Δ ≤ 1.8× (HA-17), seam ≤ 1.4, isolated mean ≤ 10 %.
  The HA-21 phase rule (max over idle k of Δ(idle k, f0)/opaque < 50 %) is easy with this loop. Keep
  the bulb swing ≤ 2 px.

### guard: 8 f, ≈ 1.2 s loop: "Delik Kalkan" (the holed membrane shield)
Pose: both wing-arms lifted and folded forward over the head (the knuckles stay planted; the
forearms rotate up from the wrist), the membranes spread as a sloping shield with the eaten holes
showing. The head is tucked behind it; the eye shows through one hole. The tail is lowered forward
over the shield rim, with the stinger cocked above it and still glowing.
Holds: `160 150 150 160 160 150 140 150`. One part changes per frame (as the wyrm's guard): membrane
fills → chest sinks 1 px → shield rim drops 1 px → stinger twitch → sac pulse → membrane relaxes →
chest → stinger. Guard Δ = 0.3–0.8 × idleΔ (HA-19).

### toGuard: 6 f, 360 ms · fromGuard: 6 f, 360 ms (HA-20 / HA-29)
- toGuard holds: `50 60 60 60 60 70`. f2 is the mid-sweep in-between (wings at 45°, the tail halfway
  down); the head stays clear of the sweep; the last frame equals guard f0.
- fromGuard: the reverse path with its own in-between (the tail rises first, then the wings drop),
  holds `50 60 60 60 60 70`, ending on idle f0.
- The feet and knuckles never move.

### attack: 14 f, 1 460 ms: "Zehir Havanı" (venom mortar)
| f | hold | marks | pose |
|---|---|---|---|
| 0 | 80 | | idle f0 shifted: the head dips 1 px (in ≤ 2.0) |
| 1 | 70 | `charge` | the hind legs bend, the barrel lowers 1 px, the tail starts back over the rump, the sac tightens. **The declaration holds this frame** |
| 2 | 80 | | the tail is further back; **bulb swell 1** (5×5 → 6×5, glow 2) |
| 3 | 90 | | **bulb swell 2** (6×6, glow 3); quills bristle; the jaw opens a crack |
| 4 | 150 | | **full wind-up (the longest frame)**: bulb at its rearmost point ≈ (26, 14), **swell 3** (7×6, gold4 core 2 px), the body low and the knuckles gripping |
| 5 | 50 | | swing in-between: the tail whips over the head on its arc; a 2-px smear behind the bulb (HA-12, outlined with the body) |
| 6 | 60 | `release`, `impact` | the tail is fully forward and the stinger aims high at the target, bulb ≈ (84, 20), swell 0 (it fired); a 3-px venom crown at the muzzle (sprite) |
| 7 | 90 | | follow-through: the tail overshoots down 2 px, the head lifts to watch, the barrel rocks forward 1 px |
| 8 | 200 | | **watch hold** (an aim hold, allowed like the magus special f8): the tail recoils into a slow S, the sac deflates. The glob is in the air (the cinematic stretches nothing; the flight fits) |
| 9 | 80 | `contact` | the glob lands (the cinematic owns the real contact). The drake **rattles**: the tail tip is offset 1 px |
| 10 | 100 | `recover` | rattle back 1 px, the tail returns toward the arch |
| 11 | 110 | | |
| 12 | 120 | | |
| 13 | 130 | | → idle f0 |
charge → release = 70 + 80 + 90 + 150 + 50 = **440 ms**; the release frame lasts 60 ms.

### roar: 12 f, 1 100 ms: "Tıslayan Çıngırak" (hiss rattle)
Holds: `70 100 150 60 90 70 70 70 80 100 110 130`. Marks: `charge`@1, `release`/`impact`@3, `recover`@8.
- f1 the head drops low, the neck coils back.
- f2 (the longest) the wing-arms lift the membranes half-spread sideways (a hood), the sac is fully
  inflated (3), the quills erect.
- f3 the jaws gape (a hiss, with the sac flashing `leaf4`).
- f4–f7 the tail rattles: the bulb alternates ±1 px with 1-px motion ticks, and the sac collapses
  in 3 steps.
- f8–f11 settle.
This is the cut-in-less "roar" (special summons, the revive land).

### hit: 6 f, 540 ms
Holds `50 60 100 110 120 100`; `impact` = `contact` @0, `recover`@3. f0 is LOCAL (HA-21 < 50 %): the
head snaps back and up, the eye shuts, the sac compresses, the bulb flinches 1 px; the hips, legs,
knuckles, cape and tail root stay at idle f0. f1 is the in-between of the compressed key and the
reel (HA-22). f2 is the reel (the tail sways back 2 px).

### hitHeavy: 7 f, 660 ms
Holds `50 60 90 110 120 110 120`; contact@0, recover@4. f0 is local as above plus the near knuckle
lifting. f2 is a step back: the near knuckle plants 2 px back (in the air only; HA-9), the knees
take the load. f4 steps forward home. The hitHeavy f0 also serves as death f0 (HA-24).

### hitMagic: 7 f, 620 ms
Holds `50 60 80 80 100 120 130`; contact@0, recover@4. f0: the venom flares white-hot (the sac,
bulb and quill beads go `gold4`, the seams show `leaf3` for one frame), the eye blazes `gold4`, and
the body is rigid. f2–f3 is a 1-px shudder, with the tail a frame behind. f4+ relaxes.

### summon: 15 f, 1 420 ms (`land`@4)
Holds `90 80 80 90 60 70 80 80 90 60 200 90 100 110 140`.
- f0: **curled**. The body is low, the head is tucked under the near wing-arm, the tail is wrapped
  around the body, and only the bulb (glow 1) and the eye slit show (it sits inside the gas, §5.1).
- f1–f3: it stirs; the tail tip flicks out 1, then 2.
- f4 `land`: the wing-knuckles slam down and plant; it rises onto all four points (the body is at
  idle height minus 3 px).
- f5: the head lifts.
- f6–f8: **inhale**. The jaw opens and the sac swells 1 → 2 → 3 (it drinks the gas).
- f9 = `BEATS.spread` (**peak**): the tail unfurls into the full arch, the bulb ignites (glow 3,
  gold4 core 2 px), the membranes flare half.
- f10 = `BEATS.cut`: a 200 ms hold of the peak (the cut-in lands here).
- f11: exhale (a hiss; 2 thin mist puffs from the nostrils, sprite pixels).
- f12–f14: the wings fold to the cape and the tail settles to the idle arch → idle f0.

### death: 10 f, 780 ms (`impact` = `contact`@0, `dissolve`@4)
Holds `50 60 70 80 70 80 80 90 90 110`. It continues from hitHeavy f0 (posematch).
- f0: struck (= hitHeavy f0).
- f1: the reel.
- f2: the hind knees buckle and the arch starts to fall forward over the body like a toppling crane
  (secondary motion).
- f3: the stinger strikes the floor in front and the tail lies on the 2:1 floor diagonal.
- f4 `dissolve`: **its own venom breaks out of every scale seam** (a `leaf3` seam web over the hide,
  self-lit).
- f5: the hide is **eaten through**: transparent holes open in the hide and the drawn skeleton layer
  (ribs, spine, skull) shows through in `stone`.
- f6: the hide slumps down the bones into a bubbling pool around the feet (`leaf1` rim, `leaf2`
  surface, `void0` depths); the skeleton stands.
- f7: the skeleton sags; the wing bones fold.
- f8: the skull drops into the pool.
- f9: last frame: a low heap of bones in the pool, ≤ 14 px tall.
The kit breaks this last frame as `shadow` matter (it darkens and is pulled to the floor point,
which reads as "sinking into the pool").

### revive: 11 f, 1 040 ms (`land`@5)
Holds `80 80 90 90 90 60 90 100 110 120 130`. This is the death reversed (HA-28), not the summon:
- f0: a boiling pool with a bone heap.
- f1: the skull rises.
- f2: the skeleton stands.
- f3: the hide grows back up the bones from the pool (the seams glow, then close).
- f4: the tail vertebrae lift the arch.
- f5 `land`: the knuckles plant.
- f6: the first breath (the sac inflates 2).
- f7–f10: the bulb ignites → idle f0.

### special: 12 f, 1 100 ms: "Zehir Sağanağı" (venom spray; used by the DIRECT attack)
Holds `70 90 100 140 50 60 80 100 110 100 90 110`; `charge`@1, `release`/`impact`@4, `contact`@6,
`recover`@7.
- f1: it rears up on the hind legs, the wing-arms lift and spread wide (the only frames where the
  full membranes show).
- f2: the tail draws back.
- f3 (the longest): the bulb swells 3 and the quills beads 2.
- f4: the tail whips in a flat fan. The muzzle sprays: the cinematic emits 5 drops along the sweep.
- f5–f6: follow-through; the wings beat once.
- f7+: it drops back onto the knuckles → idle f0.
The card has no engine effect (REHBER §4.9: special is optional), so it serves as the direct-attack
motion, which makes the direct attack its own memorable moment.

### victory
Not drawn (nothing plays it today, REHBER §10.4). Optional later: the roar pose held.

**Frame total:** 18+8+6+6+14+12+6+7+7+15+10+11+12 = **132**. Trim idle to 16 f (period 8) if
monster-gates reports the byte budget over 5 MB.

---

## 5. Cinematic storyboards

Shared rules for every moment:
- The light is stepped (EF-6; `lightPool`, `lightFlash`, `followLight`, `lightBeam` from
  src/view/light and src/cinematics/strikes-a/_kit.ts).
- No full-screen wash (EF-4: white ≤ 1.5 %).
- Shake comes only from the medium class (2 px; 1 px for small beats).
- Hit-stop from `motion.ts` (70 ms at contact).
- The camera is never moved (EF-8: no new focus / zoom; do NOT copy crystal's v1
  `S.ctx.focus(… zoom 1.05)`).
- Every effect pixel is a palette tone at an integer position (EF-7).
- Every sound starts on its frame via `atFrame` / `atMark` (src/cinematics/_v3/sound.ts).
- The floor glow colour is `leaf3` with a `leaf2` spill. Its first stepped tone on the navy floor is
  `leaf0`, a sickly dark green. Check it at ×3 against the night floor (the sentinel lesson about
  mud tones).

### 5.0 The glob, the holes and the scar (venom_drake-acid.ts)
- **Glob (projectile, matter):** 7×6 px. A 1-px `ink` outline, a `leaf2` body, a `leaf3` lit upper
  side, a `leaf4` highlight and a `gold4` core pixel. 3 hand-drawn shapes (round, stretched along
  the velocity, squashed) are picked by the velocity octant; no rotation.
  - It wobbles: it alternates shape every 2 frames.
  - **Shadow:** a 5×1 `night0` dash slides on the floor under it (it reads the arc).
  - **Trail:** every 40 ms one 1-px drop falls (gravity 520 px/s²) to the floor. Where it lands,
    a 1-px `leaf1` etch dot appears, plus one `stone3` steam pixel that rises 3 px and is gone in
    400 ms. The dots step out over 1.2 s (they are not part of the permanent scar).
- **Splat crown:** 8 radial drops (`leaf3`/`leaf4`, 1–2 px, gravity) and a stuck splat blob drawn on
  the target's overlay at the contact point.
- **Acid holes (the signature):** `acidHoles(u, at)` adds an `overlay(u, pc)` (strikes-a/_kit.ts
  `overlay`, as crystal's cracks use) on the struck unit.
  - The holes grow from the contact point in **3 steps at 80 ms each**, on the target's opaque
    pixels only. Each hole is `ink`/`void0` with a 1-px `leaf3` rim. Coverage ≤ 6 % / 10 % / 12 % of
    the silhouette at power 1 / 2 / 3: local, inside EF-3's flash budget.
  - Steam threads rise from the holes: 2-px columns stepping `stone3` → `stone2` → `night3`, up
    10 px, 3–5 of them, each lasting 300 ms.
  - If the target survives, the holes close in 3 steps over 300 ms after its `recover` mark.
  - If it dies, the overlay follows the target's frame until the kit hides the sprite on its burst
    frame (the watcher pattern of `crystalBreakV3`), so the victim dies holed.
- **Scar ("Zehirli Toprak", persistent for the duel):** `scarTile(ctx, key, at, level)`.
  - A `Raster.around(…)` at depth `DEPTH.CARD_ON_TILE - 1`: under the cards, over the stepped floor
    light (the `floorCracks` pattern of src/cinematics/recipe/setpieces/rockAssembly.ts).
  - It is kept with `ctx.keep('venom:scar:<p>:<zone>' | 'venom:scar:podium:<p>', handle)`.
  - Level 1 is 3 etched pits. Level 2 adds a dead blot (an iso ellipse 16×6, `stone0` with a `leaf0`
    1-px rim). Level 3 (the death) is an iso ellipse 26×10, `stone0` core, `night0` cracks, `leaf0`
    rim, and one `leaf1` "dead stalk" glyph.
  - **Living detail:** every 2.4–3.6 s (seeded, on the scene clock) one 1-px `leaf3` bubble pops on
    the scar: 1 px → a 3-px plus → gone over 3 frames.
  - A tile's level only rises (max 3). Global cap: 8 scars. Reset in `onDuelStart`
    (src/duel/seeds.ts), as crystal's `r3` counter is.
  - Only under `LOOK_V3`.

### 5.1 Summon: "Zehirli Sis" (tribute ace + cut-in). Budget 2.5–3.0 s scene, ≤ 4.35 s game
Registration: `if (LOOK_V3) signatureSummon('venom_drake', (S) => S.ctx.base?.() …, { v3: venomMistV3 })`.
The v1 entrance argument must just defer to the default (in practice the v3 branch is the only one
that runs, because the file registers under LOOK_V3 only; v1 stays untouched). The tribute part is
the shared summon-a/tribute.ts. `fadeV3(['summonCharge'], 160)` on entry, as crystal does.

| scene ms (from the entrance start) | Picture | Light / floor | Sound |
|---|---|---|---|
| 0–260 | `S.openCircle({ appearMs: 200 })` (the DARK void circle). **Gas tongues** roll in from the 4 tile corners: stepped puffs (`leaf0`/`leaf1` with `void1` edges, 2×2 Bayer at 50 %) along the floor toward the centre, then they heap into a low dome ≈ 30×22 px | `S.glow({ … })` pool `leaf3`, 0.1 → 0.5 'flicker' | `venomArrive` (sustained) starts |
| 260 | The summon pose starts on f0 (curled). The hologram onset is ≤ 200 ms in the matter ramp. **Two lights in the fog**: the eye slit and the bulb (glow 1). The gas dome is a 25 % Bayer pattern over the body, never solid (EF-2) | | |
| ≈ 590 (f4 `land`) | The knuckles slam; `landingDust` (src/vfx/summon.ts) in `night3`/`leaf1`, 7 puffs; the circle pulses | shake 1 px | `venomLand` via `atMark(u,'summon','land')` |
| 650–890 (f6–f8) | **Inhale**: the gas spirals into the mouth (Sparks with `tx/ty` = the `head` point every frame, 3 waves). The dome dithers out 50 → 25 → 0 % in step with the sac swelling 1 → 2 → 3 | the pool dims 0.5 → 0.3 | `venomInhale` at f6 |
| ≈ 890 (f9 peak) | The tail unfurls. **The bulb ignites**: a `lightFlash` at the `staff` point, `leaf4`, radius 22, 280 ms, plus a 1-px `gold4` plus-glint on the bulb (3 frames) | | without a cut-in: `venomRoar`; with one: a quiet `venomDrip` (0.5) |
| ≈ 950 (f10 hold) | `await S.climax()`: the **cut-in** (§7; flare 280 / slam 360 / exit 720 / close 120 = 840 ms). The band passes under the tile (EF-10). The pose plays on f10 → f14 under it | | the cut-in's eye flare plays `venomRoar` (CHARACTER_SOUNDS.roar) |
| ≈ 1 670 (band exit) | **Finale = Zehirli Toprak**: `S.finale({ ring: 90, ramp: [void0, leaf0, leaf1, leaf2, leaf3], freezeMs: 50, sfx: 'summonBurst' })` with `summonBurst` at volume 0.35. At the same time an **etch ring** spreads from the feet in 3 steps (60 ms each, a jagged iso ring of `night0` cracks with a `leaf1` lip, the `floorCracks` style). It leaves **scar level 1 on its own tile**. The badge pops; `bg(circle.dismiss(420))` | a `lightFlash` of `leaf3` on the floor, radius 34, 300 ms | `venomScar` (0.8) |
| ≈ 1 790 | end (`await S.wait(120)`) | | |
Tribute + entrance ≈ 0.9 + 1.8 = **2.7 s scene ≈ 3.6 s game**.

Without a cut-in (not reachable for a Sv5 ace by normal summon; kept for robustness): the finale
fires on f9.

**From the graveyard (`soul_recall`, special):** no gas and no cut-in. The tile first boils: a pool
(the death's final picture) forms over 200 ms with `venomReviveGather` (sustained). Then the
**revive** pose plays; `land`@5 plays `venomReviveLand`, a 1-px shake and the badge. The tile's scar
rises to at least level 1. ≤ 2.1 s scene.

**Flip (a set venom flipped up):** the recipe's v3 flip with `flip: { accent: 'drop', ramp: 'leaf' }`.
On top of it, a small handler in venom_drake-summon.ts (as crystal's flip-v3) is OPTIONAL. If one
is written: the card turns in 240 ms; 3 drops roll off the card's edge onto the tile (a scar-1 pit
each); the body forms in its guard pose (≤ 120 ms hologram) and rises on `fromGuard` in a
flip-summon. Budget 0.6 s scene.

### 5.2 Attack on a monster: "Zehir Havanı". Budget (attack + death) 1.6–2.2 s scene, ≤ 3.19 s game
`registerStrike('venom_drake', venomMortarV3)` under LOOK_V3. Follow `prismBreathV3`'s skeleton:
- `strikeStartFrame(u)` (it continues the declaration's held f1).
- `takeCharge(u, 'venomCharge', …)`.
- `u.playRange('attack', f0)`; `u.playToFrame('attack', relF)`.
- `s.impact(hit)` at the contact.
- the `loses` early-out.

| scene ms (from the strike start, f1 held) | Picture | Light | Sound |
|---|---|---|---|
| 0–440 (f1–f4) | The wind-up. On each swell frame (f2, f3, f4) the bulb light steps up. One drop falls from the bulb onto its own tile per swell and etches a temporary dot | `followLight(sc, staff, { color: leaf4, radius: 12 → 16 → 20, floorY: home.y, anim: 'flicker' })`; the own-tile pool `leaf3` 0.15 → 0.6 | `venomCharge` continues (the rattle tightens); `venomSwell` at f2, f3, f4 (pitch 1, 1.12, 1.26) |
| 440 (f5) | Whip smear | | `venomWhip` (CHARACTER_SOUNDS.swing) |
| 490 (f6 `release`) | **The glob leaves the muzzle**; a 3-px crown at the stinger; `shake(sc, 60, 1)` | the follow-light fades 140 ms | `chargeSnd.stop(30)`; `venomSpit` |
| 490–790 | **Flight 300 ms** on a parabola from the muzzle to the target's face point (`surfaceOf`, written per crystal). Apex = 22 + 0.18 × the distance (P2 mirrored: the arc rises to screen-up, never into the HUD). Trail drops + floor shadow | a small `leaf3` follow-light on the glob (radius 10, intensity 0.5) | the whir is inside `venomSpit` (its tail) |
| 790 (`contact`) | **Splat**: `s.impact(hit)` (hit-stop 70, number EF-9, contact flash EF-3 on the hit region), the splat crown, the blob stuck on the overlay | `lightFlash(leaf3, radius 26, 260 ms)` at the target's floor | `venomSplat` + the target's material hit (the kit) |
| 790–1 030 | **The eat**: holes in 3 steps (80 ms each), steam threads. The splash scars the target's tile: level 1 (or +1) | | `venomEat` × 3 (one per step) |
| 940 | (the target's death starts: `DEATH_AFTER_CONTACT_MS` 150) | | |
| 790–1 460 | The attacker: f7 follow-through → f8 watch → f9 rattle → recover → idle | | `venomRattle` at f9 |
Strike resolves at ≈ 1 030 (the eat done). Attack + death ≈ 0.23 (declare) + 1.03 + the death
(1.1, parallel from 940) ≈ **2.1 s scene ≈ 2.85 s game** ✓.

**Blocked** (DEF ≥ ATK, e.g. vs a defense stone_sentinel 2100):
- The glob splats on the guard plane 9 px in front of the target (crystal's aim offset), with a
  splat crown.
- **No holes.** The acid fizzes on the guard: 2 steam threads, and the blob slides down the guard in
  3 frames as a dripping sheet.
- The drops fall to the tile and scar it (level +1).
- `s.impact()` (hit-stop 50).
- `venomSplat` (0.8) + `venomFizz` (no eat ticks). The defender's material plays (stone).
- Recipe `blocked: 'splash'`.

**Losing** (e.g. vs crystal_wyrm 2800): the glob lands and the splat plays, the holes reach step 1
only, then the stronger side answers on that frame (clash.ts backlash, EF-13). Do as crystal:
`finish(); await sleep(sc, 34); return;`. The holes on the winner close at once with a fizz. Venom's
own death (§5.4) runs from its hitHeavy f0.

**Both destroyed** (vs coral_serpent 2000): the splat + holes, then both deaths. The target dies
holed; venom melts.

### 5.3 Direct attack: "Zehir Sağanağı". Budget ~1.6 s scene, ≤ 2.32 s game
`s.direct`: play `special` instead of `attack` (`u.playRange('special', …)`).

| ms | Picture | Light | Sound |
|---|---|---|---|
| 0–390 (f1–f3) | It rears, the wings spread, the bulb swells | the follow-light on the bulb | `venomCharge` |
| 390 (f4 release) | **5 drops** leave the muzzle along the fan sweep (40 ms apart), toward 5 points on the opponent's side (two floor tiles in front of the podium, the podium rim, the podium, the duelist), arcs 220 ms each | | `venomWhip`, then `venomSpit` (0.7) |
| 610–770 | Drops 1–4 splash on the floor (small crowns) and leave scar-1 pits on the podium floor (`venom:scar:podium:p`) | small `leaf3` flashes, radius 12 | `venomDrip` × 4 (pitch ladder 1, 0.94, 0.89, 0.84) |
| 770 (contact) | **Drop 5 hits the duelist**: `s.impact(s.to)`, the number, the default duelist hurt; the fizz on the podium | `lightFlash leaf3`, radius 22 | `venomSplat` (0.9) |
| 770–1 100 | recover, idle | | |
≈ 0.23 + 1.1 + LP 0.4 ≈ **1.6 s scene ≈ 2.2 s game** ✓.

### 5.4 Death: "Kemiğe Kadar" (to the bone). Final material, a new row for YENI_KARTLAR §5.2
**Final material:** *"Kendi zehri derisini yer; kemik iskelet bir an ayakta kalır, köpüren gölete
çöker; karoda savaş boyunca kalan ölü toprak izi."* (Its own venom eats its hide; the bone skeleton
stands for a moment, then collapses into a bubbling pool; dead ground stays on the tile for the
rest of the battle.)

Unique against §5.2:
- The bones and acid are its own.
- The ash heap is R1's.
- The empty shroud is R2's.
- The liquid flowing back into the tile is C10's. Venom's body is not liquid: it is eaten, and what
  stays is a **mark on the board**, which no other card leaves.

Registration: `if (LOOK_V3) registerCardHook('venom_drake', 'destroyed', (ctx) => { venomMeltWatch(ctx); return flavoredDeath(ctx, async () => {}); })`.
This mirrors crystal: the watcher plus flavoredDeath, which routes to `deathV3` and also respects
`sourceOwnsDestroy`, so judgment_bolt keeps its electrocution. The body breaks via recipe
`death: { material: 'shadow', accent: 'shadow' }`. The void pool accent is the dark depth of the
puddle; the watcher paints the acid on top.

| scene ms (from the death start) | Picture | Light | Sound (CHARACTER_SOUNDS) |
|---|---|---|---|
| 0 (f0) | struck; the kit's flash | | the blow's material (`venomscale`) |
| 50 (f1) | reel | | `deathStart`: `venomTear` (a wet rip) |
| 110–260 (f2–f3) | the knees buckle, the arch topples forward, the stinger strikes the floor | `shake 1` at f3 | |
| 260 (f4 `dissolve`) | the seam web glows; **the watcher starts**: a seam light rising from the core | `followLight(core, leaf3, radius 18, 0.2 → 1.0 over 300 ms)` | `dissolve`: `venomMelt` (a long fizz plus boiling) |
| 330–500 (f5–f6) | the hide is eaten, the bones show, the hide slumps to a pool; the watcher adds steam threads (5) and bubbles on the pool | | `afterDissolve`: [2, `venomBones`, 0.7] |
| 580–670 (f7–f8) | the skeleton sags, the skull drops | | [4, `venomBones`, 0.45] (the skull) |
| 780 (the burst: the kit breaks the last frame as shadow) | **The watcher's `onBurst` work**: the puddle Raster (an iso ellipse 26×10: `leaf2` surface, `void0` depth, `leaf1` rim, 3 bubbles) boils for 300 ms, then **eats into the tile in 3 steps** (80 ms each): it shrinks to **scar level 3** (kept). The card is born on the burst frame (kit) | the light pool fades 240 ms | `burst`: `venomPuddle` (a splash-collapse + a hiss decay) |
Pose 0.78 + burst + card flight ≈ 1.1 s scene ≤ 1.4 (SÜ) ✓; game ≈ 1.5 s ≤ 2.03 ✓.

**Death in defense:** guardbreak (HA-24) from fromGuard f0. The holed shield membrane is eaten first
(the death pose is posematched from fromGuard). Everything else is the same.

### 5.5 Being struck (as a defender, surviving)
- The material `venomscale` sounds (§6).
- Debris `'drop'` in leaf tones: venom spurts from the wound and 2–3 drops fall and leave temporary
  etch dots. No permanent scar: only venom's OWN acid scars.
- The contact flash follows EF-3 (dark body, so the white core is allowed).

---

## 6. SFX design: src/audio/v3/venom.ts

**Identity (a new row for YENI_KARTLAR §5.1, to add when the doc owner merges):**

| Kart | Ana perde / renk | İmza malzeme | Ayırıcı katman |
|---|---|---|---|
| Zehir Ejderi (venom_drake) | A1 55 Hz ıslak gırtlak kesesi guruldaması (7 Hz dalga) + 6–9 kHz asit köpürmesi | asit + kitin iğne | iğne çıngırağı (24 Hz darbe treni, 3–6 kHz bant) + ters perdeli damla "tıp→tsss" (1.9 → 1.25 kHz inen tık + köpürme) |

**The spectral signature is bimodal:** energy is strong below 120 Hz (the gurgle) and in 3–9 kHz
(the hiss and fizz), with a deliberate valley between 300 Hz and 1.5 kHz.
- That separates it from every §5.1 row and from the aces:
  - crystal_wyrm's centroid is 1758 Hz (glass).
  - abyss_magus's centroid is 764 Hz (drone).
  - ashen R1 is a 50 Hz double heartbeat with sparse ash crackle (a low-mid "VUF").
  - C10 is a 600 Hz suction.
  - C9's 4 kHz "tsst" and R3's 5 kHz feather are short and single-band, with no low body. Venom's
    hiss is always paired with the gurgle and the rattle's 24 Hz amplitude pulse.
- No `glassReverse` (R2's), no "pof" (R3's), no double low beat (R1's), no beating pair (C12's).
- The fizz is **dense and tiny** (Voice `crackle` with n ≈ 80–120/s, f 7000, q 0.8, decay 4 ms).
  Fire's crackle is sparse and louder at 1–3 kHz.

Built only from `src/audio/v3/kit.ts` blocks (`thump`, `puff`, `sweep`, `crack`, `growl`, `drone`)
and Voice primitives (`v.tone`, `v.noise`, `v.filt`, `v.crackle`, `v.flutter`, `v.bursts`,
`v.lfo`, `v.wander`). No new DSP (SE-3).

| Name | Role / when | Recipe (t in s) | duck |
|---|---|---|---|
| `venomRoar` | `roar` (the cut-in flare, the roar f3) | `growl(v, 0, { d: 1.05, f: [58, 74, 66, 55, 46], formants: [280, 620, 1750], g: 0.8, grit: 7, rasp: 24 })` + the **hiss**: `sweep(v, 0.05, 0.95, [2600, 5200, 3600], 0.22, { kind: 'white', q: 0.9, peakAt: 0.3 })` routed through `v.flutter(24, 0.8, { d: 1, base: 0.3 })` (= the rattle) + the sac gurgle `v.tone('sine', 55, …)` with `v.lfo(detune, 7, 60)` | 0.65 |
| `venomArrive` | `arrive` (sustained; stopped at `land` with 120 ms) | `puff`-style pink noise through `v.filt('lowpass', [[0,300],[0.8,900,'e']])` 1.6 s swell + `v.crackle({ d: 1.6, n: 60, g: 0.03, f: 7000, q: 0.8 })` + 6 bubbles (`v.tone('sine', [[0,180],[0.04,420,'e']])` at seeded times) | 0.3 |
| `venomLand` | `land` | `thump(v, 0, 95, 48, 0.55, 0.16, { drive: 1.5 })` ×2 (knuckle, knuckle +0.045) + `puff(v, 0.01, 0.12, 0.08, 1200, { kind: 'pink' })` (a wet slap) + 2 drips | 0.4 |
| `venomInhale` | summon f6 | a reversed air: `sweep(v, 0, 0.32, [5200, 2600, 900], 0.14, { kind: 'pink', peakAt: 0.85 })` + the sac rising `v.tone('sine', [[0,55],[0.3,82,'e']])` | 0.2 |
| `venomCharge` | `charge` (sustained; stopped at `release` with 30 ms) | the rattle: white noise → `v.filt('bandpass', 4200, 1.4)` → `v.flutter([[0,14],[0.5,30,'e']] rate …)`: the flutter rate rises 14 → 30 Hz over 0.5 s; a faint gurgle under it | 0.25 |
| `venomSwell` | f2/f3/f4 (`pitch` 1 / 1.12 / 1.26) | a "glug": `v.tone('sine', [[0,70],[0.05,52,'e']])` g 0.3 dec 0.12 + a bubble `v.tone('sine', [[0,200],[0.035,460,'e']])` g 0.08 | 0.15 |
| `venomWhip` | `swing` (f5) | `sweep(v, 0, 0.09, [1500, 6200, 2400], 0.3, { kind: 'white', q: 1.1, peakAt: 0.55, pan: [-0.2, 0.2] })` + `crack(v, 0.075, 0.12, { hp: 2500, lp: 8000, n: 2 })` | 0.2 |
| `venomSpit` | `release` | a mouth-pop `v.tone('sine', [[0,420],[0.015,150,'e']])` + a wet `puff(v, 0, 0.15, 0.06, 1800)` + the glob whir: `sweep(v, 0.02, 0.28, [900, 1600, 700], 0.05, { q: 3 })` with a `v.lfo` wobble of 11 Hz on its gain | 0.3 |
| `venomSplat` | `impact` | a splat `v.bursts([0, 0.012, 0.03], [0.5, 0.3, 0.15], { dec: [0.05, 0.04, 0.03], f: 1400, q: 0.8, kind: 'brown' })` + the **fizz** `v.crackle({ t: 0.02, d: 0.55, n: 110, g: 0.06, f: 7000, q: 0.8, dec: 0.004, curve: 1.6 })` + a steam hiss `sweep(v, 0.03, 0.5, [3000, 6000, 4200], 0.1, { kind: 'white', peakAt: 0.2 })` | 0.5 |
| `venomEat` | hole steps (×3) | a tiny `v.crackle({ d: 0.07, n: 30, g: 0.05, f: 6000 })` + a 1-cycle pop `v.tone('sine', [[0,900],[0.01,600,'e']])` g 0.03 | 0.1 |
| `venomFizz` | blocked | as `venomSplat`'s fizz alone, 0.4 s | 0.25 |
| `venomRattle` | attack f9 | 0.25 s of `venomCharge`'s rattle at a fixed 26 Hz, gain-enveloped | 0.15 |
| `venomDrip` | the **leitmotif** (drops, the scar bubbles at volume 0.15) | **"tıp→tsss"**: `v.tone('sine', [[0,1900],[0.025,1250,'e']], g perc 0.06 / 0.04)` + `v.crackle({ t: 0.03, d: 0.25, n: 70, g: 0.02, f: 7500 })` | 0.1 |
| `venomScar` | the summon finale, the death's tile etch | brown noise `puff(v, 0, 0.2, 0.5, 900, { kind: 'brown' })` (an earthy sizzle) + `v.crackle(d 0.7, n 90, f 6500)` + a sour low dyad `v.tone('sine', 55)` + `v.tone('sine', 58.27)` decaying 0.6 s (one-time, under 0.06 gain; this is not a beating motif) | 0.25 |
| `venomTear` | `deathStart` | a wet rip: `v.crackle({ d: 0.18, n: 140, f: 1500, q: 2, g: 0.12, curve: 0.5 })` + a gurgle drop `v.tone('sine', [[0,82],[0.2,46,'e']])` | 0.35 |
| `venomMelt` | `dissolve` | 0.55 s `v.crackle(n 120, f 7000)` swelling + 9 seeded bubbles (180 → 420 Hz) + `drone(v, 0, 0.6, 55, 0.08, { lp: [120, 400, 140], att: 0.2 })` | 0.45 |
| `venomBones` | `afterDissolve` | dry bone clatter: `v.bursts([0, 0.035, 0.07], [0.3, 0.2, 0.12], { dec: 0.025, f: 1800, q: 6, kind: 'white' })` + `thump(v, 0, 160, 120, 0.12, 0.05)` | 0.2 |
| `venomPuddle` | `burst` | a collapse splash `v.bursts([0,0.02], [0.5,0.25], { dec: [0.09,0.06], f: 900, q: 0.7, kind: 'brown' })` + a long hiss decay `sweep(v, 0.03, 0.9, [5000, 3500, 2200], 0.12, { kind: 'white', peakAt: 0.1 })` + the fizz tail | 0.55 |
| `venomReviveGather` | `reviveGather` (sustained; stopped at `land`) | a reversed fizz: `v.crackle({ d: 1, n: 120, f: 7000, curve: 0.4 })` (back-loaded) + rising bubbles 150 → 400 Hz (NOT a suction pop) + the gurgle 46 → 55 Hz | 0.3 |
| `venomReviveLand` | `reviveLand` | `venomLand` + a 0.2 s rattle burst | 0.4 |

Levels obey SE-6 (the v3 output ceiling). Ducks obey SE-7 (the roar and puddle ≥ 0.55; small beats
≤ 0.3). Export `V3_VENOM_SUSTAINED = ['venomArrive', 'venomCharge', 'venomReviveGather']`.

**Struck-body material (`venomscale`, SE-5):** `sound: { thump: [150, 62, 0.5, 0.12], surf: [1100, 0.25], ring: { kind: 'flutter', band: [600, 480], dec: [0.06, 0.1] }, sizzle: 6500 }`.
This gives a wet leathery knock plus a little spurt. The generated hits are
`hitVenomscaleLight/Heavy/Magic` (materials.ts `generate()`). Check SE-5: LSD ≥ 9 dB against
`stone`, `cloth`, `crystal` and `metal`.

**CHARACTER_SOUNDS entry** (src/cinematics/_v3/sound.ts, an additive block after `abyss_magus`):
```ts
venom_drake: {
  roar: 'venomRoar', arrive: 'venomArrive', land: 'venomLand', charge: 'venomCharge', swing: 'venomWhip',
  release: 'venomSpit', impact: 'venomSplat', deathStart: 'venomTear', dissolve: 'venomMelt',
  afterDissolve: [[2, 'venomBones', 0.7], [4, 'venomBones', 0.45]],
  burst: 'venomPuddle', reviveGather: 'venomReviveGather', reviveLand: 'venomReviveLand',
},
```

**SE-4 check:** render every role offline and compute the 1/3-octave A-weighted LSD against the
crystal_wyrm, abyss_magus, stone_sentinel (rumble voice) and ashen_drake sets (and cloud_hatchling
once it exists). Requirement: the median ≥ 15 dB and the minimum ≥ 10 dB per role. The likely
weakest pair is `land` vs ashen's: the knuckle thump sits at 95 → 48 Hz. If it is under 10 dB, move
it to 120 → 60 and lean on the wet slap.

---

## 7. Card art and cut-in

### Card art: src/art/cardart-v3/venom_drake.ts (`CardArtV3`, docs/v3/KART_RESIMLERI.md)
**big 88×68:** "Zehirli Toprak". The wyvern seen in 3/4 view, low on a ledge of dead, cracked
ground; it fills the left two-thirds, with its body bottom-left cut by the frame edge (allowed).
- The head is low at the right third line (x ≈ 58, y ≈ 40), looking right, with the sac glowing.
- The **tail arch** rises behind it and curls over into the upper-right third. The **bulb** sits at
  ≈ (64, 16): the focus and brightest point (a `gold4` core, a `leaf4` ring), with ≥ 4 px of air
  above it.
- A drop falls from the stinger to the ground (a 2-px stepped trail) onto an etched ring of dead
  ground.
- Bottom-right corner: **one green sprig** of healthy grass at the frame edge, half eaten (its tip
  is `stone2`, dead). That is the flavor in one glyph.
- Backdrop: the kit's DARK recipe (`paintBackdrop`, the void eclipse band) with the stepped light
  shape centred 3 px behind the bulb. The rim is `void3` (the DARK card rim).
- Layers: backdrop → subject (ink outline; the hide in void tones, the chitin in stone) → light (the
  bulb, the sac, the drops, the eye; never outlined).
- Living frames (6, f0 = the reduced-motion frame): the drop cycle on the stinger and one bubble pop
  on the etched ring.

**small 44×34 (hand-tuned):** a tighter crop (preference 1 of KART_RESIMLERI §1): head + bulb + drop
only.
- The bulb is at (31, 7); the head is at (24, 21).
- The tail arch is reduced to a 2-px-thick band with ONE lit edge.
- Correct the result by hand with `patch`; never ship a blind `autoSmall`.
- Judge it at 1× and ×6.

Register it additively in `src/art/cardface-v3/index.ts` `ART` (the `p.blit(renderArt(venomDrake, 0).smallPx, 0, 0)`
pattern), but only once the v3 sprite is registered (the comment in that file: monsters only with
their v3 sprite).

### Cut-in: src/art/cutins-v3/venom_drake.ts (200×144, faces right, `p2: 'relight'`)
Portrait: a low 3/4 close-up of the head entering from bottom-left. The long jaw points to the
right third, with the throat sac under it. The **tail curls into the frame from top-left over the
head**, and the bulb with its stinger hangs in the upper-right third, dripping. The membrane edge
with holes shows at the left border.

Rhythm: the recipe's `cutIn: { rhythm: { flare: 280, slam: 360, exit: 720 } }`, close 120 (the
default). Total 840 ≤ 900 (`CUTIN_V3_MAX_MS`). Holds (played once, ending held):

| f | ms | Beat |
|---|---|---|
| f0 | 0–200 | the cold stare: the slit eye, a drop swelling on the stinger, the band wipes in |
| f1 | 200–280 | the sac inflates, the head draws back 1 px |
| f2 | 280–360 | **[flare]** the pupil snaps thin, the **bulb ignites** (a `gold4` core with the lens glint) |
| f3 | 360–520 | **[slam]** the jaws gape in the HISS; the sac flashes `leaf4`; the tail is drawn tight (motion lines on the arch, no two-frame tremble) |
| f4 | 520–720 | the hiss holds; **the drop falls** from the stinger across the face line |
| f5 | 720– | **[exit]** held: the jaws half-closed, a new bead forming |

Holds array: `[200, 80, 80, 160, 200, 1]` (the last frame is held). Portrait colours follow the
sprite (§1). The P2 set is drawn with `lightFrom: 'right'`. Preview:
`?dev=cutin&id=venom_drake&look=v3` and `&player=2`.

---

## 8. Integration plan

### 8.1 New files (no registry edits needed; discovered by glob)
- `src/art/monsters-v3/venom_drake*.ts` (registered by name, once the exclusion is removed: see 8.2).
- `src/art/materials/defs/venomscale.ts` (`./defs/*.ts` glob in src/art/materials/index.ts).
- `src/art/cutins-v3/venom_drake.ts` (glob in src/art/cutins/index.ts line 576).
- `src/presentation/cards/venom_drake.ts` (glob in src/presentation/registry.ts):
  ```ts
  export default {
    id: 'venom_drake', tier: 'ace',
    body: { physical: 'venomscale' },
    attack: { type: 'projectile', blow: 'magic', from: 'muzzle', vfx: 'venomGlob', tone: PAL.leaf3, direct: 'projectile', blocked: 'splash', ranged: true },
    summon: { style: 'pool', matter: 'shadow', roarPeak: 9 },
    death: { material: 'shadow', accent: 'shadow' },
    flip: { accent: 'drop', ramp: 'leaf' },
    voice: { custom: 'venom_drake' },
    light: { glow: { emissive: [[PAL.gold4, 1], [PAL.leaf4, 1], [PAL.leaf3, 0.6], [PAL.gold3, 0.5]], halo: 0.5, pool: 0.85, spill: PAL.leaf2 }, strike: PAL.leaf3 },
    cutIn: { rhythm: { flare: 280, slam: 360, exit: 720 } },
    custom: { strike: true, summon: true, death: true, revive: true },
  } satisfies PresentationRecipe;
  ```
  - `flip` and `position` stay on the recipe layer's generic v3 paths (not custom) unless the
    optional flip handler is written; in that case add `flip: true`.
  - The recipe makes `deathPreset`, `monsterGlow`, `cutInRhythm`, `materialOf` and `soundsOf`
    answer for venom in v3 only. That is the bridge rule: `v3Recipe()` returns the recipe only with
    LOOK_V3 and with v3 art. So **do NOT edit** `DEATH_PRESETS` in src/cinematics/_v3/presets.ts or
    the `venom_drake` line in src/view/light/profiles.ts. Both still serve the v1 placeholder, and
    changing them would change v1.
  - If `tests/presentation/*` reject `summon.style: 'pool'` without a set piece, use `'column'` (the
    style only matters on non-custom paths).
- `src/cinematics/kart-a/venom_drake-{strike,summon,death,acid}.ts` (every .ts under src/cinematics
  is loaded: src/cinematics/index.ts). Each registers at the module top level under `if (LOOK_V3)`:
  - `registerStrike('venom_drake', venomMortarV3, { name: 'kart-a:venom_drake:strike' })`
  - `signatureSummon('venom_drake', …, { v3: venomMistV3 })` (summon-a/_kit.ts)
  - `registerCardHook('venom_drake', 'flip', …)` (optional, §5.1)
  - `registerCardHook('venom_drake', 'destroyed', …)` (§5.4)
- `src/audio/v3/venom.ts`.
- `src/duel/scenarios/kart_a_venom_drake.ts` (glob `./scenarios/*.ts` in src/duel/scenarios.ts line 252).

### 8.2 One-line additive edits in shared files (keep each next to the related entries)
| File | Edit |
|---|---|
| `src/art/monsters/index.ts` (line 35) | remove the token `'!../monsters-v3/venom_drake.ts',` once the new art passes the gates. (The v3 registry is only read under LOOK_V3; v1 is unaffected) |
| `src/audio/v3/materials.ts` | `GENERATED_HIT_MATERIALS = ['stone', 'venomscale'] as const;` |
| `src/audio/sounds.ts` | `import { V3_VENOM_RECIPES } from './v3/venom';` next to the dawn import, and `...V3_VENOM_RECIPES, // Zehir Ejderi (./v3/venom.ts)` next to `...V3_DAWN_RECIPES` |
| `src/audio/sfx.ts` | `import type { VenomSfxName } from './v3/venom';` + `\| VenomSfxName` in the `SfxName` union next to `\| DawnSfxName` |
| `src/cinematics/_v3/sound.ts` | the `venom_drake` block in `CHARACTER_SOUNDS` (§6) |
| `src/art/cardface-v3/index.ts` | `import venomDrake from '../cardart-v3/venom_drake';` + the `venom_drake: (p) => { p.blit(renderArt(venomDrake, 0).smallPx, 0, 0); },` entry in `ART` |
| `docs/v3/YENI_KARTLAR.md` §5.1 / §5.2 | add the venom rows (§6 and §5.4 above). The lane-doc owner does this; it is a doc edit, not code |
| `docs/v3/oturum-a.md` | the per-card status and evidence paths |

**v1 stays byte-identical:**
- Every registration is behind `LOOK_V3`.
- The v3 art, recipe, material and cut-in are read only under the v3 look.
- The sounds are new names that v1 never plays.
- No existing table value changes.
- Verify with the filmdiff gates (§9).

### 8.3 Scenarios: src/duel/scenarios/kart_a_venom_drake.ts (`kaVenom*`, with `look=v3&zones=5`)
| Key | Stage → step | Films |
|---|---|---|
| `kaVenomSummon` | p0 hand `venom_drake`, monsters `['stone_sentinel', null, null]`; p1 `[null, 'volt_lizard']` → normalSummon to zone 2 with the sentinel as tribute | the summon + cut-in + scar, P1 |
| `kaVenomSummonP2` | the same for p1 (active 1; tribute `ember_wolf`) | P2 relight, the cut-in P2 |
| `kaVenomRevive` | p0 hand `soul_recall`, graveyard `venom_drake` → `activateSpell … target: { kind: 'graveyard', uid, toZone: 1 }` (as `suRevive`) | the revive |
| `kaVenomFlip` | p0 monsters `[{ id: 'venom_drake', faceUp: false }]` → `{ type: 'flipSummon', player: 0, zone: 0 }` | the flip |
| `kaVenomPos` | p0 monsters `['venom_drake']` → `changePosition` ×2 (needs `posChanged` staging as in `position`) | toGuard / fromGuard |
| `kaVenomAtk` | battle; p0 `[null,'venom_drake']`, p1 `[null,'ember_wolf']` (2000 vs 1700) → attack 1→1 | mortar + holes + the target's death |
| `kaVenomAtkP2` | the mirror (p1 attacks p0's `ember_wolf`) | the P2 arc |
| `kaVenomDirect` | battle; p0 `[null,'venom_drake']`, p1 empty → attack 1→null | the spray, P1 |
| `kaVenomDirectP2` | the mirror | the spray, P2 |
| `kaVenomBlocked` | p1 `[null, { id:'stone_sentinel', position:'defense' }]` (DEF 2100) | the splash on the guard |
| `kaVenomDefKill` | p1 `[null, { id:'volt_lizard', position:'defense' }]` (DEF 1200) | attack on a defender that dies |
| `kaVenomLose` | p1 `[null,'crystal_wyrm']` → venom attacks and loses | the backlash + venom's melt death (attack position) |
| `kaVenomBoth` | p1 `[null,'coral_serpent']` (2000 vs 2000) | both die, the holed victim |
| `kaVenomDies` | p0 `[null,'crystal_wyrm']` attacks p1 `[null,'venom_drake']` | venom struck, death in attack position |
| `kaVenomDiesDef` | p1 `[null,{ id:'venom_drake', position:'defense' }]`, attacked by crystal_wyrm | the guardbreak death |
| `kaVenomHit` | p0 `[null,'stone_sentinel']` (ATK 500) attacks p1 `[null,{ id:'venom_drake', position:'defense' }]` (DEF 1500): venom survives (a struck guard). For hitHeavy use `kaVenomDies`; for hitMagic use `kaVenomMagic` | hit (guard), the guard flinch |
| `kaVenomMagic` | `judgment_bolt` on venom (as `spBolt`, with `mon(1,1)`) | the hitMagic path (the bolt owns the destroy: a check that nothing of ours runs) |
| `kaVenomScarStack` | venom attacks twice on the same tile over two turns (2 steps: attack, end turn ×2, attack again on a new `ember_wolf` set in the same zone) | the scar levels 1 → 2 and the bubble pops |
Keep the old `vd*` keys in mart_venom_drake.ts (do not edit: not this lane's file). Document the
new keys in the header like strikes-a.ts does.

---

## 9. Verification plan

Set these first:
`PW=PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-yugioh/0bb2f57e-e830-54e9-b1e3-c08756cc3a08/scratchpad/pwb`
and `S=<scratchpad>/kart-a/venom`. LOOK at every PNG with the Read tool.

1. **Reference frame gate (KK-1), before any anim:** draw idle f0 only, then
   `npx vite-node tools/monster-sheet.ts --id venom_drake --look v3 --anims idle --scale 6 --out $S/ref`.
   Compare it side by side with ashen_drake's, crystal_wyrm's and the coral serpent's (via `--art`).
   Have it critiqued: silhouette at 1×, the "C over a bar", the bulb as the brightest point, ≤ 20
   colours, isolated ≤ 1.1 × the reference.
2. **Sheets P1 + P2 (KK-2/3/6):**
   `npx vite-node tools/monster-sheet.ts --id venom_drake --look v3 --anims all --points --scale 3 --out $S/sheet`
   and the same with `--p2`.
3. **Gates:** `npx vite-node tools/monster-gates.ts $S/sheet/venom_drake-v3.json $S/sheet/venom_drake-v3-p2.json --class large --ref none`.
   Everything must pass:
   - margin ≥ 2 and 0 edge px
   - out ≤ 1.2, in ≤ 2.0, seam ≤ 1.4
   - idle max Δ ≤ 1.8×, liveliness ≥ 15 %
   - guard 0.3–0.8×
   - transitions ≤ 400 ms
   - noise: idle mean ≤ 10 %, body frames ≤ 15 %, effect frames ≤ 20 %
   - HA-21 and HA-21 phase < 50 %
   - feet band fixed
   - bytes ≤ 5 MB per side, ≤ 140 frames, ≤ 8 ms per frame
4. **Sameness (KK-15):** `npx vite-node tools/sameness.ts --look v3 --ids venom_drake,coral_serpent:v3,crystal_wyrm,ashen_drake --against all`.
   No KALIR. Read any UYARI pair's distinction cards and run the blind eye test
   (`--blind DIR --key-out KEYDIR`, then `--score`).
5. **Films (KK-8), at 1× and ×3 clips:**
   `$PW node tools/shot.mjs "?dev=duel&s=kaVenomAtk&look=v3&zones=5" --fresh --film 30 --every 80 --cols 6 --out $S/films/atk.png`
   for every `kaVenom*` key. Then zoom in with `--clip <x,y,w,h> --scale 3` on:
   - the glob arc
   - the holes (contact ±3 frames)
   - the puddle → scar
   - the summon gas (EF-2: the body visible through the 25 % pattern)
   - the cut-in band (under the tile)

   Check for: no empty frame, no foot slide, no full-screen wash, and no effect covering a silhouette
   > 50 % for > 2 frames.
6. **Timing (KK-7, SÜ):**
   `$PW node tools/measure.mjs --scenarios 'kaVenom*' --look v3 --out $S/measure.json`.
   Thresholds (game ms):
   - attack + death ≤ 3 190
   - direct ≤ 2 320
   - tribute summon + cut-in ≤ 4 350
   - destroy ≤ 2 030
   - revive ≤ 3 050
   - position ≤ 580; flip ≤ 870
   - number − contact = 0 ± 17 ms
   - declaration ≤ 0.3 s scene
   - LP ≤ 400 ms
   - `zoom.max` = 1 and `fracScrollFrames` = 0 (`--camera-gate`)
7. **On-screen contact (KK-4):** `$PW node tools/contact-probe.mjs --scenarios kaVenomDies,kaVenomHit,kaVenomAtk --png $S/probe`.
   The value must be < 50 % and ≤ the sheet value + 5 points, both for venom as a target and for
   the holed victims (the holes must not push the victim's contact frame over).
8. **Palette and white (EF-4, IŞ-11):** film with frames
   (`shot.mjs … --frames $S/frames/atk`), then
   `node tools/palcheck.mjs $S/frames/atk --clip 120,40,400,230`.
   Off-palette must be 0 % above frame 0 + 1 point, white ≤ 1.5 %, no full-width band.
9. **Sound (KK-12, SE-*):**
   - `$PW node tools/clip.mjs "?dev=duel&s=kaVenomAtk&look=v3" --out $S/clips/atk.mp4`. Do the same
     for Summon, Direct, Lose, Dies and Revive, and send the MP4s (the owner's ear is the judge).
   - The level line: true peak ≤ −1 dBFS, 0 clipped samples.
   - Mark sync from the `measure` sfx[] × anims[] at 1× and 3× (≤ 1 frame).
   - The SE-4 LSD table via an offline render (`renderSfx` in src/audio/sfx.ts) for each role
     against the existing sets.
10. **v1 identity and gates (PARALEL_OTURUMLAR):**
    - `npm run typecheck` clean
    - `npm test`: no new failures (the venom test is rewritten; known failures are dusk_ashen,
      hourglass_imp, shield_titan)
    - `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` → 17/17 IDENTICAL
    - `node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films` → 26/26 IDENTICAL
    - `git diff --stat` shows no `setScale` / `setAngle` added in the venom files
      (`grep -n "setScale\|setAngle" src/cinematics/kart-a/venom_drake-*.ts`)
11. **Critique rounds:** ≥ 3 rounds by independent critic agents (art, motion, sound, technical).
    Each round films, LOOKS, writes findings with rule ids, and fixes.

**Acceptance (in addition to the gates):** at 1× a stranger names it "a scorpion-tailed dragon". The
glob arc, the splat and the holes read in one viewing. The scar is visible but never louder than a
card on its tile. The summon gas never hides the body as a solid shape. Every sound is identifiable
with eyes closed as "acid / hiss".

---

## 10. Risks and open questions

1. **Permanent scars (owner decision needed).** The board keeps up to 8 etched scars for the whole
   duel. That is the flavor made literal, but it is a new rule in the presentation language (no
   other card changes the board permanently). The default in this plan is persistent, subtle and
   capped. The fallback is that only the death scar (level 3) persists and attack scars fade at the
   end of the turn. Also check that they never fight the tile highlight / target selection (they sit
   under `CARD_ON_TILE` and use only dark tones plus one rare 1-px bubble).
2. **Frame budget.** 132 frames × 36.8 KB is close to the "large" 5 MB line. If it is exceeded, trim
   idle to 16 f and guard to 6 f, or shrink the frame to 96×92.
3. **Size class vs ace craft.** Venom is an ace with a size-80 body. The tail arch makes it tall
   (≈ 74 px). Check Sİ-7 / EF-10 that the cut-in band and the neighbouring tiles' badges are not
   crowded, and check the arc apex vs the P2 HUD at the top-right (clamp the apex to y ≥ 40).
4. **Death material.** `shadow` (darken + pull) is the closest existing shatter preset. Its void pool
   accent is shared with abyss_magus / shade / dusk. Identity rests on the pose (the eaten hide, the
   skeleton) and the watcher's acid puddle and scar. If critics still read "void death", propose an
   additive `ShatterMaterial` `'acid'` in src/vfx/shatter.ts (a shared file: needs the orchestrator).
5. **Chartreuse vs grim_warden's green and the WIND attribute.** Venom light is leaf2–4 with a gold4
   core. R2 (lane B) plans pale `leaf3/leaf4` soul fire. Cross-check the films of both. If they
   collide, R2 keeps the pale green and venom leans yellower (gold3 in the glob body).
6. **Projectile vs "contact" mark.** The real contact is the cinematic's (the flight time). The attack
   anim's `contact`@9 is a planned frame. If `measure` shows the number ≠ contact, drive the
   number from `s.impact()` only (it already is) and do not wait on the anim mark.
7. **Holes overlay on another card's sprite.** The overlay follows the victim's frame. Death kits that
   swap sprites (judgment_bolt owning the destroy, guardbreak) must drop the overlay safely: watch
   `sprite.active/visible` every frame, as `crystalBreakV3` does.
8. **The special as the direct-attack motion** is a choice, not a rule. If the recipe layer or
   `measure` expects `attack` for direct attacks, keep the logic in the custom strike (it is). The
   generic declaration holds `attack` f1, so the direct path starts from attack f1 → special f1
   (both are the "rear + tail back" pose; keep them pixel-close, Δ ≤ 1× idleΔ).
9. **Old serpent files and their test.** Deleting `venom_drake-{body,build,fx,head,parts,types}.ts`
   breaks `src/art/cardart-v3/venom_drake.ts` and `tests/art/venom_drake.test.ts` until both are
   rewritten. Do all three in one commit.
10. **Sound collisions.** The weakest predicted pairs are `land` vs ashen_drake's (low thumps) and
    `roar` vs C9's 4 kHz "tsst" if the hiss is soloed. The 55 Hz gurgle must stay in every roar /
    hiss so the bimodal profile holds.
11. **Lane coordination.** Ashen (R1) and cloud_hatchling (C3) agents work in the same tree.
    `src/cinematics/kart-a/` may be shared as a folder, but each file is per card. Shared one-line
    edits (sounds.ts, sfx.ts, _v3/sound.ts, materials.ts, cardface-v3/index.ts) must be made with
    small anchored Edits so parallel additions do not collide.
