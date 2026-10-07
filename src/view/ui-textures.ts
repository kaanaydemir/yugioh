// UI textures — panels, buttons, glows, icons, mini cards and curtain stripes, all drawn in
// code with PixelCanvas. Exact-size textures are generated on demand (and cached by key), so
// every panel gets crisp chamfered corners, a neon edge lit from the top-left, an inner rim,
// a dithered night fill and faint holo scanlines — no 9-slice stretching artifacts.
//
//   const key = panelTex(scene, 'p1', 148, 64, { header: 15 });   // 'ui:panel:p1:148x64:h15'
//   scene.add.image(x, y, key).setOrigin(0);
//   const glow = glowTex(scene, 148, 64);                        // ADD + tint, pad GLOW_PAD
//   const btn = buttonTex(scene, 'fire', 'h', 136, 25);           // n | h | p | d
//   scene.add.image(x, y, ICON.swords).setTint(PAL.white);
//
// Styles map to palette ramps: neutral (night/steel), p1 (cyan), p2 (crimson), gold, spell
// (teal), trap (magenta), fire, leaf, stone, void.

import type Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../art/palette';
import { PixelCanvas, mix } from '../art/pixel';
import type { PlayerId } from '../engine/types';
import { revealText } from '../ui/text';
import { tweenValue } from '../vfx/core';

export type UiStyle = 'neutral' | 'p1' | 'p2' | 'gold' | 'spell' | 'trap' | 'fire' | 'leaf' | 'stone' | 'void';

export const UI_RAMP: Record<UiStyle, Ramp> = {
  neutral: [PAL.night1, PAL.night3, PAL.night4, PAL.steel, PAL.mist],
  p1: RAMPS.cyan,
  p2: RAMPS.crim,
  gold: RAMPS.gold,
  spell: RAMPS.teal,
  trap: RAMPS.mag,
  fire: RAMPS.fire,
  leaf: RAMPS.leaf,
  stone: RAMPS.stone,
  void: RAMPS.void,
};

export function playerStyle(p: PlayerId): UiStyle {
  return p === 0 ? 'p1' : 'p2';
}

export type ButtonState = 'n' | 'h' | 'p' | 'd';

/** Padding of glowTex() around the panel it surrounds. */
export const GLOW_PAD = 4;
/** Frames in a buttonSheenTex() strip. */
export const SHEEN_FRAMES = 12;
/** Vertical travel of a button face when pressed (the lip height). */
export const BUTTON_PRESS = 2;

// ---------------------------------------------------------------- helpers

function put(scene: Phaser.Scene, key: string, p: PixelCanvas): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

/**
 * Depth map of a chamfered rectangle: -1 outside, 0 for the outermost ring (4-neighbour
 * distance to the outside), 1, 2, ... inward.
 */
function chamferDepth(w: number, h: number, c: number): Int16Array {
  const inside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (x + y < c) return false;
    if (w - 1 - x + y < c) return false;
    if (x + (h - 1 - y) < c) return false;
    if (w - 1 - x + (h - 1 - y) < c) return false;
    return true;
  };
  const d = new Int16Array(w * h).fill(-1);
  const q: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) {
        d[y * w + x] = 0;
        q.push(x, y);
      }
    }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i];
    const y = q[i + 1];
    const v = d[y * w + x];
    const nb = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of nb) {
      if (!inside(nx, ny)) continue;
      const j = ny * w + nx;
      if (d[j] !== -1) continue;
      d[j] = v + 1;
      q.push(nx, ny);
    }
  }
  return d;
}

/** Which edge a ring pixel belongs to (nearest side), plus whether it sits in a corner zone. */
function side(x: number, y: number, w: number, h: number, corner: number): { s: 'top' | 'left' | 'bottom' | 'right'; corner: boolean } {
  const t = y;
  const l = x;
  const b = h - 1 - y;
  const r = w - 1 - x;
  const m = Math.min(t, l, b, r);
  const s = m === t ? 'top' : m === l ? 'left' : m === b ? 'bottom' : 'right';
  const inCorner = (l < corner || r < corner) && (t < corner || b < corner);
  return { s, corner: inCorner };
}

// ---------------------------------------------------------------- panels

export interface PanelOpts {
  /** Height of a tinted header band (0 = none). */
  header?: number;
  /** Fill alpha 0..255 (default 238). */
  alpha?: number;
  /** Chamfer size (default 3). */
  chamfer?: number;
  /** Holo scanlines in the fill (default true). */
  scan?: boolean;
  /** Dim edge (inactive look). */
  dim?: boolean;
}

export function drawPanel(p: PixelCanvas, w: number, h: number, R: Ramp, opts: PanelOpts = {}): PixelCanvas {
  const c = opts.chamfer ?? 3;
  const alpha = opts.alpha ?? 238;
  const header = opts.header ?? 0;
  const scan = opts.scan ?? true;
  const dim = opts.dim ?? false;
  const D = chamferDepth(w, h, c);
  const hiEdge = dim ? R[2] : R[3];
  const loEdge = dim ? R[1] : R[2];
  const cornerC = dim ? R[3] : R[4];
  const rim = mix(R[1], PAL.night0, dim ? 0.55 : 0.35);
  const headTop = mix(R[1], PAL.night1, 0.35);
  const headBot = mix(R[0], PAL.night1, 0.45);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = D[y * w + x];
      if (d < 0) continue;
      if (d === 0) {
        p.set(x, y, PAL.ink);
        continue;
      }
      if (d === 1) {
        const sd = side(x, y, w, h, c + 5);
        const col = sd.corner ? cornerC : sd.s === 'top' || sd.s === 'left' ? hiEdge : loEdge;
        p.set(x, y, col);
        continue;
      }
      if (d === 2) {
        p.set(x, y, rim, Math.max(alpha, 230));
        continue;
      }
      let col: number;
      if (header > 0 && y < header) {
        const t = (y - 3) / Math.max(1, header - 4);
        col = PixelCanvas.ditherAt(x, y, Math.round(t * 16)) ? headBot : headTop;
        if (y === header - 1) col = mix(R[2], PAL.night1, dim ? 0.5 : 0.15);
      } else {
        const y0 = header > 0 ? header : 3;
        const t = (y - y0) / Math.max(1, h - 3 - y0);
        // top: night2 dithering into night1; bottom: night1 into night0
        if (t < 0.35) col = PixelCanvas.ditherAt(x, y, Math.round((t / 0.35) * 16)) ? PAL.night1 : mix(PAL.night2, R[0], 0.25);
        else if (t > 0.7) col = PixelCanvas.ditherAt(x, y, Math.round(((t - 0.7) / 0.3) * 12)) ? PAL.night0 : PAL.night1;
        else col = PAL.night1;
        if (d === 3 && y < h / 2) col = mix(col, R[1], 0.35); // inner glow under the lit edge
      }
      if (scan && (y & 1) === 1) col = mix(col, PAL.ink, 0.22);
      p.set(x, y, col, alpha);
    }
  return p;
}

/** Exact-size panel texture (cached). */
export function panelTex(scene: Phaser.Scene, style: UiStyle, w: number, h: number, opts: PanelOpts = {}): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui:panel:${style}:${w}x${h}:h${opts.header ?? 0}:a${opts.alpha ?? 238}:c${opts.chamfer ?? 3}${opts.scan === false ? ':ns' : ''}${opts.dim ? ':dim' : ''}`;
  if (scene.textures.exists(key)) return key;
  return put(scene, key, drawPanel(new PixelCanvas(w, h), w, h, UI_RAMP[style], opts));
}

/**
 * Soft stepped glow ring around a w×h chamfered panel, white (tint it, ADD blend).
 * Texture size is (w + 2·pad) × (h + 2·pad); place it at (panel.x − pad, panel.y − pad).
 */
export function glowTex(scene: Phaser.Scene, w: number, h: number, pad = GLOW_PAD, chamfer = 3): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui:glow:${w}x${h}:${pad}:${chamfer}`;
  if (scene.textures.exists(key)) return key;
  const W = w + pad * 2;
  const H = h + pad * 2;
  const p = new PixelCanvas(W, H);
  // distance (chessboard, with chamfer) from the panel silhouette
  const D = chamferDepth(w, h, chamfer);
  const inPanel = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && D[y * w + x] >= 0;
  const steps = [150, 92, 50, 22, 8, 3];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x - pad;
      const py = y - pad;
      if (inPanel(px, py)) {
        // faint inner glow on the outer ring only
        const d = D[py * w + px];
        if (d <= 2) p.set(x, y, 0xffffff, [70, 40, 18][d]);
        continue;
      }
      let best = 99;
      for (let r = 1; r <= pad && best === 99; r++)
        for (let dy = -r; dy <= r && best === 99; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (inPanel(px + dx, py + dy)) {
              best = r;
              break;
            }
          }
      if (best <= pad) p.set(x, y, 0xffffff, steps[best - 1] ?? 0);
    }
  return put(scene, key, p);
}

// ---------------------------------------------------------------- buttons

/**
 * Chunky button: chamfered face with a lit top edge and a 2px dark lip underneath. The 'p'
 * (pressed) state draws the face 2px lower with no lip, so the label should drop by
 * BUTTON_PRESS too. 'd' = disabled (flat stone).
 */
export function drawButton(p: PixelCanvas, w: number, h: number, R0: Ramp, state: ButtonState): PixelCanvas {
  const R: Ramp = state === 'd' ? [PAL.stone0, PAL.night2, PAL.stone1, PAL.stone2, PAL.stone3] : R0;
  const lip = BUTTON_PRESS;
  const pressed = state === 'p';
  const faceY = pressed ? lip : 0;
  const faceH = h - lip;
  const c = 3;
  // lip (dark extrusion) under the face
  if (!pressed) {
    const L = chamferDepth(w, h, c);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = L[y * w + x];
        if (d < 0) continue;
        p.set(x, y, d === 0 ? PAL.ink : y >= h - 2 - 1 ? mix(R[0], PAL.ink, 0.25) : R[0]);
      }
  }
  const F = chamferDepth(w, faceH, c);
  const hover = state === 'h';
  const top = hover ? R[4] : R[3];
  const edge = hover ? R[3] : R[2];
  const fillA = hover ? R[3] : R[2];
  const fillB = hover ? R[2] : R[1];
  for (let y = 0; y < faceH; y++)
    for (let x = 0; x < w; x++) {
      const d = F[y * w + x];
      if (d < 0) continue;
      const Y = y + faceY;
      if (d === 0) {
        p.set(x, Y, PAL.ink);
        continue;
      }
      if (d === 1) {
        const sd = side(x, y, w, faceH, c + 3);
        let col = sd.s === 'top' ? top : sd.s === 'bottom' ? mix(R[1], PAL.ink, 0.2) : edge;
        if (sd.corner && sd.s !== 'bottom') col = state === 'd' ? R[3] : hover ? PAL.white : R[4];
        p.set(x, Y, col);
        continue;
      }
      const t = (y - 2) / Math.max(1, faceH - 5);
      let col = PixelCanvas.ditherAt(x, y, Math.round(Math.min(1, Math.max(0, t)) * 16)) ? fillB : fillA;
      if (d === 2 && y <= 2) col = mix(fillA, top, 0.6); // gloss row under the top edge
      if (state !== 'd' && y > faceH / 2 && (y & 1) === 0) col = mix(col, PAL.ink, 0.12);
      p.set(x, Y, col);
    }
  return p;
}

export function buttonTex(scene: Phaser.Scene, style: UiStyle, state: ButtonState, w: number, h: number): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui:btn:${style}:${state}:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  return put(scene, key, drawButton(new PixelCanvas(w, h), w, h, UI_RAMP[style], state));
}

/**
 * Diagonal light sweep across a button face: SHEEN_FRAMES frames named 's:0'.. laid out
 * horizontally, masked to the face silhouette (w × (h − BUTTON_PRESS)). White; use ADD.
 */
export function buttonSheenTex(scene: Phaser.Scene, w: number, h: number): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui:btnsheen:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const fh = h - BUTTON_PRESS;
  const F = chamferDepth(w, fh, 3);
  const p = new PixelCanvas(w * SHEEN_FRAMES, fh);
  for (let f = 0; f < SHEEN_FRAMES; f++) {
    const pos = -fh + ((w + fh * 2) * f) / (SHEEN_FRAMES - 1);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < w; x++) {
        const d = F[y * w + x];
        if (d < 1) continue;
        const k = x + y * 0.6 - pos;
        let a = 0;
        if (k >= 0 && k < 3) a = 150;
        else if (k >= 5 && k < 6) a = 90;
        else if (k >= -2 && k < 0) a = 50;
        if (a) p.set(f * w + x, y, 0xffffff, a);
      }
  }
  const tex = scene.textures.addCanvas(key, p.toCanvas())!;
  for (let f = 0; f < SHEEN_FRAMES; f++) tex.add(`s:${f}`, 0, f * w, 0, w, fh);
  return key;
}

/** Same sweep for an arbitrary chamfered panel (w×h): frames 's:0'.. (SHEEN_FRAMES). */
export function panelSheenTex(scene: Phaser.Scene, w: number, h: number, chamfer = 3): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui:panelsheen:${w}x${h}:${chamfer}`;
  if (scene.textures.exists(key)) return key;
  const F = chamferDepth(w, h, chamfer);
  const p = new PixelCanvas(w * SHEEN_FRAMES, h);
  for (let f = 0; f < SHEEN_FRAMES; f++) {
    const pos = -h + ((w + h * 2) * f) / (SHEEN_FRAMES - 1);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = F[y * w + x];
        if (d < 1) continue;
        const k = x + y * 0.7 - pos;
        let a = 0;
        if (k >= 0 && k < 4) a = d === 1 ? 200 : 70;
        else if (k >= 7 && k < 9) a = d === 1 ? 140 : 40;
        if (a) p.set(f * w + x, y, 0xffffff, a);
      }
  }
  const tex = scene.textures.addCanvas(key, p.toCanvas())!;
  for (let f = 0; f < SHEEN_FRAMES; f++) tex.add(`s:${f}`, 0, f * w, 0, w, h);
  return key;
}

/** Solid silhouette of a chamfered panel (white) — flashes, hit areas. */
export function silTex(scene: Phaser.Scene, w: number, h: number, chamfer = 3): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui:sil:${w}x${h}:${chamfer}`;
  if (scene.textures.exists(key)) return key;
  const D = chamferDepth(w, h, chamfer);
  const p = new PixelCanvas(w, h);
  for (let i = 0; i < D.length; i++) if (D[i] >= 0) p.set(i % w, Math.floor(i / w), 0xffffff);
  return put(scene, key, p);
}

/** 1px chamfered ring (white) of a w×h panel at depth `ring` (1 = the neon edge). */
export function edgeTex(scene: Phaser.Scene, w: number, h: number, ring = 1, chamfer = 3): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui:edge:${w}x${h}:${ring}:${chamfer}`;
  if (scene.textures.exists(key)) return key;
  const D = chamferDepth(w, h, chamfer);
  const p = new PixelCanvas(w, h);
  for (let i = 0; i < D.length; i++) if (D[i] === ring) p.set(i % w, Math.floor(i / w), 0xffffff);
  return put(scene, key, p);
}

/**
 * Perimeter path of the neon edge ring (ring 1) of a w×h chamfered panel, clockwise from the
 * top-left, as integer points. Used by running-light comets.
 */
export function edgePath(w: number, h: number, chamfer = 3): { x: number; y: number }[] {
  const D = chamferDepth(w, h, chamfer);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && D[y * w + x] === 1;
  // start at the leftmost ring pixel on the top row of the ring
  let sx = -1;
  let sy = 1;
  for (let x = 0; x < w; x++)
    if (on(x, 1)) {
      sx = x;
      break;
    }
  if (sx < 0) return [];
  const pts: { x: number; y: number }[] = [];
  const seen = new Set<number>();
  let x = sx;
  let y = sy;
  // clockwise neighbor preference: right, down-right, down, down-left, left, up-left, up, up-right
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  let last = 0;
  for (let guard = 0; guard < w * h; guard++) {
    pts.push({ x, y });
    seen.add(y * w + x);
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const di = (last + 6 + k) % 8; // start turning from "left of current heading"
      const nx = x + dirs[di][0];
      const ny = y + dirs[di][1];
      if (on(nx, ny) && !seen.has(ny * w + nx)) {
        x = nx;
        y = ny;
        last = di;
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return pts;
}

// ---------------------------------------------------------------- icons

export const ICON = {
  deck: 'ui:icon:deck',
  hand: 'ui:icon:hand',
  grave: 'ui:icon:grave',
  swords: 'ui:icon:swords',
  endTurn: 'ui:icon:endturn',
  speed: 'ui:icon:speed',
  soundOn: 'ui:icon:soundon',
  soundOff: 'ui:icon:soundoff',
  log: 'ui:icon:log',
  atk: 'ui:icon:atk',
  def: 'ui:icon:def',
  close: 'ui:icon:close',
  pointer: 'ui:icon:pointer',
  hourglass: 'ui:icon:hourglass',
  check: 'ui:icon:check',
  trap: 'ui:icon:trap',
  caret: 'ui:icon:caret',
  crown: 'ui:icon:crown',
} as const;
export type IconKey = (typeof ICON)[keyof typeof ICON];

const IK: Record<string, number> = { W: PAL.white, m: PAL.mist, s: PAL.steel, k: PAL.ink, n: PAL.night3 };

/** Icon art in white/mist/steel (tint with any color), 1px ink outline added automatically. */
const ICON_ART: Record<keyof typeof ICON, readonly string[] | ((p: PixelCanvas) => void)> = {
  deck: (p) => {
    p.rect(3, 1, 6, 8, PAL.steel);
    p.rect(2, 2, 6, 8, PAL.mist);
    p.rect(1, 3, 6, 8, PAL.white);
    p.rect(2, 4, 4, 6, PAL.night3);
    p.set(3, 6, PAL.mist).set(4, 6, PAL.mist).set(3, 7, PAL.mist).set(4, 7, PAL.mist);
    p.set(3, 5, PAL.steel).set(4, 8, PAL.steel);
  },
  hand: (p) => {
    const card = (x: number, y: number, fill: number, inner?: number) => {
      p.rect(x, y, 6, 9, PAL.ink);
      p.rect(x + 1, y + 1, 4, 7, fill);
      if (inner !== undefined) p.rect(x + 2, y + 2, 2, 5, inner);
    };
    card(1, 3, PAL.steel, PAL.night4);
    card(10, 3, PAL.mist, PAL.steel);
    card(5, 1, PAL.white, PAL.night3);
    p.set(6, 4, PAL.white).set(7, 5, PAL.mist);
  },
  grave: ['..mmmmm..', '.mWWWWWm.', 'mWWWsWWWm', 'mWWsssWWm', 'mWWWsWWWm', 'mWWWsWWWm', 'mWWWWWWWm', 'mWWWWWWWm', 'sssssssss'],
  swords: [
    'WW.......WW',
    'WWm.....mWW',
    '.mWm...mWm.',
    '..mWm.mWm..',
    '...mWmWm...',
    '....mWm....',
    '...mWmWm...',
    '.s.Wm.mW.s.',
    '..ss...ss..',
    '.ssss.ssss.',
    'ss.......ss',
  ],
  endTurn: ['W...W...ss', 'WW..WW..ss', 'WWW.WWW.ss', 'WWWWWWWWss', 'WWW.WWW.ss', 'WW..WW..ss', 'W...W...ss'],
  speed: ['W...W...', 'WW..WW..', 'WWW.WWW.', 'WWWWWWWW', 'WWW.WWW.', 'WW..WW..', 'W...W...'],
  soundOn: ['....W......', '...WW...m..', 'WWWWW.m..m.', 'WWWWW..m.m.', 'WWWWW..m.m.', 'WWWWW.m..m.', '...WW...m..', '....W......'],
  soundOff: ['....W......', '...WW......', 'WWWWW.m...m', 'WWWWW..m.m.', 'WWWWW...m..', 'WWWWW..m.m.', '...WW.m...m', '....W......'],
  log: ['WWWWWW.', 'W....Wm', 'W.ss.Wm', 'W....Wm', 'W.sss.W', 'W.....W', 'W.ss..W', 'W.....W', 'WWWWWWW'],
  atk: ['......W', '.....WW', '....WW.', 's..WW..', '.sWW...', '..s....', '.s.s...'],
  def: ['WWWWWWW', 'WmmmmmW', 'WmWWWmW', 'WmWWWmW', '.WmWmW.', '.WmWmW.', '..WmW..', '...W...'],
  close: ['WW...WW', 'WWW.WWW', '.WWWWW.', '..WWW..', '.WWWWW.', 'WWW.WWW', 'WW...WW'],
  pointer: [
    '...WW.....',
    '..WmmW....',
    '..WmmW....',
    '..WmmWWW..',
    '..WmmWmmWW',
    'WWWmmWmmWmW',
    'WmWmmmmmmmW',
    'WmmmmmmmmmW',
    '.WmmmmmmmmW',
    '..WmmmmmmW.',
    '...WmmmmmW.',
    '...WWWWWW..',
  ],
  hourglass: ['WWWWWWW', '.W...W.', '.WmmmW.', '..WmW..', '...W...', '..W.W..', '.W.m.W.', '.WmmmW.', 'WWWWWWW'],
  check: ['......W', '.....WW', 'W...WW.', 'WW.WW..', '.WWW...', '..W....'],
  trap: ['..WWW..', '.WmmmW.', 'WmWWWmW', 'WmW.WmW', 'WmWWWmW', '.WmmmW.', '..WWW..'],
  caret: ['W....', 'WW...', 'WWW..', 'WWWW.', 'WWW..', 'WW...', 'W....'],
  crown: ['W..W..W', 'WW.W.WW', 'WWWWWWW', 'WmWmWmW', 'WWWWWWW'],
};

function buildIcon(scene: Phaser.Scene, name: keyof typeof ICON): void {
  const key = ICON[name];
  if (scene.textures.exists(key)) return;
  const art = ICON_ART[name];
  let p: PixelCanvas;
  if (typeof art === 'function') {
    p = new PixelCanvas(19, 14);
    art(p);
    const b = p.bounds()!;
    p = p.crop(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
  } else {
    const w = Math.max(...art.map((r) => r.length));
    p = new PixelCanvas(w + 2, art.length + 2);
    p.stamp(art, IK, 1, 1);
  }
  p.outline(PAL.ink);
  scene.textures.addCanvas(key, p.toCanvas());
}

// ---------------------------------------------------------------- mini cards / stripes / misc

export const MINI_CARD_W = 9;
export const MINI_CARD_H = 13;

/** Tiny card back for the opponent hand indicator, in the player's colors. */
export function miniCardKey(player: PlayerId): string {
  return `ui:minicard:${player}`;
}

function buildMiniCard(scene: Phaser.Scene, player: PlayerId): void {
  const key = miniCardKey(player);
  if (scene.textures.exists(key)) return;
  const R = player === 0 ? RAMPS.cyan : RAMPS.crim;
  const w = MINI_CARD_W;
  const h = MINI_CARD_H;
  const p = new PixelCanvas(w, h);
  p.rect(0, 0, w, h, PAL.ink);
  p.rect(1, 1, w - 2, h - 2, R[2]);
  p.rect(2, 2, w - 4, h - 4, PAL.night1);
  p.hline(1, w - 2, 1, R[3]);
  p.vline(1, 1, h - 2, R[3]);
  p.set(4, 4, R[3]).set(3, 6, R[3]).set(5, 6, R[3]).set(4, 8, R[3]).set(4, 6, R[4]);
  p.set(4, 5, R[1]).set(4, 7, R[1]).set(3, 5, PAL.night2).set(5, 7, PAL.night2);
  scene.textures.addCanvas(key, p.toCanvas());
}

export function stripesKey(style: UiStyle): string {
  return `ui:stripes:${style}`;
}

/** 32×32 tileable 45° stripes in a ramp's dark tones (pass-device curtain). */
export function stripesTex(scene: Phaser.Scene, style: UiStyle): string {
  const key = stripesKey(style);
  if (scene.textures.exists(key)) return key;
  const R = UI_RAMP[style];
  const p = new PixelCanvas(32, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const k = (x + y) & 15;
      let c = k < 8 ? mix(R[0], PAL.night0, 0.25) : mix(R[0], PAL.ink, 0.45);
      if (k === 0) c = R[1];
      if (k === 1) c = mix(R[1], R[0], 0.5);
      p.set(x, y, c);
    }
  return put(scene, key, p);
}

/** 1px-wide vertical gradient line texture for speed streaks: white, w×1 fading at the tail. */
export function streakTex(scene: Phaser.Scene, len: number): string {
  const key = `ui:streak:${len}`;
  if (scene.textures.exists(key)) return key;
  const p = new PixelCanvas(len, 1);
  for (let x = 0; x < len; x++) p.set(x, 0, 0xffffff, Math.round(255 * Math.pow(x / (len - 1), 1.4)));
  return put(scene, key, p);
}

/** A soft round glow (stepped alpha), white, diameter 2r+1. ADD + tint. */
export function haloTex(scene: Phaser.Scene, r: number): string {
  const key = `ui:halo:${r}`;
  if (scene.textures.exists(key)) return key;
  const s = r * 2 + 1;
  const p = new PixelCanvas(s, s);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d > 1) continue;
      const a = Math.pow(1 - d, 1.8);
      const q = Math.round(a * 6) / 6; // stepped bands
      if (q > 0) p.set(x, y, 0xffffff, Math.round(q * 120));
    }
  return put(scene, key, p);
}

/** Elliptical halo (stepped, white) of rx × ry — card auras in the inspect panel. */
export function ovalHaloTex(scene: Phaser.Scene, rx: number, ry: number): string {
  const key = `ui:ovalhalo:${rx}x${ry}`;
  if (scene.textures.exists(key)) return key;
  const w = rx * 2 + 1;
  const h = ry * 2 + 1;
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - rx) / rx, (y - ry) / ry);
      if (d > 1) continue;
      const a = Math.pow(1 - d, 1.5);
      const q = Math.round(a * 5) / 5;
      if (q > 0 && PixelCanvas.ditherAt(x, y, Math.round(8 + q * 8))) p.set(x, y, 0xffffff, Math.round(q * 150));
    }
  return put(scene, key, p);
}

/** Hexagonal player badge (25×23) in the player's ramp, number drawn on top by the HUD. */
export function emblemTex(scene: Phaser.Scene, player: PlayerId): string {
  const key = `ui:emblem:${player}`;
  if (scene.textures.exists(key)) return key;
  const R = player === 0 ? RAMPS.cyan : RAMPS.crim;
  const w = 25;
  const h = 23;
  const p = new PixelCanvas(w, h);
  const hex = (inset: number): [number, number][] => [
    [6 + inset, inset],
    [w - 7 - inset, inset],
    [w - 1 - inset, (h - 1) / 2],
    [w - 7 - inset, h - 1 - inset],
    [6 + inset, h - 1 - inset],
    [inset, (h - 1) / 2],
  ];
  p.poly(hex(0), PAL.ink);
  p.poly(hex(1), R[2]);
  p.poly(hex(2), R[1]);
  p.poly(hex(3), mix(R[0], PAL.night0, 0.3));
  // light from the top-left: brighten the upper-left rim, darken the lower-right
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = p.get(x, y);
      if (c === R[2]) {
        if (y < h / 2 - 1 || x < 4) p.set(x, y, R[3]);
        if (y < 3 && x < w / 2) p.set(x, y, R[4]);
      }
      if (c === R[1] && y > h / 2 + 2) p.set(x, y, mix(R[1], R[0], 0.5));
    }
  // inner facets
  p.line(7, 4, 4, h / 2, mix(R[1], R[2], 0.5));
  p.set(w - 8, h - 5, R[2]);
  return put(scene, key, p);
}

// ---------------------------------------------------------------- text

/**
 * Time-based typewriter for a pixelText(): reveals characters by elapsed scene time (any
 * number per frame), so fast rates really are fast. Resolves when everything is visible.
 */
export function typeOn(scene: Phaser.Scene, t: Phaser.GameObjects.BitmapText, cps = 200, onChar?: (n: number) => void): Promise<void> {
  const total = revealText(t, 0);
  if (total === 0) return Promise.resolve();
  let shown = 0;
  return tweenValue(scene, 0, total, (total / cps) * 1000, (v) => {
    const n = Math.min(total, Math.floor(v + 1));
    if (n !== shown && t.active) {
      shown = n;
      revealText(t, n);
      onChar?.(n);
    }
  }).then(() => {
    if (t.active) revealText(t, Infinity);
  });
}

// ---------------------------------------------------------------- boot

/** Called by src/boot/40-ui.ts. Prebuilds the fixed-size textures; others build lazily. */
export function buildUiTextures(scene: Phaser.Scene): void {
  for (const name of Object.keys(ICON) as (keyof typeof ICON)[]) buildIcon(scene, name);
  buildMiniCard(scene, 0);
  buildMiniCard(scene, 1);
  for (const s of ['p1', 'p2', 'trap', 'gold'] as UiStyle[]) stripesTex(scene, s);
  streakTex(scene, 24);
  haloTex(scene, 12);
}
