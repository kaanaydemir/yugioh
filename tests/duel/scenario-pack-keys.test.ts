// Scenario packs (src/duel/scenarios/*.ts) are merged with Object.assign in glob order, so two packs that
// share a key silently override each other (the later pack's scenario wins and the earlier card loses its
// QA entry). Every key must be owned by exactly one pack.
import { describe, expect, it } from 'vitest';

const packs = import.meta.glob<{ default?: Record<string, unknown> }>('../../src/duel/scenarios/*.ts', { eager: true });

describe('scenario packs', () => {
  it('no two packs define the same scenario key', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [file, mod] of Object.entries(packs)) {
      for (const key of Object.keys(mod.default ?? {})) {
        const prev = owner.get(key);
        if (prev) clashes.push(`${key}: ${prev} vs ${file}`);
        else owner.set(key, file);
      }
    }
    expect(clashes).toEqual([]);
  });
});
