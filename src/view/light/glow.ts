// Emissive glow sheets: for every frame of a monster sprite, the pixels that "glow" (per
// MONSTER_GLOW) are blurred into a soft, half-resolution halo texture with the same frame names
// as the monster sheet. The light layer draws it BEHIND the sprite (ADD), so the sprite's own
// pixels stay untouched and only a soft glow peeks out around the orb / flames / crystals.
//
// Each frame also gets its emissive energy and centroid: the floor pool follows the glowing part
// and breathes with the animation (flames flare in the attack frames, the orb pulses in idle).
//
// Built lazily, the first time a monster's light appears (its sheet is painted by then), and
// cached for the rest of the game. ~10 ms per monster.

import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import { monsterArt } from '../../art/monsters';
import { monsterFrame, monsterFrameName } from '../../art/textures';
import { MONSTER_ANIMS } from '../../art/types';
import { monsterGlow } from './profiles';

export interface GlowFrame {
  /** Emissive weight (≈ number of fully glowing pixels). */
  energy: number;
  /** Weighted centroid of the emissive pixels in frame pixels (null when nothing glows). */
  cx: number;
  cy: number;
}

export interface GlowSheet {
  id: MonsterId;
  key: string;
  /** Monster frame size. */
  w: number;
  h: number;
  /** Padding (full-res px) on the left / top of each glow frame. */
  padL: number;
  padT: number;
  /** Glow frame size in full-res px (the texture holds it at half resolution). */
  fw: number;
  fh: number;
  frames: Map<string, GlowFrame>;
  /** Mean energy of the idle loop (normalises the pool breathing). */
  idleEnergy: number;
}

/** Half-resolution glow: display scale 2. */
export const GLOW_SCALE = 2;
const PAD = 10;
const sheets = new Map<MonsterId, GlowSheet>();

export function glowKey(id: MonsterId): string {
  return `light:glow:${id}`;
}

/** The glow sheet of a monster (built on first use; textures are global, so once per game). */
export function glowSheet(scene: { textures: Phaser.Textures.TextureManager }, id: MonsterId): GlowSheet {
  const have = sheets.get(id);
  if (have && scene.textures.exists(have.key)) return have;
  const s = buildGlowSheet(scene, id);
  sheets.set(id, s);
  return s;
}

function buildGlowSheet(scene: { textures: Phaser.Textures.TextureManager }, id: MonsterId): GlowSheet {
  const art = monsterArt(id);
  const cfg = monsterGlow(id);
  const weights = new Map<number, number>(cfg?.emissive ?? []);
  const nearW = new Map<number, number>(cfg?.near ?? []);
  const NEAR = 3;
  const w = art.w;
  const h = art.h;
  const hot = new Uint8Array(w * h);
  const padL = PAD;
  const padT = PAD;
  const fw = w + PAD * 2 + (w & 1);
  const fh = h + PAD * 2 + (h & 1);
  const gw = fw / GLOW_SCALE;
  const gh = fh / GLOW_SCALE;
  const names: { name: string; anim: (typeof MONSTER_ANIMS)[number]; f: number }[] = [];
  for (const anim of MONSTER_ANIMS) for (let f = 0; f < art.anims[anim].frames; f++) names.push({ name: monsterFrameName(anim, f), anim, f });
  const cols = Math.max(1, Math.min(names.length, Math.floor(4096 / gw)));
  const rows = Math.ceil(names.length / cols);
  const cv = document.createElement('canvas');
  cv.width = cols * gw;
  cv.height = rows * gh;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(cv.width, cv.height);
  const out = img.data;
  const frames = new Map<string, GlowFrame>();
  const r = new Float32Array(gw * gh);
  const g = new Float32Array(gw * gh);
  const b = new Float32Array(gw * gh);
  const tmp = new Float32Array(gw * gh);
  let idleSum = 0;
  let idleN = 0;
  names.forEach((n, i) => {
    r.fill(0);
    g.fill(0);
    b.fill(0);
    const pc = monsterFrame(id, n.anim, n.f);
    if (nearW.size) {
      // pixels within NEAR px of a fully emissive one (lets `near` colours glow there)
      hot.fill(0);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = pc.get(x, y);
          if (c === null || (weights.get(c) ?? 0) < 0.9) continue;
          for (let yy = Math.max(0, y - NEAR); yy <= Math.min(h - 1, y + NEAR); yy++)
            for (let xx = Math.max(0, x - NEAR); xx <= Math.min(w - 1, x + NEAR); xx++) hot[yy * w + xx] = 1;
        }
    }
    let energy = 0;
    let sx = 0;
    let sy = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = pc.get(x, y);
        if (c === null) continue;
        const wt = weights.get(c) ?? (hot[y * w + x] ? nearW.get(c) : undefined);
        if (!wt) continue;
        const a = pc.alpha(x, y) / 255;
        const k = wt * a;
        energy += k;
        sx += x * k;
        sy += y * k;
        const j = ((y + padT) >> 1) * gw + ((x + padL) >> 1);
        const q = k / 4;
        r[j] += ((c >> 16) & 255) / 255 * q;
        g[j] += ((c >> 8) & 255) / 255 * q;
        b[j] += (c & 255) / 255 * q;
      }
    frames.set(n.name, { energy, cx: energy > 0 ? sx / energy : art.core.x, cy: energy > 0 ? sy / energy : art.core.y });
    if (n.anim === 'idle') {
      idleSum += energy;
      idleN++;
    }
    for (const ch of [r, g, b]) {
      blur(ch, tmp, gw, gh, 2);
      blur(ch, tmp, gw, gh, 2);
    }
    const ox = (i % cols) * gw;
    const oy = Math.floor(i / cols) * gh;
    const GAIN = 3.2;
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const j = y * gw + x;
        const R = Math.min(1, r[j] * GAIN);
        const G = Math.min(1, g[j] * GAIN);
        const B = Math.min(1, b[j] * GAIN);
        const A = Math.max(R, G, B);
        if (A < 1 / 255) continue;
        const o = ((oy + y) * cv.width + ox + x) * 4;
        // straight alpha: the colour divided by its max (Phaser premultiplies on upload)
        out[o] = Math.round((R / A) * 255);
        out[o + 1] = Math.round((G / A) * 255);
        out[o + 2] = Math.round((B / A) * 255);
        out[o + 3] = Math.round(A * 255);
      }
  });
  ctx.putImageData(img, 0, 0);
  const key = glowKey(id);
  // a static texture (like art/textures addStaticCanvas: no CanvasTexture ImageData copy)
  const tm = scene.textures;
  if (tm.exists(key)) tm.remove(key);
  const tex = tm.addImage(key, cv as unknown as HTMLImageElement)!;
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  names.forEach((n, i) => tex.add(n.name, 0, (i % cols) * gw, Math.floor(i / cols) * gh, gw, gh));
  return { id, key, w, h, padL, padT, fw, fh, frames, idleEnergy: idleN ? idleSum / idleN : 1 };
}

/** Separable box blur of radius `rad` (in place, `tmp` is scratch of the same size). */
function blur(a: Float32Array, tmp: Float32Array, w: number, h: number, rad: number): void {
  const n = rad * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -rad; x <= rad; x++) acc += x >= 0 && x < w ? a[row + x] : 0;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      const add = x + rad + 1;
      const sub = x - rad;
      if (add < w) acc += a[row + add];
      if (sub >= 0) acc -= a[row + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -rad; y <= rad; y++) acc += y >= 0 && y < h ? tmp[y * w + x] : 0;
    for (let y = 0; y < h; y++) {
      a[y * w + x] = acc / n;
      const add = y + rad + 1;
      const sub = y - rad;
      if (add < h) acc += tmp[add * w + x];
      if (sub >= 0) acc -= tmp[sub * w + x];
    }
  }
}
