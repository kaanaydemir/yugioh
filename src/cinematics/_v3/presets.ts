// v3 shared kits, part 2 — the PURE tables (no Phaser; unit-tested in tests/cinematics/v3-kit2.test.ts):
//   DEATH_PRESETS   every monster's death flavour as a preset: the matter it breaks as + its accent
//   matterRamp      a monster's matter tones (hologram onsets, light columns, reassembly motes)
//   cutInRhythm     an ace cut-in's beats (flare / slam / exit / close), clamped to the 1.0 s budget
//   flightMs        a card's flight time to the graveyard over a distance
// docs/v3/A0_ENVANTER.md §6.2 items 2, 4, 5.

import type { MonsterId } from '../../data/cards';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import type { ShatterMaterial } from '../../vfx/shatter';

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
};

export function deathPreset(id: MonsterId): DeathPreset {
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

/** A monster's matter tones (its death material's ramp): the crystal wyrm is cyan glass, not gold. */
export function matterRamp(id: MonsterId): Ramp {
  return MATTER_RAMP[deathPreset(id).material];
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

/** The cut-in beats of an ace (the budget wins over any table entry). */
export function cutInRhythm(id: MonsterId): CutInRhythm {
  const r = { ...DEFAULT_RHYTHM, ...(RHYTHM[id] ?? {}) };
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
