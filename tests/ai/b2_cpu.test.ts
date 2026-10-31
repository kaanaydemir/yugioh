// CPU (src/engine/bot.ts) with the batch-2 cards (docs/v3/YENI_KARTLAR.md): the per-card heuristics of the spec's
// "CPU:" lines, the Mıknatıs preset, and a preset-vs-preset league in which the CPU actually plays the new cards
// (draws, wipes, control steal, quick spells in answer, coin / dice, fusion) and every game reaches a winner.
import { describe, expect, it } from 'vitest';
import { apply, chooseAction, newGame, type Action, type GameEvent, type GameState } from '../../src/engine';
import { CARDS, MAGNET_PIECE_IDS, isMonster, isSpell, type CardId } from '../../src/data/cards';
import { PRESET_DEFS, SINGLE_COPY_IDS, copiesOf, presetById, presetDecks, validateDeck } from '../../src/data/decks';
import { scenario, uidOf } from '../engine/b2_kit';

const act = (s: GameState, seed = 1): Action => chooseAction(s, seed);
const idOf = (s: GameState, uid: number): CardId => s.cards[uid].cardId;

describe('CPU heuristics for the batch-2 cards', () => {
  it('Kabuk Zıpkıncı in hand: Gelgit Körfezi goes down first', () => {
    const s = scenario({ p0: { hand: ['tide_harpooner', 'tidal_bay', 'stone_sentinel'] } });
    const a = act(s);
    expect(a.type).toBe('activateSpell');
    expect(idOf(s, (a as Extract<Action, { type: 'activateSpell' }>).uid)).toBe('tidal_bay');
  });

  it("removal goes for the Bay that shrouds the opponent's harpooner (over a set card)", () => {
    const base = { p1: { monsters: ['tide_harpooner' as CardId], field: 'tidal_bay' as CardId, spellTraps: ['mirror_barrier' as CardId] } };
    const s = scenario({ ...base, p0: { hand: ['purging_wave'] } });
    const a = act(s) as Extract<Action, { type: 'activateSpell' }>;
    expect(a.type).toBe('activateSpell');
    expect(a.target).toMatchObject({ kind: 'card', ref: { player: 1, zone: 'field' } });
    // without the harpooner the face-down card is the better target
    const t = scenario({ p1: { monsters: ['stone_sentinel'], field: 'tidal_bay', spellTraps: ['mirror_barrier'] }, p0: { hand: ['purging_wave'] } });
    const b = act(t) as Extract<Action, { type: 'activateSpell' }>;
    expect(b.target).toMatchObject({ kind: 'card', ref: { player: 1, zone: 'spellTrap' } });
  });

  it('a monster borrowed with Kukla İpi is a free tribute', () => {
    const mk = (borrowed: boolean) => {
      const s = scenario({ p0: { hand: ['magma_titan'], monsters: ['crystal_wyrm'] }, p1: { monsters: ['stone_sentinel'] } });
      if (borrowed) {
        const slot = s.players[0].monsters[0]!;
        s.cards[slot.uid].owner = 1;
        slot.borrowed = { owner: 1, until: 'endPhase', byUid: slot.uid };
      }
      return s;
    };
    const tributeSummon = (a: Action) => a.type === 'normalSummon' && a.tributes.length === 1;
    expect(tributeSummon(act(mk(false)))).toBe(false); // never feed my own 2800 wyrm to a 2100 titan
    expect(tributeSummon(act(mk(true)))).toBe(true); // the borrowed one goes back at the End Phase anyway
  });

  it('Kukla İpi takes the strongest opposing monster', () => {
    const s = scenario({ p0: { hand: ['puppet_string'] }, p1: { monsters: ['shade_assassin', 'crystal_wyrm'] } });
    const a = act(s) as Extract<Action, { type: 'activateSpell' }>;
    expect(idOf(s, a.uid)).toBe('puppet_string');
    expect(a.target).toMatchObject({ kind: 'monster', ref: { player: 1, index: 1 } });
  });

  it('Ruh Tasması is held back against a low-LP opponent (they would gain 1000 LP every Draw Phase)', () => {
    const leash = (lp: number) => {
      const s = scenario({ p0: { hand: ['soul_leash'] }, p1: { monsters: ['shade_assassin'], lp } });
      const a = act(s);
      return a.type === 'activateSpell' && idOf(s, a.uid) === 'soul_leash';
    };
    expect(leash(8000)).toBe(true);
    expect(leash(1500)).toBe(false);
  });

  it('Boşluk Gözü counts the Sovereign split: a Sovereign that comes back as three pieces is not worth the wipe', () => {
    const eye = (pieces: boolean) => {
      const s = scenario({
        p0: { hand: ['void_eye'] },
        p1: { monsters: ['polar_sovereign'], graveyard: pieces ? [...MAGNET_PIECE_IDS] : [] },
      });
      const a = act(s);
      return a.type === 'activateSpell' && idOf(s, a.uid) === 'void_eye';
    };
    expect(eye(false)).toBe(true);
    expect(eye(true)).toBe(false);
  });

  it('with the Sovereign in hand the third piece comes out and the fusion follows', () => {
    let s = scenario({ p0: { hand: ['polar_coil', 'crag_axeman', 'polar_sovereign'], monsters: ['polar_needle', 'polar_anvil'] } });
    const a = act(s);
    // summoned or set (a face-down piece is a valid fusion material too), never the stronger vanilla axeman
    expect(['normalSummon', 'setMonster']).toContain(a.type);
    expect(idOf(s, (a as Extract<Action, { type: 'normalSummon' | 'setMonster' }>).uid)).toBe('polar_coil');
    s = apply(s, a).state;
    while (s.pending) s = apply(s, act(s)).state; // the opponent's summon window
    const b = act(s);
    expect(b.type).toBe('specialSummon');
    expect(idOf(s, (b as Extract<Action, { type: 'specialSummon' }>).uid)).toBe('polar_sovereign');
  });

  it('Harman Eleği: the 2-card discard keeps the polar pieces when the fusion is close', () => {
    let s = scenario({
      p0: { hand: ['winnow_sieve', 'polar_coil', 'wisp_imp', 'healing_spring'], monsters: ['polar_needle', 'polar_anvil'], deck: ['stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'stone_sentinel'] },
    });
    s = apply(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'winnow_sieve', 0) } as Action).state;
    while (s.pending && s.pending.kind !== 'discard') s = apply(s, act(s)).state;
    expect(s.pending?.kind).toBe('discard');
    const d = act(s) as Extract<Action, { type: 'discard' }>;
    expect(d.uids).toHaveLength(2);
    expect(d.uids.map((u) => idOf(s, u))).not.toContain('polar_coil');
  });
});

describe('Mıknatıs preset', () => {
  it('is legal, holds the three pieces and one or two Sovereigns; no other preset runs a Sovereign', () => {
    const p = presetById('miknatis')!;
    expect(p.name).toBe('Mıknatıs');
    expect(validateDeck(p.cards).ok).toBe(true);
    for (const id of MAGNET_PIECE_IDS) expect(copiesOf(p.cards, id)).toBeGreaterThanOrEqual(2);
    expect(copiesOf(p.cards, 'polar_sovereign')).toBeGreaterThanOrEqual(1);
    expect(copiesOf(p.cards, 'polar_sovereign')).toBeLessThanOrEqual(2);
    for (const q of presetDecks()) if (q.id !== 'miknatis') expect(q.cards, q.id).not.toContain('polar_sovereign');
  });

  it('every preset respects the single-copy cards and stays out of the token', () => {
    for (const q of presetDecks()) {
      for (const id of SINGLE_COPY_IDS) expect(copiesOf(q.cards, id), `${q.id} ${id}`).toBeLessThanOrEqual(1);
      expect(q.cards).not.toContain('straw_decoy_token');
    }
    expect(PRESET_DEFS.map((d) => d.id)).toContain('miknatis');
  });
});

/** Plays a game to the end; returns the final state and every event. */
function playOut(decks: [CardId[], CardId[]], seed: number, zones: 3 | 5): { state: GameState; events: GameEvent[] } {
  const r = newGame({ seed, decks, zones });
  let state = r.state;
  const events: GameEvent[] = [...r.events];
  let cpu = (seed ^ 0x5bd1e995) >>> 0;
  for (let i = 0; i < 8000 && state.winner === null; i++) {
    const res = apply(state, chooseAction(state, cpu++));
    state = res.state;
    events.push(...res.events);
  }
  return { state, events };
}

describe('preset league: the CPU plays the new cards', () => {
  it('every preset pairing reaches a winner, and the new cards are played', () => {
    const list = presetDecks();
    const spells = new Set<CardId>();
    let fusions = 0;
    let coin = 0;
    let dice = 0;
    let control = 0;
    let mass = 0;
    let n = 0;
    for (const a of list)
      for (const b of list) {
        for (const zones of [3, 5] as const) {
          const { state, events } = playOut([a.cards, b.cards], 101 + n, zones);
          n++;
          expect(state.winner, `${a.id} vs ${b.id} (${zones})`).not.toBeNull();
          for (const e of events) {
            if (e.type === 'activate') {
              const d = CARDS[state.cards[e.uid]?.cardId ?? ('' as CardId)] ?? null;
              if (d && isSpell(d) && ALL_B2_SPELLS.has(d.id)) spells.add(d.id);
            }
            if (e.type === 'summon' && e.method === 'special' && e.cardId === 'polar_sovereign') fusions++;
            if (e.type === 'coinToss') coin++;
            if (e.type === 'diceRoll') dice++;
            if (e.type === 'controlChange' && e.reason === 'take') control++;
            if (e.type === 'massDestroy') mass++;
          }
        }
      }
    expect(fusions, 'Kutup Hükümdarı fused').toBeGreaterThan(0);
    expect(control, 'Kukla İpi / Ruh Tasması').toBeGreaterThan(0);
    expect(mass, 'Boşluk Gözü / Süpürge Rüzgarı / Kadran').toBeGreaterThan(0);
    expect(coin + dice, 'Kadran / Talih Zarı').toBeGreaterThan(0);
    // the draw spells, the wipes, the steals and both quick spells show up across the league
    for (const id of ['well_pail', 'puppet_string', 'soul_leash', 'auger_lance', 'straw_decoys', 'void_eye'] as CardId[])
      expect(spells.has(id), `${id} played`).toBe(true);
  }, 60000); // 98 full games: ~2 s alone, slower when the machine is busy
});

const ALL_B2_SPELLS = new Set<CardId>(
  (['well_pail', 'puppet_string', 'void_eye', 'sweeping_gale', 'winnow_sieve', 'auger_lance', 'soul_leash', 'straw_decoys', 'spite_axe', 'page_turner', 'lucky_die'] as CardId[]).filter(
    (id) => CARDS[id] && !isMonster(CARDS[id]),
  ),
);
