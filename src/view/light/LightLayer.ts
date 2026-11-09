// LightLayer — the subtle real-time light layer of arena v2 (golden rule 3).
//
// Soft light drawn OVER the floor and UNDER / AROUND the flat pixel sprites. The sprites are
// never shaded: pools and spill lie on the marble below the units, halos sit BEHIND each
// sprite (only the glow that peeks out around it shows), and the global dim darkens the arena
// below the units with a multiply veil so lit things stand out.
//
//  depth                        what
//  LIGHT_DEPTH.STATIC  (38)     arena-registered lights: floodlight pools, neon inlay halos
//  LIGHT_DEPTH.DIM     (39.5)   global dim (multiply veil) / brighten (add wash) overlays
//  DEPTH.TILE_FX       (40–48)  board highlights / magic circles (stay bright under the dim)
//  LIGHT_DEPTH.FLOOR   (48.5)   dynamic floor light: monster pools + spill, flashes, beam strips
//  DEPTH.CARD_ON_TILE  (50)     cards lying on tiles (crisp, not hazed by the pools)
//  DEPTH.SHADOW        (60)     unit drop shadows (they sit in the pools)
//  unit depth − 0.01            the unit's emissive halo (behind its sprite)
//  unitDepth(floorY) − 0.5      a flash's air bloom (behind the unit standing on that spot)
//  LIGHT_DEPTH.AIR     (998)    other air glows: beam glow, pool air glow (under the FX band)
//
// Everything runs on scene time × scene.time.timeScale (fast-forward speeds it up, hit-stop
// freezes it). One layer per scene, created on demand (index.ts: lightLayer / ensureLightLayer)
// and destroyed on SHUTDOWN.
//
// STEPPED mode (the v3 look, ?look=v3; docs/v3/A0_ENVANTER.md §6.1 item 9): the same API, drawn in
// the still preview's light language instead (./stepped.ts): every light becomes flat stamps on
// the floor — inside the matte pad mask each pixel moves one (core: two) tones toward the light's
// hue through a fixed table, opaque, at whole pixels, faded by a 2×2 ordered dither instead of
// alpha. No soft glow textures, no air glows / halos / spill / tint washes / caustics, no dim veil
// (its ramp still runs, so lightDim keeps its timing). Monsters get one flat seat of their own
// light on their pad (the still's drawLights), plus a soft dithered contact shadow + faint light
// pool at their feet and a subtle top-left rim highlight via the light layer.

import Phaser from 'phaser';
import { CARDS, isMonster, type MonsterId } from '../../data/cards';
import { frameRGBA } from '../../art/atlas';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { monsterFrame, monsterTextureKey } from '../../art/textures';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { ZoneEntry } from '../../duel/FieldView';
import { BOARD_V4, DEPTH, duelistXY, GAME_H, GAME_W, LOOK_V3, type XY } from '../layout';
import { NT_DEPTH, ntIso, PLATE_OUTLINE, PLATE_X0, PLATE_X1, PLATE_Y0, PLATE_Y1 } from '../board-nt/layout-nt';
import { onDuelStart } from '../../duel/seeds';
import { type Stamp, StepPatch, quantize, stepImgRev } from './stepped';
import { CAUSTIC_FRAMES, LIGHT_TEX, LT, ensureLightTextures } from './textures';
import { ATTRIBUTE_LIGHT, monsterGlow, type LightAnim } from './profiles';
import { GLOW_SCALE, glowSheet, type GlowSheet } from './glow';

type Img = Phaser.GameObjects.Image;

export const LIGHT_DEPTH = {
  /** Arena-registered static lights (floods, neon halos): under the dim veil, so it dims them too. */
  STATIC: DEPTH.TILE + 8,
  /** The global dim / brighten overlays (over sky, stadium, platform and tiles). */
  DIM: DEPTH.TILE_FX - 0.5,
  /**
   * Dynamic floor light (monster pools, flashes, beam floor strips): over the dim veil and the
   * board's tile FX, under the board's standing props (v2 D2.props = 49) and the cards lying on
   * the tiles (they stay crisp, not hazed).
   */
  FLOOR: DEPTH.CARD_ON_TILE - 1.5,
  /** Air glows (flash bloom, beam glow): in front of units, under the FX band. */
  AIR: DEPTH.FX - 2,
} as const;

/**
 * Light groups. The global dim treats them differently: floods dim the most, neon a little,
 * unit lights get slightly stronger (lit monsters stand out in a dark arena), fx are untouched.
 */
export type LightGroup = 'flood' | 'neon' | 'ambient' | 'unit' | 'fx';
/**
 * add / screen: light (screen is gentler on the bright marble). multiply: the colour TINT a
 * light casts on a white surface (white → toward the colour); pools pair it with a screen glow.
 */
export type LightBlend = 'add' | 'screen' | 'multiply';

/** Anything with a position (a sprite, an image, a plain point that is updated). */
export interface Followable {
  x: number;
  y: number;
  active?: boolean;
}

export interface FollowOpts {
  /** Offset added to the target position. */
  dx?: number;
  dy?: number;
  /**
   * Floor under the target: a fixed y, a function of the (offset) target position, or omitted
   * to keep the current height above the floor (the pool slides along under the target).
   */
  floorY?: number | ((p: XY) => number);
}

/** A live light (pool, flash, beam, static light). All setters return the handle. */
export interface LightHandle {
  /** False once faded out / destroyed (setters then do nothing). */
  readonly alive: boolean;
  /** Move the light source to (x, y). floorY = the floor under it (default: keep the height). */
  setPosition(x: number, y: number, floorY?: number): LightHandle;
  setColor(color: number): LightHandle;
  /** Intensity multiplier (1 = the default strength), eased over `ms` of scene time. */
  setIntensity(k: number, ms?: number): LightHandle;
  /** Floor radius (rx; ry defaults to rx / 2), eased over `ms`. */
  setRadius(rx: number, ry?: number, ms?: number): LightHandle;
  /**
   * Follow a moving object each frame (null stops following). When a followed game object is
   * destroyed (active false) the light fades out by itself (180 ms).
   */
  follow(target: Followable | (() => XY | null) | null, o?: FollowOpts): LightHandle;
  /** Fade to nothing over `ms` (default 250), then destroy. Resolves when gone. */
  fadeOut(ms?: number): Promise<void>;
  /** Remove at once. */
  destroy(): void;
}

export interface BeamHandle extends LightHandle {
  /** Move both ends (air glow). `floor` moves the floor strip (if it has one). */
  setEnds(from: XY, to: XY, floor?: { from: XY; to: XY }): BeamHandle;
  /** Resolves when the beam has faded out (its `ms` envelope ended, or fadeOut / destroy). */
  readonly done: Promise<void>;
}

/** Dim-level factor per group (d in [-1, 1], 1 = full dramatic dim, −1 = full brighten). */
function dimFactor(group: LightGroup, d: number): number {
  if (d >= 0) {
    switch (group) {
      case 'flood':
        return 1 - 0.8 * d;
      case 'neon':
        return 1 - 0.4 * d;
      case 'ambient':
        return 1 - 0.55 * d;
      case 'unit':
        return 1 + 0.3 * d;
      case 'fx':
        return 1;
    }
  }
  const b = -d;
  switch (group) {
    case 'flood':
      return 1 + 0.7 * b;
    case 'neon':
      return 1 + 0.35 * b;
    case 'ambient':
      return 1 + 0.4 * b;
    case 'unit':
      return 1 + 0.1 * b;
    case 'fx':
      return 1;
  }
}

/** Motion of a light: intensity (k), radius (r) and offset (dx, dy) at time t (seconds). */
export function animMod(anim: LightAnim | undefined, t: number, ph: number): { k: number; r: number; dx: number; dy: number } {
  const s = Math.sin;
  switch (anim) {
    case 'shimmer':
      return { k: 1 + 0.06 * s(2.3 * t + ph) + 0.035 * s(5.1 * t + 2 * ph), r: 1 + 0.02 * s(1.7 * t + ph), dx: 0, dy: 0 };
    case 'breathe':
      return { k: 1 + 0.17 * s(1.25 * t + ph), r: 1 + 0.07 * s(1.25 * t + ph - 0.6), dx: 0, dy: 0 };
    case 'flicker': {
      // slow, organic fire: a few incommensurate waves + a soft dip now and then
      let k = 1 + 0.09 * s(3.1 * t + ph) + 0.07 * s(5.3 * t + 1.7 * ph) + 0.05 * s(8.9 * t + 0.3 * ph) + 0.05 * s(1.3 * t + ph);
      const dip = s(0.71 * t + ph * 2.3);
      if (dip > 0.93) k -= (dip - 0.93) * 2.2;
      return { k, r: 1 + 0.035 * s(4.1 * t + ph), dx: 0.7 * s(2.7 * t + ph), dy: 0.35 * s(3.3 * t + 2 * ph) };
    }
    case 'caustic':
      return { k: 1 + 0.05 * s(1.6 * t + ph), r: 1 + 0.025 * s(2.2 * t + ph), dx: 0, dy: 0 };
    case 'sway':
      return { k: 1 + 0.06 * s(2.9 * t + ph), r: 1, dx: 2.2 * s(1.4 * t + ph), dy: 0.8 * s(1.4 * t + ph + 1.2) };
    case 'steady':
    default:
      return { k: 1 + 0.03 * s(0.9 * t + ph), r: 1, dx: 0, dy: 0 };
  }
}

/** A value eased toward a target over scene time. */
class Ramp {
  v: number;
  private from = 0;
  private to = 0;
  private t = 0;
  private dur = 0;
  private ease: (x: number) => number = (x) => x;
  private waiters: (() => void)[] = [];

  constructor(v: number) {
    this.v = v;
    this.to = v;
  }

  set(to: number, ms = 0, ease?: (x: number) => number): Promise<void> {
    this.flush();
    if (ms <= 0) {
      this.v = to;
      this.to = to;
      this.dur = 0;
      return Promise.resolve();
    }
    this.from = this.v;
    this.to = to;
    this.t = 0;
    this.dur = ms;
    this.ease = ease ?? ((x) => x * (2 - x));
    return new Promise((r) => this.waiters.push(r));
  }

  get target(): number {
    return this.to;
  }

  get moving(): boolean {
    return this.dur > 0;
  }

  step(dt: number): void {
    if (this.dur <= 0) return;
    this.t += dt;
    const x = Math.min(1, this.t / this.dur);
    this.v = this.from + (this.to - this.from) * this.ease(x);
    if (x >= 1) {
      this.dur = 0;
      this.v = this.to;
      this.flush();
    }
  }

  flush(): void {
    const w = this.waiters.splice(0);
    for (const f of w) f();
  }
}

const PHASE_SEED0 = 0x2545f491;
let phaseSeed = PHASE_SEED0;
onDuelStart(() => (phaseSeed = PHASE_SEED0));
function nextPhase(): number {
  phaseSeed = (phaseSeed * 1664525 + 1013904223) >>> 0;
  return (phaseSeed / 4294967296) * Math.PI * 2;
}

// ====================================================================== light primitives

/** Base of every light: lifetime, intensity / visibility ramps, the layer's frame tick. */
abstract class LightBase implements LightHandle {
  readonly layer: LightLayer;
  readonly group: LightGroup;
  protected readonly imgs: Img[] = [];
  /** Stepped mode: this light's floor pixels (null in the soft mode). */
  protected patch: StepPatch | null = null;
  protected readonly level = new Ramp(0);
  protected readonly intensity: Ramp;
  protected dead = false;
  private doneWaiters: (() => void)[] = [];
  protected followFn: (() => XY | null) | null = null;
  protected followO: FollowOpts = {};
  /** The followed game object was destroyed: the light fades out on its own. */
  private followLost = false;
  /** fadeOut() in progress (a later call retargets it instead of cutting it short). */
  private fading = false;

  constructor(layer: LightLayer, group: LightGroup, intensity = 1) {
    this.layer = layer;
    this.group = group;
    this.intensity = new Ramp(intensity);
  }

  get alive(): boolean {
    return !this.dead;
  }

  protected img(tex: string, depth: number, blend: LightBlend, frame?: string | number): Img {
    const im = this.layer.makeImage(tex, depth, blend, frame);
    this.imgs.push(im);
    return im;
  }

  /** Called by the layer once per frame (dt in scaled ms, t in seconds). Return false to die. */
  tick(dt: number, t: number, gain: number): boolean {
    if (this.dead) return false;
    this.level.step(dt);
    this.intensity.step(dt);
    if (this.followFn) {
      const p = this.followFn();
      if (p) this.onFollow(p);
      else if (this.followLost) {
        this.followFn = null;
        void this.fadeOut(180);
      }
    }
    this.render(dt, t, gain * this.layer.groupGain(this.group) * this.intensity.v * this.level.v);
    return !this.dead;
  }

  protected abstract render(dt: number, t: number, k: number): void;

  protected onFollow(_p: XY): void {}

  abstract setPosition(x: number, y: number, floorY?: number): LightHandle;
  abstract setColor(color: number): LightHandle;
  abstract setRadius(rx: number, ry?: number, ms?: number): LightHandle;

  setIntensity(k: number, ms = 0): LightHandle {
    if (!this.dead) void this.intensity.set(k, ms);
    return this;
  }

  follow(target: Followable | (() => XY | null) | null, o: FollowOpts = {}): LightHandle {
    if (this.dead) return this;
    if (!target) {
      this.followFn = null;
      return this;
    }
    this.followO = o;
    if (typeof target === 'function') this.followFn = target;
    else
      this.followFn = () => {
        if (target.active === false) {
          this.followLost = true;
          return null;
        }
        return { x: target.x, y: target.y };
      };
    return this;
  }

  fadeOut(ms = 250): Promise<void> {
    if (this.dead) return Promise.resolve();
    const p = this.whenDone();
    this.fading = true;
    // a superseded ramp resolves early: only the one that reaches 0 removes the light
    void this.level.set(0, ms, (x) => x).then(() => {
      if (this.fading && this.level.v <= 0.001) this.destroy();
    });
    return p;
  }

  whenDone(): Promise<void> {
    if (this.dead) return Promise.resolve();
    return new Promise((r) => this.doneWaiters.push(r));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const im of this.imgs) if (im.active) im.destroy();
    this.imgs.length = 0;
    this.patch?.destroy();
    this.patch = null;
    this.level.flush();
    this.intensity.flush();
    const w = this.doneWaiters.splice(0);
    for (const f of w) f();
    this.layer.forget(this);
  }

  setVisibleAll(on: boolean): void {
    for (const im of this.imgs) im.setVisible(on);
    this.patch?.setShown(on);
  }

  /** Lit pad pixels of the stepped patch (QA). */
  steppedPixels(): number {
    return this.patch?.pixels ?? 0;
  }
}

export interface PoolOpts {
  /** Light colour (palette). Default PAL.white. */
  color?: number;
  /** Spill colour (the wide faint wash; default = color). null = no spill. */
  spill?: number | null;
  /** Floor radius in px (the core pool; the spill is ~2.2× wider). Default 36. */
  radius?: number;
  /** Floor ry (default radius / 2 — the 2:1 iso floor). */
  ry?: number;
  /** Floor y under the light (default: y — the light lies on the floor). */
  floorY?: number;
  /** Intensity multiplier (1 = default). */
  intensity?: number;
  /** Air glow (0..1) at the source point (x, y) — use it for lights that float above the floor. */
  air?: number;
  /** Air glow radius (default radius × 0.55). */
  airRadius?: number;
  /** Motion: 'steady' | 'shimmer' | 'breathe' | 'flicker' | 'caustic' | 'sway' (default steady). */
  anim?: LightAnim;
  /** Fade-in time (ms, default 160). */
  fadeIn?: number;
  group?: LightGroup;
  blend?: LightBlend;
  /** Depth of the floor light (default LIGHT_DEPTH.FLOOR, or STATIC for static groups). */
  depth?: number;
  /** Depth of the air glow (default LIGHT_DEPTH.AIR). */
  airDepth?: number;
  /** Spill width relative to the core (default 2.2). */
  spillScale?: number;
  /**
   * Colour tint cast on the (bright) floor, 0..1 (default 0.5 for event lights, 0 for static
   * ones): a multiply wash toward the colour under the glow, so coloured light reads on the
   * white marble where adding light alone clips.
   */
  tint?: number;
}

/** Base alpha budgets (before intensity / gains). */
const A = {
  core: 0.42,
  spill: 0.2,
  air: 0.24,
  beamAir: 0.26,
  beamFloor: 0.16,
  caustic: 0.34,
  flashCore: 0.5,
  ring: 0.3,
  tint: 0.36,
} as const;

/** A soft pool of light on the floor (+ optional spill wash and air glow). */
export class PoolLight extends LightBase {
  x: number;
  y: number;
  floorY: number;
  color: number;
  spillColor: number | null;
  readonly rx: Ramp;
  readonly ry: Ramp;
  air: number;
  airR: number;
  anim: LightAnim | undefined;
  spillScale: number;
  readonly ph = nextPhase();
  protected core: Img | null = null;
  protected spill: Img | null = null;
  protected tintImg: Img | null = null;
  tint: number;
  protected airImg: Img | null = null;
  /** Extra per-frame multiplier hook (flash envelopes). */
  protected env = 1;
  protected envR = 1;

  constructor(layer: LightLayer, x: number, y: number, o: PoolOpts, group: LightGroup) {
    super(layer, group, o.intensity ?? 1);
    this.x = x;
    this.y = y;
    this.floorY = o.floorY ?? y;
    this.color = o.color ?? PAL.white;
    this.spillColor = o.spill === null ? null : (o.spill ?? this.color);
    const r = o.radius ?? 36;
    this.rx = new Ramp(r);
    this.ry = new Ramp(o.ry ?? r / 2);
    this.air = o.air ?? 0;
    this.airR = o.airRadius ?? r * 0.55;
    this.anim = o.anim;
    this.spillScale = o.spillScale ?? 2.2;
    const statik = group === 'flood' || group === 'neon' || group === 'ambient';
    const depth = o.depth ?? (statik ? LIGHT_DEPTH.STATIC : LIGHT_DEPTH.FLOOR);
    const blend = o.blend ?? 'screen';
    this.tint = o.tint ?? (group === 'fx' ? 0.5 : 0);
    if (layer.stepped) {
      // stepped: the floor stamps only (no core / spill / tint / air images)
      this.patch = layer.makePatch();
      void this.level.set(1, o.fadeIn ?? 160);
      return;
    }
    if (this.tint > 0) this.tintImg = this.img(LT.wide, depth - 0.02, 'multiply');
    this.spill = this.spillColor !== null ? this.img(LT.wide, depth - 0.01, blend) : null;
    this.core = this.img(LT.radial, depth, blend);
    if (this.air > 0) this.airImg = this.img(LT.radial, o.airDepth ?? LIGHT_DEPTH.AIR, 'add');
    void this.level.set(1, o.fadeIn ?? 160);
  }

  setPosition(x: number, y: number, floorY?: number): LightHandle {
    const h = this.floorY - this.y;
    this.x = x;
    this.y = y;
    this.floorY = floorY ?? y + h;
    return this;
  }

  protected onFollow(p: XY): void {
    const x = p.x + (this.followO.dx ?? 0);
    const y = p.y + (this.followO.dy ?? 0);
    const f = this.followO.floorY;
    this.setPosition(x, y, typeof f === 'function' ? f({ x, y }) : f);
  }

  setColor(color: number, spill?: number): LightHandle {
    this.color = color;
    if (this.spillColor !== null) this.spillColor = spill ?? color;
    return this;
  }

  setRadius(rx: number, ry?: number, ms = 0): LightHandle {
    void this.rx.set(rx, ms);
    void this.ry.set(ry ?? rx / 2, ms);
    return this;
  }

  protected render(dt: number, t: number, k: number): void {
    this.rx.step(dt);
    this.ry.step(dt);
    const m = animMod(this.anim, t, this.ph);
    const kk = Math.max(0, k * m.k * this.env);
    if (this.patch) {
      // stepped: one flat stamp on the floor (whole-pixel centre and radii, quarter-step level;
      // the light's motion only modulates the level, never the shape)
      this.patch.draw([...this.stamps(kk), ...this.extraStamps(k)]);
      return;
    }
    const rs = m.r * this.envR;
    const fx = this.x + m.dx;
    const fy = this.floorY + m.dy;
    const rx = this.rx.v * rs;
    const ry = this.ry.v * rs;
    if (!this.core) return;
    place(this.core, fx, fy, rx, ry, this.color, A.core * kk * this.coreGain());
    if (this.spill) place(this.spill, fx, fy, rx * this.spillScale, ry * this.spillScale, this.spillColor ?? this.color, A.spill * kk * this.coreGain());
    if (this.tintImg) place(this.tintImg, fx, fy, rx * 1.5, ry * 1.5, this.color, A.tint * this.tint * Math.min(1.5, kk));
    if (this.airImg) place(this.airImg, this.x, this.y, this.airR * rs, this.airR * rs, this.color, A.air * this.air * kk);
  }

  /** Subclasses scale the floor alphas (flash budgets). */
  protected coreGain(): number {
    return 1;
  }

  /** Stepped mode: steps per unit of light (a flash's peak lifts its core two steps). */
  protected stepGain(): number {
    return 1;
  }

  /** Stepped mode: the floor stamp of this pool at intensity `kk`. */
  protected stamps(kk: number): Stamp[] {
    const level = quantize(kk * this.stepGain());
    const rx = Math.max(0, Math.round(this.rx.v * this.envR));
    const ry = Math.max(0, Math.round(this.ry.v * this.envR));
    if (level <= 0 || rx < 1 || ry < 1) return [];
    return [{ kind: 'ellipse', cx: Math.round(this.x), cy: Math.round(this.floorY), rx, ry, level, hue: this.color }];
  }

  /** Stepped mode: more stamps (a flash's ring). */
  protected extraStamps(_k: number): Stamp[] {
    return [];
  }
}

/** Size / colour / alpha one light image (round textures: 2·r = display size). */
function place(im: Img, x: number, y: number, rx: number, ry: number, color: number, alpha: number): void {
  if (alpha <= 0.002 || rx < 0.5 || ry < 0.5) {
    if (im.alpha !== 0) im.setAlpha(0);
    return;
  }
  im.setPosition(x, y);
  im.setScale((rx * 2) / LIGHT_TEX, (ry * 2) / LIGHT_TEX);
  if (im.tintTopLeft !== color) im.setTint(color);
  im.setAlpha(Math.min(1, alpha));
}

export interface FlashOpts {
  /** Floor y under the flash (default y). The floor pool lands there; the air bloom at (x, y). */
  floorY?: number;
  /** Peak intensity (default 1). */
  intensity?: number;
  /** Air bloom strength 0..1 (default 0.5 when floorY ≠ y, else 0.3). */
  air?: number;
  /** An expanding soft ring on the floor (impact shock light). Default false. */
  ring?: boolean;
  /** Spill colour (default = color). */
  spill?: number;
  /** Rise time (ms, default min(40, ms × 0.12)). */
  rise?: number;
  /**
   * Depth of the air bloom (default unitDepth(floorY) − 0.5: just behind a unit standing on that
   * spot, so it glows around it; pass LIGHT_DEPTH.AIR to bloom in front of every unit).
   */
  airDepth?: number;
}

/** A one-shot flash: quick rise, eased decay, slightly growing pool (+ ring, + air bloom). */
export class FlashLight extends PoolLight {
  private age = 0;
  private readonly dur: number;
  private readonly rise: number;
  private readonly peak: number;
  private readonly ringImg: Img | null;
  private readonly baseR: number;

  constructor(layer: LightLayer, x: number, y: number, color: number, radius: number, ms: number, o: FlashOpts) {
    const floorY = o.floorY ?? y;
    // the air bloom sits just BEHIND whatever stands on that floor spot (it glows around the
    // unit, never over its pixels) unless the caller asks for another depth
    const airDepth = o.airDepth ?? DEPTH.UNIT + floorY - 0.5;
    super(layer, x, y, { color, spill: o.spill ?? color, radius, floorY, air: o.air ?? (Math.abs(floorY - y) > 2 ? 0.55 : 0.3), airRadius: radius * 0.6, fadeIn: 0, spillScale: 1.9, airDepth, tint: 0.6 }, 'fx');
    void this.level.set(1, 0);
    this.dur = Math.max(60, ms);
    this.rise = o.rise ?? Math.min(40, this.dur * 0.12);
    this.peak = o.intensity ?? 1;
    this.baseR = radius;
    this.ring = !!o.ring;
    this.ringImg = o.ring && !layer.stepped ? this.img(LT.ring, LIGHT_DEPTH.FLOOR + 0.02, 'add') : null;
    this.env = 0;
  }

  private readonly ring: boolean;

  protected coreGain(): number {
    return A.flashCore / A.core;
  }

  /** A flash at its peak (intensity 1) lifts its core two steps, then decays through the dither. */
  protected stepGain(): number {
    return 1.8;
  }

  /** The expanding shock ring: a 2 px (then 1 px) iso ring one step up, while it is strong enough. */
  protected extraStamps(k: number): Stamp[] {
    if (!this.ring) return [];
    const x = this.age / this.dur;
    const r = this.baseR * (0.45 + 1.35 * (1 - Math.pow(1 - x, 2)));
    const level = quantize(1.6 * this.peak * k * (1 - x) * (1 - x));
    const rx = Math.round(r);
    const ry = Math.round(r / 2);
    if (level <= 0 || rx < 2 || ry < 1) return [];
    return [{ kind: 'ring', cx: Math.round(this.x), cy: Math.round(this.floorY), rx, ry, width: x < 0.4 ? 2 : 1, level: Math.min(1, level), hue: this.color }];
  }

  protected render(dt: number, t: number, k: number): void {
    this.age += dt;
    const a = this.age;
    if (a >= this.dur) {
      this.destroy();
      return;
    }
    if (a < this.rise) this.env = (a / this.rise) * this.peak;
    else {
      const x = (a - this.rise) / Math.max(1, this.dur - this.rise);
      this.env = this.peak * Math.pow(1 - x, 2.2);
    }
    this.envR = 0.85 + 0.25 * Math.min(1, a / (this.dur * 0.5));
    super.render(dt, t, k);
    if (this.ringImg) {
      const x = a / this.dur;
      const r = this.baseR * (0.45 + 1.35 * (1 - Math.pow(1 - x, 2)));
      place(this.ringImg, this.x, this.floorY, r, r / 2, this.color, A.ring * this.peak * k * (1 - x) * (1 - x));
    }
  }
}

export interface BeamOpts {
  /** Air glow thickness in px (default 10). */
  width?: number;
  /** Intensity (default 1). */
  intensity?: number;
  /** A soft strip on the floor under the beam (its two floor points). Default: none. */
  floor?: { from: XY; to: XY } | null;
  /** Floor strip thickness (default width × 1.6). */
  floorWidth?: number;
  /** Rise / fall (ms) of the `ms` envelope (default 70 / 35% of ms). */
  rise?: number;
  fall?: number;
  /** Air glow depth (default LIGHT_DEPTH.AIR). */
  depth?: number;
  /** Shimmer of the beam intensity (0..1, default 0.25). */
  shimmer?: number;
  /** Draw the air glow (default true). false = floor strip only (e.g. neon inlay halos). */
  air?: boolean;
}

/** A soft glowing line: air glow (body + round caps) and an optional floor strip. */
export class BeamLight extends LightBase implements BeamHandle {
  private from: XY;
  private to: XY;
  private floor: { from: XY; to: XY } | null;
  color: number;
  private width: number;
  private floorW: number;
  private readonly body: Img | null;
  private readonly capA: Img | null;
  private readonly capB: Img | null;
  private readonly fBody: Img | null;
  private readonly fCapA: Img | null;
  private readonly fCapB: Img | null;
  private age = 0;
  private readonly ms: number;
  private readonly rise: number;
  private readonly fall: number;
  private readonly shimmer: number;
  private readonly ph = nextPhase();
  readonly done: Promise<void>;
  private readonly airAlpha: number;
  private readonly floorAlpha: number;

  constructor(layer: LightLayer, from: XY, to: XY, color: number, ms: number, o: BeamOpts, group: LightGroup, alphas = { air: A.beamAir, floor: A.beamFloor }) {
    super(layer, group, o.intensity ?? 1);
    this.from = { ...from };
    this.to = { ...to };
    this.floor = o.floor ? { from: { ...o.floor.from }, to: { ...o.floor.to } } : null;
    this.color = color;
    this.width = o.width ?? 10;
    this.floorW = o.floorWidth ?? this.width * 1.6;
    this.ms = ms;
    this.rise = o.rise ?? 70;
    this.fall = o.fall ?? Math.max(60, ms * 0.35);
    this.shimmer = o.shimmer ?? 0.25;
    this.airAlpha = alphas.air;
    this.floorAlpha = alphas.floor;
    const statik = group === 'flood' || group === 'neon' || group === 'ambient';
    const fd = statik ? LIGHT_DEPTH.STATIC : LIGHT_DEPTH.FLOOR;
    if (layer.stepped) {
      // stepped: only the floor strip (if any), as stamps; no air glow
      this.fBody = this.fCapA = this.fCapB = null;
      if (this.floor) this.patch = layer.makePatch();
    } else if (this.floor) {
      this.fBody = this.img(LT.line, fd, 'screen');
      this.fCapA = this.img(LT.radial, fd, 'screen');
      this.fCapB = this.img(LT.radial, fd, 'screen');
    } else {
      this.fBody = this.fCapA = this.fCapB = null;
    }
    const ad = o.depth ?? (statik ? LIGHT_DEPTH.STATIC + 0.1 : LIGHT_DEPTH.AIR);
    if (layer.stepped) {
      this.body = this.capA = this.capB = null; // no air glow in the stepped mode
    } else if (o.air !== false) {
      this.body = this.img(LT.line, ad, 'add');
      this.capA = this.img(LT.radial, ad, 'add');
      this.capB = this.img(LT.radial, ad, 'add');
      this.body.setOrigin(0, 0.5);
    } else {
      this.body = this.capA = this.capB = null;
    }
    this.fBody?.setOrigin(0, 0.5);
    void this.level.set(1, ms > 0 ? 0 : 120);
    this.done = this.whenDone();
  }

  setEnds(from: XY, to: XY, floor?: { from: XY; to: XY }): BeamHandle {
    this.from = { ...from };
    this.to = { ...to };
    if (floor && this.floor) this.floor = { from: { ...floor.from }, to: { ...floor.to } };
    return this;
  }

  setPosition(x: number, y: number): LightHandle {
    const dx = x - this.from.x;
    const dy = y - this.from.y;
    this.from = { x, y };
    this.to = { x: this.to.x + dx, y: this.to.y + dy };
    if (this.floor) this.floor = { from: { x: this.floor.from.x + dx, y: this.floor.from.y + dy }, to: { x: this.floor.to.x + dx, y: this.floor.to.y + dy } };
    return this;
  }

  setColor(color: number): LightHandle {
    this.color = color;
    return this;
  }

  setRadius(rx: number): LightHandle {
    this.width = rx;
    this.floorW = rx * 1.6;
    return this;
  }

  protected render(dt: number, t: number, k: number): void {
    let env = 1;
    if (this.ms > 0) {
      this.age += dt;
      const a = this.age;
      if (a >= this.ms) {
        this.destroy();
        return;
      }
      if (a < this.rise) env = a / this.rise;
      else if (a > this.ms - this.fall) env = Math.max(0, (this.ms - a) / this.fall);
    }
    const sh = 1 + this.shimmer * (0.6 * Math.sin(t * 17.3 + this.ph) + 0.4 * Math.sin(t * 29.1 + 2 * this.ph)) * 0.5;
    const kk = k * env * sh;
    if (this.patch) {
      const f = this.floor;
      const level = quantize(k * env);
      this.patch.draw(
        f && level > 0
          ? [{ kind: 'strip', ax: Math.round(f.from.x), ay: Math.round(f.from.y), bx: Math.round(f.to.x), by: Math.round(f.to.y), width: Math.max(2, Math.round(this.floorW)), level, hue: this.color }]
          : [],
      );
      return;
    }
    if (this.body && this.capA && this.capB) line(this.body, this.capA, this.capB, this.from, this.to, this.width, this.color, this.airAlpha * kk, false);
    if (this.floor && this.fBody && this.fCapA && this.fCapB) line(this.fBody, this.fCapA, this.fCapB, this.floor.from, this.floor.to, this.floorW, this.color, this.floorAlpha * kk, true);
  }
}

/** Lay a soft line (body + 2 caps) from a to b. `flat`: an iso floor strip (caps are 2:1). */
function line(body: Img, ca: Img, cb: Img, a: XY, b: XY, width: number, color: number, alpha: number, flat: boolean): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (alpha <= 0.002) {
    for (const im of [body, ca, cb]) if (im.alpha !== 0) im.setAlpha(0);
    return;
  }
  // the line texture's cross-section spans 32 px; the visible core is ~half of it
  body.setPosition(a.x, a.y).setRotation(Math.atan2(dy, dx)).setScale(Math.max(0.01, len / 8), (width * 2) / 32);
  if (body.tintTopLeft !== color) body.setTint(color);
  body.setAlpha(Math.min(1, alpha));
  const capRx = width;
  const capRy = flat ? width * 0.75 : width;
  place(ca, a.x, a.y, capRx, capRy, color, alpha * 0.85);
  place(cb, b.x, b.y, capRx, capRy, color, alpha * 0.85);
}

// ====================================================================== monsters + tiles

/** The source of units / tiles the layer lights (FieldView satisfies it). */
export interface LightFieldSource {
  units(): MonsterUnit[];
  tiles?(): ZoneEntry[];
}

const opaqueW = new Map<MonsterId, { w: number; h: number }>();

/** A monster's own light: attribute pool + spill on the floor, caustics (SU), emissive halo. */
class UnitLight {
  readonly unit: MonsterUnit;
  private readonly layer: LightLayer;
  private readonly core: Img;
  private readonly spill: Img;
  private readonly tintImg: Img;
  private readonly caustic: Img | null;
  private halo: Img | null = null;
  private sheet: GlowSheet | null = null;
  private readonly lvl = new Ramp(0);
  private energy = 1;
  private readonly ph = nextPhase();
  private readonly baseR: number;
  private readonly color: number;
  private readonly spillColor: number;
  private readonly anim: LightAnim;
  private readonly gainK: number;
  private readonly haloK: number;
  private causticT = 0;
  private lastFrame = '';
  dead = false;

  constructor(layer: LightLayer, unit: MonsterUnit) {
    this.layer = layer;
    this.unit = unit;
    const al = ATTRIBUTE_LIGHT[unit.attribute];
    const glow = monsterGlow(unit.cardId);
    this.color = al.color;
    this.spillColor = glow?.spill ?? al.spill;
    this.anim = al.anim;
    this.gainK = al.gain * (glow?.pool ?? 1);
    this.haloK = glow?.halo ?? 0.6;
    let ow = opaqueW.get(unit.cardId);
    if (!ow) {
      // the opaque bounds of idle 0 (the sprite's frame is the whole cell with margins)
      const b = monsterFrame(unit.cardId, 'idle', 0).bounds();
      ow = b ? { w: b.w, h: b.h } : { w: 32, h: 32 };
      opaqueW.set(unit.cardId, ow);
    }
    this.baseR = Math.round(Math.max(28, Math.min(50, 18 + ow.w * 0.42)));
    this.tintImg = layer.makeImage(LT.wide, LIGHT_DEPTH.FLOOR - 0.02, 'multiply');
    this.spill = layer.makeImage(LT.wide, LIGHT_DEPTH.FLOOR - 0.01, 'screen');
    this.core = layer.makeImage(LT.radial, LIGHT_DEPTH.FLOOR, 'screen');
    // caustics read on the bright marble as blue-tinted ripples (multiply), like the pool tint
    this.caustic = al.anim === 'caustic' ? layer.makeImage(LT.caustic, LIGHT_DEPTH.FLOOR + 0.01, 'multiply', '0') : null;
    try {
      this.sheet = glowSheet(layer.scene, unit.cardId);
      this.halo = layer.makeImage(this.sheet.key, unit.sprite.depth - 0.01, 'add', 'idle:0');
    } catch (e) {
      console.error('[light] glow sheet failed', e);
    }
  }

  /** Visible amount of the unit (0..1). */
  private visibility(): number {
    const u = this.unit;
    const s = u.sprite;
    if (!s.active || u.retired || !s.visible) return 0;
    let v = Math.min(1, s.alpha);
    if (s.isCropped) {
      const c = (s as unknown as { _crop?: { width: number; height: number } })._crop;
      const f = s.frame;
      if (c && f) v *= Math.max(0, Math.min(1, (c.width * c.height) / Math.max(1, f.realWidth * f.realHeight)));
    }
    return v;
  }

  /** Returns false when the light has faded out after its unit left. */
  tick(dt: number, t: number, gain: number, onField: boolean): boolean {
    const u = this.unit;
    const s = u.sprite;
    const vis = onField || (s.active && !u.retired) ? this.visibility() : 0;
    const want = vis * (u.position === 'defense' ? 0.78 : 1);
    if (Math.abs(this.lvl.target - want) > 0.01 || (!this.lvl.moving && Math.abs(this.lvl.v - want) > 0.01)) {
      const up = want > this.lvl.v;
      void this.lvl.set(want, up ? 380 : 260, up ? (x) => x * x * (3 - 2 * x) : (x) => x);
    }
    this.lvl.step(dt);
    const lv = this.lvl.v;
    if (!onField && lv <= 0.003 && want <= 0.003) return false;
    if (!s.active) {
      this.hideAll();
      return lv > 0.003 && onField;
    }
    // ---- frame data (glow centroid / energy)
    const art = u.art;
    const frameName = String(s.frame?.name ?? '');
    const own = s.texture?.key === monsterTextureKey(u.cardId);
    const gf = own && this.sheet ? this.sheet.frames.get(frameName) : undefined;
    let eTarget = 1;
    let cx = art.core.x;
    let cy = art.core.y;
    if (gf && this.sheet) {
      const base = Math.max(6, this.sheet.idleEnergy);
      eTarget = Math.max(0.7, Math.min(1.6, 0.55 + 0.45 * (gf.energy / base)));
      if (gf.energy > 1) {
        cx = gf.cx;
        cy = gf.cy;
      }
    }
    this.energy += (eTarget - this.energy) * Math.min(1, dt / 110);
    const cw = framePoint(s, cx, cy);
    const groundY = s.y + art.hover * Math.abs(s.scaleY) + u.lift;
    const height = Math.max(0, groundY - cw.y);
    const air = art.hover + u.lift;
    const liftK = 1 / (1 + air / 45);
    const m = animMod(this.anim, t, this.ph);
    const k = gain * this.layer.groupGain('unit') * lv * this.energy * m.k * this.gainK * liftK;
    const rs = m.r * (1 + air / 70) * (0.9 + 0.1 * Math.min(1.6, this.energy)) * Math.max(0.6, Math.abs(s.scaleX));
    const px = s.x + (cw.x - s.x) * 0.55 + m.dx;
    const py = groundY + m.dy - Math.min(4, height * 0.04);
    const rx = this.baseR * rs;
    place(this.core, px, py, rx, rx / 2, this.color, A.core * k);
    place(this.spill, px, py, rx * 2.3, rx * 1.15, this.spillColor, A.spill * k);
    place(this.tintImg, px, py, rx * 1.7, rx * 0.85, this.spillColor, A.tint * Math.min(1.4, k));
    if (this.caustic) {
      this.causticT += dt;
      const f = Math.floor(this.causticT / 95) % CAUSTIC_FRAMES;
      this.caustic.setFrame(String(f));
      this.caustic.setPosition(Math.round(px), Math.round(py));
      this.caustic.setScale(1);
      if (this.caustic.tintTopLeft !== PAL.water3) this.caustic.setTint(PAL.water3);
      this.caustic.setAlpha(Math.min(1, A.caustic * Math.min(1.4, k)));
    }
    // ---- halo behind the sprite (follows its frame / flip / scale / rotation)
    const h = this.halo;
    const sh = this.sheet;
    if (h && sh) {
      if (!own || !gf || !s.visible) {
        if (h.alpha !== 0) h.setAlpha(0);
      } else {
        if (frameName !== this.lastFrame) {
          h.setFrame(frameName);
          this.lastFrame = frameName;
        }
        const flip = s.flipX;
        const ax = art.anchorX + sh.padL;
        const ay = art.anchorY + sh.padT;
        h.setFlipX(flip);
        h.setOrigin((flip ? sh.fw - ax : ax) / sh.fw, ay / sh.fh);
        h.setPosition(s.x, s.y);
        h.setScale(GLOW_SCALE * s.scaleX, GLOW_SCALE * s.scaleY);
        h.setRotation(s.rotation);
        h.setDepth(s.depth - 0.01);
        const hk = gain * this.layer.groupGain('unit') * lv * this.haloK * (0.85 + 0.15 * m.k) * Math.min(1.25, this.energy);
        h.setAlpha(Math.max(0, Math.min(1, hk)));
      }
    }
    return true;
  }

  private hideAll(): void {
    for (const im of [this.core, this.spill, this.tintImg, this.caustic, this.halo]) if (im && im.alpha !== 0) im.setAlpha(0);
  }

  images(): Img[] {
    return [this.core, this.spill, this.tintImg, this.caustic, this.halo].filter((x): x is Img => !!x);
  }

  destroy(): void {
    this.dead = true;
    for (const im of this.images()) if (im.active) im.destroy();
    this.lvl.flush();
  }
}

/**
 * Build (or get) a cached smooth foot texture: soft contact shadow at the centre +
 * faint warm/slate light pool around its rim (smooth radial alpha, no checkerboard speckles).
 */
function ensureFootTex(scene: Phaser.Scene, rx: number, ry: number): string {
  const key = `light:v3foot:${rx}x${ry}`;
  if (scene.textures.exists(key)) return key;
  const rxP = rx + 12;
  const ryP = ry + 6;
  const W = rxP * 2;
  const H = ryP * 2;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (g) {
    // 1. Outer soft ambient ground shadow around the unit
    g.save();
    g.translate(rxP, ryP);
    g.scale(rxP, ryP);
    const amb = g.createRadialGradient(0, 0, 0.25, 0, 0, 1);
    amb.addColorStop(0, 'rgba(5, 6, 17, 0.55)');
    amb.addColorStop(0.65, 'rgba(5, 6, 17, 0.28)');
    amb.addColorStop(1, 'rgba(5, 6, 17, 0)');
    g.fillStyle = amb;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 2. Faint warm-amber light pool at the unit's feet
    const rxL = Math.max(8, rx + 4);
    const ryL = Math.max(4, ry + 2);
    g.save();
    g.translate(rxP, ryP);
    g.scale(rxL, ryL);
    const pool = g.createRadialGradient(0, 0, 0.15, 0, 0, 1);
    pool.addColorStop(0, 'rgba(235, 188, 118, 0.28)');
    pool.addColorStop(0.65, 'rgba(155, 170, 205, 0.14)');
    pool.addColorStop(1, 'rgba(155, 170, 205, 0)');
    g.fillStyle = pool;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 3. Crisp dark contact shadow core right under the feet (no dither speckles)
    const rxS = Math.max(6, Math.round(rx * 0.82));
    const ryS = Math.max(3, Math.round(ry * 0.82));
    g.save();
    g.translate(rxP, ryP);
    g.scale(rxS, ryS);
    const shd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    shd.addColorStop(0, 'rgba(5, 6, 17, 0.82)');
    shd.addColorStop(0.58, 'rgba(5, 6, 17, 0.48)');
    shd.addColorStop(1, 'rgba(5, 6, 17, 0)');
    g.fillStyle = shd;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  scene.textures.addCanvas(key, cv);
  return key;
}

/** Soft gradient shadows under the duelist podiums (v3 stepped mode); off: the pads atlas paints hard ones. */
const DUELIST_SOFT_SHADOWS = false;

// ---------------------------------------------------------------- stepped unit shadows (pixel compliance pass)
// Arena pass "pixel compliance" (2026-11-06): the unit contact + cast shadows were rgba radial gradients (off-palette
// blur). Now a hard-edged stepped shadow: inside the shadow shape every pixel of whatever is drawn under it (stage
// stone, tile floor, tile line, the unit's light seat) is redrawn ONE (outer band) or TWO (contact core) tones down
// its own PAL ramp — opaque, palette-only, whole pixels, no dither (it lies on the board top).

const RAMP_LIST: readonly (readonly number[])[] = Object.values(RAMPS);
const darkCache = new Map<number, number>();
/** `c` one tone down its PAL ramp (tone 0 → ink); off-palette colours snap to the nearest ramp tone first. */
function darkTone(c: number): number {
  const hit = darkCache.get(c);
  if (hit !== undefined) return hit;
  let out: number = PAL.ink;
  let found = false;
  for (const r of RAMP_LIST) {
    const i = r.indexOf(c);
    if (i >= 0) {
      out = i > 0 ? r[i - 1] : PAL.ink;
      found = true;
      break;
    }
  }
  if (!found && c !== PAL.ink) {
    let best = Infinity;
    for (const r of RAMP_LIST)
      r.forEach((q, i) => {
        const d = (((q >> 16) & 255) - ((c >> 16) & 255)) ** 2 + (((q >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((q & 255) - (c & 255)) ** 2;
        if (d < best) {
          best = d;
          out = i > 0 ? r[i - 1] : PAL.ink;
        }
      });
  }
  darkCache.set(c, out);
  return out;
}

/** RGBA of static texture frames (never of the light layer's own changing canvases). */
const rgbaCache = new Map<string, Uint8ClampedArray | null>();
function framePixels(im: Phaser.GameObjects.Image): Uint8ClampedArray | null {
  const key = im.texture.key;
  const volatile = key.startsWith('light:');
  const ck = `${key}|${im.frame.name}`;
  if (!volatile && rgbaCache.has(ck)) return rgbaCache.get(ck) ?? null;
  const px = frameRGBA(im.frame);
  if (!volatile) rgbaCache.set(ck, px);
  return px;
}

/** Shadow shape of a unit, in levels (0 none, 1 one tone down, 2 two tones down), around the feet at (0, 0). */
interface ShadowShape {
  x0: number;
  y0: number;
  w: number;
  h: number;
  lv: Uint8Array;
}
const shapeCache = new Map<string, ShadowShape>();
function unitShadowShape(rx: number, ry: number, len: number): ShadowShape {
  const sk = `${rx}x${ry}x${len}`;
  const hit = shapeCache.get(sk);
  if (hit) return hit;
  // contact: an iso ellipse round the feet (outer band one tone, the core two); cast: a long ellipse falling down-right
  // along the floor (key light top left; iso: 2 px right per 1 px down), one tone, its near half under the feet two
  const L = Math.max(12, Math.min(40, Math.round(len * 0.55)));
  const ang = Math.atan2(1, 2);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const ccx = ca * L * 0.42;
  const ccy = sa * L * 0.42;
  const a = L * 0.5 + rx * 0.45;
  const b = Math.max(3, rx * 0.3);
  const rxO = rx + 2;
  const ryO = ry + 1;
  const rxC = Math.max(4, Math.round(rx * 0.62));
  const ryC = Math.max(2, Math.round(ry * 0.62));
  const x0 = -rxO - 1;
  const y0 = -ryO - 1;
  const x1 = Math.ceil(ccx + a) + 1;
  const y1 = Math.ceil(Math.max(ryO, ccy + b + a * sa)) + 1;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const lv = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dx = x0 + i + 0.5;
      const dy = y0 + j + 0.5;
      let l = 0;
      if ((dx / rxO) ** 2 + (dy / ryO) ** 2 <= 1) l = 1;
      if ((dx / rxC) ** 2 + (dy / ryC) ** 2 <= 1) l = 2;
      const ux = dx - ccx;
      const uy = dy - ccy;
      const pa = (ux * ca + uy * sa) / a;
      const pb = (-ux * sa + uy * ca) / b;
      if (pa * pa + pb * pb <= 1 && l === 0) l = 1;
      lv[j * w + i] = l;
    }
  const out = { x0, y0, w, h, lv };
  shapeCache.set(sk, out);
  return out;
}

/** The stepped shadow of one unit: an opaque canvas recomputed only when its position or the floor under it changes. */
class StepUnitShadow {
  readonly img: Img;
  private readonly scene: Phaser.Scene;
  private readonly key: string;
  private readonly shape: ShadowShape;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private sig = '';
  private readonly depth: number;
  private static seq = 0;

  /** `img`: an opaque stepped image of the light layer (LightLayer.makeSteppedImage) at the shadow's depth. */
  constructor(scene: Phaser.Scene, img: Img, rx: number, ry: number, len: number) {
    this.scene = scene;
    this.depth = img.depth;
    this.key = `light:v3ushd:${++StepUnitShadow.seq}`;
    this.shape = unitShadowShape(rx, ry, len);
    this.img = img.setOrigin(0).setVisible(false);
  }

  /** The opaque, unscaled images drawn under the shadow box, topmost first. */
  private sources(bx: number, by: number): Phaser.GameObjects.Image[] {
    const { w, h } = this.shape;
    const out: Phaser.GameObjects.Image[] = [];
    const list = this.scene.children.list;
    for (const o of list) {
      if (!(o instanceof Phaser.GameObjects.Image) || o === this.img) continue;
      if (!o.visible || !o.active || o.depth >= this.depth || o.alpha < 0.99) continue;
      if (o.blendMode !== Phaser.BlendModes.NORMAL && o.blendMode !== 0) continue;
      if (o.scaleX !== 1 || o.scaleY !== 1 || o.angle !== 0 || o.isTinted || o.flipX || o.flipY || o.scrollFactorX !== 1) continue;
      if (o.texture.key === '__DEFAULT' || o.texture.key === '__MISSING' || o.texture.key.startsWith('light:v3ushd')) continue;
      const ix = Math.round(o.x - o.displayOriginX);
      const iy = Math.round(o.y - o.displayOriginY);
      if (ix >= bx + w || iy >= by + h || ix + o.frame.realWidth <= bx || iy + o.frame.realHeight <= by) continue;
      out.push(o);
    }
    // the display list is depth-sorted at render: same order here (stable for equal depths), topmost first
    return out.map((o, i) => ({ o, i })).sort((p, q) => q.o.depth - p.o.depth || q.i - p.i).map((p) => p.o);
  }

  /** Place the shadow with the feet at (fx, fy) (whole pixels); hide with show = false. */
  update(fx: number, fy: number, show: boolean): void {
    if (!show) {
      this.img.setVisible(false);
      return;
    }
    const { x0, y0, w, h, lv } = this.shape;
    const bx = fx + x0;
    const by = fy + y0;
    const src = this.sources(bx, by);
    const sig = `${bx},${by}|` + src.map((o) => `${o.texture.key}:${o.frame.name}:${Math.round(o.x)},${Math.round(o.y)}:${stepImgRev.get(o) ?? 0}`).join(';');
    if (sig !== this.sig) {
      this.sig = sig;
      const data = new Uint8ClampedArray(w * h * 4);
      const pix = src.map((o) => ({
        px: framePixels(o),
        ix: Math.round(o.x - o.displayOriginX),
        iy: Math.round(o.y - o.displayOriginY),
        fw: o.frame.realWidth,
        fh: o.frame.realHeight,
      }));
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const l = lv[j * w + i];
          if (!l) continue;
          const sx = bx + i;
          const sy = by + j;
          let c = -1;
          for (const s of pix) {
            if (!s.px) continue;
            const u = sx - s.ix;
            const v = sy - s.iy;
            if (u < 0 || v < 0 || u >= s.fw || v >= s.fh) continue;
            const q = (v * s.fw + u) * 4;
            if (s.px[q + 3] < 128) continue;
            c = (s.px[q] << 16) | (s.px[q + 1] << 8) | s.px[q + 2];
            break;
          }
          if (c < 0) continue;
          let d = darkTone(c);
          if (l === 2) d = darkTone(d);
          const o = (j * w + i) * 4;
          data[o] = (d >> 16) & 255;
          data[o + 1] = (d >> 8) & 255;
          data[o + 2] = d & 255;
          data[o + 3] = 255;
        }
      if (!this.tex) {
        this.tex = this.scene.textures.createCanvas(this.key, w, h);
        if (!this.tex) return;
        this.img.setTexture(this.key);
      }
      const ctx = this.tex.getContext();
      ctx.clearRect(0, 0, w, h);
      ctx.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
      this.tex.refresh();
    }
    this.img.setPosition(bx, by).setVisible(true);
  }

  destroy(): void {
    if (this.img.active) this.img.destroy();
    if (this.tex) this.scene.textures.remove(this.key);
    this.tex = null;
  }
}

/** Wide soft drop shadow on the board floor under a monster card/unit or duelist podium. */
function ensureFloorShadowTex(scene: Phaser.Scene, rx: number, ry: number): string {
  const key = `light:v3floorshd:${rx}x${ry}`;
  if (scene.textures.exists(key)) return key;
  const W = rx * 2;
  const H = ry * 2;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (g) {
    g.save();
    g.translate(rx, ry);
    g.scale(rx, ry);
    const shd = g.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    shd.addColorStop(0, 'rgba(4, 5, 14, 0.76)');
    shd.addColorStop(0.55, 'rgba(4, 5, 14, 0.42)');
    shd.addColorStop(0.82, 'rgba(4, 5, 14, 0.16)');
    shd.addColorStop(1, 'rgba(4, 5, 14, 0)');
    g.fillStyle = shd;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  scene.textures.addCanvas(key, cv);
  return key;
}

/**
 * Build (or get) a cached 1-px subtle top-left rim highlight texture for a sprite frame,
 * reading its pixels via frameRGBA() without modifying any monster sprite art.
 */
function ensureRimTex(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite): string | null {
  const f = s.frame;
  const texKey = s.texture?.key;
  if (!f || !texKey) return null;
  const key = `light:v3rim:${texKey}:${f.name}:${s.flipX ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const rgba = frameRGBA(f);
  if (!rgba) return null;
  const w = f.realWidth;
  const h = f.realHeight;
  const p = new PixelCanvas(w, h);
  // In frame space, screen-left is -1 when not flipped, +1 when flipX is true
  const dirX = s.flipX ? 1 : -1;
  const maxY = Math.round(h * 0.72);
  const aAt = (x: number, y: number): number => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    return rgba[(y * w + x) * 4 + 3];
  };
  const cAt = (x: number, y: number): number => {
    const i = (y * w + x) * 4;
    return (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
  };
  for (let y = 1; y < maxY; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (aAt(x, y) < 250) continue;
      const c = cAt(x, y);
      // Do not overwrite the 1-px ink silhouette outline itself; check pixels just inside the top-left silhouette
      if (c === PAL.ink) continue;
      const outTL = aAt(x + dirX, y - 1) === 0 || (cAt(x + dirX, y - 1) === PAL.ink && aAt(x + 2 * dirX, y - 2) === 0);
      const outT = aAt(x, y - 1) === 0 || (cAt(x, y - 1) === PAL.ink && aAt(x, y - 2) === 0);
      if ((outTL || outT) && ((x + y) & 1) === 0) {
        p.set(x, y, PAL.skin3);
      }
    }
  }
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

// ---------------------------------------------------------------- arena v4 step 2: the monsters pop (owner, hedef-gorunum-4-isik)
// The arena's veils (src/view/board-nt/glow.ts) push the floor down to dark cool tones; each monster on the board gets
//   - a thin RIM light on its BACK edge in its owner's colour (P1 cyan, P2 crimson): the 1-px band just inside the ink outline
//     on the side it turns its back to (frame space −x for every monster: they are drawn facing right and P2 is flipX), down to
//     its feet; baked per sheet frame + colour from the frame's own pixels and laid over the sprite with its exact transform,
//     so it follows every frame (idle, attack, summon) and is hidden while the sprite is masked, piped, flash-filled or gone;
//   - a crisp dark CONTACT shadow: hard-edged multiply bands (no dither, no gradient) — a dark core under the feet, a lighter
//     contact ring and a short cast tail down-right (key light top-left). Multiply composes with whatever light lies under it
//     (the veil, the zone glow, the seat), which the old re-coloured opaque shadow could not;
//   - a light POOL on its tile in its OWNER's colour (the seat, two steps in the core): the board reads as two lit camps, the
//     colour ties each monster to its side even for a mirrored P2 sprite, and an attribute pool would repeat the colour the
//     monster already carries in its own palette and summon FX (a FIRE monster on an orange pool loses its silhouette).
export const UNIT_LIGHT_V4 = BOARD_V4 && LOOK_V3;
const OWNER_LIGHT: readonly [number, number] = [PAL.cyan3, PAL.crim3];
const OWNER_RIM: readonly [number, number] = [PAL.cyan3, PAL.crim3];
/** Multiply factors (0xRRGGBB) of the contact shadow bands: core, contact ring, cast tail. */
const SHADOW_MUL = [0, 0x2e2c3e, 0x6a6880, 0x8a88a0] as const;

interface MulShadow {
  key: string;
  x0: number;
  y0: number;
}
const mulShadowCache = new Map<string, MulShadow>();
/** The v4 contact shadow of a unit (feet at (0, 0)): a cached multiply texture of hard-edged bands. */
function ensureMulShadowTex(scene: Phaser.Scene, rx: number, ry: number, len: number): MulShadow {
  const sk = `${rx}x${ry}x${len}`;
  const key = `light:v4shd:${sk}`;
  const hit = mulShadowCache.get(sk);
  if (hit && scene.textures.exists(key)) return hit;
  const rxO = rx + 1;
  const ryO = ry + 1;
  const rxC = Math.max(4, Math.round(rx * 0.6));
  const ryC = Math.max(2, Math.round(ry * 0.6));
  // a short cast tail down-right along the floor (iso: 2 px right per px down)
  const L = Math.max(8, Math.min(22, Math.round(len * 0.3)));
  const ang = Math.atan2(1, 2);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const ccx = ca * L * 0.5;
  const ccy = sa * L * 0.5;
  const a = L * 0.5 + rx * 0.5;
  const b = Math.max(3, ry * 0.75);
  const x0 = -rxO - 1;
  const y0 = -ryO - 1;
  const x1 = Math.ceil(ccx + a) + 1;
  const y1 = Math.ceil(Math.max(ryO, ccy + b + a * sa)) + 1;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const p = new PixelCanvas(w, h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dx = x0 + i + 0.5;
      const dy = y0 + j + 0.5;
      let l = 0;
      const ux = dx - ccx;
      const uy = dy - ccy;
      const pa = (ux * ca + uy * sa) / a;
      const pb = (-ux * sa + uy * ca) / b;
      if (pa * pa + pb * pb <= 1) l = 3;
      if ((dx / rxO) ** 2 + (dy / ryO) ** 2 <= 1) l = 2;
      if ((dx / rxC) ** 2 + (dy / ryC) ** 2 <= 1) l = 1;
      // pure white = no change under multiply (the texture is opaque: light-layer factors, not art colours)
      p.set(i, j, l ? SHADOW_MUL[l] : 0xffffff);
    }
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, p.toCanvas());
  const out = { key, x0, y0 };
  mulShadowCache.set(sk, out);
  return out;
}

/** The v4 tile pool of a unit: a flat-banded iso ellipse (ADD), centred in the texture, in `color` × the band levels. */
function ensurePoolTexV4(scene: Phaser.Scene, rx: number, ry: number, color: number): string {
  const key = `light:v4pool:${rx}x${ry}:${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const w = rx * 2;
  const h = ry * 2;
  const p = new PixelCanvas(w, h);
  const r0 = (color >> 16) & 255;
  const g0 = (color >> 8) & 255;
  const b0 = color & 255;
  const BANDS = [0.62, 0.62, 0.4, 0.22];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dx = (i + 0.5 - rx) / rx;
      const dy = (j + 0.5 - ry) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      const k = BANDS[Math.min(BANDS.length - 1, Math.floor(d * BANDS.length))];
      p.set(i, j, (Math.round(r0 * k) << 16) | (Math.round(g0 * k) << 8) | Math.round(b0 * k));
    }
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

/**
 * The v4 back-edge rim of a sprite frame in `color`: the opaque, non-ink pixels whose back neighbour (frame −x, or −x −y) is
 * outside the silhouette or its 1-px ink outline. Read from the frame's pixels (no monster art is touched); cached per frame.
 */
function ensureRimTexV4(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, color: number): string | null {
  const f = s.frame;
  const texKey = s.texture?.key;
  if (!f || !texKey) return null;
  const key = `light:v4rim:${texKey}:${f.name}:${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const rgba = frameRGBA(f);
  if (!rgba) return null;
  const w = f.realWidth;
  const h = f.realHeight;
  const p = new PixelCanvas(w, h);
  const aAt = (x: number, y: number): number => (x < 0 || x >= w || y < 0 || y >= h ? 0 : rgba[(y * w + x) * 4 + 3]);
  const cAt = (x: number, y: number): number => {
    const i = (y * w + x) * 4;
    return (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
  };
  // outside: transparent, or the ink outline with transparency right behind it
  const out = (x: number, y: number, dx: number, dy: number): boolean => aAt(x, y) < 128 || (cAt(x, y) === PAL.ink && aAt(x + dx, y + dy) < 128);
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (aAt(x, y) < 250) continue;
      if (cAt(x, y) === PAL.ink) continue;
      if (out(x - 1, y, -1, 0) || out(x - 1, y - 1, -1, -1)) {
        p.set(x, y, color);
        n++;
      }
    }
  scene.textures.addCanvas(key, p.toCanvas());
  void n;
  return key;
}

/**
 * Stepped mode: a monster's own light is ONE flat seat on its pad (the still's drawLights: the
 * wyrm's cyan seat, the magus' violet one) — its glow colour (MONSTER_GLOW spill, else the
 * attribute light), one step, centred under the sprite's ground point at whole pixels, PLUS
 * a soft opaque contact shadow + faint light pool at the unit's feet and a subtle top-left rim
 * highlight on the unit via the light layer.
 */
class SteppedUnitLight {
  readonly unit: MonsterUnit;
  private readonly scene: Phaser.Scene;
  private readonly patch: StepPatch;
  /** The stepped re-coloured shadow (v3 before arena v4); null in arena v4 (mulShadow). */
  private readonly shadow: StepUnitShadow | null;
  /** Arena v4: the hard-edged multiply contact shadow. */
  private readonly mulShadow: Img | null;
  private readonly mulTex: MulShadow | null;
  /** Arena v4: the owner-colour light pool on the tile (ADD, over the card lying on the tile, under the shadow). */
  private readonly pool: Img | null;
  private poolKey = '';
  private readonly rimImg: Img;
  private readonly lvl = new Ramp(0);
  private readonly color: number;
  private readonly rx: number;
  private readonly ry: number;
  private shown = true;
  dead = false;

  constructor(layer: LightLayer, unit: MonsterUnit) {
    this.unit = unit;
    this.scene = layer.scene;
    const al = ATTRIBUTE_LIGHT[unit.attribute];
    this.color = monsterGlow(unit.cardId)?.spill ?? al.color;
    let ow = opaqueW.get(unit.cardId);
    if (!ow) {
      const b = monsterFrame(unit.cardId, 'idle', 0).bounds();
      ow = b ? { w: b.w, h: b.h } : { w: 32, h: 32 };
      opaqueW.set(unit.cardId, ow);
    }
    // the still: wyrm (≈ 60 px wide) 22 × 8, magus (≈ 40 px) 16 × 6
    this.rx = Math.round(Math.max(12, Math.min(24, ow.w * 0.36)));
    this.ry = Math.max(4, Math.round(this.rx * 0.37));
    this.patch = layer.makePatch();
    if (UNIT_LIGHT_V4) {
      // arena v4 step 2: a crisp multiply contact shadow (see UNIT_LIGHT_V4); the contact ellipse a little tighter than the seat
      this.shadow = null;
      this.mulTex = ensureMulShadowTex(this.scene, Math.max(8, this.rx - 3), Math.max(3, this.ry - 1), ow.h);
      this.mulShadow = layer.makeSteppedImage(this.mulTex.key, DEPTH.SHADOW + 0.05).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.pool = layer.makeSteppedImage('__DEFAULT', DEPTH.SHADOW - 1).setBlendMode(Phaser.BlendModes.ADD);
    } else {
      // readability pass: a long cast shadow falling down-right from the feet (key light top left)
      // pixel compliance pass: contact + cast shadow are one stepped, palette-only shadow (StepUnitShadow)
      this.shadow = new StepUnitShadow(this.scene, layer.makeSteppedImage('__DEFAULT', DEPTH.SHADOW + 0.05), this.rx, this.ry, ow.h);
      this.mulShadow = null;
      this.mulTex = null;
      this.pool = null;
    }
    this.rimImg = layer.makeSteppedImage('__DEFAULT', unit.sprite.depth + 0.01);
  }

  private hideFoot(): void {
    this.shadow?.update(0, 0, false);
    this.mulShadow?.setVisible(false);
    this.pool?.setVisible(false);
  }

  tick(dt: number, _t: number, gain: number, onField: boolean, layer: LightLayer): boolean {
    const u = this.unit;
    const s = u.sprite;
    let vis = 0;
    if ((onField || (s.active && !u.retired)) && s.active && !u.retired && s.visible) vis = Math.min(1, s.alpha);
    if (Math.abs(this.lvl.target - vis) > 0.01) void this.lvl.set(vis, vis > this.lvl.v ? 240 : 200, (x) => x);
    this.lvl.step(dt);
    const lv = this.lvl.v;
    if (!onField && lv <= 0.003 && vis <= 0.003) return false;
    if (!s.active) {
      this.patch.draw([]);
      this.hideFoot();
      this.rimImg.setVisible(false);
      return lv > 0.003 && onField;
    }
    const air = u.art.hover + u.lift;
    const level = quantize(gain * layer.groupGain('unit') * lv / (1 + air / 45));
    const groundY = s.y + u.art.hover * Math.abs(s.scaleY) + u.lift;
    // lit from the top-left: the seat sits a hair right of the anchor, like the still's seats
    const cx = Math.round(s.x + (u.flipX ? -1 : 1) * 2);
    const cy = Math.round(groundY - 1);
    if (UNIT_LIGHT_V4 && this.pool) {
      // the owner-colour pool on the tile: it lies OVER the card on the tile (an opaque seat under the card never showed),
      // flat bands, fading with the unit (alpha = its light level) and shrinking as it lifts off
      const k = Math.min(1, gain * layer.groupGain('unit') * lv / (1 + air / 30));
      if (this.shown && s.visible && !u.retired && k > 0.02) {
        const rx = this.rx + 6;
        const key = ensurePoolTexV4(this.scene, rx, Math.max(5, Math.round(rx / 2)), OWNER_LIGHT[u.player]);
        if (key !== this.poolKey) {
          this.poolKey = key;
          this.pool.setTexture(key);
        }
        this.pool.setPosition(cx, cy).setAlpha(Math.round(k * 4) / 4).setVisible(true);
      } else this.pool.setVisible(false);
    } else this.patch.draw(level > 0 ? [{ kind: 'ellipse', cx, cy, rx: this.rx, ry: this.ry, level: Math.min(1, level), hue: this.color, core: 0 }] : []);

    // Replace MonsterUnit's checkerboard dither shadow with smooth radial contact shadow + floor shadow + light pool
    if (u.shadow?.active) u.shadow.setAlpha(0);
    const showFoot = this.shown && s.visible && !u.retired && lv > 0.25 && u.lift < 28;
    if (this.mulShadow && this.mulTex) {
      if (showFoot) this.mulShadow.setPosition(Math.round(s.x) + this.mulTex.x0, Math.round(groundY) + this.mulTex.y0).setVisible(true);
      else this.mulShadow.setVisible(false);
    } else this.shadow?.update(Math.round(s.x), Math.round(groundY), showFoot);

    if (UNIT_LIGHT_V4) {
      this.syncRim();
      return true;
    }

    // Subtle 1-px top-left rim on the unit sprite
    const showRim = this.shown && s.visible && !u.retired && s.alpha >= 0.99 && !s.isCropped && s.scaleX === 1 && s.scaleY === 1 && s.angle === 0;
    if (showRim) {
      const rimKey = ensureRimTex(this.scene, s);
      if (rimKey) {
        if (this.rimImg.texture.key !== rimKey) this.rimImg.setTexture(rimKey);
        this.rimImg
          .setOrigin(s.originX, s.originY)
          .setFlipX(s.flipX)
          .setPosition(Math.round(s.x), Math.round(s.y))
          .setDepth(s.depth + 0.01)
          .setVisible(true);
      } else {
        this.rimImg.setVisible(false);
      }
    } else {
      this.rimImg.setVisible(false);
    }

    return true;
  }

  /**
   * Arena v4: lay the owner-colour back rim over the sprite with its exact transform (frame, flip, origin, position, scale,
   * angle, alpha, depth). Called from tick and again right before the camera renders (LightLayer: main camera PRE_RENDER),
   * so a cinematic that moves / re-frames the sprite late in the frame (claim pins, PRE_RENDER) never leaves the rim behind.
   * Hidden while the sprite is masked, runs a post pipeline (the hologram materialise), shows a flash fill or a crop.
   */
  syncRim(): void {
    const u = this.unit;
    const s = u.sprite;
    const rim = this.rimImg;
    if (!rim.active) return;
    const piped = (s as unknown as { postPipelines?: unknown[] }).postPipelines?.length ?? 0;
    const flash = s.isTinted && (s as unknown as { tintFill?: boolean }).tintFill === true;
    const show = this.shown && s.active && s.visible && !u.retired && s.alpha > 0.05 && !s.isCropped && !s.mask && !piped && !flash;
    if (!show) {
      if (rim.visible) rim.setVisible(false);
      return;
    }
    const key = ensureRimTexV4(this.scene, s, OWNER_RIM[u.player]);
    if (!key) {
      rim.setVisible(false);
      return;
    }
    if (rim.texture.key !== key) rim.setTexture(key);
    rim
      .setOrigin(s.originX, s.originY)
      .setFlipX(s.flipX)
      .setFlipY(s.flipY)
      .setPosition(s.x, s.y)
      .setScale(s.scaleX, s.scaleY)
      .setAngle(s.angle)
      .setAlpha(s.alpha)
      .setScrollFactor(s.scrollFactorX, s.scrollFactorY)
      .setDepth(s.depth + 0.01)
      .setVisible(true);
  }

  images(): Img[] {
    const out = [this.patch.img, this.rimImg];
    if (this.shadow) out.push(this.shadow.img);
    if (this.mulShadow) out.push(this.mulShadow);
    if (this.pool) out.push(this.pool);
    return out;
  }

  setShown(on: boolean): void {
    this.shown = on;
    this.patch.setShown(on);
    if (!on) {
      this.hideFoot();
      this.rimImg.setVisible(false);
    }
  }

  pixels(): number {
    return this.patch.pixels;
  }

  destroy(): void {
    this.dead = true;
    this.patch.destroy();
    this.shadow?.destroy();
    if (this.mulShadow?.active) this.mulShadow.destroy();
    if (this.pool?.active) this.pool.destroy();
    if (this.rimImg.active) this.rimImg.destroy();
    this.lvl.flush();
  }
}

/** World point of a frame pixel of a plain (container-less) sprite. */
function framePoint(s: Phaser.GameObjects.Sprite, fx: number, fy: number): XY {
  const f = s.frame;
  const lx = ((s.flipX ? f.realWidth - fx : fx) - s.displayOriginX) * s.scaleX;
  const ly = ((s.flipY ? f.realHeight - fy : fy) - s.displayOriginY) * s.scaleY;
  const r = s.rotation;
  if (!r) return { x: s.x + lx, y: s.y + ly };
  const c = Math.cos(r);
  const sn = Math.sin(r);
  return { x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c };
}

/** Faint glow under face-up spell / trap / field cards lying on their tiles. */
class TileLight {
  readonly entry: ZoneEntry;
  private readonly img: Img;
  private readonly lvl = new Ramp(0);
  private readonly ph = nextPhase();

  constructor(layer: LightLayer, entry: ZoneEntry) {
    this.entry = entry;
    this.img = layer.makeImage(LT.radial, LIGHT_DEPTH.FLOOR - 0.02, 'screen');
  }

  tick(dt: number, t: number, gain: number, present: boolean, layer: LightLayer): boolean {
    const e = this.entry;
    const tile = e.tile;
    const def = CARDS[e.cardId];
    const lit = present && !tile.dead && tile.faceUp && !!def && !isMonster(def);
    const want = lit ? 1 : 0;
    if (Math.abs(this.lvl.target - want) > 0.01) void this.lvl.set(want, lit ? 420 : 260);
    this.lvl.step(dt);
    if (!present && this.lvl.v <= 0.003) return false;
    const color = def && def.kind === 'trap' ? PAL.mag3 : e.spot === 'field' ? fieldColor(e.cardId) : PAL.teal3;
    const k = gain * layer.groupGain('ambient') * this.lvl.v * (1 + 0.12 * Math.sin(t * 1.9 + this.ph));
    place(this.img, tile.home.x, tile.home.y, 30, 15, color, 0.16 * k);
    return true;
  }

  destroy(): void {
    if (this.img.active) this.img.destroy();
  }
}

function fieldColor(id: string): number {
  return id === 'volcano_arena' ? PAL.fire3 : PAL.teal3;
}

/**
 * Build (or get) the key-light wash of the v3 platform top. Arena pass "board top" (2026-11-05, owner: calm clean dark
 * slate, hedef-gorunum-3): ONE flat, palette-coloured (skin2) wash at a single low alpha, clipped to the plate's top
 * octagon 3 px inside the gold bevel — no radial gradient, no amber pool. It lies UNDER the zone tiles (see the
 * depth below), so the inset tiles and their 1-px neon borders stay exact palette pixels and read one step darker
 * than the lit stage stone around them.
 */
const KEY_WASH = { color: PAL.skin2, alpha: 0.22 } as const;
/**
 * Board-top critique round 2 (2026-11-05): the warm wash turned the slab mauve-brown (≈100/81/81) against the target's
 * cool dark slate; the slab's light falloff is now one hard-edged palette band in the platform atlas instead
 * (art/arena-nt/platform.ts topTone), so the wash is off (kept for A/B).
 */
const KEY_WASH_ON = false;
function ensureKeyLightTex(scene: Phaser.Scene): string {
  const key = 'light:v3keywash2';
  if (scene.textures.exists(key)) return key;
  const OX = PLATE_X0;
  const OY = PLATE_Y0;
  const W = PLATE_X1 - PLATE_X0;
  const H = PLATE_Y1 - PLATE_Y0;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;
    const poly = PLATE_OUTLINE.map(([c, r]) => ntIso(c, r));
    const inside = (x: number, y: number): boolean => {
      let k = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) k = !k;
      }
      return k;
    };
    const cr = (KEY_WASH.color >> 16) & 255;
    const cg = (KEY_WASH.color >> 8) & 255;
    const cb = KEY_WASH.color & 255;
    const al = Math.round(KEY_WASH.alpha * 255);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sx = OX + x + 0.5;
        const sy = OY + y + 0.5;
        if (!(inside(sx - 4, sy) && inside(sx + 4, sy) && inside(sx, sy - 3) && inside(sx, sy + 3))) continue;
        const idx = (y * W + x) * 4;
        data[idx] = cr;
        data[idx + 1] = cg;
        data[idx + 2] = cb;
        data[idx + 3] = al;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  scene.textures.addCanvas(key, cv);
  return key;
}

// ====================================================================== the layer

export interface LightLayerOpts {
  /** Start enabled (default true; ?light=0 starts it off). */
  enabled?: boolean;
  /** Overall gain (default 1; ?lightgain=k). */
  gain?: number;
  /** Stepped mode (flat tone steps on the pads, no alpha; see the header). Default: the v3 look. */
  stepped?: boolean;
}

export class LightLayer {
  readonly scene: Phaser.Scene;
  private readonly lights = new Set<LightBase>();
  private readonly unitLights = new Map<MonsterUnit, UnitLight>();
  private readonly steppedUnits = new Map<MonsterUnit, SteppedUnitLight>();
  private readonly steppedStaticImgs: Img[] = [];
  /** Stepped mode (v3 look): flat tone steps on the pads instead of soft blended light. */
  readonly stepped: boolean;
  private readonly tileLights = new Map<ZoneEntry, TileLight>();
  private field: LightFieldSource | null = null;
  private readonly dim = new Ramp(0);
  private readonly groups: Record<LightGroup, Ramp> = {
    flood: new Ramp(1),
    neon: new Ramp(1),
    ambient: new Ramp(1),
    unit: new Ramp(1),
    fx: new Ramp(1),
  };
  private readonly veil: Phaser.GameObjects.Rectangle;
  private readonly wash: Phaser.GameObjects.Rectangle;
  private t = 0;
  private lastTime = -1;
  private on: boolean;
  gain: number;
  private destroyed = false;
  private readonly onUpdate: (time: number, delta: number) => void;
  private readonly onShutdown: () => void;
  private rimCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private readonly onRimSync = (): void => {
    for (const sl of this.steppedUnits.values()) {
      try {
        sl.syncRim();
      } catch (e) {
        console.error('[light] rim sync failed', e);
      }
    }
  };
  private readonly onKey: ((e: KeyboardEvent) => void) | null = null;
  /** Called when the layer is destroyed (index.ts clears its registry). */
  onDestroy: (() => void) | null = null;

  constructor(scene: Phaser.Scene, o: LightLayerOpts = {}) {
    this.scene = scene;
    this.stepped = o.stepped ?? LOOK_V3;
    // the soft glow textures exist only for the soft mode
    if (!this.stepped) ensureLightTextures(scene);
    this.on = o.enabled ?? true;
    this.gain = o.gain ?? 1;
    const pad = 48;
    this.veil = scene.add
      .rectangle(-pad, -pad, GAME_W + pad * 2, GAME_H + pad * 2, PAL.night1, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(LIGHT_DEPTH.DIM)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(0)
      .setVisible(false);
    this.wash = scene.add
      .rectangle(-pad, -pad, GAME_W + pad * 2, GAME_H + pad * 2, PAL.mist, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(LIGHT_DEPTH.DIM + 0.01)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setVisible(false);
    this.excludeUi(this.veil);
    this.excludeUi(this.wash);
    if (this.stepped) {
      // Smooth top-left warm key-light wash on the board floor + duelist foot contact shadows & faint light pools
      try {
        if (KEY_WASH_ON) {
          const keyTex = ensureKeyLightTex(scene);
          // under the zone tiles (nt:floor slots at NT_DEPTH.floor + 0.25), over the platform body (NT_DEPTH.platform)
          const keyImg = this.makeSteppedImage(keyTex, NT_DEPTH.platform + 0.6);
          keyImg.setOrigin(0).setPosition(PLATE_X0, PLATE_Y0).setVisible(this.on);
          this.steppedStaticImgs.push(keyImg);
        }
        // Duelist podiums: their contact / cast shadow is now hard, flat palette bands painted in the pads atlas
        // (art/arena-nt/pads.ts) — the soft radial gradients here read as blur (arena pass, podium critique 1).
        const padShdTex = ensureFloorShadowTex(scene, 34, 18);
        const dFootTex = ensureFootTex(scene, 14, 7);
        for (const p of DUELIST_SOFT_SHADOWS ? ([0, 1] as const) : []) {
          const xy = duelistXY(p);
          const pShd = this.makeSteppedImage(padShdTex, DEPTH.PLATFORM + 8.5);
          pShd.setPosition(Math.round(xy.x + 2), Math.round(xy.y + 4)).setVisible(this.on);
          this.steppedStaticImgs.push(pShd);
          const dImg = this.makeSteppedImage(dFootTex, DEPTH.SHADOW + 0.1);
          dImg.setPosition(Math.round(xy.x), Math.round(xy.y)).setVisible(this.on);
          this.steppedStaticImgs.push(dImg);
        }
      } catch {
        // Ignore in headless stub tests without full canvas support
      }
    }
    // raw frame time (not Phaser's smoothed delta: its history spikes after a stall / under the
    // stepped test clock, while tweens run on their own clock)
    // (While the loop sleeps — the stepped QA clock of main.ts / tools/measure.mjs — the step's
    // own delta is exact: use it, so films do not depend on the clock's absolute values.)
    this.onUpdate = (time, delta) => {
      const raw = this.lastTime < 0 || !scene.game.loop.running ? delta : time - this.lastTime;
      this.lastTime = time;
      this.update(raw);
    };
    this.onShutdown = () => this.destroy();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onUpdate);
    // arena v4: the monster rims follow their sprites to the last moment before the main camera draws (after every PRE_RENDER pin)
    if (this.stepped && UNIT_LIGHT_V4) {
      this.rimCam = scene.cameras?.main ?? null;
      this.rimCam?.on(Phaser.Cameras.Scene2D.Events.PRE_RENDER, this.onRimSync);
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown);
    if (import.meta.env?.DEV) {
      this.onKey = (e: KeyboardEvent) => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'l' || e.key === 'L') {
          const tgt = e.target as HTMLElement | null;
          if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
          this.setEnabled(!this.on);
          console.log(`[light] ${this.on ? 'on' : 'off'}`);
        }
      };
      window.addEventListener('keydown', this.onKey);
    }
  }

  // ---------------------------------------------------------------- state

  get enabled(): boolean {
    return this.on;
  }

  setEnabled(on: boolean): void {
    this.on = on;
    if (!on) {
      for (const im of this.allImages()) im.setVisible(false);
      this.veil.setVisible(false);
      this.wash.setVisible(false);
    } else {
      for (const im of this.allImages()) im.setVisible(true);
    }
    // stepped patches show only when they hold pixels
    for (const l of this.lights) l.setVisibleAll(on);
    for (const u of this.steppedUnits.values()) u.setShown(on);
    for (const im of this.steppedStaticImgs) im.setVisible(on);
  }

  /** Current dim level (−1 brighten … 0 normal … 1 dramatic dim). */
  get dimLevel(): number {
    return this.dim.v;
  }

  setDim(level: number, ms = 350): Promise<void> {
    return this.dim.set(Math.max(-1, Math.min(1, level)), ms, (x) => x * x * (3 - 2 * x));
  }

  /** User gain of a light group (multiplies on top of the dim response), eased over ms. */
  setGroup(group: LightGroup, k: number, ms = 0): Promise<void> {
    return this.groups[group].set(Math.max(0, k), ms);
  }

  groupGain(group: LightGroup): number {
    return this.groups[group].v * dimFactor(group, this.dim.v);
  }

  /** The units (and tiles) to light — FieldView. */
  bindField(field: LightFieldSource | null): void {
    this.field = field;
  }

  // ---------------------------------------------------------------- factories

  pool(x: number, y: number, o: PoolOpts = {}): PoolLight {
    return this.track(new PoolLight(this, x, y, o, o.group ?? 'fx'));
  }

  flash(x: number, y: number, color: number, radius: number, ms: number, o: FlashOpts = {}): FlashLight {
    return this.track(new FlashLight(this, x, y, color, radius, ms, o));
  }

  beam(from: XY, to: XY, color: number, ms: number, o: BeamOpts = {}, group: LightGroup = 'fx'): BeamLight {
    return this.track(new BeamLight(this, from, to, color, ms, o, group));
  }

  private track<T extends LightBase>(l: T): T {
    if (this.destroyed) {
      l.destroy();
      return l;
    }
    this.lights.add(l);
    if (!this.on) l.setVisibleAll(false);
    return l;
  }

  /** Internal: lights unregister themselves when destroyed. */
  forget(l: LightBase): void {
    this.lights.delete(l);
  }

  /** Internal (stepped mode): a light's floor patch (hidden until its light draws it). */
  makePatch(): StepPatch {
    const p = new StepPatch(this.scene);
    this.excludeUi(p.img);
    if (!this.on) p.setShown(false);
    return p;
  }

  /** Internal (stepped mode): an opaque palette-only image at `depth` (no alpha, no blend). */
  makeSteppedImage(tex: string, depth: number): Img {
    const im = this.scene.add.image(-999, -999, tex).setDepth(depth).setVisible(false);
    this.excludeUi(im);
    return im;
  }

  /** Internal: a light image at `depth` (hidden until its light renders it). */
  makeImage(tex: string, depth: number, blend: LightBlend, frame?: string | number): Img {
    const im = this.scene.add
      .image(-999, -999, tex, frame)
      .setDepth(depth)
      .setBlendMode(blend === 'add' ? Phaser.BlendModes.ADD : blend === 'multiply' ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.SCREEN)
      .setAlpha(0);
    this.excludeUi(im);
    if (!this.on) im.setVisible(false);
    return im;
  }

  private excludeUi(o: Phaser.GameObjects.GameObject): void {
    // CameraRig's UI camera renders only the HUD band; keep light off it from the first frame
    const ui = this.scene.cameras.getCamera('ui');
    if (ui) (o as unknown as { cameraFilter: number }).cameraFilter = ui.id;
  }

  private allImages(): Img[] {
    const out: Img[] = [...this.steppedStaticImgs];
    for (const l of this.lights) out.push(...(l as unknown as { imgs: Img[] }).imgs);
    for (const u of this.unitLights.values()) out.push(...u.images());
    for (const u of this.steppedUnits.values()) out.push(...u.images());
    for (const tl of this.tileLights.values()) out.push((tl as unknown as { img: Img }).img);
    return out;
  }

  // ---------------------------------------------------------------- frame

  private update(delta: number): void {
    if (this.destroyed) return;
    const ts = this.scene.time.timeScale;
    const dt = Math.max(0, Math.min(100, delta)) * ts;
    this.t += dt;
    const t = this.t / 1000;
    this.dim.step(dt);
    for (const g of Object.values(this.groups)) g.step(dt);
    const gain = this.gain;
    for (const l of [...this.lights]) l.tick(dt, t, gain);
    if (this.stepped) {
      // stepped: monster seats + foot pools + top-left rim (no tile glows, no dim veil / wash: no alpha anywhere)
      this.updateSteppedUnits(dt, t, gain);
      return;
    }
    this.updateUnits(dt, t, gain);
    this.updateTiles(dt, t, gain);
    // dim veil / brighten wash
    const d = this.dim.v;
    if (this.on && d > 0.001) {
      this.veil.setVisible(true).setAlpha(Math.min(0.85, 0.62 * d));
    } else if (this.veil.visible) this.veil.setVisible(false);
    if (this.on && d < -0.001) {
      this.wash.setVisible(true).setAlpha(Math.min(0.2, 0.075 * -d));
    } else if (this.wash.visible) this.wash.setVisible(false);
  }

  private updateUnits(dt: number, t: number, gain: number): void {
    const seen = new Set<MonsterUnit>();
    let units: MonsterUnit[] = [];
    try {
      units = this.field?.units() ?? [];
    } catch {
      units = [];
    }
    for (const u of units) {
      seen.add(u);
      if (!this.unitLights.has(u) && u.sprite?.active && !u.retired) {
        const ul = new UnitLight(this, u);
        if (!this.on) for (const im of ul.images()) im.setVisible(false);
        this.unitLights.set(u, ul);
      }
    }
    for (const [u, ul] of this.unitLights) {
      let alive = false;
      try {
        alive = ul.tick(dt, t, gain, seen.has(u));
      } catch (e) {
        console.error('[light] unit light failed', e);
      }
      if (!alive) {
        ul.destroy();
        this.unitLights.delete(u);
      }
    }
  }

  private updateSteppedUnits(dt: number, t: number, gain: number): void {
    let units: MonsterUnit[] = [];
    try {
      units = this.field?.units() ?? [];
    } catch {
      units = [];
    }
    const seen = new Set<MonsterUnit>(units);
    for (const u of units) {
      if (!this.steppedUnits.has(u) && u.sprite?.active && !u.retired) {
        try {
          const sl = new SteppedUnitLight(this, u);
          if (!this.on) sl.setShown(false);
          this.steppedUnits.set(u, sl);
        } catch (e) {
          console.error('[light] stepped unit light failed', e);
        }
      }
    }
    for (const [u, sl] of this.steppedUnits) {
      let alive = false;
      try {
        alive = sl.tick(dt, t, gain, seen.has(u), this);
      } catch (e) {
        console.error('[light] stepped unit light failed', e);
      }
      if (!alive) {
        sl.destroy();
        this.steppedUnits.delete(u);
      }
    }
  }

  private updateTiles(dt: number, t: number, gain: number): void {
    let tiles: ZoneEntry[] = [];
    try {
      tiles = this.field?.tiles?.() ?? [];
    } catch {
      tiles = [];
    }
    const seen = new Set<ZoneEntry>();
    for (const e of tiles) {
      if (e.spot === 'monster') continue;
      seen.add(e);
      if (!this.tileLights.has(e)) {
        const tl = new TileLight(this, e);
        this.tileLights.set(e, tl);
      }
    }
    for (const [e, tl] of this.tileLights) {
      if (!tl.tick(dt, t, gain, seen.has(e), this)) {
        tl.destroy();
        this.tileLights.delete(e);
      }
    }
  }

  /** Debug / QA numbers (stepped: steppedPx = lit pad pixels of event lights / unit seats). */
  stats(): { enabled: boolean; stepped: boolean; lights: number; units: number; tiles: number; dim: number; gain: number; steppedPx: { lights: number; units: number } } {
    let lp = 0;
    for (const l of this.lights) lp += l.steppedPixels();
    let up = 0;
    for (const u of this.steppedUnits.values()) up += u.pixels();
    return {
      enabled: this.on,
      stepped: this.stepped,
      lights: this.lights.size,
      units: this.stepped ? this.steppedUnits.size : this.unitLights.size,
      tiles: this.tileLights.size,
      dim: this.dim.v,
      gain: this.gain,
      steppedPx: { lights: lp, units: up },
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onUpdate);
    this.rimCam?.off(Phaser.Cameras.Scene2D.Events.PRE_RENDER, this.onRimSync);
    this.rimCam = null;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.onShutdown);
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    for (const l of [...this.lights]) l.destroy();
    this.lights.clear();
    for (const ul of this.unitLights.values()) ul.destroy();
    this.unitLights.clear();
    for (const sl of this.steppedUnits.values()) sl.destroy();
    this.steppedUnits.clear();
    for (const im of this.steppedStaticImgs) if (im.active) im.destroy();
    this.steppedStaticImgs.length = 0;
    for (const tl of this.tileLights.values()) tl.destroy();
    this.tileLights.clear();
    this.dim.flush();
    for (const g of Object.values(this.groups)) g.flush();
    if (this.veil.active) this.veil.destroy();
    if (this.wash.active) this.wash.destroy();
    this.onDestroy?.();
  }
}
