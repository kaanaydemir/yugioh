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
//   e_dawnChain    the cage is lowered: a run of heavy links paying out over the pulley ratchet (≈ 0.42 s)
//   e_dawnLand     the cage's foot rail hits the floor: an iron gong (clank 2.3), a floor thud, all the bars ringing
//   e_dawnSun      the dawn sun on the cage's crown ignites and its light runs down the sword bars (G-major rise)
//   e_dawnSlam     the door slams shut: a heavy iron clank, a crack of the latch, the bars rattling after it
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

/** The pulley's pawl: a dull low knock (≈140 Hz) with a dry tick on top. */
function pawl(v: Voice, t: number, g: number, f = 140): void {
  thump(v, t, f * 1.3, f, g, 0.05);
  v.noise('white', { t, g: perc(g * 0.6, 0.006, 0.0002), to: v.filt('bandpass', 2300, 2) });
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

export const RECIPES = {
  /** The cage is lowered: heavy links paying out over the pulley's ratchet, quickening, a low rope-less hum. */
  e_dawnChain: {
    cap: 1,
    gap: 0.2,
    verb: 0.32,
    play(v) {
      // links: 9 knocks, quickening (the cage falls faster), pitch wandering 0.9–1.5 kHz
      let t = 0;
      for (let i = 0; i < 9; i++) {
        heavyLink(v, t, 1500 - i * 55 + v.r(-60, 60), 0.08 + i * 0.01, 0.06);
        if (i % 2 === 0) pawl(v, t + 0.006, 0.12 + i * 0.012);
        t += Math.max(0.026, 0.062 - i * 0.0048);
      }
      // the pulley's air: a falling band of noise (the drop from above)
      sweep(v, 0, 0.42, [2600, 1400, 700], 0.08, { kind: 'pink', q: 1.4, peakAt: 0.7 });
    },
  },
  /** The cage lands: an iron gong (clank 2.3) on a floor thud, the bars ringing on, dust. */
  e_dawnLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.42,
    duck: 0.45,
    play(v) {
      thump(v, 0, 120, 46, 0.55, 0.22, { drive: 1.4 });
      clank(v, 196, 0, 0.32, 0.9, { ratio: 2.3, index: 2.6, click: 1.2 });
      clank(v, 293, 0.008, 0.16, 0.6, { ratio: 2.3, index: 1.6, click: 0 });
      // the bars ring on, a little out of step (each bar its own pitch on the ladder)
      [G.g5, G.b5, G.d6, G.e6, G.g6].forEach((m, i) => v.bell(midiHz(m), { t: 0.02 + i * 0.018, g: 0.022, dec: 0.55, ratio: 2.3, index: 0.7 }));
      // the chain slumps onto the crown, a heavy link or two
      heavyLink(v, 0.07, 1120, 0.06, 0.07);
      heavyLink(v, 0.13, 980, 0.045, 0.07);
      puff(v, 0.005, 0.12, 0.3, 1500, { kind: 'brown' });
      crack(v, 0, 0.12, { hp: 3200, n: 1 });
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
  /** The door slams: a heavy iron clank, the latch's crack, the whole cage's bars rattling after. */
  e_dawnSlam: {
    cap: 1,
    gap: 0.15,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      clank(v, 233, 0, 0.42, 0.55, { ratio: 2.3, index: 3.2, click: 2.4 });
      clank(v, 349, 0.004, 0.18, 0.35, { ratio: 1.41, index: 2, click: 0 });
      thump(v, 0, 160, 70, 0.32, 0.1);
      crack(v, 0.002, 0.3, { hp: 2400, n: 2, gap: 0.01 });
      // the rattle: the bars shiver in their rails (a quick train of small heavy links)
      for (let i = 0; i < 6; i++) heavyLink(v, 0.05 + i * 0.03 + v.r(0, 0.006), 1250 + v.r(-150, 150), 0.035 * (1 - i * 0.12), 0.05);
    },
  },
  /** The padlock's shackle snaps home: "çı-KLAK" (a slide, a heavy click). */
  e_dawnShackle: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    play(v) {
      // the slide in
      v.noise('white', { g: [[0, 0], [0.03, 0.05], [0.05, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.05, 3800, 'e']], 4) });
      lockTick(v, 0.05, 0.5);
      clank(v, 620, 0.05, 0.2, 0.18, { ratio: 2.3, index: 1.6, click: 0 });
    },
  },
  /** One tongue of the padlock lights up (×3, pitch: up the ladder): a tick and a tiny brass bell. */
  e_dawnTongue: {
    cap: 3,
    gap: 0.03,
    verb: 0.4,
    play(v) {
      lockTick(v, 0, 0.3, 2100);
      v.bell(midiHz(G.d6), { t: 0.01, g: 0.09, dec: 0.38, ratio: 3.01, index: 0.8 });
    },
  },
  /** The caged monsters go cold and lean on the bars: a low cold hum (beating), two bars humming softly. */
  e_dawnCold: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    play(v) {
      // a cold, slightly beating hum (G2 + a hair sharp), lowpassed
      const lp = v.filt('lowpass', [[0, 300], [0.25, 900, 'e'], [0.75, 260, 'e']], 1.2);
      for (const det of [-5, 6]) v.tone('sawtooth', midiHz(43), { g: [[0, 0], [0.18, 0.05], [0.5, 0.035], [0.8, 0.0001, 'e']], to: lp, detune: det });
      // the bars the monsters lean on: two soft low clanks
      clank(v, 262, 0.08, 0.08, 0.5, { ratio: 2.3, index: 1, click: 0.6 });
      clank(v, 247, 0.22, 0.06, 0.45, { ratio: 2.3, index: 1, click: 0.6 });
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
      lockTick(v, 0, 0.4, 1700);
      // the spring: a quick FM pitch wobble
      const tn = v.tone('triangle', [[0, 520], [0.02, 820], [0.05, 600], [0.08, 760], [0.12, 640, 'e']], { t: 0.01, g: [[0, 0], [0.005, 0.08], [0.16, 0.0001, 'e']] });
      void tn;
      // the drop: a clatter on the floor (two bounces), small and brassy
      clank(v, 880, 0.2, 0.14, 0.2, { ratio: 2.3, index: 1.8, click: 1.4 });
      clank(v, 990, 0.29, 0.08, 0.14, { ratio: 2.3, index: 1.4, click: 1 });
      clank(v, 940, 0.34, 0.04, 0.1, { ratio: 2.3, index: 1.2, click: 0.8 });
    },
  },
  /** The cage is hauled up: the ratchet clicking fast and upward, the chain running in, a rising air. */
  e_dawnHaul: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    play(v) {
      let t = 0;
      for (let i = 0; i < 12; i++) {
        pawl(v, t, 0.12 - i * 0.005, 130 + i * 9);
        if (i % 2 === 1) heavyLink(v, t + 0.01, 1000 + i * 45 + v.r(-50, 50), 0.06, 0.05);
        t += Math.max(0.028, 0.05 - i * 0.002);
      }
      sweep(v, 0.05, 0.5, [600, 1800, 3400], 0.06, { kind: 'pink', q: 1.5, peakAt: 0.6 });
      // the cage's last ring as it leaves (the bars, softly, G major)
      [G.d6, G.g6].forEach((m, i) => v.bell(midiHz(m), { t: 0.32 + i * 0.07, g: 0.025, dec: 0.4, ratio: 2.3, index: 0.6 }));
    },
  },
  /** Destroyed early: the sword bars snap, the chain whips, the frame clatters down onto the floor. */
  e_dawnBreak: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.55,
    play(v) {
      crack(v, 0, 0.55, { hp: 2200, n: 3, gap: 0.014 });
      clank(v, 207, 0, 0.36, 0.5, { ratio: 2.3, index: 3.4, click: 2 });
      // the bars snapping: a scatter of bright metal pings falling in pitch
      for (let i = 0; i < 9; i++) v.bell(1900 - i * 120 + v.r(-80, 80), { t: 0.02 + i * 0.03, g: 0.05 * (1 - i * 0.08), dec: 0.14, ratio: 2.3, index: 1.4 });
      // the chain whips up: a fast upward air + links
      sweep(v, 0.04, 0.24, [900, 3800, 2600], 0.08, { kind: 'white', q: 2, peakAt: 0.4 });
      for (let i = 0; i < 4; i++) heavyLink(v, 0.06 + i * 0.022, 1300 + i * 90, 0.04, 0.05);
      // the frame falls and clatters
      thump(v, 0.3, 140, 55, 0.4, 0.14, { drive: 1.3 });
      clank(v, 260, 0.3, 0.16, 0.3, { ratio: 2.3, index: 2, click: 1.4 });
      clank(v, 300, 0.38, 0.08, 0.2, { ratio: 2.3, index: 1.6, click: 1 });
      puff(v, 0.3, 0.1, 0.3, 1400, { kind: 'brown' });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
