// Card art v3 — Kalkan Devi (shield_titan, EARTH warrior): a close-up of the wall waking (style sheet
// docs/v3/KART_RESIMLERI.md, contract ./_types.ts; design docs/v3/oturum-f/shield_titan.md §5).
//
// Source of the subject: the sprite rig itself (src/art/monsters-v3/shield_titan-rig.ts drawTitan), posed as the ward
// waking (the sunstone open, the first iris ring, the bottom course lit). small = the sprite's own pixels cropped to
// the bust (the bald head and white beard on the left, the four fingers hooked over the arched rim, the tall copper
// face with the boss), then corrected by hand (the eye, the brow, a 1-px air row over the fingers); big = the SAME
// bust redrawn at 2× density through the edge-preserving Scale2x (EPX) rule — flat bands stay bands, diagonals get half
// steps — after the sprite's outline is stripped and a fresh 1-px PAL.ink outline is run round the new silhouette;
// the light (sunstone, iris ring, lit course, the copper glint) is repainted after the outline, never outlined.
// Ground: the kit's EARTH recipe; rim earth3. The 16×12 mini card reads: a copper bar, a gold dot, a white blob.
// Living (2 frames, 260 ms): the sunstone breathes (core ↔ white-hot) and the iris ring steps out.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { W, H, drawTitan, pose } from '../monsters-v3/shield_titan-rig';
import { ink, paintBackdrop, patch, recolor, rim } from './_kit';
import type { CardArtV3 } from './_types';

/** The posed sprite on its own frame (outline included), lit from the left. */
function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(W, H);
  drawTitan(p, pose({ boss: f % 2 ? 3 : 2, iris: f % 2 ? 2 : 1, courses: 1, glint: 1, gx: 2, cy: -1, bx: 1, nu: 24 }), 'left');
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

// crop box of the bust in sprite px (44 × 34): the head at the left third, the boss right of centre
const BX = 18;
const BY = 15;
const BW = 44;
const BH = 34;
/** Light tones (painted after the outline, never outlined). */
const LIGHT = new Set<number>([PAL.gold3, PAL.gold4]);

/** The card's tighter palette (≤ 20 tones with the backdrop): the deepest bronze, skin crease and beard seam fold into
 *  their neighbours, the copper glint into the light's white-gold. */
const MERGE: Readonly<Record<number, number>> = { [PAL.gold0]: PAL.earth0, [PAL.skin0]: PAL.earth0, [PAL.stone2]: PAL.stone3, [PAL.fire4]: PAL.gold4 };

function split(src: PixelCanvas): { body: PixelCanvas; light: PixelCanvas } {
  recolor(src, MERGE);
  const body = src.clone();
  const light = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c !== null && LIGHT.has(c)) {
        light.set(x, y, c);
        body.set(x, y, PAL.gold1);
      }
    }
  return { body, light };
}

/** Hand corrections of the small picture (1× density): the eye's white catch-light and the brow's tuft. */
const EYE_PATCH = ['bw', 'ik'];
const EYE_KEY = { b: PAL.white, w: PAL.stone4, i: PAL.ink, k: PAL.skin1 } as const;

const art: CardArtV3 = {
  id: 'shield_titan',
  focus: [59, 51],
  focusSmall: [29, 25],
  frames: 2,
  holdMs: 260,
  big(l, f) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: [62, 40], horizon: 54 });
    const { body, light } = split(sprite(f).crop(BX, BY, BW, BH));
    l.subject.blit(epx(stripOutline(body)), 0, 0);
    ink(l.subject);
    rim(l.subject, PAL.earth3, { skip: [PAL.white, PAL.gold2, PAL.fire3] });
    l.light.blit(epx(light), 0, 0);
  },
  small(l, f) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: [62, 40], horizon: 54 });
    const { body, light } = split(sprite(f).crop(BX, BY, BW, BH));
    l.subject.blit(body, 0, 0);
    patch(l.subject, EYE_PATCH, EYE_KEY, 12, 16);
    l.light.blit(light, 0, 0);
  },
};
export default art;
