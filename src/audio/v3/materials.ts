// v3 material hits from the material library (docs/v3/A3_MIMARI.md §2, §5; REHBER SE-5): the struck
// body plays, not the striker — material × Light / Heavy / Magic. A material's sound is DATA
// (src/art/materials MaterialDef.sound: thump, surface transient, ring spec, sizzle); this module
// turns it into hit<Material><Weight> recipes. src/audio/sounds.ts spreads V3_MATERIAL_RECIPES into
// the game's table (additive) and SfxName gains V3MaterialSfxName; nothing in the old look plays them.
//
// The skeleton (materialHitRecipe) is src/audio/v3/slice.ts materialHit line for line, and the ring
// interpreters of 'bar' / 'fm' / 'flutter' are its crystal / metal / cloth rings with the values read
// from the definition: tests/art/materials.test.ts proves that the generator, fed the slice
// materials' definitions, makes exactly the slice's nine recipes (call for call). The slice's own
// recipes stay where they are (slice.ts is never edited, A3 does not bind them here); the generated
// set is GENERATED_HIT_MATERIALS — the new struck-body materials — today the pilot's stone.
//
//   weight  Heavy = deeper knock + drive + longer; Light = shorter, higher; Magic = the knock an
//           octave up and short (the spell's own impact owns the sub) + a ring-modulated sizzle and a
//           bright crackle tail around the material's band (SE-5).
//   stone   ('rumble', REHBER §2.3: a low rumble + gravel, brown noise, no ring) the block's grinding
//           settle — brown noise through a resonant low-pass sinking onto `f` — and a trickle of dry
//           gravel that falls and thins out; a heavy blow knocks a few chips loose that land after it.

import type { Recipe } from '../sounds';
import type { SfxName } from '../sfx';
import { midiHz, perc, type Voice } from '../synth';
import { clank, crack, glassBell, glassRain, puff, thump } from './kit';
import { soundOf, soundRootOf, type HitWeight, type MaterialId, type MaterialSound, type PerWeight, type RingKind, type RingSpec } from '../../art/materials';

/** A per-weight value for this weight ([Light, Heavy]; Magic takes the Heavy value). */
export function perWeight(x: PerWeight, w: HitWeight): number {
  return typeof x === 'number' ? x : w === 'Light' ? x[0] : x[1];
}

/** The ring kinds this module can play (the others are A4's: their first material brings the interpreter). */
export const RING_KINDS: readonly RingKind[] = Object.freeze(['bar', 'fm', 'flutter', 'rumble', 'crackle'] as const);

/** The material's own ring at relative time t, level k (the weight's scale). */
function ring(v: Voice, s: RingSpec, t: number, k: number, w: HitWeight): void {
  switch (s.kind) {
    case 'bar': {
      // glass (slice crystal): the struck bar in free-free modes, its fifth, a rain of shards
      const base = midiHz(perWeight(s.root, w));
      glassBell(v, base, t, 0.085 * k, perWeight(s.dec, w), { modes: 4 });
      glassBell(v, base * 1.498, t + 0.004, 0.05 * k, perWeight(s.fifth, w));
      glassRain(v, { t: t + 0.01, d: perWeight(s.rain, w), n: perWeight(s.shards, w), g: 0.035 * k, notes: s.notes, curve: 1.6, dec: [0.05, 0.18] });
      return;
    }
    case 'fm': {
      // armour (slice metal): a dry FM clank; heavier blows add the plate's upper partial
      const f = perWeight(s.f, w);
      clank(v, f, t, 0.1 * k, perWeight(s.dec, w), { ratio: s.ratio, index: s.index, click: 1.6 });
      if (w !== 'Light') clank(v, f * 2.2, t + 0.012, 0.045 * k, 0.35, { ratio: 2.76, index: 1.5, click: 0 });
      return;
    }
    case 'flutter': {
      // cloth + shadow (slice cloth): the robe snaps (a short flutter of noise: a light blow high and
      // quick, a heavy one low and long) and the shadow exhales (pink, falling)
      const light = w === 'Light';
      const flap = v.flutter(light ? 64 : 40, 0.6, { t, d: light ? 0.1 : 0.2, base: 0.4, to: v.filt('bandpass', perWeight(s.band, w), 1.1) });
      v.noise('white', { t, g: perc((light ? 0.3 : 0.22) * k, perWeight(s.dec, w), 0.003), to: flap });
      v.noise('pink', { t: t + 0.01, g: [[0, 0], [0.04, 0.3 * k], [light ? 0.16 : 0.6, 0.0001, 'e']], to: v.filt('lowpass', [[0, light ? 2200 : 1000], [0.5, 160, 'e']], 1.2, { t: t + 0.01 }) });
      if (w === 'Heavy') v.tone('sawtooth', [[0, 82], [0.5, 46, 'e']], { t, g: perc(0.06 * k, 0.5, 0.01), to: v.filt('lowpass', 260, 1) });
      return;
    }
    case 'rumble': {
      // stone: no ring — the block grinds and settles (brown noise, a resonant low-pass sinking from
      // 3f onto f) and gravel spills off it (dry grains high up, front-loaded, thinning); a heavy blow
      // knocks a few pebbles loose that click on the floor after it. Low + high, a hollow middle:
      // nothing of cloth's mid hump, nothing tonal (glass, metal ring; stone does not)
      const light = w === 'Light';
      const magic = w === 'Magic';
      const f = magic ? s.f * 2 : light ? s.f * 1.5 : s.f;
      const d = light ? 0.14 : magic ? 0.24 : 0.7;
      v.noise('brown', { t, g: [[0, 0], [light ? 0.008 : 0.03, (light ? 0.4 : 0.45) * k], [d, 0.0001, 'e']], to: v.filt('lowpass', [[0, f * 3], [d, f, 'e']], 1.6, { t }) });
      v.crackle({ t: t + 0.006, d: light ? 0.09 : magic ? 0.16 : 0.55, n: Math.round((light ? 10 : magic ? 9 : 18) * s.grit), g: (light ? 0.34 : magic ? 0.16 : 0.15) * k, f: w === 'Heavy' ? 3000 : 4200, q: 0.7, curve: light ? 1.4 : 1.9, dec: 0.005 });
      if (w === 'Heavy') v.bursts([0.09, 0.16, 0.26, 0.37], [0.14 * k, 0.1 * k, 0.07 * k, 0.05 * k], { t, dec: 0.012, f: 2400, q: 2.2 });
      return;
    }
    case 'crackle': {
      // ash / acid (lane A): no ring — a dry train of tiny high clicks (embers spitting, a hide fizzing
      // where it is struck), front-loaded and thinning; optionally a short tonal knock under it (acid's
      // wet low knock) and, on a heavy blow, two rattle clicks. Nothing in the mid band (not cloth's
      // flap), no brown grind (not stone's), nothing that rings (not glass / metal).
      const light = w === 'Light';
      const magic = w === 'Magic';
      const dec = s.dec ?? [0.25, 0.4];
      const d = light ? perWeight(dec, 'Light') : magic ? perWeight(dec, 'Heavy') * 0.6 : perWeight(dec, 'Heavy');
      v.crackle({ t: t + 0.004, d, n: Math.max(1, Math.round(s.rate * d)), g: (light ? 0.1 : 0.08) * k, f: s.hp, q: 0.9, dec: 0.003, curve: 1.3 });
      if (s.knock) v.tone('sine', [[0, light ? s.knock * 1.25 : s.knock], [0.06, s.knock * 0.5, 'e']], { t, g: perc((light ? 0.2 : 0.3) * k, light ? 0.05 : 0.09, 0.002) });
      if (s.rattle && w === 'Heavy') v.bursts([0.05, 0.11], [0.12 * k, 0.07 * k], { t, dec: 0.004, f: s.rattle, q: 1.4 });
      return;
    }
    default:
      throw new Error(`audio/v3/materials: ring kind '${s.kind}' has no interpreter yet`);
  }
}

/**
 * One material × weight impact recipe (the struck body's own sound at the contact frame) —
 * src/audio/v3/slice.ts materialHit with the material's parameters as data.
 */
export function materialHitRecipe(S: MaterialSound, w: HitWeight): Recipe {
  const heavy = w === 'Heavy';
  const magic = w === 'Magic';
  const k = heavy ? 1 : magic ? 0.85 : 0.6;
  return {
    cap: 3,
    gap: 0.03,
    verb: heavy ? 0.42 : magic ? 0.5 : 0.22,
    duck: heavy ? 0.55 : magic ? 0.45 : 0.25,
    vary: 0.03,
    play(v) {
      const [f0, f1, g, dec] = S.thump;
      // the surface transient: the loudest few ms of the whole beat
      crack(v, 0, (heavy ? 0.55 : 0.4) * S.surf[1] * 2, { hp: S.surf[0] * 0.6, dec: heavy ? 0.014 : 0.009 });
      v.noise('white', { g: perc(0.3 * k, 0.03, 0.0005), to: v.filt('bandpass', S.surf[0], 1.3) });
      // weight: the body knock (heavy = deeper, longer, saturated; magic an octave up and short)
      if (magic) thump(v, 0, f0 * 1.7, f1 * 2.4, g * k * 0.7, dec * 0.7, { drive: 1.4 });
      else thump(v, 0, heavy ? f0 * 0.85 : f0 * 1.25, heavy ? f1 * 0.8 : f1 * 1.2, g * k * (heavy ? 1.15 : 1), heavy ? dec * 1.8 : dec, { drive: heavy ? 2.2 : 1.4 });
      if (heavy) puff(v, 0.004, 0.35, 0.35, 900, { kind: 'brown' });
      ring(v, S.ring, 0, k, w);
      if (magic) {
        // the spell's sizzle: ring-modulated noise around the material's band, a bright tail
        const rm = v.ring([[0, 1100], [0.35, 420, 'e']], { d: 0.45, mix: 1, to: v.filt('bandpass', S.sizzle, 1.4) });
        v.noise('white', { g: [[0, 0], [0.01, 0.32], [0.45, 0.0001, 'e']], to: rm });
        v.crackle({ t: 0.02, d: 0.4, n: 14, g: 0.12, f: S.sizzle * 1.4, q: 1, curve: 1.5, dec: 0.006 });
      }
    },
  };
}

// ================================================================ the generated set

/**
 * New struck-body materials whose hit recipes are made here (the slice's three live in slice.ts).
 * Lane A adds ash (ashen_drake), venomscale (venom_drake) and hatchhide (cloud_hatchling): the names
 * hit<Material><Weight> exist from now on; a blow plays them when the definition's `sound` is its own
 * (hitSfxName follows `sound.same`: hatchhide still sounds like cloth until its own parameters land).
 */
export const GENERATED_HIT_MATERIALS = ['stone', 'ash', 'venomscale', 'hatchhide'] as const;
export type GeneratedHitMaterial = (typeof GENERATED_HIT_MATERIALS)[number];

/** The names this module adds to SfxName: hit<Material><Light|Heavy|Magic>. */
export type V3MaterialSfxName = `hit${Capitalize<GeneratedHitMaterial>}${HitWeight}`;

const WEIGHTS: readonly HitWeight[] = ['Light', 'Heavy', 'Magic'];
const cap = (id: string) => id[0].toUpperCase() + id.slice(1);

function generate(): Record<V3MaterialSfxName, Recipe> {
  const out: Record<string, Recipe> = {};
  for (const id of GENERATED_HIT_MATERIALS) for (const w of WEIGHTS) out[`hit${cap(id)}${w}`] = materialHitRecipe(soundOf(id), w);
  return out as Record<V3MaterialSfxName, Recipe>;
}

export const V3_MATERIAL_RECIPES: Record<V3MaterialSfxName, Recipe> = generate();

/** The slice's material hits (src/audio/v3/slice.ts, untouched): sound-root material → recipe stem. */
const SLICE_HIT_STEMS: Readonly<Record<string, string>> = { crystal: 'hitCrystal', metal: 'hitMetal', cloth: 'hitCloth' };

/**
 * The recipe a blow of weight `w` on a body of material `id` plays (its sound root: the wyrm's hide
 * plays glass, moss and runes the stone under them), or null when the material has no hit recipe
 * yet (the caller keeps the generic impact).
 */
export function hitSfxName(id: MaterialId, w: HitWeight): SfxName | null {
  const root = soundRootOf(id);
  const stem = SLICE_HIT_STEMS[root] ?? ((GENERATED_HIT_MATERIALS as readonly string[]).includes(root) ? `hit${cap(root)}` : null);
  return stem ? (`${stem}${w}` as SfxName) : null;
}
