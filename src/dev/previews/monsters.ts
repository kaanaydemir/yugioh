// ?dev=monsters — all 12 monsters at in-game (1×) scale on iso tiles, idle animation. &anim= to switch.
import { MONSTER_IDS } from '../../data/cards';
import { monsterArt, hasMonsterArt } from '../../art/monsters';
import { PAL } from '../../art/palette';
import { monsterAnimKey, monsterTextureKey } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import type { DevPreview } from '../types';
import { drawIsoTile } from './monster';

const preview: DevPreview = {
  name: 'monsters',
  description: 'lineup of all monsters at 1x on tiles (&anim=idle|roar|attack|hit|guard, &scale=)',
  create(scene, params) {
    const anim = (params.get('anim') ?? 'idle') as MonsterAnim;
    const s = Number(params.get('scale') ?? 1);
    scene.cameras.main.setBackgroundColor(PAL.night1);
    const g = scene.add.graphics();
    MONSTER_IDS.forEach((id, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = 56 + col * 106;
      const y = 150 + row * 170;
      drawIsoTile(g, x, y, PAL.night2, PAL.cyan2);
      const art = monsterArt(id);
      const spr = scene.add.sprite(x, y, monsterTextureKey(id)).setOrigin(art.anchorX / art.w, art.anchorY / art.h).setScale(s);
      spr.setDepth(100 + y);
      spr.play({ key: monsterAnimKey(id, anim), repeat: -1, repeatDelay: art.anims[anim].loop ? 0 : 500 });
      scene.add
        .text(x, y + 20, (hasMonsterArt(id) ? '' : '(placeholder) ') + id, { fontFamily: 'monospace', fontSize: '8px', color: '#b6fbff' })
        .setOrigin(0.5, 0)
        .setResolution(4);
    });
  },
};

export default preview;
