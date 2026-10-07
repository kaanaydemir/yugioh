import { describe, expect, it } from 'vitest';
import { EngineError, apply, currentAtk, currentDef, legalActions, type Action } from '../../src/engine';
import { isListed, play, scenario, seq, uidOf } from './helpers';

const spellActs = (acts: Action[], uid: number) =>
  acts.filter((a): a is Extract<Action, { type: 'activateSpell' }> => a.type === 'activateSpell' && a.uid === uid);

describe('monster summon effects', () => {
  it('magma_titan burns 500 on tribute summon, flip summon and special summon — not when set', () => {
    const t = scenario({ p0: { hand: ['magma_titan'], monsters: ['lumen_sprite'] } });
    const titan = uidOf(t, 'magma_titan');
    const r = play(t, { type: 'normalSummon', player: 0, uid: titan, zone: 0, tributes: [uidOf(t, 'lumen_sprite')] });
    expect(seq(r.state, r.events).slice(-3)).toEqual(['summon:magma_titan', 'activate:magma_titan', 'damage:p1:500']);
    expect(r.events.at(-2)).toEqual({ type: 'activate', player: 0, uid: titan, cardId: 'magma_titan', kind: 'monsterEffect', from: 'monster', zone: 0 });
    expect(r.events.at(-1)).toMatchObject({ source: 'effect', sourceUid: titan, lpAfter: 3500 });

    const f = scenario({ p0: { monsters: [null, { id: 'magma_titan', faceUp: false }] } });
    const fr = play(f, { type: 'flipSummon', player: 0, zone: 1 });
    expect(seq(fr.state, fr.events)).toEqual(['flip:magma_titan', 'summon:magma_titan', 'activate:magma_titan', 'damage:p1:500']);

    const sp = scenario({ p0: { hand: ['soul_recall'] }, p1: { graveyard: ['magma_titan'] } });
    const sr = play(sp, { type: 'activateSpell', player: 0, uid: uidOf(sp, 'soul_recall'), target: { kind: 'graveyard', uid: uidOf(sp, 'magma_titan'), toZone: 2 } });
    expect(seq(sr.state, sr.events)).toEqual(['activate:soul_recall', 'target', 'summon:magma_titan', 'toGraveyard:soul_recall', 'activate:magma_titan', 'damage:p1:500']);

    const st = scenario({ p0: { hand: ['magma_titan'], monsters: ['lumen_sprite'] } });
    const str = play(st, { type: 'setMonster', player: 0, uid: uidOf(st, 'magma_titan'), zone: 0, tributes: [uidOf(st, 'lumen_sprite')] });
    expect(str.events.some((e) => e.type === 'damage')).toBe(false);
  });

  it('lumen_sprite gains 500 only on Normal Summon', () => {
    const s = scenario({ p0: { hand: ['lumen_sprite'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'lumen_sprite'), zone: 0, tributes: [] });
    expect(seq(r.state, r.events)).toEqual(['summon:lumen_sprite', 'activate:lumen_sprite', 'lpGain:p0:500']);
    expect(r.events[2]).toMatchObject({ lpAfter: 4500, sourceUid: uidOf(s, 'lumen_sprite') });
    const f = scenario({ p0: { monsters: [{ id: 'lumen_sprite', faceUp: false }] } });
    expect(play(f, { type: 'flipSummon', player: 0, zone: 0 }).events.some((e) => e.type === 'lpGain')).toBe(false);
    const sp = scenario({ p0: { hand: ['soul_recall'], graveyard: ['lumen_sprite'] } });
    const sr = play(sp, { type: 'activateSpell', player: 0, uid: uidOf(sp, 'soul_recall'), target: { kind: 'graveyard', uid: uidOf(sp, 'lumen_sprite'), toZone: 0 } });
    expect(sr.events.some((e) => e.type === 'lpGain')).toBe(false);
  });

  it('abyss_magus on Tribute Summon destroys one opponent spell/trap or field card (chosen)', () => {
    const s = scenario({
      p0: { hand: ['abyss_magus'], monsters: ['storm_hawk'] },
      p1: { monsters: ['ember_wolf'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }, null, 'mirror_barrier'], field: 'volcano_arena' },
    });
    const magus = uidOf(s, 'abyss_magus');
    const r = play(s, { type: 'normalSummon', player: 0, uid: magus, zone: 0, tributes: [uidOf(s, 'storm_hawk')] });
    expect(seq(r.state, r.events)).toEqual(['tribute:storm_hawk', 'toGraveyard:storm_hawk', 'summon:abyss_magus', 'decision:chooseTarget']);
    expect(r.state.pending).toEqual({
      kind: 'chooseTarget',
      player: 0,
      sourceUid: magus,
      candidates: [
        { player: 1, zone: 'spellTrap', index: 0 },
        { player: 1, zone: 'spellTrap', index: 2 },
        { player: 1, zone: 'field', index: 0 },
      ],
    });
    // destroying the equip lowers the wolf's ATK (statChange)
    const e = play(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 0 } });
    expect(seq(e.state, e.events)).toEqual(['activate:abyss_magus', 'target', 'destroy:dragon_blade', 'toGraveyard:dragon_blade', 'statChange:ember_wolf:2900>2200']);
    expect(e.events[0]).toMatchObject({ kind: 'monsterEffect', from: 'monster', zone: 0 });
    expect(e.events[2]).toMatchObject({ location: 'spellTrap', zone: 0, reason: 'effect', sourceUid: magus, player: 1 });
    // destroying the field spell: fieldSpell inactive + statChange
    const f = play(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'field', index: 0 } });
    expect(seq(f.state, f.events)).toEqual([
      'activate:abyss_magus',
      'target',
      'destroy:volcano_arena',
      'toGraveyard:volcano_arena',
      'fieldSpell:volcano_arena',
      'statChange:ember_wolf:2900>2400',
    ]);
    expect(f.events[3]).toMatchObject({ from: 'field', zone: 0 });
    expect(f.events[4]).toMatchObject({ active: false, player: 1 });
    // choosing something that is not a candidate is illegal
    expect(() => apply(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 1 } })).toThrow(EngineError);
  });

  it('abyss_magus: no decision when the opponent has no spell/trap; no effect on special summon', () => {
    const s = scenario({ p0: { hand: ['abyss_magus'], monsters: ['storm_hawk'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'abyss_magus'), zone: 0, tributes: [uidOf(s, 'storm_hawk')] });
    expect(r.state.pending).toBeNull();
    const sp = scenario({ p0: { hand: ['soul_recall'], graveyard: ['abyss_magus'] }, p1: { spellTraps: ['mirror_barrier'] } });
    const sr = play(sp, { type: 'activateSpell', player: 0, uid: uidOf(sp, 'soul_recall'), target: { kind: 'graveyard', uid: uidOf(sp, 'abyss_magus'), toZone: 0 } });
    expect(sr.state.pending).toBeNull();
  });

  it('thorn_lurker flip summon destroys an opponent monster; no decision if the opponent has none', () => {
    const s = scenario({ p0: { monsters: [{ id: 'thorn_lurker', faceUp: false }] }, p1: { monsters: [{ id: 'crystal_wyrm', faceUp: false }, null, 'tide_golem'] } });
    const r = play(s, { type: 'flipSummon', player: 0, zone: 0 });
    expect(seq(r.state, r.events)).toEqual(['flip:thorn_lurker', 'summon:thorn_lurker', 'decision:chooseTarget']);
    const c = play(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 0 } });
    expect(seq(c.state, c.events)).toEqual(['activate:thorn_lurker', 'target', 'destroy:crystal_wyrm', 'toGraveyard:crystal_wyrm']);
    const none = scenario({ p0: { monsters: [{ id: 'thorn_lurker', faceUp: false }] } });
    expect(play(none, { type: 'flipSummon', player: 0, zone: 0 }).state.pending).toBeNull();
  });
});

describe('spells', () => {
  it('judgment_bolt destroys any opponent monster (incl. face-down); never own; illegal without targets', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt'], monsters: ['shade_assassin'] }, p1: { monsters: [null, { id: 'tide_golem', faceUp: false }] } });
    const bolt = uidOf(s, 'judgment_bolt');
    const acts = spellActs(legalActions(s), bolt);
    expect(acts).toEqual([{ type: 'activateSpell', player: 0, uid: bolt, target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 1 } } }]);
    const r = play(s, acts[0]);
    expect(seq(r.state, r.events)).toEqual(['activate:judgment_bolt', 'target', 'destroy:tide_golem', 'toGraveyard:tide_golem', 'toGraveyard:judgment_bolt']);
    expect(r.events[0]).toEqual({ type: 'activate', player: 0, uid: bolt, cardId: 'judgment_bolt', kind: 'spell', from: 'hand', zone: null });
    expect(r.events[1]).toEqual({ type: 'target', player: 0, sourceUid: bolt, targets: [{ player: 1, zone: 'monster', index: 1 }] });
    expect(r.events[2]).toMatchObject({ reason: 'effect', sourceUid: bolt });
    expect(r.events[4]).toEqual({ type: 'toGraveyard', owner: 0, uid: bolt, cardId: 'judgment_bolt', from: 'resolved', zone: null });
    const empty = scenario({ p0: { hand: ['judgment_bolt'] } });
    expect(spellActs(legalActions(empty), uidOf(empty, 'judgment_bolt'))).toEqual([]);
  });

  it('healing_spring gains 1000; a set spell can be activated (even the turn it was set) from its zone', () => {
    const s = scenario({ p0: { hand: ['healing_spring'] } });
    const uid = uidOf(s, 'healing_spring');
    const r = play(s, { type: 'setSpellTrap', player: 0, uid, zone: 1 }, { type: 'activateSpell', player: 0, uid });
    expect(seq(r.state, r.events)).toEqual(['setSpellTrap:healing_spring', 'activate:healing_spring', 'lpGain:p0:1000', 'toGraveyard:healing_spring']);
    expect(r.events[1]).toMatchObject({ from: 'spellTrap', zone: 1 });
    expect(r.events[3]).toMatchObject({ from: 'resolved', zone: 1 });
    expect(r.state.players[0].lp).toBe(5000);
    expect(r.state.players[0].spellTraps[1]).toBeNull();
  });

  it('soul_recall revives from either graveyard; the owner keeps ownership and gets it back', () => {
    const s = scenario({ p0: { hand: ['soul_recall', 'judgment_bolt'], graveyard: ['stone_sentinel'], monsters: [null, 'tide_golem'] }, p1: { graveyard: ['crystal_wyrm', 'judgment_bolt'] } });
    const recall = uidOf(s, 'soul_recall');
    const wyrm = uidOf(s, 'crystal_wyrm');
    const acts = spellActs(legalActions(s), recall);
    // 2 monsters in graveyards (spells are not targets) × 2 free zones
    expect(acts).toHaveLength(4);
    const r = play(s, { type: 'activateSpell', player: 0, uid: recall, target: { kind: 'graveyard', uid: wyrm, toZone: 2 } });
    expect(seq(r.state, r.events)).toEqual(['activate:soul_recall', 'target', 'summon:crystal_wyrm', 'toGraveyard:soul_recall']);
    expect(r.events[1]).toEqual({ type: 'target', player: 0, sourceUid: recall, targets: [{ player: 0, zone: 'monster', index: 2 }], graveyardUid: wyrm });
    expect(r.events[2]).toEqual({ type: 'summon', player: 0, uid: wyrm, cardId: 'crystal_wyrm', zone: 2, method: 'special', position: 'attack', from: 'graveyard', sourceUid: recall });
    expect(r.state.players[0].monsters[2]).toMatchObject({ uid: wyrm, faceUp: true, position: 'attack', enteredTurn: 3 });
    expect(r.state.cards[wyrm].owner).toBe(1);
    expect(r.state.players[1].graveyard).not.toContain(wyrm);
    // it may attack this turn but not change position
    expect(isListed(r.state, { type: 'changePosition', player: 0, zone: 2 })).toBe(false);
    // destroyed → back to the owner's (P1) graveyard
    // P1's turn: move P1's bolt from its graveyard to its hand and destroy the revived wyrm
    const s3 = structuredClone(r.state);
    s3.activePlayer = 1;
    const boltP1 = Object.values(s3.cards).find((c) => c.cardId === 'judgment_bolt' && c.owner === 1)!.uid;
    s3.players[1].graveyard = s3.players[1].graveyard.filter((u) => u !== boltP1);
    s3.players[1].hand.push(boltP1);
    const d = play(s3, { type: 'activateSpell', player: 1, uid: boltP1, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 2 } } });
    const destroy = d.events.find((e) => e.type === 'destroy')!;
    expect(destroy).toMatchObject({ player: 0, uid: wyrm });
    const tg = d.events.find((e) => e.type === 'toGraveyard' && e.uid === wyrm)!;
    expect(tg).toMatchObject({ owner: 1, from: 'monster', zone: 2 });
    expect(d.state.players[1].graveyard).toContain(wyrm);
  });

  it('soul_recall needs a monster in a graveyard and a free zone', () => {
    const s = scenario({ p0: { hand: ['soul_recall'], graveyard: ['healing_spring'] } });
    expect(spellActs(legalActions(s), uidOf(s, 'soul_recall'))).toEqual([]);
    const full = scenario({ p0: { hand: ['soul_recall'], graveyard: ['ember_wolf'], monsters: ['tide_golem', 'tide_golem', 'tide_golem'] } });
    expect(spellActs(legalActions(full), uidOf(full, 'soul_recall'))).toEqual([]);
  });
});

describe('equip spell lifecycle (dragon_blade)', () => {
  it('from hand: needs a free S/T zone and an own face-up monster; +700 with statChange', () => {
    const s = scenario({
      p0: { hand: ['dragon_blade'], monsters: ['ember_wolf', { id: 'tide_golem', faceUp: false }], spellTraps: ['mirror_barrier'] },
      p1: { monsters: ['shade_assassin'] },
    });
    const blade = uidOf(s, 'dragon_blade');
    const wolf = uidOf(s, 'ember_wolf');
    const acts = spellActs(legalActions(s), blade);
    // zones 1,2 × the one face-up own monster
    expect(acts).toEqual([
      { type: 'activateSpell', player: 0, uid: blade, zone: 1, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } },
      { type: 'activateSpell', player: 0, uid: blade, zone: 2, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } },
    ]);
    const r = play(s, acts[1]);
    expect(seq(r.state, r.events)).toEqual(['activate:dragon_blade', 'target', 'equip:ember_wolf', 'statChange:ember_wolf:1700>2400']);
    expect(r.events[0]).toMatchObject({ from: 'hand', zone: 2 });
    expect(r.events[2]).toEqual({ type: 'equip', player: 0, spellUid: blade, spellZone: 2, targetUid: wolf });
    expect(r.events[3]).toEqual({ type: 'statChange', uid: wolf, atk: 2400, def: 1000, prevAtk: 1700, prevDef: 1000 });
    expect(r.state.players[0].spellTraps[2]).toEqual({ uid: blade, faceUp: true, setTurn: -1, equippedTo: wolf });
    expect(currentAtk(r.state, wolf)).toBe(2400);
    expect(currentDef(r.state, wolf)).toBe(1000);
  });

  it('set then activated: stays in its zone', () => {
    const s = scenario({ p0: { monsters: ['shade_assassin'], spellTraps: [null, 'dragon_blade'] } });
    const blade = uidOf(s, 'dragon_blade');
    const acts = spellActs(legalActions(s), blade);
    expect(acts).toEqual([{ type: 'activateSpell', player: 0, uid: blade, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } }]);
    const r = play(s, acts[0]);
    expect(r.events[0]).toMatchObject({ from: 'spellTrap', zone: 1 });
    expect(r.events[2]).toMatchObject({ spellZone: 1 });
    expect(r.state.players[0].spellTraps[1]).toMatchObject({ faceUp: true, equippedTo: uidOf(s, 'shade_assassin') });
  });

  it('cannot equip face-down or opponent monsters', () => {
    const s = scenario({ p0: { hand: ['dragon_blade'], monsters: [{ id: 'tide_golem', faceUp: false }] }, p1: { monsters: ['shade_assassin'] } });
    expect(spellActs(legalActions(s), uidOf(s, 'dragon_blade'))).toEqual([]);
  });

  it('when the equipped monster is destroyed by an effect the blade follows (destroy rule → toGraveyard)', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['shade_assassin'], spellTraps: [null, null, { id: 'dragon_blade', equippedTo: 0 }] } });
    const r = play(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'judgment_bolt'), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } });
    expect(seq(r.state, r.events)).toEqual([
      'activate:judgment_bolt',
      'target',
      'destroy:shade_assassin',
      'toGraveyard:shade_assassin',
      'destroy:dragon_blade',
      'toGraveyard:dragon_blade',
      'toGraveyard:judgment_bolt',
    ]);
    expect(r.events[4]).toMatchObject({ player: 1, reason: 'rule', location: 'spellTrap', zone: 2 });
  });
});

describe('field spell (volcano_arena)', () => {
  it('FIRE +500 / WATER −300 for face-up monsters on both sides, with statChange; face-down unaffected', () => {
    const s = scenario({
      p0: { hand: ['volcano_arena'], monsters: ['ember_wolf', 'tide_golem', { id: 'magma_titan', faceUp: false }] },
      p1: { monsters: ['coral_serpent', 'shade_assassin'] },
    });
    const arena = uidOf(s, 'volcano_arena');
    const acts = spellActs(legalActions(s), arena);
    expect(acts).toEqual([{ type: 'activateSpell', player: 0, uid: arena }]);
    const r = play(s, acts[0]);
    expect(seq(r.state, r.events)).toEqual([
      'activate:volcano_arena',
      'fieldSpell:volcano_arena',
      'statChange:ember_wolf:1700>2200',
      'statChange:tide_golem:1100>800',
      'statChange:coral_serpent:2000>1700',
    ]);
    expect(r.events[0]).toMatchObject({ from: 'hand', zone: null });
    expect(r.events[1]).toEqual({ type: 'fieldSpell', player: 0, uid: arena, cardId: 'volcano_arena', active: true });
    expect(r.state.players[0].fieldSpell).toEqual({ uid: arena, faceUp: true, setTurn: -1, equippedTo: null });
    const titan = uidOf(s, 'magma_titan');
    expect(currentAtk(r.state, titan)).toBe(2100); // face-down: base
    const f = play(r.state, { type: 'flipSummon', player: 0, zone: 2 });
    expect(currentAtk(f.state, titan)).toBe(2600);
    expect(f.events.some((e) => e.type === 'statChange')).toBe(false);
  });

  it('a monster summoned under the field spell starts modified (no statChange); tide_golem at 800 dodges chasm_trap', () => {
    const s = scenario({ p0: { hand: ['tide_golem'], field: 'volcano_arena' }, p1: { spellTraps: ['chasm_trap'] } });
    const golem = uidOf(s, 'tide_golem');
    const r = play(s, { type: 'normalSummon', player: 0, uid: golem, zone: 0, tributes: [] });
    expect(seq(r.state, r.events)).toEqual(['summon:tide_golem']);
    expect(currentAtk(r.state, golem)).toBe(800);
  });

  it('a new field spell destroys the existing one (either side); unchanged values produce no statChange', () => {
    const s = scenario({ active: 1, p0: { field: 'volcano_arena', monsters: ['ember_wolf'] }, p1: { hand: ['volcano_arena'] } });
    const mine = Object.values(s.cards).find((c) => c.cardId === 'volcano_arena' && c.owner === 0)!.uid;
    const theirs = uidOf(s, 'volcano_arena', 1);
    const r = play(s, { type: 'activateSpell', player: 1, uid: theirs });
    expect(seq(r.state, r.events)).toEqual([
      'activate:volcano_arena',
      'destroy:volcano_arena',
      'toGraveyard:volcano_arena',
      'fieldSpell:volcano_arena',
      'fieldSpell:volcano_arena',
    ]);
    expect(r.events[1]).toMatchObject({ uid: mine, player: 0, location: 'field', zone: 0, reason: 'rule', sourceUid: theirs });
    expect(r.events[2]).toMatchObject({ uid: mine, owner: 0, from: 'field', zone: 0 });
    expect(r.events[3]).toMatchObject({ uid: mine, active: false });
    expect(r.events[4]).toMatchObject({ uid: theirs, active: true, player: 1 });
    expect(r.state.players[0].fieldSpell).toBeNull();
    expect(r.state.players[1].fieldSpell?.uid).toBe(theirs);
    expect(currentAtk(r.state, uidOf(s, 'ember_wolf'))).toBe(2200); // no stacking
  });

  it('equip + field stack on one monster', () => {
    const s = scenario({ p0: { hand: ['dragon_blade'], monsters: ['ember_wolf'], field: 'volcano_arena' } });
    const r = play(s, spellActs(legalActions(s), uidOf(s, 'dragon_blade'))[0]);
    expect(seq(r.state, r.events).at(-1)).toBe('statChange:ember_wolf:2200>2900');
  });
});

describe('traps', () => {
  const attackScenario = (trapId: 'mirror_barrier' | 'chains_of_light', extra: Partial<{ setTurn: number }> = {}) =>
    scenario({
      phase: 'battle',
      p0: {
        monsters: ['shade_assassin', 'ember_wolf', { id: 'stone_sentinel', position: 'defense' }],
        spellTraps: [{ id: 'dragon_blade', equippedTo: 1 }],
        hand: [],
      },
      p1: { monsters: ['tide_golem'], spellTraps: [null, { id: trapId, setTurn: extra.setTurn ?? 2 }] },
    });

  it('attack declaration opens trapResponse for traps set on an earlier turn', () => {
    const s = attackScenario('mirror_barrier');
    const shade = uidOf(s, 'shade_assassin');
    const golem = uidOf(s, 'tide_golem');
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(seq(r.state, r.events)).toEqual(['attackDeclare:shade_assassin', 'decision:trapResponse']);
    const trap = uidOf(s, 'mirror_barrier');
    expect(r.state.pending).toEqual({ kind: 'trapResponse', player: 1, trigger: { kind: 'attackDeclared', attackerUid: shade, targetUid: golem }, options: [trap] });
    expect(r.events[1]).toEqual({ type: 'decision', pending: r.state.pending });
    expect(legalActions(r.state)).toEqual([
      { type: 'respond', player: 1, uid: trap },
      { type: 'respond', player: 1, uid: null },
    ]);
    // a trap set this turn cannot respond
    const fresh = attackScenario('mirror_barrier', { setTurn: 3 });
    const fr = play(fresh, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(fr.state.pending).toBeNull();
  });

  it('declining → responseDeclined → the battle resolves', () => {
    const s = attackScenario('mirror_barrier');
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }, { type: 'respond', player: 1, uid: null });
    expect(seq(r.state, r.events).slice(2)).toEqual(['responseDeclined', 'battle:targetDestroyed', 'damage:p1:800', 'destroy:tide_golem', 'toGraveyard:tide_golem']);
    expect(r.state.players[1].spellTraps[1]).toMatchObject({ faceUp: false }); // still set
  });

  it('mirror_barrier destroys every face-up attack-position monster of the attacker (equips follow)', () => {
    const s = attackScenario('mirror_barrier');
    const trap = uidOf(s, 'mirror_barrier');
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }, { type: 'respond', player: 1, uid: trap });
    expect(seq(r.state, r.events).slice(2)).toEqual([
      'activate:mirror_barrier',
      'destroy:shade_assassin',
      'toGraveyard:shade_assassin',
      'destroy:ember_wolf',
      'toGraveyard:ember_wolf',
      'destroy:dragon_blade',
      'toGraveyard:dragon_blade',
      'toGraveyard:mirror_barrier',
    ]);
    expect(r.events[2]).toEqual({ type: 'activate', player: 1, uid: trap, cardId: 'mirror_barrier', kind: 'trap', from: 'spellTrap', zone: 1 });
    expect(r.events[3]).toMatchObject({ reason: 'effect', sourceUid: trap, player: 0 });
    expect(r.events.at(-1)).toEqual({ type: 'toGraveyard', owner: 1, uid: trap, cardId: 'mirror_barrier', from: 'spellTrap', zone: 1 });
    expect(r.state.players[0].monsters[2]).not.toBeNull(); // defense survives
    expect(r.state.phase).toBe('battle');
    expect(r.state.activePlayer).toBe(0);
    expect(r.state.players[1].monsters[0]).not.toBeNull(); // the attack never happened
  });

  it('chains_of_light negates the attack, ends the battle phase and passes the turn', () => {
    const s = attackScenario('chains_of_light');
    const trap = uidOf(s, 'chains_of_light');
    const shade = uidOf(s, 'shade_assassin');
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }, { type: 'respond', player: 1, uid: trap });
    expect(seq(r.state, r.events).slice(2)).toEqual([
      'activate:chains_of_light',
      'attackNegated',
      'toGraveyard:chains_of_light',
      'phaseChange:end',
      'turnStart:p1',
      'phaseChange:draw',
      'draw:stone_sentinel',
      'phaseChange:main',
    ]);
    expect(r.events[3]).toEqual({ type: 'attackNegated', player: 0, attackerUid: shade, byUid: trap });
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.turn).toBe(4);
    expect(r.state.players[1].monsters[0]).not.toBeNull();
  });

  it('chains_of_light with an over-full attacker hand leads into the discard decision', () => {
    const s = attackScenario('chains_of_light');
    s.players[0].hand = [];
    for (let i = 0; i < 7; i++) {
      const uid = 900 + i;
      s.cards[uid] = { uid, cardId: 'healing_spring', owner: 0 };
      s.players[0].hand.push(uid);
    }
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }, { type: 'respond', player: 1, uid: uidOf(s, 'chains_of_light') });
    expect(seq(r.state, r.events).slice(-2)).toEqual(['phaseChange:end', 'decision:discard']);
    expect(r.state.pending).toEqual({ kind: 'discard', player: 0, count: 1 });
  });

  it('both attack traps may be offered; only one is activated per window', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { spellTraps: ['chains_of_light', 'mirror_barrier', 'chasm_trap'] } });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: null });
    expect(r.state.pending?.kind === 'trapResponse' && r.state.pending.options).toEqual([uidOf(s, 'chains_of_light'), uidOf(s, 'mirror_barrier')]);
    const m = play(r.state, { type: 'respond', player: 1, uid: uidOf(s, 'mirror_barrier') });
    expect(m.state.pending).toBeNull();
    expect(m.state.players[1].spellTraps[0]).not.toBeNull();
  });

  it('chasm_trap: Normal Summon with ATK ≥ 1000 opens the window; activation destroys it and cancels on-summon effects', () => {
    const s = scenario({ p0: { hand: ['magma_titan'], monsters: ['lumen_sprite'] }, p1: { spellTraps: ['chasm_trap'] } });
    const titan = uidOf(s, 'magma_titan');
    const trap = uidOf(s, 'chasm_trap');
    const r = play(s, { type: 'normalSummon', player: 0, uid: titan, zone: 0, tributes: [uidOf(s, 'lumen_sprite')] });
    expect(seq(r.state, r.events).slice(-2)).toEqual(['summon:magma_titan', 'decision:trapResponse']);
    expect(r.state.pending).toEqual({ kind: 'trapResponse', player: 1, trigger: { kind: 'summoned', monsterUid: titan }, options: [trap] });
    const a = play(r.state, { type: 'respond', player: 1, uid: trap });
    expect(seq(a.state, a.events)).toEqual(['activate:chasm_trap', 'destroy:magma_titan', 'toGraveyard:magma_titan', 'toGraveyard:chasm_trap']);
    expect(a.events[1]).toMatchObject({ reason: 'effect', sourceUid: trap });
    expect(a.state.players[1].lp).toBe(4000); // magma never burned
    const d = play(r.state, { type: 'respond', player: 1, uid: null });
    expect(seq(d.state, d.events)).toEqual(['responseDeclined', 'activate:magma_titan', 'damage:p1:500']);
  });

  it('chasm_trap does not respond to low-ATK, set, flip or special summons', () => {
    const low = scenario({ p0: { hand: ['lumen_sprite'] }, p1: { spellTraps: ['chasm_trap'] } });
    expect(play(low, { type: 'normalSummon', player: 0, uid: uidOf(low, 'lumen_sprite'), zone: 0, tributes: [] }).state.pending).toBeNull();
    const set = scenario({ p0: { hand: ['shade_assassin'] }, p1: { spellTraps: ['chasm_trap'] } });
    expect(play(set, { type: 'setMonster', player: 0, uid: uidOf(set, 'shade_assassin'), zone: 0, tributes: [] }).state.pending).toBeNull();
    const flip = scenario({ p0: { monsters: [{ id: 'shade_assassin', faceUp: false }] }, p1: { spellTraps: ['chasm_trap'] } });
    expect(play(flip, { type: 'flipSummon', player: 0, zone: 0 }).state.pending).toBeNull();
    const sp = scenario({ p0: { hand: ['soul_recall'], graveyard: ['crystal_wyrm'] }, p1: { spellTraps: ['chasm_trap'] } });
    expect(play(sp, { type: 'activateSpell', player: 0, uid: uidOf(sp, 'soul_recall'), target: { kind: 'graveyard', uid: uidOf(sp, 'crystal_wyrm'), toZone: 0 } }).state.pending).toBeNull();
    // exactly 1000 opens it (storm_hawk)
    const eq = scenario({ p0: { hand: ['storm_hawk'] }, p1: { spellTraps: ['chasm_trap'] } });
    expect(play(eq, { type: 'normalSummon', player: 0, uid: uidOf(eq, 'storm_hawk'), zone: 0, tributes: [] }).state.pending?.kind).toBe('trapResponse');
  });

  it('abyss_magus survives a declined chasm window and may then destroy that very trap', () => {
    const s = scenario({ p0: { hand: ['abyss_magus'], monsters: ['storm_hawk'] }, p1: { spellTraps: ['chasm_trap'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'abyss_magus'), zone: 0, tributes: [uidOf(s, 'storm_hawk')] }, { type: 'respond', player: 1, uid: null });
    expect(seq(r.state, r.events).slice(-2)).toEqual(['responseDeclined', 'decision:chooseTarget']);
    expect(r.state.pending?.player).toBe(0);
    const c = play(r.state, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 0 } });
    expect(seq(c.state, c.events)).toEqual(['activate:abyss_magus', 'target', 'destroy:chasm_trap', 'toGraveyard:chasm_trap']);
  });

  it('traps cannot be activated as spells or outside a window', () => {
    const s = scenario({ p0: { spellTraps: ['mirror_barrier'] } });
    expect(() => apply(s, { type: 'activateSpell', player: 0, uid: uidOf(s, 'mirror_barrier') })).toThrow(EngineError);
    expect(() => apply(s, { type: 'respond', player: 0, uid: uidOf(s, 'mirror_barrier') })).toThrow(EngineError);
  });
});

describe('ownership and edge cases', () => {
  it('a revived enemy monster can be tributed; it goes to its owner\'s graveyard', () => {
    const s = scenario({ p0: { hand: ['soul_recall', 'coral_serpent'] }, p1: { graveyard: ['shade_assassin'] } });
    const shade = uidOf(s, 'shade_assassin');
    const r = play(
      s,
      { type: 'activateSpell', player: 0, uid: uidOf(s, 'soul_recall'), target: { kind: 'graveyard', uid: shade, toZone: 0 } },
      { type: 'normalSummon', player: 0, uid: uidOf(s, 'coral_serpent'), zone: 0, tributes: [shade] },
    );
    const trib = r.events.find((e) => e.type === 'tribute')!;
    expect(trib).toMatchObject({ player: 0, uid: shade });
    expect(r.events.find((e) => e.type === 'toGraveyard' && e.uid === shade)).toMatchObject({ owner: 1, from: 'monster', zone: 0 });
    expect(r.state.players[1].graveyard).toEqual([shade]);
  });

  it('a revived monster can be equipped; equip spells always go to their owner\'s graveyard', () => {
    const s = scenario({ p0: { hand: ['soul_recall', 'dragon_blade'] }, p1: { graveyard: ['ember_wolf'], hand: ['judgment_bolt'] } });
    const wolf = uidOf(s, 'ember_wolf');
    const blade = uidOf(s, 'dragon_blade');
    const r = play(
      s,
      { type: 'activateSpell', player: 0, uid: uidOf(s, 'soul_recall'), target: { kind: 'graveyard', uid: wolf, toZone: 1 } },
      { type: 'activateSpell', player: 0, uid: blade, zone: 0, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 1 } } },
    );
    expect(currentAtk(r.state, wolf)).toBe(2400);
    const t = structuredClone(r.state);
    t.activePlayer = 1;
    const d = play(t, { type: 'activateSpell', player: 1, uid: uidOf(s, 'judgment_bolt'), target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 1 } } });
    expect(seq(d.state, d.events)).toEqual([
      'activate:judgment_bolt',
      'target',
      'destroy:ember_wolf',
      'toGraveyard:ember_wolf',
      'destroy:dragon_blade',
      'toGraveyard:dragon_blade',
      'toGraveyard:judgment_bolt',
    ]);
    expect(d.state.players[1].graveyard).toContain(wolf);
    expect(d.state.players[0].graveyard).toContain(blade);
  });

  it('abyss_magus can destroy a set spell; volt_lizard burns its controller\'s opponent even when revived from the enemy graveyard', () => {
    const s = scenario({ p0: { hand: ['abyss_magus'], monsters: ['lumen_sprite'] }, p1: { spellTraps: ['judgment_bolt'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'abyss_magus'), zone: 0, tributes: [uidOf(s, 'lumen_sprite')] }, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 0 } });
    expect(seq(r.state, r.events).slice(-2)).toEqual(['destroy:judgment_bolt', 'toGraveyard:judgment_bolt']);

    const v = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['ember_wolf'] } });
    // P0 controls P1's volt_lizard (revived earlier); it dies attacking ember_wolf → burns P1.
    const volt = 500;
    v.cards[volt] = { uid: volt, cardId: 'volt_lizard', owner: 1 };
    v.players[0].monsters[1] = { uid: volt, position: 'attack', faceUp: true, enteredTurn: 2, attacksThisTurn: 0, positionChangedTurn: -1 };
    const b = play(v, { type: 'attack', player: 0, attackerZone: 1, targetZone: 0 });
    expect(seq(b.state, b.events)).toEqual([
      'attackDeclare:volt_lizard',
      'battle:attackerDestroyed',
      'damage:p0:200',
      'destroy:volt_lizard',
      'toGraveyard:volt_lizard',
      'activate:volt_lizard',
      'damage:p1:500',
      'activate:ember_wolf',
      'damage:p0:300',
    ]);
    expect(b.events[4]).toMatchObject({ owner: 1 });
    expect(b.events[5]).toMatchObject({ player: 0, from: 'graveyard' });
  });

  it('if both players are at 0 LP at a check, the turn player wins', () => {
    const s = scenario({ p0: { lp: 0 }, p1: { lp: 0 } });
    const r = apply(s, { type: 'endTurn', player: 0 });
    expect(r.events).toEqual([{ type: 'gameOver', winner: 0, reason: 'lp' }]);
  });

  it('legal attack targets include face-down monsters; attacking a face-down thorn with a lone attacker can lose it', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }] } });
    expect(isListed(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 })).toBe(true);
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }, { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 0 } });
    expect(r.state.players[0].monsters.every((m) => m === null)).toBe(true);
    expect(r.state.players[1].monsters.every((m) => m === null)).toBe(true);
    expect(r.state.phase).toBe('battle');
  });
});
