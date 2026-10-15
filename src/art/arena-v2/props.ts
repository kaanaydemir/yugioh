// Arena v2 small props, each with many animation frames: camera drones, referee light pylons,
// waving fan flags, banners over the stand railing, the lit floodlight banks, the scoreboard.

import type { PlayerId } from '../../engine/types';
import { PAL, RAMPS } from '../palette';
import { getFont } from '../font';
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

/** Small hand-held flags (6×7): frame `${side}:${f}`; the stick's foot is at (0, 6). */
export const FLAG_S_W = 6;
export const FLAG_S_H = 7;
export const FLAG_S_FRAMES = 6;

export function drawSmallFlags(): [string, PixelCanvas][] {
  const out: [string, PixelCanvas][] = [];
  for (const side of [0, 1] as PlayerId[]) {
    const ramp = side === 0 ? RAMPS.cyan : RAMPS.crim;
    for (let f = 0; f < FLAG_S_FRAMES; f++) {
      const p = new PixelCanvas(FLAG_S_W, FLAG_S_H);
      for (let y = 1; y < FLAG_S_H; y++) p.set(0, y, PAL.stone3);
      for (let i = 0; i < 4; i++) {
        const dy = Math.round(Math.sin((f / FLAG_S_FRAMES) * Math.PI * 2 - i * 1.1) * Math.min(1, i * 0.45));
        p.set(1 + i, 1 + dy, i === 3 ? ramp[2] : ramp[3]);
        p.set(1 + i, 2 + dy, i === 0 ? PAL.white : ramp[2]);
      }
      out.push([`${side}:${f}`, p]);
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

// ---------------------------------------------------------------- LED font

/** LED glyph cell: the 'sm' font's rows 1..7 (accents + caps), at most 5 px wide. */
export const LED_GW = 5;
export const LED_GH = 7;

/**
 * One LED font sheet in a colour scheme: frame name = the char code. The top three rows (accents
 * and the cap line) light in the `hi` tone, the rest in `on`. Letters advance by glyph width + 1.
 */
export function drawLedFont(on: Color, hi: Color): [string, PixelCanvas][] {
  const font = getFont('sm');
  const out: [string, PixelCanvas][] = [];
  for (const g of font.glyphs.values()) {
    const p = new PixelCanvas(LED_GW, LED_GH);
    for (let j = 0; j < LED_GH; j++) for (let i = 0; i < g.w; i++) if (g.bits[(j + 1) * g.w + i]) p.set(i, j, j <= 2 ? hi : on);
    out.push([String(g.code), p]);
  }
  return out;
}

/** Advance (px) of a char in the LED font. */
export function ledAdvance(ch: string): number {
  const g = getFont('sm').glyphs.get(ch.charCodeAt(0)) ?? getFont('sm').glyphs.get(32)!;
  return g.w + 1;
}

// ---------------------------------------------------------------- scoreboard

export const SCORE_W = 92;
export const SCORE_H = 40;
/** Screen window inside the scoreboard frame. */
export const SCORE_SCREEN = { x: 4, y: 5, w: 84, h: 29 };

/** Scoreboard housing: a dark frame with corner bolts and a header strip, hung on two cables. */
export const SCORE_CABLE = 150;
export function drawScoreboard(): PixelCanvas {
  const p = new PixelCanvas(SCORE_W, SCORE_H + SCORE_CABLE);
  // two hanging cables rising into the dark above the stands (fading out: solid, then gaps)
  for (let y = 0; y < SCORE_CABLE; y++)
    for (const x of [14, SCORE_W - 15]) {
      const k = y / SCORE_CABLE;
      if (k < 0.5 && y % 6 >= Math.round(k * 12)) continue;
      p.set(x, y, k > 0.8 ? PAL.night3 : PAL.night2);
    }
  const o = SCORE_CABLE;
  p.rect(0, o, SCORE_W, SCORE_H, PAL.night1);
  p.rect(1, o + 1, SCORE_W - 2, 2, PAL.night3);
  p.hline(1, SCORE_W - 2, o + 1, PAL.night4);
  p.rect(1, o + SCORE_H - 4, SCORE_W - 2, 3, PAL.night0);
  p.rect(SCORE_SCREEN.x - 1, o + SCORE_SCREEN.y - 1, SCORE_SCREEN.w + 2, SCORE_SCREEN.h + 2, PAL.ink);
  // the screen: an unlit LED panel (faint scanlines, no dot checker)
  for (let y = 0; y < SCORE_SCREEN.h; y++) p.hline(SCORE_SCREEN.x, SCORE_SCREEN.x + SCORE_SCREEN.w - 1, o + SCORE_SCREEN.y + y, y % 2 ? PAL.ink : PAL.night0);
  // a divider between the score line and the turn line
  p.hline(SCORE_SCREEN.x + 2, SCORE_SCREEN.x + SCORE_SCREEN.w - 3, o + SCORE_SCREEN.y + 13, PAL.night1);
  for (const [x, y] of [
    [2, 2],
    [SCORE_W - 3, 2],
    [2, SCORE_H - 3],
    [SCORE_W - 3, SCORE_H - 3],
  ] as const)
    p.set(x, o + y, PAL.steel);
  // little status lamps under the screen (lit at runtime)
  for (let i = 0; i < 9; i++) p.set(28 + i * 4, o + SCORE_H - 3, PAL.night2);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------- pitch-side props

/** A flight case on the pitch (iso box, lit from the upper left), ~14×11. `open` shows a lit monitor. */
export function drawFlightCase(variant: 0 | 1 | 2): PixelCanvas {
  const p = new PixelCanvas(16, 13);
  // top band, then the lit front-left face and the shaded front-right face
  const top: Color = variant === 2 ? PAL.night3 : PAL.stone2;
  p.rect(2, 3, 12, 3, top);
  p.rect(2, 6, 7, 5, variant === 2 ? PAL.night2 : PAL.night3); // front-left face (lit)
  p.rect(9, 6, 5, 5, variant === 2 ? PAL.night1 : PAL.night2); // front-right face (shade)
  p.hline(2, 13, 3, variant === 2 ? PAL.night4 : PAL.stone3); // lit top edge
  // steel corner caps and a latch
  for (const [x, y] of [
    [2, 6],
    [8, 6],
    [13, 6],
    [2, 10],
    [8, 10],
    [13, 10],
  ] as const)
    p.set(x, y, PAL.steel);
  p.set(5, 8, PAL.mist);
  // a stencilled team stripe
  if (variant === 0) p.hline(3, 7, 7, PAL.cyan1);
  if (variant === 1) p.hline(3, 7, 7, PAL.crim1);
  if (variant === 2) {
    // open lid with a small monitor (the screen glow flickers at runtime)
    p.rect(3, 0, 9, 4, PAL.night1);
    p.rect(4, 1, 7, 2, PAL.night3);
  }
  p.outline(PAL.ink);
  return p;
}

/** A cable reel on its side (drum with wraps), 11×10. */
export function drawCableReel(): PixelCanvas {
  const p = new PixelCanvas(12, 11);
  p.ellipse(6, 5, 5, 4.5, PAL.night2);
  p.ellipseRing(6, 5, 5, 4.5, PAL.night3);
  p.ellipseRing(6, 5, 3.5, 3, PAL.ink);
  p.ellipseRing(6, 5, 2.5, 2, PAL.night4);
  p.ellipse(6, 5, 1, 1, PAL.steel);
  p.set(3, 2, PAL.mist);
  p.outline(PAL.ink);
  return p;
}

export const CAM_W = 17;
export const CAM_H = 18;
export const CAM_FRAMES = 6;

/**
 * A camera operator behind a pedestal camera (pitch-side broadcast camera), facing up-left toward
 * the platform. Frames pan the camera and shift the operator's weight. Feet at (8, CAM_H − 1).
 */
export function drawCameraman(dolly: boolean): [string, PixelCanvas][] {
  const out: [string, PixelCanvas][] = [];
  for (let f = 0; f < CAM_FRAMES; f++) {
    const p = new PixelCanvas(CAM_W, CAM_H);
    const pan = [0, 0, 1, 1, 0, -1][f];
    const bob = f === 3 ? 1 : 0;
    const base = CAM_H - 1;
    if (dolly) {
      // the dolly cart: a low platform with two wheels on the rail
      p.rect(1, base - 3, 15, 2, PAL.night3);
      p.hline(1, 15, base - 3, PAL.steel);
      p.set(3, base - 1, PAL.ink).set(4, base - 1, PAL.night4);
      p.set(12, base - 1, PAL.ink).set(13, base - 1, PAL.night4);
    } else {
      // tripod legs
      p.set(3, base, PAL.night4).set(4, base - 1, PAL.night4).set(7, base, PAL.night4).set(6, base - 1, PAL.night4);
    }
    const fy = dolly ? base - 4 : base;
    // the camera on its head (body, lens toward the upper left, viewfinder hood)
    const cx = 4 + pan;
    const cy = fy - 9;
    p.set(5, fy - 1, PAL.steel).set(5, fy - 2, PAL.steel).set(5, fy - 3, PAL.night4).set(5, fy - 4, PAL.night4).set(5, fy - 5, PAL.steel);
    p.rect(cx, cy, 6, 3, PAL.night2);
    p.hline(cx, cx + 5, cy, PAL.night4);
    p.set(cx - 1, cy + 1, PAL.steel).set(cx - 2, cy + 1, PAL.mist); // lens
    p.set(cx + 5, cy - 1, PAL.night1).set(cx + 4, cy - 1, PAL.night1); // hood
    p.set(cx + 6, cy + 2, PAL.night3); // handle
    // the operator: dark jacket, headset, a hand on the handle
    const ox = 12;
    const oy = fy - bob;
    p.rect(ox - 1, oy - 6, 3, 5, PAL.night3);
    p.set(ox - 1, oy - 6, PAL.night4).set(ox, oy - 6, PAL.night4);
    p.set(ox - 1, oy - 1, PAL.night1).set(ox + 1, oy - 1, PAL.night1);
    p.set(ox - 1, oy, PAL.ink).set(ox + 1, oy, PAL.ink);
    p.set(ox - 1, oy - 8, PAL.skin2).set(ox, oy - 8, PAL.skin2).set(ox - 1, oy - 7, PAL.skin1).set(ox, oy - 7, PAL.skin2);
    p.set(ox - 1, oy - 9, PAL.earth1).set(ox, oy - 9, PAL.earth1).set(ox + 1, oy - 8, PAL.night1); // hair + headset cup
    p.set(ox - 2, oy - 5, PAL.night3).set(ox - 3, oy - 4, PAL.skin2); // arm to the handle
    p.outline(PAL.ink);
    out.push([String(f), p]);
  }
  return out;
}
