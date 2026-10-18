// Contact flash (v3 hit-reaction kit, docs/v3/A0_ENVANTER.md §6.2 item 1): the white hit frame
// lights ONLY the part of the body the blow lands on — never the whole silhouette (A0 G5: the old
// full-white frame hid the reaction it was meant to sell).
//
//   contactFlash(scene, unit.sprite, blowDir, { frames: 2, coverage: 0.4, at, tint })
//
// The lit part is shaped like light hitting a side of the body, not like a mask (A2 fix: the first
// version lit a half-plane, a hard straight cut through the chest): the opaque pixels of the
// CURRENT frame nearest the contact point — measured across the blow (the light spreads over the
// struck face, not through the body) — form stepped bands (flashBands): a solid white core, a
// checkered band (its other pixels in `tint`, the blow's light tone, when given) and a sparse
// dithered edge; on the last frame the bands step down once. Whatever the pose, the painted
// pixels stay ≤ `coverage` (≤ 0.5) of the silhouette. The contact point is `at` (world) or, without
// one, the edge of the silhouette the blow comes from (opposite `dir`, near the body's centre line).
// It is a small pixel canvas over the sprite that follows it (frame, position, flip) for `frames`
// real frames (it keeps flashing through a hit-stop) — the sprite's own tint is never touched.
//
// A LIGHT subject (A2 art review r2 #2: the crystal wyrm — a white flash on a white body reads as
// over-exposure and wipes its value planes) gets the RIM flash instead (A2 motion review r3 #6: the
// earlier inverse flash, a solid night core + dark cyan band, read as a bite out of the pale body):
// a 1-px rim of light just OUTSIDE the silhouette along the struck part (white where the core
// band meets the edge, the blow's light tone along the rest) and the body's own edge pixels of the
// core band in the light tone; the last frame keeps only the outer rim in the light tone. The
// body's planes are never painted over (lightSubject decides it from the frame's own pixels: most
// of the silhouette in the light tones).
//
// Coverage (A2 motion review r3 #4): the bands' whole region — core, checkered band and the
// dithered edge's extent — stays ≤ `coverage` of the silhouette (a light tint fills the checkered
// band, so its region is what the eye reads as lit).
//
// Pure presentation, no rules; no runtime Phaser import (MonsterUnit.guardHit imports it; the band
// math flashBands and the older crop math cropFromHist are unit-tested in tests/cinematics/).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { XY } from '../../view/layout';

/** Phaser.Scenes.Events.POST_UPDATE / SHUTDOWN (string values: no runtime Phaser import here). */
const POST_UPDATE = 'postupdate';
const SHUTDOWN = 'shutdown';

/** Opaque-pixel histogram of one frame (frame space, as drawn: facing right). */
export interface Hist {
  w: number;
  h: number;
  cols: Uint32Array;
  rows: Uint32Array;
  total: number;
}

const hists = new WeakMap<object, Map<string, Hist>>();
const masks = new WeakMap<object, Map<string, Uint8Array>>();
let scratch: HTMLCanvasElement | null = null;

function frameHist(frame: Phaser.Textures.Frame): Hist | null {
  const src = frame.source;
  let byName = hists.get(src);
  if (!byName) hists.set(src, (byName = new Map()));
  const hit = byName.get(frame.name);
  if (hit) return hit;
  const data = framePixels(frame);
  if (!data) return null;
  const out = histOf(data, frame.cutWidth, frame.cutHeight);
  // a sheet frame is painted lazily: never cache a blank one
  if (!out.total) return null;
  byName.set(frame.name, out);
  return out;
}

/** Opaque mask (alpha ≥ 128 → 1) of a frame, cached; null while the frame is not painted. */
function frameMask(frame: Phaser.Textures.Frame): Uint8Array | null {
  const src = frame.source;
  let byName = masks.get(src);
  if (!byName) masks.set(src, (byName = new Map()));
  const hit = byName.get(frame.name);
  if (hit) return hit;
  const data = framePixels(frame);
  if (!data) return null;
  const m = new Uint8Array(frame.cutWidth * frame.cutHeight);
  let any = false;
  for (let i = 0; i < m.length; i++)
    if (data[i * 4 + 3] >= 128) {
      m[i] = 1;
      any = true;
    }
  if (!any) return null;
  byName.set(frame.name, m);
  return m;
}

const lights = new WeakMap<object, Map<string, boolean>>();

/** Share of a body's opaque pixels in light tones above which it is a light subject. */
export const LIGHT_SHARE = 0.35;
/** Luminance (0…1) of a light tone. */
const LIGHT_LUM = 0.62;

/** Is most of an RGBA buffer's silhouette in light tones (alpha ≥ 128 counts)? */
export function isLightSubject(data: ArrayLike<number>): boolean {
  let n = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    n++;
    const lum = (data[i] * 0.3 + data[i + 1] * 0.55 + data[i + 2] * 0.15) / 255;
    if (lum >= LIGHT_LUM) light++;
  }
  return n > 0 && light / n > LIGHT_SHARE;
}

/** Is the frame a light subject (cached; false while it is not painted)? */
function lightSubject(frame: Phaser.Textures.Frame): boolean {
  const src = frame.source;
  let byName = lights.get(src);
  if (!byName) lights.set(src, (byName = new Map()));
  const hit = byName.get(frame.name);
  if (hit !== undefined) return hit;
  const data = framePixels(frame);
  if (!data) return false;
  const v = isLightSubject(data);
  byName.set(frame.name, v);
  return v;
}

/** RGBA of a frame (frame space), or null. */
function framePixels(frame: Phaser.Textures.Frame): Uint8ClampedArray | null {
  const src = frame.source;
  const w = frame.cutWidth;
  const h = frame.cutHeight;
  if (w <= 0 || h <= 0) return null;
  let data: Uint8ClampedArray;
  try {
    const img = src.image as HTMLCanvasElement | HTMLImageElement;
    let ctx: CanvasRenderingContext2D | null = null;
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) ctx = img.getContext('2d', { willReadFrequently: true });
    if (ctx) data = ctx.getImageData(frame.cutX, frame.cutY, w, h).data;
    else {
      scratch ??= document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      const c = scratch.getContext('2d', { willReadFrequently: true })!;
      c.clearRect(0, 0, w, h);
      c.drawImage(img as CanvasImageSource, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
      data = c.getImageData(0, 0, w, h).data;
    }
  } catch {
    return null;
  }
  return data;
}

/**
 * A crop rectangle in FRAME space (as drawn, facing right): what Sprite.setCrop takes. With flipX
 * the renderer mirrors the cropped quad together with the frame, so a crop of the frame's left
 * columns shows on the right of a flipped sprite.
 */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The part of a frame on the side a blow comes from, holding at most `coverage` of its opaque
 * pixels. `dir` = the direction the blow travels (attacker → target), in screen space.
 */
export function contactCrop(frame: Phaser.Textures.Frame, flipX: boolean, dir: XY, coverage: number): CropRect | null {
  const hist = frameHist(frame);
  return hist ? cropFromHist(hist, flipX, dir, coverage) : null;
}

/**
 * The crop of cropFromHist's frame histogram on the side a blow (travelling along `dir`, screen
 * space) comes from: whole columns (a mostly horizontal blow) or rows (a blow from above) taken
 * from the contact edge inward while the lit part stays ≤ `coverage` (clamped to 0.05…0.5) of the
 * opaque pixels. FRAME-space rectangle (see CropRect); null when not even one line fits.
 */
export function cropFromHist(hist: Hist, flipX: boolean, dir: XY, coverage: number): CropRect | null {
  const cover = Math.max(0.05, Math.min(0.5, coverage));
  const limit = hist.total * cover;
  const horizontal = Math.abs(dir.x) >= Math.abs(dir.y);
  if (horizontal) {
    // the blow comes from the left of the screen when it travels right
    const fromLeft = dir.x > 0;
    const n = hist.w;
    let sum = 0;
    let k = 0;
    for (; k < n; k++) {
      const dx = fromLeft ? k : n - 1 - k; // display column, counted from the contact edge
      const fx = flipX ? n - 1 - dx : dx; // frame column
      if (sum + hist.cols[fx] > limit) break;
      sum += hist.cols[fx];
    }
    if (k <= 0) return null;
    // display columns [0, k) or [n - k, n) → frame columns (mirrored when flipped)
    const leftFrame = flipX ? !fromLeft : fromLeft;
    return leftFrame ? { x: 0, y: 0, w: k, h: hist.h } : { x: n - k, y: 0, w: k, h: hist.h };
  }
  // vertical: from above when it travels down
  const fromTop = dir.y > 0;
  const n = hist.h;
  let sum = 0;
  let k = 0;
  for (; k < n; k++) {
    const y = fromTop ? k : n - 1 - k;
    if (sum + hist.rows[y] > limit) break;
    sum += hist.rows[y];
  }
  if (k <= 0) return null;
  return fromTop ? { x: 0, y: 0, w: hist.w, h: k } : { x: 0, y: n - k, w: hist.w, h: k };
}

/** Opaque-pixel histogram of an RGBA buffer (w × h; alpha ≥ 128 counts). */
export function histOf(data: ArrayLike<number>, w: number, h: number): Hist {
  const cols = new Uint32Array(w);
  const rows = new Uint32Array(h);
  let total = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 128) continue;
      cols[x]++;
      rows[y]++;
      total++;
    }
  return { w, h, cols, rows, total };
}

// ================================================================ bands (pure)

/** Band of each pixel of a frame: 0 unlit, 1 white core, 2 checkered band, 3 sparse dithered edge. */
export interface FlashBands {
  w: number;
  h: number;
  band: Uint8Array;
  /** Opaque pixels of the frame. */
  total: number;
  /** Pixels painted on a full flash frame without a tint (core + half the band + a quarter of the edge). */
  painted: number;
}

/** Share of the coverage given to each band (core / checkered / edge): their regions sum to it. */
const BAND_SHARE = [0.34, 0.29, 0.37] as const;

/** The edge of the silhouette a blow travelling along `d` (frame space) lands on: near the centre line. */
export function contactEdge(mask: ArrayLike<number>, w: number, h: number, d: XY): XY | null {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        n++;
        sx += x;
        sy += y;
      }
  if (!n) return null;
  const cx = sx / n;
  const cy = sy / n;
  let best: XY | null = null;
  let bestS = Infinity;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const along = (x - cx) * d.x + (y - cy) * d.y;
      const perp = Math.abs((x - cx) * d.y - (y - cy) * d.x);
      const sc = along + 0.6 * perp;
      if (sc < bestS) {
        bestS = sc;
        best = { x, y };
      }
    }
  return best;
}

/**
 * The flash bands of a frame (see the header): opaque pixels ordered by their distance to the
 * contact point `c` (frame space), stretched across the blow `d` (unit, frame space: the
 * perpendicular counts 0.7), split into the core / checkered / edge bands so the painted pixels
 * stay ≤ coverage (clamped 0.05…0.5) of the silhouette — with a tint filling the checkered band's
 * other pixels too.
 */
export function flashBands(mask: ArrayLike<number>, w: number, h: number, c: XY, d: XY, coverage: number): FlashBands {
  const cover = Math.max(0.05, Math.min(0.5, coverage));
  const l = Math.hypot(d.x, d.y) || 1;
  const dx = d.x / l;
  const dy = d.y / l;
  const idx: number[] = [];
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const ax = x - c.x;
      const ay = y - c.y;
      const along = ax * dx + ay * dy;
      const perp = ax * dy - ay * dx;
      dist[i] = Math.hypot(along, perp * 0.7);
      idx.push(i);
    }
  const total = idx.length;
  idx.sort((a, b) => dist[a] - dist[b]);
  const n1 = Math.floor(total * cover * BAND_SHARE[0]);
  const n2 = Math.floor(total * cover * BAND_SHARE[1]);
  const n3 = Math.floor(total * cover * BAND_SHARE[2]);
  const band = new Uint8Array(w * h);
  let painted = 0;
  for (let k = 0; k < Math.min(total, n1 + n2 + n3); k++) {
    const i = idx[k];
    const x = i % w;
    const y = (i - x) / w;
    if (k < n1) {
      band[i] = 1;
      painted++;
    } else if (k < n1 + n2) {
      band[i] = 2;
      if ((x + y) % 2 === 0) painted++;
    } else if (x % 2 === 0 && (y + (x >> 1)) % 2 === 0) {
      band[i] = 3;
      painted++;
    }
  }
  return { w, h, band, total, painted };
}

// ================================================================ the rim flash (light subjects)

/**
 * The rim flash of a light body into `px` (RGBA, the frame's size): transparent pixels next to the
 * lit bands get the rim (white beside the core band, `tint` beside the others), the core band's
 * own edge pixels the tint; `last`: only the outer rim beside the core and checkered bands, in
 * the tint. Pure.
 */
export function paintRim(px: Uint8ClampedArray, b: FlashBands, mask: ArrayLike<number>, core: [number, number, number], tint: [number, number, number], last: boolean): number {
  const { w, h, band } = b;
  let n = 0;
  const put = (i: number, c: [number, number, number]) => {
    px[i * 4] = c[0];
    px[i * 4 + 1] = c[1];
    px[i * 4 + 2] = c[2];
    px[i * 4 + 3] = 255;
    n++;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // the strongest lit band among the 4-neighbours, and whether one of them is empty
      let nb = 0;
      let open = false;
      for (const [dx, dy] of NEIGHBOURS) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
          open = true;
          continue;
        }
        const j = yy * w + xx;
        if (!mask[j]) open = true;
        else if (band[j] && (!nb || band[j] < nb)) nb = band[j];
      }
      if (mask[i]) {
        if (!last && band[i] === 1 && open) put(i, tint);
      } else if (nb === 1 || nb === 2) put(i, last || nb === 2 ? tint : core);
      else if (nb === 3 && !last) put(i, tint);
    }
  return n;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// ================================================================ the flash

export interface ContactFlashOpts {
  /** Real frames it stays (2; 3 for a heavy blow). The last one steps the bands down once. */
  frames?: number;
  /** Share of the silhouette it may cover (default 0.4, never more than 0.5): the lit bands' whole region. */
  coverage?: number;
  /** The core's colour (default white). */
  color?: number;
  /** The blow's light tone: fills the checkered band's other pixels (default: none, they stay unlit). */
  tint?: number;
  /** World point the blow lands on (default: the silhouette's edge facing the blow). */
  at?: XY;
}

let flashSeq = 0;

function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

/**
 * The flash over the part of `s` the blow (travelling along `dir`, screen space) lands on (see the
 * header). Fire and forget; it ends on its own (also when the sprite goes away or the scene shuts
 * down).
 */
export function contactFlash(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, dir: XY, o: ContactFlashOpts = {}): void {
  if (!s.active || !s.visible || !s.frame) return;
  // a light body: the rim flash (a 1-px rim of light outside the struck part, see the header)
  const rim = o.color === undefined && lightSubject(s.frame);
  const frames = Math.max(1, o.frames ?? 2);
  const cover = o.coverage ?? 0.4;
  const core = rgb(o.color ?? PAL.white);
  const tint = o.tint !== undefined ? rgb(o.tint) : rim ? rgb(PAL.cyan4) : null;
  // the contact point stays where the blow landed (frame space is re-derived per frame)
  const atWorld = o.at ? { x: o.at.x, y: o.at.y } : null;
  let key = '';
  let tex: Phaser.Textures.CanvasTexture | null = null;
  let img: Phaser.GameObjects.Image | null = null;
  let tw = 0;
  let th = 0;
  let shown = '';
  let k = 0;
  let mask: Uint8Array | null = null;
  const bandsOf = (fr: Phaser.Textures.Frame): FlashBands | null => {
    mask = frameMask(fr);
    if (!mask) return null;
    const w = fr.cutWidth;
    const h = fr.cutHeight;
    // the blow in frame space (a flipped sprite shows the frame mirrored)
    const d = { x: s.flipX ? -dir.x : dir.x, y: dir.y };
    let c: XY | null = null;
    if (atWorld) {
      const kx = Math.abs(s.scaleX) || 1;
      const ky = Math.abs(s.scaleY) || 1;
      let fx = (atWorld.x - (s.x - s.displayOriginX * kx)) / kx;
      const fy = (atWorld.y - (s.y - s.displayOriginY * ky)) / ky;
      if (s.flipX) fx = w - 1 - fx;
      c = { x: Math.round(fx), y: Math.round(fy) };
    }
    c ??= contactEdge(mask, w, h, d);
    return c ? flashBands(mask, w, h, c, d, cover) : null;
  };
  const paint = (b: FlashBands, last: boolean) => {
    if (!tex) return;
    const ctx = tex.context;
    const im = ctx.createImageData(b.w, b.h);
    const px = im.data;
    if (rim && mask) {
      paintRim(px, b, mask, core, tint ?? core, last);
      ctx.putImageData(im, 0, 0);
      tex.refresh();
      return;
    }
    for (let i = 0; i < b.band.length; i++) {
      const v = b.band[i];
      if (!v) continue;
      const x = i % b.w;
      const y = (i - x) / b.w;
      let col: [number, number, number] | null = null;
      // the last frame steps every band down once (core → checkered, checkered → edge, edge → off)
      const lv = last ? v + 1 : v;
      if (lv === 1) col = core;
      else if (lv === 2) col = (x + y) % 2 === 0 ? core : tint;
      else if (lv === 3) col = x % 2 === 0 && (y + (x >> 1)) % 2 === 0 ? core : null;
      if (!col) continue;
      px[i * 4] = col[0];
      px[i * 4 + 1] = col[1];
      px[i * 4 + 2] = col[2];
      px[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    tex.refresh();
  };
  const sync = (): boolean => {
    if (!s.active || !s.frame) return false;
    const fr = s.frame;
    const w = fr.cutWidth;
    const h = fr.cutHeight;
    if (!tex || w !== tw || h !== th) {
      if (img) img.destroy();
      if (key && scene.textures.exists(key)) scene.textures.remove(key);
      key = `fx:cflash:${++flashSeq}`;
      tex = scene.textures.createCanvas(key, w, h);
      if (!tex) return false;
      tw = w;
      th = h;
      img = scene.add.image(s.x, s.y, key);
      shown = '';
    }
    const last = k >= frames && frames > 1;
    const sig = `${fr.name}|${last}`;
    if (sig !== shown) {
      const b = bandsOf(fr);
      if (!b) return false;
      paint(b, last);
      shown = sig;
    }
    img!.setPosition(s.x, s.y).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setDepth(s.depth + 0.05).setVisible(s.visible);
    return true;
  };
  const end = () => {
    scene.events.off(POST_UPDATE, tick);
    scene.events.off(SHUTDOWN, end);
    if (img && img.active) img.destroy();
    if (key && scene.textures.exists(key)) scene.textures.remove(key);
  };
  const tick = () => {
    if (++k > frames || !s.active) return end();
    if (!sync()) end();
  };
  if (!sync()) return end();
  scene.events.on(POST_UPDATE, tick);
  scene.events.once(SHUTDOWN, end);
}
