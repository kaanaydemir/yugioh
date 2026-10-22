// rigkit / anim — the anim compiler (A3_MIMARI §3.2; REHBER §4.1–§4.3, HA-6, HA-7, HA-12, HA-14,
// HA-21, HA-29).
//
// The choreography is the monster's: hand-keyed beats with hand-set holds. The compiler only
// enforces the grammar the slice follows:
//   - named beats → marks (charge → charge; release → release + impact; contact → contact;
//     recover → recover; land → land; dissolve → dissolve; struck → impact + contact, frame 0 of a
//     reaction); a mark comes from one beat only;
//   - one-shots start from their base (idle f0 / guard f0 / a pose: every key is a delta over it)
//     and END on the exact end pose, which the compiler appends (out = 0, HA-14);
//   - the struck contact frame moves only the struck regions' fields (HA-21);
//   - follow / lag (HA-6): a follower is carried by its leader `lag` frames late (see follow);
//   - phases (HA-7): the listed fields run one cycle over the anim and wrap on the last frame;
//   - a smear (HA-12) only on the release beat; holds are positive whole ms (their values are
//     validateArt's business: HA-2…HA-5).
// toMonsterArt() turns the compiled tables into a plain MonsterArt (the registry, textures, kits and
// tools see no difference).

import type { MonsterId } from '../../data/cards';
import type { PixelCanvas } from '../pixel';
import { MONSTER_ANIMS, MONSTER_ANIMS_EXTRA, type AnimMark, type AnimSpec, type AnyMonsterAnim, type MonsterAnim, type MonsterAnimExtra, type MonsterArt, type MonsterPoints, type WeightClass } from '../types';
import { lightOf, type Light } from './light';
import { clonePose, lerpBy, type PoseDelta, type PoseKit, type RegionId } from './pose';

export type BeatName = 'charge' | 'coil' | 'swing' | 'release' | 'contact' | 'follow' | 'recover' | 'settle' | 'land' | 'dissolve' | 'struck' | 'peak';

/** The marks a named beat sets on its frame. */
export const BEAT_MARKS: Readonly<Record<BeatName, readonly AnimMark[]>> = Object.freeze({
  charge: ['charge'],
  coil: [],
  swing: [],
  release: ['release', 'impact'],
  contact: ['contact'],
  follow: [],
  recover: ['recover'],
  settle: [],
  land: ['land'],
  dissolve: ['dissolve'],
  struck: ['impact', 'contact'],
  peak: [],
});

export interface Beat<P> {
  /** marks come from names (BEAT_MARKS) */
  name?: BeatName;
  /** hand-keyed: a delta over the anim's base (nested objects partial: PoseDelta), or a function of the base */
  key: PoseDelta<P> | ((base: P) => P);
  /** hand-set hold (ms; validated against HA-2…HA-5 by validateArt) */
  ms: number;
  /** HA-12: the release frame only; the frame carries smearFrom = the previous frame's pose */
  smear?: boolean;
}

export interface FollowRule<P> {
  /** the follower: a number or number-tuple field */
  field: keyof P;
  /** its leader */
  of: keyof P;
  /** frames late (HA-6: 1–3) */
  lag: 1 | 2 | 3;
}

export interface AnimDef<P> {
  base: 'idle0' | 'guard0' | P;
  beats: readonly Beat<P>[];
  /** the compiler appends the exact end pose → out = 0 (HA-14); 'hold' ends on the last beat */
  end: 'idle0' | 'guard0' | 'hold';
  /** hold of the appended end frame (default: the last beat's) */
  endMs?: number;
  /**
   * Overlap (HA-6). The follower is carried by its leader `lag` frames late:
   * field(f) = keyed field(f) + leader(f − lag) − leader(f), the leader before frame 0 being the
   * base's. A follower stored relative to its leader (head offset on the body, hem on the hip) thus
   * keeps its pixels where the leader left them for `lag` frames. Rules apply in order (a follower
   * may lead the next rule); never on the struck frame 0 (it moves its region only) nor on the
   * appended end pose.
   */
  follow?: readonly FollowRule<P>[];
  /** HA-21: beat 0 (the struck beat) keeps ONLY these regions' fields; the rest stay the base's */
  struck?: { regions: readonly RegionId[] };
  /** escape hatch L2: patch one compiled frame (index into the final frames, end frame included) */
  frames?: Record<number, (p: P) => P>;
  /** (additive to §3.2) HA-7 phases: these number fields run base + one cycle (0 → 1) and wrap */
  phase?: readonly (keyof P)[];
  /** (additive) AnimSpec.fps fallback (default 10) */
  fps?: number;
}

export interface LoopDef<P> {
  n: number;
  /** frame f as a delta over the kit's neutral pose */
  at(f: number): PoseDelta<P>;
  holds: readonly number[];
  /** (additive) AnimSpec.fps fallback (default 10) */
  fps?: number;
}

export type AnimDefs<P> = { idle: LoopDef<P>; guard: LoopDef<P>; attack: AnimDef<P>; roar: AnimDef<P>; hit: AnimDef<P> } & Partial<Record<MonsterAnimExtra, AnimDef<P>>>;

export interface CompiledAnim<P> {
  readonly anim: AnyMonsterAnim;
  readonly poses: readonly P[];
  readonly spec: AnimSpec;
  /** per frame: the pose the smear stretches from (release frames with smear), else undefined */
  readonly smearFrom: readonly (P | undefined)[];
}

export interface CompiledAnims<P> {
  readonly idle0: P;
  readonly guard0: P;
  readonly anims: Readonly<Partial<Record<AnyMonsterAnim, CompiledAnim<P>>>>;
  /** the pose of a frame (frame clamped into the anim); throws for an anim the monster lacks */
  pose(anim: AnyMonsterAnim, frame: number): P;
}

/** A grammar error of an anim table (thrown by compileAnims). */
export class AnimGrammarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnimGrammarError';
  }
}

type Plain = Record<string, unknown>;

function addDelta(v: unknown, a: unknown, b: unknown, what: string): unknown {
  if (typeof v === 'number' && typeof a === 'number' && typeof b === 'number') return v + (a - b);
  if (Array.isArray(v) && Array.isArray(a) && Array.isArray(b) && v.length === a.length && a.length === b.length) return v.map((x, i) => addDelta(x, a[i], b[i], what));
  throw new AnimGrammarError(`${what}: follow needs number or number-tuple fields`);
}

function checkHold(ms: number, what: string): void {
  if (!Number.isInteger(ms) || ms <= 0) throw new AnimGrammarError(`${what}: hold ${ms} ms is not a positive whole number`);
}

function compileLoop<P>(kit: PoseKit<P>, anim: 'idle' | 'guard', def: LoopDef<P>): CompiledAnim<P> {
  if (!Number.isInteger(def.n) || def.n < 1) throw new AnimGrammarError(`${anim}: ${def.n} frames`);
  if (def.holds.length !== def.n) throw new AnimGrammarError(`${anim}: ${def.holds.length} holds for ${def.n} frames`);
  def.holds.forEach((ms, f) => checkHold(ms, `${anim} f${f}`));
  const poses = Array.from({ length: def.n }, (_, f) => kit.pose(def.at(f)));
  return Object.freeze({ anim, poses: Object.freeze(poses), spec: { frames: def.n, fps: def.fps ?? 10, loop: true, holds: [...def.holds] }, smearFrom: Object.freeze(poses.map(() => undefined)) });
}

function compileOne<P>(kit: PoseKit<P>, anim: AnyMonsterAnim, def: AnimDef<P>, idle0: P, guard0: P): CompiledAnim<P> {
  const fail = (m: string): never => {
    throw new AnimGrammarError(`${anim}: ${m}`);
  };
  if (!def.beats.length) fail('no beats');
  const base = def.base === 'idle0' ? idle0 : def.base === 'guard0' ? guard0 : def.base;
  const names = def.beats.map((b, i) => b.name ?? (i === 0 && def.struck ? ('struck' as const) : undefined));

  // ---- grammar
  def.beats.forEach((b, i) => {
    checkHold(b.ms, `${anim} beat ${i}`);
    if (b.smear && names[i] !== 'release') fail(`beat ${i}: a smear only on the release beat (HA-12)`);
    if (names[i] === 'struck' && i !== 0) fail(`beat ${i}: 'struck' is frame 0 of a reaction`);
  });
  if (def.struck && names[0] !== 'struck') fail(`struck regions need beat 0 to be the struck beat (it is '${names[0]}')`);
  if (def.endMs !== undefined) checkHold(def.endMs, `${anim} end`);
  const marks: Partial<Record<AnimMark, number>> = {};
  names.forEach((n, i) => {
    if (!n) return;
    for (const m of BEAT_MARKS[n]) {
      if (marks[m] !== undefined) fail(`mark '${m}' from beats ${marks[m]} and ${i}`);
      marks[m] = i;
    }
  });

  // ---- poses: hand keys over the base; the struck frame keeps its regions only
  const poses: P[] = def.beats.map((b) => (typeof b.key === 'function' ? b.key(clonePose(base)) : kit.over(base, b.key)));
  if (def.struck) poses[0] = kit.only(poses[0], base, kit.regionFields(def.struck.regions));
  const appended = def.end !== 'hold';
  const n = poses.length + (appended ? 1 : 0);

  // ---- HA-7 phases: one cycle over the anim, back to the base value on the last frame
  for (const field of def.phase ?? []) {
    const b0 = (base as Plain)[String(field)];
    if (typeof b0 !== 'number') fail(`phase field ${String(field)} is not a number`);
    poses.forEach((p, f) => ((p as Plain)[String(field)] = ((((b0 as number) + (n <= 1 ? 0 : f / (n - 1))) % 1) + 1) % 1));
  }

  // ---- HA-6 follow: the follower is carried by its leader `lag` frames late
  for (const r of def.follow ?? []) {
    if (![1, 2, 3].includes(r.lag)) fail(`follow ${String(r.field)}: lag ${r.lag} (1–3)`);
    const lead = poses.map((p) => clonePose((p as Plain)[String(r.of)]));
    const b = (base as Plain)[String(r.of)];
    const L = (f: number) => (f < 0 ? b : lead[f]);
    for (let f = def.struck ? 1 : 0; f < poses.length; f++) {
      const p = poses[f] as Plain;
      p[String(r.field)] = addDelta(p[String(r.field)], L(f - r.lag), L(f), `${anim} follow ${String(r.field)}`);
    }
  }

  // ---- the exact end pose (HA-14), holds, the escape hatch
  if (appended) poses.push(clonePose(def.end === 'guard0' ? guard0 : idle0));
  const holds = def.beats.map((b) => b.ms);
  if (appended) holds.push(def.endMs ?? holds[holds.length - 1]);
  for (const [k, patch] of Object.entries(def.frames ?? {})) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= n) fail(`frames: no frame ${k}`);
    poses[i] = patch(clonePose(poses[i]));
  }

  // ---- HA-12 smear frames
  const smearFrom = poses.map((_, i) => (i < def.beats.length && def.beats[i].smear ? clonePose(i === 0 ? base : poses[i - 1]) : undefined));

  const spec: AnimSpec = { frames: n, fps: def.fps ?? 10, loop: false, holds };
  if (Object.keys(marks).length) spec.marks = marks;
  return Object.freeze({ anim, poses: Object.freeze(poses), spec, smearFrom: Object.freeze(smearFrom) });
}

/** Compile a monster's anim tables (throws AnimGrammarError on a grammar error). */
export function compileAnims<P>(kit: PoseKit<P>, defs: AnimDefs<P>): CompiledAnims<P> {
  const idle = compileLoop(kit, 'idle', defs.idle);
  const guard = compileLoop(kit, 'guard', defs.guard);
  const idle0 = idle.poses[0];
  const guard0 = guard.poses[0];
  const anims: Partial<Record<AnyMonsterAnim, CompiledAnim<P>>> = { idle, guard };
  for (const a of [...MONSTER_ANIMS, ...MONSTER_ANIMS_EXTRA]) {
    if (a === 'idle' || a === 'guard') continue;
    const def = (defs as unknown as Partial<Record<AnyMonsterAnim, AnimDef<P>>>)[a];
    if (def) anims[a] = compileOne(kit, a, def, idle0, guard0);
    else if ((MONSTER_ANIMS as readonly string[]).includes(a)) throw new AnimGrammarError(`${a}: a base anim is required`);
  }
  const frozen = Object.freeze(anims);
  return Object.freeze({
    idle0,
    guard0,
    anims: frozen,
    pose(anim: AnyMonsterAnim, frame: number): P {
      const c = frozen[anim];
      if (!c) throw new Error(`rigkit: no anim ${anim}`);
      return clonePose(c.poses[Math.max(0, Math.min(c.poses.length - 1, Math.floor(frame)))]);
    },
  });
}

/** The regions that lead a guard transition (arms, props, wings) and the one that comes last. */
const LEAD_REGIONS: readonly RegionId[] = ['armN', 'armF', 'propN', 'propF', 'wingN', 'wingF'];
/** Body progress of the draft's four beats (the fifth frame is the exact end pose). */
const DRAFT_T: readonly number[] = [0.2, 0.45, 0.7, 0.9];
const DRAFT_LEAD = 0.25;
const DRAFT_HEAD_LAG = 0.2;
/** Draft holds: 4 beats + the end frame = 370 ms (HA-29: ≤ 0.4 s). */
export const DRAFT_GUARD_HOLDS: readonly number[] = Object.freeze([60, 70, 70, 80, 90]);

/**
 * A DRAFT toGuard / fromGuard (HA-29): 5 frames, 370 ms — the arms (props, wings) lead, the body
 * goes down (or up), the head comes last, ending on the exact guard f0 / idle f0. The common tier
 * may ship it; the normal tier reviews it at ×3 and corrects it by hand (A3_MIMARI §3.2).
 */
export function draftGuardTransitions<P>(kit: PoseKit<P>, idle0: P, guard0: P, o: { holds?: readonly number[] } = {}): { toGuard: AnimDef<P>; fromGuard: AnimDef<P> } {
  const holds = o.holds ?? DRAFT_GUARD_HOLDS;
  if (holds.length !== DRAFT_T.length + 1) throw new AnimGrammarError(`draftGuardTransitions: ${holds.length} holds for ${DRAFT_T.length + 1} frames`);
  const lead = kit.regionFields(LEAD_REGIONS);
  const head = kit.regionFields(['head']);
  const tOf = (t: number) => (k: keyof P) => (lead.has(k) ? Math.min(1, t + DRAFT_LEAD) : head.has(k) ? Math.max(0, t - DRAFT_HEAD_LAG) : t);
  const make = (from: P, to: P, end: 'idle0' | 'guard0'): AnimDef<P> => ({
    base: from,
    beats: DRAFT_T.map((t, i): Beat<P> => ({ key: () => lerpBy(from as P & object, to as P & object, tOf(t)) as P, ms: holds[i] })),
    end,
    endMs: holds[DRAFT_T.length],
  });
  return { toGuard: make(idle0, guard0, 'guard0'), fromGuard: make(guard0, idle0, 'idle0') };
}

// ------------------------------------------------------------------ to a MonsterArt

/** Which frame is being drawn (and the pose a release smear stretches from). */
export interface FrameRef<P> {
  readonly anim: AnyMonsterAnim;
  readonly frame: number;
  readonly smearFrom?: P;
}

/** What a compiled monster adds to its anims to become a MonsterArt. */
export interface ArtShell<P> {
  readonly id: MonsterId;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly hover?: number;
  readonly core: { x: number; y: number };
  /** default: points().muzzle on the attack's release frame, else core */
  readonly muzzle?: { x: number; y: number };
  readonly weight?: WeightClass;
  /** default 'relight' (IŞ-1: every v3 monster) */
  readonly p2?: 'mirror' | 'relight';
  draw(p: PixelCanvas, pose: P, light: Light, at: FrameRef<P>): void;
  points?(pose: P, at: FrameRef<P>): MonsterPoints;
  portrait?(p: PixelCanvas): void;
}

/** A plain MonsterArt from compiled anims (attackImpactFrame = the attack's release mark). */
export function toMonsterArt<P>(c: CompiledAnims<P>, shell: ArtShell<P>): MonsterArt {
  const ref = (anim: AnyMonsterAnim, frame: number): FrameRef<P> => {
    const ca = c.anims[anim];
    if (!ca) throw new Error(`rigkit: ${shell.id} has no anim ${anim}`);
    const f = Math.max(0, Math.min(ca.poses.length - 1, Math.floor(frame)));
    return { anim, frame: f, smearFrom: ca.smearFrom[f] };
  };
  const render = (p: PixelCanvas, anim: AnyMonsterAnim, frame: number, o?: { lightFrom: 'left' | 'right' }) => {
    const r = ref(anim, frame);
    shell.draw(p, c.pose(anim, r.frame), lightOf(o), r);
  };
  const anims = Object.fromEntries(MONSTER_ANIMS.map((a) => [a, c.anims[a]!.spec])) as Record<MonsterAnim, AnimSpec>;
  const extraAnims: Partial<Record<MonsterAnimExtra, AnimSpec>> = {};
  for (const a of MONSTER_ANIMS_EXTRA) if (c.anims[a]) extraAnims[a] = c.anims[a]!.spec;
  const att = c.anims.attack!;
  const impact = att.spec.marks?.release ?? att.spec.marks?.impact ?? 0;
  const muzzle = shell.muzzle ?? (shell.points ? shell.points(c.pose('attack', impact), ref('attack', impact)).muzzle : undefined) ?? shell.core;
  const art: MonsterArt = {
    id: shell.id,
    w: shell.w,
    h: shell.h,
    anchorX: shell.anchorX,
    anchorY: shell.anchorY,
    hover: shell.hover ?? 0,
    muzzle: { x: muzzle.x, y: muzzle.y },
    core: { x: shell.core.x, y: shell.core.y },
    anims,
    attackImpactFrame: impact,
    p2: shell.p2 ?? 'relight',
    draw(p, anim, frame, o) {
      render(p, anim, frame, o);
    },
    extraAnims,
    drawExtra(p, anim, frame, o) {
      render(p, anim, frame, o);
    },
  };
  if (shell.weight) art.weight = shell.weight;
  if (shell.points) {
    const pts = shell.points;
    art.points = (anim, frame) => (c.anims[anim] ? pts(c.pose(anim, frame), ref(anim, frame)) : {});
  }
  if (shell.portrait) art.portrait = shell.portrait;
  return art;
}
