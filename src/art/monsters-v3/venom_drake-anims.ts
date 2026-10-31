// Zehir Ejderi (venom_drake) v3 — the animations of the scorpion-wyvern rig: pose tables, holds,
// marks and points. Blueprint: docs/v3/kart-a/venom_drake.md §4.
//
// Rhythm: "stalk and sting". The idle is an 18-frame loop where something different moves every
// frame (breath in the barrel, the sac on its own period, the tail arch swaying a beat behind the
// rump, the head scanning, one weep-quill beading at a time, a bead of venom swelling on the
// stinger hook, falling and hissing on the floor). The attack is a trembling, swelling wind-up (the
// bulb pulses three times, the tail draws back over the rump), a 50 ms whip over the head, then a
// held, watching follow-through. Reactions are short flinches with a rattle. The death is its own
// venom eating the hide into lace; only the chitin stinger stands in the pool like a grave marker.
// Every one-shot ends exactly on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, pose, skeleton, tailAngles, type Pose } from './venom_drake-rig';

const rnd = Math.round;

// ------------------------------------------------------------------ pose algebra

/** In-between of two poses: numbers lerp, the tail angles lerp element-wise, arrays / discrete fields from b at t ≥ 0.5. */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
    else (o as unknown as Record<string, unknown>)[k] = t < 0.5 ? x : y;
  }
  const ta = tailAngles(a);
  const tb = tailAngles(b);
  o.tail = ta.map((v, i) => v + (tb[i] - v) * t);
  o.nk = [a.nk[0] + (b.nk[0] - a.nk[0]) * t, a.nk[1] + (b.nk[1] - a.nk[1]) * t];
  o.fk = [a.fk[0] + (b.fk[0] - a.fk[0]) * t, a.fk[1] + (b.fk[1] - a.fk[1]) * t];
  return o;
}
/** Whole-pixel body offsets (hard parts move whole px). */
const PX: (keyof Pose)[] = ['bx', 'by', 'breath', 'sy', 'ty', 'hx', 'hy', 'tdx', 'tdy'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  o.nk = [rnd(p.nk[0]), rnd(p.nk[1])];
  o.fk = [rnd(p.fk[0]), rnd(p.fk[1])];
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (18 f, ≈ 2.0 s loop)

const IDLE_N = 18;
const IDLE_HOLDS = [110, 120, 130, 120, 110, 100, 110, 120, 140, 110, 120, 130, 120, 110, 100, 110, 120, 140];
const TAU = Math.PI * 2;
const wave = (f: number, n: number, ph = 0) => Math.sin(((f - ph) / n) * TAU);

export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  // the breath travels, period 9, one part per beat so no frame moves the whole body (HA-17, HA-21 phase):
  // the back line rises (f3–f4), the shoulders and head settle 1 px (f5–f6), the tail root dips (f7–f8)
  const j = k % 9;
  const breath = j >= 2 && j <= 4 ? 1 : 0;
  const sy = 0;
  const hy = j >= 4 && j <= 6 ? 1 : 0;
  const ty = j >= 6 && j <= 8 ? 1 : 0;
  const br = 0;
  // the head: a slow low scan (±1 px), one blink-to-slit at f8
  const hx = rnd(wave(k, IDLE_N, 1) * 1.2);
  // the throat sac, period 6: 0 → 1 → 2 → 1, one frame behind the barrel
  const sac = [1, 0, 0, 1, 2, 2][k % 6];
  // the tail arch, period 18: the rump leads, the mid arch +1 frame, the bulb +2 (the lag)
  const tRot = wave(k, IDLE_N) * 2.2;
  const tLag = wave(k, IDLE_N, 2) * 7;
  // the bulb's glow steps 1 → 2 → 1 on its own period of 9 (out of phase with the sac)
  const glow = [1, 1, 2, 2, 2, 1, 1, 1, 1][k % 9];
  // weep-quills: one beads at a time, front to back, 3 frames each
  const beads = [0, 0, 0, 0, 0, 0];
  beads[Math.floor(k / 3)] = [1, 2, 1][k % 3];
  // the stinger drip: swells f0–f11, falls f12–f14, splashes f15, the etch dot steps out f16–f17
  const drip = k < 4 ? 1 : k < 8 ? 2 : k < 12 ? 3 : k < 15 ? 10 + (k - 11) : k === 15 ? 20 : k === 16 ? 21 : 22;
  // the cape settles 2 frames after the shoulder
  const drape = j >= 5 && j <= 7 ? 1 : 0;
    // the venom tremble: the stinger tip quivers a px on alternate frames (high frequency, small reach)
  const tdx = k % 2;
  return pose({ by: br, breath, sy, hx, hy, ty, sac, tRot, tLag, tdx, glow, beads, drip, drape, eye: k === 8 ? 1 : 0, t: k / IDLE_N });
}
const IDLE0 = idlePose(0);

/** A one-shot key over idle f0 (the drip and the quills hold their f0 state unless set). */
const key = (d: Partial<Pose>, base: Pose = IDLE0): Pose => ({ ...base, ...d });

// ------------------------------------------------------------------ guard (8 f loop): "Delik Kalkan"

const GUARD_N = 8;
const GUARD_HOLDS = [160, 150, 150, 160, 160, 150, 140, 150];
const G0: Partial<Pose> = {
  sit: 2, shield: 1, hx: -3, hy: 2, tilt: 1, eye: 1, sac: 1, tRot: 16, tCurl: 1.05, tLag: 4, glow: 2, drip: 0, beads: [0, 0, 0, 0, 0, 0],
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  // one part changes per frame: membrane fills → chest sinks → shield rim drops → stinger twitch →
  // sac pulse → membrane relaxes → chest → stinger
  const fill = k >= 1 && k <= 5 ? 1 : 0;
  const breath = k >= 2 && k <= 6 ? 1 : 0;
  const rim = k >= 3 && k <= 6 ? 1 : 0;
  const tw = k === 4 ? 1 : k === 7 ? -1 : 0;
  const sac = k === 5 ? 2 : 1;
  return key({ ...G0, drape: fill, breath, hy: (G0.hy as number) + rim, tdx: tw + (k % 2), tLag: (G0.tLag as number) + (k >= 4 ? 2 : 0), sac, glow: k === 4 || k === 5 ? 3 : 2, t: k / GUARD_N });
}
const GUARD0 = guardPose(0);

// ------------------------------------------------------------------ toGuard / fromGuard (6 f, 360 ms each)

const TG_HOLDS = [50, 60, 60, 60, 60, 70];
function toGuardPose(f: number): Pose {
  const g = GUARD0;
  switch (f) {
    case 0: return key({ by: 1, hy: 1 });
    case 1: return blend(IDLE0, { ...g, shield: 0, tRot: 4, tCurl: 1, hx: 0, hy: 1, eye: 0 }, 1);
    case 2: return blend(key({ sit: 2 }), { ...g, shield: 0.35, tRot: 9, eye: 0 }, 0.6); // the in-between: the arm at 45°, the tail half down
    case 3: return blend(IDLE0, { ...g, shield: 0.7 }, 0.8);
    case 4: return blend(IDLE0, { ...g, shield: 0.92 }, 0.95);
    default: return g;
  }
}
function fromGuardPose(f: number): Pose {
  const g = GUARD0;
  switch (f) {
    case 0: return key({ tRot: 8, tCurl: 1, tLag: 2 }, g); // the tail rises first
    case 1: return blend(g, { ...IDLE0, sit: 2, shield: 0.75 }, 0.4);
    case 2: return blend(g, { ...IDLE0, sit: 2, shield: 0.35 }, 0.7); // the near wing drops
    case 3: return key({ sit: 1, shield: 0, by: 1, nk: [0, 1] }); // the knuckle plants back
    case 4: return key({ sit: 0, by: 1 }); // the hips rise
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ attack (14 f, 1 250 ms): "Zehir Havanı"

const WINDUP = [-128, -124, -116, -102, -80, -50, -16, 16, 40];
export const ATTACK_HOLDS = [80, 60, 70, 80, 140, 50, 60, 90, 120, 80, 90, 100, 110, 120];
function attackPose(f: number): Pose {
  switch (f) {
    case 0: return key({ hy: 1 });
    case 1: return key({ hy: 1, sac: 0, tRot: -2, glow: 2, drip: 0 }); // charge (the declaration holds it)
    case 2: return key({ by: 1, hy: 1, sac: 0, tail: WINDUP.map((a, i) => a * 0.55 + tailAngles(IDLE0)[i] * 0.45), bulb: 1, glow: 2, drip: 0 });
    case 3: return key({ by: 1, hy: 1, sac: 0, tail: WINDUP.map((a, i) => a * 0.85 + tailAngles(IDLE0)[i] * 0.15), bulb: 2, glow: 3, bristle: 1, jaw: 1, drip: 0 });
    case 4: return key({ by: 2, hx: -1, hy: 2, sac: 0, tail: WINDUP, bulb: 3, glow: 3, bristle: 1, jaw: 1, drip: 0, nk: [0, 0] }); // full wind-up
    case 5: return key({ by: 1, hx: 1, tRot: 18, tCurl: 0.8, smear: 1, bulb: 2, glow: 2, jaw: 1, drip: 0 }); // the whip
    case 6: return key({ bx: 1, hx: 1, hy: -1, tRot: 45, tCurl: 0.4, bulb: 0, glow: 1, crown: 1, jaw: 2, drip: 0 }); // release
    case 7: return key({ bx: 1, hx: 1, hy: -2, tRot: 47, tCurl: 0.4, tdy: 2, glow: 1, jaw: 1, drip: 0 }); // follow-through
    case 8: return key({ bx: 1, hy: -2, tRot: 22, tCurl: 0.85, tLag: -10, glow: 1, sac: 0, drip: 0 }); // watch (held)
    case 9: return key({ bx: 1, hy: -1, tRot: 20, tCurl: 0.85, tLag: -8, tdx: 1, glow: 1, drip: 0 }); // contact: the rattle
    case 10: return key({ hy: -1, tRot: 14, tCurl: 0.9, tLag: -5, tdx: -1, glow: 1, drip: 0 }); // recover
    case 11: return key({ tRot: 8, tCurl: 0.95, tLag: -2, glow: 1, drip: 0 });
    case 12: return key({ tRot: 3, glow: 1, drip: 0, tLag: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ roar (12 f, 1 100 ms): "Tıslayan Çıngırak"

const ROAR_HOLDS = [70, 100, 150, 60, 90, 70, 70, 70, 80, 100, 110, 130];
function roarPose(f: number): Pose {
  const hood = { wing: 0.5, sac: 3, bristle: 1 };
  switch (f) {
    case 0: return key({ hy: 1 });
    case 1: return key({ hx: -2, hy: 3, by: 1, tilt: 1, tRot: -4, sac: 1, drip: 0 }); // charge: the head drops low, the neck coils
    case 2: return key({ hx: -2, hy: 2, by: 1, ...hood, tRot: -6, tCurl: 1.08, glow: 2, drip: 0 }); // the hood
    case 3: return key({ hx: 1, hy: -1, ...hood, jaw: 3, sacHot: 1, glow: 3, tRot: -4, drip: 0, beads: [2, 2, 2, 2, 2, 2] }); // the hiss
    case 4: return key({ hx: 1, hy: -1, ...hood, jaw: 3, sac: 3, glow: 3, tRot: -4, tdx: 1, drip: 0, beads: [2, 2, 2, 2, 2, 2] }); // rattle
    case 5: return key({ hx: 1, hy: -1, ...hood, jaw: 3, sac: 2, glow: 2, tRot: -4, tdx: -1, drip: 0, beads: [1, 2, 2, 2, 2, 1] });
    case 6: return key({ hx: 1, hy: -1, ...hood, jaw: 2, sac: 2, glow: 3, tRot: -4, tdx: 1, drip: 0, beads: [1, 1, 2, 2, 1, 1] });
    case 7: return key({ hx: 1, hy: -1, wing: 0.4, bristle: 1, jaw: 2, sac: 1, glow: 2, tRot: -4, tdx: -1, drip: 0, beads: [0, 1, 1, 1, 1, 0] });
    case 8: return key({ hy: -1, wing: 0.25, jaw: 1, sac: 1, glow: 2, tRot: -3, drip: 0 }); // recover
    case 9: return key({ wing: 0.1, sac: 0, glow: 2, tRot: -2, drip: 0 });
    case 10: return key({ tRot: -1, drip: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ hits

// HA-4: f0 40–60, f1 40–70, recover start 240–370 (the blueprint's 210 for `hit` moved to 240: f2 130)
const HIT_HOLDS = [50, 60, 130, 110, 120, 100];
function hitPose(f: number): Pose {
  switch (f) {
    case 0: return key({ hx: -2, hy: -2, tilt: -1, eye: 2, sac: 0, tdx: -1 }); // local: the head snaps back and up
    case 1: return key({ bx: -1, hx: -2, hy: -1, tilt: -1, eye: 2, sac: 0, tdx: -1, tRot: -1 });
    case 2: return key({ bx: -1, hx: -1, hy: -1, eye: 1, sac: 1, tdx: -2, tRot: -3 }); // the reel: the tail sways back 2
    case 3: return key({ hx: -1, eye: 1, tdx: -1, tRot: -2 }); // recover
    case 4: return key({ tRot: -1 });
    default: return IDLE0;
  }
}
const HH_HOLDS = [50, 60, 90, 110, 120, 110, 120];
function hitHeavyPose(f: number): Pose {
  switch (f) {
    case 0: return key({ hx: -3, hy: -2, tilt: -1, eye: 2, sac: 0, tdx: -1, nk: [0, 2] }); // struck (also death f0)
    case 1: return key({ bx: -1, by: 1, hx: -3, hy: -1, tilt: -1, eye: 2, sac: 0, tdx: -2, tRot: -2, nk: [-1, 2] });
    case 2: return key({ bx: -2, by: 1, hx: -2, eye: 2, sac: 0, tdx: -2, tRot: -4, nk: [-2, 0] }); // a step back
    case 3: return key({ bx: -2, by: 1, hx: -1, eye: 1, tdx: -1, tRot: -3, nk: [-2, 0] });
    case 4: return key({ bx: -1, hx: -1, eye: 1, tRot: -2, nk: [-1, 1] }); // recover: the step home
    case 5: return key({ tRot: -1 });
    default: return IDLE0;
  }
}
const HM_HOLDS = [50, 60, 80, 80, 100, 120, 130];
function hitMagicPose(f: number): Pose {
  const flare = { hot: 1, sacHot: 1, eyeHot: 1, glow: 3, seam: 0, beads: [2, 2, 2, 2, 2, 2] };
  switch (f) {
    case 0: return key({ ...flare, hy: -1, eye: 0, sac: 2 }); // the venom flares hot, the body rigid
    case 1: return key({ ...flare, seam: 0.35, hy: -1, sac: 2, tRot: 1 }); // the seams show leaf3 for one frame
    case 2: return key({ hot: 1, eyeHot: 1, glow: 3, hy: -1, sac: 1, shake: 1, tRot: 1, beads: [1, 1, 1, 1, 1, 1] }); // shudder
    case 3: return key({ eyeHot: 1, glow: 2, hy: -1, sac: 1, shake: 2, tRot: -1, tdx: 1 });
    case 4: return key({ glow: 2, sac: 1, tRot: -1 }); // recover
    case 5: return key({ glow: 1 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ special (12 f, 1 100 ms): "Zehir Sağanağı"

// HA-3: the recovery must not shorten (the blueprint's 110 100 90 110 tail re-ordered, same total)
const SP_HOLDS = [70, 90, 100, 140, 50, 60, 80, 90, 100, 100, 110, 110];
function specialPose(f: number): Pose {
  switch (f) {
    case 0: return attackPose(1); // = the held attack f1, pixel for pixel
    case 1: return key({ hy: 1, sac: 1, tRot: -2, wing: 0.08, glow: 2, drip: 0 }); // it begins the rear: the wings stir (≤ 1× idleΔ from the held attack f1)
    case 2: return key({ by: -1, rear: 0.7, wing: 0.85, hy: -2, tail: WINDUP.map((a, i) => a * 0.6 + tailAngles(IDLE0)[i] * 0.4), bulb: 1, glow: 2, sac: 2, drip: 0 });
    case 3: return key({ by: -1, rear: 1, wing: 1, hy: -2, tail: WINDUP, bulb: 3, glow: 3, sac: 2, bristle: 1, beads: [2, 2, 2, 2, 2, 2], drip: 0 }); // the bulb swells
    case 4: return key({ by: -1, rear: 0.9, wing: 0.9, hy: -1, tRot: 40, tCurl: 0.45, smear: 1, bulb: 1, glow: 2, jaw: 2, drip: 0 }); // the flat fan: the spray
    case 5: return key({ rear: 0.6, wing: 0.4, tRot: 50, tCurl: 0.32, tdy: 2, glow: 1, jaw: 1, drip: 0 }); // follow, the wings beat
    case 6: return key({ rear: 0.4, wing: 0.8, tRot: 30, tCurl: 0.6, glow: 1, drip: 0 });
    case 7: return key({ rear: 0.2, wing: 0.3, tRot: 18, tCurl: 0.8, glow: 1, drip: 0 }); // recover: back onto the knuckles
    case 8: return key({ by: 1, wing: 0.1, tRot: 10, tCurl: 0.9, glow: 1, drip: 0, nk: [0, 0] });
    case 9: return key({ tRot: 5, glow: 1, drip: 0 });
    case 10: return key({ tRot: 2, drip: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ summon (15 f, 1 420 ms): curled → land → inhale → unfurl

const SU_HOLDS = [90, 80, 80, 90, 60, 70, 80, 80, 90, 60, 200, 90, 100, 110, 140];
const CURL_TAIL = [150, 115, 80, 45, 15, 0, -4, -6, -10];
function summonPose(f: number): Pose {
  const low = { by: 4, sit: 1, hx: -9, hy: 9, tilt: 2, eye: 1, sac: 0, shield: 0.25, glow: 1, drip: 0, beads: [0, 0, 0, 0, 0, 0] };
  switch (f) {
    case 0: return key({ ...low, curl: 1, tail: CURL_TAIL, nk: [-3, 3] });
    case 1: return key({ ...low, curl: 1, tail: CURL_TAIL.map((a, i) => (i >= 7 ? a - 12 : a)), nk: [-3, 3] }); // the tail tip flicks
    case 2: return key({ ...low, curl: 1, tail: CURL_TAIL.map((a, i) => (i >= 6 ? a - 24 : a)), nk: [-2, 3] });
    case 3: return key({ ...low, by: 3, hx: -7, hy: 7, shield: 0.15, tail: CURL_TAIL.map((a, i) => a - (i >= 4 ? (i - 3) * 14 : 0)), nk: [-1, 4] });
    case 4: return key({ by: 3, sit: 0, hx: -4, hy: 4, eye: 1, sac: 0, tail: [-140, -132, -120, -102, -80, -54, -24, 6, 30], smear: 1, glow: 1, drip: 0, nk: [0, 0] }); // land: the knuckles slam
    case 5: return key({ by: 2, hx: -1, hy: 1, sac: 0, tail: [-124, -118, -108, -95, -77, -52, -22, 8, 32], glow: 1, drip: 0 }); // the head lifts
    case 6: return key({ by: 1, hy: -1, tilt: -1, jaw: 1, sac: 1, tRot: -14, tCurl: 1.2, glow: 1, drip: 0 }); // inhale
    case 7: return key({ by: 1, hy: -1, tilt: -1, jaw: 2, sac: 2, tRot: -10, tCurl: 1.15, glow: 2, drip: 0 });
    case 8: return key({ hy: -2, tilt: -1, jaw: 2, sac: 3, tRot: -6, tCurl: 1.1, glow: 2, drip: 0, bristle: 1 });
    case 9: return key({ hy: -2, jaw: 1, sac: 3, tRot: 2, tCurl: 0.95, wing: 0.5, glow: 3, bulb: 2, bristle: 1, drip: 0, beads: [2, 2, 2, 2, 2, 2] }); // peak: the bulb ignites
    case 10: return key({ hy: -2, jaw: 1, sac: 3, tRot: 2, tCurl: 0.95, wing: 0.5, glow: 3, bulb: 2, bristle: 1, drip: 0, beads: [2, 2, 2, 2, 2, 2], t: 0.5 }); // the cut-in hold
    case 11: return key({ hy: -1, jaw: 1, sac: 1, mist: 1, tRot: 1, wing: 0.4, glow: 2, bulb: 1, drip: 0, beads: [1, 1, 1, 1, 1, 1] }); // exhale
    case 12: return key({ sac: 1, mist: 2, wing: 0.2, glow: 2, tRot: 1, drip: 0 });
    case 13: return key({ wing: 0.05, glow: 1, drip: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ death (11 f, 780 ms): "Kendi Zehri"

const D_HOLDS = [50, 50, 60, 60, 55, 55, 140, 70, 140, 50, 50];
function deathPose(f: number): Pose {
  const locked = { tail: tailAngles(key({ tRot: -3, tCurl: 1.08 })) }; // the arch locks rigid
  switch (f) {
    case 0: return hitHeavyPose(0);
    case 1: return key({ bx: -1, by: 1, hx: -3, hy: -1, tilt: -1, eye: 2, sac: 0, tdx: -2, tRot: -2, nk: [-1, 2] }); // the reel
    case 2: return key({ ...locked, bx: -1, by: 3, hx: -3, hy: 2, tilt: 1, eye: 2, sac: 0, nk: [-1, 0], glow: 2 }); // the knees buckle
    case 3: return key({ ...locked, bx: -1, by: 3, hx: -3, hy: 3, tilt: 1, eye: 2, sac: 0, seam: 1, glow: 2 }); // dissolve: the seam web
    case 4: return key({ ...locked, bx: -1, by: 3, hx: -3, hy: 3, tilt: 1, eye: 2, sac: 0, seam: 0.45, holes: 1, glow: 2 });
    case 5: return key({ ...locked, bx: -1, by: 4, hx: -3, hy: 4, tilt: 1, eye: 2, sac: 0, seam: 0, holes: 2, glow: 2, drape: 3 });
    case 6: return key({ ...locked, bx: -1, by: 4, hx: -3, hy: 4, tilt: 1, eye: 2, sac: 0, seam: 0, holes: 3, glow: 1, drape: 3 }); // the lace (held)
    case 7: return key({ ...locked, bx: -1, by: 4, hx: -3, hy: 4, eye: 2, holes: 3, slump: 1, pool: 1, marker: 1, glow: 1 }); // the slump
    case 8: return key({ body: 0, pool: 1, marker: 0, glow: 1 }); // the stinger marker (held)
    case 9: return key({ body: 0, pool: 1, marker: 1.6, glow: 0 }); // it sinks, the bead falls
    default: return key({ body: 0, pool: 0.9, marker: 2.6, glow: 0 }); // the hook tip only
  }
}

// ------------------------------------------------------------------ revive (11 f, 830 ms; land@7 at 500 ms)

const RV_HOLDS = [90, 50, 70, 60, 110, 60, 60, 60, 80, 90, 100];
function revivePose(f: number): Pose {
  switch (f) {
    case 0: return key({ body: 0, glob: 1, glow: 0 }); // the glob hovers
    case 1: return key({ body: 0, glob: 2, glow: 0 }); // the fall
    case 2: return key({ body: 0, glob: 3, pool: 1, glow: 0 }); // the splat
    case 3: return key({ body: 0, pool: 1, marker: 0.8, glow: 1 }); // the stinger rights itself
    case 4: return key({ by: 2, eye: 2, sac: 0, holes: 3, seam: 0, pool: 0.6, glow: 1, drip: 0 }); // the lace stands up
    case 5: return key({ by: 2, eye: 2, sac: 0, holes: 2, seam: 0, glow: 1, drip: 0 });
    case 6: return key({ by: 1, eye: 1, sac: 0, holes: 1, seam: 1, glow: 1, drip: 0 });
    case 7: return key({ by: 1, eye: 1, sac: 0, seam: 0.5, glow: 1, drip: 0, nk: [0, 0] }); // land
    case 8: return key({ sac: 2, eye: 0, seam: 0.2, glow: 1, drip: 0 }); // the first breath
    case 9: return key({ sac: 1, glow: 3, bulb: 1, drip: 0 }); // the bulb ignites
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 9, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 7, true, GUARD_HOLDS),
  attack: spec(14, 11, false, ATTACK_HOLDS, { charge: 1, release: 6, impact: 6, contact: 9, recover: 10 }),
  roar: spec(12, 11, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 8 }),
  hit: spec(6, 11, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(15, 11, false, SU_HOLDS, { land: 4 }),
  death: spec(11, 14, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 3 }),
  revive: spec(11, 13, false, RV_HOLDS, { land: 7 }),
  special: spec(12, 11, false, SP_HOLDS, { charge: 1, release: 4, impact: 4, contact: 6, recover: 7 }),
  hitHeavy: spec(7, 11, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(7, 11, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(6, 16, false, TG_HOLDS),
  fromGuard: spec(6, 16, false, TG_HOLDS),
};

/** Beat frames for the cinematics (venom_drake-strike / -summon / -death). */
export const BEATS = {
  swell: [2, 3, 4] as readonly number[],
  whip: 5,
  release: 6,
  watch: 8,
  contact: 9,
  spread: 9,
  cut: 10,
  inhale: 6,
  lace: 6,
  slump: 7,
  marker: 8,
  spray: 4,
} as const;

const CACHE = new Map<string, Pose>();
export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const id = `${anim}:${f}`;
  let p = CACHE.get(id);
  if (!p) {
    switch (anim) {
      case 'idle': p = idlePose(f); break;
      case 'guard': p = guardPose(f); break;
      case 'attack': p = attackPose(f); break;
      case 'roar': p = roarPose(f); break;
      case 'hit': p = hitPose(f); break;
      case 'hitHeavy': p = hitHeavyPose(f); break;
      case 'hitMagic': p = hitMagicPose(f); break;
      case 'toGuard': p = toGuardPose(f); break;
      case 'fromGuard': p = fromGuardPose(f); break;
      case 'summon': p = summonPose(f); break;
      case 'revive': p = revivePose(f); break;
      case 'death': p = deathPose(f); break;
      case 'special': p = specialPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

const SK0 = skeleton(IDLE0);
export const MUZZLE = { x: rnd(SK0.sting[0]), y: rnd(SK0.sting[1]) };
export const CORE = { x: rnd(SK0.sac[0]) - 6, y: rnd(SK0.sac[1]) - 2 };

/** The marker's chitin hook tip during the death / revive pool frames (frame px). */
function markerTip(o: Pose): { x: number; y: number } {
  return { x: AX + 2, y: GY - 2 - rnd(Math.max(0, 15 - Math.max(0, o.marker) * 4.5)) };
}

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const pt = (p: readonly [number, number]) => ({ x: rnd(p[0]), y: rnd(p[1]) });
  if (o.body <= 0) {
    // the drake is a pool (death) or a glob (revive): the points follow the stinger / the glob
    const m = o.marker >= 0 ? markerTip(o) : { x: AX + 2, y: o.glob === 1 ? GY - 22 : o.glob === 2 ? GY - 10 : GY - 2 };
    return { muzzle: m, staff: m, head: m, core: { x: AX + 2, y: GY - 3 }, claw: { x: AX + 2, y: GY }, feet: { x: AX, y: GY } };
  }
  return {
    muzzle: pt(sk.sting),
    staff: pt(sk.bulb),
    head: pt(sk.mouth),
    core: { x: rnd(sk.sac[0]) - 6, y: rnd(sk.sac[1]) - 2 },
    claw: pt(sk.wrN),
    feet: { x: AX, y: GY },
  };
}

/** Rig joints of one frame (sameness tool / the hit kit's hip travel). */
export function frameJoints(anim: AnyMonsterAnim, f: number): Record<string, { x: number; y: number }> {
  const sk = skeleton(framePose(anim, f));
  const pt = (p: readonly [number, number]) => ({ x: rnd(p[0]), y: rnd(p[1]) });
  return { hip: pt(sk.hip), shoulder: pt(sk.sh), head: pt(sk.head), bulb: pt(sk.bulb), knuckleN: pt(sk.wrN), knuckleF: pt(sk.wrF) };
}
