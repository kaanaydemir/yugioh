// Kadran Soytarısı (dial_jester, lane D, C2) — the effect, the coin toss and the rewind wipe (?look=v3 only;
// YENI_KARTLAR §C2 "İmza an — Yazı-Tura" steps 1–5; owner decision: once per TURN). Replaces the batch-2
// placeholder `coinToss` (src/cinematics/b2/placeholders.ts) and takes the jester's `massDestroy` (any other source,
// e.g. void_eye of lane E, falls through to its own handler / the placeholder).
//
// Events: activate(jester, monsterEffect) → decision coinCall (the YAZI / TURA prompt, not ours) → coinToss{call,
// result, win} → massDestroy{refs} → destroy + toGraveyard per monster (+ damage{ΣATK/2} on a lose).
//
// effect     the coin is presented: two cranks of the key, the dial whirls (jesterActivate), a dial is reflected
//            under the jester (hands whirling) and its special pose holds the coin on the thumb (f0–f3)
// coinToss   1. the CALL: the called face's word pops over the jester and blinks in the player's colour
//            2. the world dims, a giant faint dial ring settles over the whole arena (its 12 points at the
//               opponent); the thumb flicks the coin (special f5, jesterFlick) — a short slow motion — the coin
//               spins through 8 pixel frames (heads / edge / tails / edge) in a high arc (jesterSpin) while the
//               dial's hands race (jesterHandsRace)
//            3. it lands on the board, bounces twice ("tın" 3.1 kHz, "tın" 2.9 kHz), lies down rocking on its rim
//               like Euler's disk (jesterWobble) and stands up showing its face + the word (jesterReveal)
//            the result: win → the hands strike 12 on the opponent's side (jesterWin, "BİLDİ!");
//                        lose → the hands start spinning backwards on the own side (jesterLose, "BİLEMEDİ!")
// massDestroy 4/5. the REWIND (jesterRewind): every doomed monster plays its own summon BACKWARDS fast with gold
//            echoes over a little floor dial whose hands run back, a gold card rectangle closes round it and lies
//            down on the tile (jesterFold); win: the card spins (face / edge / back / edge frames) off to its
//            graveyard (jesterCardWhirl), no dust; lose: the cards sweep along the arena dial's hand into the own
//            LP panel (jesterLpHit) where the damage number pours out, then drop onto the graveyard; on a win the
//            coin hops back into the jester's hand.
// Camera never moves (EF-8): the push-in is the dim, the dial and the floor light.

import type Phaser from 'phaser';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, zoneXY, type XY } from '../../view/layout';
import { lightDim, lightFlash, lightPool, type LightHandle } from '../../view/light';
import type { TileCard } from '../../view/TileCard';
import { pixelText } from '../../ui/text';
import { shake } from '../../vfx/core';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { Raster } from '../../vfx/setpieces';
import { registerCardHook, registerEvent, type CinematicContext } from '../api';
import { lpPoint } from '../_core/helpers';
import { warmPoses } from '../_v3/warm';
import { panAt, play, start } from '../_v3/sound';
import { worldBox } from '../strikes-b/_kit';
import { afterimage } from '../summon-a/_kit';
import { SPIN_W, arenaDial, blitCoin, flatCoin, foldRect, jesterPoint, rewindRing, seedFx, spinCard, tileDial, type ArenaDial } from './_dial_jester-fx';

const ID = 'dial_jester';
type Ctx<T extends GameEvent['type']> = CinematicContext<Extract<GameEvent, { type: T }>>;
type Face = 'heads' | 'tails';
const faceWord = (f: Face): string => (f === 'heads' ? 'TURA' : 'YAZI');
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const R = Math.round;

// ================================================================ the show handed from beat to beat

interface Show {
  dial: ArenaDial | null;
  /** the dial reflected under the jester (effect → toss) */
  under: { set(s: { k: number; hour: number; min: number; hot?: number }): void; destroy(): void } | null;
  underStop: (() => void) | null;
  pool: LightHandle | null;
  coin: Raster | null;
  /** where the coin lies */
  coinAt: XY | null;
  face: Face;
  words: Phaser.GameObjects.BitmapText[];
  win: boolean;
  /** the hands' motion: 'race' clockwise, 'strike' at 12, 'back' wildly backwards */
  mode: 'idle' | 'race' | 'strike' | 'back';
  stopHands: (() => void) | null;
  dimmed: boolean;
}
let show: Show | null = null;

function newShow(): Show {
  return { dial: null, under: null, underStop: null, pool: null, coin: null, coinAt: null, face: 'tails', words: [], win: false, mode: 'idle', stopHands: null, dimmed: false };
}

function disposeUnder(s: Show): void {
  s.underStop?.();
  s.underStop = null;
  s.under?.destroy();
  s.under = null;
}

function dispose(sc: Phaser.Scene, s: Show): void {
  disposeUnder(s);
  s.stopHands?.();
  s.dial?.destroy();
  s.coin?.destroy();
  void s.pool?.fadeOut(200);
  for (const w of s.words) if (w.active) w.destroy();
  if (s.dimmed) void lightDim(sc, 0, 420);
  if (show === s) show = null;
}

/** The hands of the arena dial move by the show's mode every frame. */
function driveHands(sc: Phaser.Scene, s: Show): void {
  s.stopHands?.();
  s.stopHands = onFrame(sc, (dt) => {
    const d = s.dial;
    if (!d) return false;
    if (s.mode === 'race') {
      d.min = (d.min + dt * 0.95) % 360;
      d.hour = (d.hour + dt * 0.11) % 360;
    } else if (s.mode === 'back') {
      d.min = (d.min - dt * 1.6 + 720) % 360;
      d.hour = (d.hour - dt * 0.4 + 720) % 360;
    }
    return true;
  });
}

/** A word that pops over a point (whole px) and is kept until the show ends. */
function word(sc: Phaser.Scene, at: XY, text: string, color: number): Phaser.GameObjects.BitmapText {
  return pixelText(sc, R(at.x), R(at.y), text, { size: 'md', color }).setOrigin(0.5, 1).setDepth(DEPTH.FX_TOP);
}

// ================================================================ effect: the coin presented

registerCardHook(
  ID,
  'effect',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    const u = ctx.unit(ev.uid);
    if (ev.from !== 'monster' || !u || !u.sprite.visible) return ctx.base();
    const sc = ctx.scene;
    if (show) dispose(sc, show);
    const s = newShow();
    show = s;
    seedFx(ev.uid * 13 + 5);
    const pan = panAt(u.home.x);
    play('jesterActivate', { volume: 0.9, pan });
    s.under = tileDial(sc, u.home, undefined, 1);
    s.pool = lightPool(sc, u.home.x, u.home.y - 18, { color: PAL.gold4, spill: PAL.gold3, radius: 26, floorY: u.home.y, air: 0.5, intensity: 0.9, anim: 'breathe', fadeIn: 160 });
    // the reflected dial: its hands whirl up as the key is cranked, then tick (kept until the toss takes over)
    s.underStop = onFrame(sc, (_dt, el) => {
      if (!s.under) return false;
      const k = Math.min(1, el / 200);
      const spin = el < 520 ? el * el * 0.0024 : 650 + (el - 520) * 0.36;
      s.under.set({ k, hour: (300 + spin * 0.25) % 360, min: (60 + spin) % 360, hot: el > 500 && el < 560 ? 1 : 0 });
      // safety: a dial left over by a toss that never came
      if (el > 20000) {
        disposeUnder(s);
        return false;
      }
      return true;
    });
    await u.playRange('special', 0, 3, { hold: true });
    // the coin on the thumb glints
    const c = jesterPoint(u, 'coin');
    if (c) {
      const sp = new Sparks(sc, u.sprite.depth + 0.5);
      sp.add({ x: c.x, y: c.y - 3, life: 240, colors: [PAL.white, PAL.gold4], shape: 'star', size: 3, fadeAt: 0.7 });
      sp.release();
    }
    await sleep(sc, 120);
  },
  { priority: 20, name: 'd:dial_jester:effect' },
);

// ================================================================ the coin toss

registerEvent(
  'coinToss',
  async (ctx: Ctx<'coinToss'>) => {
    const ev = ctx.ev;
    if (!LOOK_V3 || ctx.cardId(ev.sourceUid) !== ID) return ctx.base();
    const sc = ctx.scene;
    const field = ctx.views.field;
    const s = show ?? newShow();
    show = s;
    s.face = ev.result;
    s.win = ev.win;
    seedFx(ev.sourceUid * 17 + (ev.win ? 1 : 2));
    const own = ev.player;
    const opp: PlayerId = own === 0 ? 1 : 0;
    const u = ctx.unit(ev.sourceUid);
    const home = u ? u.home : zoneXY(own, 'monster', 2);
    const pan = panAt(home.x);
    // the wipe will rewind these bodies through their own summon: paint those poses now
    const mi = ctx.findType('massDestroy', (e) => e.sourceUid === ev.sourceUid);
    if (mi >= 0) {
      for (const r of (ctx.events[mi] as Extract<GameEvent, { type: 'massDestroy' }>).refs) {
        if (r.zone !== 'monster') continue;
        const mu = field.unitAt(r.player, r.index);
        if (mu) warmPoses(mu.cardId, mu.player, ['summon']);
      }
    }
    // ---- 1. the call: the called face's word blinks in the player's colour over the jester
    const top = u ? (jesterPoint(u, 'head') ?? u.core()) : { x: home.x, y: home.y - 40 };
    const call = word(sc, { x: top.x, y: top.y - 18 }, `${faceWord(ev.call)}!`, PLAYER_COLOR[own]);
    s.words.push(call);
    void animate(sc, 360, (_t, el) => call.active && call.setTint(Math.floor(el / 60) % 2 ? PAL.white : PLAYER_COLOR[own]));
    play('jesterReveal', { volume: 0.5, pan, pitch: 1.2 });
    // ---- 2. the world dims, the arena dial settles, the flick
    s.dimmed = true;
    void lightDim(sc, 0.4, 260);
    const dial = s.dial ?? arenaDial(sc, opp);
    s.dial = dial;
    dial.hour = 300;
    dial.min = 60;
    driveHands(sc, s);
    void animate(sc, 320, (t) => (dial.k = Math.max(dial.k, t * 0.75)));
    let c0: XY = { x: home.x + (own === 0 ? 10 : -10), y: home.y - 50 };
    if (u && u.sprite.active && u.has('special')) {
      const fi = u.frameInfo();
      const from = fi.anim === 'special' && fi.frame <= 4 ? fi.frame + 1 : 2;
      await u.playRange('special', from, 5, { hold: true });
      c0 = jesterPoint(u, 'coin') ?? c0;
      u.pose('special', 6);
    } else await sleep(sc, 200);
    disposeUnder(s);
    play('jesterFlick', { volume: 0.95, pan });
    const spin = start('jesterSpin', { volume: 0.75, pan });
    const race = start('jesterHandsRace', { volume: 0.6 });
    s.mode = 'race';
    ctx.views.speed.slowMo(0.35, 260);
    // the coin's own raster (over everything on the board, under the HUD)
    const coinR = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 6);
    s.coin = coinR;
    // it lands on the bridge in the jester's lane (between the two monster rows: always empty marble)
    const lane = u ? u.zone : 2;
    const across = zoneXY(opp, 'monster', lane);
    const L: XY = { x: R(lerp(home.x, across.x, 0.5)), y: R(lerp(home.y, across.y, 0.5)) };
    const peakUp = Math.min(70, c0.y - 26);
    const glow = lightPool(sc, c0.x, c0.y, { color: PAL.gold4, radius: 12, air: 0.9, floorY: home.y, intensity: 0.7, fadeIn: 60 });
    s.pool?.setIntensity(0.4, 200);
    const FLY = 700;
    // a parabola from c0 to L whose apex is about peakUp above c0
    const A = peakUp + Math.max(0, L.y - c0.y) * 0.5;
    await animate(sc, FLY, (t, el) => {
      const x = lerp(c0.x, L.x, t);
      const y = lerp(c0.y, L.y, t) - 4 * A * t * (1 - t);
      const floorY = lerp(home.y, L.y, t);
      const ph = Math.floor(el / 36) % 8;
      coinR.draw((g) => {
        // its shadow on the marble grows as it falls
        const k = 1 - Math.min(1, (floorY - y) / 90);
        const sr = R(2 + k * 4);
        for (let dx = -sr; dx <= sr; dx += 2) g.px(R(x) + dx, R(floorY), PAL.ink);
        blitCoin(g, x, y, SPIN_W[ph], 6);
      });
      glow.setPosition(R(x), R(y), floorY);
    });
    // ---- 3. it lands, bounces twice, rocks on its rim and shows its face
    spin.stop(30);
    play('jesterTin1', { volume: 0.95, pan: panAt(L.x) });
    void lightFlash(sc, L.x, L.y, PAL.gold4, 16, 160, { floorY: L.y, intensity: 0.7 });
    tinSparks(sc, L);
    const drift = own === 0 ? 3 : -3;
    await hop(sc, coinR, L, { x: L.x + drift, y: L.y + 1 }, 13, 200, glow);
    play('jesterTin2', { volume: 0.8, pan: panAt(L.x) });
    tinSparks(sc, { x: L.x + drift, y: L.y + 1 });
    const L2 = { x: L.x + drift * 2, y: L.y + 2 };
    await hop(sc, coinR, { x: L.x + drift, y: L.y + 1 }, L2, 5, 120, glow);
    play('jesterWobble', { volume: 0.85, pan: panAt(L2.x) });
    let ph = 0;
    await animate(sc, 380, (t, _el, dt) => {
      ph += dt * (0.025 + t * 0.075);
      coinR.draw((g) => flatCoin(g, L2.x, L2.y, 6, 1 - t, ph));
    });
    s.coinAt = L2;
    race.stop(60);
    // the face: the coin stands up out of its rest, face-on, a word over it
    play('jesterReveal', { volume: 0.95, pan: panAt(L2.x) });
    const w = ev.result === 'heads' ? 1 : -1;
    await animate(sc, 200, (t) => {
      const st = Math.min(3, Math.floor(t * 4));
      coinR.draw((g) => {
        if (st === 0) flatCoin(g, L2.x, L2.y, 6, 0, 0, 1);
        else blitCoin(g, L2.x, L2.y - 4 - st * 3, st === 1 ? w * 0.5 : w, 7);
      });
    });
    const coinTop = { x: L2.x, y: L2.y - 13 };
    void lightFlash(sc, coinTop.x, coinTop.y, PAL.white, 18, 220, { floorY: L2.y, intensity: 0.8 });
    glow.setPosition(coinTop.x, coinTop.y, L2.y);
    s.words.push(word(sc, { x: coinTop.x, y: coinTop.y - 9 }, faceWord(ev.result), PAL.gold4));
    // the result
    const res = word(sc, { x: coinTop.x, y: coinTop.y - 20 }, ev.win ? 'BİLDİ!' : 'BİLEMEDİ!', ev.win ? PAL.white : PAL.crim4);
    s.words.push(res);
    if (call.active) call.destroy();
    if (ev.win) {
      // the hands strike 12 on the opponent's side
      s.mode = 'strike';
      const h0 = dial.hour;
      const m0 = dial.min;
      void animate(sc, 110, (t) => {
        dial.hour = lerp(h0, h0 > 180 ? 360 : 0, t) % 360;
        dial.min = lerp(m0, m0 > 180 ? 360 : 0, t) % 360;
      }).then(() => {
        dial.hot = 1;
        dial.glowAt = 0;
        dial.k = 1;
        const p12 = dial.at(0, 0.9);
        void lightFlash(sc, p12.x, p12.y, PAL.gold4, 40, 320, { floorY: p12.y, intensity: 0.9 });
        void shake(sc, 70, 1);
      });
      play('jesterWin', { volume: 0.95 });
    } else {
      s.mode = 'back';
      dial.glowAt = 180;
      dial.k = 1;
      play('jesterLose', { volume: 0.95 });
      void shake(sc, 90, 1);
    }
    void animate(sc, 300, (_t, el) => res.active && res.setTint(Math.floor(el / 70) % 2 ? (ev.win ? PAL.gold4 : PAL.crim3) : ev.win ? PAL.white : PAL.crim4));
    await sleep(sc, 300);
    void glow.fadeOut(300);
    // no wipe follows (nothing to destroy): the show ends here
    if (mi < 0) {
      await coinHome(sc, s, u);
      dispose(sc, s);
    }
  },
  { priority: 20, name: 'd:dial_jester:coinToss' },
);

/** Gold ticks off the coin's landing. */
function tinSparks(sc: Phaser.Scene, at: XY): void {
  const sp = new Sparks(sc, DEPTH.FX + 5);
  for (let i = 0; i < 6; i++) sp.add({ x: at.x, y: at.y, vx: (i - 2.5) * 22, vy: -40 - (i % 3) * 18, ay: 260, life: 220, colors: [PAL.white, PAL.gold4, PAL.gold3], shape: 'px', fadeAt: 1 });
  sp.release();
}

/** One bounce of the landed coin (`h` px high), spinning slowly on the way. */
function hop(sc: Phaser.Scene, r: Raster, a: XY, b: XY, h: number, ms: number, glow: LightHandle): Promise<void> {
  return animate(sc, ms, (t, el) => {
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * h;
    const ph = Math.floor(el / 55) % 8;
    r.draw((g) => {
      for (let dx = -4; dx <= 4; dx += 2) g.px(R(x) + dx, R(lerp(a.y, b.y, t)), PAL.ink);
      blitCoin(g, x, y - 5, SPIN_W[ph], 6);
    });
    glow.setPosition(R(x), R(y - 5), R(lerp(a.y, b.y, t)));
  });
}

/** Win: the coin hops back into the jester's hand and the special pose closes on it (f8 → idle). */
async function coinHome(sc: Phaser.Scene, s: Show, u: MonsterUnit | null): Promise<void> {
  const r = s.coin;
  const a = s.coinAt;
  if (!r || !a) return;
  if (!u || !u.sprite.active || u.retired || !u.sprite.visible) {
    r.destroy();
    s.coin = null;
    return;
  }
  const hand = jesterPoint(u, 'hand') ?? u.core();
  play('jesterBow', { volume: 0.6, pan: panAt(hand.x), pitch: 1.1 });
  await animate(sc, 240, (t, el) => {
    const x = lerp(a.x, hand.x, t);
    const y = lerp(a.y - 13, hand.y - 4, t) - Math.sin(Math.PI * t) * 20;
    r.draw((g) => blitCoin(g, x, y, SPIN_W[Math.floor(el / 40) % 8], 6));
  });
  r.destroy();
  s.coin = null;
  if (u.sprite.active && !u.retired) void u.playRange('special', 8);
}

// ================================================================ the rewind wipe

interface Doomed {
  uid: Uid;
  owner: PlayerId;
  cardId: Extract<GameEvent, { type: 'destroy' }>['cardId'];
  zone: number;
}

registerEvent(
  'massDestroy',
  async (ctx: Ctx<'massDestroy'>) => {
    const ev = ctx.ev;
    if (!LOOK_V3 || ev.sourceUid === null || ctx.cardId(ev.sourceUid) !== ID) return ctx.base();
    const sc = ctx.scene;
    const field = ctx.views.field;
    const s = show ?? newShow();
    show = s;
    const own = ev.player;
    const win = ev.refs.length ? ev.refs[0].player !== own : s.win;
    if (!s.dial) {
      s.dial = arenaDial(sc, win ? (own === 0 ? 1 : 0) : own);
      s.dial.k = 0.8;
      s.mode = win ? 'strike' : 'back';
      driveHands(sc, s);
    }
    if (!s.dimmed) {
      s.dimmed = true;
      void lightDim(sc, 0.4, 200);
    }
    const dial = s.dial;
    // ---- the doomed: this source's monster destroys (+ their graveyard moves) are ours
    const doomed: Doomed[] = [];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (ctx.isConsumed(i)) continue;
      if (e.type === 'destroy' && e.sourceUid === ev.sourceUid && e.location === 'monster') {
        ctx.consumeAt(i);
        const gi = ctx.findType('toGraveyard', (g) => g.uid === e.uid);
        const g = gi >= 0 ? (ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>) : null;
        if (gi >= 0) ctx.consumeAt(gi);
        doomed.push({ uid: e.uid, owner: g ? g.owner : e.player, cardId: e.cardId, zone: e.zone });
      } else if (e.type !== 'destroy' && e.type !== 'toGraveyard' && e.type !== 'tokenVanish' && e.type !== 'damage') break;
    }
    const di = ctx.findType('damage', (e) => e.sourceUid === ev.sourceUid && e.source === 'effect');
    seedFx((ev.sourceUid ?? 1) * 7 + doomed.length);
    const rew = start('jesterRewind', { volume: 0.85 });
    // lose: the coin on the board loses its shine and is gone (its jester is rewinding too)
    if (!win && s.coin) {
      const cr = s.coin;
      const at = s.coinAt;
      s.coin = null;
      if (at) void animate(sc, 220, (t) => cr.draw((g) => (t < 0.66 ? flatCoin(g, at.x, at.y, 6, 0, 0) : undefined))).then(() => cr.destroy());
      else cr.destroy();
    }
    for (const w of s.words) {
      const ww = w;
      if (ww.active) void animate(sc, 200, (t) => ww.active && ww.setAlpha(t < 0.5 ? 1 : 0.5)).then(() => ww.destroy());
    }
    s.words = [];
    // ---- each body rewinds into its card (staggered), then the card leaves
    const lp = lpPoint(ctx, own);
    let hitPlayed = false;
    let dmg: Promise<void> = Promise.resolve();
    const lpHit = () => {
      if (hitPlayed) return;
      hitPlayed = true;
      play('jesterLpHit', { volume: 0.95, pan: panAt(lp.x) });
      void lightFlash(sc, lp.x, lp.y, PAL.crim3, 34, 300, { intensity: 0.9 });
      void shake(sc, 140, 2);
      if (di >= 0) dmg = ctx.play(di, { delivered: true });
    };
    const jobs = doomed.map((d, i) => rewindOne(ctx, s, d, { delay: i * 90, win, lp, onPanel: lpHit, dial }));
    await Promise.all(jobs);
    rew.stop(120);
    if (!win) lpHit();
    await dmg;
    // ---- the end: the coin goes home (win), the dial fades, the light returns
    const ju = ctx.unit(ev.sourceUid);
    if (win) await coinHome(sc, s, ju);
    s.mode = 'idle';
    dial.hot = 0;
    dial.glowAt = null;
    await animate(sc, 260, (t) => (dial.k = 1 - t));
    dispose(sc, s);
  },
  { priority: 20, name: 'd:dial_jester:massDestroy' },
);

/** One doomed monster: its summon played backwards with gold echoes, the card rectangle, the card's flight. */
async function rewindOne(ctx: Ctx<'massDestroy'>, s: Show, d: Doomed, o: { delay: number; win: boolean; lp: XY; onPanel: () => void; dial: ArenaDial }): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  if (o.delay) await sleep(sc, o.delay);
  const u = field.unit(d.uid);
  const { tile, unit } = field.release(d.uid);
  const home: XY = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(d.owner, 'monster', d.zone);
  const pan = panAt(home.x);
  const body = unit ?? u;
  const live = !!body && !body.retired && body.sprite.active && body.sprite.visible;
  if (body) {
    body.badge.setVisible(false);
    body.posed = true;
  }
  void rewindRing(sc, home, 560);
  if (live && body) {
    const box = worldBox(body);
    const n = body.has('summon') ? body.frameCount('summon') : 0;
    const step = n ? Math.max(22, Math.min(40, Math.round(380 / n))) : 0;
    const fold = sleep(sc, Math.round(n * step * 0.45)).then(() => foldRect(sc, box, home, 300, body.sprite.depth + 0.6));
    if (n) {
      for (let f = n - 1; f >= 0; f--) {
        if (!body.sprite.active) break;
        body.pose('summon', f);
        if (f % 3 === 1) afterimage(sc, body.sprite, PAL.gold2, { alpha: 0.3, ms: 100, depth: body.sprite.depth - 0.2 });
        await sleep(sc, step);
      }
    } else {
      // no summon pose (an old art): it is drawn down into the card in two gold echoes
      afterimage(sc, body.sprite, PAL.gold3, { alpha: 0.6, ms: 180, depth: body.sprite.depth + 0.2 });
      await sleep(sc, 90);
    }
    if (body.sprite.active) body.sprite.setVisible(false);
    play('jesterFold', { volume: 0.8, pan });
    await fold;
    body.retire(0);
  } else {
    body?.retire(0);
    play('jesterFold', { volume: 0.6, pan });
  }
  field.forget(d.uid);
  // a face-down card shows its face before it goes
  if (tile && tile.active && !tile.faceUp) {
    tile.setCard(d.cardId);
    await tile.flipUp(160);
  }
  void lightFlash(sc, home.x, home.y, PAL.gold4, 18, 160, { floorY: home.y, intensity: 0.6 });
  play('jesterCardWhirl', { volume: 0.75, pan });
  if (o.win) {
    const to = ctx.views.field.pile(d.owner, 'graveyard').topXY();
    const arc = Math.min(40, 16 + Math.hypot(to.x - home.x, to.y - home.y) * 0.12);
    await spinCard(ctx, {
      owner: d.owner,
      cardId: d.cardId,
      from: home,
      tile: tile as TileCard | null,
      ms: 440,
      land: true,
      path: (t) => ({ x: lerp(home.x, to.x, t), y: lerp(home.y, to.y, t) - Math.sin(Math.PI * t) * arc - 6 * (1 - t) }),
    });
    return;
  }
  // lose: the card sweeps along the arena dial's hand into the own LP panel, the hand following it
  const c = o.dial.center;
  const a0 = Math.atan2((home.x - c.x) / 2, home.y - c.y);
  const a1raw = Math.atan2((o.lp.x - c.x) / 2, o.lp.y - c.y);
  // backwards (the rewind's sense): the long way round when the short way would be forwards
  let a1 = a1raw;
  while (a1 > a0) a1 -= Math.PI * 2;
  if (a0 - a1 > Math.PI * 1.4) a1 += Math.PI * 2;
  const r0 = Math.hypot((home.x - c.x) / 2, home.y - c.y);
  const r1 = Math.hypot((o.lp.x - c.x) / 2, o.lp.y - c.y);
  const path = (t: number): XY => {
    const a = lerp(a0, a1, t);
    const rr = lerp(r0, r1, t);
    return { x: c.x + Math.sin(a) * rr * 2, y: c.y + Math.cos(a) * rr };
  };
  await spinCard(ctx, {
    owner: d.owner,
    cardId: d.cardId,
    from: home,
    tile: tile as TileCard | null,
    ms: 460,
    depth: DEPTH.HUD + 6,
    trail: [PAL.white, PAL.crim4, PAL.gold3],
    path,
  });
  o.onPanel();
  // then it drops off the panel onto its graveyard
  const to = ctx.views.field.pile(d.owner, 'graveyard').topXY();
  await spinCard(ctx, {
    owner: d.owner,
    cardId: d.cardId,
    from: o.lp,
    ms: 230,
    rate: 8,
    land: true,
    path: (t) => ({ x: lerp(o.lp.x, to.x, t), y: lerp(o.lp.y, to.y, t) - Math.sin(Math.PI * t) * 14 }),
  });
  void s;
}
