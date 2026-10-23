// Mercan Yılanı v3 (A4.1) — the BUILD on the 'serpent' type (./coral_serpent-plan.ts): frame, proportions,
// materials, tone tables, channels. No default export (see the plan's header: the registry imports this
// file at boot and gets nothing from it; the art is ./_coral_serpent.ts, not registered yet).
//
// Frame 88×92 = the v1 80×80 frame + a margin (offset OX = 4, OY = 10: 10 px over the crown for the rear
// of the roar, 4 px on the left for the wind-back, 4 px under the floor line, 8 on the right for the
// thrust); 1 art px = 1 game px; anchor (34, 86) = v1 (30, 76). Every number below is a FRAME px; the
// rest skeleton is fitted to the approved still (src/still/serpent-map.ts = v1 idle f0's silhouette):
// the coil ring and both chains are v1's rest spine (src/art/monsters/coral_serpent.ts spineOf at idle f0)
// resampled at a constant step, so raster.tube draws the still's tube outline at rest.

import { PAL } from '../palette';
import type { MaterialId } from '../materials';
import type { SerpentBuild } from './coral_serpent-plan';

/** v1 frame px → this frame. */
export const OX = 4;
export const OY = 10;

export const FRAME = Object.freeze({ w: 88, h: 92, anchor: [34, 86] as const });

const PI = Math.PI;

export const BUILD: SerpentBuild = Object.freeze({
  root: [34, 86] as const,
  coil: Object.freeze({ c: [29 + OX, 66 + OY] as const, rx: 17, ry: 6.5, ph0: 0.18 * PI, split: PI, ph1: 1.6 * PI, steps: 26, r: [4.3, 4.82, 5.2] as const }),
  tail: Object.freeze({ step: 2.023, angles: Object.freeze([-5.24, -3.47, -9.76, -25.47, -41.73, -48.78, -48.39]), tip: 1 }),
  neck: Object.freeze({
    step: 1.9734,
    angles: Object.freeze([-29.11, -32.32, -36.09, -41.4, -49.93, -63.91, -88.25, -110.38, -117.94, -120.92, -121.02, -118.16, -110.35, -95.53, -80.8, -70.58, -65.04, -62.13, -63.21]),
    r: [5.16, 3.6] as const,
    taper: 1.15,
    cut: 1.35,
    lock: Object.freeze({ full: 3, ramp: 3 }),
  }),
  depth: Object.freeze({ tail: 15, front: 0, back: -30, neck: -15 }),
  belly: Object.freeze({ from: 0, ramp: 8 }),
  fin: Object.freeze({ from: 6, to: 31 }),
  head: Object.freeze({
    hinge: [44.4 + OX, 29.9 + OY] as const,
    upperTip: [65.5 + OX, 31 + OY] as const,
    lowerTip: [62 + OX, 34 + OY] as const,
    open: 0.5,
    eye: [51 + OX, 27 + OY] as const,
    crown: [38 + OX, 22 + OY] as const,
  }),
});

/** Part roles → materials (A3_MIMARI §5): the scaled hide (its ventral plates and coral / membrane tones are tone sets of it) and water. */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ body: 'scale', water: 'water' });

/** Tone tables of the hide's three tone sets (src/art/materials/defs/scale.ts header). */
export const TONES = Object.freeze({
  /** near scales, dark → light: underside / crease, shadow, mid, lit, edge */
  scale: Object.freeze([PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4]),
  /** ventral plates: far side, plate, the plate edge facing forward, (lit P2 edge) */
  belly: Object.freeze([PAL.night3, PAL.steel, PAL.mist, PAL.white]),
  /** coral and membranes, dark → light */
  coral: Object.freeze([PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4]),
  /** the eye: socket, iris, hot core, glint */
  eye: Object.freeze([PAL.water0, PAL.cyan3, PAL.cyan4, PAL.white]),
});

/**
 * The member's own channels (A3_MIMARI §3.4 Fx) and their neutral values. Light (eye, water light in the
 * mouth) is drawn after the outline; matter (drip, spray, splash, the throat's swell) into the frame.
 *   eye     the eye's light: 1 = the still's (cyan3 / cyan4 / white glint toward the snout), 0 = dark,
 *           2 = blazing (the iris widens a pixel, the glint grows)
 *   squint  0 open … 1 shut to a slit (a blow)
 *   glint   the anim's one glint (IŞ-8) on the eye's white pixel: 0 none, 1 = 1 px, 2 = the 3-px cross
 *   drip    the idle drop on its own period: 0 none; (0, 1] its phase — it swells under the fin's lower
 *           ray tip, falls and is gone at 1 (the still's drop hangs mid-fall at 0.34)
 *   swell   the throat swelling with the water it gathers (attack charge): 0 … 1 (px of the neck's
 *           radius under the jaw)
 *   water   the water in the open mouth: 0 none … 1 a full gathering orb (light, after the outline)
 *   spout   the jet's root at the mouth (the release / the held firing pose): 0 none … 1 full
 *   spray   spray flung off the crown and the jaws (roar): 0 none, else its phase (0, 1]
 *   splash  water bursting off the struck head (hit): 0 none, else its phase (0, 1]
 * Part 2 (the extras):
 *   form    the summon's water body: how much of the tube has formed, tail tip → head (0 none … 1 all;
 *           the formed body is WATER until the skin reaches it; the stream's head foams at the front)
 *   skin    the summon's hide: how much of the formed body wears its hide, head → tail (0 all water …
 *           1 all hide, the still); the rigid parts (crown first: it breaks the surface) take theirs at
 *           their own place along the body
 *   whirl   the summon's whirlpool on the floor round the coil: 0 none, else its phase (0, 1] (it opens,
 *           spins and closes into the coil as the water rises into the body)
 *   ring    the shed water's splash ring at the coil's foot (summon land): 0 none, else its phase
 *   puddle  the water on the floor round the coil (death, revive): 0 none … 1 the widest
 *   inflow  the revive's currents running back over the puddle into the coil: 0 none, else their phase
 *   flicker the hitMagic spell in the scales: 0 none, else a count — which scale rows burn this frame
 *   sink    px the coral crown has sunk below its seat on the skull (death: the body foams away
 *           under the stone crown, which comes down onto the heap; never foams itself)
 *   flow    the water's current phase (moves the water body's current lines ≥ 1 px a frame)
 */
export interface SerpentFx extends Record<string, number> {
  eye: number;
  squint: number;
  glint: number;
  drip: number;
  swell: number;
  water: number;
  spout: number;
  spray: number;
  splash: number;
  form: number;
  skin: number;
  whirl: number;
  ring: number;
  puddle: number;
  inflow: number;
  flicker: number;
  sink: number;
  flow: number;
}

export const FX: SerpentFx = Object.freeze({
  eye: 1, squint: 0, glint: 0, drip: 0.34, swell: 0, water: 0, spout: 0, spray: 0, splash: 0,
  form: 1, skin: 1, whirl: 0, ring: 0, puddle: 0, inflow: 0, flicker: 0, sink: 0, flow: 0,
}) as SerpentFx;
