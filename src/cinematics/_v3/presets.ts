// v3 shared kits, part 2 — the PURE tables (no Phaser; unit-tested in tests/cinematics/v3-kit2.test.ts):
//   DEATH_PRESETS   every monster's death flavour as a preset: the matter it breaks as + its accent
//   matterRamp      a monster's matter tones (hologram onsets, light columns, reassembly motes)
//   cutInRhythm     an ace cut-in's beats (flare / slam / exit / close), clamped to the 1.0 s budget
//   flightMs        a card's flight time to the graveyard over a distance
// docs/v3/A0_ENVANTER.md §6.2 items 2, 4, 5.

import type { MonsterId } from '../../data/cards';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import type { ShatterMaterial } from '../../vfx/shatter';
import { v3Recipe } from '../../presentation/registry';

// ================================================================ deaths

export interface DeathPreset {
  /** How the body breaks (vfx/shatter material preset). */
  material: ShatterMaterial;
  /** The death flavour kept as an accent (a material's look; _v3/death.ts ACCENTS). */
  accent: ShatterMaterial;
}

/**
 * Every monster's death flavour (A0 §1.3 "Ölüm tatları") as a preset: crystal crack and light
 * loss, pulled into the void, cooling + rubble, foam, the flame dying, melting, short circuit,
 * fading, feather storm, crumbling, shadow pool, withering.
 */
export const DEATH_PRESETS: Record<MonsterId, DeathPreset> = {
  crystal_wyrm: { material: 'crystal', accent: 'crystal' },
  abyss_magus: { material: 'shadow', accent: 'shadow' },
  magma_titan: { material: 'stone', accent: 'fire' },
  coral_serpent: { material: 'water', accent: 'water' },
  ember_wolf: { material: 'fire', accent: 'fire' },
  tide_golem: { material: 'water', accent: 'water' },
  storm_hawk: { material: 'plant', accent: 'plant' },
  stone_sentinel: { material: 'stone', accent: 'stone' },
  lumen_sprite: { material: 'light', accent: 'light' },
  shade_assassin: { material: 'shadow', accent: 'shadow' },
  volt_lizard: { material: 'light', accent: 'crystal' },
  thorn_lurker: { material: 'plant', accent: 'plant' },
  // expanded roster, batch 1 (placeholder flavours until each monster gets its own)
  dusk_sorcerer: { material: 'shadow', accent: 'shadow' },
  ashen_drake: { material: 'shadow', accent: 'fire' },
  grim_warden: { material: 'shadow', accent: 'crystal' },
  venom_drake: { material: 'plant', accent: 'shadow' },
  wisp_imp: { material: 'shadow', accent: 'shadow' },
  steel_silencer: { material: 'stone', accent: 'crystal' },
  seal_head: { material: 'shadow', accent: 'crystal' },
  seal_arm_r: { material: 'shadow', accent: 'crystal' },
  seal_arm_l: { material: 'shadow', accent: 'crystal' },
  seal_leg_r: { material: 'shadow', accent: 'crystal' },
  seal_leg_l: { material: 'shadow', accent: 'crystal' },
  hourglass_imp: { material: 'light', accent: 'light' },
  windmane_knight: { material: 'stone', accent: 'stone' },
  shield_titan: { material: 'stone', accent: 'stone' },
  wing_lady: { material: 'light', accent: 'plant' },
  // batch 2 (docs/v3/YENI_KARTLAR.md; placeholder flavours until each monster gets its own)
  tide_harpooner: { material: 'water', accent: 'water' },
  dial_jester: { material: 'light', accent: 'crystal' },
  cloud_hatchling: { material: 'plant', accent: 'light' },
  reflection_archer: { material: 'crystal', accent: 'light' },
  scrap_raiders: { material: 'stone', accent: 'fire' },
  hollow_ogre: { material: 'plant', accent: 'stone' },
  crag_axeman: { material: 'stone', accent: 'stone' },
  reed_heron: { material: 'water', accent: 'plant' },
  kite_fencer: { material: 'plant', accent: 'light' },
  mudgrasp_spirit: { material: 'stone', accent: 'shadow' },
  steppe_spiralhorn: { material: 'plant', accent: 'plant' },
  polar_needle: { material: 'stone', accent: 'crystal' },
  polar_anvil: { material: 'stone', accent: 'crystal' },
  polar_coil: { material: 'stone', accent: 'crystal' },
  polar_sovereign: { material: 'stone', accent: 'crystal' },
  straw_decoy_token: { material: 'plant', accent: 'plant' },
};

/**
 * A monster's death preset. A3 bridge (A3_MIMARI §6.4): in the v3 look a monster with v3 art and a
 * presentation recipe breaks as its recipe says; otherwise (always in the v1 look, where the old death
 * flavours call deathMaterial too) today's table.
 */
export function deathPreset(id: MonsterId): DeathPreset {
  const r = v3Recipe(id)?.death;
  if (r) return { material: r.material, accent: r.accent };
  return DEATH_PRESETS[id] ?? { material: 'crystal', accent: 'crystal' };
}

/** The material a monster breaks as (vfx/shatter), e.g. for strikes-b's legacy flavours. */
export function deathMaterial(id: MonsterId): ShatterMaterial {
  return deathPreset(id).material;
}

/** The tones of each matter (hologram onsets, light columns, reassembly motes). */
export const MATTER_RAMP: Record<ShatterMaterial, Ramp> = {
  crystal: [PAL.night2, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4],
  shadow: RAMPS.void,
  stone: RAMPS.stone,
  light: [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4, PAL.white],
  plant: RAMPS.leaf,
  fire: RAMPS.fire,
  water: RAMPS.water,
};

/** The tones of one matter (a recipe's `summon.matter`, A3). */
export function rampOfMatter(m: ShatterMaterial): Ramp {
  return MATTER_RAMP[m];
}

/** A monster's matter tones (its death material's ramp): the crystal wyrm is cyan glass, not gold. */
export function matterRamp(id: MonsterId): Ramp {
  return rampOfMatter(deathPreset(id).material);
}

// ================================================================ the ace cut-in

/** The whole v3 cut-in never exceeds this (ms; A0 §6.2 item 4: ≤ 1.0 s). */
export const CUTIN_V3_MAX_MS = 900;

export interface CutInRhythm {
  /** Eye flare + roar (ms from the start). */
  flare: number;
  /** Name plate slam. */
  slam: number;
  /** The band starts to close (the summon's climax goes on from here). */
  exit: number;
  /** Closing time. */
  close: number;
}

const DEFAULT_RHYTHM: CutInRhythm = { flare: 290, slam: 370, exit: 700, close: 120 };

/** Per-ace rhythm: the wyrm's gaze holds, the magus is quick and cold, the heavy ones slam late. */
const RHYTHM: Partial<Record<MonsterId, Partial<CutInRhythm>>> = {
  crystal_wyrm: { flare: 320, slam: 410, exit: 740 },
  abyss_magus: { flare: 250, slam: 320, exit: 660 },
  magma_titan: { flare: 300, slam: 430, exit: 740 },
  tide_golem: { flare: 290, slam: 410, exit: 720 },
};

/**
 * The cut-in beats of an ace (the budget wins over any table entry). A3 bridge (§6.4): in the v3 look
 * a monster with v3 art takes its recipe's `cutIn.rhythm` in place of the table entry.
 */
export function cutInRhythm(id: MonsterId): CutInRhythm {
  const r = { ...DEFAULT_RHYTHM, ...(v3Recipe(id)?.cutIn?.rhythm ?? RHYTHM[id] ?? {}) };
  r.exit = Math.min(r.exit, CUTIN_V3_MAX_MS - r.close);
  r.slam = Math.min(r.slam, r.exit - 200);
  r.flare = Math.min(r.flare, r.slam - 40);
  return r;
}

// ================================================================ the card's flight

/** Flight time (ms) of a card to its graveyard over a distance: a short hop for near piles, never a teleport. */
export function flightMs(dist: number): number {
  return Math.round(Math.max(200, Math.min(360, 160 + dist * 0.75)));
}
