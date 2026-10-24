// Motion LOD of the v3 card (lane A6-A, step A1; docs/v3/A6_PLAN.md §4.1 "Kart nesnesi", K3 / K5 /
// K6): while a card turns, flies or tips over in the 3D raster, fine detail resampled every frame
// turns into crawling noise (`z-normal.png` #2–#3). The in-between frames use a SIMPLIFIED face
// instead — the card's frame, a flat 3-tone block of its portrait, and plain blocks for the name
// strip and the text box: big flat shapes turn, no fine-detail noise. The resting card keeps its
// real face (A5-B's `card:face:<id>`, S-13); only motion frames use the LOD.
//
//   lodFace(id)        48×68 motion face of a card, derived from its current face (cards.ts)
//   lodMip(id)         { levels, edge } for the pose renderer: LOD face 48×68, 24×34, + the card's
//                      own 18×26 mini level (the board icon), the card's stock edge
//   lodBackMip(p)      the owner-toned v3 back for motion: cards.ts's cardMip('back', p)
//
// Derived on first use and cached (≈ 20 cards × (48×68 + 24×34) × 4 B ≈ 0,33 MB). The face regions
// are the fixed card layout both the v1 face and A5-B's v3 face keep (A5_PLAN §3.7.1: name plate
// (2,2) 35×8, art (2,17) 44×34, text box (2,52) 44×14), so the LOD follows A5-B's face by itself.

import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import { cardFaceCanvas, cardMip, type CardMip } from '../../art/cards';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { rasterCard } from './cardRaster';

/** The face regions of the 48×68 card (A5_PLAN §3.7.1; today's face uses the same). */
export const FACE_REGIONS = Object.freeze({
  name: { x: 2, y: 2, w: 35, h: 8 },
  art: { x: 2, y: 17, w: 44, h: 34 },
  text: { x: 2, y: 52, w: 44, h: 14 },
});

/** Relative luminance-ish value of a colour (0..255), for tone bands. */
function lum(c: number): number {
  return 0.3 * ((c >> 16) & 255) + 0.55 * ((c >> 8) & 255) + 0.15 * (c & 255);
}

/** The most frequent opaque colour of a region (ties: the first met). */
function modeColour(p: PixelCanvas, x: number, y: number, w: number, h: number, skip?: (c: number) => boolean): number | null {
  const n = new Map<number, number>();
  let best: number | null = null;
  let bestN = 0;
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const c = p.get(xx, yy);
      if (c === null || (skip && skip(c))) continue;
      const k = (n.get(c) ?? 0) + 1;
      n.set(c, k);
      if (k > bestN) {
        bestN = k;
        best = c;
      }
    }
  return best;
}

/**
 * The portrait as a flat 3-tone block: its pixels split into three luminance bands, each band
 * painted in its most frequent colour, in 4×4 cells (the cell takes the band most of its pixels
 * fall in). Big flat shapes that keep the picture's colour and silhouette.
 */
function flatPortrait(face: PixelCanvas, out: PixelCanvas, r: { x: number; y: number; w: number; h: number }): void {
  const px: { c: number; l: number }[] = [];
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const c = face.get(x, y);
      if (c !== null) px.push({ c, l: lum(c) });
    }
  if (!px.length) return;
  const sorted = px.map((q) => q.l).sort((a, b) => a - b);
  const t1 = sorted[Math.floor(sorted.length / 3)];
  const t2 = sorted[Math.floor((sorted.length * 2) / 3)];
  const band = (l: number) => (l < t1 ? 0 : l < t2 ? 1 : 2);
  // the most frequent colour of each band
  const counts: Map<number, number>[] = [new Map(), new Map(), new Map()];
  for (const q of px) {
    const m = counts[band(q.l)];
    m.set(q.c, (m.get(q.c) ?? 0) + 1);
  }
  const tone = counts.map((m) => {
    let best: number = PAL.night1;
    let bn = -1;
    for (const [c, k] of m) if (k > bn) [best, bn] = [c, k];
    return best;
  });
  if (counts[1].size === 0) tone[1] = tone[0];
  if (counts[2].size === 0) tone[2] = tone[1];
  const CELL = 4;
  for (let cy = r.y; cy < r.y + r.h; cy += CELL)
    for (let cx = r.x; cx < r.x + r.w; cx += CELL) {
      const votes = [0, 0, 0];
      const cw = Math.min(CELL, r.x + r.w - cx);
      const ch = Math.min(CELL, r.y + r.h - cy);
      for (let y = cy; y < cy + ch; y++)
        for (let x = cx; x < cx + cw; x++) {
          const c = face.get(x, y);
          if (c !== null) votes[band(lum(c))]++;
        }
      const b = votes[2] > votes[1] && votes[2] > votes[0] ? 2 : votes[1] >= votes[0] ? 1 : 0;
      out.rect(cx, cy, cw, ch, tone[b]);
    }
}

/**
 * The 48×68 motion face of `face` (any card face in the fixed layout): the outer two rings (outline
 * + trim / bevel) as they are, the frame body flat in its most frequent tone, the name plate as a
 * flat strip with one bright bar, the portrait as a flat 3-tone block in an ink frame, the text box
 * flat with two bars.
 */
export function deriveLodFace(face: PixelCanvas): PixelCanvas {
  const W = face.w;
  const H = face.h;
  const out = face.clone();
  const { name, art, text } = FACE_REGIONS;
  const inRegion = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  // frame body: everything inside the two rings and outside the three regions → one flat tone
  const isFrame = (x: number, y: number) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2 && !inRegion(x, y, name) && !inRegion(x, y, art) && !inRegion(x, y, text);
  const frameTones = new Map<number, number>();
  let body: number | null = null;
  let bodyN = 0;
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      if (!isFrame(x, y)) continue;
      const c = face.get(x, y);
      if (c === null) continue;
      const k = (frameTones.get(c) ?? 0) + 1;
      frameTones.set(c, k);
      if (k > bodyN) [body, bodyN] = [c, k];
    }
  if (body !== null) for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (isFrame(x, y) && face.isOpaque(x, y)) out.set(x, y, body);
  // name plate: its own most frequent tone + one bar in its brightest frequent tone
  const plate = modeColour(face, name.x, name.y, name.w, name.h) ?? PAL.night0;
  const plateBar = modeColour(face, name.x, name.y, name.w, name.h, (c) => lum(c) <= lum(plate) + 24) ?? PAL.mist;
  out.rect(name.x, name.y, name.w, name.h, plate);
  out.hline(name.x + 3, name.x + Math.round(name.w * 0.62), name.y + Math.floor(name.h / 2), plateBar);
  // portrait: 3-tone flat block inside a 1-px ink frame
  flatPortrait(face, out, art);
  out.frame(art.x, art.y, art.w, art.h, PAL.ink);
  // text box: flat + two bars
  const box = modeColour(face, text.x, text.y, text.w, text.h) ?? PAL.night0;
  out.rect(text.x, text.y, text.w, text.h, box);
  const line = lum(box) < 60 ? PAL.night3 : PAL.night1;
  out.hline(text.x + 3, text.x + text.w - 8, text.y + 4, line);
  out.hline(text.x + 3, text.x + Math.round(text.w * 0.6), text.y + 8, line);
  return out;
}

const faceCache = new Map<CardId, PixelCanvas>();
const mipCache = new Map<CardId, CardMip>();

/** The 48×68 motion face of card `id` (derived from cards.ts's face on first use, cached). */
export function lodFace(id: CardId): PixelCanvas {
  let p = faceCache.get(id);
  if (!p) {
    p = deriveLodFace(cardFaceCanvas(id));
    faceCache.set(id, p);
  }
  return p;
}

/**
 * The pose renderer's sources for card `id` in motion: the LOD face at 48×68 and 24×34, and the
 * card's own 18×26 mini level (its board icon), with the card's stock edge (as cardMip(id)).
 */
export function lodMip(id: CardId): CardMip {
  let m = mipCache.get(id);
  if (!m) {
    const real = cardMip(id);
    const full = lodFace(id);
    m = { levels: [full, rasterCard(full, 24, 34), real.levels[real.levels.length - 1]], edge: real.edge };
    mipCache.set(id, m);
  }
  return m;
}

/** The owner-toned back in motion: the back is already flat shapes, so its own mip (S-2). */
export function lodBackMip(player: PlayerId): CardMip {
  return cardMip('back', player);
}

/** Drop the caches (the faces changed, e.g. A5-B's living art switched source). */
export function resetLodCaches(): void {
  faceCache.clear();
  mipCache.clear();
}
