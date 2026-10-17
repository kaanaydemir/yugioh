import Phaser from 'phaser';
import { GAME_H, GAME_W } from './view/layout';
import { BootScene } from './scenes/BootScene';
import { DevScene } from './scenes/DevScene';
import { sceneList } from './scenes/registry';
import { onDuelStart } from './duel/seeds';
import { mulberry32 } from './art/pixel';

const params = new URLSearchParams(location.search);
const dev = params.get('dev');

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#05060f',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  // Lets the screenshot tools read back frames rendered by manual stepping.
  preserveDrawingBuffer: params.has('test'),
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: fitZoom(),
  },
  input: { activePointers: 2 },
  scene: [BootScene, DevScene, ...sceneList()],
  callbacks: {
    preBoot: (g) => {
      g.registry.set('dev', dev);
      g.registry.set('params', params);
    },
  },
});

/** Largest whole-number zoom that fits the window (keeps every pixel square); fractional below 1×. */
function fitZoom(): number {
  const z = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
  return z >= 1 ? Math.floor(z) : z;
}
window.addEventListener('resize', () => game.scale.setZoom(fitZoom()));

// ---------------------------------------------------------------- test hooks
// Used by tools/shot.mjs and tools/film.mjs to capture deterministic frames.

declare global {
  interface Window {
    __neon: {
      game: Phaser.Game;
      ready: boolean;
      errors: string[];
      /** Stop the RAF loop; time only advances through step(). */
      freeze(): void;
      /** Advance the frozen game by `ms` in 1/60 s steps. */
      step(ms: number): void;
      unfreeze(): void;
      [k: string]: unknown;
    };
  }
}

// The frozen game runs on a virtual clock of its own (v3 plan A1.12): fixed start values and ONE
// constant per-frame delta for the loop, every scene's TweenManager and Date.now. Before, freeze()
// based the clock on the wall clock (performance.now / Date.now), so the float rounding of each
// stepped delta — and with it whether a timer, tween or anim frame of exactly N frames lands on
// frame N or N+1 — changed from run to run, and Phaser's delta smoothing still averaged real-time
// deltas for the first frames. The delta is tools/measure.mjs's default (one float step below
// 1000/60, so exact N-frame durations land on frame N+1, as in the measured timelines).
// Math.random (Phaser's particle emitters draw from it) is a seeded stream while frozen.
// At every duel start while frozen (src/duel/seeds.ts) the clock and that stream restart from their
// base, so a film of a restarted duel (__neon.duel.restart / .scenario) is a function of the code alone.
const STEP_DT = 16.666666666666664;
const CLOCK0 = 65536;
const NOW0 = 2 ** 30;
const realDateNow = Date.now.bind(Date);
const realRandom = Math.random;
const RANDOM_SEED = 0x6e30;
let random = mulberry32(RANDOM_SEED);
let frozen = false;
let frames = 0;
let clock = CLOCK0;
let virtualNow = NOW0;
const tweenDelta = (): number => STEP_DT;

/** While frozen every scene's TweenManager advances by the stepped delta (not by Date.now differences). */
function patchTweens(on: boolean): void {
  for (const s of game.scene.scenes) {
    const tm = (s.sys as unknown as { tweens?: { getDelta?: unknown } }).tweens;
    if (!tm) continue;
    if (on) {
      if (tm.getDelta !== tweenDelta) tm.getDelta = tweenDelta;
    } else if (Object.prototype.hasOwnProperty.call(tm, 'getDelta')) delete tm.getDelta;
  }
}

/** Restart the frozen clock from its fixed base (freeze, and every duel start while frozen). */
function rebaseClock(): void {
  frames = 0;
  clock = CLOCK0;
  virtualNow = NOW0;
  random = mulberry32(RANDOM_SEED);
  const loop = game.loop;
  loop.time = CLOCK0;
  loop.lastTime = CLOCK0;
}

function freezeClock(): void {
  if (frozen) return;
  frozen = true;
  game.loop.sleep();
  clock = CLOCK0;
  frames = 0;
  virtualNow = NOW0;
  game.loop.lastTime = CLOCK0;
  // Phaser's TweenManager measures time with Date.now(): virtualize it too
  Date.now = () => virtualNow;
  Math.random = () => random();
  patchTweens(true);
}

onDuelStart(() => {
  if (frozen) rebaseClock();
});

window.__neon = {
  game,
  ready: false,
  errors: [],
  freeze() {
    freezeClock();
  },
  step(ms: number) {
    freezeClock();
    // (TimeStep fields written as TimeStep.step writes them)
    const loop = game.loop as unknown as { now: number; rawDelta: number; time: number; delta: number; framesThisSecond: number; frame: number; lastTime: number; callback: (time: number, delta: number) => void };
    const n = Math.max(1, Math.round(ms / STEP_DT));
    for (let i = 0; i < n; i++) {
      frames++;
      clock = CLOCK0 + frames * STEP_DT;
      virtualNow = NOW0 + frames * STEP_DT;
      patchTweens(true);
      // TimeStep.step(clock) with its delta fixed to STEP_DT (no smoothing, no wall clock)
      loop.now = clock;
      loop.rawDelta = STEP_DT;
      loop.time += STEP_DT;
      loop.delta = STEP_DT;
      loop.framesThisSecond++;
      loop.callback(clock, STEP_DT);
      loop.lastTime = clock;
      loop.frame++;
    }
  },
  unfreeze() {
    if (!frozen) return;
    frozen = false;
    Date.now = realDateNow;
    Math.random = realRandom;
    patchTweens(false);
    game.loop.wake();
  },
};
window.addEventListener('error', (e) => window.__neon.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__neon.errors.push(String(e.reason)));
