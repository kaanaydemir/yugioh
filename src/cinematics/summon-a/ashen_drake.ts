// Kül Ejderi (ashen_drake) — the signature entrance "the storm builds it" (docs/v3/kart-a/ashen_drake.md
// §5.1). v3 look only (no v1 art: the old look keeps the generic summon). After the shared tribute
// stream:
//   0–120     an ASH MOUND grows on the tile (stepped: stone1 base, stone2 flank, a stone3 crest), dust slides off
//   40–160    a single EMBER falls into it (1 px fire4, a 2-px fire2 trail, wobbling)
//   160       it touches the crest: a 3-px fire4 star for one frame
//   160–260   RING IGNITION: two flames chase round the mound's base from the back and meet at the front
//   260       the pose starts (driven, summon f0); the mound lifts into the ASH TORNADO: 10 stacked 2-px
//             ribbons RISING by whole-pixel steps on the SHOWN frame's bone line (ASHEN_BUILD), plates flung
//             out of them onto the seats the art fills on the next frame (accretion), embers orbiting
//   f3        the chest "güm" (the double heartbeat)
//   f7        the wings BURST out of the storm: the column explodes into loose plates and ember sparks
//   f8        held under the cut-in (S.climax; the portrait's roar)
//   f9–f10    the wind-up: the hanging hem embers flicker and drip, flakes peel, the pool throbs
//   f11       the cloak slams over the shoulders: the landing ash shock (the kit's one shockwave, billows
//             riding its front), a 1 s grey dust layer
//   f13       the rib spill; f14 resolves (the spill cools into the fan in the background)
// No hologram, no beam, no generic circle: the storm BUILDS it. Whole pixels, palette tones, no camera.

import { PAL, RAMPS } from '../../art/palette';
import { ASHEN_BUILD } from '../../art/monsters-v3/ashen_drake';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { atFrame, atMark, fade, panAt, play, start } from '../_v3/sound';
import { Sparks, currentPixels, layer } from '../strikes-a/_kit';
import type { Px } from '../../vfx/combat';
import { RR, bg, clamp, freeze, holdFrame, lerp, lightFlash, lightPool, onFrame, playFrom, signatureSummon, untilFrame, type Stage } from './_kit';
import { shake } from '../../vfx/core';

const STEP = 1000 / 60;

/** a Px layer the stage disposes of (never left on screen by a crashed entrance) */
function lay(S: Stage, depth: number): Px {
  const px = layer(S.scene, depth);
  S.own({ destroy: () => px.g.destroy() });
  return px;
}

/** frame of a summon mark / pose beat (the art's own table: f7 burst, f8 held, f11 slam, f13 spill) */
const BURST_F = 7;
const HOLD_F = 8;
/** f10 = the hanging half-fold (the wind-up), f11 = the first dense-cloak frame (the slam) */
const HANG_F = 10;
const SLAM_F = 11;
const SPILL_F = 13;
const DONE_F = 14;

/** a frame point (P1 frame space) of the unit in world px (the sprite's flip handles P2) */
function fpt(u: MonsterUnit, x: number, y: number): XY {
  const w = u.framePoint(x, y);
  return { x: Math.round(w.x), y: Math.round(w.y) };
}

async function ashenRiseV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const home = S.home;
  const pan = panAt(home.x);
  const n = u.frameCount('summon');
  const holdF = Math.min(n - 1, HOLD_F);
  let gone = false;
  const live = () => !gone && !u.retired && u.sprite.active;

  // ---- 0–260: the mound, the ember, the ring
  fade(['summonCharge'], 120);
  play('ashenMound', { volume: 0.9, pan });
  // above the summoned card lying on the tile (CARD_ON_TILE), under the shadows and the bodies
  const ground = lay(S, DEPTH.SHADOW - 1);
  const air = lay(S, S.depth + 0.6);
  let el0 = 0;
  let starAt = -1;
  const dust: { x: number; vx: number }[] = [];
  for (let i = 0; i < 4; i++) dust.push({ x: 0, vx: (i < 2 ? -1 : 1) * RR(30, 55) });
  let moundK = 0;
  let ringK = 0;
  let tornado = false;
  let liftAt = 1e9;
  const pool = lightPool(sc, home.x, home.y, { color: PAL.fire2, spill: PAL.fire1, radius: 30, intensity: 0, anim: 'flicker', fadeIn: 0 });
  const emberLight = lightPool(sc, home.x, home.y - 90, { color: PAL.fire3, radius: 8, floorY: home.y, air: 0.6, intensity: 0.3 });
  const drawMound = (k: number, lift = 0) => {
    const rx = Math.round(12 * k);
    const h = Math.round(9 * k) - lift;
    if (rx < 1 || h < 1) return;
    for (let j = 0; j < h; j++) {
      const q = (j + 1) / (h + 1);
      const half = Math.round(rx * Math.sqrt(1 - q));
      const y = home.y + 2 - j;
      ground.run(y, home.x - half, home.x + half, q > 0.55 ? PAL.stone2 : PAL.stone1);
      ground.dot(home.x - half, y, q > 0.3 ? PAL.stone2 : PAL.stone1);
      // a stone0 shadow edge on the far (right) flank and the foot: the mound reads on the grey tile
      ground.dot(home.x + half, y, PAL.stone0);
    }
    ground.run(home.y + 3, home.x - rx + 1, home.x + rx - 1, PAL.stone0);
    ground.run(home.y + 2 - h, home.x - 1, home.x + 1, PAL.stone3);
  };
  onFrame(sc, (dt) => {
    el0 += dt;
    ground.clear();
    air.clear();
    if (gone) return false;
    if (!tornado) {
      moundK = clamp(el0 / 120, 0, 1);
      drawMound(moundK);
      // the dust slides off the mound
      if (el0 < 260)
        for (const d of dust) {
          d.x += (d.vx * dt) / 1000;
          ground.rect(Math.round(home.x + d.x), home.y + 2 - Math.round(Math.abs(d.x) * 0.1), 2, 1, PAL.stone1);
        }
      // the ember falls (40 → 160 ms)
      if (el0 >= 40 && el0 < 160) {
        const k = (el0 - 40) / 120;
        const y = Math.round(home.y - 90 + (90 - 9) * k * k);
        const x = home.x + Math.round(Math.sin(el0 * 0.05));
        air.dot(x, y, PAL.fire4).rect(x, y - 2, 1, 2, PAL.fire2);
        emberLight.setPosition(x, y, home.y);
      } else if (el0 >= 160 && starAt < 0) {
        starAt = el0;
        play('ashenEmber', { volume: 0.8, pan });
        play('ashenKindle', { volume: 0.85, pan });
        void emberLight.fadeOut(60);
        pool.setIntensity(0.6, 80);
      }
      if (starAt >= 0 && el0 - starAt < STEP * 1.5) {
        const y = home.y - 7;
        air.dot(home.x, y, PAL.fire4).dot(home.x - 1, y, PAL.fire4).dot(home.x + 1, y, PAL.fire4).dot(home.x, y - 1, PAL.fire4).dot(home.x, y + 1, PAL.fire4);
      }
      // the ring ignition: two flames chase round the base ellipse from the back, meeting at the front
      if (starAt >= 0) {
        ringK = clamp((el0 - starAt) / 100, 0, 1);
        const steps = 24;
        for (let i = 0; i <= Math.round(steps * ringK); i++) {
          for (const side of [-1, 1]) {
            const a = -Math.PI / 2 + side * (Math.PI * i) / steps;
            const x = Math.round(home.x + Math.cos(a) * 14);
            const y = Math.round(home.y + 2 + Math.sin(a) * 6);
            const head = i >= Math.round(steps * ringK) - 1;
            // a burning rim: low tongues (1–2 px, re-rolled every 3 frames), the chasing heads taller and white-hot
            const fl = (i * 7 + side * 3 + Math.floor(el0 / 50)) % 4;
            ground.dot(x, y, head ? PAL.fire4 : PAL.fire2);
            if (head) ground.dot(x, y - 1, PAL.fire4).dot(x, y - 2, PAL.fire3).dot(x, y - 3, PAL.fire2);
            else if (fl < 2) ground.dot(x, y - 1, fl === 0 ? PAL.fire3 : PAL.fire2);
            else if (fl === 2) ground.dot(x, y - 1, PAL.fire2).dot(x, y - 2, PAL.fire3);
          }
        }
      }
      return true;
    }
    // the mound lifts into the tornado: it sinks in 3 stepped rows over 200 ms, grains spinning off
    const lk = el0 - liftAt;
    if (lk < 200) {
      drawMound(1, Math.floor(lk / 50) * 2);
      return true;
    }
    return false;
  });
  await S.wait(260);
  liftAt = el0;

  // ---- 260: the pose starts; the mound lifts into the tornado
  tornado = true;
  pool.setIntensity(0.9, 120);
  const storm = start('ashenTornado', { volume: 0.9, pan });
  let burst = false;
  // adv #5: the sustained tornado always stops, even if the summon is cut short (the sprite leaves, the duel
  // restarts) while the storm is building
  try {
    holdFrame(u, 'summon', 0);
    u.showSprite();
    // driven: an ace with a cut-in stops ON the spread frame (held under the band), else plays through
    if (S.cutIn) bg(u.playRange('summon', 0, holdF));
    else bg(playFrom(u, 'summon', 0));
    atMark(u, 'summon', 'land', () => play('ashenTalon', { volume: 0.85, pan }));
    atFrame(u, 'summon', 3, () => play('ashenHeartbeat', { volume: 0.9, pan }));
    const tor = lay(S, S.depth + 0.4);
    const back = lay(S, S.depth - 0.4);
    const floor = lay(S, DEPTH.TILE_FX + 5);
    interface Fly { from: XY; to: XY; t0: number; big: boolean }
    const flies: Fly[] = [];
    const grains: { x: number; y: number; age: number }[] = [];
    let el = 0;
    let lastF = -1;
    onFrame(sc, (dt) => {
      el += dt;
      tor.clear();
      back.clear();
      floor.clear();
      if (gone || !live()) return false;
      if (burst) return false;
      const fi = u.frameInfo();
      const f = fi.anim === 'summon' ? fi.frame : lastF;
      const b = ASHEN_BUILD[Math.max(0, Math.min(ASHEN_BUILD.length - 1, f))];
      const bandY = fpt(u, 52, b.boneY > 0 ? b.boneY : 22).y;
      // plates for the NEXT frame's seats fly now, landing as the art seats them
      if (f !== lastF && f >= 0) {
        lastF = f;
        const nx = ASHEN_BUILD[f + 1];
        if (nx)
          for (const seat of nx.seats) {
            const to = fpt(u, seat.x, seat.y);
            const a = RR(0, Math.PI * 2);
            flies.push({ from: { x: home.x + Math.round(Math.cos(a) * 20), y: bandY + Math.round(Math.sin(a) * 4) }, to, t0: el, big: Math.random() < 0.5 });
          }
      }
      // 10 stacked ribbons RISING by whole-pixel phase steps (2 px tall each), 34 → 44 px wide, on the band
      const w = lerp(17, 22, clamp(el / 540, 0, 1));
      const rise = Math.floor(el / 40) % 3;
      for (let i = 0; i < 10; i++) {
        const y = bandY + 10 - i * 3 - rise;
        if (y > home.y + 2) continue;
        const rw = Math.round(w * (0.7 + 0.3 * Math.sin(i * 0.9 + el * 0.004)));
        const ry = Math.max(2, Math.round(rw * 0.28));
        const ph = (el * 0.012 * S.dir + i * 1.3) % (Math.PI * 2);
        // a continuous 2-px ribbon: the front arc in front of the body, the back arc behind it; tone bands
        // and one torn gap travel round it with the spin (whole-pixel steps), two embers ride each ribbon
        for (let x = -rw; x <= rw; x++) {
          const q = 1 - (x / rw) * (x / rw);
          const dy = Math.round(ry * Math.sqrt(Math.max(0, q)));
          for (const side of [1, -1]) {
            const ang = Math.atan2(side * Math.sqrt(Math.max(0, q)), x / rw);
            const u = (((ang - ph) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const band = Math.floor((u / (Math.PI * 2)) * 7);
            if (band >= 5) continue; // the torn gap
            const front = side > 0;
            const L = front ? tor : back;
            const yy = y + side * dy;
            const X = home.x + x;
            if (front) {
              // a 2-px band: the lit top (stone3 on the leading bands) over a stone1 / stone0 underside
              L.dot(X, yy, band < 2 ? PAL.stone3 : PAL.stone2).dot(X, yy + 1, band < 3 ? PAL.stone1 : PAL.stone0);
            } else L.rect(X, yy, 1, 2, band < 3 ? PAL.stone1 : PAL.stone0);
            // fire3 embers riding the ribbons (a fire4 head on the front arc)
            if (band === 2 && i % 2 === 0 && ((x + i * 3) & 3) === 0) {
              L.dot(X, yy, front ? PAL.fire3 : PAL.fire2);
              if (front) L.dot(X + S.dir, yy, PAL.fire4);
            }
          }
        }
      }
      // the plates in flight (2×2 / 2×3: stone2 with a stone1 crease, a stone3 lit edge)
      for (let i = flies.length - 1; i >= 0; i--) {
        const q = flies[i];
        const t = (el - q.t0) / 90;
        if (t >= 1) {
          flies.splice(i, 1);
          continue;
        }
        const x = Math.round(lerp(q.from.x, q.to.x, t));
        const y = Math.round(lerp(q.from.y, q.to.y, t) - Math.sin(t * Math.PI) * 6);
        // ≥ 2×3 with a 1-px ink outline so they read at 1× against the floor and the storm
        const h = q.big ? 3 : 2;
        // (the ink only on the shadow edges — bottom and far side — so a plate reads as a lit chip, not a box)
        tor.rect(x + 1, y + h, 3, 1, PAL.ink).rect(x + 3, y + 1, 1, h, PAL.ink).rect(x, y, 3, h, PAL.stone2).rect(x, y, 3, 1, PAL.stone3).rect(x, y + h - 1, 3, 1, PAL.stone1);
      }
      // ash grains rain off the skirt onto the floor
      if (Math.random() < 0.5) grains.push({ x: home.x + Math.round(RR(-w, w)), y: home.y + Math.round(RR(-3, 3)), age: 0 });
      for (let i = grains.length - 1; i >= 0; i--) {
        const g = grains[i];
        g.age += dt;
        if (g.age > 900) {
          grains.splice(i, 1);
          continue;
        }
        floor.dot(g.x, g.y, g.age < 450 ? PAL.stone1 : PAL.stone0);
      }
      return true;
    });

    // ---- f7: the wings burst out of the storm
    await untilFrame(u, 'summon', BURST_F);
  } finally {
    storm.stop(90);
  }
  burst = true;
  if (live()) {
    const c = fpt(u, 55, 50);
    void lightFlash(sc, c.x, c.y, PAL.fire3, 36, 260, { ring: true, floorY: home.y });
    const sp = new Sparks(sc, S.depth + 0.5);
    for (let i = 0; i < 16; i++) {
      const a = RR(Math.PI * 1.05, Math.PI * 1.95);
      const v = RR(80, 160);
      sp.add({ x: c.x + RR(-8, 8), y: c.y + RR(-10, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 160, drag: 2, life: RR(420, 700), colors: i % 3 ? [PAL.stone3, PAL.stone2, PAL.stone1] : [PAL.stone2, PAL.stone1], shape: i % 2 ? 'sq' : 'px', fadeAt: 1, floor: home.y, bounce: 0 });
    }
    for (let i = 0; i < 10; i++) sp.add({ x: c.x + RR(-6, 6), y: c.y + RR(-6, 6), vx: RR(-90, 90), vy: RR(-120, -30), ay: 160, drag: 2, life: RR(300, 500), colors: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], shape: 'px', fadeAt: 1, flicker: true });
    sp.release();
    if (!S.cutIn) play('ashenRoar', { volume: 0.75, pan });
  }

  // ---- f8: the cut-in on the spread hold (an ace's tribute summon), else straight on
  if (S.cutIn) {
    await untilFrame(u, 'summon', holdF);
    pool.setIntensity(0.6, 120);
    // the spread is never a still under the band: ash flakes peel off the wing hems and embers lift out
    // of the plates (sampled from the shown frame's own opaque pixels), the floor pool beats twice
    let holding = true;
    const hold = new Sparks(sc, S.depth + 0.3);
    let hAcc = 0;
    onFrame(sc, (dt) => {
      if (!holding || !live()) {
        hold.release();
        return false;
      }
      hAcc += dt;
      if (hAcc < 45) return true;
      hAcc = 0;
      const pc = currentPixels(u).pc;
      for (let tries = 0, made = 0; tries < 30 && made < 2; tries++) {
        const fx0 = Math.floor(RR(4, pc.w - 4));
        const fy0 = Math.floor(RR(6, Math.min(pc.h - 30, 64)));
        if (!pc.isOpaque(fx0, fy0) || pc.isOpaque(fx0, fy0 + 1)) continue; // a lower edge (a hem)
        const w = fpt(u, fx0, fy0);
        const ember = made === 1 && Math.random() < 0.6;
        hold.add({ x: w.x, y: w.y + 1, vx: RR(-10, 10), vy: ember ? RR(-30, -14) : RR(4, 16), ay: ember ? -10 : 40, drag: 1, life: RR(320, 520), colors: ember ? [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] : [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'px', fadeAt: 1 });
        made++;
      }
      return true;
    });
    // adv #3: the drake itself stays alive on the held frame (the band covers only the lower left)
    holdLife(S, pool, () => holding);
    await S.climax();
    holding = false;
    if (live()) bg(playFrom(u, 'summon', holdF + 1));
  }

  // ---- f9–f10: the wind-up before the slam is never a still (critic r2 #2): the hanging wings' hem embers
  // flicker (stepped fire1 → fire2 → fire3, re-rolled every 2 frames, sampled from the SHOWN frame's own
  // ember pixels), embers drip off the hem and fall to the floor, ash flakes peel, the floor pool throbs.
  // The roar fades out under it, so the landing gets its own headroom (critic r2 #3: ≥ 8 dB before the slam).
  if (live()) windUp(S, pool);
  atFrame(u, 'summon', HANG_F, () => fade(['ashenRoar'], 70));

  // ---- f11: the cloak slams down — the landing ash shock. It fires on f11, the FIRST frame the dense
  // plates show (f10 is the hanging, translucent half-fold: filmed fix2/sum_land_before.png, the shock and
  // the land sound came 1 pose early, critic r2 #1). It runs INSIDE the sprite's animation update (atFrame,
  // synchronous), not after an awaited promise (a microtask runs after the step has rendered: the ring was
  // one frame late, fix2/sum_slam_z.png), so the ring, the underglow, the sound and the plates share the frame.
  // The 50 ms freeze holds the slam pose itself.
  atFrame(u, 'summon', SLAM_F, () => {
    if (!live()) return;
    play('ashenLand', { volume: 1, pan });
    ashShock(S);
    void lightFlash(sc, home.x, home.y - 20, PAL.fire2, 34, 300, { floorY: home.y, intensity: 0.9 });
    bg(shake(sc, 280, 3));
    bg(freeze(sc, 50));
    bg(u.badge.pop());
    greyDust(S);
  });
  await untilFrame(u, 'summon', SPILL_F);
  if (live()) {
    play('ashenSpill', { volume: 0.8, pan });
    const c = fpt(u, 56, 62);
    const sp = new Sparks(sc, S.depth + 0.3);
    for (let i = 0; i < 7; i++) sp.add({ x: c.x + RR(-4, 4), y: c.y + RR(2, 8), vx: RR(-12, 12), vy: RR(-10, 10), ay: 220, life: RR(300, 460), floor: home.y, bounce: 0.1, colors: [PAL.fire3, PAL.fire2, PAL.fire1], shape: 'px', fadeAt: 1 });
    sp.release();
    const tp = lightPool(sc, home.x + S.dir * 4, home.y, { color: PAL.fire2, radius: 10, intensity: 0.4, fadeIn: 0 });
    bg(S.wait(400).then(() => tp.fadeOut(300)));
  }
  await untilFrame(u, 'summon', DONE_F);
  // the cinematic resolves; the fan cools on its own, the pools fade
  void pool.fadeOut(240);
  bg(S.wait(300).then(() => (gone = true)));
}

/**
 * The held spread under the cut-in (adv #3: ~800 ms on one frame read as a freeze) kept alive ON the drake:
 *  - the RIBS beat with the heartbeat's own rhythm (ashenHeartbeat: LUB, DUB 170 ms later, a 680 ms cycle):
 *    every fire pixel of the chest steps one tone up for 3 frames on LUB (fire1 spills onto the bone round
 *    it), 2 frames on DUB; the floor pool answers each beat;
 *  - the wing hems FLUTTER: a 1-px ripple (the hem pixel's own tone one pixel lower) travels along the hem,
 *    one step every 2 frames;
 *  - embers DRIP off the hem's ember pixels (fire3 → fire1, a 1-px trail) and die on the floor as stone0;
 *  - grey ash GRAINS settle slowly through the frame (stone3 / stone2, 10–16 px/s, a stepped 1-px sway).
 */
function holdLife(S: Stage, pool: { setIntensity(v: number, ms?: number): unknown }, holding: () => boolean): void {
  const u = S.unit;
  const home = S.home;
  const px = lay(S, S.depth + 0.25);
  const flr = lay(S, DEPTH.SHADOW - 1);
  const fireUp = new Map<number, number>([
    [PAL.fire1, PAL.fire2],
    [PAL.fire2, PAL.fire3],
    [PAL.fire3, PAL.fire4],
    [PAL.fire4, PAL.fire4],
  ]);
  const pc = currentPixels(u).pc;
  const ribs: { x: number; y: number; c: number }[] = [];
  const spill: XY[] = [];
  const hem: { x: number; y: number; c: number; fire: boolean }[] = [];
  const b = pc.bounds();
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const c = pc.get(x, y);
      if (c === null) continue;
      const fire = fireUp.has(c as number);
      const lower = !pc.isOpaque(x, y + 1);
      // the ribs: the chest's ember pixels only (within 16 px of the art's core, the tail tip stays out)
      if (fire && !lower && Math.abs(x - u.art.core.x) <= 16 && Math.abs(y - u.art.core.y) <= 16) ribs.push({ x, y, c: c as number });
      // the wing hems: lower edges in the upper two thirds of the frame (the feet / tail stay put)
      if (lower && b && y < b.y + b.h * 0.62) hem.push({ x, y, c: c as number, fire });
    }
  const isRib = new Set(ribs.map((r) => r.y * pc.w + r.x));
  for (const r of ribs)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = r.x + dx;
      const y = r.y + dy;
      if (pc.isOpaque(x, y) && !isRib.has(y * pc.w + x)) spill.push({ x, y });
    }
  interface Drip { x: number; y: number; vy: number; age: number; land: number }
  const drips: Drip[] = [];
  const grains: { x: number; y: number; vy: number; ph: number; land: number }[] = [];
  const specks: { x: number; y: number; age: number }[] = [];
  const top = b ? fpt(u, b.x + b.w / 2, b.y).y : home.y - 80;
  const halfW = b ? Math.round(b.w / 2) : 30;
  let tick = -1;
  let lastBeat = -1;
  let gAcc = 0;
  onFrame(S.scene, (dt, el) => {
    px.clear();
    flr.clear();
    if (!holding() || !u.sprite.active || u.retired) return false;
    // the heartbeat: LUB 0–50 ms, DUB 170–203 ms of every 680 ms
    const cyc = el % 680;
    const beat = cyc < 50 ? 1 : cyc >= 170 && cyc < 203 ? 2 : 0;
    const beatId = Math.floor(el / 680) * 2 + (beat === 2 ? 1 : 0);
    if (beat && beatId !== lastBeat) {
      lastBeat = beatId;
      pool.setIntensity(beat === 1 ? 0.95 : 0.8, 30);
      bg(S.wait(beat === 1 ? 90 : 60).then(() => pool.setIntensity(0.6, 120)));
    }
    if (beat) {
      for (const r of ribs) {
        const w = fpt(u, r.x, r.y);
        px.dot(w.x, w.y, fireUp.get(r.c) ?? r.c);
      }
      if (beat === 1)
        for (const p of spill) {
          const w = fpt(u, p.x, p.y);
          px.dot(w.x, w.y, PAL.fire1);
        }
    }
    const t = Math.floor(el / (2 * STEP));
    if (t !== tick) {
      tick = t;
      const fh = hem.filter((h) => h.fire);
      if (fh.length && t % 2 === 0) {
        const h = fh[Math.floor(RR(0, fh.length))];
        const w = fpt(u, h.x, h.y + 1);
        drips.push({ x: w.x, y: w.y, vy: RR(8, 24), age: 0, land: home.y + Math.round(RR(-4, 5)) });
      }
    }
    // the hem flutter: a 1-px ripple travelling along the hem
    for (const h of hem) {
      const ph = ((((h.x >> 1) + tick) % 5) + 5) % 5;
      if (ph > 1) continue;
      const w = fpt(u, h.x, h.y + 1);
      px.dot(w.x, w.y, h.c);
      if (ph === 0) px.dot(w.x, w.y + 1, h.fire ? PAL.fire1 : PAL.stone0);
    }
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      d.age += dt;
      d.vy += (240 * dt) / 1000;
      d.y += (d.vy * dt) / 1000;
      const y = Math.round(d.y);
      if (y >= d.land) {
        specks.push({ x: d.x, y: d.land, age: 0 });
        drips.splice(i, 1);
        continue;
      }
      px.dot(d.x, y, d.age < 90 ? PAL.fire3 : d.age < 200 ? PAL.fire2 : PAL.fire1).dot(d.x, y - 1, d.age < 90 ? PAL.fire2 : PAL.fire1);
    }
    // the settling ash grains
    gAcc += dt;
    while (gAcc > 40) {
      gAcc -= 40;
      grains.push({ x: home.x + Math.round(RR(-halfW, halfW)), y: top + RR(-6, (home.y - top) * 0.7), vy: RR(10, 16), ph: Math.floor(RR(0, 4)), land: home.y + Math.round(RR(-5, 5)) });
    }
    for (let i = grains.length - 1; i >= 0; i--) {
      const g = grains[i];
      g.y += (g.vy * dt) / 1000;
      if (g.y >= g.land) {
        specks.push({ x: g.x, y: g.land, age: 0 });
        grains.splice(i, 1);
        continue;
      }
      const sway = (Math.floor(el / 120) + g.ph) % 4 < 2 ? 0 : 1;
      px.dot(g.x + sway, Math.round(g.y), g.ph % 2 ? PAL.stone3 : PAL.stone2);
    }
    for (let i = specks.length - 1; i >= 0; i--) {
      const s = specks[i];
      s.age += dt;
      if (s.age > 500) {
        specks.splice(i, 1);
        continue;
      }
      flr.dot(s.x, s.y, s.age < 80 ? PAL.stone2 : PAL.stone0);
    }
    return true;
  });
}

/**
 * The wind-up (f9 → the slam frame): the hanging wings are never a still. Every 2 game frames the ember
 * pixels of the SHOWN frame's hem (fire1 / fire2 / fire3 on a lower edge) are re-lit one stepped tone up or
 * down (a crawling glow along the hem), a few of them let go a 1-px drip (fire3 → fire2 → fire1, a 1-px
 * trail) that falls to the floor and dies as a stone0 speck, and the floor pool throbs on every frame change. Stops on the slam frame (f11).
 */
function windUp(S: Stage, pool: { setIntensity(v: number, ms?: number): unknown }): void {
  const u = S.unit;
  const home = S.home;
  const px = lay(S, S.depth + 0.3);
  const flr = lay(S, DEPTH.SHADOW - 1);
  const fire = new Set<number>([PAL.fire1, PAL.fire2, PAL.fire3]);
  interface Drip { x: number; y: number; vy: number; age: number; land: number }
  const drips: Drip[] = [];
  const specks: { x: number; y: number; age: number }[] = [];
  let hem: XY[] = [];
  let lastF = -1;
  let tick = -1;
  onFrame(S.scene, (dt, el) => {
    px.clear();
    flr.clear();
    const fi = u.frameInfo();
    const stop = !u.sprite.active || u.retired || fi.anim !== 'summon' || fi.frame >= SLAM_F || el > 900;
    if (stop) return false;
    if (fi.frame !== lastF) {
      lastF = fi.frame;
      const pc = currentPixels(u).pc;
      hem = [];
      for (let y = 4; y < Math.min(pc.h - 24, 72); y++)
        for (let x = 0; x < pc.w; x++) {
          const c = pc.get(x, y);
          if (c !== null && fire.has(c as number) && !pc.isOpaque(x, y + 1)) hem.push({ x, y });
        }
      pool.setIntensity(fi.frame % 2 ? 0.95 : 0.7, 30);
    }
    const t = Math.floor(el / (2 * STEP));
    if (t !== tick) {
      tick = t;
      // a few hem embers let go a drip (≤ 3 in flight from each step)
      for (let k = 0; k < 2 && hem.length; k++) {
        const h = hem[Math.floor(RR(0, hem.length))];
        const w = fpt(u, h.x, h.y + 1);
        drips.push({ x: w.x, y: w.y, vy: RR(10, 30), age: 0, land: home.y + Math.round(RR(-4, 5)) });
      }
    }
    // the crawling hem glow: stepped tone per ember pixel, re-rolled every 2 frames
    for (let i = 0; i < hem.length; i++) {
      const h = hem[i];
      const q = (i * 5 + tick * 3) % 7;
      if (q > 2) continue;
      const w = fpt(u, h.x, h.y);
      px.dot(w.x, w.y, q === 0 ? PAL.fire4 : q === 1 ? PAL.fire3 : PAL.fire2);
      if (q === 0) px.dot(w.x, w.y + 1, PAL.fire2);
    }
    // the drips: 1 px head with a 1-px trail, cooling as they fall; a stone0 speck where they land
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      d.age += dt;
      d.vy += (240 * dt) / 1000;
      d.y += (d.vy * dt) / 1000;
      const y = Math.round(d.y);
      if (y >= d.land) {
        specks.push({ x: d.x, y: d.land, age: 0 });
        drips.splice(i, 1);
        continue;
      }
      const c = d.age < 90 ? PAL.fire3 : d.age < 200 ? PAL.fire2 : PAL.fire1;
      px.dot(d.x, y, c).dot(d.x, y - 1, d.age < 90 ? PAL.fire2 : PAL.fire1);
    }
    for (let i = specks.length - 1; i >= 0; i--) {
      const s = specks[i];
      s.age += dt;
      if (s.age > 400) {
        specks.splice(i, 1);
        continue;
      }
      flr.dot(s.x, s.y, s.age < 80 ? PAL.fire1 : PAL.stone0);
    }
    return true;
  });
}

/**
 * The landing ash shock (one ring, never a second): from the slam frame on, an iso ring of packed ash races
 * out along the floor (a stone3 lit leading lip, a stone2 body, a stone1 wake, stone0 under it), 8 ash
 * billows (3-band discs, r 4 → 2) riding its front, a stone dust burst thrown off the feet and a fire splash
 * under the chest (fire3 → fire2 → fire1 in stepped frames). Frame 0 is drawn synchronously, so the floor
 * answers on the very frame the cloak lands, through the 50 ms freeze.
 */
function ashShock(S: Stage): void {
  const px = lay(S, DEPTH.SHADOW - 1);
  const home = S.home;
  const MS = 620;
  const R0 = 26; // critic r3 #3: the ring has a shape on the slam frame itself (was 14: a stain)
  const R1 = 64; // past the tile edge (a tile is ±32 px wide): the slam owns the neighbouring tiles too
  const N = 12;
  const sp = new Sparks(S.scene, DEPTH.SHADOW - 1);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + RR(-0.2, 0.2);
    const v = RR(80, 140);
    sp.add({ x: home.x + Math.round(Math.cos(a) * 8), y: home.y + Math.round(Math.sin(a) * 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - RR(40, 80), ay: 260, drag: 2.2, life: RR(280, 460), colors: i % 2 ? [PAL.stone3, PAL.stone2, PAL.stone1] : [PAL.stone1, PAL.stone0], shape: i % 3 ? 'sq' : 'px', fadeAt: 1, floor: home.y + 6, bounce: 0 });
  }
  sp.release();
  // the underglow sits under the CHEST (the heart is forward of the feet), not under the hips
  const gx = home.x + S.dir * 5;
  let rf = -1;
  // the underglow sits OVER the unit's dithered drop shadow (DEPTH.SHADOW), still under every unit:
  // under it the checker shadow turned the pool into a muddy half-tone (critic r3 #3)
  const gl = lay(S, DEPTH.SHADOW + 0.5);
  const draw = (el: number): boolean => {
    rf++;
    px.clear();
    gl.clear();
    if (el > MS) return false;
    const t = el / MS;
    const e = 1 - (1 - t) * (1 - t) * (1 - t);
    const r = Math.round(R0 + (R1 - R0) * e);
    const ry = Math.max(3, Math.round(r * 0.5));
    // the ring: a dark packed-ash wave, thick first, thinning as it runs; whole-pixel stepped tones (no alpha)
    const th = Math.max(1, Math.round(5 * (1 - t)));
    if (t < 0.85) {
      px.ellipseRing(home.x, home.y + 1, r + 1, ry + 1, 2, t < 0.6 ? PAL.ink : PAL.stone0);
      px.ellipseRing(home.x, home.y, r, ry, th, t < 0.45 ? PAL.stone1 : PAL.stone0);
      px.ellipseRing(home.x, home.y - 1, r, ry, 1, t < 0.25 ? PAL.stone3 : t < 0.55 ? PAL.stone2 : PAL.stone1);
    }
    // billows riding the front, lit cap up-left, falling behind and shrinking as the ring runs out
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.2;
      const rr = r - 1 - (i % 2) * 2;
      const x = Math.round(home.x + Math.cos(a) * rr);
      const y = Math.round(home.y + Math.sin(a) * rr * 0.5);
      const br = Math.max(1, Math.round((i % 2 ? 5 : 6) * (1 - t * 0.8)));
      const lift = Math.round(br * 0.8) + Math.round(Math.sin(t * Math.PI) * 4);
      px.disc(x, y - lift + 1, br, PAL.ink);
      px.disc(x, y - lift, br, t < 0.7 ? PAL.stone1 : PAL.stone0);
      if (br >= 2) px.disc(x - 1, y - lift - 1, br - 1, t < 0.5 ? PAL.stone2 : PAL.stone1);
      if (br >= 3) px.rect(x - br + 1, y - lift - br, Math.max(1, br - 1), 1, t < 0.35 ? PAL.stone3 : PAL.stone2);
    }
    // (drawn over the billows: they would bury it)
    // the underglow (critic r3 #3: a flat maroon stain, held through the freeze): counted in RENDERED frames,
    // so it steps down on every frame, the freeze included; frame 0 is the brightest step. It spills FORWARD
    // of the feet (the body hides what lies under the chest) as a wide iso pool with a ≥ 6-px fire3 core and
    // a ≥ 6-px fire4 heart line on whole pixels, so it reads at 1×.
    const G = [
      { r: 22, c: PAL.fire3, core: 10, cc: PAL.fire4, line: 8, lc: PAL.white },
      { r: 20, c: PAL.fire2, core: 8, cc: PAL.fire3, line: 6, lc: PAL.fire4 },
      { r: 17, c: PAL.fire2, core: 7, cc: PAL.fire3, line: 6, lc: PAL.fire3 },
      { r: 14, c: PAL.fire1, core: 6, cc: PAL.fire2, line: 4, lc: PAL.fire3 },
      { r: 10, c: PAL.fire1, core: 4, cc: PAL.fire2, line: 0, lc: 0 },
      { r: 7, c: PAL.fire1, core: 0, cc: 0, line: 0, lc: 0 },
      { r: 4, c: PAL.stone0, core: 0, cc: 0, line: 0, lc: 0 },
    ];
    const g = G[rf];
    if (g) {
      const gy = home.y + 5; // forward of the toes: the feet and tail must not bury the core
      gl.ellipse(gx, gy - 2, g.r, Math.max(1, Math.round(g.r * 0.42)), g.c);
      if (g.core) gl.ellipse(gx, gy, g.core, Math.max(1, Math.round(g.core * 0.4)), g.cc);
      if (g.line) gl.run(gy, gx - (g.line >> 1), gx + (g.line >> 1) - 1, g.lc).run(gy + 1, gx - (g.line >> 1) + 1, gx + (g.line >> 1) - 2, g.lc);
      // the cracks the slam opens: 4 short fire rays out of the pool on the first 3 frames
      if (rf <= 2)
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.6;
          const l = g.r + 4 - rf * 2;
          gl.line(Math.round(gx + Math.cos(a) * (g.r - 2)), Math.round(gy + Math.sin(a) * (g.r - 2) * 0.42), Math.round(gx + Math.cos(a) * l), Math.round(gy + Math.sin(a) * l * 0.42), rf === 0 ? PAL.fire3 : PAL.fire2);
        }
    }
    return true;
  };
  // (onFrame draws el 0 synchronously: the floor answers on the slam frame itself, through the freeze)
  onFrame(S.scene, (_dt, el) => draw(el));
}

/** The 1 s grey dust layer on the tile and its four neighbours: sparse 2×1 clumps, stone1 → night2 → gone. */
function greyDust(S: Stage): void {
  const px = lay(S, DEPTH.SHADOW - 1);
  const pts: XY[] = [];
  for (let i = 0; i < 26; i++) pts.push({ x: S.home.x + Math.round(RR(-60, 60)), y: S.home.y + Math.round(RR(-26, 26)) });
  let el = 0;
  onFrame(S.scene, (dt) => {
    el += dt;
    px.clear();
    if (el > 1000) return false;
    const col = el < 500 ? PAL.stone1 : PAL.night2;
    for (const p of pts) if (Math.abs(p.x - S.home.x) / 64 + Math.abs(p.y - S.home.y) / 32 <= 1.6) px.rect(p.x, p.y, 2, 1, col);
    return true;
  });
}

if (LOOK_V3) signatureSummon('ashen_drake', (S) => S.ctx.base(), { v3: ashenRiseV3 });
