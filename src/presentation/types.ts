// Presentation recipes — the types (docs/v3/A3_MIMARI.md §6.1). A recipe is PURE DATA about how a card
// is presented in the v3 look: what its body is made of, how it strikes, enters, dies and flips, its
// voice, light and (aces) cut-in rhythm, and which parts it draws itself (`custom`). It never touches
// the rules: src/data/cards.ts stays the rule data, the engine (src/engine/**) never imports this
// folder, and nothing here imports Phaser or the engine (tests/presentation/engine-boundary.test.ts).
// Every import below is type-only.
//
// Where it is read (A3_MIMARI §6.4, the bridge rule): ONLY in the v3 look and ONLY for a monster that has
// v3 art, inside the accessor of the table it stands in for (deathPreset, blowKindOf, soundsOf,
// materialOf, monsterGlow, strikeLight, roarPeakOf, flipRamp, isRanged, cutInRhythm) — everywhere else,
// and always in the v1 look, today's tables answer. src/cinematics/recipe/install.ts builds the default
// cinematic of every part that is not `custom` (priority 10).
//
// Extensions of the §6.1 sketch (additive): `flip.ramp` is a palette ramp name (RampName) rather than a
// free string; the hook argument types (StrikeHookArgs, SummonHookArgs, DeathHookArgs) are spelt out.

import type { MaterialId } from '../art/materials/types';
import type { RampName } from '../art/palette';
import type { Tier } from '../art/rigkit/validate';
import type { MonsterPointName } from '../art/types';
import type { GrowlParams } from '../audio/v3/kit';
import type { CinematicContext, StrikeArgs } from '../cinematics/_core/types';
import type { CutInRhythm } from '../cinematics/_v3/presets';
import type { MonsterUnit } from '../duel/MonsterUnit';
import type { XY } from '../view/layout';
import type { MonsterGlow } from '../view/light/profiles';
import type { ShatterMaterial } from '../vfx/shatter';

export type { Tier };

/** How a strike travels (A3 builds only 'throw', the pilot's; the others arrive with their first user, A3_MIMARI §6.2). */
export type AttackType = 'beam' | 'projectile' | 'throw' | 'lunge' | 'slam' | 'melee' | 'bite' | 'dive' | 'whip' | 'bolt' | 'burrow';
/** The engine's effect ACTION a recipe effect is tied to (never an effect name; plan §8). */
export type EngineAction = 'damage' | 'heal' | 'destroy' | 'negate' | 'counter' | 'statChange' | 'specialSummon';
/** The entrance style (A3 builds only 'assemble', the pilot's). */
export type SummonStyle = 'column' | 'rift' | 'fissure' | 'vortex' | 'assemble' | 'bloom' | 'swoop' | 'surge' | 'strike' | 'pool';
/** What a blocked strike does on the guard. */
export type BlockedForm = 'rebound' | 'clang' | 'splash' | 'shatter';
/** The flip burst's accent. */
export type FlipAccent = 'vines' | 'sparks' | 'dust' | 'mist' | 'drop';
/** A voice palette (src/audio/v3/voices.ts; A3 interprets 'rumble', the pilot's). */
export type VoicePalette = 'glass' | 'drone' | 'rumble' | 'growl' | 'crackle' | 'wave' | 'chirp' | 'rustle' | 'chime';
/** The parts a card may draw itself (its own registerStrike / registerCardHook files). */
export type CustomPart = 'strike' | 'summon' | 'death' | 'flip' | 'effect' | 'revive' | 'position';

export interface VoicePreset {
  palette: VoicePalette;
  /** MIDI root (wyrm E, magus D; the pilot G1 = 31). */
  key: number;
  register: 'low' | 'mid' | 'high';
  /** 0 dark … 1 bright. */
  brightness: number;
  growl?: GrowlParams;
  tail?: 'shimmer' | 'embers' | 'spray' | 'dust' | null;
  /**
   * What falls to the floor after the death's 'dissolve' (A3 pilot fix, additive): [death frames after the
   * 'dissolve' mark, volume] — each scored with the voice's own 'land' (the sentinel's helm and pauldron hit
   * the floor and bounce). Becomes the generated set's afterDissolve (src/audio/v3/voices.ts).
   */
  drops?: readonly (readonly [frames: number, volume: number])[];
}

/** What a strike flourish hook gets (the beat it decorates: charge / release / contact / recover). */
export interface StrikeHookArgs {
  s: StrikeArgs;
  recipe: PresentationRecipe;
  /** The world point of the beat: the origin point (`attack.from`) on charge / release, the contact point on contact. */
  at: XY;
  /** The attack frame shown at the beat. */
  frame: number;
}
export type StrikeHook = (a: StrikeHookArgs) => void | Promise<void>;

/** What a summon flourish hook gets (the summon pose's big beat). */
export interface SummonHookArgs {
  ctx: CinematicContext;
  unit: MonsterUnit;
  recipe: PresentationRecipe;
  /** The tile's floor point. */
  home: XY;
}
export type SummonHook = (a: SummonHookArgs) => void | Promise<void>;

/** What a death flourish hook gets (the burst frame: the body breaks). */
export interface DeathHookArgs {
  ctx: CinematicContext;
  unit: MonsterUnit;
  recipe: PresentationRecipe;
  /** Where the body breaks. */
  at: XY;
}
export type DeathHook = (a: DeathHookArgs) => void;

/** Flourishes over the recipe's timeline (the normal tier's ornament budget, A3_MIMARI §6.2). */
export interface RecipeHooks {
  onCharge?: StrikeHook;
  onRelease?: StrikeHook;
  onContact?: StrikeHook;
  onRecover?: StrikeHook;
  onSummonPeak?: SummonHook;
  onDeath?: DeathHook;
}

export interface PresentationRecipe {
  /** The card id (src/data/cards.ts). */
  id: string;
  tier: Tier;
  /** What a blow on this body sounds / sparks like (src/art/materials ids). */
  body: { physical: MaterialId; magic?: MaterialId };
  attack: {
    /** How it travels; `blow` replaces STRIKE_KIND for this card. */
    type: AttackType;
    blow: 'physical' | 'magic';
    /** The anatomical origin, read from the frame shown EVERY frame (REHBER HA-25). */
    from: MonsterPointName;
    /** The effect: 'boulder' | 'water' | 'fireball' | 'prism' | 'darkOrb' …; `tone` its light (STRIKE_LIGHT). */
    vfx: string;
    tone?: number;
    travel?: { ms?: number; arc?: number };
    /** A different motion for a direct attack (the hawk dives over). */
    direct?: AttackType;
    blocked?: BlockedForm;
    /** Replaces chains_of_light RANGED for this card (v3). */
    ranged?: boolean;
  };
  /**
   * `leadMs`: how long the matter gathers before the summon pose starts ('assemble': default 220 ms);
   * `shake`: the finale's camera shake in px (default 2) — a heavier or lighter body than the pilot's
   * tunes its own entrance's weight (A3 core review F8).
   */
  summon: { style: SummonStyle; matter?: ShatterMaterial; setPiece?: string; roarPeak?: number; leadMs?: number; shake?: number };
  /** `onBurst`: a named set piece on the burst frame (the lizard's static ball). */
  death: { material: ShatterMaterial; accent: ShatterMaterial; onBurst?: string };
  flip?: { accent: FlipAccent; ramp?: RampName };
  effects?: readonly {
    on: EngineAction;
    anim: 'special' | 'roar' | 'attack' | 'death';
    from: MonsterPointName;
    delivery: 'burnFly' | 'healFly' | 'tendril' | 'vineBurst' | 'bolt' | 'shards' | 'sparkle';
    vfx?: string;
  }[];
  /** A parameter set over src/audio/v3/kit (voices.ts), or the name of a hand-made set (_v3/sound.ts CHARACTER_SOUNDS). */
  voice: VoicePreset | { custom: string };
  light?: { glow?: Partial<MonsterGlow>; strike?: number };
  /** Only cards with CardDef.ace. */
  cutIn?: { rhythm?: Partial<CutInRhythm> };
  custom?: Partial<Record<CustomPart, true>>;
  /** Lazy src/cinematics/recipe/hooks/<id>.ts (a side-effect-free module). */
  hooks?: () => Promise<{ default: RecipeHooks }>;
}
