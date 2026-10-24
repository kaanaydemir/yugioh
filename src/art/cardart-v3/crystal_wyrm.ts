// Kristal Ejder (crystal_wyrm) — v3 card art, PROTOTYPE (style sheet docs/v3/KART_RESIMLERI.md,
// contract ./_types.ts). Not wired into the game: judged as renders.
//
// Subject: the approved still (src/still/wyrm-map.ts) at 1:1 — no scaling, its own value planes, ink
// contour and cyan2 rim — re-composed as a bust for the card window:
//   big   head, both horns, crest, neck, the near wing (its finger spike well inside the window, the
//         rest bleeding off the back edge), the far wing behind the neck and the top of the chest; the
//         raised near forearm is painted out (under the jaw it read as a small waving hand) and the
//         chest's shadow side is closed with the still's own steel plane, cyan2 rim and ink.
//   small the same still pixels, closer (KART_RESIMLERI §1 "aynı resim, daha yakın"): head, horns and
//         the top of the neck, the eye left of centre with the snout's lead room on the right; one hand
//         correction where the crop cuts the far wing's strut (SMALL_FIX).
// The head stays in profile: the still has no three-quarter view, and the profile is the silhouette
// the board sprite shows.
// Backdrop — LIGHT as a pale prism light: the ace's frame is already gold (trim, L corners, stars), so
// the light is cool and pale instead of a gold sun — a stepped halo cut like the crystal (three nested
// octagons night3 → night4 → steel, one value apart, centred 4 px behind the eye) with 8 long flat
// night3 rays from its corners, on two calm night bands; no floor (the bust floats in the light).
// The only gold in the picture is the horns; the one rim colour is the still's cyan2.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { WYRM_KEY, WYRM_MAP } from '../../still/wyrm-map';
import { bands, patch, spikes } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

// ---------------------------------------------------------------- the still, edited for the card

/** The still's eye (iris) in still pixels. */
const EYE: readonly [number, number] = [70, 18];

/**
 * Card edit on the still at (56, 51) (patch format: '.' leave, '_' erase, other keys = WYRM_KEY): the
 * raised near forearm and its paw are painted out; the chest's shadow side runs on down in the still's
 * steel plane with its cyan2 rim and ink contour.
 */
// prettier-ignore
const ARM_OUT: readonly string[] = [
  '...........______', // 51
  '..........________', // 52
  '.........___________', // 53
  '..sssck__________', // 54
  '.ssssck_________', // 55
  '.ssssck________', // 56
  '.ssssck_______', // 57
  '..sssck______', // 58
  '..sssck___', // 59
  '....sck__', // 60
];

let STILL: PixelCanvas | null = null;
function still(): PixelCanvas {
  if (!STILL) {
    const p = new PixelCanvas(96, 96);
    patch(p, WYRM_MAP, WYRM_KEY, 0, 0);
    patch(p, ARM_OUT, WYRM_KEY, 56, 51);
    STILL = p;
  }
  return STILL;
}

// ---------------------------------------------------------------- composition

/** Still → big offset: the eye at (56, 29), 10 px of air before the snout, the wing spike 5 px in. */
const BX = -14;
const BY = 11;
/** Still → small offset: the head close, the eye at (18, 12). */
const SX = -52;
const SY = -6;

/**
 * Small hand correction at (0, 12) on the small subject: the far wing's strut, cut by the crop, would
 * run as a 1-px ink sliver along the window's left edge (a tangent) — x 1 shows the backdrop instead
 * and x 0 (under the face's ink side) closes the cut with ink. Row 15's ink at x 1 is the lower horn's
 * outline and stays.
 */
// prettier-ignore
const SMALL_FIX: readonly string[] = [
  'k_', // 12
  'k_', // 13
  'k_', // 14
];

const FOCUS: readonly [number, number] = [EYE[0] + BX, EYE[1] + BY];
const FOCUS_SMALL: readonly [number, number] = [EYE[0] + SX, EYE[1] + SY];

// ---------------------------------------------------------------- backdrop: pale prism light

/** Sky bands (upper from 0, lower from SPLIT, BIG px). */
const SKY: readonly [number, number] = [PAL.night1, PAL.night2];
const SPLIT = 30;
/** Halo steps outer → inner (one value apart), circumradius and step (BIG px). */
const HALO: readonly number[] = [PAL.night3, PAL.night4, PAL.steel];
const HALO_R = 31;
const HALO_STEP = 8;
/** Corners of the halo and directions of the rays (degrees, 0 = right, 90 = down). */
const PHASE = 22.5;
/** 8 long flat rays from the halo's corners; half-width 2 big / 2 small px (a band, never a 1-px line). */
const RAYS = { r0: 24, r1: 56, hw: 2, hwSmall: 4 };

/** One stepped octagon per halo tone, centred on a pixel centre of either canvas (geometry in BIG px). */
function facetHalo(p: PixelCanvas, c: readonly [number, number]): void {
  const k = p.w === 88 ? 1 : 2;
  const cx = Math.floor(c[0] / k) + 0.5;
  const cy = Math.floor(c[1] / k) + 0.5;
  HALO.forEach((tone, i) => {
    const r = (HALO_R - i * HALO_STEP) / k;
    const pts: [number, number][] = [];
    for (let j = 0; j < 8; j++) {
      const a = ((PHASE + 45 * j) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    p.poly(pts, tone);
  });
}

/** The whole backdrop layer of either size: two calm bands, the rays, then the faceted halo over them. */
function paintLight(p: PixelCanvas, c: readonly [number, number]): void {
  bands(p, [
    [0, SKY[0]],
    [SPLIT, SKY[1]],
  ]);
  spikes(p, c[0], c[1], 8, RAYS.r0, RAYS.r1, p.w === 88 ? RAYS.hw : RAYS.hwSmall, PAL.night3, PHASE);
  facetHalo(p, c);
}

// ---------------------------------------------------------------- the painter

const art: CardArtV3 = {
  id: 'crystal_wyrm',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  big(l: ArtLayers) {
    paintLight(l.backdrop, [FOCUS[0] - 4, FOCUS[1]]);
    l.subject.blit(still(), BX, BY);
  },
  small(l: ArtLayers) {
    paintLight(l.backdrop, [(FOCUS_SMALL[0] - 2) * 2, FOCUS_SMALL[1] * 2]);
    l.subject.blit(still(), SX, SY);
    patch(l.subject, SMALL_FIX, WYRM_KEY, 0, 12);
  },
};

export default art;
