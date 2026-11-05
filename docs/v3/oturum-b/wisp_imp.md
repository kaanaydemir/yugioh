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
| Card art (`src/art/cardart-v3/wisp_imp.ts`) | **done, round 4** (2026-11-01) | round 3 = the rig's tear-drop silhouette; round 4 = polish: pale-quill heap feathers, three-finger hand, a real loose feather, small hand with a raised finger |
| `portrait()` hook | **added** to `monsters-v3/wisp_imp.ts` | 2 imports + 4 lines, additive (see below) |
| Exclusion in `src/art/monsters/index.ts` | **removed** (rig stage) | only the wisp entry was deleted; the other three stay |
| Light profile (`MONSTER_GLOW`) | **done** | gold-only emissive |
| Death preset (`DEATH_PRESETS`) | **done** | `material: 'light', accent: 'shadow'` |
| Cinematics / SFX / scenarios | **done, round 2** (cinematics agent; see round-2 section) | `src/cinematics/kart-b/wisp_imp.ts`, `src/audio/v3/wisp_imp.ts`, `src/duel/scenarios/wisp_imp.ts` |

## Card art (stage: CARD ART + LIGHT PROFILE)
File: `src/art/cardart-v3/wisp_imp.ts` (no import from the rig: it survives any rig rewrite).
Test: `tests/art/wisp_imp-cardart.test.ts` (5 tests: budgets for all 6 frames × 2 sizes incl. checker ≤ 0.5 %,
outline ≥ 90 % ink, focus = white glint with gold3 under it, nothing brighter, blink on f4, determinism, icon).

### Round 4 (2026-11-01, card-art stage re-issued): polish on round 3
Round 3's composition and silhouette were kept (they match the rig). LOOKed at ×9 / ×16, three weak reads were fixed:
- **Heap read as purple shards / rocks** → heap plumes get `lightQuill` (the rachis is one value UP, it catches the
  moon) instead of the dark seam. Small: pale quill runs (w) hand-drawn into the three front heap feathers.
- **Hand read as a mitten blob** → `HAND_BIG` redrawn 11×12 at (53,28): three feather fingers inked apart, the front
  one reaching up toward the feather. Small: the blob gets one raised finger (rows 11–18, cols 26–33) that points
  at the drifting feather — the directional line now reads at 1×.
- **Loose feather read as a stick** → `DRIFT_BIG` redrawn 13×12 at (68,4): broad lit vane with one notch, void4
  quill, void3 lower vane, curved. Still in the light layer (white = equal to the focus, never brighter).
- Tried and dropped: herringbone barb chevrons inside the body strips (only ~2 px dots at this scale; the body
  stays the spec's "çarşaf" sheet with feather tips at the hem).
**Numbers (f0)** big 11 colours, isolated 2.2 %, checker 7 (0.13 %), outline 99.7 % ink, focus ok, lead 22;
small 9 colours, isolated 3.8 %, checker 1, outline 100 %, focus ok, lead 9 (the raised finger takes 2 px of lead).
**Evidence** `shots/v3/kart-b/wisp_imp/cardart-r4/`: `sheet-f0.png`, `sheet-f4-blink.png`, `big-x9.png` (big ×9 |
small ×9 | 1×), `small-x16.png`, `round3-vs-round4.png` (top round 3, bottom round 4), `hatcard.png`
(`?dev=hatcard&id=wisp_imp&look=v3` ×2), `in-hand.png` + `in-hand-zoom.png` (`?dev=duel&s=wiSummon&look=v3`).
Round-3 copy: `<scratch>/wisp_imp/ca4/wisp_imp.round3.ts` (imports rewritten to absolute paths).
**Tests (round 4)**: `tests/art/wisp_imp-cardart.test.ts` 5/5, `tests/art/wisp_imp.test.ts` 7/7,
`tests/art/cardface-v3.test.ts` 9/10 (the same pre-existing `G1 … scrap_raiders 0.692 ≥ 0.7`, another card).
tsc: no wisp errors. `portrait()` hook still present in `monsters-v3/wisp_imp.ts` (lines 17–18, 43–45).
**Light profile / death preset**: re-checked against the current rig (gold4/gold3/gold2 only in the eye + spark
light pass, `wisp_imp-rig.ts` ~650–803; the `hot` eye frame is white = body tone, not emissive by design):
`MONSTER_GLOW` and `DEATH_PRESETS` lines left unchanged.

### Round 3 (2026-11-01): why it was redrawn again
Round 2 (kept at `<scratch>/wisp_imp/ca3/wisp_imp.round2.ts`) hung six separately inked plumes under the face; on
the real card face it read as a squid / a beard, its face was a side-open hood, and at 1× the small broke into noise
(the left wing read as an axe, the hand as a broken claw). The rig (re-run 3) is a sack-like tear-drop with a ROUND
dark hollow. Round 3 follows the rig:
- **Hood + face**: same ellipsoid; the hollow is now a closed round ellipse (FX 49.5, FRX 6.6) with white still
  around it — the sprite's face. Eyes moved with it (focus (47,19), small focus (23,10)).
- **Body = one silhouette**: hood ∪ a tapered skirt along a quadratic line (43,24)→(44,47)→(21,54) (a full sack
  under the face, then the sweep back to the tail root), outlined ONCE. Feather texture inside it: four lateral
  strips (lit half-vane +1, a crease where the next strip overlaps, lilac pointed tips that notch the hem).
  Tried and rejected on the way (all LOOKed at, `<scratch>/wisp_imp/ca3/`): narrower separate plumes (still
  tentacles), a fish-scale crease grid (noise), per-feather stamps (mush), horizontal hem tiers (curtain stripes).
- **Separate feathers only where they should read separate**: two plume tips behind the back edge (roof tiles; a
  third one at head height read as a beak in the hand view — removed), the heap, the drifting feather.
- **Heap = feathers**, not down puffs: a low void2/void1 mound with ten inked, quilled feathers fanned from both
  sides (the round-2 puffs read as grapes / cobbles). The pile sits lower so the whole tear-drop + ? curl shows.
- **Small 44×34**: a full hand map `S_SUBJECT` (generator `<scratch>/wisp_imp/ca3/small_map.py`: the big geometry
  at 1× + hand-drawn ? curl and cowlick, two creases, two back tips, five heap feathers, hand). Eyes + drift in light.
- **Icon 16×12** redrawn: round hood, closed hollow with 2 gold3 eyes, tear-drop into the curl, heap.
- Code cleaned: unused round-2 paths (puffs, pokes, S_GHOST maps) removed; `plumeAt` no longer takes `k`.

**Numbers (f0)** big: 11 colours (backdrop 6), isolated 2.0 %, checker 6 (0.11 %), outline 99.6 % ink, lead 22.
small: 9 colours, isolated 3.4 %, checker 1, outline 100 % ink, lead 11, focus ok. Subject bbox fill big 0.98 /
small 1.0 — the heap spans the window (bleeds left/right/bottom, allowed); the ghost alone is ≈ 0.55 × 0.80.

**Evidence** `shots/v3/kart-b/wisp_imp/cardart-r3/`: `sheet-f0.png` (big ×3 | small ×6 | 1× / 2×),
`sheet-f4-blink.png`, `big-x9.png`, `small-x16.png`, `round2-vs-round3.png` (top: round 2, bottom: round 3),
`faces-vs-peers.png` (real v3 faces 1× / mini / 2× next to crystal_wyrm, grim_warden, ashen_drake),
`hatcard.png` (`?dev=hatcard&id=wisp_imp&look=v3` ×2: hand face, inspect face, window, iso field cards),
`in-hand.png` + `in-hand-zoom.png` (`?dev=duel&s=wiSummon&look=v3`, the card in P1's hand), `icon16.png`.

**Tests (round 3)**: `tests/art/wisp_imp-cardart.test.ts` 5/5, `tests/art/wisp_imp.test.ts` 7/7,
`tests/art/cardface-v3.test.ts` 9/10 — the one failure is the pre-existing `G1 … scrap_raiders 0.692 ≥ 0.7`
(another card). `npx tsc --noEmit`: 0 errors. Light profile + death preset re-checked against rig re-run 3
(gold only in `paintEyes` / sparks, lines ~641–803): unchanged.

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
1. (still open after round 3) Wire the 16×12 icon in `src/art/cardface-v3/index.ts` (the A5-B registry). It still is not wired: the iso
   field cards in `cardart-hatcard.png` lose the eyes. The edit is 2 lines:
   `import { wispImpIcon } from '../cardart-v3/wisp_imp';` and `wisp_imp: wispImpIcon,` inside `ICON`.
2. ~~In game the face shows the new art only once the exclusion is removed~~. Done: the exclusion is gone and the
   portrait is live (`cardart-hatcard.png`, `cardart-in-hand-zoom.png`).
3. The rig's idle and summon could echo the card's pose (reaching a feather hand up toward a loose feather).
4. Subject bbox fill is 0.98 big / 1.0 small after round 3 (the heap spans the window), against the soft budget of
   0.60–0.75. Not test-enforced; the ghost alone is inside it.
6. (round 3) The 2× inspect face in `?dev=hatcard` still shows the SMALL doubled, not the 88×68 big (shared face
   integration, KART_RESIMLERI §10 "Entegrasyon"; not this card's file).
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

## Cinematics + SFX + scenarios — round 2 (stage re-issued, cinematics agent, 2026-10-31 late)
Re-filmed every moment fresh (`shots/v3/kart-b/wisp_imp/r2/`), critiqued, and fixed what read weakly at 1×.

### Changes
- **Summon pre-roll** (`fallTrail` in `kart-b/wisp_imp.ts`): the lone falling feather was a 6×3 speck that
  hung ~1 s with nothing else on screen. Now (a) it sheds a glinting thread of down every 30 ms (white/lilac
  specks stepping down the ramp, every 4th a gold glint with a 1-frame cross), (b) a ring of down-light on the
  tile TIGHTENS onto the landing spot as it comes down (void3 → void4 → white), answered by the touch's
  ripple opening back out, (c) the sheet's frames 0…touch play at timeScale 1.45 (touch now ≈ 140 ms
  earlier; summon event 3000 → 2833 ms game).
- **Pillow** (`pillowDeath`): bigger pillow (max 26×13 half-size, raster 76×44), plumps in with an overshoot
  (5 sizes); the "-N" number now launches while the pillow is still plumping (no dead wait); the catch is a
  6-beat squash-and-stretch (wide/flat with the number sunk 3–4 px into the down → tall → wobble ×2 →
  settle, eyes "> <" → open → "^ ^"); "0 · KORUNDU" holds 300 ms before the POF. To keep the effect in budget
  the special pose plays at 1.45 and the flock flies 390 ms.
- **Revive scenarios** added: `wiRevive`, `wiReviveP2` (soul_recall): the shared soul_recall presentation +
  the rig's revive pose + `wiReviveGather/Land` (gather swell raised: it measured −22 dB loud, now louder).

### Scenario keys (all, P1 + P2)
`wiSummon(P2)`, `wiAttack(P2)`, `wiDirect(P2)`, `wiBlocked`, `wiGuard`, `wiCushion(P2)` (enemy kills ATK wisp:
pillow 1600), `wiCushionSelf(P2)` (wisp suicides into a stronger monster: pillow 200; = `m1Imp`),
`wiDefDies(P2)` (no event: wind, no pof), `wiRevive(P2)`.

### Gates (round 2)
- typecheck: no wisp errors. `tests/art/wisp_imp*`, `tests/presentation`, scenario tests: 88/89 — the one
  failure was `engine-boundary` timing out at 5 s under machine load (load avg ≈ 15); it passes 5/5 with `--testTimeout 60000`.
- v1: `filmdiff --set v1` **17/17 IDENTICAL** (after the round-2 changes).
- Camera gate (`<scratch>/wisp_imp/m3.json` vs `camera-base.json`): 15 ok + 2 NOBASE (the new revive keys), 0 FAIL.
- Budgets (game clock, `<scratch>/wisp_imp/m3.json`, `m4.json`): summon 2833 · declaration 316 ≤ 435 · attack
  battle 2017 ≤ 3190 · direct 2017 ≤ 2320 · blocked 2084 · guard 1217 · **effect 2300 ≤ 2320** (2400 before the
  trims) · wind death 1050 ≤ 2030 · revive (soul_recall activate) 2133.
- palcheck (a5): pillow panel clip — only off-palette colour is #070206, the outline of the shared `pixelText`
  damage number (UI text, not this card's rasters); `white` > 1.5 % is already in frame 0 (the white LP
  digits). Summon clip: Δoff +0.43 ok; `white` 1.8 % = the wisp's own white body (rig tone).
- Evidence: `r2/wiSummon.png`, `r2/wiSummon-fall.png` (before) → `r2/wiSummon-fall3.png` (after),
  `r2/wiCushion.png`, `r2/wiCushion-pillow*.png` (before), `r2/wiCushion-catch2.png` (after, ×3),
  `r2/wiCushionP2-pillow.png` (P1 panel), `r2/wiAttack.png`, `r2/wiAttack-contact.png`, `r2/wiDefDies.png`,
  `r2/wiDefDies-wind.png`, `r2/wiRevive.png`, `sfx/wiReviveGather.png`, `sfx/wiReviveLand.png`.

### Open issues (round 2)
16. **Owner feedback (motion liveliness) is a RIG issue and is not addressed by this stage** — idle/one-shot
    frames still too similar; needs a rig pass (and re-run of monster-gates: HA-21/HA-18 margins are tight).
17. Idle SFX and a feather struck-body material: still not built (decisions 3 / 4).
18. No independent critic round yet; no MP4 clip (`tools/clip.mjs`) for the owner's ears.

## FIX round 1 (critic r1 → fixes, 2026-11-01)
Critic report: `shots/v3/kart-b/wisp_imp/critic-r1/` (1 blocker, 5 major, 4 minor). Evidence of the fixes:
`shots/v3/kart-b/wisp_imp/fix-r1/`. Scratch renders: `<scratch>/wisp_imp/fx1/` (idle-a, guard-a, attack-a,
hit-a, death-a…d, summon-a/b, revive-a, before/after copies of the three edited files: `*.orig.ts`).

### What changed, finding by finding
1. **BLOCKER idle/guard "frames near-identical" (owner)** — `wisp_imp-anims.ts` `idlePose` rewritten: a real
   figure eight drawn into the pose (hood hx ±1 once per loop, hy ±1 twice per loop, whole px), hood squash /
   stretch on the turns, skirt drift + tail swing ±3 + cowlick ±2.5 + hands (near hand waves ±35°, fans open)
   lagging the hood by 1–3 frames, plume tips in a travelling wave (rippleAmp 1.0), skirt length +1 counter to
   the hood. Amplitudes in one table `IA`. Measured: **idle liveliness 15.8 % → 38.8 % (P1) / 40.4 % (P2)**
   (idleΔ 135 → 328 px; abyss_magus ≈ 400), no consecutive pair under 15 % (was 17/11 px). Guard rewritten: a
   shivering breath (hood bobs), hands tremble ±1 px / ±12°, eyes peek left / right / up, cowlick twitch: guard Δ
   80 → 216 px (HA-19 0.66). Films: `fix-r1/sheet/`, `fix-r1/sheet-p2/` (`*-all.png`, `*-idle.png`, `*-guard.png`).
   **Deliberate gate deviation: HA-21 phase** (struck f0 vs EVERY idle frame < 50 %) now reads 69–76 %. Measured
   why: this body's banded plumes re-band under ANY motion — even the old near-static idle sat at 47–49 %; with
   each motion component removed in turn the worst phase only drops 1–5 points (no single culprit), so a lively
   idle and HA-21 phase cannot both hold on this rig. The references the critic measured against
   (abyss_magus, crystal_wyrm) are slice exemptions of the same row (`SLICE` in monster-gates). What still
   holds: HA-21 local (f0 vs idle f0) 17–18 %, the pre-contact idle settle (`_v3/posematch.ts`) steers a
   resting wisp toward the frames round idle f0 before a planned blow, HA-10 floater baseline ±1, HA-17/18/19
   ok. `tests/art/wisp_imp.test.ts`'s phase test was replaced (own file) by: local < 25 % vs idle f0, ≥ 3 idle
   frames within 50 % of every struck f0, liveliness ≥ 30 %, min consecutive Δ ≥ 15 %. **Orchestrator:** please
   confirm this deviation (or grant a v3-only unit-level hover tween, which would let the float move the
   sprite instead of its pixels).
2. **Attack no snap** — puff is now a real 130 % (rig `geo`: rx +4, ry +3, skirt +3 at puff 1), plumes fanned,
   tail uncurled; release f5 = a hard forward stretch (hood +3, sw +3 / sh −2, plumes drift −6 and tail whipped
   back), contact f6 holds the smear, f7 recoil squash, f8–f12 a tall/squat/tall wobble, every frame distinct.
   `fx1/attack-a.png`, `fix-r1/wiAttack-clip.png` (t 500–800 puff → snap).
3. **Wind death generic noise** — new rig fields `peel` / `eyesOnly` / `gust`: a gust ribbon (light) crosses
   the sprite, it peels part by part (cowlick f2 → front plumes f3 → f4 → wing + hands f5 → tail f6), each part
   leaving as a whole quilled feather (`free`), the bare sheet frays (the only pixel dissolve, f6 = 90 ms), the
   eyes hang alone f7–f8 and blink out f9. Cinematic `gust()`: three big curved ribbons with rolling white curls
   lead, thin streaks follow; the peeled feathers continue as whole 7–8 px feathers from the body's back edge in
   sync with the sprite's peel frames. `fx1/death-d.png`, `fix-r1/wiDefDies-clip.png`. Still no pof.
4. **Summon fountain + pre-roll** — sprite: the falling feather is 11 px long / 4.6 wide (≈ 2×) in three
   tilts (f0–f2); the build is a helix of 4–9 whole quilled feathers (far half behind the body) round the EYES
   first (f5 eyesOnly), then hood + bare sheet (f6), then tail / hands / wing (f7), then plumes (f8): no erode,
   so no ink specks. Revive uses the same peel-in. Cinematic: pre-roll swing ±11→6 px with a lift at each end
   and three-tilt frame swaps (offset per tilt so the feather never jumps), PRE 500 → 460 ms; the tile ring is
   brighter (white + a second lilac ring); the fountain's feathers are 6–8 px (were 3–6).
   `fx1/summon-b.png`, `fix-r1/wiSummon-clip.png`.
5. **Dead wisp stands idle 0.3–0.75 s** — new gated observer "the clutch" (`kart-b/wisp_imp.ts`): on a
   battle whose wisp has its own activation coming, it listens for the battle kit's `v3:contact`; from then on,
   the moment the body is back in idle it is held in the pillow's hug (special f1) trembling with f2 every 110 ms,
   and the effect hook plays the special on from that frame. (No `hit` anim showed on the contact in
   wiCushion, so the old idle gap was pure idle.) `fix-r1/wiCushion-field.png` (t 2040 → hug until the special).
6. **Pillow readability** — `paintPillow` redrawn: an 11×7 face hollow with an ink brow and void1 lip, 2-px gold
   eyes with four expressions (`> <` squeeze on the catch → `wide` on the rebound → open → `^ ^`), solid
   feather-fan corners, the ghost's cowlick curling off the top and its "?" tail feather hooking off the outer
   side; the 300 ms hold is a breathing wobble (4 sizes); "0 · KORUNDU" now `md` (was `sm`), pops out of the
   panel edge (−4 → +1 → 0 px, white first frame then gold), a gold glint runs along it and a 4-point sparkle
   flares on the chime (`labelShine`); it blinks out WITH the pof (3 × 80 ms; was 380 ms later).
   `fix-r1/wiCushion-panel.png` (P2 panel), `fix-r1/wiCushionP2-panel.png` (P1 panel).
7. **Darts (minor)** — each dart has an unbroken 4-px trail (6 on the finisher) stepping white → void2, a white
   point ahead of its tip and a white cross on its launch frames; the 6th is an 11-px finisher (+40 ms, glint on
   arrival); stuck darts quiver ±1 px on a 3-step cycle with a white end. `fix-r1/wiAttack-clip.png`.
8. **Hit reactions (minor)** — hit f1: tilted back 4 px (hx −4, bx −3), squashed, plumes / tail flung forward,
   four whole feathers pop out and fly off over f1–f4; hitHeavy the same with four bigger ones.
9. **Sound (minor)** — MP4s for the owner's ears: `fix-r1/clips/wiCushion.mp4`, `wiAttack.mp4`, `wiSummon.mp4`,
   `wiDefDies.mp4` (+ .wav / .json levels). Idle SFX still not built (decision 3; it needs a per-unit frame
   listener and would be heard on every idle loop — left out); feather struck-body material still the generic
   one (decision 4).
10. **Card art / icon (minor)** — not changed this round: the 16×12 icon still needs the 2-line additive entry in
    `src/art/cardface-v3/index.ts` (orchestrator, open issue 1); bbox fill 0.88/0.90 stays logged (open issue 4).

### Gates (round 1)
- `monster-gates --class small --ref none` (`fix-r1/gates.txt`): **20 ok, 1 FAIL = HA-21 phase (deliberate,
  above)**. Margins ≥ 2 everywhere, IŞ-10 effect max < 20 %, HA-10 baseline ±1, KK-13 bytes unchanged (134 frames).
- `tests/art/wisp_imp*.test.ts`, `tests/duel/monster-timing.test.ts`, `tests/presentation`: 101/101 pass.
  typecheck: no errors.
- v1: `filmdiff --set v1` **17/17 IDENTICAL** (after all round-1 changes).
- Every new cinematic code path is inside the LOOK_V3-gated registrations (the clutch observer included).

### Open issues (after round 1)
19. HA-21 phase deviation needs an orchestrator decision (see 1).
20. Idle SFX, feather struck-body material, icon wiring, card-art bbox: unchanged (issues 1, 4, 10, 11).
21. Sameness was not re-run after the idle / attack rewrite (motion proxies will have moved).
22. The clutch hold can be long (≈ 0.9 s in wiCushion) because the battle kit waits for the attacker's
    strike to end; it now reads as the special's charge (trembling hug), not as a living idle.

## Rig re-run 3 (stage: RIG + ALL ANIMS re-issued again, 2026-11-01)
The brief still calls the rig files the "old violet puffball". They are not: the R3 feather ghost (design note
above, under "Sprite rig") is the current design and is registered (the exclusion entry was already removed).
This pass audited every anim at 4× (P1 + P2) against the owner's blocker ("consecutive frames must differ
visibly at 1×") and fixed what was left.

**Audit, per-frame consecutive Δ (% of idle f0 opaque; scratch `consec.ts`):** idle (15–57 %), guard, attack,
toGuard/fromGuard, summon and death were fine (death f7–f9 and summon f0–f2 are deliberately sparse: eyes alone /
a lone falling feather). The **settle tails** were near-duplicates, because their last keys used sub-pixel
values (`crestX: 0.3`, `tailSwing: 0.3`) that round away: hitMagic f6→f7 **2 %**, hitHeavy 15/11, revive 10/14,
roar 13, special 13, hit 19.

**Fix (`wisp_imp-anims.ts` only):** a `PRE_IDLE(d)` helper = idle **f19** + overrides. Every settle tail now
passes through the idle loop's own last frame, so the hand-off into idle f0 is the loop's natural step (no pop,
HA-14 out still 0). The frame before it is a clear, card-specific beat:
- roar: a proud after-shiver (chest puffed, near hand pats it, cowlick springs, `happy` eyes)
- hit: its last frame is PRE_IDLE, with the last knocked-loose feather still drifting and a glance back
- hitHeavy: shakes the dizziness off (head-shake left with squeezed eyes, then right with eyes open)
- hitMagic: one last residual jolt (stiffens, feathers on end, a single spark), then shudders it off (blink)
- revive: "where am I?" (turns back over its shoulder, hand pointing), then forward again
- special: the hug's afterglow (pats its cheek, cowlick bounce), then PRE_IDLE with `happy` eyes
After: no consecutive pair under 15 % in any one-shot (tails now roar 74/40, hit 85/46, hitHeavy 76/68/48,
hitMagic 80/75/40, revive 63/71/48, special 66/74/40). The idle, guard, marks, holds and frame counts are all
unchanged (134 frames, 2.13 MB). The cinematics read only marks, special f0–f2 (the clutch) and release, so
they are unaffected.

**HA-21 phase, re-measured with an attribution harness** (`<scratch>/wisp_imp/r3/phase*.ts`, `search.ts`):
each idle component alone (all the others held at f0) gives hood 32 %, squash 45 %, skirt drift 39 %,
plume ripple 32 %, tail 32 %, loose feather 26 %, cowlick and hands ≈ 17 % (that is the hit-f0 floor). Even
an idle with the hood frozen in both x and y, no squash and no drift sits at 56 %, with liveliness down to 26 %.
So **< 50 % phase and the owner's liveliness cannot both hold on this rig**. The deviation stays, with the
mitigation already in place (pre-contact idle settle in `_v3/posematch.ts`, HA-21 local 17–18 %). It is still
waiting on an **orchestrator decision**: add wisp_imp to `SLICE`-style exemptions, or allow a v3-only
unit-level hover tween.

### Gates (re-run 3)
- `monster-gates --class small --ref none`: **20 ok, 1 FAIL = HA-21 phase (deliberate, above)**. HA-14/15/16/17/
  18/19 ok, HA-10 floater feet fixed and baseline ±1, IŞ-10 ok, KK-13 134 frames / 2.13 MB / 2.6 ms.
- `tests/art/wisp_imp.test.ts`, `wisp_imp-cardart.test.ts`, `tests/duel/monster-timing.test.ts`: 24/24 pass.
  typecheck: no wisp errors.
- Sameness re-run (open issue 21): **no KALIR**. UYARI pairs (point/proxy motion tracks): crystal_wyrm, abyss_magus,
  tide_golem, stone_sentinel, grim_warden (idle rhythm), seal_head, seal_arm_r. lumen_sprite (the spec's nearest
  card) passes. The silhouette/KEY is GEÇER against all of them.
- v1 is unaffected: v1 never loads `monsters-v3`, and only `wisp_imp-anims.ts` changed.

### Evidence (`shots/v3/kart-b/wisp_imp/rig-r3/`)
`sheet-all.png`, `sheet-all-p2.png` (all 13 anims ×4), `settle-tails.png`, `settle-tails-p2.png` (roar, hit,
hitHeavy, hitMagic, revive, special after the fix), `board.png` (1× on tiles, P1 + P2), `gates.txt`, `sameness.txt`.
Before copy of the anims file: `<scratch>/wisp_imp/r3/wisp_imp-anims.orig.ts`.

### Open issues (after re-run 3)
23. HA-21 phase deviation: orchestrator decision (see above; same as issue 19).
24. Sameness UYARI pairs still need the distinction note and a blind test in a critique round (issue 7).
25. Not re-filmed in-duel this pass. The change is confined to settle frames and the cinematics key on marks,
    but the next cinematics or critique pass should re-film `wiCushion` and `wiRevive` to confirm.
26. Idle SFX, feather struck-body material, icon wiring and card-art bbox are unchanged (issues 1, 4, 10, 11).

## Rig re-run 4 (stage: RIG + ALL ANIMS re-issued again, 2026-11-01)
The brief still calls the rig files the "old violet puffball"; they are the R3 feather ghost (design note under
"Sprite rig" above) and are registered (exclusion already removed). No rig code changed this pass — it was
verified, and one untested route to the HA-21 phase deviation was measured:
- Fresh sheets P1 + P2, LOOKed (idle ×6 zoom, all-anims sheets, P2 special / death / attack): on-model, P2 lit
  from the right, every anim intact, consecutive frames visibly distinct.
- `monster-gates --class small --ref none`: **20 ok, 1 FAIL = HA-21 phase** (unchanged: hit 68.9 %, hitHeavy /
  death 71.2 %, hitMagic 73.7 % P1; 71.8–75.6 % P2). Liveliness 38.8 % / 40.4 %, HA-17 1.46, HA-19 0.66.
- **New measurement — "centre-frame" struck f0** (`<scratch>/wisp_imp/r4/center.ts`): could hit f0 be drawn on a
  more central idle phase instead of idle f0? No: the idle frames are 72–89 % apart pairwise (P1/P2), idle f0 is
  already the most central frame (72 % / 73 %), and the hit's local overrides on any other base give 69–89 %.
  By the triangle bound the phase metric can only fall under 50 % if the idle's pairwise spread falls under
  ≈ 100 % AND a frame within 50 % of all others exists — i.e. only by cutting the idle motion the owner asked
  for. The deviation stays; it still needs the orchestrator decision (SLICE-style exemption, or a v3-only
  unit-level hover tween so the float moves the sprite rather than its pixels).
- Tests: `tests/art/wisp_imp.test.ts`, `wisp_imp-cardart.test.ts`, `tests/duel/monster-timing.test.ts` 24/24 pass;
  typecheck: no wisp errors.
- Evidence `shots/v3/kart-b/wisp_imp/rig-r4/`: `sheet-all.png`, `sheet-all-p2.png`, `idle-zoom.png`,
  `p2-special.png`, `p2-death.png`, `p2-attack.png`, `gates.txt`.

### Open issues (after re-run 4)
27. HA-21 phase deviation — orchestrator decision (issues 19 / 23), now with the centre-frame route ruled out.
28. Unchanged: sameness UYARI blind test (24), idle SFX (decision 3), feather struck-body material (decision 4),
    icon wiring in `cardface-v3/index.ts` (1), card-art bbox fill (4).

## FIX round 1b (independent critic r1 / c2 → fixes, 2026-11-01)
Critic report: `shots/v3/kart-b/wisp_imp/critic-r1/c2/` (2 blockers, 6 majors, 4 minors). Evidence of the fixes:
`shots/v3/kart-b/wisp_imp/fix-r2/`. Scratch: `<scratch>/wisp_imp/f2/` (`z.ts` = zoom renderer
`npx vite-node z.ts -- out.png SCALE "anim:f[:r];…"`, `PATCH='{json}'` overrides pose fields; before copies
`wisp_imp-rig.orig.ts`, `wisp_imp-anims.orig.ts`, `cin.orig.ts`, `scen.orig.ts`; `m.json` = measure run).

### What changed, finding by finding
1. **BLOCKER field pillow before the payoff** — the effect hook no longer plays the cushion frames. The special
   was re-keyed (12 → 15 frames, marks `charge 1, release 8, impact 8, recover 11`; total 137 frames, 2.17 MB):
   f1 hug, **f2–f4 new build-up** (squeeze smaller, shudder left / right, feathers lifting and slipping out as
   whole feathers), f5 the brief swell (pillow 0.35), f6–f8 cushion / squeeze / poof (kept for the sprite, unused
   by the effect). The hook plays `held … SWELL (= release − 3)` at ×1.3, holds 60 ms, then bursts. The pillow
   now appears only on the panel. `fix-r2/wiCushion-field.png`, `special-clutch-x6.png`.
2. **BLOCKER no burst** — new `burstCloud()` (`kart-b/wisp_imp.ts`): flash frame (body shape, all white, ink rim)
   → 4 beats of an inked lumpy `cumulus()` (overlapping puffs, top-left lit bands, 1-px creases where an upper puff
   laps a lower one) that grows to ~1.5× the body and RISES (−3 → −23 px), tears into lobes, thins (ink → void0 →
   no rim); 8 whole inked feathers tumble out of its upper rim; the flock leaves from the cloud's rim when it lifts
   off. The body is retired on the flash frame. `fix-r2/wiCushion-burst.png` (t 3080–3575).
3. **pof flat discs** — `pof()` rewritten on `cumulus()`: k0 tight pop (pillow-wide), k1 wide squat puff (~80 px),
   both inked; k2 torn ring of inked lobes; k3 last wisps; then the ring. A third of the 30 down particles are
   whole inked feather stamps. `fix-r2/wiCushion-pof.png`, `wiCushionP2-panel.png` #14–17.
4. **frozen clutch egg** — the clutch observer now steps f1 → f2 → f3 → f4 → f3 … every 100 ms (distinct squeeze /
   shudder frames) and lets a whole inked feather slip off the back every 170 ms and float up.
   `fix-r2/wiCushion-field.png` #3–#16.
5. **body reads as hooded squid** (rig) — `PLUMES` redrawn as 7 SHORT broad round-tipped shingles (upper row in
   front of the lower one, two wing feathers notching the back edge, a lower hem row over the tail root); `leaf()`
   got a `round` profile; a shingle is flat white with a lilac curl toward its tip, a quill, and a void1 rim round
   its tip, so each tip laps the feather under it as a scallop line (kept from despeckle). Plume-on-plume cast
   shade removed (the rims carry it). Hands = three slim fanned feather fingers parted by a void2 crease.
   Tail: three barb notches on alternating edges. `fix-r2/body-idle-x8.png`, `body-1x-2x.png`, `sheet/`.
6. **chip / confetti particles** — new `stamp()`: an inked, quilled 5–9 px feather with a lit vane and a round
   tip, edge-on (quill only) when `flip < 0.3` (the falling-leaf turn-over); `Plumes` takes `ink: true` and flips
   with its pendulum. Used in the summon fountain (every 3rd–2nd feather) + its fling, the "bö!" crown, the burst,
   a third of the flock, the clutch escapees, the wind-death peel stream, flaking darts, ricochets, the pof, the
   pillow tuft. The rig's built-in attack dart confetti (attack f5–f8 bursts) removed (the cinematic owns darts).
7. **wind-death checker fray** (rig) — death f6 no longer erodes: the last shingle and the tail leave as three more
   whole feathers and what is left is a shrunken hood round the eyes (no holes). f4/f5 keep the hem shingles
   (peel 4 / 4.5), so f5 is not bald. `fix-r2/death-f4-f7-x6.png`, `wiDefDies-clip.png`.
8. **guard eyes painted on the hands** (rig) — `paintEyes` takes the near-hand map: an eye pixel under a finger is
   skipped unless it is a finger crease; guard hands moved 3 px down so the fingers cover the lower hollow and
   the eyes peek over them (P1 + P2). `fix-r2/guard-x8.png`, `wiGuard-clip.png`.
9. minors: **summon pre-roll** FALL 62 → 44 px, PRE 460 → 320 ms, the sprite's falling feather path ends flat on
   the tile centre (summon event 2833 → 2583 ms) `fix-r2/wiSummon-clip.png`; **blocked darts** ricochet up and back
   on a high spinning arc with a white "tink" spark (`wiBlocked-zoom.png`); **panel pillow** widened (+10 px, raster
   124×58) to cover the whole digit run (P1 panel nudged 3 px to the digits' centre), face hollow 13×9, 2×3 eyes,
   a feather tuft pops off on the breath.

### Gates (round 1b)
- `monster-gates --class small --ref none` (`fix-r2/gates.txt`): **20 ok, 1 FAIL = HA-21 phase** (the known,
  documented deviation; orchestrator decision still pending). KK-13 frames/bytes ok (137 frames).
- Tests: `tests/art/wisp_imp*.test.ts` (special marks updated in my own test), `tests/duel/monster-timing`,
  `tests/presentation`: 101/101. `tsc`: 0 errors.
- Timing (`<scratch>/wisp_imp/f2/m.json`): effect (activate) **2267 ms ≤ 2320**; wind death 1050; summon 2583;
  declaration 316. No camera calls added.
- v1: not re-filmed this round; every change is in v3-only files (`monsters-v3/wisp_imp-*`) or inside the
  LOOK_V3-gated registrations of `kart-b/wisp_imp.ts`.

### Open issues (after round 1b)
29. HA-21 phase deviation — orchestrator decision (19 / 23 / 27).
30. Revive: the shared soul_recall pillar still covers the sprite's own feather gather (no own revive hook yet).
31. Unchanged: idle SFX (decision 3), feather struck-body material (decision 4), icon wiring in
    `cardface-v3/index.ts` (1), card-art bbox (4), sameness blind test (24). Card art was not redrawn to the new
    shingle body (it already shows tips at the hem; a re-check against the new rig is worth a pass).
32. The stamps read as feathers at 2–3×; at 1× the heavier inked ones can still read as small shards in dense
    streams (flock) — a critic should judge at 1×.

## FIX round 1c (logged late: the 11:27–11:31 edits after round 1b)
Code was changed after round 1b's notes and never logged: the clutch got its own sustained voice
`wiClutch` (started with the hold; meant to fade when the pillow takes over), a `wiSwell` recipe was
added (but never played), `wiHu` fired on the lethal blow from the clutch observer. Evidence of that run:
`shots/v3/kart-b/wisp_imp/fix-r3/sfx`. Its bugs are the critic-r2 findings below (wiClutch never stopped,
wiSwell orphaned).

## FIX round 2 (independent critic r2 → fixes, 2026-11-05)
Critic report: `shots/v3/kart-b/wisp_imp/critic-r2/n/` (1 blocker, 7 majors, 7 minors). Evidence of the
fixes: `shots/v3/kart-b/wisp_imp/fix-c2/`. Scratch `<scratch>/wisp_imp/c2/` (before copies `*.orig.ts`,
`gates.txt`, `same/`, sheets). No time gate any more (owner decision 2026-11-05): durations by feel.

### Finding by finding
1. **BLOCKER wiCushionSelf (wisp attacks and dies) played the survive recoil + idle** — `strikeV3` now runs
   the same look-ahead as the observer (`pillowComes`: an own activate monsterEffect before the next
   battle). If it comes: no `wiHu`, no `hit`; on the first dart's contact `holdClutch(sc, u, true)` takes
   the sprite with an exclusive `playRange('special', 1, 2)` (the attack play's waiter lets go WITHOUT
   resting to idle) and the strike returns as soon as the volley is in — so the effect now starts at
   1617 ms instead of 2467 (hug 1.25–1.8 s, swell 1.82, burst 1.9). No idle frame, no silence (RMS
   −21…−22 dBFS through 1.5–1.9 s). `fix-c2/wiCushionSelf-field.png`, `wiCushionSelf.png`,
   `clips/wiCushionSelf.{mp4,wav,json}`.
2. **wiClutch never stopped** — the hold is one function `holdClutch` (observer + strike share it); the
   pillow ends the hum ON the swell frame (`endClutchVoice(u, 90)` in the SWELL atFrame, safety stop before
   wiCloud), the hold loop leaves it alone when the effect took over and stops it on every other exit.
   WAV check: 440–520 Hz band falls 40 → 9–19 dB after 1.95 s (it was +25…30 dB to 3.8 s).
3. **wiSwell orphaned / wiStuff twice** — the SWELL frame plays `wiSwell` (0.85); `wiStuff` only packs the
   pillow on the panel. measure: wiSwell 1817 / 3050, wiStuff once.
4. **inaudible jabs** — `wiTsk` +9 dB with a 2.2–2.8 kHz cloth "tk" band + a 2.6→1.9 kHz triangle tick +
   a stronger body thump; the strike steps the pitch 1.06 → 1.30 per jab. WAV: 2–3.2 kHz spikes now at
   each jab (+16…26 dB vs −1…7 between). `lpTick` was NOT hushed (it plays later, async; hush is
   synchronous) — the louder, mid-band jab is the fix.
5. **clutch read as waving** — special f1–f4 redrawn as a real hug: near hand flat across the belly
   pointing back, far hand's fingertips round the back pointing forward, both low; NO flung `free` feathers
   (they read as raised arms); eyes shut → "> <"; the body shrinks 1 px a frame (sw/sh −1 → −3/−4, len −1 →
   −3) and f3/f4 shiver bx ±1. The hold escalates: f1 (110 ms) → f2 (100) → f3↔f4 with the beat tightening
   90 → 45 ms, escaping feathers every 200 → 80 ms. The STRUCK branch first plays the wisp's own
   `hitHeavy` stagger (tumbles back, dizzy) from the contact, and only hugs once that lets go: the hug
   is now ~0.3 s (2.66–2.95 s) before the swell in wiCushion. `fix-c2/hug-new.png` (f0–f5 + P2 f4),
   `wiCushion-field.png`, `sheet/wisp_imp-v3-special.png`.
6. **no card sound / reaction when struck as the target** — new LOOK_V3 observer branch (no activate
   coming): on `v3:contact` it plays the new `wiFfp` (a 2–4 kHz breath burst closing on a cloth pop + 5 kHz
   rustle + quill ticks) and knocks whole inked feathers off the hood away from the blow (`featherPop`):
   guard holds / survived recoil = wiHu 0.55 + wiFfp 0.55 + 3 feathers; lethal in defense = wiFfp 0.85 + 4
   feathers (fills the 480 ms before wiGust); lethal with the pillow = wiHu + wiFfp + 5 feathers + the
   stagger. Over the shared layer (shieldBlock / hex ward untouched, decision 4). `fix-c2/wiGuard-clip.png`.
7. **feathers = lilac shards at 1×** — `stamp()` redrawn white-dominant: the spine BOWS ~1 px (a curved
   vane), the lit side up to 2 px white, the shade side 1 px white with lilac only near the tip, a lilac
   shaft with a darker bare calamus; the ink rim only on the shadow side (right / below). Turn-over slowed
   (Plumes flip cos(ph·0.3), swing ×0.8; flock flip el·0.005). Flock 36 → 22 feathers, half of them 9–10 px
   stamps. **Wind death** stream: runs low and short (vy 0…+30, grav −30, life 420–580 ms), the ribbons /
   streaks stop short of the duelist's dais (`REACH`), and any feather reaching a 30 px circle round
   `duelistXY` is dropped (`Plumes.avoid`). `fix-c2/wiDefDies-clip.png` (no feather on the duelist; a few
   fade by the dais' front corner).
8. **LP panel payoff** — "0 · KORUNDU" now settles gold and stays 450 ms after the pof, then blinks out;
   a gold ring (panelFlash) circles the revealed 4000 120 ms after the pof; the pof cumulus spreads
   sideways / down (upper lobes ×0.5–0.6) and is centred 2–3 px lower, so it no longer covers the
   player-name row. `fix-c2/wiCushionP2-panel.png`, `wiCushionP2-pof.png`.

Minors: **summon pre-roll** — the dark smudge was NOT the moon pool: the light layer's contact shadow
(LightLayer foot, follows the sprite: groundY = sprite.y + hover + lift) — the falling feather now counts
as lifted (`u.lift = 40` until the body builds, restored by S.own); the moon pool is an air glint only
(no floor spill); the feather drifts in from beside the tile (slant 30 px easing to 0) instead of from over
the deck stack (it still brushes the stack's lower-left corner for ~1 frame). `fix-c2/wiSummon-preroll.png`.
**pof / bö** — wiPof: the "p" +6 dB (2.3 kHz + 1.5 kHz), two SHORT lobes 60 ms apart closing 850 → 350 Hz
in ~150 ms, the "f" hiss (2.6 → 0.9 kHz) carries the tail; wiBoo: closed-lip thump + release click 12–16 ms
ahead of the voice, voice attack 10 ms (`ghostVoice` got an optional `att`). **Scenarios** — added
`wiBlockedP2`, `wiGuardP2`, `wiSpellKill` (judgment_bolt: wind, no pof — verified in measure) and
`wiCharmSave` (guardian_charm: wisp lives, no pillow — the guard branch's wiHu/wiFfp plays). **Hood** — two
big shingle scallops (a void3 curved tip edge + 2 px void4 shade band) across the crown and the back of the
hood, face hollow kept clean (`fix-c2/hood.png`). **impactHeavy** — `s.impact` wrapped in
`hush(['impactHeavy'])` (clip JSON: impactHeavy `played: false`); direct volley darts get a 9 px trail
with a 4 px white head. **registerStrike** priority 20.

### Gates (round 2)
- tsc: 0 wisp errors. Tests `tests/art/wisp_imp*`, `tests/duel/monster-timing`: 24/24.
- `monster-gates --class small --ref none` (`fix-c2/gates.txt`): 20 ok, 1 FAIL = HA-21 phase (the known
  deviation, unchanged). IŞ-10 noise ok after the hood scallops.
- Sameness: same UYARI rows as before (crystal_wyrm / abyss_magus / stone_sentinel, MOTsig) — open issue 24.
- measure `fix-c2/measure.json`: 20 wi* keys, errors 0, zoom 1 everywhere. Effect (activate) 2350 ms
  (struck) / 2266 (self); wiCushionSelf total 4.30 s (was 5.03 s); wind death 1050; summon 2633.
- v1: every change is in v3-only files or LOOK_V3-gated registrations / v3-only recipes.

### Open issues (after round 2)
33. HA-21 phase deviation — orchestrator decision (19 / 23 / 27 / 29).
34. The struck branch's hug length is set by the ATTACKER's strike (the battle handler plays triggers
    after it ends): ~0.3 s after the stagger for shade_assassin; a longer attacker strike means a longer
    (escalating) hug.
35. lpDown / lpTick still overlap the jab window (shared LP roll; not hushable from a strike).
36. Unchanged: idle SFX (decision 3), struck-body material (decision 4 — wiFfp is overlaid instead),
    revive pillar (30), icon wiring (1), card-art bbox (4) and card art not re-checked against the new hood
    scallops, sameness blind test (24). The wind feathers can still fade near the P2 dais' front corner.

## FIX round 3 (independent critic r3 → fixes, 2026-11-05)
Critic report: `shots/v3/kart-b/wisp_imp/critic-r3/` (6 majors, 7 minors). Evidence of the fixes:
`shots/v3/kart-b/wisp_imp/fix-r3/`. Scratch `<scratch>/wisp_imp/r19/` (before copies `rig.orig.ts`,
`anims.orig.ts`, `cin.orig.ts`, `snd.orig.ts`; `iso.ts` / `iso2.ts` = isolated-pixel counter (all / non-ink),
`isomap.ts` = ASCII map with isolated pixels marked, `kinds.ts` / `bands.ts` = the rig's field layout,
`edge.ts` = frame-edge clipping check). No time gate (owner decision 2026-11-05).

### Finding by finding
1. **MAJOR struck pillow branch: dead gap after the lethal blow** — the observer no longer lets the stagger
   recover: `hitHeavy` plays only f1…f4 (`playRange('hitHeavy', 1, 4)`: thrown → spin → drop → dizzy bounce),
   70 ms, then `holdClutch(sc, u, true)` grabs the hug straight from the dizzy pose (no idle frame at all).
   `wiClutch` now starts ON the contact (under the stagger) and the hold reuses it (`clutchVoice`); its late
   octave-down hum and rustle were raised (0.05 → 0.08, rustle peak 0.12 → 0.15). WAV
   (`fix-r3/clips/wiCushion.wav`): −22…−25 dBFS through the whole stagger + hug (1.75–2.7 s); the only dip is
   −32/−33 dBFS for ~150 ms right before wiSwell (was −40…−58 dBFS for 0.75 s). Film
   `fix-r3/wiCushion-field.png` (t 1.9–3.05 s: contact, tumble, hug, swell — the wisp never looks alive).
2. **MAJOR feather material (rig)** — the skirt is redrawn as FIVE big shingled feathers + one wing feather
   (`PLUMES`, w 7.4–9.4, roof-tile order, upper row lighter: the lower row is one step down through `leaf(dark)`
   only — the old double shift that turned it into a void3 blob is gone); a shingle is ONE lit plane (white /
   void4 for the lower row), its shadow edge one band down (1 px, 2 px only near the tip), ONE 1-px quill line
   (a quill pixel without a quill neighbour is dropped back to the vane — no floating dots), and a 1-px void2
   scallop line round its rounded tip (all but the light-facing upper edge). The per-pixel sheet-normal shift
   on plumes was removed (it made the mottle). A new `flattenTones` pass (before despeckle) melts any feather
   tone pixel that shares its tone with < 2 of its 4 neighbours into the plane round it (lines kept).
   Measured (`fix-r3/isolated.txt`, non-ink isolated px): idle **40.8 → 26.5** mean, attack 44.7 → 32.2,
   hit 46.5 → 30.5; counting the outline's staircase corners too (the critic's number): idle 70 → 53.
   `fix-r3/z-idle-f0f1-x12.png` vs `critic-r3/z-idle-f0f1-x12.png`, `fix-r3/z-idle4.png`.
3. **MAJOR "?" tail (rig)** — the tail spline is re-routed: it leaves the hem at the back-bottom, sweeps back,
   RISES behind the body as the "?"'s stem and curls over at shoulder height, the hook opening downward and away
   from the body, a swelling feather tip at the end (`geo`, 10 control points). tailCurl lets the hook out,
   tailSwing sways the stem and more the curl (the figure-8 drift animates the curl). A frame-edge guard bends
   the curl in from its middle when a pose would cut it on the frame edge (thrown / whipped poses). Reads in
   every idle frame P1 + P2 (`fix-r3/z-idle4.png`, `fix-r3/sheet-p2/wisp_imp-file-p2-idle.png`).
4. **MAJOR blocked branch: shared counter-shock beam over the volley** — the thick white-hot jagged line was
   the battle kit's ranged `backlash` (`_v3/clash.ts`, called from `battle.ts` for any ranged blocked
   attacker). Not suppressible by API, so (this strike only, `s.blocked`) the raster it creates synchronously
   inside `s.impact()` (a new `fx:set:` Image at depth FX+3, ADD) is hidden right after the call. The shield clang
   (hex + star) stays. The card's own glance-off was added (`glance()`): a lilac ring of down breaking into arcs
   on the guard face (white first frame → void4 → void3 → void2) + a spray of down and stamps back toward the
   wisp. `fix-r3/wiCushionSelf-darts.png` (t 1050–1832: six darts readable, no gold beam). Logged below as a
   shared wish (a `noBacklash` option on StrikeArgs would be cleaner).
5. **MAJOR revive: the cyan pillar through the wisp's own revive** — new gated hook `kart-b:wisp_imp:revive`
   (`registerCardHook('soul_recall', 'activate', …, priority 20)`): if the summon it brings back is wisp_imp it
   runs the shared presentation (`ctx.base()`) but hides its 16-px cyan column (`recallPillarV3`'s Raster,
   identified by depth unitDepth(tile) − 0.5 + width 16), and on that frame starts `featherBreeze()`: 16 feathers
   (a third of them inked stamps) spiralling in from BEHIND the ghost, tightening and sinking onto it (half behind
   the sprite, half in front), the wind death backwards. Any other card: `ctx.base()` untouched.
   `fix-r3/wiRevive.png` (t 0.9–2.3 s: the cyan soul flies in, no column, the feathers spiral in, the pose fills).
6. minor **blank frame at the pillow hand-off** — the pillow is born 50 ms before the flock ends (a small 15×5
   pillow), the flock's arrived feathers stay drawn on the panel until it is cleared. `fix-r3/wiCushion-pack.png`
   (#9–#14: feathers → pillow, never empty).
7. minor **flat white burst frame** — the burst's first frame is the body shape with its own inked, banded planes
   (only the darkest tones lifted one step) and the face: dark hollow + two white-hot eyes (facing the right way
   for P2). `fix-r3/wiCushion-burst.png` #3–#4 (taken with the earlier full-lift version; the final keeps the
   void4/white banding).
8. minor **summon pre-roll** — the falling feather is 14 px / 5.8 wide (was 11 / 4.6); a moonlight pool on the
   tile brightens through the pre-roll (`tile` glow 0 → 0.5 over PRE+120 ms, full on the touch).
   `fix-r3/wiSummon-preroll.png`.
9. minor **hit vs hitHeavy** — hitHeavy is a real TUMBLE (8 frames kept): f1 thrown back (hood rolled back,
   skirt flung up, tail whipped, 6 feathers + a ring burst), f2 an edge-on SPIN frame (narrow and tall, skirt
   whipped the other way, eyes squeezed), f3 the float DROPS 4 px into a squashed bounce, f4 dizzy bounce up,
   f5 head-shake, f6 PRE_IDLE. Holds 50/70/120/90/… (HA-4: f1 ≤ 70, recover at 240 ms). hit stays the short
   flinch. `fix-r3/z-hit-vs-hitHeavy.png`.
10. minor **jabs under the LP roll** — the last two `wiTsk` jabs play at 1.35 (+2.6 dB). (lpDown itself is shared.)
11. minor **dark blob on the hood (struck branch)** — not this card's layer: it is shade_assassin's own dark
    strike residue (its dithered shadow smear) drifting over the wisp's tile while it retreats (visible in
    `fix-r3/wiCushion-field.png` #3–#9, now mostly on the floor). Logged (another card's / shared).
12. minor **wind direction** — the gust ribbons' curl now rolls FORWARD (downwind, a breaking crest) in both the
    cinematic ribbons and the rig's gust frames, so cause and feathers read the same way.
    `fix-r3/wiDefDies.png`.

### Gates (round 3)
- tsc: 0 errors. Tests: `tests/art/wisp_imp*`, `tests/duel/monster-timing`, `tests/presentation`: 115/116 — the
  one failure is `crag_axeman.test.ts` (another card).
- `monster-gates --class small --ref none` (`fix-r3/gates.txt`): 20 ok, 1 FAIL = HA-21 phase (the known,
  documented deviation; hit 71 %, hitHeavy 72 %). Frame edge: no new clipping beyond 3–5 px of the tumble's
  thrown feathers at x ≤ 2 (`edge.ts`).
- measure `fix-r3/measure.json` (20 wi* keys): see below.
- v1: every change is in v3-only files (`monsters-v3/wisp_imp-*`, `audio/v3/wisp_imp.ts`) or inside LOOK_V3-gated
  registrations (the new soul_recall hook included).

### Open issues (after round 3)
37. HA-21 phase deviation — orchestrator decision (19 / 23 / 27 / 29 / 33).
38. The blocked-volley backlash is hidden by finding its raster after `s.impact()` (depth + texture-key match):
    works, but a shared `StrikeArgs` option (e.g. `noBacklash`) would be the clean API. Same for the revive
    column (identified by depth + width in `recallPillarV3`): a shared `noColumn` hint would be cleaner.
39. The struck branch's hug is still as long as the attacker's strike tail (~0.8 s for shade_assassin, now an
    escalating trembling hug straight out of the tumble, no idle).
40. The shared hitReact rings on the wisp as a blocked attacker (thin brown/gold arcs) remain (shared).
41. Unchanged: idle SFX (decision 3), struck-body material (decision 4), icon wiring (1), card-art bbox (4) —
    and the card art was not redrawn to the new 5-shingle skirt and "?" tail (worth a card-art pass), sameness
    blind test (24), shade_assassin's residue over the tile (finding 11).
