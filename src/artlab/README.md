# Art Lab (`?dev=art-lab`)

An isolated sandbox for choosing the drawing and animation quality of the two lab monsters (a
crystal dragon and a purple wizard) in a ~15 s scripted battle. Nothing in the game imports
`src/artlab`, and the lab registers nothing with the game (no `MonsterArt`, no boot step).

Three variants are ready and switchable in the page (V / "Varyant" menu): **A — Sıcak ve Sevimli**
(`src/artlab/variant-a`, cute chibi pair), **B — Sıcak ama Heybetli** (`src/artlab/variant-b`,
majestic proportions in A's world; see [Variant B](#variant-b)) and **C — Orijinal Neon, Yüksek
Detay** (`src/artlab/variant-c`, the original game's neon arena and monsters redrawn with A's craft;
see [Variant C](#variant-c)). D is listed as "(yakında)".

Open it with the dev server: `npm run dev` → `http://localhost:5173/?dev=art-lab`

The preview (`src/dev/previews/art-lab.ts`) imports the lab lazily, so the production build keeps
`src/artlab` in its own chunks (`lab-*.js`, `variants-*.js`), out of the game's main chunk.

## Controls (bottom bar, Turkish)

| Button | Key | Action |
| --- | --- | --- |
| Oynat / Duraklat | Space | play / pause (at the end: start again) |
| Baştan | R | restart from 0 (no effect, particle or timer of the previous run survives) |
| 0,5× / 1× | 1 / 2 | speed (animations, effects and the battle script together) |
| Yakınlaştır: Kapalı / Ejder / Büyücü | Z | inspection zoom 2× (integer) on the dragon / wizard; every pose of that actor fits the view (see Cameras) |
| Efekt: Açık / Kapalı | F | all effects, the soft light layer (incl. the actors' idle halos), camera shake and the arena's ambient fx off (bare drawing; the characters keep their own poses, incl. the death erosion, and their contact shadows) |
| Varyant: A / B / C | V | variant menu (A, B and C ready, D listed as "(yakında)"; the box is as wide as its longest label); V cycles the ready variants A → B → C → A (rebuilds everything, back to t = 0) — with a single ready variant V just opens / closes the menu; picking the variant already shown does nothing (no silent restart) |
| — | H | hide / show the bar |
| — | , / . | step one 1/60 s frame back / forward while paused |
| — | Esc | close the variant menu |

At the end the last state holds and "Bitti — Baştan için R" is shown (or `&loop=1` restarts).

## Query parameters

```
?dev=art-lab [&variant=A] [&t=MS] [&paused=1] [&speed=0.5|1] [&zoom=dragon|wizard] [&fx=0] [&ui=0]
             [&stage=static|idle] [&pose=dragon:attack:6,wizard:idle:0] [&loop=1] [&live=1]
```

- `t` seek on start, `paused=1` start paused, `ui=0` hide the bar (and the end message).
- `variant=A|B|C`. `variant=D` (listed but not ready) or an unknown id falls back to the first ready
  variant and says so at the top for 4 s of lab time (or until the variant menu opens): "Varyant D
  henüz hazır değil — A gösteriliyor" (also a console warning; `__artlab.notice` holds the text).
- `stage=static`: both monsters frozen in idle frame 0, no battle, no effects (the arena still
  lives). `pose=who:anim:frame,...` freezes chosen poses (implies `stage=static`; unknown anims
  fall back to idle 0). `stage=idle`: both monsters loop their idle, no battle.
- Under the screenshot tool (`tools/shot.mjs` adds `?test`) the lab clock advances ONLY inside
  `window.__neon.step()`, so `--step` / `--film` captures are exactly reproducible. A plain shot
  without `--step` therefore shows `&t=` (default 0). Add `&live=1` to run in real time there.
- `__neon.step(ms)` runs whole 1/60 s frames; frame k of a step shows `t0 + speed·min(ms, k/60 s)`
  (an absolute time from the step's origin, no running sum) and the step's last frame shows exactly
  `t0 + speed·ms`, so the canvas the step leaves behind IS the settled time (if a step ever ran a
  different number of frames, the lab draws once more). Film labels (`start + i·every`) are the lab
  time for ANY `--every`, stepping N ms equals `seek(N)` pixel for pixel (t is quantized to
  1e-6 ms), and a 0.5× capture equals the 1× capture at the same t. After `seek()` from `--eval`
  with the loop frozen, step once more (`__neon.step(17)` while paused) so the canvas redraws.
- Keys pressed back to back with the loop frozen act once each (`,` `,` steps exactly 2 frames back,
  with no step needed in between). Phaser replays its pending key queue on every DOM key event
  until the next game step, so the lab ignores a keydown event object it has already handled.

```
node tools/shot.mjs "?dev=art-lab&ui=0" --out shots/artlab/x.png --scale 2 --step 3000
node tools/shot.mjs "?dev=art-lab&ui=0" --film 12 --every 250 --start 4000 --cols 4 --scale 2 --out shots/artlab/f.png
node tools/shot.mjs "?dev=art-lab&t=6200&paused=1" --out shots/artlab/y.png
node tools/shot.mjs "?dev=art-lab&pose=dragon:attack:6,wizard:hit:1" --out shots/artlab/p.png --clip 160,80,320,180 --scale 3
```

`window.__artlab`: `t`, `duration`, `playing`, `speed`, `zoom`, `fx`, `variant`, `beats`, `notice`,
`seek(ms)`, `play()`, `pause()`, `restart()`, `setSpeed(k)`, `setZoom('off'|'dragon'|'wizard')`,
`setFx(on)`, `setVariant(id)`, `stepFrames(n)`, `setUi(on)`, `press(buttonId)`, `buttons()`,
`stats()` → `{ t, displayObjects, fxObjects, activeEffects, lights, particles, halos, tweens, timers, effects }`
(`lights` = effect lights alive, `halos` = actor idle halos shown).

## How it works (src/artlab/core)

- **One clock** (`lab.ts`): `t` advances in the scene update by `min(delta, 50) × speed` while
  playing. Nothing that moves uses Phaser tweens, scene timers, `setTimeout` or promises; the
  world is rendered every frame as a pure function of `t`. Pause = stop advancing, speed = scale
  dt, restart = `seek(0)`, seek works anywhere.
- **Battle script** (`battle.ts`): variant-independent, computed from the art's frame holds and
  marks, in *action time*. Hit-stops are a time remap (`time.ts`): during a stop action time
  holds (actors and action-clocked effects freeze on the impact frame) while lab time runs on
  (shake, impact light). Beats: summons (dragon, wizard +0.8 s; `land`) → idle 1.7 s → wizard
  `attack` (`charge` → `release`) → bolt (440 ms) along the arc whose first solid contact lies
  deepest in the body, grazes nothing on the way in and stays within 6 px of the dragon's strike
  height (its chest) → dragon `hit` placed so its `impact` frame lands on the impact (80 ms stop,
  ≤2 px shake) → recovery → +0.6 s dragon `attack`: breath from the start of frame `fire` to the
  start of frame `fireEnd`, aimed so its first solid contact lands at the target's strike height
  (its `chest` point if the art has one, else 60 % of the way from `core` up to `head` — the upper
  body, where the hit reaction knocks the head back), the first shard arriving 256 ms after
  `fire` → wizard `hit` with `impact` on the first contact (70 ms stop) → `death` (`dissolve`) →
  dragon `victory` → idle hold to ≥15 s. Contact geometry decides WHERE a projectile strikes,
  never WHEN: both flight times are fixed (A's values), the effects derive their speed from the
  distance, so the timeline depends only on the anims' totals and mark times.
- **Actors** (`actors.ts`): each `LabMonsterArt` is baked into one sheet (`artlab:<V>:<id>`,
  frames `anim:i`), shown by one Image at integer positions (anchor on the slot; the wizard is
  mirrored around its anchor column). Hidden before its summon; the wizard hides after `death`.
  - **Contact shadow** (always on — part of the scene, not an effect): a flat two-band ellipse in
    the variant's shadow ink (`FX_A.shadow` = `A_INK.plum`, an optional `LabFxExtra` field; else
    the darkest effect colour), baked at 4 sizes, spanning the idle pose's footprint, drawn below
    the actors (`FLOOR_FX - 2`), plus a 1-px occlusion line (`FLOOR_FX - 1`) under every column of
    the current frame that touches the ground. Per frame the lowest opaque row vs the FLOOR row
    gives the lift: lifted poses (summon float, victory hop) swap to a smaller baked size and
    fade; the opaque mass vs the idle pose fades it during the summon rise and the death erosion.
    The floor row is the idle pose's lowest row plus the art's `hover`: a walker (hover 0, all of
    A and B) stands on it; a floating body (C's magus, hover 6) casts its shadow on the floor 6 px
    below its hem, lifted by those 6 px (the 0.68 size, ×0.84 alpha, no occlusion line) — until a
    pose comes down to the floor (its collapse in `death`).
  - **Emissive halos** (light layer, hidden with effects off): baked additive glows on what glows
    in the drawing — the wizard's orb (r 12, magic light, 0.35) and eyes (r 5, 0.25), the dragon's
    crystal wings (r 16, crystal light, 0.12). Position = centroid of the emissive pixels near
    the frame's `orb`/`muzzle` and `eyes` points (wings: all crystal-ramp pixels), strength = their
    count vs the median idle frame (closed eyes, a dropped orb or erosion dim them by themselves),
    times a gentle pulse over the idle cycle. Integer positions, alpha only, never scaled.
- **Effects** (`fx-manager.ts`, `fx-effects.ts`, `fx-textures.ts`): each effect is a window +
  factory; the manager keeps exactly the effects whose window contains `t` alive (created
  lazily, destroyed when outside), so a restart or seek leaves nothing stale. Particles are
  analytic (mulberry32 parameters, `p0 + v·τ + ½·g·τ²`), sprites are baked PixelCanvas strips in
  the variant's `LabFxSettings` ramps, lights are white glows baked at the sizes used, tinted,
  ADD, intensity via alpha only. Lights on a struck body stay small and short (r 16, peak 0.18,
  gone in 180 ms) so the tone bands of the sprite survive. The bolt impact is a 4-ray star (two
  frames, 110 ms) and only THEN a shock ring broken into 5 short arcs that steps down in colour and
  alpha for 150 ms and skips every pixel on the struck body (no reticle over the chest). The breath
  leaves the mouth 4 px in front of the muzzle point along the aim (further out until it is off
  the drawing); its frost puff is drawn per pixel and skips the dragon's own pixels, its muzzle
  light peaks at 0.12, and a shard sprite shows only once neither its head nor its tail lies on
  the dragon — the open jaws, teeth, tongue and throat glow stay readable on every fire frame. The
  frost burst keeps its rings, fragments and twinkles off the wizard's silhouette and ends 300 ms
  after the last shard lands.
  The wizard's dissolve particles are its own vanishing pixels: for each death frame from
  `dissolve - 1` on, BODY pixels (≥2 opaque 4-neighbours — the art's own drawn motes are left to
  the drawing) in frame k missing from frame k+1 (after removing a whole-body shift ≤2 px), one in
  five by a fixed hash, start drifting exactly when they vanish: up and a little outward from the
  body axis like the drawn motes, stepping down the magic ramp at full alpha, gone within 480 ms.
  The victory hop dust uses `victory.marks.land` if present, else the frame whose lowest pixel
  returns to the ground.
- **Cameras** (`camera.ts`): world camera zoom 1 or 2, integer scroll clamped to the world,
  integer shake within a SCREEN budget of 2 px (±2 world px at zoom 1, ±1 world px = 2 screen px
  in the 2× inspection zoom); a UI camera (zoom 1) draws the bar. Objects made inside `uiBuild()` are UI,
  everything else (even lazily created effects) is world.
  The zoom target (`LabActor.focus()`) is the centre of the idle-f0 bounding box, moved only as
  far as needed for the union of EVERY baked frame of that actor to fit the 2× window (320×180
  world px; the bottom 9 world rows sit under the bar) with 2 px to spare on each side, so no pose
  is cut by the zoom, e.g. B's victory rear-up, which reaches 97 px above its idle centre. On an
  axis where the union cannot fit, the idle centre stays. A's poses all fit around their idle
  centres, so A's focus is unchanged. B's dragon view sits 9 px higher (frame y 101 → 92). B's
  wizard view sits 2 px lower (80 → 82), for the staff that lies on the floor in its death. C's
  views are centred on (237, 156) and (403, 90); the magus' view is clamped to the top of the world
  (its idle centre lies above y 90) and every pose of both C actors fits with ≥ 20 px to spare.

## Variant B

`?dev=art-lab&variant=B` (or V / the "Varyant" menu on any page). B — **Sıcak ama Heybetli** keeps
A's warm lantern-lit sunset world and pixel language and changes only the two characters: a noble
crystal dragon (small wedge head on a long S-neck, deep plated chest with an ice-blue keel, strong
legs and talons, boned wings with gold-edged membranes) and a tall hooded sorcerer (layered purple
robe, broad gold-edged pauldrons, a gloved hand on a tall orb staff).

- **Files**: `variant-b/index.ts` assembles the variant from A's arena (`buildArenaA`), A's effect
  palette (`FX_A`, incl. the contact-shadow ink) and A's background colour, so the arena, camera,
  light direction, UI and effects are exactly A's. The art is `variant-b/dragon.ts` (+ `dragon-rig.ts`,
  `dragon-head.ts`; id `b_dragon`) and `variant-b/wizard.ts` (+ `wizard-rig.ts`, `wizard-maps.ts`;
  id `b_wizard`), drawn in A's warm ramps (`variant-a/palette.ts`, imported read-only). Textures are
  `artlab:B:b_dragon` / `artlab:B:b_wizard` (the shared arena keeps its `artlab:A:*` keys).
- **Same battle timing**: the battle script is computed from the art, so B's anims have exactly
  A's totals and mark start times (frame counts and holds differ):

  | anim | total | marks (start ms) |
  | --- | --- | --- |
  | dragon summon / idle / hit / attack / victory | 1545 / 1680 loop / 900 / 1580 / 1820 | land 755 · impact 50, recover 330 · fire 610, fireEnd 1000 · (B: land 1120) |
  | wizard summon / idle / attack / hit / death | 1320 / 1580 loop / 1520 / 610 / 1810 | land 950 · charge 210, release 760 · impact 40 · dissolve 810 |

  The whole timeline is identical to A's (`__artlab.beats`, tracks, hit-stops and shakes; both
  battles last 15 241 ms): the bolt flies 440 ms and the breath's first shard 256 ms in every
  variant, whatever the contact distance (B's taller wizard puts the breath contact a few px
  further away; its shards just fly that much faster). Only the WHERE beats differ: `boltArc`
  (A −18 px, B −26 px — see below), `breathAimDy` and `breathStrikeY`. B's victory is a rear-up
  with the forefeet coming down at its `land` mark (1120 ms), which places the hop dust (A's hop
  is detected from its drawing, 360 ms).
- **Contact geometry on B's silhouettes**: B's dragon holds its head high on a long neck that
  stands between the wizard's orb and its core, so every flatter bolt arc met the skull first (the
  impact burst landed on the eye of the recoiled head). `BOLT_ARCS` in `core/battle.ts` gained
  deeper sags (−26…−50) and the arc score a strike band: a contact more than 6 px above or below
  the dragon's `chest` point loses 0.02 per px, so the skull above and the forelegs below lose and
  the best arc lies inside the list (B −26 with the final dragon art: under the jaw onto the front of
  the plated keel; the deeper −46 would reach further in but strikes the foreleg). A still picks −18 (its contact is
  4 px above its chest, inside the band, so its score is unchanged) and stays pixel-identical. The breath meets B's wizard at its
  upper-body strike height, on the forearm and cuff of the staff hand thrown forward by the hit
  (like A's staff glove); the frost burst stays off the silhouette, the dissolve particles come from
  B's own eroding pixels, the summon circles are sized from B's idle footprints.
- **Switching** A ↔ B rebuilds the world and restarts the battle at t = 0 with nothing left over
  (no effect, light, texture or object of the other variant; `stats()` equals a fresh load).
  Speed, zoom target, effects and the bar's visibility are kept; a paused battle stays paused (at
  t = 0), a playing one plays on, an ended one starts playing. The picture equals a fresh load of
  that variant at the same t, pixel for pixel.
- **Check B's art in Node**:
  `npx vite-node tools/artlab-sheet.ts src/artlab/variant-b/dragon.ts --marks --scale 3` (and
  `wizard.ts`), or in the lab `&variant=B&pose=dragon:attack:5,wizard:hit:1`, `&zoom=dragon|wizard`,
  `&fx=0` (bare drawing).

## Variant C

`?dev=art-lab&variant=C` (or V / the "Varyant" menu on any page). C — **Orijinal Neon, Yüksek Detay**
tests the remark that the ORIGINAL Neon Düello (its neon night arena, the version players liked) is
still the best overall but low on pixel detail: the original world and the original monster
identities, drawn with A's craft (own ramps, selective outlines, hand-authored faces / helm / hands,
deliberate clusters, per-frame holds, drawn squash and lean, no scaling) at about 40 % more pixels.

- **Files**: `variant-c/index.ts` assembles the variant. Arena: `arena.ts` (+ `arena-board.ts`,
  `arena-geo.ts`; `buildArenaC`, `BACKGROUND_C` = `PAL.ink`) — the v1 night stadium (sky, aurora,
  stars, stands, roof rim, crowd lights, LED ribbon, light towers, fog, under-glow, core beam) read
  from the game's own `src/art/arena.ts` textures (read-only, `buildArenaTextures()` is idempotent;
  they belong to the game and stay after a switch), around a v1 board drawn here in the exact v1
  style and stretched along the duel axis: 5 × 8 tiles of 64 × 32, the dragon on P1's cyan monster
  row at (240, 210), the magus on P2's crimson row at (400, 130), 179 px apart, with the two-row
  energy bridge between them. Effects: `fx.ts` (`FX_C`: the game's void / magenta magic, the cyan
  prism glass, gold sparks, night-ramp dust, cyan / crimson summon circles, contact shadows in
  `PAL.ink`). Art: `dragon.ts` (+ `dragon-rig.ts`, `dragon-head.ts`, `dragon-palette.ts`; id
  `c_dragon`, the crystal wyrm) and `wizard.ts` (+ `wizard-rig.ts`, `wizard-maps.ts`; id `c_wizard`,
  the floating abyss magus), both in ramps derived from `PAL` / `RAMPS` (more steps, no foreign hue).
  Textures: `artlab:C:c_dragon`, `artlab:C:c_wizard`, `artlab:C:arena:*`, `artlab:C:fx:*`.
- **Pixel budget** (idle frame 0, from the sheet tool): dragon frame 134 × 128, bbox 103 × 108,
  4801 opaque px (original crystal wyrm 85 × 91, 3404 px: +41 %), 20 colours; magus frame
  119 × 121, hover 6, bbox 62 × 82, 2908 px incl. the staff (original 54 × 71, 2094 px: +39 %),
  24 colours.
- **Same battle timing**: C's anims have exactly A's totals and mark start times (frame counts
  differ: dragon summon 18 / idle 14 / hit 9 / attack 13 / victory 13 frames, magus summon 15 /
  idle 12 / attack 14 / hit 6 / death 17), so every timing beat of `__artlab.beats` equals A's and
  B's (15 241 ms). Only the WHERE beats differ, from C's own slots and silhouettes:

  | beat | A | B | C |
  | --- | --- | --- | --- |
  | `boltArc` (px) | −18 | −26 | −6 |
  | `breathAimDy` (px) | −34 | −40 | −34 |
  | `breathStrikeY` (world y) | 115 | 80 | 66 |

  The bolt flies from the orb (343, 98) along a shallow sag into the front of the wyrm's chest under
  the neck root, contact (254, 160), 1 px from the chest point's height. The breath's first contact
  is (375, 66) at the magus' strike height — on the staff head (the orb's collar), which the magus
  holds upright in front of its visor in the pose before the hit; see the known issue below. C's
  victory is a planted rear-up roar with no hop, so it has no hop dust (no `land` mark).
- **Floating magus**: C is the first art with `hover` > 0; its contact shadow lies on the floor 6 px
  below the hem (see Contact shadow above), smaller and fainter, and comes back to full size when
  the collapse of `death` reaches the floor. The emissive halos find the visor and orb in the top
  three magic tones and the wings in the cyan glass ramp (3 halos in idle, like A and B).
- **Switching** A → B → C → A (V) or from the menu rebuilds everything at t = 0: `stats()` and the
  picture equal a fresh load of the target, from playing, paused, ended, zoomed, effects-off and
  0.5× states and after rapid A → B → C → A → C switches (C's 149 `artlab:C:*` textures and its
  226 display objects at t = 0 go when another variant is built; A and B have 70 / 112).
- **Known issue (breath contact)**: in the magus' pre-hit pose (`hit` 0, 40 ms) the staff shaft
  (4–5 px wide with its outline) and the orb stand between the breath and the chest at every aim
  that reaches the strike height, so the frost burst lands on the staff head ~17 px in front of
  the pauldron of the impact pose (which leans back and throws the staff up through that point):
  it reads as the breath striking the staff, not the magus. Fixing it is an art change (e.g. the
  staff pulled aside in `hit` 0 / brought forward with the hand in `hit` 1, like B's cuff) — the
  core geometry is A's and B's and was left unchanged.
- **Check C's art in Node**:
  `npx vite-node tools/artlab-sheet.ts src/artlab/variant-c/dragon.ts --marks --scale 3 --bg '#12163a'`
  (and `wizard.ts`; dark neon backgrounds), or in the lab `&variant=C&pose=dragon:attack:5,wizard:hit:1`,
  `&zoom=dragon|wizard`, `&fx=0` (bare drawing). The original sprites for comparison:
  `?dev=monster&id=crystal_wyrm&mode=board` and `?dev=monster&id=abyss_magus&mode=board`.

## Adding another variant (D)

1. Create `src/artlab/variant-d/` with its `dragon.ts` (`LabMonsterArt<DragonAnim>`), `wizard.ts`
   (`LabMonsterArt<WizardAnim>`) and `index.ts` (default `ArtVariant` with `id: 'D'`); add a
   `palette.ts`, `arena.ts` (`buildArenaD(scene): LabArena`) and `fx.ts` (`LabFxSettings`) if it
   does not reuse another variant's like B does (C brings its own, see above). Same contracts as A
   (`src/artlab/types.ts`), same anim names, marks and points (`core`, `muzzle`, dragon
   `eye`/`head`/`chest`, wizard `orb`/`head`/`eyes`) — the battle script, effects, camera and
   controls are reused unchanged. Keep A's anim totals and mark times if the battle timing must
   stay comparable. A floating art sets `hover` (its contact shadow then lies on the floor below).
2. In `src/artlab/variants.ts` import it and set `load: () => variantD` on the D entry.
3. Check with `?dev=art-lab&variant=D` and `npx vite-node tools/artlab-sheet.ts src/artlab/variant-d/dragon.ts`.
