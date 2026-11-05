// v3: the ATK/DEF plates during a battle. At the declaration the attacker's and the target's plates roll to the
// numbers this battle is fought with (battle-only debuffs such as Hortlak Muhafiz -400 / Kalkan Devi -500 and one-turn
// boosts included: engine battlePlates); the badge tints gold (higher) / crimson (lower) and pops as usual.
// They roll back to the real numbers when the battle's cinematic ends, a negated attack starts, or the phase moves on
// (FieldView.sync is the last safety). No camera moves; nothing here runs in the v1 look.
//
// No registrations of cinematics here besides one observer (the safety net).

import { battleNumbers, battlePlates, currentAtk, currentDef } from '../../engine';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerObserver } from '../api';
import type { CinematicContext } from '../api';
import { LOOK_V3 } from '../../view/layout';

/** Units whose plate shows battle-only numbers right now. */
const tinted = new Set<MonsterUnit>();

type DeclareCtx = Pick<CinematicContext, 'state'> & { ev: { attackerUid: number; targetUid: number | null } };

/**
 * Roll the plates of the attacker and the target to this battle's numbers. `holdDrain` (the declaration):
 * the target's declare debuff (Hortlak Muhafız −400) is left off — it drops at the attacker's own drain
 * beat (its activate cinematic calls this again without the option, src/cinematics/kart-b/grim_warden.ts).
 */
export function showBattlePlates(ctx: DeclareCtx, attacker: MonsterUnit | null, target: MonsterUnit | null, o: { holdDrain?: boolean } = {}): void {
  let plates: ReturnType<typeof battlePlates>;
  try {
    plates = battlePlates(ctx.state, ctx.ev.attackerUid, ctx.ev.targetUid);
    if (o.holdDrain && plates.target && ctx.ev.targetUid !== null && battleNumbers(ctx.state, ctx.ev.attackerUid, ctx.ev.targetUid).targetDebuffBy === ctx.ev.attackerUid)
      plates = { ...plates, target: { ...plates.target, atk: currentAtk(ctx.state, ctx.ev.targetUid) } };
  } catch {
    return;
  }
  const apply = (u: MonsterUnit | null, st: { atk: number; def: number } | null): void => {
    if (!u || !st) return;
    const shown = u.shownStats;
    if (shown.atk === st.atk && shown.def === st.def) return;
    u.battleTint = true;
    tinted.add(u);
    void u.setStats(st.atk, st.def, true);
  };
  apply(attacker, plates.attacker);
  apply(target, plates.target);
}

/** Roll every tinted plate back to the real numbers of `state` (the battle is over). */
export function restoreBattlePlates(state: Parameters<typeof currentAtk>[0]): void {
  for (const u of tinted) {
    tinted.delete(u);
    if (!u.battleTint) continue;
    u.battleTint = false;
    if (u.retired || !u.sprite.active) continue;
    void u.setStats(currentAtk(state, u.uid), currentDef(state, u.uid), true);
  }
}

if (LOOK_V3) {
  registerObserver((ev, ctx) => {
    if (ev.type === 'attackNegated' || ev.type === 'phaseChange' || ev.type === 'turnStart' || ev.type === 'gameOver') restoreBattlePlates(ctx.stateNext);
  });
}
