// Card art v3 — Kanat Hanımı (wing_lady, WIND winged beast): a CLOSE portrait in the salute (fix round 1, critique
// r1 #6: the old 1× bust was a small crop on an empty field with a hard green panel). Head, shoulders and the near
// wing's wrist fill the window; the wings sweep out of its top and left edges; the leaf blade rises in front of
// her brow; the ONE green jewel on the circlet is the focus (style sheet docs/v3/KART_RESIMLERI.md, contract
// ./_types.ts). The face is ≈ 16 px in the small art (≈ 32 px in the big one) — the old one was 8.
//
// Source of the subject: the sprite rig itself (src/art/monsters-v3/wing_lady-rig.ts drawWingLady) in a card pose,
// cropped CLOSE (22×17 sprite px around the head) and brought to card density through the edge-preserving Scale2x
// (EPX) rule after the sprite's outline is stripped, then a fresh 1-px ink outline (small = 2×, big = 4×), a
// sunlit gold rim on the shadow-side edges of the wings and the head (the low sun behind her), and the jewel
// repainted in the light layer.
// Ground (painted, no panel): a stepped dusk sky (night1 → night2 → leaf0 → leaf1 bands, whole rows), a low gold1
// sun behind her shoulder, and three THICK wind swooshes (2–3 px leaf2 arcs) curling around the focus, open to the
// right where she looks. Six backdrop colours.
// Living art: 4 frames × 160 ms — the wings breathe one step, the jewel pulses.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BRAID0, NEUTRAL, SASH0, WING_FAR0, WING_NEAR0, W, H, drawWingLady, type Pose } from '../monsters-v3/wing_lady-rig';
import { bands, ink, rim, steppedDisc, steppedRing } from './_kit';
import type { ArtLayers } from './_types';
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

// ================================================================ the native small portrait (44×34)

type V = readonly [number, number];

/** her profile (facing right): hair with a lit crown, the gold circlet with the jewel socket (J), the face planes,
 *  the eye, the brow, the nose tip, the lips, the chin and the neck — painted at card density (the face ≈ 16 px) */
const FACE: readonly string[] = [
  '....hhhhhh.....',
  '..hhHHHHHHh....',
  '.hhHHHHHHHHh...',
  'hhhHHHHHHHHHh..',
  'hhhgGGGGGGJGg..',
  'hhhhhhhKKKKKk..',
  'hhhhhhkKKKKKKk.',
  'hhhhhhkKKnnKKK.',
  'hhhhhkKKKKeKKKK',
  'hhhhhkkKKKKKKKK',
  'hhhhhkkKKKKKKk.',
  'hhhhhhkKKKKKm..',
  'hhhhhhkKKKKKK..',
  'hhhhhhhkKKKKm..',
  'hhhhhhhkkKKK...',
  '.hhhhhhhkkk....',
  '..hhhhh.kkk....',
  '...hhh..kkk....',
];
const FACE_AT: V = [19, 4];
const FACE_KEY: Record<string, number> = {
  h: PAL.night1,
  H: PAL.night2,
  g: PAL.gold1,
  G: PAL.gold2,
  J: PAL.gold1,
  K: PAL.skin3,
  k: PAL.skin2,
  n: PAL.earth2,
  e: PAL.ink,
  m: PAL.earth2,
};
/** the jewel (small px) */
const JEWEL: V = [FACE_AT[0] + 10, FACE_AT[1] + 4];

/** one kestrel wing as flat bands: leading strip earth4, coverts earth3, flights earth2, slate primaries with
 *  separated fingers and short slate bars; `lead` = root → tip along the leading edge, `trail` = the trailing edge
 *  from the tip back to the root (small px) */
function wing(q: PixelCanvas, lead: readonly V[], trail: readonly V[], far: boolean): void {
  const P = (pts: readonly V[]) => pts.map(([x, y]) => [Math.round(x), Math.round(y)] as const);
  const all = [...lead, ...trail];
  const w = new PixelCanvas(q.w, q.h);
  w.poly(P(all), far ? PAL.earth2 : PAL.earth2);
  // coverts: the half of the wing along the leading edge
  const mid = lead.map(([x, y], i) => {
    const t = trail[trail.length - 1 - Math.min(i, trail.length - 1)];
    return [(x + t[0]) / 2, (y + t[1]) / 2] as V;
  });
  const cov = new PixelCanvas(q.w, q.h);
  cov.poly(P([...lead, ...mid.slice().reverse()]), far ? PAL.earth2 : PAL.earth3);
  for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) if (cov.isOpaque(x, y) && w.isOpaque(x, y)) w.set(x, y, cov.get(x, y)!);
  // the lit leading strip (2 px)
  for (let i = 0; i + 1 < lead.length; i++) {
    const [ax, ay] = lead[i];
    const [bx, by] = lead[i + 1];
    w.thickLine(Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by), 2, far ? PAL.earth3 : PAL.earth4);
  }
  // slate primaries: the outer third toward the tip
  const tip = lead[lead.length - 1];
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!w.isOpaque(x, y)) continue;
      const d = Math.hypot(x - tip[0], y - tip[1]);
      if (d < (far ? 6 : 9)) w.set(x, y, d < (far ? 3 : 4) ? PAL.night2 : PAL.night3);
    }
  q.blit(w, 0, 0);
}

function portrait(f: number): PixelCanvas {
  const q = new PixelCanvas(44, 34);
  const br = f % 2; // the wings breathe one pixel
  // far wing: rises behind her head out of the top edge
  wing(q, [[22, 14], [20, 6], [21, -1]], [[29, -1], [27, 6], [25, 13]], true);
  // near wing: from her shoulder sweeping up and back out of the top-left corner
  // a raised kestrel wing: the arm climbs from her shoulder to the WRIST (the wing's peak, the alula corner), the hand
  // sweeps back down to a pointed slate tip with separated fingers, the trailing edge runs back to the body in a
  // row of feather tips — a broad triangle, never a plank
  wing(
    q,
    [[19, 22], [15, 11 - br], [11, 4 - br], [8, 2 - br], [4, 5 - br], [0, 10 - br], [-2, 13 - br]],
    [[-2, 16 - br], [2, 17 - br], [1, 19], [5, 21], [4, 23], [8, 25], [7, 27], [11, 29], [10, 31], [14, 33], [18, 34]],
    false,
  );
  // finger gaps (1 px, cut from the trailing edge inward) and the barring (short slate dashes in two staggered rows)
  for (const [x, y] of [[1, 15], [2, 14], [4, 15], [5, 14], [6, 13]] as V[]) q.erase(x, y - br);
  for (const [x, y] of [[8, 12], [9, 12], [11, 16], [12, 16], [13, 20], [14, 20], [6, 16], [7, 16], [9, 20], [10, 20], [12, 24], [13, 24]] as V[]) if (q.isOpaque(x, y) && q.get(x, y) !== PAL.earth4) q.set(x, y, PAL.night2);
  // the braid: down her back, over the near wing's root
  for (let i = 0; i < 9; i++) {
    const x = 20 - i;
    const y = 20 + Math.round(i * 1.4);
    q.rect(x, y, 2, 2, PAL.night2);
    if (i % 3 === 1) q.set(x, y + 1, PAL.night1);
  }
  q.set(12, 32, PAL.gold1);
  // shoulders and bodice (leaf1 front, leaf0 shade, leaf2 plane), gold trim at the neckline
  q.poly([[18, 33], [20, 25], [25, 22], [31, 22], [35, 26], [37, 33]], PAL.leaf1);
  q.poly([[18, 33], [20, 25], [24, 23], [23, 33]], PAL.leaf0);
  q.poly([[28, 24], [32, 23], [35, 27], [33, 33], [29, 33]], PAL.leaf2);
  q.hline(25, 31, 22, PAL.gold2);
  q.set(28, 23, PAL.gold1);
  // the face
  FACE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = FACE_KEY[row[x]];
      if (c !== undefined) q.set(FACE_AT[0] + x, FACE_AT[1] + y, c);
    }
  });
  // the salute: the leaf blade upright in front of her face, its flat at the brow (mist, a steel shade edge, a white
  // point), the gold guard and her fist below it, the forearm down to the frame edge
  q.poly([[36, 1], [38, 5], [38, 18], [37, 22], [35, 22], [34, 18], [34, 5]], PAL.mist);
  for (let y = 5; y <= 20; y++) q.set(38, y, PAL.steel);
  q.set(37, 21, PAL.steel);
  q.set(36, 2, PAL.white);
  q.set(36, 3, PAL.white);
  q.hline(32, 40, 23, PAL.gold2);
  q.set(40, 23, PAL.gold1);
  q.rect(34, 24, 4, 3, PAL.skin3);
  q.set(34, 26, PAL.skin2);
  q.poly([[33, 26], [37, 26], [34, 33], [30, 33]], PAL.skin2);
  q.poly([[35, 26], [37, 26], [34, 33], [33, 33]], PAL.skin3);
  q.set(34, 29, PAL.gold2);
  q.set(35, 28, PAL.gold2);
  return q;
}

/** The painted dusk ground (BIG px; the kit's helpers halve it on the small canvas). */
function ground(l: ArtLayers): void {
  const p = l.backdrop;
  bands(p, [
    [0, PAL.night1],
    [18, PAL.night2],
    [40, PAL.leaf0],
    [56, PAL.leaf1],
  ]);
  // the low sun behind her shoulder (two steps)
  steppedDisc(p, 44, 52, 26, [PAL.leaf0, PAL.gold1], 6);
  // three THICK wind swooshes around the focus, open to the right (toward her gaze)
  steppedRing(p, 52, 30, 42, 37, PAL.leaf2, 120, 230);
  steppedRing(p, 52, 30, 50, 46, PAL.leaf2, 140, 250);
  steppedRing(p, 60, 24, 32, 28, PAL.leaf2, 200, 290);
}

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  const src = portrait(f);
  const s = k === 2 ? epx(src) : src;
  l.subject.blit(s, 0, 0);
  ink(l.subject);
  // the sunlit rim (gold2) on the shadow-side edges: the low sun sits behind her
  rim(l.subject, PAL.gold2, { skip: [PAL.white, PAL.gold2, PAL.gold1, PAL.skin3, PAL.skin2, PAL.leaf1, PAL.leaf0, PAL.leaf2, PAL.mist, PAL.steel], only: (x, y) => y < 24 * k });
  // the jewel (light layer; never outlined): leaf4 core with a gold4 setting, dimmer on the odd frames
  const j: V = [JEWEL[0] * k, JEWEL[1] * k];
  const core = f === 3 ? PAL.leaf3 : PAL.leaf4;
  l.light.rect(j[0], j[1], k, k, core);
  l.light.rect(j[0] - k, j[1], k, k, PAL.gold4);
}

const art: CardArtV3 = {
  id: 'wing_lady',
  focus: [JEWEL[0] * 2, JEWEL[1] * 2],
  focusSmall: [JEWEL[0], JEWEL[1]],
  frames: 4,
  holdMs: 160,
  big(l, f) {
    ground(l);
    paint(l, f, 2);
  },
  small(l, f) {
    ground(l);
    paint(l, f, 1);
  },
};
export default art;
