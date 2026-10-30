// dawn_swords (Şafak Kılıçları): continuous spell, counter 3, reveals the opponent's face-down monsters (no flip
// effect) and locks the opponent's attacks while it is face-up on the field.
import { describe, expect, it } from 'vitest';
import { apply, chooseAction, actingPlayer, legalActions, newGame, type Action, type GameEvent, type GameState, type PlayerId } from '../../src/engine';
import { CARDS, SPELL_IDS, type CardId } from '../../src/data/cards';
import { attackLocked } from '../../src/engine/query';
import { checkEvents, checkInvariants, isListed, scenario, uidOf } from './helpers';

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const endTurn = (p: PlayerId): Action => ({ type: 'endTurn', player: p });
const attack = (p: PlayerId, attackerZone: number, targetZone: number | null): Action => ({ type: 'attack', player: p, attackerZone, targetZone });

function step(s: GameState, a: Action): { state: GameState; events: GameEvent[] } {
  const r = apply(s, a);
  checkInvariants(r.state);
  checkEvents(r.state, r.events);
  return r;
}

/** Activate dawn_swords from hand of `p` (first free zone). */
function cast(s: GameState, p: PlayerId): { state: GameState; events: GameEvent[] } {
  const uid = uidOf(s, 'dawn_swords', p);
  const a = legalActions(s).find((x) => x.type === 'activateSpell' && x.uid === uid)!;
  expect(a).toBeTruthy();
  return step(s, a);
}

/** Plays through the end of p's turn and the opponent's whole next turn up to its battle phase. */
function toOpponentBattle(s: GameState, p: PlayerId): GameState {
  let st = step(s, endTurn(p)).state; // opponent's turn starts (draw -> main)
  while (st.pending) st = step(st, legalActions(st)[0]).state;
  const o = other(p);
  expect(st.activePlayer).toBe(o);
  const enter = legalActions(st).find((x) => x.type === 'enterBattle');
  return enter ? step(st, enter).state : st;
}

const BOARD = (zones: 3 | 5) => ({ zones, turn: 3 });

describe('dawn_swords data', () => {
  it('is a continuous spell with the Turkish name and text, listed in SPELL_IDS', () => {
    const d = CARDS.dawn_swords as { spellType: string; effect: string; name: string; text: string };
    expect(d.spellType).toBe('continuous');
    expect(d.effect).toBe('attackLock3');
    expect(d.name).toBe('Şafak Kılıçları');
    expect(d.text).toBe('Rakibin tüm kapalı canavarlarını aç. Bu kart sahadayken rakibin canavarları saldıramaz. Rakibin 3. turunun sonunda bu kart yok olur.');
    expect(SPELL_IDS).toContain('dawn_swords');
  });
});

for (const zones of [3, 5] as const) {
  describe(`dawn_swords, ${zones}+${zones} zones`, () => {
    const mk = (extra: { p0?: object; p1?: object } = {}) =>
      scenario({
        ...BOARD(zones),
        p0: { hand: ['dawn_swords'], monsters: ['stone_sentinel'], ...(extra.p0 ?? {}) },
        p1: { monsters: [{ id: 'thorn_lurker', faceUp: false, position: 'defense' }, 'ember_wolf', { id: 'tide_golem', faceUp: false, position: 'defense' }], ...(extra.p1 ?? {}) },
      });

    it('reveal flips only face-down monsters, tags the flip as reveal and triggers no flip effect', () => {
      const s = mk();
      const wolfSlot = s.players[1].monsters[1]!;
      const r = cast(s, 0);
      const flips = r.events.filter((e): e is Extract<GameEvent, { type: 'flip' }> => e.type === 'flip');
      expect(flips.map((f) => f.zone)).toEqual([0, 2]);
      expect(flips.every((f) => f.cause === 'reveal' && f.player === 1 && f.sourceUid === uidOf(s, 'dawn_swords', 0))).toBe(true);
      expect(r.state.players[1].monsters.every((m) => !m || m.faceUp)).toBe(true);
      expect(r.state.players[1].monsters[1]).toEqual(wolfSlot); // already face-up: untouched
      expect(r.state.players[1].monsters[0]!.position).toBe('defense');
      // thorn_lurker has a flip effect: no chooseTarget / decision, no destroy
      expect(r.state.pending).toBeNull();
      expect(r.events.some((e) => e.type === 'decision' || e.type === 'destroy' || e.type === 'summon')).toBe(false);
      // the spell sits face-up with counter 3
      const slot = r.state.players[0].spellTraps.find((x) => x?.uid === uidOf(s, 'dawn_swords', 0))!;
      expect(slot.faceUp).toBe(true);
      expect(slot.counter).toBe(3);
      const act = r.events.find((e) => e.type === 'activate')!;
      expect(act.type === 'activate' && act.zone).not.toBeNull();
      expect(r.events.find((e) => e.type === 'counter')).toMatchObject({ type: 'counter', player: 0, value: 3, prev: 0 });
    });

    it('can be set and flipped later; set activation needs no zone', () => {
      const s = scenario({
        ...BOARD(zones),
        p0: { monsters: ['stone_sentinel'], spellTraps: ['dawn_swords'] },
        p1: { monsters: [{ id: 'thorn_lurker', faceUp: false, position: 'defense' }] },
      });
      const a = legalActions(s).find((x) => x.type === 'activateSpell')!;
      expect(a.type === 'activateSpell' && a.zone).toBeUndefined();
      const r = step(s, a);
      expect(r.state.players[0].spellTraps[0]!.counter).toBe(3);
      expect(r.state.players[1].monsters[0]!.faceUp).toBe(true);
    });

    it('opponent cannot attack: no attack action for any monster, also for later summons; own monsters may attack', () => {
      let s = cast(mk({ p1: { hand: ['storm_hawk'], monsters: ['ember_wolf'] } as object }), 0).state;
      expect(attackLocked(s, 1)).toBe(true);
      expect(attackLocked(s, 0)).toBe(false);
      // own monster can still attack this turn (battle phase of the caster)
      const own = step(s, legalActions(s).find((x) => x.type === 'enterBattle')!).state;
      expect(legalActions(own).some((x) => x.type === 'attack')).toBe(true);
      // opponent's turn: nothing legal, even after summoning a new monster
      s = step(s, endTurn(0)).state;
      while (s.pending) s = step(s, legalActions(s)[0]).state;
      const summon = legalActions(s).find((x) => x.type === 'normalSummon')!;
      s = step(s, summon).state;
      s = step(s, legalActions(s).find((x) => x.type === 'enterBattle')!).state;
      expect(legalActions(s).some((x) => x.type === 'attack')).toBe(false);
      expect(isListed(s, attack(1, 0, 0))).toBe(false);
      expect(() => apply(s, attack(1, 0, 0))).toThrow();
    });

    it('counter 3: gone after the opponent\'s 3rd turn end, not before; owner turns do not tick', () => {
      let s = cast(mk(), 0).state;
      const uid = uidOf(s, 'dawn_swords', 0);
      const counterOf = (st: GameState) => st.players[0].spellTraps.find((x) => x?.uid === uid)?.counter;
      const gone = (st: GameState) => st.players[0].graveyard.includes(uid);
      const evAll: GameEvent[] = [];
      const finishTurn = (st: GameState, p: PlayerId): GameState => {
        // advance with endTurn through pending decisions until the turn passes to the other player
        let cur = st;
        const r = step(cur, endTurn(p));
        evAll.push(...r.events);
        cur = r.state;
        while (cur.pending) {
          const rr = step(cur, legalActions(cur)[0]);
          evAll.push(...rr.events);
          cur = rr.state;
        }
        return cur;
      };
      s = finishTurn(s, 0); // end of owner's turn: no tick
      expect(counterOf(s)).toBe(3);
      s = finishTurn(s, 1); // opp turn 1
      expect(counterOf(s)).toBe(2);
      s = finishTurn(s, 0);
      expect(counterOf(s)).toBe(2);
      s = finishTurn(s, 1); // opp turn 2
      expect(counterOf(s)).toBe(1);
      expect(attackLocked(s, 1)).toBe(true);
      s = finishTurn(s, 0);
      s = finishTurn(s, 1); // opp turn 3
      expect(gone(s)).toBe(true);
      expect(attackLocked(s, 1)).toBe(false);
      const counters = evAll.filter((e) => e.type === 'counter').map((e) => (e as { value: number }).value);
      expect(counters).toEqual([2, 1, 0]);
      const i = evAll.findIndex((e) => e.type === 'destroy' && e.uid === uid);
      expect(evAll[i]).toMatchObject({ reason: 'rule', location: 'spellTrap' });
      expect(evAll[i + 1]).toMatchObject({ type: 'toGraveyard', uid, from: 'spellTrap' });
    });

    it('destroyed early by Arınma Dalgası: the lock ends immediately', () => {
      let s = cast(mk({ p1: { hand: ['purging_wave'], monsters: ['ember_wolf'] } as object }), 0).state;
      s = step(s, endTurn(0)).state;
      while (s.pending) s = step(s, legalActions(s)[0]).state;
      const uid = uidOf(s, 'dawn_swords', 0);
      const wave = legalActions(s).find((x) => x.type === 'activateSpell' && x.target?.kind === 'card' && x.target.ref.player === 0)!;
      s = step(s, wave).state;
      expect(s.players[0].graveyard).toContain(uid);
      expect(attackLocked(s, 1)).toBe(false);
      s = step(s, legalActions(s).find((x) => x.type === 'enterBattle')!).state;
      expect(legalActions(s).some((x) => x.type === 'attack')).toBe(true);
    });

    it('state with the counter survives structuredClone and JSON round trips', () => {
      const s = cast(mk(), 0).state;
      const c = structuredClone(s);
      const j = JSON.parse(JSON.stringify(s)) as GameState;
      for (const x of [c, j]) {
        expect(x.players[0].spellTraps.find((t) => t?.uid === uidOf(s, 'dawn_swords', 0))!.counter).toBe(3);
        expect(attackLocked(x, 1)).toBe(true);
        const r = apply(x, endTurn(0));
        expect(r.state.players[0].spellTraps.some((t) => t?.counter === 3)).toBe(true);
      }
    });
  });
}

describe('dawn_swords and the bot', () => {
  it('bot plays it when behind, and never emits an attack under a lock (full bot games with the card in hand)', () => {
    let played = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const zones = seed % 2 ? 3 : 5;
      const deck = (extra: CardId[]): CardId[] => [...extra, ...Array.from({ length: 20 - extra.length }, () => 'stone_sentinel' as CardId)];
      let s = newGame({ seed, zones, noShuffle: false, decks: [deck(['dawn_swords', 'ember_wolf', 'thorn_lurker', 'tide_golem']), deck(['dawn_swords', 'magma_titan', 'crystal_wyrm', 'storm_hawk'])] }).state;
      for (let i = 0; i < 700 && s.winner === null; i++) {
        const a = chooseAction(s, seed + i);
        expect(isListed(s, a)).toBe(true);
        if (a.type === 'attack') expect(attackLocked(s, a.player)).toBe(false);
        if (a.type === 'activateSpell' && CARDS[s.cards[a.uid].cardId].id === 'dawn_swords') played++;
        const r = apply(s, a);
        checkInvariants(r.state);
        s = r.state;
        void actingPlayer;
      }
    }
    expect(played).toBeGreaterThan(0);
  }, 120_000);
});
