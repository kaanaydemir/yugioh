// Legal action enumeration. This list drives both the UI menus and the bot, and `apply`
// accepts exactly the actions listed here (after normalisation), so it must be complete.

import { MAGNET_PIECE_IDS, isMonster, isSpell, isTrap, type SpellCardDef } from '../data/cards';
import { other, type Action, type GameState, type PlayerId, type SpellTrapSlot, type Uid } from './types';
import {
  allSpellTrapRefs,
  combinations,
  controlTargetable,
  effectUsedThisTurn,
  shrouded,
  summonAllowed,
  defOf,
  extraSummonAvailable,
  freeMonsterZones,
  freeSpellTrapZones,
  attackLocked,
  monsterDefOf,
  spellTrapRefs,
  tributeNeed,
} from './query';

const asc = (a: number, b: number) => a - b;

export function legalActions(s: GameState): Action[] {
  if (s.winner !== null) return [];
  const out: Action[] = [];

  // --- Pending decision: only answers for pending.player -------------------------------
  const pd = s.pending;
  if (pd) {
    switch (pd.kind) {
      case 'trapResponse':
        for (const uid of pd.options) out.push({ type: 'respond', player: pd.player, uid });
        out.push({ type: 'respond', player: pd.player, uid: null });
        break;
      case 'chooseTarget':
        for (const c of pd.candidates)
          out.push({ type: 'chooseTarget', player: pd.player, target: { player: c.player, zone: c.zone, index: c.index } });
        break;
      case 'discard':
        for (const combo of combinations(s.players[pd.player].hand, pd.count))
          out.push({ type: 'discard', player: pd.player, uids: [...combo].sort(asc) });
        break;
      case 'coinCall':
        out.push({ type: 'callCoin', player: pd.player, call: 'heads' }, { type: 'callCoin', player: pd.player, call: 'tails' });
        break;
      case 'chooseCount':
        for (let n = pd.min; n <= pd.max; n++) out.push({ type: 'chooseCount', player: pd.player, n });
        break;
    }
    return out;
  }

  const p = s.activePlayer;
  const me = s.players[p];
  const opp = s.players[other(p)];

  if (s.phase === 'main') {
    // Normal / Tribute Summon and Set (shared once-per-turn right). festival_square: once the right is
    // spent, one more Level <= 4 monster may be summoned / set without tributes.
    const extraOnly = me.normalSummonUsed && extraSummonAvailable(s, p);
    const canSummon = summonAllowed(s, p); // straw_decoys on its own turn: no other summon
    if ((!me.normalSummonUsed || extraOnly) && canSummon) {
      // tokens can never be tributed
      const fieldUids: Uid[] = me.monsters.flatMap((m) => (m && !m.token ? [m.uid] : []));
      const summons: Action[] = [];
      const sets: Action[] = [];
      for (const uid of me.hand) {
        const d = defOf(s, uid);
        if (!isMonster(d)) continue;
        if (d.effect === 'magnetFusion') continue; // polar_sovereign: Special Summon only (double_offering does not open it)
        if (extraOnly && d.level > 4) continue;
        const n = tributeNeed(s, p, d.level);
        for (const combo of combinations(fieldUids, n)) {
          const tributes = [...combo].sort(asc);
          me.monsters.forEach((m, zone) => {
            if (m && !combo.includes(m.uid)) return;
            summons.push({ type: 'normalSummon', player: p, uid, zone, tributes });
            sets.push({ type: 'setMonster', player: p, uid, zone, tributes: [...tributes] });
          });
        }
      }
      out.push(...summons, ...sets);
    }

    // Flip Summon: face-down, set on an earlier turn, not already flipped/changed this turn.
    me.monsters.forEach((m, zone) => {
      if (m && !m.faceUp && m.enteredTurn < s.turn && m.positionChangedTurn !== s.turn && canSummon)
        out.push({ type: 'flipSummon', player: p, zone });
    });

    // Manual position change: face-up, not arrived this turn, hasn't attacked, once per turn.
    me.monsters.forEach((m, zone) => {
      if (m && m.faceUp && m.enteredTurn !== s.turn && m.attacksThisTurn === 0 && m.positionChangedTurn !== s.turn && m.lockPositionTurn !== s.turn)
        out.push({ type: 'changePosition', player: p, zone });
    });

    // Set spells (except field spells) and traps.
    const freeST = freeSpellTrapZones(s, p);
    for (const uid of me.hand) {
      const d = defOf(s, uid);
      if (isTrap(d) || (isSpell(d) && d.spellType !== 'field'))
        for (const zone of freeST) out.push({ type: 'setSpellTrap', player: p, uid, zone });
    }

    // Activate spells: from hand, then set spells on the field (even the turn they were set).
    for (const uid of me.hand) {
      const d = defOf(s, uid);
      if (isSpell(d)) pushSpellActivations(s, p, uid, d, true, out);
    }
    for (const st of me.spellTraps) {
      if (!st || st.faceUp) continue;
      const d = defOf(s, st.uid);
      // a set quick spell waits one turn (it cannot be activated on the turn it was set)
      if (isSpell(d) && (d.spellType !== 'quick' || setReady(s, st))) pushSpellActivations(s, p, st.uid, d, false, out);
    }

    // Batch 2: monster ignition effects (dial_jester, hollow_ogre) and the magnet fusion Special Summon.
    me.monsters.forEach((m, zone) => {
      if (!m || !m.faceUp || effectUsedThisTurn(s, m.uid)) return;
      const d = monsterDefOf(s, m.uid);
      if (d?.effect === 'coinWipe' && opp.monsters.some(Boolean)) out.push({ type: 'activateMonster', player: p, zone });
      if (d?.effect === 'banishGraveBoost400' && me.graveyard.some((u) => isMonster(defOf(s, u)))) out.push({ type: 'activateMonster', player: p, zone });
    });
    if (canSummon) pushFusions(s, p, out);

    // The first turn of the duel has no battle.
    if (s.turn > 1) out.push({ type: 'enterBattle', player: p });
    out.push({ type: 'endTurn', player: p });
  } else if (s.phase === 'battle') {
    if (s.turn > 1 && !attackLocked(s, p)) {
      // Kabuk Zıpkıncı under Gelgit Körfezi cannot be attacked; with nothing else to attack, a direct attack is legal
      const attackable = (t: (typeof opp.monsters)[number]) => !!t && !shrouded(s, t.uid);
      const oppHasAttackable = opp.monsters.some(attackable);
      me.monsters.forEach((m, attackerZone) => {
        if (!m || !m.faceUp || m.position !== 'attack') return;
        const d = monsterDefOf(s, m.uid);
        // Uçurtma Eskrimci attacks twice; its second attack only at a monster
        const double = d?.effect === 'doubleAttackMonster';
        if (m.attacksThisTurn > (double ? 1 : 0)) return;
        if (m.noAttackTurn === s.turn) return; // frozen by Kum Saati Cücesi
        const second = m.attacksThisTurn > 0;
        if (oppHasAttackable)
          opp.monsters.forEach((t, targetZone) => {
            if (attackable(t)) out.push({ type: 'attack', player: p, attackerZone, targetZone });
          });
        if (!second && (!oppHasAttackable || d?.effect === 'directAttack'))
          out.push({ type: 'attack', player: p, attackerZone, targetZone: null });
      });
    }
    out.push({ type: 'endTurn', player: p });
  }

  out.push({ type: 'surrender', player: p });
  return out;
}

function pushSpellActivations(
  s: GameState,
  p: PlayerId,
  uid: Uid,
  d: SpellCardDef,
  fromHand: boolean,
  out: Action[],
): void {
  const me = s.players[p];
  const o = other(p);
  switch (d.effect) {
    case 'destroyOpponentMonster':
      s.players[o].monsters.forEach((m, index) => {
        if (m && !shrouded(s, m.uid))
          out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'monster', ref: { player: o, zone: 'monster', index } } });
      });
      break;
    case 'gain1000':
      out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'reviveFromGraveyard': {
      const free = freeMonsterZones(s, p);
      if (!free.length || !summonAllowed(s, p)) break;
      for (const gp of [p, o] as PlayerId[]) {
        for (const g of s.players[gp].graveyard) {
          if (!isMonster(defOf(s, g))) continue;
          for (const toZone of free)
            out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'graveyard', uid: g, toZone } });
        }
      }
      break;
    }
    case 'equipAtk700':
    case 'equipPiercing':
    case 'equipDestroyShield':
    case 'equipAtk800Return': {
      const targets: number[] = [];
      me.monsters.forEach((m, i) => {
        if (m && m.faceUp) targets.push(i);
      });
      if (!targets.length) break;
      if (fromHand) {
        for (const zone of freeSpellTrapZones(s, p))
          for (const index of targets)
            out.push({ type: 'activateSpell', player: p, uid, zone, target: { kind: 'monster', ref: { player: p, zone: 'monster', index } } });
      } else {
        for (const index of targets)
          out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'monster', ref: { player: p, zone: 'monster', index } } });
      }
      break;
    }
    case 'attackLock3':
      // continuous: from hand it needs a free spell/trap zone; a set card is already in its zone
      if (fromHand) for (const zone of freeSpellTrapZones(s, p)) out.push({ type: 'activateSpell', player: p, uid, zone });
      else out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'fieldVolcano':
    case 'fieldTidalBay':
    case 'fieldShadowCavern':
    case 'fieldExtraSummon':
      if (fromHand) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'draw2Discard1':
      // the activation draws 2 and discards 1: keep one card in the deck afterwards
      if (me.deck.length >= 3) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'doubleTribute': {
      // only useful with a Level 7+ monster in hand, one tribute on the field and the summon right unspent
      if (me.normalSummonUsed || me.tributeHelperTurn === s.turn) break;
      if (!me.monsters.some(Boolean)) break;
      if (!me.hand.some((u) => u !== uid && isMonster(defOf(s, u)) && (defOf(s, u) as { level: number }).level >= 7)) break;
      out.push({ type: 'activateSpell', player: p, uid });
      break;
    }
    case 'forceDefense':
      s.players[o].monsters.forEach((m, index) => {
        if (m && m.faceUp && m.position === 'attack' && !shrouded(s, m.uid))
          out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'monster', ref: { player: o, zone: 'monster', index } } });
      });
      break;
    case 'recycleGraveyard':
      if (me.graveyard.length >= 3) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'atkBoostTurn':
      me.monsters.forEach((m, index) => {
        if (m && m.faceUp)
          out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'monster', ref: { player: p, zone: 'monster', index } } });
      });
      break;
    case 'destroyOpponentSpellTrap':
      for (const ref of spellTrapRefs(s, o)) out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'card', ref } });
      break;
    // ---- batch 2 ----
    case 'draw2':
      if (me.deck.length >= 2) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'draw3Discard2':
      if (me.deck.length >= 3) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'controlUntilEnd':
      if (!freeMonsterZones(s, p).length) break;
      s.players[o].monsters.forEach((m, index) => {
        if (m && controlTargetable(s, m))
          out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'monster', ref: { player: o, zone: 'monster', index } } });
      });
      break;
    case 'equipControl': {
      if (!freeMonsterZones(s, p).length) break;
      const targets: number[] = [];
      s.players[o].monsters.forEach((m, i) => {
        if (m && m.faceUp && controlTargetable(s, m)) targets.push(i);
      });
      if (!targets.length) break;
      const tgt = (index: number) => ({ kind: 'monster' as const, ref: { player: o, zone: 'monster' as const, index } });
      if (fromHand) {
        for (const zone of freeSpellTrapZones(s, p)) for (const index of targets) out.push({ type: 'activateSpell', player: p, uid, zone, target: tgt(index) });
      } else for (const index of targets) out.push({ type: 'activateSpell', player: p, uid, target: tgt(index) });
      break;
    }
    case 'destroyAllMonsters':
      if (s.players[p].monsters.some(Boolean) || s.players[o].monsters.some(Boolean)) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'destroyAllOppSpellTrap':
      if (spellTrapRefs(s, o).length) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'destroySpellTrapQuick':
      for (const ref of allSpellTrapRefs(s, uid)) out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'card', ref } });
      break;
    case 'strawTokens':
      if (freeMonsterZones(s, p).length) out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'handRefreshBoth':
      out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'diceBoost100':
      if (me.monsters.some((m) => m && m.faceUp)) out.push({ type: 'activateSpell', player: p, uid });
      break;
  }
}

/** A set quick spell may be activated only after the turn it was set. */
function setReady(s: GameState, st: SpellTrapSlot): boolean {
  return st.setTurn >= 0 && st.setTurn < s.turn;
}

/**
 * polar_sovereign (magnetFusion): tribute one Kutup İğnesi, one Kutup Örsü and one Kutup Bobini controlled by `p`
 * (face-up or face-down; borrowed ones too) to Special Summon it from hand into the middle tribute's zone.
 */
function pushFusions(s: GameState, p: PlayerId, out: Action[]): void {
  const me = s.players[p];
  const fusions = me.hand.filter((u) => monsterDefOf(s, u)?.effect === 'magnetFusion');
  if (!fusions.length) return;
  const pieces = MAGNET_PIECE_IDS.map((id) =>
    me.monsters.flatMap((m, zone) => (m && !m.token && !m.hat && s.cards[m.uid].cardId === id ? [{ uid: m.uid, zone }] : [])),
  );
  if (pieces.some((l) => !l.length)) return;
  for (const uid of fusions)
    for (const a of pieces[0])
      for (const b of pieces[1])
        for (const c of pieces[2]) {
          const zones = [a.zone, b.zone, c.zone].sort(asc);
          out.push({ type: 'specialSummon', player: p, uid, zone: zones[1], tributes: [a.uid, b.uid, c.uid].sort(asc) });
        }
}
