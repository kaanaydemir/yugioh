// HD lighting — dynamic 2D lighting for the HD trial, built on Phaser's Light2D machinery.
//
// What this is
//   A custom LightPipeline ('HDLight') that keeps Phaser's light manager (scene.lights: ambient colour,
//   Light objects, visibility culling) but replaces the fragment shader with a better model:
//     - per-light HEIGHT (a rim light grazes the surface, a summon column hovers above it)
//     - wrapped diffuse + soft shoulder above 1.0 (strong coloured light tints instead of clipping to white)
//     - a tight Blinn highlight on bright texels (crystal facets sparkle when a light passes)
//     - flipX / flipY aware: a mirrored sprite gets its normals mirrored too (player 2 uses flipX)
//     - tint-fill sprites (white hit flashes) bypass lighting so a flash stays a pure white silhouette
//   Lighting can be switched off globally (setLightingEnabled) — lit sprites then render flat, exactly
//   like plain sprites, so the "L" toggle compares dynamic lighting against the baked look.
//
// NORMAL MAP CONVENTION (everyone who writes normal maps must follow this)
//   RGB = normal * 0.5 + 0.5, OpenGL style:  R = +x (screen right), G = +y (screen UP), B = +z (toward the viewer).
//   A flat surface is (128, 128, 255). The top of a sphere has G > 128. Alpha is ignored (see makeLitTexture:
//   the normal map is stored fully opaque, with the flat normal outside the sprite mask).
//
// API (see also src/hd/app/api.ts for the scene-level kit that wraps everything)
//   installLighting(game)                         once, at boot (src/hd/app/boot.ts does it)
//   makeLitTexture(scene, key, color, normal)     one image + its normal map
//   makeLitSheet(scene, key, fw, fh, frames)      a frame sheet + a matching normal sheet (+ `${key}:n` debug texture)
//   addLitSprite(scene, x, y, key, frame?, opts?) a Sprite on the HDLight pipeline
//   useLighting(obj, material?)                   put any Image/Sprite on the pipeline
//   setLitMaterial(obj, {spec, shine, emissive})  per-object highlight / self-illumination
//   getLighting(scene) → HDLighting               per-scene light manager wrapper:
//       .addPointLight(x, y, color, radius, intensity, height?) → LightHandle
//       .ambient(color, intensity)
//       .ownerRimLight(player, follow, opts?)     P1 cyan from the lower-left, P2 crimson from the upper-right
//       .flashLight(x, y, color, ms, peak, radius?)   impact / summon pulse (Promise)
//       .applyTheme(theme)                        ambient + rim defaults from an ArenaTheme
//       .setEnabled(on) / .enabled                dynamic lighting on/off (global, all scenes)

import Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import type { PixelCanvas } from '../../art/pixel';
import { tween } from '../../vfx/core';
import { hdZoneXY, type ArenaTheme } from '../contracts';

export const HD_LIGHT = 'HDLight';

/** Any drawable the lit-texture helpers accept (PixelCanvas from the art code, or a DOM canvas). */
export type CanvasLike = PixelCanvas | HTMLCanvasElement;

const DEFAULT_LIGHT_HEIGHT = 60;

// ================================================================ shader

const FRAG = `
#define SHADER_NAME HD_LIGHT_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

struct Light
{
    vec2 position;
    vec3 color;
    float intensity;
    float radius;
    float height;
};

const int kMaxLights = %LIGHT_COUNT%;

uniform vec4 uCamera;           /* x, y, rotation, zoom */
uniform sampler2D uMainSampler;
uniform sampler2D uNormSampler;
uniform vec3 uAmbientLightColor;
uniform Light uLights[kMaxLights];
uniform mat3 uInverseRotationMatrix;
uniform int uLightCount;
uniform vec2 uFlip;             /* -1 when the sprite is mirrored in x / y */
uniform vec4 uMat;              /* x specular strength, y shininess, z self-lit threshold on chroma*value (>1 off), w unused */
uniform vec4 uGrade;            /* x lit (1/0), y shoulder, z diffuse wrap */

varying vec2 outTexCoord;
varying float outTexId;
varying float outTintEffect;
varying vec4 outTint;

void main ()
{
    vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
    vec4 tex = texture2D(uMainSampler, outTexCoord);
    vec4 color = tex * texel;

    if (outTintEffect == 1.0)
    {
        /* tint fill (white hit flash): stays a pure silhouette, never darkened by the light */
        color.rgb = mix(tex.rgb, outTint.bgr * outTint.a, tex.a);
        gl_FragColor = color;
        return;
    }
    else if (outTintEffect == 2.0)
    {
        color = texel;
    }

    if (uGrade.x < 0.5)
    {
        gl_FragColor = color;
        return;
    }

    vec3 nm = texture2D(uNormSampler, outTexCoord).rgb * 2.0 - 1.0;
    nm.xy *= uFlip;
    vec3 n = normalize(uInverseRotationMatrix * nm);

    float zoom = uCamera.w;
    vec3 diffuse = vec3(0.0);
    vec3 spec = vec3(0.0);

    for (int index = 0; index < kMaxLights; ++index)
    {
        if (index < uLightCount)
        {
            Light light = uLights[index];
            vec2 dp = light.position - gl_FragCoord.xy;
            float r = light.radius * zoom;
            float att = clamp(1.0 - dot(dp, dp) / (r * r), 0.0, 1.0);
            att *= att;
            vec3 l = normalize(vec3(dp, light.height * zoom));
            float ndl = clamp((dot(n, l) + uGrade.z) / (1.0 + uGrade.z), 0.0, 1.0);
            diffuse += light.color * (ndl * att * light.intensity);
            vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));
            float ns = pow(max(dot(n, hv), 0.0), uMat.y);
            spec += light.color * (ns * att * light.intensity);
        }
    }

    vec3 lightSum = uAmbientLightColor + diffuse;
    vec3 over = max(lightSum - 1.0, 0.0);
    lightSum = min(lightSum, vec3(1.0)) + over / (1.0 + over * uGrade.y);

    vec3 rgb = color.rgb * lightSum;

    float a = max(color.a, 0.0001);
    vec3 c0 = color.rgb / a;
    float lum = dot(c0, vec3(0.299, 0.587, 0.114));
    /* self-lit texels: bright AND saturated (flames, glowing veins, eyes) keep at least their baked colour */
    float mx = max(c0.r, max(c0.g, c0.b));
    float mn = min(c0.r, min(c0.g, c0.b));
    float em = smoothstep(uMat.z, uMat.z + 0.2, (mx - mn) * mx);
    rgb = mix(rgb, max(rgb, color.rgb), em);
    rgb += spec * uMat.x * color.a * (0.35 + lum);

    /* interleaved-gradient noise: dithers the smooth light gradient before the 8-bit write (no visible banding) */
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    rgb += (ign - 0.5) * (1.0 / 255.0) * color.a;

    gl_FragColor = vec4(rgb, color.a);
}
`;

// ================================================================ global state

/** Global lighting state shared by every scene / pipeline instance. */
const state = {
  enabled: true,
  /** Soft shoulder above 1.0 (0 = hard clip). */
  shoulder: 0.55,
  /** Diffuse wrap (0 = pure Lambert). */
  wrap: 0.22,
};

export function setLightingEnabled(on: boolean): void {
  state.enabled = on;
}
export function isLightingEnabled(): boolean {
  return state.enabled;
}
export function lightingGrade(): { shoulder: number; wrap: number } {
  return state;
}

/** Per-object material (read from pipelineData.hdMat). */
export interface LitMaterial {
  /** Highlight strength (default 0.28). */
  spec?: number;
  /** Highlight tightness (default 28). */
  shine?: number;
  /** Self-lit threshold on saturation × brightness (0..1): texels above it never go darker than their baked colour. Default off (9); monsters use 0.45. */
  emissive?: number;
}
const DEFAULT_MAT: [number, number, number, number] = [0.28, 28, 9, 0];

type LightWithHeight = Phaser.GameObjects.Light & { hdHeight?: number };

export class HDLightPipeline extends Phaser.Renderer.WebGL.Pipelines.LightPipeline {
  private curFlipX = 99;
  private curFlipY = 99;
  private curMat = [-1, -1, -1, -1];

  constructor(game: Phaser.Game) {
    super({ game, name: HD_LIGHT, fragShader: FRAG } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  override onRender(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): void {
    const lm = scene.lights;
    const self = this as unknown as { lightsActive: boolean };
    self.lightsActive = false;
    if (!lm || !lm.active) return;

    const lights = lm.getLights(camera) as unknown as { light: LightWithHeight; distance: number }[];
    self.lightsActive = true;

    const renderer = this.renderer;
    const height = renderer.height;
    const cam = camera as unknown as { matrix: Phaser.GameObjects.Components.TransformMatrix; rotation: number };
    const cameraMatrix = cam.matrix;
    const tmp = this.tempVec2;

    this.set1i('uMainSampler', 0);
    this.set1i('uNormSampler', 1);
    this.set4f('uCamera', camera.x, camera.y, cam.rotation, camera.zoom);
    this.set3f('uAmbientLightColor', lm.ambientColor.r, lm.ambientColor.g, lm.ambientColor.b);
    this.set1i('uLightCount', lights.length);
    this.set4f('uGrade', state.enabled ? 1 : 0, state.shoulder, state.wrap, 0);

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i].light;
      const c = light.color;
      const name = 'uLights[' + i + '].';
      cameraMatrix.transformPoint(light.x, light.y, tmp);
      this.set2f(name + 'position', tmp.x - camera.scrollX * light.scrollFactorX * camera.zoom, height - (tmp.y - camera.scrollY * light.scrollFactorY * camera.zoom));
      this.set3f(name + 'color', c.r, c.g, c.b);
      this.set1f(name + 'intensity', light.intensity);
      this.set1f(name + 'radius', light.radius);
      this.set1f(name + 'height', light.hdHeight ?? DEFAULT_LIGHT_HEIGHT);
    }

    // a new camera pass: re-sync per-object state on the next sprite
    this.curFlipX = 99;
    this.curFlipY = 99;
    this.curMat = [-1, -1, -1, -1];
    (this as unknown as { currentNormalMapRotation: number | null }).currentNormalMapRotation = null;
  }

  override setGameObject(gameObject: Phaser.GameObjects.GameObject, frame?: Phaser.Textures.Frame): number {
    const g = gameObject as Phaser.GameObjects.Sprite;
    const fx = (g.flipX ? -1 : 1) * ((g.scaleX ?? 1) < 0 ? -1 : 1);
    const fy = (g.flipY ? -1 : 1) * ((g.scaleY ?? 1) < 0 ? -1 : 1);
    const m = ((g.pipelineData as Record<string, unknown> | undefined)?.hdMat as number[] | undefined) ?? DEFAULT_MAT;
    const cm = this.curMat;
    if (fx !== this.curFlipX || fy !== this.curFlipY || m[0] !== cm[0] || m[1] !== cm[1] || m[2] !== cm[2]) {
      if (this.vertexCount > 0) this.flush();
      this.set2f('uFlip', fx, fy);
      this.set4f('uMat', m[0], m[1], m[2], m[3]);
      this.curFlipX = fx;
      this.curFlipY = fy;
      this.curMat = [m[0], m[1], m[2], m[3]];
    }
    return super.setGameObject(gameObject, frame);
  }
}

/** Register the HDLight pipeline and make sure the renderer keeps enough light slots. Idempotent. */
export function installLighting(game: Phaser.Game): boolean {
  const r = game.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  if (!r.pipelines.has(HD_LIGHT)) r.pipelines.add(HD_LIGHT, new HDLightPipeline(game));
  return true;
}

// ================================================================ lit textures

function toImageData(c: CanvasLike): ImageData {
  if ('toImageData' in c) return c.toImageData();
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return ctx.getImageData(0, 0, c.width, c.height);
}

function sizeOf(c: CanvasLike): { w: number; h: number } {
  return 'toImageData' in c ? { w: c.w, h: c.h } : { w: c.width, h: c.height };
}

/**
 * Normal map → fully opaque image: the flat normal (128,128,255) outside the mask, the normal blended
 * toward flat on soft edges. (Phaser uploads textures premultiplied; a premultiplied normal map would
 * be garbage on semi-transparent texels, and the shader never needs the alpha.)
 */
export function opaqueNormals(src: ImageData, mask?: ImageData): ImageData {
  const out = new ImageData(src.width, src.height);
  const s = src.data;
  const o = out.data;
  const m = mask?.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = (m ? m[i + 3] : s[i + 3]) / 255;
    o[i] = 128 + (s[i] - 128) * a;
    o[i + 1] = 128 + (s[i + 1] - 128) * a;
    o[i + 2] = 255 + (s[i + 2] - 255) * a;
    o[i + 3] = 255;
  }
  return out;
}

function canvasFromImageData(id: ImageData): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = id.width;
  cv.height = id.height;
  cv.getContext('2d', { willReadFrequently: true })!.putImageData(id, 0, 0);
  return cv;
}

function replaceTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
}

/**
 * Register a texture `key` whose Phaser data source is its normal map (what Light2D reads), plus a plain
 * `${key}:n` texture of the normal map for debug views. Returns the colour texture.
 */
export function makeLitTexture(scene: Phaser.Scene, key: string, colorCanvas: CanvasLike, normalCanvas: CanvasLike): Phaser.Textures.Texture {
  const cs = sizeOf(colorCanvas);
  const ns = sizeOf(normalCanvas);
  if (cs.w !== ns.w || cs.h !== ns.h) throw new Error(`makeLitTexture(${key}): colour ${cs.w}×${cs.h} and normal ${ns.w}×${ns.h} differ`);
  const colorData = toImageData(colorCanvas);
  const normal = canvasFromImageData(opaqueNormals(toImageData(normalCanvas), colorData));
  const color = canvasFromImageData(colorData);
  replaceTexture(scene, key);
  replaceTexture(scene, `${key}:n`);
  const tex = scene.textures.addImage(key, color as unknown as HTMLImageElement, normal as unknown as HTMLImageElement)!;
  scene.textures.addImage(`${key}:n`, normal as unknown as HTMLImageElement);
  return tex;
}

export interface LitFrameInput {
  name: string;
  color: CanvasLike;
  normal: CanvasLike;
  /** Optional emissive layer (RGB = colour, A = glow strength): collected into a plain `${key}:e` sheet with the same frame names. */
  emissive?: CanvasLike;
}

/** A grid sheet of equally sized frames, colour + normal atlases with identical layout. Frame names are the given names. */
export function makeLitSheet(scene: Phaser.Scene, key: string, fw: number, fh: number, frames: LitFrameInput[]): Phaser.Textures.Texture {
  const cols = Math.max(1, Math.min(frames.length, Math.floor(4096 / fw)));
  const rows = Math.ceil(frames.length / cols);
  const mk = () => {
    const cv = document.createElement('canvas');
    cv.width = cols * fw;
    cv.height = rows * fh;
    return cv;
  };
  const colorCv = mk();
  const normalCv = mk();
  const cctx = colorCv.getContext('2d', { willReadFrequently: true })!;
  const nctx = normalCv.getContext('2d', { willReadFrequently: true })!;
  const hasEmissive = frames.some((f) => f.emissive);
  const emissiveCv = hasEmissive ? mk() : null;
  const ectx = emissiveCv?.getContext('2d', { willReadFrequently: true }) ?? null;
  // untouched (transparent) cells of the normal atlas are flat normals too
  nctx.fillStyle = 'rgb(128,128,255)';
  nctx.fillRect(0, 0, normalCv.width, normalCv.height);
  frames.forEach((f, i) => {
    const x = (i % cols) * fw;
    const y = Math.floor(i / cols) * fh;
    const col = toImageData(f.color);
    const sc = sizeOf(f.color);
    if (sc.w !== fw || sc.h !== fh) throw new Error(`makeLitSheet(${key}): frame ${f.name} is ${sc.w}×${sc.h}, expected ${fw}×${fh}`);
    cctx.putImageData(col, x, y);
    nctx.putImageData(opaqueNormals(toImageData(f.normal), col), x, y);
    if (f.emissive && ectx) ectx.putImageData(toImageData(f.emissive), x, y);
  });
  replaceTexture(scene, key);
  replaceTexture(scene, `${key}:n`);
  const tex = scene.textures.addImage(key, colorCv as unknown as HTMLImageElement, normalCv as unknown as HTMLImageElement)!;
  scene.textures.addImage(`${key}:n`, normalCv as unknown as HTMLImageElement);
  const named = scene.textures.get(`${key}:n`);
  replaceTexture(scene, `${key}:e`);
  const emissiveTex = emissiveCv ? scene.textures.addImage(`${key}:e`, emissiveCv as unknown as HTMLImageElement) : null;
  frames.forEach((f, i) => {
    const x = (i % cols) * fw;
    const y = Math.floor(i / cols) * fh;
    tex.add(f.name, 0, x, y, fw, fh);
    named.add(f.name, 0, x, y, fw, fh);
    emissiveTex?.add(f.name, 0, x, y, fw, fh);
  });
  return tex;
}

// ================================================================ sprites

/** Put an Image/Sprite on the lit pipeline (optionally with a material). Returns the object. */
export function useLighting<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(obj: T, material?: LitMaterial): T {
  obj.setPipeline(HD_LIGHT);
  if (material) setLitMaterial(obj, material);
  return obj;
}

export function setLitMaterial(obj: Phaser.GameObjects.GameObject, m: LitMaterial): void {
  (obj as unknown as { setPipelineData(k: string, v: unknown): void }).setPipelineData('hdMat', [m.spec ?? DEFAULT_MAT[0], m.shine ?? DEFAULT_MAT[1], m.emissive ?? DEFAULT_MAT[2], 0]);
}

export interface LitSpriteOpts {
  depth?: number;
  flipX?: boolean;
  origin?: [number, number];
  material?: LitMaterial;
}

export function addLitSprite(scene: Phaser.Scene, x: number, y: number, key: string, frame?: string | number, opts: LitSpriteOpts = {}): Phaser.GameObjects.Sprite {
  const s = scene.add.sprite(x, y, key, frame);
  useLighting(s, opts.material);
  if (opts.depth !== undefined) s.setDepth(opts.depth);
  if (opts.flipX) s.setFlipX(true);
  if (opts.origin) s.setOrigin(opts.origin[0], opts.origin[1]);
  return s;
}

// ================================================================ light handles

export interface LightTarget {
  x?: number;
  y?: number;
  color?: number;
  radius?: number;
  intensity?: number;
  height?: number;
}

export interface LightHandle {
  readonly light: Phaser.GameObjects.Light;
  readonly alive: boolean;
  setPosition(x: number, y: number): LightHandle;
  setColor(color: number): LightHandle;
  setIntensity(v: number): LightHandle;
  setRadius(r: number): LightHandle;
  setHeight(h: number): LightHandle;
  /** Tween any of x/y/color/radius/intensity/height over `ms` of scene time (follows scene speed). Resolves when done. */
  tweenTo(to: LightTarget, ms: number, ease?: string): Promise<void>;
  destroy(): void;
}

function rgbOf(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}

class Handle implements LightHandle {
  alive = true;
  constructor(
    protected owner: HDLighting,
    readonly light: LightWithHeight,
  ) {}
  setPosition(x: number, y: number): this {
    this.light.x = x;
    this.light.y = y;
    return this;
  }
  setColor(color: number): this {
    const [r, g, b] = rgbOf(color);
    this.light.color.set(r, g, b);
    return this;
  }
  setIntensity(v: number): this {
    this.light.intensity = v;
    return this;
  }
  setRadius(r: number): this {
    this.light.radius = r;
    return this;
  }
  setHeight(h: number): this {
    this.light.hdHeight = h;
    return this;
  }
  tweenTo(to: LightTarget, ms: number, ease = 'Sine.InOut'): Promise<void> {
    const L = this.light;
    const from = { x: L.x, y: L.y, r: L.color.r, g: L.color.g, b: L.color.b, radius: L.radius, intensity: L.intensity, height: L.hdHeight ?? DEFAULT_LIGHT_HEIGHT };
    const dst = to.color !== undefined ? rgbOf(to.color) : null;
    const k = { t: 0 };
    return tween(this.owner.scene, {
      targets: k,
      t: 1,
      duration: Math.max(1, ms),
      ease,
      onUpdate: () => {
        if (!this.alive) return;
        const t = k.t;
        if (to.x !== undefined) L.x = from.x + (to.x - from.x) * t;
        if (to.y !== undefined) L.y = from.y + (to.y - from.y) * t;
        if (to.radius !== undefined) L.radius = from.radius + (to.radius - from.radius) * t;
        if (to.intensity !== undefined) L.intensity = from.intensity + (to.intensity - from.intensity) * t;
        if (to.height !== undefined) L.hdHeight = from.height + (to.height - from.height) * t;
        if (dst) L.color.set(from.r + (dst[0] - from.r) * t, from.g + (dst[1] - from.g) * t, from.b + (dst[2] - from.b) * t);
      },
    });
  }
  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.owner.release(this);
  }
}

/** Where a rim light follows: a game object (its position), or a function returning a world point. */
export type RimFollow = Phaser.GameObjects.GameObject & { x: number; y: number } | (() => { x: number; y: number });

export interface RimLightOpts {
  /** Offset of the light from the followed point, px. Default: 72 px along the duel axis, on the owner's side. */
  dx?: number;
  dy?: number;
  /** Extra offset applied to a followed game object's position (e.g. up to the monster's chest). Default (0, -50). */
  followDx?: number;
  followDy?: number;
  color?: number;
  intensity?: number;
  radius?: number;
  height?: number;
}

export interface RimLightHandle extends LightHandle {
  /** Re-aim the light at something else. */
  follow(target: RimFollow): void;
  /** Scale intensity (e.g. 0 while the monster is hidden, > 1 for a charge-up). */
  setGain(g: number): void;
}

class RimHandle extends Handle implements RimLightHandle {
  private gain = 1;
  private readonly tick = () => this.place();
  constructor(
    owner: HDLighting,
    light: LightWithHeight,
    private target: RimFollow,
    private dx: number,
    private dy: number,
    private fdx: number,
    private fdy: number,
    private base: number,
  ) {
    super(owner, light);
    owner.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.tick);
    this.place();
  }
  private place(): void {
    if (!this.alive) return;
    const t = this.target;
    let p: { x: number; y: number };
    if (typeof t === 'function') p = t();
    else {
      const o = t as unknown as { x: number; y: number; corePoint?: () => { x: number; y: number } };
      p = o.corePoint ? o.corePoint() : { x: o.x + this.fdx, y: o.y + this.fdy };
    }
    this.light.x = p.x + this.dx;
    this.light.y = p.y + this.dy;
    this.light.intensity = this.base * this.gain;
  }
  follow(t: RimFollow): void {
    this.target = t;
    this.place();
  }
  setGain(g: number): void {
    this.gain = g;
    this.place();
  }
  override setIntensity(v: number): this {
    this.base = v;
    this.place();
    return this;
  }
  override destroy(): void {
    this.owner.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tick);
    super.destroy();
  }
}

// ================================================================ per-scene manager

const FALLBACK_SIDE: Record<PlayerId, { color: number; intensity: number; radius: number }> = {
  0: { color: 0x3fe0ea, intensity: 0.95, radius: 190 },
  1: { color: 0xff4d5e, intensity: 0.95, radius: 190 },
};

const managers = new WeakMap<Phaser.Scene, HDLighting>();

/** The lighting manager of a scene (created and enabled on first use). */
export function getLighting(scene: Phaser.Scene): HDLighting {
  let m = managers.get(scene);
  if (!m) {
    m = new HDLighting(scene);
    managers.set(scene, m);
  }
  return m;
}

export class HDLighting {
  private handles = new Set<Handle>();
  private theme: ArenaTheme | null = null;

  constructor(readonly scene: Phaser.Scene) {
    scene.lights.enable();
    this.ambient(0x12163a, 1);
    const cleanup = () => {
      this.handles.clear();
      managers.delete(scene);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  get enabled(): boolean {
    return state.enabled;
  }
  setEnabled(on: boolean): void {
    setLightingEnabled(on);
  }

  /** Ambient light: a colour (0xRRGGBB) scaled by `intensity` (may exceed 1). Lit sprites render at colour × (ambient + lights). */
  ambient(color: number, intensity = 1): void {
    const [r, g, b] = rgbOf(color);
    this.scene.lights.ambientColor.set(r * intensity, g * intensity, b * intensity);
  }

  addPointLight(x: number, y: number, color: number, radius: number, intensity: number, height = DEFAULT_LIGHT_HEIGHT): LightHandle {
    const light = this.scene.lights.addLight(x, y, radius, color, intensity) as LightWithHeight;
    light.hdHeight = height;
    const h = new Handle(this, light);
    this.handles.add(h);
    return h;
  }

  /** @internal */
  release(h: Handle): void {
    this.handles.delete(h);
    this.scene.lights.removeLight(h.light);
  }

  /** Lights currently alive (Phaser draws at most maxLights per camera: keep it under ~14). */
  get count(): number {
    return this.handles.size;
  }

  /** Take ambient + the owners' rim-light defaults from an arena theme. */
  applyTheme(theme: ArenaTheme): void {
    this.theme = theme;
    this.ambient(theme.lighting.ambient, theme.lighting.ambientIntensity);
  }

  sideLightSpec(player: PlayerId): { color: number; intensity: number; radius: number } {
    return this.theme?.lighting.sideLight[player] ?? FALLBACK_SIDE[player];
  }

  /**
   * The two static side lights of the arena (docs/STYLE_HD.md §5): P1 cyan beyond the lower-left of the board,
   * P2 crimson beyond the upper-right. They paint soft colour pools on the floor; the monsters' own rim lights
   * (ownerRimLight) are separate and follow them. Colours / strength come from the theme.
   */
  sideLights(): LightHandle[] {
    return ([0, 1] as PlayerId[]).map((p) => {
      const spec = this.sideLightSpec(p);
      const tile = hdZoneXY(p, 'monster', 1);
      const dir = p === 0 ? -1 : 1;
      return this.addPointLight(tile.x + dir * 190, tile.y - dir * 60, spec.color, spec.radius * 2.1, spec.intensity * 0.85, 90);
    });
  }

  /**
   * The owner's rim light: P1 cyan from the lower-left, P2 crimson from the upper-right (along the duel axis),
   * low and close so it grazes the monster's edge, following `follow` every frame.
   */
  ownerRimLight(player: PlayerId, follow: RimFollow, opts: RimLightOpts = {}): RimLightHandle {
    const side = this.sideLightSpec(player);
    const dir = player === 0 ? -1 : 1;
    const light = this.scene.lights.addLight(0, 0, opts.radius ?? side.radius, opts.color ?? side.color, opts.intensity ?? side.intensity) as LightWithHeight;
    light.hdHeight = opts.height ?? 26;
    const h = new RimHandle(this, light, follow, opts.dx ?? dir * 64, opts.dy ?? -dir * 32, opts.followDx ?? 0, opts.followDy ?? -50, opts.intensity ?? side.intensity);
    this.handles.add(h);
    return h;
  }

  /**
   * A short pulse of light for impacts / summons: rises to `peak` in the first ~18 % of `ms`, then falls off
   * (exponential-ish), while the radius punches out. Resolves when it is gone.
   */
  flashLight(x: number, y: number, color: number, ms = 260, peak = 1.6, radius = 240, height = 70): Promise<void> {
    const h = this.addPointLight(x, y, color, radius * 0.7, 0, height);
    const k = { t: 0 };
    return tween(this.scene, {
      targets: k,
      t: 1,
      duration: Math.max(1, ms),
      ease: 'Linear',
      onUpdate: () => {
        if (!h.alive) return;
        const t = k.t;
        const rise = 0.18;
        const v = t < rise ? Math.sin((t / rise) * Math.PI * 0.5) : Math.pow(1 - (t - rise) / (1 - rise), 2.2);
        h.setIntensity(peak * v);
        h.setRadius(radius * (0.7 + 0.45 * Math.min(1, t * 2.2)));
      },
    }).then(() => h.destroy());
  }
}
