// A3 core review F6 — a strike override can fall back to the strike below it (docs/v3/A3_MIMARI.md §6.3.3):
// the battle handlers take `strikeFor(id, genericStrike)`, a chain in which every strike's `s.base()`
// runs the next one by priority, the last registered one's runs the generic strike, and the generic
// strike's does nothing. The winning strike gets the handler's own arguments object (v1 strikes see
// exactly what they saw before); `strikeFor(id)` without a fallback is unchanged.

import { describe, expect, it } from 'vitest';
import { registerStrike, strikeFor, type StrikeFn } from '../../src/cinematics/_core/registry';
import type { StrikeArgs } from '../../src/cinematics/_core/types';

const args = (): StrikeArgs => {
  const impact = (): void => undefined;
  return { impact, impacted: Promise.resolve() } as unknown as StrikeArgs;
};

describe('strike chain: s.base() runs the strike below (A3 §6.3.3)', () => {
  it('no strike registered: the fallback runs, with a base() that does nothing', async () => {
    const seen: string[] = [];
    const generic: StrikeFn = async (s) => {
      seen.push('generic');
      await s.base?.();
    };
    expect(strikeFor('volt_lizard')).toBeNull();
    await strikeFor('volt_lizard', generic)(args());
    expect(seen).toEqual(['generic']);
  });

  it('override 11 → recipe 10 → card file 0 → generic, each by base(); the winner gets the very arguments', async () => {
    const seen: string[] = [];
    const a = args();
    const offs = [
      registerStrike('stone_sentinel', async (s) => {
        seen.push('file0');
        await s.base?.();
      }),
      registerStrike(
        'stone_sentinel',
        async (s) => {
          seen.push('recipe10');
          expect(s).not.toBe(a); // a level below runs on a copy...
          expect(s.impact).toBe(a.impact); // ...with the same contact
          await s.base?.();
          seen.push('recipe10 after');
        },
        { priority: 10 },
      ),
      registerStrike(
        'stone_sentinel',
        async (s) => {
          expect(s).toBe(a);
          seen.push('override11');
          await s.base?.(); // falls back for the part it does not draw itself
          seen.push('override11 after');
        },
        { priority: 11 },
      ),
    ];
    const generic: StrikeFn = async (s) => {
      seen.push('generic');
      await s.base?.();
    };
    await strikeFor('stone_sentinel', generic)(a);
    expect(seen).toEqual(['override11', 'recipe10', 'file0', 'generic', 'recipe10 after', 'override11 after']);
    // without a fallback: the winning strike itself, as before
    expect(strikeFor('stone_sentinel')).not.toBeNull();
    offs.forEach((off) => off());
    expect(strikeFor('stone_sentinel')).toBeNull();
  });

  it('a strike that never calls base() runs alone (the v1 strikes)', async () => {
    const seen: string[] = [];
    const off = registerStrike('ember_wolf', async () => void seen.push('own'));
    await strikeFor('ember_wolf', async () => void seen.push('generic'))(args());
    expect(seen).toEqual(['own']);
    off();
  });
});
