// Talih Zarı (lucky_die) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Havada 6'yı gösteren zar, hareket yayları." (YENI_KARTLAR §7 S12) — the image of the scene
// (src/cinematics/spells/lucky_die.ts): THE SAME gold die (the same cube rasteriser, ../../cinematics/spells/
// _lucky_die_cube.ts) caught at the top of its throw, tumbling, its SIX turned toward us; motion arcs sweep up behind
// it from the floor where it last bounced.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, night0 floor, teal1 horizon) with its teal portal light
//             (radius 36: its stepped rim frames the die instead of hiding behind it); on the floor a flat GOLD LIGHT
//             SPOT — the felt the die is about to land on (gold0 / gold1 bands, light layer) — and a night1 bounce
//             shadow where it last hit
//   subject   matter, ink outlined, ONE key light from the top left: the cube's faces in flat tone bands (lit gold3,
//             mid gold2, shade gold1), a 1-px bevel one step lighter round each face, dark recessed pips (gold0 /
//             ink) with one lit lip pixel; the teal3 rim on the shadow side (IŞ-7). 3 px of headroom over it.
//   light     never outlined: three stepped MOTION ARCS (solid 1-px strokes, gold4 → gold3 → gold2 stepping back along
//             the path) tracing the tumble up from the bounce, a few gold sparkles shed by the spin, dust kicked up at
//             the bounce, the white glint on the six's rim (the focus)
// Small (44×34): HAND-DRAWN, not rasterised — at 1× a tilted face's pips melt into its highlight pixels and the six
// read as a sponge. A clean three-quarter cube seen a little from below (high in its throw, like the big): the SIX
// square to the viewer (a 15×15 gold3 face, one gold4 highlight run on its top / left edge only, a gold2 band on its
// lower / right inner edge) with its six pips as 2×2 INK squares in a clean 2×3 grid, nothing else near them; a mid
// side (gold2, one dark 2-px pip) and a shaded underside (gold1); motion arcs as two 1-px strokes; the gold light
// spot and the bounce shadow on the floor.
// Living art: 4 frames × 140 ms, palette only, ≤ 2 px motion: the die bobs a pixel at the top of its arc, the arc
// tones walk along the path, the sparkles blink, the glint winks.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';
import { mul, paintDie, pipOffsets, rot, upright, type M3 } from '../../cinematics/spells/_lucky_die_cube';

const FRAMES = 4;
/** The die's centre in BIG px (the focus is the six's middle glint, just above it). */
const DIE: readonly [number, number] = [47, 33];
const FOCUS = [46, 25] as const;
/** Half edge (big). */
const HB = 14;

/** Caught mid-tumble: the SIX turned toward us (up and to the left, where the key light is), so it reads whole. */
const POSE: M3 = (() => {
  const n = [-0.1, 0.5, 1];
  const l = Math.hypot(n[0], n[1], n[2]);
  const t: [number, number, number] = [n[0] / l, n[1] / l, n[2] / l];
  // the rotation taking +z (the six, after upright) to t: axis z × t, angle acos(t.z)
  const ax: [number, number, number] = [-t[1], t[0], 0];
  const al = Math.hypot(ax[0], ax[1]);
  return mul(rot([ax[0] / al, ax[1] / al, 0], Math.acos(t[2])), mul(rot([0, 0, 1], 0.5), upright(6)));
})();

type P = PixelCanvas;

/** A flat filled ellipse (whole pixels). */
function oval(p: P, cx: number, cy: number, rx: number, ry: number, c: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) p.set(x, y, c);
    }
}

function paintBig(l: ArtLayers, f: number): void {
  const bob = f === 1 || f === 2 ? -1 : 0;
  const [cx, cy0] = DIE;
  const cy = cy0 + bob;
  paintBackdrop(l.backdrop, 'SPELL', { focus: [DIE[0], DIE[1] - 3], radius: 36 });
  // the bounce shadow where it last hit (backdrop: flat night1, no outline)
  oval(l.backdrop, 20, 59, 10, 2.5, PAL.night1);
  // the die (subject)
  const s = l.subject;
  paintDie(s, cx, cy, HB, POSE, { pip: 0.2 });
  ink(s);
  rim(s, PAL.teal3, { skip: [PAL.gold0, PAL.ink] });
  const L = l.light;
  // the felt it is falling onto: a flat gold light spot (two bands), the die's own small shadow in it
  oval(L, 52, 61, 17, 3.5, PAL.gold0);
  oval(L, 52, 61, 11, 2.2, PAL.gold1);
  oval(L, 52, 61, 5 + (f % 2), 1.2, PAL.night0);
  // three motion arcs: the spin's trail, concentric strokes round the die's trailing (left) side, inner gold4 →
  // outer gold2; each breaks off at its tail end, and the break walks along the arc frame by frame
  [31, 35, 39].forEach((r, ai) => {
    const a0 = (150 + ai * 6) * (Math.PI / 180);
    const a1 = (232 - ai * 10) * (Math.PI / 180);
    const n = Math.round(r * (a1 - a0) * 1.4);
    let px = -99;
    let py = -99;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ang = a0 + (a1 - a0) * t;
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * r * 0.9);
      if (x === px && y === py) continue;
      px = x;
      py = y;
      if (y > 58 || y < 2) continue;
      // the tail (t → 1, lower left) thins into dashes
      if (t > 0.7 && (i + f) % 3 === 0) continue;
      L.set(x, y, [PAL.gold4, PAL.gold3, PAL.gold2][ai]);
    }
  });
  // sparkles shed by the spin (plus-shapes blink)
  const sparks: readonly (readonly [number, number])[] = [
    [74, 14],
    [78, 32],
    [68, 7],
    [22, 20],
    [80, 46],
  ];
  sparks.forEach(([x, y], i) => {
    if ((f + i) % 4 === 3) return;
    L.set(x, y, (f + i) % 2 ? PAL.gold4 : PAL.white);
    if (i % 2 === 0) {
      L.set(x - 1, y, PAL.gold2);
      L.set(x + 1, y, PAL.gold2);
      L.set(x, y - 1, PAL.gold2);
      L.set(x, y + 1, PAL.gold2);
    }
  });
  // dust kicked up at the bounce (stone tones, rising a step a frame)
  const dust: readonly (readonly [number, number])[] = [
    [12, 56],
    [16, 53],
    [27, 55],
    [31, 57],
    [22, 52],
  ];
  dust.forEach(([x, y], i) => L.set(x, y - ((f + i) % 2), i % 2 ? PAL.stone3 : PAL.mist));
  // the six's glint (the focus): on the face's lit upper rim, between the top pips — never on a pip
  const offs = pipOffsets(POSE, HB, 6);
  const gx = Math.round(cx + (offs[0].x + offs[3].x) / 2);
  const gy = Math.round(cy + (offs[0].y + offs[3].y) / 2);
  if (f !== 3) L.set(gx, gy, PAL.white);
  if (f === 0) {
    L.set(gx - 1, gy, PAL.gold4);
    L.set(gx + 1, gy, PAL.gold4);
  }
}

/** The small die, drawn by hand on the 44×34 grid (see the header). (fx, fy) = the front face's top-left corner. */
function paintSmall(l: ArtLayers, f: number): void {
  const bob = f === 1 || f === 2 ? -1 : 0;
  paintBackdrop(l.backdrop, 'SPELL', { focus: [DIE[0], DIE[1] - 3], radius: 36 });
  oval(l.backdrop, 9, 29, 5, 1.3, PAL.night1);
  const s = l.subject;
  const FW = 15; // front face size
  const D = 4; // depth of the side / bottom (the 3/4 offset)
  const fx = 15;
  const fy = 7 + bob;
  // seen from a little below and to the right, like the big one (caught high in its throw, the six tipped toward the
  // key light): the right side (mid gold2, its lit edge gold3) and the underside (shade gold1) lean down-right
  for (let c = 1; c <= D; c++) for (let y = fy + c; y < fy + FW + c; y++) s.set(fx + FW - 1 + c, y, c === 1 ? PAL.gold3 : PAL.gold2);
  for (let r = 1; r <= D; r++) for (let x = fx + r; x < fx + FW + r; x++) s.set(x, fy + FW - 1 + r, PAL.gold1);
  // the front face: gold3, one gold4 highlight run on its top edge only, a gold2 band on its lower / right inner edge
  for (let y = fy; y < fy + FW; y++) for (let x = fx; x < fx + FW; x++) s.set(x, y, PAL.gold3);
  for (let x = fx + 1; x < fx + FW - 2; x++) s.set(x, fy, PAL.gold4);
  for (let y = fy + 1; y < fy + FW - 3; y++) s.set(fx, y, PAL.gold4);
  for (let x = fx + 1; x < fx + FW; x++) s.set(x, fy + FW - 1, PAL.gold2);
  for (let y = fy + 1; y < fy + FW; y++) s.set(fx + FW - 1, y, PAL.gold2);
  // the six: 2×2 ink pips in a clean 2×3 grid (3 px in from the sides; rows 2, 6, 10 px down)
  for (const px of [fx + 3, fx + FW - 5])
    for (const py of [fy + 3, fy + 7, fy + 11])
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.set(px + dx, py + dy, PAL.ink);
  // the side's one pip (a 3's middle one), a dark 2-px stroke along its lean
  s.set(fx + FW + 1, fy + 8, PAL.gold0);
  s.set(fx + FW + 2, fy + 9, PAL.gold0);
  ink(s);
  rim(s, PAL.teal3, { skip: [PAL.gold0, PAL.ink, PAL.gold4, PAL.gold3] });
  const L = l.light;
  // the gold light spot it falls onto
  oval(L, 25, 30, 10, 1.8, PAL.gold0);
  oval(L, 25, 30, 6, 1.1, PAL.gold1);
  // two motion arcs: 1-px strokes up from the bounce on the floor to the die (at 1× the big's spin arcs would merge
  // with the portal's rim), the bright step walking toward the die every other frame
  (
    [
      [5, 28, 14, 14, 5],
      [9, 29, 14, 20, 3],
    ] as const
  ).forEach(([sx, sy, ex, ey, h], ai) => {
    let px = -99;
    let py = -99;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = Math.round(sx + (ex - sx) * t);
      const y = Math.round(sy + (ey - sy) * t - Math.sin(t * Math.PI) * h);
      if (x === px && y === py) continue;
      px = x;
      py = y;
      const band = t + ((f + ai) % 2 ? 0.12 : 0) > 0.6 ? 0 : 1;
      L.set(x, y, band === 0 ? PAL.gold4 : PAL.gold2);
    }
  });
  // three sparkles
  const sp: readonly (readonly [number, number])[] = [
    [37, 5],
    [40, 15],
    [9, 8],
  ];
  sp.forEach(([x, y], i) => {
    if ((f + i) % 4 !== 3) L.set(x, y, (f + i) % 2 ? PAL.gold4 : PAL.white);
  });
  L.set(5, 27 - (f % 2), PAL.mist);
  L.set(13, 28 - ((f + 1) % 2), PAL.stone3);
}

const art: CardArtV3 = {
  id: 'lucky_die',
  focus: FOCUS,
  frames: FRAMES,
  holdMs: 140,
  big(l, f) {
    paintBig(l, f);
  },
  small(l, f) {
    paintSmall(l, f);
  },
};

export default art;
