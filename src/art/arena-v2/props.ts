// Arena v2 small props, each with many animation frames: camera drones, referee light pylons,
// waving fan flags, banners over the stand railing, the lit floodlight banks, the scoreboard.

import type { PlayerId } from '../../engine/types';
import { PAL, RAMPS } from '../palette';
import { type Color, PixelCanvas } from '../pixel';

// ---------------------------------------------------------------- drones

export const DRONE_W = 21;
export const DRONE_H = 13;
export const DRONE_ROTOR_FRAMES = 4;

/** Drone frames named `${tilt}:${rotor}` (tilt -1 | 0 | 1 → left side lower / level / right lower). */
export function drawDrones(): [string, PixelCanvas][] {
  const out: [string, PixelCanvas][] = [];
  for (const tilt of [-1, 0, 1]) {
    for (let f = 0; f < DRONE_ROTOR_FRAMES; f++) {
      const p = new PixelCanvas(DRONE_W, DRONE_H);
      const cx = 10;
      const cy = 6;
      const yAt = (x: number) => cy + Math.round(((x - cx) / 9) * tilt);
      // arms out to the rotor hubs
      for (let x = cx - 8; x <= cx + 8; x++) p.set(x, yAt(x), x === cx - 8 || x === cx + 8 ? PAL.mist : PAL.night4);
      // body (a rounded pod) with a lit top
      for (let x = cx - 4; x <= cx + 4; x++) {
        const y = yAt(x);
        p.set(x, y - 1, Math.abs(x - cx) < 4 ? PAL.white : PAL.mist);
        p.set(x, y, Math.abs(x - cx) < 3 ? PAL.mist : PAL.steel);
        p.set(x, y + 1, Math.abs(x - cx) < 4 ? PAL.night4 : PAL.night3);
      }
      p.set(cx - 2, yAt(cx), PAL.night2).set(cx + 2, yAt(cx), PAL.night2);
      // camera gimbal under the body with its lens
      p.set(cx, yAt(cx) + 2, PAL.night1).set(cx + 1, yAt(cx) + 2, PAL.night1);
      p.set(cx, yAt(cx) + 3, PAL.night0).set(cx + 1, yAt(cx) + 3, PAL.cyan4);
      // rotor posts + spinning blades (motion-blur frames)
      for (const hx of [cx - 8, cx + 8]) {
        const hy = yAt(hx) - 2;
        p.set(hx, hy + 1, PAL.steel);
        const blade = [
          [-4, 4],
          [-3, 2],
          [-1, 1],
          [-3, 3],
        ][f];
        for (let x = hx + blade[0]; x <= hx + blade[1]; x++) p.set(x, hy, Math.abs(x - hx) <= 1 ? PAL.mist : PAL.steel, 200);
        if (f === 2) p.set(hx - 4, hy, PAL.night4, 120).set(hx + 4, hy, PAL.night4, 120);
      }
      p.outline(PAL.ink);
      out.push([`${tilt}:${f}`, p]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- pylons

export const PYLON_W = 11;
export const PYLON_H = 24;
/** Beacon lamp center inside the pylon texture. */
export const PYLON_LAMP = { x: 5, y: 4 };
export const BEACON_FRAMES = 6;

export function drawPylon(): PixelCanvas {
  const p = new PixelCanvas(PYLON_W, PYLON_H);
  const cx = 5;
  // base plate
  p.ellipse(cx + 0.5, PYLON_H - 3, 5, 2.2, PAL.stone2);
  p.ellipse(cx + 0.5, PYLON_H - 3.5, 4, 1.6, PAL.stone3);
  // pole
  for (let y = 9; y < PYLON_H - 3; y++) {
    p.set(cx - 1, y, PAL.mist).set(cx, y, PAL.steel).set(cx + 1, y, PAL.night3);
    if ((y - 9) % 6 === 3) p.set(cx - 1, y, PAL.night4).set(cx, y, PAL.night3);
  }
  // a little status panel on the pole
  p.rect(cx - 2, 15, 5, 4, PAL.night1);
  p.set(cx - 1, 16, PAL.leaf3).set(cx + 1, 16, PAL.gold3).set(cx, 17, PAL.night3);
  // beacon housing (glass dome on a collar)
  p.rect(cx - 3, 7, 7, 2, PAL.night2);
  p.rect(cx - 2, 0, 5, 7, PAL.night1);
  p.erase(cx - 2, 0).erase(cx + 2, 0);
  p.outline(PAL.ink);
  // clear the dome so the lamp (runtime, tinted) shows inside
  for (let y = 1; y <= 6; y++) for (let x = cx - 1; x <= cx + 1; x++) p.set(x, y, PAL.night0);
  return p;
}

/** The beacon lamp (white, tinted at runtime) with a rotating reflector stripe. */
export function drawBeacons(): [string, PixelCanvas][] {
  const out: [string, PixelCanvas][] = [];
  for (let f = 0; f < BEACON_FRAMES; f++) {
    const p = new PixelCanvas(5, 8);
    for (let y = 1; y <= 6; y++) for (let x = 1; x <= 3; x++) p.set(x, y, 0xb0b0b0);
    const sx = [1, 2, 3, 3, 2, 1][f];
    const bright = f === 1 || f === 2;
    for (let y = 1; y <= 6; y++) p.set(sx, y, 0xffffff);
    if (bright) for (let y = 2; y <= 5; y++) p.set(sx === 1 ? 0 : 4, y, 0x808080);
    out.push([String(f), p]);
  }
  return out;
}

// ---------------------------------------------------------------- flags

export const FLAG_W = 12;
export const FLAG_H = 12;
export const FLAG_FRAMES = 8;
export const FLAG_DESIGNS = 3;

/** Fan flags: frame name `${side}:${design}:${f}`; the pole foot is at (1, FLAG_H - 1). */
export function drawFlags(): [string, PixelCanvas][] {
  const out: [string, PixelCanvas][] = [];
  for (const side of [0, 1] as PlayerId[]) {
    const ramp = side === 0 ? RAMPS.cyan : RAMPS.crim;
    for (let d = 0; d < FLAG_DESIGNS; d++) {
      for (let f = 0; f < FLAG_FRAMES; f++) {
        const p = new PixelCanvas(FLAG_W, FLAG_H);
        // pole
        for (let y = 1; y < FLAG_H; y++) p.set(1, y, y < 3 ? PAL.white : PAL.stone3);
        p.set(1, 0, PAL.gold3);
        // cloth: 8 columns × 4 rows, waving (each column offset by a travelling sine)
        for (let i = 0; i < 8; i++) {
          const w = Math.sin((f / FLAG_FRAMES) * Math.PI * 2 - i * 0.85) * Math.min(1.4, i * 0.35);
          const dy = Math.round(w);
          const shadeCol = w > 0.5 ? 1 : w < -0.5 ? -1 : 0;
          for (let j = 0; j < 4; j++) {
            const x = 2 + i;
            const y = 1 + j + dy;
            let c: Color = ramp[3];
            if (d === 0 && i === 0) c = PAL.white;
            if (d === 1 && j === 3) c = ramp[1];
            if (d === 2 && (i === 3 || i === 4) && (j === 1 || j === 2)) c = PAL.gold3;
            if (shadeCol < 0) c = c === PAL.white ? PAL.mist : c === PAL.gold3 ? PAL.gold2 : ramp[2];
            if (shadeCol > 0 && c === ramp[3]) c = ramp[4];
            if (j === 3 && c === ramp[3]) c = ramp[2];
            p.set(x, y, c);
          }
        }
        out.push([`${side}:${d}:${f}`, p]);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- banners

export const BANNER_FRAMES = 6;
export const BANNER_LEN = 22;
export const BANNER_H = 9;

/**
 * Banners draped over the stand railing, sheared along the 2:1 wall (slope -1 = the left stand's
 * wall rises to the right, +1 = the right stand's wall falls to the right). Frame `${side}:${d}:${f}`.
 * The texture is BANNER_LEN × (BANNER_H + LEN/2 + 2); the top-left of the wall line is at (0, LEN/2).
 */
export function drawBanners(slope: -1 | 1): [string, PixelCanvas][] {
  const out: [string, PixelCanvas][] = [];
  const H = BANNER_H + BANNER_LEN / 2 + 3;
  for (const side of [0, 1] as PlayerId[]) {
    const ramp = side === 0 ? RAMPS.cyan : RAMPS.crim;
    for (let d = 0; d < 2; d++) {
      for (let f = 0; f < BANNER_FRAMES; f++) {
        const p = new PixelCanvas(BANNER_LEN, H);
        for (let i = 0; i < BANNER_LEN; i++) {
          const top = BANNER_LEN / 2 + Math.floor((slope * i) / 2) + (slope < 0 ? 0 : -BANNER_LEN / 2 + 1);
          // the hem ripples: a travelling wave along the bottom edge
          const ripple = Math.round(Math.sin((f / BANNER_FRAMES) * Math.PI * 2 + i * 0.6) * 0.9);
          const len = BANNER_H - 1 + ripple;
          for (let j = 0; j < len; j++) {
            const y = top + j;
            let c: Color = j === 0 ? PAL.white : ramp[3];
            // folds: darker vertical bands that drift with the ripple
            const fold = Math.sin(i * 0.9 + (f / BANNER_FRAMES) * Math.PI * 2);
            if (j > 0 && fold < -0.6) c = ramp[2];
            if (j > 0 && fold > 0.8) c = ramp[4];
            // emblem / lettering
            if (d === 0 && j >= 2 && j <= 5 && i >= 4 && i <= 17 && (i % 3 === 0 || j === 2 || j === 5)) c = PAL.white;
            if (d === 1 && j >= 2 && j <= 5 && Math.abs(i - 10.5) + Math.abs(j - 3.5) * 2 < 5) c = PAL.gold3;
            if (j === len - 1) c = ramp[1];
            p.set(i, y, c);
          }
        }
        out.push([`${side}:${d}:${f}`, p]);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- floodlight bank (lit)

export function drawLampLit(): PixelCanvas {
  const p = new PixelCanvas(19, 12);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 4; i++) {
      p.rect(1 + i * 5, 1 + j * 4, 3, 2, PAL.gold4);
      p.set(1 + i * 5, 1 + j * 4, PAL.white).set(2 + i * 5, 1 + j * 4, PAL.white);
    }
  return p;
}

// ---------------------------------------------------------------- scoreboard

export const SCORE_W = 60;
export const SCORE_H = 26;
/** Screen window inside the scoreboard frame. */
export const SCORE_SCREEN = { x: 4, y: 4, w: 52, h: 17 };

/** Scoreboard housing: a dark frame with corner bolts and a header strip, hung on two cables. */
export const SCORE_CABLE = 150;
export function drawScoreboard(): PixelCanvas {
  const p = new PixelCanvas(SCORE_W, SCORE_H + SCORE_CABLE);
  // two hanging cables rising into the dark above the stands (fading out)
  for (let y = 0; y < SCORE_CABLE; y++)
    for (const x of [10, SCORE_W - 11]) {
      const k = y / SCORE_CABLE;
      if (k < 0.5 && ((x + y) & 3) >= Math.round(k * 8)) continue;
      p.set(x, y, k > 0.8 ? PAL.night3 : PAL.night2);
    }
  const o = SCORE_CABLE;
  p.rect(0, o, SCORE_W, SCORE_H, PAL.night1);
  p.rect(1, o + 1, SCORE_W - 2, 2, PAL.night3);
  p.rect(1, o + SCORE_H - 3, SCORE_W - 2, 2, PAL.night0);
  p.rect(SCORE_SCREEN.x - 1, o + SCORE_SCREEN.y - 1, SCORE_SCREEN.w + 2, SCORE_SCREEN.h + 2, PAL.ink);
  for (const [x, y] of [
    [2, 2],
    [SCORE_W - 3, 2],
    [2, SCORE_H - 3],
    [SCORE_W - 3, SCORE_H - 3],
  ] as const)
    p.set(x, o + y, PAL.steel);
  // little status lamps under the screen
  for (let i = 0; i < 7; i++) p.set(9 + i * 3, o + SCORE_H - 2, i % 2 ? PAL.cyan2 : PAL.crim2);
  p.outline(PAL.ink);
  return p;
}
