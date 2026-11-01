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
//   f12       the cloak slams over the shoulders: the landing ash shock (the kit's one shockwave, billows
//             riding its front), a 1 s grey dust layer
//   f13       the rib spill; f14 resolves (the spill cools into the fan in the background)
// No hologram, no beam, no generic circle: the storm BUILDS it. Whole pixels, palette tones, no camera.

import { PAL, RAMPS } from '../../art/palette';
import { ASHEN_BUILD } from '../../art/monsters-v3/ashen_drake';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { atFrame, atMark, fade, panAt, play, start } from '../_v3/sound';
import { Sparks, layer } from '../strikes-a/_kit';
import type { Px } from '../../vfx/combat';
import { RR, bg, clamp, holdFrame, lerp, lightFlash, lightPool, onFrame, playFrom, signatureSummon, untilFrame, type Stage } from './_kit';

const STEP = 1000 / 60;

/** a Px layer the stage disposes of (never left on screen by a crashed entrance) */
function lay(S: Stage, depth: number): Px {
  const px = layer(S.scene, depth);
  S.own({ destroy: () => px.g.destroy() });
  return px;
}

/** frame of a summon mark / pose beat (the art's own table: f7 burst, f8 held, f12 slam, f13 spill) */
const BURST_F = 7;
const HOLD_F = 8;
const SLAM_F = 12;
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
  let burst = false;
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
      const col = [PAL.stone1, PAL.stone2, PAL.stone3][(i + Math.floor(el / 80)) % 3];
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
          const tone = front ? [PAL.stone3, PAL.stone2, PAL.stone2, PAL.stone1, PAL.stone2, PAL.stone1][band] : band < 3 ? PAL.stone1 : PAL.stone0;
          const L = front ? tor : back;
          const yy = y + side * dy;
          L.rect(home.x + x, yy, 1, front ? 1 : 2, tone);
          if (band === 2 && i % 3 === 0 && x % 5 === 0) L.dot(home.x + x, yy, front ? PAL.fire3 : PAL.fire1);
        }
      }
      void col;
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
      tor.rect(x, y, 2, q.big ? 3 : 2, PAL.stone2).rect(x, y, 2, 1, PAL.stone3).rect(x, y + (q.big ? 2 : 1), 2, 1, PAL.stone1);
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
  burst = true;
  storm.stop(90);
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
    await S.climax();
    if (live()) bg(playFrom(u, 'summon', holdF + 1));
  }

  // ---- f12: the cloak slams down — the landing ash shock
  await untilFrame(u, 'summon', SLAM_F);
  if (live()) {
    S.finale({ ring: 92, ramp: RAMPS.stone, freezeMs: 50, shake: 3, playerRing: false, sfx: null });
    play('ashenLand', { volume: 0.95, pan });
    void lightFlash(sc, home.x, home.y - 20, PAL.fire2, 30, 300, { floorY: home.y, intensity: 0.8 });
    billowRing(S);
    greyDust(S);
  }
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

/** 8 ash billows riding the finale's shockwave front (debris on the one ring, never a second ring). */
function billowRing(S: Stage): void {
  const px = lay(S, DEPTH.TILE_FX + 7);
  const home = S.home;
  let el = 0;
  onFrame(S.scene, (dt) => {
    el += dt;
    px.clear();
    if (el > 560) return false;
    const t = el / 560;
    const r = 92 * (1 - (1 - t) * (1 - t)) * 0.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const x = Math.round(home.x + Math.cos(a) * r);
      const y = Math.round(home.y + Math.sin(a) * r * 0.5);
      const rx = Math.max(1, Math.round(5 * (1 - t)));
      const col = t < 0.35 ? PAL.stone3 : t < 0.7 ? PAL.stone2 : PAL.stone1;
      px.ellipse(x, y - 1, rx, Math.max(1, rx * 0.55), PAL.stone1).ellipse(x, y - 2, Math.max(1, rx - 1), Math.max(1, rx * 0.4), col);
    }
    return true;
  });
}

/** The 1 s grey dust layer on the tile and its four neighbours: sparse 2×1 clumps, stone1 → night2 → gone. */
function greyDust(S: Stage): void {
  const px = lay(S, DEPTH.TILE_FX + 4);
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
