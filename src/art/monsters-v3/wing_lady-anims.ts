// Kanat Hanımı v3 — animations of the kestrel-winged swordswoman: pose tables, holds, marks, points.
// (Design: docs/v3/oturum-f/wing_lady.md §1–§4 with the critique fold-in §11.)

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { BRAID0, GY, NEUTRAL, SASH0, WING_FAR0, WING_NEAR0, jewelOf, skeleton, type Pose, type Ribbon, type Wing } from './wing_lady-rig';

const rnd = Math.round;
type PD = Partial<Omit<Pose, 'wn' | 'wf' | 'braid' | 'sash'>> & { wn?: Partial<Wing>; wf?: Partial<Wing>; braid?: Partial<Ribbon>; sash?: Partial<Ribbon> };

/** A pose from deltas over a base (idle f0 by default); the wings and ribbons merge field by field. */
function K(d: PD, base: Pose = IDLE0()): Pose {
  return {
    ...base,
    ...d,
    wn: { ...base.wn, ...(d.wn ?? {}) },
    wf: { ...base.wf, ...(d.wf ?? {}) },
    braid: { ...base.braid, ...(d.braid ?? {}) },
    sash: { ...base.sash, ...(d.sash ?? {}) },
  } as Pose;
}

/** In-between of two poses (numbers lerp; discrete fields switch at t ≥ 0.5; nested wings / ribbons lerp). */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const lerpObj = (x: Record<string, unknown>, y: Record<string, unknown>) => {
    const o: Record<string, unknown> = { ...y };
    for (const k of Object.keys(x)) {
      const u = x[k];
      const v = y[k];
      o[k] = typeof u === 'number' && typeof v === 'number' ? u + (v - u) * t : t < 0.5 ? u : v;
    }
    return o;
  };
  const o = lerpObj(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>);
  for (const k of ['wn', 'wf', 'braid', 'sash'] as const) o[k] = lerpObj(a[k] as unknown as Record<string, unknown>, b[k] as unknown as Record<string, unknown>);
  return o as unknown as Pose;
}

const TAU = Math.PI * 2;
const sn = (x: number) => Math.sin(x * TAU);

// ------------------------------------------------------------------ idle (16 frames, 1.9 s)
// The wings breathe (one slow "taste of the air", widest at f7 — the beat the aura copies), the primaries lag
// the arm by a frame (overlap), the coverts ripple twice, braid and sash travel half a loop apart, the head
// tilts 1 px to listen at f11–f12, the blade glints at f8–f10, the jewel dims on f10–f15.

const IDLE_N = 16;
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const t = k / IDLE_N;
  // breath: 0 at f0, peak at f7 (sin phase shifted so f0 is the calm)
  const br = (1 - Math.cos(t * TAU)) / 2;
  const lag = (1 - Math.cos((t - 1 / IDLE_N) * TAU)) / 2;
  return {
    ...NEUTRAL,
    // the breath shows in the body: the chest (and with it the shoulders, the wing roots and the head) rises a
    // pixel through the wing breath (f4–f11)
    chest: k >= 4 && k <= 10 ? -1 : 0,
    // the head lags the chest by a frame each way (f4 up late, f11 down late), then the 1-px "listening" dip at f13
    hy: k === 4 || k === 13 ? 1 : k === 11 ? -1 : 0,
    wn: { ...WING_NEAR0, a: WING_NEAR0.a + 2 - 10 * br, len: WING_NEAR0.len + 1.5 * br, bend: WING_NEAR0.bend + 3 - 8 * lag + 4 * sn(2 * t), cv: 0.42 + 0.07 * sn(2 * t) },
    wf: { ...WING_FAR0, a: WING_FAR0.a - 1 + 7 * lag, len: WING_FAR0.len + 1.2 * lag, bend: WING_FAR0.bend + 3 - 7 * br + 4 * sn(2 * t + 0.25), cv: 0.45 + 0.07 * sn(2 * t + 0.25) },
    braid: { ...BRAID0, ph: t, amp: 2.4 },
    sash: { ...SASH0, ph: t + 0.5, flick: k === 5 || k === 13 ? 1.5 : 0 },
    jewel: k >= 10 ? 1 : 2,
    glint: k === 8 || k === 10 ? 1 : k === 9 ? 2 : 0,
  };
}
const IDLE_HOLDS = [110, 120, 130, 140, 120, 110, 100, 120, 130, 140, 120, 110, 100, 120, 130, 120];
let idle0: Pose | null = null;
function IDLE0(): Pose {
  if (!idle0) idle0 = idlePose(0);
  return idle0;
}

// ------------------------------------------------------------------ guard "Kanat Kalkanı" (6, loop)
// Asymmetric: the near wing swung forward over the shoulder as a buckler (primaries fanned down in front of
// her chest), the sword held in parry across the body in front of it, the far wing still up in the V.

const G0: PD = {
  crouch: 1,
  lean: 1,
  hx: 1,
  nearFront: true,
  // the buckler: the near wing's arm swung forward over the shoulder, its hand dropping in front of her as a
  // feathered shield, the primaries fanned down as separate points at belt height
  wn: { a: -6, len: 27, bend: 78, chord: 10, side: -1, cv: 0.48, ps: 0.56 },
  wf: { a: -128, len: 26, bend: -18 },
  // the parry blade crosses IN FRONT of the buckler, its whole length clear above the wing's edge — held level and
  // forward on the fencer's line (round 2 #9: no longer raised up like every other guard: the tip path from idle is
  // forward, not up)
  gx: 46,
  gy: 37,
  sa: -12,
  sash: { th: 150, amp: 1 },
  braid: { th: 110, amp: 0.8 },
};
const GUARD_N = 6;
function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const t = k / GUARD_N;
  // round 2 #9 (sameness vs steel_silencer's guard loop): three layers on three different clocks, none of them the
  // body's — the buckler's primaries FLUTTER on f2 / f4 only (a quick fan-out of the hand and the chord, a kestrel
  // shaking its feathers), the far wing BREATHES on f1 and f3–f5 (a 1-2-1 lift that skips f2), and the parry blade
  // feints on the flutter beats; the body holds still; the holds are uneven (long rest, short flutter beats)
  const flutter = k === 2 ? 0.7 : k === 4 ? 0.45 : 0;
  const farLift = [0, 1, 0, 1, 1.2, 0.5][k];
  return K({
    ...G0,
    // the parry blade answers the flutter: it ticks forward-down on the flutter beats (a fencer's wrist feint,
    // f2 / f4) and lifts back on f3 / f5 — a two-cycle tip path no other guard loop has
    sa: -12 + [0, 0, 2, 0, 2, 0][k],
    wn: { ...G0.wn, bend: 46 + 3 * flutter, chord: 10 + Math.round(flutter), ps: 0.56 - 0.03 * flutter },
    wf: { ...G0.wf, a: -128 - farLift, len: 26 + (k === 4 ? 1 : 0) },
    sash: { ...G0.sash, ph: t, flick: k === 3 ? 1.5 : 0 },
    braid: { ...G0.braid, ph: t },
    glint: 0,
  });
}
const GUARD_HOLDS = [200, 150, 90, 170, 80, 180];

// ------------------------------------------------------------------ toGuard / fromGuard
// toGuard: the near wing rises (straight up, behind the head), then sweeps forward over the shoulder and down.
const UPW: PD = { wn: { a: -88, len: 27, bend: 0, chord: 10, side: 1, cv: 0.45, ps: 0.66 } };
const OVER: PD = { nearFront: true, wn: { a: -55, len: 26, bend: 20, chord: 10, side: -1, cv: 0.48, ps: 0.64 } };
function toGuardPose(f: number): Pose {
  const g = guardPose(0);
  const i0 = IDLE0();
  // f3 / f4 double as her GUARD-HIT (MonsterUnit.brace plays toGuard f4 → f3 → f4 → guard on a blocked blow):
  // f3 the buckler bends under the blow (the wing hand pressed up, the shoulders rocked back, the knees give),
  // f4 it flares back out (the primaries fanned 2–3 px wider) before it settles into the guard
  const bend = K({ ...G0, lean: -1, crouch: 2, hx: 0, gx: 45, gy: 38, sa: -22, wn: { ...(G0.wn as Wing), a: -16, len: 25, bend: 60, chord: 10 } });
  const flare = K({ ...G0, lean: 0, wn: { ...(G0.wn as Wing), len: 28, chord: 12, bend: 74, ps: 0.52 } });
  const keys = [K(UPW, mix(i0, g, 0.15)), K({ ...UPW, wn: { ...UPW.wn, a: -80 } }, mix(i0, g, 0.35)), K(OVER, mix(i0, g, 0.55)), mix(K(OVER, mix(i0, g, 0.7)), bend, 0.6), flare, g];
  return keys[f] ?? g;
}
const TG_HOLDS = [50, 60, 60, 70, 70, 80];
function fromGuardPose(f: number): Pose {
  const g = guardPose(0);
  const i0 = IDLE0();
  const keys = [mix(g, K(OVER, g), 0.5), K(OVER, mix(g, i0, 0.4)), K(UPW, mix(g, i0, 0.65)), mix(K(UPW, i0), i0, 0.6), i0];
  return keys[f] ?? i0;
}
const FG_HOLDS = [60, 60, 70, 70, 70];

// ------------------------------------------------------------------ attack "Kerkenez Hamlesi" (12)
// crouch (wings lift, blade drawn back) · downstroke rise · HOVER (f2/f3: only the wings move — the head, the
// jewel and the blade are pixel-identical: the kestrel's locked head) · fold into a swept V · the flat stoop
// (release) · contact: the WING CLAP, both wings snapped forward around the target, the blade thrust · rebound
// up and back, wings open · two back-flaps home · touch down.

const HOVER: PD = { by: -5, crouch: 0, lean: 1, fbx: 33, fby: GY - 1, ffx: 39, ffy: GY, gx: 39, gy: 45, sa: 195, face: 'calm', jewel: 2 };
const A_N = 14;
/** the clap (contact): both wings arc AHEAD of a clear body — the far wing high, the near wing low, their tips
 *  curling toward each other like brackets — and the blade thrust straight out between them, point first */
const CLAP: PD = {
  bx: 9, by: -2, rot: 8, lean: 2, fbx: 31, fby: GY, ffx: 39, ffy: GY - 1, gx: 51, gy: 39, sa: -4, nearBack: true, face: 'struck',
  wn: { a: 84, len: 34, bend: -104, chord: 9, side: -1, cv: 0.45, ps: 0.62 },
  wf: { a: -24, len: 33, bend: 52, chord: 8, side: 1, cv: 0.45, ps: 0.62 },
  sash: { th: 175, ph: 0.8 }, braid: { th: 150, ph: 0.8 }, glint: 2,
};
function attackPose(f: number): Pose {
  const keys: PD[] = [
    { wn: { a: -134 }, wf: { a: -101 } },
    { crouch: 3, lean: -1, gx: 39, gy: 47, sa: 190, wn: { a: -150, len: 29, bend: -6 }, wf: { a: -116, bend: -8 }, sash: { ph: 0.3 }, braid: { ph: 0.3 } },
    { ...HOVER, wn: { a: 148, len: 27, bend: 18, chord: 10 }, wf: { a: 122, len: 22, bend: 14 }, sash: { ph: 0.45, th: 160 }, braid: { ph: 0.4 } },
    { ...HOVER, wn: { a: -150, len: 29, bend: -4 }, wf: { a: -118, len: 24, bend: -6 }, sash: { ph: 0.45, th: 160 }, braid: { ph: 0.4 } },
    { by: -3, rot: 14, lean: 2, fbx: 33, fby: GY - 1, ffx: 38, ffy: GY - 1, gx: 46, gy: 43, sa: 4, wn: { a: 176, len: 22, bend: 8, chord: 9 }, wf: { a: 166, len: 20, bend: 8 }, sash: { th: 178, ph: 0.6 }, braid: { th: 150, ph: 0.6 } },
    // the stoop: ONE streamlined line — torso, legs trailing straight behind (ankles together, toes pointed),
    // head up along the flight line, the blade pointing AHEAD, the wings swept back flat along the body
    { bx: 6, by: -6, rot: 64, hr: -50, lean: 0, crouch: 0, fbx: 35, fby: GY, ffx: 37, ffy: GY - 1, gx: 41, gy: 27, sa: -52, rgx: 34, rgy: 44, wn: { a: 140, len: 24, bend: 6, chord: 8 }, wf: { a: 132, len: 21, bend: 6, chord: 7 }, sash: { th: 120, ph: 0.7, amp: 0.6 }, braid: { th: 110, ph: 0.7, amp: 0.6, curl: 6 } },
    CLAP,
    // recoil a: the brackets spring OUTWARD (the clap opens), the torso starts to unroll head-first, the blade
    // still out — also the blocked "clap fails" pose (held on the guard)
    { ...CLAP, bx: 8, by: -3, rot: 4, lean: 1, gx: 49, gy: 40, sa: -12, wn: { a: 96, len: 32, bend: -70, chord: 9, side: -1, cv: 0.45, ps: 0.62 }, wf: { a: -96, len: 30, bend: 66, chord: 8, side: 1, cv: 0.45, ps: 0.64 }, sash: { th: 160, ph: 0.85 }, braid: { th: 135, ph: 0.85 }, glint: 1 },
    // recoil b: the wings sweep up through level (both spread back, tips separate), the body upright, arm coming back
    { bx: 6, by: -4, rot: 0, lean: 0, fbx: 32, fby: GY - 1, ffx: 39, ffy: GY, gx: 48, gy: 40, sa: -22, face: 'struck', wn: { a: 178, len: 28, bend: -8, chord: 10 }, wf: { a: -150, len: 25, bend: -4 }, sash: { th: 140, ph: 0.9, flick: 1 }, braid: { th: 115, ph: 0.9 } },
    { bx: 5, by: -5, rot: 0, lean: 0, fbx: 32, fby: GY - 1, ffx: 39, ffy: GY, gx: 46, gy: 40, sa: -30, wn: { a: -160, len: 28, bend: -2 }, wf: { a: -96, len: 26, bend: 10 }, sash: { th: 130, ph: 0.95, flick: 2 }, braid: { th: 100, ph: 0.95 }, glint: 1 },
    { bx: 3, by: -4, fbx: 32, fby: GY - 1, ffx: 39, ffy: GY, gx: 44, gy: 44, sa: 30, wn: { a: 150, len: 27, bend: 16 }, wf: { a: 124, len: 22, bend: 12 }, sash: { th: 150, ph: 0.05 }, braid: { ph: 0.05 } },
    { bx: 1, by: -2, fbx: 32, fby: GY - 1, ffx: 39, ffy: GY, gx: 43, gy: 46, sa: 60, wn: { a: -146, len: 29, bend: -6 }, wf: { a: -112, len: 24 }, sash: { ph: 0.2 }, braid: { ph: 0.2 } },
    { crouch: 2, gx: 43, gy: 48, sa: 70, wn: { a: -128, len: 27 }, wf: { a: -98 }, sash: { ph: 0.3 }, braid: { ph: 0.3 } },
  ];
  if (f >= A_N - 1) return IDLE0();
  return K(keys[f]);
}
const ATTACK_HOLDS = [70, 110, 100, 200, 130, 50, 60, 50, 50, 80, 110, 120, 130, 150];
/** attack frame names the cinematic uses (kept in one place) */
export const ATK = { crouch: 1, hoverDown: 2, hoverUp: 3, fold: 4, stoop: 5, clap: 6, open: 7, sweep: 8, rebound: 9, back1: 10, back2: 11, touch: 12, end: 13 } as const;

// ------------------------------------------------------------------ special "Kanat Selamı" (12)
// wings lift to half-span, the blade rises overhead tip-up, the jewel brightens step by step · ONE full
// downstroke (release: the currents leave the tips) · the salute: the flat of the blade to her brow · settle.

const SP_N = 12;
function specialPose(f: number): Pose {
  const keys: PD[] = [
    { wn: { a: -134 }, wf: { a: -101 }, jewel: 2 },
    { chest: -1, gx: 42, gy: 40, sa: -60, wn: { a: -148, len: 29 }, wf: { a: -110, len: 24 }, jewel: 2 },
    { chest: -1, gx: 41, gy: 33, sa: -84, wn: { a: -158, len: 30, bend: -6 }, wf: { a: -118, len: 25, bend: -8 }, jewel: 3 },
    { chest: -1, gx: 41, gy: 31, sa: -88, face: 'sing', wn: { a: -164, len: 31, bend: -4 }, wf: { a: -124, len: 25, bend: -6 }, jewel: 3, glint: 1 },
    { crouch: 1, gx: 41, gy: 31, sa: -88, face: 'sing', wn: { a: 150, len: 29, bend: 22, chord: 11 }, wf: { a: 118, len: 24, bend: 18 }, jewel: 3, glint: 2, sash: { th: 120, flick: 2 }, braid: { th: 90 } },
    { crouch: 1, gx: 41, gy: 31, sa: -88, face: 'sing', wn: { a: 168, len: 30, bend: 10, chord: 11 }, wf: { a: 140, len: 25, bend: 8 }, jewel: 3, glint: 1, sash: { th: 130, ph: 0.3 }, braid: { th: 96, ph: 0.3 } },
    { gx: 42, gy: 32, sa: -100, hr: -4, face: 'sing', wn: { a: -176, len: 29, bend: 0 }, wf: { a: -140, len: 24 }, jewel: 2, sash: { ph: 0.45 }, braid: { ph: 0.45 } },
    { gx: 42, gy: 32, sa: -100, face: 'sing', wn: { a: -160, len: 28 }, wf: { a: -122, len: 24 }, jewel: 2, sash: { ph: 0.6 }, braid: { ph: 0.6 } },
    { gx: 42, gy: 35, sa: -70, wn: { a: -148, len: 28 }, wf: { a: -112 }, jewel: 2, sash: { ph: 0.75 }, braid: { ph: 0.75 } },
    { gx: 43, gy: 41, sa: 10, wn: { a: -140 }, wf: { a: -106 }, sash: { ph: 0.85 }, braid: { ph: 0.85 } },
    { gx: 42, gy: 46, sa: 70, wn: { a: -134 }, wf: { a: -102 }, sash: { ph: 0.95 }, braid: { ph: 0.95 } },
  ];
  if (f >= SP_N - 1) return IDLE0();
  return K(keys[f]);
}
const SPECIAL_HOLDS = [80, 100, 120, 160, 60, 90, 110, 120, 120, 130, 140, 150];

// ------------------------------------------------------------------ roar "Çağrı" (10)
// gathers (wings in, chin down, eyes shut) · head back and SINGS: the wings open wide (span ≈ 60), the jewel
// flares to a cross · the note holds · settle.

const R_N = 10;
function roarPose(f: number): Pose {
  const keys: PD[] = [
    { wn: { a: -130 }, wf: { a: -99 } },
    { crouch: 1, hr: 10, face: 'closed', wn: { a: -118, len: 25, bend: -20 }, wf: { a: -92, len: 21 }, jewel: 1 },
    { crouch: 2, hr: 12, face: 'closed', wn: { a: -114, len: 24, bend: -22 }, wf: { a: -90, len: 20 }, jewel: 1, sash: { ph: 0.2 } },
    { chest: -1, hr: -16, face: 'sing', wn: { a: -168, len: 31, bend: 4, chord: 11 }, wf: { a: -94, len: 27, bend: 12 }, jewel: 3, sash: { th: 120, flick: 2, ph: 0.35 }, braid: { th: 80, ph: 0.35 } },
    { chest: -1, hr: -16, face: 'sing', wn: { a: -170, len: 31, bend: 8, chord: 11 }, wf: { a: -92, len: 27, bend: 14 }, jewel: 3, sash: { th: 125, ph: 0.5 }, braid: { th: 85, ph: 0.5 } },
    { hr: -10, face: 'sing', wn: { a: -160, len: 30, bend: 0 }, wf: { a: -94, len: 26 }, jewel: 2, sash: { ph: 0.62 }, braid: { ph: 0.62 } },
    { hr: -6, face: 'sing', wn: { a: -150, len: 29 }, wf: { a: -96 }, sash: { ph: 0.74 }, braid: { ph: 0.74 } },
    { hr: -2, wn: { a: -142 }, wf: { a: -92 }, sash: { ph: 0.84 }, braid: { ph: 0.84 } },
    { wn: { a: -136 }, wf: { a: -98 }, sash: { ph: 0.93 }, braid: { ph: 0.93 } },
  ];
  if (f >= R_N - 1) return IDLE0();
  return K(keys[f]);
}
const ROAR_HOLDS = [80, 110, 160, 70, 110, 100, 110, 110, 120, 130];

// ------------------------------------------------------------------ hits
// hit: the wings jolt up, the head snaps back · a half step back, the sash whips forward · the wings come down
// in two beats, the head re-locks.
function hitPose(f: number): Pose {
  const keys: PD[] = [
    // f0 stays local (KK-4): the struck face, the wings jolt a step
    { face: 'struck', chest: -1, wn: { a: -137, len: 28 }, wf: { a: -101 }, jewel: 2 },
    // f1–f2: the torso snaps back from the hips (feet planted), the head tips back with the eyes shut, the wings
    // flare out
    { lean: -2, hx: -1, crouch: 1, hr: -8, face: 'closed', gx: 42, gy: 47, wn: { a: -150, len: 30, bend: -10, chord: 11 }, wf: { a: -112, len: 26 }, sash: { th: 60, curl: -20 }, braid: { th: 70 } },
    { lean: -3, hx: -1, crouch: 2, hr: -10, face: 'closed', gx: 41, gy: 48, wn: { a: -154, len: 30, bend: -14, chord: 11 }, wf: { a: -114, len: 26 }, sash: { th: 90 }, braid: { th: 80 } },
    // f3–f4: she rocks forward past upright (overshoot), the wings come down, the head re-locks
    { lean: 1, crouch: 1, hr: 2, wn: { a: -126, len: 27, bend: -18 }, wf: { a: -96 }, sash: { th: 130, ph: 0.3 }, braid: { th: 110 } },
    { wn: { a: -131 }, wf: { a: -99 }, sash: { ph: 0.4 } },
  ];
  return f >= 5 ? IDLE0() : K(keys[f]);
}
const HIT_HOLDS = [50, 70, 150, 110, 120, 130];

// hitHeavy: knocked back with asymmetric wings (near flung high, far dropped) · a knee bends, the sword arm
// thrown wide · the near wing BRACES down to the floor like a crutch · she pushes up off it and refolds.
function hitHeavyPose(f: number): Pose {
  const keys: PD[] = [
    { face: 'struck', wn: { a: -139, len: 28, bend: -9 }, wf: { a: -96, len: 22 } },
    { bx: -2, crouch: 3, lean: -2, hx: -1, hr: -6, face: 'closed', gx: 37, gy: 50, sa: 130, wn: { a: -160, len: 27 }, wf: { a: 84, len: 21, bend: 10 }, sash: { th: 70, curl: -20 }, braid: { th: 60 } },
    { bx: -3, crouch: 5, lean: -1, face: 'struck', gx: 40, gy: 50, sa: 110, wn: { a: 118, len: 26, bend: 6, chord: 9 }, wf: { a: -86 }, sash: { th: 110 }, braid: { th: 90 } },
    { bx: -2, crouch: 4, gx: 44, gy: 46, sa: 60, wn: { a: 128, len: 26, bend: 0 }, wf: { a: -94 }, sash: { th: 130, ph: 0.3 } },
    { bx: -1, crouch: 2, gx: 43, gy: 47, sa: 80, wn: { a: -160, len: 27, bend: -6 }, wf: { a: -100 }, sash: { ph: 0.45 } },
    { crouch: 1, wn: { a: -138 }, wf: { a: -101 }, sash: { ph: 0.6 } },
  ];
  return f >= 6 ? IDLE0() : K(keys[f]);
}
const HH_HOLDS = [50, 60, 130, 110, 100, 120, 130];

// hitMagic: the wings snap shut around her by instinct (half wrap), the jewel blinks out · a 1-px shudder ·
// the wings reopen, the jewel relights in steps.
const SHUT: PD = { nearFront: true, wn: { a: -40, len: 24, bend: 58, chord: 10, side: -1, cv: 0.5, ps: 0.62 }, wf: { a: -96, len: 19, bend: -10 } };
function hitMagicPose(f: number): Pose {
  const keys: PD[] = [
    { face: 'closed', jewel: 0, chest: -1, wn: { a: -129, len: 28 }, wf: { a: -100 } },
    { ...SHUT, bx: 1, face: 'closed', hr: 6, crouch: 1, jewel: 0, sash: { th: 120 } },
    { ...SHUT, bx: -1, face: 'closed', hr: 6, crouch: 1, jewel: 1, sash: { th: 140 } },
    { wn: { a: -88, len: 26, bend: 0, side: 1, chord: 10, cv: 0.45, ps: 0.66 }, wf: { a: -92 }, crouch: 1, jewel: 1 },
    { wn: { a: -120, len: 27 }, wf: { a: -98 }, jewel: 2, sash: { ph: 0.3 } },
    { wn: { a: -134 }, wf: { a: -101 }, sash: { ph: 0.45 } },
  ];
  return f >= 6 ? IDLE0() : K(keys[f]);
}
const HM_HOLDS = [50, 60, 120, 110, 100, 110, 130];

// ------------------------------------------------------------------ summon (13): the glide in, brake-flare, land
// f0 glide (body horizontal, wings spread, braid and sash straight back, sword tucked) · f1 banks level · f2–f3
// the BRAKE-FLARE: wings swing forward and up into a tall W, the body swings upright, feet forward · f4–f6
// three back-wing beats, sinking · f7 LAND (front toe) · f8 back foot, skid · f9 the wings snap-fold · f10 the
// blade comes up · f11 the salute (flat of the blade at her brow, jewel flare, the first note) · idle.
const SU_N = 16;
const GLIDE: PD = { rot: 74, hr: -62, fbx: 34, fby: GY, ffx: 37, ffy: GY - 1, gx: 40, gy: 44, sa: 92, rgx: 33, rgy: 45, braid: { th: 95, curl: 10, amp: 0.6 }, sash: { th: 92, curl: 6, amp: 0.6 } };
/** a back-wing beat's three wing positions (the body bobs with them: lifted on the downstroke, sinking on the
 *  upstroke; the braid and the sash answer one frame late) — the far wing always a separate, higher tip */
const BEAT_UP = { wn: { a: -142, len: 29, bend: -6, chord: 10 }, wf: { a: -104, len: 25, bend: -8 } };
const BEAT_MID = { wn: { a: 176, len: 30, bend: -4, chord: 11 }, wf: { a: -158, len: 26, bend: -6, chord: 9 } };
const BEAT_DOWN = { wn: { a: 160, len: 28, bend: 20, chord: 10 }, wf: { a: 120, len: 23, bend: -18, chord: 8 } };
const SU_FEET = { fbx: 34, fby: GY - 1, ffx: 41, ffy: GY - 2, gx: 43, gy: 46, sa: 66 };
function summonPose(f: number): Pose {
  const keys: PD[] = [
    { ...GLIDE, by: -4, wn: { a: 166, len: 32, bend: -12, chord: 11 }, wf: { a: -122, len: 27, bend: -10 } },
    { ...GLIDE, rot: 62, hr: -52, by: -6, wn: { a: 172, len: 31, bend: -6, chord: 11 }, wf: { a: -128, len: 26, bend: -6 }, braid: { ph: 0.2 }, sash: { ph: 0.2 } },
    // the brake-flare: the wings swing forward-up into a tall W BEHIND / ABOVE the head (the face kept clear)
    { rot: 24, by: -5, hr: -12, fbx: 36, fby: GY - 2, ffx: 42, ffy: GY - 3, gx: 42, gy: 44, sa: 120, wn: { a: -112, len: 29, bend: -4, chord: 11 }, wf: { a: -86, len: 26, bend: -14 }, braid: { th: 100, ph: 0.3 }, sash: { th: 110, ph: 0.3 } },
    { rot: 6, by: -5, fbx: 36, fby: GY - 1, ffx: 42, ffy: GY - 2, gx: 42, gy: 46, sa: 110, wn: { a: -118, len: 29, bend: -2, chord: 11 }, wf: { a: -90, len: 26, bend: -10 }, braid: { th: 96, ph: 0.4 }, sash: { th: 120, ph: 0.4 } },
    // beat 1: mid → down (lifted)
    { ...SU_FEET, by: -6, ...BEAT_MID, braid: { th: 92, ph: 0.45 }, sash: { th: 120, ph: 0.45 } },
    { ...SU_FEET, by: -8, ...BEAT_DOWN, braid: { th: 86, ph: 0.5 }, sash: { th: 118, ph: 0.5, flick: 1 } },
    // beat 2: mid → up (sinking) — the braid / sash still flung up from the downstroke
    { ...SU_FEET, by: -5, ...BEAT_MID, braid: { th: 78, ph: 0.58 }, sash: { th: 110, ph: 0.58, flick: 2 } },
    { ...SU_FEET, by: -3, ...BEAT_UP, braid: { th: 88, ph: 0.66 }, sash: { th: 124, ph: 0.66 } },
    // beat 3: mid → down, nearly home
    { ...SU_FEET, by: -2, ffy: GY - 1, ...BEAT_MID, braid: { th: 98, ph: 0.72 }, sash: { th: 128, ph: 0.72 } },
    { ...SU_FEET, by: -2, ffy: GY - 1, ...BEAT_DOWN, braid: { th: 92, ph: 0.76 }, sash: { th: 120, ph: 0.76, flick: 1 } },
    { crouch: 2, fbx: 32, fby: GY - 2, ffx: 41, ffy: GY, wn: { a: -122, len: 28, bend: -10 }, wf: { a: -92 }, braid: { ph: 0.8 }, sash: { ph: 0.8, th: 160 } },
    { crouch: 3, bx: 1, fbx: 31, ffx: 40, wn: { a: -140, len: 28, bend: -16 }, wf: { a: -104 }, braid: { ph: 0.9 }, sash: { ph: 0.9 } },
    { crouch: 1, wn: { a: -126, len: 24, bend: -20, chord: 9 }, wf: { a: -96, len: 21 }, braid: { ph: 0.0 }, sash: { ph: 0.0 } },
    { gx: 42, gy: 38, sa: -70, wn: { a: -128, len: 26 }, wf: { a: -98, len: 22 }, braid: { ph: 0.1 }, sash: { ph: 0.1 } },
    { gx: 41, gy: 31, sa: -96, face: 'sing', jewel: 3, glint: 2, wn: { a: -134, len: 28 }, wf: { a: -100 }, braid: { ph: 0.2 }, sash: { ph: 0.2 } },
  ];
  if (f >= SU_N - 1) return IDLE0();
  return K(keys[f]);
}
const SU_HOLDS = [120, 90, 70, 80, 50, 60, 50, 60, 50, 60, 70, 80, 70, 80, 150, 130];

// ------------------------------------------------------------------ death (10): "the falling cape"
// f0 struck (asymmetric wings) · f1 staggers back, the song breaks · f2 BOTH WINGS DROP over her like a falling
// cape, the jewel goes dark · f3 the knees go · f4 (dissolve) she tips forward · f5–f7 falls flat forward under
// the cape · f8–f9 the cape settles flat over her (the cinematic lifts a gold-rimmed bird outline off this).
const D_N = 10;
const CAPE = (rot: number): PD => ({
  piv: 1,
  rot,
  nearFront: true,
  face: 'closed',
  jewel: 0,
  gx: 41,
  gy: 49,
  sa: 100,
  // two wings DRAPED over the shoulders (not a shell): long and narrow, the near one hanging over her side, the
  // far one trailing further back, both primaries reaching the floor as separate points
  wn: { a: 98, len: 30, bend: 14, chord: 9, side: 1, cv: 0.45, ps: 0.72 },
  wf: { a: 128, len: 29, bend: 10, chord: 8, side: 1, cv: 0.45, ps: 0.72 },
  braid: { th: 95, amp: 0.4 },
  sash: { th: 100, amp: 0.4, len: 6 },
});
/** lying flat: both wings spread over her back toward the feet, the sash and braid lying on the floor */
const PRONE = (rot: number, k: number): PD => ({
  ...CAPE(rot),
  bx: -6,
  by: 1,
  crouch: 6,
  hr: 0,
  gx: 38,
  gy: 47,
  sa: 92,
  rgx: 35,
  rgy: 46,
  wn: { a: 112 - 4 * k, len: 27 - k, bend: -6, chord: 11 - k, side: 1, cv: 0.45, ps: 0.66 },
  wf: { a: 86 + 2 * k, len: 23 - k, bend: -4, chord: 9 },
  sash: { th: 40, amp: 0, curl: 0, len: 5 },
  braid: { th: 10, amp: 0.3, curl: 0, len: 12 },
});
function deathPose(f: number): Pose {
  const keys: PD[] = [
    { face: 'struck', wn: { a: -139, len: 28, bend: -10 }, wf: { a: -95, len: 22 } },
    { bx: -2, crouch: 1, hx: -1, face: 'struck', hr: -6, wn: { a: -160, len: 29 }, wf: { a: 84, len: 21 }, jewel: 1, sash: { th: 70, curl: -20 }, braid: { th: 60 } },
    { ...CAPE(0), bx: -2, crouch: 2, hr: 12 },
    { ...CAPE(4), bx: -2, crouch: 6, lean: 2, hr: 16 },
    { ...CAPE(22), bx: -3, crouch: 7, lean: 2, hr: 14 },
    { ...CAPE(46), bx: -4, crouch: 7, lean: 2, hr: 10, wn: { a: 100, len: 28, bend: 8, chord: 9, side: 1, cv: 0.45, ps: 0.72 } },
    { ...PRONE(72, 0), bx: -5, by: 0 },
    { ...PRONE(86, 0) },
    { ...PRONE(88, 1) },
    { ...PRONE(88, 2) },
  ];
  return K(keys[Math.min(f, D_N - 1)]);
}
const D_HOLDS = [50, 60, 150, 80, 70, 80, 90, 90, 90, 100];

// ------------------------------------------------------------------ revive (11): the fall reversed, then the wings
// burst open (land f5 ≈ 450 ms; the cinematic's ghost melts into f0, which lies on the tile).
const RV_N = 11;
function revivePose(f: number): Pose {
  if (f === 0) return deathPose(9);
  if (f === 1) return deathPose(7);
  if (f === 2) return deathPose(5);
  if (f === 3) return K({ ...deathPose(3), jewel: 1 } as PD);
  const keys: PD[] = [
    { crouch: 3, hr: 6, face: 'closed', jewel: 1, wn: { a: -96, len: 25, bend: -4 }, wf: { a: -84, len: 21 } },
    { chest: -1, hr: -8, face: 'sing', jewel: 3, glint: 2, wn: { a: -166, len: 31, bend: 6, chord: 11 }, wf: { a: -92, len: 27, bend: 12 }, sash: { th: 120, flick: 2 }, braid: { th: 85 } },
    { hr: -4, face: 'sing', jewel: 2, glint: 1, wn: { a: -152, len: 30 }, wf: { a: -94, len: 25 }, sash: { ph: 0.2 }, braid: { ph: 0.2 } },
    { wn: { a: -142, len: 29 }, wf: { a: -97 }, sash: { ph: 0.4 }, braid: { ph: 0.4 } },
    { wn: { a: -136 }, wf: { a: -96 }, sash: { ph: 0.6 }, braid: { ph: 0.6 } },
    { wn: { a: -133 }, wf: { a: -99 }, sash: { ph: 0.8 }, braid: { ph: 0.8 } },
  ];
  if (f >= RV_N - 1) return IDLE0();
  return K(keys[f - 4]);
}
const RV_HOLDS = [90, 80, 80, 90, 110, 120, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ specs

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: IMPACT, impact: IMPACT, contact: 6, recover: 10 }),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 5 }),
  hit: spec(6, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 10 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 5 }),
  special: spec(SP_N, 10, false, SPECIAL_HOLDS, { charge: 1, release: 4, impact: 4, recover: 8 }),
  hitHeavy: spec(7, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(7, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(6, 14, false, TG_HOLDS),
  fromGuard: spec(5, 14, false, FG_HOLDS),
};

const CACHE = new Map<string, Pose>();
export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const id = `${anim}:${f}`;
  let p = CACHE.get(id);
  if (!p) {
    switch (anim) {
      case 'idle': p = idlePose(f); break;
      case 'guard': p = guardPose(f); break;
      case 'attack': p = attackPose(f); break;
      case 'special': p = specialPose(f); break;
      case 'roar': p = roarPose(f); break;
      case 'hit': p = hitPose(f); break;
      case 'hitHeavy': p = hitHeavyPose(f); break;
      case 'hitMagic': p = hitMagicPose(f); break;
      case 'toGuard': p = toGuardPose(f); break;
      case 'fromGuard': p = fromGuardPose(f); break;
      case 'summon': p = summonPose(f); break;
      case 'death': p = deathPose(f); break;
      case 'revive': p = revivePose(f); break;
      default: p = IDLE0();
    }
    CACHE.set(id, p);
  }
  return p;
}

/** The sword tip at idle f0 (the fixed muzzle; per-frame points follow the tip). */
export const MUZZLE = (() => {
  const s = skeleton(IDLE0());
  return { x: rnd(s.tip[0]), y: rnd(s.tip[1]) };
})();
export const CORE = (() => {
  const s = skeleton(IDLE0());
  return { x: rnd(s.chest[0]), y: rnd(s.chest[1]) };
})();

const at = (p: readonly [number, number]) => ({ x: rnd(p[0]), y: Math.min(GY, rnd(p[1])) });
/** Per-frame points: muzzle / grip = sword tip, hand = sword hand, head = jewel, core = chest, staff / claw = near / far wingtip. */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const P = framePose(anim, f);
  const s = skeleton(P);
  return {
    muzzle: at(s.tip),
    grip: at(s.tip),
    hand: at(s.hand),
    head: at(jewelOf(P)),
    core: at(s.chest),
    staff: at(s.wnTip),
    claw: at(s.wfTip),
    feet: { x: rnd(s.feet[0]), y: GY },
  };
}
