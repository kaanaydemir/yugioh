// Attack declaration, the trap-window decision cue, the decline and the generic attack negation.
//
//   attackDeclare     duelist commands, the attacker coils (squash + power ring + rising sparks),
//                     the arrow arcs to the target, the reticle snaps, the target braces (defense:
//                     hex glint; attack: flinch), the camera leans in between them. The pose, arrow
//                     and reticle are kept as an AttackHold ('attack') — across a trap decision too.
//   decision          trapResponse: the defender's set cards breathe magenta ('trapPulse' kept).
//   responseDeclined  the set cards cool down and a small "Geç" pops over the defender's row.
//   attackNegated     the arrow shatters, the attacker is shoved back with a clang, "SAVAŞ BİTTİ".
// (The guard-pose rule — a defense-position unit never shows its upright 'hit' — is MonsterUnit's.)
//
// The v3 look (?look=v3; A0 §6.2 item 4 "İlan = hazırlık"): attackDeclareV3 below. The wind-up IS
// the strike's own first anticipation frames — the attack anim plays from frame 0 up to its
// 'charge' mark (marks.charge; without one, the first wind-up frame) and holds there, so the
// strike that follows continues the same motion. No squash / stretch (no fractional scale), no
// half-pixel tremble, no silhouette glow; the arrow, the reticle and the floor light carry the
// beat. The whole declaration ends in ≤ 0.3 s (_v3/budget.ts DECLARE_MAX_MS).

import type Phaser from 'phaser';
import { PAL, PLAYER_COLOR, PLAYER_RAMP } from '../../art/palette';
import { pixelText } from '../../ui/text';
import { LANES, LANE_MID, DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { showBattlePlates } from './plates';
import { DECLARE_MAX_MS } from '../_v3/budget';
import { canHandOver, declarePoseFrame, type HandOver } from '../_v3/clash';
import { resultPlate } from '../traps/_opening';
import { tween, wait } from '../../vfx/core';
import { attackArrow, blockClang, lockOn } from '../../vfx/combat';
import { atFrame, dropCharge, holdCharge, play as playSnd, quietCombat } from '../_v3/sound';
import { E, Sparks, addGlow, floorRing, onFrame, run } from '../../vfx/setpieces';
import { banner, type BannerOpts } from '../../vfx/banners';
import { lightBeam, lightFlash } from '../../view/light';
import { fx, registerEvent, registerObserver } from '../api';
import { REACTION_POSES, warmUnitPoses } from '../_v3/warm';
import { alignStart, frameDelta, idleDelta, settleBefore, strikeContactIn } from '../_v3/posematch';
import { V3HOOKS } from '../v3small/_hooks';
import {
  ADD,
  TAU,
  TK,
  type AttackHold,
  type Ctx,
  arenaDim,
  arenaDimBase,
  duelist,
  hexGlint,
  isSetPulse,
  lerpXY,
  live,
  norm,
  other,
  rnd,
  rr,
  seed,
  setCardPulse,
  strikeLight,
  sub,
  takeAttack,
} from './_kit';

// ================================================================ attackDeclare

registerEvent(
  'attackDeclare',
  async (ctx) => {
    if (LOOK_V3) return attackDeclareV3(ctx);
    const ev = ctx.ev;
    const sc = ctx.scene;
    seed(ev.attackerUid * 31 + (ev.targetUid ?? 7));
    // a stale hold (should not happen) goes first
    ctx.take('attack')?.destroy();
    const attacker = live(ctx.unit(ev.attackerUid));
    const target = ev.targetUid !== null ? live(ctx.unit(ev.targetUid)) : null;
    const tTile = ev.targetUid !== null ? ctx.tile(ev.targetUid) : null;
    const defender = other(ev.player);
    const ramp = PLAYER_RAMP[ev.player];
    const home = zoneXY(ev.player, 'monster', ev.attackerZone);
    const from: XY = attacker ? attacker.core() : { x: home.x, y: home.y - 12 };
    const to: XY = target ? target.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 8 } : fx.duelistPoint(ctx, defender);

    // camera leans in between attacker and target
    void ctx.focus(lerpXY(from, to, 0.5), { zoom: 1.05, ms: 380, pan: 0.32 });
    void duelist(ctx, ev.player)?.play('command');
    ctx.sfx('attackDeclare', { volume: 0.85 });

    // ---- wind-up: the attacker coils back toward its own side, squashes, powers up
    let tremble: (() => void) | null = null;
    let coil: Promise<void> = Promise.resolve();
    const back = norm(sub(from, to));
    const coilXY = attacker ? { x: Math.round(attacker.rest0.x + back.x * 2), y: Math.round(attacker.rest0.y + back.y * 2) } : null;
    if (attacker && coilXY) {
      const s = attacker.sprite;
      attacker.posed = true;
      sc.tweens.killTweensOf(s);
      coil = tween(sc, { targets: s, x: coilXY.x, y: coilXY.y, scaleY: 0.93, scaleX: 1.05, duration: 210, ease: 'Quad.Out' });
      void addGlow(sc, s, ramp[3], 380, 0.55);
      void floorRing(sc, attacker.home.x, attacker.home.y, { r0: 4, r1: 30 * TK, ms: 420, ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], depth: DEPTH.SHADOW - 1 });
      // arena v2: the power-up lights the marble in the player's colour; the stadium holds its breath
      void lightFlash(sc, attacker.home.x, attacker.home.y - 8, ramp[3], 42, 560, { floorY: attacker.home.y, ring: true, intensity: 0.75 });
      void arenaDim(sc, 0.2, 380);
      const motes = new Sparks(sc, DEPTH.FX - 1, ADD);
      const h = attacker.home;
      void fx.all([
        new Promise<void>((done) => {
          onFrame(sc, (dt, el) => {
            if (el > 520) {
              motes.close();
              done();
              return false;
            }
            if (dt > 0 && rnd() < dt / 26) {
              const a = rr(0, TAU);
              motes.add({ x: h.x + Math.cos(a) * rr(8, 16), y: h.y + Math.sin(a) * rr(3, 7), vy: rr(-70, -40), drag: 1, life: rr(240, 420), ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], tex: rnd() < 0.25 ? 'fx:plus' : 'fx:px1' });
            }
            return true;
          });
        }),
      ]);
    }

    // ---- the arrow arcs out, the reticle snaps onto the target
    await wait(sc, 70);
    const arrow = attackArrow(sc, from, to, ev.player);
    // arena v2: the aim lights a faint strip along the floor from the attacker to its target
    const aimFrom = attacker ? attacker.home : home;
    const aimTo = target ? target.home : tTile ? tTile.home : { x: to.x, y: to.y + 18 };
    const aimLight = lightBeam(sc, aimFrom, aimTo, ramp[3], 0, { air: false, floor: { from: aimFrom, to: aimTo }, floorWidth: 9, intensity: 0.55, shimmer: 0.4 });
    const size = target ? Math.max(24, Math.round(target.art.w * 0.42)) : tTile ? 26 : 30;
    const lock = lockOn(sc, to.x, to.y, { color: PLAYER_COLOR[ev.player], size });
    // the target braces as the reticle lands
    void wait(sc, 230).then(() => {
      if (target && target.sprite.active) {
        if (target.position === 'defense') {
          void hexGlint(sc, to.x + back.x * 8, to.y + back.y * 8 - 2, back.x, PAL.water3, 340);
        } else {
          const s = target.sprite;
          const r = target.rest0;
          const away = norm(sub(to, from));
          if (!target.posed) {
            sc.tweens.killTweensOf(s);
            void tween(sc, { targets: s, x: Math.round(r.x + away.x * 1.5), y: Math.round(r.y + away.y), duration: 70, ease: 'Quad.Out', yoyo: true, hold: 60 }).then(() => {
              if (s.active && !target.posed) s.setPosition(r.x, r.y);
            });
          }
        }
      } else if (tTile && tTile.active && !tTile.faceUp) void tTile.pulse(PLAYER_COLOR[ev.player], 320);
      else if (ev.targetUid === null) void duelist(ctx, defender)?.jolt();
    });
    await coil;
    // a held breath: the coiled attacker trembles while the attack hangs (and through a decision)
    if (attacker && coilXY) {
      const s = attacker.sprite;
      tremble = onFrame(sc, (_dt, el) => {
        if (!s.active) return false;
        const j = Math.floor(el / 90) % 4;
        s.x = coilXY.x + (j === 1 ? 1 : j === 3 ? -1 : 0) * 0.5;
        return true;
      });
    }

    let marksGone = false;
    const dropMarks = () => {
      if (marksGone) return;
      marksGone = true;
      arrow.destroy();
      lock.destroy();
      void aimLight.fadeOut(160);
    };
    let released = false;
    const restore = () => {
      tremble?.();
      tremble = null;
      if (!attacker) return;
      const s = attacker.sprite;
      if (!s.active) return;
      sc.tweens.killTweensOf(s);
      const r = attacker.rest0;
      s.setPosition(r.x, r.y).setScale(1);
      attacker.posed = false;
    };
    const hold: AttackHold = {
      kind: 'attackHold',
      attackerUid: ev.attackerUid,
      targetUid: ev.targetUid,
      player: ev.player,
      from,
      to,
      dropMarks,
      shatterMarks() {
        if (marksGone) return;
        // the arrow breaks apart along its arc, the reticle bursts
        const sp = new Sparks(sc, DEPTH.FX_TOP + 1);
        const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - Math.min(46, Math.max(14, Math.hypot(to.x - from.x, to.y - from.y) * 0.32)) };
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const u = 1 - t;
          const p = { x: u * u * from.x + 2 * u * t * mid.x + t * t * to.x, y: u * u * from.y + 2 * u * t * mid.y + t * t * to.y };
          sp.add({ x: p.x, y: p.y, vx: rr(-40, 40), vy: rr(-50, 10), ay: 240, drag: 1.5, life: rr(220, 420), ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], tex: rnd() < 0.3 ? 'fx:px2' : 'fx:px1' });
        }
        sp.burst(10, () => {
          const a = rr(0, TAU);
          return { x: to.x, y: to.y, vx: Math.cos(a) * rr(50, 110), vy: Math.sin(a) * rr(50, 110), drag: 3, life: rr(200, 360), ramp: [PAL.white, ramp[4], ramp[3]], tex: 'fx:plus' };
        });
        sp.close();
        void lightFlash(sc, to.x, to.y, ramp[3], 30, 260, { floorY: to.y + 16, intensity: 0.7 });
        dropMarks();
      },
      async release(ms = 80) {
        if (released) return;
        released = true;
        tremble?.();
        tremble = null;
        if (!attacker || !attacker.sprite.active) return;
        const s = attacker.sprite;
        const r = attacker.rest0;
        sc.tweens.killTweensOf(s);
        await tween(sc, { targets: s, x: r.x, y: r.y, scaleX: 1, scaleY: 1, duration: ms, ease: 'Quad.Out' });
        if (s.active) s.setPosition(r.x, r.y).setScale(1);
        attacker.posed = false;
      },
      destroy() {
        dropMarks();
        if (!released) {
          released = true;
          restore();
        }
      },
    };
    ctx.keep('attack', hold);
    await arrow.done;
    await lock.done;
    await wait(sc, 140);
  },
  { name: 'tb:attackDeclare' },
);

// ================================================================ the trap window

registerEvent(
  'decision',
  async (ctx) => {
    const pd = ctx.ev.pending;
    if (pd.kind !== 'trapResponse') return ctx.base();
    const h = V3HOOKS.decision; if (h) return h(ctx); // v3 lane A6-B (S-8; keeps 'trapPulse', S-4)
    ctx.take('trapPulse')?.destroy();
    const pulse = setCardPulse(ctx, pd.player);
    ctx.keep('trapPulse', pulse);
    ctx.sfx('lockOn', { volume: 0.45, pitch: 0.7 });
    // a magenta shimmer runs along the defender's spell/trap row once
    for (let i = 0; i < LANES; i++) {
      const p = zoneXY(pd.player, 'spellTrap', i);
      void wait(ctx.scene, i * 70).then(() => {
        void lightFlash(ctx.scene, p.x, p.y, PAL.mag3, 30, 420, { intensity: 0.6 });
        return floorRing(ctx.scene, p.x, p.y, { r0: 6, r1: 26 * TK, ms: 360, ramp: [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], depth: DEPTH.TILE_FX + 2 });
      });
    }
    await ctx.wait(300);
  },
  { name: 'tb:decision' },
);

registerEvent(
  'responseDeclined',
  async (ctx) => {
    const sc = ctx.scene;
    const p = ctx.ev.player;
    const h = ctx.take('trapPulse');
    if (isSetPulse(h)) h.settle(PAL.night4);
    else h?.destroy();
    // small "Geç" over the defender's spell/trap row
    const row = zoneXY(p, 'spellTrap', LANE_MID);
    const at = { x: row.x, y: row.y - 22 };
    const t = pixelText(sc, at.x, at.y, 'Geç', { size: 'md', color: PAL.mist, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.FX_TOP + 5);
    ctx.sfx('uiBack', { volume: 0.5, pitch: 0.9 });
    if (LOOK_V3) {
      // v3: never squashed — it drops in on whole pixels (2 px, a dim tone, then lit), holds and
      // rises out the same way, dimming in palette steps (as trapWord / resultPlate)
      const x = Math.round(at.x);
      const y = Math.round(at.y);
      t.setPosition(x, y - 2).setTint(PAL.steel);
      void (async () => {
        await run(sc, 50, (k) => t.active && t.setY(y - 2 + Math.min(2, Math.floor(k * 3))));
        if (t.active) t.setY(y).setTint(PAL.white);
        await wait(sc, 40);
        if (t.active) t.setTint(PAL.mist);
        await wait(sc, 300);
        await run(sc, 120, (k) => {
          if (!t.active) return;
          t.setY(y - Math.min(3, Math.floor(k * 4)));
          t.setTint(k < 0.5 ? PAL.steel : PAL.night4);
        });
        t.destroy();
      })();
      await wait(sc, 300);
      return;
    }
    t.setScale(1.4, 0.7);
    void (async () => {
      await tween(sc, { targets: t, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.Out' });
      await wait(sc, 260);
      await tween(sc, { targets: t, y: at.y - 8, alpha: 0, duration: 260, ease: 'Quad.In' });
      t.destroy();
    })();
    await wait(sc, 300);
  },
  { name: 'tb:responseDeclined' },
);

// ================================================================ attackNegated (generic)

/**
 * A negated attack without its own card hook: the arrow shatters, the attacker is shoved back
 * with a clang and recoils, the camera eases out and "SAVAŞ BİTTİ" slams.
 */
registerEvent(
  'attackNegated',
  async (ctx) => {
    if (LOOK_V3) return attackNegatedV3(ctx);
    const ev = ctx.ev;
    const sc = ctx.scene;
    const { hold, other: kept } = takeAttack(ctx);
    kept?.destroy();
    hold?.shatterMarks();
    const u = live(ctx.unit(ev.attackerUid));
    if (u) {
      await hold?.release(60);
      const c = u.core();
      const s = u.sprite;
      const r = u.rest0;
      const back = u.player === 0 ? { x: -1, y: 0.5 } : { x: 1, y: -0.5 };
      void blockClang(sc, Math.round(c.x - back.x * 8), Math.round(c.y - back.y * 8), { from: { x: c.x - back.x * 30, y: c.y - back.y * 30 }, color: PAL.mag3 });
      void lightFlash(sc, c.x - back.x * 8, c.y - back.y * 8, PAL.mag3, 36, 320, { floorY: u.home.y, ring: true });
      void u.play('hit');
      u.posed = true;
      await tween(sc, { targets: s, x: Math.round(r.x + back.x * 4), y: Math.round(r.y + back.y * 2), duration: 70, ease: 'Quad.Out' });
      await tween(sc, { targets: s, x: r.x, y: r.y, duration: 260, ease: 'Back.Out' });
      u.posed = false;
    } else hold?.destroy();
    void ctx.unfocus(260);
    void arenaDim(sc, 0, 420);
    ctx.log('Saldırı geçersiz kılındı!', PAL.mag3);
    const o: BannerOpts & { stagger: number } = { style: 'trap', hold: 140, stagger: 18 };
    await banner(sc, 'SAVAŞ BİTTİ', o);
  },
  { name: 'tb:attackNegated' },
);

// ================================================================ arena v2: never leave the stadium dimmed

/**
 * Safety net for the battle dim (battle / trap handlers restore it themselves): a new phase, a new
 * turn or the end of the duel always brings the floodlights back.
 */
registerObserver((ev, ctx) => {
  if (ev.type !== 'phaseChange' && ev.type !== 'turnStart' && ev.type !== 'gameOver') return;
  if (arenaDimBase(ctx.scene) !== 0) void arenaDim(ctx.scene, 0, 400);
});

// ================================================================ attackDeclare, the v3 look

/** Longest the wind-up frames may take inside the declaration (ms); longer holds play faster. */
const DECLARE_POSE_MS = 180;
/** A3 Y1b: the declaration's length until the battle starts (the reticle's 230-ms lock on the frame grid). */
const DECLARE_SETTLE_MS = 233;

async function attackDeclareV3(ctx: Ctx<'attackDeclare'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  seed(ev.attackerUid * 31 + (ev.targetUid ?? 7));
  ctx.take('attack')?.destroy();
  const attacker = live(ctx.unit(ev.attackerUid));
  const target = ev.targetUid !== null ? live(ctx.unit(ev.targetUid)) : null;
  showBattlePlates(ctx, attacker, target);
  // the poses the clash may need (recoils, guard brace / break, deaths) are painted now, in the
  // background — never synchronously on the contact frame (_v3/warm.ts)
  for (const u of [attacker, target]) if (u) warmUnitPoses(u, REACTION_POSES);
  // A3 Y1b: a resting target's idle starts arriving on a frame its struck pose continues: the
  // declaration + the strike from the frame after the charge pose to the attack's 'contact' mark
  // (the battle re-plans on the strike's own first frame, _v3/posematch.ts)
  if (attacker && target) {
    const lead = strikeContactIn(attacker, declarePoseFrame(attacker) + 1);
    if (lead !== null) settleBefore(target, DECLARE_SETTLE_MS + lead);
  }
  const tTile = ev.targetUid !== null ? ctx.tile(ev.targetUid) : null;
  const defender = other(ev.player);
  const ramp = PLAYER_RAMP[ev.player];
  const home = zoneXY(ev.player, 'monster', ev.attackerZone);
  const from: XY = attacker ? attacker.core() : { x: home.x, y: home.y - 12 };
  const to: XY = target ? target.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 8 } : fx.duelistPoint(ctx, defender);
  const back = norm(sub(from, to));

  void ctx.focus(lerpXY(from, to, 0.5), { zoom: 1.05, ms: 280, pan: 0.32 });
  void duelist(ctx, ev.player)?.play('command');
  // (the 'attackDeclare' cue is the arrow's own: attackArrow plays it — one cue, not two)

  // ---- the wind-up: the strike's own first frames, up to its charge pose, held there
  let posed: Promise<void> = Promise.resolve();
  if (attacker) {
    const s = attacker.sprite;
    attacker.posed = true;
    sc.tweens.killTweensOf(s);
    const r = attacker.rest0;
    s.setPosition(r.x, r.y);
    const f = declarePoseFrame(attacker);
    const ms = attacker.rangeMs('attack', 0, f);
    // a hovering body starts the charge where its idle bob left it (no first-frame jump)
    alignStart(attacker, 'attack', 0);
    posed = f > 0 ? attacker.playRange('attack', 0, f, ms > DECLARE_POSE_MS ? { timeScale: ms / DECLARE_POSE_MS } : {}) : Promise.resolve(void attacker.pose('attack', 0));
    // its own charge sound starts on the frame its charge pose is on screen (_v3/sound.ts; the
    // strike takes the voice over — sound QA S3: it waited for the strike, 10 frames late)
    const a0 = attacker;
    atFrame(a0, 'attack', f, () => holdCharge(a0), { maxMs: 1000 });
    void floorRing(sc, attacker.home.x, attacker.home.y, { r0: 4, r1: 30 * TK, ms: 420, ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], depth: DEPTH.SHADOW - 1 });
    // the power-up lights the floor in the player's colour (the v3 stepped light); the arena holds its breath
    void lightFlash(sc, attacker.home.x, attacker.home.y - 8, ramp[3], 36, 420, { floorY: attacker.home.y, ring: true, intensity: 0.7 });
    void arenaDim(sc, 0.2, 280);
    const motes = new Sparks(sc, DEPTH.FX - 1, ADD);
    const h = attacker.home;
    onFrame(sc, (dt, el) => {
      if (el > 420) {
        motes.close();
        return false;
      }
      if (dt > 0 && rnd() < dt / 26) {
        const a = rr(0, TAU);
        motes.add({ x: h.x + Math.cos(a) * rr(8, 16), y: h.y + Math.sin(a) * rr(3, 7), vy: rr(-70, -40), drag: 1, life: rr(240, 420), ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], tex: rnd() < 0.25 ? 'fx:plus' : 'fx:px1' });
      }
      return true;
    });
  }

  // ---- the arrow arcs out at once, the reticle snaps onto the target (its cue a little under the
  // battle's contact frame, which is the loudest beat of an attack: _v3/sound.ts)
  const arrow = quietCombat(() => attackArrow(sc, from, to, ev.player));
  playSnd('attackDeclare', { volume: 0.7 });
  const aimFrom = attacker ? attacker.home : home;
  const aimTo = target ? target.home : tTile ? tTile.home : { x: to.x, y: to.y + 18 };
  const aimLight = lightBeam(sc, aimFrom, aimTo, ramp[3], 0, { air: false, floor: { from: aimFrom, to: aimTo }, floorWidth: 9, intensity: 0.55, shimmer: 0.4 });
  const size = target ? Math.max(24, Math.round(target.art.w * 0.42)) : tTile ? 26 : 30;
  const lock = lockOn(sc, to.x, to.y, { color: PLAYER_COLOR[ev.player], size });
  // the target braces as the reticle lands (whole pixels only)
  void wait(sc, 200).then(() => {
    if (target && target.sprite.active) {
      if (target.position === 'defense') void hexGlint(sc, to.x + back.x * 8, to.y + back.y * 8 - 2, back.x, PAL.water3, 300);
      else if (!target.posed) {
        const s = target.sprite;
        const r = target.rest0;
        const away = norm(sub(to, from));
        sc.tweens.killTweensOf(s);
        s.setPosition(r.x + Math.sign(Math.round(away.x * 1.5)), r.y);
        void wait(sc, 110).then(() => {
          if (s.active && !target.posed) s.setPosition(r.x, r.y);
        });
      }
    } else if (tTile && tTile.active && !tTile.faceUp) void tTile.pulse(PLAYER_COLOR[ev.player], 280);
    else if (ev.targetUid === null) void duelist(ctx, defender)?.jolt();
  });

  let marksGone = false;
  const dropMarks = () => {
    if (marksGone) return;
    marksGone = true;
    arrow.destroy();
    lock.destroy();
    void aimLight.fadeOut(160);
  };
  let released = false;
  /** Ends the held charge's tremble (keepCharging) — before anything else takes the sprite. */
  let stopCharging: (() => void) | null = null;
  const settleCharge = () => {
    stopCharging?.();
    stopCharging = null;
  };
  /** Back to the idle / guard loop unless something else already took the sprite. */
  const unpose = () => {
    if (!attacker) return;
    attacker.posed = false;
    if (attacker.retired || !attacker.sprite.active) return;
    if (attacker.frameInfo().anim === 'attack' && !attacker.sprite.anims.isPlaying) attacker.rest();
  };
  const hold: AttackHold & HandOver = {
    kind: 'attackHold',
    attackerUid: ev.attackerUid,
    targetUid: ev.targetUid,
    player: ev.player,
    from,
    to,
    dropMarks,
    handOver() {
      if (released) return;
      released = true;
      settleCharge();
      if (attacker) attacker.posed = false;
      // (the charge sound goes on: the strike takes it over, _v3/sound.ts takeCharge)
    },
    shatterMarks() {
      if (marksGone) return;
      const sp = new Sparks(sc, DEPTH.FX_TOP + 1);
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - Math.min(46, Math.max(14, Math.hypot(to.x - from.x, to.y - from.y) * 0.32)) };
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const u = 1 - t;
        const p = { x: u * u * from.x + 2 * u * t * mid.x + t * t * to.x, y: u * u * from.y + 2 * u * t * mid.y + t * t * to.y };
        sp.add({ x: p.x, y: p.y, vx: rr(-40, 40), vy: rr(-50, 10), ay: 240, drag: 1.5, life: rr(220, 420), ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], tex: rnd() < 0.3 ? 'fx:px2' : 'fx:px1' });
      }
      sp.burst(10, () => {
        const a = rr(0, TAU);
        return { x: to.x, y: to.y, vx: Math.cos(a) * rr(50, 110), vy: Math.sin(a) * rr(50, 110), drag: 3, life: rr(200, 360), ramp: [PAL.white, ramp[4], ramp[3]], tex: 'fx:plus' };
      });
      sp.close();
      void lightFlash(sc, to.x, to.y, ramp[3], 30, 260, { floorY: to.y + 16, intensity: 0.7 });
      dropMarks();
    },
    // the strike starts from this very pose (its attack anim plays on in the same frame): no
    // tween back; anything that does not take the sprite gets the idle / guard loop back
    async release() {
      if (released) return;
      released = true;
      settleCharge();
      unpose();
      if (attacker) dropCharge(attacker);
    },
    destroy() {
      dropMarks();
      if (!released) {
        released = true;
        settleCharge();
        unpose();
        if (attacker) dropCharge(attacker);
      }
    },
  };
  ctx.keep('attack', hold);
  // held past the declaration (a flip, a trap prompt, the defender's decision): the charge stays alive
  if (attacker) void posed.then(() => (stopCharging = released ? null : keepCharging(sc, attacker)));
  // the reticle snaps at ~230 ms; the declaration never runs past the budget
  await Promise.race([Promise.all([lock.done, posed]), wait(sc, DECLARE_MAX_MS - 50)]);
}

/** Holds of the held charge's tremble (ms): the charge pose, the tenser frame, … — uneven, never a metronome. */
const CHARGE_HOLDS = [150, 80, 130, 70, 170, 90] as const;
/** The tremble starts once the charge has held this long (a battle that goes on at once never sees it). */
const CHARGE_IDLE_MS = 140;

/**
 * The declaration's charge pose while the attack is held (A2 fix: a frozen frame for 0.7–0.8 s
 * through a flip or a trap prompt broke "nothing is ever static"): a two-frame tremble between the
 * charge pose and the next wind-up frame (art with a `charge` mark; the old monsters breathe one
 * whole pixel instead), and on each tenser beat the charge light pulses at the muzzle / staff orb
 * (the stepped light layer). Stops the moment the hold is handed over or released, or when
 * anything else takes the sprite.
 */
function keepCharging(sc: Phaser.Scene, u: MonsterUnit): () => void {
  const f = declarePoseFrame(u);
  const spec = u.spec('attack');
  // the drawn charge pair alternates only when it is a tremble: a pair more than 2 × idleΔ apart
  // (the wyrm's 3.5 ×, the magus's 4.2 ×: the whole staff / head swings) reads as pumping, so the
  // frame holds and only the breath and the light pulse run (A2 motion review r2 #8)
  const idle = idleDelta(u);
  const pair = frameDelta(u, `attack:${f}`, `attack:${f + 1}`);
  const small = idle !== null && pair !== null && pair / idle <= 2;
  const tremble = typeof spec?.marks?.charge === 'number' && f + 1 < u.impactFrame && small;
  const s = u.sprite;
  const y0 = s.y;
  const color = strikeLight(u.cardId) ?? PLAYER_RAMP[u.player][3];
  let el = 0;
  let next = CHARGE_IDLE_MS;
  let k = 0;
  const shows = () => {
    const fi = u.frameInfo();
    return fi.anim === 'attack' && !s.anims.isPlaying && (fi.frame === f || fi.frame === f + 1);
  };
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (!s.active || u.retired) return;
    // the tremble's frame stays (a strike continues forward from it: strikeStartFrame); the
    // breath goes back to its whole-pixel rest line
    if (!tremble && s.y === y0 - 1) s.setY(y0);
  };
  onFrame(sc, (dt) => {
    if (stopped) return false;
    if (u.retired || !s.active || !shows()) {
      stopped = true;
      return false;
    }
    el += dt;
    if (el < next) return true;
    k++;
    const tense = k % 2 === 1;
    if (tremble) u.pose('attack', tense ? f + 1 : f);
    // the 1-px breath only for a body that floats (a grounded one keeps its feet planted)
    else if (u.art.hover > 0 || !u.has('death')) s.setY(tense ? y0 - 1 : y0);
    if (tense) {
      // the charge gathers at the point the strike will leave from
      const fi = u.frameInfo();
      const pts = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame) : undefined;
      const fp = pts?.staff ?? pts?.muzzle ?? u.art.muzzle;
      const p = u.framePoint(fp.x, fp.y);
      void lightFlash(sc, Math.round(p.x), Math.round(p.y), color, 14, 150, { floorY: u.home.y, intensity: 0.55 });
    }
    next = el + CHARGE_HOLDS[(k - 1) % CHARGE_HOLDS.length];
    return true;
  });
  return stop;
}

// ================================================================ attackNegated, the v3 look

/**
 * A negated attack without its own card presentation, v3 (A0 §6.2 item 10; the bound chains play
 * their own): the arrow breaks, the attacker is stopped in front of its tile — a clang, its own
 * recoil, a whole-pixel shove and spring back (no scale) — and the short result plate drops out
 * from under the phase bar ("SAVAŞ BİTTİ"; never a full-width band).
 */
async function attackNegatedV3(ctx: Ctx<'attackNegated'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const { hold, other: kept } = takeAttack(ctx);
  kept?.destroy();
  hold?.shatterMarks();
  const u = live(ctx.unit(ev.attackerUid));
  if (u && u.sprite.active) {
    // the hold hands the pose over (no trip back to idle first): the recoil plays from it
    if (canHandOver(hold)) hold.handOver();
    else hold?.destroy();
    const s = u.sprite;
    const r = u.rest0;
    const back = u.player === 0 ? { x: -1, y: 0.5 } : { x: 1, y: -0.5 };
    const c = u.core();
    void blockClang(sc, Math.round(c.x - back.x * 8), Math.round(c.y - back.y * 8), { from: { x: c.x - back.x * 30, y: c.y - back.y * 30 }, color: PAL.mag3 });
    void lightFlash(sc, Math.round(c.x), u.home.y, PAL.mag3, 32, 320, { floorY: u.home.y, ring: true });
    u.posed = true;
    sc.tweens.killTweensOf(s);
    s.setPosition(r.x, r.y);
    void u.play('hit', { dir: { x: back.x, y: back.y } });
    await run(sc, 70, (t) => s.active && s.setPosition(Math.round(r.x + back.x * 4 * t), Math.round(r.y + back.y * 2 * t)));
    await run(sc, 220, (t) => {
      const k = 1 - E.outCubic(t);
      if (s.active) s.setPosition(Math.round(r.x + back.x * 4 * k), Math.round(r.y + back.y * 2 * k));
    });
    if (s.active) s.setPosition(r.x, r.y);
    u.posed = false;
  } else hold?.destroy();
  void ctx.unfocus(260);
  void arenaDim(sc, 0, 420);
  ctx.log('Saldırı geçersiz kılındı!', PAL.mag3);
  await resultPlate(sc, 'SAVAŞ BİTTİ');
}
