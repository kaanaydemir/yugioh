// ?dev=hd2d&s=stBoard&look=v3 — HD-2D trial (owner request 2026-11-13: "like our Time Traveler game").
//
// The real duel scene, then on top of it (this page only, nothing in the game changes):
//   light   Phaser's Light2D pipeline on the arena's stone (stage top, hall floor, walls): normal maps
//           generated from the pixel art, real point lights at the braziers, wall torches, holograms and
//           the two players' neon rows. Monsters, cards and the HUD keep their flat, crisp look.
//   blur    a depth blur on the back wall only (the board stays sharp).
//   &light=0 / &blur=0 switch a part off; &amb=0xRRGGBB the ambient light (default 0x6c6880).
import Phaser from 'phaser';
import type { DevPreview } from '../types';
import steamPreview from './steam';
import { NT_PLATFORM_KEY } from '../../art/arena-nt/platform';
import { NT_HALL_FLOOR_KEY, NT_WALL_KEY } from '../../art/arena-nt/wall';
import { NT_APRON_KEY } from '../../art/arena-nt/apron';
import { NT_BRICKWALL_KEY } from '../../art/arena-nt/brickwall';

/** Keys of the arena stone that takes real light. */
const LIT = [NT_PLATFORM_KEY, NT_HALL_FLOOR_KEY, 'nt:hall:backfloor', NT_APRON_KEY, NT_WALL_KEY, NT_BRICKWALL_KEY, 'nt:wall:brick:vault'];
const BLUR = [NT_BRICKWALL_KEY, 'nt:wall:brick:vault', 'nt:hall:backfloor'];

/** A tangent-space normal map from the art's luminance: mortar / grooves are low, faces high, edges catch the light. */
function normalMapOf(src: HTMLCanvasElement | HTMLImageElement, strength: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const hgt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    hgt[i] = ((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255) * a;
  }
  const H = (x: number, y: number): number => hgt[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  const out = g.createImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const k = (y * w + x) * 4;
      o[k] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      o[k + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      o[k + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      o[k + 3] = 255;
    }
  g.putImageData(out, 0, 0);
  return c;
}

function eachImage(list: Phaser.GameObjects.GameObject[], fn: (img: Phaser.GameObjects.Image) => void): void {
  for (const go of list) {
    if (go instanceof Phaser.GameObjects.Image) fn(go);
    const kids = (go as unknown as { list?: Phaser.GameObjects.GameObject[] }).list;
    if (Array.isArray(kids)) eachImage(kids, fn);
  }
}

const preview: DevPreview = {
  name: 'hd2d',
  description: 'HD-2D trial: real lights on the arena stone + back-wall depth blur (&light=0 &blur=0 &amb=0xRRGGBB)',
  async create(scene, params) {
    if (!params.get('s')) params.set('s', 'stBoard');
    await steamPreview.create(scene, params);
    const duel = scene.scene.get('Duel');
    const light = params.get('light') !== '0';
    const blur = params.get('blur') !== '0';

    if (light) {
      for (const key of LIT) {
        const tex = duel.textures.get(key);
        if (!tex || tex.key === '__MISSING') continue;
        const src = tex.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
        tex.setDataSource(normalMapOf(src, key === NT_PLATFORM_KEY ? 3 : 2));
      }
      duel.lights.enable().setAmbientColor(Number(params.get('amb') ?? 0x6c6880));
      const warm = 0xffb066;
      // braziers (near corners), wall torches (back wall), holograms, the two neon rows
      duel.lights.addLight(140, 250, 190, warm, 2.2);
      duel.lights.addLight(540, 240, 190, warm, 2.2);
      duel.lights.addLight(118, 62, 90, warm, 1.1);
      duel.lights.addLight(277, 34, 80, warm, 1.0);
      duel.lights.addLight(365, 40, 80, warm, 1.0);
      duel.lights.addLight(500, 66, 90, warm, 1.1);
      duel.lights.addLight(60, 120, 120, 0x4aa8ff, 0.9);
      duel.lights.addLight(585, 115, 120, 0xd04cff, 0.9);
      duel.lights.addLight(250, 200, 170, 0x2fd8ff, 0.9);
      duel.lights.addLight(390, 125, 170, 0xff3d6e, 0.85);
    }

    eachImage(duel.children.list, (img) => {
      const key = img.texture.key;
      if (light && LIT.includes(key)) img.setPipeline('Light2D');
      // the baked light veils are replaced by the real lights
      if (light && key.startsWith('nt:v4light:') && key.endsWith('veil')) img.setVisible(false);
      if (blur && BLUR.includes(key)) img.preFX?.addBlur(1, 1, 1, 1.1, 0xffffff, 4);
    });
  },
};

export default preview;
