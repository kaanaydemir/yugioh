// Art Lab actors: one sheet texture + one Phaser Image per monster. The pose is a pure function
// of action time (track → anim → frame from the per-frame holds). Integer positions only; the
// wizard is drawn facing right and shown mirrored (we place the mirrored frame ourselves so the
// anchor column stays on the slot pixel in both directions).
//
// Each actor also owns two layers that follow its pose (both baked once, integer-placed, never
// scaled; only frame swaps and alpha change):
//  - a CONTACT SHADOW on the floor (always on, it is part of the scene, not an effect): a flat
//    2:1-ish ellipse in two flat alpha bands, in the variant's shadow ink, under the footprint of
//    the idle pose, plus a 1-px darker occlusion line right under every column of the current
//    frame that touches the ground. Lifted poses (summon float, victory hop) swap to smaller baked
//    ellipses and fade; the erosion of the death fades it with the body's remaining mass. A
//    floating art (hover > 0) casts it on the FLOOR, `hover` px below its idle pose, lifted by
//    that much (smaller, fainter, no occlusion line) until a pose comes down to the floor.
//  - EMISSIVE HALOS (part of the light layer: hidden by the effects toggle): small baked additive
//    glows on the pixels that glow in the drawing itself (the wizard's orb and eyes, the dragon's
//    crystal wings). Their position and strength are measured per frame from the emissive pixels
//    near the frame's points, so a closed eye, a dropped orb or an eroding body dims them on its
//    own; idle frames add a gentle pulse.

import Phaser from 'phaser';
import { PixelCanvas } from '../../art/pixel';
import { sheetTexture } from '../../art/textures';
import { LAB_DEPTH, type LabAnim, type LabFramePoints, type LabFxSettings, type LabMonsterArt, type XY } from '../types';
import { frameAt } from './anim';
import type { ActorGeo, ActorId, ActorTrack } from './battle';
import type { FxTextures, GlowR } from './fx-textures';

/**
 * Optional extras a variant's LabFxSettings object may carry (read defensively; the shared
 * contract in types.ts is untouched).
 */
export interface LabFxExtra {
  /** Contact-shadow ink (default: the darkest colour of the effect ramps). */
  shadow?: number;
}

/** Contact shadow: baked ellipse sizes (fractions of the full footprint) and band alphas. */
const SHADOW_STEPS = [1, 0.84, 0.68, 0.52];
const SHADOW_A_OUT = 0.3;
const SHADOW_A_IN = 0.42;
/** The occlusion line right under the touching columns (drawn over the ellipse). */
const SHADOW_A_LINE = 0.34;
/** Lift (px) at which the shadow reaches its faintest. */
const SHADOW_LIFT_MAX = 22;

/**
 * The 2× inspection window around a focus point f (camera.ts: zoom 2 shows 320×180 world px):
 * world columns f.x − 160 … f.x + 159 and rows f.y − 90 … f.y + 89; the control bar
 * (controls.ts, screen rows 343…359) covers the rows from f.y + 81 down, so the last row that is
 * fully clear is f.y + 80. Values are the reach from f to the first / last visible pixel.
 */
const ZOOM_VIEW = { left: 160, right: 159, top: 90, bottom: 80 };
/** World px kept clear between the widest pose and the edges of the inspection window. */
const ZOOM_MARGIN = 2;

interface FrameInfo {
  /** Lowest opaque row (frame px), -1 when the frame is empty. */
  bottom: number;
  /** Opaque pixel count. */
  mass: number;
  /** Runs [x0, x1, x0, x1, ...] (frame px) of columns with a pixel within 1 px of the ground row. */
  runs: number[];
}

interface HaloSpec {
  name: string;
  glow: GlowR;
  color: number;
  alpha: number;
  /** Emissive colours searched for. */
  colors: ReadonlySet<number>;
  /** Frame point the search is centred on (null: centroid of all emissive pixels in the frame). */
  point: ((pts: LabFramePoints) => XY | undefined) | null;
  /** Search box half-size around the point (px). */
  rx: number;
  ry: number;
}

interface Halo {
  spec: HaloSpec;
  img: Phaser.GameObjects.Image;
  /** frame key → emissive centroid (frame px) and strength (1 = typical idle), or null. */
  at: Map<string, { x: number; y: number; k: number } | null>;
}

export interface Pose {
  anim: string;
  frame: number;
}

export class LabActor implements ActorGeo {
  readonly key: string;
  readonly image: Phaser.GameObjects.Image;
  /** Frame canvases, `${anim}:${frame}` → pixels (used by the dissolve and hop analysis). */
  readonly frames = new Map<string, PixelCanvas>();
  track: ActorTrack = { entries: [] };
  /** Fixed pose (stage=static / &pose=...) instead of the track. */
  fixed: Pose | null = null;
  /** Loop the idle forever (stage=idle). */
  idleOnly = false;
  private readonly art: LabMonsterArt;
  private readonly anims: string[];
  private readonly info = new Map<string, FrameInfo>();
  /** Ground row of the idle pose (frame px) and the shadow's footprint centre / radii. */
  private readonly ground: number;
  /**
   * Floor row (frame px): the idle ground plus the art's hover. A walker's (hover 0) is its idle
   * ground; a floating body's shadow lies on the floor `hover` px below the idle pose's lowest row.
   */
  private readonly floor: number;
  private readonly idleMass: number;
  private readonly shadowCx: number;
  private readonly shadowKey: string;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly contact: Phaser.GameObjects.Graphics;
  private readonly shadowColor: number;
  private halos: Halo[] = [];
  private fxOn = true;

  constructor(
    private readonly scene: Phaser.Scene,
    prefix: string,
    readonly id: ActorId,
    art: LabMonsterArt,
    readonly slot: XY,
    readonly flip: boolean,
    fx?: LabFxSettings,
  ) {
    this.art = art;
    this.anims = Object.keys(art.anims);
    this.key = `${prefix}${art.id}`;
    const list: [string, PixelCanvas][] = [];
    for (const anim of this.anims) {
      const n = art.anims[anim].durations.length;
      for (let f = 0; f < n; f++) {
        const pc = new PixelCanvas(art.w, art.h);
        (art.draw as (p: PixelCanvas, a: string, f: number) => void)(pc, anim, f);
        this.frames.set(`${anim}:${f}`, pc);
        list.push([`${anim}:${f}`, pc]);
      }
    }
    sheetTexture(scene, this.key, art.w, art.h, list);
    this.image = scene.add
      .image(this.left, this.top, this.key, `idle:0`)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setVisible(false)
      .setDepth(LAB_DEPTH.ACTORS + Math.max(0, Math.min(9, Math.floor(slot.y / 40))));

    // ---- contact shadow: footprint of the idle pose
    const idle = this.frames.get('idle:0');
    const ib = idle?.bounds();
    this.ground = ib ? ib.y + ib.h - 1 : art.anchorY;
    this.floor = this.ground + Math.max(0, Math.round(art.hover));
    this.idleMass = Math.max(1, idle ? countOpaque(idle) : 1);
    for (const [k, pc] of this.frames) this.info.set(k, frameInfo(pc, this.floor));
    // columns with a pixel in the bottom 4 rows of the idle pose; the ellipse spans them from the
    // 12th percentile (a thin tail tip lying on the floor gets only the occlusion line)
    const cols: number[] = [];
    if (idle) for (let x = 0; x < art.w; x++) for (let y = this.ground - 3; y <= this.ground; y++) if (idle.isOpaque(x, y)) {
      cols.push(x);
      break;
    }
    const x0 = cols.length ? cols[Math.floor(cols.length * 0.12)] : art.anchorX - 16;
    const x1 = cols.length ? cols[cols.length - 1] : art.anchorX + 16;
    this.shadowCx = Math.round((x0 + x1) / 2);
    const rx = Math.max(10, Math.round((x1 - x0) / 2) + 3);
    const ry = Math.max(4, Math.min(7, Math.round(rx / 5.5)));
    const extra = (fx: LabFxSettings | undefined) => (fx as (LabFxSettings & LabFxExtra) | undefined)?.shadow;
    this.shadowColor = extra(fx) ?? darkest(fx);
    this.shadowKey = `${this.key}:shadow`;
    sheetTexture(
      scene,
      this.shadowKey,
      2 * rx + 1,
      2 * ry + 1,
      SHADOW_STEPS.map((k, i) => [String(i), shadowCanvas(rx, ry, Math.max(6, Math.round(rx * k)), Math.max(2, Math.round(ry * k)), this.shadowColor)]),
    );
    this.shadow = scene.add.image(0, 0, this.shadowKey, '0').setOrigin(0, 0).setDepth(LAB_DEPTH.FLOOR_FX - 2).setVisible(false);
    this.contact = scene.add.graphics().setDepth(LAB_DEPTH.FLOOR_FX - 1);
  }

  /**
   * Emissive halos (call once the effect textures exist). Roles: the wizard's orb (muzzle) and
   * eyes in the magic light, the dragon's crystal wings in the crystal light.
   */
  attachHalos(tex: FxTextures, fx: LabFxSettings): void {
    for (const h of this.halos) h.img.destroy();
    this.halos = [];
    const light = (r: readonly number[], n: number) => new Set(r.slice(Math.max(0, r.length - n)));
    const specs: HaloSpec[] =
      this.id === 'wizard'
        ? [
            { name: 'orb', glow: 12, color: fx.lightMagic, alpha: 0.35, colors: light(fx.magic, 3), point: (p) => p.orb ?? p.muzzle, rx: 5, ry: 5 },
            { name: 'eyes', glow: 5, color: fx.lightMagic, alpha: 0.25, colors: light(fx.magic, 3), point: (p) => p.eyes ?? p.eye, rx: 6, ry: 4 },
          ]
        : [{ name: 'wing', glow: 16, color: fx.lightCrystal, alpha: 0.12, colors: new Set(fx.crystal), point: null, rx: 0, ry: 0 }];
    for (const spec of specs) {
      const at = new Map<string, { x: number; y: number; k: number } | null>();
      const raw = new Map<string, { x: number; y: number; n: number } | null>();
      for (const [k, pc] of this.frames) {
        const [anim, f] = k.split(':');
        const pts = this.framePoints(anim, Number(f));
        const c = spec.point ? spec.point(pts) : null;
        if (spec.point && !c) {
          raw.set(k, null);
          continue;
        }
        raw.set(k, emissive(pc, spec.colors, c ? { x: Math.round(c.x), y: Math.round(c.y), rx: spec.rx, ry: spec.ry } : null));
      }
      // strength 1 = the median idle frame
      const idleN = [...raw.entries()].filter(([k]) => k.startsWith('idle:')).map(([, v]) => v?.n ?? 0).sort((p, q) => p - q);
      const ref = idleN.length ? idleN[idleN.length >> 1] : 0;
      if (ref < 3) continue;
      for (const [k, v] of raw) at.set(k, v && v.n > 0 ? { x: v.x, y: v.y, k: Math.min(1.25, v.n / ref) } : null);
      const img = this.scene.add
        .image(0, 0, tex.glow[spec.glow].key, '0')
        .setOrigin(0, 0)
        .setDepth(LAB_DEPTH.LIGHT)
        .setTint(spec.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
      this.halos.push({ spec, img, at });
    }
  }

  /** Effects toggle: the halos belong to the light layer (the contact shadow stays). */
  setFx(on: boolean): void {
    this.fxOn = on;
    if (!on) for (const h of this.halos) h.img.setVisible(false);
  }

  /** Halos currently shown (stats). */
  get visibleHalos(): number {
    return this.halos.reduce((n, h) => n + (h.img.visible ? 1 : 0), 0);
  }

  get w(): number {
    return this.art.w;
  }
  get h(): number {
    return this.art.h;
  }
  get anchorX(): number {
    return this.art.anchorX;
  }
  get anchorY(): number {
    return this.art.anchorY;
  }

  /** Top-left of the image in world pixels (integer). */
  get left(): number {
    return this.flip ? this.slot.x - this.art.w + 1 + this.art.anchorX : this.slot.x - this.art.anchorX;
  }
  get top(): number {
    return this.slot.y - this.art.hover - this.art.anchorY;
  }

  /** Frame pixel → world pixel (mirrors for the flipped actor). */
  toWorld(p: XY): XY {
    return { x: this.flip ? this.left + (this.art.w - 1 - p.x) : this.left + p.x, y: this.top + p.y };
  }

  /** World pixel → frame pixel (inverse of toWorld; rounds to the pixel). */
  toFrame(p: XY): XY {
    const x = Math.round(p.x) - this.left;
    return { x: this.flip ? this.art.w - 1 - x : x, y: Math.round(p.y) - this.top };
  }

  /** ActorGeo: is the world pixel `p` covered by the drawing of (anim, frame)? */
  opaque(anim: string, frame: number, p: XY): boolean {
    const pc = this.canvas(anim, frame);
    if (!pc) return false;
    const q = this.toFrame(p);
    return pc.isOpaque(q.x, q.y);
  }

  /** Timing spec of one of the art's animations. */
  spec(anim: string): LabAnim {
    return this.art.anims[anim];
  }

  canvas(anim: string, frame: number): PixelCanvas | undefined {
    return this.frames.get(`${anim}:${frame}`);
  }

  framePoints(anim: string, frame: number): LabFramePoints {
    return (this.art.points as (a: string, f: number) => LabFramePoints)(anim, frame);
  }

  /** ActorGeo: world point of a frame (muzzle falls back to core). */
  point(anim: string, frame: number, name: 'core' | 'muzzle'): XY {
    const pts = this.framePoints(anim, frame);
    return this.toWorld((name === 'muzzle' ? pts.muzzle : undefined) ?? pts.core);
  }

  /** ActorGeo: an optional extra frame point (world px), if the art defines it. */
  named(anim: string, frame: number, name: string): XY | undefined {
    const q = this.framePoints(anim, frame)[name];
    return q ? this.toWorld(q) : undefined;
  }

  /** Pose at action time `a` (null = hidden). */
  poseAt(a: number): Pose | null {
    if (this.fixed) return this.fixed;
    if (this.idleOnly) return { anim: 'idle', frame: frameAt(this.art.anims.idle, a) };
    const es = this.track.entries;
    if (!es.length || a < es[0].at) return null;
    if (this.track.hideAt !== undefined && a >= this.track.hideAt) return null;
    let e = es[0];
    for (let i = 1; i < es.length && es[i].at <= a; i++) e = es[i];
    return { anim: e.anim, frame: frameAt(this.art.anims[e.anim], a - e.at) };
  }

  /** World point at action time (null while hidden). */
  pointAt(a: number, name: 'core' | 'muzzle'): XY | null {
    const p = this.poseAt(a);
    return p ? this.point(p.anim, p.frame, name) : null;
  }

  /** Last visible pose at or before `a` (falls back to the first entry). */
  lastPointAt(a: number, name: 'core' | 'muzzle'): XY {
    const p = this.pointAt(a, name);
    if (p) return p;
    const hide = this.track.hideAt;
    if (hide !== undefined && a >= hide) {
      const q = this.pointAt(hide - 1, name);
      if (q) return q;
    }
    return this.point('idle', 0, name);
  }

  render(a: number): void {
    const p = this.poseAt(a);
    if (!p) {
      this.image.setVisible(false);
      this.shadow.setVisible(false);
      this.contact.clear();
      for (const h of this.halos) h.img.setVisible(false);
      return;
    }
    const key = `${p.anim}:${p.frame}`;
    this.image.setVisible(true).setFrame(key).setPosition(this.left, this.top);
    this.renderShadow(key);
    this.renderHalos(key, p);
  }

  private renderShadow(key: string): void {
    const inf = this.info.get(key);
    this.contact.clear();
    if (!inf || inf.bottom < 0) return void this.shadow.setVisible(false);
    const lift = Math.max(0, this.floor - inf.bottom);
    const size = lift <= 1 ? 0 : lift <= 4 ? 1 : lift <= 9 ? 2 : 3;
    const liftK = 1 - 0.6 * Math.min(1, lift / SHADOW_LIFT_MAX);
    const massK = Math.min(1, inf.mass / this.idleMass / 0.6);
    const alpha = Math.round(liftK * massK * 100) / 100;
    if (alpha < 0.03) return void this.shadow.setVisible(false);
    const c = this.toWorld({ x: this.shadowCx, y: this.floor });
    const fw = this.shadow.width;
    const fh = this.shadow.height;
    this.shadow
      .setFrame(String(size))
      .setPosition(c.x - (fw >> 1), c.y - (fh >> 1))
      .setAlpha(alpha)
      .setVisible(true);
    // occlusion line under the touching columns (only when standing on the floor)
    if (lift > 1 || !inf.runs.length) return;
    this.contact.fillStyle(this.shadowColor, SHADOW_A_LINE * massK);
    const y = this.top + this.floor + 1;
    for (let i = 0; i < inf.runs.length; i += 2) {
      const p0 = this.toWorld({ x: inf.runs[i], y: 0 }).x;
      const p1 = this.toWorld({ x: inf.runs[i + 1], y: 0 }).x;
      this.contact.fillRect(Math.min(p0, p1), y, Math.abs(p1 - p0) + 1, 1);
    }
  }

  private renderHalos(key: string, p: Pose): void {
    if (!this.halos.length) return;
    // gentle pulse over the idle cycle (brightest mid-cycle), on top of what the drawing does
    let pulse = 1;
    if (p.anim === 'idle') {
      const n = this.art.anims.idle.durations.length;
      pulse = 0.84 + 0.16 * (0.5 - 0.5 * Math.cos((2 * Math.PI * p.frame) / Math.max(1, n)));
    }
    for (const h of this.halos) {
      const e = this.fxOn ? h.at.get(key) : null;
      if (!e) {
        h.img.setVisible(false);
        continue;
      }
      const w = this.toWorld(e);
      const a = Math.round(h.spec.alpha * e.k * pulse * 100) / 100;
      h.img
        .setPosition(w.x - (h.img.width >> 1), w.y - (h.img.height >> 1))
        .setAlpha(a)
        .setVisible(a > 0.01);
    }
  }

  /**
   * Inspection zoom target (world px): the visual centre of the idle pose, moved only as far as
   * needed for the union of EVERY baked frame to fit the 2× window with ZOOM_MARGIN to spare, so
   * a pose that reaches higher, lower or wider than the idle pose (the B dragon's victory
   * rear-up) is never cut by the zoom. Per axis: when the union cannot fit, the idle centre stays.
   * Poses that already fit around the idle centre (all of A's) leave the focus untouched.
   */
  focus(): XY {
    const pc = this.canvas('idle', 0);
    const b = pc?.bounds();
    if (!b) return this.toWorld(this.framePoints('idle', 0).core);
    const c = this.toWorld({ x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) });
    const u = this.reach();
    if (!u) return c;
    return {
      x: fitAxis(c.x, u.x0, u.x1, ZOOM_VIEW.left, ZOOM_VIEW.right),
      y: fitAxis(c.y, u.y0, u.y1, ZOOM_VIEW.top, ZOOM_VIEW.bottom),
    };
  }

  /** World-pixel box covering the opaque pixels of every baked frame (null: all empty). */
  private reach(): { x0: number; y0: number; x1: number; y1: number } | null {
    let fx0 = Infinity;
    let fy0 = Infinity;
    let fx1 = -Infinity;
    let fy1 = -Infinity;
    for (const pc of this.frames.values()) {
      const b = pc.bounds();
      if (!b) continue;
      fx0 = Math.min(fx0, b.x);
      fy0 = Math.min(fy0, b.y);
      fx1 = Math.max(fx1, b.x + b.w - 1);
      fy1 = Math.max(fy1, b.y + b.h - 1);
    }
    if (fx1 < fx0) return null;
    const p = this.toWorld({ x: fx0, y: fy0 });
    const q = this.toWorld({ x: fx1, y: fy1 });
    return { x0: Math.min(p.x, q.x), y0: p.y, x1: Math.max(p.x, q.x), y1: q.y };
  }

  /**
   * Offset (ms from the anim start) of a hop landing in a one-shot anim: marks.land when the art
   * defines it, else the first frame whose lowest pixel returns to the ground after being ≥3 px up.
   */
  hopLanding(anim: string): number | null {
    const spec = this.art.anims[anim];
    if (!spec) return null;
    const mark = spec.marks?.land;
    let landing = -1;
    if (mark !== undefined) landing = mark;
    else {
      const ib = this.canvas('idle', 0)?.bounds();
      const ground = ib ? ib.y + ib.h - 1 : this.art.anchorY;
      let up = false;
      for (let f = 0; f < spec.durations.length; f++) {
        const b = this.canvas(anim, f)?.bounds();
        if (!b) continue;
        const bottom = b.y + b.h - 1;
        if (bottom <= ground - 3) up = true;
        else if (up && bottom >= ground - 1) {
          landing = f;
          break;
        }
      }
    }
    if (landing < 0) return null;
    let s = 0;
    for (let i = 0; i < landing; i++) s += Math.max(1, spec.durations[i]);
    return s;
  }

  destroy(): void {
    this.image.destroy();
    this.shadow.destroy();
    this.contact.destroy();
    for (const h of this.halos) h.img.destroy();
    this.halos = [];
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
    if (this.scene.textures.exists(this.shadowKey)) this.scene.textures.remove(this.shadowKey);
    this.frames.clear();
    this.info.clear();
  }
}

// ---------------------------------------------------------------- frame analysis (bake time)

/**
 * One axis of the zoom fit: the window shows c − before … c + after. Returns c, clamped so that
 * lo … hi lies inside it with ZOOM_MARGIN to spare; c itself when lo … hi cannot fit.
 */
function fitAxis(c: number, lo: number, hi: number, before: number, after: number): number {
  const min = hi - after + ZOOM_MARGIN;
  const max = lo + before - ZOOM_MARGIN;
  if (min > max) return c;
  return Math.max(min, Math.min(max, c));
}

function countOpaque(pc: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) if (pc.isOpaque(x, y)) n++;
  return n;
}

function frameInfo(pc: PixelCanvas, ground: number): FrameInfo {
  const b = pc.bounds();
  const runs: number[] = [];
  let start = -1;
  for (let x = 0; x <= pc.w; x++) {
    const on = x < pc.w && (pc.isOpaque(x, ground) || pc.isOpaque(x, ground - 1));
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push(start, x - 1);
      start = -1;
    }
  }
  return { bottom: b ? b.y + b.h - 1 : -1, mass: countOpaque(pc), runs };
}

/** Emissive pixels of a frame (in a box around `c`, or everywhere): centroid + count. */
function emissive(pc: PixelCanvas, colors: ReadonlySet<number>, c: { x: number; y: number; rx: number; ry: number } | null): { x: number; y: number; n: number } | null {
  const x0 = c ? Math.max(0, c.x - c.rx) : 0;
  const x1 = c ? Math.min(pc.w - 1, c.x + c.rx) : pc.w - 1;
  const y0 = c ? Math.max(0, c.y - c.ry) : 0;
  const y1 = c ? Math.min(pc.h - 1, c.y + c.ry) : pc.h - 1;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const col = pc.get(x, y);
      if (col === null || !colors.has(col)) continue;
      n++;
      sx += x;
      sy += y;
    }
  return n ? { x: Math.round(sx / n), y: Math.round(sy / n), n } : null;
}

/** Flat two-band ellipse (outer band lighter) of radii (rx, ry), centred in a (2R+1)×(2Ry+1) canvas. */
function shadowCanvas(R: number, Ry: number, rx: number, ry: number, color: number): PixelCanvas {
  const p = new PixelCanvas(2 * R + 1, 2 * Ry + 1);
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const d = (x / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2;
      if (d >= 1) continue;
      p.set(R + x, Ry + y, color, Math.round((d < 0.42 ? SHADOW_A_IN : SHADOW_A_OUT) * 255));
    }
  return p;
}

/** Darkest colour of a variant's effect ramps (shadow ink fallback). */
function darkest(fx: LabFxSettings | undefined): number {
  if (!fx) return 0x1b0a1f;
  const all = [...fx.magic, ...fx.crystal, ...fx.sideP1, ...fx.sideP2];
  const lum = (c: number) => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
  return all.reduce((a, b) => (lum(b) < lum(a) ? b : a), all[0]);
}
