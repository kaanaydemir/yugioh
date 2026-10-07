// ?dev=cards — card faces / back / iso variants.
//   (default)   all 20 faces at 1×, the back, 3 faces at 2×, iso cards on a mini board
//   &mode=big   &page=0..3 — 5 cards at 2× per page (face + art window at 2×)
//   &mode=art   all 20 artwork windows at 2×
//   &mode=iso   every card lying on a tile (up/side, P1/P2, face-down)
import type Phaser from 'phaser';
import { ALL_CARD_IDS, type CardId, type MonsterId } from '../../data/cards';
import { hasMonsterArt } from '../../art/monsters';
import { PAL } from '../../art/palette';
import {
  CARD_BACK,
  ISO_CX,
  ISO_CY,
  ISO_TEX_H,
  ISO_TEX_W,
  cardArtKey,
  cardFaceKey,
  cardIsoKey,
  monsterCropArt,
  type CardOrientation,
} from '../../art/cards';
import type { PlayerId } from '../../engine/types';
import type { DevPreview } from '../types';
import { drawIsoTile } from './monster';

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = '#7f8fc0') {
  return scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: '8px', color }).setResolution(4);
}

function tile(g: Phaser.GameObjects.Graphics, x: number, y: number, player: PlayerId) {
  drawIsoTile(g, x, y, PAL.night2, player === 0 ? PAL.cyan2 : PAL.crim2);
}

function isoCard(scene: Phaser.Scene, x: number, y: number, id: CardId | 'back', o: CardOrientation, player: PlayerId) {
  return scene.add.image(x, y, cardIsoKey(id, o, player)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H);
}

const preview: DevPreview = {
  name: 'cards',
  description: 'card faces, back and iso variants (&mode=big&page=N | art | iso)',
  create(scene, params) {
    const mode = params.get('mode') ?? 'all';
    scene.cameras.main.setBackgroundColor(PAL.night0);

    if (mode === 'big') {
      const page = Number(params.get('page') ?? 0);
      const ids = ALL_CARD_IDS.slice(page * 5, page * 5 + 5);
      ids.forEach((id, i) => {
        const x = 8 + i * 126;
        scene.add.image(x, 8, cardFaceKey(id)).setOrigin(0).setScale(2);
        scene.add.image(x, 150, cardArtKey(id)).setOrigin(0).setScale(2);
        label(scene, x, 222, id);
      });
      return;
    }

    if (mode === 'art') {
      const only = params.get('only');
      if (only === 'crop') {
        // crop fallback on every monster (portraits ignored) — verifies the auto card art
        ALL_CARD_IDS.slice(0, 12).forEach((id, i) => {
          const x = 6 + (i % 6) * 105;
          const y = 6 + Math.floor(i / 6) * 120;
          const key = `dev:crop:${id}`;
          if (!scene.textures.exists(key)) scene.textures.addCanvas(key, monsterCropArt(id as MonsterId).toCanvas());
          scene.add.image(x, y, key).setOrigin(0).setScale(2);
          label(scene, x, y + 70, id);
        });
        return;
      }
      if (only === 'st' || only === 'mon') {
        (only === 'st' ? ALL_CARD_IDS.slice(12) : ALL_CARD_IDS.slice(0, 12).filter((id) => hasMonsterArt(id as MonsterId))).forEach((id, i) => {
          const x = 8 + (i % 4) * 158;
          const y = 8 + Math.floor(i / 4) * 116;
          scene.add.image(x, y, cardArtKey(id)).setOrigin(0).setScale(3);
          label(scene, x, y + 103, id);
        });
        return;
      }
      ALL_CARD_IDS.forEach((id, i) => {
        const x = 6 + (i % 7) * 90;
        const y = 6 + Math.floor(i / 7) * 82;
        scene.add.image(x, y, cardArtKey(id)).setOrigin(0).setScale(2);
        label(scene, x, y + 69, id);
      });
      return;
    }

    if (mode === 'iso') {
      const g = scene.add.graphics();
      const ids: (CardId | 'back')[] = [...ALL_CARD_IDS, 'back'];
      ids.forEach((id, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const x = 48 + col * 90;
        const y = 30 + row * 112;
        const spots: [number, number, CardOrientation, PlayerId][] = [
          [x - 16, y, 'up', 0],
          [x + 16, y + 16, 'side', 0],
          [x - 16, y + 32, 'up', 1],
          [x + 16, y + 48, 'side', 1],
        ];
        for (const [tx, ty, o, p] of spots) {
          tile(g, tx, ty, p);
          isoCard(scene, tx, ty, id, o, p);
        }
        label(scene, x - 40, y + 66, String(id));
      });
      return;
    }

    // ---- overview
    ALL_CARD_IDS.forEach((id, i) => {
      const x = 4 + (i % 10) * 50;
      const y = 4 + Math.floor(i / 10) * 70;
      scene.add.image(x, y, cardFaceKey(id)).setOrigin(0);
    });
    scene.add.image(504, 4, CARD_BACK).setOrigin(0);
    scene.add.image(554, 4, CARD_BACK).setOrigin(0).setScale(1);
    label(scene, 504, 74, 'back');
    // 2× showcase
    const big: CardId[] = ['crystal_wyrm', 'judgment_bolt', 'mirror_barrier'];
    big.forEach((id, i) => scene.add.image(4 + i * 100, 148, cardFaceKey(id)).setOrigin(0).setScale(2));
    scene.add.image(304, 148, CARD_BACK).setOrigin(0).setScale(2);
    // mini board with iso cards
    const g = scene.add.graphics();
    const ox = 520;
    const oy = 150;
    const cell = (c: number, r: number) => ({ x: ox + (c - r) * 32, y: oy + (c + r) * 16 });
    const layout: [number, number, CardId | 'back', CardOrientation, PlayerId][] = [
      [0, 0, 'back', 'up', 1],
      [1, 0, 'mirror_barrier', 'up', 1],
      [2, 0, 'back', 'side', 1],
      [0, 1, 'abyss_magus', 'up', 1],
      [1, 1, 'tide_golem', 'side', 1],
      [2, 1, 'volcano_arena', 'up', 1],
      [0, 2, 'ember_wolf', 'up', 0],
      [1, 2, 'back', 'side', 0],
      [2, 2, 'crystal_wyrm', 'up', 0],
      [0, 3, 'back', 'up', 0],
      [1, 3, 'dragon_blade', 'up', 0],
      [2, 3, 'stone_sentinel', 'side', 0],
    ];
    for (const [c, r, id, o, p] of layout) {
      const { x, y } = cell(c, r);
      tile(g, x, y, p);
      isoCard(scene, x, y, id, o, p);
    }
  },
};

export default preview;
