// Cinematics loader. The DuelScene awaits loadCinematics() once before playing anything:
//   1. the built-in defaults (src/cinematics/_defaults, priority DEFAULT_PRIORITY = -100)
//   2. every other .ts file under src/cinematics/ (except _core/, _defaults/, api.ts and this
//      file), bundled eagerly and evaluated in path order — later files override earlier ones at
//      equal priority. A file that throws while loading now stops the page load (fix it).
// Authors: add `src/cinematics/<anything>.ts` and register handlers at module top level with the
// functions from './api'.

import { installDefaults } from './_defaults';

// Eager: every cinematic module is bundled with the game and evaluated in path order when this
// file loads. The old lazy glob awaited ~190 chunks one by one when the first duel started:
// measured 28.6 s (local build, no network latency) before the first duel could begin; now
// ~0.02 s. Handler order (the registry tie-break) is unchanged: path order, defaults by priority.
const modules = import.meta.glob(['./**/*.ts', '!./_core/**', '!./_defaults/**', '!./index.ts', '!./api.ts'], { eager: true });

let loading: Promise<string[]> | null = null;

/** Load defaults + every cinematic module. Resolves with the list of loaded module paths. */
export function loadCinematics(): Promise<string[]> {
  if (loading) return loading;
  installDefaults();
  loading = Promise.resolve(Object.keys(modules).sort());
  return loading;
}

export { Director } from './_core/Director';
export type { CinematicContext } from './_core/types';
