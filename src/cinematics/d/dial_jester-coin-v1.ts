// Kadran Soytarısı (dial_jester) — the batch-2 placeholder coin toss, kept VERBATIM for v1 (and any v3 source that is
// not the jester): moved here from src/cinematics/b2/placeholders.ts when lane D took the event over. The v3 jester
// toss lives in ./dial_jester-coin.ts (priority 20) and falls through to this one with ctx.base(). Keep this file
// byte-for-byte equivalent to the old placeholder so the v1 films stay identical.

import Phaser from 'phaser';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { DEPTH, zoneXY, type XY } from '../../view/layout';
import { pixelText } from '../../ui/text';
import { TEX, tween, wait } from '../../vfx/core';
import { registerEvent, type CinematicContext } from '../api';
import type { GameEvent } from '../../engine/types';

type Ctx<T extends GameEvent['type']> = CinematicContext<Extract<GameEvent, { type: T }>>;
const ADD = Phaser.BlendModes.ADD;
const R = (v: number) => Math.round(v);

/** A short word that rises and fades over a world point. */
function floatWord(scene: Phaser.Scene, at: XY, text: string, color: number, ms = 900): Promise<void> {
  const t = pixelText(scene, R(at.x), R(at.y), text, { size: 'md', color }).setOrigin(0.5, 1).setDepth(DEPTH.FX_TOP);
  t.setAlpha(0);
  return (async () => {
    await tween(scene, { targets: t, alpha: 1, y: R(at.y - 6), duration: 140 });
    await wait(scene, ms - 320);
    await tween(scene, { targets: t, alpha: 0, y: R(at.y - 12), duration: 180 });
    t.destroy();
  })();
}

/** A few pixel sparks bursting from a point. */
function sparks(scene: Phaser.Scene, at: XY, color: number, n = 10, r = 18, ms = 420): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.2;
    const p = scene.add.image(R(at.x), R(at.y), i % 4 === 0 ? TEX.plus : TEX.px2).setTint(i % 3 === 0 ? PAL.white : color).setBlendMode(ADD).setDepth(DEPTH.FX);
    scene.tweens.add({ targets: p, x: R(at.x + Math.cos(a) * r), y: R(at.y + Math.sin(a) * r * 0.6), alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => p.destroy() });
  }
}

registerEvent(
  'coinToss',
  async (ctx: Ctx<'coinToss'>) => {
    const ev = ctx.ev;
    const scene = ctx.scene;
    const loc = ctx.locate(ev.sourceUid);
    const base = loc && 'player' in loc && 'index' in loc ? zoneXY(loc.player as PlayerId, 'monster', loc.index as number) : zoneXY(ev.player, 'monster', 2);
    const x = R(base.x);
    const y0 = R(base.y - 30);
    const face = (f: 'heads' | 'tails') => (f === 'heads' ? 'TURA' : 'YAZI');
    const coin = scene.add.container(x, y0).setDepth(DEPTH.FX_TOP);
    const g = scene.add.graphics();
    g.fillStyle(PAL.gold1).fillCircle(0, 0, 11);
    g.fillStyle(PAL.gold3).fillCircle(0, -1, 10);
    g.fillStyle(PAL.gold4).fillCircle(-2, -3, 5);
    const label = pixelText(scene, 0, 0, face(ev.call), { size: 'sm', color: PAL.night0, outline: false }).setOrigin(0.5);
    coin.add([g, label]);
    ctx.sfx('uiClick', { volume: 0.8, pitch: 1.6 });
    void floatWord(scene, { x, y: y0 - 20 }, `${ev.player === 0 ? 'OYUNCU 1' : 'OYUNCU 2'}: ${face(ev.call)}`, PLAYER_COLOR[ev.player], 900);
    // up, spinning (scaleX flips), down
    const o = { t: 0 };
    let lastHalf = -1;
    await tween(scene, {
      targets: o,
      t: 1,
      duration: 1100,
      onUpdate: () => {
        const t = o.t;
        coin.y = R(y0 - Math.sin(t * Math.PI) * 46);
        const spin = t * 9;
        coin.scaleX = Math.max(0.12, Math.abs(Math.cos(spin * Math.PI)));
        const half = Math.floor(spin + 0.5);
        if (half !== lastHalf) {
          lastHalf = half;
          label.setText(face(half % 2 ? (ev.call === 'heads' ? 'tails' : 'heads') : ev.call));
          if (half % 2 === 0) ctx.sfx('uiHover', { volume: 0.4, pitch: 1.8 });
        }
      },
    });
    coin.scaleX = 1;
    label.setText(face(ev.result));
    ctx.sfx('uiClick', { volume: 0.9, pitch: 2 });
    await tween(scene, { targets: coin, y: y0 - 6, duration: 90, yoyo: true, ease: 'Quad.Out' });
    await wait(scene, 250);
    const color = ev.win ? PAL.leaf4 : PAL.crim4;
    ctx.sfx(ev.win ? 'uiConfirm' : 'uiError', { volume: 0.9 });
    sparks(scene, { x, y: y0 }, ev.win ? PAL.gold4 : PAL.crim3, 14, 22);
    await floatWord(scene, { x, y: y0 - 18 }, ev.win ? `${face(ev.result)} — BİLDİ!` : `${face(ev.result)} — BİLEMEDİ!`, color, 1000);
    await tween(scene, { targets: coin, alpha: 0, duration: 160 });
    coin.destroy();
  },
  { name: 'b2:coinToss' },
);
