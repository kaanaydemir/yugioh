// ?dev=showclock — test bench of the single show clock (v3 plan A1 item 6, src/duel/showclock.ts).
// No new art: a Kristal Ejder idling under the hologram shader (scanlines, sweep band, glitch —
// all driven by the shader's uTime), a tween-driven marker and the clock's numbers. A fixed
// timeline in REAL ms (starts on the first freeze() in test mode, so films are repeatable;
// loops every 3 s otherwise):
//      300  hit-stop 300 ms + shake 300 ms / 3 px
//             v3 (&look=v3): the hologram, the marker and the shake (on its first offset) hold
//             v1: the marker holds; hologram and shake run on through the stop, as before
//      900  pause 400 ms (what the duel menu does in v3): v3: everything holds; v1: the marker
//             holds, hologram and shake run on (v1 / v2 never pause: the duel menu does not call it)
//     1500  speed 3× + shake 300 ms / 3 px: v3: it lasts 100 ms and the hologram runs 3× fast;
//             v1: both stay on real time, as before
//     2300  back to 1×
//   node tools/shot.mjs "?dev=showclock&look=v3" --film 16 --every 50 --start 250
//   &hold=MS changes the hit-stop / pause length (default 300 / 400); &shake=0 leaves the shakes out
//   (to look at the hologram alone).

import type Phaser from 'phaser';
import type { DevPreview } from '../types';
import { PAL } from '../../art/palette';
import { monsterArt } from '../../art/monsters';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import { DEPTH, GAME_H, GAME_W, LOOK, unitDepth } from '../../view/layout';
import { hitStop, realWait, setSpeed, shake } from '../../vfx/core';
import { setHologram } from '../../vfx/hologram';
import { showClock } from '../../duel/showclock';
import { armOnFreeze, installTestClock } from '../../duel/testClock';

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

const preview: DevPreview = {
  name: 'showclock',
  description: 'show clock test bench: hologram + shake through hit-stop, pause, 3× (&look=v3 &hold=MS)',
  async create(scene: Phaser.Scene, params: URLSearchParams) {
    const test = params.has('test');
    if (test) installTestClock();
    const hold = Number(params.get('hold')) || 0;
    const stopMs = hold || 300;
    const pauseMs = hold ? hold + 100 : 400;
    const shakes = params.get('shake') !== '0';
    scene.cameras.main.setBackgroundColor(PAL.night0);

    // the stage: a floor band and the monster under the hologram
    const g = scene.add.graphics().setDepth(DEPTH.TILE);
    g.fillStyle(PAL.night1, 1).fillRect(0, 228, GAME_W, GAME_H - 228);
    g.fillStyle(PAL.night2, 1).fillRect(0, 228, GAME_W, 2);
    const id = 'crystal_wyrm';
    const art = monsterArt(id);
    const spr = scene.add.sprite(220, 240, monsterTextureKey(id), monsterFrameName('idle', 0));
    spr.setOrigin(art.anchorX / art.w, art.anchorY / art.h).setDepth(unitDepth(240));
    spr.play(monsterAnimKey(id, 'idle'));
    setHologram(spr, { scan: 1, glitch: 0.35, tintMix: 0.55, flicker: 0.25 });

    // a tween-driven marker (the "show"): frozen by hit-stop and pause, 3× at 3×
    g.fillStyle(PAL.night3, 1).fillRect(380, 150, 220, 2);
    const marker = scene.add.rectangle(380, 151, 6, 10, PAL.gold3).setDepth(DEPTH.FX);
    scene.tweens.add({ targets: marker, x: 600, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const txt = scene.add
      .text(380, 170, '', { fontFamily: 'monospace', fontSize: '8px', color: hex(PAL.mist), lineSpacing: 2 })
      .setResolution(4)
      .setDepth(DEPTH.DEBUG);
    const state = scene.add
      .text(380, 120, '', { fontFamily: 'monospace', fontSize: '16px', color: hex(PAL.gold4) })
      .setResolution(4)
      .setDepth(DEPTH.DEBUG);
    scene.add
      .text(8, 6, `SHOW CLOCK — look ${LOOK} · stop ${stopMs} ms · pause ${pauseMs} ms`, { fontFamily: 'monospace', fontSize: '8px', color: hex(PAL.cyan3) })
      .setResolution(4)
      .setDepth(DEPTH.DEBUG);
    const clock = showClock(scene);
    let t0 = -1;
    let show0 = 0;
    let fx0 = 0;
    const upd = () => {
      const c = clock.snapshot();
      const on = t0 >= 0;
      const el = on ? Math.round(scene.game.loop.time - t0) : 0;
      txt.setText([
        `real ${el} ms`,
        `show ${on ? Math.round(c.now - show0) : 0} ms`,
        `fx   ${on ? Math.round(c.fxNow - fx0) : 0} ms`,
        `scale ${+c.scale.toFixed(2)}  fx ${+c.fxScale.toFixed(2)}${c.strictFx ? '  strict' : ''}`,
      ]);
      state.setText(c.paused ? 'PAUSE' : c.frozen ? 'HIT-STOP' : c.speed !== 1 ? `${c.speed}x` : '1x');
    };
    scene.events.on('postupdate', upd);
    scene.events.once('shutdown', () => scene.events.off('postupdate', upd));

    const at = async (ms: number) => {
      const now = scene.game.loop.time - t0;
      if (ms > now) await realWait(scene, ms - now);
    };
    const run = async () => {
      for (;;) {
        t0 = scene.game.loop.time;
        show0 = clock.now;
        fx0 = clock.fxNow;
        await at(300);
        if (shakes) void shake(scene, 300, 3);
        void hitStop(scene, stopMs);
        await at(900);
        const resume = clock.pause();
        await at(900 + pauseMs);
        resume();
        await at(1500);
        setSpeed(scene, 3);
        if (shakes) void shake(scene, 300, 3);
        await at(2300);
        setSpeed(scene, 1);
        await at(3000);
        if (!scene.sys.isActive()) return;
      }
    };
    if (test) armOnFreeze(() => void run());
    else void run();
    upd();
  },
};

export default preview;
