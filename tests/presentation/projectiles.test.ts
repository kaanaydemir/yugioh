// A3 core review F3 — the recipe 'throw' flies the thrower's OWN projectile when one is registered under
// its `attack.vfx` (src/cinematics/recipe/strike.ts registerProjectile; `recipe/projectiles/<vfx>.ts`),
// else the default faceted lump. Checked: the registry (register / look up / unregister, a newer
// registration wins), the sheet frames of a drawing (TURNS turns, each centred in one square frame,
// capped at 32 px; the contact radius is the farthest opaque pixel from the centre), and every
// projectile module in recipe/projectiles registers the name of its file.

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { materialOf } from '../../src/art/materials';
import { projectileFrames, projectileOf, registerProjectile, type ProjectileDraw } from '../../src/cinematics/recipe/strike';

const MODULES = import.meta.glob('/src/cinematics/recipe/projectiles/*.ts');

/** A 5 × 3 bar turned a quarter per two turns: lets the test see the turn index and the centring. */
const bar: ProjectileDraw = ({ turn }) => {
  const q = turn % 4 < 2 ? new PixelCanvas(5, 3) : new PixelCanvas(3, 5);
  q.rect(0, 0, q.w, q.h, turn === 0 ? PAL.white : PAL.ink);
  return q;
};

describe('recipe throw: the thrower’s own projectile (A3 core review F3)', () => {
  it('registerProjectile / projectileOf: by vfx name, a newer registration wins, unregister restores', () => {
    expect(projectileOf('test:bar')).toBeNull();
    expect(projectileOf(null)).toBeNull();
    const off = registerProjectile('test:bar', bar);
    expect(projectileOf('test:bar')).toBe(bar);
    const other: ProjectileDraw = () => new PixelCanvas(2, 2);
    const off2 = registerProjectile('test:bar', other);
    expect(projectileOf('test:bar')).toBe(other);
    off(); // an older registration's unregister leaves the newer one alone
    expect(projectileOf('test:bar')).toBe(other);
    off2();
    expect(projectileOf('test:bar')).toBeNull();
  });

  it('the sheet frames: 8 turns, each centred in one square frame; the radius is the farthest opaque pixel', () => {
    const turns: number[] = [];
    const { frames, size, r } = projectileFrames(
      (a) => {
        turns.push(a.turn);
        expect(a.turns).toBe(8);
        expect(a.mat?.id).toBe('stone');
        return bar(a);
      },
      materialOf('stone'),
    );
    expect(turns).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(frames).toHaveLength(8);
    expect(size).toBe(5);
    for (const f of frames) expect([f.w, f.h]).toEqual([5, 5]);
    // turn 0 (the held pose) is the white bar, centred: rows 1–3 of the 5 × 5 frame
    const f0 = frames[0];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) expect(f0.isOpaque(x, y)).toBe(y >= 1 && y <= 3);
    expect(f0.get(2, 2)).toBe(PAL.white);
    // the upright turns are centred too: columns 1–3
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) expect(frames[2].isOpaque(x, y)).toBe(x >= 1 && x <= 3);
    // the farthest opaque pixel centre from the frame centre (2.5, 2.5): (0.5, 1.5) → √5 ≈ 2.24
    expect(r).toBe(2);
  });

  it('a drawing larger than 32 px is cropped to a 32 px frame', () => {
    const { frames, size } = projectileFrames(() => {
      const q = new PixelCanvas(40, 10);
      q.rect(0, 0, 40, 10, PAL.ink);
      return q;
    }, null);
    expect(size).toBe(32);
    for (const f of frames) expect([f.w, f.h]).toEqual([32, 32]);
  });

  it('every projectile module registers the name of its file (recipe/projectiles/<vfx>.ts)', async () => {
    for (const [path, load] of Object.entries(MODULES)) {
      await load();
      const name = path.replace(/^.*\//, '').replace(/\.ts$/, '');
      expect(projectileOf(name), path).not.toBeNull();
    }
  });
});
