# mudgrasp_spirit — Çamur Pençe Ruhu / Mudgrasp Spirit (C10) — working notes

Lane B, branch `claude/kart-b`. Spec: `docs/v3/YENI_KARTLAR.md` §6 C10 (+ §5, §5.1 owner of the slow `growl` moan and
the 600 Hz suction "şlop", §5.2 ending "sıvı olup karoya geri akar"). Handbook: `docs/v3/oturum-b/HANDBOOK.md`.

> **OWNER FEEDBACK (2026-10-31, via orchestrator) — BLOCKER, must be fixed before this card ships:**
> the draft sheet reads as a **blurry brown mass at 1×**. Needs much clearer value separation and a readable silhouette:
> distinct light/mid/shadow planes on the mound, a mask that pops (lightest value + ink separation), arms separated from
> the body by darker creases / rim light, purple eyes as the brightest accent. Check at 1× (no zoom) next to other monsters.

## Status by stage
| Stage | State | Notes |
|---|---|---|
| Sprite rig (`src/art/monsters-v3/mudgrasp_spirit*.ts`) | **round 2 done** (readability redesign for the owner blocker; all 13 anims re-checked, gates 21 ok / 0 FAIL, test 11/11) | registered in v3 (file `mudgrasp_spirit.ts`); frame now 92×78, anchor (40, 71) |
| Card art (`src/art/cardart-v3/mudgrasp_spirit.ts`) + `portrait()` | **done, round 2** (value pass for the owner's "brown mass" note) | `portrait()` wired in `monsters-v3/mudgrasp_spirit.ts` (unchanged); see *Card art* below |
| `DEATH_PRESETS` | **done**: `material: 'water', accent: 'shadow'` (stone/ash endings are reserved) | `src/cinematics/_v3/presets.ts` own line |
| `MONSTER_GLOW` | **done**: `void4 / void3 / white` emissive, `near void2`, `spill void3` (no body tone) | `src/view/light/profiles.ts` own line |
| Scenarios (`src/duel/scenarios/mudgrasp_spirit.ts`) | base set: `mgSummon(P2)`, `mgPin(P2)`, `mgPinKill`, `mgAttack`, `mgKill`, `mgIdle` | cinematic stage adds `mgSet`, `mgPinFlip`, `mgPinLock` |
| Cinematics / SFX | not started | summon / strike / death / pin effect + aura; `src/audio/v3/mudgrasp_spirit.ts` |

## Round 2 — readability redesign (owner blocker "blurry brown mass at 1×"), 2026-10-31

What changed in the rig (same Pose API + anim tables, so the cinematic agents' frame numbers / marks still hold):
- **Value ladder, darkest → brightest:** cowl cavity `void0`/`void1` → mud mound `earth0 / earth1 / earth2` as three real
  flat planes (blobShade lit 0.6 / shade 0.22, bigger `earth3` wet glints) → ARMS one value lighter (`earth1 / earth2 /
  earth3`, near forearm gloss `earth4` 1 px) split from the body by `earth0` creases → far arms back a value (`earth0 /
  earth1 / earth2`) → the CLAY MASK (`stone4 / stone3`, `stone2` only under the chin, `stone1` crack) — the lightest big
  value, separated from the hood by an **ink** ring (owner asked for ink separation; it is a separate rigid object) → the
  violet eyes `void3 / void4 / white` as the brightest accent.
- **Silhouette:** a HOODED spirit. The mud head became a **cowl** arching over and behind the mask (drooping tip over the
  hump) around a violet-black cavity open toward the foe — pale face in a dark hole reads at 1×. Torso slimmer and taller
  (rad −1.5, hump +5). Arms are thinner (5–6 → 3.5–6 px) **spider-leg arches** with negative space under them: near arm,
  a second far front arm arching ahead (no longer the confusing hood arch over the mask), TWO long rear arms arching back
  (elbows up), and the crown arm reaching up off the hump = five arms, "many long mud arms" now reads.
- **Mask:** new 15×18 3/4 haniwa map (wide near socket, foreshortened far socket, round mouth, brow ridge, crack); tones
  from a clay-ellipsoid normal · key light (+ P2 lift), so P1 and P2 are each lit from their own top-left (IŞ-2).
- **Violet life in the mud (light layer, never outlined):** two crack glows on the mound that brighten on the swell, a
  1-px `void1` bounce rim on the shade-side lower edge of the mound, the cowl cavity edge.
- **Layering flags (new Pose fields):** `nBack` — the attack's cocked arm passes BEHIND the hood (f3–f5) instead of
  crossing the face; `aFront` — in guard the crown arm curls OVER the hood as a lid (fingers over the brow, peeks on f4).
- Anim fixes: idle far/rear palms keep their grip (HA-9 band), crown sway ±11°, a held-in violet breath in the mouth
  on the swell; guard keeps the planted far/rear hands (band fixed); attack release lower (ny −27) so the throwing arm
  passes under the mask; roar crown length 0.97 (top margin); summon f6 climb 0; hit / hitHeavy / death f0 swell 0
  (HA-21 phase 47.5 % < 50 %).
- Frame 92×76 → **92×78**, GY 69 → **71** (2 px head-room for the taller crown); 124 frames = 3.56 MB ≤ 3.6 MB (medium).

## Design note (rig stage, round 1 — kept for the anim list; geometry / tones superseded by round 2 above)

**References studied:** `steel_silencer` (rig/anims split, `Comp` bounding-box compositor, edge-measured flat bands,
pose tables + `mix/snap`, cached `framePose`), `crystal_wyrm` / `abyss_magus` (G-buffer normal shading idea, rigid hand
maps with `_L/_R` tones, light pass after the outline), `stone_sentinel` (64-class size and density).

**Silhouette (facing right):** a NEW body plan — no legs, no float. A flat wet PUDDLE on the tile (the "feet") with a
lumpy MOUND; a hunched mud torso grows out of it (blob chain along a curved spine base → hump → neck); a pale cracked
haniwa-like CLAY MASK (round hollow eyes + round moaning mouth) on a mud head at the front; FOUR long mud arms with
distinct directions so the silhouette reads at 1×: the near arm planted low in front (drumming fingers), the far arm
arching high over and behind the mask like a hood and planted ahead, a crown arm reaching UP off the hump with an open
"grave hand", and a short rear arm gripping the puddle behind. (A fifth "curl-back" crown arm exists in the rig,
`bl > 0`, unused for now — it cluttered the 64-class silhouette.)

**Materials / ramps:** mud `earth0..2` + wet highlight `earth3` (only the hottest spot of a blob); far parts one value
darker (`earth1/earth0`); mask `stone1..4` (hand map, tones chosen per light: P1 side plane lit, P2 front plane lit);
lights `void0..4` + `white` (eyes, mouth glow, veins, bubble pops, vortex core) painted after the outline, never
outlined. ≤ 15 body colours. Torso / head use `blobShade` (normal of the deepest of 3 big blobs · key light → 3 flat
tones, despeckled), so the body reads as slumping wet lumps, not as a banded cylinder. Arms use edge bands.

**Frame:** 92×76, anchor (40, 69), hover 0, weight `medium` (60–80 ms contact hit-stop), `p2: 'relight'`, 124 frames
= 3.47 MB (class `medium`, ≤ 3.6 MB). Paint ≈ 1.5 ms/frame (ref machine). Points: `muzzle` = `hand` = near palm
(throw origin), `claw` = far palm, `head` = near eye, `core` = torso, `feet` = anchor; all clamped ≥ ground.

**Anims (frames · ms · marks):**
| anim | f | ms | marks | what |
|---|---|---|---|---|
| idle | 16 | 1880 | – | swell (period 8) → head bob a frame later → crown arm sway (2 periods) ; fingers drum in sequence; 3 back bubbles swell and pop (violet pop pixel); chin + forearm drips; puddle ripple ring loops; blink |
| guard | 8 | 1240 | – | "closed wall": the mud swells up into a rampart (wider mound, fatter), near arm a bar under the mask, crown arm a lid that slowly lifts to peek and drops fast |
| toGuard / fromGuard | 6 / 5 | 360 / 350 | – | crown arm leads / lags the body |
| attack "Çamur Atışı" | 12 | 1290 | charge 1, release=impact 6, contact 7, recover 8 | scoop from the mound → fistful (own blob) cocked behind the head, 190 ms hold → 50 ms swing → release (ball leaves the palm) → follow-through → hand slaps down and SINKS (splash, ripple) → pulled out |
| roar (moan) | 10 | 1110 | charge 1, release 4, recover 6 | gathers low → rises, crown hand reaches high, mouth glows void3/void4, veins light, bubbles boil, ripple |
| hit | 6 | 580 | impact=contact 0, recover 3 | mask knocked back, mud spray off the chest, wobble |
| hitHeavy | 8 | 860 | 0 / recover 3 | squashed down into the puddle, arms splay, splash ring, reforms |
| hitMagic | 8 | 750 | 0 / recover 4 | violet veins blaze through the mud, eyes white, 1-px tremor, boiling bubbles |
| summon (climb) | 13 | 1400 | land 7 | vortex in the puddle → two hands BURST up → slap down gripping the puddle edges → the mask surfaces and the body is hauled up between the hands → land (ripple) → the mask seats with a click (glint), eyes ignite → shake-off |
| death | 10 | 830 | impact=contact 0, dissolve 4 | hit → the mask slips, the body loses shape → liquefies and runs back into the puddle (vortex reversed, arms melt and sag) → the mask slides down, lies in the puddle and SINKS LAST → only the puddle + violet vortex core. No drying / crumbling. |
| revive | 10 | 1050 | land 6 | the death backwards: vortex in, the mask surfaces first, the mud gathers under it, first breath |
| special "Pençe kilidi" | 12 | 1350 | charge 1, release=impact 5, contact 6, recover 9 | both arms rise in front (mask kept clear, `nb: 1`) → 170 ms hold → swing → PLUNGE into the ground (splash) → leans back and PULLS (veins blaze, mouth moans, tremor); f8 (200 ms) is the hold frame the pin cinematic can freeze for the 1.6 s lock → arms come back out |

No `victory` (budget; nothing plays it). `MonsterAnimExtra` is a closed union, so the climb lives in `summon` and the
plant/pull in `special`.

## Evidence (round 2)
- Before / after: `shots/v3/kart-b/mudgrasp_spirit/r1-idle-f0-before-x2.png` → `r2-idle-f0-p1p2-x6.png`
- Key poses ×3: `shots/v3/kart-b/mudgrasp_spirit/r2-keyposes-x3.png`
- 1× in the duel: `shots/v3/kart-b/mudgrasp_spirit/mgIdle-1x.png`, zoom `mgIdle-x3.png`
- Sheets P1 / P2 (all 13 anims, ×3, points): `sheet-p1/`, `sheet-p2/` (re-rendered)
- monster-gates `--class medium --ref none`: `gates.txt` — 21 ok, 0 FAIL (liveliness 16.7 / 15.5 %, guard Δ 0.70,
  HA-21 phase ≤ 48.1 %, HA-9 band fixed, margins ≥ 2, noise idle 4.6 %, 1.7 ms/frame)
- Sameness: `sameness/` — same out-of-plan UYARI set as round 1 (attack point track vs steel_silencer 0.91 /
  stone_sentinel 0.84; guard proxy vs thorn_lurker 0.97); distinction header in `-anims.ts`, blind test still open.
- Test `tests/art/mudgrasp_spirit.test.ts`: 11/11 (new: "reads at 1×" — mask ≥ 120 px stone3/4 with an ink ring,
  ≥ 60 px earth3 lit arm bands, all three body values ≥ 150 px, P1 and P2).

## Evidence (rig stage, round 1)
- Sheets P1 / P2 (×3, points): `shots/v3/kart-b/mudgrasp_spirit/sheet-p1/`, `.../sheet-p2/` (per-anim strips + `-all.png`)
- Idle ×6: `shots/v3/kart-b/mudgrasp_spirit/idle-x6/mudgrasp_spirit-v3-idle.png`
- monster-gates (`--class medium --ref none`): `shots/v3/kart-b/mudgrasp_spirit/gates.txt` — **21 ok, 0 FAIL**
  (idle liveliness 16.1 % / 15.1 %, guard Δ 0.48, HA-21 phase ≤ 45 %, feet band fixed, margins ≥ 2)
- 1× in a duel (default cinematics): `shots/v3/kart-b/mudgrasp_spirit/mgIdle-1x.png`; board: `board-1x.png`
- Sameness (all, out of plan): `shots/v3/kart-b/mudgrasp_spirit/sameness-all.txt`
- Test: `tests/art/mudgrasp_spirit.test.ts` (10 tests, green): validateArt normal / projectile, KK-13 budget,
  determinism + P2 silhouette, size, HA-9 puddle band, palette (earth/stone/void/ink/white only), eye lights,
  liquid death ending (mask sinks last), death preset `water`.

## Card art (stage: CARD ART + LIGHT PROFILE, round 2)

Spec line: "Ortada maske, izleyiciye uzanan çamur eller". Native painting (no sprite pixels → independent of the rig
rework in progress). Round 1 read as a brown smear with spiky "starburst" hands; round 2 changes:
- **Value plan** (owner note applied to the card): mask lightest · hands mid-light · body mid/dark · sky darkest.
  EARTH sun tightened to radius 25 → a halo right behind the mask (pale clay on earth2/earth3), the mud body now
  stands on the dark earth0 sky / earth1 ridge instead of on the sun.
- **Body** = six lumps, **blob-shaded** (`shadeBlobs`, the rig's blobShade idea: normal of the deepest lump · key
  light → earth2/earth1/earth0, despeckled) → slumping wet lumps; wet gloss (earth3 streak + one earth4 catch) on
  the hump and far-flank crowns = the material cue that separates mud from hollow_ogre's matte wood (same EARTH
  backdrop, adjacent card). Random crease lines and the long vertical vein stroke removed (one short forked vein).
- **Hands**: procedural finger fans read as sticks/logs (tried 3 variants) → three **hand-drawn 1:1 big maps**
  (`HAND_NEAR_BIG`, `HAND_FAR_BIG`, `HAND_CROWN_BIG`): chubby clay fingers parted by ink, lit tips with a hot pixel,
  cupped earth0 palm, earth3 shadow-side rim, wrist drip, one earth4 wet catch. The near/far arms come straight at
  the viewer, so the palms hide them (a visible diagonal forearm across the chest was tried twice and read as a
  staff / clutter — dropped). A 4th hand claws up out of the puddle between them (`HAND_RISING_BIG`, "çok kol").
- **Small** 44×34: same geometry ×0.5 with the same blob shading; hand maps updated (lit tips, dark cupped palms);
  the procedural near arm dropped. Reads at 1× on the face: pale mask + violet eyes + two open hands.
- Focus = near-eye white glint (only white pixel), brightest point; living art unchanged (glint pulse, bubble pop).

Stats (frame 0): big 16 colours / backdrop 5, isolated 2.9 %, checker 0, ink outline 100 %, focus ok;
small 14 colours, isolated 5.0 %, checker 0, ink 99 %, focus ok. `subjectFill` (bbox) is 0.83 / 0.87 — over the
0.6–0.75 guideline because the hands bleed off both bottom corners by design (allowed: "alttan taşabilir"); the
card test does not gate it. Cover is 0.51 / 0.59.

Evidence: `shots/v3/kart-b/mudgrasp_spirit/cardart-big-x3.png`, `cardart-big-x6.png`, `cardart-small-x1.png`,
`cardart-small-x6.png`, `cardart-living-big-x3.png`, `cardart-living-small-x4.png`, `cardart-hatcard.png`
(`?dev=hatcard&id=mudgrasp_spirit&look=v3`: 1× face, 2× face, art, field minis), `cardart-icon-x12.png` (icon unchanged).

Tests: `tests/art/mudgrasp_spirit-cardart.test.ts` 5/5 green; `tests/art/mudgrasp_spirit.test.ts` 11/11 green;
`tests/art/cardface-v3.test.ts` 9/10 — the one failure is G1 for **scrap_raiders** (0.692 < 0.7, not lane B, not
caused by this card). A scratch run of the same G1 check on the lane-B ids: mudgrasp_spirit 0.704, grim_warden
0.770, wisp_imp 0.713, hollow_ogre 0.708 (all pass; mudgrasp is close to the line — the frame region does not
depend on the art).

Light profile (`src/view/light/profiles.ts`, own line) re-checked against the rig in progress: void2–void4 + white
are used only by the eyes / mouth glow / veins / pops; emissive `void4, void3, white`, near `void2`, spill `void3`
kept. DEATH_PRESETS `water / shadow` kept.

## Open issues
1. **Sameness UYARI (out of plan)**: attack point-track MOT vs steel_silencer 0.905 / stone_sentinel 0.845 / abyss_magus
   0.77; guard loop proxy vs thorn_lurker 0.91 (both near-still loops vs idle f0 — tried an asymmetric peek loop and a
   rising rampart, the proxy barely moved). Distinction header written in `mudgrasp_spirit-anims.ts`; a **blind eye
   test** is still to do (critic round).
2. The default summon (no cinematic yet) plays the generic hologram build, so the climb anim only shows in sheets
   until `kart-b/mudgrasp_spirit.ts` runs `runSummon(…, v3Entrance)` with `S.pose`. Hands should land on the tile
   edges there (the sprite's hands grip the puddle rim at x ≈ anchor ± 28).
3. The sprite death ends on a puddle with a violet core (sprite ≤ 0.9 s); the "flows into the tile cracks" beat
   is cinematic work (option (b) death, HANDBOOK §6.3).
4. The pin: special f8 is the hold frame; the attacker-side mud hands + 6 px ring + aura are cinematic / aura work.
5. Idle SFX (glub + finger drum) and struck-body mud material sound: see orchestrator decisions (3)/(4) — later stage.
7. (round 2) Summon f6: the near rear arm's arch leaves a small squarish gap against the body (reads as a gripping arm,
   minor). Special pull f6–f8: the plunged near arm is nearly straight; the far front arm's plunge is mostly hidden.
   Both are candidates for the critic round.
8. (round 2) In the duel the light layer darkens the mud; the mask + eyes carry the read. A critic should confirm the
   1× read next to stone_sentinel / crystal_wyrm (`mgIdle-x3.png`).
6. At 1× the brown body is large next to 64-class neighbours (bbox ≈ 75×57 incl. puddle and the raised hand); the
   body mass itself is ≈ 45 px wide. Critics may want it a notch smaller.
9. Card art: the rig is being reworked (owner "brown mass" blocker). If the rework changes the mask shape
   (e.g. haniwa hollow eyes) or the arm design, re-align the card's mask (`MASK_OUT`, `EYE_N/EYE_F/MOUTH`) and
   the small maps; the card does not import rig code, so nothing breaks automatically.
