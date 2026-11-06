// Hınç Baltası (spite_axe) — how a wielder TAKES HOLD of the axe (v3 look only; lane E).
//   HAND_ANCHORS  authored hand points per monster (frame px of its idle:0 drawing, facing right): the FRONT hand
//                 (toward its facing) and the BACK hand (a jaw, a claw, a tail where it has no hand). A monster
//                 missing here uses its art's points() (hand / grip / claw) and, failing that, a body-edge heuristic.
//   BodyDouble    a crisp pixel copy of the wielder's idle:0 frame that can CROUCH (rows removed at the knee: the
//                 upper body sinks whole pixels) and LEAN (rows above the waist shifted in a stepped shear toward or
//                 away from the haft) — whole pixels, never a scaled / rotated sprite (the v3 rule: a monster sprite
//                 is never squashed). The real sprite is cropped to nothing while the double stands in (its shadow,
//                 depth and bookkeeping stay); `map()` takes any point of the undeformed frame to where it is drawn
//                 now, so the grip, the vein and the eyes stay ON the body.

import type Phaser from 'phaser';
import { frameRGBA } from '../../art/atlas';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { XY } from '../../view/layout';
import { Raster } from '../../vfx/setpieces';

/** [front, back] hand anchors, idle:0 frame px (facing right). */
export const HAND_ANCHORS: Readonly<Record<string, readonly [readonly [number, number], readonly [number, number]]>> = {
  tide_golem: [
    [53, 43],
    [8, 46],
  ],
  // the wolf takes the haft in its jaws (front) or its tail's root (back)
  ember_wolf: [
    [54, 26],
    [9, 30],
  ],
  // the wyrm: its fore-claw (front), its tail spike (back)
  crystal_wyrm: [
    [79, 63],
    [22, 76],
  ],
  abyss_magus: [
    [65, 57],
    [36, 50],
  ],
  stone_sentinel: [
    [57, 54],
    [13, 56],
  ],
  shade_assassin: [
    [39, 39],
    [16, 40],
  ],
  magma_titan: [
    [65, 58],
    [15, 58],
  ],
};

interface FrameData {
  W: number;
  H: number;
  data: Uint8ClampedArray;
  top: number;
  bottom: number;
}

const DATA = new Map<string, FrameData | null>();

function frameData(s: Phaser.GameObjects.Sprite, name: string): FrameData | null {
  const key = `${s.texture.key}|${name}`;
  if (DATA.has(key)) return DATA.get(key) ?? null;
  const d = readFrame(s, name);
  if (DATA.size > 60) DATA.clear();
  DATA.set(key, d);
  return d;
}

function readFrame(s: Phaser.GameObjects.Sprite, name: string): FrameData | null {
  try {
    const fr = s.texture.get(name);
    if (!fr || fr.name !== name) return null;
    const data = frameRGBA(fr);
    if (!data) return null;
    const W = fr.realWidth;
    const H = fr.realHeight;
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (data[(y * W + x) * 4 + 3] > 0) {
          if (top < 0) top = y;
          bottom = y;
          break;
        }
    if (top < 0) return null;
    return { W, H, data, top, bottom };
  } catch {
    return null;
  }
}

const opaque = (f: FrameData, x: number, y: number): boolean => x >= 0 && y >= 0 && x < f.W && y < f.H && f.data[(y * f.W + x) * 4 + 3] > 0;

/** The monster id of a unit ('mon:<id>…' textures), or ''. */
function idOf(s: Phaser.GameObjects.Sprite): string {
  const m = /^mon:([a-z_0-9]+)/.exec(s.texture?.key ?? '');
  return m ? m[1] : '';
}

/**
 * The hand a wielder grips with on WORLD side `side` (+1 right / −1 left), in idle:0 frame px (facing right): the
 * authored anchor, else the art's points(), else the body's outermost pixel on that side at 55 % of its height, 2 px in.
 */
export function handAnchor(u: MonsterUnit, side: number): XY {
  const s = u.sprite;
  const frameSide = side * (s.flipX ? -1 : 1);
  const a = HAND_ANCHORS[idOf(s)] ?? HAND_ANCHORS[u.cardId as string];
  if (a) {
    const p = frameSide > 0 ? a[0] : a[1];
    return { x: p[0], y: p[1] };
  }
  const f = frameData(s, 'idle:0');
  let y = f ? Math.round(f.top + (f.bottom - f.top) * 0.55) : 30;
  if (frameSide > 0) {
    try {
      const pts = u.art.points?.('idle', 0);
      const p = pts?.hand ?? pts?.grip ?? pts?.claw;
      if (p) return { x: Math.round(p.x), y: Math.round(p.y) };
    } catch {
      /* no points */
    }
  }
  if (!f) return { x: frameSide > 0 ? 40 : 10, y };
  y = Math.max(f.top, Math.min(f.bottom, y));
  let edge = -1;
  if (frameSide > 0) {
    for (let x = f.W - 1; x >= 0; x--) if (opaque(f, x, y)) {
      edge = x - 2;
      break;
    }
  } else
    for (let x = 0; x < f.W; x++)
      if (opaque(f, x, y)) {
        edge = x + 2;
        break;
      }
  return { x: edge >= 0 ? edge : Math.round(f.W / 2), y };
}

/** The sprite's colours at a frame point (the hand's own tones, for the fingers drawn over the haft). */
export function handTones(u: MonsterUnit, fp: XY): { fill: number; shade: number } {
  const f = frameData(u.sprite, 'idle:0');
  const rgb = (x: number, y: number): number | null => {
    if (!f || !opaque(f, x, y)) return null;
    const i = (y * f.W + x) * 4;
    return (f.data[i] << 16) | (f.data[i + 1] << 8) | f.data[i + 2];
  };
  const lum = (c: number): number => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
  const cs: number[] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const c = rgb(fp.x + dx, fp.y + dy);
    if (c !== null && lum(c) > 28) cs.push(c);
  }
  if (!cs.length) return { fill: 0x5a5a6e, shade: 0x2e2e3a };
  // the most common bright-enough tone is the fill; the darkest one the shade
  const count = new Map<number, number>();
  for (const c of cs) count.set(c, (count.get(c) ?? 0) + 1);
  const fill = [...count.entries()].sort((a, b) => b[1] - a[1] || lum(b[0]) - lum(a[0]))[0][0];
  const shade = cs.reduce((a, c) => (lum(c) < lum(a) ? c : a), fill);
  return { fill, shade: shade === fill ? cs.reduce((a, c) => (lum(c) < lum(a) && c !== fill ? c : a), fill) : shade };
}

/**
 * A crisp crouch / lean double of the wielder (see the header). `set(ox, oy, crouch, lean)`: ox / oy the body's world
 * offset from its rest position, crouch the rows (0–3) the upper body sinks at the knee, lean the px (signed, world x)
 * the head moves sideways (the shear grows stepwise from the waist up).
 */
export class BodyDouble {
  private readonly sc: Phaser.Scene;
  private readonly s: Phaser.GameObjects.Sprite;
  private readonly f: FrameData | null;
  private readonly ras: Raster;
  private readonly rest: XY;
  private readonly knee: number;
  private readonly waist: number;
  private p = { ox: 0, oy: 0, crouch: 0, lean: 0 };
  private key = '';
  private dead = false;

  constructor(sc: Phaser.Scene, u: MonsterUnit, rest: XY) {
    this.sc = sc;
    this.s = u.sprite;
    this.rest = { ...rest };
    u.pose('idle', 0);
    this.f = frameData(this.s, 'idle:0');
    const h = this.f ? this.f.bottom - this.f.top : 40;
    this.knee = this.f ? Math.round(this.f.bottom - h * 0.3) : 0;
    this.waist = this.f ? Math.round(this.f.top + h * 0.6) : 0;
    this.ras = new Raster(sc, 0, 0, 640, 360, this.s.depth);
    if (this.f) this.s.setCrop(0, 0, 0, 0);
    this.draw();
  }

  get ok(): boolean {
    return !!this.f;
  }

  /** Frame px of the double's body (top / bottom rows) for callers that place things against it. */
  get rows(): { top: number; bottom: number } {
    return { top: this.f?.top ?? 0, bottom: this.f?.bottom ?? 0 };
  }

  set(ox: number, oy: number, crouch: number, lean: number): void {
    this.p = { ox: Math.round(ox), oy: Math.round(oy), crouch: Math.max(0, Math.round(crouch)), lean: Math.round(lean) };
    this.draw();
  }

  get params(): { ox: number; oy: number; crouch: number; lean: number } {
    return { ...this.p };
  }

  /** Row shift (down) and column shift (sideways) of frame row fy under params q (default: now). */
  private shift(fy: number, q = this.p): { dx: number; dy: number } {
    const { crouch, lean } = q;
    const dy = fy < this.knee ? crouch : 0;
    let dx = 0;
    if (this.f && lean !== 0 && fy < this.waist) {
      const span = Math.max(1, this.waist - this.f.top);
      dx = Math.round((lean * Math.min(1, (this.waist - fy) / span)));
    }
    return { dx, dy };
  }

  /** World pixel where frame pixel (fx, fy) of idle:0 is drawn now (or under params q). */
  map(fx: number, fy: number, q: { ox: number; oy: number; crouch: number; lean: number } = this.p): XY {
    const s = this.s;
    const W = this.f?.W ?? s.frame.realWidth;
    const left = Math.round(this.rest.x - s.displayOriginX) + Math.round(q.ox);
    const top = Math.round(this.rest.y - s.displayOriginY) + Math.round(q.oy);
    const sh = this.shift(fy, { ...q, crouch: Math.round(q.crouch), lean: Math.round(q.lean) });
    return { x: left + (s.flipX ? W - 1 - fx : fx) + sh.dx, y: top + fy + sh.dy };
  }

  /** A world point of the UNDEFORMED body at the current offset → where it is drawn now. */
  warp(p: XY): XY {
    const s = this.s;
    const top = Math.round(this.rest.y - s.displayOriginY) + this.p.oy;
    const sh = this.shift(Math.round(p.y) - top);
    return { x: Math.round(p.x) + sh.dx, y: Math.round(p.y) + sh.dy };
  }

  private draw(): void {
    if (this.dead || !this.f) return;
    const key = `${this.p.ox}|${this.p.oy}|${this.p.crouch}|${this.p.lean}|${this.s.depth}`;
    if (key === this.key) return;
    this.key = key;
    if (this.ras.img.depth !== this.s.depth) this.ras.img.setDepth(this.s.depth);
    // keep the real sprite where the double stands (its shadow and anything tied to its position follow)
    this.s.setPosition(this.rest.x + this.p.ox, this.rest.y + this.p.oy);
    const f = this.f;
    const r = this.ras;
    r.begin();
    for (let fy = f.top; fy <= f.bottom; fy++) {
      // the crouch: the `crouch` rows just above the knee are folded away (the upper body sinks onto them)
      if (fy < this.knee && fy >= this.knee - this.p.crouch) continue;
      for (let fx = 0; fx < f.W; fx++) {
        const i = (fy * f.W + fx) * 4;
        if (f.data[i + 3] === 0) continue;
        const q = this.map(fx, fy);
        r.px(q.x, q.y, (f.data[i] << 16) | (f.data[i + 1] << 8) | f.data[i + 2]);
      }
    }
    r.end();
  }

  /** The real sprite back (uncropped, at rest + offset), the double gone. */
  destroy(o: { keepOffset?: boolean } = {}): void {
    if (this.dead) return;
    this.dead = true;
    this.ras.destroy();
    if (this.s.active) {
      this.s.setCrop();
      if (!o.keepOffset) this.s.setPosition(this.rest.x, this.rest.y);
    }
  }
}

