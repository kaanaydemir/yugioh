// Neon Tower layer: STANDS (grandstand structure) — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2, §6, §8).
// The left (blue) and right (crimson) tiered stands as GEOMETRY without spectators: per row a tread + riser
// (the staircase), a back wall behind row 0, an outer skirt under the last row, newel posts at the row ends,
// and the railing in front of each row. The crowd layer (B1) stands in the seats of seats.ts; the railing of row k
// draws at railDepth(k), i.e. in front of row k's spectators and behind row k+1's (seats.ts depth contract).
// Everything is Blitter bobs of 16-px tiles (a few draw objects, one tiny atlas); living details are a slow
// light chase along each railing (a comet of lit tiles, different speed and phase per row) and blinking post lights,
// stepped on the scene clock in tick(), no tweens. Painter: src/art/arena-nt/stands*.ts.

import Phaser from 'phaser';
import { NT_STANDS_KEY, bakeStandBody, ntStandBodyKey, standBodyRect, standRows, standsAtlasShared } from '../../art/arena-nt/stands';
import type { NtAtlas } from '../../art/arena-nt/wall-kit';
import { NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtLayer } from './layer';
import { ALL_STANDS, railDepth } from './seats';
import { ensureNtTexture } from './textures';

function standsAtlas(): NtAtlas {
  return standsAtlasShared();
}

/** Register the stands atlas once (boot step 24 and, as a fallback, the layer). */
export function ensureStandsTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'stands', NT_STANDS_KEY, () => standsAtlas().canvas);
  const tex = scene.textures.get(NT_STANDS_KEY);
  for (const [name, r] of Object.entries(standsAtlas().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  for (let bi = 0; bi < ALL_STANDS.length; bi++) ensureNtTexture(scene, 'stands', ntStandBodyKey(bi), () => bakeStandBody(bi, standsAtlas()).canvas);
}

type Bob = Phaser.GameObjects.Bob;

interface RailRun {
  side: 0 | 1;
  row: number;
  bobs: Bob[];
  /** ms per chase step and phase offset */
  step: number;
  phase: number;
  last: number;
}
interface CapRun {
  bobs: Bob[];
  side: 0 | 1;
  last: number;
}
interface PostRun {
  bob: Bob;
  side: 0 | 1;
  period: number;
  phase: number;
  last: number;
}

export function createStandsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureStandsTextures(scene);
  const rows = standRows();

  // the staircase, back strip, skirt and banners: ONE baked image per side (below every spectator)
  for (let bi = 0; bi < ALL_STANDS.length; bi++) {
    const r = standBodyRect(bi);
    ctx.add(scene.add.image(r.x, r.y, ntStandBodyKey(bi)).setOrigin(0).setDepth(NT_DEPTH.stands));
  }

  // the railings: one blitter per (side, row), at the depth between that row's spectators and the next row's
  const rails: RailRun[] = [];
  const posts: PostRun[] = [];
  const caps: CapRun[] = [];
  for (const r of rows) {
    const b = ctx.add(scene.add.blitter(0, 0, NT_STANDS_KEY).setDepth(railDepth(r.row)));
    const bobs = r.rail.map((q) => b.create(q.x, q.y, q.frame));
    if (r.cap.length) caps.push({ side: r.side, bobs: r.cap.map((q) => b.create(q.x, q.y, q.frame)), last: -1 });
    rails.push({ side: r.side, row: r.row, bobs, step: (r.side === 0 ? 170 : 130) + r.row * 25, phase: (r.row * 7 + r.side * 3) * 410, last: -1 });
    r.posts.forEach((q, i) => {
      const bob = b.create(q.x, q.y, q.frame);
      posts.push({ bob, side: r.side, period: 2400 + ((r.row * 5 + i * 3 + r.side * 2) % 7) * 330, phase: (r.row * 3 + i) * 700, last: i });
    });
  }

  return {
    name: 'stands',
    owner: 'A2',
    tick(_dt: number, t: number): void {
      // railing light chase: a two-tile comet runs along each row, then rests a few steps
      for (const run of rails) {
        const n = run.bobs.length;
        const cycle = n + 7;
        const pos = Math.floor((t + run.phase) / run.step) % cycle;
        if (pos === run.last) continue;
        run.last = pos;
        for (let i = 0; i < n; i++) {
          const d = pos - i;
          const frame = d === 0 || d === 1 ? 1 : 0;
          run.bobs[i].setFrame(`rail:${run.side}:${frame}`);
        }
      }
      // back wall light line: a slow swell travels along the wall (dim → mid → lit → mid), 6 steps a second
      for (const c of caps) {
        const n = c.bobs.length;
        const pos = Math.floor(t / 160) % (n * 2 + 8);
        if (pos === c.last) continue;
        c.last = pos;
        for (let i = 0; i < n; i++) {
          const d = Math.abs(pos - 4 - i * 2);
          const lvl = d <= 1 ? 2 : d <= 4 ? 1 : 0;
          c.bobs[i].setFrame(`cap:${c.side}:${lvl}`);
        }
      }
      // post lights: lit for 360 ms every few seconds
      for (const p of posts) {
        const lit = (t + p.phase) % p.period < 360 ? 1 : 0;
        if (lit !== p.last) {
          p.last = lit;
          p.bob.setFrame(`post:${p.side}:${lit}`);
        }
      }
    },
    destroy(): void {
      /* the view destroys the objects */
    },
  };
}
