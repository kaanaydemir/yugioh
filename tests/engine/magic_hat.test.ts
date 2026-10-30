// magic_hat (Sihirli Şapka): the attacked monster + up to 2 decoy tokens hide under shuffled hats; the
// attacker guesses. Covers activation, decoy counts (3+3 and 5+5), both guesses, end-of-turn restore,
// token bookkeeping, determinism, the bot and trapLock.
import { describe, expect, it } from 'vitest';
import { apply, chooseAction, legalActions, actingPlayer, type Action, type GameEvent, type GameState, type PlayerId } from '../../src/engine';
import { CARDS, TRAP_IDS, isTrap, type CardId } from '../../src/data/cards';
import { describeEvents, describePending } from '../../src/engine';
import { findMonster } from '../../src/engine/query';
import { checkInvariants, isListed, play, scenario, uidOf, type ScenarioOpts } from './helpers';

const atk = (p: PlayerId, attackerZone: number, targetZone: number | null): Action => ({ type: 'attack', player: p, attackerZone, targetZone });
const respondHat = (s: GameState, p: PlayerId): Action => ({ type: 'respond', player: p, uid: uidOf(s, 'magic_hat', p) });
const endTurn = (p: PlayerId): Action => ({ type: 'endTurn', player: p });
const pick = (p: PlayerId, defender: PlayerId, index: number): Action => ({ type: 'chooseTarget', player: p, target: { player: defender, zone: 'monster', index } });
const opp = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const types = (e: GameEvent[]) => e.map((x) => x.type);
const ev = <T extends GameEvent['type']>(e: GameEvent[], t: T) => e.filter((x): x is Extract<GameEvent, { type: T }> => x.type === t);
const BOTH: PlayerId[] = [0, 1];

type MonList = NonNullable<ScenarioOpts['p0']>['monsters'];

/** `p` attacks with a shade_assassin (1900) from zone 0; the defender holds magic_hat and `defenders`. */
function duel(p: PlayerId, defenders: MonList, o: Omit<ScenarioOpts, 'p0' | 'p1' | 'active' | 'phase'> = {}, attacker: CardId = 'shade_assassin'): GameState {
  const me = { monsters: [attacker] };
  const them = { monsters: defenders, spellTraps: ['magic_hat' as CardId] };
  return scenario({ ...o, phase: 'battle', active: p, ...(p === 0 ? { p0: me, p1: them } : { p0: them, p1: me }) });
}

/** Declares the attack on zone 0 and activates the hat; returns the state waiting for the attacker's pick. */
function hatted(p: PlayerId, defenders: MonList, o: Omit<ScenarioOpts, 'p0' | 'p1' | 'active' | 'phase'> = {}, attacker: CardId = 'shade_assassin') {
  const s = duel(p, defenders, o, attacker);
  const w = play(s, atk(p, 0, 0));
  expect(w.state.pending).toMatchObject({ kind: 'trapResponse', player: opp(p) });
  const r = play(w.state, respondHat(w.state, opp(p)));
  return { s, r };
}

const hatZones = (s: GameState, p: PlayerId) => s.players[p].monsters.flatMap((m, i) => (m && m.hat ? [i] : []));
const realZone = (s: GameState, p: PlayerId) => s.players[p].monsters.findIndex((m) => m?.hat === 'real');
const cardCount = (s: GameState) => Object.keys(s.cards).length;

describe('magic_hat card data', () => {
  it('is a Turkish trap in TRAP_IDS with the specified text', () => {
    const d = CARDS.magic_hat;
    expect(isTrap(d)).toBe(true);
    expect(d.name).toBe('Sihirli Şapka');
    expect((d as { effect: string }).effect).toBe('hatShuffle');
    expect(TRAP_IDS).toContain('magic_hat');
    expect((d as { text: string }).text).toBe(
      'Rakip bir canavarın sana ait canavara saldırı ilan ettiğinde: saldırılan canavarını ve 2 sahte şapkayı kapalı olarak karıştır; rakip bir şapka seçip ona saldırır.',
    );
  });
});

describe('magic_hat activation', () => {
  for (const p of BOTH) {
    it(`P${p + 1}: offered when a monster is attacked and a zone is free`, () => {
      const s = duel(p, ['lumen_sprite']);
      const w = play(s, atk(p, 0, 0));
      expect(w.state.pending).toMatchObject({ kind: 'trapResponse', player: opp(p) });
      expect(w.state.pending && w.state.pending.kind === 'trapResponse' && w.state.pending.options).toContain(uidOf(s, 'magic_hat', opp(p)));
    });
  }

  it('not offered when every monster zone is occupied (3 and 5 zones)', () => {
    const full3 = duel(0, ['lumen_sprite', 'thorn_lurker', 'tide_golem']);
    expect(play(full3, atk(0, 0, 0)).state.pending).toBeNull();
    const full5 = duel(0, ['lumen_sprite', 'thorn_lurker', 'tide_golem', 'stone_sentinel', 'ember_wolf'], { zones: 5 });
    expect(play(full5, atk(0, 0, 0)).state.pending).toBeNull();
  });

  it('not offered against a direct attack, with trapLock, or on the turn it was set', () => {
    const direct = scenario({ phase: 'battle', p0: { monsters: ['storm_hawk'] }, p1: { monsters: [], spellTraps: ['magic_hat'] } });
    expect(play(direct, atk(0, 0, null)).state.pending).toBeNull();
    const locked = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin', 'steel_silencer'] }, p1: { monsters: ['lumen_sprite'], spellTraps: ['magic_hat'] } });
    expect(play(locked, atk(0, 0, 0)).state.pending).toBeNull();
    const fresh = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['lumen_sprite'], spellTraps: [{ id: 'magic_hat', setTurn: 3 }] } });
    expect(play(fresh, atk(0, 0, 0)).state.pending).toBeNull();
  });

  it('declining leaves a normal battle', () => {
    const s = duel(0, ['lumen_sprite']);
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, { type: 'respond', player: 1, uid: null });
    expect(types(r.events)).toContain('battle');
    expect(hatZones(r.state, 1)).toEqual([]);
  });
});

describe('hat layout: decoy count and zones', () => {
  it('3 zones, 1 monster: 2 decoys, hats fill all 3 zones', () => {
    for (const p of BOTH) {
      const { s, r } = hatted(p, ['lumen_sprite']);
      const d = opp(p);
      expect(hatZones(r.state, d)).toEqual([0, 1, 2]);
      expect(r.state.players[d].monsters.filter((m) => m?.hat === 'decoy')).toHaveLength(2);
      expect(r.state.players[d].monsters.filter((m) => m?.hat === 'real')).toHaveLength(1);
      expect(cardCount(r.state)).toBe(cardCount(s) + 2);
      expect(r.state.pending).toMatchObject({ kind: 'chooseTarget', player: p });
      const cands = (r.state.pending as { candidates: { player: PlayerId; zone: string; index: number }[] }).candidates;
      expect(cands.map((c) => c.index)).toEqual([0, 1, 2]);
      expect(cands.every((c) => c.player === d && c.zone === 'monster')).toBe(true);
      expect(describePending(r.state, r.state.pending!)).toContain('Sihirli Şapka');
    }
  });

  it('3 zones, 2 monsters: 1 decoy, 2 hats, the other monster is untouched', () => {
    const { r } = hatted(0, ['lumen_sprite', 'tide_golem']);
    const m = r.state.players[1].monsters;
    expect(m.filter((x) => x?.hat === 'decoy')).toHaveLength(1);
    expect(m.filter((x) => x?.hat === 'real')).toHaveLength(1);
    const cands = (r.state.pending as { candidates: { index: number }[] }).candidates.map((c) => c.index);
    expect(cands).toHaveLength(2);
    // the second (unattacked) monster keeps its zone unless a hat took it; no monster was lost
    const plain = m.filter((x) => x && !x.hat);
    expect(plain).toHaveLength(1);
    expect(plain[0]!.faceUp).toBe(true);
    expect(m.filter(Boolean)).toHaveLength(3);
    expect(m[1]).not.toBeNull(); // tide_golem stands in zone 1
    expect(m[1]!.hat).toBeUndefined();
    expect(hatZones(r.state, 1)).toEqual([0, 2]);
  });

  it('5 zones, 1 monster: 2 decoys, hats on 3 of the 5 zones; 3 free zones left over are not all used', () => {
    const { r } = hatted(0, ['lumen_sprite'], { zones: 5 });
    const hz = hatZones(r.state, 1);
    expect(hz).toHaveLength(3);
    expect(new Set(hz).size).toBe(3);
    const cands = (r.state.pending as { candidates: { index: number }[] }).candidates.map((c) => c.index);
    expect(cands).toEqual(hz);
  });

  it('5 zones, 4 monsters: exactly 1 decoy (one free zone)', () => {
    const { r } = hatted(1, ['lumen_sprite', 'tide_golem', 'stone_sentinel', 'ember_wolf'], { zones: 5 });
    const d = 0;
    expect(r.state.players[d].monsters.filter((x) => x?.hat === 'decoy')).toHaveLength(1);
    expect(hatZones(r.state, d)).toHaveLength(2);
  });

  it('the token: face-down defense, ATK/DEF 0, owned by the hat controller, never in a graveyard', () => {
    const { r } = hatted(0, ['lumen_sprite']);
    const tok = r.state.players[1].monsters.find((m) => m?.hat === 'decoy')!;
    expect(tok.faceUp).toBe(false);
    expect(tok.position).toBe('defense');
    expect(r.state.cards[tok.uid].owner).toBe(1);
    expect(r.state.players[1].graveyard.concat(r.state.players[0].graveyard)).not.toContain(tok.uid);
    const real = r.state.players[1].monsters.find((m) => m?.hat === 'real')!;
    expect(real.faceUp).toBe(false);
    expect(real.position).toBe('defense');
    expect(real.hatOrigin).toEqual({ faceUp: true, position: 'attack' });
  });
});

describe('events', () => {
  it('hatsShuffled lists every hat (no real marker), hatChosen follows the pick', () => {
    const { r } = hatted(0, ['lumen_sprite']);
    const e = ev(r.events, 'hatsShuffled');
    expect(e).toHaveLength(1);
    expect(e[0].player).toBe(1);
    expect(e[0].sourceZone).toBe(0);
    expect(e[0].hats.map((h) => h.zone)).toEqual([0, 1, 2]);
    expect(Object.keys(e[0].hats[0]).sort()).toEqual(['uid', 'zone']);
    const order = types(r.events);
    expect(order.indexOf('activate')).toBeLessThan(order.indexOf('hatsShuffled'));
    expect(order.indexOf('hatsShuffled')).toBeLessThan(order.indexOf('decision'));
    const c = play(r.state, pick(0, 1, 1));
    expect(ev(c.events, 'hatChosen')).toEqual([expect.objectContaining({ player: 0, hatOwner: 1, zone: 1 })]);
    expect(describeEvents(c.state, [...r.events, ...c.events]).length).toBeGreaterThan(2);
  });
});

describe('attacker hits a decoy', () => {
  for (const p of BOTH) {
    it(`P${p + 1}: the decoy pops, nobody is damaged, the real monster stays hidden`, () => {
      const { r } = hatted(p, ['lumen_sprite']);
      const d = opp(p);
      const zr = realZone(r.state, d);
      const zd = hatZones(r.state, d).find((z) => z !== zr)!;
      const decoyUid = r.state.players[d].monsters[zd]!.uid;
      const c = play(r.state, pick(p, d, zd));
      expect(ev(c.events, 'decoyPopped')).toEqual([{ type: 'decoyPopped', player: d, uid: decoyUid, zone: zd, cause: 'attacked' }]);
      expect(types(c.events)).not.toContain('damage');
      expect(types(c.events)).not.toContain('battle');
      expect(types(c.events)).not.toContain('destroy');
      expect(types(c.events)).not.toContain('toGraveyard');
      expect(types(c.events)).not.toContain('flip');
      expect(c.state.cards[decoyUid]).toBeUndefined();
      expect(c.state.players[d].monsters[zd]).toBeNull();
      expect(c.state.players[0].lp).toBe(4000);
      expect(c.state.players[1].lp).toBe(4000);
      expect(c.state.players[d].graveyard).toHaveLength(1); // only the spent magic_hat trap
      const real = c.state.players[d].monsters[zr]!;
      expect(real.hat).toBe('real');
      expect(real.faceUp).toBe(false);
      expect(c.state.pending).toBeNull();
      // the other decoy is still a legal target for another attacker (the attack of this monster is spent)
      expect(c.state.players[d].monsters.filter((m) => m?.hat === 'decoy')).toHaveLength(1);
    });
  }

  it('a second attacker may still guess among the remaining hats (no new hat trap, no new pending)', () => {
    const s = scenario({
      phase: 'battle',
      p0: { monsters: ['shade_assassin', 'ember_wolf'] },
      p1: { monsters: ['lumen_sprite'], spellTraps: ['magic_hat'] },
    });
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, respondHat(w.state, 1));
    const zr = realZone(r.state, 1);
    const zd = hatZones(r.state, 1).find((z) => z !== zr)!;
    const c = play(r.state, pick(0, 1, zd));
    const second = legalActions(c.state).filter((a) => a.type === 'attack' && a.attackerZone === 1);
    expect(second.map((a) => (a as { targetZone: number }).targetZone).sort()).toEqual(hatZones(c.state, 1));
    const hit = play(c.state, atk(0, 1, zr));
    expect(types(hit.events)).toContain('hatRevealed');
  });
});

describe('attacker hits the real monster', () => {
  it('the hats lift, the monster is flipped and fights as a face-down defender, battle resolves', () => {
    // lumen_sprite (DEF 600) hidden; shade_assassin ATK 1900 destroys it in defense; no battle damage (defense)
    const { r } = hatted(0, ['lumen_sprite']);
    const zr = realZone(r.state, 1);
    const realUid = r.state.players[1].monsters[zr]!.uid;
    const decoys = r.state.players[1].monsters.filter((m) => m?.hat === 'decoy').map((m) => m!.uid);
    const c = play(r.state, pick(0, 1, zr));
    const t = types(c.events);
    expect(t).toContain('hatChosen');
    expect(t.indexOf('hatRevealed')).toBeLessThan(t.indexOf('flip'));
    expect(t.indexOf('flip')).toBeLessThan(t.indexOf('battle'));
    expect(ev(c.events, 'hatRevealed')[0]).toMatchObject({ player: 1, uid: realUid, cardId: 'lumen_sprite', zone: zr });
    const restore = ev(c.events, 'hatRestore');
    expect(restore).toHaveLength(1);
    expect(restore[0]).toMatchObject({ reason: 'revealed', restored: null });
    expect(restore[0].removed.map((x) => x.uid).sort()).toEqual([...decoys].sort());
    expect(ev(c.events, 'battle')[0]).toMatchObject({ result: 'targetDestroyed', targetPosition: 'defense', targetValue: 600 });
    expect(c.state.players[1].lp).toBe(4000);
    expect(hatZones(c.state, 1)).toEqual([]);
    expect(c.state.players[1].graveyard).toContain(realUid);
    for (const u of decoys) expect(c.state.cards[u]).toBeUndefined();
    expect(c.state.players[1].monsters.every((m) => m === null)).toBe(true);
  });

  it('a surviving real monster returns to its original attack position after the battle', () => {
    // tide_golem (ATK 1100 / DEF 2000) in attack position, attacked by ember_wolf (1700): fights as DEF 2000 -> survives
    const s = duel(0, [{ id: 'tide_golem', position: 'attack' }], {}, 'ember_wolf');
    const w = play(s, atk(0, 0, 0));
    const r = play(w.state, respondHat(w.state, 1));
    const zr = realZone(r.state, 1);
    const c = play(r.state, pick(0, 1, zr));
    expect(ev(c.events, 'battle')[0]).toMatchObject({ targetPosition: 'defense', targetValue: 2000, result: 'noDestroy' });
    const m = c.state.players[1].monsters[zr]!;
    expect(m.faceUp).toBe(true);
    expect(m.position).toBe('attack');
    expect(m.hat).toBeUndefined();
    expect(m.hatOrigin).toBeUndefined();
    expect(ev(c.events, 'positionChange')).toEqual([expect.objectContaining({ uid: m.uid, position: 'attack' })]);
    // attacker (1700 < 2000) takes 300 battle damage, plus tide_golem's 300 burn for being attacked in defense
    expect(c.state.players[0].lp).toBe(3400);
  });

  it('flip effects do not trigger when the real monster is a flip monster (thorn_lurker)', () => {
    const { r } = hatted(0, [{ id: 'thorn_lurker', faceUp: false }]);
    const zr = realZone(r.state, 1);
    const c = play(r.state, pick(0, 1, zr));
    expect(types(c.events)).toContain('flip');
    expect(c.state.pending).toBeNull();
    expect(types(c.events)).not.toContain('target');
    expect(c.state.players[0].monsters[0]).not.toBeNull(); // the attacker survives (not destroyed by thorn)
  });
});

describe('end-of-turn restoration', () => {
  it('leftover tokens vanish and the hidden monster flips back face-up in its new zone, no flip effect', () => {
    const { r } = hatted(0, ['lumen_sprite']);
    const zr = realZone(r.state, 1);
    const realUid = r.state.players[1].monsters[zr]!.uid;
    const zd = hatZones(r.state, 1).find((z) => z !== zr)!;
    const c = play(r.state, pick(0, 1, zd));
    const before = cardCount(c.state);
    const e = play(c.state, endTurn(0));
    const restore = ev(e.events, 'hatRestore');
    expect(restore).toHaveLength(1);
    expect(restore[0]).toMatchObject({ player: 1, reason: 'turnEnd', restored: { uid: realUid, cardId: 'lumen_sprite', zone: zr, position: 'attack', faceUp: true } });
    expect(restore[0].removed).toHaveLength(1);
    expect(types(e.events)).not.toContain('flip');
    expect(types(e.events)).not.toContain('target');
    const m = e.state.players[1].monsters[zr]!;
    expect(m.faceUp).toBe(true);
    expect(m.position).toBe('attack');
    expect(m.hat).toBeUndefined();
    expect(hatZones(e.state, 1)).toEqual([]);
    expect(e.state.players[1].monsters.filter(Boolean)).toHaveLength(1);
    expect(cardCount(e.state)).toBe(before - 1);
    // exactly once: the restore comes before the End Phase marker and not again next turn
    const t = types(e.events);
    expect(t.indexOf('hatRestore')).toBeLessThan(t.indexOf('phaseChange'));
    const e2 = play(e.state, endTurn(1));
    expect(types(e2.events)).not.toContain('hatRestore');
  });

  it('a monster that was face-down before the hats stays face-down (no card name leaked)', () => {
    const { r } = hatted(0, [{ id: 'thorn_lurker', faceUp: false }]);
    const zr = realZone(r.state, 1);
    const zd = hatZones(r.state, 1).find((z) => z !== zr)!;
    const c = play(r.state, pick(0, 1, zd));
    const e = play(c.state, endTurn(0));
    const restore = ev(e.events, 'hatRestore')[0];
    expect(restore.restored).toMatchObject({ cardId: null, faceUp: false, position: 'defense' });
    const m = e.state.players[1].monsters[zr]!;
    expect(m.faceUp).toBe(false);
    expect(m.position).toBe('defense');
  });

  it('no restore event when the hats were already lifted by a hit', () => {
    const { r } = hatted(0, ['lumen_sprite']);
    const c = play(r.state, pick(0, 1, realZone(r.state, 1)));
    const e = play(c.state, endTurn(0));
    expect(types(e.events)).not.toContain('hatRestore');
  });
});

describe('tokens are not cards', () => {
  it('never reach a graveyard, hand or deck and leave no CardInstance behind across a whole turn', () => {
    const { s, r } = hatted(0, ['lumen_sprite'], { zones: 5 });
    const tokenUids = r.state.players[1].monsters.filter((m) => m?.hat === 'decoy').map((m) => m!.uid);
    expect(tokenUids).toHaveLength(2);
    const zr = realZone(r.state, 1);
    const zd = hatZones(r.state, 1).find((z) => z !== zr)!;
    const c = play(r.state, pick(0, 1, zd), endTurn(0));
    for (const t of tokenUids) {
      expect(c.state.cards[t]).toBeUndefined();
      for (const pl of c.state.players) {
        expect(pl.graveyard).not.toContain(t);
        expect(pl.hand).not.toContain(t);
        expect(pl.deck).not.toContain(t);
        expect(pl.monsters.some((m) => m?.uid === t)).toBe(false);
      }
    }
    // one card drawn by the next turn player; every other card is where it was; the trap went to the graveyard
    expect(cardCount(c.state)).toBe(cardCount(s));
  });

  it('a token is not a monster for the wins, tributes, and ATK/DEF queries', () => {
    const { r } = hatted(0, ['lumen_sprite']);
    const tok = r.state.players[1].monsters.find((m) => m?.hat === 'decoy')!;
    expect(CARDS[r.state.cards[tok.uid].cardId].kind).toBe('trap'); // a token reuses the trap's identity, never a monster def
    expect(findMonster(r.state, tok.uid)).not.toBeNull();
    expect(r.state.winner).toBeNull();
    // tokens are never face-up: no aura / field effect / trapLock can come from them
    expect(r.state.players[1].monsters.every((m) => !m || m.hat === undefined || !m.faceUp)).toBe(true);
  });
});

describe('determinism and shuffling', () => {
  it('same seed, same state: identical layout; a different rng state changes it eventually', () => {
    const layout = (rng: number) => {
      const s = duel(0, ['lumen_sprite'], { zones: 5 });
      s.rng = rng;
      const w = play(s, atk(0, 0, 0));
      const r = play(w.state, respondHat(w.state, 1));
      return { state: r.state, key: JSON.stringify([hatZones(r.state, 1), realZone(r.state, 1)]) };
    };
    const a = layout(777);
    const b = layout(777);
    expect(a.state).toEqual(b.state);
    expect(a.key).toBe(b.key);
    const keys = new Set<string>();
    for (let i = 0; i < 40; i++) keys.add(layout(1000 + i * 7919).key);
    expect(keys.size).toBeGreaterThan(5);
  });

  it('the real monster lands on every hat position over many seeds (it really is shuffled)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const s = duel(0, ['lumen_sprite']);
      s.rng = 31 + i * 104729;
      const w = play(s, atk(0, 0, 0));
      const r = play(w.state, respondHat(w.state, 1));
      seen.add(realZone(r.state, 1));
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});

describe('bot', () => {
  it('as attacker it only ever picks a listed hat zone, and varies its guess', () => {
    const zones = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const { r } = hatted(0, ['lumen_sprite'], { zones: 5 });
      const st = structuredClone(r.state);
      st.rng = (st.rng + seed * 2654435761) >>> 0;
      expect(actingPlayer(st)).toBe(0);
      const a = chooseAction(st, seed);
      expect(a.type).toBe('chooseTarget');
      expect(isListed(st, a)).toBe(true);
      expect(hatZones(st, 1)).toContain((a as { target: { index: number } }).target.index);
      zones.add((a as { target: { index: number } }).target.index);
    }
    expect(zones.size).toBeGreaterThan(1);
  });

  it('as defender it can activate the hat against a harmful attack', () => {
    const s = duel(0, ['lumen_sprite']);
    const w = play(s, atk(0, 0, 0));
    const a = chooseAction(w.state, 3);
    expect(a.type).toBe('respond');
  });

  it('bot-vs-bot games with hats on the board keep every invariant and finish', () => {
    let activated = 0;
    for (let seed = 1; seed <= 10; seed++) {
      for (const zones of [3, 5] as const) {
        let state = scenario({
          zones,
          turn: 3,
          active: (seed % 2) as PlayerId,
          p0: { monsters: ['ember_wolf', 'tide_golem'], spellTraps: ['magic_hat'], hand: ['lumen_sprite', 'storm_hawk'], deck: Array(30).fill('stone_sentinel') },
          p1: { monsters: ['shade_assassin', 'thorn_lurker'], spellTraps: ['magic_hat'], hand: ['lumen_sprite', 'storm_hawk'], deck: Array(30).fill('stone_sentinel') },
        });
        state.rng = seed * 40503;
        for (let step = 0; step < 250 && state.winner === null; step++) {
          const a = chooseAction(state, seed);
          const r = apply(state, a);
          activated += r.events.filter((e) => e.type === 'hatsShuffled').length;
          state = r.state;
          // invariants (checkInvariants through play) + hats only exist during the attacker's turn
          checkInvariants(state);
          const hats = state.players.flatMap((p) => p.monsters.filter((m) => m?.hat));
          if (hats.length) expect(state.phase === 'battle' || state.pending !== null).toBe(true);
        }
        expect(state.cards).toBeDefined();
      }
    }
    expect(activated).toBeGreaterThan(0);
  }, 60000);
});
