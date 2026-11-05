// Hınç Baltası (spite_axe) — what stays on the field after the equip (v3 look only; lane E):
//   AxeAura   the persistent 'equip' aura: the small axe slung at its wielder's back (follows the sprite, behind the
//             body), its veins beating slowly (a hot wave down the haft every ~1.2 s, the cracks flaring with it),
//             a short chain end swinging under the pommel, an ember mote now and then, a small ember light on the
//             floor, and the wielder's EMBER EYES (the eye pixels of its current frame burn fire4 / fire3).
//   Fallen    when the wielder dies with the axe still on it, the axe outlives it: it drops out of the vanishing
//             body and bites the floor where the body stood, waiting for the return scene (toDeck) to call it home.
// Registries by the axe CARD's uid so the return scene finds the axe wherever it is (AURAS / FALLEN / LAST).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { frameRGBA } from '../../art/atlas';
import type { PlayerId, Uid } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { equipSwordAt } from '../../duel/auras-v3';
import { DEPTH, type XY } from '../../view/layout';
import { lightPool, type LightHandle } from '../../view/light';
import { Raster, onFrame } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { fxRng, motifImage, setMotif } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { type AxeOpts, type AxeSize, axeKey, axeOffset, paintLink } from './_spite_axe_motif';

export interface AxePose {
  x: number;
  y: number;
  angle: number;
  mirror: boolean;
  size: AxeSize;
}

/** The slung pose of the small axe on a wielder of `player` (P1 faces right: the axe at its left back). */
export function holdPose(player: PlayerId): { angle: number; mirror: boolean } {
  return player === 0 ? { angle: 300, mirror: true } : { angle: 240, mirror: false };
}

/** Where the slung axe's head (O) sits for a unit now (its haft crosses the back anchor). */
export function holdAt(u: MonsterUnit): XY {
  const a = equipSwordAt(u);
  const h = holdPose(u.player);
  const off = axeOffset({ size: 'sm', angle: h.angle, mirror: h.mirror }, -11, 0);
  return { x: Math.round(a.x - off.x), y: Math.round(a.y - off.y - 2) };
}

/** Last known pose of each axe (by its card uid). */
export const LAST = new Map<Uid, AxePose>();
export const AURAS = new Map<Uid, AxeAura>();
export const FALLEN = new Map<Uid, Fallen>();

// ================================================================ ember eyes

const eyeCache = new Map<string, readonly XY[]>();

/**
 * AUTHORED eye pixels per monster (frame coords of its idle:0 drawing, facing right) with the colour each eye pixel
 * has there. On another frame (idle bob, a pose) the eye is found again: the nearest pixel of that same colour within
 * 3 px of the anchor; when none matches, the anchor itself. Additive table: a monster missing here falls back to the
 * validated heuristic (eyesOfFrame) and, failing that, to a 2-px glint at its head anchor (headGlint).
 */
export const EYE_ANCHORS: Readonly<Record<string, readonly (readonly [number, number, number])[]>> = {
  ember_wolf: [
    [50, 21, PAL.gold4],
    [51, 21, PAL.gold3],
  ],
  crystal_wyrm: [
    [80, 26, PAL.cyan3],
    [81, 26, PAL.cyan3],
  ],
  stone_sentinel: [
    [38, 32, PAL.gold4],
    [39, 32, PAL.gold4],
  ],
  abyss_magus: [
    [63, 32, PAL.void4],
    [64, 32, PAL.void4],
  ],
  tide_golem: [
    [40, 18, PAL.cyan4],
    [39, 18, PAL.cyan3],
    [43, 18, PAL.cyan3],
  ],
  magma_titan: [
    [48, 23, PAL.fire4],
    [50, 23, PAL.fire4],
    [51, 23, PAL.fire4],
  ],
  shade_assassin: [
    [37, 25, PAL.white],
    [36, 25, PAL.void4],
  ],
  crag_axeman: [[50, 31, PAL.white]],
};

const rgbAt = (data: Uint8ClampedArray, W: number, H: number, x: number, y: number): number => {
  if (x < 0 || y < 0 || x >= W || y >= H) return -1;
  const i = (y * W + x) * 4;
  if (data[i + 3] === 0) return -1;
  return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
};

/** The authored eyes found on a frame (see EYE_ANCHORS). */
export function anchoredEyes(id: string, data: Uint8ClampedArray, W: number, H: number): XY[] | null {
  const a = EYE_ANCHORS[id];
  if (!a) return null;
  const cols = new Set(a.map((e) => e[2]));
  const out: XY[] = [];
  const seen = new Set<number>();
  const push = (x: number, y: number): void => {
    const k = y * W + x;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y });
  };
  for (const [ax, ay] of a) {
    let best: XY | null = null;
    let bd = Infinity;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (!cols.has(rgbAt(data, W, H, ax + dx, ay + dy))) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = { x: ax + dx, y: ay + dy };
        }
      }
    const p = best ?? { x: ax, y: ay };
    push(p.x, p.y);
    // the whole little eye: its eye-coloured neighbours too
    if (best)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        if (cols.has(rgbAt(data, W, H, p.x + dx, p.y + dy))) push(p.x + dx, p.y + dy);
  }
  return out;
}

/** Opaque bounds of a frame. */
function boundsOf(data: Uint8ClampedArray, W: number, H: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** The head anchor glint: the frontmost body pixel in the top 30 % of the frame, 3 px in from the snout, 2 down. */
export function headGlint(data: Uint8ClampedArray, W: number, H: number): XY[] {
  const b = boundsOf(data, W, H);
  if (!b) return [];
  const yEnd = b.y0 + Math.max(2, Math.floor((b.y1 - b.y0) * 0.3));
  let fx = -1;
  let fy = b.y0;
  for (let y = b.y0; y <= yEnd; y++)
    for (let x = b.x1; x > fx; x--)
      if (data[(y * W + x) * 4 + 3] > 0) {
        fx = x;
        fy = y;
        break;
      }
  if (fx < 0) return [];
  // step in until an inner (non-ink) body pixel
  for (let k = 3; k < 10; k++) {
    const x = fx - k;
    const y = fy + 2;
    const c = rgbAt(data, W, H, x, y);
    if (c >= 0 && ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255) > 90) return [{ x, y }, { x: x - 1, y }];
  }
  return [{ x: fx - 3, y: fy + 2 }];
}

/**
 * The eye pixels of a frame (frame coords, facing right): small bright clusters in the upper 45 % of the body's
 * front half next to a dark pixel; the frontmost one and a partner beside it. VALIDATED: the result must sit in the
 * head box (top 40 % of the body, front 45 %), else empty.
 */
export function eyesOfFrame(data: Uint8ClampedArray, W: number, H: number): XY[] {
  const lum = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    const i = (y * W + x) * 4;
    if (data[i + 3] === 0) return -1;
    return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
  };
  const b = boundsOf(data, W, H);
  if (!b) return [];
  const { x0, y0, x1, y1 } = b;
  const bh = y1 - y0 + 1;
  const bw = x1 - x0 + 1;
  const cands: { x: number; y: number; s: number }[] = [];
  for (let y = y0; y <= y0 + Math.floor(bh * 0.4); y++)
    for (let x = x0 + Math.floor(bw * 0.55); x <= x1; x++) {
      const l = lum(x, y);
      if (l < 175) continue;
      let dark = 0;
      let bright = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const n = lum(x + dx, y + dy);
          if (n >= 0 && n < 70) dark++;
          if (n >= 175) bright++;
        }
      if (dark < 2 || bright > 2) continue;
      // an eye is enclosed: opaque pixels on both sides (an edge highlight is not)
      if (lum(x + 2, y) < 0 || lum(x - 2, y) < 0 || lum(x, y - 2) < 0) continue;
      cands.push({ x, y, s: x - y * 0.6 });
    }
  if (!cands.length) return [];
  cands.sort((a, c) => c.s - a.s);
  const best = cands[0];
  const out: XY[] = cands.filter((c) => Math.abs(c.x - best.x) <= 1 && Math.abs(c.y - best.y) <= 1).map((c) => ({ x: c.x, y: c.y }));
  return out.slice(0, 4);
}

/** The monster id of a unit sprite ('mon:<id>' textures), or ''. */
function idOf(s: Phaser.GameObjects.Sprite): string {
  const k = s.texture?.key ?? '';
  const m = /^mon:([a-z_0-9]+)/.exec(k);
  return m ? m[1] : '';
}

/** The eye pixels of a sprite on its current frame, in world pixels. */
export function eyesOf(s: Phaser.GameObjects.Sprite): XY[] {
  if (!s.active || !s.visible || !s.frame) return [];
  const fr = s.frame;
  const key = `${fr.texture.key}|${fr.name}`;
  let e = eyeCache.get(key);
  if (!e) {
    let data: Uint8ClampedArray | null = null;
    try {
      data = frameRGBA(fr);
    } catch {
      data = null;
    }
    const W0 = fr.realWidth;
    const H0 = fr.realHeight;
    e = data ? (anchoredEyes(idOf(s), data, W0, H0) ?? (eyesOfFrame(data, W0, H0).length ? eyesOfFrame(data, W0, H0) : headGlint(data, W0, H0))) : [];
    if (eyeCache.size > 200) eyeCache.clear();
    eyeCache.set(key, e);
  }
  const W = fr.realWidth;
  const left = Math.round(s.x - s.displayOriginX);
  const top = Math.round(s.y - s.displayOriginY);
  return e.map((p) => ({ x: left + (s.flipX ? W - 1 - p.x : p.x), y: top + p.y }));
}

/** Draw the ember eyes on a raster (fire4 core, a fire3 burn trailing back; `lvl` 0 out … 3 white-hot). */
export function drawEyes(r: Raster, eyes: readonly XY[], back: number, lvl: number, frame: number): void {
  if (lvl <= 0) return;
  const core = lvl >= 3 ? PAL.white : lvl === 2 ? PAL.fire4 : PAL.fire3;
  const trail = lvl >= 2 ? PAL.fire3 : PAL.fire2;
  for (const e of eyes) r.px(e.x, e.y, core);
  if (eyes.length) {
    const head = eyes[0];
    r.px(head.x + back, head.y, trail);
    // a slow flicker: every few frames the burn licks one pixel further back
    if (lvl >= 2 && frame % 9 < 3) r.px(head.x + back * 2, head.y - 1, PAL.fire2);
  }
}

// ================================================================ the persistent aura

const VEIN_EVERY = 1200;
const VEIN_STEP = 70;

export class AxeAura {
  readonly unit: MonsterUnit;
  readonly cardUid: Uid;
  private readonly scene: Phaser.Scene;
  private readonly img: Phaser.GameObjects.Image;
  private readonly over: Raster;
  private readonly sparks: PxSparks;
  private light: LightHandle | null;
  private stop: () => void = () => undefined;
  private killed = false;
  private taken = false;
  private el = 0;
  private frame = 0;
  private readonly rnd: () => number;
  /** Eye light (0 out … 3): the ignition sets it high, it settles to 2. */
  eyeLvl = 2;

  constructor(scene: Phaser.Scene, unit: MonsterUnit, cardUid: Uid, o: { eyeLvl?: number } = {}) {
    this.scene = scene;
    this.unit = unit;
    this.cardUid = cardUid;
    this.rnd = fxRng(cardUid * 13 + 7);
    if (o.eyeLvl !== undefined) this.eyeLvl = o.eyeLvl;
    const s = unit.sprite;
    const h = holdPose(unit.player);
    const at = holdAt(unit);
    this.img = motifImage(scene, ...axeKey({ size: 'sm', angle: h.angle, mirror: h.mirror, heat: 1 }), at.x, at.y, s.depth - 0.4);
    this.over = new Raster(scene, 0, 0, 120, 120, s.depth + 0.5);
    this.sparks = new PxSparks(scene, s.depth + 0.6);
    this.light = lightPool(scene, at.x, at.y + 8, { color: PAL.fire2, radius: 18, floorY: unit.home.y, air: 0.35, airRadius: 10, intensity: 0.35, anim: 'breathe', fadeIn: 200 });
    AURAS.get(cardUid)?.kill();
    AURAS.set(cardUid, this);
    this.stop = onFrame(scene, (dt) => this.tick(dt));
    this.tick(0);
  }

  private tick(dt: number): boolean {
    if (this.killed) return false;
    const u = this.unit;
    const s = u.sprite;
    if (!s.active) {
      this.destroy();
      return false;
    }
    this.el += dt;
    if (dt > 0) this.frame++;
    const vis = s.visible && !u.retired;
    this.img.setVisible(vis);
    this.over.img.setVisible(vis);
    if (!vis) return true;
    const h = holdPose(u.player);
    const at = holdAt(u);
    // the vein wave: 4 steps down the haft every VEIN_EVERY, the cracks flaring on its first two
    const ph = (this.el + this.cardUid * 137) % VEIN_EVERY;
    const pulse = ph < VEIN_STEP * 4 ? Math.floor(ph / VEIN_STEP) : -1;
    const heat = pulse >= 0 && pulse < 2 ? 2 : 1;
    const o: AxeOpts = { size: 'sm', angle: h.angle, mirror: h.mirror, pulse, heat };
    setMotif(this.img, ...axeKey(o));
    this.img.setPosition(at.x, at.y).setDepth(s.depth - 0.4);
    LAST.set(this.cardUid, { x: at.x, y: at.y, angle: h.angle, mirror: h.mirror, size: 'sm' });
    this.light?.setPosition(at.x, at.y + 6, u.home.y);
    // the chain end under the pommel, swinging a pixel; the eyes
    const pom = axeOffset(o, -33, 0);
    const px = at.x + pom.x;
    const py = at.y + pom.y;
    const swing = Math.round(Math.sin(this.el / 260));
    this.over.moveTo(Math.round(s.x) - 60, Math.round(s.y) - 100);
    if (this.over.img.depth !== s.depth + 0.5) this.over.img.setDepth(s.depth + 0.5);
    this.over.begin();
    for (let i = 1; i <= 3; i++) paintLink((x, y, c) => this.over.px(x, y, c), px + Math.round((swing * i) / 2), py + i * 2, 0, 1, i);
    drawEyes(this.over, eyesOf(s), u.player === 0 ? -1 : 1, this.eyeLvl, this.frame);
    this.over.end();
    // an ember mote off the blade now and then (and on each vein beat)
    if (dt > 0 && (pulse === 0 ? this.rnd() < 0.5 : this.rnd() < dt / 700)) {
      const hd = axeOffset(o, -2, 8);
      this.sparks.add({ x: at.x + hd.x, y: at.y + hd.y, vx: (this.rnd() - 0.5) * 10, vy: -14 - this.rnd() * 12, life: 420 + this.rnd() * 300, colors: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], shape: 'px', fadeAt: 1 });
    }
    return true;
  }

  /** The return scene takes the axe: its pose, and the aura ends without dropping it. */
  take(): AxePose {
    const p = LAST.get(this.cardUid) ?? { ...holdAt(this.unit), ...holdPose(this.unit.player), size: 'sm' as const };
    this.taken = true;
    this.kill();
    return p;
  }

  /** The current eyes (world px) — the return scene puts them out. */
  eyes(): XY[] {
    return this.unit.sprite.active ? eyesOf(this.unit.sprite) : [];
  }

  kill(): void {
    if (this.killed) return;
    this.killed = true;
    this.stop();
    if (AURAS.get(this.cardUid) === this) AURAS.delete(this.cardUid);
    if (this.img.active) this.img.destroy();
    this.over.destroy();
    this.sparks.release();
    const l = this.light;
    this.light = null;
    if (l && l.alive) void l.fadeOut(220);
  }

  /** Disposable: the unit's aura slot cleared. A dead wielder drops the axe (Fallen); else it just ends. */
  destroy(): void {
    if (this.killed) return;
    const drop = !this.taken && this.unit.retired;
    const pose = LAST.get(this.cardUid);
    const floor = Math.round(this.unit.home.y);
    const side = this.unit.player === 0 ? -1 : 1;
    this.kill();
    if (drop && pose) new Fallen(this.scene, this.cardUid, pose, { x: Math.round(this.unit.home.x) + side * 14, y: floor + 2 });
  }
}

// ================================================================ the fallen axe

/** The planted pose beside a body: the blade's toe bites the floor, the blade fans outward, the haft rises toward the body. */
export function plantPose(player: PlayerId): { angle: number; mirror: boolean } {
  return player === 0 ? { angle: 120, mirror: false } : { angle: 60, mirror: true };
}

export class Fallen {
  readonly cardUid: Uid;
  private readonly img: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  pose: AxePose;
  private dead = false;
  private stop: () => void = () => undefined;

  constructor(scene: Phaser.Scene, cardUid: Uid, from: AxePose, floor: XY) {
    this.scene = scene;
    this.cardUid = cardUid;
    FALLEN.get(cardUid)?.kill();
    FALLEN.set(cardUid, this);
    const player: PlayerId = from.mirror ? 0 : 1; // (the hold pose's mirror is P1's)
    const pp = plantPose(player);
        const end: AxePose = { x: floor.x, y: floor.y + 3, angle: pp.angle, mirror: pp.mirror, size: 'sm' };
    this.pose = { ...from };
    this.img = motifImage(scene, ...axeKey({ size: 'sm', angle: from.angle, mirror: from.mirror }), from.x, from.y, DEPTH.UNIT + floor.y + 1);
    let el = 0;
    let landed = false;
    const ms = 220;
    this.stop = onFrame(scene, (dt) => {
      if (this.dead) return false;
      el += dt;
      const t = Math.min(1, el / ms);
      if (t < 1) {
        // it tips over and falls: gravity, three turn drawings
        const k = t * t;
        const a = from.angle + (((pp.angle - from.angle + 540) % 360) - 180) * Math.min(1, t * 1.4);
        this.pose = { x: Math.round(from.x + (end.x - from.x) * t), y: Math.round(from.y + (end.y - from.y) * k), angle: a, mirror: pp.mirror, size: 'sm' };
      } else if (!landed) {
        landed = true;
        this.pose = end;
        playV3('e_axeChain', { volume: 0.55, pitch: 1.2, pan: panAt(end.x) });
        playV3('e_axeDeck', { volume: 0.35, pitch: 1.5, pan: panAt(end.x) });
      }
      // buried once it lands: the rows under the floor line are cut (part of the drawing)
      setMotif(this.img, ...axeKey({ size: 'sm', angle: this.pose.angle, mirror: this.pose.mirror, heat: landed ? 1 : 2, cut: landed ? floor.y - this.pose.y : null }));
      this.img.setPosition(this.pose.x, this.pose.y);
      LAST.set(cardUid, this.pose);
      return true;
    });
    // nobody called it home: it crumbles away after a while
    scene.time.delayedCall(6000, () => this.kill());
  }

  take(): AxePose {
    const p = this.pose;
    this.kill();
    return p;
  }

  kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.stop();
    if (FALLEN.get(this.cardUid) === this) FALLEN.delete(this.cardUid);
    if (this.img.active) this.img.destroy();
  }
}
