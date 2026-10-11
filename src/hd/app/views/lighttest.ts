// ?view=lighttest — proof that the lighting works: a lit floor with grooves, three normal-mapped spheres (one
// mirrored with flipX, one faceted for the highlight) and a moving point light that sweeps across them.
// Each sphere carries an orange "ear" on its right; the mirrored one must show the ear on its left AND stay
// lit from the light's side (normals mirrored with the sprite).

import Phaser from 'phaser';
import { DEPTH } from '../../../view/layout';
import { HD_H, HD_W } from '../../contracts';
import { makeLitTexture, useLighting } from '../lighting';
import type { ViewCtx } from '../TrialScene';

function normalPx(nx: number, ny: number, nz: number): [number, number, number] {
  const l = Math.hypot(nx, ny, nz) || 1;
  return [Math.round(((nx / l) * 0.5 + 0.5) * 255), Math.round(((ny / l) * 0.5 + 0.5) * 255), Math.round(((nz / l) * 0.5 + 0.5) * 255)];
}

/** Sphere (+ right-hand ear) with analytic normals. `facets` quantizes the normal into crystal-like planes. */
function sphereCanvases(size: number, facets: number, base: [number, number, number]): { color: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const mk = () => {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    return cv;
  };
  const color = mk();
  const normal = mk();
  const cc = color.getContext('2d')!;
  const nc = normal.getContext('2d')!;
  const ci = cc.createImageData(size, size);
  const ni = nc.createImageData(size, size);
  const c = size / 2;
  const R = size * 0.38;
  const ear = { x: c + R * 0.82, y: c - R * 0.55, r: R * 0.34 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let nx = (x + 0.5 - c) / R;
      let ny = -(y + 0.5 - c) / R;
      let d2 = nx * nx + ny * ny;
      let inEar = false;
      if (d2 > 1) {
        const ex = (x + 0.5 - ear.x) / ear.r;
        const ey = -(y + 0.5 - ear.y) / ear.r;
        if (ex * ex + ey * ey <= 1) {
          nx = ex;
          ny = ey;
          d2 = ex * ex + ey * ey;
          inEar = true;
        } else continue;
      }
      let nz = Math.sqrt(Math.max(0, 1 - d2));
      if (facets > 0 && !inEar) {
        // snap the normal direction onto a ring of flat facets
        const ang = Math.atan2(ny, nx);
        const q = Math.round(ang / ((Math.PI * 2) / facets)) * ((Math.PI * 2) / facets);
        const rad = Math.sqrt(d2);
        const rq = Math.round(rad * 3) / 3;
        nx = Math.cos(q) * rq;
        ny = Math.sin(q) * rq;
        nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
      }
      const [r, g, b] = normalPx(nx, ny, nz);
      ni.data[i] = r;
      ni.data[i + 1] = g;
      ni.data[i + 2] = b;
      ni.data[i + 3] = 255;
      // colour: matte body with soft bands; the ear is orange
      const band = 0.9 + 0.1 * Math.sin((y / size) * Math.PI * 14);
      if (inEar) {
        ci.data[i] = 255;
        ci.data[i + 1] = 138;
        ci.data[i + 2] = 30;
      } else {
        ci.data[i] = base[0] * band;
        ci.data[i + 1] = base[1] * band;
        ci.data[i + 2] = base[2] * band;
      }
      ci.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0);
  nc.putImageData(ni, 0, 0);
  return { color, normal };
}

function floorCanvases(): { color: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const mk = () => {
    const cv = document.createElement('canvas');
    cv.width = HD_W;
    cv.height = HD_H;
    return cv;
  };
  const color = mk();
  const normal = mk();
  const ci = color.getContext('2d')!.createImageData(HD_W, HD_H);
  const ni = normal.getContext('2d')!.createImageData(HD_W, HD_H);
  const G = 32;
  for (let y = 0; y < HD_H; y++) {
    for (let x = 0; x < HD_W; x++) {
      const i = (y * HD_W + x) * 4;
      const gx = x % G;
      const gy = y % G;
      const edgeX = gx < 2 ? 1 : gx > G - 3 ? -1 : 0;
      const edgeY = gy < 2 ? 1 : gy > G - 3 ? -1 : 0;
      const groove = edgeX !== 0 || edgeY !== 0;
      const cell = ((x / G) | 0) + ((y / G) | 0);
      const v = 70 + (cell % 2) * 10 + (groove ? 14 : 0);
      ci.data[i] = v * 0.7;
      ci.data[i + 1] = v * 0.8;
      ci.data[i + 2] = v * 1.3;
      ci.data[i + 3] = 255;
      // grooves tilt the normal toward the groove centre
      const [r, g, b] = normalPx(edgeX * 0.9, -edgeY * 0.9, 1);
      ni.data[i] = r;
      ni.data[i + 1] = g;
      ni.data[i + 2] = b;
      ni.data[i + 3] = 255;
    }
  }
  color.getContext('2d')!.putImageData(ci, 0, 0);
  normal.getContext('2d')!.putImageData(ni, 0, 0);
  return { color, normal };
}

export function lighttestView(ctx: ViewCtx): void {
  const { scene, kit } = ctx;
  const L = kit.lighting;

  const f = floorCanvases();
  makeLitTexture(scene, 'hd:lt:floor', f.color, f.normal);
  useLighting(scene.add.image(0, 0, 'hd:lt:floor').setOrigin(0).setDepth(DEPTH.TILE));

  const a = sphereCanvases(160, 0, [150, 165, 200]);
  makeLitTexture(scene, 'hd:lt:sphere', a.color, a.normal);
  const b = sphereCanvases(160, 9, [200, 215, 240]);
  makeLitTexture(scene, 'hd:lt:crystal', b.color, b.normal);

  const y = 300;
  const s1 = useLighting(scene.add.image(230, y, 'hd:lt:sphere').setDepth(DEPTH.UNIT));
  const s2 = useLighting(scene.add.image(480, y, 'hd:lt:sphere').setDepth(DEPTH.UNIT).setFlipX(true));
  const s3 = useLighting(scene.add.image(730, y, 'hd:lt:crystal').setDepth(DEPTH.UNIT), { spec: 0.9, shine: 22 });
  void s1;
  void s2;
  void s3;

  scene.add.ellipse(230, y + 62, 120, 26, 0x000000, 0.35).setDepth(DEPTH.SHADOW);
  scene.add.ellipse(480, y + 62, 120, 26, 0x000000, 0.35).setDepth(DEPTH.SHADOW);
  scene.add.ellipse(730, y + 62, 120, 26, 0x000000, 0.35).setDepth(DEPTH.SHADOW);

  L.ambient(0x6a76b8, 0.55);
  const sweep = L.addPointLight(480, 270, 0xfff2d0, 320, 1.5, 80);
  const cyan = L.addPointLight(60, 470, 0x3fe0ea, 340, 1.0, 40);
  const red = L.addPointLight(900, 90, 0xff4d5e, 340, 1.0, 40);
  void cyan;
  void red;
  const dot = kit.fx.glowSprite(480, 270, 0xfff2d0, 46, 0.9, 'front');
  const dot2 = kit.fx.glowSprite(480, 270, 0xffffff, 16, 1, 'front', 'hd:glow:core');

  scene.events.on(Phaser.Scenes.Events.UPDATE, (time: number) => {
    const t = time / 1000;
    const x = 480 + 400 * Math.cos(t * 0.8);
    const yy = 300 + 150 * Math.sin(t * 1.3);
    sweep.setPosition(x, yy);
    dot.setPosition(x, yy);
    dot2.setPosition(x, yy);
  });
  ctx.status('IŞIK TESTİ');
}
