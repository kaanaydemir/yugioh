// The graveyard panel's pure parts (K11, docs/v3/A6_PLAN.md §3 K11) — geometry, the beat table, the
// shelf's scroll / focus / hit logic and the title. No Phaser here (unit tests: tests/v3/a6-grave.test.ts);
// the view is ./GravePanel.ts.
//
//   0–90 ms    the plate opens from a 4-px line to full height in three steps (bottom-anchored, a drawer)
//   30–220 ms  the cards are born lying on the pile, stand up in two LOD frames and arc into their slots,
//              staggered (≤ 30 ms; the first 7 cards — the ones beyond the window are simply in place)
//   close      0–40 the cards gather into one deck, 40–120 the deck falls onto the pile (LOD steps down),
//              40–140 the plate folds back in three steps
// Reduced motion (AH): no flight, the cards appear in two palette steps, no opening steps.

import type { PlayerId } from '../../engine/types';

const FRAME = 1000 / 60;

/** Geometry (game px, plate-local unless noted) and timeline (ms at 1×, scene clock). */
export const GRAVE = Object.freeze({
  w: 400,
  h: 150,
  /** Gap between the plate's bottom edge and the screen's bottom edge. */
  bottom: 4,
  /** Cards shown at once; more scroll. */
  visible: 7,
  cardW: 48,
  cardH: 68,
  gap: 4,
  /** The card window: left edge, top of a resting card, the window's height (room for the 6-px hover lift). */
  winX: 20,
  cardTop: 32,
  /** Header: the title's cap top, the divider row. */
  titleCap: 8,
  divider: 23,
  /** Under the cards: the index numbers, the info line, the scroll track, the key hint. */
  indexCap: 104,
  infoCap: 116,
  trackY: 128,
  hintCap: 136,
  padX: 8,
  /** The CLOSE button (top right). */
  closeW: 54,
  closeH: 18,
  closeY: 3,
  /** The arrows (5 × 9 triangles) beside the window, and their hit width. */
  arrowW: 5,
  arrowH: 9,
  arrowHit: 16,
  /** Opening: heights of the three steps (then full), one step each `openStepMs`. */
  openSteps: Object.freeze([4, 56, 108]),
  openStepMs: 30,
  openMs: 90,
  /** The cards' flight window and stagger. */
  flyFrom: 30,
  flyEnd: 220,
  stagger: 30,
  /** Shortest / longest single flight. */
  flightMin: 90,
  flightMax: 150,
  /** Closing: the gather, the deck's fall, the fold (three steps of foldStepMs from foldFrom), the end. */
  gatherMs: 40,
  fallMs: 80,
  foldFrom: 40,
  foldStepMs: 100 / 3,
  closeMs: 140,
  /** Reduced motion: two palette steps of two frames each (open and close). */
  reducedStepMs: 2 * FRAME,
  /** The title stamps two letters a frame once the plate is full. */
  lettersPerFrame: 2,
});

/** The card pitch (one card + the gap). */
export const PITCH = GRAVE.cardW + GRAVE.gap;
/** The card window's width (7 cards). */
export const WIN_W = GRAVE.visible * GRAVE.cardW + (GRAVE.visible - 1) * GRAVE.gap;

/** The plate's screen rect: centred over the hand band, at the bottom of the screen. */
export function graveRect(screenW: number, screenH: number): { x: number; y: number; w: number; h: number } {
  return { x: Math.round((screenW - GRAVE.w) / 2), y: screenH - GRAVE.bottom - GRAVE.h, w: GRAVE.w, h: GRAVE.h };
}

/** Card i's resting centre in the shelf (plate-local, scroll 0). Fewer than 7 cards sit centred. */
export function slotXY(i: number, n: number): { x: number; y: number } {
  const k = Math.min(GRAVE.visible, Math.max(1, n));
  const rowW = k * GRAVE.cardW + (k - 1) * GRAVE.gap;
  const left = GRAVE.winX + Math.round((WIN_W - rowW) / 2);
  return { x: left + i * PITCH + GRAVE.cardW / 2, y: GRAVE.cardTop + GRAVE.cardH / 2 };
}

/** The furthest scroll (px) for n cards. */
export function maxScroll(n: number): number {
  return Math.max(0, n - GRAVE.visible) * PITCH;
}

export function clampScroll(s: number, n: number): number {
  return Math.max(0, Math.min(maxScroll(n), Math.round(s)));
}

/** Snap a scroll to a whole card (after a drag). */
export function snapScroll(s: number, n: number): number {
  return clampScroll(Math.round(s / PITCH) * PITCH, n);
}

/** Scroll by `cards` whole cards from a target (arrows, wheel). */
export function stepScroll(target: number, cards: number, n: number): number {
  return clampScroll(snapScroll(target, n) + cards * PITCH, n);
}

/** The scroll that keeps card `focus` inside the window (unchanged when it already is). */
export function scrollToShow(focus: number, scroll: number, n: number): number {
  if (focus < 0 || focus >= n) return clampScroll(scroll, n);
  const first = Math.ceil(scroll / PITCH - 1e-6);
  const last = first + GRAVE.visible - 1;
  if (focus < first) return clampScroll(focus * PITCH, n);
  if (focus > last) return clampScroll((focus - GRAVE.visible + 1) * PITCH, n);
  return clampScroll(scroll, n);
}

/** Is card i entirely inside the window at this scroll? */
export function inWindow(i: number, scroll: number, n: number): boolean {
  const cx = slotXY(i, n).x - scroll;
  return cx - GRAVE.cardW / 2 >= GRAVE.winX && cx + GRAVE.cardW / 2 <= GRAVE.winX + WIN_W;
}

/** The card under a plate-local point (x, y) at this scroll, or −1 (gaps and the area outside the window miss). */
export function slotAt(x: number, y: number, scroll: number, n: number): number {
  if (n <= 0) return -1;
  if (x < GRAVE.winX || x >= GRAVE.winX + WIN_W) return -1;
  // the hover lift (6 px) keeps a lifted card's top under the pointer
  if (y < GRAVE.cardTop - 6 || y >= GRAVE.cardTop + GRAVE.cardH) return -1;
  for (let i = 0; i < n; i++) {
    const cx = slotXY(i, n).x - scroll;
    if (x >= cx - GRAVE.cardW / 2 && x < cx + GRAVE.cardW / 2) return i;
  }
  return -1;
}

/** Move the keyboard focus by d (−1 / +1); no focus yet → the newest card. Clamped (no wrap). */
export function moveFocus(focus: number, d: number, n: number): number {
  if (n <= 0) return -1;
  if (focus < 0) return 0;
  return Math.max(0, Math.min(n - 1, focus + d));
}

/** The engine's graveyard (bottom → top) as the shelf shows it: the newest first. */
export function shelfOrder<T>(cards: readonly T[]): T[] {
  return [...cards].reverse();
}

// ================================================================ the beats

/** The plate while it opens: its height and palette step (−2 / −1 / 0); `full` = the finished plate. */
export function openFrame(ms: number, reduced: boolean): { h: number; step: number; full: boolean } {
  if (reduced) return { h: GRAVE.h, step: 0, full: true };
  if (ms >= GRAVE.openMs - 1e-6) return { h: GRAVE.h, step: 0, full: true };
  const i = Math.max(0, Math.min(GRAVE.openSteps.length - 1, Math.floor(ms / GRAVE.openStepMs + 1e-6)));
  return { h: GRAVE.openSteps[i], step: i === 0 ? -2 : i === 1 ? -2 : -1, full: false };
}

/** The plate while it closes: full until foldFrom, then the three steps back down, then gone. */
export function closeFrame(ms: number, reduced: boolean): { h: number; step: number; full: boolean; gone: boolean } {
  if (reduced) return ms >= 2 * GRAVE.reducedStepMs - 1e-6 ? { h: 0, step: -2, full: false, gone: true } : { h: GRAVE.h, step: ms < GRAVE.reducedStepMs ? -1 : -2, full: true, gone: false };
  if (ms < GRAVE.foldFrom) return { h: GRAVE.h, step: 0, full: true, gone: false };
  const k = Math.floor((ms - GRAVE.foldFrom) / GRAVE.foldStepMs + 1e-6);
  if (k >= GRAVE.openSteps.length || ms >= GRAVE.closeMs - 1e-6) return { h: 0, step: -2, full: false, gone: true };
  const steps = [...GRAVE.openSteps].reverse();
  return { h: steps[k], step: k === 0 ? -1 : -2, full: false, gone: false };
}

/** The flights of the first min(n, 7) cards: start (ms after open) and duration, all inside 30–220 ms. */
export function flightPlan(n: number): { start: number; dur: number }[] {
  const k = Math.min(GRAVE.visible, Math.max(0, n));
  if (k === 0) return [];
  const span = GRAVE.flyEnd - GRAVE.flyFrom;
  // the stagger shrinks with more cards (never under a frame) so the last one still lands by 220 ms
  const stagger = k === 1 ? 0 : Math.max(FRAME, Math.min(GRAVE.stagger, (span - GRAVE.flightMin) / (k - 1)));
  const dur = Math.max(GRAVE.flightMin, Math.min(GRAVE.flightMax, span - (k - 1) * stagger));
  return Array.from({ length: k }, (_, i) => ({ start: GRAVE.flyFrom + i * stagger, dur }));
}

/**
 * One flight at t ∈ [0, 1]: the card lies on the pile (an iso-flat raster), stands up in two LOD frames,
 * then arcs to its slot at full size. `p` = progress along the arc (eased), (sx, sy) the logical scale
 * (shown as crisp rasters), `lift` the arc's height factor (0 at both ends).
 */
export function flightAt(t: number): { p: number; sx: number; sy: number; stage: 0 | 1 | 2 | 3 } {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const stage: 0 | 1 | 2 | 3 = k < 0.14 ? 0 : k < 0.28 ? 1 : k < 0.42 ? 2 : 3;
  const sc = [
    [0.6, 0.28],
    [0.72, 0.56],
    [0.86, 0.84],
    [1, 1],
  ][stage];
  // the card leaves the pile once it is standing (from the first LOD frame), ease-out cubic
  const u = k < 0.14 ? 0 : (k - 0.14) / 0.86;
  const p = 1 - (1 - u) * (1 - u) * (1 - u);
  return { p, sx: sc[0], sy: sc[1], stage };
}

/** A point on the flight's arc (whole pixels): a quadratic curve from the pile to the slot, `rise` px above the chord. */
export function arcPoint(from: { x: number; y: number }, to: { x: number; y: number }, p: number, rise: number): { x: number; y: number } {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - rise;
  const q = 1 - p;
  return { x: Math.round(q * q * from.x + 2 * q * p * cx + p * p * to.x), y: Math.round(q * q * from.y + 2 * q * p * cy + p * p * to.y) };
}

/** The close: the deck's state at `ms` — gathering (0…1 toward the stack), falling (0…1 toward the pile), gone. */
export function closeDeck(ms: number): { phase: 'gather' | 'fall' | 'gone'; t: number; sx: number; sy: number } {
  if (ms < GRAVE.gatherMs) return { phase: 'gather', t: ms / GRAVE.gatherMs, sx: 1, sy: 1 };
  const f = (ms - GRAVE.gatherMs) / GRAVE.fallMs;
  if (f >= 1) return { phase: 'gone', t: 1, sx: 0.6, sy: 0.28 };
  const sc = f < 0.3 ? [1, 1] : f < 0.55 ? [0.86, 0.84] : f < 0.8 ? [0.72, 0.56] : [0.6, 0.28];
  return { phase: 'fall', t: f, sx: sc[0], sy: sc[1] };
}

// ================================================================ text

export interface TitleSeg {
  text: string;
  /** 'head' white, 'owner' the owner's tone, 'count' mist. */
  role: 'head' | 'owner' | 'count';
}

/** "GRAVEYARD · PLAYER 1 · 5 cards" (hot-seat / demo) — vsBot: "YOUR GRAVEYARD · 5 cards" / "OPPONENT'S GRAVEYARD · 1 card". */
export function graveTitle(player: PlayerId, n: number, vsBot: { viewer: PlayerId } | null): TitleSeg[] {
  const count: TitleSeg = { text: ` · ${n} ${n === 1 ? 'card' : 'cards'}`, role: 'count' };
  if (vsBot) return [{ text: player === vsBot.viewer ? 'YOUR GRAVEYARD' : "OPPONENT'S GRAVEYARD", role: 'owner' }, count];
  return [
    { text: 'GRAVEYARD · ', role: 'head' },
    { text: `PLAYER ${player + 1}`, role: 'owner' },
    count,
  ];
}

export const GRAVE_TEXT = Object.freeze({
  empty: 'Graveyard is empty',
  close: 'CLOSE',
  idle: 'Newest first · point at a card to inspect it',
  hint: '← → browse · Enter pin · Esc close',
  hintEmpty: 'Esc close',
  pinned: 'PINNED',
});
