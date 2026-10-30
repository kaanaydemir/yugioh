// Kalkan Devi v3 — the ANIM TABLES: hand-keyed beats and holds over biped v1 poses (A3_MIMARI §3.2).
// The plan gives words and geometry; the choreography is this file's. Every number is a whole-pixel
// decision: a plate either moves a pixel or it does not (REHBER IŞ-12). The shield is the actor: it
// leans, creaks, is heaved, driven forward and slammed down; the giant behind it only shows as the
// pauldron, the gauntlet on the rim, the boot and the eyes.
//
// Base (part 1): idle 12 f / 1.98 s · guard 6 f / 1.17 s · attack (Kalkan Darbesi, the shield bash) · roar
// (the war-cry: the slab heaved up, slammed down, then it RATTLES) · hit.
// Extras (part 2): summon (the shield heaved up out of the floor, the giant under it), death (the grip
// fails, the slab cracks, leans and comes apart into its plates, a slumped hulk behind it), revive (the
// plates fly back), hitHeavy, hitMagic, toGuard, fromGuard, victory.

import { bipedNeutral, bipedRig, restOf, type BipedDelta } from '../bodyplans/biped/v1';
import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import type { V } from '../rigkit/geom';
import { BUILD, FX, type TitanFx } from './shield_titan-build';
import { REST_RIG, SHIELD_REST, planted, type Pose } from './shield_titan-parts';

type D = BipedDelta & { fx?: Partial<TitanFx> };
const REST = restOf(BUILD);

// ------------------------------------------------------------------ helpers

/** A delta over a pose: nested objects merged, tuples and values replaced (PoseDelta semantics). */
function over<T>(a: T, d: unknown): T {
  if (d === undefined) return a;
  if (Array.isArray(d) || typeof d !== 'object' || d === null) return d as T;
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) o[k] = over((a as Record<string, unknown>)?.[k], v);
  return o as T;
}

/** The hands' places on the slab, relative to its top-left corner (the near hand on the rim, the far one behind). */
const GRIP_N: V = [REST_RIG.armN.end[0] - SHIELD_REST[0], REST_RIG.armN.end[1] - SHIELD_REST[1]];
const GRIP_F: V = [REST_RIG.armF.end[0] - SHIELD_REST[0], REST_RIG.armF.end[1] - SHIELD_REST[1]];

/**
 * Both hands ON the slab wherever it stands (the plan carries a hand with its shoulder, so a body leaning
 * back from a slab heaved the other way would leave the hands short of the grips: the hands are solved here
 * from the shoulders this pose puts them at; joints().handN / handF and points().grip then follow the slab).
 */
function onSlab(p: Pose): Pose {
  const rig = bipedRig(BUILD, p);
  const s = rig.props.shield?.at;
  if (!s) return p;
  const dyN = p.fx?.fingY ?? 0;
  const hn: V = [s[0] + GRIP_N[0] - rig.shoulderN[0] - REST.handN[0], s[1] + GRIP_N[1] + dyN * 0 - rig.shoulderN[1] - REST.handN[1]];
  const hf: V = [s[0] + GRIP_F[0] - rig.shoulderF[0] - REST.handF[0], s[1] + GRIP_F[1] - rig.shoulderF[1] - REST.handF[1]];
  return over(p, { armN: { hand: hn, bend: 1, grip: 'hold' }, armF: { hand: hf, bend: 1, grip: 'hold' } });
}
/** A loop's delta with the hands pinned on the slab (the loops are deltas over the neutral pose). */
const NEUTRAL = { ...bipedNeutral(BUILD), fx: { ...FX } } as unknown as Pose;
const slab = (d: D): D => {
  const p = onSlab(over(NEUTRAL, d) as Pose);
  return { ...d, armN: p.armN, armF: p.armF } as D;
};
const key = (d: D) => (base: Pose): Pose => onSlab(over(base, d) as Pose);
const beat = (ms: number, d: D, name?: Beat<Pose>['name']): Beat<Pose> => ({ ms, key: key(d), ...(name ? { name } : {}) });
/** a beat for a struck first frame: a plain delta (the struck filter keeps only the struck regions' fields) */
const struck = (ms: number, d: D, name: Beat<Pose>['name'] = 'struck'): Beat<Pose> => ({ ms, key: d, name });

/** The pauldron / fingers / eye shorthand. */
const fxd = (f: Partial<TitanFx>): D => ({ fx: f });

// ------------------------------------------------------------------ idle: the wall breathes against the giant's weight
//
// One slow breath behind the slab in 10 frames / 1.98 s, one block at a time (the HA-21 phase: no frame
// carries the whole body off idle f0): the giant leans in (the slab's top creaks out a pixel and holds,
// the pauldron and the breastplate rise), then lets go (the slab's top creaks in a pixel, the pauldron
// sinks, the belt a pixel low); the gauntlet re-grips a frame late; the eyes drift toward the foe, blink
// once; the crest's tower windows glow up and ebb; a glint crosses the crown on the inhale; the rag
// sways on its own period, the arrow's tail ticks on the exhale.

// prettier-ignore
const IDLE: readonly { tilt: number; pad: number; chest: number; belt: number; fing: number; lid: number; eyeX: number; eye: number; sun: number; glint: number; arrow: number }[] = [
  { tilt: 0, pad: 0, chest: 0, belt: 0, fing: 0, lid: 1, eyeX: 0, eye: 1, sun: 0.5, glint: 0, arrow: 0 },
  { tilt: 0, pad: -1, chest: 0, belt: 0, fing: 0, lid: 1, eyeX: 0, eye: 1, sun: 0.7, glint: 0, arrow: 0 },
  { tilt: 1, pad: -1, chest: 1, belt: 0, fing: 0, lid: 1, eyeX: 1, eye: 1.2, sun: 1, glint: 0.28, arrow: 0 },
  { tilt: 1, pad: -2, chest: 1, belt: 0, fing: 1, lid: 1, eyeX: 1, eye: 1.2, sun: 1, glint: 0.6, arrow: 0 },
  { tilt: 0, pad: 0, chest: 0, belt: 0, fing: 1, lid: 1, eyeX: 1, eye: 1, sun: 0.8, glint: 0, arrow: 0 },
  { tilt: 0, pad: 1, chest: 0, belt: 0, fing: 0, lid: 2, eyeX: 0, eye: 0.9, sun: 0.6, glint: 0, arrow: 0 },
  { tilt: 0, pad: -1, chest: 0, belt: 1, fing: 1, lid: 3, eyeX: 0, eye: 0.8, sun: 0.5, glint: 0, arrow: 0 },
  { tilt: -1, pad: 0, chest: 0, belt: 1, fing: 1, lid: 2, eyeX: 0, eye: 0.9, sun: 0.5, glint: 0, arrow: 1 },
  { tilt: -1, pad: 1, chest: 1, belt: 0, fing: 0, lid: 1, eyeX: 0, eye: 1, sun: 0.4, glint: 0, arrow: 0 },
  { tilt: 0, pad: 1, chest: 0, belt: 0, fing: 0, lid: 1, eyeX: 0, eye: 1, sun: 0.5, glint: 0, arrow: 0 },
  { tilt: 0, pad: -1, chest: 0, belt: 0, fing: 1, lid: 1, eyeX: 0, eye: 1, sun: 0.5, glint: 0, arrow: 0 },
  { tilt: 0, pad: 1, chest: 0, belt: 0, fing: 0, lid: 1, eyeX: 0, eye: 1, sun: 0.5, glint: 0, arrow: 0 },
];
const IDLE_HOLDS = [200, 150, 130, 170, 190, 140, 160, 200, 150, 180, 150, 160];

const idle: LoopDef<Pose> = {
  n: IDLE.length,
  holds: IDLE_HOLDS,
  at: (f) => {
    const k = IDLE[f];
    return {
      props: { shield: planted() },
      hip: { x: 0, y: k.belt, tilt: 0 },
      breath: k.chest,
      clothPhase: f / IDLE.length,
      fx: { tilt: k.tilt, padY: k.pad, fingY: k.fing, lid: k.lid, eyeX: k.eyeX, eye: k.eye, sun: k.sun, glint: k.glint, arrow: k.arrow, rag: 1 },
    } as D;
  },
};

// ------------------------------------------------------------------ guard: the wall
//
// The slab leans its top out toward the foe and sinks a pixel into the earth, the giant hunkers behind it
// (hips 3 px down, the pauldron tucked in under the rim), the visor's lid drops to a slit and the crest's
// tower wakes: its windows burn gold, brightest at the middle of the loop. A slow shallow breath: the
// pauldron, then the chest, then the fingers on the rim a frame late; one glint crosses the crown.

const GUARD_BASE: D = { hip: { x: 1, y: 3, tilt: 0 }, lean: 0.1, props: { shield: planted([0, 1]) }, fx: { tilt: 2, lid: 2, eye: 1.4, padY: 1 } };
// prettier-ignore
const GUARD: readonly { pad: number; chest: number; fing: number; sun: number; tilt: number; glint: number; eye: number }[] = [
  { pad: 0, chest: 0, fing: 0, sun: 1.2, tilt: 2, glint: 0, eye: 1.4 },
  { pad: -1, chest: 0, fing: 0, sun: 1.5, tilt: 2, glint: 0.2, eye: 1.5 },
  { pad: -1, chest: 1, fing: 0, sun: 2, tilt: 2, glint: 0.55, eye: 1.7 },
  { pad: -1, chest: 1, fing: 1, sun: 1.7, tilt: 2, glint: 0, eye: 1.5 },
  { pad: 0, chest: 1, fing: 1, sun: 1.3, tilt: 2, glint: 0, eye: 1.4 },
  { pad: 0, chest: 0, fing: 0, sun: 1.1, tilt: 2, glint: 0, eye: 1.3 },
];
const guard: LoopDef<Pose> = {
  n: GUARD.length,
  holds: [190, 170, 200, 200, 170, 180],
  at: (f) => {
    const k = GUARD[f];
    return slab(over(GUARD_BASE, { breath: k.chest, clothPhase: f / GUARD.length, fx: { padY: 1 + k.pad, fingY: k.fing, sun: k.sun, tilt: k.tilt, glint: k.glint, eye: k.eye, rag: 0.6, arrow: 0 } }) as D);
  },
};

// ------------------------------------------------------------------ hit: the blow lands on the slab

const hit: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['propF', 'head', 'extra'] },
  beats: [
    // contact: the slab is driven a pixel back, a fresh dent with a lit lip, steel sparks, the arrow's tail jumps and the lid slams shut
    struck(50, { fx: { dent: 1, dentAt: 0, spark: 0.12, sparkAt: 0, lid: 3, arrow: -1, bash: 0.6, chips: 0.1, chipsAt: 0 } }),
    // the recoil: the hips give a pixel, the pauldron jolts, the slab tips its top in
    beat(60, { props: { shield: planted([-2, 0]) }, hip: { x: -1, y: 0, tilt: 0 }, lean: -0.04, fx: { dent: 1, dentAt: 0, spark: 0.4, sparkAt: 0, tilt: -1, padX: -1, lid: 3, arrow: 1, chips: 0.2, chipsAt: 0 } }),
    beat(130, { props: { shield: planted([-1, 0]) }, hip: { x: -1, y: 1, tilt: 0 }, lean: -0.05, fx: { dent: 1, dentAt: 0, spark: 0.75, sparkAt: 0, tilt: -1, padY: 1, lid: 2, arrow: -1, chips: 0.55, chipsAt: 0, dust: 0.3, dustAt: 0, fingY: 1 } }),
    beat(100, { props: { shield: planted() }, hip: { x: 0, y: 0, tilt: 0 }, fx: { dent: 1, dentAt: 0, spark: 0.95, sparkAt: 0, tilt: 1, lid: 1, eye: 1.3, arrow: 0, chips: 0.9, chipsAt: 0, dust: 0.65, dustAt: 0 } }, 'recover'),
    beat(110, { props: { shield: planted() }, fx: { dent: 1, dentAt: 0, tilt: 0, eye: 1.1, dust: 0.9, dustAt: 0 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ attack: Kalkan Darbesi (the shield bash)
//
// A slow wall that comes down on you. The look: the eyes narrow and slide toward the foe. The coil: the
// giant sinks and leans back, the slab dragged back with it, its top leaning in against the body. The
// CHARGE: the longest hold, everything gathered — the slab trembling, the eyes burning, the tower awake.
// Then the whole stack drives forward: the hips lead, the pauldron rolls ahead, the slab leans out and
// slams 8 px forward (the RELEASE, a smear behind its edge) — the rim flares white, steel sparks off the
// face and the bronze chips fly; the weight hangs on it (the contact hold); it is hauled back a step at a
// time, the dust rolling off the planted foot, and settles home. The feet never leave the ground.

const attack: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // look: the eyes narrow and slide to the foe, the pauldron rises a pixel
    beat(60, { fx: { lid: 2, eyeX: 1, eye: 1.3, padY: -1, sun: 1 } }),
    // the coil: hips down and back, the slab dragged back, its top leaning in
    beat(80, { hip: { x: -1, y: 1, tilt: 0 }, lean: -0.05, props: { shield: planted([-2, 0]) }, fx: { lid: 2, eyeX: 1, eye: 1.5, padY: -1, tilt: -1, sun: 1.3, dust: 0.15, dustAt: 2 } }),
    beat(90, { hip: { x: -2, y: 2, tilt: 0 }, lean: -0.1, props: { shield: planted([-3, 1]) }, fx: { lid: 2, eyeX: 1, eye: 1.7, padY: -1, tilt: -2, sun: 1.6, dust: 0.45, dustAt: 2 } }),
    // CHARGE (the longest hold): all gathered, the slab trembling a pixel, the glint on the crown
    { ...beat(200, { hip: { x: -3, y: 2, tilt: 0 }, lean: -0.13, props: { shield: planted([-4, 1]) }, fx: { lid: 2, eyeX: 1, eye: 2, padY: -2, tilt: -2, sun: 2, glint: 0.5, dust: 0.7, dustAt: 2, rag: 1.6 } }), name: 'charge' },
    // the drive: the hips lead, the slab already moving (an in-between), the pauldron rolling ahead
    beat(50, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.05, props: { shield: planted([-1, 0]) }, fx: { lid: 1, eyeX: 1, eye: 2, padX: 1, tilt: 0, sun: 2, rag: 1.8, dust: 0.9, dustAt: 2 } }),
    // RELEASE: the slab slammed 8 px forward, leaning out, the eyes wide
    { ...beat(60, { hip: { x: 3, y: 1, tilt: 0 }, lean: 0.14, props: { shield: planted([7, -1]) }, fx: { lid: 0, eyeX: 1, eye: 2, padX: 2, padY: 1, tilt: 2, sun: 2, rag: 2, fingY: 0 } }), name: 'release', smear: true },
    // CONTACT: the slab lands, the rim flares white, sparks and chips off the face, dust off the front foot
    { ...beat(70, { hip: { x: 4, y: 1, tilt: 0 }, lean: 0.16, props: { shield: planted([8, 0]) }, fx: { lid: 0, eyeX: 1, eye: 2, padX: 2, padY: 1, tilt: 3, bash: 1, dent: 1, dentAt: 1, spark: 0.1, sparkAt: 1, chips: 0.1, chipsAt: 1, dust: 0.15, dustAt: 1, sun: 2, rag: 1.4 } }), name: 'contact' },
    // the weight hangs on it
    beat(90, { hip: { x: 4, y: 2, tilt: 0 }, lean: 0.17, props: { shield: planted([8, 0]) }, fx: { lid: 1, eyeX: 1, eye: 1.8, padX: 2, padY: 1, tilt: 3, bash: 0.35, dent: 1, dentAt: 1, spark: 0.4, sparkAt: 1, chips: 0.4, chipsAt: 1, dust: 0.4, dustAt: 1, sun: 1.8 } }),
    // recover: hauled back a step at a time
    { ...beat(90, { hip: { x: 3, y: 1, tilt: 0 }, lean: 0.1, props: { shield: planted([5, 0]) }, fx: { lid: 1, eye: 1.5, padX: 1, tilt: 2, dent: 1, dentAt: 1, spark: 0.7, sparkAt: 1, chips: 0.7, chipsAt: 1, dust: 0.65, dustAt: 1, sun: 1.5 } }), name: 'recover' },
    beat(100, { hip: { x: 2, y: 1, tilt: 0 }, lean: 0.06, props: { shield: planted([3, 0]) }, fx: { eye: 1.3, padX: 1, tilt: 1, spark: 0.95, sparkAt: 1, chips: 0.9, chipsAt: 1, dust: 0.9, dustAt: 1, sun: 1.2 } }),
    beat(110, { hip: { x: 1, y: 0, tilt: 0 }, lean: 0.03, props: { shield: planted([1, 0]) }, fx: { eye: 1.1, tilt: 1, sun: 0.9 } }),
  ],
  end: 'idle0',
  endMs: 150,
};

// ------------------------------------------------------------------ roar: the war-cry (the slab rattles)
//
// Not the sentinel's single slam and raised fist: the giant heaves the slab up out of the dirt (the grit
// falls), holds it high with the eyes blazing wide, drops it onto the floor (dust rolls out both ways,
// steel sparks off the foot, the rim flares), and then, braced behind it, ROARS: the whole slab vibrates,
// leaning a pixel out and a pixel in on every frame, the tower windows blazing and the rag cracking like
// a whip, until the sound has gone out of it.

const roar: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    { ...beat(90, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.03, fx: { lid: 2, eye: 1.3, padY: 1, sun: 1.2, dust: 0.1, dustAt: 0 } }), name: 'charge' },
    // heave: the slab up out of the dirt, the body rising under it
    beat(130, { hip: { x: 0, y: 0, tilt: 0 }, props: { shield: planted([0, -3]) }, fx: { lid: 1, eye: 1.6, padY: -1, tilt: 0, sun: 1.5, dust: 0.3, dustAt: 0, chips: 0.1, chipsAt: 2 } }),
    // held high: the longest beat, the eyes wide, the rag lifting
    beat(180, { hip: { x: -1, y: -1, tilt: 0 }, lean: -0.06, props: { shield: planted([0, -6]) }, fx: { lid: 0, eye: 2, padY: -2, tilt: 1, sun: 2, glint: 0.5, rag: 1.8, dust: 0.5, dustAt: 0, chips: 0.4, chipsAt: 2 } }),
    // the drop begins near the top: 2 px, then the floor (heavy)
    beat(45, { hip: { x: 0, y: 1, tilt: 0 }, props: { shield: planted([0, -3]) }, fx: { lid: 0, eye: 2, padY: 0, tilt: 0, sun: 2, rag: 1.8, dust: 0.7, dustAt: 0 } }),
    // IMPACT: planted hard, the rim flares, sparks off the foot, dust both ways
    { ...beat(60, { hip: { x: 1, y: 2, tilt: 0 }, lean: 0.06, props: { shield: planted([0, 1]) }, fx: { lid: 1, eye: 2, padY: 1, tilt: 0, bash: 1, sun: 2, spark: 0.1, sparkAt: 2, dust: 0.2, dustAt: 0, chips: 0.2, chipsAt: 2, rag: 1 } }), name: 'release' },
    // the roar: braced behind it, the slab vibrating — out a pixel…
    beat(75, { hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, props: { shield: planted() }, fx: { lid: 0, eye: 2, padY: -1, tilt: 1, bash: 0.3, sun: 2, spark: 0.4, sparkAt: 2, dust: 0.4, dustAt: 0, rag: 2, glint: 0.8, arrow: 1 } }),
    // …in a pixel…
    beat(75, { hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, props: { shield: planted() }, fx: { lid: 0, eye: 2, padY: -1, tilt: -1, sun: 2, spark: 0.65, sparkAt: 2, dust: 0.6, dustAt: 0, rag: 2, arrow: -1 } }),
    beat(75, { hip: { x: 0, y: -1, tilt: 0 }, lean: -0.05, props: { shield: planted() }, fx: { lid: 0, eye: 2, padY: -2, tilt: 1, sun: 2, spark: 0.85, sparkAt: 2, dust: 0.8, dustAt: 0, rag: 1.8, arrow: 1 } }),
    // …until the sound has gone out of it
    { ...beat(100, { hip: { x: 0, y: 0, tilt: 0 }, props: { shield: planted() }, fx: { lid: 1, eye: 1.6, padY: -1, tilt: 0, sun: 1.5, spark: 0.97, sparkAt: 2, dust: 0.95, dustAt: 0, rag: 1.4 } }), name: 'recover' },
    beat(120, { fx: { eye: 1.3, padY: 0, sun: 1, rag: 1 } }),
    beat(140, { fx: { eye: 1.1, sun: 0.7 } }),
  ],
  end: 'idle0',
  endMs: 150,
};

// ================================================================== part 2: the extras

/** The heavy struck pose (hitHeavy f0 = death f0, HA-24): the slab driven hard back, the lid slammed, a deep dent. */
const HEAVY_STRUCK: D = { fx: { dent: 2, dentAt: 0, spark: 0.15, sparkAt: 0, lid: 3, arrow: -1, bash: 1, chips: 0.15, chipsAt: 0 } };

// ------------------------------------------------------------------ hitHeavy: driven back a step
const hitHeavy: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['propF', 'head', 'extra'] },
  beats: [
    struck(50, HEAVY_STRUCK),
    beat(60, { props: { shield: planted([-3, -1]) }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.08, fx: { dent: 2, dentAt: 0, spark: 0.4, sparkAt: 0, tilt: -2, padX: -1, lid: 3, arrow: 1, chips: 0.35, chipsAt: 0 } }),
    beat(80, { props: { shield: planted([-3, 0]) }, footN: { step: [-2, 0], lift: 2 }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.1, fx: { dent: 2, dentAt: 0, spark: 0.7, sparkAt: 0, tilt: -2, padX: -1, padY: 1, lid: 3, arrow: -1, chips: 0.65, chipsAt: 0, fingY: 1 } }),
    beat(90, { props: { shield: planted([-2, 0]) }, footN: { step: [-2, 0], lift: 0 }, hip: { x: -2, y: 2, tilt: 0 }, lean: -0.06, fx: { dent: 2, dentAt: 0, spark: 0.95, sparkAt: 0, tilt: -1, padY: 1, lid: 2, chips: 0.9, chipsAt: 0, dust: 0.3, dustAt: 2, fingY: 1 } }),
    beat(110, { props: { shield: planted([-1, 0]) }, footN: { step: [-2, 0], lift: 0 }, hip: { x: -1, y: 1, tilt: 0 }, lean: 0.02, fx: { dent: 2, dentAt: 0, tilt: 0, lid: 1, eye: 1.2, dust: 0.6, dustAt: 2 } }, 'recover'),
    beat(110, { props: { shield: planted() }, footN: { step: [-1, 0], lift: 2 }, hip: { x: 0, y: 0, tilt: 0 }, lean: 0.03, fx: { dent: 1, dentAt: 0, dust: 0.85, dustAt: 2 } }),
    beat(120, { props: { shield: planted() }, hip: { x: 0, y: 1, tilt: 0 }, lean: 0.01, fx: { dent: 1, dentAt: 0, fingY: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ hitMagic: the spell runs through the plate
const hitMagic: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    struck(50, { fx: { flare: 1, eye: 2, lid: 0, sun: 2, bash: 0.7, tilt: 1 } }),
    beat(60, { hip: { x: 0, y: -1, tilt: 0 }, fx: { flare: 0.8, eye: 2, lid: 0, sun: 2, bash: 0.5, tilt: -1, padY: -1, arrow: 1 } }),
    beat(70, { hip: { x: 0, y: -1, tilt: 0 }, fx: { flare: 0.5, eye: 2, lid: 0, sun: 2, tilt: 1, padY: -1, padX: 1, arrow: -1 } }),
    beat(70, { hip: { x: 0, y: -1, tilt: 0 }, fx: { flare: 0.4, eye: 1.8, lid: 1, sun: 1.8, tilt: -1, padY: -1, padX: -1, arrow: 1 } }),
    beat(100, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.03, fx: { flare: 0, eye: 0.6, lid: 2, sun: 0.7, tilt: 0, padY: 1, arrow: 0, fingY: 1 } }, 'recover'),
    beat(110, { hip: { x: 0, y: 1, tilt: 0 }, fx: { eye: 0.8, lid: 2, sun: 0.6, padY: 1, fingY: 1 } }),
    beat(120, { fx: { eye: 0.9, lid: 1, sun: 0.5, padY: 0 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ death: the plates give
//
// From the heavy struck pose it reels back; the light leaves the eyes and the tower; cracks run across the
// face from the crest; the giant's grip fails (the gauntlet slides down the rim, the pauldron droops), the
// slab leans out under its own weight and then comes apart into its plates, which fall; behind it the
// giant is a slumped hulk. The last frame is the heap of plates on the floor (the death kit breaks it
// after the last frame).
const DEAD: D = { hip: { x: 1, y: 4, tilt: 0 }, lean: 0.1, fx: { eye: 0, lid: 3, sun: 0, rag: 0.4 } };
const death: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['propF', 'head', 'extra'] },
  beats: [
    struck(60, HEAVY_STRUCK),
    beat(80, { props: { shield: planted([-2, 0]) }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.08, fx: { dent: 2, dentAt: 0, lid: 3, eye: 0.1, sun: 0.2, tilt: -2, crack: 0.3, spark: 0.5, sparkAt: 0, chips: 0.4, chipsAt: 0, arrow: 1 } }),
    beat(110, { props: { shield: planted([-1, 0]) }, hip: { x: 0, y: 2, tilt: 0 }, lean: 0.03, fx: { dent: 2, dentAt: 0, lid: 3, eye: 0, sun: 0, tilt: -1, crack: 0.65, padY: 1, limp: 0.2, chips: 0.8, chipsAt: 0, rag: 0.6 } }),
    beat(80, { props: { shield: planted([0, 0]) }, hip: { x: 0, y: 3, tilt: 0 }, lean: 0.07, fx: { dent: 2, dentAt: 0, lid: 3, eye: 0, sun: 0, tilt: 1, crack: 1, padY: 2, limp: 0.5, chips: 1, chipsAt: 0, rag: 0.4, fingY: 2 } }),
    // the slab leans out under its own weight (the grip gone)
    { ...beat(70, { ...DEAD, props: { shield: planted([1, 0]) }, fx: { ...DEAD.fx, dent: 2, dentAt: 0, tilt: 3, crack: 1, padY: 3, limp: 0.8, fingY: 3, plates: 0.08, dust: 0.2, dustAt: 0, dustTone: 1 } }), name: 'dissolve' },
    beat(60, { ...DEAD, props: { shield: planted([2, 1]) }, fx: { ...DEAD.fx, tilt: 4, crack: 1, padY: 4, limp: 1, fingY: 4, plates: 0.22, dust: 0.35, dustAt: 0, dustTone: 1 } }),
    beat(60, { ...DEAD, props: { shield: planted([2, 2]) }, fx: { ...DEAD.fx, tilt: 5, crack: 1, padY: 5, limp: 1, fingY: 5, plates: 0.42, dust: 0.5, dustAt: 0, dustTone: 1 } }),
    beat(60, { ...DEAD, props: { shield: planted([2, 2]) }, fx: { ...DEAD.fx, tilt: 5, crack: 1, padY: 6, limp: 1, fingY: 6, plates: 0.64, dust: 0.65, dustAt: 0, dustTone: 1 } }),
    beat(70, { ...DEAD, props: { shield: planted([2, 2]) }, fx: { ...DEAD.fx, tilt: 5, crack: 1, padY: 6, limp: 1, fingY: 6, plates: 0.84, dust: 0.8, dustAt: 0, dustTone: 1 } }),
    beat(110, { ...DEAD, props: { shield: planted([2, 2]) }, fx: { ...DEAD.fx, tilt: 5, crack: 1, padY: 6, limp: 1, fingY: 6, plates: 1, dust: 0.95, dustAt: 0, dustTone: 1 } }),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ summon: the slab heaved up out of the floor
//
// The tile cracks open and the slab is heaved up out of it, plain and dark — the giant rising under it, only
// the crown and the rag showing first — until it stands clear on the pit's lip; it drops the last pixels onto
// the floor (the dust rolls out, the rim flares); the pauldron and the gauntlet clamp on, a pixel at a
// time; the eyes light in the slot, left then right, and the tower's windows last.
const summon: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(60, { fx: { rise: 60, pit: 0.8, eye: 0, lid: 3, sun: 0, rag: 0, dust: 0.1, dustAt: 0, dustTone: 0 } }),
    beat(70, { fx: { rise: 44, pit: 0.95, eye: 0, lid: 3, sun: 0, rag: 0.5, dust: 0.25, dustAt: 0 } }),
    beat(60, { fx: { rise: 28, pit: 1, eye: 0, lid: 3, sun: 0, rag: 1, dust: 0.45, dustAt: 0 } }),
    beat(60, { fx: { rise: 14, pit: 1, eye: 0, lid: 3, sun: 0, rag: 1.4, dust: 0.65, dustAt: 0 } }),
    beat(100, { fx: { rise: 5, pit: 1.05, eye: 0, lid: 3, sun: 0, rag: 1.5, dust: 0.85, dustAt: 0 } }),
    // the slab drops its last pixels: impact
    { ...beat(70, { hip: { x: 0, y: 1, tilt: 0 }, fx: { rise: 0, pit: 1.2, eye: 0, lid: 3, sun: 0, bash: 0.8, spark: 0.1, sparkAt: 2, dust: 0.2, dustAt: 0, chips: 0.15, chipsAt: 2, rag: 1, padY: 2 } }), name: 'land' },
    beat(80, { hip: { x: 0, y: 0, tilt: 0 }, fx: { rise: 0, pit: 1.4, eye: 0, lid: 3, sun: 0, tilt: -1, spark: 0.45, sparkAt: 2, dust: 0.45, dustAt: 0, chips: 0.5, chipsAt: 2, padY: 1 } }),
    beat(70, { fx: { rise: 0, pit: 1.7, eye: 0, lid: 3, sun: 0, tilt: 0, spark: 0.8, sparkAt: 2, dust: 0.75, dustAt: 0, padY: 0, fingY: 1 } }),
    // the eyes: the left, then both; the tower's windows after them
    beat(70, { fx: { pit: 1.9, eye: 0.6, lid: 3, sun: 0, dust: 0.95, dustAt: 0 } }),
    beat(80, { fx: { eye: 1.2, lid: 2, sun: 0.4, glint: 0.3 } }),
    beat(100, { fx: { eye: 2, lid: 0, sun: 1.4, glint: 0.7 } }),
    beat(60, { fx: { eye: 1.4, lid: 1, sun: 1, rag: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ revive: the plates fly back
//
// Not the summon: the giant comes back out of its own wreck. The heap the death left lies on the floor, the
// cracks still dark; the plates fly back up the paths they fell along into the slab (the pauldron heaving
// back up, the gauntlet finding the rim), the cracks closing; it stands whole (land), then the tower's
// windows kindle and the eyes last.
const HEAP: D = { ...DEAD, props: { shield: planted([2, 2]) }, fx: { ...DEAD.fx, tilt: 5, crack: 1, padY: 6, limp: 1, fingY: 6, plates: 1 } };
const revive: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(100, { ...HEAP }),
    beat(80, { ...HEAP, fx: { ...HEAP.fx, plates: 0.8 } }),
    beat(70, { ...HEAP, fx: { ...HEAP.fx, plates: 0.58, tilt: 5, padY: 5, fingY: 5 } }),
    beat(60, { ...DEAD, props: { shield: planted([2, 1]) }, fx: { ...DEAD.fx, tilt: 4, crack: 1, padY: 4, limp: 0.8, fingY: 4, plates: 0.36 } }),
    beat(60, { ...DEAD, props: { shield: planted([1, 1]) }, fx: { ...DEAD.fx, tilt: 3, crack: 0.7, padY: 3, limp: 0.5, fingY: 3, plates: 0.16 } }),
    beat(70, { hip: { x: 0, y: 3, tilt: 0 }, lean: 0.07, props: { shield: planted([1, 0]) }, fx: { eye: 0, lid: 3, sun: 0, tilt: 2, crack: 0.4, padY: 2, limp: 0.2, fingY: 2, plates: 0.04, rag: 0.8 } }),
    { ...beat(90, { hip: { x: 0, y: 1, tilt: 0 }, props: { shield: planted() }, fx: { eye: 0, lid: 3, sun: 0, tilt: 0, crack: 0.15, padY: 1, plates: 0, bash: 0.5, dust: 0.2, dustAt: 0, rag: 1 } }), name: 'land' },
    beat(90, { fx: { eye: 0, lid: 3, sun: 0.7, crack: 0, dust: 0.5, dustAt: 0 } }),
    beat(80, { fx: { eye: 0.7, lid: 3, sun: 1.3, dust: 0.8, dustAt: 0 } }),
    beat(80, { fx: { eye: 1.2, lid: 2, sun: 1.4, glint: 0.4 } }),
    beat(110, { fx: { eye: 2, lid: 0, sun: 1.6, glint: 0.8 } }),
    beat(120, { breath: 1, fx: { eye: 1.3, lid: 1, sun: 1, padY: -1 } }),
    beat(130, { fx: { eye: 1.1, sun: 0.6 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ toGuard / fromGuard
const toGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(60, { props: { shield: planted([0, -1]) }, hip: { x: 0, y: 1, tilt: 0 }, fx: { lid: 2, tilt: 0, sun: 0.9 } }),
    beat(70, { props: { shield: planted([0, -2]) }, hip: { x: 0, y: 2, tilt: 0 }, lean: 0.05, fx: { lid: 2, eye: 1.2, tilt: 1, sun: 1.3, padY: 1 } }),
    beat(60, { props: { shield: planted([0, 1]) }, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.1, fx: { lid: 2, eye: 1.4, tilt: 3, sun: 2, padY: 1, spark: 0.1, sparkAt: 2, dust: 0.15, dustAt: 0, bash: 0.35 } }),
    beat(80, { props: { shield: planted([0, 1]) }, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.1, fx: { lid: 2, eye: 1.4, tilt: 2, sun: 1.4, padY: 1, spark: 0.45, sparkAt: 2, dust: 0.4, dustAt: 0 } }),
  ],
  end: 'guard0',
  endMs: 90,
};

const fromGuard: AnimDef<Pose> = {
  base: 'guard0',
  beats: [
    beat(70, { props: { shield: planted([0, 0]) }, hip: { x: 1, y: 2, tilt: 0 }, lean: 0.08, fx: { lid: 2, tilt: 2, sun: 1, padY: 0 } }),
    beat(70, { props: { shield: planted([0, -1]) }, hip: { x: 0, y: 1, tilt: 0 }, lean: 0.04, fx: { lid: 2, eye: 1.2, tilt: 1, sun: 0.8, padY: 0 } }),
    beat(70, { props: { shield: planted() }, hip: { x: 0, y: 0, tilt: 0 }, lean: 0.01, fx: { lid: 1, eye: 1, tilt: 0, sun: 0.6, padY: 0 } }),
    beat(80, { props: { shield: planted() }, hip: { x: 0, y: 0, tilt: 0 }, lean: 0, fx: { lid: 1, eye: 1, tilt: 0, sun: 0.5, padY: 1, fingY: 1 } }),
  ],
  end: 'idle0',
  endMs: 90,
};

// ------------------------------------------------------------------ victory: the wall stands
//
// The giant rises to its full height behind the slab, heaves it clear of the dirt and plants it with a
// thud, twice (the second one harder: the tower's windows blaze, the rim flares, the dust rolls out), then
// holds it there, the eyes wide and steady.
const victory: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(100, { hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, fx: { lid: 1, eye: 1.3, padY: -1, sun: 1.2 } }),
    beat(90, { props: { shield: planted([0, -3]) }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.04, fx: { lid: 0, eye: 1.6, padY: -2, sun: 1.5, tilt: 1, dust: 0.2, dustAt: 0 } }),
    beat(60, { props: { shield: planted([0, 1]) }, hip: { x: 0, y: 0, tilt: 0 }, fx: { lid: 0, eye: 1.8, padY: 0, sun: 1.8, bash: 0.6, spark: 0.1, sparkAt: 2, dust: 0.3, dustAt: 0, tilt: 0 } }),
    beat(100, { props: { shield: planted([0, -4]) }, hip: { x: 0, y: -2, tilt: 0 }, lean: -0.05, fx: { lid: 0, eye: 2, padY: -2, sun: 2, tilt: 1, spark: 0.5, sparkAt: 2, dust: 0.55, dustAt: 0, glint: 0.4 } }),
    beat(60, { props: { shield: planted([0, 1]) }, hip: { x: 0, y: 0, tilt: 0 }, fx: { lid: 0, eye: 2, padY: 0, sun: 2, bash: 1, spark: 0.1, sparkAt: 2, dust: 0.2, dustAt: 0, tilt: 0, rag: 1.8 } }),
    beat(110, { props: { shield: planted() }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.02, fx: { lid: 0, eye: 2, padY: -1, sun: 2, spark: 0.45, sparkAt: 2, dust: 0.5, dustAt: 0, glint: 0.7, rag: 1.5 } }),
    beat(130, { props: { shield: planted() }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, fx: { lid: 0, eye: 1.8, padY: -1, sun: 1.9, spark: 0.8, sparkAt: 2, dust: 0.85, dustAt: 0, rag: 1.2 } }),
    beat(400, { props: { shield: planted() }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, fx: { lid: 1, eye: 1.7, padY: -1, sun: 1.8, rag: 1.1 } }),
  ],
  end: 'hold',
};

export const ANIMS: AnimDefs<Pose> = {
  idle,
  guard,
  attack,
  roar,
  hit,
  hitHeavy,
  hitMagic,
  death,
  summon,
  revive,
  toGuard,
  fromGuard,
  victory,
};
