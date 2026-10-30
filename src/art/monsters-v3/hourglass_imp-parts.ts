// Kum Saati Cücesi v3 — the PART PAINTERS (biped v1 slots, A3_MIMARI §3.3 PartPainter).
//
// A small gnome-wizard, facing right, in flat value planes under one key light (IŞ-1/3):
//   hat      a sky-blue cone bent over at the tip (the tip lags the head: fx.hatX / hatY), a wide
//            brim that shades the face, a gold band with one star; planes cut from the shape by the
//            frame's light, so the relit P2 sheet has its lit plane on the other side;
//   face     a hand-placed 14 × 10 map (big round nose, bushy white brows, 1×2 eyes) — tone runs are
//            reversed for P2 (kit relightRows), details stay;
//   beard    a long white beard + moustache hanging over the chest, its tip lagging (fx.beardX/Y);
//   robe     a bell of sky cloth over the legs with a gold belt, a gold hem line and teeth ≥ 2 px wide
//            that sway (fx.hemX), two fold creases;
//   arms     sleeves with gold cuffs and EXPRESSIVE hands (fist / open / hold, plus finger words:
//            point, spread, pinch — fx.fingN / fingF);
//   boots    pointed leather boots;
//   staff    (propF slot, under the near hand) the shaft + the oversized hourglass (hourglass_imp-glass.ts);
// Light (after the outline, IŞ-9): the eyes' gold when casting, the glass's glint / ring / sparks, dust.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { BipedPart, BipedPose, BipedRig } from '../bodyplans/biped/v1';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { V } from '../rigkit/geom';
import { BUILD, type ImpFx } from './hourglass_imp-build';
import { paintGlassLight, paintStaff, staffGeom } from './hourglass_imp-glass';
import { BEARD, CREASE, GOLD, MARK, SEAM, SKIN, SKY, WOOD, hash, plane, relightRows, type Tones } from './hourglass_imp-kit';

export type Pose = PlanPose<BipedPose, ImpFx>;
export type Ctx = PartCtx<Pose, BipedRig>;
export type Part = BipedPart<ImpFx>;

const R = Math.round;

// ------------------------------------------------------------------ small helpers

/** The staff's grip point and the glass geometry of this frame (null when the pose has no staff). */
export function staffOf(rig: BipedRig, fx: Readonly<ImpFx>) {
  const s = rig.props.staff;
  if (!s || s.show <= 0) return null;
  return staffGeom([R(s.at[0]), R(s.at[1])], s.a, fx, rig.ground);
}

/** Snap an angle to the nearest 90° (hands are tiny: a 45° rotation of a pixel block only makes checkers). */
function snap45(a: number): number {
  return Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
}

// ------------------------------------------------------------------ face

const FACE_X0 = 7; // map column of the head centre
const FACE_Y0 = 6; // map row of the head centre

const FACE_KEY: Record<string, number> = {
  s: SKIN.lit,
  m: SKIN.mid,
  d: SKIN.shade,
  t: SKIN.hi,
  N: SKIN.hi,
  n: SKIN.lit,
  o: SKIN.mid,
  O: SKIN.shade,
  e: PAL.night0,
  E: PAL.white,
  b: PAL.white,
  B: PAL.mist,
  x: PAL.steel,
  c: SKIN.deep,
};
const FACE_TONE = new Set(['s', 'm', 'd']);

// 16 × 12: head centre = (7, 6). The hat brim covers rows 0–3; row 3 is the brim's cast shadow.
// prettier-ignore
const FACE: readonly string[] = [
  '......mmmmm.....', //  0
  '....mmssssssm...', //  1
  '...mmssssssssm..', //  2
  '..dmddddddddddm.', //  3  shade under the brim
  '..dmsbbbssbbbsmm', //  4  brows (white)
  '..dmseEsssseEsm.', //  5  eyes 1×2 + a catch-light
  '..dmseessseesNno', //  6  nose bridge
  '...dmssssssmnnno', //  7
  '...dmmmmmmmmonoO', //  8  nose bulb
  '....ddddddddoOO.', //  9
  '.....ddddddd....', // 10
  '................', // 11
];
for (const r of FACE) if (r.length !== 16) throw new Error(`hourglass_imp face row '${r}' is ${r.length} wide`);

function faceRows(fx: Readonly<ImpFx>, light: 'left' | 'right'): string[] {
  const rows = FACE.map((r) => r);
  const set = (j: number, i: number, ch: string) => {
    rows[j] = rows[j].slice(0, i) + ch + rows[j].slice(i + 1);
  };
  // eyes (far: cols 5–6, near: cols 10–11, rows 5–6): open = 2×2 with a catch-light; half = one row;
  // shut = a dark lid line
  const EYES = [5, 10];
  if (fx.eye < 0.35) {
    for (const i of EYES) {
      set(5, i, 's');
      set(5, i + 1, 's');
      set(6, i, 'c');
      set(6, i + 1, 'c');
    }
  } else if (fx.eye < 0.75) {
    for (const i of EYES) {
      set(5, i, 's');
      set(5, i + 1, 's');
    }
  }
  // brows: furrowed (-1) angles them down toward the nose, raised (+1) lifts them a row
  if (fx.brow <= -0.5) {
    set(4, 5, 's');
    set(5, 5, 'b');
    set(4, 12, 's');
    set(4, 8, 'b');
    set(4, 9, 'b');
  } else if (fx.brow >= 0.5) {
    for (const i of [5, 6, 7, 10, 11, 12]) {
      set(4, i, 's');
      set(3, i, 'b');
    }
  }
  return light === 'right' ? relightRows(rows, FACE_TONE) : rows;
}

const face: Part = {
  layer: 'head',
  seam: SEAM,
  paint(ctx) {
    const c = ctx.canvas();
    const hx = R(ctx.rig.head[0]);
    const hy = R(ctx.rig.head[1]);
    const rows = faceRows(ctx.pose.fx, ctx.light.from);
    const x0 = hx - FACE_X0;
    const y0 = hy - FACE_Y0;
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const col = FACE_KEY[rows[j][i]];
        if (col !== undefined) c.set(x0 + i, y0 + j, col);
      }
    return c;
  },
};

/** The two eye cells in frame px (near = the one closer to the nose). */
export function eyeCells(rig: BipedRig): { near: V; far: V } {
  const x0 = R(rig.head[0]) - FACE_X0;
  const y0 = R(rig.head[1]) - FACE_Y0;
  return { near: [x0 + 10, y0 + 5], far: [x0 + 5, y0 + 5] };
}

// ------------------------------------------------------------------ hat

/** Quadratic Bézier point. */
const bez = (a: V, b: V, c: V, t: number): V => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];

/** The hat's centreline (base → bent tip) and the half-width along it. */
export function hatPath(hx: number, hy: number, fx: Readonly<ImpFx>, n = 14): { pts: V[]; w: number[] } {
  const b0: V = [hx - 2, hy - 6.5];
  const ctl: V = [hx - 1.5 + fx.hatX * 0.4, hy - 19 + fx.hatY * 0.5];
  const end: V = [hx - 9 + fx.hatX, hy - 12.5 + fx.hatY];
  const pts: V[] = [];
  const w: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(bez(b0, ctl, end, t));
    w.push(9.6 * (1 - t) ** 1.25 + 0.9);
  }
  return { pts, w };
}

const hat: Part = {
  layer: 'head',
  seam: SEAM,
  fold: { top: 0, side: 1, bottom: 0 },
  paint(ctx) {
    const c = ctx.canvas();
    const hx = R(ctx.rig.head[0]);
    const hy = R(ctx.rig.head[1]);
    const fx = ctx.pose.fx;
    const { pts, w } = hatPath(hx, hy, fx);
    // the cone
    plane(
      c,
      ctx.light,
      SKY,
      (m) => {
        for (let i = 0; i < pts.length; i++) m.disc(pts[i][0], pts[i][1], w[i] / 2, MARK);
      },
      { lit: 0.42, shade: 0.2 },
    );
    // the brim: a flat ellipse, its front dipping
    plane(
      c,
      ctx.light,
      SKY,
      (m) => {
        m.ellipse(hx - 2, hy - 5.2, 7.4, 1.9, MARK);
      },
      { lit: 0.4, shade: 0.25 },
    );
    // the gold band above the brim
    const bandY = hy - 7;
    for (let y = bandY; y <= bandY + 1; y++) {
      let x0 = -1;
      let x1 = -1;
      for (let x = hx - 9; x <= hx + 9; x++) if (c.isOpaque(x, y)) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
      if (x0 < 0) continue;
      for (let x = x0 + 1; x <= x1 - 1; x++) {
        const t = (x - x0) / Math.max(1, x1 - x0);
        const lt = ctx.light.from === 'right' ? 1 - t : t;
        c.set(x, y, y === bandY ? (lt < 0.5 ? GOLD.lit : GOLD.mid) : lt < 0.5 ? GOLD.mid : GOLD.shade);
      }
    }
    // the buckle (front) and one star on the cone
    c.rect(hx + 2, bandY, 2, 2, GOLD.hi);
    const s = pts[5];
    const sx = R(s[0]) + 1;
    const sy = R(s[1]);
    // the star: one plus of one tone (no isolated pixel)
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.set(sx + dx, sy + dy, GOLD.lit);
    return c;
  },
};

// ------------------------------------------------------------------ beard

const beard: Part = {
  layer: 'head.front',
  seam: SEAM,
  paint(ctx) {
    const c = ctx.canvas();
    const hx = R(ctx.rig.head[0]);
    const hy = R(ctx.rig.head[1]);
    const fx = ctx.pose.fx;
    const tipX = hx + 1 + fx.beardX;
    const tipY = hy + 9 + fx.beardY;
    plane(
      c,
      ctx.light,
      BEARD,
      (m) => {
        // moustache + upper beard (under the nose) widening to the chin, then the taper
        m.poly(
          [
            [hx - 3.5, hy + 2.5],
            [hx + 1, hy + 3.5],
            [hx + 5.5, hy + 4],
            [hx + 7.2, hy + 5.2],
            [hx + 5.5, hy + 6.3],
            [hx + 4.5, hy + 7],
            [tipX + 2.5, tipY - 2.5],
            [tipX + 0.5, tipY],
            [tipX - 1, tipY - 1.8],
            [tipX - 2.2, tipY - 3],
            [hx - 3.8, hy + 6.5],
            [hx - 4.5, hy + 4],
          ],
          MARK,
        );
      },
      { lit: 0.45, shade: 0.25 },
    );
    // strand lines (steel), two, parallel to the taper
    const l0 = ctx.light.from === 'right' ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      const x0 = hx + 1 + k * 2 - l0;
      for (let y = hy + 5; y < hy + 8 + k; y++) {
        const t = (y - (hy + 5)) / Math.max(1, tipY - (hy + 5));
        const x = R(x0 + (tipX - hx - 1) * t);
        if (c.isOpaque(x, y)) c.set(x, y, BEARD.shade);
      }
    }
    // the mouth under the moustache
    if (fx.mouth > 0.5) {
      const mx = hx + 2;
      const my = hy + 5;
      c.set(mx, my, PAL.night0);
      c.set(mx + 1, my, PAL.night0);
      if (fx.mouth > 1.5) {
        c.set(mx, my + 1, PAL.night0);
        c.set(mx + 1, my + 1, PAL.crim1);
        c.set(mx - 1, my, PAL.night0);
        c.set(mx + 2, my, PAL.night0);
      }
    }
    return c;
  },
};

// ------------------------------------------------------------------ torso: the robe

function teeth(m: PixelCanvas, x0: number, x1: number, hemY: number, sway: number): void {
  for (let x = x0; x <= x1; x++) {
    const k = (((x - x0 + sway) % 4) + 4) % 4;
    if (k >= 2) {
      m.erase(x, hemY);
      m.erase(x, hemY - 1);
    }
  }
}

const torso: Part = {
  layer: 'torso',
  seam: SEAM,
  fold: { top: 1, side: 1, bottom: 1 },
  paint(ctx) {
    const c = ctx.canvas();
    const { rig, light } = ctx;
    const fx = ctx.pose.fx;
    const px = rig.pelvis[0];
    const hemY = R(rig.pelvis[1]) + 6;
    const hemL = R(px - 8);
    const hemR = R(px + 8);
    const wx = rig.waist[0];
    const wy = rig.waist[1];
    const sway = R(fx.hemX);
    plane(
      c,
      light,
      SKY,
      (m) => {
        m.poly(
          [
            [rig.shoulderF[0] - 1.5, rig.chest[1] - 2.5],
            [rig.shoulderN[0] + 1.8, rig.chest[1] - 2.5],
            [wx + 5.2, wy],
            [hemR + 0.5, hemY + 1],
            [hemL - 0.5, hemY + 1],
            [wx - 5, wy],
          ],
          MARK,
        );
        teeth(m, hemL - 1, hemR + 1, hemY, sway);
      },
      { lit: 0.42, shade: 0.22 },
    );
    // gold hem line (above the teeth)
    for (let x = hemL; x <= hemR; x++) {
      if (!c.isOpaque(x, hemY - 2)) continue;
      const t = (x - hemL) / (hemR - hemL);
      const lt = light.from === 'right' ? 1 - t : t;
      c.set(x, hemY - 2, lt < 0.5 ? GOLD.lit : GOLD.mid);
    }
    // two fold creases down from the belt (darker plane lines)
    const fl = light.from === 'right' ? 1 : -1;
    for (const [dx, len] of [
      [-1, 5],
      [3, 4],
    ] as const) {
      const x = R(wx + dx * fl);
      for (let k = 0; k < len; k++) {
        const y = R(wy) + 3 + k;
        if (c.isOpaque(x + (k > 2 ? fl : 0), y) && y < hemY - 2) c.set(x + (k > 2 ? fl : 0), y, SKY.shade);
      }
    }
    // the belt + buckle
    const by = R(wy);
    for (let x = R(wx - 5); x <= R(wx + 5); x++) {
      if (!c.isOpaque(x, by)) continue;
      const t = (x - (wx - 5)) / 10;
      const lt = light.from === 'right' ? 1 - t : t;
      c.set(x, by, lt < 0.5 ? GOLD.lit : GOLD.mid);
      if (c.isOpaque(x, by + 1)) c.set(x, by + 1, lt < 0.5 ? GOLD.mid : GOLD.shade);
    }
    c.rect(R(wx) + 1, by, 2, 2, GOLD.hi);
    c.set(R(wx) + 2, by + 1, GOLD.lit);
    return c;
  },
};

// ------------------------------------------------------------------ legs + boots

const BOOT_KEY: Record<string, number> = { l: WOOD.lit, m: WOOD.mid, d: WOOD.shade, k: WOOD.deep };
const BOOT_TONE = new Set(['l', 'm', 'd']);
// 8 × 5, the sole's centre at column 3, the toe curling forward
// prettier-ignore
const BOOT: readonly string[] = [
  '..lmd...',
  '..lmd...',
  '.lmmmll.',
  'lmmmmmmm',
  'ddddddd.',
];

function legPart(side: 'N' | 'F'): Part {
  return {
    layer: side === 'N' ? 'legN' : 'legF',
    seam: SEAM,
    paint(ctx) {
      const c = ctx.canvas();
      const { rig, light } = ctx;
      const leg = side === 'N' ? rig.legN : rig.legF;
      const foot = side === 'N' ? rig.footN : rig.footF;
      // the stocking: a 2-px stroke hip → knee → ankle (visible when a foot is off the floor)
      plane(
        c,
        light,
        WOOD,
        (m) => {
          m.stroke([leg.root, leg.mid, leg.end], 2.4, 2.2, MARK);
        },
        { lit: 0.5, shade: 0.3 },
      );
      const rows = light.from === 'right' ? relightRows(BOOT, BOOT_TONE) : BOOT;
      const fx = R(foot[0]);
      const fy = R(foot[1]);
      for (let j = 0; j < rows.length; j++)
        for (let i = 0; i < rows[j].length; i++) {
          const col = BOOT_KEY[rows[j][i]];
          if (col !== undefined) c.set(fx - 3 + i, fy - 4 + j, col);
        }
      return c;
    },
  };
}

// ------------------------------------------------------------------ arms + hands

/** Local hand pixels (u along the forearm, v across; v < 0 = the lit/upper side) per grip word. */
type Px = readonly (readonly [number, number])[];
const HAND: Record<string, Px> = {
  // a mitten fist: a 3×3 block less one corner + a thumb knob
  fist: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, -1], [2, -1], [0, -1]],
  // an open palm with four fingers fanned a little
  open: [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [2, -1], [3, -1], [2, 0], [3, 0], [2, 1], [3, 1], [2, 2]],
  // gripping the shaft: the fist plus a visible thumb over it
  hold: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, -1], [1, -1], [2, -1], [1, -2]],
  // one finger pointing
  point: [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [2, -1], [3, -1], [4, -1], [2, 0], [2, 1], [1, 2]],
  // all fingers spread wide
  spread: [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [2, -2], [3, -3], [2, -1], [3, -1], [3, 0], [2, 0], [3, 1], [2, 1], [3, 2], [2, 2], [1, 2]],
  // thumb and finger pinching a grain
  pinch: [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [2, -1], [3, -1], [2, 1], [3, 1], [1, 2]],
};

function handWord(grip: string, fing: number): string {
  if (fing === 1) return 'point';
  if (fing === 2) return 'spread';
  if (fing === 3) return 'pinch';
  return grip === 'hold' ? 'hold' : grip === 'open' ? 'open' : 'fist';
}

function paintHand(c: PixelCanvas, light: Ctx['light'], at: V, dir: number, word: string, tones: Tones): void {
  const a = snap45(dir);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const px = HAND[word] ?? HAND.fist;
  // the hand starts a pixel beyond the wrist and runs along the forearm's direction
  plane(
    c,
    light,
    tones,
    (m) => {
      for (const [u, v] of px) {
        const x = R(at[0] + (u - 0.5) * ca - v * sa);
        const y = R(at[1] + (u - 0.5) * sa + v * ca);
        m.set(x, y, MARK);
      }
    },
    { lit: 0.4, shade: 0.28, rim: false },
  );
}

function armPart(side: 'N' | 'F'): Part {
  return {
    layer: side === 'N' ? 'armN' : 'armF',
    seam: SEAM,
    fold: { top: 1, side: 1, bottom: 1 },
    paint(ctx) {
      const c = ctx.canvas();
      const { rig, light, pose } = ctx;
      const arm = side === 'N' ? rig.armN : rig.armF;
      const pa = side === 'N' ? pose.armN : pose.armF;
      const sleeve = side === 'N' ? SKY : { ...SKY, lit: SKY.mid, mid: SKY.shade, shade: SKY.deep };
      plane(
        c,
        light,
        sleeve,
        (m) => {
          m.stroke([arm.root, arm.mid, arm.end], 3.4, 2.8, MARK);
        },
        { lit: 0.5, shade: 0.3 },
      );
      // the gold cuff: the last 1.5 px of the forearm
      const dx = arm.end[0] - arm.mid[0];
      const dy = arm.end[1] - arm.mid[1];
      const l = Math.hypot(dx, dy) || 1;
      const cx = arm.end[0] - (dx / l) * 1.4;
      const cy = arm.end[1] - (dy / l) * 1.4;
      c.disc(cx, cy, 1.3, side === 'N' ? GOLD.mid : GOLD.shade);
      c.set(R(cx - (light.from === 'right' ? -1 : 1) * 1), R(cy - 1), side === 'N' ? GOLD.lit : GOLD.mid);
      // the hand
      const fing = side === 'N' ? pose.fx.fingN : pose.fx.fingF;
      const word = handWord(pa.grip, fing);
      const dir = Math.atan2(dy, dx);
      const skin = SKIN;
      paintHand(c, light, [arm.end[0], arm.end[1]], dir, word, skin);
      return c;
    },
  };
}

// ------------------------------------------------------------------ staff (shaft + hourglass)

const staff: Part = {
  layer: 'propF',
  seam: SEAM,
  fold: { top: 0, side: 1, bottom: 0 },
  paint(ctx) {
    const geo = staffOf(ctx.rig, ctx.pose.fx);
    if (!geo) return null;
    const c = ctx.canvas();
    paintStaff(c, geo, ctx.light, ctx.pose.fx);
    return c;
  },
};

// ------------------------------------------------------------------ light (after the outline)

const glow: Part = {
  layer: 'glow',
  seam: 'none',
  paint(ctx) {
    const fx = ctx.pose.fx;
    const c = ctx.canvas();
    let any = false;
    // the eyes' gold when casting / roaring
    if (fx.eye >= 1.4 && fx.diss < 0.25 && fx.build > 0.8) {
      const { near, far } = eyeCells(ctx.rig);
      for (const [x, y] of [near, far]) {
        c.set(x, y, PAL.gold3);
        c.set(x, y + 1, PAL.gold4);
      }
      any = true;
    }
    const geo = staffOf(ctx.rig, fx);
    if (geo) {
      paintGlassLight(c, geo, ctx.light, fx);
      any = true;
    }
    // the grains thrown from the far hand / the glass (spray 0 → 1: a fan of 10 that flies out and falls)
    if (fx.spray > 0 && fx.spray < 1) {
      const geo2 = staffOf(ctx.rig, fx);
      const src: V = fx.sprayAt >= 0.5 && geo2 ? [geo2.centre[0] + 4, geo2.centre[1] + 2] : ([ctx.rig.armF.end[0] + 2, ctx.rig.armF.end[1]] as V);
      const t = fx.spray;
      for (let i = 0; i < 12; i++) {
        const a = -0.55 + (i / 11) * 1.05 + (hash(i, 1, 9) - 0.5) * 0.25;
        const sp = 9 + hash(i, 2, 9) * 14;
        const x = R(src[0] + Math.cos(a) * sp * t * 1.6);
        const y = R(src[1] + Math.sin(a) * sp * t * 1.6 + 7 * t * t * (0.5 + hash(i, 3, 9)));
        if (x >= 3 && x < c.w - 3 && y >= 3 && y < c.h - 3) {
          c.set(x, y, i % 3 === 0 ? PAL.gold4 : PAL.gold3);
          if (i % 4 === 0 && t < 0.7) c.set(x - 1, y, PAL.gold3);
        }
      }
      any = true;
    }
    // dust at the heels
    if (fx.dust > 0) {
      const f = ctx.rig.footN;
      const r = 1 + Math.floor(fx.dust * 4);
      for (let i = 0; i < 6; i++) {
        const hx = hash(i, 3, 7);
        const x = R(f[0] - 3 + (i - 2.5) * (1 + fx.dust * 2));
        const y = R(f[1] - 1 - fx.dust * (2 + hx * 3));
        if (i % 2 === 0 || r > 2) c.set(x, y, i % 3 === 0 ? PAL.earth4 : PAL.earth3);
      }
      any = true;
    }
    return any ? c : null;
  },
};

// ------------------------------------------------------------------ sand: the body dissolves into / is built out of grains

/** Top of the body in frame px (the hat tip's rest height): the erosion front runs from here to the floor. */
const BODY_TOP = 14;
const SAND_TONES = [GOLD.lit, GOLD.mid, GOLD.hi, GOLD.lit];
const ERODED = new WeakMap<PixelCanvas, { cx: number; cy: number; d: number; h: number }[]>();

/**
 * Erode a body layer into sand (death: fx.diss 0 → 1, the top goes first; summon / revive: fx.build 0 → 1,
 * the feet form first). Work is in 2 × 2 clusters of the frame (a cluster is whole or gone), the cluster
 * on its way turns the sand's own gold for a moment before it goes; clusters that left are noted for the
 * grain pass (they fall as grains).
 */
export function erode(c: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.diss <= 0 && fx.build >= 1) return;
  const ground = ctx.rig.ground;
  const list: { cx: number; cy: number; d: number; h: number }[] = ERODED.get(ctx.dst) ?? [];
  ERODED.set(ctx.dst, list);
  const seen = new Set<number>();
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (!c.isOpaque(x, y)) continue;
      const cx = x >> 1;
      const cy = y >> 1;
      const h = hash(cx, cy, 11);
      const yf = Math.max(0, Math.min(1, (y - BODY_TOP) / (ground - BODY_TOP)));
      let gone = false;
      let turning = false;
      let d = -1;
      if (fx.diss > 0) {
        d = fx.diss * 1.3 - (yf * 0.5 + h * 0.3);
        if (d > 0.16) gone = true;
        else if (d > 0) turning = true;
      }
      if (fx.build < 1) {
        const b = fx.build * 1.45 - ((1 - yf) * 0.5 + h * 0.3 + 0.22);
        if (b <= 0) {
          gone = true;
          d = Math.max(d, 0) + (0 - b) * 0.5;
        } else if (b < 0.16) turning = true;
      }
      if (gone) {
        c.erase(x, y);
        const k = cy * 64 + cx;
        if (!seen.has(k)) {
          seen.add(k);
          list.push({ cx, cy, d: Math.max(0, d), h });
        }
      } else if (turning) c.set(x, y, SAND_TONES[(x + y + (h * 4) | 0) & 3]);
    }
}

function withErode(p: Part): Part {
  return {
    ...p,
    paint(ctx) {
      const c = p.paint(ctx);
      if (c) erode(c, ctx);
      return c;
    },
  };
}

/** The heap the body falls into (death) / pours into (summon): matter on the floor, outlined with the body. */
const heap: Part = {
  layer: 'front',
  seam: 'none',
  paint(ctx) {
    const fx = ctx.pose.fx;
    let k = 0;
    if (fx.diss > 0) k = Math.min(1, fx.diss * 1.15);
    if (fx.build < 1) k = Math.max(k, fx.build < 0.4 ? fx.build / 0.4 : 1 - (fx.build - 0.4) / 0.6);
    if (k <= 0.02) return null;
    const c = ctx.canvas();
    const gy = R(ctx.rig.ground) - 1;
    const cx = R(ctx.rig.root[0]) + 2;
    const hh = Math.max(1, R(1 + 3.4 * k));
    const hw = 3 + R(9 * Math.sqrt(k));
    for (let r = 0; r < hh; r++) {
      const w = Math.max(1, R(hw * (1 - r / (hh + 0.5))));
      for (let x = cx - w; x <= cx + w; x++) {
        const t = (x - (cx - w)) / Math.max(1, 2 * w);
        const lt = ctx.light.from === 'right' ? 1 - t : t;
        c.set(x, gy - r, r === hh - 1 ? GOLD.hi : lt < 0.4 ? GOLD.lit : lt > 0.78 ? GOLD.mid : GOLD.lit);
      }
    }
    return c;
  },
};

/** Grains in the air: the eroded clusters falling (death) / pouring onto the heap (summon, three streams). */
const grains: Part = {
  layer: 'fx',
  seam: 'none',
  paint(ctx) {
    const fx = ctx.pose.fx;
    const list = ERODED.get(ctx.dst);
    const out = ctx.canvas();
    let any = false;
    const ground = R(ctx.rig.ground) - 1;
    const put = (x: number, y: number, col: number) => {
      if (x >= 0 && y >= 0 && x < out.w && y < out.h) {
        out.set(x, y, col);
        any = true;
      }
    };
    if (list && fx.diss > 0) {
      for (const g of list) {
        if (g.h < 0.4) continue;
        const fall = g.d * 60;
        const y = Math.min(ground - 3, g.cy * 2 + 1 + R(fall));
        if (y >= ground - 3) continue; // landed: the heap shows it
        const x = g.cx * 2 + (g.h < 0.7 ? 0 : 1) + R((g.h - 0.5) * 3);
        put(x, y, g.h > 0.85 ? PAL.gold4 : PAL.gold3);
        if (g.h > 0.7) put(x, y - 1, PAL.gold2);
      }
    }
    if (fx.build < 1 && fx.build > 0) {
      // three streams pour onto the heap while it grows, then thin out as the body forms
      const fade = fx.build < 0.4 ? 1 : Math.max(0, 1 - (fx.build - 0.4) / 0.35);
      if (fade > 0)
        for (let s = 0; s < 3; s++) {
          const x = R(ctx.rig.root[0]) + 2 + (s - 1) * 3;
          for (let i = 0; i < 7; i++) {
            const y = ((R(fx.build * 60) * 2 + i * 8 + s * 5) % 52) + 4;
            if (y < ground - 2 && hash(s, i, 5) < fade + 0.2) put(x, y, i % 3 === 0 ? PAL.gold4 : PAL.gold3);
          }
        }
    }
    return any ? out : null;
  },
};

// ------------------------------------------------------------------ the member's parts table

export const PARTS: Record<string, Part | null> = {
  back: null,
  armF: withErode(armPart('F')),
  legF: withErode(legPart('F')),
  legN: withErode(legPart('N')),
  torso: withErode(torso),
  face: withErode(face),
  beard: withErode(beard),
  hat: withErode(hat),
  armN: withErode(armPart('N')),
  staff,
  heap,
  glow,
  grains,
};

void BUILD;
void CREASE;
