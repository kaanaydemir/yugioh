// Magma Titanı v3 (A4.1) — the ANIM TABLES: hand-keyed beats and holds over biped v1 poses. The plan
// gives words and geometry (the pose fields, bipedRig for the reach() keys below); the choreography is
// this file's (A3_MIMARI §4.2: no default motion anywhere in the plan). Every rigid part moves by its
// own whole pixels (REHBER IŞ-12); the light (fx.core, the seams' wave, the eyes, the vents, the fists'
// heat) is keyed beat by beat — the CORE leads every beat: it brightens on the anticipation, peaks on
// the release, gutters on a hit.
//
// The titan's rhythm is "kor dolar" (the embers fill): heat gathers slowly into the core, then bursts
// out through the limbs. Base (part 1):
//   idle    12 f, 1.90 s — the magma breath: the core swells and dims once a loop (the fire4 heart grows
//           outward, the rim cools first), the chest plate lifts first, the abdomen and the hump a frame
//           later, the near boulder two (by two pixels), the far boulder three, while the head SINKS a
//           pixel between them (the brute's hunch) and nods forward on the exhale; the fists swing late
//           on their own phases and flex; a ±1-step pulse runs out along the seams; two embers per vent
//           rise and cool, the far fist's drip forms, falls and cools in the air; the feet never move.
//   guard    8 f, 1.32 s — the X-block: crouched two pixels, both forearms crossed at the wrists in front
//           of the core (the near over the far), the fists knuckles-up at the chin, the head raised
//           behind them; the core banked dark, the forearm seams bright; a slow banked breath (the fists
//           ride a frame late, the head lifts to peer over them once a loop).
//   attack  13 f, 1.40 s — "Lav Yumruğu" with the FAR (dripping) lava fist: gather (the core fills),
//           the far foot lifts and STOMPS a step on (mark stomp: dust, the flare runs up the leg, the
//           boulders slam down a beat late), the DRIVE (mark drive: crouched and leaning in, the near
//           fist forward as a guard, the lava fist cocked back at the far ribs, the core hot — the
//           recipe holds it while the unit travels), a 50 ms whip, the PUNCH (release = impact =
//           contact, 60 ms, smeared): the far arm out level at chest height, the fist white-hot, the
//           core white in its flare ring, the near arm torn back; the follow-through bursts magma off
//           the knuckles; a heavy recovery 110 → 150 ms.
//   roar    12 f, 1.36 s — "the vents erupt": an inhale that dims the core, a gather inward (fists to
//           the belly), then the chest is thrown open (arms flung out wide, the head back, the jaw
//           down on a molten throat): the core flares white, both vents erupt in flickering flames with
//           sparks; the light runs back down as it settles.
//   hit      6 f, 0.68 s — struck chest + head first (the chest plate shoved back, the head snapped
//           back, the eyes squeezed, the core gutters while the seams flare, chips burst off the
//           front), the boulders jolt late, the fists swing like pendulums, a long sway back, then the
//           heavy mass rocks forward past rest before it settles (recover at 300 ms).

import { bipedNeutral, bipedRig, type BipedDelta } from '../bodyplans/biped/v1';
import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import type { V } from '../rigkit/geom';
import { BUILD, FX, REST, type TitanFx } from './magma_titan-build';
import type { Pose } from './magma_titan-parts';

type D = BipedDelta & { fx?: Partial<TitanFx> };

/** A delta over a pose: nested objects merged, tuples and values replaced (PoseDelta semantics). */
function over<T>(a: T, d: unknown): T {
  if (d === undefined) return a;
  if (Array.isArray(d) || typeof d !== 'object' || d === null) return d as T;
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) o[k] = over((a as Record<string, unknown>)?.[k], v);
  return o as T;
}

interface HandTo {
  /** the hand (the fist's centre) at this frame px */
  to: V;
  bend?: 1 | -1;
  /** the fist's own screen angle (rad), blended in fully */
  aim?: number;
}

/**
 * A key whose hands go to screen targets (frame px) from wherever its pose puts the shoulders (the
 * plan clamps an out-of-reach hand along the line).
 */
function reach(d: D, n?: HandTo, f?: HandTo): (base: Pose) => Pose {
  return (base) => {
    let p = over(base, d) as Pose;
    const rig = bipedRig(BUILD, p);
    const arm = (h: HandTo, sh: V, rest: V) => ({
      hand: [h.to[0] - sh[0] - rest[0], h.to[1] - sh[1] - rest[1]] as V,
      bend: h.bend ?? 1,
      grip: 'fist' as const,
      aim: h.aim === undefined ? { a: 0, w: 0 } : { a: h.aim, w: 1 },
    });
    if (n) p = over(p, { armN: arm(n, rig.shoulderN, REST.handN) });
    if (f) p = over(p, { armF: arm(f, rig.shoulderF, REST.handF) });
    return p;
  };
}

/** The kit's neutral pose (a loop frame is a delta over it: reach() keys resolve against it). */
const NEUTRAL = { ...bipedNeutral(BUILD), fx: { ...FX } } as Pose;

const beat = (ms: number, key: Beat<Pose>['key'], name?: Beat<Pose>['name'], smear?: boolean): Beat<Pose> => ({ ms, key, ...(name ? { name } : {}), ...(smear ? { smear } : {}) });

// ------------------------------------------------------------------ idle: the magma breath

const IDLE_HOLDS = [190, 150, 140, 130, 150, 180, 200, 160, 140, 130, 150, 180];
// prettier-ignore
const IDLE: readonly (readonly number[])[] = [
  // core   C   D   Y  bN  bF  Hy  Hx fNx fNy fFx fFy clN clF  amp
  [1.00,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 0.0],
  [1.10, -1,  0,  0,  0,  0,  0,  0,  1,  0, -1,  0,  0,  0, 0.6],
  [1.20, -1, -1, -1,  0,  0,  0,  0,  1,  1, -1,  0,  0,  0, 0.9],
  [1.27, -1, -1, -1, -1,  0,  1,  0,  0,  1,  0,  0,  0,  0, 0.9],
  [1.27, -1, -1, -1, -2, -1,  1,  0, -1,  0,  0,  0,  1,  0, 0.9],
  [1.20,  0, -1, -1, -2, -1,  1,  1, -1, -1,  1,  0,  1,  0, 0.9],
  [1.08,  0,  0,  0, -1, -1,  0,  1,  0, -1,  1, -1,  0,  0, 0.9],
  [0.95,  1,  0,  0,  0, -1,  0,  0,  0,  0,  0, -1,  0,  1, 0.9],
  [0.86,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  1, 0.9],
  [0.84,  1,  1,  1,  1,  0, -1,  0,  1,  0,  0,  0,  0,  0, 0.9],
  [0.88,  0,  1,  1,  1,  1, -1,  0,  1,  1, -1,  0,  0,  0, 0.9],
  [0.95,  0,  0,  0,  0,  1,  0,  0,  0,  1, -1,  1,  0,  0, 0.6],
];

const idle: LoopDef<Pose> = {
  n: IDLE.length,
  holds: IDLE_HOLDS,
  at: (f) => {
    const [core, chest, abd, yoke, bN, bF, headY, headX, fistNx, fistNy, fistFx, fistFy, clN, clF, amp] = IDLE[f];
    // the magma breath: the core swells, then the chest plate lifts, the abdomen and the hump a frame
    // later, the near boulder two (by two pixels), the far boulder three, while the head SINKS a pixel
    // between them (the hunch) and nods forward on the exhale; the fists swing late on their own
    // phases and flex; a pulse runs out along the seams once a loop; embers and the drip on their own
    const t = f / IDLE.length;
    return {
      head: { x: headX, y: headY, a: 0, lag: 0 },
      fx: { core, wave: t, waveAmp: amp, ember: t, drip: t, chestY: chest, abdY: abd, yokeY: yoke, bNy: bN, bFy: bF, fistNx, fistNy, fistFx, fistFy, clenchN: clN, clenchF: clF },
    } as D;
  },
};

// ------------------------------------------------------------------ guard: the X

const UP = -Math.PI / 2;
const GUARD_HOLDS = [180, 160, 150, 170, 190, 160, 150, 160];
// prettier-ignore
const GUARD: readonly (readonly [arms: number, core: number, seams: number, head: number, bN: number, bF: number, chest: number])[] = [
  //  arms core  seams head bN  bF  chest
  [0, 0.55, 1.0, 0, 0, 0, 0],
  [0, 0.6, 1.05, 0, -1, 0, 0],
  [-1, 0.66, 1.15, 0, -1, 0, -1],
  [-1, 0.7, 1.25, -1, -1, -1, -1],
  [-1, 0.66, 1.2, -1, 0, -1, -1],
  [0, 0.6, 1.1, -1, 0, -1, 0],
  [0, 0.55, 1.0, 0, 0, 0, 0],
  [1, 0.52, 0.95, 0, 0, 0, 1],
];
const guard: LoopDef<Pose> = {
  n: GUARD.length,
  holds: GUARD_HOLDS,
  at: (f) => {
    const [arms, core, seams, head, bN, bF, chest] = GUARD[f];
    // the X-block: crouched, the head up behind the fists, both forearms crossed at the wrists in front
    // of the core (the near one over the far one), the fists knuckles-up at the chin; the core banks dark
    // behind them while the forearm seams brighten. One slow banked breath a loop: the chest and the
    // boulders lift, the fists ride a frame late, the head lifts to peer over them.
    return reach(
      { hip: { x: 0, y: 2, tilt: 0 }, lean: 0.04, head: { x: 0, y: -5 + head, a: 0, lag: 0.6 }, slots: { armF: 'armF.front' }, fx: { core, forearm: seams, expr: 1, bNy: bN, bFy: bF, chestY: chest, ember: f / 8, drip: -1 } },
      { to: [43, 40 + arms], bend: 1, aim: UP },
      { to: [34, 39 + arms], bend: 1, aim: UP },
    )(NEUTRAL) as unknown as D;
  },
};

// ------------------------------------------------------------------ attack: Lav Yumruğu

const LUNGE = { footF: { step: [3, 0] as V, lift: 0 } };

const attack: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // the gather: only the light and the head move (in ≤ 2 × idleΔ) — the core fills, the eyes warm,
    // the head lowers a pixel, the far (lava) fist clenches
    beat(80, { head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { core: 1.3, waveAmp: 0.6, wave: 0.15, eye: 1.2, clenchF: 1, heatF: 0.3 } }, 'charge'),
    // the far foot lifts, the mass rocks back onto the near leg, the boulders rise, the far fist swings back
    beat(110, { footF: { step: [1, 0], lift: 4 }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.05, twist: 0.25, head: { x: 0, y: 0, a: 0, lag: 0.3 }, fx: { core: 1.5, waveAmp: 0.9, wave: 0.35, eye: 1.4, bNy: -1, bFy: -1, clenchF: 1, heatF: 0.5, fistFx: -2, fistFy: -1 } }),
    // STOMP: the far foot slams down a step on, the hips drop into it, the boulders still up (they lag)
    beat(60, { ...LUNGE, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.03, twist: 0.35, head: { x: 0, y: 2, a: 0, lag: 0.2 }, fx: { core: 1.7, waveAmp: 0.9, wave: 0.5, eye: 1.5, legHeat: 1.6, legRun: 0.2, dust: 0.3, bNy: -2, bFy: -2, fistNy: -2, fistFx: -2, heatF: 0.8, clenchF: 1 } }),
    // the settle: the boulders slam down past rest, the flare runs up the leg, the far fist draws back
    beat(100, reach({ ...LUNGE, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.05, twist: 0.4, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { core: 1.75, seam: 1.15, eye: 1.6, legHeat: 1.3, legRun: 0.7, dust: 0.6, bNy: 1, bFy: 1, fistNy: 1, heatF: 1.0, clenchF: 1 } }, { to: [24, 55], bend: -1, aim: 0.4 }, { to: [59, 50], bend: 1, aim: 0 })),
    // DRIVE (held while the unit travels): leaning in low, the near fist forward as a guard, the far
    // (lava) fist cocked back at the far hip with its knuckles forward, the core hot
    beat(200, reach({ ...LUNGE, hip: { x: 2, y: 3, tilt: 0 }, lean: 0.1, twist: 0.45, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { core: 1.75, seam: 1.3, eye: 1.7, expr: 2, legHeat: 0.7, legRun: 1, dust: 0.85, heatF: 1.3, clenchF: 1, bFx: -1 } }, { to: [26, 54], bend: -1, aim: 0 }, { to: [61, 47], bend: 1, aim: -0.3 })),
    // the swing: the shoulders whip round, the fist on its way out, the near arm tearing back
    beat(50, reach({ ...LUNGE, hip: { x: 3, y: 3, tilt: 0 }, lean: 0.1, twist: -0.1, head: { x: 2, y: 2, a: 0, lag: 0.3 }, fx: { core: 2.05, seam: 1.4, eye: 1.8, expr: 2, heatF: 1.6 } }, { to: [17, 53], bend: 1 }, { to: [67, 45], bend: 1, aim: 0 })),
    // PUNCH (release = impact = contact): the far arm out level, the lava fist white-hot, the core white,
    // the near arm torn back, the far boulder rolled forward
    beat(60, reach({ ...LUNGE, hip: { x: 3, y: 2, tilt: 0 }, lean: 0.11, twist: -0.5, head: { x: 2, y: 1, a: 0, lag: 0.2 }, fx: { core: 2.4, seam: 1.55, eye: 2, expr: 2, heatF: 2.2, burst: 0.12, flash: 1, bFx: 1, bNx: -1 } }, { to: [12, 50], bend: 1 }, { to: [70, 41], bend: 1, aim: 0 }), 'release', true),
    // the follow-through: the fist a pixel on and down, magma bursts off the knuckles
    beat(90, reach({ ...LUNGE, hip: { x: 4, y: 2, tilt: 0 }, lean: 0.13, twist: -0.6, head: { x: 2, y: 2, a: 0, lag: 0.2 }, fx: { core: 2.0, seam: 1.45, eye: 1.8, expr: 2, heatF: 2.0, burst: 0.5, bFx: 1, bFy: 1 } }, { to: [12, 51], bend: 1 }, { to: [70, 43], bend: 1, aim: 0.1 })),
    // recovery: the arm pulls back, the burst fades, the core cools
    beat(110, reach({ ...LUNGE, hip: { x: 3, y: 2, tilt: 0 }, lean: 0.08, twist: -0.3, head: { x: 1, y: 2, a: 0, lag: 0.3 }, fx: { core: 1.6, seam: 1.25, eye: 1.5, heatF: 1.5, burst: 0.85 } }, { to: [15, 53], bend: 1 }, { to: [66, 47], bend: 1, aim: 0.5 }), 'recover'),
    // the far foot lifts to step home (a foot only changes its place in the air, HA-9)
    beat(120, reach({ footF: { step: [2, 0], lift: 3 }, hip: { x: 2, y: 1, tilt: 0 }, lean: 0.04, twist: -0.1, head: { x: 1, y: 1, a: 0, lag: 0.2 }, fx: { core: 1.3, seam: 1.1, eye: 1.2, heatF: 1.0, burst: 0.97 } }, undefined, { to: [62, 51], bend: 1, aim: 1.0 })),
    // the fists hang again and swing home; the heat drains, the drip starts again
    beat(130, { hip: { x: 1, y: 1, tilt: 0 }, lean: 0.02, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { core: 1.12, heatF: 0.6, fistFx: 1, fistNx: -1, bNy: 1 } }),
    beat(140, { fx: { core: 1.04, heatF: 0.3, fistFx: -1, fistNx: 1 } }),
  ],
  end: 'idle0',
  endMs: 150,
};

// ------------------------------------------------------------------ roar: the vents erupt

const roar: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // the inhale: only the light and the head move first (in ≤ 2 × idleΔ) — the core and the seams dim,
    // the head lowers, the boulders draw up
    beat(90, { head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { core: 0.75, seam: 0.85, vent: 0.75, eye: 0.85, bNy: -1, bFy: -1, clenchN: 1, clenchF: 1 } }, 'charge'),
    // the gather: hunched, the fists drawn in to the belly, the light banked low
    beat(140, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: 0.05, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { core: 0.5, seam: 0.6, vent: 0.5, eye: 0.7, bNy: -2, bFy: -1 } }, { to: [29, 54], bend: -1, aim: 0.6 }, { to: [50, 54], bend: 1, aim: 2.5 })),
    // the swing: the chest starts open, the arms on their way out, the light rushing back
    beat(60, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.05, breath: 1, head: { x: 0, y: 0, a: 0, lag: 0.2 }, fx: { core: 1.4, seam: 1.1, vent: 1.3, eye: 1.4, bNy: -1 } }, { to: [17, 50], bend: -1, aim: 2.0 }, { to: [63, 50], bend: 1, aim: 1.0 })),
    // ERUPTION: the chest thrown open (arms flung out and back), the head thrown back, the jaw down, the
    // core white, both vents erupt, embers burst
    beat(110, reach({ hip: { x: -1, y: -1, tilt: 0 }, lean: -0.1, breath: 2, head: { x: -1, y: -3, a: 0, lag: 0 }, fx: { core: 2.45, seam: 1.6, vent: 2.3, eye: 2, expr: 4, jaw: 2, flash: 1, chestX: 1, bNy: -2, bFy: -2, ember: 0.35, glint: 1 } }, { to: [12, 44], bend: -1, aim: 2.45 }, { to: [69, 43], bend: 1, aim: 0.55 }), 'release'),
    beat(120, reach({ hip: { x: -1, y: -1, tilt: 0 }, lean: -0.11, breath: 2, head: { x: -1, y: -3, a: 0, lag: 0 }, fx: { core: 2.25, seam: 1.55, vent: 2.6, eye: 2, expr: 4, jaw: 2, chestX: 1, bNy: -2, bFy: -2, ember: 0.55 } }, { to: [12, 45], bend: -1, aim: 2.45 }, { to: [69, 44], bend: 1, aim: 0.5 })),
    beat(100, reach({ hip: { x: -1, y: 0, tilt: 0 }, lean: -0.09, breath: 1, head: { x: -1, y: -2, a: 0, lag: 0 }, fx: { core: 2.0, seam: 1.45, vent: 2.2, eye: 1.8, expr: 4, jaw: 1, chestX: 1, bNy: -1, bFy: -2, ember: 0.75 } }, { to: [13, 48], bend: -1, aim: 2.3 }, { to: [67, 47], bend: 1, aim: 0.65 })),
    beat(90, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.06, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { core: 1.7, seam: 1.3, vent: 1.8, eye: 1.5, jaw: 1, bNy: -1, bFy: -1, ember: 0.9 } }, { to: [15, 52], bend: -1, aim: 1.9 }, { to: [64, 51], bend: 1, aim: 0.9 })),
    // the settle: the arms come back in, the light runs back down
    beat(110, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: -0.03, head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { core: 1.4, seam: 1.15, vent: 1.4, eye: 1.2, bFy: -1, ember: 0.05 } }, { to: [17, 54], bend: -1, aim: 1.5 }, { to: [62, 53], bend: 1, aim: 1.2 }), 'recover'),
    beat(120, { hip: { x: 0, y: 1, tilt: 0 }, fx: { core: 1.2, seam: 1.05, vent: 1.15, fistNx: -1, fistFx: 1, ember: 0.2 } }),
    beat(130, { fx: { core: 1.08, vent: 1.05, fistNx: 1, bNy: 1, ember: 0.35 } }),
    beat(140, { fx: { core: 1.02, fistFx: -1, ember: 0.5 } }),
  ],
  end: 'idle0',
  endMs: 150,
};

// ------------------------------------------------------------------ hit: struck chest + head first

const hit: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    // contact: the chest plate shoved back, the head snapped back, the core gutters, the seams flare,
    // chips burst — the hips, legs, arms and boulders keep idle f0's pixels (HA-21)
    beat(50, { head: { x: -2, y: 0, a: 0, lag: 0 }, fx: { chestX: -2, core: 0.35, seam: 1.7, expr: 3, mouth: 0.6, chips: 0.15 } }, 'struck'),
    // the recoil: the hips give a pixel, the boulders jolt late, the fists swing forward
    beat(70, { hip: { x: -1, y: 0, tilt: 0 }, lean: -0.05, head: { x: -2, y: 0, a: 0, lag: 0.4 }, fx: { chestX: -1, core: 0.6, seam: 1.45, expr: 3, chips: 0.4, bNy: -2, bFy: -1, fistNx: 2, fistFx: 1 } }),
    // the sway back, the longest beat: the mass still travelling, the boulders coming down
    beat(180, { hip: { x: -1, y: 1, tilt: 0 }, lean: -0.08, head: { x: -1, y: 1, a: 0, lag: 0.3 }, fx: { core: 0.8, seam: 1.2, expr: 3, chips: 0.75, bNy: -1, fistNx: 1, fistFx: 1 } }),
    // the heavy mass rocks FORWARD past rest
    beat(120, { hip: { x: 1, y: 1, tilt: 0 }, lean: 0.04, head: { x: 1, y: 1, a: 0, lag: 0.2 }, fx: { core: 0.95, seam: 1.05, chips: 0.97, bNy: 1, bFy: 1, fistNx: -1, fistFx: -1 } }, 'recover'),
    beat(130, { lean: 0.01, fx: { core: 1.0, fistNx: 1, fistFx: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

export const ANIMS: AnimDefs<Pose> = { idle, guard, attack, roar, hit };

/**
 * The marks a beat name cannot set (PlanMonster.marks): the attack's own beats the 'lunge' recipe reads —
 * stomp (the floor shakes), drive (held while the unit travels) — and contact on the punch frame itself
 * (the release frame: release = impact = contact, the knuckles land in the anim).
 */
export const MARKS = Object.freeze({ attack: Object.freeze({ stomp: 2, drive: 4, contact: 6 }) });
