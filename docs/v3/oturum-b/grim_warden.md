# grim_warden (R2) — "Fener Bekçisi" working notes

Spec: `docs/v3/YENI_KARTLAR.md` §8 R2. Handbook: `docs/v3/oturum-b/HANDBOOK.md`.

## Stage 1 — rig + all anims: design note

**References studied:** `abyss_magus-rig/-maps/-anims` (cloth bands measured from the part's own edges, drape lag, hand-held
staff with a light that is never outlined, special = aim + held aim frame) and the old `grim_warden-rig/-kit/-anims`
(compositor `Comp` with per-part ink/seam separation, `bands()` flat planes, two-bone IK legs planted by IK, floor cut by
`oy` for rise/sink entrances, `pinTip` = one planted floor point in every walking pose). The new rig keeps the old kit's
compositor and band painter (no crimson `LINING`, no lightning) and replaces every part.

**Silhouette ("L"):** a tall, thin, hunched revenant in a tattered hooded shroud; the vertical is the body plus the
spade-halberd planted at its back (far hand), the horizontal is the near arm held straight out with the soul lantern
hanging on a short chain under the fist. The iron cage-helm sits inside the hood; one eye light inside the cage.
Shroud tatters stream back (left), the sleeve of the lantern arm hangs in ragged teeth under the arm.

**Parts (draw order):** back tatters → halberd (earth haft, iron spade head + crescent hook) → far arm/sleeve + far
bony hand on the shaft → boots and shins (iron-shod boots: the planted walker feet) → shroud body (hem ≥ 7 px above the
floor so the lowest 6 rows are boots + halberd butt only, HA-9) → rope belt + key ring → hood back → cage helm (bars,
dark interior, skull teeth) → hood front lip → near arm + sleeve → near bony fist → chain links → lantern (iron roof
+ ring, four glass panes in iron bars, base). After the outline (never outlined, IŞ-9): soul flame in the lantern, glass
glow, the single eye, sparks / soul motes, floor dust.

**Materials / ramps** (palette only; no crim/cyan/teal/mag in the body):
- shroud: `stone2` lit / `stone1` mid / `stone0` shade / `void0` deep folds and the hood's inside; P1 rim `steel`.
- cage helm + boots + lantern iron + spade: `stone4 / stone3 / stone2 / stone1` (+ one `mist` glint per anim).
- bone (hands, skull teeth): `earth4 / earth3 / earth2`.
- haft, rope belt: `earth2 / earth1 / earth0`.
- soul fire (light): glass `leaf1/leaf2`, flame `leaf3`, core `leaf4`, white heart only at full flare. Eye: `leaf4`
  core + `leaf3`.

**Frame:** 104×98, floor GY 94, anchor AX 46, hover 0, weight `heavy`, `p2:'relight'`. Budget class `large`
(5 MB): 104×98×4 = 40.8 kB/frame → ≤ 122 frames. No victory anim (nobody plays it; frames go to the idle).
Points: `muzzle` = lantern glass centre, `staff`/`grip` = spade head / far hand, `hand` = near fist, `head` = cage eye,
`core` = chest.

**Anims (frames / ms / marks):**
- idle 20 f ~2.0 s: lantern pendulum (one 2 s swing, chain angle ±10°, the lantern moves whole px, never rotates),
  flame flickers on its own 5-frame cycle, the eye scans left→right inside the cage (−1/0/+1 px), shroud tatters on a
  10-frame wave, hood tip lags the body by 2 frames, breath 1 px on a 10-frame cycle; boots + halberd butt fixed.
- guard 6 f loop: halberd tilted across the body from the same butt point, lantern pulled in under the arm, shroud
  wrapped forward; toGuard 6 f / fromGuard 5 f (≤ 400 ms).
- attack 13 f: charge@1 (lantern lifted) → whirl overhead on the long chain (3 frames around the head, longest hold
  at the top) → release/impact@6 (lantern hurled down-forward, smear) → contact@7 (lantern bursts green at the end of
  the chain, halberd sweeping in from behind) → recover@9 (chain rewinds, pendulum restarts).
- roar 11 f: helm thrown back, lantern raised high, flame white-hot, shroud billows; charge@1 release@4 recover@7.
- special 12 f (the drain): lantern extended forward and up toward the target (charge@1), release@5 = the thread
  starts; f6–f8 hold "drinking" (flame swells and contracts, glass flares, eye narrows; f7 is the long hold the
  cinematic extends), recover@9 → idle.
- hit 6 f, hitHeavy 8 f, hitMagic 8 f (helm snaps back, lantern swings wildly on the chain = the readable signature).
- summon 12 f: rise out of the floor (cut by `oy`), lantern first held up out of the earth, the far hand pushing up,
  land@6, shake-out of the shroud, idle.
- death 10 f (≤ 0.9 s): f0 = hitHeavy f0; lantern slips off the chain and shatters on the floor (shards + flare),
  helm drops off, the shroud collapses EMPTY into a heap; dissolve@5; the skull-shaped soul mist leaves in the
  cinematic.
- revive 11 f: reverse — the heap refills, helm rises into the hood, lantern glass gathers and relights, land@6.

## Status / evidence
(see below, updated per session)

## Stage — rig + all anims (agent: rig lane, 2026-10-31) — DONE, gates green

**Files (mine):** `src/art/monsters-v3/grim_warden.ts` (shell; the card-art agent's `portrait()` line kept),
`grim_warden-rig.ts` (rewritten), `grim_warden-anims.ts` (rewritten), `grim_warden-kit.ts` (old compositor / bands /
paths kept, materials replaced: SHROUD, SHROUD_FAR, IRON, IRON_FAR, BONE, BONE_FAR, HAND, WOOD — no crim LINING),
`grim_warden-fx.ts` (rewritten: soulFlame, eyeLight, motes, soulBurst, shards, dust, clods, whirlTrail),
`tests/art/grim_warden.test.ts` (rewritten for the new design, 7/7).

**As built (differs from the plan above where noted):** frame 104×98, GY 94, AX 46, hover 0, heavy, relight.
Frame counts trimmed to fit the large budget: idle 20, guard 6, toGuard 5, fromGuard 5, attack 13, roar 10, hit 5,
hitHeavy 7, hitMagic 7, summon 12, death 10, revive 10, special 12 = **122 frames, 4.97 MB** (no victory anim).
- Helm = a map (15×13): iron meridian bars + bands over a bone skull, dark socket with the single scanning eye
  (eyeDx 0/1, a glance down at 2), teeth behind the jaw band. Rigid: rotated only in roar/death/drop (hr), never idle.
- Lantern = 9×14 map; its centre sits on the chain line (`la` = chain angle from down, `cl` length) so a whirled
  lantern flies outward; when whirled behind the head (`la` −40…−170) chain+lantern are drawn BEHIND the body and the
  flame is masked to the lantern's own pixels.
- Halberd planted at `BUTT` (+`bx/by` offset for the roar stamp and the death slide), or held free (`pin:false`,
  `gx/gy`), `hFront` draws it + the far arm in front of the body (guard, chop).
- Soul bounce: after the outline, the 1-px edge of body parts facing the lantern takes leaf1 (leaf2 very close).
- `zap` (hitMagic): soul fire flashes through the cage bars (leaf3/leaf4, light).
- Death: f0 = hitHeavy f0 → lantern drops and lies broken (shards + burst at the floor) → helm drops and tilts to
  the floor → shroud collapses (`col`), arms vanish into the heap, the hood's empty opening gapes on top → halberd
  falls flat (slides 12 px left). dissolve@5. The skull-shaped mist is cinematic work.
- Roar redesigned for sameness: rear back with the lantern pulled in + halberd lifted (charge@1) → hunched forward
  LUNGE, halberd stamps (release@4), the white-hot lantern swung side to side at the foe.
- Attack: charge@1, whirl over the head (apex f3 170 ms), release/impact@5 (50 ms), contact@6 (70 ms, soul burst at
  the chain's end), f7 halberd hauled up behind the head, f8 chop through the low line, recover@9.
- Special (drain): charge@1 draw back, f3 lantern thrust out at eye level (cl 2), f4 inhale (flame dips),
  release@5 flare + glass ring, f6–f8 drinking (f7 = 200 ms hold for the cinematic to extend; motes; shroud blown
  toward the lantern), recover@9. Muzzle point = lantern glass centre on every frame.
- Points: muzzle = lantern, hand = near fist, grip = far hand, staff = spade head, head = cage centre, core = chest.

**Gates:** `monster-gates --class large --ref none`: 21 ok / 0 FAIL (`shots/v3/kart-b/grim_warden/rig-gates.txt`):
margin ≥ 2, out 0, in 0.8–1.1, seam idle 0.89 / guard 0.96, idle max Δ 1.57, liveliness 15.9 %, guard 0.49,
HA-21 sheet 15–23 %, HA-21 phase ≤ 48.6 % (hitMagic), HA-9 boots + butt fixed in 36/36, noise idle 7.5 %,
IŞ-1 lit bias ok, KK-13 122 f / ~2.4 ms / 4.97 MB. `tsc` clean. `tests/art/grim_warden.test.ts` 7/7; `tests/art`
fails only the known dusk/hourglass/shield + cardface G1 (scrap_raiders); `tests/duel/monster-timing` +
`tests/cinematics` green.
**Sameness** (`rig-sameness.txt`, all out-of-plan): KEY all GEÇER; MOTsig UYARI vs abyss_magus 0.60 (attack),
tide_golem 0.61, lumen_sprite 0.62; MOTloop UYARI vs seal_head 0.74 (guard); ashen_drake rhythm UYARI. No KALIR.
Distinction header written in `grim_warden-anims.ts`; a blind eye test is still owed (no critic agent in this stage).

**Evidence** (`shots/v3/kart-b/grim_warden/`): `rig-p1/` + `rig-p2/` (×3 sheets of every anim with points, json/txt),
`rig-gates.txt`, `rig-sameness.txt`, `board.png` (1× on tiles), `gwAttack-r1.png`, `gwAttack-r1-zoom.png`
(default-path strike in game: the whirl / burst / chop play; the generic default strike still moves the sprite and
flashes mid-whirl — the v3 strike cinematic must time `s.impact()` on contact@6).

**Open issues for later stages:**
- Cinematics (summon via `runSummon` + cut-in, strike timed to contact@6, drain on `special` with the f7 hold,
  option-(b) death with the skull mist, lantern-colour aura) — none yet; the default paths play the new sprite.
- The drain's "lantern takes the target's element colour" cannot be a sprite recolour: plan an overlay at
  `points().muzzle` (glass 5×6 at Lo+2..6, Lo+5..10) in the cinematic.
- Idle SFX not built (orchestrator decision 3: optional) — open.
- Critique rounds: 3 self-critique iterations (helm redesign ×2, hem/tatters, attack/roar/death fixes); independent
  critic agents still owed.

## Stage — card art + cut-in + light profile (agent: card-art lane, 2026-10-31)

**Files (mine):** `src/art/cardart-v3/grim_warden.ts` (rewritten), `src/art/cutins-v3/grim_warden.ts` (rewritten,
self-contained: imports nothing from the rig), `tests/art/grim_warden-cardart.test.ts` (new). One-line edits:
`src/view/light/profiles.ts` (grim line), `src/cinematics/_v3/presets.ts` (grim DEATH_PRESETS line),
`src/art/monsters-v3/grim_warden.ts` (+2 imports + `portrait()` — the rig file already had the new design; the line is
`portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); }` with `import card from '../cardart-v3/grim_warden'`
and `import { renderArt } from '../cardart-v3/_kit'` — **rig agent: keep it when you rewrite that file**).

**Card art.** Native drawing on the DARK recipe: cowl + cage helm (bars into a crown knob, cheek ring, bone skull,
earth4 teeth, one leaf4 eye), the near arm straight out ("L") with the soul lantern = brightest point (leaf4 flame,
leaf3/leaf2 glass) and focus (big 69,48 / small 35,25), spade-halberd behind, far graves as void1 silhouettes, green
pool, void1 mist lenses. Materials follow this file's rig note (shroud stone2/1/0 + void0, iron stone4/3/1, bone
earth4/3/2, haft earth2/1, rim void3 = DARK card light). Small 44×34 is a hand map (`SMALL`, material letters), not a
reduction. Living art 6 f × 150 ms: flame flicker + eye scan 1 px. Stats (f0): big colours 19, backdrop 6, isolated
1.9 %, offPalette 0, outlineInk 0.91, focusOk; small colours 19, isolated 4.8 %, outlineInk 0.98, focusOk.
Subject fill (bbox) is 0.88 big — above the 0.6–0.75 guide because the halberd at the left and the lantern at the
right span the window; accepted (the "L" + halberd is the spec silhouette).

**Cut-in.** 200×144, 6 frames, holds `[260,110,100,110,120,420]`, `p2:'relight'` (silhouettes identical, tested),
accent leaf3 / leaf1. Rhythm cut to the DEFAULT beats (flare 290 in f1 = eye ignites; slam 370 = f2 lantern blaze;
exit 700 = f5). f0 stare (lantern low at the bottom edge, dim); f1 eye ignites + lantern swings up; f2 soul fire
blazes (white heart), green light catches the cage bars / skull edge; f3 head pushes 2 px, eye cross glint; f4 swing
back, 3 soul wisps; f5 held. Lens glint (findEye f0) = the eye's white core at (133,60) for both lights (tested).
A dedicated `RHYTHM` entry was NOT added: `tests/presentation/accessors-v3.test.ts` pins RHYTHM_TODAY (shared test).

**Light profile.** `MONSTER_GLOW.grim_warden = { emissive: [leaf4 1, leaf3 0.7, white 0.8], near: [leaf2 0.45],
halo 0.7, pool 1.05, spill leaf3 }` — matches the rig note (leaf3/leaf4 + white heart are lights only; leaf2 glass
glows only next to the flame; leaf1 glass never). **Rig agent: never use leaf3/leaf4/white in a body tone.**
Note: MONSTER_GLOW is read by the light layer, which the v1 look builds only with `?arena=v2` (default v1 films use
arena v1 → unaffected).

**Death preset.** `{ material: 'shadow', accent: 'shadow' }` (was shadow/crystal: the cyan crystal glints contradicted
the green soul fire / empty-shroud ending). Only v3 paths read it (`_v3/death.ts`, `_v3/summon.ts` column); the
planned custom option-(b) death owns the real ending anyway.

**Evidence** (`shots/v3/kart-b/grim_warden/`): `cardart-big-f0-x3.png`, `cardart-small-f0-x6.png`,
`cardart-small-f0-x1.png`, `cardface-vs-aces-x4.png` (face + mips next to crystal_wyrm / abyss_magus / ashen_drake),
`hatcard.png` (real in-game face 1×/2×, art 1×/3×, iso field cards), `cutin-sheet-p1-p2.png`, `cutin-f2-x3.png`,
`cutin-p1.png` / `cutin-p2.png` (?dev=cutin), `gwSummon-cutin.png`, `gwSummon-cutin-zoom.png`,
`gwSummonP2-cutin-zoom.png` (tribute summons, P1 and P2).

**Tests.** `tests/art/grim_warden-cardart.test.ts` 5/5. `tests/art/cardface-v3.test.ts`: 9/10 — the failing G1 is
`scrap_raiders` (0.692 < 0.7), not a lane-B card. `tests/presentation/` + `tests/cinematics/v3-kit2.test.ts` green.

**Open issues.**
- The tribute summon still plays the OLD v1 `cutIn` band (purple, ~1.5 s) via `_defaults/summon.ts`; the v3 band
  (`cutInV3`, ≤ 900 ms, findEye glint on the eye) appears only once the summon stage routes through `runSummon`
  with `S.climax()`. In the old band the white lens cross lands near the lantern hand, not the eye (old band's own
  placement) — re-check after the summon stage.
- The 2× inspect card shows the small art ×2 (the kit's big-art integration is not wired for any monster).
- If the orchestrator wants a grim-specific cut-in rhythm, add it to RHYTHM together with the RHYTHM_TODAY test line.
- Cut-in critique rounds were self-critique (no critic agent available in this stage); 3 iterations on each art.

## Stage — cinematics + SFX + scenarios (agent: cinematics lane, 2026-10-31)

**Files (mine):** `src/audio/v3/grim_warden.ts` (21 recipes + `GRIM_WARDEN_VOICE`, wired by the existing
`kart-b.ts`), `src/cinematics/kart-b/grim_warden.ts` (all registrations `if (LOOK_V3)`, priority 20),
`src/cinematics/kart-b/grim_warden-fx.ts` (pure painters, no side effects), `src/duel/scenarios/grim_warden.ts`
(rewritten). Shared, minimal + v3-only (orchestrator decision 1): `src/cinematics/battle/plates.ts`
(`showBattlePlates(..., { holdDrain })` leaves the attacker's own declare debuff off) and
`src/cinematics/battle/declare.ts:374` (passes `{ holdDrain: true }`). Both run only in the v3 declaration.

**Sound palette** (§5.1): B♭ minor lantern glass (B♭4–F6, below/darker than the wyrm's E-major glass), tritone
choir on F/B (not the magus' D/G#), pendulum chain = slow `link` pairs 1180/1630 Hz + a dry brown-noise creak,
soul fire = fluttering pink band + F1 saw hum, iron = FM 2.13/1.73 at 330–380 Hz / 1.1 kHz (away from 1.41 @ 470–760).
`gwSiphon` is the only identity layer built on `glassReverse` (12 reversed swells DESCENDING the ladder, faster
and faster) + a falling inhale band; `gwThread` is a sine falling from the target's pitch (played with
`pitch` per attribute). Roles: roar gwRoar, arrive gwRise (start/stop at land), land gwLand, charge gwCharge
(held from the declaration, taken over by the strike), swing gwSwing (f4), release gwRelease, impact gwImpact,
deathStart gwShatter, dissolve gwCollapse, afterDissolve gwHelm, burst gwFade, revive gwReviveGather/gwReviveLand.
Extra beats: gwStone, gwChop (f8), gwDebuff (−400 bell), gwGiveBack, gwKeep, gwWail.
Spectrograms: `shots/v3/kart-b/grim_warden/snd/*.png` (?dev=audio&page=one; 3 tuning passes: siphon steps made
dominant over the drone, choir/wail formant saws boosted (Q 3/4), impact sub cut to 0.98 raw peak, quiet
swing/release/giveback/fade raised). Note: a few PNGs predate the last level bump (thread/keep/giveback/fade).

**Cinematics** (header of `kart-b/grim_warden.ts` has the storyboards):
- summon (hand, tribute): grave mound swells + cracks, headstone pushes up, soul light seeps (leaf3 cracks,
  flickering pool, motes) → `summon` pose rises out of the mound (no hologram), headstone shoved over on f2
  (gwStone, clods) and falls flat → land: mound bursts flat under the boots, dust → cut-in on the pose peak
  (`runSummon` → `S.climax()` = the v3 band, ≤ 0.9 s) → leaf-green finale. Keeps the base's single tribute
  `focus` (camera gate). Non-hand summons fall to the base.
- effect (activate monsterEffect): takes the AttackHold (marks dropped, held charge dropped), `special` to the
  drinking frame; on release the soul thread (target attribute ramp, arcing, beads flowing in, 3 dots orbiting
  the target core) runs to the lantern (gwSiphon + gwThread); drain beat: `showBattlePlates` rolls −400
  (gwDebuff + crimson flare at the plate), the target fades (bayer 30 % one tone darker, live frames), the
  lantern glass/flame repaints into the stolen ramp (bayer-stepped); thread thins and snaps; back to the attack
  charge pose; hold re-kept. Battle hook (`attack`, after base): target alive → give-back (beads run home,
  fade + colour step out, gwGiveBack); target dead → aura `grimLantern` keeps the colour until turnStart.
- strike "Fener Tırpanı": continues from the declaration pose; soul-fire whirl trail on the lantern's live
  point (stolen colour if drained), GLIDE toward the target on f2→contact (floor soul marks + shed wisps),
  contact on attack 'contact' (s.impact at the lantern), soul burst ring + rays + glass shards bouncing on the
  target floor, gwImpact; f8 iron crescent (gwChop); glide home on the recovery. Direct: short glide + soul
  bolt to the duelist. Melee loser: returns at contact (battle owns the body).
- death (option b): death pose joined from the reaction (planned entry / guard break as deathV3); f3 gwShatter,
  f4 glass shards + flash + the SKULL-SHAPED MIST (11×11 skull in the lantern's ramp — green, or the stolen
  colour) rises swaying and comes apart (gwWail); dissolve gwCollapse; helm drop gwHelm + dust; last frame →
  4-step bayer knock-out in 150 ms with ash flares (gwFade), card born on that frame (`cardLeaves`).

**Scenarios:** gwSummon(P2), gwAttack(P2) (EARTH drain, target dies), gwDrainFire, gwDrainWaterP2,
gwDrainSurvive(P2) (equipped wyrm: target lives, warden dies), gwDrainDecline (trap window declined →
activate in batch 2), gwNegated (chains: no drain), gwFaceDown, gwBlocked (shield_titan defense, bounce),
gwDirect(P2), gwHit, gwKill(P2), gwGuard, gwGuardKill.

**Gates:** `tsc` clean; filmdiff v1 17/17 IDENTICAL (`cin/filmdiff-v1.txt`; a6v1 set not run); vitest cinematics/presentation/audio + grim art tests 244/244.
Measure (`cin/measure-r1.json/.txt`, game ms): tribute summon 4000 ≤ 4350; activate (drain) 1934 ≤ 2320; battle
1800–2616 ≤ 3190; destroy (grim) 1500–1583 ≤ 2030; direct battle 1834 ≤ 2320; declaration 316 ≤ 435; 0 errors.
gwGuardKill battle 5034 includes ember_wolf's own burn trigger (activate 2183, not ours).
Camera gate vs base taken before any change (`cin/camera-base.json`): 9 ok, 11 NOBASE ok, 0 FAIL.
Palcheck (clip 200,60,240,160 / 250,90,150,110): the drain/strike/summon windows sit at Δoff ≈ 0 against the
film's own f0; the a5 FAILs come from the shared declaration (t≈340–480, same in gwHit, a non-grim cinematic)
and the arena's white baseline (~1.6–1.9 % in this clip in gwHit too); the burst's white core was reduced.

**Evidence** (`shots/v3/kart-b/grim_warden/cin/`): gwDrainFire-r1(.png, z), -drain-z, -strike-z, gwSummon-z,
gwSummon-r2z, gwKill-z, gwDrainSurvive-z, gwAttackP2-z, measure-r1.*, camera-base.json.

**Open issues:**
- Idle SFX (chain creak / soul hum) not built: needs a per-unit idle listener for units created by sync; logged.
- Wood/mud struck-hit materials: not grim's (n/a).
- Target-survives branch where the warden itself dies (the only survive case: ATK−400 ≥ 2500): the stolen light
  leaves as the skull mist in the stolen colour instead of flowing back to the target.
- No independent critic rounds (no critic agents in this stage); 2 self-critique passes (thread arc/thickness,
  glide inset 5→11, mound flattening under the boots, burst white).
- MP4 with audio (clip.mjs) not produced in this stage.

## Critic round 1 (independent critic, 2026-10-31) — evidence `shots/v3/kart-b/grim_warden/critic-r1/`
Verdict: below the golden-rule bar on the signature moments. Ranked findings (details in the critic report to the orchestrator):
- BLOCKER drain unreadable at 1×: the thread is 10–20 px long (combatants are near-adjacent), 1 px wide, in the target's own
  hue over the target (fire on ember_wolf, blue on coral_serpent) → `gwDrainFire-drain-z.png`, `gwDrainWaterP2-z.png`, `gwDrainFire-full.png`.
- BLOCKER strike whirl trail draws as straight white/yellow polyline segments (reads as a debug line / laser), not a
  circular soul-fire smear; contact burst = overlapping green/orange/purple dotted rings with "+" ticks (reads as a targeting
  reticle) → `gwDrainFire-strike-z.png`, `gwDrainFire-contact-z.png`, `gwDirect-z.png`, `gwBlocked-z.png`.
- MAJOR lantern drops back to green for ~600 ms after the strike before the `grimLantern` aura repaints it (target died) → `gwDrainFire-after-z.png`.
- MAJOR helm/skull in earth tones reads as a brown waffle grille / wooden mask at 1× (sprite + cut-in) → `z-idle-f0-2.png`, `gwSummon-cutin-z.png`.
- MAJOR low motion amplitude: attack whirl is a half arc (no full circle), special/roar/hitMagic barely leave the idle silhouette,
  summon is an elevator rise → `z-attack-*.png`, `z-special-*.png`, `z-hitmagic-roar.png`, `z-summon-*.png`.
- MAJOR skull mist is an opaque green "alien" figure standing on the floor ~400 ms before rising → `gwKill-z.png`, `gwGuard-z.png`.
- MAJOR no visible swinging green floor light pool in idle (spec idle line) → `idle-board-z.png`.
- MAJOR summon mound reads as a brown pie, headstone is a 3-px nub, no "fling" → `gwSummon-rise-z.png`.
- minor: gwSiphon peak −18.7 dB (drone-dominant), impact lacks a glass-shatter high layer; gwGuard scenario has no "guard holds" branch;
  cut-in lantern clipped by the band edge; idle pendulum has no vertical arc (muzzle y fixed).

## Fix round 1 (agent: fix lane, 2026-10-31) — evidence `shots/v3/kart-b/grim_warden/fix-r1/`
Every blocker + major of critic r1 addressed; minors mostly. Files touched (all mine): `src/art/monsters-v3/grim_warden-rig.ts`,
`-anims.ts`, `-fx.ts`; `src/art/cutins-v3/grim_warden.ts`; `src/cinematics/kart-b/grim_warden.ts`, `grim_warden-fx.ts`;
`src/audio/v3/grim_warden.ts`; `src/duel/scenarios/grim_warden.ts`. No shared file touched in this round.

**BLOCKER drain unreadable → fixed.** `soulThread` rewritten: a cubic arc lifted ≥ 30 px over BOTH sprites and bulging past
both ends (they stand side by side), an ink-sheathed band 3 px wide (ramp[3] body + ramp[4] core), fat 3×3 soul beads with a
white heart flowing in, soul wisps torn out of the target's body into the arc's foot, a growing/pulsing stepped halo round the
lantern (`fill`), a light pool riding the arc apex + a glow on the target (light layer). `soulFade` now darkens TWO tiers (30 %
of the pixels two tones, the next 30 % one tone) and a crawling rim of the stolen colour runs up the target's outline (starts
before the thread: "it feels it coming"). A big red −400 (`impactNumber`, size 2) pops on the target's FAR side on the
gwDebuff beat (clear of the arc), the plate still rolls. 1× full frame: `gwDrainFire-full.png` (#6–#12 the arc + −400 are the
first read); zoom `gwDrainFire-drain-z.png`, P2 `gwDrainWaterP2-z.png`, `gwDrainWaterP2-full.png`.

**BLOCKER whirl trail + reticle burst → fixed.** Cinematic trail = angle/radius of the lantern round the live `hand` point,
drawn as a curved band along that circle (5 px head ramp[4]/[3]/[2] → 3 px → dotted 1 px tail), afterimage lanterns (ink case,
ramp glass) on the circle, shed embers; always the lantern's current colour. Contact burst = solid irregular 11-spike star
(ramp[3] / ramp[4] / white core) for 2 frames → rays break into shards, ONE ring once, shards in the same ramp. The sprite's own
burst lost its ring (embers instead) and its trail is now a band painted behind the figure. Battle already stages the white
silhouette + hit-stop: the 17 ms film shows the silhouette flash and ≈150 ms frozen hold (`gwDrainFire-contact-z.png`).
Strike: `gwDrainFire-strike-z.png`, direct (green) `gwDirect-z.png`.

**MAJOR lantern colour gap → fixed (root cause).** The tint/fade overlays synced in an UPDATE callback, so while the warden
glided home (depth rising each tick, set later in the same tick) the overlay sorted UNDER its own sprite. Overlays are now
glued on POST_UPDATE (`glue()` in the fx file, before the render's depth sort). The tint also recolours EVERY soul-light pixel
of the frame (glass, flame, trail, burst, motes, soul bounce) except the eye box, so no green leaks in any anim.
`gwDrainFire-after-z.png`: orange from contact through the target's death to the kept aura, no green frame.

**MAJOR skull reads as brown grille → fixed (sprite + cut-in).** Helm is a hand map now: pale cool bone skull (stone4 lit
cranium/cheek, stone3, stone2 crevices, void0 socket/nose/teeth gaps) inside DARK iron (stone2/stone1, stone0 separation):
TWO meridian bars over the face, crown ring, jaw + chin bands. Eye = 2×2 leaf4 core + leaf3 halo + leaf2 brow glow (white
heart at full). Cut-in: skull/cage painted with private tokens mapped last → pale stone bone, dark cage, bar count 4 → 3 (2
over the face); the lantern raised 8–10 px so it never touches the band's lower edge (`cutin-sheet.png`).

**MAJOR motion amplitude → fixed.** Attack: crouch → arm flung up-back (lantern behind the body) → fist overhead, lantern over
the hood → apex tipping forward → chain at full length straight out → hurled down, torso counter-leans −3 → +6. Special: rear
back (hood tipped up) → whole-body thrust (+6/7 lean, hood tipping over the cage) → three clearly different drinking frames
(lantern ±2 px, flame swell, shroud blown +7…+9). Roar: rear back with helm thrown up (hr −12) → deep lunge (+7) with ±50°
lantern swings. hit/hitHeavy/hitMagic: lantern flies to the chain's limit, overshoots, settles (hitMagic also snaps the helm
back on f1; f0 kept local for KK-4). Summon: jerky rise (claw out → pause → heave → pause/shoulder shove → heave → squash 4 px
on land). Idle pendulum lifts the lantern 1 px at both ends (`ly`). Boots: lit cuff/instep, toe-cap glint, shaded heel, sole
line. One-pass despeckle on cloth/iron (isolated px −10 %). Sheets `sheet-p1/`, `sheet-p2/`; gates `gates.txt`: **21 ok /
0 FAIL** (HA-15 in 0.71–0.97, HA-18 liveliness 17 %, HA-21 phase max 48.6 %, IŞ-10 ok, KK-13 4.97 MB).

**MAJOR skull mist alien → fixed.** It puffs out of the broken lantern (squashed) and rises at once (38 px / 600 ms), body =
two bayer tones of vapour with HOLES for sockets/mouth (no ink), hot socket points, a wobbling jaw, a streaming tail to the
lantern dissolving from the bottom, stretches and tears apart from 40 %; a light pool rides with it; gwWail on its birth
(`gwKill-death-z.png`, `gwKill-full.png`).

**MAJOR no idle green pool → fixed (card file only, v3).** A watcher (one per scene, started by the first event the observer
sees) keeps a leaf3 light pool (radius 26, flicker) glued to every warden's live lantern point — it swings with the
pendulum, takes the stolen colour while the lantern holds one, fades at death (`idle-pool-z.png`). Shared MONSTER_GLOW not
touched (its unit pool is DARK violet by attribute — shared design).

**MAJOR summon mound pie → fixed.** Dome built per column (≤ 9 px), full ink silhouette, five tone bands lit top-left, pebbles;
branching cracks (5 trunks + forks) void0 → leaf3 with pulsing leaf4 trunks and a white crown split; the pool pulses while the
light seeps. Headstone 10×14 (rounded, carved cross) at the back rim, FLUNG up out of the soil on the seep beat (2-frame jolt +
dust + a soft gwStone), shoved over on summon f3 (tipped pose in the air, in front), lands flat beyond the rim with a shake and
dust (`gwSummon-rise-z.png`, `gwSummon-shove-z.png`).

**minor sound → fixed.** gwSiphon: glassReverse steps +5.7 dB (raw peak 0.26 → 0.50, −15.4 dB), drone/sine halved — the
descending reversed glass now dominates (`snd/gwSiphon-r1fix.png`). gwImpact: + a 3–9 kHz white shard burst and a 6 kHz
crackle, glassRain louder/denser, sub thump trimmed (raw peak 1.02, chain 0.84) (`snd/gwImpact-r1fix.png`).
**minor scenarios → fixed.** gwGuard now Fırtına Atmacası (ATK 1000) vs the defending warden (DEF 1200): guard loop + guard
hit, the warden HOLDS (`gwGuard-z.png`); + gwGuardP2. The "face-up defense drain" case does not exist by the rules (engine
`query.ts`: the −400 reads the target's ATK, attack position only) → added `gwDefenseNoDrain` (face-up defending Sazlık
Balıkçılı: no drain, it breaks) to cover that branch explicitly.

**Open issues after fix r1:**
- The base summon's card slam still sprinkles purple attribute sparkles over the tile before the mound (shared summon kit /
  `slamToZone`, not grim's file) — needs an orchestrator decision (a per-card opt-out flag).
- On contact the shared battle staging adds attacker-attribute (DARK = violet) hit sparks/ring next to our single-family burst
  (`battle.ts` `combatImpact`/`aRamp`) — a few violet px remain; needs a shared opt-out to be fully one colour family.
- Idle SFX (chain creak) still not built (decision 3 optional); the idle-pool watcher is the hook it could hang on.
- Rig noise: isolated px ≈ 190/frame (gate ok, 6.5–8 %): the cage teeth/bars and outline corners are inherent; more cleanup
  possible on the tatters.
- Sameness not re-run after the pose changes (gates re-run, green); a re-run of `tools/sameness.ts` is owed.
**Gates after fix r1:** `tsc` clean; `tests/art/grim_warden*.test.ts` 12/12 (the cut-in test got a 20 s timeout: it paints
12 frames and timed out at 5 s under load ≈ 12 on 4 CPUs); cinematics/presentation/audio 242/244 under load — the 2 failures
were 5 s timeouts (the cut-in test above, and `engine-boundary` "registry loads", not a grim file). filmdiff v1: 16/16 filmed
IDENTICAL (`fix-r1/filmdiff-v1.txt`; the 17th film was cut by my 590 s shell timeout, not a diff) — every change is v3-gated.
Sprite gates 21 ok / 0 FAIL (`fix-r1/gates.txt`).

## Critic round 2 (independent critic, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/critic-r2/`
Verdict: still below the golden-rule bar. BLOCKERS: (1) the lantern light pool drew as an opaque dark-green blotch over the
tile grid; (2) the drain's −400 was a size-2 damage number (largest element, overlapped the real number, corrupted measure's
first-number metric). MAJORS: two ~0.5 s silent holes in the drain; the pendulum-chain motif nearly absent; impact/roar
3–8 dB under the wyrm/magus; no card sound when hit/guarding; attack whirl a half arc; thread a hoop over the target;
skull mist a "lollipop"; summon finale = generic summonBurst ×2; survive case loses the stolen colour, light never
returns; special barely leaves idle. Minors: mound crown band, headstone nub, direct sound sync, gwKeep late, static heap,
cut-in eye/lantern, sameness owed, gwSummonP2 unfilmed, no give-back scenario.

## Fix round 2 (two passes: fix-r2 agent, then fix-r2b, 2026-11-01) — evidence `fix-r2/` + `fix-r2b/`
The first fix-r2 pass was cut off before writing notes (its work is in the WIP checkpoint commit 189d354); fix-r2b
verified every finding on fresh films, closed what was left and wrote this section. Files (all mine):
`src/cinematics/kart-b/grim_warden.ts`, `grim_warden-fx.ts`, `src/audio/v3/grim_warden.ts`,
`src/art/monsters-v3/grim_warden-anims.ts`, `src/art/cutins-v3/grim_warden.ts`, `src/duel/scenarios/grim_warden.ts`,
`tests/art/grim_warden-cardart.test.ts` (glint coordinate). No shared file touched in this round.

- **BLOCKER pool → fixed.** `floorGlow` (fx) replaces the stepped light for every grim pool (idle, drain, apex, target
  glow, skull, summon) and every flash (`floorFlash`): a lighten-only bayer of ramp[2..4] pixels, density ≤ 5/16, never a
  darkening tone, so the tile lines stay visible. `fix-r2b/guard-pool-x4.png`, `gwSummon-seep-x4.png`.
- **BLOCKER −400 → fixed.** No damage number: the plate rolls (showBattlePlates) and `statDrop` draws a small −400 in the
  target's ramp ON the plate for 460 ms, plus the crisp plate flare; measure now logs only the contact number
  (gwDrainFire numbers = [3250 −1200]). `fix-r2b/gwDrainFire-drain-z.png` #12–#16, `gwDrainFire-strike-z.png`.
- **MAJOR drain sound holes → fixed.** New beats on frames: `gwReach` (special f1: two chain creaks + the lantern-thrust
  whoosh + a rising tone), `gwInhale` (f4: falling soul breath, glass hush), `gwSnap` (glass click, reversed swell cut
  dead, two creaks as the lantern swings back). Timeline: 333 lockOn · 433 gwReach · 933 gwInhale · 1050 siphon/thread ·
  1283 gwDebuff · 1667 gwSnap (tail to ≈2.2 s) · 2283 gwCharge. fix-r2b raised gwReach +7 dB (loud −18.4), gwSnap +3 dB.
- **MAJOR chain motif → fixed.** `creak()` friction +3 dB / links +4 dB; one creak per whirl turn under gwCharge; creaks in
  gwReach, gwSnap, gwJangle, gwFinale, gwRoar, gwSwing; sparse v3-only idle creak `gwIdle` (vol 0.16, every 2nd swing,
  ≥ 3.6 s apart) on the watchLanterns watcher (decision 3).
- **MAJOR loudness → fixed.** gwImpact (fix-r2b): glass burst/glitter/bells/rain up, crack/crackle spikes down, the sub
  back to a full body → loud −9.7 / rms −17.9 dB (wyrm −7.7/−17.6), spectrogram glass-led 3–16 kHz
  (`fix-r2b/snd/gwImpact.png`); played at 1.0. gwRoar −8.6/−17.2 (= magusCall). gwThread −12.3/−19.4 (+voice formant saw). gwGiveBack
  −12.7/−20.3. gwCharge −13.1/−17.2 (magusCharge −12.0/−16.7).
- **MAJOR hit/guard sound → fixed.** `gwJangle` (link run, B♭ glass tinkle, 330 Hz helm knock, two creaks; fix-r2b +6 dB,
  loud −14.0) on the first frame of hit/hitHeavy/hitMagic, on the guard's struck beat (wrapped `guardHit`) and softly on
  toGuard; one per blow. measure: gwHit 950, gwGuard 1350, gwDrainSurvive 3267.
- **MAJOR whirl → fixed.** Two turns: a quick spin-up turn (f1→f4→f0 at 2×) and the big final turn; attack f1 now swings
  the lantern out behind the body. fix-r2b found the trail's nearest-way angle unwrap folded the low (f4→f0→f1) jump back
  over the top — it now turns one way only (P1 clockwise, P2 mirrored), so a full RING closes round the helm at 1×.
  `fix-r2b/gwDrainFire-whirl-z.png` #5–#9 (P1 full ring), `gwAttackP2-whirl-x4.png` (P2 ≈ 270° mirrored arcs).
- **MAJOR thread geometry + special amplitude → fixed.** Special re-keyed: the lantern raised high over the hood (fist
  above the shoulder), torso arched back, helm tipped, three distinct drinking frames (±2–3 px, flame swell, helm nods).
  The thread is drawn up out of the target, over the warden's raised lantern and dives in from above (ink sheath, ramp[4]
  core, beads); the target fade darkens from the outline in. `fix-r2b/gwDrainFire-drain-z.png` #10–#16.
- **MAJOR skull mist → fixed.** 15×16 skull map (domed cranium, big sockets, nose notch, teeth, separate jaw that drops
  on the wail), ghost tail, bayer vapour tears apart from 40 %. `fix-r2b/gwKill-skull-x4.png`.
- **MAJOR summon finale → fixed.** `gwFinale` (soul-fire whoomp, B♭ glass chord, choir tail, creak); the base finale's
  sound is null and the shared cut-in exit's summonBurst (the same tick, vol 0.3) is faded in 40 ms (one listed in
  measure, inaudible).
- **MAJOR survive branch → fixed.** The lantern keeps the stolen colour until it shatters (death f4); `returnLight` then
  runs the stolen light back into the surviving target (reverse thread, gwGiveBack, its fade steps out, a flash in its
  colour) and the skull leaves GREEN. New `gwGiveBack`/`gwGiveBackP2` (guardian_charm saves the drained wolf: both live):
  the afterBattle give-back plays, the plate rolls back up, the lantern returns to green.
  `fix-r2b/gwDrainSurvive-z.png` #7–#17, `fix-r2b/gwGiveBack-z.png` #10–#17.
- **minors.** Mound: only the crack lines glow (no crown band); headstone 2 px taller + one tone lighter (fix-r2b)
  (`gwSummon-seep-x4.png`). Direct: gwRelease at the burst, `gwBoltHit` + a soulBurst in the lantern ramp on `s.impact(s.to)`
  (`gwDirect-z.png`). gwKeep fires on the target's v3:dying. Heap: soul embers drift off it + dust puffs during the hold.
  Cut-in: 3×3 eye flare with halo, lantern with a flame shape + bands (`fix-r2/cutin-sheet.png`; the cardart test's glint
  coordinate updated to the new 3×3 core, 134,62). gwSummonP2 filmed (`fix-r2b/gwSummonP2-z.png`). Sameness re-run
  (`fix-r2b/sameness.txt`): no KALIR; out-of-plan UYARI (MOTsig) vs abyss_magus 0.586 (was 0.60), steel_silencer GEÇER.

**Gates (fix-r2b):** tsc: no grim errors; `tests/art/grim_warden*` 12/12; tests/cinematics + tests/audio green.
Measure `fix-r2b/measure.json/.log`: all 23 gw* scenarios, 0 errors (budgets unchanged from critic r2: summon 4083, drain 1950, battle ≤ 2617, death ≤ 1583, direct 1834).

**Open issues after fix r2:**
- Shared staging still adds DARK-violet attacker-attribute sparks/rings at contact (battle.ts combatImpact) and the shared
  card slam's purple sparkles over the summon tile — need a shared opt-out (orchestrator).
- The cut-in exit's shared summonBurst is faded, not removed (a per-card cut-in sfx opt-out would be cleaner).
- Struck-body material sound for the warden's shroud: shared material tables untouched (decision 4); gwJangle covers it.
- P2 whirl ring closes to ≈270° (the lantern's mirrored f1 sits closer to the fist); readable, not a full 360° as P1.
- MP4 with audio still not produced; a blind eye test vs abyss_magus (MOTsig UYARI) still owed.

## Stage — rig + all anims, re-dispatch (agent: rig lane r3, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/rig-r3/`
The rig + all 13 anims were already complete (stage 1 + fix r1/r2, gates green). This pass re-verified everything on
fresh sheets (P1 + P2, every anim, ×3/×4 zooms) and fixed the one weak read left on idle f0 at zoom:
- **Back tatters read as three black logs / spider legs** (uniform-width tubes nearly level, forked "claw" tips; worst in
  guard). `paintTatters` (`grim_warden-rig.ts`) now draws ONE torn sheet: strips broad at the back (10→4.5 px) with a
  slight hem flare, drooping under their weight, the cloth between neighbours kept for the first 50–62 % of their length
  and ending in a ragged V notch; tips = 2–3 short teeth packed inside the strip width (no splay); 2-px lit top band
  (SHROUD.M) over the far tones. End-wave amplitude trimmed (HA-21 phase stays < 50 %), x clamped (Sİ-2 margin in
  special f7). Files touched: `src/art/monsters-v3/grim_warden-rig.ts` only.
- **Gates** (`rig-r3/gates.txt`, `--class large --ref none`): 21 ok / 0 FAIL (HA-21 phase max 49.5 % hitMagic — at the
  edge; any future idle-amplitude increase must re-check it; IŞ-10 idle 7.3 %). `tests/art/grim_warden*` 12/12, tsc clean
  for grim files. Sheets `rig-r3/p1/`, `rig-r3/p2/`; zooms `zoom-idle-guard.png` (idle f0 / guard f0 / special f7),
  `zoom-p2.png`, `combo-p1.png`, `combo-p2.png`.
- Open: sameness not re-run after this cloth-only change (motion unchanged); the earlier open issues stand.

## Stage — card art + cut-in + light profile, round 3 (agent: card-art lane, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/art3/`
Why: the card art still carried the pre-fix-r1 helm (earth-tone bone in a 3-bar "birdcage" = the brown grille critic r1
flagged on the sprite) and the lantern hung small at the side (spec: lantern held out TOWARD THE VIEWER = brightest point).
The cut-in's cage was a cross (one vertical bar + a brow ring), not the rig's two-meridian-bar helm.

**Card art** `src/art/cardart-v3/grim_warden.ts` — rewritten (native drawing, DARK recipe):
- Composition: three-quarter figure, hunched, hood pushed forward; near arm thrust out, the lantern BIG in the right
  foreground (15×23 map vs an 18×18 helm: it reads nearer than the head) = "L" with the upright spade-halberd.
- Helm = the rig's design at card density (`HELM` 18×18 map): pale cool bone (stone4/3/2, void0 socket/nose/gaps), dark
  iron (two meridian bars, crown ring + knob, jaw + chin bands, nape plate); eye = 2×2 leaf4 + leaf3/leaf2 halo in a 4×3
  socket, scans 1 px (f3–f4). Bony claw (earth4/3/2, fingers separated by ink gaps) round a 3-link chain.
- Lantern light: leaf2 pane / leaf3 dome / leaf4 teardrop flame (flickers 6 f × 150 ms); green soul bounce (leaf1, leaf2
  near) on the edges that FACE the flame (sleeve underside, fist, posts) — not on the robe below (read as a vine);
  spill on the horizon line + a leaf1 edge on the night0 headstone (no floor puddle: every pool shape read as a green bar).
- Rim void3 on the true outer silhouette only (own `outerRim`; the kit rim also lit internal contact lines).
- Small 44×34 = full hand map `SMALL` (matter only, ink() adds the outline), 7×13 lantern block, eye pixel at (24,9).
- Stats f0: big colours 19 / backdrop 6 / isolated 2.0 % / outlineInk 0.97 / focus ok (flame 66,49); small colours 19 /
  isolated 4.5 % / focus ok (33,26). Subject fill 0.84 (halberd + lantern span the window, same as before; accepted).
- Evidence: `cardart-big-f0-x3.png`, `-x9.png`, `cardart-big-head-x15.png`, `cardart-big-living-f0-f5.png`,
  `cardart-small-f0-x1.png`, `-x12.png`, `hatcard.png` (real faces 1×/2×, art, field minis).
- `portrait()` in `monsters-v3/grim_warden.ts` is already wired (unchanged, rig agent keep it).

**Cut-in** `src/art/cutins-v3/grim_warden.ts` — edited, not rewritten: the cage is now the rig's helm (two meridian bars
either side of the socket bowing into the knob; brow ring, jaw band, chin band clipped to the skull, rivets where bars
cross bands) — reads "bone behind bars", no cross. Lantern swing widened into a pendulum toward the face (f1 173,86 →
f2 167,66 → f3 163,58 peak, lighting the jaw → f4 169,70 → f5 166,63). Holds/rhythm unchanged (default beats).
Lens glint still the eye (test 134,62 passes, P1+P2). Films: `gwSummon-cutin-z.png`, `gwSummonP2-cutin-z.png`
(v3 band in the real tribute summon: glint cross on the eye at t≈3570, lantern swings up, P2 relit + flipped);
sheets `cutin-sheet-p1.png`, `cutin-sheet-p2.png`, zoom `cutin-f2-x3.png`.

**Light profile** `MONSTER_GLOW.grim_warden` — re-checked against the rig (fx `soulFlame`/`eyeLight`, rig `zap`): leaf3,
leaf4 and white appear only in lights; leaf2 only as lit glass / eye glow (kept as `near` 0.45); leaf1 is the soul
bounce on body edges (reflected, correctly NOT emissive). No change. **DEATH_PRESETS** `{shadow, shadow}`: unchanged.

**Tests:** `tests/art/grim_warden-cardart.test.ts` + `tests/art/grim_warden.test.ts` 12/12. `tests/art/cardface-v3.test.ts`
9/10 — the only failure is G1 `scrap_raiders` 0.692 < 0.7 (not lane B, pre-existing). tsc: no grim errors.

**Open issues:**
- Cut-in hood is still a large mass of flat cowl planes (left two thirds); a bigger redesign (tatters streaming, a
  lower camera) would raise it toward the wyrm's mouth-open drama — not done this round.
- The cut-in sleeve below the raised lantern reads as a thin strip in f2–f5.
- No independent critic pass on the new card art / cut-in yet.

## Stage — cinematics + SFX + scenarios, re-dispatch (agent: cinematics lane r3, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/cin3/`
State found: the sound set (`src/audio/v3/grim_warden.ts`, every CharacterSounds role incl. the revive pair), the
cinematics (`src/cinematics/kart-b/grim_warden.ts` + `-fx.ts`, all `if (LOOK_V3)`, priority 20) and the scenarios were
complete from the earlier stage + fix r1/r2. This pass re-filmed every moment against the rig-r3 sprite and the art-3 cut-in
and fixed what still fell short:
- **Contact burst arrived after the hit-stop** (`gwDrainFire-contact-z.png`: during the ≈200 ms freeze only the shared
  white spark showed; the soul star appeared when the clock resumed). `soulBurst` painted only from its `animate`
  callback, which the show-clock freeze holds. It now paints frame 0 synchronously on `s.impact`, so the frozen beat
  IS the solid soul star (stolen colour / green), and the star is larger (R0 14 → 17, blocked 9 → 10; step 0 at full
  size). `gwDrainFire-contact-z2.png` #2–#9.
- **Scenarios:** + `gwNegatedP2`, `gwBlockedP2`, `gwHitP2` (P2 coverage for negated / bounced / struck). Full list:
  gwSummon(P2), gwAttack(P2), gwDrainFire, gwDrainWaterP2, gwDrainSurvive(P2), gwGiveBack(P2), gwDrainDecline,
  gwNegated(P2), gwFaceDown, gwDefenseNoDrain, gwBlocked(P2), gwDirect(P2), gwHit(P2), gwKill(P2), gwGuard(P2),
  gwGuardKill.
- **Films looked at:** `gwDrainFire.png` (1×), `gwDrainFire-z.png` (drain), `gwDrainFire-strike-z.png`,
  `gwDrainFire-contact-z2.png`, `gwSummon.png`, `gwSummon-rise-z.png`, `gwKill-z.png`, `gwHitP2-z.png`,
  `gwNegatedP2.png`, `gwBlockedP2.png`.
- **Measure** (`cin3/measure.json/.log`, 27 scenarios, 0 errors, game ms): tribute summon 4083 ≤ 4350; drain activate 1950
  ≤ 2320; battle ≤ 2917 ≤ 3190; direct battle 2134 ≤ 2320; grim death ≤ 1583 ≤ 2030; declaration 316 ≤ 435. (Other
  activates in the list are not ours: chains 2584, shield_titan 684, guardian_charm 2633, ember_wolf burn 2183.)
- **Camera gate** vs `cin/camera-base.json`: 8 ok, 18 NOBASE ok, 1 FAIL = `gwGuard` focus 3 → 2. Not a camera move: the
  base was taken when gwGuard was "ember_wolf breaks the defending warden" (3 focus calls incl. the death); fix r1 changed
  the scenario to the storm_hawk guard-HOLDS case (no death → one fewer focus). The old case lives on as `gwGuardKill`.
  Re-base gwGuard when the orchestrator re-takes the lane base.
- **Palcheck** (gwDrainFire 80 frames, clip 220,60,200,140): Δoff max +0.07 (ok); white max 2.36 % at the whirl start
  (rule 1.5 %) — the arena's own white baseline in this clip is already 1.6–1.8 % on every frame (same as noted in the
  earlier stage, also in non-grim films); off-palette share falls during the moment (4.8 → 1.2 %).
- tsc: no grim errors. vitest tests/art/grim_warden* + tests/cinematics + tests/audio 167/167, tests/duel 54/54.
- filmdiff v1 not re-run: this pass touched only a v3-gated painter and added scenario keys (not in the v1 film sets).

**Open issues (unchanged unless noted):** shared contact staging still adds DARK-violet attacker sparks/ring after the
burst (`battle.ts combatImpact`) and the shared card slam's purple sparkles over the summon tile (orchestrator opt-out);
the cut-in exit's summonBurst is faded, not removed; struck-shroud material sound (decision 4, gwJangle covers it); P2
whirl ≈270°; MP4 with audio (clip.mjs) and a blind test vs abyss_magus still owed; gwGuard camera base stale (above).

## Critic round 1 (lane-B pass 3, independent critic, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/critic-r1/pass3/`
Verdict: no blockers left (every moment plays, gated, tests 12/12), but several majors keep it under the wyrm/magus bar.
MAJOR: helm reads as a grey "monitor/robot visor" with a grille mouth (steel_silencer territory) and the shroud is mid-grey
plastic cut in half by the belt (`idle-f0-p1p2-x6.png`, `compare-idle-f0-grim-magus-silencer-wyrm-x3.png`); back tatters
still read as three black rods; special = lantern lifted beside the hood, 3 drinking frames ≈ identical, not "extended to the
target" (`sheet-p1/grim_warden-v3-special.png`); hit/hitHeavy body barely recoils (`sheet-p1/...-hitHeavy.png`, `gwHit-z.png`);
floorGlow pools read as sparse dot noise offset from the lantern, in every film (`gwSummon-finale-z.png`, `gwDrainFire-contact-z.png`);
summon: generic slam ring + purple sparkles under the mound, headstone a 3–8 px nub that lies as a grey bar, rise jumps
half→full in one frame, finale = generic double cyan/green rings (`gwSummon-rise-z2.png`, `gwSummon-finale-z.png`);
direct = 1-px green laser line + star (`gwDirect-bolt-z.png`); contact stacks star + gold tick ring + violet ring (`gwDrainFire-contact-z.png`).
minor: skull mist = opaque green emoji on a stick; survive branch plate restores ≈1 s after the light returns
(`gwDrainSurvive-death-z.png`); thread low contrast on FIRE/LIGHT targets; freeze ≈150–200 ms vs spec 100; heap knock-out confetti; field mini mush.

## Fix round 1 (lane-B pass 3, agent: fix lane, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/fix-p3r1/`
Answering the pass-3 critic r1 (above). Every major addressed, most minors. Files (all mine): `src/art/monsters-v3/grim_warden-rig.ts`,
`-anims.ts`, `-kit.ts`; `src/art/cutins-v3/grim_warden.ts`; `src/art/cardart-v3/grim_warden.ts`; `src/cinematics/kart-b/grim_warden.ts`,
`grim_warden-fx.ts`; `tests/art/grim_warden.test.ts` (bbox width 64 → 50: the back tatters are gone). No shared file touched.

**MAJOR helm = robot visor → fixed (sprite, cut-in, card art).** The helm map is now an ORGANIC skull (15×16): a domed cranium wider
than the jaw, brow ridge, a near socket (the eye) + a dark far socket, nose notch, lit cheekbones, a narrow maxilla with three
irregular teeth and a missing one, a separate mandible + chin. The cage is only TWO bars (+ knob) laid in programmatically
(`HELM_BARS`), each throwing a 1-px void0 shadow on the bone away from the light, a rivet bolting each foot into the bone; no
crown ring / jaw band / chin band / nape plate (that frame was the "TV" read). The brim shades the cranium's crown (skull deep in
the hood). Cut-in: new skull polygon (cranium > jaw), separate jawbone, a B2 ring sinking the socket, an arched brow, a short
slanted cheekbone ridge, far socket at the profile, nose notch, 3 irregular teeth + 2 lower stumps, the two bars with a void0
shadow and rivets, no bands; the cavity widened on the profile side. Card art: HELM rebuilt the same way (18×18) and the small
map's head redrawn (irregular teeth, socket). Evidence: `sheet-p1/`, `sheet-p2/`, `cutin-sheet.png`, `gwSummon-cutin-finale.png`, `hatcard.png`.

**MAJOR silhouette / materials → fixed.** Shroud ramp down one step (`SHROUD` = stone1 lit / stone0 / void0 / ink seams;
`SHROUD_RIM` stone2 only on the top-left rim of folds via `clothBands(..., rim)`); shins rag-wrapped dark; boots one value darker
(were the brightest mass); hands are cool bone (stone3/2/1, match the skull, no brown mittens); haft earth2/1/0 (no orange
stick); spade one value down. Torso narrowed (shoulders C±5/6, body top cx−6..cx+5, hem R−12..R+8), the head pushed 2 px
forward + 2 px down in front of a higher shoulder hump (hunch). The full-width belt became a thin rope SAGGING diagonally with
a knot, a loose end and the key ring. The three back tatters are gone (`TATTERS = false`); the hem (raised to GY−17) tears into
SIX ragged strips of uneven length (9 / 6.5 / 8 / 4.5 / 7 / 4 px) drifting back on the cloth wave. Card art + cut-in cloth also one
value down (black shroud). `fix-p3r1/sheet-p1/grim_warden-v3-idle.png`, `-guard.png`.

**MAJOR special = lifted lantern → fixed.** Re-keyed as a FULL-BODY REACH: draw back + crouch (f1) → pitch forward (f2) → lean
+7, near arm straight out at shoulder height, the lantern held in front of the face on a short chain (f3) → inhale (hood lifts,
f4) → release pitches deeper (+8, f5) → three drinking frames that PUMP: hood dips/rises 3 px, shroud pulled toward the lantern
(wrap 0.9 / 0.2 / 0.9, capeA 8/4/8), the far hand slides on the haft and the halberd rocks from its butt (ha −88/−83/−88, hs −2/+1/−2).
`sheet-p1/grim_warden-v3-special.png`, film `gwDrainFire-z.png` #4–#11, P2 `gwDrainWaterP2-z.png` #3–#9.

**MAJOR hit body barely recoils → fixed.** hit f1–f2 / hitHeavy f1–f3: torso + helm snap 4–5 px away (lean −5/−7), the hood flips
back, the shroud flares forward (capeA +5…+7, wrap), the halberd tilts back from its butt (−90/−94); f0 jolts the helm a pixel up
out of the hood and stays local (HA-21 phase < 50 %). The lantern overshoot stays as the secondary motion. `sheet-p1/...-hit*.png`, `gwHit-z.png`.

**MAJOR floorGlow dot noise → fixed.** `floorGlow` is a STEPPED POOL now: every matte floor pixel (calm arena `topAt`: pads, joins,
gaps, bridges — never the neon zone lines, which stay crisp) lifts one tone into the soul's ramp (first ramp tone clearly brighter
than the floor), the core (inner 22 %) up to two; levels are kept low (core ≤ 1 step at full strength, the rim a ≤ 75 % 2×2
world Bayer checker, the fringe ≤ 37 %), so a pool reads as a flat stepped light, not a stain and not scattered dots. Idle pool
radius 16 / level 0.5 (a faint checker under the lantern); strike/drain lantern light radius 20 → 16.
(First attempt used `padColorAt` only: the card on the tile hid the pool and only a neighbour pad lit as a green block — fixed by
including joins/gaps.) `gwDrainFire-z.png`, `gwKill-death-z.png`, `gwSummon-finale-z.png`.

**MAJOR summon → fixed (1, 2, 3, 4).** (1) The hand card is slammed by our hook with `slamToZone(..., impact: false)` (same flight
and sound, no tile flash ring / dust star), soil clods + dust on the tile, then `runSummon` with `noCard` (ctx via Object.create).
The violet sparkles still seen over the tile in gwSummon #0–#5 are the shared TRIBUTE beat (`tributeStream` of the DARK
tributed monster), not the summon — logged, not ours to change. (2) Headstone 13×20 with a carved arch, sunk cross and a crack;
flung 11 px up on the seep beat; shoved over it FLIES (230 ms, a 14 px arc, tipping 18° → 42° → 66°), lands CRACKED IN TWO (the
halves knock apart, one bounces) with a dry split sound (gwStone pitched 0.82) + clods, then sinks into the soil. (3) Summon
rise = 8 frames (72/62/52/43/33/22/11/0: ≤ 11 px a frame, land@7), lantern-raise frame f8, settle f9–f10. (4) Finale: no
`S.finale` rings; the lantern's flame flares (summon f8), a stepped green pool floods the tile from under it and decays in flat
steps, 12 soul motes stream up off the glass, a shake, the badge pop. `gwSummon-rise-z.png`, `gwSummon-finale-z.png`, `gwSummon-1x.png`.

**MAJOR direct laser → fixed.** `soulBolt` = a 7×6 soul-fire SKULL wisp (ink case, ramp[4]/[3] body flickering white, ink sockets)
on a wobbling arc (150–250 ms, 14 px high, damped sideways wobble), a curling smoke trail (10 past positions drifting up and
sideways, shrinking, ramp[3] → ramp[2] → ramp[1] → stone1) and a ≤ 5 px flame tongue; it bursts on the duelist into the melee
soul star. The after-hit halberd chop no longer plays its smear / gwChop on a direct attack (the frames read as a flourish).
`gwDirect-z.png`, `gwDirect-wisp-z.png`.

**MAJOR contact staging → partly fixed.** Our own ring is removed from `soulBurst` (star + shards only; the shared contact
staging's ring is the one ring). The chop is a real SWEEP SMEAR now: a crescent band pivoting on the far hand (`grip`) from the
spade's raised point (f7) to its chopped point (f8), 2 frames (6 px band: white edge, mist / iron body, a trailing rim in the
lantern's colour → a thinning tail). Still open (shared, orchestrator): the DARK-violet attacker sparks/ring of `battle.ts`
combatImpact. The bent-shaft swing frame in the sprite was not done (the smear carries the sweep).

**minors.** Skull mist: ramp[1]/ramp[2] vapour, ramp[3] only on the brow / socket rims / top fringe, the white flash on the brow
cut to 120 ms, tail 12 → 8 px (`gwKill-skull-x5b.png`). Knock-out ash = one family (stone2/stone1 + a rare soul ember). Survive
branch: `returnLight` rolls the target plate +400 (and clears its battle tint) on the frame the light arrives, with the −400 bell
pitched up (`gwDrainSurvive-death-z.png`: 3100 → 3500 starts at ≈4.3 s, right on the arrival; was ≈5.2 s). Thread: a fatter ink
sheath (2.6 px) + ramp[4] beads between the white dashes, the foot leaves the target steeply (p1 lift 14). Drain trimmed: special
f0–f4 holds −120 ms, the recovery at ×1.6. Hit-stop: the ≈150–200 ms freeze is the SHARED battle weight-profile freeze (`hitReact`
/ the defender's own freeze) — not clamped from the card file (documented, orchestrator if a per-card stop is wanted). Card art:
the eclipse corona (read as a scythe blade) replaced by graveyard mist banks (`paintGraveMist`), black shroud, new skull.

**Gates.** tsc: no grim errors. `tests/art/grim_warden*` 12/12; `tests/art/cardface-v3` only the known scrap_raiders G1;
tests/cinematics + audio + presentation + duel 285/286 under load — the 1 failure is the known `engine-boundary` 5 s timeout
(passes alone, 5/5). Sprite gates `fix-p3r1/gates.txt` (`--class large --ref none`): 21 ok / 0 FAIL (idle liveliness kept ≥ 15 % by
a livelier mantle hem / sleeve teeth / hood tip wave after the tatters went; HA-21 phase < 50 %). Frames still 122 (summon 12).
filmdiff v1 not re-run: every change is in v3-only files (monsters-v3, cutins-v3, cardart-v3) or LOOK_V3-gated cinematics.
Measure (`fix-p3r1/measure.json/.log`, 26 gw* scenarios, 0 errors, game ms): tribute summon 4033 ≤ 4350; drain activate 1750
(was 1950) ≤ 2320; battle ≤ 2967 ≤ 3190 (gwGuardKill 5034 includes ember_wolf's burn, as before); direct battle 2234 ≤ 2320;
grim death ≤ 1633 ≤ 2030; declaration 316. Camera gate vs `cin/camera-base.json`: 7 ok, 18 NOBASE ok, 1 FAIL = gwGuard focus
3 → 2 — the known stale base (the scenario changed to the guard-HOLDS case in fix r1; re-base when the lane base is re-taken).
Sameness re-run (`fix-p3r1/sameness/`): no KALIR; out-of-plan UYARI: abyss_magus MOTsig 0.586, lumen_sprite 0.583, thorn_lurker,
dusk_sorcerer 0.556, mudgrasp_spirit MOTsig 0.628, seal_head MOTloop 0.740, ashen_drake / wisp_imp rhythm — a blind eye test is owed.

**Open issues after this round:**
- Shared: DARK-violet attacker sparks/ring at contact (`battle.ts combatImpact`); the tribute beat's violet `tributeStream`
  sparkles over the summon tile; the battle freeze length (per-card hit-stop) — orchestrator decisions.
- Sprite: no bent-shaft swing frame on the chop (smear only); P2 whirl ≈ 270°; a sameness re-run is owed after the special /
  hit re-key (motion changed).
- The skull mist still reads fairly saturated at 1× on the dark arena (it is leaf1/leaf2 now); a further step would be a
  void-tinted body with leaf only at the sockets.
- Wood/mud material sounds (decision 4) and idle SFX as before; MP4 with audio still not produced.

## Critic round 2 (lane-B pass 3, independent critic, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/critic-r2/p3/`
Verdict: no blockers; every branch plays, all registrations LOOK_V3-gated, tests 12/12, tsc clean for grim files, budgets in
(measure.json: summon 4016 / activate 1750 / battle ≤ 2967 / direct 2234 (tight vs 2320) / death ≤ 1633). Sound + timing majors:
- MAJOR siphon truncated: gwSiphon (1.25 s, 12 descending steps) is stopped at gwSnap ≈ 617 ms game after start
  (clips/gwDrainFire.json 916 → 1533) — only ≈ 8 steps play; the fastest steps and the B♭4 landing never sound
  (clips/gwDrainFire-spec.png). Fix: compress the ladder to the real window (D ≈ 0.6 s, rise 0.11 → 0.045) or pass the
  drain length in and schedule the last 3 steps before the snap.
- MAJOR direct: the soul-skull flight is SILENT (clips/gwDirect.wav −45 dB from 1350 to 1500 ms, between gwRelease and gwBoltHit),
  and the 7×6 wisp is a speck at 1× (gwDirect-bolt-z.png). Fix: a gwBolt flight voice (whine + soulBreath, panned from→to)
  started with soulBolt; a bigger wisp (≈11×10) or a 2-frame flame body.
- MAJOR gwRelease is ≈ 8 dB under the reference releases (−18.3 vs magusOrbRelease −9.9 / wyrmBreathFire −9.7, then ×0.85).
- minor: gwInhale −23 dB → a −40 dB hole just before the thread (800–900 ms); a −37 dB gap 1850–2050 ms between gwSnap and the
  strike gwCharge; gwGiveBack masked by gwWail on the same tick (gwDrainSurvive 3733); gwCharge's 65 Hz sine sub dominates
  2.2–3.0 s (spectrogram) with no audible content on small speakers.
Picture: drained target re-lights to full brightness the frame it starts dying (gwDrainFire-strike-z.png #17–#19, soulFade
destroyed on v3:dying); drainSpark crim3 lines strike through the DEF digits (gwDrainFire-drain-z.png #6–#7); thread is a small
hoop over an adjacent target; skull mist still an opaque leaf "emoji" (gwKill-death-z.png #10–#14); special reach is a stub arm
with the lantern beside the face (z-special-f0-3-5-7-x6.png); summon mound reads as a brown turtle shell with ≈ 350 ms of near
stillness (gwSummon-rise-z.png #5–#10); cut-in dark-green slab beside the lantern (gwSummon-cutin-z.png #1/#3).

## Fix round 2 (lane-B pass 3, agent: fix lane, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/fix-p3r2/`
Answering critic r2 (above): all 4 majors fixed, 9 of the 9 minors addressed. Files (all mine): `src/audio/v3/grim_warden.ts`,
`src/cinematics/kart-b/grim_warden.ts`, `grim_warden-fx.ts`, `src/art/monsters-v3/grim_warden-anims.ts`, `src/art/cutins-v3/grim_warden.ts`.
No shared file touched (declare.ts / plates.ts unchanged this round).

**MAJOR siphon truncated → fixed.** gwSiphon's ladder is fitted to the real drain window (thread reach → gwSnap ≈ 0.6 s): D 0.6,
rise 0.11 → min 0.045, all 12 steps always play (no `t < D` cut), and the last step LANDS on B♭4 (louder swell + its octave double +
a struck B♭4/B♭3 pane) right before the snap (916 → ≈ 1516 vs gwSnap 1533). Breath / drone / hum re-timed to 0.6 s and moved up
an octave (no sub). `siphon.stop(90)` stays as a safety. Clip `clips/gwDrainFire.{mp4,wav,json}`.
**MAJOR direct flight silent + speck → fixed.** New recipe `gwBolt` (whine F6→B♭5 + a lower whine, a fast soulBreath, a doppler
pink sweep, 4 trailing links, crackle) played by `soulBolt` at the flight's start (panned at the flight's midpoint). gwDirect
envelope 1350/1400/1450 ms: −15.8/−13.8/−17.5 dB (was −42/−42/−43). WISP map 7×6 → 11×8 skull + a 2-frame flame crown (11×10),
a 2-px trail head, puffs radius 4. `gwDirect-bolt-z.png`, `gwDirect-bolt-1x.png`, `clips/gwDirect.*`.
**MAJOR gwRelease weak → fixed.** 11-link run at 0.28, white whoosh 1.3 + a pink body sweep, a "snap taut" FM iron clank (1100 Hz,
ratio 2.13) + a low partner at 0.12 s, 0.3 s long, louder whine/breath; played at volume 1 (was 0.85). gwDirect 1150–1300 ms:
−17.8/−13.3/−12.7 dB (was −22/−19/−21).
**MAJOR drained target re-lights on death → fixed.** onDying no longer destroys the fade; it marks it `dying()`. `soulFade` follows
the sprite's alpha / hides under a tint-fill flash, and when the dying body is handed to the shared break (sprite hidden by
`vfx/shatter`, unit retired) it LINGERS on the last darkened frame ABOVE the facet copy (depth +0.6) and knocks out in 4 bayer
steps over 200 ms as the pieces fly. `endDrain(d, true)` in the died branch keeps the fade + the v3:dying listener (4 s safety
net); gwKeep no longer can double. `gwDrainFire-death-z.png` #5–#7 (wolf stays dark through the break; was full-bright).

**minors.** (1) gwInhale +≈10 dB (noise 0.8, soulBreath 0.4, two reversed glass swells, faster attack) + gwReach gets a soul-fire
flutter tail into it; gwSnap adds a creak at 0.31 s + 0.64 s, a louder soul breath and a soft glass tail → final clip: 800 ms −33 dB (was −39.6), 850 −25 (was −31); 1850–2050 ms −25/−28/−25/−27 dB (was −36/−37/−37/−39). (2) gwCharge sub
0.18 → 0.07, energy moved to a C3→F3 / F3 saw pair through a 300→520 Hz low-pass (phones play it). (3) Survive branch:
returnLight + gwGiveBack start 220 ms after gwWail (clip: wail 3733 → give-back 4033, was same tick). (4) drainSpark dashes moved to
the plate's lower edge (+2 px), never through the digits (`gwDrainFire-drain-z.png` #4). (5) Thread: minimum arc height grows as
the pair gets closer (+0.3 px per px under 70 px span), a side bulge out past the target, the band TAPERS fat at the target → thin at
the lantern, 6 beads that ACCELERATE (t = phase²) and stretch into streaks near the lantern (`gwDrainFire-drain-z.png`,
`gwDrainWaterP2-1x.png`). (6) Skull mist: cold stone vapour body (stone3/2 crown, stone1/0 below), the soul colour only on the
socket's upper rim (sides ramp[1], lower rim stone), the brow flash and the top fringe; teeth = void gaps, no ink under the jaw;
tail stone; dithers apart from the bottom up (`gwKill-skull-x5.png`, `gwKill-death-z.png`). (7) Special reach: release /
drinking frames thrust the fist 4–7 px further (ax 25–28) and higher, the lantern swings ahead of the hood on a longer chain
(cl 4–5, la +10…+22, ly −2…−4) (`sheet-p1/z-special-f3-f8.png`). (8) Summon mound: jagged zigzag cracks, the soil HEAVES on uneven
75 ms beats (dome +1/+2 px, 1-px sideways shiver), clods pop off its skin every ≈ 95 ms, the crack light pulses outward in waves
(`gwSummon-rise-z.png`). (9) Cut-in: the sleeve gets diagonal fold bands (dark seam + lit lip) and tatter teeth on its inner edge;
the green underlight on the sleeve is only its 1–2 px edge facing the flame — no more green slab (`gwSummon-cutin-z.png`,
`cutin-sheet.png`). (10) Give-back order: when a guardian_charm activation follows the battle, the give-back is deferred to the
start of the event after the charm's activate (its card zoom covers the board for ≈ 2 s, so a give-back under it is hidden) — clip
`clips/gwGiveBack.json`: spellActivate 4100 → gwGiveBack 6216; film `gwGiveBack-z.png`.

**Gates.** tsc: no grim errors. `tests/art/grim_warden*` 12/12. Measure `fix-p3r2/measure.json/.log`: 26 gw* scenarios, 0 errors,
timings unchanged (summon 4016, drainFire 4166, direct 2550 total / contact 1517, kill 2783, gwGiveBack 6716 / P2 6866 — the
give-back now plays after the charm's card). Sprite gates not re-run (only special keys changed; bbox max 74 ≤ W 104, margin 2).

**Open issues after this round:**
- Shared: DARK-violet contact ring, violet tribute sparkles, shared summon slam outline (as before); in gwGiveBack the shared plate
  refresh restores the wolf's 1700 during the charm presentation, before our give-back (our returnLight +400 roll only covers the
  warden-death branch).
- A short −33 dB dip remains at ≈ 800 ms (one 50 ms window before gwInhale at 816); acceptable, could fire gwInhale a frame earlier.
- Skull mist could still use a sameness / blind check at 1×; P2 whirl ≈ 270°; no bent-shaft chop frame; wood/mud material sounds
  and idle SFX as before; a sameness re-run is owed after the special re-key.

## Critic round 3 (lane-B pass 3, independent critic, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/critic-r3/`
Verdict: no crash / missing-branch blockers, but the signature is under the golden-rule bar. BLOCKER (3rd round running): the drain
thread drew as a fat ink-sheathed inverted-U hoop ("paperclip") round the target's head — at the declaration the pair stands so close
that the held lantern hung INSIDE ember_wolf's sprite (P2: a tall candy-cane hook off coral_serpent). MAJORS: special pose = lantern
hanging straight down under a shoulder-height fist, drinking frames ≈ identical, same skeleton as abyss_magus' special; whirl = thin
closed orange ring round the helm, contact star swamped by the shared −1200 / violet ring / white chop → "the card's VFX language is
rings"; body = near-black mass at 1× (no lit plane, 2–3 px stick arm); cut-in skull = grey egg split by a bar, flat hood, small
lantern. minors: halberd reads as a spear; chop f7→f8 jump; death rigid wedge + 14 px mist rising ≈10 px; summon not lantern-first;
survive plate +400 ≈0.6 s after the light; glassReverse also used by crystal_wyrm (slice.ts:364); hit lantern swing hidden.

## Fix round 3 (lane-B pass 3, agent: fix lane, 2026-11-01) — evidence `shots/v3/kart-b/grim_warden/fix-r3/`
Files (all mine): `src/cinematics/kart-b/grim_warden.ts`, `grim_warden-fx.ts`, `src/art/monsters-v3/grim_warden-rig.ts`,
`-anims.ts`, `src/art/cutins-v3/grim_warden.ts`. No shared file touched this round (declare.ts / plates.ts unchanged).

**BLOCKER drain hoop → fixed (spacing + new shape).**
- Spacing: `drainShuffle()` measures the drinking frame's glass against the target's core; when it is < `DRAIN_GAP` 30 px
  (horizontal) the special opens with a two-scuff SHUFFLE BACK along the line away from the target (≤ 18 px, dust puff on f1) and
  the recovery steps home before the strike (the strike still glides from `u.home`). P1 vs ember_wolf: glass 16 → ≈ 30 px clear.
- Shape: `soulThread` rewritten as a STREAM (same API, so the give-back / return-light reuse it): a shallow S (up and forward out
  of the core, apex ≤ 12 px, a LEVEL entry into the glass from the target's side); 40 soul motes in the target's ramp — a loose
  cloud ±8 px where they leave the body, squeezed into single file at the glass, accelerating (t = phase^1.7), stretched into
  streaks, white-hot as they are swallowed; fat 2×2 souls every 3rd, ink foot pixels while over the same-hued body; a 1-px ramp[2]
  guide ONLY in the middle third; wisps torn off the whole body drift into the stream's foot; NO full-length ink sheath; the
  lantern's ring halo is replaced by a stepped 4-ray swallow flare (longest ray toward the target).
- Evidence: `gwDrainFire-drain-z.png` (#6–#14: colour pours out of the wolf into the lantern), `gwDrainFire-stream-x5.png`,
  `gwDrainFire-1x.png` (full frame), P2 `gwDrainWaterP2-z.png` (#5–#11: the serpent's blue rises and curls into the glass).
- Give-back / return light (flow −1) is a different shape: a RIVULET of 1×2 ink-sided drops that spills UP out of the glass and
  FALLS onto the target's core from above (`gwDrainSurvive-return-x4.png`).

**MAJOR special pose → fixed.** f3–f8 re-keyed: the fist comes up to eye level (ay −11…−13) and the chain is drawn TAUT toward the
target (la 50 → 76–86°), the lantern at the end of a level chain line; f6 swells to the white heart (fl 1.6), f7 contracts (fl
0.75) with the lantern TUGGED out (+1 cl, +1 ax, la 86, the hood dips, the body pitches deeper), f8 swells again; the far hand
braces higher on the haft (hs +3). The cinematic's held beat alternates f6 ↔ f7, so the drink pumps. (cl kept ≤ 5: longer chains
cross the 104-px frame edge.) `sheet-p1/grim_warden-v3-special.png`. Silhouette now = level chain + lantern (not magus' arm + orb).

**MAJOR whirl ring / contact → fixed.** `whirlTrail` is an OPEN tapered crescent: cut `ARC_MAX` (≈ 190°) behind the head, width by
angular distance from the head (5 px with a white core → 3 px → a broken 1-px ramp[1] tail whose gaps widen), embers flung off
TANGENTIALLY; afterimage lanterns kept. `soulBurst` star R 17 → 22 (blocked 13), held 3 frames with an ink rim, white heart 5 → 4 → 2,
22 shards. `gwDrainFire-strike-z.png` (#3–#17 crescent, #19–#23 star). Shapes are now distinct: stream (drain), rivulet
(give-back), smear crescent (whirl), star (contact).

**MAJOR value structure → fixed (partly).** `capPlane()` paints a stone2 LIT PLANE on the hood's crown (3 rows × 8 px toward the
light), the mantle's top-left shoulder (2 × 7) and the near sleeve's top (1 × 9); deep folds stay void0. The near sleeve is 1 px
wider at the shoulder / forearm / bell and hangs 1 px longer; a leaf1 soul-bounce band on the sleeve's lowest row on the lantern's
half. `sheet-p1/grim_warden-v3-idle.png`. (Shroud body tones unchanged — the black funeral shroud is the pass-3 r1 decision.)

**MAJOR cut-in → fixed.** The lantern SWINGS TOWARD THE LENS: per-pose size `ls` (1 → 1.2 → 1.6 on the slam → 1.5 / 1.35 / 1.4),
the whole lantern (roof steps, brim, glass, posts, flame, underlight radius) scales; on the slam it is ≈ 54 px wide, the brightest
point, cropped by the frame edge like a foreground prop. Skull: a real profile (brow overhang, socket dip, jutting nasal bone, the
face stepping back under the cheekbone, maxilla, a jaw NOTCH at the back), the socket sunk with a B1 upper rim, a long lit
cheekbone ridge with a B1 hollow under it, the cranium behind the temple bar one tone down (the face is the lit plane); only the
temple bar shows (the two bars bracketed the face = the "egg with a seam"). Hood: 4 tone planes (a lit crown plane), 5 longer
streaming tatters. Green UNDERLIGHT on the lower face (cheek / maxilla / teeth / jaw edges facing down or toward the lantern).
`cutin-sheet.png` (dev sheet ×3), in game `gwSummon-cutin-z.png`, `gwSummon-1x.png`. f0 unchanged (lens glint region).

**minors.**
- Halberd: a FLAT square-shouldered spade (short blunt point) + a back crescent hook off the socket (`sheet-p1/...-idle.png`).
- Chop: attack f8 is now the 45° in-between (haft over the shoulder), f9 the chopped-through frame (was the first recovery mix);
  `chopCrescent` spans f7 → f9. Holds unchanged (HA-3). `sheet-p1/...-attack.png`.
- Death: f2–f4 fold the shroud AT THE WAIST (lean +5/+7, the hood pitches down over the belt) while the halberd still stands; the
  halberd starts its fall a frame later (own beat). Skull mist rises 34 px over 760 ms, whole until halfway (jaw wide on the wail),
  then stretches (×2.2) and tears; its light pool rides it and fades with the tear. `sheet-p1/...-death.png`, `gwKill-death-z.png`.
- Summon: the LANTERN leads — f0–f2 the fist thrusts it straight up out of the mound (ay −42/−38/−30, chain 0/1/3) while the
  halberd trails tilted back (−116…−95). `sheet-p1/...-summon.png`.
- Survive branch: `returnLight` rolls the plate +400 after a 130 ms pour (first drops land), then the flow thins (was: at the end of
  the 400 ms flow). `gwDrainSurvive-z.png`, `gwDrainSurvive-return-x4.png`.
- Hit: hit / hitHeavy fling the lantern UP over the fist (la 100 / 125) and keep it up through f2 (la 70 / 72), clear of the
  attacker's bite FX; f3 hitHeavy overshoot hold 110 → 150 ms. HA-4 keeps f1 ≤ 70 ms. In gwHit the warden is mostly covered by the
  wolf's own FX anyway (`gwHit-z.png`) — partially verified.

**Gates.** tsc: 0 errors. `tests/art/grim_warden*` + tests/cinematics + tests/presentation: 237/237. Sprite gates
`fix-r3/gates.txt` (`--class large --ref none`): 21 ok / 0 FAIL (HA-18 liveliness kept ≥ 15 % — the wider sleeve raised the opaque
count, its tooth sway was raised 2 → 2.8), still 122 frames / 4.97 MB. Measure `fix-r3/measure.json/.log`: 26 gw* scenarios, 0 errors; timings as
before (tribute summon 4016, drainFire / WaterP2 4166, survive 4983/5033, direct 2550, kill 2783, gwHit 2050); gwGuardKill 5350
(was 5034: the hitHeavy overshoot hold +40 ms and ember_wolf's own burn trigger inside it).

**Open issues after this round:**
- glassReverse ownership (critic minor): `src/audio/v3/slice.ts:364` (crystal_wyrm `wyrmReviveGather`) also builds on it; not a
  grim file — orchestrator decision (move the wyrm revive to another shimmer primitive, or record the exception in YENI_KARTLAR §5.1).
- Shared (as before): DARK-violet contact ring (`battle.ts combatImpact`), violet tribute sparkles, shared freeze length.
- Sound not re-auditioned this round (no recipe changed); the new shuffle-back has no own scuff sound (uses the existing gwReach).
- The body is still dark at 1× by design (black shroud); a further lift would need a value-structure decision for the whole card
  (card art + cut-in + rig).
- A sameness re-run is owed after the special / summon / hit / death re-keys; idle SFX / wood-mud material sounds as before.
