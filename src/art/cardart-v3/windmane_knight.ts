// Card art v3 — Fırtına Şövalyesi (windmane_knight, EARTH warrior, ace): the knight's bust in the gale — the
// barred great helm with its two gold eye-points (the focus), the huge tawny mane streaming back across the
// dusty sun, the lance raised on a diagonal with the pennon cracking at the top (style sheet
// docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// Source of the subject: the sprite rig itself (src/art/monsters-v3/windmane_knight-rig.ts drawKnight) in a card
// pose (lance raised nearly upright beside the helm, the mane streaming with a full wave, a short pennon so it
// never crosses the grille). small = the sprite's own pixels hand-cropped to helm, mane and lance head (1× density,
// the grille eyes in the focus box; the 16×12 mini reads "blue-white helm blob + orange wedge + one gold dot"),
// the ashen_drake pattern (not autoSmall); big = the SAME bust at 2×
// density through the edge-preserving Scale2x (EPX) rule after the sprite's outline is stripped, then a fresh
// 1-px ink outline, the EARTH rim, and the eye-points repainted native in the light layer.
// Ground: the kit's EARTH recipe (earth0 sky, a stepped earth2 / earth3 low sun behind the mane, stone0 floor):
// the steel-blue plate reads against the warm dusk, the mane's lit edge against the sun's dark step.
// Living art: 4 frames × 180 ms — the mane's wave travels and the eye-points pulse (gold3 → gold4).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { NEUTRAL, NEUTRAL_MANE, W, H, drawKnight, type Pose } from '../monsters-v3/windmane_knight-rig';
import { ink, paintBackdrop, rim } from './_kit';
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

/** Scale2x / EPX: each pixel becomes 2×2, corners rounded by the neighbours (transparent counts as a colour). */
function epx(src: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(src.w * 2, src.h * 2);
  const at = (x: number, y: number) => (src.inBounds(x, y) ? src.get(x, y) : null);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      let e0 = p;
      let e1 = p;
      let e2 = p;
      let e3 = p;
      if (c === a && c !== d && a !== b) e0 = a;
      if (a === b && a !== c && b !== d) e1 = b;
      if (d === c && d !== b && c !== a) e2 = c;
      if (b === d && b !== a && d !== c) e3 = d;
      for (const [k, col] of [[0, e0], [1, e1], [2, e2], [3, e3]] as [number, number | null][]) if (col !== null) out.set(x * 2 + (k & 1), y * 2 + (k >> 1), col);
    }
  return out;
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

const art: CardArtV3 = {
  id: 'windmane_knight',
  focus: [56, 36],
  focusSmall: [28, 18],
  frames: 4,
  holdMs: 180,
  big(l, f) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: [40, 34], horizon: 60, radius: 26 });
    const c = crop(f);
    l.subject.blit(epx(stripOutline(c)), 0, 0);
    ink(l.subject);
    rim(l.subject, PAL.earth3, { skip: [PAL.gold3, PAL.gold4, PAL.white, PAL.earth4, PAL.earth3] });
    l.light.blit(epx(glow(c)), 0, 0);
  },
  small(l, f) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: [40, 34], horizon: 60, radius: 26 });
    const c = crop(f);
    l.subject.blit(c, 0, 0);
    l.light.blit(glow(c), 0, 0);
  },
};
export default art;
