// Şafak Kılıçları — a ring of blades planted in dusk-blue ground, a half-sunk dawn and pillars of light between them.
// The drawing is the v3 card art's small picture (src/art/cardart-v3/dawn_swords.ts): one picture for both looks.
import type { CardArtwork } from '../types';
import v3 from '../cardart-v3/dawn_swords';
import { renderArt } from '../cardart-v3/_kit';

const art: CardArtwork = {
  id: 'dawn_swords',
  draw(p) {
    p.blit(renderArt(v3, 0).smallPx, 0, 0);
  },
};

export default art;
