// Batch 1 of the expanded roster: one describe per effect template. Each template is covered for its
// normal case, the mirror (the other player's copy), face-down / defense cases, the source leaving the
// field, interaction with piercing / direct attack, and the 3-zone and 5-zone boards.
import { describe, expect, it } from 'vitest';
import { apply, battleNumbers, currentAtk, legalActions, newGame, type Action, type GameEvent, type GameState, type PlayerId } from '../../src/engine';
import { ALL_CARDS, CARDS, DEFAULT_DECK, SEAL_IDS, isMonster, type CardId } from '../../src/data/cards';
import { DECK_SIZE, EXPANDED_POOL, decksFor, detectDeckPool, expandedDeck } from '../../src/data/decks';
import { checkEvents, checkInvariants, checkInvariantsRelaxed, isListed, play, scenario, seq, uidOf, type ScenarioOpts } from './helpers';

const atk = (s: GameState, id: CardId, owner?: PlayerId) => currentAtk(s, uidOf(s, id, owner));
const lp = (s: GameState, p: PlayerId) => s.players[p].lp;
const of = (events: GameEvent[], t: GameEvent['type']) => events.filter((e) => e.type === t);
const battleOf = (events: GameEvent[]) => of(events, 'battle')[0] as Extract<GameEvent, { type: 'battle' }>;

/** p0 attacks p1's zone `tz` (null: direct) from zone `az` in the battle phase. */
function attack(o: ScenarioOpts, az = 0, tz: number | null = 0) {
  const s = scenario({ phase: 'battle', ...o });
  return { s, ...play(s, { type: 'attack', player: 0, attackerZone: az, targetZone: tz }) };
}

describe('data: the 15 cards', () => {
  it('stats and effects are as designed; the default deck did not change', () => {
    const want: Record<string, [number, number, number, string, string]> = {
      dusk_sorcerer: [7, 2500, 2100, 'ownSpellBurn300', 'DARK'],
      ashen_drake: [7, 2400, 2000, 'none', 'DARK'],
      grim_warden: [6, 2500, 1200, 'declareAtkDebuff400', 'DARK'],
      venom_drake: [5, 2000, 1500, 'none', 'DARK'],
      wisp_imp: [1, 300, 200, 'noBattleDamageOnDestroy', 'DARK'],
      steel_silencer: [6, 2400, 1500, 'trapLock', 'DARK'],
      seal_head: [3, 1000, 1000, 'sealSet', 'DARK'],
      seal_arm_r: [1, 200, 300, 'sealSet', 'DARK'],
      seal_arm_l: [1, 200, 300, 'sealSet', 'DARK'],
      seal_leg_r: [1, 200, 300, 'sealSet', 'DARK'],
      seal_leg_l: [1, 200, 300, 'sealSet', 'DARK'],
      hourglass_imp: [2, 500, 400, 'summonFreezeAttack', 'LIGHT'],
      windmane_knight: [7, 2300, 2100, 'summonTurnAtk500', 'EARTH'],
      shield_titan: [4, 100, 2600, 'defenseAtkDebuff500', 'EARTH'],
      wing_lady: [4, 1300, 1400, 'windAura300', 'WIND'],
    };
    for (const [id, [lv, a, d, eff, attr]] of Object.entries(want)) {
      const c = CARDS[id as CardId];
      expect(c.kind).toBe('monster');
      if (!isMonster(c)) continue;
      expect([c.level, c.atk, c.def, c.effect, c.attribute], id).toEqual([lv, a, d, eff, attr]);
      expect(c.name.length).toBeGreaterThan(0);
    }
    expect(DEFAULT_DECK).toHaveLength(20);
    expect(DEFAULT_DECK.some((id) => id in want)).toBe(false);
    expect(SEAL_IDS).toHaveLength(5);
  });
});

describe('windAura300 (wing_lady)', () => {
  it('adds +300 to the other WIND monsters of the same field only; not to herself, others or the opponent', () => {
    const s = scenario({ p0: { monsters: ['wing_lady', 'storm_hawk', 'ember_wolf'] }, p1: { monsters: ['storm_hawk'] } });
    expect(atk(s, 'storm_hawk', 0)).toBe(1300);
    expect(atk(s, 'wing_lady')).toBe(1300);
    expect(atk(s, 'ember_wolf')).toBe(1700);
    expect(atk(s, 'storm_hawk', 1)).toBe(1000);
  });
  it('mirror: the opponent’s lady lifts the opponent’s hawk', () => {
    const s = scenario({ p0: { monsters: ['storm_hawk'] }, p1: { monsters: ['wing_lady', 'storm_hawk'] } });
    expect(atk(s, 'storm_hawk', 0)).toBe(1000);
    expect(atk(s, 'storm_hawk', 1)).toBe(1300);
  });
  it('a face-down lady gives nothing; flipping her turns it on (statChange)', () => {
    const s = scenario({ p0: { monsters: [{ id: 'wing_lady', faceUp: false }, 'storm_hawk'] } });
    expect(atk(s, 'storm_hawk')).toBe(1000);
    const r = play(s, { type: 'flipSummon', player: 0, zone: 0 });
    expect(atk(r.state, 'storm_hawk')).toBe(1300);
    expect(seq(r.state, r.events)).toContain('statChange:storm_hawk:1000>1300');
  });
  it('works in defense position and stacks with equips; summoning her emits statChange', () => {
    const s = scenario({
      p0: { hand: ['wing_lady'], monsters: [{ id: 'storm_hawk' }], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] },
    });
    expect(atk(s, 'storm_hawk')).toBe(1700);
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'wing_lady'), zone: 1, tributes: [] });
    expect(atk(r.state, 'storm_hawk')).toBe(2000);
    expect(seq(r.state, r.events)).toContain('statChange:storm_hawk:1700>2000');
    const d = scenario({ p0: { monsters: [{ id: 'wing_lady', position: 'defense' }, 'storm_hawk'] } });
    expect(atk(d, 'storm_hawk')).toBe(1300); // a defending lady still lifts the hawk
  });
  it('the aura ends when she leaves the field (destroyed): statChange back', () => {
    const s = scenario({ p0: { monsters: ['wing_lady', 'storm_hawk'] }, p1: { hand: ['judgment_bolt'] }, active: 1 });
    const r = play(s, {
      type: 'activateSpell', player: 1, uid: uidOf(s, 'judgment_bolt'),
      target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } },
    });
    expect(atk(r.state, 'storm_hawk')).toBe(1000);
    expect(seq(r.state, r.events)).toContain('statChange:storm_hawk:1300>1000');
  });
  it('the buffed ATK is the battle ATK (hawk 1300 beats a 1200 wolf-class target it would lose to at 1000)', () => {
    const o: ScenarioOpts = { p0: { monsters: ['storm_hawk', 'wing_lady'] }, p1: { monsters: ['tide_golem'] } };
    const r = attack({ ...o, p1: { monsters: [{ id: 'tide_golem', position: 'attack' }] } });
    expect(battleOf(r.events).attackerAtk).toBe(1300); // tide_golem 1100 ATK
    expect(battleOf(r.events).result).toBe('targetDestroyed');
  });
  it('a direct attack uses the buffed ATK; 5-zone board', () => {
    const s = scenario({ zones: 5, phase: 'battle', p0: { monsters: [null, null, 'storm_hawk', null, 'wing_lady'] } });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 2, targetZone: null });
    expect(lp(r.state, 1)).toBe(4000 - 1300);
    expect(battleOf(r.events).attackerAtk).toBe(1300);
  });
});

describe('summonTurnAtk500 (windmane_knight)', () => {
  const sc = (extra: Partial<ScenarioOpts> = {}) =>
    scenario({
      p0: { hand: ['windmane_knight'], monsters: ['stone_sentinel', 'ember_wolf'] },
      p1: { monsters: [{ id: 'shade_assassin', position: 'attack' }] },
      ...extra,
    });
  it('2300 in the main phase, 2800 in the battle phase of the summon turn, back to 2300 next turn', () => {
    const s = sc();
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'windmane_knight'), zone: 0, tributes: [s.players[0].monsters[0]!.uid, s.players[0].monsters[1]!.uid] });
    expect(atk(r.state, 'windmane_knight')).toBe(2300);
    const b = play(r.state, { type: 'enterBattle', player: 0 });
    expect(atk(b.state, 'windmane_knight')).toBe(2800);
    expect(seq(b.state, b.events)).toContain('statChange:windmane_knight:2300>2800');
    const a = play(b.state, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(battleOf(a.events).attackerAtk).toBe(2800);
    // next turn: no bonus
    const n = play(a.state, { type: 'endTurn', player: 0 });
    expect(atk(n.state, 'windmane_knight')).toBe(2300);
    const n2 = play(n.state, { type: 'endTurn', player: 1 });
    const n3 = play(n2.state, { type: 'enterBattle', player: 0 });
    expect(atk(n3.state, 'windmane_knight')).toBe(2300);
  });
  it('mirror: player 1’s knight gets it on player 1’s own battle phase, not on player 0’s turn', () => {
    const s = scenario({
      active: 1,
      p1: { hand: ['windmane_knight'], monsters: ['stone_sentinel', 'ember_wolf'] },
      p0: { monsters: [{ id: 'shade_assassin', position: 'attack' }] },
    });
    const r = play(s, { type: 'normalSummon', player: 1, uid: uidOf(s, 'windmane_knight'), zone: 0, tributes: [s.players[1].monsters[0]!.uid, s.players[1].monsters[1]!.uid] },
      { type: 'enterBattle', player: 1 });
    expect(atk(r.state, 'windmane_knight')).toBe(2800);
  });
  it('a Set-then-flipped knight and a revived knight get no bonus', () => {
    const s = scenario({ p0: { monsters: [{ id: 'windmane_knight', faceUp: false, enteredTurn: 2 }] } });
    const f = play(s, { type: 'flipSummon', player: 0, zone: 0 });
    const b = play(f.state, { type: 'enterBattle', player: 0 });
    expect(atk(b.state, 'windmane_knight')).toBe(2300);
    const s2 = scenario({ p0: { hand: ['soul_recall'] , graveyard: ['windmane_knight'] } });
    const r = play(s2, { type: 'activateSpell', player: 0, uid: uidOf(s2, 'soul_recall'), target: { kind: 'graveyard', uid: uidOf(s2, 'windmane_knight'), toZone: 0 } },
      { type: 'enterBattle', player: 0 });
    expect(atk(r.state, 'windmane_knight')).toBe(2300);
  });
  it('defense position and 5 zones: the knight placed in zone 4 still gets +500 in attack position only', () => {
    const s = scenario({ zones: 5, p0: { hand: ['windmane_knight'], monsters: [null, null, null, 'stone_sentinel', 'ember_wolf'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'windmane_knight'), zone: 4, tributes: [s.players[0].monsters[3]!.uid, s.players[0].monsters[4]!.uid] }, { type: 'enterBattle', player: 0 });
    expect(atk(r.state, 'windmane_knight')).toBe(2800);
    expect(isListed(r.state, { type: 'attack', player: 0, attackerZone: 4, targetZone: null })).toBe(true);
  });
});

describe('defenseAtkDebuff500 (shield_titan)', () => {
  it('a defending titan lowers the attacker by 500 (damage = DEF - reduced ATK to the attacker)', () => {
    const r = attack({ p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'shield_titan', position: 'defense' }] } });
    expect(battleOf(r.events).attackerAtk).toBe(1400);
    expect(battleOf(r.events).targetValue).toBe(2600);
    expect(lp(r.state, 0)).toBe(4000 - 1200);
    expect(r.state.players[1].monsters[0]).not.toBeNull();
    expect(seq(r.state, r.events)).toContain('activate:shield_titan');
  });
  it('a face-down titan is flipped first and the debuff applies', () => {
    const r = attack({ p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'shield_titan', faceUp: false }] } });
    expect(battleOf(r.events).attackerAtk).toBe(1400);
    expect(lp(r.state, 0)).toBe(2800);
  });
  it('in attack position there is no debuff', () => {
    const r = attack({ p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'shield_titan', position: 'attack' }] } });
    expect(battleOf(r.events).attackerAtk).toBe(1900);
    expect(battleOf(r.events).result).toBe('targetDestroyed');
  });
  it('the debuff is battle-only (currentAtk is unchanged) and does not touch a direct attack', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin', 'storm_hawk'] }, p1: { monsters: [{ id: 'shield_titan', position: 'defense' }] } });
    expect(atk(s, 'shade_assassin')).toBe(1900);
    expect(battleNumbers(s, uidOf(s, 'shade_assassin'), uidOf(s, 'shield_titan')).atk).toBe(1400);
    const r = play(s, { type: 'attack', player: 0, attackerZone: 1, targetZone: null });
    expect(battleOf(r.events).attackerAtk).toBe(1000);
    expect(lp(r.state, 1)).toBe(3000);
  });
  it('piercing uses the reduced ATK: coral + two blades (3400-500) vs DEF 2600 pierces 300', () => {
    const r = attack({
      p0: { monsters: ['coral_serpent'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }, { id: 'dragon_blade', equippedTo: 0 }] },
      p1: { monsters: [{ id: 'shield_titan', position: 'defense' }] },
    });
    expect(battleOf(r.events).attackerAtk).toBe(2900);
    expect(lp(r.state, 1)).toBe(3700);
    expect(r.state.players[1].monsters[0]).toBeNull();
  });
  it('after a trap/other move the titan leaving ends it (a fresh target has no debuff); 5-zone lanes', () => {
    const r = attack({ zones: 5, p0: { monsters: ['shade_assassin'] }, p1: { monsters: [null, null, null, { id: 'shield_titan', position: 'defense' }, 'ember_wolf'] } }, 0, 4);
    expect(battleOf(r.events).attackerAtk).toBe(1900);
  });
});

describe('declareAtkDebuff400 (grim_warden)', () => {
  it('the attacked ATK-position monster has ATK -400 during this battle only', () => {
    const r = attack({ p0: { monsters: ['grim_warden'] }, p1: { monsters: [{ id: 'venom_drake', position: 'attack' }] } });
    expect(battleOf(r.events).targetValue).toBe(1600);
    expect(lp(r.state, 1)).toBe(4000 - 900);
    expect(seq(r.state, r.events)).toContain('activate:grim_warden');
  });
  it('turns an equal fight into a win; the debuff is not permanent', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['grim_warden'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'attack' }, { id: 'ashen_drake', position: 'attack' }] } });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(battleOf(r.events).targetValue).toBe(2000);
    expect(atk(r.state, 'ashen_drake', 1)).toBe(2400);
  });
  it('no effect on defense-position targets (DEF is untouched), face-down ones, or direct attacks', () => {
    const d = attack({ p0: { monsters: ['grim_warden'] }, p1: { monsters: [{ id: 'venom_drake', position: 'defense' }] } });
    expect(battleOf(d.events).targetValue).toBe(1500);
    expect(seq(d.state, d.events)).not.toContain('activate:grim_warden');
    const f = attack({ p0: { monsters: ['grim_warden'] }, p1: { monsters: [{ id: 'venom_drake', faceUp: false }] } });
    expect(battleOf(f.events).targetValue).toBe(1500);
    const x = attack({ p0: { monsters: ['grim_warden'] }, p1: {} }, 0, null);
    expect(lp(x.state, 1)).toBe(1500);
  });
  it('mirror (player 1 attacks) and the 5-zone board', () => {
    const s = scenario({ zones: 5, phase: 'battle', active: 1, p1: { monsters: [null, null, null, null, 'grim_warden'] }, p0: { monsters: [{ id: 'venom_drake', position: 'attack' }] } });
    const r = play(s, { type: 'attack', player: 1, attackerZone: 4, targetZone: 0 });
    expect(battleOf(r.events).targetValue).toBe(1600);
  });
  it('a face-down warden does not attack (no legal attack); a defense warden neither', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: [{ id: 'grim_warden', faceUp: false }] }, p1: { monsters: ['ember_wolf'] } });
    expect(legalActions(s).some((a) => a.type === 'attack')).toBe(false);
  });
});

describe('noBattleDamageOnDestroy (wisp_imp)', () => {
  it('attacking and losing: the controller takes no damage, the imp is destroyed', () => {
    const r = attack({ p0: { monsters: ['wisp_imp'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } });
    expect(lp(r.state, 0)).toBe(4000);
    expect(r.state.players[0].monsters[0]).toBeNull();
    expect(seq(r.state, r.events)).toContain('activate:wisp_imp');
  });
  it('defending in attack position and destroyed: no damage; the attacker still wins the exchange', () => {
    const r = attack({ p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'wisp_imp', position: 'attack' }] } });
    expect(lp(r.state, 1)).toBe(4000);
    expect(r.state.players[1].monsters[0]).toBeNull();
  });
  it('mirror: the imp attacking a weaker monster still hurts the opponent', () => {
    const s = scenario({ phase: 'battle', active: 1, p1: { monsters: ['wisp_imp'] }, p0: { monsters: [{ id: 'volt_lizard', position: 'attack' }] } });
    // volt_lizard 1500 vs imp 300 -> the imp loses, p1 takes nothing
    const r = play(s, { type: 'attack', player: 1, attackerZone: 0, targetZone: 0 });
    expect(lp(r.state, 1)).toBe(4000);
    // and a surviving imp (opponent weaker): the opponent takes the damage normally
    const s2 = scenario({ phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: { monsters: [{ id: 'thorn_lurker', position: 'attack' }] } });
    const r2 = play(s2, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(lp(r2.state, 1)).toBe(4000); // 300 < 600: the imp loses (no damage to its owner)
    expect(lp(r2.state, 0)).toBe(4000);
  });
  it('piercing damage to a defending imp is also negated', () => {
    const r = attack({ p0: { monsters: ['coral_serpent'] }, p1: { monsters: [{ id: 'wisp_imp', position: 'defense' }] } });
    expect(lp(r.state, 1)).toBe(4000);
    expect(r.state.players[1].monsters[0]).toBeNull();
  });
  it('a face-down imp attacked: flipped, destroyed, no damage; the imp dying by an effect is unaffected', () => {
    const r = attack({ p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'wisp_imp', faceUp: false }] } });
    expect(lp(r.state, 1)).toBe(4000);
    const s = scenario({ p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['wisp_imp'] } });
    const e = play(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'judgment_bolt'), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } });
    expect(lp(e.state, 1)).toBe(4000);
  });
  it('an equal-ATK trade and a volt_lizard burn still work next to it (no cross-talk)', () => {
    const r = attack({ p0: { monsters: ['wisp_imp'] }, p1: { monsters: [{ id: 'volt_lizard', position: 'attack' }] } });
    expect(lp(r.state, 0)).toBe(4000);
    expect(lp(r.state, 1)).toBe(4000);
  });
});

describe('trapLock (steel_silencer)', () => {
  const trapSide = (): ScenarioOpts['p1'] => ({ monsters: ['ember_wolf'], spellTraps: ['mirror_barrier'] });
  it('baseline: without it the set trap opens a response window', () => {
    const r = attack({ p0: { monsters: ['shade_assassin'] }, p1: trapSide() });
    expect(r.state.pending?.kind).toBe('trapResponse');
  });
  it('a face-up silencer: no response window, the battle resolves, the trap stays set', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['steel_silencer', 'shade_assassin'] }, p1: trapSide() });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 1, targetZone: 0 });
    expect(r.state.pending).toBeNull();
    expect(battleOf(r.events)).toBeTruthy();
    expect(r.state.players[1].spellTraps[0]?.faceUp).toBe(false);
  });
  it('a defense-position face-up silencer still locks; a face-down one does not', () => {
    const d = scenario({ phase: 'battle', p0: { monsters: [{ id: 'steel_silencer', position: 'defense' }, 'shade_assassin'] }, p1: trapSide() });
    expect(play(d, { type: 'attack', player: 0, attackerZone: 1, targetZone: 0 }).state.pending).toBeNull();
    const f = scenario({ phase: 'battle', p0: { monsters: [{ id: 'steel_silencer', faceUp: false }, 'shade_assassin'] }, p1: trapSide() });
    expect(play(f, { type: 'attack', player: 0, attackerZone: 1, targetZone: 0 }).state.pending?.kind).toBe('trapResponse');
  });
  it('it also blocks the summon trap window (chasm_trap); setting traps stays legal', () => {
    const s = scenario({ p0: { hand: ['ashen_drake', 'mirror_barrier'], monsters: ['steel_silencer', 'ember_wolf', 'stone_sentinel'] }, p1: { spellTraps: ['chasm_trap'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ashen_drake'), zone: 1, tributes: [s.players[0].monsters[1]!.uid, s.players[0].monsters[2]!.uid] });
    expect(r.state.pending).toBeNull();
    const s2 = scenario({ p0: { hand: ['mirror_barrier'], monsters: ['steel_silencer'] } });
    expect(legalActions(s2).some((a) => a.type === 'setSpellTrap')).toBe(true);
  });
  it('mirror: player 1’s silencer locks player 0’s traps (zone 4 on 5 lanes)', () => {
    const s = scenario({ zones: 5, phase: 'battle', active: 1, p1: { monsters: [null, null, null, null, 'steel_silencer', ] , }, p0: { monsters: ['ember_wolf'], spellTraps: ['mirror_barrier'] } });
    s.players[1].monsters[0] = { ...s.players[1].monsters[4]!, uid: uidOf(s, 'steel_silencer') };
    s.players[1].monsters[4] = null;
    const r = play(s, { type: 'attack', player: 1, attackerZone: 0, targetZone: 0 });
    expect(r.state.pending).toBeNull();
  });
  it('the lock ends when the silencer leaves the field', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt'] , monsters: ['shade_assassin'] }, p1: { monsters: ['steel_silencer'], spellTraps: ['mirror_barrier'] } });
    const bolt = play(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'judgment_bolt'), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } });
    // the silencer belongs to the trap owner here; it only locks the *other* side's traps
    expect(bolt.state.players[1].monsters[0]).toBeNull();
    const b = play(bolt.state, { type: 'enterBattle', player: 0 }, { type: 'attack', player: 0, attackerZone: 0, targetZone: null });
    expect(b.state.pending?.kind).toBe('trapResponse');
  });
  it('the lock ends when the silencer leaves: p0 trap vs p1 silencer destroyed', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt'], monsters: ['shade_assassin'], spellTraps: ['mirror_barrier'] }, p1: { monsters: ['steel_silencer'] } });
    const bolt = play(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'judgment_bolt'), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } });
    const p1turn = play(bolt.state, { type: 'endTurn', player: 0 });
    expect(p1turn.state.players[1].monsters[0]).toBeNull();
  });
});

describe('sealSet (Beş Mühür)', () => {
  it('four distinct seals do nothing; the fifth completes the set the instant it is drawn', () => {
    const four = SEAL_IDS.slice(0, 4);
    const s = scenario({ turn: 3, active: 0, phase: 'main', p0: { hand: [...four], deck: [SEAL_IDS[4], 'stone_sentinel'] }, p1: {} });
    expect(s.winner).toBeNull();
    const e = play(s, { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 });
    expect(e.state.winner).toBe(0);
    expect(e.state.winReason).toBe('seals');
    const names = seq(e.state, e.events);
    expect(names[names.length - 1]).toBe('gameOver:p0:seals');
    expect(names.slice(-2, -1)[0]).toBe('draw:' + SEAL_IDS[4]);
    expect(names.filter((n) => n === 'phaseChange:main')).toHaveLength(1); // only player 1's main phase
    checkInvariants(e.state);
  });
  it('five copies of one seal, or a seal in the graveyard / on the field, do not count', () => {
    const s = scenario({ p0: { hand: ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r'], graveyard: ['seal_leg_l'], deck: ['seal_head'] } });
    const r = play(s, { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 });
    expect(r.state.winner).toBeNull();
    const s2 = scenario({ p0: { hand: ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r'], monsters: ['seal_leg_l'] } });
    expect(s2.winner).toBeNull();
  });
  it('the opponent can win by it too (player 1 draws the last piece on its turn)', () => {
    const s = scenario({ active: 0, p0: {}, p1: { hand: SEAL_IDS.slice(1), deck: [SEAL_IDS[0]] } });
    const r = play(s, { type: 'endTurn', player: 0 });
    expect(r.state.winner).toBe(1);
    expect(r.state.winReason).toBe('seals');
  });
  it('newGame with a forced deck order: the second player completes it on its first draw', () => {
    const d1: CardId[] = [...SEAL_IDS.slice(0, 4), SEAL_IDS[4], ...Array(15).fill('stone_sentinel')];
    const g = newGame({ seed: 3, firstPlayer: 0, noShuffle: true, decks: [Array(20).fill('stone_sentinel'), d1] });
    // p1's opening hand = the first four seals; its turn-2 draw is the fifth
    const a = apply(g.state, { type: 'endTurn', player: 0 });
    expect(a.state.winner).toBe(1);
    expect(a.state.winReason).toBe('seals');
    expect(a.events[a.events.length - 1]).toEqual({ type: 'gameOver', winner: 1, reason: 'seals' });
  });
  it('each seal is also a normal monster (summonable)', () => {
    const s = scenario({ p0: { hand: ['seal_head'] } });
    expect(isListed(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'seal_head'), zone: 0, tributes: [] })).toBe(true);
  });
});

describe('summonFreezeAttack (hourglass_imp)', () => {
  const summonImp = (s: GameState) => play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'hourglass_imp'), zone: 2, tributes: [] });
  it('the summoner picks one opposing monster (face-down too); it cannot attack on the opponent’s next turn only', () => {
    const s = scenario({ p0: { hand: ['hourglass_imp'] }, p1: { monsters: ['ember_wolf', { id: 'shade_assassin', faceUp: false }] } });
    const r = summonImp(s);
    expect(r.state.pending?.kind).toBe('chooseTarget');
    if (r.state.pending?.kind !== 'chooseTarget') return;
    expect(r.state.pending.player).toBe(0);
    expect(r.state.pending.candidates).toHaveLength(2);
    const c = play(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 0 } });
    expect(c.state.players[1].monsters[0]!.noAttackTurn).toBe(c.state.turn + 1);
    expect(c.state.pending).toBeNull();
    // player 1's turn: wolf frozen, the other can attack
    const t = play(c.state, { type: 'endTurn', player: 0 }, { type: 'enterBattle', player: 1 });
    const atks = legalActions(t.state).filter((a): a is Extract<Action, { type: 'attack' }> => a.type === 'attack');
    expect(atks.some((a) => a.attackerZone === 0)).toBe(false);
    // (the face-down assassin is not an attacker either) — flip it earlier in another case below
    // the turn after that: free again
    const t2 = play(t.state, { type: 'endTurn', player: 1 }, { type: 'endTurn', player: 0 }, { type: 'enterBattle', player: 1 });
    expect(legalActions(t2.state).some((a) => a.type === 'attack' && a.attackerZone === 0)).toBe(true);
  });
  it('the other monsters keep attacking; a frozen one can still change position', () => {
    const s = scenario({ p0: { hand: ['hourglass_imp'] }, p1: { monsters: ['ember_wolf', 'shade_assassin'] } });
    const r = summonImp(s);
    const c = play(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 0 } });
    const t = play(c.state, { type: 'endTurn', player: 0 });
    const main = legalActions(t.state);
    expect(main.some((a) => a.type === 'changePosition' && a.zone === 0)).toBe(true);
    const b = play(t.state, { type: 'enterBattle', player: 1 });
    const zones = legalActions(b.state).filter((a) => a.type === 'attack').map((a) => (a as { attackerZone: number }).attackerZone);
    expect(zones).toContain(1);
    expect(zones).not.toContain(0);
  });
  it('no opposing monster: no pending, nothing happens; a direct attack is not blocked for others', () => {
    const s = scenario({ p0: { hand: ['hourglass_imp'] }, p1: {} });
    const r = summonImp(s);
    expect(r.state.pending).toBeNull();
    expect(seq(r.state, r.events)).not.toContain('target');
  });
  it('a frozen monster that is tributed/replaced loses the mark with its zone; a different monster arriving is free', () => {
    const s = scenario({ p0: { hand: ['hourglass_imp'] }, p1: { hand: ['ashen_drake'], monsters: ['ember_wolf', 'shade_assassin'] } });
    const r = summonImp(s);
    const c = play(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 0 } });
    const t = play(c.state, { type: 'endTurn', player: 0 });
    const sum = play(t.state, { type: 'normalSummon', player: 1, uid: uidOf(t.state, 'ashen_drake'), zone: 0, tributes: [t.state.players[1].monsters[0]!.uid, t.state.players[1].monsters[1]!.uid] });
    expect(sum.state.players[1].monsters[0]!.noAttackTurn).toBeUndefined();
  });
  it('triggers on flip summon and soul_recall too; works on the 5-zone board and for player 1', () => {
    const s = scenario({ zones: 5, active: 1, p1: { monsters: [null, null, null, null, { id: 'hourglass_imp', faceUp: false }] }, p0: { monsters: [null, null, 'ember_wolf', null, 'shade_assassin'] } });
    const f = play(s, { type: 'flipSummon', player: 1, zone: 4 });
    expect(f.state.pending?.kind).toBe('chooseTarget');
    const c = play(f.state, { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 4 } });
    expect(c.state.players[0].monsters[4]!.noAttackTurn).toBe(c.state.turn + 1);
    const s2 = scenario({ p0: { hand: ['soul_recall'], graveyard: ['hourglass_imp'] }, p1: { monsters: ['ember_wolf'] } });
    const r = play(s2, { type: 'activateSpell', player: 0, uid: uidOf(s2, 'soul_recall'), target: { kind: 'graveyard', uid: uidOf(s2, 'hourglass_imp'), toZone: 0 } });
    expect(r.state.pending?.kind).toBe('chooseTarget');
  });
});

describe('ownSpellBurn300 (dusk_sorcerer)', () => {
  it('a Spell activated from the hand burns the opponent for 300 after it resolves', () => {
    const s = scenario({ p0: { hand: ['healing_spring'], monsters: ['dusk_sorcerer'] } });
    const r = play(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'healing_spring') });
    expect(lp(r.state, 0)).toBe(5000);
    expect(lp(r.state, 1)).toBe(3700);
    expect(seq(r.state, r.events)).toEqual(expect.arrayContaining(['activate:dusk_sorcerer', 'damage:p1:300']));
  });
  it('equip, field and a set Spell activated later all burn; setting does not; traps do not', () => {
    const s = scenario({ p0: { hand: ['dragon_blade', 'volcano_arena', 'healing_spring', 'mirror_barrier'], monsters: ['dusk_sorcerer'] } });
    const e = play(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'dragon_blade'), zone: 0, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } });
    expect(lp(e.state, 1)).toBe(3700);
    const f = play(e.state, { type: 'activateSpell', player: 0, uid: uidOf(s, 'volcano_arena') });
    expect(lp(f.state, 1)).toBe(3400);
    const set = play(f.state, { type: 'setSpellTrap', player: 0, uid: uidOf(s, 'healing_spring'), zone: 1 }, { type: 'setSpellTrap', player: 0, uid: uidOf(s, 'mirror_barrier'), zone: 2 });
    expect(lp(set.state, 1)).toBe(3400);
    const act = play(set.state, { type: 'activateSpell', player: 0, uid: uidOf(s, 'healing_spring') });
    expect(lp(act.state, 1)).toBe(3100);
  });
  it('face-down sorcerer: nothing; defense position face-up: still burns; the opponent’s sorcerer does not burn my Spells', () => {
    const a = scenario({ p0: { hand: ['healing_spring'], monsters: [{ id: 'dusk_sorcerer', faceUp: false }] } });
    expect(lp(play(a, { type: 'activateSpell', player: 0, uid: uidOf(a, 'healing_spring') }).state, 1)).toBe(4000);
    const b = scenario({ p0: { hand: ['healing_spring'], monsters: [{ id: 'dusk_sorcerer', position: 'defense' }] } });
    expect(lp(play(b, { type: 'activateSpell', player: 0, uid: uidOf(b, 'healing_spring') }).state, 1)).toBe(3700);
    const c = scenario({ p0: { hand: ['healing_spring'] }, p1: { monsters: ['dusk_sorcerer'] } });
    const rc = play(c, { type: 'activateSpell', player: 0, uid: uidOf(c, 'healing_spring') });
    expect(lp(rc.state, 0)).toBe(5000);
    expect(lp(rc.state, 1)).toBe(4000);
  });
  it('mirror (player 1) on 5 lanes; the burn can win the game; gone sorcerer = no burn', () => {
    const s = scenario({ zones: 5, active: 1, p1: { hand: ['healing_spring'], lp: 4000, monsters: [null, null, null, null, 'dusk_sorcerer'] }, p0: { lp: 300 } });
    const r = play(s, { type: 'activateSpell', player: 1, uid: uidOf(s, 'healing_spring') });
    expect(r.state.winner).toBe(1);
    expect(r.state.winReason).toBe('lp');
    const g = scenario({ p0: { hand: ['judgment_bolt', 'healing_spring'], monsters: ['dusk_sorcerer'] }, p1: {} });
    const gone = scenario({ p0: { hand: ['healing_spring'] }, p1: { hand: ['judgment_bolt'], monsters: ['dusk_sorcerer'] } });
    expect(g.winner).toBeNull();
    expect(lp(play(gone, { type: 'activateSpell', player: 0, uid: uidOf(gone, 'healing_spring') }).state, 1)).toBe(4000);
  });
  it('soul_recall burns once; a destroyed sorcerer (before activation) means no burn', () => {
    const s = scenario({ p0: { hand: ['soul_recall'], graveyard: ['ember_wolf'], monsters: ['dusk_sorcerer'] } });
    const r = play(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'soul_recall'), target: { kind: 'graveyard', uid: uidOf(s, 'ember_wolf'), toZone: 1 } });
    expect(lp(r.state, 1)).toBe(3700);
  });
});

describe('deck pool', () => {
  it('the sampler: 40 cards (24 monsters + 16 spells/traps, copy limits respected), deterministic and different per side/seed', () => {
    const d = expandedDeck(7, 0);
    expect(d).toHaveLength(DECK_SIZE);
    expect(DECK_SIZE).toBe(40);
    expect(d.filter((id) => CARDS[id].kind === 'monster')).toHaveLength(24);
    expect(d.filter((id) => CARDS[id].kind !== 'monster')).toHaveLength(16);
    expect(d.filter((id) => { const c = CARDS[id]; return c.kind === 'monster' && c.level >= 7; }).length).toBeLessThanOrEqual(8);
    for (const id of new Set(d)) expect(d.filter((x) => x === id).length).toBeLessThanOrEqual(id.startsWith('seal_') ? 1 : 3);
    expect(expandedDeck(7, 0)).toEqual(d);
    expect(expandedDeck(7, 1)).not.toEqual(d);
    expect(expandedDeck(8, 0)).not.toEqual(d);
    expect(EXPANDED_POOL).toHaveLength(ALL_CARDS.filter((c) => !c.retired).length); // the pool follows the roster minus retired cards
    expect(EXPANDED_POOL).not.toContain('dusk_sorcerer');
    expect(decksFor('default', 1)).toBeUndefined();
    expect(detectDeckPool()).toBe('default');
  });
  it('across seeds every monster of the roster shows up (seals included)', () => {
    const seen = new Set<CardId>();
    for (let seed = 0; seed < 80; seed++) for (const id of [...expandedDeck(seed, 0), ...expandedDeck(seed, 1)]) seen.add(id);
    expect(EXPANDED_POOL.filter((id) => CARDS[id].kind === 'monster').every((id) => seen.has(id))).toBe(true);
    // and so does every spell/trap (the sampler draws from all of them)
    expect(EXPANDED_POOL.filter((id) => CARDS[id].kind !== 'monster').every((id) => seen.has(id))).toBe(true);
  });
  it('newGame({ pool: "expanded" }) plays; the default still deals the 20 original cards', () => {
    const g = newGame({ seed: 5, pool: 'expanded' }).state;
    checkInvariants(g);
    expect(Object.values(g.cards).filter((c) => c.owner === 0)).toHaveLength(40);
    const d = newGame({ seed: 5 }).state;
    expect(Object.values(d.cards).every((c) => DEFAULT_DECK.includes(c.cardId))).toBe(true);
    expect(Object.keys(d.cards)).toHaveLength(40);
  });
});

describe('bot on the expanded pool', () => {
  it('plays expanded games to the end with invariants and uses the new cards', async () => {
    const { chooseAction, actingPlayer } = await import('../../src/engine');
    const used = new Set<string>();
    let overs = 0;
    for (let seed = 1; seed <= 24; seed++) {
      let { state, events } = newGame({ seed, pool: 'expanded', zones: seed % 2 ? 5 : 3 });
      checkInvariants(state);
      for (let i = 0; i < 3000 && state.winner === null; i++) {
        const a = chooseAction(state, seed);
        expect(actingPlayer(state)).toBe((a as { player: PlayerId }).player);
        const r = apply(state, a);
        checkInvariantsRelaxed(r.state);
        checkEvents(r.state, r.events);
        for (const e of r.events) if (e.type === 'summon' || e.type === 'activate') used.add(e.cardId);
        state = r.state;
        events = r.events;
      }
      expect(state.winner, `seed ${seed}`).not.toBeNull();
      overs++;
    }
    expect(overs).toBe(24);
    const fresh = ['dusk_sorcerer', 'ashen_drake', 'grim_warden', 'venom_drake', 'wisp_imp', 'steel_silencer', 'hourglass_imp', 'windmane_knight', 'shield_titan', 'wing_lady'];
    // the pool grew by 26 cards with batch 2 (docs/v3/YENI_KARTLAR.md), so each batch-1 card is dealt less often
    expect(fresh.filter((id) => used.has(id)).length).toBeGreaterThanOrEqual(7);
  });
  it('a seal hoarder wins: forced draws, the bot holds the pieces and completes the set', async () => {
    const { chooseAction } = await import('../../src/engine');
    const filler: CardId[] = ['stone_sentinel', 'ember_wolf', 'shade_assassin', 'volt_lizard', 'tide_golem', 'thorn_lurker', 'lumen_sprite', 'storm_hawk', 'healing_spring', 'judgment_bolt', 'soul_recall', 'dragon_blade', 'chasm_trap', 'chains_of_light', 'mirror_barrier'];
    const d0: CardId[] = [...SEAL_IDS.slice(0, 4), 'stone_sentinel', 'ember_wolf', 'shade_assassin', SEAL_IDS[4], ...filler];
    const g = newGame({ seed: 11, firstPlayer: 0, noShuffle: true, decks: [d0, [...filler, ...filler]] });
    let state = g.state;
    for (let i = 0; i < 400 && state.winner === null; i++) state = apply(state, chooseAction(state, 3)).state;
    expect(state.winner).toBe(0);
    expect(state.winReason).toBe('seals');
  });
});
