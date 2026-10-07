// Hologram PostFX — how monsters appear, glitch and vanish (GAME_DESIGN §4 "Hologram", §6 summon/destroy).
//
// A per-sprite Phaser PostFXPipeline registered at boot as 'Hologram' (src/boot/12-vfx-summon.ts).
// Everything is evaluated per SCREEN pixel with nearest sampling, so the art never blurs:
//   reveal   0..1  bottom → top build-up with a bright scan edge and "data noise" pixels above it
//   scan     0..1  darkened alternating 2px rows (slowly scrolling) + a bright band sweeping down
//   glitch   0..1  random horizontal row-band offsets + RGB split
//   tintMix  0..1  ORDERED-DITHERED remap of the sprite into a 5-step palette ramp (strict colors)
//   tint           accent color for the scan edge / bright band / noise pixels
//   flicker  0..1  frame drops + row dropouts
//   alpha    0..1  dithered alpha (pixel dissolve, no translucent mush)
//   white    0..1  white silhouette flash (impact frames, tribute)
//   clipY          world y below which nothing is drawn (emerging from / sinking into the floor)
//
// Helpers: setHologram / clearHologram / getHologram, materialize, dematerialize, glitch, whiteFlash,
// plus framePixels / opaqueBox / pixelToWorld for effects that need a sprite's own pixels.

import Phaser from 'phaser';
import type { Attribute } from '../data/cards';
import { ATTRIBUTE_RAMP, PAL, type Ramp } from '../art/palette';
import { Swarm, animate, onTick, rampFrom, rnd, rrange } from './particles';
import { wait } from './core';

export const HOLOGRAM = 'Hologram';

export type HoloTarget = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

export interface HologramParams {
  reveal: number;
  scan: number;
  glitch: number;
  /** Accent color (scan edge, sweep band, noise pixels). */
  tint: number;
  /** Palette the sprite is remapped into when tintMix > 0 (dark → light). */
  ramp: Ramp;
  tintMix: number;
  /** Luminance exponent for the palette remap (< 1 lifts dark art into brighter steps). Default 0.8. */
  gain: number;
  flicker: number;
  alpha: number;
  white: number;
  /** World-space y below which pixels are discarded (null = off). */
  clipY: number | null;
  /**
   * Vertical span (relative to sprite.y, world px) that `reveal` sweeps across. Defaults to the
   * opaque bounds of the sprite's current frame.
   */
  span: { top: number; bottom: number } | null;
}

export function defaultHologram(): HologramParams {
  return {
    reveal: 1,
    scan: 0,
    glitch: 0,
    tint: PAL.cyan3,
    ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4],
    tintMix: 0,
    gain: 0.8,
    flicker: 0,
    alpha: 1,
    white: 0,
    clipY: null,
    span: null,
  };
}

// ================================================================ shader

const FRAG = `
#define SHADER_NAME NEON_HOLOGRAM_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uTime;
uniform float uReveal;
uniform vec2 uSpan;      // top, bottom (screen px, y down)
uniform float uScan;
uniform float uGlitch;
uniform vec3 uTint;
uniform vec3 uR0;
uniform vec3 uR1;
uniform vec3 uR2;
uniform vec3 uR3;
uniform vec3 uR4;
uniform float uTintMix;
uniform float uGain;
uniform float uFlicker;
uniform float uAlpha;
uniform float uWhite;
uniform float uClipY;    // screen y (y down); < -9000 disables
uniform float uFlipY;

varying vec2 outTexCoord;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

vec4 px(vec2 p) {
  return texture2D(uMainSampler, (p + 0.5) / uResolution);
}

vec3 rampColor(float l) {
  if (l < 0.13) return uR0;
  if (l < 0.30) return uR1;
  if (l < 0.50) return uR2;
  if (l < 0.74) return uR3;
  return uR4;
}

void main() {
  vec2 p = floor(outTexCoord * uResolution);
  float sy = uFlipY > 0.5 ? (uResolution.y - 1.0 - p.y) : p.y;   // screen row, 0 = top
  float dyDir = uFlipY > 0.5 ? -1.0 : 1.0;                       // +1 screen row in texture rows

  if (uClipY > -9000.0 && sy >= uClipY) { gl_FragColor = vec4(0.0); return; }

  float tq = floor(uTime * 16.0);

  // ---- glitch: coarse band shifts + fine 2px row jitter + RGB split
  vec2 sp = p;
  if (uGlitch > 0.001) {
    float coarse = floor(sy / 6.0);
    float hc = hash(vec2(coarse, tq));
    if (hc < uGlitch * 0.55) {
      sp.x += floor((hash(vec2(coarse + 17.0, tq)) - 0.5) * 2.0 * (2.0 + 9.0 * uGlitch) + 0.5);
    }
    float fine = floor(sy / 2.0);
    if (hash(vec2(fine, tq + 3.0)) < uGlitch * 0.25) {
      sp.x += hash(vec2(fine, tq + 9.0)) < 0.5 ? -1.0 : 1.0;
    }
  }
  vec4 c = px(sp);
  if (uGlitch > 0.05) {
    float s = max(1.0, floor(uGlitch * 2.5));
    vec4 cr = px(sp + vec2(s, 0.0));
    vec4 cb = px(sp - vec2(s, 0.0));
    float a = max(c.a, max(cr.a, cb.a));
    c = vec4(cr.r, c.g, cb.b, a);
  }
  if (c.a <= 0.001) { gl_FragColor = vec4(0.0); return; }

  vec3 rgb = c.rgb / c.a;
  float alpha = c.a;
  float b = bayer4(vec2(p.x, sy));

  // ---- palette remap (ordered dither between original and ramp colors)
  if (uTintMix > 0.001) {
    float l = pow(max(dot(rgb, vec3(0.299, 0.587, 0.114)), 0.0), uGain);
    if (b < uTintMix) rgb = rampColor(l);
  }

  // ---- scanlines
  if (uScan > 0.001) {
    float scroll = floor(uTime * 10.0);
    if (mod(floor((sy + scroll) / 2.0), 2.0) > 0.5) rgb *= 1.0 - 0.42 * uScan;
    float spanH = max(8.0, uSpan.y - uSpan.x);
    float band = uSpan.x - 6.0 + mod(uTime * 70.0, spanH + 30.0);
    if (sy >= floor(band) && sy < floor(band) + 2.0) rgb = mix(rgb, uTint, 0.6 * uScan);
  }

  // ---- reveal sweep (bottom -> top)
  if (uReveal < 0.999) {
    float lineY = floor(mix(uSpan.y + 2.0, uSpan.x - 2.0, uReveal));
    float d = sy - lineY;
    if (d < 0.0) {
      // above the line: not yet built. Sparse data-noise pixels just ahead of the edge.
      float k = 1.0 + d / 7.0;
      if (k > 0.0 && hash(p + vec2(tq * 0.37, tq)) < 0.32 * k) {
        rgb = uTint;
        alpha = 1.0;
      } else {
        gl_FragColor = vec4(0.0);
        return;
      }
    } else if (d < 1.0) {
      rgb = mix(uTint, vec3(1.0), 0.75);
    } else if (d < 3.0) {
      rgb = mix(rgb, uTint, 0.75);
    } else if (d < 7.0) {
      if (b < 0.5 * (1.0 - (d - 3.0) / 4.0)) rgb = mix(rgb, uTint, 0.5);
    }
  }

  // ---- flicker
  if (uFlicker > 0.001) {
    if (hash(vec2(tq, 7.31)) < uFlicker * 0.18) alpha *= 0.6;
    if (hash(vec2(sy, tq + 1.7)) < uFlicker * 0.07) { gl_FragColor = vec4(0.0); return; }
  }

  // ---- white silhouette
  if (uWhite > 0.001) rgb = mix(rgb, vec3(1.0), uWhite);

  // ---- dithered alpha
  float A = alpha * uAlpha;
  if (A < 0.999) {
    if (b >= A) { gl_FragColor = vec4(0.0); return; }
    A = 1.0;
  }
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0) * A, A);
}
`;

function rgb3(c: number): [number, number, number] {
  return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
}

/** Screen-space y of a world point for the main camera (includes zoom, scroll and shake). */
function worldToScreenY(go: HoloTarget, wx: number, wy: number): number {
  const cam = go.scene.cameras.main;
  // camera.matrix holds zoom + shake for the frame being rendered (typed as protected)
  const m = (cam as unknown as { matrix: Phaser.GameObjects.Components.TransformMatrix }).matrix;
  const x = wx - cam.scrollX * go.scrollFactorX;
  const y = wy - cam.scrollY * go.scrollFactorY;
  return m.getY(x, y);
}

export class HologramPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  params: HologramParams = defaultHologram();

  constructor(game: Phaser.Game) {
    super({ game, name: HOLOGRAM, fragShader: FRAG });
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    const go = this.gameObject as HoloTarget | undefined;
    const P = this.params;
    let top = 0;
    let bottom = 0;
    let clip = -10000;
    if (go && go.scene) {
      let span = P.span;
      if (!span) {
        const b = opaqueBox(go);
        span = b ? { top: b.top - go.y, bottom: b.bottom - go.y } : { top: -go.displayHeight, bottom: 0 };
      }
      top = worldToScreenY(go, go.x, go.y + span.top);
      bottom = worldToScreenY(go, go.x, go.y + span.bottom);
      if (P.clipY !== null) clip = Math.round(worldToScreenY(go, go.x, P.clipY));
    }
    this.set2f('uResolution', target.width, target.height);
    this.set1f('uFlipY', HOLO_FLIP_Y ? 1 : 0);
    this.set1f('uTime', ((this.game.loop.time / 1000) % 600) + 0.001);
    this.set1f('uReveal', P.reveal);
    this.set2f('uSpan', Math.round(top), Math.round(bottom));
    this.set1f('uScan', P.scan);
    this.set1f('uGlitch', P.glitch);
    this.set3f('uTint', ...rgb3(P.tint));
    this.set3f('uR0', ...rgb3(P.ramp[0]));
    this.set3f('uR1', ...rgb3(P.ramp[1]));
    this.set3f('uR2', ...rgb3(P.ramp[2]));
    this.set3f('uR3', ...rgb3(P.ramp[3]));
    this.set3f('uR4', ...rgb3(P.ramp[4]));
    this.set1f('uTintMix', P.tintMix);
    this.set1f('uGain', P.gain);
    this.set1f('uFlicker', P.flicker);
    this.set1f('uAlpha', P.alpha);
    this.set1f('uWhite', P.white);
    this.set1f('uClipY', clip);
    this.bindAndDraw(target);
  }
}

/**
 * Whether the post-FX render target is stored bottom-up (GL convention). Verified visually with
 * ?dev=vfx-summon&fx=materialize (reveal must sweep bottom → top, clip must cut the lower part).
 */
const HOLO_FLIP_Y = true;

/** Register the pipeline on a game (idempotent). Called by the boot step; safe to call again. */
export function registerHologram(game: Phaser.Game): boolean {
  const r = game.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  // NB: pipelines.getPostPipeline() would instantiate a pipeline — check the class map instead.
  const classes = (r.pipelines as unknown as { postPipelineClasses: { has(k: string): boolean } }).postPipelineClasses;
  if (!classes.has(HOLOGRAM)) r.pipelines.addPostPipeline(HOLOGRAM, HologramPipeline);
  return true;
}

function webgl(scene: Phaser.Scene): boolean {
  return scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
}

/** The hologram pipeline instance on a sprite, if any. */
export function getHologram(sprite: HoloTarget): HologramPipeline | null {
  const p = sprite.getPostPipeline(HOLOGRAM) as unknown;
  if (Array.isArray(p)) return (p[0] as HologramPipeline) ?? null;
  return (p as HologramPipeline) ?? null;
}

/** Attach (if needed) and update hologram parameters. Returns the live params object (mutable). */
export function setHologram(sprite: HoloTarget, params: Partial<HologramParams> = {}): HologramParams {
  if (!webgl(sprite.scene)) {
    // Canvas fallback: approximate with alpha only.
    const d = { ...defaultHologram(), ...params };
    sprite.setAlpha(d.alpha * (d.reveal > 0 ? 1 : 0));
    return d;
  }
  registerHologram(sprite.scene.game);
  let pipe = getHologram(sprite);
  if (!pipe) {
    sprite.setPostPipeline(HOLOGRAM);
    pipe = getHologram(sprite);
    // Phaser boots post pipelines lazily inside postBatch, so on their first frame no render
    // target is bound and the sprite would draw unprocessed (a 1-frame pop). Boot it now.
    const boot = pipe as unknown as { hasBooted?: boolean; bootFX?: () => void } | null;
    if (boot && !boot.hasBooted && boot.bootFX) boot.bootFX();
  }
  if (!pipe) return { ...defaultHologram(), ...params };
  Object.assign(pipe.params, params);
  return pipe.params;
}

/** Remove the hologram pipeline (sprite renders normally again). */
export function clearHologram(sprite: HoloTarget): void {
  if (!sprite.scene) return;
  if (!webgl(sprite.scene)) {
    sprite.setAlpha(1);
    return;
  }
  if (getHologram(sprite)) sprite.removePostPipeline(HOLOGRAM);
}

// ================================================================ sprite pixel access

export interface FramePixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  /** Opaque bounds in frame pixels (inclusive-exclusive), or null if empty. */
  box: { x0: number; y0: number; x1: number; y1: number } | null;
}

const pixCache = new WeakMap<object, Map<string, FramePixels>>();
let scratch: HTMLCanvasElement | null = null;

/** RGBA pixels of a sprite's current frame (cached per texture source + frame). */
export function framePixels(sprite: HoloTarget): FramePixels | null {
  const frame = sprite.frame;
  if (!frame || !frame.source) return null;
  const src = frame.source.image as CanvasImageSource | undefined;
  if (!src) return null;
  let m = pixCache.get(src as object);
  if (!m) {
    m = new Map();
    pixCache.set(src as object, m);
  }
  const key = `${frame.cutX},${frame.cutY},${frame.cutWidth},${frame.cutHeight}`;
  let fp = m.get(key);
  if (fp) return fp;
  const w = frame.cutWidth;
  const h = frame.cutHeight;
  if (!scratch) scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  fp = { w, h, data, box: x1 >= 0 ? { x0, y0, x1: x1 + 1, y1: y1 + 1 } : null };
  m.set(key, fp);
  return fp;
}

/** World position of the center of frame pixel (fx, fy) (handles origin, scale and flips; ignores rotation). */
export function pixelToWorld(sprite: HoloTarget, fx: number, fy: number): { x: number; y: number } {
  const w = sprite.frame.realWidth;
  const h = sprite.frame.realHeight;
  const lx = sprite.flipX ? w - 1 - fx : fx;
  const ly = sprite.flipY ? h - 1 - fy : fy;
  return {
    x: sprite.x + (lx + 0.5 - sprite.displayOriginX) * sprite.scaleX,
    y: sprite.y + (ly + 0.5 - sprite.displayOriginY) * sprite.scaleY,
  };
}

/** World-space opaque bounds of a sprite's current frame. */
export function opaqueBox(sprite: HoloTarget): { left: number; right: number; top: number; bottom: number } | null {
  const fp = framePixels(sprite);
  if (!fp || !fp.box) return null;
  const a = pixelToWorld(sprite, fp.box.x0, fp.box.y0);
  const b = pixelToWorld(sprite, fp.box.x1 - 1, fp.box.y1 - 1);
  const hs = Math.abs(sprite.scaleX) / 2;
  const vs = Math.abs(sprite.scaleY) / 2;
  return {
    left: Math.min(a.x, b.x) - hs,
    right: Math.max(a.x, b.x) + hs,
    top: Math.min(a.y, b.y) - vs,
    bottom: Math.max(a.y, b.y) + vs,
  };
}

/** Up to `n` random opaque pixels of the sprite (world coords + their colors). */
export function opaquePoints(sprite: HoloTarget, n: number): { x: number; y: number; color: number; fy: number }[] {
  const fp = framePixels(sprite);
  if (!fp || !fp.box) return [];
  const out: { x: number; y: number; color: number; fy: number }[] = [];
  const { x0, y0, x1, y1 } = fp.box;
  let guard = n * 30;
  while (out.length < n && guard-- > 0) {
    const fx = x0 + Math.floor(rnd() * (x1 - x0));
    const fy = y0 + Math.floor(rnd() * (y1 - y0));
    const i = (fy * fp.w + fx) * 4;
    if (fp.data[i + 3] === 0) continue;
    const w = pixelToWorld(sprite, fx, fy);
    out.push({ x: w.x, y: w.y, color: (fp.data[i] << 16) | (fp.data[i + 1] << 8) | fp.data[i + 2], fy });
  }
  return out;
}

// ================================================================ helpers

/**
 * Hologram palette for an attribute ramp: lifted one step (ramp[1..4] + white) so a projected
 * monster is always luminous — dark monsters stay readable in front of dark effects.
 */
export function holoRamp(ramp: Ramp): Ramp {
  return [ramp[1], ramp[2], ramp[3], ramp[4], PAL.white];
}

function rampOf(o: { attribute?: Attribute; ramp?: Ramp; tint?: number }): Ramp {
  if (o.ramp) return o.ramp;
  if (o.attribute) return ATTRIBUTE_RAMP[o.attribute];
  if (o.tint !== undefined) return rampFrom(o.tint);
  return ATTRIBUTE_RAMP.LIGHT;
}

export interface MaterializeOpts {
  attribute?: Attribute;
  ramp?: Ramp;
  /** Total duration (reveal ≈ 75 %, settle ≈ 25 %). Default 650. */
  ms?: number;
  /** Converging particles (default true). */
  converge?: boolean;
  /** Keep the hologram pipeline attached at the end (default false → removed). */
  keep?: boolean;
  /** Called when the reveal reaches the top (settle begins) — good moment for 'roar'. */
  onRevealed?: () => void;
}

/**
 * Hologram materialization: the sprite is built bottom → top by a bright scan edge, in the
 * attribute palette with scanlines and a little glitch, while pixels converge onto its body;
 * then the palette dithers back to the real colors. Removes the pipeline at the end.
 */
export async function materialize(scene: Phaser.Scene, sprite: HoloTarget, opts: MaterializeOpts = {}): Promise<void> {
  const ramp = rampOf(opts);
  const ms = opts.ms ?? 650;
  const revealMs = ms * 0.72;
  const settleMs = ms - revealMs;
  sprite.setVisible(true);
  const box = opaqueBox(sprite);
  const span = box ? { top: box.top - sprite.y, bottom: box.bottom - sprite.y } : null;
  const P = setHologram(sprite, {
    reveal: 0,
    scan: 1,
    glitch: 0.22,
    tint: ramp[4],
    ramp: holoRamp(ramp),
    tintMix: 1,
    gain: 1.15,
    flicker: 0.35,
    alpha: 1,
    white: 0,
    span,
  });

  // scan bar: a crisp horizontal light line that rides the reveal edge and overshoots the body
  const bar = scene.add.graphics().setDepth(sprite.depth + 0.5).setBlendMode(Phaser.BlendModes.ADD);
  const stopBar = onTick(scene, () => {
    bar.clear();
    if (!box || P.reveal >= 0.999 || P.reveal <= 0) return;
    const yTop = sprite.y + (span ? span.top : -sprite.displayHeight);
    const yBot = sprite.y + (span ? span.bottom : 0);
    const ly = Math.floor(yBot + 2 + (yTop - 2 - (yBot + 2)) * P.reveal);
    const x0 = Math.round(sprite.x + (box.left - sprite.x)) - 5;
    const x1 = Math.round(sprite.x + (box.right - sprite.x)) + 5;
    bar.fillStyle(ramp[4], 0.9).fillRect(x0, ly, x1 - x0, 1);
    bar.fillStyle(ramp[2], 0.7).fillRect(x0 + 3, ly + 1, x1 - x0 - 6, 1);
    // edge ticks
    bar.fillStyle(PAL.white, 1).fillRect(x0 - 2, ly, 2, 1).fillRect(x1, ly, 2, 1);
  });

  // converging pixels: arrive where the scan edge is about to pass
  let swarm: Swarm | null = null;
  if (opts.converge !== false && box) {
    swarm = new Swarm(scene, sprite.depth + 0.6, Phaser.BlendModes.ADD);
    const n = Math.round(Math.min(70, 18 + (box.right - box.left) * (box.bottom - box.top) / 60));
    const pts = opaquePoints(sprite, n);
    const h = Math.max(1, box.bottom - box.top);
    for (const pt of pts) {
      const k = (box.bottom - pt.y) / h; // 0 = bottom
      const arrive = revealMs * Math.min(1, k) * 0.95;
      const travel = rrange(180, 320);
      const a = rnd() * Math.PI * 2;
      const r = rrange(26, 48);
      const sx = pt.x + Math.cos(a) * r;
      const sy = pt.y + Math.sin(a) * r * 0.6 - 6;
      const tx = pt.x;
      const ty = pt.y;
      swarm.add({
        x: sx,
        y: sy,
        age: Math.min(0, arrive - travel),
        life: Math.max(60, Math.min(travel, arrive + 40)),
        color: ramp[4],
        size: rnd() < 0.3 ? 2 : 1,
        trail: 2,
        trailColor: ramp[2],
        path: (p, t) => {
          const e = t * t * (3 - 2 * t);
          p.x = sx + (tx - sx) * e;
          p.y = sy + (ty - sy) * e - Math.sin(t * Math.PI) * 6;
        },
        paint: (p, t) => {
          p.color = t > 0.8 ? PAL.white : t > 0.4 ? ramp[4] : ramp[3];
          p.size = t > 0.85 ? 1 : p.size;
        },
      });
    }
  }

  // reveal sweep (glitch eases off as the body completes)
  await animate(
    scene,
    revealMs,
    (t) => {
      P.reveal = t;
      P.glitch = 0.22 * (1 - t) + 0.04;
    },
    (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  );
  P.reveal = 1;
  stopBar();
  bar.destroy();
  opts.onRevealed?.();

  // settle: one bright frame, then the palette dithers back to true colors
  P.white = 0.55;
  await wait(scene, 34);
  P.white = 0;
  await animate(scene, settleMs, (t) => {
    P.tintMix = 1 - t;
    P.scan = 1 - t;
    P.flicker = 0.35 * (1 - t);
    P.glitch = 0.04 * (1 - t);
  });
  if (!opts.keep) clearHologram(sprite);
  else Object.assign(P, { tintMix: 0, scan: 0, flicker: 0, glitch: 0 });
  if (swarm) await Promise.race([swarm.done(), wait(scene, 200)]);
}

export interface DematerializeOpts {
  attribute?: Attribute;
  ramp?: Ramp;
  /** Leave the sprite hidden at the end (default true). */
  hide?: boolean;
}

/**
 * Hologram vanish: palette shift + glitch spike, then the body is erased top → bottom while
 * pixel bits fly up off the scan edge. Hides the sprite and removes the pipeline at the end.
 */
export async function dematerialize(scene: Phaser.Scene, sprite: HoloTarget, ms = 520, opts: DematerializeOpts = {}): Promise<void> {
  const ramp = rampOf(opts);
  const box = opaqueBox(sprite);
  const span = box ? { top: box.top - sprite.y, bottom: box.bottom - sprite.y } : null;
  const P = setHologram(sprite, { reveal: 1, scan: 0, glitch: 0, tint: ramp[4], ramp: holoRamp(ramp), tintMix: 0, flicker: 0, white: 0, alpha: 1, span });
  const pre = Math.min(160, ms * 0.3);
  await animate(scene, pre, (t) => {
    P.tintMix = t;
    P.scan = t;
    P.glitch = 0.6 * Math.sin(t * Math.PI) + 0.1;
    P.flicker = 0.4 * t;
  });
  const swarm = box ? new Swarm(scene, sprite.depth + 0.6, Phaser.BlendModes.ADD) : null;
  let acc = 0;
  await animate(
    scene,
    ms - pre,
    (t, dt) => {
      P.reveal = 1 - t;
      P.glitch = 0.15;
      if (!swarm || !box || !span) return;
      acc += dt;
      while (acc > 16) {
        acc -= 16;
        const yTop = sprite.y + span.top;
        const yBot = sprite.y + span.bottom;
        const ly = yBot + 2 + (yTop - 2 - (yBot + 2)) * P.reveal;
        for (let i = 0; i < 3; i++) {
          swarm.add({
            x: rrange(box.left, box.right),
            y: ly,
            vx: rrange(-12, 12),
            vy: rrange(-70, -25),
            drag: 1.5,
            life: rrange(220, 420),
            color: rnd() < 0.5 ? ramp[4] : ramp[3],
            paint: (p, tt) => {
              p.color = tt > 0.6 ? ramp[2] : p.color;
              p.alpha = tt > 0.8 ? 0.5 : 1;
            },
          });
        }
      }
    },
    (t) => t * t * (3 - 2 * t),
  );
  if (opts.hide !== false) sprite.setVisible(false);
  clearHologram(sprite);
  if (swarm) await Promise.race([swarm.done(), wait(scene, 450)]);
}

/**
 * Hologram malfunction: row tearing, RGB split, palette flicker and frame drops for `ms`.
 * Restores the previous hologram state (or removes the pipeline if there was none).
 */
export async function glitch(scene: Phaser.Scene, sprite: HoloTarget, ms = 300, intensity = 1, opts: { attribute?: Attribute; ramp?: Ramp } = {}): Promise<void> {
  const had = getHologram(sprite);
  const before = had ? { ...had.params } : null;
  const ramp = opts.ramp ?? (opts.attribute ? ATTRIBUTE_RAMP[opts.attribute] : before?.ramp ?? rampFrom(PAL.cyan3));
  const P = setHologram(sprite, { ramp: holoRamp(ramp), tint: ramp[4] });
  let next = 0;
  await animate(scene, ms, (t, dt) => {
    next -= dt;
    if (next <= 0) {
      next = rrange(30, 70);
      const spike = rnd() < 0.35 ? 1 : 0.45;
      P.glitch = Math.min(1, intensity * spike * (1 - 0.5 * t));
      P.tintMix = rnd() < 0.4 * intensity ? 1 : rnd() < 0.5 ? 0.5 : 0;
      P.scan = Math.min(1, 0.6 * intensity + 0.3);
      P.flicker = Math.min(1, 0.6 * intensity);
    }
  });
  if (before && had && getHologram(sprite)) Object.assign(getHologram(sprite)!.params, before);
  else clearHologram(sprite);
}

/** 1–2 frame white silhouette flash (impact frame). */
export async function whiteFlash(scene: Phaser.Scene, sprite: HoloTarget, ms = 70): Promise<void> {
  const had = getHologram(sprite);
  const prevWhite = had ? had.params.white : 0;
  const P = setHologram(sprite, { white: 1 });
  await wait(scene, ms);
  if (had) P.white = prevWhite;
  else clearHologram(sprite);
}

