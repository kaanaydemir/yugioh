// Card art v3 — Kaya Baltacı (crag_axeman, EARTH barbarian): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR C7 "Kart resmi": "savuruşun tepesinde
// baltacı, balta başı doğan güneş gibi silüet").
//
// big (88×68)   the barbarian at the top of the swing, shouting the nara, from the raised crescent down to the knees,
//               drawn by the rig (its own pose, whole pixels, never scaled). The kit's EARTH recipe puts its low dusty
//               sun right behind the axe head: the crescent turns into a dark half-moon SILHOUETTE against the sun with
//               a burning earth4 rim on its edge — the axe head rising like the sun. The one brightest point: a white
//               glint on the edge's crown (the focus).
// small (44×34) the SAME picture, closer (KART_RESIMLERI §1): a 1:1 crop of the same sprite — the crescent on its sun,
//               the shouting head with the war paint, the raised fist.
// Living (4 frames, 170 ms): the edge glint grows and fades (1 px → 3-px cross → 1 px → none); the beard beads swing.
// Colours only from PAL (the rig and the kit).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { fillPoly } from '../rigkit';
import { drawAxeman, skeleton, BLADE_PTS, type Pose } from '../monsters-v3/crag_axeman-rig';
import { CARD_POSE } from '../monsters-v3/crag_axeman-anims';
import { axeUV } from '../monsters-v3/crag_axeman-kit';
import { paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** Where the sprite frame sits in the big picture (frame px → picture px 1:1). */
const BIG_AT = [6, 1] as const;
/** The small picture's crop of the sprite frame. */
/** The small picture: the frame moved by (−x, +y) — the crescent, the shouting head and the raised fist. */
const SMALL_AT = [-16, 0] as const;
const BEADS = [-1, 0, 1, 0] as const;
const GLINT = [1, 2, 1, 0] as const;

/** The dark half-moon: the axe head's stone tones pushed down (silhouette against the sun), its edge set alight. */
const SILHOUETTE: Readonly<Record<number, number>> = {
  [PAL.stone4]: PAL.stone2,
  [PAL.stone3]: PAL.stone1,
  [PAL.stone2]: PAL.stone1,
  [PAL.stone1]: PAL.stone0,
};

function frame(f: number): { p: PixelCanvas; o: Pose } {
  const o: Pose = { ...CARD_POSE, bead: BEADS[f % 4], glint: 0 };
  const p = new PixelCanvas(88, 88);
  drawAxeman(p, o, 'left');
  // the axe head's pixels (its polygon grown by the outline)
  const sk = skeleton(o);
  const inHead = new Uint8Array(88 * 88);
  fillPoly(BLADE_PTS.map(([u, v]) => axeUV(sk, u, v)), (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < 88 && y + dy < 88) inHead[(y + dy) * 88 + x + dx] = 1;
  });
  // ≤ 20 tones a picture: the beads' stone4 highlight joins stone3, the vines' leaf1 joins leaf0
  p.replace(PAL.stone4, PAL.stone3).replace(PAL.leaf1, PAL.leaf0);
  for (let y = 0; y < 88; y++)
    for (let x = 0; x < 88; x++) {
      if (!inHead[y * 88 + x]) continue;
      const c = p.get(x, y);
      if (c === null) continue;
      // the outer edge of the crescent (pixels touching the outside on the edge side) burns with the sun behind it
      const [nx, ny] = sk.nrm;
      const ox = Math.round(x + nx * 1.4);
      const oy = Math.round(y + ny * 1.4);
      const edge = c !== PAL.ink && (!p.isOpaque(ox, oy) || p.get(ox, oy) === PAL.ink);
      if (edge && c !== PAL.white) p.set(x, y, PAL.earth4);
      else if (SILHOUETTE[c] !== undefined) p.set(x, y, SILHOUETTE[c]);
    }
  return { p, o };
}

/** The edge crown in frame px (the glint, the focus). */
function crown(o: Pose): [number, number] {
  const [x, y] = axeUV(skeleton(o), 0, 11.2);
  return [Math.round(x), Math.round(y)];
}
const CROWN = crown(CARD_POSE);
/** The focus in BIG px and in SMALL px. */
const FOCUS = [CROWN[0] + BIG_AT[0], CROWN[1] + BIG_AT[1]] as const;
const FOCUS_SMALL = [CROWN[0] + SMALL_AT[0], CROWN[1] + SMALL_AT[1]] as const;

function glint(light: PixelCanvas, x: number, y: number, g: number): void {
  if (g <= 0) return;
  light.set(x, y, PAL.white);
  if (g > 1) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) light.set(x + dx, y + dy, PAL.white);
}

function big(l: ArtLayers, f: number): void {
  // the low sun centred on the crescent (the recipe draws it 4 px below the focus: the head rises out of it)
  paintBackdrop(l.backdrop, 'EARTH', { focus: [FOCUS[0], FOCUS[1] + 4], radius: 22 });
  const { p } = frame(f);
  l.subject.blit(p, BIG_AT[0], BIG_AT[1]);
  rim(l.subject, PAL.earth3, { skip: [PAL.white, PAL.earth4, PAL.fire2, PAL.fire4] });
  glint(l.light, FOCUS[0], FOCUS[1], GLINT[f % 4]);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: [FOCUS_SMALL[0] * 2, FOCUS_SMALL[1] * 2 + 4], radius: 24, horizon: 60 });
  const { p } = frame(f);
  l.subject.blit(p, SMALL_AT[0], SMALL_AT[1]);
  rim(l.subject, PAL.earth3, { skip: [PAL.white, PAL.earth4, PAL.fire2, PAL.fire4] });
  glint(l.light, FOCUS_SMALL[0], FOCUS_SMALL[1], Math.min(1, GLINT[f % 4]));
}

const art: CardArtV3 = {
  id: 'crag_axeman',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
export { FOCUS, FOCUS_SMALL };
