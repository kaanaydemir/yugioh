// Sameness metrics (docs/v3/A3_MIMARI.md §9, docs/v3/REHBER.md §8.2.1) — pure functions on masks,
// tracks and timings, no art / Phaser / fs: unit-tested in tests/tools/sameness.test.ts. The art side
// (frames → masks, curves, tracks, rhythm parts) is tools/lib/tracks.ts; the CLI is tools/sameness.ts.
//
// Pair metrics (each art is first reduced to a Profile by tracks.ts):
//   KEY    mean silhouette IoU of the three key poses (idle f0, attack release, hit f0)
//   SIL0   idle f0 IoU only
//   SI     per base one-shot (attack, roar, hit): (mean IoU of 8 hold-weighted silhouettes) ×
//          max(0, Pearson r of the 5-channel silhouette motion curve), mean over the anims — the §9.2
//          calibration definition (judge/calib.ts; titan × sentinel 0.459). The §9.1 loop term
//          (idle / guard, best cyclic shift) is computed too and reported as SIloop, not averaged
//          into SI: averaging it in would move the calibrated values the §9.3 bands rest on.
//   HEAT   mean IoU of the "differs from idle f0 in any frame" masks of attack and hit
//   PAL    idle f0 value (6 bins) and hue (8 bins) histogram L1, mean of the two (report only)
//   MOT    per anim, from displacement tracks (joints / points / silhouette proxy, tracks.ts):
//          one-shots: DTW alignment (band ±3 of 24 samples ≈ ±12 % of the length) on unit-normalised
//          tracks, then the UNCENTRED cosine of the raw tracks over the warped pairs; loops: the best
//          cosine over all cyclic shifts (phase independent). Near / far arm tried both ways, max kept.
//          MOTsig = max over attack, roar (+ special when both have it); MOTloop = max(idle, guard);
//          MOTavg = mean over the five base anims (attack, roar, hit, idle, guard: the calibrated
//          set; MOTavgAll = mean over every common anim, reported — see tracks.ts AVG_ANIMS).
//   RHYTHM attack / roar / special [charge→release, release→recover, total]; hit* [impact→recover,
//          total]; death [impact→dissolve, total]; loops [total, head period, body period, head lag]
//          (ms). "Same" in an anim when every component is within max(40 ms, 8 %).

// ---------------------------------------------------------------- basic vector math

/** Intersection over union of two same-size 0/1 masks (0 when both are empty). Symmetric. */
export function iou(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let i = 0;
  let u = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] && b[k]) i++;
    if (a[k] || b[k]) u++;
  }
  return u ? i / u : 0;
}

/** Pearson correlation (0 when either side has no variance). */
export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  if (!n) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let c = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    c += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return va && vb ? c / Math.sqrt(va * vb) : 0;
}

export function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** A motion track: S time samples × C channels (displacements divided by the body height). */
export type Track = readonly (readonly number[])[];

/** Frobenius norm of a track. */
export function trackNorm(t: Track): number {
  let s = 0;
  for (const v of t) s += dot(v, v);
  return Math.sqrt(s);
}

/** Uncentred cosine of two tracks over index pairs (0 when either side is still). */
export function cosAligned(a: Track, b: Track, pairs: readonly (readonly [number, number])[]): number {
  let c = 0;
  let na = 0;
  let nb = 0;
  for (const [i, j] of pairs) {
    c += dot(a[i], b[j]);
    na += dot(a[i], a[i]);
    nb += dot(b[j], b[j]);
  }
  return na && nb ? c / Math.sqrt(na * nb) : 0;
}

/**
 * DTW warping path of two equally sampled tracks (squared distance of the unit-normalised tracks,
 * Sakoe–Chiba band ±`band` samples, steps (1,1) (1,0) (0,1), first minimum wins). From (0,0) to
 * (n−1, m−1).
 */
export function dtwPath(a: Track, b: Track, band = 3): [number, number][] {
  const A = trackNorm(a) || 1;
  const B = trackNorm(b) || 1;
  const an = a.map((v) => v.map((x) => x / A));
  const bn = b.map((v) => v.map((x) => x / B));
  const n = a.length;
  const m = b.length;
  const w = Math.max(band, Math.abs(n - m));
  const D: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(Infinity));
  const P: [number, number][][] = Array.from({ length: n }, () => new Array<[number, number]>(m));
  for (let i = 0; i < n; i++)
    for (let j = Math.max(0, i - w); j <= Math.min(m - 1, i + w); j++) {
      let d = 0;
      for (let k = 0; k < an[i].length; k++) d += (an[i][k] - bn[j][k]) ** 2;
      if (i === 0 && j === 0) {
        D[i][j] = d;
        continue;
      }
      let best = Infinity;
      let from: [number, number] = [0, 0];
      for (const [pi, pj] of [[i - 1, j - 1], [i - 1, j], [i, j - 1]] as [number, number][])
        if (pi >= 0 && pj >= 0 && D[pi][pj] < best) {
          best = D[pi][pj];
          from = [pi, pj];
        }
      D[i][j] = d + best;
      P[i][j] = from;
    }
  const pairs: [number, number][] = [];
  let i = n - 1;
  let j = m - 1;
  pairs.push([i, j]);
  while (i > 0 || j > 0) {
    [i, j] = P[i][j];
    pairs.push([i, j]);
  }
  return pairs.reverse();
}

/** One-shot MOT: uncentred cosine of the raw tracks over their DTW path. */
export function dtwCos(a: Track, b: Track, band = 3): number {
  return cosAligned(a, b, dtwPath(a, b, band));
}

/** Loop MOT: the best uncentred cosine over every cyclic shift of b (phase independent). */
export function cycCos(a: Track, b: Track): { cos: number; shift: number } {
  const n = a.length;
  let best = -Infinity;
  let shift = 0;
  for (let s = 0; s < n; s++) {
    const c = cosAligned(a, b, a.map((_, i) => [i, (i + s) % n] as [number, number]));
    if (c > best + 1e-12) {
      best = c;
      shift = s;
    }
  }
  return { cos: n ? best : 0, shift };
}

/** Reorder the 2-D channels of a track (perm[k] = source channel pair of output pair k). */
export function permutePairs(t: Track, perm: readonly number[]): number[][] {
  return t.map((v) => perm.flatMap((p) => [v[2 * p], v[2 * p + 1]]));
}

// ---------------------------------------------------------------- anims

export type Anim = 'idle' | 'roar' | 'attack' | 'hit' | 'guard' | 'summon' | 'death' | 'revive' | 'special' | 'hitHeavy' | 'hitMagic' | 'victory' | 'toGuard' | 'fromGuard';
/** One-shot anims that are compared (§9.1 "ortak animler"; special only joins when both arts have it). */
export const ONE_SHOTS: readonly Anim[] = ['attack', 'roar', 'special', 'hit', 'hitHeavy', 'hitMagic', 'summon', 'death'];
export const LOOPS: readonly Anim[] = ['idle', 'guard'];
/** Signature anims (MOTsig). */
export const SIG_ANIMS: readonly Anim[] = ['attack', 'roar', 'special'];
export type RhythmKind = 'swing' | 'react' | 'death' | 'summon' | 'loop';
export function rhythmKind(a: Anim): RhythmKind {
  if (a === 'attack' || a === 'roar' || a === 'special') return 'swing';
  if (a === 'hit' || a === 'hitHeavy' || a === 'hitMagic') return 'react';
  if (a === 'death') return 'death';
  if (a === 'idle' || a === 'guard') return 'loop';
  return 'summon';
}

// ---------------------------------------------------------------- SI

/** SI term of one one-shot anim: mean IoU of the time-sampled silhouettes × max(0, Pearson r of the motion curves). */
export function siOneShot(masksA: readonly Uint8Array[], masksB: readonly Uint8Array[], curveA: readonly number[], curveB: readonly number[]): number {
  const n = Math.min(masksA.length, masksB.length);
  let s = 0;
  for (let k = 0; k < n; k++) s += iou(masksA[k], masksB[k]);
  return n ? (s / n) * Math.max(0, pearson(curveA, curveB)) : 0;
}

/**
 * SI term of a loop (§9.1: best cyclic shift). Masks and curve are sampled on the same S time
 * samples; the curve is sample-major (S × C flattened), so a shift moves whole samples.
 */
export function siLoop(masksA: readonly Uint8Array[], masksB: readonly Uint8Array[], curveA: readonly number[], curveB: readonly number[]): number {
  const n = Math.min(masksA.length, masksB.length);
  if (!n) return 0;
  const C = curveA.length / n;
  let best = 0;
  for (let s = 0; s < n; s++) {
    let m = 0;
    const cb: number[] = [];
    for (let k = 0; k < n; k++) {
      const j = (k + s) % n;
      m += iou(masksA[k], masksB[j]);
      for (let c = 0; c < C; c++) cb.push(curveB[j * C + c]);
    }
    best = Math.max(best, (m / n) * Math.max(0, pearson(curveA as number[], cb)));
  }
  return best;
}

// ---------------------------------------------------------------- rhythm

export interface Tolerance {
  ms: number;
  pct: number;
}

/** Same rhythm: every component within max(tol.ms, tol.pct × the larger magnitude). */
export function sameRhythm(a: readonly number[], b: readonly number[], tol: Tolerance = { ms: 40, pct: 0.08 }): boolean {
  if (a.length !== b.length || !a.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > Math.max(tol.ms, tol.pct * Math.max(Math.abs(a[i]), Math.abs(b[i])))) return false;
  return true;
}

function centred(t: Track): number[][] {
  const n = t.length;
  const C = n ? t[0].length : 0;
  const mean = new Array<number>(C).fill(0);
  for (const v of t) for (let c = 0; c < C; c++) mean[c] += v[c] / n;
  return t.map((v) => v.map((x, c) => x - mean[c]));
}

/** Circular autocorrelation r(k), k = 0…n−1, of a (multi-channel) loop track, mean removed, r(0) = 1. */
export function autocorr(t: Track): number[] {
  const x = centred(t);
  const n = x.length;
  const r: number[] = [];
  const e = x.reduce((s, v) => s + dot(v, v), 0);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += dot(x[i], x[(i + k) % n]);
    r.push(e > 1e-12 ? s / e : 0);
  }
  return r;
}

/**
 * Dominant period (ms) of a loop track by autocorrelation: the strongest harmonic of the circular
 * autocorrelation's spectrum (Wiener–Khinchin: the power spectrum of the track), period =
 * loop length / harmonic. 0 for a still track (energy below `minEnergy`, in body-height² units).
 */
export function dominantPeriodMs(t: Track, totalMs: number, minEnergy = 1e-6): number {
  const n = t.length;
  const x = centred(t);
  const e = x.reduce((s, v) => s + dot(v, v), 0) / Math.max(1, n);
  if (n < 2 || e < minEnergy) return 0;
  const r = autocorr(t);
  let bestK = 1;
  let bestP = -Infinity;
  for (let k = 1; k <= Math.floor(n / 2); k++) {
    let re = 0;
    for (let j = 0; j < n; j++) re += r[j] * Math.cos((2 * Math.PI * k * j) / n);
    if (re > bestP + 1e-9) {
      bestP = re;
      bestK = k;
    }
  }
  return totalMs / bestK;
}

/**
 * Head lag (ms): the cyclic shift that best aligns the head track to the body track (circular
 * cross-correlation, mean removed), > 0 = the head follows the body. Searched within half the body's
 * period (`periodMs`; the whole loop when absent): the correlation repeats every body period, so a
 * wider window would report e.g. −825 ms for a +165 ms follower on a 990 ms breath. 0 when either is still.
 */
export function lagMs(head: Track, body: Track, totalMs: number, periodMs = totalMs, minEnergy = 1e-6): number {
  const n = head.length;
  const h = centred(head);
  const b = centred(body);
  const eh = h.reduce((s, v) => s + dot(v, v), 0) / Math.max(1, n);
  const eb = b.reduce((s, v) => s + dot(v, v), 0) / Math.max(1, n);
  if (n < 2 || eh < minEnergy || eb < minEnergy) return 0;
  const win = Math.max(1, Math.min(n, Math.round((n * (periodMs > 0 ? periodMs : totalMs)) / totalMs)));
  let best = -Infinity;
  let bestS = 0;
  for (let s = -Math.ceil(win / 2) + 1; s <= Math.floor(win / 2); s++) {
    let c = 0;
    for (let i = 0; i < n; i++) c += dot(h[(i + s + n) % n], b[i]);
    if (c > best + 1e-12) {
      best = c;
      bestS = s;
    }
  }
  return (bestS * totalMs) / n;
}

/** Loop rhythm signature [total, head period, body period, head lag] (ms). */
export function loopSignature(head: Track, body: Track, totalMs: number): number[] {
  const pb = dominantPeriodMs(body, totalMs);
  return [totalMs, dominantPeriodMs(head, totalMs), pb, lagMs(head, body, totalMs, pb || totalMs)];
}

// ---------------------------------------------------------------- thresholds and verdicts (§9.3)

export type Verdict = 'GEÇER' | 'UYARI' | 'KALIR';
const RANK: Record<Verdict, number> = { 'GEÇER': 0, 'UYARI': 1, 'KALIR': 2 };
export function worst(vs: readonly Verdict[]): Verdict {
  return vs.reduce<Verdict>((w, v) => (RANK[v] > RANK[w] ? v : w), 'GEÇER');
}

export interface Band {
  /** UYARI from this value on */
  warn: number;
  /** KALIR from this value on */
  fail: number;
}
export interface Thresholds {
  KEY: Band;
  MOTsig: Band;
  MOTloop: Band;
  MOTavg: Band;
  SI: Band;
  /** HEAT: UYARI ≥ warn; KALIR ≥ warn and MOT attack ≥ MOTsig.warn */
  HEAT: { warn: number };
  /** SIL0: UYARI ≥ warn; KALIR ≥ failNew on new cards only (no v1 reference) */
  SIL0: { warn: number; failNew: number };
  RHYTHM: Tolerance;
}

/** §9.3 (provisional MOT thresholds from the silhouette proxy; Y6 / Y9 / Y10 calibrate). */
export const THRESHOLDS: Thresholds = {
  KEY: { warn: 0.62, fail: 0.7 },
  MOTsig: { warn: 0.55, fail: 0.8 },
  MOTloop: { warn: 0.65, fail: 0.85 },
  MOTavg: { warn: 0.45, fail: 0.7 },
  SI: { warn: 0.35, fail: 0.5 },
  HEAT: { warn: 0.7 },
  SIL0: { warn: 0.7, failNew: 0.8 },
  RHYTHM: { ms: 40, pct: 0.08 },
};

/** Thresholds with a partial override (e.g. a --thresholds JSON for recalibration experiments). */
export function withThresholds(o: unknown): Thresholds {
  const t = JSON.parse(JSON.stringify(THRESHOLDS)) as Thresholds;
  if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o as Record<string, unknown>))
      if (k in t && v && typeof v === 'object') Object.assign((t as unknown as Record<string, object>)[k], v);
  return t;
}

export function bandVerdict(v: number, b: Band): Verdict {
  return v >= b.fail ? 'KALIR' : v >= b.warn ? 'UYARI' : 'GEÇER';
}

export type MotSource = 'joints' | 'points' | 'proxy';

/** Everything measured for one pair (from two Profiles). */
export interface PairMetrics {
  KEY: number;
  SIL0: number;
  SI: number;
  /** §9.1 loop term of SI (best cyclic shift, mean of idle and guard); reported, not gated. */
  SIloop: number;
  HEAT: number;
  PAL: number;
  source: MotSource;
  /** MOT per common anim */
  mot: Partial<Record<Anim, number>>;
  MOTsig: number;
  MOTloop: number;
  /** mean over the five base anims (attack, roar, hit, idle, guard: the calibrated set) — gated */
  MOTavg: number;
  /** mean over every common anim (v3 extras included) — reported */
  MOTavgAll: number;
  /** rhythm parts of both sides per common anim, and whether they are "the same" */
  rhythm: Partial<Record<Anim, { a: number[]; b: number[]; same: boolean }>>;
}

export type Metric = 'KEY' | 'MOTsig' | 'MOTloop' | 'MOTavg' | 'SI' | 'RHYTHM' | 'HEAT' | 'SIL0';
export const METRICS: readonly Metric[] = ['KEY', 'MOTsig', 'MOTloop', 'MOTavg', 'SI', 'RHYTHM', 'HEAT', 'SIL0'];

export interface PairJudgement {
  v: Record<Metric, Verdict>;
  overall: Verdict;
  /** human-readable reasons of every UYARI / KALIR */
  why: string[];
}

export interface JudgeOpts {
  t?: Thresholds;
  /** out-of-plan pair (--against all): a KALIR counts as UYARI (blind eye test), never blocks */
  outOfPlan?: boolean;
  /** a new card without a v1 reference: SIL0 ≥ failNew is KALIR */
  newCard?: boolean;
}

const f2 = (x: number) => x.toFixed(3);

/** §9.3 verdicts of one pair. */
export function judgePair(m: PairMetrics, o: JudgeOpts = {}): PairJudgement {
  const t = o.t ?? THRESHOLDS;
  const why: string[] = [];
  const v = {} as Record<Metric, Verdict>;
  for (const k of ['KEY', 'MOTsig', 'MOTloop', 'MOTavg', 'SI'] as const) {
    v[k] = bandVerdict(m[k], t[k]);
    if (v[k] !== 'GEÇER') why.push(`${k} ${f2(m[k])} ≥ ${v[k] === 'KALIR' ? t[k].fail : t[k].warn}`);
  }
  const motAtk = m.mot.attack ?? -Infinity;
  const motIdle = m.mot.idle ?? -Infinity;
  const sameAtk = !!m.rhythm.attack?.same;
  const sameIdle = !!m.rhythm.idle?.same;
  if ((sameAtk && (motAtk >= t.MOTsig.warn || m.SI >= t.SI.warn || m.KEY >= t.KEY.warn)) || (sameIdle && motIdle >= t.MOTloop.warn)) {
    v.RHYTHM = 'KALIR';
    if (sameAtk && (motAtk >= t.MOTsig.warn || m.SI >= t.SI.warn || m.KEY >= t.KEY.warn)) why.push(`RHYTHM attack same and (MOT attack ${f2(motAtk)} / SI ${f2(m.SI)} / KEY ${f2(m.KEY)})`);
    if (sameIdle && motIdle >= t.MOTloop.warn) why.push(`RHYTHM idle same and MOT idle ${f2(motIdle)} ≥ ${t.MOTloop.warn}`);
  } else if (sameAtk || sameIdle) {
    v.RHYTHM = 'UYARI';
    why.push(`RHYTHM same in ${[sameAtk ? 'attack' : '', sameIdle ? 'idle' : ''].filter(Boolean).join(' + ')}`);
  } else v.RHYTHM = 'GEÇER';
  if (m.HEAT >= t.HEAT.warn) {
    v.HEAT = motAtk >= t.MOTsig.warn ? 'KALIR' : 'UYARI';
    why.push(`HEAT ${f2(m.HEAT)} ≥ ${t.HEAT.warn}${v.HEAT === 'KALIR' ? ` and MOT attack ${f2(motAtk)} ≥ ${t.MOTsig.warn}` : ' (look at the overlay)'}`);
  } else v.HEAT = 'GEÇER';
  if (m.SIL0 >= t.SIL0.warn) {
    v.SIL0 = o.newCard && m.SIL0 >= t.SIL0.failNew ? 'KALIR' : 'UYARI';
    why.push(`SIL0 ${f2(m.SIL0)} ≥ ${v.SIL0 === 'KALIR' ? t.SIL0.failNew : t.SIL0.warn}`);
  } else v.SIL0 = 'GEÇER';
  if (o.outOfPlan) for (const k of METRICS) if (v[k] === 'KALIR') v[k] = 'UYARI';
  return { v, overall: worst(METRICS.map((k) => v[k])), why };
}

/** Exit code of a run (§9.4): 3 a control did not hold ("blind metric"), 2 a KALIR, 1 a UYARI, 0 clean. */
export function exitCode(overall: readonly Verdict[], controlsHeld = true): 0 | 1 | 2 | 3 {
  if (!controlsHeld) return 3;
  const w = worst(overall);
  return w === 'KALIR' ? 2 : w === 'UYARI' ? 1 : 0;
}

/** A negative control holds when every metric it names comes out KALIR. */
export function controlHeld(j: PairJudgement, required: readonly Metric[]): boolean {
  return required.every((k) => j.v[k] === 'KALIR');
}

/** Median (the lower middle for an even count, like judge/calib.ts xs[33] of 66). */
export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}

// ---------------------------------------------------------------- blind eye test (§9.5)

export interface BlindKey {
  tool: string;
  seed: number;
  members: string[];
  /** code → whose silhouette and which pose */
  silhouettes: Record<string, { member: string; pose: string }>;
  /** code → the two strips (left / right member) and whether it is a control (same member, jittered holds) */
  pairs: Record<string, { left: string; right: string; same: boolean; control: boolean }>;
}

export interface BlindForm {
  members: string[];
  /** code → member name (filled by the reviewer) */
  silhouettes: Record<string, string>;
  /** pair code → "aynı" / "farklı" (filled by the reviewer) */
  pairs: Record<string, string>;
}

export interface BlindPairScore {
  a: string;
  b: string;
  /** silhouette codes of a and b, and how many were assigned to their own member */
  silCodes: number;
  silCorrect: number;
  silPass: boolean;
  /** motion pair codes of a × b, and how many were answered "farklı" */
  motCodes: number;
  motCorrect: number;
  motPass: boolean;
  pass: boolean;
}

export interface BlindScore {
  pairs: BlindPairScore[];
  controls: { total: number; same: number; rate: number; valid: boolean };
  /** answers that are neither a member name nor aynı / farklı, and codes left blank */
  invalid: string[];
  pass: boolean;
  exit: 0 | 2 | 3;
}

const norm = (s: unknown) => String(s ?? '').trim().toLocaleLowerCase('tr');
export function parseSame(s: unknown): boolean | null {
  const v = norm(s);
  if (['aynı', 'ayni', 'same', 'a'].includes(v)) return true;
  if (['farklı', 'farkli', 'different', 'f'].includes(v)) return false;
  return null;
}

/**
 * Score a filled blind form against its key (§9.5 step 3). Silhouettes: for every member pair, 100 %
 * of both members' codes must be assigned to their own member. Motion: every different-member pair
 * must be answered "farklı"; ≥ 80 % of the control pairs (same member) "aynı", else the reviewer is
 * eliminated (exit 3: the test is void). A failing pair counts as KALIR (exit 2).
 */
export function scoreBlind(form: BlindForm, key: BlindKey, controlRate = 0.8): BlindScore {
  const invalid: string[] = [];
  const members = key.members;
  const byName = new Map(members.map((m) => [norm(m), m]));
  const silAns = new Map<string, string | null>();
  for (const code of Object.keys(key.silhouettes)) {
    const a = form.silhouettes?.[code];
    const m = byName.get(norm(a)) ?? null;
    if (m === null) invalid.push(`${code}: ${a === undefined || a === '' ? '(blank)' : JSON.stringify(a)}`);
    silAns.set(code, m);
  }
  const pairAns = new Map<string, boolean | null>();
  for (const code of Object.keys(key.pairs)) {
    const a = form.pairs?.[code];
    const s = parseSame(a);
    if (s === null) invalid.push(`${code}: ${a === undefined || a === '' ? '(blank)' : JSON.stringify(a)}`);
    pairAns.set(code, s);
  }
  const pairs: BlindPairScore[] = [];
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const sil = Object.entries(key.silhouettes).filter(([, s]) => s.member === a || s.member === b);
      const silCorrect = sil.filter(([c, s]) => silAns.get(c) === s.member).length;
      const mot = Object.entries(key.pairs).filter(([, p]) => !p.control && ((p.left === a && p.right === b) || (p.left === b && p.right === a)));
      const motCorrect = mot.filter(([c]) => pairAns.get(c) === false).length;
      const silPass = silCorrect === sil.length;
      const motPass = motCorrect === mot.length;
      pairs.push({ a, b, silCodes: sil.length, silCorrect, silPass, motCodes: mot.length, motCorrect, motPass, pass: silPass && motPass });
    }
  const ctl = Object.entries(key.pairs).filter(([, p]) => p.control);
  const same = ctl.filter(([c]) => pairAns.get(c) === true).length;
  const rate = ctl.length ? same / ctl.length : 1;
  const valid = rate >= controlRate - 1e-9;
  const pass = valid && pairs.every((p) => p.pass);
  return { pairs, controls: { total: ctl.length, same, rate, valid }, invalid, pass, exit: !valid ? 3 : pass ? 0 : 2 };
}
