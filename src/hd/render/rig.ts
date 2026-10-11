// HD render — rigging: a 2D bone skeleton in pseudo-3D (every bone carries a depth), 2-bone IK,
// secondary motion (lagging chains for loops, deterministic spring chains for one-shots) and
// keyframed poses with per-key easing.
//
// The whole point: every frame of every animation is solved from the SAME skeleton, so
// proportions never drift, and in-betweens / follow-through are computed instead of drawn.
//
//   const sk = new Skeleton([
//     { name: 'spine', length: 30, angle: -60 },                 // root bone (absolute angle)
//     { name: 'neck', parent: 'spine', length: 22, angle: -30 }, // relative to its parent
//     { name: 'head', parent: 'neck', length: 16, angle: 40 },
//   ]);
//   const rig = sk.solve({ x: 90, y: 120 }, { neck: -10 * breath });   // angle deltas (deg)
//   rig.end('head'); rig.at('spine', 0.5, 4); rig.joints(['spine', 'neck', 'head']);

import {
  type EaseFn,
  type EaseName,
  type V2,
  DEG,
  add,
  angleDiffDeg,
  clamp,
  dist,
  easeFn,
  lerp,
  madd,
  mod,
  norm,
  perp,
  polar,
  sub,
} from './math';

// ------------------------------------------------------------------ skeleton

export interface BoneDef {
  name: string;
  /** Parent bone name (omit for a root bone). */
  parent?: string;
  /** Length in px. */
  length: number;
  /** Rest angle in degrees, relative to the parent's direction (absolute for root bones; 0 = right, 90 = down). */
  angle: number;
  /** Where along the parent it attaches: 0 = parent start, 1 = parent end (default 1). */
  at?: number;
  /** Extra attach offset in the parent's frame: x along the parent, y to its clockwise side. */
  offset?: V2;
  /** Depth relative to the parent (px toward the viewer). */
  z?: number;
}

export interface Bone {
  name: string;
  start: V2;
  end: V2;
  /** World angle in degrees. */
  angle: number;
  /** Unit direction start → end. */
  dir: V2;
  len: number;
  /** Accumulated depth (toward the viewer). */
  z: number;
}

export interface SolveOptions {
  /** Length multipliers per bone (squash & stretch). */
  scale?: Record<string, number>;
  /** Absolute WORLD angles (deg) that replace a bone's solved angle (e.g. from IK). */
  world?: Record<string, number>;
}

/** A solved pose: bone positions in sprite pixels. */
export class Rig {
  constructor(readonly bones: Readonly<Record<string, Bone>>) {}

  get(name: string): Bone {
    const b = this.bones[name];
    if (!b) throw new Error(`rig: no bone "${name}"`);
    return b;
  }

  start(name: string): V2 {
    return this.get(name).start;
  }

  end(name: string): V2 {
    return this.get(name).end;
  }

  /** Point at fraction t along a bone, pushed `side` px to its clockwise side (− = counter-clockwise). */
  at(name: string, t: number, side = 0): V2 {
    const b = this.get(name);
    return madd(madd(b.start, b.dir, b.len * t), perp(b.dir), side);
  }

  /** Point in a bone's local frame (x along the bone from its start, y to its clockwise side). */
  local(name: string, p: V2): V2 {
    const b = this.get(name);
    return madd(madd(b.start, b.dir, p[0]), perp(b.dir), p[1]);
  }

  /** Joint positions along a chain of bones: start of the first, then every end. */
  joints(names: readonly string[]): V2[] {
    const out: V2[] = [this.get(names[0]).start];
    for (const n of names) out.push(this.get(n).end);
    return out;
  }

  /** Depth of a bone (for ordering parts or passing to primitives). */
  z(name: string): number {
    return this.get(name).z;
  }
}

export class Skeleton {
  readonly defs: readonly BoneDef[];
  private readonly byName = new Map<string, BoneDef>();

  constructor(defs: readonly BoneDef[]) {
    // order parents before children
    const sorted: BoneDef[] = [];
    const seen = new Set<string>();
    const visit = (d: BoneDef, depth = 0) => {
      if (seen.has(d.name)) return;
      if (depth > 64) throw new Error('skeleton: cycle at ' + d.name);
      if (d.parent) {
        const p = defs.find((q) => q.name === d.parent);
        if (!p) throw new Error(`skeleton: bone "${d.name}" has unknown parent "${d.parent}"`);
        visit(p, depth + 1);
      }
      seen.add(d.name);
      sorted.push(d);
    };
    for (const d of defs) visit(d);
    this.defs = sorted;
    for (const d of sorted) this.byName.set(d.name, d);
  }

  def(name: string): BoneDef | undefined {
    return this.byName.get(name);
  }

  /**
   * Forward kinematics. `pose` holds angle DELTAS in degrees added to each bone's rest angle;
   * the root transform positions / rotates / lifts every root bone.
   */
  solve(root: { x: number; y: number; angle?: number; z?: number }, pose: Readonly<Record<string, number>> = {}, o: SolveOptions = {}): Rig {
    const out: Record<string, Bone> = {};
    for (const d of this.defs) {
      const sc = o.scale?.[d.name] ?? 1;
      const L = d.length * sc;
      let start: V2;
      let ang: number;
      let z: number;
      if (d.parent) {
        const p = out[d.parent];
        const at = d.at ?? 1;
        start = madd(p.start, p.dir, p.len * at);
        if (d.offset) start = madd(madd(start, p.dir, d.offset[0]), perp(p.dir), d.offset[1]);
        ang = p.angle + d.angle + (pose[d.name] ?? 0);
        z = p.z + (d.z ?? 0);
      } else {
        start = [root.x + (d.offset?.[0] ?? 0), root.y + (d.offset?.[1] ?? 0)];
        ang = d.angle + (root.angle ?? 0) + (pose[d.name] ?? 0);
        z = (root.z ?? 0) + (d.z ?? 0);
      }
      if (o.world && o.world[d.name] !== undefined) ang = o.world[d.name];
      const dir = polar(ang, 1);
      out[d.name] = { name: d.name, start, end: madd(start, dir, L), angle: ang, dir, len: L, z };
    }
    return new Rig(out);
  }
}

// ------------------------------------------------------------------ IK

export interface IK2Result {
  /** Middle joint (knee / elbow). */
  joint: V2;
  /** End effector (reaches the target when possible). */
  end: V2;
  /** Whether the target was within reach. */
  reached: boolean;
  /** World angles (deg) of the two bones — feed them to Skeleton.solve({ world }). */
  a1: number;
  a2: number;
}

/**
 * Two-bone IK (law of cosines). `bend` picks the knee side: +1 = the joint sits on the
 * screen-clockwise side of the root→target line (for a leg pointing down, that is the LEFT side
 * on screen, i.e. a knee bending backward for a creature facing right), −1 the other side.
 */
export function ik2(root: V2, target: V2, l1: number, l2: number, bend: 1 | -1 = 1): IK2Result {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d0 = Math.hypot(dx, dy);
  const reached = d0 <= l1 + l2 - 1e-3 && d0 >= Math.abs(l1 - l2);
  const d = clamp(d0, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const base = Math.atan2(dy, dx);
  const a1 = base + bend * Math.acos(c);
  const joint: V2 = [root[0] + Math.cos(a1) * l1, root[1] + Math.sin(a1) * l1];
  const toT = norm(sub(target, joint));
  const end: V2 = reached ? target : madd(joint, toT, l2);
  return { joint, end, reached, a1: a1 / DEG, a2: Math.atan2(toT[1], toT[0]) / DEG };
}

// ------------------------------------------------------------------ secondary motion

export interface LagChainOpts {
  /** Root joint. */
  root: V2;
  /** Number of segments. */
  count: number;
  /** Segment length(s) in px. */
  seg: number | readonly number[];
  /**
   * Rest direction per segment in degrees. With `accumulate` these are RELATIVE bends added to
   * the previous segment (curl); otherwise absolute world angles.
   */
  rest: number | readonly number[] | ((i: number) => number);
  /** Root direction (deg) — only used with `accumulate` (the chain hangs off this direction). */
  rootAngle?: number;
  /** Driver: angle offset (deg) as a function of loop phase t. */
  drive: (t: number) => number;
  /** Current loop phase (0..1). */
  t: number;
  /** Phase lag per segment (loop fractions): segment i sees drive(t − i·lag). */
  lag: number;
  /** Amplitude multiplier per segment (default ramps 0.35 → 1 toward the tip). */
  amp?: (i: number, n: number) => number;
  /** Bends accumulate down the chain (whip / curl). Default true. */
  accumulate?: boolean;
}

/**
 * Secondary motion for LOOPS (tails, manes, wing fingers, capes): segment i follows the driver
 * with a phase delay, so a wave travels from the root to the tip and the loop stays seamless.
 * Returns count + 1 joint positions.
 */
export function lagChain(o: LagChainOpts): V2[] {
  const n = o.count;
  const acc = o.accumulate ?? true;
  const amp = o.amp ?? ((i: number, m: number) => 0.35 + (0.65 * i) / Math.max(1, m - 1));
  const segL = (i: number) => (typeof o.seg === 'number' ? o.seg : o.seg[Math.min(i, o.seg.length - 1)]);
  const rest = (i: number) => (typeof o.rest === 'number' ? o.rest : typeof o.rest === 'function' ? o.rest(i) : o.rest[Math.min(i, o.rest.length - 1)]);
  const pts: V2[] = [o.root];
  let ang = o.rootAngle ?? 0;
  for (let i = 0; i < n; i++) {
    const off = o.drive(o.t - i * o.lag) * amp(i, n);
    ang = acc ? ang + rest(i) + off : rest(i) + off;
    pts.push(add(pts[i], polar(ang, segL(i))));
  }
  return pts;
}

export interface SpringChainOpts {
  /** Root position and root direction (deg) as functions of time in seconds. */
  anchor: (t: number) => { p: V2; angle: number };
  count: number;
  seg: number | readonly number[];
  /** Rest bend per joint relative to the previous segment (deg). */
  rest?: number | readonly number[];
  /** 0..1 how strongly each joint returns to its rest bend per step (default 0.18). */
  stiffness?: number;
  /** 0..1 velocity loss per step (default 0.12). */
  damping?: number;
  /** px/s² (default [0, 0]; try [0, 60] for heavy tails). */
  gravity?: V2;
  /** Evaluate at this time (s). The chain starts settled in its rest shape at `tStart` (default 0). */
  t: number;
  tStart?: number;
  /** Simulation step (s), default 1/60. */
  dt?: number;
}

/**
 * Secondary motion for ONE-SHOTS (attack whips, hit recoils, cape follow-through): a Verlet
 * chain with angular springs, simulated deterministically from tStart to t every call — the
 * same frame always gives the same shape. Cheap (count × steps). Returns count + 1 joints.
 */
export function springChain(o: SpringChainOpts): V2[] {
  const n = o.count;
  const segL = (i: number) => (typeof o.seg === 'number' ? o.seg : o.seg[Math.min(i, o.seg.length - 1)]);
  const rest = (i: number) => (o.rest === undefined ? 0 : typeof o.rest === 'number' ? o.rest : o.rest[Math.min(i, o.rest.length - 1)]);
  const k = o.stiffness ?? 0.18;
  const damp = o.damping ?? 0.12;
  const grav = o.gravity ?? [0, 0];
  const dt = o.dt ?? 1 / 60;
  const t0 = o.tStart ?? 0;
  const shape = (a: { p: V2; angle: number }): V2[] => {
    const pts: V2[] = [a.p];
    let ang = a.angle;
    for (let i = 0; i < n; i++) {
      ang += rest(i);
      pts.push(add(pts[i], polar(ang, segL(i))));
    }
    return pts;
  };
  let cur = shape(o.anchor(t0)).map((p) => [p[0], p[1]] as [number, number]);
  let prev = cur.map((p) => [p[0], p[1]] as [number, number]);
  const steps = Math.max(0, Math.round((o.t - t0) / dt));
  for (let s = 1; s <= steps; s++) {
    const tt = t0 + s * dt;
    const a = o.anchor(tt);
    // integrate
    for (let i = 1; i <= n; i++) {
      const p = cur[i];
      const q = prev[i];
      const vx = (p[0] - q[0]) * (1 - damp);
      const vy = (p[1] - q[1]) * (1 - damp);
      prev[i] = [p[0], p[1]];
      cur[i] = [p[0] + vx + grav[0] * dt * dt, p[1] + vy + grav[1] * dt * dt];
    }
    prev[0] = cur[0];
    cur[0] = [a.p[0], a.p[1]];
    // constraints: angular spring toward the rest bend, then exact segment lengths
    for (let it = 0; it < 3; it++) {
      let ang = a.angle;
      for (let i = 1; i <= n; i++) {
        const base = cur[i - 1];
        const target = add(base, polar(ang + rest(i - 1), segL(i - 1)));
        cur[i] = [lerp(cur[i][0], target[0], k), lerp(cur[i][1], target[1], k)];
        const d = sub(cur[i], base);
        const L = Math.hypot(d[0], d[1]) || 1e-6;
        const want = segL(i - 1);
        cur[i] = [base[0] + (d[0] / L) * want, base[1] + (d[1] / L) * want];
        ang = Math.atan2(d[1], d[0]) / DEG;
      }
    }
  }
  return cur.map((p) => [p[0], p[1]] as V2);
}

// ------------------------------------------------------------------ poses & keyframes

/** A pose is a flat record of numbers (angles in degrees, offsets in px, 0..1 controls). */
export type Pose = Record<string, number>;

/** Per-channel linear blend of two poses (angles are blended linearly — keep them unwrapped). */
export function lerpPose<T extends Pose>(a: T, b: T, t: number): T {
  const out = { ...a } as Record<string, number>;
  for (const k in b) out[k] = lerp(a[k] ?? b[k], b[k], t);
  return out as T;
}

/** Blend angles along the shortest arc (for channels that may wrap past ±180). */
export function lerpAnglePose<T extends Pose>(a: T, b: T, t: number, keys: readonly (keyof T)[]): T {
  const out = lerpPose(a, b, t) as Record<string, number>;
  for (const k of keys) out[k as string] = a[k] + angleDiffDeg(a[k], b[k]) * t;
  return out as T;
}

export interface Key<T extends Pose> {
  /** Frame number (may be fractional). */
  f: number;
  /** Channels set at this key; missing channels take the rest pose. */
  pose: Partial<T>;
  /** Easing used to arrive at this key from the previous one (default inOutQuad). */
  ease?: EaseName | EaseFn;
}

/**
 * Pose at frame `f` (fractional allowed) from keyframes over a rest pose. Between two keys
 * each channel eases with the arriving key's curve. With `loop` (period in frames) the last
 * key blends back into the first, so cycles are seamless.
 */
export function poseAt<T extends Pose>(rest: T, keys: readonly Key<T>[], f: number, loop?: number): T {
  const full = (k: Key<T>) => ({ ...rest, ...k.pose }) as T;
  const n = keys.length;
  if (!n) return { ...rest };
  if (n === 1) return full(keys[0]);
  let a: Key<T>;
  let b: Key<T>;
  let fa: number;
  let fb: number;
  if (loop) {
    f = mod(f, loop);
    let i = -1;
    for (let j = 0; j < n; j++) if (keys[j].f <= f) i = j;
    if (i === -1) {
      a = keys[n - 1];
      fa = a.f - loop;
      b = keys[0];
      fb = b.f;
    } else if (i === n - 1) {
      a = keys[n - 1];
      fa = a.f;
      b = keys[0];
      fb = b.f + loop;
    } else {
      a = keys[i];
      b = keys[i + 1];
      fa = a.f;
      fb = b.f;
    }
  } else {
    if (f <= keys[0].f) return full(keys[0]);
    if (f >= keys[n - 1].f) return full(keys[n - 1]);
    let i = 0;
    while (i < n - 2 && keys[i + 1].f <= f) i++;
    a = keys[i];
    b = keys[i + 1];
    fa = a.f;
    fb = b.f;
  }
  const t = clamp((f - fa) / (fb - fa || 1), 0, 1);
  return lerpPose(full(a), full(b), easeFn(b.ease)(t));
}

/** Seamless loop helpers for idle cycles: phase of frame f in an n-frame loop, delayed by `lag` frames. */
export const loopPhase = (f: number, n: number, lag = 0): number => mod(f - lag, n) / n;

/**
 * Overlapping action helper: the same channel curve sampled `lag` frames late — feed child
 * channels (forearm, fingers, ear tips) the parent's curve with growing lag for follow-through.
 */
export function lagged<T>(curve: (f: number) => T, f: number, lag: number): T {
  return curve(f - lag);
}

/** Distance helper re-exported for IK reach checks. */
export const reach = dist;
