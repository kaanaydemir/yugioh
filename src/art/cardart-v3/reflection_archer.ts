// Card art v3 — Yansıyan Okçu (reflection_archer, LIGHT): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C4 "Gece gölünde ok atan okçu, alt
// yarıda ters yansıma ve yansımanın farklı yöne bakan gözleri").
//
// big (88×68)   the archer at full draw on the still night lake, the light arrow blazing at the bow (the brightest
//               point, the LIGHT halo sits behind it); under the water line its inverted dark-blue reflection, also
//               at full draw — but its two white eyes are turned OUT, at the viewer.
// small (44×34) the SAME picture, closer: a 1:1 crop of hood, crown, the drawn bow and the arrow point, the water
//               line and the top of the reflection under it.
// Living (4 frames, 160 ms): the arrow pulses, the lake's light line drifts, the reflection's eyes blink once.
// Colours only from PAL (the sprite, the reflection map and the backdrop recipe).

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { GY, RX, W as SW, H as SH, drawArcher, drawMirrorFigure, pose, skeleton, type Pose } from '../monsters-v3/reflection_archer-rig';
import { ink, paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The water line (BIG px) and where the archer's root stands on it. */
const LAKE = 49;
const FEET_X = 36;
const DX = FEET_X - RX;
const DY = LAKE - GY;
/** The reflection's foreshortening in the picture (deeper than the sprite's puddle: a lake shows more). */
const KR_CARD = 0.44;
/** The sprite frame's crop that is the small picture (big px → small px 1:1). */
const SMALL_CROP = [FEET_X - 15, 2, 44, 34] as const;

const cardPose = (f: number): Pose =>
  pose({
    py: 1, lean: 0, hdx: 1, bx: 15, by: -37, ba: 0, draw: 1, bowFront: 1, nx: 3, ny: -39,
    arrow: f % 2 ? 2.5 : 3, eye: 2, bowG: 2.5, crownG: 2.5, gem: 2, hairY: 1, cloth: -1,
    hair: (f % 4) / 4, pud: 0, rv: 0, rip: -1, mote: -1, t: f / 4,
  });

const SPT = skeleton(cardPose(0)).apt;
const FOCUS = [Math.round(SPT[0] + DX - 0.5), Math.round(SPT[1] + DY - 0.5)] as const;
const FOCUS_SMALL = [FOCUS[0] - SMALL_CROP[0], FOCUS[1] - SMALL_CROP[1]] as const;

/** The archer's light spilled on the lake: iso rings round the feet (the sprite's puddle, opened wide). */
function rings(s: PixelCanvas, f: number): void {
  for (const [r, c] of [[0.42, PAL.mist], [0.7, PAL.steel], [0.97, PAL.night4]] as const) {
    const rx = (13 + (f % 4)) * r * 3;
    const ry = rx * 0.32;
    const n = Math.round(rx * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(FEET_X + Math.cos(a) * rx);
      const y = Math.round(LAKE + 1 + Math.sin(a) * ry);
      if (x >= 0 && x < 88 && y > LAKE && y < 68 && !s.isOpaque(x, y)) s.set(x, y, c);
    }
  }
}

function subject(s: PixelCanvas, f: number): void {
  const o = cardPose(f);
  // the reflection under the water line (its eyes turned to the viewer; shut on f2)
  const m = new PixelCanvas(SW, SH);
  drawMirrorFigure(m, { ...o, look: 1, eye: f === 2 ? 0 : 2, lid: f === 2 ? 2 : 0 }, 'left', KR_CARD);
  s.blit(m, DX, DY);
  const a = new PixelCanvas(SW, SH);
  drawArcher(a, o, 'left');
  s.blit(a, DX, DY);
}

function lake(p: PixelCanvas, f: number, w: number, y0: number, h: number): void {
  // still water: a night band with one drifting line of light on it (under the subject)
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, y === y0 ? PAL.steel : PAL.night1);
  const lx = (f % 4) * 2;
  for (const [x0, y, n] of [[4 + lx, y0 + 3, 12], [52 - lx, y0 + 6, 9], [20 + lx, y0 + 12, 7]] as const)
    for (let x = x0; x < x0 + n && x < w; x++) if (y < h) p.set(x, y, PAL.night3);
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'LIGHT', { focus: FOCUS, horizon: 68, radius: 17 });
  lake(l.backdrop, f, 88, LAKE, 68);
  subject(l.subject, f);
  ink(l.subject);
  rings(l.subject, f);
  const [fx, fy] = FOCUS;
  l.light.rect(fx, fy - 1, 2, 3, PAL.white);
  for (const [dx, dy] of [[3, 0], [-2, 0], [0, -3], [0, 3]] as const) l.light.set(fx + dx, fy + dy, PAL.gold4);
}

function small(l: ArtLayers, f: number): void {
  const [cx, cy, w, h] = SMALL_CROP;
  paintBackdrop(l.backdrop, 'LIGHT', { focus: FOCUS_SMALL, horizon: 40, radius: 10 });
  lake(l.backdrop, f, w, LAKE - cy, h);
  const s = new PixelCanvas(88, 68);
  subject(s, f);
  l.subject.blit(s.crop(cx, cy, w, h), 0, 0);
  ink(l.subject);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white).set(fx + 1, fy, PAL.white).set(fx + 2, fy, PAL.gold4);
}

const art: CardArtV3 = {
  id: 'reflection_archer',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
