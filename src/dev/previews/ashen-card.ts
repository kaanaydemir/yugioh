// ?dev=ashen-card — Kül Ejderi's v3 card face next to the reference aces (lane A card-art review,
// docs/v3/kart-a/ashen_drake.md §7.1). Open with &look=v3. &ids=a,b,c overrides the row.
//   row 1: the faces at 1× (hand size)      row 2: the faces at 3× (inspect zoom)
//   row 3: each card lying face-up on a P1 / P2 tile (board)
import type { CardId } from '../../data/cards';
import { PAL } from '../../art/palette';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardFaceKey, cardIsoKey } from '../../art/cards';
import type { DevPreview } from '../types';
import { drawIsoTile } from './monster';

const preview: DevPreview = {
  name: 'ashen-card',
  description: 'ashen_drake v3 card face vs crystal_wyrm / magma_titan at 1×, 3× and on the board',
  create(scene, params) {
    scene.cameras.main.setBackgroundColor(PAL.night0);
    const ids = (params.get('ids') ?? 'ashen_drake,crystal_wyrm,magma_titan').split(',') as CardId[];
    ids.forEach((id, i) => {
      scene.add.image(8 + i * 56, 6, cardFaceKey(id)).setOrigin(0);
      scene.add.image(180 + i * 150, 6, cardFaceKey(id)).setOrigin(0).setScale(3);
      const g = scene.add.graphics();
      for (const [k, player] of [[0, 0], [1, 1]] as const) {
        const x = 40 + i * 56;
        const y = 120 + k * 60;
        drawIsoTile(g, x, y, PAL.night2, player === 0 ? PAL.cyan2 : PAL.crim2);
        scene.add.image(x, y, cardIsoKey(id, 'up', player)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H);
      }
    });
  },
};
export default preview;
