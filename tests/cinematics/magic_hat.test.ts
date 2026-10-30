// Sihirli Şapka: the shuffle's pure planning (start zones, pass order) and the engine events the scene consumes.
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { passPlan, startZones } from '../../src/cinematics/traps/_hat_v3';

describe('magic_hat shuffle plan', () => {
  it('the real hat starts on the monster zone, decoys on the other hat zones', () => {
    const hats = [{ uid: 5, zone: 0 }, { uid: 9, zone: 1 }, { uid: 12, zone: 2 }];
    const s = startZones(1, 9, hats);
    expect(s.get(9)).toBe(1);
    expect([...s.values()].sort()).toEqual([0, 1, 2]);
  });
  it('when the monster zone is not a hat zone every hat still starts on a distinct zone', () => {
    const hats = [{ uid: 5, zone: 3 }, { uid: 9, zone: 4 }, { uid: 12, zone: 0 }];
    const s = startZones(1, 9, hats);
    expect(s.get(9)).toBe(1);
    expect(new Set(s.values()).size).toBe(3);
  });
  it('three passes: two permutations of the starts, then the finals', () => {
    for (const n of [2, 3]) {
      const starts = Array.from({ length: n }, (_, i) => i);
      const finals = starts.slice().reverse();
      const plan = passPlan(starts, finals, 1);
      expect(plan).toHaveLength(3);
      expect([...plan[0]].sort()).toEqual(starts);
      expect([...plan[1]].sort()).toEqual(starts);
      expect(plan[2]).toEqual(finals);
      expect(plan[0]).not.toEqual(starts);
    }
  });
});
