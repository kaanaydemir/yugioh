// Flip (GAME_DESIGN §6 flip): the face-down card jumps, rolls over with a glint and lands
// face-up; an attribute burst erupts from it and the monster POPS out (squash → stretch →
// settle, a fast hologram build). For every monster (event handler); Dikenli Pusucu's vines
// burst out of the ground first ("Dikenli Pusucu'da önce sarmaşıklar yerden fışkırır").
//
//   flipSummon (≈1.1 s): the card shivers (anticipation), jumps and turns, turns to attack,
//     burst, pop-out, roar — roar SFX + small shockwave + ATK/DEF badge on its climax frame.
//     The paired `summon` event (method 'flip') is consumed here.
//   attacked (≈0.65 s): it happens mid-battle (the attacker is wound up): quicker, the card
//     stays sideways and the monster pops out straight into its guard pose; no roar.
//
// The monster accents for summon-b's six reuse their entrance language in miniature.
//
// The v3 look (?look=v3; A2 fix: the flips ran 0.9–1.05 s, a still glow first, then a generic
// hologram pop-out with fractional squash / stretch — the plan's flip budget is 0.6 s): flipV3
// below. The card turns at once; half-way through the turn the body forms (a ≤ 160 ms palette-step
// hologram, no flat frame) already in the face-down monster's guard pose, and — flip summon — it
// rises out of that guard into attack position with its own `fromGuard` pose (the art's dedicated
// short entry), the badge popping on the rise; attacked, it stays in its guard. Monsters without
// those poses (the old ones, until A4) simply form in their resting pose: never a scale pop-out,
// never a roar that overruns the budget. A card hook (Kristal Ejder's) still takes precedence.

import type { MonsterId } from '../../data/cards';
import { CARDS, isMonster } from '../../data/cards';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, LOOK_V3 } from '../../view/layout';
import { attributeLightColor } from '../../view/light';
import type { TileCard } from '../../view/TileCard';
import { shake } from '../../vfx/core';
import { flipBurst, shockwave, sparkleBurst } from '../../vfx/summon';
import { materialize } from '../../vfx/hologram';
import { leaves, rocks, shadowWisps } from '../../vfx/particles';
import { registerEvent } from '../api';
import { E, bg, burst, capped, pose, roar, run, fs, lightFlash, type AnyCtx } from './_kit';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { vineCage, type VineCage } from './thorn_lurker';
import { holoOnset } from '../_v3/summon';
import { v3Recipe } from '../../presentation/registry';

/** Palette of the pop-out hologram when the monster's own language differs from its attribute. */
const FLIP_RAMP: Partial<Record<MonsterId, Ramp>> = { volt_lizard: RAMPS.cyan };

/**
 * The pop-out palette override of a monster, if it has one (docs/v3/A3_MIMARI.md §6.4: every read
 * of FLIP_RAMP goes through here; tests/presentation/table-access.test.ts).
 */
export function flipRamp(id: MonsterId): Ramp | undefined {
  // A3 bridge: in the v3 look a monster with v3 art and a recipe pops out in its recipe's ramp
  const name = v3Recipe(id)?.flip?.ramp;
  return name ? RAMPS[name] : FLIP_RAMP[id];
}

/** Monster-specific accent on the burst (summon-b's six; others get the attribute burst only). */
function accent(ctx: AnyCtx, id: MonsterId, x: number, y: number): void {
  const sc = ctx.scene;
  switch (id) {
    case 'storm_hawk':
      leaves(sc, x, y - 10, { count: 10, speed: 1.3, depth: DEPTH.FX - 1 });
      ctx.sfx('windGust', { volume: 0.6, pitch: 1.2 });
      break;
    case 'stone_sentinel':
      rocks(sc, x, y - 4, { count: 8, speed: 1, depth: DEPTH.FX - 1 });
      ctx.sfx('earthQuake', { volume: 0.45, pitch: 1.2 });
      break;
    case 'lumen_sprite':
      void sparkleBurst(sc, x, y - 20, { ramp: ATTRIBUTE_RAMP.LIGHT, count: 18, depth: DEPTH.FX + 1 });
      ctx.sfx('holyChime', { volume: 0.5, pitch: 1.3 });
      break;
    case 'shade_assassin':
      shadowWisps(sc, x, y, { radius: 16, count: 12, depth: DEPTH.FX - 1 });
      ctx.sfx('darkPulse', { volume: 0.5 });
      break;
    case 'crystal_wyrm':
      // v3 slice: a crystal glint off the turning card (its own v3 flip hook may take precedence)
      if (LOOK_V3) {
        void sparkleBurst(sc, x, y - 10, { ramp: RAMPS.cyan, count: 12, depth: DEPTH.FX + 1 });
        ctx.sfx('holyChime', { volume: 0.45, pitch: 1.35 });
      }
      break;
    case 'abyss_magus':
      // v3 slice: the void breathes out of the card (wisps along the floor)
      if (LOOK_V3) {
        shadowWisps(sc, x, y, { radius: 14, count: 10, depth: DEPTH.FX - 1 });
        ctx.sfx('darkPulse', { volume: 0.45, pitch: 1.2 });
      }
      break;
    case 'volt_lizard':
      burst(sc, x, y - 6, 18, { ramp: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], speed: [70, 170], up: 40, gravity: 300, life: [200, 380], depth: DEPTH.FX });
      ctx.sfx('lightning', { volume: 0.45, pitch: 1.3 });
      break;
    default:
      break;
  }
}

/** The face-down card shivers on its tile before it jumps (anticipation). */
function shiver(ctx: AnyCtx, tile: TileCard, ms: number): Promise<void> {
  const x0 = tile.home.x;
  return run(ctx.scene, ms, (t) => {
    if (!tile.active) return;
    tile.x = x0 + (t < 1 ? (Math.floor(t * 14) % 2 === 0 ? 1 : -1) * (t < 0.8 ? 1 : 0) : 0);
  }).then(() => {
    if (tile.active) tile.x = x0;
  });
}

/** Pop out of the card: squash on the floor → stretch up past rest → settle (scale about the feet). */
function popOut(ctx: AnyCtx, u: MonsterUnit, ms: number): Promise<void> {
  const s = u.sprite;
  const r0 = u.rest0;
  return run(ctx.scene, ms, (t) => {
    if (!s.active) return;
    let sx = 1;
    let sy = 1;
    let dy = 0;
    if (t < 0.25) {
      const k = E.outQ(t / 0.25);
      sx = 1 + 0.25 * (1 - k);
      sy = 0.55 + 0.65 * k;
      dy = 2 * (1 - k);
    } else if (t < 0.6) {
      const k = (t - 0.25) / 0.35;
      sx = 1 - 0.12 * Math.sin(Math.PI * k);
      sy = 1.2 - 0.2 * k;
      dy = -6 * Math.sin(Math.PI * k);
    } else {
      const k = (t - 0.6) / 0.4;
      const sp = E.spring(k);
      sx = 1 + 0.06 * sp;
      sy = 1 - 0.07 * sp;
    }
    s.setScale(sx, sy);
    s.setPosition(r0.x, Math.round(r0.y + dy));
    u.lift = Math.max(0, -dy);
  }).then(() => {
    if (!s.active) return;
    s.setScale(1).setPosition(r0.x, r0.y);
    u.lift = 0;
  });
}

registerEvent(
  'flip',
  async (ctx) => {
    if (LOOK_V3) return flipV3(ctx);
    const ev = ctx.ev;
    const v = ctx.views;
    const field = v.field;
    const sc = ctx.scene;
    const flipSummon = ev.cause === 'flipSummon';
    if (flipSummon) {
      const si = ctx.findType('summon', (e) => e.uid === ev.uid && e.method === 'flip');
      if (si >= 0) ctx.consumeAt(si);
      void v.duelists?.get(ev.player).play('command');
      void v.camera.unfocus(120);
    }
    const def = CARDS[ev.cardId];
    if (!isMonster(def)) return;
    const id = ev.cardId as MonsterId;
    let tile = field.tileOf(ev.uid);
    if (!tile) tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, false, 'side');
    tile.setCard(ev.cardId);
    const home = tile.home;
    const attr = def.attribute;
    const ramp = flipRamp(id) ?? ATTRIBUTE_RAMP[attr];

    // Dikenli Pusucu: the vines burst out of the ground first
    let cage: VineCage | null = null;
    if (id === 'thorn_lurker') {
      cage = vineCage(sc, home.x, home.y, { height: flipSummon ? 30 : 24 });
      ctx.sfx('groundCrack', { volume: 0.5, pitch: 1.1 });
      ctx.sfx('whoosh', { volume: 0.5, pitch: 0.6 });
      bg(shake(sc, 160, 1));
      await cage.grow(flipSummon ? 200 : 120);
    } else if (flipSummon) {
      // anticipation: the card glows in its owner's colour and shivers
      bg(tile.pulse(PLAYER_COLOR[ev.player], 300));
      await shiver(ctx, tile, 150);
    }

    // the card jumps and turns face-up (the rotation to attack overlaps the landing)
    ctx.sfx('flipReveal', { volume: 0.9 });
    const FLIP = flipSummon ? 360 : 260;
    const flipP = tile.flipUp(FLIP);
    if (flipSummon) bg(ctx.wait(FLIP * 0.85).then(() => (tile && tile.active && tile.orientation !== 'up' ? tile.rotateTo('up', 240) : undefined)));
    await ctx.wait(FLIP * 0.8);

    // the attribute burst + the monster pops out of the card
    const atk = ctx.atk(ev.uid, flipSummon ? 'after' : 'next');
    const dfn = ctx.def(ev.uid, flipSummon ? 'after' : 'next');
    const unit = field.addUnit(ev.uid, { hidden: true, atk, def: dfn, position: flipSummon ? 'attack' : 'defense' });
    bg(flipBurst(sc, home.x, home.y, attr));
    // (v2) the flip bursts open in its attribute's light
    void lightFlash(sc, home.x, home.y - 20, attributeLightColor(attr), fs(flipSummon ? 40 : 30), flipSummon ? 460 : 340, { floorY: home.y, ring: flipSummon, intensity: flipSummon ? 1 : 0.7 });
    accent(ctx, id, home.x, home.y);
    if (cage) bg(cage.burst(320));
    if (!unit) {
      await flipP;
      return;
    }
    unit.position = flipSummon ? 'attack' : 'defense';
    unit.badge.setPosition(unit.position);
    unit.posed = true;
    const s = unit.sprite;
    s.setPosition(unit.rest0.x, unit.rest0.y);
    pose(unit, flipSummon ? 'roar' : 'guard', 0);
    const mat = materialize(sc, s, { ramp, ms: flipSummon ? 340 : 280 });
    unit.showSprite();
    ctx.sfx('materialize', { volume: 0.55, pitch: 1.2 });
    try {
      if (flipSummon) {
        bg(popOut(ctx, unit, 300));
        await ctx.wait(120);
        const r = roar(ctx, unit, {
          from: 0,
          sfx: unit.card.ace ? 'roarBig' : 'roarSmall',
          volume: 0.8,
          onPeak: () => {
            void shockwave(sc, home.x, home.y, { ramp, radius: fs(46), ms: 380, thickness: 5 });
            void lightFlash(sc, home.x, home.y - 16, ramp[3], fs(30), 380, { floorY: home.y, ring: true, intensity: 0.8 });
            bg(shake(sc, 140, unit.card.ace ? 3 : 2));
            unit.badge.setVisible(true);
            void unit.badge.pop();
          },
        });
        await capped(sc, r.peak, 900);
        await capped(sc, mat, 200);
        await ctx.wait(100);
      } else {
        await popOut(ctx, unit, 220);
        unit.badge.setVisible(true);
        void unit.badge.pop();
        unit.rest();
        await capped(sc, mat, 120);
      }
      await capped(sc, flipP, 200);
    } finally {
      unit.posed = false;
      unit.lift = 0;
      if (s.active && !unit.retired) {
        s.setScale(1).setPosition(unit.rest0.x, unit.rest0.y);
        unit.show();
        if (!s.anims.isPlaying) unit.rest();
      }
    }
  },
  { name: 'summon-b:flip' },
);

// ================================================================ the v3 look

type FlipCtx = Parameters<Parameters<typeof registerEvent<'flip'>>[1]>[0];

/** The v3 flip (see the header): ≤ 0.6 s, the monster's own poses, whole pixels, no scale. */
function flipV3(ctx: FlipCtx): Promise<void> {
  return flipV3With(ctx, accent);
}

/** The burst accent of a v3 flip: the card's own (accent() above), or a recipe's (A3, recipe/flip.ts). */
export type FlipAccentFn = (ctx: AnyCtx, id: MonsterId, x: number, y: number) => void;

/**
 * Options of flipV3With (A3 pilot fix, additive; omitted = exactly the flip as before). The recipe layer's
 * flip (recipe/flip.ts) passes them for a recipe monster:
 *   burst: false   no generic flipBurst (the 80-px light pillar, the sparkles, the attribute preset) and no
 *                  attribute-coloured light flash: the recipe's accent is the burst
 *   rise           the sound on the rise's peak (default: roarBig / roarSmall, a beast's growl)
 */
export interface FlipV3Opts {
  burst?: boolean;
  rise?: (ctx: AnyCtx, unit: MonsterUnit) => void;
}

/**
 * The v3 flip with a given burst accent (A3: the recipe layer's flip hook, src/cinematics/recipe/flip.ts,
 * passes the recipe's; the event handler above passes the per-card accent(), exactly as before).
 */
export async function flipV3With(ctx: FlipCtx, accentFn: FlipAccentFn, o: FlipV3Opts = {}): Promise<void> {
  const ev = ctx.ev;
  const v = ctx.views;
  const field = v.field;
  const sc = ctx.scene;
  const flipSummon = ev.cause === 'flipSummon';
  if (flipSummon) {
    const si = ctx.findType('summon', (e) => e.uid === ev.uid && e.method === 'flip');
    if (si >= 0) ctx.consumeAt(si);
    void v.duelists?.get(ev.player).play('command');
    void v.camera.unfocus(120);
  }
  const def = CARDS[ev.cardId];
  if (!isMonster(def)) return;
  const id = ev.cardId as MonsterId;
  let tile = field.tileOf(ev.uid);
  if (!tile) tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, false, 'side');
  tile.setCard(ev.cardId);
  const home = { x: tile.home.x, y: tile.home.y };
  const attr = def.attribute;
  const ramp = flipRamp(id) ?? ATTRIBUTE_RAMP[attr];

  // Dikenli Pusucu: the vines still burst out of the ground first (short)
  let cage: VineCage | null = null;
  if (id === 'thorn_lurker') {
    cage = vineCage(sc, home.x, home.y, { height: flipSummon ? 30 : 24 });
    ctx.sfx('groundCrack', { volume: 0.5, pitch: 1.1 });
    await cage.grow(100);
  }
  // the card turns at once (its owner's glow runs alongside, never before it)
  if (flipSummon) bg(tile.pulse(PLAYER_COLOR[ev.player], 240));
  ctx.sfx('flipReveal', { volume: 0.9 });
  const FLIP = flipSummon ? 240 : 200;
  const flipP = tile.flipUp(FLIP);
  if (flipSummon) bg(ctx.wait(Math.round(FLIP * 0.7)).then(() => (tile && tile.active && tile.orientation !== 'up' ? tile.rotateTo('up', 200) : undefined)));
  await ctx.wait(Math.round(FLIP * 0.45));

  // half-way through the turn: the body forms in the pose the face-down monster held
  const atk = ctx.atk(ev.uid, flipSummon ? 'after' : 'next');
  const dfn = ctx.def(ev.uid, flipSummon ? 'after' : 'next');
  const unit = field.addUnit(ev.uid, { hidden: true, atk, def: dfn, position: flipSummon ? 'attack' : 'defense' });
  if (o.burst !== false) {
    bg(flipBurst(sc, home.x, home.y, attr));
    void lightFlash(sc, home.x, home.y - 16, attributeLightColor(attr), fs(flipSummon ? 34 : 26), flipSummon ? 360 : 280, { floorY: home.y, ring: flipSummon, intensity: flipSummon ? 0.9 : 0.6 });
  }
  accentFn(ctx, id, home.x, home.y);
  if (cage) bg(cage.burst(260));
  if (!unit) {
    await flipP;
    return;
  }
  unit.position = flipSummon ? 'attack' : 'defense';
  unit.badge.setPosition(unit.position);
  unit.posed = true;
  const s = unit.sprite;
  const rise = flipSummon && unit.has('fromGuard') ? 'fromGuard' : null;
  try {
    s.setScale(1).setPosition(unit.rest0.x, unit.rest0.y);
    // guard pose (face-down monsters guard); a monster without a rise forms in its resting pose
    if (rise || !flipSummon) unit.pose('guard', 0);
    else unit.pose('idle', 0);
    unit.showSprite();
    ctx.sfx('materialize', { volume: 0.5, pitch: 1.2 });
    const onset = holoOnset(sc, unit, ramp, 160);
    if (rise) {
      // the rise starts while the body is still forming (it already moves), the badge on its peak
      await ctx.wait(60);
      const total = unit.animMs(rise);
      const play = unit.playRange(rise, 0, undefined, { hold: false });
      await ctx.wait(Math.round(total * 0.55));
      void shockwave(sc, home.x, home.y, { ramp, radius: fs(40), ms: 340, thickness: 4 });
      if (o.rise) o.rise(ctx, unit);
      else ctx.sfx(unit.card.ace ? 'roarBig' : 'roarSmall', { volume: 0.55 });
      unit.badge.setVisible(true);
      void unit.badge.pop();
      await capped(sc, play, Math.round(total * 0.5) + 120);
    } else {
      await capped(sc, onset, 220);
      unit.badge.setVisible(true);
      void unit.badge.pop();
      unit.rest();
    }
    await capped(sc, onset, 120);
    await capped(sc, flipP, 120);
  } finally {
    unit.posed = false;
    unit.lift = 0;
    if (s.active && !unit.retired) {
      s.setScale(1).setPosition(unit.rest0.x, unit.rest0.y);
      unit.show();
      if (!s.anims.isPlaying) unit.rest();
    }
  }
}
