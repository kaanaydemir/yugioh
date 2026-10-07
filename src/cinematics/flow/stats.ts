// DUEL FLOW — statChange.
//
// The monster lights up green (raised) or red (lowered) and a column of ▲ chevrons climbs its
// body (▼ chevrons fall down it); the badge rolls to the new value with a punch (StatBadge) and
// the rolling stat pops over the head (statPop: number + delta + arrows). A run of consecutive
// statChanges (several monsters at once) plays staggered, with just the delta over each head
// so the numbers never pile up. Volcano auras are kept in step (FIRE flames / WATER steam).

import { CARDS } from '../../data/cards';
import { PAL, RAMPS } from '../../art/palette';
import { DEPTH } from '../../view/layout';
import { damageNumber, statPop } from '../../vfx/numbers';
import { Sparks, addGlow, run, spriteBox } from '../../vfx/setpieces';
import { flameAura, steamAura } from '../../duel/auras';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerEvent } from '../api';
import { ADD, all, bg, chevronTexture, rr, type AnyCtx, type Ctx, type EvOf } from './_kit';

type StatEv = EvOf<'statChange'>;

/** Chevrons streaming up the body (raised) or falling down it (lowered). */
function chevrons(ctx: AnyCtx, u: MonsterUnit, up: boolean): void {
  const sc = ctx.scene;
  const b = spriteBox(sc, u.sprite);
  const R = up ? RAMPS.leaf : RAMPS.crim;
  const tex = chevronTexture(sc, up);
  const sp = new Sparks(sc, DEPTH.FX + 6, ADD);
  const n = Math.max(6, Math.min(10, Math.round(b.w / 6)));
  const travel = Math.max(24, b.h * 0.8);
  for (let i = 0; i < n; i++) {
    const x = Math.round(b.left + 3 + ((i * 0.618) % 1) * Math.max(1, b.w - 6));
    const life = rr(420, 560);
    const v = (travel / life) * 1000;
    sp.add({
      x,
      y: up ? b.bottom - rr(0, 6) : b.top + rr(-4, 4),
      vy: up ? -v : v,
      life,
      delay: i * 40 + rr(0, 20),
      ramp: up ? [PAL.white, R[4], R[3], R[3], R[2]] : [R[4], R[3], R[3], R[2], R[1]],
      tex,
      fade: 0.35,
    });
  }
  sp.close();
}

/** Lowered stats: the body is drained red for a moment (multiply tint, stepped back). */
function drain(ctx: AnyCtx, u: MonsterUnit): Promise<void> {
  const s = u.sprite;
  if (!s.active || s.isTinted) return addGlow(ctx.scene, s, PAL.crim2, 420, 0.6);
  const steps = [PAL.crim3, PAL.crim3, PAL.crim4, PAL.white];
  return run(ctx.scene, 460, (t) => {
    if (!s.active) return;
    if (t >= 1) s.clearTint();
    else s.setTint(steps[Math.min(steps.length - 1, Math.floor(t * steps.length))]);
  });
}

registerEvent(
  'statChange',
  async (ctx: Ctx<'statChange'>) => {
    const group: StatEv[] = [ctx.ev];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (e.type !== 'statChange') break;
      if (ctx.isConsumed(i)) continue;
      group.push(e);
      ctx.consumeAt(i);
    }
    const volcano = ctx.after.players.some((p) => p.fieldSpell && CARDS[ctx.after.cards[p.fieldSpell.uid].cardId].id === 'volcano_arena');
    const single = group.length === 1;
    const jobs = group.map(async (e, k) => {
      await ctx.wait(k * 150);
      const u = ctx.unit(e.uid);
      if (!u || u.retired) return;
      const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
      if (volcano && (u.attribute === 'FIRE' || u.attribute === 'WATER') && !u.hasAura('volcano'))
        u.setAura('volcano', u.attribute === 'FIRE' ? flameAura(ctx.scene, u) : steamAura(ctx.scene, u));
      if (!u.sprite.visible || !u.sprite.active) {
        await u.setStats(e.atk, e.def, false);
        return;
      }
      ctx.sfx(up ? 'lpUp' : 'lpDown', { volume: 0.4 });
      const atkSide = e.atk !== e.prevAtk;
      const from = atkSide ? e.prevAtk : e.prevDef;
      const to = atkSide ? e.atk : e.def;
      const top = u.worldPoint('top');
      const parts: Promise<unknown>[] = [u.setStats(e.atk, e.def, true)];
      if (up) {
        parts.push(addGlow(ctx.scene, u.sprite, PAL.leaf3, 460, 0.7));
        chevrons(ctx, u, true);
      } else {
        // a beat later than any aura burst on the same frame (Ejder Kılıcı shattering)
        parts.push(ctx.wait(120).then(() => drain(ctx, u)));
        bg(ctx.wait(120).then(() => chevrons(ctx, u, false)));
      }
      parts.push(single ? statPop(ctx.scene, top.x, top.y - 6, from, to) : damageNumber(ctx.scene, top.x, top.y - 4, Math.abs(to - from), to >= from ? 'buff' : 'debuff'));
      await all(parts);
    });
    await all(jobs);
  },
  { name: 'flow:statChange' },
);
