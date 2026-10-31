// Light profiles: how each attribute lights the marble under a monster, and which pixels of each
// monster sprite count as "emissive" (they drive the halo behind the sprite and make the floor
// pool breathe with the animation — the wolf's flames flare, the magus' orb pulses).

import type { Attribute, MonsterId } from '../../data/cards';
import { PAL } from '../../art/palette';
import { v3Recipe } from '../../presentation/registry';

/** Built-in motion of a light: how its intensity / shape lives over time. */
export type LightAnim = 'steady' | 'shimmer' | 'breathe' | 'flicker' | 'caustic' | 'sway';

export interface AttributeLight {
  /** Pool (core) colour — the light right under the monster. */
  color: number;
  /** Spill colour — the wide, faint outer wash. */
  spill: number;
  /** Relative strength (1 = baseline). */
  gain: number;
  anim: LightAnim;
}

/**
 * Golden-rule colour language (GAME_DESIGN §5.5): IŞIK gold-white, KARANLIK violet, ATEŞ orange
 * (slow flicker), SU blue (caustic shimmer), TOPRAK warm amber, RÜZGAR green.
 */
export const ATTRIBUTE_LIGHT: Record<Attribute, AttributeLight> = {
  LIGHT: { color: PAL.gold4, spill: PAL.gold3, gain: 1, anim: 'shimmer' },
  DARK: { color: PAL.void3, spill: PAL.void2, gain: 1.1, anim: 'breathe' },
  FIRE: { color: PAL.fire3, spill: PAL.fire2, gain: 1.05, anim: 'flicker' },
  WATER: { color: PAL.water3, spill: PAL.water2, gain: 1.15, anim: 'caustic' },
  EARTH: { color: PAL.gold2, spill: PAL.earth3, gain: 0.85, anim: 'steady' },
  WIND: { color: PAL.leaf3, spill: PAL.leaf2, gain: 0.9, anim: 'sway' },
};

export interface MonsterGlow {
  /** Emissive colours → weight (1 = fully glowing, 0.3 = faint). */
  emissive: [number, number][];
  /** Halo strength behind the sprite (alpha, before the global light gain). */
  halo: number;
  /** Floor pool strength multiplier. */
  pool: number;
  /** Optional spill colour override (default: the attribute's spill). */
  spill?: number;
  /**
   * Colours that glow only NEAR a fully emissive pixel (within 3 px): the body of a lit part
   * whose highlight is emissive (the magus' void orb is void3 around a white glint, but its
   * armour is void3 too).
   */
  near?: [number, number][];
}

const T = (c: number, w: number): [number, number] => [c, w];

/**
 * Per-monster emissive pixels. Picked by hand from the sprites' palettes (body colours that only
 * look bright — the wyrm's white crystal body, the magus' violet armour — are left out so the
 * halo hugs the parts that really glow: veins, orb, lava, flames, core gems, eyes).
 */
export const MONSTER_GLOW: Record<MonsterId, MonsterGlow> = {
  crystal_wyrm: { emissive: [T(PAL.cyan4, 1), T(PAL.cyan3, 0.65), T(PAL.gold4, 1), T(PAL.gold3, 0.6)], halo: 0.7, pool: 1.1, spill: PAL.cyan3 },
  abyss_magus: { emissive: [T(PAL.void4, 1), T(PAL.white, 1), T(PAL.mag4, 1), T(PAL.mag3, 0.9), T(PAL.mag2, 0.4)], near: [T(PAL.void3, 0.9)], halo: 1, pool: 1 },
  magma_titan: { emissive: [T(PAL.fire4, 1), T(PAL.fire3, 0.8), T(PAL.fire2, 0.35), T(PAL.gold4, 1)], halo: 0.75, pool: 1.15 },
  coral_serpent: { emissive: [T(PAL.water4, 0.7), T(PAL.white, 1), T(PAL.cyan4, 1), T(PAL.mag4, 0.45), T(PAL.water3, 0.15)], halo: 0.6, pool: 0.95 },
  ember_wolf: { emissive: [T(PAL.fire4, 1), T(PAL.fire3, 0.85), T(PAL.fire2, 0.3), T(PAL.gold4, 1), T(PAL.gold3, 0.8), T(PAL.white, 1)], halo: 0.85, pool: 1.15 },
  tide_golem: { emissive: [T(PAL.cyan4, 1), T(PAL.white, 1), T(PAL.cyan3, 0.8), T(PAL.water4, 0.5)], halo: 0.75, pool: 1 },
  storm_hawk: { emissive: [T(PAL.teal4, 1), T(PAL.teal3, 0.55), T(PAL.white, 0.9), T(PAL.leaf4, 1), T(PAL.gold3, 0.4)], halo: 0.6, pool: 0.85 },
  stone_sentinel: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.8), T(PAL.leaf3, 0.35), T(PAL.leaf4, 0.6)], halo: 0.55, pool: 0.85 },
  lumen_sprite: { emissive: [T(PAL.gold4, 1), T(PAL.white, 1), T(PAL.gold3, 0.7), T(PAL.gold2, 0.25), T(PAL.skin4, 0.4)], halo: 0.85, pool: 1.2 },
  shade_assassin: { emissive: [T(PAL.crim4, 1), T(PAL.crim3, 0.8), T(PAL.void4, 1), T(PAL.white, 0.6), T(PAL.void3, 0.2)], halo: 0.65, pool: 0.8 },
  volt_lizard: { emissive: [T(PAL.white, 1), T(PAL.cyan4, 1), T(PAL.cyan3, 0.8), T(PAL.gold4, 0.45)], halo: 0.7, pool: 1 },
  thorn_lurker: { emissive: [T(PAL.mag3, 0.7), T(PAL.mag4, 1), T(PAL.white, 0.5), T(PAL.leaf4, 1), T(PAL.gold4, 1), T(PAL.leaf3, 0.15)], halo: 0.55, pool: 0.85 },
  // expanded roster, batch 1 (attribute-coloured placeholder glow)
  dusk_sorcerer: { emissive: [T(PAL.void4, 1), T(PAL.mag4, 1), T(PAL.white, 0.8), T(PAL.void3, 0.4)], halo: 0.6, pool: 0.9 },
  ashen_drake: { emissive: [T(PAL.void4, 1), T(PAL.mag3, 0.7), T(PAL.white, 0.7), T(PAL.fire3, 0.4)], halo: 0.6, pool: 0.9 },
  // R2 lantern warden: only the soul fire (lantern flame + glass core) and the cage eye glow (leaf4 / leaf3 are
  // lights-only in the rig; white only as the flame heart at full flare); the glass body (leaf2) glows only next to the flame
  grim_warden: { emissive: [T(PAL.leaf4, 1), T(PAL.leaf3, 0.7), T(PAL.white, 0.8)], near: [T(PAL.leaf2, 0.45)], halo: 0.7, pool: 1.05, spill: PAL.leaf3 },
  venom_drake: { emissive: [T(PAL.leaf4, 1), T(PAL.leaf3, 0.7), T(PAL.white, 0.6), T(PAL.void4, 0.8)], halo: 0.6, pool: 0.9 },
  // R3 Down Wisp: only the two gold dot eyes glow (gold4 glint / gold3 dot / gold2 lower row: gold is lights-only in
  // the rig). The body is white / mist / steel / lilac void4 feathers, so white, mist and void4 are never emissive.
  wisp_imp: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.8), T(PAL.gold2, 0.3)], halo: 0.5, pool: 0.85 },
  steel_silencer: { emissive: [T(PAL.crim4, 1), T(PAL.crim3, 0.7), T(PAL.white, 0.6), T(PAL.void4, 0.7)], halo: 0.6, pool: 0.9 },
  seal_head: { emissive: [T(PAL.mag4, 1), T(PAL.void4, 1), T(PAL.white, 0.8)], halo: 0.6, pool: 0.9 },
  seal_arm_r: { emissive: [T(PAL.mag4, 1), T(PAL.void4, 1), T(PAL.white, 0.7)], halo: 0.6, pool: 0.9 },
  seal_arm_l: { emissive: [T(PAL.mag4, 1), T(PAL.void4, 1), T(PAL.white, 0.7)], halo: 0.6, pool: 0.9 },
  seal_leg_r: { emissive: [T(PAL.mag4, 1), T(PAL.void4, 1), T(PAL.white, 0.7)], halo: 0.6, pool: 0.9 },
  seal_leg_l: { emissive: [T(PAL.mag4, 1), T(PAL.void4, 1), T(PAL.white, 0.7)], halo: 0.6, pool: 0.9 },
  hourglass_imp: { emissive: [T(PAL.gold4, 1), T(PAL.white, 1), T(PAL.gold3, 0.7)], halo: 0.6, pool: 0.9 },
  windmane_knight: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.7), T(PAL.white, 0.6), T(PAL.leaf3, 0.3)], halo: 0.6, pool: 0.9 },
  shield_titan: { emissive: [T(PAL.gold4, 1), T(PAL.gold3, 0.7), T(PAL.white, 0.5)], halo: 0.6, pool: 0.9 },
  wing_lady: { emissive: [T(PAL.teal4, 1), T(PAL.white, 0.9), T(PAL.gold4, 0.8), T(PAL.teal3, 0.5)], halo: 0.6, pool: 0.9 },
  // batch 2 (attribute-coloured placeholder glow)
  tide_harpooner: { emissive: [T(PAL.water4, 0.8), T(PAL.white, 0.8), T(PAL.cyan4, 0.6)], halo: 0.6, pool: 0.9 },
  dial_jester: { emissive: [T(PAL.gold4, 1), T(PAL.white, 1), T(PAL.gold3, 0.6)], halo: 0.6, pool: 0.9 },
  cloud_hatchling: { emissive: [T(PAL.leaf4, 1), T(PAL.white, 0.8), T(PAL.leaf3, 0.4)], halo: 0.6, pool: 0.9 },
  reflection_archer: { emissive: [T(PAL.gold4, 1), T(PAL.white, 1), T(PAL.gold3, 0.6)], halo: 0.6, pool: 0.9 },
  scrap_raiders: { emissive: [T(PAL.fire4, 1), T(PAL.fire3, 0.7), T(PAL.white, 0.7)], halo: 0.6, pool: 0.9 },
  hollow_ogre: { emissive: [T(PAL.earth4, 0.8), T(PAL.gold4, 0.8), T(PAL.white, 0.6)], halo: 0.6, pool: 0.9 },
  crag_axeman: { emissive: [T(PAL.earth4, 0.8), T(PAL.gold4, 0.8), T(PAL.white, 0.6)], halo: 0.6, pool: 0.9 },
  reed_heron: { emissive: [T(PAL.water4, 0.8), T(PAL.white, 0.8), T(PAL.cyan4, 0.6)], halo: 0.6, pool: 0.9 },
  kite_fencer: { emissive: [T(PAL.leaf4, 1), T(PAL.white, 0.8), T(PAL.leaf3, 0.4)], halo: 0.6, pool: 0.9 },
  mudgrasp_spirit: { emissive: [T(PAL.earth4, 0.8), T(PAL.gold4, 0.8), T(PAL.white, 0.6)], halo: 0.6, pool: 0.9 },
  steppe_spiralhorn: { emissive: [T(PAL.leaf4, 1), T(PAL.white, 0.8), T(PAL.leaf3, 0.4)], halo: 0.6, pool: 0.9 },
  polar_needle: { emissive: [T(PAL.earth4, 0.8), T(PAL.gold4, 0.8), T(PAL.white, 0.6)], halo: 0.6, pool: 0.9 },
  polar_anvil: { emissive: [T(PAL.earth4, 0.8), T(PAL.gold4, 0.8), T(PAL.white, 0.6)], halo: 0.6, pool: 0.9 },
  polar_coil: { emissive: [T(PAL.earth4, 0.8), T(PAL.gold4, 0.8), T(PAL.white, 0.6)], halo: 0.6, pool: 0.9 },
  polar_sovereign: { emissive: [T(PAL.earth4, 0.8), T(PAL.gold4, 0.8), T(PAL.white, 0.6)], halo: 0.6, pool: 0.9 },
  straw_decoy_token: { emissive: [T(PAL.gold4, 0.5)], halo: 0.2, pool: 0.5 },
};

/**
 * A monster's emissive glow profile (docs/v3/A3_MIMARI.md §6.4: every read of MONSTER_GLOW goes
 * through here; tests/presentation/table-access.test.ts). A3 bridge: in the v3 look a monster with
 * v3 art and a recipe takes its recipe's `light.glow` over the table entry.
 */
export function monsterGlow(id: MonsterId): MonsterGlow | undefined {
  const base = MONSTER_GLOW[id];
  const r = v3Recipe(id)?.light?.glow;
  return r ? ({ ...base, ...r } as MonsterGlow) : base;
}
