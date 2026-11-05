// Kukla İpi (puppet_string) — the puppet's body language (only this card uses it). While the strings hold a
// monster, its sprite stops its own idle (a puppet is limp) and shows hand-made pose frames of the frame it had
// when it was hooked: a stepped 1-px shear (the body leans left / right on the strings, the feet stay planted)
// and a "dangle" (the lower third hangs 1–2 px lower than the strings: the legs dangle at the top of a hop).
// Every pose is a whole-pixel copy of the art (rows shifted, never resampled): crisp, palette-exact.
// Also finds the art's eye pixels (the brightest small marks with dark around them in the head band) for the
// spiral glint.

import type Phaser from 'phaser';
import { frameRGBA } from '../../art/atlas';
import type { XY } from '../../view/layout';

/** Horizontal padding (px) each side of a pose frame, room for the lean. */
const PAD_X = 6;
/** Bottom padding (px) of a pose frame, room for the dangle. */
const PAD_Y = 3;

let serial = 0;

export interface PuppetPose {
  /** Show pose (lean px at the top of the body, screen space: + = right; dangle px). 0, 0 = the hooked frame. */
  set(lean: number, dangle: number): void;
  /** Screen offset of a sprite-relative point (sprite pos + rel, current facing) under the current pose. */
  offset(rel: XY): XY;
  /** Eye points relative to the sprite position, P1 facing (mirror them for a flipped sprite with mirrorX()). */
  readonly eyes: XY[];
  /**
   * Phaser flips a sprite inside its frame bounds, not around its origin: a sprite-relative x maps to
   * `mirror - x` on a flipped sprite (mirror = W·(1 − 2·originX) of the hooked frame).
   */
  readonly mirror: number;
  /** Back to the real sprite: its own texture, frame and idle. Removes the pose textures. */
  restore(): void;
  lean: number;
  dangle: number;
}

/**
 * Freeze `sprite` into puppet poses. Returns null when the frame's pixels cannot be read (then the scene keeps the
 * plain sprite: everything still works, only without the lean / dangle).
 */
export function puppetPose(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): PuppetPose | null {
  const fr = sprite.frame;
  if (!fr) return null;
  const data = frameRGBA(fr);
  if (!data) return null;
  const W = fr.realWidth;
  const H = fr.realHeight;
  // opaque rows
  let top = -1;
  let bot = -1;
  for (let y = 0; y < H; y++) {
    let any = false;
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4 + 3] > 0) {
        any = true;
        break;
      }
    if (any) {
      if (top < 0) top = y;
      bot = y;
    }
  }
  if (top < 0) return null;
  const ox = sprite.originX;
  const oy = sprite.originY;
  const texKey = sprite.texture.key;
  const frameName = fr.name;
  const wasPlaying = sprite.anims.isPlaying;
  sprite.anims.pause();
  const id = ++serial;
  const keys: string[] = [];
  const h = Math.max(1, bot - top);
  /** Dangle boundary: rows from here down hang lower. */
  const hangY = Math.round(top + h * 0.58);
  /** Frame-row shift for a lean (canvas space: + = right in the art's own facing). */
  const shiftAt = (lean: number, y: number) => Math.round((lean * (bot - y)) / h);

  const build = (leanArt: number, dangle: number): string => {
    const key = `e:puppet:pose:${id}:${leanArt}:${dangle}`;
    if (scene.textures.exists(key)) return key;
    const cw = W + PAD_X * 2;
    const ch = H + PAD_Y;
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const c2 = cv.getContext('2d')!;
    const img = c2.createImageData(cw, ch);
    const out = img.data;
    for (let y = 0; y < ch; y++) {
      // the dangle: rows above hangY stay, the boundary row repeats `dangle` times, the rest moves down
      const sy = y < hangY ? y : y < hangY + dangle ? hangY : y - dangle;
      if (sy < 0 || sy >= H) continue;
      const sh = shiftAt(leanArt, Math.min(sy, bot));
      for (let x = 0; x < W; x++) {
        const si = (sy * W + x) * 4;
        if (data[si + 3] === 0) continue;
        const dx = x + PAD_X + sh;
        if (dx < 0 || dx >= cw) continue;
        const di = (y * cw + dx) * 4;
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    c2.putImageData(img, 0, 0);
    scene.textures.addCanvas(key, cv);
    keys.push(key);
    return key;
  };

  const eyes = findEyes(data, W, H, top, bot);
  // frame px → sprite-relative (P1 facing: unflipped art)
  const rel = (fx: number, fy: number): XY => ({ x: Math.round(fx + 0.5 - ox * W), y: Math.round(fy + 0.5 - oy * H) });
  const eyesRel = eyes.map((e) => rel(e.x, e.y));
  const topRel = top - oy * H;
  const botRel = bot - oy * H;
  const hangRel = hangY - oy * H;

  const pose: PuppetPose = {
    lean: 0,
    dangle: 0,
    eyes: eyesRel,
    mirror: W * (1 - 2 * ox),
    set(lean, dangle) {
      lean = Math.round(lean);
      dangle = Math.max(0, Math.min(PAD_Y, Math.round(dangle)));
      pose.lean = lean;
      pose.dangle = dangle;
      if (!sprite.active) return;
      const leanArt = sprite.flipX ? -lean : lean;
      const key = build(leanArt, dangle);
      sprite.setTexture(key);
      sprite.setOrigin((ox * W + PAD_X) / (W + PAD_X * 2), (oy * H) / (H + PAD_Y));
    },
    offset(r) {
      const fy = r.y;
      const dx = Math.round((pose.lean * (botRel - Math.min(fy, botRel))) / h);
      const dy = fy >= hangRel ? pose.dangle : 0;
      return { x: dx, y: dy };
    },
    restore() {
      if (sprite.active) {
        sprite.setTexture(texKey, frameName);
        sprite.setOrigin(ox, oy);
        if (wasPlaying) sprite.anims.resume();
      }
      for (const k of keys) if (scene.textures.exists(k)) scene.textures.remove(k);
      keys.length = 0;
    },
  };
  void topRel;
  return pose;
}

/**
 * The eye points of a frame (frame px), most likely first: in the face band (below the horns / crest, above the
 * chest), inside the silhouette, the brightest marks that sit in a socket (darker pixels above AND below: a lit
 * slit or dot in a face, not a highlight on the rim of a horn or a crest). Pure (tests and probes use it).
 */
export function findEyes(data: Uint8ClampedArray | Uint8Array, W: number, H: number, top: number, bot: number): XY[] {
  const h = Math.max(1, bot - top);
  const eyes: XY[] = [];
  // eyes: in the face band (below the horns / crest, above the chest), inside the silhouette, the brightest
  // marks that sit in a socket (darker pixels above AND below: a lit slit or dot in a face, not a highlight on
  // the rim of a horn or a crest)
    const lum = (i: number) => 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    const ya = Math.round(top + h * 0.1);
    const yb = Math.round(top + h * 0.4);
    const cand: { x: number; y: number; s: number }[] = [];
    for (let y = Math.max(1, ya); y <= Math.min(H - 2, yb); y++) {
      // the row's opaque span: candidates keep 2 px inside it
      let x0 = -1;
      let x1 = -1;
      for (let x = 0; x < W; x++)
        if (data[(y * W + x) * 4 + 3] > 0) {
          if (x0 < 0) x0 = x;
          x1 = x;
        }
      if (x0 < 0) continue;
      for (let x = Math.max(1, x0 + 2); x <= Math.min(W - 2, x1 - 2); x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] === 0) continue;
        const up = ((y - 1) * W + x) * 4;
        const dn = ((y + 1) * W + x) * 4;
        if (data[up + 3] === 0 || data[dn + 3] === 0) continue;
        const L = lum(i);
        const socket = Math.min(L - lum(up), L - lum(dn));
        if (socket < 40 || L < 120) continue;
        const mx = Math.max(data[i], data[i + 1], data[i + 2]);
        const mn = Math.min(data[i], data[i + 1], data[i + 2]);
        cand.push({ x, y, s: L + socket * 1.5 + (mx - mn) * 0.3 });
      }
    }
    cand.sort((a, b) => b.s - a.s);
    const first = cand[0];
    if (first) {
      // an eye is often a 2–3 px slit: aim the spiral at its middle
      const run = (c: { x: number; y: number }) => {
        let l = c.x;
        let r = c.x;
        const L0 = lum((c.y * W + c.x) * 4);
        while (l > 0 && data[(c.y * W + l - 1) * 4 + 3] > 0 && lum((c.y * W + l - 1) * 4) > L0 - 50) l--;
        while (r < W - 1 && data[(c.y * W + r + 1) * 4 + 3] > 0 && lum((c.y * W + r + 1) * 4) > L0 - 50) r++;
        return { l: Math.max(l, c.x - 2), r: Math.min(r, c.x + 2) };
      };
      const r1 = run(first);
      eyes.push({ x: Math.round((r1.l + r1.r) / 2), y: first.y });
      const second = cand.find((c) => (c.x < r1.l - 1 || c.x > r1.r + 1) && Math.abs(c.x - first.x) <= 12 && Math.abs(c.y - first.y) <= 2 && c.s >= first.s * 0.5);
      if (second) {
        const r2 = run(second);
        eyes.push({ x: Math.round((r2.l + r2.r) / 2), y: second.y });
      }
    }
    return eyes;
}
