// A sensible greedy CPU player. It only ever picks from legalActions(), so its choice is
// always legal for actingPlayer(state). It uses public information for the opponent's
// face-down cards (it does not peek at hidden monsters or set cards).

import { isMonster, isSpell, isTrap, type MonsterCardDef } from '../data/cards';
import { EngineError, HAND_LIMIT, other, type Action, type GameState, type PlayerId, type Uid, type ZoneRef } from './types';
import { actingPlayer, legalActions } from './rules';
import { currentAtk, currentDef, defOf, fieldAtkModifier, findMonster, monsterDefOf, uidAt, volcanoActive } from './query';
import { makeRng } from './rng';

type Rng = () => number;

/** Pick an action for actingPlayer(state). `seed` only varies tie-breaking. */
export function chooseAction(state: GameState, seed = 0): Action {
  const legal = legalActions(state);
  if (!legal.length) throw new EngineError('no legal actions (the game is over)');
  const rng = makeRng((seed ^ state.rng ^ Math.imul(state.turn + 1, 0x9e3779b1)) >>> 0);
  const me = actingPlayer(state);
  let choice: Action | null = null;
  try {
    choice = decide(state, legal, me, rng);
  } catch {
    choice = null;
  }
  if (choice && legal.includes(choice)) return choice;
  return legal.find((a) => a.type === 'endTurn') ?? legal.find((a) => a.type !== 'surrender') ?? legal[0];
}

// ---------------------------------------------------------------------------

function decide(s: GameState, legal: Action[], me: PlayerId, rng: Rng): Action | null {
  const pd = s.pending;
  if (pd) {
    if (pd.kind === 'trapResponse') return decideTrap(s, legal, me);
    if (pd.kind === 'chooseTarget') return best(legal, rng, (a) => (a.type === 'chooseTarget' ? targetValue(s, me, a.target) : -Infinity));
    if (pd.kind === 'discard')
      return best(legal, rng, (a) => (a.type === 'discard' ? -a.uids.reduce((t, u) => t + keepValue(s, me, u), 0) : -Infinity));
    return null;
  }
  if (s.phase === 'main') return decideMain(s, legal, me, rng);
  if (s.phase === 'battle') return decideBattle(s, legal, me, rng);
  return null;
}

/** Highest-scoring item; ties broken randomly. Returns null when every score is -Infinity. */
function best<T>(items: T[], rng: Rng, score: (t: T) => number): T | null {
  let top: T | null = null;
  let topScore = -Infinity;
  let ties = 0;
  for (const it of items) {
    const sc = score(it);
    if (sc === -Infinity) continue;
    if (sc > topScore) {
      top = it;
      topScore = sc;
      ties = 1;
    } else if (sc === topScore) {
      ties++;
      if (rng() * ties < 1) top = it;
    }
  }
  return top;
}

function bestWithScore<T>(items: T[], rng: Rng, score: (t: T) => number): { item: T; score: number } | null {
  const scores = new Map<T, number>();
  for (const it of items) scores.set(it, score(it));
  const item = best(items, rng, (t) => scores.get(t)!);
  return item === null ? null : { item, score: scores.get(item)! };
}

// ---- valuations -------------------------------------------------------------------------

/** Board value of one of my own monsters (I know my face-down cards). */
function ownValue(s: GameState, uid: Uid): number {
  let v = Math.max(currentAtk(s, uid), currentDef(s, uid) * 0.75);
  const loc = findMonster(s, uid);
  if (loc && !loc.slot.faceUp) {
    const d = monsterDefOf(s, uid);
    // An unflipped FLIP monster still holds its effect.
    if (d?.effect === 'flipDestroyMonster') v += s.players[other(loc.player)].monsters.some(Boolean) ? 1200 : 600;
    if (d?.effect === 'summonBurn500') v += 300;
  }
  return v;
}

/** Value of an opponent monster from public information only. */
function publicValue(s: GameState, uid: Uid): number {
  const loc = findMonster(s, uid);
  if (loc && !loc.slot.faceUp) return 1200;
  const d = monsterDefOf(s, uid);
  return Math.max(currentAtk(s, uid), currentDef(s, uid) * 0.75) + (d?.ace ? 300 : 0);
}

/** Strongest ATK the opponent could swing at me next turn (face-down guessed at 1000). */
function oppThreat(s: GameState, me: PlayerId): number {
  let t = 0;
  for (const m of s.players[other(me)].monsters) {
    if (!m) continue;
    t = Math.max(t, m.faceUp ? currentAtk(s, m.uid) : 1000);
  }
  return t;
}

function keepValue(s: GameState, me: PlayerId, uid: Uid): number {
  const d = defOf(s, uid);
  if (isMonster(d)) return d.atk * (d.level >= 5 ? 0.8 : 1) + (d.effect === 'flipDestroyMonster' ? 900 : 0);
  if (isSpell(d)) {
    switch (d.effect) {
      case 'destroyOpponentMonster':
        return 2200;
      case 'reviveFromGraveyard':
        return 1600;
      case 'equipAtk700':
        return 1200;
      case 'gain1000':
        return s.players[me].lp < 2000 ? 1800 : 700;
      case 'fieldVolcano':
        return 600;
    }
  }
  if (isTrap(d)) return d.effect === 'attackDestroyAllAttackPosition' ? 1900 : 1400;
  return 0;
}

/** Volcano modifier sum of face-up monsters of player p (what a field spell would change). */
function volcanoNet(s: GameState, p: PlayerId): number {
  let net = 0;
  for (const m of s.players[p].monsters) {
    if (!m || !m.faceUp) continue;
    const d = monsterDefOf(s, m.uid);
    if (!d) continue;
    if (d.attribute === 'FIRE') net += 500;
    else if (d.attribute === 'WATER') net -= Math.min(300, d.atk);
  }
  return net;
}

/** Value of destroying the card at `ref` (chooseTarget for abyss_magus / thorn_lurker). */
function targetValue(s: GameState, me: PlayerId, ref: ZoneRef): number {
  const uid = uidAt(s, ref);
  if (uid === null) return -Infinity;
  if (ref.zone === 'monster') return publicValue(s, uid);
  if (ref.zone === 'field') return 600 + volcanoNet(s, ref.player) - volcanoNet(s, other(ref.player));
  const loc = s.players[ref.player].spellTraps[ref.index];
  if (!loc) return -Infinity;
  if (!loc.faceUp) return 1000; // could be a trap
  return loc.equippedTo !== null ? 1100 : 300;
}

// ---- trap responses ---------------------------------------------------------------------

function decideTrap(s: GameState, legal: Action[], me: PlayerId): Action | null {
  const pd = s.pending;
  if (!pd || pd.kind !== 'trapResponse') return null;
  const decline = legal.find((a) => a.type === 'respond' && a.uid === null) ?? null;
  const options = legal.filter((a): a is Extract<Action, { type: 'respond' }> => a.type === 'respond' && a.uid !== null);
  const effectOf = (a: Extract<Action, { type: 'respond' }>) => {
    const d = defOf(s, a.uid!);
    return isTrap(d) ? d.effect : null;
  };

  if (pd.trigger.kind === 'summoned') {
    const uid = pd.trigger.monsterUid;
    const d = monsterDefOf(s, uid);
    const chasm = options.find((o) => effectOf(o) === 'summonDestroy1000Plus');
    if (chasm && (currentAtk(s, uid) >= 1500 || d?.ace)) return chasm;
    return decline;
  }

  const { attackerUid, targetUid } = pd.trigger;
  const atk = currentAtk(s, attackerUid);
  const myLp = s.players[me].lp;
  let damage = 0;
  let lost = 0;
  if (targetUid === null) {
    damage = atk;
  } else {
    const t = findMonster(s, targetUid);
    if (t) {
      const td = monsterDefOf(s, targetUid);
      const val = ownValue(s, targetUid);
      const pos = t.slot.faceUp ? t.slot.position : 'defense';
      if (pos === 'attack') {
        const ta = currentAtk(s, targetUid);
        if (atk > ta) {
          damage = atk - ta;
          lost = val;
        } else if (atk === ta) lost = Math.max(0, val - ownValueAny(s, attackerUid));
      } else {
        const tdv = currentDef(s, targetUid);
        if (atk > tdv) {
          lost = val;
          if (monsterDefOf(s, attackerUid)?.effect === 'piercing') damage = atk - tdv;
        }
      }
      if (!t.slot.faceUp && td?.effect === 'flipDestroyMonster') lost -= 1000; // let the ambush spring
    }
  }
  const harm = damage + lost;
  const lethal = damage >= myLp;
  const victims = s.players[other(me)].monsters.filter((m) => m && m.faceUp && m.position === 'attack');
  const victimValue = victims.reduce((t, m) => t + ownValueAny(s, m!.uid), 0);

  const mirror = options.find((o) => effectOf(o) === 'attackDestroyAllAttackPosition');
  if (mirror && (lethal || victims.length >= 2 || (harm > 0 && (victimValue >= 1500 || harm >= 1000)))) return mirror;
  const chains = options.find((o) => effectOf(o) === 'attackNegateEndBattle');
  if (chains && (lethal || harm >= 900)) return chains;
  return decline;
}

function ownValueAny(s: GameState, uid: Uid): number {
  return Math.max(currentAtk(s, uid), currentDef(s, uid) * 0.75);
}

// ---- main phase -------------------------------------------------------------------------

function decideMain(s: GameState, legal: Action[], me: PlayerId, rng: Rng): Action | null {
  // Removal and flip effects first (a face-down thorn_lurker is worth more flipped than tributed),
  // then develop the board, then buffs, then defensive setup.
  const steps = [trySpellRemoval, tryFlip, trySoulRecall, trySummon, tryEquip, tryField, tryHeal, trySetTrap, tryPosition, trySetForHandLimit];
  for (const step of steps) {
    const a = step(s, legal, me, rng);
    if (a) return a;
  }
  if (legal.some((a) => a.type === 'enterBattle') && bestAttackScore(s, me) > 0)
    return legal.find((a) => a.type === 'enterBattle')!;
  return legal.find((a) => a.type === 'endTurn') ?? null;
}

type Step = (s: GameState, legal: Action[], me: PlayerId, rng: Rng) => Action | null;

function spellActs(s: GameState, legal: Action[], effect: string): Extract<Action, { type: 'activateSpell' }>[] {
  return legal.filter((a): a is Extract<Action, { type: 'activateSpell' }> => {
    if (a.type !== 'activateSpell') return false;
    const d = defOf(s, a.uid);
    return isSpell(d) && d.effect === effect;
  });
}

const trySpellRemoval: Step = (s, legal, me, rng) => {
  const acts = spellActs(s, legal, 'destroyOpponentMonster');
  const pick = bestWithScore(acts, rng, (a) => {
    if (a.target?.kind !== 'monster') return -Infinity;
    const uid = uidAt(s, a.target.ref);
    return uid === null ? -Infinity : publicValue(s, uid) + (a.zone === undefined && !s.players[me].hand.includes(a.uid) ? 1 : 0);
  });
  if (!pick) return null;
  const oppCount = s.players[other(me)].monsters.filter(Boolean).length;
  const canSwing = s.turn > 1 && s.players[me].monsters.some((m) => m && m.faceUp && m.position === 'attack' && currentAtk(s, m.uid) >= 1000);
  if (pick.score >= 1400 || (oppCount === 1 && canSwing)) return pick.item;
  return null;
};

const trySoulRecall: Step = (s, legal, _me, rng) => {
  const acts = spellActs(s, legal, 'reviveFromGraveyard');
  const pick = bestWithScore(acts, rng, (a) => {
    if (a.target?.kind !== 'graveyard') return -Infinity;
    const d = monsterDefOf(s, a.target.uid);
    if (!d) return -Infinity;
    return d.atk + (d.effect === 'summonBurn500' ? 500 : 0) + (a.target.toZone === 1 ? 1 : 0);
  });
  return pick && pick.score >= 1500 ? pick.item : null;
};

const trySummon: Step = (s, legal, me, rng) => {
  const opts = legal.filter(
    (a): a is Extract<Action, { type: 'normalSummon' | 'setMonster' }> => a.type === 'normalSummon' || a.type === 'setMonster',
  );
  if (!opts.length) return null;
  const threat = oppThreat(s, me);
  const oppHasMonsters = s.players[other(me)].monsters.some(Boolean);
  const oppHasST = s.players[other(me)].spellTraps.some(Boolean) || s.players[other(me)].fieldSpell !== null;
  const pick = bestWithScore(opts, rng, (a) => {
    const d = monsterDefOf(s, a.uid) as MonsterCardDef;
    const cost = a.tributes.reduce((t, u) => t + ownValue(s, u) + 300, 0);
    let v: number;
    if (a.type === 'normalSummon') {
      const atk = Math.max(0, d.atk + (volcanoActive(s) ? fieldAtkModifier(s, d) : 0));
      v = atk;
      if (d.effect === 'summonBurn500') v += 500;
      if (d.effect === 'normalSummonGain500' && a.tributes.length === 0) v += 400;
      if (d.effect === 'tributeSummonDestroySpellTrap' && a.tributes.length > 0 && oppHasST) v += 900;
      if (d.effect === 'directAttack') v += 300;
      if (d.effect === 'piercing') v += 200;
      if (d.effect === 'flipDestroyMonster') v -= 600;
      if (d.ace) v += 300;
      if (atk < threat) v -= 0.5 * (threat - atk);
    } else {
      v = d.def * 0.75;
      if (d.effect === 'flipDestroyMonster') v += oppHasMonsters ? 1100 : 400;
      if (d.effect === 'summonBurn500') v += 250;
      if (a.tributes.length > 0) v -= 500;
    }
    const zoneBias = a.zone === 1 ? 2 : a.zone === 0 ? 1 : 0;
    return v - cost + zoneBias;
  });
  return pick && pick.score > 0 ? pick.item : null;
};

const tryEquip: Step = (s, legal, me, rng) => {
  const acts = spellActs(s, legal, 'equipAtk700');
  const pick = best(acts, rng, (a) => {
    if (a.target?.kind !== 'monster') return -Infinity;
    const slot = s.players[me].monsters[a.target.ref.index];
    // Only arm attackers: +700 ATK on a defender is wasted.
    if (!slot || slot.position !== 'attack') return -Infinity;
    const fromSet = !s.players[me].hand.includes(a.uid);
    return currentAtk(s, slot.uid) + (fromSet ? 1 : 0) - (a.zone ?? 0) * 0.01;
  });
  return pick;
};

const tryField: Step = (s, legal, me) => {
  const act = spellActs(s, legal, 'fieldVolcano')[0];
  if (!act) return null;
  if (s.players[0].fieldSpell || s.players[1].fieldSpell) return null;
  let net = volcanoNet(s, me) - volcanoNet(s, other(me));
  for (const u of s.players[me].hand) {
    const d = defOf(s, u);
    if (isMonster(d) && d.attribute === 'FIRE') net += 150;
  }
  return net > 0 ? act : null;
};

const tryHeal: Step = (s, legal, me) => {
  const act = spellActs(s, legal, 'gain1000')[0];
  if (!act) return null;
  return s.players[me].lp <= 3000 || s.players[me].hand.length > HAND_LIMIT - 1 ? act : null;
};

const trySetTrap: Step = (s, legal) => {
  return (
    legal.find((a) => {
      if (a.type !== 'setSpellTrap') return false;
      return isTrap(defOf(s, a.uid));
    }) ?? null
  );
};

const tryFlip: Step = (s, legal, me, rng) => {
  const threat = oppThreat(s, me);
  const oppHasMonsters = s.players[other(me)].monsters.some(Boolean);
  const acts = legal.filter((a): a is Extract<Action, { type: 'flipSummon' }> => a.type === 'flipSummon');
  const pick = bestWithScore(acts, rng, (a) => {
    const slot = s.players[me].monsters[a.zone];
    if (!slot) return -Infinity;
    const d = monsterDefOf(s, slot.uid) as MonsterCardDef;
    if (d.effect === 'flipDestroyMonster') return oppHasMonsters ? 2000 : -Infinity;
    if (d.effect === 'summonBurn500') return 1500;
    const atk = Math.max(0, d.atk + fieldAtkModifier(s, d));
    return atk >= 1000 && atk > threat && atk >= d.def ? atk : -Infinity;
  });
  return pick ? pick.item : null;
};

const tryPosition: Step = (s, legal, me) => {
  const threat = oppThreat(s, me);
  const oppHasMonsters = s.players[other(me)].monsters.some(Boolean);
  for (const a of legal) {
    if (a.type !== 'changePosition') continue;
    const slot = s.players[me].monsters[a.zone];
    if (!slot) continue;
    const atk = currentAtk(s, slot.uid);
    const def = currentDef(s, slot.uid);
    if (slot.position === 'defense') {
      if (atk >= 1000 && (atk > threat || !oppHasMonsters)) return a;
    } else if (atk < threat && def > atk + 200 && bestAttackScoreFor(s, me, a.zone) <= 0) {
      return a;
    }
  }
  return null;
};

const trySetForHandLimit: Step = (s, legal, me) => {
  if (s.players[me].hand.length <= HAND_LIMIT) return null;
  return (
    legal.find((a) => {
      if (a.type !== 'setSpellTrap') return false;
      return isSpell(defOf(s, a.uid));
    }) ?? null
  );
};

// ---- battle -----------------------------------------------------------------------------

function decideBattle(s: GameState, legal: Action[], me: PlayerId, rng: Rng): Action | null {
  const attacks = legal.filter((a): a is Extract<Action, { type: 'attack' }> => a.type === 'attack');
  const pick = bestWithScore(attacks, rng, (a) => attackScore(s, me, a.attackerZone, a.targetZone));
  if (pick && pick.score > 0) return pick.item;
  return legal.find((a) => a.type === 'endTurn') ?? null;
}

/** Estimated value of an attack from public information (positive = favorable). */
function attackScore(s: GameState, me: PlayerId, attackerZone: number, targetZone: number | null): number {
  const slot = s.players[me].monsters[attackerZone];
  if (!slot) return -Infinity;
  const aUid = slot.uid;
  const atk = currentAtk(s, aUid);
  const aDef = monsterDefOf(s, aUid) as MonsterCardDef;
  const oppLp = s.players[other(me)].lp;
  if (targetZone === null) {
    if (atk <= 0) return -Infinity;
    return atk >= oppLp ? 100000 : atk + 1;
  }
  const t = s.players[other(me)].monsters[targetZone];
  if (!t) return -Infinity;
  const aVal = ownValue(s, aUid);
  if (!t.faceUp) {
    if (atk >= 1800) return 900;
    if (atk >= 1400) return 300;
    return -300;
  }
  const td = monsterDefOf(s, t.uid) as MonsterCardDef;
  const tVal = publicValue(s, t.uid);
  if (t.position === 'attack') {
    const ta = currentAtk(s, t.uid);
    if (atk > ta) {
      const dmg = atk - ta;
      if (dmg >= oppLp) return 100000;
      let v = tVal + dmg;
      if (td.effect === 'destroyedByBattleBurn500') v -= 500;
      if (aDef.effect === 'battleDestroyBurn300') v += 300;
      return v;
    }
    if (atk === ta) return tVal - aVal - 1;
    return -(aVal + (ta - atk));
  }
  const tdv = currentDef(s, t.uid);
  const tide = td.effect === 'defenseAttackedBurn300' ? 300 : 0;
  if (atk > tdv) {
    const pierce = aDef.effect === 'piercing' ? atk - tdv : 0;
    if (pierce >= oppLp) return 100000;
    let v = tVal + pierce - tide;
    if (td.effect === 'destroyedByBattleBurn500') v -= 500;
    if (aDef.effect === 'battleDestroyBurn300') v += 300;
    return v;
  }
  return -(tdv - atk) - tide - 1;
}

function bestAttackScoreFor(s: GameState, me: PlayerId, zone: number): number {
  const opp = s.players[other(me)];
  const slot = s.players[me].monsters[zone];
  if (!slot) return -Infinity;
  const hasTargets = opp.monsters.some(Boolean);
  let top = -Infinity;
  if (hasTargets) opp.monsters.forEach((t, j) => t && (top = Math.max(top, attackScore(s, me, zone, j))));
  if (!hasTargets || monsterDefOf(s, slot.uid)?.effect === 'directAttack') top = Math.max(top, attackScore(s, me, zone, null));
  return top;
}

/** Best attack score among monsters that could attack this turn (used before entering battle). */
function bestAttackScore(s: GameState, me: PlayerId): number {
  let top = -Infinity;
  s.players[me].monsters.forEach((m, i) => {
    if (m && m.faceUp && m.position === 'attack' && m.attacksThisTurn === 0) top = Math.max(top, bestAttackScoreFor(s, me, i));
  });
  return top;
}
