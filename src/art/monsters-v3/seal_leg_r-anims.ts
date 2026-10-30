// Sağ Bacak Mührü v3 — animations of the "Stomper" rig: pose tables, holds, marks, points.
//
// Rhythm identity: WEIGHT AND IMPACT. The foot stays planted in every loop; the weight shifts through the hip and the knee
// (the knee plate leads, the thigh follows a frame later, the toes press), the runes beat twice like a heart ("ba-dum"), dust
// slides off the sole rim twice per loop and one pebble slides off the broken hip. The leg is a digitigrade two-bone chain: a pose
// gives the hip and the ankle and the knee falls out of a two-bone IK (it always points BACK), so the planted foot is exact.
// Attack = a long rising stomp: the foot folds up 22 px, the runes charge DOWN the shin one per two frames, an apex hold,
// a dropped slam with a floor ring and a crack web. Roar = one hop and a stamp. Every one-shot ends exactly on idle f0
// (toGuard on guard f0).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { ANKLE0, AX, AY, HIP0, KNEE0, footGeom, pose, segGeom, type Pose } from './seal_leg_r-rig';
import type { Pt } from './seal_leg_r-kit';

const rnd = Math.round;
const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIO = (t: number) => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ the two-bone leg

const THIGH = Math.hypot(HIP0[0] - KNEE0[0], HIP0[1] - KNEE0[1]);
const SHIN = Math.hypot(KNEE0[0] - ANKLE0[0], KNEE0[1] - ANKLE0[1]);

/** Knee of a hip → ankle chain: the bend always points back (to the screen's left). */
export function ik(h: Pt, a: Pt): Pt {
  const dx = a[0] - h[0];
  const dy = a[1] - h[1];
  const d = Math.min(THIGH + SHIN - 0.2, Math.max(Math.abs(THIGH - SHIN) + 0.2, Math.hypot(dx, dy)));
  const ex = dx / (Math.hypot(dx, dy) || 1);
  const ey = dy / (Math.hypot(dx, dy) || 1);
  const along = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, THIGH * THIGH - along * along));
  return [h[0] + ex * along - ey * hh, h[1] + ey * along + ex * hh];
}

/** A pose from the hip and the ankle (the knee from the IK), plus any other field. */
export function L(hip: Pt, ankle: Pt, o: Partial<Pose> = {}): Pose {
  const knee = ik(hip, ankle);
  return pose({ hip, ankle, knee, kneeP: [rnd(knee[0]), rnd(knee[1])], ...o });
}
/** A planted pose on the REST knee: the hip and the knee plate / shin top move, the knee joint does not (a local buckle, not a re-fold). */
export function X(hip: Pt, plateDy: number, k2y: number, o: Partial<Pose> = {}): Pose {
  return pose({ hip, knee: KNEE0, knee2: [KNEE0[0], KNEE0[1] + k2y], ankle: ANKLE0, kneeP: [KNEE0[0], KNEE0[1] + plateDy], ...o });
}
/** Offset the knee plate (whole px) from its rounded knee. */
export function plate(p: Pose, dx: number, dy: number): Pose {
  const k = p.kneeP ?? p.knee;
  return { ...p, kneeP: [rnd(k[0]) + dx, rnd(k[1]) + dy] };
}

/** In-between of two poses: hip / ankle / foot angle blend, the knee from the IK (planted and lifted foot alike). */
function mixIK(a: Pose, b: Pose, t: number, o: Partial<Pose> = {}): Pose {
  const hip: Pt = [lerp(a.hip[0], b.hip[0], t), lerp(a.hip[1], b.hip[1], t)];
  const ankle: Pt = [lerp(a.ankle[0], b.ankle[0], t), lerp(a.ankle[1], b.ankle[1], t)];
  return L(hip, ankle, { fa: lerp(a.fa, b.fa, t), ...o });
}
/** Joint-by-joint blend of two free poses (death, revive): every joint, the foot angle and the drawing offset. */
function mixJ(a: Pose, b: Pose, t: number, o: Partial<Pose> = {}): Pose {
  const m = (p: Pt, q: Pt): Pt => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  return pose({
    hip: m(a.hip, b.hip),
    knee: m(a.knee, b.knee),
    knee2: m(a.knee2 ?? a.knee, b.knee2 ?? b.knee),
    kneeP: m(a.kneeP ?? a.knee, b.kneeP ?? b.knee).map(rnd) as unknown as Pt,
    ankle: m(a.ankle, b.ankle),
    fa: lerp(a.fa, b.fa, t),
    dy: lerp(a.dy, b.dy, t),
    ...o,
  });
}

// ------------------------------------------------------------------ small effects

/** A dust puff born at frame `start`: four frames, rising 1 px a frame, drifting `dir`. */
function puff(f: number, n: number, start: number, x: number, dir: number): readonly (readonly [number, number, number])[] {
  const age = (((f - start) % n) + n) % n;
  if (age > 3) return [];
  const t = [3, 2, 2, 1][age];
  return [
    [x + dir * age, 84 - age, t],
    [x + dir * (age + 2), 85 - age, Math.max(1, t - 1)],
  ];
}

/** A seal mote leaving the broken hip: alive 5 frames, rising up and to the right. */
function mote(f: number, n: number, start: number, hip: Pt): readonly (readonly [number, number, number])[] {
  const age = (((f - start) % n) + n) % n;
  if (age >= 5) return [];
  return [[hip[0] + 4 + age, hip[1] - 9 - age * 2, age < 2 ? 3 : age < 4 ? 2 : 1]];
}

// ------------------------------------------------------------------ idle (13 frames, 1.63 s)

const IDLE_N = 13;
export const IDLE_HOLDS = [140, 130, 120, 110, 120, 130, 130, 120, 110, 120, 130, 130, 140];
const HIPY = [0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0, 0, 0];
const HIPX = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0];
const KPX = [0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, 1];
const KPY = [0, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, 0, 0];
/** the shin's top follows the knee plate one frame later */
const K2Y = [0, 0, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, 0];
// the heart: three runes light bottom → top at f0–2 (big) and again at f4–6 (small), then dark
const BEAT: readonly (readonly [number, number, number])[] = [
  [0, 1, 3],
  [1, 4, 2],
  [3, 2, 1],
  [1, 1, 0],
  [0, 1, 2],
  [1, 3, 1],
  [2, 1, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 1],
  [0, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const FLOOR = [2, 3, 2, 1, 2, 3, 2, 1, 1, 1, 1, 2, 1];
const SEAM = [1, 2, 2, 1, 1, 2, 3, 2, 1, 1, 2, 1, 1];
const TOEP = [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0];

export function idlePose(f: number): Pose {
  const n = IDLE_N;
  const hip: Pt = [HIP0[0] + HIPX[f], HIP0[1] + HIPY[f]];
  const base = pose({ hip, knee: KNEE0, knee2: [KNEE0[0], KNEE0[1] + K2Y[f]], ankle: ANKLE0, kneeP: [KNEE0[0], KNEE0[1]] });
  const age = f - 3;
  const pebble = age >= 0 && age <= 6 ? [{ x: 57 + age, y: 24 + age * 3, k: 0 }] : [];
  return plate(
    {
      ...base,
      runes: BEAT[f].map((v) => Math.min(4, Math.max(2, v + 1))) as unknown as Pose['runes'],
      seam: SEAM[f],
      spill: BEAT[f].some((v) => v >= 3) ? 2 : 1,
      floor: FLOOR[f],
      tp: TOEP[f],
      sw: 9,
      swT: (2 * f) / n,
      dust: [...puff(f, n, 3, 27, -1), ...puff(f, n, 9, 54, 1)],
      motes: [...mote(f, n, 1, hip), ...mote(f, n, 7, hip)],
      chips: pebble,
    },
    KPX[f],
    KPY[f],
  );
}
/** The idle-f0 reference every one-shot ends on. */
const REST: Pose = idlePose(0);

// ------------------------------------------------------------------ guard (6 frames loop): the shin presented as a wall

const GUARD_N = 6;
export const GUARD_HOLDS = [180, 170, 170, 180, 170, 170];
// one change per frame, all of a similar size: hip step, rune step, plate step, hip step, rune step, plate step
const GHIP: readonly Pt[] = [[44, 29], [44, 30], [44, 30], [44, 30], [44, 29], [44, 29]];
const GKP = [[0, 0], [0, 0], [0, 0], [0, 1], [0, 1], [0, 1]];
const GRUNE: readonly (readonly [number, number, number])[] = [[3, 3, 3], [3, 3, 3], [3, 2, 3], [3, 2, 3], [3, 2, 3], [3, 3, 3]];
export function guardPose(f: number): Pose {
  const gk = ik([44, 29], [37, 74]);
  const base = pose({ hip: GHIP[f], knee: gk, ankle: [37, 74], kneeP: [rnd(gk[0]), rnd(gk[1])] });
  return plate(
    { ...base, runes: GRUNE[f], spill: 2, seam: 1, floor: 2, tp: 1, sw: 5, swT: f / GUARD_N, dust: [], motes: [], chips: [] },
    GKP[f][0],
    GKP[f][1],
  );
}
const G0 = guardPose(0);

export const TOGUARD_HOLDS = [60, 60, 70, 80, 90];
export function toGuardPose(f: number): Pose {
  if (f >= 4) return G0;
  const t = [0.25, 0.55, 0.8, 0.94][f];
  // the knee plate leads: it drops first, the hip follows
  const m = mixIK(REST, G0, t * 0.9);
  return plate({ ...m, runes: [1, 2, 3].map((v, i) => Math.round(lerp(REST.runes[i], G0.runes[i], t))) as unknown as Pose['runes'], spill: 1, floor: 1, tp: t > 0.5 ? 1 : 0, sw: 7, swT: f / 5, dust: [], motes: [], chips: [], seam: 1 }, 0, f === 1 ? 1 : 0);
}
export const FROMGUARD_HOLDS = [60, 70, 80, 90, 100];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return REST;
  const t = [0.3, 0.55, 0.78, 0.92][f];
  const m = mixIK(G0, REST, t);
  return plate({ ...m, runes: [G0.runes[0], G0.runes[1], G0.runes[2]].map((v, i) => Math.round(lerp(v, REST.runes[i], t))) as unknown as Pose['runes'], spill: 1, floor: 1, tp: t < 0.5 ? 1 : 0, sw: 8, swT: f / 5, dust: [], motes: [], chips: [], seam: 1 }, 0, f === 2 ? -1 : 0);
}

// ------------------------------------------------------------------ attack (15 frames): the rising stomp

export const ATTACK_HOLDS = [80, 100, 90, 90, 100, 110, 150, 40, 60, 60, 80, 100, 110, 120, 130];
/** [hip, ankle, foot angle, toe curl] of the rise and the fall. */
const ATK: readonly (readonly [Pt, Pt, number, number])[] = [
  [[46, 23], [37, 74], 0, 0],
  [[45, 20], [37, 70], 2, 0],
  [[44, 17], [39, 62], 8, 0],
  [[44, 17], [41, 60], 14, 0],
  [[44, 16], [43, 57], 18, 6],
  [[44, 15], [44, 55], 22, 12],
  [[45, 15], [45, 54], 26, 22],
  [[45, 19], [45, 64], 14, 8],
  [[46, 29], [40, 75], 0, 0],
  [[46, 27], [40, 75], 0, 0],
  [[46, 26], [40, 75], 0, 0],
  [[46, 25], [39, 75], 0, 0],
  [[46, 24], [38, 74], 0, 0],
  [[46, 23], [37, 74], 0, 0],
];
const ARUNE: readonly (readonly [number, number, number])[] = [
  [0, 1, 3],
  [2, 0, 0],
  [3, 0, 0],
  [3, 2, 0],
  [3, 3, 0],
  [3, 3, 2],
  [3, 3, 3],
  [4, 3, 3],
  [4, 4, 4],
  [3, 3, 3],
  [2, 2, 2],
  [2, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
];
export function attackPose(f: number): Pose {
  if (f >= 14) return REST;
  const [hip, ankle, fa, tc] = ATK[f];
  const p = L(hip, ankle, { fa, tc, tl: f >= 2 && f <= 7 ? ([1, 1, 2] as const) : ([0, 0, 0] as const), runes: ARUNE[f], seam: f >= 1 && f <= 8 ? 2 : 1, spill: f >= 3 && f <= 10 ? 2 : 1, floor: f === 8 ? 3 : 1, sw: 12, swT: f / 15 });
  switch (f) {
    case 0:
      return { ...REST, runes: [2, 2, 3], tp: 1, sw: 10, swT: 0.05 };
    case 6:
      return { ...p, sparks: [[AX + 13, 56]] };
    case 7:
      return { ...p, lines: [[AX + 10, 30, 34, 2], [AX + 14, 40, 46, 1]] };
    case 8:
      // release: the foot lands 2 px into the floor; a 2-px smear above it, the ring, dust, white-hot runes, hot sparks at the sole
      return {
        ...p,
        smear: true,
        tp: 1,
        rings: [[9, 3]],
        fcrack: 1,
        sparks: [[AX + 14, 85], [AX - 4, 86], [AX + 20, 83]],
        dust: [[AX - 8, 84, 3], [AX + 22, 84, 3], [AX - 11, 82, 2], [AX + 25, 82, 2]],
        chips: [{ x: AX - 14, y: 76, k: 0 }, { x: AX + 26, y: 74, k: 1 }],
      };
    case 9:
      return { ...p, tp: 1, rings: [[16, 3], [7, 1]], fcrack: 3, dust: [[AX - 12, 81, 3], [AX + 27, 80, 3], [AX - 16, 79, 2], [AX + 30, 77, 2]], chips: [{ x: AX - 17, y: 73, k: 0 }, { x: AX + 29, y: 69, k: 1 }], sparks: [[AX + 18, 84]] };
    case 10:
      return { ...p, tp: 1, rings: [[23, 2]], fcrack: 3, dust: [[AX - 15, 78, 2], [AX + 31, 76, 2], [AX - 19, 76, 1]], chips: [{ x: AX - 19, y: 76, k: 0 }, { x: AX + 31, y: 79, k: 1 }] };
    case 11:
      return { ...p, tp: 1, rings: [[29, 1]], fcrack: 2, dust: [[AX - 17, 75, 1], [AX + 33, 74, 1]], chips: [{ x: AX - 20, y: 82, k: 0 }] };
    case 12:
      return { ...p, fcrack: 1, dust: [[AX - 19, 73, 1]], tp: 0 };
    case 13:
      return { ...p, sw: 9, swT: 0.9, fcrack: 0 };
    default:
      return p;
  }
}

// ------------------------------------------------------------------ roar (9 frames): the foot-stamp

export const ROAR_HOLDS = [90, 130, 100, 160, 50, 50, 90, 120, 150];
const ROARK: readonly (readonly [Pt, Pt, number])[] = [
  [[46, 22], [37, 74], 0],
  [[46, 27], [37, 74], 0],
  [[45, 19], [38, 67], 6],
  [[45, 17], [39, 63], 12],
  [[46, 21], [39, 70], 6],
  [[46, 28], [39, 75], 0],
  [[46, 24], [38, 75], 0],
  [[46, 22], [38, 74], 0],
];
const RRUNE: readonly (readonly [number, number, number])[] = [[0, 1, 3], [2, 1, 1], [3, 2, 2], [3, 3, 3], [4, 3, 3], [4, 4, 4], [3, 4, 4], [2, 3, 3]];
export function roarPose(f: number): Pose {
  if (f >= 8) return REST;
  const [hip, ankle, fa] = ROARK[f];
  const p = L(hip, ankle, { fa, runes: RRUNE[f], seam: f >= 4 ? 3 : 2, spill: f >= 2 ? 2 : 1, floor: f >= 5 ? 3 : 2, tl: f >= 2 && f <= 4 ? ([1, 1, 1] as const) : ([0, 0, 0] as const), sw: 12 + f, swT: f / 9 });
  switch (f) {
    case 0:
      return { ...REST, runes: [2, 2, 3], sw: 10, swT: 0.05 };
    case 5:
      return { ...p, tp: 1, rings: [[10, 3]], fcrack: 2, sparks: [[AX + 14, 85], [AX - 5, 86]], dust: [[AX - 9, 84, 3], [AX + 23, 84, 3]] };
    case 6:
      return { ...p, rings: [[19, 2], [8, 3]], fcrack: 3, dust: [[AX - 13, 81, 2], [AX + 27, 81, 2]], sparks: [[AX + 3, 28]] };
    case 7:
      return { ...p, rings: [[27, 1]], fcrack: 2, dust: [[AX - 16, 78, 1]] };
    default:
      return p;
  }
}

// ------------------------------------------------------------------ hit (5) / hitHeavy (8) / hitMagic (7)

/** The struck f0 shared by hit and death: only the knee buckles (the hip dips), the seal flickers; the foot stays. */
function hitF0(): Pose {
  return X([46, 23], 1, 0, { runes: [1, 1, 1], seam: 0, spill: 0, floor: 1, sw: 12, swT: 0.1 });
}
export const HIT_HOLDS = [50, 60, 90, 120, 150];
export function hitPose(f: number): Pose {
  if (f >= 4) return REST;
  switch (f) {
    case 0:
      return hitF0();
    case 1:
      return plate(L([47, 27], ANKLE0, { runes: [0, 1, 0], seam: 1, spill: 0, sw: 18, swT: 0.3, tp: 1 }), 0, 2);
    case 2:
      return plate(L([46, 25], ANKLE0, { runes: [1, 1, 1], seam: 2, spill: 0, sw: 14, swT: 0.6 }), 0, 1);
    default:
      return X([46, 23], 0, 0, { runes: [1, 1, 2], seam: 1, sw: 10, swT: 0.9 });
  }
}
export const HITHEAVY_HOLDS = [50, 60, 60, 70, 80, 100, 120, 150];
/** Struck heavy f0 (also the death's f0): the knee gives. */
function heavyF0(): Pose {
  return X([46, 25], 2, 0, { runes: [1, 1, 1], seam: 0, spill: 0, crack: 1, sw: 14, swT: 0.1 });
}
export function hitHeavyPose(f: number): Pose {
  if (f >= 7) return REST;
  switch (f) {
    case 0:
      return heavyF0();
    case 1:
      return plate(L([45, 30], ANKLE0, { runes: [0, 0, 1], crack: 2, seam: 1, sw: 22, swT: 0.3, tp: 1 }), 0, 2);
    case 2: // the foot lifts and steps back (hitHeavy only)
      return L([44, 28], [33, 69], { fa: -8, crack: 3, runes: [1, 0, 1], seam: 2, sw: 26, swT: 0.55, sparks: [[AX - 10, 70]] });
    case 3:
      return L([43, 27], [31, 74], { fa: 0, crack: 3, runes: [1, 1, 1], seam: 2, sw: 20, swT: 0.8, tp: 1, dust: [[AX - 16, 84, 3], [AX - 11, 85, 2]] });
    case 4:
      return L([44, 27], [31, 74], { crack: 2, runes: [1, 2, 1], seam: 2, sw: 14, swT: 0.1, dust: [[AX - 17, 83, 2]] });
    case 5:
      return L([45, 25], [33, 71], { fa: -6, crack: 1, runes: [2, 1, 2], sw: 12, swT: 0.4 });
    default:
      return L([46, 24], [36, 74], { crack: 1, runes: [1, 1, 2], sw: 10, swT: 0.7 });
  }
}
export const HITMAGIC_HOLDS = [50, 60, 70, 90, 110, 120, 130];
export function hitMagicPose(f: number): Pose {
  if (f >= 6) return REST;
  const runes: readonly (readonly [number, number, number])[] = [[3, 0, 4], [0, 4, 1], [4, 1, 0], [1, 3, 4], [2, 0, 2], [1, 2, 1]];
  const flash = [0, 2, 1, 2, 1, 0][f];
  // rigid, trembling 1 px: the hip alternates
  const hip: Pt = [HIP0[0] + (f % 2 === 0 ? 0 : -1), HIP0[1] + (f === 1 || f === 3 ? 1 : 0)];
  const sp: readonly (readonly Pt[])[] = [[], [[AX - 2, 55], [AX + 4, 61]], [[AX + 1, 52], [AX - 3, 67], [AX + 5, 58]], [[AX + 2, 50], [AX - 5, 64]], [[AX + 4, 56]], []];
  return plate(
    L(hip, ANKLE0, { runes: runes[f], flash, spill: f <= 3 ? 2 : 1, seam: f <= 3 ? 3 : 2, floor: f <= 3 ? 2 : 1, sparks: sp[f] as Pt[], sw: 14 - f * 2, swT: f * 0.2 }),
    0,
    0,
  );
}

// ------------------------------------------------------------------ summon (10 frames): the fall, the slam, the re-bend

export const SUMMON_HOLDS = [90, 80, 70, 60, 40, 100, 110, 120, 130, 150];
export function summonPose(f: number): Pose {
  const dy = [-8, -6, -4, -1, 1][f];
  switch (f) {
    case 0:
      return L([46, 22], [40, 64], { dy: -8, fa: 14, runes: [1, 1, 1], seam: 2, floor: 0, links: 3, sw: 24, swT: 0.1, lines: [[AX + 12, 5, 9, 2], [AX + 18, 7, 14, 1], [AX + 6, 4, 8, 1]], loose: [[AX + 22, 17, 0], [AX + 24, 21, 1], [AX + 22, 25, 0]] });
    case 1:
      return L([46, 22], [39, 67], { dy: -6, fa: 10, runes: [1, 2, 1], seam: 2, floor: 0, sw: 20, swT: 0.3, lines: [[AX + 12, 6, 11, 2], [AX + 17, 8, 16, 2]], loose: [[AX + 22, 14, 1], [AX + 23, 18, 0], [AX + 21, 22, 1]] });
    case 2:
      return L([46, 22], [38, 71], { dy: -4, fa: 6, runes: [2, 2, 2], seam: 2, floor: 1, sw: 16, swT: 0.5, lines: [[AX + 12, 10, 14, 1]], loose: [[AX + 21, 20, 0], [AX + 20, 24, 1]] });
    case 3:
      return L([46, 22], [37, 74], { dy: -1, fa: 2, runes: [2, 3, 3], seam: 3, floor: 1, sw: 13, swT: 0.7 });
    case 4:
      // land: the foot is 1 px into the floor, the ring, dust and rubble, runes white-hot
      return L([46, 26], [37, 74], { dy, runes: [4, 4, 4], seam: 3, spill: 2, floor: 3, tp: 1, rings: [[10, 3]], fcrack: 1, sw: 20, swT: 0.9, sparks: [[AX + 14, 85], [AX - 4, 86], [AX + 21, 83]], dust: [[AX - 9, 84, 3], [AX + 23, 84, 3], [AX - 12, 82, 2], [AX + 26, 82, 2]], chips: [{ x: AX - 15, y: 77, k: 0 }, { x: AX + 27, y: 75, k: 1 }] });
    case 5:
      return L([46, 27], [37, 74], { runes: [3, 3, 3], seam: 3, spill: 2, floor: 2, tp: 1, rings: [[18, 3], [7, 1]], fcrack: 3, sw: 14, swT: 0.1, dust: [[AX - 13, 80, 3], [AX + 28, 79, 3], [AX - 17, 77, 2]], chips: [{ x: AX - 18, y: 74, k: 0 }, { x: AX + 30, y: 72, k: 1 }] });
    case 6:
      return L([46, 28], [37, 74], { runes: [2, 2, 2], seam: 2, floor: 1, tp: 1, rings: [[25, 2]], fcrack: 3, sw: 10, swT: 0.4, dust: [[AX - 16, 77, 2], [AX + 32, 76, 2]], chips: [{ x: AX - 20, y: 80, k: 0 }, { x: AX + 32, y: 79, k: 0 }] });
    case 7: // the knee re-bends: the hip comes up in two steps
      return plate(L([46, 26], [37, 74], { runes: [1, 2, 2], seam: 2, floor: 1, fcrack: 2, sw: 12, swT: 0.7, rings: [[30, 1]], dust: [[AX - 18, 75, 1]] }), 0, 1);
    case 8:
      return plate(L([46, 24], [37, 74], { runes: [1, 1, 2], seam: 1, floor: 1, fcrack: 1, sw: 10, swT: 0.9 }), 0, 0);
    default:
      return REST;
  }
}

// ------------------------------------------------------------------ death (8 frames): the knee gives, the leg topples and folds

export const DEATH_HOLDS = [60, 70, 90, 100, 110, 100, 90, 80];
/** The fallen leg: thigh and shin lie in line on the floor, broken apart at the knee band, the foot propped on its heel. */
const FALLEN: Pose = pose({ hip: [14, 77], knee: [44, 75], knee2: [48, 77], kneeP: [53, 80], ankle: [69, 70], fa: -90 });
const START: Pose = heavyF0();
export function deathPose(f: number): Pose {
  if (f === 0) return START;
  const t = [0, 0.1, 0.27, 0.48, 0.68, 0.84, 0.94, 1][f];
  const m = mixJ(START, FALLEN, easeIO(t));
  m.ankle = [m.ankle[0], m.ankle[1] - Math.sin(Math.PI * easeIO(t)) * 9];
  m.knee2 = [m.knee2![0], m.knee2![1] - Math.sin(Math.PI * easeIO(t)) * 4];
  // the knee gives first: the hip sinks before the foot moves; the foot lifts a little as it is dragged
  const sink = f === 1 ? 6 : f === 2 ? 4 : 0;
  const runes: readonly (readonly [number, number, number])[] = [[0, 0, 0], [2, 1, 0], [2, 0, 0], [1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const p: Pose = {
    ...m,
    hip: [m.hip[0], m.hip[1] + sink],
    runes: runes[f] as Pose['runes'],
    crack: f <= 2 ? f + 1 : f < 5 ? 2 : 3,
    seam: f < 5 ? 2 : 1,
    spill: 0,
    floor: f < 6 ? 1 : 0,
    gap: f >= 3 ? 2 : 0,
    sw: [12, 14, 16, 12, 8, 5, 3, 0][f],
    swT: f * 0.17,
    links: f >= 6 ? 2 : 3,
    fcrack: f >= 5 ? 2 : 0,
    motes: f >= 5 ? [[26 + f, 60 + f * 2, 2], [40 - f, 66, 3], [52, 62 + f, 1]] : [],
    chips: f >= 4 ? [{ x: 40 - f * 2, y: 70 + (f >= 5 ? 6 : 0), k: 1 }, { x: 52 + f, y: 74 + (f >= 6 ? 4 : 0), k: 0 }] : [],
    dust: f >= 4 ? [[20 + f * 5, 84, 2], [62 - f, 84, 2]] : [],
    sparks: f === 4 ? [[44, 70]] : [],
  };
  return p;
}

// ------------------------------------------------------------------ revive (10 frames): the sections slide together and rise

export const REVIVE_HOLDS = [120, 110, 100, 100, 100, 100, 100, 110, 120, 130];
export function revivePose(f: number): Pose {
  if (f >= 9) return REST;
  if (f >= 6) {
    // settled on the floor: the hip comes up in steps, the knee re-bends
    const hy = [27, 25, 23][f - 6];
    return plate(L([46, hy], ANKLE0, { runes: [[2, 3, 3], [2, 2, 3], [1, 2, 2]][f - 6] as unknown as Pose['runes'], seam: 2, spill: 2, floor: 2, fcrack: f === 6 ? 2 : 1, tp: f === 6 ? 1 : 0, sw: 14 - (f - 6) * 3, swT: (f - 6) * 0.3, rings: f === 6 ? [[24, 1]] : [] }), 0, f === 6 ? 1 : 0);
  }
  const t = [1, 0.93, 0.78, 0.55, 0.28, 0.06][f];
  const m = mixJ(START, FALLEN, easeIO(t));
  m.ankle = [m.ankle[0], m.ankle[1] - Math.sin(Math.PI * easeIO(t)) * 9];
  m.knee2 = [m.knee2![0], m.knee2![1] - Math.sin(Math.PI * easeIO(t)) * 4];
  const runes: readonly (readonly [number, number, number])[] = [[0, 0, 0], [0, 0, 1], [0, 1, 2], [1, 2, 3], [2, 3, 3], [3, 3, 3]];
  return {
    ...m,
    runes: runes[f] as Pose['runes'],
    crack: f < 2 ? 3 : f < 4 ? 2 : 1,
    seam: f >= 3 ? 2 : 1,
    spill: f >= 3 ? 2 : 0,
    floor: f >= 4 ? 2 : 1,
    gap: t > 0.4 ? 2 : t > 0.15 ? 1 : 0,
    sw: [0, 3, 8, 12, 16, 14][f],
    swT: f * 0.19,
    links: f >= 2 ? 3 : 2,
    fcrack: f >= 5 ? 2 : 0,
    rings: f === 5 ? [[10, 3]] : [],
    sparks: f === 5 ? [[AX + 14, 85], [AX - 4, 86]] : [],
    motes: f <= 4 ? [[26 + f, 60 - f, 2], [42, 66 - f * 2, 3]] : [],
    chips: f <= 2 ? [{ x: 40 - f * 2, y: 76 - f, k: 1 }] : [],
    dust: f === 5 ? [[AX - 9, 84, 3], [AX + 23, 84, 3]] : [],
  };
}

// ------------------------------------------------------------------ registry

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: { frames: IDLE_N, fps: 10, loop: true, holds: IDLE_HOLDS },
  guard: { frames: GUARD_N, fps: 8, loop: true, holds: GUARD_HOLDS },
  attack: { frames: 15, fps: 10, loop: false, holds: ATTACK_HOLDS, marks: { charge: 1, release: 8, impact: 8, contact: 8, recover: 10 } },
  roar: { frames: 9, fps: 10, loop: false, holds: ROAR_HOLDS, marks: { charge: 1, release: 5, impact: 5, recover: 7 } },
  hit: { frames: 5, fps: 12, loop: false, holds: HIT_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: { frames: 10, fps: 10, loop: false, holds: SUMMON_HOLDS, marks: { land: 4 } },
  death: { frames: 8, fps: 10, loop: false, holds: DEATH_HOLDS, marks: { impact: 0, contact: 0, dissolve: 4 } },
  revive: { frames: 10, fps: 10, loop: false, holds: REVIVE_HOLDS, marks: { land: 5 } },
  hitHeavy: { frames: 8, fps: 12, loop: false, holds: HITHEAVY_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  hitMagic: { frames: 7, fps: 12, loop: false, holds: HITMAGIC_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  toGuard: { frames: 5, fps: 15, loop: false, holds: TOGUARD_HOLDS },
  fromGuard: { frames: 5, fps: 12, loop: false, holds: FROMGUARD_HOLDS },
};
export const IMPACT = 8;

export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  switch (anim) {
    case 'idle':
      return idlePose(f);
    case 'guard':
      return guardPose(f);
    case 'attack':
      return attackPose(f);
    case 'roar':
      return roarPose(f);
    case 'hit':
      return hitPose(f);
    case 'hitHeavy':
      return hitHeavyPose(f);
    case 'hitMagic':
      return hitMagicPose(f);
    case 'summon':
      return summonPose(f);
    case 'death':
      return deathPose(f);
    case 'revive':
      return revivePose(f);
    case 'toGuard':
      return toGuardPose(f);
    case 'fromGuard':
      return fromGuardPose(f);
    default:
      return idlePose(0);
  }
}

// ------------------------------------------------------------------ points

export const MUZZLE = (() => {
  const g = footGeom(REST);
  return { x: rnd(g.sole[0]), y: rnd(g.sole[1]) };
})();
export const CORE = (() => {
  const g = segGeom(REST.knee, REST.ankle);
  const c = [g.a[0] + g.u[0] * g.len * 0.5, g.a[1] + g.u[1] * g.len * 0.5];
  return { x: rnd(c[0]), y: rnd(c[1]) };
})();

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const p = framePose(anim, f);
  const g = footGeom(p);
  const sh = segGeom(p.knee2 ?? p.knee, [p.ankle[0], p.ankle[1] + p.dy]);
  const core = { x: rnd(sh.a[0] + sh.u[0] * sh.len * 0.5), y: rnd(sh.a[1] + sh.u[1] * sh.len * 0.5) };
  const planted = p.dy === 0 && p.ankle[1] >= 73 && Math.abs(p.fa) < 3;
  const feet = planted ? { x: AX, y: AY } : { x: rnd(g.centre[0]), y: Math.min(AY, rnd(g.centre[1] + 4)) };
  return {
    muzzle: { x: rnd(g.sole[0]), y: rnd(g.sole[1]) },
    core,
    head: { x: rnd(p.hip[0]), y: rnd(p.hip[1] + p.dy - 3) },
    claw: { x: rnd(g.claw[0]), y: rnd(g.claw[1]) },
    feet,
  };
}
void TAU;
