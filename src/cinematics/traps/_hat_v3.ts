// Sihirli Şapka (magic_hat) — the scenes. magic_hat.ts registers them; no registrations here.
//
// The trap opens (trapOpening), then:
//   hatsShuffled  three (or two) dusk-violet hats rise out of floor mist over the real monster's tile and the
//                 decoy tiles, drop over their occupants (the monster dips under a 4-frame top-down wipe, three
//                 felt thumps), then SHUFFLE along ground arcs — 3 passes, each hat with its shadow, a tiny star
//                 sparkle per swap — and settle with a small hop. ≈ 1.65 s after the opening's banner (budget:
//                 activation + shuffle ≤ 2.6 s).
//   hatChosen     the attacker's pick: the chosen hat hops and a floor ring marks it.
//   decoyPopped   the hat lifts, a puff + confetti stars, the hat tumbles away; the attacker wobbles (≤ 0.6 s).
//   hatRevealed   the real hat lifts and leaves, a chime; the normal flip / battle follow.
//   hatRestore    leftover hats dissolve into motes (≤ 0.5 s); at the turn's end the hidden monster is shown again.
// The look is one code path: under the legacy look (no LOOK_V3) it skips the sparkles, the arcs' height and the
// mist, and keeps straight slides. Whole pixels throughout, no scaling, no rotation, the camera never changes.
//
// The decoy's token look: a face-down card tile (FieldView) under a hat (src/view/hats.ts).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { Hat, dropHat, getHat, spawnHat, type HatFrame } from '../../view/hats';
import { tween, wait } from '../../vfx/core';
import { E, floorRing, run } from '../../vfx/setpieces';
import type { CinematicContext } from '../api';
import { type EvOf, all, live, rnd, rr } from '../battle/_kit';

type Ctx<T extends GameEvent['type']> = CinematicContext<EvOf<T>>;

const RICH = LOOK_V3;
const HOME = (p: PlayerId, z: number): XY => {
  const a = zoneXY(p, 'monster', z);
  return { x: Math.round(a.x), y: Math.round(a.y + 2) };
};

// ================================================================ timing (scaled-clock ms)

export const RISE_MS = 220;
export const RISE_STAGGER = 30;
export const DROP_MS = 150;
export const DROP_STAGGER = 50;
export const PASS_MS = 265;
export const PASS_GAP = 15;
export const HOVER_LIFT = 20;
export const POP_MS = 420;
export const MOTE_MS = 380;

// ================================================================ tiny particles

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  life: number;
  color: number;
  size: number;
}

/** Fire-and-forget 1-2 px bits (whole pixels, flat colours, the last third blinks out). */
function bits(sc: Phaser.Scene, list: Bit[], depth: number = DEPTH.FX): Promise<void> {
  const objs = list.map((b) => sc.add.rectangle(Math.round(b.x), Math.round(b.y), b.size, b.size, b.color).setOrigin(0.5).setDepth(depth));
  const st = list.map((b) => ({ ...b }));
  const ms = Math.max(...list.map((b) => b.life));
  return run(sc, ms, (_t, el, dt) => {
    st.forEach((b, i) => {
      const o = objs[i];
      if (!o.active) return;
      const s = dt / 1000;
      b.vy += b.ay * s;
      b.x += b.vx * s;
      b.y += b.vy * s;
      o.setPosition(Math.round(b.x), Math.round(b.y));
      const k = el / b.life;
      o.setVisible(k < 1 && (k < 0.66 || Math.floor(el / 40) % 2 === 0));
    });
  }).then(() => objs.forEach((o) => o.destroy()));
}

/** A small plus-shaped star sparkle (gold / white), ~110 ms. */
function star(sc: Phaser.Scene, x: number, y: number, big = false): void {
  const r = big ? 3 : 2;
  const parts: Phaser.GameObjects.Rectangle[] = [
    sc.add.rectangle(Math.round(x), Math.round(y), r * 2 + 1, 1, PAL.gold4),
    sc.add.rectangle(Math.round(x), Math.round(y), 1, r * 2 + 1, PAL.gold4),
    sc.add.rectangle(Math.round(x), Math.round(y), 1, 1, PAL.white),
  ];
  parts.forEach((p) => p.setDepth(DEPTH.FX + 4));
  void wait(sc, 70).then(() => {
    parts[0].width = r + 1;
    parts[1].height = r + 1;
  });
  void wait(sc, 120).then(() => parts.forEach((p) => p.destroy()));
}

/** Dusk-violet mist motes rising off a floor point. */
function mist(sc: Phaser.Scene, at: XY, n = 7): Promise<void> {
  const ramp = [PAL.void3, PAL.void4, PAL.mist, PAL.void2];
  return bits(
    sc,
    Array.from({ length: n }, () => ({ x: at.x + rr(-9, 9), y: at.y + rr(-2, 3), vx: rr(-8, 8), vy: rr(-34, -12), ay: -6, life: rr(260, 420), color: ramp[Math.floor(rnd() * ramp.length)], size: rnd() < 0.35 ? 2 : 1 })),
    DEPTH.FX - 5,
  );
}

function confetti(sc: Phaser.Scene, at: XY, n = 9): Promise<void> {
  const ramp = [PAL.gold3, PAL.gold4, PAL.mag3, PAL.cyan3, PAL.white, PAL.crim3];
  return bits(
    sc,
    Array.from({ length: n }, () => {
      const a = rr(-Math.PI * 0.95, -Math.PI * 0.05);
      const sp = rr(40, 95);
      return { x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 260, life: rr(300, 480), color: ramp[Math.floor(rnd() * ramp.length)], size: rnd() < 0.4 ? 2 : 1 };
    }),
    DEPTH.FX + 2,
  );
}

// ================================================================ hat motion

const tiltFor = (dx: number): HatFrame => (Math.abs(dx) < 1 ? 'hat:0' : dx > 0 ? 'hat:R' : 'hat:L');

/** Dissolve a hat into dusk motes (≤ MOTE_MS) and drop it. */
async function dissolveHat(sc: Phaser.Scene, h: Hat, ms = MOTE_MS): Promise<void> {
  h.busy = true;
  const at = { x: h.x, y: h.y - h.lift - 10 };
  const ramp = [PAL.void4, PAL.void3, PAL.gold3, PAL.mist];
  void bits(
    sc,
    Array.from({ length: RICH ? 12 : 6 }, () => ({ x: at.x + rr(-9, 9), y: at.y + rr(-9, 7), vx: rr(-14, 14), vy: rr(-40, -8), ay: -10, life: rr(ms * 0.5, ms), color: ramp[Math.floor(rnd() * ramp.length)], size: rnd() < 0.3 ? 2 : 1 })),
  );
  // the hat erodes: it blinks out in 4 steps (no fade, flat pixels)
  for (let i = 0; i < 4; i++) {
    h.setVisible(i % 2 === 1);
    await wait(sc, ms / 6);
  }
  dropHat(sc, h.uid);
}

// ================================================================ unit dip / rise (top-down wipe, 4 frames)

/** The monster goes under the hat: its top rows are cut away in 4 steps, then it is hidden. */
async function dipUnder(sc: Phaser.Scene, u: MonsterUnit | null, ms: number): Promise<void> {
  if (!u) return;
  const s = u.sprite;
  for (let k = 1; k <= 4; k++) {
    if (!s.active) return;
    const h = s.height;
    s.setCrop(0, Math.round((h * k) / 4), s.width, h);
    await wait(sc, ms / 4);
  }
  if (s.active) s.setCrop();
  u.hide();
}

/** The monster is shown again: the wipe runs the other way (rows come back from the bottom up). */
async function riseOut(sc: Phaser.Scene, u: MonsterUnit | null, ms: number): Promise<void> {
  if (!u) return;
  const s = u.sprite;
  u.show();
  for (let k = 3; k >= 0; k--) {
    if (!s.active) return;
    const h = s.height;
    s.setCrop(0, Math.round((h * k) / 4), s.width, h);
    await wait(sc, ms / 4);
  }
  if (s.active) s.setCrop();
}

// ================================================================ hatsShuffled

/** Which zone each hat starts the shuffle on: the real hat on the monster's tile, the decoys on the other hat zones. */
export function startZones(sourceZone: number, realUid: Uid, hats: { uid: Uid; zone: number }[]): Map<Uid, number> {
  const out = new Map<Uid, number>();
  out.set(realUid, sourceZone);
  const free = hats.map((h) => h.zone).filter((z) => z !== sourceZone);
  hats.filter((h) => h.uid !== realUid).forEach((h, i) => out.set(h.uid, free[i] ?? h.zone));
  return out;
}

/** Zone orders of the passes: two cyclic shifts of the start order, then the finals (index = hat order). */
export function passPlan(starts: number[], finals: number[], dir: 1 | -1): number[][] {
  const n = starts.length;
  const shift = (a: number[], d: number) => a.map((_, i) => a[(i + d + n * 4) % n]);
  const p1 = shift(starts, 1);
  const p2 = shift(p1, n === 2 ? 1 : dir);
  return [p1, p2, finals];
}

export async function hatsShuffledScene(ctx: Ctx<'hatsShuffled'>): Promise<void> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const p = ev.player;
  const field = ctx.views.field;
  const realUid = ev.sourceUid;
  const realCard = ctx.cardId(realUid);
  const starts = startZones(ev.sourceZone, realUid, ev.hats);
  // the real hat first in the list does not matter to the eye: all three are identical
  const hats = ev.hats.map((h) => ({ ...h, start: starts.get(h.uid) ?? h.zone }));
  const hs: Hat[] = hats.map((h) => {
    const hat = spawnHat(sc, h.uid, p, h.start);
    hat.busy = true;
    hat.setVisible(false);
    return hat;
  });
  const realUnit = live(ctx.unit(realUid));
  const homeOf = (z: number) => HOME(p, z);

  // ---- rise: out of the floor mist, a little above the occupants
  ctx.sfx('hatRise', { volume: 0.9 });
  const rises = hs.map(async (h, i) => {
    await wait(sc, i * RISE_STAGGER);
    const at = homeOf(h.zone);
    if (RICH) void mist(sc, at);
    h.setFrame('hat:0');
    h.place(at.x, at.y, 4);
    h.setVisible(true);
    await run(sc, RISE_MS, (t) => h.place(at.x, at.y, 4 + Math.round(E.outCubic(t) * (HOVER_LIFT - 4))));
  });
  await all(rises);
  await wait(sc, 40);

  // ---- drop: each hat falls over its occupant (the real monster dips under the wipe)
  const drops = hs.map(async (h, i) => {
    await wait(sc, i * DROP_STAGGER);
    const at = homeOf(h.zone);
    const isReal = h.uid === realUid;
    if (isReal) void dipUnder(sc, realUnit, DROP_MS);
    await run(sc, DROP_MS, (t) => h.place(at.x, at.y, Math.round(HOVER_LIFT * (1 - t * t))));
    ctx.sfx('hatThump', { volume: 0.7, pitch: 1 + i * 0.07 });
    if (RICH) void floorRing(sc, at.x, at.y, { r0: 3, r1: 15, ms: 190, ramp: [PAL.void4, PAL.void3, PAL.void2], depth: DEPTH.SHADOW - 1 });
    // a felt bounce: up 2 px, back
    await run(sc, 70, (t) => h.place(at.x, at.y, Math.round(Math.sin(t * Math.PI) * 2)));
  });
  await all(drops);

  // the real monster's own card goes under with it: its tile is emptied, the shuffle carries no tell
  if (realUnit) realUnit.hide();
  field.remove(realUid);

  // ---- shuffle: 3 passes along ground arcs
  const finals = hats.map((h) => h.zone);
  const startList = hats.map((h) => h.start);
  const plan = passPlan(startList, finals, rnd() < 0.5 ? 1 : -1);
  let cur = startList.slice();
  for (let k = 0; k < plan.length; k++) {
    const from = cur.map(homeOf);
    const to = plan[k].map(homeOf);
    ctx.sfx('hatSwish', { volume: 0.55, pitch: 0.92 + k * 0.1 });
    const bulge = hs.map((_, i) => (i % 2 === 0 ? 1 : -1) * (RICH ? 8 : 0));
    let sparked = false;
    await run(sc, PASS_MS, (t) => {
      const e = E.inOutSine(t);
      hs.forEach((h, i) => {
        const dx = to[i].x - from[i].x;
        const arc = Math.sin(e * Math.PI);
        const moving = t > 0.08 && t < 0.92 && Math.hypot(dx, to[i].y - from[i].y) > 2;
        h.setFrame(moving && RICH ? tiltFor(dx) : 'hat:0');
        h.place(from[i].x + dx * e, from[i].y + (to[i].y - from[i].y) * e + bulge[i] * arc, RICH ? Math.round(arc * 5) : 0);
      });
      if (RICH && !sparked && t > 0.5) {
        sparked = true;
        // one star where two hats cross
        const a = hs[0];
        const b = hs[1];
        star(sc, (a.x + b.x) / 2, (a.y + b.y) / 2 - 14, k === 2);
      }
    });
    cur = plan[k].slice();
    if (k < plan.length - 1) await wait(sc, PASS_GAP);
  }

  // ---- settle: a quick hop in turn; the face-down cards are laid under the hats now
  for (const h of hats) {
    const hat = getHat(sc, h.uid);
    if (!hat) continue;
    hat.zone = h.zone;
    const isReal = h.uid === realUid;
    field.placeCard(p, 'monster', h.zone, h.uid, isReal ? realCard : 'magic_hat', false, 'side');
  }
  await all(
    hs.map(async (h, i) => {
      await wait(sc, i * 40);
      const at = homeOf(h.zone);
      await run(sc, 110, (t) => h.place(at.x, at.y, Math.round(Math.sin(t * Math.PI) * 3)));
      h.setFrame('hat:0');
      h.place(at.x, at.y, 0);
      h.busy = false;
    }),
  );
}

// ================================================================ hatChosen

export async function hatChosenScene(ctx: Ctx<'hatChosen'>): Promise<void> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const h = getHat(sc, ev.uid);
  ctx.sfx('lockOn', { volume: 0.5, pitch: 1.2 });
  if (!h) return wait(sc, 120);
  h.busy = true;
  const at = { x: h.x, y: h.y };
  void floorRing(sc, at.x, at.y, { r0: 4, r1: 18, ms: 240, ramp: [PAL.gold4, PAL.gold3, PAL.gold2], depth: DEPTH.SHADOW - 1 });
  await run(sc, 140, (t) => h.place(at.x, at.y, Math.round(Math.sin(t * Math.PI) * 5)));
  h.place(at.x, at.y, 0);
  h.busy = false;
}

// ================================================================ decoyPopped

/** The attacker, if the declared attack's unit is still on screen. */
function attackerOf(ctx: CinematicContext): MonsterUnit | null {
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.type === 'attackDeclare') return live(ctx.unit(e.attackerUid));
  }
  const pd = ctx.before.pending;
  const trig = pd && pd.kind === 'trapResponse' ? pd.trigger : null;
  return trig && trig.kind === 'attackDeclared' ? live(ctx.unit(trig.attackerUid)) : null;
}

export async function decoyPoppedScene(ctx: Ctx<'decoyPopped'>): Promise<void> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const field = ctx.views.field;
  const h = getHat(sc, ev.uid);
  const at = HOME(ev.player, ev.zone);
  const attacker = attackerOf(ctx);
  ctx.sfx('hatPop', { volume: 0.9 });
  const wobble = (async () => {
    if (!attacker || !attacker.sprite.active) return;
    const s = attacker.sprite;
    const r = attacker.rest0;
    const dir = [1, -1, 1, -1, 0];
    attacker.posed = true;
    for (const d of dir) {
      s.x = r.x + d * 2;
      await wait(sc, 55);
    }
    s.x = r.x;
    attacker.posed = false;
  })();
  if (h) {
    h.busy = true;
    // lift (tilting), a hop, then it tumbles away over the side and is gone
    h.setFrame('hat:L');
    await run(sc, 90, (t) => h.place(at.x, at.y, Math.round(E.outCubic(t) * 14)));
    void confetti(sc, { x: at.x, y: at.y - 14 }, RICH ? 11 : 6);
    if (RICH) {
      star(sc, at.x - 7, at.y - 22);
      star(sc, at.x + 8, at.y - 18);
    }
    void floorRing(sc, at.x, at.y, { r0: 3, r1: 18, ms: 220, ramp: [PAL.white, PAL.gold3, PAL.mag3], depth: DEPTH.SHADOW - 1 });
    const side = at.x > 320 ? 1 : -1;
    await run(sc, 200, (t) => {
      h.setFrame(Math.floor(t * 6) % 2 === 0 ? 'hat:R' : 'hat:L');
      h.place(at.x + side * 26 * t, at.y - 14 + Math.round(-Math.sin(t * Math.PI) * 14 + t * t * 26), 0);
    });
    dropHat(sc, ev.uid);
  } else await wait(sc, 120);
  field.remove(ev.uid);
  await wobble;
}

// ================================================================ hatRevealed

export async function hatRevealedScene(ctx: Ctx<'hatRevealed'>): Promise<void> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const h = getHat(sc, ev.uid);
  ctx.sfx('hatReveal', { volume: 0.9 });
  const at = HOME(ev.player, ev.zone);
  if (!h) return wait(sc, 160);
  h.busy = true;
  h.setFrame('hat:R');
  await run(sc, 110, (t) => h.place(at.x, at.y, Math.round(E.outCubic(t) * 18)));
  if (RICH) {
    star(sc, at.x, at.y - 24, true);
    void floorRing(sc, at.x, at.y, { r0: 4, r1: 20, ms: 240, ramp: [PAL.white, PAL.gold4, PAL.gold3], depth: DEPTH.SHADOW - 1 });
  }
  await wait(sc, 60);
  const side = at.x > 320 ? 1 : -1;
  await run(sc, 150, (t) => {
    h.setFrame(Math.floor(t * 5) % 2 === 0 ? 'hat:L' : 'hat:R');
    h.place(at.x + side * 22 * t, at.y - 18 + Math.round(-Math.sin(t * Math.PI) * 8 + t * t * 14), 0);
  });
  await dissolveHat(sc, h, 200);
}

// ================================================================ hatRestore

export async function hatRestoreScene(ctx: Ctx<'hatRestore'>): Promise<void> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const field = ctx.views.field;
  const quick = ev.reason === 'revealed';
  const jobs: Promise<unknown>[] = [];
  ev.removed.forEach((r, i) => {
    jobs.push(
      (async () => {
        await wait(sc, i * 50);
        const h = getHat(sc, r.uid);
        if (h) {
          if (!quick && RICH) h.busy = true;
          await dissolveHat(sc, h, quick ? 260 : MOTE_MS);
        }
        field.remove(r.uid, { fade: true });
      })(),
    );
  });
  if (ev.restored) {
    const r = ev.restored;
    jobs.push(
      (async () => {
        const h = getHat(sc, r.uid);
        if (h) await dissolveHat(sc, h, MOTE_MS);
        if (!r.faceUp) {
          field.placeCard(ev.player, 'monster', r.zone, r.uid, ctx.cardId(r.uid), false, r.position === 'defense' ? 'side' : 'up');
          return;
        }
        ctx.sfx('hatReveal', { volume: 0.5, pitch: 0.9 });
        const { unit } = field.placeMonster(ev.player, r.zone, r.uid, r.cardId ?? ctx.cardId(r.uid), {
          position: r.position,
          faceUp: true,
          hidden: true,
          atk: ctx.atk(r.uid, 'next'),
          def: ctx.def(r.uid, 'next'),
        });
        await riseOut(sc, live(unit), 160);
      })(),
    );
  }
  if (jobs.length) await all(jobs);
  else await wait(sc, 10);
}

export { tween };
