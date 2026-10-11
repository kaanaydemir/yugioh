// HD Neon arena — the stadium bowl: roof canopy with a truss, two tiers of stands packed with a backlit crowd
// (head-and-shoulder silhouettes, empty seats, stair aisles), the VIP balcony, the inner wall with its LED
// ribbon and faction boards, the dark glossy arena floor far below (big dashed ring, radial lines, a faint
// grid), and the floodlight towers. Animated parts are separate layers: crowd lights (3 blink layers × wave
// strips), LED chase phases, lit lamp banks, the floor ring glow; plus soft light layers (haze over the rim,
// LED reflections on the wet floor, fog banks).

import { PAL } from '../../../art/palette';
import { mix } from '../../../art/pixel';
import { FLOOR_RING, STADIUM_RECT, TOWERS, WALL_H, rimY, standsBottomY } from './geo';
import { Raster, bayer, clamp01, dpick, fbm, fbmX, hash1, hash2, lerp, smoothstep } from './raster';

export const CROWD_STRIP = 96;
export const CROWD_STRIPS = Math.ceil(STADIUM_RECT.w / CROWD_STRIP);
const ROWS = 13;
const TIER = 0.47;

export interface StadiumArt {
  base: Raster;
  /** [layer][strip] */
  crowd: Raster[][];
  led: Raster[];
  ring: Raster; // glow buffer: floor ring dashes
}

function ledColor(x: number, block: number): number {
  const side = x < 375 ? 0 : x > 585 ? 1 : 2;
  return side === 0 ? (block === 0 ? PAL.cyan4 : PAL.cyan3) : side === 1 ? (block === 0 ? PAL.crim4 : PAL.crim3) : PAL.gold3;
}

export function drawStadium(P: number): StadiumArt {
  const R = STADIUM_RECT;
  const base = new Raster(R, P);
  const ring = new Raster(R, P, { glow: true });
  const led = [0, 1, 2].map(() => new Raster(R, P));

  base.each((i, j, x, y) => {
    const top = rimY(x);
    const bot = standsBottomY(x);
    const cTop = top - 8;
    if (y < cTop) return;
    let c: number;
    if (y < top) {
      // roof canopy: lit front edge, truss, dark underside
      const k = y - cTop;
      if (k < P) c = (Math.floor(x / 12) & 1) === 0 ? PAL.night4 : PAL.night3;
      else if (k < 2 * P) c = PAL.night1;
      else if (k < 7) {
        const zig = Math.abs((((x + 400) / 3) % 4) - 2) * 1.5 + 2;
        c = Math.abs(k - zig) < P * 0.6 || ((x + 400) % 12) < P ? PAL.night1 : PAL.ink;
      } else c = PAL.ink;
    } else if (y < bot) {
      const t = (y - top) / (bot - top);
      const rowH = (bot - top) / ROWS;
      const tt = t * ROWS;
      const row = Math.floor(tt);
      const yy = (tt - row) * rowH; // px into the row
      const uA = (x - 480) / lerp(660, 570, t);
      const aisleD = Math.abs(uA * 11 - Math.round(uA * 11)) * lerp(660, 570, t) / 11; // px to the aisle line
      const tierD = Math.abs(t - TIER) * (bot - top);
      const nearLights = row < 3;
      if (tierD < 3.5) {
        // VIP balcony: dark band with gold balcony lights and lit box windows
        c = PAL.ink;
        if (tierD < 1.2 * P && ((x + 600) % 13) < 2 * P) c = PAL.gold1;
        else if (t < TIER && tierD > 2 && tierD < 3.5 && ((x + 600) % 26) > 6 && ((x + 600) % 26) < 18) c = hash1(Math.floor((x + 600) / 26), 5) < 0.4 ? PAL.gold0 : PAL.night1;
      } else if (aisleD < 1.6) {
        // stair aisle: alternating step treads
        c = yy < rowH * 0.5 ? PAL.night2 : PAL.night1;
        if (aisleD < 0.6 && P === 1) c = PAL.night0;
      } else {
        // the crowd: backlit heads and shoulders, a few empty seats
        const pw = 4.3;
        const xp = x + row * 1.73 + 1000;
        const pid = Math.floor(xp / pw);
        const pu = xp / pw - pid;
        const h0 = hash2(pid, row, 77);
        const present = h0 < (row === Math.floor(TIER * ROWS) ? 0.5 : 0.84);
        const standing = hash2(pid, row, 80) < 0.13;
        const hr = 1.35 + 0.35 * hash2(pid, row, 78);
        const hcx = (0.5 + (hash2(pid, row, 79) - 0.5) * 0.3) * pw;
        const hcy = (standing ? 1.0 : 2.0) + hr * 0.4;
        const dx = pu * pw - hcx;
        const dy = yy - hcy;
        // the riser of the row behind
        c = yy < P ? (nearLights ? PAL.night2 : PAL.night1) : bayer(i, j) < 3 ? PAL.night1 : PAL.night0;
        if (present) {
          const inHead = dx * dx + dy * dy <= hr * hr;
          const sw = 0.36 * pw + Math.max(0, yy - hcy - hr) * 0.25;
          const inBody = yy > hcy + hr * 0.55 && Math.abs(dx) < sw;
          if (inHead) {
            c = dy < -hr + P * 0.9 ? (nearLights ? PAL.night3 : PAL.night2) : PAL.ink;
          } else if (inBody) {
            const side = clamp01((x - 300) / 360);
            const tint = hash2(pid, row, 81);
            const shirt = tint < 0.35 ? (tint < 0.35 * (1 - side) ? PAL.cyan0 : PAL.crim0) : tint < 0.5 ? PAL.void0 : PAL.night0;
            c = yy - hcy - hr < P * 1.2 ? (nearLights ? PAL.night1 : PAL.ink) : shirt;
          }
        } else if (Math.abs(dx) < 0.32 * pw && yy > 1.5 && yy < 4.5) {
          c = yy < 2.5 ? PAL.night2 : PAL.night1; // empty seat back
        }
      }
    } else if (y < bot + WALL_H) {
      const k = y - bot;
      // inner wall: lip, LED ribbon, boards, lit bottom edge
      if (k < 2) c = PAL.ink;
      else if (k < 5) {
        c = PAL.ink;
        const seg = Math.floor((x + 1200) / 3);
        const ph = seg % 3;
        const block = Math.floor((x + 1200) / 27) % 4;
        if (block !== 3 && (k < 4 || block !== 1)) led[ph].put(i, j, ledColor(x, block));
      } else if (k < 6) c = PAL.ink;
      else if (k < WALL_H - 2) {
        c = PAL.night1;
        if (((x + 1200) % 21) < P) c = PAL.night0;
        // faction boards: a dim emblem every 63 px (cyan diamonds on P1's side, crimson on P2's)
        const bx = ((x + 1200) % 63) - 31.5;
        const by = k - 9.5;
        if (Math.abs(bx) < 14 && Math.abs(by) < 3.5) {
          c = Math.abs(bx) > 13 - P || Math.abs(by) > 3.5 - P ? PAL.night2 : PAL.night0;
          const em = Math.abs(bx) / 2 + Math.abs(by);
          if (em < 2.6) c = x < 480 ? (em < 1.4 ? PAL.cyan2 : PAL.cyan1) : em < 1.4 ? PAL.crim2 : PAL.crim1;
          else if (Math.abs(by) < 0.6 && Math.abs(bx) > 5 && Math.abs(bx) < 11 && (i & 1) === 0) c = PAL.night3;
        }
      } else if (k < WALL_H - 1) c = PAL.night2;
      else c = PAL.night3;
    } else {
      // the arena floor far below: dark, glossy, a giant glowing ring under the platform
      const fy = y - (bot + WALL_H);
      const n = fbm(x / 70, y / 45, 4, 5);
      const v = 0.6 + n * 0.75 - Math.min(0.55, fy / 220);
      c = dpick([PAL.ink, PAL.night0, PAL.night1], v, i, j);
      const ex = (x - FLOOR_RING.x) / FLOOR_RING.rx;
      const ey = (y - FLOOR_RING.y) / FLOOR_RING.ry;
      const er = Math.hypot(ex, ey);
      const grad = Math.hypot(ex / FLOOR_RING.rx, ey / FLOOR_RING.ry) / Math.max(1e-6, er);
      const dist = (er - 1) / grad; // ≈ px to the ring
      const ang = Math.atan2(ey, ex);
      const ang01 = ang / (Math.PI * 2) + 0.5;
      // faint floor grid (perspective-flattened squares) fading away from the ring's center
      const gx = (x - 480) / 64;
      const gy = ((y - FLOOR_RING.y) * 4) / 64;
      const fgx = Math.abs(gx - Math.round(gx)) * 64;
      const fgy = Math.abs(gy - Math.round(gy)) * 16;
      if ((fgx < P * 0.5 || fgy < P * 0.5) && er < 1.5 && bayer(i, j) < 6 * (1 - er / 1.5)) c = PAL.night1;
      // radial lines
      if (er > 0.82 && er < 1.7 && Math.abs(((ang01 * 24) % 1) - 0.5) > 0.5 - 0.02 / Math.max(0.6, er) && bayer(i, j) < 8) c = PAL.night1;
      // inner dotted ring
      const di = (er - 0.84) / grad;
      if (Math.abs(di) < P * 0.5 && bayer(i, j) < 7) c = PAL.night2;
      // the big dashed ring: cyan on P1's side, crimson on P2's
      const dash = Math.floor((ang01 * 360) % 8);
      if (Math.abs(dist) < P * 0.75 && dash < 5) {
        const left = x < 480;
        c = dash === 0 ? (left ? PAL.cyan2 : PAL.crim2) : left ? PAL.cyan1 : PAL.crim1;
        ring.glow(i, j, dash === 0 ? (left ? PAL.cyan4 : PAL.crim4) : left ? PAL.cyan3 : PAL.crim3, dash === 0 ? 255 : 150);
      } else if (Math.abs(dist) < P * 2.2 && dash < 5 && bayer(i, j) < 5) {
        c = x < 480 ? PAL.cyan0 : PAL.crim0;
      }
      if (fy < 3) c = PAL.ink;
    }
    base.put(i, j, c);
  });

  // floodlight towers: lattice masts with lamp housings (behind the canopy)
  for (const t of TOWERS) {
    base.each(
      (i, j, x, y) => {
        if (y >= rimY(x) - 8) return;
        const dx = x - t.x;
        const ly = y - t.lampY;
        if (Math.abs(ly) <= 7 && Math.abs(dx) <= 11) {
          // housing
          let c: number = PAL.ink;
          if (ly < -6 + P) c = PAL.night3;
          else {
            const cx = ((dx + 10.5) % 7) - 3.5;
            const cy = ((ly + 6) % 6) - 3;
            if (Math.abs(cx) < 2.5 && Math.abs(cy) < 2) c = PAL.night1;
          }
          if (Math.abs(dx) > 11 - P) c = dx < 0 ? PAL.night2 : PAL.ink;
          base.put(i, j, c);
          return;
        }
        if (ly > 7 && ly < 12 && Math.abs(dx) < 2.5) {
          base.put(i, j, PAL.ink); // bracket
          return;
        }
        if (ly >= 12 && y <= t.baseY) {
          const k = (ly - 12) % 12;
          const bx = k < 6 ? -3 + k : 3 - (k - 6);
          if (Math.abs(Math.abs(dx) - 3) < P * 0.6) base.put(i, j, dx < 0 ? PAL.night1 : PAL.ink);
          else if (Math.abs(dx - bx) < P * 0.6) base.put(i, j, PAL.ink);
        }
      },
      { x: t.x - 13, y: t.lampY - 9, w: 26, h: t.baseY - t.lampY + 12 },
    );
  }

  // crowd lights: phone screens and glow sticks (left fans cyan, right fans crimson), 3 blink layers × strips
  const crowd: Raster[][] = [];
  const perLayer = Math.round(P === 1 ? 1350 : 720);
  for (let layer = 0; layer < 3; layer++) {
    const strips: Raster[] = [];
    for (let s = 0; s < CROWD_STRIPS; s++) strips.push(new Raster({ x: R.x + s * CROWD_STRIP, y: R.y, w: CROWD_STRIP, h: 420 }, P));
    for (let k = 0; k < perLayer; k++) {
      const x = R.x + hash2(k, layer, 100) * R.w;
      const top = rimY(x) + 3;
      const bot = standsBottomY(x) - 2;
      const y = lerp(top, bot, Math.pow(hash2(k, layer, 101), 0.8));
      const t = (y - rimY(x)) / (standsBottomY(x) - rimY(x));
      if (Math.abs(t - TIER) * (bot - top) < 4) continue;
      const side = clamp01((x - 300) / 360);
      const q = hash2(k, layer, 102);
      let c: number;
      if (q < 0.72) c = hash2(k, layer, 103) < 1 - side ? (hash2(k, layer, 104) < 0.7 ? PAL.cyan3 : PAL.cyan4) : hash2(k, layer, 104) < 0.7 ? PAL.crim3 : PAL.crim4;
      else if (q < 0.84) c = PAL.gold3;
      else if (q < 0.93) c = PAL.white;
      else c = PAL.mag3;
      if (hash2(k, layer, 105) < 0.3) c = mix(c, PAL.night1, 0.4);
      const s = Math.min(CROWD_STRIPS - 1, Math.floor((x - R.x) / CROWD_STRIP));
      const st = strips[s];
      const i = st.ix(x);
      const j = st.iy(y);
      st.put(i, j, c);
      if (P === 1 && hash2(k, layer, 106) < 0.25) st.put(i, j - 1, mix(c, PAL.night1, 0.35)); // a glow stick
    }
    crowd.push(strips);
  }
  return { base, crowd, led, ring };
}

/** The lit floodlight bank (overlay on the housing), centred. */
export function drawLamp(P: number): Raster {
  const r = new Raster({ x: -11, y: -7, w: 22, h: 14 }, P);
  r.each((i, j, dx, ly) => {
    if (ly < -6 + P || Math.abs(dx) > 11 - P) return;
    const cx = ((dx + 10.5) % 7) - 3.5;
    const cy = ((ly + 6) % 6) - 3;
    if (Math.abs(cx) < 2.5 && Math.abs(cy) < 2) {
      const core = Math.abs(cx) < 1 && Math.abs(cy) < 1;
      r.put(i, j, core ? PAL.white : Math.abs(cx) < 2 ? PAL.gold4 : PAL.gold3);
    }
  });
  return r;
}

// ---------------------------------------------------------------- soft light layers (linear filtered, world-aligned at 1/4 res)

export const SOFT_Q = 4;

/** Haze glowing above the stadium rim (white alpha). */
export function hazeAlpha(x: number, y: number): number {
  const k = rimY(x) - 6 - y;
  if (k < -4 || k > 90) return 0;
  const v = Math.pow(1 - Math.max(0, k) / 90, 1.8) * (k < 0 ? 1 + k / 4 : 1);
  return v * (0.75 + 0.25 * fbm(x / 80, y / 40, 2, 9));
}

/** LED ribbon + crowd reflections on the glossy floor: colour and alpha. */
export function reflection(x: number, y: number): { c: number; a: number } {
  const wallBot = standsBottomY(x) + WALL_H;
  const dy = y - wallBot;
  if (dy < 0 || dy > 120) return { c: 0, a: 0 };
  const block = Math.floor((x + 1200) / 27) % 4;
  if (block === 3) return { c: 0, a: 0 };
  const streak = 0.55 + 0.45 * fbm(x / 2.5, dy / 30, 2, 33);
  const a = Math.exp(-dy / 34) * streak * 0.9;
  return { c: ledColor(x, block), a };
}

/** Tileable fog band alpha (period FOG.w along x). kind 0 far haze, 1 under-platform bank, 2 near wisps. */
export const FOG = { w: 256, h: 64 };
export function fogAlpha(kind: number, x: number, y: number): number {
  const ty = y / FOG.h;
  const env = kind === 2 ? smoothstep(0, 0.6, ty) : Math.sin(ty * Math.PI);
  const n = fbmX((x / FOG.w) * [5, 4, 3][kind], ty * [3, 4, 3][kind], [5, 4, 3][kind], 4, 300 + kind);
  const v = (n - [0.32, 0.36, 0.4][kind]) * 2.2 * env;
  return clamp01(v);
}

