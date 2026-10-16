// Art Lab — variant A "Sıcak ve Sevimli" (warm & cute, lantern-lit sunset). Colours were sampled
// from the approved reference image and arranged into ramps (dark → light). Shadows lean plum /
// violet, highlights lean cream / gold, so everything sits in one warm sunset light.
//
// This palette is LOCAL to the lab on purpose (the game keeps src/art/palette.ts). A character
// file may add a few extra local colours of its own when a ramp here is not enough.

export const A_INK = {
  /** Default exterior outline — deep warm plum-brown (never pure black). */
  warm: 0x2a1424,
  /** Darkest plum (wizard silhouette, deepest robe folds). */
  plum: 0x1b0a1f,
  /** Deep navy (dragon exterior outline on its cool side). */
  navy: 0x1a2550,
} as const;

export const A_RAMPS = {
  // ---------------------------------------------------------------- dragon
  /** White crystal hide: violet-blue shadow → cream white. */
  dragonHide: [0x3b3f78, 0x6f74a8, 0xa3a6cf, 0xd8d6ea, 0xf6f1ea, 0xfffdf6],
  /** Blue crystal spots / scale clusters on the hide. */
  dragonSpot: [0x1f4f8f, 0x3a7fc0, 0x74b3e8, 0xb8e0fb],
  /** Eye iris. */
  dragonEye: [0x10305f, 0x2b7cd0, 0x7fd0ff, 0xf4fbff],
  /** Ice-blue crystal wing panels. */
  crystal: [0x2a3a8f, 0x4f62c4, 0x7d93e3, 0xa9c2f6, 0xd4e8ff, 0xf4fbff],
  /** Lavender facet tint (wing panels catching the sunset). */
  lavender: [0x3e2f7a, 0x5a4a9e, 0x8f7cd0, 0xbcb0ee, 0xe2dcfa],
  /** Mouth / tongue. */
  mouth: [0x3a1028, 0x5a1e3a, 0xb04a62, 0xe68a8a],

  // ---------------------------------------------------------------- shared metals / bone
  /** Gold (dragon horns, wizard trims and star motifs). */
  gold: [0x5a2c1a, 0x9c5f2c, 0xd08f3c, 0xf2c45e, 0xffe7a0],
  /** Bone / ivory (wizard hat horns, claws). */
  bone: [0x4a2e2a, 0x8a6650, 0xc9a882, 0xeedcb8, 0xfff4dc],

  // ---------------------------------------------------------------- wizard
  /** Robe and hat purple. */
  robe: [0x1e0a24, 0x3a1342, 0x5c1f5e, 0x7e2f7a, 0xa04a92, 0xc46fae],
  /** Magic glow (eyes, orb, runes): deep violet → white-pink. */
  magic: [0x3e0f4d, 0x7d2580, 0xa328a9, 0xd151cc, 0xf09cf5, 0xfff0ff],
  /** The shadow under the hat brim where the face should be. */
  faceShadow: [0x0e0414, 0x1b0a1f, 0x2e1236],
  /** Staff wood. */
  staff: [0x2e1512, 0x5a2e1e, 0x8a4c2c, 0xb87444, 0xdca06a],
  /** Gloves. */
  glove: [0x5a4a6a, 0x8a7a9a, 0xc8bcd4, 0xf2ecf4],

  // ---------------------------------------------------------------- arena
  /** Sunset sky from top (dusk violet) down to the horizon glow. */
  sky: [0x241430, 0x371827, 0x5b3861, 0x853857, 0xa05678, 0xce6d6b, 0xe18262, 0xf2ae79],
  /** Sun and its halo. */
  sun: [0xf2ae79, 0xffc77a, 0xffe2a8, 0xfff6dc],
  /** Cloud sea below the platform. */
  cloud: [0x3b1a2c, 0x4d3548, 0x785d90, 0xa86675, 0xd88884, 0xe5a48b],
  /** Far floating islands — low contrast silhouettes. */
  farIsland: [0x3b2a4a, 0x4e3658, 0x66476c, 0x7a5a84],
  /** Stone pavers of the platform. */
  stone: [0x3a2a30, 0x5a4446, 0x7e6660, 0xa48a76, 0xc8ae92, 0xe2cfb0],
  /** Wood (rims, posts, beams). */
  wood: [0x2e1512, 0x4f2419, 0x7a3a22, 0xa45a30, 0xcf8a4a, 0xe8b46c],
  /** Player side mats (lower-left) — turquoise. */
  turq: [0x10302f, 0x1c4e4e, 0x2e7a74, 0x4fa494, 0x86cdb4, 0xc4ecda],
  /** Opponent side mats (upper-right) — muted coral / terracotta. */
  coral: [0x45182a, 0x6e2a30, 0x9a4038, 0xc25a48, 0xde8a68, 0xf2bc94],
  /** Leaves and vines. */
  leaf: [0x1c2418, 0x2f4220, 0x4a6328, 0x76923a, 0xaec468],
  /** Flower petals. */
  petalWhite: [0xb89aa0, 0xe8d6d0, 0xfff6ea],
  petalPink: [0x8a3050, 0xd86a8e, 0xf2a0b8, 0xffd2dc],
  /** Lantern flame / glass. */
  lantern: [0x6a2410, 0xb04e18, 0xf18d30, 0xf8c060, 0xfff0b8],
  /** Rope. */
  rope: [0x3e2618, 0x6e4a2c, 0xa07a4e, 0xcaa676],
  /** Banner cloth (player teal / opponent red). */
  bannerTeal: [0x0e2e30, 0x1c4e52, 0x2e7476, 0x4f9c98],
  bannerRed: [0x3e1020, 0x6a1c2a, 0x962c34, 0xc44a44],
} as const;

/** Soft light colours (additive light layer). */
export const A_LIGHT = {
  lantern: 0xffb45a,
  magic: 0xc04ad6,
  crystal: 0x9fd8ff,
  sun: 0xffc98a,
} as const;
