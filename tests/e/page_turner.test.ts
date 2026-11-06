// Lane E — Sayfa Çeviren (page_turner): the film stages (src/duel/scenarios/e_page_turner.ts) play through the engine
// and emit what the presentation (src/cinematics/spells/page_turner.ts) consumes in one batch: activate, every hand
// card of the caster then of the other side as discard + toGraveyard(hand), the caster's draws then the other side's
// (as many as each threw, fewer on a short deck), and the spell's own toGraveyard(resolved) last.
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_page_turner';
import { isUiStep } from '../../src/duel/scenarios';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';
import art from '../../src/art/cardart-v3/page_turner';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { RECIPES, RIFFLE_TIMES } from '../../src/audio/v3/e/page_turner';

function runStage(key: string): { state: GameState; batches: GameEvent[][] } {
  const sc = PACK[key];
  let state = buildStage(sc.stage);
  const batches: GameEvent[][] = [];
  for (const step of sc.steps) {
    if (isUiStep(step)) continue;
    const a = (typeof step === 'function' ? step({ uid: (id: CardId, p?: PlayerId) => uidOf(state, id, p) }) : step) as Action;
    const r = apply(state, a);
    state = r.state;
    batches.push(r.events);
  }
  return { state, batches };
}

const count = (ev: GameEvent[], type: 'discard' | 'draw', p: PlayerId) => ev.filter((e) => e.type === type && e.player === p).length;

describe('e_page_turner stages', () => {
  const cases: [string, number, number, number, number][] = [
    // key, caster discards, other discards, caster draws, other draws
    ['ePage', 3, 5, 3, 5],
    ['ePageP2', 3, 5, 3, 5],
    ['ePageSet', 2, 3, 2, 3],
    ['ePageSetP2', 2, 3, 2, 3],
    ['ePageLone', 0, 4, 0, 4],
    ['ePageLoneP2', 0, 4, 0, 4],
    ['ePageShort', 3, 5, 3, 2],
    ['ePageBare', 0, 0, 0, 0],
  ];
  for (const [key, da, db, wa, wb] of cases)
    it(key, () => {
      const { batches } = runStage(key);
      const ev = batches[0];
      const p = (PACK[key].stage.active ?? 0) as PlayerId;
      const o = (1 - p) as PlayerId;
      expect(ev[0].type).toBe('activate');
      expect([count(ev, 'discard', p), count(ev, 'discard', o), count(ev, 'draw', p), count(ev, 'draw', o)]).toEqual([da, db, wa, wb]);
      // order: all discards (caster first), then the draws (caster first), the spell leaves last
      const kinds = ev.filter((e) => e.type === 'discard' || e.type === 'draw').map((e) => `${e.type}${e.type === 'discard' || e.type === 'draw' ? e.player : ''}`);
      const want = [...Array(da).fill(`discard${p}`), ...Array(db).fill(`discard${o}`), ...Array(wa).fill(`draw${p}`), ...Array(wb).fill(`draw${o}`)];
      expect(kinds).toEqual(want);
      const last = ev.filter((e) => e.type === 'toGraveyard').pop();
      expect(last && last.type === 'toGraveyard' && last.cardId === 'page_turner' && last.from).toBe('resolved');
    });
});

describe('page_turner card art and riffle', () => {
  it('stays in the palette and the style-sheet budgets, both sizes, every frame', () => {
    for (let f = 0; f < (art.frames ?? 1); f++) {
      const r = renderArt(art, f);
      for (const [layers, pic] of [
        [r.big, r.bigPx],
        [r.small, r.smallPx],
      ] as const) {
        const st = artStats(layers, pic, art.focus);
        expect(st.offPalette).toBe(0);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
      }
    }
  });
  it('the riffle schedule rises then falls (one flap per turning page)', () => {
    expect(RIFFLE_TIMES.length).toBe(14);
    for (let i = 1; i < RIFFLE_TIMES.length; i++) expect(RIFFLE_TIMES[i]).toBeGreaterThan(RIFFLE_TIMES[i - 1]);
  });
  it('scores every beat from the scene (single flap / crease recipes, no baked train)', () => {
    for (const n of ['e_pageFlap', 'e_pageFlapStiff', 'e_pageGust', 'e_pageLand', 'e_pageBoard', 'e_pageStrain', 'e_pageCrease', 'e_pagePress', 'e_pageTuck', 'e_pageFizzle', 'e_pageDust'])
      expect(RECIPES).toHaveProperty(n);
    expect(RECIPES).not.toHaveProperty('e_pageRiffle');
    expect(RECIPES.e_pageFlap.cap).toBeGreaterThanOrEqual(8);
  });
});
