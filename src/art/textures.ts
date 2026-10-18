// Turns code-drawn PixelCanvas art into Phaser textures + animations.
//
// Conventions:
//   texture `mon:<id>`          — monster sheet, frame names `<anim>:<i>`
//   animation `mon:<id>:<anim>` — Phaser animation (repeat -1 when loop)
//
// v3 (A1): a sheet holds every animation of `animList(art)` — the five base anims in
// MONSTER_ANIMS order (so the old monsters' sheets are unchanged), then the optional extras
// (`extraAnims` / `drawExtra`). Frames with an AnimSpec hold get it as the Phaser frame
// `duration` (Phaser plays `frame.duration || msPerFrame`); frames without one keep the
// frameRate timing, exactly as before. Read timings through src/art/animtime.ts, and never pass
// `frameRate` / `duration` to play() for such an anim: Phaser then ignores the frame durations.
// A sheet can also be built under another key with DrawOpts (`SheetOpts`), e.g. a P2 'relight'
// variant drawn with { lightFrom: 'right' }.

import Phaser from 'phaser';
import type { MonsterId } from '../data/cards';
import { MONSTER_IDS } from '../data/cards';
import { animList, animSpec, hasAnim, holdOf, isExtraAnim } from './animtime';
import { monsterArt } from './monsters';
import { PixelCanvas } from './pixel';
import type { AnyMonsterAnim, DrawOpts, MonsterArt } from './types';
import { MONSTER_ANIMS } from './types';

export { animList, animSpec, hasAnim } from './animtime';

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

// ---------------------------------------------------------------- monster frames

/** Frames of the registry arts (monsterArt(id)), keyed by id — shared by sheets, shatter, card art. */
const frameCache = new Map<string, PixelCanvas>();
/** Frames of other art objects (dev / test arts passed to buildMonster), per object. */
const otherCaches = new WeakMap<MonsterArt, Map<string, PixelCanvas>>();

function cacheOf(art: MonsterArt): Map<string, PixelCanvas> {
  if (monsterArt(art.id) === art) return frameCache;
  let m = otherCaches.get(art);
  if (!m) otherCaches.set(art, (m = new Map()));
  return m;
}

/**
 * Draw one frame of any animation the art has into `p` (already cleared, w×h): base anims via
 * `draw`, extras via `drawExtra`. The frame is clamped to the last one; an animation the art
 * does not have draws idle frame 0. `o` is passed on only when given (old arts see 3 args).
 */
export function drawMonsterFrame(p: PixelCanvas, art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): void {
  const spec = animSpec(art, anim);
  if (!spec) {
    if (o) art.draw(p, 'idle', 0, o);
    else art.draw(p, 'idle', 0);
    return;
  }
  const f = Math.min(frame, spec.frames - 1);
  if (isExtraAnim(anim)) art.drawExtra!(p, anim, f, o);
  else if (o) art.draw(p, anim, f, o);
  else art.draw(p, anim, f);
}

/** Rendered pixels of one frame of `art` (cached). */
export function artFrame(art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
  const cache = cacheOf(art);
  const k = `${art.id}|${anim}|${frame}${o?.lightFrom === 'right' ? '|r' : ''}`;
  let pc = cache.get(k);
  if (!pc) {
    pc = new PixelCanvas(art.w, art.h);
    drawMonsterFrame(pc, art, anim, frame, o);
    cache.set(k, pc);
  }
  return pc;
}

/** Rendered pixels of a monster frame (cached). Used by shatter VFX and card art. */
export function monsterFrame(id: MonsterId, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
  return artFrame(monsterArt(id), anim, frame, o);
}

/** Does this monster draw the animation (base anims always; extras when its art defines them)? */
export function hasMonsterAnim(id: MonsterId, anim: AnyMonsterAnim): boolean {
  return hasAnim(monsterArt(id), anim);
}

export function monsterTextureKey(id: MonsterId): string {
  return `mon:${id}`;
}

// ---------------------------------------------------------------- P2 lighting (v3, A1 item 10)
//
// Monsters are drawn facing right with the key light from the frame's top-left; player 2 shows
// the same sheet mirrored (flipX), so by default ('mirror') its light comes from the screen's
// top-RIGHT. An art with `p2: 'relight'` also gets a second sheet `mon:<id>:p2`, drawn with
// DrawOpts { lightFrom: 'right' } (same layout, frame names and anims `mon:<id>:p2:<anim>`):
// mirrored, it is lit from the screen top-left again. MonsterUnit picks the sheet from its
// controller (monsterSheetKey; applyFacing / setController) and keeps the sprite on it whatever
// anim key is played, so the anim keys and their events stay `mon:<id>:<anim>`.
// monsterTextureKey(id) stays the P1 / default sheet (cut-ins, card art, gallery...).

/** Key of a monster's optional P2 'relight' sheet (exists only when one was built). */
export function monsterP2TextureKey(id: MonsterId): string {
  return `mon:${id}:p2`;
}

/** Does this art ask for a P2 'relight' sheet? (Default 'mirror': P2 flips the P1 sheet.) */
export function relightsP2(art: MonsterArt): boolean {
  return art.p2 === 'relight';
}

/**
 * The sheet a monster controlled by `player` shows: player 2 gets `mon:<id>:p2` when such a sheet
 * was built or prepared here (art.p2 === 'relight' at boot, or a dev / test sheet built with
 * SheetOpts.key = monsterP2TextureKey(id)); everything else the default `mon:<id>`.
 */
export function monsterSheetKey(id: MonsterId, player: 0 | 1): string {
  if (player === 1) {
    const k = monsterP2TextureKey(id);
    // a lazy P2 sheet is registered the first time a player-2 unit (or a cinematic warming its
    // poses) asks for it (A2 tech review r3 #8)
    if (!knownSheets.has(k)) prepareLazyP2(k);
    if (knownSheets.has(k)) return k;
  }
  return monsterTextureKey(id);
}

export function monsterAnimKey(id: MonsterId, anim: AnyMonsterAnim): string {
  return sheetAnimKey(monsterTextureKey(id), anim);
}

/** Animation key of `anim` on a monster sheet registered under texture `key`. */
export function sheetAnimKey(key: string, anim: AnyMonsterAnim): string {
  return `${key}:${anim}`;
}

export function monsterFrameName(anim: AnyMonsterAnim, frame: number): string {
  return `${anim}:${frame}`;
}

// ---------------------------------------------------------------- sheet layout + anims

/** Where and how a monster sheet is built (defaults: `mon:<id>`, the art's default lighting). */
export interface SheetOpts {
  /** Texture key; its animations are `<key>:<anim>`. Default monsterTextureKey(art.id). */
  key?: string;
  /** Passed to every draw call (e.g. { lightFrom: 'right' } for a P2 relight sheet). */
  draw?: DrawOpts;
}

interface Cell {
  anim: AnyMonsterAnim;
  f: number;
  x: number;
  y: number;
}

/** Grid of a sheet: every frame of animList(art) in order, ≤ 4096 px wide (as sheetTexture). */
function layoutSheet(art: MonsterArt): { cols: number; rows: number; cells: Cell[] } {
  const names: { anim: AnyMonsterAnim; f: number }[] = [];
  for (const anim of animList(art)) for (let f = 0; f < animSpec(art, anim)!.frames; f++) names.push({ anim, f });
  const cols = Math.max(1, Math.min(names.length, Math.floor(4096 / art.w)));
  const rows = Math.ceil(names.length / cols);
  const cells = names.map((n, i) => ({ ...n, x: (i % cols) * art.w, y: Math.floor(i / cols) * art.h }));
  return { cols, rows, cells };
}

/** (Re)create the Phaser animations of a sheet. Holds become per-frame `duration`s. */
function createSheetAnims(scene: Phaser.Scene, art: MonsterArt, key: string): void {
  for (const anim of animList(art)) {
    const spec = animSpec(art, anim)!;
    const animKey = sheetAnimKey(key, anim);
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    scene.anims.create({
      key: animKey,
      frames: Array.from({ length: spec.frames }, (_, f) => {
        const d = holdOf(spec, f);
        // no `duration` at all without a hold: the old anims are created exactly as before
        return d ? { key, frame: monsterFrameName(anim, f), duration: d } : { key, frame: monsterFrameName(anim, f) };
      }),
      frameRate: spec.fps,
      repeat: spec.loop ? -1 : 0,
    });
  }
}

/** Pixels of one sheet cell. Base frames of the default sheet share the frame cache; extras and
 *  DrawOpts variants are drawn fresh (not cached: they would double the cache for frames that
 *  only the sheet needs — monsterFrame() still caches them on request). */
function cellPixels(art: MonsterArt, c: Cell, o: DrawOpts | undefined): PixelCanvas {
  if (!o && !isExtraAnim(c.anim)) return artFrame(art, c.anim, c.f);
  const pc = new PixelCanvas(art.w, art.h);
  drawMonsterFrame(pc, art, c.anim, c.f, o);
  return pc;
}

/** Build a monster sheet + its animations synchronously (painted right now). */
export function buildMonster(scene: Phaser.Scene, art: MonsterArt, o: SheetOpts = {}): void {
  const key = o.key ?? monsterTextureKey(art.id);
  dropPending(key);
  const { cells } = layoutSheet(art);
  sheetTexture(
    scene,
    key,
    art.w,
    art.h,
    cells.map((c) => [monsterFrameName(c.anim, c.f), cellPixels(art, c, o.draw)]),
  );
  createSheetAnims(scene, art, key);
  knownSheets.add(key);
}

// ---------------------------------------------------------------- deferred monster sheets
//
// Painting all 12 monster sheets (~430 frames) took ~2.2–2.7 s of the ~3.5 s boot block that
// holds back the first frame (soak test, headless). Instead, boot now registers every sheet at
// once — blank canvas, frame rects and animations, so keys, frames and anims all exist — and the
// frames are painted afterwards in small time slices (setTimeout, ~6 ms each). Anything that
// looks a sheet up through the texture manager (sprite creation, setTexture, textures.get(...)
// for pixel reads) first finishes that sheet's BASE animations synchronously, so no consumer
// ever sees an unpainted frame; usually the background slices are long done by then. With ?test
// (screenshot tooling) everything is built synchronously at boot, as before, so films stay
// deterministic.
//
// Per-animation laziness (v3): a sheet tracks which animations are painted and uploaded. The
// base animations (MONSTER_ANIMS) are finished together on first access — one canvas upload,
// exactly the old behaviour (and old monsters have nothing else). The optional extra animations
// are painted later in the background, or on demand the first time one is played
// (anims.get('<key>:<extra>')) or one of its frames is set by name (texture.get('<extra>:<i>')),
// each costing its own frames plus one upload — so a bigger v3 sheet does not make the first
// summon wait for its death / revive / victory poses.

interface Group {
  anim: AnyMonsterAnim;
  /** cell range [start, end) */
  start: number;
  end: number;
  /** cells of the group not painted yet */
  left: number;
  /** painted AND uploaded */
  ready: boolean;
}

interface PendingSheet {
  art: MonsterArt;
  key: string;
  draw: DrawOpts | undefined;
  tex: Phaser.Textures.Texture;
  ctx: CanvasRenderingContext2D;
  cells: Cell[];
  painted: Uint8Array;
  groups: Map<AnyMonsterAnim, Group>;
  /** cells not painted yet */
  left: number;
  /** background cursor */
  next: number;
  /** a cell was painted since the last upload */
  dirty: boolean;
  /** registered by buildAllMonsters (whenMonstersBuilt waits for these) */
  boot: boolean;
  /** extra anims of this sheet (have lazy hooks) */
  extras: AnyMonsterAnim[];
  /** every base anim is painted + uploaded */
  baseReady: boolean;
}

const pendingSheets = new Map<string, PendingSheet>();
/** anim key → sheet, for the extra anims of pending sheets (AnimationManager.get hook) */
const pendingExtraAnims = new Map<string, { ps: PendingSheet; anim: AnyMonsterAnim }>();
const whenDone: (() => void)[] = [];
/** keys of every monster sheet built or prepared here (monsterSheetPending) */
const knownSheets = new Set<string>();
/** Main-thread budget of one background painting slice (ms). */
const SLICE_MS = 6;

function bootPending(): boolean {
  for (const ps of pendingSheets.values()) if (ps.boot) return true;
  return false;
}

/** Resolves once every monster sheet built at boot is painted (immediately when nothing is pending). */
export function whenMonstersBuilt(): Promise<void> {
  if (!bootPending()) return Promise.resolve();
  return new Promise((r) => whenDone.push(r));
}

/**
 * Animations of a sheet that are not painted + uploaded yet ([] when the sheet is complete or
 * was built synchronously; null when no such sheet was ever registered as deferred).
 */
export function monsterSheetPending(key: string): AnyMonsterAnim[] | null {
  const ps = pendingSheets.get(key);
  if (!ps) return knownSheets.has(key) ? [] : null;
  return [...ps.groups.values()].filter((g) => !g.ready).map((g) => g.anim);
}

function paintCell(ps: PendingSheet, i: number): void {
  if (ps.painted[i]) return;
  const c = ps.cells[i];
  const pc = cellPixels(ps.art, c, ps.draw);
  ps.ctx.putImageData(new ImageData(pc.data as Uint8ClampedArray<ArrayBuffer>, ps.art.w, ps.art.h), c.x, c.y);
  ps.painted[i] = 1;
  ps.left--;
  ps.groups.get(c.anim)!.left--;
  ps.dirty = true;
}

/** Upload the canvas (if anything changed); every fully painted group becomes ready. */
function upload(ps: PendingSheet): void {
  if (ps.dirty) {
    ps.dirty = false;
    try {
      if (ps.tex.manager) ps.tex.source[0]?.update();
    } catch (e) {
      console.error(`[art] monster sheet ${ps.key} upload failed`, e);
    }
  }
  for (const g of ps.groups.values()) if (!g.left) g.ready = true;
  ps.baseReady = MONSTER_ANIMS.every((a) => ps.groups.get(a)!.ready);
}

/** Drop a fully painted sheet from the pending set (and its lazy hooks). */
function settle(ps: PendingSheet): void {
  if (ps.left) return;
  upload(ps);
  if (pendingSheets.get(ps.key) === ps) pendingSheets.delete(ps.key);
  for (const a of ps.extras) {
    const k = sheetAnimKey(ps.key, a);
    if (pendingExtraAnims.get(k)?.ps === ps) pendingExtraAnims.delete(k);
  }
  // restore the prototype Texture.get (see hookTextureFrames)
  if (Object.prototype.hasOwnProperty.call(ps.tex, 'get')) delete (ps.tex as { get?: unknown }).get;
  if (ps.boot && !bootPending()) for (const r of whenDone.splice(0)) r();
}

/** Paint + upload the given animations of a pending sheet right now (no-op for ready ones). */
function ensureAnims(ps: PendingSheet, anims: readonly AnyMonsterAnim[]): void {
  let todo = false;
  for (const a of anims) {
    const g = ps.groups.get(a);
    if (!g || g.ready) continue;
    for (let i = g.start; i < g.end; i++) paintCell(ps, i);
    todo = true;
  }
  if (!todo) return;
  upload(ps);
  settle(ps);
}

/**
 * Paint up to `budgetMs` of pending cells of one sheet, in sheet order, up to cell `limit`;
 * true when that range is done (the sheet settles once every cell is painted).
 */
function paintSlice(ps: PendingSheet, budgetMs: number, limit: number): boolean {
  const t0 = performance.now();
  while (ps.next < limit) {
    const i = ps.next++;
    if (ps.painted[i]) continue;
    paintCell(ps, i);
    if (performance.now() - t0 > budgetMs && ps.next < limit) return false;
  }
  settle(ps);
  return true;
}

/** Finish a pending sheet's base animations right now (first access through the texture manager). */
function finishBase(key: string): void {
  const ps = pendingSheets.get(key);
  if (ps) ensureAnims(ps, MONSTER_ANIMS);
}

/**
 * Paint (and upload) some animations of a deferred sheet now — or all of them when `anims` is
 * omitted. For warming ahead of a cinematic; a no-op for complete / synchronous sheets.
 */
export function finishMonsterSheet(key: string, anims?: readonly AnyMonsterAnim[]): void {
  const ps = pendingSheets.get(key);
  if (!ps) return;
  ensureAnims(ps, anims ?? [...ps.groups.keys()]);
}

/**
 * (v3 A2 tech review r2 #12, additive) Paint the given animations of a deferred sheet FIRST, in
 * the background — short slices between frames like the boot painter (SLICE_MS each), one upload
 * once they are all painted — so a cinematic that will need them (a summon pose, the reactions and
 * the death of a unit on the field) finds them ready instead of painting them synchronously on its
 * impact frame. A no-op for complete / synchronous sheets and for anims already painted.
 */
export function warmMonsterSheet(key: string, anims: readonly AnyMonsterAnim[]): void {
  const ps = pendingSheets.get(key);
  if (!ps) return;
  const add = anims.map((a) => ps.groups.get(a)).filter((g): g is Group => !!g && !g.ready);
  if (!add.length) return;
  // one warm queue per sheet: a later call adds its anims to the running one
  let todo = warmQueues.get(ps);
  if (todo) {
    for (const g of add) if (!todo.includes(g)) todo.push(g);
    return;
  }
  todo = [...add];
  warmQueues.set(ps, todo);
  const q = todo;
  const tick = () => {
    if (pendingSheets.get(ps.key) !== ps) {
      warmQueues.delete(ps);
      return;
    }
    const t0 = performance.now();
    while (q.length && performance.now() - t0 < SLICE_MS) {
      const g = q[0];
      let i = g.start;
      while (i < g.end && ps.painted[i]) i++;
      if (i >= g.end) q.shift();
      else paintCell(ps, i);
    }
    if (q.length) {
      setTimeout(tick, 0);
      return;
    }
    warmQueues.delete(ps);
    upload(ps);
    settle(ps);
  };
  setTimeout(tick, 0);
}

/** The running warm queue of each sheet (warmMonsterSheet). */
const warmQueues = new Map<PendingSheet, Group[]>();

function dropPending(key: string): void {
  const ps = pendingSheets.get(key);
  if (!ps) return;
  ps.left = 0;
  for (const g of ps.groups.values()) g.left = 0;
  settle(ps);
}

/**
 * Register a monster sheet with blank frames + its animations; painting happens later (in the
 * background once paintSheetsInBackground() runs, or on first use — see above).
 */
export function prepareMonsterSheet(scene: Phaser.Scene, art: MonsterArt, o: SheetOpts = {}, boot = false): string {
  const key = o.key ?? monsterTextureKey(art.id);
  dropPending(key);
  const { cols, rows, cells } = layoutSheet(art);
  const w = art.w;
  const h = art.h;
  const cv = document.createElement('canvas');
  cv.width = cols * w;
  cv.height = rows * h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const tex = addStaticCanvas(scene, key, cv);
  for (const c of cells) tex.add(monsterFrameName(c.anim, c.f), 0, c.x, c.y, w, h);
  createSheetAnims(scene, art, key);
  const groups = new Map<AnyMonsterAnim, Group>();
  cells.forEach((c, i) => {
    const g = groups.get(c.anim);
    if (g) {
      g.end = i + 1;
      g.left++;
    } else groups.set(c.anim, { anim: c.anim, start: i, end: i + 1, left: 1, ready: false });
  });
  const extras = [...groups.keys()].filter(isExtraAnim);
  const ps: PendingSheet = {
    art,
    key,
    draw: o.draw,
    tex,
    ctx,
    cells,
    painted: new Uint8Array(cells.length),
    groups,
    left: cells.length,
    next: 0,
    dirty: false,
    boot,
    extras,
    baseReady: false,
  };
  pendingSheets.set(key, ps);
  knownSheets.add(key);
  for (const a of extras) pendingExtraAnims.set(sheetAnimKey(key, a), { ps, anim: a });
  // anims are created: from here on, lookups of a pending sheet paint what they need first
  hookTextureManager(scene.textures);
  hookAnimationManager(scene.anims);
  if (extras.length) hookTextureFrames(ps);
  return key;
}

const hooked = new WeakSet<object>();

/** Make textures.get('mon:<id>') finish that sheet's base anims first (once per game). */
function hookTextureManager(tm: Phaser.Textures.TextureManager): void {
  if (hooked.has(tm)) return;
  hooked.add(tm);
  const get = tm.get.bind(tm);
  tm.get = ((key: string | Phaser.Textures.Texture) => {
    if (pendingSheets.size && typeof key === 'string') {
      const ps = pendingSheets.get(key);
      if (ps && !ps.baseReady) finishBase(key);
    }
    return get(key);
  }) as typeof tm.get;
}

/** Make anims.get('<key>:<extra anim>') (every play() goes through it) paint that anim first. */
function hookAnimationManager(am: Phaser.Animations.AnimationManager): void {
  if (hooked.has(am)) return;
  hooked.add(am);
  const get = am.get.bind(am);
  am.get = ((key: string) => {
    if (pendingExtraAnims.size) {
      const e = pendingExtraAnims.get(key);
      if (e) ensureAnims(e.ps, [...MONSTER_ANIMS, e.anim]);
    }
    return get(key);
  }) as typeof am.get;
}

/**
 * Only on sheets with extra anims, until they are complete: setFrame('<extra>:<i>') (poses) goes
 * through Texture.get(name), so paint that anim first. Installed after the anims were created
 * (anims.create resolves its frames through Texture.get too).
 */
function hookTextureFrames(ps: PendingSheet): void {
  const tex = ps.tex;
  const get = Phaser.Textures.Texture.prototype.get;
  tex.get = function (this: Phaser.Textures.Texture, name?: string | number) {
    if (typeof name === 'string' && pendingSheets.get(ps.key) === ps) {
      const anim = name.slice(0, name.lastIndexOf(':')) as AnyMonsterAnim;
      const g = ps.groups.get(anim);
      if (g && !g.ready) ensureAnims(ps, [...MONSTER_ANIMS, anim]);
    }
    return get.call(this, name);
  };
}

/**
 * Paint the given pending sheets in short slices between frames (requestIdleCallback starves
 * under load: 40+ s in the headless test); a frame is ~2–8 ms of drawing, so a slice may overrun
 * its budget a bit. Base anims of every sheet first, then the extras.
 */
function paintSheetsInBackground(sheets: PendingSheet[]): void {
  const baseEnd = (ps: PendingSheet) => (ps.extras.length ? ps.groups.get(ps.extras[0])!.start : ps.cells.length);
  const queue: { ps: PendingSheet; limit: number }[] = [
    ...sheets.map((ps) => ({ ps, limit: baseEnd(ps) })),
    ...sheets.filter((ps) => ps.extras.length).map((ps) => ({ ps, limit: ps.cells.length })),
  ];
  const tick = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < SLICE_MS) {
      const { ps, limit } = queue[0];
      if (pendingSheets.get(ps.key) !== ps || paintSlice(ps, SLICE_MS - (performance.now() - t0), limit)) queue.shift();
    }
    if (queue.length) setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
}

/** Options of the optional P2 'relight' sheet of `art` (see monsterSheetKey). */
function p2SheetOpts(art: MonsterArt): SheetOpts {
  return { key: monsterP2TextureKey(art.id), draw: { lightFrom: 'right' } };
}

// A2 tech review r3 #8: the P2 'relight' sheets (13.6 MB and ~2.8 s of painting for the two v3
// slice monsters) were allocated at boot and painted in the background in every game, used or
// not. Outside ?test they are now LAZY: registered (blank canvas, frames, anims) the first time a
// player-2 unit of that monster needs its sheet — monsterSheetKey(id, 1), which MonsterUnit's sheet
// selection and the cinematics' pose warming (a summon / revive / steal of player 2 warms its poses
// before the body appears) go through — then painted in the background like the boot sheets,
// base anims first (a lookup before they are done paints them synchronously, as for any deferred
// sheet). With ?test (films, measure) they are still built synchronously at boot.

const lazyP2 = new Map<string, { scene: Phaser.Scene; art: MonsterArt }>();

/** Register (and start painting) a lazy P2 sheet by key; no-op when there is none or it exists. */
function prepareLazyP2(key: string): void {
  const job = lazyP2.get(key);
  if (!job) return;
  lazyP2.delete(key);
  try {
    if (!job.scene.sys?.game) return;
    prepareMonsterSheet(job.scene, job.art, p2SheetOpts(job.art), false);
    paintMonsterSheets([key]);
  } catch (e) {
    console.error(`[art] lazy P2 sheet ${key} failed`, e);
    dropPending(key);
    knownSheets.delete(key);
  }
}

export function buildAllMonsters(scene: Phaser.Scene): void {
  const sync = typeof location === 'undefined' || new URLSearchParams(location.search).has('test');
  // P2 'relight' sheets (opt-in per art) come after every default sheet — lazily outside ?test
  const p2 = MONSTER_IDS.map((id) => monsterArt(id))
    .filter(relightsP2)
    .map((art) => ({ art, o: p2SheetOpts(art) }));
  const jobs: { art: MonsterArt; o: SheetOpts }[] = [...MONSTER_IDS.map((id) => ({ art: monsterArt(id), o: {} })), ...(sync ? p2 : [])];
  if (sync) {
    for (const j of jobs) buildMonster(scene, j.art, j.o);
    return;
  }
  for (const { art, o } of p2) lazyP2.set(o.key!, { scene, art });
  const sheets: PendingSheet[] = [];
  for (const { art, o } of jobs) {
    const key = o.key ?? monsterTextureKey(art.id);
    try {
      prepareMonsterSheet(scene, art, o, true);
      sheets.push(pendingSheets.get(key)!);
    } catch (e) {
      // fall back to the synchronous path for this one
      console.error(`[art] deferred monster sheet ${key} failed, building now`, e);
      dropPending(key);
      buildMonster(scene, art, o);
    }
  }
  paintSheetsInBackground(sheets);
}

/** Start background painting of deferred sheets registered with prepareMonsterSheet (by key). */
export function paintMonsterSheets(keys: readonly string[]): void {
  paintSheetsInBackground(keys.map((k) => pendingSheets.get(k)).filter((ps): ps is PendingSheet => !!ps));
}
