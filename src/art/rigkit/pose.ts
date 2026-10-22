// rigkit / pose — the pose algebra of hand-keyed animation (A3_MIMARI §3.2; REHBER HA-6, HA-7,
// HA-21, HA-22).
//
// A pose is a plain object of numbers, number tuples, nested objects and discrete fields (flags,
// names). The choreography is the monster's: it writes key poses by hand. This module only does
// the arithmetic between them, the way the slice does it (crystal_wyrm-anims.ts over / mix /
// recoil / fromIdle, crystal_wyrm-rig.ts lerpPose, abyss_magus-anims.ts key() phases):
//   lerp   numbers, tuples and nested objects in between; discrete fields come from b (exact a at
//          t ≤ 0 and exact b at t ≥ 1: identity at the ends);
//   over   a delta over a pose (nested objects merged, tuples replaced) — fromIdle = over(idle0, d);
//   mix    lerp with a per-group lag: the fields of a lagging group (wings, cloth, tail…) are at
//          t − lag, the body at t (the wyrm's "body at t, wings at wt");
//   recoil HA-22: f0 the struck key, f1 the in-between of the compressed key and the reel (body at
//          0.5, the carried groups 0.15 behind), then the reel keys;
//   phase  HA-7: a one-shot's cloth / tail phase runs one cycle and wraps to 0 on the last frame.
// Regions (RegionId) name the fields a blow moves on the struck contact frame (HA-21).

/**
 * Body regions (A3_MIMARI §3.3). Defined in the core because the compiler's struck filter needs
 * them before any body plan exists; src/art/bodyplans/types.ts re-exports this type.
 */
export type RegionId = 'head' | 'chest' | 'armN' | 'armF' | 'hips' | 'lower' | 'tail' | 'wingN' | 'wingF' | 'propN' | 'propF' | 'extra';
export const REGION_IDS: readonly RegionId[] = Object.freeze(['head', 'chest', 'armN', 'armF', 'hips', 'lower', 'tail', 'wingN', 'wingF', 'propN', 'propF', 'extra']);

/**
 * A delta over a pose: every field optional, nested plain objects partial too (they are merged, as
 * the wyrm's PoseDelta merges its wings); tuples and other values are replaced whole. A Partial<P>
 * is a PoseDelta<P>.
 */
export type PoseDelta<P> = { [K in keyof P]?: P[K] extends readonly unknown[] ? P[K] : P[K] extends (...a: never[]) => unknown ? P[K] : P[K] extends object ? PoseDelta<P[K]> : P[K] };

/** HA-22: how far the carried groups trail the body on a recoil's in-between (0.5 → 0.35). */
export const RECOIL_LAG = 0.15;

export interface PoseKit<P> {
  readonly neutral: P;
  /** lag groups for mix(): group name → its fields */
  readonly groups: Readonly<Record<string, readonly (keyof P)[]>>;
  /** the struck-frame filter: region → its fields */
  readonly regions: Readonly<Partial<Record<RegionId, readonly (keyof P)[]>>>;
  /** neutral with a delta over it */
  pose(d: PoseDelta<P>): P;
  /** in-between; numbers, tuples, nested; discrete fields from b; exact a at t ≤ 0, b at t ≥ 1 */
  lerp(a: P, b: P, t: number): P;
  /** a delta over a pose (nested objects merged, tuples and other values replaced) */
  over(base: P, d: PoseDelta<P>): P;
  /** lerp with a per-group lag (group name → lag in t units; + trails, − leads) */
  mix(a: P, b: P, t: number, lag?: Partial<Record<string, number>>): P;
  /** HA-22: [struck, in-between of keys[0] and keys[1], ...keys.slice(1)] */
  recoil(struck: P, keys: readonly P[], mid?: number): P[];
  /** the fields of these regions */
  regionFields(regions: readonly RegionId[]): ReadonlySet<keyof P>;
  /** `base` with only `fields` taken from p (HA-21: the struck frame moves its region only) */
  only(p: P, base: P, fields: ReadonlySet<keyof P>): P;
  /** deep equality (numbers exact) */
  equal(a: P, b: P): boolean;
}

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep copy of a pose value (arrays and plain objects; everything else as is). */
export function clonePose<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clonePose) as T;
  if (isPlain(v)) {
    const out: Plain = {};
    for (const k of Object.keys(v)) out[k] = clonePose(v[k]);
    return out as T;
  }
  return v;
}

/** Deep equality of two pose values (numbers by ===; -0 equals 0). */
export function poseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => poseEqual(x, b[i]));
  if (isPlain(a) && isPlain(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => poseEqual(a[k], b[k]));
  }
  return false;
}

function lerpValue(a: unknown, b: unknown, t: number): unknown {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((x, i) => lerpValue(x, b[i], t));
  if (isPlain(a) && isPlain(b)) {
    const out: Plain = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = lerpAt(a[k], b[k], t);
    return out;
  }
  // discrete (flags, names, mismatched shapes): from b while it is defined
  return clonePose(b !== undefined ? b : a);
}
/** lerpValue with exact ends (and a missing side taken from the other). */
function lerpAt(a: unknown, b: unknown, t: number): unknown {
  if (a === undefined) return clonePose(b);
  if (b === undefined) return clonePose(a);
  if (t <= 0) return clonePose(a);
  if (t >= 1) return clonePose(b);
  return lerpValue(a, b, t);
}

function overValue(base: unknown, d: unknown): unknown {
  if (isPlain(base) && isPlain(d)) {
    const out = clonePose(base) as Plain;
    for (const k of Object.keys(d)) if (d[k] !== undefined) out[k] = overValue(base[k], d[k]);
    return out;
  }
  return clonePose(d);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** In-between where every top-level field has its own t (exact ends per field, as lerp). */
export function lerpBy<P extends object>(a: P, b: P, tOf: (field: keyof P) => number): P {
  const A = a as unknown as Plain;
  const B = b as unknown as Plain;
  const out: Plain = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) out[k] = lerpAt(A[k], B[k], tOf(k as keyof P));
  return out as P;
}

/** The cloth / tail phase of frame f of an n-frame one-shot: one cycle, 0 again on the last frame (HA-7). */
export function phase(f: number, n: number): number {
  return n <= 1 ? 0 : (f / (n - 1)) % 1;
}

/**
 * Build the pose algebra of a pose type. `groups` (lag groups) and `regions` (struck filter) name
 * top-level fields of `neutral`; a field belongs to at most one group.
 */
export function definePose<P extends object>(neutral: P, groups: Record<string, readonly (keyof P)[]>, regions: Partial<Record<RegionId, readonly (keyof P)[]>>): PoseKit<P> {
  const N = neutral as unknown as Plain;
  const groupOf = new Map<string, string>();
  for (const [g, fields] of Object.entries(groups))
    for (const f of fields) {
      const k = String(f);
      if (!(k in N)) throw new Error(`rigkit: group ${g}: ${k} is not a pose field`);
      if (groupOf.has(k)) throw new Error(`rigkit: pose field ${k} is in groups ${groupOf.get(k)} and ${g}`);
      groupOf.set(k, g);
    }
  for (const [r, fields] of Object.entries(regions) as [string, readonly (keyof P)[]][])
    for (const f of fields) if (!(String(f) in N)) throw new Error(`rigkit: region ${r}: ${String(f)} is not a pose field`);
  const frozenGroups = Object.freeze({ ...groups });
  const frozenRegions = Object.freeze({ ...regions });

  const kit: PoseKit<P> = {
    neutral,
    groups: frozenGroups,
    regions: frozenRegions,
    pose: (d) => overValue(N, d) as P,
    over: (base, d) => overValue(base, d) as P,
    lerp: (a, b, t) => lerpAt(a, b, t) as P,
    mix(a, b, t, lag) {
      const A = a as unknown as Plain;
      const B = b as unknown as Plain;
      const out: Plain = {};
      for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
        const g = groupOf.get(k);
        const l = g !== undefined ? lag?.[g] : undefined;
        out[k] = lerpAt(A[k], B[k], l === undefined ? t : clamp01(t - l));
      }
      return out as P;
    },
    recoil(struck, keys, mid = 0.5) {
      if (keys.length < 2) return [clonePose(struck), ...keys.map(clonePose)];
      const lag: Record<string, number> = {};
      for (const g of Object.keys(groups)) lag[g] = RECOIL_LAG;
      return [clonePose(struck), kit.mix(keys[0], keys[1], mid, lag), ...keys.slice(1).map(clonePose)];
    },
    regionFields(rs) {
      const s = new Set<keyof P>();
      for (const r of rs) for (const f of regions[r] ?? []) s.add(f);
      return s;
    },
    only(p, base, fields) {
      const out = clonePose(base) as unknown as Plain;
      const src = p as unknown as Plain;
      for (const f of fields) out[String(f)] = clonePose(src[String(f)]);
      return out as P;
    },
    equal: (a, b) => poseEqual(a, b),
  };
  return Object.freeze(kit);
}
