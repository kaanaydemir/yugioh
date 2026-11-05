import { it } from 'vitest';
import art from '../../src/art/cardart-v3/sweeping_gale';
import { renderArt } from '../../src/art/cardart-v3/_kit';
import { PAL } from '../../src/art/palette';
const name = (c: number | null) => (c === null ? 'null' : Object.entries(PAL).find(([, v]) => v === c)?.[0] ?? c.toString(16));
it('chk', () => {
  for (const f of [0, 1, 2, 3]) {
    const r = renderArt(art, f);
    const p = r.smallPx;
    for (let y = 0; y < p.h - 1; y++)
      for (let x = 0; x < p.w - 1; x++) {
        const a = p.get(x, y), b = p.get(x + 1, y), c = p.get(x, y + 1), d = p.get(x + 1, y + 1);
        if (a === d && b === c && a !== b) console.log('CHK f' + f, x, y, name(a), name(b), 'layers a:', name(r.small.light.get(x, y)), name(r.small.subject.get(x, y)), name(r.small.backdrop.get(x, y)), 'b:', name(r.small.light.get(x + 1, y)), name(r.small.subject.get(x + 1, y)));
      }
  }
});
