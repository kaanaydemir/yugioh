// Card art v3 — the painter contract and the window geometry (style sheet: docs/v3/KART_RESIMLERI.md).
//
// Every card picture is authored TWICE, on one composition:
//   big    88×68  2× density: shown 1:1 on the 640×360 grid wherever the card is shown at 2× (the inspect
//                 panel's card, a gallery stage) — true 1-px detail, never 2×2 blocks
//   small  44×34  the art window of the 1× face (hand, picker, flying card, gallery grid) = CARD_ART_W ×
//                 CARD_ART_H: made FROM the big one (kit reduceSubject / reduceLight + a native backdrop)
//                 and then corrected by hand (kit patch) — never a blind downscale; judged at 1×
//
// A picture is painted in three layers (transparent canvases of the art's size), composited in this order:
//   backdrop  2–3 flat value bands + ONE stepped light shape (kit paintBackdrop)
//   subject   the matter: flat planes under one key light from the top left, 1-px PAL.ink outline (kit ink)
//   light     what glows (eyes, sparks, cores, energy): drawn after the outline, never outlined (IŞ-9)
//
// Pure data and types: no Phaser, no randomness (art paths are deterministic), palette only.

import type { CardId } from '../../data/cards';
import type { PixelCanvas } from '../pixel';
import { CARD_ART_H, CARD_ART_W } from '../types';

export type ArtSize = 'big' | 'small';

/** An inclusive pixel box (x0..x1, y0..y1). */
export interface ArtBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Window geometry of one size (all numbers in that size's own pixels). */
export interface ArtGeom {
  readonly size: ArtSize;
  readonly w: number;
  readonly h: number;
  /** density: 2 for big, 1 for small (big = small × k) */
  readonly k: 1 | 2;
  /**
   * The ring the v3 card frame covers (px from every edge): at 1× the face's ink sides (x 0 / 43) and
   * its lit / dark bezel rows (y 0 / 33); at 2× the same lines are 2 px. Paint it (the backdrop runs
   * under it) but put nothing there that matters.
   */
  readonly bezel: number;
  /** What the card shows of the art (inside the bezel). */
  readonly visible: ArtBox;
  /** Default horizon: the first row of the floor band. */
  readonly horizon: number;
  /** Where the focus (eye, core, hot point of the effect) must sit. */
  readonly focusBox: ArtBox;
  /** Air the head / top of the subject keeps from the visible top and front edges (unless it bleeds decisively). */
  readonly air: number;
}

/** The hand art (the 1× face's window). */
export const ART_SMALL: ArtGeom = Object.freeze({
  size: 'small',
  w: CARD_ART_W,
  h: CARD_ART_H,
  k: 1,
  bezel: 1,
  visible: Object.freeze({ x0: 1, y0: 1, x1: CARD_ART_W - 2, y1: CARD_ART_H - 2 }),
  horizon: 24,
  focusBox: Object.freeze({ x0: 6, y0: 4, x1: 37, y1: 26 }),
  air: 2,
});

/** The big art (2× density, shown 1:1 by a 2× card). */
export const ART_BIG: ArtGeom = Object.freeze({
  size: 'big',
  w: CARD_ART_W * 2,
  h: CARD_ART_H * 2,
  k: 2,
  bezel: 2,
  visible: Object.freeze({ x0: 2, y0: 2, x1: CARD_ART_W * 2 - 3, y1: CARD_ART_H * 2 - 3 }),
  horizon: 48,
  focusBox: Object.freeze({ x0: 12, y0: 8, x1: 75, y1: 53 }),
  air: 4,
});

export const ART_GEOM: Readonly<Record<ArtSize, ArtGeom>> = Object.freeze({ big: ART_BIG, small: ART_SMALL });

/** Subject size target: its bounding box (clipped to the visible window) over the visible window's area. */
export const SUBJECT_FILL: readonly [number, number] = Object.freeze([0.6, 0.75]) as readonly [number, number];
/** Noise budget (IŞ-10): isolated pixels (no same-coloured 4-neighbour) over opaque pixels, whole picture. */
export const ISOLATED_MAX = 0.1;
/** Colour budget (IŞ-11): distinct palette tones in one picture / in its backdrop. */
export const COLORS_MAX = 20;
export const BACKDROP_COLORS_MAX = 6;

/** The three layers of one picture (see the header). */
export interface ArtLayers {
  readonly size: ArtSize;
  readonly backdrop: PixelCanvas;
  readonly subject: PixelCanvas;
  readonly light: PixelCanvas;
}

/**
 * One card's v3 picture. `big` paints the 88×68 layers; `small` paints the 44×34 layers and receives the
 * finished big layers of the same frame (to reduce them and correct the result by hand). Without `small`
 * the kit makes a blind reduction (kit autoSmall) — a DRAFT: the render script flags it.
 */
export interface CardArtV3 {
  readonly id: CardId;
  /** Where the eye should land, in BIG pixels (the light shape is centred on it; checked against focusBox). */
  readonly focus: readonly [number, number];
  /**
   * The small picture's focus in SMALL pixels when it is not focus / 2 — the hand version may be a
   * tighter crop of the same picture (KART_RESIMLERI §2: "aynı resim, daha yakın").
   */
  readonly focusSmall?: readonly [number, number];
  /** Living art (A5_PLAN §3.7.6): frames of the loop (default 1) and the hold of each (default 140 ms). */
  readonly frames?: number;
  readonly holdMs?: number;
  big(l: ArtLayers, f: number): void;
  small?(l: ArtLayers, f: number, big: ArtLayers): void;
}
