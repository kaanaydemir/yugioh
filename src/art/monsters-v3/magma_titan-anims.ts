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
//   guard    8 f, 1.33 s — the X-block: crouched two pixels, the forearms CROSSED on opposite slopes in
//           front of the core (the near one rising to its fist under the chin, the far one behind it, lit
//           where it comes out into the light), the head tucked down in front peering over the wrists; the
//           core banked dark, the forearm cracks bright; a slow banked breath (the crossed arms ride a
//           pixel by whole pixels, never re-solved; the head lifts to peer over them once a loop).
//   attack  15 f, 1.52 s — "Lav Yumruğu" with the FAR (dripping) lava fist: the gather (charge: the
//           boulders rise, the lava fist drawn back and clenched — the frame the declaration holds — and
//           its tremble partner), the far foot lifts and STOMPS a step on (mark stomp: dust, the flare runs
//           up the leg, the boulders slam down a beat late), the DRIVE and the PRESS (marks drive / press:
//           crouched and leaning in, the near fist low in front of the near belly as a guard, the lava fist
//           COCKED at the far hip half behind the belly, its knuckles glowing; the press a pixel deeper and
//           a step hotter — the recipe holds the pair while the unit travels), a 50 ms whip, the PUNCH
//           (release = impact = contact, 60 ms, smeared): the far arm out level at chest height, the fist
//           white-hot, the core white in its flare ring, the near arm torn back; the follow-through bursts
//           magma off the knuckles; a heavy recovery 110 → 150 ms.
//   roar    12 f, 1.36 s — "the vents erupt": an inhale that dims the core, a gather inward (fists to
//           the belly), then the chest is thrown open (arms flung out wide, the head back, the jaw
//           down on a molten throat): the core flares white, both vents erupt in banded flame tongues with
//           sparks; the light runs back down as it settles.
//   hit      6 f, 0.59 s — struck chest + head first (the chest plate shoved back, the head snapped
//           back, the eyes squeezed, the core gutters while the seams flare, chips burst off the
//           front), the boulders jolt late, the fists swing like pendulums, a sway back, a turn through
//           rest, then the heavy mass rocks forward past rest before it settles (recover at 305 ms).

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
/**
 * The X-block (the guard's own pose; toGuard ends on it, fromGuard leaves it): crouched two pixels, the near
 * shoulder rolled in, the forearms CROSSED in front of the core on opposite clean slopes — the near one
 * rising ↗ from its elbow at the near hip, the far one ↖ from the far side behind it (bend −1: its elbow
 * down at the far hip) — with the fists stacked on their ends knuckles-up under the chin, and the head
 * tucked down IN FRONT of them (the head.front station: the brute peers over its crossed wrists). Both
 * forearms' lava cracks burn bright as the core banks: the two broken stairs cross as a glowing X.
 */
const XBLOCK = { hip: { x: 0, y: 2, tilt: 0 }, lean: 0.04, twist: 0.25, slots: { armF: 'armF.front', pH: 'head.front', pJ: 'head.front' } };
const X_NEAR: HandTo = { to: [38, 42], bend: 1, aim: -0.46 };
const X_FAR: HandTo = { to: [42, 41], bend: -1, aim: -2.68 };
const GUARD_HOLDS = [180, 160, 150, 170, 190, 160, 150, 160];
// prettier-ignore
const GUARD: readonly (readonly [ride: number, core: number, seams: number, head: number, bN: number, bF: number, chest: number])[] = [
  // ride core  seams head bN  bF  chest
  [0, 0.55, 1.0, 0, 0, 0, 0],
  [0, 0.6, 1.05, 0, -1, 0, 0],
  [-1, 0.66, 1.15, 0, -1, 0, -1],
  [-1, 0.7, 1.25, -1, -1, -1, -1],
  [-1, 0.66, 1.2, -1, 0, -1, -1],
  [0, 0.6, 1.1, -1, 0, -1, 0],
  [0, 0.55, 1.0, 0, 0, 0, 0],
  [0, 0.5, 1.0, 0, 0, 0, 1],
];
const guard: LoopDef<Pose> = {
  n: GUARD.length,
  holds: GUARD_HOLDS,
  at: (f) => {
    const [ride, core, seams, head, bN, bF, chest] = GUARD[f];
    // one slow banked breath a loop: the chest and the boulders lift, the crossed arms ride a frame late by
    // whole pixels (fx.rideN / rideF: the bones are never re-solved, so the X never re-rasters), the head
    // lifts to peer over them; the core banks, the forearm cracks keep burning (never below 1.0: no blink)
    return reach(
      { ...XBLOCK, head: { x: 0, y: -4 + head, a: 0, lag: 0.6 }, fx: { core, forearm: seams, expr: 1, bNy: bN, bFy: bF, chestY: chest, ember: f / 8, drip: -1, stackN: 1, stackF: 1, rideN: ride, rideF: ride, litF: 1 } },
      X_NEAR,
      X_FAR,
    )(NEUTRAL) as unknown as D;
  },
};

// ------------------------------------------------------------------ attack: Lav Yumruğu

const LUNGE = { footF: { step: [3, 0] as V, lift: 0 } };

const attack: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // GATHER [charge] (the declaration holds it, feet planted): the mass rocks back and down onto the
    // near leg, the head sinks, the boulders draw up, the lava fist is pulled back and clenched (its
    // finger gaps lit), the near fist clenched, the core filling
    beat(80, { head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { core: 1.4, waveAmp: 0.6, wave: 0.15, eye: 1.25, bNy: -1, bFy: -1, clenchN: 1, clenchF: 1, heatF: 0.7, fistFx: -3, fistFy: -1, fistNx: 1 } }, 'charge'),
    // the gather tightens (the declaration's tremble partner: the core a step hotter, the boulders a
    // pixel higher, the lava fist a pixel further back, the hips a pixel lower)
    beat(90, { head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { core: 1.55, waveAmp: 0.9, wave: 0.3, eye: 1.4, bNy: -2, bFy: -2, clenchN: 1, clenchF: 1, heatF: 0.9, fistFx: -4, fistFy: -2, fistNx: 1 } }),
    // the far foot lifts, the mass rocks back onto the near leg, the boulders rise, the far fist swings back
    beat(100, { footF: { step: [1, 0], lift: 4 }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.05, twist: 0.25, head: { x: 0, y: 0, a: 0, lag: 0.3 }, fx: { core: 1.6, waveAmp: 0.9, wave: 0.45, eye: 1.45, bNy: -1, bFy: -1, clenchN: 1, clenchF: 1, heatF: 1.0, fistFx: -2, fistFy: -1 } }),
    // STOMP: the far foot slams down a step on, the hips drop into it, the boulders still up (they lag);
    // the near forearm starts to come up
    beat(60, reach({ ...LUNGE, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.03, twist: 0.35, head: { x: 0, y: 2, a: 0, lag: 0.2 }, fx: { core: 1.7, waveAmp: 0.9, wave: 0.6, eye: 1.5, legHeat: 1.6, legRun: 0.2, dust: 0.3, bNy: -2, bFy: -2, heatF: 1.1, clenchF: 1, fistFx: -3, fistFy: -2 } }, { to: [26, 56], bend: 1, aim: 1.0 })),
    // the settle: the boulders slam down past rest, the flare runs up the leg, the near arm rising to
    // its guard, the lava fist drawing back toward the far hip
    beat(90, reach({ ...LUNGE, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.06, twist: 0.45, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { core: 1.75, seam: 1.15, eye: 1.6, legHeat: 1.3, legRun: 0.7, dust: 0.6, bNy: 1, bFy: 1, heatF: 1.3, clenchF: 1 } }, { to: [34, 55], bend: 1, aim: 0.4 }, { to: [57, 55], bend: 1, aim: 0.15 })),
    // DRIVE [drive] (the recipe holds drive → press while the unit travels): crouched and leaning in,
    // the near fist forward low as a guard, the lava fist COCKED at the far hip half behind the belly,
    // its knuckle face glowing past the belly's edge, the core hot
    beat(110, reach({ ...LUNGE, hip: { x: 3, y: 4, tilt: 0 }, lean: 0.16, twist: 0.6, head: { x: 1, y: -1, a: 0, lag: 0.3 }, fx: { core: 1.75, seam: 1.3, eye: 1.7, expr: 2, legHeat: 0.7, legRun: 1, dust: 0.8, heatF: 1.5, clenchF: 1, bNy: -1, bFx: -1, bFy: -1 } }, { to: [39, 58], bend: 1, aim: 0.3 }, { to: [57, 56], bend: 1, aim: 0 })),
    // PRESS [press]: the same coil a pixel deeper and a step hotter (the recipe may alternate the two)
    beat(150, reach({ ...LUNGE, hip: { x: 3, y: 4, tilt: 0 }, lean: 0.19, twist: 0.6, head: { x: 2, y: -1, a: 0, lag: 0.3 }, fx: { core: 1.95, seam: 1.4, eye: 1.8, expr: 2, legHeat: 0.5, legRun: 1, dust: 0.95, heatF: 1.7, clenchF: 1, bNy: -2, bFx: -1, bFy: -2 } }, { to: [40, 58], bend: 1, aim: 0.3 }, { to: [56, 56], bend: 1, aim: 0 })),
    // the swing: the shoulders whip round, the fist on its way out on its arc, the near arm tearing back
    beat(50, reach({ ...LUNGE, hip: { x: 3, y: 3, tilt: 0 }, lean: 0.1, twist: -0.1, head: { x: 2, y: 2, a: 0, lag: 0.3 }, fx: { core: 2.05, seam: 1.4, eye: 1.8, expr: 2, heatF: 1.6 } }, { to: [24, 52], bend: 1 }, { to: [63, 48], bend: 1, aim: 0 })),
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
  endMs: 140,
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
    beat(120, { hip: { x: -1, y: 1, tilt: 0 }, lean: -0.08, head: { x: -1, y: 1, a: 0, lag: 0.3 }, fx: { core: 0.8, seam: 1.2, expr: 3, chips: 0.75, bNy: -1, fistNx: 1, fistFx: 1 } }),
    // the turn: the mass passes back over rest on its way forward (the in-between: no 2-px snap)
    beat(65, { hip: { x: 0, y: 1, tilt: 0 }, lean: -0.02, head: { x: 0, y: 1, a: 0, lag: 0.2 }, fx: { core: 0.88, seam: 1.12, expr: 3, chips: 0.88 } }),
    // the heavy mass rocks FORWARD past rest
    beat(130, { hip: { x: 1, y: 1, tilt: 0 }, lean: 0.04, head: { x: 1, y: 1, a: 0, lag: 0.2 }, fx: { core: 0.95, seam: 1.05, chips: 0.97, bNy: 1, bFy: 1, fistNx: -1, fistFx: -1 } }, 'recover'),
  ],
  end: 'idle0',
  endMs: 150,
};

// ================================================================== part 2: the extras
//
// The heavy struck pose (hitHeavy f0 = death f0, HA-24): the chest plate driven three pixels back and a
// pixel up into the yoke, the head snapped back and up, the core all but out while the seams flare and
// lava squirts out of them, chips off the brow — the hips, legs, arms and boulders keep idle f0's pixels
// (HA-21).
const HEAVY_STRUCK: D = { head: { x: -3, y: -1, a: 0, lag: 0 }, fx: { chestX: -3, chestY: -1, core: 0.15, seam: 1.9, expr: 3, mouth: 0.5, chips: 0.12, splash: 0.08 } };

// ------------------------------------------------------------------ hitHeavy: driven back a step
//
// The blow drives the whole mass back a step: the rear (near) foot comes up off the floor as the hips rock
// back onto it, the boulders jolt up a beat late and the fists swing forward like pendulums; the rear foot
// lands 3 px behind (the stance widens, HA-23) and the knees take the load (the hips ride back over it and
// drop, dust off its heel) while the lava squirted out of the seams falls and cools; then the weight comes
// forward, the rear foot lifts and STAMPS back onto its place (a second puff) and the mass settles. The front
// foot never leaves the floor; feet only move in the air (HA-9); the hips travel 2 px (heavy class, the hit
// kit measures it from joints()).
const hitHeavy: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, HEAVY_STRUCK, 'struck'),
    // the rear (near) foot comes up as the hips rock back onto it, the boulders jolt up a beat late
    beat(60, { footN: { step: [-1, 0], lift: 3 }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.1, head: { x: -3, y: 0, a: 0, lag: 0.4 }, fx: { chestX: -2, core: 0.4, seam: 1.6, expr: 3, chips: 0.4, splash: 0.3, bNy: -2, bFy: -2, fistNx: 2, fistFx: 2 } }),
    // driven back a STEP: the rear foot lands 3 px behind (the stance widens), the hips ride back over it and
    // drop into the knees, dust off its heel; the front foot stays planted
    beat(100, { footN: { step: [-3, 0], lift: 0 }, hip: { x: -2, y: 3, tilt: 0 }, lean: -0.05, head: { x: -2, y: 2, a: 0, lag: 0.3 }, fx: { chestX: -1, core: 0.65, seam: 1.35, expr: 3, chips: 0.75, splash: 0.6, dust: 0.3, dustN: 1, bNy: 1, fistNx: 1, fistFx: 1 } }),
    beat(120, { footN: { step: [-3, 0], lift: 0 }, hip: { x: -2, y: 4, tilt: 0 }, lean: 0.02, head: { x: -1, y: 3, a: 0, lag: 0.2 }, fx: { core: 0.8, seam: 1.15, expr: 1, chips: 0.97, splash: 0.85, dust: 0.6, dustN: 1, bNy: 2, bFy: 1, fistNx: -1, fistFx: -1 } }),
    // the weight comes forward: the rear foot lifts and comes home in the air
    beat(110, { footN: { step: [-2, 0], lift: 3 }, hip: { x: 0, y: 2, tilt: 0 }, lean: 0.04, head: { x: 0, y: 2, a: 0, lag: 0.2 }, fx: { core: 0.9, seam: 1.05, dust: 0.85, dustN: 1, bNy: 1, fistFx: 1 } }, 'recover'),
    // it STAMPS back onto its place (a second puff) and the mass settles
    beat(120, { hip: { x: 1, y: 2, tilt: 0 }, lean: 0.03, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { core: 1.05, dust: 0.25, dustN: 1, bNy: 1, bFy: 1, fistNx: 1 } }),
    beat(130, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.01, fx: { core: 1.0, dust: 0.6, dustN: 1, fistFx: 1 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ hitMagic: the spell runs IN along the seams
//
// The spell strikes the heart: a surge of light jolts IN along every seam from the limbs toward the core
// (its front two steps hot, what it passed one step up) and the body CURLS round its core — the head
// jerks down and forward, the shoulders roll in, the fists draw in to the belly — locked rigid, shuddering
// a pixel each way (the chest one way, the boulders the other) while the core flickers out, flaring,
// out, white as the surge reaches it and the eyes burn white; then it uncurls past its rest, the light
// spent below normal, and settles. (Not the sentinel's: it rises rigid on locked knees; the titan folds.)
const hitMagic: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, { head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { surge: 0.85, core: 0.25, eye: 2.6, seam: 1.2, mouth: 1.6 } }, 'struck'),
    beat(60, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.08, head: { x: 2, y: 3, a: 0, lag: 0.2 }, fx: { surge: 0.58, core: 2.0, eye: 2.4, seam: 1.3, mouth: 1.4, bNy: 1, bFy: 1, fistNx: 2, fistFx: -2, clenchN: 1, clenchF: 1 } }),
    beat(80, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.09, head: { x: 2, y: 3, a: 0, lag: 0.2 }, fx: { surge: 0.32, core: 0.4, eye: 2.0, seam: 1.3, chestX: 1, bNy: 0, bFy: 2, fistNx: 2, fistFx: -2, clenchN: 1, clenchF: 1 } }),
    beat(80, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.09, head: { x: 2, y: 3, a: 0, lag: 0.2 }, fx: { surge: 0.1, core: 2.3, eye: 1.8, seam: 1.25, chestX: -1, bNy: 2, bFy: 0, fistNx: 1, fistFx: -1, clenchN: 1, clenchF: 1 } }),
    beat(90, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.07, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { core: 1.5, eye: 1.4, seam: 1.05, bNy: 1, bFy: 1, fistNx: 1, fistFx: -1 } }),
    beat(110, { hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: -1, y: -1, a: 0, lag: 0.3 }, fx: { core: 0.6, seam: 0.7, eye: 0.7, mouth: 0.7, bNy: -1, bFy: -1, fistNx: -1, fistFx: 1 } }, 'recover'),
    beat(120, { lean: 0.01, fx: { core: 0.82, seam: 0.85, eye: 0.85, bNy: 1, fistFx: -1 } }),
    beat(130, { fx: { core: 0.95, seam: 0.95, fistNx: 1 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ death: the light drains, the basalt breaks
//
// From the heavy struck pose (HA-24) it reels back; the light drains out of the seams from the limbs
// inward (the vents, the feet and the fists go cold first, then the arms, the belt, the chest), the eyes
// go dark; the knees give and the hunched mass sinks forward over them, the fists sagging to the floor,
// the boulders slumping onto the head; the core gutters LAST — a last flicker, then out; at [dissolve]
// the cooled basalt cracks from the dead heart outward and breaks: plates split off the edges and drop,
// the boulders slide down the shoulders, embers escape the cracks. The last frame is the low broken
// heap the death kit shatters (its stone shatter with a fire accent and the card come after it).
// Its own rhythm: struck 50, reel 70, the rear-up held 140, the cooling 120, the gutter 70, the collapse
// 60 / 50 / 50, the heap settling 80 and 160.
const HEAP: D = { hip: { x: 1, y: 12, tilt: 0 }, lean: 0.24, breath: -3, head: { x: 3, y: 16, a: 0, lag: 0 }, fx: { core: 0, lit: 0, eye: 0, mouth: 0, vent: 0, ember: -1, drip: -1, seam: 0.6, bNy: 15, bNx: -3, bFy: 13, bFx: 2, fistNy: 3, fistFy: 2, chestY: 1, abdY: 1 } };
const death: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, HEAVY_STRUCK, 'struck'),
    beat(70, { hip: { x: -2, y: 0, tilt: 0 }, lean: -0.08, head: { x: -2, y: 0, a: 0, lag: 0.4 }, fx: { chestX: -1, core: 0.55, seam: 1.25, lit: 0.75, eye: 1.4, mouth: 1.2, vent: 0.6, expr: 3, splash: 0.4, chips: 0.45, bNy: -2, bFy: -1, fistNx: 2, fistFx: 1, ember: -1, drip: -1 } }),
    // the last heave: it rears up and back, the head thrown back, the eyes flaring once — the light already
    // draining out of the limbs while the core still holds
    beat(140, { hip: { x: -2, y: -1, tilt: 0 }, lean: -0.12, breath: 1, head: { x: -2, y: -3, a: 0, lag: 0 }, fx: { core: 1.35, seam: 1.0, lit: 0.5, eye: 1.8, mouth: 1.4, jaw: 1, expr: 4, vent: 0.3, splash: 0.75, chips: 0.8, bNy: -3, bFy: -2, fistNx: 1, fistFx: 1, ember: -1, drip: -1 } }),
    // frozen in it, cooling: only the chest's seams still lit, the eyes dying, the core flickering
    beat(120, { hip: { x: -2, y: -1, tilt: 0 }, lean: -0.12, breath: 1, head: { x: -2, y: -3, a: 0, lag: 0 }, fx: { core: 0.7, seam: 0.85, lit: 0.22, eye: 0.35, mouth: 0.3, jaw: 1, vent: 0, splash: 0.95, bNy: -3, bFy: -2, ember: -1, drip: -1 } }),
    // the core gutters LAST — out; the cold mass starts to give at the knees
    beat(70, { hip: { x: -1, y: 2, tilt: 0 }, lean: -0.02, head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { core: 0.15, seam: 0.7, lit: 0, eye: 0, mouth: 0, jaw: 1, vent: 0, bNy: 0, bFy: 0, fistNy: 1, fistFy: 1, ember: -1, drip: -1 } }),
    // [dissolve] it collapses straight down into itself and the cooled basalt breaks from the dead heart out
    beat(60, { hip: { x: 0, y: 6, tilt: 0 }, lean: 0.1, breath: -2, head: { x: 2, y: 7, a: 0, lag: 0 }, pass: { crumble: 0.18 }, fx: { ...HEAP.fx, bNy: 6, bFy: 5, ash: 0.1 } }, 'dissolve'),
    beat(50, { ...HEAP, hip: { x: 1, y: 10, tilt: 0 }, head: { x: 3, y: 12, a: 0, lag: 0 }, pass: { crumble: 0.42 }, fx: { ...HEAP.fx, bNy: 11, bFy: 9, ash: 0.3 } }),
    beat(50, { ...HEAP, pass: { crumble: 0.65 }, fx: { ...HEAP.fx, ash: 0.5 } }),
    beat(80, { ...HEAP, pass: { crumble: 0.85 }, fx: { ...HEAP.fx, ash: 0.7 } }),
    beat(160, { ...HEAP, pass: { crumble: 1 }, fx: { ...HEAP.fx, ash: 0.9 } }),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ summon: out of the magma
//
// Not the sentinel's assembly: the titan is POURED. The floor of the tile splits along a glowing crack,
// the crack bursts open and magma wells up into a pool; the titan heaves itself up out of it molten —
// the boulders and the head first, then the near arm thrusts up out of the magma and slams its fist onto
// the floor at the rim and the body hauls itself out on it, hips and legs streaming magma — while the
// magma cools onto it into basalt from the top down, block by block (molten → hot → a red crust →
// basalt, the seams the last to glow); [land] the feet come up out of the pool and plant under the full
// weight, the pool drains back into the crack and cools; for a beat it stands DARK, a cooled statue —
// then the core IGNITES LAST: a spark, a flare that rings the chest, the light filling the seams outward
// to the limbs, the eyes kindling, the vents puffing, and it settles into the idle. Its rhythm: the dark
// statue held 200 ms, then the ignition on a 50 ms spark (kor dolar: the stillness, then the burst).
const SUMMON_DARK = { core: 0, lit: 0, eye: 0, mouth: 0, vent: 0, ember: -1, drip: -1 };
const summon: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(70, { lift: -62, fx: { ...SUMMON_DARK, molten: 1, cool: 0, fissure: 0.3 } }),
    beat(60, { lift: -62, fx: { ...SUMMON_DARK, molten: 1, cool: 0, fissure: 1, pool: 0.2 } }),
    beat(70, { lift: -46, lean: 0.04, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { ...SUMMON_DARK, molten: 1, cool: 0, fissure: 1, pool: 0.6 } }),
    beat(70, { lift: -33, lean: 0.07, head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { ...SUMMON_DARK, molten: 1, cool: 0.04, fissure: 1, pool: 0.85, bNy: 1 } }),
    beat(80, reach({ lift: -23, lean: 0.1, head: { x: 1, y: 2, a: 0, lag: 0 }, fx: { ...SUMMON_DARK, molten: 1, cool: 0.14, fissure: 1, pool: 1 } }, { to: [13, 47], bend: -1, aim: -1.3 })),
    beat(80, reach({ lift: -14, lean: 0.14, head: { x: 1, y: 2, a: 0, lag: 0 }, fx: { ...SUMMON_DARK, molten: 1, cool: 0.27, fissure: 1, pool: 1, bNy: 2, bFy: 1 } }, { to: [11, 72], bend: 1, aim: 1.4 })),
    beat(90, reach({ lift: -6, lean: 0.12, hip: { x: 0, y: 0, tilt: 0 }, head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { ...SUMMON_DARK, molten: 1, cool: 0.44, fissure: 1, pool: 1, bNy: 1, bFy: 1 } }, { to: [13, 73], bend: 1, aim: 1.4 })),
    beat(90, { hip: { x: 0, y: 3, tilt: 0 }, lean: 0.06, head: { x: 0, y: 2, a: 0, lag: 0.2 }, fx: { ...SUMMON_DARK, molten: 1, cool: 0.62, fissure: 1, pool: 1.25, bNy: 2, bFy: 2, fistNy: 1, dust: 0.3 } }, 'land'),
    beat(60, { hip: { x: 0, y: 2, tilt: 0 }, lean: 0.03, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { ...SUMMON_DARK, molten: 1, cool: 0.8, fissure: 1, pool: 1.5, bNy: 1, bFy: 1, dust: 0.6 } }),
    beat(200, { hip: { x: 0, y: 1, tilt: 0 }, fx: { ...SUMMON_DARK, fissure: 1, pool: 1.8, dust: 0.85 } }),
    beat(50, { hip: { x: 0, y: 1, tilt: 0 }, fx: { ...SUMMON_DARK, core: 0.7, fissure: 1, pool: 1.95 } }),
    beat(80, { hip: { x: 0, y: 0, tilt: 0 }, breath: 1, fx: { ...SUMMON_DARK, core: 2.1, lit: 0.35, eye: 0.5, flash: 1, bNy: -1 } }),
    beat(80, { head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { core: 1.6, lit: 0.75, eye: 1.3, mouth: 1, vent: 1.7, ember: 0.1, drip: -1, bNy: -1, bFy: -1 } }),
    beat(90, { fx: { core: 1.2, lit: 1, eye: 1.1, vent: 1.2, ember: 0.3, drip: 0.6, bFy: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ revive: re-ignition from embers
//
// Not the summon replayed: the titan comes back out of its OWN broken heap, cold. An ember wakes in the
// dead core, brightens, and the core relights; the light fills the seams outward from it (the chest,
// then the arms and the belt, then the legs and the vents) and wherever it reaches, the broken plates
// fly back up the paths they fell along into their notches, the cracks closing with lava in them; the
// slumped mass heaves itself up over its knees — [land] whole, standing, the feet planted — and draws
// its first breath: the core swells, the vents puff, the eyes kindle; it settles into the idle.
// The titan's own rhythm (kor dolar: a slow fill, a sudden burst — not the pilot's): the ember wake is held
// long (150 + 140 ms, only the core changing), the heave bursts 50 / 50 / 60, [land] at 450 ms (the magus's
// land: the slowest the soul_recall budget is cut for), the first breath held 130 ms.
const revive: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(150, { ...HEAP, pass: { reassemble: 0 }, fx: { ...HEAP.fx, core: 0.15 } }),
    beat(140, { ...HEAP, pass: { reassemble: 0 }, fx: { ...HEAP.fx, core: 0.55 } }),
    beat(50, { ...HEAP, hip: { x: 1, y: 6, tilt: 0 }, head: { x: 3, y: 8, a: 0, lag: 0 }, pass: { reassemble: 0.3 }, fx: { ...HEAP.fx, core: 1.0, lit: 0.2, bNy: 7, bFy: 5 } }),
    beat(50, { hip: { x: 1, y: 5, tilt: 0 }, lean: 0.12, breath: -2, head: { x: 2, y: 6, a: 0, lag: 0 }, pass: { reassemble: 0.55 }, fx: { core: 1.35, lit: 0.45, eye: 0, mouth: 0, vent: 0, ember: -1, drip: -1, bNy: 5, bFy: 3, fistNy: 3, fistFy: 2 } }),
    beat(60, { hip: { x: 0, y: 3, tilt: 0 }, lean: 0.07, breath: -1, head: { x: 1, y: 3, a: 0, lag: 0 }, pass: { reassemble: 0.8 }, fx: { core: 1.5, lit: 0.7, eye: 0.3, mouth: 0.3, vent: 0, ember: -1, drip: -1, bNy: 2, bFy: 2, fistNy: 1, fistFy: 1 } }),
    beat(90, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, pass: { reassemble: 1 }, fx: { core: 1.6, lit: 0.95, eye: 0.9, mouth: 0.8, vent: 0.6, ember: -1, drip: -1, bNy: 1 } }, 'land'),
    beat(130, { breath: 1, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { core: 1.85, eye: 1.3, vent: 1.7, ember: 0.1, drip: -1, bNy: -1, bFy: -1 } }),
    beat(100, { fx: { core: 1.3, eye: 1.1, vent: 1.3, ember: 0.3, drip: -1, bFy: -1 } }),
    beat(110, { fx: { core: 1.05, vent: 1.05, ember: 0.5, drip: 0.5, bNy: 1 } }),
    beat(120, { fx: { core: 0.95, ember: 0.7, drip: 0.8, fistNx: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ special: the fireball from the chest
//
// The summon effect (step 3 launches burnFly from points().core on [release]): the stance braces and the
// core swells [charge]; the chest heaves up and the plates PART around the core (the cleft between them
// lava), the arms pulled back and down behind the hips; the fireball forms AT the core, sparks pulled in
// along six rays; the longest beat: the ball full (≈ 7 px: a fire4 heart with a white centre, a fire3
// body, fire2 tongues licking up), the body arched back over it; the chest punches forward (the swing);
// [release] the ball leaves — the core's flare ring where it was (the cinematic's ball takes over from
// the core point); the body recoils from the launch, the plates close, the core spent; recovery.
const special: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(70, { fx: { core: 1.45, seam: 1.1, clenchN: 1, clenchF: 1, bNy: -1, eye: 1.2 } }, 'charge'),
    beat(90, reach({ hip: { x: -1, y: 1, tilt: 0 }, lean: -0.04, breath: 1, head: { x: -1, y: -1, a: 0, lag: 0.2 }, fx: { core: 1.85, seam: 1.25, split: 1, eye: 1.4, bNy: -1, bFy: -1 } }, { to: [15, 58], bend: 1, aim: 1.6 }, { to: [55, 58], bend: 1, aim: 2.2 })),
    beat(100, reach({ hip: { x: -1, y: 1, tilt: 0 }, lean: -0.06, breath: 1, head: { x: -1, y: -2, a: 0, lag: 0.2 }, fx: { core: 2.1, seam: 1.35, split: 2, ball: 2.2, ballX: 1, gather: 0.35, eye: 1.6, vent: 1.35, bNy: -2, bFy: -2 } }, { to: [13, 59], bend: 1, aim: 1.7 }, { to: [53, 59], bend: 1, aim: 2.3 })),
    beat(150, reach({ hip: { x: -1, y: 1, tilt: 0 }, lean: -0.07, breath: 2, head: { x: -1, y: -2, a: 0, lag: 0.2 }, fx: { core: 2.4, seam: 1.45, split: 2, ball: 4.4, ballX: 3, gather: 0.85, eye: 1.8, vent: 1.5, bNy: -2, bFy: -2 } }, { to: [12, 59], bend: 1, aim: 1.7 }, { to: [52, 59], bend: 1, aim: 2.3 })),
    beat(50, reach({ hip: { x: 1, y: 1, tilt: 0 }, lean: 0.05, breath: 1, head: { x: 1, y: 0, a: 0, lag: 0.3 }, fx: { core: 2.4, seam: 1.5, split: 2, ball: 4.4, ballX: 5, chestX: 1, eye: 1.8, vent: 1.3, bNy: -1, bFy: -1 } }, { to: [11, 57], bend: 1, aim: 1.4 }, { to: [51, 58], bend: 1, aim: 2.2 })),
    beat(60, reach({ hip: { x: 1, y: 1, tilt: 0 }, lean: 0.07, head: { x: 2, y: 0, a: 0, lag: 0.2 }, fx: { core: 1.6, seam: 1.4, split: 1, chestX: 2, ballX: 11, launch: 1, flash: 1, eye: 1.6, bFx: 1 } }, { to: [12, 56], bend: 1, aim: 1.3 }), 'release'),
    beat(80, { hip: { x: -2, y: 1, tilt: 0 }, lean: -0.07, head: { x: -2, y: 0, a: 0, lag: 0.3 }, fx: { core: 0.6, seam: 0.9, chestX: -1, eye: 1.1, bNy: -1, bFy: -2, fistNx: 2, fistFx: 2, ember: 0.4 } }),
    beat(90, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, head: { x: 0, y: 1, a: 0, lag: 0.2 }, fx: { core: 0.8, seam: 0.95, bNy: 1, bFy: 1, fistNx: -1, ember: 0.6 } }, 'recover'),
    beat(100, { fx: { core: 0.92, fistFx: -1, bNy: 1, ember: 0.8 } }),
  ],
  end: 'idle0',
  endMs: 110,
};

// ------------------------------------------------------------------ victory: the burning fist
//
// Not the sentinel's salute (a fist laid on the chest) nor the roar (arms flung wide): the brute lifts
// its near fist up beside its face, knuckles up, and CLENCHES it — the knuckles ignite white-hot with a
// spit of sparks and the core flares in answer —, turns its head to it with a grin of molten teeth and
// holds it there, the fist burning down through fire4 and fire3 while magma drips off it, the vents
// smoking with low flames. The far arm hangs; the chest and its core stay open (the light leads).
const FIST_UP: HandTo = { to: [31, 32], bend: 1, aim: -Math.PI / 2 };
/** The raised arm in front of its boulder (its forearm rises before the shoulder rock), the fist stacked on it. */
const RAISED = { slots: { armN: 'head.front' } };
const victory: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // the light leads (in ≤ 1.2 × idleΔ): the near fist squeezes and swings a pixel up, the core warms
    beat(70, { fx: { core: 1.2, clenchN: 1, heatN: 0.3, fistNx: 1, fistNy: -1, bNy: -1 } }),
    beat(90, reach({ hip: { x: 0, y: -1, tilt: 0 }, head: { x: 0, y: 0, a: 0, lag: 0.2 }, fx: { core: 1.3, clenchN: 1, heatN: 0.6, bNy: -1 } }, { to: [25, 47], bend: 1, aim: -1.1 })),
    // the fist up beside the face, out over its boulder (the core stays open), the gaps warming
    beat(80, reach({ ...RAISED, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.02, head: { x: -1, y: -1, a: 0, lag: 0.2 }, fx: { core: 1.4, heatN: 1.0, stackN: 1, bNy: -2, bFy: -1 } }, FIST_UP)),
    // the CLENCH: squeezed a pixel down, the knuckles white-hot with a spit of sparks, the core answers
    beat(60, reach({ ...RAISED, hip: { x: 0, y: 0, tilt: 0 }, lean: -0.02, head: { x: -1, y: -1, a: 0, lag: 0 }, fx: { core: 1.9, seam: 1.25, heatN: 2.0, stackN: 1, clash: 0.15, bNy: -1, bFy: 0 } }, { ...FIST_UP, to: [31, 33] })),
    beat(100, reach({ ...RAISED, hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, head: { x: -2, y: -1, a: 0, lag: 0 }, fx: { core: 1.7, seam: 1.2, heatN: 1.75, stackN: 1, clash: 0.45, jaw: 1, expr: 4, vent: 1.45, bNy: -1 } }, FIST_UP)),
    beat(120, reach({ ...RAISED, hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, head: { x: -2, y: -1, a: 0, lag: 0 }, fx: { core: 1.55, seam: 1.15, heatN: 1.55, stackN: 1, clash: 0.8, jaw: 1, expr: 4, vent: 1.6, bNy: -1, ember: 0.2 } }, FIST_UP)),
    // the hold breathes once before it settles: the core swells and settles, the boulders ride it, the fist
    // smoulders down to its knuckle row (a flicker 1.35 → 1.25), the vents smoking low; the last frame is held
    beat(120, reach({ ...RAISED, hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, head: { x: -2, y: -1, a: 0, lag: 0 }, fx: { core: 1.45, seam: 1.1, heatN: 1.35, stackN: 1, jaw: 1, expr: 4, vent: 1.5, bNy: -1, ember: 0.4 } }, FIST_UP)),
    beat(120, reach({ ...RAISED, hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, head: { x: -2, y: -1, a: 0, lag: 0 }, fx: { core: 1.6, seam: 1.15, heatN: 1.3, stackN: 1, jaw: 1, expr: 4, vent: 1.45, bNy: -2, bFy: -1, ember: 0.55, chestY: -1 } }, FIST_UP)),
    beat(300, reach({ ...RAISED, hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, head: { x: -2, y: -1, a: 0, lag: 0 }, fx: { core: 1.45, seam: 1.1, heatN: 1.25, stackN: 1, jaw: 1, expr: 4, vent: 1.4, bNy: -1, ember: 0.7 } }, FIST_UP)),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ toGuard / fromGuard (≤ 0.4 s)
//
// Started from rigkit's draft (draftGuardTransitions: the arms lead, the body goes down, the head comes
// last) and corrected by hand at ×3: the draft swung both forearms across the chest on its first frame
// (a 2.6 × idleΔ pop) and put the far arm in front of the torso while it still hung at the side. Here the
// fists rise in an arc — the near one forward and up, the far one in from the side, behind the torso until
// its hand clears the chest, then in front of it, under the near one — while the hips sink two pixels,
// the core banks down behind the closing forearms and their seams brighten; the head comes up behind the
// fists last, a pixel past the guard and back (toGuard ends on guard f0). fromGuard: the head drops first,
// the forearms uncross and fall to their hang (the far one back behind the torso), the hips rise, the core
// swells back a little past rest and the boulders settle. Feet never move (HA-9).
const toGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // the light leads: the core banks, both fists squeeze and swing a pixel in (still the hanging arms)
    beat(50, { fx: { core: 0.85, clenchN: 1, clenchF: 1, fistNx: 1, fistNy: -1, fistFx: -1, fistFy: -1, drip: -1 } }),
    // the fists rise on their arcs: the near one forward and up, the far one in from the side (still behind
    // the torso); the hips start to sink, the head a pixel up
    beat(60, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, twist: 0.1, head: { x: 0, y: -1, a: 0, lag: 0.3 }, fx: { core: 0.75, forearm: 0.5, expr: 1, drip: -1, bNy: -1 } }, { to: [31, 49], bend: 1, aim: -0.3 }, { to: [51, 48], bend: 1, aim: -2.2 })),
    // mid-arc: the far forearm swings in front of the torso, both fists coming up stacked, the forearms not yet
    // crossed (the near one still low), the core banking down behind them
    beat(60, reach({ hip: { x: 0, y: 2, tilt: 0 }, lean: 0.03, twist: 0.2, head: { x: 0, y: -2, a: 0, lag: 0.4 }, slots: { armF: 'armF.front', pH: 'head.front', pJ: 'head.front' }, fx: { core: 0.65, forearm: 0.8, expr: 1, drip: -1, bNy: -1, stackN: 1, stackF: 1, litF: 1 } }, { to: [34, 46], bend: 1, aim: -0.7 }, { to: [47, 45], bend: -1, aim: -2.45 })),
    // the X closes: the forearms cross on the guard's own bones, two pixels low (fx.rideN / rideF: the X
    // arrives from under and rises into place), the head tucks down over them
    beat(70, reach({ ...XBLOCK, head: { x: 0, y: -3, a: 0, lag: 0.5 }, fx: { core: 0.58, forearm: 1.05, expr: 1, drip: -1, stackN: 1, stackF: 1, rideN: 2, rideF: 2, litF: 1 } }, X_NEAR, X_FAR)),
    // the X a pixel low, the head still ducked: the closing frame. The brace reaction (MonsterUnit.brace)
    // plays f3 at the blow and closes on this frame, so a blocked hit drives the X down and in and lets it
    // come back up — never up into the blow (the head's peek lives in the guard loop, f3–f5)
    beat(70, reach({ ...XBLOCK, head: { x: 0, y: -3, a: 0, lag: 0.6 }, fx: { core: 0.52, forearm: 1.1, expr: 1, drip: -1, stackN: 1, stackF: 1, rideN: 1, rideF: 1, litF: 1 } }, X_NEAR, X_FAR)),
  ],
  end: 'guard0',
  endMs: 80,
};
// fromGuard: the head drops first, the X opens (the forearms uncross and fall, the far one back behind the
// torso), the hips rise, the core swells back a little past rest and the boulders settle
const fromGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(60, reach({ ...XBLOCK, head: { x: 0, y: -2, a: 0, lag: 0.6 }, fx: { core: 0.62, forearm: 1.0, expr: 1, drip: -1, stackN: 1, stackF: 1, rideN: 1, rideF: 1, litF: 1 } }, X_NEAR, X_FAR)),
    beat(60, reach({ hip: { x: 0, y: 2, tilt: 0 }, lean: 0.03, twist: 0.15, head: { x: 0, y: -1, a: 0, lag: 0.4 }, slots: { armF: 'armF.front', pH: 'head.front', pJ: 'head.front' }, fx: { core: 0.75, forearm: 0.6, expr: 1, drip: -1, stackN: 1, stackF: 1, litF: 1 } }, { to: [34, 46], bend: 1, aim: -0.8 }, { to: [46, 46], bend: -1, aim: -2.35 })),
    beat(70, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, head: { x: 0, y: 0, a: 0, lag: 0.2 }, fx: { core: 0.92, forearm: 0.25, drip: -1, bNy: -1 } }, { to: [28, 52], bend: 1, aim: 0.8 }, { to: [52, 51], bend: 1, aim: 2.3 })),
    beat(80, { hip: { x: 0, y: 0, tilt: 0 }, fx: { core: 1.1, drip: -1, bNy: 1, bFy: 1, fistNx: 1, fistFx: -1 } }),
  ],
  end: 'idle0',
  endMs: 90,
};

export const ANIMS: AnimDefs<Pose> = { idle, guard, attack, roar, hit, hitHeavy, hitMagic, death, summon, revive, special, victory, toGuard, fromGuard };

/**
 * The marks a beat name cannot set (PlanMonster.marks): the attack's own beats the 'lunge' recipe reads —
 * stomp (the floor shakes), drive (held while the unit travels) — and contact on the punch frame itself
 * (the release frame: release = impact = contact, the knuckles land in the anim).
 */
export const MARKS = Object.freeze({ attack: Object.freeze({ stomp: 3, drive: 5, press: 6, contact: 8 }) });
