// Çelik Susturucu (steel_silencer) — v3 art on the biped body plan. WORK IN PROGRESS: the leading '_'
// keeps it out of the registry until the art is done; the final file is ./steel_silencer.ts.
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
  distinction: { silhouette: 'wip', rhythm: 'wip', idle: 'wip', guard: 'wip', signaturePart: 'wip', material: 'wip', signatureMove: 'wip' },
};

export default planArt(biped, SILENCER);
