// Kanat Hanımı (wing_lady) — v3 sounds (lane F). Spread into the game through ./kart-f.ts.
// Identity: docs/v3/oturum-f/wing_lady.md §6 + §11 #10 (checked against docs/v3/YENI_KARTLAR.md §5.1). Built from
// ./kit.ts blocks and the Voice primitives only (no new DSP).
//
// Palette:
//   the SONG        a wordless woman's "aa" in A major: a saw + triangle source on A4 (440 Hz) through three
//                   band-pass formants (800 / 1150 / 2900 Hz: a bright "aa", F2 ≥ 1150 so it never reads as the
//                   magus' dark chord or R3's "uu"), a 5.5 Hz vibrato that blooms after the onset, a breath on the
//                   attack, a short echo. She sings; she never cries like a bird (storm_hawk owns the screech).
//   the CHORD       every buffed ally adds one harmony voice — C#5, E5, A5, C#6 — so the ear counts the allies;
//                   the unbless lets the voices fall a semitone and drop out one by one, leaving her root.
//   the HOVER       the flight feathers' thrum ("trrr"): band-passed noise on 900 Hz chopped at 20–24 Hz (fast
//                   wing beats), a soft hummed A3 under it.
//   the BLADE       a bronze-steel "çink": an FM clank on 1.9 kHz with the 2.4 ratio (not C9's 4 kHz, not the
//                   knight's 330 Hz plate).
//   the CLAP        "PAH": two white puffs (hp 1.2 kHz) 12 ms apart over a small body thump — the wings closing.
// Sustained recipes (the glide, the hover, the unbless, the revive gather) are written longer than their picture;
// the cinematics stop them on the mark that ends them (src/cinematics/kart-f/wing_lady.ts). One recipe per beat.

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { midiHz, perc, type Env, type Pt, type Voice } from '../synth';
import { clank, crack, puff, scaled, sweep, thump } from './kit';

const A3 = 220;
const A4 = 440;
const E4 = midiHz(64);
const CS5 = midiHz(73);
const E5 = midiHz(76);
const A5 = midiHz(81);
const CS6 = midiHz(85);

/** The "aa" formant bank (Hz, q, gain). */
const AA: readonly (readonly [number, number, number])[] = [
  [800, 5, 1],
  [1150, 7, 0.72],
  [2900, 9, 0.34],
];

/**
 * One sung "aa" voice: saw + triangle on `f` (Hz or an envelope) through the formant bank, `env` the level
 * envelope, a vibrato that blooms after `vibAt` s, an optional breath on the onset.
 */
function sing(v: Voice, t: number, f: Env, env: readonly Pt[], o: { to?: AudioNode; breath?: number; vib?: number; vibAt?: number; bright?: number; body?: number } = {}): void {
  const d = env[env.length - 1][0];
  const sum = v.amp(1, { t, to: o.to });
  const src = v.amp(1, { t });
  for (const [ff, q, g] of AA) {
    const gg = v.amp(g * (ff > 2000 ? (o.bright ?? 1) : 1) * 3.2, { t, to: sum });
    src.connect(v.filt('bandpass', ff, q, { t, to: gg }));
  }
  const saw = v.tone('sawtooth', f, { t, g: env, to: src });
  const tri = v.tone('triangle', f, { t, g: scaled(env, o.body ?? 0.35), to: sum });
  const vib = o.vib ?? 11;
  const at = o.vibAt ?? 0.14;
  const depth: Pt[] = [[0, 0], [at, 0], [at + 0.12, vib]];
  v.lfo(saw.osc.detune, 5.5, depth, { t, d: d + 0.05 });
  v.lfo(tri.osc.detune, 5.5, depth, { t, d: d + 0.05 });
  if (o.breath) puff(v, t, o.breath, 0.12, 6000, { kind: 'white', to: v.filt('highpass', 3000, 0.7, { t, to: o.to }) });
}

/** A hummed "mm" (closed mouth): the same source through a low pass. */
function hum(v: Voice, t: number, f: Env, env: readonly Pt[], o: { to?: AudioNode } = {}): void {
  const lp = v.filt('lowpass', 520, 0.9, { t, to: o.to });
  v.tone('triangle', f, { t, g: env, to: lp });
  v.tone('sawtooth', f, { t, g: scaled(env, 0.25), to: lp, detune: 4 });
}

/** The hover thrum: band noise on `f` chopped at `rate` (Hz or envelope through the flutter). */
function thrum(v: Voice, t: number, d: number, g: readonly Pt[], o: { f?: number; rate?: number; to?: AudioNode; lp?: Env } = {}): void {
  const lp = v.filt('lowpass', o.lp ?? 2200, 0.8, { t, to: o.to });
  const bp = v.filt('bandpass', o.f ?? 900, 3, { t, to: lp });
  const fl = v.flutter(o.rate ?? 22, 0.75, { t, d, base: 0.25, to: bp });
  v.noise('pink', { t, d, g, to: fl });
}

/** One wing downstroke (a back-beat): a soft low thump + a pink air puff. */
function wingBeat(v: Voice, t: number, g: number, o: { to?: AudioNode } = {}): void {
  thump(v, t, 110, 70, g * 0.55, 0.08, { to: o.to });
  puff(v, t + 0.004, g * 0.7, 0.11, 650, { kind: 'pink', to: o.to });
  sweep(v, t, 0.12, [380, 700, 420], g * 0.25, { kind: 'pink', q: 1.4, peakAt: 0.3, to: o.to });
}

/** The blade "çink" (bronze steel, 1.9 kHz, ratio 2.4). */
function blade(v: Voice, t: number, g: number, dec: number, o: { to?: AudioNode } = {}): void {
  clank(v, 1900, t, g, dec, { ratio: 2.4, index: 1.6, click: 0.8, to: o.to });
}

/** The wing clap "PAH": two white puffs 12 ms apart (hp 1.2 kHz) over a small body thump. */
function clap(v: Voice, t: number, g: number, o: { to?: AudioNode } = {}): void {
  const hp = v.filt('highpass', 1200, 0.8, { t, to: o.to });
  v.noise('white', { t, g: perc(g, 0.035, 0.0008), to: hp });
  v.noise('white', { t: t + 0.012, g: perc(g * 0.85, 0.04, 0.0008), to: hp });
  thump(v, t, 140, 70, g * 0.5, 0.08, { to: o.to });
}

/** A light footfall tick (a toe on stone; she is light: no dust thud). */
function tick(v: Voice, t: number, g: number, o: { to?: AudioNode } = {}): void {
  crack(v, t, g, { hp: 900, lp: 2200, n: 1, dec: 0.01, to: o.to });
  thump(v, t, 260, 180, g * 0.3, 0.03, { to: o.to });
}

/** A held chord voice joining her song (slow attack: it JOINS the chord). */
function blessVoice(f: number): Recipe {
  return {
    cap: 6,
    gap: 0.01,
    verb: 0.5,
    duck: 0.25,
    play(v) {
      const e = v.echo(0.18, 0.2, { wet: 0.3 });
      sing(v, 0, f, [[0, 0], [0.04, 0.05], [0.5, 0.045], [0.9, 0.0001, 'e']], { to: e, vibAt: 0.1, bright: 0.8 });
      sing(v, 0, f, [[0, 0], [0.04, 0.05], [0.5, 0.045], [0.9, 0.0001, 'e']], { vibAt: 0.1, bright: 0.8 });
    },
  };
}

export const WING_LADY_RECIPES = {
  // ------------------------------------------------------------------ summon "Rüzgâr Kapısı"
  /** arrive (sustained): the approaching air of the low glide (a doppler fall), the thrum fading in at the end. */
  khGlideIn: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 1.3, [1200, 900, 600], 0.5, { kind: 'pink', q: 1.6, peakAt: 0.55 });
      sweep(v, 0.05, 1.2, [2200, 1600, 1100], 0.12, { kind: 'white', q: 2.2, peakAt: 0.5 });
      thrum(v, 0.5, 0.9, [[0, 0], [0.3, 0.12], [0.9, 0.0001, 'e']], { rate: 20 });
    },
  },
  /** One backwing beat of the brake (summon f4–f6; the strike's back-flaps at a lower volume). */
  khWingBeat: {
    cap: 6,
    gap: 0.02,
    verb: 0.25,
    duck: 0.2,
    vary: 0.03,
    play(v) {
      wingBeat(v, 0, 0.42);
    },
  },
  /** land (summon f7): the front toe touches — a light tick and the last soft air settling. */
  khBackwing: {
    cap: 3,
    gap: 0.05,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      tick(v, 0, 0.32);
      puff(v, 0.005, 0.12, 0.16, 500, { kind: 'pink' });
    },
  },
  /** The back foot (summon f8, the strike's touch down): one light tick. */
  khToe: {
    cap: 6,
    gap: 0.02,
    verb: 0.2,
    duck: 0.1,
    vary: 0.04,
    play(v) {
      tick(v, 0, 0.24);
    },
  },
  /** roar (summon salute f11, the roar anim): her song — A4 → E5 → A4 slurred "aa", breath on the onset, echo. */
  khSong: {
    cap: 2,
    gap: 0.2,
    verb: 0.55,
    duck: 0.55,
    play(v) {
      const e = v.echo(0.18, 0.22, { wet: 0.35 });
      const f: Pt[] = [[0, A4], [0.22, A4], [0.36, E5, 'e'], [0.62, E5], [0.78, A4, 'e'], [1.2, A4]];
      const env: Pt[] = [[0, 0], [0.05, 0.09], [0.4, 0.1], [0.9, 0.075], [1.25, 0.0001, 'e']];
      sing(v, 0, f, env, { to: e, breath: 0.06 });
      sing(v, 0, f, env, { breath: 0.0 });
      // a quiet octave-down hum under it (body, never a second melody)
      hum(v, 0.02, A3, [[0, 0], [0.1, 0.03], [0.9, 0.022], [1.2, 0.0001, 'e']]);
    },
  },
  // ------------------------------------------------------------------ Kanat Selamı (the chord counts the allies)
  khBless1: blessVoice(CS5),
  khBless2: blessVoice(E5),
  khBless3: blessVoice(A5),
  khBless4: blessVoice(CS6),
  /** One air current leaving her wingtip toward an ally (low-q air rising, never a whistle). */
  khCurrent: {
    cap: 6,
    gap: 0.01,
    verb: 0.3,
    duck: 0.15,
    play(v) {
      sweep(v, 0, 0.32, [600, 1800, 1300], 0.32, { kind: 'pink', q: 1.2, peakAt: 0.7 });
      sweep(v, 0.02, 0.26, [2400, 3200, 2600], 0.05, { kind: 'white', q: 1.5, peakAt: 0.6 });
    },
  },
  /** The crest blooming over an ally's ATK (and the declaration flare): a soft triangle pluck on A6 + a click. */
  khCrest: {
    cap: 6,
    gap: 0.01,
    verb: 0.4,
    duck: 0.1,
    play(v) {
      v.tone('triangle', midiHz(93), { g: perc(0.16, 0.12, 0.001) });
      v.tone('sine', midiHz(100), { g: perc(0.04, 0.06, 0.001) });
      crack(v, 0, 0.05, { hp: 3000, lp: 8000, n: 1, dec: 0.003 });
    },
  },
  /** The aura's loss (sustained): the chord voices bend down a semitone and drop out one by one; her root fades. */
  khUnbless: {
    cap: 2,
    gap: 0.05,
    verb: 0.5,
    duck: 0.25,
    play(v) {
      const e = v.echo(0.2, 0.25, { wet: 0.3 });
      // E5 and C#5 bend down a semitone and stop, staggered; the root A4 holds and fades
      sing(v, 0, [[0, E5], [0.08, E5], [0.2, E5 * 0.944, 'e']], [[0, 0], [0.03, 0.05], [0.14, 0.04], [0.24, 0.0001, 'e']], { to: e, vibAt: 0.3 });
      sing(v, 0.12, [[0, CS5], [0.08, CS5], [0.22, CS5 * 0.944, 'e']], [[0, 0], [0.03, 0.05], [0.16, 0.04], [0.28, 0.0001, 'e']], { to: e, vibAt: 0.3 });
      sing(v, 0, A4, [[0, 0], [0.05, 0.045], [0.4, 0.04], [0.85, 0.0001, 'e']], { to: e, vibAt: 0.2 });
    },
  },
  /** A floor light folding away toward her (per ally): a short falling air. */
  khPeel: {
    cap: 6,
    gap: 0.01,
    verb: 0.3,
    duck: 0.1,
    play(v) {
      sweep(v, 0, 0.3, [900, 700, 300], 0.26, { kind: 'pink', q: 1, peakAt: 0.25 });
    },
  },
  // ------------------------------------------------------------------ strike "Kerkenez Hamlesi"
  /** charge (sustained; the declaration holds it, the hover rides it): the wing thrum + a hummed A3. */
  khHover: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    duck: 0.3,
    play(v) {
      thrum(v, 0, 2.6, [[0, 0], [0.12, 0.2], [0.6, 0.3], [2.2, 0.28], [2.6, 0.0001, 'e']], { rate: 22 });
      hum(v, 0.05, A3, [[0, 0], [0.25, 0.05], [2.2, 0.045], [2.5, 0.0001, 'e']]);
    },
  },
  /** release (attack f5, the stoop): a quick fold "fwip" then rising air. */
  khStoop: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      puff(v, 0, 0.18, 0.04, 9000, { kind: 'white', att: 0.001 });
      crack(v, 0, 0.08, { hp: 2000, lp: 7000, n: 1, dec: 0.02 });
      sweep(v, 0.03, 0.24, [500, 1600, 1200], 0.4, { kind: 'pink', q: 1.3, peakAt: 0.75 });
    },
  },
  /** impact (attack f6): the wing clap "PAH" + the blade "çink" + a small body thump. */
  khClap: {
    cap: 3,
    gap: 0.04,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      // the wings rushing shut just before the PAH, the PAH, the blade ringing on after it
      sweep(v, 0, 0.14, [500, 1300, 700], 0.3, { kind: 'pink', q: 1.3, peakAt: 0.25 });
      clap(v, 0.008, 0.5);
      blade(v, 0.012, 0.42, 0.22);
      puff(v, 0.03, 0.14, 0.18, 1400, { kind: 'pink' });
    },
  },
  /** The direct contact accent: a short sung "a!" on C#5 + a lighter clap. */
  khDirectCry: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      sing(v, 0, [[0, CS5 * 1.03], [0.04, CS5, 'e']], [[0, 0], [0.012, 0.12], [0.1, 0.08], [0.22, 0.0001, 'e']], { breath: 0.05, vibAt: 0.3 });
      clap(v, 0, 0.42);
    },
  },
  /** Blocked contact: the blade scrapes along the guard at 1.9 kHz (matching her clank), damped. */
  khSkid: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      sweep(v, 0, 0.16, [1700, 1950, 2200], 0.3, { kind: 'white', q: 8, peakAt: 0.2 });
      blade(v, 0, 0.14, 0.05);
      crack(v, 0.03, 0.06, { hp: 1500, lp: 5000, n: 3, gap: 0.03, dec: 0.008 });
    },
  },
  /** The perch on the guard (talons on its top edge): a dry "tok". */
  khPerch: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    duck: 0.3,
    play(v) {
      crack(v, 0, 0.18, { hp: 900, lp: 4000, n: 1, dec: 0.012 });
      thump(v, 0, 320, 210, 0.22, 0.05);
    },
  },
  /** The kick-off from the perch: one strong wing beat with a rising air tail. */
  khKickOff: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      wingBeat(v, 0, 0.5);
      sweep(v, 0.02, 0.3, [500, 1200, 900], 0.22, { kind: 'pink', q: 1.2, peakAt: 0.5 });
    },
  },
  // ------------------------------------------------------------------ death "Düşen Pelerin"
  /** deathStart (death f1): the song breaks — a note on A4 slides down to E4 and cuts to breath. */
  khSongBreak: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.45,
    play(v) {
      sing(v, 0, [[0, A4], [0.05, A4], [0.17, E4, 'e']], [[0, 0], [0.015, 0.1], [0.15, 0.08], [0.175, 0.0001, 'e']], { vibAt: 0.0, vib: 18 });
      puff(v, 0.17, 0.12, 0.2, 2000, { kind: 'white' });
    },
  },
  /** The cape falls (death f2): a low feather fold "fwump" (pink lp 900 Hz). */
  khFold: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      puff(v, 0, 0.32, 0.07, 900, { kind: 'pink', att: 0.008 });
      thump(v, 0.006, 120, 80, 0.12, 0.06);
    },
  },
  /** dissolve (death f4): she tips forward under the cape — a soft descending air. */
  khFlatten: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      sweep(v, 0, 0.36, [420, 300, 150], 0.38, { kind: 'brown', q: 1.2, peakAt: 0.3 });
      sweep(v, 0, 0.3, [1400, 1000, 600], 0.06, { kind: 'pink', q: 1.5, peakAt: 0.3 });
    },
  },
  /** She lands flat (death f7): a cloth-soft thump. */
  khFallThud: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.4,
    play(v) {
      thump(v, 0, 80, 48, 0.42, 0.14);
      puff(v, 0.004, 0.14, 0.16, 700, { kind: 'brown' });
    },
  },
  /** burst (the bird lifts off her outline and flies to the graveyard): a receding air + her last note far away. */
  khBirdFlight: {
    cap: 2,
    gap: 0.1,
    verb: 0.6,
    duck: 0.5,
    play(v) {
      wingBeat(v, 0, 0.36);
      sweep(v, 0.02, 0.55, [1400, 900, 300], 0.32, { kind: 'pink', q: 1.3, peakAt: 0.3 });
      const e = v.echo(0.22, 0.35, { wet: 0.5, tone: 2600 });
      sing(v, 0.08, A5, [[0, 0], [0.06, 0.035], [0.3, 0.03], [0.6, 0.0001, 'e']], { to: e, vibAt: 0.05, bright: 0.6 });
    },
  },
  // ------------------------------------------------------------------ revive (soul_recall)
  /** reviveGather (sustained): approaching air rising + a hum climbing A3 → A4. */
  khReviveGather: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 1.4, [300, 900, 1200], 0.3, { kind: 'pink', q: 1.3, peakAt: 0.85 });
      hum(v, 0, [[0, A3], [1.1, A4, 'e'], [1.4, A4]], [[0, 0], [0.4, 0.04], [1.1, 0.06], [1.45, 0.0001, 'e']]);
    },
  },
  /** reviveLand: her first note (A4, short) + one backwing beat. */
  khReviveLand: {
    cap: 2,
    gap: 0.1,
    verb: 0.5,
    duck: 0.5,
    play(v) {
      wingBeat(v, 0, 0.45);
      const e = v.echo(0.18, 0.2, { wet: 0.3 });
      sing(v, 0.02, A4, [[0, 0], [0.04, 0.09], [0.3, 0.07], [0.55, 0.0001, 'e']], { to: e, breath: 0.05 });
    },
  },
} satisfies Record<string, Recipe>;

export type WingLadySfxName = keyof typeof WING_LADY_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry); ships with its strike + death cinematics. */
export const WING_LADY_VOICE: CharacterSounds | null = {
  roar: 'khSong',
  arrive: 'khGlideIn',
  land: 'khBackwing',
  charge: 'khHover',
  release: 'khStoop',
  impact: 'khClap',
  deathStart: 'khSongBreak',
  dissolve: 'khFlatten',
  afterDissolve: [[3, 'khFallThud', 0.9]],
  burst: 'khBirdFlight',
  reviveGather: 'khReviveGather',
  reviveLand: 'khReviveLand',
};
