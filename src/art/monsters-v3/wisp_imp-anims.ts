// Tüy Hayalet / Down Wisp (wisp_imp, R3) — every anim as keyed poses with per-frame holds, marks and
// points (src/art/monsters-v3/wisp_imp.ts is the MonsterArt; wisp_imp-rig.ts draws a Pose).
//
// Rhythm signature (REHBER §4, the Sv1 floater): a feather-light ghost that never stops drifting.
// Its motion is AIR, not muscle: everything lags (hood one frame behind the float, the plumes and the
// tail two to three frames behind, the loose feather a whole story behind), every stop overshoots and
// settles in soft wobbles, and the long holds sit at the top of a breath, never at an impact.
//   idle     20 f / 1.96 s loop  a lazy figure eight (the float ±1 px, the skirt's sway at twice the
//                                rate → the tail tip draws the 8), edge plumes lift in a wave twice
//                                per loop, the cowlick and the hands trail; one feather slips out of
//                                its slot at the back of the hood, rocks down like a pendulum, glides
//                                back up and clicks in — the eyes follow it down and back; one blink
//   guard     8 f / 1.04 s loop  ducked into its sheet: squashed, plumes bristled, both hands over
//                                the face, only the eyes peeking over them; the plumes shiver, the
//                                eyes peek / blink, the hands tremble
//   toGuard   6 f / 0.39 s       a startled hop up, then the duck (dx 0: the float never slides)
//   fromGuard 5 f / 0.37 s       it pops up out of the duck, stretches, settles on idle f0
//   roar     11 f / 1.10 s       "bö!": a deep inhale (charge@1), it rears up tall, the hollow gapes,
//                                hands flung up, feathers puff off (release = impact@4), a shiver,
//                                recover@7 → idle f0
//   attack   14 f / 1.42 s       "Tüy Oku Sağanağı": it puffs to 130 % (charge@1, the long hold at the
//                                full puff f3), rocks back (f4), snaps flat and fires a sheaf of
//                                feather darts from its front (release = impact@5), contact@6, a
//                                second volley trails, recover@8, deflated wobble → idle f0
//   hit       6 f / 0.51 s       contact local (hood knocked back, eyes squeezed, cowlick flinches),
//                                then the whole sheet recoils, three feathers knocked loose
//   hitHeavy  8 f / 0.74 s       = death f0, tumbles back, the float drops, dizzy, springs up
//   hitMagic  8 f / 0.74 s       eyes white-hot, every feather one value up and on end, sparks, a
//                                rigid 1-px jolt, then a sag
//   summon   14 f / 1.35 s       one feather rocks down like a pendulum to the tile (f0–f4), a
//                                fountain of feathers whirls up and builds the ghost face first,
//                                land@9 (a soft squash), "bö!" (f10), settle → idle f0
//   death    10 f / 0.86 s       the heavy struck pose → thrown back → it crumples; the WIND strips
//                                it from the front edge backward, feathers streaming back
//                                (dissolve@4), the eyes go last. (No "pof": that is the special's.)
//   revive   12 f / 1.22 s       the wind brought back: feathers stream in from behind and lay
//                                themselves in, land@5 (crumpled), it fills, first breath, looks
//                                around → idle f0
//   special  12 f / 1.30 s       the FEATHER PILLOW (signature): it hugs itself, rounds into a
//                                cushion with four tufted corners (the long hold f3), squeezes
//                                (f4), and POOFS (release = impact@5) — a ring of down bursts out;
//                                the cushion springs back into the ghost, recover@8 → idle f0. The
//                                effect cinematic plays 0..release and takes over from the poof.
// All one-shots except death end on idle f0 (HA-14 out = 0) and start at the float's baseline
// (HA-10): the idle float is ±1 px round it.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, HX, HY, NEUTRAL, REST_FEATHER, handPoint, hollowCentre, pose, type Burst, type Feather, type Hand, type Pose } from './wisp_imp-rig';

const TAU = Math.PI * 2;
const sin = Math.sin;

const Hd = (x: number, y: number, ang: number, spread = 0, len = 0): Hand => ({ x, y, ang, spread, len });
const burst = (t: number, n: number, ox: number, oy: number, dir: number, fan: number, spd: number, seed: number, grav?: number): Burst => ({ t, n, ox, oy, dir, fan, spd, seed, ...(grav !== undefined ? { grav } : {}) });
const Fe = (x: number, y: number, ang: number, len = 6.5, bow = -1): Feather => ({ x, y, ang, len, bow });

// ------------------------------------------------------------------ idle (20 frames)

const IDLE_N = 20;

/** the loose feather's little story (skirt-top relative): slips out f2, rocks down, glides back, clicks in f16 */
const LOOSE_PATH: (Feather | null)[] = [
  null,
  null,
  Fe(-10, 1, 165, 6.5, -1.4),
  Fe(-14, 3, 140, 6.2, -1),
  Fe(-19, 6, 205, 6, 1.2),
  Fe(-16.5, 10, 125, 6, -1.2),
  Fe(-19.5, 13, 210, 6, 1.4),
  Fe(-17.5, 16, 135, 6, -1),
  Fe(-19.5, 18, 195, 6, 1),
  Fe(-19.5, 19, 160, 6, -0.6),
  Fe(-20.5, 16, 178, 6, -1),
  Fe(-20.5, 11, 188, 6, -1.4),
  Fe(-20, 6, 175, 6.2, -1.4),
  Fe(-16, 3, 162, 6.4, -1.4),
  Fe(-12, 1.5, 156, 6.5, -1.3),
  Fe(-9, 1, 153, 6.5, -1.2),
  null,
  null,
  null,
  null,
];

export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const t = k / IDLE_N;
  // the float lives in the hood (it rises a pixel on the in-breath, once per loop, while the loose
  // feather is home) and in the sway of the tail under it: the sheet never shifts as a whole, so a
  // blow in any idle phase lands on a body that is still mostly idle f0 (HA-21 phase)
  const hy = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.4, -0.8, -1, -1, -0.7, -0.3][k];
  const lp = LOOSE_PATH[k];
  // the eyes follow the feather down and back
  const look = lp ? -1 : 0;
  const lookY = lp && lp.y > 9 ? 1 : 0;
  const eyes = k === 17 ? 'blink' : k === 18 ? 'shut' : 'open';
  return pose({
    hy,
    ripple: (2 * t) % 1,
    rippleAmp: 0.62,
    tailSwing: 1.3 * (sin((t - 0.15) * TAU) - sin(-0.15 * TAU)),
    tailCurl: 0.6 + 0.22 * (sin((2 * t - 0.3) * TAU) - sin(-0.3 * TAU)),
    crestX: 1.3 * (sin((t - 0.1) * TAU) - sin(-0.1 * TAU)),
    crestY: 0.8 * (sin((2 * t - 0.2) * TAU) - sin(-0.2 * TAU)),
    handN: Hd(0, 0, 10 * (sin((2 * t - 0.1) * TAU) - sin(-0.1 * TAU))),
    handF: Hd(0, Math.round(0.9 * (sin((t - 0.2) * TAU) - sin(-0.2 * TAU))), 14 * (sin((t - 0.2) * TAU) - sin(-0.2 * TAU))),
    eyes,
    lookX: look,
    lookY,
    loose: lp ?? REST_FEATHER,
  });
}

const IDLE_HOLDS = [100, 90, 90, 100, 110, 100, 90, 90, 100, 110, 100, 90, 90, 100, 110, 100, 90, 90, 100, 110];

// ------------------------------------------------------------------ guard (8 frames)

const GUARD_N = 8;
const GUARD_BASE: Partial<Pose> = {
  by: 2,
  sh: -2,
  sw: 1,
  len: -2,
  fluff: 1,
  hollow: 0,
  eyes: 'peek',
  tailCurl: 0.85,
  tailLift: 1,
  crestX: -2,
  crestY: 1,
  // both little hands up over the lower half of the face, the eyes peeking over them
  handN: Hd(-5, -5, -62, -12, -1),
  handF: Hd(7, -5, 205, -12, -1),
  ripple: 0,
  rippleAmp: 0.4,
};

export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const t = k / GUARD_N;
  const tremble = k % 2 === 1 ? 1 : 0;
  return pose({
    ...GUARD_BASE,
    ripple: t,
    rippleAmp: 0.55,
    handN: Hd(-5, -5 + (k === 3 || k === 4 ? 1 : 0), -62, -12, -1),
    handF: Hd(7 - tremble, -5, 205, -12, -1),
    eyes: k === 5 ? 'blink' : 'peek',
    lookX: k >= 1 && k <= 3 ? 1 : 0,
    tailSwing: Math.round(1.2 * sin((t - 0.25) * TAU)),
    crestX: -2 + (k === 6 || k === 7 ? 1 : 0),
  });
}

const GUARD_HOLDS = [140, 120, 120, 130, 150, 110, 140, 130];

// ------------------------------------------------------------------ keyed one-shots

type Key = readonly [ms: number, p: Partial<Pose>];
interface Table {
  keys: readonly Key[];
  marks: AnimSpec['marks'];
}

/** the heavy contact (hitHeavy f0 = death f0): LOCAL — the face takes it (eyes knocked to x, the hollow
 * pinched), the cowlick flattens, the hands jerk; the sheet itself is still idle f0 (HA-21) */
const STRUCK_HEAVY: Partial<Pose> = { eyes: 'x', hollow: -1, crestX: -3, crestY: 2, handN: Hd(0, -1, -20) };

// attack: "Tüy Oku Sağanağı" ------------------------------------------------------------
const ATTACK: Table = {
  marks: { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 },
  keys: [
    [70, { eyes: 'squint', lookX: 1, handN: Hd(-1, 0, 25), handF: Hd(1, 0, -15) }],
    [90, { puff: 0.3, fluff: 0.5, eyes: 'squint', lookX: 1, by: 1, sh: -1, handN: Hd(-2, -1, 50, 8), handF: Hd(2, -1, -35, 8), crestX: -1, tailCurl: 0.8 }],
    [110, { puff: 0.65, fluff: 1.2, eyes: 'squint', lookX: 1, by: 0, handN: Hd(-1, -2, 70, 16, 1), handF: Hd(1, -2, -55, 16, 1), crestX: -2, crestY: -1, tailCurl: 0.9, tailLift: 1, rippleAmp: 0.6, ripple: 0.3 }],
    [170, { puff: 1, fluff: 2, eyes: 'squint', lookX: 1, by: -1, hollow: 1, handN: Hd(0, -3, 85, 24, 1), handF: Hd(0, -3, -70, 24, 1), crestX: -2, crestY: -2, tailCurl: 1, tailLift: 2, rippleAmp: 1.2, ripple: 0.6 }],
    [50, { puff: 1, fluff: 2, eyes: 'squint', lookX: 1, by: -1, bx: -1, hx: -1, hollow: 1, handN: Hd(-1, -3, 95, 26, 1), handF: Hd(-1, -3, -80, 26, 1), crestX: -3, crestY: -2, tailCurl: 1, tailLift: 2, drift: 1, rippleAmp: 1.2, ripple: 0.8 }],
    [60, { puff: 0.15, fluff: 1.5, eyes: 'wide', lookX: 1, bx: 2, hx: 1, by: 0, hollow: 2, drift: -3, handN: Hd(3, -1, -20, 10, 1), handF: Hd(4, -2, 140, 10), crestX: -3, crestY: 1, tailSwing: -3, tailCurl: 0.3, bursts: [burst(0, 7, 8, 1, 0, 0.55, 2.6, 41, 0)] }],
    [80, { puff: 0, fluff: 1, eyes: 'wide', lookX: 1, bx: 1, by: 0, hollow: 1, drift: -2, handN: Hd(2, -1, -10, 6), handF: Hd(3, -1, 120, 6), crestX: -2, crestY: 1, tailSwing: -2, tailCurl: 0.35, bursts: [burst(1, 7, 8, 1, 0, 0.55, 2.6, 41, 0), burst(0, 4, 7, 3, 0.1, 0.4, 2.2, 43, 0)] }],
    [90, { fluff: 0.6, eyes: 'open', lookX: 1, bx: 1, by: -1, sw: -1, sh: 1, drift: 0, handN: Hd(1, 0, 5), handF: Hd(2, 0, 60), crestX: 1, crestY: 0, tailSwing: 1, tailCurl: 0.5, bursts: [burst(2, 7, 8, 1, 0, 0.55, 2.6, 41, 0), burst(1, 4, 7, 3, 0.1, 0.4, 2.2, 43, 0)] }],
    [100, { fluff: 0.3, eyes: 'open', lookX: 1, bx: 0, by: -1, sw: -1, sh: 1, drift: 1.5, handN: Hd(0, 1, 15), handF: Hd(1, 1, 20), crestX: 2, crestY: 0, tailSwing: 2, tailCurl: 0.7, rippleAmp: 0.8, ripple: 0.1, bursts: [burst(3, 4, 7, 3, 0.1, 0.4, 2.2, 43, 0)] }],
    [100, { eyes: 'blink', bx: 0, by: 1, sw: 1, sh: -1, drift: 0.5, handN: Hd(0, 0, -6), handF: Hd(0, 0, -8), crestX: 0, crestY: 1, tailSwing: -1, tailCurl: 0.55, rippleAmp: 0.8, ripple: 0.35 }],
    [110, { by: 0, sw: 0, sh: 1, drift: -0.6, handN: Hd(0, 0, 6), handF: Hd(0, 0, 6), crestX: -1, tailSwing: 1, tailCurl: 0.65, rippleAmp: 0.6, ripple: 0.6 }],
    [120, { by: 0, sh: 0, drift: 0.4, crestX: 0.6, tailSwing: -0.5, rippleAmp: 0.4, ripple: 0.85 }],
    [130, { drift: -0.2, crestX: -0.3, tailSwing: 0.3 }],
    [140, {}],
  ],
};

// roar: "bö!" ------------------------------------------------------------------------
const ROAR: Table = {
  marks: { charge: 1, release: 4, impact: 4, recover: 7 },
  keys: [
    [80, { eyes: 'wide', hollow: 0, crestX: 1, handN: Hd(0, 0, 10), handF: Hd(0, 0, 10) }],
    [110, { by: 1, sh: -1, sw: 1, eyes: 'blink', hollow: -1, handN: Hd(-2, 0, 55), handF: Hd(2, 0, -40), crestX: -1, crestY: 1, tailCurl: 0.8 }],
    [160, { by: 2, sh: -2, sw: 2, len: -2, eyes: 'shut', hollow: -1, fluff: 0.5, handN: Hd(-3, 1, 75, 10), handF: Hd(3, 1, -60, 10), crestX: -2, crestY: 2, tailCurl: 1, tailLift: 1 }],
    [70, { by: 0, sh: 1, sw: -1, len: 1, eyes: 'wide', hollow: 1, fluff: 1, handN: Hd(0, -3, -50, 10), handF: Hd(0, -3, 230, 10), crestX: 1, crestY: -2, tailCurl: 0.5 }],
    [100, { by: -1, sh: 2, sw: -1, len: 2, eyes: 'wide', hollow: 3, fluff: 2, glow: 1, handN: Hd(1, -6, -100, 24, 1), handF: Hd(-1, -6, 260, 24, 1), crestX: 3, crestY: -2, tailCurl: 0.2, tailSwing: -2, rippleAmp: 1.4, ripple: 0.1, bursts: [burst(0, 6, -2, -9, -Math.PI / 2, 2.4, 1.3, 51, 0.16)] }],
    [90, { by: -1, bx: 1, sh: 2, sw: -1, len: 2, eyes: 'wide', hollow: 3, fluff: 2, glow: 1, handN: Hd(1, -6, -110, 28, 1), handF: Hd(-1, -6, 270, 28, 1), crestX: 2, crestY: -2, tailCurl: 0.25, tailSwing: 2, rippleAmp: 1.4, ripple: 0.35, bursts: [burst(1, 6, -2, -9, -Math.PI / 2, 2.4, 1.3, 51, 0.16)] }],
    [80, { by: -1, bx: 0, sh: 1, len: 1, eyes: 'wide', hollow: 2, fluff: 1.5, handN: Hd(1, -5, -95, 20), handF: Hd(-1, -5, 255, 20), crestX: 3, crestY: -2, tailCurl: 0.3, tailSwing: -1, rippleAmp: 1.2, ripple: 0.6, bursts: [burst(2, 6, -2, -9, -Math.PI / 2, 2.4, 1.3, 51, 0.16)] }],
    [100, { by: 1, sh: -1, sw: 1, eyes: 'happy', hollow: 0, fluff: 0.6, handN: Hd(0, -1, -20), handF: Hd(0, -1, 30), crestX: -1, crestY: 1, tailCurl: 0.7, tailSwing: 1, rippleAmp: 0.8, ripple: 0.85, bursts: [burst(3, 5, -2, -9, -Math.PI / 2, 2.4, 1.3, 51, 0.16)] }],
    [110, { by: 0, sh: 1, sw: 0, eyes: 'open', fluff: 0.2, handN: Hd(0, 0, 8), handF: Hd(0, 0, -6), crestX: 1, tailSwing: -0.6, tailCurl: 0.6 }],
    [120, { sh: 0, crestX: -0.4, tailSwing: 0.3 }],
    [130, {}],
  ],
};

// hit family ------------------------------------------------------------------------
const HIT: Table = {
  marks: { impact: 0, contact: 0, recover: 3 },
  keys: [
    [50, { eyes: 'squeeze', hollow: -1, crestX: -2, crestY: 1, handN: Hd(0, -1, -15) }],
    [60, { hx: -2, bx: -2, drift: 2.5, sw: 1, sh: -1, eyes: 'squeeze', hollow: -1, fluff: 1, crestX: -3, crestY: 2, handN: Hd(-1, -2, -45, 10), handF: Hd(-1, -2, 45, 10), tailSwing: 3, tailCurl: 0.3, rippleAmp: 1.2, ripple: 0.2, bursts: [burst(0, 3, 9, 4, Math.PI * 0.85, 0.9, 1.2, 61, 0.2)] }],
    [130, { hx: -1, bx: -1, drift: 0.5, sw: -1, sh: 1, eyes: 'blink', fluff: 0.5, crestX: 1, crestY: 0, handN: Hd(0, 0, 15), handF: Hd(0, 0, -10), tailSwing: -1, tailCurl: 0.5, rippleAmp: 0.8, ripple: 0.5, bursts: [burst(1, 3, 9, 4, Math.PI * 0.85, 0.9, 1.2, 61, 0.2)] }],
    [100, { hx: 0, bx: 0, drift: -0.6, sw: 0, sh: -1, eyes: 'open', crestX: -0.6, handN: Hd(0, 0, -6), handF: Hd(0, 0, 6), tailSwing: 1, tailCurl: 0.65, rippleAmp: 0.5, ripple: 0.8, bursts: [burst(3, 3, 9, 4, Math.PI * 0.85, 0.9, 1.2, 61, 0.2)] }],
    [110, { drift: 0.3, sh: 0, crestX: 0.4, tailSwing: -0.4 }],
    [120, {}],
  ],
};

const HIT_HEAVY: Table = {
  marks: { impact: 0, contact: 0, recover: 3 },
  keys: [
    [50, { ...STRUCK_HEAVY }],
    [60, { ...STRUCK_HEAVY, bx: -3, by: -1, drift: 4, sw: 2, sh: -2, fluff: 2, eyes: 'x', handN: Hd(-2, -3, -60, 20), handF: Hd(-2, -3, 60, 20), tailSwing: 4, tailCurl: 0.2, rippleAmp: 1.5, ripple: 0.2, loose: Fe(-12, -1, 200, 6, 1), bursts: [burst(0, 6, 8, 3, Math.PI * 0.9, 1.4, 1.4, 71, 0.18)] }],
    [130, { hx: -1, bx: -3, by: 3, drift: 2, sw: 1, sh: -2, fluff: 1.5, eyes: 'dizzy', hollow: -1, crestX: -1, crestY: 2, handN: Hd(-1, 2, 50), handF: Hd(-1, 2, -40), tailSwing: 1, tailCurl: 0.4, rippleAmp: 1.2, ripple: 0.45, loose: Fe(-14, 3, 170, 6, -1), bursts: [burst(1, 6, 8, 3, Math.PI * 0.9, 1.4, 1.4, 71, 0.18)] }],
    [100, { bx: -2, by: 2, drift: 0, sw: 1, sh: -1, fluff: 1, eyes: 'dizzy', crestX: 1, handN: Hd(0, 1, 30), handF: Hd(0, 1, -20), tailSwing: -1, tailCurl: 0.5, rippleAmp: 1, ripple: 0.7, loose: Fe(-11, 2, 158, 6.5, -1.2), bursts: [burst(3, 5, 8, 3, Math.PI * 0.9, 1.4, 1.4, 71, 0.18)] }],
    [110, { bx: -1, by: -1, sw: -1, sh: 1, fluff: 0.5, eyes: 'blink', crestX: 1.5, crestY: -1, handN: Hd(0, -1, -10), handF: Hd(0, -1, 10), tailSwing: 1, tailCurl: 0.6, rippleAmp: 0.6, ripple: 0.95 }],
    [120, { bx: 0, by: 0, sw: 0, sh: -1, eyes: 'open', crestX: -0.6, tailSwing: -0.6 }],
    [130, { sh: 0, crestX: 0.3, tailSwing: 0.3 }],
    [140, {}],
  ],
};

const HIT_MAGIC: Table = {
  marks: { impact: 0, contact: 0, recover: 3 },
  keys: [
    [50, { glow: 2, eyes: 'wide', spark: 2, crestY: -2, handN: Hd(0, -1, -20) }],
    [60, { glow: 2, lit: 1, eyes: 'wide', fluff: 2, spark: 2, bx: 1, hollow: 1, crestX: 1, crestY: -2, handN: Hd(0, -2, -30, 16), handF: Hd(0, -2, 30, 16), rippleAmp: 1.3, ripple: 0.3, tailCurl: 0.9 }],
    [130, { glow: 1, lit: 0, eyes: 'wide', fluff: 2, spark: 1, bx: -1, hollow: 1, crestX: -1, crestY: -2, handN: Hd(0, -2, -36, 16), handF: Hd(0, -2, 36, 16), rippleAmp: 1.3, ripple: 0.55, tailCurl: 0.9, seed: 3 }],
    [100, { glow: 0, eyes: 'blink', fluff: 1, by: 2, sh: -1, sw: 1, hollow: -1, crestX: -1, crestY: 2, handN: Hd(0, 2, 40), handF: Hd(0, 2, -40), tailCurl: 0.5, tailSwing: 1, rippleAmp: 0.8, ripple: 0.8 }],
    [110, { eyes: 'open', fluff: 0.5, by: 1, sh: -1, crestX: 0.6, crestY: 1, handN: Hd(0, 1, 20), handF: Hd(0, 1, -20), tailCurl: 0.55, tailSwing: -0.6 }],
    [120, { by: 0, sh: 1, fluff: 0, crestX: -0.4, handN: Hd(0, 0, -5), handF: Hd(0, 0, 5), tailSwing: 0.3 }],
    [130, { sh: 0, crestX: 0.2 }],
    [140, {}],
  ],
};

// summon: one feather rocks down, the fountain builds the ghost, "bö!" ----------------------
const GONE: Partial<Pose> = { erode: 1, erodeDir: 1, seed: 4, loose: null };
const SUMMON: Table = {
  marks: { land: 9 },
  keys: [
    [100, { ...GONE, free: [Fe(0, -12, 165, 8, -1.4)] }],
    [100, { ...GONE, free: [Fe(-4, -4, 205, 8, 1.4)] }],
    [100, { ...GONE, free: [Fe(3, 5, 150, 8, -1.4)] }],
    [90, { ...GONE, free: [Fe(-3, 14, 200, 8, 1.2)] }],
    [80, { ...GONE, free: [Fe(-2, 24, 172, 8, -0.4)], swirl: 0.15, swirlT: 0, swirlRise: 0 }],
    [70, { ...GONE, erode: 0.92, swirl: 0.5, swirlT: 0.25, swirlRise: 3, by: 3, sh: -2, bursts: [burst(0, 6, 0, 18, -Math.PI / 2, 1.6, 1.4, 81, 0.1)] }],
    [70, { ...GONE, erode: 0.7, swirl: 0.85, swirlT: 0.55, swirlRise: 9, by: 2, sh: -1, eyes: 'blink', bursts: [burst(1, 6, 0, 18, -Math.PI / 2, 1.6, 1.4, 81, 0.1)] }],
    [70, { ...GONE, erode: 0.45, swirl: 1, swirlT: 0.85, swirlRise: 15, by: 1, eyes: 'open', bursts: [burst(2, 6, 0, 18, -Math.PI / 2, 1.6, 1.4, 81, 0.1)] }],
    [80, { ...GONE, erode: 0.18, swirl: 0.7, swirlT: 1.15, swirlRise: 20, by: -1, sh: 1, eyes: 'open', loose: REST_FEATHER }],
    [90, { by: 2, sh: -2, sw: 2, len: -2, eyes: 'shut', fluff: 1, swirl: 0.3, swirlT: 1.4, swirlRise: 24, handN: Hd(-1, 1, 45, 10), handF: Hd(1, 1, -35, 10), tailCurl: 0.9, crestY: 2 }],
    [140, { by: -1, sh: 2, sw: -1, len: 2, eyes: 'wide', hollow: 3, fluff: 1.5, glow: 1, handN: Hd(1, -6, -100, 24, 1), handF: Hd(-1, -6, 260, 24, 1), crestX: 3, crestY: -3, tailCurl: 0.25, rippleAmp: 1.2, ripple: 0.2 }],
    [110, { by: 1, sh: -1, sw: 1, eyes: 'happy', hollow: 0, fluff: 0.5, handN: Hd(0, -1, -15), handF: Hd(0, -1, 25), crestX: -1, crestY: 1, tailCurl: 0.7, rippleAmp: 0.8, ripple: 0.6 }],
    [120, { by: 0, sh: 1, eyes: 'open', crestX: 0.6, tailSwing: -0.6 }],
    [130, {}],
  ],
};

// death: the wind takes it (no event: no pillow, no pof) ----------------------------------------
const WIND = Math.PI; // backward, away from the attacker
const SLUMP: Partial<Pose> = { bx: -3, by: 3, drift: 2, sw: 2, sh: -3, len: -2, eyes: 'dizzy', hollow: -1, handN: Hd(0, 3, 60), handF: Hd(0, 3, -50), tailCurl: 0.2, tailSwing: 3, crestX: -3, crestY: 2, loose: null };
const DEATH: Table = {
  marks: { impact: 0, contact: 0, dissolve: 4 },
  keys: [
    [50, { ...STRUCK_HEAVY }],
    [60, { ...STRUCK_HEAVY, bx: -3, by: -1, drift: 4, sw: 2, sh: -2, fluff: 2, handN: Hd(-2, -3, -60, 20), handF: Hd(-2, -3, 60, 20), tailSwing: 4, tailCurl: 0.2, rippleAmp: 1.5, ripple: 0.2, loose: Fe(-12, -1, 200, 6, 1), bursts: [burst(0, 6, 8, 3, Math.PI * 0.9, 1.4, 1.4, 71, 0.18)] }],
    [80, { ...SLUMP, fluff: 1.5, rippleAmp: 1.2, ripple: 0.4, free: [Fe(-16, 2, 190, 6, 1)], bursts: [burst(1, 6, 8, 3, Math.PI * 0.9, 1.4, 1.4, 71, 0.18)] }],
    [90, { ...SLUMP, fluff: 2, rippleAmp: 1.5, ripple: 0.65, erode: 0.12, erodeDir: -1, seed: 6, free: [Fe(-17, 1, 175, 6, -1)], bursts: [burst(0, 5, 6, 2, WIND, 0.5, 1.8, 91, 0.02)] }],
    [90, { ...SLUMP, fluff: 2, rippleAmp: 1.5, ripple: 0.9, erode: 0.32, erodeDir: -1, seed: 6, bursts: [burst(1, 5, 6, 2, WIND, 0.5, 1.8, 91, 0.02), burst(0, 5, 2, 8, WIND, 0.6, 1.8, 93, 0.02)] }],
    [90, { ...SLUMP, fluff: 2, rippleAmp: 1.5, ripple: 0.15, erode: 0.52, erodeDir: -1, seed: 6, bursts: [burst(2, 5, 6, 2, WIND, 0.5, 1.8, 91, 0.02), burst(1, 5, 2, 8, WIND, 0.6, 1.8, 93, 0.02)] }],
    [90, { ...SLUMP, fluff: 2, rippleAmp: 1.5, ripple: 0.4, erode: 0.7, erodeDir: -1, seed: 6, eyes: 'blink', bursts: [burst(3, 5, 6, 2, WIND, 0.5, 1.8, 91, 0.02), burst(2, 5, 2, 8, WIND, 0.6, 1.8, 93, 0.02)] }],
    [90, { ...SLUMP, fluff: 2, rippleAmp: 1.5, ripple: 0.65, erode: 0.84, erodeDir: -1, seed: 6, eyes: 'shut', bursts: [burst(3, 5, 2, 8, WIND, 0.6, 1.8, 93, 0.02)] }],
    [100, { ...SLUMP, erode: 0.93, erodeDir: -1, seed: 6, eyes: 'shut' }],
    [120, { ...SLUMP, erode: 0.985, erodeDir: -1, seed: 6, eyes: 'shut' }],
  ],
};

// revive: the wind brings it back --------------------------------------------------------
const REVIVE: Table = {
  marks: { land: 5 },
  keys: [
    [100, { ...SLUMP, erode: 0.97, erodeDir: -1, seed: 8, eyes: 'shut' }],
    [100, { ...SLUMP, erode: 0.86, erodeDir: -1, seed: 8, eyes: 'shut' }],
    [90, { ...SLUMP, erode: 0.68, erodeDir: -1, seed: 8, eyes: 'blink' }],
    [90, { ...SLUMP, erode: 0.46, erodeDir: -1, seed: 8, eyes: 'blink', fluff: 1 }],
    [90, { ...SLUMP, erode: 0.22, erodeDir: -1, seed: 8, eyes: 'open', fluff: 1, rippleAmp: 1, ripple: 0.3 }],
    [110, { ...SLUMP, eyes: 'open', fluff: 0.5, loose: REST_FEATHER, rippleAmp: 0.8, ripple: 0.6 }],
    [90, { bx: -1, by: 1, drift: 1, sw: 1, sh: -1, eyes: 'open', handN: Hd(0, 1, 30), handF: Hd(0, 1, -20), tailCurl: 0.4, tailSwing: 1, crestX: -1, crestY: 1 }],
    [100, { by: -2, sh: 2, sw: -1, len: 1, eyes: 'wide', hollow: 1, fluff: 1, handN: Hd(0, -3, -40, 10), handF: Hd(0, -3, 230, 10), crestX: 2, crestY: -2, tailCurl: 0.5, rippleAmp: 1, ripple: 0.1 }],
    [110, { by: 1, sh: -1, sw: 1, eyes: 'blink', handN: Hd(0, 0, 10), handF: Hd(0, 0, -10), crestX: -1, tailCurl: 0.7 }],
    [110, { lookX: -1, eyes: 'open', crestX: 0.6, tailSwing: -0.6 }],
    [120, { lookX: 1, crestX: -0.4, tailSwing: 0.4 }],
    [130, {}],
  ],
};

// special: the feather pillow ---------------------------------------------------------------
const SPECIAL: Table = {
  marks: { charge: 1, release: 5, impact: 5, recover: 8 },
  keys: [
    [70, { eyes: 'wide', lookX: -1, crestY: -1, handN: Hd(0, -1, 15), handF: Hd(0, -1, -10) }],
    [100, { eyes: 'shut', by: 1, sw: -1, sh: -1, handN: Hd(-4, -1, 130, -16), handF: Hd(4, -1, -110, -16), crestX: -1, crestY: 1, tailCurl: 1, tailLift: 2 }],
    [110, { pillow: 0.35, puff: 0.35, fluff: 0.8, eyes: 'shut', by: 1, handN: Hd(-4, -1, 130, -16), handF: Hd(4, -1, -110, -16), tailCurl: 1, tailLift: 3 }],
    [170, { pillow: 1, puff: 0.45, eyes: 'happy', loose: null }],
    [60, { pillow: 1, puff: 0.2, sw: 2, sh: -3, eyes: 'shut', loose: null }],
    [70, { pillow: 1, puff: 0.7, sw: 1, sh: 1, eyes: 'wide', glow: 1, loose: null, bursts: [burst(1, 12, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    [90, { pillow: 0.4, puff: 0.3, fluff: 2, eyes: 'wide', loose: null, bursts: [burst(2, 12, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    [100, { pillow: 0, fluff: 1.5, sw: 2, sh: -2, eyes: 'blink', rippleAmp: 1.4, ripple: 0.3, handN: Hd(0, -2, -40, 16), handF: Hd(0, -2, 40, 16), tailCurl: 0.4, bursts: [burst(3, 12, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    [100, { fluff: 0.8, sw: -1, sh: 1, eyes: 'open', rippleAmp: 1, ripple: 0.6, handN: Hd(0, 0, 10), handF: Hd(0, 0, -10), tailCurl: 0.7, tailSwing: 1, loose: Fe(-9, 1.5, 165, 6.5, -1.3), bursts: [burst(4, 10, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    [110, { fluff: 0.3, sw: 1, sh: -1, eyes: 'happy', crestX: 1, tailSwing: -0.6 }],
    [120, { sh: 0, sw: 0, crestX: -0.4, tailSwing: 0.3 }],
    [130, {}],
  ],
};

// toGuard / fromGuard ------------------------------------------------------------------------
const TO_GUARD: Table = {
  marks: {},
  keys: [
    [60, { eyes: 'wide', hollow: 1, sh: 1, crestY: -2, handN: Hd(0, -2, -30), handF: Hd(0, -2, 30) }],
    [60, { eyes: 'wide', by: 0, sh: 1, sw: -1, fluff: 1, crestX: 1, crestY: -2, handN: Hd(-2, -5, -60, -6), handF: Hd(2, -5, 120, -6), tailCurl: 0.8 }],
    [60, { by: 1, sh: -1, sw: 1, len: -1, fluff: 1, eyes: 'peek', hollow: -1, crestX: -1, crestY: 0, handN: Hd(-3, -6, -70, -10), handF: Hd(4, -6, 180, -10), tailCurl: 0.9, tailLift: 1 }],
    [70, { by: 3, sh: -3, sw: 2, len: -3, fluff: 1.2, eyes: 'peek', hollow: -1, crestX: -2, crestY: 1, handN: Hd(-5, -4, -66, -12, -1), handF: Hd(7, -4, 205, -12, -1), tailCurl: 0.9, tailLift: 1 }],
    [70, { by: 2, sh: -2, sw: 1, len: -2, fluff: 1, eyes: 'peek', hollow: -1, crestX: -2, crestY: 1, handN: Hd(-5, -5, -62, -12, -1), handF: Hd(7, -5, 205, -12, -1), tailCurl: 0.85, tailLift: 1, rippleAmp: 0.4 }],
    [70, {}],
  ],
};
const FROM_GUARD: Table = {
  marks: {},
  keys: [
    [70, { ...GUARD_BASE, eyes: 'open' }],
    [70, { by: -1, sh: 2, sw: -1, len: 1, eyes: 'wide', hollow: 1, fluff: 0.5, crestX: 2, crestY: -2, handN: Hd(0, -3, -40, 8), handF: Hd(0, -3, 220, 8), tailCurl: 0.5, rippleAmp: 1, ripple: 0.2 }],
    [70, { by: 0, sh: 1, eyes: 'open', crestX: 1, handN: Hd(0, -1, -10), handF: Hd(0, -1, 10), tailCurl: 0.55, rippleAmp: 0.7, ripple: 0.5 }],
    [80, { by: 0, sh: -1, sw: 1, crestX: -0.6, handN: Hd(0, 0, 6), handF: Hd(0, 0, -6), tailCurl: 0.65 }],
    [80, {}],
  ],
};

// ------------------------------------------------------------------ assembly

const IDLE0 = (): Pose => idlePose(0);
const GUARD0 = (): Pose => guardPose(0);

/** A keyed table → poses; the last key `{}` is the end pose (idle f0, or guard f0 for toGuard). */
function build(t: Table, end: () => Pose, last: 'home' | 'keyed' = 'home'): { poses: Pose[]; holds: number[] } {
  const base = idlePose(0);
  const poses = t.keys.map(([, p], i) => (i === t.keys.length - 1 && last === 'home' ? end() : pose({ ...base, ...p })));
  return { poses, holds: t.keys.map(([ms]) => ms) };
}

const POSES = new Map<string, Pose[]>();
const SPECS = new Map<string, AnimSpec>();

function register(name: AnyMonsterAnim, poses: Pose[], holds: number[], marks: AnimSpec['marks'], loop: boolean): void {
  POSES.set(name, poses);
  SPECS.set(name, { frames: poses.length, fps: 10, loop, holds, ...(marks && Object.keys(marks).length ? { marks } : {}) });
}

register('idle', Array.from({ length: IDLE_N }, (_, f) => idlePose(f)), IDLE_HOLDS, undefined, true);
register('guard', Array.from({ length: GUARD_N }, (_, f) => guardPose(f)), GUARD_HOLDS, undefined, true);
const BASE: Record<'attack' | 'roar' | 'hit', Table> = { attack: ATTACK, roar: ROAR, hit: HIT };
for (const [name, t] of Object.entries(BASE) as ['attack' | 'roar' | 'hit', Table][]) {
  const b = build(t, IDLE0);
  register(name, b.poses, b.holds, t.marks, false);
}
const EXTRA: Partial<Record<MonsterAnimExtra, Table>> = {
  summon: SUMMON,
  death: DEATH,
  revive: REVIVE,
  special: SPECIAL,
  hitHeavy: HIT_HEAVY,
  hitMagic: HIT_MAGIC,
  toGuard: TO_GUARD,
  fromGuard: FROM_GUARD,
};
for (const [name, t] of Object.entries(EXTRA) as [MonsterAnimExtra, Table][]) {
  const b = build(t, name === 'toGuard' ? GUARD0 : IDLE0, name === 'death' ? 'keyed' : 'home');
  register(name, b.poses, b.holds, t.marks, false);
}

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: SPECS.get('idle')!,
  guard: SPECS.get('guard')!,
  roar: SPECS.get('roar')!,
  attack: SPECS.get('attack')!,
  hit: SPECS.get('hit')!,
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = Object.fromEntries((Object.keys(EXTRA) as MonsterAnimExtra[]).map((k) => [k, SPECS.get(k)!]));
export const IMPACT = ATTACK.marks!.release!;
export const SPECIAL_RELEASE = SPECIAL.marks!.release!;

export function framePose(anim: AnyMonsterAnim, frame: number): Pose {
  const list = POSES.get(anim);
  if (!list) return NEUTRAL;
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(frame)))];
}

/** the face (muzzle / head: the feather darts leave from it), the chest (core), the near hand, the float's floor point */
export function framePoints(anim: AnyMonsterAnim, frame: number): MonsterPoints {
  const pz = framePose(anim, frame);
  const [fx, fy] = hollowCentre(pz);
  const [hx, hy] = handPoint(pz);
  const r = (v: number) => Math.round(v);
  return {
    muzzle: { x: fx + 1, y: fy },
    head: { x: fx, y: fy - 1 },
    core: { x: r(HX + pz.bx), y: r(Math.min(GY - 2, HY + pz.by + 8)) },
    hand: { x: r(hx), y: r(Math.min(GY - 1, hy)) },
    feet: { x: AX, y: GY },
  };
}

const m0 = framePoints('attack', IMPACT);
export const MUZZLE = { x: m0.muzzle!.x, y: m0.muzzle!.y };
export const CORE = { x: HX, y: HY + 8 };
