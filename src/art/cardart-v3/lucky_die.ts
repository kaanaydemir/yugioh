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
const DIE: readonly [number, number] = [47, 31];
const FOCUS = [46, 23] as const;
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

/**
 * A recessed pip stamped on a face (critic round 2: the rasterised ovals melted into uneven blobs): `size` 4 → a 4×4
 * rounded socket (ink rim, gold0 hollow, one gold1 lip pixel low right — the same ink-rim + cap rule as the scene's
 * die); 3 → a 3×3 plus-socket (ink arms, gold0 heart); 2 → a 2×3 upright ink notch (a face seen edge-on).
 */
function pip(p: P, cx: number, cy: number, size: 2 | 3 | 4): void {
  if (size === 4) {
    const x0 = Math.round(cx - 2);
    const y0 = Math.round(cy - 2);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const edge = x === 0 || y === 0 || x === 3 || y === 3;
        const corner = (x === 0 || x === 3) && (y === 0 || y === 3);
        if (corner) continue;
        p.set(x0 + x, y0 + y, edge ? PAL.ink : x === 2 && y === 2 ? PAL.gold1 : PAL.gold0);
      }
    return;
  }
  const x = Math.round(cx);
  const y = Math.round(cy);
  if (size === 3) {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) p.set(x + dx, y + dy, PAL.ink);
    p.set(x, y, PAL.gold0);
    return;
  }
  p.set(x, y - 1, PAL.ink);
  p.set(x, y, PAL.ink);
  p.set(x, y + 1, PAL.ink);
  p.set(x - 1, y, PAL.gold0);
}

/** The die (faces from the shared cube rasteriser, pips stamped by hand per face). */
function dieWithPips(s: P, cx: number, cy: number, h: number, sizes: Readonly<Record<number, 2 | 3 | 4>>): void {
  paintDie(s, cx, cy, h, POSE, { noPips: true });
  ink(s);
  rim(s, PAL.teal3, { skip: [PAL.ink] });
  // the pips go on after the outline and the rim light (stamped sockets stay clean)
  for (const v of [6, 3, 2]) {
    const sz = sizes[v];
    if (!sz) continue;
    for (const o of pipOffsets(POSE, h, v)) pip(s, cx + o.x, cy + o.y, sz);
  }
}

function paintBig(l: ArtLayers, f: number): void {
  const bob = f === 1 || f === 2 ? -1 : 0;
  const [cx, cy0] = DIE;
  const cy = cy0 + bob;
  paintBackdrop(l.backdrop, 'SPELL', { focus: [DIE[0], DIE[1] - 3], radius: 36 });
  // its shadow on the floor far below: a flat 2:1 night oval, DETACHED from the die (it floats at the top of its
  // throw), a pixel narrower when it bobs up
  oval(l.backdrop, 50, 64.5, 8 - (bob ? 1 : 0), 2.5, PAL.ink);
  // the die (subject): the six square-ish to us (4×4 sockets), the 3 below it (3×3 sockets)
  const s = l.subject;
  // (the 2 on the narrow right side is seen almost edge-on: no pips there, they would read as strays)
  dieWithPips(s, cx, cy, HB, { 6: 4, 3: 3 });
  const L = l.light;
  // three motion arcs: the spin's trail, concentric strokes round the die's trailing (left) side, inner gold4 →
  // outer gold2; each breaks off at its tail end, and the break walks along the arc frame by frame
  [31, 35, 39].forEach((r, ai) => {
    const a0 = (150 + ai * 6) * (Math.PI / 180);
    const a1 = (226 - ai * 10) * (Math.PI / 180);
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
      if (y > 56 || y < 2) continue;
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

/** Half edge of the small die (it is the big one's pose at 1×, its pips stamped as clean 2×2 ink squares). */
const HS = 6;
const SMALL_DIE: readonly [number, number] = [24, 13];

function paintSmall(l: ArtLayers, f: number): void {
  const bob = f === 1 || f === 2 ? -1 : 0;
  const [cx, cy0] = SMALL_DIE;
  const cy = cy0 + bob;
  paintBackdrop(l.backdrop, 'SPELL', { focus: [DIE[0], DIE[1] - 3], radius: 36 });
  // the floating die's shadow: a flat 2:1 night oval well below it
  oval(l.backdrop, 24, 31, 4 - (bob ? 1 : 0), 2, PAL.ink);
  const s = l.subject;
  // the same tilted pose as the big (one corner toward us): faces from the cube rasteriser, the six's pips stamped as
  // 2×2 ink squares, the 3 below as single dark pixels
  paintDie(s, cx, cy, HS, POSE, { noPips: true, corner: 0.15 });
  ink(s);
  rim(s, PAL.teal3, { skip: [PAL.ink, PAL.gold4, PAL.gold3] });
  for (const o of pipOffsets(POSE, HS, 6)) {
    const x = Math.round(cx + o.x - 0.5);
    const y = Math.round(cy + o.y - 0.5);
    s.set(x, y, PAL.ink);
    s.set(x + 1, y, PAL.ink);
    s.set(x, y + 1, PAL.ink);
    s.set(x + 1, y + 1, PAL.gold0);
  }
  for (const o of pipOffsets(POSE, HS, 3)) s.set(Math.round(cx + o.x), Math.round(cy + o.y), PAL.gold0);
  const L = l.light;
  // two clean concentric gold arcs on the trailing (left, lower) side of the spin, the bright step walking along them
  [16, 19].forEach((r, ai) => {
    const a0 = (140 + ai * 8) * (Math.PI / 180);
    const a1 = (222 - ai * 8) * (Math.PI / 180);
    const n = Math.round(r * (a1 - a0) * 1.6);
    let px = -99;
    let py = -99;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ang = a0 + (a1 - a0) * t;
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * r * 0.85);
      if (x === px && y === py) continue;
      px = x;
      py = y;
      if (y < 1 || y > 30) continue;
      const lit = Math.abs(t - ((f * 0.25 + ai * 0.12) % 1)) < 0.14;
      L.set(x, y, lit ? PAL.gold4 : ai === 0 ? PAL.gold3 : PAL.gold2);
    }
  });
  // three sparkles
  const sp: readonly (readonly [number, number])[] = [
    [37, 5],
    [40, 15],
    [36, 24],
  ];
  sp.forEach(([x, y], i) => {
    if ((f + i) % 4 !== 3) L.set(x, y, (f + i) % 2 ? PAL.gold4 : PAL.white);
  });
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
