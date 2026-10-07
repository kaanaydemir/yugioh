// Fırtına Atmacası — "Kasırga Dalışı" (GAME_DESIGN §7).
//
// Strike (≈1.4 s; direct ≈1.8 s):
//   crouch (wind gathers) → LAUNCH: stretch, furious wing beats, wind ring + leaves off the floor
//   → apex: climb beat (attack f1), wings swing up and fold (f2), eye glint → corkscrew DIVE
//   (tucked f3/f4, afterimages, a twin wind trail) → CONTACT on f5 (talons on the target's core):
//   three white-teal wind cuts slice the target, feathers and leaves burst, a wind ring on the
//   floor → clench (f6) → arc back home (f7–f9), landing flap.
//   Direct attack: the climb turns into a long arc OVER the enemy monsters, then the dive drops
//   onto the duelist behind them; it arcs back over on the way home.
//   Blocked: the talons clang off the guard, the hawk is flung back tumbling (hit pose), feathers
//   tear loose, it wobbles home.
// Death: struck out of the air — feathers explode, it tumbles and drops, then shatters while a
//   last flurry of feathers drifts down.

import { PAL, RAMPS } from '../../art/palette';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { wait } from '../../vfx/core';
import { afterimages, whiteFlash } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerCardHook, registerStrike } from '../api';
import {
  E,
  Sparks,
  vlerp,
  animate,
  clamp,
  facing,
  flavoredDeath,
  glint,
  groundRing,
  homeSprite,
  layer,
  lerp,
  placeFor,
  playFrom,
  pose,
  qbez,
  reseed,
  rr,
  seg,
  sleep,
  streakCut,
  vlen,
  vnorm,
  vsub,
  type StrikeArgs,
} from './_kit';

const WIND = [PAL.teal2, PAL.teal3, PAL.teal4, PAL.white] as const;
const FEATHER = [PAL.leaf4, PAL.leaf3, PAL.teal3, PAL.leaf2] as const;
/** The hawk's eye in the attack climb frames (frame px). */
const EYE = { x: 37, y: 17 };

/** Feathers that flutter down (slow fall, tumbling). */
function feathers(sp: Sparks, at: XY, n: number, o: { up?: number; spread?: number; floor?: number } = {}): void {
  for (let i = 0; i < n; i++) {
    const a = rr(0, Math.PI * 2);
    const v = rr(20, o.spread ?? 70);
    sp.add({
      x: at.x + rr(-4, 4),
      y: at.y + rr(-4, 4),
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v * 0.6 - (o.up ?? 30),
      ay: 55,
      drag: 2.2,
      life: rr(700, 1300),
      rot: rr(0, 6),
      vrot: rr(-7, 7),
      colors: FEATHER,
      shape: 'shard',
      size: rr(2.2, 3.2),
      fadeAt: 0.75,
      floor: o.floor,
      bounce: 0.05,
    });
  }
}

/** Wind trail + shadow tracking + a little wind aura around the bird while it flies. */
function flightFx(s: StrikeArgs, groundOf: (p: XY) => number): { stop(): void } {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const trail = layer(sc, spr.depth - 0.5);
  const sp = new Sparks(sc, DEPTH.FX - 3);
  const hist: XY[] = [];
  let alive = true;
  let frame = 0;
  const ev = sc.events;
  const upd = () => {
    if (!alive || !spr.active) return;
    frame++;
    const c = u.core();
    // shadow stays on the floor under the bird
    const gy = groundOf({ x: spr.x, y: spr.y });
    u.lift = Math.max(0, gy - (spr.y + u.hover));
    hist.unshift(c);
    if (hist.length > 10) hist.pop();
    // keep the ribbon short (≈34 px) so fast moves read as a gust, not a rope
    let acc = 0;
    for (let i = 1; i < hist.length; i++) {
      acc += vlen(vsub(hist[i - 1], hist[i]));
      if (acc > 34) {
        hist.length = i + 1;
        break;
      }
    }
    trail.g.setDepth(spr.depth - 0.5);
    trail.clear();
    for (let i = 1; i < hist.length; i++) {
      const k = 1 - i / hist.length;
      const a = hist[i - 1];
      const b = hist[i];
      const d = vnorm(vsub(a, b));
      const n = { x: -d.y, y: d.x };
      for (const side of [-1, 1]) {
        const o = side * (2 + 4 * (1 - k));
        trail.line(a.x + n.x * o, a.y + n.y * o, b.x + n.x * o, b.y + n.y * o, i < 3 ? PAL.white : i < 7 ? PAL.teal4 : PAL.teal3, k * 0.9);
      }
    }
    // wind dashes curling round the body
    if (frame % 2 === 0 && hist.length > 2 && vlen(vsub(hist[0], hist[2])) > 3) {
      const a = rr(0, Math.PI * 2);
      sp.add({ x: c.x + Math.cos(a) * 9, y: c.y + Math.sin(a) * 6, vx: -Math.sin(a) * 60, vy: Math.cos(a) * 40, drag: 4, life: rr(120, 220), colors: [PAL.white, PAL.teal4, PAL.teal3], shape: 'streak', len: 0.05 });
    }
  };
  ev.on('postupdate', upd);
  return {
    stop() {
      alive = false;
      ev.off('postupdate', upd);
      // let the trail shrink away
      const pts = hist.slice();
      void animate(sc, 160, (t) => {
        trail.clear();
        const n = Math.floor(pts.length * (1 - t));
        for (let i = 1; i < n; i++) trail.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, PAL.teal3, (1 - t) * 0.7);
      }).then(() => trail.g.destroy());
      sp.release();
    },
  };
}

/** Rotation (deg) for flying along velocity v, nose-down positive in the facing direction. */
function tiltFor(u: MonsterUnit, v: XY, max = 55): number {
  const d = facing(u);
  const ang = Math.atan2(v.y, Math.abs(v.x) + 0.001) * (180 / Math.PI);
  const fwd = v.x * d >= 0 ? 1 : -1;
  return clamp(ang * fwd, -35, max) * d;
}

async function hawkStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const d = facing(u);
  reseed(u.uid * 97 + (s.direct ? 7 : 3));
  u.rest();
  homeSprite(u);
  const home = { x: spr.x, y: spr.y };
  const floor0 = u.home;
  const target = s.target;
  const hitPt: XY = s.direct || !target ? s.to : target.core();
  // talons (the impact-frame muzzle) land on the hit point; a blocked hawk stops a little short
  const back = vnorm(vsub(home, hitPt));
  const aim = s.blocked ? { x: hitPt.x + back.x * 5, y: hitPt.y + back.y * 3 } : hitPt;
  const contact = placeFor(u, u.art.muzzle.x, u.art.muzzle.y, aim);
  const floorC = s.direct ? { x: s.toGround.x, y: s.toGround.y } : { x: s.toGround.x + back.x * 8, y: s.toGround.y + back.y * 8 };
  // floor y under a point, interpolated along the flight's ground track
  const span = floorC.x - floor0.x || 1;
  const groundOf = (p: XY) => lerp(floor0.y, floorC.y, clamp((p.x - floor0.x) / span, 0, 1));
  const fx = flightFx(s, groundOf);
  const sp = new Sparks(sc, DEPTH.FX + 1);
  const leafy = new Sparks(sc, DEPTH.TILE_FX + 6);
  const baseDepth = unitDepth(u.home.y);
  const tDepth = target ? target.sprite.depth : baseDepth;
  try {
    // ---- 1. crouch: the wind gathers (anticipation)
    s.ctx.sfx('windGust', { volume: 0.45, pitch: 1.25 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const c = u.core();
      sp.add({ x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 12, tx: c.x, ty: c.y + 4, curl: 10, life: rr(160, 220), colors: [PAL.teal3, PAL.teal4, PAL.white], shape: i % 3 ? 'px' : 'plus', size: 1 });
    }
    await animate(sc, 120, (t) => {
      const e = E.outQ(t);
      spr.setScale(1 + 0.1 * e, 1 - 0.16 * e);
      spr.y = Math.round(home.y + 2 * e);
    });

    // ---- 2. launch: stretch + furious beats, wind ring and leaves off the floor
    s.ctx.sfx('windGust', { volume: 0.9 });
    s.ctx.sfx('whoosh', { volume: 0.6, pitch: 0.8 });
    void groundRing(sc, floor0.x, floor0.y, { r0: 6, r1: 34, ms: 380, colors: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2] });
    for (let i = 0; i < 12; i++) {
      const a = rr(0, Math.PI * 2);
      leafy.add({ x: floor0.x + Math.cos(a) * 8, y: floor0.y + Math.sin(a) * 3, vx: Math.cos(a) * rr(50, 110), vy: Math.sin(a) * 30 - rr(20, 70), ay: 90, drag: 2, life: rr(400, 700), rot: rr(0, 6), vrot: rr(-10, 10), colors: [PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: 'shard', size: rr(1.4, 2.2) });
    }
    spr.anims.timeScale = 2.4;
    // body-centred placement: the motion paths below move the CORE; rotation / roll happen about it
    const rel = { x: (u.art.core.x - u.art.anchorX) * d, y: u.art.core.y - u.art.anchorY };
    const place = (c: XY, ang: number, sx = 1, sy = 1) => {
      const r = (ang * Math.PI) / 180;
      const cs = Math.cos(r);
      const sn = Math.sin(r);
      const lx = rel.x * sx;
      const ly = rel.y * sy;
      spr.setAngle(ang).setScale(sx, sy);
      spr.setPosition(Math.round(c.x - (lx * cs - ly * sn)), Math.round(c.y - (lx * sn + ly * cs)));
    };
    const core0 = { x: home.x + rel.x, y: home.y + rel.y };
    const coreC = { x: contact.x + rel.x, y: contact.y + rel.y };
    // climb up and a little back (anticipation): the dive then has room to corkscrew down
    const apex = s.direct ? { x: core0.x - d * 6, y: core0.y - 46 } : { x: core0.x - d * 8, y: Math.min(core0.y - 40, coreC.y - 24) };
    await animate(sc, 220, (t) => {
      const e = E.outC(t);
      const st = 1 - seg(t, 0, 0.5);
      place({ x: lerp(core0.x, apex.x, e), y: lerp(core0.y + 2, apex.y, e) }, -8 * d * (1 - t), 1 - 0.12 * st, 1 + 0.18 * st);
    });
    spr.setScale(1);
    spr.anims.timeScale = 1;

    let diveFrom = apex;
    if (s.direct) {
      // ---- 2b. the long arc over the enemy monsters (wings beating, then a glide)
      const opp = u.player === 0 ? 1 : 0;
      const row = [0, 1, 2].map((i) => s.ctx.views.field.unitAt(opp, i)).filter((x): x is MonsterUnit => !!x && x.sprite.visible);
      const topY = row.length ? Math.min(...row.map((m) => m.worldPoint('top').y)) : Math.min(apex.y, s.to.y);
      const P = { x: coreC.x - d * 22, y: Math.min(coreC.y - 44, topY - 14) };
      const ctrl = { x: (apex.x + P.x) / 2, y: Math.min(apex.y, P.y, topY) - 20 };
      void s.ctx.focus({ x: (apex.x + s.to.x) / 2, y: (P.y + s.to.y) / 2 }, { zoom: 1.04, ms: 380, pan: 0.3 });
      spr.anims.timeScale = 1.6;
      let prev = apex;
      await animate(sc, 400, (t) => {
        const p = qbez(apex, ctrl, P, E.inOutQ(t));
        place(p, tiltFor(u, vsub(p, prev), 25) * 0.6);
        spr.setDepth(Math.max(baseDepth, tDepth) + 2);
        prev = p;
      });
      spr.anims.timeScale = 1;
      diveFrom = P;
    }

    // ---- 3. apex: climb beat, wings fold, eye glint
    pose(u, 'attack', 1);
    const a0 = spr.angle;
    await animate(sc, 45, (t) => place({ x: diveFrom.x, y: diveFrom.y - 3 * E.outQ(t) }, lerp(a0, -10 * d, t)));
    pose(u, 'attack', 2);
    const eye = u.framePoint(EYE.x, EYE.y);
    void glint(sc, eye.x, eye.y, { size: 6, ms: 200, color: PAL.teal4 });
    s.ctx.sfx('whoosh', { volume: 0.7, pitch: 1.5 });
    await animate(sc, 50, (t) => place({ x: diveFrom.x, y: diveFrom.y - 3 + 2 * t }, -10 * d));
    const start = { x: diveFrom.x, y: diveFrom.y - 1 };

    // ---- 4. corkscrew dive: the bird barrel-rolls round the flight line (tucked f3 → f4)
    const diveMs = s.direct ? 250 : 290;
    const dv = vsub(coreC, start);
    const L = vlen(dv) || 1;
    const nrm = { x: -dv.y / L, y: dv.x / L };
    const below = (Math.atan2(dv.y, Math.abs(dv.x)) * 180) / Math.PI;
    const diveAng = clamp(below - 22, -20, 48) * d;
    const R0 = s.direct ? 9 : 13;
    void afterimages(sc, spr, diveMs, PAL.teal3, { every: 30, alpha: 0.5, life: 170 });
    s.ctx.sfx('windGust', { volume: 0.55, pitch: 1.9 });
    await animate(sc, diveMs, (t) => {
      const e = 0.25 * t + 0.75 * t * t;
      pose(u, 'attack', t < 0.4 ? 3 : 4);
      const roll = seg(t, 0, 0.8);
      const phi = roll * Math.PI * 2;
      const r = R0 * Math.sin(Math.PI * roll);
      const base = vlerp(start, coreC, e);
      const p = { x: base.x + nrm.x * Math.sin(phi) * r, y: base.y + nrm.y * Math.sin(phi) * r };
      const cy = Math.cos(phi);
      const sy = Math.sign(cy || 1) * Math.max(0.3, Math.abs(cy));
      const k = seg(t, 0.8, 1);
      place(p, lerp(diveAng, -6 * d, k), 1, roll < 1 ? sy : 1);
      spr.setDepth(Math.max(baseDepth, tDepth) + 2);
    });

    // ---- 5. contact
    spr.setPosition(contact.x, contact.y).setScale(1);
    if (s.blocked) {
      pose(u, 'hit', 0);
      spr.setAngle(-20 * d);
      s.impact(hitPt);
      feathers(sp, u.core(), 6, { spread: 90 });
      s.ctx.sfx('windGust', { volume: 0.5, pitch: 1.6 });
      // flung back, tumbling
      const away = { x: contact.x + back.x * 26, y: contact.y - 20 };
      await animate(sc, 260, (t) => {
        const e = E.outC(t);
        spr.setPosition(Math.round(lerp(contact.x, away.x, e)), Math.round(lerp(contact.y, away.y, e)));
        spr.setAngle(-d * (20 + 50 * e));
        if (t > 0.5) pose(u, 'hit', 1);
      });
      void playFrom(u, 'hit', 2, { hold: true });
      // wobbly return home
      const from = { x: spr.x, y: spr.y };
      await animate(sc, 420, (t) => {
        const e = E.inOutQ(t);
        const p = qbez(from, { x: (from.x + home.x) / 2, y: Math.min(from.y, home.y) - 16 }, home, e);
        spr.setPosition(Math.round(p.x + Math.sin(t * 18) * 2 * (1 - t)), Math.round(p.y));
        spr.setAngle(-d * 70 * (1 - e) * Math.cos(t * 3));
        spr.setDepth(lerp(Math.max(baseDepth, tDepth) + 2, baseDepth, t));
      });
    } else {
      pose(u, 'attack', 5);
      spr.setAngle(-6 * d);
      s.impact(hitPt);
      s.ctx.sfx('slash', { volume: 0.7, pitch: 1.35 });
      s.ctx.sfx('windGust', { volume: 0.6, pitch: 1.4 });
      // "Beyaz-yeşil rüzgâr kesikleri hedefi yarar": three wind cuts across the target
      const c = hitPt;
      const big = s.direct ? 1.25 : 1;
      void streakCut(sc, c, d > 0 ? 0.85 : Math.PI - 0.85, { len: 36 * big, width: 3, ramp: [PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4, PAL.white] });
      void streakCut(sc, c, d > 0 ? 2.3 : Math.PI - 2.3, { len: 32 * big, width: 3, ramp: [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4, PAL.white], delay: 55 });
      void streakCut(sc, { x: c.x, y: c.y + 3 }, d > 0 ? 0.1 : Math.PI - 0.1, { len: 40 * big, width: 2, ramp: [PAL.steel, PAL.mist, PAL.teal4, PAL.white, PAL.white], delay: 110 });
      void wait(sc, 60).then(() => s.ctx.sfx('slash', { volume: 0.5, pitch: 1.7 }));
      feathers(sp, u.core(), 5, { spread: 60, up: 10 });
      for (let i = 0; i < 10; i++) {
        const a = rr(-0.9, 0.9) + (d > 0 ? -0.4 : Math.PI + 0.4);
        sp.add({ x: c.x, y: c.y, vx: Math.cos(a) * rr(70, 150), vy: Math.sin(a) * rr(40, 110), ay: 120, drag: 3, life: rr(300, 520), rot: rr(0, 6), vrot: rr(-12, 12), colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2], shape: 'shard', size: rr(1.4, 2.2) });
      }
      void groundRing(sc, s.toGround.x, s.toGround.y, { r0: 8, r1: 40, ms: 420, colors: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2] });
      // talons push through, clench (f6)
      await animate(sc, 130, (t) => {
        const k = Math.sin(Math.PI * t);
        spr.x = Math.round(contact.x - back.x * 3 * k);
        spr.y = Math.round(contact.y - back.y * 2 * k);
        if (t > 0.45) pose(u, 'attack', 6);
      });
      // ---- 6. arc back home (f7–f9), over the monsters again on a direct attack
      const from = { x: spr.x, y: spr.y };
      const lift = s.direct ? 70 : 40;
      const ctrl = { x: (from.x + home.x) / 2 + back.x * 6, y: Math.min(from.y, home.y) - lift };
      void playFrom(u, 'attack', 7, { hold: true }).then(() => {
        if (!u.retired && spr.active) spr.play({ key: `mon:${u.cardId}:idle`, repeat: -1 });
      });
      let pv = from;
      const retMs = s.direct ? 460 : 380;
      await animate(sc, retMs, (t) => {
        const e = E.inOutQ(t);
        const p = qbez(from, ctrl, home, e);
        spr.setPosition(Math.round(p.x), Math.round(p.y));
        spr.setAngle(lerp(-12 * d, 0, t) + (t < 0.8 ? 0 : 0));
        spr.setDepth(t < 0.5 ? Math.max(baseDepth, tDepth) + 2 : baseDepth);
        pv = p;
      });
      void pv;
    }
    // ---- 7. landing flap
    spr.setPosition(home.x, home.y).setAngle(0);
    s.ctx.sfx('windGust', { volume: 0.3, pitch: 1.8 });
    await animate(sc, 140, (t) => {
      const k = Math.sin(Math.PI * t);
      spr.setScale(1 + 0.08 * k, 1 - 0.1 * k);
    });
  } finally {
    fx.stop();
    sp.release();
    leafy.release();
    homeSprite(u);
    if (!u.retired && spr.active && u.frameInfo().anim !== 'idle') u.rest();
  }
}

registerStrike('storm_hawk', hawkStrike);

// ---------------------------------------------------------------- death

registerCardHook('storm_hawk', 'destroyed', (ctx) =>
  flavoredDeath(ctx, {
    async flavor(u, info) {
      const sc = ctx.scene;
      const spr = u.sprite;
      const d = facing(u);
      const sp = new Sparks(sc, DEPTH.FX + 1);
      pose(u, 'hit', 0);
      if (info.hit) await whiteFlash(sc, spr, 2);
      ctx.sfx('windGust', { volume: 0.5, pitch: 0.7 });
      feathers(sp, u.core(), 10, { spread: 80, floor: u.home.y + 4 });
      // struck out of the air: tumble and drop
      const y0 = spr.y;
      const x0 = spr.x;
      const kx = info.push ? Math.sign(info.push.x) * 6 : -d * 6;
      await animate(sc, 300, (t) => {
        const e = E.inQ(t);
        spr.setAngle(-d * 75 * E.outQ(t));
        spr.setPosition(Math.round(x0 + kx * E.outQ(t)), Math.round(y0 + 8 * e));
        u.lift = Math.max(0, -8 * e);
        if (t > 0.5) pose(u, 'hit', 1);
      });
      sp.release();
    },
    glitchMs: 90,
    push: (_u, p) => ({ x: (p?.x ?? 0) * 0.5, y: 1 }),
    onBurst(u, at) {
      const sp = new Sparks(ctx.scene, DEPTH.FX + 1);
      feathers(sp, at, 14, { spread: 110, up: 50, floor: u.home.y + 6 });
      sp.release();
    },
  }),
);
