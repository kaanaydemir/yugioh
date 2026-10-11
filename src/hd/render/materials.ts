// HD render — materials. A material says how a surface turns (normal, light) into ONE of a few
// palette tones: its ramp, how wide each tone band is, glints, glow, translucency and the
// colors its line work uses. Materials are plain objects; define your own with `material()`
// or derive from the presets below (`variant`, `farSide`).

import { PAL, RAMPS } from '../../art/palette';
import { hueRamp } from './color';

export interface HDMaterial {
  /** Debug name (shown in stage sheets). */
  name: string;
  /** Tones dark → light, 4–8 (5–7 recommended). Shadows navy/purple, highlights warm. */
  ramp: readonly number[];
  /**
   * Tone boundaries in lit-intensity space (0 = facing away from the key light, 1 = facing it),
   * ascending, length ramp.length - 1. Default: even bands shaped by `gamma`.
   */
  thresholds?: readonly number[];
  /** >1 pushes surfaces toward the darker tones (more shadow), <1 toward the lighter. Default 1. */
  gamma?: number;
  /** Diffuse wrap 0..1: soft terminator (0 = hard Lambert edge). Default from the light rig. */
  wrap?: number;
  /** Ambient-occlusion strength inside a part (creases where primitives meet). Default 1. */
  occlusion?: number;
  /**
   * Specular glint (Blinn-Phong on the baked key light). Pixels whose spec term ≥ `min` take
   * `color` (default: the top ramp tone); between `min * 0.6` and `min` they get +1 tone.
   */
  spec?: { power: number; min: number; color?: number };
  /** Crystal / metal: where two flat facets meet, the brighter side gets a 1 px light edge. */
  edgeLight?: boolean;
  /**
   * Light passing THROUGH a clear solid (crystal, glass, ice): the rim on the side away from
   * the key light brightens — the classic crystal-ball crescent. 0..1 (default 0).
   */
  transmit?: number;
  /**
   * Glowing material: unlit, tone chosen by the primitive's `heat` (0..1) instead of light,
   * tagged in the emissive mask so the app can bloom it. Never shadowed by contact shadows.
   */
  emissive?: boolean;
  /**
   * Translucent panel (wing glass, fins): where it covers other parts, its tone moves by
   * `behind` steps so the body reads through it; where it covers nothing the output alpha is
   * `alpha` (0..1, default 1 = opaque) so the arena glows through.
   */
  translucent?: { alpha?: number; behind?: number };
  /** Selective outline colors: `dark` on the shadow side, `lit` on the light side. Never black. */
  outline: { dark: number; lit: number };
  /** Inner line color (front part edge over another part, shadow side). Default outline.dark. */
  line?: number;
  /** Fur: 1 px tone drop where one clump overlaps another (clump ids differ). */
  clumpLines?: boolean;
  /** Receives the rig's baked rim and bounce light. Default true. */
  rim?: boolean;
  /** Cluster cleanup after quantization (no lonely pixels). Default true. */
  despeckle?: boolean;
}

/** Identity helper with defaults filled in (keeps authoring terse and typed). */
export function material(m: HDMaterial): HDMaterial {
  return m;
}

/** Copy of a material with some fields replaced. */
export function variant(m: HDMaterial, patch: Partial<HDMaterial>): HDMaterial {
  return { ...m, ...patch, name: patch.name ?? m.name + '*' };
}

/**
 * The same material one step darker (limbs / wings on the far side of the body): the top tone
 * is dropped and `deep` is prepended. Keeps the hue-shift and line colors.
 */
export function farSide(m: HDMaterial, deep: number = m.outline.dark): HDMaterial {
  return { ...m, name: m.name + '-far', ramp: [deep, ...m.ramp.slice(0, -1)], spec: m.spec ? { ...m.spec, min: Math.min(0.995, m.spec.min + 0.04) } : undefined };
}

/** Index of the "albedo" (mid) tone used by the albedo debug stage. */
export const albedoTone = (m: HDMaterial): number => Math.round((m.ramp.length - 1) * 0.6);

// ------------------------------------------------------------------ presets
//
// Built only from palette colors. Names describe the surface, not a specific monster.

export const MAT = {
  /** White / ice-blue crystal hide (Kristal Ejder): navy-purple shadows, white with a warm glint. */
  iceHide: material({
    name: 'iceHide',
    ramp: hueRamp(RAMPS.night, { drop: { bottom: 1 }, highlight: [PAL.steel, PAL.mist, PAL.white] }), // night1..night4, steel, mist, white
    gamma: 0.85,
    spec: { power: 28, min: 0.9, color: PAL.gold4 },
    outline: { dark: PAL.night0, lit: PAL.night3 },
    line: PAL.night1,
  }),

  /** Faceted glowing crystal (spikes, horns of light): sharp facets, white edge light. */
  crystal: material({
    name: 'crystal',
    ramp: hueRamp(RAMPS.cyan, { shadow: [PAL.night2], highlight: [PAL.white] }), // night2, cyan0..4, white
    // dense bands near the top so facets that all face the light still separate
    thresholds: [0.14, 0.3, 0.5, 0.68, 0.84, 0.96],
    wrap: 0.15,
    transmit: 0.45,
    spec: { power: 40, min: 0.94, color: PAL.white },
    edgeLight: true,
    outline: { dark: PAL.night1, lit: PAL.cyan1 },
    line: PAL.cyan0,
    occlusion: 0.5,
  }),

  /** Translucent crystal glass for wing panels and fins. */
  glass: material({
    name: 'glass',
    ramp: hueRamp(RAMPS.cyan, { shadow: [PAL.night1], highlight: [PAL.white] }),
    gamma: 0.9,
    wrap: 0.4,
    transmit: 0.3,
    spec: { power: 30, min: 0.96, color: PAL.white },
    translucent: { alpha: 0.86, behind: -1 },
    outline: { dark: PAL.night1, lit: PAL.cyan1 },
    line: PAL.cyan1,
    occlusion: 0.3,
    rim: false,
  }),

  /** Polished gold (horns, crowns, rings): purple-brown shadows, white glints. */
  gold: material({
    name: 'gold',
    ramp: hueRamp(RAMPS.gold, { shadow: [PAL.void1] }), // void1, gold0..gold4
    gamma: 0.9,
    wrap: 0.25,
    spec: { power: 24, min: 0.86, color: PAL.white },
    edgeLight: true,
    outline: { dark: PAL.void0, lit: PAL.gold1 },
    line: PAL.gold0,
  }),

  /** Cool steel / armor plate. */
  steel: material({
    name: 'steel',
    ramp: [PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white],
    gamma: 1,
    wrap: 0.1,
    spec: { power: 30, min: 0.88, color: PAL.white },
    edgeLight: true,
    outline: { dark: PAL.night0, lit: PAL.night3 },
    line: PAL.night0,
  }),

  /** Charcoal fur (Kor Kurdu): navy shadows, cool grey tufts, warm-ish top. Clump lines on. */
  charcoalFur: material({
    name: 'charcoalFur',
    ramp: [PAL.night0, PAL.night1, PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3],
    gamma: 1.1,
    wrap: 0.35,
    clumpLines: true,
    outline: { dark: PAL.void0, lit: PAL.night2 },
    line: PAL.void0,
  }),

  /** Rough stone. */
  stone: material({
    name: 'stone',
    ramp: [PAL.night1, PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4],
    gamma: 1,
    wrap: 0.2,
    outline: { dark: PAL.night0, lit: PAL.stone0 },
    line: PAL.night0,
  }),

  /** Wet mouth / throat interior. */
  mouth: material({
    name: 'mouth',
    ramp: [PAL.night0, PAL.void0, PAL.crim0, PAL.crim1, PAL.crim2],
    gamma: 1.3,
    wrap: 0.3,
    outline: { dark: PAL.void0, lit: PAL.crim0 },
    line: PAL.night0,
    rim: false,
  }),

  /** Living flame (emissive; tone from heat: rim fire1 → core white). */
  flame: material({
    name: 'flame',
    ramp: [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4, PAL.white],
    emissive: true,
    outline: { dark: PAL.fire0, lit: PAL.fire1 },
    line: PAL.fire1,
  }),

  /** Cyan energy / glowing core (emissive). */
  energy: material({
    name: 'energy',
    ramp: [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white],
    emissive: true,
    outline: { dark: PAL.cyan0, lit: PAL.cyan1 },
    line: PAL.cyan1,
  }),

  /** Glowing white-cyan eye (emissive). */
  eyeCyan: material({
    name: 'eyeCyan',
    ramp: [PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white],
    emissive: true,
    outline: { dark: PAL.night0, lit: PAL.cyan1 },
    line: PAL.night1,
  }),

  /** Glowing amber eye (emissive). */
  eyeAmber: material({
    name: 'eyeAmber',
    ramp: [PAL.fire2, PAL.fire3, PAL.gold3, PAL.gold4],
    emissive: true,
    outline: { dark: PAL.fire0, lit: PAL.fire1 },
    line: PAL.fire0,
  }),
} as const;
