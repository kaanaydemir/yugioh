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
      paintPortrait(p, id, ramp, seed);
    },
  };
  cache.set(id, art);
  return art;
}

// ---------------------------------------------------------------------------------------------
// Card picture. Every placeholder monster gets its OWN picture: the attribute-coloured backdrop (its pattern, floor
// line and sparks come from the name hash) with one big simple emblem chosen by id / race (hourglass, shield, wings,
// gear, flame, eye, fist, boot ...), tone-banded from the top-left and outlined in ink. Palette only, whole pixels.
// Painted at 44x34 (the hand art); `placeholderPortraitBig` is the 88x68 version (exact 2x of the same picture).
// ---------------------------------------------------------------------------------------------

export type Emblem = 'hourglass' | 'shield' | 'wings' | 'gear' | 'flame' | 'eye' | 'fistR' | 'fistL' | 'bootR' | 'bootL' | 'fang' | 'blade' | 'crystal';

/** Which emblem a monster gets: the id first (seals, special monsters), then the race. */
export function emblemFor(id: string, race: string): Emblem {
  switch (id) {
    case 'seal_head': return 'eye';
    case 'seal_arm_r': return 'fistR';
    case 'seal_arm_l': return 'fistL';
    case 'seal_leg_r': return 'bootR';
    case 'seal_leg_l': return 'bootL';
    case 'hourglass_imp': return 'hourglass';
    case 'shield_titan': return 'shield';
    case 'windmane_knight': return 'blade';
    case 'wing_lady': return 'wings';
    case 'wisp_imp': return 'flame';
    case 'venom_drake': return 'fang';
    case 'steel_silencer': return 'gear';
    case 'grim_warden': return 'crystal';
  }
  switch (race) {
    case 'Makine': return 'gear';
    case 'Kanatlı': return 'wings';
    case 'Savaşçı': return 'blade';
    case 'Şeytan': return 'flame';
    case 'Ejderha': return 'fang';
    case 'Büyücü': return 'hourglass';
  }
  return 'crystal';
}

/** Paint the emblem shape (flat body colour) on a transparent layer; returns accent painters run after shading. */
function emblemShape(l: PixelCanvas, e: Emblem, body: number): (p: PixelCanvas, ramp: Ramp) => void {
  const cx = 22;
  switch (e) {
    case 'hourglass':
      l.poly([[12, 5], [32, 5], [23, 16], [32, 28], [12, 28], [21, 16]], body);
      l.rect(10, 3, 24, 3, body);
      l.rect(10, 28, 24, 3, body);
      return (p, r) => {
        p.poly([[16, 8], [28, 8], [22, 15]], r[4]);
        p.poly([[22, 21], [17, 27], [27, 27]], r[4]);
        p.vline(22, 16, 20, r[4]);
        p.hline(10, 33, 3, PAL.white);
      };
    case 'shield':
      l.poly([[11, 4], [33, 4], [33, 17], [22, 30], [11, 17]], body);
      return (p, r) => {
        p.vline(22, 7, 25, r[4]);
        p.hline(15, 29, 12, r[4]);
        p.disc(22, 12, 2, PAL.white);
        p.hline(12, 32, 4, PAL.white);
      };
    case 'wings':
      for (const m of [1, -1]) {
        const X = (x: number) => cx + m * x;
        l.poly([[X(2), 24], [X(5), 18], [X(13), 15], [X(17), 8], [X(19), 4], [X(18), 13], [X(21), 19], [X(14), 24], [X(8), 28]], body);
      }
      l.disc(cx, 17, 3, body);
      return (p, r) => {
        for (const m of [1, -1]) {
          p.line(cx + m * 6, 21, cx + m * 17, 8, r[4]);
          p.line(cx + m * 5, 24, cx + m * 15, 15, r[4]);
        }
        p.disc(cx, 17, 1, PAL.white);
      };
    case 'gear': {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const tx = Math.round(cx + Math.cos(a) * 11);
        const ty = Math.round(16 + Math.sin(a) * 11);
        l.rect(tx - 2, ty - 2, 5, 5, body);
      }
      l.disc(cx, 16, 9, body);
      return (p, r) => {
        p.disc(cx, 16, 4, r[0]);
        p.disc(cx, 16, 2, r[2]);
        p.ring(cx, 16, 7, r[4]);
        p.set(cx - 2, 14, PAL.white);
      };
    }
    case 'flame':
      l.poly([[22, 2], [26, 9], [31, 15], [31, 22], [26, 28], [18, 28], [13, 22], [13, 15], [17, 10], [19, 6]], body);
      l.poly([[14, 15], [10, 8], [17, 12]], body); // small horns
      l.poly([[30, 15], [34, 8], [27, 12]], body);
      return (p, r) => {
        p.poly([[22, 12], [26, 18], [26, 24], [22, 27], [18, 24], [18, 18]], r[4]);
        p.rect(18, 17, 3, 2, r[0]);
        p.rect(24, 17, 3, 2, r[0]);
        p.set(19, 17, PAL.white);
        p.set(25, 17, PAL.white);
      };
    case 'eye':
      l.poly([[5, 16], [14, 9], [22, 7], [30, 9], [39, 16], [30, 23], [22, 25], [14, 23]], body);
      return (p, r) => {
        p.disc(22, 16, 6, r[4]);
        p.disc(22, 16, 3, r[0]);
        p.set(20, 14, PAL.white);
        p.line(22, 2, 22, 4, r[4]);
        p.line(14, 4, 15, 6, r[4]);
        p.line(30, 4, 29, 6, r[4]);
        p.line(22, 28, 22, 30, r[4]);
      };
    case 'fistR':
    case 'fistL': {
      const t = (x: number, w: number) => (e === 'fistR' ? x : 44 - x - w);
      l.rect(t(6, 16), 14, 16, 8, body); // forearm
      l.rect(t(20, 14), 9, 14, 17, body); // fist
      l.rect(t(4, 4), 12, 4, 12, body); // cuff
      return (p, r) => {
        for (const y of [13, 17, 21]) p.hline(t(28, 5), t(28, 5) + 4, y, r[2]);
        p.vline(t(12, 1), 15, 20, r[4]);
        p.rect(t(23, 3), 11, 3, 2, PAL.white);
      };
    }
    case 'bootR':
    case 'bootL': {
      const t = (x: number, w: number) => (e === 'bootR' ? x : 44 - x - w);
      l.rect(t(12, 10), 3, 10, 19, body); // shaft
      l.poly(e === 'bootR' ? [[12, 20], [24, 20], [35, 24], [35, 30], [12, 30]] : [[32, 20], [20, 20], [9, 24], [9, 30], [32, 30]], body);
      return (p, r) => {
        p.hline(t(12, 10), t(12, 10) + 9, 6, r[4]);
        p.hline(t(12, 10), t(12, 10) + 9, 8, r[2]);
        p.hline(t(12, 23), t(12, 23) + 22, 28, r[2]);
        p.disc(t(17, 1), 15, 1, PAL.white);
      };
    }
    case 'fang':
      l.poly([[22, 3], [30, 14], [31, 21], [22, 29], [13, 21], [14, 14]], body); // venom drop
      l.poly([[3, 4], [11, 4], [7, 14]], body); // fangs
      l.poly([[33, 4], [41, 4], [37, 14]], body);
      return (p, r) => {
        p.poly([[22, 12], [26, 20], [22, 26], [18, 20]], r[4]);
        p.set(19, 15, PAL.white);
      };
    case 'blade':
      l.poly([[34, 2], [35, 8], [17, 25], [12, 20]], body); // blade
      l.poly([[8, 17], [14, 14], [24, 28], [19, 31]], body); // guard
      l.poly([[8, 29], [12, 25], [15, 28], [11, 32]], body); // grip
      return (p, r) => {
        p.line(16, 21, 33, 5, r[4]);
        p.line(5, 9, 14, 9, r[4]); // wind strands (the mane)
        p.line(3, 14, 11, 14, r[3]);
        p.line(6, 19, 12, 19, r[4]);
        p.set(34, 3, PAL.white);
      };
    case 'crystal':
      l.poly([[22, 2], [32, 14], [22, 30], [12, 14]], body);
      return (p, r) => {
        p.vline(22, 5, 27, r[2]);
        p.hline(14, 30, 14, r[4]);
      };
  }
}

/** Tone-band a flat layer from the top-left: lit / body / shadow, then ink outline. */
function shadeLayer(l: PixelCanvas, ramp: Ramp): void {
  const b = l.bounds();
  if (!b) return;
  const mx = b.x + b.w / 2;
  const my = b.y + b.h / 2;
  l.map((c, x, y) => {
    if (c !== ramp[3]) return c;
    const d = (x - mx) * 0.6 + (y - my);
    return d < -b.h * 0.22 ? ramp[4] : d > b.h * 0.2 ? ramp[2] : ramp[3];
  });
}

/** Backdrop: attribute bands, a name-seeded pattern and floor line, a halo behind the emblem and a few sparks. */
function paintBackdrop(p: PixelCanvas, ramp: Ramp, seed: number): void {
  const W = CARD_ART_W;
  const H = CARD_ART_H;
  const horizon = 24 + (seed % 3);
  const bands = [ramp[0], ramp[0], ramp[1], ramp[1], ramp[2]];
  for (let y = 0; y < horizon; y++) p.hline(0, W - 1, y, bands[Math.min(bands.length - 1, Math.floor((y / horizon) * bands.length))]);
  for (let y = horizon; y < H; y++) p.hline(0, W - 1, y, (y - horizon) % 4 < 2 ? ramp[1] : ramp[0]);
  p.hline(0, W - 1, horizon, ramp[2]);
  const pat = (seed >> 3) % 4;
  const ph = (seed >> 6) % 6;
  for (let y = 0; y < horizon; y++) {
    for (let x = 0; x < W; x++) {
      let on = false;
      if (pat === 0) on = (x + y + ph) % 8 === 0; // diagonal hatch
      else if (pat === 1) on = (x + ph) % 6 === 0 && y % 2 === 0; // dotted columns
      else if (pat === 2) on = (y + ph) % 7 === 0 && x % 3 !== 0; // dashed rules
      else on = (x * 3 + y * 2 + ph) % 11 === 0; // scattered
      if (on) p.set(x, y, ramp[2]);
    }
  }
  p.disc(22, 16, 14, ramp[1]);
  p.disc(22, 16, 12, ramp[2]);
  p.ring(22, 16, 14, ramp[3]);
  for (let k = 0; k < 6; k++) {
    const x = (seed >> k) % W;
    const y = (hash(String(seed + k)) >> 3) % (horizon - 3);
    p.set(x, y, k % 2 ? ramp[3] : ramp[4]);
  }
}

/** The 44x34 card picture of a placeholder monster (distinct per id). */
export function placeholderPortrait(p: PixelCanvas, id: MonsterId): void {
  const def = cardDef(id);
  const attr = def.kind === 'monster' ? def.attribute : 'LIGHT';
  const race = def.kind === 'monster' ? def.race : '';
  paintPortrait(p, id, ATTRIBUTE_RAMP[attr], hash(id), race);
}

/** The 88x68 card picture: the same picture at exactly 2x (crisp, whole pixels). */
export function placeholderPortraitBig(id: MonsterId): PixelCanvas {
  const small = new PixelCanvas(CARD_ART_W, CARD_ART_H);
  placeholderPortrait(small, id);
  return small.scaled(2);
}

function paintPortrait(p: PixelCanvas, id: MonsterId, ramp: Ramp, seed: number, race?: string): void {
  if (race === undefined) {
    const d = cardDef(id);
    race = d.kind === 'monster' ? d.race : '';
  }
  paintBackdrop(p, ramp, seed);
  const layer = new PixelCanvas(CARD_ART_W, CARD_ART_H);
  const accents = emblemShape(layer, emblemFor(id, race), ramp[3]);
  shadeLayer(layer, ramp);
  accents(layer, ramp);
  layer.outline(PAL.ink);
  p.blit(layer, 0, 0);
}
