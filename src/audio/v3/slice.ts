// v3 slice sounds (docs/ANIMASYON_PLANI.md §5b, A2): the sound identity of Kristal Ejder and
// Uçurum Büyücüsü, material impacts, Yıldırım Hükmü, Işık Zincirleri and the v3 spell / trap
// openings. Added to the game's recipe table additively (src/audio/sounds.ts spreads V3_RECIPES;
// SfxName gains V3SfxName) — the 59 original recipes are untouched and the old look never plays
// these. The cinematics fire each one on an animation mark (src/cinematics/_v3/sound.ts); the
// sustained ones (charges, the beam, gathers, the storm bed) are faded out by the next mark
// through sfx.start(...).stop(), so a sound never outlives its picture at any game speed.
//
// Character palettes (one parameter set each over ./kit.ts):
//   Kristal Ejder   key of E; glass = free-free bar modes (1 : 2.76 : 5.40) on the E-major
//                   pentatonic E6–B7; a deep formant growl (52–96 Hz folds, formants 330 / 760 /
//                   1950 Hz); every big beat ends in a glass shimmer tail. Bright: most of its
//                   energy above 1 kHz except the roar's chest.
//   Uçurum Büyücüsü D with its tritone G#; a detuned saw drone on D1 / D2 (37 / 73 Hz) through a
//                   slowly opening lowpass, pink "breath", gritty flutter, metal armour (FM 1.41
//                   clank) and cloth (low-passed flutter). Dark: most energy under 600 Hz.
// Materials (the struck body): crystal (the wyrm), metal armour (the magus struck by a body),
// cloth + shadow (the magus struck by magic); × light / heavy / magic: weight = sub + drive,
// light = shorter, higher; magic = a ring-modulated sizzle and a longer, brighter tail.

import type { Recipe } from '../sounds';
import { ahr, midiHz, perc, swell, type Pt, type Voice } from '../synth';
import { clank, crack, drone, glassBell, glassRain, glassReverse, growl, link, puff, scaled, sweep, thump } from './kit';

// ================================================================ palettes

/** Kristal Ejder: E-major pentatonic glass, E6 … B7. */
const WYRM_GLASS = [88, 90, 92, 95, 97, 100, 102, 104, 107] as const;
const WYRM_LOW = [76, 80, 83, 88] as const; // E5 G#5 B5 E6 (the deep ring of the body)
/** Uçurum Büyücüsü: D1 drone, D2, the tritone G#. */
const MAGUS_D1 = midiHz(26); // 36.7 Hz
const MAGUS_D2 = midiHz(38); // 73.4 Hz

export type Material = 'crystal' | 'metal' | 'cloth';
export type HitWeight = 'Light' | 'Heavy' | 'Magic';

interface MaterialParams {
  /** Body thump: f0 → f1 (Hz), level, decay. */
  thump: readonly [number, number, number, number];
  /** Surface transient: band centre (Hz), level. */
  surf: readonly [number, number];
  /** The material's own ring. */
  ring(v: Voice, t: number, k: number, w: HitWeight): void;
  /** The magic variant's sizzle centre (Hz). */
  sizzle: number;
}

const MATERIALS: Record<Material, MaterialParams> = {
  // glass: a hard click, a short low knock, the body rings in bar modes (E5 / B5), shards tinkle
  crystal: {
    thump: [170, 58, 0.55, 0.22],
    surf: [4200, 0.5],
    ring(v, t, k, w) {
      const base = w === 'Light' ? midiHz(83) : midiHz(76);
      glassBell(v, base, t, 0.085 * k, w === 'Light' ? 0.35 : 0.8, { modes: 4 });
      glassBell(v, base * 1.498, t + 0.004, 0.05 * k, w === 'Light' ? 0.25 : 0.55);
      glassRain(v, { t: t + 0.01, d: w === 'Light' ? 0.18 : 0.42, n: w === 'Light' ? 4 : 9, g: 0.035 * k, notes: WYRM_GLASS, curve: 1.6, dec: [0.05, 0.18] });
    },
    sizzle: 3300,
  },
  // armour: a dry clank (FM 1.41 inharmonic plate), a dull knock under it, a short buzz of the plate
  metal: {
    thump: [150, 46, 0.6, 0.2],
    surf: [2600, 0.45],
    ring(v, t, k, w) {
      // (its own register, clear of the crystal's E5 / B5 bar modes: a plate, not a bell)
      const f = w === 'Light' ? 760 : 470;
      clank(v, f, t, 0.1 * k, w === 'Light' ? 0.28 : 0.6, { ratio: 1.41, index: 3.2, click: 1.6 });
      if (w !== 'Light') clank(v, f * 2.2, t + 0.012, 0.045 * k, 0.35, { ratio: 2.76, index: 1.5, click: 0 });
    },
    sizzle: 2200,
  },
  // cloth + shadow: no ring — a muffled thud, the robe snapping, a dark exhale of the shadow
  cloth: {
    thump: [120, 40, 0.65, 0.26],
    surf: [900, 0.3],
    ring(v, t, k, w) {
      // the robe snaps (a short flutter of noise: a light blow high and quick, a heavy one low and
      // long) and the shadow exhales (pink, falling)
      const light = w === 'Light';
      const flap = v.flutter(light ? 64 : 40, 0.6, { t, d: light ? 0.1 : 0.2, base: 0.4, to: v.filt('bandpass', light ? 2100 : 1000, 1.1) });
      v.noise('white', { t, g: perc((light ? 0.3 : 0.22) * k, light ? 0.07 : 0.16, 0.003), to: flap });
      v.noise('pink', { t: t + 0.01, g: [[0, 0], [0.04, 0.3 * k], [light ? 0.16 : 0.6, 0.0001, 'e']], to: v.filt('lowpass', [[0, light ? 2200 : 1000], [0.5, 160, 'e']], 1.2, { t: t + 0.01 }) });
      if (w === 'Heavy') v.tone('sawtooth', [[0, 82], [0.5, 46, 'e']], { t, g: perc(0.06 * k, 0.5, 0.01), to: v.filt('lowpass', 260, 1) });
    },
    sizzle: 1600,
  },
};

/** One material × weight impact recipe (the struck body's own sound at the contact frame). */
function materialHit(mat: Material, w: HitWeight): Recipe {
  const P = MATERIALS[mat];
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
      const [f0, f1, g, dec] = P.thump;
      // the surface transient: the loudest few ms of the whole beat
      crack(v, 0, (heavy ? 0.55 : 0.4) * P.surf[1] * 2, { hp: P.surf[0] * 0.6, dec: heavy ? 0.014 : 0.009 });
      v.noise('white', { g: perc(0.3 * k, 0.03, 0.0005), to: v.filt('bandpass', P.surf[0], 1.3) });
      // weight: the body knock (heavy = deeper, longer, saturated)
      // (a spell's blow comes with the spell's own impact — the breath, the orb, the bolt — which
      // owns the sub: the magic variant's knock sits an octave up, shorter, so the two never mask)
      if (magic) thump(v, 0, f0 * 1.7, f1 * 2.4, g * k * 0.7, dec * 0.7, { drive: 1.4 });
      else thump(v, 0, heavy ? f0 * 0.85 : f0 * 1.25, heavy ? f1 * 0.8 : f1 * 1.2, g * k * (heavy ? 1.15 : 1), heavy ? dec * 1.8 : dec, { drive: heavy ? 2.2 : 1.4 });
      if (heavy) puff(v, 0.004, 0.35, 0.35, 900, { kind: 'brown' });
      P.ring(v, 0, k, w);
      if (magic) {
        // the spell's sizzle: ring-modulated noise around the material's band, a bright tail
        const rm = v.ring([[0, 1100], [0.35, 420, 'e']], { d: 0.45, mix: 1, to: v.filt('bandpass', P.sizzle, 1.4) });
        v.noise('white', { g: [[0, 0], [0.01, 0.32], [0.45, 0.0001, 'e']], to: rm });
        v.crackle({ t: 0.02, d: 0.4, n: 14, g: 0.12, f: P.sizzle * 1.4, q: 1, curve: 1.5, dec: 0.006 });
      }
    },
  };
}

// ================================================================ Kristal Ejder

const wyrm: Record<string, Recipe> = {
  /** The roar (cut-in eyes / summon reveal): a deep layered growl + chest + a crystal shimmer tail. */
  wyrmRoar: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.65,
    vary: 0.03,
    play(v) {
      const D = 1.5;
      growl(v, 0, { d: D, f: [50, 96, 86, 66, 42], formants: [330, 760, 1950], g: 0.95, grit: 4.5, rasp: 34 });
      // chest: felt more than heard
      v.tone('sine', [[0, 41], [0.25, 49, 'e'], [D, 33, 'e']], { g: [[0, 0], [0.08, 0.26], [0.7, 0.18], [D, 0.0001, 'e']] });
      // the crystal body resonates with the roar: E5 / B5 / E6 bar partials that swell with it
      for (const [m, g] of [
        [76, 0.035],
        [83, 0.03],
        [88, 0.026],
      ] as const) {
        const s = v.tone('sine', midiHz(m), { g: [[0, 0], [0.35, g], [1.1, g * 0.8], [1.9, 0.0001, 'e']] });
        v.lfo(s.osc.detune, 5.5, 12, { d: 1.9 });
        v.tone('sine', midiHz(m) * 2.756, { g: [[0, 0], [0.4, g * 0.35], [1.4, 0.0001, 'e']] });
      }
      // shimmer tail: glass rain thinning out as the roar dies, air on top
      glassRain(v, { t: 0.5, d: 1.4, n: 22, g: 0.05, notes: WYRM_GLASS, curve: 1.3, dec: [0.12, 0.45], fade: 0.8, spread: 0.7 });
      v.noise('white', { t: 0.4, g: [[0, 0], [0.5, 0.05], [1.5, 0.0001, 'e']], to: v.filt('highpass', 7500) });
    },
  },
  /** Glassy crystalline resonance (the prism shaft arrives / the wings burst open). */
  wyrmChime: {
    cap: 2,
    gap: 0.08,
    verb: 0.6,
    duck: 0.3,
    play(v) {
      const chord = [88, 92, 95, 100] as const;
      chord.forEach((m, i) => {
        glassBell(v, midiHz(m), i * 0.018, 0.09 - i * 0.01, 1.3, { modes: 3 });
        // a slow beating pair under each (the shimmer of a crystal, not a pure bell)
        v.tone('sine', midiHz(m) * 1.0035, { t: i * 0.018, g: [[0, 0], [0.06, 0.022], [1.4, 0.0001, 'e']] });
      });
      v.noise('white', { g: swell(0.05, 0.12, 0.6), to: v.filt('highpass', 6500) });
      glassRain(v, { t: 0.05, d: 0.7, n: 8, g: 0.03, notes: WYRM_GLASS, curve: 1.2, dec: [0.1, 0.3] });
    },
  },
  /**
   * The landing (summon 'land'): a heavy body on marble, claws clicking, the crystal body ringing.
   * Its attack is glass, not only weight (sound QA #12: 97 % of it sat under 600 Hz, too close to
   * the magus' landing): a bright crystal click and an E6 / E7 bar ring start with the thump.
   */
  wyrmLand: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      thump(v, 0, 130, 40, 0.5, 0.42, { drive: 2 });
      v.tone('triangle', [[0, 240], [0.07, 95, 'e']], { g: perc(0.2, 0.1, 0.001) });
      puff(v, 0.006, 0.34, 0.3, 1600, { kind: 'pink' });
      // the glass E-ring on the impact itself: a crystal click and the struck bar (E6 + E7)
      crack(v, 0, 0.4, { hp: 4200, n: 2, gap: 0.006, dec: 0.006 });
      glassBell(v, midiHz(88), 0.001, 0.1, 0.6, { modes: 4, att: 0.0005 });
      glassBell(v, midiHz(100), 0.003, 0.06, 0.4, { modes: 2, att: 0.0005 });
      glassBell(v, midiHz(95), 0.006, 0.04, 0.45, { modes: 2, att: 0.0005 });
      // claws on stone: two quick clicks
      for (const t of [0.004, 0.032]) v.noise('white', { t, g: perc(0.22, 0.006, 0.0002), to: v.filt('bandpass', 3800, 2) });
      // the deep ring of the body under it
      glassBell(v, midiHz(76), 0.01, 0.05, 0.7, { modes: 3 });
      glassBell(v, midiHz(83), 0.014, 0.03, 0.5, { modes: 2 });
      glassRain(v, { t: 0.02, d: 0.3, n: 7, g: 0.035, notes: WYRM_GLASS, curve: 1.6, dec: [0.05, 0.18] });
    },
  },
  /**
   * Prism breath charge (rising shimmer): an inhale, then glass rising in the jaws. Peaks at ~0.5 s
   * (the strike's charge frames up to the release), holds, and is faded at the release.
   */
  wyrmBreathCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const D = 0.5;
      const H = D + 0.35; // plateau (a late release), then a natural fade
      const E = H + 0.15;
      const hold = (g: number, from = 0): Pt[] => [[0, from], [D, g], [H, g], [E, 0.0001, 'e']];
      // the inhale: a falling breath of filtered noise
      sweep(v, 0, 0.26, [900, 600, 260], 0.16, { q: 1.2, kind: 'pink', peakAt: 0.4 });
      // rising tone pair (glass hum) with a vibrato that quickens
      for (const [det, g] of [
        [0, 0.05],
        [9, 0.04],
      ] as const) {
        const s = v.tone('sine', [[0, 330], [D, 1320, 'e'], [E, 1420, 'e']], { g: hold(g, 0.0001), detune: det });
        v.lfo(s.osc.detune, [[0, 4], [D, 14, 'e']], [[0, 6], [D, 22]], { d: E });
      }
      // noise riser (the light gathering)
      v.noise('white', { g: [[0, 0.0001], [D, 0.13, 'e'], [H, 0.13], [E, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1500], [D, 8500, 'e']], 1.6) });
      // the glass arpeggio climbs E5 → E8, faster and louder, then trills on the top
      const notes = [76, 80, 83, 88, 92, 95, 100, 104, 107, 112, 107, 112, 107, 112];
      let t = 0.06;
      notes.forEach((m, i) => {
        if (t > H) return;
        glassBell(v, midiHz(m), t, 0.02 + Math.min(i, 8) * 0.004, 0.1, { modes: 2 });
        t += Math.max(0.035, 0.065 - i * 0.004);
      });
      v.tone('sine', [[0, 46], [D, 70, 'e']], { g: hold(0.16) });
    },
  },
  /** Prism breath fire (bright sustained beam with harmonics). Faded when the beam thins out. */
  wyrmBreathFire: {
    cap: 2,
    gap: 0.08,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      const S = 0.42;
      // the jaws snap open: a crack and a kick
      crack(v, 0, 0.32, { hp: 3000, n: 2, gap: 0.009 });
      thump(v, 0, 160, 52, 0.42, 0.28, { drive: 1.8 });
      // the beam: a harmonic stack on E3 (organ partials + a bright saw an octave up), opening filter
      const body: Pt[] = [[0, 0], [0.018, 0.1], [S, 0.075], [S + 0.3, 0.0001, 'e']];
      const lp = v.filt('lowpass', [[0, 9000], [S + 0.3, 2400, 'e']], 1.2);
      const am = v.flutter(31, 0.18, { d: S + 0.32, base: 0.85, to: lp });
      v.tone('organ', [[0, midiHz(52) * 1.5], [0.06, midiHz(52), 'e']], { g: body, to: am });
      v.tone('organ', midiHz(52) * 1.005, { g: scaled(body, 0.7), to: am });
      v.tone('sawtooth', midiHz(64), { g: scaled(body, 0.45), to: am, detune: 6 });
      v.tone('sawtooth', midiHz(71), { g: scaled(body, 0.28), to: am, detune: -8 });
      // the glass harmonics ringing along the beam (E6 B6 E7 B7), shimmering
      for (const [m, g] of [
        [88, 0.04],
        [95, 0.03],
        [100, 0.024],
        [107, 0.014],
      ] as const) {
        const s = v.tone('sine', midiHz(m), { g: [[0, 0], [0.03, g], [S, g * 0.8], [S + 0.35, 0.0001, 'e']] });
        v.lfo(s.osc.detune, 7 + m * 0.03, 14, { d: S + 0.36 });
      }
      // the beam's hiss
      v.noise('white', { g: [[0, 0], [0.02, 0.09], [S, 0.06], [S + 0.3, 0.0001, 'e']], to: v.filt('bandpass', [[0, 6000], [S, 3500, 'e']], 0.9) });
    },
  },
  /** The breath lands: crystal impact — a sharp glass burst and a low thump, shards raining. */
  wyrmBreathImpact: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.55,
    play(v) {
      crack(v, 0, 0.7, { hp: 3500, n: 3, gap: 0.008, dec: 0.01 });
      thump(v, 0, 120, 36, 0.8, 0.45, { drive: 2.2 });
      puff(v, 0.003, 0.3, 0.25, 2500, { kind: 'white' });
      glassBell(v, midiHz(88), 0.002, 0.07, 0.9, { modes: 4 });
      glassBell(v, midiHz(95), 0.006, 0.05, 0.7, { modes: 3 });
      glassRain(v, { t: 0.01, d: 0.55, n: 16, g: 0.06, notes: WYRM_GLASS, curve: 1.8, dec: [0.05, 0.22], spread: 0.7 });
    },
  },
  /** Death, first beat: the cracks run through the crystal (accelerating ticks, a strained creak). */
  wyrmCrack: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      const D = 0.36;
      const times: number[] = [];
      const gains: number[] = [];
      let t = 0;
      for (let i = 0; t < D; i++) {
        times.push(t);
        gains.push(0.26 + 0.6 * (t / D) * v.r(0.6, 1));
        t += Math.max(0.012, 0.075 * Math.pow(0.82, i)) * v.r(0.8, 1.2);
      }
      v.bursts(times, gains, { dec: 0.007, f: 4200, q: 1.6 });
      v.bursts(times.filter((_, i) => i % 3 === 0), gains.filter((_, i) => i % 3 === 0).map((g) => g * 0.8), { dec: 0.02, f: 1400, q: 2 });
      // the crystal under strain: a high, slowly bending glass tone
      v.tone('sine', [[0, midiHz(100)], [D, midiHz(99), 'e']], { g: [[0, 0], [0.2, 0.05], [D + 0.1, 0.0001, 'e']] });
      v.tone('sine', [[0, midiHz(100) * 1.006], [D, midiHz(99) * 0.996, 'e']], { g: [[0, 0], [0.2, 0.04], [D + 0.1, 0.0001, 'e']] });
    },
  },
  /** Death, dissolve mark: the knees buckle (a heavy knock) and the light drains (a falling glass tone). */
  wyrmDrain: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      thump(v, 0, 110, 36, 0.32, 0.4, { drive: 1.6 });
      puff(v, 0.01, 0.18, 0.3, 1100, { kind: 'brown' });
      for (const [m, g] of [
        [100, 0.04],
        [95, 0.025],
      ] as const) {
        const s = v.tone('sine', [[0, midiHz(m)], [0.6, midiHz(m - 24), 'e']], { g: [[0, 0], [0.02, g], [0.6, 0.0001, 'e']] });
        v.lfo(s.osc.detune, 9, 25, { d: 0.62 });
      }
      v.crackle({ t: 0.02, d: 0.5, n: 10, g: 0.08, f: 5000, q: 1.2, curve: 1.2, dec: 0.006 });
    },
  },
  /** Death, the body breaks: a shatter cascade (glass falling apart) → a fading ring. */
  wyrmShatter: {
    cap: 2,
    gap: 0.05,
    verb: 0.55,
    duck: 0.45,
    play(v) {
      crack(v, 0, 0.38, { hp: 2500, n: 3, gap: 0.012, dec: 0.014 });
      thump(v, 0, 140, 40, 0.3, 0.35, { drive: 1.6 });
      v.noise('white', { g: perc(0.25, 0.45, 0.002), to: v.filt('bandpass', [[0, 7000], [0.5, 3000, 'e']], 0.8) });
      // the cascade: dense at first, the shards bouncing and settling on the floor
      glassRain(v, { t: 0.005, d: 0.85, n: 30, g: 0.065, notes: WYRM_GLASS, curve: 1.9, dec: [0.04, 0.2], spread: 0.8 });
      glassRain(v, { t: 0.15, d: 0.7, n: 10, g: 0.04, notes: WYRM_LOW, curve: 1.4, dec: [0.08, 0.3], spread: 0.6 });
      // the fading ring: the crystal's last light, slowly beating out
      for (const [m, g, dec] of [
        [76, 0.04, 1.9],
        [88, 0.03, 1.6],
        [95, 0.02, 1.3],
      ] as const) {
        glassBell(v, midiHz(m), 0.02, g, dec, { modes: 2 });
        v.tone('sine', midiHz(m) * 1.004, { t: 0.02, g: perc(g * 0.7, dec, 0.01) });
      }
    },
  },
  /** Revive: glass gathering in reverse (swelling pings, faster and faster) — faded at the lock (the 'land' mark). */
  wyrmReviveGather: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    duck: 0.3,
    play(v) {
      const D = 0.36;
      const H = D + 0.3;
      const E = H + 0.12;
      // reverse shimmer: each ping swells up and stops dead, closer and closer together
      let t = 0;
      const notes = [80, 83, 85, 88, 90, 92, 95, 97, 100, 102, 104, 107];
      for (let i = 0; t < H; i++) {
        const rise = Math.max(0.035, 0.1 - i * 0.008);
        glassReverse(v, midiHz(notes[i % notes.length]), t, 0.022 + Math.min(i, 8) * 0.0025, rise);
        t += rise * 0.6;
      }
      // a reversed noise swell and a low hum rising under it
      v.noise('white', { g: [[0, 0.0001], [D, 0.11, 'e'], [H, 0.11], [E, 0.0001, 'e']], to: v.filt('bandpass', [[0, 9000], [D, 2500, 'e']], 1.4) });
      v.tone('sine', [[0, 82], [D, 165, 'e']], { g: [[0, 0], [D, 0.12], [H, 0.12], [E, 0.0001, 'e']] });
    },
  },
  /** Revive, land mark: the last fragment locks in (a glass click, a clunk, a short ring). */
  wyrmReviveLock: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.35,
    play(v) {
      crack(v, 0, 0.55, { hp: 4500, dec: 0.006 });
      v.tone('sine', [[0, 2900], [0.03, 2500, 'e']], { g: perc(0.14, 0.08, 0.0005) });
      thump(v, 0, 150, 55, 0.62, 0.2, { drive: 1.6 });
      glassBell(v, midiHz(88), 0.005, 0.06, 1.1, { modes: 3 });
      glassBell(v, midiHz(95), 0.012, 0.035, 0.8, { modes: 2 });
    },
  },
};

// ================================================================ Uçurum Büyücüsü

const magus: Record<string, Recipe> = {
  /** Presence (summon start: the rift opens): the low dark hum / drone, a tear in the floor. */
  magusPresence: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      const D = 1.9;
      // the rift tears open: a gritty downward rip
      const rip = v.flutter(60, 0.5, { d: 0.45, base: 0.5, to: v.filt('bandpass', [[0, 1800], [0.4, 350, 'e']], 1.3) });
      v.noise('white', { g: [[0, 0], [0.03, 0.3], [0.42, 0.0001, 'e']], to: v.drive(3, { to: rip, trim: 0.6 }) });
      // the drone: D1 / D2 + the tritone creeping in, the lowpass opening as it rises
      drone(v, 0.05, D, MAGUS_D1, 0.12, { lp: [140, 620, 160], tritone: 0.5, beat: 0.45 });
      // the shadow breathes
      v.noise('pink', { g: [[0, 0], [0.6, 0.14], [D, 0.0001, 'e']], to: v.filt('lowpass', [[0, 300], [0.7, 900, 'e'], [D, 200, 'e']], 1.2) });
      // the eyes ignite: a dim high tone on the tritone
      v.tone('sine', midiHz(68), { t: 0.55, g: [[0, 0], [0.15, 0.025], [0.9, 0.0001, 'e']] });
    },
  },
  /** The cut-in (the eyes flare): a dark vocal chord (formant saws on D, A, the tritone) + a sub. */
  magusCall: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    duck: 0.6,
    play(v) {
      const D = 1.3;
      const out = v.amp(1);
      // a choir-ish vowel "oo → ah": two formant bands over saws
      const split = v.amp(1, { to: v.filt('bandpass', [[0, 380], [0.4, 700, 'e'], [D, 450, 'e']], 4, { to: out }) });
      split.connect(v.filt('bandpass', [[0, 900], [0.4, 1150, 'e'], [D, 800, 'e']], 6, { to: out }));
      for (const [m, det] of [
        [38, 0],
        [45, 6],
        [44, -5],
        [50, 4],
      ] as const)
        v.tone('sawtooth', midiHz(m), { g: [[0, 0], [0.12, 0.11], [0.6, 0.085], [D, 0.0001, 'e']], to: split, detune: det + v.r(-4, 4) });
      thump(v, 0, 90, 28, 0.35, 0.9, { drive: 1.8 });
      drone(v, 0, D, MAGUS_D1, 0.08, { lp: [200, 500, 150], beat: 0.5 });
      v.noise('pink', { g: swell(0.12, 0.08, 0.5), to: v.filt('lowpass', 1200) });
    },
  },
  /** The landing at its float: a soft dark whoomp, the cloak settling, an armour clink. */
  magusLand: {
    cap: 2,
    gap: 0.06,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      v.tone('sine', [[0, 95], [0.25, 42, 'e']], { g: perc(0.55, 0.38, 0.025), to: v.drive(1.4, { trim: 0.85 }) });
      puff(v, 0, 0.32, 0.35, 700, { kind: 'pink', att: 0.02 });
      const flap = v.flutter(42, 0.55, { d: 0.22, base: 0.4, to: v.filt('bandpass', 1100, 1.2) });
      v.noise('white', { g: perc(0.16, 0.18, 0.01), to: flap });
      clank(v, 1180, 0.03, 0.035, 0.22, { ratio: 1.41, index: 2.2, click: 1 });
    },
  },
  /** Staff charge (rising dark pulse): a pulsing low stack whose pulse quickens and filter opens. Faded at the release. */
  magusCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      const D = 0.45;
      const H = D + 0.35;
      const E = H + 0.15;
      const lp = v.filt('lowpass', [[0, 260], [D, 1900, 'e'], [E, 1900]], 4);
      const pulse = v.ring([[0, 4], [D, 17, 'e'], [E, 18]], { d: E + 0.02, mix: 0.75, to: lp });
      const env: Pt[] = [[0, 0], [0.08, 0.06], [D, 0.14], [H, 0.14], [E, 0.0001, 'e']];
      v.tone('sawtooth', MAGUS_D2, { g: env, to: pulse });
      v.tone('sawtooth', MAGUS_D2 * 1.007, { g: scaled(env, 0.8), to: pulse });
      v.tone('square', MAGUS_D2 * Math.SQRT2, { t: 0.12, g: scaled(env, 0.35), to: pulse });
      v.tone('sine', [[0, 55], [D, 110, 'e']], { g: [[0, 0], [D, 0.2], [H, 0.2], [E, 0.0001, 'e']] });
      // the runes kindle: soft dark ticks, denser toward the release
      v.crackle({ t: 0.05, d: D, n: 12, g: 0.07, f: 1800, q: 2, curve: 0.6, dec: 0.012, kind: 'pink' });
    },
  },
  /**
   * The staff swing over the head (its smear frame): a cloth-and-staff whoosh. It peaks inside the
   * smear's own 50 ms (sweep 0 → 32 ms, gone by 90 ms) and is out of the way of the release pop
   * three frames later (sound QA S2: it peaked 105 ms in, on top of the release).
   */
  magusSwing: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    vary: 0.04,
    play(v) {
      sweep(v, 0, 0.09, [420, 1500, 600], 0.9, { q: 1.8, pan: [-0.3, 0.3], peakAt: 0.35 });
      const flap = v.flutter(55, 0.5, { d: 0.1, base: 0.45, to: v.filt('bandpass', 900, 1) });
      v.noise('pink', { g: [[0, 0], [0.028, 0.35], [0.09, 0.0001, 'e']], to: flap });
    },
  },
  /**
   * The orb leaves the staff tip (release): a dark pop and the void's whoosh after it — all of it
   * under a 1.2 kHz lowpass (sound QA #12: dark, clearly apart from the wyrm's bright beam crack).
   */
  magusOrbRelease: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      const dark = v.filt('lowpass', 1200, 0.8);
      v.tone('sine', [[0, 210], [0.12, 55, 'e']], { g: perc(0.42, 0.18, 0.001), to: v.drive(2.2, { to: dark, trim: 0.8 }) });
      v.noise('white', { g: perc(0.3, 0.02, 0.0004), to: v.filt('lowpass', 1100, 0.8, { to: dark }) });
      sweep(v, 0.02, 0.36, [1100, 700, 260], 0.36, { q: 1.4, pan: [-0.2, 0.4], peakAt: 0.25, to: dark });
      // the void warbles (low FM)
      v.bell(110, { t: 0.01, g: 0.12, dec: 0.3, ratio: 0.5, index: 3, idxDec: 0.2, to: dark });
    },
  },
  /** The orb arrives: it pulls in like a vortex, then bursts dark (contact). */
  magusOrbBurst: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.5,
    play(v) {
      // the burst on contact (its sub is a little under the first version's: the orb lands out of a
      // quiet flight, nothing compresses it — it was 3 dB over the wyrm's breath contact, sound QA #11)
      v.tone('sine', [[0, 140], [0.35, 30, 'e']], { g: perc(0.5, 0.45, 0.002), to: v.drive(2.6, { trim: 0.75 }) });
      v.noise('white', { g: perc(0.35, 0.012, 0.0003), to: v.filt('bandpass', 1800, 1) });
      puff(v, 0.002, 0.34, 0.35, 1200, { kind: 'pink' });
      // the vortex: a sucking swell (reverse envelope, falling) right after, then a second dark pop
      v.noise('pink', { t: 0.03, g: [[0, 0.0001], [0.14, 0.25, 'e'], [0.16, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2400], [0.15, 300, 'e']], 2, { t: 0.03 }) });
      v.tone('sine', [[0, 90], [0.3, 32, 'e']], { t: 0.18, g: perc(0.26, 0.3, 0.003) });
      v.crackle({ t: 0.18, d: 0.4, n: 12, g: 0.1, f: 900, q: 1.4, curve: 1.6, dec: 0.015, kind: 'pink' });
    },
  },
  /** The effect's tendril from the staff tip to the card: a gritty sweep. */
  magusTendril: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const D = 0.55;
      const grit = v.flutter(70, 0.65, { d: D + 0.05, base: 0.4, to: v.filt('bandpass', [[0, 300], [D * 0.7, 1900, 'e'], [D, 900, 'e']], 1.8) });
      v.noise('white', { g: [[0, 0], [D * 0.6, 0.6], [D, 0.0001, 'e']], to: v.drive(4, { to: grit, trim: 0.5 }) });
      v.tone('sawtooth', [[0, 55], [D, 41, 'e']], { g: [[0, 0], [0.1, 0.08], [D, 0.0001, 'e']], to: v.filt('lowpass', 300, 1.5) });
      v.crackle({ t: 0.05, d: D, n: 14, g: 0.08, f: 1200, curve: 0.8, dec: 0.01, kind: 'pink' });
    },
  },
  /** Death, dissolve mark: the cloak collapses inward and the shadow exhales. */
  magusCollapse: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      // the robe empties: a falling flutter of cloth
      const flap = v.flutter(30, 0.6, { d: 0.55, base: 0.4, to: v.filt('bandpass', [[0, 1400], [0.5, 500, 'e']], 1.1) });
      v.noise('white', { g: [[0, 0], [0.05, 0.3], [0.55, 0.0001, 'e']], to: flap });
      v.tone('sine', [[0, 75], [0.35, 34, 'e']], { g: perc(0.3, 0.4, 0.02) });
      // the dark exhale
      v.noise('pink', { t: 0.04, g: [[0, 0], [0.1, 0.22], [0.7, 0.0001, 'e']], to: v.filt('lowpass', [[0, 1200], [0.7, 160, 'e']], 1.4, { t: 0.04 }) });
      drone(v, 0, 0.8, MAGUS_D1, 0.06, { lp: [400, 300, 120], att: 0.05 });
    },
  },
  /** Death: the staff hits the floor (wood + metal knock). Also its bounce (quieter). */
  magusStaffDrop: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      clank(v, 740, 0, 0.09, 0.32, { ratio: 2.76, index: 2.2, click: 1.8 });
      v.tone('triangle', [[0, 420], [0.04, 180, 'e']], { g: perc(0.25, 0.06, 0.0008) });
      thump(v, 0, 160, 70, 0.3, 0.1);
    },
  },
  /** Death, the body breaks: the dark dissolve (a descending granular hiss into a sub drop). */
  magusDissolve: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      const D = 0.95;
      v.tone('sine', [[0, 64], [D, 24, 'e']], { g: [[0, 0], [0.03, 0.2], [D, 0.0001, 'e']], to: v.drive(1.6, { trim: 0.85 }) });
      v.noise('white', { g: perc(0.15, 0.02, 0.0005), to: v.filt('lowpass', 1800) });
      // the motes rising off it: a falling-pitch granular hiss
      v.crackle({ d: D, n: 40, g: 0.11, f: 1300, q: 1.2, curve: 1.2, dec: 0.01, kind: 'pink' });
      v.noise('pink', { g: [[0, 0], [0.06, 0.26], [D, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1600], [D, 140, 'e']], 1.6) });
      drone(v, 0, D, MAGUS_D1, 0.07, { lp: [500, 280, 90], att: 0.03, tritone: 0.6 });
    },
  },
  /** Revive: dark motes spiral in and gather (granular, rising, the drone swelling) — faded at the land. */
  magusReviveGather: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    duck: 0.3,
    play(v) {
      const D = 0.46;
      const H = D + 0.3;
      const E = H + 0.12;
      // motes: ticks whose pitch and density rise
      const times: number[] = [];
      const gains: number[] = [];
      for (let i = 0; i < 26; i++) {
        const k = Math.pow(i / 25, 0.75);
        times.push(k * D + v.r(-0.008, 0.008) + 0.01);
        gains.push(0.05 + 0.14 * k);
      }
      v.bursts(times.slice(0, 13), gains.slice(0, 13), { dec: 0.018, f: 700, q: 2.5, kind: 'pink' });
      v.bursts(times.slice(13), gains.slice(13), { dec: 0.014, f: 1400, q: 2.5, kind: 'pink' });
      drone(v, 0, E, MAGUS_D1, 0.1, { lp: [120, 520, 300], att: D, beat: 0.4 });
      v.noise('pink', { g: [[0, 0.0001], [D, 0.16, 'e'], [H, 0.16], [E, 0.0001, 'e']], to: v.filt('bandpass', [[0, 300], [D, 1400, 'e']], 1.3) });
    },
  },
  /** Revive, land mark: whole again — a soft whoomp, the armour, the eyes kindle (D + A, dim). */
  magusReviveSettle: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.3,
    play(v) {
      v.tone('sine', [[0, 110], [0.2, 46, 'e']], { g: perc(0.5, 0.32, 0.01), to: v.drive(1.4, { trim: 0.85 }) });
      clank(v, 1050, 0.01, 0.045, 0.3, { ratio: 1.41, index: 2.5, click: 1.2 });
      for (const m of [50, 57]) v.tone('triangle', midiHz(m), { t: 0.02, g: [[0, 0], [0.05, 0.05], [0.8, 0.0001, 'e']], detune: v.r(-5, 5) });
      v.tone('sine', midiHz(68), { t: 0.05, g: [[0, 0], [0.08, 0.02], [0.6, 0.0001, 'e']] });
    },
  },
};

// ================================================================ Yıldırım Hükmü

const bolt: Record<string, Recipe> = {
  /** The storm gathers (≤ 0.4 s): rising static over a low rumble and an electric hum. Faded at the strike. */
  boltGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      const D = 0.34;
      const H = D + 0.25;
      const E = H + 0.12;
      v.noise('brown', { g: [[0, 0], [D, 0.4], [H, 0.4], [E, 0.0001, 'e']], to: v.filt('lowpass', [[0, 120], [D, 320, 'e']], 1) });
      v.crackle({ d: H, n: 26, g: 0.16, f: 5200, q: 0.9, curve: 0.55, dec: 0.004 });
      const hum = v.tone('sawtooth', [[0, 58], [D, 116, 'e'], [E, 120, 'e']], { g: [[0, 0], [D, 0.07], [H, 0.07], [E, 0.0001, 'e']], to: v.filt('lowpass', [[0, 400], [D, 2400, 'e']], 3) });
      v.lfo(hum.osc.detune, 11, 30, { d: E });
      v.noise('white', { g: [[0, 0.0001], [D, 0.08, 'e'], [H, 0.08], [E, 0.0001, 'e']], to: v.filt('highpass', 6000) });
    },
  },
  /** An intra-cloud flicker: a short crackle with a distant grumble. */
  boltCrackle: {
    cap: 3,
    gap: 0.03,
    verb: 0.45,
    vary: 0.06,
    play(v) {
      v.crackle({ d: 0.09, n: 9, g: 0.32, f: 3800, q: 0.8, curve: 1.2, dec: 0.004 });
      v.noise('brown', { g: perc(0.3, 0.25, 0.01), to: v.filt('lowpass', 420) });
    },
  },
  /** The strike: a crack (with the bolt's re-strikes), a sub boom, then the electric tail. */
  boltStrike: {
    cap: 2,
    gap: 0.06,
    verb: 0.55,
    duck: 0.8,
    play(v) {
      // the crack: the loudest transient of the spell, re-striking as the bolt flickers (34 ms steps)
      // (its top cut at 12 kHz: no inter-sample overs after the output clipper, sound QA #1)
      const top = v.filt('lowpass', 12000, 0.7);
      for (const [t, g] of [
        [0, 0.95],
        [0.034, 0.45],
        [0.068, 0.55],
      ] as const) {
        v.noise('white', { t, g: perc(g, 0.018, 0.0002), to: top });
        v.noise('white', { t, g: perc(g * 0.6, 0.07, 0.0005), to: v.filt('highpass', 2200, 0.707, { to: top }) });
      }
      thump(v, 0, 85, 28, 0.85, 1.1, { drive: 1.6 });
      // the electric tail: a ring-modulated buzz that sputters out, a fine sizzle
      const rm = v.ring([[0, 1300], [0.8, 380, 'e']], { d: 0.9, mix: 1, to: v.filt('bandpass', 2600, 0.9) });
      v.tone('sawtooth', [[0, 120], [0.8, 90, 'e']], { g: [[0, 0], [0.01, 0.2], [0.25, 0.12], [0.85, 0.0001, 'e']], to: v.flutter(22, 0.5, { d: 0.9, base: 0.6, to: rm }) });
      v.crackle({ t: 0.03, d: 0.8, n: 34, g: 0.2, f: 4500, q: 0.7, curve: 1.8, dec: 0.005 });
      // the thunder rolls under it
      v.noise('brown', { t: 0.02, g: [[0, 0], [0.06, 0.45], [0.5, 0.25], [1.4, 0.0001, 'e']], to: v.filt('lowpass', [[0, 700], [1.4, 140, 'e']], 0.9) });
    },
  },
};

// ================================================================ Işık Zincirleri

/** A dense train of link clinks sweeping across. */
function rattle(v: Voice, t0: number, d: number, n: number, g: number, o: { lo?: number; hi?: number; pan?: readonly [number, number] } = {}): void {
  const sp = v.panner([[0, o.pan?.[0] ?? -0.4], [d, o.pan?.[1] ?? 0.4]], { t: t0 });
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + Math.pow(i / Math.max(1, n - 1), 0.9) * d + v.r(-0.006, 0.006);
    times.push(t);
    link(v, v.r(o.lo ?? 2100, o.hi ?? 4300), t, g * v.r(0.6, 1), v.r(0.03, 0.07), sp);
  }
  v.bursts(times, times.map(() => v.r(0.06, 0.13) * g * 12), { dec: 0.005, f: 5500, q: 0.8, to: sp });
}

const chains: Record<string, Recipe> = {
  /** The chains shoot out of the card (opening accent): a rattling sweep on a light zip. */
  chainRattle: {
    cap: 2,
    gap: 0.08,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      rattle(v, 0.005, 0.42, 18, 0.12);
      v.noise('white', { g: [[0, 0], [0.32, 0.22], [0.45, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1600], [0.42, 6500, 'e']], 3) });
      // holy light along the links
      v.tone('sine', [[0, midiHz(93)], [0.4, midiHz(100), 'e']], { g: [[0, 0], [0.2, 0.025], [0.5, 0.0001, 'e']] });
    },
  },
  /**
   * One coil bites around the attacker: the bite's accent (a heavy link + a bright tick) ON the
   * bite frame itself, then a short knot of links settling after it (sound QA S1: the accent sat
   * 70 ms late, on the next bite).
   */
  chainCoil: {
    cap: 4,
    gap: 0.03,
    verb: 0.3,
    vary: 0.05,
    play(v) {
      link(v, 1250, 0, 0.1, 0.12);
      v.noise('white', { g: perc(0.2, 0.012, 0.0003), to: v.filt('bandpass', 3000, 1.2) });
      rattle(v, 0.012, 0.045, 5, 0.045, { lo: 1800, hi: 3600, pan: [-0.1, 0.1] });
    },
  },
  /**
   * The bind: a heavy shackle clank with a ringing iron tail and a bright light chord. The trap's
   * climax: its body (the iron ring, the links settling, the light chord) carries ~+3 dB over the
   * first version so the bind is as big as the other big moments (sound QA #11: it was 2.5–4.4 LU
   * under them) — the transient is unchanged, the extra loudness is in what rings after it.
   */
  chainBind: {
    cap: 2,
    gap: 0.06,
    verb: 0.45,
    duck: 0.45,
    play(v) {
      // the trap's climax (louder than its opening snap): an iron knock with weight under the clank
      v.tone('sine', [[0, 240], [0.06, 70, 'e']], { g: perc(0.85, 0.2, 0.0005), to: v.drive(2, { trim: 0.8 }) });
      thump(v, 0.004, 110, 40, 0.7, 0.42, { drive: 1.8 });
      v.noise('white', { g: perc(0.6, 0.024, 0.0003), to: v.filt('bandpass', 2300, 1.3) });
      v.noise('white', { g: perc(0.36, 0.2, 0.001), to: v.filt('lowpass', 1400) });
      // the iron rings on: the shackle (FM plate), its upper partial and the low hum of the chain
      clank(v, 784, 0, 0.3, 1.2, { ratio: 1.41, index: 3, click: 0 });
      clank(v, 784 * 2.02, 0.006, 0.1, 0.7, { ratio: 1.17, index: 1.6, click: 0 });
      v.tone('sine', [[0, 196], [0.6, 186, 'e']], { t: 0.01, g: [[0, 0], [0.02, 0.14], [0.25, 0.09], [0.7, 0.0001, 'e']] });
      link(v, 2900, 0.004, 0.08, 0.35);
      // the links settle against each other after the bite
      rattle(v, 0.02, 0.28, 10, 0.075, { pan: [0.2, -0.2] });
      // the light of the chains: a bright chord ringing on (gold, not the wyrm's glass)
      for (const m of [81, 85, 88]) v.tone('triangle', midiHz(m), { t: 0.01, g: [[0, 0], [0.02, 0.07], [0.3, 0.05], [0.8, 0.0001, 'e']], detune: v.r(-6, 6) });
      v.noise('white', { t: 0.02, g: [[0, 0], [0.04, 0.06], [0.45, 0.0001, 'e']], to: v.filt('highpass', 6000) });
    },
  },
  /** A haul step: the chains strain (a stick-slip creak), a link ticks, the feet scrape. */
  chainStrain: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    vary: 0.06,
    play(v) {
      const D = 0.3;
      // creak: a low saw through a narrow band that bends, chopped by stick-slip flutter
      const bp = v.filt('bandpass', [[0, 520], [D, 820, 'e']], 9);
      const ss = v.flutter(26, 0.7, { d: D + 0.02, base: 0.35, to: bp });
      v.tone('sawtooth', [[0, 92], [D, 104, 'e']], { g: [[0, 0], [0.04, 1.3], [D, 0.0001, 'e']], to: ss });
      link(v, v.r(1900, 2600), 0.02, 0.1, 0.08);
      // the feet scrape on the marble
      v.noise('pink', { g: [[0, 0], [0.03, 0.32], [0.2, 0.0001, 'e']], to: v.filt('bandpass', 900, 1.1) });
    },
  },
  /** The release: the chains go slack and dissolve into light (a falling jingle, a soft shimmer). */
  chainRelease: {
    cap: 2,
    gap: 0.1,
    verb: 0.55,
    duck: 0.2,
    play(v) {
      const sp = v.panner([[0, 0.3], [0.5, -0.3]]);
      for (let i = 0; i < 10; i++) link(v, 3600 - i * 210 + v.r(-80, 80), 0.01 + i * 0.045, 0.09 * (1 - i * 0.06), 0.09, sp);
      v.noise('white', { g: swell(0.08, 0.12, 0.5), to: v.filt('highpass', 7000) });
      for (const m of [93, 97, 100]) v.tone('sine', midiHz(m), { t: 0.05, g: [[0, 0], [0.12, 0.028], [0.85, 0.0001, 'e']] });
    },
  },
};

// ================================================================ openings (v3 spell / trap)

const openings: Record<string, Recipe> = {
  /** The spell card stands / arrives: a short teal accent — a low swell, a rising glass triad. */
  spellOpen: {
    cap: 2,
    gap: 0.1,
    verb: 0.5,
    duck: 0.35,
    play(v) {
      v.tone('sine', [[0, 98], [0.08, 131, 'e']], { g: perc(0.3, 0.3, 0.012) });
      v.noise('white', { g: swell(0.1, 0.08, 0.25), to: v.filt('bandpass', [[0, 1500], [0.1, 6000, 'e']], 1.4) });
      [74, 81, 86, 93].forEach((m, i) => v.bell(midiHz(m), { t: 0.04 + i * 0.035, g: 0.06 - i * 0.008, dec: 0.45, ratio: 3.01, index: 1.2 }));
      const lp = v.filt('lowpass', [[0, 900], [0.05, 4200, 'e'], [0.45, 900, 'e']], 1.5, { t: 0.06 });
      for (const m of [62, 69, 74]) v.tone('p25', midiHz(m), { t: 0.06, g: ahr(0.03, 0.01, 0.12, 0.2), to: lp, detune: v.r(-5, 5) });
    },
  },
  /** The trap springs: a hard snap, a short dissonant stab and a low hit (shorter than trapActivate). */
  trapOpen: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.5,
    play(v) {
      v.noise('white', { g: perc(0.5, 0.01, 0.0002), to: v.filt('highpass', 2800) });
      v.noise('white', { g: perc(0.28, 0.04, 0.0005), to: v.drive(5, { to: v.filt('bandpass', 2000, 1.6), trim: 0.5 }) });
      clank(v, 698, 0, 0.08, 0.55, { ratio: 1.41, index: 3, click: 0 });
      // (an opening accent: under the bind and the blows that follow it)
      thump(v, 0, 170, 42, 0.45, 0.28, { drive: 1.8 });
      const lp = v.filt('lowpass', [[0, 800], [0.02, 3200, 'e'], [0.45, 500, 'e']], 3, { t: 0.006 });
      for (const m of [49, 55, 56, 62]) v.tone('sawtooth', midiHz(m), { t: 0.006, g: [[0, 0], [0.01, 0.05], [0.18, 0.03], [0.5, 0.0001, 'e']], to: lp, detune: v.r(-10, 10) });
    },
  },
};

// ================================================================ table

const materials: Record<string, Recipe> = {};
for (const m of ['crystal', 'metal', 'cloth'] as const)
  for (const w of ['Light', 'Heavy', 'Magic'] as const) materials[`hit${m[0].toUpperCase()}${m.slice(1)}${w}`] = materialHit(m, w);

/** Every v3 sound name (additive to the original SfxName list). */
export type V3SfxName =
  // materials (the struck body)
  | 'hitCrystalLight' | 'hitCrystalHeavy' | 'hitCrystalMagic'
  | 'hitMetalLight' | 'hitMetalHeavy' | 'hitMetalMagic'
  | 'hitClothLight' | 'hitClothHeavy' | 'hitClothMagic'
  // Kristal Ejder
  | 'wyrmRoar' | 'wyrmChime' | 'wyrmLand' | 'wyrmBreathCharge' | 'wyrmBreathFire' | 'wyrmBreathImpact'
  | 'wyrmCrack' | 'wyrmDrain' | 'wyrmShatter' | 'wyrmReviveGather' | 'wyrmReviveLock'
  // Uçurum Büyücüsü
  | 'magusPresence' | 'magusCall' | 'magusLand' | 'magusCharge' | 'magusSwing' | 'magusOrbRelease' | 'magusOrbBurst'
  | 'magusTendril' | 'magusCollapse' | 'magusStaffDrop' | 'magusDissolve' | 'magusReviveGather' | 'magusReviveSettle'
  // Yıldırım Hükmü
  | 'boltGather' | 'boltCrackle' | 'boltStrike'
  // Işık Zincirleri
  | 'chainRattle' | 'chainCoil' | 'chainBind' | 'chainStrain' | 'chainRelease'
  // openings
  | 'spellOpen' | 'trapOpen';

export const V3_RECIPES = { ...materials, ...wyrm, ...magus, ...bolt, ...chains, ...openings } as Record<V3SfxName, Recipe>;

/** The sustained v3 sounds (a cinematic ends them on the next mark with sfx.start(...).stop()). */
export const V3_SUSTAINED: readonly V3SfxName[] = ['wyrmBreathCharge', 'wyrmBreathFire', 'wyrmReviveGather', 'magusCharge', 'magusReviveGather', 'boltGather'];
