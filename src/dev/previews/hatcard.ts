// ?dev=hatcard[&id=magic_hat] — one card in every size the game shows it: the 1× face (hand), the 2× face
// (inspect), the art window at 1× / 3×, and the flat iso card lying on a tile (field), P1 and P2.
import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import { PAL } from '../../art/palette';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardArtKey, cardFaceKey, cardIsoKey } from '../../art/cards';
import type { DevPreview } from '../types';
import { drawIsoTile } from './monster';

const preview: DevPreview = {
  name: 'hatcard',
  description: 'one card at hand 1×, inspect 2×, art 1×/3× and as iso field cards (&id=magic_hat)',
  create(scene, params) {
    const id = (params.get('id') ?? 'magic_hat') as CardId;
    scene.cameras.main.setBackgroundColor(PAL.night0);
    scene.add.image(8, 8, cardFaceKey(id)).setOrigin(0);
    scene.add.image(64, 8, cardFaceKey(id)).setOrigin(0).setScale(2);
    scene.add.image(170, 8, cardArtKey(id)).setOrigin(0);
    scene.add.image(170, 52, cardArtKey(id)).setOrigin(0).setScale(3);
    const g = scene.add.graphics();
    const spots: [number, number, 'up' | 'side', 0 | 1][] = [
      [300, 40, 'up', 0],
      [340, 56, 'side', 0],
      [380, 40, 'up', 1],
      [420, 56, 'side', 1],
    ];
    for (const [x, y, o, p] of spots) {
      drawIsoTile(g, x, y, PAL.night2, p === 0 ? PAL.cyan2 : PAL.crim2);
      scene.add.image(x, y, cardIsoKey(id, o, p)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H);
    }
    void Phaser;
  },
};

export default preview;
