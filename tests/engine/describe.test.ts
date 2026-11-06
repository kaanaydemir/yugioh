import { describe, expect, it } from 'vitest';
import { ALL_CARD_IDS } from '../../src/data/cards';
import { apply, cardName, chooseAction, describeEvent, describeEvents, describePending, inflect, newGame, playerName } from '../../src/engine';
import { play, scenario, uidOf } from './helpers';

describe('English names', () => {
  it('card and player names need no inflection; the genitive is the English possessive', () => {
    expect(cardName('ember_wolf')).toBe('Ember Wolf');
    expect(cardName('ember_wolf', 'acc')).toBe('Ember Wolf');
    expect(cardName('ember_wolf', 'dat')).toBe('Ember Wolf');
    expect(cardName('ember_wolf', 'gen')).toBe("Ember Wolf's");
    expect(cardName('chains_of_light', 'gen')).toBe("Chains of Light's");
    expect(cardName('scrap_raiders', 'gen')).toBe("Scrap Raiders'");
    expect(inflect('Stone Sentinel', 'loc')).toBe('Stone Sentinel');
    expect(playerName(0)).toBe('Player 1');
    expect(playerName(1, 'gen')).toBe("Player 2's");
    for (const id of ALL_CARD_IDS) for (const k of ['acc', 'dat'] as const) expect(cardName(id, k)).toMatch(/^[A-Za-z][A-Za-z' -]*$/);
  });
});

describe('describeEvent', () => {
  it('describes a summon, an attack and its results', () => {
    const s = scenario({ p0: { hand: ['ember_wolf'] }, p1: { monsters: ['stone_sentinel'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf'), zone: 0, tributes: [] }, { type: 'enterBattle', player: 0 }, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(describeEvents(r.state, r.events)).toEqual([
      'Player 1 Normal Summons Ember Wolf.',
      'Player 1 enters the Battle Phase!',
      'Ember Wolf attacks Stone Sentinel!',
      'Ember Wolf (ATK 1700) clashes with Stone Sentinel (ATK 500)!',
      'Player 2 takes 1200 damage! (LP 2800)',
      'Stone Sentinel is destroyed!',
      "Ember Wolf's effect!",
      'Player 2 takes 300 damage! (LP 2500)',
    ]);
  });

  it('never reveals hidden cards: draws, sets, and an attacked face-down monster before its flip', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'stone_sentinel', faceUp: false }] } });
    const r = apply(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    const lines = describeEvents(r.state, r.events);
    expect(lines[0]).toBe('Ember Wolf attacks a face-down monster!');
    expect(lines[1]).toBe('Face-down card flipped: Stone Sentinel!');
    const g = newGame({ seed: 3 });
    expect(describeEvents(g.state, g.events).some((l) => /draws/.test(l))).toBe(false); // opening hands silent
    const set = scenario({ p0: { hand: ['thorn_lurker', 'mirror_barrier'] } });
    const sr = play(set, { type: 'setMonster', player: 0, uid: uidOf(set, 'thorn_lurker'), zone: 0, tributes: [] }, { type: 'setSpellTrap', player: 0, uid: uidOf(set, 'mirror_barrier'), zone: 0 });
    expect(describeEvents(sr.state, sr.events)).toEqual(['Player 1 Sets a monster.', 'Player 1 Sets a card.']);
  });

  it('names a target destroyed in the same batch, equips and stat changes', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt', 'dragon_blade'], monsters: ['ember_wolf'] }, p1: { monsters: ['crystal_wyrm'] } });
    const r = play(
      s,
      { type: 'activateSpell', player: 0, uid: uidOf(s, 'judgment_bolt'), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } },
      { type: 'activateSpell', player: 0, uid: uidOf(s, 'dragon_blade'), zone: 0, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } },
    );
    expect(describeEvents(r.state, r.events)).toEqual([
      'Player 1 activates a Spell: Judgment Bolt!',
      'Target: Crystal Wyrm.',
      'Crystal Wyrm is destroyed!',
      'Player 1 activates a Spell: Dragon Blade!',
      'Target: Ember Wolf.',
      'Ember Wolf is equipped with Dragon Blade!',
      'Ember Wolf: ATK 2400 (+700).',
    ]);
  });

  it('every event of real games yields a string or null without throwing', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let { state, events } = newGame({ seed });
      for (const e of events) describeEvent(state, e, events);
      let guard = 0;
      while (state.winner === null && guard++ < 3000) {
        const r = apply(state, chooseAction(state, seed));
        for (const e of r.events) {
          const line = describeEvent(r.state, e, r.events);
          if (line !== null) {
            expect(line.length).toBeGreaterThan(3);
            expect(line).not.toMatch(/undefined|NaN|\?/);
          }
          const bare = describeEvent(r.state, e);
          expect(bare === null || typeof bare === 'string').toBe(true);
        }
        state = r.state;
      }
    }
  });

  it('game over and deck-out lines', () => {
    expect(describeEvent(scenario(), { type: 'gameOver', winner: 1, reason: 'deckout' })).toBe('Player 2 wins! (deck ran out)');
    expect(describeEvent(scenario(), { type: 'deckOut', player: 0 })).toBe("Player 1's Deck has run out!");
    expect(describeEvent(scenario(), { type: 'turnStart', player: 1, turn: 4 })).toBe('Turn 4 - Player 2');
  });

  it('prompts for pending decisions', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }], spellTraps: ['mirror_barrier'] } });
    const r = apply(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(describePending(r.state, r.state.pending!)).toBe('Player 2: Activate a Trap card?');
    const d = apply(r.state, { type: 'respond', player: 1, uid: null });
    expect(describePending(d.state, d.state.pending!)).toBe("Thorn Lurker's effect: choose a monster to destroy.");
    expect(describePending(s, { kind: 'discard', player: 0, count: 1 })).toBe('Player 1: Hand limit is 6. Discard 1 card.');
  });
});
