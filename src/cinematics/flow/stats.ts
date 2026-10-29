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
import { ADD, all, bg, chevronTexture, rr, fs, lightFlash, type AnyCtx, type Ctx, type EvOf } from './_kit';
// ---- the v3 look (lane A5-A step A-3b, V3_A5_A; see the section at the end of the file)
import type { XY } from '../../view/layout';
import { V3_A5_A } from '../../view/v3flags';
import { Sparks as PxSparks } from '../../vfx/combat';
import { fxCount, fxRng, numberUnderBar, rimClimb, silhouetteOf } from '../_v3/spellfx';
import { impactNumber } from '../_v3/number';
import { panAt, play as playV3 } from '../_v3/sound';
import { bladeBreakBeat, bladeBrokeEarly, bladeLost } from '../spells/_blade_v3';

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
    if (V3_A5_A) return statChangeV3(ctx, group, volcano); // A5-A (A5_PLAN §3.0 Sayılar, A-3b): end of this file
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
      // (v2) a soft green (raised) / red (lowered) light under the monster
      void lightFlash(ctx.scene, u.home.x, u.home.y, up ? PAL.leaf3 : PAL.crim3, fs(28), 520, { intensity: 0.6 });
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

// ================================================================ the v3 look (V3_A5_A)
//
// Lane A5-A step A-3b (docs/v3/A5_PLAN.md §3.0 "Sayılar", §5.1 A-3b): the generic statChange in the
// language of the v3 spell scenes. Behind V3_A5_A only (the handler above hands over after taking
// its group); v1 and the plain v3 look run the code above unchanged. Every statChange that no hook
// consumes plays this (Ejder Kılıcı's ATK roll on its forge until A-2, the blade breaking under
// Uçurum Büyücüsü, the flow pack's stat keys).
//
//   beat k    k × BEAT_GAP after the first (≥ 150 ms apart, in event order), per monster:
//     0       its pad lights one stepped tone (leaf3 raised / crim3 lowered: the light layer, no wash)
//     0–150   a 1-px edge light runs over its outline in three whole steps — raised: leaf2 → leaf3 →
//             leaf4 climbing feet → head; lowered: crim2 → crim3 → crim4 running head → feet (the
//             light drains off it). Only the pixels just OUTSIDE the body are painted: the sprite is
//             never tinted, scaled or moved (old art and v3 art alike; REHBER EF-3, A5 risk 6).
//     150     the top step's first frame: ONE number ("+700" green / "−700" red, _v3/number: whole
//             pixels, drawn on that frame), the badge starts its roll, lpUp / lpDown — the mark
//     150–390 the edge holds, then steps back down its ramp; raised: 4 leaf "+" motes rise off the
//             head; lowered: 4 crim pixels drop off the body's sides to the floor and blink out
// No chevron column, no whole-sprite tint, no stat pop with arrows, no camera call.

/** Beats of one statChange group: ≥ 150 ms apart (A5 §3.0, §6.5). */
export const STAT_BEAT_GAP = 160;
/** The edge light's step (3 steps to the top), hold and fade (ms). */
const RIM_STEP = 50;
const RIM_HOLD = 120;
const RIM_FADE = 120;
const LEAF_RIM = [PAL.leaf2, PAL.leaf3, PAL.leaf4] as const;
const CRIM_RIM = [PAL.crim2, PAL.crim3, PAL.crim4] as const;

/** The beat of statChange k of a group (ms after the group's start). */
export function statBeatMs(k: number): number {
  return Math.max(0, k) * STAT_BEAT_GAP;
}

/** Where a beat's number goes: the monster's top, moved aside from a number of this group already up. */
function numberSpotV3(spots: XY[], x: number, y: number): XY {
  const p = { x: Math.round(x), y: Math.round(y) };
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const q of spots) {
      if (Math.abs(p.x - q.x) < 24 && Math.abs(p.y - q.y) < 10) {
        p.x = q.x + (p.x >= q.x ? 24 : -24);
        moved = true;
      }
    }
    if (!moved) break;
  }
  p.x = Math.max(16, Math.min(624, p.x));
  spots.push(p);
  return p;
}

/** Raised: leaf motes rising off the head; lowered: crim pixels dropping off the sides to the floor. */
function statMotes(ctx: AnyCtx, u: MonsterUnit, up: boolean): void {
  const sil = silhouetteOf(u.sprite);
  if (!sil) return;
  const rnd = fxRng(u.uid * 41 + (up ? 7 : 13));
  const n = fxCount(4);
  const sp = new PxSparks(ctx.scene, u.sprite.depth + 1);
  const h = sil.bottom - sil.top;
  for (let i = 0; i < n; i++) {
    if (up) {
      // off the top edge, spread over the upper half of the body's width
      const x = Math.round(sil.left + ((i + 0.5) / n) * (sil.right - sil.left));
      const y = (sil.topAt(x) ?? sil.top) - 1;
      sp.add({ x, y, vx: (rnd() * 2 - 1) * 8, vy: -(36 + rnd() * 22), drag: 1.2, life: 300 + Math.floor(rnd() * 140), delay: i * 30, colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: i % 2 === 0 ? 'plus' : 'px', fadeAt: 1 });
    } else {
      // off the two sides at mid height, falling to the monster's floor
      const side = i % 2 === 0 ? -1 : 1;
      const y = Math.round(sil.top + h * (0.3 + 0.4 * rnd()));
      let x = side < 0 ? sil.left - 1 : sil.right;
      for (let k = 0; k < 40 && !sil.has(x - side, y); k++) x -= side;
      sp.add({ x, y, vx: side * (6 + rnd() * 8), vy: 10 + rnd() * 10, ay: 260, life: 380 + Math.floor(rnd() * 120), delay: i * 30, colors: [PAL.crim4, PAL.crim3, PAL.crim2, PAL.crim1], shape: 'px', fadeAt: 1, floor: Math.round(u.home.y), bounce: 0 });
    }
  }
  sp.release();
}

/** One monster's beat (see the section header). Resolves when its edge light is gone and the number has popped. */
async function statBeatV3(ctx: AnyCtx, e: StatEv, u: MonsterUnit, spots: XY[]): Promise<void> {
  const sc = ctx.scene;
  const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
  const delta = Math.abs(e.atk - e.prevAtk) || Math.abs(e.def - e.prevDef);
  void lightFlash(sc, u.home.x, u.home.y, up ? PAL.leaf3 : PAL.crim3, fs(22), 420, { floorY: u.home.y, intensity: 0.6 });
  let pop: Promise<void> = Promise.resolve();
  let peaked = false;
  const peak = () => {
    if (peaked) return;
    peaked = true;
    const t = u.worldPoint('top');
    // (never up into the phase bar: a back-row head is near the screen's top — fix round 2)
    const n = numberSpotV3(spots, t.x, numberUnderBar(t.y - 4).y);
    if (delta > 0) pop = impactNumber(sc, n.x, n.y, delta, { kind: up ? 'heal' : 'damage', rise: numberUnderBar(n.y).rise });
    playV3(up ? 'lpUp' : 'lpDown', { volume: 0.4, pan: panAt(u.home.x) }); // mark `stat`
    // the badge rolls from this frame (its target is set now, so a sync will not snap it)
    void u.setStats(e.atk, e.def, true);
    statMotes(ctx, u, up);
  };
  const rim = rimClimb(sc, u.sprite, { ramp: up ? LEAF_RIM : CRIM_RIM, from: up ? 'feet' : 'head', stepMs: RIM_STEP, holdMs: RIM_HOLD, fadeMs: RIM_FADE, depth: u.sprite.depth + 0.6, onPeak: peak });
  // the number never waits past the edge's top step (a sprite with no readable pixels has no edge)
  await Promise.race([rim, ctx.wait(RIM_STEP * 3 + 34)]);
  peak();
  await all([rim, pop]);
}

/** The generic statChange, the v3 look: one beat per monster, ≥ 150 ms apart. */
async function statChangeV3(ctx: Ctx<'statChange'>, group: StatEv[], volcano: boolean): Promise<void> {
  const spots: XY[] = [];
  const jobs = group.map(async (e, k) => {
    await ctx.wait(statBeatMs(k));
    const u = ctx.unit(e.uid);
    if (!u || u.retired) return;
    if (volcano && (u.attribute === 'FIRE' || u.attribute === 'WATER') && !u.hasAura('volcano'))
      u.setAura('volcano', u.attribute === 'FIRE' ? flameAura(ctx.scene, u) : steamAura(ctx.scene, u));
    // Ejder Kılıcı's loss (A-2, A5 §3.1 Kırılma): the sword breaks on this beat, its number on the crack frame —
    // or it broke already on its card's crack (fix round 1, C1-03): the badge only settles, no second number
    if (bladeBrokeEarly(u)) {
      // (the beat's roll is still running toward these values: a second set would restart it)
      const t = u.shownStats;
      if (t.atk !== e.atk || t.def !== e.def) await u.setStats(e.atk, e.def, true);
      return;
    }
    if (bladeLost(k === 0 ? ctx.stateNext : ctx.after, e, u)) {
      if (!u.sprite.visible || !u.sprite.active) u.setAura('equip', null);
      else return bladeBreakBeat(ctx, e, u);
    }
    if (!u.sprite.visible || !u.sprite.active) {
      await u.setStats(e.atk, e.def, false);
      return;
    }
    await statBeatV3(ctx, e, u, spots);
  });
  await all(jobs);
}
