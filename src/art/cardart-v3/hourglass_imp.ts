// Card art v3 — Kum Saati Cücesi (hourglass_imp, LIGHT spellcaster): the imp at his hourglass, close (style sheet
// docs/v3/KART_RESIMLERI.md, contract ./_types.ts; design docs/v3/oturum-f/hourglass_imp.md §6).
//
// Source of the subject: the sprite rig itself (src/art/monsters-v3/hourglass_imp-rig.ts drawImp), posed leaning in
// to his glass, cheek to the upper bulb, the stream through the neck lit (the brightest point and the focus). small =
// the sprite's own pixels cropped to the imp + glass (the floppy maroon cone runs off the top-left corner, the glass's
// foot off the bottom), then corrected by hand (a white catch-light in the near eye, the neck's stream doubled so it
// survives the 16×12 mini card); big = the SAME crop redrawn at 2× density through the edge-preserving Scale2x (EPX)
// rule after the sprite's outline is stripped, with a fresh 1-px PAL.ink outline round the new silhouette; the light
// (the stream, the landing grain, the eyes) is repainted after the outline, never outlined.
// Ground: a night-desert recipe (a moon ring behind the glass; no sun disc — the light is the sand's). The 16×12 mini card reads: a red
// triangle upper left, a gold X right, a skin dot between them.
// Living (4 frames, 180 ms): the stream's dash marches down the neck and the landing grain hops.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { W, H, drawImp, pose } from '../monsters-v3/hourglass_imp-rig';
import { ink, paintBackdrop, patch, recolor, rim, type BackdropRecipe } from './_kit';
import type { CardArtV3 } from './_types';

/** The posed sprite on its own frame (outline included), lit from the left. */
function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(W, H);
  drawImp(p, pose({ hx: 1, lean: 1, tx: -1, ty: 1, eye: 0, mouth: 1, nhy: 50, glint: 1 }, { ph: f, hot: f % 2 }), 'left');
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

// crop box in sprite px (44 × 34): the imp's face left of centre, the glass's neck right of centre
const BX = 6;
const BY = 25;
const BW = 44;
const BH = 34;
/** Light tones (painted after the outline, never outlined). */
const LIGHT = new Set<number>([PAL.gold3, PAL.gold4]);
/** The card's tighter palette (≤ 20 with the backdrop): the deepest skin and felt creases fold into the dark wood, the
 *  skin shade and the brass shade into the light wood, the coat's lit plane into its mid, the nose glint into the light. */
const MERGE: Readonly<Record<number, number>> = {
  [PAL.skin0]: PAL.earth0, [PAL.skin4]: PAL.gold4, [PAL.night4]: PAL.night3, [PAL.fire0]: PAL.earth0, [PAL.gold1]: PAL.earth2, [PAL.skin1]: PAL.earth2,
};

function split(src: PixelCanvas): { body: PixelCanvas; light: PixelCanvas } {
  recolor(src, MERGE);
  const body = src.clone();
  const light = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c !== null && LIGHT.has(c)) {
        light.set(x, y, c);
        body.set(x, y, PAL.night1);
      }
    }
  return { body, light };
}

/** The night-desert ground: a moon ring (mist) behind the glass that rims its dark frame, night sky, a dark floor — it
 *  shares its tones with the subject's coat and glass (the colour budget) and leaves the sand the only warm light. */
const NIGHT: BackdropRecipe = {
  kind: 'LIGHT', shape: 'eclipse', tones: [PAL.night2, PAL.night3, PAL.mist], sky: [PAL.night0, PAL.night1], split: 30,
  floor: PAL.ink, horizonLine: PAL.night2, rim: PAL.night3,
};

/** Hand corrections of the small picture: a white catch-light in the near eye. */
const EYE_PATCH = ['w'];
const EYE_KEY = { w: PAL.white } as const;

const art: CardArtV3 = {
  id: 'hourglass_imp',
  focus: [62, 44],
  focusSmall: [31, 22],
  frames: 4,
  holdMs: 180,
  big(l, f) {
    paintBackdrop(l.backdrop, NIGHT, { focus: [64, 30], horizon: 60 });
    const { body, light } = split(sprite(f).crop(BX, BY, BW, BH));
    l.subject.blit(epx(stripOutline(body)), 0, 0);
    ink(l.subject);
    rim(l.subject, PAL.night3, { skip: [PAL.gold2, PAL.mist] });
    l.light.blit(epx(light), 0, 0);
  },
  small(l, f) {
    paintBackdrop(l.backdrop, NIGHT, { focus: [64, 30], horizon: 60 });
    const { body, light } = split(sprite(f).crop(BX, BY, BW, BH));
    l.subject.blit(body, 0, 0);
    patch(l.subject, EYE_PATCH, EYE_KEY, 20, 15);
    l.light.blit(light, 0, 0);
  },
};
export default art;
