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
| Sprite rig (`src/art/monsters-v3/mudgrasp_spirit*.ts`) | **round 3 done** (planted claw hands, dark wet pool; gates 21 ok / 0 FAIL, tests 16/16) — round 2 done (readability redesign for the owner blocker; all 13 anims re-checked, gates 21 ok / 0 FAIL, test 11/11) | registered in v3 (file `mudgrasp_spirit.ts`); frame now 92×78, anchor (40, 71) |
| Card art (`src/art/cardart-v3/mudgrasp_spirit.ts`) + `portrait()` | **done, round 2** (value pass for the owner's "brown mass" note) | `portrait()` wired in `monsters-v3/mudgrasp_spirit.ts` (unchanged); see *Card art* below |
| `DEATH_PRESETS` | **done**: `material: 'water', accent: 'shadow'` (stone/ash endings are reserved) | `src/cinematics/_v3/presets.ts` own line |
| `MONSTER_GLOW` | **done**: `void4 / void3 / white` emissive, `near void2`, `spill void3` (no body tone) | `src/view/light/profiles.ts` own line |
| Scenarios (`src/duel/scenarios/mudgrasp_spirit.ts`) | **done** (21 keys, P1 + P2) | see *Cinematics stage* below |
| Cinematics / SFX | **FIX r1 done** (wet-mud FX rework, see FIX round 1) — **round 1 done** (summon, strike, death, pin effect + persistent aura; sound set wired, mgGrab reworked) | `src/cinematics/kart-b/mudgrasp_spirit.ts` (+ `-fx.ts`), `src/audio/v3/mudgrasp_spirit.ts` |

## FIX round 1 (critic r1 → fixes), 2026-11-06

Critic report: `shots/v3/kart-b/mudgrasp_spirit/critic-r1/` (core verdict: "the FX layer reads as DRY brown sticks /
rubble, not WET, glossy, violet-lit mud"). Evidence of this round: `shots/v3/kart-b/mudgrasp_spirit/fix-r1/`.

**What changed**
- **New wet-mud painter** (`-fx.ts`, `MudMask.wet`): every FX mud shape is now a lit-from-top-left wet tube — lit rim on
  the top/left edge, dark wet right/underside (earth0), a gloss streak INSET one pixel from the rim (earth3 dashes) with an
  earth4 hot catch, and a violet seep (void2) where mud meets the floor. Used by every FX element below.
- **Pin (blocker)**: `wetHand` = fat (5–6 px) short forearm with an elbow lump, a round palm, three 3-px fingers + thumb
  with rounded tips (no forked twigs), drips forming under the palm, violet seep at each wrist base. The hands grab the
  attacker's REAL feet: `scanFeet` reads the attacker's current frame (bottom rows above the anchor, `getPixelAlpha`) and
  groups opaque columns into feet → one hand per foot (≤4), alternating behind / in front; while grabbing, the fingers are
  drawn in FRONT of the leg (wrapping), the palm behind. Mud collars climb the ankles; the pool's front half is drawn over
  the feet (rows ≥ ground−1) while the sprite is sunk 2–3 px → feet visibly sink. The ring (`paintPool`) is a dark band
  (ink outer edge, earth0 body, lit far inner wall earth2, drifting earth3/earth4 gloss dashes) around a violet-black pit
  with ripples sucked inward and a pulsing violet eye; ring size = feet span + 6 (18–30 px).
- **Pin pacing**: special f1–f3 holds 110/120/170 → 80/100/130 (rear ≈ 360 ms) and the attacker's tile is busy the whole
  time: the pool rises from 25 %, the surface bulges (dome), three violet seams leak out of the rim, bubbles boil and pop
  violet, ripple rings every 130 ms, the feet sink 1 px and tremble; violet pit light rises. Burst 150 ms, wrap 200 ms,
  clamp/ring 320 ms, hands sink 180 ms while the feet settle 3→0 px.
- **Sprite special**: f2–f3 asymmetric bent arms (near hand curled to the mask, far arm lower and bent); f5–f8 the
  plunged near arm bends at the elbow (new Pose field `nlen` = segment stretch so a deep plunge keeps an elbow; `nb: 1`)
  with a splash at the entry; the arm's vein fades to a dotted ember past the elbow (no striped staff).
- **Aura**: same ring painter + a breathing violet pool light (rx+6); mud collars on the ankles; three small dark wet
  hands surface in turn on the VISIBLE front arc (avoiding the plate under the feet) and paw at the nearest foot. Expiry is
  now in sync with the padlock: the aura watches the plate's lock (`plateLockOf`, a read-only peek at StatBadge's private
  `lock`) and drains on the tick it goes; the observer no longer clears it at turnStart (it removes the uid and arms a
  1.6-s safety net). Verified: `mgPinLock-clear-z3.png` (padlock and ring leave together at t≈7840).
- **Summon**: vortex redrawn — dark glossy dish, four continuous 2-px spiral ribbons (lit crest, earth4 head at the rim,
  violet where they enter the pit), glossy bubbles that pop violet, a violet pit that grows with its own light pool. f2 is
  held 170 ms and two fat wet FX hands claw at the air over the sprite wrists (near + rear). f3: the sprite's hands now
  reach the tile's side edges (nx 33 / rx −29), and `gripMarks` hooks three fingers over the tile's lip on each side with
  smears that stay until land and dry back in steps. The generic finale (white/earth shockwave) is gone: wet ripple rings,
  shake and a light flash at land; the plate pops at the eye-ignite beat (LAND+1), not mid-climb.
- **Strike**: lump ≈9 px glossy with a violet ember core, squash & stretch along its velocity, a two-lump dripping tail,
  glossy drops shed; arc ≥ 26 px (dist×0.35, ≤48), flight 270–400 ms; the sprite plays through release into the
  follow-through (f7) and jiggles 1 px during the flight (no frozen release frame). Contact: a violet pop (no white star of
  ours), then a fat wet splash (big core, short fat petals, fat drops flung past the tips) + violet light; the goo decal
  is an irregular wet blob with drips that lengthen and slide.
- **Death**: seams are ink cuts with violet light in them (hot points pulsing), drawn at `DEPTH.TILE_FX+1` i.e. UNDER
  the card lying on the tile; glossy 5-px tongues with a 6-px head run out along them and are sucked back (heads retreat,
  bodies thin in steps); the puddle has a counter-turning spiral (summon vortex reversed) with a violet eye; puddle drains
  and seams close BEFORE the card is born. Sprite death holds f6–f8 110/120/120 → the mask slides/sinks over 4 frames
  (+ a ripple ring at n−3 and a bubble/violet glk at n−2).
- **Mud-dies crawl**: the old tile cracks open violet (`violetSeams`, smaller tile light flash so it no longer reads as a
  tinted square); the crawl is a 6–8 px glossy stream with a pulling head of two little hands, a violet glow light on the
  head, a dark wet trail that dries back in three steps.
- **Sprite hit / hitHeavy**: hit f0 stays near idle (HA-21) → f1 squash (sink 3, swell 2, mask −3 px, spray) → f2 jelly
  stretch → f3 smaller squash → settle; hitHeavy f1–f2 flatten into the puddle (sink 8–9, swell 3, splash) → f3 heaves
  back up with an overshoot.

**Gates / tests**: monster-gates `--class medium --ref none` → 21 ok, 0 FAIL (`fix-r1/gates.txt`; summon margins and
HA-21 re-checked after the changes); `tests/art/mudgrasp_spirit*.test.ts` 16/16; tsc: no mudgrasp errors. v1: all changes
are in LOOK_V3-gated registrations or v3-only art (monsters-v3), no shared file touched → v1 films not re-run this round.

**Evidence** (`shots/v3/kart-b/mudgrasp_spirit/fix-r1/`): `mgPin.png` (1×, whole duel), `mgPin-1x.png`, `mgPin-z.png`,
`mgPin-grab-z5.png`, `mgPin-ring-z4.png`, `mgPinP2-z.png`, `mgPinKill.png`, `mgPinKill-z.png` (crawl), `mgPinLock.png`,
`mgPinLock-aura-z4.png`, `mgPinLock-clear-z3.png`, `mgSummon.png`, `mgSummon-z.png`, `mgAttack.png`, `mgAttack-z.png`,
`mgAttack-splat-z.png`, `mgKill.png`, `mgKill-z.png`, `sheet-p1/`, `sheet-p2/`, `gates.txt`.

**Open after FIX r1**
- Sprite material (critic major "matte dry earth"): NOT reworked in the sprite this round — the FX layer now carries the
  wet language; the sprite arms are still matte earth bands at 1×. Next round: inset gloss streaks on arms / mound,
  chunkier 3-finger claws, more violet crack light in the mound.
- The far front arm in special f5–f8 is still a straight darker diagonal (the near arm now bends).
- The plate (ATK/DEF badge) sits right under the attacker's feet and covers the ring's front arc; the aura hands avoid
  it, the ring reads on its sides only. Shared UI: not changed.
- The white 4-point star + thin white ring on contact against a guarding target is the SHARED guardReact / blockClang
  (battle.ts), not ours; our contact is the violet pop + wet splash.
- The dark soft blob ~30 px above the dying mud (critic) is most likely not from our files (not verified by a test film): it appears with the ember_wolf's fire hit
  (smoke) / shared light layer; nothing of ours draws there (all our rasters are floor-level or on the sprite).
- Summon vortex: at 1× its spiral ribbons still read partly as concentric rings (the iso squash); the sprite's own puddle
  (with its dotted rig swirl) covers its centre.
- Minors not done: face-down flip uses the generic hologram build; revive uses the shared soul_recall ghost; board
  footprint not shrunk; no idle SFX / struck-body mud sound (decisions 3/4).

## Round 3 — rig polish (stage RIG + ALL ANIMS re-run), 2026-11-01

Re-checked every anim P1 + P2 against the spec and the owner's 1× note. The mask / hood / arm value ladder from round 2
holds; the weakest read left was the GROUND CONTACT: planted hands were shapeless stubs merged into a puddle of the same
value, so "hands grip the ground / the tile edges" (idle drum, summon slap, guard brace) did not read. Changes (rig only;
Pose API, anim tables, marks, holds, points unchanged → cinematic frame numbers still hold):
- **`plantedHand()`** (new, `-rig.ts`): any wrist on the ground (y > GY−9) now draws a splayed CLAW — a knuckle dome over the
  wrist and four separate clay fingers (2 px wide, 1 px crease/ink gap, thumb bent back, fingers bent forward, tips dug
  into the mud). Back hands use 1-px fingers (depth). A wrist under the surface sinks the claw row by row (summon start,
  death, special plunge) instead of drawing it. Airborne hands (crown, burst, throw) keep the fanned `hand()`.
- **Drumming**: the near claw drums (as before, now visible as lifted fingertips); the far claw drums two fingers out of
  phase (its outermost finger never lifts, so the HA-9 feet row stays fixed) → idle liveliness 16.1 → 16.8 % (P2 15.7 %).
- **Puddle** = a dark wet pool (`earth0` with `earth1` reflections + one `earth2` catch each, lit `earth1` front lip,
  small rim knobs while the body stands) so the lighter clay claws and the mound's lit base stand on it.
- **Elbow lumps**: mud gathers at each elbow (a lump + 1–2 px drip) so the arms read less like sticks (subtle).
Evidence `shots/v3/kart-b/mudgrasp_spirit/r3/`: `idle-f0-p1p2-x5.png`, `idle-claws-x8.png`, `summon-f3-grip-x5.png`
(claws gripping the puddle rim on the slap), `sheet-p1/`, `sheet-p2/` (all 13 anims ×2 with points), `gates.txt`
(`--class medium --ref none`: 21 ok, 0 FAIL), `mgIdle-1x.png`, `mgIdle-x3.png` (in the duel with the light layer).
Tests: `tests/art/mudgrasp_spirit.test.ts` 11/11, `-cardart` 5/5 (no test change needed). tsc: no errors in my files.
Not re-run this round: sameness (round 2 UYARI set stands), cinematic films (rig change is visual only; the cinematic
agents should re-LOOK `mgSummon` f3 — the claws now grip the rim — and `mgPin`).

## Cinematics stage (2026-10-31)

Files: `src/cinematics/kart-b/mudgrasp_spirit.ts` (new; every registration `if (LOOK_V3)`, priority 20, names
`kart-b:mudgrasp_spirit:{summon,strike,effect,death}`), `src/cinematics/kart-b/mudgrasp_spirit-fx.ts` (painters; no side
effects), `src/audio/v3/mudgrasp_spirit.ts` (recipes + `MUDGRASP_SPIRIT_VOICE`, all roles incl. revive pair),
`src/duel/scenarios/mudgrasp_spirit.ts`. No shared file touched in this stage. No `ctx.focus` (EF-8).

- **Summon "the climb"** (`runSummon` + own v3 entrance): a turning mud vortex opens on the tile under the sprite's
  puddle (`mudVortex`, violet pit light, bubbles, ripples; `mgVortex` sustained → stopped at land) → f2 hands burst
  (`mgBurst`, clods, violet flash + motes) → f3 palms slap the tile edges (`mgSlap`, 2-px shake, mud stains under both
  palms, earth flash) → f4 haul (`mgHaul`) → land f7 (`mgLand`, vortex closes in 3 steps, ripple ring, finale with the
  earth ramp) → f8 the eyes ignite (void4 flash at the head) → f9 shake-off (clods, two `mgDrip`).
- **Strike "Çamur Atışı"**: from `strikeStartFrame`; `takeCharge('mgCharge')`; clods at the scoop (f2); plays to the
  release frame (f6) and HOLDS it while a sticky lump (`drawBall`, violet ember + a following violet light) lobs in a high
  arc (arc 18–40 px, 230–340 ms), its ink shadow sliding over the floor, shedding drops; `s.impact()` on arrival (battle's
  medium hit-stop, number at +0 ms), `mgImpact`, splat star, goo decal sliding down the struck body, floor stain;
  then f7–8 the hand slaps into the ground and sinks (`mgSink`, stain + clods). Direct: lands on the duelist, stain stays.
- **Effect "Pençe kilidi"** (`registerCardHook('effect')`, consumes the `positionChange`): finds the battle that targeted
  the mud; mud alive → it rears (special f1–4) while the floor under the attacker grumbles (`mgGrumble`), ripple rings run
  out and the pool seeps; f5 it plunges its hands into its own tile (`mgSink` on the mud, clods, violet flash) → under the
  attacker four fat clay hands (lighter `HAND` tones so they read on the dark floor) burst up (`mgBurst`) → arch over and
  clamp the feet on their own sides (`mgGrab`: four distinct suction cups, each with a seat knock) — the attacker is yanked
  2 px down and trembles → clamp (`mgClamp`, 2-px shake): the attacker is FORCED into toGuard (or straight into its guard
  loop when it has no toGuard), its card turns side-on, badge → defense; the pool contracts into the 6-px ring (`mgRing`),
  the hands sink, and the persistent **`mudPin` aura** takes over on the same pixels (ring band, churning inside, lumpy
  front lip over the feet, three hands rising/flexing/sinking in turn with wet glints, violet pops, breathing violet light).
  Meanwhile the mud holds the pull (f8, moan `mgRoar`), comes back out (f9–11) and closes its wall again (toGuard).
  Mud dead (`from:'graveyard'`) → a violet flash on its old tile and its spilled mud CRAWLS over the floor to the attacker
  (`mudCrawl`), then the same grab. Expiry: an observer clears the aura on `turnStart`/`phaseChange`/`controlChange`/
  `destroy`/`gameOver` once `turn > lockPositionTurn` (verified with logs on `mgPinLock`: cleared at turn 6 = lock 5 + 1).
- **Death "sıvı olup karoya geri akar"** (option (b), bookkeeping as `_v3/death.ts`): contact flash / guard-break entry,
  f1 the mask slips (`mgMaskSlip`, clods), f2 six cracks open in the tile (`cracks`, reach 40 px so they show past the
  sprite's puddle), dissolve: the mud runs out along the cracks and drains into them (`mgDrain` sustained, violet glow),
  the mask sinks last (`mgGlk`, violet flash + ripple), then the puddle is drunk into the centre and the cracks close in
  three steps in the last 150 ms while the card is born. No shatter, no dry/crumble, no 28 Hz swell.
- Sounds: `mgGrab` reworked this stage (four separated cups + seat knocks; the squelch bed lowered) —
  `shots/v3/kart-b/mudgrasp_spirit/sfx/mgGrab.png`; `mgGrumble`, `mgClamp`, `mgRing` spectrograms in the same folder.

**Scenario keys** (prefix mg): `mgSummon`, `mgSummonP2`, `mgSet`, `mgPin`, `mgPinP2`, `mgPinWide` (stone_sentinel bounced
and pinned), `mgPinKill`, `mgPinKillP2` (mud dies, pin resolves from the graveyard), `mgPinFlip`, `mgPinFlipP2` (face-down),
`mgPinLock` (+3 turn ends: aura persists, then clears), `mgAttack`, `mgAttackP2`, `mgBlocked`, `mgDirect`, `mgDirectP2`,
`mgKill`, `mgKillP2`, `mgRevive`, `mgReviveP2`, `mgIdle`.

**Gates** (scratch `/tmp/claude-0/-home-user-yugioh/77596f6a-069b-5204-8bfc-ba0d0b8509ca/scratchpad/mudgrasp_spirit/cin/`):
- camera base `camera-base.json` taken BEFORE the cinematic file existed; `m1.json` `--camera-gate`: **21 ok, 0 FAIL**
  (zoom 1, focusCalls = base).
- Budgets (game clock): effect 1.80 s (mgPin), 1.88 (mgPinWide), 1.52 (mgPinKill) ≤ 2.32; mud's battle 2.88 s (mgAttack,
  incl. reactions) ≤ 3.19; blocked 1.95; direct 2.08–2.10 ≤ 2.32; death 1.43–1.53 ≤ 2.03; summon 2.38 s (spec 2.2 s scene);
  number vs contact 0 ms. (The attacker's `battle` durations in the pin scenarios include the effect, because
  `battleV3` plays the battle triggers inside the battle event.)
- palcheck (a5) on the effect windows: Δoff ≤ 0.1 pt in my windows (mgKill 1.23 pt for one frame = the wolf's flame hit
  before the death); white 1.8–2.2 % is the HUD badges/digits and the mask already present in frame 0 (1.48 %).
- `npm test`: only the known failures (cardface G1 scrap_raiders, dusk_ashen, hourglass_imp, shield_titan).
- v1: `filmdiff --set v1` **17/17 IDENTICAL** (a6v1 set not run this stage).

Evidence `shots/v3/kart-b/mudgrasp_spirit/cin/`: `mgSummon-z.png`, `mgPin-z3.png`, `mgPin-hands.png`, `mgPinKill.png`,
`mgPinFlipP2.png`, `mgPinLock.png`, `mgPinLock-z.png`, `mgAttack-z.png`, `mgKill-z.png`, `mgDirect.png` (+ wide films).

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
11. (round 3) In the duel the light layer still darkens the claws a little; they read at ×3, at 1× they are a
   ragged lit fringe on the dark pool. The card art's hands (chubby maps) are rounder than the sprite's thin claws —
   acceptable (different scale), align if a critic asks.
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
5. Idle SFX (glub + finger drum): NOT built (orchestrator decision 3 — optional; no per-unit hook in my files without a
   new animationupdate listener). Struck-body mud material sound: not built (decision 4, shared material tables) — when
   the mud is struck the generic hit sound plays; its own sounds carry the identity when it strikes / pins / dies.
10. (cinematics r1) Only one critique round so far (my own LOOKs). Candidates for the next rounds: the pin's burst arms
   still read a little like stakes for a frame or two at full height; the seep phase (≈450 ms while the spirit rears)
   is quiet visually; the aura clears ≈0.5 s before the padlock disappears (observer fires on turnStart, the badge
   sync comes later); the lump is small (r 3.5) on long direct throws; an independent critic + blind test still open.
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
