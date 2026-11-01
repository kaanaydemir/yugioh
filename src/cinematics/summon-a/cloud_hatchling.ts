// Bulut Yavrusu (cloud_hatchling) — the signature summon "Bulut Yumurtası" (docs/v3/kart-a/cloud_hatchling.md
// §5.1). v3 look only.
//   during the slam   a small raster cloud drifts in LEVEL from the upper back corner (no dive: that is
//                     storm_hawk's) and stops 46 px above the tile, its dithered shadow following on the floor
//                     (an observer starts it at the summon event's start, off the critical path)
//   0–60              the cloud sags 1 px and lets go: the egg (summon f0) appears under it
//   60–200            the egg falls (Quad.In, whole px), its own drop shadow growing; a falling whistle
//   land (f2)         1-px shake, six dust dashes in a crescent, a stepped leaf4 floor pool
//   f3–f5             three wobbles, the crack growing (the art), the cloud bobbing ±1 px in time, a crack each
//   f7                the top shell pops: five raster shell plates fly out and lie on the floor, blink out
//   f10               it sits, the shell lands on its head: the first squeak
//   f10–f12           the cloud breaks into four puffs that fly down into its chest (the chest tuft), a hiccup
// The body is real from its first frame (no hologram). P2 is mirrored (the cloud enters from the upper right).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { shake } from '../../vfx/core';
import type { Px } from '../../vfx/combat';
import { registerObserver } from '../api';
import { atFrame, fade, panAt, play } from '../_v3/sound';
import { layer } from '../strikes-a/_kit';
import { drawCloud, drawCloudShadow, drawDust, drawPuff } from '../strikes-a/cloud_hatchling-fx';
import { RR, bg, lightFlash, lightPool, playFrom, signatureSummon, untilFrame, type Stage } from './_kit';
import { onFrame } from '../../vfx/combat';

/** Height of the cloud above the tile (px) and its drift-in time (scene ms). */
const CLOUD_Y = 46;
const DRIFT_MS = 200;
const LAND_F = 2;
const BURST_F = 7;
const SIT_F = 10;
const TUFT_F = 12;

/** The summon's cloud: drawn every frame at `pos` (sag / bob / lobe phase), its shadow on the floor. */
class SummonCloud {
  pos: XY;
  sag: 0 | 1 = 0;
  bob = 0;
  phase: 0 | 1 | 2 = 0;
  visible = true;
  private readonly air: Px;
  private readonly floor: Px;
  private dead = false;
  constructor(
    readonly scene: Phaser.Scene,
    readonly home: XY,
    from: XY,
    depth: number,
  ) {
    this.pos = { ...from };
    this.air = layer(scene, depth);
    this.floor = layer(scene, DEPTH.SHADOW + 0.5);
    let acc = 0;
    onFrame(
      scene,
      (dt) => {
        this.air.clear();
        this.floor.clear();
        if (this.dead) return false;
        acc += dt;
        if (acc > 160) {
          acc = 0;
          this.phase = ((this.phase + 1) % 3) as 0 | 1 | 2;
        }
        if (!this.visible) return true;
        drawCloud(this.air, this.pos.x, this.pos.y + this.bob, 22, 10, this.sag, this.phase);
        // the shadow sits on the floor under the cloud (whole px, the unit shadow's dither)
        const k = Math.max(0, Math.min(1, 1 - Math.abs(this.home.y - CLOUD_Y - this.pos.y) / 40));
        drawCloudShadow(this.floor, this.pos.x, this.home.y + 1, 9 + Math.round(4 * k));
        return true;
      },
      () => {
        this.air.g.destroy();
        this.floor.g.destroy();
      },
    );
  }
  destroy(): void {
    this.dead = true;
  }
}

/** Clouds started by the observer (per uid), picked up by the entrance. */
const pending = new Map<number, SummonCloud>();

function cloudStart(home: XY, player: number): XY {
  // level drift from the upper back corner of the tile: P1 from the upper left, P2 from the upper right
  const dx = player === 0 ? -1 : 1;
  return { x: Math.round(home.x + dx * 60), y: Math.round(home.y - CLOUD_Y - 6) };
}

function driftIn(c: SummonCloud, ms: number): void {
  const from = { ...c.pos };
  const to = { x: c.home.x, y: c.home.y - CLOUD_Y };
  onFrame(c.scene, (_dt, el) => {
    const t = Math.min(1, el / ms);
    const e = 1 - (1 - t) * (1 - t);
    c.pos = { x: Math.round(from.x + (to.x - from.x) * e), y: Math.round(from.y + (to.y - from.y) * e) };
    return t < 1;
  });
}

/** The entrance after the slam (S.unit hidden on its tile). */
async function eggDropV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const home = S.home;
  const pan = panAt(home.x);
  fade(['summonCharge'], 120);
  let cloud = pending.get(u.uid) ?? null;
  pending.delete(u.uid);
  if (!cloud || !cloud.pos) {
    // no observer (a replay): the cloud is already in place
    cloud = new SummonCloud(sc, home, { x: home.x, y: home.y - CLOUD_Y }, S.depth + 0.5);
  } else if (cloud.pos.x !== home.x) driftIn(cloud, 80);
  const c = cloud;
  S.own({ destroy: () => c.destroy() });
  const live = () => !u.retired && u.sprite.active;

  // ---- 0–60: the cloud sags and lets go
  c.sag = 1;
  await S.wait(60);
  c.sag = 0;
  // ---- the egg falls (Quad.In, whole px) on summon f0 / f1
  const fallFrom = CLOUD_Y - 8;
  u.pose('summon', 0);
  u.showSprite();
  u.badge.setVisible(false);
  play('hatchEggDrop', { volume: 0.8, pan });
  const fall = 140;
  const run = playFrom(u, 'summon', 0);
  bg(run);
  await new Promise<void>((resolve) => {
    onFrame(sc, (_dt, el) => {
      if (!live()) {
        resolve();
        return false;
      }
      const t = Math.min(1, el / fall);
      const lift = Math.round(fallFrom * (1 - t * t));
      u.sprite.setPosition(S.rest.x, S.rest.y - lift);
      u.lift = lift;
      if (t >= 1) {
        resolve();
        return false;
      }
      return true;
    });
  });
  u.lift = 0;
  if (live()) u.sprite.setPosition(S.rest.x, S.rest.y);

  // ---- land (f2): shake, dust crescent, a stepped leaf4 pool; then the wobbles and the burst
  atFrame(u, 'summon', LAND_F, () => {
    play('hatchEggLand', { volume: 0.9, pan });
    bg(shake(sc, 120, 1));
    dust(sc, home, S.depth - 0.2);
    void lightFlash(sc, home.x, home.y, PAL.leaf4, 22, 160, { floorY: home.y, intensity: 0.6 });
  });
  [3, 4, 5].forEach((f, i) =>
    atFrame(u, 'summon', f, () => {
      play('hatchCrack', { volume: 0.75, pitch: [1, 1.12, 1.26][i], pan });
      c.bob = i % 2 === 0 ? -1 : 1;
      // (crit c3r1 #6) the wait inside the egg ESCALATES: inside each 150 ms wobble the shell rattles
      // 1 → 2 → 3 times (a whole-px knock sideways and back, each with a small chip tick a step higher),
      // so the 600 game ms before the hatch is a build, never a held egg
      const n = i + 1;
      const gapMs = Math.floor(u.frameMs('summon', f) / (n + 1));
      for (let k = 1; k <= n; k++) {
        const dx = (k + i) % 2 === 0 ? 1 : -1;
        void S.wait(gapMs * k).then(() => {
          if (!live() || u.frameInfo().anim !== 'summon' || u.frameInfo().frame !== f) return;
          u.sprite.setPosition(S.rest.x + dx, S.rest.y);
          play('hatchCrack', { volume: 0.3 + 0.08 * i, pitch: 1.35 + 0.12 * (i + k), pan });
          return S.wait(34).then(() => {
            if (live() && u.lift === 0) u.sprite.setPosition(S.rest.x, S.rest.y);
          });
        });
      }
    }),
  );
  atFrame(u, 'summon', 6, () => (c.bob = 0));
  atFrame(u, 'summon', BURST_F, () => {
    play('hatchShellBurst', { volume: 0.9, pan });
    void lightFlash(sc, home.x, home.y - 10, PAL.skin4, 20, 100, { floorY: home.y, intensity: 0.8 });
    shellPlates(sc, u, home, S.depth);
  });
  atFrame(u, 'summon', SIT_F, () => {
    play('hatchCheep', { volume: 0.85, pan });
    puffsToChest(sc, c, u, S.depth + 0.3);
  });
  atFrame(u, 'summon', TUFT_F, () => play('hatchHiccup', { volume: 0.7, pan }));
  const pool = lightPool(sc, home.x, home.y, { color: PAL.leaf2, radius: 24, intensity: 0, fadeIn: 0 });
  pool.setIntensity(0.5, 200);
  await untilFrame(u, 'summon', u.frameCount('summon') - 1);
  bg(u.badge.pop());
  void pool.fadeOut(260);
  await run;
}

/** Six 2-px dust dashes pushed out in a crescent from the landing. */
function dust(sc: Phaser.Scene, home: XY, depth: number): void {
  const px = layer(sc, depth);
  const ds = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI * (0.15 + (0.7 * i) / 5);
    const side = i < 3 ? -1 : 1;
    return { x: home.x + side * 6, y: home.y + 1, vx: side * RR(30, 50), vy: Math.sin(a) * 6 };
  });
  onFrame(
    sc,
    (_dt, el) => {
      px.clear();
      const t = el / 280;
      if (t >= 1) return false;
      const s = (el / 1000) * (1 - t * 0.5);
      for (const d of ds) drawDust(px, d.x + d.vx * s, d.y + d.vy * s, t);
      return true;
    },
    () => px.g.destroy(),
  );
}

/** Five shell plates (2–3 px, shell tones) fly out of the burst, lie 500 ms on the floor, blink out in steps. */
function shellPlates(sc: Phaser.Scene, u: MonsterUnit, home: XY, depth: number): void {
  const px = layer(sc, depth + 0.2);
  const o = u.framePoint(40, 56);
  const ps = Array.from({ length: 5 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return { x: o.x, y: o.y, vx: side * RR(25, 60), vy: RR(-110, -70), w: i % 2 ? 3 : 2, fy: home.y + Math.round(RR(-3, 4)), landed: -1, c: i % 3 === 0 ? PAL.earth4 : PAL.skin4 };
  });
  onFrame(
    sc,
    (dt, el) => {
      px.clear();
      let any = false;
      for (const p of ps) {
        if (p.landed < 0) {
          p.vy += (420 * dt) / 1000;
          p.x += (p.vx * dt) / 1000;
          p.y += (p.vy * dt) / 1000;
          if (p.y >= p.fy && p.vy > 0) {
            p.y = p.fy;
            p.landed = el;
          }
        }
        const age = p.landed < 0 ? 0 : el - p.landed;
        if (age > 620) continue;
        any = true;
        // blink out in steps: whole plate → its lit half → one pixel
        const w = age > 560 ? 1 : age > 500 ? Math.max(1, p.w - 1) : p.w;
        px.rect(Math.round(p.x), Math.round(p.y) - 1, w, 1, p.c).rect(Math.round(p.x), Math.round(p.y), w, 1, PAL.earth2);
      }
      return any;
    },
    () => px.g.destroy(),
  );
}

/** The cloud breaks into four puffs that fly down into the baby's chest (stepped mist → white). */
function puffsToChest(sc: Phaser.Scene, c: SummonCloud, u: MonsterUnit, depth: number): void {
  const px = layer(sc, depth);
  const from = { ...c.pos };
  c.visible = false;
  const offs = [-7, -2, 3, 8];
  const ms = 300;
  onFrame(
    sc,
    (_dt, el) => {
      px.clear();
      if (!u.sprite.active) return false;
      const to = u.core();
      let any = false;
      offs.forEach((dx, i) => {
        const t = Math.min(1, Math.max(0, (el - i * 35) / (ms - 105)));
        if (t >= 1) return;
        any = true;
        const e = t * t;
        drawPuff(px, from.x + dx + (to.x - from.x - dx) * e, from.y + (to.y - 2 - from.y) * e, t);
      });
      if (!any) c.destroy();
      return any;
    },
    () => px.g.destroy(),
  );
}

if (LOOK_V3) {
  signatureSummon('cloud_hatchling', (S) => S.ctx.base(), { v3: eggDropV3 });
  // the cloud drifts in during the hand take and the slam (observers run at the event's start)
  registerObserver((ev, ctx) => {
    if (ev.type !== 'summon' || ev.cardId !== 'cloud_hatchling' || ev.from !== 'hand') return;
    const h = zoneXY(ev.player, 'monster', ev.zone);
    const c = new SummonCloud(ctx.scene, h, cloudStart(h, ev.player), unitDepth(h.y) + 0.5);
    pending.get(ev.uid)?.destroy();
    pending.set(ev.uid, c);
    play('hatchCloudDrift', { volume: 0.8, pan: panAt(h.x) });
    driftIn(c, DRIFT_MS);
  });
}
