# wisp_imp — Tüy Hayalet / Down Wisp (R3) — working notes

Lane B, branch `claude/kart-b`. Spec: `docs/v3/YENI_KARTLAR.md` §8 R3 (+ §5, §5.1 "pof" owner, §5.2 ending
"tüy yastığı / rüzgar"). Handbook: `docs/v3/oturum-b/HANDBOOK.md`.

## Status by stage
| Stage | State | Owner / notes |
|---|---|---|
| Sprite rig (`src/art/monsters-v3/wisp_imp*.ts`) | **done, round 1** (rig agent) | 64×62, floor (30,58), hover 6, floater, 13 anims / 134 frames; monster-gates small 21/21 ok |
| Card art (`src/art/cardart-v3/wisp_imp.ts`) | **done, round 1** | native painting, big 88×68 + hand-corrected small 44×34 + 16×12 icon |
| `portrait()` hook | **added** to `monsters-v3/wisp_imp.ts` | 2 imports + 4 lines, additive (see below) |
| Exclusion in `src/art/monsters/index.ts` | **removed** (rig stage) | only the wisp entry was deleted; the other three stay |
| Light profile (`MONSTER_GLOW`) | **done** | gold-only emissive |
| Death preset (`DEATH_PRESETS`) | **done** | `material: 'light', accent: 'shadow'` |
| Cinematics / SFX / scenarios | not started | — |

## Card art (stage: CARD ART + LIGHT PROFILE)
File: `src/art/cardart-v3/wisp_imp.ts` (no import from the rig: it survives any rig rewrite).
Test: `tests/art/wisp_imp-cardart.test.ts` (5 tests: budgets for all 6 frames × 2 sizes incl. checker ≤ 0.5 %,
outline ≥ 90 % ink, focus = white glint = brightest pixel with gold3 under it, blink on f4, determinism, icon).

**Picture** ("Ay ışığında tüy yığınından bakan hayalet, havada tek tüy"): DARK recipe, the eclipse used as the moon
behind the hood; the white feather ghost (smooth hood + 3 tiers of shingled feathers with lilac scallop shadows,
lowest tiers lilac), a dark face hollow with TWO gold3 DOT EYES (one white glint = focus, the brightest pixel),
looking up-right at ONE loose feather adrift in the lead room (light layer); the question-mark tail feather curls
up behind on the left; the ghost sinks into a soft lilac pile of DOWN (big round puffs — it foreshadows the feather
pillow) with two flight feathers poking out; two tiny feather mittens hooked over the pile (peeking).
Living art: 6 × 150 ms (loose feather rocks / drifts ≤ 1 px, eyes blink on f4).

**Small (44×34):** the same geometry sampled natively at 1× (method 2), then hand maps for the eyes (2×2 near dot
with glint + 1×2 far dot), hands, poking feathers and the drifting feather; `closeCheckers` closes every 2×2
checker of the subject (creases become 4-connected).

**Icon (16×12):** `export function wispImpIcon(p)` — the game's mini card downsamples the 44×34 picture by area
average and the two eyes turn into one brown pixel (evidence `cardart-mini-downsample-today.png`). The icon keeps
them as two gold3 pixels. **Not wired**: `src/art/cardface-v3/index.ts` (lane A5-B registry, `ICON` is empty for
every card). Wiring it is a 2-line additive edit for whoever owns that file:
`import { wispImpIcon } from '../cardart-v3/wisp_imp';` and `wisp_imp: wispImpIcon,` inside `ICON`.

**Numbers (f0)** big: 14 colours (backdrop 6), isolated 1.8 %, checker 2, fill 0.735, outline 100 % ink, lead 23,
brightOff 15.6. small: 12 colours, isolated 5.8 %, checker 3, fill 0.78 (a hair over 0.75; crystal_wyrm's small is
0.88), outline 100 %, focus ok.

**Iterations (LOOKed at every one):** 18 renders. Rejected on the way: horizontal feather rows (read as mummy
bandages / bricks), radial and scale-pattern heaps (cobblestones), dark leaf-shaped heap feathers (a plant),
stacked horizontal feather maps (pancakes), small puffs in alternating hues (grapes), a dark mound (a rock).
The big-puff down pile was the first heap that read as soft feathers at 1×.

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

## Evidence (`shots/v3/kart-b/wisp_imp/`)
- `cardart-sheet-f0.png` — big ×3 | small ×6; under them big ×1, small ×1, small ×2.
- `cardart-sheet-f4-blink.png` — the blink frame.
- `cardart-faces-vs-peers.png` — real v3 card faces (1× + mini + 2×) next to crystal_wyrm, grim_warden, ashen_drake
  (rendered through `cardFaceCanvas` with the portrait set in memory; card text is stubbed in that render).
- `cardart-face-1x-zoom.png` — the 1× hand face, zoomed.
- `cardart-icon16.png` — the 16×12 icon ×12 / ×1 / ×2.
- `cardart-mini-downsample-today.png` — today's mini (downsample): the eyes are lost → the icon.

Scratch tools (not in the tree): `/tmp/claude-0/-home-user-yugioh/77596f6a-069b-5204-8bfc-ba0d0b8509ca/scratchpad/wisp_imp/`
`r.ts` (sheet + stats: `npx vite-node <S>/r.ts -- <outdir> [--all]`), `face.test.ts` + `vitest.face.config.mts`
(real faces: `OUT=<S> npx vitest run --config <S>/vitest.face.config.mts`), `icon.ts`, `chk.ts` (checker spots).

## Tests run (card-art stage)
- `tests/art/wisp_imp-cardart.test.ts` — 5/5 pass.
- `tests/art/cardface-v3.test.ts` — 9/10 pass; the failure is `G1 … scrap_raiders: 0.692 ≥ 0.7`, another card's
  face (not wisp_imp; wisp_imp's art is not even live while its sprite is excluded).
- `tests/art/wisp_imp.test.ts` (rig test) not run here: it belongs to the rig stage and the rig is mid-rewrite.

## Open issues
1. Wire the 16×12 icon in `src/art/cardface-v3/index.ts` (A5-B registry) — see above.
2. In game the face shows the new art only once the exclusion in `src/art/monsters/index.ts` is removed (rig stage).
3. The rig's idle/summon could echo the card's pose (peeking from a down pile, looking up at a loose feather) —
   the summon spec (a single feather falls, a feather fountain builds the ghost) fits it.
4. Small subject fill 0.78 (budget 0.6–0.75): kept, the tighter crop reads better at 1×.

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
6. Card art hue (white/mist/steel) vs sprite (white/void4 lilac) — align in a later round if a critic sees it.
7. Sameness UYARI pairs above need a distinction note + blind test in the critique rounds (the silhouette is
   unique; the flags come from point-track motion proxies).
8. Critique rounds with independent critics not run yet in this stage (only self-review, ~25 LOOKed renders).
9. Idle SFX: not built (orchestrator decision 3: optional; log it).
