// Bulut Yavrusu (cloud_hatchling) — the signature moment "Büyüme" (docs/v3/kart-a/cloud_hatchling.md §5.6).
// v3 look only. No dependency on lane D: the inputs are our own events (coinToss → … → activate{monsterEffect}
// → statChange) and the board; the dial is our own raster.
//
// Cause before effect (an observer on coinToss, in parallel with whoever draws the coin): the baby looks up,
// hiccups a tiny ring toward the coin, then STARES — special f0 → f1 → f2 → f1 … at ≈ 120 ms a step (never a
// held frame, however long the coin and the wipe take) — until our hook claims it (or its activate is gone).
// The growth (the activate hook): a SKY DIAL of twelve cloud puffs is cast behind it (hollow: rim, four
// water4 ticks, two wind-streak hands, a gold pip at 12). The long hand makes six revolutions, each ending on
// a growth frame (special f6 … f11); revolutions 2–6 are a stepped sweep wedge. The short hand advances two
// hours per revolution and the two hour-puffs it has swept DROP off the rim to their slots on the grown waist
// ring (the years fall); the dial empties as the body grows. Each growth frame carries one hiccup a step
// lower (D6 B5 G5 E5 D5 A4); f11 the dial clicks shut (chime), f12 a gasp, and on f13 (the release mark) the
// voice breaks two octaves into a roar — the motes that spiralled up blast outward. At the end of f15 the
// unit becomes the grown variant for good (special f15 ≡ grown idle f0: no pop), then the generic stat
// beat plays on the grown body ("+1200", the badge rolls to 2300).


import { PAL } from '../../art/palette';
import { framePuffs } from '../../art/monsters-v3/cloud_hatchling-anims';
import { warmVariant } from '../../art/variants';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { setUnitVariant, variantOf } from '../../duel/unit-variant';
import type { GameEvent, Uid } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { shake } from '../../vfx/core';
import type { CinematicContext } from '../_core/types';
import { registerCardHook, registerObserver } from '../api';
import { atFrame, panAt, play, start } from '../_v3/sound';
import { layer, onFrame, playFrom, sleep } from './_kit';
import type { Px } from '../../vfx/combat';
import { GROW_STEPS } from '../../audio/v3/hatchling';

type ActivateEv = Extract<GameEvent, { type: 'activate' }>;
const ID = 'cloud_hatchling' as const;
const STEP = 1000 / 60;
/** The staring cycle (special f0 → f1 → f2 → f1 …) and its step (scene ms). */
const STARE = [0, 1, 2, 1] as const;
const STARE_MS = 120;
/** Dial geometry: radius, centre above the core, the hands. */
const DIAL_R = 24;
/** (build r1: centred on core − 6 the hands hid behind the baby's body; the centre sits at its head) */
const DIAL_UP = 22;
const LONG = 20;
const SHORT = 12;
/** Pans of the six revolution pulses: round the stereo field. */
/** Scene ms after the roar's hold frame (f14) begins before the stat beat starts (crit c3r1 #2). */
const BEAT_AFTER_ROAR = 60;
/** The dial puffs' pitches (semitones above the base): D major, once round the clock. */
const DIAL_STEPS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19] as const;
const FWIP_PAN = [-0.6, 0.2, 0.6, -0.2, -0.6, 0.2];

/** Units claimed by the growth hook (the staring loop lets go of them). */
const claimed = new WeakSet<MonsterUnit>();

// ================================================================ cause before effect

function stareable(u: MonsterUnit | null): u is MonsterUnit {
  return !!u && !u.retired && u.sprite.active && u.sprite.visible && !u.locked && !u.guarding;
}

/** The look-up at the coin: a hiccup toward it, then the staring loop until the hook claims the unit. */
function lookUpAtCoin(ev: GameEvent, ctx: CinematicContext): void {
  if (ev.type !== 'coinToss') return;
  for (const slot of ctx.state.players[ev.player].monsters) {
    if (!slot || !slot.faceUp || slot.permAtk !== undefined || ctx.state.cards[slot.uid]?.cardId !== ID) continue;
    const u = ctx.views.field.unit(slot.uid);
    if (!stareable(u)) continue;
    const ai = ctx.findType('activate', (e) => e.kind === 'monsterEffect' && e.uid === slot.uid, { includeConsumed: true });
    warmVariant(ctx.scene, ID, 'grown');
    void stareLoop(ctx, u, ai);
  }
}

async function stareLoop(ctx: CinematicContext, u: MonsterUnit, ai: number): Promise<void> {
  const sc = ctx.scene;
  await sleep(sc, 250);
  if (!stareable(u) || claimed.has(u)) return;
  // the hiccup toward the coin (idle f13–f16: the tiny ring puffs up)
  const n = u.frameCount('idle');
  if (n > 16) {
    play('hatchHiccup', { volume: 0.5, pan: panAt(u.home.x) });
    await u.playRange('idle', 13, 16, { hold: true });
  }
  const t0 = sc.time.now;
  let i = 0;
  // ai < 0 (the coin was lost / it does not grow): one cycle, then back to idle
  const cycles = ai < 0 ? STARE.length : Infinity;
  while (i < cycles) {
    if (claimed.has(u)) return; // the hook took it over (it keeps posing from here)
    if (!stareable(u) || u.frameInfo().anim === 'death') return;
    if (ai >= 0 && ctx.isConsumed(ai) && !claimed.has(u) && i > 0 && sc.time.now - t0 > 400) break;
    if (sc.time.now - t0 > 20000) break; // last-resort guard against a stuck batch
    u.pose('special', STARE[i % STARE.length]);
    i++;
    await sleep(sc, STARE_MS);
  }
  if (!claimed.has(u) && stareable(u)) u.rest();
}

function warmGrownOnCoinCall(ev: GameEvent, ctx: CinematicContext): void {
  if (ev.type !== 'decision' || ev.pending.kind !== 'coinCall') return;
  const p = ev.pending.player;
  const has = ctx.state.players[p].monsters.some((s) => !!s && s.faceUp && s.permAtk === undefined && ctx.state.cards[s.uid]?.cardId === ID);
  if (has) warmVariant(ctx.scene, ID, 'grown');
}

// ================================================================ the growth hook

async function hatchGrowV3(ctx: CinematicContext<ActivateEv>): Promise<void> {
  const ev = ctx.ev;
  if (ev.kind !== 'monsterEffect') return ctx.base();
  // siblings: every later hatchling activate of this run grows together, staggered 150 ms
  const uids: Uid[] = [ev.uid];
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'activate' && e.kind === 'monsterEffect' && e.cardId === ID && !ctx.isConsumed(i)) {
      uids.push(e.uid);
      ctx.consumeAt(i);
    }
  }
  const statIdx = ctx.findType('statChange', (e) => uids.includes(e.uid));
  const units = uids.map((id) => ctx.views.field.unit(id));
  for (const u of units) if (u) claimed.add(u);
  warmVariant(ctx.scene, ID, 'grown');
  const visible = units.filter((u): u is MonsterUnit => !!u && !u.retired && u.sprite.active && u.sprite.visible);
  for (const u of units) if (u && !visible.includes(u) && !u.retired) setUnitVariant(u, 'grown');
  if (!visible.length) {
    if (statIdx >= 0) await ctx.play(statIdx);
    return;
  }
  // (crit c3r1 #2) the stat beat no longer waits for the swap at the end of f15: it starts BEAT_AFTER_ROAR
  // after the last sibling's roar frame f14 begins (the roar flash and its loudest shake are over), so the
  // leaf rim climbs the full-size roaring body and "+1200" / lpUp land ≈ 310 game ms earlier, on the roar's
  // tail. It groups the consecutive statChanges as before.
  let beat: Promise<void> | null = null;
  const fireBeat = () => {
    if (!beat) beat = statIdx >= 0 && !ctx.isConsumed(statIdx) ? ctx.play(statIdx) : Promise.resolve();
  };
  const last = visible.length - 1;
  const grows = visible.map((u, k) => sleep(ctx.scene, k * 150).then(() => growOne(ctx, u, k === last ? fireBeat : undefined)));
  await Promise.all(grows);
  fireBeat();
  await Promise.all([beat, sleep(ctx.scene, 300)]);
}

interface Fall {
  hour: number;
  from: XY;
  to: XY;
  back: boolean;
  t0: number;
}

async function growOne(ctx: CinematicContext, u: MonsterUnit, onRoarTail?: () => void): Promise<void> {
  const sc = ctx.scene;
  const home = { ...u.home };
  const pan = panAt(home.x);
  const defense = u.guarding;
  const live = () => !u.retired && u.sprite.active;
  const sd = u.sprite.depth;
  const C0 = u.core();
  const centre: XY = { x: Math.round(C0.x), y: Math.round(C0.y - DIAL_UP) };
  const wind = start('hatchGrowWind', { volume: 1, pan });
  const pool = lightPool(sc, home.x, home.y, { color: PAL.water4, radius: 24, intensity: 0, fadeIn: 0 });
  // (crit c3r1 #1) the floor pool rises in STEPS with the winds: build → rev 1 → every second growth frame
  let poolStep = 0;
  const stepPool = (k: number) => {
    if (k <= poolStep) return;
    poolStep = k;
    pool.setIntensity(0.25 + 0.15 * k, 0);
  };
  stepPool(1);
  // ---- layers: the dial behind the body, the front-half landed puffs and the motes in front
  const dial = layer(sc, sd - 1);
  const floor = layer(sc, DEPTH.CARD_ON_TILE + 1); // over the card on the tile, under the shadows
  const back = layer(sc, sd - 0.5);
  const front = layer(sc, sd + 0.5);
  // the ring slots (grown idle f0 = special f15), in world px through the sprite (mirrors for P2)
  const slots = framePuffs('idle', 0, true).map((p) => ({ ...u.framePoint(p.x, p.y), back: p.back }));
  // the hour puffs on the rim (hour 12 at the top, clockwise on screen)
  const hourPt = (h: number, r = DIAL_R): XY => {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.round(centre.x + Math.cos(a) * r), y: Math.round(centre.y + Math.sin(a) * r) };
  };
  const onRim = new Set<number>();
  const falls: Fall[] = [];
  let built = 0; // puffs popped in
  let ticks = false;
  let hands = false;
  let handsGone = -1; // display frames since the dial clicked shut (blink-out over 3)
  let pipFlash = 0;
  let longA = 0; // revolutions done (continuous)
  let prevA: number[] = [];
  let revStart = -1; // ms the special f3 began (rev 1)
  let el = 0;
  let curF = -1;
  let fChange = 0;
  let landedAll = false;
  // spiral motes: rise on an open spiral round the tile, blast out on the roar
  const motes = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2, blast: -1 }));
  let spiral = 0; // 0 … 1 rise
  let blastAt = -1;
  let done = false;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      dial.clear();
      floor.clear();
      back.clear();
      front.clear();
      if (done || !live()) return false;
      const fi = u.frameInfo();
      if (fi.anim === 'special' && fi.frame !== curF) {
        curF = fi.frame;
        fChange = el;
      }
      // the long hand: rev 1 over f3–f5 (Quad.In), revs 2–6 one per frame f6 … f10, at 12 on f11
      if (curF >= 3 && curF <= 5) {
        if (revStart < 0) {
          revStart = el;
          stepPool(2);
        }
        const span = u.rangeMs('special', 3, 5) || 360;
        const t = Math.min(1, (el - revStart) / span);
        longA = t * t;
      } else if (curF >= 6 && curF <= 10) {
        const k = curF - 5; // revolutions done when the frame began
        const t = Math.min(1, (el - fChange) / Math.max(1, u.frameMs('special', curF)));
        longA = k + t;
      } else if (curF >= 11) longA = 6;
      // ---- (crit c3r1 #1) the dial face: a dark night4 band with a steel lip behind the puffs, built clockwise
      //      with them, so the hollow clock reads as a shape at 1× (it blinks out with the hands)
      if (handsGone < 3 && !(handsGone >= 0 && handsGone % 2 === 1)) {
        const reach = built >= 12 ? Math.PI * 2 + 0.01 : (built / 12) * Math.PI * 2 + 0.01;
        for (const r of RING) if (r.a <= reach) dial.dot(centre.x + r.x, centre.y + r.y, r.c);
      }
      // ---- the floor: the dial's stepped shadow ring (water tones, one step per stage), under the body
      if (poolStep > 0 && handsGone < 3) {
        const c = poolStep >= 4 ? PAL.water4 : poolStep >= 2 ? PAL.water3 : PAL.water2;
        const every = poolStep >= 3 ? 1 : 2;
        for (let i = 0; i < FLOOR.length; i += every) {
          const q = FLOOR[i];
          if (handsGone >= 0 && (i + handsGone) % 2 === 0) continue;
          floor.dot(home.x + q.x, home.y + q.y, q.inner ? PAL.water2 : c);
        }
      }
      // ---- rim puffs (the ones still on it): 7×4 cloud lobes, white crown, mist flanks, steel belly
      for (let h = 1; h <= 12; h++) {
        if (!onRim.has(h)) continue;
        puffLobe(dial, hourPt(h), false);
      }
      if (ticks && handsGone < 3) {
        for (const h of [12, 3, 6, 9]) {
          const a = hourPt(h, DIAL_R - 5);
          const b = hourPt(h, DIAL_R - 7);
          if (handsGone < 0 || (handsGone + h) % 2 === 0) dial.rect(a.x, a.y, 2, 2, PAL.water4).rect(b.x, b.y, 2, 2, PAL.water3);
        }
      }
      if (built >= 12 || onRim.size < 12) {
        const pip = hourPt(12, DIAL_R + 3);
        dial.rect(pip.x - 1, pip.y, 2, 1, pipFlash > 0 ? PAL.gold4 : PAL.gold3);
        if (pipFlash > 0) pipFlash--;
      }
      if (hands && (handsGone < 0 || handsGone < 3)) {
        const blink = handsGone >= 0 && handsGone % 2 === 1;
        if (!blink) {
          const aL = longA * Math.PI * 2 - Math.PI / 2;
          const aS = (longA / 6) * Math.PI * 2 - Math.PI / 2;
          // revs 2–6: the swept wedge from where the hand was two display frames ago
          if (longA > 1 && longA < 6 && prevA.length >= 2) {
            const a0 = prevA[0] * Math.PI * 2 - Math.PI / 2;
            wedge(dial, centre, a0, aL, LONG);
          }
          hand(dial, centre, aS, SHORT, false);
          hand(dial, centre, aL, LONG, true);
          dial.rect(centre.x - 1, centre.y - 1, 3, 3, PAL.steel).dot(centre.x, centre.y, PAL.white);
        }
        prevA = [...prevA.slice(-1), longA];
        if (handsGone >= 0) handsGone++;
      }
      // ---- the falling years: hour puffs drop to their ring slots (whole px, ≈ 80 ms)
      for (const f of falls) {
        const t = Math.min(1, (el - f.t0) / 80);
        if (landedAll) continue;
        const e = t * t;
        const x = Math.round(f.from.x + (f.to.x - f.from.x) * e);
        const y = Math.round(f.from.y + (f.to.y - f.from.y) * e);
        const L = t >= 1 && f.back ? back : t >= 1 ? front : front;
        if (t < 1) puffLobe(L, { x, y }, true);
        else L.run(y - 1, x - 1, x, f.back ? PAL.mist : PAL.white).run(y, x - 1, x + 1, PAL.mist).dot(x, y + 1, PAL.steel);
      }
      // ---- the motes: an open spiral rising round the tile (radius 18 → 8, 0 → 30 px up), then the blast
      for (const m of motes) {
        if (blastAt >= 0) {
          const t = (el - blastAt) / 260;
          if (t >= 1) continue;
          const r = 10 + 40 * t;
          const x = Math.round(home.x + Math.cos(m.a) * r);
          const y = Math.round(home.y - 28 + Math.sin(m.a) * r * 0.6);
          front.dot(x, y, t < 0.4 ? PAL.white : t < 0.7 ? PAL.mist : PAL.steel);
          continue;
        }
        if (spiral <= 0) continue;
        const a = m.a + spiral * Math.PI * 5;
        const r = 18 - 10 * spiral;
        const x = Math.round(home.x + Math.cos(a) * r);
        const y = Math.round(home.y - 30 * spiral + Math.sin(a) * r * 0.5);
        const L = Math.sin(a) < 0 ? back : front;
        L.dot(x, y, spiral > 0.6 ? PAL.white : PAL.stone3);
      }
      if (curF >= 3 && curF < 13) spiral = Math.min(1, spiral + (dt / 1000) * (0.4 + 1.4 * spiral));
      return true;
    },
    () => {
      dial.g.destroy();
      floor.g.destroy();
      back.g.destroy();
      front.g.destroy();
    },
  );

  // ---- 0–360: the staring loop goes on (defense: fromGuard) while the dial builds
  if (defense && u.has('fromGuard')) void u.play('fromGuard', { hold: true });
  for (let h = 12, k = 0; k < 12; k++, h = (h % 12) + 1) {
    onRim.add(h);
    built++;
    if (!defense && k % 4 === 0) u.pose('special', [0, 1, 2][k / 4]);
    // (crit c3r1 #9) every puff pops in with its own soft cloud pop, climbing D major round the clock
    play('hatchDialPuff', { volume: 0.55, pitch: 0.5 * 2 ** (DIAL_STEPS[k] / 12), pan: panAt(hourPt(h).x) });
    await sleep(sc, 25);
  }
  ticks = true;
  await sleep(sc, 30);
  hands = true;
  await sleep(sc, defense ? 30 : 30);
  if (!live()) {
    done = true;
    wind.stop(80);
    void pool.fadeOut(120);
    setUnitVariant(u, 'grown');
    return;
  }

  // ---- f3 …: the growth itself, every beat on its frame
  const relF = u.markFrame('special', 'release', 13);
  for (let i = 0; i < 6; i++) {
    const f = 6 + i;
    atFrame(u, 'special', f, () => {
      play(i % 2 === 0 ? 'hatchGrowFwipA' : 'hatchGrowFwipB', { volume: 0.8, pitch: 1 + i * 0.05, pan: FWIP_PAN[i] });
      play('hatchGrowHic', { volume: 0.8, pitch: GROW_STEPS[i], pan });
      void lightFlash(sc, home.x, home.y, PAL.leaf4, 16 + i * 2, 120, { floorY: home.y, intensity: 0.5 });
      // the two hour-puffs the short hand has just swept drop to their waist-ring slots
      for (const h of [2 * i + 1, 2 * i + 2]) {
        if (!onRim.has(h)) continue;
        onRim.delete(h);
        const s = slots[(h - 1) % slots.length];
        falls.push({ hour: h, from: hourPt(h), to: { x: Math.round(s.x), y: Math.round(s.y) }, back: s.back, t0: el });
      }
      if (f === 8) void shake(sc, 120, 1);
      if (f === 7) stepPool(3);
      if (f === 9) stepPool(4);
      if (f === 11) {
        play('hatchGrowChime', { volume: 0.85, pan });
        wind.stop(80);
        pipFlash = 2;
        handsGone = 0;
        void shake(sc, 160, 2);
        void pool.fadeOut(200);
      }
    }, { maxMs: 5000 });
  }
  // the landed puffs vanish on the frame the sprite's own ring is complete (f11 → the next display frame)
  atFrame(u, 'special', 12, () => (landedAll = true), { maxMs: 5000 });
  atFrame(u, 'special', 12, () => play('hatchGrowGasp', { volume: 0.8, pan }), { maxMs: 5000 });
  if (onRoarTail) atFrame(u, 'special', relF + 1, () => void sleep(sc, BEAT_AFTER_ROAR).then(onRoarTail), { maxMs: 5000 });
  atFrame(u, 'special', relF, () => {
    play('hatchVoiceDrop', { volume: 1, pan });
    blastAt = el;
    void shake(sc, 220, 3);
    void lightFlash(sc, home.x, home.y, PAL.white, 26, 100, { floorY: home.y, intensity: 0.8 });
  }, { maxMs: 5000 });
  try {
    // (resolves once the last frame's own hold has run: the swap lands on its end)
    await playFrom(u, 'special', 3, { hold: true });
  } catch {
    /* the sprite left */
  }
  done = true;
  wind.stop(80);
  if (u.retired) return;
  // ---- the swap: special f15 ≡ grown idle f0 (Δ = 0), from here on the grown body for good
  setUnitVariant(u, 'grown');
  if (variantOf(u) === 'grown' && live()) {
    if (defense && u.has('toGuard')) void u.play('toGuard', { hold: true });
    else u.rest();
  }
  void STEP;
}

/**
 * A hand (crit c3r1 #1: 2 px thick): a white core with a mist (long) / steel (short) side band, a 3-px white
 * head at the tip, so the stepped sweep reads at 1×.
 */
function hand(px: Px, c: XY, a: number, len: number, long: boolean): void {
  // the side band on the perpendicular that keeps the stroke 2 px wide on every angle
  const sx = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) ? 1 : 0;
  const sy = 1 - sx;
  for (let r = 2; r <= len; r++) {
    const x = Math.round(c.x + Math.cos(a) * r);
    const y = Math.round(c.y + Math.sin(a) * r);
    const tip = r >= len - 2;
    px.dot(x + sx, y + sy, tip ? PAL.mist : long ? PAL.mist : PAL.steel);
    px.dot(x, y, tip || long ? PAL.white : r > len * 0.5 ? PAL.mist : PAL.steel);
  }
}

/** One rim puff (7×4 lobe): white crown, mist flanks, a steel belly; `small` is the falling 4×3 version. */
function puffLobe(px: Px, p: XY, small: boolean): void {
  if (small) {
    px.run(p.y - 1, p.x - 1, p.x, PAL.white).run(p.y, p.x - 1, p.x + 1, PAL.white).dot(p.x + 2, p.y, PAL.mist).run(p.y + 1, p.x - 1, p.x + 1, PAL.steel);
    return;
  }
  px.run(p.y - 2, p.x - 1, p.x + 1, PAL.white)
    .run(p.y - 1, p.x - 2, p.x + 2, PAL.white)
    .dot(p.x + 3, p.y - 1, PAL.mist)
    .dot(p.x - 3, p.y, PAL.mist)
    .run(p.y, p.x - 2, p.x + 2, PAL.white)
    .dot(p.x + 3, p.y, PAL.mist)
    .run(p.y + 1, p.x - 2, p.x + 2, PAL.steel);
}

/** The dial band (offsets from the centre): night4 body at r ∈ [R−1, R+1], a steel lip on the inside; by angle from 12. */
const RING: readonly { x: number; y: number; a: number; c: number }[] = (() => {
  const out: { x: number; y: number; a: number; c: number }[] = [];
  const R = DIAL_R;
  for (let y = -R - 2; y <= R + 2; y++)
    for (let x = -R - 2; x <= R + 2; x++) {
      const d = Math.hypot(x, y);
      if (d < R - 2.5 || d >= R + 1.5) continue;
      let a = Math.atan2(y, x) + Math.PI / 2;
      if (a < 0) a += Math.PI * 2;
      out.push({ x, y, a, c: d < R - 1.5 ? PAL.steel : PAL.night4 });
    }
  return out;
})();

/** The dial's floor ring (offsets from home): an iso ellipse rx 26 / ry 12 (round the card), a sparse inner ring rx 17 / ry 7. */
const FLOOR: readonly { x: number; y: number; inner: boolean }[] = (() => {
  const out: { x: number; y: number; inner: boolean }[] = [];
  const seen = new Set<string>();
  for (const [rx, ry, inner, n] of [[26, 12, false, 96], [17, 7, true, 28]] as const)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * rx);
      const y = Math.round(Math.sin(a) * ry);
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x, y, inner });
    }
  return out;
})();

/** The swept wedge of a fast revolution: the sector from a0 to a1 (white leading edge, mist body, steel tail). */
function wedge(px: Px, c: XY, a0: number, a1: number, len: number): void {
  let d = a1 - a0;
  while (d < 0) d += Math.PI * 2;
  if (d > Math.PI * 1.2) d = Math.PI * 1.2;
  const n = Math.max(3, Math.ceil(d * len));
  for (let i = 0; i <= n; i++) {
    const a = a0 + (d * i) / n;
    const col = i === n ? PAL.white : i < n * 0.25 ? PAL.steel : PAL.mist;
    // a hollow-ish wedge: the outer half of the radius only (the body stays readable behind it)
    for (let r = Math.round(len * 0.35); r <= len; r += 1) px.dot(Math.round(c.x + Math.cos(a) * r), Math.round(c.y + Math.sin(a) * r), col);
  }
}

if (LOOK_V3) {
  registerCardHook(ID, 'effect', hatchGrowV3, { name: 'strikes-a:cloud_hatchling:grow' });
  registerObserver(warmGrownOnCoinCall);
  registerObserver(lookUpAtCoin);
}


