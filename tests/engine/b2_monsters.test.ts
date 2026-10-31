// Batch 2 monsters (docs/v3/YENI_KARTLAR.md §6 + owner decisions 2026-10-31): Kabuk Zıpkıncı, Kadran Soytarısı,
// Bulut Yavrusu, the vanilla four, Hurda Akıncıları, Kovuk Devi, Uçurtma Eskrimci, Çamur Pençe Ruhu and the Kutup family.
import { describe, expect, it } from 'vitest';
import { apply, currentAtk, currentDef, legalActions, type Action, type GameState } from '../../src/engine';
import { ALL_CARDS, CARDS, COLLECTIBLE_CARD_IDS, MONSTER_IDS, isMonster, type CardId, type MonsterCardDef } from '../../src/data/cards';
import { EXPANDED_POOL } from '../../src/data/decks';
import {
  at,
  atk,
  battle,
  choose,
  decline,
  endTurn,
  evs,
  expectIllegal,
  flipFace,
  gy,
  isListed,
  legalOf,
  mon,
  nextCoin,
  play,
  ref,
  respond,
  scenario,
  sp,
  spellActs,
  types,
  uidOf,
} from './b2_kit';

const M = (id: CardId) => CARDS[id] as MonsterCardDef;
const coinAct = (p: 0 | 1, zone: number): Action => ({ type: 'activateMonster', player: p, zone });
const call = (p: 0 | 1, c: 'heads' | 'tails'): Action => ({ type: 'callCoin', player: p, call: c });

// ---------------------------------------------------------------------------------------------
describe('batch 2 card data (exactly as the spec)', () => {
  const rows: [CardId, string, string, string, number, number, number, string, boolean][] = [
    ['tide_harpooner', 'Kabuk Zıpkıncı', 'WATER', 'Su', 5, 1700, 1500, 'tidalBayShroud', true],
    ['dial_jester', 'Kadran Soytarısı', 'LIGHT', 'Büyücü', 2, 700, 300, 'coinWipe', false],
    ['cloud_hatchling', 'Bulut Yavrusu', 'WIND', 'Ejderha', 3, 1100, 900, 'jesterAging', false],
    ['reflection_archer', 'Yansıyan Okçu', 'LIGHT', 'Büyücü', 4, 1800, 1000, 'none', false],
    ['scrap_raiders', 'Hurda Akıncıları', 'FIRE', 'Savaşçı', 4, 2000, 0, 'attackThenDefense', false],
    ['hollow_ogre', 'Kovuk Devi', 'EARTH', 'Canavar-Savaşçı', 4, 1400, 900, 'banishGraveBoost400', false],
    ['crag_axeman', 'Kaya Baltacı', 'EARTH', 'Savaşçı', 4, 1600, 1300, 'none', false],
    ['reed_heron', 'Sazlık Balıkçılı', 'WATER', 'Kanatlı Canavar', 4, 1400, 1500, 'none', false],
    ['kite_fencer', 'Uçurtma Eskrimci', 'WIND', 'Savaşçı', 3, 900, 600, 'doubleAttackMonster', false],
    ['mudgrasp_spirit', 'Çamur Pençe Ruhu', 'EARTH', 'Şeytan', 4, 700, 1800, 'defenseAttackedPin', false],
    ['steppe_spiralhorn', 'Bozkır Boynuzlusu', 'WIND', 'Canavar', 4, 1500, 1400, 'none', false],
    ['polar_needle', 'Kutup İğnesi', 'EARTH', 'Kaya', 4, 1500, 1100, 'magnetPiece', false],
    ['polar_anvil', 'Kutup Örsü', 'EARTH', 'Kaya', 4, 1100, 1700, 'magnetPiece', false],
    ['polar_coil', 'Kutup Bobini', 'EARTH', 'Kaya', 4, 1300, 1400, 'magnetPiece', false],
    ['polar_sovereign', 'Kutup Hükümdarı', 'EARTH', 'Kaya', 8, 3000, 2800, 'magnetFusion', true],
  ];
  it('15 monsters with the spec stats, names, attributes, races and effects', () => {
    for (const [id, name, attr, race, level, a, d, eff, ace] of rows) {
      const c = M(id);
      expect(c, id).toBeDefined();
      expect([c.name, c.attribute, c.race, c.level, c.atk, c.def, c.effect, c.ace], id).toEqual([name, attr, race, level, a, d, eff, ace]);
      expect(MONSTER_IDS).toContain(id);
      expect(COLLECTIBLE_CARD_IDS).toContain(id);
    }
  });
  it('effect monsters carry their Turkish text, vanilla ones a flavor line', () => {
    for (const [id, , , , , , , eff] of rows) {
      const c = M(id);
      if (eff === 'none') expect(c.flavor.length, id).toBeGreaterThan(10);
      else expect(c.text.length, id).toBeGreaterThan(20);
    }
    expect(M('dial_jester').text).toMatch(/^Turda 1 kez/); // owner decision 5: once per turn
    expect(M('polar_needle').text).toContain('Kutup Örsü ve Kutup Bobini');
    expect(M('polar_anvil').text).toContain('Kutup İğnesi ve Kutup Bobini');
    expect(M('polar_coil').text).toContain('Kutup İğnesi ve Kutup Örsü');
  });
  it('the straw token is a card id but outside the pool; Kül Ejderi stays vanilla (owner decision 2)', () => {
    const t = M('straw_decoy_token');
    expect([t.name, t.level, t.atk, t.def, t.token]).toEqual(['Saman Korkuluk', 1, 0, 0, true]);
    expect(ALL_CARDS.some((c) => c.id === 'straw_decoy_token')).toBe(false);
    expect(EXPANDED_POOL).not.toContain('straw_decoy_token');
    expect(M('ashen_drake').effect).toBe('none');
    expect(ALL_CARDS.some((c) => (c.id as string) === 'gilded_cage')).toBe(false); // owner decision 1
  });
  it('new cards are appended after the batch-1 roster', () => {
    const i = ALL_CARDS.findIndex((c) => c.id === 'tide_harpooner');
    expect(ALL_CARDS[i - 1].id).toBe('magic_hat');
    expect(ALL_CARDS.filter(isMonster).length).toBe(27 + 15);
  });
});

// ---------------------------------------------------------------------------------------------
describe('C1 Kabuk Zıpkıncı (tidalBayShroud)', () => {
  const base = (field: CardId | null, extra: (CardId | null)[] = []) =>
    scenario({
      phase: 'battle',
      p0: { monsters: ['shade_assassin'], hand: ['judgment_bolt', 'kneel_down', 'puppet_string', 'soul_leash'] },
      p1: { monsters: ['tide_harpooner', ...extra], field },
    });

  it('without Gelgit Körfezi it is a normal monster: attacked, targeted', () => {
    const s = base(null);
    expect(isListed(s, atk(0, 0, 0))).toBe(true);
    expect(isListed(s, atk(0, 0, null))).toBe(false);
    const m = { ...s, phase: 'main' as const };
    expect(spellActs(m, 'judgment_bolt').length).toBe(1);
  });

  for (const owner of [0, 1] as const) {
    it(`with Körfez on ${owner === 1 ? 'its own' : 'the opponent\'s'} field: no attack on it, a direct attack is legal (only monster)`, () => {
      const s = scenario({
        phase: 'battle',
        p0: { monsters: ['shade_assassin'], field: owner === 0 ? 'tidal_bay' : null },
        p1: { monsters: ['tide_harpooner'], field: owner === 1 ? 'tidal_bay' : null },
      });
      expect(currentAtk(s, s.players[1].monsters[0]!.uid)).toBe(2100); // Körfez +400
      expect(isListed(s, atk(0, 0, 0))).toBe(false);
      const r = play(s, atk(0, 0, null));
      expect(r.state.players[1].lp).toBe(4000 - 1900);
    });
  }

  it('with another monster beside it: only that one can be attacked, no direct attack', () => {
    const s = base('tidal_bay', ['stone_sentinel']);
    expect(isListed(s, atk(0, 0, 0))).toBe(false);
    expect(isListed(s, atk(0, 0, 1))).toBe(true);
    expect(isListed(s, atk(0, 0, null))).toBe(false);
  });

  it('opponent Spells cannot target it (bolt, kneel, puppet, leash); hedefsiz void_eye still destroys it', () => {
    const s = { ...base('tidal_bay'), phase: 'main' as const };
    for (const id of ['judgment_bolt', 'kneel_down', 'puppet_string', 'soul_leash'] as CardId[]) expect(spellActs(s, id), id).toEqual([]);
    const v = scenario({ p0: { hand: ['void_eye'] }, p1: { monsters: ['tide_harpooner'], field: 'tidal_bay' } });
    const r = play(v, sp(v, 'void_eye'));
    expect(r.state.players[1].monsters[0]).toBeNull();
  });

  it('a trap / monster effect still hits it (thorn_lurker flip)', () => {
    const s = scenario({
      p0: { monsters: [{ id: 'thorn_lurker', faceUp: false }] },
      p1: { monsters: ['tide_harpooner'], field: 'tidal_bay' },
    });
    let r = play(s, { type: 'flipSummon', player: 0, zone: 0 });
    expect(r.state.pending?.kind).toBe('chooseTarget');
    r = play(r.state, choose(0, ref(1, 'monster', 0)));
    expect(r.state.players[1].monsters[0]).toBeNull();
  });

  it('face-down it has no shroud', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'tide_harpooner', faceUp: false }], field: 'tidal_bay' } });
    expect(isListed(s, atk(0, 0, 0))).toBe(true);
    expect(isListed(s, atk(0, 0, null))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('C2 Kadran Soytarısı (coinWipe, once per turn) + C3 Bulut Yavrusu', () => {
  const s0 = () =>
    scenario({
      p0: { monsters: ['dial_jester', 'shade_assassin', null] },
      p1: { monsters: ['crystal_wyrm', 'stone_sentinel', null] },
    });

  it('needs a face-up jester and an opposing monster; opens a coinCall for its controller', () => {
    const s = s0();
    expect(isListed(s, coinAct(0, 0))).toBe(true);
    expect(isListed(s, coinAct(0, 1))).toBe(false); // the assassin has no ignition effect
    const empty = scenario({ p0: { monsters: ['dial_jester'] } });
    expect(isListed(empty, coinAct(0, 0))).toBe(false);
    const down = scenario({ p0: { monsters: [{ id: 'dial_jester', faceUp: false }] }, p1: { monsters: ['stone_sentinel'] } });
    expect(isListed(down, coinAct(0, 0))).toBe(false);
    const r = play(s, coinAct(0, 0));
    expect(r.state.pending).toMatchObject({ kind: 'coinCall', player: 0 });
    expect(evs(r.state, r.events)).toEqual(['activate:dial_jester', 'decision:coinCall']);
    expect(legalActions(r.state)).toEqual([call(0, 'heads'), call(0, 'tails')]);
  });

  it('right call: every opposing monster is destroyed (one mass pass), no damage', () => {
    let { state } = play(s0(), coinAct(0, 0));
    const c = nextCoin(state);
    const r = play(state, call(0, c));
    state = r.state;
    const toss = r.events.find((e) => e.type === 'coinToss')!;
    expect(toss).toMatchObject({ call: c, result: c, win: true });
    expect(types(r.events)).toContain('massDestroy');
    expect(state.players[1].monsters.every((m) => !m)).toBe(true);
    expect(gy(state, 1).sort()).toEqual(['crystal_wyrm', 'stone_sentinel']);
    expect(state.players[0].lp).toBe(4000);
    expect(at(state, 0, 0)).toBe('dial_jester');
  });

  it('wrong call: every own monster (jester included) is destroyed and half their ATK is taken as damage', () => {
    let { state } = play(s0(), coinAct(0, 0));
    const r = play(state, call(0, flipFace(nextCoin(state))));
    state = r.state;
    expect(r.events.find((e) => e.type === 'coinToss')).toMatchObject({ win: false });
    expect(state.players[0].monsters.every((m) => !m)).toBe(true);
    expect(state.players[1].monsters.filter(Boolean)).toHaveLength(2);
    expect(state.players[0].lp).toBe(4000 - Math.floor((700 + 1900) / 2));
  });

  it('wrong call: a guardian_charm saves its monster and that monster is not counted; a token adds 0', () => {
    const s = scenario({
      p0: { monsters: ['dial_jester', 'crystal_wyrm', 'straw_decoy_token'], spellTraps: [{ id: 'guardian_charm', equippedTo: 1 }] },
      p1: { monsters: ['stone_sentinel'] },
    });
    s.players[0].monsters[2]!.token = true;
    s.players[0].monsters[2]!.position = 'defense';
    let { state } = play(s, coinAct(0, 0));
    const r = play(state, call(0, flipFace(nextCoin(state))));
    state = r.state;
    expect(at(state, 0, 1)).toBe('crystal_wyrm'); // saved by the charm
    expect(gy(state, 0)).toContain('guardian_charm');
    expect(types(r.events)).toContain('tokenVanish');
    expect(state.players[0].lp).toBe(4000 - 350); // only the jester's 700 / 2
  });

  it('once per turn (owner decision): not again this turn, again on the next own turn', () => {
    let { state } = play(s0(), coinAct(0, 0));
    state = play(state, call(0, flipFace(flipFace(nextCoin(state))))).state; // a right call
    state.players[1].monsters[0] = { uid: uidOf(state, 'crystal_wyrm', 1), position: 'attack', faceUp: true, enteredTurn: 1, attacksThisTurn: 0, positionChangedTurn: -1 };
    state.players[1].graveyard = state.players[1].graveyard.filter((u) => state.cards[u].cardId !== 'crystal_wyrm');
    expect(isListed(state, coinAct(0, 0))).toBe(false);
    state = play(state, endTurn(0), endTurn(1)).state;
    expect(isListed(state, coinAct(0, 0))).toBe(true);
  });

  it('works for player 2 on a 5-zone board too', () => {
    const s = scenario({ zones: 5, active: 1, turn: 4, p1: { monsters: [null, null, null, null, 'dial_jester'] }, p0: { monsters: ['shade_assassin', 'stone_sentinel'] } });
    let { state } = play(s, coinAct(1, 4));
    state = play(state, call(1, nextCoin(state))).state;
    expect(state.players[0].monsters.every((m) => !m)).toBe(true);
  });

  it('Bulut Yavrusu grows on a right call (2300/1700, permanent, once each); not face-down; it dies on a wrong call', () => {
    const s = scenario({
      p0: { monsters: ['dial_jester', 'cloud_hatchling', { id: 'cloud_hatchling', faceUp: false }] },
      p1: { monsters: ['stone_sentinel'] },
    });
    let { state } = play(s, coinAct(0, 0));
    const r = play(state, call(0, nextCoin(state)));
    state = r.state;
    const up = state.players[0].monsters[1]!.uid;
    const down = state.players[0].monsters[2]!.uid;
    expect([currentAtk(state, up), currentDef(state, up)]).toEqual([2300, 1700]);
    expect(currentDef(state, down)).toBe(900);
    expect(evs(state, r.events)).toContain('activate:cloud_hatchling');
    expect(evs(state, r.events)).toContain('statChange:cloud_hatchling:1100>2300');
    // permanent: two turns later still grown; a second right call does not stack
    state = play(state, endTurn(0), endTurn(1)).state;
    expect(currentAtk(state, up)).toBe(2300);
    state.players[1].monsters[0] = { uid: 999, position: 'attack', faceUp: true, enteredTurn: 1, attacksThisTurn: 0, positionChangedTurn: -1 };
    state.cards[999] = { uid: 999, cardId: 'stone_sentinel', owner: 1 };
    state = play(state, coinAct(0, 0)).state;
    state = play(state, call(0, nextCoin(state))).state;
    expect(currentAtk(state, up)).toBe(2300);
    // a wrong call takes the hatchling too
    const w = scenario({ p0: { monsters: ['dial_jester', 'cloud_hatchling'] }, p1: { monsters: ['stone_sentinel'] } });
    let ws = play(w, coinAct(0, 0)).state;
    ws = play(ws, call(0, flipFace(nextCoin(ws)))).state;
    expect(gy(ws, 0)).toContain('cloud_hatchling');
    expect(ws.players[0].lp).toBe(4000 - Math.floor((700 + 1100) / 2));
  });

  it('combo: a right call on the opposing Kutup Hükümdarı splits it into the three pieces (their field emptied)', () => {
    const s = scenario({
      p0: { monsters: ['dial_jester'] },
      p1: { monsters: [null, 'polar_sovereign', null], graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'] },
    });
    let { state } = play(s, coinAct(0, 0));
    const r = play(state, call(0, nextCoin(state)));
    state = r.state;
    expect(state.players[1].monsters.map((m) => (m ? state.cards[m.uid].cardId : null))).toEqual(['polar_needle', 'polar_anvil', 'polar_coil']);
    expect(state.players[1].monsters.every((m) => m && m.position === 'defense' && m.faceUp)).toBe(true);
    expect(gy(state, 1)).toEqual(['polar_sovereign']);
    const seqs = evs(state, r.events);
    expect(seqs.indexOf('activate:polar_sovereign')).toBeGreaterThan(seqs.indexOf('destroy:polar_sovereign'));
  });

  it('the coin is seeded: the same state gives the same toss', () => {
    const a = play(s0(), coinAct(0, 0)).state;
    const r1 = apply(a, call(0, 'heads'));
    const r2 = apply(a, call(0, 'heads'));
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });
});

// ---------------------------------------------------------------------------------------------
describe('C4 / C7 / C8 / C11 vanilla monsters', () => {
  it('summon without tributes with their printed stats; field and aura modifiers apply', () => {
    for (const id of ['reflection_archer', 'crag_axeman', 'reed_heron', 'steppe_spiralhorn'] as CardId[]) {
      const s = scenario({ p0: { hand: [id] } });
      const u = uidOf(s, id, 0);
      const r = play(s, { type: 'normalSummon', player: 0, uid: u, zone: 0, tributes: [] });
      expect(currentAtk(r.state, u), id).toBe(M(id).atk);
    }
    const bay = scenario({ p0: { monsters: ['reed_heron'], field: 'tidal_bay' } });
    expect(currentAtk(bay, bay.players[0].monsters[0]!.uid)).toBe(1800);
    const lady = scenario({ p0: { monsters: ['steppe_spiralhorn', 'wing_lady'] } });
    expect(currentAtk(lady, lady.players[0].monsters[0]!.uid)).toBe(1800);
  });
});

// ---------------------------------------------------------------------------------------------
describe('C5 Hurda Akıncıları (attackThenDefense)', () => {
  const s0 = (opp: (CardId | null)[] = []) => scenario({ phase: 'battle', p0: { monsters: ['scrap_raiders'] }, p1: { monsters: opp } });

  it('after attacking it turns to defense at the end of the Battle Phase and is locked on its next turn', () => {
    let r = play(s0(['stone_sentinel']), atk(0, 0, 0));
    const u = r.state.players[0].monsters[0]!.uid;
    expect(r.state.players[1].monsters[0]).toBeNull(); // 2000 against the sentinel's ATK 500
    r = play(r.state, endTurn(0));
    const slot = r.state.players[0].monsters[0]!;
    expect([slot.uid, slot.position]).toEqual([u, 'defense']);
    expect(evs(r.state, r.events)).toContain('positionChange:scrap_raiders');
    let st = play(r.state, endTurn(1)).state; // its next turn
    expect(isListed(st, { type: 'changePosition', player: 0, zone: 0 })).toBe(false);
    st = play(st, endTurn(0), endTurn(1)).state; // the turn after
    expect(isListed(st, { type: 'changePosition', player: 0, zone: 0 })).toBe(true);
  });

  it('a direct attack counts; an attack negated by Işık Zincirleri still counts (the battle ends)', () => {
    const d = play(s0(), atk(0, 0, null), endTurn(0)).state;
    expect(d.players[0].monsters[0]!.position).toBe('defense');
    expect(d.players[1].lp).toBe(2000);
    const c = scenario({ phase: 'battle', p0: { monsters: ['scrap_raiders'] }, p1: { spellTraps: ['chains_of_light'] } });
    let r = play(c, atk(0, 0, null));
    r = play(r.state, respond(r.state, 'chains_of_light', 1));
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.players[0].monsters[0]!.position).toBe('defense');
    expect(r.state.players[0].monsters[0]!.lockPositionTurn).toBe(c.turn + 2);
  });

  it('no attack, no change; destroyed in battle, nothing happens', () => {
    const n = play(s0(['stone_sentinel']), endTurn(0)).state;
    expect(n.players[0].monsters[0]!.position).toBe('attack');
    const big = scenario({ phase: 'battle', p0: { monsters: ['scrap_raiders'] }, p1: { monsters: ['crystal_wyrm'] } });
    const r = play(big, atk(0, 0, 0), endTurn(0));
    expect(r.state.players[0].monsters[0]).toBeNull();
  });

  it('Volkan Arenası: 2500', () => {
    const s = scenario({ p0: { monsters: ['scrap_raiders'], field: 'volcano_arena' } });
    expect(currentAtk(s, s.players[0].monsters[0]!.uid)).toBe(2500);
  });
});

// ---------------------------------------------------------------------------------------------
describe('C6 Kovuk Devi (banishGraveBoost400)', () => {
  const ogreAct: Action = { type: 'activateMonster', player: 0, zone: 0 };
  it('one monster in the graveyard: banished at once, +400 this turn', () => {
    const s = scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['judgment_bolt', 'stone_sentinel'] } });
    const r = play(s, ogreAct);
    const u = r.state.players[0].monsters[0]!.uid;
    expect(currentAtk(r.state, u)).toBe(1800);
    expect(r.state.players[0].banished!.map((x) => r.state.cards[x].cardId)).toEqual(['stone_sentinel']);
    expect(gy(r.state, 0)).toEqual(['judgment_bolt']);
    expect(types(r.events)).toEqual(expect.arrayContaining(['activate', 'banish', 'statChange']));
    expect(r.state.pending).toBeNull();
  });

  it('several monsters: chooseCount 1..2; the OLDEST ones go (the last to die is kept); 2 = 2200', () => {
    const s = scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['ember_wolf', 'volt_lizard', 'shade_assassin'] } });
    let r = play(s, ogreAct);
    expect(r.state.pending).toMatchObject({ kind: 'chooseCount', min: 1, max: 2 });
    expect(legalActions(r.state)).toEqual([
      { type: 'chooseCount', player: 0, n: 1 },
      { type: 'chooseCount', player: 0, n: 2 },
    ]);
    r = play(r.state, { type: 'chooseCount', player: 0, n: 2 });
    const u = r.state.players[0].monsters[0]!.uid;
    expect(currentAtk(r.state, u)).toBe(2200);
    expect(gy(r.state, 0)).toEqual(['shade_assassin']);
    expect(r.state.players[0].banished!.map((x) => r.state.cards[x].cardId)).toEqual(['ember_wolf', 'volt_lizard']);
  });

  it('once per turn; the boost ends with the turn; soul_recall cannot see banished cards', () => {
    const s = scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['stone_sentinel', 'ember_wolf'], hand: ['soul_recall'] } });
    let st = play(s, ogreAct).state;
    st = play(st, { type: 'chooseCount', player: 0, n: 1 }).state;
    expect(isListed(st, ogreAct)).toBe(false);
    const recall = spellActs(st, 'soul_recall');
    expect(recall.every((a) => a.target?.kind === 'graveyard' && st.cards[a.target.uid].cardId !== 'stone_sentinel')).toBe(true);
    st = play(st, endTurn(0)).state;
    expect(currentAtk(st, st.players[0].monsters[0]!.uid)).toBe(1400);
  });

  it('not offered without a monster in its graveyard or face-down', () => {
    expect(isListed(scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['judgment_bolt'] } }), ogreAct)).toBe(false);
    expect(isListed(scenario({ p0: { monsters: [{ id: 'hollow_ogre', faceUp: false }], graveyard: ['ember_wolf'] } }), ogreAct)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('C9 Uçurtma Eskrimci (doubleAttackMonster)', () => {
  it('attacks two monsters in one Battle Phase', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['kite_fencer'] }, p1: { monsters: ['wisp_imp', 'lumen_sprite'] } });
    let st = play(s, atk(0, 0, 0)).state;
    expect(isListed(st, atk(0, 0, 1))).toBe(true);
    st = play(st, atk(0, 0, 1)).state;
    expect(st.players[1].monsters.every((m) => !m)).toBe(true);
    expect(legalOf(st, 'attack')).toEqual([]); // no third
  });

  it('the second attack is never direct (first direct with an empty field, then nothing)', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['kite_fencer'] } });
    let st = play(s, atk(0, 0, null)).state;
    expect(st.players[1].lp).toBe(3100);
    expect(legalOf(st, 'attack')).toEqual([]);
    // after destroying the only monster the second attack has no target
    const t = scenario({ phase: 'battle', p0: { monsters: ['kite_fencer'] }, p1: { monsters: ['wisp_imp'] } });
    st = play(t, atk(0, 0, 0)).state;
    expectIllegal(st, atk(0, 0, null));
  });

  it('with battle_cry: one direct 1900 + a monster attack (no one-turn kill)', () => {
    const s = scenario({ p0: { monsters: ['kite_fencer'], hand: ['battle_cry'] } });
    let st = play(s, sp(s, 'battle_cry', 0, { target: mon(0, 0) }), battle(0), atk(0, 0, null)).state;
    expect(st.players[1].lp).toBe(4000 - 1900);
    expect(legalOf(st, 'attack')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('C10 Çamur Pençe Ruhu (defenseAttackedPin)', () => {
  it('attacked in defense: the attacker turns to defense and cannot change position on its next turn', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'mudgrasp_spirit', position: 'defense' }] } });
    let r = play(s, atk(0, 0, 0));
    expect(r.state.players[1].monsters[0]).toBeNull(); // 1900 > 1800: the spirit dies, the pin still resolves
    expect(r.state.players[0].monsters[0]!.position).toBe('defense');
    const seqs = evs(r.state, r.events);
    expect(seqs.indexOf('activate:mudgrasp_spirit')).toBeGreaterThan(seqs.indexOf('battle:targetDestroyed'));
    let st = play(r.state, endTurn(0), endTurn(1)).state;
    expect(isListed(st, { type: 'changePosition', player: 0, zone: 0 })).toBe(false);
    st = play(st, endTurn(0), endTurn(1)).state;
    expect(isListed(st, { type: 'changePosition', player: 0, zone: 0 })).toBe(true);
  });

  it('set (face-down) and attacked: it flips and pins; in attack position: no pin', () => {
    const fd = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'mudgrasp_spirit', faceUp: false }] } });
    const r = play(fd, atk(0, 0, 0));
    expect(r.state.players[0].monsters[0]!.position).toBe('defense');
    expect(r.state.players[1].lp).toBe(4000);
    expect(r.state.players[0].lp).toBe(4000 - 100); // 1700 vs 1800
    const up = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: ['mudgrasp_spirit'] } });
    const u = play(up, atk(0, 0, 0));
    expect(u.state.players[0].monsters[0]!.position).toBe('attack');
  });
});

// ---------------------------------------------------------------------------------------------
describe('C12-C15 Kutup family: fusion (specialSummon) and split', () => {
  const pieces = (p: 0 | 1): (CardId | { id: CardId; faceUp: boolean })[] => ['polar_needle', { id: 'polar_anvil', faceUp: false }, 'polar_coil'];
  const fuse = (s: GameState, p: 0 | 1 = 0) => legalOf(s, 'specialSummon').find((a) => a.player === p)!;

  it('three pieces (face-up or face-down) + Hükümdar in hand: one specialSummon into the middle tribute zone', () => {
    const s = scenario({ p0: { monsters: pieces(0), hand: ['polar_sovereign'] } });
    const acts = legalOf(s, 'specialSummon');
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ zone: 1 });
    const r = play(s, fuse(s));
    expect(at(r.state, 0, 1)).toBe('polar_sovereign');
    expect(r.state.players[0].monsters[0]).toBeNull();
    expect(gy(r.state, 0).sort()).toEqual(['polar_anvil', 'polar_coil', 'polar_needle']);
    const seqs = evs(r.state, r.events);
    expect(seqs.filter((x) => x.startsWith('tribute:'))).toHaveLength(3);
    expect(r.events.find((e) => e.type === 'summon')).toMatchObject({ method: 'special', from: 'hand', position: 'attack' });
    expect(r.state.players[0].normalSummonUsed).toBe(false); // the Normal Summon stays
  });

  it('never Normal Summoned or Set — not even with Çifte Kurban; needs all three pieces; only in the Main Phase', () => {
    const s = scenario({ p0: { monsters: ['polar_needle', 'polar_anvil', 'crystal_wyrm'], hand: ['polar_sovereign', 'double_offering'] } });
    expect(legalActions(s).some((a) => (a.type === 'normalSummon' || a.type === 'setMonster') && s.cards[a.uid].cardId === 'polar_sovereign')).toBe(false);
    expect(legalOf(s, 'specialSummon')).toEqual([]);
    const d = play(s, sp(s, 'double_offering')).state;
    expect(legalActions(d).some((a) => (a.type === 'normalSummon' || a.type === 'setMonster') && d.cards[a.uid].cardId === 'polar_sovereign')).toBe(false);
    const b = scenario({ phase: 'battle', p0: { monsters: pieces(0), hand: ['polar_sovereign'] } });
    expect(legalOf(b, 'specialSummon')).toEqual([]);
  });

  it('a borrowed piece (puppet_string) can be a tribute: it goes to its OWNER\'s graveyard', () => {
    const s = scenario({ p0: { monsters: ['polar_needle', 'polar_anvil', null], hand: ['polar_sovereign', 'puppet_string'] }, p1: { monsters: ['polar_coil'] } });
    let st = play(s, sp(s, 'puppet_string', 0, { target: mon(1, 0) })).state;
    expect(at(st, 0, 2)).toBe('polar_coil');
    st = play(st, fuse(st)).state;
    expect(gy(st, 1)).toEqual(['polar_coil']);
    expect(gy(st, 0).sort()).toEqual(['polar_anvil', 'polar_needle', 'puppet_string'].sort());
  });

  it('Devrilen Kule answers the fusion (Special Summon, ATK 3000)', () => {
    const s = scenario({ p0: { monsters: pieces(0), hand: ['polar_sovereign'] }, p1: { spellTraps: ['toppling_tower'] } });
    let r = play(s, fuse(s));
    expect(r.state.pending?.kind).toBe('trapResponse');
    r = play(r.state, respond(r.state, 'toppling_tower', 1));
    // destroyed by an effect; the pieces are in the graveyard and 3 zones are free: it splits
    expect(r.state.players[0].monsters.map((m) => (m ? r.state.cards[m.uid].cardId : null))).toEqual(['polar_needle', 'polar_anvil', 'polar_coil']);
  });

  it('destroyed in battle: the latest copy of each piece comes back in defense; a summon was not spent', () => {
    const s = scenario({
      zones: 5,
      phase: 'battle',
      p0: { monsters: ['crystal_wyrm'], hand: [], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] },
      p1: { monsters: [null, null, 'polar_sovereign'], graveyard: ['polar_needle', 'polar_anvil', 'polar_coil', 'polar_needle'] },
    });
    const newestNeedle = s.players[1].graveyard[3];
    const r = play(s, atk(0, 0, 2));
    const ms = r.state.players[1].monsters;
    expect(ms.filter(Boolean).map((m) => r.state.cards[m!.uid].cardId)).toEqual(['polar_needle', 'polar_anvil', 'polar_coil']);
    expect(ms[0]!.uid).toBe(newestNeedle);
    expect(gy(r.state, 1)).toEqual(['polar_needle', 'polar_sovereign']);
  });

  it('no split: a piece missing, fewer than 3 free zones, tributed / bounced (not destroyed)', () => {
    const miss = scenario({ p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['polar_sovereign'], graveyard: ['polar_needle', 'polar_anvil'] } });
    let st = play(miss, sp(miss, 'judgment_bolt', 0, { target: mon(1, 0) })).state;
    expect(st.players[1].monsters.every((m) => !m)).toBe(true);
    const full = scenario({ p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['polar_sovereign', 'stone_sentinel'], graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'] } });
    st = play(full, sp(full, 'judgment_bolt', 0, { target: mon(1, 0) })).state;
    expect(st.players[1].monsters.filter(Boolean)).toHaveLength(1); // only 2 free zones on a 3-zone board
    const trib = scenario({ p0: { monsters: ['polar_sovereign'], hand: ['crystal_wyrm'], graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'] } });
    trib.players[0].monsters[1] = { uid: 500, position: 'attack', faceUp: true, enteredTurn: 2, attacksThisTurn: 0, positionChangedTurn: -1 };
    trib.cards[500] = { uid: 500, cardId: 'stone_sentinel', owner: 0 };
    const summon = legalActions(trib).find((a) => a.type === 'normalSummon' && trib.cards[a.uid].cardId === 'crystal_wyrm')!;
    st = play(trib, summon).state;
    expect(st.players[0].monsters.filter(Boolean).map((m) => st.cards[m!.uid].cardId)).toEqual(['crystal_wyrm']);
  });

  it('borrowed Hükümdar destroyed: owner\'s graveyard and the pieces come back on the OWNER\'s field', () => {
    const s = scenario({
      p0: { hand: ['puppet_string', 'judgment_bolt'] },
      p1: { monsters: ['polar_sovereign'], graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'] },
    });
    let st = play(s, sp(s, 'puppet_string', 0, { target: mon(1, 0) })).state;
    expect(at(st, 0, 0)).toBe('polar_sovereign');
    // my own spells cannot target my borrowed monster: a hedefsiz Boşluk Gözü destroys it
    st.players[0].hand.push(900);
    st.cards[900] = { uid: 900, cardId: 'void_eye', owner: 0 };
    const r = play(st, sp(st, 'void_eye'));
    st = r.state;
    expect(gy(st, 1)).toEqual(['polar_sovereign']);
    expect(st.players[1].monsters.map((m) => (m ? st.cards[m.uid].cardId : null))).toEqual(['polar_needle', 'polar_anvil', 'polar_coil']);
    expect(st.players[0].monsters.every((m) => !m)).toBe(true);
  });

  it('no limit: a Hükümdar split once, revived with soul_recall, splits again', () => {
    const s = scenario({
      zones: 5,
      p0: { hand: ['judgment_bolt'] },
      p1: { monsters: ['polar_sovereign'], graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'], hand: ['soul_recall', 'void_eye'] },
    });
    // first split
    let st = play(s, sp(s, 'judgment_bolt', 0, { target: mon(1, 0) }), endTurn(0)).state;
    expect(st.players[1].monsters.filter(Boolean).map((m) => st.cards[m!.uid].cardId)).toEqual(['polar_needle', 'polar_anvil', 'polar_coil']);
    // P2 wipes its own pieces (Boşluk Gözü), then revives the Hükümdar
    st = play(st, sp(st, 'void_eye', 1)).state;
    expect(gy(st, 1).sort()).toEqual(['polar_anvil', 'polar_coil', 'polar_needle', 'polar_sovereign', 'void_eye'].sort());
    const rec = spellActs(st, 'soul_recall', 1).find((a) => a.target?.kind === 'graveyard' && st.cards[a.target.uid].cardId === 'polar_sovereign' && a.target.toZone === 0)!;
    st = play(st, rec).state;
    expect(at(st, 1, 0)).toBe('polar_sovereign');
    // P1 destroys it again: second split
    st.players[0].hand.push(901);
    st.cards[901] = { uid: 901, cardId: 'judgment_bolt', owner: 0 };
    st = play(st, endTurn(1)).state;
    st = play(st, { type: 'activateSpell', player: 0, uid: 901, target: mon(1, 0) }).state;
    expect(st.players[1].monsters.filter(Boolean).map((m) => st.cards[m!.uid].cardId)).toEqual(['polar_needle', 'polar_anvil', 'polar_coil']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('ignition actions are rejected outside their window', () => {
  it('no activateMonster in the battle phase or during a pending decision', () => {
    const b = scenario({ phase: 'battle', p0: { monsters: ['dial_jester'] }, p1: { monsters: ['stone_sentinel'] } });
    expectIllegal(b, coinAct(0, 0));
    const p = play(scenario({ p0: { monsters: ['dial_jester'] }, p1: { monsters: ['stone_sentinel'] } }), coinAct(0, 0)).state;
    expectIllegal(p, coinAct(0, 0));
    expectIllegal(p, { type: 'chooseCount', player: 0, n: 1 });
  });
  it('answering a 1-copy jester with the opponent\'s Büyü Mührü is not possible (a monster effect opens no spell window)', () => {
    const s = scenario({ p0: { monsters: ['dial_jester'] }, p1: { monsters: ['stone_sentinel'], spellTraps: ['spell_seal'] } });
    const r = play(s, coinAct(0, 0));
    expect(r.state.pending?.kind).toBe('coinCall');
    void decline;
  });
});
