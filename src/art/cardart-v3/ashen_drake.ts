// Card art v3 — Kül Ejderi (ashen_drake, DARK dragon): a close-up of the growl — the heavy horned head held low,
// the jaws open on the ember throat, the cracks glowing up the neck (style sheet docs/v3/KART_RESIMLERI.md,
// contract ./_types.ts). Registered like its siblings: the painter file exists and is judged by its test
// (src/art/cardface-v3/index.ts wires no artwork yet).
//
// Source of the subject: the sprite rig itself (src/art/monsters-v3/ashen_drake-rig.ts drawDrake), posed as the roar
// (ashen_drake-anims.ts roar f5 / f6). small = the sprite's own pixels cropped to the head and neck (1× density,
// hand-placed so the eye sits in the focus box and the horn keeps 2 px of air); big = the SAME bust redrawn at 2×
// density through the edge-preserving Scale2x (EPX) rule — flat bands stay flat bands, diagonals get half steps,
// no 2×2 blocks on a contour — after the sprite's old outline is stripped and a fresh 1-px PAL.ink outline is run
// round the new silhouette; the ember (eye, throat, spill) is repainted native after the outline. Ground: the kit's
// DARK recipe (eclipse crown behind the head, ink floor): the charcoal hide reads against the violet void.
// Light: one key light top left (the rig's `lightFrom: 'left'`); the rim is the recipe's void3.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawDrake } from '../monsters-v3/_ashen_legacy/ashen_drake-rig';
import { drawPose } from '../monsters-v3/_ashen_legacy/ashen_drake-anims';
import { W, H, setLight } from '../monsters-v3/_ashen_legacy/ashen_drake-gbuf';
import { ink, paintBackdrop, rim } from './_kit';
import type { CardArtV3 } from './_types';

/** The posed sprite on its own frame (outline included). */
function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(W, H);
  setLight('left');
  drawDrake(p, drawPose('roar', f));
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

// crop box of the bust in sprite px: the eye lands near (26, 12) of the 44×34 window
const BX = 94;
const BY = 52;
const BW = 44;
const BH = 34;
const EMBER = new Set<number>([PAL.fire2, PAL.fire3, PAL.fire4, PAL.white]);

/** The ember pixels of a crop (eye, throat, spill), to repaint after the outline. */
function ember(src: PixelCanvas): PixelCanvas {
  const o = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const c = src.get(x, y);
    if (c !== null && EMBER.has(c)) o.set(x, y, c);
  }
  return o;
}

const art: CardArtV3 = {
  id: 'ashen_drake',
  focus: [52, 24],
  focusSmall: [26, 12],
  frames: 2,
  holdMs: 220,
  big(l, f) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [44, 30], horizon: 52, radius: 26 });
    const crop = sprite(5 + (f % 2)).crop(BX, BY, BW, BH);
    l.subject.blit(epx(stripOutline(crop)), 2, 2);
    ink(l.subject);
    rim(l.subject, PAL.void3, { skip: [PAL.white, PAL.fire2, PAL.fire3, PAL.fire4] });
    l.light.blit(epx(ember(crop)), 2, 2);
  },
  small(l, f) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [44, 30], horizon: 52, radius: 26 });
    const crop = sprite(5 + (f % 2)).crop(BX, BY, BW, BH);
    l.subject.blit(crop, 0, 0);
    l.light.blit(ember(crop), 0, 0);
  },
};
export default art;
