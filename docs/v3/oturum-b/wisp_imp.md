# wisp_imp — Tüy Hayalet / Down Wisp (R3) — working notes

Lane B, branch `claude/kart-b`. Spec: `docs/v3/YENI_KARTLAR.md` §8 R3 (+ §5, §5.1 "pof" owner, §5.2 ending
"tüy yastığı / rüzgar"). Handbook: `docs/v3/oturum-b/HANDBOOK.md`.

> **OWNER FEEDBACK (2026-10-31, via orchestrator) — BLOCKER, must be fixed before this card ships:**
> the frames are **too similar to each other** — needs much more lively motion: bigger pose changes per frame
> (squash/stretch drawn into the pose, feather edges lifting in waves, tail curling, figure-eight drift with real
> amplitude, hands gesturing), in idle and in every one-shot anim. Compare filmstrips side by side: consecutive frames must differ visibly at 1×.

## Status by stage
| Stage | State | Owner / notes |
|---|---|---|
| Sprite rig (`src/art/monsters-v3/wisp_imp*.ts`) | **done, round 1** (rig agent) | 64×62, floor (30,58), hover 6, floater, 13 anims / 134 frames; monster-gates small 21/21 ok |
| Card art (`src/art/cardart-v3/wisp_imp.ts`) | **done, round 2** (2026-10-31 night) | redrawn in the sprite's materials and silhouette; big 88×68 native + small 44×34 hand-drawn ghost + 16×12 icon |
| `portrait()` hook | **added** to `monsters-v3/wisp_imp.ts` | 2 imports + 4 lines, additive (see below) |
| Exclusion in `src/art/monsters/index.ts` | **removed** (rig stage) | only the wisp entry was deleted; the other three stay |
| Light profile (`MONSTER_GLOW`) | **done** | gold-only emissive |
| Death preset (`DEATH_PRESETS`) | **done** | `material: 'light', accent: 'shadow'` |
| Cinematics / SFX / scenarios | **done, round 1** (cinematics agent) | `src/cinematics/kart-b/wisp_imp.ts`, `src/audio/v3/wisp_imp.ts`, `src/duel/scenarios/wisp_imp.ts` |

## Card art (stage: CARD ART + LIGHT PROFILE)
File: `src/art/cardart-v3/wisp_imp.ts` (no import from the rig: it survives any rig rewrite).
Test: `tests/art/wisp_imp-cardart.test.ts` (5 tests: budgets for all 6 frames × 2 sizes incl. checker ≤ 0.5 %,
outline ≥ 90 % ink, focus = white glint with gold3 under it, nothing brighter, blink on f4, determinism, icon).

### Round 2 (2026-10-31 night): why it was redrawn
Round 1 (kept for reference at `<scratch>/wisp_imp/v2/wisp_imp.round1.ts`) was a steel-grey hooded blob with
horizontal wavy tiers in white/mist/steel. The body read as a "hooded slug", not "made of feathers", and its hue
did not match the sprite (white + void lilac): that was rig open issue 6. Round 2 redraws it **in the sprite's
own materials and silhouette**, so the card and the board show the same creature:
- **Ramp** = the rig's feather ramp `void1 · void2 · void3 · void4 · white`, a void0 face hollow (ink brow, void1
  lip), gold3 dot eyes with ONE white glint (the focus). No mist/steel any more.
- **Silhouette** = the sprite's tear-drop: a round white hood, a cowlick curling forward on the crown (it echoes
  the "?"), a lilac wing plume sticking out behind, then two rows of quilled plume shingles over the hood's lower
  edge. They sweep back and down and converge on the tail root. The lower row is lilac and the upper row white.
  Each plume has two half-vanes with a quill seam (the lit half is one value up), barb lines on the shade half
  (big only) and a lilac tip. The ? tail curls up behind on the left.
- **Directional line**: tail (lower left) → eyes (looking up-right) → a tiny three-feather hand REACHING up →
  the loose feather adrift in the lead room (light layer). The spec's "peeking from a heap" stays: the ghost rises
  out of a soft pile of down puffs (void4 / void3 / void2, one step under the ghost), with two flight feathers
  poking out.
- **Small 44×34**: the pile is sampled from the big geometry. The whole ghost is a **hand-drawn 1× map set**
  (`S_GHOST`: tail, wing, cowlick, hood + hollow, 5 plume shingles, hand) on the same composition, because
  sampled plumes and quills broke into noise at 1×. The eyes and the drifting feather are hand-placed.
- **Icon 16×12** redrawn in the same ramp (white hood, void0 hollow, 2 gold3 eyes, lilac plumes over the pile).
- **Iterations** (all LOOKed at, `<scratch>/wisp_imp/v2/a..n`): 14 renders. Rejected on the way: a white
  orb on separate plumes (an astronaut helmet or a squid), long parallel plumes under the face (tentacles or a
  beard), V-notch barb cuts (ink islands), short wide shingles under a fully outlined hood (an owl torso), and a
  sampled small (a mangled tail, a blob hand).

**Numbers (f0)** big: 11 colours (backdrop 6), isolated 2.2 %, checker 2, outline 99.7 % ink, lead 22,
brightOff 14.5. small: 9 colours, isolated 5.5 %, checker 1, outline 95.6 %, lead 10, brightOff 6.0, focus ok.
**Subject bbox fill**: big 0.88 and small 0.90. KART_RESIMLERI §2 asks 0.60–0.75 (big). It sits over that because
the pile spans the window and bleeds off the bottom and left, which the style sheet allows, and the cowlick nearly
touches the top air. crystal_wyrm's small is 0.88 too. This is not test-enforced; it is logged as open issue 4.

## portrait() hook (added to the rig shell, additive)
```ts
import card from '../cardart-v3/wisp_imp';
import { renderArt } from '../cardart-v3/_kit';
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
```
If the rig agent rewrites `monsters-v3/wisp_imp.ts`, keep these lines.

## Light profile (src/view/light/profiles.ts, own line only)
`wisp_imp: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.8), T(PAL.gold2, 0.3)], halo: 0.5, pool: 0.85 }`
- Checked against the new rig: gold3 / gold4 / gold2 appear in `wisp_imp-rig.ts` only in the light pass (eyes,
  sparks). **Rig contract:** keep gold lights-only; the body (white / mist / steel / void4 / void3) is never
  emissive — white, mist and void4 were removed from the old placeholder (they flooded the halo).
- If the rig adds a white-hot eye frame (`hot` → white), it does not glow by design (white is a body tone).

## Death preset (src/cinematics/_v3/presets.ts, own line only)
`wisp_imp: { material: 'light', accent: 'shadow' }` — was `shadow/shadow` (pulled DOWN into the floor: the opposite of
feathers). `light` = pieces drift up and flutter; matterRamp gold→white (white feathers, gold eyes). The custom
deaths (pillow on the monsterEffect event, wind otherwise) belong to the cinematics stage; this is the fallback.

## Evidence (`shots/v3/kart-b/wisp_imp/`) — card art round 2
- `cardart-sheet-f0.png` — big ×3 | small ×6; under them big ×1, small ×1, small ×2.
- `cardart-sheet-f4-blink.png` — the blink frame.
- `cardart-big-x8.png`, `cardart-small-x12.png` — the big and small pictures zoomed (pixel-level check).
- `cardart-faces-vs-peers.png` — real v3 card faces (1×, mini, 2×) next to crystal_wyrm, grim_warden and
  ashen_drake (rendered through `cardFaceCanvas`; the card text is stubbed in that render).
- `cardart-hatcard.png` — `?dev=hatcard&id=wisp_imp&look=v3` ×3: the 1× hand face, the 2× inspect face, the art
  window at 1× and 3×, and the iso field cards (P1/P2, up/side). The face shows the new art live in game.
- `cardart-in-hand.png`, `cardart-in-hand-zoom.png` — `?dev=duel&s=wiSummon&look=v3`: the card in P1's hand (×6 zoom).
- `cardart-icon16.png` — the 16×12 icon ×12 / ×1 / ×2 (redrawn in the new ramp).
- `cardart-mini-downsample-today.png` — (round 1) today's mini, made by downsampling: the eyes are lost, hence the icon.

Scratch tools (not in the tree): `/tmp/claude-0/-home-user-yugioh/77596f6a-069b-5204-8bfc-ba0d0b8509ca/scratchpad/wisp_imp/`
`r.ts` (sheet + stats: `npx vite-node <S>/r.ts -- <outdir> [--all]`), `v2/big.ts` (big ×8 / small ×12),
`v2/dump.ts` (small subject as an ASCII map), `face.test.ts` + `vitest.face.config.mts`
(real faces: `OUT=<S> npx vitest run --config <S>/vitest.face.config.mts`), `icon.ts` (`-- <out.png>`).

## Tests run (card-art stage, round 2)
- `tests/art/wisp_imp-cardart.test.ts`: 5/5 pass. `tests/art/wisp_imp.test.ts` (rig): 7/7 pass.
- `tests/art/cardface-v3.test.ts`: 9/10 pass. The one failure is `G1 … scrap_raiders: 0.692 ≥ 0.7`, which is another
  card's face and fails the same way without this change.
- `npm run typecheck`: no wisp_imp errors.

## Open issues
1. Wire the 16×12 icon in `src/art/cardface-v3/index.ts` (the A5-B registry). It still is not wired: the iso
   field cards in `cardart-hatcard.png` lose the eyes. The edit is 2 lines:
   `import { wispImpIcon } from '../cardart-v3/wisp_imp';` and `wisp_imp: wispImpIcon,` inside `ICON`.
2. ~~In game the face shows the new art only once the exclusion is removed~~. Done: the exclusion is gone and the
   portrait is live (`cardart-hatcard.png`, `cardart-in-hand-zoom.png`).
3. The rig's idle and summon could echo the card's pose (reaching a feather hand up toward a loose feather).
4. Subject bbox fill is 0.88 big and 0.90 small, against the soft budget of 0.60–0.75 (see above). Not test-enforced.
5. Light profile and death preset re-checked this round and left unchanged. The rig still uses gold only in its
   light pass (`wisp_imp-rig.ts` ~630–783: eyes and sparks). If the rig re-run changes the eye tones, re-check
   `MONSTER_GLOW`.

## Sprite rig (stage: RIG + ALL ANIMS, rig agent, 2026-10-31)

### Design note
**References studied:** `abyss_magus-rig/-anims` (keys as deltas over idle f0, per-frame holds, every one-shot
home on idle f0, drape lag, special = gather → release → held aim) and the old `wisp_imp-rig/-anims` (floater
table builder, whole-pixel ellipse body, confetti bursts, erosion into feathers). The rig is new; only the table
builder idea and the confetti/erosion mechanics were kept.

**Silhouette:** a tear-drop: round HOOD (front-right, the dark face hollow on its front with two gold dot eyes) →
five big quilled PLUMES hanging from under the hood and sweeping back-down (back plume sticks out behind like a
wing) → a QUESTION-MARK tail (one long feather with a quill) hooking back up behind. A cowlick feather curls
forward on the crown (echoes the "?"), one LOOSE feather sits in a slot at the back of the hood (it slips out and
clicks back in every idle loop), two tiny three-feather HANDS (near one over the body, far one behind, a value
darker). Rejected on the way (all LOOKed at): smooth SDF teardrop with scallop teeth (noise / spiky fur),
procedural scallop rows (unreadable dashes at this size), three flared tiers (a dress, mottled), thin vertical
plumes (tentacles / squid). Broad plumes with split vanes + quill were the first that read as feathers at 3×/1×.

**Materials / ramps (palette only):** feathers `white / void4 / void3 / void2 / void1` (lit / lilac vane / shade /
deep / underside); each plume = two half-vanes (light-facing half one value up) split by a 1-px quill seam, the
whole plume shifted down a value on the shadow side; hood = ellipsoid planes; tail = tube planes + quill; under-
hood sheet `void2/void1`; face hollow `void0` + `ink` overhang + `void1` lower lip; eyes `gold4/gold3` (`gold2`
shut, `white` core only when white-hot on hitMagic) drawn after the outline (lights only); shadow-side rim
`void3` 1 px; cast shade one step down under every overlapping part (hood lip, plumes, near hand). No mist/steel,
no cyan/crim/teal/mag. NOTE: the card art uses white/mist/steel for the ghost's planes — slight hue difference
from the sprite (white/lilac); both read as "white-lilac". Open issue 6.

**Frame:** 64×62 (48-class + margin for the 130 % puff, the darts, the loose feather), floor point (30, 58),
hover 6 (float point y 52, tail tip ≈ y 50), weight **`floater`** (springy return, 30–40 ms struck hit-stop);
the spec's 60 ms hit-stop for ITS volley is the strike cinematic's job (`stopTime` in the strike) — decision.
Budget class `small`: 64×62×4×134 = 2.13 MB ≤ 2.2 MB, 134 ≤ 140 frames. No victory anim (nobody plays it).
Points: `muzzle` = face hollow (+1 x; darts leave from it), `head` = eyes, `core` = chest, `hand` = near hand
root, `feet` = (30, 58) on every frame.

**Anims (frames / ms / marks):**
| anim | f | ms | marks | motion |
|---|---|---|---|---|
| idle | 20 | 1960 | — | hood breath (±1 px, fractional over f14–f19), tail tip figure-8 (swing 1×, curl 2×), plume edge wave ×2, cowlick + hands trail; loose feather slips out f2, rocks down like a pendulum, glides back, clicks in f16; eyes follow it; blink f17–18 |
| guard | 8 | 1040 | — | ducked/squashed, plumes bristled, both hands over the lower face, eyes peeking; shiver, blink, hand tremble |
| toGuard / fromGuard | 6 / 5 | 390 / 370 | — | startled hop → duck; pop up → stretch → idle f0 (dx 0) |
| roar | 11 | 1150 | charge 1, release=impact 4, recover 7 | inhale squash → rears up, hollow gapes "bö!", hands up, feathers puff off, shiver |
| attack | 14 | 1420 | charge 1, release=impact 5, contact 6, recover 8 | puff to 130 % (long hold f3 170 ms), rock back f4 50 ms, snap + dart volley from the face, second volley, deflated wobble |
| hit | 6 | 570 | impact=contact 0, recover 3 | f0 local (eyes squeeze, cowlick flinch), recoil, 3 feathers knocked loose |
| hitHeavy | 8 | 840 | 0 / 0, recover 3 | = death f0 (eyes x), tumble back, float drops, dizzy, springs up |
| hitMagic | 8 | 840 | 0 / 0, recover 3 | eyes white-hot + sparks (f0 local), every value up + feathers on end (f1), jolt, sag |
| summon | 14 | 1350 | land 9 | single feather rocks down to the tile (f0–f4) → feather fountain swirls up, builds the ghost FACE FIRST (bottom-up) → land squash → "bö!" → idle f0 |
| death | 10 | 860 | impact=contact 0, dissolve 4 | heavy contact → thrown back → crumples → WIND strips it front-to-back, feathers stream backward, eyes last (no pof) |
| revive | 12 | 1240 | land 5 | the wind brings the feathers back from behind → crumpled → fills, first breath, looks around |
| special | 12 | 1230 | charge 1, release=impact 5, recover 8 | THE PILLOW: hugs itself → rounds into a cushion with tufted corners + piping (long hold f3) → squeeze f4 → POOF ring of down (f5) → springs back to the ghost. The effect cinematic should play 0..release and take over from the poof |

### Gates / tests (all green)
- `monster-gates --class small --ref none`: **21 ok, 0 FAIL** (`shots/v3/kart-b/wisp_imp/gates.txt`). Tight
  margins: HA-21 phase max ≈ 49 % (P2 hitHeavy/death vs idle f6), HA-18 liveliness ≈ 15.8 % (idleΔ ≈ 135 px). They
  pull against each other: the sheet never shifts as a whole in idle (a 1-px whole-body shift alone changes 48 %
  of the pixels); the float lives in the hood and the tail. Any idle change must re-run the gates.
- KK-13 render ≈ 3 ms/frame ref-machine (after bbox culling; was 10 ms).
- `tests/art/wisp_imp.test.ts` rewritten for the new design (7 tests) — pass; `wisp_imp-cardart.test.ts`,
  `tests/duel/monster-timing.test.ts` pass. `npm run typecheck` clean.
- `sameness --ids wisp_imp --against all`: no KALIR; **UYARI** pairs (mostly motion-proxy): × seal_head (MOTsig
  0.643, MOTloop 0.823, MOTavg 0.453), × abyss_magus (MOTsig 0.585, MOTavg 0.587), × tide_golem / stone_sentinel
  (MOTsig ≈ 0.61–0.63), × crystal_wyrm (MOTavg 0.483), idle-rhythm UYARI × ashen_drake / steel_silencer /
  seal_leg_l. lumen_sprite (the spec's nearest card) is not flagged. Open issue 7.

### Evidence (`shots/v3/kart-b/wisp_imp/`)
- `sheet/` and `sheet-p2/` — monster-sheet strips of all 13 anims (P1, P2 relit as shown) + per-frame tables.
- `f-<anim>.png`, `f-<anim>-p2.png` — 3× filmstrips (idle, attack, special, death, summon, guard, roar, revive,
  hitHeavy; P1 also hit, hitMagic, toGuard, fromGuard).
- `board.png` — 1× on the tiles (P1 + P2). `m1Imp-rig.png` — in-duel film with the new sprite (generic effect /
  death until the cinematics stage).

### Files (rig stage)
`src/art/monsters-v3/wisp_imp-rig.ts` (rewritten), `wisp_imp-anims.ts` (rewritten), `wisp_imp.ts` (rewritten
shell; the card-art agent's `portrait()` lines are kept), `tests/art/wisp_imp.test.ts` (rewritten),
`src/art/monsters/index.ts` (only the wisp exclusion entry removed).

### Open issues (rig)
5. The dart volley in the sprite is tiny confetti; the real "Tüy Oku Sağanağı" (homing darts, 6 micro jabs,
   60 ms stop) is the strike cinematic's. The pillow's flight to the LP panel / "0 · KORUNDU" is the effect
   cinematic's; the sprite special ends at idle f0 (HA-14), so the cinematic must hide the sprite after release.
6. ~~Card art hue (white/mist/steel) vs sprite (white/void4 lilac)~~ — resolved by card art round 2 (sprite ramp).
7. Sameness UYARI pairs above need a distinction note + blind test in the critique rounds (the silhouette is
   unique; the flags come from point-track motion proxies).
8. Critique rounds with independent critics not run yet in this stage (only self-review, ~25 LOOKed renders).
9. Idle SFX: not built (orchestrator decision 3: optional; log it).

## Cinematics + SFX + scenarios (stage 3, cinematics agent, 2026-10-31)

### Files
- `src/audio/v3/wisp_imp.ts` — 20 recipes + `WISP_IMP_VOICE` (all required roles incl. the revive pair), spread
  through the existing `kart-b.ts` (no shared edit). Palette: 5 kHz feather rustle (white noise band-passed
  4.4–5.6 kHz × irregular 30–70 Hz flutter + 6–7 kHz quill ticks), a tiny ghost voice (triangle + soft saw at
  420–620 Hz through formants "uu" 300/800 and "ö" 380/1500 + breath), chimes in F lydian (off the wyrm's E and
  the warden's B♭ minor), and the game's only "pof" (`wiPof`, effect path only).
  Roles: roar `wiBoo`, arrive `wiDrift`, land `wiLand`, charge `wiPuff`, release `wiVolley`, impact `wiImpact`,
  dissolve `wiGust`, burst `wiAway`, revive `wiReviveGather`/`wiReviveLand`. Extra beats fired by the
  cinematics: `wiTouch`, `wiFountain`, `wiTsk` (cap 8, gap 6 ms), `wiShed`, `wiCloud`, `wiFlock` (sustained),
  `wiStuff`, `wiCatch`, `wiSafe`, `wiPof`.
- `src/cinematics/kart-b/wisp_imp.ts` — every registration `if (LOOK_V3)`, priority 20:
  `kart-b:wisp_imp:summon` (card hook, from hand only; runSummon with an own v3 entrance),
  `kart-b:wisp_imp:strike`, `kart-b:wisp_imp:death` ('destroyed'), `kart-b:wisp_imp:effect`.
- `src/duel/scenarios/wisp_imp.ts` — 14 keys (below).

### What each moment does
- **Summon** (≈2.2 s scene = spec): the summon frame 0's lone feather is moved down from 62 px above the tile
  for 500 ms, swinging like a pendulum (frames 0/1 = its two tilts, positions compensated so the feather never
  jumps), a cool light follows it; the unit's drop shadow is hidden until the fountain has built a body.
  Sprite summon pose takes over: touch (tick + high ping, floor ripple rings of down, light flash), a
  feather FOUNTAIN whirls up round the ghost (back half behind the sprite, front half in front, its own
  raster), flung out on 'land' (down "fumf", 1-px shake, second ripple), "bö!" on land+1 (gold eye flash, a
  crown of 6 feathers pops off, badge pop). No hologram (the feathers build it).
- **Strike "Tüy Oku Sağanağı"**: continues from the declaration's puff (takeCharge 'wiPuff'); on 'release'
  six feather darts (7–9 px whole-pixel feathers with a down-speck trail) leave the release frame's face
  hollow on fanned cubic arcs and home in (staggered 34 ms, a gap after the third). First arrival = contact:
  `s.impact`, `wiImpact`, **stopTime 60 ms** (the spec's hit-stop; the art stays weight `floater`), white light
  flash. Others: `wiTsk` + a white "tsk" cross → lilac ring + a puff of down; darts stick in the body (follow
  its knock-back, quiver 1 px) for ~320 ms then flake off and flutter down. Blocked: they glance off and
  tumble; the wisp plays its hit after the backlash. Direct: they pepper the duelist. `wiShed` on 'recover'.
- **Death without the event (wind)**: deathV3-style bookkeeping without the material shatter; joins a
  planned lethal entry / guard break like `posedDeath`; the sprite's death pose strips it while gust streaks
  cross the tile and peeled feathers stream downwind (backward = away from where it faces); `wiGust` on
  'dissolve', the card is born at dissolve+3, `wiAway` on the last frame. **No pof.**
- **Effect = the feather pillow** (the effect hook owns the death: it finds the wisp's `destroy` and
  `ctx.play(di, { pillow: { amount, owner }, hit: false })`; amount = |attackerAtk − targetValue| of the
  battle just before): special 0…release at timeScale 1.3 (hug → cushion → squeeze), its poof frame one beat,
  then the body IS a cloud (`wiCloud`, 9 heavy feathers float down on the tile, the card leaves) → 42 feathers
  stream on bezier arcs to the owner's LP panel on a HUD-depth raster (`wiFlock`) → they pack into a pillow
  with the ghost's face (dark hollow + gold eyes, tufted corners, piped seam, ink outline) over the LP digits
  (`wiStuff`) → the "-N" number drops in from the field side and smacks into it (`wiCatch`: squash wide/flat,
  eyes "> <", overshoot) → eyes "^ ^", gold "0 · KORUNDU" above (P1) / below (P2) the panel + a gold ring
  (`wiSafe`) → **POF** (`wiPof`): lumpy cloud ring + 34 down specks drifting; the label blinks out.

### Scenario keys (P1 + P2)
`wiSummon`, `wiSummonP2` (normal summon) · `wiAttack`, `wiAttackP2` (vs attack-position shield_titan 100: wins)
· `wiDirect`, `wiDirectP2` · `wiBlocked` (vs defending stone_sentinel: darts glance off, 1800 to it) ·
`wiGuard` (in defense vs shield_titan: guard holds) · `wiCushion`, `wiCushionP2` (shade_assassin 1900 attacks
the ATK wisp: pillow takes 1600) · `wiCushionSelf`, `wiCushionSelfP2` (wisp attacks a stronger stone_sentinel:
pillow takes its own 200; = `m1Imp`) · `wiDefDies`, `wiDefDiesP2` (killed in defense: no event → wind).
NOTE: the handbook suggested ember_wolf for the cushion; it has its own on-destroy burn trigger
(`battleDestroyBurn300`) that adds a 2.2 s effect + damage to the film, so shade_assassin (no effect) is used.

### Gates (this stage)
- typecheck: clean for every wisp file. Tests: `tests/art/wisp_imp*.test.ts` + `tests/presentation` 89/89.
- v1: `filmdiff --set v1` **17/17 IDENTICAL**.
- Camera: base taken with this file moved out (`<scratch>/wisp_imp/camera-base.json`), then
  `measure --camera-gate`: **15 ok, 0 FAIL** (wi* + m1Imp; focusCalls = base, zoom 1).
- Budgets (game clock, `<scratch>/wisp_imp/m2.json`): summon 3000 ms (spec 2.2 s × 1.35; no REHBER row for a
  normal summon) · declaration 316 ≤ 435 · attack battle 2017 ≤ 3190 · direct battle 2017 ≤ 2320 · blocked
  2084 · guard 1217 · effect (pillow incl. the death) 2216 ≤ 2320 · wind death 1050 ≤ 2030 · number − contact 0.
  In `wiCushion` the battle event spans 5.2 s only because the trigger plays inside it (battle part ≈ 2.95 s,
  shade_assassin's own strike).
- palcheck (a5 rules) on effect windows: pillow window (HUD + field clip) Δoff max +0.20 pt ok; summon
  window Δoff +0.82 ok. FAILs only on (a) `white` > 1.5 %, which the frame-0 scene already has (bright statues
  + the white-bodied wisp sprite itself: rig-owned body tone, not an effect), and (b) Δoff spikes from OTHER
  cards' effects inside the clip (shade_assassin's slash at t≈2040, shield_titan's shatter at t≈1680).
- Evidence (`shots/v3/kart-b/wisp_imp/`): `wiSummon.png`, `wiAttack.png`, `wiAttack-contact.png`,
  `wiAttack-contact2.png`, `wiAttackP2.png`, `wiDirect.png`, `wiBlocked.png`, `wiCushion.png`,
  `wiCushion-pillow.png` (P2 panel), `wiCushionP2-pillow.png` (P1 panel), `wiCushionSelf.png`,
  `wiCushionSelf-pillow.png`, `wiDefDies.png`, `sfx/wi*.png` (spectrograms: wiPof, wiBoo, wiDrift, wiImpact,
  wiGust, wiCatch, wiSafe, wiPuff, wiVolley, wiCloud, wiFountain).

### Open issues (stage 3)
10. Idle SFX not built (decision 3: optional) — the feather rustle + tiny "hu" would need a per-unit
    `animationupdate` listener; left out.
11. Struck-body material for feathers: no generated feather hit; the generic struck sound plays when the
    wisp is hit (decision 4: shared tables untouched).
12. Only one round of self-critique on the films (no independent critic agents yet). Candidates: the
    pre-roll feather is small at 1×; the darts read best at 2×+; the pillow's -N flight could start closer
    to the flock's arrival; the pause (~0.75 s game) between the contact and the pillow is the battle kit's.
13. No MP4 clip (`tools/clip.mjs`) made yet for the owner's ears; peaks from the audio page: all chain
    peaks ≤ 0.85.
14. Revive pair (`wiReviveGather/Land`) written but not filmed (soul_recall scenario not run).

## Rig re-run (stage: RIG + ALL ANIMS re-issued, 2026-10-31 evening)
The rig stage was re-issued with the original brief, which still calls the files the "old puffball". They are not:
the R3 feather ghost described above is the current design, and the exclusion entry is already gone. This pass
checked it again and changed no code:
- Fresh sheets P1 + P2 (`<scratch>/wisp_imp/sheet*`): `monster-gates --class small --ref none` gives **21 ok, 0 FAIL**
  (`shots/v3/kart-b/wisp_imp/gates.txt`). The HA-21 phase (≈49 %) and HA-18 (≈15.8 %) margins are still tight.
- `tests/art/wisp_imp.test.ts`, `wisp_imp-cardart.test.ts` and `tests/duel/monster-timing.test.ts` pass, and typecheck shows no wisp errors.
- LOOKed again at idle ×6 (`recheck-idle-x6.png`), attack, special, death and summon, plus P2 roar, hit, hitMagic,
  hitHeavy, toGuard, fromGuard, guard and revive (`recheck-p2-misc.png`). All are on-model; P2 is lit from the right and no anim is broken.
- Spec gap noted (open issue 15): the spec asks for a "lazy figure-8" float. In the sprite it lives only in the hood/tail,
  because a whole-body 1-px shift breaks HA-21 phase, and MonsterUnit has no hover bob. A unit-level floater drift
  (sprite y/x tween in v3) would need a shared MonsterUnit change, so it needs an orchestrator decision.
