// Sihirli Şapka — three violet top hats with gold bands under a single spotlight, a tiny star over the middle one.
// The drawing is the v3 card art's small picture (src/art/cardart-v3/magic_hat.ts): one picture for both looks.
import type { CardArtwork } from '../types';
import v3 from '../cardart-v3/magic_hat';
import { renderArt } from '../cardart-v3/_kit';

const art: CardArtwork = {
  id: 'magic_hat',
  draw(p) {
    p.blit(renderArt(v3, 0).smallPx, 0, 0);
  },
};

export default art;
