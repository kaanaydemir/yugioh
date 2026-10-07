// Gölge Suikastçı — "Gölge Adımı" (GAME_DESIGN §7).
//
// Strike (≈1.7 s):
//   coil low (attack f1), the eyes flash, a pool of shadow opens under him → he SINKS into it →
//   the pool glides along the floor (dark trail) to the far side of the target → he RISES behind
//   it, turned to face its back (coiled f2) → launch (f3), crescent smear (f4) → IMPACT on f5:
//   the dagger tips are exactly on the target's core; two huge violet cuts cross in an X, shadow
//   wisps and ink burst from the wound → he holds (f6), hops back (f7) and melts into the pool,
//   which slides home; he rises in his own tile, the pool closes.
//   Blocked: the X bites the guard (clang), he is knocked back a step before he sinks.
//   Direct: the pool slides to the duelist behind the back row; he rises in front of them.
// Death: he dissolves into shadow — darkens, a pool opens and drinks him halfway while wisps
//   boil off, then shatters into violet shards; the pool closes.

import { PAL, RAMPS } from '../../art/palette';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { shadowPuddle, sinkInto, whiteFlash, xSlash, type Puddle } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerCardHook, registerStrike } from '../api';
import { E, Sparks, animate, facing, flavoredDeath, glint, homeSprite, impactPoint, layer, lerp, playFrom, pose, reseed, rr, sleep, vlen, vnorm, vsub, type StrikeArgs } from './_kit';

/** Eye slit in attack f1 (coiled), frame px. */
const EYE_F1 = { x: 41, y: 26 };

function setFacing(u: MonsterUnit, flip: boolean): void {
  const spr = u.sprite;
  const a = u.art;
  spr.setFlipX(flip);
  spr.setOrigin((flip ? a.w - a.anchorX : a.anchorX) / a.w, a.anchorY / a.h);
}

/**
 * The shadow pool darts along the floor (quick start, soft landing), stretching with speed and
 * leaving a dark trail with violet wisps. (vfx/combat.puddleTravel eases in too slowly here.)
 */
async function glide(u: MonsterUnit, pud: Puddle, from: XY, to: XY, ms: number): Promise<void> {
  const sc = u.scene;
  const trail = layer(sc, DEPTH.TILE_FX + 2);
  const wisps = new Sparks(sc, DEPTH.FX - 2);
  const marks: { x: number; y: number; t: number }[] = [];
  const stretch = (pud as unknown as { _stretch?: (k: number) => void })._stretch;
  await animate(sc, ms, (t, el, dt) => {
    const e = 0.5 * t + 0.5 * t * t * (3 - 2 * t);
    const p = { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) };
    pud.setPosition(Math.round(p.x), Math.round(p.y));
    stretch?.(1 + 0.6 * Math.sin(Math.PI * t));
    if (!marks.length || vlen(vsub(p, marks[marks.length - 1])) > 3) marks.push({ x: p.x, y: p.y, t: el });
    trail.clear();
    for (const m of marks) {
      const age = Math.min(1, (el - m.t) / 320);
      if (age < 1) trail.ellipse(m.x, m.y, 10 * (1 - age * 0.6), 4 * (1 - age * 0.6), PAL.void1, 0.8 * (1 - age));
    }
    if (dt > 0)
      for (let i = 0; i < 2; i++) wisps.add({ x: p.x + rr(-8, 8), y: p.y + rr(-2, 2), vx: rr(-10, 10), vy: -rr(20, 50), drag: 1, life: rr(250, 450), colors: [PAL.void4, PAL.void3, PAL.void2], shape: 'px' });
  });
  stretch?.(1);
  wisps.release();
  void animate(sc, 260, (t) => {
    trail.clear();
    for (const m of marks) trail.ellipse(m.x, m.y, 4, 1.6, PAL.void1, 0.5 * (1 - t));
  }).then(() => trail.g.destroy());
}

/** Shadow wisps + ink drops bursting from a cut. */
function inkBurst(sp: Sparks, at: XY, dir: XY, k = 1): void {
  const base = Math.atan2(dir.y, dir.x);
  for (let i = 0; i < 12 * k; i++) {
    const a = base + rr(-1.3, 1.3);
    const v = rr(50, 140);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, ay: 200, drag: 3, life: rr(260, 480), colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: i % 3 ? 'sq' : 'px', size: 2 });
  }
  for (let i = 0; i < 8 * k; i++) {
    const a = rr(0, Math.PI * 2);
    sp.add({ x: at.x + Math.cos(a) * 4, y: at.y + Math.sin(a) * 4, vx: Math.cos(a) * 16, vy: -rr(20, 50), drag: 1, life: rr(400, 700), colors: [PAL.void3, PAL.void2, PAL.void1, PAL.void0], shape: 'puff', size: rr(1.5, 2.5), grow: 3, alpha: 0.7 });
  }
}

async function shadeStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const d = facing(u);
  reseed(u.uid * 71 + 9);
  u.rest();
  homeSprite(u);
  const home = { x: spr.x, y: spr.y };
  const target = s.target;
  const hitPt: XY = s.direct || !target ? s.to : target.core();
  // he rises on the far side, facing back toward the target: at f5 the dagger tips (muzzle) land
  // exactly on the hit point (the art's own lunge is part of the muzzle offset)
  const dE = -d;
  const extra = s.blocked ? 6 : 0;
  const E0 = { x: Math.round(hitPt.x - (u.art.muzzle.x - u.art.anchorX + extra) * dE), y: Math.round(hitPt.y - (u.art.muzzle.y - u.art.anchorY)) };
  const sp = new Sparks(sc, DEPTH.FX + 2);
  let pud: ReturnType<typeof shadowPuddle> | null = null;
  try {
    // ---- coil, eyes flash, the pool opens
    pose(u, 'attack', 1);
    const eye = u.framePoint(EYE_F1.x, EYE_F1.y);
    void glint(sc, eye.x, eye.y, { size: 5, ms: 200, color: PAL.void4 });
    s.ctx.sfx('darkPulse', { volume: 0.6, pitch: 1.3 });
    pud = shadowPuddle(sc, home.x, home.y, { openMs: 150 });
    await sleep(sc, 140);
    // ---- sink
    pose(u, 'attack', 2);
    await sinkInto(sc, spr, { ms: 170 });
    // ---- the pool glides to the far side of the target
    void s.ctx.focus({ x: (home.x + hitPt.x) / 2, y: (home.y + hitPt.y) / 2 - 10 }, { zoom: 1.06, ms: 300, pan: 0.32 });
    s.ctx.sfx('whoosh', { volume: 0.55, pitch: 0.7 });
    await glide(u, pud, home, E0, 240);
    // ---- rise behind it, facing its back (coiled)
    setFacing(u, dE < 0);
    spr.setPosition(E0.x, E0.y).setDepth(unitDepth(E0.y) + (target ? 0.5 : 0));
    pose(u, 'attack', 2);
    s.ctx.sfx('whoosh', { volume: 0.5, pitch: 1.6 });
    await sinkInto(sc, spr, { ms: 140, reverse: true });
    // ---- launch → smear → IMPACT (f5)
    pose(u, 'attack', 3);
    s.ctx.sfx('slash', { volume: 0.4, pitch: 0.8 });
    await sleep(sc, 70);
    pose(u, 'attack', 4);
    await sleep(sc, 70);
    pose(u, 'attack', 5);
    s.impact(impactPoint(s, hitPt));
    const cut = vnorm(vsub(hitPt, E0));
    void xSlash(sc, hitPt.x, hitPt.y, { ramp: RAMPS.void, size: s.direct ? 32 : 28, ms: 220, gap: 70 });
    if (!s.blocked) inkBurst(sp, hitPt, { x: -cut.x, y: -cut.y }, s.direct ? 1.3 : 1);
    await sleep(sc, 90);
    // ---- hold, hop back
    void playFrom(u, 'attack', 6, { hold: true });
    if (s.blocked) {
      const x0 = spr.x;
      await animate(sc, 160, (t) => {
        spr.x = Math.round(x0 + dE * -8 * E.outQ(t));
        spr.y = Math.round(E0.y - Math.sin(Math.PI * t) * 4);
      });
      pose(u, 'hit', 1);
    } else await sleep(sc, 170);
    // ---- melt back into the pool, slide home, rise
    const at = { x: spr.x, y: E0.y };
    pud.setPosition(at.x, at.y);
    await sinkInto(sc, spr, { ms: 140 });
    setFacing(u, u.flipX);
    spr.setDepth(unitDepth(u.home.y));
    await glide(u, pud, at, home, 220);
    spr.setPosition(home.x, home.y);
    u.rest();
    await sinkInto(sc, spr, { ms: 140, reverse: true });
    await pud.close(150);
    pud = null;
  } finally {
    pud?.destroy();
    sp.release();
    setFacing(u, u.flipX);
    homeSprite(u);
    if (!u.retired && spr.active) {
      spr.setVisible(true).setCrop().clearTint();
      if (u.frameInfo().anim !== 'idle') u.rest();
    }
  }
}

registerStrike('shade_assassin', shadeStrike);

// ---------------------------------------------------------------- death

registerCardHook('shade_assassin', 'destroyed', (ctx) =>
  flavoredDeath(ctx, {
    async flavor(u, info) {
      const sc = ctx.scene;
      const spr = u.sprite;
      const sp = new Sparks(sc, DEPTH.FX + 1);
      pose(u, 'hit', 0);
      if (info.hit) await whiteFlash(sc, spr, 2);
      ctx.sfx('darkPulse', { volume: 0.7, pitch: 0.7 });
      const home = { x: spr.x, y: spr.y };
      const pud = shadowPuddle(sc, u.home.x, u.home.y, { openMs: 140, rx: 17, ry: 7 });
      // darken into shadow and sag into the pool while wisps boil off
      await animate(sc, 380, (t, el) => {
        const k = Math.floor(t * 4) / 4;
        spr.setTint(k < 0.25 ? 0xffffff : k < 0.5 ? PAL.void4 : k < 0.75 ? PAL.void3 : PAL.void2);
        spr.setScale(1 + 0.06 * E.inQ(t), 1 - 0.1 * E.inQ(t));
        spr.x = Math.round(home.x + (t > 0.5 && Math.floor(el / 40) % 2 ? 1 : 0));
        if (t > 0.4) pose(u, 'hit', 1);
        if (Math.floor(el / 30) !== Math.floor((el - 16) / 30)) {
          const c = u.core();
          sp.add({ x: c.x + rr(-9, 9), y: lerp(c.y, u.home.y, rr(0, 1)), vx: rr(-8, 8), vy: -rr(20, 45), drag: 0.8, life: rr(400, 650), colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: rr(0, 1) < 0.3 ? 'sq' : 'px', size: 2 });
        }
      });
      sp.release();
      void sleep(sc, 520).then(() => pud.close(200));
    },
    glitchMs: 70,
    push: () => ({ x: 0, y: -1 }),
  }),
);
