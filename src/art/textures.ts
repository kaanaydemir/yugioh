// Turns code-drawn PixelCanvas art into Phaser textures + animations.
//
// Conventions:
//   texture `mon:<id>`          — monster sheet, frame names `<anim>:<i>`
//   animation `mon:<id>:<anim>` — Phaser animation (repeat -1 when loop)

import Phaser from 'phaser';
import type { MonsterId } from '../data/cards';
import { MONSTER_IDS } from '../data/cards';
import { monsterArt } from './monsters';
import { PixelCanvas } from './pixel';
import type { MonsterAnim, MonsterArt } from './types';
import { MONSTER_ANIMS } from './types';

/** Add (or replace) a texture from a PixelCanvas. Returns the key. */
export function canvasTexture(scene: Phaser.Scene, key: string, pc: PixelCanvas): string {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, pc.toCanvas());
  return key;
}

/** Create a texture once by drawing into a fresh PixelCanvas. */
export function ensureTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (p: PixelCanvas) => void): string {
  if (scene.textures.exists(key)) return key;
  const p = new PixelCanvas(w, h);
  draw(p);
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

/**
 * Build a texture holding several named frames laid out in a grid.
 * `frames` maps frame name → PixelCanvas (all must share size w×h).
 */
export function sheetTexture(scene: Phaser.Scene, key: string, w: number, h: number, frames: [string, PixelCanvas][]): string {
  const cols = Math.max(1, Math.min(frames.length, Math.floor(4096 / w)));
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelCanvas(cols * w, rows * h);
  frames.forEach(([, pc], i) => sheet.blit(pc, (i % cols) * w, Math.floor(i / cols) * h));
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  frames.forEach(([name], i) => tex.add(name, 0, (i % cols) * w, Math.floor(i / cols) * h, w, h));
  return key;
}

// ---------------------------------------------------------------- monsters

const frameCache = new Map<string, PixelCanvas>();

/** Rendered pixels of a monster frame (cached). Used by shatter VFX and card art. */
export function monsterFrame(id: MonsterId, anim: MonsterAnim, frame: number): PixelCanvas {
  const k = `${id}|${anim}|${frame}`;
  let pc = frameCache.get(k);
  if (!pc) {
    const art = monsterArt(id);
    pc = new PixelCanvas(art.w, art.h);
    art.draw(pc, anim, Math.min(frame, art.anims[anim].frames - 1));
    frameCache.set(k, pc);
  }
  return pc;
}

export function monsterTextureKey(id: MonsterId): string {
  return `mon:${id}`;
}

export function monsterAnimKey(id: MonsterId, anim: MonsterAnim): string {
  return `mon:${id}:${anim}`;
}

export function monsterFrameName(anim: MonsterAnim, frame: number): string {
  return `${anim}:${frame}`;
}

export function buildMonster(scene: Phaser.Scene, art: MonsterArt): void {
  const frames: [string, PixelCanvas][] = [];
  for (const anim of MONSTER_ANIMS) {
    for (let f = 0; f < art.anims[anim].frames; f++) frames.push([monsterFrameName(anim, f), monsterFrame(art.id, anim, f)]);
  }
  const key = monsterTextureKey(art.id);
  sheetTexture(scene, key, art.w, art.h, frames);
  for (const anim of MONSTER_ANIMS) {
    const spec = art.anims[anim];
    const animKey = monsterAnimKey(art.id, anim);
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    scene.anims.create({
      key: animKey,
      frames: Array.from({ length: spec.frames }, (_, f) => ({ key, frame: monsterFrameName(anim, f) })),
      frameRate: spec.fps,
      repeat: spec.loop ? -1 : 0,
    });
  }
}

export function buildAllMonsters(scene: Phaser.Scene): void {
  for (const id of MONSTER_IDS) buildMonster(scene, monsterArt(id));
}
