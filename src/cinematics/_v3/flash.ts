// Contact flash (v3 hit-reaction kit, docs/v3/A0_ENVANTER.md §6.2 item 1): the white hit frame
// covers ONLY the side of the body the blow lands on — never the whole silhouette (A0 G5: the
// old full-white frame hid the reaction it was meant to sell).
//
//   contactFlash(scene, unit.sprite, blowDir, { frames: 2, coverage: 0.4 })
//
// The split follows the blow: a mostly horizontal blow (dir = attacker → target) lights the
// columns facing the attacker, a blow from above (a sky bolt) the top rows. The cut is chosen
// from the CURRENT frame's own opaque pixels so the lit part holds at most `coverage` (≤ 0.5) of
// the silhouette, whatever the pose. It is a crop of a white copy of the frame that follows the
// sprite for `frames` real frames (it keeps flashing through a hit-stop), like MonsterUnit's
// flash overlay — the sprite's own tint is never touched.
//
// Pure presentation, no rules; no runtime Phaser import (MonsterUnit.guardHit imports it; the crop
// math cropFromHist is unit-tested in tests/cinematics/v3-kit.test.ts).

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
let scratch: HTMLCanvasElement | null = null;

function frameHist(frame: Phaser.Textures.Frame): Hist | null {
  const src = frame.source;
  let byName = hists.get(src);
  if (!byName) hists.set(src, (byName = new Map()));
  const hit = byName.get(frame.name);
  if (hit) return hit;
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
  const out = histOf(data, w, h);
  // a sheet frame is painted lazily: never cache a blank one
  if (!out.total) return null;
  byName.set(frame.name, out);
  return out;
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

export interface ContactFlashOpts {
  /** Real frames it stays (2; 3 for a heavy blow). */
  frames?: number;
  /** Share of the silhouette it may cover (default 0.4, never more than 0.5). */
  coverage?: number;
  color?: number;
}

/**
 * White flash over the side of `s` the blow (travelling along `dir`) lands on. Fire and forget;
 * it ends on its own (also when the sprite goes away or the scene shuts down).
 */
export function contactFlash(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, dir: XY, o: ContactFlashOpts = {}): void {
  if (!s.active || !s.visible || !s.frame) return;
  const frames = o.frames ?? 2;
  const cover = o.coverage ?? 0.4;
  const g = scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setDepth(s.depth + 0.05).setTintFill(o.color ?? PAL.white);
  const sync = (): boolean => {
    g.setTexture(s.texture.key, s.frame.name).setPosition(s.x, s.y).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setDepth(s.depth + 0.05);
    const r = contactCrop(s.frame, s.flipX, dir, cover);
    if (!r) return false;
    g.setCrop(r.x, r.y, r.w, r.h).setVisible(s.visible);
    return true;
  };
  if (!sync()) {
    g.destroy();
    return;
  }
  let k = 0;
  const end = () => {
    scene.events.off(POST_UPDATE, tick);
    scene.events.off(SHUTDOWN, end);
    if (g.active) g.destroy();
  };
  const tick = () => {
    if (++k > frames || !s.active || !g.active) return end();
    if (!sync()) end();
  };
  scene.events.on(POST_UPDATE, tick);
  scene.events.once(SHUTDOWN, end);
}
