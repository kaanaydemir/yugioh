// A56.0 hooks (S-8), the graveyard landing count (A6 §2.3) and the S-4 trapPulse contract skeleton.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { landingCount } from '../../src/cinematics/_v3/card';

const G = globalThis as Record<string, unknown>;

afterEach(() => {
  delete G.__NEON_LOOK;
});

describe('graveyard landing count (A6 §2.3)', () => {
  it('one more than shown, capped by the engine state, never down', () => {
    expect(landingCount(0, 1)).toBe(1); // a plain destroy: 0 → 1
    expect(landingCount(3, 5)).toBe(4); // two cards in flight: the first lands on 4 …
    expect(landingCount(4, 5)).toBe(5); // … the second on 5
    expect(landingCount(1, 1)).toBe(1); // tribute set: the pile was synced to 1 while the card flew (no 1 → 2 → 1)
    expect(landingCount(6, 5)).toBe(6); // a later batch already shows more: never goes down
    expect(landingCount(2, undefined)).toBe(3); // no state: as before
    expect(landingCount(2, null)).toBe(3);
  });
});

describe('V3HOOKS (S-8)', () => {
  it('no hook is filled in v1; in v3 only the lanes fill them (all lanes switched off: none)', async () => {
    for (const [look, lanes] of [['v1', ''], ['v3', 'off'], ['v3', '']] as const) {
      vi.resetModules();
      G.__NEON_LOOK = look;
      if (lanes) G.__NEON_V3FLAGS = { a5: lanes, a6: lanes };
      else delete G.__NEON_V3FLAGS;
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { loadCinematics } = await import('../../src/cinematics');
      const loaded = await loadCinematics();
      errors.mockRestore();
      expect(loaded.some((p) => p.includes('v3small/_hooks'))).toBe(true);
      expect(loaded.some((p) => p.includes('flow/draw'))).toBe(true);
      const { filledV3Hooks } = await import('../../src/cinematics/v3small/_hooks');
      if (look === 'v1' || lanes === 'off') expect(filledV3Hooks(), `${look} lanes=${lanes || 'on'}`).toEqual([]);
      else expect(filledV3Hooks().length, 'v3 with the lanes on').toBeGreaterThan(0);
    }
    delete G.__NEON_V3FLAGS;
  }, 60000);
});

describe('S-4 trapPulse (skeleton: filled by lane A6-B with its decision hook)', () => {
  it.todo('every trapResponse window keeps a trapPulse handle (an empty { destroy } when nothing is marked)');
  it.todo('the CPU / scenario summon-window fast path (S-15) marks nothing, ≤ 120 ms, and still keeps trapPulse');
  it.todo('trapOpeningV3 and tb:responseDeclined take the handle and destroy (or settle) it');
});
