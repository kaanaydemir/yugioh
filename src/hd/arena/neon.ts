// HD Neon — the first ArenaTheme of the HD trial (docs/STYLE_HD.md §6): the shipped game's night stadium and
// floating neon platform, same camera and composition (current layout ×1.5), rebuilt at 960×540 with much more
// detail, normal-mapped floor (dynamic lights glint on bevels, runes and faceted glass), soft light layers
// (beams, shafts, haze, fog) and an ambient life that runs on the stepped clock.
//
// Layer generators live in ./neon/ (sky, stadium, platform, tiles; raster + geometry helpers), the runtime in
// ./neon/view.ts. Textures are built once per environment pixel size (envPixel 1 = monster density,
// 2 = chunky HD-2D environment pixels) and cached in the game's texture manager.

import type { ArenaBuildOptions, ArenaHandle, ArenaTheme } from '../contracts';
import { NeonArena } from './neon/view';

const neon: ArenaTheme = {
  id: 'neon',
  name: 'Neon Stadyum',
  lighting: {
    // cool navy-lavender ambient: the night lit by the stadium; the owners' side lights paint the rims
    ambient: 0xb4bdf0,
    ambientIntensity: 0.86,
    sideLight: {
      0: { color: 0x3fe0ea, intensity: 1.0, radius: 205 },
      1: { color: 0xff4d5e, intensity: 1.0, radius: 205 },
    },
  },
  build(scene: Phaser.Scene, opts: ArenaBuildOptions): ArenaHandle {
    return new NeonArena(scene, opts);
  },
};

export default neon;
