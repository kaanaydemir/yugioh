// Sameness metrics (docs/v3/A3_MIMARI.md §9, §12 "Benzerlik metrikleri"): IoU symmetry, MOT on synthetic
// tracks with known values, DTW invariance to ±60 ms holds, cyclic-shift phase independence, RHYTHM
// tolerance limits and the loop signature, §9.3 verdicts and exit codes, blind-test scoring on a
// synthetic form, and the art → profile → pair path on a tiny synthetic monster (colour / jitter
// controls, opposite motion). The full scan (tools/sameness.ts --calib) is slow and stays out of npm test.

import { describe, expect, it } from 'vitest';
import { jitterSpec, prng, sampleFrames } from '../../tools/lib/framelib';
import {
  type BlindForm,
  type BlindKey,
  type PairMetrics,
  CONTROL_MARGIN,
  THRESHOLDS,
  controlFloor,
  controlHeld,
  controlMargin,
  cosAligned,
  cycCos,
  dominantPeriodMs,
  dtwCos,
  dtwPath,
  exitCode,
  iou,
  judgePair,
  lagMs,
  loopSignature,
  median,
  outOfPlan,
  panelGain,
  pearson,
  sameRhythm,
  scoreBlind,
  withThresholds,
} from '../../tools/lib/sameness-metrics';
import { colourShifted, jittered, makeEntity, measurePair, profileOf } from '../../tools/lib/tracks';
import { PAL } from '../../src/art/palette';
import type { PixelCanvas } from '../../src/art/pixel';
import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterArt } from '../../src/art/types';

const track = (n: number, f: (s: number) => number[]) => Array.from({ length: n }, (_, s) => f(s));

describe('IoU', () => {
  it('is symmetric, 1 on identity, 0 on disjoint and empty masks', () => {
    const r = prng(7);
    const a = Uint8Array.from({ length: 500 }, () => (r() < 0.4 ? 1 : 0));
    const b = Uint8Array.from({ length: 500 }, () => (r() < 0.5 ? 1 : 0));
    expect(iou(a, b)).toBeCloseTo(iou(b, a), 12);
    expect(iou(a, a)).toBe(1);
    expect(iou(Uint8Array.from([1, 1, 0, 0]), Uint8Array.from([0, 0, 1, 1]))).toBe(0);
    expect(iou(new Uint8Array(4), new Uint8Array(4))).toBe(0);
    expect(iou(Uint8Array.from([1, 1, 1, 0]), Uint8Array.from([0, 1, 1, 1]))).toBeCloseTo(0.5, 12);
  });
});

describe('MOT on synthetic tracks', () => {
  const lunge = track(24, (s) => [Math.sin((Math.PI * s) / 23), -0.3 * Math.sin((Math.PI * s) / 23)]);
  it('is amplitude-free and signed (uncentred cosine)', () => {
    expect(dtwCos(lunge, lunge)).toBeCloseTo(1, 12);
    expect(dtwCos(lunge, lunge.map((v) => v.map((x) => 3 * x)))).toBeCloseTo(1, 12);
    // opposite motion is strongly negative; not −1 exactly: DTW on the unit-normalised tracks warps
    // away from an anti-correlated alignment (the revise/mot.ts definition)
    const opp = dtwCos(lunge, lunge.map((v) => v.map((x) => -x)));
    expect(opp).toBeLessThan(-0.9);
    expect(cosAligned(lunge, lunge.map((v) => v.map((x) => -x)), lunge.map((_, i) => [i, i] as [number, number]))).toBeCloseTo(-1, 12);
  });
  it('gives the cosine of the directions for straight moves (60° → 0.5) and 0 for orthogonal ones', () => {
    const a = track(24, () => [1, 0]);
    const b = track(24, () => [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)]);
    expect(dtwCos(a, b)).toBeCloseTo(0.5, 12);
    const x = track(24, (s) => [Math.sin((Math.PI * s) / 23), 0]);
    const y = track(24, (s) => [0, Math.sin((Math.PI * s) / 23)]);
    expect(dtwCos(x, y)).toBe(0);
  });
  it('a still track scores 0, not NaN', () => {
    expect(dtwCos(lunge, track(24, () => [0, 0]))).toBe(0);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });
  it('walks a monotone DTW path inside the ±3 band from (0,0) to (n−1, n−1)', () => {
    const b = track(24, (s) => [Math.sin((Math.PI * Math.min(23, s + 2)) / 23), 0]);
    const p = dtwPath(lunge, b, 3);
    expect(p[0]).toEqual([0, 0]);
    expect(p[p.length - 1]).toEqual([23, 23]);
    for (let k = 1; k < p.length; k++) {
      expect(p[k][0] - p[k - 1][0]).toBeGreaterThanOrEqual(0);
      expect(p[k][1] - p[k - 1][1]).toBeGreaterThanOrEqual(0);
      expect(Math.abs(p[k][0] - p[k][1])).toBeLessThanOrEqual(3);
    }
  });
});

describe('DTW and ±60 ms holds', () => {
  // a hand-timed one-shot: long gather, short strike, slowing recovery (REHBER HA-3 shape)
  const spec: AnimSpec = { frames: 10, fps: 12, loop: false, holds: [60, 90, 100, 160, 70, 90, 100, 110, 120, 140] };
  const pose = (f: number) => [Math.sin((Math.PI * f) / 9) * (f < 4 ? 0.4 : 1), 0.5 * (1 - Math.cos((2 * Math.PI * f) / 9))];
  const sampled = (s: AnimSpec) => sampleFrames(s, 24).map(pose);
  it('keeps MOT ≈ 1 when every hold moves ±60 ms (control (c))', () => {
    const j = jitterSpec(spec);
    expect(j.holds).not.toEqual(spec.holds);
    expect(Math.max(...j.holds!.map((h, i) => Math.abs(h - spec.holds![i])))).toBe(60);
    expect(dtwCos(sampled(spec), sampled(j))).toBeGreaterThan(0.99);
  });
  it('the jitter pattern is +60 / −60 / +30 with a 40 ms floor', () => {
    const j = jitterSpec({ frames: 4, fps: 10, loop: false, holds: [80, 80, 80, 80] });
    expect(j.holds).toEqual([140, 40, 110, 140]);
    expect(jitterSpec({ frames: 3, fps: 10, loop: true }).holds).toEqual([160, 40, 130]);
  });
});

describe('loops: cyclic shift', () => {
  const loop = track(24, (s) => [Math.sin((2 * Math.PI * s) / 24), 0.5 * Math.cos((4 * Math.PI * s) / 24)]);
  it('is phase independent', () => {
    for (const k of [0, 3, 7, 13, 23]) {
      const shifted = loop.map((_, i) => loop[(i - k + 24) % 24]);
      const c = cycCos(loop, shifted);
      expect(c.cos).toBeCloseTo(1, 12);
      expect(c.shift).toBe(k);
    }
  });
  it('index-aligned cosine without the shift is lower', () => {
    const shifted = loop.map((_, i) => loop[(i - 6 + 24) % 24]);
    expect(cosAligned(loop, shifted, loop.map((_, i) => [i, i] as [number, number]))).toBeLessThan(0.5);
  });
});

describe('RHYTHM', () => {
  it('"same" within max(40 ms, 8 %) per component', () => {
    expect(sameRhythm([400, 100, 1000], [440, 100, 1000])).toBe(true);
    expect(sameRhythm([400, 100, 1000], [441, 100, 1000])).toBe(false);
    expect(sameRhythm([1000], [1086])).toBe(true); // 8 % of 1086 = 86.9
    expect(sameRhythm([1000], [1090])).toBe(false); // 8 % of 1090 = 87.2 < 90
    expect(sameRhythm([333, 83, 833], [417, 83, 833])).toBe(false); // golem × sentinel attack (§9.2)
    expect(sameRhythm([400, 100], [400, 100, 1000])).toBe(false);
  });
  it('loop signature: total, head and body dominant periods, head lag', () => {
    const body = track(24, (s) => [0, Math.sin((2 * Math.PI * 2 * s) / 24)]);
    const head = body.map((_, i) => body[(i - 2 + 24) % 24]);
    expect(loopSignature(head, body, 2400)).toEqual([2400, 1200, 1200, 200]);
    // the lag is searched within half the body period: a follower is never read a period away
    const late = body.map((_, i) => body[(i - 8 + 24) % 24]);
    expect(lagMs(late, body, 2400, 1200)).toBe(-400);
    expect(dominantPeriodMs(track(24, () => [0, 0]), 2400)).toBe(0);
    expect(dominantPeriodMs(track(24, (s) => [Math.sin((2 * Math.PI * 3 * s) / 24) + 0.2 * Math.sin((2 * Math.PI * s) / 24), 0]), 1200)).toBe(400);
  });
});

describe('verdicts (§9.3)', () => {
  const base: PairMetrics = { KEY: 0.4, SIL0: 0.4, SI: 0.1, SIloop: 0, HEAT: 0.5, PAL: 0.5, source: 'proxy', mot: { attack: 0.2, roar: 0.1, hit: 0.1, idle: 0.1, guard: 0.1 }, MOTsig: 0.2, MOTloop: 0.1, MOTavg: 0.1, MOTavgAll: 0.1, rhythm: {} };
  const rh = (same: boolean) => ({ a: [1], b: [1], same });
  it('golem × sentinel (v1): HEAT ≥ 0.70 with MOT attack ≥ 0.55 → KALIR', () => {
    const j = judgePair({ ...base, KEY: 0.658, SIL0: 0.651, SI: 0.307, HEAT: 0.706, mot: { ...base.mot, attack: 0.593 }, MOTsig: 0.593, MOTloop: 0.434, MOTavg: 0.316, rhythm: { attack: rh(false) } });
    expect(j.v.HEAT).toBe('KALIR');
    expect(j.v.MOTsig).toBe('UYARI');
    expect(j.v.KEY).toBe('UYARI');
    expect(j.overall).toBe('KALIR');
  });
  it('titan × golem (v1): same attack rhythm with SI ≥ 0.35 → KALIR; titan × sentinel → UYARI', () => {
    expect(judgePair({ ...base, KEY: 0.615, SI: 0.357, mot: { ...base.mot, attack: 0.21 }, MOTsig: 0.691, rhythm: { attack: rh(true) } }).v.RHYTHM).toBe('KALIR');
    const ts = judgePair({ ...base, KEY: 0.662, SIL0: 0.721, SI: 0.459, HEAT: 0.652, mot: { ...base.mot, attack: 0.418 }, MOTsig: 0.418, MOTloop: 0.075, MOTavg: -0.041, rhythm: { attack: rh(false), idle: rh(false) } });
    expect(ts.overall).toBe('UYARI');
    expect([ts.v.KEY, ts.v.SI, ts.v.SIL0]).toEqual(['UYARI', 'UYARI', 'UYARI']);
  });
  it('same rhythm alone is UYARI; same idle with MOT idle ≥ 0.65 is KALIR', () => {
    expect(judgePair({ ...base, rhythm: { idle: rh(true) } }).v.RHYTHM).toBe('UYARI');
    expect(judgePair({ ...base, mot: { ...base.mot, idle: 0.7 }, rhythm: { idle: rh(true) } }).v.RHYTHM).toBe('KALIR');
  });
  it('band edges: warn and fail values belong to the higher band', () => {
    expect(judgePair({ ...base, KEY: 0.62 }).v.KEY).toBe('UYARI');
    expect(judgePair({ ...base, KEY: 0.7 }).v.KEY).toBe('KALIR');
    expect(judgePair({ ...base, MOTloop: 0.6499 }).v.MOTloop).toBe('GEÇER');
  });
  it('out of plan: KALIR counts as UYARI; SIL0 ≥ 0.80 is KALIR only for a new card', () => {
    const hot = { ...base, KEY: 0.9, SIL0: 0.85, MOTsig: 0.9 };
    expect(judgePair(hot).overall).toBe('KALIR');
    expect(judgePair(hot).v.SIL0).toBe('UYARI');
    expect(judgePair(hot, { newCard: true }).v.SIL0).toBe('KALIR');
    expect(judgePair(hot, { outOfPlan: true }).overall).toBe('UYARI');
  });
  it('exit codes 0 / 1 / 2 / 3 and control checks', () => {
    expect(exitCode(['GEÇER'])).toBe(0);
    expect(exitCode(['GEÇER', 'UYARI'])).toBe(1);
    expect(exitCode(['UYARI', 'KALIR'])).toBe(2);
    expect(exitCode(['GEÇER'], false)).toBe(3);
    const same = judgePair({ ...base, KEY: 1, MOTsig: 1, MOTloop: 1, MOTavg: 1 });
    expect(controlHeld(same, ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'])).toBe(true);
    expect(controlHeld(judgePair({ ...base, KEY: 1, MOTsig: 1, MOTloop: 0.8, MOTavg: 1 }), ['KEY', 'MOTsig', 'MOTloop'])).toBe(false);
    // a blind metric (KALIR unreachable) makes the control fail → exit 3
    const blind = withThresholds({ KEY: { fail: 1.01 }, MOTsig: { fail: 1.01 } });
    expect(blind.MOTloop).toEqual(THRESHOLDS.MOTloop);
    expect(controlHeld(judgePair({ ...base, KEY: 1, MOTsig: 1, MOTloop: 1, MOTavg: 1 }, { t: blind }), ['KEY', 'MOTsig'])).toBe(false);
    expect(median([5, 1, 3, 2])).toBe(3);
  });
  it('a control holds only in the upper half of the KALIR band (A4.1 margin, A3 open item 3)', () => {
    const REQ = ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'] as const;
    // on the KALIR line: a bare "KALIR" check (no metrics given) passes it, the margin does not
    const line: PairMetrics = { ...base, KEY: 0.7, MOTsig: 0.8, MOTloop: 0.85, MOTavg: 0.7 };
    expect(controlHeld(judgePair(line), REQ)).toBe(true);
    expect(controlHeld(judgePair(line), REQ, line)).toBe(false);
    expect(controlMargin(line, REQ)).toBeCloseTo(0, 12);
    // the floors: fail + ½ × (1 − fail)
    expect(CONTROL_MARGIN).toBe(0.5);
    expect(controlFloor('KEY')).toBeCloseTo(0.85, 12);
    expect(controlFloor('MOTsig')).toBeCloseTo(0.9, 12);
    expect(controlFloor('MOTloop')).toBeCloseTo(0.925, 12);
    expect(controlFloor('MOTavg')).toBeCloseTo(0.85, 12);
    const floor: PairMetrics = { ...base, KEY: 0.85, MOTsig: 0.9, MOTloop: 0.925, MOTavg: 0.85 };
    expect(controlHeld(judgePair(floor), REQ, floor)).toBe(true);
    const below = { ...floor, MOTloop: 0.92 };
    expect(controlHeld(judgePair(below), REQ, below)).toBe(false);
    // the sentinel's ±60 ms control (A3: "0.987 instead of 1.00"): deep in the band, it holds
    const sentinel: PairMetrics = { ...base, KEY: 1, MOTsig: 0.986, MOTloop: 0.999, MOTavg: 0.977 };
    expect(controlMargin(sentinel, REQ)).toBeGreaterThan(0.9);
    expect(controlHeld(judgePair(sentinel), REQ, sentinel)).toBe(true);
    // a perfect copy sits at depth 1; only band metrics have a depth (RHYTHM needs KALIR only)
    expect(controlMargin({ ...base, KEY: 1, MOTsig: 1, MOTloop: 1, MOTavg: 1 }, REQ)).toBeCloseTo(1, 12);
    expect(controlMargin(base, ['RHYTHM'])).toBe(Infinity);
  });
  it('member pairs of different body plans are out of plan; two hand-made arts are a gate pair', () => {
    expect(outOfPlan('biped', 'biped')).toBe(false);
    expect(outOfPlan('biped', 'serpent')).toBe(true);
    expect(outOfPlan('biped', null)).toBe(true);
    expect(outOfPlan(null, null)).toBe(false);
  });
  it('track overlays magnify small motions by a whole-number gain', () => {
    expect(panelGain(0, 16)).toBe(1);
    expect(panelGain(2, 16)).toBe(6); // capped
    expect(panelGain(3, 16)).toBe(5);
    expect(panelGain(8, 16)).toBe(2);
    expect(panelGain(20, 16)).toBe(1);
  });
});

describe('blind eye test scoring (§9.5)', () => {
  const key: BlindKey = {
    tool: 'test',
    seed: 1,
    members: ['stone_sentinel', 'magma_titan:draft'],
    silhouettes: {
      S01: { member: 'magma_titan:draft', pose: 'attack release' },
      S02: { member: 'stone_sentinel', pose: 'hit f0' },
      S03: { member: 'stone_sentinel', pose: 'attack release' },
      S04: { member: 'magma_titan:draft', pose: 'guard f0' },
    },
    pairs: {
      M01: { left: 'stone_sentinel', right: 'stone_sentinel', same: true, control: true },
      M02: { left: 'magma_titan:draft', right: 'stone_sentinel', same: false, control: false },
      M03: { left: 'magma_titan:draft', right: 'magma_titan:draft', same: true, control: true },
    },
  };
  const perfect: BlindForm = {
    members: key.members,
    silhouettes: { S01: 'magma_titan:draft', S02: 'stone_sentinel', S03: ' Stone_Sentinel ', S04: 'magma_titan:draft' },
    pairs: { M01: 'aynı', M02: 'farklı', M03: 'AYNI' },
  };
  it('a perfect form passes', () => {
    const s = scoreBlind(perfect, key);
    expect(s.pass).toBe(true);
    expect(s.exit).toBe(0);
    expect(s.pairs[0]).toMatchObject({ silCodes: 4, silCorrect: 4, motCodes: 1, motCorrect: 1 });
    expect(s.controls).toMatchObject({ total: 2, same: 2, valid: true });
  });
  it('a swapped silhouette or a "same" motion pair fails the pair (KALIR, exit 2)', () => {
    expect(scoreBlind({ ...perfect, silhouettes: { ...perfect.silhouettes, S03: 'magma_titan:draft' } }, key).exit).toBe(2);
    const s = scoreBlind({ ...perfect, pairs: { ...perfect.pairs, M02: 'aynı' } }, key);
    expect(s.pairs[0].motPass).toBe(false);
    expect(s.exit).toBe(2);
  });
  it('blank answers are wrong and listed', () => {
    const s = scoreBlind({ ...perfect, silhouettes: { ...perfect.silhouettes, S02: '' } }, key);
    expect(s.invalid).toEqual(['S02: (blank)']);
    expect(s.pass).toBe(false);
  });
  it('a reviewer who answers "farklı" to everything is eliminated (exit 3)', () => {
    const s = scoreBlind({ ...perfect, pairs: { M01: 'farklı', M02: 'farklı', M03: 'farklı' } }, key);
    expect(s.controls.valid).toBe(false);
    expect(s.exit).toBe(3);
  });
});

// ---------------------------------------------------------------- a tiny synthetic monster

/**
 * A 40×48 box creature (body, head, hand; facing right) whose head and hand follow `dir` × a
 * per-anim motion curve. Points: head, core, hand, feet. Deterministic, PAL colours only.
 */
function boxArt(dir: 1 | -1, lift = 0): MonsterArt {
  const spec = (frames: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps: 10, loop, holds, marks });
  const anims: Record<MonsterAnim, AnimSpec> = {
    idle: spec(6, true, [120, 100, 140, 120, 100, 140]),
    roar: spec(6, false, [80, 160, 70, 100, 110, 130], { charge: 1, release: 2, impact: 2, recover: 4 }),
    attack: spec(8, false, [60, 90, 160, 60, 80, 100, 110, 130], { charge: 1, release: 3, impact: 3, recover: 5 }),
    hit: spec(4, false, [50, 60, 100, 120], { impact: 0, contact: 0, recover: 2 }),
    guard: spec(4, true, [140, 160, 140, 160]),
  };
  const curve = (anim: AnyMonsterAnim, f: number): [number, number] => {
    const n = anims[anim as MonsterAnim].frames;
    const t = f / (n - 1);
    switch (anim) {
      case 'idle':
        return [0, Math.round(Math.sin((2 * Math.PI * f) / n))];
      case 'guard':
        return [Math.round(Math.sin((2 * Math.PI * f) / n)), 1];
      case 'attack':
        return [Math.round(dir * 7 * Math.sin(Math.PI * t)), Math.round(-lift * Math.sin(Math.PI * t))];
      case 'roar':
        return [Math.round(dir * -3 * Math.sin(Math.PI * t)), Math.round(-5 * Math.sin(Math.PI * t))];
      default:
        return [Math.round(-dir * 4 * (1 - t)), 0];
    }
  };
  const draw = (p: PixelCanvas, anim: AnyMonsterAnim, f: number) => {
    const [dx, dy] = curve(anim, f);
    p.rect(12, 20, 16, 24, PAL.stone2);
    p.rect(14 + dx, 8 + dy, 12, 12, PAL.stone3);
    p.rect(26 + dx, 26 + Math.round(dy / 2), 6, 4, PAL.stone1);
    p.outline(PAL.ink);
  };
  return {
    id: 'stone_sentinel',
    w: 40,
    h: 48,
    anchorX: 20,
    anchorY: 44,
    hover: 0,
    muzzle: { x: 30, y: 14 },
    core: { x: 20, y: 30 },
    anims,
    attackImpactFrame: 3,
    draw: (p, anim, f) => draw(p, anim, f),
    points: (anim, f) => {
      const [dx, dy] = curve(anim, f);
      return { head: { x: 20 + dx, y: 14 + dy }, core: { x: 20, y: 30 }, hand: { x: 29 + dx, y: 28 + Math.round(dy / 2) }, feet: { x: 20, y: 44 } };
    },
  };
}

describe('art → profile → pair (tracks.ts)', () => {
  const a = makeEntity('box', boxArt(1));
  const pa = profileOf(a);
  it('measures on point tracks when both arts have points()', () => {
    expect(pa.sources).toEqual(['points', 'proxy']);
    expect(pa.anims.attack!.tracks.points!.names).toEqual(['head', 'core', 'hand', 'feet']);
    expect(pa.H).toBe(44 - 7); // anchorY − the outlined head's top row
  });
  it('control (a): the colour-shifted copy is a KALIR (KEY 1, MOT 1)', () => {
    const c = colourShifted(a);
    const m = measurePair(pa, profileOf(c));
    expect(m.source).toBe('points');
    expect(m.KEY).toBe(1);
    expect(m.MOTsig).toBeCloseTo(1, 9);
    expect(m.MOTloop).toBeCloseTo(1, 9);
    expect(m.PAL).toBeGreaterThan(0.3); // the palette did change
    expect(controlHeld(judgePair(m), ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'])).toBe(true);
  });
  it('control (c): ±60 ms holds keep MOT ≥ 0.95 and the key poses identical', () => {
    const m = measurePair(pa, profileOf(jittered(a)));
    expect(m.KEY).toBe(1);
    expect(m.MOTsig).toBeGreaterThan(0.95);
    expect(controlHeld(judgePair(m), ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'], m)).toBe(true);
    // the box's 4-frame guard is the weak spot of the loop metric (no DTW in loops): ±60 ms moves its
    // 140–160 ms holds by ±40 %, the best cyclic shift cannot re-align them — MOTloop ≈ 0.93, still in the
    // upper half of the KALIR band (REHBER §4.9 asks ≥ 6 guard / ≥ 12 idle frames; real v3 art reads ≥ 0.98)
    expect(m.MOTloop).toBeLessThan(0.95);
    expect(controlMargin(m, ['MOTloop'])).toBeGreaterThan(CONTROL_MARGIN);
  });
  it('control (c) on 50–60 ms holds (the sentinel case): the swing anims stay deep in the KALIR band', () => {
    const art = boxArt(1);
    const short: MonsterArt = {
      ...art,
      anims: { ...art.anims, attack: { ...art.anims.attack, holds: [50, 50, 60, 50, 50, 50, 60, 50] }, roar: { ...art.anims.roar, holds: [50, 50, 60, 50, 50, 60] } },
    };
    const s = makeEntity('box-short', short);
    const m = measurePair(profileOf(s), profileOf(jittered(s)));
    expect(m.MOTsig).toBeGreaterThan(controlFloor('MOTsig'));
    expect(controlHeld(judgePair(m), ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'], m)).toBe(true);
  });
  it('the opposite strike reads as different motion, the same strike with a lift as related', () => {
    const back = measurePair(pa, profileOf(makeEntity('box-back', boxArt(-1))));
    expect(back.mot.attack!).toBeLessThan(-0.5);
    expect(judgePair(back).v.MOTsig).toBe('GEÇER');
    const lifted = measurePair(pa, profileOf(makeEntity('box-lift', boxArt(1, 4))));
    expect(lifted.mot.attack!).toBeGreaterThan(0.6);
    expect(lifted.mot.attack!).toBeLessThan(0.999);
    // the silhouette proxy orders them the same way, less sharply: its moving-mass channel rises in
    // both strikes (the changed pixels sit at the head) — the proxy's known weakness (§9.2 obs. 6)
    const pBack = measurePair(pa, profileOf(makeEntity('box-back2', boxArt(-1))), { source: 'proxy' }).mot.attack!;
    const pLift = measurePair(pa, profileOf(makeEntity('box-lift2', boxArt(1, 4))), { source: 'proxy' }).mot.attack!;
    expect(pBack).toBeLessThan(pLift - 0.3);
  });
  it('rhythm parts come from the marks and holds', () => {
    expect(pa.anims.attack!.rhythm).toEqual([250, 140, 790]); // charge f1 → release f3 (90 + 160), release f3 → recover f5 (60 + 80), total
    expect(pa.anims.hit!.rhythm).toEqual([110, 330]);
    expect(pa.anims.idle!.loopSig.points![0]).toBe(720);
  });
});
