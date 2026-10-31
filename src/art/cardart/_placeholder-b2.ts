// Placeholder emblems for the batch-2 spells (docs/v3/YENI_KARTLAR.md §7) while they have no artwork: the
// generic spell backdrop of src/art/cards.ts fallbackArt + one big readable sign per card, so the eleven new
// spells are told apart in the hand, on the field and in the inspect panel. Palette only, whole pixels, a
// 1-px ink outline. Real artworks (src/art/cardart/<id>.ts or cardart-v3) replace these automatically.

import type { CardId } from '../../data/cards';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { CARD_ART_H, CARD_ART_W } from '../types';

type Painter = (l: PixelCanvas) => void;

const W = PAL.white;
const PAINTERS: Partial<Record<CardId, Painter>> = {
  // Kuyu Kovası: a bucket with a rope and a spill
  well_pail: (l) => {
    l.poly([[14, 12], [30, 12], [28, 28], [16, 28]], PAL.earth3);
    l.hline(14, 30, 12, PAL.earth4);
    l.hline(16, 28, 20, PAL.earth1);
    l.line(14, 12, 22, 3, PAL.stone3);
    l.line(30, 12, 22, 3, PAL.stone3);
    l.rect(16, 13, 12, 2, PAL.water4);
    l.disc(32, 22, 1, PAL.water4);
  },
  // Kukla İpi: a cross bar with five strings
  puppet_string: (l) => {
    l.rect(9, 6, 26, 3, PAL.earth3);
    l.rect(20, 3, 3, 9, PAL.earth3);
    for (const x of [11, 16, 22, 28, 33]) l.vline(x, 9, 28 - Math.abs(x - 22) / 2, PAL.mist);
  },
  // Boşluk Gözü: a black eye with a violet ring
  void_eye: (l) => {
    l.poly([[5, 17], [14, 9], [22, 7], [30, 9], [39, 17], [30, 25], [22, 27], [14, 25]], PAL.void2);
    l.disc(22, 17, 7, PAL.void4);
    l.disc(22, 17, 4, PAL.ink);
    l.set(20, 15, W);
  },
  // Süpürge Rüzgarı: three sweeping gusts
  sweeping_gale: (l) => {
    for (const [y, c] of [[9, PAL.leaf4], [16, PAL.leaf3], [23, PAL.leaf4]] as [number, number][]) {
      l.hline(6, 30, y, c);
      l.hline(8, 33, y + 1, c);
      l.set(34, y - 1, c);
      l.set(35, y - 2, c);
    }
  },
  // Harman Eleği: a round sieve with a grid
  winnow_sieve: (l) => {
    l.disc(22, 17, 12, PAL.earth3);
    l.disc(22, 17, 10, PAL.gold2);
    for (let k = -8; k <= 8; k += 4) {
      l.vline(22 + k, 9, 25, PAL.earth1);
      l.hline(14, 30, 17 + k, PAL.earth1);
    }
  },
  // Burgu Mızrağı: a spiral drill lance
  auger_lance: (l) => {
    l.thickLine(6, 28, 30, 6, 3, PAL.stone2);
    l.poly([[28, 4], [38, 2], [34, 11]], PAL.stone4);
    for (let k = 0; k < 4; k++) l.line(12 + k * 5, 22 - k * 4, 16 + k * 5, 24 - k * 4, W);
  },
  // Ruh Tasması: a collar ring and a chain
  soul_leash: (l) => {
    l.ellipseRing(16, 19, 9, 6, PAL.void4);
    l.ellipseRing(16, 19, 8, 5, PAL.void3);
    for (let k = 0; k < 4; k++) l.ellipseRing(26 + k * 4, 14 - k * 3, 2, 1, PAL.stone4);
  },
  // Saman Korkuluklar: two little scarecrows
  straw_decoys: (l) => {
    for (const x of [14, 30]) {
      l.vline(x, 10, 29, PAL.earth2);
      l.hline(x - 7, x + 7, 14, PAL.earth3);
      l.poly([[x - 4, 15], [x + 4, 15], [x + 6, 25], [x - 6, 25]], PAL.gold3);
      l.disc(x, 9, 3, PAL.earth4);
    }
  },
  // Hınç Baltası: a dark axe
  spite_axe: (l) => {
    l.thickLine(10, 30, 28, 8, 2, PAL.earth2);
    l.poly([[22, 4], [36, 6], [34, 18], [26, 14]], PAL.stone2);
    l.line(36, 6, 34, 18, PAL.crim3);
  },
  // Sayfa Çeviren: an open book with a turning page
  page_turner: (l) => {
    l.poly([[6, 10], [21, 13], [21, 29], [6, 26]], PAL.mist);
    l.poly([[23, 13], [38, 10], [38, 26], [23, 29]], PAL.mist);
    l.poly([[23, 13], [32, 4], [34, 20], [23, 29]], W);
    for (const y of [16, 19, 22]) l.hline(9, 18, y, PAL.stone2);
  },
  // Talih Zarı: a die showing five
  lucky_die: (l) => {
    l.rect(12, 7, 20, 20, W);
    l.rect(12, 7, 20, 3, PAL.mist);
    for (const [x, y] of [[16, 12], [27, 12], [22, 17], [16, 22], [27, 22]] as [number, number][]) l.rect(x - 1, y - 1, 3, 3, PAL.crim3);
  },
};

/** Paint the placeholder emblem of `id` over `p` (44×34). False when the card has none. */
export function paintB2Emblem(p: PixelCanvas, id: CardId): boolean {
  const f = PAINTERS[id];
  if (!f) return false;
  const l = new PixelCanvas(CARD_ART_W, CARD_ART_H);
  f(l);
  l.outline(PAL.ink);
  p.blit(l, 0, 0);
  return true;
}
