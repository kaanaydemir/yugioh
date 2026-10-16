// Art Lab A — arena: a small floating stone-and-wood duel platform over a sunset sea of clouds.
//
// Layers (LAB_DEPTH):
//   SKY        baked sky: gradient, sun, hazy ranges, far islands, far cloud rows   (+1 sun glow, stars, waterfall sparkle)
//   BACKDROP   4 drifting cloud strips (nearer = faster, integer px, wrapping)
//   PLATFORM   baked platform: floor, mats, slab sides, rock keel, back rim + railing, flowers
//   FLOOR_FX   soft light pools of the lanterns (masked to the platform, ADD, alpha flicker)
//   ACTORS     (the lab's monsters)
//   PROPS_FRONT baked front rim, corner posts, pedestal, front flowers (+ lanterns, banners, pennants, petals)
//   LIGHT      lantern halos, firefly glows (ADD)
// Every moving thing is a pure function of lab time t (update(t)), so pause / speed / seek / restart
// need nothing from us. setFx(false) hides the soft light layer and the ambient particles only.

import type Phaser from 'phaser';
import { PixelCanvas } from '../../art/pixel';
import { canvasTexture, sheetTexture } from '../../art/textures';
import { LAB_DEPTH, type LabArena, type XY } from '../types';
import { HA, HB, hash, scr, scrI, SLOT_A } from './arena-iso';
import { ANCHORS, CORNER_POST_H, drawFront, drawPlatform, FRONT_POSTS, PEDESTAL_H } from './arena-platform';
import {
  banner,
  bandedPool,
  bannerSize,
  CUBE_LANTERN,
  cubeLantern,
  fallsSparkle,
  firefly,
  flickerAt,
  glow,
  HANG_LANTERN,
  hangLantern,
  petal,
  POST_LANTERN,
  postLantern,
  star,
  swag,
  type BannerSpec,
} from './arena-props';
import { CLOUD_LAYERS, drawCloudLayer, drawSkyBleed, FALL, fallsSpan, ISLANDS, SKY_BLEED, SUN_X, SUN_Y } from './arena-sky';
import { A_LIGHT, A_RAMPS } from './palette';

const KEY = 'artlab:A:arena:';
const ADD = 1; // Phaser.BlendModes.ADD

type Img = Phaser.GameObjects.Image;

export function buildArenaA(scene: Phaser.Scene): LabArena {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const fxObjs: Phaser.GameObjects.GameObject[] = [];
  const keys: string[] = [];
  const animators: ((t: number) => void)[] = [];
  let fxOn = true;

  /** Texture sizes, so soft lights can be placed by their integer top-left corner. */
  const sizes = new Map<string, { w: number; h: number }>();
  const tex = (name: string, pc: PixelCanvas): string => {
    const k = canvasTexture(scene, KEY + name, pc);
    keys.push(k);
    sizes.set(k, { w: pc.w, h: pc.h });
    return k;
  };
  const sheet = (name: string, frames: PixelCanvas[]): string => {
    const k = sheetTexture(
      scene,
      KEY + name,
      frames[0].w,
      frames[0].h,
      frames.map((f, i) => [String(i), f] as [string, PixelCanvas]),
    );
    keys.push(k);
    return k;
  };
  const image = (x: number, y: number, key: string, depth: number, frame?: string): Img => {
    const im = scene.add.image(Math.round(x), Math.round(y), key, frame).setOrigin(0, 0).setDepth(depth);
    objs.push(im);
    return im;
  };
  /** Half size (floor) of a soft-light texture: glow() / bandedPool() are (2r+1)² → r. */
  const half = (key: string) => {
    const z = sizes.get(key)!;
    return { x: z.w >> 1, y: z.h >> 1 };
  };
  /**
   * Soft-light sprite: white glow texture, tinted, ADD, centred on the pixel (x, y); part of the fx
   * layer. Origin 0 at an INTEGER top-left (like fx-manager place()), so the light layer stays on
   * the art grid at the 2× inspection zoom too (origin 0.5 on the odd-sized glow textures put its
   * top-left on .5 positions → a 1-screen-px offset at 2×).
   */
  const light = (x: number, y: number, key: string, depth: number, tint: number, alpha: number): Img => {
    const h = half(key);
    const im = scene.add
      .image(Math.round(x) - h.x, Math.round(y) - h.y, key)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setTint(tint)
      .setBlendMode(ADD)
      .setAlpha(alpha);
    objs.push(im);
    fxObjs.push(im);
    return im;
  };

  // ---------------------------------------------------------------- sky + clouds
  // the sky (and the cloud strips below) bleed SKY_BLEED px past the world on every side, so the
  // impact shake (≤ fx.maxShake px of camera scroll) never reveals the camera background
  image(-SKY_BLEED, -SKY_BLEED, tex('sky', drawSkyBleed()), LAB_DEPTH.SKY);

  const sunGlow = light(SUN_X, SUN_Y, tex('sunglow', glow(64, 48, 1, 2.2)), LAB_DEPTH.SKY + 1, A_LIGHT.sun, 0.32);
  animators.push((t) => sunGlow.setAlpha(0.3 + 0.05 * Math.sin(t / 1300) + 0.02 * Math.sin(t / 410)));

  const STARS: { x: number; y: number; bright: boolean; per: number }[] = [
    { x: 46, y: 6, bright: true, per: 2300 },
    { x: 162, y: 14, bright: false, per: 1700 },
    { x: 318, y: 6, bright: true, per: 2900 },
    { x: 446, y: 22, bright: false, per: 2100 },
    { x: 612, y: 10, bright: false, per: 2600 },
    { x: 262, y: 32, bright: false, per: 1900 },
  ];
  const starKeys = [tex('star0', star(false)), tex('star1', star(true))];
  STARS.forEach((s, i) => {
    const im = image(s.x - 1, s.y - 1, starKeys[s.bright ? 1 : 0], LAB_DEPTH.SKY + 1);
    animators.push((t) => {
      const v = Math.sin((t / s.per) * Math.PI * 2 + i * 1.7);
      im.setAlpha(v > 0.2 ? 1 : v > -0.4 ? 0.55 : 0.2);
    });
  });

  for (const is of ISLANDS) {
    if (is.falls === undefined) continue;
    // sparkle runs down the solid upper part of the (short, dim) stream only
    const f = fallsSpan(is);
    const h = Math.round(f.len * 0.7);
    const k = sheet(`falls${is.seed}`, [0, 1, 2].map((fr) => fallsSparkle(h, fr, FALL[2], FALL[1])));
    const im = image(f.x - 1, f.y + 1, k, LAB_DEPTH.SKY + 2, '0');
    animators.push((t) => im.setFrame(String(Math.floor(t / 140) % 3)));
  }

  CLOUD_LAYERS.forEach((layer, i) => {
    const pc = new PixelCanvas(640, layer.bottom - layer.top);
    drawCloudLayer(pc, layer);
    const k = tex(`clouds${i}`, pc);
    // three copies of the 640-px periodic strip, phase-shifted by the bleed: together they always
    // cover x = -SKY_BLEED .. 640 + SKY_BLEED whatever the drift offset
    const copies = [-640, 0, 640].map((dx) => ({ im: image(dx, layer.top, k, LAB_DEPTH.BACKDROP + i), dx }));
    animators.push((t) => {
      const off = (Math.floor((t / 1000) * layer.speed) % 640) - SKY_BLEED;
      for (const c of copies) c.im.x = off + c.dx;
    });
  });

  // ---------------------------------------------------------------- platform
  const platPc = new PixelCanvas(640, 360);
  drawPlatform(platPc);
  image(0, 0, tex('platform', platPc), LAB_DEPTH.PLATFORM);
  const frontPc = new PixelCanvas(640, 360);
  drawFront(frontPc);
  image(0, 0, tex('front', frontPc), LAB_DEPTH.PROPS_FRONT);

  /**
   * A lantern's light pool, baked twice from one banded ellipse: masked to the platform layer (under
   * the actors, FLOOR_FX) and masked to the front layer (rim / pedestal, just above it). The actors
   * themselves are never lit, so they stay flat and crisp.
   */
  const pools = (name: string, cx: number, cy: number, rx: number, ry: number, bands: number[], smooth = false): Img[] => {
    cx = Math.round(cx);
    cy = Math.round(cy);
    const ox = cx - rx;
    const oy = cy - ry;
    const make = (mask: (x: number, y: number) => number) => (smooth ? glow(rx, ry, bands[0], 1.6, mask) : bandedPool(rx, ry, bands, mask));
    const under = tex(`${name}-floor`, make((x, y) => (platPc.isOpaque(ox + x, oy + y) && !frontPc.isOpaque(ox + x, oy + y) ? 1 : 0)));
    const over = tex(`${name}-rim`, make((x, y) => (frontPc.isOpaque(ox + x, oy + y) ? 0.8 : 0)));
    return [light(cx, cy, under, LAB_DEPTH.FLOOR_FX, A_LIGHT.lantern, 1), light(cx, cy, over, LAB_DEPTH.PROPS_FRONT + 0.5, A_LIGHT.lantern, 1)];
  };

  // warm sunset spill on the sun side of the floor (soft light, slow shimmer with the sun)
  {
    const c = scr(HA - 46, -10);
    const spill = pools('sunspill', c.x, c.y, 150, 75, [0.16], true);
    animators.push((t) => {
      const k = 0.9 + 0.1 * Math.sin(t / 1300);
      for (const q of spill) q.setAlpha(k).setTint(A_LIGHT.sun);
    });
  }

  // ---------------------------------------------------------------- lanterns
  interface Lantern {
    at: XY;
    kind: 'post' | 'cube' | 'hang';
    phase: number;
    /** Centre of its light pool (iso, on the floor) — pulled inward from the corner. */
    pool?: { a: number; b: number };
  }
  const lanterns: Lantern[] = [
    {
      at: scr(ANCHORS.leftCorner.a, ANCHORS.leftCorner.b, CORNER_POST_H),
      kind: 'post',
      phase: 0,
      pool: { a: ANCHORS.leftCorner.a + 12, b: ANCHORS.leftCorner.b + 12 },
    },
    {
      at: scr(ANCHORS.rightCorner.a, ANCHORS.rightCorner.b, CORNER_POST_H),
      kind: 'post',
      phase: 410,
      pool: { a: ANCHORS.rightCorner.a - 12, b: ANCHORS.rightCorner.b - 12 },
    },
    {
      at: scr(ANCHORS.bottomCorner.a, ANCHORS.bottomCorner.b, PEDESTAL_H),
      kind: 'cube',
      phase: 230,
      pool: { a: ANCHORS.bottomCorner.a + 12, b: ANCHORS.bottomCorner.b - 12 },
    },
    ...FRONT_POSTS.map((a, i) => ({ at: scr(a, HB, -1), kind: 'hang' as const, phase: 600 + i * 270 })),
  ];
  const postKey = sheet('lantern-post', [0, 1, 2, 3].map(postLantern));
  const cubeKey = sheet('lantern-cube', [0, 1, 2, 3].map(cubeLantern));
  const hangKey = sheet('lantern-hang', [0, 1, 2, 3].map(hangLantern));
  const halo = { post: tex('halo-post', glow(12, 12, 1, 2)), cube: tex('halo-cube', glow(16, 16, 1, 2)), hang: tex('halo-hang', glow(9, 9, 1, 2)) };
  lanterns.forEach((L, i) => {
    const spec = L.kind === 'post' ? POST_LANTERN : L.kind === 'cube' ? CUBE_LANTERN : HANG_LANTERN;
    const key = L.kind === 'post' ? postKey : L.kind === 'cube' ? cubeKey : hangKey;
    const x = Math.round(L.at.x) - spec.ax;
    const y = Math.round(L.at.y) - spec.ay;
    const im = image(x, y, key, LAB_DEPTH.PROPS_FRONT + 1, '0');
    // halo around the glass
    const gx = x + spec.ax;
    const gy = L.kind === 'hang' ? y + 6 : L.kind === 'cube' ? y + 14 : y + 10;
    const h = light(gx, gy, halo[L.kind], LAB_DEPTH.LIGHT, A_LIGHT.lantern, 0.5);
    let pl: Img[];
    if (L.kind === 'hang') pl = pools(`pool${i}`, gx, gy + 2, 18, 12, [0.42, 0.3, 0.18, 0.08]);
    else {
      const c = scr(L.pool!.a, L.pool!.b);
      const rx = L.kind === 'cube' ? 58 : 48;
      pl = pools(`pool${i}`, c.x, c.y, rx, rx / 2, L.kind === 'cube' ? [0.6, 0.46, 0.34, 0.22, 0.1] : [0.52, 0.4, 0.28, 0.17, 0.07]);
    }
    animators.push((t) => {
      const f = flickerAt(t, L.phase);
      im.setFrame(String(f.frame));
      h.setAlpha(0.42 * f.k);
      for (const q of pl) q.setAlpha(0.55 + 0.45 * f.k);
    });
  });

  // ---------------------------------------------------------------- banners + pennants
  const T = A_RAMPS.bannerTeal;
  const R = A_RAMPS.bannerRed;
  const banners: { spec: BannerSpec; rod: XY; phase: number }[] = [
    { spec: { w: 14, len: 30, ramp: T, emblem: 'crystal', slope: 0.5 }, rod: scr(-HA, -44, -1), phase: 0 },
    { spec: { w: 14, len: 26, ramp: T, emblem: 'crystal', slope: 0.5 }, rod: scr(-HA, 24, -1), phase: 1 },
    { spec: { w: 14, len: 30, ramp: T, emblem: 'crystal', slope: -0.5 }, rod: scr(-104, HB, -1), phase: 2 },
    { spec: { w: 14, len: 30, ramp: R, emblem: 'moon', slope: -0.5 }, rod: scr(70, HB, -1), phase: 3 },
    { spec: { w: 14, len: 26, ramp: R, emblem: 'moon', slope: -0.5 }, rod: scr(98, HB, -1), phase: 1 },
  ];
  banners.forEach((b, i) => {
    const sz = bannerSize(b.spec);
    const k = sheet(`banner${i}`, [0, 1, 2, 3].map((f) => banner(b.spec, f)));
    const im = image(Math.round(b.rod.x) - sz.ax, Math.round(b.rod.y) - sz.ay, k, LAB_DEPTH.PROPS_FRONT + 1, '0');
    animators.push((t) => im.setFrame(String((Math.floor(t / 190) + b.phase) % 4)));
  });

  {
    const p0 = scrI(FRONT_POSTS[0], HB, -3);
    const p1 = scrI(FRONT_POSTS[1], HB, -3);
    const s = { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, sag: 10, colors: [T, A_RAMPS.gold.slice(1), R] };
    const frames = [0, 1, 2, 3].map((f) => swag(s, f));
    const k = sheet('pennants', frames.map((f) => f.canvas));
    const im = image(frames[0].x, frames[0].y, k, LAB_DEPTH.PROPS_FRONT + 1, '0');
    animators.push((t) => im.setFrame(String(Math.floor(t / 160) % 4)));
  }

  // ---------------------------------------------------------------- ambient particles (fx)
  const petalKeys = [sheet('petal-w', [petal(false, 0), petal(false, 1)]), sheet('petal-p', [petal(true, 0), petal(true, 1)])];
  const PETALS = 9;
  for (let i = 0; i < PETALS; i++) {
    const pink = hash(i, 1, 201) < 0.5;
    const im = image(0, 0, petalKeys[pink ? 1 : 0], LAB_DEPTH.PROPS_FRONT + 3, '0');
    fxObjs.push(im);
    // spawn: flower clusters on the platform or drifting in from the left edge
    const src = i % 3;
    const x0 = src === 0 ? -6 : src === 1 ? 300 + hash(i, 2, 201) * 60 : 120 + hash(i, 2, 202) * 80;
    const y0 = src === 0 ? 110 + hash(i, 3, 201) * 120 : src === 1 ? 236 + hash(i, 3, 202) * 10 : 160 + hash(i, 3, 203) * 30;
    const life = 6 + hash(i, 4, 201) * 4; // s
    const per = life + 1 + hash(i, 5, 201) * 3;
    const vx = 10 + hash(i, 6, 201) * 9;
    const vy = 2.5 + hash(i, 7, 201) * 3;
    const ph = hash(i, 8, 201) * per;
    const sw = 1.6 + hash(i, 9, 201) * 1.2;
    animators.push((t) => {
      const tau = (t / 1000 + ph) % per;
      if (tau > life) {
        im.setVisible(false);
        return;
      }
      const x = x0 + vx * tau + 3 * Math.sin((tau / sw) * Math.PI * 2);
      const y = y0 + vy * tau + 1.5 * Math.sin((tau / sw) * Math.PI * 2 + 1.2);
      im.setVisible(fxOn).setPosition(Math.round(x), Math.round(y)).setFrame(String(Math.floor(tau * 4) % 2));
      im.setAlpha(Math.min(1, tau / 0.5, (life - tau) / 0.8));
    });
  }

  const flyKey = tex('firefly', firefly());
  const flyGlow = tex('firefly-glow', glow(4, 4, 1, 1.6));
  const flyHalf = half(flyGlow);
  const FLIES: XY[] = [
    { x: 126, y: 168 },
    { x: 512, y: 128 },
    { x: 300, y: 250 },
    { x: 390, y: 214 },
    { x: 160, y: 210 },
    { x: 472, y: 176 },
    { x: 214, y: 128 },
  ];
  FLIES.forEach((b, i) => {
    const core = image(b.x, b.y, flyKey, LAB_DEPTH.PROPS_FRONT + 3);
    const g = light(b.x, b.y, flyGlow, LAB_DEPTH.LIGHT, A_LIGHT.lantern, 0.6);
    fxObjs.push(core);
    const w1 = 0.45 + hash(i, 1, 301) * 0.4;
    const w2 = 0.7 + hash(i, 2, 301) * 0.5;
    const w3 = 0.9 + hash(i, 3, 301) * 0.8;
    const p1 = hash(i, 4, 301) * 6.28;
    const p2 = hash(i, 5, 301) * 6.28;
    animators.push((t) => {
      const s = t / 1000;
      const x = Math.round(b.x + 9 * Math.sin(s * w1 + p1) + 3 * Math.sin(s * w2 * 2.3 + p2));
      const y = Math.round(b.y + 5 * Math.sin(s * w2 + p2) + 2 * Math.sin(s * w1 * 1.7 + p1));
      const blink = Math.max(0, Math.sin(s * w3 + p1));
      const a = 0.15 + 0.85 * blink * blink;
      core.setPosition(x, y).setAlpha(a > 0.5 ? 1 : a > 0.25 ? 0.6 : 0.25);
      // glow centred on the 2×2 core, top-left on the integer grid (origin 0)
      g.setPosition(x + 1 - flyHalf.x, y + 1 - flyHalf.y).setAlpha(0.55 * a);
    });
  });

  const applyFx = () => {
    for (const o of fxObjs) (o as Img).setVisible(fxOn);
  };

  return {
    slots: { dragon: scrI(-SLOT_A, 0), wizard: scrI(SLOT_A, 0) },
    update(t: number) {
      for (const a of animators) a(t);
      if (!fxOn) applyFx();
    },
    setFx(on: boolean) {
      fxOn = on;
      applyFx();
    },
    destroy() {
      for (const o of objs) o.destroy();
      objs.length = 0;
      fxObjs.length = 0;
      animators.length = 0;
      for (const k of keys) if (scene.textures.exists(k)) scene.textures.remove(k);
    },
  };
}

