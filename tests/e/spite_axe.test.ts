// Hınç Baltası (spite_axe) — pure parts of the v3 presentation: the card art, the axe drawing, the eye anchors.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/cardart-v3/spite_axe';
import { renderArt } from '../../src/art/cardart-v3/_kit';
import { PAL } from '../../src/art/palette';
import { axeMotif } from '../../src/cinematics/spells/_spite_axe_motif';
import { RECIPES } from '../../src/audio/v3/e/spite_axe';

const PALSET = new Set<number>(Object.values(PAL));

describe('spite_axe v3', () => {
  it('card art: every frame paints palette colours only, big and small', () => {
    for (let f = 0; f < art.frames; f++) {
      const r = renderArt(art, f);
      for (const p of [r.bigPx, r.smallPx])
        for (let y = 0; y < p.h; y++)
          for (let x = 0; x < p.w; x++) {
            const c = p.get(x, y);
            if (c !== null) expect(PALSET.has(c)).toBe(true);
          }
    }
  });

  it('the impact drawing (heat 4) burns white in its cracks, the plain one does not', () => {
    const count = (heat: number): number => {
      const m = axeMotif({ size: 'lg', angle: 75, mirror: true, heat });
      let n = 0;
      for (let y = 0; y < m.px.h; y++) for (let x = 0; x < m.px.w; x++) if (m.px.get(x, y) === PAL.white) n++;
      return n;
    };
    expect(count(4)).toBeGreaterThan(4);
    expect(count(2)).toBe(0);
  });

  it('every beat has its own recipe, all e_axe-prefixed', () => {
    const names = Object.keys(RECIPES);
    for (const n of ['e_axeOmen', 'e_axeFall', 'e_axeBite', 'e_axeChain', 'e_axePulse', 'e_axeGrip', 'e_axeWrench', 'e_axeSnap', 'e_axeIgnite', 'e_axeCard', 'e_axeSlip', 'e_axeFly', 'e_axeDeck', 'e_axeLash']) expect(names).toContain(n);
    for (const n of names) expect(n.startsWith('e_axe')).toBe(true);
  });
});
