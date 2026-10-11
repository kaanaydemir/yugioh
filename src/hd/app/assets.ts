// Asset registry for the HD trial: discovers HD monsters (src/hd/monsters/*.ts, default export HDMonsterArt)
// and arena themes (src/hd/arena/*.ts, default export ArenaTheme) with LAZY globs, so a module that is still
// being written (or broken) by another agent can never stop the page from loading — it is simply imported
// when requested, inside try/catch, and a placeholder is used when it is missing.
//
//   listMonsterIds()                 ids that have an HD file
//   loadMonsterArt(id)               { art, placeholder }  (placeholder = the current game's art, upscaled ×1.5 with inflated normals)
//   ensureMonsterTextures(scene, id, onProgress?)  renders every frame once → lit sheet + Phaser animations
//   loadArenaTheme(id?)              { theme, placeholder }

import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import { monsterArt as legacyArt } from '../../art/monsters';
import { PixelCanvas } from '../../art/pixel';
import { MONSTER_ANIMS, type MonsterAnim } from '../../art/types';
import type { ArenaTheme, HDFrame, HDMonsterArt } from '../contracts';
import { makeLitSheet } from './lighting';
import { placeholderArenaTheme } from './placeholder-arena';

type ArtModule = { default?: HDMonsterArt };
type ThemeModule = { default?: ArenaTheme };

const monsterLoaders = import.meta.glob<ArtModule>(['../monsters/*.ts', '!../monsters/_*.ts']);
const arenaLoaders = import.meta.glob<ThemeModule>(['../arena/*.ts', '!../arena/_*.ts']);

const base = (path: string) => path.replace(/^.*\//, '').replace(/\.ts$/, '');

export function listMonsterIds(): string[] {
  return Object.keys(monsterLoaders).map(base);
}

export function listArenaIds(): string[] {
  return Object.keys(arenaLoaders).map(base);
}

function report(what: string, err: unknown): void {
  console.error(`[hd] ${what} failed to load`, err);
  window.__neon?.errors.push(`${what}: ${String(err)}`);
}

const artCache = new Map<string, { art: HDMonsterArt; placeholder: boolean }>();

function isArt(a: unknown): a is HDMonsterArt {
  const m = a as HDMonsterArt | undefined;
  return !!m && typeof m.render === 'function' && typeof m.id === 'string' && !!m.anims;
}

/** The HD art of a monster, or a derived placeholder when no HD file exists yet. */
export async function loadMonsterArt(id: MonsterId): Promise<{ art: HDMonsterArt; placeholder: boolean }> {
  const hit = artCache.get(id);
  if (hit) return hit;
  let out: { art: HDMonsterArt; placeholder: boolean } | null = null;
  const entries = Object.entries(monsterLoaders);
  const direct = entries.filter(([p]) => base(p) === id);
  // the file named after the id first, then (only if that fails) every other module, in case a file is named differently
  for (const [path, load] of [...direct, ...entries.filter(([p]) => base(p) !== id)]) {
    try {
      const mod = await load();
      if (isArt(mod.default) && mod.default.id === id) {
        out = { art: mod.default, placeholder: false };
        break;
      }
      if (direct.some(([p]) => p === path)) report(`monster ${path}`, new Error('default export is not an HDMonsterArt with this id'));
    } catch (err) {
      if (direct.some(([p]) => p === path)) report(`monster ${path}`, err);
    }
  }
  if (!out) out = { art: placeholderHDMonster(id), placeholder: true };
  artCache.set(id, out);
  return out;
}

const themeCache = new Map<string, { theme: ArenaTheme; placeholder: boolean }>();

/** An arena theme by file/id (default: 'neon', else the first one found, else a placeholder). */
export async function loadArenaTheme(id = 'neon'): Promise<{ theme: ArenaTheme; placeholder: boolean }> {
  const hit = themeCache.get(id);
  if (hit) return hit;
  const entries = Object.entries(arenaLoaders);
  const ordered = [...entries.filter(([p]) => base(p) === id), ...entries.filter(([p]) => base(p) !== id)];
  let out: { theme: ArenaTheme; placeholder: boolean } | null = null;
  for (const [path, load] of ordered) {
    try {
      const mod = await load();
      const t = mod.default;
      if (t && typeof t.build === 'function' && t.lighting) {
        out = { theme: t, placeholder: false };
        break;
      }
    } catch (err) {
      report(`arena ${path}`, err);
    }
  }
  if (!out) out = { theme: placeholderArenaTheme, placeholder: true };
  themeCache.set(id, out);
  return out;
}

// ================================================================ placeholder monsters

/** Nearest-neighbour ×k resample (k may be fractional): placeholder only. */
function resample(src: PixelCanvas, k: number): PixelCanvas {
  const w = Math.round(src.w * k);
  const h = Math.round(src.h * k);
  const out = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.h - 1, Math.floor(y / k));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.w - 1, Math.floor(x / k));
      const si = (sy * src.w + sx) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

/** Cheap "inflated" normal map from the silhouette: a blurred mask used as a height field. */
function inflatedNormals(c: PixelCanvas, radius = 7): PixelCanvas {
  const { w, h } = c;
  let a: Float32Array = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = c.data[i * 4 + 3] > 0 ? 1 : 0;
  const blur = (src: Float32Array, r: number): Float32Array => {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const inv = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc * inv;
        acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc * inv;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  };
  a = blur(blur(blur(a, radius), radius), Math.ceil(radius / 2));
  const out = new PixelCanvas(w, h);
  const k = radius * 1.4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (c.data[i * 4 + 3] === 0) continue;
      const hl = a[y * w + Math.max(0, x - 1)];
      const hr = a[y * w + Math.min(w - 1, x + 1)];
      const hu = a[Math.max(0, y - 1) * w + x];
      const hd = a[Math.min(h - 1, y + 1) * w + x];
      let nx = -(hr - hl) * k;
      let ny = (hd - hu) * k;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      out.data[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      out.data[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out.data[i * 4 + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
      out.data[i * 4 + 3] = 255;
    }
  }
  return out;
}

/** Emissive layer for placeholders: bright, saturated pixels (flames, eyes, crystal veins). */
function brightSaturated(c: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(c.w, c.h);
  for (let i = 0; i < c.data.length; i += 4) {
    if (c.data[i + 3] === 0) continue;
    const r = c.data[i] / 255;
    const g = c.data[i + 1] / 255;
    const b = c.data[i + 2] / 255;
    const mx = Math.max(r, g, b);
    const k = (mx - Math.min(r, g, b)) * mx;
    if (k < 0.5) continue;
    out.data[i] = c.data[i];
    out.data[i + 1] = c.data[i + 1];
    out.data[i + 2] = c.data[i + 2];
    out.data[i + 3] = Math.min(255, Math.round((k - 0.4) * 2.2 * 255));
  }
  return out;
}

/** HDMonsterArt derived from the current game's art: ×1.5 nearest-neighbour + inflated normals. For wiring/lighting tests only. */
export function placeholderHDMonster(id: MonsterId): HDMonsterArt {
  const src = legacyArt(id);
  const K = 1.5;
  const w = Math.round(src.w * K);
  const h = Math.round(src.h * K);
  const cache = new Map<string, HDFrame>();
  return {
    id,
    w,
    h,
    anchorX: src.anchorX * K,
    anchorY: src.anchorY * K,
    hover: src.hover * K,
    muzzle: { x: src.muzzle.x * K, y: src.muzzle.y * K },
    core: { x: src.core.x * K, y: src.core.y * K },
    anims: src.anims,
    attackImpactFrame: src.attackImpactFrame,
    render(anim: MonsterAnim, frame: number): HDFrame {
      const key = `${anim}|${frame}`;
      let f = cache.get(key);
      if (!f) {
        const p = new PixelCanvas(src.w, src.h);
        src.draw(p, anim, Math.min(frame, src.anims[anim].frames - 1));
        const color = resample(p, K);
        f = { color, normal: inflatedNormals(color), emissive: brightSaturated(color) } as HDFrame;
        cache.set(key, f);
      }
      return f;
    },
  };
}

// ================================================================ lit monster textures

export interface MonsterTextures {
  art: HDMonsterArt;
  placeholder: boolean;
  /** Texture key of the colour sheet (frames `<anim>:<i>`, normal map as data source). */
  key: string;
  /** Plain texture of the normal sheet (same frame names), for debug views. */
  normalKey: string;
  /** Plain texture of the emissive sheet (RGB = colour, A = glow strength) when the art provides `emissive` per frame, else null. */
  emissiveKey: string | null;
  /** Width of the opaque body in idle frame 0 (shadow sizing). */
  bodyW: number;
  frameName(anim: MonsterAnim, frame: number): string;
  animKey(anim: MonsterAnim): string;
}

export const monsterKey = (id: string) => `hd:mon:${id}`;
const frameName = (anim: MonsterAnim, f: number) => `${anim}:${f}`;
const animKey = (id: string, anim: MonsterAnim) => `hd:mon:${id}:${anim}`;

const textureInfo = new Map<string, MonsterTextures>();

/** Cheap sanity checks on a rendered frame; problems are logged once per monster (console.warn + __neon.hdWarnings). */
function checkFrame(id: string, anim: MonsterAnim, f: number, fr: HDFrame, warned: Set<string>): void {
  const warn = (kind: string, msg: string) => {
    if (warned.has(kind)) return;
    warned.add(kind);
    const text = `[hd] ${id} ${anim}:${f}: ${msg}`;
    console.warn(text);
    const w = ((window.__neon as Record<string, unknown>).hdWarnings ??= []) as string[];
    w.push(text);
  };
  const c = fr.color;
  const n = fr.normal;
  if (c.w !== n.w || c.h !== n.h) return warn('size', `colour ${c.w}×${c.h} and normal ${n.w}×${n.h} differ`);
  let missing = 0;
  let bad = 0;
  for (let i = 0; i < c.data.length; i += 4) {
    if (c.data[i + 3] === 0) continue;
    if (n.data[i + 3] === 0) {
      missing++;
      continue;
    }
    // a unit normal toward the viewer side: z >= 128 (128 = 0); a length far from 1 means a wrong encoding
    const x = n.data[i] / 127.5 - 1;
    const y = n.data[i + 1] / 127.5 - 1;
    const z = n.data[i + 2] / 127.5 - 1;
    const l = Math.hypot(x, y, z);
    if (l < 0.7 || l > 1.3 || z < -0.05) bad++;
  }
  if (missing > 0) warn('missing', `${missing} opaque colour pixels have no normal (alpha 0): they will be lit with a garbage normal`);
  if (bad > 12) warn('bad', `${bad} normals are not unit-length / face away from the viewer (RGB must be n*0.5+0.5, +Y up, +Z toward the viewer)`);
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Render every frame of a monster once (time-sliced so the page stays responsive), build the lit sheet and the
 * Phaser animations `hd:mon:<id>:<anim>`. Cached per game.
 */
export async function ensureMonsterTextures(scene: Phaser.Scene, id: MonsterId, onProgress?: (done: number, total: number) => void): Promise<MonsterTextures> {
  const key = monsterKey(id);
  const have = textureInfo.get(id);
  if (have && scene.textures.exists(key)) return have;
  const { art, placeholder } = await loadMonsterArt(id);
  const frames: { name: string; color: PixelCanvas; normal: PixelCanvas; emissive?: PixelCanvas }[] = [];
  const warned = new Set<string>();
  const total = MONSTER_ANIMS.reduce((n, a) => n + art.anims[a].frames, 0);
  let t0 = performance.now();
  let bodyW = 24;
  for (const anim of MONSTER_ANIMS) {
    for (let f = 0; f < art.anims[anim].frames; f++) {
      const fr = art.render(anim, f);
      if (anim === 'idle' && f === 0) bodyW = fr.color.bounds()?.w ?? bodyW;
      checkFrame(art.id, anim, f, fr, warned);
      frames.push({ name: frameName(anim, f), color: fr.color, normal: fr.normal, emissive: (fr as HDFrame & { emissive?: PixelCanvas }).emissive });
      onProgress?.(frames.length, total);
      if (performance.now() - t0 > 12) {
        await tick();
        t0 = performance.now();
      }
    }
  }
  makeLitSheet(scene, key, art.w, art.h, frames);
  for (const anim of MONSTER_ANIMS) {
    const spec = art.anims[anim];
    const ak = animKey(id, anim);
    if (scene.anims.exists(ak)) scene.anims.remove(ak);
    scene.anims.create({
      key: ak,
      frames: Array.from({ length: spec.frames }, (_, f) => ({ key, frame: frameName(anim, f) })),
      frameRate: spec.fps,
      repeat: spec.loop ? -1 : 0,
    });
  }
  const info: MonsterTextures = {
    art,
    placeholder,
    key,
    normalKey: `${key}:n`,
    emissiveKey: scene.textures.exists(`${key}:e`) ? `${key}:e` : null,
    bodyW,
    frameName,
    animKey: (a) => animKey(id, a),
  };
  textureInfo.set(id, info);
  return info;
}
