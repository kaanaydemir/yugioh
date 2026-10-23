// A4.1 scaling pre-step — src/art/atlas.ts: the cropped monster atlas is lossless (every frame of the
// v3 arts comes back byte-identical from its trimmed, packed copy, and nothing opaque is cut away),
// the packer never overlaps or overflows, frameRGBA rebuilds a trimmed frame around its stored rect
// (and reads an untrimmed one exactly as the readers did before), and the sheet plans name the
// monsters a staged scenario (its stage and its decks) / a real game paints ahead (P2 'relight'
// sheets only for monsters player 2 can control).

import { describe, expect, it } from 'vitest';
import {
  blitRect,
  canvasExact,
  deckPlan,
  frameRGBA,
  opaqueBox,
  packRects,
  stagePlan,
  trimRect,
  untrimFrame,
  MAX_ATLAS_W,
  PACK_GUTTER,
  TRIM_MARGIN,
  type FrameLike,
  type Rect,
} from '../../src/art/atlas';
import wyrm from '../../src/art/monsters-v3/crystal_wyrm';
import magus from '../../src/art/monsters-v3/abyss_magus';
import sentinel from '../../src/art/monsters-v3/stone_sentinel';
import { animList, animSpec } from '../../src/art/animtime';
import { drawFrame } from '../../src/art/rigkit';
import { DEFAULT_DECK, MONSTER_IDS, type CardId } from '../../src/data/cards';
import { SCENARIOS } from '../../src/duel/scenarios';
import { buildStage } from '../../src/duel/scenario';
import type { MonsterArt } from '../../src/art/types';

/** Index of the first byte where two pixel buffers differ (-1: identical, same length). */
function firstDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return Math.min(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/** Every frame of one animation group of an art (P1 or P2 light). */
function groupFrames(art: MonsterArt, anims: readonly string[], light: 'left' | 'right'): Uint8ClampedArray[] {
  const out: Uint8ClampedArray[] = [];
  for (const a of anims) {
    const spec = animSpec(art, a as never)!;
    for (let f = 0; f < spec.frames; f++) out.push(drawFrame(art, a as never, f, light).data);
  }
  return out;
}

/** Pack frames like textures.ts commitPack does (trim → pack → copy) and return the atlas. */
function packGroup(frames: Uint8ClampedArray[], w: number, h: number) {
  const rects = frames.map((d) => trimRect(d, w, h));
  const pk = packRects(rects);
  const atlas = new Uint8ClampedArray(pk.w * pk.h * 4);
  frames.forEach((d, i) => blitRect(atlas, pk.w, d, w, rects[i], pk.pos[i].x, pk.pos[i].y));
  return { rects, pk, atlas };
}

describe('trim + pack', () => {
  it('trimRect: the opaque box plus the margin, clamped; 1 × 1 at the origin when empty', () => {
    const w = 10;
    const h = 8;
    const d = new Uint8ClampedArray(w * h * 4);
    expect(trimRect(d, w, h)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(opaqueBox(d, w, h)).toBeNull();
    const set = (x: number, y: number) => (d[(y * w + x) * 4 + 3] = 255);
    set(4, 3);
    set(6, 5);
    expect(opaqueBox(d, w, h)).toEqual({ x: 4, y: 3, w: 3, h: 3 });
    expect(trimRect(d, w, h)).toEqual({ x: 4 - TRIM_MARGIN, y: 3 - TRIM_MARGIN, w: 3 + 2 * TRIM_MARGIN, h: 3 + 2 * TRIM_MARGIN });
    set(0, 0);
    set(9, 7);
    expect(trimRect(d, w, h)).toEqual({ x: 0, y: 0, w: 10, h: 8 });
  });

  it('packRects: every rect placed inside the atlas, no overlaps (gutter kept), texel (0, 0) free, deterministic, ≤ maxW', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const sizes = Array.from({ length: 140 }, () => ({ w: 1 + Math.floor(rnd() * 115), h: 1 + Math.floor(rnd() * 103) }));
    const pk = packRects(sizes);
    expect(pk).toEqual(packRects(sizes));
    expect(pk.w).toBeLessThanOrEqual(MAX_ATLAS_W);
    const boxes: Rect[] = sizes.map((s, i) => ({ x: pk.pos[i].x, y: pk.pos[i].y, w: s.w, h: s.h }));
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(pk.w);
      expect(b.y + b.h).toBeLessThanOrEqual(pk.h);
      // a setCrop that misses a trimmed frame's stored box samples texel (0, 0): never covered
      expect(b.x === 0 && b.y === 0).toBe(false);
    }
    for (const gutter of [0, 1, 3]) {
      const g = packRects(sizes.slice(0, 30), { gutter });
      sizes.slice(0, 30).forEach((_, i) => expect(g.pos[i].x === 0 && g.pos[i].y === 0, `gutter ${gutter} rect ${i}`).toBe(false));
      expect(g.w).toBeLessThanOrEqual(MAX_ATLAS_W);
    }
    expect(packRects([{ w: 1, h: 1 }])).toEqual({ w: 2, h: 1, pos: [{ x: 1, y: 0 }] });
    // a single column of tall frames would be the smallest area but taller than a texture may be
    const tall = packRects(Array.from({ length: 20 }, () => ({ w: 1, h: 200 })), { maxW: 256 });
    expect(tall.h).toBeLessThanOrEqual(256);
    expect(tall.w).toBeLessThanOrEqual(256);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const apart = a.x + a.w + PACK_GUTTER <= b.x || b.x + b.w + PACK_GUTTER <= a.x || a.y + a.h + PACK_GUTTER <= b.y || b.y + b.h + PACK_GUTTER <= a.y;
        expect(apart, `rects ${i} and ${j} overlap`).toBe(true);
      }
    // the area stays close to the rects' own (shelf packing of mixed sizes: well under 2×)
    const area = sizes.reduce((s, r) => s + r.w * r.h, 0);
    expect(pk.w * pk.h).toBeLessThan(area * 1.6);
    expect(() => packRects([{ w: MAX_ATLAS_W, h: 4 }])).toThrow();
    expect(packRects([{ w: MAX_ATLAS_W - 1, h: 4 }]).w).toBe(MAX_ATLAS_W);
    expect(packRects([])).toEqual({ w: 1, h: 1, pos: [] });
  });

  it('canvasExact: binary alpha with clean transparent pixels only', () => {
    expect(canvasExact(new Uint8ClampedArray([0, 0, 0, 0, 10, 20, 30, 255]))).toBe(true);
    expect(canvasExact(new Uint8ClampedArray([10, 20, 30, 128]))).toBe(false);
    expect(canvasExact(new Uint8ClampedArray([1, 0, 0, 0]))).toBe(false);
  });
});

describe('the v3 arts round-trip through the cropped atlas byte for byte', () => {
  // the commit units of textures.ts: the five base anims together, then each extra anim
  for (const art of [wyrm, magus, sentinel]) {
    for (const light of ['left', 'right'] as const) {
      it(`${art.id} (${light === 'left' ? 'P1' : 'P2 relight'}): every frame, every group`, () => {
        const anims = animList(art);
        const groups: string[][] = [anims.filter((a) => ['idle', 'roar', 'attack', 'hit', 'guard'].includes(a)), ...anims.filter((a) => !['idle', 'roar', 'attack', 'hit', 'guard'].includes(a)).map((a) => [a])];
        let full = 0;
        let stored = 0;
        for (const g of groups) {
          const frames = groupFrames(art, g, light);
          const { rects, pk, atlas } = packGroup(frames, art.w, art.h);
          frames.forEach((d, i) => {
            // nothing opaque outside the stored rect (so the trimmed frame draws the same pixels)
            const r = rects[i];
            for (let y = 0; y < art.h; y++)
              for (let x = 0; x < art.w; x++) {
                if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) continue;
                if (d[(y * art.w + x) * 4 + 3] !== 0) throw new Error(`${art.id} ${g} f${i}: opaque pixel ${x},${y} outside ${JSON.stringify(r)}`);
              }
            const back = untrimFrame(atlas, pk.w, pk.pos[i].x, pk.pos[i].y, r, art.w, art.h);
            expect(firstDiff(back, d), `${art.id} ${g} frame ${i}`).toBe(-1);
            // the v3 arts are binary-alpha: their frames may be read back from the atlas canvas
            expect(canvasExact(d)).toBe(true);
          });
          full += frames.length * art.w * art.h;
          stored += pk.w * pk.h;
        }
        // the crop pays: at least a third of the full cells (A3_MIMARI §11.1: −38 … −68 %)
        expect(stored / full).toBeLessThan(0.67);
      }, 60000);
    }
  }
});

/** A fake Phaser frame over a fake 2D canvas holding `img` (W × H RGBA). */
function fakeFrame(img: Uint8ClampedArray, W: number, cut: Rect, trim: { x: number; y: number; w: number; h: number } | null): FrameLike {
  const ctx = {
    getImageData: (x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let yy = 0; yy < h; yy++) data.set(img.subarray(((y + yy) * W + x) * 4, ((y + yy) * W + x + w) * 4), yy * w * 4);
      return { data };
    },
    clearRect: () => undefined,
    drawImage: () => undefined,
  };
  return {
    cutX: cut.x,
    cutY: cut.y,
    cutWidth: cut.w,
    cutHeight: cut.h,
    x: trim ? trim.x : 0,
    y: trim ? trim.y : 0,
    realWidth: trim ? trim.w : cut.w,
    realHeight: trim ? trim.h : cut.h,
    source: { image: { width: W, height: img.length / 4 / W, getContext: () => ctx } },
  };
}

describe('frameRGBA', () => {
  const art = wyrm;
  const d = drawFrame(art, 'attack', 5, 'left').data;

  it('an untrimmed frame reads exactly its cut rect (what every reader read before)', () => {
    // the frame sits at (3, 2) of a wider source
    const W = art.w + 7;
    const H = art.h + 4;
    const img = new Uint8ClampedArray(W * H * 4).fill(9);
    blitRect(img, W, d, art.w, { x: 0, y: 0, w: art.w, h: art.h }, 3, 2);
    const out = frameRGBA(fakeFrame(img, W, { x: 3, y: 2, w: art.w, h: art.h }, null))!;
    expect(out.length).toBe(art.w * art.h * 4);
    expect(firstDiff(out, d)).toBe(-1);
  });

  it('a trimmed frame comes back full size, its stored rect at the trim offset, transparent around it', () => {
    const { rects, pk, atlas } = packGroup([d], art.w, art.h);
    const r = rects[0];
    const out = frameRGBA(fakeFrame(atlas, pk.w, { x: pk.pos[0].x, y: pk.pos[0].y, w: r.w, h: r.h }, { x: r.x, y: r.y, w: art.w, h: art.h }))!;
    expect(out.length).toBe(art.w * art.h * 4);
    expect(firstDiff(out, d)).toBe(-1);
  });

  it('no source / no size → null (the readers keep their defaults)', () => {
    expect(frameRGBA(null)).toBeNull();
    expect(frameRGBA({ cutX: 0, cutY: 0, cutWidth: 2, cutHeight: 2, x: 0, y: 0, realWidth: 2, realHeight: 2, source: null })).toBeNull();
    expect(frameRGBA({ cutX: 0, cutY: 0, cutWidth: 0, cutHeight: 0, x: 0, y: 0, realWidth: 0, realHeight: 0, source: { image: {} } })).toBeNull();
  });
});

describe('sheet plans', () => {
  it('a real game paints every monster of both decks; P2 relights all of them (Ruh Çağrısı revives from either graveyard)', () => {
    const p = deckPlan([DEFAULT_DECK, DEFAULT_DECK]);
    expect([...p.p1].sort()).toEqual([...MONSTER_IDS].sort());
    expect([...p.p2].sort()).toEqual([...MONSTER_IDS].sort());
  });

  it('without Ruh Çağrısı in its deck, player 2 controls only its own deck monsters', () => {
    const d0: CardId[] = ['crystal_wyrm', 'abyss_magus', 'judgment_bolt'];
    const d1: CardId[] = ['stone_sentinel', 'storm_hawk', 'mirror_barrier'];
    expect(deckPlan([d0, d1])).toEqual({ p1: ['crystal_wyrm', 'abyss_magus', 'stone_sentinel', 'storm_hawk'], p2: ['stone_sentinel', 'storm_hawk'] });
    expect(deckPlan([d0, [...d1, 'soul_recall']]).p2.sort()).toEqual(['abyss_magus', 'crystal_wyrm', 'stone_sentinel', 'storm_hawk']);
  });

  it('a staged scenario paints the monsters it stages and the ones in its decks (A3_MIMARI §11.2)', () => {
    const p = stagePlan({
      p0: { hand: ['crystal_wyrm', 'judgment_bolt'], monsters: [null, { id: 'stone_sentinel', faceUp: false }], graveyard: ['ember_wolf'], deck: ['tide_golem'] },
      p1: { monsters: ['abyss_magus'], deck: ['storm_hawk', 'mirror_barrier'] },
    });
    // monster zones first, then hands, graveyards, decks (P1's side before P2's in each)
    expect(p.p1).toEqual(['stone_sentinel', 'abyss_magus', 'crystal_wyrm', 'ember_wolf', 'tide_golem', 'storm_hawk']);
    expect(p.p2).toEqual(['abyss_magus', 'storm_hawk']);
    // player 2 holding Ruh Çağrısı (set, in hand or in its deck) may revive any of them
    const r = stagePlan({ p0: { graveyard: ['crystal_wyrm'], deck: [] }, p1: { spellTraps: [{ id: 'soul_recall', faceUp: false }], deck: [] } });
    expect(r).toEqual({ p1: ['crystal_wyrm'], p2: ['crystal_wyrm'] });
    expect(stagePlan({ p0: { graveyard: ['crystal_wyrm'], deck: [] }, p1: { deck: ['soul_recall'] } }).p2).toEqual(['crystal_wyrm']);
    expect(stagePlan({ p0: { graveyard: ['crystal_wyrm'], deck: [] }, p1: { graveyard: ['soul_recall'], deck: [] } }).p2).toEqual([]);
    // the scenario defaults count: each deck holds 5 Taş Muhafız
    expect(stagePlan(undefined)).toEqual({ p1: ['stone_sentinel'], p2: ['stone_sentinel'] });
    expect(stagePlan({ p0: { deck: [] }, p1: { deck: [] } })).toEqual({ p1: [], p2: [] });
  });

  it('every scenario: each monster card of its built stage is in the plan; each of player 2 in its P2 list', () => {
    for (const [key, sc] of Object.entries(SCENARIOS)) {
      const plan = stagePlan(sc.stage);
      const s = buildStage(sc.stage);
      for (const c of Object.values(s.cards)) {
        if (!MONSTER_IDS.includes(c.cardId as never)) continue;
        expect(plan.p1, key).toContain(c.cardId);
        if (c.owner === 1) expect(plan.p2, key).toContain(c.cardId);
      }
    }
  });
});
