// A3 Y7 — body plan version pins (docs/v3/A3_MIMARI.md §3.6). A plan's behaviour never changes under
// its members: a change is a copy of the version directory (biped/v1/ → biped/v2/) and members move one
// by one. This test keeps the scheme honest:
//   - every version directory src/art/bodyplans/<plan>/v<N>/ is exported by the plan's index as `v<N>`,
//     stamped with version N and id <plan>, and every `v<N>` export has its directory;
//   - a version directory never imports a sibling version (a copy, not a shared file a fix could move);
//   - a monster pins ONE version of a plan;
//   - every version directory has at least one user (a monster or draft that imports it) — a directory
//     nobody imports is a dead copy and is deleted. The one exception is a plan's NEWEST version while it
//     waits for its first member, listed below with the step that brings it.

import { describe, expect, it } from 'vitest';

/** Version directories waiting for their first member (only ever the newest version of a plan). */
const AWAITING_FIRST_MEMBER: Readonly<Record<string, string>> = {};

const DIR_KEYS = Object.keys(import.meta.glob('../../src/art/bodyplans/*/v*/index.ts'));
const INDEXES = import.meta.glob<Record<string, unknown>>('../../src/art/bodyplans/*/index.ts', { eager: true });
const PLAN_SOURCES = import.meta.glob<string>('../../src/art/bodyplans/*/v*/**/*.ts', { eager: true, query: '?raw', import: 'default' });
const USER_SOURCES = import.meta.glob<string>(['../../src/art/monsters-v3/**/*.ts', '../../src/art/drafts/**/*.ts'], { eager: true, query: '?raw', import: 'default' });

/** plan → its version numbers (from the directories). */
function versionDirs(): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const k of DIR_KEYS) {
    const m = /bodyplans\/([^/]+)\/v([1-9]\d*)\/index\.ts$/.exec(k);
    if (!m) throw new Error(`bad version directory key ${k}`);
    out.set(m[1], [...(out.get(m[1]) ?? []), Number(m[2])].sort((a, b) => a - b));
  }
  return out;
}

/** The plan versions a source imports: `{ vN … } from '…/bodyplans/<plan>'` or anything from '…/bodyplans/<plan>/vN…'. */
function pinsOf(src: string): { plan: string; version: number }[] {
  const out: { plan: string; version: number }[] = [];
  const named = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]*bodyplans\/([A-Za-z0-9_-]+)(?:\/index(?:\.ts)?)?['"]/g;
  for (let m = named.exec(src); m; m = named.exec(src))
    for (const part of m[1].split(',')) {
      const v = /^\s*(?:type\s+)?v([1-9]\d*)\b/.exec(part);
      if (v) out.push({ plan: m[2], version: Number(v[1]) });
    }
  const deep = /from\s*['"][^'"]*bodyplans\/([A-Za-z0-9_-]+)\/v([1-9]\d*)(?:[/'"])/g;
  for (let m = deep.exec(src); m; m = deep.exec(src)) out.push({ plan: m[1], version: Number(m[2]) });
  return out;
}

/** Imports of a version directory's file that reach another version directory of a plan. */
function siblingImports(file: string, src: string): string[] {
  const own = /bodyplans\/([^/]+)\/v(\d+)\//.exec(file);
  if (!own) throw new Error(`not a version directory file: ${file}`);
  const out: string[] = [];
  for (const m of src.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    const v = /(?:^|\/)v(\d+)(?:\/|$)/.exec(spec);
    if (spec.startsWith('../') && v && v[1] !== own[2]) out.push(spec);
  }
  return out;
}

describe('body plan version pins (§3.6)', () => {
  const dirs = versionDirs();

  it('finds the plans (A3: biped v1)', () => {
    expect(dirs.get('biped')).toEqual([1]);
  });

  it('every version directory is exported as v<N> with version N and the plan id; no export without a directory', () => {
    for (const [plan, versions] of dirs) {
      const index = INDEXES[`../../src/art/bodyplans/${plan}/index.ts`];
      expect(index, `${plan}/index.ts`).toBeDefined();
      for (const n of versions) {
        const p = index![`v${n}`] as { id?: string; version?: number } | undefined;
        expect(p, `${plan}: export v${n}`).toBeDefined();
        expect(p!.version, `${plan} v${n}.version`).toBe(n);
        expect(p!.id, `${plan} v${n}.id`).toBe(plan);
      }
      for (const name of Object.keys(index!)) {
        const v = /^v([1-9]\d*)$/.exec(name);
        if (v) expect(versions, `${plan}: export ${name} has no directory`).toContain(Number(v[1]));
      }
    }
  });

  it('a version directory never imports a sibling version', () => {
    for (const [file, src] of Object.entries(PLAN_SOURCES)) expect(siblingImports(file, src), file).toEqual([]);
    expect(siblingImports('../../src/art/bodyplans/biped/v2/skeleton.ts', `import { restOf } from '../v1/build';\nimport type { V } from '../../../rigkit/geom';`)).toEqual(['../v1/build']);
    expect(siblingImports('../../src/art/bodyplans/biped/v2/index.ts', `import { x } from './build';\nimport { y } from '../../biped/v1';`)).toEqual(['../../biped/v1']);
  });

  it('a monster pins one version of a plan', () => {
    for (const [file, src] of Object.entries(USER_SOURCES)) {
      const byPlan = new Map<string, Set<number>>();
      for (const p of pinsOf(src)) byPlan.set(p.plan, new Set([...(byPlan.get(p.plan) ?? []), p.version]));
      for (const [plan, vs] of byPlan) expect([...vs], `${file} pins ${plan} ${[...vs].map((v) => `v${v}`).join(' + ')}`).toHaveLength(1);
    }
  });

  it('every version directory has a user (or is its plan\'s newest version awaiting its first member)', () => {
    const users = new Map<string, string[]>();
    for (const [file, src] of Object.entries(USER_SOURCES))
      for (const p of pinsOf(src)) {
        const k = `${p.plan}/v${p.version}`;
        users.set(k, [...new Set([...(users.get(k) ?? []), file])]);
      }
    for (const [plan, versions] of dirs)
      for (const n of versions) {
        const k = `${plan}/v${n}`;
        if (users.get(k)?.length) continue;
        const newest = n === versions[versions.length - 1];
        expect(newest && k in AWAITING_FIRST_MEMBER, `${k} has no user: a dead copy (delete it) — or, if it is the newest version, list it in AWAITING_FIRST_MEMBER with the step that brings its member`).toBe(true);
      }
    // every awaiting entry names an existing directory
    for (const k of Object.keys(AWAITING_FIRST_MEMBER)) {
      const [plan, v] = k.split('/');
      expect(dirs.get(plan) ?? [], k).toContain(Number(v.slice(1)));
    }
    // a pinned version must exist
    for (const k of users.keys()) {
      const [plan, v] = k.split('/');
      expect(dirs.get(plan) ?? [], `${k} is imported (${users.get(k)!.join(', ')}) but has no directory`).toContain(Number(v.slice(1)));
    }
  });

  it('pinsOf reads named and deep imports', () => {
    expect(pinsOf(`import { v1 as biped } from '../bodyplans/biped';`)).toEqual([{ plan: 'biped', version: 1 }]);
    expect(pinsOf(`import { type BipedMember, plus } from '../bodyplans/biped/v2';`)).toEqual([{ plan: 'biped', version: 2 }]);
    expect(pinsOf(`import { planArt } from '../bodyplans/types';`)).toEqual([]);
    expect(pinsOf(`import {\n  v3,\n} from '../../art/bodyplans/quadruped/index';`)).toEqual([{ plan: 'quadruped', version: 3 }]);
  });
});
