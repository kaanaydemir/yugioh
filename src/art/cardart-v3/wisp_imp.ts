// Card art v3 — Tüy Hayalet (wisp_imp, DARK imp): a close-up bust of the puffball with its huge eyes
// (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts). PROTOTYPE like its siblings: not wired
// (src/art/cardface-v3/index.ts registers no artwork yet).
//
// Source of the subject: the sprite rig itself (src/art/monsters-v3/wisp_imp-rig.ts drawWisp), posed alert:
// eyes wide, pupils up-and-forward at the viewer's right, crest tufts up, tail plume swaying, three feathers
// adrift. small = the sprite's own pixels, cropped to the head and shoulders (1× density, hand-placed so the
// crest keeps 2 px of air and the eyes sit in the focus box). big = the SAME bust redrawn at 2× density:
// every pixel goes through the edge-preserving Scale2x (EPX) rule — flat bands stay flat bands, diagonals get
// their half steps, no 2×2 blocks on a contour — the sprite's old outline is stripped first and a fresh 1-px
// PAL.ink outline (kit ink) is run round the new silhouette; the eyes' 1-px glints are repainted at native
// density. Ground: the kit's DARK recipe (eclipse crown behind the head, ink floor).
// Light: one key light top left (the rig's `lightFrom: 'left'`); the shadow-side rim is the recipe's void3.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawWisp, pose, CX, CY, W, H, paintFeather } from '../monsters-v3/wisp_imp-rig';
import { ink, paintBackdrop, rim } from './_kit';
import type { CardArtV3 } from './_types';

const T = (dx: number, dy: number) => ({ dx, dy });

/** The posed sprite on its own frame (outline included). */
function sprite(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  drawWisp(
    p,
    pose({
      by: -1,
      h: 1,
      lookX: 2,
      lookY: -1,
      pup: 2,
      tuft: [T(-1, 1), T(1, 2), T(1, 1)],
      tail: 3,
      tailX: 1,
      seed: 5,
    }),
    'left',
  );
  return p;
}

/** Crop (x0, y0, w, h) of the sprite into a fresh canvas. */
function crop(src: PixelCanvas, x0: number, y0: number, w: number, h: number): PixelCanvas {
  return src.crop(x0, y0, w, h);
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
      const eq = (u: number | null, v: number | null) => u === v;
      let e0 = p;
      let e1 = p;
      let e2 = p;
      let e3 = p;
      if (eq(c, a) && !eq(c, d) && !eq(a, b)) e0 = a;
      if (eq(a, b) && !eq(a, c) && !eq(b, d)) e1 = b;
      if (eq(d, c) && !eq(d, b) && !eq(c, a)) e2 = c;
      if (eq(b, d) && !eq(b, a) && !eq(d, c)) e3 = d;
      for (const [k, col] of [[0, e0], [1, e1], [2, e2], [3, e3]] as [number, number | null][]) {
        if (col !== null) out.set(x * 2 + (k & 1), y * 2 + (k >> 1), col);
      }
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

// crop box of the bust in sprite px (CX,CY = body centre): head, crest, shoulders, the tail plume's tip
const BX = CX - 22;
const BY = CY - 24;
const BW = 42;
const BH = 34;

const art: CardArtV3 = {
  id: 'wisp_imp',
  focus: [58, 38],
  focusSmall: [29, 19],
  big(l) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [48, 36], horizon: 56, radius: 26 });
    const bust = epx(stripOutline(crop(sprite(), BX, BY, BW, BH)));
    l.subject.blit(bust, 2, 2);
    ink(l.subject);
    rim(l.subject, PAL.void3, { skip: [PAL.white, PAL.mag4, PAL.mag3, PAL.void4] });
    // adrift feathers (light: never outlined)
    paintFeather(l.light, 8, 14, 0);
    paintFeather(l.light, 74, 12, 1, true);
    paintFeather(l.light, 70, 56, 2);
  },
  small(l) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [48, 36], horizon: 56, radius: 26 });
    l.subject.blit(crop(sprite(), BX, BY, BW, BH), 1, 1);
    paintFeather(l.light, 4, 7, 0);
    paintFeather(l.light, 36, 6, 1, true);
  },
};
export default art;
