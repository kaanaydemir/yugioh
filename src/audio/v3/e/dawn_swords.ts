// Lane E sounds — dawn_swords (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Şafak Kılıçları — the new signature (owner decision 1: the dropped S6 Yaldızlı Kafes storyboard, adapted). A gilded
// cage whose front bars are dawn swords is lowered on a chain over the opponent's whole monster row; its door slams,
// a padlock with three tongues locks it; every opponent turn one tongue turns + a bell; at 0 the lock springs and the
// cage is hauled up.
//
// Identity (§5.1 S6 row, now this card's): CHAIN + BELL, GILDED IRON, the PADLOCK'S TICKS.
//   - the chain here is HEAVY: big gilded links 0.9–1.6 kHz with an iron body under each (Ruh Tasması's links are
//     small pings 2.2–3.6 kHz, never with a body) running over a PULLEY RATCHET (a low 140 Hz pawl knock);
//   - the bell is a real tuned CHURCH BELL (hum / prime / minor-third tierce / quint / nominal partials) on G — the
//     card's old dawn ladder (G major pentatonic) is kept as its harmony, so the card still sounds like "dawn";
//   - gilded iron = FM clank at ratio 2.3 (§7 S6: "kafes gongu clank 2.3"), low (180–260 Hz) for the frame;
//   - the padlock = dry two-part ticks ~2.6 kHz band + a 1.9 kHz brass body (Kadran Soytarısı's 3.2 kHz clock tick
//     is a single bright click with no body).
//   No glass partials (Kristal / Boşluk Gözü), no pure-sine light shimmer (the old fence's dawnDissolve).
//
//   e_dawnChain    the cage is lowered: the pulley ratchet in front, heavy slow low links under it (≈ 0.46 s)
//   e_dawnLand     the cage's foot rail hits the floor: an iron gong (clank 2.3), a floor thud, all the bars ringing
//   e_dawnSun      the dawn sun on the cage's crown ignites and its light runs down the sword bars (G-major rise)
//   e_dawnSlam     the door slams shut: a sharp bright brass latch KLAK (no low gong: the land owns that), a high rattle
//   e_dawnShackle  the padlock's shackle snaps into the body: "çı-KLAK"
//   e_dawnTongue   one tongue of the padlock lights (×3, pitch up the ladder): a tick + a tiny bell
//   e_dawnCold     the caged monsters go cold and lean on the bars: a low cold hum, two bars ringing softly
//   e_dawnBadge    the small padlock badge over the spell card pops in
//   e_dawnTick     a counter: one tongue TURNS (three ratchet ticks) and the church bell tolls once (G4)
//   e_dawnLast     the last counter: the tongue turns and the bell tolls low (D4), longer
//   e_dawnUnlock   the padlock springs open (a spring boing + click) and falls, clattering on the floor
//   e_dawnHaul     the cage is hauled up: the ratchet clicking fast, upward, the chain running in, a rising air
//   e_dawnBreak    destroyed early: the sword bars snap, the chain whips, the frame clatters down

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { midiHz, perc } from '../../synth';
import { clank, crack, puff, sweep, thump } from '../kit';

/** G major pentatonic G4 … G6 (midi) — the card's dawn harmony. */
const G = { g4: 67, a4: 69, b4: 71, d5: 74, e5: 76, g5: 79, b5: 83, d6: 86, e6: 88, g6: 91 } as const;

/** One heavy gilded link knocking on the next: an inharmonic link ping with an iron body under it. */
function heavyLink(v: Voice, t: number, f: number, g: number, dec = 0.07): void {
  v.tone('sine', f, { t, g: perc(g, dec, 0.0008) });
  v.tone('sine', f * 1.83, { t, g: perc(g * 0.5, dec * 0.7, 0.0008) });
  v.tone('sine', f * 2.97, { t, g: perc(g * 0.22, dec * 0.45, 0.0008) });
  // the iron body: a short, low FM knock
  v.bell(f * 0.31, { t, g: g * 0.55, dec: dec * 0.9, ratio: 2.3, index: 1.2 });
  v.noise('white', { t, g: perc(g * 0.9, 0.005, 0.0002), to: v.filt('bandpass', f * 2.4, 1.6) });
}

/**
 * One HEAVY, SLOW link of the lowering chain (round 3, pushed away from Işık Zincirleri's bright link pings): a low
 * iron knock 480–720 Hz with a long body and no high partials, a dull rub of the link sliding over the next.
 */
function slowLink(v: Voice, t: number, f: number, g: number): void {
  v.tone('sine', f, { t, g: perc(g * 0.7, 0.09, 0.0015) });
  v.tone('triangle', f * 1.41, { t, g: perc(g * 0.25, 0.05, 0.0015) });
  v.bell(f * 0.5, { t, g: g * 0.6, dec: 0.12, ratio: 2.3, index: 1.6 });
  v.noise('white', { t, g: perc(g * 0.5, 0.012, 0.0005), to: v.filt('bandpass', f * 1.6, 1.2) });
  v.noise('brown', { t: t + 0.005, g: perc(g * 0.6, 0.04, 0.003), to: v.filt('lowpass', 900, 0.8) });
}

/** The pulley's pawl: a dull low knock (≈140 Hz) with a dry tick on top. */
function pawl(v: Voice, t: number, g: number, f = 140): void {
  thump(v, t, f * 1.3, f, g, 0.035);
  v.noise('white', { t, g: perc(g * 0.6, 0.004, 0.0002), to: v.filt('bandpass', f * 11, 2.4) });
}

/** The padlock tick: a two-part dry click (2.6 kHz band) on a small brass body (1.9 kHz). */
function lockTick(v: Voice, t: number, g: number, f = 1900): void {
  v.noise('white', { t, g: perc(g, 0.004, 0.0001), to: v.filt('bandpass', f * 1.37, 3) });
  v.noise('white', { t: t + 0.012, g: perc(g * 0.7, 0.005, 0.0001), to: v.filt('bandpass', f * 1.6, 3) });
  v.tone('triangle', f, { t, g: perc(g * 0.3, 0.03, 0.0005) });
  v.tone('sine', f * 2.43, { t: t + 0.012, g: perc(g * 0.14, 0.02, 0.0005) });
}

/** A tuned church bell on `f` (its strike note): hum, prime, minor-third tierce, quint, nominal, upper partials. */
function churchBell(v: Voice, t: number, f: number, g: number, dec: number): void {
  const parts: readonly (readonly [number, number, number])[] = [
    [0.5, 0.55, 1.0],
    [1.0, 0.8, 0.75],
    [1.19, 0.5, 0.55],
    [1.5, 0.32, 0.45],
    [2.0, 0.6, 0.4],
    [2.51, 0.22, 0.28],
    [3.01, 0.16, 0.2],
    [4.07, 0.08, 0.12],
  ];
  for (const [r, a, d] of parts) v.tone('sine', f * r, { t, g: perc(g * a, dec * d, 0.002), detune: r === 1.19 ? -6 : 0 });
  // the clapper's strike
  v.noise('white', { t, g: perc(g * 0.7, 0.01, 0.0003), to: v.filt('bandpass', f * 4, 2) });
  v.bell(f * 2, { t, g: g * 0.25, dec: dec * 0.15, ratio: 2.3, index: 2 });
}

/** A gilded hinge creak: a stick-slip sawtooth through two resonances (brass 1.1 kHz, a gilt shimmer 2.7 kHz). */
function creak(v: Voice, t: number, d: number, f: readonly [number, number, number], g: number): void {
  const fEnv: [number, number, 'e'?][] = [[0, f[0]], [d * 0.55, f[1], 'e'], [d, f[2], 'e']];
  const out = v.amp(1, { t });
  const b1 = v.filt('bandpass', 1100, 6, { t, to: out });
  const b2 = v.filt('bandpass', 2700, 9, { t, to: out });
  const gEnv: [number, number, 'e'?][] = [[0, 0], [0.015, g], [d * 0.7, g * 0.8], [d, 0.0001, 'e']];
  v.tone('sawtooth', fEnv, { t, g: gEnv, to: b1 });
  v.tone('sawtooth', fEnv.map(([a, b, e]) => [a, b * 1.01, e] as [number, number, 'e'?]), { t, g: gEnv.map(([a, b, e]) => [a, b * 0.6, e] as [number, number, 'e'?]), to: b2 });
}

/** One sword SNAPPING: a tiny dry crack and the blade's own bell ping at `f`. */
function snapPing(v: Voice, t: number, f: number, g: number): void {
  v.noise('white', { t, g: perc(g * 1.1, 0.004, 0.0001), to: v.filt('highpass', 3000, 0.8) });
  v.bell(f, { t, g, dec: 0.32, ratio: 3.01, index: 0.9 });
  v.tone('sine', f * 2, { t, g: perc(g * 0.3, 0.12, 0.001) });
}

export const RECIPES = {
  /** The cage is lowered: heavy links paying out over a LOW, DRY pulley ratchet (≈ 95 Hz pawl), quickening. */
  e_dawnChain: {
    cap: 1,
    gap: 0.2,
    verb: 0.2,
    play(v) {
      // round 3: the PULLEY RATCHET in front (a big dry pawl on every link), six heavy slow links under it, no pings
      let t = 0;
      for (let i = 0; i < 7; i++) {
        pawl(v, t, 0.26 + i * 0.012, 92 + i * 4);
        slowLink(v, t + 0.012, 640 - i * 22 + v.r(-30, 30), 0.12 + i * 0.008);
        t += Math.max(0.045, 0.085 - i * 0.007);
      }
      // the pulley's air: a low falling band of noise (the drop from above)
      sweep(v, 0, 0.46, [1600, 900, 420], 0.06, { kind: 'pink', q: 1.2, peakAt: 0.7 });
    },
  },
  /** The cage lands: the GILDED BARS ring out (a church-bell partial set on G + the bars' G-major ladder) over a light thud. */
  e_dawnLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      thump(v, 0, 110, 50, 0.15, 0.14, { drive: 1.2 });
      clank(v, 196, 0, 0.12, 0.6, { ratio: 2.3, index: 2.2, click: 1.2 });
      // the cage rings like a bell: G3's partials, then every bar on the ladder, a little out of step
      churchBell(v, 0.004, midiHz(55), 0.16, 1.3);
      [G.g5, G.b5, G.d6, G.e6, G.g6].forEach((m, i) => v.bell(midiHz(m), { t: 0.02 + i * 0.022, g: 0.07, dec: 0.6, ratio: 2.3, index: 0.7 }));
      // the chain slumps onto the crown, a heavy link or two
      heavyLink(v, 0.07, 1120, 0.05, 0.07);
      heavyLink(v, 0.13, 980, 0.04, 0.07);
      puff(v, 0.005, 0.1, 0.3, 1500, { kind: 'brown' });
      crack(v, 0, 0.1, { hp: 3200, n: 1 });
    },
  },
  /** The dawn sun on the crown ignites; its light runs down the sword bars: a G-major rise of brass bells over air. */
  e_dawnSun: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    duck: 0.25,
    play(v) {
      sweep(v, 0, 0.5, [900, 3600, 5200], 0.09, { kind: 'pink', q: 2.4, peakAt: 0.55 });
      [G.g5, G.b5, G.d6, G.g6].forEach((m, i) => v.bell(midiHz(m), { t: 0.02 + i * 0.075, g: 0.075 - i * 0.006, dec: 0.6, ratio: 3.01, index: 0.9 }));
      // a warm low swell under it (the sun's body): G3 + D4, slow attack
      for (const m of [55, 62]) v.tone('triangle', midiHz(m), { g: [[0, 0], [0.22, 0.03], [0.46, 0.022], [0.7, 0.0001, 'e']] });
    },
  },
  /** The door slams: the latch's crack and a bright gilded clang (the bars ring G–B–D), then the bars rattle. */
  e_dawnSlam: {
    cap: 1,
    gap: 0.15,
    verb: 0.34,
    duck: 0.4,
    play(v) {
      // round 3: a different event from the land (which owns the low gong): a sharp, bright brass LATCH "KLAK" —
      // a 2–3 kHz crack, the latch's brass body (≈ 1.4 kHz, short), the door's frame ringing high, a short high
      // rattle of the bars; no low body
      crack(v, 0, 0.55, { hp: 2200, n: 2, gap: 0.008 });
      lockTick(v, 0, 1.1, 2000);
      clank(v, 1380, 0.002, 0.36, 0.16, { ratio: 2.3, index: 2.2, click: 2.2 });
      clank(v, 2150, 0.004, 0.1, 0.1, { ratio: 1.6, index: 1.4, click: 0 });
      v.bell(midiHz(G.b5), { t: 0.006, g: 0.05, dec: 0.32, ratio: 2.3, index: 0.9 });
      v.bell(midiHz(G.d6), { t: 0.012, g: 0.04, dec: 0.28, ratio: 2.3, index: 0.9 });
      // the rattle: the bars shiver in their rails — small high clinks, fast and short
      for (let i = 0; i < 6; i++) {
        const t = 0.045 + i * 0.024 + v.r(0, 0.005);
        v.noise('white', { t, g: perc(0.07 * (1 - i * 0.13), 0.004, 0.0002), to: v.filt('bandpass', 3000 + v.r(-400, 500), 4) });
        v.tone('sine', 2400 + v.r(-200, 300), { t, g: perc(0.025 * (1 - i * 0.13), 0.03, 0.0005) });
      }
    },
  },
  /** The padlock's shackle snaps home — the beat's hero: a pre-click, the slide, a heavy brass KLAK. "çı-KLAK". */
  e_dawnShackle: {
    cap: 1,
    gap: 0.1,
    verb: 0.28,
    play(v) {
      // the pre-click ("çı")
      lockTick(v, 0, 0.35, 2300);
      // the slide in
      v.noise('white', { t: 0.012, g: [[0, 0], [0.03, 0.08], [0.045, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.045, 3800, 'e']], 4) });
      // the KLAK
      lockTick(v, 0.055, 0.8);
      clank(v, 620, 0.055, 0.3, 0.2, { ratio: 2.3, index: 1.6, click: 0 });
      thump(v, 0.055, 260, 150, 0.12, 0.04);
      v.bell(midiHz(G.g6), { t: 0.06, g: 0.04, dec: 0.3, ratio: 3.01, index: 0.6 });
    },
  },
  /** One tongue of the padlock lights up (×3, pitch: up the ladder): a tick and a tiny brass bell. */
  e_dawnTongue: {
    cap: 3,
    gap: 0.03,
    verb: 0.4,
    play(v) {
      lockTick(v, 0, 0.42, 2100);
      v.bell(midiHz(G.d6), { t: 0.01, g: 0.13, dec: 0.4, ratio: 3.01, index: 0.8 });
    },
  },
  /** The caged monsters go cold: a low cold hum (beating) and a crackle of frost forming (tiny ice ticks). */
  e_dawnCold: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    play(v) {
      // a cold, slightly beating hum (G2 + a hair sharp), lowpassed
      const lp = v.filt('lowpass', [[0, 300], [0.25, 900, 'e'], [0.75, 260, 'e']], 1.2);
      for (const det of [-5, 6]) v.tone('sawtooth', midiHz(43), { g: [[0, 0], [0.18, 0.05], [0.5, 0.035], [0.8, 0.0001, 'e']], to: lp, detune: det });
      // frost forming: a scatter of tiny high ice ticks
      for (let i = 0; i < 10; i++) {
        const t = 0.05 + i * 0.045 + v.r(0, 0.02);
        v.noise('white', { t, g: perc(0.03 + v.r(0, 0.02), 0.003, 0.0001), to: v.filt('bandpass', 6500 + v.r(-800, 1200), 6) });
      }
      sweep(v, 0, 0.6, [5200, 3000, 1800], 0.02, { kind: 'white', q: 4, peakAt: 0.3 });
    },
  },
  /** The small padlock badge over the spell card pops in. */
  e_dawnBadge: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      lockTick(v, 0, 0.16, 2400);
      v.bell(midiHz(G.g6), { t: 0.01, g: 0.05, dec: 0.25, ratio: 3.01, index: 0.6 });
    },
  },
  /** A counter: one tongue turns (three ratchet ticks) and the church bell tolls once (G4). */
  e_dawnTick: {
    cap: 2,
    gap: 0.1,
    verb: 0.6,
    duck: 0.3,
    play(v) {
      lockTick(v, 0, 0.18, 1900);
      lockTick(v, 0.045, 0.15, 2000);
      lockTick(v, 0.09, 0.2, 1800);
      churchBell(v, 0.11, midiHz(G.g4), 0.11, 1.4);
    },
  },
  /** The last counter: the tongue turns, the bell tolls low (D4) and long. */
  e_dawnLast: {
    cap: 1,
    gap: 0.2,
    verb: 0.65,
    duck: 0.35,
    play(v) {
      lockTick(v, 0, 0.2, 1800);
      lockTick(v, 0.05, 0.16, 1700);
      lockTick(v, 0.1, 0.22, 1600);
      churchBell(v, 0.12, midiHz(62), 0.13, 1.9);
    },
  },
  /** The padlock springs open (a spring's boing + a click) and drops, clattering on the floor. */
  e_dawnUnlock: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      // round 3: +4 dB — the release must land
      lockTick(v, 0, 0.65, 1700);
      crack(v, 0, 0.14, { hp: 2600, n: 1 });
      // the spring: a quick FM pitch wobble
      v.tone('triangle', [[0, 520], [0.02, 820], [0.05, 600], [0.08, 760], [0.12, 640, 'e']], { t: 0.01, g: [[0, 0], [0.005, 0.13], [0.16, 0.0001, 'e']] });
      // the drop: a clatter on the floor (two bounces), brassy
      clank(v, 880, 0.2, 0.22, 0.2, { ratio: 2.3, index: 1.8, click: 1.4 });
      thump(v, 0.2, 200, 110, 0.08, 0.04);
      clank(v, 990, 0.29, 0.13, 0.14, { ratio: 2.3, index: 1.4, click: 1 });
      clank(v, 940, 0.34, 0.07, 0.1, { ratio: 2.3, index: 1.2, click: 0.8 });
    },
  },
  /** The cage is hauled up: a RISING chain-and-ratchet line (the pawls climbing in pitch and speed), a rising air. */
  e_dawnHaul: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    play(v) {
      // round 3: ≈ +4 dB, and a clear rising line: pawl and link climb together
      let t = 0;
      for (let i = 0; i < 13; i++) {
        pawl(v, t, 0.2 - i * 0.006, 110 + i * 14);
        slowLink(v, t + 0.008, 520 + i * 48 + v.r(-20, 20), 0.1);
        t += Math.max(0.026, 0.052 - i * 0.0022);
      }
      sweep(v, 0.05, 0.5, [500, 1600, 3200], 0.1, { kind: 'pink', q: 1.5, peakAt: 0.65 });
      // the cage's last ring as it leaves (the bars, softly, G major)
      [G.d6, G.g6].forEach((m, i) => v.bell(midiHz(m), { t: 0.34 + i * 0.07, g: 0.04, dec: 0.4, ratio: 2.3, index: 0.6 }));
    },
  },
  /** Destroyed early: the swords SNAP one after another — a falling bell arpeggio down the G ladder — the chain whips up. */
  e_dawnBreak: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.5,
    play(v) {
      // the blow: a bright gilded clang + crack
      clank(v, 311, 0, 0.2, 0.3, { ratio: 2.3, index: 2.4, click: 1.6 });
      crack(v, 0, 0.3, { hp: 2600, n: 2, gap: 0.012 });
      // the swords snap: a falling arpeggio, each a crack + its blade's ring
      [G.g6, G.e6, G.d6, G.b5, G.g5, G.e5, G.d5, G.b4].forEach((m, i) => snapPing(v, 0.06 + i * 0.026 + v.r(0, 0.006), midiHz(m), 0.07 - i * 0.004));
      // the chain whips up: a fast upward air + links
      sweep(v, 0.06, 0.26, [700, 3600, 2400], 0.07, { kind: 'white', q: 2, peakAt: 0.4 });
      for (let i = 0; i < 5; i++) heavyLink(v, 0.07 + i * 0.024, 1250 + i * 110, 0.035, 0.045);
    },
  },
  /** The cage collapses into its pieces: a gilded clatter on the floor (bars bouncing, thinning out) on a soft frame thud. */
  e_dawnCollapse: {
    cap: 1,
    gap: 0.3,
    verb: 0.38,
    play(v) {
      thump(v, 0.03, 120, 55, 0.2, 0.12, { drive: 1.2 });
      puff(v, 0.03, 0.08, 0.25, 1300, { kind: 'brown' });
      // the pieces land: a clatter of small gilded clinks, thinning out (the bounces)
      let t = 0.05;
      for (let i = 0; i < 16; i++) {
        const f = 700 + v.r(0, 900);
        clank(v, f, t, 0.06 * (1 - i * 0.045), 0.09, { ratio: 2.3, index: 1.4, click: 1 });
        if (i % 3 === 0) v.bell(midiHz([G.g5, G.d6, G.b5, G.g6][(i / 3) % 4]), { t, g: 0.02, dec: 0.3, ratio: 2.3, index: 0.6 });
        t += 0.018 + i * 0.006 + v.r(0, 0.012);
      }
    },
  },
  /** The dawn wave runs down every sword: a soft descending shimmer of bells over a falling airy glissando. */
  e_dawnWave: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    play(v) {
      sweep(v, 0, 0.62, [5200, 2600, 1200], 0.05, { kind: 'pink', q: 3, peakAt: 0.3 });
      [G.g6, G.e6, G.d6, G.b5, G.g5].forEach((m, i) => v.bell(midiHz(m), { t: 0.03 + i * 0.1, g: 0.045 - i * 0.004, dec: 0.5, ratio: 3.01, index: 0.7 }));
      // the tips touch the floor: tiny bright ticks at the end
      for (let i = 0; i < 4; i++) v.noise('white', { t: 0.42 + i * 0.05, g: perc(0.04, 0.003, 0.0001), to: v.filt('bandpass', 5200, 4) });
    },
  },
  /** The door swings shut: a short swoosh with a gilded hinge creak rising into the slam. */
  e_dawnSwing: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      sweep(v, 0, 0.16, [500, 1800, 2600], 0.08, { kind: 'pink', q: 1.6, peakAt: 0.75 });
      creak(v, 0.005, 0.15, [70, 120, 160], 0.4);
    },
  },
  /** The door creaks open at the expiry: a slow gilded hinge creak, falling. */
  e_dawnDoor: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    play(v) {
      creak(v, 0, 0.34, [120, 85, 60], 0.45);
      v.bell(midiHz(G.b5), { t: 0.3, g: 0.05, dec: 0.3, ratio: 2.3, index: 0.6 });
    },
  },
  /** The padlock drops onto the latch: a short brass slide-chime (it falls 12 px). */
  e_dawnLockDrop: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.06, 0.2], [0.1, 0.0001, 'e']], to: v.filt('bandpass', [[0, 4200], [0.1, 2400, 'e']], 5) });
      v.bell(midiHz(G.b5), { t: 0, g: 0.12, dec: 0.12, ratio: 3.01, index: 0.5 });
      lockTick(v, 0.02, 0.15, 2600);
    },
  },
  /** A caged monster leans on a bar: a soft gilded "tunk" and the bar's hum. */
  e_dawnLean: {
    cap: 2,
    gap: 0.03,
    verb: 0.4,
    play(v) {
      clank(v, 262, 0, 0.09, 0.45, { ratio: 2.3, index: 1, click: 0.5 });
      v.bell(midiHz(G.g5), { t: 0.004, g: 0.03, dec: 0.5, ratio: 2.3, index: 0.5 });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
