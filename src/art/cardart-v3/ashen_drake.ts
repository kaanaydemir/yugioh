// Card art v3 — Kül Ejderi (ashen_drake, DARK dragon), rev. 3: "the vulture before the eclipse"
// (docs/v3/kart-a/ashen_drake.md §7.1, style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// big   88×68: the FINAL sprite's idle f0 pixels 1:1 (src/art/monsters-v3/ashen_drake.ts, P1 light), so the card
//       is the board monster (KART_RESIMLERI §5: a v3 monster's big picture is its approved frame 1:1). Crop: the
//       whole hood and its claw spur (the inverted U is the silhouette), the S-neck and the hanging skull in the
//       right third with 8 px of air in front of the beak, the rib cage with the heart; the far cloak's back edge
//       bleeds off the left decisively (no tangent), the legs off the bottom. The sprite's arena rim (void2 on
//       the outer contour) is relit to the DARK card light's void3 (§3); the plate texture's 2×2 checkers are
//       resolved in the card's copy (§10). Added: an ash heap the cloak's hem sinks into (bottom left, stepped
//       stone2 / stone1 / stone0 with two buried embers); the ash streams (R1, blowing RIGHT): plate chips torn
//       off the hood's front edge drifting right across the eclipse in three loose streams with ember chips,
//       above the neck so the air in front of the eye stays clear; the eye a 2-px slit.
//       The brightest point is the heart (the sprite's fire4 knot round ONE gold4).
// small 44×34, the SAME composition (§1 "small made from big, then patched"): the big subject 2:1 (kit
//       reduceSubject), then by hand: the cloak repainted in clean bands (the reduction turns the 1-px plate
//       texture into a dapple) — the far cloak a value darker behind a stone0 crease, the near cloak stone3 lit
//       band / stone2 body / stone1 turn / void3 rim with staggered 4-px plate scallops; the rib cage redrawn
//       (RIBS_SMALL: bars, ember gaps, the heart a fire4 knot round ONE gold4); the eye one fire3 pixel in a
//       stone0 socket; the flakes and embers placed natively at 1×. Never autoSmall.
// Backdrop: the kit's DARK recipe — the void eclipse centred 4 px behind the heart (§2: the light shape frames
// the focus), wide (r 44): its stepped corona rings the whole drake — up the hood's back, through the arch of the
// neck and behind the hanging skull — so the silhouette reads against the light; no floor (the drake perches
// over the void). One frame per size (the game blits only the small f0; the heartbeat lives on the board).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import art from '../monsters-v3/ashen_drake';
import { paintBackdrop, patch, reduce2x, reduceSubject } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

/** sprite px → big px */
const OX = -19;
const OY = -6;

let SPRITE: PixelCanvas | null = null;
function sprite(): PixelCanvas {
  if (!SPRITE) {
    const p = new PixelCanvas(art.w, art.h);
    art.draw(p, 'idle', 0, { lightFrom: 'left' });
    // the arena rim (void2 just inside the outer outline) → the DARK card light's void3 (KART_RESIMLERI §3)
    const outerInk = (x: number, y: number) => p.get(x, y) === PAL.ink && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !p.isOpaque(x + a, y + b));
    const hits: number[] = [];
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) if (p.get(x, y) === PAL.void2 && (outerInk(x + 1, y) || outerInk(x, y + 1) || outerInk(x - 1, y) || outerInk(x, y - 1))) hits.push(x, y);
    for (let i = 0; i < hits.length; i += 2) p.set(hits[i], hits[i + 1], PAL.void3);
    SPRITE = p;
  }
  return SPRITE;
}

const HEART: V = [56 + OX, 59 + OY];
/** the sprite's eye pixel (fire3), big px */
const EYE: V = [85 + OX, 53 + OY];

/** the heap's top line (big px), left → right: it rises under the hem and falls away under the rib cage */
const HEAP: V[] = [[-1, 60], [4, 58], [9, 57], [14, 58], [19, 60], [24, 62], [28, 65], [30, 68]];

function heapTop(x: number): number {
  for (let i = 0; i < HEAP.length - 1; i++) {
    const [x0, y0] = HEAP[i];
    const [x1, y1] = HEAP[i + 1];
    if (x >= x0 && x <= x1) return Math.round(y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0));
  }
  return 99;
}

function paintHeap(): PixelCanvas {
  const h = new PixelCanvas(88, 68);
  for (let x = 0; x < 30; x++) {
    const t = heapTop(x);
    const lump = (x * 7) % 11 < 2 ? -1 : 0; // ragged crest
    for (let y = t + lump; y < 68; y++) {
      const d = y - (t + lump);
      h.set(x, y, d < 2 ? PAL.stone2 : d < 5 ? PAL.stone1 : PAL.stone0);
    }
  }
  return h.outline(PAL.ink);
}

/**
 * The ash streams (R1 "kanatlarından kül akar", blowing RIGHT): flakes torn off the hood's flaking front edge,
 * drifting right and a little up across the eclipse in three loose streams, big near the hood (3×2 plates with a
 * lit corner), smaller and sparser as they go (2×2, 2×1). The air in front of the eye stays clear (they stay
 * above the neck). A flake is a plate chip, flat stone2 with a stone3 lit corner; airborne particles ride the
 * light layer with the embers (an effect, like the cinematic's ash motes: never outlined, IŞ-9).
 */
const FLAKES: readonly (readonly [number, number, number, number])[] = [
  // stream 1 (off the crown)
  [47, 9, 3, 2], [53, 8, 2, 2], [58, 6, 2, 1], [64, 5, 2, 1], [71, 4, 2, 1],
  // stream 2 (off the hood's front)
  [46, 17, 3, 2], [52, 15, 2, 2], [57, 14, 2, 1], [63, 12, 2, 1], [70, 11, 2, 1], [77, 9, 2, 1],
  // stream 3 (off the lower front, above the neck)
  [48, 25, 3, 2], [54, 23, 2, 2], [60, 21, 2, 1], [67, 19, 2, 1],
];
function paintStreams(): PixelCanvas {
  const c = new PixelCanvas(88, 68);
  for (const [x, y, w, h] of FLAKES) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.set(x + i, y + j, PAL.stone2);
    if (w * h >= 4) c.set(x, y, PAL.stone3);
    if (w * h >= 6) c.set(x + w - 1, y + h - 1, PAL.stone1);
  }
  return c;
}

/** embers riding the streams and smouldering in the heap (light layer, never outlined): 2×1 fire chips */
const EMBERS: readonly [number, number, number][] = [
  [60, 10, PAL.fire2], [66, 16, PAL.fire1], [51, 20, PAL.fire2], [8, 60, PAL.fire2], [17, 62, PAL.fire1],
];

/**
 * Resolve the 2×2 two-colour checkers of the sprite's plate texture in the card's copy (KART_RESIMLERI §10:
 * ≤ 0.5 % of the window): the lower-right pixel of a checker takes its left neighbour's tone. Outline (ink)
 * stair-steps are left as drawn.
 */
function dechecker(p: PixelCanvas): void {
  for (let pass = 0; pass < 3; pass++)
    for (let y = 0; y + 1 < p.h; y++)
      for (let x = 0; x + 1 < p.w; x++) {
        const a = p.get(x, y);
        const b = p.get(x + 1, y);
        if (a === null || b === null || a === b || a === PAL.ink || b === PAL.ink) continue;
        if (p.get(x, y + 1) === b && p.get(x + 1, y + 1) === a) p.set(x + 1, y + 1, b);
      }
}

function paintBig(l: ArtLayers): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: [HEART[0] - 4, HEART[1] - 4], radius: 44, horizon: 68 });
  l.subject.blit(sprite(), OX, OY);
  dechecker(l.subject);
  l.light.blit(paintStreams(), 0, 0);
  l.subject.blit(paintHeap(), 0, 0);
  for (const [x, y, c] of EMBERS) l.light.set(x, y, c).set(x + 1, y, c);
  // the eye: the sprite's fire3 pixel opened into a 2-px slit toward the front
  l.light.set(EYE[0] + 1, EYE[1], PAL.fire2);
}

/** small: where the far cloak ends (its crease column) per row */
const farLine = (y: number): number => (y < 11 ? 10 : y < 15 ? 9 : 8);
/** a scallop's tone: one step down; in the shade (stone1) the plates sink into the shadow (no stripes) */
const DARKER: Record<number, number> = { [PAL.stone3]: PAL.stone2, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone1, [PAL.stone0]: PAL.stone0 };

/**
 * The cloak of the small picture repainted by hand rule (the 2:1 reduction turns the sprite's 1-px plate
 * texture into a dapple): the far cloak one value darker behind a stone0 crease, the near cloak in clean
 * bands lit from the top left (stone3 lit band, stone2 body, stone1 turn, the void3 rim), and the plates as
 * staggered 4-px scallops (a U of the next darker tone), every 4th row.
 */
function repaintCloak(p: PixelCanvas): void {
  for (let y = 2; y <= 28; y++) {
    let xL = -1;
    for (let x = 0; x < 24; x++) if (p.get(x, y) === PAL.ink && p.isOpaque(x + 1, y) && p.get(x + 1, y) !== PAL.ink) { xL = x; break; }
    if (xL < 0) continue;
    let xR = xL + 1;
    while (xR < 24 && p.get(xR, y) !== PAL.ink) xR++;
    // the hood's right outline (skip inner ink: the far crease and the hem)
    // (where the neck joins the hood there is no outline: the edge continues the rows above / below)
    let edge = -1;
    for (let x = xR; x < 26; x++) if (p.get(x, y) === PAL.ink && (x >= 21 || !p.isOpaque(x + 1, y))) { edge = x; break; }
    xR = edge >= 0 ? edge : y < 17 ? 21 : 23;
    const fl = farLine(y);
    for (let x = xL + 1; x < xR; x++) {
      if (x >= 16 && y >= 23) continue; // the rib cage
      let c: number;
      if (x < fl) c = x === xL + 1 ? PAL.stone2 : PAL.stone1;
      else if (x === fl) c = PAL.stone0;
      else {
        const rel = (x - fl) / Math.max(1, xR - fl);
        c = y <= 3 || rel < 0.2 ? PAL.stone3 : rel < 0.62 ? PAL.stone2 : PAL.stone1;
        if (x === xR - 1 && y > 3) c = PAL.void3;
      }
      // the plate scallops (staggered courses)
      if (c !== PAL.void3 && c !== PAL.stone0) {
        const course = Math.floor((y - 2) / 4);
        const ly = (y - 2) % 4;
        // a 3-px dash on the course's last row and a 1-px dip under its middle (the rounded lower edge):
        // never a diagonal pair, so never a 2×2 checker
        const m = (x + (course % 2) * 2) % 4;
        const mp = (x + ((course + 1) % 2) * 2) % 4; // the course above, seen from its next row
        if ((ly === 3 && m <= 2) || (ly === 0 && y > 2 && mp === 1 && x > fl)) c = DARKER[c];
      }
      p.set(x, y, c);
    }
  }
}

const SKEY: Record<string, number> = {
  k: PAL.ink, '0': PAL.stone0, '1': PAL.stone1, '2': PAL.stone2, '3': PAL.stone3, d: PAL.void3, n: PAL.night0,
  f: PAL.fire1, g: PAL.fire2, h: PAL.fire3, i: PAL.fire4, G: PAL.gold4,
};
/** the rib cage of the small picture (x 16…23, y 23…31) */
const RIBS_SMALL: readonly string[] = [
  'k333322d',
  'knggghnd',
  'k3hiih3d',
  'khiGiigd',
  'k3hiih3d',
  'knggg2nd',
  'k333333d',
  'knhhgn3d',
  'knnnnn3d',
];
const SMALL_FLAKES: readonly V[] = [[24, 4], [29, 3], [24, 8], [29, 7], [35, 6], [26, 12], [32, 11]];
const SMALL_EMBERS: readonly [number, number, number][] = [[30, 5, PAL.fire2], [26, 10, PAL.fire2], [4, 30, PAL.fire2], [9, 31, PAL.fire1]];

function paintSmall(l: ArtLayers, _f: number, big: ArtLayers): void {
  l.backdrop.blit(reduce2x(big.backdrop, { min: 1, tie: 'first' }), 0, 0);
  const body = new PixelCanvas(88, 68);
  body.blit(sprite(), OX, OY);
  body.blit(paintHeap(), 0, 0);
  const s = reduceSubject(body);
  repaintCloak(s);
  dechecker(s);
  // the rib cage by hand: bars and ember-lit gaps, the heart a fire4 knot round ONE gold4 (the focus)
  patch(s, RIBS_SMALL, SKEY, 16, 23);
  // the eye: one fire3 pixel in a stone0 socket
  s.set(32, 23, PAL.stone0).set(34, 23, PAL.stone0);
  l.subject.blit(s, 0, 0);
  for (const [x, y] of SMALL_FLAKES) l.light.set(x, y, PAL.stone2).set(x + 1, y, PAL.stone2);
  l.light.set(33, 23, PAL.fire3);
  for (const [x, y, c] of SMALL_EMBERS) l.light.set(x, y, c);
}

const ashenArt: CardArtV3 = {
  id: 'ashen_drake',
  focus: HEART,
  big: paintBig,
  small: paintSmall,
};
export default ashenArt;
