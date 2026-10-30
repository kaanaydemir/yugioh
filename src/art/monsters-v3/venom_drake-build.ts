// Zehir Ejderi (venom_drake) v3 — the BUILD on the 'serpent' type (./coral_serpent-plan.ts, imported as the
// plan only). A land dragon-serpent: a small planted ring of coil, a LONG S-curved neck (it leans back
// off the coil, swings forward at the top and drops into a head that hangs level-down, like a hooded
// viper's), a slim tail trailing out flat to a barbed blade, vestigial wing-fins at the shoulder, a spine
// of dorsal spikes. Frame 88×92, anchor (34, 86) = the coral frame (a sprite-class-80 monster).
// Channels (Fx) of this member:
//   eye     1 = venom-yellow iris, 0 = dark, 2 = blazing (the iris widens, the glint grows)
//   squint  0 open … 1 shut to a slit
//   glint   1 = 1 px, 2 = the 3-px cross, on the eye's white pixel
//   drip    the fang's venom drop: 0 none, else its phase (0, 1]: it swells, falls, is gone at 1
//   maw     the venom light in the open mouth: 0 none … 1 full (palate, throat, tongue glow)
//   glow    the spine's glow / vein heat: 0 dead … 1 rest … 2 hot
//   spit    the venom spit's root at the muzzle (attack release): 0 none … 1 full
//   spray   venom flung off the jaws (roar): 0 none, else its phase (0, 1]
//   splash  venom bursting off the struck head (hit): 0 none, else its phase (0, 1]
//   form    the summon's mist body: how much of the tube is formed, tail tip → head (0 none … 1 all)
//   skin    the summon's hide: how much of the formed body has solidified (head → tail), 0 mist … 1 hide
//   mist    the summon's toxic mist on the floor round the coil: 0 none, else its phase (0, 1]
//   ring    the landing's ooze ring at the coil's foot: 0 none, else its phase
//   puddle  the sludge on the floor round the coil (death, revive): 0 none … 1 the widest
//   bubble  the sludge's bubbles: 0 none, else a count (which bubbles pop this frame)
//   flicker the hitMagic spell in the scales: 0 none, else a count
//   flow    the vein's current phase
import { PAL } from '../palette';
import type { MaterialId } from '../materials';
import { chain } from '../rigkit/geom';
import type { SerpentBuild } from './coral_serpent-plan';

export const FRAME = Object.freeze({ w: 88, h: 92, anchor: [34, 86] as const });
const PI = Math.PI;

const RING = { c: [25.5, 76.5] as const, rx: 16.5, ry: 6.2, ph1: 1.6 * PI };
const NECK = [-35, -60, -85, -100, -104, -102, -98, -94, -90, -86, -82, -78, -72, -64, -54, -42, -30, -16, 0, 14, 24, 30, 32];
const NECK_STEP = 2.7;

/** The rest head joint (the neck chain's end), computed the way the plan does. */
const root: [number, number] = [RING.c[0] + Math.cos(RING.ph1) * RING.rx, RING.c[1] + Math.sin(RING.ph1) * RING.ry];
const neckPts = chain(root, NECK, NECK_STEP);
export const JOINT = neckPts[neckPts.length - 1];
/** The head's rest axis (degrees, screen: + = down-right): the neck's last segment. */
export const HEAD_AXIS = NECK[NECK.length - 1];
const A = (HEAD_AXIS * PI) / 180;
/** Head-local (x forward along the snout, y down, origin at the head joint) → rest frame px. */
export const HEAD_SCALE = 1.12;
export const headRest = (lx: number, ly: number): [number, number] => {
  const x = lx * HEAD_SCALE;
  const y = ly * HEAD_SCALE;
  return [JOINT[0] + Math.cos(A) * x - Math.sin(A) * y, JOINT[1] + Math.sin(A) * x + Math.cos(A) * y];
};
/** Head-local anchor points the plan carries. */
export const HEAD_LOCAL = Object.freeze({ hinge: [2, 3.5] as const, upper: [22, 1.5] as const, lower: [21, 4.5] as const, eye: [8, -2.5] as const, crown: [-3, -5] as const });

export const BUILD: SerpentBuild = Object.freeze({
  root: [34, 86] as const,
  coil: Object.freeze({ c: RING.c, rx: RING.rx, ry: RING.ry, ph0: 0.16 * PI, split: PI, ph1: RING.ph1, steps: 26, r: [4.2, 4.9, 5.4] as const }),
  tail: Object.freeze({ step: 2.7, angles: Object.freeze([-8, -10, -12, -16, -22, -28, -34, -40]), tip: 0.8 }),
  neck: Object.freeze({ step: NECK_STEP, angles: Object.freeze(NECK), r: [5.4, 3.5] as const, taper: 1.15, cut: 1.35, lock: Object.freeze({ full: 3, ramp: 3 }) }),
  depth: Object.freeze({ tail: 15, front: 0, back: -30, neck: -15 }),
  belly: Object.freeze({ from: 2, ramp: 8 }),
  fin: Object.freeze({ from: 4, to: 60 }),
  head: Object.freeze({
    hinge: headRest(...HEAD_LOCAL.hinge),
    upperTip: headRest(...HEAD_LOCAL.upper),
    lowerTip: headRest(...HEAD_LOCAL.lower),
    open: 0.45,
    eye: headRest(...HEAD_LOCAL.eye),
    crown: headRest(...HEAD_LOCAL.crown),
  }),
});

/** The role registered for planArt (the painters draw their own tones; the moss ramp is the nearest registered green). */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ body: 'moss' });

export const TONES = Object.freeze({
  /** near scales: underside, shadow, mid, lit, edge */
  scale: Object.freeze([PAL.night0, PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3]),
  /** ventral plates: far side, plate, the plate edge facing forward, lit edge */
  belly: Object.freeze([PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4]),
  /** the vein: lit, hot */
  vein: Object.freeze([PAL.leaf3, PAL.leaf4]),
  /** horn / fang / spike bone: root, shadow, mid, lit, tip */
  bone: Object.freeze([PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4]),
  /** the venom light: dark, glow, bright, hot */
  venom: Object.freeze([PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4]),
  /** the eye: socket, iris, hot core, glint */
  eye: Object.freeze([PAL.night0, PAL.gold3, PAL.gold4, PAL.white]),
  /** the mouth's inside: palate, throat (never crimson: that is player 2's) */
  mouth: Object.freeze([PAL.leaf0, PAL.night1]),
});

export interface VenomFx extends Record<string, number> {
  eye: number; squint: number; glint: number; drip: number; maw: number; glow: number; spit: number; spray: number; splash: number;
  form: number; skin: number; mist: number; ring: number; puddle: number; bubble: number; flicker: number; flow: number;
}
export const FX: VenomFx = Object.freeze({
  eye: 1, squint: 0, glint: 0, drip: 0.3, maw: 0, glow: 1, spit: 0, spray: 0, splash: 0,
  form: 1, skin: 1, mist: 0, ring: 0, puddle: 0, bubble: 0, flicker: 0, flow: 0,
}) as VenomFx;
