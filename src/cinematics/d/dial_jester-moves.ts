// Kadran Soytarısı (dial_jester, lane D, C2) — its small moments in the clockwork voice (?look=v3 only; v1 and every
// other card fall through to the chain below, byte-identical):
//
// position  to defense: the key cranks one notch (jesterGuard "tık" + brass "tok") with a ratchet spit off the key,
//           the jester ducks behind its coin (toGuard) and the coin's face flashes gold in front of it — no generic
//           hex shield. To attack: the spring unwinds a notch (jesterUnguard), a hop of floor puffs, the badge pops.
// flip      the card turns and a dial is reflected on the tile: its hands race and SNAP to 12 (jesterFlipDial — a
//           whir, a hard tick, a brass "ting"), the dial flashes white and the jester pops out of it like the cuckoo
//           of its summon (the summon's own pop frames, quicker; jesterPop) — no hologram, no generic chime.
// Camera never moves (EF-8).

import { PAL } from '../../art/palette';
import { LOOK_V3, type XY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { Sparks, animate } from '../../vfx/combat';
import { registerCardHook, registerEvent } from '../api';
import { atFrame, panAt, play } from '../_v3/sound';
import { capped } from '../summon-b/_kit';
import { FLOOR_DEPTH, bounceDust, crankSparks, jesterPoint, popBurst, seedFx, summonDial } from './_dial_jester-fx';

const ID = 'dial_jester';

// ================================================================ position

registerEvent(
  'positionChange',
  async (ctx) => {
    const ev = ctx.ev;
    if (!LOOK_V3 || ctx.cardId(ev.uid) !== ID) return ctx.base();
    const unit = ctx.unit(ev.uid);
    const tile = ctx.tile(ev.uid);
    const toDef = ev.position === 'defense';
    const o = toDef ? 'side' : 'up';
    const anim = toDef ? 'toGuard' : 'fromGuard';
    if (!unit || unit.retired || !unit.sprite.visible || !unit.has(anim)) return ctx.base();
    const u = unit;
    const s = u.sprite;
    const sc = ctx.scene;
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    const pan = panAt(u.home.x);
    seedFx(u.uid * 19 + (toDef ? 1 : 2));
    u.posed = true;
    try {
      const jobs: Promise<unknown>[] = [];
      if (tile && tile.orientation !== o) jobs.push(tile.rotateTo(o, 240));
      u.position = ev.position;
      u.badge.setPosition(ev.position);
      const home: XY = { x: Math.round(u.home.x), y: Math.round(u.home.y) };
      if (toDef) {
        // the key cranks a notch as it starts to crouch
        play('jesterGuard', { volume: 0.85, pan });
        const k = jesterPoint(u, 'key');
        if (k) crankSparks(sc, k, -dir, s.depth + 0.3);
      } else play('jesterUnguard', { volume: 0.8, pan });
      const n = u.frameCount(anim);
      jobs.push(u.playRange(anim, 0, undefined, { hold: true }).then(() => u.rest()));
      jobs.push(
        u.playToFrame(anim, Math.max(0, n - 2)).then(() => {
          if (toDef) {
            // the coin held up as a shield: its face flashes gold, a glint runs over it
            const c = jesterPoint(u, 'coin') ?? u.core();
            const sp = new Sparks(sc, s.depth + 0.5);
            sp.add({ x: c.x, y: c.y - 1, life: 220, colors: [PAL.white, PAL.gold4, PAL.gold3], shape: 'star', size: 4, fadeAt: 0.6 });
            sp.add({ x: c.x, y: c.y, size: 5, grow: 26, life: 180, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'ring', fadeAt: 0.5 });
            sp.release();
            void lightFlash(sc, c.x + dir * 2, c.y, PAL.gold4, 18, 200, { floorY: home.y, intensity: 0.55 });
          } else {
            bounceDust(sc, home, 0.6, s.depth + 0.4);
            void u.badge.pop();
          }
        }),
      );
      await capped(sc, Promise.all(jobs), 440);
    } finally {
      u.posed = false;
      if (s.active && !u.retired) {
        const want = u.position === 'defense' ? 'guard' : 'idle';
        if (u.frameInfo().anim !== want || !s.anims.isPlaying) u.rest();
      }
    }
  },
  { priority: 20, name: 'd:dial_jester:position' },
);

// ================================================================ flip

registerCardHook(
  ID,
  'flip',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    const v = ctx.views;
    const field = v.field;
    const sc = ctx.scene;
    const flipSummon = ev.cause === 'flipSummon';
    if (flipSummon) {
      const si = ctx.findType('summon', (e) => e.uid === ev.uid && e.method === 'flip');
      if (si >= 0) ctx.consumeAt(si);
      void v.duelists?.get(ev.player).play('command');
    }
    let tile = field.tileOf(ev.uid);
    if (!tile) tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, false, 'side');
    tile.setCard(ev.cardId);
    const home: XY = { x: Math.round(tile.home.x), y: Math.round(tile.home.y) };
    const pan = panAt(home.x);
    seedFx(ev.uid * 23 + 9);
    // the card turns; the dial is reflected on the tile and its hands race to 12
    play('jesterFlipDial', { volume: 0.95, pan });
    const FLIP = flipSummon ? 240 : 200;
    const flipP = tile.flipUp(FLIP);
    const t0 = tile;
    if (flipSummon) void ctx.wait(Math.round(FLIP * 0.7)).then(() => (t0.active && t0.orientation !== 'up' ? t0.rotateTo('up', 200) : undefined));
    const dial = summonDial(sc, home, FLOOR_DEPTH);
    const pool = lightPool(sc, home.x, home.y - 4, { color: PAL.gold4, spill: PAL.gold3, radius: 30, floorY: home.y, air: 0.3, intensity: 0.6, fadeIn: 60 });
    const H0 = 200 + 360;
    const M0 = 90 + 360 * 2;
    await animate(sc, 230, (t) => {
      const e = Math.pow(t, 1.5);
      dial.set({ k: Math.min(1, t * 2.5), hour: H0 * (1 - e), min: M0 * (1 - e) });
    });
    // snap: both hands on 12, the dial flashes white
    dial.set({ k: 1, hour: 0, min: 0, hot: 1 });
    void lightFlash(sc, home.x, home.y - 2, PAL.white, 26, 200, { floorY: home.y, intensity: 0.8 });
    const unit = field.addUnit(ev.uid, {
      hidden: true,
      atk: ctx.atk(ev.uid, flipSummon ? 'after' : 'next'),
      def: ctx.def(ev.uid, flipSummon ? 'after' : 'next'),
      position: flipSummon ? 'attack' : 'defense',
    });
    if (!unit || !unit.has('summon')) {
      dial.destroy();
      void pool.fadeOut(160);
      await flipP;
      unit?.show();
      unit?.rest();
      return;
    }
    const u = unit;
    const s = u.sprite;
    u.position = flipSummon ? 'attack' : 'defense';
    u.badge.setPosition(u.position);
    u.posed = true;
    try {
      s.setScale(1).setPosition(u.rest0.x, u.rest0.y);
      // the cuckoo pops out of the dial (the summon's pop frames, quicker)
      const LAND = u.markFrame('summon', 'land', 2);
      u.pose('summon', LAND);
      u.showSprite();
      play('jesterPop', { volume: 0.85, pan });
      popBurst(sc, { x: home.x, y: home.y - 6 }, home.y, s.depth + 0.5);
      void animate(sc, 120, () => dial.set({ k: 0.7, hour: 0, min: 0 })).then(() => dial.destroy());
      const last = flipSummon ? u.frameCount('summon') - 1 : 8;
      // two damped bounces (f4, f6), the badge on the first
      atFrame(u, 'summon', 4, () => {
        play('jesterBounce', { volume: 0.7, pan, pitch: 1.1 });
        bounceDust(sc, home, 0.7, s.depth + 0.4);
        u.badge.setVisible(true);
        void u.badge.pop();
      }, { late: false });
      atFrame(u, 'summon', 6, () => {
        play('jesterBounce', { volume: 0.45, pan, pitch: 1.25 });
        bounceDust(sc, home, 0.4, s.depth + 0.4);
      }, { late: false });
      await u.playRange('summon', LAND, last, { timeScale: 1.5, hold: !flipSummon });
      if (!flipSummon && u.has('toGuard') && s.active) await u.playRange('toGuard', 0, undefined, { hold: false });
      await capped(sc, flipP, 120);
    } finally {
      dial.destroy();
      void pool.fadeOut(200);
      u.posed = false;
      u.lift = 0;
      if (s.active && !u.retired) {
        s.setScale(1).setPosition(u.rest0.x, u.rest0.y);
        u.badge.setVisible(true);
        u.show();
        if (!s.anims.isPlaying) u.rest();
      }
    }
  },
  { priority: 20, name: 'd:dial_jester:flip' },
);
