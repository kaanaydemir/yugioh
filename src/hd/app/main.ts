// HD trial entry (trial.html): a separate Phaser game at 960×540 with dynamic lighting. Same window.__neon test
// hooks as src/main.ts (ready / errors / freeze / step / unfreeze, incl. the Date.now virtualization) so
// tools/shot.mjs works unchanged: node tools/shot.mjs "trial.html?view=scene" --film 12 --every 80
//   (shot.mjs viewports are 640×scale wide: --scale 1.5 = 960×540 = zoom 1, --scale 3 = 1920×1080 = zoom 2)

import Phaser from 'phaser';
import { HD_H, HD_W } from '../contracts';
import { HDBootScene } from './boot';
import { TrialScene } from './TrialScene';

const params = new URLSearchParams(location.search);

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: HD_W,
  height: HD_H,
  backgroundColor: '#05060f',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  // Lets the screenshot tools read back frames rendered by manual stepping.
  preserveDrawingBuffer: params.has('test'),
  render: { maxLights: 16 },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: fitZoom(),
  },
  input: { activePointers: 2 },
  scene: [HDBootScene, TrialScene],
  callbacks: {
    preBoot: (g) => {
      g.registry.set('params', params);
    },
  },
});

/** Largest whole-number zoom that fits the window (keeps every pixel square); fractional below 1×. */
function fitZoom(): number {
  const z = Math.min(window.innerWidth / HD_W, window.innerHeight / HD_H);
  return z >= 1 ? Math.floor(z) : z;
}
window.addEventListener('resize', () => game.scale.setZoom(fitZoom()));

// ---------------------------------------------------------------- test hooks (same contract as src/main.ts)

/** Let every pending promise continuation run (one macrotask turn, no 4 ms timer clamp). */
function drainPromises(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
  });
}

let clock = 0;
const realDateNow = Date.now.bind(Date);
let virtualNow = 0;
window.__neon = {
  game,
  ready: false,
  errors: [],
  freeze() {
    game.loop.sleep();
    clock = game.loop.lastTime || performance.now();
    // Phaser's TweenManager measures time with Date.now(), so virtualize it too.
    virtualNow = realDateNow();
    Date.now = () => virtualNow;
    // the sequence of the scene view starts at the first freeze() in ?test runs (films begin at t = 0)
    window.__neon.hdFrozen = true;
  },
  // Async on purpose (page.evaluate awaits it): between 1/60 s sub-steps the promise queue is drained, so cinematic
  // sequences written as `await tween(...)` / `await wait(...)` advance in lock-step with the stepped clock instead of
  // one await hop per step() call. (With the plain synchronous loop a 160 ms film step lets a sequence run one await.)
  async step(ms: number): Promise<void> {
    const dt = 1000 / 60;
    const n = Math.max(1, Math.round(ms / dt));
    for (let i = 0; i < n; i++) {
      clock += dt;
      virtualNow += dt;
      game.loop.step(clock);
      await drainPromises();
    }
  },
  unfreeze() {
    Date.now = realDateNow;
    game.loop.wake();
  },
};
window.addEventListener('error', (e) => window.__neon.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__neon.errors.push(String(e.reason)));
