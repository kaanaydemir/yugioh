// Kum Saati Cücesi (hourglass_imp) — v3 art on biped v1 (A4 batch 2). WORK IN PROGRESS: the underscore keeps
// the registry from reading it; the finished art is this file renamed to hourglass_imp.ts.
//
// A small pointy-hatted gnome-wizard carrying an oversized hourglass staff whose sand FLOWS all the time and
// FREEZES mid-fall when it casts. Files (this directory):
//   hourglass_imp-build.ts   frame 68×64, anchor (26, 58), the build on biped v1 (lithe preset, near foot ahead),
//                            the member's channels (fx: sand, level, freeze, glow, eye, hat / beard / hem lag,
//                            staff lag, spray, ring, dissolve / build, …)
//   hourglass_imp-kit.ts     ramps (sky / gold / skin / beard / wood), flat value planes cut from a shape by the
//                            frame's light (so the relit P2 sheet puts its lit plane on the other side), the
//                            relight of ASCII maps, seams
//   hourglass_imp-glass.ts   the staff: the shaft + the 13 × 23 hourglass (rigid, four orientations) and the SAND
//                            computed in screen space (gravity right in every orientation): the funnel dip, the
//                            heap, the stream through the neck marching a pixel a frame, frozen as still drops
//   hourglass_imp-parts.ts   the part painters (hat, face, beard, robe, arms + expressive hands, boots, staff,
//                            light, the sand dissolve / build, the heap, the grains)
//   hourglass_imp-anims.ts   every anim as hand-keyed beats and holds, marks, regions
// Distinction card below (A3_MIMARI §3.4): it reads against the three heavy biped members (sentinel, titan and
// the golem draft) and the hand-made magus.

import { v1 as biped } from '../bodyplans/biped';
import type { BipedMember } from '../bodyplans/biped/v1';
import { planArt } from '../bodyplans/types';
import { BUILD, FRAME, FX, MATERIALS, type ImpFx } from './hourglass_imp-build';
import { ANIMS } from './hourglass_imp-anims';
import { PARTS, staffOf } from './hourglass_imp-parts';

/** The glass's centre (the staff's head), whatever the orientation: spells, sparks and the cast leave from here. */
const glass = (rig: Parameters<typeof staffOf>[0], fx: Readonly<ImpFx>) => {
  const g = staffOf(rig, fx);
  return g ? { x: g.centre[0], y: g.centre[1] } : { x: Math.round(rig.armN.end[0]), y: Math.round(rig.armN.end[1]) };
};

export const IMP: BipedMember<ImpFx> = {
  id: 'hourglass_imp',
  tier: 'normal',
  frame: FRAME,
  build: BUILD,
  materials: MATERIALS,
  fx: FX,
  parts: PARTS,
  anims: ANIMS,
  weight: 'light',
  knock: 'pose',
  p2: 'relight',
  points: {
    // the cast leaves the glass; the thrown sand leaves the far hand's fingertips (fx.muz 1 on the attack's release)
    muzzle: (rig, p) => (p.fx.muz >= 0.5 ? { x: Math.round(rig.armF.end[0]) + 2, y: Math.round(rig.armF.end[1]) } : glass(rig, p.fx)),
    staff: (rig, p) => glass(rig, p.fx),
    core: (rig) => ({ x: Math.round(rig.chest[0]), y: Math.round(rig.chest[1]) }),
    head: (rig) => ({ x: Math.round(rig.head[0]), y: Math.round(rig.head[1]) }),
    hand: (rig) => ({ x: Math.round(rig.armN.end[0]), y: Math.round(rig.armN.end[1]) }),
    grip: (rig) => ({ x: Math.round(rig.armF.end[0]), y: Math.round(rig.armF.end[1]) }),
  },
  distinction: {
    silhouette:
      'a small, light, narrow figure (idle f0 ≈ 36 × 47 px, ≈ 950 px: the smallest of the biped members) under a tall bent sky-blue ' +
      'hat whose tip hooks back to the left, a round head with a big nose and a long white beard, a bell of robe on two short boots, ' +
      'and a LONG staff held out in front and leaning forward whose head — an oversized gold hourglass 13 × 23 px — stands higher than ' +
      'the hat. Sentinel: a stone block with a shield slab; titan: a hunched brute with boulders; golem: a barrel on a spout; magus: a ' +
      'tall dark cloak with a floating orb',
    rhythm:
      '"tik-tak" (tick-tock): even little 130–170 ms ticks and then a STOP — the sand halts and everything round it goes on moving. ' +
      'Attack: crouch (the sand freezes) 80, haul the glass up 90, the longest hold 150 with the far fist cocked and the ring of grains ' +
      'opening, a 50 ms whip, a 60 ms smeared release (a lunge, the far hand flung open, a fan of grains), 60 contact, then time ' +
      'resumes (90 / 100 / 110 / 120 / 130 recovery). Roar: tap, tap (100 / 80), a 60 ms flip of the glass overhead, a 240 ms hold ' +
      'upside down. Hit 50 / 55 / 90 / 100 / 110. Sentinel: slow single-block moves; titan: escalating holds into a stomp',
    idle:
      '12 f, 1.74 s, holds 130–170 ms: a PENDULUM — the chest rocks one way and back (the leader), the head one frame later, the hat\'s ' +
      'bent tip and the beard swing against it two frames behind (overshoot), the robe\'s hem a frame after that, the glass on its staff ' +
      'two frames late; the stream of sand marches through the neck on its own 3-frame period (1 px a frame) and the heap\'s apex ' +
      'flickers, the glass glints once a loop, the far hand idly pinches a grain (a 4-frame word) and the eyes blink once; the feet ' +
      'never move. Sentinel: a ripple of stone blocks; titan: the core\'s swell; magus: a float',
    guard:
      '6 f, 0.94 s, holds 150–170 ms: the TIME SHIELD — crouched behind the planted staff held in BOTH hands in front of the chest, ' +
      'the hat pulled low, the brows furrowed, one eye narrowed; the sand is FROZEN (the glass is dead still and pulses 1.2 → 1.8 ' +
      'while the stream hangs as white drops), a slow breath and the hat sways a pixel. Titan: crossed forearms; sentinel: the ' +
      'planted tower shield',
    signaturePart:
      'the hourglass: a bronze-gold frame (gold2 body, one gold3 lit edge, gold1 shade) round water-blue glass with pale-gold sand ' +
      '(gold4 lit surface, gold3 body, gold2 shade) — computed in screen space, so the surface dips at the funnel, the heap rises in ' +
      'the lower bulb and the stream marches through the neck; it freezes into a string of still white drops when the imp casts, ' +
      'turns on its side / upside down in the roar and the victory, drains as the imp dies and refills as it is revived',
    material:
      'sky-blue cloth (water ramp: water3 lit | water2 | water1 shade, creases water1 / water0), gold trim and hardware (gold ramp), skin, ' +
      'a white beard (white | mist | steel), leather boots and a wooden shaft (earth ramp); flat planes cut from each shape by the ' +
      'frame\'s light, no gradient. It dies as SAND: each 2 × 2 cluster turns gold, lets go and falls as a grain into a heap at the ' +
      'staff\'s foot (top first, the glass drains); it is summoned out of a heap poured onto the floor (feet first) and revived by ' +
      'running that backwards. Titan: basalt + lava; sentinel: moss stone + rune gold; magus: violet cloth + slate',
    signatureMove:
      '"Zamanı Durdur" (stop the clock): the sand FREEZES in the glass, the imp hauls the glass up and winds back with a pinch of ' +
      'frozen time in the far fist while a ring of grains hangs round the glass, whips round and LUNGES — the far hand flung out ' +
      'open (points().muzzle on its fingertips on the release), the staff levelled, a fan of gold grains thrown — and time starts ' +
      'again as the sand drops and the hat\'s tip overshoots forward. Special: the same freeze standing, the staff raised, a ring of ' +
      'grains flung off the glass at the foe. Never a swing of a weapon (sentinel / titan) and never an orb thrown (magus)',
  },
};

export default planArt(biped, IMP);
