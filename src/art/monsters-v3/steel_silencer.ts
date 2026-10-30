// Çelik Susturucu (steel_silencer) — v3 art on the biped body plan (registered: under ?look=v3
// monsterArt('steel_silencer') is this art). Build ./steel_silencer-build.ts, parts ./-parts.ts, maps ./-maps.ts,
// kit ./-kit.ts, anims ./-anims.ts.
import { v1 as biped } from '../bodyplans/biped';
import type { BipedMember } from '../bodyplans/biped/v1';
import { planArt } from '../bodyplans/types';
import { BUILD, FRAME, FX, MATERIALS, type SilencerFx } from './steel_silencer-build';
import { ANIMS, MARKS } from './steel_silencer-anims';
import { PARTS, coneAt, placesOf, wristOf } from './steel_silencer-parts';
import { SIGIL_AT } from './steel_silencer-maps';

export const SILENCER: BipedMember<SilencerFx> = {
  id: 'steel_silencer',
  tier: 'normal',
  frame: FRAME,
  build: BUILD,
  materials: MATERIALS,
  fx: FX,
  parts: PARTS,
  anims: ANIMS,
  weight: 'heavy',
  knock: 'pose',
  p2: 'relight',
  marks: MARKS,
  passes: { death: 'crumble', revive: 'reassemble' },
  points: {
    core: (rig, p) => { const d = placesOf(rig, p.fx).chest; return { x: SIGIL_AT[0] + d[0], y: Math.min(rig.ground, SIGIL_AT[1] + d[1]) }; },
    head: (rig, p) => { const d = placesOf(rig, p.fx).hood; return { x: 51 + d[0], y: Math.min(rig.ground, 28 + d[1]) }; },
    muzzle: (rig, p) => { const w = wristOf(rig, p.fx, 'N'); const c = coneAt(w.wrist, w.dir, 0); return { x: c.mouth[0], y: Math.min(rig.ground, c.mouth[1]) }; },
    hand: (rig, p) => { const w = wristOf(rig, p.fx, 'N'); return { x: w.wrist[0], y: Math.min(rig.ground, w.wrist[1]) }; },
    grip: (rig, p) => { const w = wristOf(rig, p.fx, 'F'); const c = coneAt(w.wrist, w.dir, 0); return { x: c.mouth[0], y: Math.min(rig.ground, c.mouth[1]) }; },
  },
  distinction: {
    silhouette:
      'upright and tall (idle f0 about 54×73 with the stacks): a hood-plated head sunk between two squat shoulder drums, ' +
      'two exhaust stacks rising BEHIND the far shoulder (a rear-heavy back, a clear front), long straight piston legs ' +
      '(pelvis 31 px up), the near (forward) arm the big one with the silencing cone hanging at the thigh. Titan: hunched, ' +
      'boulders over the head; sentinel: a square block behind a tower shield; golem: a barrel on a spout',
    rhythm:
      '"mandal" (the ratchet): EVEN 90 ms clicks that lock a pixel each, one long 160 ms hydraulic hold, a 40 ms swing, a ' +
      '60 ms thrust and a recovery that unwinds 110 / 120 / 130 / 140 — attack charge → release 570 ms (titan 720 ramping, ' +
      'sentinel 1 120 labour), release → recover 240 ms. Roar "Sus!": 90 inhale, 140 gather, 60 swing, 110 shush, then three ' +
      'ring beats; hit 50 / 60 / 110 / 70 with the visor stuttering (recover at 290 ms); hitHeavy steps the REAR (far) foot ' +
      'back; hitMagic strobes the eye while scan rows tear the body',
    idle:
      '12 f, 1.9 s, two 200 ms dwells, 150 otherwise: the pressure breath runs chest → hood → abdomen rings → near drum → far ' +
      'drum and unwinds in the same order — one plate a frame, never the whole figure; the arms ride a pixel late; the visor ' +
      'eye sweeps front-ward and back and blinks once; the chest sigil swells with the breath; two stacks smoke on their own ' +
      'loop; the feet never move',
    guard:
      '"Sessizlik Kalkanı", 6 f, 1.0 s: hunkered, the NEAR forearm raised with the cone facing the foe, three standing arcs of ' +
      'rings in front of it that shimmer a click at a time, the far arm braced at the thigh, the visor narrowed to a slit, the ' +
      'sigil burning. Titan: crossed forearms; sentinel: planted shield',
    signaturePart:
      'the silencing cone: a bronze bell at the end of a telescoping steel rod, a magenta emitter lens in its mouth that pulses ' +
      'rings (attack thrust, roar shush, guard ward, victory); with the single violet visor eye and the chest mute sigil as the ' +
      'only light',
    material:
      'bronze plates (earth ramp: T/L/M/R/D bands by pixel place) over dark blue steel (night1…steel) — both keyed by ROLE letters ' +
      'so the P2 sheet swaps lit and shaded planes plate by plate; pistons are band-shaded tubes with groove rings; light is ' +
      'violet (eye) and magenta (sigil, lenses, rings) after the outline. It dies as a failing machine: overload flare, the visor ' +
      'and sigil go out, the knees give, the plates crack along a Voronoi network and drop (rigkit crumble in metal tones); it ' +
      'is summoned as a BOOT: folded and dark, hydraulics hiss, it stands, the visor ignites last',
    signatureMove:
      '"Susturma Darbesi": the near palm drawn back by the ribs and ratcheted, a long hold with steam ticking off the stacks, then ' +
      'a level palm-thrust with the rod telescoping 5–6 px out of its sleeve and a silence ring leaving the cone ' +
      '(points().muzzle = the cone mouth). Roar = the shush: the raised cone before the visor, three rings rolling out. ' +
      'Never a fist (titan, golem), never a thrown rock (sentinel)',
  },
};

export default planArt(biped, SILENCER);
