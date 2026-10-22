// Art → sameness profile (docs/v3/A3_MIMARI.md §9.1): the silhouettes, motion curves, displacement
// tracks and rhythm parts of one MonsterArt, measured once and cached, so a pair is only vector math
// (tools/lib/sameness-metrics.ts). Used by tools/sameness.ts.
//
// Track sources (MOT, "body-shape independent"): every track is the displacement of a point from
// where it is in idle f0, divided by the art's idle-f0 body height (anchorY − top row), at 24
// hold-weighted time samples:
//   joints  plan monsters: MonsterArt.joints() (handN, handF, head, hip, footN, footF, prop*…)
//   points  other v3 art: MonsterArt.points() (head, core, muzzle, feet; hand ← hand | claw;
//           prop ← staff | grip), explicit points only (no fixed fallbacks)
//   proxy   v1 and point-less art: the silhouette proxy MOTs of revise/mot.ts — top point (x, y),
//           front point (x, y), back edge x, and the moving-mass vector (centroid shift of the pixels
//           whose opacity differs from idle f0 × changed-area share, ×4)
// A pair uses joints when both arts have them, else points (≥ 2 common names), else the proxy.

import { animSpec, frameMs, markFrame } from '../../src/art/animtime';
import { RAMPS } from '../../src/art/palette';
import type { PixelCanvas } from '../../src/art/pixel';
import type { AnimSpec, AnyMonsterAnim, DrawOpts, MonsterArt } from '../../src/art/types';
import { FrameStore, bodyHeight, changedMask, jitterSpec, normMask, sampleFrames } from './framelib';
import {
  type Anim,
  type MotSource,
  type PairMetrics,
  LOOPS,
  ONE_SHOTS,
  SIG_ANIMS,
  type Thresholds,
  THRESHOLDS,
  cycCos,
  dtwCos,
  iou,
  loopSignature,
  permutePairs,
  rhythmKind,
  sameRhythm,
  siLoop,
  siOneShot,
} from './sameness-metrics';

/** Samples: MOT tracks, SI silhouettes (one-shots), SI motion curve (one-shots), loops (both). */
export const S_TRACK = 24;
export const S_SIL = 8;
export const S_CURVE = 20;
export const S_LOOP = 24;

// ---------------------------------------------------------------- entities

/** One art under comparison: a registry art, a draft file, or a control built from one. */
export interface Entity {
  /** unique label: 'stone_sentinel', 'crystal_wyrm:v1', 'magma_titan:draft', 'tide_golem:jitter'… */
  tag: string;
  id: string;
  art: MonsterArt;
  store: FrameStore;
  /** body plan id (MonsterArt.bodyPlan) or null */
  plan: string | null;
  /** the anim spec used for TIMING (control (c) jitters it; the frames stay the art's) */
  spec(anim: AnyMonsterAnim): AnimSpec | undefined;
  /** which control this entity is ('a' colour, 'b' cross build, 'c' hold jitter), if any */
  control?: 'a' | 'b' | 'c';
  /** the entity a control was derived from */
  of?: string;
}

export function makeEntity(tag: string, art: MonsterArt, o: { store?: FrameStore; jitter?: boolean; control?: Entity['control']; of?: string } = {}): Entity {
  const jit = new Map<string, AnimSpec | undefined>();
  return {
    tag,
    id: art.id,
    art,
    store: o.store ?? new FrameStore(art),
    plan: art.bodyPlan?.id ?? null,
    spec(anim) {
      const s = animSpec(art, anim);
      if (!o.jitter || !s) return s;
      if (!jit.has(anim)) jit.set(anim, jitterSpec(s));
      return jit.get(anim);
    },
    control: o.control,
    of: o.of,
  };
}

/** Control (c): the same art (same frames, shared frame cache), every hold moved ±60 ms. */
export function jittered(e: Entity): Entity {
  return makeEntity(`${e.tag}:jitter`, e.art, { store: e.store, jitter: true, control: 'c', of: e.tag });
}

/** The ramp-shift colour map of control (a): every ramp colour → the same step of the next ramp. */
export function rampShift(): (c: number) => number {
  const names = (Object.keys(RAMPS) as (keyof typeof RAMPS)[]).filter((n) => n !== 'night');
  const m = new Map<number, number>();
  names.forEach((n, i) => RAMPS[n].forEach((c, k) => m.set(c, RAMPS[names[(i + 1) % names.length]][k])));
  return (c) => m.get(c) ?? c;
}

/** An art drawn exactly like `art`, every pixel recoloured through `map` (control (a)). */
export function recoloured(art: MonsterArt, map: (c: number) => number): MonsterArt {
  const w = Object.create(art) as MonsterArt;
  const post = (p: PixelCanvas) => p.map((c) => map(c));
  w.draw = (p, anim, f, o?: DrawOpts) => {
    if (o) art.draw(p, anim, f, o);
    else art.draw(p, anim, f);
    post(p);
  };
  if (art.drawExtra)
    w.drawExtra = (p, anim, f, o?: DrawOpts) => {
      art.drawExtra!(p, anim, f, o);
      post(p);
    };
  return w;
}

/** Control (a): the art with its palette shifted (KEY and MOT must stay ≈ 1). */
export function colourShifted(e: Entity): Entity {
  return makeEntity(`${e.tag}:colour`, recoloured(e.art, rampShift()), { control: 'a', of: e.tag });
}

// ---------------------------------------------------------------- profiles

export interface NamedTrack {
  names: string[];
  /** S × 2·names: per sample [dx0, dy0, dx1, dy1, …] / body height */
  data: number[][];
  /** loop rhythm tracks (2-D): head and body (hip / core / silhouette centroid) */
  head: number[][] | null;
  body: number[][] | null;
}

export interface AnimProfile {
  anim: Anim;
  loop: boolean;
  totalMs: number;
  /** one-shot rhythm parts (ms) */
  rhythm: number[];
  /** loop rhythm signature per track source: [total, head period, body period, head lag] (ms) */
  loopSig: Partial<Record<MotSource, number[]>>;
  /** SI: silhouettes at the time samples (one-shots 8, loops 24) */
  siMasks: Uint8Array[];
  /** SI motion curve: one-shots channel-major 5 × 20 (judge/calib.ts), loops sample-major 24 × 5 */
  siCurve: number[];
  tracks: Partial<Record<MotSource, NamedTrack>>;
  /** frame shown at each of the 24 track samples (for the track overlays) */
  frames: number[];
}

export interface Profile {
  tag: string;
  id: string;
  plan: string | null;
  control?: Entity['control'];
  of?: string;
  sources: MotSource[];
  /** idle-f0 body height (px) */
  H: number;
  /** KEY poses: idle f0, attack release, hit f0 (normalized masks) */
  key: Uint8Array[];
  keyFrames: { release: number };
  /** HEAT masks: attack, hit */
  heat: Uint8Array[];
  /** idle f0 value (6 bins) / hue (8 bins) histograms, each summing to 1 */
  pal: { value: number[]; hue: number[] };
  anims: Partial<Record<Anim, AnimProfile>>;
}

const POINT_ALIAS: Record<string, string> = { claw: 'hand', staff: 'prop', grip: 'prop' };
const POINT_ORDER = ['head', 'core', 'muzzle', 'hand', 'prop', 'feet'];

type Pt = { x: number; y: number };

/** Explicit points of a frame under the common vocabulary (hand ← hand | claw; prop ← staff | grip). */
function namedPoints(art: MonsterArt, anim: AnyMonsterAnim, f: number): Record<string, Pt> {
  const raw = (art.points?.(anim, f) ?? {}) as Record<string, Pt | undefined>;
  const out: Record<string, Pt> = {};
  for (const [n, p] of Object.entries(raw)) {
    if (!p) continue;
    const k = POINT_ALIAS[n] ?? n;
    if (out[k] && POINT_ALIAS[n]) continue; // the canonical name wins over an alias
    out[k] = { x: p.x, y: p.y };
  }
  return out;
}

function jointPoints(art: MonsterArt, anim: AnyMonsterAnim, f: number): Record<string, Pt> {
  const raw = art.joints?.(anim, f) ?? {};
  const out: Record<string, Pt> = {};
  for (const [n, p] of Object.entries(raw)) if (p) out[n] = { x: p.x, y: p.y };
  return out;
}

/** Displacement track of named points vs their idle-f0 places (missing in a frame → held). */
function pointTrack(frames: number[], ref: Record<string, Pt>, at: (f: number) => Record<string, Pt>, H: number, order: (names: string[]) => string[], head: string, body: string): NamedTrack | null {
  const names = order(Object.keys(ref));
  if (!names.length) return null;
  const last: Record<string, Pt> = { ...ref };
  const cache = new Map<number, Record<string, Pt>>();
  const data: number[][] = [];
  const hd: number[][] = [];
  const bd: number[][] = [];
  for (const f of frames) {
    if (!cache.has(f)) cache.set(f, at(f));
    const q = cache.get(f)!;
    const row: number[] = [];
    for (const n of names) {
      const p = q[n] ?? last[n];
      last[n] = p;
      row.push((p.x - ref[n].x) / H, (p.y - ref[n].y) / H);
    }
    data.push(row);
    const hi = names.indexOf(head);
    const bi = names.indexOf(body);
    if (hi >= 0) hd.push([row[2 * hi], row[2 * hi + 1]]);
    if (bi >= 0) bd.push([row[2 * bi], row[2 * bi + 1]]);
  }
  return { names, data, head: hd.length ? hd : null, body: bd.length ? bd : null };
}

interface Geo {
  top: [number, number];
  front: [number, number];
  back: number;
  cx: number;
  cy: number;
  n: number;
}

/** revise/mot.ts geo(): top point (mean x of the top row), front point (mean y of the front column), back x; + centroid. */
function geo(p: PixelCanvas): Geo | null {
  let top = 1e9;
  let tx = 0;
  let tn = 0;
  let front = -1;
  let fy = 0;
  let fn = 0;
  let back = 1e9;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.isOpaque(x, y)) {
        if (y < top) {
          top = y;
          tx = 0;
          tn = 0;
        }
        if (y === top) {
          tx += x;
          tn++;
        }
        if (x > front) {
          front = x;
          fy = 0;
          fn = 0;
        }
        if (x === front) {
          fy += y;
          fn++;
        }
        back = Math.min(back, x);
        sx += x;
        sy += y;
        n++;
      }
  if (!n) return null;
  return { top: [tx / tn, top], front: [front, fy / fn], back, cx: sx / n, cy: sy / n, n };
}

/** The silhouette proxy track (revise/mot.ts feat()) + head (top point) and body (centroid) tracks. */
function proxyTrack(store: FrameStore, anim: AnyMonsterAnim, frames: number[], H: number): NamedTrack {
  const art = store.art;
  const i0 = store.get('idle', 0);
  const g0 = geo(i0)!;
  const m0 = new Uint8Array(art.w * art.h);
  for (let i = 0; i < m0.length; i++) m0[i] = i0.data[i * 4 + 3] > 0 ? 1 : 0;
  const cache = new Map<number, { v: number[]; h: number[]; b: number[] }>();
  let lastGeo: Geo = g0;
  const data: number[][] = [];
  const hd: number[][] = [];
  const bd: number[][] = [];
  for (const f of frames) {
    if (!cache.has(f)) {
      const p = store.get(anim, f);
      const g = geo(p) ?? lastGeo; // an empty frame (dissolved / not yet summoned) holds the last shape
      lastGeo = g;
      let mx = 0;
      let my = 0;
      let n = 0;
      for (let y = 0; y < art.h; y++)
        for (let x = 0; x < art.w; x++) {
          const o = p.data[(y * art.w + x) * 4 + 3] > 0 ? 1 : 0;
          if (o !== m0[y * art.w + x]) {
            mx += x;
            my += y;
            n++;
          }
        }
      const mm = n ? [(mx / n - g0.cx) * (n / g0.n), (my / n - g0.cy) * (n / g0.n)] : [0, 0];
      // the back edge is 1-D: padded with a zero y so every channel is a 2-D pair (a zero channel
      // changes neither the cosine nor the DTW distances of revise/mot.ts' 7-channel track)
      const v = [g.top[0] - g0.top[0], g.top[1] - g0.top[1], g.front[0] - g0.front[0], g.front[1] - g0.front[1], g.back - g0.back, 0, mm[0] * 4, mm[1] * 4].map((q) => q / H);
      cache.set(f, { v, h: [(g.top[0] - g0.top[0]) / H, (g.top[1] - g0.top[1]) / H], b: [(g.cx - g0.cx) / H, (g.cy - g0.cy) / H] });
    }
    const c = cache.get(f)!;
    data.push(c.v);
    hd.push(c.h);
    bd.push(c.b);
  }
  return { names: ['top', 'front', 'back', 'mass'], data, head: hd, body: bd };
}

/** judge/calib.ts feat(): [centroid x, centroid y, top row, front column, back column] / H − idle f0. */
function siFeature(p: PixelCanvas, H: number, ref: number[] | null): number[] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  let top = 1e9;
  let front = -1e9;
  let back = 1e9;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.isOpaque(x, y)) {
        sx += x;
        sy += y;
        n++;
        top = Math.min(top, y);
        front = Math.max(front, x);
        back = Math.min(back, x);
      }
  if (!n) return ref ? ref.map(() => 0) : [0, 0, 0, 0, 0];
  const v = [sx / n, sy / n, top, front, back].map((q) => q / H);
  return ref ? v.map((q, i) => q - ref[i]) : v;
}

/** ms from the start of frame a to the start of frame b under `spec`. */
function msBetween(spec: AnimSpec, a: number, b: number): number {
  let t = 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let f = lo; f < hi; f++) t += frameMs(spec, f);
  return b >= a ? t : -t;
}

function totalMs(spec: AnimSpec): number {
  return msBetween(spec, 0, spec.frames);
}

/** The frame that differs most (opacity) from idle f0: the "peak" of an anim without marks. */
function peakFrame(store: FrameStore, anim: AnyMonsterAnim, frames: number): number {
  const i0 = store.get('idle', 0).data;
  let best = -1;
  let bf = 0;
  for (let f = 0; f < frames; f++) {
    const q = store.get(anim, f).data;
    let d = 0;
    for (let i = 3; i < q.length; i += 4) if (q[i] > 0 !== i0[i] > 0) d++;
    if (d > best) {
      best = d;
      bf = f;
    }
  }
  return bf;
}

/** Release frame of a swing anim: marks.release → marks.impact → (attack) attackImpactFrame → the peak. */
export function releaseFrame(e: Entity, anim: AnyMonsterAnim): number {
  const spec = animSpec(e.art, anim)!;
  const m = spec.marks;
  if (typeof m?.release === 'number') return markFrame(spec, 'release', 0);
  if (typeof m?.impact === 'number') return markFrame(spec, 'impact', 0);
  if (anim === 'attack') return markFrame(spec, 'impact', e.art.attackImpactFrame);
  return peakFrame(e.store, anim, spec.frames);
}

/** One-shot rhythm parts (ms, under the entity's timing). */
function rhythmParts(e: Entity, anim: Anim, spec: AnimSpec): number[] {
  const marks = animSpec(e.art, anim)!.marks;
  const kind = rhythmKind(anim);
  const tot = totalMs(spec);
  const mk = (name: 'charge' | 'release' | 'impact' | 'recover' | 'dissolve' | 'land', fb: number) => {
    const v = marks?.[name];
    return Math.max(0, Math.min(spec.frames - 1, typeof v === 'number' ? Math.round(v) : fb));
  };
  if (kind === 'swing') {
    const rel = releaseFrame(e, anim);
    const ch = mk('charge', Math.min(1, rel));
    const rec = mk('recover', Math.min(spec.frames - 1, rel + 1));
    return [msBetween(spec, ch, rel), msBetween(spec, rel, rec), tot];
  }
  if (kind === 'react') {
    const imp = mk('impact', 0);
    return [msBetween(spec, imp, mk('recover', Math.min(spec.frames - 1, imp + 1))), tot];
  }
  if (kind === 'death') {
    const imp = mk('impact', 0);
    return [msBetween(spec, imp, mk('dissolve', spec.frames - 1)), tot];
  }
  if (kind === 'summon') return [msBetween(spec, 0, mk('land', spec.frames - 1)), tot];
  return [tot];
}

const ANIMS_ALL: readonly Anim[] = [...ONE_SHOTS, ...LOOPS];

/** Measure one entity (all its comparable anims). */
export function profileOf(e: Entity): Profile {
  const art = e.art;
  const store = e.store;
  const i0 = store.get('idle', 0);
  const H = bodyHeight(art, i0);
  const atk = animSpec(art, 'attack')!;
  const release = markFrame(atk, 'release', markFrame(atk, 'impact', art.attackImpactFrame));
  const key = [normMask(art, i0, H), normMask(art, store.get('attack', release), H), normMask(art, store.get('hit', 0), H)];
  const heat = [changedMask(store, 'attack', H), changedMask(store, 'hit', H)];
  const sources: MotSource[] = [];
  if (art.joints) sources.push('joints');
  if (art.points) sources.push('points');
  sources.push('proxy');
  const ref = siFeature(i0, H, null);
  const jointRef = art.joints ? jointPoints(art, 'idle', 0) : null;
  const pointRef = art.points ? namedPoints(art, 'idle', 0) : null;
  const anims: Profile['anims'] = {};
  for (const anim of ANIMS_ALL) {
    const spec = e.spec(anim);
    if (!spec) continue;
    const loop = rhythmKind(anim) === 'loop';
    const frames = sampleFrames(spec, S_TRACK);
    const tracks: AnimProfile['tracks'] = {};
    if (jointRef) {
      const t = pointTrack(frames, jointRef, (f) => jointPoints(art, anim, f), H, (ns) => [...ns].sort(), 'head', 'hip');
      if (t) tracks.joints = t;
    }
    if (pointRef) {
      const t = pointTrack(frames, pointRef, (f) => namedPoints(art, anim, f), H, (ns) => POINT_ORDER.filter((n) => ns.includes(n)).concat(ns.filter((n) => !POINT_ORDER.includes(n)).sort()), 'head', 'core');
      if (t) tracks.points = t;
    }
    tracks.proxy = proxyTrack(store, anim, frames, H);
    const tot = totalMs(spec);
    const loopSig: AnimProfile['loopSig'] = {};
    if (loop)
      for (const [src, t] of Object.entries(tracks) as [MotSource, NamedTrack][]) loopSig[src] = t.head && t.body ? loopSignature(t.head, t.body, tot) : [tot, 0, 0, 0];
    let siMasks: Uint8Array[];
    let siCurve: number[];
    const feat = new Map<number, number[]>();
    const featOf = (f: number) => {
      if (!feat.has(f)) feat.set(f, siFeature(store.get(anim, f), H, ref));
      return feat.get(f)!;
    };
    if (loop) {
      const fs = sampleFrames(spec, S_LOOP);
      siMasks = fs.map((f) => normMask(art, store.get(anim, f), H));
      siCurve = fs.flatMap((f) => featOf(f));
    } else {
      siMasks = sampleFrames(spec, S_SIL).map((f) => normMask(art, store.get(anim, f), H));
      const m: number[][] = [[], [], [], [], []];
      for (const f of sampleFrames(spec, S_CURVE)) {
        const v = featOf(f);
        for (let c = 0; c < 5; c++) m[c].push(v[c]);
      }
      siCurve = m.flat();
    }
    anims[anim] = { anim, loop, totalMs: tot, rhythm: loop ? [tot] : rhythmParts(e, anim, spec), loopSig, siMasks, siCurve, tracks, frames };
  }
  return { tag: e.tag, id: e.id, plan: e.plan, control: e.control, of: e.of, sources, H, key, keyFrames: { release }, heat, pal: palHist(i0), anims };
}

/** idle f0 value (HSV V, 6 bins) and hue (8 bins, chromatic pixels only) histograms. */
function palHist(p: PixelCanvas): { value: number[]; hue: number[] } {
  const value = new Array<number>(6).fill(0);
  const hue = new Array<number>(8).fill(0);
  let nv = 0;
  let nh = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      const r = ((c >> 16) & 255) / 255;
      const g = ((c >> 8) & 255) / 255;
      const b = (c & 255) / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      value[Math.min(5, Math.floor(mx * 6))]++;
      nv++;
      if (mx > 0 && (mx - mn) / mx >= 0.2) {
        const d = mx - mn;
        let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        if (h < 0) h += 6;
        hue[Math.min(7, Math.floor((h / 6) * 8))]++;
        nh++;
      }
    }
  return { value: value.map((v) => (nv ? v / nv : 0)), hue: hue.map((v) => (nh ? v / nh : 0)) };
}

// ---------------------------------------------------------------- pairs

/** Track source of a pair: joints if both have them, else points (≥ 2 common names), else proxy. */
export function pairSource(a: Profile, b: Profile, force?: MotSource): MotSource {
  if (force) return force;
  for (const s of ['joints', 'points'] as const) {
    if (!a.sources.includes(s) || !b.sources.includes(s)) continue;
    const na = a.anims.idle?.tracks[s]?.names ?? [];
    const nb = b.anims.idle?.tracks[s]?.names ?? [];
    if (na.filter((n) => nb.includes(n)).length >= 2) return s;
  }
  return 'proxy';
}

/** The common channels of two tracks (same order on both sides). */
function common(ta: NamedTrack, tb: NamedTrack): { names: string[]; A: number[][]; B: number[][] } {
  const names = ta.names.filter((n) => tb.names.includes(n));
  const pick = (t: NamedTrack) => permutePairs(t.data, names.map((n) => t.names.indexOf(n)));
  return { names, A: pick(ta), B: pick(tb) };
}

/** MOT of one anim of a pair (near / far arm tried both ways for joint tracks; the larger kept). */
export function motOf(pa: AnimProfile, pb: AnimProfile, src: MotSource): number | null {
  const ta = pa.tracks[src];
  const tb = pb.tracks[src];
  if (!ta || !tb) return null;
  const { names, A, B } = common(ta, tb);
  if (!names.length) return null;
  const variants = [B];
  const n = names.indexOf('handN');
  const f = names.indexOf('handF');
  if (src === 'joints' && n >= 0 && f >= 0) {
    const perm = names.map((_, i) => (i === n ? f : i === f ? n : i));
    variants.push(permutePairs(B, perm));
  }
  let best = -Infinity;
  for (const v of variants) best = Math.max(best, pa.loop ? cycCos(A, v).cos : dtwCos(A, v));
  return best;
}

/** Anims both profiles have, in canonical order (one-shots, then loops). */
export function commonAnims(a: Profile, b: Profile): Anim[] {
  return ANIMS_ALL.filter((x) => a.anims[x] && b.anims[x]);
}

export interface PairOpts {
  /** force a track source (calibration: the proxy on every pair) */
  source?: MotSource;
  /** restrict the compared anims (e.g. the 5 base anims of the §9.2 proxy table) */
  anims?: readonly Anim[];
  t?: Thresholds;
}

/**
 * The anims MOTavg and SI average over: the five every art has (v1 and v3), the set their §9.2
 * calibration and §9.3 thresholds were made on. The v3 extras (hitHeavy, hitMagic, summon, death)
 * are measured and reported per anim (and as MOTavgAll) but not averaged in: three of them are
 * reactions that share their grammar by rule (REHBER HA-21…HA-24), and averaging them in made the
 * user-approved distinct slice pair fail control (g) on point tracks (MOTavg 0.479). Deviation from
 * the §9.1 wording "bütün ortak animler", per §9.2 "the definition changes, not the control".
 */
export const AVG_ANIMS: readonly Anim[] = ['attack', 'roar', 'hit', 'idle', 'guard'];

/** Measure a pair (§9.1). */
export function measurePair(a: Profile, b: Profile, o: PairOpts = {}): PairMetrics {
  const t = o.t ?? THRESHOLDS;
  const anims = commonAnims(a, b).filter((x) => !o.anims || o.anims.includes(x));
  const src = pairSource(a, b, o.source);
  const KEY = a.key.reduce((s, m, k) => s + iou(m, b.key[k]), 0) / a.key.length;
  const SIL0 = iou(a.key[0], b.key[0]);
  const HEAT = (iou(a.heat[0], b.heat[0]) + iou(a.heat[1], b.heat[1])) / 2;
  // SI: the §9.2-calibrated mean over the base one-shots; the §9.1 loop term reported apart (SIloop)
  const ones = anims.filter((x) => rhythmKind(x) !== 'loop' && AVG_ANIMS.includes(x));
  const loops = anims.filter((x) => rhythmKind(x) === 'loop');
  const SI = ones.length ? ones.reduce((s, x) => s + siOneShot(a.anims[x]!.siMasks, b.anims[x]!.siMasks, a.anims[x]!.siCurve, b.anims[x]!.siCurve), 0) / ones.length : 0;
  const SIloop = loops.length ? loops.reduce((s, x) => s + siLoop(a.anims[x]!.siMasks, b.anims[x]!.siMasks, a.anims[x]!.siCurve, b.anims[x]!.siCurve), 0) / loops.length : 0;
  const PAL = (a.pal.value.reduce((s, v, i) => s + Math.abs(v - b.pal.value[i]), 0) + a.pal.hue.reduce((s, v, i) => s + Math.abs(v - b.pal.hue[i]), 0)) / 2;
  const mot: PairMetrics['mot'] = {};
  for (const x of anims) {
    const v = motOf(a.anims[x]!, b.anims[x]!, src);
    if (v !== null) mot[x] = v;
  }
  const vals = (xs: readonly Anim[]) => xs.map((x) => mot[x]).filter((v): v is number => v !== undefined);
  const sig = vals(SIG_ANIMS.filter((x) => anims.includes(x)));
  const lp = vals(LOOPS.filter((x) => anims.includes(x)));
  const avg = vals(AVG_ANIMS.filter((x) => anims.includes(x)));
  const all = vals(anims);
  const rhythm: PairMetrics['rhythm'] = {};
  for (const x of anims) {
    const pa = a.anims[x]!;
    const pb = b.anims[x]!;
    const ra = pa.loop ? pa.loopSig[src] ?? pa.loopSig.proxy! : pa.rhythm;
    const rb = pb.loop ? pb.loopSig[src] ?? pb.loopSig.proxy! : pb.rhythm;
    rhythm[x] = { a: ra, b: rb, same: sameRhythm(ra, rb, t.RHYTHM) };
  }
  return {
    KEY,
    SIL0,
    SI,
    SIloop,
    HEAT,
    PAL,
    source: src,
    mot,
    MOTsig: sig.length ? Math.max(...sig) : 0,
    MOTloop: lp.length ? Math.max(...lp) : 0,
    MOTavg: avg.length ? avg.reduce((s, v) => s + v, 0) / avg.length : 0,
    MOTavgAll: all.length ? all.reduce((s, v) => s + v, 0) / all.length : 0,
    rhythm,
  };
}

/** Only the KEY silhouettes of an entity (cheap: for the pair's own v1 KEY, the A4 target). */
export function keyMasks(e: Entity): Uint8Array[] {
  const art = e.art;
  const i0 = e.store.get('idle', 0);
  const H = bodyHeight(art, i0);
  const atk = animSpec(art, 'attack')!;
  const release = markFrame(atk, 'release', markFrame(atk, 'impact', art.attackImpactFrame));
  return [normMask(art, i0, H), normMask(art, e.store.get('attack', release), H), normMask(art, e.store.get('hit', 0), H)];
}
