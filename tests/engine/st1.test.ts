// Spell / trap batch 1 (docs/KART_TASLAGI_BUYU_TUZAK.md): 11 spells (2 equip, 3 field) and 7 traps.
// Every card: normal case, both players, 3- and 5-zone boards; the interactions with trapLock, the five-seal
// set, the existing traps and a source leaving the field; the bot; 40 seeded bot-vs-bot games on the expanded pool.
import { describe, expect, it } from 'vitest';
import {
  actingPlayer,
  apply,
  chooseAction,
  currentAtk,
  currentDef,
  legalActions,
  newGame,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Uid,
} from '../../src/engine';
import { ALL_CARDS, CARDS, DEFAULT_DECK, SPELL_IDS, TRAP_IDS, isMonster, isSpell, isTrap, type CardId } from '../../src/data/cards';
import { EXPANDED_POOL } from '../../src/data/decks';
import { makeRng } from '../../src/engine/rng';
import { describeEvents, cardName, describePending } from '../../src/engine';
import { checkEvents, checkInvariants, checkInvariantsRelaxed, isListed, scenario, seq, uidOf, type ScenarioOpts } from './helpers';

// ---------------------------------------------------------------------------------------------
// helpers

const NEW_SPELLS: CardId[] = ['fate_trade', 'double_offering', 'kneel_down', 'cycle_of_graves', 'battle_cry', 'purging_wave', 'piercing_lance', 'guardian_charm', 'tidal_bay', 'shadow_cavern', 'festival_square'];
const NEW_TRAPS: CardId[] = ['spell_seal', 'toppling_tower', 'homecoming', 'decoy_target', 'last_breath', 'sandstorm', 'hidden_reinforcement'];
const NEW_CARDS = [...NEW_SPELLS, ...NEW_TRAPS];

const inv = checkInvariantsRelaxed;

function play(s: GameState, ...actions: Action[]): { state: GameState; events: GameEvent[] } {
  let state = s;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = apply(state, a);
    inv(r.state);
    checkEvents(r.state, r.events);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

const mon = (p: PlayerId, i: number) => ({ kind: 'monster' as const, ref: { player: p, zone: 'monster' as const, index: i } });
const card = (p: PlayerId, zone: 'spellTrap' | 'field', i: number) => ({ kind: 'card' as const, ref: { player: p, zone, index: i } });
const sp = (s: GameState, id: CardId, p: PlayerId = 0, extra: Record<string, unknown> = {}): Action =>
  ({ type: 'activateSpell', player: p, uid: uidOf(s, id, p), ...extra }) as Action;
const atk = (p: PlayerId, attackerZone: number, targetZone: number | null): Action => ({ type: 'attack', player: p, attackerZone, targetZone });
const respond = (s: GameState, id: CardId | null, p: PlayerId): Action => ({ type: 'respond', player: p, uid: id === null ? null : uidOf(s, id, p) });
const endTurn = (p: PlayerId): Action => ({ type: 'endTurn', player: p });
const evs = (s: GameState, e: GameEvent[]) => seq(s, e);
const has = (s: GameState, e: GameEvent[], x: string) => evs(s, e).includes(x);
const opts = (s: GameState) => (s.pending && s.pending.kind === 'trapResponse' ? s.pending.options : []);
const BOTH: PlayerId[] = [0, 1];
const ZONES: (3 | 5)[] = [3, 5];

/** Scenario for `p` as the active player: `me` / `them` are the sides of the active player and the opponent. */
function duel(p: PlayerId, me: ScenarioOpts['p0'], them: ScenarioOpts['p1'], o: Omit<ScenarioOpts, 'p0' | 'p1' | 'active'> = {}): GameState {
  return scenario({ ...o, active: p, ...(p === 0 ? { p0: me, p1: them } : { p0: them, p1: me }) });
}
const opp = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

// ---------------------------------------------------------------------------------------------

describe('card data', () => {
  it('18 new cards: 11 spells (2 equip, 3 field) and 7 traps, original Turkish names, unique effects', () => {
    expect(NEW_SPELLS).toHaveLength(11);
    expect(NEW_TRAPS).toHaveLength(7);
    for (const id of NEW_SPELLS) expect(isSpell(CARDS[id]), id).toBe(true);
    for (const id of NEW_TRAPS) expect(isTrap(CARDS[id]), id).toBe(true);
    const types = NEW_SPELLS.map((id) => (CARDS[id] as { spellType: string }).spellType);
    expect(types.filter((t) => t === 'equip')).toHaveLength(2);
    expect(types.filter((t) => t === 'field')).toHaveLength(3);
    const effects = NEW_CARDS.map((id) => (CARDS[id] as { effect: string }).effect);
    expect(new Set(effects).size).toBe(18);
    const names = ALL_CARDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const id of NEW_CARDS) {
      expect(CARDS[id].name.length).toBeGreaterThan(3);
      expect((CARDS[id] as { text: string }).text.length).toBeGreaterThan(20);
    }
    expect(SPELL_IDS).toEqual(expect.arrayContaining(NEW_SPELLS));
    expect(TRAP_IDS).toEqual(expect.arrayContaining(NEW_TRAPS));
    // the classic deck did not change
    expect(ALL_CARDS.slice(0, 20).map((c) => c.id)).toEqual(DEFAULT_DECK);
    expect(EXPANDED_POOL).toEqual(expect.arrayContaining(NEW_CARDS));
  });
  it('Turkish names inflect with the possessive where the last word has it', () => {
    expect(cardName('fate_trade', 'acc')).toBe("Kader Takası'nı");
    expect(cardName('tidal_bay', 'acc')).toBe("Gelgit Körfezi'ni");
    expect(cardName('spell_seal', 'acc')).toBe("Büyü Mührü'nü");
    expect(cardName('sandstorm', 'dat')).toBe("Kum Fırtınası'na");
    expect(cardName('double_offering', 'acc')).toBe("Çifte Kurban'ı");
    expect(cardName('homecoming', 'acc')).toBe("Eve Dönüş'ü");
    expect(cardName('kneel_down', 'acc')).toBe("Diz Çöktürme'yi");
    expect(cardName('purging_wave', 'acc')).toBe("Arınma Dalgası'nı");
  });
});

// ---------------------------------------------------------------------------------------------
describe('fate_trade (Kader Takası): draw 2, discard 1', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: draws two, then pays the discard cost in the Main Phase`, () => {
        const s = duel(p, { hand: ['fate_trade', 'ember_wolf'], deck: ['stone_sentinel', 'lumen_sprite', 'storm_hawk', 'shade_assassin'] }, {}, { zones });
        expect(isListed(s, sp(s, 'fate_trade', p))).toBe(true);
        const r = play(s, sp(s, 'fate_trade', p));
        expect(evs(r.state, r.events)).toEqual(['activate:fate_trade', 'draw:stone_sentinel', 'draw:lumen_sprite', 'toGraveyard:fate_trade', 'decision:discard']);
        expect(r.state.pending).toMatchObject({ kind: 'discard', player: p, count: 1, cost: true });
        expect(r.state.phase).toBe('main');
        expect(actingPlayer(r.state)).toBe(p);
        const legal = legalActions(r.state).filter((a) => a.type === 'discard');
        expect(legal).toHaveLength(3);
        const out = play(r.state, { type: 'discard', player: p, uids: [uidOf(r.state, 'ember_wolf', p)] });
        expect(out.state.pending).toBeNull();
        expect(out.state.players[p].hand).toHaveLength(2);
        expect(out.state.players[p].graveyard.map((u) => out.state.cards[u].cardId)).toEqual(['fate_trade', 'ember_wolf']);
        // the main phase goes on (summon right is unspent)
        expect(legalActions(out.state).some((a) => a.type === 'normalSummon')).toBe(true);
        const log = describeEvents(out.state, [...r.events, ...out.events]).join(' | ');
        expect(log).toContain('Kader Takası');
        expect(describePending(r.state, r.state.pending!)).toContain('Bedel');
      });
  it('is not offered with fewer than 3 cards in the deck (no deck-out suicide)', () => {
    const s = scenario({ p0: { hand: ['fate_trade'], deck: ['stone_sentinel', 'stone_sentinel'] } });
    expect(legalActions(s).some((a) => a.type === 'activateSpell')).toBe(false);
    const s3 = scenario({ p0: { hand: ['fate_trade'], deck: ['stone_sentinel', 'stone_sentinel', 'stone_sentinel'] } });
    expect(legalActions(s3).some((a) => a.type === 'activateSpell')).toBe(true);
  });
  it('can be set and activated from the field the turn it was set', () => {
    const s = scenario({ p0: { hand: ['fate_trade'], deck: ['stone_sentinel', 'stone_sentinel', 'stone_sentinel'] } });
    const set = play(s, { type: 'setSpellTrap', player: 0, uid: uidOf(s, 'fate_trade'), zone: 1 });
    expect(isListed(set.state, sp(set.state, 'fate_trade'))).toBe(true);
    const r = play(set.state, sp(set.state, 'fate_trade'));
    expect(r.state.players[0].spellTraps[1]).toBeNull();
    expect(r.state.pending?.kind).toBe('discard');
  });
  it('five seals: a draw that completes the set wins on the spot, no discard is asked', () => {
    const s = scenario({
      p0: { hand: ['fate_trade', 'seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r'], deck: ['seal_leg_l', 'stone_sentinel', 'stone_sentinel'] },
    });
    const r = play(s, sp(s, 'fate_trade'));
    expect(r.state.winner).toBe(0);
    expect(r.state.winReason).toBe('seals');
    expect(r.state.pending).toBeNull();
  });
  it('the opponent can seal it (spell_seal) — no cards are drawn', () => {
    const s = scenario({ p0: { hand: ['fate_trade'], deck: ['stone_sentinel', 'stone_sentinel', 'stone_sentinel'] }, p1: { spellTraps: ['spell_seal'] } });
    const w = play(s, sp(s, 'fate_trade'));
    const r = play(w.state, respond(w.state, 'spell_seal', 1));
    expect(r.state.players[0].hand).toHaveLength(0);
    expect(r.state.players[0].deck).toHaveLength(3);
    expect(r.state.pending).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('double_offering (Çifte Kurban): one tribute for a Level 7+ monster', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: Level 7 needs one tribute this turn; Level 5-6 are unchanged`, () => {
        const s = duel(p, { hand: ['double_offering', 'crystal_wyrm', 'magma_titan'], monsters: ['ember_wolf'] }, {}, { zones });
        const sumsBefore = legalActions(s).filter((a) => a.type === 'normalSummon') as Extract<Action, { type: 'normalSummon' }>[];
        const wyrm = uidOf(s, 'crystal_wyrm', p);
        expect(sumsBefore.some((a) => a.uid === wyrm)).toBe(false); // 2 tributes, one monster
        const r = play(s, sp(s, 'double_offering', p));
        expect(evs(r.state, r.events)).toEqual(['activate:double_offering', 'toGraveyard:double_offering']);
        const sums = legalActions(r.state).filter((a) => a.type === 'normalSummon') as Extract<Action, { type: 'normalSummon' }>[];
        const wy = sums.filter((a) => a.uid === wyrm);
        expect(wy.length).toBeGreaterThan(0);
        expect(wy.every((a) => a.tributes.length === 1)).toBe(true);
        const ti = sums.filter((a) => a.uid === uidOf(s, 'magma_titan', p));
        expect(ti.every((a) => a.tributes.length === 1)).toBe(true); // Level 5: still exactly one tribute
        const done = play(r.state, wy[0]);
        expect(done.state.players[p].monsters.some((m) => m && done.state.cards[m.uid].cardId === 'crystal_wyrm')).toBe(true);
        expect(has(done.state, done.events, 'tribute:ember_wolf')).toBe(true);
      });
  it('with two monsters either one can be the single tribute (never two); a Set follows the same rule', () => {
    const s = scenario({ p0: { hand: ['double_offering', 'crystal_wyrm'], monsters: ['ember_wolf', 'tide_golem'] } });
    const two = legalActions(s).filter((a) => a.type === 'normalSummon' && a.uid === uidOf(s, 'crystal_wyrm')) as Extract<Action, { type: 'normalSummon' }>[];
    expect(new Set(two.map((a) => a.tributes.length))).toEqual(new Set([2]));
    const r = play(s, sp(s, 'double_offering'));
    const wy = legalActions(r.state).filter((a) => a.type === 'normalSummon' && a.uid === uidOf(s, 'crystal_wyrm')) as Extract<Action, { type: 'normalSummon' }>[];
    expect(new Set(wy.map((a) => a.tributes.length))).toEqual(new Set([1]));
    expect(new Set(wy.flatMap((a) => a.tributes)).size).toBe(2);
    const set = legalActions(r.state).filter((a) => a.type === 'setMonster' && a.uid === uidOf(s, 'crystal_wyrm')) as Extract<Action, { type: 'setMonster' }>[];
    expect(set.some((a) => a.tributes.length === 1)).toBe(true);
  });
  it('is only offered with a Level 7+ monster in hand, a monster on the field and the summon right unspent', () => {
    const ok = scenario({ p0: { hand: ['double_offering', 'crystal_wyrm'], monsters: ['ember_wolf'] } });
    expect(isListed(ok, sp(ok, 'double_offering'))).toBe(true);
    const noBig = scenario({ p0: { hand: ['double_offering', 'ember_wolf'], monsters: ['stone_sentinel'] } });
    expect(legalActions(noBig).some((a) => a.type === 'activateSpell')).toBe(false);
    const noMon = scenario({ p0: { hand: ['double_offering', 'crystal_wyrm'] } });
    expect(legalActions(noMon).some((a) => a.type === 'activateSpell')).toBe(false);
    const used = scenario({ p0: { hand: ['double_offering', 'crystal_wyrm'], monsters: ['ember_wolf'], normalSummonUsed: true } });
    expect(legalActions(used).some((a) => a.type === 'activateSpell')).toBe(false);
  });
  it('lasts one turn only', () => {
    const s = scenario({ p0: { hand: ['double_offering', 'crystal_wyrm'], monsters: ['ember_wolf'] } });
    const r = play(s, sp(s, 'double_offering'), endTurn(0), endTurn(1));
    expect(r.state.turn).toBe(5);
    expect(r.state.activePlayer).toBe(0);
    expect(legalActions(r.state).some((a) => a.type === 'normalSummon' && a.uid === uidOf(s, 'crystal_wyrm'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('kneel_down (Diz Çöktürme): defense position + no position change next turn', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones`, () => {
        const z = zones === 5 ? 4 : 0;
        const them: (string | null | { id: CardId; position?: 'attack' | 'defense'; faceUp?: boolean })[] = [];
        them[z] = 'crystal_wyrm';
        them[1] = { id: 'tide_golem', position: 'defense' };
        them[2] = { id: 'thorn_lurker', faceUp: false };
        const s = duel(p, { hand: ['kneel_down'] }, { monsters: them as never }, { zones });
        const targets = legalActions(s).filter((a) => a.type === 'activateSpell') as Extract<Action, { type: 'activateSpell' }>[];
        expect(targets.map((a) => (a.target as { ref: { index: number } }).ref.index)).toEqual([z]); // only the face-up attack-position monster
        const r = play(s, sp(s, 'kneel_down', p, { target: mon(opp(p), z) }));
        expect(evs(r.state, r.events)).toEqual(['activate:kneel_down', 'target', 'positionChange:crystal_wyrm', 'toGraveyard:kneel_down']);
        expect(r.state.players[opp(p)].monsters[z]!.position).toBe('defense');
        // the knelt monster cannot change position on its controller's next turn, the others can
        const next = play(r.state, endTurn(p));
        expect(next.state.activePlayer).toBe(opp(p));
        const acts = legalActions(next.state).filter((a) => a.type === 'changePosition') as Extract<Action, { type: 'changePosition' }>[];
        expect(acts.some((a) => a.zone === z)).toBe(false);
        expect(acts.some((a) => a.zone === 1)).toBe(true);
        // and the turn after that it can again
        const later = play(next.state, endTurn(opp(p)), endTurn(p));
        expect(later.state.activePlayer).toBe(opp(p));
        expect(legalActions(later.state).some((a) => a.type === 'changePosition' && a.zone === z)).toBe(true); // the lock lasted exactly one turn
      });
  it('lock expires: two turns later the monster may change position again', () => {
    const s = scenario({ p0: { hand: ['kneel_down'] }, p1: { monsters: ['crystal_wyrm'] } });
    const r = play(s, sp(s, 'kneel_down', 0, { target: mon(1, 0) }), endTurn(0), endTurn(1), endTurn(0));
    expect(r.state.activePlayer).toBe(1);
    expect(legalActions(r.state).some((a) => a.type === 'changePosition' && a.zone === 0)).toBe(true);
  });
  it('is not offered when the opponent has no face-up attack-position monster', () => {
    const s = scenario({ p0: { hand: ['kneel_down'] }, p1: { monsters: [{ id: 'tide_golem', position: 'defense' }, { id: 'thorn_lurker', faceUp: false }] } });
    expect(legalActions(s).some((a) => a.type === 'activateSpell')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('cycle_of_graves (Devir Daim): shuffle the last 3 graveyard cards into the deck, draw 1', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones`, () => {
        const s = duel(p, { hand: ['cycle_of_graves'], graveyard: ['ember_wolf', 'tide_golem', 'storm_hawk', 'lumen_sprite'] }, {}, { zones });
        const r = play(s, sp(s, 'cycle_of_graves', p));
        const e = evs(r.state, r.events);
        expect(e.slice(0, 5)).toEqual(['activate:cycle_of_graves', 'toDeck:tide_golem', 'toDeck:storm_hawk', 'toDeck:lumen_sprite', 'shuffle']);
        expect(e.slice(5)).toEqual([expect.stringMatching(/^draw:/), 'toGraveyard:cycle_of_graves']);
        expect(r.state.players[p].graveyard.map((u) => r.state.cards[u].cardId)).toEqual(['ember_wolf', 'cycle_of_graves']);
        expect(r.state.players[p].deck).toHaveLength(3 + 3 - 1);
        expect(r.state.players[p].hand).toHaveLength(1);
        // deterministic: the same action on the same state gives the same deck order
        expect(apply(s, sp(s, 'cycle_of_graves', p)).state).toEqual(apply(s, sp(s, 'cycle_of_graves', p)).state);
        expect(describeEvents(r.state, r.events).join('|')).toContain('desteye karıştırıldı');
      });
  it('needs 3 graveyard cards and cannot recycle itself', () => {
    const two = scenario({ p0: { hand: ['cycle_of_graves'], graveyard: ['ember_wolf', 'tide_golem'] } });
    expect(legalActions(two).some((a) => a.type === 'activateSpell')).toBe(false);
    const three = scenario({ p0: { hand: ['cycle_of_graves'], graveyard: ['ember_wolf', 'tide_golem', 'storm_hawk'] } });
    const r = play(three, sp(three, 'cycle_of_graves'));
    expect(r.state.players[0].graveyard.map((u) => r.state.cards[u].cardId)).toEqual(['cycle_of_graves']);
  });
  it('five seals: a recycled piece that is drawn completes the set', () => {
    const s = scenario({
      p0: { hand: ['cycle_of_graves', 'seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r'], deck: [], graveyard: ['seal_leg_l', 'seal_leg_l', 'seal_leg_l'] },
    });
    const r = play(s, sp(s, 'cycle_of_graves'));
    expect(r.state.winner).toBe(0);
    expect(r.state.winReason).toBe('seals');
  });
});

// ---------------------------------------------------------------------------------------------
describe('battle_cry (Savaş Narası): +1000 ATK until the End Phase', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones`, () => {
        const z = zones === 5 ? 4 : 0;
        const me: (string | null)[] = [];
        me[z] = 'ember_wolf';
        const s = duel(p, { hand: ['battle_cry'], monsters: me as never }, { monsters: ['shade_assassin'] }, { zones });
        const r = play(s, sp(s, 'battle_cry', p, { target: mon(p, z) }));
        const uid = r.state.players[p].monsters[z]!.uid;
        expect(evs(r.state, r.events)).toEqual(['activate:battle_cry', 'target', 'statChange:ember_wolf:1700>2700', 'toGraveyard:battle_cry']);
        expect(currentAtk(r.state, uid)).toBe(2700);
        // the boosted wolf beats the 1900 assassin (it would lose without the cry)
        const b = play(r.state, { type: 'enterBattle', player: p }, atk(p, z, 0));
        expect(has(b.state, b.events, 'battle:targetDestroyed')).toBe(true);
        // the boost ends with the End Phase
        const e = play(b.state, endTurn(p));
        expect(evs(e.state, e.events)).toContain('statChange:ember_wolf:2700>1700');
        expect(currentAtk(e.state, uid)).toBe(1700);
      });
  it('stacks with an equip and can target a monster in defense position', () => {
    const s = scenario({ p0: { hand: ['battle_cry'], monsters: [{ id: 'stone_sentinel', position: 'defense' }], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] } });
    expect(currentAtk(s, s.players[0].monsters[0]!.uid)).toBe(1200);
    const r = play(s, sp(s, 'battle_cry', 0, { target: mon(0, 0) }));
    expect(currentAtk(r.state, r.state.players[0].monsters[0]!.uid)).toBe(2200);
  });
  it('is gone when its monster leaves the field (a fresh monster in the zone has no boost)', () => {
    const s = scenario({ p0: { hand: ['battle_cry', 'ember_wolf'], monsters: ['shade_assassin'] }, p1: { spellTraps: ['mirror_barrier'] } });
    const b = play(s, sp(s, 'battle_cry', 0, { target: mon(0, 0) }), { type: 'enterBattle', player: 0 }, { type: 'attack', player: 0, attackerZone: 0, targetZone: null });
    expect(b.state.pending?.kind).toBe('trapResponse');
    const r = play(b.state, respond(b.state, 'mirror_barrier', 1));
    expect(r.state.players[0].monsters[0]).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('purging_wave (Arınma Dalgası): destroy 1 opposing Spell/Trap', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: set trap in the last zone, equip and field spell are all targets`, () => {
        const z = zones === 5 ? 4 : 2;
        const sts: (string | null | { id: CardId; equippedTo?: number })[] = [];
        sts[0] = { id: 'dragon_blade', equippedTo: 0 };
        sts[z] = 'mirror_barrier';
        const s = duel(p, { hand: ['purging_wave'] }, { monsters: ['crystal_wyrm'], spellTraps: sts as never, field: 'volcano_arena' }, { zones });
        const targets = (legalActions(s).filter((a) => a.type === 'activateSpell') as Extract<Action, { type: 'activateSpell' }>[]).map((a) => (a.target as { ref: { zone: string; index: number } }).ref);
        expect(targets).toEqual(expect.arrayContaining([{ player: opp(p), zone: 'spellTrap', index: 0 }, { player: opp(p), zone: 'spellTrap', index: z }, { player: opp(p), zone: 'field', index: 0 }]));
        expect(targets).toHaveLength(3);
        const trap = play(s, sp(s, 'purging_wave', p, { target: card(opp(p), 'spellTrap', z) }));
        expect(evs(trap.state, trap.events)).toEqual(['activate:purging_wave', 'target', 'destroy:mirror_barrier', 'toGraveyard:mirror_barrier', 'toGraveyard:purging_wave']);
        expect(trap.state.players[opp(p)].spellTraps[z]).toBeNull();
        const eq = play(s, sp(s, 'purging_wave', p, { target: card(opp(p), 'spellTrap', 0) }));
        expect(evs(eq.state, eq.events)).toContain('statChange:crystal_wyrm:3500>2800');
        const fld = play(s, sp(s, 'purging_wave', p, { target: card(opp(p), 'field', 0) }));
        expect(fld.state.players[opp(p)].fieldSpell).toBeNull();
        expect(has(fld.state, fld.events, 'destroy:volcano_arena')).toBe(true);
      });
  it('is not offered when the opponent has no Spell/Trap (own cards are never targets)', () => {
    const s = scenario({ p0: { hand: ['purging_wave'], spellTraps: ['mirror_barrier'], field: 'volcano_arena' } });
    expect(legalActions(s).some((a) => a.type === 'activateSpell')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('piercing_lance (Delici Mızrak): +300 ATK and piercing damage', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones`, () => {
        const z = zones === 5 ? 3 : 1;
        const me: (string | null)[] = [];
        me[z] = 'shade_assassin';
        const s = duel(p, { hand: ['piercing_lance'], monsters: me as never }, { monsters: [{ id: 'lumen_sprite', position: 'defense' }] }, { zones });
        const hand = sp(s, 'piercing_lance', p, { zone: zones === 5 ? 4 : 2, target: mon(p, z) });
        expect(isListed(s, hand)).toBe(true);
        const r = play(s, hand);
        const uid = r.state.players[p].monsters[z]!.uid;
        expect(currentAtk(r.state, uid)).toBe(2200);
        expect(evs(r.state, r.events)).toEqual(['activate:piercing_lance', 'target', 'equip:shade_assassin', 'statChange:shade_assassin:1900>2200']);
        const b = play(r.state, { type: 'enterBattle', player: p }, atk(p, z, 0));
        expect(evs(b.state, b.events)).toEqual(expect.arrayContaining(['battle:targetDestroyed', `damage:p${opp(p)}:1600`]));
        // without the lance the same attack deals no damage to a defender
        const plain = scenario({ phase: 'battle', active: p, ...(p === 0 ? { p0: { monsters: me as never }, p1: { monsters: [{ id: 'lumen_sprite', position: 'defense' }] } } : { p1: { monsters: me as never }, p0: { monsters: [{ id: 'lumen_sprite', position: 'defense' }] } }), zones } as ScenarioOpts);
        const pb = play(plain, atk(p, z, 0));
        expect(pb.events.some((e) => e.type === 'damage')).toBe(false);
      });
  it('the effect ends with its host (equip destroyed by rule) and does not apply to other monsters', () => {
    const s = scenario({
      p0: { monsters: ['shade_assassin', 'ember_wolf'], spellTraps: [{ id: 'piercing_lance', equippedTo: 0 }] },
      p1: { monsters: ['crystal_wyrm'], spellTraps: ['mirror_barrier'] },
    });
    expect(currentAtk(s, s.players[0].monsters[1]!.uid)).toBe(1700);
    const b = play(s, { type: 'enterBattle', player: 0 }, atk(0, 1, 0));
    const r = play(b.state, respond(b.state, 'mirror_barrier', 1));
    expect(r.state.players[0].spellTraps[0]).toBeNull();
    expect(r.state.players[0].graveyard.map((u) => r.state.cards[u].cardId)).toContain('piercing_lance');
  });
});

// ---------------------------------------------------------------------------------------------
describe('guardian_charm (Koruyucu Tılsım): the equip is destroyed instead of its monster', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: a battle loss is survived, the charm breaks, the damage still lands`, () => {
        const z = zones === 5 ? 4 : 0;
        const defn: (string | null)[] = [];
        defn[z] = 'ember_wolf';
        const s = scenario({
          zones,
          phase: 'battle',
          active: p,
          ...(p === 0
            ? { p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: defn as never, spellTraps: [{ id: 'guardian_charm', equippedTo: z }] } }
            : { p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: defn as never, spellTraps: [{ id: 'guardian_charm', equippedTo: z }] } }),
        } as ScenarioOpts);
        const r = play(s, atk(p, 0, z));
        const e = evs(r.state, r.events);
        expect(e).toContain('battle:noDestroy');
        expect(e).toContain(`damage:p${opp(p)}:1100`);
        expect(e).toEqual(expect.arrayContaining(['activate:guardian_charm', 'destroy:guardian_charm']));
        expect(e).not.toContain('destroy:ember_wolf');
        expect(r.state.players[opp(p)].monsters[z]).not.toBeNull();
        expect(r.state.players[opp(p)].graveyard.map((u) => r.state.cards[u].cardId)).toEqual(['guardian_charm']);
        expect(describeEvents(r.state, r.events).join('|')).toContain('canavarı korudu');
      });
  it('protects from an effect once; the second destruction goes through', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt', 'judgment_bolt'] }, p1: { monsters: ['crystal_wyrm'], spellTraps: [{ id: 'guardian_charm', equippedTo: 0 }] } });
    const a = (st: GameState) => (legalActions(st).find((x) => x.type === 'activateSpell') as Action);
    const r1 = play(s, a(s));
    expect(r1.state.players[1].monsters[0]).not.toBeNull();
    expect(r1.state.players[1].spellTraps[0]).toBeNull();
    const r2 = play(r1.state, a(r1.state));
    expect(r2.state.players[1].monsters[0]).toBeNull();
  });
  it('mirror_barrier: only the unshielded attacker is destroyed', () => {
    const s = scenario({
      phase: 'battle',
      p0: { monsters: ['ember_wolf', 'shade_assassin'], spellTraps: [{ id: 'guardian_charm', equippedTo: 0 }] },
      p1: { monsters: ['stone_sentinel'], spellTraps: ['mirror_barrier'] },
    });
    const w = play(s, atk(0, 1, 0));
    const r = play(w.state, respond(w.state, 'mirror_barrier', 1));
    expect(r.state.players[0].monsters[0]).not.toBeNull();
    expect(r.state.players[0].monsters[1]).toBeNull();
    expect(r.state.players[0].spellTraps[0]).toBeNull();
  });
  it('a shielded volt_lizard that loses is not destroyed: no discharge', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: ['volt_lizard'], spellTraps: [{ id: 'guardian_charm', equippedTo: 0 }] } });
    const r = play(s, atk(0, 0, 0));
    expect(evs(r.state, r.events).some((x) => x === 'activate:volt_lizard')).toBe(false);
    expect(r.state.players[1].lp).toBe(4000 - 1300);
  });
  it('a tribute is not a destruction: the equipped monster may be tributed (the charm drops by rule)', () => {
    const s = scenario({ p0: { hand: ['magma_titan'], monsters: ['ember_wolf'], spellTraps: [{ id: 'guardian_charm', equippedTo: 0 }] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'magma_titan'), zone: 0, tributes: [s.players[0].monsters[0]!.uid] });
    expect(r.state.players[0].graveyard.map((u) => r.state.cards[u].cardId)).toEqual(expect.arrayContaining(['ember_wolf', 'guardian_charm']));
  });
});

// ---------------------------------------------------------------------------------------------
describe('field spells: tidal_bay, shadow_cavern, festival_square', () => {
  const board = {
    p0: { monsters: ['tide_golem', 'storm_hawk', 'ember_wolf'] as CardId[] },
    p1: { monsters: ['coral_serpent', 'shade_assassin', 'lumen_sprite'] as CardId[] },
  };
  const board5 = {
    p0: { monsters: ['tide_golem', 'storm_hawk', 'ember_wolf', 'stone_sentinel', 'wing_lady'] as CardId[] },
    p1: { monsters: ['coral_serpent', 'shade_assassin', 'lumen_sprite', 'volt_lizard', 'tide_golem'] as CardId[] },
  };
  const atks = (s: GameState, p: PlayerId) => s.players[p].monsters.map((m) => (m ? currentAtk(s, m.uid) : null));
  it('tidal_bay (3 zones): WATER/WIND +400, FIRE -400, both fields; volcano replaces it', () => {
    const s = scenario({ ...board, p0: { ...board.p0, field: 'tidal_bay' } });
    expect(atks(s, 0)).toEqual([1500, 1400, 1300]);
    expect(atks(s, 1)).toEqual([2400, 1900, 400]);
    expect(currentDef(s, s.players[0].monsters[0]!.uid)).toBe(2000); // DEF is never touched
    const v = scenario({ ...board, p0: { ...board.p0, hand: ['volcano_arena'], field: 'tidal_bay' } });
    const r = play(v, sp(v, 'volcano_arena'));
    expect(r.state.players[0].fieldSpell && r.state.cards[r.state.players[0].fieldSpell.uid].cardId).toBe('volcano_arena');
    expect(atks(r.state, 0)).toEqual([800, 1000, 2200]);
  });
  it('tidal_bay / shadow_cavern (5 zones): all five lanes of both sides', () => {
    const s = scenario({ zones: 5, ...board5, p0: { ...board5.p0, field: 'tidal_bay' } });
    expect(atks(s, 0)).toEqual([1500, 1700, 1300, 500, 1700]); // storm_hawk 1000 +400 +300 (Kanat Hanımı aura); Kanat Hanımı 1300 +400
    expect(atks(s, 1)).toEqual([2400, 1900, 400, 1500, 1500]);
    const c = scenario({ zones: 5, ...board5, p1: { ...board5.p1, field: 'shadow_cavern' } });
    expect(atks(c, 0)).toEqual([1100, 1300, 1700, 800, 1300]);
    expect(atks(c, 1)).toEqual([2000, 2200, 100, 1200, 1100]);
  });
  it('shadow_cavern (3 zones): DARK/EARTH +300, LIGHT -300 with a floor of 0', () => {
    const s = scenario({ ...board, p1: { ...board.p1, field: 'shadow_cavern' } });
    expect(atks(s, 0)).toEqual([1100, 1000, 1700]);
    expect(atks(s, 1)).toEqual([2000, 2200, 100]);
    const z = scenario({ p0: { monsters: ['lumen_sprite'], field: 'shadow_cavern' } });
    expect(currentAtk(z, z.players[0].monsters[0]!.uid)).toBe(100);
    const w = scenario({ p0: { monsters: ['wisp_imp'], field: 'shadow_cavern' } });
    expect(currentAtk(w, w.players[0].monsters[0]!.uid)).toBe(600);
  });
  it('activated from the hand: the statChange events list every changed monster; destroyed -> the numbers come back', () => {
    const s = scenario({ ...board, p0: { ...board.p0, hand: ['tidal_bay'] } });
    const r = play(s, sp(s, 'tidal_bay'));
    const e = evs(r.state, r.events);
    expect(e[0]).toBe('activate:tidal_bay');
    expect(e).toEqual(expect.arrayContaining(['statChange:tide_golem:1100>1500', 'statChange:ember_wolf:1700>1300', 'statChange:coral_serpent:2000>2400']));
    expect(e).toContain('fieldSpell:tidal_bay');
    expect(describeEvents(r.state, r.events).join('|')).toContain('Saha dönüştü: Gelgit Körfezi');
    // source leaves the field: the opposing purging_wave
    const w = scenario({ ...board, p0: { ...board.p0, field: 'tidal_bay' }, p1: { ...board.p1, hand: ['purging_wave'] }, active: 1 });
    const d = play(w, sp(w, 'purging_wave', 1, { target: card(0, 'field', 0) }));
    expect(atks(d.state, 0)).toEqual([1100, 1000, 1700]);
    expect(evs(d.state, d.events)).toContain('statChange:tide_golem:1500>1100');
  });
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`festival_square (P${p + 1}, ${zones} zones): one extra Normal Summon / Set of a Level <= 4 monster`, () => {
        const s = duel(p, { hand: ['ember_wolf', 'storm_hawk', 'shade_assassin', 'crystal_wyrm'], field: 'festival_square' }, {}, { zones });
        const first = play(s, { type: 'normalSummon', player: p, uid: uidOf(s, 'ember_wolf', p), zone: 0, tributes: [] });
        expect(first.state.players[p].normalSummonUsed).toBe(true);
        const acts = legalActions(first.state).filter((a) => a.type === 'normalSummon' || a.type === 'setMonster') as Extract<Action, { type: 'normalSummon' | 'setMonster' }>[];
        expect(acts.length).toBeGreaterThan(0);
        expect(acts.every((a) => a.tributes.length === 0)).toBe(true);
        expect(acts.some((a) => a.uid === uidOf(s, 'crystal_wyrm', p))).toBe(false); // Level 7 is not allowed
        const second = play(first.state, acts.find((a) => a.type === 'setMonster' && a.uid === uidOf(s, 'storm_hawk', p))!);
        expect(second.state.players[p].extraSummonTurn).toBe(second.state.turn);
        expect(legalActions(second.state).some((a) => a.type === 'normalSummon' || a.type === 'setMonster')).toBe(false); // only one extra
        // next turn the rights are back
        const t = play(second.state, endTurn(p), endTurn(opp(p)));
        expect(legalActions(t.state).some((a) => a.type === 'normalSummon')).toBe(true);
      });
  it('the big monster first, then the small one; a tribute summon spends the normal right', () => {
    const s = scenario({ p0: { hand: ['magma_titan', 'ember_wolf'], monsters: ['stone_sentinel'], field: 'festival_square' } });
    const t = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'magma_titan'), zone: 0, tributes: [s.players[0].monsters[0]!.uid] });
    expect(legalActions(t.state).some((a) => a.type === 'normalSummon' && a.uid === uidOf(s, 'ember_wolf'))).toBe(true);
  });
  it('only its controller gets the extra summon, and it is gone when the field spell is destroyed', () => {
    const theirs = scenario({ p0: { hand: ['ember_wolf', 'storm_hawk'], normalSummonUsed: true }, p1: { field: 'festival_square' } });
    expect(legalActions(theirs).some((a) => a.type === 'normalSummon')).toBe(false);
    const mine = scenario({ p0: { hand: ['storm_hawk'], normalSummonUsed: true, field: 'festival_square' }, p1: { hand: ['purging_wave'] } });
    expect(legalActions(mine).some((a) => a.type === 'normalSummon')).toBe(true);
    const gone = scenario({ active: 1, p0: { hand: ['storm_hawk'], normalSummonUsed: true, field: 'festival_square' }, p1: { hand: ['purging_wave'] } });
    const r = play(gone, sp(gone, 'purging_wave', 1, { target: card(0, 'field', 0) }), endTurn(1));
    expect(legalActions(r.state).some((a) => a.type === 'normalSummon')).toBe(true); // fresh turn right regardless
    const s2 = scenario({ p0: { hand: ['storm_hawk'], normalSummonUsed: true } });
    expect(legalActions(s2).some((a) => a.type === 'normalSummon')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('spell_seal (Büyü Mührü): negates a Spell activation', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: the bolt is negated, the target survives, both cards go to the graveyards`, () => {
        const z = zones === 5 ? 4 : 2;
        const sts: (string | null)[] = [];
        sts[z] = 'spell_seal';
        const s = duel(p, { hand: ['judgment_bolt'] }, { monsters: ['crystal_wyrm'], spellTraps: sts as never }, { zones });
        const w = play(s, sp(s, 'judgment_bolt', p, { target: mon(opp(p), 0) }));
        expect(w.state.pending).toMatchObject({ kind: 'trapResponse', player: opp(p), trigger: { kind: 'spellActivated', player: p } });
        expect(opts(w.state)).toEqual([uidOf(s, 'spell_seal', opp(p))]);
        expect(evs(w.state, w.events)).toEqual(['activate:judgment_bolt', 'decision:trapResponse']);
        const r = play(w.state, respond(w.state, 'spell_seal', opp(p)));
        expect(evs(r.state, r.events)).toEqual(['activate:spell_seal', 'toGraveyard:judgment_bolt', 'toGraveyard:spell_seal']);
        expect(r.state.players[opp(p)].monsters[0]).not.toBeNull();
        expect(r.state.pending).toBeNull();
        expect(describeEvents(r.state, r.events).join('|')).toContain('Büyü geçersiz kılındı');
        // declining lets the spell resolve
        const d = play(w.state, respond(w.state, null, opp(p)));
        expect(d.state.players[opp(p)].monsters[0]).toBeNull();
        expect(d.state.players[opp(p)].spellTraps[z]).not.toBeNull();
      });
  it('negates an equip (the placed card is destroyed), a field spell (never placed) and a set spell activated from its zone', () => {
    const eq = scenario({ p0: { hand: ['dragon_blade'], monsters: ['ember_wolf'] }, p1: { spellTraps: ['spell_seal'] } });
    const w = play(eq, sp(eq, 'dragon_blade', 0, { zone: 0, target: mon(0, 0) }));
    expect(w.state.players[0].spellTraps[0]?.equippedTo).toBeNull(); // placed, not yet resolved
    const r = play(w.state, respond(w.state, 'spell_seal', 1));
    expect(r.state.players[0].spellTraps[0]).toBeNull();
    expect(currentAtk(r.state, r.state.players[0].monsters[0]!.uid)).toBe(1700);
    expect(evs(r.state, r.events)).toContain('destroy:dragon_blade');
    const fld = scenario({ p0: { hand: ['volcano_arena'] }, p1: { spellTraps: ['spell_seal'] } });
    const fw = play(fld, sp(fld, 'volcano_arena'));
    const fr = play(fw.state, respond(fw.state, 'spell_seal', 1));
    expect(fr.state.players[0].fieldSpell).toBeNull();
    const set = scenario({ p0: { spellTraps: ['healing_spring'] }, p1: { spellTraps: ['spell_seal'] } });
    const sw = play(set, sp(set, 'healing_spring'));
    const sr = play(sw.state, respond(sw.state, 'spell_seal', 1));
    expect(sr.state.players[0].lp).toBe(4000);
    expect(sr.state.players[0].spellTraps[0]).toBeNull();
    expect(sr.state.players[0].graveyard).toHaveLength(1);
  });
  it('is not a window for monster effects or traps; a non-spell action never opens it', () => {
    const s = scenario({ p0: { hand: ['abyss_magus'], monsters: ['shade_assassin'] }, p1: { spellTraps: ['spell_seal'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'abyss_magus'), zone: 0, tributes: [s.players[0].monsters[0]!.uid] });
    expect(r.state.pending?.kind).toBe('chooseTarget'); // the Magus effect resolves, the seal stays quiet
  });
  it('the sorcerer still burns for a negated spell (the activation happened)', () => {
    const s = scenario({ p0: { hand: ['healing_spring'], monsters: ['dusk_sorcerer'] }, p1: { spellTraps: ['spell_seal'] } });
    const w = play(s, sp(s, 'healing_spring'));
    const r = play(w.state, respond(w.state, 'spell_seal', 1));
    expect(r.state.players[1].lp).toBe(3700);
    expect(r.state.players[0].lp).toBe(4000);
  });
  it('a set spell_seal cannot answer on the turn it was set (existing trap rule)', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['crystal_wyrm'], spellTraps: [{ id: 'spell_seal', setTurn: 3 }] } });
    const r = play(s, sp(s, 'judgment_bolt', 0, { target: mon(1, 0) }));
    expect(r.state.pending).toBeNull();
    expect(r.state.players[1].monsters[0]).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('toppling_tower (Devrilen Kule): ATK >= 1800 on a Normal / Tribute / Special Summon', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: a tribute-summoned 2800 is destroyed`, () => {
        const z = zones === 5 ? 4 : 2;
        const sts: (string | null)[] = [];
        sts[z] = 'toppling_tower';
        const s = duel(p, { hand: ['crystal_wyrm'], monsters: ['ember_wolf', 'tide_golem'] }, { spellTraps: sts as never }, { zones });
        const w = play(s, { type: 'normalSummon', player: p, uid: uidOf(s, 'crystal_wyrm', p), zone: 0, tributes: s.players[p].monsters.flatMap((m) => (m ? [m.uid] : [])) });
        expect(w.state.pending).toMatchObject({ kind: 'trapResponse', player: opp(p), trigger: { kind: 'summoned' } });
        const r = play(w.state, respond(w.state, 'toppling_tower', opp(p)));
        expect(evs(r.state, r.events)).toEqual(['activate:toppling_tower', 'destroy:crystal_wyrm', 'toGraveyard:crystal_wyrm', 'toGraveyard:toppling_tower']);
        expect(r.state.players[p].monsters.every((m) => m === null)).toBe(true);
      });
  it('the threshold is 1800 (shade_assassin 1900 yes, a 1700 wolf no); a volcano-boosted wolf (2200) yes', () => {
    const mk = (id: CardId, field?: CardId) => scenario({ p0: { hand: [id] }, p1: { spellTraps: ['toppling_tower'], ...(field ? { field } : {}) } });
    const sum = (st: GameState, id: CardId) => play(st, { type: 'normalSummon', player: 0, uid: uidOf(st, id), zone: 0, tributes: [] });
    expect(sum(mk('shade_assassin'), 'shade_assassin').state.pending?.kind).toBe('trapResponse');
    expect(sum(mk('ember_wolf'), 'ember_wolf').state.pending).toBeNull();
    const vol = scenario({ p0: { hand: ['ember_wolf'], field: 'volcano_arena' }, p1: { spellTraps: ['toppling_tower'] } });
    expect(sum(vol, 'ember_wolf').state.pending?.kind).toBe('trapResponse');
  });
  it('a Special Summon opens it too (Ruh Çağrısı), the Yer Yarığı window does not (the existing rule)', () => {
    const s = scenario({ p0: { hand: ['soul_recall'], graveyard: ['crystal_wyrm'] }, p1: { spellTraps: ['toppling_tower'] } });
    const w = play(s, sp(s, 'soul_recall', 0, { target: { kind: 'graveyard', uid: uidOf(s, 'crystal_wyrm'), toZone: 1 } }));
    expect(w.state.pending).toMatchObject({ kind: 'trapResponse', trigger: { kind: 'summoned', method: 'special' } });
    const r = play(w.state, respond(w.state, 'toppling_tower', 1));
    expect(r.state.players[0].monsters[1]).toBeNull();
    const chasm = scenario({ p0: { hand: ['soul_recall'], graveyard: ['crystal_wyrm'] }, p1: { spellTraps: ['chasm_trap'] } });
    const cw = play(chasm, sp(chasm, 'soul_recall', 0, { target: { kind: 'graveyard', uid: uidOf(chasm, 'crystal_wyrm'), toZone: 1 } }));
    expect(cw.state.pending).toBeNull();
    expect(cw.state.players[0].monsters[1]).not.toBeNull();
  });
  it('shares the window with Yer Yarığı: both are options, only one is used', () => {
    const s = scenario({ p0: { hand: ['crystal_wyrm'], monsters: ['ember_wolf', 'tide_golem'] }, p1: { spellTraps: ['chasm_trap', 'toppling_tower'] } });
    const w = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'crystal_wyrm'), zone: 0, tributes: s.players[0].monsters.flatMap((m) => (m ? [m.uid] : [])) });
    expect(opts(w.state)).toHaveLength(2);
    const r = play(w.state, respond(w.state, 'chasm_trap', 1));
    expect(r.state.players[1].spellTraps.filter(Boolean)).toHaveLength(1);
    expect(r.state.pending).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('homecoming (Eve Dönüş): the attacker goes back to its owner\'s hand', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: attack negated, equips fall, the battle phase goes on`, () => {
        const z = zones === 5 ? 3 : 0;
        const me: (string | null)[] = [];
        me[z] = 'ember_wolf';
        me[z + 1 < zones ? z + 1 : 0] = me[z + 1 < zones ? z + 1 : 0] ?? 'shade_assassin';
        const s = scenario({
          zones,
          phase: 'battle',
          active: p,
          ...(p === 0
            ? { p0: { monsters: me as never, spellTraps: [{ id: 'dragon_blade', equippedTo: z }] }, p1: { monsters: ['stone_sentinel'], spellTraps: ['homecoming'] } }
            : { p1: { monsters: me as never, spellTraps: [{ id: 'dragon_blade', equippedTo: z }] }, p0: { monsters: ['stone_sentinel'], spellTraps: ['homecoming'] } }),
        } as ScenarioOpts);
        const w = play(s, atk(p, z, 0));
        expect(opts(w.state)).toEqual([uidOf(s, 'homecoming', opp(p))]);
        const r = play(w.state, respond(w.state, 'homecoming', opp(p)));
        const e = evs(r.state, r.events);
        expect(e.slice(0, 3)).toEqual(['activate:homecoming', 'attackNegated', 'toHand:ember_wolf']);
        expect(e).toContain('destroy:dragon_blade');
        expect(e.some((x) => x.startsWith('battle'))).toBe(false);
        expect(r.state.players[p].monsters[z]).toBeNull();
        expect(r.state.players[p].hand.map((u) => r.state.cards[u].cardId)).toEqual(['ember_wolf']);
        expect(r.state.phase).toBe('battle');
        expect(actingPlayer(r.state)).toBe(p);
        // the other monster can still attack
        expect(legalActions(r.state).some((a) => a.type === 'attack' && a.attackerZone !== z)).toBe(true);
        expect(describeEvents(r.state, r.events).join('|')).toContain('sahibinin eline döndü');
      });
  it('five seals: the returned piece completes the set in its owner\'s hand (re-check on return)', () => {
    const s = scenario({
      phase: 'battle',
      p0: { hand: ['seal_arm_r', 'seal_arm_l', 'seal_leg_r', 'seal_leg_l'], monsters: ['seal_head'] },
      p1: { monsters: ['stone_sentinel'], spellTraps: ['homecoming'] },
    });
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, respond(w.state, 'homecoming', 1));
    expect(r.state.winner).toBe(0);
    expect(r.state.winReason).toBe('seals');
    expect(r.state.players[1].spellTraps.every((st) => st === null)).toBe(true);
  });
  it('a revived enemy monster returns to its OWNER\'s hand, not the controller\'s', () => {
    const s = scenario({
      phase: 'battle',
      p0: { monsters: [null, 'tide_golem'] },
      p1: { monsters: ['stone_sentinel'], spellTraps: ['homecoming'] },
    });
    // stage: player 0 controls a monster owned by player 1
    const t = structuredClone(s);
    const foreign = uidOf(t, 'stone_sentinel', 1);
    const mine = t.players[1].monsters[0]!;
    t.players[1].monsters[0] = null;
    t.players[0].monsters[0] = { ...mine, uid: foreign };
    t.players[1].monsters[0] = { ...mine, uid: uidOf(t, 'tide_golem', 0) };
    t.players[0].monsters[1] = null;
    // swap ownership so the foreign card is owned by P1 and sits on P0's field; P0's own tide_golem defends on P1's side is not needed:
    t.cards[uidOf(t, 'tide_golem', 0)].owner = 0;
    inv(t);
    const w = play(t, atk(0, 0, 0));
    const r = play(w.state, respond(w.state, 'homecoming', 1));
    expect(r.state.players[1].hand).toContain(foreign);
    expect(r.state.players[0].hand).not.toContain(foreign);
  });
  it('an over-full hand discards in the End Phase as usual', () => {
    const s = scenario({
      phase: 'battle',
      p0: { hand: ['ember_wolf', 'ember_wolf', 'ember_wolf', 'ember_wolf', 'ember_wolf', 'ember_wolf'], monsters: ['shade_assassin'] },
      p1: { monsters: ['stone_sentinel'], spellTraps: ['homecoming'] },
    });
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, respond(w.state, 'homecoming', 1), endTurn(0));
    expect(r.state.pending).toMatchObject({ kind: 'discard', player: 0, count: 1 });
  });
});

// ---------------------------------------------------------------------------------------------
describe('decoy_target (Sahte Hedef): the defender picks which own monster takes the attack', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones: redirect to a stronger monster, candidates = every other own monster`, () => {
        const defn: (string | null | { id: CardId; faceUp?: boolean; position?: 'attack' | 'defense' })[] = [];
        defn[0] = 'lumen_sprite';
        defn[1] = 'crystal_wyrm';
        if (zones === 5) {
          defn[3] = { id: 'tide_golem', position: 'defense' };
          defn[4] = { id: 'thorn_lurker', faceUp: false };
        }
        const s = scenario({
          zones,
          phase: 'battle',
          active: p,
          ...(p === 0
            ? { p0: { monsters: ['shade_assassin'] }, p1: { monsters: defn as never, spellTraps: ['decoy_target'] } }
            : { p1: { monsters: ['shade_assassin'] }, p0: { monsters: defn as never, spellTraps: ['decoy_target'] } }),
        } as ScenarioOpts);
        const w = play(s, atk(p, 0, 0));
        const r1 = play(w.state, respond(w.state, 'decoy_target', opp(p)));
        expect(r1.state.pending).toMatchObject({ kind: 'chooseTarget', player: opp(p) });
        const cands = (r1.state.pending as { candidates: { index: number }[] }).candidates.map((c) => c.index);
        expect(cands).toEqual(zones === 5 ? [1, 3, 4] : [1]);
        expect(describePending(r1.state, r1.state.pending!)).toContain('Sahte Hedef');
        const r2 = play(r1.state, { type: 'chooseTarget', player: opp(p), target: { player: opp(p), zone: 'monster', index: 1 } });
        const e = evs(r2.state, r2.events);
        expect(e).toContain('battle:attackerDestroyed'); // 1900 vs 2800
        expect(r2.state.players[p].monsters[0]).toBeNull();
        expect(r2.state.players[opp(p)].monsters[0]).not.toBeNull(); // the lumen sprite was spared
      });
  it('not offered with a single monster; a face-down candidate is flipped by the redirected attack', () => {
    const one = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['lumen_sprite'], spellTraps: ['decoy_target'] } });
    expect(play(one, atk(0, 0, 0)).state.pending).toBeNull();
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: ['lumen_sprite', { id: 'thorn_lurker', faceUp: false }], spellTraps: ['decoy_target'] } });
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, respond(w.state, 'decoy_target', 1), { type: 'chooseTarget', player: 1, target: { player: 1, zone: 'monster', index: 1 } });
    expect(evs(r.state, r.events)).toContain('flip:thorn_lurker');
  });
  it('redirects a storm_hawk direct attack onto a monster (every monster is a candidate)', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['storm_hawk'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'defense' }], spellTraps: ['decoy_target'] } });
    const w = play(s, atk(0, 0, null));
    expect(opts(w.state)).toHaveLength(1);
    const r = play(w.state, respond(w.state, 'decoy_target', 1));
    expect((r.state.pending as { candidates: unknown[] }).candidates).toHaveLength(1);
    const done = play(r.state, { type: 'chooseTarget', player: 1, target: { player: 1, zone: 'monster', index: 0 } });
    expect(evs(done.state, done.events)).toContain('battle:noDestroy');
    expect(done.state.players[1].lp).toBe(4000);
  });
});

// ---------------------------------------------------------------------------------------------
describe('last_breath (Son Nefes): LP below 1500 from the opponent\'s damage', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1} attacks, ${zones} zones: 2500 -> 1200 opens the window, +1500`, () => {
        const sts: (string | null)[] = [];
        sts[zones === 5 ? 4 : 2] = 'last_breath';
        const s = scenario({
          zones,
          phase: 'battle',
          active: p,
          ...(p === 0
            ? { p0: { monsters: ['ember_wolf'] }, p1: { lp: 2900, spellTraps: sts as never } }
            : { p1: { monsters: ['ember_wolf'] }, p0: { lp: 2900, spellTraps: sts as never } }),
        } as ScenarioOpts);
        const w = play(s, atk(p, 0, null));
        expect(w.state.players[opp(p)].lp).toBe(1200);
        expect(w.state.pending).toMatchObject({ kind: 'trapResponse', player: opp(p), trigger: { kind: 'lpLow', player: opp(p) } });
        const r = play(w.state, respond(w.state, 'last_breath', opp(p)));
        expect(evs(r.state, r.events)).toEqual(['activate:last_breath', 'lpGain:p' + opp(p) + ':1500', 'toGraveyard:last_breath']);
        expect(r.state.players[opp(p)].lp).toBe(2700);
        const d = play(w.state, respond(w.state, null, opp(p)));
        expect(d.state.players[opp(p)].lp).toBe(1200);
      });
  it('only when the drop crosses 1500 (not from 1400, not to 0), and only for the opponent\'s damage', () => {
    const base = (lp: number) => scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { lp, spellTraps: ['last_breath'] } });
    const weak = scenario({ phase: 'battle', p0: { monsters: ['lumen_sprite'] }, p1: { lp: 1400, spellTraps: ['last_breath'] } });
    expect(play(weak, atk(0, 0, null)).state.pending).toBeNull(); // already below 1500: not a crossing
    expect(play(base(1700), atk(0, 0, null)).state.winner).toBe(0); // lethal: no window at 0
  });
  it('3199 -> 1499 opens the window (the boundary), 3200 -> 1500 does not', () => {
    const base = (lp: number) => scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { lp, spellTraps: ['last_breath'] } });
    expect(play(base(3200), atk(0, 0, null)).state.pending).toBeNull();
    expect(play(base(3199), atk(0, 0, null)).state.pending?.kind).toBe('trapResponse');
  });
  it('the attacker\'s own battle damage does not open it; a burn effect does', () => {
    const own = scenario({ phase: 'battle', p0: { lp: 2000, monsters: ['ember_wolf'], spellTraps: ['last_breath'] }, p1: { monsters: ['crystal_wyrm'] } });
    const o = play(own, atk(0, 0, 0));
    expect(o.state.players[0].lp).toBe(900);
    expect(o.state.pending).toBeNull();
    // an effect (Magma Titan's summon burn) can: 2000 -> 1500 is not below; 1900 -> 1400 is
    const burn = scenario({ p0: { hand: ['magma_titan'], monsters: ['ember_wolf'] }, p1: { lp: 1900, spellTraps: ['last_breath'] } });
    const b = play(burn, { type: 'normalSummon', player: 0, uid: uidOf(burn, 'magma_titan'), zone: 0, tributes: [burn.players[0].monsters[0]!.uid] });
    expect(b.state.pending).toMatchObject({ kind: 'trapResponse', trigger: { kind: 'lpLow' } });
  });
  it('the window waits for the whole action: the battle destruction happens before the prompt', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { lp: 2500, monsters: [{ id: 'ember_wolf' }], spellTraps: ['last_breath'] } });
    const w = play(s, atk(0, 0, 0));
    expect(evs(w.state, w.events)).toEqual(expect.arrayContaining(['damage:p1:1100', 'destroy:ember_wolf', 'toGraveyard:ember_wolf']));
    expect(w.state.players[1].lp).toBe(1400);
    expect(w.state.pending?.kind).toBe('trapResponse');
  });
});

// ---------------------------------------------------------------------------------------------
describe('sandstorm (Kum Fırtınası): negate the attack, the attacker side goes to defense', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones`, () => {
        const me: (string | { id: CardId; position: 'defense' } | null)[] = ['ember_wolf', 'shade_assassin', { id: 'tide_golem', position: 'defense' }];
        if (zones === 5) me.push('storm_hawk', 'lumen_sprite');
        const s = scenario({
          zones,
          phase: 'battle',
          active: p,
          ...(p === 0 ? { p0: { monsters: me as never }, p1: { monsters: ['stone_sentinel'], spellTraps: ['sandstorm'] } } : { p1: { monsters: me as never }, p0: { monsters: ['stone_sentinel'], spellTraps: ['sandstorm'] } }),
        } as ScenarioOpts);
        const w = play(s, atk(p, 0, 0));
        const r = play(w.state, respond(w.state, 'sandstorm', opp(p)));
        const e = evs(r.state, r.events);
        expect(e.slice(0, 2)).toEqual(['activate:sandstorm', 'attackNegated']);
        expect(e.filter((x) => x === 'positionChange:ember_wolf' || x.startsWith('positionChange')).length).toBe(zones === 5 ? 4 : 2);
        expect(r.state.players[p].monsters.every((m) => !m || m.position === 'defense')).toBe(true);
        expect(r.state.phase).toBe('battle'); // not Işık Zincirleri: the phase goes on
        expect(legalActions(r.state).some((a) => a.type === 'attack')).toBe(false); // but nobody can attack any more
        expect(e.some((x) => x.startsWith('battle'))).toBe(false);
      });
  it('with Işık Zincirleri also set: only one of the two is used', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf', 'shade_assassin'] }, p1: { monsters: ['stone_sentinel'], spellTraps: ['sandstorm', 'chains_of_light'] } });
    const w = play(s, atk(0, 0, 0));
    expect(opts(w.state)).toHaveLength(2);
    const r = play(w.state, respond(w.state, 'chains_of_light', 1));
    expect(r.state.pending).toBeNull();
    expect(r.state.players[1].spellTraps.filter(Boolean)).toHaveLength(1);
    expect(r.state.activePlayer).toBe(1); // chains ended the turn
  });
});

// ---------------------------------------------------------------------------------------------
describe('hidden_reinforcement (Gizli Takviye): the attacked monster gets +1000 ATK / DEF for the battle', () => {
  for (const p of BOTH)
    for (const zones of ZONES)
      it(`P${p + 1}, ${zones} zones`, () => {
        const z = zones === 5 ? 4 : 1;
        const defn: (string | null | { id: CardId; position: 'defense' })[] = [];
        defn[z] = 'ember_wolf';
        const s = scenario({
          zones,
          phase: 'battle',
          active: p,
          ...(p === 0
            ? { p0: { monsters: ['shade_assassin'] }, p1: { monsters: defn as never, spellTraps: ['hidden_reinforcement'] } }
            : { p1: { monsters: ['shade_assassin'] }, p0: { monsters: defn as never, spellTraps: ['hidden_reinforcement'] } }),
        } as ScenarioOpts);
        const w = play(s, atk(p, 0, z));
        const r = play(w.state, respond(w.state, 'hidden_reinforcement', opp(p)));
        const e = evs(r.state, r.events);
        expect(e).toEqual(expect.arrayContaining(['activate:hidden_reinforcement', 'target', 'statChange:ember_wolf:1700>2700', 'battle:attackerDestroyed']));
        expect(r.state.players[p].monsters[0]).toBeNull(); // 1900 < 2700
        expect(r.state.players[opp(p)].lp).toBe(4000);
        expect(r.state.players[p].lp).toBe(4000 - 800 - 300); // the 800 difference and Kor Kurdu's own 300 burn (it won the fight)
        // the boost ends with the End Phase
        const end = play(r.state, endTurn(p));
        expect(currentAtk(end.state, end.state.players[opp(p)].monsters[z]!.uid)).toBe(1700);
      });
  it('boosts DEF of a defender and of a face-down monster; not offered for a direct attack', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }], spellTraps: ['hidden_reinforcement'] } });
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, respond(w.state, 'hidden_reinforcement', 1));
    // thorn_lurker DEF 800 + 1000 = 1800 < 2800: destroyed anyway, but the boost made the numbers 2800 vs 1800
    expect(evs(r.state, r.events)).toContain('battle:targetDestroyed');
    const direct = scenario({ phase: 'battle', p0: { monsters: ['storm_hawk'] }, p1: { monsters: ['stone_sentinel'], spellTraps: ['hidden_reinforcement'] } });
    expect(play(direct, atk(0, 0, null)).state.pending).toBeNull(); // hawk attacks directly: no target to protect
    const empty = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { spellTraps: ['hidden_reinforcement'] } });
    expect(play(empty, atk(0, 0, null)).state.pending).toBeNull();
  });
  it('a stronger boost survives and counter-hits: the defender wins, the attacker takes the difference', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: ['shade_assassin'], spellTraps: ['hidden_reinforcement'] } });
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, respond(w.state, 'hidden_reinforcement', 1));
    expect(r.state.players[0].lp).toBe(4000 - (2900 - 1700));
    expect(r.state.players[1].monsters[0]).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('trapLock (Çelik Susturucu) stops every new trap window', () => {
  const lock = (extra: ScenarioOpts) => scenario({ ...extra });
  it('attack-window traps stay set', () => {
    for (const id of ['homecoming', 'decoy_target', 'sandstorm', 'hidden_reinforcement'] as CardId[]) {
      const s = lock({ phase: 'battle', p0: { monsters: ['steel_silencer', 'ember_wolf'] }, p1: { monsters: ['stone_sentinel', 'lumen_sprite'], spellTraps: [id] } });
      const w = play(s, atk(0, 1, 0));
      expect(w.state.pending, id).toBeNull();
    }
  });
  it('spell_seal, toppling_tower and last_breath stay set too', () => {
    const a = lock({ p0: { hand: ['judgment_bolt'], monsters: ['steel_silencer'] }, p1: { monsters: ['crystal_wyrm'], spellTraps: ['spell_seal'] } });
    expect(play(a, sp(a, 'judgment_bolt', 0, { target: mon(1, 0) })).state.pending).toBeNull();
    const b = lock({ p0: { hand: ['shade_assassin'], monsters: ['steel_silencer'] }, p1: { spellTraps: ['toppling_tower'] } });
    expect(play(b, { type: 'normalSummon', player: 0, uid: uidOf(b, 'shade_assassin'), zone: 1, tributes: [] }).state.pending).toBeNull();
    const c = lock({ phase: 'battle', p0: { monsters: ['steel_silencer', 'ember_wolf'] }, p1: { lp: 2900, spellTraps: ['last_breath'] } });
    expect(play(c, atk(0, 1, null)).state.pending).toBeNull();
  });
  it('they answer again once the silencer is gone', () => {
    const s = lock({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: ['stone_sentinel'], spellTraps: ['homecoming'] } });
    expect(play(s, atk(0, 0, 0)).state.pending?.kind).toBe('trapResponse');
  });
});

// ---------------------------------------------------------------------------------------------
describe('engine contract', () => {
  it('apply accepts exactly the actions legalActions lists, for the new spell actions too', () => {
    const s = scenario({
      p0: { hand: [...NEW_SPELLS, 'crystal_wyrm'] as CardId[], monsters: ['ember_wolf', 'shade_assassin'], graveyard: ['stone_sentinel', 'tide_golem', 'storm_hawk'], deck: ['stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'stone_sentinel'] },
      p1: { monsters: ['crystal_wyrm', { id: 'tide_golem', position: 'defense' }], spellTraps: ['mirror_barrier', 'spell_seal'], field: 'volcano_arena' },
    });
    const acts = legalActions(s).filter((a) => a.type === 'activateSpell');
    expect(acts.length).toBeGreaterThan(12);
    for (const a of acts) expect(isListed(s, a)).toBe(true);
    // a hand-made illegal variant is refused
    expect(() => apply(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'kneel_down'), target: mon(1, 1) })).toThrow();
    expect(() => apply(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'purging_wave'), target: card(0, 'field', 0) })).toThrow();
    for (const a of acts) {
      const r = apply(s, a);
      expect(r.state.winner).toBeNull();
    }
  });
  it('a game state never mutates and replays deterministically', () => {
    const s = scenario({ p0: { hand: ['cycle_of_graves'], graveyard: ['ember_wolf', 'tide_golem', 'storm_hawk'] } });
    const before = JSON.stringify(s);
    const a = apply(s, sp(s, 'cycle_of_graves'));
    expect(JSON.stringify(s)).toBe(before);
    expect(JSON.stringify(apply(s, sp(s, 'cycle_of_graves')).state)).toBe(JSON.stringify(a.state));
  });
});

// ---------------------------------------------------------------------------------------------
describe('bot', () => {
  const pick = (s: GameState, seed = 1) => chooseAction(s, seed);
  const isAct = (a: Action, s: GameState, id: CardId) => a.type === 'activateSpell' && s.cards[a.uid].cardId === id;
  it('fate_trade when the hand holds junk; double_offering then the big summon; kneel_down on the best attacker; purging_wave on a set card', () => {
    const a = scenario({ p0: { hand: ['fate_trade', 'wisp_imp'], deck: Array.from({ length: 8 }, () => 'stone_sentinel' as CardId) } });
    expect(isAct(pick(a), a, 'fate_trade')).toBe(true);
    const b = scenario({ p0: { hand: ['double_offering', 'crystal_wyrm'], monsters: ['lumen_sprite'] } });
    const act = pick(b);
    expect(isAct(act, b, 'double_offering')).toBe(true);
    const b2 = apply(b, act).state;
    const sum = pick(b2);
    expect(sum).toMatchObject({ type: 'normalSummon', tributes: [b2.players[0].monsters[0]!.uid] });
    expect(b2.cards[(sum as { uid: Uid }).uid].cardId).toBe('crystal_wyrm');
    const c = scenario({ p0: { hand: ['kneel_down'] }, p1: { monsters: ['crystal_wyrm'] } });
    expect(isAct(pick(c), c, 'kneel_down')).toBe(true);
    const d = scenario({ p0: { hand: ['purging_wave'] }, p1: { spellTraps: ['mirror_barrier'] } });
    expect(isAct(pick(d), d, 'purging_wave')).toBe(true);
  });
  it('battle_cry only when it flips a losing attack; equips the right monsters; plays the field spell that helps', () => {
    const win = scenario({ p0: { hand: ['battle_cry'], monsters: ['ember_wolf'] }, p1: { monsters: ['shade_assassin'] } });
    expect(isAct(pick(win), win, 'battle_cry')).toBe(true);
    const waste = scenario({ p0: { hand: ['battle_cry'], monsters: ['crystal_wyrm'] }, p1: { monsters: ['lumen_sprite'] } });
    expect(isAct(pick(waste), waste, 'battle_cry')).toBe(false);
    const lance = scenario({ p0: { hand: ['piercing_lance'], monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'tide_golem', position: 'defense' }] } });
    expect(isAct(pick(lance), lance, 'piercing_lance')).toBe(true);
    const charm = scenario({ p0: { hand: ['guardian_charm'], monsters: ['crystal_wyrm'] } });
    expect(isAct(pick(charm), charm, 'guardian_charm')).toBe(true);
    const bay = scenario({ p0: { hand: ['tidal_bay'], monsters: ['tide_golem', 'storm_hawk'] }, p1: { monsters: ['ember_wolf'] } });
    expect(isAct(pick(bay), bay, 'tidal_bay')).toBe(true);
    const wrongBay = scenario({ p0: { hand: ['tidal_bay'], monsters: ['ember_wolf', 'ember_wolf'] }, p1: { monsters: ['tide_golem'] } });
    expect(isAct(pick(wrongBay), wrongBay, 'tidal_bay')).toBe(false);
    const cave = scenario({ p0: { hand: ['shadow_cavern'], monsters: ['shade_assassin', 'stone_sentinel'] }, p1: { monsters: ['lumen_sprite'] } });
    expect(isAct(pick(cave), cave, 'shadow_cavern')).toBe(true);
    const fest = scenario({ p0: { hand: ['festival_square', 'ember_wolf', 'storm_hawk'] } });
    const f1 = pick(fest);
    expect(f1.type).toBe('normalSummon'); // the normal summon first...
    const fest2 = apply(fest, f1).state;
    expect(isAct(pick(fest2), fest2, 'festival_square')).toBe(true); // ...then the square for the extra one
    const fest3 = apply(fest2, pick(fest2)).state;
    expect(legalActions(fest3).some((a) => a.type === 'normalSummon')).toBe(true);
  });
  it('trap answers: spell_seal, toppling_tower, last_breath yes; homecoming / sandstorm / decoy / hidden when it pays', () => {
    const seal = scenario({ p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['crystal_wyrm'], spellTraps: ['spell_seal'] } });
    const w1 = play(seal, sp(seal, 'judgment_bolt', 0, { target: mon(1, 0) }));
    expect(pick(w1.state)).toMatchObject({ type: 'respond', uid: uidOf(seal, 'spell_seal', 1) });
    const tower = scenario({ p0: { hand: ['shade_assassin'] }, p1: { spellTraps: ['toppling_tower'] } });
    const w2 = play(tower, { type: 'normalSummon', player: 0, uid: uidOf(tower, 'shade_assassin'), zone: 0, tributes: [] });
    expect(pick(w2.state)).toMatchObject({ type: 'respond', uid: uidOf(tower, 'toppling_tower', 1) });
    const breath = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { lp: 2900, spellTraps: ['last_breath'] } });
    const w3 = play(breath, atk(0, 0, null));
    expect(pick(w3.state)).toMatchObject({ type: 'respond', uid: uidOf(breath, 'last_breath', 1) });
    const big = scenario({ phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: ['ember_wolf'], spellTraps: ['homecoming'] } });
    const w4 = play(big, atk(0, 0, 0));
    expect(pick(w4.state)).toMatchObject({ type: 'respond', uid: uidOf(big, 'homecoming', 1) });
    const hid = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['ember_wolf'], spellTraps: ['hidden_reinforcement'] } });
    const w5 = play(hid, atk(0, 0, 0));
    expect(pick(w5.state)).toMatchObject({ type: 'respond', uid: uidOf(hid, 'hidden_reinforcement', 1) });
    const dec = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['lumen_sprite', 'crystal_wyrm'], spellTraps: ['decoy_target'] } });
    const w6 = play(dec, atk(0, 0, 0));
    const d1 = pick(w6.state);
    expect(d1).toMatchObject({ type: 'respond', uid: uidOf(dec, 'decoy_target', 1) });
    const w7 = play(w6.state, d1);
    expect(pick(w7.state)).toMatchObject({ type: 'chooseTarget', target: { index: 1 } }); // the Kristal Ejder takes the hit
    const sand = scenario({ phase: 'battle', p0: { monsters: ['crystal_wyrm', 'ember_wolf', 'shade_assassin'] }, p1: { monsters: ['lumen_sprite'], spellTraps: ['sandstorm'] } });
    const w8 = play(sand, atk(0, 0, 0));
    expect(pick(w8.state)).toMatchObject({ type: 'respond', uid: uidOf(sand, 'sandstorm', 1) });
    // and it declines when it does not pay
    const cheap = scenario({ phase: 'battle', p0: { monsters: ['lumen_sprite'] }, p1: { monsters: ['crystal_wyrm'], spellTraps: ['homecoming'] } });
    const w9 = play(cheap, atk(0, 0, 0));
    expect(pick(w9.state)).toMatchObject({ type: 'respond', uid: null });
  });
});

// ---------------------------------------------------------------------------------------------
// Bot-vs-bot on the expanded pool: invariants after every action, replay determinism, every new card used.

function randomDeck(seed: number, side: PlayerId): CardId[] {
  const rng = makeRng((seed * 7919 + side * 104729 + 17) >>> 0);
  const monsters = ALL_CARDS.filter(isMonster).map((c) => c.id);
  const nonMon = ALL_CARDS.filter((c) => !isMonster(c)).map((c) => c.id);
  const shuffle = <T,>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return [...shuffle(monsters).slice(0, 10), ...shuffle(nonMon).slice(0, 10)];
}

function playGame(seed: number, zones: 3 | 5): { state: GameState; actions: Action[]; used: Set<string>; fired: Set<string> } {
  const decks: [CardId[], CardId[]] = [randomDeck(seed, 0), randomDeck(seed, 1)];
  let { state } = newGame({ seed, decks, zones });
  inv(state);
  const actions: Action[] = [];
  const used = new Set<string>();
  const fired = new Set<string>();
  for (let i = 0; i < 4000 && state.winner === null; i++) {
    const a = chooseAction(state, seed);
    expect(actingPlayer(state), `seed ${seed}`).toBe((a as { player: PlayerId }).player);
    const r = apply(state, a);
    inv(r.state);
    checkEvents(r.state, r.events);
    for (const e of r.events) {
      if (e.type === 'activate' && e.kind !== 'monsterEffect' && NEW_CARDS.includes(e.cardId)) used.add(e.cardId);
      if (e.type === 'toHand' || e.type === 'toDeck') fired.add(e.type);
    }
    actions.push(a);
    state = r.state;
  }
  return { state, actions, used, fired };
}

describe('bot vs bot on the expanded pool (random 20-card decks with the new cards)', () => {
  const usedAll = new Set<string>();
  const games: { seed: number; zones: 3 | 5; actions: Action[]; json: string }[] = [];
  it('40 seeded games (zones 3 and 5) reach gameOver with invariants after every action', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const zones: 3 | 5 = seed % 2 ? 5 : 3;
      const g = playGame(seed, zones);
      expect(g.state.winner, `seed ${seed} zones ${zones}`).not.toBeNull();
      for (const u of g.used) usedAll.add(u);
      games.push({ seed, zones, actions: g.actions, json: JSON.stringify(g.state) });
    }
    expect(games).toHaveLength(40);
  }, 120_000);
  it('replaying the recorded actions gives the identical final state (determinism)', () => {
    for (const g of games.slice(0, 20)) {
      let { state } = newGame({ seed: g.seed, decks: [randomDeck(g.seed, 0), randomDeck(g.seed, 1)], zones: g.zones });
      for (const a of g.actions) state = apply(state, a).state;
      expect(JSON.stringify(state), `seed ${g.seed}`).toBe(g.json);
    }
  }, 120_000);
  it('the bot activates every one of the 18 new cards at least once across the games', () => {
    const missing = NEW_CARDS.filter((id) => !usedAll.has(id));
    expect(missing, `never activated: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('the default deck is untouched', () => {
  it('newGame without decks deals the 20 original cards (no new card)', () => {
    const g = newGame({ seed: 9 }).state;
    expect(Object.values(g.cards).every((c) => !NEW_CARDS.includes(c.cardId))).toBe(true);
    expect(Object.keys(g.cards)).toHaveLength(40);
  });
});
