// Default card hooks: the 5 spells, 3 traps and the monster effects, composed from the
// set-piece library (vfx/setpieces) — every activation owns its whole resolution (playRun), so
// the board never re-syncs half-way through it.
//
// A signature version replaces one of these with registerCardHook(<card>, <kind>, ...) at the
// default priority (0) in a new file under src/cinematics/.

import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { other } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { isoToScreen, type XY, zoneXY } from '../../view/layout';
import { tween, wait } from '../../vfx/core';
import { projectile } from '../../vfx/combat';
import { burnFly, chainsBind, chasm, ghostRise, healFly, healingFountain, mirrorDome, stormStrike, tendril, vineBurst } from '../../vfx/setpieces';
import { banner } from '../../vfx/banners';
import { DEFAULT_PRIORITY, registerCardHook } from '../_core/registry';
import type { CinematicContext } from '../_core/types';
import {
  all,
  cardToGraveyard,
  energyBolt,
  lpPoint,
  playRun,
  resolutionRun,
  spellShowcase,
  trapReveal,
} from '../_core/helpers';

const P = { priority: DEFAULT_PRIORITY };

type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;

function idxOf(ctx: CinematicContext, run: readonly number[], pred: (e: GameEvent) => boolean): number {
  return run.find((i) => pred(ctx.events[i])) ?? -1;
}

function tileSource(ctx: ActCtx) {
  const ev = ctx.ev;
  return ev.from === 'spellTrap' && ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null;
}

/** Where a monster zone's occupant is (unit core, else tile). */
function monsterPoint(ctx: CinematicContext, player: PlayerId, zone: number): XY {
  const u = ctx.views.field.unitAt(player, zone);
  if (u && u.sprite.visible) return u.core();
  const p = zoneXY(player, 'monster', zone);
  return { x: p.x, y: p.y - 8 };
}

// ================================================================ spells

/** Yıldırım Hükmü: showcase → the card's energy shoots into the sky over the target → storm
 * gathers, sigil locks, a giant bolt strikes → the target shatters. */
registerCardHook(
  'judgment_bolt',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const run = resolutionRun(ctx);
    const ti = idxOf(ctx, run, (e) => e.type === 'target');
    const tEv = ti >= 0 ? (ctx.events[ti] as Extract<GameEvent, { type: 'target' }>) : null;
    const ref = tEv?.targets[0];
    const show = await spellShowcase(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: tileSource(ctx) ?? 'hand' });
    if (!ref) {
      await show.close();
      await playRun(ctx, run);
      return;
    }
    const ground = zoneXY(ref.player, 'monster', ref.index);
    const unit = ctx.views.field.unitAt(ref.player, ref.index);
    await show.release({ x: ground.x, y: Math.max(24, ground.y - 112) }, { ms: 300 });
    ctx.consumeAt(ti);
    const di = idxOf(ctx, run, (e) => e.type === 'destroy' && e.location === 'monster' && e.zone === ref.index && e.player === ref.player);
    let destroyed: Promise<void> = Promise.resolve();
    await stormStrike(ctx.scene, ground.x, ground.y, {
      target: unit && unit.sprite.visible ? unit.sprite : undefined,
      onImpact: () => {
        if (di >= 0) destroyed = ctx.play(di, { hit: false, push: { x: 0, y: 1 } });
      },
    });
    await destroyed;
    await playRun(ctx, resolutionRun(ctx));
  },
  P,
);

/** Şifa Pınarı: showcase → a teal spring erupts on the player's side → droplets arc into the
 * LP panel → +1000. */
registerCardHook(
  'healing_spring',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const run = resolutionRun(ctx);
    const li = idxOf(ctx, run, (e) => e.type === 'lpGain');
    const show = await spellShowcase(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: tileSource(ctx) ?? 'hand' });
    const spring = isoToScreen(2, ev.player === 0 ? 4 : 0);
    await show.release(spring, { ms: 260 });
    let healed: Promise<void> = Promise.resolve();
    await healingFountain(ctx.scene, ev.player, lpPoint(ctx, ev.player), {
      at: spring,
      onArrive: () => {
        if (li >= 0) healed = ctx.play(li, { delivered: true });
      },
    });
    await healed;
    await playRun(ctx, resolutionRun(ctx));
  },
  P,
);

/** Ruh Çağrısı: showcase → the graveyard glows → the monster's ghost rises and floats to the
 * tile → a full summon (the special summon event, played with hints.noCard). */
registerCardHook(
  'soul_recall',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const run = resolutionRun(ctx);
    const ti = idxOf(ctx, run, (e) => e.type === 'target');
    const tEv = ti >= 0 ? (ctx.events[ti] as Extract<GameEvent, { type: 'target' }>) : null;
    const si = idxOf(ctx, run, (e) => e.type === 'summon' && e.from === 'graveyard');
    const sEv = si >= 0 ? (ctx.events[si] as Extract<GameEvent, { type: 'summon' }>) : null;
    const show = await spellShowcase(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: tileSource(ctx) ?? 'hand' });
    if (!tEv || !sEv || tEv.graveyardUid === undefined) {
      await show.close();
      await playRun(ctx, run);
      return;
    }
    const gUid: Uid = tEv.graveyardUid;
    const owner = ctx.owner(gUid);
    const pile = ctx.views.field.pile(owner, 'graveyard');
    await show.release(pile.topXY(), { ms: 320 });
    ctx.consumeAt(ti);
    void pile.flash(PAL.cyan4);
    ctx.sfx('revive', { volume: 0.9 });
    // the card leaves the graveyard
    const g = ctx.stateAt(si + 1).players[owner].graveyard;
    pile.set(g.length, g.length ? ctx.state.cards[g[g.length - 1]].cardId : null);
    await ghostRise(ctx.scene, pile.topXY(), zoneXY(sEv.player, 'monster', sEv.zone), sEv.cardId as never, { player: sEv.player });
    await ctx.play(si, { noCard: true, ghost: true });
    await playRun(ctx, resolutionRun(ctx));
  },
  P,
);

/** Ejder Kılıcı: the card lands in its spell zone, a golden bolt links it to the monster, then the
 * equip event forges the rune sword (default equip handler) and the ATK badge rolls. */
registerCardHook(
  'dragon_blade',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const field = ctx.views.field;
    const run = resolutionRun(ctx);
    let tile = tileSource(ctx);
    if (!tile && ev.zone !== null) {
      const show = await spellShowcase(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: 'hand', hold: 380 });
      tile = await show.land({ player: ev.player, spot: 'spellTrap', index: ev.zone, uid: ev.uid, cardId: ev.cardId });
    } else if (tile) {
      tile.setCard(ev.cardId);
      ctx.sfx('spellActivate', { volume: 0.8 });
      await tile.flipUp(320);
      void tile.pulse(PAL.teal3, 360);
    }
    const ti = idxOf(ctx, run, (e) => e.type === 'target');
    const tEv = ti >= 0 ? (ctx.events[ti] as Extract<GameEvent, { type: 'target' }>) : null;
    const ref = tEv?.targets[0];
    if (ref && tile) {
      ctx.consumeAt(ti);
      await energyBolt(ctx.scene, { x: tile.home.x, y: tile.home.y - 6 }, monsterPoint(ctx, ref.player, ref.index), RAMPS.gold, 320);
    }
    await playRun(ctx, resolutionRun(ctx));
    void field;
  },
  P,
);

/** Volkan Arenası: showcase → the old field spell breaks → the card slams onto the field zone →
 * the arena transforms (fieldSpell handler) → FIRE monsters flare up, WATER monsters steam. */
registerCardHook(
  'volcano_arena',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const run = resolutionRun(ctx);
    const show = await spellShowcase(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: 'hand', hold: 380 });
    // the old field spell goes first
    const olds = run.filter((i) => {
      const e = ctx.events[i];
      return (e.type === 'destroy' && e.location === 'field') || (e.type === 'toGraveyard' && e.from === 'field');
    });
    await playRun(ctx, olds);
    await show.land({ player: ev.player, spot: 'field', index: 0, uid: ev.uid, cardId: ev.cardId });
    await playRun(ctx, resolutionRun(ctx));
  },
  P,
);

// ================================================================ traps

/** Yer Yarığı reveal; the swallowing itself is the 'destroys' hook below. */
registerCardHook(
  'chasm_trap',
  'activate',
  async (ctx) => {
    await trapReveal(ctx, tileSource(ctx));
    await playRun(ctx, resolutionRun(ctx));
  },
  P,
);

/** Yer Yarığı: the ground under the monster cracks open and swallows it. */
registerCardHook(
  'chasm_trap',
  'destroys',
  async (ctx) => {
    const ev = ctx.ev;
    if (ev.location !== 'monster') return ctx.base();
    const field = ctx.views.field;
    const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
    const gEv = gi >= 0 ? (ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>) : null;
    if (gi >= 0) ctx.consumeAt(gi);
    const { tile, unit } = field.release(ev.uid);
    const home = tile ? tile.home : zoneXY(ev.player, 'monster', ev.zone);
    ctx.sfx('groundCrack', { volume: 1 });
    if (unit && unit.sprite.visible) {
      unit.badge.setVisible(false);
      if (tile) void wait(ctx.scene, 300).then(() => tile.dissolve(500)).then(() => tile.destroy());
      await chasm(ctx.scene, home.x, home.y, unit.sprite);
      unit.retire();
    } else if (tile) {
      await tile.dissolve(500);
      tile.destroy();
    }
    field.forget(ev.uid);
    if (gEv) await cardToGraveyard(ctx, { owner: gEv.owner, cardId: ev.cardId, from: { x: home.x, y: home.y - 4 } });
  },
  P,
);

/** Ayna Kalkanı: a hex mirror dome rises in front of the defender, the attack slams into it and
 * reflects as beams into every attack-position attacker — they shatter. */
registerCardHook(
  'mirror_barrier',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const run = resolutionRun(ctx);
    await trapReveal(ctx, tileSource(ctx));
    ctx.take('attack')?.destroy();
    const kills = run.filter((i) => {
      const e = ctx.events[i];
      return e.type === 'destroy' && e.location === 'monster' && e.sourceUid === ev.uid;
    });
    const pts = kills.map((i) => {
      const e = ctx.events[i] as Extract<GameEvent, { type: 'destroy' }>;
      return monsterPoint(ctx, e.player, e.zone);
    });
    const plays: Promise<void>[] = [];
    ctx.sfx('mirror', { volume: 1 });
    await mirrorDome(ctx.scene, ev.player, pts, {
      onHit: (k) => {
        const i = kills[k];
        if (i === undefined) return;
        plays.push(ctx.play(i, { hit: false }));
      },
    });
    await all(plays);
    await playRun(ctx, resolutionRun(ctx));
  },
  P,
);

/** Işık Zincirleri: chains shoot from the card, catch the attacker mid-lunge and drag it home;
 * "SAVAŞ BİTTİ". */
registerCardHook(
  'chains_of_light',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const tile = tileSource(ctx);
    await trapReveal(ctx, tile);
    const run = resolutionRun(ctx);
    const ni = idxOf(ctx, run, (e) => e.type === 'attackNegated');
    const nEv = ni >= 0 ? (ctx.events[ni] as Extract<GameEvent, { type: 'attackNegated' }>) : null;
    if (ni >= 0) ctx.consumeAt(ni);
    ctx.take('attack')?.destroy();
    const u = nEv ? ctx.unit(nEv.attackerUid) : null;
    if (u && u.sprite.visible) {
      // the attacker had already launched itself: a short dash toward the defenders
      const trig = ctx.before.pending && ctx.before.pending.kind === 'trapResponse' ? ctx.before.pending.trigger : null;
      const tgtUid = trig && trig.kind === 'attackDeclared' ? trig.targetUid : null;
      const tp = tgtUid !== null ? (ctx.unit(tgtUid)?.home ?? null) : null;
      const home = u.rest0;
      const aim = tp ?? zoneXY(other(u.player), 'monster', 1);
      const k = 0.38;
      void u.play('attack');
      await tween(ctx.scene, { targets: u.sprite, x: home.x + (aim.x - home.x) * k, y: home.y + (aim.y - u.home.y) * k, duration: 170, ease: 'Quad.In' });
      ctx.sfx('chains', { volume: 1 });
      const from = tile ? tile.home : zoneXY(ev.player, 'spellTrap', ev.zone ?? 1);
      await chainsBind(ctx.scene, from, u.sprite, { home });
      u.settle();
    }
    if (nEv) ctx.log('Saldırı geçersiz kılındı!', PAL.mag3);
    await banner(ctx.scene, 'SAVAŞ BİTTİ', { style: 'trap' });
    await playRun(ctx, resolutionRun(ctx));
  },
  P,
);

// ================================================================ monster effects

/** Find the damage / lpGain this effect causes (first one after the activation). */
function effectRun(ctx: ActCtx) {
  const run = resolutionRun(ctx);
  const di = idxOf(ctx, run, (e) => e.type === 'damage' && e.sourceUid === ctx.ev.uid);
  const li = idxOf(ctx, run, (e) => e.type === 'lpGain' && e.sourceUid === ctx.ev.uid);
  return { run, di, li };
}

/** Where a monster that already left the field was (last destroy of it in this batch). */
function lastZone(ctx: ActCtx): XY | null {
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.type === 'destroy' && e.uid === ctx.ev.uid) return zoneXY(e.player, 'monster', e.zone);
  }
  const loc = ctx.locate(ctx.ev.uid, 'before');
  return loc ? zoneXY(loc.player, 'monster', loc.index) : null;
}

/** Magma Titanı: chest core blazes during the roar, a fireball arcs into the opponent's panel. */
registerCardHook(
  'magma_titan',
  'effect',
  async (ctx) => {
    const ev = ctx.ev;
    const { di } = effectRun(ctx);
    const u = ctx.unit(ev.uid);
    const from = u ? u.core() : (lastZone(ctx) ?? zoneXY(ev.player, 'monster', 1));
    if (u && u.sprite.visible) {
      void u.play('roar');
      ctx.sfx('fireBurst', { volume: 0.6 });
      await wait(ctx.scene, 600);
    }
    let hit: Promise<void> = Promise.resolve();
    const target = di >= 0 ? (ctx.events[di] as Extract<GameEvent, { type: 'damage' }>).player : other(ev.player);
    await burnFly(ctx.scene, u ? u.core() : from, lpPoint(ctx, target), {
      kind: 'fireball',
      onImpact: () => {
        if (di >= 0) hit = ctx.play(di, { delivered: true });
      },
    });
    await hit;
  },
  P,
);

/** Kor Kurdu: a howl, and a little flame spirit weaves its way to the opponent's panel. */
registerCardHook(
  'ember_wolf',
  'effect',
  async (ctx) => {
    const ev = ctx.ev;
    const { di } = effectRun(ctx);
    const u = ctx.unit(ev.uid);
    if (u && u.sprite.visible) {
      void u.play('roar');
      ctx.sfx('roarSmall', { volume: 0.8 });
      await wait(ctx.scene, 420);
    }
    const from = u ? u.framePoint(30, 26) : (lastZone(ctx) ?? zoneXY(ev.player, 'monster', 1));
    let hit: Promise<void> = Promise.resolve();
    const target = di >= 0 ? (ctx.events[di] as Extract<GameEvent, { type: 'damage' }>).player : other(ev.player);
    await burnFly(ctx.scene, from, lpPoint(ctx, target), {
      kind: 'wisp',
      onImpact: () => {
        if (di >= 0) hit = ctx.play(di, { delivered: true });
      },
    });
    await hit;
  },
  P,
);

/** Şimşek Kertenkelesi: from its remains, lightning streaks to the opponent's panel. */
registerCardHook(
  'volt_lizard',
  'effect',
  async (ctx) => {
    const ev = ctx.ev;
    const { di } = effectRun(ctx);
    const z = lastZone(ctx) ?? zoneXY(ev.player, 'monster', 1);
    const from = { x: z.x, y: z.y - 10 };
    ctx.sfx('lightning', { volume: 0.8 });
    let hit: Promise<void> = Promise.resolve();
    const target = di >= 0 ? (ctx.events[di] as Extract<GameEvent, { type: 'damage' }>).player : other(ev.player);
    await burnFly(ctx.scene, from, lpPoint(ctx, target), {
      kind: 'bolt',
      onImpact: () => {
        if (di >= 0) hit = ctx.play(di, { delivered: true });
      },
    });
    await hit;
  },
  P,
);

/** Gelgit Golemi: a water blob splashes back at the attacker's side. */
registerCardHook(
  'tide_golem',
  'effect',
  async (ctx) => {
    const ev = ctx.ev;
    const { di } = effectRun(ctx);
    const u = ctx.unit(ev.uid);
    const from = u ? u.framePoint(44, 48) : (lastZone(ctx) ?? zoneXY(ev.player, 'monster', 1));
    const target = di >= 0 ? (ctx.events[di] as Extract<GameEvent, { type: 'damage' }>).player : other(ev.player);
    ctx.sfx('waterSplash', { volume: 0.7 });
    let hit: Promise<void> = Promise.resolve();
    await projectile(ctx.scene, from, lpPoint(ctx, target), 'water', {
      onImpact: () => {
        if (di >= 0) hit = ctx.play(di, { delivered: true });
      },
    });
    await hit;
  },
  P,
);

/** Işık Perisi: she spins, sparkles fountain up and stream into her owner's panel: +500. */
registerCardHook(
  'lumen_sprite',
  'effect',
  async (ctx) => {
    const ev = ctx.ev;
    const { li } = effectRun(ctx);
    const u = ctx.unit(ev.uid);
    if (u && u.sprite.visible) {
      void u.play('roar');
      ctx.sfx('holyChime', { volume: 0.7 });
      await wait(ctx.scene, 420);
    }
    const from = u ? u.core() : zoneXY(ev.player, 'monster', 1);
    let healed: Promise<void> = Promise.resolve();
    await healFly(ctx.scene, from, lpPoint(ctx, ev.player), {
      onArrive: () => {
        if (li >= 0) healed = ctx.play(li, { delivered: true });
      },
    });
    await healed;
  },
  P,
);

/** Uçurum Büyücüsü: the staff points, a shadow tendril crosses the floor and swallows the card. */
registerCardHook(
  'abyss_magus',
  'effect',
  async (ctx) => {
    const ev = ctx.ev;
    const run = resolutionRun(ctx);
    const ti = idxOf(ctx, run, (e) => e.type === 'target');
    const tEv = ti >= 0 ? (ctx.events[ti] as Extract<GameEvent, { type: 'target' }>) : null;
    const ref = tEv?.targets[0];
    const u = ctx.unit(ev.uid);
    if (!ref) {
      await playRun(ctx, run);
      return;
    }
    ctx.consumeAt(ti);
    if (u && u.sprite.visible) {
      void u.play('roar');
      ctx.sfx('darkPulse', { volume: 0.8 });
      await wait(ctx.scene, 340);
    }
    const from = u ? u.home : zoneXY(ev.player, 'monster', ev.zone ?? 1);
    const to = zoneXY(ref.player, ref.zone, ref.index);
    await tendril(ctx.scene, from, to);
    await playRun(ctx, resolutionRun(ctx), (i) => (ctx.events[i].type === 'destroy' ? { hit: false } : undefined));
  },
  P,
);

/** Dikenli Pusucu (FLIP): vines burst from under the target, coil and crush it. */
registerCardHook(
  'thorn_lurker',
  'effect',
  async (ctx) => {
    const ev = ctx.ev;
    const run = resolutionRun(ctx);
    const ti = idxOf(ctx, run, (e) => e.type === 'target');
    const tEv = ti >= 0 ? (ctx.events[ti] as Extract<GameEvent, { type: 'target' }>) : null;
    const ref = tEv?.targets[0];
    if (!ref) {
      await playRun(ctx, run);
      return;
    }
    ctx.consumeAt(ti);
    const u = ctx.unit(ev.uid);
    if (u && u.sprite.visible) {
      void u.play('roar');
      ctx.sfx('roarSmall', { volume: 0.7 });
      await wait(ctx.scene, 260);
    }
    const victim = ctx.views.field.unitAt(ref.player, ref.index);
    const at = zoneXY(ref.player, 'monster', ref.index);
    if (victim && victim.sprite.visible) await vineBurst(ctx.scene, at.x, at.y, victim.sprite);
    await playRun(ctx, resolutionRun(ctx), (i) => (ctx.events[i].type === 'destroy' ? { hit: false } : undefined));
  },
  P,
);
