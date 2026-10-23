// v3 character voices from presentation recipes (docs/v3/A3_MIMARI.md §2, §6.1; REHBER §7 SE-3, SE-4).
// A recipe's `voice` is either the name of a hand-made set (the aces: _v3/sound.ts CHARACTER_SOUNDS,
// src/audio/v3/slice.ts) or a VoicePreset — a palette + key + register + brightness (+ tail) — that
// this module turns into the character's role recipes (SE-3: a character is a parameter set over the
// ./kit blocks; no new DSP). The roles are the ones every character fills:
//   roar · arrive · land · charge (sustained: faded on 'release') · release · impact · dissolve · burst
//   · reviveGather (sustained: faded on the revive's 'land') · reviveLand
// (swing, deathStart and afterDissolve are optional extras of a hand-made set). A palette may add EXTRAS
// beside the roles (VoiceExtra, A3 pilot fix): a beat of its character the shared role set has no name
// for — the rumble's 'rip', the rock torn out of the floor (the strike's hooks play it).
//
// Names: `voice:<cardId>:<role>`, generated at load for every recipe FILE (src/presentation/cards/*.ts)
// that has a VoicePreset of a palette interpreted here; src/audio/sounds.ts spreads V3_VOICE_RECIPES into
// the game's table (additive) and SfxName gains V3VoiceSfxName. Nothing in the old look plays them:
// _v3/sound.ts soundsOf hands them out only under the bridge rule (v3 look + v3 art, §6.4). A fixture
// recipe registered at run time (a dev preview) has no generated set: voiceSounds() answers null and
// the generic sounds play.
//
// Palettes (A3 interprets 'rumble', the pilot's; each later palette arrives with its first user):
//   rumble  stone (REHBER §2.3 "gümbürtü + çakıl"): a low grinding rumble (brown noise through a resonant
//           low-pass on the key, an irregular grating flutter), dry gravel high up (sparse noise clicks,
//           6–9 kHz: above the wyrm's glass, far above the magus' drone), heavy knocks (sine drops on the
//           key) and a dust tail; NOTHING tonal in the middle —
//           no glass bar modes (the wyrm), no saw drone or formant chord (the magus): low + high with a
//           hollow middle is what keeps it apart from both (SE-4).

import type { MonsterId } from '../../data/cards';
import { presentationOf, RECIPE_IDS } from '../../presentation/registry';
import type { VoicePalette, VoicePreset } from '../../presentation/types';
import type { Recipe } from '../sounds';
import type { SfxName } from '../sfx';
import { midiHz, perc, type Pt, type Voice } from '../synth';
import { crack, puff, scaled, sweep, thump } from './kit';

// ================================================================ roles + names

export type VoiceRole = 'roar' | 'arrive' | 'land' | 'charge' | 'release' | 'impact' | 'dissolve' | 'burst' | 'reviveGather' | 'reviveLand';
export const VOICE_ROLES: readonly VoiceRole[] = Object.freeze(['roar', 'arrive', 'land', 'charge', 'release', 'impact', 'dissolve', 'burst', 'reviveGather', 'reviveLand'] as const);
/**
 * The sustained roles (started with sfx.start, faded on the mark that ends their picture, SE-2): the strike's
 * gathering (faded on 'release'), the summon's gathering ('arrive': faded on the pose's 'land' — A3 pilot
 * fix, its swell outlived the picture) and the revive's (faded on the revive's 'land').
 */
export const SUSTAINED_ROLES: readonly VoiceRole[] = Object.freeze(['charge', 'arrive', 'reviveGather'] as const);

/** A palette's extra beats beside the roles (see the header): the rumble's 'rip'. */
export type VoiceExtra = 'rip';

/** The names this module adds to SfxName. */
export type V3VoiceSfxName = `voice:${MonsterId}:${VoiceRole | VoiceExtra}`;

export function voiceSfxName(id: string, role: VoiceRole): SfxName {
  return `voice:${id}:${role}` as SfxName;
}

/** A character's role set: every role's sound name. */
export type VoiceSet = Readonly<Record<VoiceRole, SfxName>>;

/** A palette's recipes: every role's, and its extras. */
export type PaletteSet = Record<VoiceRole, Recipe> & Partial<Record<VoiceExtra, Recipe>>;

// ================================================================ rumble (stone)

interface Rumble {
  /** The key (Hz) in the preset's register. */
  f: number;
  /** Brightness 0…1. */
  b: number;
  /** The gravel band (Hz). */
  grit: number;
  /** The grind's top (multiple of f). */
  top: number;
  /** A dust tail on the big beats. */
  dust: boolean;
}

function rumbleOf(p: VoicePreset): Rumble {
  const reg = p.register === 'low' ? 1 : p.register === 'mid' ? 2 : 4;
  const b = Math.max(0, Math.min(1, p.brightness));
  return { f: midiHz(p.key) * reg, b, grit: 6200 + 2600 * b, top: 5 + 6 * b, dust: p.tail === 'dust' };
}

/** Stone grinding: brown noise through a resonant low-pass moving over `lp` (multiples of f), grating. */
function grind(v: Voice, P: Rumble, t: number, d: number, g: Pt[] | number, lp: readonly Pt[], o: { rate?: number; q?: number } = {}): void {
  const f: Pt[] = lp.map(([x, k, c]) => [x, P.f * k, c] as Pt);
  const lpf = v.filt('lowpass', f, o.q ?? 2.4, { t });
  const grate = v.flutter(o.rate ?? 11, 0.5, { t, d, base: 0.55, to: lpf });
  v.noise('brown', { t, d, g, to: grate });
}

/** Dry gravel: sparse noise clicks high up (`n` grains over `d`, `curve` < 1 = denser late, > 1 = front-loaded). */
function gravel(v: Voice, P: Rumble, t: number, d: number, n: number, g: number, curve = 1.6, band = 1): void {
  v.crackle({ t, d, n, g, f: P.grit * band, q: 0.8, curve, dec: 0.004 });
}

/** A knock of stone on stone: a sine drop on the key, driven, and its surface click. */
function knock(v: Voice, P: Rumble, t: number, g: number, dec: number, o: { up?: number; click?: number } = {}): void {
  const up = o.up ?? 2.6;
  thump(v, t, P.f * up, P.f * 0.85, g, dec, { drive: 2 });
  if ((o.click ?? 1) > 0) crack(v, t, 0.22 * (o.click ?? 1), { hp: P.grit * 0.9, dec: 0.006 });
}

/** The dust tail: pink noise high up, thinning (tail 'dust'). */
function dustTail(v: Voice, P: Rumble, t: number, d: number, g: number): void {
  if (!P.dust) return;
  v.noise('pink', { t, g: [[0, 0], [0.06, g], [d, 0.0001, 'e']], to: v.filt('highpass', [[0, P.grit * 0.8], [d, P.grit * 1.1, 'e']], 0.7, { t }) });
}

function rumbleVoice(p: VoicePreset): PaletteSet {
  const P = rumbleOf(p);
  return {
    /**
     * The call (the summon's shield slam: its pose's peak): the whole body grinds up and settles, gravel pours
     * off. A3 pilot fix: it ends with the pose (D 0.6 s, not a 1.25-s grind into the idle) and its second
     * thump falls on the eye lighting up (+0.13 s), not on an empty frame after the pose.
     */
    roar: {
      cap: 1,
      gap: 0.3,
      verb: 0.45,
      duck: 0.6,
      play(v) {
        const D = 0.6;
        grind(v, P, 0, D, [[0, 0], [0.08, 0.55], [0.32, 0.4], [D, 0.0001, 'e']], [[0, 2], [0.2, P.top, 'e'], [D, 1.5, 'e']], { rate: 9 });
        knock(v, P, 0.02, 0.5, 0.6, { up: 3 });
        thump(v, 0.13, P.f * 1.6, P.f * 0.8, 0.26, 0.4, { drive: 1.6 });
        gravel(v, P, 0.04, 0.5, 30, 0.22, 1.3);
        gravel(v, P, 0.16, 0.36, 12, 0.14, 1.1, 1.35);
        dustTail(v, P, 0.25, 0.4, 0.07);
      },
    },
    /**
     * The summon opens (sustained: faded on the pose's 'land', SE-2): the floor splits — a crack and a knock on
     * the first frame — then the rocks gather, a rumble swelling from the floor to its peak ~0.55 s in (the
     * pose lands at ~0.65 s), pebbles drawn together (A3 pilot fix: it peaked 250 ms after the land before).
     */
    arrive: {
      cap: 1,
      gap: 0.3,
      verb: 0.4,
      duck: 0.35,
      play(v) {
        const D = 0.55;
        const E = 1.05;
        crack(v, 0, 0.32, { hp: P.grit * 0.65, dec: 0.012, n: 3, gap: 0.016 });
        knock(v, P, 0, 0.42, 0.42, { up: 2.2, click: 0.5 });
        grind(v, P, 0.03, E, [[0, 0], [0.12, 0.2], [D, 0.46], [E, 0.0001, 'e']], [[0, 1.6], [D, P.top * 0.85, 'e'], [E, 2, 'e']], { rate: 7 });
        gravel(v, P, 0.05, D + 0.1, 34, 0.2, 0.7);
        v.tone('sine', [[0, P.f], [D, P.f * 1.5, 'e']], { g: [[0, 0], [D, 0.18], [E, 0.0001, 'e']] });
      },
    },
    /** Feet on the floor ('land' mark): a heavy knock, the floor's dust, a few pebbles. */
    land: {
      cap: 2,
      gap: 0.06,
      verb: 0.35,
      duck: 0.4,
      play(v) {
        knock(v, P, 0, 0.62, 0.42, { up: 2.4, click: 0.8 });
        puff(v, 0.004, 0.3, 0.3, 700, { kind: 'brown' });
        v.bursts([0.08, 0.15, 0.24], [0.13, 0.09, 0.06], { dec: 0.01, f: P.grit * 0.8, q: 2.4 });
        dustTail(v, P, 0.05, 0.45, 0.05);
      },
    },
    /**
     * The strike's gathering (sustained; faded on 'release'): the ground grinds open, gravel trickles. A3 pilot
     * fix: it starts on the dig (the declaration's held charge frame), so it opens with the fingers biting into
     * the floor — a dry crunch of stone and a burst of grit (the dig was silent).
     */
    charge: {
      cap: 2,
      gap: 0.1,
      verb: 0.35,
      duck: 0.25,
      play(v) {
        const D = 0.55;
        const H = D + 0.9;
        const E = H + 0.2;
        crack(v, 0, 0.3, { hp: P.grit * 0.55, dec: 0.012, n: 3, gap: 0.012 });
        knock(v, P, 0, 0.22, 0.2, { up: 3.4, click: 0.8 });
        gravel(v, P, 0.01, 0.16, 14, 0.24, 2.2);
        grind(v, P, 0, E, [[0, 0], [0.08, 0.2], [D, 0.38], [H, 0.38], [E, 0.0001, 'e']], [[0, 1.5], [D, P.top * 0.7, 'e'], [E, P.top * 0.7]], { rate: 13 });
        gravel(v, P, 0.04, H, 40, 0.13, 0.8);
        v.tone('sine', [[0, P.f], [D, P.f * 1.35, 'e'], [E, P.f * 1.35]], { g: [[0, 0], [D, 0.16], [H, 0.16], [E, 0.0001, 'e']] });
      },
    },
    /**
     * The throw: the stone's grunt leaving the hand (a low knock and grind), a deep swing, a spray of grit. A3
     * pilot fix: the swing's air HIGH up (1.6 → 3.2 → 2 kHz, white: the throw is heard on a laptop / phone
     * speaker too, not only as sub-bass — a mid-band swoosh made it the wyrm's breath, SE-4 10 dB) and the
     * boulder's tumble under the flight (≈ 0.35 s, falling slowly: its weight turning over, a low fluttering
     * grind, and grit falling off it) so it never goes quiet before the impact. The middle stays hollow.
     */
    release: {
      cap: 2,
      gap: 0.05,
      verb: 0.3,
      duck: 0.3,
      play(v) {
        sweep(v, 0, 0.28, [90, 260, 80], 0.7, { q: 0.8, kind: 'brown', peakAt: 0.3 });
        sweep(v, 0, 0.2, [1600, 3200, 2000], 0.5, { q: 0.9, kind: 'white', peakAt: 0.35 });
        knock(v, P, 0, 0.5, 0.3, { up: 2.2, click: 0.6 });
        grind(v, P, 0, 0.24, perc(0.5, 0.2, 0.01), [[0, P.top * 0.7], [0.22, 1.6, 'e']], { rate: 15 });
        gravel(v, P, 0.015, 0.22, 16, 0.24, 1.4);
        // the tumble: the boulder's weight turning over (a low grind, fluttering) and grit falling off it
        const tumble = v.filt('lowpass', [[0, P.f * 4.5], [0.34, P.f * 3, 'e']], 1.6, { t: 0.06 });
        const turn = v.flutter(11, 0.65, { t: 0.06, d: 0.34, base: 0.5, to: tumble });
        v.noise('brown', { t: 0.06, d: 0.34, g: [[0, 0], [0.04, 0.6], [0.22, 0.45], [0.34, 0.0001, 'e']], to: turn });
        gravel(v, P, 0.06, 0.32, 20, 0.2, 1.0);
      },
    },
    /**
     * EXTRA 'rip' (the strike's rip beat: its hooks play it): the rock torn out of the floor — a tearing crack
     * high up, a short scrape of stone on stone in the mid band (heard on a laptop / phone speaker: the feet's
     * 'land' the rip reused was sub-bass only), a spray of grit, the boulder's weight coming free under it.
     */
    rip: {
      cap: 1,
      gap: 0.1,
      verb: 0.35,
      duck: 0.35,
      play(v) {
        crack(v, 0, 0.8, { hp: 1800, lp: 7000, dec: 0.014, n: 3, gap: 0.017 });
        const scrape = v.filt('bandpass', [[0, 600], [0.05, 1500, 'e'], [0.16, 700, 'e']], 0.8, { t: 0.004 });
        v.noise('white', { t: 0.004, g: [[0, 0], [0.008, 1.8], [0.06, 0.58], [0.16, 0.0001, 'e']], to: scrape });
        knock(v, P, 0.012, 0.5, 0.26, { up: 2.4, click: 0 });
        gravel(v, P, 0.02, 0.3, 26, 0.26, 2);
        dustTail(v, P, 0.06, 0.45, 0.05);
      },
    },
    /** The strike's own accent on the contact frame (the struck body adds its material): the stone lands. */
    impact: {
      cap: 2,
      gap: 0.05,
      verb: 0.45,
      duck: 0.5,
      play(v) {
        crack(v, 0, 0.45, { hp: P.grit * 0.7, dec: 0.01, n: 2, gap: 0.008 });
        knock(v, P, 0, 0.66, 0.55, { up: 3.2, click: 0 });
        grind(v, P, 0.01, 0.55, perc(0.42, 0.45, 0.01), [[0, P.top], [0.5, 1.2, 'e']], { rate: 10 });
        gravel(v, P, 0.01, 0.45, 30, 0.24, 2);
        dustTail(v, P, 0.08, 0.6, 0.06);
      },
    },
    /**
     * Death 'dissolve': the body crumbles — the stack slumps (a dull knock on the frame), cracks running,
     * rubble sliding off, a low groan. A3 pilot fix: louder (and the slump), so the death arc climbs to its
     * break instead of the break jumping 9–11 dB over a whisper.
     */
    dissolve: {
      cap: 1,
      gap: 0.2,
      verb: 0.4,
      duck: 0.35,
      play(v) {
        const D = 0.9;
        knock(v, P, 0, 0.26, 0.38, { up: 1.8, click: 0.5 });
        v.crackle({ t: 0, d: D * 0.8, n: 30, g: 0.35, f: P.grit, q: 1.2, curve: 0.9, dec: 0.008 });
        grind(v, P, 0.02, D, [[0, 0], [0.12, 0.6], [D, 0.0001, 'e']], [[0, P.top * 0.8], [D, 1.2, 'e']], { rate: 8 });
        v.tone('sine', [[0, P.f * 1.25], [D, P.f * 0.8, 'e']], { g: [[0, 0], [0.1, 0.2], [D, 0.0001, 'e']] });
      },
    },
    /**
     * The body breaks: a rubble crash, chunks falling one after the other, gravel, dust. A3 pilot fix: ~8 dB
     * down, at the slice's death level (it was the loudest beat of any clip and held the output knee ~20 ms):
     * the heap that is left collapses, it does not explode — the arc climbs crumble → helm drop → break.
     */
    burst: {
      cap: 1,
      gap: 0.2,
      verb: 0.5,
      duck: 0.55,
      play(v) {
        crack(v, 0, 0.19, { hp: P.grit * 0.7, dec: 0.012, n: 3, gap: 0.01 });
        knock(v, P, 0, 0.22, 0.7, { up: 3, click: 0 });
        const chunks = [0.12, 0.2, 0.31, 0.43, 0.58, 0.74];
        v.bursts(chunks, chunks.map((_, i) => 0.064 * (1 - i * 0.12)), { dec: 0.02, f: P.grit * 0.8, q: 1.6, drive: 1.6 });
        for (let i = 0; i < 3; i++) thump(v, chunks[i * 2], P.f * 2.2, P.f, (0.22 - i * 0.05) * 0.32, 0.25, { drive: 1.5 });
        grind(v, P, 0, 1.1, perc(0.19, 0.9, 0.01), [[0, P.top], [1, 1.2, 'e']], { rate: 9 });
        gravel(v, P, 0.02, 1, 40, 0.1, 1.8);
        dustTail(v, P, 0.15, 1, 0.05);
      },
    },
    /**
     * Revive: the stones roll back together (sustained; faded on the revive's 'land'). A3 pilot fix: sized to
     * its picture as the slice's gatherings are (the chunks fly from the first frame and lock ~0.38 s later):
     * a 0.36-s rise, a held top, the gravel front-loaded, at the slice gatherings' level under the music's —
     * it was a 1.1-s swell cut at a third.
     */
    reviveGather: {
      cap: 1,
      gap: 0.2,
      verb: 0.45,
      duck: 0.3,
      play(v) {
        const D = 0.36;
        const H = D + 0.3;
        const E = H + 0.12;
        grind(v, P, 0, E, [[0, 0.03], [D, 0.19], [H, 0.19], [E, 0.0001, 'e']], [[0, 1.4], [D, P.top * 0.9, 'e'], [E, P.top * 0.9]], { rate: 6 });
        gravel(v, P, 0, H, 44, 0.09, 1.0, 1.1);
        v.tone('sine', [[0, P.f * 0.8], [D, P.f * 1.5, 'e'], [E, P.f * 1.5]], { g: scaled([[0, 0], [D, 0.2], [H, 0.2], [E, 0.0001, 'e']], 0.4) });
      },
    },
    /** Revive 'land': the blocks lock — a deep knock and two stone clacks. */
    reviveLand: {
      cap: 1,
      gap: 0.1,
      verb: 0.4,
      duck: 0.4,
      play(v) {
        knock(v, P, 0, 0.6, 0.5, { up: 2.8, click: 0.6 });
        v.bursts([0.05, 0.12], [0.22, 0.16], { dec: 0.016, f: P.grit * 0.75, q: 3, drive: 1.4 });
        puff(v, 0.01, 0.22, 0.3, 600, { kind: 'brown' });
        dustTail(v, P, 0.06, 0.4, 0.04);
      },
    },
  };
}

// ================================================================ palettes

/** The palettes this module interprets (the others arrive with their first user). */
const PALETTES: Partial<Record<VoicePalette, (p: VoicePreset) => PaletteSet>> = {
  rumble: rumbleVoice,
};

export const VOICE_PALETTES: readonly VoicePalette[] = Object.freeze(Object.keys(PALETTES) as VoicePalette[]);

/** A preset's role recipes, or null when its palette has no interpreter yet. */
export function voiceRecipes(p: VoicePreset): PaletteSet | null {
  return PALETTES[p.palette]?.(p) ?? null;
}

/** The reference rumble preset (the pilot's draft, A3_MIMARI §6.1): offline renders and fixtures. */
export const RUMBLE_REFERENCE: VoicePreset = Object.freeze({ palette: 'rumble', key: 31, register: 'low', brightness: 0.15, tail: 'dust' });

// ================================================================ the generated set

const GENERATED = new Set<string>();
/** The extras each generated card's palette adds. */
const EXTRAS = new Map<string, VoiceExtra[]>();

function generate(): Record<V3VoiceSfxName, Recipe> {
  const out: Record<string, Recipe> = {};
  for (const id of RECIPE_IDS) {
    const v = presentationOf(id)?.voice;
    if (!v || 'custom' in v) continue;
    const set = voiceRecipes(v);
    if (!set) continue;
    GENERATED.add(id);
    for (const role of VOICE_ROLES) out[voiceSfxName(id, role)] = set[role];
    const extras = (Object.keys(set) as (VoiceRole | VoiceExtra)[]).filter((k): k is VoiceExtra => !VOICE_ROLES.includes(k as VoiceRole));
    for (const x of extras) out[`voice:${id}:${x}`] = set[x]!;
    if (extras.length) EXTRAS.set(id, extras);
  }
  return out as Record<V3VoiceSfxName, Recipe>;
}

export const V3_VOICE_RECIPES: Record<V3VoiceSfxName, Recipe> = generate();

/**
 * A generated set: every role's sound, the death's landing knocks when the recipe names them, and the
 * palette's extras (the rumble's `rip`).
 */
export type GeneratedVoice = VoiceSet & { afterDissolve?: readonly (readonly [number, SfxName, number])[] } & Partial<Record<VoiceExtra, SfxName>>;

/**
 * The generated role set of a card (null: its recipe file has no interpreted VoicePreset). A preset's
 * `drops` (A3 pilot fix: what falls to the floor after the death's 'dissolve' — the sentinel's helm and
 * pauldron) become the set's afterDissolve beats, scored with its own 'land' (the death kit plays them,
 * _v3/death.ts).
 */
export function voiceSounds(id: string | null | undefined): GeneratedVoice | null {
  if (!id || !GENERATED.has(id)) return null;
  const out = {} as Record<VoiceRole, SfxName>;
  for (const role of VOICE_ROLES) out[role] = voiceSfxName(id, role);
  const v = presentationOf(id)?.voice;
  const drops = v && !('custom' in v) ? v.drops : undefined;
  const extras: Partial<Record<VoiceExtra, SfxName>> = {};
  for (const x of EXTRAS.get(id) ?? []) extras[x] = `voice:${id}:${x}` as SfxName;
  return { ...out, ...extras, ...(drops?.length ? { afterDissolve: drops.map(([f, vol]) => [f, out.land, vol] as const) } : {}) };
}
