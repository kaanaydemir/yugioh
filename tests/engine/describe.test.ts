import { describe, expect, it } from 'vitest';
import { ALL_CARD_IDS } from '../../src/data/cards';
import { apply, cardName, chooseAction, describeEvent, describeEvents, describePending, inflect, newGame, playerName } from '../../src/engine';
import { play, scenario, uidOf } from './helpers';

describe('Turkish inflection', () => {
  it('applies vowel harmony and the right buffer letters to card names', () => {
    expect(cardName('ember_wolf', 'acc')).toBe("Kor Kurdu'nu");
    expect(cardName('ember_wolf', 'dat')).toBe("Kor Kurdu'na");
    expect(cardName('ember_wolf', 'gen')).toBe("Kor Kurdu'nun");
    expect(cardName('crystal_wyrm', 'acc')).toBe("Kristal Ejder'i");
    expect(cardName('crystal_wyrm', 'dat')).toBe("Kristal Ejder'e");
    expect(cardName('stone_sentinel', 'acc')).toBe("Taş Muhafız'ı");
    expect(cardName('stone_sentinel', 'dat')).toBe("Taş Muhafız'a");
    expect(cardName('shade_assassin', 'acc')).toBe("Gölge Suikastçı'yı");
    expect(cardName('shade_assassin', 'dat')).toBe("Gölge Suikastçı'ya");
    expect(cardName('shade_assassin', 'gen')).toBe("Gölge Suikastçı'nın");
    expect(cardName('thorn_lurker', 'acc')).toBe("Dikenli Pusucu'yu");
    expect(cardName('abyss_magus', 'acc')).toBe("Uçurum Büyücüsü'nü");
    expect(cardName('abyss_magus', 'dat')).toBe("Uçurum Büyücüsü'ne");
    expect(cardName('magma_titan', 'gen')).toBe("Magma Titanı'nın");
    expect(cardName('tide_golem', 'acc')).toBe("Gelgit Golemi'ni");
    expect(cardName('chains_of_light', 'acc')).toBe("Işık Zincirleri'ni");
    expect(cardName('volt_lizard', 'dat')).toBe("Şimşek Kertenkelesi'ne");
    expect(cardName('dragon_blade', 'acc')).toBe("Ejder Kılıcı'nı");
    expect(inflect('Taş Muhafız', 'loc')).toBe("Taş Muhafız'da");
    expect(inflect('Kor Kurdu', 'loc', true)).toBe("Kor Kurdu'nda");
    expect(playerName(0, 'gen')).toBe("Oyuncu 1'in");
    expect(playerName(1, 'gen')).toBe("Oyuncu 2'nin");
    expect(playerName(1, 'dat')).toBe("Oyuncu 2'ye");
    expect(playerName(0, 'loc')).toBe("Oyuncu 1'de");
    for (const id of ALL_CARD_IDS) for (const k of ['acc', 'dat', 'gen'] as const) expect(cardName(id, k)).toMatch(/^[^']+'[a-zçğıöşü]+$/);
  });
});

describe('describeEvent', () => {
  it('describes a summon, an attack and its results', () => {
    const s = scenario({ p0: { hand: ['ember_wolf'] }, p1: { monsters: ['stone_sentinel'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf'), zone: 0, tributes: [] }, { type: 'enterBattle', player: 0 }, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(describeEvents(r.state, r.events)).toEqual([
      "Oyuncu 1, Kor Kurdu'nu çağırdı.",
      'Oyuncu 1 Savaş Aşamasına geçti!',
      "Kor Kurdu, Taş Muhafız'a saldırıyor!",
      'Kor Kurdu (ATK 1700) ile Taş Muhafız (ATK 500) çarpıştı!',
      'Oyuncu 2, 1200 hasar aldı! (LP 2800)',
      'Taş Muhafız yok edildi!',
      "Kor Kurdu'nun etkisi!",
      'Oyuncu 2, 300 hasar aldı! (LP 2500)',
    ]);
  });

  it('never reveals hidden cards: draws, sets, and an attacked face-down monster before its flip', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'stone_sentinel', faceUp: false }] } });
    const r = apply(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    const lines = describeEvents(r.state, r.events);
    expect(lines[0]).toBe('Kor Kurdu kapalı canavara saldırıyor!');
    expect(lines[1]).toBe('Kapalı kart açıldı: Taş Muhafız!');
    const g = newGame({ seed: 3 });
    expect(describeEvents(g.state, g.events).some((l) => /çekti/.test(l))).toBe(false); // opening hands silent
    const set = scenario({ p0: { hand: ['thorn_lurker', 'mirror_barrier'] } });
    const sr = play(set, { type: 'setMonster', player: 0, uid: uidOf(set, 'thorn_lurker'), zone: 0, tributes: [] }, { type: 'setSpellTrap', player: 0, uid: uidOf(set, 'mirror_barrier'), zone: 0 });
    expect(describeEvents(sr.state, sr.events)).toEqual(['Oyuncu 1 kapalı bir canavar koydu.', 'Oyuncu 1 kapalı bir kart koydu.']);
  });

  it('names a target destroyed in the same batch, equips and stat changes', () => {
    const s = scenario({ p0: { hand: ['judgment_bolt', 'dragon_blade'], monsters: ['ember_wolf'] }, p1: { monsters: ['crystal_wyrm'] } });
    const r = play(
      s,
      { type: 'activateSpell', player: 0, uid: uidOf(s, 'judgment_bolt'), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } },
      { type: 'activateSpell', player: 0, uid: uidOf(s, 'dragon_blade'), zone: 0, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } },
    );
    expect(describeEvents(r.state, r.events)).toEqual([
      'Oyuncu 1 büyü kartı açtı: Yıldırım Hükmü!',
      'Hedef: Kristal Ejder.',
      'Kristal Ejder yok edildi!',
      'Oyuncu 1 büyü kartı açtı: Ejder Kılıcı!',
      'Hedef: Kor Kurdu.',
      "Kor Kurdu, Ejder Kılıcı'nı kuşandı!",
      'Kor Kurdu: ATK 2400 (+700).',
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
    expect(describeEvent(scenario(), { type: 'gameOver', winner: 1, reason: 'deckout' })).toBe('Oyuncu 2 kazandı! (deste bitti)');
    expect(describeEvent(scenario(), { type: 'deckOut', player: 0 })).toBe("Oyuncu 1'in destesi bitti!");
    expect(describeEvent(scenario(), { type: 'turnStart', player: 1, turn: 4 })).toBe('Tur 4 - Oyuncu 2');
  });

  it('prompts for pending decisions', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }], spellTraps: ['mirror_barrier'] } });
    const r = apply(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(describePending(r.state, r.state.pending!)).toBe('Oyuncu 2: Tuzak kartı açmak ister misin?');
    const d = apply(r.state, { type: 'respond', player: 1, uid: null });
    expect(describePending(d.state, d.state.pending!)).toBe("Dikenli Pusucu'nun etkisi: yok edilecek canavarı seç.");
    expect(describePending(s, { kind: 'discard', player: 0, count: 1 })).toBe('Oyuncu 1: El sınırı 6. Elinden 1 kart at.');
  });
});
