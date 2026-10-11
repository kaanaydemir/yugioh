// HD trial — the contract between the app shell and the cinematic sequence (src/hd/cine/*.ts).
//
// The 'scene' view (trial.html?view=scene) builds: arena theme → lights → both monsters idling on their tiles →
// then runs the sequence found in src/hd/cine/ (the first module whose default export is an HDSequence, or the
// one named by ?seq=<file>) and loops it. Until such a module exists the monsters just idle under the lights.
//
//   // src/hd/cine/sequence.ts
//   import type { HDSequence } from '../app/api';
//   const seq: HDSequence = {
//     name: 'Kristal Ejder vs Kor Kurdu',
//     async run(ctx) {
//       const { scene, kit, p1, p2, arena } = ctx;
//       await p1.playOnce('roar');
//       ...
//     },
//   };
//   export default seq;
//
// Time: use scene time only (tweens / scene.time / sprite anims — vfx/core `tween`, `wait`); the shell's Space key
// scales all three at once, and tools/shot.mjs --film freezes + steps them deterministically.
// Abort: ctx.signal aborts when the scene restarts (R key) — long awaits need not care, errors thrown after the
// abort are swallowed, but loops that poll should check `ctx.signal.aborted`.

import type Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import type { ArenaHandle, ArenaTheme } from '../contracts';
import type { HDKit } from './kit';
import type { HDMonsterSprite } from './units';

export interface HDSceneContext {
  scene: Phaser.Scene;
  kit: HDKit;
  theme: ArenaTheme;
  arena: ArenaHandle;
  /** Player 1 (cyan, lower-left, faces right): Kristal Ejder by default. */
  p1: HDMonsterSprite;
  /** Player 2 (crimson, upper-right, flipX): Kor Kurdu by default. */
  p2: HDMonsterSprite;
  ids: [MonsterId, MonsterId];
  envPixel: 1 | 2;
  signal: AbortSignal;
}

export interface HDSequence {
  name: string;
  run(ctx: HDSceneContext): Promise<void>;
  /** Pause before the shell restarts the sequence, ms of scene time (default 1500). */
  loopGapMs?: number;
}
