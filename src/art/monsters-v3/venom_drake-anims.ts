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
  const ty = 0; // (the tail-root dip moved the whole arch 1 px: HA-21 phase; the sway carries the tail)
  const br = 0;
  // the head: a slow low scan (±1 px), one blink-to-slit at f8
  const hx = rnd(wave(k, IDLE_N, 1) * 1.2);
  // the throat sac, period 6: 0 → 1 → 2 → 1, one frame behind the barrel
  const sac = [1, 0, 0, 1, 2, 2][k % 6];
  // the tail arch, period 18: the rump leads, the mid arch +1 frame, the bulb +2 (the lag)
  const tRot = wave(k, IDLE_N) * 1.3;
  const tLag = wave(k, IDLE_N, 2) * 5;
  // the bulb's glow steps 1 → 2 → 1 on its own period of 9 (out of phase with the sac)
  const glow = [1, 1, 2, 2, 2, 1, 1, 1, 1][k % 9];
  // weep-quills: one beads at a time, front to back, 3 frames each
  const beads = [0, 0, 0, 0, 0, 0];
  beads[Math.floor(k / 3)] = [1, 2, 1][k % 3];
  // the stinger drip: swells f0–f11, falls f12–f14, splashes f15, the etch dot steps out f16–f17
  const drip = k < 4 ? 1 : k < 8 ? 2 : k < 12 ? 3 : k < 15 ? 10 + (k - 11) : k === 15 ? 20 : k === 16 ? 21 : 22;
  // the cape settles 2 frames after the shoulder
  const drape = (j >= 5 && j <= 7 ? 1 : 0) + (k % 2); // + a 1-px hem flutter on alternate frames (small reach, high frequency)
    // the venom tremble: the stinger tip quivers a px on alternate frames (high frequency, small reach)
  const tdx = k % 2;
  const tdy = (k + 1) % 2; // the quiver is diagonal: x on odd frames, y on even ones
  // the near hand re-grips once a loop (a 1-px knuckle lift, f10–f11): an independent cycle (liveliness)
  const nk: [number, number] = k === 10 || k === 11 ? [0, 1] : [0, 0];
  return pose({ by: br, breath, sy, hx, hy, ty, sac, tRot, tLag, tdx, tdy, glow, beads, drip, drape, nk, eye: k === 8 ? 1 : 0, t: k / IDLE_N });
}
const IDLE0 = idlePose(0);

/** A one-shot key over idle f0 (the drip and the quills hold their f0 state unless set). */
const key = (d: Partial<Pose>, base: Pose = IDLE0): Pose => ({ ...base, ...d });

// ------------------------------------------------------------------ guard (8 f loop): "Delik Kalkan"

const GUARD_N = 8;
const GUARD_HOLDS = [160, 150, 150, 160, 160, 150, 140, 150];
/** The guard tail: a LOW C, still partly raised (the bulb at y ≈ 28, over the shoulders), the stinger hook
 * pointing forward-down over the shield rim (never straight up: that read as a periscope). */
const GUARD_TAIL = [-86, -76, -64, -50, -34, -18, -4, 10, 30];
const G0: Partial<Pose> = {
  sit: 2, shield: 1, hx: -3, hy: 2, tilt: 1, eye: 1, sac: -1, tail: GUARD_TAIL, glow: 2, drip: 0, beads: [0, 0, 0, 0, 0, 0],
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  // one part changes per frame: membrane fills → chest sinks → shield rim drops → stinger twitch (2 px) →
  // sac pulse → membrane relaxes → chest → stinger twitch back
  const fill = k >= 1 && k <= 5 ? 1 : 0;
  const breath = k >= 2 && k <= 6 ? 1 : 0;
  const rim = k >= 3 && k <= 6 ? 1 : 0;
  const tw = k === 3 ? 2 : k === 7 ? -2 : 0;
  const sac = -1; // the sac is tucked away behind the shield (sac < 0: not drawn; no glowing 'mouth' under the eye)
  return key({ ...G0, drape: fill, breath, hy: (G0.hy as number) + rim, tdx: tw, tdy: k === 3 ? -1 : 0, sac, glow: k === 4 || k === 5 ? 3 : 2, t: k / GUARD_N });
}
const GUARD0 = guardPose(0);

// ------------------------------------------------------------------ toGuard / fromGuard (6 f, 360 ms each)

// The wing is one part the whole way: f1 the membrane peels off the flank (the hem lifts), f2 the arm at
// 45° with the membrane still half folded, f3 it opens into the shield, f4 settles. fromGuard reverses it.
const TG_HOLDS = [50, 60, 60, 60, 60, 70];
const toward = (t: number, sh: number, extra: Partial<Pose> = {}): Pose => ({ ...blend(IDLE0, GUARD0, t), shield: sh, ...extra });
function toGuardPose(f: number): Pose {
  switch (f) {
    case 0: return key({ sit: 0.4 }); // only the hips settle back (≤ 1.5× idleΔ; the tail sweep starts at f1)
    case 1: return toward(0.25, 0.12, { eye: 0, drape: -3 }); // the hips sit back, the hem peels off the flank
    case 2: return toward(0.5, 0.42, { eye: 0 }); // the in-between: the arm at 45°, the membrane half folded
    case 3: return toward(0.78, 0.75);
    case 4: return toward(0.94, 0.93);
    default: return GUARD0;
  }
}
function fromGuardPose(f: number): Pose {
  const back = (t: number, sh: number, extra: Partial<Pose> = {}): Pose => ({ ...blend(GUARD0, IDLE0, t), shield: sh, ...extra });
  switch (f) {
    case 0: return { ...GUARD0, tail: tailAngles(blend(GUARD0, IDLE0, 0.3)) }; // the tail rises first
    case 1: return back(0.3, 0.8);
    case 2: return back(0.55, 0.42); // the near wing drops (the arm at 45°)
    case 3: return back(0.78, 0.12, { drape: -3, nk: [0, 1] }); // the membrane folds back onto the flank
    case 4: return key({ sit: 0, by: 1 }); // the knuckle planted, the hips rise
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ attack (14 f, 1 250 ms): "Zehir Havanı"

/** The full wind-up (critic r2): the whole arch swings BACK over the rump (the root leans ≈ 45° back) and the
 * curl tightens, so the bulb is drawn to its rearmost point ≈ (30, 14): the loaded catapult. */
const WINDUP = [-135, -129, -121, -110, -93, -72, -48, -19, 9];
/** The whip: f5 the arch flung forward through the vertical (bulb high over the shoulders), f6 the release
 * (the root still curved, the tip straight at the target), f7 the overshoot (the tip only 2–4 px below the
 * f6 line, the bulb clear of the head), f8 the slow S settling (the root back, the tip still forward). */
const WHIP = [-104, -92, -78, -63, -48, -34, -20, -6, 10];
const RELEASE = [-80, -64, -50, -40, -33, -30, -27, -20, -6];
const OVERSHOOT = [-79, -63, -50, -40, -32, -26, -18, -10, 4];
const SLOW_S = [-88, -78, -64, -50, -36, -24, -14, -2, 14];
const wind = (t: number): number[] => WINDUP.map((a, i) => a * t + tailAngles(IDLE0)[i] * (1 - t));
export const ATTACK_HOLDS = [80, 60, 70, 80, 140, 50, 60, 90, 120, 80, 90, 100, 110, 120];
function attackPose(f: number): Pose {
  switch (f) {
    case 0: return key({ hy: 1 });
    case 1: return key({ hy: 1, sac: 0, tail: wind(0.06), glow: 2, drip: 0 }); // charge (the declaration holds it)
    case 2: return key({ by: 1, hy: 1, sac: 0, tail: wind(0.4), bulb: 1, glow: 2, drip: 0, nk: [0, 1] }); // the knuckle grips
    case 3: return key({ by: 2, sit: 0.5, hx: -1, hy: 2, sac: 0, tail: wind(0.78), bulb: 2, glow: 3, bristle: 1, jaw: 1, drip: 0, nk: [0, 1] }); // the barrel sinks, the hips drop
    case 4: return key({ by: 2, sit: 1, hx: -2, hy: 2, sac: 0, tail: WINDUP, bulb: 3, glow: 3, bristle: 1, jaw: 1, drip: 0, nk: [0, 1] }); // full wind-up: body low, head low and back
    case 5: return key({ bx: 2, by: 1, hx: -1, hy: 0, tail: WHIP, smear: 1, bulb: 2, glow: 2, jaw: 1, drip: 0 }); // the whip: the barrel rocks forward 2 (the head rides it +1: the snout stays inside the frame margin)
    case 6: return key({ bx: 2, hx: -1, hy: -2, tilt: -1, tail: RELEASE, bulb: 0, glow: 1, crown: 1, jaw: 2, drip: 0 }); // release: the head lifts to aim
    case 7: return key({ bx: 1, hx: 0, hy: -3, tilt: -1, tail: OVERSHOOT, glow: 1, jaw: 1, drip: 0 }); // follow-through: the tip dips 2–4 px, the head aims
    case 8: return key({ bx: 1, hx: 0, hy: -2, tail: SLOW_S, glow: 1, sac: 0, drip: 0 }); // the slow S (held)
    case 9: return key({ bx: 1, hy: -1, tRot: 16, tCurl: 0.88, tLag: -8, tdx: 1, glow: 1, drip: 0 }); // contact: the rattle
    case 10: return key({ hy: -1, tRot: 11, tCurl: 0.92, tLag: -5, tdx: -1, glow: 1, drip: 0 }); // recover
    case 11: return key({ tRot: 6, tCurl: 0.96, tLag: -2, glow: 1, drip: 0 });
    case 12: return key({ tRot: 2, glow: 1, drip: 0, tLag: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ roar (12 f, 1 100 ms): "Tıslayan Çıngırak"

const ROAR_HOLDS = [70, 100, 150, 60, 90, 70, 70, 70, 80, 100, 110, 130];
function roarPose(f: number): Pose {
  // the hood: both wing-arms lift the membranes half-spread above the shoulders, the quills erect 2 px
  const hood = { wing: 0.6, sac: 3, bristle: 2 };
  switch (f) {
    case 0: return key({ hy: 1 });
    case 1: return key({ hx: -3, hy: 3, by: 1, tilt: 1, tRot: -4, sac: 1, wing: 0.2, drip: 0 }); // charge: the head drops low, the neck coils back
    case 2: return key({ hx: -2, hy: 2, by: 1, ...hood, tRot: -6, tCurl: 1.08, glow: 2, drip: 0 }); // the hood
    case 3: return key({ hx: 1, hy: -1, ...hood, jaw: 3, sacHot: 1, glow: 3, tRot: -4, drip: 0, beads: [2, 2, 2, 2, 2, 2] }); // the hiss: a 4-px gape
    case 4: return key({ hx: 1, hy: -1, ...hood, jaw: 3, sac: 3, glow: 3, tRot: -4, tdx: 1, drip: 0, beads: [2, 2, 2, 2, 2, 2] }); // rattle
    case 5: return key({ hx: 1, hy: -1, ...hood, jaw: 3, sac: 2, glow: 2, tRot: -4, tdx: -1, drip: 0, beads: [1, 2, 2, 2, 2, 1] });
    case 6: return key({ hx: 1, hy: -1, ...hood, wing: 0.56, jaw: 2, sac: 2, glow: 3, tRot: -4, tdx: 1, drip: 0, beads: [1, 1, 2, 2, 1, 1] });
    case 7: return key({ hx: 1, hy: -1, wing: 0.5, bristle: 1, jaw: 2, sac: 1, glow: 2, tRot: -4, tdx: -1, drip: 0, beads: [0, 1, 1, 1, 1, 0] });
    case 8: return key({ hy: -1, wing: 0.3, jaw: 1, sac: 1, glow: 2, tRot: -3, drip: 0 }); // recover
    case 9: return key({ wing: 0.12, sac: 0, glow: 2, tRot: -2, drip: 0 });
    case 10: return key({ wing: 0.03, tRot: -1, drip: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ hits

// HA-4: f0 40–60, f1 40–70, recover start 240–370 (the blueprint's 210 for `hit` moved to 240: f2 130)
const HIT_HOLDS = [50, 60, 130, 110, 120, 100];
function hitPose(f: number): Pose {
  // the light hit: the head snaps, the body barely gives, the TAIL STAYS STILL (the difference to hitHeavy reads)
  switch (f) {
    case 0: return key({ hx: -2, hy: -1, tilt: -1, eye: 2, sac: 0 }); // local: the head snaps 2 back, 1 up; the eye shut; the sac compressed
    case 1: return key({ bx: -1, hx: -2, hy: -1, tilt: -1, eye: 2, sac: 0 });
    case 2: return key({ bx: -1, hx: -1, hy: -1, eye: 1, sac: 1 }); // the reel
    case 3: return key({ hx: -1, eye: 1 }); // recover
    case 4: return key({ hx: 0, sac: 2 });
    default: return IDLE0;
  }
}
const HH_HOLDS = [50, 60, 90, 110, 120, 110, 120];
function hitHeavyPose(f: number): Pose {
  // the heavy hit: the head is driven DOWN and back (snout dipped), the near knuckle jerks 2 px off the floor;
  // the tail lags one frame, then the bulb swings 3 px back (f1–f2) and rattles home
  switch (f) {
    case 0: return key({ hx: -3, hy: 0, tilt: 1, eye: 2, sac: 0, nk: [0, 2] }); // struck (also death f0)
    case 1: return key({ bx: -1, hx: -3, hy: 1, tilt: 1, eye: 2, sac: 0, nk: [-1, 2] }); // the tail still lags
    case 2: return key({ bx: -2, by: 1, hx: -2, hy: 1, eye: 2, sac: 0, tRot: -4, tdx: -3, nk: [-2, 0] }); // a step back; the bulb swings 3 back
    case 3: return key({ bx: -2, by: 1, hx: -1, eye: 1, tRot: -3, tdx: -1, nk: [-2, 0] });
    case 4: return key({ bx: -1, hx: -1, eye: 1, tRot: -2, tdx: 1, nk: [-1, 1] }); // recover: the step home, the tip rattles
    case 5: return key({ tRot: -1 });
    default: return IDLE0;
  }
}
const HM_HOLDS = [50, 60, 80, 80, 100, 120, 130];
function hitMagicPose(f: number): Pose {
  const flare = { hot: 1, sacHot: 1, eyeHot: 1, glow: 3, seam: 0, beads: [2, 2, 2, 2, 2, 2] };
  switch (f) {
    case 0: return key({ ...flare, hy: -1, eye: 0, sac: 2 }); // the venom flares hot, the body rigid
    case 1: return key({ ...flare, seam: 0.35, seamPart: 1, hy: -1, sac: 2, tRot: 1 }); // the seams show leaf3 on the struck front half (no nodes: not the death web)
    case 2: return key({ hot: 1, eyeHot: 1, glow: 3, hy: -1, sac: 1, shake: 1, tRot: 1, beads: [1, 1, 1, 1, 1, 1] }); // shudder
    case 3: return key({ eyeHot: 1, glow: 2, hy: -1, sac: 1, shake: 2, tRot: -1, tdx: 1 });
    case 4: return key({ glow: 2, sac: 2, tRot: -1 }); // recover
    case 5: return key({ tdx: -1, tRot: -0.5 }); // the settle: the tail tip comes home the last px (never a dead hold on idle f0)
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ special (14 f, 1 100 ms): "Zehir Sağanağı"

// HA-3: the recovery must not shorten (same 1100 ms total; the whip in-between f4 is paid by f1–f3)
const SP_HOLDS = [70, 60, 70, 70, 90, 40, 50, 60, 80, 90, 100, 100, 110, 110];
/** special f4, the whip in-between: the arch flung up over the spread fan, the bulb at its apex above the head. */
const SP_APEX = [-93, -90, -85, -76, -62, -42, -18, 6, 32];
/** special f5, the release: a stretched whip from the rump root, up and OVER the top of the fan to the bulb. */
const SP_LASH = [-96, -88, -74, -56, -36, -16, -2, 8, 16];
function specialPose(f: number): Pose {
  switch (f) {
    case 0: return attackPose(1); // = the held attack f1, pixel for pixel
    // the crouch: barrel down 2, head down 1 more, the haunch sat, the bulb drawn back ≈ 4 px
    case 1: return key({ by: 2, sit: 1, hy: 2, sac: 0, tail: wind(0.22), glow: 2, drip: 0, nk: [0, 1] });
    // the rear in two steps: a third up with the hood half open, three-quarters with the fan opening
    case 2: return key({ by: 1, sit: 0.7, rear: 0.32, wing: 0.3, hy: 1, tail: wind(0.5), bulb: 1, glow: 2, sac: 1, drip: 0 });
    case 3: return key({ by: 0, sit: 0.35, rear: 0.68, wing: 0.68, hy: -1, tail: wind(0.8), bulb: 2, glow: 3, sac: 2, bristle: 1, drip: 0 }); // three-quarter rear, the fan opening
    case 4: return key({ by: -1, rear: 1, wing: 1, hy: -2, tail: WINDUP, bulb: 3, glow: 3, sac: 2, bristle: 1, beads: [2, 2, 2, 2, 2, 2], drip: 0 }); // full spread, the bulb swells
    case 5: return key({ by: -1, rear: 0.95, wing: 0.95, hy: -2, tail: SP_APEX, tStretch: 1.04, smear: 2, bulb: 2, glow: 3, sac: 2, bristle: 1, drip: 0 }); // the whip: the bulb at the apex over the head
    case 6: return key({ by: -1, rear: 0.9, wing: 0.9, hy: -1, tail: SP_LASH, tStretch: 1.28, tThin: 1, smear: 1, bulb: 1, glow: 2, jaw: 2, drip: 0 }); // the flat fan: the spray (a stretched whip over the fan)
    case 7: return key({ rear: 0.6, wing: 0.4, tRot: 50, tCurl: 0.32, tdy: 2, glow: 1, jaw: 1, drip: 0 }); // follow, the wings beat
    case 8: return key({ rear: 0.4, wing: 0.7, tRot: 30, tCurl: 0.6, glow: 1, drip: 0 }); // the wings beat
    case 9: return key({ rear: 0.2, wing: 0.4, tRot: 18, tCurl: 0.8, glow: 1, drip: 0 }); // recover: back onto the knuckles, the wings fold
    case 10: return key({ by: 1, wing: 0.15, tRot: 10, tCurl: 0.9, glow: 1, drip: 0, nk: [0, 0] });
    case 11: return key({ wing: 0.04, tRot: 5, glow: 1, drip: 0 });
    case 12: return key({ tRot: 2, drip: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ summon (15 f, 1 420 ms): curled → land → inhale → unfurl

const SU_HOLDS = [90, 80, 80, 90, 60, 70, 80, 80, 90, 60, 200, 90, 100, 110, 140];
const CURL_TAIL = [150, 115, 80, 45, 15, 0, -4, -6, -10];
/** The f9 peak arch (the tail fully unfurled, the bulb ignites with it). */
const PEAK = { tRot: 2, tCurl: 0.95 };
/** The unfurl from the floor wrap to the peak arch: each segment turns the short way round, so the root
 * swings up behind the rump while the distal segments roll forward over it (one continuous growth). */
/** summon f5 (critic r3): a RISING S, not a flat bar: the root swings up and back over the rump, the
 * middle turns forward, the tip dips toward the head (bulb ≈ (44, 37)); f6–f8 open it into the peak arch. */
const RISE_S = [-165, -150, -120, -80, -45, -20, 0, 15, 30];
function unfurl(t: number, toward?: readonly number[]): number[] {
  const to = toward ?? tailAngles(key(PEAK));
  return CURL_TAIL.map((c, i) => {
    let d = to[i] - c;
    while (d > 180) d -= 360;
    while (d <= -180) d += 360;
    return c + d * t;
  });
}
/** RISE_S → the peak arch: a plain angle blend (all segments already point the right way: the root rounds
 * up smoothly, never a "7" corner) */
const toPeak = (t: number): number[] => { const to = tailAngles(key(PEAK)); return RISE_S.map((a, i) => a + (to[i] - a) * t); };
function summonPose(f: number): Pose {
  // curled: body low, the head tucked UNDER the folded near wing (only the eye slit glints through a hole
  // in it), the tail wrapped round the feet with the bulb resting on the floor
  const low = { by: 4, sit: 1, hx: -9, hy: 9, tilt: 2, eye: 1, sac: 0, glow: 1, drip: 0, beads: [0, 0, 0, 0, 0, 0] };
  switch (f) {
    case 0: return key({ ...low, curl: 1, tail: CURL_TAIL, nk: [-3, 3] });
    case 1: return key({ ...low, curl: 1, tail: CURL_TAIL.map((a, i) => (i >= 7 ? a - 12 : a)), nk: [-3, 3] }); // the tail tip flicks
    case 2: return key({ ...low, curl: 0.9, tail: CURL_TAIL.map((a, i) => (i >= 6 ? a - 24 : a)), nk: [-2, 3], tdx: 1 }); // the wing stirs
    // the rise: the knuckles plant, the wing slides back off the head, the tail grows from the wrap into the arch
    case 3: return key({ ...low, curl: 0.5, by: 4, hx: -7, hy: 6, tilt: 1, tail: unfurl(0.3, RISE_S).map((a, i) => (i === 1 || i === 2 ? a - 25 : a)), nk: [0, 0] });
    case 4: return key({ by: 3, sit: 0, curl: 0.12, hx: -4, hy: 3, eye: 1, sac: 0, tail: RISE_S.map((a, i) => (i < 2 ? a - 8 : a + 14)), glow: 1, drip: 0, nk: [0, 0] }); // land: idle height − 3; the S still low and tight
    case 5: return key({ by: 2, hx: -1, hy: 1, sac: 0, tail: RISE_S, glow: 1, drip: 0 }); // the head lifts; the tail a rising S
    case 6: return key({ by: 1, hy: -1, tilt: -1, jaw: 1, sac: 1, tail: toPeak(0.4), glow: 1, drip: 0 }); // inhale
    case 7: return key({ by: 1, hy: -1, tilt: -1, jaw: 2, sac: 2, tail: toPeak(0.72), glow: 2, wing: 0.15, drip: 0 });
    case 8: return key({ hy: -2, tilt: -1, jaw: 2, sac: 3, tail: toPeak(0.92), glow: 2, wing: 0.3, drip: 0, bristle: 1 });
    case 9: return key({ hy: -2, jaw: 1, sac: 3, ...PEAK, wing: 0.6, glow: 3, bulb: 2, bristle: 2, drip: 0, beads: [2, 2, 2, 2, 2, 2] }); // peak: the arch completes, the bulb ignites, the hood flares
    case 10: return key({ hy: -2, jaw: 1, sac: 3, ...PEAK, wing: 0.6, glow: 3, bulb: 3, bristle: 2, drip: 0, beads: [2, 2, 2, 2, 2, 2], tdx: 1, t: 0.5 }); // the cut-in hold: the bulb pulses 1 px
    case 11: return key({ hy: -1, jaw: 1, sac: 1, mist: 1, tRot: 1, wing: 0.4, glow: 2, bulb: 1, drip: 0, beads: [1, 1, 1, 1, 1, 1] }); // exhale
    case 12: return key({ sac: 1, mist: 2, wing: 0.2, glow: 2, tRot: 1, drip: 0 });
    case 13: return key({ wing: 0.05, glow: 1, drip: 0 });
    default: return IDLE0;
  }
}

// ------------------------------------------------------------------ death (13 f, 780 ms): "Kendi Zehri"

const D_HOLDS = [50, 50, 60, 60, 50, 40, 50, 100, 60, 60, 120, 40, 40];
/** The lace's arch buckles at its mid joint (death slump): the root holds, the distal half folds down. */
const BUCKLE = (a: readonly number[]): number[] => a.map((v, i) => v + (i >= 4 ? 34 + (i - 4) * 10 : i * 3));
function deathPose(f: number): Pose {
  const locked = { tail: tailAngles(key({ tRot: -3, tCurl: 1.08 })) }; // the arch locks rigid
  const lace = { ...locked, bx: -1, hx: -3, tilt: 1, eye: 2, sac: 0 };
  switch (f) {
    case 0: return hitHeavyPose(0);
    case 1: return key({ bx: -1, by: 1, hx: -3, hy: 1, tilt: 1, eye: 2, sac: 0, tdx: -2, tRot: -2, nk: [-1, 2] }); // the reel
    case 2: return key({ ...lace, by: 3, hy: 2, nk: [-1, 0], glow: 2 }); // the knees buckle
    case 3: return key({ ...lace, by: 3, hy: 3, seam: 1, glow: 2 }); // dissolve: the seam web
    case 4: return key({ ...lace, by: 3, hy: 3, seam: 0.6, holes: 1, glow: 2 }); // whole holes open at the venom sources
    case 5: return key({ ...lace, by: 3, hy: 3, seam: 0.25, holes: 1.5, glow: 2, drape: 2 }); // half the cells eaten
    case 6: return key({ ...lace, by: 4, hy: 4, seam: 0, holes: 2, glow: 2, drape: 3 });
    case 7: return key({ ...lace, by: 4, hy: 4, seam: 0, holes: 3, glow: 1, drape: 3 }); // the lace (held)
    // the slump: the barrel sags, the arch buckles at its mid joint and the bulb drops ≈ 15 px
    case 8: return key({ ...lace, tail: BUCKLE(locked.tail), by: 11, sit: 1, hy: 9, tilt: 2, holes: 3, glow: 1, drape: 3 });
    case 9: return key({ ...lace, tail: BUCKLE(locked.tail), by: 11, sit: 1, hy: 9, tilt: 0, holes: 3, slump: 1, pool: 1, marker: 0, mtilt: -45, mlift: 6, glow: 1 }); // into the pool: the stinger falls, tilted, with a smear
    case 10: return key({ body: 0, pool: 1, marker: 0, glow: 1 }); // the stinger marker (held)
    case 11: return key({ body: 0, pool: 1, marker: 1.6, glow: 0 }); // it sinks, the bead falls
    default: return key({ body: 0, pool: 0.9, marker: 2.6, glow: 0 }); // the hook tip only
  }
}

// ------------------------------------------------------------------ revive (11 f, 830 ms; land@7 at 500 ms)

const RV_HOLDS = [90, 50, 70, 60, 110, 60, 60, 60, 80, 90, 100];
const REVIVE_RISE: Partial<Pose> = { tail: BUCKLE(tailAngles(key({ tRot: -3, tCurl: 1.08 }))), bx: -1, by: 11, sit: 1, hx: -3, hy: 9, tilt: 2, eye: 2, sac: 0, holes: 3, drape: 3 };
function revivePose(f: number): Pose {
  switch (f) {
    case 0: return key({ body: 0, glob: 1, glow: 0 }); // the glob hovers
    case 1: return key({ body: 0, glob: 2, glow: 0 }); // the fall
    case 2: return key({ body: 0, glob: 3, pool: 1, glow: 0 }); // the splat
    // the arch grows up out of the pool first (the death slump in reverse): a low buckled lace, the stinger
    // carried up to y ≈ 60, before the body fills in
    case 3: return key({ ...REVIVE_RISE, pool: 1, glow: 1, drip: 0 });
    case 4: return key({ by: 2, eye: 2, sac: 0, holes: 3, seam: 0, pool: 0.6, glow: 1, drip: 0 }); // the lace stands up
    // the web fades one step a frame (100 → 60 → 25 → 0 %) while the holes close: never a re-flare
    case 5: return key({ by: 2, eye: 2, sac: 0, holes: 1.95, seam: 1, glow: 1, drip: 0 });
    case 6: return key({ by: 1, eye: 1, sac: 0, holes: 1, seam: 0.6, glow: 1, drip: 0, nk: [0, 3] }); // the near knuckle raised
    case 7: return key({ by: 1, eye: 1, sac: 0, seam: 0.25, glow: 1, drip: 0, nk: [0, 0] }); // land: the hide whole, the knuckle slams down, the knees flex
    case 8: return key({ sac: 2, eye: 0, glow: 1, drip: 0 }); // the first breath
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
  death: spec(13, 14, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 3 }),
  revive: spec(11, 13, false, RV_HOLDS, { land: 7 }),
  special: spec(14, 11, false, SP_HOLDS, { charge: 1, release: 6, impact: 6, contact: 8, recover: 9 }),
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
  lace: 7,
  slump: 9,
  marker: 10,
  spray: 6,
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
  if (o.mtilt !== 0 || o.mlift !== 0) {
    // the falling stinger (death f7): the hook tip of the tilted marker, as markerPass lays it out
    const a = (o.mtilt * Math.PI) / 180;
    const base = GY - 2 + rnd(Math.max(0, o.marker) * 4.5) - o.mlift;
    return { x: rnd(AX + 2 + 3 * Math.cos(a) + 17 * Math.sin(a)), y: rnd(base + 3 * Math.sin(a) - 17 * Math.cos(a)) };
  }
  return { x: AX + 2, y: GY - 2 - rnd(Math.max(0, 15 - Math.max(0, o.marker) * 4.5)) };
}

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const pt = (p: readonly [number, number]) => ({ x: rnd(p[0]), y: rnd(p[1]) });
  if (o.body <= 0 || (o.slump > 0 && o.marker >= 0)) {
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
