// Talih Zarı — the gold die caught at the top of its throw, its six turned toward us, motion arcs behind it.
// The drawing is the v3 card art's small picture (src/art/cardart-v3/lucky_die.ts): one picture for both looks.
import type { CardArtwork } from '../types';
import v3 from '../cardart-v3/lucky_die';
import { renderArt } from '../cardart-v3/_kit';

const art: CardArtwork = {
  id: 'lucky_die',
  draw(p) {
    p.blit(renderArt(v3, 0).smallPx, 0, 0);
  },
};

export default art;
