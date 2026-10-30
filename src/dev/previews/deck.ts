// ?dev=deck — the deck builder (scene 'Deck').
//   &kind=all|monster|spell|trap   &attr=FIRE|WATER|LIGHT|DARK|EARTH|WIND   &sort=level|atk|name
//   &fill=empty|partial|legal|illegal|preset:<id>|classic   the deck in the editor (default: empty)
//   &slot=0..4   &cursor=N   &zone=deck &dcursor=N   &missing=N (flag "eksik kart")   &fresh=1   forget the saved decks first   &name=Ad
//   &pick=hotseat|vsBot|vsBot2   the deck picker instead of the builder (&dev picks nothing saved)
import { ALL_CARDS, isMonster, type Attribute, type CardId } from '../../data/cards';
import { autoFillDeck, classicDeck, presetById } from '../../data/decks';
import { DeckScene } from '../../scenes/deck/DeckScene';
import { DeckPickScene } from '../../scenes/deck/PickScene';
import type { KindFilter, SortKey } from '../../scenes/deck/pool';
import { deckStore } from '../../scenes/deck/store';
import type { DevPreview } from '../types';

function fillFor(kind: string | null): CardId[] | undefined {
  if (!kind || kind === 'empty') return undefined;
  if (kind === 'classic') return classicDeck();
  if (kind === 'partial') return autoFillDeck([], 3).slice(0, 9);
  if (kind === 'legal') return autoFillDeck([], 11);
  if (kind === 'illegal') {
    // 20 cards but only 4 monsters: too few canavar
    const monsters = ALL_CARDS.filter(isMonster).slice(0, 4).map((c) => c.id);
    const rest = ALL_CARDS.filter((c) => !isMonster(c)).map((c) => c.id);
    return [...monsters, ...rest].slice(0, 12);
  }
  if (kind.startsWith('preset:')) return presetById(kind.slice(7))?.cards;
  return undefined;
}

const preview: DevPreview = {
  name: 'deck',
  description: 'deck builder: &kind= &attr= &sort= &fill=empty|partial|legal|illegal|classic|preset:<id> &slot= &cursor= &name= &pick=hotseat|vsBot',
  async create(scene, params) {
    const mgr = scene.game.scene;
    if (!mgr.keys['Deck']) mgr.add('Deck', DeckScene, false);
    if (!mgr.keys['DeckPick']) mgr.add('DeckPick', DeckPickScene, false);
    const pick = params.get('pick');
    if (pick) {
      const ready = new Promise<void>((resolve) => scene.game.events.once('deck:ready', () => resolve()));
      scene.scene.start('DeckPick', { mode: pick === 'hotseat' ? 'hotseat' : 'vsBot', step: pick === 'vsBot2' ? 1 : 0, dev: true });
      await ready;
      return;
    }
    if (params.get('fresh') === '1') {
      const s = deckStore();
      for (let i = 0; i < 5; i++) s.setSlot(i, null);
    }
    const attr = params.get('attr') as Attribute | null;
    const ready = new Promise<void>((resolve) => scene.game.events.once('deck:ready', () => resolve()));
    scene.scene.start('Deck', {
      dev: true,
      slot: params.has('slot') ? Number(params.get('slot')) : 0,
      qa: {
        kind: (params.get('kind') as KindFilter | null) ?? undefined,
        attr: attr ?? null,
        sort: (params.get('sort') as SortKey | null) ?? undefined,
        cards: fillFor(params.get('fill')),
        name: params.get('name') ?? undefined,
        cursor: params.has('cursor') ? Number(params.get('cursor')) : undefined,
        zone: params.get('zone') === 'deck' ? ('deck' as const) : undefined,
        deckCursor: params.has('dcursor') ? Number(params.get('dcursor')) : undefined,
        missing: params.has('missing') ? Number(params.get('missing')) : undefined,
      },
    });
    await ready;
  },
};

export default preview;
