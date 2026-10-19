// v3 sound kit (docs/ANIMASYON_PLANI.md §5b): parametrised synthesis blocks the slice recipes
// (./slice.ts) are built from. A character is a parameter set over these blocks (its key, its
// glass / drone / growl settings), so A4 adds a monster by adding parameters, not new DSP.
//
// Levels are pre-chain linear amplitudes (as src/audio/sounds.ts). Frequencies follow the voice's
// pitch factor, times its time scale (Voice). Every block is deterministic for a seeded voice.

import { midiHz, perc, type Pt, type Voice } from '../synth';

/** Scale an envelope's values. */
export function scaled(pts: readonly Pt[], s: number): Pt[] {
  return pts.map(([t, val, c]) => [t, val * s, c] as Pt);
}

// ================================================================ glass / crystal

/**
 * Free-free bar modes (a struck crystal rod / glass prism): strongly inharmonic, the upper modes
 * die first — what makes a "glassy" ring instead of a bell or a string.
 */
export const BAR_MODES: readonly (readonly [ratio: number, gain: number, decay: number])[] = [
  [1, 1, 1],
  [2.756, 0.42, 0.55],
  [5.404, 0.18, 0.3],
  [8.933, 0.07, 0.16],
];

/** One struck glass partial set at `f` (Hz) — `dec` the fundamental's decay (s). */
export function glassBell(v: Voice, f: number, t: number, g: number, dec: number, o: { to?: AudioNode; modes?: number; att?: number; detune?: number } = {}): void {
  const n = Math.min(BAR_MODES.length, o.modes ?? 3);
  for (let i = 0; i < n; i++) {
    const [r, a, d] = BAR_MODES[i];
    const ff = f * r;
    if (ff > 15000) break;
    v.tone('sine', ff, { t, g: perc(g * a, dec * d, o.att ?? 0.0008), to: o.to, detune: o.detune });
  }
}

/** A glass partial set with a REVERSED envelope: it swells over `rise` and stops dead (reverse shimmer). */
export function glassReverse(v: Voice, f: number, t: number, g: number, rise: number, o: { to?: AudioNode } = {}): void {
  for (let i = 0; i < 3; i++) {
    const [r, a] = BAR_MODES[i];
    const env: Pt[] = [
      [0, 0.0001],
      [rise * 0.7, g * a * 0.18, 'e'],
      [rise, g * a, 'e'],
      [rise + 0.012, 0.0001, 'e'],
    ];
    v.tone('sine', f * r, { t, g: env, to: o.to });
  }
}

/**
 * A rain of small glass pings over `d` seconds (crystal shimmer, shard cascades): notes drawn from
 * `notes` (MIDI), density shaped by `curve` (>1 front-loaded), spread over three pan positions.
 */
export function glassRain(
  v: Voice,
  o: { t?: number; d: number; n: number; g: number; notes: readonly number[]; dec?: [number, number]; curve?: number; spread?: number; fade?: number; modes?: number; to?: AudioNode },
): void {
  const t0 = o.t ?? 0;
  const spread = o.spread ?? 0.55;
  const pans = [v.panner(-spread, { to: o.to }), v.panner(0, { to: o.to }), v.panner(spread, { to: o.to })];
  const [d0, d1] = o.dec ?? [0.06, 0.25];
  for (let i = 0; i < o.n; i++) {
    const k = Math.pow(v.rnd(), o.curve ?? 1.5);
    const t = t0 + k * o.d;
    const m = o.notes[Math.floor(v.rnd() * o.notes.length) % o.notes.length];
    const amp = o.g * v.r(0.45, 1) * (1 - (o.fade ?? 0.7) * k);
    glassBell(v, midiHz(m) * v.r(0.997, 1.003), t, amp, v.r(d0, d1), { to: pans[i % 3], modes: o.modes ?? 2 });
  }
}

/**
 * A sharp broadband crack (glass breaking / a bolt): a few ms of band-passed noise (`hp` … `lp`),
 * `n` re-strikes. The top is cut at 12 kHz by default: the energy next to Nyquist adds no snap,
 * only inter-sample peaks after the output clipper (sound QA A2 #1).
 */
export function crack(v: Voice, t: number, g: number, o: { hp?: number; lp?: number; n?: number; gap?: number; dec?: number; to?: AudioNode } = {}): void {
  const top = v.filt('lowpass', o.lp ?? 12000, 0.7, { to: o.to });
  const hp = v.filt('highpass', o.hp ?? 2500, 0.8, { to: top });
  const n = o.n ?? 1;
  for (let i = 0; i < n; i++) v.noise('white', { t: t + i * (o.gap ?? 0.011), g: perc(g * (1 - i * 0.25), o.dec ?? 0.012, 0.0002), to: hp });
}

// ================================================================ body / weight

/** A low body thump: a sine dropping f0 → f1 over `dec` (s), optionally saturated. */
export function thump(v: Voice, t: number, f0: number, f1: number, g: number, dec: number, o: { drive?: number; att?: number; to?: AudioNode } = {}): void {
  const to = o.drive ? v.drive(o.drive, { to: o.to, trim: 0.8 }) : o.to;
  v.tone('sine', [[0, f0], [Math.min(dec, 0.3), f1, 'e']], { t, g: perc(g, dec, o.att ?? 0.0015), to });
}

/** Low-passed noise puff (floor dust, a soft body landing, a muffled blow). */
export function puff(v: Voice, t: number, g: number, dec: number, lp: number, o: { kind?: 'white' | 'pink' | 'brown'; att?: number; to?: AudioNode } = {}): void {
  v.noise(o.kind ?? 'pink', { t, g: perc(g, dec, o.att ?? 0.004), to: v.filt('lowpass', [[0, lp], [dec, lp * 0.35, 'e']], 0.8, { t, to: o.to }) });
}

/** A swept band of noise (air, a swing, a passing orb): centre f0 → peak → f1 over `d`, panned l → r. */
export function sweep(v: Voice, t: number, d: number, f: readonly [number, number, number], g: number, o: { q?: number; pan?: readonly [number, number]; kind?: 'white' | 'pink' | 'brown'; peakAt?: number; to?: AudioNode } = {}): void {
  const pk = o.peakAt ?? 0.45;
  const out = o.pan ? v.panner([[0, o.pan[0]], [d, o.pan[1]]], { t, to: o.to }) : o.to;
  const bp = v.filt('bandpass', [[0, f[0]], [d * pk, f[1], 'e'], [d, f[2], 'e']], o.q ?? 1.6, { t, to: out });
  v.noise(o.kind ?? 'white', { t, g: [[0, 0], [d * pk, g], [d, 0.0001, 'e']], to: bp });
}

/** A metallic clank (armour, a staff on stone, a shackle): FM inharmonic partials + a click. */
export function clank(v: Voice, f: number, t: number, g: number, dec: number, o: { ratio?: number; index?: number; click?: number; to?: AudioNode } = {}): void {
  v.bell(f, { t, g, dec, ratio: o.ratio ?? 1.41, index: o.index ?? 3, idxDec: dec * 0.25, to: o.to });
  v.bell(f * 2.76, { t, g: g * 0.35, dec: dec * 0.45, ratio: 1.17, index: 1.4, to: o.to });
  if (o.click !== 0) v.noise('white', { t, g: perc(g * (o.click ?? 2.2), 0.008, 0.0002), to: v.filt('bandpass', Math.min(9000, f * 3), 1.4, { to: o.to }) });
}

/** A little inharmonic metal ping (chain link). */
export function link(v: Voice, f: number, t: number, g: number, dec: number, to?: AudioNode): void {
  v.tone('sine', f, { t, g: perc(g, dec, 0.0005), to });
  v.tone('sine', f * 2.31, { t, g: perc(g * 0.55, dec * 0.75, 0.0005), to });
}

// ================================================================ dark / drone

/**
 * A low drone: detuned saws on `f` (+ its octave and an optional tritone above) through a lowpass
 * that opens and closes with the envelope — the magus' presence.
 */
export function drone(v: Voice, t: number, d: number, f: number, g: number, o: { lp?: readonly [number, number, number]; tritone?: number; beat?: number; to?: AudioNode; att?: number } = {}): void {
  const [l0, l1, l2] = o.lp ?? [180, 700, 220];
  const att = o.att ?? d * 0.35;
  const lp = v.filt('lowpass', [[0, l0], [att, l1, 'e'], [d, l2, 'e']], 1.6, { t, to: o.to });
  const env: Pt[] = [[0, 0], [att, g], [d * 0.7, g * 0.7], [d, 0.0001, 'e']];
  const beat = o.beat ?? 0.6;
  v.tone('sawtooth', f, { t, g: env, to: lp });
  v.tone('sawtooth', f + beat, { t, g: scaled(env, 0.8), to: lp });
  v.tone('sawtooth', f * 2 - beat * 0.5, { t, g: scaled(env, 0.45), to: lp });
  if (o.tritone) v.tone('sawtooth', f * Math.SQRT2, { t: t + att * 0.6, g: scaled(env, o.tritone), to: lp });
  v.tone('sine', f / 2, { t, g: scaled(env, 0.9) });
}

// ================================================================ growl (creature voice)

export interface GrowlParams {
  /** Length (s). */
  d: number;
  /** Fundamental contour (Hz) at 0, 0.18, 0.55, 1.1 s and the end. */
  f: readonly [number, number, number, number, number];
  /** Formant centres (Hz): open, then closing. */
  formants: readonly [number, number, number];
  /** Overall level. */
  g: number;
  /** Throat drive (grit). */
  grit?: number;
  /** Rasp flutter rate (Hz). */
  rasp?: number;
}

/** A layered creature roar (vocal folds → formant bank → throat saturation), cf. sounds.ts roarBig. */
export function growl(v: Voice, t: number, p: GrowlParams, to?: AudioNode): void {
  const D = p.d;
  const ampEnv: Pt[] = [[0, 0], [0.07, 0.55], [0.3, 0.85], [D * 0.55, 0.6], [D, 0.0001, 'e']];
  const breath = v.amp(0.8, { t, to });
  v.wander(breath.gain, 16, 0.3, { t, d: D });
  const sum = v.amp(1.5, { t, to: v.drive(2.4, { to: breath, trim: 0.75 }) });
  const [F1, F2, F3] = p.formants;
  const bank = v.amp(1, { t, to: v.filt('bandpass', [[0, F1 * 0.55], [0.25, F1, 'e'], [D, F1 * 0.6, 'e']], 3, { t, to: sum }) });
  bank.connect(v.filt('bandpass', [[0, F2 * 0.75], [0.25, F2, 'e'], [D, F2 * 0.7, 'e']], 4, { t, to: sum }));
  bank.connect(v.filt('bandpass', [[0, F3], [0.3, F3 * 1.15, 'e'], [D, F3 * 0.9, 'e']], 5, { t, to: sum }));
  const grit = v.drive(p.grit ?? 5, { to: bank, trim: 0.9 });
  const [a, b, c, e, z] = p.f;
  for (const [mul, det, gg] of [
    [1, 0, 0.5],
    [1, 17, 0.42],
    [1.01, -23, 0.3],
    [0.5, -6, 0.2],
    [1.5, 5, 0.12],
  ] as const) {
    const f: Pt[] = [[0, a * mul], [0.18, b * mul, 'e'], [0.55, c * mul, 'e'], [Math.min(1.1, D * 0.7), e * mul, 'e'], [D, z * mul, 'e']];
    const o = v.tone('sawtooth', f, { t, g: scaled(ampEnv, gg * p.g), to: grit, detune: det });
    v.wander(o.osc.detune, 20, 80, { t, d: D });
    v.lfo(o.osc.detune, 29 + det * 0.3, 20, { t, d: D, w: 'triangle' });
  }
  const raspBp = v.filt('bandpass', [[0, 700], [0.3, 1300, 'e'], [D, 600, 'e']], 1.2, { t, to: breath });
  const rasp = v.flutter(p.rasp ?? 38, 0.45, { t, d: D, base: 0.55, to: raspBp });
  v.noise('white', { t, g: scaled(ampEnv, 0.5 * p.g), to: rasp });
}
