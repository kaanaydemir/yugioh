// Placeholder art for the expanded roster (docs/KART_TASLAGI_CANAVAR.md): a crystal totem in the colour of
// the monster's attribute. It is used ONLY while a monster has no art of its own: src/art/monsters/index.ts asks
// the v1 registry (and, under ?look=v3, the v3 registry) first, so real art replaces it automatically the moment a
// `src/art/monsters/<id>.ts` or `src/art/monsters-v3/<id>.ts` file exists.
//
// Same pixel language as the rest of the game: palette only (ATTRIBUTE_RAMP), 1-px PAL.ink outline, three clean
// tone bands (lit / front / shadow), integer positions, deterministic (the id is hashed for the small variations:
// width, height, shard count, cracks). Size class = frame size 48 / 64 / 80. The sheet gets idle bob frames, a roar
// pulse, a lunge, a hit flash (white silhouette frame) and a squashed guard; the death dissolve is the runtime's.
// The card picture is the same totem on an attribute-coloured backdrop (portrait()).

import type { MonsterId } from '../../data/cards';
import { cardDef } from '../../data/cards';
import { ATTRIBUTE_RAMP, PAL, type Ramp } from '../palette';
import { PixelCanvas } from '../pixel';
import { CARD_ART_H, CARD_ART_W, type AnimSpec, type MonsterAnim, type MonsterArt } from '../types';

/** Sprite size class (frame edge in px) per expanded-roster monster; anything else gets 64. */
const SIZE_CLASS: Partial<Record<MonsterId, 48 | 64 | 80>> = {
  dusk_sorcerer: 80,
  ashen_drake: 80,
  grim_warden: 80,
  venom_drake: 80,
  wisp_imp: 48,
  steel_silencer: 80,
  seal_head: 48,
  seal_arm_r: 48,
  seal_arm_l: 48,
  seal_leg_r: 48,
  seal_leg_l: 48,
  hourglass_imp: 48,
  windmane_knight: 80,
  shield_titan: 64,
  wing_lady: 48,
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Totem {
  /** Centre x of the body, ground y (base of the plinth). */
  cx: number;
  base: number;
  /** Body height / width in px. */
  h: number;
  w: number;
  ramp: Ramp;
  seed: number;
  /** 0..1 gem brightness. */
  pulse: number;
  /** 0 (shards hugging the body) .. 1 (spread). */
  spread: number;
  /** Shard orbit phase 0..1. */
  orbit: number;
  /** All tones swap to white (hit flash). */
  flash?: boolean;
  /** Draw the strike streaks to the right (attack impact). */
  streak?: boolean;
  /** Expanding ring radius (roar), 0 = none. */
  ring?: number;
}

function halfWidth(t: Totem, y: number): number {
  const top = t.base - t.h;
  const shoulder = t.base - Math.round(t.h * 0.55);
  const w2 = t.w / 2;
  if (y >= shoulder) return w2 - 1.5 * ((y - shoulder) / Math.max(1, t.base - shoulder)); // slight foot taper
  return w2 - (w2 - Math.max(2, t.w / 5)) * ((shoulder - y) / Math.max(1, shoulder - top));
}

/** The totem on `p` (no outline: the caller outlines the layer). */
function paintTotem(p: PixelCanvas, t: Totem): void {
  const { cx, base, h, ramp } = t;
  const top = base - h;
  const W = t.flash ? PAL.white : 0;
  const tone = (i: number) => (t.flash ? (i >= 3 ? PAL.white : ramp[4]) : ramp[i]);
  // plinth
  p.ellipse(cx, base - 1, Math.round(t.w / 2) + 3, 3, tone(1));
  p.ellipse(cx, base - 2, Math.round(t.w / 2) + 1, 2, tone(2));
  // body: three vertical faces, light from the top-left
  const l = cx - Math.round(t.w / 6);
  const r = cx + Math.round(t.w / 6);
  for (let y = top; y <= base - 1; y++) {
    const hw = halfWidth(t, y);
    const x0 = Math.round(cx - hw);
    const x1 = Math.round(cx + hw);
    for (let x = x0; x <= x1; x++) {
      let i = x < l ? 3 : x <= r ? 2 : 1;
      if (y < top + 3) i = Math.min(4, i + 1); // lit top facet
      else if (y > base - 4) i = Math.max(0, i - 1); // shadowed foot
      p.set(x, y, tone(i));
    }
  }
  // facet cracks (seeded): thin diagonals in the shadow tone / a highlight on the lit edge
  const cr = 1 + (t.seed % 3);
  for (let k = 0; k < cr; k++) {
    const y0 = top + 6 + ((t.seed >> (k * 3)) % Math.max(2, Math.round(h * 0.4)));
    const x0 = cx - Math.round(t.w / 3) + ((t.seed >> (k + 5)) % Math.max(2, Math.round(t.w / 1.6)));
    p.line(x0, y0, x0 + 2 + (k % 2), y0 + 3 + (k % 2), tone(0));
  }
  p.vline(Math.round(cx - halfWidth(t, base - Math.round(h * 0.5))) + 1, top + 5, base - 6, tone(4)); // lit edge
  // face: two slits, shifted to the right so the totem "looks" the way the monster faces
  const ey = top + Math.max(5, Math.round(h * 0.26));
  p.rect(cx - 1, ey, 3, 1, t.flash ? W : PAL.white);
  p.rect(cx + 4, ey, 2, 1, t.flash ? W : PAL.white);
  p.set(cx - 1, ey + 1, tone(0));
  p.set(cx + 4, ey + 1, tone(0));
  // core gem
  const gy = base - Math.round(h * 0.45);
  const gr = h >= 40 ? 4 : 3;
  const lit = t.pulse > 0.6;
  p.poly([[cx, gy - gr], [cx + gr, gy], [cx, gy + gr], [cx - gr, gy]], tone(0));
  p.poly([[cx, gy - gr + 1], [cx + gr - 1, gy], [cx, gy + gr - 1], [cx - gr + 1, gy]], lit ? PAL.white : tone(4));
  p.set(cx - 1, gy - 1, PAL.white);
  if (lit) p.rect(cx, gy, 1, 1, tone(3));
  // floating shards around the body (orbit) + a crown shard above
  const n = 2 + (t.seed % 3);
  const R = Math.round(t.w / 2) + 4 + Math.round(t.spread * 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n + t.orbit) * Math.PI * 2;
    const sx = cx + Math.round(Math.cos(a) * R);
    const sy = base - Math.round(h * 0.55) + Math.round(Math.sin(a) * (h * 0.22));
    const sz = 1 + ((t.seed >> k) & 1);
    p.poly([[sx, sy - sz - 1], [sx + sz, sy], [sx, sy + sz + 1], [sx - sz, sy]], tone(3));
    p.set(sx, sy - sz, tone(4));
  }
  const cy = top - 4 - Math.round(t.spread * 2);
  p.poly([[cx, cy - 3], [cx + 2, cy], [cx, cy + 3], [cx - 2, cy]], tone(3));
  p.set(cx - 1, cy - 1, tone(4));
  // roar ring
  if (t.ring && t.ring > 0) p.ellipseRing(cx, base - 2, t.ring + Math.round(t.w / 2), Math.max(2, Math.round(t.ring / 2.2)), tone(3));
  // strike streaks (right of the body)
  if (t.streak) {
    const x = cx + Math.round(t.w / 2) + 2;
    p.hline(x, x + 3, gy - 3, tone(4));
    p.hline(x + 1, x + 6, gy, PAL.white);
    p.hline(x, x + 3, gy + 3, tone(3));
  }
}

const IDLE: AnimSpec = { frames: 4, fps: 6, loop: true };

/** Frame parameters of every animation (translation, squash, pulse, spread, ...). */
function pose(anim: MonsterAnim, f: number): { dx: number; dy: number; squash: number; pulse: number; spread: number; orbit: number; flash?: boolean; streak?: boolean; ring?: number } {
  switch (anim) {
    case 'idle':
      return { dx: 0, dy: [0, 0, -1, -1][f] ?? 0, squash: 0, pulse: [0, 0.5, 1, 0.5][f] ?? 0, spread: [0, 0.5, 1, 0.5][f] ?? 0, orbit: f / 4 };
    case 'roar':
      return { dx: 0, dy: [0, -2, -3, -1][f] ?? 0, squash: 0, pulse: [0.5, 1, 1, 0.5][f] ?? 0, spread: [0.3, 1, 1, 0.6][f] ?? 0, orbit: f / 4, ring: [0, 0, 5, 9][f] ?? 0 };
    case 'attack':
      return {
        dx: [-3, -5, 5, 2][f] ?? 0,
        dy: [1, 1, -1, 0][f] ?? 0,
        squash: [0, 0.08, 0, 0][f] ?? 0,
        pulse: [0.5, 0.8, 1, 0.5][f] ?? 0,
        spread: [0, 0, 1, 0.5][f] ?? 0,
        orbit: f / 4,
        streak: f === 2,
      };
    case 'hit':
      return { dx: [-3, -1][f] ?? 0, dy: 0, squash: [0.06, 0][f] ?? 0, pulse: 0, spread: 0, orbit: 0.1, flash: f === 0 };
    case 'guard':
      return { dx: 0, dy: 0, squash: 0.14, pulse: [0, 0.4][f] ?? 0, spread: 0, orbit: f * 0.04 };
  }
}

const cache = new Map<MonsterId, MonsterArt>();

/** The placeholder crystal-totem art of `id` (cached: the same object every time). */
export function placeholderTotem(id: MonsterId): MonsterArt {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = cardDef(id);
  const attr = def.kind === 'monster' ? def.attribute : 'LIGHT';
  const ramp = ATTRIBUTE_RAMP[attr];
  const F = SIZE_CLASS[id] ?? 64;
  const seed = hash(id);
  const w = Math.round(F * 0.3) + (seed % 5) - 2;
  const h = Math.round(F * 0.56) + ((seed >> 4) % 7) - 3;
  const base = F - 7;
  const cx = F >> 1;
  const gemY = base - Math.round(h * 0.45);
  const art: MonsterArt = {
    id,
    w: F,
    h: F,
    anchorX: cx,
    anchorY: base,
    hover: 0,
    muzzle: { x: cx + Math.round(w / 2) + 8, y: gemY },
    core: { x: cx, y: gemY },
    anims: {
      idle: IDLE,
      roar: { frames: 4, fps: 8, loop: false },
      attack: { frames: 4, fps: 10, loop: false },
      hit: { frames: 2, fps: 8, loop: false },
      guard: { frames: 2, fps: 3, loop: true },
    },
    attackImpactFrame: 2,
    draw(p: PixelCanvas, anim: MonsterAnim, frame: number) {
      const q = pose(anim, frame);
      const hh = Math.max(12, Math.round(h * (1 - q.squash)));
      paintTotem(p, { cx: cx + q.dx, base: base + q.dy, h: hh, w, ramp, seed, pulse: q.pulse, spread: q.spread, orbit: q.orbit, flash: q.flash, streak: q.streak, ring: q.ring });
      p.outline(PAL.ink);
    },
    portrait(p: PixelCanvas) {
      paintPortrait(p, ramp, seed);
    },
  };
  cache.set(id, art);
  return art;
}

/** Card picture: the totem close-up on an attribute-coloured backdrop (banded sky, a floor, a few sparks). */
function paintPortrait(p: PixelCanvas, ramp: Ramp, seed: number): void {
  const W = CARD_ART_W;
  const H = CARD_ART_H;
  const horizon = 25;
  const bands = [ramp[0], ramp[0], ramp[1], ramp[1], ramp[2]];
  for (let y = 0; y < horizon; y++) p.hline(0, W - 1, y, bands[Math.min(bands.length - 1, Math.floor((y / horizon) * bands.length))]);
  for (let y = horizon; y < H; y++) p.hline(0, W - 1, y, (y - horizon) % 4 < 2 ? ramp[1] : ramp[0]);
  p.hline(0, W - 1, horizon, ramp[2]);
  // halo behind the totem
  p.disc(22, 15, 11, ramp[1]);
  p.disc(22, 15, 7, ramp[2]);
  // sparks
  for (let k = 0; k < 7; k++) {
    const x = (seed >> k) % W;
    const y = (hash(String(seed + k)) >> 3) % (horizon - 3);
    p.set(x, y, k % 2 ? ramp[3] : ramp[4]);
  }
  const layer = new PixelCanvas(W, H);
  paintTotem(layer, { cx: 22, base: 31, h: 22, w: 13 + (seed % 3), ramp, seed, pulse: 1, spread: 0.6, orbit: ((seed >> 7) % 8) / 8 });
  layer.outline(PAL.ink);
  p.blit(layer, 0, 0);
}
