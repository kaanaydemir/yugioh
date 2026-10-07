// ?dev=duelists — both duelist avatars (src/art/duelists.ts), every animation, at 1× and 3×.
//   Columns: P1 1× · P1 3× · P2 3× · P2 1× (P2 mirrored exactly like src/duel/DuelistView.ts).
//   One-shots replay every 1.6 s (defeat/victory hold their last frame until then).
//   &anim=<idle|command|hurt|defeat|victory> shows one animation big (×5), both players.
//   &board=1 shows them on their podiums over the arena (layout.duelistXY) at 1×.
import Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { DUELIST_ANCHOR, DUELIST_ANIMS, DUELIST_H, DUELIST_SPECS, DUELIST_W, duelistAnimKey, duelistTextureKey, type DuelistAnim } from '../../art/duelists';
import { PAL } from '../../art/palette';
import { duelistXY } from '../../view/layout';
import type { DevPreview } from '../types';

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = '#b6fbff') {
  return scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: '8px', color }).setResolution(4).setDepth(1000);
}

function duelist(scene: Phaser.Scene, p: PlayerId, anim: DuelistAnim, x: number, y: number, scale: number) {
  const spr = scene.add.sprite(x, y, duelistTextureKey(p)).setScale(scale);
  // same origin / flip rule as DuelistView
  const ox = DUELIST_ANCHOR.x / DUELIST_W;
  spr.setOrigin(p === 1 ? 1 - ox : ox, DUELIST_ANCHOR.y / DUELIST_H).setFlipX(p === 1);
  const key = duelistAnimKey(p, anim);
  const spec = DUELIST_SPECS[anim];
  if (spec.loop) spr.play({ key, repeat: -1 });
  else {
    spr.play({ key, repeat: 0 });
    scene.time.addEvent({ delay: 1600, loop: true, callback: () => spr.play({ key, repeat: 0 }) });
  }
  return spr;
}

const preview: DevPreview = {
  name: 'duelists',
  description: 'duelist avatars: every anim at 1× and 3× (&anim= one anim big, &board=1 on the podiums)',
  create(scene, params) {
    scene.cameras.main.setBackgroundColor(PAL.night1);
    const one = params.get('anim') as DuelistAnim | null;
    if (params.get('board') === '1') {
      if (scene.textures.exists('arena')) scene.add.image(0, 0, 'arena').setOrigin(0);
      for (const p of [0, 1] as PlayerId[]) {
        const q = duelistXY(p);
        duelist(scene, p, one ?? 'idle', Math.round(q.x), Math.round(q.y), 1).setDepth(10);
      }
      label(scene, 4, 2, `duelists on their podiums (${one ?? 'idle'})`);
      return;
    }
    if (one && DUELIST_ANIMS.includes(one)) {
      const g = scene.add.graphics();
      for (const [i, p] of ([0, 1] as PlayerId[]).entries()) {
        const x = 170 + i * 300;
        const y = 300;
        g.fillStyle(PAL.night2, 1).fillEllipse(x, y, 90, 24);
        duelist(scene, p, one, x, y, 5);
        label(scene, x - 60, 316, `P${p + 1} ${one} ${DUELIST_SPECS[one].frames}f @${DUELIST_SPECS[one].fps}fps`);
      }
      return;
    }
    const g = scene.add.graphics();
    label(scene, 4, 2, `duelists ${DUELIST_W}×${DUELIST_H}, anchor (${DUELIST_ANCHOR.x},${DUELIST_ANCHOR.y}) — P1 1× · P1 3× · P2 3× · P2 1×`);
    DUELIST_ANIMS.forEach((anim, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x0 = 8 + col * 212;
      const y = 150 + row * 160;
      g.fillStyle(PAL.night2, 1).fillRect(x0, y - 132, 204, 140);
      g.fillStyle(PAL.night3, 1).fillRect(x0, y, 204, 1);
      duelist(scene, 0, anim, x0 + 14, y, 1);
      duelist(scene, 0, anim, x0 + 62, y, 3);
      duelist(scene, 1, anim, x0 + 148, y, 3);
      duelist(scene, 1, anim, x0 + 190, y, 1);
      const spec = DUELIST_SPECS[anim];
      label(scene, x0 + 2, y - 130, `${anim} ${spec.frames}f @${spec.fps}${spec.loop ? ' loop' : ''}`);
    });
  },
};

export default preview;
