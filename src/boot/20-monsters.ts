// Monster sheets (src/art/textures.ts). A4.1 staged painting (docs/v3/A3_MIMARI.md §11.2): the page
// paints ahead only the sheets of its SheetPlan (src/art/atlas.ts) — a staged scenario
// (?dev=duel&s=<key>, what films / measure pages load) the monsters it stages and the ones in its
// decks, a real game the monsters of both decks, the P2 'relight' sheets only for monsters player 2
// can control; any other dev page nothing. Every other sheet is registered and painted on first use
// (synchronously: deterministic under the frozen test clock).
import { DEFAULT_DECK } from '../data/cards';
import { deckPlan, stagePlan, type SheetPlan } from '../art/atlas';
import { buildAllMonsters } from '../art/textures';
import { SCENARIOS } from '../duel/scenarios';
import type { BootStep } from './types';

/** The sheets a page with this query paints ahead (see the header). */
export function bootSheetPlan(search: string): SheetPlan {
  const q = new URLSearchParams(search);
  const dev = q.get('dev');
  if (dev) {
    const sc = dev === 'duel' ? SCENARIOS[q.get('s') ?? ''] : undefined;
    return sc ? stagePlan(sc.stage) : { p1: [], p2: [] };
  }
  return deckPlan([DEFAULT_DECK, DEFAULT_DECK]);
}

const step: BootStep = {
  name: 'monsters',
  order: 20,
  build: (scene) => buildAllMonsters(scene, typeof location === 'undefined' ? undefined : bootSheetPlan(location.search)),
};
export default step;
