# mudgrasp_spirit — Çamur Pençe Ruhu / Mudgrasp Spirit (C10) — working notes

Lane B, branch `claude/kart-b`. Spec: `docs/v3/YENI_KARTLAR.md` §6 C10 (+ §5, §5.1 owner of the slow `growl` moan and
the 600 Hz suction "şlop", §5.2 ending "sıvı olup karoya geri akar"). Handbook: `docs/v3/oturum-b/HANDBOOK.md`.

## Status by stage
| Stage | State | Notes |
|---|---|---|
| Sprite rig (`src/art/monsters-v3/mudgrasp_spirit*.ts`) | **done, round 1** (all 13 anims, gates green) | registered in v3 (file `mudgrasp_spirit.ts`) |
| Card art (`src/art/cardart-v3/mudgrasp_spirit.ts`) + `portrait()` | card-art agent (in progress in parallel) | `portrait()` already wired in the shell by that agent |
| `DEATH_PRESETS` | **done**: `material: 'water', accent: 'shadow'` (stone/ash endings are reserved) | `src/cinematics/_v3/presets.ts` own line |
| `MONSTER_GLOW` | **done**: `void4 / void3 / white` emissive, `near void2`, `spill void3` (no body tone) | `src/view/light/profiles.ts` own line |
| Scenarios (`src/duel/scenarios/mudgrasp_spirit.ts`) | base set: `mgSummon(P2)`, `mgPin(P2)`, `mgPinKill`, `mgAttack`, `mgKill`, `mgIdle` | cinematic stage adds `mgSet`, `mgPinFlip`, `mgPinLock` |
| Cinematics / SFX | not started | summon / strike / death / pin effect + aura; `src/audio/v3/mudgrasp_spirit.ts` |

## Design note (rig stage)

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

## Evidence (rig stage)
- Sheets P1 / P2 (×3, points): `shots/v3/kart-b/mudgrasp_spirit/sheet-p1/`, `.../sheet-p2/` (per-anim strips + `-all.png`)
- Idle ×6: `shots/v3/kart-b/mudgrasp_spirit/idle-x6/mudgrasp_spirit-v3-idle.png`
- monster-gates (`--class medium --ref none`): `shots/v3/kart-b/mudgrasp_spirit/gates.txt` — **21 ok, 0 FAIL**
  (idle liveliness 16.1 % / 15.1 %, guard Δ 0.48, HA-21 phase ≤ 45 %, feet band fixed, margins ≥ 2)
- 1× in a duel (default cinematics): `shots/v3/kart-b/mudgrasp_spirit/mgIdle-1x.png`; board: `board-1x.png`
- Sameness (all, out of plan): `shots/v3/kart-b/mudgrasp_spirit/sameness-all.txt`
- Test: `tests/art/mudgrasp_spirit.test.ts` (10 tests, green): validateArt normal / projectile, KK-13 budget,
  determinism + P2 silhouette, size, HA-9 puddle band, palette (earth/stone/void/ink/white only), eye lights,
  liquid death ending (mask sinks last), death preset `water`.

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
6. At 1× the brown body is large next to 64-class neighbours (bbox ≈ 75×57 incl. puddle and the raised hand); the
   body mass itself is ≈ 45 px wide. Critics may want it a notch smaller.
