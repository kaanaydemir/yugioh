// Cinematics loader. The DuelScene awaits loadCinematics() once before playing anything:
//   1. the built-in defaults (src/cinematics/_defaults, priority DEFAULT_PRIORITY = -100)
//   2. every other .ts file under src/cinematics/ (except _core/, _defaults/, api.ts and this
//      file), imported one by one in path order — later files override earlier ones at equal
//      priority. A file that throws while loading is skipped and logged; the game goes on.
// Authors: add `src/cinematics/<anything>.ts` and register handlers at module top level with the
// functions from './api'.

import { installDefaults } from './_defaults';

const modules = import.meta.glob(['./**/*.ts', '!./_core/**', '!./_defaults/**', '!./index.ts', '!./api.ts']);

let loading: Promise<string[]> | null = null;

/** Load defaults + every cinematic module. Resolves with the list of loaded module paths. */
export function loadCinematics(): Promise<string[]> {
  if (loading) return loading;
  installDefaults();
  loading = (async () => {
    const loaded: string[] = [];
    for (const path of Object.keys(modules).sort()) {
      try {
        await modules[path]();
        loaded.push(path);
      } catch (e) {
        console.error(`[cinematics] failed to load ${path}`, e);
      }
    }
    return loaded;
  })();
  return loading;
}

export { Director } from './_core/Director';
export type { CinematicContext } from './_core/types';
