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
