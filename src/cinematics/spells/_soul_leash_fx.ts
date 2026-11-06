// Ruh Tasması (soul_leash) — the drawing pieces of its v3 scenes (used only by ./soul_leash.ts):
//   neckOf        where a monster's collar sits (a silhouette heuristic + hand-placed overrides)
//   Collar        the purple-gold leather collar: two small rasters round the neck (the back arc behind the
//                 body, the front arc, studs and the buckle in front of it), woven in steps, locked, broken
//   ShadowDouble  the monster's SHADOW as a standing figure: its own silhouette in flat void tones (void0 body,
//                 void2 contour, void3 lit top-left contour), crisp, mirrored about its anchor when it turns
//   drawLeash     the leash line from the card to the collar: a sagging chain (void3 links, a gold2 link every
//                 4th pixel) or, once locked, the thin light bond (void2 with void3 links and running beads)
//   stepRing      a stepped floor ring (whole pixels, no dither)
// Palette only (PAL), integer pixels everywhere.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import { PAL } from '../../art/palette';
import type { XY } from '../../view/layout';
import { BOARD_ROWS, DEPTH, LANE_COLS, isoToScreen, screenToIso } from '../../view/layout';
import { Raster, qbez, run } from '../../vfx/setpieces';
import { silhouetteOf, type Silhouette } from '../_v3/spellfx';

const R = Math.round;
const TAU = Math.PI * 2;

// ================================================================ the neck

/**
 * Hand-placed collar points for monsters the heuristic misreads (fractions of the silhouette box, facing
 * right: x from the back edge, y from the top; rx = the collar's half width).
 */
const NECK_FIX: Partial<Record<CardId, { x: number; y: number; rx: number }>> = {
  crystal_wyrm: { x: 0.74, y: 0.27, rx: 5 },
  ember_wolf: { x: 0.8, y: 0.3, rx: 5 },
  thorn_lurker: { x: 0.55, y: 0.3, rx: 6 },
};

export interface Neck {
  /** Offset from the sprite position (x, y) in the facing the sprite had when it was measured. */
  dx: number;
  dy: number;
  /** The collar's half width (px) and height. */
  rx: number;
  ry: number;
  /** The facing (sprite flipX) when measured: mirror dx when it differs. */
  flip: boolean;
}

/** The collar point of a sprite on its current frame (null: no readable silhouette). */
export function neckOf(s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, cardId: CardId | null): Neck | null {
  const sil = silhouetteOf(s);
  if (!sil) return null;
  const w = sil.right - sil.left;
  const h = sil.bottom - sil.top;
  const flip = s.flipX;
  const fix = cardId ? NECK_FIX[cardId] : undefined;
  let nx: number;
  let ny: number;
  let rx: number;
  if (fix) {
    ny = R(sil.top + h * fix.y);
    const fx = flip ? 1 - fix.x : fix.x;
    nx = R(sil.left + w * fx);
    rx = fix.rx;
  } else {
    // a row about a quarter down the body; the run of opaque pixels nearest the body's centre line
    ny = R(sil.top + Math.max(4, h * 0.31));
    const cx = R(s.x);
    const runs: [number, number][] = [];
    let a: number | null = null;
    for (let x = sil.left - 1; x <= sil.right; x++) {
      const on = sil.has(x, ny);
      if (on && a === null) a = x;
      if (!on && a !== null) {
        runs.push([a, x - 1]);
        a = null;
      }
    }
    let best: [number, number] = [cx - 3, cx + 3];
    let bd = Infinity;
    for (const r of runs) {
      const d = cx < r[0] ? r[0] - cx : cx > r[1] ? cx - r[1] : 0;
      const wide = r[1] - r[0] + 1;
      if (wide < 3) continue;
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    nx = R((best[0] + best[1]) / 2);
    rx = Math.max(6, Math.min(9, R((best[1] - best[0] + 1) / 2) + 2));
  }
  return { dx: nx - R(s.x), dy: ny - R(s.y), rx, ry: rx <= 5 ? 2 : 3, flip };
}

/** The world collar point for a neck measured on a sprite now at (x, y) facing `flip`. */
export function neckAt(n: Neck, x: number, y: number, flip: boolean): XY {
  return { x: R(x) + (flip === n.flip ? n.dx : -n.dx), y: R(y) + n.dy };
}

// ================================================================ the collar

export type BuckleState = 'none' | 'on' | 'flash' | 'open' | 'half';

export interface CollarLook {
  /** Woven part 0..1 (stepped by the caller). */
  prog: number;
  buckle: BuckleState;
  /** Drop of the broken pieces (px) and their visibility 0..1 (the break). */
  fall: number;
  /** A white pulse running round the band (0..1, < 0 = none). */
  glint: number;
  /** Ghostly: only the front arc in void3 (on the body after the shadow took the collar). */
  ghost?: boolean;
  /** The lit leather row in this colour (the Draw Phase gift arriving: leaf4). */
  tint?: number;
  /** The whole band flashes (gold4: the weave closing; white: the lock). */
  bandFlash?: number;
}

/**
 * The two rasters of a collar round a neck (back arc behind the body, front arc in front). The band is a real
 * leather collar at 1×: an ink top line, a lit void3 row with gold studs every 3 px (gold3 over gold2), the void2
 * leather, a void1 lower edge, an ink bottom line — 3 px of leather — and a 5×4 brass buckle in an ink frame at
 * the front, with the leash ring under it.
 */
export class Collar {
  readonly back: Raster;
  readonly front: Raster;
  look: CollarLook = { prog: 0, buckle: 'none', fall: 0, glint: -1 };
  rx: number;
  ry: number;
  constructor(sc: Phaser.Scene, rx: number, ry: number) {
    this.rx = rx;
    this.ry = ry;
    this.back = new Raster(sc, 0, 0, 2 * rx + 14, 2 * ry + 12, DEPTH.UNIT);
    this.front = new Raster(sc, 0, 0, 2 * rx + 14, 2 * ry + 22, DEPTH.UNIT);
  }

  get alive(): boolean {
    return this.front.alive;
  }

  /** Draw round the neck point c (the band's centre) with the wearer's depth. */
  draw(c: XY, depth: number, visible = true): void {
    if (!this.front.alive) return;
    const rx = this.rx;
    const ry = this.ry;
    this.back.moveTo(c.x - rx - 7, c.y - ry - 6);
    this.front.moveTo(c.x - rx - 7, c.y - ry - 6);
    this.back.img.setDepth(depth - 0.2).setVisible(visible);
    this.front.img.setDepth(depth + 0.2).setVisible(visible);
    const L = this.look;
    const steps = 16;
    const shown = Math.floor(L.prog * steps + 1e-6);
    const fall = R(L.fall);
    this.back.draw((b) => {
      this.front.draw((f) => {
        if (shown <= 0) return;
        // samples clockwise from the front centre (the buckle), a fine walk so the band has no gaps
        const n = Math.max(40, R((rx + ry) * 10));
        const lim = (shown / steps) * n;
        const glintAt = L.glint >= 0 ? R(L.glint * n) : -99;
        // while it is still being woven its top edge is a gold2 rim, so the wrap reads against a purple body
        const lit = L.tint ?? (L.prog < 1 ? PAL.gold2 : PAL.void4);
        const bf = L.bandFlash;
        for (let i = 0; i <= lim; i++) {
          const a = Math.PI / 2 + (i / n) * TAU;
          const x = R(c.x + Math.cos(a) * rx);
          const y = R(c.y + Math.sin(a) * ry);
          const frontSide = Math.sin(a) >= -0.15;
          const g = Math.abs(i - glintAt) <= 1;
          if (L.ghost) {
            if (frontSide && i % 2 === 0) f.px(x, y, PAL.void3);
            continue;
          }
          if (bf !== undefined && fall <= 0) {
            const t = frontSide ? f : b;
            t.px(x, y - 2, PAL.ink);
            t.px(x, y - 1, bf === PAL.white ? PAL.white : PAL.gold4);
            t.px(x, y, bf);
            t.px(x, y + 1, bf === PAL.white ? PAL.gold4 : PAL.gold3);
            t.px(x, y + 2, PAL.ink);
            continue;
          }
          if (frontSide) {
            // the break: the front pieces fall away (every other run of 4 drops a pixel more)
            const d = fall > 0 ? fall + ((i >> 2) % 2) : 0;
            const stud = (((x - c.x) % 3) + 3) % 3 === 0 && Math.abs(x - c.x) >= 3;
            f.px(x, y - 2 + d, PAL.ink);
            f.px(x, y - 1 + d, g ? PAL.white : stud ? PAL.gold4 : lit);
            f.px(x, y + d, g ? PAL.white : stud ? PAL.gold2 : PAL.void3);
            f.px(x, y + 1 + d, g ? PAL.void4 : PAL.void2);
            f.px(x, y + 2 + d, PAL.ink);
          } else if (fall <= 0) {
            b.px(x, y - 2, PAL.ink);
            b.px(x, y - 1, PAL.void3);
            b.px(x, y, PAL.void1);
            b.px(x, y + 1, PAL.ink);
          }
        }
        if (L.ghost) return;
        // the weaving tip: while the band is still being wrapped, its leading end burns white-gold
        if (L.prog > 0 && L.prog < 1) {
          const a = Math.PI / 2 + (lim / n) * TAU;
          const x = R(c.x + Math.cos(a) * rx);
          const y = R(c.y + Math.sin(a) * ry);
          const tgt = Math.sin(a) >= -0.15 ? f : b;
          tgt.px(x, y - 1, PAL.white);
          tgt.px(x, y, PAL.white);
          tgt.px(x, y + 1, PAL.gold4);
          tgt.px(x, y - 2, PAL.gold4);
          tgt.px(x + (Math.cos(a) > 0 ? 1 : -1), y - 1, PAL.gold4);
          tgt.px(x + (Math.cos(a) > 0 ? 1 : -1), y, PAL.gold3);
          // the needle: one gold3 pixel a step ahead of the band, pulling it round
          const a2 = Math.PI / 2 + ((lim + 5) / n) * TAU;
          const x2 = R(c.x + Math.cos(a2) * (rx + 1));
          const y2 = R(c.y + Math.sin(a2) * (ry + 1));
          (Math.sin(a2) >= -0.15 ? f : b).px(x2, y2 - 1, PAL.gold3);
          (Math.sin(a2) >= -0.15 ? f : b).px(x2, y2 - 2, PAL.white);
        }
        // the buckle: 5×4 brass in an ink frame at the front centre; the leash ring hangs under it
        if (L.buckle !== 'none' && shown >= steps) {
          const open = L.buckle === 'open';
          const flash = L.buckle === 'flash';
          const bx = c.x - 2;
          const by = c.y + ry - 2 + (open ? fall + 1 : 0);
          const B = flash ? PAL.white : PAL.gold3;
          const S = flash ? PAL.gold4 : PAL.gold2;
          // open: the frame's right half hangs a pixel lower (it sprang)
          const dyAt = (xx: number) => (open && xx >= 3 ? 1 : 0);
          for (let xx = -1; xx <= 5; xx++) for (let yy = -1; yy <= 4; yy++) f.px(bx + xx, by + yy + dyAt(xx), PAL.ink);
          for (let xx = 0; xx < 5; xx++)
            for (let yy = 0; yy < 4; yy++) {
              const edge = yy === 0 || yy === 3 || xx === 0 || xx === 4;
              let col: number = edge ? (yy === 0 || xx === 0 ? B : S) : PAL.void0;
              if (xx === 0 && yy === 0 && !flash) col = PAL.gold4;
              f.px(bx + xx, by + yy + dyAt(xx), col);
            }
          // the tongue through the frame: none (open), half way (half), home (on / flash)
          const tongue = flash ? PAL.white : PAL.gold4;
          if (L.buckle === 'half') f.px(bx + 2, by + 1, tongue);
          else if (!open) {
            f.px(bx + 2, by + 1, tongue);
            f.px(bx + 2, by + 2, tongue);
          }
          // the ring under it (the hook of the chain)
          if (!open) {
            f.px(bx + 1, by + 4, PAL.ink);
            f.px(bx + 3, by + 4, PAL.ink);
            f.px(bx + 2, by + 4, flash ? PAL.white : PAL.gold3);
            f.px(bx + 1, by + 5, flash ? PAL.white : PAL.gold3);
            f.px(bx + 3, by + 5, flash ? PAL.white : PAL.gold3);
            f.px(bx + 2, by + 6, flash ? PAL.white : PAL.gold2);
            f.px(bx + 2, by + 5, PAL.ink);
          }
        }
      });
    });
  }

  /** Where the leash hooks on (the ring under the buckle). */
  ring(c: XY): XY {
    return { x: c.x, y: c.y + this.ry + 4 };
  }

  /** The back of the neck (the side away from the facing): the lingering bond hangs from here, behind the body. */
  backPoint(c: XY, facingLeft: boolean): XY {
    return { x: c.x + (facingLeft ? this.rx : -this.rx), y: c.y };
  }

  destroy(): void {
    this.back.destroy();
    this.front.destroy();
  }
}

/** The lock's starburst at the buckle: 4 stepped frames of plus-shaped motes flying out (white → gold2). */
export function lockBurst(sc: Phaser.Scene, at: XY, depth = DEPTH.FX + 9): Promise<void> {
  const ras = Raster.around(sc, at.x, at.y, 30, 26, depth);
  const ramp = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2];
  const radii = [3, 6, 9, 11];
  const plus = (r: Raster, x: number, y: number, c: number, big: boolean) => {
    r.px(x, y, c);
    if (!big) return;
    r.px(x - 1, y, c);
    r.px(x + 1, y, c);
    r.px(x, y - 1, c);
    r.px(x, y + 1, c);
  };
  return run(sc, 4 * 40, (t) => {
    const f = Math.min(3, Math.floor(t * 4));
    ras.draw((r) => {
      if (t >= 1) return;
      const rad = radii[f];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + (f % 2) * 0.2;
        const x = R(at.x + Math.cos(a) * rad);
        const y = R(at.y + Math.sin(a) * rad * 0.7);
        plus(r, x, y, ramp[f], i % 2 === 0 && f < 3);
      }
      if (f === 0) plus(r, at.x, at.y, PAL.white, true);
    });
  }).then(() => ras.destroy());
}

// ================================================================ the shadow double

let shadowSeq = 0;

/**
 * The monster's shadow as a standing figure (see the header). Anchor = the sprite position it was made from.
 * Three poses share one silhouette: 0 standing, 1 / 2 a stride (the lower third of the figure sheared one pixel
 * forward / back), so its walk has steps instead of a rigid glide.
 */
export class ShadowDouble {
  readonly img: Phaser.GameObjects.Image;
  private readonly keys: string[] = [];
  /** Offsets of the image's top-left from the anchor (unflipped). */
  private offL: number;
  private offT: number;
  private W: number;
  /** Turned round relative to the sprite it was made from. */
  turned = false;
  anchor: XY;
  pose = 0;
  constructor(sc: Phaser.Scene, s: Phaser.GameObjects.Sprite, sil: Silhouette) {
    const W = sil.right - sil.left + 4;
    const H = sil.bottom - sil.top + 2;
    const sw = sil.bottom - sil.top;
    const shearFrom = sil.top + R(sw * 0.66);
    const id = ++shadowSeq;
    for (let pose = 0; pose < 3; pose++) {
      const key = `leash:shadow:${id}:${pose}`;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d')!;
      const img = g.createImageData(W, H);
      const put = (x: number, y: number, c: number) => {
        if (x < 0 || x >= W || y < 0 || y >= H) return;
        const i = (y * W + x) * 4;
        img.data[i] = (c >> 16) & 255;
        img.data[i + 1] = (c >> 8) & 255;
        img.data[i + 2] = c & 255;
        img.data[i + 3] = 255;
      };
      for (let y = 0; y < H - 2; y++)
        for (let x = 0; x < W - 4; x++) {
          const wx = sil.left + x;
          const wy = sil.top + y;
          if (!sil.has(wx, wy)) continue;
          const up = sil.has(wx, wy - 1);
          const lf = sil.has(wx - 1, wy);
          const dn = sil.has(wx, wy + 1);
          const rt = sil.has(wx + 1, wy);
          let c: number = PAL.void0;
          if (!up || !lf) c = PAL.void3;
          else if (!dn || !rt) c = PAL.void2;
          else if (!sil.has(wx - 1, wy - 1) || !sil.has(wx, wy - 2)) c = PAL.void1;
          const shift = wy >= shearFrom ? (pose === 1 ? 1 : pose === 2 ? -1 : 0) : 0;
          put(x + 2 + shift, y + 1, c);
        }
      g.putImageData(img, 0, 0);
      sc.textures.addCanvas(key, cv);
      this.keys.push(key);
      sc.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sc.textures.exists(key) && sc.textures.remove(key));
    }
    this.anchor = { x: R(s.x), y: R(s.y) };
    this.offL = sil.left - 2 - this.anchor.x;
    this.offT = sil.top - 1 - this.anchor.y;
    this.W = W;
    this.img = sc.add.image(0, 0, this.keys[0]).setOrigin(0, 0).setDepth(s.depth + 0.1);
    this.place();
  }

  /** The stride pose (0 standing, 1 / 2 the two stride frames). */
  setPose(p: number): void {
    if (p === this.pose || !this.img.active) return;
    this.pose = p;
    this.img.setTexture(this.keys[p]);
  }

  /** Move the anchor (the sprite-position equivalent) and redraw at whole pixels. */
  place(at: XY = this.anchor): void {
    this.anchor = { x: R(at.x), y: R(at.y) };
    const x = this.turned ? this.anchor.x - (this.offL + this.W) : this.anchor.x + this.offL;
    this.img.setFlipX(this.turned).setPosition(x, this.anchor.y + this.offT);
  }

  destroy(): void {
    const sc = this.img.scene;
    this.img.destroy();
    for (const key of this.keys) if (sc?.textures?.exists(key)) sc.textures.remove(key);
  }
}

// ================================================================ the leash line

export type LeashMode = 'chain' | 'bond';

export interface LeashLook {
  mode: LeashMode;
  /** Sag at the middle (px, down). */
  sag: number;
  /** Drawn part 0..1 from `a` (the card) toward `b` (the collar ring). */
  prog: number;
  /** A white / gold pulse running along it (0..1 from a, < 0 = none) and its colour. */
  pulse: number;
  pulseColor?: number;
  /** Bead phase (ms) of the bond's slow running light. */
  phase: number;
  /** Brighter (the lock / a Draw Phase heartbeat). */
  hot?: boolean;
  /** The bond's hot colours (default void4 / white, no halo): the Draw Phase beats in leaf. */
  hotColor?: number;
  hotLight?: number;
  hotHalo?: number;
  /** The head of the running pulse (default white). */
  pulseHead?: number;
  /** Cut: the part from `cutFrom` on is gone (0..1, the snap), the rest hangs and drops `drop` px. */
  cutFrom?: number;
  drop?: number;
  /** The chain sways a pixel with `phase` (ms). */
  sway?: boolean;
  /** The lock: the 4 links nearest the collar snap taut and flash white, in order toward the card (0..1, < 0 none). */
  snap?: number;
}

/** The pixels of the leash curve from a to b (deduplicated, whole pixels). */
export function leashPath(a: XY, b: XY, sag: number): XY[] {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag * 2 };
  const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(sag) * 2;
  const n = Math.max(2, Math.ceil(len * 1.5));
  const out: XY[] = [];
  let last: XY | null = null;
  for (let i = 0; i <= n; i++) {
    const p = qbez(a, mid, b, i / n);
    const q = { x: R(p.x), y: R(p.y) };
    if (last && q.x === last.x && q.y === last.y) continue;
    // keep the line 8-connected without doubled corners
    if (last && out.length >= 2) {
      const pp = out[out.length - 2];
      if (Math.abs(q.x - pp.x) <= 1 && Math.abs(q.y - pp.y) <= 1) out.pop();
    }
    out.push(q);
    last = q;
  }
  return out;
}

/** The whole-pixel, 8-connected pixels of a quadratic curve a → b through the control point c. */
export function quadPath(a: XY, c: XY, b: XY): XY[] {
  const len = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
  const n = Math.max(2, Math.ceil(len * 1.5));
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const p = qbez(a, c, b, i / n);
    const q = { x: R(p.x), y: R(p.y) };
    const last = out[out.length - 1];
    if (last && q.x === last.x && q.y === last.y) continue;
    if (out.length >= 2) {
      const pp = out[out.length - 2];
      if (Math.abs(q.x - pp.x) <= 1 && Math.abs(q.y - pp.y) <= 1) out.pop();
    }
    out.push(q);
  }
  return out;
}

/** A face-on chain link: a 4×3 gold oval round an ink hole in an ink outline (6×5 in all), lit from the top. */
function ovalLink(px: (x: number, y: number, c: number) => void, x: number, y: number, top: number, side: number, bot: number): void {
  const K = PAL.ink;
  px(x, y - 2, K);
  px(x + 1, y - 2, K);
  px(x - 1, y - 1, K);
  px(x + 2, y - 1, K);
  px(x - 2, y, K);
  px(x + 3, y, K);
  px(x - 1, y + 1, K);
  px(x + 2, y + 1, K);
  px(x, y + 2, K);
  px(x + 1, y + 2, K);
  px(x, y - 1, top);
  px(x + 1, y - 1, top);
  px(x - 1, y, side);
  px(x + 2, y, side);
  px(x, y, K);
  px(x + 1, y, K);
  px(x, y + 1, bot);
  px(x + 1, y + 1, bot);
}

/** The chain's flying hook: a 5×4 gold ring (ink outline, a white glint) — it reads as a hook, not a dot. */
export function hookRing(px: (x: number, y: number, c: number) => void, x: number, y: number, flash = false): void {
  const K = PAL.ink;
  for (let xx = -2; xx <= 2; xx++) {
    px(x + xx, y - 3, xx === -2 || xx === 2 ? 0 : K);
    px(x + xx, y + 2, xx === -2 || xx === 2 ? 0 : K);
  }
  for (const yy of [-2, -1, 0, 1]) {
    px(x - 3, y + yy, yy === -2 || yy === 1 ? 0 : K);
    px(x + 3, y + yy, yy === -2 || yy === 1 ? 0 : K);
  }
  const T = flash ? PAL.white : PAL.gold4;
  for (let xx = -1; xx <= 1; xx++) px(x + xx, y - 2, T);
  for (let xx = -1; xx <= 1; xx++) px(x + xx, y + 1, flash ? PAL.gold4 : PAL.gold2);
  for (const yy of [-1, 0]) {
    px(x - 2, y + yy, flash ? PAL.gold4 : PAL.gold3);
    px(x + 2, y + yy, flash ? PAL.gold4 : PAL.gold3);
    for (let xx = -1; xx <= 1; xx++) px(x + xx, y + yy, K);
  }
  px(x - 2, y - 2, K);
  px(x + 2, y - 2, K);
  px(x - 2, y + 1, K);
  px(x + 2, y + 1, K);
  px(x - 1, y - 2, PAL.white);
}

/** Pixels the chain may not cover (other units' bodies and stat plates: the chain passes behind them). */
export type Clip = (x: number, y: number) => boolean;

/**
 * Draw the leash (see LeashLook) into a raster. The CHAIN is real links: a gold face-on oval (6×5 with its
 * outline) every 8 px of the curve, a purple side-on link (2 px along the curve, lit top, ink under) between
 * them — it sags and sways a pixel. The bond mode (the old thin line) is kept for callers that want it.
 */
export function drawLeash(r: Raster, a: XY, b: XY, L: LeashLook, clip?: Clip): void {
  const sway = L.mode === 'chain' && L.sway ? R(Math.sin(L.phase / 210)) : 0;
  const pts = leashPath(a, b, L.sag + sway);
  const n = pts.length;
  const end = Math.floor(n * Math.max(0, Math.min(1, L.prog)));
  const pulseAt = L.pulse >= 0 ? R(L.pulse * (n - 1)) : -99;
  const cut = L.cutFrom !== undefined ? Math.floor(n * L.cutFrom) : n;
  const bead = L.mode === 'bond' ? Math.floor(L.phase / 70) % 18 : -1;
  const px = (x: number, y: number, c: number) => {
    if (!c) return;
    if (clip && clip(x, y)) return;
    r.px(x, y, c);
  };
  if (L.mode === 'chain') {
    const PITCH = 8;
    // count links from the collar end so the one at the hook never jumps while the chain grows
    const last = Math.min(end, cut) - 1;
    for (let i = last; i >= 0; i--) {
      const k = (last - i) % PITCH;
      const p = pts[i];
      const dy = L.drop && L.drop > 0 ? R((L.drop * i) / Math.max(1, cut)) : 0;
      const linkNo = Math.floor((last - i) / PITCH);
      const snapHot = L.snap !== undefined && L.snap >= 0 && linkNo < 4 && linkNo <= R(L.snap * 4);
      const hot = L.hot || snapHot || Math.abs(i - pulseAt) <= 3;
      if (k === 0) {
        ovalLink(px, p.x - 1, p.y + dy, hot ? PAL.white : PAL.gold4, hot ? PAL.gold4 : PAL.gold3, hot ? PAL.gold3 : PAL.gold2);
      } else if (k === 4 || k === 5) {
        px(p.x, p.y + dy - 1, hot ? PAL.white : PAL.void4);
        px(p.x, p.y + dy, PAL.void2);
        px(p.x, p.y + dy + 1, PAL.ink);
      } else if (k === 3 || k === 6) {
        // the links' ends meeting: one ink pixel, so the chain never breaks into separate dots
        px(p.x, p.y + dy, PAL.void1);
      }
    }
    if (end < n && end > 0 && L.prog < 1) {
      const p = pts[Math.max(0, end - 1)];
      hookRing(px, p.x, p.y + 1);
    }
    return;
  }
  for (let i = 0; i < end; i++) {
    if (i >= cut) break;
    const p = pts[i];
    const dy = L.drop && L.drop > 0 ? R((L.drop * i) / Math.max(1, cut)) : 0;
    let c: number = i % 3 === 0 ? (L.hot ? PAL.white : PAL.void4) : L.hot ? PAL.void4 : PAL.void3;
    if (bead >= 0 && i % 18 === bead) c = PAL.gold4;
    const d = Math.abs(i - pulseAt);
    if (d === 0) c = PAL.white;
    else if (d <= 2) c = L.pulseColor ?? PAL.gold4;
    else if (d <= 4 && L.pulseColor) c = L.pulseColor === PAL.leaf4 ? PAL.leaf3 : PAL.gold3;
    px(p.x, p.y + dy, c);
  }
}

// ================================================================ the lingering bond (two parts)

/**
 * The lingering bond — a thin LIGHT bond (§7 "ince ışık bağı"), drawn in three parts so it never cuts across its
 * wearer: a 3-px stub leaving the buckle ring IN FRONT of the neck toward the back (the `front` raster, over the
 * sprite), then from the back of the collar it hangs straight down BEHIND the body (the `back` raster), then it
 * lies on the tiles (the `floor` raster, under every unit): out round the wearer's back side IN FRONT of its feet
 * (so even a big body that stands between it and the card never hides it), then to the leash card's near corner.
 * The core is one lit pixel — gold3 / void4 / void4 — over a void2 underline; every 1.5 s a white-gold bead runs up
 * it from the card into the collar. `L.pulse` runs from the card (0) to the collar (1).
 */
export function drawBond(back: Raster, floor: Raster, hook: XY, ground: XY, card: XY, L: LeashLook, facingLeft: boolean, front?: Raster, ring?: XY, halfW = 10): void {
  const foot = { x: R(hook.x), y: R(ground.y) };
  const f = facingLeft ? 1 : -1;
  // the corner out at the back side, a few px in front of the feet
  const corner = { x: R(foot.x + f * (halfW * 0.6 + 6)), y: foot.y + 5 };
  const end = { x: R(card.x + f * 10), y: R(card.y) };
  const ctrl = { x: R(corner.x + f * 22), y: R((corner.y + end.y) / 2) };
  const fl1 = quadPath(end, ctrl, corner);
  const fl2 = quadPath(corner, { x: R((corner.x + foot.x) / 2), y: corner.y }, foot).slice(1);
  const fl = [...fl1, ...fl2];
  const vert: XY[] = [];
  for (let y = foot.y - 1; y >= R(hook.y); y--) vert.push({ x: foot.x, y });
  const stub: XY[] = [];
  if (front && ring) for (let k = 3; k >= 1; k--) stub.push({ x: ring.x + f * k, y: ring.y + (k >= 2 ? 1 : 0) });
  const n = fl.length + vert.length + stub.length;
  const pulseAt = L.pulse >= 0 ? R(L.pulse * (n - 1)) : -99;
  // the slow bead: every 1500 ms a light runs the whole bond in 700 ms
  const bt = L.phase % 1500;
  const beadAt = bt < 700 ? R((bt / 700) * (n - 1)) : -99;
  const hotC = L.hotColor ?? PAL.void4;
  const runC = L.pulseColor ?? PAL.gold4;
  for (let i = 0; i < n; i++) {
    const part = i < fl.length ? 0 : i < fl.length + vert.length ? 1 : 2;
    const p = part === 0 ? fl[i] : part === 1 ? vert[i - fl.length] : stub[i - fl.length - vert.length];
    const r = part === 0 ? floor : part === 1 ? back : front!;
    // the underline axis: under it on the floor, beside it on the hanging part
    const wx = part === 1 ? -f : 0;
    const wy = part === 1 ? 0 : 1;
    let c: number = i % 3 === 0 ? PAL.gold3 : PAL.void4;
    let under: number = PAL.void2;
    const db = i - beadAt;
    if (db <= 0 && db > -3) c = db === 0 ? PAL.white : PAL.gold4;
    if (L.hot) {
      c = i % 2 ? hotC : (L.hotLight ?? PAL.white);
      under = hotC;
      if (L.hotHalo !== undefined) {
        r.px(p.x + 2 * wx, p.y + 2 * wy, L.hotHalo);
        r.px(p.x - wx, p.y - wy, L.hotHalo);
      }
    }
    const d = i - pulseAt;
    if (L.pulse >= 0 && d <= 0 && d > -7) {
      // the run: a bright head and a 6-px body behind it, 2 px wide, a 1-px dark-leaf halo on the far side
      const col = d >= -1 ? (L.pulseHead ?? PAL.white) : runC;
      c = col;
      under = col;
      if (L.pulseColor === PAL.leaf3 && d > -5) r.px(p.x - wx, p.y - wy, PAL.leaf2);
    }
    r.px(p.x + wx, p.y + wy, under);
    if (part === 0 && !L.hot) r.px(p.x, p.y + 2, PAL.ink);
    r.px(p.x, p.y, c);
  }
}

// ================================================================ the walk route

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Another unit on the board, for the walk's route: its screen box, its opaque pixels and its feet's y. */
export interface Obstacle extends Box {
  has(x: number, y: number): boolean;
  y: number;
}

/** The walker's opaque pixels (sampled every 2 px) as offsets from its feet. */
export function walkerMask(sil: Silhouette, groundX: number, groundY: number): XY[] {
  const out: XY[] = [];
  for (let y = sil.top; y <= sil.bottom; y += 2) for (let x = sil.left; x <= sil.right; x += 2) if (sil.has(x, y)) out.push({ x: x - groundX, y: y - groundY });
  return out;
}

/**
 * The walk's route from one monster zone to another (screen points, whole pixels): a shortest path over the
 * board's cells (the monster rows, the free lane between them and one row beyond) that keeps the walker's
 * pixels off every other unit's pixels, then pulled straight wherever a straight line is as clean. Covering a
 * unit while walking IN FRONT of it costs four times more than passing behind one (a dark figure with gaps
 * over a lit body is the mush; a lit body in front of the shadow reads as depth). On an empty board it is the
 * straight line; on a crowded one it steps out into the free lane, walks along it and steps back in.
 */
export function planRoute(from: XY, to: XY, obstacles: readonly Obstacle[], mask: readonly XY[]): XY[] {
  const a = screenToIso(from.x, from.y);
  const b = screenToIso(to.x, to.y);
  const c0 = Math.max(0, LANE_COLS[0] - 1);
  const c1 = LANE_COLS[LANE_COLS.length - 1] + 1;
  const r0 = Math.max(0, Math.min(R(a.row), R(b.row)) - 1);
  const r1 = Math.min(BOARD_ROWS - 1, Math.max(R(a.row), R(b.row)) + 1);
  // the lanes between the two monster rows are the walk's home; the back rows and the side pads cost more
  const rIn0 = Math.min(R(a.row), R(b.row));
  const rIn1 = Math.max(R(a.row), R(b.row));
  const outside = (p: XY): number => {
    const g = screenToIso(p.x, p.y);
    return g.row < rIn0 - 0.3 || g.row > rIn1 + 0.3 || g.col < LANE_COLS[0] - 0.3 || g.col > LANE_COLS[LANE_COLS.length - 1] + 0.3 ? 0.6 : 0;
  };
  const area = Math.max(1, mask.length);
  let mx0 = 0;
  let mx1 = 0;
  let my0 = 0;
  for (const m of mask) {
    mx0 = Math.min(mx0, m.x);
    mx1 = Math.max(mx1, m.x);
    my0 = Math.min(my0, m.y);
  }
  const pen = (p: XY): number => {
    let s = 0;
    const px = R(p.x);
    const py = R(p.y);
    for (const o of obstacles) {
      if (px + mx1 < o.x0 || px + mx0 > o.x1 || py < o.y0 || py + my0 > o.y1) continue;
      let hits = 0;
      for (const m of mask) if (o.has(px + m.x, py + m.y)) hits++;
      s += (hits / area) * (py >= o.y ? 4 : 1);
    }
    return s;
  };
  const segCost = (p: XY, q: XY): number => {
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const ns = Math.max(2, Math.ceil(len / 6));
    let c = 0;
    for (let i = 1; i <= ns; i++) {
      const k = i / ns;
      const sp = { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
      c += (len / ns / 32) * (1 + outside(sp) + 6 * pen(sp));
    }
    return c;
  };
  const key = (c: number, r: number) => `${c},${r}`;
  const cellXY = (c: number, r: number): XY => {
    const p = isoToScreen(c, r);
    return { x: R(p.x), y: R(p.y) };
  };
  const start = { c: R(a.col), r: R(a.row) };
  const goal = { c: R(b.col), r: R(b.row) };
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const open: { c: number; r: number; d: number }[] = [{ ...start, d: 0 }];
  dist.set(key(start.c, start.r), 0);
  const posOf = (c: number, r: number): XY => (c === start.c && r === start.r ? from : c === goal.c && r === goal.r ? to : cellXY(c, r));
  while (open.length) {
    open.sort((x, y) => x.d - y.d);
    const cur = open.shift()!;
    const ck = key(cur.c, cur.r);
    if (cur.d > (dist.get(ck) ?? Infinity)) continue;
    if (cur.c === goal.c && cur.r === goal.r) break;
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue;
        const nc = cur.c + dc;
        const nr = cur.r + dr;
        if (nc < c0 || nc > c1 || nr < r0 || nr > r1) continue;
        const nd = cur.d + segCost(posOf(cur.c, cur.r), posOf(nc, nr));
        const nk = key(nc, nr);
        if (nd < (dist.get(nk) ?? Infinity)) {
          dist.set(nk, nd);
          prev.set(nk, ck);
          open.push({ c: nc, r: nr, d: nd });
        }
      }
  }
  const cells: XY[] = [];
  let k: string | undefined = key(goal.c, goal.r);
  if (!dist.has(k)) return [from, to];
  while (k) {
    const [c, r] = k.split(',').map(Number);
    cells.unshift(posOf(c, r));
    k = prev.get(k);
  }
  if (cells.length < 2) return [from, to];
  // pull it straight wherever the straight line costs no more than the cells it skips
  const out: XY[] = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    for (; j > i + 1; j--) {
      let via = 0;
      for (let m = i; m < j; m++) via += segCost(cells[m], cells[m + 1]);
      if (segCost(cells[i], cells[j]) <= via + 0.02) break;
    }
    out.push(cells[j]);
    i = j;
  }
  return out;
}

/** Total length of a polyline. */
export function routeLength(pts: readonly XY[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

/** The point at fraction k (0..1) of a polyline's length. */
export function along(pts: readonly XY[], k: number): XY {
  const total = routeLength(pts);
  let d = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 1;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

// ================================================================ floor pieces

/** A stepped floor ring (2:1 iso), whole pixels, palette steps (no dither). Resolves when gone. */
export function stepRing(sc: Phaser.Scene, at: XY, o: { r0: number; r1: number; ms: number; ramp: readonly number[]; depth?: number }): Promise<void> {
  const ras = Raster.around(sc, at.x, at.y, o.r1 * 2 + 6, o.r1 + 6, o.depth ?? DEPTH.TILE_FX + 2);
  return run(sc, o.ms, (t) => {
    const steps = 6;
    const k = Math.min(1, Math.floor(t * steps + 1) / steps);
    const r = o.r0 + (o.r1 - o.r0) * (1 - (1 - k) * (1 - k));
    const ci = Math.min(o.ramp.length - 1, Math.floor(t * o.ramp.length));
    ras.draw((g) => {
      if (t >= 1) return;
      g.ring(at.x, at.y, r, r / 2, o.ramp[ci]);
      if (ci + 1 < o.ramp.length && t < 0.6) g.ring(at.x, at.y, Math.max(1, r - 3), Math.max(0.5, r / 2 - 1.5), o.ramp[ci + 1]);
    });
  }).then(() => ras.destroy());
}

/** A flat ink ellipse (a floor shadow) at whole pixels. */
export function floorEllipse(r: Raster, at: XY, rx: number, ry: number, c: number): void {
  r.ell(R(at.x) + 0.5, R(at.y) + 0.5, rx, ry, c);
}
