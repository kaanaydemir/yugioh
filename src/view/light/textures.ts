// Light layer textures (arena v2). All white with an alpha falloff: the light layer tints them
// with palette colours and draws them with ADD / SCREEN blending at low alpha.
//
//   LT.radial   128×128  soft round falloff (gaussian-ish, exactly 0 at the rim) — pools, halos
//   LT.wide     128×128  broader, flatter falloff with a long tail — spill, washes
//   LT.ring     128×128  soft ring (peak at r≈0.72) — expanding impact rings on the floor
//   LT.line       8×32   vertical gaussian cross-section, constant along x — beams, inlay strips
//   LT.caustic  CAUSTIC_W×CAUSTIC_H, CAUSTIC_FRAMES frames ('0'…) — a crisp 1-px caustic web
//               inside an iso (2:1) ellipse, seamless loop; drawn at 1× (NEAREST) on purpose
//
// The smooth textures use LINEAR filtering (they are scaled freely); the game is pixelArt, so
// their output still lands on the 640×360 pixel grid. Built once per game (boot step 16-light,
// v2 only) and again lazily by the layer if needed (ensureLightTextures is idempotent).

import Phaser from 'phaser';
import { mulberry32 } from '../../art/pixel';
import { addStaticCanvas } from '../../art/textures';

export const LT = {
  radial: 'light:radial',
  wide: 'light:wide',
  ring: 'light:ring',
  line: 'light:line',
  caustic: 'light:caustic',
} as const;

/** Size (px) of the round light textures; display scale = 2·radius / LIGHT_TEX. */
export const LIGHT_TEX = 128;
export const CAUSTIC_W = 120;
export const CAUSTIC_H = 60;
export const CAUSTIC_FRAMES = 16;

function alphaCanvas(w: number, h: number, alpha: (x: number, y: number) => number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, Math.min(1, alpha(x, y)));
      const i = (y * w + x) * 4;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function addLinear(scene: Phaser.Scene, key: string, cv: HTMLCanvasElement): void {
  const tex = addStaticCanvas(scene, key, cv);
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Radial texture from a profile f(r), r in [0, 1] (0 = centre, 1 = rim; 0 outside). */
function radialTex(scene: Phaser.Scene, key: string, f: (r: number) => number): void {
  const N = LIGHT_TEX;
  const c = (N - 1) / 2;
  addLinear(
    scene,
    key,
    alphaCanvas(N, N, (x, y) => {
      const r = Math.hypot(x - c, y - c) / (N / 2);
      return r >= 1 ? 0 : f(r);
    }),
  );
}

/** Build every light texture once (idempotent). */
export function ensureLightTextures(scene: Phaser.Scene): void {
  const tm = scene.textures;
  if (!tm.exists(LT.radial)) {
    const k = 3.2;
    const e = Math.exp(-k);
    radialTex(scene, LT.radial, (r) => (Math.exp(-k * r * r) - e) / (1 - e));
  }
  if (!tm.exists(LT.wide)) {
    // flatter core, long soft tail: (1 - r²)^2.2 blended with a linear tail
    radialTex(scene, LT.wide, (r) => 0.75 * Math.pow(1 - r * r, 2.2) + 0.25 * (1 - r));
  }
  if (!tm.exists(LT.ring)) {
    radialTex(scene, LT.ring, (r) => {
      const d = (r - 0.72) / 0.17;
      const edge = r > 0.92 ? Math.max(0, (1 - r) / 0.08) : 1;
      return Math.exp(-d * d) * edge;
    });
  }
  if (!tm.exists(LT.line)) {
    const H = 32;
    const c = (H - 1) / 2;
    const k = 3.2;
    const e = Math.exp(-k);
    addLinear(
      scene,
      LT.line,
      alphaCanvas(8, H, (_x, y) => {
        const r = Math.abs(y - c) / (H / 2);
        return r >= 1 ? 0 : (Math.exp(-k * r * r) - e) / (1 - e);
      }),
    );
  }
  if (!tm.exists(LT.caustic)) buildCaustics(scene);
}

/**
 * Water caustics: a web of bright 1-px lines (Worley F2 − F1 edges on a jittered grid of seeds
 * that circle slowly, through a gentle sine domain warp so the cells are curvy), masked by an
 * iso ellipse with a Bayer-dithered rim. Every time term runs a whole number of cycles per loop,
 * so frame CAUSTIC_FRAMES−1 flows seamlessly into frame 0.
 */
function buildCaustics(scene: Phaser.Scene): void {
  const W = CAUSTIC_W;
  const H = CAUSTIC_H;
  const F = CAUSTIC_FRAMES;
  const TAU = Math.PI * 2;
  const CELL = 17;
  const rnd = mulberry32(0xc0a571c5);
  // seeds on a jittered grid in floor space (u = x, v = 2y): each circles with radius 2–4 px
  const cols = Math.ceil(W / CELL) + 2;
  const rows = Math.ceil((H * 2) / CELL) + 2;
  const seeds: { x: number; y: number; a: number; r: number; k: number }[] = [];
  for (let gy = 0; gy < rows; gy++)
    for (let gx = 0; gx < cols; gx++)
      seeds.push({
        x: (gx - 0.5) * CELL + (rnd() - 0.5) * CELL * 0.6,
        y: (gy - 0.5) * CELL + (rnd() - 0.5) * CELL * 0.6,
        a: rnd() * TAU,
        r: 2 + rnd() * 2,
        k: [1, -1, 1, 2][Math.floor(rnd() * 4)],
      });
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const cv = document.createElement('canvas');
  cv.width = W * F;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W * F, H);
  const d = img.data;
  const px = new Float32Array(seeds.length);
  const py = new Float32Array(seeds.length);
  for (let f = 0; f < F; f++) {
    const ph = (f / F) * TAU;
    seeds.forEach((s, i) => {
      px[i] = s.x + s.r * Math.cos(s.a + s.k * ph);
      py[i] = s.y + s.r * Math.sin(s.a + s.k * ph);
    });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const r = Math.hypot((x - cx) / (W / 2), (y - cy) / (H / 2));
        if (r >= 1) continue;
        const fu = x + 2.4 * Math.sin(y * 2 * 0.11 + ph) + 1.2 * Math.sin(y * 2 * 0.23 - 2 * ph);
        const fv = y * 2 + 2.4 * Math.sin(x * 0.1 - ph) + 1.2 * Math.sin(x * 0.21 + 2 * ph);
        // nearest two seeds among the 3×3 neighbouring grid cells
        const gx = Math.floor(fu / CELL + 0.5);
        const gy = Math.floor(fv / CELL + 0.5);
        let best = 1e9;
        let second = 1e9;
        for (let j = gy - 1; j <= gy + 1; j++)
          for (let i = gx - 1; i <= gx + 1; i++) {
            if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
            const n = j * cols + i;
            const dx = fu - px[n];
            const dy = fv - py[n];
            const dd = dx * dx + dy * dy;
            if (dd < best) {
              second = best;
              best = dd;
            } else if (dd < second) second = dd;
          }
        const e = Math.sqrt(second) - Math.sqrt(best);
        if (e > 2) continue;
        const fall = r < 0.62 ? 1 : 1 - (r - 0.62) / 0.38;
        const t = (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        if (fall < t) continue;
        const o = (y * W * F + f * W + x) * 4;
        d[o] = 255;
        d[o + 1] = 255;
        d[o + 2] = 255;
        d[o + 3] = e < 1 ? 255 : 120;
      }
  }
  ctx.putImageData(img, 0, 0);
  const tex = addStaticCanvas(scene, LT.caustic, cv);
  for (let f = 0; f < F; f++) tex.add(String(f), 0, f * W, 0, W, H);
}
