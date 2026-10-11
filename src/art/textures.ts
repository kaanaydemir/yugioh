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

/**
 * Register a finished canvas as a STATIC texture (frames can be added as usual). Unlike
 * textures.addCanvas(), this does not wrap it in a CanvasTexture — that reads the whole canvas
 * back with getImageData() and keeps that ImageData copy alive next to the canvas for good
 * (~35 MB of boot art held twice in the soak test). Use addCanvas() only for canvases that are
 * redrawn later (they need CanvasTexture.refresh()).
 */
export function addStaticCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.Texture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addImage(key, canvas as unknown as HTMLImageElement)!;
}

/** Add (or replace) a texture from a PixelCanvas. Returns the key. */
export function canvasTexture(scene: Phaser.Scene, key: string, pc: PixelCanvas): string {
  addStaticCanvas(scene, key, pc.toCanvas());
  return key;
}

/** Create a texture once by drawing into a fresh PixelCanvas. */
export function ensureTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (p: PixelCanvas) => void): string {
  if (scene.textures.exists(key)) return key;
  const p = new PixelCanvas(w, h);
  draw(p);
  addStaticCanvas(scene, key, p.toCanvas());
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
  const tex = addStaticCanvas(scene, key, sheet.toCanvas());
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

// ---------------------------------------------------------------- deferred monster sheets
//
// Painting all 12 monster sheets (~430 frames) took ~2.2–2.7 s of the ~3.5 s boot block that
// holds back the first frame (soak test, headless). Instead, boot now registers every sheet at
// once — blank canvas, frame rects and animations, so keys, frames and anims all exist — and the
// frames are painted afterwards in small time slices (setTimeout, ~6 ms each). Anything that
// looks a sheet up through the texture manager (sprite creation, setTexture, textures.get(...)
// for pixel reads) first finishes that sheet synchronously, so no consumer ever sees an unpainted
// frame; usually the background slices are long done by then. With ?test (screenshot tooling)
// everything is built synchronously at boot, as before, so films stay deterministic.

interface PendingSheet {
  art: MonsterArt;
  key: string;
  tex: Phaser.Textures.Texture;
  ctx: CanvasRenderingContext2D;
  cells: { anim: MonsterAnim; f: number; x: number; y: number }[];
  next: number;
}

const pendingSheets = new Map<string, PendingSheet>();
const whenDone: (() => void)[] = [];
/** Main-thread budget of one background painting slice (ms). */
const SLICE_MS = 6;

/** Resolves once every monster sheet is painted (immediately when nothing is pending). */
export function whenMonstersBuilt(): Promise<void> {
  if (!pendingSheets.size) return Promise.resolve();
  return new Promise((r) => whenDone.push(r));
}

/** Paint up to `budgetMs` of pending frames of one sheet; true when the sheet is complete. */
function paintSheet(ps: PendingSheet, budgetMs: number): boolean {
  const t0 = performance.now();
  const { art } = ps;
  while (ps.next < ps.cells.length) {
    const c = ps.cells[ps.next++];
    const pc = monsterFrame(art.id, c.anim, c.f);
    ps.ctx.putImageData(new ImageData(pc.data as Uint8ClampedArray<ArrayBuffer>, art.w, art.h), c.x, c.y);
    if (performance.now() - t0 > budgetMs && ps.next < ps.cells.length) return false;
  }
  // all frames painted: upload once
  pendingSheets.delete(ps.key);
  try {
    if (ps.tex.manager) ps.tex.source[0]?.update();
  } catch (e) {
    console.error(`[art] monster sheet ${ps.key} upload failed`, e);
  }
  if (!pendingSheets.size) for (const r of whenDone.splice(0)) r();
  return true;
}

/** Finish a pending sheet right now (called on first access through the texture manager). */
function finishSheet(key: string): void {
  const ps = pendingSheets.get(key);
  if (ps) paintSheet(ps, Infinity);
}

/** Register a monster sheet with blank frames + its animations; painting happens later. */
function prepareMonster(scene: Phaser.Scene, art: MonsterArt): void {
  const key = monsterTextureKey(art.id);
  const names: { anim: MonsterAnim; f: number }[] = [];
  for (const anim of MONSTER_ANIMS) for (let f = 0; f < art.anims[anim].frames; f++) names.push({ anim, f });
  const w = art.w;
  const h = art.h;
  const cols = Math.max(1, Math.min(names.length, Math.floor(4096 / w)));
  const rows = Math.ceil(names.length / cols);
  const cv = document.createElement('canvas');
  cv.width = cols * w;
  cv.height = rows * h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const tex = addStaticCanvas(scene, key, cv);
  const cells = names.map((n, i) => {
    const x = (i % cols) * w;
    const y = Math.floor(i / cols) * h;
    tex.add(monsterFrameName(n.anim, n.f), 0, x, y, w, h);
    return { ...n, x, y };
  });
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
  pendingSheets.set(key, { art, key, tex, ctx, cells, next: 0 });
}

const hooked = new WeakSet<object>();

/** Make textures.get('mon:<id>') finish that sheet first (once per game). */
function hookTextureManager(tm: Phaser.Textures.TextureManager): void {
  if (hooked.has(tm)) return;
  hooked.add(tm);
  const get = tm.get.bind(tm);
  tm.get = ((key: string | Phaser.Textures.Texture) => {
    if (pendingSheets.size && typeof key === 'string' && pendingSheets.has(key)) finishSheet(key);
    return get(key);
  }) as typeof tm.get;
}

export function buildAllMonsters(scene: Phaser.Scene): void {
  const sync = typeof location === 'undefined' || new URLSearchParams(location.search).has('test');
  if (sync) {
    for (const id of MONSTER_IDS) buildMonster(scene, monsterArt(id));
    return;
  }
  for (const id of MONSTER_IDS) {
    try {
      prepareMonster(scene, monsterArt(id));
    } catch (e) {
      // fall back to the synchronous path for this one
      console.error(`[art] deferred monster ${id} failed, building now`, e);
      pendingSheets.delete(monsterTextureKey(id));
      buildMonster(scene, monsterArt(id));
    }
  }
  // anims are created: from here on, a texture lookup of a pending sheet paints it first
  hookTextureManager(scene.textures);
  // paint in short slices between frames (requestIdleCallback starves under load: 40+ s in the
  // headless test); a frame is ~2–8 ms of drawing, so a slice may overrun its budget a bit
  const queue = [...pendingSheets.values()];
  const tick = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < SLICE_MS) {
      const ps = queue[0];
      if (!pendingSheets.has(ps.key) || paintSheet(ps, SLICE_MS - (performance.now() - t0))) queue.shift();
    }
    if (queue.length) setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
}
