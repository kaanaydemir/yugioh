// Legal action enumeration. This list drives both the UI menus and the bot, and `apply`
// accepts exactly the actions listed here (after normalisation), so it must be complete.

import { isMonster, isSpell, isTrap, tributesFor, type SpellCardDef } from '../data/cards';
import { other, type Action, type GameState, type PlayerId, type Uid } from './types';
import {
  combinations,
  defOf,
  freeMonsterZones,
  freeSpellTrapZones,
  monsterDefOf,
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
    }
    return out;
  }

  const p = s.activePlayer;
  const me = s.players[p];
  const opp = s.players[other(p)];

  if (s.phase === 'main') {
    // Normal / Tribute Summon and Set (shared once-per-turn right).
    if (!me.normalSummonUsed) {
      const fieldUids: Uid[] = me.monsters.flatMap((m) => (m ? [m.uid] : []));
      const summons: Action[] = [];
      const sets: Action[] = [];
      for (const uid of me.hand) {
        const d = defOf(s, uid);
        if (!isMonster(d)) continue;
        const n = tributesFor(d.level);
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
      if (m && !m.faceUp && m.enteredTurn < s.turn && m.positionChangedTurn !== s.turn)
        out.push({ type: 'flipSummon', player: p, zone });
    });

    // Manual position change: face-up, not arrived this turn, hasn't attacked, once per turn.
    me.monsters.forEach((m, zone) => {
      if (m && m.faceUp && m.enteredTurn !== s.turn && m.attacksThisTurn === 0 && m.positionChangedTurn !== s.turn)
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
      if (isSpell(d)) pushSpellActivations(s, p, st.uid, d, false, out);
    }

    // The first turn of the duel has no battle.
    if (s.turn > 1) out.push({ type: 'enterBattle', player: p });
    out.push({ type: 'endTurn', player: p });
  } else if (s.phase === 'battle') {
    if (s.turn > 1) {
      const oppHasMonsters = opp.monsters.some(Boolean);
      me.monsters.forEach((m, attackerZone) => {
        if (!m || !m.faceUp || m.position !== 'attack' || m.attacksThisTurn > 0) return;
        const d = monsterDefOf(s, m.uid);
        if (oppHasMonsters)
          opp.monsters.forEach((t, targetZone) => {
            if (t) out.push({ type: 'attack', player: p, attackerZone, targetZone });
          });
        if (!oppHasMonsters || d?.effect === 'directAttack')
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
        if (m)
          out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'monster', ref: { player: o, zone: 'monster', index } } });
      });
      break;
    case 'gain1000':
      out.push({ type: 'activateSpell', player: p, uid });
      break;
    case 'reviveFromGraveyard': {
      const free = freeMonsterZones(s, p);
      if (!free.length) break;
      for (const gp of [p, o] as PlayerId[]) {
        for (const g of s.players[gp].graveyard) {
          if (!isMonster(defOf(s, g))) continue;
          for (const toZone of free)
            out.push({ type: 'activateSpell', player: p, uid, target: { kind: 'graveyard', uid: g, toZone } });
        }
      }
      break;
    }
    case 'equipAtk700': {
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
    case 'fieldVolcano':
      if (fromHand) out.push({ type: 'activateSpell', player: p, uid });
      break;
  }
}
