# Arena v2 — "floodlit night match" (approved target)

The user generated a concept image from the prompt below and said "yeni hali süper görünüyor".
This is the target for the arena v2 demo. It keeps the ORIGINAL pixel language (see the golden
rules in CLAUDE.md / GAME_DESIGN §0) — the monsters are the existing sprites, unchanged.

Decisions:
- Same resolution (640×360, integer scaling) and the same 2:1 isometric camera (P1 lower-left,
  P2 upper-right) — the Reddit audience liked the camera/composition.
- **Bigger arena (option A):** the board fills more of the screen; monsters must no longer stand
  "dip dibe" (on top of each other): clear space between neighbouring zones, and a WIDE energy
  bridge (2–3 tiles deep) between the two front rows so attacks travel a real distance.
  Deck / graveyard / field pads move to the outer edges. The HUD becomes more compact.
- **Brighter arena:** a night match in a floodlit stadium — light grey / white marble tiles with
  cyan (P1) and crimson (P2) neon inlays; the sky stays night blue but the arena is bright.
- **Golden rules:** rich small living details everywhere; lots of ambient animation; a subtle
  soft light layer over the flat pixel sprites (light pools, glow spilling on the floor, halos).
- v1 (the current arena/layout) stays the default until the user approves v2. v2 is selected with
  `?arena=v2` (or `window.__NEON_ARENA = 'v2'` set before the game boots, used by demo.html).

## The approved concept prompt

```
A game screenshot of an isometric pixel art fantasy card duel game, in the SAME honest retro pixel art style as the original: a 640×360 base resolution upscaled 3× with crisp hard-edged square pixels, no anti-aliasing, 1-px dark outlines, clean flat tone bands with 3–5 tones per material, a limited palette — hand-placed pixels, not an HD or 3D-rendered look.
CAMERA: classic 2:1 isometric orthographic view (no perspective); the player's side at the lower-left, the opponent's side at the upper-right.
ARENA (bigger and brighter): a night match in a brightly floodlit stadium. The duel platform is large and fills most of the screen: big 2:1 isometric tiles of light grey and white marble with crisp cyan neon inlays on the player's half and crimson neon inlays on the opponent's half. Each side has a row of three monster zones and a row of three spell/trap zones with clear empty space between the zones, and a wide energy bridge, two to three tiles deep, separates the two sides so the monsters stand far apart. The deck and graveyard pads sit at the outer edges of the platform. The sky is a deep night blue with stars, but the arena itself is bright: six tall floodlight towers cast soft pools of white light on the marble.
RICH SMALL DETAILS EVERYWHERE: a packed crowd in the stands with tiny waving flags, banners and blinking phone lights; camera drones hovering on the sidelines; cables and small maintenance lights along the platform edge; a scoreboard screen; drifting confetti and dust motes in the floodlight beams; a referee light pylon at each corner.
MONSTERS (lively mid-animation poses, with space between them): on the player's side a white crystal dragon with faceted ice-blue scales and translucent cyan-veined wings, rearing up with wings spread, and a mossy stone knight holding a square shield; on the opponent's side a violet-armored sorcerer hovering with a staff topped by a glowing void orb, and a charcoal wolf with a mane and tail of living flame, crouched to pounce. Small duelists in long coats stand at each end.
SUBTLE LIGHTING over the hand-drawn pixels: the dragon's cyan glow and the wolf's orange firelight spill softly onto the marble around them, and gentle glow halos surround the neon inlays and the void orb — light added as a soft layer, the sprites themselves stay flat and crisp.
UI: compact pixel UI panels with life points in the top-right and bottom-left corners, a phase bar at the top, and a hand of small cards peeking up at the bottom.
16:9, highly detailed, no watermark.
```
