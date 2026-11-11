// Neon Tower — the BACK WALL of hedef-gorunum-3 (arena v3 visual pass, item "Back wall").
// One full-width opaque texture (656 × 110, screen x −8 … 648, y −8 … 102): a dark ceiling vault with pipes, a stone
// cornice, a dark brick field whose bricks turn warm in STEPPED pools round each wall-sconce torch (the tone is chosen
// per brick, so a pool's edge follows the brick courses — no dither, no gradient), square stone pillars with capital,
// courses and base, a framed stone plaque behind the centre emblem, small status boxes and wall pipes, and a dark
// plinth at the foot. Palette colours only, opaque pixels, 1-px ink outlines, light from the top left.
// The banners and the torches themselves are animated sprites placed from the data below (src/view/board-nt/wall.ts,
// src/view/board-nt/lights.ts). Pure PixelCanvas code: runs in Node.

import { BOARD_V4 } from '../../view/layout';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { hash01 } from './wall-kit';

export const NT_BRICKWALL_KEY = 'nt:wall:brick';
/** Texture origin on screen and size. */
export const BRICKWALL_AT = { x: -8, y: -8 } as const;
export const BRICKWALL_W = 656;
export const BRICKWALL_H = 110;

/** Wall-sconce torches: the FLAME centre on screen (the sconce sprite hangs below it). */
export const BRICK_TORCHES: readonly { x: number; y: number }[] = [
  { x: 119, y: 58 },
  // arena v5 step 4: the two gate torches hang 10 px higher (at y 40 the stage's far edge hid the left one)
  { x: 276, y: BOARD_V4 ? 30 : 40 },
  { x: 364, y: BOARD_V4 ? 30 : 40 },
  { x: 501, y: 68 },
];

/** The flicker overlay of torch `i`: the wall repainted with that pool one notch wider, cropped to this rect (screen px). */
export function poolRect(i: number): { x: number; y: number; w: number; h: number } {
  const t = BRICK_TORCHES[i];
  return { x: t.x - 66, y: Math.max(BRICK_TOP, t.y + 6 - 36), w: 132, h: Math.min(PLINTH_Y, t.y + 6 + 36) - Math.max(BRICK_TOP, t.y + 6 - 36) };
}
export function paintPoolFlicker(i: number): PixelCanvas {
  const r = poolRect(i);
  return paintBrickWall(i).crop(r.x - BRICKWALL_AT.x, r.y - BRICKWALL_AT.y, r.w, r.h);
}

/** Square stone pillars (screen x of the left edge, width). */
export const BRICK_PILLARS: readonly { x: number; w: number }[] = [
  { x: -6, w: 18 },
  { x: 109, w: 20 },
  // arena v5 step 4: the two gate pillars are broader (they frame the centre gate)
  BOARD_V4 ? { x: 262, w: 22 } : { x: 268, w: 16 },
  BOARD_V4 ? { x: 356, w: 22 } : { x: 356, w: 16 },
  { x: 531, w: 20 },
  { x: 606, w: 20 },
];

/** Hanging banners (screen x / y of the rod's left end; 16 × 46 sprites). Both crimson with a gold sigil, as in the target. */
// arena v4 step 2: the smaller portrait screens moved out over the left banner's spot; banners in the gaps between the screens
// and the tower crowded the top centre (tried, owner ask: a calmer top), so the v4 wall hangs none
// step 3 (d): two banners come back where they crowd nothing: the left one in the brick bay right of the left screen (x 212..227,
// 30 px clear of the torch at 276, under the phase bar's end), the right one in the bay right of the right torch, under the P2
// panel (x 516..531, y 52..97: the v1 spot; clear of the screen (≤ 478) and the hologram (≥ 548))
export const BRICK_BANNERS: readonly { x: number; y: number }[] = BOARD_V4
  ? [
      { x: 212, y: 24 },
      { x: 516, y: 52 },
    ]
  : [
      { x: 131, y: 22 },
      { x: 513, y: 52 },
    ];

/** Small status boxes with LEDs (screen x / y of the box; the LEDs blink in the view). */
export const BRICK_BOXES: readonly { x: number; y: number; w: number; h: number; leds: readonly (readonly [number, number, number])[] }[] = [
  { x: 12, y: 74, w: 14, h: 12, leds: [[3, 4, PAL.crim2], [7, 4, PAL.leaf2]] },
  { x: 136, y: 76, w: 12, h: 8, leds: [[3, 3, PAL.gold2], [6, 3, PAL.leaf2]] },
  { x: 586, y: 60, w: 12, h: 9, leds: [[3, 3, PAL.leaf2], [7, 3, PAL.crim2]] },
];

const VAULT_BOTTOM = 12; // screen y: the cornice starts here
const BRICK_TOP = 17;
const PLINTH_Y = 91;
const COURSE = 6;

/** Light level 0 … 3 of a point from the sconces (an ellipse, wider than tall, centred a little below the flame). */
let boostIndex = -1;
function lightAt(x: number, y: number, jitter: number): number {
  let best = 9;
  BRICK_TORCHES.forEach((t, i) => {
    const d = Math.hypot((x - t.x) / POOL_RX, (y - (t.y + 6)) / POOL_RY) - (i === boostIndex ? 0.09 : 0);
    if (d < best) best = d;
  });
  best += jitter;
  // final arena pass (verifier #3): every warm band reaches ~0.08 of the radius further (one stepped band brighter at any
  // given distance), the outer rim unchanged — warmer, brighter sconce pools like the target, still hard palette steps.
  return best < 0.3 ? 4 : best < 0.55 ? 3 : best < 0.84 ? 2 : best < 1 ? 1 : 0;
}

/** 4×4 ordered-dither offset (−0.5 … 0.47): the pool's band edges cross-hatch over ~0.16 of the radius, so the halo
 *  melts into the brick instead of ending in a hard ring (dither is allowed on the wall; never on the board top). */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const POOL_DITHER = 0.16;
function bay(x: number, y: number): number {
  return (BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] / 16 - 0.47) * POOL_DITHER;
}

/** Pool radii (px): the warm light reaches ~30 px round a flame; beyond it the wall is cool dark stone. */
const POOL_RX = 34;
const POOL_RY = 28;

/** Brick tones per light level: face, variant face, top highlight, mortar. Far field = desaturated navy-grey. */
const BRICK = [
  // pixel/polish crit round 2 #4: the far-field brick one stone step up (stone0 -> stone1, alt night1 -> stone0); the
  // target's unlit brick averages ≈ #393347, ours was ≈ #1b1721
  { face: PAL.stone1, alt: PAL.stone0, hi: PAL.stone1, mortar: PAL.ink },
  // the pool only BRIGHTENS: warm-brown at its rim, amber / orange near the flame (no darker step anywhere)
  { face: PAL.skin0, alt: PAL.stone1, hi: PAL.skin0, mortar: PAL.ink },
  { face: PAL.skin0, alt: PAL.earth1, hi: PAL.skin1, mortar: PAL.earth0 },
  { face: PAL.earth2, alt: PAL.skin1, hi: PAL.earth3, mortar: PAL.skin0 },
  { face: PAL.earth3, alt: PAL.earth2, hi: PAL.earth4, mortar: PAL.earth1 },
] as const;

/** `boost` ≥ 0 paints that torch's pool one notch wider (the flicker frame, see paintPoolFlicker). */
export function paintBrickWall(boost = -1): PixelCanvas {
  boostIndex = boost;
  try {
    return paintBrickWallInner();
  } finally {
    boostIndex = -1;
  }
}

function paintBrickWallInner(): PixelCanvas {
  const W = BRICKWALL_W;
  const H = BRICKWALL_H;
  const p = new PixelCanvas(W, H);
  const ox = BRICKWALL_AT.x;
  const oy = BRICKWALL_AT.y;
  /** set by screen coordinates */
  const s = (x: number, y: number, c: number): void => {
    const lx = x - ox;
    const ly = y - oy;
    if (lx >= 0 && ly >= 0 && lx < W && ly < H) p.set(lx, ly, c);
  };
  const r = (x: number, y: number, w: number, h: number, c: number): void => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s(x + i, y + j, c);
  };
  const X0 = ox;
  const X1 = ox + W;

  // ---- ceiling vault: near-black with dark arch ribs and two runs of pipe
  r(X0, oy, W, VAULT_BOTTOM - oy, PAL.ink);
  for (let x = X0; x < X1; x += 52) {
    // a shallow rib arch (night0) between ribs
    for (let i = 0; i < 52; i++) {
      const u = (i - 26) / 26;
      const ay = Math.round(-2 + 7 * u * u);
      s(x + i, ay, PAL.night0);
    }
  }
  const pipe = (y: number, light: number, mid: number): void => {
    for (let x = X0; x < X1; x++) {
      s(x, y - 1, PAL.ink);
      s(x, y, light);
      s(x, y + 1, mid);
      s(x, y + 2, PAL.ink);
    }
    for (let x = X0 + 11; x < X1; x += 37) for (let d = -1; d <= 2; d++) s(x, y + d, d === -1 || d === 2 ? PAL.ink : PAL.stone1);
  };
  pipe(2, PAL.night1, PAL.night0);
  pipe(7, PAL.night0, PAL.ink);

  // ---- cornice (stone lip, lit top edge)
  r(X0, VAULT_BOTTOM, W, BRICK_TOP - VAULT_BOTTOM, PAL.night0);
  for (let x = X0; x < X1; x++) {
    s(x, VAULT_BOTTOM, PAL.ink);
    s(x, VAULT_BOTTOM + 1, PAL.stone0);
    s(x, BRICK_TOP - 1, PAL.ink);
  }
  for (let x = X0 + 5; x < X1; x += 9) s(x, VAULT_BOTTOM + 3, PAL.ink);

  // ---- brick field (per-brick tone; the pools step along brick edges)
  for (let row = 0; BRICK_TOP + row * COURSE < PLINTH_Y; row++) {
    const y0 = BRICK_TOP + row * COURSE;
    const off = row % 2 === 0 ? 0 : 7;
    let x = X0 - off;
    let k = 0;
    while (x < X1) {
      const bw = 12 + Math.floor(hash01(row, k, 31) * 5);
      const hv = hash01(row, k, 77);
      const altBrick = hv < 0.22;
      // a few off-tone bricks in the far field: a sunk dark one, a weathered light one (the wall is not one flat pattern)
      const farTone = hv > 0.93 ? PAL.night1 : hv > 0.86 ? PAL.stone2 : -1;
      const L = lightAt(x + bw / 2, y0 + 3, 0);
      // the light is stepped PER PIXEL (concentric flat bands round the flame, no dither), the brick pattern stays
      for (let j = 0; j < COURSE; j++)
        for (let i = 0; i < bw; i++) {
          const yy = y0 + j;
          if (yy >= PLINTH_Y) continue;
          const Lp = lightAt(x + i, yy, bay(x + i, yy));
          const tone = BRICK[Lp];
          let c: number = altBrick ? tone.alt : tone.face;
          if (Lp === 0 && farTone >= 0) c = farTone;
          if (j === COURSE - 1 || i === bw - 1) c = tone.mortar;
          else if (j === 0 && Lp >= 2) c = tone.hi;
          s(x + i, yy, c);
        }
      // a chipped corner now and then (one mortar pixel), only on the dark bricks
      if (L === 0 && hash01(row, k, 91) < 0.18) s(x, y0, PAL.ink);
      x += bw;
      k++;
    }
  }

  // ---- centre plaque (behind the emblem; the emblem sprite sits at 293, 21 · 54 × 25); arena v5 step 4: the carved gate
  if (BOARD_V4) paintGate(s, (x, y) => p.get(x - ox, y - oy));
  else {
    const px = 286;
    const py = 15;
    const pw = 68;
    const ph = 38;
    r(px, py, pw, ph, PAL.night0);
    for (let i = 0; i < pw; i++) {
      s(px + i, py, PAL.ink);
      s(px + i, py + 1, PAL.stone0);
      s(px + i, py + ph - 2, PAL.ink);
      s(px + i, py + ph - 1, PAL.ink);
    }
    for (let j = 0; j < ph; j++) {
      s(px, py + j, PAL.ink);
      s(px + 1, py + j, j > 0 && j < ph - 2 ? PAL.stone0 : PAL.ink);
      s(px + pw - 1, py + j, PAL.ink);
    }
    // inner recess (dark slate; the emblem sprite sits on it)
    r(px + 4, py + 4, pw - 8, ph - 9, PAL.ink);
    r(px + 5, py + 5, pw - 10, ph - 11, PAL.night0);
    // 1-px bevel of the recess: its lower and right lips catch the light (top/left fall into shadow)
    for (let i = 5; i < pw - 4; i++) s(px + i, py + ph - 6, PAL.stone1);
    for (let j = 5; j < ph - 5; j++) s(px + pw - 5, py + j, PAL.stone1);
    // keystone notch on top
    r(px + pw / 2 - 4, py - 3, 8, 4, PAL.night0);
    for (let i = 0; i < 8; i++) s(px + pw / 2 - 4 + i, py - 3, PAL.ink);
    s(px + pw / 2 - 4, py - 2, PAL.ink);
    s(px + pw / 2 + 3, py - 2, PAL.ink);
  }

  // ---- two wall vents flanking the emblem pillars, each with a lit indicator in its player's colour
  for (const [vx, vy, led] of [
    [244, 21, PAL.cyan3],
    [380, 21, PAL.crim3],
  ] as const) {
    const vw = 14;
    const vh = 9;
    r(vx, vy, vw, vh, PAL.ink);
    r(vx + 1, vy + 1, vw - 2, vh - 2, PAL.night0);
    for (let j = vy + 2; j < vy + vh - 1; j += 2) for (let i = vx + 2; i < vx + vw - 2; i++) s(i, j, PAL.stone1);
    for (let i = vx + 1; i < vx + vw - 1; i++) s(i, vy + vh - 1, PAL.stone0); // lit lower lip
    // the indicator box under the vent
    r(vx + vw - 5, vy + vh + 1, 5, 4, PAL.ink);
    s(vx + vw - 4, vy + vh + 2, PAL.stone1);
    s(vx + vw - 3, vy + vh + 2, led);
    s(vx + vw - 2, vy + vh + 2, PAL.stone1);
  }

  // ---- pillars (drawn over the bricks); v5 step 4: each casts a 3-px shadow on the brick to its right (depth)
  if (BOARD_V4)
    for (const pl of BRICK_PILLARS)
      for (let y = BRICK_TOP; y < PLINTH_Y; y++)
        for (let d = 1; d <= 3; d++) {
          const x = pl.x + pl.w + d - 1;
          const c = p.get(x - ox, y - oy);
          if (c !== null && (d < 3 || (x + y) % 2 === 0)) s(x, y, DARKER.get(c) ?? c);
        }
  for (const pl of BRICK_PILLARS) (BOARD_V4 ? paintPillarV5 : paintPillarAt)(s, pl.x, pl.w);

  // ---- wall pipes on the right (two vertical runs with clamps, bending into the vault)
  for (const [px, lit] of [
    [627, PAL.night1],
    [634, PAL.night0],
  ] as const) {
    for (let y = VAULT_BOTTOM; y < PLINTH_Y; y++) {
      s(px - 1, y, PAL.ink);
      s(px, y, lit);
      s(px + 1, y, lit === PAL.night1 ? PAL.night0 : PAL.ink);
      s(px + 2, y, PAL.ink);
    }
    for (let y = VAULT_BOTTOM + 9; y < PLINTH_Y; y += 17) for (let d = -2; d <= 3; d++) s(px + d, y, d === -2 || d === 3 ? PAL.ink : PAL.stone1);
  }

  // ---- status boxes (the LEDs are drawn dim here; the view blinks them)
  for (const b of BRICK_BOXES) {
    r(b.x, b.y, b.w, b.h, PAL.stone0);
    for (let i = 0; i < b.w; i++) {
      s(b.x + i, b.y, PAL.ink);
      s(b.x + i, b.y + b.h - 1, PAL.ink);
      s(b.x + i, b.y + 1, PAL.stone1);
    }
    for (let j = 0; j < b.h; j++) {
      s(b.x, b.y + j, PAL.ink);
      s(b.x + b.w - 1, b.y + j, PAL.ink);
    }
    for (const [lx, ly] of b.leds) s(b.x + lx, b.y + ly, PAL.ink);
    // the cable down to the plinth
    for (let y = b.y + b.h; y < PLINTH_Y; y++) s(b.x + 3, y, PAL.ink);
  }

  // ---- plinth at the foot of the wall
  r(X0, PLINTH_Y, W, oy + H - PLINTH_Y, PAL.night0);
  for (let x = X0; x < X1; x++) {
    s(x, PLINTH_Y, PAL.ink);
    s(x, PLINTH_Y + 1, PAL.stone0);
    s(x, oy + H - 1, PAL.ink);
  }
  for (let x = X0 + 3; x < X1; x += 24) for (let y = PLINTH_Y + 2; y < oy + H - 1; y++) s(x, y, PAL.ink);
  return p;
}

/** One step darker (the pillars' cast shadow on the brick, the gate's recess). */
const DARKER: ReadonlyMap<number, number> = new Map([
  [PAL.earth4, PAL.earth3],
  [PAL.earth3, PAL.earth2],
  [PAL.earth2, PAL.skin1],
  [PAL.earth1, PAL.earth0],
  [PAL.skin2, PAL.skin1],
  [PAL.skin1, PAL.skin0],
  [PAL.skin0, PAL.earth0],
  [PAL.stone3, PAL.stone2],
  [PAL.stone2, PAL.stone1],
  [PAL.stone1, PAL.stone0],
  [PAL.stone0, PAL.ink],
  [PAL.night1, PAL.night0],
  [PAL.night0, PAL.ink],
]);

/** Warm-or-cool stone tones of a pixel (the sconces' stepped pools): highlight, face, shade. */
function stoneTones(x: number, y: number): { hi: number; face: number; shade: number } {
  const lit = lightAt(x, y, bay(x, y));
  return {
    hi: lit >= 3 ? PAL.skin2 : lit >= 1 ? PAL.skin1 : PAL.stone3,
    face: lit >= 3 ? PAL.skin1 : lit >= 1 ? PAL.skin0 : PAL.stone2,
    shade: lit >= 3 ? PAL.skin0 : lit >= 1 ? PAL.stone1 : PAL.stone1,
  };
}

/**
 * Arena v5 step 4: the carved centre GATE of the back wall (an original design): a round arch of dressed voussoirs with a tall
 * carved keystone, straight jambs in courses, and in its deep recess a pair of iron-banded door leaves (planks, rivets, the
 * centre seam). The arch's soffit throws a shadow into the recess, its right reveal catches the light. The steel emblem sprite
 * (view/board-nt/wall.ts) hangs in the arch's head as the carved medallion. The stage hides the gate's lower half.
 */
const GATE = { cx: 320, cy: 54, r0: 27, r1: 35 } as const;
function paintGate(s: (x: number, y: number, c: number) => void, get: (x: number, y: number) => number | null): void {
  const { cx, cy, r0, r1 } = GATE;
  void get;
  const SEG = Math.PI / 9;
  for (let y = VAULT_BOTTOM; y < PLINTH_Y; y++)
    for (let x = cx - r1 - 1; x <= cx + r1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const arch = dy < 0;
      const dist = arch ? Math.hypot(dx, dy) : Math.abs(dx);
      if (dist >= r1 + 3) continue;
      const T = stoneTones(x, y);
      // an outer moulding round the arch: an ink groove, then a lit 1-px bead (upper-left brighter)
      if (dist >= r1 + 2) {
        if (arch) s(x, y, dx < 0 ? T.hi : T.face);
        continue;
      }
      if (dist >= r1) {
        s(x, y, PAL.ink);
        continue;
      }
      if (dist >= r0) {
        // the voussoir ring (arch) / the jambs (courses every 7 px)
        let joint = false;
        if (arch) {
          const a = Math.atan2(-dy, dx); // 0 (right) … π (left)
          const k = Math.round(a / SEG);
          joint = Math.abs(a - k * SEG) * dist < 0.55 && k > 0 && k < 9;
        } else joint = (y - cy) % 7 === 6;
        if (dist < r0 + 1) joint = true; // the inner edge line
        if (joint) {
          s(x, y, PAL.ink);
          continue;
        }
        // light from the top left: the outer lip of the upper-left half is lit, the inner edge in shade
        const lip = dist > r1 - 1.6 && (arch ? dx < 6 : dx < 0);
        const inner = dist < r0 + 2.4;
        const block = arch ? Math.floor(Math.atan2(-dy, dx) / SEG + 0.5) : Math.floor((y - cy) / 7) + 20;
        const alt = (block * 7 + (dx < 0 ? 3 : 0)) % 3 === 0;
        s(x, y, lip ? T.hi : inner ? T.shade : alt ? T.shade : T.face);
        continue;
      }
      // the recess: soffit shadow under the arch, the right reveal lit, then the door leaves
      if (arch && dist > r0 - 3) {
        s(x, y, dx > 4 ? PAL.stone0 : PAL.ink);
        continue;
      }
      if (!arch && dist > r0 - 2) {
        s(x, y, dx > 0 ? PAL.stone0 : PAL.ink);
        continue;
      }
      const lx = Math.abs(dx);
      let c: number = PAL.night0;
      // the leaves' seam: firelight from the corridor behind the gate leaks through it (warm, brighter lower down)
      if (lx < 1) c = y > cy - 6 ? (y > cy + 2 ? PAL.fire2 : PAL.fire1) : PAL.ink;
      else if (lx < 2 && y > cy) c = PAL.fire0;
      else if (Math.floor(lx) % 5 === 0) c = PAL.ink; // planks
      const band = (y - (cy - 14)) % 13;
      if (band === 0) c = PAL.stone1;
      else if (band === 1) c = PAL.stone0;
      if (band === 0 && Math.floor(lx) % 6 === 3) c = PAL.stone2; // rivets
      s(x, y, c);
    }
  // the keystone: a taller block on the arch's crown with a carved diamond, standing 3 px proud of the ring
  const kTop = cy - r1 - 3;
  for (let y = kTop; y <= cy - r0 + 1; y++)
    for (let x = cx - 5; x <= cx + 4; x++) {
      const w = 5 - Math.floor((y - kTop) / 4); // tapering toward the recess
      if (x < cx - w || x > cx + w - 1) continue;
      const T = stoneTones(x, y);
      const edge = x === cx - w || x === cx + w - 1 || y === kTop || y === cy - r0 + 1;
      let c: number = edge ? PAL.ink : x < cx - 1 ? T.hi : T.face;
      const dd = Math.abs(x + 0.5 - cx) + Math.abs(y - (kTop + 5));
      if (!edge && dd < 2.6) c = dd < 1.4 ? PAL.gold2 : T.shade;
      s(x, y, c);
    }
}

/**
 * Arena v5 step 4: a broad stone pillar with a stepped capital (abacus, echinus, astragal), a fluted shaft (one sunk channel
 * with a lit lip) and a stepped base (plinth + torus); tones lifted by the nearest sconce like the bricks.
 */
function paintPillarV5(s: (x: number, y: number, c: number) => void, x0: number, w: number): void {
  const top = VAULT_BOTTOM - 4;
  const baseY = PLINTH_Y - 5;
  // [y offset from top / from baseY, extra width each side] of the capital / base mouldings
  const cap: readonly [number, number][] = [
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 3],
    [4, 2],
    [5, 2],
    [6, 1],
  ];
  const base: readonly [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 4],
    [6, 4],
    [7, 4],
    [8, 4],
  ];
  for (let y = top; y < PLINTH_Y + 8; y++) {
    const ci = y - top;
    const bi = y - baseY;
    const ext = ci < cap.length ? cap[ci][1] : bi >= 0 ? base[Math.min(base.length - 1, bi)][1] : 0;
    const xa = x0 - ext;
    const xb = x0 + w - 1 + ext;
    const moulding = ci < cap.length || bi >= 0;
    // a moulding's top row is lit, the row where it steps in is an ink line (the step's shadow)
    const prevExt = ci < cap.length ? (ci > 0 ? cap[ci - 1][1] : -1) : bi > 0 ? base[Math.min(base.length - 1, bi - 1)][1] : 0;
    const stepRow = moulding && ext !== prevExt;
    for (let x = xa; x <= xb; x++) {
      const T = stoneTones(x, y);
      const i = x - xa;
      const n = xb - xa;
      let c: number;
      if (i === 0 || i === n || y === top || y === PLINTH_Y + 7) c = PAL.ink;
      else if (moulding) {
        if (stepRow) c = ext > prevExt && ci < cap.length ? PAL.ink : i < n * 0.7 ? T.hi : T.face;
        else c = i === 1 ? T.hi : i < n * 0.7 ? T.face : T.shade;
        if (ci === cap.length - 1 || bi === 0) c = PAL.ink;
      } else {
        // the shaft: lit left edge, a sunk channel (ink + lit lip) at 40 %, shaded right third, soft course seams
        const ch = Math.round(n * 0.42);
        if (i === 1) c = T.hi;
        else if (i === ch) c = T.shade === PAL.stone1 ? PAL.stone0 : T.shade;
        else if (i === ch + 1) c = T.hi;
        else if ((y - top) % 12 === 0) c = i < n * 0.7 ? T.shade : PAL.ink;
        else c = i < n * 0.7 ? T.face : T.shade;
      }
      s(x, y, c);
    }
  }
}

/** A square stone pillar: capital (2 px wider), courses every 10 px, base; tones lifted by the nearest sconce. */
function paintPillarAt(s: (x: number, y: number, c: number) => void, x0: number, w: number): void {
  const top = VAULT_BOTTOM - 4;
  const capH = 7;
  const baseY = PLINTH_Y - 4;
  for (let y = top; y < PLINTH_Y + 8; y++) {
    const cap = y < top + capH;
    const base = y >= baseY;
    const inset = cap || base ? -2 : 0;
    const xa = x0 + inset;
    const xb = x0 + w - 1 - inset;
    for (let x = xa; x <= xb; x++) {
      // per-pixel stepped light: cool stone far off, warm stone in a sconce's pool (the same bands as the bricks)
      const lit = lightAt(x, y, bay(x, y));
      // dressed stone, a step LIGHTER than the dark brick so the column reads as a solid mass: lit left edge, flat
      // face, shaded right third, ink block joints; the capital / base carry a bright lip
      // pixel/polish round 3 (#4): more relief — the cool lit edge a step up (stone3), a continuous 1-px lit edge that the
      // course seams no longer cut, and soft (shade, not ink) course seams on the face
      const hi = lit >= 3 ? PAL.skin2 : lit >= 1 ? PAL.skin1 : PAL.stone3;
      const face = lit >= 3 ? PAL.skin1 : lit >= 1 ? PAL.skin0 : PAL.stone2;
      // final arena pass (verifier #3): the unlit shaded third one step darker (stone1 -> stone0): crisper pillar edges
      const shade = lit >= 3 ? PAL.skin0 : PAL.stone0;
      const i = x - xa;
      const n = xb - xa;
      let c: number;
      if (i === 0 || i === n || y === top || y === PLINTH_Y + 7) c = PAL.ink;
      else if ((cap && y === top + capH - 1) || (base && y === baseY)) c = PAL.ink;
      else if ((cap && y <= top + 2) || (base && y === baseY + 1)) c = i < n * 0.7 ? hi : face;
      else if (cap && y === top + capH - 2) c = shade;
      else if (!cap && !base && i === 1) c = hi; // continuous lit edge
      else if (!cap && !base && (y - top) % 10 === 0) c = i < n * 0.7 ? shade : PAL.ink; // course seam
      else c = i === 1 ? hi : i < n * 0.7 ? face : shade;
      s(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------------------------- wall-sconce torch
/** The dedicated wall torch (not the floor brazier): a tall 7 × 13 px flame with a white-yellow core and a 1-px light
 *  halo, in a wide iron bowl with a gold rim, held out from a riveted wall strap by a side arm with a curled scroll. */
export const NT_WALL_TORCH_KEY = (frame: number): string => `nt:wall:brick:torch:${frame}`;
export const WALL_TORCH = { w: 15, h: 28, cx: 7, flameY: 9, frames: 3 } as const;

// 1 fire1 · 2 fire2 · 3 fire3 · 4 fire4 · 5 gold4 core — frame 0 upright, 1 leaning left, 2 leaning right
const FLAME: readonly (readonly string[])[] = [
  ['...1...', '...1...', '..121..', '..121..', '..232..', '.12321.', '.23432.', '.23432.', '2344432', '2345432', '2345432', '.23432.', '..222..'],
  ['.1.....', '..1....', '.121...', '.1221..', '.2332..', '.23321.', '.23432.', '.234432', '2344432', '2345432', '2345432', '.23432.', '..222..'],
  ['.....1.', '....1..', '...121.', '..1221.', '..2332.', '.12332.', '.23432.', '234432.', '2344432', '2345432', '2345432', '.23432.', '..222..'],
];
const FLAME_C: Record<string, number> = { '1': PAL.fire1, '2': PAL.fire2, '3': PAL.fire3, '4': PAL.fire4, '5': PAL.gold4 };
const FLAME_X = 4;
const FLAME_Y = 1;

export function paintWallTorch(frame: number): PixelCanvas {
  const p = new PixelCanvas(WALL_TORCH.w, WALL_TORCH.h);
  // the riveted wall strap on the left (x 0..3, rows 17..27): lit left face, shaded right, gold rivets
  for (let y = 17; y <= 27; y++)
    for (let x = 0; x <= 3; x++) {
      const edge = x === 0 || x === 3 || y === 17 || y === 27;
      p.set(x, y, edge ? PAL.ink : x === 1 ? (y === 18 ? PAL.earth3 : PAL.stone2) : PAL.stone1);
    }
  p.set(1, 20, PAL.gold2).set(2, 20, PAL.gold1).set(1, 25, PAL.gold2).set(2, 25, PAL.gold1);
  // the side arm (row 20) from the strap to the stem, and the stem up into the bowl
  p.hline(3, 8, 19, PAL.ink).hline(4, 7, 20, PAL.stone2).hline(3, 8, 21, PAL.ink);
  p.set(4, 20, PAL.earth2);
  for (let y = 17; y <= 19; y++) p.set(6, y, PAL.ink).set(7, y, y === 17 ? PAL.earth2 : PAL.stone2).set(8, y, PAL.ink);
  p.set(7, 20, PAL.stone2).set(8, 20, PAL.ink);
  // the curled scroll under the arm
  p.set(5, 22, PAL.ink).set(6, 22, PAL.stone1).set(7, 22, PAL.ink);
  p.set(7, 23, PAL.ink).set(6, 24, PAL.ink).set(5, 23, PAL.ink).set(6, 23, PAL.stone0);
  // the bowl (rows 14..17, 2 px wider than before): a lit gold rim, a dark iron bowl
  p.hline(1, 13, 14, PAL.ink);
  p.hline(2, 12, 14, PAL.gold1);
  p.set(2, 14, PAL.earth3).set(3, 14, PAL.gold3).set(4, 14, PAL.gold2);
  p.hline(2, 12, 15, PAL.stone1);
  p.set(2, 15, PAL.ink).set(12, 15, PAL.ink).set(3, 15, PAL.stone2).set(4, 15, PAL.stone2).set(11, 15, PAL.stone0);
  p.hline(3, 11, 16, PAL.stone0);
  p.set(3, 16, PAL.ink).set(11, 16, PAL.ink).set(4, 16, PAL.stone1);
  p.hline(4, 10, 17, PAL.ink);
  // the flame (its root sinks into the rim)
  const f = FLAME[frame % FLAME.length];
  const isFlame = (x: number, y: number): boolean => {
    const row = f[y - FLAME_Y];
    const ch = row === undefined ? undefined : row[x - FLAME_X];
    return ch !== undefined && ch !== '.';
  };
  // a 1-px light halo hugging the flame (orthogonal neighbours, above the rim)
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < WALL_TORCH.w; x++) {
      if (isFlame(x, y)) continue;
      if (isFlame(x - 1, y) || isFlame(x + 1, y) || isFlame(x, y - 1) || isFlame(x, y + 1)) p.set(x, y, y < 5 ? PAL.gold1 : PAL.earth3);
    }
  for (let y = 0; y < f.length; y++)
    for (let x = 0; x < f[y].length; x++) {
      const c = FLAME_C[f[y][x]];
      if (c !== undefined) p.set(x + FLAME_X, y + FLAME_Y, c);
    }
  return p;
}

// ---------------------------------------------------------------------------------------------- upper vault (intro pan)
/** The dark vault above the wall, seen only while the camera pans up (intro): 104 × 110 tile, ribs + arches + a pipe. */
export const NT_BRICK_VAULT_KEY = 'nt:wall:brick:vault';
export const BRICK_VAULT_W = 104;
export const BRICK_VAULT_H = 110;
export function paintBrickVault(): PixelCanvas {
  const W = BRICK_VAULT_W;
  const H = BRICK_VAULT_H;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, PAL.ink);
  for (let x0 = 0; x0 < W; x0 += 52) {
    // a rib (2 px) and the arch springing from it at the tile's foot
    for (let y = 0; y < H; y++) p.set(x0, y, PAL.night0).set(x0 + 1, y, PAL.night1);
    for (let i = 0; i < 52; i++) {
      const u = (i - 26) / 26;
      const ay = Math.round(H - 30 + 22 * u * u);
      p.set(x0 + i, Math.min(H - 1, ay), PAL.night0);
      p.set(x0 + i, Math.min(H - 1, ay + 1), PAL.night0);
    }
  }
  // one pipe run with clamps
  for (let x = 0; x < W; x++) {
    p.set(x, 40, PAL.ink).set(x, 41, PAL.night1).set(x, 42, PAL.night0).set(x, 43, PAL.ink);
  }
  for (let x = 20; x < W; x += 37) for (let d = 40; d <= 43; d++) p.set(x, d, d === 40 || d === 43 ? PAL.ink : PAL.stone0);
  return p;
}
