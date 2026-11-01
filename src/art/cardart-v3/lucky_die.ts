// Talih Zarı (lucky_die) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Havada 6'yı gösteren zar, hareket yayları." (YENI_KARTLAR §7 S12) — the image of the scene
// (src/cinematics/spells/lucky_die.ts): THE SAME gold die (the same cube rasteriser, ../../cinematics/spells/
// _lucky_die_cube.ts) caught at the top of its throw, tumbling, its SIX turned toward us; motion arcs sweep up behind
// it from the floor where it last bounced.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, night0 floor, teal1 horizon) with its teal portal light
//             centred behind the die: the die flies out of the spell's light; a flat night1 shadow oval on the floor
//             under it (the bounce point)
//   subject   matter, ink outlined, ONE key light from the top left: the cube's faces in flat tone bands (lit gold3,
//             mid gold2, shade gold1), a 1-px bevel one step lighter round each face, dark recessed pips (gold0 /
//             ink) with one lit lip pixel; the teal3 rim on the shadow side (IŞ-7)
//   light     never outlined: three motion arcs (gold3 → gold2 → gold1 stepping back along the path), a few gold
//             sparkles shed by the spin, dust kicked up at the bounce, the white glint on the six (the focus)
// Small (44×34): the same composition painted natively at 1× (the die at its own size, the same matrix), then
// corrected by hand: the six's pips are restamped as clean 2×1 dark blobs so they read in the hand, the arcs become
// two 1-px strokes.
// Living art: 4 frames × 140 ms, palette only, ≤ 2 px motion: the die bobs a pixel at the top of its arc, the arc
// tones walk along the path, the sparkles blink, the glint winks.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';
import { mul, paintDie, pipOffsets, rot, upright, visibleFaces, type M3 } from '../../cinematics/spells/_lucky_die_cube';

const FRAMES = 4;
/** The die's centre in BIG px (the focus is the six's middle glint, just above it). */
const DIE: readonly [number, number] = [47, 30];
const FOCUS = [46, 22] as const;
/** Half edges: big, small. */
const HB = 15;
const HS = 6.5;

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

/** A big-pixel coordinate on a canvas of density k (2 big, 1 small). */
const q = (v: number, k: number): number => Math.floor((v * k) / 2);

/** The motion arcs: quarter-ellipse strokes from the lower left up to the die, stepping darker back along the path. */
function paintArcs(l: P, k: number, f: number, cx: number, cy: number): void {
  const arcs: readonly (readonly [number, number, number])[] =
    k === 2
      ? [
          [-30, 24, 0],
          [-24, 30, 10],
          [-36, 16, -8],
        ]
      : [
          [-15, 12, 0],
          [-18, 8, -4],
        ];
  arcs.forEach(([dx, dy, lift], ai) => {
    // a parabola from (cx + dx, cy + dy) up to just behind the die
    const n = k === 2 ? 30 : 15;
    const sx = cx + dx;
    const sy = cy + dy;
    const ex = cx - (k === 2 ? 14 : 7);
    const ey = cy + q(lift, k) - (k === 2 ? 2 : 1);
    let px = -1;
    let py = -1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(sx + (ex - sx) * t);
      const y = Math.round(sy + (ey - sy) * t - Math.sin(t * Math.PI) * (k === 2 ? 6 : 3));
      if (x === px && y === py) continue;
      px = x;
      py = y;
      // tones step down the path (gold4 next to the die → gold2 at the tail; the tail breaks into dashes); the bright
      // band walks toward the die with f
      const band = Math.min(2, Math.floor((1 - t) * 3 + ((f % 2) * 0.4)));
      if (t < 0.25 && (i + ai) % 2 === 0) continue;
      l.set(x, y, [PAL.gold4, PAL.gold3, PAL.gold2][band]);
    }
  });
}

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  const bob = f === 1 || f === 2 ? -1 : 0;
  const cx = q(DIE[0], k);
  const cy = q(DIE[1], k) + bob;
  paintBackdrop(l.backdrop, 'SPELL', { focus: [DIE[0], DIE[1] - 2], radius: 28 });
  // the bounce spot's shadow on the floor: a flat night1 oval (part of the backdrop: no outline)
  const sx = q(22, k);
  const sy = q(58, k);
  const rx = q(12, k);
  const ry = q(3, k) + (k === 1 ? 0 : 1);
  for (let y = sy - ry; y <= sy + ry; y++)
    for (let x = sx - rx; x <= sx + rx; x++) {
      const dx = (x + 0.5 - sx) / rx;
      const dy = (y + 0.5 - sy) / ry;
      if (dx * dx + dy * dy <= 1) l.backdrop.set(x, y, PAL.night1);
    }
  // the die (subject)
  const s = l.subject;
  paintDie(s, cx, cy, k === 2 ? HB : HS, POSE, { pip: 0.2, noPips: k === 1 });
  if (k === 1) {
    // hand-made pips at 1× (the rasteriser's ovals melt at this size): the six as six clean 2×2 dark squares, the
    // side faces' pips as single dark pixels (ink on the shade face)
    for (const v of visibleFaces(POSE)) {
      if (v.facing < 0.25) continue;
      const six = v.value === 6;
      for (const o of pipOffsets(POSE, HS, v.value)) {
        const x = Math.floor(cx + o.x - (six ? 0.5 : 0));
        const y = Math.floor(cy + o.y - (six ? 0.5 : 0));
        const c = six ? PAL.gold0 : s.get(x, y) === PAL.gold1 ? PAL.ink : PAL.gold0;
        s.set(x, y, c);
        if (six) {
          s.set(x + 1, y, c);
          s.set(x, y + 1, c);
          s.set(x + 1, y + 1, PAL.gold1);
        }
      }
    }
  }
  ink(s);
  rim(s, PAL.teal3, { skip: [PAL.gold0, PAL.ink] });
  // light: arcs, sparkles, bounce dust, the glint
  const L = l.light;
  paintArcs(L, k, f, cx, cy + (k === 2 ? 4 : 2));
  const sparks: readonly (readonly [number, number])[] = [
    [70, 12],
    [74, 30],
    [64, 6],
    [20, 16],
    [76, 44],
  ];
  sparks.forEach(([x, y], i) => {
    if ((f + i) % 4 === 3) return;
    const X = q(x, k);
    const Y = q(y, k);
    const c = (f + i) % 2 ? PAL.gold4 : PAL.gold3;
    L.set(X, Y, c);
    if (k === 2 && i % 2 === 0) {
      L.set(X - 1, Y, PAL.gold2);
      L.set(X + 1, Y, PAL.gold2);
      L.set(X, Y - 1, PAL.gold2);
      L.set(X, Y + 1, PAL.gold2);
    }
  });
  // dust kicked up at the bounce (stone tones, rising a step a frame)
  const dust: readonly (readonly [number, number])[] = [
    [14, 54],
    [18, 51],
    [27, 53],
    [31, 55],
    [23, 50],
  ];
  dust.forEach(([x, y], i) => L.set(q(x, k), q(y, k) - ((f + i) % 2), i % 2 ? PAL.stone3 : PAL.mist));
  // the six's glint (the focus): the top face's middle, white
  const offs = pipOffsets(POSE, k === 2 ? HB : HS, 6);
  const mx = (offs[1].x + offs[4].x) / 2;
  const my = (offs[1].y + offs[4].y) / 2;
  const gx = Math.round(cx + mx);
  const gy = Math.round(cy + my);
  if (f !== 3) L.set(gx, gy, PAL.white);
  if (k === 2 && f === 0) {
    L.set(gx - 1, gy, PAL.gold4);
    L.set(gx + 1, gy, PAL.gold4);
  }
}

const art: CardArtV3 = {
  id: 'lucky_die',
  focus: FOCUS,
  frames: FRAMES,
  holdMs: 140,
  big(l, f) {
    paint(l, f, 2);
  },
  small(l, f) {
    paint(l, f, 1);
  },
};

export default art;
