# Zehir Ejderi (`venom_drake`): v3 redesign blueprint (lane A)

KARANLIK / Ejderha · Sv5 · 2000/1500 · size class 80 · ★ ace (1 tribute → cut-in) · effect `none`
Flavor: *"Pullarından sızan zehir, geçtiği toprağı bir daha yeşertmez."* The card data stays the same
(src/data/cards.ts). Only the presentation is new: the sprite, every animation, the cinematics, the SFX,
the card art and the cut-in.

This document is the blueprint the builder agents follow. Every path, function and API below was
checked against the tree on 2026-10-31 (branch base 6178b55). Rule ids (IŞ, MA, Sİ, HA, SÜ, EF, SE,
KK) refer to docs/v3/REHBER.md. All ms are **scene ms** (the code's own durations). The game clock is
×1.35 (V3_TEMPO), hit-stop is ×≈1.55, and budgets are measured as REHBER §5 × 1.45 (docs/v3/TEMPO.md).

**Revision 2 (after critique round 1).** The changes are listed in the "Critique log" at the end. The
main ones: the venom colour is now acid yellow-green (`leaf3` body, `gold3` hot), the death is
self-corrosion into lace with the stinger standing as a grave marker (there is no skeleton), the scar
store lives at module level, and only the death scar lasts the duel until the owner decides (§10.1).
The sound has no `growl`, and its hiss never sweeps in pitch. The rattle is a `v.bursts` click train,
and the struck body uses a new `'crackle'` ring. The guard keeps the far knuckle planted. The revive
starts with a falling glob, and the art registers under a new filename.

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
  "sludge" idea was right, but it was drawn as a puddle-coloured version of the body.
- **There is no signature.** The attack is a short green dribble from the mouth. Nothing about it
  could not belong to any other monster.

**The cure.** Give it a silhouette that no other card has. Separate the BODY colour (dark violet)
from the VENOM colour (acid yellow-green: `leaf3` body, `gold3` hot, `gold4` core) so the venom glows.
Make corrosion the signature: venom eats holes into its victim and leaves dead ground on the board.
In its own death, the same acid eats the drake into lace. That is the flavor text made literal.

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
| Anchor | (48, 86): the ground line between the hind feet (x 34–44) and the planted wing-knuckles (near x 56–61, **far x 63–68**). `GY = 86` |
| Ground contact rule (HA-9 / KK-5) | The gate (`feetBand`, tools/lib/framelib.ts) compares the opaque x range of the bottom 6 rows with idle f0 in idle / guard / toGuard / fromGuard. The **left end is the near hind foot (x 34)** and the **right end is the FAR wing-knuckle (x 68)**, and both stay planted in all four anims. The near knuckle sits inside that range, so it may lift (guard, hits). Nothing else may enter rows 81–86 outside x 34–68 |
| Hover | 0 (hind feet and the far knuckle planted; HA-9) |
| Weight | `medium` (hit-stop 60–80, shake 2 px, recover 280 "steady"; HA-8 ordering: charge→release 440 ms < the wyrm's 460) |
| Facing | right (P2 = flipX + `p2: 'relight'`) |
| Key layout at idle f0 (P1) | hind feet y 86 at x 34–44; knuckles y 86 at x 60–68; barrel back line y ≈ 52; head low and forward, snout tip ≈ (90, 58), eye ≈ (82, 52); throat sac under the jaw ≈ (80–86, 60–66); tail root ≈ (24, 54) → arch apex ≈ (30, 12) → **bulb centre ≈ (56, 16)**, stinger tip ≈ (64, 21) pointing forward-down |
| Margins | ≥ 3 px at idle; the attack wind-up pulls the bulb back to x ≈ 26 and the release throws it to x ≈ 84, y ≈ 20, both inside the frame with ≥ 2 px (Sİ-2) |

**Materials, ramps (palette.ts only; IŞ-11 ≤ 20 colours per frame):**

| Material | Tones (dark → light) | Notes |
|---|---|---|
| **Hide** (new material `venomscale`) | `PAL.night0` underside / creases · `void0` shadow · `void1` mid · `void2` lit · `void3` 1-px lit edge only (IŞ-8) | Deep oily violet-black. The largest lit plane (back, top of head, top of the tail arch) is calm `void2`. Scale rows are 2-px `void0` teeth every ≈ 5 px, only on the mid/shadow boundary (the serpent rule, MA-2) |
| Rim light (IŞ-7) | `leaf1` (one colour) | The toxic under-glow: a 1-px rim on the shadow side, as if lit by the venom. P2 uses the same tone |
| **Bone / chitin** (claws, horns, the last 2 tail segments, the stinger hook, belly plates) | `stone1` shadow · `stone2` mid · `stone3` lit · `stone4` 1-px edge | Belly plates are a band of `stone2` with `stone1` seams every 3 px. The chitin (stinger + bulb casing) is the only part that survives the death (§5.4) |
| **Membrane** (folded wing cape) | `void0` web · `void1` lit panel · `night0` crease; **2–3 eaten holes** (real transparent holes in the silhouette, 2–3 px, ringed by a 1-px `leaf1` edge) | Holes are a silhouette detail visible at 1×. One fold line per panel (the glass rule). These holes foreshadow the death |
| **Venom** (light, drawn after the outline, never outlined: IŞ-9) | `leaf2` deep · `leaf3` body · **`gold3` hot** · **`gold4` core pixel** | **Acid yellow-green.** palette.ts has no chartreuse: `leaf3` (0x6ed759) is grass green and `leaf4` (0xc9f7a1) is pale mint (and `leaf3` is WIND's `ATTRIBUTE_COLOR`). The hot band therefore goes to yellow (`gold3`), which makes the venom read sour-yellow rather than mint or wind. **`leaf4` is not used anywhere on this card** (not in the venom, the floor glow or the hit flash). Used on the bulb, the sac interior, the bead on each quill, drops, and the seams on `dissolve` |
| Eye | `gold2` 1×2 px with a 1-px `ink` vertical slit | Must stay dimmer than the bulb's `gold3` ring and `gold4` core, and it must not use the hot venom tone |

**Brightest point:** the venom bulb's single `gold4` core pixel inside a `gold3` ring, with a `leaf3`
body around it (the cut-in's lens glint and the card art's focus too). The sac is second (`leaf3` with
one `gold3` pixel), the eyes third (`gold2`).

**P2 relight notes:** draw P2 with `{ lightFrom: 'right' }` (as ashen_drake.ts / crystal_wyrm.ts
`render()` do with `setLight`). Hide planes, chitin and membrane panels swap lit / shadow sides. The
venom, eye, sac and holes are self-lit or absent, so they are identical in both sets (IŞ-2). The
`leaf1` rim stays on the side away from the screen light.

**Why it is not ashen_drake (lane A sibling, R1):** ashen is a tall, hunched **vulture** perch in
ash grey and ember orange with an S-neck hanging DOWN, a tail TRAILING behind into a brazier, and
wings worn like a cloak on the shoulders. Venom is a LOW, WIDE crawler in violet and acid yellow-green with
its wings planted as forelegs and its tail ARCHED UP AND FORWARD over the head. Ashen's identity is
ash, ember, heartbeat and delayed ignition. Venom's is acid, holes, fizz and scars. Their deaths also
differ in material: ashen crumbles into ash and shows a bare heart in its ribs, while venom has **no
bone and no rib cage on screen at any time**: it is eaten into lace and leaves only its stinger. The
lane-A agents must cross-check the two sheets side by side once both idle f0 exist (KK-1).

**Why it is not cloud_hatchling (lane A sibling, C3):** C3 is a small, round WIND baby dragon in the
`leaf` ramp with mist and white, a chirp and a rising ring whistle. Venom keeps the leaf greens to its
darker bands only (`leaf1` rim, `leaf2`/`leaf3` venom), puts the hot band in yellow (`gold3`), never
uses `leaf4` or white mist, and never sweeps a whistle (§6).

---

## 2. Distinction card (the `distinction` field of the art module)

```ts
distinction: {
  silhouette: 'a LOW wide wyvern on four points (two thick hind legs + two wing-arms planted on the knuckles, membranes folded as a ragged cape) with a tall SCORPION ARCH of tail rising off the rump and curling FORWARD over its own back, a swollen venom bulb and hooked stinger poised above its head; a translucent throat sac under a long low jaw; a row of hollow weep-quills on the spine — "a C curled over a bar"',
  rhythm: 'stalk and sting: a trembling, swelling wind-up (the bulb pulses three times, the tail draws back over the rump), a 50 ms whip over the head, then a held, watching follow-through while the glob is in the air; reactions are short flinches with a rattle',
  idle: 'breath in the barrel, the throat sac pulsing on its own period, the tail arch swaying the bulb ±2 px a beat behind the rump, the head scanning low, a bead of venom swelling on the fang and falling to the floor where it hisses, one weep-quill beading at a time down the spine',
  guard: 'it sits back on its haunches; the NEAR wing-arm lifts and folds forward over the head into a holed membrane shield while the far knuckle stays planted; the tail lowers over it with the stinger cocked above the shield rim, still glowing',
  signaturePart: 'the venom bulb (gold4 core, gold3 ring, leaf3 body) on the scorpion arch: the brightest point of the card',
  material: 'oily violet-black scales (void ramp) seeping acid yellow-green (leaf2, leaf3, gold3 + gold4 core) from their seams; bone-grey chitin (stone) for claws, horns and stinger; the death is self-corrosion: its own acid eats the hide into lace, only the chitin stinger stands in the pool like a grave marker, and an etched scar stays on the tile',
  signatureMove: 'the venom mortar: the tail flings a glob in a high arc; it splats, clings and EATS HOLES into the victim (stepped holes with acid rims and steam, heard as three dry fizz ticks in a held-breath silence), and the floor where it splashed is etched',
},
```

Nearest existing cards and how this one differs:

| Card | What is shared | What makes venom different |
|---|---|---|
| crystal_wyrm (ace dragon) | dragon, ace, ranged | Wyrm: upright biped, a beam from the mouth, glass and light. Venom: a low quadruped wyvern, a projectile lobbed from the TAIL, acid that eats. Colours do not overlap (cyan / white vs violet / acid yellow-green) |
| ashen_drake (R1) | DARK dragon, lane A | See §1. Ash cone + delayed ignition vs glob + corrosion. Vertical vulture vs low crawler. Death: ash heap with a bare heart in the ribs vs lace + standing stinger (no bone shown) |
| cloud_hatchling (C3) | dragon, lane A, green tones | C3: small round WIND hatchling, `leaf` ramp + mist + white, chirp and a rising whistle, a re-knit egg death. Venom: size 80, violet-black, green only as dark venom light with a yellow hot band (no `leaf4`, no white mist), a bimodal gurgle + static hiss, no pitch sweeps |
| coral_serpent | the old plan | No coil, no S-neck, no jet. The arch is a tail, not a neck |
| volt_lizard | four-legged reptile with a raised tail | Volt is small, gold and electric with its tail BEHIND. Venom is size 80, violet, with the arch OVER the body and wings as forelegs |
| thorn_lurker | green / poison feel | The body is no longer green. Green appears only as light (venom) |
| magma_titan / stone_sentinel (throw) | lobbed projectile | Theirs is a boulder or magma rock from the hand. Venom's is a liquid glob from a stinger with a dripping trail, a splat and holes |
| grim_warden (R2) | green light | Warden's ghost fire is pale green (`leaf3`/`leaf4`) with white. Venom never uses `leaf4` or white and its hot band is `gold3`, so it reads sour-yellow and liquid, not pale flame. Cross-check the R2 lane's sheet |

---

## 3. Rig approach

**Decision: a hand-made rig with a G-buffer pipeline, following crystal_wyrm / ashen_drake (ace
craft), built on the shared `src/art/rigkit` primitives. Do NOT use a body plan.**

Why:
- No plan exists for a wyvern-quadruped with a forward tail arch. `src/art/bodyplans/` holds only
  `biped`, and the serpent plan is what failed.
- The signature parts need part-level control that only a hand rig gives: an arch whose bulb is a
  point every frame, membranes with real holes, a sac that swells, and a death that eats the hide
  into lace while the chitin stinger survives.
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
| `src/art/monsters-v3/venom_drake-rig.ts` | `Pose` type + `drawWyvern(p, pose)`. Skeleton (for posing only, never drawn): hip, barrel, shoulder; 2 hind legs (IK to fixed feet); 2 wing-arms (IK to the knuckles; the far knuckle is fixed in idle/guard/transitions, the near one may lift; elbow → wrist → 3 finger bones carrying the folded membrane); a haunch-sit parameter (0–2 px, the hips drop back over the fixed hind feet: guard); neck (3 joints) → head (jaw angle, eye open/slit/shut, sac inflation 0–3); a **tail chain of 9 segments** (7 hide + 2 chitin) with a per-segment bend + the bulb (swell 0–3, glow 0–3) + the stinger hook; 5 weep-quills (bead size 0–2 each). Death / revive passes: `seamGlow(k)`, `eatHoles(step, seed)` (step 0–3: **the same hole generator as the victim holes in venom_drake-acid.ts**, applied to this drake's own hide in part space; step 3 leaves a lace of ≈ 35 % of the hide in 1–2-px strands with `leaf3` rims), `slump(k)` (the lace sags into the pool), `puddle(k)`, `stingerMarker(sink)` (the 2 chitin segments + bulb casing standing upright in the pool, sink 0–3) |
| `src/art/monsters-v3/venom_drake-anims.ts` | Pose tables for every anim, holds, marks, `ANIMS`, `EXTRA_ANIMS`, `IMPACT`, `drawPose(anim, frame)`, `framePoints(anim, frame)`, `MUZZLE`; the exported beat frames `BEATS = { swell: [2,3,4], whip: 5, watch: 8, spread: 9, cut: 10, lace: 6, marker: 8 … }` for the cinematics (like crystal's `SPREAD_F` / `CUT_F` and the sentinel's `BEATS`) |
| `src/art/monsters-v3/_venom_drake-wyvern.ts` → renamed to **`venom_drake-wyvern.ts`** at registration | The MonsterArt: `id: 'venom_drake'`, `w/h`, `anchorX 48`, `anchorY 86`, `hover 0`, `muzzle`, `core`, `anims`, `attackImpactFrame`, `weight: 'medium'`, `p2: 'relight'`, `draw` / `extraAnims` / `drawExtra` / `points`, the `distinction` card (§2) as an exported constant, and the header comment (anim list, the frame, the Sİ-5 waiver). **Why this filename:** `src/art/monsters/index.ts` line 35 is a single line shared with lane B (`wisp_imp`). The registry keys on `art.id`, not the filename (index.ts lines 37–41), so the new art is registered under a new filename and **that line is never touched**. The `_` prefix keeps the work-in-progress file out of the registry (the `'!../monsters-v3/_*.ts'` rule) while it is drawn with `monster-sheet --art`. When the §9 step 1–3 gates pass, the builder renames it (its own file) and from then on it is live in v3. The old `'!../monsters-v3/venom_drake.ts'` exclusion then points at a deleted file, which is harmless. No other `venom_drake-*.ts` helper may `export default` an object with an `id` |
| `src/art/materials/defs/venomscale.ts` | MaterialDef `venomscale` (status `draft`, firstUser `venom_drake`), complete (see the block below) |
| `src/art/cutins-v3/venom_drake.ts` | The 200×144 ace portrait, `p2: 'relight'`, `holds` (§7) |
| `src/art/cardart-v3/venom_drake.ts` | REWRITE (today it imports the deleted `venom_drake-head.ts`) |
| `src/presentation/cards/venom_drake.ts` | The recipe (§8.1) |
| `src/cinematics/kart-a/venom_drake-strike.ts` | `registerStrike` (mortar, direct spray, blocked, lose) |
| `src/cinematics/kart-a/venom_drake-summon.ts` | `signatureSummon` v3 entrance + flip handler |
| `src/cinematics/kart-a/venom_drake-death.ts` | `registerCardHook('venom_drake','destroyed', …)`: the corrosion watcher + the puddle + the stinger marker + the scar |
| `src/cinematics/kart-a/venom_drake-acid.ts` | The shared visuals of this card (not exported to others): `drawGlob(px, at, vel, frame)`, `holeMask(seed, step)` (shared with the rig's `eatHoles`), `acidHoles(u, at)` overlay, `steamThreads`, `splatCrown`, and **the scar store** (§5.0: a module-level `Map`, not `ctx.keep`) |
| `src/audio/v3/venom.ts` | `V3_VENOM_RECIPES`, `type VenomSfxName`, `V3_VENOM_SUSTAINED` (§6) |
| `src/duel/scenarios/kart_a_venom_drake.ts` | QA scenarios (§8.3) |
| `tests/art/venom_drake.test.ts` | REWRITE for the hand rig, importing `../../src/art/monsters-v3/venom_drake-wyvern` (`_venom_drake-wyvern` before the rename). It checks: validateArt clean at tier `ace`; all anims and marks; the muzzle on every frame; the feet band fixed in idle/guard/toGuard/fromGuard; the P2 relight silhouette equal when mirrored; the death leaving < 10 % of idle opaque at the last frame; **special f0 and f1 each within 1× idleΔ of attack f1** (the direct-attack seam, §4 special); and the card art painting at both sizes inside the palette |

**Files to DELETE** (only after the new art draws and the card art no longer imports them):
`venom_drake.ts` (the old MonsterArt), `venom_drake-body.ts`, `-build.ts`, `-fx.ts`, `-head.ts`,
`-parts.ts` and `-types.ts` in `src/art/monsters-v3/`. There is no skeleton file: the death shows no
bone (§5.4).

Budget (KK-13). Venom's tier is ace, and KK-13 and `monster-gates` define an ace class (≤ 7 MB
uncropped per side), so run the gates with `--class ace`. **The orchestrator must confirm the ace
class versus the size class "large" (≤ 5 MB)**, and the plan fits both. With 100×92×4 B = 36.8 KB per
frame, the anim list below is **133 frames ≈ 4.89 MB** per side. The hard cap is ≤ 140 frames, so
there are 7 frames of headroom. Spend them only on the death and revive holds, never on idle. Paint P2
lazily (the existing warm path). Keep every frame ≤ 8 ms to draw.

**`venomscale` MaterialDef** (every required field of `MaterialDef` in src/art/materials/types.ts):
```ts
export default {
  id: 'venomscale', status: 'draft', firstUser: 'venom_drake',
  draw: {
    ramp: [PAL.night0, PAL.void0, PAL.void1, PAL.void2], th: [-0.85, -0.2, 0.45], farShift: 1,
    seam:   { [PAL.void3]: PAL.void2, [PAL.void2]: PAL.void1, [PAL.void1]: PAL.void0, [PAL.void0]: PAL.night0, [PAL.night0]: PAL.night0 },
    crease: { [PAL.void3]: PAL.void1, [PAL.void2]: PAL.void0, [PAL.void1]: PAL.night0, [PAL.void0]: PAL.night0, [PAL.night0]: PAL.night0 },
    edge: { hi: PAL.void3, lo: null, lit: 0.4, dark: -0.35 },     // 1-px lit edge only (IŞ-8)
    rim: PAL.leaf1,                                              // the toxic under-glow (IŞ-7)
    glint: null,                                                 // the bulb is the only bright point
    texture: { kind: 'scales', density: 5 },
    emissive: { tones: [PAL.gold4, PAL.gold3, PAL.leaf3], pulse: 'breath' },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.gold3], debris: 'drop', flash: PAL.gold3 },
  death: { shatter: 'shadow', accent: 'shadow', pass: 'dissolve', revive: 'gather' },
  matter: [PAL.void0, PAL.void1, PAL.leaf1, PAL.leaf2, PAL.leaf3],
  sound: { thump: [120, 55, 0.5, 0.1], surf: [5600, 0.2], ring: { kind: 'crackle', hp: 6500, rate: 260 }, sizzle: 7000 },
  light: { glow: PAL.leaf3, pool: PAL.leaf3 },
} satisfies MaterialDef;
```
The seam and crease tables stay inside the hide ramp (never `ink` inside the body, IŞ-9). `matter` is
the hologram onset ramp of the revive gather. The sound's `'crackle'` ring is new (§6, materials.ts).

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
- `feet` = (48, 86), fixed in every frame (the KK-5 `points().feet` check).

### idle: 18 f, ≈ 2.0 s loop
Holds: `110 120 130 120 110 100 110 120 140 110 120 130 120 110 100 110 120 140` (they slow at the
breath peaks, HA-5).
- Barrel breath: period 9 f (down 1 px at f3–f5 and f12–f14). The hind knees take the load, and the
  hind feet and both knuckles do not move (HA-9).
- Throat sac: period 6 f, inflation 0 → 1 → 2 → 1, phase +1 frame behind the barrel.
- Tail arch: period 18 f. The rump leads, the mid arch is +1 frame behind, the bulb +2 frames. The
  bulb drifts x ±2, y ±1. The bulb's glow steps 1 → 2 → 1 on its own period of 9 f (out of phase with
  the sac).
- Head: a slow low scan over 18 f (±1 px, a tilt drawn by the jaw / eye map), +1 frame behind the
  barrel. One blink-to-slit at f8.
- Membrane cape: settles +2 frames after the shoulder (drape).
- **Fang drip:** a bead swells on the fang f0–f11 (1 → 2 → 3 px), falls f12–f14 (the drop is drawn
  in the sprite down to y 85, x inside 34–68 so it never widens the feet band), splashes f15 (a 3-px
  crown), and leaves a 1-px `leaf1` etch dot that steps out f16–f17. The loop seam is clean. Sound:
  **none in this round**. No idle or ambient sound hook exists in the tree (`CHARACTER_SOUNDS` has no
  idle role, and no `idleSfx` path exists). If the orchestrator adds one, the drip's splash at f15
  plays `venomDrip` at ≤ 0.08, at most once per loop and only for the first venom on the board.
- **Weep-quills:** one quill beads at a time, front to back, 3 frames each (6 quills → 18 f).
- Targets: idleΔ / opaque ≥ 15 % (HA-18), max Δ ≤ 1.8× (HA-17), seam ≤ 1.4, isolated mean ≤ 10 %.
  The HA-21 phase rule (max over idle k of Δ(idle k, f0)/opaque < 50 %) is easy with this loop. Keep
  the bulb swing ≤ 2 px.

### guard: 8 f, ≈ 1.2 s loop: "Delik Kalkan" (the holed membrane shield)
Pose: **it sits back on its haunches** (the hips drop 2 px back over the planted hind feet; the feet
do not move). The **far wing-arm stays planted on its knuckle** (x 63–68, the right end of the feet
band) and braces the body. The **near wing-arm comes off the floor**, rises and folds forward over the
head, and its membrane spreads as a sloping shield toward the viewer and the enemy with the eaten
holes showing. (On a wing-arm the wrist is at the knuckle, so the shield wing cannot lift while its
knuckle stays planted. The critic's finding was right, and only the far knuckle is planted now.) The
head is tucked behind the shield and the eye shows through one hole. The tail lowers forward over the
shield rim, with the stinger cocked above it and still glowing.
Holds: `160 150 150 160 160 150 140 150`. One part changes per frame (as the wyrm's guard): membrane
fills → chest sinks 1 px → shield rim drops 1 px → stinger twitch → sac pulse → membrane relaxes →
chest → stinger. Guard Δ = 0.3–0.8 × idleΔ (HA-19). Feet band: bottom 6 rows x 34..68, y 86, the same
as idle f0 in every frame (the lifted near knuckle sits inside that range, so it does not change it).

### toGuard: 6 f, 360 ms · fromGuard: 6 f, 360 ms (HA-20 / HA-29)
- toGuard holds: `50 60 60 60 60 70`.
  - f1: the hips sit back.
  - f2: the near knuckle peels off the floor (the in-between: the arm at 45°, the tail halfway down;
    the head stays clear of the sweep).
  - f3–f4: the arm folds over the head and the membrane opens.
  - The last frame equals guard f0.
- fromGuard: the reverse path with its own in-between. The tail rises first, then the near wing drops
  and its knuckle plants back at x 56–61, then the hips rise. Holds `50 60 60 60 60 70`, ending on
  idle f0.
- The hind feet and the far knuckle never move. The near knuckle's path never goes left of x 34 or
  right of x 68 below y 81.

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
- f3 the jaws gape (a hiss, with the sac flashing `gold3`).
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
bulb and quill beads go `gold4`/`gold3`, the seams show `leaf3` for one frame), the eye blazes `gold3`, and
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

### death: 11 f, 990 ms: "Kendi Zehri" (self-corrosion) (`impact` = `contact`@0, `dissolve`@3)
Holds `50 60 60 70 70 70 180 80 180 80 90`. It continues from hitHeavy f0 (posematch). **No bone is
ever shown.** The acid it puts on its victims eats the drake itself. The hole generator is the same
one (`holeMask`, shared by the rig and venom_drake-acid.ts), so the attack and the death rhyme.
- f0: struck (= hitHeavy f0).
- f1: the reel; the eye shuts.
- f2: the hind knees buckle and the barrel drops 3 px. The **tail arch locks rigid** (a venom spasm:
  the arch does not topple; it stays up while everything under it fails).
- f3 `dissolve`: **its own venom breaks out of every scale seam**: a `leaf3` seam web with `gold3`
  nodes at the junctions over the hide, self-lit.
- f4: **holes, step 1**: 6–8 round holes (2–3 px, real transparency, `leaf3` rims) open where the
  seam nodes were. The membrane cape is holed first.
- f5: **holes, step 2**: the holes join. The cape falls away in two lace rags and the barrel's
  outline breaks into gaps.
- f6: **holes, step 3 = the lace (HOLD 180 ms)**. The whole silhouette is a lace of 1–2-px violet
  strands with acid rims, and the floor shows through. Only the chitin (the last 2 tail segments, the
  bulb casing and the stinger) is intact, still on its arch above the lace. This is the "eaten"
  picture, and it must read at 1×: a dragon shape made of holes.
- f7: the lace **slumps** straight down into a boiling pool around the feet (`leaf1` rim, `leaf2`
  surface, `void0` depths, 2 `leaf3` bubbles). The tail's hide segments go with it, so the chitin
  tip drops, rights itself, and ends standing **upright in the pool** with the stinger hook pointing
  up and the bulb glow at 1.
- f8: **the stinger marker (HOLD 180 ms)**: the pool (≈ 30×8 px) with the chitin stinger standing in
  it (≈ 4×16 px) like a grave marker, with one bead of venom on the hook. Nothing else stands.
- f9: the stinger sinks halfway; the bead falls into the pool.
- f10: last frame: the pool with the hook tip only (≤ 6 px tall).
The kit breaks this last frame as `shadow` matter (it darkens and is pulled to the floor point, which
reads as "sinking into the pool"). The watcher's puddle and scar take over (§5.4).

### revive: 11 f, 990 ms (`land`@7)
Holds `80 80 90 120 70 70 80 60 100 110 130`. This is **the death reversed** (HA-28), and it starts
with a fall from above, not a climb out of the floor:
- f0: an empty frame of the pool (the cinematic's hovering glob is above it, §5.1).
- f1: the glob has fallen: a splat, the pool spreads to 34×9 px, and the crown drops are in the sprite.
- f2: the stinger rights itself out of the splat (the reverse of f9 → f8).
- f3: **the lace (HOLD 120 ms)**: the drake's lace stands up from the splat in one frame, as the
  reverse of the slump. It reads as acid pouring UP the old shape of the drake.
- f4–f5: the holes close in 2 steps (the reverse of the hole steps), with the seam web glowing.
- f6: the hide is whole; the seams go dark from the head to the tail.
- f7 `land`: the near knuckle slams down and plants.
- f8: the first breath (the sac inflates 2).
- f9–f10: the bulb ignites → idle f0.

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

**The seam with the declaration (no pose pop).** The generic declaration holds attack f1. **Special f0
is drawn as attack f1, pixel for pixel**, and special f1 differs from it by ≤ 1× idleΔ (it begins the
rear). The art test asserts both (§3). The direct strike then plays `special` from f1 with no jump.

### victory
Not drawn (nothing plays it today, REHBER §10.4). Optional later: the roar pose held.

**Frame total:** 18+8+6+6+14+12+6+7+7+15+11+11+12 = **133** (≈ 4.89 MB per side, under both the
ace 7 MB line and the large 5 MB line). The idle is not trimmed. The 7 frames of headroom up to the
140 cap are reserved for the death and revive, for example a second lace frame if the 1× read needs it.

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
- The floor glow colour is `leaf3` with a `leaf2` spill, and the hot flashes are `gold3` (never
  `leaf4`). Its first stepped tone on the navy floor is `leaf0`, a sickly dark green. Check it at ×3
  against the night floor (the sentinel lesson about mud tones).
- Light handles: `followLight` takes a single radius and intensity at creation. Every "radius
  a → b → c" or "intensity a → b over n ms" below means the returned `LightHandle`'s
  `setRadius(rx, ry?, ms)` and `setIntensity(k, ms)` (src/view/light/LightLayer.ts), called on the
  named frames.

### 5.0 The glob, the holes and the scar (venom_drake-acid.ts)
- **Glob (projectile, matter):** 7×6 px. A 1-px `ink` outline, a `leaf2` body, a `leaf3` lit upper
  side, a `gold3` highlight and a `gold4` core pixel. 3 hand-drawn shapes (round, stretched along
  the velocity, squashed) are picked by the velocity octant; no rotation.
  - It wobbles: it alternates shape every 2 frames.
  - **Shadow:** a 5×1 `night0` dash slides on the floor under it (it reads the arc).
  - **Trail:** every 40 ms one 1-px drop falls (gravity 520 px/s²) to the floor. Where it lands,
    a 1-px `leaf1` etch dot appears, plus one `stone3` steam pixel that rises 3 px and is gone in
    400 ms. The dots step out over 1.2 s (they are not part of the permanent scar).
- **Splat crown:** 8 radial drops (`leaf3`/`gold3`, 1–2 px, gravity) and a stuck splat blob drawn on
  the target's overlay at the contact point.
- **Acid holes (the signature):** `acidHoles(u, at)` adds an `overlay(u, pc)` (strikes-a/_kit.ts
  `overlay`, as crystal's cracks use) on the struck unit.
  - The holes grow from the contact point in **3 steps at 80 ms each**, on the target's opaque
    pixels only, from the shared `holeMask(seed, step)`. Coverage ≤ 6 % / 10 % / 12 % of the
    silhouette at power 1 / 2 / 3: local, inside EF-3's flash budget.
  - **Hole fill.** An overlay cannot cut a real transparent hole into another card's sprite, and
    `ink`/`void0` holes vanish on dark victims (abyss_magus, shade_assassin, dusk_sorcerer). So each
    hole is filled with **the floor tone behind the victim at that hole's screen y**: `night1` or
    `night2`, whichever tone the arena floor uses at that row. layout.ts has no floor-tone table, so
    the builder takes the row → tone rule from the board floor painter (src/view/board-calm/art.ts)
    and copies it into a tiny local function, rather than sampling the canvas at runtime. Each hole gets a 1-px `leaf3` rim and one `gold3` pixel
    on its lower lip. On any victim it reads as "I can see the floor through it". `kaVenomAtkDark`
    (§8.3) films it against abyss_magus.
  - Steam threads rise from the holes: 2-px columns stepping `stone3` → `stone2` → `night3`, up
    10 px, 3–5 of them, each lasting 300 ms.
  - If the target survives, the holes close in 3 steps over 300 ms after its `recover` mark.
  - If it dies, the overlay follows the target's frame until the kit hides the sprite on its burst
    frame (the watcher pattern of `crystalBreakV3`), so the victim dies holed.
- **Scar ("Zehirli Toprak"):** `scarTile(scene, key, at, level, life)`, where `life` is
  `'duel' | 'brief'`.
  - **Storage: module level, NOT `ctx.keep`.** `Director.dropKept()` (src/cinematics/_core/
    Director.ts lines 140–155) destroys every kept handle at the end of each batch unless a decision
    is pending, so a kept scar would vanish as soon as the attack batch ends. venom_drake-acid.ts
    therefore owns `const SCARS = new Map<string, { r: Raster; level: number; life: 'duel' | 'brief'; born: number }>()`
    keyed by `'<p>:<zone>'` or `'podium:<p>'`.
    - On the first scar of a scene it registers `scene.events.once('shutdown', clearScars)`. It also
      registers `onDuelStart(clearScars)` (src/duel/seeds.ts) at module load, as crystal's `r3`
      counter does. `clearScars` destroys every Raster and empties the map.
    - It never uses `ctx.keep` or `ctx.take`.
  - **One ticker per scene.** The bubble pops and the brief-scar step-outs run from a single `onFrame`
    ticker per scene (strikes-a/_kit.ts `onFrame`, scene clock), started with the first scar and
    stopped by `clearScars`. There is no per-scar timer.
  - **Depth and placement: `DEPTH.TILE_FX - 1` (= 39).** It sits under the tile glows, selection
    highlights and floor circles (`TILE_FX` = 40, src/view/layout.ts line 434), so a scar can never
    cover a targeting highlight, and over the stepped floor (the `floorCracks` pattern of
    src/cinematics/recipe/setpieces/rockAssembly.ts). It is drawn on the **front half of the tile
    diamond and on its front rim**, never at the centre, because the centre is under the card lying
    on the tile (depth 50), which would hide a level-1/2 pit whenever a monster survives there. The
    level-3 blot reaches under the card's front edge but keeps ≥ 6 px of the rim visible.
  - **Levels.** Level 1 is 3 etched pits along the front rim. Level 2 adds a dead blot (an iso ellipse
    16×6 on the front half, `stone0` with a `leaf0` 1-px rim). Level 3 (the death) is an iso ellipse
    26×10, `stone0` core, `night0` cracks, a `leaf0` rim, and one dead stalk glyph in `stone2` (no
    green). A tile's level only rises (max 3).
  - **Lifetime (owner decision pending, §10.1). Default until the owner answers:**
    - only the **death scar (level 3) is `'duel'`**: it lasts the duel;
    - attack, direct, blocked and summon pits are **`'brief'`**: they hold for 2.4 s of scene time
      after they appear, then step out in 3 frames (level 2 → 1 → 0, 100 ms each).
    - The brief scars are timed rather than tied to the end of the turn, because the turn hooks
      (`V3HOOKS.turnStart`, src/cinematics/v3small/_hooks.ts) are frozen and owned by lane A6-B. A
      timed step-out reads as the aftermath of the splash, with no rule meaning.
    - One flag, `VENOM_SCARS_PERSIST = false` in venom_drake-acid.ts, switches every scar to
      `'duel'` if the owner says yes.
  - **Living detail, capped.** Every 2.4–3.6 s (seeded, on the scene clock) one 1-px bubble pops on
    a `'duel'` scar: 1 px → a 3-px plus → gone over 3 frames.
    - **At most 2 scars bubble at a time**: the 2 most recent. Older ones stay still.
    - The bubble is `leaf2` with a `leaf3` centre pixel only in the middle frame. It must stay
      **dimmer than any tile highlight**. Check the luminance against the TILE_FX highlight tone in
      the `kaVenomScarStack` select frame.
  - **"The scar remembers."** If venom's glob or drops land on a tile that already carries one of
    its scars, the old pits light up (`leaf3` → `gold3` → `leaf3`, 3 frames of 50 ms) with a
    `venomDrip` pitch ladder (1.0 / 1.12 / 1.26 at volume 0.25, 50 ms apart) just before the new
    splat. This is presentation only: it rewards the mark with no rule meaning.
  - Global cap: 8 scars (the oldest `'brief'` one is dropped first). Only under `LOOK_V3`.

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
| ≈ 890 (f9 peak) | The tail unfurls. **The bulb ignites**: a `lightFlash` at the `staff` point, `gold3`, radius 22, 280 ms, plus a 1-px `gold4` plus-glint on the bulb (3 frames) | | without a cut-in: `venomRoar`; with one: a quiet `venomDrip` (0.5) |
| ≈ 950 (f10 hold) | `await S.climax()`: the **cut-in** (§7; flare 280 / slam 360 / exit 720 / close 120 = 840 ms). The band passes under the tile (EF-10). The pose plays on f10 → f14 under it | | the cut-in's eye flare plays `venomRoar` (CHARACTER_SOUNDS.roar) |
| ≈ 1 670 (band exit) | **Finale = Zehirli Toprak**: `S.finale({ ring: 90, ramp: [void0, leaf0, leaf1, leaf2, leaf3], freezeMs: 50, shake: 2, sfx: null })`. The kit's own defaults for a big summon are a 4 px shake and a hard-coded `sfx` at volume 0.75 (summon-a/_kit.ts lines 549–560), so both are overridden: medium weight shakes 2 px, and **`venomScar` owns the beat** (no `summonBurst`). At the same time an **etch ring** spreads from the feet in 3 steps (60 ms each, a jagged iso ring of `night0` cracks with a `leaf1` lip, the `floorCracks` style). It leaves a **brief scar level 1 on its own tile** (§5.0). The badge pops; `bg(circle.dismiss(420))` | a `lightFlash` of `leaf3` on the floor, radius 34, 300 ms | `venomScar` (0.8), played by the cinematic on this beat |
| ≈ 1 790 | end (`await S.wait(120)`) | | |
Tribute + entrance ≈ 0.9 + 1.8 = **2.7 s scene ≈ 3.6 s game**.

Without a cut-in (not reachable for a Sv5 ace by normal summon; kept for robustness): the finale
fires on f9.

**From the graveyard (`soul_recall`, special): "Damla Dönüşü" (the drop returns).** No gas and no
cut-in, and no climb out of the floor (§5 reserves that for R2 and C10). The death is reversed, but
**gravity points down**:
1. 0–420 ms: `venomReviveGather` (sustained) starts. The tile's front rim etches 3 pits (or the old
   scar's pits light up if one is there, "the scar remembers"). From each pit, **drops fling UP** on
   short arcs (2–3 per pit, 1 px, `leaf3`, 60 ms apart) and merge into **one hovering glob about
   20 px above the tile**. The glob grows in 3 steps (5×4 → 7×6 → 9×8 px, the §5.0 glob art scaled
   by drawing, not by `setScale`) and wobbles. A `leaf3` follow-light under it (radius 10 →
   `setRadius(16, 8, 300)`) lights the floor beneath.
2. 420–560 ms: the glob **falls** (gravity 520 px/s², about 140 ms) and splats on the tile. The
   revive pose starts at f0 → f1 (the splat) on the impact frame, with a 1-px shake, a splat crown,
   `venomReviveGather.stop(40)` and `venomSplat` (0.6).
3. The revive pose plays on (stinger rights itself → lace stands → holes close → `land`@7):
   `venomReviveLand`, a 1-px shake and the badge.
4. The tile's scar rises to at least level 1 (`'brief'`).
Total ≈ 0.56 + 0.99 ≈ **1.55 s scene** ≤ 2.1.

**Flip (a set venom flipped up):** the recipe's v3 flip with `flip: { accent: 'drop', ramp: 'leaf' }`.
On top of it, a small handler in venom_drake-summon.ts (as crystal's flip-v3) is OPTIONAL. If one
is written: the card turns in 240 ms; 3 drops roll off the card's edge onto the tile (a brief scar-1
pit each); the body forms in its guard pose (≤ 120 ms hologram) and rises on `fromGuard` in a
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
| 0–440 (f1–f4) | The wind-up. On each swell frame (f2, f3, f4) the bulb light steps up. One drop falls from the bulb onto its own tile per swell and etches a temporary dot | `const L = followLight(sc, staff, { color: gold3, radius: 12, floorY: home.y, anim: 'flicker' })`, then `L.setRadius(16, 8, 60)` at f3 and `L.setRadius(20, 10, 60)` at f4; the own-tile pool `leaf3` with `setIntensity(0.15 → 0.6, 440)` | `venomCharge` continues (the rattle clicks speed up); `venomSwell` at f2, f3, f4 (pitch 1, 1.12, 1.26) |
| 440 (f5) | Whip smear | | `venomWhip` (CHARACTER_SOUNDS.swing) |
| 490 (f6 `release`) | **The glob leaves the muzzle**; a 3-px crown at the stinger; `shake(sc, 60, 1)` | the follow-light fades 140 ms | `chargeSnd.stop(30)`; `venomSpit` |
| 490–790 | **Flight 300 ms** on a parabola from the muzzle to the target's face point (`surfaceOf`, written per crystal). Apex = 22 + 0.18 × the distance (P2 mirrored: the arc rises to screen-up, never into the HUD). Trail drops + floor shadow | a small `leaf3` follow-light on the glob (radius 10, intensity 0.5) | the whir is inside `venomSpit` (its tail) |
| 790 (`contact`) | **Splat**: `s.impact(hit)` (hit-stop 70, number EF-9, contact flash EF-3 on the hit region), the splat crown, the blob stuck on the overlay. If the tile already has a venom scar, "the scar remembers" fires just before this (§5.0) | `lightFlash(leaf3, radius 26, 260 ms)` at the target's floor | `venomSplat` (its body is only 0.12 s long, then it cuts) + the target's material hit (the kit) |
| 790–1 030 | **The eat, a held breath**: holes in 3 steps (80 ms each, starting at 830), steam threads. The splash leaves a brief scar on the target's tile: level 1 (or +1) | | **A silence first.** `venomSplat` carries `duck: 0.9`, so the music drops hard (sfx.ts → `musicEngine.duck`, with the engine's own release). Its own body stops at 0.12 s, and **no venom sound plays between 0.12 s and the first tick**: the fizz and steam that used to sit there move into `venomSteam` at the third tick. Then `venomEat` × 3 at 830 / 910 / 990, **dry and close** (no tail, panned to the target), so the corrosion is heard as three tiny fizz-pops in a held breath. `venomSteam` (the static high hiss with the dense fizz) starts with the third tick. Measure the gap in the offline render: ≥ 80 ms with the venom bus at < −40 dBFS |
| 940 | (the target's death starts: `DEATH_AFTER_CONTACT_MS` 150) | | |
| 790–1 460 | The attacker: f7 follow-through → f8 watch → f9 rattle → recover → idle | | `venomRattle` at f9 |
Strike resolves at ≈ 1 030 (the eat done). Attack + death ≈ 0.23 (declare) + 1.03 + the death
(1.1, parallel from 940) ≈ **2.1 s scene ≈ 2.85 s game** ✓.

**Blocked** (DEF ≥ ATK, e.g. vs a defense stone_sentinel 2100):
- The glob splats on the guard plane 9 px in front of the target (crystal's aim offset), with a
  splat crown.
- **No holes.** The acid fizzes on the guard: 2 steam threads, and the blob slides down the guard in
  3 frames as a dripping sheet.
- The drops fall to the tile and leave a brief scar (level +1).
- `s.impact()` (hit-stop 50).
- `venomSplat` (0.8) + `venomFizz` (no eat ticks). The defender's material plays (stone).
- Recipe `blocked: 'splash'`.

**Losing** (e.g. vs crystal_wyrm 2800): the glob lands and the splat plays, the holes reach step 1
only, then the stronger side answers on that frame (clash.ts backlash, EF-13). Do as crystal:
`finish(); await sleep(sc, 34); return;`. The holes on the winner close at once with a fizz. Venom's
own death (§5.4) runs from its hitHeavy f0.

**Both destroyed** (vs coral_serpent 2000): the splat + holes, then both deaths. The target dies
holed and venom eats itself into lace. The two hole sets come from the same generator, which is the
point.

### 5.3 Direct attack: "Zehir Sağanağı". Budget ~1.6 s scene, ≤ 2.32 s game
`s.direct`: play `special` instead of `attack`, as `u.playRange('special', 1)`. Special f0 equals the
held attack f1 (§4 special), so there is no pose pop.

| ms | Picture | Light | Sound |
|---|---|---|---|
| 0–390 (f1–f3) | It rears, the wings spread, the bulb swells | the follow-light on the bulb | `venomCharge` |
| 390 (f4 release) | **5 drops** leave the muzzle along the fan sweep (40 ms apart), toward 5 points on the opponent's side (two floor tiles in front of the podium, the podium rim, the podium, the duelist), arcs 220 ms each | | `venomWhip`, then `venomSpit` (0.7) |
| 610–770 | Drops 1–4 splash on the floor (small crowns) and leave brief scar-1 pits on the podium floor (key `podium:<p>`) | small `leaf3` flashes, radius 12 | `venomDrip` × 4 (pitch ladder 1, 0.94, 0.89, 0.84) |
| 770 (contact) | **Drop 5 hits the duelist**: `s.impact(s.to)`, the number, the default duelist hurt; the fizz on the podium | `lightFlash gold3`, radius 22 | `venomSplat` (0.9) |
| 770–1 100 | recover, idle | | |
≈ 0.23 + 1.1 + LP 0.4 ≈ **1.6 s scene ≈ 2.2 s game** ✓.

### 5.4 Death: "Kendi Zehri" (its own venom). Final material, a new row for YENI_KARTLAR §5.2
**Final material:** *"Kendi zehri onu dantele çevirir; dantel köpüren gölete çöker, yalnız kitin
iğnesi mezar taşı gibi bir an dikili kalır ve batar; karoda ölü toprak izi kalır."* (Its own venom
eats it into lace. The lace slumps into a boiling pool, only the chitin stinger stands for a moment
like a grave marker and then sinks, and a mark of dead ground stays on the tile.)

Unique against §5.2 and the lane-A sibling:
- **No bone, no rib cage, no skeleton at any time.** ashen_drake R1's death shows its rib cage with
  the heart hanging bare (ashen_drake.md, death f7), and two DARK lane-A dragons must not share that
  moment. The skeleton layer of revision 1 is gone.
- The holes are the attack's holes (the same `holeMask`), turned on itself: the signature move is
  also the death, and no other card dies by its own weapon.
- The ash heap is R1's, the empty shroud is R2's, and liquid flowing back into the tile is C10's.
  Venom's body is not liquid: it is **eaten into lace**, and what stays is a stinger, briefly, and
  a **mark on the board**, which no other card leaves.
- C6's final "tek filiz solar" (a single sprout withers) is avoided: no plant glyph anywhere in this
  death or its scar (the level-3 stalk is dead `stone2`, with no green and no wilting motion).

Registration: `if (LOOK_V3) registerCardHook('venom_drake', 'destroyed', (ctx) => { venomCorrodeWatch(ctx); return flavoredDeath(ctx, async () => {}); })`.
This mirrors crystal: the watcher plus flavoredDeath, which routes to `deathV3` and also respects
`sourceOwnsDestroy`, so judgment_bolt keeps its electrocution. The body breaks via recipe
`death: { material: 'shadow', accent: 'shadow' }`. The void pool accent is the dark depth of the
puddle, and the watcher paints the acid on top.

Pose frame starts (scene ms): f0 0 · f1 50 · f2 110 · f3 170 · f4 240 · f5 310 · f6 380 (hold 180) ·
f7 560 · f8 640 (hold 180) · f9 820 · f10 900 · burst 990.

| scene ms (from the death start) | Picture | Light | Sound (CHARACTER_SOUNDS) |
|---|---|---|---|
| 0 (f0) | struck; the kit's flash | | the blow's material (`venomscale`) |
| 50 (f1) | reel, the eye shuts | | `deathStart`: `venomTear` (a wet rip, high band) |
| 110 (f2) | the knees buckle; **the arch locks rigid** | `shake 1` | |
| 170 (f3 `dissolve`) | the seam web (`leaf3`, `gold3` nodes) breaks out; **the watcher starts** | `const L = followLight(core, { color: leaf3, radius: 18, intensity: 0.2 })`; `L.setIntensity(1.0, 300)` | `dissolve`: `venomMelt` (the low boil and gurgle; its fizz is held back so the ticks stay dry) |
| 240 / 310 / 380 (f4–f6) | **holes, steps 1 → 2 → 3**; the cape falls away in lace rags; the watcher adds 1 steam thread per step from the newest holes | `L.setRadius(22, 11, 200)` | `afterDissolve` [1, `venomEat`, 0.8], [2, `venomEat`, 0.9], [3, `venomEat`, 1.0]: **the same three ticks it gave its victims** |
| 380–560 (f6 hold) | **the lace**, held 180 ms: a dragon made of holes with the floor showing through, and the intact chitin arch above it | | the boil swells under it (inside `venomMelt`) |
| 560 (f7) | the lace **slumps** into the pool; the chitin tip falls and rights itself upright | `shake 1` | [4, `venomSlump`, 0.8] (a wet collapse) |
| 640–820 (f8 hold) | **the stinger marker**, held 180 ms: the pool with the chitin stinger standing in it like a grave marker, one bead on the hook | `L.setRadius(12, 6, 180)`, the light shrinks onto the stinger | [5, `venomMarker`, 0.7] (a dry chitin "tık" + one rattle click train of 4) |
| 820–900 (f9–f10) | the stinger sinks; the bead falls into the pool | `L.setIntensity(0.3, 160)` | [6, `venomDrip`, 0.7]: the leitmotif "tıp→tsss" closes the card |
| 990 (the burst: the kit breaks the last frame as shadow) | **The watcher's `onBurst` work**: the puddle Raster (an iso ellipse 26×10 on the tile's front half: `leaf2` surface, `void0` depth, `leaf1` rim, 3 bubbles) boils for 240 ms, then **eats into the tile in 3 steps** (70 ms each): it shrinks to **scar level 3, `'duel'`** (§5.0, the module store). The card is born on the burst frame (kit) | the light pool fades 240 ms | `burst`: `venomPuddle` (an etch sizzle + a static hiss decay) |
Pose 0.99 s + burst + card flight ≈ 1.3 s scene ≤ 1.4 (SÜ) ✓; game ≈ 1.75 s ≤ 2.03 ✓. The two holds
(180 ms each) are inside HA-2's 200 ms ceiling.

**Death in defense:** guardbreak (HA-24) from fromGuard f0. The holed shield membrane is eaten first
(the death pose is posematched from fromGuard: f0–f2 are drawn from the guard pose, with the near wing
dropping as the knees buckle). Everything after f3 is the same.

### 5.5 Being struck (as a defender, surviving)
- The material `venomscale` sounds (§6).
- Debris `'drop'` in leaf tones: venom spurts from the wound and 2–3 drops fall and leave temporary
  etch dots (≤ 1.2 s). It leaves no scar: only venom's own attacks and its own death scar the board.
- The contact flash follows EF-3 (dark body, so the white core is allowed).

---

## 6. SFX design: src/audio/v3/venom.ts

**Identity (a new row for YENI_KARTLAR §5.1, to add when the doc owner merges):**

| Kart | Ana perde / renk | İmza malzeme | Ayırıcı katman |
|---|---|---|---|
| Zehir Ejderi (venom_drake) | A1 55 Hz ıslak gırtlak kesesi guruldaması (7 Hz detune dalgası) + 5.5 kHz üstü durağan asit tıslaması | asit + kitin iğne | iğne çıngırağı (düzenli tık treni, 4.2 kHz bant, 14 → 30 tık/sn hızlanır) + damla "tıp→tsss" (2.4 → 1.6 kHz inen tık + yoğun köpürme) |

**The spectral signature is bimodal and the rules are hard:**
- Energy goes **below 120 Hz** (the gurgle, the knocks) and **above 1.6 kHz** (the clicks, the
  fizz, the hiss). **Nothing sits in the 300 Hz–1.5 kHz valley** for longer than a 15-ms transient.
- **No `growl` in any venom sound.** Ashen R1's roar is `growl` [260, 540, 1350], and any formant
  growl would fill the valley and land next to it.
- **The hiss never sweeps in pitch.** It is white noise through a static `highpass` at ≥ 5.5 kHz,
  shaped only by amplitude (the rattle train, swells, decays). C3's identity is "bandpass noise
  rising 2 → 5 kHz" (the ring whistle), and any rising or arched noise sweep would echo it. The only
  `sweep` allowed is a **falling** band in the whip, and it is masked by the `crack`.
- **The rattle is a periodic click train** built with `v.bursts` (one source and one gain however
  many clicks, synth.ts line 308), not `v.flutter` (`flutter(rate: number, …)` takes a fixed rate,
  and its band-limited random wobble is irregular vocal fry, not a rattlesnake). Shared helper in
  venom.ts:
  ```ts
  /** Click times (s) for a rattle: the period eases from p0 to p1 over `ramp` s, then holds. */
  function rattleTimes(d: number, p0: number, p1: number, ramp = 0): number[] {
    const out: number[] = [];
    for (let t = 0; t < d; ) { out.push(t); const k = ramp > 0 ? Math.min(1, t / ramp) : 1; t += p0 + (p1 - p0) * k; }
    return out;
  }
  const rattle = (v: Voice, t: number, times: number[], g: number) =>
    v.bursts(times, times.map((_, i) => g * (0.8 + 0.2 * ((i * 7) % 3) / 2)), { t, f: 4200, q: 1.4, dec: 0.006, kind: 'white' });
  ```
  The charge rattle uses `rattleTimes(1.2, 1/14, 1/30, 0.5)` (it accelerates, then holds until it is
  stopped). The fixed rattle uses `rattleTimes(d, 1/26, 1/26)`.
- **The hiss bed** (`hiss(v, t, d, g, env)`) is `v.noise('white', { t, g: env, to: v.filt('highpass', 5500, 0.7, { t }) })`.
  It is static, and `env` is an amplitude envelope only.
- **`v.crackle` counts are totals.** `n` is the total number of clicks over `d` (synth.ts line 338),
  not a rate. A `curve` < 1 back-loads the clicks but also makes the late ones quieter (gain ×
  (1 − 0.6k)). "Dense" fizz for this card means **≥ 110 clicks per second**, so `n = round(110 × d)`
  or more. Every swelling fizz has a rising `hiss` bed under it, so the swell never depends on the
  crackle's gain.
- Separation from the other rows:
  - crystal_wyrm's centroid is 1758 Hz (glass);
  - abyss_magus's centroid is 764 Hz (drone);
  - ashen R1 is a 50 Hz double heartbeat with sparse ash crackle and a low-mid "VUF". Venom has no
    double beat, no formant growl, and its crackle is dense and high;
  - C3 is a chirp and a rising whistle (venom has no pitch sweep and no tonal chirp);
  - C10 is a 600 Hz suction (venom has nothing in the valley);
  - C9's 4 kHz "tsst" and R3's 5 kHz feather are short and single-band, with no low body. Venom's
    hiss always comes with the gurgle, and its 4.2 kHz band is a periodic train, never a single
    "tsst".
- No `glassReverse` (R2's), no "pof" (R3's), no double low beat (R1's), no beating pair (C12's).

Built only from `src/audio/v3/kit.ts` blocks (`thump`, `puff`, `sweep` (falling only), `crack`,
`drone`) and Voice primitives (`v.tone`, `v.noise`, `v.filt`, `v.crackle`, `v.bursts`, `v.lfo`). No new
DSP (SE-3). `growl` and `flutter` are not used.

| Name | Role / when | Recipe (t in s) | duck |
|---|---|---|---|
| `venomRoar` | `roar` (the cut-in flare, the roar f3) | Three layers, nothing else. **(1) The sac gurgle**: `const g = v.tone('sine', [[0,52],[0.15,58,'e'],[1.0,50,'e']], { g: [[0,0],[0.06,0.5],[0.8,0.4],[1.1,0.0001,'e']] })` + `v.lfo(g.osc.detune, 7, 60)` + a sub thump `thump(v, 0, 70, 38, 0.5, 0.25)`. **(2) The broadband hiss**: `hiss(v, 0.04, 1.0, …, [[0,0],[0.08,0.24],[0.7,0.18],[1.0,0.0001,'e']])`, static. **(3) The rattle**: `rattle(v, 0.05, rattleTimes(0.95, 1/26, 1/26), 0.28)` | 0.65 |
| `venomArrive` | `arrive` (sustained; stopped at `land` with 120 ms) | a `hiss` swell 0 → 0.06 over 1.6 s + `v.crackle({ d: 1.6, n: 200, g: 0.03, f: 7000, q: 0.8, dec: 0.004 })` (≈ 125/s) + a low boil (brown noise → `v.filt('lowpass', 160)`, g 0.12) + 6 bubbles `v.tone('sine', [[0,90],[0.04,140,'e']])` at seeded times (sub-band "blups", not mid-band) | 0.3 |
| `venomLand` | `land` | `thump(v, 0, 120, 58, 0.55, 0.14, { drive: 1.5 })` ×2 (knuckle, knuckle +0.045) + a wet slap `puff(v, 0.01, 0.12, 0.06, 220, { kind: 'brown' })` + a 5 ms `hiss` tick + 2 `venomDrip`-style ticks | 0.4 |
| `venomInhale` | summon f6 | a static `hiss` with a reverse envelope (a 0.32 s swell, then a hard cut) + the sac rising `v.tone('sine', [[0,55],[0.3,82,'e']])` g 0.2 | 0.2 |
| `venomCharge` | `charge` (sustained; stopped at `release` with 30 ms) | `rattle(v, 0, rattleTimes(1.2, 1/14, 1/30, 0.5), 0.22)`: the clicks speed up from 14 to 30 per second over 0.5 s, then hold + a faint gurgle (`v.tone('sine', 55)` g 0.08 with `v.lfo(detune, 7, 40)`) | 0.25 |
| `venomSwell` | f2/f3/f4 (`pitch` 1 / 1.12 / 1.26) | a "glug": `v.tone('sine', [[0,70],[0.05,52,'e']])` g 0.3 dec 0.12 + a high bubble tick `v.tone('sine', [[0,2400],[0.02,3000,'e']])` g 0.04 dec 0.02 | 0.15 |
| `venomWhip` | `swing` (f5) | a **falling** band `sweep(v, 0, 0.09, [6800, 4200, 2400], 0.28, { kind: 'white', q: 1.1, peakAt: 0.3, pan: [-0.2, 0.2] })` + `crack(v, 0.075, 0.12, { hp: 2500, lp: 8000, n: 2 })` | 0.2 |
| `venomSpit` | `release` | a sub mouth-pop `v.tone('sine', [[0,180],[0.015,70,'e']])` g 0.35 + a 12 ms wet `hiss` burst + the glob whir: a 110 Hz sine with `v.lfo(gain, 11, …)` wobble for 0.28 s (sub-band) under a quiet `hiss` gated by the same 11 Hz | 0.3 |
| `venomSplat` | `impact` | the splat `v.bursts([0, 0.012, 0.03], [0.5, 0.3, 0.15], { dec: [0.05, 0.04, 0.03], f: 240, q: 0.8, kind: 'brown' })` + a sub knock `thump(v, 0, 110, 50, 0.4, 0.08)` + a 40 ms `hiss` flare. **The body ends at 0.12 s**: the held breath (§5.2) | 0.9 |
| `venomEat` | the hole steps (× 3), the death f4–f6 | **dry and close**: `v.crackle({ d: 0.06, n: 9, g: 0.07, f: 6500, q: 1, dec: 0.003 })` (150/s) + a tick `v.tone('sine', [[0,3200],[0.01,2200,'e']])` g 0.04 dec 0.012. No tail, no reverb send | 0.1 |
| `venomSteam` | the third eat tick | `hiss` 0 → 0.1 → 0 over 0.5 s + `v.crackle({ d: 0.5, n: 60, g: 0.04, f: 7000, q: 0.8, dec: 0.004, curve: 1.6 })` | 0.25 |
| `venomFizz` | blocked | `venomSteam` at 0.4 s, without eat ticks | 0.25 |
| `venomRattle` | attack f9 | `rattle(v, 0, rattleTimes(0.25, 1/26, 1/26), 0.2)` with a gain fade | 0.15 |
| `venomDrip` | the **leitmotif** (drops, "the scar remembers", the death's last beat) | **"tıp→tsss"**: `v.tone('sine', [[0,2400],[0.025,1600,'e']], { g: perc(0.06, 0.04) })` + `v.crackle({ t: 0.03, d: 0.25, n: 30, g: 0.02, f: 7500 })` (120/s) | 0.1 |
| `venomScar` | the summon finale (it owns the beat) | a sub settle `puff(v, 0, 0.2, 0.5, 240, { kind: 'brown' })` + `v.crackle({ d: 0.7, n: 90, g: 0.04, f: 6500 })` + a `hiss` decay 0.7 s + a sour low dyad `v.tone('sine', 55)` + `v.tone('sine', 58.27)` decaying 0.6 s (one-time, under 0.06 gain; not a beating motif) | 0.25 |
| `venomTear` | `deathStart` | a wet rip in the high band: `v.crackle({ d: 0.18, n: 40, f: 5000, q: 2, g: 0.12 })` + a gurgle drop `v.tone('sine', [[0,82],[0.2,46,'e']])` | 0.35 |
| `venomMelt` | `dissolve` | a low boil (brown → `v.filt('lowpass', 180)`, swelling over 0.6 s) + 9 seeded sub bubbles (70 → 110 Hz) + `drone(v, 0, 0.6, 55, 0.08, { lp: [120, 200, 120], att: 0.2 })`. No fizz: the eat ticks over it stay dry | 0.45 |
| `venomSlump` | death f7 | a wet collapse `v.bursts([0, 0.02], [0.5, 0.25], { dec: [0.09, 0.06], f: 200, q: 0.7, kind: 'brown' })` + `thump(v, 0, 90, 45, 0.3, 0.12)` | 0.4 |
| `venomMarker` | death f8 | a dry chitin "tık" (`v.bursts([0], [0.3], { dec: 0.01, f: 3600, q: 4 })`) + `rattle(v, 0.05, rattleTimes(0.16, 1/26, 1/26), 0.12)` (4 last clicks) | 0.2 |
| `venomPuddle` | `burst` | an etch sizzle `v.crackle({ d: 0.5, n: 70, g: 0.05, f: 6500 })` + a `hiss` decay 0.9 s (static) + a sub settle `thump(v, 0, 70, 40, 0.2, 0.2)` | 0.55 |
| `venomReviveGather` | `reviveGather` (sustained; stopped when the glob lands) | the pits' fizz `v.crackle({ d: 1, n: 120, g: 0.04, f: 7000, curve: 0.6 })` **over a rising `hiss` bed 0 → 0.12** (the bed carries the swell, since the back-loaded crackle fades) + 3 tiny drip ticks per pit (2.4 kHz, rising pitch ladder) + the gurgle 46 → 55 Hz | 0.3 |
| `venomReviveLand` | `reviveLand` | `venomLand` + `rattle(v, 0.05, rattleTimes(0.2, 1/26, 1/26), 0.18)` | 0.4 |

Levels obey SE-6 (the v3 output ceiling). Ducks obey SE-7 (the roar and puddle ≥ 0.55; small beats
≤ 0.3). `venomSplat`'s 0.9 duck is the held breath, and it is the only exception, documented here.
Export `V3_VENOM_SUSTAINED = ['venomArrive', 'venomCharge', 'venomReviveGather']`.

**Struck-body material (`venomscale`, SE-5): the first user of the `'crackle'` ring.**
`RingSpec` already declares `{ kind: 'crackle'; hp: number; rate: number }` (src/art/materials/
types.ts line 55), but `RING_KINDS` (src/audio/v3/materials.ts line 33) is `bar / fm / flutter /
rumble`, and there is no interpreter. `'flutter'` would be wrong: it is the cloth interpreter ("the
robe snaps … the shadow exhales"), and SE-5 LSD ≥ 9 dB against cloth would fail. **Additive edit in
materials.ts:** add `'crackle'` to `RING_KINDS` and a new case in `ring()`:
```ts
case 'crackle': {
  // acid (venomscale): a dense spray of tiny high clicks (the hide fizzes where it is struck) over a
  // short wet low knock; no mid body (it must not read as cloth's flap or stone's grind)
  const light = w === 'Light';
  const magic = w === 'Magic';
  const d = light ? 0.12 : magic ? 0.2 : 0.35;
  v.crackle({ t: t + 0.004, d, n: Math.round(s.rate * d), g: (light ? 0.1 : 0.08) * k, f: s.hp, q: 0.9, dec: 0.003, curve: 1.3 });
  v.tone('sine', [[0, light ? 150 : 120], [0.06, 60, 'e']], { t, g: perc((light ? 0.2 : 0.3) * k, light ? 0.05 : 0.09, 0.002) });
  if (w === 'Heavy') v.bursts([0.05, 0.11], [0.12 * k, 0.07 * k], { t, dec: 0.004, f: 4200, q: 1.4 }); // two rattle clicks: the stinger flinches
  return;
}
```
Also add `'venomscale'` to `GENERATED_HIT_MATERIALS`. The generated hits are
`hitVenomscaleLight/Heavy/Magic`. Check SE-5: LSD ≥ 9 dB against `stone` (the riskiest pair: stone is
also "low + high, hollow middle", but its grains are sparse at 3–4.2 kHz and its low is a brown
grind, while venom's clicks are dense at 6.5 kHz and its low is a tonal knock), `cloth`, `crystal`,
`metal` and `scale`.

**CHARACTER_SOUNDS entry** (src/cinematics/_v3/sound.ts, an additive block after `abyss_magus`):
```ts
venom_drake: {
  roar: 'venomRoar', arrive: 'venomArrive', land: 'venomLand', charge: 'venomCharge', swing: 'venomWhip',
  release: 'venomSpit', impact: 'venomSplat', deathStart: 'venomTear', dissolve: 'venomMelt',
  // offsets are frames after the dissolve frame (death.ts line 421: dissolveF + off); dissolve = f3
  afterDissolve: [[1, 'venomEat', 0.8], [2, 'venomEat', 0.9], [3, 'venomEat', 1.0], [4, 'venomSlump', 0.8], [5, 'venomMarker', 0.7], [6, 'venomDrip', 0.7]],
  burst: 'venomPuddle', reviveGather: 'venomReviveGather', reviveLand: 'venomReviveLand',
},
```

**SE-4 check, ashen first:** render every role offline and compute the 1/3-octave A-weighted LSD.
Run it **first against ashen_drake's role set** (the lane sibling and the old growl risk), then
against cloud_hatchling's (when it exists), crystal_wyrm, abyss_magus and stone_sentinel (rumble
voice). Requirement: the median ≥ 15 dB and the minimum ≥ 10 dB per role. The likely weakest pair is
`land` vs ashen's low thumps. If it is under 10 dB, raise the knuckle thump to 140 → 70 and lean on
the hiss tick. Also run a **valley check** on every recipe: the 300 Hz–1.5 kHz band energy must be
≥ 12 dB under the louder of the two outer bands.

---

## 7. Card art and cut-in

### Card art: src/art/cardart-v3/venom_drake.ts (`CardArtV3`, docs/v3/KART_RESIMLERI.md)
**big 88×68:** "Zehirli Toprak". The wyvern seen in 3/4 view, low on a ledge of dead, cracked
ground; it fills the left two-thirds, with its body bottom-left cut by the frame edge (allowed).
- The head is low at the right third line (x ≈ 58, y ≈ 40), looking right, with the sac glowing.
- The **tail arch** rises behind it and curls over into the upper-right third. The **bulb** sits at
  ≈ (64, 16): the focus and brightest point (a `gold4` core, a `gold3` ring, a `leaf3` body), with ≥ 4 px of air
  above it.
- A drop falls from the stinger to the ground (a 2-px stepped trail) onto an etched ring of dead
  ground.
- Bottom-right corner: **one dead stalk** at the frame edge, in `stone2` with a `stone1` shadow side and
  **no green at all**: a bent, leafless stem whose base stands in the etched ring. That is the flavor
  ("bir daha yeşertmez") in one glyph. Revision 1's half-eaten green sprig is dropped, because a
  single sprout glyph echoes C6's death final ("tek filiz solar").
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
| f3 | 360–520 | **[slam]** the jaws gape in the HISS; the sac flashes `gold3`; the tail is drawn tight (motion lines on the arch, no two-frame tremble) |
| f4 | 520–720 | the hiss holds; **the drop falls** from the stinger across the face line |
| f5 | 720– | **[exit]** held: the jaws half-closed, a new bead forming |

Holds array: `[200, 80, 80, 160, 200, 1]` (the last frame is held). Portrait colours follow the
sprite (§1). The P2 set is drawn with `lightFrom: 'right'`. Preview:
`?dev=cutin&id=venom_drake&look=v3` and `&player=2`.

---

## 8. Integration plan

### 8.1 New files (no registry edits needed; discovered by glob)
- `src/art/monsters-v3/venom_drake-*.ts` (the MonsterArt registers by its `id` from `venom_drake-wyvern.ts` once it is renamed from `_venom_drake-wyvern.ts`; see §3).
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
    light: { glow: { emissive: [[PAL.gold4, 1], [PAL.gold3, 1], [PAL.leaf3, 0.6], [PAL.gold2, 0.5]], halo: 0.5, pool: 0.85, spill: PAL.leaf2 }, strike: PAL.leaf3 },
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
| `src/art/monsters/index.ts` | **No edit.** Line 35 is shared with lane B (`wisp_imp`). The new art registers through its new filename `venom_drake-wyvern.ts` (§3), and the old exclusion token stays and excludes a deleted file |
| `src/audio/v3/materials.ts` (`RING_KINDS`, `ring()`) | add `'crackle'` to `RING_KINDS` and the `case 'crackle'` interpreter (§6). Additive: no existing case changes |
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
| `kaVenomLose` | p1 `[null,'crystal_wyrm']` → venom attacks and loses | the backlash + venom's self-corrosion death (attack position), the death scar |
| `kaVenomBoth` | p1 `[null,'coral_serpent']` (2000 vs 2000) | both die, the holed victim |
| `kaVenomDies` | p0 `[null,'crystal_wyrm']` attacks p1 `[null,'venom_drake']` | venom struck, death in attack position |
| `kaVenomDiesDef` | p1 `[null,{ id:'venom_drake', position:'defense' }]`, attacked by crystal_wyrm | the guardbreak death |
| `kaVenomHit` | p0 `[null,'stone_sentinel']` (ATK 500) attacks p1 `[null,{ id:'venom_drake', position:'defense' }]` (DEF 1500): venom survives (a struck guard). For hitHeavy use `kaVenomDies`; for hitMagic use `kaVenomMagic` | hit (guard), the guard flinch |
| `kaVenomMagic` | `judgment_bolt` on venom (as `spBolt`, with `mon(1,1)`) | the hitMagic path (the bolt owns the destroy: a check that nothing of ours runs) |
| `kaVenomAtkDark` | as `kaVenomAtk` with p1 `[null,'abyss_magus']` in defense (DEF ≤ 2000) | the hole fill on a dark victim (floor tone + `leaf3` rim) |
| `kaVenomScarStack` | 1) `kaVenomLose`'s duel (venom dies on p0 zone 1 → a `'duel'` scar); 2) p0's next turn: normalSummon `ember_wolf` to zone 1; 3) p0's battle: declare an attack with it so the target selection highlights p1's tiles, and p1 hovers p0's zone 1 (the select frame); 4) p0 activates `soul_recall` on venom to zone 2, then venom attacks a monster on p1 zone 1 next to it | the scar beside a card on its tile (front rim visible), **the highlight over the scar** (the scar must stay under it and dimmer), the brief attack scar stepping out after 2.4 s, the bubble cap (≤ 2) |
| `kaVenomScarPersist` | as `kaVenomScarStack` with the dev param `&venomScars=duel` (read only in dev builds by venom_drake-acid.ts to flip `VENOM_SCARS_PERSIST`) | the owner's "yes" variant: levels 1 → 2 on one tile, "the scar remembers" ladder, the 8-scar cap |
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
3. **Gates:** `npx vite-node tools/monster-gates.ts $S/sheet/venom_drake-v3.json $S/sheet/venom_drake-v3-p2.json --class ace --ref none` (the orchestrator confirms ace vs large, §3; the plan's 4.89 MB passes both).
   Everything must pass:
   - margin ≥ 2 and 0 edge px
   - out ≤ 1.2, in ≤ 2.0, seam ≤ 1.4
   - idle max Δ ≤ 1.8×, liveliness ≥ 15 %
   - guard 0.3–0.8×
   - transitions ≤ 400 ms
   - noise: idle mean ≤ 10 %, body frames ≤ 15 %, effect frames ≤ 20 %
   - HA-21 and HA-21 phase < 50 %
   - feet band fixed
   - bytes ≤ 7 MB per side (ace; ≤ 5 MB if the orchestrator rules size class), ≤ 140 frames, ≤ 8 ms per frame
4. **Sameness (KK-15):** `npx vite-node tools/sameness.ts --look v3 --ids venom_drake,coral_serpent:v3,crystal_wyrm,ashen_drake,cloud_hatchling --against all`.
   No KALIR. Read any UYARI pair's distinction cards and run the blind eye test
   (`--blind DIR --key-out KEYDIR`, then `--score`).
5. **Films (KK-8), at 1× and ×3 clips:**
   `$PW node tools/shot.mjs "?dev=duel&s=kaVenomAtk&look=v3&zones=5" --fresh --film 30 --every 80 --cols 6 --out $S/films/atk.png`
   for every `kaVenom*` key. Then zoom in with `--clip <x,y,w,h> --scale 3` on:
   - the glob arc
   - the holes (contact ±3 frames)
   - the death's lace (f6) and the stinger marker (f8): both must read at 1× in one viewing
   - the puddle → scar, and the scar under a tile highlight (`kaVenomScarStack` select frame)
   - the hole fill on the dark victim (`kaVenomAtkDark`)
   - the revive glob hovering ~20 px above the tile, then falling
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

1. **Lasting scars: OWNER DECISION REQUIRED before the build of venom_drake-acid.ts is accepted.**
   Question for the owner: *"Zehir Ejderi'nin saldırı ve çağırma lekeleri düello boyunca karoda kalsın
   mı, yoksa yalnız ölüm lekesi mi kalsın?"* (Should venom's attack and summon marks stay on the tiles
   for the whole duel, or only its death mark?) The card's effect is `none`, and up to 8 glowing
   tiles look like a game mechanic (a field effect or a trap marker), so players would read rules into
   them. **Default until the owner answers (built that way):** only the death scar (level 3) lasts the
   duel; attack, direct, blocked and summon marks are `'brief'` (2.4 s, then they step out); no more
   than 2 scars bubble at once; the bubble is dimmer than any tile highlight; the scar sits at
   `DEPTH.TILE_FX - 1` under every highlight. A "yes" flips `VENOM_SCARS_PERSIST` (one constant).
2. **Frame budget.** 133 frames × 36.8 KB ≈ 4.89 MB per side. That is under the ace 7 MB line and
   the large 5 MB line, and 7 frames under the 140 cap. **Question for the orchestrator:** which class
   applies (ace by tier, or large by size)? The plan passes both, and the headroom goes to the
   death/revive holds, never to idle.
3. **Size class vs ace craft.** Venom is an ace with a size-80 body. The tail arch makes it tall
   (≈ 74 px). Check Sİ-7 / EF-10 that the cut-in band and the neighbouring tiles' badges are not
   crowded, and check the arc apex vs the P2 HUD at the top-right (clamp the apex to y ≥ 40).
4. **Death material.** `shadow` (darken + pull) is the closest existing shatter preset. Its void pool
   accent is shared with abyss_magus / shade / dusk. Identity rests on the pose (the lace and the
   standing stinger) and the watcher's acid puddle and scar. If critics still read "void death",
   propose an additive `ShatterMaterial` `'acid'` in src/vfx/shatter.ts (a shared file: needs the
   orchestrator).
5. **The lace must read at 1×.** A silhouette made of holes can turn to noise (IŞ-10, effect frames
   ≤ 20 % isolated). Holes are ≥ 2 px, strands ≥ 1 px with a 2-px minimum run, and the f6 lace keeps
   the outline of the head, the barrel and the arch. If the gate fails, use 2 lace frames (from the
   7-frame headroom) with fewer, bigger holes.
6. **Projectile vs "contact" mark.** The real contact is the cinematic's (the flight time). The attack
   anim's `contact`@9 is a planned frame. If `measure` shows the number ≠ contact, drive the
   number from `s.impact()` only (it already is) and do not wait on the anim mark.
7. **Holes overlay on another card's sprite.** The overlay follows the victim's frame. Death kits that
   swap sprites (judgment_bolt owning the destroy, guardbreak) must drop the overlay safely: watch
   `sprite.active/visible` every frame, as `crystalBreakV3` does.
8. **The special as the direct-attack motion** is a choice, not a rule. If the recipe layer or
   `measure` expects `attack` for direct attacks, keep the logic in the custom strike (it is).
   Special f0 is attack f1 exactly, and the art test pins it (§4 special).
9. **Old serpent files and their test.** Deleting `venom_drake.ts` and `venom_drake-{body,build,fx,
   head,parts,types}.ts` breaks `src/art/cardart-v3/venom_drake.ts` and `tests/art/venom_drake.test.ts`
   until both are rewritten. Do all of it in one change set.
10. **Sound collisions.** The weakest predicted pairs are `land` vs ashen_drake's (low thumps), the
    struck body vs `stone` (both hollow in the middle), and the rattle vs C9's 4 kHz "tsst" if
    soloed. The 55 Hz gurgle stays in every roar and hiss so the bimodal profile holds, and SE-4 runs
    against ashen first.
11. **Lane coordination.** Ashen (R1) and cloud_hatchling (C3) agents work in the same tree.
    `src/cinematics/kart-a/` may be shared as a folder, but each file is per card. Shared one-line
    edits (sounds.ts, sfx.ts, _v3/sound.ts, materials.ts, cardface-v3/index.ts) must be made with
    small anchored Edits so parallel additions do not collide.

---

## Critique log (round 1 → revision 2)

Each finding was checked against the tree before it was resolved.

| # | Finding | Verified? | Resolution |
|---|---|---|---|
| 1 | BLOCKER: `ctx.keep` scars die at the end of the batch | Yes: Director.ts lines 140–155 `dropKept()` | §5.0: a module-level `Map` in venom_drake-acid.ts keyed `p:zone` / `podium:p`, cleared on scene `shutdown` and `onDuelStart`, one `onFrame` ticker per scene, and no `ctx.keep` / `take` |
| 2 | BLOCKER: permanent board marks look like a mechanic | Valid (owner question) | §10.1 asks the owner (the question is written in Turkish). Default build: only the level-3 death scar is `'duel'`; the others are `'brief'` (2.4 s, then they step out); ≤ 2 bubbling scars; the bubble is dimmer than any highlight; one flag for "yes". The step-out is timed, not at the end of the turn, because `V3HOOKS.turnStart` is frozen and owned by A6-B |
| 3 | MAJOR: scar depth covers the highlights, and the centre is hidden under the card | Yes: layout.ts line 434, `TILE_FX` 40 / `CARD_ON_TILE` 50 | Depth `DEPTH.TILE_FX - 1`; drawn on the front half and rim of the diamond; `kaVenomScarStack` films a select frame |
| 4 | MAJOR: the skeleton death collides with ashen's exposed ribs | Yes: ashen_drake.md death f7 | Skeleton layer and `-skel.ts` removed. New death "Kendi Zehri": its own `holeMask` eats it into lace in 3 steps → slump → the chitin stinger stands in the pool as a grave marker → sinks → scar |
| 5 | MAJOR: death beats too fast at 1× | Valid | 11 f / 990 ms with two 180-ms holds (the lace, the marker); total ≈ 1.3 s scene ≤ 1.4 |
| 6 | MAJOR: not chartreuse; `leaf4` is mint; collides with WIND / C3 | Yes: palette.ts `leaf3` 0x6ed759, `leaf4` 0xc9f7a1, `ATTRIBUTE_COLOR.WIND = leaf3` | Venom = `leaf2` → `leaf3` → **`gold3`** → `gold4`. `leaf4` is banned on this card (venom, floor glow, hit flash, cut-in, card art). Eye → `gold2`. C3 is added to the §1 / §2 tables and to the sameness `--ids` |
| 7 | MAJOR: the `growl` roar fills the valley and sits next to ashen | Yes: formants [280, 620, 1750] | No `growl` anywhere. Roar = the 55 Hz sac gurgle (7 Hz detune LFO) + sub thump, a static ≥ 5.5 kHz hiss, the rattle train. SE-4 runs against ashen first; a valley check was added |
| 8 | MAJOR: the `flutter` rattle cannot be built and is not periodic | Yes: synth.ts line 275, `flutter(rate: number, …)` | The rattle is `v.bursts` with times from `rattleTimes()` (1/14 → 1/30 s accelerating for charge; fixed 1/26 s elsewhere), f 4200, q 1.4, dec 6 ms |
| 9 | MAJOR: hiss sweeps echo C3's rising whistle | Yes: YENI_KARTLAR §5.1 C3 | The hiss never sweeps (static highpass, amplitude only). The only `sweep` left is the whip's falling band under the `crack`. The inhale and the steam / puddle hiss are static too |
| 10 | MAJOR: the `flutter` ring is cloth's; the MaterialDef is incomplete | Yes: materials.ts lines 33, 53; types.ts line 55 declares `'crackle'` | Venom is the first user of `ring: { kind: 'crackle', hp: 6500, rate: 260 }`. An additive `case 'crackle'` + `RING_KINDS` entry are specified (§6). The full MaterialDef (draw / hit / death dissolve+gather / matter / sound / light) is given in §3 |
| 11 | MAJOR: the guard cannot lift the shield with the knuckles planted | Yes: `feetBand` = bottom-6-row x range vs idle f0 (framelib.ts line 456, monster-gates KK-5) | The critic's alternative was taken: the hind feet (x 34) and the **far knuckle (x 68)** stay planted and bound the band; the drake sits back on its haunches and the **near** wing lifts as the shield. Ruling the feet as the "hind feet only" would not satisfy the gate as written, which measures every opaque pixel in the bottom rows |
| 12 | MAJOR: the revive rises from the ground | Partly. §5 "yerden tırmanma" governs entrances, while HA-28 *requires* the revive to be the death reversed (and the magus robe "rebuilt up from the floor" is its own example) | Kept HA-28 (the death reversed: the lace re-forms, the holes close) but adopted the gravity-down opening: drops fling UP from the pits into one glob hovering ~20 px above the tile, the glob falls and splats, and the drake re-forms from the splat. Summon f0 is not reused, because HA-28 says the entrance does not replay |
| 13 | MAJOR: the shared index.ts line 35 would cause a merge conflict | Yes: one line with `wisp_imp` (lane B); the registry keys on `art.id` | index.ts is never edited. The new art is `venom_drake-wyvern.ts` (built as `_venom_drake-wyvern.ts`, hidden by the `_*.ts` rule, renamed at registration); the old `venom_drake.ts` is deleted; the test import, the `--art` paths and the cardart import follow |
| 14 | MINOR: finale default shake 4 / sfx 0.75 | Yes: summon-a/_kit.ts lines 549–560 | `S.finale({ …, shake: 2, sfx: null })`; `venomScar` owns the beat; `summonBurst` is dropped |
| 15 | MINOR: light radius / intensity ramps need setters | Yes: LightLayer.ts lines 99–101 | The §5 shared rules and every table say `setRadius(rx, ry, ms)` / `setIntensity(k, ms)` |
| 16 | MINOR: crackle `n` is a total; `curve` < 1 fades | Yes: synth.ts line 338 | Every `n` is recomputed for ≥ 110/s (arrive 200 / 1.6 s); the gather has a rising `hiss` bed carrying the swell |
| 17 | MINOR: `afterDissolve` offsets off by one | Yes: death.ts line 421 `dissolveF + off` | New map with dissolve = f3: [1, 2, 3] `venomEat` (the holes), [4] `venomSlump`, [5] `venomMarker`, [6] `venomDrip` |
| 18 | MINOR: frame-budget class unclear | Yes: KK-13 and monster-gates have `ace` 7 MB | 133 frames ≈ 4.89 MB passes both; the gates run with `--class ace`; the orchestrator is asked (§10.2); the headroom is reserved for the death/revive, and the idle is not trimmed |
| 19 | MINOR: the card-art sprig echoes C6 | Yes: §5.2 C6 "tek filiz solar" | A dead `stone2` stalk with no green; no plant glyph in the death or the scar |
| 20 | MINOR: holes vanish on dark victims | Valid (an overlay cannot cut transparency) | Holes are filled with the floor tone at that row (`night1`/`night2`, the rule taken from the floor painter) + a `leaf3` rim + a `gold3` lip; `kaVenomAtkDark` films it on abyss_magus |
| 21 | MINOR: direct attack pose pop | Valid | Special f0 = attack f1 exactly and f1 ≤ 1× idleΔ, asserted in the art test; the strike plays `special` from f1 |
| 22 | MINOR: no idle sound | Checked: there is no idle / ambient sound hook in `CHARACTER_SOUNDS` or elsewhere | Specified as conditional (`venomDrip` ≤ 0.08, ≤ once per loop) if the orchestrator adds a hook; nothing is added now |
| 23 | N/A (grown form) | Agreed | No change |
| Bold 1 | Self-corrosion death (lace + stinger marker) | — | **Adopted** as the death (§4, §5.4) |
| Bold 2 | "The scar remembers" | — | **Adopted** (§5.0): old pits flash 3 frames with a `venomDrip` pitch ladder before a new splat, also on the revive pits |
| Bold 3 | A held-breath eat | — | **Adopted** (§5.2): `venomSplat` (duck 0.9) is cut to 0.12 s, then ≥ 80 ms of no venom sound, then three dry close `venomEat` ticks; the steam hiss moves to `venomSteam` at the third tick. The death replays the same three ticks on itself |

