# Prism Duel: Steam trailer

`prism_duel_trailer_1080p.mp4`: 58.97 s, 1920×1080, 60 fps, H.264 High (yuv420p, CRF 16, `+faststart`), AAC-LC 320 kb/s
at 48 kHz stereo. The audio is −16.0 LUFS integrated with a true peak of −2.6 dBTP.

Every frame is a real game frame. Each one is rendered at 640×360 by the game itself on the frozen, stepped clock, one
frame per 1/60 s of game time, and blown up exactly 3× with nearest-neighbour scaling (`scale=1920:1080:flags=neighbor`),
so every art pixel is a crisp 3×3 block.
Close-ups use the world camera at an integer 2× zoom, the same kind as the game's own close-ups. The HUD and the cut-in
banners stay on their 1× camera, so they look exactly as they do in play.
The text cards and the end card are rendered in-engine with the game's pixel font, palette and logo
(`src/dev/previews/trailer.ts`). Every sound is one of the game's own synthesized sounds, played at the frame where the
game asked for it.

## Shot list

Bars are on the music grid: the duel track runs at 136 bpm, so 1 bar is 1.7647 s. Every cut lands on a bar line or a
half-bar line.

| Time (s) | Bar | Shot | Source (`?look=v3`; duel scenarios captured `--fresh`) | Capture in-frame |
|---|---|---|---|---|
| 0.00–3.53 | 0 | Cold open: Crystal Wyrm tribute summon, the light pillar and the gold "CRYSTAL WYRM!" cut-in | `?dev=duel&s=suWyrm` | 0 |
| 3.53–7.07 | 2 | PRISM DUEL logo flickers on and ignites (the flash lands on bar 3), then the prism pass. Real title intro, prompt hidden | `?dev=title&sync=1` | 62 |
| 7.07–8.82 | 4 | Text card: EVERY CARD / IS A SHOW | `?dev=trailer&card=0&sync=1` | 0 |
| 8.82–10.58 | 5 | Ashen Drake ash-tornado tribute summon + violet cut-in | `?dev=duel&s=kaAdSummon` | 110 |
| 10.58–12.35 | 6 | Ashen Drake ash-storm breath burns Stone Sentinel (−1900), 2× | `kaAdAtk`, zoom 2 @ (320,140) | 20 |
| 12.35–14.12 | 7 | Dial Jester strike, 2× | `djAttack`, zoom 2 @ (330,145) | 40 |
| 14.12–15.88 | 8 | Judgment Bolt strikes Crystal Wyrm, 2× | `spBoltAce`, zoom 2 @ (340,125) | 30 |
| 15.88–17.65 | 9 | Text card: 80 HAND-CRAFTED / CARDS | `?dev=trailer&card=1&sync=1` | 0 |
| 17.65–19.42 | 10 | Mirror Barrier (Prism Ward) hex dome reflects Ember Wolf, 2× | `tbMirror`, zoom 2 @ (320,125) | 60 |
| 19.42–21.18 | 11 | Dawn Swords: the gilded cage drops, 2× | `eDawn`, zoom 2 @ (340,105) | 40 |
| 21.18–22.93 | 12 | Chains of Light bind Crystal Wyrm, 2× | `sliceChainsWyrm`, zoom 2 @ (320,130) | 90 |
| 22.93–24.70 | 13 | Venom Drake acid mortar on Ember Wolf, 2× | `kaVenomAtk`, zoom 2 @ (310,150) | 30 |
| 24.70–26.47 | 14 | Text card: EVERY MONSTER: / ITS OWN SUMMON, STRIKE AND FALL | `?dev=trailer&card=2&sync=1` | 0 |
| 26.47–28.23 | 15 | Cloud Hatchling coin call ("TAILS!") + growth, 2× | `kaChGrow`, zoom 2 @ (320,140) | 150 |
| 28.23–30.00 | 16 | Shield Titan rampart: −1200 back at Shade Assassin, 2× | `kdWall`, zoom 2 @ (380,135) | 100 |
| 30.00–31.77 | 17 | Windmane Knight storm charge cut-in | `fsStormAtk` | 180 |
| 31.77–33.53 | 18 | Polar Sovereign shatters Crystal Wyrm into crystal shards, 2× | `psTrade`, zoom 2 @ (300,130) | 110 |
| 33.53–35.30 | 19 | Text card: DUEL A FRIEND ON ONE SCREEN / OR THE CPU | `?dev=trailer&card=3&sync=1` | 0 |
| 35.30–40.58 | 20 | Readable turn with full HUD on a busy 5+5 board: Reed Heron summon, battle phase, Crystal Wyrm's beam kills Kite Fencer, LP 3100 → 1200 | `?dev=trailer&s=trBoard` (new staged scenario) | 0 |
| 40.58–42.35 | 23 | Polar Sovereign fusion (three Polar parts fuse), 2× | `b2FusionAuto`, zoom 2 @ (288,150) | 110 |
| 42.35–46.77 | 24 | Climax, on the bar-24 crash: Void Eye opens over the board, every monster rises and is swallowed | `b2WipeAuto` | 40 |
| 46.77–48.53 | 26.5 | Crystal Wyrm vs Ashen Drake: the breath duel and the drake's fall, 2× | `?dev=steam&s=stWyrmHitsDrake`, zoom 2 @ (310,130) | 20 |
| 48.53–49.42 | 27.5 | Rapid cut: Kite Fencer lunge, 2× | `kfnAttack` | 25 |
| 49.42–50.30 | 28 | Rapid cut: Ashen Drake vs Magma Titan, 2× | `kaAdAtkTitan` | 85 |
| 50.30–51.18 | 28.5 | Rapid cut: Tide Harpooner strike (−1200), 2× | `thpAttack` | 50 |
| 51.18–52.07 | 29 | Rapid cut: Crag Axeman strike (−1000), 2× | `caxAttack` | 95 |
| 52.07–52.93 | 29.5 | Rapid cut: Steppe Spiralhorn strike, 2× | `sshAttack` | 140 |
| 52.93–58.97 | 30 | End card: lit logo with a glitch and a prism glint. On the bar-32 downbeat (56.48 s) "WISHLIST NOW ON STEAM" slams in with a logo flash, a prism pass and the victory sting; "COMING SOON" follows. Hold to the end | `?dev=trailer&card=end&sync=1` | 0 |

Transitions are hard cuts. Four cuts get a 2–3 frame flat white flash: into the logo, the board turn, the Void Eye and
the end card.

## Audio

- **SFX are the game's real sounds, in sync.** While a shot is captured, `capture.mjs` hooks the sound contract
  (`sfx.play`, `sfx.start` and its `stop()`, `sfx.hush`, `sfx.fade` from `src/audio/sfx.ts`). Each requested sound is
  logged with its game frame instead of being played. `build/cache/<shot>/sfx.json` holds the log, and
  `build/cache/cues.json` holds every cue at its timeline time.
- **Offline render.** `audio.mjs` drives `src/dev/trailer-audio.ts` in headless Chromium. That module rebuilds every cue
  from its recipe (`src/audio/sounds.ts`) with the same voice code as `sfx.ts`, including pan, pitch variance, the
  per-sound rate limit and voice cap, `start` handles fading on their stop frame, and `fade`. It renders them in an
  `OfflineAudioContext` through the game's own master chain (`buildChain`: glue compressor, stadium reverb, limiter and
  v3 ceiling).
- **Gating.** Each shot's sounds pass through a gate that opens on the shot's first frame and closes 60 ms after its cut,
  so the sound cuts with the picture while the shared reverb rings on.
- **Sync offset.** Cues are placed 1 frame after the frame that logged them. The game draws the effect of an update on
  the next frame: the Ashen Drake ignition cue is logged on frame 60, and its burst is first drawn on frame 61.
- **Music.** The game's duel track (`src/audio/music.ts`, E minor, 136 bpm), scheduled from its top on the same chain,
  with the live ducking from the big sounds. Its intensity plan:
  - Bars 0–3: the cool groove under the cold open and the logo.
  - Bar 3¾: a drum fill into bar 4, where the hot layer (lead, gallop bass, extra kit) starts with the montage.
  - Bar 16: section B lands on the Shield Titan shot.
  - Bars 20–22: the board turn breathes at intensity 0.35.
  - Bar 22¾: a fill into the climax. The bar-24 crash hits on the Void Eye cut, and the late-B doubled lead carries the
    rapid cuts and the end card.

  The music stops on the downbeat of bar 32: the loop's first step (kick, crash, Em pad) is the final hit, together
  with the victory sting and impact of the end card.
- **Music bus automation.** Gain 0.36 under the cold open, 0.5 under the logo, 0.56 for the montage, 0.46 for the board
  turn, then 0.62–0.66 for the climax and the end.
- **Mastering** (`master.sh`). Two-pass EBU R128 loudnorm in linear mode, targeting −16 LUFS with a −2.2 dBTP ceiling.
  The result is −16.0 LUFS integrated, LRA 4.8 LU, and a true peak of −2.6 dBTP after the AAC 320k encode. A 256k AAC
  encode overshot to −0.7 dBTP, so 320k is used.

## Rebuild

```
bash marketing/trailer/build/build.sh            # ≈ 15–20 min on 4 cores
```

The build runs four steps:

1. `capture.mjs`: films each shot of `shots.mjs` (the edit decision list: query, in-frame, bars, zoom, setup and
   `at` hooks) into `build/cache/<shot>/fNNNNN.png` with an `sfx.json` log. `--only a,b` recaptures some shots, and
   `--survey K --shots ./other.mjs` keeps every K-th frame for scouting.
2. `audio.mjs`: renders `build/cache/soundtrack_raw.wav`. `STEM=music` or `STEM=sfx` renders one side alone, for level
   checks.
3. `master.sh`: produces `build/cache/soundtrack.wav`.
4. `assemble.py`: cuts the frames into the edit at `build/cache/timeline/`, adds the flashes, and encodes the mp4.
   `--frames` only builds the timeline.

`sheet.py <dir>` and `multisheet.py` make labelled contact sheets of captured frames. `build/cache/` is gitignored
(about 390 MB of frames).

Dev-only code: `src/dev/previews/trailer.ts` (the text cards, the end card and the `trBoard` scenario) and
`src/dev/trailer-audio.ts` (the offline mix). No gameplay code was changed.

## Known limits

- The music is the game's own duel track at 136 bpm, not a separate trailer cue, so "cuts on beats" means cuts on its
  bar and half-bar lines.
- Montage moments are 1.76 s windows of longer animations. A few, the Dial Jester and the Cloud Hatchling, show the
  middle of their move rather than a clean start-to-impact.
- The board shot shows the game's English hint bar ("Choose a card, or go to BATTLE"). It is real UI, kept on purpose.
