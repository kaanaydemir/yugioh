// Kristal Ejder v3 — the five base animations as poses of the restyled rig, with per-frame holds,
// marks and points (docs/ANIMASYON_PLANI.md §4; weight class mediumHeavy: long anticipation,
// short impact frames, readable recoveries; feet stay planted — the legs reach them by IK).
//
// Every one-shot ends on (or within a pixel or two of) idle frame 0, so idle ↔ attack ↔ hit ↔
// idle never pops; the loops (idle, guard) close on themselves.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { glintPixelFor, legs, lerpPose, mouthPoint, pose, rig, type Pose, type PoseDelta, type Wing } from './ashen_drake-rig';
import { LIGHT, OX, OY, add, polar, rnd, type V } from './ashen_drake-gbuf';

const TAU = Math.PI * 2;
const sin = Math.sin;

// ------------------------------------------------------------------ idle (20 frames, 2.0 s)
//
// Three overlapping rhythms that never line up into a dead loop:
//   body  — two breaths per loop (period 10): the hip sinks 1 px on the exhale and the knees take
//           the weight (planted feet, IK); the step ripples on: the head and the near wing's hand
//           follow it a frame later, the far hand and the tail tip two frames later (the upper body
//           never steps as one block);
//   wings — follow the breath one, two, three frames late (shoulder → forearm → finger tips) and
//           the membranes billow later still (scallop depth), the far wing a frame behind the near;
//   head  — rides the breath 1.5 frames late, plus a slow sway once per loop;
//   tail  — one slow traveling wave per loop (period 20);
// a blink once per loop and one glint on the near wing's wrist knuckle.

const IDLE_N = 20;
// the one glint of the loop: the near wing's wrist knuckle (a facet vertex on the lit leading
// edge) on the three frames it stands still (f2–f4): 1 px → a 3-px cross → 1 px
const IDLE_SPARKS: Record<number, [number, number][]> = { 2: [[0, 1]], 3: [[0, 2]], 4: [[0, 1]] };

/** The 1-px body sink of the breath (frames 4–7 and 14–17: it leads the exhale a little, and idle
 *  f0 sits two frames into a rest plateau, so the lagging parts are at rest there too). */
function idleDip(f: number): number {
  const g = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  return (g >= 4 && g <= 7) || (g >= 14 && g <= 17) ? 1 : 0;
}

export function idlePose(f: number): Pose {
  const t = (((f % IDLE_N) + IDLE_N) % IDLE_N) / IDLE_N;
  const br = (lag: number) => sin(2 * TAU * t - lag); // breath (period 10 frames)
  const rel = (lag: number) => br(lag) - sin(-lag);
  const b = br(0);
  const blink = f === 15 ? 0.5 : f === 16 ? 0 : f === 17 ? 0.5 : 1;
  // the hip sinks 1 px on the exhale; nothing on the body rotates by a fraction of a pixel (that
  // would make the shading crawl) — parts either move together or hold still. The step ripples
  // through the body (overlap): the head (and with it the upper neck) and the near wing's hand
  // follow it one frame late, the far wing's hand and the tail tip two frames late.
  const dip = idleDip(f);
  const late = (n: number) => idleDip(f - n) - dip;
  return pose({
    hy: dip,
    lean: 0,
    tailLag: [late(1), late(2)],
    headY: -1 + Math.round(-0.65 * br(0.94) - 0.1) + late(1),
    headX: Math.round(0.7 * sin(TAU * t + 0.5) - 0.2),
    // (the extra lags are measured from frame 0, so frame 0 stays the approved still's pose)
    nw: { a1: -108 - 4 * b, a2: -138 - 3.5 * br(Math.PI / 6), a3: -118 - 4 * br(Math.PI / 3), scal: 1 + 0.1 * rel(1.6), lag: late(1) },
    fw: { a1: -84 - 4 * rel(0.35), a2: -108 - 4 * rel(Math.PI / 6 + 0.35), a3: -87.67 - 5 * rel(Math.PI / 3 + 0.35), scal: 1 + 0.1 * rel(2), lag: late(2) },
    tail: t,
    tailAmp: 4,
    arm: br(1.2) > 0.3 ? 3 : 0,
    armF: br(1.8) > 0.3 ? -2 : 0,
    glow: 0.3 + 0.15 * br(0.6),
    eye: blink,
    sparkles: IDLE_SPARKS[f] ?? [],
  });
}

const IDLE_HOLDS = Array.from({ length: IDLE_N }, (_, f) => (f === 16 ? 80 : 100));

// ------------------------------------------------------------------ guard (8 frames, 1.3 s)
//
// Crouched behind the wings wrapped forward, breathing. One part moves per frame, so the breath
// travels through the body instead of the whole crouch hopping: the wrapped membrane fills (a 1-px
// bulge of its scallops), the chest and thighs sink 1 px (the knees take it; the tail's middle and
// tip follow a frame and two later), the wrapped wings settle onto the chest a frame later, the
// head a frame after them; the membrane flattens; then the chest rises, the wings, the head. One
// glint on the shield's peak (the wrapped wing's elbow) while the wings are down (they stand still there).

const GUARD_N = 8;
// per frame: chest / thigh dip, wrapped-wing dip, head dip (px), membrane bulge (0/1)
const G_CHEST = [0, 0, 1, 1, 1, 1, 0, 0];
const G_WING = [0, 0, 0, 1, 1, 1, 1, 0];
const G_HEAD = [0, 0, 0, 0, 1, 1, 1, 1];
const G_BULGE = [0, 1, 1, 1, 1, 0, 0, 0];
const G_SPARKS: Record<number, [number, number][]> = { 4: [[1, 1]], 5: [[1, 2]], 6: [[1, 1]] };

export function guardPose(f: number): Pose {
  const g = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const at = (a: number[], n: number) => a[(((g - n) % GUARD_N) + GUARD_N) % GUARD_N];
  const c = at(G_CHEST, 0);
  const t = g / GUARD_N;
  return pose({
    guard: true,
    hy: 3 + c,
    lean: 0.16,
    headX: -3,
    headY: 12 + at(G_HEAD, 0) - c,
    ha: 0.34,
    wingDy: at(G_WING, 0) - c,
    tailLag: [at(G_CHEST, 1) - c, at(G_CHEST, 2) - c],
    nw: { a1: -64, a2: 40, a3: 76, fan: 21, scal: G_BULGE[g] ? 1.22 : 0.98 },
    fw: { a1: -50, a2: 60, a3: 85, fan: 15, scal: G_BULGE[g] ? 1.16 : 0.98 },
    tailLift: -14,
    tailAmp: 2.5,
    tail: t + 0.1,
    arm: 24,
    glow: 0.4,
    sparkles: G_SPARKS[g] ?? [],
  });
}

const GUARD_HOLDS = [180, 150, 140, 160, 180, 150, 140, 160];

// ------------------------------------------------------------------ roar (12 frames)
//
// gather (crouch, head down, wings tucked: long) → explode upward (in-between, then the full rear
// with the wings flung open) → trembling roar (short frames) → the far wing folds back through
// in-betweens → settle on idle f0.

// the far wing flung open to the side BELOW the line of the open jaws (a strip of floor between
// the lower jaw and its leading edge, so the jaw silhouette never merges into the dark membrane)
const FW_SPREAD: Partial<Wing> = { a1: -29, a2: 6, a3: -36, fan: 29, span: 1.3, at: [7, 3] };
const NW_SPREAD: Partial<Wing> = { a1: -120, a2: -144, a3: -110, fan: -46, span: 1.05 };

const ROAR_KEYS: PoseDelta[] = [
  // 0 leaving idle: weight drops
  { hy: 0, lean: 0.02, headY: 0, ha: 0.16, nw: { a1: -106, a2: -135, a3: -119, scal: 0.96 }, fw: { a1: -86, a2: -111 }, tailLift: -1, arm: -2, glow: 0.35 },
  // 1 gather: crouch, head down, wings fold in
  { hy: 2, lean: 0.07, headY: 4, ha: 0.4, nw: { a1: -100, a2: -122, a3: -128, fan: -26, scal: 0.85 }, fw: { a1: -92, a2: -116, a3: -100, fan: -20 }, tailLift: -5, arm: -6, glow: 0.45, tail: 0.05 },
  // 2 deepest crouch (held: the coil)
  { hy: 3, lean: 0.12, headX: -1, headY: 7, ha: 0.55, nw: { a1: -96, a2: -118, a3: -132, fan: -22, scal: 0.8 }, fw: { a1: -94, a2: -118, a3: -104, fan: -18 }, tailLift: -8, arm: -12, glow: 0.6, eye: 0.5, tail: 0.08 },
  // 3 explode: in-between on the way up (the head leads, the wings lag)
  { hy: 0, lean: -0.22, headX: -4, headY: 4, ha: -0.35, jaw: 0.3, nw: { a1: -112, a2: -132, a3: -122, fan: -36, scal: 0.9 }, fw: { a1: -52, a2: -36, a3: -60, fan: 14, span: 1.15, at: [3, 0] }, tailLift: 6, arm: 30, glow: 0.85, tail: 0.1 },
  // 4 full rear: chest high, head thrown back, jaws wide, both wings flung open
  { hy: -2, lean: -0.47, headX: -7, headY: 3, ha: -0.82, jaw: 0.75, nw: { ...NW_SPREAD, a1: -124, fan: -49, scal: 1.15 }, fw: { ...FW_SPREAD, a1: -33 }, tailLift: 16, arm: 62, glow: 1, tail: 0.14 },
  // 5–7 the roar trembles (short frames, 1 px); the one glint rides the near wrist knuckle
  { hx: 1, hy: -1, lean: -0.43, headX: -6, headY: 2, ha: -0.8, jaw: 0.85, nw: { ...NW_SPREAD, scal: 1.08 }, fw: FW_SPREAD, tailLift: 14, arm: 56, glow: 1, tail: 0.22, sparkles: [[0, 1]] },
  { hx: 0, hy: -1, lean: -0.44, headX: -7, headY: 2, ha: -0.83, jaw: 0.78, nw: { ...NW_SPREAD, a1: -118, scal: 1.0 }, fw: { ...FW_SPREAD, a1: -27 }, tailLift: 14, arm: 58, glow: 0.85, tail: 0.3, sparkles: [[0, 2]] },
  { hx: 1, hy: -1, lean: -0.42, headX: -6, headY: 2, ha: -0.8, jaw: 0.84, nw: { ...NW_SPREAD, scal: 1.06 }, fw: FW_SPREAD, tailLift: 13, arm: 55, glow: 1, tail: 0.38, sparkles: [[0, 1]] },
  // 8 release: the head comes down first, the far wing starts to fold (still low, under the jaw)
  { hx: 0, hy: -1, lean: -0.32, headX: -5, headY: 2, ha: -0.55, jaw: 0.55, nw: { a1: -116, a2: -142, a3: -112, fan: -44 }, fw: { a1: -36, a2: 8, a3: -30, fan: 22, span: 1.2, at: [6, 2] }, tailLift: 11, arm: 42, glow: 0.8, tail: 0.46 },
  // 9 folding through
  { hy: 0, lean: -0.15, headX: -2, headY: 1, ha: -0.18, jaw: 0.3, nw: { a1: -111, a2: -140, a3: -115, fan: -41 }, fw: { a1: -72, a2: -88, a3: -88, fan: -24, span: 1.05, at: [1, -2] }, tailLift: 6, arm: 18, glow: 0.6, tail: 0.54 },
  // 10 almost home (the tail still swings)
  { hy: 0, lean: -0.04, headY: 0, ha: 0.06, jaw: 0.08, nw: { a1: -108, a2: -138 }, fw: { a1: -80, a2: -100, a3: -90, fan: -20 }, tailLift: 2, arm: 4, glow: 0.4, tail: 0.6 },
  // 11 = idle f0 (tail phase carried on)
  {},
];
const ROAR_HOLDS = [70, 110, 160, 60, 110, 70, 70, 80, 100, 100, 110, 120];

// ------------------------------------------------------------------ attack: Prism Breath (13 frames)
//
// charge  — the weight shifts back onto the haunches (hip back + down, knees bend), the neck coils
//           into an S with the head drawn back and up, the wings sweep back and rise, the tail
//           lifts as counterweight, light gathers between the lips and swells behind the keel;
// release — the head whips forward past neutral, the jaws are flung open (beam from the mouth),
//           the chest drops in, the wings snap back, the tail whips down (smear on the head);
// contact — the beam reaches the target; the chest pulses (keel light) while the beam pushes the
//           head back a pixel at a time, the wings flare and settle;
// recover — the jaws close, the head rises home, the tail overshoots, settle on idle f0.

const S_COIL: [number, number][] = [[6, -2], [-8, 3]];

const ATTACK_KEYS: PoseDelta[] = [
  // 0 leaving idle
  { hx: 0, hy: 0, lean: -0.02, headX: -1, headY: -1, ha: 0.06, nw: { a1: -110, a2: -140 }, glow: 0.35, mouth: 0.1, tail: 0.02 },
  // 1 [charge] weight back: hip back/down, the neck starts its S, wings rise
  { hx: -1, hy: 1, lean: -0.07, headX: -5, headY: -1, ha: -0.05, nk1: [2, 0], nk2: [-2, 1], nw: { a1: -114, a2: -146, a3: -114, fan: -44, scal: 0.92 }, fw: { a1: -88, a2: -114 }, glow: 0.5, mouth: 0.3, pulse: 0.1, tailLift: 4, arm: 8, armF: 2, tail: 0.04 },
  // 2 coil deepens
  { hx: -2, hy: 2, lean: -0.13, headX: -8, headY: -2, ha: -0.16, nk1: [4, -1], nk2: [-5, 2], nw: { a1: -120, a2: -151, a3: -108, fan: -48, scal: 0.86 }, fw: { a1: -92, a2: -118, a3: -88 }, glow: 0.7, mouth: 0.55, pulse: 0.3, tailLift: 8, arm: 16, armF: 4, tail: 0.06 },
  // 3 full coil (held): S-curve, head back and up, wings fully back
  { hx: -3, hy: 2, lean: -0.19, headX: -11, headY: -3, ha: -0.27, jaw: 0.1, nk1: S_COIL[0], nk2: S_COIL[1], nw: { a1: -124, a2: -156, a3: -104, fan: -51, scal: 0.82 }, fw: { a1: -95, a2: -121, a3: -86 }, glow: 0.9, mouth: 0.85, pulse: 0.6, tailLift: 11, arm: 22, armF: 6, tail: 0.08 },
  // 4 trembling at the top of the charge (1 px), light at its fullest
  { hx: -3, hy: 2, lean: -0.2, headX: -12, headY: -4, ha: -0.3, jaw: 0.16, nk1: [6, -2], nk2: [-9, 3], nw: { a1: -125, a2: -157, a3: -102, fan: -52, scal: 0.8 }, fw: { a1: -96, a2: -122, a3: -85 }, glow: 1, mouth: 1, pulse: 0.9, tailLift: 12, arm: 25, armF: 6, tail: 0.1 },
  // 5 [impact / release] the lunge: head past neutral, jaws flung open, chest in, wings snap back
  { hx: 1, hy: 1, lean: 0.12, headX: 2, headY: 4, ha: 0.02, jaw: 1, nk1: [-3, 1], nk2: [3, -1], nw: { a1: -132, a2: -167, a3: -112, fan: -46, scal: 0.75 }, fw: { a1: -104, a2: -130, a3: -84, fan: -34 }, glow: 1, mouth: 1, pulse: 1, tailLift: -6, tail: 0.18, tailAmp: 6, arm: -14, armF: -10 },
  // 6 [contact] kickback: the beam pushes the head back 1 px, the wings flare open
  { hx: 1, hy: 1, lean: 0.1, headX: 1, headY: 3, ha: 0.0, jaw: 1, nk1: [-2, 1], nk2: [2, -1], nw: { a1: -125, a2: -157, a3: -98, fan: -53, scal: 1.12 }, fw: { a1: -99, a2: -125, a3: -82, fan: -34 }, glow: 1, mouth: 1, pulse: 0.55, tailLift: -2, tail: 0.28, tailAmp: 5, arm: -9, armF: -6 },
  // 7 sustain (chest pulses)
  { hx: 1, hy: 1, lean: 0.09, headX: 0, headY: 3, ha: 0.01, jaw: 1, nw: { a1: -121, a2: -153, a3: -102, fan: -50, scal: 1.05 }, fw: { a1: -96, a2: -122, a3: -85, fan: -32 }, glow: 1, mouth: 1, pulse: 1, tailLift: -4, tail: 0.36, tailAmp: 5, arm: -7, armF: -5 },
  // 8 sustain
  { hx: 0, hy: 1, lean: 0.08, headX: 0, headY: 2, ha: 0.02, jaw: 0.95, nw: { a1: -118, a2: -150, a3: -105, fan: -48, scal: 1.0 }, fw: { a1: -93, a2: -119, a3: -87, fan: -31 }, glow: 0.95, mouth: 0.95, pulse: 0.55, tailLift: -3, tail: 0.44, tailAmp: 5, arm: -5, armF: -4 },
  // 9 the beam thins: jaws begin to close
  { hx: 0, hy: 1, lean: 0.06, headX: -1, headY: 2, ha: 0.04, jaw: 0.75, nw: { a1: -114, a2: -145, a3: -110, fan: -45 }, fw: { a1: -90, a2: -116 }, glow: 0.8, mouth: 0.6, pulse: 0.3, tailLift: -1, tail: 0.52, tailAmp: 5, arm: -3, armF: -2 },
  // 10 [recover] jaws close, the head rises, the tail overshoots
  { hx: 0, hy: 0, lean: 0.03, headX: -1, headY: 1, ha: 0.07, jaw: 0.35, nw: { a1: -111, a2: -141, a3: -115 }, fw: { a1: -87, a2: -112 }, glow: 0.6, mouth: 0.25, pulse: 0.1, tailLift: 3, tail: 0.6, arm: 0 },
  // 11 almost home
  { hy: 0, lean: 0.01, headX: 0, headY: 0, ha: 0.09, jaw: 0.08, nw: { a1: -109, a2: -139 }, glow: 0.4, tailLift: 1, tail: 0.66 },
  // 12 = idle f0
  {},
];
export const IMPACT = 5;
const ATTACK_HOLDS = [60, 90, 100, 160, 110, 70, 90, 100, 100, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit (6 frames)
//
// The blow lands on the chest and head. f0 is the struck contact frame — the frame a hit-stop
// holds, so it must read as struck on its own, and only the contact region has moved yet: the head
// snapped back and up from the contact side, jaw jolted open, eyes squeezed shut, the neck
// compressed, the chest knocked back about the hip (under the wings: they have not moved yet), the
// forearms snatched up, the far wing's root clenching, the crest crystals and the keel flaring; the
// hip, legs, tail and near wing still hold the idle pose. f1: the rest of the body follows — the
// shoulders hunch, the wing roots clench the wings in, the hip starts back (the in-between of the
// compressed key and the reel), so the reel arcs out of the impact instead of jumping; the hip and
// the wings follow on (wings flinch in), the tail whips last; then a readable recovery.

const HIT_STRUCK: PoseDelta = { chestLean: -0.1, headX: -6, headY: 2, ha: -0.24, jaw: 0.3, eye: 0, nk1: [-2, 1], nk2: [3, 1], fw: { a1: -88, a2: -113, a3: -92, fan: -25 }, arm: 20, armF: 7, pulse: 0.5, crestFlare: 1 };
const HIT_KEYS: PoseDelta[] = [
  // the compressed key (reached by the whole body on f1): head snapped back and in, chest knocked
  // back, wing roots clenched
  { lean: -0.07, headX: -6, headY: 2, ha: -0.24, jaw: 0.3, eye: 0, nk1: [-2, 1], nk2: [3, 1], nw: { a1: -99, a2: -122, a3: -121, fan: -31, scal: 0.78 }, fw: { a1: -93, a2: -119, a3: -97, fan: -21 }, arm: 20, armF: 7, glow: 0.1 },
  // 1 the body follows: hip back, wings flinch in, tail starts
  { hx: -2, hy: 1, lean: -0.16, headX: -6, headY: 1, ha: -0.12, jaw: 0.2, eye: 0, nw: { a1: -98, a2: -122, a3: -116, fan: -32, scal: 0.85 }, fw: { a1: -94, a2: -120, fan: -22 }, tailLift: 3, arm: 22, armF: 8, glow: 0.1, tail: 0.06 },
  // 2 recoil peak in the extremities: wings flare back out, tail whips; the head comes forward
  { hx: -2, hy: 1, lean: -0.1, headX: -3, headY: 2, ha: 0.16, jaw: 0.1, eye: 0.5, nw: { a1: -103, a2: -131, a3: -114, fan: -37, scal: 1.1 }, fw: { a1: -90, a2: -114, fan: -26 }, tailLift: -3, arm: 12, armF: 4, glow: 0.15, tail: 0.14, tailAmp: 5 },
  // 3 recovery
  { hx: -1, hy: 0, lean: -0.03, headX: -1, headY: 0, ha: 0.13, jaw: 0, eye: 1, nw: { a1: -106, a2: -136 }, tailLift: -1, arm: 4, glow: 0.25, tail: 0.2 },
  // 4 = idle f0
  {},
];
const HIT_HOLDS = [60, 50, 70, 90, 110, 120];

// ------------------------------------------------------------------ tables

/** A one-shot key frame: a delta over idle f0 (so the anims start and end on the idle pose). */
const IDLE0 = idlePose(0);
function fromIdle(d: PoseDelta): Pose {
  const p = pose(d);
  // fields the delta does not set keep idle f0's values (head height, wing phase, tail phase)
  const keep = <K extends keyof Pose>(k: K) => (d as Record<string, unknown>)[k] === undefined;
  const out: Pose = { ...p };
  for (const k of ['headY', 'headX', 'tail', 'glow', 'arm', 'armF'] as const) if (keep(k)) (out[k] as number) = IDLE0[k] as number;
  out.nw = { ...IDLE0.nw, ...(d.nw ?? {}) };
  out.fw = { ...IDLE0.fw, ...(d.fw ?? {}) };
  return out;
}

/**
 * A recoil's frames: the struck contact frame (f0: `struck` over idle f0 — only the contact region
 * has moved), then the in-between of the compressed key (keys[0]: the whole body hunched round the
 * blow) and the reel key (f1: the hip, the wings and the tail follow — the body halfway, the wings a
 * little behind it: they are carried on), then the reel keys.
 */
function recoil(struck: PoseDelta, keys: PoseDelta[], mid: PoseDelta = {}): Pose[] {
  const k = keys.map(fromIdle);
  return [fromIdle(struck), mix(k[0], k[1], 0.5, 0.35, mid), ...k.slice(1)];
}

const HIT_P: Pose[] = recoil(HIT_STRUCK, HIT_KEYS, { eye: 0 });

// ================================================================== part 2: the extra anims
//
// Same rig, same rules: every frame is a pose; feet stay planted unless a step lifts one (a foot
// only moves while it is off the ground); one-shots start from a pose next to the one before them
// and end on idle f0 (toGuard: on guard f0); uneven holds — long anticipation, short impact.

const GUARD0 = guardPose(0);

/** A pose with some fields replaced (wings merged). */
function over(p: Pose, d: PoseDelta): Pose {
  return { ...p, ...d, nw: { ...p.nw, ...(d.nw ?? {}) }, fw: { ...p.fw, ...(d.fw ?? {}) } };
}

/** In-between of two poses: the body at t, the wings at wt (they lag or lead), then overrides. */
function mix(a: Pose, b: Pose, t: number, wt: number, d: PoseDelta = {}): Pose {
  const body = lerpPose(a, b, t);
  const w = lerpPose(a, b, wt);
  return over({ ...body, nw: w.nw, fw: w.fw }, d);
}

// ------------------------------------------------------------------ toGuard (7 frames, 390 ms)
//
// anticipation (the wings lift back a little, the weight drops) → the sweep (the wings fold shut
// as they swing forward over the shoulders, the body sinks, the head ducks) → the wrap closes →
// settle 1 px past the crouch with the membranes billowing → guard f0. Feet planted throughout.

const TO_GUARD: Pose[] = [
  // 0 anticipation: the wings lift back and open a little, the weight starts down
  mix(IDLE0, GUARD0, 0.1, 0, { guard: false, nw: { a1: -111, a2: -147, a3: -116, fan: -44 }, fw: { a1: -86, a2: -116, a3: -94, fan: -30 } }),
  // 1 the wings swing up and forward, still open; the body sinks, the head starts down
  mix(IDLE0, GUARD0, 0.3, 0, { guard: false, wrap: 0.2, nw: { a1: -100, a2: -110, a3: -100, fan: -34, scal: 0.85 }, fw: { a1: -80, a2: -92, a3: -82, fan: -24, scal: 0.9 } }),
  // 2 mid-sweep: the forearms come over to ~45°, the fingers trail folded behind them; the head
  //   ducks forward, clear below the wing's edge
  mix(IDLE0, GUARD0, 0.5, 0, { guard: false, wrap: 0.42, headX: 1, headY: 7, ha: 0.24, nw: { a1: -92, a2: -52, a3: -84, fan: 14, span: 0.92, scal: 0.75 }, fw: { a1: -72, a2: -40, a3: -60, fan: 12, scal: 0.85 } }),
  // 3 folding down in front of the chest; the head settles onto the forearm's edge
  mix(IDLE0, GUARD0, 0.72, 0, { guard: false, wrap: 0.72, headX: -2, headY: 10, ha: 0.3, nw: { a1: -76, a2: 4, a3: 50, fan: 16, scal: 0.8 }, fw: { a1: -60, a2: 20, a3: 60, fan: 12, scal: 0.9 } }),
  // 4 the wrap closes
  mix(IDLE0, GUARD0, 0.92, 0.95, { guard: true, nw: { scal: 0.9 } }),
  // 5 settle 1 px past the crouch, the membranes billow
  over(GUARD0, { hy: GUARD0.hy + 1, headY: GUARD0.headY + 1, ha: GUARD0.ha + 0.04, nw: { scal: 1.2 }, fw: { scal: 1.15 } }),
  GUARD0,
];
const TO_GUARD_HOLDS = [40, 50, 50, 50, 60, 70, 70];

// ------------------------------------------------------------------ fromGuard (7 frames, 390 ms)
//
// push-off (1 px deeper, head down) → the wings lift off the front (folded, over the top) → they
// swing up and back, opening, the head leads the body up → nearly home → overshoot (the wings
// flare a little past rest, the membranes billow, the chest lifts) → idle f0.

const FROM_GUARD: Pose[] = [
  // 0 push-off: 1 px deeper, the head down
  over(GUARD0, { hy: GUARD0.hy + 1, headY: GUARD0.headY + 2, ha: GUARD0.ha + 0.06, nw: { scal: 0.9 }, fw: { scal: 0.9 } }),
  // 1 the wings lift off the front (the forearm comes level, the fingers still hang); the head rises
  mix(GUARD0, IDLE0, 0.25, 0, { guard: false, wrap: 0.7, headX: -1, headY: 9, ha: 0.26, nw: { a1: -78, a2: 2, a3: 52, fan: 14, scal: 0.82 }, fw: { a1: -62, a2: 16, a3: 58, fan: 10, scal: 0.9 } }),
  // 2 mid-sweep: the forearms swing up past 45°, the fingers trail folded; the head leads up, clear
  mix(GUARD0, IDLE0, 0.45, 0, { guard: false, wrap: 0.45, headX: 0, headY: 4, ha: 0.18, nw: { a1: -92, a2: -56, a3: -86, fan: 14, span: 0.92, scal: 0.75 }, fw: { a1: -72, a2: -44, a3: -62, fan: 12, scal: 0.85 } }),
  // 3 up and back, opening
  mix(GUARD0, IDLE0, 0.66, 0, { guard: false, wrap: 0.25, nw: { a1: -100, a2: -108, a3: -98, fan: -32, scal: 0.85 }, fw: { a1: -78, a2: -88, a3: -78, fan: -22 } }),
  // 4 nearly home
  mix(GUARD0, IDLE0, 0.9, 0, { guard: false, nw: { a1: -110, a2: -134, a3: -112, fan: -41, scal: 1.0 }, fw: { a1: -84, a2: -106, a3: -90, fan: -27 } }),
  // 5 overshoot: the wings flare a little past rest, the membranes billow, the chest lifts
  over(IDLE0, { lean: -0.04, headY: IDLE0.headY - 1, nw: { a1: -112, a2: -143, fan: -44, scal: 1.15 }, fw: { a1: -87, a2: -114, scal: 1.1 }, tail: 0.95 }),
  IDLE0,
];
const FROM_GUARD_HOLDS = [50, 50, 50, 50, 60, 60, 70];

// ------------------------------------------------------------------ hitHeavy (8 frames, 680 ms)
//
// The blow lands on the head and chest first (f0, the struck contact frame: the head snapped hard
// back, eyes shut, jaw jolted, the neck compressed, the chest knocked back under the still wings,
// the forearms snatched up, the far wing's root clenched, crest and keel flaring; hip, legs, tail
// and near wing still idle); f1 the shoulders hunch and the wings clench in (the in-between of the
// compressed key and the throw); the hip follows
// and the wings are left behind (they swing forward, inertia), the near foot comes off the ground;
// it replants a step back as the wings whip past rest and the tail lashes; the knees absorb, the
// head drops forward; the foot steps back in (lifted, replanted home) and the body settles.

const HIT_HEAVY_STRUCK: PoseDelta = { chestLean: -0.14, headX: -9, headY: 2, ha: -0.34, jaw: 0.45, eye: 0, nk1: [-3, 1], nk2: [4, 1], fw: { a1: -92, a2: -117, a3: -98, fan: -20 }, arm: 26, armF: 9, pulse: 0.5, crestFlare: 1 };
const HIT_HEAVY_KEYS: PoseDelta[] = [
  // the compressed key (the whole body on f1): the head snapped hard back and in, the chest knocked
  //   back about the hip, the shoulders hunched, the wing roots clenched; the hip, legs and tail
  //   have not moved yet
  { lean: -0.1, headX: -9, headY: 2, ha: -0.34, jaw: 0.45, eye: 0, nk1: [-3, 1], nk2: [4, 1], nw: { a1: -97, a2: -119, a3: -122, fan: -30, scal: 0.75 }, fw: { a1: -92, a2: -117, a3: -98, fan: -20 }, arm: 26, armF: 9, glow: 0.1 },
  // 1 thrown back: the hip follows, the wings lag (swing forward), the near foot lifts
  { hx: -4, lean: -0.3, headX: -10, headY: 0, ha: -0.2, jaw: 0.35, eye: 0, nk2: [2, 0], nw: { a1: -92, a2: -118, a3: -106, fan: -30, scal: 0.8 }, fw: { a1: -76, a2: -96, fan: -22 }, stepN: [-2, -3], tailLift: 6, arm: 30, armF: 10, glow: 0.1, tail: 0.04 },
  // 2 the foot replants a step back; the wings whip back past rest, the tail lashes
  { hx: -5, hy: 2, lean: -0.17, headX: -7, headY: 2, ha: 0.05, jaw: 0.15, eye: 0, nw: { a1: -116, a2: -148, a3: -114, fan: -46, scal: 1.2 }, fw: { a1: -90, a2: -118, fan: -32 }, stepN: [-4, 0], tailLift: -4, tailAmp: 7, arm: 18, armF: 6, glow: 0.15, tail: 0.12 },
  // 3 absorbing: the knees take the weight, the head drops forward (half lid)
  { hx: -4, hy: 3, lean: -0.06, headX: -3, headY: 4, ha: 0.28, eye: 0.5, nw: { a1: -104, a2: -133, a3: -120, fan: -38, scal: 1.05 }, stepN: [-4, 0], tailLift: -2, tailAmp: 5, arm: 8, glow: 0.2, tail: 0.16 },
  // 4 [recover] push-off: the near foot lifts to step back in
  { hx: -2, hy: 1, lean: -0.03, headX: -2, headY: 2, ha: 0.18, eye: 1, nw: { a1: -106, a2: -136 }, stepN: [-2, -2], arm: 4, glow: 0.25, tail: 0.1 },
  // 5 the foot replants home
  { hx: -1, lean: -0.01, headX: -1, headY: 0, ha: 0.12, nw: { a1: -108, a2: -138 }, tailLift: 1, glow: 0.3, tail: 0.04 },
  // 6 = idle f0
  {},
];
const HIT_HEAVY_HOLDS = [60, 50, 70, 90, 100, 100, 100, 110];

// ------------------------------------------------------------------ hitMagic (9 frames, 610 ms)
//
// A spell / beam: the chest and head react first (f0, the struck contact frame the hit-stop holds:
// the charge hits the chest — the keel lights white, the crest crystals flare, the chest curls
// forward round it under the still wings, the head is snapped back into the shoulders, teeth
// bared, the eyes blaze white, the forearms snatch up, the far wing's root clenches; hip, legs,
// tail and near wing still idle) — f1 the jolt clenches the whole body round the keel on its way
// to rigid (in-between), then the charge runs through the whole body —
// rigid, chest up, the wings flung open and taut, the crystals flare; it shudders 1 px a few short
// frames (the wings tremble a frame behind the body); the charge lets go — the body sags, the head
// drops, the wings go slack — and it recovers.

const RIGID: PoseDelta = { hy: -1, lean: -0.12, headX: -3, headY: -2, ha: -0.12, jaw: 0, eye: 1, tailLift: 5, arm: 16, armF: 6, glow: 1, flare: 1, pulse: 1 };
const RIGID_NW: Partial<Wing> = { a1: -116, a2: -147, a3: -112, fan: -47, scal: 0.75 };
const RIGID_FW: Partial<Wing> = { a1: -90, a2: -118, a3: -86, fan: -32, scal: 0.8 };
const HIT_MAGIC_STRUCK: PoseDelta = { chestLean: 0.08, headX: -7, headY: 3, ha: 0.12, jaw: 0.25, eye: 1, eyeFlare: 1, nk1: [1, 3], nk2: [-3, 2], fw: { a1: -89, a2: -114, a3: -94, fan: -24 }, arm: 26, armF: 9, pulse: 1, crestFlare: 1 };
const HIT_MAGIC_KEYS: PoseDelta[] = [
  // the clenched key (the whole body, f1 on its way to rigid): the body clenches round the keel —
  //   the keel lights, the chest curls forward, the head is snapped back and pulled down into the
  //   shoulders (eyes squeezed shut), the wing roots clench the wings in tight, the forearms snatch
  //   up; the hip, legs and tail have not moved yet
  { lean: 0.05, headX: -5, headY: 4, ha: 0.26, jaw: 0, eye: 0, nk1: [1, 2], nk2: [-2, 2], nw: { a1: -97, a2: -117, a3: -125, fan: -27, scal: 0.72 }, fw: { a1: -95, a2: -121, a3: -101, fan: -19 }, arm: 26, armF: 9, glow: 0.7, pulse: 1 },
  // 1 the charge runs through: rigid, the wings flung open and taut, the crystals flare
  { ...RIGID, nw: RIGID_NW, fw: RIGID_FW },
  // 2–4 the shudder (1 px), the wings a frame behind
  { ...RIGID, hx: 1, headX: -2, nw: { ...RIGID_NW, a1: -117 }, fw: RIGID_FW },
  { ...RIGID, hx: -1, headX: -4, nw: { ...RIGID_NW, a1: -114, a2: -145 }, fw: { ...RIGID_FW, a1: -91 } },
  { ...RIGID, hx: 0, headX: -3, flare: 0, glow: 0.8, pulse: 0.5, nw: { ...RIGID_NW, a1: -116, a2: -148 }, fw: { ...RIGID_FW, a1: -89 } },
  // 5 [recover] the charge lets go: the body sags, the head drops, the wings go slack
  { hy: 1, lean: 0.05, headX: -2, headY: 2, ha: 0.24, eye: 0.5, nw: { a1: -102, a2: -131, a3: -121, fan: -36, scal: 1.15 }, fw: { a1: -82, a2: -106, scal: 1.1 }, tailLift: -2, arm: 2, glow: 0.45, tail: 0.06 },
  // 6 recovering
  { lean: 0.01, headX: -1, headY: 0, ha: 0.14, nw: { a1: -106, a2: -136, scal: 1.05 }, tailLift: -1, glow: 0.35, tail: 0.03 },
  // 7 = idle f0
  {},
];
const HIT_MAGIC_HOLDS = [60, 40, 50, 50, 50, 60, 90, 100, 110];
const HIT_HEAVY_P: Pose[] = recoil(HIT_HEAVY_STRUCK, HIT_HEAVY_KEYS, { eye: 0 });
const HIT_MAGIC_P: Pose[] = recoil(HIT_MAGIC_STRUCK, HIT_MAGIC_KEYS, { eye: 0.5 });

// ------------------------------------------------------------------ summon (15 frames, 1.31 s)
//
// Wrapped in its wings (the guard wrap pulled tighter, head tucked, eyes shut, legs drawn up) it
// drops onto the tile → [land] the feet strike, the knees take it in a deep crouch, the wrap
// jolts, the tail thumps → the eyes open, the wrap cracks → the wings unfurl wide, the chest rises
// → the wings fold back toward rest → it shakes out (head right, left, right with a tilt, the wings
// flutter a frame behind) → blink → idle f0.

const COCOON: PoseDelta = {
  guard: true,
  tuck: 1,
  hy: 3,
  lean: 0.22,
  headX: -7,
  headY: 19,
  ha: 0.72,
  eye: 0,
  nw: { a1: -70, a2: 38, a3: 78, fan: 22, scal: 0.9 },
  fw: { a1: -50, a2: 62, a3: 86, fan: 15, scal: 1 },
  tailLift: -20,
  tailAmp: 2,
  tail: 0.1,
  arm: 26,
  armF: 4,
  glow: 0.8,
};
const SPREAD_NW: Partial<Wing> = { a1: -122, a2: -150, a3: -110, fan: -48, scal: 0.85 };
const SPREAD_FW: Partial<Wing> = { a1: -46, a2: -20, a3: -58, fan: 30, span: 1.25, at: [6, 2] };
const C0 = over(GUARD0, COCOON);
const LANDED = over(C0, { tuck: 0, lift: 0, hy: 5, lean: 0.24, headY: 17, nw: { scal: 1.25 }, fw: { scal: 1.2 }, tailLift: -23 });
const SPREAD = over(fromIdle({ hy: 0, lean: -0.18, headX: -2, headY: 0, ha: -0.1, jaw: 0.15, tailLift: 8, arm: 20, glow: 0.9 }), { nw: SPREAD_NW, fw: SPREAD_FW });

// The frame indices of the spread (7) and its hold (8) are beats of the summon kit
// (src/cinematics/summon-a/ashen_drake.ts SPREAD_F / CUT_F): the drop is three frames so the
// unfurl gets two in-betweens (crack → the wings at 45° with the head rising clear of their edge →
// nearly open) without moving them.
const UNFURL: Pose = mix(LANDED, SPREAD, 0.7, 0.75, { guard: false, wrap: 0.2, eye: 1, nw: { a1: -110, a2: -126, a3: -104, fan: -42, scal: 0.82 }, fw: { a1: -60, a2: -50, a3: -66, fan: 12, span: 1.15, at: [5, 1] } });
const SUMMON: Pose[] = [
  over(C0, { lift: -16 }),
  over(C0, { lift: -11, tuck: 0.6, hy: 2, nw: { scal: 1.05 }, fw: { scal: 1.05 } }),
  over(C0, { lift: -4, tuck: 0.2, hy: 2, nw: { scal: 0.95 } }),
  // 3 [land]
  LANDED,
  // 4 the crouch holds, the eyes open, the wrap cracks
  mix(LANDED, SPREAD, 0.12, 0.2, { guard: false, wrap: 0.8, eye: 1, headY: 14, ha: 0.45, glow: 0.85 }),
  // 5 the torso half risen, the wings swing up to ~45° (folded), the head rises clear of their edge
  mix(LANDED, SPREAD, 0.36, 0.4, { guard: false, wrap: 0.55, eye: 1, headX: 0, headY: 5, ha: 0.2, nw: { a1: -95, a2: -58, a3: -64, fan: -24, span: 0.9, scal: 0.75 }, fw: { a1: -70, a2: -45, a3: -50, fan: -10, scal: 0.85, at: undefined } }),
  // 6 nearly open
  UNFURL,
  // 7 full spread
  over(SPREAD, {}),
  // 8 the spread holds; the membranes billow, the head levels
  over(SPREAD, { ha: 0, jaw: 0, nw: { scal: 1.1, a1: -120 }, fw: { a1: -48, a2: -24 }, tail: 0.2 }),
  // 9 the wings fold back toward rest
  mix(SPREAD, IDLE0, 0.55, 0.6, { tail: 0.3 }),
  // 10 shake out: head to the right with a tilt, eyes shut (the wings still folding)
  fromIdle({ hx: -1, headX: 3, headY: 0, ha: 0.3, eye: 0, nw: { a1: -110, a2: -141, scal: 0.95 }, fw: { a1: -80, a2: -104 }, tail: 0.36, tailLift: 2 }),
  // 11 head to the left, the wings flutter a frame behind
  fromIdle({ hx: 1, headX: -3, headY: -1, ha: -0.04, eye: 0, nw: { a1: -113, a2: -144, scal: 1.2 }, fw: { a1: -86, a2: -112, scal: 1.15 }, tail: 0.3 }),
  // 12 a smaller one back to the right
  fromIdle({ headX: 1, headY: -1, ha: 0.2, eye: 0.5, nw: { a1: -105, a2: -135, scal: 0.92 }, fw: { a1: -82 }, tail: 0.2 }),
  // 13 settle (blink)
  fromIdle({ headY: -1, ha: 0.12, eye: 0.5, nw: { a1: -109, scal: 1.05 }, tail: 0.1 }),
  IDLE0,
];
const SUMMON_HOLDS = [100, 90, 70, 100, 100, 70, 60, 80, 110, 70, 70, 70, 80, 110, 130];

// ------------------------------------------------------------------ death (10 frames, 690 ms)
//
// From the magic recoil: the first crack opens at the keel with the crystal's light behind it → the
// body rears in agony as the cracks run up the neck, down the belly, across the wing → the knees
// start to go → [dissolve] they buckle, the near wing drops and hangs, the head droops, the light
// drains from the extremities into the core → the light is out → the cold crystal splits along the
// main crack (the death kit breaks the body from the last frame).

const DEATH_KEYS: PoseDelta[] = [
  // 0 [impact] from the hit pose: the first crack opens at the keel, light behind it
  { hx: -3, hy: 1, lean: -0.2, headX: -8, headY: 1, ha: -0.22, jaw: 0.4, eye: 0, nw: { a1: -96, a2: -122, a3: -114, fan: -32, scal: 0.85 }, fw: { a1: -92, a2: -118, fan: -22 }, tailLift: 4, arm: 24, armF: 8, glow: 0.6, cracks: 0.12 },
  // 1 agony: it rears, jaws wide, the cracks run (glowing)
  { hx: -1, hy: -1, lean: -0.22, headX: -6, headY: -2, ha: -0.4, jaw: 0.7, eye: 0, nw: { a1: -118, a2: -150, a3: -110, fan: -47, scal: 0.8 }, fw: { a1: -92, a2: -122 }, tailLift: 8, arm: 30, armF: 9, glow: 1, pulse: 1, cracks: 0.45 },
  // 2 the knees start to go
  { hx: -1, hy: 3, lean: -0.04, headX: -4, headY: 5, ha: 0.1, jaw: 0.4, eye: 0, nw: { a1: -106, a2: -132, a3: -124, fan: -36, scal: 1.1 }, fw: { a1: -88, a2: -114, a3: -96 }, tailLift: 0, arm: 14, glow: 0.8, pulse: 0.4, cracks: 0.7, drain: 0.1 },
  // 3 [dissolve] they buckle; the near wing starts to fall, the light starts to leave
  { hy: 5, lean: 0.06, headX: -1, headY: 9, ha: 0.32, jaw: 0.25, eye: 0, nw: { a1: -124, a2: -164, a3: -168, fan: -32, scal: 1.15 }, fw: { a1: -112, a2: -150, a3: -140, fan: -24 }, tailLift: -4, arm: 6, glow: 0.55, cracks: 0.95, drain: 0.3 },
  // 4 the wing drops, the head droops
  { hy: 7, lean: 0.15, headX: 0, headY: 14, ha: 0.58, jaw: 0.18, eye: 0, nw: { a1: -146, a2: -202, a3: -226, fan: -24, scal: 1.22 }, fw: { a1: -130, a2: -180, a3: -190, fan: -18 }, tailLift: -8, arm: -2, armF: -2, glow: 0.3, cracks: 1, drain: 0.55 },
  // 5 down: the wing hangs, the neck arches over the lowered head
  { hy: 9, lean: 0.21, headX: 1, headY: 18, ha: 0.76, jaw: 0.1, eye: 0, nw: { a1: -160, a2: -218, a3: -252, fan: -17, scal: 1.2 }, fw: { a1: -140, a2: -194, a3: -212, fan: -16 }, tailLift: -10, arm: -8, armF: -4, glow: 0.1, cracks: 1, drain: 0.8 },
  // 6 the light is out
  { hy: 9, lean: 0.23, headX: 1, headY: 19, ha: 0.8, jaw: 0.1, eye: 0, nw: { a1: -162, a2: -222, a3: -256, fan: -16, scal: 1.15 }, fw: { a1: -142, a2: -197, a3: -216, fan: -16 }, tailLift: -10, arm: -8, armF: -4, glow: 0, cracks: 1, drain: 1 },
];
const DEATH_REST = fromIdle(DEATH_KEYS[DEATH_KEYS.length - 1]);
const DEATH_P = DEATH_KEYS.map(fromIdle);
/** The last whole pose of the death (the revive gathers the fragments back into it). */
const DEATH_END: Pose = over(DEATH_REST, { headY: DEATH_REST.headY + 1, nw: { a3: DEATH_REST.nw.a3 - 22, fan: DEATH_REST.nw.fan - 6 }, fw: { a3: DEATH_REST.fw.a3 - 10 }, tailLift: -15 });
// Death f0 continues the reaction the kit shows when a blow is lethal. The pose diff is all or
// nothing (any 1-px offset changes the whole silhouette), so f0 continues one of them exactly: the
// magic recoil's in-between (hitMagic f1: the clenched jolt opening out — prism breath, spells, the
// orb, light and lightning kill the wyrm in the slice; the lethal plan holds the jolt f0 and enters
// here, or plays f0–f1 and continues on this same pose), eyes shut, the first crack opened at the
// keel with the light still behind it; f1 the agony rears out of it.
const DEATH_0: Pose = over(HIT_MAGIC_P[1], { eye: 0, cracks: 0.12, sparkles: [] });
const DEATH: Pose[] = [
  DEATH_0,
  DEATH_P[1],
  // the agony lets go (in-between: the head comes down first, the wings a beat later)
  mix(DEATH_P[1], DEATH_P[2], 0.5, 0.35, { cracks: 0.6, drain: 0.02, ha: -0.08, headY: 3 }),
  ...DEATH_P.slice(2, 6),
  // 7 the last light leaves the core; the head settles the last pixel, the hanging wing tip and the
  //   tail tip sink after it
  over(DEATH_P[6], { headY: DEATH_P[6].headY + 1, nw: { a3: DEATH_P[6].nw.a3 - 5 }, fw: { a3: DEATH_P[6].fw.a3 - 3 }, tailLift: -12 }),
  // 8–9 the cold crystal splits; the hanging wing's fingers fall on through it (accelerating), the
  //   tail tip sinks
  over(DEATH_END, { nw: { a3: DEATH_END.nw.a3 + 9, fan: DEATH_END.nw.fan + 3 }, fw: { a3: DEATH_END.fw.a3 + 4 }, tailLift: -14, split: 0.5 }),
  over(DEATH_END, { split: 1 }),
];
const DEATH_HOLDS = [60, 90, 60, 90, 80, 70, 60, 60, 50, 70];

// ------------------------------------------------------------------ revive (13 frames, 1.23 s)
//
// The reverse: crystal fragments fly in on a gentle spiral and lock into the collapsed body, the
// inner ones first → [land] the last one locks (cold, cracked) → the light kindles in the core and
// spreads outward, the cracks close behind it, the body pushes up, the hanging wing lifts → the
// first breath (chest up, jaws part, the wings stretch) → exhale → idle f0.

const REVIVE: Pose[] = [
  over(DEATH_END, { gather: 0.12 }),
  over(DEATH_END, { gather: 0.32 }),
  over(DEATH_END, { gather: 0.55 }),
  over(DEATH_END, { gather: 0.8 }),
  // 4 [land] locked
  over(DEATH_END, { drain: 0.92, pulse: 1 }),
  mix(DEATH_END, IDLE0, 0.12, 0.1, { drain: 0.62, cracks: 0.75, eye: 0.5, glow: 0.6, pulse: 0.6 }),
  mix(DEATH_END, IDLE0, 0.33, 0.3, { drain: 0.4, cracks: 0.48, eye: 0.5, glow: 0.7 }),
  mix(DEATH_END, IDLE0, 0.58, 0.6, { drain: 0.2, cracks: 0.25, eye: 1, glow: 0.7 }),
  mix(DEATH_END, IDLE0, 0.82, 0.86, { drain: 0.04, cracks: 0.06, eye: 1, glow: 0.7 }),
  // 8 the first breath
  fromIdle({ hy: -1, lean: -0.12, headX: -1, headY: -3, ha: 0, jaw: 0.25, nw: { a1: -114, a2: -145, scal: 0.85 }, fw: { a1: -88, a2: -114 }, tailLift: 4, arm: 8, pulse: 1, glow: 0.8 }),
  // 9 exhale
  fromIdle({ hy: 1, lean: 0.03, headY: 0, ha: 0.16, nw: { a1: -106, a2: -135, scal: 1.12 }, fw: { a1: -83, a2: -108 }, tailLift: -1, glow: 0.5, tail: 0.08 }),
  fromIdle({ headY: -1, ha: 0.12, nw: { scal: 1.04 }, glow: 0.35, tail: 0.04 }),
  IDLE0,
];
const REVIVE_HOLDS = [80, 80, 80, 90, 120, 90, 80, 80, 80, 100, 110, 110, 130];

// ------------------------------------------------------------------ victory (8 frames, 1.01 s)
//
// crouch → it rises, the wings opening → a proud cry with the wings spread, the chest high →
// tremble → the jaws close, the head comes down to a proud angle → settles into the held pose
// (half-spread wings, chest out).

const PROUD = fromIdle({ lean: -0.16, headX: -2, headY: 0, ha: -0.08, nw: { a1: -116, a2: -145, a3: -114, fan: -45, scal: 1.05 }, fw: { a1: -94, a2: -122, a3: -98, fan: -30 }, tailLift: 6, arm: 16, glow: 0.7 });
const VICTORY: Pose[] = [
  fromIdle({ hy: 1, lean: 0.04, headY: 1, ha: 0.17, nw: { a1: -106, a2: -135, a3: -120, fan: -38, scal: 0.95 }, fw: { a1: -86, a2: -112 }, tailLift: -1, arm: -2 }),
  fromIdle({ hy: 2, lean: 0.08, headX: -1, headY: 3, ha: 0.24, nw: { a1: -104, a2: -132, a3: -122, fan: -36, scal: 0.9 }, fw: { a1: -88, a2: -114 }, tailLift: -3, arm: -4 }),
  fromIdle({ hy: -1, lean: -0.24, headX: -3, headY: 1, ha: -0.25, jaw: 0.3, nw: { a1: -118, a2: -146, a3: -112, fan: -46 }, fw: { a1: -50, a2: -30, a3: -58, fan: 18, span: 1.15, at: [4, 1] }, tailLift: 8, arm: 30, glow: 0.8 }),
  fromIdle({ hy: -2, lean: -0.36, headX: -5, headY: 2, ha: -0.55, jaw: 0.65, nw: { a1: -122, a2: -150, a3: -110, fan: -49, scal: 1.1 }, fw: { ...FW_SPREAD, a1: -31 }, tailLift: 13, arm: 48, glow: 1 }),
  fromIdle({ hx: 1, hy: -2, lean: -0.35, headX: -5, headY: 2, ha: -0.53, jaw: 0.7, nw: { a1: -121, a2: -150, a3: -111, fan: -49, scal: 1.0 }, fw: { ...FW_SPREAD, a1: -30 }, tailLift: 13, arm: 46, glow: 1, tail: 0.1 }),
  fromIdle({ hy: -1, lean: -0.24, headX: -3, headY: 1, ha: -0.18, jaw: 0.1, nw: { a1: -118, a2: -147, fan: -47 }, fw: { a1: -88, a2: -106, a3: -92, fan: -22, span: 1.05, at: [1, -2] }, tailLift: 9, arm: 26, glow: 0.85, tail: 0.18 }),
  over(PROUD, { tail: 0.24 }),
  over(PROUD, { tail: 0.28 }),
];
const VICTORY_HOLDS = [60, 90, 70, 90, 80, 100, 120, 400];

/** The extra anims' poses (frame-indexed). */
const EXTRA_POSES: Partial<Record<MonsterAnimExtra, Pose[]>> = {
  summon: SUMMON,
  death: DEATH,
  revive: REVIVE,
  hitHeavy: HIT_HEAVY_P,
  hitMagic: HIT_MAGIC_P,
  victory: VICTORY,
  toGuard: TO_GUARD,
  fromGuard: FROM_GUARD,
};

const spec = (holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames: holds.length, fps: 10, loop: false, holds, ...(marks ? { marks } : {}) });

export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SUMMON_HOLDS, { land: 3 }),
  death: spec(DEATH_HOLDS, { impact: 0, dissolve: 4 }),
  revive: spec(REVIVE_HOLDS, { land: 4 }),
  hitHeavy: spec(HIT_HEAVY_HOLDS, { impact: 0, contact: 0, recover: 5 }),
  hitMagic: spec(HIT_MAGIC_HOLDS, { impact: 0, contact: 0, recover: 6 }),
  victory: spec(VICTORY_HOLDS),
  toGuard: spec(TO_GUARD_HOLDS),
  fromGuard: spec(FROM_GUARD_HOLDS),
};

/** The frame whose glint is the 3-px cross, per anim with a glint: the 1-px frames around it use
 *  the same pixel (the glint lives on one pixel, it never wanders with the membrane or a tremble). */
const GLINT_REF: Partial<Record<AnyMonsterAnim, number>> = { idle: 3, roar: 6, guard: 5 };
const glintCache = new Map<string, V | null>();
function glintRef(anim: AnyMonsterAnim): V | null {
  const k = `${anim}|${LIGHT.side}`;
  if (!glintCache.has(k)) glintCache.set(k, glintPixelFor(framePose(anim, GLINT_REF[anim]!)));
  return glintCache.get(k)!;
}

export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const x = EXTRA_POSES[anim as MonsterAnimExtra];
  if (x) return { ...x[Math.max(0, Math.min(f, x.length - 1))] };
  switch (anim as MonsterAnim) {
    case 'idle':
      return idlePose(f);
    case 'guard':
      return guardPose(f);
    case 'roar':
      return fromIdle(ROAR_KEYS[Math.min(f, ROAR_KEYS.length - 1)]);
    case 'attack':
      return fromIdle(ATTACK_KEYS[Math.min(f, ATTACK_KEYS.length - 1)]);
    case 'hit':
      return { ...HIT_P[Math.min(f, HIT_P.length - 1)] };
  }
}

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: { frames: IDLE_N, fps: 10, loop: true, holds: IDLE_HOLDS },
  roar: { frames: ROAR_KEYS.length, fps: 10, loop: false, holds: ROAR_HOLDS, marks: { charge: 1, release: 4, impact: 4, recover: 8 } },
  attack: { frames: ATTACK_KEYS.length, fps: 10, loop: false, holds: ATTACK_HOLDS, marks: { charge: 1, release: IMPACT, impact: IMPACT, contact: IMPACT + 1, recover: 10 } },
  hit: { frames: HIT_P.length, fps: 10, loop: false, holds: HIT_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  guard: { frames: GUARD_N, fps: 6, loop: true, holds: GUARD_HOLDS },
};

/** The pose drawn for a frame (attack's release frame carries its smear from the coil; a glint
 *  frame its fixed glint pixel). */
export function drawPose(anim: AnyMonsterAnim, f: number): Pose {
  const p = framePose(anim, f);
  if (anim === 'attack' && f === IMPACT) p.smearFrom = framePoseDelta(framePose('attack', IMPACT - 1));
  if (p.sparkles.length && GLINT_REF[anim] !== undefined) p.glintAt = glintRef(anim) ?? undefined;
  return p;
}

/** A full pose as a delta (for smears). */
function framePoseDelta(p: Pose): PoseDelta {
  const { smearFrom: _s, ...rest } = p;
  return rest;
}

export const MUZZLE = rnd(mouthPoint(framePose('attack', IMPACT)));

/** Per-frame points: the mouth (beam origin) every frame, the chest core, the head, the near claw, the feet. */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  if (!EXTRA_POSES[anim as MonsterAnimExtra] && anim !== 'idle' && anim !== 'roar' && anim !== 'attack' && anim !== 'hit' && anim !== 'guard') return {};
  const P = framePose(anim, f);
  const m = rnd(mouthPoint(P));
  const r = rig(P);
  const claw = rnd(add(r.att([2, 3]), add(polar(68 - P.arm, 7.5), polar(-30 - P.arm * 1.4, 11))));
  // the ground contact: the anchor, carried by a step / the summon drop (planted: exactly 60,99)
  const L = legs(P);
  const feet = rnd([50 + OX + (P.stepN[0] + P.stepF[0]) / 2, Math.max(L.footN[1], L.footF[1] + 3) + 3]);
  return {
    muzzle: { x: m[0], y: m[1] },
    core: { x: Math.round(r.chest[0] - 4), y: Math.round(r.chest[1] + 7) },
    head: { x: r.head[0], y: r.head[1] },
    claw: { x: claw[0], y: claw[1] },
    feet: { x: feet[0], y: feet[1] },
  };
}

