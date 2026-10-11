// Placeholder arena theme: a plain floating neon platform on a night sky, lit by the HD pipeline. It exists so the
// trial page always has something to stand on and light up (and to prove the lighting on a floor); the real
// theme lives in src/hd/arena/ and replaces it automatically (see assets.ts loadArenaTheme).

import Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { DEPTH, type BoardSpot } from '../../view/layout';
import { HD_BOARD_OX, HD_BOARD_OY, HD_H, HD_TILE_H, HD_TILE_W, HD_W, hdIsoToScreen, hdZoneXY, type ArenaBuildOptions, type ArenaHandle, type ArenaTheme } from '../contracts';
import { getKit } from './kit';
import { HD_LIGHT, makeLitTexture, useLighting } from './lighting';

function px(g: CanvasRenderingContext2D, x: number, y: number, c: string, s = 1): void {
  g.fillStyle = c;
  g.fillRect(x, y, s, s);
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skyTexture(scene: Phaser.Scene, key: string, pixel: number): void {
  if (scene.textures.exists(key)) return;
  const w = HD_W / pixel;
  const h = HD_H / pixel;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#05060f');
  gr.addColorStop(0.45, '#0b0d1f');
  gr.addColorStop(0.75, '#1b2352');
  gr.addColorStop(1, '#0b0d1f');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h * 0.62);
    const b = r();
    px(g, x, y, b > 0.92 ? '#f4f7ff' : b > 0.6 ? '#a3b1da' : '#3b4c91', 1);
  }
  scene.textures.addCanvas(key, cv);
}

function floorTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement('canvas');
  cv.width = HD_W;
  cv.height = HD_H;
  const g = cv.getContext('2d')!;
  g.save();
  g.translate(HD_W / 2, 360);
  g.scale(1, 0.42);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 470);
  gr.addColorStop(0, 'rgba(40,53,111,0.55)');
  gr.addColorStop(0.55, 'rgba(18,22,58,0.55)');
  gr.addColorStop(1, 'rgba(11,13,31,0)');
  g.fillStyle = gr;
  g.fillRect(-480, -480, 960, 960);
  g.restore();
  scene.textures.addCanvas(key, cv);
}

interface TileTex {
  key: string;
  glowKey: string;
  w: number;
  h: number;
}

/** A lit diamond tile (colour + normal with a bevelled rim) and its additive neon rim, at `pixel` HD px per art px. */
function tileTextures(scene: Phaser.Scene, kind: 0 | 1 | 2, pixel: number): TileTex {
  const w = HD_TILE_W / pixel;
  const h = HD_TILE_H / pixel;
  const key = `hd:ph:tile:${kind}:${pixel}`;
  const glowKey = `hd:ph:tileglow:${kind}:${pixel}`;
  if (scene.textures.exists(key)) return { key, glowKey, w, h };
  const rim = kind === 0 ? [63, 224, 234] : kind === 1 ? [255, 77, 94] : [101, 120, 180];
  const base = kind === 0 ? [14, 30, 52] : kind === 1 ? [34, 16, 36] : [20, 24, 52];
  const color = new ImageData(w, h);
  const normal = new ImageData(w, h);
  const glow = new ImageData(w, h);
  const hw = w / 2;
  const hh = h / 2;
  const rnd = rng(kind * 31 + 5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - hw;
      const dy = y + 0.5 - hh;
      const m = Math.abs(dx) / hw + Math.abs(dy) / hh; // 0 center .. 1 edge
      const i = (y * w + x) * 4;
      if (m > 1) {
        normal.data[i] = 128;
        normal.data[i + 1] = 128;
        normal.data[i + 2] = 255;
        normal.data[i + 3] = 255;
        continue;
      }
      // surface colour
      const noise = (rnd() - 0.5) * 6;
      let r = base[0] + noise;
      let gg = base[1] + noise;
      let b = base[2] + noise * 1.4;
      const inset = Math.abs(m - 0.8) < 0.025 / (pixel > 1 ? 1 : 1);
      if (inset) {
        r += rim[0] * 0.12;
        gg += rim[1] * 0.12;
        b += rim[2] * 0.12;
      }
      const edge = m > 0.9;
      if (edge) {
        r = rim[0] * 0.55;
        gg = rim[1] * 0.55;
        b = rim[2] * 0.55;
      }
      color.data[i] = r;
      color.data[i + 1] = gg;
      color.data[i + 2] = b;
      color.data[i + 3] = 255;
      // normal: flat in the middle, tilted outward over the bevel band
      let nx = 0;
      let ny = 0;
      if (m > 0.78) {
        const t = Math.min(1, (m - 0.78) / 0.22) * 0.85;
        const ox = Math.sign(dx) / hw;
        const oy = Math.sign(dy) / hh;
        const l = Math.hypot(ox, oy) || 1;
        nx = (ox / l) * t;
        ny = (-oy / l) * t;
      }
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      normal.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      normal.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normal.data[i + 3] = 255;
      // neon rim for the bloom layer
      if (edge) {
        const a = Math.min(1, (m - 0.9) / 0.06) * 255;
        glow.data[i] = rim[0];
        glow.data[i + 1] = rim[1];
        glow.data[i + 2] = rim[2];
        glow.data[i + 3] = a;
      } else if (inset) {
        glow.data[i] = rim[0];
        glow.data[i + 1] = rim[1];
        glow.data[i + 2] = rim[2];
        glow.data[i + 3] = 70;
      }
    }
  }
  const mk = (id: ImageData) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d')!.putImageData(id, 0, 0);
    return cv;
  };
  makeLitTexture(scene, key, mk(color), mk(normal));
  scene.textures.addCanvas(glowKey, mk(glow));
  return { key, glowKey, w, h };
}

/** Flat-shaded slab face with a constant normal. */
function slabFace(scene: Phaser.Scene, key: string, pts: [number, number][], bounds: { x: number; y: number; w: number; h: number }, fill: [string, string], edge: string, n: [number, number, number]): void {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement('canvas');
  cv.width = bounds.w;
  cv.height = bounds.h;
  const g = cv.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, bounds.h);
  gr.addColorStop(0, fill[0]);
  gr.addColorStop(1, fill[1]);
  g.fillStyle = gr;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x - bounds.x, y - bounds.y) : g.moveTo(x - bounds.x, y - bounds.y)));
  g.closePath();
  g.fill();
  g.strokeStyle = edge;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(pts[0][0] - bounds.x, pts[0][1] - bounds.y);
  g.lineTo(pts[1][0] - bounds.x, pts[1][1] - bounds.y);
  g.stroke();
  const nv = document.createElement('canvas');
  nv.width = bounds.w;
  nv.height = bounds.h;
  const ng = nv.getContext('2d')!;
  ng.fillStyle = `rgb(${Math.round((n[0] * 0.5 + 0.5) * 255)},${Math.round((n[1] * 0.5 + 0.5) * 255)},${Math.round((n[2] * 0.5 + 0.5) * 255)})`;
  ng.fillRect(0, 0, bounds.w, bounds.h);
  makeLitTexture(scene, key, cv, nv);
}

function build(scene: Phaser.Scene, opts: ArenaBuildOptions): ArenaHandle {
  const pixel = opts.envPixel;
  const kit = getKit(scene);
  const objs: Phaser.GameObjects.GameObject[] = [];
  const glows: { img: Phaser.GameObjects.Image; phase: number; player: PlayerId | null }[] = [];
  let active: PlayerId | null = opts.activePlayer ?? null;

  skyTexture(scene, `hd:ph:sky:${pixel}`, pixel);
  floorTexture(scene, 'hd:ph:floor');
  const sky = scene.add.image(0, 0, `hd:ph:sky:${pixel}`).setOrigin(0).setScale(pixel).setDepth(DEPTH.SKY);
  const floor = scene.add.image(0, 0, 'hd:ph:floor').setOrigin(0).setDepth(DEPTH.STADIUM);
  objs.push(sky, floor);

  // platform slab (two visible side faces), 24 px thick
  const L = hdIsoToScreen(-0.5, 4.5);
  const B = hdIsoToScreen(4.5, 4.5);
  const R = hdIsoToScreen(4.5, -0.5);
  const T = 26;
  const leftB = { x: L.x, y: L.y, w: B.x - L.x, h: B.y - L.y + T };
  const rightB = { x: B.x, y: R.y, w: R.x - B.x, h: B.y - R.y + T };
  slabFace(scene, 'hd:ph:slabL', [[L.x, L.y], [B.x, B.y], [B.x, B.y + T], [L.x, L.y + T]], leftB, ['#1b2352', '#0b0d1f'], '#3fe0ea', [-0.62, -0.28, 0.73]);
  slabFace(scene, 'hd:ph:slabR', [[B.x, B.y], [R.x, R.y], [R.x, R.y + T], [B.x, B.y + T]], rightB, ['#1b2352', '#0b0d1f'], '#ff4d5e', [0.62, -0.28, 0.73]);
  const sl = useLighting(scene.add.image(leftB.x, leftB.y, 'hd:ph:slabL').setOrigin(0).setDepth(DEPTH.PLATFORM));
  const sr = useLighting(scene.add.image(rightB.x, rightB.y, 'hd:ph:slabR').setOrigin(0).setDepth(DEPTH.PLATFORM));
  objs.push(sl, sr);

  // tiles
  const kinds: (0 | 1 | 2)[] = [1, 1, 2, 0, 0];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const kind = kinds[row];
      const t = tileTextures(scene, kind, pixel);
      const p = hdIsoToScreen(col, row);
      const tile = scene.add.image(p.x, p.y, t.key).setScale(pixel).setDepth(DEPTH.TILE);
      tile.setPipeline(HD_LIGHT);
      const glow = scene.add.image(p.x, p.y, t.glowKey).setScale(pixel).setBlendMode(Phaser.BlendModes.ADD);
      kit.fx.glow(glow, 'back');
      glows.push({ img: glow, phase: (col + row) * 0.55 + row * 0.2, player: kind === 0 ? 0 : kind === 1 ? 1 : null });
      objs.push(tile, glow);
    }
  }

  // two soft colour pools on the floor behind the platform
  const poolL = kit.fx.glowSprite(HD_BOARD_OX - 170, HD_BOARD_OY + 190, 0x3fe0ea, 360, 0.16, 'back');
  const poolR = kit.fx.glowSprite(HD_BOARD_OX + 170, HD_BOARD_OY + 110, 0xff4d5e, 360, 0.16, 'back');
  objs.push(poolL, poolR);

  const update = (time: number) => {
    const t = time / 1000;
    for (const g of glows) {
      const boost = active === null ? 1 : g.player === active ? 1.35 : 0.7;
      g.img.setAlpha(Math.min(1, (0.62 + 0.22 * Math.sin(t * 1.7 + g.phase)) * boost));
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);

  return {
    setActivePlayer(p) {
      active = p;
    },
    async flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms = 400) {
      const p = hdZoneXY(player, spot, index);
      const img = scene.add.image(p.x, p.y, `hd:ph:tileglow:${player === 0 ? 0 : 1}:${pixel}`).setScale(pixel).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      kit.fx.glow(img, 'back');
      const halo = kit.fx.glowSprite(p.x, p.y, color, 150, 0, 'back');
      await new Promise<void>((resolve) => {
        scene.tweens.add({
          targets: [img, halo],
          alpha: { from: 0, to: 1 },
          duration: ms * 0.3,
          yoyo: true,
          ease: 'Quad.Out',
          onComplete: () => resolve(),
        });
      });
      img.destroy();
      halo.destroy();
    },
    destroy() {
      scene.events.off(Phaser.Scenes.Events.UPDATE, update);
      for (const o of objs) if (o.active) o.destroy();
    },
  };
}

export const placeholderArenaTheme: ArenaTheme = {
  id: 'placeholder',
  name: 'Placeholder neon platform',
  lighting: {
    ambient: 0xb4bff0,
    ambientIntensity: 0.9,
    sideLight: {
      0: { color: 0x3fe0ea, intensity: 0.95, radius: 200 },
      1: { color: 0xff4d5e, intensity: 0.95, radius: 200 },
    },
  },
  build,
};

