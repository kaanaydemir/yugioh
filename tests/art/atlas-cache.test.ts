// A4.1 scaling pre-step — the frame cache limit of src/art/textures.ts (A3_MIMARI §11.2 "Temel kare
// önbelleği sınırı"): the v3 arts' frames requested through monsterFrame() live in an LRU of
// FRAME_CACHE_BUDGET bytes — a long game cannot grow it past the budget — while the frames the boot
// warming and the card art read again and again stay pinned; an evicted frame comes back with the
// same bytes (drawn again: the arts are deterministic). The old (v1) arts' cache is unchanged.

import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // the v3 look (decided once at module init by src/view/layout.ts): set before any import runs
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { FRAME_CACHE_BUDGET, cropsArt, frameCacheStats, monsterFrame } from '../../src/art/textures';
import { monsterArt, monsterArtV1 } from '../../src/art/monsters';
import { animList, animSpec } from '../../src/art/animtime';
import { LOOK_V3 } from '../../src/view/layout';
import type { MonsterId } from '../../src/data/cards';

/** Index of the first byte where two pixel buffers differ (-1: identical, same length). */
function firstDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return Math.min(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

describe('frame cache limit (v3 arts)', () => {
  it('runs in the v3 look; only the v3 arts are cropped', () => {
    expect(LOOK_V3).toBe(true);
    expect(cropsArt(monsterArt('crystal_wyrm'))).toBe(true);
    expect(cropsArt(monsterArt('stone_sentinel'))).toBe(true);
    expect(cropsArt(monsterArtV1('crystal_wyrm'))).toBe(false);
    expect(cropsArt(monsterArt('ember_wolf'))).toBe(false);
  });

  it('every frame of both lights of the v3 monsters: the LRU stays within its budget, pins stay, bytes come back the same', () => {
    const ids: MonsterId[] = ['crystal_wyrm', 'abyss_magus', 'stone_sentinel'];
    // (the walk draws every frame twice: ~1 600 v3 frames)
    const first = new Map<string, Uint8ClampedArray>();
    let requested = 0;
    for (const id of ids) {
      const art = monsterArt(id);
      for (const light of [undefined, { lightFrom: 'right' as const }]) {
        for (const anim of animList(art)) {
          const n = animSpec(art, anim)!.frames;
          for (let f = 0; f < n; f++) {
            const pc = monsterFrame(id, anim, f, light);
            requested += pc.data.length;
            first.set(`${id}|${anim}|${f}|${light ? 'r' : ''}`, new Uint8ClampedArray(pc.data));
            const st = frameCacheStats();
            expect(st.lru.bytes).toBeLessThanOrEqual(st.lru.budget);
          }
        }
      }
    }
    // the walk requested far more than the budget: the cache did evict
    expect(requested).toBeGreaterThan(3 * FRAME_CACHE_BUDGET);
    const st = frameCacheStats();
    expect(st.counts.evictions).toBeGreaterThan(0);
    // pinned: idle 0, the shattered hit frame, the last death frame (P1 + relit) of each v3 monster
    expect(st.pinned.frames).toBe(ids.length * 4);
    const pinnedIdle = monsterFrame('crystal_wyrm', 'idle', 0);
    expect(monsterFrame('crystal_wyrm', 'idle', 0)).toBe(pinnedIdle);
    // evicted frames come back byte-identical (every 3rd frame: the walk is long)
    let i = 0;
    for (const [k, bytes] of first) {
      if (i++ % 3) continue;
      const [id, anim, f, r] = k.split('|');
      const pc = monsterFrame(id as MonsterId, anim as never, Number(f), r ? { lightFrom: 'right' } : undefined);
      expect(firstDiff(pc.data, bytes), k).toBe(-1);
    }
    expect(frameCacheStats().lru.bytes).toBeLessThanOrEqual(FRAME_CACHE_BUDGET);
  }, 120000);

  it('the old arts keep their unbounded per-frame cache, exactly as before (one object per frame)', () => {
    const a = monsterFrame('ember_wolf', 'attack', 2);
    expect(monsterFrame('ember_wolf', 'attack', 2)).toBe(a);
    const before = frameCacheStats().grid.frames;
    monsterFrame('ember_wolf', 'roar', 1);
    expect(frameCacheStats().grid.frames).toBe(before + 1);
  });
});
