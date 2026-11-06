// Kum Saati Cücesi (hourglass_imp) v3 — the shell (docs/v3/oturum-f/hourglass_imp.md). A hand-built rig (not a body
// plan): a stubby desert imp with one floppy maroon felt cone, a big nose, one long swept-back ear and gold pin-point
// eyes, standing beside an hourglass TALLER than his body — the sand always trickling through its neck is the card's
// heartbeat. Rig: ./hourglass_imp-rig.ts (+ ./hourglass_imp-glass.ts, the glass and its screen-space sand), anims:
// ./hourglass_imp-anims.ts, card art: ../cardart-v3/hourglass_imp.ts.
//
// Distinction (vs C2 dial_jester, the other small LIGHT Büyücü with a time theme; docs §0.9 rev. 1 #3): C2 holds a
// DISC (dial, coin) in front of himself under a two-pointed jester hat, in curled shoes, and his time runs BACKWARD;
// the imp stands beside a VERTICAL X planted on the floor, under ONE soft felt cone that flops, in flat wrapped
// sandals, and his time STOPS (hitMagic: the sand freezes, then drops in a lump). Vs lumen_sprite / volt_lizard: only
// the warm light is shared — no wings, no tail; maroon + indigo + dark wood are nowhere else on the roster.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/hourglass_imp';
import { renderArt } from '../cardart-v3/_kit';
import { AX, GY, H, W, drawImp } from './hourglass_imp-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, frameJoints, framePoints, framePose } from './hourglass_imp-anims';

const art: MonsterArt = {
  id: 'hourglass_imp', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: 22, y: 49 },
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'light', p2: 'relight',
  draw(p: PixelCanvas, a: MonsterAnim, f: number, o?: DrawOpts) { drawImp(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, a: MonsterAnimExtra, f: number, o?: DrawOpts) { drawImp(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  points(a: AnyMonsterAnim, f: number): MonsterPoints { return framePoints(a, f); },
  joints(a: AnyMonsterAnim, f: number) { return frameJoints(a, f); },
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
};
export default art;
