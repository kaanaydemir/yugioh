// Kalkan Devi — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts),
// painted at the cut-in's own pixel density (3× the sprite's: every plate, bevel and rivet is drawn at this
// density, never the 1× sprite enlarged — KART / cut-in lesson of the magus fix r2b).
//
// The bust is the v3 sprite's (src/art/monsters-v3/shield_titan-*.ts) close-up: the upper part of the tower
// slab fills the right of the frame (the same ogive crown, the iron frame bevelled by the key light, bronze
// panels with a lit and a shaded band, the iron strap with its gold rivets, the crest's crimson field and gold
// tower cropped by the frame), the sight slot at its upper left with the AMBER EYES burning in it, the dark
// pauldron with its spike and its three lames + bronze trim on the left, the tattered rag hanging from the
// crown. One key light from the frame's top-left, flat value planes by pixel counts, 1-px ink outline, no
// dither, no gradient. P2 sees a RELIT set (p2: 'relight'): every band follows `lightFrom`, the geometry and
// the emissive light are the same in both sets.
//
// Rhythm (holds, played once, the last frame held), on the default cut-in beats — a patient, heavy wall:
//   f0   the stare: the lid half down, the eyes a dull amber
//   f1   the lid lifts, the eyes ignite
//   f2   the eyes flare white-hot, the slot's frame catches the light
//   f3   the slab leans toward the foe a pixel row at a time (the bash's wind-up), the tower's windows kindle
//   f4   the lean at its furthest, the windows blaze, the rag whips
//   f5   held while the band closes
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) is the left eye's white core.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;

type V = readonly [number, number];

/** Iron (night1 … mist) and bronze (earth0 … earth4) tones: D S M L H, plus the top highlight. */
const IRON = [PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist] as const;
const BRONZE = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;

interface Pose {
  /** the lid over the eyes: 0 wide open … 1 steady … 2 half down */
  lid: number;
  /** the eyes: 1 amber, 2 white-hot */
  eye: number;
  /** px the slab's top leans toward the foe (rows step out from the foot) */
  lean: number;
  /** the tower's windows: 0 dark … 2 blazing */
  sun: number;
  /** the rag's wave phase */
  rag: number;
  /** the slot frame / rim catches the light */
  flare: number;
}

const POSES: readonly Pose[] = [
  { lid: 2, eye: 1, lean: 0, sun: 0, rag: 0, flare: 0 },
  { lid: 1, eye: 1, lean: 0, sun: 0, rag: 0.15, flare: 0 },
  { lid: 0, eye: 2, lean: 0, sun: 0.5, rag: 0.3, flare: 1 },
  { lid: 0, eye: 2, lean: 4, sun: 1, rag: 0.5, flare: 0.5 },
  { lid: 0, eye: 2, lean: 7, sun: 2, rag: 0.7, flare: 0 },
  { lid: 0, eye: 2, lean: 7, sun: 2, rag: 0.85, flare: 0 },
];
const HOLDS: readonly number[] = [240, 110, 100, 90, 150, 600];

const factory: CutinFactory = () => {
  // ---------------------------------------------------------------- geometry of the slab (cut-in px)
  const SX = 62; // the slab's left edge
  const SY = -14; // the slab's top (the crown's apex row is cropped a little by the frame's top? no: visible from y 2)
  const SW = 120;
  const SHT = 190;
  /** the ogive crown: the rows above this offset are outside the slab (smooth, from the sprite's profile ×4) */
  const CROWN: readonly number[] = [6, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6];
  const topOff = (x: number): number => {
    const u = (x / (SW - 1)) * (CROWN.length - 1);
    const i = Math.max(0, Math.min(CROWN.length - 2, Math.floor(u)));
    return (CROWN[i] + (CROWN[i + 1] - CROWN[i]) * (u - i)) * 4;
  };
  const insideSlab = (x: number, y: number): boolean => x >= 0 && x < SW && y >= topOff(x) && y < SHT;

  function slab(p: PixelCanvas, P: Pose, light: 'left' | 'right'): void {
    const left = light === 'left';
    const ld: V = left ? [-0.6, -0.8] : [0.6, -0.8];
    const R0 = 3;
    const R1 = 7;
    const sh = (y: number) => Math.round((P.lean * Math.max(0, 70 - y)) / 70); // the lean: the top rows step out
    const put = (x: number, y: number, c: number) => p.set(SX + x + sh(y), SY + y, c);
    // the iron frame (two rings, lit by the key light) over the bronze panels
    for (let y = 0; y < SHT; y++)
      for (let x = 0; x < SW; x++) {
        if (!insideSlab(x, y)) continue;
        // distance to the outside, its direction (a normal)
        let nx = 0;
        let ny = 0;
        let near = 99;
        for (let dy = -R1; dy <= R1; dy++)
          for (let dx = -R1; dx <= R1; dx++) {
            if (!dx && !dy) continue;
            if (insideSlab(x + dx, y + dy) || y + dy >= SHT) continue;
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            if (d < near) {
              near = d;
              nx = 0;
              ny = 0;
            }
            if (d === near) {
              nx += dx;
              ny += dy;
            }
          }
        if (near <= R1) {
          const m = Math.hypot(nx, ny) || 1;
          const out = (nx / m) * ld[0] + (ny / m) * ld[1];
          const top = ny / m < -0.55;
          let c: number;
          if (near <= R0) c = top ? IRON[5] : out > 0.5 ? IRON[4] : out > 0.1 ? IRON[3] : out > -0.35 ? IRON[2] : IRON[1];
          else c = top ? IRON[3] : out > 0.35 ? IRON[3] : out > -0.25 ? IRON[2] : IRON[1];
          put(x, y, c);
          continue;
        }
        // the bronze panel: a lit band on the light's side, a shaded band opposite, a 1-px bevel at every iron edge
        const u = (x - R1) / (SW - 2 * R1);
        const lt = left ? 1 - u : u;
        put(x, y, lt > 0.72 ? BRONZE[3] : lt < 0.26 ? BRONZE[1] : BRONZE[2]);
      }
    // the straps (iron, with a lit top row and a dark bottom row) and their gold rivets
    for (const [y0, y1] of [[96, 111], [168, 183]] as const) {
      for (let y = y0; y <= y1; y++)
        for (let x = R1 - 1; x < SW - R1 + 1; x++) put(x, y, y < y0 + 3 ? IRON[3] : y > y1 - 3 ? IRON[0] : IRON[2]);
      for (let x = 14; x < SW - 8; x += 17) {
        for (const [dx, dy, c] of [[0, 0, PAL.gold3], [1, 0, PAL.gold3], [2, 0, PAL.gold2], [0, 1, PAL.gold3], [1, 1, PAL.gold2], [2, 1, PAL.gold1], [0, 2, PAL.gold2], [1, 2, PAL.gold1], [2, 2, PAL.gold1]] as const) put(x + dx, y0 + 6 + dy, left ? c : c);
        put(left ? x : x + 2, y0 + 6, PAL.gold4);
      }
    }
    // the sight slot: a lipped window; the helm's dark visor fills it (the eyes are light, drawn later)
    const wx0 = 14;
    const wy0 = 42;
    const ww = 52;
    const wh = 26;
    for (let y = wy0 - 4; y < wy0 + wh + 4; y++)
      for (let x = wx0 - 4; x < wx0 + ww + 4; x++) {
        const inside = x >= wx0 && x < wx0 + ww && y >= wy0 && y < wy0 + wh;
        if (inside) put(x, y, PAL.night0);
        else {
          const topLip = y < wy0;
          const litSide = left ? x < wx0 : x >= wx0 + ww;
          put(x, y, topLip ? IRON[4] : litSide ? IRON[3] : IRON[1]);
        }
      }
    // the visor's brow plate and cheek rows
    for (let x = wx0; x < wx0 + ww; x++) {
      for (let y = wy0; y < wy0 + 4; y++) put(x, y, y === wy0 ? IRON[3] : IRON[2]);
      for (let y = wy0 + wh - 4; y < wy0 + wh; y++) put(x, y, y === wy0 + wh - 1 ? IRON[0] : IRON[1]);
    }
    // the crest: a crimson heater in a gold border, the gold tower on it (cropped by the frame)
    crest(p, SX + sh(150) + 36, SY + 124, P, left);
  }

  /** The crest at 3×: field, border, the tower with merlons, window and gate. (x, y) = the field's top-left. */
  function crest(p: PixelCanvas, x: number, y: number, P: Pose, left: boolean): void {
    const w = 46;
    const h = 64;
    const edge = left ? [PAL.crim3, PAL.crim2, PAL.crim1] : [PAL.crim1, PAL.crim2, PAL.crim3];
    for (let j = 0; j < h; j++) {
      const taper = j < 40 ? 0 : Math.round((j - 40) * 0.6);
      for (let i = taper; i < w - taper; i++) {
        const border = j === 0 || i === taper || i === w - taper - 1;
        const band = i - taper < 9 ? edge[0] : i - taper > w - 2 * taper - 10 ? edge[2] : edge[1];
        p.set(x + i, y + j, border ? PAL.gold3 : band);
      }
    }
    // the tower: body, three merlons, a window and a gate
    const tx = x + 11;
    const ty = y + 12;
    for (let j = 0; j < 34; j++) for (let i = 0; i < 24; i++) p.set(tx + i, ty + 6 + j, i < 4 ? PAL.gold4 : i > 19 ? PAL.gold1 : PAL.gold3);
    for (const mx of [0, 9, 18]) for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) p.set(tx + mx + i, ty + j, i < 2 ? PAL.gold4 : i > 3 ? PAL.gold2 : PAL.gold3);
    const win = P.sun >= 1.5 ? PAL.gold4 : P.sun >= 0.5 ? PAL.gold3 : PAL.night0;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) p.set(tx + 9 + i, ty + 14 + j, win);
    for (let j = 0; j < 12; j++) for (let i = 0; i < 9; i++) if (!(j < 3 && (i < 2 || i > 6))) p.set(tx + 8 + i, ty + 26 + j, P.sun >= 1.5 ? PAL.gold2 : PAL.night0);
    for (let i = 0; i < 24; i++) p.set(tx + i, ty + 40, PAL.gold1);
  }

  function pauldron(p: PixelCanvas, light: 'left' | 'right'): void {
    const left = light === 'left';
    const cx = 42;
    const cy = 98;
    // the dome: three lames, each a wider ellipse segment banded by the light; bronze trim between them
    const lames: readonly (readonly [number, number, number, number])[] = [
      [cy - 22, 30, 24, 0],
      [cy + 4, 34, 22, 1],
      [cy + 28, 36, 20, 2],
    ];
    const tones = [IRON[3], IRON[2], IRON[1], IRON[0]]; // the giant's armour is the darker alloy (one step under the slab's frame)
    for (const [ly, rx, ry] of lames.map(([a, b, c]) => [a, b, c] as const)) {
      for (let y = ly - ry; y <= ly + ry; y++)
        for (let x = cx - rx; x <= cx + rx; x++) {
          const ex = (x - cx) / rx;
          const ey = (y - ly) / ry;
          if (ex * ex + ey * ey > 1 || (y > ly && ry < 0)) continue;
          const u = (ex + 1) / 2;
          const k = u < 0.22 ? 0 : u < 0.5 ? 1 : u < 0.8 ? 2 : 3;
          p.set(x, y, ey < -0.82 && u < 0.7 ? IRON[4] : tones[left ? k : 3 - k]);
        }
    }
    // bronze trim under the first two lames and a dark seam under the last
    for (const [ty, rx] of [[cy + 3, 32], [cy + 29, 35]] as const) for (let x = cx - rx; x <= cx + rx; x++) for (let j = 0; j < 4; j++) p.set(x, ty + j, j === 0 ? BRONZE[3] : j === 3 ? BRONZE[1] : BRONZE[2]);
    // rivets
    for (const [rx, ry] of [[-14, -4], [14, -2], [-22, 26], [20, 28]] as const) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) p.set(cx + rx + i, cy + ry + j, i + j < 2 ? PAL.gold3 : PAL.gold1);
    // the spike on the dome
    for (let j = 0; j < 24; j++) for (let i = 0; i < Math.max(1, 7 - Math.floor(j / 3.5)); i++) p.set(cx - 15 + i + Math.floor(j / 8), cy - 44 - j + 14, i < 2 ? IRON[4] : i < 5 ? IRON[2] : IRON[0]);
  }

  /** The tattered rag hung from the crown: three columns of crimson, a wave running down it. */
  function rag(p: PixelCanvas, P: Pose, left: boolean): void {
    const ph = P.rag * Math.PI * 2;
    for (let j = 0; j < 46; j++) {
      const sway = Math.round(Math.sin(ph + j * 0.18) * (0.4 + j * 0.08) * 1.6);
      const w = j > 40 ? 6 : 10;
      for (let i = 0; i < w; i++) p.set(SX + 90 + i + sway, SY + 22 + j, (left ? i < 3 : i > w - 4) ? PAL.crim3 : (left ? i > w - 4 : i < 3) ? PAL.crim1 : PAL.crim2);
    }
  }

  function eyes(p: PixelCanvas, P: Pose): void {
    const wx = SX + 14;
    const wy = SY + 42;
    const rows = P.lid >= 2 ? [10, 11, 12, 13] : P.lid >= 1 ? [8, 9, 10, 11, 12, 13, 14] : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    for (const ex of [6, 30]) {
      for (const r of rows) {
        const edge = r === rows[0] || r === rows[rows.length - 1];
        for (let i = 0; i < 16; i++) {
          // slanted slits: the outer ends step down
          const slant = ex === 6 ? Math.floor(i / 6) : Math.floor((15 - i) / 6);
          const y = wy + r + (P.lid >= 1 ? slant : 0);
          const hot = P.eye >= 2;
          const c = edge ? (hot ? PAL.fire3 : PAL.fire2) : hot ? PAL.fire4 : i > 5 && i < 10 ? PAL.fire3 : PAL.fire2;
          p.set(wx + ex + i, y, c);
        }
      }
      // the white-hot core (and the lens glint on f0's near eye)
      p.set(wx + ex + (ex === 6 ? 11 : 4), wy + rows[Math.floor(rows.length / 2)] + (P.lid >= 1 ? 1 : 0), PAL.white);
      if (P.eye >= 2) for (const r of rows.slice(1, -1)) p.set(wx + ex + (ex === 6 ? 10 : 5), wy + r + 1, PAL.white);
    }
    // the red spill of a blazing eye into the dark visor above and below the slits
    if (P.eye >= 2) for (const ex of [6, 30]) for (let i = 2; i < 14; i += 2) p.set(wx + ex + i, wy + rows[0] - 2, PAL.fire1);
  }

  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const light = o?.lightFrom === 'right' ? 'right' : 'left';
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    const body = new PixelCanvas(W, H);
    slab(body, P, light);
    rag(body, P, light === 'left');
    pauldron(body, light);
    body.outline(PAL.ink);
    p.blit(body, 0, 0);
    // ---- light (no outline): the eyes, the slot lip's flare
    eyes(p, P);
    if (P.flare > 0) for (let x = SX + 10; x < SX + 70; x++) p.set(x, SY + 38, P.flare >= 1 ? PAL.white : PAL.mist);
  }

  return { id: 'shield_titan', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.earth3, accentDark: PAL.earth1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
