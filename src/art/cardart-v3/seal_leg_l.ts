// Card art v3 — Sol Bacak Mührü (seal_leg_l, DARK sealed relic): the colossus' left leg kneeling low across the floor of the
// window — the big round knee plate (bronze rim, the bent-knee glyph at its centre) at the eclipse, the thigh climbing up and
// out of the top-left corner (the broken hip is out of the picture), the shin lying along the floor to the left with its bronze
// ankle shackle, and the drag chain running out of the left edge (style sheet docs/v3/KART_RESIMLERI.md, set design: the "Seal
// Eclipse" backdrop shared by the five Beş Mühür cards).
//
// Source of the subject: big (88×68) is the leg RE-DRAWN at the picture's own density, 2× the sprite's coordinates, by the
// dense painter (monsters-v3/seal_leg_l-dense.ts: fresh polygons, the glyph as strokes of the right thickness, re-built chain
// links) — never the 1× sprite enlarged. small (44×34) = the SAME leg closer at the sprite's own 1× density: the knee plate, the
// shin and the shackle, a 1:1 crop of the rig (seal_leg_l-rig.ts drawLeg) put on the floor. Ground: the kit's DARK recipe (eclipse
// centre fixed at big (44, 28) / small (22, 14)) plus the set's five short stepped rays at the pentagon angles; the picture's
// own ray tip (126°) carries a 2-px seal spark; the "pentad" corner glyph (five dots on a pentagon, the card's own vertex hot)
// sits top left. Light: the failing-lamp glyph and one chain clink spark are the living loop (4 frames, 170 ms). Colours only
// from PAL.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import { drawLeg, pose } from '../monsters-v3/seal_leg_l-rig';
import { DENSE0, paintLegDense, type Dense } from '../monsters-v3/seal_leg_l-dense';
import { BACKDROPS, paintBackdrop, spikes } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The knee plate / glyph in BIG px (within 6 px of the eclipse centre (44, 28)) and in SMALL px. */
const FOCUS = [60, 40] as const;
const FOCUS_SMALL = [22, 16] as const;
const RAY_ANGLES = [-90, -18, 54, 126, 198] as const;
const MY_VERTEX = 3;

/** The failing lamp, one frame each: glyph level and the chain clink. */
const LOOP = [
  { lv: 3, clink: 0 },
  { lv: 3, clink: 1 },
  { lv: 2, clink: 0 },
  { lv: 4, clink: 0 },
] as const;

function backdrop(p: PixelCanvas): void {
  paintBackdrop(p, RECIPE, { focus: [44, 28], horizon: 48, rays: false });
  spikes(p, 44, 28, 5, 31, 38, 2.4, PAL.water1, -90);
}

/** The pentad corner glyph: five dots on a pentagon, the card's own vertex (leg_l, 4th clockwise) hot. */
function pentad(l: PixelCanvas, small: boolean): void {
  const cx = small ? 4 : 7;
  const cy = small ? 4 : 7;
  const r = small ? 2 : 3;
  RAY_ANGLES.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    l.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), i === MY_VERTEX ? PAL.mag4 : PAL.mag2);
  });
}

/** This card's own ray tip: a 2-px seal spark on the first free pixel along the ray. */
function sparkTip(l: PixelCanvas, subject: PixelCanvas, small: boolean): void {
  const a = (RAY_ANGLES[MY_VERTEX] * Math.PI) / 180;
  const cx = small ? 22 : 44;
  const cy = small ? 14 : 28;
  for (let r = small ? 17 : 34; r < (small ? 24 : 48); r += 1) {
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    if (!subject.isOpaque(x, y) && !subject.isOpaque(x - 1, y) && !subject.isOpaque(x, y + 1) && x > 2 && y < (small ? 31 : 65)) {
      l.set(x, y, PAL.mag3);
      l.set(x - 1, y, PAL.mag3);
      return;
    }
  }
}

function big(l: ArtLayers, f: number): void {
  const L = LOOP[f % 4];
  backdrop(l.backdrop);
  const d: Dense = { ...DENSE0, lv: L.lv, spill: 2, seam: 1, noHip: false, foot: true, links: 6, sag: 2, lift: L.clink ? 1 : 0, sparks: L.clink ? [[17, 49]] : [], motes: [] };
  const q = new PixelCanvas(88, 68);
  paintLegDense(q, lightOf('left'), 1.25, [60, 40], d, l.light);
  l.subject.blit(q, 0, 0);
  pentad(l.light, false);
  sparkTip(l.light, l.subject, false);
}

function small(l: ArtLayers, f: number): void {
  const L = LOOP[f % 4];
  backdrop(l.backdrop);
  const q = new PixelCanvas(44, 34);
  // the same leg closer, 1:1: the knee plate on the eclipse, the shin and the shackle along the floor, the thigh leaving the corner
  drawLeg(q, pose({ dx: -44, dy: -34, lv: L.lv, seam: 0, spill: 2, floor: 0, ce: null, cn: 0, hop: -1, sparks: L.clink ? [[3, 22]] : [], motes: [], dust: [] }), 'left');
  l.subject.blit(q, 0, 0);
  pentad(l.light, true);
  sparkTip(l.light, l.subject, true);
}

/** This card's accent colour (water): the set backdrop (eclipse, five rays, pentad) stays, its corona / horizon / rays take the piece's hue. */
const RECIPE = { ...BACKDROPS.DARK, tones: [PAL.water0, PAL.water1, PAL.water2, PAL.night0], horizonLine: PAL.water1, rim: PAL.water2 };

const art: CardArtV3 = {
  id: 'seal_leg_l',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
