// The subtle light layer (golden rule 3) — public API. Arena v2 only: in v1 every call is a
// no-op (handles are inert, promises resolve at once), so cinematics can call it freely.
//
//   import { lightFlash, lightPool, lightBeam, lightDim, addLight } from '../view/light';
//
//   // impact on a monster: a quick flash on the floor under it + a soft bloom at the hit point
//   void lightFlash(scene, core.x, core.y, PAL.fire3, 44, 320, { floorY: unit.home.y, ring: true });
//
//   // a held glow (charging orb), then gone
//   const glow = lightPool(scene, orb.x, orb.y, { color: PAL.void3, radius: 30, floorY: unit.home.y, air: 0.8, anim: 'breathe' });
//   glow.follow(orbSprite);            // the floor pool slides along under it
//   await glow.fadeOut(200);
//
//   // a beam's soft glow (+ a strip on the floor between the two units)
//   lightBeam(scene, muzzle, target, PAL.cyan3, 600, { width: 12, floor: { from: a.home, to: b.home } });
//
//   await lightDim(scene, 1, 400);     // dramatic: the arena darkens, lit monsters stand out
//   await lightDim(scene, 0, 600);     // back to normal (−1 … 0 brightens)
//
//   // the arena registers its static lights (floodlight pools, neon inlay halos)
//   addLight(scene, { x: 320, y: 176, radius: 90, color: PAL.white, group: 'flood' });
//   addLight(scene, { kind: 'line', x: 60, y: 166, x2: 300, y2: 46, width: 6, color: PAL.cyan3, group: 'neon' });
//
// Coordinates are world pixels (the main camera's space, like zoneXY / unit.core()).
// (x, y) is always the light SOURCE; `floorY` is the floor under it (default y = it lies on
// the floor). Pools land at (x, floorY); air glows (opts.air) sit at (x, y).

import type Phaser from 'phaser';
import type { Attribute } from '../../data/cards';
import { ARENA_V2, type XY } from '../layout';
import {
  type BeamHandle,
  type BeamOpts,
  type FlashOpts,
  type LightBlend,
  type LightFieldSource,
  type LightGroup,
  type LightHandle,
  LightLayer,
  type PoolOpts,
} from './LightLayer';
import { ATTRIBUTE_LIGHT, type LightAnim } from './profiles';

export {
  LIGHT_DEPTH,
  LightLayer,
  type BeamHandle,
  type BeamOpts,
  type FlashOpts,
  type FollowOpts,
  type Followable,
  type LightBlend,
  type LightFieldSource,
  type LightGroup,
  type LightHandle,
  type PoolOpts,
} from './LightLayer';
export { ATTRIBUTE_LIGHT, MONSTER_GLOW, type LightAnim } from './profiles';
export { ensureLightTextures } from './textures';

const layers = new WeakMap<Phaser.Scene, LightLayer>();

function urlParams(): URLSearchParams | null {
  try {
    return typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  } catch {
    return null;
  }
}

/**
 * The scene's light layer — created on first use in arena v2 (null in v1, unless a layer was
 * forced with ensureLightLayer(scene, { force: true })). Destroyed with the scene (SHUTDOWN).
 */
export function lightLayer(scene: Phaser.Scene): LightLayer | null {
  const have = layers.get(scene);
  if (have) return have;
  if (!ARENA_V2) return null;
  return ensureLightLayer(scene);
}

/** Create (or get) the scene's light layer. `force` creates it even in arena v1 (previews). */
export function ensureLightLayer(scene: Phaser.Scene, o: { force?: boolean; field?: LightFieldSource | null } = {}): LightLayer | null {
  let layer = layers.get(scene) ?? null;
  if (!layer) {
    if (!ARENA_V2 && !o.force) return null;
    const p = urlParams();
    const gainParam = Number(p?.get('lightgain'));
    layer = new LightLayer(scene, { enabled: p?.get('light') !== '0', gain: Number.isFinite(gainParam) && gainParam > 0 ? gainParam : 1 });
    layers.set(scene, layer);
    const made = layer;
    made.onDestroy = () => {
      if (layers.get(scene) === made) layers.delete(scene);
    };
    installQa(scene, made);
  }
  if (o.field !== undefined) layer.bindField(o.field);
  return layer;
}

/** True when the scene has a live light layer. */
export function hasLight(scene: Phaser.Scene): boolean {
  return !!layers.get(scene);
}

/** Point the layer at the units / tiles to light (DuelScene passes its FieldView). */
export function bindLightField(scene: Phaser.Scene, field: LightFieldSource | null): void {
  lightLayer(scene)?.bindField(field);
}

/** Quality toggle (the L key in dev builds does the same). */
export function setLightEnabled(scene: Phaser.Scene, on: boolean): void {
  lightLayer(scene)?.setEnabled(on);
}

export function lightEnabled(scene: Phaser.Scene): boolean {
  return layers.get(scene)?.enabled ?? false;
}

// ---------------------------------------------------------------- event lights (cinematics)

/**
 * A one-shot light flash (impacts, summons, sparks): quick rise, eased decay over `ms`
 * (scene time). Floor pool at (x, floorY) + spill, a soft air bloom at (x, y) when the source
 * floats (floorY ≠ y; opts.air overrides), an expanding floor ring with opts.ring.
 * Resolves when it has faded.
 */
export function lightFlash(scene: Phaser.Scene, x: number, y: number, color: number, radius = 40, ms = 300, opts: FlashOpts = {}): Promise<void> {
  const L = lightLayer(scene);
  if (!L) return Promise.resolve();
  return L.flash(x, y, color, radius, ms, opts).whenDone();
}

/**
 * A held light pool (charging glows, projectiles, auras): fades in, lives until fadeOut() /
 * destroy(). Handle: setPosition(x, y, floorY?), setColor, setIntensity(k, ms), setRadius(rx, ry, ms),
 * follow(target, { dx, dy, floorY }), fadeOut(ms), destroy().
 */
export function lightPool(scene: Phaser.Scene, x: number, y: number, opts: PoolOpts = {}): LightHandle {
  const L = lightLayer(scene);
  if (!L) return NOOP;
  return L.pool(x, y, { group: 'fx', ...opts });
}

/**
 * Soft glow along a beam from → to (air glow over units, under the FX band) + an optional floor
 * strip (opts.floor = the two floor points). ms > 0: rises (70 ms), holds, falls (35%) and is
 * removed — `done` resolves then. ms = 0: stays until fadeOut() / destroy(). setEnds() moves it.
 */
export function lightBeam(scene: Phaser.Scene, from: XY, to: XY, color: number, ms = 400, opts: BeamOpts = {}): BeamHandle {
  const L = lightLayer(scene);
  if (!L) return NOOP;
  return L.beam(from, to, color, ms, opts, 'fx');
}

/**
 * Global dim / brighten for dramatic moments, eased over `ms`. level 1 = full dim (the arena
 * below the units darkens to ~45% with a night-blue cast, floodlights drop, monster lights
 * rise a little); 0 = normal; −1 = full brighten (floodlights surge, a faint cool wash).
 * Effects drawn at DEPTH.TILE_FX and above (magic circles, highlights, units, VFX) are not dimmed.
 */
export function lightDim(scene: Phaser.Scene, level: number, ms = 350): Promise<void> {
  const L = lightLayer(scene);
  if (!L) return Promise.resolve();
  return L.setDim(level, ms);
}

/** Dim (or brighten) for a while, then back to normal. Resolves when restored. */
export async function lightDimFor(scene: Phaser.Scene, level: number, holdMs: number, inMs = 300, outMs = 500): Promise<void> {
  const L = lightLayer(scene);
  if (!L) return;
  await L.setDim(level, inMs);
  await new Promise<void>((r) => scene.time.delayedCall(holdMs, r));
  if (layers.get(scene) === L) await L.setDim(0, outMs);
}

/** Current dim level (0 when there is no layer). */
export function lightDimLevel(scene: Phaser.Scene): number {
  return layers.get(scene)?.dimLevel ?? 0;
}

/**
 * Current gain of a light group including its response to the global dim (1 when there is no
 * layer). For lights drawn by other modules each frame (e.g. the arena's own floodlight pools /
 * cones): multiply their alpha by lightGroupGain(scene, 'flood') so they follow lightDim too.
 */
export function lightGroupGain(scene: Phaser.Scene, group: LightGroup): number {
  return layers.get(scene)?.groupGain(group) ?? 1;
}

/** The floor-light colour of an attribute (IŞIK gold-white, KARANLIK violet, ...). */
export function attributeLightColor(attr: Attribute): number {
  return ATTRIBUTE_LIGHT[attr].color;
}

// ---------------------------------------------------------------- static lights (arena)

export interface StaticLightSpec {
  /** 'pool' (default): a soft ellipse on the floor at (x, y). 'line': a soft strip (x, y) → (x2, y2). */
  kind?: 'pool' | 'line';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  /** Pool radius (rx, default 60; ry defaults to radius / 2). */
  radius?: number;
  ry?: number;
  /** Line thickness (default 8). */
  width?: number;
  color: number;
  /** Pool spill colour (default = color; null = none). */
  spill?: number | null;
  /** Intensity multiplier (1 = default budget). */
  intensity?: number;
  /** 'flood' (dims the most), 'neon' (dims a little), 'ambient' (default). */
  group?: 'flood' | 'neon' | 'ambient';
  /** Motion (default 'steady'). */
  anim?: LightAnim;
  blend?: LightBlend;
  /** Depth (default LIGHT_DEPTH.STATIC — under the dim veil). */
  depth?: number;
}

/**
 * Register a static arena light (floodlight pool, neon inlay halo, ambient glow). It lives with
 * the scene; the handle can move / recolour / fade it (e.g. floodlights switching on one by one
 * in the opening: addLight(...).setIntensity(0).setIntensity(1, 300)). Groups react to the
 * global dim; setLightGroup fades a whole group.
 */
export function addLight(scene: Phaser.Scene, spec: StaticLightSpec): LightHandle {
  const L = lightLayer(scene);
  if (!L) return NOOP;
  const group: LightGroup = spec.group ?? 'ambient';
  if (spec.kind === 'line') {
    const a = { x: spec.x, y: spec.y };
    const b = { x: spec.x2 ?? spec.x, y: spec.y2 ?? spec.y };
    const w = spec.width ?? 8;
    return L.beam(a, b, spec.color, 0, { air: false, floor: { from: a, to: b }, floorWidth: w, width: w, intensity: spec.intensity ?? 1, shimmer: 0, depth: spec.depth }, group);
  }
  return L.pool(spec.x, spec.y, {
    color: spec.color,
    spill: spec.spill,
    radius: spec.radius ?? 60,
    ry: spec.ry,
    intensity: spec.intensity ?? 1,
    anim: spec.anim ?? 'steady',
    blend: spec.blend,
    depth: spec.depth,
    group,
    fadeIn: 0,
  });
}

/** Fade a whole light group to `k` (1 = normal) over `ms` (e.g. 'flood' 0 → 1 in the opening). */
export function setLightGroup(scene: Phaser.Scene, group: LightGroup, k: number, ms = 0): Promise<void> {
  const L = lightLayer(scene);
  if (!L) return Promise.resolve();
  return L.setGroup(group, k, ms);
}

// ---------------------------------------------------------------- inert handle (v1 / no layer)

const NOOP: BeamHandle = {
  alive: false,
  done: Promise.resolve(),
  setPosition: () => NOOP,
  setColor: () => NOOP,
  setIntensity: () => NOOP,
  setRadius: () => NOOP,
  follow: () => NOOP,
  setEnds: () => NOOP,
  fadeOut: () => Promise.resolve(),
  destroy: () => undefined,
};

// ---------------------------------------------------------------- QA

function installQa(scene: Phaser.Scene, layer: LightLayer): void {
  const w = window as unknown as { __neon?: Record<string, unknown> };
  if (!w.__neon) return;
  w.__neon.light = {
    layer,
    /** Toggle / set the light layer (returns the new state). */
    on: (v?: boolean) => {
      layer.setEnabled(v ?? !layer.enabled);
      return layer.enabled;
    },
    gain: (k?: number) => {
      if (k !== undefined) layer.gain = k;
      return layer.gain;
    },
    stats: () => layer.stats(),
    flash: (x: number, y: number, color: number, radius?: number, ms?: number, o?: FlashOpts) => lightFlash(scene, x, y, color, radius, ms, o),
    pool: (x: number, y: number, o?: PoolOpts) => lightPool(scene, x, y, o),
    beam: (from: XY, to: XY, color: number, ms?: number, o?: BeamOpts) => lightBeam(scene, from, to, color, ms, o),
    dim: (level: number, ms?: number) => lightDim(scene, level, ms),
    add: (spec: StaticLightSpec) => addLight(scene, spec),
    group: (g: LightGroup, k: number, ms?: number) => setLightGroup(scene, g, k, ms),
  };
}
