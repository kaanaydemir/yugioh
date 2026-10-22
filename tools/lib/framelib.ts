// Shared frame / pixel helpers of the A3 gate tools (docs/v3/A3_MIMARI.md §9, §14 Y6):
// tools/sameness.ts and tools/monster-gates.ts. Node (fs / zlib through process.getBuiltinModule, see
// below), no Phaser, deterministic.
//
// Frames are drawn exactly like the game draws its sheet frames (src/art/textures.ts: a fresh
// PixelCanvas(w, h) + art.draw / art.drawExtra) and like tools/monster-sheet.ts, so every number of
// the gate tools is measured on the pixels the game shows.
//
//   drawFrame / FrameStore      one frame (cached per art, anim, frame, light side)
//   delta / isolated / colours  the monster-sheet pixel metrics (same definitions)
//   bodyHeight / normMask       the §9.1 silhouette: anchor-aligned (anchor → (64, 60) on a 128×64
//                               grid), every art scaled (nearest) so its own idle-f0 body height is 56 px
//   changedMask                 pixels differing from idle f0 in any frame of an anim (HEAT)
//   sampleFrames / jitterSpec   hold-weighted time samples; the ±60 ms hold jitter of control (c)
//   png / text / blitScaled     output (the PNG encoder of tools/monster-sheet.ts; the game's font)
//   loadRegistry / loadArtFile  the art the game draws for a look; a MonsterArt module outside it
//   noiseClass / missingMarks / feetBand / sizeClass   pure helpers of tools/monster-gates.ts (REHBER §8.1)

import { animSpec, frameMs, isExtraAnim } from '../../src/art/animtime';
import { drawGlyph, getFont, hasGlyph } from '../../src/art/font';
import { PixelCanvas } from '../../src/art/pixel';
import type { AnimSpec, AnyMonsterAnim, DrawOpts, MonsterArt } from '../../src/art/types';

// ---------------------------------------------------------------- Node built-ins
//
// This file is imported by tests/tools/*.test.ts, which `npm run typecheck` (tsc over src + tests)
// follows; the repo has no @types/node, so the few built-ins are reached through
// process.getBuiltinModule (Node ≥ 22.3) with minimal local types instead of `import 'node:…'`.

interface NodeFs {
  mkdirSync(p: string, o?: { recursive?: boolean }): unknown;
  writeFileSync(p: string, d: Uint8Array | string): void;
  readFileSync(p: string, enc: 'utf8'): string;
  existsSync(p: string): boolean;
}
interface NodePath {
  resolve(...p: string[]): string;
  dirname(p: string): string;
  join(...p: string[]): string;
  basename(p: string): string;
  relative(from: string, to: string): string;
}
interface NodeZlib {
  deflateSync(d: Uint8Array, o?: { level?: number }): Uint8Array;
}
interface NodeUrl {
  pathToFileURL(p: string): { href: string };
}
interface NodeProcess {
  getBuiltinModule(id: string): unknown;
  hrtime: { bigint(): bigint };
  cpuUsage(prev?: { user: number; system: number }): { user: number; system: number };
}
export const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;
const builtin = <T>(id: string): T => nodeProcess.getBuiltinModule(id) as T;
export const nodeFs = builtin<NodeFs>('node:fs');
export const nodePath = builtin<NodePath>('node:path');
const nodeZlib = builtin<NodeZlib>('node:zlib');
const nodeUrl = builtin<NodeUrl>('node:url');

/** High-resolution wall clock (ms). */
export function nowMs(): number {
  return Number(nodeProcess.hrtime.bigint()) / 1e6;
}

/** CPU time of this process (user + system, ms): unlike the wall clock it barely moves when other work loads the machine. */
export function cpuMs(): number {
  const u = nodeProcess.cpuUsage();
  return (u.user + u.system) / 1000;
}

// ---------------------------------------------------------------- frames

/** One frame as the game draws it (textures.ts drawMonsterFrame; tools/monster-sheet.ts drawFrame). */
export function drawFrame(art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
  const p = new PixelCanvas(art.w, art.h);
  const spec = animSpec(art, anim);
  if (!spec) throw new Error(`${art.id}: no '${anim}' animation`);
  const f = Math.max(0, Math.min(Math.floor(frame), spec.frames - 1));
  if (isExtraAnim(anim)) art.drawExtra!(p, anim, f, o);
  else if (o) art.draw(p, anim, f, o);
  else art.draw(p, anim, f);
  return p;
}

/** Frame cache: every (anim, frame, light side) of an art is drawn once. */
export class FrameStore {
  private readonly cache = new Map<string, PixelCanvas>();
  constructor(readonly art: MonsterArt) {}
  get(anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
    const k = `${anim}|${frame}|${o?.lightFrom ?? '-'}`;
    let p = this.cache.get(k);
    if (!p) {
      p = drawFrame(this.art, anim, frame, o);
      this.cache.set(k, p);
    }
    return p;
  }
}

/** Pixels that differ between two same-size frames (colour or opacity; two transparent = same). */
export function delta(a: PixelCanvas, b: PixelCanvas): number {
  let n = 0;
  const A = a.data;
  const B = b.data;
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3] === 0 && B[i + 3] === 0) continue;
    if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2] || A[i + 3] !== B[i + 3]) n++;
  }
  return n;
}

/** Opaque pixels whose opaque 4-neighbours all have another colour (tools/monster-sheet.ts "isolated"). */
export function isolated(p: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      let same = false;
      let any = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const d = p.get(x + dx, y + dy);
        if (d === null) continue;
        any = true;
        if (d === c) same = true;
      }
      if (any && !same) n++;
    }
  return n;
}

/** Distinct opaque colours. */
export function colours(p: PixelCanvas): number {
  const s = new Set<number>();
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c !== null) s.add(c);
    }
  return s.size;
}

// ---------------------------------------------------------------- normalized silhouettes (§9.1)

/** Grid of the normalized silhouettes: GRID_W × GRID_H, the anchor at (GRID_N, GRID_N - 4). */
export const GRID_N = 64;
export const GRID_W = GRID_N * 2;
export const GRID_H = GRID_N;
/** Body height every art is scaled to (px). */
export const NORM_H = GRID_N - 8;

/** Body height of an art: anchorY − top row of its idle f0 (the scale reference of every §9 metric). */
export function bodyHeight(art: MonsterArt, idle0: PixelCanvas): number {
  const b = idle0.bounds();
  if (!b) throw new Error(`${art.id}: idle f0 is empty`);
  return art.anchorY - b.y;
}

/** Nearest-neighbour sample of a frame-sized boolean field onto the normalized grid. */
function normalize(art: MonsterArt, h: number, on: (sx: number, sy: number) => boolean): Uint8Array {
  const k = NORM_H / h;
  const m = new Uint8Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      const sx = Math.floor(art.anchorX + (x - GRID_N) / k);
      const sy = Math.floor(art.anchorY + (y - (GRID_N - 4)) / k);
      if (sx >= 0 && sy >= 0 && sx < art.w && sy < art.h && on(sx, sy)) m[y * GRID_W + x] = 1;
    }
  return m;
}

/** The §9.1 silhouette of a frame: opaque mask, anchor-aligned, body height `h` → 56 px. */
export function normMask(art: MonsterArt, p: PixelCanvas, h: number): Uint8Array {
  return normalize(art, h, (sx, sy) => p.isOpaque(sx, sy));
}

/** HEAT mask: pixels that differ from idle f0 (any RGBA byte) in any frame of `anim`, normalized. */
export function changedMask(store: FrameStore, anim: AnyMonsterAnim, h: number): Uint8Array {
  const art = store.art;
  const spec = animSpec(art, anim)!;
  const i0 = store.get('idle', 0).data;
  const ch = new Uint8Array(art.w * art.h);
  for (let f = 0; f < spec.frames; f++) {
    const q = store.get(anim, f).data;
    for (let i = 0; i < art.w * art.h; i++) {
      const a = i * 4;
      if (q[a + 3] !== i0[a + 3] || q[a] !== i0[a] || q[a + 1] !== i0[a + 1] || q[a + 2] !== i0[a + 2]) ch[i] = 1;
    }
  }
  return normalize(art, h, (sx, sy) => ch[sy * art.w + sx] === 1);
}

// ---------------------------------------------------------------- time sampling

/** Frame shown at each of `n` hold-weighted time samples (sample s at (s + 0.5) / n of the length). */
export function sampleFrames(spec: AnimSpec, n: number): number[] {
  const starts: number[] = [];
  let t = 0;
  for (let f = 0; f < spec.frames; f++) {
    starts.push(t);
    t += frameMs(spec, f);
  }
  const out: number[] = [];
  for (let s = 0; s < n; s++) {
    const tt = ((s + 0.5) / n) * t;
    let f = 0;
    while (f + 1 < spec.frames && starts[f + 1] <= tt) f++;
    out.push(f);
  }
  return out;
}

/**
 * Control (c) of §9.2: the same frames with every hold moved by ±60 ms (deterministic pattern
 * +60 / −60 / +30, at least 40 ms): an art cannot escape the motion metric by retiming its holds.
 */
export function jitterSpec(spec: AnimSpec): AnimSpec {
  const holds: number[] = [];
  for (let f = 0; f < spec.frames; f++) holds.push(Math.max(40, Math.round(frameMs(spec, f) + (f % 3 === 0 ? 60 : f % 3 === 1 ? -60 : 30))));
  return { ...spec, holds };
}

// ---------------------------------------------------------------- PNG (tools/monster-sheet.ts encoder)

const CRC_T = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** RGBA PNG of `p` ×k (nearest); transparent pixels get `bg` (or stay transparent). */
export function pngBytes(p: PixelCanvas, k = 1, bg: number | null = null): Uint8Array {
  const W = p.w * k;
  const H = p.h * k;
  const raw = new Uint8Array((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / k);
      const sy = Math.floor(y / k);
      const a = p.alpha(sx, sy);
      let c = p.get(sx, sy);
      let alpha = 255;
      if (a === 0 || c === null) {
        if (bg === null) alpha = 0;
        c = bg ?? 0;
      } else if (a < 255 && bg !== null) {
        const t = a / 255;
        const m = (s: number) => Math.round(((c! >> s) & 255) * t + ((bg >> s) & 255) * (1 - t));
        c = (m(16) << 16) | (m(8) << 8) | m(0);
      }
      const i = y * (W * 4 + 1) + 1 + x * 4;
      raw[i] = (c >> 16) & 255;
      raw[i + 1] = (c >> 8) & 255;
      raw[i + 2] = c & 255;
      raw[i + 3] = alpha;
    }
  }
  const cat = (parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((s, q) => s + q.length, 0));
    let o = 0;
    for (const q of parts) {
      out.set(q, o);
      o += q.length;
    }
    return out;
  };
  const u32 = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v >>> 0);
    return b;
  };
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (const v of b) c = CRC_T[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Uint8Array) => {
    const td = cat([new TextEncoder().encode(t), d]);
    return cat([u32(d.length), td, u32(crc(td))]);
  };
  const ih = new Uint8Array(13);
  const dv = new DataView(ih.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ih[8] = 8;
  ih[9] = 6;
  return cat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', nodeZlib.deflateSync(raw, { level: 6 })), chunk('IEND', new Uint8Array(0))]);
}

export function writePng(p: PixelCanvas, file: string, k = 1, bg: number | null = null): void {
  nodeFs.mkdirSync(nodePath.dirname(file), { recursive: true });
  nodeFs.writeFileSync(file, pngBytes(p, k, bg));
}

// ---------------------------------------------------------------- text (the game's pixel font, src/art/font.ts sm)

const FONT = getFont('sm');
export const TEXT_H = FONT.def.cellH;

export function textWidth(s: string, k = 1): number {
  let w = 0;
  for (const ch of s) w += ((FONT.glyphs.get((hasGlyph(ch) ? ch : '?').charCodeAt(0))?.w ?? 3) + 1) * k;
  return Math.max(0, w - k);
}

/** Draw `s` with its cell top-left at (x, y), every font pixel a k×k block. Returns the width. */
export function text(p: PixelCanvas, x: number, y: number, s: string, c: number, k = 1): number {
  let pen = x;
  for (const raw of s) {
    const ch = hasGlyph(raw) ? raw : '?';
    const g = FONT.glyphs.get(ch.charCodeAt(0));
    if (!g) continue;
    if (k === 1) drawGlyph(p, g, TEXT_H, pen, y, c);
    else for (let j = 0; j < TEXT_H; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) p.rect(pen + i * k, y + j * k, k, k, c);
    pen += (g.w + 1) * k;
  }
  return pen - x;
}

/** Nearest-neighbour blit of `src` ×k at (x, y), optionally mirrored, optionally recoloured to one tone. */
export function blitScaled(dst: PixelCanvas, src: PixelCanvas, x: number, y: number, k: number, flipX = false, tone?: number): void {
  for (let sy = 0; sy < src.h; sy++)
    for (let sx = 0; sx < src.w; sx++) {
      const a = src.alpha(sx, sy);
      if (!a) continue;
      const c = tone ?? src.get(sx, sy)!;
      const dx = flipX ? src.w - 1 - sx : sx;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) dst.set(x + dx * k + i, y + sy * k + j, c, tone === undefined ? a : 255);
    }
}

/** Paint a normalized grid mask ×k at (x, y) in one tone. */
export function blitMask(dst: PixelCanvas, m: Uint8Array, x: number, y: number, k: number, c: number): void {
  for (let gy = 0; gy < GRID_H; gy++)
    for (let gx = 0; gx < GRID_W; gx++) if (m[gy * GRID_W + gx]) dst.rect(x + gx * k, y + gy * k, k, k, c);
}

// ---------------------------------------------------------------- art loading

export type Look = 'v1' | 'v3';

export interface Registry {
  MONSTER_IDS: readonly string[];
  monsterArt(id: string): MonsterArt;
  monsterArtV1(id: string): MonsterArt;
  monsterArtV3(id: string): MonsterArt | null;
  hasMonsterArtV3(id: string): boolean;
}

/**
 * The art registry as the game sees it under `look`. The look is decided once when
 * src/view/layout.ts is first evaluated, so the global is set BEFORE the registry is imported
 * (like tools/sheet-hash.ts and tools/monster-sheet.ts). Throws if layout.ts was already loaded
 * with another look.
 */
export async function loadRegistry(look: Look): Promise<Registry> {
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = look;
  const cards = await import('../../src/data/cards');
  const reg = await import('../../src/art/monsters');
  const { LOOK } = await import('../../src/view/layout');
  if (LOOK !== look) throw new Error(`layout.ts LOOK is ${LOOK}, wanted ${look} (was it imported before the global was set?)`);
  return {
    MONSTER_IDS: cards.MONSTER_IDS,
    monsterArt: (id) => reg.monsterArt(id as never),
    monsterArtV1: (id) => reg.monsterArtV1(id as never),
    monsterArtV3: (id) => reg.monsterArtV3(id as never),
    hasMonsterArtV3: (id) => reg.hasMonsterArtV3(id as never),
  };
}

/** The default-exported MonsterArt of a module outside the registry (a draft, a control, a test art). */
export async function loadArtFile(file: string): Promise<MonsterArt> {
  const mod = (await import(/* @vite-ignore */ nodeUrl.pathToFileURL(nodePath.resolve(file)).href)) as { default?: MonsterArt };
  if (!mod.default?.id || typeof mod.default.draw !== 'function') throw new Error(`${file}: no default-exported MonsterArt`);
  return mod.default;
}

// ---------------------------------------------------------------- deterministic shuffling

/** mulberry32: a small seeded PRNG (the tools never use Math.random). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with a seeded PRNG (returns a new array). */
export function shuffled<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- monster-gates helpers (REHBER §8.1 KK-3…KK-6, KK-13)

/** A frame's class in the noise budget (REHBER IŞ-10) and its limit (isolated / opaque). */
export interface NoiseClass {
  cls: 'body' | 'effect';
  limit: number;
}

/**
 * IŞ-10 frame classes: effect frames (≤ 20 %) are the cast of attack / special (from the charge mark
 * on: gather, release and the glow that lingers through the recovery), every frame of summon / revive
 * (the body materialises) and death from its dissolve mark; every other frame is a body frame (≤ 15 %).
 * These classes give the slice's documented maxima: body 14.7 % (magus toGuard / guard), effect 19.0 %
 * (magus death / summon) — with the recovery counted as body the magus' special f9 (14.9 %) would be
 * the body maximum instead.
 */
export function noiseClass(anim: AnyMonsterAnim, frame: number, marks: Partial<Record<string, number>>, frames: number): NoiseClass {
  const body: NoiseClass = { cls: 'body', limit: 0.15 };
  const effect: NoiseClass = { cls: 'effect', limit: 0.2 };
  if (anim === 'attack' || anim === 'special') {
    const rel = marks.release ?? marks.impact ?? marks['impact*'] ?? frames;
    return frame >= (marks.charge ?? rel) ? effect : body;
  }
  if (anim === 'summon' || anim === 'revive') return effect;
  if (anim === 'death') return frame >= (marks.dissolve ?? frames) ? effect : body;
  return body;
}

/** HA-1 mandatory marks per anim (attack 'contact' is only for melee / beam attacks: reported, not required). */
export const REQUIRED_MARKS: Partial<Record<AnyMonsterAnim, readonly string[]>> = {
  attack: ['charge', 'release', 'recover'],
  roar: ['charge', 'release', 'recover'],
  special: ['charge', 'release', 'recover'],
  hit: ['impact', 'contact', 'recover'],
  hitHeavy: ['impact', 'contact', 'recover'],
  hitMagic: ['impact', 'contact', 'recover'],
  death: ['impact', 'contact', 'dissolve'],
  summon: ['land'],
  revive: ['land'],
};

/** Missing HA-1 marks of an anim ('release' is satisfied by 'impact' — the attack's falls back to attackImpactFrame). */
export function missingMarks(anim: AnyMonsterAnim, marks: Partial<Record<string, number>>): string[] {
  const need = REQUIRED_MARKS[anim] ?? [];
  const has = (m: string) => marks[m] !== undefined || (m === 'release' && (marks.impact !== undefined || marks['impact*'] !== undefined));
  const out = need.filter((m) => !has(m));
  // reactions and death: impact and contact sit on f0 (REHBER §4.1)
  if (['hit', 'hitHeavy', 'hitMagic', 'death'].includes(anim)) for (const m of ['impact', 'contact']) if (marks[m] !== undefined && marks[m] !== 0) out.push(`${m}≠f0`);
  return out;
}

/** The feet of a frame (feet.py, A2 acceptance): bottom opaque row and the x range of the lowest `band` rows. */
export function feetBand(p: PixelCanvas, band = 6): { bottom: number; x0: number; x1: number } | null {
  const b = p.bounds();
  if (!b) return null;
  const bottom = b.y + b.h - 1;
  let x0 = Infinity;
  let x1 = -1;
  for (let y = Math.max(0, bottom - band + 1); y <= bottom; y++)
    for (let x = 0; x < p.w; x++)
      if (p.isOpaque(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  return { bottom, x0, x1 };
}

export type SizeClass = 'ace' | 'large' | 'medium' | 'small';
/** KK-13 uncropped sheet bytes per side (decimal MB, as A3_MIMARI §11.1 counts them: 6 562 816 B = 6.56 MB). */
export const SHEET_BUDGET_MB: Record<SizeClass, number> = { ace: 7, large: 5, medium: 3.6, small: 2.2 };

/**
 * Size class (A3_MIMARI §11.1): a hand-built whole art (L5, no body plan) of v3 is the ace class (wyrm,
 * magus); otherwise by the v1 frame width: ≥ 80 large, ≥ 64 medium, else small.
 */
export function sizeClass(art: MonsterArt, v1Width: number, isV3: boolean): SizeClass {
  if (isV3 && !art.bodyPlan) return 'ace';
  return v1Width >= 80 ? 'large' : v1Width >= 64 ? 'medium' : 'small';
}
