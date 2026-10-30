// A sensible greedy CPU player. It only ever picks from legalActions(), so its choice is
// always legal for actingPlayer(state). It uses public information for the opponent's
// face-down cards (it does not peek at hidden monsters or set cards).

import { isMonster, isSpell, isTrap, type Attribute, type MonsterCardDef } from '../data/cards';
import { EngineError, HAND_LIMIT, other, type Action, type GameState, type PlayerId, type Uid, type ZoneRef } from './types';
import { actingPlayer, legalActions } from './rules';
import { battleNumbers, currentAtk, currentDef, defOf, equipOfEffect, fieldAtkModifier, findMonster, hasAllSeals, hasPiercing, monsterDefOf, uidAt, volcanoActive } from './query';
import { SEAL_IDS } from '../data/cards';
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
    if (pd.kind === 'chooseTarget') {
      // decoy_target: the candidates are my own monsters; pick the one that fights the attack best
      if (isTrap(defOf(s, pd.sourceUid))) return best(legal, rng, (a) => (a.type === 'chooseTarget' ? redirectValue(s, me, a.target) : -Infinity));
      return best(legal, rng, (a) => (a.type === 'chooseTarget' ? targetValue(s, me, a.target) : -Infinity));
    }
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

/** How many distinct seal pieces `me` holds (sealSet: five win the duel). */
function sealsHeld(s: GameState, me: PlayerId): number {
  const have = new Set(s.players[me].hand.map((u) => s.cards[u].cardId));
  return SEAL_IDS.filter((id) => have.has(id)).length;
}

function isSeal(s: GameState, uid: Uid): boolean {
  return monsterDefOf(s, uid)?.effect === 'sealSet';
}

function keepValue(s: GameState, me: PlayerId, uid: Uid): number {
  const d = defOf(s, uid);
  if (isMonster(d) && d.effect === 'sealSet') return sealsHeld(s, me) >= 2 ? 5000 : d.atk * 0.5;
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
      case 'fieldTidalBay':
      case 'fieldShadowCavern':
        return 600;
      case 'fieldExtraSummon':
        return 500;
      case 'draw2Discard1':
        return 900;
      case 'doubleTribute':
        return 700;
      case 'forceDefense':
        return 1300;
      case 'recycleGraveyard':
        return 500;
      case 'atkBoostTurn':
        return 1100;
      case 'destroyOpponentSpellTrap':
        return 1200;
      case 'equipPiercing':
        return 1000;
      case 'equipDestroyShield':
        return 900;
    }
  }
  if (isTrap(d)) {
    switch (d.effect) {
      case 'attackDestroyAllAttackPosition':
        return 1900;
      case 'lpBelow1500Gain1500':
        return 1100;
      case 'attackedBoost1000':
      case 'attackRedirect':
        return 1300;
      default:
        return 1400;
    }
  }
  return 0;
}

/** ATK change per attribute of each field spell (mirrors fieldAtkModifier in query.ts). */
const FIELD_MODS: Record<string, Partial<Record<Attribute, number>>> = {
  fieldVolcano: { FIRE: 500, WATER: -300 },
  fieldTidalBay: { WATER: 400, WIND: 400, FIRE: -400 },
  fieldShadowCavern: { DARK: 300, EARTH: 300, LIGHT: -300 },
};

/** Modifier sum of a field spell `effect` over the face-up monsters of player p (what it would change). */
function fieldNet(s: GameState, p: PlayerId, effect: string): number {
  const mods = FIELD_MODS[effect] ?? {};
  let net = 0;
  for (const m of s.players[p].monsters) {
    if (!m || !m.faceUp) continue;
    const d = monsterDefOf(s, m.uid);
    if (!d) continue;
    const v = mods[d.attribute] ?? 0;
    net += v < 0 ? -Math.min(-v, d.atk) : v;
  }
  return net;
}

/** Volcano modifier sum of face-up monsters of player p. */
function volcanoNet(s: GameState, p: PlayerId): number {
  return fieldNet(s, p, 'fieldVolcano');
}

/** The effect name of the field spell at `p`'s field zone (or ''). */
function fieldEffectOf(s: GameState, p: PlayerId): string {
  const fs = s.players[p].fieldSpell;
  if (!fs) return '';
  const d = defOf(s, fs.uid);
  return isSpell(d) ? d.effect : '';
}

/** Value of destroying the card at `ref` (chooseTarget for abyss_magus / thorn_lurker). */
function targetValue(s: GameState, me: PlayerId, ref: ZoneRef): number {
  const uid = uidAt(s, ref);
  if (uid === null) return -Infinity;
  if (ref.zone === 'monster') return publicValue(s, uid);
  if (ref.zone === 'field') {
    const eff = fieldEffectOf(s, ref.player) || 'fieldVolcano';
    return 600 + fieldNet(s, ref.player, eff) - fieldNet(s, other(ref.player), eff);
  }
  const loc = s.players[ref.player].spellTraps[ref.index];
  if (!loc) return -Infinity;
  if (!loc.faceUp) return 1000; // could be a trap
  return loc.equippedTo !== null ? 1100 : 300;
}

/** decoy_target: how good is it to let my monster at `ref` take the pending attack? */
function redirectValue(s: GameState, me: PlayerId, ref: ZoneRef): number {
  const pd = s.pending;
  const uid = uidAt(s, ref);
  if (uid === null || !pd || pd.kind !== 'chooseTarget') return -Infinity;
  const q = (s.internal.queue ?? []) as { k: string; attackerUid?: number }[];
  const battle = q.find((t) => t.k === 'battle');
  const attackerUid = battle?.attackerUid;
  if (attackerUid === undefined || findMonster(s, attackerUid) === null) return ownValue(s, uid);
  return redirectOutcome(s, attackerUid, uid);
}

/** Positive when my monster `uid` comes out ahead if `attackerUid` attacks it (battle numbers included). */
function redirectOutcome(s: GameState, attackerUid: Uid, uid: Uid): number {
  const nums = battleNumbers(s, attackerUid, uid);
  const val = ownValueAny(s, uid);
  const aVal = ownValueAny(s, attackerUid);
  if (nums.targetValue === null) return 0;
  if (nums.targetPosition === 'attack') {
    if (nums.atk > nums.targetValue) return -(val + (nums.atk - nums.targetValue));
    if (nums.atk === nums.targetValue) return aVal - val;
    return aVal + (nums.targetValue - nums.atk);
  }
  return nums.atk > nums.targetValue ? -val : nums.atk === nums.targetValue ? 0 : 50 + (nums.targetValue - nums.atk);
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
    const tower = options.find((o) => effectOf(o) === 'summonDestroy1800Plus');
    if (tower) return tower;
    const chasm = options.find((o) => effectOf(o) === 'summonDestroy1000Plus');
    if (chasm && (currentAtk(s, uid) >= 1500 || d?.ace)) return chasm;
    return decline;
  }
  if (pd.trigger.kind === 'spellActivated') {
    // spell_seal: stop anything that matters (everything but a tiny heal when I am healthy)
    const sd = defOf(s, pd.trigger.spellUid);
    const seal = options.find((o) => effectOf(o) === 'spellActivateNegate');
    if (!seal) return decline;
    if (isSpell(sd) && sd.effect === 'gain1000' && s.players[other(me)].lp > 3000) return decline;
    return seal;
  }
  if (pd.trigger.kind === 'lpLow') return options.find((o) => effectOf(o) === 'lpBelow1500Gain1500') ?? decline;

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
          if (hasPiercing(s, attackerUid)) damage = atk - tdv;
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

  // spell/trap batch 1: battle tricks, scored against what the attack would cost me
  type Opt = Extract<Action, { type: 'respond' }>;
  const attackerVal = ownValueAny(s, attackerUid);
  const tries: [Opt | undefined, number][] = [];
  const bounce = options.find((o) => effectOf(o) === 'attackBounceAttacker');
  if (bounce && (lethal || harm >= 500)) tries.push([bounce, harm + attackerVal * 0.6 + (monsterDefOf(s, attackerUid)!.level >= 5 ? 500 : 0)]);
  const sand = options.find((o) => effectOf(o) === 'attackNegateAllDefense');
  if (sand && (lethal || harm >= 700 || victims.length >= 2)) tries.push([sand, harm + 300 * victims.length]);
  const boost = options.find((o) => effectOf(o) === 'attackedBoost1000');
  if (boost && targetUid !== null) {
    const t = findMonster(s, targetUid);
    if (t && harm > 0) {
      const tVal = ownValueAny(s, targetUid);
      const pos = t.slot.faceUp ? t.slot.position : 'defense';
      const have = pos === 'attack' ? currentAtk(s, targetUid) : currentDef(s, targetUid);
      const wins = atk < have + 1000 ? 1 : 0;
      if (wins) tries.push([boost, harm + tVal * 0.5 + attackerVal * (pos === 'attack' && atk < have + 1000 ? 0.8 : 0)]);
    }
  }
  const decoy = options.find((o) => effectOf(o) === 'attackRedirect');
  if (decoy && harm > 0) {
    let bestGain = 0;
    for (const m of s.players[me].monsters) {
      if (!m || m.uid === targetUid) continue;
      bestGain = Math.max(bestGain, redirectOutcome(s, attackerUid, m.uid) + harm);
    }
    if (bestGain > harm) tries.push([decoy, bestGain]);
  }
  let top: Opt | null = null;
  let topScore = 0;
  for (const [o, sc] of tries) if (o && sc > topScore) (top = o), (topScore = sc);
  return top ?? decline;
}

function ownValueAny(s: GameState, uid: Uid): number {
  return Math.max(currentAtk(s, uid), currentDef(s, uid) * 0.75);
}

// ---- main phase -------------------------------------------------------------------------

function decideMain(s: GameState, legal: Action[], me: PlayerId, rng: Rng): Action | null {
  // Removal and flip effects first (a face-down thorn_lurker is worth more flipped than tributed),
  // then develop the board, then buffs, then defensive setup.
  const steps = [
    trySpellRemoval,
    tryPurge,
    tryKneel,
    tryFlip,
    trySoulRecall,
    tryFateTrade,
    tryCycle,
    tryDoubleOffering,
    trySummon,
    tryEquip,
    tryField,
    tryBattleCry,
    tryHeal,
    trySetTrap,
    tryPosition,
    trySetForHandLimit,
  ];
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
  const hoard = sealsHeld(s, me) >= 3;
  const oppHasSetTrap = s.players[other(me)].spellTraps.some((st) => st && !st.faceUp);
  const myMons = s.players[me].monsters;
  const spellsInHand = s.players[me].hand.filter((u) => defOf(s, u).kind === 'spell').length;
  const pick = bestWithScore(opts, rng, (a) => {
    const d = monsterDefOf(s, a.uid) as MonsterCardDef;
    if (hoard && d.effect === 'sealSet') return -Infinity; // keep the pieces in hand: the set wins on the spot
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
      if (d.effect === 'summonFreezeAttack' && oppHasMonsters) v += 350;
      if (d.effect === 'trapLock' && oppHasSetTrap) v += 500;
      if (d.effect === 'ownSpellBurn300') v += 250 * Math.min(2, spellsInHand);
      if (d.effect === 'summonTurnAtk500' && s.turn > 1) v += 500;
      if (d.effect === 'windAura300') v += 250 * myMons.filter((m) => m && m.faceUp && monsterDefOf(s, m.uid)?.attribute === 'WIND').length;
      if (d.effect === 'declareAtkDebuff400') v += 250;
      if (d.effect === 'defenseAtkDebuff500') v += 300;
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
  const acts = [...spellActs(s, legal, 'equipAtk700'), ...spellActs(s, legal, 'equipPiercing'), ...spellActs(s, legal, 'equipDestroyShield')];
  const oppSets = s.players[other(me)].monsters.some((m) => m && (!m.faceUp || m.position === 'defense'));
  const pick = best(acts, rng, (a) => {
    if (a.target?.kind !== 'monster') return -Infinity;
    const slot = s.players[me].monsters[a.target.ref.index];
    if (!slot) return -Infinity;
    const eff = (defOf(s, a.uid) as { effect: string }).effect;
    const fromSet = !s.players[me].hand.includes(a.uid);
    const tail = (fromSet ? 1 : 0) - (a.zone ?? 0) * 0.01;
    if (eff === 'equipDestroyShield') {
      // guard what is worth guarding
      const v = ownValue(s, slot.uid);
      return v >= 1500 ? v + tail : -Infinity;
    }
    // Only arm attackers: +700 / +300 ATK on a defender is wasted.
    if (slot.position !== 'attack') return -Infinity;
    if (eff === 'equipPiercing') return currentAtk(s, slot.uid) + (oppSets ? 900 : 0) + tail - 200;
    return currentAtk(s, slot.uid) + tail;
  });
  return pick;
};

const FIELD_EFFECTS = ['fieldVolcano', 'fieldTidalBay', 'fieldShadowCavern'] as const;

const tryField: Step = (s, legal, me) => {
  if (s.players[0].fieldSpell || s.players[1].fieldSpell) return null;
  let top: Action | null = null;
  let topNet = 0;
  for (const eff of FIELD_EFFECTS) {
    const act = spellActs(s, legal, eff)[0];
    if (!act) continue;
    const mods = FIELD_MODS[eff];
    let net = fieldNet(s, me, eff) - fieldNet(s, other(me), eff);
    for (const u of s.players[me].hand) {
      const d = defOf(s, u);
      if (isMonster(d) && (mods[d.attribute] ?? 0) > 0) net += 150;
    }
    if (net > topNet) (top = act), (topNet = net);
  }
  if (top) return top;
  // festival_square: worth it with two small monsters in hand (one extra summon this turn)
  const fest = spellActs(s, legal, 'fieldExtraSummon')[0];
  if (fest) {
    const small = s.players[me].hand.filter((u) => {
      const d = defOf(s, u);
      return isMonster(d) && d.level <= 4;
    }).length;
    if (small >= 2 && s.players[me].monsters.filter((m) => !m).length >= 2) return fest;
  }
  return null;
};

const tryHeal: Step = (s, legal, me) => {
  const act = spellActs(s, legal, 'gain1000')[0];
  if (!act) return null;
  return s.players[me].lp <= 3000 || s.players[me].hand.length > HAND_LIMIT - 1 ? act : null;
};

/** purging_wave: take out a set card (could be a trap), an equip on a strong monster or a harmful field spell. */
const tryPurge: Step = (s, legal, me, rng) => {
  const acts = spellActs(s, legal, 'destroyOpponentSpellTrap');
  const pick = bestWithScore(acts, rng, (a) => (a.target?.kind === 'card' ? targetValue(s, me, a.target.ref) : -Infinity));
  return pick && pick.score >= 1000 ? pick.item : null;
};

/** kneel_down: put the strongest enemy attacker on its knees when that unlocks my attack or blunts its threat. */
const tryKneel: Step = (s, legal, me, rng) => {
  const acts = spellActs(s, legal, 'forceDefense');
  const myTop = s.players[me].monsters.reduce((t, m) => (m && m.faceUp && m.position === 'attack' ? Math.max(t, currentAtk(s, m.uid)) : t), 0);
  const pick = bestWithScore(acts, rng, (a) => {
    if (a.target?.kind !== 'monster') return -Infinity;
    const uid = uidAt(s, a.target.ref);
    return uid === null ? -Infinity : currentAtk(s, uid);
  });
  if (!pick) return null;
  const oppAtks = s.players[other(me)].monsters.filter((m) => m && m.faceUp && m.position === 'attack').length;
  // worth a card when it is their best monster (>= 1800 ATK) or it clears a wall my attackers cannot beat
  return pick.score >= 1800 || (pick.score > myTop && oppAtks === 1 && myTop > 0) ? pick.item : null;
};

/** fate_trade: filter the hand when it holds junk or is small. */
const tryFateTrade: Step = (s, legal, me) => {
  const act = spellActs(s, legal, 'draw2Discard1')[0];
  if (!act) return null;
  const hand = s.players[me].hand;
  const junk = hand.filter((u) => u !== act.uid && keepValue(s, me, u) < 700).length;
  return s.players[me].deck.length >= 6 && (junk > 0 || hand.length <= 3) ? act : null;
};

/** cycle_of_graves: refill a thin deck / bring spells back when the hand is small. */
const tryCycle: Step = (s, legal, me) => {
  const act = spellActs(s, legal, 'recycleGraveyard')[0];
  if (!act) return null;
  const ps = s.players[me];
  return ps.deck.length <= 8 || (ps.hand.length <= 2 && ps.graveyard.length >= 4) ? act : null;
};

/** double_offering: only with a strong Level 7+ monster in hand and a cheap tribute on the field. */
const tryDoubleOffering: Step = (s, legal, me) => {
  const act = spellActs(s, legal, 'doubleTribute')[0];
  if (!act) return null;
  const strong = s.players[me].hand.some((u) => {
    const d = defOf(s, u);
    return isMonster(d) && d.level >= 7 && d.atk >= 2300;
  });
  const cheap = s.players[me].monsters.some((m) => m && ownValue(s, m.uid) <= 1800);
  return strong && cheap ? act : null;
};

/** battle_cry: use it when +1000 ATK turns an attack from bad/neutral into a win, or makes damage lethal. */
const tryBattleCry: Step = (s, legal, me, rng) => {
  const acts = spellActs(s, legal, 'atkBoostTurn');
  if (!acts.length || s.turn <= 1) return null;
  const pick = bestWithScore(acts, rng, (a) => {
    if (a.target?.kind !== 'monster') return -Infinity;
    const slot = s.players[me].monsters[a.target.ref.index];
    if (!slot || !slot.faceUp || slot.position !== 'attack' || slot.attacksThisTurn > 0) return -Infinity;
    const hyp = structuredClone(s);
    const hs = hyp.players[me].monsters[a.target.ref.index]!;
    hs.boostAtk = 1000;
    hs.boostDef = 0;
    hs.boostTurn = hyp.turn;
    const gain = bestAttackScoreFor(hyp, me, a.target.ref.index) - bestAttackScoreFor(s, me, a.target.ref.index);
    return Number.isNaN(gain) ? -Infinity : gain;
  });
  return pick && pick.score >= 900 ? pick.item : null;
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
  const nums = battleNumbers(s, aUid, t.uid); // contextual debuffs (grim_warden, shield_titan) included
  const batk = nums.atk;
  if (t.position === 'attack') {
    const ta = nums.targetValue ?? currentAtk(s, t.uid);
    if (batk > ta) {
      const dmg = batk - ta;
      if (dmg >= oppLp) return 100000;
      let v = tVal + dmg;
      if (td.effect === 'destroyedByBattleBurn500') v -= 500;
      if (aDef.effect === 'battleDestroyBurn300') v += 300;
      return v;
    }
    if (batk === ta) return tVal - aVal - 1;
    return -(aVal + (ta - batk));
  }
  const tdv = nums.targetValue ?? currentDef(s, t.uid);
  const tide = td.effect === 'defenseAttackedBurn300' ? 300 : 0;
  if (batk > tdv) {
    const pierce = hasPiercing(s, aUid) ? batk - tdv : 0;
    if (pierce >= oppLp) return 100000;
    let v = tVal + pierce - tide;
    if (td.effect === 'destroyedByBattleBurn500') v -= 500;
    if (aDef.effect === 'battleDestroyBurn300') v += 300;
    return v;
  }
  return -(tdv - batk) - tide - 1;
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
