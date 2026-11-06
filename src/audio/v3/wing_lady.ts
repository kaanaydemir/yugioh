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

/**
 * A held chord voice joining her song (slow attack: it JOINS the chord). Round 2 #1: every voice is HELD long enough
 * (≈ 1.0 s at level, 1.6 s to silence) that the second and third land while the earlier ones still sound, and each
 * is level-matched to the first (`lv`: the formant bank favours the voices whose 2nd harmonic sits on the 1150 Hz
 * formant — C#5 — so the others are trimmed up / down to land within 6 dB of it, measured with an FFT).
 */
function blessVoice(f: number, lv: number): Recipe {
  return {
    cap: 6,
    gap: 0.01,
    verb: 0.5,
    duck: 0.12,
    play(v) {
      const e = v.echo(0.18, 0.2, { wet: 0.3 });
      const env: Pt[] = [[0, 0], [0.06, 0.07 * lv], [0.95, 0.06 * lv], [1.6, 0.0001, 'e']];
      sing(v, 0, f, env, { to: e, vibAt: 0.12, bright: 0.8 });
      sing(v, 0, f, env, { vibAt: 0.12, bright: 0.8, body: 0.55 });
    },
  };
}

/**
 * The aura's loss for `k` buffed allies (round 2 #1): exactly k chord voices — the highest first — bend down a
 * semitone and drop out one by one (130 ms apart), leaving her root A4, which holds and fades last.
 */
function unblessVoices(k: number): Recipe {
  const voices = [CS5, E5, A5, CS6].slice(0, Math.max(1, Math.min(4, k))).reverse();
  return {
    cap: 2,
    gap: 0.05,
    verb: 0.5,
    duck: 0.25,
    play(v) {
      const e = v.echo(0.2, 0.25, { wet: 0.3 });
      voices.forEach((f, i) => {
        const t = i * 0.13;
        sing(v, t, [[0, f], [0.08, f], [0.22, f * 0.944, 'e']], [[0, 0], [0.03, 0.06], [0.16, 0.05], [0.28, 0.0001, 'e']], { to: e, vibAt: 0.3, body: 0.5 });
      });
      const end = voices.length * 0.13;
      sing(v, 0, A4, [[0, 0], [0.05, 0.05], [end + 0.25, 0.045], [end + 0.75, 0.0001, 'e']], { to: e, vibAt: 0.2, body: 0.5 });
    },
  };
}

/** One soft wing beat of the death bird (round 2 #6: on its flap frames), lighter and higher than hers alive. */
function birdBeat(v: Voice, t: number, g: number): void {
  thump(v, t, 150, 95, g * 0.35, 0.06);
  puff(v, t + 0.003, g * 0.75, 0.09, 900, { kind: 'pink' });
  sweep(v, t, 0.1, [500, 900, 560], g * 0.3, { kind: 'pink', q: 1.4, peakAt: 0.3 });
}

export const WING_LADY_RECIPES = {
  // ------------------------------------------------------------------ summon "Rüzgâr Kapısı"
  /**
   * arrive (sustained): round 2 #5 — it starts UNDER the card slam (the summon hook starts it, ≈ 0.34 s before the
   * glide) as a far air rising out of silence, then the approaching air of the low glide (a doppler fall) and the
   * thrum fading in at the end; the cinematic stops it 80 ms after the first backwing downstroke (the tail overlaps it).
   */
  khGlideIn: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      // far air: a high thin band rising out of nothing while the card lands (0–0.7 s)
      sweep(v, 0, 0.75, [2600, 1900, 1500], 0.22, { kind: 'white', q: 2.6, peakAt: 0.9 });
      sweep(v, 0.05, 0.7, [700, 1000, 1150], 0.32, { kind: 'pink', q: 1.4, peakAt: 0.92 });
      // the glide's doppler fall (the main body: she appears ≈ 0.7 s after the slam and glides ≈ 0.4 s)
      sweep(v, 0.6, 1.3, [1250, 900, 560], 0.8, { kind: 'pink', q: 1.6, peakAt: 0.45 });
      sweep(v, 0.64, 1.2, [2300, 1600, 1100], 0.2, { kind: 'white', q: 2.2, peakAt: 0.35 });
      // the brake: the thrum swells under the brake-flare and the first backwing beat
      thrum(v, 0.95, 1.1, [[0, 0], [0.3, 0.4], [0.75, 0.32], [1.1, 0.0001, 'e']], { rate: 20 });
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
  /**
   * land (summon f10): round 2 #5 — a layered settle with weight (≈ 10 dB over the old lone tick): the toe tick, the
   * wings folding (a pink rustle, lp 900, 80 ms), a short warm thump at 140 Hz, and a breathy hummed "hm" on A3.
   */
  khBackwing: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      tick(v, 0, 0.7);
      thump(v, 0.004, 150, 120, 0.85, 0.11, { drive: 1.2 });
      puff(v, 0.012, 0.75, 0.08, 900, { kind: 'pink', att: 0.006 });
      sweep(v, 0.02, 0.16, [700, 1100, 600], 0.3, { kind: 'pink', q: 1.3, peakAt: 0.3 });
      puff(v, 0.05, 0.09, 0.16, 3000, { kind: 'white', att: 0.02 });
      hum(v, 0.05, A3, [[0, 0], [0.04, 0.1], [0.16, 0.07], [0.34, 0.0001, 'e']]);
    },
  },
  /** The jewel glint two frames after the land (round 2 #5: bridges the land and the song): a soft A6 / E7 shimmer. */
  khJewel: {
    cap: 2,
    gap: 0.05,
    verb: 0.55,
    duck: 0.1,
    play(v) {
      const e = v.echo(0.11, 0.3, { wet: 0.4, tone: 5000 });
      v.tone('triangle', midiHz(93), { g: [[0, 0], [0.01, 0.07], [0.35, 0.0001, 'e']], to: e });
      v.tone('sine', midiHz(100), { t: 0.05, g: [[0, 0], [0.01, 0.04], [0.3, 0.0001, 'e']], to: e });
      puff(v, 0, 0.05, 0.25, 7000, { kind: 'white', att: 0.08 });
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
  khBless1: blessVoice(CS5, 1),
  khBless2: blessVoice(E5, 1.25),
  khBless3: blessVoice(A5, 1.1),
  khBless4: blessVoice(CS6, 1),
  /**
   * The chord's root (sustained; round 2 #1): her A4 held soft under every bless run whose song is not sounding
   * (arrival, a late bless, the flip / revive once the song has decayed) — the first bless voice is a dyad, not a
   * lone tone. The run stops it after the last voice has joined.
   */
  khBlessRoot: {
    cap: 2,
    gap: 0.05,
    verb: 0.5,
    duck: 0.1,
    play(v) {
      const e = v.echo(0.18, 0.2, { wet: 0.3 });
      const env: Pt[] = [[0, 0], [0.12, 0.08], [2.6, 0.072], [3.2, 0.0001, 'e']];
      sing(v, 0, A4, env, { to: e, vibAt: 0.2, bright: 0.7, body: 0.55 });
      hum(v, 0.02, A3, [[0, 0], [0.2, 0.02], [2.6, 0.018], [3.2, 0.0001, 'e']]);
    },
  },
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
  /** The aura's loss (sustained): the chord counts DOWN — khUnbless<k> drops exactly k voices; her root fades last. */
  khUnbless: unblessVoices(2),
  khUnbless1: unblessVoices(1),
  khUnbless2: unblessVoices(2),
  khUnbless3: unblessVoices(3),
  khUnbless4: unblessVoices(4),
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
  // ------------------------------------------------------------------ struck / guard (round 2 #2: CharacterSounds.struck)
  /**
   * Her guard "Kanat Kalkanı" takes a blow (the buckler wing): a feather-fan "frrp" (the thrum chopped by an AM that
   * falls 24 → 10 Hz over 120 ms), the 1.9 kHz ratio-2.4 parry tick of her blade, and a short breathed A4 "hm!".
   */
  khBuckler: {
    cap: 3,
    gap: 0.04,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      const am = v.ring([[0, 24], [0.12, 10, 'e'], [0.16, 10]], { d: 0.17, mix: 0.85 });
      const bp = v.filt('bandpass', 1000, 2.2, { to: am });
      v.noise('pink', { d: 0.16, g: [[0, 0], [0.006, 0.9], [0.06, 0.55], [0.15, 0.0001, 'e']], to: bp });
      thump(v, 0, 170, 110, 0.4, 0.06);
      blade(v, 0.01, 0.34, 0.12);
      hum(v, 0.03, A4, [[0, 0], [0.015, 0.12], [0.08, 0.07], [0.16, 0.0001, 'e']]);
      puff(v, 0.03, 0.1, 0.08, 4000, { kind: 'white' });
    },
  },
  /** Struck (light): the feathers ruffle and her breath catches — a short "ah" falling off C#5. */
  khStruck: {
    cap: 3,
    gap: 0.04,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      puff(v, 0, 0.5, 0.06, 1600, { kind: 'pink', att: 0.002 });
      thump(v, 0, 160, 100, 0.45, 0.07);
      sing(v, 0.02, [[0, CS5], [0.12, A4, 'e']], [[0, 0], [0.012, 0.09], [0.07, 0.06], [0.16, 0.0001, 'e']], { breath: 0.05, vibAt: 0.3 });
    },
  },
  /** Struck (heavy): a deeper body blow, the wings flaring with a rustle, the gasp lower and longer. */
  khStruckHeavy: {
    cap: 3,
    gap: 0.04,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      thump(v, 0, 120, 60, 0.85, 0.12, { drive: 1.5 });
      puff(v, 0, 0.6, 0.1, 1200, { kind: 'pink', att: 0.002 });
      sweep(v, 0.02, 0.2, [700, 1500, 800], 0.35, { kind: 'pink', q: 1.3, peakAt: 0.25 });
      sing(v, 0.03, [[0, CS5], [0.2, E4, 'e']], [[0, 0], [0.012, 0.11], [0.1, 0.07], [0.24, 0.0001, 'e']], { breath: 0.07, vibAt: 0.3, vib: 16 });
    },
  },
  /** Struck by magic: a fizz through the feathers and a high breathed "ih!" on E5. */
  khStruckMagic: {
    cap: 3,
    gap: 0.04,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      sweep(v, 0, 0.22, [3000, 5200, 2600], 0.25, { kind: 'white', q: 3, peakAt: 0.2 });
      thump(v, 0, 180, 120, 0.35, 0.06);
      sing(v, 0.02, [[0, E5], [0.14, CS5, 'e']], [[0, 0], [0.01, 0.08], [0.08, 0.05], [0.18, 0.0001, 'e']], { breath: 0.06, vibAt: 0.3, bright: 1.3 });
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
  /**
   * burst (the bird lifts off her outline and flies to the graveyard): round 2 #6 — +6 dB, the lift-off beat, a
   * receding air, and her last note (A5) far away with an echo tail long enough to ring over the card's landing.
   * The bird's further wing beats are khBirdBeat, fired on its flap frames.
   */
  khBirdFlight: {
    cap: 2,
    gap: 0.1,
    verb: 0.65,
    duck: 0.5,
    play(v) {
      birdBeat(v, 0, 0.9);
      sweep(v, 0.02, 0.6, [1400, 900, 300], 0.62, { kind: 'pink', q: 1.3, peakAt: 0.3 });
      const e = v.echo(0.22, 0.45, { wet: 0.6, tone: 2600 });
      sing(v, 0.08, A5, [[0, 0], [0.06, 0.075], [0.34, 0.06], [0.7, 0.0001, 'e']], { to: e, vibAt: 0.05, bright: 0.6 });
    },
  },
  /** One wing beat of the death bird in flight (on its downstroke frames; panned along its path). */
  khBirdBeat: {
    cap: 6,
    gap: 0.03,
    verb: 0.5,
    duck: 0.15,
    vary: 0.04,
    play(v) {
      birdBeat(v, 0, 0.7);
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
  /**
   * reviveLand: one backwing beat and the toe settling, an indrawn breath — no sung note (round 2 #8: the revive's
   * song (khSong, the roar) starts on this same frame and is her ONE voice; two A4 onsets at once sounded doubled).
   */
  khReviveLand: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.5,
    play(v) {
      wingBeat(v, 0, 0.6);
      tick(v, 0.03, 0.4);
      puff(v, 0.0, 0.1, 0.18, 3500, { kind: 'white', att: 0.1 });
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
  // round 2 #2: her own struck body and her guard's buckler (hitSoundFor): no generic impact / shield bell on her
  struck: { light: 'khStruck', heavy: 'khStruckHeavy', magic: 'khStruckMagic', guard: 'khBuckler' },
  deathStart: 'khSongBreak',
  dissolve: 'khFlatten',
  afterDissolve: [[3, 'khFallThud', 0.9]],
  burst: 'khBirdFlight',
  reviveGather: 'khReviveGather',
  reviveLand: 'khReviveLand',
};
