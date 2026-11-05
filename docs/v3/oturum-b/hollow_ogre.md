# hollow_ogre (C6 Kovuk Devi / Hollow Ogre) — lane B notes

State carried between agents. Keep each stage's section; append, do not rewrite others' sections.

## Stage: RIG + ALL ANIMS

### Design note (written before drawing)

References studied in depth: `mudgrasp_spirit-rig/-anims/-kit` (lane-B sibling, the same hand-built Pose → pixels
architecture, bands from the part's own edges, `Comp` part-id compositor) and `steel_silencer-rig` /
`abyss_magus-rig` (rigid parts, light layer after the outline, dissolve pass, edge rim / cast shadow rules).

- **Silhouette (facing right).** A hunched giant that is a TREE TRUNK, not a primate: one thick lightning-split log
  bent forward at the top (the hunch), a jagged broken-wood crown with charred tips, a mane of 3 broken branches
  raking up and back off the upper back, two short root legs splitting from the log base into flat root toes, two
  long root-bundle arms. The near hand drags a knotted log club whose head hangs just above the ground in front.
  Readable at 1×: log column + branch mane + glowing hollow + club diagonal. The face is the HOLLOW in the chest
  (no head): darkness, two ember eyes, a charred lip, the lightning scar running from the crown into it.
- **Parts (back → front).** far root arm + dangling root fingers · far root leg · mane branches · far-shoulder moss
  + mushroom · trunk (cylinder bands, bark grain seams, ring cracks, crown teeth, lightning scar, the hollow) ·
  near root leg · summon bark door plates · club (ink-separated: same value family as the trunk) · near root arm +
  root fingers wrapped over the club handle · near-shoulder moss + 2 mushrooms · club sprout · fx matter (splinters,
  leaves, dust, chips, spores, unravelled strands, ground sprout) → ground cut → `outline(ink)` → light layer (eyes,
  knot lights, scar glow, seed, firefly, sprout bud, glint).
- **Materials / ramps.** bark & roots `earth1…earth3` (crevice `earth0`), far parts one value down; broken
  heartwood / scar core / mushroom caps `earth4`; moss dark `leaf0…leaf2`; hollow interior `void0`/`void1`; lights:
  eyes `gold2…gold4` (+ `white` core only when blazing), knot lights / seeds `void3`/`void4`, firefly `gold4`.
  No cyan / crim / teal / mag. Root bundles read as twisted strands: diagonal twist seams one step darker, only on
  the mid / shade planes (lit plane calm, MA-2).
- **Frame.** 88×80, anchor (38, 74), hover 0, walker, weight `heavy` (100–130 ms contact hit-stop), class `medium`
  (3.6 MB → ≤ 127 frames at 88×80). Club head in idle stays above the lowest 6 rows so the feet band (root toes)
  is the only thing in HA-9's band.
- **Points.** `muzzle` / `staff` = club head, `grip` = near hand on the club, `hand` = far root tip (where seeds
  land), `core` = the hollow, `head` = the near ember eye, `feet` = anchor.
- **Anims (126 frames).** idle 16 (creak sway of the log top, eyes blink + look, root fingers probe, club pendulum,
  moss drips, firefly out of the hollow and back) · guard 8 (club crossed before the hollow, eyes peek over it) ·
  toGuard 6 / fromGuard 5 · attack 13 "Kütük Ezmesi" (roots heave the club up behind the shoulder — long hold —
  overhead smash, splinters + leaves, bounce, club thrown onto the shoulder, back to the hang) · roar 10 (squash,
  rise, arms flung wide, club high, mane bristles, eyes blaze, mushrooms puff spores) · hit 6 · hitHeavy 8 (step
  back on the near root foot) · hitMagic 8 (the old lightning scar re-ignites white/violet, rigid 1-px tremor) ·
  summon 13 (sealed log lands and stakes → seam glows → bark doors burst open → shoulders and roots unfurl, the log
  rises on its root legs, a step → club SLAM → the door plates fall) · death 10 (roots unravel and snake into the
  tile, the club drops, the trunk caves inward and sinks, one sprout remains and wilts) · revive 10 (reverse: the
  sprout perks up, roots braid up out of the tile, the trunk rebuilds, eyes ignite, land) · special 13 "Kovuğa
  ekim" (club held out, far root arm raised with fingers splayed → a seed lands on the root tip (release) → the root
  pulls it into the hollow (contact) → a knot light flares, a sprout grows on the club; frames 3…7 are the per-seed
  loop the cinematic repeats).
- **Holds.** REHBER HA-2…HA-5: attack longest frame = the full wind-up (190 ms), release 60, contact 80, recovery
  holds rising; hit f0 50 / f1 60, recover at 240–370 ms; every one-shot ends on idle f0 (appended).

### What was built (RIG + ALL ANIMS stage)

Files (all new, owned by this card):
- `src/art/monsters-v3/hollow_ogre.ts` — the registered v3 shell (88×80, anchor 38/74, hover 0, `heavy`, `p2:'relight'`,
  `points()`). The `portrait()` hook + its 2 imports were added by the parallel card-art agent
  (`src/art/cardart-v3/hollow_ogre.ts`) — keep them if the shell is rewritten.
- `src/art/monsters-v3/hollow_ogre-rig.ts` — `Pose` → pixels (`drawOgre`), skeleton, part painters, light layer.
- `src/art/monsters-v3/hollow_ogre-anims.ts` — pose tables, holds, marks, `framePose`, `framePoints`, `MUZZLE`,
  `SEED_LOOP` (special frames 3…7 = the per-seed loop for the cinematic), the sameness distinction header.
- `src/art/monsters-v3/hollow_ogre-kit.ts` — local compositor / bands / tubes, plus `cylBands` (log cylinder planes),
  `twistSeams` (root-bundle strands), `DARKER`.
- `tests/art/hollow_ogre.test.ts` — 9 tests (spec/marks, validateArt normal+melee, KK-13 budget, determinism + P2
  silhouette, 64-class size, HA-9 feet band, palette whitelist, eyes / seed / knot lights, death remnant). Pass.
- Shared one-liner: `src/view/light/profiles.ts` `MONSTER_GLOW.hollow_ogre` → `gold4 1, gold3 0.75, void4 0.9,
  void3 0.6`, spill `gold3` (was the `earth4`/`white` placeholder that would flood the bark; earth4 is a body tone
  here: mushroom caps, heartwood). gold* and void2–4 appear ONLY in the light pass (eyes, knots, seed, scar glow,
  sprout bud, firefly).

Final design decisions (vs the note above):
- The club head RESTS on the ground in idle / guard / transitions at a fixed point (`PLANT`); the hand moves on a
  circle around it (`planted(ca)`), so HA-9 holds with the head inside the feet band. Guard = the club swung upright
  as a post in front of the body, the mane bristling, eyes narrowed.
- The top of the log is OPEN: a pale end-grain ring around a dark hole (reads "hollow log" at 1×), splintered crown
  shards with charred tips around it, the lightning scar running from the rim down into the chest hollow.
- Seeds are caught by a planting TENDRIL (a thin root out of the near shoulder, `tl/tx/ty/tc/topen`), not the far
  arm: the far arm is behind the trunk and could not reach the front hollow. `points().hand` = tendril tip (falls back
  to the far root tip). The hollow never "eats" (no mouth / swallow; the blazing-eye spill row was removed because it
  read as a mouth).
- The boosted club (glowing sprouts) for the rest of the turn cannot live in the sheet (one sheet per card): the
  cinematic should overlay sprouts at `points().staff` (club head) / `grip`. The special itself grows one sprout
  (`sprout`) and lights one knot (`knots`, `knotHot`); both end at 0 on the last frame (HA-14) — the cinematic keeps
  the knot lights / sprouts as overlays.
- Summon f0 is the sealed log (no arms/legs, bark whole over the hollow with a jagged split seam); `land` = f1
  (stake, squash, dust). Doors = two bark slabs swinging out like shutters, shaken loose by the club SLAM (f9).
- Death: arms unravel into loose strands that slump and snake into the tile, the club drops, the trunk caves in
  (`collapse`) and sinks, ONE sprout remains (f8) and wilts (f9). Revive is the reverse (sprout perks up → roots →
  trunk rebuilds → `land` f7 → first breath).

Numbers (monster-sheet / monster-gates `--class medium --ref none`, P1 | P2): **21 ok, 0 FAIL**.
idle 16 f 1890 ms, idleΔ 425 px = 19.4 % liveliness, max/mean 1.57, seam 1.29; guard Δ 0.44×idleΔ, seam 0.45;
IŞ-10 idle 6.9 % / body max 8 % / effect max ~14.5 %; HA-21 hit 29.6 %, hitHeavy 28.3 %, all idle phases < 50 %;
toGuard 6 f 360 ms, fromGuard 5 f 350 ms; 126 frames, 3.55 MB (≤ 3.6), ~1.7 ms/frame. Every one-shot out = 0.
attack 13 f 1640 ms (charge 1, release = impact 5 (60 ms), contact 6 (90 ms), recover 8; longest = full wind-up
f3 200 ms); roar 10 f (charge 1, release 3: the trunk snaps forward and pounds the club); hit 6 f (recover 280 ms);
hitHeavy 8 (step back on the near root foot); hitMagic 8 (scar re-ignites white/violet, 1-px tremor); summon 13
(land 1); death 10 f 880 ms (dissolve 4); revive 10 (land 7); special 13 (charge 1, release 4 = seed lands, contact
5 = planted, recover 9; f8 is a 200 ms hold the cinematic may stretch).

Evidence (shots/v3/kart-b/hollow_ogre/):
- `sheet/hollow_ogre-v3-all.png` + per-anim strips `sheet/hollow_ogre-v3-<anim>.png` (P1, ×3, points),
  `sheet-p2/hollow_ogre-v3-p2-all.png` + strips (P2 relight, mirrored as on screen); `.txt/.json` per-frame tables.
- `gates.txt` (monster-gates output), `sameness/sameness.txt` + overlays.
- `board.png` (`?dev=monster&mode=board`, 1× on the tiles), `b2Ogre-live.png` (in the real duel at v3: registered,
  light layer glow on the eyes).

Open issues / for the next stages:
- Sameness (KK-15): 6 UYARI rows, all motion-track warnings (no KEY / SI / silhouette): attack × abyss_magus 0.59 /
  dusk_sorcerer 0.62; special × mudgrasp_spirit 0.72 / grim_warden 0.72 (both lane-B siblings, still changing);
  guard × seal_leg_l 0.75; idle × ember_wolf 0.68 (proxy). A distinction header is in `hollow_ogre-anims.ts`; a blind
  test is still owed (critic agent) once the siblings settle.
- Critique rounds done in this stage: 4 self-review passes on zoomed frames (f0 design → silhouette/hollow-log top →
  arm/club read → contact/death/special). Independent critic rounds are still owed (handbook §0.8).
- Known weak spots worth a critic's eye: the near root arm partly overlaps the hollow in roar f1 / attack f2–3 (short
  frames); root fingers wrapping the club handle do not read at 1×; the shoulder moss + mushrooms are a small pale /
  dark cluster next to the crown (readable at ×3, a spot at 1×).
- `DEATH_PRESETS.hollow_ogre` is still `{ material: 'plant', accent: 'stone' }` (not touched in this stage): the death
  cinematic stage should drop the `stone` accent (§5.2 reserves stone/ash) — likely an option-(b) death since the
  sprite already ends on the wilted sprout.
- Idle SFX: not built (orchestrator decision 3: optional, only inside own files) — for the sound stage.
- Unrelated suite failures seen (not ours): cardface-v3 G1 scrap_raiders, dusk_ashen, grim_warden-cardart (cut-in, in
  progress), hourglass_imp, shield_titan. `npm run typecheck` clean.

## Stage: CARD ART + LIGHT PROFILE

### What was built

- `src/art/cardart-v3/hollow_ogre.ts` (new, owned): a NATIVE painting (no sprite pixels; follows the rig's
  character: lightning-split hollow log, OPEN log top = pale end-grain ring + dark hole + pale shards with charred
  tips, chest hollow with two ember eyes, branch mane, moss caps + mushrooms, root-bundle arms, root legs, knotted
  club). Spec "Kart resmi": night forest, eyes glowing in the hollow, club alight with violet seeds.
  - **Backdrop:** the EARTH recipe made a night forest with its own tones only (`FOREST_RECIPE` = EARTH without the
    mesa ridge): earth0 sky, the stepped earth2/earth3 disc as a MOON at the upper left behind the mane (SUN (30,12)
    r22), a low earth1 treeline of round crowns, stone0 floor under the earth1 horizon. 5 tones.
    Decision: the light shape is NOT centred on the focus. Behind the hollow its stepped edge ran parallel to the
    head's top (a tangent that read as a hood) and its earth3 core merged with the lit bark; behind the mane it gives
    the branches a backlit silhouette and reads as the night forest's moon. The hollow is framed instead by a pale
    split-wood ring (earth3/earth2) around a charred earth0 lip.
  - **Values:** trunk on the bark ramp then one "night value" step down (earth2 lit / earth1 / earth0); the near arm
    keeps the bark ramp (reaches into the light); the club is charred backlit wood (earth2/1/0) with three snapped
    branch stubs, a seed in each cut face (never a horizontal pair: on the round crown two seeds read as a second
    face's eyes), a sawn end-grain top, two sprouts. Rim earth3 on the shadow side.
  - **Light layer:** ember eyes (gold3 slits, gold4 cores, gold1/2 lower lids) on a flat void1 pool; ONE white glint
    in the near eye = brightest point = focus (big (50,31), small (21,20)); seeds void2/void3/void4; violet flame
    tongues off the cut faces (1–3 px flicker); violet spark; firefly (gold3).
  - **small 44×34:** the same geometry at ×0.64 (closer crop: head, hollow, club, shoulders — "aynı resim, daha
    yakın"), native 1× bands, + hand corrections: `TOP_SMALL` (head stump with the open-log rim and 3 shards, two bold
    charred mane branches over the moon; stamped BEFORE ink so the outline closes it), hand-placed eye pixels; the
    seed positions come from the knots. `closeInkCheckers` removes matter/ink and backdrop-tone checkers left by the
    4-neighbour outline (spike tips, twigs) without re-outlining (a second ink() thickens every contour).
  - **Living art:** 6 f × 150 ms: glint pulse (white → gold4 → gold3), eyes blink on f3, seed 0 breathes, flames
    flicker, spark rises, firefly slips out of the hollow on f3–5 (≤ 2 px a frame).
  - Numbers (kit artStats): big 20 colours (at the cap — adding a tone needs removing one), backdrop 5, isolated
    3.1 %, checker 0, outline ink 100 %, focus ok; small 16 colours, backdrop 4, isolated 6.1 %, checker 0, focus ok.
    subjectFill 0.98 / 0.95 (over the 0.6–0.75 style target: the giant + raised club fill the window, like
    crystal_wyrm's 0.93; not a test gate).
- `src/art/monsters-v3/hollow_ogre.ts`: `portrait()` hook + 2 imports added (the file already had the new design).
  If the shell is rewritten, keep:
  `import card from '../cardart-v3/hollow_ogre'; import { renderArt } from '../cardart-v3/_kit';` and
  `portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },`
- `tests/art/hollow_ogre-cardart.test.ts` (new, 5 tests, pass): budgets for both sizes × 6 frames (palette, isolated,
  colours, backdrop tones = EARTH recipe only, focus, outline, checker ≤ 0.5 %), white glint = brightest + only white
  + gold eye, violet seeds on the club in both sizes, blink f3 / glint back f5, determinism.
- `src/view/light/profiles.ts` `MONSTER_GLOW.hollow_ogre`: already set by the rig stage to gold4 1 / gold3 0.75 /
  void4 0.9 / void3 0.6, spill gold3. Re-verified against `hollow_ogre-rig.ts`: gold1–4 and void2–4 are drawn only in
  the light pass (eyes, knot lights, seeds, scar glow, bud, firefly); void0/void1 (hollow interior), earth0–4
  (earth4 = heartwood / mushroom caps) and leaf are body tones; white appears only as blaze cores and the one moss
  glint, so it stays out (a white emissive would halo the glint). Left unchanged.
- `src/cinematics/_v3/presets.ts` `DEATH_PRESETS.hollow_ogre`: `{ material: 'plant', accent: 'stone' }` →
  `{ material: 'plant', accent: 'plant' }` (stone/ash endings are reserved for R1 / stone_sentinel, YENI_KARTLAR §5.2;
  the roots-into-the-tile + wilting sprout ending is plant).

### Evidence (shots/v3/kart-b/hollow_ogre/)
- `cardart-big-x1.png`, `cardart-big-x3.png`, `cardart-big-x6.png`; `cardart-small-x1.png`, `cardart-small-x6.png`
- `cardart-living-big-x3.png`, `cardart-living-small-x4.png` (6 frames each)
- `cardart-hatcard.png` (`?dev=hatcard&id=hollow_ogre&look=v3` ×3: hand 1× face, inspect 2× face, art 1×/3×, iso field
  cards P1/P2) — the real in-game faces via the portrait hook
- `cardart-faces-x1.png`, `cardart-faces-x4.png` (1× faces side by side: hollow_ogre | mudgrasp_spirit | crystal_wyrm |
  ember_wolf | grim_warden), `cardart-face-x2.png`, `cardart-mini-x8.png` (16×12 box downsample)

### Tests
- `npx vitest run tests/art/hollow_ogre-cardart.test.ts tests/art/hollow_ogre.test.ts tests/art/cardface-v3.test.ts`:
  23 pass, 1 fail = cardface-v3 G1 `scrap_raiders` (0.692 < 0.7; another lane's card, already listed as a known
  unrelated failure in the rig stage). hollow_ogre passes every cardface check. `tsc`: no errors in my files.

### Open issues
- Contrast: next to crystal_wyrm / ember_wolf the face is brown on brown (the same as mudgrasp_spirit: the EARTH recipe
  has only earth tones). The hollow + gold eyes + violet seeds carry the read at 1×; an independent critic round is
  owed (is the small's mane-over-moon corner too busy? does the open-log rim + chest hollow read as "two faces"?).
- The light shape sits behind the mane, not on the focus (decision above) — flag for the style reviewer.
- Card art shows the club RAISED (action pose); the sprite drags it on the ground in idle. Same club, same knots/seeds.
- Big uses 20 colours (the cap).

## Stage: CARD ART + LIGHT PROFILE — round 2 (contrast + readability pass)

Re-ran the stage on the existing painting (round 1 above). Looked at it zoomed next to ember_wolf / crystal_wyrm:
round 1 was brown on brown (the night-value trunk earth2/1/0 against the earth0 sky + earth1 treeline: the
silhouette lived on the ink line alone), the club was a thin blob, the seeds were small grapes, the small's top-left
(generated mane + TOP_SMALL branches + moon) was a scribble. Variants tried and LOOKED at (scratch
`/tmp/claude-0/-home-user-yugioh/77596f6a-069b-5204-8bfc-ba0d0b8509ca/scratchpad/hollow_ogre/ca/cmp1..3.png`): moon behind the head (merges with
the lit bark), moon behind the club with a charred dark club (the club vanished into the sky), lit mane (merges with
the moon). Kept: moon behind the dark mane (backlit branches) + the changes below.

Changes in `src/art/cardart-v3/hollow_ogre.ts`:
- Trunk on the FULL bark ramp (earth3 lit / earth2 / earth1); the "night value" map was removed. The lit log is now
  the largest light mass against the earth0 sky and reads at 1×.
- Heartwood frame: the split wood around the hollow is earth4 on the lit lips (earth3/earth2 toward the shade); the
  open log top's end-grain ring is earth4 on its lit half around a smaller hole. (gold1 was dropped — lower lids are
  gold2 — to stay at 20 colours in big.)
- Club thicker (7 → 15 px), bigger sawn end, bigger knots moved off the right edge; each cut face burns: void2 ember
  ring, void3 kernel, 2×2-ish void4 heart; violet flame tongues 2–7 px (2 wide at the root, tip leaning) drawn over the
  sky, flickering per frame — "sopası mor tohumlarla tutuşmuş" now reads.
- Bigger ember eyes (big: near 6×3 slit, far 4×3; small: near 3 px + glint, far 2 px + lid).
- Small: generated mane removed (`paintMane` returns empty for small); `TOP_SMALL` redrawn in small-canvas coords
  (`TOP_SMALL_X = 0`) with two clean 2-px charred branches (one up-left, one back with a forked twig) over the moon,
  earth4 heartwood on the head ring, smaller top hole (it read as a second mouth); seeds get a 1–3 px flame each.
- Numbers (artStats f0): big 20 colours / backdrop 5 / isolated 3.1 % / checker 1 px / outline ink 100 % / focus ok;
  small 19 / 4 / 7.4 % / 0 / 100 % / ok. subjectFill ~1.0 / 0.98 (giant + raised club fill the window).

Light profile / presets: re-verified, unchanged. `MONSTER_GLOW.hollow_ogre` = gold4 1, gold3 0.75, void4 0.9, void3
0.6, spill gold3: in `hollow_ogre-rig.ts` gold* and void2–4 appear only in the light pass (eyes, knots, seeds, bud,
firefly, scar glow); white is also the moss glint, so it stays out. `DEATH_PRESETS.hollow_ogre` = plant / plant.
`portrait()` hook is in `src/art/monsters-v3/hollow_ogre.ts` (unchanged).

Evidence (re-shot, shots/v3/kart-b/hollow_ogre/): `cardart-big-x1/x3/x6.png`, `cardart-small-x1/x6.png`,
`cardart-living-big-x3.png`, `cardart-living-small-x4.png`, `cardart-hatcard.png` (?dev=hatcard ×2: hand face, inspect
face, art, iso field cards), `cardart-hatcard-x4.png` (hand face zoom). Round-1 `cardart-faces-*`, `cardart-face-x2`,
`cardart-mini-x8` were deleted (stale; their node script now trips over Phaser's `window`).

Tests: `npx vitest run tests/art/hollow_ogre-cardart.test.ts tests/art/cardface-v3.test.ts tests/art/hollow_ogre.test.ts`
→ 23 pass, 1 fail = cardface-v3 G1 `scrap_raiders` 0.692 < 0.7 (not ours, pre-existing). tsc: no errors in my files.

Open issues (round 2):
- The light shape still sits behind the mane, not on the focus (KART_RESIMLERI §2 "ışık şekli odağı çerçeveler"):
  deliberate (behind the head it merges with the lit bark), flag for the style reviewer.
- Under the club (near fist + root fingers + club foot, big x 60–75 y 40–60 / small x 26–36 y 18–30) is still a busy
  tan area; readable but not crisp at 1×.
- Independent critic round still owed.

## Stage: RIG + ALL ANIMS — round 2 (redraw / readability pass)

The round-1 rig (above) was kept as the architecture (Pose → pixels, `Comp` part ids, pose tables). Re-studied
against `_magma_titan` (big readable masses, one blazing focus) and `mudgrasp_spirit` (lane sibling, same earth ramp).
Honest critique of round 1 at ×6/×8: the trunk read as a flat tan sack / cloak; the near arm and the club lay on ONE
diagonal line (arm + club = one long bar, the club looked like a forearm); the club was a thin stick; the toadstools
merged with the pale open-log ring (invisible); the shoulder moss was a bright green "cheek" next to the hollow; the
guard (club as an upright post far in front) looked like holding a staff out; the chest hollow was small.

### Design decisions (round 2)
- **Arm / club composition:** the club now hangs LOW and FORWARD (≈22° in idle, head at `PLANT` = (AX+34, GY−13),
  held just clear of the feet band), the near root arm bends with the ELBOW FORWARD (`nb −1` in idle, arm segments
  13.5 + 14). Arm and club read as two shapes (a "7"), the club is a separate dark charred log.
  `planted(a)` keeps the old pose-table numbers on a "hang" scale (`CA_OFF = 33`).
- **Club:** a heavy knotted log: width 4.4 → 10, head disc 5.5, three burls (one on the head), `CLUB_LEN` 23 → 25.
- **Bark:** long vertical furrows (5 per row, breaking every ~6 rows into plates, a 1-px wiggle every ~9 rows) in
  trunk-local rows (they ride with the log, no crawling); the lit band narrowed (cylBands 0.17 / 0.5) so the log
  reads round and heavy; the upper log is CHARRED one value down with a ragged tide line (the lightning burn).
- **Silhouette:** shoulders broader (rad bump 4.5 around t 0.74); the open-log ring smaller (rx 0.72·r, ry 0.3·r) so
  it no longer reads as a second face; two pale BRACKET FUNGI shelves on the log's back edge (the "dead log" read
  against the sky); the two toadstools on long stems moved to the front of the near shoulder (read against the sky).
- **Hollow:** bigger (5×7, was 4×6) with four pale torn-heartwood splinter teeth jutting from its rim into the dark
  (the lightning split); ember eyes unchanged (2×2 + 1×2, light layer, never outlined).
- **Moss:** dark (leaf1 / leaf0) instead of the bright leaf2 lump.
- **Guard (new concept):** the club is barred DIAGONALLY ACROSS THE BELLY under the hollow (hand (61,55), ca −142),
  eyes peeking over it; it twitches twice per loop (creak + after-creak). toGuard / fromGuard lerp the hand + club
  angle (the club swings up through the vertical); the club is out of the feet band in idle AND guard (HA-9).
- **Bigger body acting:** attack wind-up lean −8 (was −4), swing −3, release +8, contact +11 / crouch 4 / bob 2 (was
  +6), bounce +9; roar rear −8 / bellow +10. All hands that pushed the bigger club out of the frame were moved in
  (attack f2/f4–f8, roar f1/f3–f5, summon f6/f9/f10, special f1–f8, death club drop cfx 13).
- **Idle:** the log creaks one px forward only (the 1-px back lean cost ~700 px of furrow/band reshuffle per step and
  broke HA-17 / HA-21 phase); the life comes from the club pendulum (±11°), mane following the creak two frames late
  plus its own wind rock, far-arm sway (±2 / ±1 px) and finger curl, moss drips (0…3), blink, glance, firefly
  (frames 2…13). bob never changes on the same frame as lean.

### Numbers (monster-gates `--class medium --ref none`, P1 | P2): 21 ok, 0 FAIL
idleΔ 394 px = 16.3 % liveliness, HA-17 1.65, seam 0.65; guard Δ within 0.3–0.8; HA-21 hit 18 % / hitHeavy 29 % /
death 29 %, phase max 49 % (hitMagic at idle f5; hit 43 %, hitHeavy 43 %); margins ≥ 2 on every frame of every anim;
126 frames, 3.55 MB (medium ≤ 3.6), 1.75 ms/frame. Marks / holds unchanged (round 1). `tests/art/hollow_ogre*.test.ts`
14/14 pass (the round-1 tests still describe the design: eyes / seed / knots / death remnant / palette / feet band).
`tsc`: no errors in hollow_ogre files.

### Sameness (KK-15) — UYARI rows (motion only; distinction header updated in `hollow_ogre-anims.ts`)
dusk_sorcerer guard MOTloop 0.952 (points track: "prop displaced up-left and held" — inherent to any held-club guard;
the round-1 post guard was 0.75 vs seal_leg_l) + attack 0.686; abyss_magus attack 0.565; grim_warden special 0.700;
mudgrasp_spirit special 0.703 + death 0.936* (proxy, both sink into the tile); seal_head idle RHYTHM. No KEY / SI /
silhouette rows. A blind eye test (critic agent) is owed.

### Evidence (shots/v3/kart-b/hollow_ogre/)
- `sheet/hollow_ogre-v3-all.png` + per-anim strips, `sheet-p2/hollow_ogre-v3-p2-all.png` + strips (regenerated)
- `zoom/idle.png` (idle f0/f5/f10 ×4), `zoom/p2idle.png` (P2 relight ×6), `zoom/guard.png`, `zoom/atk.png`
  (attack f3–f6), `zoom/sp.png` (special f3/4/5/6/8), `zoom/sum.png` (summon f1/4/6/9), `zoom/death.png` (f1/3/5/8)
- `gates.txt`, `sameness/sameness.txt` + overlays, `board.png` (1× on the tiles)

### Open issues (round 2)
- The card art (`cardart-v3/hollow_ogre.ts`) still shows the round-1 proportions (club raised; that is fine) — no
  bracket fungi / no charred top; harmonise in a card-art touch-up if the critic wants it.
- Sameness rows above need the blind test; the guard row can only drop with a guard that is not "club held before the
  body" — kept, it is the clearest defensive read.
- Struck-wood material sound and idle SFX: unchanged open issues (orchestrator decisions 3 / 4).
- The boosted club (glowing sprouts for the rest of the turn) is still a cinematic overlay at `points().staff/grip`.

## Stage: CINEMATICS + SFX + SCENARIOS

State found: a previous agent had already written (WIP checkpoint `1f503a4`, not logged here) the full set —
`src/cinematics/kart-b/hollow_ogre.ts` (+ `hollow_ogre-fx.ts`, painters only, no side effects), `src/audio/v3/hollow_ogre.ts`
(28 recipes + `HOLLOW_OGRE_VOICE`, wired via `kart-b.ts`) and `src/duel/scenarios/hollow_ogre.ts` (21 keys). This stage
re-filmed everything against the round-2 rig, fixed what the films showed, tightened the effect to budget, levelled the sounds.

### What the cinematics do (all registrations gated on LOOK_V3, priority 20; banish at priority 1 over `b2:banish`)
- **Summon** (`kart-b:hollow_ogre:summon`, `runSummon` + own v3 entrance): growing fall shadow → the sealed log (summon f0)
  drops from above the screen with bark streaks (hoLogFall, sustained) → STAKE on `land` f1 (hoStake, 3-px shake, crack star,
  loam ring, splinters, earth3 light flash) → f2 ember glow in the seam → f3 bark doors split (hoBarkSplit, chips both ways,
  gold flash) → f7 root foot steps out (hoStep) → f9 club SLAM (hoClubSlam: crack 22 px + floor ring + loam + splinters +
  leaves off the crown, finale ring/badge).
- **Strike "Kütük Ezmesi"** (`registerStrike`): charge via `takeCharge('hoCharge')`, two heavy hop-steps toward the target
  (hoStep + loam + root-grip marks each), hoSwing f4, hoRelease, contact = `s.impact()` once (hit-stop from `heavy`):
  hoImpact, crack star, ring, splinters, leaves, loam, earth4 flash. **Boosted** (effect used this turn): the glowing
  sprouts on the club flare, 40-mote violet pollen burst + a slow drifting pollen cloud, void3 flash, hoPollen. Club thrown
  on the shoulder (hoShoulder), steps home. Direct: smash in front + a floor rupture running to the duelist.
- **Effect "Kovuğa ekim"** (activate hook + `'banish'` handler, both batch paths via `ctx.keep/take('ogre:reach')`):
  reach pose (special f0–3) + the graveyard pile stirs (violet ring, motes, light pool, hoReach); per seed: the REAL
  graveyard monster rises as a half-size void-ramp silhouette of its own idle pixels (hoShrink) and collapses into a light
  seed, the seed arcs onto the tendril tip (hoSeed), catch f4 (hoCatch), into the hollow, knot light f6 (hoKnot, violet
  flare, +400 number, badge roll), sprout on the club f7 (hoSprout); seed 2 is pipelined; hollow glow end (hoGlow).
  `statChange` is consumed (badge rolls per seed). Persistent: `ogreBoost` aura (knot lights in the hollow + n glowing
  sprouts on the club + breathing void light pool), cleared by an observer on `turnStart`/`gameOver`.
- **Death** (`destroyed` hook, option (b), no shatter): f1 root arms unravel (hoUnravel; planted seeds escape as violet
  motes), f2… strands slither out along the floor and dig into the tile (`rootsIntoTile`), dissolve → hoRootsRetract
  (sustained), trunk caves in (hoCollapse, dust drawn inward), last frame: the lone sprout wilts (hoWilt, one leaf drifts),
  4-step bayer knock-out, card born → graveyard. `DEATH_PRESETS` plant/plant (no stone).

### Changes this stage
- Seed flight was unreadable at 1× (a 4-px dot): new `drawSeed` size 3 (5×6 teardrop, gold4 core), 12-bead stepped trail,
  bigger halo, two glints, stronger light pool; the shrink ends on the size-3 seed.
- Two +400 numbers overlapped into "+4000": now placed side by side (±17 px) for k = 2, centred for k = 1.
- Effect timing: RISE 110→90, SHRINK 240→200, FLIGHT 320→315, glow hold read for 120 ms (rest runs on) → hoEat2 2.316 s
  game (≤ 2.32 = REHBER 1.6 s × 1.45). Spec storyboard (0.8 + k·0.7 s) would be 3.19 s for k = 2: compressed by pipelining.
- Pollen burst was lost in the hit-stop clutter: 26 → 40 motes (+ 2-px squares) + a slow 10-puff pollen cloud that hangs
  after the hit-stop.
- Summon SLAM crack was too small to read: crack 16 → 22 px, + floor ring + loam.
- Sounds (audio dev page stats): hoSeed was −21.6 dB loud / thin single sine → rebuilt (arc + fifth twin + warm triangle
  body + 6 pentatonic spark plinks) → −13.6 dB. hoShrink / hoCatch / hoSprout / hoPollen / hoWilt were −23…−27 dB
  (inaudible next to the −6…−8 dB impacts and the −15 dB wyrm/magus effect sounds) → a local `trim()` gain bus per recipe
  → −15.6 / −16.8 / −17.3 / −15.9 / −18.2 dB. Spectrograms: scratch `…/scratchpad/hollow_ogre/snd/*.png`.

### Scenario keys (`src/duel/scenarios/hollow_ogre.ts`)
hoSummon, hoSummonP2, hoAttack, hoAttackP2, hoDirect, hoDirectP2, hoBlocked, hoGuard, hoKill, hoKillP2, hoKillDef,
hoTrade, hoEat1Auto, hoEat1AutoP2, hoEat1Prompt, hoEat2, hoEat2P2, hoEatAttack, hoEatAttackP2, hoEatDirect, hoIdle.

### Gates
- `measure --look v3 --scenarios 'ho*' --camera-gate <scratch>/camera-base.json`: **21 ok, 0 FAIL** (zoom 1, no focus of
  our own). Budgets (game clock): summon 2.55 s; attack battle 2.20 (≤ 3.19); direct 2.30 (≤ 2.32); declare 0.316
  (≤ 0.435); death destroy 1.57 (≤ 2.03); effect k=1 1.85, k=2 2.316 (≤ 2.32); number − contact 0 ms everywhere.
- palcheck (a5 rules, clip 200,40,240,240, frames in `shots/v3/kart-b/hollow_ogre/frames/`): hoEat2 Δoff +0.61 (ok);
  white 2.0 % fails on every film incl. the reference saWyrmAtk (2.65 %) / suMagus (3.75 %) — the arena UI, not ours.
  hoSummon Δ at t=102 (the shared card slam) and hoKill Δ at t=918 (ember_wolf's fire contact) are not ogre pixels.
- `tsc` clean; `vitest tests/art/hollow_ogre* tests/presentation tests/audio` pass (the presentation registry-load test
  timed out once under machine load, passed on re-run).

### Evidence (shots/v3/kart-b/hollow_ogre/cine/)
hoSummon.png, hoSummon-zoom.png, hoSummonP2.png, hoSummonP2-zoom.png, hoEat2.png, hoEat2-zoom.png, hoEat2-flight.png,
hoEat2P2.png, hoEat1Auto*.png, hoEat1Prompt.png, hoEatAttack.png, hoEatAttack-contact.png, hoEatAttackP2.png,
hoEatDirect.png, hoAttack*.png, hoDirect*.png, hoBlocked.png, hoGuard.png, hoKill.png, hoKill-death.png, hoKillP2.png,
hoKillDef.png, hoTrade.png.

### Open issues
- Idle SFX not built (decision 3: optional) — none.
- Struck-wood material sound when the ogre is HIT (decision 4): falls back to the generic hit; logged, not changed.
- The two +400 numbers live 1.5 s scene (shared `impactNumber` LIFE): in back-to-back scenario steps they still float
  over the attack declaration.
- The seed arc reads at ×2 zoom and as a violet bead at 1×; a critic might still want it bigger / a brighter trail.
- No clip/MP4 (`tools/clip.mjs`) rendered for the owner this stage; independent critic rounds still owed.
- v1 filmdiff not re-run (every registration is LOOK_V3-gated; no shared file touched).

## Stage: FIX — round 1 (independent critic round 1)

Critic evidence: `shots/v3/kart-b/hollow_ogre/critic-r1/`. Fix evidence: `shots/v3/kart-b/hollow_ogre/fix-r1/`.
Verdict being answered: "the picture is too small / generic at 1×; the signature 'Kovuğa ekim' fails at 1×".

### Findings → what changed
1. **BLOCKER — seed flight unreadable.** New hero seed `drawHeroSeed` (9×11 teardrop: void2 rim with a gold4 lit
   top-left edge, void3 body, void4 heart, 2×2 white core, gold4 tip glint; whole-row squash/stretch on launch / catch).
   `seedFlight` rewritten: a 2-px stepped trail of time-stamped beads that hangs 150 ms and lingers after the arrival,
   sparks every 22 ms (some gold4 / plus), a turning 4-spark halo, the light pool follows the seed with a floor point
   lerped pile floor → giant floor (light layer), plus a sparse void3 glint ring + void4 dot on the floor under it (a
   first try used a dithered void1/void2 ellipse: it read as a dark puddle → replaced). New `heldSeed`: the hero seed
   rides the tendril tip from the catch (squash) down into the hollow (special f4–f5), so the object never drops out.
   New `reachRoot`: while the card shrinks, a 2-px earth root (ink edge, forked violet-lit tip) grows out of the tendril
   tip along the coming arc (≈ 42 %) and retracts as the seed flies (fills the old 0.4 s gap, points the eye — minor
   "pacing" finding). Knot beat: `knotBloom` (16-px 8-ray burst tilted off the axes — a first version read as a cross-
   hair — white heart, one ring expanding to 24 px out of the chest, 14 motes) + a 44-px void3 light flash + a 150 ms
   2-px body shudder of the sprite. Club sprouts (aura) now 6–9 px with leaf pairs, an ink-edged stem and a 3×3 violet
   bud with a dithered halo and a gold4 glint; the bud flares white on the knot. Slow-mo on the first catch NOT done:
   the effect is at its budget (k = 2: 2316 ms ≤ 2320).
2. **MAJOR — stale +400 numbers.** The shared `impactNumber` (1.5 s) is gone from the effect: own `seedNumber` (same
   fx:num:heal sheet, 2-frame ×2 slam, 6-px jump, stepped blink-out, no alpha) pinned 9 px above the new sprout's bud
   (live point), 620 ms for seed 1 (destroyed when seed 2's appears), 440 ms for the last one → gone before the next
   declaration (fix-r1/hoEatAttack.png row 0: only the badge carries 2200).
3. **MAJOR — summon.** The falling log is now far taller than the giant: `logColumn` tiles the sealed log's own base
   rows (ping-pong band, a knot hole every 17 rows, ink end; it covers the sprite's base outline → one log, no seam) 46 px
   below the sprite, clipped at the floor; on the stake the column is DRIVEN into the tile over 130 ms (telescopes away),
   4-px shake, `dustWall` (30 big pale puffs climbing 20+ px, 14 skittering chips), a bigger crack / pale ring. Bark
   doors (rig `drawDoor` rewritten): two 9-px slabs hinged on the hollow's sides, closed (bark out) → edge-on planks
   (summon f3 door 0.4) → open showing a heartwood (earth4/earth3 grain) inner face (f4 0.75, f5 1), sheared as they
   swing toward the viewer; f2 `emberCrack` (the seam blazes white → gold4, short gold rays leak out, 2 frames) + a gold
   floor light pool; f3 chips burst off both hinge edges + 1-px shake. SLAM set-piece unique to the card: `rootStar`
   (9 branching root cracks with heartwood lips running 40 px across the tile, each forking), `sproutRing` (13 moss
   tufts + sprouts pop up round the blow, stand, wither brown and sink), two waves of leaves raining off the crown, a
   leaf-green light pool; the shared finale shockwave ring is no longer used (badge pop + own shake instead).
   Summon now 2666 ms (was 2550; normal summon, no budget row; ace limit 4.35 s).
4. **MAJOR — boosted attack.** Knot lights moved OUT of the eye zone: burning knots in the bark under the hollow
   (rig `knotLight` spots (−5, hry+4) / (+2, hry+7), ring alternating void2 / charred earth0; the aura's KNOT_SPOTS
   match) — no more four-eyed face. Sprouts pulse on every heavy step (`aura.pulse()`), the club head flares violet
   (two stepped rings + 6 orbiting white/void4 sparks) on the release → contact+1 frames. Contact: `pollen` 64 motes
   in 2 sizes (2-px squares) drifting up, an 18-puff cloud hanging ≈ 0.8–1.2 s, a 4-step ring to 20 px, a violet light
   pool 600 ms, a void4 44-px flash (fix-r1/hoEatAttack-pollen.png).
5. **MAJOR — death.** Rig: one in-between collapse frame (death 11 f, 127 frames total, 3.58 MB ≤ 3.6): f5 0.62 → f6
   0.72 (top ring drops in) → f7 0.84 → mound; holds re-timed to the same 880 ms. `rootsIntoTile`: 9 strands 22–34 px,
   2 px with ink edges, a dust puff where each digs in, holes, pulled in toward the holes; it now also starts when the
   death enters past f2 (atFrame `late` default — it was silently skipped in battle: that was the critic's "no strands").
   The roots finish before the sprout beat; the lone sprout gets a gold → void light flicker and is HELD upright 260 ms
   (anim pause) before it wilts; the card plate is born after the wilt (fix-r1/hoKill-roots.png, hoKill-sprout.png).
   Death destroy 1934 ms (≤ 2.03 s).
6. **MAJOR — sprite craft.** Trunk: broader lit plane (cylBands 0.26 / 0.56), a reflected rim column back to the body
   tone on the shade edge, a dashed earth4 specular ridge in the lit plane (trunk-local rows), 4 furrows instead of 5,
   two overlapping bark SCALES (lit upper lip, dark near seam, ragged lower seam) and a long charred burn scar down the
   shade side. Top ring: smaller (0.6·r × 0.26·r) charred earth2/earth3 end grain, small void0 hole, the near crown shards
   re-stamped IN FRONT of its lip → reads as a splintered stump, not a mouth. Club: charred (bands 1 / 3 → mostly earth1
   / earth0, one earth2 highlight) and a 1-px INK gap wherever the root hand overlaps it → two values, two shapes at
   contact. Moss: leaf2 lit band on top (MOSS L leaf2 / M leaf1 / S leaf0).
7. **MAJOR — guard.** The darker club barred across the belly separates from the trunk; guard eyes 1.2 → 1.7 (blazing,
   lid narrowed). New guard-only beat (observer on `battle` where the ogre is the surviving target in defence /
   guard; fires on `v3:contact` of that attacker): `guardChips` (22 charred + heartwood 2-px chips off the club,
   bouncing), loam at both root feet, root-grip marks, a gold4 eye flare, `hoBlock` sound.
8. minor — direct: `rupture` is now a 2-px ink crack with earth4 / earth2 lips, loam + heartwood + leaf spurts every
   other step, and three roots (12–21 px) erupt under the duelist, then the crack chars out.
9. minor — sound: `hoSeed` +3 dB (trim 1.41; −13.6 → −11.0 dB loud) + a sparkling pentatonic tail that follows the seed
   in (a high-pass noise burst I tried clicked on the master chain → removed). New `hoBlock` (−12.7 dB),
   `hoIdleCreak` (180 Hz glide, −26 dB, played at 0.32) and `hoFirefly` (two soft high sines, −31 dB, played at 0.28). Idle
   voice (`idleVoice`, own file, v3 only): every 3rd idle loop the creak on idle f3, every 4th the firefly tick on f4;
   started after the summon / effect / strike.
10. Gate fallout: the new trunk texture pushed HA-21 phase (hitMagic f0 vs idle f5) to 50.9 % → idle club pendulum
   ±11° → ±9.5° (HA-21 phase 49.4 %, HA-17 1.77 ≤ 1.8).

### Numbers / gates
- monster-gates (medium, P1 | P2): **21 ok, 0 FAIL** (`shots/v3/kart-b/hollow_ogre/gates.txt`, sheets regenerated in
  `sheet/`, `sheet-p2/`). 127 frames.
- measure `ho*` + camera gate: **21 ok, 0 FAIL**; summon 2666, battle 2200, direct 2300 (≤ 2320), declare 316, death
  1934 (≤ 2030), effect k=1 1833 / k=2 2316 (≤ 2320), number − contact 0.
- `tsc` clean; `vitest tests/art/hollow_ogre* tests/audio` 21/21; `tests/presentation` 76/77 (the registry-load test
  timed out at 5 s under machine load — the known flake).

### Evidence (shots/v3/kart-b/hollow_ogre/fix-r1/)
hoEat2.png (1×), hoEat2-zoom.png, hoEat2-flight.png, hoEat2-hollow.png (×4: held seed, bloom, sprouts, +400 on the bud),
hoEat2P2.png, hoSummon.png, hoSummon-zoom.png (fall / drive / doors), hoSummon-slam.png (root star + sprout ring),
hoEatAttack.png, hoEatAttack-contact.png, hoEatAttack-pollen.png, hoKill.png, hoKill-death.png, hoKill-roots.png,
hoKill-sprout.png, hoDirect.png, hoDirect-rupture.png, hoGuard.png, hoGuard-zoom.png, snd-hoSeed.png, snd-hoBlock.png,
snd-hoIdleCreak.png, snd-hoFirefly.png, snd-hoKnot.png.

### Open issues (after round 1)
- The seed reads clearly at ×2 and as a moving violet drop with a trail at 1×; still small next to the shared numbers on
  a 640×360 board — a further step would be a short time-scale dip on the first catch, which needs budget the effect
  does not have (2316 / 2320 ms).
- The near (right) bark door slab is mostly hidden behind the near shoulder moss / arm in summon f4–f8 (drawn under
  them); the left slab carries the "door" read.
- Guard chips are partly covered by the attacker's own impact VFX (wisp beam); readable after the hit-stop.
- The SLAM's dark patch to the club's right is the shared cast shadow of the lowered club, not an FX of ours.
- Struck-wood material sound when the ogre is hit by other attacks: unchanged (orchestrator decision 4).
- `knotFlare` (old painter) is still exported from `hollow_ogre-fx.ts`, unused.
- No MP4 clip rendered this round; sameness / blind test still owed.

## Stage: FIX — round 1 after the main merge (critic `critic-r1/pm/`)

Owner decision 2026-11-05 applied: REHBER §5 budgets are no longer a gate — the signature now breathes. Evidence:
`shots/v3/kart-b/hollow_ogre/fix-r1b/`. Gates: `monster-gates --class medium` **21 ok, 0 FAIL** (`gates.txt`, sheets
regenerated in `sheet/`, `sheet-p2/`); `tsc` clean; `vitest tests/art/hollow_ogre* tests/audio` 21/21. `measure` /
camera gate / v1 filmdiff NOT re-run this round (all registrations still LOOK_V3-gated; no shared file touched).

### Findings → what changed
1. **BLOCKER — reach went into the opponent's lane.** The special is redrawn: f1 the club is heaved up in front of the
   chest, **f2 it is STABBED head-first into the floor in front of the near foot** (hoStab: thump + tok, floor crack,
   loam, splinters, 2-px shake), f3 both hands on the planted club (a lever); f4 HAUL (leans back, the lightning scar
   lights violet), f5 head back (seed climbing), f6 knot jolt, f7 sprout, f8 glow hold, f9–10 the club is wrenched out.
   The shoulder tendril is gone (also fixes sprite finding (c)). New cinematic `graveRoot` (fx): a 3→2-px ink-edged
   bark root bursts out of the club head and runs **along the floor toward the player's own graveyard** (60 % of the
   way; plows broken lips + rootlets, loam off its growing tip; hoRootRun), rises 17 px and opens a three-pronged cup
   whose tips catch violet light (hoCupOpen). Catch point = the cup, low, between the giant and its pile — on P1
   (down-right) and P2 (up-left) alike (`hoEat2-zoom.png`, `hoEat2P2-zoom.png`). The club never leaves the giant's tile.
   +400 now rises over the hollow on the giant's OWN side (core + back·10, −24).
2. **BLOCKER — compressed timing.** New timeline: ghost rise 150 + HOLD 210 (the real monster's violet ghost stands
   over the pile, rim flickering, breathing a px) + shrink 260; flight 480 (first seed +100 ms and a local slow-motion
   weight bump round its apex and catch, `seedFlight({slow})`); the catch (cup snaps, sparks, hoCatch); **the root
   carries the seed home** as a swollen glowing knot running along it (290 ms, hoCarry); the seed climbs club → grip →
   hollow (`climbSeed`, 250 ms, hoClimb run of three toks); knot; sprout. The next seed launches as soon as the cup is
   free (pipelined). FINALE 560 ms: f8 held, the buds flare every 180 ms, 12 motes rise out of the hollow, hoGlow is now a
   1.2 s resonant hollow tok + cavity hum + F# chord (spectrogram `snd-hoGlow.png`), the root sinks back into the floor.
   k = 2 ≈ 4.5 s from the first ghost to the club coming out (k = 1 ≈ 2.5 s).
3. **MAJOR — 1-px vector rings.** All gone: `knotBloom` → `knotBurst` (the hollow flashes white 2 frames, 7 jagged
   2-px banded EMBER CRACKS run out of the bark round it, white → void4 → void3 → void2, spark beads on their tips, motes);
   no circle round the sprout (the bud itself pops); `pileStir` = three rotating banded arcs (`arcBand`: void4 lead /
   void3 body + a bead) + sparse lit glints; `floorRing` = 5 broken banded earth arcs with chip beads; seed halo ring and
   held-seed ring removed (4 sparks); the attack club flare = two whirling banded arcs; the pollen ring removed.
4. **MAJOR — violet floor stains.** Root cause: in the v3 stepped light layer a violet light is ONLY a floor stamp, and
   its first void tone ≥ 80 % of the merged floor's luminance is void3 → a dark violet dither. Every void-coloured
   `lightPool` / `lightFlash` of this card was removed (seed flight pool, boost pool under the hollow, pile pool, knot /
   end / catch / pollen flashes, death knot flashes); violet light on the floor is now a few drawn void4/void3 glints.
   Warm earth/gold floor lights (they brighten) stay.
5. **MAJOR — summon log + doors.** `logColumn` flares the falling log ×1.6 over 26 rows (wider than the shoulders) with
   burls, ring cracks, knot holes; the falling log wobbles ±1 px (no rotation). Doors (`drawDoor`): heartwood inner face
   with wavy grain + a knot, the face turned from the light one value down, a dark bark THICKNESS strip on the free
   edge, a torn free edge; on the SLAM they tip forward and fall flat (foreshorten to a plank on the floor), and break
   into chips on f11.
6. **MAJOR — summon static middle / weak SLAM.** Holds f2–f8 tightened (90/70/80/80/80/80/170: f8 is the held
   anticipation), new beats: f4 eyes ignite (gold flash) + crumbs off both door hinges, f5 shoulders shrug (hoShrug:
   two-step creak, leaves off the mane, bark chips), f8 eye flare. SLAM: a real 100 ms `hitStop`, 3-px shake 260 ms,
   bigger earth4 floor flash + a gold4 core flash, a dust wall at the blow, a 12-leaf burst off the crown, the root-crack
   star + sprout ring as before. (`hoSummon-zoom.png`)
7. **MAJOR — boost unreadable.** Aura sprouts are now 9–11 px with 2-px ink-edged stems, two leaf pairs each, and a
   5×5 ink-edged violet bud (void4 heart, gold4 glint, twinkling sparkle pixels; all blaze on flare / step); pollen
   motes drift up off the buds every 300 ms while boosted. Contact: a pollen FOUNTAIN shot up out of each bud (44 + 30
   2-px squares that rise, slow and hang, 12 gold sparkles, 16 hanging puffs above the head) + a short upward white
   star. (`hoEatAttack-zoom.png` #24–#29)
8. **MAJOR — contact placement.** attack f6 (contact) now holds the club head at chest height in front (hand 56,40 /
   22°); f7 is the fall-through to the floor. The strike aims the contact frame's club head at the target's **core**,
   the giant stands ≥ 3 px nearer the camera (drawn over the target); body hit = heartwood/bark chips (no green leaves)
   + an earth4 air flash; the floor crack / ring / splinters / loam fire on the fall-through frame. Direct: the club is
   played to the floor before the rupture. (`hoAttack-zoom.png` #18–#23, `hoDirect.png`)
9. **MAJOR — sprite.** (a) The log's open top is now a shallow charred pit (earth1, a tiny earth0 heart) — the chest
   hollow is the only dark focus. (b) Near-shoulder moss = two small dim tufts up on the shoulder ridge (leaf0 body,
   leaf2 lit lip). (c) tendril removed from the special. (d) root fingers over the handle: unchanged (open).
   Gate fallout: HA-17 was 1.96 (failing after the merge, independent of these changes) → idle club pendulum phase moved
   (ph − 0.4): HA-17 1.68, HA-21 phase ≤ 44.8 %.
10. minor — guard: its beat (chips, grip marks, eye flare, hoBlock + a creak) now lands 100 ms after `v3:contact`, with
   a 1-px club recoil.
11. minor — death: strands tapered (2 → 1 px), tips curl as they dig in, every third strand short and pulled back
   first; when boosted the knot lights leave the hollow as two small seeds that rise, dim and fall into the tile beside
   the lone sprout.
12. minor — SFX: hoImpact raw ×0.67 (−3.5 dB; raw pk 1.48 → 0.99), hoClubSlam ×0.84 (raw pk 0.99); hoGlow 1.2 s tail;
   new hoStab, hoRootRun, hoCupOpen, hoCarry, hoClimb, hoShrug (all raw pk ≤ 0.67, loud −7…−21 dB).

### Evidence (shots/v3/kart-b/hollow_ogre/fix-r1b/)
hoEat2.png (1×), hoEat2-zoom.png (whole planting), hoEat2-plant.png (carry / climb / knot of an earlier timing),
hoEat2-finale.png, hoEat2P2.png, hoEat2P2-zoom.png, hoEat1Auto-zoom.png (single batch), hoSummon-zoom.png,
hoAttack-zoom.png, hoEatAttack-zoom.png, hoDirect.png, hoKill-zoom.png, hoGuard-zoom.png, snd-hoGlow.png,
snd-hoImpact.png, snd-hoRootRun.png.

### Open issues
- Struck-wood material sound when the ogre is hit: unchanged (decision 4).
- Root fingers over the club handle still mush at 1× (sprite (d)).
- Idle club hang (board overlap with neighbours, minor): not changed — it is pinned by HA-9/HA-17/HA-21; logged.
- Guard chips still share the frame with the shared BLOK badge (now readable after the beam).
- Summon stake → SLAM ≈ 1.2 s (busy with beats now, but not the 1.6 s total the critic floated).
- `measure` / camera gate / v1 filmdiff not re-run this round.

## Stage: FIX — round 2 (independent critic round 2, `critic-r2/`)

Evidence: `shots/v3/kart-b/hollow_ogre/fix-r2/`, clips `shots/v3/kart-b/clips/{hoEat2,hoSummon,hoEatAttack,hoEatDie}.mp4`
(+ .wav/.json). Measure (`--look v3`, 7 scenarios) in scratch `…/scratchpad/hollow_ogre/r2/m.json`.

### Findings → what changed
1. **BLOCKER — hoUnravel / boosted death branch dropped.** `rootsDeathV3`: the f1 beat (and the dissolve / cave-in beats)
   no longer use `late:false` — `atFrame` fires once as soon as the death shows f1 or later (the shared posematch
   starts the death on the contact). The knot-seed raster now starts from the LIVE core point; the seeds are drawn
   size 3 → 2 → 1 with a short falling violet trail. measure: hoKill `death:1@1100 … hoUnravel@1233`; hoEatDie
   `death:1@7833 hoUnravel@7883`. New scenario **hoEatDie** (eat ×2 → 2200, attack Kristal Ejder 2800, the ogre dies):
   `fix-r2/hoEatDie-death.png` (two seeds leave the hollow, fall beside the lone sprout).
2. **MAJOR — hoShrink early.** New `hoGhost` (the hollow's low blown-jug call + a violet breath) plays when the ghost
   rises; `hoShrink` (D 0.35 = SHRINK_MS game) now plays after RISE + HOLD so its tik lands on the seed: hoEat2
   `hoShrink@1517 → seed launch 1900` (was 560 ms early). The ghost's appearance also gets an eye-flick (gold glint on
   the pile side of the eye, a quiet creak).
3. **MAJOR — hoSeed short.** `hoSeed` / `hoSeedSlow` are sustained (`start` at launch, `stop(45)` at the catch), built by
   `seedVoice(D)` with the arc following the picture (apex ≈ 45–50 %, gentle fall to the catch), D 0.66 / 0.80 s
   (measured flights 666 / 783 ms), the tail +6 dB and spread from the apex to the catch.
4. **MAJOR — hoLogFall cut.** Re-timed to the real fall (D 0.38, peak 92 %, a sub swelling into the stake). New
   `hoLogCall` 170 ms into the card slam: the hole's hollow "oom" + a thin whistle starting high above (fills the
   480 ms gap: `cardSlam@17 hoLogCall@250 hoLogFall@500 hoStake@850`).
5. **MAJOR — contact on the fall-through frame.** The strike now holds the contact frame f6 through the hit-stop
   (`await sleep(frameMs(CON))` on the frozen show clock) and plays f7 + the floor crack / ring / loam only after it:
   hoAttack `attack:6@1200 (number 1200) → attack:7@1500`. Inset 2 → 7 px (daylight between the bodies), the body burst
   26 chips with 3-px bark slabs, plus a 2-frame white→heartwood wood-flash star at the club head
   (`fix-r2/hoAttack-contact.png`).
6. **MAJOR — paper doors.** Rig `drawDoor` rewritten: the open slabs show their OUTER bark face (BARK bands + vertical
   grain seams, a dark hinge crease) as a foreshortened wedge swinging out past the hollow's edge, only a 1-px earth3/2
   lip on the torn edge (no earth4 face anywhere); on the SLAM they sag on the hinge and slide down, never a plank lying
   in front of the legs (the cinematic chips them on f11). `fix-r2/hoSummon-zoom.png` #10–#17.
7. **MAJOR — stake stains.** Every earth floor light of the card became gold3 (stake: no ring, 0.7; SLAM ring gold3;
   stab, floorFx, direct arrival gold3; bodyFx air flash gold4). `fix-r2/hoSummon-zoom.png` #5–#9: no dark dither.
8. **MAJOR — sprouts read as "+" crosses.** `boostAura` sprouts: a curved stem leaning outward off the club and bending
   up, a low leaf drooping on one side and a high blade reaching up on the other (never a symmetric pair), the ink-edged
   violet bud stays the brightest cluster. Knot lights: charred corners, a breathing void3/void2 ember ring, a 2×2 void4
   heart with a white flicker. `fix-r2/hoEatAttack-sprouts.png`.
9. **MAJOR — static giant.** The receiving loop is a 6-step strain cycle (f3 → f4 haul, the trunk a px back → f3 →
   f2 press, a px in), a breathing gold3 light pool following the hollow, the eye flick + creak on each ghost, and a sap
   PULSE running home along the root every ~0.55 s while the cup waits. Root grow 520 → 400 ms (first ghost earlier).
   measure hoEat2: `special:4@1233 3@1533 2@1717 3@1883 4@2250 …`. (No new rig frames: the sheet is at 127 frames /
   3.58 MB of 3.6.)
10. **MAJOR — root a pipe / over the heron.** `graveRoot` run tapers 4 → 2 px, three tone bands (earth3 lit top /
   earth2 / earth1 shade), a twist seam stepping across it, rootlets on both sides, the sap bulge; the stalk tapers
   3 → 2. The root raster is now on the FLOOR (`DEPTH.SHADOW + 0.7`): bodies stand over it (P2: the heron's neck covers
   it, `fix-r2/hoEat2P2-zoom.png`).
11. minor — guard: `hoBlock` plays ON `v3:contact` (hoGuard `hoBlock@1617` with the shared shieldBlock); the creak
   doubling removed; the chips start at the top of the barred club, above the shared shield, flung away from the
   attacker with a white/gold first beat (brown chips over the brown trunk were invisible). `fix-r2/hoGuard-zoom.png`.
12. minor — direct: new sustained `hoRupture` (brown crack run, fibre ticks, creak, panned toward the duelist) from the
   floor smash, stopped on arrival, + `hoRootBurst` (crack + root tok) on arrival: hoDirect `hoRupture@1333
   hoRootBurst@1483`.
13. minor — summon silent beats: `hoEmber` (f2 hiss), `hoEyes` (f4 two rising toks), `hoCrumble` (f11 chips). SLAM
   debris kept to about one tile: centre pulled 40 % back toward the giant, root star 40 → 32, sprout ring 22 → 16, dust
   wall 16 → 11, fewer leaves — the neighbour's badge stays readable (`fix-r2/hoSummon-slam.png`).
14. minor — process: hoEatDie added; clips rendered (peaks hoEat2 −1.9, hoSummon −1.9, hoEatAttack −1.9, hoEatDie −1.8
   dBFS, 0 clipped samples); stale hoCatch / header comments updated (`knotFlare` was already gone).

### Gates
- monster-gates `--class medium` P1|P2: **21 ok, 0 FAIL** (`gates.txt`, sheets regenerated). `tsc` clean for our files;
  `vitest tests/art/hollow_ogre*` 14/14.
- measure (hoKill, hoEatDie, hoEat2, hoSummon, hoAttack, hoDirect, hoGuard): zoom 1 everywhere, number − contact 0,
  errors 0. Effect k = 2 ≈ 5.9 s total scenario, summon 2.75 s.
- v1 filmdiff (`--set v1 --base shots/v3/a3/baseline/v1films`): **all 17 IDENTICAL**. card-hash not re-run.

### Open issues
- Sameness / blind test still owed (not run this round).
- The contact read against a tall target is better (held f6, daylight, wood-flash) but the hawk's reaction still
  overlaps the club arm for a few frames; a further step would be a rig contact frame with the club more horizontal.
- Struck-wood material sound when the ogre is hit: unchanged (decision 4). Root fingers on the handle: unchanged.
- In the losing strike (hoTrade / hoEatDie) the shared battle claims the attacker on the contact (hitMagic / counter):
  the held f6 applies to wins only.
