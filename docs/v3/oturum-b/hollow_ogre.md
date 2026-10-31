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
