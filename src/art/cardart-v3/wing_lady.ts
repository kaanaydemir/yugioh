// Card art v3 — Kanat Hanımı (wing_lady, WIND winged beast): the swordswoman's bust in the salute — the kestrel
// wings raised in a tall "V" that fills the top of the window, the leaf blade rising diagonally in front of her
// brow, the ONE green jewel on the circlet as the focus (style sheet docs/v3/KART_RESIMLERI.md, contract
// ./_types.ts).
//
// Source of the subject: the sprite rig itself (src/art/monsters-v3/wing_lady-rig.ts drawWingLady) in a card
// pose. small = the sprite's own pixels hand-cropped to wings, head and blade (1× density; the 16×12 mini reads
// "warm light V across the top + a dark head with one green pixel + a dark green body block"), the windmane /
// ashen_drake pattern (not autoSmall); big = the SAME bust at 2× density through the edge-preserving Scale2x
// (EPX) rule after the sprite's outline is stripped, then a fresh 1-px ink outline, the WIND rim (leaf3) and the
// jewel repainted in the light layer.
// Ground: the kit's WIND recipe (night0 / leaf0 sky, the stepped leaf "gust" arcs wrapping the focus, open to the
// right): the warm wings read against the cool dark green, the green bodice against the dark night band.
// Living art: 4 frames × 160 ms — the braid and the sash travel, the wings breathe one step, the jewel pulses.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BRAID0, NEUTRAL, SASH0, WING_FAR0, WING_NEAR0, W, H, drawWingLady, type Pose } from '../monsters-v3/wing_lady-rig';
import { ink, paintBackdrop, rim } from './_kit';
import type { CardArtV3 } from './_types';

/** The card pose: the salute — wings high, the blade across in front of the brow, the jewel lit. */
function cardPose(f: number): Pose {
  const t = f / 4;
  return {
    ...NEUTRAL,
    chest: -1,
    gx: 43,
    gy: 33,
    sa: -66,
    wn: { ...WING_NEAR0, a: -124 - (f % 2), len: 29, bend: -14, chord: 11 },
    wf: { ...WING_FAR0, a: -82 + (f % 2), len: 25, bend: -8 },
    braid: { ...BRAID0, ph: t, amp: 1.6 },
    sash: { ...SASH0, ph: t + 0.5 },
    jewel: 2,
  };
}

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(W, H);
  drawWingLady(p, cardPose(f), 'left');
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

const GLOW = new Set<number>([PAL.leaf4, PAL.gold4]);
/** The jewel pixels of a crop, to repaint after the outline (the light layer). */
function glow(src: PixelCanvas): PixelCanvas {
  const o = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c !== null && GLOW.has(c)) o.set(x, y, c);
    }
  return o;
}

// crop box of the bust in sprite px (44×34): wings, head, blade, the bodice to the belt
const BX = 14;
const BY = 3;
const BW = 44;
const BH = 34;
const crop = (f: number) => sprite(f).crop(BX, BY, BW, BH);

const art: CardArtV3 = {
  id: 'wing_lady',
  focus: [50, 36],
  focusSmall: [25, 18],
  frames: 4,
  holdMs: 160,
  big(l, f) {
    paintBackdrop(l.backdrop, 'WIND', { focus: [50, 36], horizon: 60, radius: 28 });
    const c = crop(f);
    l.subject.blit(epx(stripOutline(c)), 0, 0);
    ink(l.subject);
    rim(l.subject, PAL.leaf3, { skip: [PAL.leaf4, PAL.gold4, PAL.white, PAL.earth4, PAL.leaf3] });
    l.light.blit(epx(glow(c)), 0, 0);
  },
  small(l, f) {
    paintBackdrop(l.backdrop, 'WIND', { focus: [50, 36], horizon: 60, radius: 28 });
    const c = crop(f);
    l.subject.blit(c, 0, 0);
    l.light.blit(glow(c), 0, 0);
  },
};
export default art;
