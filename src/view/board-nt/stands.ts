// Neon Tower layer: STANDS (grandstand structure) — owner A2.
// Readability pass: grandstands stay calm and static without bright railing light chases.

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

export function ensureStandsTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'stands', NT_STANDS_KEY, () => standsAtlas().canvas);
  const tex = scene.textures.get(NT_STANDS_KEY);
  for (const [name, r] of Object.entries(standsAtlas().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  for (let bi = 0; bi < ALL_STANDS.length; bi++) ensureNtTexture(scene, 'stands', ntStandBodyKey(bi), () => bakeStandBody(bi, standsAtlas()).canvas);
}

export function createStandsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureStandsTextures(scene);
  const rows = standRows();

  for (let bi = 0; bi < ALL_STANDS.length; bi++) {
    const r = standBodyRect(bi);
    ctx.add(scene.add.image(r.x, r.y, ntStandBodyKey(bi)).setOrigin(0).setDepth(NT_DEPTH.stands));
  }

  for (const r of rows) {
    const b = ctx.add(scene.add.blitter(0, 0, NT_STANDS_KEY).setDepth(railDepth(r.row)));
    for (const q of r.rail) b.create(q.x, q.y, `rail:${r.side}:0`);
    for (const q of r.cap) b.create(q.x, q.y, `cap:${r.side}:0`);
    for (const q of r.posts) b.create(q.x, q.y, `post:${r.side}:0`);
  }

  return {
    name: 'stands',
    owner: 'A2',
    tick(_dt: number, _t: number): void {},
    destroy(): void {},
  };
}
