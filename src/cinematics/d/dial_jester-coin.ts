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
import { DEPTH, LOOK_V3, forward, panelRect, zoneXY, type XY } from '../../view/layout';
import { lightDim, lightFlash, lightPool, type LightHandle } from '../../view/light';
import type { TileCard } from '../../view/TileCard';
import { measureText, pixelText } from '../../ui/text';
import { SP_CATCH, SP_WATCH } from '../../art/monsters-v3/dial_jester-anims';
import { shake } from '../../vfx/core';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { Raster } from '../../vfx/setpieces';
import { registerCardHook, registerEvent, type CinematicContext } from '../api';
import { lpPoint } from '../_core/helpers';
import { warmPoses } from '../_v3/warm';
import { rewindAnims, rewindSfx } from '../../art/variants';
import { variantOf } from '../../duel/unit-variant';
import { panAt, play, start } from '../_v3/sound';
import { worldBox } from '../strikes-b/_kit';
import { afterimage } from '../summon-a/_kit';
import { SPIN_W, arenaDial, blitCoin, coinCanvas, flatCoin, foldRect, jesterOffset, jesterPoint, rewindBody, rewindRing, rimLight, seedFx, spinCard, tileDial, type ArenaDial } from './_dial_jester-fx';

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
  /** the jester's living hold (watching loop / dismay loop) */
  watch: (() => void) | null;
  /** the jester's reaction to the result (cheer / dismay), awaited before the show ends */
  react: Promise<void>;
  /** the jester lifted over its neighbours for the toss (its spotlight); restored when the show ends */
  lifted: MonsterUnit | null;
  /** the jester's rim light (a 1-px gold outline that pulses round it while it is lifted) */
  rimStop: (() => void) | null;
  /** other pieces the show owns (the face disc) */
  extras: { destroy(): void }[];
}
let show: Show | null = null;

function newShow(): Show {
  return { dial: null, under: null, underStop: null, pool: null, coin: null, coinAt: null, face: 'tails', words: [], win: false, mode: 'idle', stopHands: null, dimmed: false, watch: null, react: Promise.resolve(), lifted: null, rimStop: null, extras: [] };
}

function disposeUnder(s: Show): void {
  s.underStop?.();
  s.underStop = null;
  s.under?.destroy();
  s.under = null;
}

/** The jester steps into the spotlight: drawn over the units round it (the toss is its moment) with a pulsing rim. */
function liftJester(sc: Phaser.Scene, s: Show, u: MonsterUnit): void {
  if (s.lifted === u || !u.sprite.active) return;
  s.lifted = u;
  s.rimStop?.();
  s.rimStop = rimLight(sc, u, DEPTH.FX - 40.5);
}

function dropJester(s: Show): void {
  s.rimStop?.();
  s.rimStop = null;
  s.lifted = null;
}

function dispose(sc: Phaser.Scene, s: Show): void {
  dropJester(s);
  disposeUnder(s);
  stopWatch(s);
  s.stopHands?.();
  s.dial?.destroy();
  s.coin?.destroy();
  void s.pool?.fadeOut(200);
  for (const w of s.words) if (w.active) w.destroy();
  for (const x of s.extras) x.destroy();
  s.extras = [];
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
function word(sc: Phaser.Scene, at: XY, text: string, color: number, size: 'md' | 'lg' = 'md'): Phaser.GameObjects.BitmapText {
  return pixelText(sc, R(at.x), R(at.y), text, { size, color, outline: true }).setOrigin(0.5, 1).setDepth(DEPTH.FX_TOP);
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
    if (u && u.sprite.visible) liftJester(sc, s, u);
    // the wipe will rewind these bodies through their own summon: paint those poses now
    const mi = ctx.findType('massDestroy', (e) => e.sourceUid === ev.sourceUid);
    if (mi >= 0) {
      for (const r of (ctx.events[mi] as Extract<GameEvent, { type: 'massDestroy' }>).refs) {
        if (r.zone !== 'monster') continue;
        const mu = field.unitAt(r.player, r.index);
        if (mu) warmPoses(mu.cardId, mu.player, ['summon', 'special', 'attack', 'idle']);
      }
    }
    // ---- 1. the call: the called face's word blinks in the player's colour over the jester
    const top = u ? (jesterPoint(u, 'head') ?? u.core()) : { x: home.x, y: home.y - 40 };
    const call = word(sc, { x: top.x, y: top.y - 18 }, `${faceWord(ev.call)}!`, PLAYER_COLOR[own], 'lg');
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
      const from = fi.anim === 'special' && fi.frame <= 4 ? fi.frame + 1 : 3;
      await u.playRange('special', from, 5, { hold: true });
      c0 = jesterPoint(u, 'coin') ?? c0;
      u.pose('special', 6);
    } else await sleep(sc, 160);
    disposeUnder(s);
    play('jesterFlick', { volume: 0.95, pan });
    const spin = start('jesterSpin', { volume: 0.75, pan });
    const race = start('jesterHandsRace', { volume: 0.6 });
    s.mode = 'race';
    ctx.views.speed.slowMo(0.5, 160);
    // the jester watches its coin: its head follows the flight — up with it (f6), the spring-neck stretched at its
    // peak (W), dipping after it as it falls (W+1), crouched peeking in on the landing and the rocking (W+2 / W+1),
    // then craning up at the face as it rises (W) — picked by `watch` (the flight's phase), never a fixed loop
    stopWatch(s);
    let watch: (el: number) => number = () => 6;
    if (u && u.has('special')) {
      const uu = u;
      s.watch = onFrame(sc, (_dt, el) => {
        if (!uu.sprite.active || uu.retired) return false;
        const f = watch(el);
        if (uu.frameInfo().frame !== f || uu.frameInfo().anim !== 'special') uu.pose('special', f);
        return true;
      });
    }
    // the coin's own raster (over everything on the board, under the HUD)
    const coinR = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 6);
    s.coin = coinR;
    // it lands on clear marble in front of the jester (the strip between the two monster rows, nudged off every
    // body): never on an occupied tile, never behind a unit
    const lane = u ? u.zone : 2;
    const L = clearSpot(ctx, home, own, opp, lane);
    const peakUp = Math.min(70, c0.y - 24);
    const glow = lightPool(sc, c0.x, c0.y, { color: PAL.gold4, spill: PAL.gold3, radius: 18, air: 0.9, floorY: home.y, intensity: 0.85, fadeIn: 60 });
    s.pool?.setIntensity(0.4, 200);
    const FLY = 640;
    // a parabola from c0 to L whose apex is about peakUp above c0
    const A = peakUp + Math.max(0, L.y - c0.y) * 0.5;
    await animate(sc, FLY, (t, el) => {
      watch = () => (t < 0.28 ? 6 : t < 0.58 ? SP_WATCH : t < 0.86 ? SP_WATCH + 1 : SP_WATCH + 2);
      const x = lerp(c0.x, L.x, t);
      const y = lerp(c0.y, L.y, t) - 4 * A * t * (1 - t);
      const floorY = lerp(home.y, L.y, t);
      const ph = Math.floor(el / 40) % 8;
      coinR.draw((g) => {
        // its shadow on the marble grows as it falls
        const k = 1 - Math.min(1, (floorY - y) / 90);
        const sr = R(2 + k * 5);
        for (let dx = -sr; dx <= sr; dx += 2) g.px(R(x) + dx, R(floorY), PAL.ink);
        coinHalo(g, x, y, COIN_AIR + 3, el);
        blitCoin(g, x, y, SPIN_W[ph], COIN_AIR);
      });
      glow.setPosition(R(x), R(y), floorY);
    });
    // ---- 3. it lands, bounces twice, rocks on its rim and shows its face
    spin.stop(30);
    play('jesterTin1', { volume: 0.95, pan: panAt(L.x) });
    void lightFlash(sc, L.x, L.y, PAL.gold4, 20, 160, { floorY: L.y, intensity: 0.75 });
    tinSparks(sc, L);
    const drift = own === 0 ? 3 : -3;
    await hop(sc, coinR, L, { x: L.x + drift, y: L.y + 1 }, 14, 180, glow);
    play('jesterTin2', { volume: 0.8, pan: panAt(L.x) });
    tinSparks(sc, { x: L.x + drift, y: L.y + 1 });
    const L2 = { x: L.x + drift * 2, y: L.y + 2 };
    await hop(sc, coinR, { x: L.x + drift, y: L.y + 1 }, L2, 6, 110, glow);
    play('jesterWobble', { volume: 0.95, pan: panAt(L2.x) });
    // it leans in and back with the coin's rocking (slow → quick, as the rim's spin speeds up)
    let w0 = -1;
    watch = (el) => {
      if (w0 < 0) w0 = el;
      const e = el - w0;
      return Math.floor(e / (e < 150 ? 150 : 75)) % 2 ? SP_WATCH + 1 : SP_WATCH + 2;
    };
    let ph = 0;
    await animate(sc, 300, (t, _el, dt) => {
      ph += dt * (0.03 + t * 0.09);
      coinR.draw((g) => flatCoin(g, L2.x, L2.y, COIN_AIR, 1 - t, ph));
    });
    s.coinAt = L2;
    race.stop(60);
    // the face: the coin stands up out of its rest, face-on — and its face pops up BIG over it (an emblem disc the
    // size of a head, ringed in light), held a beat on its own before the verdict
    play('jesterReveal', { volume: 0.95, pan: panAt(L2.x) });
    const w = ev.result === 'heads' ? 1 : -1;
    await animate(sc, 160, (t) => {
      const st = Math.min(3, Math.floor(t * 4));
      coinR.draw((g) => {
        if (st === 0) flatCoin(g, L2.x, L2.y, COIN_AIR, 0, 0, 1);
        else blitCoin(g, L2.x, L2.y - 5 - st * 3, st === 1 ? w * 0.5 : w, COIN_AIR - 1);
      });
    });
    // the face pops up: it cranes up at it
    watch = () => SP_WATCH;
    const coinTop = { x: L2.x, y: L2.y - 15 };
    const disc = faceDisc(sc, { x: L2.x, y: L2.y - 46 }, coinTop, w);
    s.extras.push(disc);
    // the call is answered by the face: the called word goes as the face shows (they never stack)
    if (call.active) void animate(sc, 120, (t) => call.active && call.setAlpha(t < 0.5 ? 1 : 0.5)).then(() => call.active && call.destroy());
    void lightFlash(sc, coinTop.x, coinTop.y - 30, PAL.white, 26, 240, { floorY: L2.y, intensity: 0.9 });
    glow.setPosition(coinTop.x, coinTop.y - 20, L2.y);
    await sleep(sc, 140);
    const FACE_Y = L2.y - 62;
    s.words.push(word(sc, { x: L2.x, y: FACE_Y }, faceWord(ev.result), PAL.gold4, 'lg'));
    await sleep(sc, 230);
    // the result: stacked over the face word, a full 'lg' line (with the İ's dot and the outline) plus 2 px apart —
    // they never overlap; kept on screen
    const verdict = ev.win ? 'BİLDİ!' : 'BİLEMEDİ!';
    const lineH = Math.max(measureText(faceWord(ev.result), 'lg').h, measureText(verdict, 'lg').h);
    const res = word(sc, { x: L2.x, y: Math.max(lineH + 2, FACE_Y - lineH - 2) }, verdict, ev.win ? PAL.white : PAL.crim4, 'lg');
    s.words.push(res);
    if (call.active) call.destroy();
    stopWatch(s);
    if (ev.win) {
      // the hands strike 12 on the opponent's side: the marker blazes, a ring of light runs out of it
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
        void animate(sc, 420, (t) => (dial.pulse12 = 1 - t)).then(() => (dial.pulse12 = 0));
        void shake(sc, 70, 1);
      });
      play('jesterWin', { volume: 0.95 });
      // the cheer: the coin leaps off the board back over the jester's head and it catches it — ta-da, a bow
      s.react = cheer(sc, s, u);
    } else {
      s.mode = 'back';
      dial.glowAt = 180;
      dial.k = 1;
      play('jesterLose', { volume: 0.95 });
      void shake(sc, 90, 1);
      // dismay: time already runs back — the coin un-flips up into its thumb, the brow-hands whirl, it trembles
      s.react = dismay(sc, s, u);
    }
    void animate(sc, 300, (_t, el) => res.active && res.setTint(Math.floor(el / 70) % 2 ? (ev.win ? PAL.gold4 : PAL.crim3) : ev.win ? PAL.white : PAL.crim4));
    void glow.fadeOut(300);
    // no wipe follows (nothing to destroy): the show ends here
    if (mi < 0) {
      await sleep(sc, 300);
      await s.react;
      if (s.coin) await coinHome(sc, s, u);
      dispose(sc, s);
    }
  },
  { priority: 20, name: 'd:dial_jester:coinToss' },
);

function stopWatch(s: Show): void {
  s.watch?.();
  s.watch = null;
}

/** Gold ticks off the coin's landing. */
function tinSparks(sc: Phaser.Scene, at: XY): void {
  const sp = new Sparks(sc, DEPTH.FX + 5);
  for (let i = 0; i < 6; i++) sp.add({ x: at.x, y: at.y, vx: (i - 2.5) * 22, vy: -40 - (i % 3) * 18, ay: 260, life: 220, colors: [PAL.white, PAL.gold4, PAL.gold3], shape: 'px', fadeAt: 1 });
  sp.release();
}

/** The coin's radius while it is in the air / on the board (a 16-px disc: readable at 1x over a busy board). */
const COIN_AIR = 8;

/** A dotted ring of light round the flying coin: its dots turn (white lead, gold tail). */
function coinHalo(g: Raster, x: number, y: number, r: number, el: number): void {
  const n = 16;
  const rot = Math.floor(el / 45) % n;
  for (let i = 0; i < n; i += 2) {
    const a = ((i + rot) / n) * Math.PI * 2;
    const c = i === 0 ? PAL.white : i < 6 ? PAL.gold4 : PAL.gold2;
    g.px(R(x + Math.cos(a) * r), R(y + Math.sin(a) * r), c);
  }
}

/**
 * The landed face, BIG: an emblem disc (the coin drawn at radius 12, its face's emblem readable) pops up out of the
 * standing coin in three drawn steps (edge → half → face), ringed by a white then gold 1-px halo, with a light seam
 * down to the coin. Kept until the show ends (destroy()).
 */
function faceDisc(sc: Phaser.Scene, at: XY, from: XY, w: number): { destroy(): void } {
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 7);
  const RAD = 12;
  void animate(sc, 2400, (_t, el) => {
    if (!r.alive) return;
    const st = el < 40 ? 0 : el < 80 ? 1 : el < 120 ? 2 : 3;
    const y = st === 0 ? lerp(from.y, at.y, 0.4) : st === 1 ? lerp(from.y, at.y, 0.8) : st === 2 ? at.y - 2 : at.y;
    r.draw((g) => {
      // the seam of light from the coin up to the disc
      for (let yy = R(from.y) - 2; yy > R(y) + RAD + 2; yy -= 2) g.px(R(at.x), yy, PAL.gold3);
      if (st >= 2) {
        const pulse = Math.floor(el / 90) % 2;
        g.ring(R(at.x), R(y), RAD + 3, RAD + 3, st === 2 || pulse ? PAL.white : PAL.gold4);
        g.ring(R(at.x), R(y), RAD + 5, RAD + 5, PAL.gold2, 0.6);
      }
      const q = coinCanvas(st === 0 ? w * 0.1 : st === 1 ? w * 0.5 : w, RAD);
      g.pc.blit(q, R(at.x) - r.x - (q.w >> 1), R(y) - r.y - (q.h >> 1));
    });
  });
  return {
    destroy() {
      r.destroy();
    },
  };
}

/** Where the coin lands: clear marble between the jester's row and the opponent's, as near the lane's midpoint as
 *  the bodies allow (sampled along the lane and across it; the spot furthest from every unit's box wins). */
function clearSpot(ctx: Ctx<'coinToss'>, home: XY, own: PlayerId, opp: PlayerId, lane: number): XY {
  const field = ctx.views.field;
  // the tile straight across the no-man's-land from the jester: the opponent's tile nearest the jester's forward ray
  const fw = forward(own);
  let across = zoneXY(opp, 'monster', 0);
  let bestOff = 1e9;
  for (let i = 0; i < 5; i++) {
    const z = zoneXY(opp, 'monster', i);
    const dx = z.x - home.x;
    const dy = z.y - home.y;
    const off = Math.abs(dx * fw.y - dy * fw.x);
    if (dx * fw.x + dy * fw.y > 0 && off < bestOff) {
      bestOff = off;
      across = z;
    }
  }
  const side = zoneXY(own, 'monster', Math.min(4, lane + 1));
  const side0 = zoneXY(own, 'monster', Math.max(0, lane - 1));
  const lx = side.x - side0.x;
  const ly = side.y - side0.y;
  const ll = Math.hypot(lx, ly) || 1;
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const p of [0, 1] as PlayerId[]) {
    for (let i = 0; i < 5; i++) {
      const mu = field.unitAt(p, i);
      if (!mu || !mu.sprite.active) continue;
      if (mu.sprite.visible) boxes.push(worldBox(mu));
      // its tile (the card, the ATK / DEF plate under the feet) is occupied too
      boxes.push({ x: Math.round(mu.home.x) - 22, y: Math.round(mu.home.y) - 8, w: 44, h: 26 });
    }
    // a face-down card on a tile with no body
    for (let i = 0; i < 5; i++) {
      if (field.unitAt(p, i)) continue;
      const z = zoneXY(p, 'monster', i);
      const t = ctx.after?.players?.[p]?.monsters?.[i];
      if (t) boxes.push({ x: Math.round(z.x) - 22, y: Math.round(z.y) - 10, w: 44, h: 20 });
    }
  }
  // the candidates: the no-man's-land on the jester's forward line (along and across it), every EMPTY monster tile
  // of either row and the ways to them — the clearest one wins, nearer and more forward preferred
  const cands: XY[] = [];
  for (const t of [0.5, 0.42, 0.58, 0.34, 0.66]) for (const k of [0, -1, 1, -2, 2, -3, 3]) cands.push({ x: R(lerp(home.x, across.x, t) + (lx / ll) * k * 12), y: R(lerp(home.y, across.y, t) + (ly / ll) * k * 12) });
  for (const p of [0, 1] as PlayerId[]) {
    for (let i = 0; i < 5; i++) {
      if (field.unitAt(p, i) || ctx.after?.players?.[p]?.monsters?.[i]) continue;
      const z = zoneXY(p, 'monster', i);
      for (const t of [0.55, 0.8, 1]) cands.push({ x: R(lerp(home.x, z.x, t)), y: R(lerp(home.y, z.y, t)) });
    }
  }
  let best: XY = { x: R(lerp(home.x, across.x, 0.5)), y: R(lerp(home.y, across.y, 0.5)) };
  let bestScore = -1e9;
  for (const p of cands) {
    // the coin's own box (with the face disc rising over it)
    const c = { x: p.x - 12, y: p.y - 16, w: 24, h: 22 };
    let clear = 1e9;
    for (const b of boxes) {
      const dx = Math.max(b.x - (c.x + c.w), c.x - (b.x + b.w), 0);
      const dy = Math.max(b.y - (c.y + c.h), c.y - (b.y + b.h), 0);
      clear = Math.min(clear, dx === 0 && dy === 0 ? -Math.min(c.x + c.w - b.x, b.x + b.w - c.x, c.y + c.h - b.y, b.y + b.h - c.y) : Math.hypot(dx, dy));
    }
    const d = Math.hypot(p.x - home.x, p.y - home.y);
    const fwd = ((p.x - home.x) * fw.x + (p.y - home.y) * fw.y) / Math.max(1, d);
    const score = Math.min(clear, 8) * 3 - Math.abs(d - 50) * 0.1 + fwd * 4;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** One bounce of the landed coin (`h` px high), spinning slowly on the way. */
function hop(sc: Phaser.Scene, r: Raster, a: XY, b: XY, h: number, ms: number, glow: LightHandle): Promise<void> {
  return animate(sc, ms, (t, el) => {
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * h;
    const ph = Math.floor(el / 55) % 8;
    r.draw((g) => {
      for (let dx = -5; dx <= 5; dx += 2) g.px(R(x) + dx, R(lerp(a.y, b.y, t)), PAL.ink);
      blitCoin(g, x, y - 7, SPIN_W[ph], COIN_AIR);
    });
    glow.setPosition(R(x), R(y - 7), R(lerp(a.y, b.y, t)));
  });
}

/** The coin flies from where it lies to a world point in a spinning arc (`back`: the spin runs backwards). */
function coinFly(sc: Phaser.Scene, s: Show, to: XY, ms: number, arc: number, back = false): Promise<void> {
  const r = s.coin;
  const a = s.coinAt;
  if (!r || !a) return Promise.resolve();
  const from = { x: a.x, y: a.y - 15 };
  return animate(sc, ms, (t, el) => {
    const x = lerp(from.x, to.x, t);
    const y = lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * arc;
    const ph = Math.floor(el / 34) % 8;
    r.draw((g) => blitCoin(g, x, y, SPIN_W[back ? 7 - ph : ph], 6));
  }).then(() => {
    r.destroy();
    if (s.coin === r) s.coin = null;
  });
}

/** Win: the coin leaps off the board high over the jester and drops into the victory pose (f2 air → f3 caught, the
 *  brow-hands on 12 → the bow). */
async function cheer(sc: Phaser.Scene, s: Show, u: MonsterUnit | null): Promise<void> {
  if (!u || !u.sprite.active || u.retired || !u.sprite.visible || !u.has('victory')) {
    await coinHome(sc, s, u);
    return;
  }
  const off = jesterOffset(u, 'coin', 'victory', 2);
  const to = { x: u.home.x + off.x, y: u.home.y + off.y };
  u.pose('special', 6);
  await coinFly(sc, s, to, 230, 22);
  play('jesterCheer', { volume: 0.9, pan: panAt(to.x) });
  if (!u.sprite.active || u.retired) return;
  await u.playRange('victory', 2);
}

/** Lose: the coin un-flips backwards up into the thumb, then the jester trembles with its brow-hands whirling
 *  (hitMagic f1–f3 looping) until its own rewind takes it. */
async function dismay(sc: Phaser.Scene, s: Show, u: MonsterUnit | null): Promise<void> {
  if (!u || !u.sprite.active || u.retired || !u.sprite.visible) {
    if (s.coin) {
      s.coin.destroy();
      s.coin = null;
    }
    return;
  }
  const c = jesterOffset(u, 'coin', 'hitMagic', 0);
  await coinFly(sc, s, { x: u.home.x + c.x, y: u.home.y + c.y }, 200, 16, true);
  if (!u.sprite.active || u.retired || !u.has('hitMagic')) return;
  const uu = u;
  s.watch = onFrame(sc, (_dt, el) => {
    if (!uu.sprite.active || uu.retired || uu.posed) return false;
    const f = 1 + (Math.floor(el / 70) % 3);
    if (uu.frameInfo().frame !== f || uu.frameInfo().anim !== 'hitMagic') uu.pose('hitMagic', f);
    return el < 4000;
  });
}

/** The coin hops back into the jester's hand and the special pose closes on it (f8 → idle). */
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
  await coinFly(sc, s, { x: hand.x, y: hand.y - 4 }, 220, 20);
  if (u.sprite.active && !u.retired) void u.playRange('special', SP_CATCH);
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
    const s = show ?? newShow();
    show = s;
    const own = ev.player;
    const src = ev.sourceUid;
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
    // ---- the pass: this source's monster destroys (+ their graveyard moves) are ours. A guardian_charm saving a
    // monster puts its own activate / destroy / toGraveyard IN the pass: those are left to their handlers and
    // played in place (the shield breaks while the others rewind); the pass ends at the first event that is not
    // part of it.
    const doomed: Doomed[] = [];
    const inPass: number[] = [];
    const stUids = new Set<Uid>();
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (ctx.isConsumed(i)) continue;
      if (e.type === 'destroy' && e.sourceUid === src && e.location === 'monster') {
        ctx.consumeAt(i);
        const gi = ctx.findType('toGraveyard', (g) => g.uid === e.uid);
        const g = gi >= 0 ? (ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>) : null;
        if (gi >= 0) ctx.consumeAt(gi);
        doomed.push({ uid: e.uid, owner: g ? g.owner : e.player, cardId: e.cardId, zone: e.zone });
      } else if (e.type === 'destroy' && e.sourceUid === src) {
        stUids.add(e.uid);
        inPass.push(i);
      } else if (e.type === 'activate' && e.kind !== 'monsterEffect' && ctx.find((x) => x.type === 'destroy' && x.uid === e.uid && x.sourceUid === src) > i) {
        stUids.add(e.uid);
        inPass.push(i);
      } else if (e.type === 'toGraveyard' && stUids.has(e.uid)) inPass.push(i);
      else if (e.type === 'toGraveyard' || e.type === 'tokenVanish' || (e.type === 'damage' && e.sourceUid === src)) continue;
      else break;
    }
    const di = ctx.findType('damage', (e) => e.sourceUid === src && e.source === 'effect');
    // the shield's own events, in order, once the doomed bodies are in their cards (its card show would cover them)
    let charm: Promise<void> = Promise.resolve();
    let folded = 0;
    let charmOn = false;
    const onFolded = () => {
      folded++;
      if (folded < doomed.length || !inPass.length || charmOn) return;
      charmOn = true;
      charm = (async () => {
        for (const i of inPass) if (!ctx.isConsumed(i)) await ctx.play(i);
      })();
    };
    // lose: the jester watches its own side rewind and goes last
    if (!win) doomed.sort((a, b) => (a.uid === src ? 1 : 0) - (b.uid === src ? 1 : 0));
    seedFx(src * 7 + doomed.length);
    const rew = start('jesterRewind', { volume: 0.85 });
    // the words hold over the strike a moment, then fade
    const words = s.words;
    s.words = [];
    void sleep(sc, 420).then(() => {
      for (const ww of words) if (ww.active) void animate(sc, 200, (t) => ww.active && ww.setAlpha(t < 0.5 ? 1 : 0.5)).then(() => ww.destroy());
      for (const x of s.extras) x.destroy();
      s.extras = [];
    });
    // ---- each body rewinds into its card (staggered), then the card leaves
    const lp = lpPoint(ctx, own);
    let dmg: Promise<void> = Promise.resolve();
    let hits = 0;
    let flights = 0;
    let fading: Promise<void> | null = null;
    const fadeDial = () => {
      if (fading) return;
      s.mode = 'idle';
      dial.hot = 0;
      dial.glowAt = null;
      fading = animate(sc, 300, (t) => (dial.k = Math.min(dial.k, 1 - t)));
    };
    const lpHit = () => {
      hits++;
      if (hits === 1) {
        play('jesterLpHit', { volume: 0.95, pan: panAt(lp.x) });
        void lightFlash(sc, lp.x, lp.y, PAL.crim3, 34, 300, { intensity: 0.9 });
        void shake(sc, 140, 2);
        // the number pours OUT of the panel into the arena: below a panel at the top of the screen (P2), above one
        // at the bottom (the default) — never over the LP digits
        const rc = panelRect(own);
        const at = rc.y < 180 ? { x: R(rc.x + rc.w / 2), y: R(rc.y + rc.h + 30) } : undefined;
        if (di >= 0) dmg = ctx.play(di, at ? { delivered: true, at } : { delivered: true });
      } else playFold(sc, { volume: 0.5, pan: panAt(lp.x), pitch: 1.3 });
      panelFlash(sc, own, hits === 1);
      if (hits >= doomed.length) fadeDial();
    };
    const onFlight = () => {
      flights++;
      if (win && flights >= doomed.length) fadeDial();
    };
    const t0 = win ? 0 : 160;
    const jobs = doomed.map((d, i) => rewindOne(ctx, s, d, { delay: t0 + i * 90 + (!win && d.uid === src ? 120 : 0), lead: i === 0, win, lp, onPanel: lpHit, onFlight, onFolded, dial }));
    await Promise.all(jobs);
    if (!doomed.length) onFolded();
    rew.stop(120);
    if (!win && hits === 0) lpHit();
    fadeDial();
    await dmg;
    await charm;
    // ---- the end: the cheer finishes, the dial is gone, the light returns
    await s.react;
    if (s.coin) await coinHome(sc, s, ctx.unit(src));
    await fading;
    dispose(sc, s);
  },
  { priority: 20, name: 'd:dial_jester:massDestroy' },
);

/** The LP panel's frame flashes gold (white on the first card) where a rewound card hits it. */
function panelFlash(sc: Phaser.Scene, p: PlayerId, first: boolean): void {
  const rc = panelRect(p);
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.HUD + 8);
  const x0 = R(rc.x) - 1;
  const y0 = R(rc.y) - 1;
  const x1 = R(rc.x + rc.w);
  const y1 = R(rc.y + rc.h);
  void animate(sc, first ? 260 : 160, (t) =>
    r.draw((g) => {
      const c = t < 0.33 ? (first ? PAL.white : PAL.gold4) : t < 0.66 ? PAL.gold4 : PAL.gold2;
      g.path([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }], c);
      if (t < 0.5) g.path([{ x: x0 - 1, y: y0 - 1 }, { x: x1 + 1, y: y0 - 1 }, { x: x1 + 1, y: y1 + 1 }, { x: x0 - 1, y: y1 + 1 }, { x: x0 - 1, y: y0 - 1 }], PAL.gold3, 0.6);
    }),
  ).then(() => r.destroy());
}

/**
 * The wipe's per-card sounds (jesterFold, jesterCardWhirl), spaced: two that land together (two bodies closing at
 * once, two cards leaving at once) are staggered by at least SPACED_GAP ms — the recipe's own gap would drop the
 * second — and each one in a run steps the pitch up a little ("tak-tak-tak").
 */
const SPACED_GAP = 75;
const spacedLast = new Map<string, { at: number; run: number }>();
function playSpaced(sc: Phaser.Scene, name: 'jesterFold' | 'jesterCardWhirl', o: { volume: number; pan: number; pitch?: number }): void {
  const now = sc.time.now;
  let st = spacedLast.get(name);
  // a new scene's clock starts over: forget the last one's
  if (!st || st.at > now + 500) st = { at: -1e9, run: 0 };
  const at = Math.max(now, st.at + SPACED_GAP);
  const run = at - st.at < 220 ? Math.min(3, st.run + 1) : 0;
  spacedLast.set(name, { at, run });
  const opts = { ...o, pitch: (o.pitch ?? 1) * (1 + run * 0.06) };
  if (at <= now) play(name, opts);
  else void sleep(sc, at - now).then(() => play(name, opts));
}
const playFold = (sc: Phaser.Scene, o: { volume: number; pan: number; pitch?: number }): void => playSpaced(sc, 'jesterFold', o);

/** The card's fold round a rewound body (foldRect): its whole length and the part where it stands up out of the tile. */
const FOLD_MS = 300;
const FOLD_RISE = Math.round(FOLD_MS * 0.42);

/** One doomed monster: its entrance played backwards with gold echoes, poured into its card, the card's flight. */
async function rewindOne(ctx: Ctx<'massDestroy'>, s: Show, d: Doomed, o: { delay: number; lead: boolean; win: boolean; lp: XY; onPanel: () => void; onFlight: () => void; onFolded: () => void; dial: ArenaDial }): Promise<void> {
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
  // the jester's own dismay loop lets go when its rewind takes it
  if (body && body.cardId === ID) {
    stopWatch(s);
    dropJester(s);
  }
  void rewindRing(sc, home, 520);
  if (live && body) {
    const box = worldBox(body);
    // its own entrance played backwards: the rewind contract (src/art/variants.ts) gives the anims — a base form
    // reverses its summon; a variant (lane A's grown cloud_hatchling) its own chain (special, then summon)
    const steps = rewindAnims(body.cardId, variantOf(body)).filter((st) => body.has(st.anim));
    const voice = rewindSfx(body.cardId, variantOf(body));
    if (voice) play(voice, { volume: 0.8, pan });
    const total = steps.reduce((n, st) => n + body.frameCount(st.anim), 0);
    const step = total ? Math.max(18, Math.min(32, Math.round(Math.max(320, steps.length * 260) / total))) : 0;
    // the card closes round it on the body's LAST frames: it stands up out of the tile (FOLD_RISE) over the final
    // poses of the rewind (the egg of a grown hatchling, the first summon frame of anyone else) and the body is
    // hidden the moment it is upright — never a card beside a body still playing, never a body left on the tile;
    // a pose-less body calls it as it starts to fold down
    let foldAt = -1;
    let foldRes: () => void = () => undefined;
    const foldStart = new Promise<void>((res) => (foldRes = res));
    const foldGo = (): void => {
      if (foldAt >= 0) return;
      foldAt = sc.time.now;
      foldRes();
    };
    const fold = foldStart.then(() => foldRect(sc, box, home, FOLD_MS, body.sprite.depth + 0.6));
    if (total) {
      let k = 0;
      const t0 = sc.time.now;
      for (const st of steps) {
        for (let f = body.frameCount(st.anim) - 1; f >= 0; f--) {
          if (!body.sprite.active) break;
          body.pose(st.anim, f);
          // the time left, at the pace the frames are REALLY shown (a sleep ends on a display frame, so a 20-ms step
          // can take 33 ms): the card starts to rise FOLD_RISE before the last frame ends
          const pace = k > 0 ? Math.max(step, (sc.time.now - t0) / k) : step;
          if ((total - k) * pace <= FOLD_RISE + pace * 0.5) foldGo();
          // gold echoes peel off while it plays back — none once the card is closing round it (an echo would outlive
          // the body and hang over the card)
          if (k++ % 3 === 1 && foldAt < 0) afterimage(sc, body.sprite, PAL.gold2, { alpha: 0.3, ms: 100, depth: body.sprite.depth - 0.2 });
          await sleep(sc, step);
        }
      }
      foldGo();
      // the card must be upright round the last frame before the body goes
      const up = FOLD_RISE - (sc.time.now - foldAt);
      if (up > 0) await sleep(sc, up);
    } else {
      // no summon pose (an old art): what it does have runs backwards fast — its attack, then its idle — with
      // crisp gold echoes peeling off, then a 2-frame opaque banded gold silhouette and it is gone; no dust
      await rewindBody(sc, body, 380, () => foldGo());
      foldGo();
    }
    if (body.sprite.active) body.sprite.setVisible(false);
    playFold(sc, { volume: 0.8, pan });
    await fold;
    body.retire(0);
  } else {
    body?.retire(0);
    playFold(sc, { volume: 0.6, pan });
  }
  field.forget(d.uid);
  // a face-down card shows its face before it goes
  if (tile && tile.active && !tile.faceUp) {
    tile.setCard(d.cardId);
    await tile.flipUp(140);
  }
  void lightFlash(sc, home.x, home.y, PAL.gold4, 18, 160, { floorY: home.y, intensity: 0.6 });
  playSpaced(sc, 'jesterCardWhirl', { volume: 0.75, pan });
  o.onFolded();
  o.onFlight();
  if (o.win) {
    const to = ctx.views.field.pile(d.owner, 'graveyard').topXY();
    const arc = Math.min(40, 16 + Math.hypot(to.x - home.x, to.y - home.y) * 0.12);
    await spinCard(ctx, {
      owner: d.owner,
      cardId: d.cardId,
      from: home,
      tile: tile as TileCard | null,
      ms: 420,
      land: true,
      path: (t) => ({ x: lerp(home.x, to.x, t), y: lerp(home.y, to.y, t) - Math.sin(Math.PI * t) * arc - 6 * (1 - t) }),
    });
    return;
  }
  // lose: the card rides the arena dial's minute hand — the hand reaches out to it (hand tip = card), sweeps it
  // round BACKWARDS inside the arena (the short way when backwards would be the long way round), then shoots out
  // along the hand's line into the own LP panel
  const dl = o.dial;
  const A0 = dl.toDial(home);
  const B = dl.toDial(o.lp);
  const kArc = Math.min(0.9, Math.max(0.35, A0.k));
  const back = (A0.deg - B.deg + 360) % 360;
  const sweep = back <= 200 ? -back : 360 - back;
  const ARC = 0.62;
  const at = (t: number): { deg: number; k: number } =>
    t < ARC ? { deg: A0.deg + sweep * (t / ARC), k: lerp(A0.k, kArc, t / ARC) } : { deg: B.deg, k: lerp(kArc, B.k, (t - ARC) / (1 - ARC)) };
  if (o.lead) {
    s.mode = 'idle';
    dl.min = A0.deg;
    dl.minLen = A0.k;
  }
  play('jesterLpWhoosh', { volume: o.lead ? 0.95 : 0.7, pan: panAt(home.x) });
  await spinCard(ctx, {
    owner: d.owner,
    cardId: d.cardId,
    from: home,
    tile: tile as TileCard | null,
    ms: 500,
    rate: 10,
    faceUp: true,
    depth: DEPTH.FX_TOP - 1,
    hold: 60,
    trail: [PAL.white, PAL.crim4, PAL.gold3],
    path: (t) => {
      const q = at(t);
      if (o.lead) {
        dl.min = (q.deg + 720) % 360;
        dl.minLen = q.k;
        dl.glowAt = q.deg;
      }
      return dl.at(q.deg, q.k);
    },
  });
  if (o.lead) {
    s.mode = 'back';
    dl.minLen = 0.5;
    dl.glowAt = 180;
  }
  o.onPanel();
  // then it drops off the panel onto its graveyard
  const to = ctx.views.field.pile(d.owner, 'graveyard').topXY();
  await spinCard(ctx, {
    owner: d.owner,
    cardId: d.cardId,
    from: o.lp,
    ms: 220,
    rate: 8,
    land: true,
    path: (t) => ({ x: lerp(o.lp.x, to.x, t), y: lerp(o.lp.y, to.y, t) - Math.sin(Math.PI * t) * 14 }),
  });
}
