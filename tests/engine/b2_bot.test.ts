// Batch 2: the CPU answers every new decision through legalActions (coin call, count, quick spell answers, lance
// target, straw redirect), seeded bot-vs-bot games with the new cards reach gameOver with the invariants after
// every action and replay deterministically, and the log describes the new events in Turkish.
import { describe, expect, it } from 'vitest';
import {
  actingPlayer,
  apply,
  chooseAction,
  describeEvents,
  describePending,
  legalActions,
  newGame,
  type Action,
  type GameState,
  type PlayerId,
} from '../../src/engine';
import { ALL_CARDS, isMonster, type CardId } from '../../src/data/cards';
import { makeRng } from '../../src/engine/rng';
import { checkEvents, checkInvariantsRelaxed } from './helpers';
import { atk, choose, play, ref, scenario, sp, uidOf } from './b2_kit';

const B2_START = ALL_CARDS.findIndex((c) => c.id === 'tide_harpooner');
const B2 = ALL_CARDS.slice(B2_START).map((c) => c.id);

/** A seeded 40-card deck: every batch-2 card plus random older cards (enough monsters to play). */
function b2Deck(seed: number, side: PlayerId): CardId[] {
  const rng = makeRng((seed * 104729 + side * 7919 + 3) >>> 0);
  const older = ALL_CARDS.slice(0, B2_START).filter((c) => !c.retired);
  const mons = older.filter(isMonster).map((c) => c.id);
  const rest = older.filter((c) => !isMonster(c)).map((c) => c.id);
  const pick = (l: CardId[], n: number) => {
    const a = [...l];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };
  // the magnet trio twice so the fusion shows up
  return [...B2, 'polar_needle', 'polar_anvil', 'polar_coil', ...pick(mons, 8), ...pick(rest, 3)];
}

function playGame(seed: number, zones: 3 | 5): { state: GameState; actions: Action[]; kinds: Set<string>; acts: Set<string> } {
  let { state } = newGame({ seed, decks: [b2Deck(seed, 0), b2Deck(seed, 1)], zones, startHand: 5, firstPlayerDraws: true });
  checkInvariantsRelaxed(state);
  const actions: Action[] = [];
  const kinds = new Set<string>();
  const acts = new Set<string>();
  for (let i = 0; i < 3000 && state.winner === null; i++) {
    const a = chooseAction(state, seed);
    expect(actingPlayer(state), `seed ${seed}`).toBe((a as { player: PlayerId }).player);
    const r = apply(state, a);
    checkInvariantsRelaxed(r.state);
    checkEvents(r.state, r.events);
    for (const e of r.events) {
      kinds.add(e.type);
      if (e.type === 'activate' || e.type === 'summon') acts.add(e.cardId);
      if (e.type === 'decision') kinds.add(`decision:${e.pending.kind}`);
    }
    // the log never throws on a batch
    describeEvents(state, r.events);
    if (r.state.pending) expect(describePending(r.state, r.state.pending).length).toBeGreaterThan(5);
    actions.push(a);
    state = r.state;
  }
  return { state, actions, kinds, acts };
}

describe('bot vs bot with the batch 2 cards', () => {
  const kinds = new Set<string>();
  const acts = new Set<string>();
  const games: { seed: number; zones: 3 | 5; actions: Action[]; json: string }[] = [];
  it('30 seeded games (3 and 5 zones) reach gameOver with invariants after every action', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const zones: 3 | 5 = seed % 2 ? 5 : 3;
      const g = playGame(seed, zones);
      expect(g.state.winner, `seed ${seed}`).not.toBeNull();
      g.kinds.forEach((k) => kinds.add(k));
      g.acts.forEach((k) => acts.add(k));
      games.push({ seed, zones, actions: g.actions, json: JSON.stringify(g.state) });
    }
  }, 180_000);

  it('replaying the actions gives the identical final state (seeded coin / die / tokens)', () => {
    for (const g of games.slice(0, 12)) {
      let { state } = newGame({ seed: g.seed, decks: [b2Deck(g.seed, 0), b2Deck(g.seed, 1)], zones: g.zones, startHand: 5, firstPlayerDraws: true });
      for (const a of g.actions) state = apply(state, a).state;
      expect(JSON.stringify(state), `seed ${g.seed}`).toBe(g.json);
    }
  }, 120_000);

  it('the bot uses the new mechanics', () => {
    for (const k of ['coinToss', 'massDestroy', 'controlChange', 'diceRoll', 'tokenVanish', 'decision:coinCall'])
      expect(kinds.has(k), k).toBe(true);
    const want: CardId[] = ['well_pail', 'void_eye', 'auger_lance', 'straw_decoys', 'soul_leash', 'spite_axe', 'dial_jester', 'polar_needle'];
    expect(want.filter((id) => !acts.has(id))).toEqual([]);
  });
});

describe('the CPU answers each new decision', () => {
  it('coinCall: one of the two calls', () => {
    const s = scenario({ p0: { monsters: ['dial_jester'] }, p1: { monsters: ['crystal_wyrm'] } });
    const st = play(s, { type: 'activateMonster', player: 0, zone: 0 }).state;
    const a = chooseAction(st, 1);
    expect(a.type).toBe('callCoin');
  });

  it('chooseCount: the fewest cards that make the attack pay', () => {
    // a 1700 wolf: one banish (1800) is enough
    const s = scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['ember_wolf', 'shade_assassin', 'volt_lizard'] }, p1: { monsters: ['ember_wolf'] } });
    const st = play(s, { type: 'activateMonster', player: 0, zone: 0 }).state;
    expect(chooseAction(st, 1)).toEqual({ type: 'chooseCount', player: 0, n: 1 });
    // a 1900 assassin needs both (2200)
    const t = scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['ember_wolf', 'shade_assassin', 'volt_lizard'] }, p1: { monsters: ['shade_assassin'] } });
    const tt = play(t, { type: 'activateMonster', player: 0, zone: 0 }).state;
    expect(chooseAction(tt, 1)).toEqual({ type: 'chooseCount', player: 0, n: 2 });
  });

  it('straw_decoys against a lethal direct attack; the attacker then picks a token', () => {
    const s = scenario({ active: 1, turn: 4, phase: 'battle', p1: { monsters: ['crystal_wyrm'] }, p0: { lp: 2000, spellTraps: [{ id: 'straw_decoys', setTurn: 3 }] } });
    let st = play(s, atk(1, 0, null)).state;
    expect(chooseAction(st, 1)).toEqual({ type: 'respond', player: 0, uid: uidOf(s, 'straw_decoys', 0) });
    st = play(st, chooseAction(st, 1)).state;
    expect(chooseAction(st, 1).type).toBe('chooseTarget');
  });

  it('auger_lance on the attacker\'s equip when the attack hurts, and it targets that equip', () => {
    const s = scenario({
      active: 1,
      turn: 4,
      phase: 'battle',
      p1: { monsters: ['ember_wolf'], spellTraps: ['healing_spring', { id: 'dragon_blade', equippedTo: 0 }] },
      p0: { monsters: ['shade_assassin'], spellTraps: [{ id: 'auger_lance', setTurn: 3 }] },
    });
    let st = play(s, atk(1, 0, 0)).state;
    const a = chooseAction(st, 1);
    expect(a).toEqual({ type: 'respond', player: 0, uid: uidOf(s, 'auger_lance', 0) });
    st = play(st, a).state;
    expect(chooseAction(st, 1)).toEqual(choose(0, ref(1, 'spellTrap', 1)));
  });

  it('fuses whenever the three pieces stand', () => {
    const s = scenario({ p0: { monsters: ['polar_needle', 'polar_anvil', 'polar_coil'], hand: ['polar_sovereign'] } });
    expect(chooseAction(s, 1).type).toBe('specialSummon');
  });

  it('every action the bot picks is legal (all new pending kinds)', () => {
    const s = scenario({ p0: { hand: ['winnow_sieve'] } });
    const st = play(s, sp(s, 'winnow_sieve')).state;
    const a = chooseAction(st, 2);
    expect(legalActions(st)).toContainEqual(a);
  });
});

describe('Turkish log lines for the new events and decisions', () => {
  it('coin, dice, control, mass destruction, banish, token and the axe return', () => {
    const s = scenario({ p0: { monsters: ['dial_jester'] }, p1: { monsters: ['crystal_wyrm'] } });
    let r = play(s, { type: 'activateMonster', player: 0, zone: 0 });
    expect(describePending(r.state, r.state.pending!)).toBe('Oyuncu 1: Yazı mı, Tura mı?');
    r = play(r.state, { type: 'callCoin', player: 0, call: 'heads' });
    const lines = describeEvents(s, r.events);
    expect(lines.some((l) => /^Para atıldı: (TURA|YAZI)! Oyuncu 1 (bildi|bilemedi)\.$/.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith("Kadran Soytarısı: "))).toBe(true);

    const p = scenario({ p0: { hand: ['puppet_string'] }, p1: { monsters: ['crystal_wyrm'] } });
    const pr = play(p, sp(p, 'puppet_string', 0, { target: { kind: 'monster', ref: ref(1, 'monster', 0) } }));
    expect(describeEvents(p, pr.events)).toContain("Oyuncu 1, Kristal Ejder'i kontrolüne aldı!");
    const back = play(pr.state, { type: 'endTurn', player: 0 });
    expect(describeEvents(p, back.events)).toContain('Kristal Ejder sahibine döndü.');

    const d = scenario({ p0: { hand: ['lucky_die'], monsters: ['ember_wolf'] } });
    expect(describeEvents(d, play(d, sp(d, 'lucky_die')).events).some((l) => /^Zar atıldı: [1-6]!$/.test(l))).toBe(true);

    const o = scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['ember_wolf'] } });
    expect(describeEvents(o, play(o, { type: 'activateMonster', player: 0, zone: 0 }).events)).toContain('Kor Kurdu oyundan çıkarıldı.');
    const o2 = scenario({ p0: { monsters: ['hollow_ogre'], graveyard: ['ember_wolf', 'tide_golem'] } });
    const o2s = play(o2, { type: 'activateMonster', player: 0, zone: 0 }).state;
    expect(describePending(o2s, o2s.pending!)).toBe("Kovuk Devi'nin etkisi: oyundan çıkarılacak canavar sayısını seç (1–2).");

    const t = scenario({ p0: { hand: ['straw_decoys'] } });
    expect(describeEvents(t, play(t, sp(t, 'straw_decoys')).events)).toContain('Oyuncu 1 bir Saman Korkuluk jetonu çağırdı.');

    const ax = scenario({ p0: { monsters: ['ember_wolf'], spellTraps: [{ id: 'spite_axe', equippedTo: 0 }] }, p1: { hand: ['purging_wave'] }, active: 1, turn: 4 });
    const axr = play(ax, sp(ax, 'purging_wave', 1, { target: { kind: 'card', ref: ref(0, 'spellTrap', 0) } }));
    expect(describeEvents(ax, axr.events)).toContain('Hınç Baltası sahibinin destesinin üstüne döndü.');

    const q = scenario({ active: 1, turn: 4, phase: 'battle', p1: { monsters: ['crystal_wyrm'] }, p0: { spellTraps: [{ id: 'straw_decoys', setTurn: 3 }] } });
    const qs = play(q, atk(1, 0, null)).state;
    expect(describePending(qs, qs.pending!)).toBe('Oyuncu 1: Tuzak ya da hızlı büyü açmak ister misin?');
    const fus = scenario({ p0: { monsters: ['polar_needle', 'polar_anvil', 'polar_coil'], hand: ['polar_sovereign'] } });
    const fa = legalActions(fus).find((a) => a.type === 'specialSummon')!;
    expect(describeEvents(fus, play(fus, fa).events)).toContain("Oyuncu 1, Kutup Hükümdarı'nı elinden özel çağırdı!");
  });
});
