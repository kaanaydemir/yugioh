import Phaser from 'phaser';
import { GAME_H, GAME_W } from './view/layout';
import { BootScene } from './scenes/BootScene';
import { DevScene } from './scenes/DevScene';
import { sceneList } from './scenes/registry';

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

let clock = 0;
window.__neon = {
  game,
  ready: false,
  errors: [],
  freeze() {
    game.loop.sleep();
    clock = game.loop.lastTime || performance.now();
  },
  step(ms: number) {
    const dt = 1000 / 60;
    const n = Math.max(1, Math.round(ms / dt));
    for (let i = 0; i < n; i++) {
      clock += dt;
      game.loop.step(clock);
    }
  },
  unfreeze() {
    game.loop.wake();
  },
};
window.addEventListener('error', (e) => window.__neon.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__neon.errors.push(String(e.reason)));
