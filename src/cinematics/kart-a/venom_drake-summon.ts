// Zehir Ejderi (venom_drake) — the signature entrance "Zehirli Sis" (the poison mist) and its flip, docs/v3/kart-a/
// venom_drake.md §5.1. v3 look only (the v1 look keeps the generic summon). After the shared tribute stream:
//   0–260      the DARK void circle opens; GAS TONGUES roll in along the floor from the tile's four corners
//              (stepped leaf0 / leaf1 puffs, void1 edges, a 50 % Bayer pattern — never a solid wash) and heap
//              into a low dome over the tile; the sustained hiss + boil rises
//   260 (f0)   the pose starts curled under the dome; two lights in the fog: the eye slit and the bulb
//   f4 land    the knuckles slam: wet dust puffs, the circle pulses, 1 px of shake
//   f6–f8      INHALE: the gas spirals into the mouth in three waves while the dome dithers out 50 → 25 → 0 %
//   f9 peak    the tail unfurls, THE BULB IGNITES: a leaf3 light at the bulb and a plus glint (its centre the one
//              gold4 pixel)
//   f10 hold   the cut-in (the band passes under the tile); the bulb pulses under it
//   finale     "Zehirli Toprak", hand-made (no S.finale's generic three rings): ONE etch ring spreads from the feet
//              in three steps (a jagged iso ring of night0 cracks with a leaf1 lip, inside the slot border), a
//              medium shake, the badge pops, a brief scar on its own tile
// Flip: three drops roll off the card's front edge onto the tile (brief pits) with a falling drip ladder; the
// body forms in its guard pose and rises (the shared v3 flip, flipV3With, no generic burst).
// Whole pixels, palette tones only, stepped light, no camera.

import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, TILE_H, TILE_W, type XY } from '../../view/layout';
import { shake } from '../../vfx/core';
import { registerCardHook } from '../api';
import { fade, panAt, play, soundsOfUnit, start, atFrame, atMark } from '../_v3/sound';
import { flipV3With, type FlipAccentFn } from '../summon-b/flip';
import { Sparks, layer, onFrame } from '../strikes-a/_kit';
import type { Px } from '../../vfx/combat';
import { RR, bg, clamp, holdFrame, lightFlash, lightPool, playFrom, signatureSummon, untilFrame, type Stage } from '../summon-a/_kit';
import { etchDot, scarTile, zoneKey } from './venom_drake-acid';

const r = Math.round;
const SX = (v: number) => Math.round((v * TILE_W) / 64);
const SY = (v: number) => Math.round((v * TILE_H) / 32);
const LAND_F = 4;
const INHALE_F = 6;
const PEAK_F = 9;
const HOLD_F = 10;

/** a Px layer the stage disposes of */
function lay(S: Stage, depth: number): Px {
  const px = layer(S.scene, depth);
  S.own({ destroy: () => px.g.destroy() });
  return px;
}

/** The world point of a named art point on the shown frame. */
function pt(u: MonsterUnit, name: 'staff' | 'head' | 'muzzle' | 'core'): XY {
  const fi = u.frameInfo();
  const p = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame)[name] : undefined;
  if (!p) return u.core();
  const w = u.framePoint(p.x, p.y);
  return { x: r(w.x), y: r(w.y) };
}

/** 2×2 Bayer thresholds (0…3): a pixel shows at `level` 0…4 quarters. */
const bayer = (x: number, y: number) => [0, 2, 3, 1][(x & 1) + ((y & 1) << 1)];

/** One stepped gas puff (an iso blob) at `level` quarters of coverage: leaf1 heart, leaf0 body, void1 edge. */
function puff(px: Px, cx: number, cy: number, rx: number, ry: number, level: number): void {
  if (level <= 0) return;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.4) * (ry + 0.4)))));
    for (let x = -w; x <= w; x++) {
      const X = cx + x;
      const Y = cy + y;
      if (bayer(X, Y) >= level) continue;
      const e = (x * x) / Math.max(1, w * w) + (y * y) / Math.max(1, ry * ry);
      const top = y < -ry * 0.35;
      px.dot(X, Y, e > 0.82 ? PAL.void1 : top ? (e < 0.25 ? PAL.leaf3 : PAL.leaf2) : e < 0.4 ? PAL.leaf2 : PAL.leaf1);
    }
  }
}

async function venomMistV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const home = S.home;
  const pan = panAt(home.x);
  const n = u.frameCount('summon');
  const holdF = Math.min(n - 1, HOLD_F);
  let gone = false;
  const live = () => !gone && !u.retired && u.sprite.active;

  // ---- 0–260: the circle, the gas rolls in
  fade(['summonCharge'], 160);
  S.openCircle({ appearMs: 200 });
  const arrive = start('venomArrive', { volume: 0.9, pan });
  const pool = S.glow({ color: PAL.leaf3, spill: PAL.leaf2, radius: 30, intensity: 0.1, anim: 'flicker', fadeIn: 0 });
  pool.setIntensity(0.5, 260);
  const floorL = lay(S, DEPTH.SHADOW - 1);
  const domeL = lay(S, S.depth + 0.5);
  const corners: XY[] = [
    { x: home.x - SX(30), y: home.y },
    { x: home.x + SX(30), y: home.y },
    { x: home.x, y: home.y - SY(15) },
    { x: home.x, y: home.y + SY(15) },
  ];
  let el = 0;
  let dome = 4; // dome coverage in quarters (driven down by the inhale)
  let domeOn = false;
  let tonguesOn = true;
  onFrame(sc, (dt) => {
    el += dt;
    floorL.clear();
    domeL.clear();
    if (gone) return false;
    const k = clamp(el / 260, 0, 1);
    if (tonguesOn) {
      // four tongues: a train of puffs from each corner toward the centre, their heads reaching it at 240 ms
      for (const [ci, c] of corners.entries()) {
        for (let j = 0; j < 4; j++) {
          const q = clamp(k - j * 0.12, 0, 1);
          if (q <= 0) continue;
          const wob = Math.floor((el + ci * 40 + j * 30) / 70) % 2;
          const x = r(c.x + (home.x - c.x) * q * 0.85);
          const y = r(c.y + (home.y - c.y) * q * 0.85) - wob;
          puff(domeL, x, y, 7 - (j >> 1), 3, 2);
        }
      }
    }
    // the dome heaps on the tile (≈ 30×22), never solid: 50 % at most, then the inhale thins it
    if (domeOn || k >= 0.45) {
      const g = domeOn ? 1 : (k - 0.45) / 0.55;
      const lvl = Math.min(2, dome >= 4 ? 2 : dome);
      const roll = Math.floor(el / 90) % 2;
      for (const [dx, dy, rx, ry] of [[0, -10, 15, 9], [-11, -4, 10, 6], [11, -5, 10, 6], [r(-3 + roll * 2), -19, 9, 6], [r(5 - roll * 2), -6, 8, 5]] as const) puff(domeL, home.x + dx, home.y + r(dy * g), r(rx * g), Math.max(1, r(ry * g)), lvl);
    }
    return true;
  });
  await S.wait(260);
  tonguesOn = false;
  domeOn = true;

  // ---- 260: the pose starts, curled in the fog (driven: an ace with a cut-in stops ON the hold frame)
  holdFrame(u, 'summon', 0);
  u.showSprite();
  if (S.cutIn) bg(u.playRange('summon', 0, holdF));
  else bg(playFrom(u, 'summon', 0));
  // the two lights in the fog: the eye slit and the bulb
  const bulbL = lightPool(sc, home.x, home.y, { color: PAL.leaf3, radius: 8, floorY: home.y, air: 0.7, intensity: 0.5, fadeIn: 0 }).follow(() => (live() ? pt(u, 'staff') : null), { floorY: home.y });
  S.own({ destroy: () => void bulbL.fadeOut(120) });

  atMark(u, 'summon', 'land', () => {
    if (!live()) return;
    arrive.stop(120);
    play('venomLand', { volume: 0.9, pan });
    S.circle?.pulse(140);
    bg(shake(sc, 120, 1));
    // wet dust: seven night3 / leaf1 puffs pushed out along the floor from the knuckles
    const sp = new Sparks(sc, DEPTH.SHADOW - 1);
    for (let i = 0; i < 7; i++) {
      const s = i % 2 ? 1 : -1;
      sp.add({ x: home.x + S.dir * 6 + s * RR(2, 6), y: home.y + RR(-1, 2), vx: s * RR(30, 60), vy: RR(-12, -4), ay: 30, drag: 3, life: RR(260, 420), colors: i % 3 ? [PAL.night3, PAL.night2] : [PAL.leaf1, PAL.leaf0], shape: 'sq', size: 2, fadeAt: 1 });
    }
    sp.release();
  }, { maxMs: 3000 });

  // ---- f6–f8: the inhale — the gas spirals into the mouth, the dome thins with the sac swelling
  atFrame(u, 'summon', INHALE_F, () => {
    if (!live()) return;
    play('venomInhale', { volume: 0.9, pan });
    pool.setIntensity(0.3, 250);
    const sp = new Sparks(sc, S.depth + 0.6);
    const mouth = pt(u, 'head');
    for (let w = 0; w < 3; w++)
      for (let i = 0; i < 7; i++) {
        const a = RR(0, Math.PI * 2);
        sp.add({ x: r(home.x + Math.cos(a) * RR(10, 18)), y: r(home.y - 8 + Math.sin(a) * RR(4, 9)), tx: mouth.x, ty: mouth.y, curl: S.dir * 0.8, life: 200, delay: w * 80 + i * 10, colors: i % 3 ? [PAL.leaf1, PAL.leaf2] : [PAL.leaf2, PAL.leaf3], shape: 'px', fadeAt: 1 });
      }
    sp.release();
  }, { maxMs: 3000 });
  for (const [f, lvl] of [[INHALE_F, 2], [INHALE_F + 1, 1], [INHALE_F + 2, 0]] as const) atFrame(u, 'summon', f, () => (dome = lvl), { maxMs: 3000 });

  // ---- f9: the bulb ignites
  atFrame(u, 'summon', PEAK_F, () => {
    if (!live()) return;
    domeOn = false;
    const b = pt(u, 'staff');
    void lightFlash(sc, b.x, b.y, PAL.leaf3, 22, 280, { floorY: home.y, intensity: 1 });
    bulbL.setIntensity(1, 80).setRadius(14, 7, 80);
    glint(S, u);
    // the circle closes on the ignition: the finale's etch ring owns a clean floor
    if (S.circle) bg(S.circle.dismiss(360));
    if (S.cutIn) play('venomDrip', { volume: 0.5, pan });
    else play('venomRoar', { volume: 0.8, pan });
  }, { maxMs: 3500 });

  // ---- f10: the cut-in on the hold (an ace's tribute summon); the bulb pulses under the band
  if (S.cutIn) {
    await untilFrame(u, 'summon', holdF);
    let holding = true;
    let pk = 0;
    onFrame(sc, (dt) => {
      if (!holding || !live()) return false;
      pk += dt;
      bulbL.setIntensity(Math.floor(pk / 140) % 2 ? 0.7 : 1);
      return true;
    });
    await S.climax();
    holding = false;
    if (live()) bg(playFrom(u, 'summon', holdF + 1));
  } else await untilFrame(u, 'summon', Math.min(n - 1, PEAK_F));

  // ---- the finale: Zehirli Toprak (one etch ring, a medium shake, the badge, a brief scar)
  if (live()) {
    play('venomScar', { volume: 0.8, pan });
    void lightFlash(sc, home.x, home.y, PAL.leaf3, 34, 300, { intensity: 0.9 });
    bg(shake(sc, 170, 2));
    bg(u.badge.pop());
    etchRing(S);
    scarTile(sc, zoneKey(S.player, S.ev.zone), home, { level: 1, life: 'brief' });
  }
  void bulbL.setIntensity(0.4, 300);
  void pool.fadeOut(300);
  await S.wait(120);
  bg(S.wait(400).then(() => (gone = true)));
}

/** The 3-frame plus glint on the bulb (its centre the one gold4 pixel, the arms gold3). */
function glint(S: Stage, u: MonsterUnit): void {
  const px = lay(S, S.depth + 0.7);
  let el = 0;
  onFrame(S.scene, (dt) => {
    el += dt;
    px.clear();
    const f = Math.floor(el / 34);
    if (f >= 3 || !u.sprite.active) return false;
    const b = pt(u, 'staff');
    const L = f === 1 ? 3 : 2;
    for (let i = 1; i <= L; i++) px.dot(b.x - i, b.y, PAL.gold3).dot(b.x + i, b.y, PAL.gold3).dot(b.x, b.y - i, PAL.gold3).dot(b.x, b.y + i, PAL.gold3);
    px.dot(b.x, b.y, PAL.gold4);
    return true;
  }, () => px.g.destroy());
}

/** ONE etch ring spreads from the feet in 3 steps (60 ms each): jagged night0 cracks with a leaf1 lip. */
function etchRing(S: Stage): void {
  // the back half under the drake, the front half over its feet (the floor in front of the body)
  const back = lay(S, S.depth - 0.5);
  const front = lay(S, S.depth + 0.5);
  const { x: cx, y: cy } = S.home;
  let el = 0;
  onFrame(S.scene, (dt) => {
    el += dt;
    back.clear();
    front.clear();
    const k = Math.floor(el / 80);
    if (k >= 9) return false;
    const step = Math.min(2, k);
    const R = [SX(13), SX(20), SX(27)][step];
    const fade = k >= 5;
    const N = 56;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const px = Math.sin(a) > 0 ? front : back;
      const jag = ((i * 7) % 5) - 2;
      const rr = R + jag * 0.6;
      const x = r(cx + Math.cos(a) * rr);
      const y = r(cy + Math.sin(a) * rr * 0.5);
      if (fade && (i + k) % 3 === 0) continue;
      // a 2-px crack (night0) with a lit acid lip on its outer side (leaf3 while the ring spreads, then leaf2)
      const ox = Math.cos(a) > 0 ? 1 : -1;
      px.dot(x, y, k >= 6 ? PAL.leaf0 : PAL.night0).dot(x - ox, y, k >= 6 ? PAL.night1 : PAL.night0);
      if (!fade) px.dot(x + ox, y + (Math.sin(a) > 0 ? 1 : -1), k < 3 ? PAL.leaf3 : PAL.leaf2).dot(x, y + (Math.sin(a) > 0 ? 1 : -1), PAL.leaf1);
      // short radial forks every 4th crack
      if (i % 4 === 0 && !fade) px.dot(r(cx + Math.cos(a) * (rr - 2)), r(cy + Math.sin(a) * (rr - 2) * 0.5), PAL.night0);
    }
    return true;
  });
}

// ================================================================ the flip

/** Three drops roll off the card's front edge onto the tile (brief pits), a falling drip ladder. */
const venomFlipAccent: FlipAccentFn = (ctx, _id, x, y) => {
  const sc = ctx.scene;
  const pan = panAt(x);
  const sp = new Sparks(sc, DEPTH.FX - 1);
  [1, 0.94, 0.89].forEach((pitch, i) => {
    const dx = (i - 1) * 7;
    sp.add({ x: r(x + dx), y: r(y - 2), vx: dx * 1.5, vy: -30, ay: 520, life: 220, delay: i * 60, colors: [PAL.leaf3, PAL.leaf2], shape: 'px', fadeAt: 1 });
    sc.time.delayedCall(i * 60 + 200, () => {
      play('venomDrip', { volume: 0.6, pitch, pan });
      etchDot(sc, r(x + dx * 1.6), r(y + 4));
    });
  });
  sp.release();
};

if (LOOK_V3) {
  signatureSummon('venom_drake', (S) => S.ctx.base(), { v3: venomMistV3 });
  registerCardHook(
    'venom_drake',
    'flip',
    (ctx) =>
      flipV3With(ctx, (c, id, x, y) => {
        venomFlipAccent(c, id, x, y);
        const ev = ctx.ev;
        c.scene.time.delayedCall(320, () => scarTile(c.scene, zoneKey(ev.player, ev.zone), { x, y }, { level: 1, life: 'brief' }));
      }, {
        burst: false,
        rise: (c, u) => {
          const v = soundsOfUnit(u);
          if (v) play(v.land, { volume: 0.6, pan: panAt(u.home.x) });
          else c.sfx('roarBig', { volume: 0.55 });
        },
      }),
    { name: 'kart-a:venom_drake:flip' },
  );
}
