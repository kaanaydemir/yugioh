// Body plans — the layer between the rigkit core and a monster file (docs/v3/A3_MIMARI.md §2, §3.3,
// §3.4, §3.6, §8).
//
// A plan gives a skeleton, slots, planted feet, joints() (the sameness gate's tracks; the hit kit also
// measures each recoil's hip travel from them), poseKnockPx() and a helper vocabulary. It gives NO choreography: the monster keys its own poses and holds; the
// rigkit compiler only enforces the grammar (§0 items 1–3). planArt() turns a plan member into a
// plain MonsterArt (registry, textures, kits and tools see no difference), plus `levels` (anim → the
// escape level it is drawn with, §8) for tools/monster-gates.ts.
//
// The frame pipeline of a plan member (planArt):
//   rig = plan.rig(build, pose) → for every slot of the order: the parts in that slot (a pose may
//   move a part to another slot for one frame: plan.slotOf) paint a layer, composited with a seam /
//   crease band (IŞ-5) → at 'outline' the frame is outlined once (PAL.ink) → the slots after it are
//   light (blitted, never outlined, IŞ-9) → the member's post hooks (L4) → a hand retouch (L2).
//   An anim with drawAnim (L3) is drawn by the member alone.
//
// Additions to the §3.3 / §3.4 sketches (each needed by a member or a tool; all additive):
//   BodyPlan.helpers(b)      the vocabulary is bound to a build (words that raise a hand need its length)
//   BodyPlan.check / slotOf / named   build problems; per-frame stations; rig points `points` may name
//   PlanHelpers words return PoseDelta (nested partials: `{ hip: { x } }`), not Partial
//   PartCtx.ref / w / h / dst / comp / part / smearFrom / smearRig   what a G-buffer painter, a rim /
//                            shadow pass and a part-space pass need (a MatRef, the frame so far, the
//                            part-id buffer, HA-12)
//   PartPainter.role         the material a 'selout' / 'crease' seam steps down (default: the union of
//                            the member's materials — the seam steps the surface BEHIND the part)
//   PlanMonster.fx           the neutral values of the member's Fx channels (the pose kit needs them)
//   PlanArt.levels / escapes §8 levels (monster-gates' L3+ share) and the art-wide L4 hatches in use

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { MonsterId } from '../../data/cards';
import { MONSTER_ANIMS, MONSTER_ANIMS_EXTRA, type AnyMonsterAnim, type MonsterArt, type MonsterPointName, type MonsterPoints, type WeightClass } from '../types';
import { materialOf, type MaterialDef, type MaterialId } from '../materials';
import { compileAnims, toMonsterArt, type AnimDef, type AnimDefs, type CompiledAnims, type FrameRef } from '../rigkit/anim';
import { FOLD1, PartComp, composite, seamFrom, stepDown, type Fold, type SeamFn, type StepTable } from '../rigkit/composite';
import type { V } from '../rigkit/geom';
import { lightOf, type Light } from '../rigkit/light';
import { stamp, type MapPair } from '../rigkit/maps';
import type { PassId } from '../rigkit/passes/types';
import { definePose, type PoseDelta, type PoseKit, type RegionId } from '../rigkit/pose';
import { Workspace, materialTable, type MatRef, type Raster } from '../rigkit/raster';
import type { Tier } from '../rigkit/validate';

export type { RegionId } from '../rigkit/pose';
export type { Tier } from '../rigkit/validate';

// ------------------------------------------------------------------ the plan

/** The art frame of a member. */
export interface PlanFrame {
  readonly w: number;
  readonly h: number;
  readonly anchor: readonly [x: number, y: number];
  readonly hover?: number;
}

export interface BodyPlan<Build, P, R> {
  /** 'biped' */
  readonly id: string;
  /** = the version directory (biped/v1 → 1): stamped by the plan's index from the directory, never by hand (§3.6) */
  readonly version: number;
  neutral(b: Build): P;
  /** lag groups for mix() */
  readonly groups: Readonly<Record<string, readonly (keyof P)[]>>;
  /** the struck-frame filter (HA-21) */
  readonly regions: Readonly<Partial<Record<RegionId, readonly (keyof P)[]>>>;
  /** skeleton solve: IK limbs, planted feet, spine, head lag */
  rig(b: Build, pose: P): R;
  /** default far → near slot order (with the 'outline' pseudo-slot) */
  readonly order: readonly string[];
  /** muzzle / core / head / hand / feet / grip… (frame px) */
  points(b: Build, rig: R, pose: P): MonsterPoints;
  /** handN, handF, head, hip, footN, footF, prop*… (frame px; the sameness tool, §9; the hit kit's recoil travel, §10.2) */
  joints(b: Build, rig: R, pose: P): Readonly<Record<string, V>>;
  /**
   * px of body travel the recoil words draw, power 1 / 2 / 3 (§10): the documentation of
   * helpers.recoilPush. planArt publishes it as the art's declared poseKnockPx; the hit kit reads that
   * only for an art without joints() — a plan art's kit subtracts the hip travel the recoil that plays
   * measurably draws (_v3/blow.ts poseTravelPx), whatever the member keyed.
   */
  poseKnockPx(b: Build, weight: WeightClass): readonly [number, number, number];
  /** the vocabulary bound to a build: words, not choreography; each returns a delta */
  helpers(b: Build): PlanHelpers<Build, P>;
  /** build problems against the member's frame (empty = it resolves) */
  check?(b: Build, frame: PlanFrame): readonly string[];
  /** the slot a part is drawn in this frame (a pose's station), default its painter's layer */
  slotOf?(pose: P, part: string, layer: string): string;
  /** rig points a member's `points` strings may name besides the joints */
  named?(b: Build, rig: R, pose: P): Readonly<Record<string, V>>;
}

/**
 * VOCABULARY rules: no word carries a default period, phase or amplitude. Loop words take them as
 * REQUIRED arguments, so two members can never share an idle by omission (§9: loop signature).
 */
export interface PlanHelpers<B, P> {
  breathe(o: { periodMs: number; phase: number; amp: number }): (tMs: number) => PoseDelta<P>;
  weightShift(o: { periodMs: number; phase: number; px: number }): (tMs: number) => PoseDelta<P>;
  plant(foot: 'N' | 'F'): PoseDelta<P>;
  step(foot: 'N' | 'F', dx: number): PoseDelta<P>;
  /** frame 0 of a reaction (region only) */
  struck(region: RegionId, power: 1 | 2 | 3): PoseDelta<P>;
  /** forward lean (a blow from behind, HA-23) */
  struckBack(power: 1 | 2 | 3): PoseDelta<P>;
  /** hip drops, head bows (a bolt from above) */
  struckAbove(power: 1 | 2 | 3): PoseDelta<P>;
  /** f0 / f1 / f2: the struck region leads, the body and hips follow; by f2 the pelvis has travelled poseKnockPx[power] */
  recoilPush(weight: WeightClass, power: 1 | 2 | 3): readonly [PoseDelta<P>, PoseDelta<P>, PoseDelta<P>];
  guardTuck(o: { lead: 'arms' | 'shield'; dropPx: number }): PoseDelta<P>;
  throwArc(o: { from: 'handN' | 'handF'; liftPx: number }): readonly PoseDelta<P>[];
}

// ------------------------------------------------------------------ parts

export interface PartCtx<P, R> {
  readonly pose: P;
  readonly rig: R;
  readonly light: Light;
  readonly anim: AnyMonsterAnim;
  readonly frame: number;
  /** the material of a role ('body', 'trim', 'emissive'…; throws for an unknown role) */
  mat(role: string): MaterialDef;
  /** a cleared G-buffer of the frame size, lit by the frame's light (pooled per frame) */
  raster(): Raster;
  /** a cleared canvas of the frame size (pooled per frame) */
  canvas(): PixelCanvas;
  // ---- additive (A3 Y7)
  /** the role's slot in the frame's material table (Raster primitives take it) */
  ref(role: string): MatRef;
  readonly w: number;
  readonly h: number;
  /** the frame composited so far: rimLight / castShadow read it; a "pass part" may work on it and return null */
  readonly dst: PixelCanvas;
  /** the part-id buffer (which part owns each pixel, 1-based in `parts` order): part-space passes */
  readonly comp: PartComp;
  /** the part being painted ('' for a post hook) */
  readonly part: string;
  /** HA-12: on a smear frame, the pose (and rig) the release stretches from */
  readonly smearFrom?: P;
  readonly smearRig?: R;
}

export interface PartPainter<P, R> {
  /** a slot of the order (or a new one: L4) */
  readonly layer: string;
  /** a G-buffer part, a map stamp or cloth planes — a canvas of the frame size, or null */
  paint(ctx: PartCtx<P, R>): PixelCanvas | null;
  /** the band laid on the surface behind the part (IŞ-5); default 'selout'; 'none' = a plain blit */
  readonly seam?: 'selout' | 'crease' | 'none' | SeamFn;
  readonly fold?: Fold;
  /** the material whose ramp 'selout' / 'crease' step down (default: all of the member's materials) */
  readonly role?: string;
}

// ------------------------------------------------------------------ the monster file

/** "Ayrışma kartı" — REQUIRED, read by the sameness review (§9.3 UYARI). */
export interface DistinctionCard {
  silhouette: string;
  rhythm: string;
  idle: string;
  guard: string;
  signaturePart: string;
  material: string;
  signatureMove: string;
  allow?: readonly { with: string; metric: 'KEY' | 'MOT' | 'SI' | 'RHYTHM' | 'HEAT'; why: string; approvedBy: 'user' }[];
}

export type PlanPose<P, Fx extends Record<string, number>> = P & { fx: Fx };

export interface PlanMonster<Build, P, R, Fx extends Record<string, number> = {}> {
  /** MonsterId today; string-compatible (§11.3) */
  id: string;
  tier: Exclude<Tier, 'ace'>;
  frame: PlanFrame;
  /** proportions + slot variants */
  build: Build;
  /** part role → material ('body', 'trim', 'emissive'…) */
  materials: Readonly<Record<string, MaterialId>>;
  /** (Y7) the neutral values of the member's own channels (Titan: core, seam, flare; Muhafız: rune, slit) */
  fx: Fx;
  /** null = an empty slot */
  parts: Readonly<Record<string, PartPainter<PlanPose<P, Fx>, R> | null>>;
  /** L4: insert / reorder slots */
  order?: readonly string[];
  /** hand-keyed (normal) or archetype + overrides (common) */
  anims: AnimDefs<PlanPose<P, Fx>>;
  weight: WeightClass;
  /** a joint / named rig point, or a function of the frame */
  points?: Partial<Record<MonsterPointName, string | ((rig: R, p: PlanPose<P, Fx>) => { x: number; y: number })>>;
  passes?: { death?: PassId; revive?: PassId };
  /** L3: the whole anim drawn by the member (timing still from `anims`) */
  drawAnim?: Partial<Record<AnyMonsterAnim, (p: PixelCanvas, f: number, light: Light) => void>>;
  /** L4: whole-frame passes after the parts (and the outline) */
  post?: readonly ((p: PixelCanvas, ctx: PartCtx<PlanPose<P, Fx>, R>) => void)[];
  /** L2: a hand retouch of one frame, lit for P1 and P2 */
  retouch?: Partial<Record<`${AnyMonsterAnim}:${number}`, MapPair>>;
  /**
   * (A4.1, additive) marks a beat name cannot set, per anim (mark → frame index), merged over the
   * compiled marks: a member's own beats its recipe reads (the titan's attack 'stomp' / 'drive'), or a
   * base mark on a frame whose beat already carries another name (contact on the release frame of a
   * punch that lands in the anim). AnimSpec.marks carries them as extra keys.
   */
  marks?: Partial<Record<AnyMonsterAnim, Readonly<Record<string, number>>>>;
  /** default 'pose' (§10) */
  knock?: 'pose' | 'sprite';
  /** every v3 monster (IŞ-1) */
  p2?: 'relight';
  portrait?: MonsterArt['portrait'];
  distinction: DistinctionCard;
}

/** §8 escape levels: L0 parameters · L1 a part · L2 a frame · L3 an anim · L4 a new part / pass · L5 the whole art. */
export type EscapeLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** What planArt returns: a plain MonsterArt, with the plan fields always set (P / R: the member's pose and rig). */
export type PlanArt<P = unknown, R = unknown> = MonsterArt & {
  readonly knock: 'pose' | 'sprite';
  /** the plan's declared recoil travel (documentation of recoilPush; the hit kit measures joints() instead) */
  readonly poseKnockPx?: readonly [number, number, number];
  readonly bodyPlan: { readonly id: string; readonly version: number };
  joints(anim: AnyMonsterAnim, frame: number): Readonly<Record<string, { x: number; y: number }>>;
  /**
   * anim → the highest escape level its frames are drawn with: 3 drawAnim, 2 a frame patch or retouch,
   * else 1 (the member's own parts). The art-wide L4 hatches (a new slot, a reordered order, post
   * passes) extend the plan's pipeline on every frame instead of replacing it: they are listed in
   * `escapes`, not counted per anim (counting them would make one glow pass "100 % L3+").
   */
  readonly levels: Readonly<Partial<Record<AnyMonsterAnim, EscapeLevel>>>;
  readonly escapes: readonly string[];
  readonly passes?: { readonly death?: PassId; readonly revive?: PassId };
  /** the compiled pose of a frame (fx channels filled) and its solved rig — for tools and previews, never at runtime */
  pose(anim: AnyMonsterAnim, frame: number): P;
  rig(anim: AnyMonsterAnim, frame: number): R;
};

const OUTLINE = 'outline';

function seamUnion(defs: readonly MaterialDef[], kind: 'seam' | 'crease'): SeamFn {
  const t: Record<number, number> = {};
  for (const d of defs) {
    const own = kind === 'seam' ? d.draw.seam : d.draw.crease;
    Object.assign(t, typeof own === 'string' ? stepDown(d.draw.ramp, kind === 'seam' ? 1 : 2) : (own as StepTable));
  }
  return seamFrom(t);
}

const roundPt = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) });

/**
 * Build a member's MonsterArt on a plan VERSION (the one the monster imports:
 * `import { v1 as biped } from '…/bodyplans/biped'`); bodyPlan = { plan.id, plan.version }.
 * Throws on a build the plan rejects, an unknown slot or a grammar error of the anim tables.
 */
export function planArt<B, P extends object, R, Fx extends Record<string, number>>(plan: BodyPlan<B, P, R>, m: PlanMonster<B, P, R, Fx>): PlanArt<PlanPose<P, Fx>, R> {
  type PP = PlanPose<P, Fx>;
  const fail = (msg: string): never => {
    throw new Error(`planArt ${m.id} (${plan.id} v${plan.version}): ${msg}`);
  };
  const problems = plan.check?.(m.build, m.frame) ?? [];
  if (problems.length) fail(problems.join('; '));

  // ---- slots
  const order = m.order ?? plan.order;
  if (new Set(order).size !== order.length) fail(`the order repeats a slot (${order.join(', ')})`);
  const partNames = Object.keys(m.parts);
  for (const n of partNames) {
    const pp = m.parts[n];
    if (pp && !order.includes(pp.layer)) fail(`part '${n}' paints slot '${pp.layer}', which is not in the order`);
    if (pp && pp.layer === OUTLINE) fail(`part '${n}' cannot paint the '${OUTLINE}' pseudo-slot`);
  }
  const slotOf = (pose: PP, part: string, layer: string) => plan.slotOf?.(pose, part, layer) ?? layer;

  // ---- materials
  const roles = Object.keys(m.materials);
  const defs = roles.map((r) => materialOf(m.materials[r]));
  const refOf = new Map(roles.map((r, i) => [r, i] as const));
  const table = materialTable(defs);
  const seams = { selout: seamUnion(defs, 'seam'), crease: seamUnion(defs, 'crease') };
  const roleSeams = new Map<string, { selout: SeamFn; crease: SeamFn }>();
  const seamFor = (pp: PartPainter<PP, R>): SeamFn | null => {
    const s = pp.seam ?? 'selout';
    if (s === 'none') return null;
    if (typeof s === 'function') return s;
    if (!pp.role) return seams[s];
    let rs = roleSeams.get(pp.role);
    if (!rs) {
      const d = defOf(pp.role);
      rs = { selout: seamUnion([d], 'seam'), crease: seamUnion([d], 'crease') };
      roleSeams.set(pp.role, rs);
    }
    return rs[s];
  };
  function defOf(role: string): MaterialDef {
    const i = refOf.get(role);
    if (i === undefined) throw new Error(`planArt ${m.id}: no material role '${role}' (roles: ${roles.join(', ')})`);
    return defs[i];
  }
  function refFor(role: string): MatRef {
    const i = refOf.get(role);
    if (i === undefined) throw new Error(`planArt ${m.id}: no material role '${role}' (roles: ${roles.join(', ')})`);
    return i;
  }

  // ---- the pose kit (the member's channels ride along under `fx`; a struck 'extra' region may move them)
  const base = plan.neutral(m.build) as unknown as Record<string, unknown>;
  if ('fx' in base) fail(`the plan's pose already has a field 'fx'`);
  const neutral = { ...base, fx: { ...m.fx } } as unknown as PP;
  const regions = { ...plan.regions } as Partial<Record<RegionId, readonly (keyof PP)[]>>;
  regions.extra = [...((regions.extra ?? []) as readonly (keyof PP)[]), 'fx' as keyof PP];
  const kit: PoseKit<PP> = definePose<PP>(neutral, plan.groups as Record<string, readonly (keyof PP)[]>, regions);
  const compiled: CompiledAnims<PP> = compileAnims(kit, m.anims);
  for (const [a, extra] of Object.entries(m.marks ?? {}) as [AnyMonsterAnim, Readonly<Record<string, number>>][]) {
    const c = compiled.anims[a];
    if (!c) fail(`marks: no anim ${a}`);
    for (const [k, f] of Object.entries(extra)) if (!Number.isInteger(f) || f < 0 || f >= c!.spec.frames) fail(`marks: ${a} ${k} = ${f} outside 0…${c!.spec.frames - 1}`);
    (c!.spec as { marks?: Record<string, number> }).marks = { ...(c!.spec.marks ?? {}), ...extra };
  }
  const withFx = (p: PP): PP => ({ ...p, fx: { ...m.fx, ...(p as { fx?: Fx }).fx } });

  // ---- drawing
  const ws = new Workspace(m.frame.w, m.frame.h, lightOf('left'), table);
  const draw = (p: PixelCanvas, pose0: PP, light: Light, at: FrameRef<PP>) => {
    const own = m.drawAnim?.[at.anim];
    if (own) return own(p, at.frame, light);
    const pose = withFx(pose0);
    ws.begin(light);
    const rig = plan.rig(m.build, pose);
    const comp = new PartComp(p);
    const smearFrom = at.smearFrom ? withFx(at.smearFrom) : undefined;
    const smearRig = smearFrom ? plan.rig(m.build, smearFrom) : undefined;
    const ctxFor = (part: string): PartCtx<PP, R> => ({
      pose,
      rig,
      light,
      anim: at.anim,
      frame: at.frame,
      mat: defOf,
      raster: () => ws.raster(),
      canvas: () => ws.canvas(),
      ref: refFor,
      w: m.frame.w,
      h: m.frame.h,
      dst: p,
      comp,
      part,
      smearFrom,
      smearRig,
    });
    const slotted = partNames.map((n) => {
      const pp = m.parts[n];
      return pp ? slotOf(pose, n, pp.layer) : null;
    });
    slotted.forEach((s, i) => {
      if (s !== null && !order.includes(s)) fail(`${at.anim}:${at.frame}: the pose sends part '${partNames[i]}' to slot '${s}', which is not in the order`);
    });
    let lit = false;
    for (const slot of [...order, ...(order.includes(OUTLINE) ? [] : [OUTLINE])]) {
      if (slot === OUTLINE) {
        p.outline(PAL.ink);
        lit = true;
        continue;
      }
      for (let i = 0; i < partNames.length; i++) {
        if (slotted[i] !== slot) continue;
        const pp = m.parts[partNames[i]]!;
        const layer = pp.paint(ctxFor(partNames[i]));
        if (!layer) continue;
        const seam = lit ? null : seamFor(pp);
        if (seam) composite(p, layer, seam, pp.fold ?? FOLD1);
        else p.blit(layer, 0, 0);
        comp.mark(layer, i + 1);
      }
    }
    if (m.post) {
      const ctx = ctxFor('');
      for (const f of m.post) f(p, ctx);
    }
    const rt = m.retouch?.[`${at.anim}:${at.frame}`];
    if (rt) stamp(p, rt, [0, 0], light);
  };

  // ---- points, joints
  const named = (rig: R, pose: PP): Readonly<Record<string, V>> => ({ ...(plan.named?.(m.build, rig, pose) ?? {}), ...plan.joints(m.build, rig, pose) });
  const pointsOf = (pose0: PP): MonsterPoints => {
    const pose = withFx(pose0);
    const rig = plan.rig(m.build, pose);
    const out: MonsterPoints = { ...plan.points(m.build, rig, pose) };
    for (const [k, src] of Object.entries(m.points ?? {}) as [MonsterPointName, string | ((rig: R, p: PP) => { x: number; y: number })][]) {
      if (typeof src === 'function') out[k] = src(rig, pose);
      else {
        const v = named(rig, pose)[src];
        if (!v) fail(`points.${k}: no joint or rig point '${src}'`);
        out[k] = { x: v[0], y: v[1] };
      }
    }
    for (const k of Object.keys(out) as MonsterPointName[]) out[k] = roundPt(out[k]!);
    return out;
  };
  const core = pointsOf(compiled.idle0).core ?? { x: m.frame.anchor[0], y: Math.round(m.frame.anchor[1] - m.frame.h / 2) };

  const art = toMonsterArt(compiled, {
    id: m.id as MonsterId,
    w: m.frame.w,
    h: m.frame.h,
    anchorX: m.frame.anchor[0],
    anchorY: m.frame.anchor[1],
    hover: m.frame.hover,
    core,
    weight: m.weight,
    p2: m.p2 ?? 'relight',
    draw,
    points: (pose) => pointsOf(pose),
    portrait: m.portrait,
  });

  // ---- the plan fields
  const knock = m.knock ?? 'pose';
  const poseAt = (anim: AnyMonsterAnim, frame: number) => withFx(compiled.pose(anim, frame));
  const rigAt = (anim: AnyMonsterAnim, frame: number) => plan.rig(m.build, poseAt(anim, frame));
  const joints = (anim: AnyMonsterAnim, frame: number) => {
    const pose = poseAt(anim, frame);
    const j = plan.joints(m.build, plan.rig(m.build, pose), pose);
    const out: Record<string, { x: number; y: number }> = {};
    for (const [k, v] of Object.entries(j)) out[k] = { x: v[0], y: v[1] };
    return out;
  };
  const levels: Partial<Record<AnyMonsterAnim, EscapeLevel>> = {};
  const defsByAnim = m.anims as unknown as Partial<Record<AnyMonsterAnim, AnimDef<PP>>>;
  for (const a of [...MONSTER_ANIMS, ...MONSTER_ANIMS_EXTRA]) {
    if (!compiled.anims[a]) continue;
    const patched = Object.keys(defsByAnim[a]?.frames ?? {}).length > 0 || Object.keys(m.retouch ?? {}).some((k) => k.startsWith(`${a}:`));
    levels[a] = m.drawAnim?.[a] ? 3 : patched ? 2 : 1;
  }
  const escapes: string[] = [];
  if (m.order && (m.order.length !== plan.order.length || m.order.some((s, i) => s !== plan.order[i]))) escapes.push('L4 order');
  for (const s of new Set(Object.values(m.parts).flatMap((pp) => (pp && !plan.order.includes(pp.layer) ? [pp.layer] : [])))) escapes.push(`L4 slot:${s}`);
  if (m.post?.length) escapes.push(`L4 post×${m.post.length}`);
  for (const a of Object.keys(m.drawAnim ?? {})) escapes.push(`L3 drawAnim:${a}`);

  return Object.assign(art, {
    knock,
    // the declared table stays (tools print it, an art copied without joints() falls back to it); with
    // joints() the hit kit subtracts the travel each recoil measurably draws (A3 core review F4)
    ...(knock === 'pose' ? { poseKnockPx: [...plan.poseKnockPx(m.build, m.weight)] as unknown as readonly [number, number, number] } : {}),
    bodyPlan: { id: plan.id, version: plan.version },
    joints,
    levels,
    escapes,
    ...(m.passes ? { passes: { ...m.passes } } : {}),
    pose: poseAt,
    rig: rigAt,
  }) as PlanArt<PP, R>;
}

/**
 * Member `motion`'s anims on member `body`'s build / parts / materials / frame — the sameness gate's
 * negative control (b) (§9.2, §9.4 `--cross FILE:ID`): FILE default-exports
 * `planArt(plan, crossMember(TITAN, SENTINEL))` and is compared with the motion member. The body's
 * channels keep their neutral values where the motion's keys do not set them; frame-bound hatches
 * of the body (drawAnim, retouch) are dropped (they belong to the body's own anims).
 */
export function crossMember<B, P, R, FB extends Record<string, number>, FM extends Record<string, number>>(body: PlanMonster<B, P, R, FB>, motion: PlanMonster<B, P, R, FM>): PlanMonster<B, P, R, FB & FM> {
  type FX = FB & FM;
  return {
    ...body,
    id: body.id,
    fx: { ...motion.fx, ...body.fx } as FX,
    parts: body.parts as unknown as PlanMonster<B, P, R, FX>['parts'],
    post: body.post as unknown as PlanMonster<B, P, R, FX>['post'],
    points: body.points as unknown as PlanMonster<B, P, R, FX>['points'],
    anims: motion.anims as unknown as AnimDefs<PlanPose<P, FX>>,
    drawAnim: undefined,
    retouch: undefined,
    distinction: { ...body.distinction, signatureMove: `${motion.id}'s anims on ${body.id}'s body (sameness control b)` },
  };
}

/**
 * Stamp a plan definition with its version from its directory name ('v1' → 1). A plan index calls it
 * once per version directory with the directory keys of its import.meta.glob('./v*\/index.ts'), so a
 * version that is not a directory throws at load (§3.6: the version is the directory, never typed).
 */
export function versionDir<T extends object>(def: T, dir: string, dirs: readonly string[]): T & { readonly version: number } {
  const m = /^v([1-9]\d*)$/.exec(dir);
  if (!m) throw new Error(`body plan version directory '${dir}' is not v<N>`);
  if (!dirs.includes(`./${dir}/index.ts`)) throw new Error(`body plan version directory '${dir}' does not exist (found: ${dirs.join(', ')})`);
  return Object.freeze({ ...def, version: Number(m[1]) });
}
