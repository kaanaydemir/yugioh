// ?dev=monster&id=<monster_id>[&mode=sheet|live|board][&anim=<anim>][&scale=N][&markers=1]
//   sheet (default): every frame of every animation, side by side (or one anim with &anim=)
//   live: all animations playing at once, P1 facing + P2 flipped
//   board: the monster at 1× on iso tiles next to the tile grid (in-game scale check)
import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import { MONSTER_IDS, cardDef } from '../../data/cards';
import { monsterArt } from '../../art/monsters';
import { PAL } from '../../art/palette';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { MONSTER_ANIMS } from '../../art/types';
import type { DevPreview } from '../types';
import { TILE_H, TILE_W } from '../../view/layout';

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = '#b6fbff') {
  return scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: '8px', color }).setResolution(4);
}

export function drawIsoTile(g: Phaser.GameObjects.Graphics, x: number, y: number, fill: number, line: number) {
  g.fillStyle(fill, 1);
  g.lineStyle(1, line, 1);
  g.beginPath();
  g.moveTo(x, y - TILE_H / 2);
  g.lineTo(x + TILE_W / 2, y);
  g.lineTo(x, y + TILE_H / 2);
  g.lineTo(x - TILE_W / 2, y);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function markers(scene: Phaser.Scene, ox: number, oy: number, s: number, id: MonsterId) {
  const art = monsterArt(id);
  const g = scene.add.graphics();
  g.fillStyle(0x00ff00, 1).fillRect(ox + art.anchorX * s - 1, oy + art.anchorY * s - 1, 3, 3);
  g.fillStyle(0xff0000, 1).fillRect(ox + art.muzzle.x * s - 1, oy + art.muzzle.y * s - 1, 3, 3);
  g.fillStyle(0xffff00, 1).fillRect(ox + art.core.x * s - 1, oy + art.core.y * s - 1, 3, 3);
  g.lineStyle(1, 0x3b4c91, 1).strokeRect(ox - 0.5, oy - 0.5, art.w * s + 1, art.h * s + 1);
}

const preview: DevPreview = {
  name: 'monster',
  description: 'one monster: &id=<id>&mode=sheet|live|board&anim=&scale=&markers=1',
  create(scene, params) {
    const id = (params.get('id') ?? 'crystal_wyrm') as MonsterId;
    if (!MONSTER_IDS.includes(id)) throw new Error(`unknown monster ${id}`);
    const art = monsterArt(id);
    const mode = params.get('mode') ?? 'sheet';
    const showMarkers = params.get('markers') === '1';
    const key = monsterTextureKey(id);
    scene.cameras.main.setBackgroundColor(PAL.night1);
    const def = cardDef(id);
    label(scene, 4, 2, `${id} — ${def.name}  ${art.w}x${art.h}  anchor(${art.anchorX},${art.anchorY}) impact=${art.attackImpactFrame}`);

    if (mode === 'sheet') {
      const anims: MonsterAnim[] = params.get('anim') ? [params.get('anim') as MonsterAnim] : MONSTER_ANIMS;
      const maxFrames = Math.max(...anims.map((a) => art.anims[a].frames));
      const auto = Math.max(1, Math.floor(Math.min((640 - 48) / (maxFrames * (art.w + 2)), (360 - 14) / (anims.length * (art.h + 10)))));
      const s = Number(params.get('scale') ?? auto);
      let y = 14;
      for (const anim of anims) {
        const spec = art.anims[anim];
        label(scene, 2, y, `${anim}\n${spec.frames}f\n${spec.fps}fps`);
        for (let f = 0; f < spec.frames; f++) {
          const x = 44 + f * (art.w * s + 2);
          scene.add.rectangle(x, y, art.w * s, art.h * s, PAL.night2).setOrigin(0);
          scene.add.image(x, y, key, monsterFrameName(anim, f)).setOrigin(0).setScale(s);
          if (anim === 'attack' && f === art.attackImpactFrame) label(scene, x + 1, y + 1, 'IMPACT', '#ff4d5e');
          if (showMarkers) markers(scene, x, y, s, id);
        }
        y += art.h * s + 8;
      }
      return;
    }

    if (mode === 'live') {
      const s = Number(params.get('scale') ?? 2);
      const g = scene.add.graphics();
      MONSTER_ANIMS.forEach((anim, i) => {
        const cx = 64 + i * 124;
        for (const [row, flip] of [
          [0, false],
          [1, true],
        ] as const) {
          const cy = 150 + row * 170;
          drawIsoTile(g, cx, cy, PAL.night2, PAL.cyan2);
          const spr = scene.add.sprite(cx, cy, key, monsterFrameName('idle', 0)).setScale(s).setFlipX(flip);
          spr.setOrigin((flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h);
          spr.play({ key: monsterAnimKey(id, anim), repeat: -1, repeatDelay: art.anims[anim].loop ? 0 : 400 });
          if (row === 0) label(scene, cx - 20, 14, anim);
        }
      });
      return;
    }

    // board
    const g = scene.add.graphics();
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++) drawIsoTile(g, 320 + (c - r) * 32, 120 + (c + r) * 16, PAL.night2, PAL.cyan2);
    const spr = scene.add.sprite(320, 152, key).setOrigin(art.anchorX / art.w, art.anchorY / art.h);
    spr.play(monsterAnimKey(id, 'idle'));
    const spr2 = scene.add.sprite(352, 136, key).setOrigin((art.w - art.anchorX) / art.w, art.anchorY / art.h).setFlipX(true);
    spr2.play(monsterAnimKey(id, 'guard'));
  },
};

export default preview;
