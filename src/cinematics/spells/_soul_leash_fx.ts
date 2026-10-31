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
import { DEPTH } from '../../view/layout';
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
  crystal_wyrm: { x: 0.74, y: 0.27, rx: 4 },
  ember_wolf: { x: 0.8, y: 0.3, rx: 4 },
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
    rx = Math.max(5, Math.min(8, R((best[1] - best[0] + 1) / 2) + 1));
  }
  return { dx: nx - R(s.x), dy: ny - R(s.y), rx, ry: rx <= 5 ? 2 : 3, flip };
}

/** The world collar point for a neck measured on a sprite now at (x, y) facing `flip`. */
export function neckAt(n: Neck, x: number, y: number, flip: boolean): XY {
  return { x: R(x) + (flip === n.flip ? n.dx : -n.dx), y: R(y) + n.dy };
}

// ================================================================ the collar

export type BuckleState = 'none' | 'on' | 'flash' | 'open';

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
}

/** The two rasters of a collar round a neck (back arc behind the body, front arc in front). */
export class Collar {
  readonly back: Raster;
  readonly front: Raster;
  look: CollarLook = { prog: 0, buckle: 'none', fall: 0, glint: -1 };
  rx: number;
  ry: number;
  constructor(sc: Phaser.Scene, rx: number, ry: number) {
    this.rx = rx;
    this.ry = ry;
    this.back = new Raster(sc, 0, 0, 2 * rx + 8, 2 * ry + 10, DEPTH.UNIT);
    this.front = new Raster(sc, 0, 0, 2 * rx + 8, 2 * ry + 14, DEPTH.UNIT);
  }

  get alive(): boolean {
    return this.front.alive;
  }

  /** Draw round the neck point c (the band's centre) with the wearer's depth. */
  draw(c: XY, depth: number, visible = true): void {
    if (!this.front.alive) return;
    const { rx, ry } = this;
    this.back.moveTo(c.x - rx - 4, c.y - ry - 5);
    this.front.moveTo(c.x - rx - 4, c.y - ry - 5);
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
        const n = Math.max(32, R((rx + ry) * 8));
        const lim = (shown / steps) * n;
        const glintAt = L.glint >= 0 ? R(L.glint * n) : -99;
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
          if (frontSide) {
            // the break: the front pieces fall away (every other run of 4 drops a pixel more)
            const d = fall > 0 ? fall + ((i >> 2) % 2) : 0;
            // a 2-row leather band (lit void4 stitch row over void3) between two ink rows: it reads on any body
            f.px(x, y - 2 + d, PAL.ink);
            f.px(x, y + 1 + d, PAL.ink);
            f.px(x, y + d, g ? PAL.white : PAL.void3);
            f.px(x, y - 1 + d, g ? PAL.white : i % 3 === 0 ? PAL.gold3 : PAL.void4);
          } else if (fall <= 0) {
            b.px(x, y, PAL.void2);
            b.px(x, y - 1, PAL.void3);
            b.px(x, y - 2, PAL.ink);
          }
        }
        if (L.ghost) return;
        // studs: two gold rivets on the front of the band
        if (shown >= steps * 0.4) {
          const off = rx <= 4 ? 2 : 3;
          for (const sx of [-off, off]) {
            const x = c.x + sx;
            const y = R(c.y + ry * Math.sqrt(Math.max(0, 1 - (sx * sx) / (rx * rx)))) - 1 + (fall > 0 ? fall + 1 : 0);
            f.px(x, y, PAL.gold4);
          }
        }
        // the buckle: a 3×3 gold square ring at the front centre in an ink frame, the leash ring under it
        if (L.buckle !== 'none' && shown >= steps) {
          const bx = c.x - 1;
          const by = c.y + ry - 2 + (L.buckle === 'open' ? fall + 1 : 0);
          const flash = L.buckle === 'flash';
          for (let yy = -1; yy < 4; yy++) for (let xx = -1; xx < 4; xx++) f.px(bx + xx, by + yy, PAL.ink);
          for (let yy = 0; yy < 3; yy++)
            for (let xx = 0; xx < 3; xx++) {
              if (xx === 1 && yy === 1) f.px(bx + 1, by + 1, flash ? PAL.white : PAL.void0);
              else f.px(bx + xx, by + yy, flash ? PAL.white : yy === 0 || xx === 0 ? PAL.gold3 : PAL.gold2);
            }
          if (!flash) f.px(bx, by, PAL.gold4);
          if (L.buckle === 'open') f.px(bx + 3, by + 1, PAL.gold3);
          else {
            f.px(bx + 1, by + 3, flash ? PAL.white : PAL.gold3);
            f.px(bx + 1, by + 4, PAL.ink);
          }
        }
      });
    });
  }

  /** Where the leash hooks on (the ring under the buckle). */
  ring(c: XY): XY {
    return { x: c.x, y: c.y + this.ry + 1 };
  }

  destroy(): void {
    this.back.destroy();
    this.front.destroy();
  }
}

// ================================================================ the shadow double

const shadowTex = new Map<string, { key: string; L: number; T: number; W: number; H: number }>();
let shadowSeq = 0;

/** The monster's shadow as a standing figure (see the header). Anchor = the sprite position it was made from. */
export class ShadowDouble {
  readonly img: Phaser.GameObjects.Image;
  /** Offsets of the image's top-left from the anchor (unflipped). */
  private offL: number;
  private offT: number;
  private W: number;
  /** Turned round relative to the sprite it was made from. */
  turned = false;
  anchor: XY;
  constructor(sc: Phaser.Scene, s: Phaser.GameObjects.Sprite, sil: Silhouette) {
    const W = sil.right - sil.left + 2;
    const H = sil.bottom - sil.top + 2;
    const key = `leash:shadow:${++shadowSeq}`;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(W, H);
    const put = (x: number, y: number, c: number) => {
      const i = (y * W + x) * 4;
      img.data[i] = (c >> 16) & 255;
      img.data[i + 1] = (c >> 8) & 255;
      img.data[i + 2] = c & 255;
      img.data[i + 3] = 255;
    };
    for (let y = 0; y < H - 2; y++)
      for (let x = 0; x < W - 2; x++) {
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
        put(x + 1, y + 1, c);
      }
    g.putImageData(img, 0, 0);
    sc.textures.addCanvas(key, cv);
    shadowTex.set(key, { key, L: sil.left - 1, T: sil.top - 1, W, H });
    sc.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sc.textures.exists(key) && sc.textures.remove(key));
    this.anchor = { x: R(s.x), y: R(s.y) };
    this.offL = sil.left - 1 - this.anchor.x;
    this.offT = sil.top - 1 - this.anchor.y;
    this.W = W;
    this.img = sc.add.image(0, 0, key).setOrigin(0, 0).setDepth(s.depth + 0.1);
    this.place();
  }

  /** Move the anchor (the sprite-position equivalent) and redraw at whole pixels. */
  place(at: XY = this.anchor): void {
    this.anchor = { x: R(at.x), y: R(at.y) };
    const x = this.turned ? this.anchor.x - (this.offL + this.W) : this.anchor.x + this.offL;
    this.img.setFlipX(this.turned).setPosition(x, this.anchor.y + this.offT);
  }

  destroy(): void {
    const key = this.img.texture.key;
    const sc = this.img.scene;
    this.img.destroy();
    if (sc?.textures?.exists(key)) sc.textures.remove(key);
    shadowTex.delete(key);
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
  /** Cut: the part from `cutFrom` on is gone (0..1, the snap), the rest hangs and drops `drop` px. */
  cutFrom?: number;
  drop?: number;
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

/** Draw the leash (see LeashLook) into a raster. */
export function drawLeash(r: Raster, a: XY, b: XY, L: LeashLook): void {
  const pts = leashPath(a, b, L.sag);
  const n = pts.length;
  const end = Math.floor(n * Math.max(0, Math.min(1, L.prog)));
  const pulseAt = L.pulse >= 0 ? R(L.pulse * (n - 1)) : -99;
  const cut = L.cutFrom !== undefined ? Math.floor(n * L.cutFrom) : n;
  const bead = L.mode === 'bond' ? Math.floor(L.phase / 70) % 18 : -1;
  for (let i = 0; i < end; i++) {
    if (i >= cut) break;
    const p = pts[i];
    // the cut piece hangs from the card end: it drops more the farther it is from the card
    const dy = L.drop && L.drop > 0 ? R((L.drop * i) / Math.max(1, cut)) : 0;
    let c: number;
    if (L.mode === 'chain') {
      // links: two lit, one dark, one gold — a dark underline so it reads over the floor and the bodies
      const k = i % 4;
      c = k === 3 ? PAL.gold3 : k === 2 ? PAL.void3 : L.hot ? PAL.white : PAL.void4;
      r.px(p.x, p.y + dy + 1, PAL.ink);
    } else {
      c = i % 3 === 0 ? (L.hot ? PAL.white : PAL.void4) : L.hot ? PAL.void4 : PAL.void3;
      if (bead >= 0 && i % 18 === bead) c = PAL.gold4;
    }
    const d = Math.abs(i - pulseAt);
    if (d === 0) c = PAL.white;
    else if (d <= 2) c = L.pulseColor ?? PAL.gold4;
    else if (d <= 4 && L.pulseColor) c = L.pulseColor === PAL.leaf4 ? PAL.leaf3 : PAL.gold3;
    r.px(p.x, p.y + dy, c);
  }
  // the leading tip while it flies: a gold ring
  if (end < n && end > 0 && L.prog < 1) {
    const p = pts[Math.max(0, end - 1)];
    r.px(p.x, p.y, PAL.white);
    r.px(p.x - 1, p.y, PAL.gold3);
    r.px(p.x + 1, p.y, PAL.gold3);
    r.px(p.x, p.y - 1, PAL.gold3);
    r.px(p.x, p.y + 1, PAL.gold3);
  }
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
