// Card art v3 — Fırtına Şövalyesi (windmane_knight, EARTH warrior, ace): the knight's bust in the gale — the
// barred great helm with its two gold eye-points (the focus), the huge tawny mane streaming back across the
// dusty sun, the lance raised on a diagonal with the pennon cracking at the top (style sheet
// docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// Sources of the subject. big = the bust painted NATIVELY at the cut-in's density (src/art/cutins-v3/windmane_knight.ts
// paintBust 'stream': the flat-topped great helm in 3/4 with its keel, eye slit, three grille bars, rivets and gold
// crest, the mane as five layered ribbons with forked tips, the raised lance head and its pennon) reduced 2:1 by the
// kit's palette-keeping reduce2x — never the 1× sprite upscaled; then a fresh 1-px ink outline, the EARTH rim, and the
// eye-points in the light layer. small = the sprite's own pixels hand-cropped to helm, mane and lance head (1×
// density, the grille eyes in the focus box), the ashen_drake pattern (not autoSmall).
// Ground: the kit's EARTH recipe with the low sun moved BEHIND THE HELM (the steel plate reads against the stepped
// warm disc) so the warm mane streams over the dark earth0 sky — the figure-ground split holds at both sizes.
// Living art: 4 frames × 180 ms — the mane's wave travels and the eye-points pulse (gold3 → gold4).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { NEUTRAL, NEUTRAL_MANE, W, H, drawKnight, type Pose } from '../monsters-v3/windmane_knight-rig';
import { ink, paintBackdrop, reduce2x, rim } from './_kit';
import { paintBust } from '../cutins-v3/windmane_knight';
import type { CardArtV3 } from './_types';

/** The card pose: lance raised close to the helm, the mane streaming, the pennon taut. */
function cardPose(f: number): Pose {
  return {
    ...NEUTRAL,
    lean: 1,
    chest: -1,
    hy: -1,
    gx: 67,
    gy: 49,
    la: -79,
    lb: 32,
    lf: 44,
    pen: 0,
    plen: 11,
    pph: f / 4,
    eyes: f % 2 ? 3 : 2,
    mane: { ...NEUTRAL_MANE, th: 190, curl: -12, amp: 2.6, ph: f / 4 },
  };
}

/** The posed sprite on its own frame (outline included). */
function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(W, H);
  drawKnight(p, cardPose(f), 'left');
  return p;
}

/** Remove the sprite's outer outline (ink touching transparency) so a fresh 1-px outline can be drawn. */
function stripOutline(p: PixelCanvas): PixelCanvas {
  const out = p.clone();
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y) !== PAL.ink) continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => !p.isOpaque(x + dx, y + dy));
      if (open) out.erase(x, y);
    }
  return out;
}

const GLOW = new Set<number>([PAL.gold3, PAL.gold4, PAL.white]);
/** The eye-point pixels of a crop, to repaint after the outline (the light layer). */
function glow(src: PixelCanvas): PixelCanvas {
  const o = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c !== null && GLOW.has(c)) o.set(x, y, c);
    }
  return o;
}

// crop box of the bust in sprite px (44×34): helm + mane + lance head
const BX = 35;
const BY = 3;
const BW = 44;
const BH = 34;
const crop = (f: number) => sprite(f).crop(BX, BY, BW, BH);

/** The big bust: the native cut-in-density painting (stream mode) reduced 2:1, cropped to the 88×68 window. */
function bust(f: number): PixelCanvas {
  const hi = new PixelCanvas(200, 144);
  paintBust(hi, f, -1, 'stream');
  const r = reduce2x(hi, { keep: [PAL.white, PAL.gold4, PAL.gold3], tie: 'dark' });
  return r.crop(8, 0, 88, 68);
}

const art: CardArtV3 = {
  id: 'windmane_knight',
  focus: [64, 26],
  focusSmall: [28, 18],
  frames: 4,
  holdMs: 180,
  big(l, f) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: [66, 28], horizon: 62, radius: 24 });
    const b = bust(f);
    l.subject.blit(stripOutline(b), 0, 0);
    ink(l.subject);
    rim(l.subject, PAL.earth3, { skip: [PAL.gold3, PAL.gold4, PAL.white, PAL.earth4, PAL.earth3] });
    l.light.blit(glow(b), 0, 0);
  },
  small(l, f) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: [36, 34], horizon: 62, radius: 22 });
    const c = crop(f);
    l.subject.blit(c, 0, 0);
    l.light.blit(glow(c), 0, 0);
  },
};
export default art;
