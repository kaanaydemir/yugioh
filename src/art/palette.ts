// Master palette for Neon Düello. All art and VFX should draw from these ramps so the
// game reads as one image. Each ramp runs dark (0) → light (4). Colors are 0xRRGGBB.

import type { Attribute } from '../data/cards';
import type { PlayerId } from '../engine/types';

export const PAL = {
  // Outline + night neutrals (the arena, UI panels, shadows)
  ink: 0x07070f, // universal outline / deepest shadow
  night0: 0x0b0d1f,
  night1: 0x12163a,
  night2: 0x1b2352,
  night3: 0x28356f,
  night4: 0x3b4c91,
  steel: 0x6578b4,
  mist: 0xa3b1da,
  white: 0xf4f7ff,

  // Player 1 — cyan
  cyan0: 0x053241,
  cyan1: 0x08627a,
  cyan2: 0x0f9db5,
  cyan3: 0x3fe0ea,
  cyan4: 0xb6fbff,

  // Player 2 — crimson
  crim0: 0x3a0819,
  crim1: 0x761030,
  crim2: 0xbd1f3e,
  crim3: 0xff4d5e,
  crim4: 0xffb6bb,

  // Gold — highlights, monster card frames, ace moments
  gold0: 0x45290a,
  gold1: 0x875611,
  gold2: 0xcf971d,
  gold3: 0xffd447,
  gold4: 0xfff4b5,

  // Magenta — traps
  mag0: 0x370a3b,
  mag1: 0x77197b,
  mag2: 0xc02ec2,
  mag3: 0xff69ef,
  mag4: 0xffc6f8,

  // Teal — spells
  teal0: 0x07342c,
  teal1: 0x0e6453,
  teal2: 0x1da383,
  teal3: 0x4fe2af,
  teal4: 0xc2ffe7,

  // Fire
  fire0: 0x380b05,
  fire1: 0x8a1c09,
  fire2: 0xd83f0e,
  fire3: 0xff8a1e,
  fire4: 0xffda66,

  // Water
  water0: 0x05183d,
  water1: 0x0a387e,
  water2: 0x1365c3,
  water3: 0x3ea2ff,
  water4: 0xa9e1ff,

  // Earth
  earth0: 0x28180c,
  earth1: 0x58381a,
  earth2: 0x8b6131,
  earth3: 0xbe9055,
  earth4: 0xe6cc96,

  // Leaf — plants, wind
  leaf0: 0x0b2911,
  leaf1: 0x1a5823,
  leaf2: 0x2e9839,
  leaf3: 0x6ed759,
  leaf4: 0xc9f7a1,

  // Void — darkness, shadow magic
  void0: 0x130729,
  void1: 0x2d1056,
  void2: 0x59219f,
  void3: 0x914fe6,
  void4: 0xd3b1ff,

  // Stone — rock creatures, ruins
  stone0: 0x1d1c26,
  stone1: 0x393846,
  stone2: 0x5d5c6e,
  stone3: 0x8b8a9c,
  stone4: 0xc4c3d1,

  // Skin / warm neutrals (faces, hands, bone)
  skin0: 0x4a2a24,
  skin1: 0x8a5544,
  skin2: 0xc98a6a,
  skin3: 0xf0bf98,
  skin4: 0xffe6cc,
} as const;

export type PalKey = keyof typeof PAL;

export type Ramp = readonly [number, number, number, number, number];

export const RAMPS = {
  night: [PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4],
  cyan: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4],
  crim: [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4],
  gold: [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4],
  mag: [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4],
  teal: [PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4],
  fire: [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4],
  water: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4],
  earth: [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4],
  leaf: [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4],
  void: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4],
  stone: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4],
  skin: [PAL.skin0, PAL.skin1, PAL.skin2, PAL.skin3, PAL.skin4],
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof RAMPS;

/** Signature ramp per attribute (summon circles, shatter shards, auras). */
export const ATTRIBUTE_RAMP: Record<Attribute, Ramp> = {
  LIGHT: [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4, PAL.white],
  DARK: RAMPS.void,
  FIRE: RAMPS.fire,
  WATER: RAMPS.water,
  EARTH: RAMPS.earth,
  WIND: RAMPS.leaf,
};

/** Accent color per attribute (brightest readable tone). */
export const ATTRIBUTE_COLOR: Record<Attribute, number> = {
  LIGHT: PAL.gold3,
  DARK: PAL.void3,
  FIRE: PAL.fire3,
  WATER: PAL.water3,
  EARTH: PAL.earth3,
  WIND: PAL.leaf3,
};

export const PLAYER_RAMP: Record<PlayerId, Ramp> = { 0: RAMPS.cyan, 1: RAMPS.crim };
export const PLAYER_COLOR: Record<PlayerId, number> = { 0: PAL.cyan3, 1: PAL.crim3 };

export const KIND_RAMP = { monster: RAMPS.gold, spell: RAMPS.teal, trap: RAMPS.mag } as const;

/** '#rrggbb' for Phaser APIs that want CSS strings. */
export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
