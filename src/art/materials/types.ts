// Material library — the types (docs/v3/A3_MIMARI.md §5, docs/v3/REHBER.md §2 MA-1).
//
// One definition per material feeds four things together: the drawing (tone bands, thresholds,
// seams / creases, highlight, rim, glint, texture, light), the hit VFX (sparks, debris, flash tone),
// the death / revive preset (vfx/shatter material + accent, the rigkit pass) and the struck body's
// sound (the parameters of its hit<Material><Light|Heavy|Magic> recipes, src/audio/v3/materials.ts).
// A definition is PURE DATA (no functions, no Phaser): src/art/materials/defs/<id>.ts default-exports
// one, ./index.ts registers it. A material shares TONES and RULES, never painting: two monsters of
// the same material are still two part painters (A3_MIMARI §5).
//
// Versioning (A3_MIMARI §3.6): a `verified` definition is frozen (tests/art/materials.test.ts checks
// it against tests/art/fixtures/materials-golden.json); a value change becomes a new definition
// (defs/stone@2.ts, id 'stone@2') that users move to one by one. A `draft` is free until its first
// user is accepted.
//
// Extensions of the A3_MIMARI §5 sketch (additive; each one carries a slice value the sketch could
// not hold): `draw.far` (the wyrm's far-side materials have their own thresholds, HIDE_FAR / GLASS_FAR),
// `sound` may name another material (`{ same }`: the wyrm's hide is glass to a blow, the magus' shadow
// is its cloth, moss and a rune sound like the stone they sit on), and the slice rings' per-weight
// values are `PerWeight` pairs (`[light, heavy]`; the sketch's single `dec` / `f` / `band` numbers could
// not reproduce the slice's light / heavy variants).

import type { Ramp } from '../palette';
import type { PassId } from '../rigkit/passes/types';
import type { ShatterMaterial } from '../../vfx/shatter';

/** 'crystal' | 'hide' | 'metal' | 'cloth' | 'shadow' | 'stone' | 'moss' | 'runeGold' | … | 'stone@2' (a later version). */
export type MaterialId = string;

/** The weight of a blow (SE-5): the struck body's hit recipe is material × weight. */
export type HitWeight = 'Light' | 'Heavy' | 'Magic';
export const HIT_WEIGHTS: readonly HitWeight[] = Object.freeze(['Light', 'Heavy', 'Magic'] as const);

/** A sound parameter for every weight, or one per weight: [Light, Heavy] (Magic takes the Heavy value). */
export type PerWeight = number | readonly [light: number, heavy: number];

/**
 * The material's own ring (sound is data; src/audio/v3/materials.ts interprets it). The family
 * shape of each kind (gains, offsets, the extra layers) lives in the interpreter; a definition holds
 * the values that make it this material.
 */
export type RingSpec =
  /** glass: free-free bar modes (kit BAR_MODES) on `root` (MIDI), a fifth above (`fifth` = its
   *  decay), then a rain of `shards` small glass pings over `notes` (MIDI) for `rain` s */
  | { readonly kind: 'bar'; readonly notes: readonly number[]; readonly dec: PerWeight; readonly root: PerWeight; readonly fifth: PerWeight; readonly rain: PerWeight; readonly shards: PerWeight }
  /** metal: an FM clank (kit clank) on `f` (Hz); heavier blows add the plate's upper partial */
  | { readonly kind: 'fm'; readonly f: PerWeight; readonly ratio: number; readonly index: number; readonly dec: PerWeight }
  /** cloth: the fabric snaps (a noise flutter in `band` Hz, decay `dec`) and the shadow exhales */
  | { readonly kind: 'flutter'; readonly band: PerWeight; readonly dec: PerWeight }
  /** stone / gravel: a low brown rumble settling to `f` (Hz) and a gravel trickle (`grit` 0…2 × the grain count) */
  | { readonly kind: 'rumble'; readonly f: number; readonly grit: number }
  /** water (A4): an impact splash + bubbles — no interpreter yet */
  | { readonly kind: 'slosh'; readonly f: number; readonly bubbles: number }
  /**
   * ash / acid / fire (lane A, src/audio/v3/materials.ts): a dry train of tiny clicks at `hp` (Hz),
   * `rate` clicks per second, lasting `dec` s ([Light, Heavy], default [0.25, 0.4]; Magic = 0.6 ×
   * Heavy) — never a pitched ring. Optional: `knock` a short tonal sine knock (Hz; × 1.25 on a light
   * blow, falling to half), `rattle` two extra clicks at that band (Hz) on a heavy blow.
   */
  | { readonly kind: 'crackle'; readonly hp: number; readonly rate: number; readonly dec?: PerWeight; readonly knock?: number; readonly rattle?: number };
export type RingKind = RingSpec['kind'];

/** The struck body's sound: the parameters of its hit recipes (src/audio/v3/materials.ts). */
export interface MaterialSound {
  /** The body knock: a sine falling f0 → f1 (Hz), its level and decay (s). */
  readonly thump: readonly [f0: number, f1: number, g: number, dec: number];
  /** The surface transient: band centre (Hz) and level. */
  readonly surf: readonly [hz: number, g: number];
  readonly ring: RingSpec;
  /** The magic variant's ring-modulated sizzle centre (Hz). */
  readonly sizzle: number;
}

/** "A blow on this material sounds like that one" (an accent on another body, or the same body). */
export interface MaterialSoundRef {
  readonly same: MaterialId;
}

/** Colour → colour, keyed by the colour of the surface the band is drawn on (rigkit StepTable). */
export type StepTable = Readonly<Record<number, number>>;

/** A raster material view (rigkit RasterMat without the `direct` flag: th [] = hand-toned). */
export interface ToneBands {
  /** PAL tones dark → light. */
  readonly ramp: readonly number[];
  /** Ascending intensity thresholds on n·L + bias (length ramp.length − 1), or [] = hand-toned (the bias is the ramp index). */
  readonly th: readonly number[];
}

export interface MaterialDraw extends ToneBands {
  /** The far side is drawn one value darker (HIDE_FAR) … */
  readonly farShift: 0 | 1;
  /** … with these bands (when the slice set its own; else farOf() steps the ramp down once). */
  readonly far?: ToneBands;
  /** The 1-px contact seam (IŞ-5 SEAM): one step down the ramp, or a table. */
  readonly seam: 'stepDown' | StepTable;
  /** The junction crease band (IŞ-5 CREASE): two steps down, or a table. */
  readonly crease: 'stepDown2' | StepTable;
  /** Selective edge paint (IŞ-8, rigkit edgePaint): `hi` where the edge faces the light (facing ≥ lit), `lo` where it faces away (≤ dark); null = leave. */
  readonly edge: { readonly hi: number | null; readonly lo: number | null; readonly lit: number; readonly dark: number };
  /** IŞ-7: the one rim-light colour of this material, or none. */
  readonly rim: number | null;
  /** IŞ-8: the glint's tone and where it may sit (≤ 1 per anim), or none. */
  readonly glint: { readonly tone: number; readonly anchors: 'facet' | 'edge' | 'plate' } | null;
  /** MA-2: texture by notches / teeth, `density` = the feature pitch in px (REHBER "doku yoğunluğu": cell, notch spacing, course height). */
  readonly texture?: { readonly kind: 'facets' | 'courses' | 'chips' | 'scales' | 'currents' | 'feathers' | 'fur' | 'grain'; readonly density: number };
  /** Light, drawn after the outline and never outlined (IŞ-9). */
  readonly emissive?: { readonly tones: readonly number[]; readonly pulse: 'breath' | 'flicker' | 'steady' };
  /** Moving interior bands (MA-4: no alpha). */
  readonly interior?: 'currents' | 'embers' | null;
  /** IŞ-10: the isolated-pixel share this material's frames are held to. */
  readonly noiseMax: number;
}

export type HitDebris = 'shard' | 'chip' | 'drop' | 'leaf' | 'feather' | 'ember' | 'wisp' | null;

export interface MaterialDef {
  readonly id: MaterialId;
  /** REHBER §2.2 (binding, from the slice) = verified; §2.3 = draft until its first user's acceptance. */
  readonly status: 'verified' | 'draft';
  /** The monster that brought it in (a MonsterId). */
  readonly firstUser: string;
  readonly draw: MaterialDraw;
  /** A blow on this surface: spark tones (dark → light), the debris it throws, the contact-flash tone. */
  readonly hit: { readonly sparks: readonly number[]; readonly debris: HitDebris; readonly flash: number };
  /** How a body of it breaks (vfx/shatter material + the accent kept) and the rigkit death / revive passes. */
  readonly death: { readonly shatter: ShatterMaterial; readonly accent: ShatterMaterial; readonly pass: PassId; readonly revive: PassId };
  /** Its matter tones (MATTER_RAMP role: hologram onsets, light columns, motes). */
  readonly matter: Ramp;
  /** What a blow on it sounds like (its hit recipe parameters, or the material it sounds like). */
  readonly sound: MaterialSound | MaterialSoundRef;
  /** Light it gives the scene: `glow` the emissive tone the light layer picks up (MONSTER_GLOW),
   *  `pool` the colour of its strike's impact light (STRIKE_LIGHT). */
  readonly light?: { readonly glow?: number; readonly pool?: number };
}
