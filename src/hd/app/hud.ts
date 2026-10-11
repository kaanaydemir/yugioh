// Small status / key-hint overlay for the trial page (Turkish). Hidden in tools/shot.mjs runs (?test) unless ?hud=1.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { pixelText } from '../../ui/text';
import { DEPTH } from '../../view/layout';
import { HD_H, HD_W } from '../contracts';

export interface HudState {
  view: string;
  lighting: boolean;
  env: 1 | 2;
  speed: number;
  bloom: boolean;
  extra?: string;
}

export interface Hud {
  update(s: HudState): void;
  destroy(): void;
}

export function makeHud(scene: Phaser.Scene, params: URLSearchParams): Hud {
  const hidden = params.get('hud') === '0' || (params.has('test') && params.get('hud') !== '1');
  if (hidden) return { update() {}, destroy() {} };
  const top = pixelText(scene, 8, 6, '', { size: 'md', color: PAL.cyan4 }).setDepth(DEPTH.DEBUG).setScrollFactor(0).setAlpha(0.9);
  const keys = pixelText(scene, 8, HD_H - 16, 'D ORTAM PİKSELİ   L IŞIK   B BLOOM   BOŞLUK 3× HIZ   R YENİDEN', { size: 'md', color: PAL.mist })
    .setDepth(DEPTH.DEBUG)
    .setScrollFactor(0)
    .setAlpha(0.7);
  void HD_W;
  return {
    update(s) {
      const on = (b: boolean) => (b ? 'AÇIK' : 'KAPALI');
      top.setText(`HD NEON · ${s.view.toUpperCase()}   IŞIK ${on(s.lighting)}   BLOOM ${on(s.bloom)}   ORTAM ${s.env}×   HIZ ${s.speed}×${s.extra ? '   ' + s.extra : ''}`);
    },
    destroy() {
      top.destroy();
      keys.destroy();
    },
  };
}
