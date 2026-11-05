// Tüy Hayalet / Down Wisp (wisp_imp, R3) — every anim as keyed poses with per-frame holds, marks and
// points (src/art/monsters-v3/wisp_imp.ts is the MonsterArt; wisp_imp-rig.ts draws a Pose).
//
// Rhythm signature (REHBER §4, the Sv1 floater): a feather-light ghost that never stops drifting.
// Its motion is AIR, not muscle: everything lags (hood one frame behind the float, the plumes and the
// tail two to three frames behind, the loose feather a whole story behind), every stop overshoots and
// settles in soft wobbles, and the long holds sit at the top of a breath, never at an impact.
//   idle     20 f / 1.96 s loop  (FIX r1, owner blocker) a real lazy figure eight drawn into the
//                                pose: the hood leads (x once, y twice per loop, whole px), squashes
//                                and stretches on the turns, the skirt drift / tail / cowlick / hands
//                                lag it by 1–3 frames, the plume tips lift in a travelling wave, the
//                                near hand waves; the loose feather slips out, rocks down and clicks
//                                back in, the eyes follow it; one blink
//   guard     8 f / 1.04 s loop  ducked into its sheet, both hands over the face: a shivering
//                                breath (the hood bobs), the hands tremble, the eyes peek left /
//                                right / up between them, the cowlick twitches, one blink
//   toGuard   6 f / 0.39 s       a startled hop up, then the duck (dx 0: the float never slides)
//   fromGuard 5 f / 0.37 s       it pops up out of the duck, stretches, settles on idle f0
//   roar     11 f / 1.10 s       "bö!": a deep inhale (charge@1), it rears up tall, the hollow gapes,
//                                hands flung up, feathers puff off (release = impact@4), a shiver,
//                                recover@7 → idle f0
//   attack   14 f / 1.42 s       "Tüy Oku Sağanağı": inhale, it puffs to a real 130 % with every plume
//                                fanned out and the tail uncurled (charge@1, long hold f3), rocks
//                                back (f4), SNAPS: hood thrust forward and stretched long, plumes and
//                                tail whipped back (release = impact@5, smear held on contact@6),
//                                recoil squash (f7), then a tall-squat-tall wobble that settles → idle
//   hit       6 f / 0.57 s       contact local (eyes squeezed, cowlick flinches), then it is knocked
//                                away: tilted back 4 px and squashed, plumes / tail flung forward,
//                                four whole feathers pop out and fly off
//   hitHeavy  8 f / 0.74 s       = death f0, tumbles back, the float drops, dizzy, springs up
//   hitMagic  8 f / 0.74 s       eyes white-hot, every feather one value up and on end, sparks, a
//                                rigid 1-px jolt, then a sag
//   summon   15 f / 1.35 s       one big feather rocks down in three tilts to the tile (f0–f4), a
//                                helix of whole feathers whirls up round two eyes (the face locks in
//                                first), the hood forms, then tail / hands / plumes shingle on,
//                                land@10 (a soft squash), "bö!" (f11), settle → idle f0
//   death    10 f / 0.86 s       the heavy struck pose → thrown back → a gust ribbon crosses it and
//                                PEELS it part by part (cowlick, the plumes front to back, the hands,
//                                the tail unhooks), each part leaving as a whole tumbling feather
//                                (dissolve@4); the bare sheet frays (the only pixel dissolve), the
//                                eyes hang alone in the air, then blink out. (No "pof".)
//   revive   12 f / 1.22 s       the wind brought back: the eyes open in the air, the bare sheet
//                                forms, the parts come back in reverse order, land@5, it fills, looks
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
  // the lazy figure eight: X once per loop, Y twice (the hood leads, the skirt / plumes / tail lag)
  const X = (lag = 0) => sin((t - lag) * TAU);
  const Y = (lag = 0) => -sin(2 * (t - lag) * TAU);
  const lp = LOOSE_PATH[k];
  const look = lp ? -1 : 0;
  const lookY = lp && lp.y > 9 ? 1 : 0;
  const eyes = k === 17 ? 'blink' : k === 18 ? 'shut' : 'open';
  return pose({
    hx: Math.round(IA.hx * X()),
    hy: Math.round(IA.hy * Y()),
    sh: Math.round(-IA.sq * Y(0.05)),
    sw: Math.round(IA.sq * Y(0.05)),
    len: Math.round(0.6 * -Y(0.1) + 0.5),
    drift: -IA.drift * X(0.1),
    ripple: (2 * t) % 1,
    rippleAmp: IA.rip,
    tailSwing: -IA.tail * X(0.15),
    tailCurl: 0.6 + 0.3 * Y(0.15),
    crestX: -IA.crest * X(0.08),
    crestY: 1.4 * Y(0.08),
    handN: Hd(0, Math.round(Y(0.05)), IA.hand * sin(2 * t * TAU), 6 * Math.max(0, sin(2 * t * TAU))),
    handF: Hd(0, Math.round(Y(0.12)), IA.hand * 0.7 * sin(2 * (t - 0.1) * TAU)),
    eyes,
    lookX: look,
    lookY,
    loose: lp ?? REST_FEATHER,
  });
}
/** idle amplitudes (px / deg): hood figure eight, squash, skirt drift, plume wave, tail, cowlick, hands */
const IA = { hx: 1.2, hy: 1.2, sq: 0.6, drift: 0.8, rip: 1.0, tail: 3, crest: 2.5, hand: 35 };

/** the idle loop's last frame: every settle tail passes through it, so the hand-off into idle f0 is the
 * loop's own step (≈ 30 % Δ) and no two closing frames are near-duplicates (owner blocker) */
const PRE_IDLE = (d: Partial<Pose> = {}): Partial<Pose> => ({ ...idlePose(IDLE_N - 1), ...d });

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
  handN: Hd(-5, -2, -62, -12, -1),
  handF: Hd(7, -2, 205, -12, -1),
  ripple: 0,
  rippleAmp: 0.4,
};

export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const t = k / GUARD_N;
  // a frightened little body: a quick shivering breath (the hood bobs and squashes every other
  // frame), the plumes bristle and rattle in a fast wave, both hands tremble over the face while
  // the eyes peek left, right, up between them; one blink
  const odd = k % 2 === 1;
  const breath = [0, 0, -1, -1, 0, 0, 0, 0][k];
  const peek: [number, number][] = [[0, 0], [1, 0], [1, -1], [0, 0], [-1, 0], [-1, 0], [0, -1], [1, 0]];
  return pose({
    ...GUARD_BASE,
    hy: breath,
    sh: -2 + (breath ? 1 : 0),
    sw: 1 - (breath ? 1 : 0),
    ripple: t,
    rippleAmp: 0.8,
    fluff: 1.15,
    handN: Hd(-5 + (odd ? 1 : -1), -2 + (k === 3 || k === 4 ? 1 : 0), -62 + (odd ? 14 : -10), -12 + (odd ? 8 : 0), -1),
    handF: Hd(7 + (odd ? -1 : 1), -2 + (k === 1 || k === 6 ? -1 : 0), 205 + (odd ? -14 : 10), -12 + (odd ? 0 : 8), -1),
    eyes: k === 5 ? 'blink' : 'peek',
    lookX: peek[k][0],
    lookY: peek[k][1],
    tailSwing: 2.4 * sin((t - 0.25) * TAU),
    tailCurl: 0.85 + (odd ? 0.15 : -0.1),
    crestX: -2 + [0, 1, 2, 1, 0, -1, 0, 1][k],
    crestY: 1 + (odd ? -1 : 0),
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
    // a sharp little inhale: it shrinks and squints at the target
    [70, { eyes: 'squint', lookX: 1, by: 1, sh: -1, sw: 1, len: -1, handN: Hd(-1, 1, 40), handF: Hd(1, 1, -30), crestX: -1, crestY: 1, tailCurl: 0.8 }],
    // charge: it swells, the plumes start to fan out round it
    [90, { puff: 0.4, fluff: 0.9, eyes: 'squint', lookX: 1, by: 0, handN: Hd(-2, -1, 60, 10), handF: Hd(2, -1, -45, 10), crestX: -2, crestY: -1, tailCurl: 0.6, tailLift: 1, rippleAmp: 0.8, ripple: 0.2 }],
    [110, { puff: 0.75, fluff: 1.7, eyes: 'squint', lookX: 1, by: -1, hollow: 1, handN: Hd(-2, -3, 80, 20, 1), handF: Hd(2, -3, -65, 20, 1), crestX: -3, crestY: -2, tailCurl: 0.3, tailLift: 2, tailSwing: -2, rippleAmp: 1.2, ripple: 0.45 }],
    // the full 130 % puff, every plume fanned out radially, the tail uncurled behind, hands spread
    [170, { puff: 1, fluff: 2.4, eyes: 'squint', lookX: 1, by: -1, hollow: 1, handN: Hd(-1, -4, 95, 30, 1), handF: Hd(1, -4, -85, 30, 1), crestX: -3, crestY: -1, tailCurl: 0, tailLift: 3, tailSwing: -4, rippleAmp: 1.5, ripple: 0.7 }],
    // rock back (the wind-up): hood leans away, the skirt swings forward under it
    [50, { puff: 1, fluff: 2.4, eyes: 'squint', lookX: 1, by: -1, bx: -2, hx: -2, hollow: 1, drift: 3, handN: Hd(-2, -4, 110, 30, 1), handF: Hd(-2, -4, -95, 30, 1), crestX: -4, crestY: -1, tailCurl: 0, tailLift: 3, tailSwing: -1, rippleAmp: 1.5, ripple: 0.9 }],
    // RELEASE — the snap: the hood thrust forward and stretched long, plumes and tail whipped back
    [60, { puff: 0.25, fluff: 1.6, eyes: 'wide', lookX: 1, bx: 2, hx: 3, by: 0, sw: 3, sh: -2, hollow: 3, drift: -6, handN: Hd(4, -2, -15, 14, 1), handF: Hd(3, -2, 150, 14), crestX: -5, crestY: 2, tailSwing: -4, tailCurl: 0, tailLift: 1, rippleAmp: 1.2, ripple: 0.1 }],
    // contact: the smear holds a frame, the second volley leaves
    [70, { puff: 0.05, fluff: 1.2, eyes: 'wide', lookX: 1, bx: 2, hx: 2, by: 0, sw: 2, sh: -1, hollow: 2, drift: -5, handN: Hd(3, -1, -5, 8), handF: Hd(3, -1, 130, 8), crestX: -4, crestY: 2, tailSwing: -5, tailCurl: 0.1 }],
    // recoil squash: knocked back by its own volley, flattened — a pleased blink, not a pained
    // face (FIX r2: the darts are still in flight here; it must not read as already hurt)
    [90, { fluff: 0.8, eyes: 'blink', bx: -1, hx: -1, by: 2, sw: 2, sh: -3, len: -2, drift: 3, hollow: 0, handN: Hd(-1, 1, 60, 6), handF: Hd(-1, 1, -50, 6), crestX: 3, crestY: 2, tailSwing: 3, tailCurl: 0.5, rippleAmp: 1, ripple: 0.4 }],
    // recover: the 3-beat wobble that settles (tall → squat → tall)
    [100, { fluff: 0.4, eyes: 'open', lookX: 1, bx: 0, hx: 1, by: -2, sw: -1, sh: 2, len: 1, drift: -2, handN: Hd(0, -2, -30, 6), handF: Hd(0, -2, 40, 6), crestX: -2, crestY: -2, tailSwing: -2, tailCurl: 0.8, rippleAmp: 0.9, ripple: 0.7 }],
    [100, { eyes: 'blink', hx: -1, by: 1, sw: 1, sh: -2, len: -1, drift: 1.5, handN: Hd(0, 1, 30), handF: Hd(0, 1, -25), crestX: 2, crestY: 1, tailSwing: 2, tailCurl: 0.45, rippleAmp: 0.8, ripple: 0.95 }],
    [110, { eyes: 'open', hx: 1, by: -1, sw: -1, sh: 1, drift: -1, handN: Hd(0, -1, -15), handF: Hd(0, -1, 15), crestX: -1, crestY: -1, tailSwing: -1, tailCurl: 0.7, rippleAmp: 0.6, ripple: 0.2 }],
    [120, { eyes: 'happy', by: 1, sw: 1, sh: -1, drift: 0.6, handN: Hd(0, 0, 12), handF: Hd(0, 0, -10), crestX: 1, tailSwing: 1, tailCurl: 0.55, rippleAmp: 0.5, ripple: 0.45 }],
    [130, { eyes: 'open', drift: -0.3, crestX: -0.4, tailSwing: -0.5, handN: Hd(0, 0, -5) }],
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
    // a proud little after-shiver: it puffs its chest, the near hand pats it, the cowlick springs
    [110, { by: -1, sh: 1, sw: -1, eyes: 'happy', fluff: 0.6, handN: Hd(-1, 1, 70, 8), handF: Hd(0, -1, -30), crestX: 3, crestY: -2, tailSwing: -2, tailCurl: 0.45, rippleAmp: 1, ripple: 0.3 }],
    [120, PRE_IDLE({ eyes: 'open' })],
    [130, {}],
  ],
};

// hit family ------------------------------------------------------------------------
const HIT: Table = {
  marks: { impact: 0, contact: 0, recover: 3 },
  keys: [
    [50, { eyes: 'squeeze', hollow: -1, crestX: -2, crestY: 1, handN: Hd(0, -1, -15) }],
    // knocked away: the body tilts back 4 px and squashes, the plumes and tail are flung forward,
    // four whole feathers pop out of it
    [60, { hx: -4, bx: -3, by: -1, drift: 5, sw: 2, sh: -2, len: -1, eyes: 'squeeze', hollow: -1, fluff: 2, crestX: -4, crestY: 3, handN: Hd(-2, -3, -60, 16), handF: Hd(-2, -3, 60, 16), tailSwing: 5, tailCurl: 0.1, rippleAmp: 1.4, ripple: 0.2, loose: Fe(-13, -2, 205, 6, 1), free: [Fe(-14, -9, 230, 5.5, 1), Fe(9, 6, 20, 5.5, -1), Fe(-3, -11, 280, 5, 1)], bursts: [burst(0, 4, 9, 4, Math.PI * 0.85, 0.9, 1.2, 61, 0.2)] }],
    [130, { hx: -2, bx: -2, drift: 2, sw: -1, sh: 1, eyes: 'blink', fluff: 1, crestX: 2, crestY: 0, handN: Hd(0, 0, 25), handF: Hd(0, 0, -20), tailSwing: -2, tailCurl: 0.4, rippleAmp: 1, ripple: 0.5, loose: Fe(-15, 3, 170, 6, -1), free: [Fe(-16, -9, 200, 5.5, -1), Fe(12, 8, 60, 5.5, 1), Fe(-5, -12, 250, 5, -1)], bursts: [burst(1, 4, 9, 4, Math.PI * 0.85, 0.9, 1.2, 61, 0.2)] }],
    [100, { hx: 0, bx: -1, drift: -1, sw: 1, sh: -1, eyes: 'open', crestX: -1, handN: Hd(0, 0, -10), handF: Hd(0, 0, 10), tailSwing: 1.5, tailCurl: 0.65, rippleAmp: 0.6, ripple: 0.8, loose: Fe(-12, 2, 160, 6.5, -1.2), free: [Fe(-18, -6, 175, 5.5, 1), Fe(13, 13, 100, 5.5, -1)], bursts: [burst(3, 4, 9, 4, Math.PI * 0.85, 0.9, 1.2, 61, 0.2)] }],
    [110, PRE_IDLE({ lookX: -1, free: [Fe(-18, 1, 150, 5.5, -1)] })],
    [120, {}],
  ],
};

// (FIX critic r3) hitHeavy is a real TUMBLE, not a bigger flinch: thrown back with the hood rolled
// away and the skirt flung up over it, an edge-on "spin" frame (narrow and tall, the tail whipped the
// other way), a ring of six-plus feathers shed round it, the float DROPPED 3–4 px with a squashed
// floor bounce, a dizzy bob, then the shake-off. (hit stays the short flinch.)
const HIT_HEAVY: Table = {
  marks: { impact: 0, contact: 0, recover: 3 },
  keys: [
    [50, { ...STRUCK_HEAVY }],
    // thrown: the hood rolls back, the skirt swings up and forward under it, the tail flung
    [70, { ...STRUCK_HEAVY, bx: -5, hx: -3, by: -1, drift: 8, len: -2, sw: 3, sh: -3, fluff: 2.4, eyes: 'x', hollow: -1, handN: Hd(-1, -5, -95, 26, 1), handF: Hd(-1, -5, 95, 26, 1), crestX: -5, crestY: 3, tailSwing: 6, tailCurl: 0, tailLift: 3, rippleAmp: 1.5, ripple: 0.2, loose: null, free: [Fe(-14, -10, 235, 6.5, 1), Fe(11, 4, 10, 6, -1), Fe(-4, -9, 275, 5.5, 1), Fe(-15, 3, 195, 6, -1), Fe(7, -9, 320, 5.5, 1), Fe(-8, 14, 140, 5.5, -1)], bursts: [burst(0, 8, 2, 2, Math.PI, TAU, 1.0, 71, 0.18)] }],
    // the spin: edge-on — narrow and tall, the skirt whipped back the other way, eyes squeezed
    [120, { bx: -4, hx: 1, by: 0, drift: -6, sw: -5, sh: 2, len: 2, fluff: 2, eyes: 'squeeze', hollow: -1, handN: Hd(2, -2, 120, 10), handF: Hd(2, -2, -120, 10), crestX: 4, crestY: 1, tailSwing: -4, tailCurl: 1, tailLift: 1, rippleAmp: 1.4, ripple: 0.55, loose: null, free: [Fe(-15, -12, 250, 6.5, -1), Fe(15, 2, 355, 6, 1), Fe(-6, -9, 260, 5.5, -1), Fe(-17, 6, 175, 6, 1), Fe(11, -11, 305, 5.5, -1), Fe(-9, 19, 120, 5.5, 1)], bursts: [burst(1, 8, 2, 2, Math.PI, TAU, 1.0, 71, 0.18)] }],
    // the drop: the float fails, it falls 4 px and squashes flat on the bounce
    [90, { bx: -3, hx: -1, by: 4, drift: 2, sw: 3, sh: -3, len: -3, fluff: 1.6, eyes: 'dizzy', hollow: -1, handN: Hd(-1, 3, 70, 10), handF: Hd(-1, 3, -60, 10), crestX: -2, crestY: 3, tailSwing: 2, tailCurl: 0.6, rippleAmp: 1.2, ripple: 0.8, loose: null, free: [Fe(-16, -6, 200, 6.5, 1), Fe(16, 9, 60, 6, -1), Fe(-5, -12, 240, 6, 1), Fe(-17, 13, 150, 6, -1), Fe(13, -6, 330, 5.5, 1)], bursts: [burst(3, 6, 2, 2, Math.PI, TAU, 1.0, 71, 0.18)] }],
    // the bounce back up, dizzy, still low
    [110, { bx: -2, by: 1, drift: -1, sw: -1, sh: 2, len: 1, fluff: 1, eyes: 'dizzy', handN: Hd(0, 1, 30), handF: Hd(0, 1, -20), crestX: 2, crestY: -1, tailSwing: -1, tailCurl: 0.5, rippleAmp: 1, ripple: 0.1, free: [Fe(-16, 4, 175, 6, -1), Fe(16, 15, 110, 5.5, 1), Fe(-17, 17, 140, 5.5, -1)] }],
    // it shakes the dizziness off: a head-shake left (hood, cowlick, tail all swung) …
    [120, { hx: -1, bx: -1, by: 0, sw: 1, sh: -1, eyes: 'squeeze', lookX: -1, crestX: 3, crestY: 1, handN: Hd(0, 0, 40, 6), handF: Hd(0, 0, -35), tailSwing: 3, tailCurl: 0.5, drift: 1.5, rippleAmp: 1, ripple: 0.4 }],
    // … and right, eyes open again
    [130, PRE_IDLE({ hx: 1, eyes: 'open', lookX: 1, crestX: -3, tailSwing: -2 })],
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
    // one last residual jolt: it stiffens, feathers on end for a beat, a single spark …
    [120, { by: -1, sh: 1, sw: -1, eyes: 'wide', fluff: 1.2, spark: 1, seed: 5, crestX: 1, crestY: -3, handN: Hd(0, -2, -30, 12), handF: Hd(0, -2, 30, 12), tailCurl: 0.85, tailSwing: -1, rippleAmp: 1.2, ripple: 0.7 }],
    // … and it shudders it off
    [130, PRE_IDLE({ eyes: 'blink' })],
    [140, {}],
  ],
};

// summon: one feather rocks down, the whirl of feathers builds the ghost, "bö!" -----------------
const GONE: Partial<Pose> = { erode: 1, erodeDir: 1, seed: 4, loose: null };
/**
 * The whirl: n whole quilled feathers on a helix round the body (skirt-relative), rising and
 * tightening frame by frame; the far half goes behind the body. `t` is the frame phase.
 */
function whirl(n: number, t: number, r: number, yTop: number, yBot: number): Feather[] {
  const out: Feather[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const a = (u + t * 0.23) * TAU * 1.6;
    const y = yBot + (yTop - yBot) * u + Math.sin(a) * r * 0.32;
    const rr = r * (1.05 - 0.3 * u);
    const x = 1 + Math.cos(a) * rr;
    const tx = -Math.sin(a) * rr;
    const ty = Math.cos(a) * rr * 0.32 - 4;
    const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
    out.push({ x: Math.round(x), y: Math.round(y), ang: Math.round(ang / 15) * 15, len: 6.5 + (i % 3 === 0 ? 1 : 0), bow: i % 2 ? 1.2 : -1.2, back: Math.sin(a) < 0.45 || Math.abs(Math.cos(a)) < 0.55 });
  }
  return out;
}
// (FIX critic r3) a bigger hero feather for the opening beat (14 px, a broad lit vane): it reads at 1×
const BIG_FALL = (x: number, y: number, ang: number, bow: number): Feather => ({ x, y, ang, len: 14, bow, w: 5.8 });
const SUMMON: Table = {
  marks: { land: 10 },
  keys: [
    [100, { ...GONE, free: [BIG_FALL(2, -14, 160, -2)] }],
    [100, { ...GONE, free: [BIG_FALL(-6, -6, 210, 2)] }],
    [100, { ...GONE, free: [BIG_FALL(5, 6, 150, -1.6)] }],
    [90, { ...GONE, free: [BIG_FALL(-2, 19, 205, 1.6)] }],
    // touch: it settles flat on the tile's centre (the floor point), the first feathers lift off round it
    [80, { ...GONE, free: [BIG_FALL(4, 32, 180, -0.6), ...whirl(4, 0, 9, 18, 27)] }],
    // the whirl climbs; the face locks in first: two eyes in the middle of the feathers
    [60, { ...GONE, eyesOnly: true, eyes: 'wide', by: 2, free: whirl(9, 1, 15, -8, 26) }],
    // (FIX r2) a bud of a hood closes round the eyes first (small, no sheet yet), so the body never
    // pops in whole in one frame
    [50, { by: 6, sh: -6, sw: -4, len: -12, peel: 8, eyes: 'wide', crestY: 3, loose: null, tailCurl: 0, free: whirl(9, 1.5, 15, -9, 24) }],
    // the hood and the bare sheet form round the eyes
    [60, { by: 2, sh: -1, peel: 8, eyes: 'blink', crestY: 2, free: whirl(8, 2, 15, -10, 22) }],
    // the tail hooks on, the hands, the wing plume shingles on
    [70, { by: 1, peel: 5, eyes: 'open', loose: null, free: whirl(6, 3, 14, -12, 14) }],
    // the plumes lay themselves on one by one; the last feathers close in over the crown
    [80, { by: -1, sh: 1, peel: 2, eyes: 'open', loose: REST_FEATHER, free: whirl(4, 4, 12, -14, 0) }],
    [90, { by: 2, sh: -2, sw: 2, len: -2, eyes: 'shut', fluff: 1, handN: Hd(-1, 1, 45, 10), handF: Hd(1, 1, -35, 10), tailCurl: 0.9, crestY: 2 }],
    [140, { by: -1, sh: 2, sw: -1, len: 2, eyes: 'wide', hollow: 3, fluff: 1.5, glow: 1, handN: Hd(1, -6, -100, 24, 1), handF: Hd(-1, -6, 260, 24, 1), crestX: 3, crestY: -3, tailCurl: 0.25, rippleAmp: 1.2, ripple: 0.2 }],
    [110, { by: 1, sh: -1, sw: 1, eyes: 'happy', hollow: 0, fluff: 0.5, handN: Hd(0, -1, -15), handF: Hd(0, -1, 25), crestX: -1, crestY: 1, tailCurl: 0.7, rippleAmp: 0.8, ripple: 0.6 }],
    [120, { by: 0, sh: 1, eyes: 'open', crestX: 0.6, tailSwing: -0.6 }],
    [130, {}],
  ],
};

// death: the wind takes it (no event: no pillow, no pof) ----------------------------------------
const WIND = Math.PI; // backward, away from the attacker
const SLUMP: Partial<Pose> = { bx: -3, by: 3, drift: 2, sw: 2, sh: -3, len: -2, eyes: 'dizzy', hollow: -1, handN: Hd(0, 3, 60), handF: Hd(0, 3, -50), tailCurl: 0.2, tailSwing: 3, crestX: -3, crestY: 2, loose: null };
/**
 * The wind peels it apart front to back, part by part — every peeled part leaves as a whole quilled
 * feather that tumbles downwind on a pendulum path (they leave the frame to the cinematic's stream):
 * [frame it peels, start (skirt-relative), its length, its angle].
 */
const PEELS: readonly [f: number, x: number, y: number, len: number, ang: number][] = [
  [2, 2, -14, 6.5, 300], // the cowlick
  [3, -4, 16, 8, 120], // front plume
  [3, 2, 12, 7.5, 95], // middle-front plume
  [4, -8, 11, 8, 135], // middle-back plume
  [4, 7, 9, 7, 60], // breast plume
  [5, -10, 5, 8, 160], // the back plume (the wing)
  [6, -12, 20, 9, 200], // the tail unhooks
];
function peeled(f: number): Feather[] {
  const out: Feather[] = [];
  PEELS.forEach(([pf, x0, y0, len, ang], i) => {
    const a = f - pf;
    if (a < 0 || a > 1) return;
    // the frame it peels it is lifted clear of the body behind it; one frame later it is caught
    // higher up and further back, tumbling (then it leaves the frame: the cinematic's stream)
    const x = (i === 0 ? x0 - 6 - a * 4 : -16 - (i % 2) - a * 3.5);
    const y = (i === 0 ? y0 - a * 2 : y0 - 4 - a * 5);
    if (x < -20.5) return;
    out.push(Fe(x, y, (i === 0 ? ang - 90 : a ? 245 : 120) + (i % 3) * 12 + a * 30 - ang * 0, len + 1, a % 2 ? 1.4 : -1.4));
  });
  return out;
}
const DEATH: Table = {
  marks: { impact: 0, contact: 0, dissolve: 4 },
  keys: [
    [50, { ...STRUCK_HEAVY }],
    [60, { ...STRUCK_HEAVY, bx: -3, by: -1, drift: 4, sw: 2, sh: -2, fluff: 2, handN: Hd(-2, -3, -60, 20), handF: Hd(-2, -3, 60, 20), tailSwing: 4, tailCurl: 0.2, rippleAmp: 1.5, ripple: 0.2, loose: Fe(-12, -1, 200, 6, 1), bursts: [burst(0, 6, 8, 3, Math.PI * 0.9, 1.4, 1.4, 71, 0.18)] }],
    // the gust arrives from the front: it takes the cowlick first
    [80, { ...SLUMP, fluff: 2, rippleAmp: 1.5, ripple: 0.4, gust: 1, peel: 1, free: peeled(2) }],
    // the front plumes go, the body leans into the wind
    [90, { ...SLUMP, fluff: 2.4, drift: -2, rippleAmp: 1.5, ripple: 0.7, gust: 2, peel: 3, free: peeled(3) }],
    [90, { ...SLUMP, fluff: 2.4, drift: -3, rippleAmp: 1.5, ripple: 0.95, gust: 3, peel: 4, free: peeled(4) }],
    // the wing plume and the hands — only the bare sheet and the tail are left
    // (FIX r2) the wing plume and the hands go, but the hem shingle still clings on: it keeps a
    // feather hem (never a bald tadpole)
    [90, { ...SLUMP, fluff: 2, drift: -3, rippleAmp: 1.2, ripple: 0.2, gust: 4, peel: 4.5, eyes: 'wide', handN: Hd(-30, 0, 0), handF: Hd(-30, 0, 0), free: peeled(5) }],
    // the last shingle and the tail go as whole feathers; what is left is a small shrunken hood
    // round the eyes (no pixel dissolve, no holes)
    [90, { ...SLUMP, drift: -4, peel: 8, eyes: 'wide', sw: -3, sh: -3, len: -9, hx: 1, free: [...peeled(6), Fe(-12, 10, 205, 8, 1.4), Fe(-6, 15, 160, 7.5, -1.4), Fe(-15, 3, 230, 7, 1.2)] }],
    // the eyes hang alone in the air…
    [90, { ...SLUMP, eyesOnly: true, eyes: 'wide', free: peeled(7) }],
    [100, { ...SLUMP, eyesOnly: true, eyes: 'wide', lookX: -1, free: peeled(8) }],
    // …and blink out
    [120, { ...SLUMP, eyesOnly: true, eyes: 'shut', free: peeled(9) }],
  ],
};

// revive: the wind brings it back --------------------------------------------------------
const REVIVE: Table = {
  marks: { land: 5 },
  keys: [
    // the wind brings the feathers back from behind: first the eyes open in the air, then the bare
    // sheet, then part by part in the reverse order the wind took them
    [100, { ...SLUMP, eyesOnly: true, eyes: 'shut', free: [Fe(-19, -6, 330, 7.5, 1.4), Fe(-18, 10, 20, 7.5, -1.4)] }],
    [100, { ...SLUMP, eyesOnly: true, eyes: 'blink', free: [Fe(-14, -2, 350, 7.5, -1.4), Fe(-15, 14, 10, 7.5, 1.4), Fe(-20, 4, 0, 7.5, 1.4)] }],
    [90, { ...SLUMP, peel: 8, eyes: 'blink', free: [Fe(-18, 18, 15, 7.5, 1.4), Fe(-17, 0, 345, 7.5, -1.4)] }],
    [90, { ...SLUMP, peel: 6, eyes: 'open', free: [Fe(-17, 6, 5, 7.5, 1.4), Fe(-16, -10, 40, 7, -1.4)] }],
    [90, { ...SLUMP, peel: 3, eyes: 'open', fluff: 1, rippleAmp: 1, ripple: 0.3, free: [Fe(-15, 8, 10, 7.5, -1.4)] }],
    [110, { ...SLUMP, eyes: 'open', fluff: 0.5, loose: REST_FEATHER, rippleAmp: 0.8, ripple: 0.6 }],
    [90, { bx: -1, by: 1, drift: 1, sw: 1, sh: -1, eyes: 'open', handN: Hd(0, 1, 30), handF: Hd(0, 1, -20), tailCurl: 0.4, tailSwing: 1, crestX: -1, crestY: 1 }],
    [100, { by: -2, sh: 2, sw: -1, len: 1, eyes: 'wide', hollow: 1, fluff: 1, handN: Hd(0, -3, -40, 10), handF: Hd(0, -3, 230, 10), crestX: 2, crestY: -2, tailCurl: 0.5, rippleAmp: 1, ripple: 0.1 }],
    [110, { by: 1, sh: -1, sw: 1, eyes: 'blink', handN: Hd(0, 0, 10), handF: Hd(0, 0, -10), crestX: -1, tailCurl: 0.7 }],
    // where am I? it turns back over its shoulder (hood, cowlick, near hand pointing) …
    [110, { hx: -1, lookX: -1, lookY: -1, eyes: 'open', crestX: 3, crestY: -1, tailSwing: 2, tailCurl: 0.5, drift: 1.5, handN: Hd(-1, -2, -55, 10), handF: Hd(0, 0, -20), rippleAmp: 0.9, ripple: 0.4 }],
    // … then forward again
    [120, PRE_IDLE({ hx: 1, lookX: 1, crestX: -3, tailSwing: -2 })],
    [130, {}],
  ],
};

// special: the feather pillow ---------------------------------------------------------------
const SPECIAL: Table = {
  marks: { charge: 1, release: 8, impact: 8, recover: 11 },
  keys: [
    [70, { eyes: 'wide', lookX: -1, crestY: -1, handN: Hd(0, -1, 15), handF: Hd(0, -1, -10) }],
    // f1 THE HUG: it clutches itself (the clutch observer holds the lethal-blow body from here)
    // (FIX critic r2: a real HUG, never a wave — the near hand lies flat ACROSS the belly pointing
    // back, the far hand's fingertips wrap round the back edge pointing forward, both low; no
    // feather is flung up; f2–f4 shrink 1 px a frame with the eyes squeezed "> <" and shiver ±1 px)
    [100, { eyes: 'shut', by: 1, sw: -1, sh: -1, len: -1, handN: Hd(-6, 1, 152, -22, 1), handF: Hd(5, 1, 150, -22), crestX: -1, crestY: 1, tailCurl: 1, tailLift: 2, drift: 0.5, loose: null }],
    // f2–f4 the build-up, a living hold: it squeezes smaller, then shivers left / right ever tighter
    [90, { eyes: 'squeeze', by: 2, sw: -2, sh: -2, len: -2, fluff: 1, rippleAmp: 1.2, ripple: 0.15, handN: Hd(-7, 1, 156, -26, 1), handF: Hd(6, 1, 152, -24), crestX: -2, crestY: 2, tailCurl: 1.15, tailLift: 3, drift: 1, loose: null }],
    [90, { eyes: 'squeeze', bx: -1, by: 2, sw: -3, sh: -3, len: -3, fluff: 1.6, rippleAmp: 1.5, ripple: 0.45, handN: Hd(-7, 2, 158, -28, 1), handF: Hd(6, 2, 154, -26), crestX: -3, crestY: 2, tailCurl: 1.2, tailLift: 3, tailSwing: 1, loose: null }],
    [90, { eyes: 'squeeze', bx: 1, by: 3, sw: -3, sh: -4, len: -3, fluff: 2.2, rippleAmp: 1.5, ripple: 0.75, handN: Hd(-8, 2, 160, -28, 1), handF: Hd(7, 2, 156, -26), crestX: -2, crestY: 3, tailCurl: 1.25, tailLift: 4, tailSwing: -1, loose: null }],
    [110, { pillow: 0.35, puff: 0.35, fluff: 0.8, eyes: 'shut', by: 1, handN: Hd(-4, -1, 130, -16), handF: Hd(4, -1, -110, -16), tailCurl: 1, tailLift: 3 }],
    [170, { pillow: 1, puff: 0.45, eyes: 'happy', loose: null }],
    [60, { pillow: 1, puff: 0.2, sw: 2, sh: -3, eyes: 'shut', loose: null }],
    [70, { pillow: 1, puff: 0.7, sw: 1, sh: 1, eyes: 'wide', glow: 1, loose: null, bursts: [burst(1, 12, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    [90, { pillow: 0.4, puff: 0.3, fluff: 2, eyes: 'wide', loose: null, bursts: [burst(2, 12, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    [100, { pillow: 0, fluff: 1.5, sw: 2, sh: -2, eyes: 'blink', rippleAmp: 1.4, ripple: 0.3, handN: Hd(0, -2, -40, 16), handF: Hd(0, -2, 40, 16), tailCurl: 0.4, bursts: [burst(3, 12, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    [100, { fluff: 0.8, sw: -1, sh: 1, eyes: 'open', rippleAmp: 1, ripple: 0.6, handN: Hd(0, 0, 10), handF: Hd(0, 0, -10), tailCurl: 0.7, tailSwing: 1, loose: Fe(-9, 1.5, 165, 6.5, -1.3), bursts: [burst(4, 10, 0, 7, 0, TAU, 4.5, 101, 0.1)] }],
    // the hug's afterglow: it pats its own cheek with the near hand, cowlick bouncing
    [110, { fluff: 0.5, by: -1, sw: -1, sh: 1, eyes: 'happy', crestX: 3, crestY: -2, handN: Hd(1, -3, -70, 10), handF: Hd(0, 0, -20), tailSwing: -2, tailCurl: 0.5, rippleAmp: 1, ripple: 0.85 }],
    [120, PRE_IDLE({ eyes: 'happy' })],
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
    [70, { by: 3, sh: -3, sw: 2, len: -3, fluff: 1.2, eyes: 'peek', hollow: -1, crestX: -2, crestY: 1, handN: Hd(-5, -1, -66, -12, -1), handF: Hd(7, -1, 205, -12, -1), tailCurl: 0.9, tailLift: 1 }],
    [70, { by: 2, sh: -2, sw: 1, len: -2, fluff: 1, eyes: 'peek', hollow: -1, crestX: -2, crestY: 1, handN: Hd(-5, -2, -62, -12, -1), handF: Hd(7, -2, 205, -12, -1), tailCurl: 0.85, tailLift: 1, rippleAmp: 0.4 }],
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
