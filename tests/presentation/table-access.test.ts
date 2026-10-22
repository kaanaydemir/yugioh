// A3 Y5a — every per-card table is read through the accessor in its own file (docs/v3/A3_MIMARI.md
// §6.4, §1.2): the LOOK_V3 bridge of a presentation recipe lives only inside those accessors, so a
// direct read anywhere else would bypass it (and, in the v1 look, a recipe must never be read).
//
// A grep over src/ (src/dev/** and src/artlab/** excluded, comments stripped):
//   1. the §6.4 read patterns (`STRIKE_LIGHT[`, `MONSTER_GLOW[`, … `RANGED.has(`) appear only in the
//      table's own file, and there only as often as its accessor(s) read it;
//   2. outside its own file a table's name appears only in a re-export (`export { … } from`) — no
//      import-and-index, no alias.

import { describe, expect, it } from 'vitest';

/** Every source file under src/ as text (src/dev/** and src/artlab/** excluded). */
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx,js,mjs}', '!/src/dev/**', '!/src/artlab/**'], { query: '?raw', import: 'default', eager: true });

interface Table {
  /** The table's identifier. */
  name: string;
  /** The read pattern of §6.4 (literal). */
  read: string;
  /** Its own file (repo-relative, '/'). */
  home: string;
  /** How many reads the accessor(s) in the own file make. */
  reads: number;
}

const TABLES: Table[] = [
  { name: 'STRIKE_LIGHT', read: 'STRIKE_LIGHT[', home: 'src/cinematics/battle/_kit.ts', reads: 1 },
  { name: 'MONSTER_GLOW', read: 'MONSTER_GLOW[', home: 'src/view/light/profiles.ts', reads: 1 },
  { name: 'ROAR_PEAK', read: 'ROAR_PEAK[', home: 'src/cinematics/summon-b/_kit.ts', reads: 1 },
  { name: 'FLIP_RAMP', read: 'FLIP_RAMP[', home: 'src/cinematics/summon-b/flip.ts', reads: 1 },
  { name: 'RANGED', read: 'RANGED.has(', home: 'src/cinematics/traps/chains_of_light.ts', reads: 1 },
  { name: 'DEATH_PRESETS', read: 'DEATH_PRESETS[', home: 'src/cinematics/_v3/presets.ts', reads: 1 },
  { name: 'MATTER_RAMP', read: 'MATTER_RAMP[', home: 'src/cinematics/_v3/presets.ts', reads: 1 },
  { name: 'STRIKE_KIND', read: 'STRIKE_KIND[', home: 'src/cinematics/_v3/blow.ts', reads: 1 },
  { name: 'CHARACTER_SOUNDS', read: 'CHARACTER_SOUNDS[', home: 'src/cinematics/_v3/sound.ts', reads: 1 },
];

/** Source without comments (strings kept; a `//` inside a string literal is left alone). */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += d ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const FILES = Object.entries(SOURCES).map(([path, text]) => ({ rel: path.replace(/^\//, ''), code: stripComments(text) }));

function count(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

describe('per-card tables are read only through their accessors (A3 §6.4)', () => {
  it('scans the source tree', () => {
    expect(FILES.length).toBeGreaterThan(100);
    for (const t of TABLES) expect(FILES.some((f) => f.rel === t.home), t.home).toBe(true);
  });

  for (const t of TABLES) {
    it(`${t.read} only in ${t.home} (its accessor)`, () => {
      const outside = FILES.filter((f) => f.rel !== t.home && f.code.includes(t.read)).map((f) => f.rel);
      expect(outside).toEqual([]);
      const home = FILES.find((f) => f.rel === t.home)!;
      expect(count(home.code, t.read)).toBe(t.reads);
    });

    it(`${t.name} is not imported and read elsewhere (re-exports only)`, () => {
      const word = new RegExp(`\\b${t.name}\\b`);
      const bad: string[] = [];
      for (const f of FILES) {
        if (f.rel === t.home || !word.test(f.code)) continue;
        // statements that name it: a re-export `export { … } from '…'` is fine, anything else is not
        const stmts = f.code.split(/;\s*\n|\n(?=\S)/);
        for (const s of stmts) if (word.test(s) && !/^\s*export\s+(type\s+)?\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;?\s*$/.test(s)) bad.push(`${f.rel}: ${s.trim().slice(0, 120)}`);
      }
      expect(bad).toEqual([]);
    });
  }
});
