// A3 Y5 — the presentation layer's boundary (docs/v3/A3_MIMARI.md §6.1, §12): presentation is pure data,
// rules stay in the engine.
//   1. No file of src/engine/** imports src/presentation/** (any form).
//   2. No file of src/presentation/** imports Phaser or src/engine/** (any form, types included).
//   3. At run time the registry and every recipe load with Phaser and every engine module made to throw
//      on import: nothing in the presentation closure needs them.
// (That the engine's outcomes never change: outcomes.test.ts.)

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  throw new Error('src/presentation must not load Phaser');
});
vi.mock('../../src/engine/bot', () => {
  throw new Error('src/presentation must not load the engine (bot)');
});
vi.mock('../../src/engine/describe', () => {
  throw new Error('src/presentation must not load the engine (describe)');
});
vi.mock('../../src/engine/index', () => {
  throw new Error('src/presentation must not load the engine (index)');
});
vi.mock('../../src/engine/legal', () => {
  throw new Error('src/presentation must not load the engine (legal)');
});
vi.mock('../../src/engine/query', () => {
  throw new Error('src/presentation must not load the engine (query)');
});
vi.mock('../../src/engine/rng', () => {
  throw new Error('src/presentation must not load the engine (rng)');
});
vi.mock('../../src/engine/rules', () => {
  throw new Error('src/presentation must not load the engine (rules)');
});
vi.mock('../../src/engine/types', () => {
  throw new Error('src/presentation must not load the engine (types)');
});

const ENGINE = import.meta.glob<string>('/src/engine/**/*.ts', { query: '?raw', import: 'default', eager: true });
const PRESENTATION = import.meta.glob<string>('/src/presentation/**/*.ts', { query: '?raw', import: 'default', eager: true });
const ENGINE_FILES = Object.keys(import.meta.glob('/src/engine/*.ts'));

/** Every module specifier a source imports or re-exports (static and dynamic, types included). */
function specifiers(src: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

describe('the presentation layer stays out of the rules (A3 §6.1)', () => {
  it('the engine module list this file mocks is complete', () => {
    expect(ENGINE_FILES.map((p) => p.replace('/src/engine/', '').replace(/\.ts$/, '')).sort()).toEqual(['bot', 'describe', 'index', 'legal', 'query', 'rng', 'rules', 'types']);
  });

  it('src/engine/** never imports src/presentation/**', () => {
    expect(Object.keys(ENGINE).length).toBeGreaterThan(5);
    const bad = Object.entries(ENGINE).flatMap(([p, src]) => specifiers(src).filter((s) => /presentation/.test(s)).map((s) => `${p}: ${s}`));
    expect(bad).toEqual([]);
  });

  it('src/presentation/** never imports Phaser or src/engine/**', () => {
    expect(Object.keys(PRESENTATION).length).toBeGreaterThanOrEqual(4);
    const bad = Object.entries(PRESENTATION).flatMap(([p, src]) => specifiers(src).filter((s) => s === 'phaser' || /(^|\/)engine(\/|$)/.test(s)).map((s) => `${p}: ${s}`));
    expect(bad).toEqual([]);
  });

  it('(control) in this file a Phaser-bound module and an engine module cannot load', async () => {
    await expect(import('../../src/art/textures')).rejects.toThrow();
    await expect(import('../../src/engine/rng')).rejects.toThrow();
  });

  it('the registry and every recipe load with Phaser and the engine unloadable', async () => {
    const reg = await import('../../src/presentation/registry');
    expect(reg.RECIPE_IDS).toEqual(expect.arrayContaining(['abyss_magus', 'crystal_wyrm']));
    for (const id of reg.RECIPE_IDS) expect(reg.presentationOf(id)?.id).toBe(id);
  });
});
