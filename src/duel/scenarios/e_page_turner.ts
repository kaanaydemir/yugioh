// Lane E — Sayfa Çeviren (page_turner) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S11). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=ePage&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/page_turner/take.png
// Both hands are uneven on purpose (the caster keeps 3 besides the book, the other side holds 5) so the book binds
// two different stacks and deals two different counts back. P2 stages are the mirrored twins (active: 1).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const book = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('page_turner', p) }) as Action;

const MY_HAND: CardId[] = ['ember_wolf', 'page_turner', 'tide_golem', 'judgment_bolt'];
const MY_DECK: CardId[] = ['crystal_wyrm', 'reed_heron', 'well_pail', 'kite_fencer', 'stone_sentinel'];
const THEIR_HAND: CardId[] = ['shade_assassin', 'mirror_barrier', 'lumen_sprite', 'storm_hawk', 'healing_spring'];
const THEIR_DECK: CardId[] = ['crag_axeman', 'void_eye', 'magma_titan', 'coral_serpent', 'dragon_blade', 'abyss_magus'];

type Side = NonNullable<Scenario['stage']['p0']>;
function stage(p: PlayerId, me: Side, them: Side): Scenario['stage'] {
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

const mons = (...xs: (CardId | null)[]): (CardId | null)[] => [...xs, ...Array.from({ length: 5 - xs.length }, () => null)];

function hand(p: PlayerId): Scenario['stage'] {
  return stage(p, { hand: MY_HAND, deck: MY_DECK, monsters: mons(null, 'crag_axeman') }, { hand: THEIR_HAND, deck: THEIR_DECK, monsters: mons(null, null, 'magma_titan') });
}

function set(p: PlayerId): Scenario['stage'] {
  return stage(
    p,
    { hand: ['ember_wolf', 'tide_golem'], deck: MY_DECK, spellTraps: mons(null, 'page_turner'), monsters: mons(null, 'reed_heron') },
    { hand: ['shade_assassin', 'mirror_barrier', 'lumen_sprite'], deck: THEIR_DECK, monsters: mons(null, null, 'shade_assassin') },
  );
}

/** The caster holds only the book: it binds the other hand alone and deals the caster nothing back. */
function lone(p: PlayerId): Scenario['stage'] {
  return stage(p, { hand: ['page_turner'], deck: MY_DECK, monsters: mons(null, 'crag_axeman') }, { hand: THEIR_HAND.slice(0, 4), deck: THEIR_DECK });
}

/** The other side's deck holds only two cards for its five: it gets two back. */
function short(p: PlayerId): Scenario['stage'] {
  return stage(p, { hand: MY_HAND, deck: MY_DECK }, { hand: THEIR_HAND, deck: ['void_eye', 'crag_axeman'], monsters: mons(null, 'ember_wolf') });
}

/** Both hands empty besides the book: the book opens on blank pages and shuts again (nothing moves). */
function bare(p: PlayerId): Scenario['stage'] {
  return stage(p, { hand: ['page_turner'], deck: MY_DECK }, { hand: [], deck: THEIR_DECK, monsters: mons(null, 'ember_wolf') });
}

const PACK: Record<string, Scenario> = {
  ePage: { desc: 'Sayfa Çeviren (P1, elden): 3 + 5 kart kitaba ciltlenir, PAT, mezarlıklara; 3 + 5 yeni kart', stage: hand(0), steps: [book(0)] },
  ePageP2: { desc: 'Sayfa Çeviren (P2, elden): aynalı', stage: hand(1), steps: [book(1)] },
  ePageSet: { desc: 'Sayfa Çeviren kapalıdan (P1): 2 + 3 kart', stage: set(0), steps: [book(0)] },
  ePageSetP2: { desc: 'Sayfa Çeviren kapalıdan (P2)', stage: set(1), steps: [book(1)] },
  ePageLone: { desc: 'Sayfa Çeviren (P1): elde yalnız kitap — yalnız rakibin 4 kartı döner', stage: lone(0), steps: [book(0)] },
  ePageLoneP2: { desc: 'Sayfa Çeviren (P2): elde yalnız kitap', stage: lone(1), steps: [book(1)] },
  ePageShort: { desc: 'Sayfa Çeviren (P1): rakibin destesinde 2 kart — 5 atar, 2 çeker', stage: short(0), steps: [book(0)] },
  ePageBare: { desc: 'Sayfa Çeviren (P1): iki el de boş — kitap boş sayfalarla açılıp kapanır', stage: bare(0), steps: [book(0)] },
  ePagePlay: { desc: 'Sayfa Çeviren (P1): elle oyna', stage: hand(0), steps: [] },
};

export default PACK;
