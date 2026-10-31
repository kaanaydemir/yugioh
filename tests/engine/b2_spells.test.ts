// Batch 2 spells (docs/v3/YENI_KARTLAR.md §7, owner decisions 2026-10-31: no Yaldızlı Kafes, quick spells yes)
// and their engine mechanics: draw / discard, control switch, mass destruction, quick spells with the response
// window (nested spell_seal, LIFO), tokens, the return-to-deck equip, hand refresh and the seeded die.
import { describe, expect, it } from 'vitest';
import { currentAtk, currentDef, legalActions, type Action, type GameState, type PlayerId } from '../../src/engine';
import { CARDS, SPELL_IDS, isSpell, type CardId, type SpellCardDef } from '../../src/data/cards';
import {
  at,
  atk,
  battle,
  card,
  choose,
  decline,
  endTurn,
  evs,
  expectIllegal,
  gy,
  isListed,
  legalOf,
  mon,
  nextDie,
  play,
  ref,
  respond,
  scenario,
  sp,
  spellActs,
  types,
  uidOf,
} from './b2_kit';

const S = (id: CardId) => CARDS[id] as SpellCardDef;
const summon = (s: GameState, id: CardId, p: PlayerId = 0, zone = 0): Action => ({ type: 'normalSummon', player: p, uid: uidOf(s, id, p), zone, tributes: [] });
const setST = (s: GameState, id: CardId, p: PlayerId, zone: number): Action => ({ type: 'setSpellTrap', player: p, uid: uidOf(s, id, p), zone });

// ---------------------------------------------------------------------------------------------
describe('batch 2 spell data', () => {
  const rows: [CardId, string, SpellCardDef['spellType'], string][] = [
    ['well_pail', 'Kuyu Kovası', 'normal', 'draw2'],
    ['puppet_string', 'Kukla İpi', 'normal', 'controlUntilEnd'],
    ['void_eye', 'Boşluk Gözü', 'normal', 'destroyAllMonsters'],
    ['sweeping_gale', 'Süpürge Rüzgarı', 'normal', 'destroyAllOppSpellTrap'],
    ['winnow_sieve', 'Harman Eleği', 'normal', 'draw3Discard2'],
    ['auger_lance', 'Burgu Mızrağı', 'quick', 'destroySpellTrapQuick'],
    ['soul_leash', 'Ruh Tasması', 'equip', 'equipControl'],
    ['straw_decoys', 'Saman Korkuluklar', 'quick', 'strawTokens'],
    ['spite_axe', 'Hınç Baltası', 'equip', 'equipAtk800Return'],
    ['page_turner', 'Sayfa Çeviren', 'normal', 'handRefreshBoth'],
    ['lucky_die', 'Talih Zarı', 'normal', 'diceBoost100'],
  ];
  it('11 spells (Yaldızlı Kafes dropped): names, types, effects; the two quick spells', () => {
    for (const [id, name, type, eff] of rows) {
      const d = S(id);
      expect([d.name, d.spellType, d.effect], id).toEqual([name, type, eff]);
      expect(SPELL_IDS).toContain(id);
      expect(d.text.length).toBeGreaterThan(10);
    }
    expect(S('auger_lance').text).toMatch(/^Hızlı Büyü\./);
    expect(S('straw_decoys').text).toMatch(/^Hızlı Büyü\./);
    expect(Object.values(CARDS).filter((c) => isSpell(c) && c.spellType === 'quick').map((c) => c.id).sort()).toEqual(['auger_lance', 'straw_decoys']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('S1 Kuyu Kovası (draw2) and S5 Harman Eleği (draw3Discard2)', () => {
  for (const p of [0, 1] as PlayerId[])
    it(`P${p + 1}: Kova draws 2; needs 2 cards in the deck`, () => {
      const s = scenario({ active: p, turn: p ? 4 : 3, [p ? 'p1' : 'p0']: { hand: ['well_pail'] } });
      const r = play(s, sp(s, 'well_pail', p));
      expect(r.state.players[p].hand).toHaveLength(2);
      expect(evs(r.state, r.events).filter((e) => e.startsWith('draw'))).toHaveLength(2);
      const thin = scenario({ active: p, turn: p ? 4 : 3, [p ? 'p1' : 'p0']: { hand: ['well_pail'], deck: ['stone_sentinel'] } });
      expect(spellActs(thin, 'well_pail', p)).toEqual([]);
    });

  it('Kova: a first draw that completes the five seals wins; the second card stays in the deck', () => {
    const s = scenario({ p0: { hand: ['well_pail', 'seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r'], deck: ['seal_leg_l', 'stone_sentinel'] } });
    const r = play(s, sp(s, 'well_pail'));
    expect(r.state.winner).toBe(0);
    expect(r.state.winReason).toBe('seals');
    expect(r.state.players[0].deck).toHaveLength(1);
  });

  it('Elek draws 3, then asks a Main Phase cost discard of 2; needs 3 cards in the deck', () => {
    const s = scenario({ p0: { hand: ['winnow_sieve', 'ember_wolf'], deck: ['stone_sentinel', 'lumen_sprite', 'volt_lizard', 'tide_golem'] } });
    let r = play(s, sp(s, 'winnow_sieve'));
    expect(r.state.pending).toMatchObject({ kind: 'discard', count: 2, cost: true });
    expect(r.state.players[0].hand).toHaveLength(4);
    const d = legalOf(r.state, 'discard')[0] as Extract<Action, { type: 'discard' }>;
    expect(d.uids).toHaveLength(2);
    r = play(r.state, d);
    expect(r.state.players[0].hand).toHaveLength(2);
    expect(r.state.phase).toBe('main');
    expect(gy(r.state, 0)).toHaveLength(3);
    const thin = scenario({ p0: { hand: ['winnow_sieve'], deck: ['stone_sentinel', 'stone_sentinel'] } });
    expect(spellActs(thin, 'winnow_sieve')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('S2 Kukla İpi (controlUntilEnd): control switch until the End Phase', () => {
  it('takes the target to my first free zone; it can attack; it goes back in the End Phase', () => {
    const s = scenario({ p0: { monsters: ['stone_sentinel'], hand: ['puppet_string'] }, p1: { monsters: [null, 'crystal_wyrm'] } });
    const u = s.players[1].monsters[1]!.uid;
    let r = play(s, sp(s, 'puppet_string', 0, { target: mon(1, 1) }));
    expect(at(r.state, 0, 1)).toBe('crystal_wyrm');
    expect(r.state.players[0].monsters[1]!.borrowed).toEqual({ owner: 1, until: 'endPhase', byUid: uidOf(s, 'puppet_string', 0) });
    expect(r.events.find((e) => e.type === 'controlChange')).toMatchObject({ uid: u, from: 1, to: 0, fromZone: 1, toZone: 1, reason: 'take', cardId: 'crystal_wyrm' });
    r = play(r.state, battle(0), atk(0, 1, null));
    expect(r.state.players[1].lp).toBe(4000 - 2800);
    r = play(r.state, endTurn(0));
    expect(at(r.state, 1, 0)).toBe('crystal_wyrm');
    expect(r.state.players[1].monsters[0]!.borrowed).toBeUndefined();
    const seqs = evs(r.state, r.events);
    expect(seqs.indexOf('controlChange:crystal_wyrm')).toBeGreaterThan(seqs.indexOf('phaseChange:end'));
  });

  it('no free zone at the owner: destroyed by rule into the OWNER\'s graveyard', () => {
    const s = scenario({ p0: { hand: ['puppet_string'] }, p1: { monsters: ['crystal_wyrm', null, null], hand: ['stone_sentinel', 'ember_wolf'] } });
    let st = play(s, sp(s, 'puppet_string', 0, { target: mon(1, 0) })).state;
    // the owner's zones fill up before the End Phase (test-built)
    st.players[1].monsters[0] = { uid: 700, position: 'attack', faceUp: true, enteredTurn: 1, attacksThisTurn: 0, positionChangedTurn: -1 };
    st.players[1].monsters[1] = { uid: 701, position: 'attack', faceUp: true, enteredTurn: 1, attacksThisTurn: 0, positionChangedTurn: -1 };
    st.players[1].monsters[2] = { uid: 702, position: 'attack', faceUp: true, enteredTurn: 1, attacksThisTurn: 0, positionChangedTurn: -1 };
    for (const u of [700, 701, 702]) st.cards[u] = { uid: u, cardId: 'stone_sentinel', owner: 1 };
    const r = play(st, endTurn(0));
    expect(r.events.find((e) => e.type === 'destroy')).toMatchObject({ cardId: 'crystal_wyrm', reason: 'rule' });
    expect(gy(r.state, 1)).toEqual(['crystal_wyrm']);
  });

  it('can be tributed (owner\'s graveyard); a face-down target comes face-down; equips go with it', () => {
    const s = scenario({
      p0: { hand: ['puppet_string', 'crystal_wyrm'], monsters: ['stone_sentinel'] },
      p1: { monsters: ['ember_wolf', { id: 'thorn_lurker', faceUp: false }], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] },
    });
    let st = play(s, sp(s, 'puppet_string', 0, { target: mon(1, 0) })).state;
    expect(currentAtk(st, st.players[0].monsters[1]!.uid)).toBe(2400); // the opponent's blade stays on it
    const trib = legalActions(st).find((a) => a.type === 'normalSummon' && st.cards[a.uid].cardId === 'crystal_wyrm' && a.tributes.length === 2)!;
    st = play(st, trib).state;
    expect(gy(st, 1)).toEqual(['ember_wolf', 'dragon_blade']);
    const fd = scenario({ p0: { hand: ['puppet_string'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }] } });
    const r = play(fd, sp(fd, 'puppet_string', 0, { target: mon(1, 0) }));
    expect(r.state.players[0].monsters[0]!.faceUp).toBe(false);
    expect(r.events.find((e) => e.type === 'controlChange')).toMatchObject({ cardId: null });
  });

  it('needs a free own monster zone; never a token, a hat or a shrouded harpooner', () => {
    const full = scenario({ p0: { hand: ['puppet_string'], monsters: ['stone_sentinel', 'stone_sentinel', 'stone_sentinel'] }, p1: { monsters: ['ember_wolf'] } });
    expect(spellActs(full, 'puppet_string')).toEqual([]);
    const tok = scenario({ p0: { hand: ['puppet_string'] }, p1: { monsters: ['straw_decoy_token', 'ember_wolf'] } });
    tok.players[1].monsters[0]!.token = true;
    expect(spellActs(tok, 'puppet_string').map((a) => a.target)).toEqual([mon(1, 1)]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('S3 Boşluk Gözü (destroyAllMonsters) and S4 Süpürge Rüzgarı (destroyAllOppSpellTrap)', () => {
  it('Göz: every monster of both sides in one pass; guardian_charm saves its own; decoys / tokens vanish', () => {
    const s = scenario({
      p0: { hand: ['void_eye'], monsters: ['crystal_wyrm', 'straw_decoy_token'] },
      p1: { monsters: ['stone_sentinel', 'ember_wolf'], spellTraps: [{ id: 'guardian_charm', equippedTo: 1 }] },
    });
    s.players[0].monsters[1]!.token = true;
    const r = play(s, sp(s, 'void_eye'));
    const mass = r.events.find((e) => e.type === 'massDestroy')!;
    expect(mass).toMatchObject({ player: 0, refs: [ref(0, 'monster', 0), ref(0, 'monster', 1), ref(1, 'monster', 0), ref(1, 'monster', 1)] });
    expect(r.state.players[0].monsters.every((m) => !m)).toBe(true);
    expect(at(r.state, 1, 1)).toBe('ember_wolf');
    expect(gy(r.state, 1)).toEqual(['stone_sentinel', 'guardian_charm']);
    expect(types(r.events)).toContain('tokenVanish');
    expect(gy(r.state, 0)).toEqual(['crystal_wyrm', 'void_eye']);
  });

  it('Rüzgar: every opposing spell/trap and the field spell (face-down too); my own untouched; Büyü Mührü may answer it', () => {
    const s = scenario({
      p0: { hand: ['sweeping_gale'], spellTraps: ['mirror_barrier'], monsters: ['ember_wolf'] },
      p1: { spellTraps: ['chains_of_light', { id: 'dragon_blade', equippedTo: 0 }, 'healing_spring'], monsters: ['stone_sentinel'], field: 'volcano_arena' },
    });
    const r = play(s, sp(s, 'sweeping_gale'));
    expect(r.state.players[1].spellTraps.every((x) => !x)).toBe(true);
    expect(r.state.players[1].fieldSpell).toBeNull();
    expect(r.state.players[0].spellTraps[0]).not.toBeNull();
    expect(r.events.filter((e) => e.type === 'destroy').map((e) => (e as { cardId: string }).cardId)).toEqual(['chains_of_light', 'dragon_blade', 'healing_spring', 'volcano_arena']);
    expect(spellActs({ ...s, players: [s.players[0], { ...s.players[1], spellTraps: [null, null, null], fieldSpell: null }] }, 'sweeping_gale')).toEqual([]);
    const seal = scenario({ p0: { hand: ['sweeping_gale'] }, p1: { spellTraps: ['spell_seal', 'chains_of_light'] } });
    let q = play(seal, sp(seal, 'sweeping_gale'));
    expect(q.state.pending).toMatchObject({ kind: 'trapResponse', player: 1, trigger: { kind: 'spellActivated' } });
    q = play(q.state, respond(q.state, 'spell_seal', 1));
    expect(q.state.players[1].spellTraps[1]).not.toBeNull(); // negated: the chains stay
  });

  it('Rüzgar side effects after the pass: a leash lets its monster go home, an axe returns to its owner\'s deck top + 500', () => {
    const s = scenario({ p0: { hand: ['sweeping_gale'], monsters: [null, null, null] }, p1: { monsters: ['ember_wolf'], hand: [] } });
    // P2 leashed my wyrm and armed it with its own axe
    s.cards[800] = { uid: 800, cardId: 'crystal_wyrm', owner: 0 };
    s.cards[801] = { uid: 801, cardId: 'soul_leash', owner: 1 };
    s.cards[802] = { uid: 802, cardId: 'spite_axe', owner: 1 };
    s.players[1].monsters[1] = { uid: 800, position: 'attack', faceUp: true, enteredTurn: 1, attacksThisTurn: 0, positionChangedTurn: -1, borrowed: { owner: 0, until: 'equip', byUid: 801 } };
    s.players[1].spellTraps[0] = { uid: 801, faceUp: true, setTurn: -1, equippedTo: 800 };
    s.players[1].spellTraps[1] = { uid: 802, faceUp: true, setTurn: -1, equippedTo: 0 === 0 ? 800 : 0 };
    const r = play(s, sp(s, 'sweeping_gale'));
    const seqs = evs(r.state, r.events);
    expect(seqs.lastIndexOf('destroy:spite_axe')).toBeLessThan(seqs.indexOf('controlChange:crystal_wyrm'));
    expect(at(r.state, 0, 0)).toBe('crystal_wyrm');
    expect(r.state.players[1].deck[0]).toBe(802);
    expect(r.state.players[1].lp).toBe(3500);
    expect(gy(r.state, 1)).toEqual(['soul_leash']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('S7 Burgu Mızrağı (quick): own Main Phase and the response windows', () => {
  it('from hand in the Main Phase: any spell/trap of either side (not itself), field spells included', () => {
    const s = scenario({ p0: { hand: ['auger_lance'], spellTraps: ['mirror_barrier'] }, p1: { spellTraps: ['chains_of_light'], field: 'tidal_bay' } });
    const targets = spellActs(s, 'auger_lance').map((a) => a.target);
    expect(targets).toEqual([card(0, 'spellTrap', 0), card(1, 'spellTrap', 0), card(1, 'field', 0)]);
    const r = play(s, sp(s, 'auger_lance', 0, { target: card(1, 'field', 0) }));
    expect(r.state.players[1].fieldSpell).toBeNull();
    expect(gy(r.state, 0)).toEqual(['auger_lance']);
  });

  it('set: not on the turn it was set (not even in my own Main Phase); later in my Main Phase', () => {
    const s = scenario({ p0: { hand: ['auger_lance'] }, p1: { spellTraps: ['chains_of_light'] } });
    let st = play(s, setST(s, 'auger_lance', 0, 0)).state;
    expect(spellActs(st, 'auger_lance')).toEqual([]);
    st = play(st, endTurn(0), endTurn(1)).state;
    expect(spellActs(st, 'auger_lance')).toHaveLength(1);
  });

  it('answers an attack declaration: the attacker\'s equip is destroyed before damage (ATK recomputed); the attack goes on', () => {
    const s = scenario({
      active: 1,
      turn: 4,
      phase: 'battle',
      p1: { monsters: ['ember_wolf'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] },
      p0: { monsters: ['shade_assassin'], spellTraps: [{ id: 'auger_lance', setTurn: 3 }] },
    });
    let r = play(s, atk(1, 0, 0));
    expect(r.state.pending).toMatchObject({ kind: 'trapResponse', player: 0, trigger: { kind: 'attackDeclared' } });
    expect(r.state.pending && r.state.pending.kind === 'trapResponse' && r.state.pending.options).toEqual([uidOf(s, 'auger_lance', 0)]);
    r = play(r.state, respond(r.state, 'auger_lance', 0));
    expect(r.state.pending).toMatchObject({ kind: 'chooseTarget', player: 0, sourceUid: uidOf(s, 'auger_lance', 0) });
    r = play(r.state, choose(0, ref(1, 'spellTrap', 0)));
    // blade gone: 1700 vs 1900 -> the wolf dies
    expect(r.state.players[1].monsters[0]).toBeNull();
    expect(r.state.players[1].lp).toBe(4000 - 200);
    const seqs = evs(r.state, r.events);
    expect(seqs.indexOf('destroy:dragon_blade')).toBeLessThan(seqs.indexOf('battle:attackerDestroyed'));
  });

  it('answers a summon of the opponent', () => {
    const s = scenario({ active: 1, turn: 4, p1: { hand: ['lumen_sprite'], field: 'shadow_cavern' }, p0: { spellTraps: [{ id: 'auger_lance', setTurn: 3 }] } });
    let r = play(s, summon(s, 'lumen_sprite', 1));
    expect(r.state.pending).toMatchObject({ kind: 'trapResponse', player: 0, trigger: { kind: 'summoned' } });
    r = play(r.state, respond(r.state, 'auger_lance', 0), choose(0, ref(1, 'field', 0)));
    expect(r.state.players[1].fieldSpell).toBeNull();
    // the summon triggers still resolve after the answer (lumen_sprite +500)
    expect(r.state.players[1].lp).toBe(4500);
  });

  it('Çelik Susturucu does not stop a quick spell (it only locks traps)', () => {
    const s = scenario({
      active: 1,
      turn: 4,
      phase: 'battle',
      p1: { monsters: ['steel_silencer'], spellTraps: ['healing_spring'] },
      p0: { monsters: ['stone_sentinel'], spellTraps: [{ id: 'auger_lance', setTurn: 3 }, 'mirror_barrier'] },
    });
    const r = play(s, atk(1, 0, 0));
    expect(r.state.pending && r.state.pending.kind === 'trapResponse' && r.state.pending.options).toEqual([uidOf(s, 'auger_lance', 0)]);
  });

  it('nested window: the turn player\'s Büyü Mührü negates it (LIFO: seal → lance never resolves → the attack continues)', () => {
    const s = scenario({
      active: 1,
      turn: 4,
      phase: 'battle',
      p1: { monsters: ['ember_wolf'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }, 'spell_seal'] },
      p0: { monsters: ['shade_assassin'], spellTraps: [{ id: 'auger_lance', setTurn: 3 }] },
    });
    let r = play(s, atk(1, 0, 0), respond(s, 'auger_lance', 0), choose(0, ref(1, 'spellTrap', 0)));
    expect(r.state.pending).toMatchObject({ kind: 'trapResponse', player: 1, trigger: { kind: 'spellActivated', player: 0 } });
    r = play(r.state, respond(r.state, 'spell_seal', 1));
    expect(gy(r.state, 0)).toContain('auger_lance');
    expect(r.state.players[1].spellTraps[0]).not.toBeNull(); // the blade survived
    expect(r.state.players[0].monsters[0]).toBeNull(); // 2400 vs 1900
    expect(r.state.players[0].lp).toBe(4000 - 500 - 300); // battle + the wolf's burn
  });

  it('one answer per window: after the lance, no trap of the same window', () => {
    const s = scenario({
      active: 1,
      turn: 4,
      phase: 'battle',
      p1: { monsters: ['ember_wolf'], spellTraps: ['healing_spring'] },
      p0: { monsters: ['shade_assassin'], spellTraps: [{ id: 'auger_lance', setTurn: 3 }, 'chains_of_light'] },
    });
    const r = play(s, atk(1, 0, 0), respond(s, 'auger_lance', 0), choose(0, ref(1, 'spellTrap', 0)));
    expect(r.state.pending).toBeNull();
    expect(r.state.players[0].spellTraps[1]).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('S8 Ruh Tasması (equipControl)', () => {
  it('equips the opponent\'s face-up monster and takes it; the opponent gains 1000 in each of its Draw Phases', () => {
    const s = scenario({ p0: { hand: ['soul_leash'] }, p1: { monsters: ['crystal_wyrm'] } });
    const acts = spellActs(s, 'soul_leash');
    expect(acts.map((a) => a.zone)).toEqual([0, 1, 2]);
    let r = play(s, { ...acts[0] });
    expect(at(r.state, 0, 0)).toBe('crystal_wyrm');
    expect(r.state.players[0].spellTraps[0]!.equippedTo).toBe(r.state.players[0].monsters[0]!.uid);
    expect(r.state.players[0].monsters[0]!.borrowed).toMatchObject({ owner: 1, until: 'equip' });
    expect(types(r.events)).toEqual(expect.arrayContaining(['equip', 'controlChange']));
    r = play(r.state, endTurn(0));
    expect(at(r.state, 0, 0)).toBe('crystal_wyrm'); // stays across the End Phase
    expect(r.events.find((e) => e.type === 'lpGain')).toMatchObject({ player: 1, amount: 1000 });
    const seqs = evs(r.state, r.events);
    expect(seqs.indexOf('lpGain:p1:1000')).toBeGreaterThan(seqs.indexOf('draw:stone_sentinel'));
    expect(seqs.indexOf('lpGain:p1:1000')).toBeLessThan(seqs.indexOf('phaseChange:main'));
  });

  it('leash destroyed (purging_wave): the monster goes home; monster destroyed: the leash goes to the graveyard', () => {
    const s = scenario({ p0: { hand: ['soul_leash'] }, p1: { monsters: ['crystal_wyrm'], hand: ['purging_wave'] } });
    let st = play(s, spellActs(s, 'soul_leash')[0], endTurn(0)).state;
    const r = play(st, sp(st, 'purging_wave', 1, { target: card(0, 'spellTrap', 0) }));
    expect(at(r.state, 1, 0)).toBe('crystal_wyrm');
    expect(r.state.players[1].monsters[0]!.borrowed).toBeUndefined();
    const k = scenario({ p0: { hand: ['soul_leash'] }, p1: { monsters: ['crystal_wyrm'], hand: ['judgment_bolt'] } });
    st = play(k, spellActs(k, 'soul_leash')[0], endTurn(0)).state;
    const q = play(st, sp(st, 'judgment_bolt', 1, { target: mon(0, 0) }));
    expect(gy(q.state, 1)).toEqual(['crystal_wyrm', 'judgment_bolt']);
    expect(gy(q.state, 0)).toEqual(['soul_leash']);
  });

  it('not on face-down monsters or tokens; needs a free monster zone', () => {
    const s = scenario({ p0: { hand: ['soul_leash'] }, p1: { monsters: [{ id: 'stone_sentinel', faceUp: false }, 'straw_decoy_token'] } });
    s.players[1].monsters[1]!.token = true;
    expect(spellActs(s, 'soul_leash')).toEqual([]);
    const f = scenario({ p0: { hand: ['soul_leash'], monsters: ['stone_sentinel', 'stone_sentinel', 'stone_sentinel'] }, p1: { monsters: ['ember_wolf'] } });
    expect(spellActs(f, 'soul_leash')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('S9 Saman Korkuluklar (quick, tokens)', () => {
  const free = (zones: 3 | 5, used: number) =>
    scenario({ zones, p0: { hand: ['straw_decoys'], monsters: Array.from({ length: used }, () => 'stone_sentinel' as CardId) } });
  for (const [zones, used, n] of [[3, 0, 2], [3, 2, 1], [5, 0, 4], [5, 3, 1], [5, 1, 3]] as const)
    it(`${zones} zones, ${zones - used} free → ${n} token(s), face-up defense, 0/0`, () => {
      const s = free(zones, used);
      const r = play(s, sp(s, 'straw_decoys'));
      const toks = r.state.players[0].monsters.filter((m) => m?.token);
      expect(toks).toHaveLength(n);
      for (const t of toks) {
        expect([t!.position, t!.faceUp, r.state.cards[t!.uid].cardId]).toEqual(['defense', true, 'straw_decoy_token']);
        expect([currentAtk(r.state, t!.uid), currentDef(r.state, t!.uid)]).toEqual([0, 0]);
      }
      expect(r.events.filter((e) => e.type === 'summon').every((e) => e.type === 'summon' && e.from === 'token' && e.method === 'special')).toBe(true);
    });

  it('on its own turn: no other summon this turn (normal, set, flip, special); tokens are never tributes', () => {
    const s = scenario({ p0: { hand: ['straw_decoys', 'ember_wolf', 'soul_recall', 'crystal_wyrm'], graveyard: ['shade_assassin'], monsters: [null, null, { id: 'thorn_lurker', faceUp: false }] } });
    const st = play(s, sp(s, 'straw_decoys')).state;
    expect(legalActions(st).some((a) => ['normalSummon', 'setMonster', 'flipSummon', 'specialSummon'].includes(a.type))).toBe(false);
    expect(spellActs(st, 'soul_recall')).toEqual([]);
    const next = play(st, endTurn(0), endTurn(1)).state;
    const tribs = legalActions(next).filter((a) => a.type === 'normalSummon' && next.cards[a.uid].cardId === 'crystal_wyrm');
    expect(tribs.every((a) => a.type === 'normalSummon' && a.tributes.every((u) => !next.cards[u] || next.cards[u].cardId !== 'straw_decoy_token'))).toBe(true);
    expect(tribs).toEqual([]); // only one real monster on the field: no 2-tribute combination
  });

  it('answering a direct attack: the attacker picks a token as its new target; nobody takes damage', () => {
    const s = scenario({ active: 1, turn: 4, phase: 'battle', p1: { monsters: ['crystal_wyrm'] }, p0: { spellTraps: [{ id: 'straw_decoys', setTurn: 3 }] } });
    let r = play(s, atk(1, 0, null), respond(s, 'straw_decoys', 0));
    expect(r.state.pending).toMatchObject({ kind: 'chooseTarget', player: 1 });
    const cands = r.state.pending && r.state.pending.kind === 'chooseTarget' ? r.state.pending.candidates : [];
    expect(cands).toEqual([ref(0, 'monster', 0), ref(0, 'monster', 1)]);
    r = play(r.state, choose(1, cands[1]));
    expect(r.state.players[0].lp).toBe(4000);
    expect(r.state.players[0].monsters.filter(Boolean)).toHaveLength(1);
    expect(types(r.events)).toContain('tokenVanish');
    expect(gy(r.state, 0)).toEqual(['straw_decoys']); // a token never reaches the graveyard
    expect(r.state.players[0].noSummonTurn).toBeUndefined(); // not its own turn: no summon lock
  });

  it('answering an attack on a monster: the attack goes on; a summon window too', () => {
    const s = scenario({ active: 1, turn: 4, phase: 'battle', p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: ['stone_sentinel'], spellTraps: [{ id: 'straw_decoys', setTurn: 3 }] } });
    const r = play(s, atk(1, 0, 0), respond(s, 'straw_decoys', 0));
    expect(r.state.pending).toBeNull();
    expect(gy(r.state, 0)).toContain('stone_sentinel');
    expect(r.state.players[0].monsters.filter((m) => m?.token)).toHaveLength(1);
  });

  it('Devrilen Kule / Yer Yarığı never answer the 0-ATK token summons', () => {
    const s = scenario({ p0: { hand: ['straw_decoys'] }, p1: { spellTraps: ['toppling_tower', 'chasm_trap'] } });
    const r = play(s, sp(s, 'straw_decoys'));
    expect(r.state.pending).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('S10 Hınç Baltası (equipAtk800Return)', () => {
  it('+800 ATK on an own face-up monster', () => {
    const s = scenario({ p0: { hand: ['spite_axe'], monsters: ['ember_wolf'] } });
    const r = play(s, spellActs(s, 'spite_axe')[0]);
    expect(currentAtk(r.state, r.state.players[0].monsters[0]!.uid)).toBe(2500);
  });

  for (const how of ['purging_wave', 'monster destroyed', 'auger_lance'] as const)
    it(`leaving the field (${how}): top of its owner's deck + 500 damage to the owner (not the graveyard)`, () => {
      const s = scenario({
        p0: { monsters: ['ember_wolf'], spellTraps: [{ id: 'spite_axe', equippedTo: 0 }] },
        p1: { hand: ['purging_wave', 'judgment_bolt', 'auger_lance'] },
        active: 1,
        turn: 4,
      });
      const axe = uidOf(s, 'spite_axe', 0);
      const a =
        how === 'purging_wave'
          ? sp(s, 'purging_wave', 1, { target: card(0, 'spellTrap', 0) })
          : how === 'auger_lance'
            ? sp(s, 'auger_lance', 1, { target: card(0, 'spellTrap', 0) })
            : sp(s, 'judgment_bolt', 1, { target: mon(0, 0) });
      const r = play(s, a);
      expect(r.state.players[0].deck[0]).toBe(axe);
      expect(gy(r.state, 0)).not.toContain('spite_axe');
      expect(r.state.players[0].lp).toBe(3500);
      expect(r.events.find((e) => e.type === 'toDeck')).toMatchObject({ owner: 0, uid: axe, from: 'spellTrap', position: 'top' });
    });

  it('equipped to a borrowed monster: it still goes to ITS owner\'s deck', () => {
    const s = scenario({ p0: { hand: ['puppet_string', 'spite_axe'] }, p1: { monsters: ['ember_wolf'] } });
    let st = play(s, sp(s, 'puppet_string', 0, { target: mon(1, 0) })).state;
    st = play(st, spellActs(st, 'spite_axe')[0]).state;
    st = play(st, endTurn(0)).state; // the wolf goes home; the axe stays on it (my zone)
    expect(at(st, 1, 0)).toBe('ember_wolf');
    expect(currentAtk(st, st.players[1].monsters[0]!.uid)).toBe(2500);
    // P2 wipes the field: the axe (my card) goes to MY deck top and I take the 500
    st.players[1].hand.push(950);
    st.cards[950] = { uid: 950, cardId: 'void_eye', owner: 1 };
    const axe = uidOf(st, 'spite_axe', 0);
    const r = play(st, { type: 'activateSpell', player: 1, uid: 950 } as Action);
    expect(r.state.players[0].deck[0]).toBe(axe);
    expect(r.state.players[0].lp).toBe(3500);
    expect(r.state.players[1].lp).toBe(4000);
    expect(gy(r.state, 1)).toEqual(['ember_wolf', 'void_eye']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('S11 Sayfa Çeviren (handRefreshBoth)', () => {
  it('both hands go to the graveyard (activator first), then each draws as many (activator first)', () => {
    const s = scenario({ p0: { hand: ['page_turner', 'ember_wolf', 'stone_sentinel'], deck: ['volt_lizard', 'tide_golem', 'lumen_sprite'] }, p1: { hand: ['crystal_wyrm', 'judgment_bolt', 'healing_spring'], deck: ['shade_assassin', 'storm_hawk', 'magma_titan', 'coral_serpent'] } });
    const r = play(s, sp(s, 'page_turner'));
    const discards = r.events.filter((e) => e.type === 'discard').map((e) => (e as { player: number }).player);
    expect(discards).toEqual([0, 0, 1, 1, 1]);
    const draws = r.events.filter((e) => e.type === 'draw').map((e) => (e as { player: number }).player);
    expect(draws).toEqual([0, 0, 1, 1, 1]);
    expect(r.state.players[0].hand.map((u) => r.state.cards[u].cardId)).toEqual(['volt_lizard', 'tide_golem']);
    expect(r.state.players[1].hand).toHaveLength(3);
    expect(gy(r.state, 0)).toEqual(['ember_wolf', 'stone_sentinel', 'page_turner']);
  });

  it('a short deck draws what it can (no deck-out); seal pieces are thrown away too', () => {
    const s = scenario({ p0: { hand: ['page_turner'] }, p1: { hand: ['seal_head', 'seal_arm_r', 'seal_arm_l'], deck: ['stone_sentinel'] } });
    const r = play(s, sp(s, 'page_turner'));
    expect(r.state.winner).toBeNull();
    expect(r.state.players[1].hand).toHaveLength(1);
    expect(gy(r.state, 1)).toEqual(['seal_head', 'seal_arm_r', 'seal_arm_l']);
  });

  it('draws that complete the five seals: the activator wins first', () => {
    const s = scenario({
      p0: { hand: ['page_turner', 'ember_wolf', 'ember_wolf', 'ember_wolf', 'ember_wolf', 'ember_wolf'], deck: ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r', 'seal_leg_l'] },
      p1: { hand: ['ember_wolf'], deck: ['stone_sentinel'] },
    });
    const r = play(s, sp(s, 'page_turner'));
    expect(r.state.winner).toBe(0);
    expect(r.state.winReason).toBe('seals');
  });
});

// ---------------------------------------------------------------------------------------------
describe('S12 Talih Zarı (diceBoost100, seeded)', () => {
  it('rolls the seeded die and gives every own face-up monster +100 x roll ATK and DEF this turn', () => {
    const s = scenario({ p0: { hand: ['lucky_die'], monsters: ['ember_wolf', { id: 'stone_sentinel', faceUp: false }] }, p1: { monsters: ['shade_assassin'] } });
    const v = nextDie(s);
    const r = play(s, sp(s, 'lucky_die'));
    expect(r.events.find((e) => e.type === 'diceRoll')).toMatchObject({ player: 0, value: v });
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(6);
    const w = r.state.players[0].monsters[0]!.uid;
    expect([currentAtk(r.state, w), currentDef(r.state, w)]).toEqual([1700 + 100 * v, 1000 + 100 * v]);
    expect(currentDef(r.state, r.state.players[0].monsters[1]!.uid)).toBe(2100); // face-down: no boost
    expect(currentAtk(r.state, r.state.players[1].monsters[0]!.uid)).toBe(1900);
    const n = play(r.state, endTurn(0)).state;
    expect(currentAtk(n, w)).toBe(1700);
  });
  it('not without a face-up own monster; every roll 1..6 appears over seeds', () => {
    expect(spellActs(scenario({ p0: { hand: ['lucky_die'] } }), 'lucky_die')).toEqual([]);
    const seen = new Set<number>();
    for (let seed = 1; seed < 80; seed++) {
      const s = scenario({ p0: { hand: ['lucky_die'], monsters: ['ember_wolf'] } });
      s.rng = seed * 7919;
      seen.add((play(s, sp(s, 'lucky_die')).events.find((e) => e.type === 'diceRoll') as { value: number }).value);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('mechanics edge cases', () => {
  it('a quick spell from hand is only a Main Phase card of its owner (never in the battle phase / an answer from hand)', () => {
    const s = scenario({ active: 1, turn: 4, phase: 'battle', p1: { monsters: ['crystal_wyrm'] }, p0: { hand: ['straw_decoys', 'auger_lance'] } });
    const r = play(s, atk(1, 0, null));
    expect(r.state.pending).toBeNull(); // nothing set: no window
    expect(r.state.players[0].lp).toBe(1200);
    expectIllegal(scenario({ phase: 'battle', p0: { hand: ['auger_lance'] }, p1: { spellTraps: ['chains_of_light'] } }), { type: 'activateSpell', player: 0, uid: 1, target: card(1, 'spellTrap', 0) } as Action);
  });

  it('a quick spell set this turn is not offered in a window of the same turn', () => {
    const s = scenario({ active: 1, turn: 4, phase: 'battle', p1: { monsters: ['crystal_wyrm'] }, p0: { spellTraps: [{ id: 'straw_decoys', setTurn: 4 }] } });
    const r = play(s, atk(1, 0, null));
    expect(r.state.pending).toBeNull();
  });

  it('the straw redirect is skipped when the attacker is gone; declining keeps the set card', () => {
    const s = scenario({ active: 1, turn: 4, phase: 'battle', p1: { monsters: ['crystal_wyrm'] }, p0: { spellTraps: [{ id: 'straw_decoys', setTurn: 3 }] } });
    const r = play(s, atk(1, 0, null), decline(0));
    expect(r.state.players[0].lp).toBe(1200);
    expect(r.state.players[0].spellTraps[0]).not.toBeNull();
  });

  it('all new decisions are answered through legalActions (no hidden inputs)', () => {
    const s = scenario({ p0: { hand: ['winnow_sieve'] } });
    const r = play(s, sp(s, 'winnow_sieve'));
    expect(legalActions(r.state).every((a) => a.type === 'discard')).toBe(true);
    void isListed;
  });
});
