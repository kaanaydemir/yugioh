// Zehir Ejderi (venom_drake) — "Zehir Havanı" (the venom mortar, on a monster) and "Zehir Sağanağı" (the venom
// spray, direct) — docs/v3/kart-a/venom_drake.md §5.2 / §5.3. v3 look only (the v1 look keeps the generic strike).
//
// Mortar:
//   wind-up (attack f1–f4)  the rattle speeds up (its final rate tells the power), the bulb swells three times
//                           (a glug each, pitch 1 / 1.12 / 1.26), a drop falls from the bulb per swell and etches
//                           a dot on its own tile, the bulb's light grows and the own-tile pool rises
//   whip (f5)               the falling whip band
//   release (f6)            the glob leaves the stinger (a 3-px crown, 1 px of shake)
//   flight (260 ms)         a wobbling 7×6 glob on a mortar arc, its night0 shadow sliding on the floor, a trail of
//                           drops etching dots; the drake holds its watch frame (f8)
//   contact                 the SPLAT (the body ends at 0.12 s: a held breath), a crown, the blob stuck on the face;
//                           if the target's tile carries a venom scar it lights up first ("the scar remembers")
//   the eat                 a silence, then THREE dry fizz-pops: the acid eats holes into the target from the
//                           contact point (the same web the drake eats itself with when it dies), emissive acid
//                           craters, steam threads; a brief scar on the target's tile
// Blocked: the glob splats on the guard plane, no holes, the blob slides down the guard as a dripping sheet, the
// acid fizzes. Losing: the holes reach step 1 only, the stronger side answers (the battle's backlash), the holes
// close with a fizz. Both destroyed: the target dies holed.
// Spray (direct): the `special` pose; five drops leave the stinger along the fan sweep, four splash on the
// opponent's side of the board (brief pits, a falling drip ladder), the fifth hits the duelist.
// Whole pixels, palette tones only, stepped light, no camera.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { AnyMonsterAnim, MonsterPointName } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { shake } from '../../vfx/core';
import type { StrikeArgs } from '../_core/types';
import { registerStrike } from '../api';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, panAt, play, takeCharge } from '../_v3/sound';
import { followLight, holdFrame, layer, onFrame, playFrom, seed, sleep } from '../strikes-a/_kit';
import { STEP, acidHoles, etchDot, flyGlob, podiumKey, scarRemembers, scarTile, splatCrown, steamThreads, surfaceOf, zoneKey } from './venom_drake-acid';

const r = Math.round;

/** The world point of a named art point on the frame the unit shows (the art's own point table). */
export function ptOf(u: MonsterUnit, name: MonsterPointName): XY {
  const fi = u.frameInfo();
  const p = u.art.points && fi.anim ? u.art.points(fi.anim as AnyMonsterAnim, fi.frame)[name] : undefined;
  if (!p) return name === 'muzzle' ? u.muzzle() : u.core();
  const w = u.framePoint(p.x, p.y);
  return { x: r(w.x), y: r(w.y) };
}

const chargeName = (p: 1 | 2 | 3) => (p === 1 ? 'venomChargeLight' : p === 3 ? 'venomChargeHeavy' : 'venomCharge');

/** The scar key of the tile a unit stands on. */
function tileKey(u: MonsterUnit): string {
  return zoneKey(u.player, u.zone);
}

// ================================================================ the mortar

async function venomMortarV3(s: StrikeArgs): Promise<void> {
  if (s.direct) return venomSprayV3(s);
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 211 + (s.target?.uid ?? 5));
  const relF = u.markFrame('attack', 'release', 6);
  const watchF = Math.max(relF + 1, u.markFrame('attack', 'contact', 9) - 1);
  const conF = watchF + 1;
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const result = s.ctx.ev.result;
  const loses = result === 'attackerDestroyed';
  const tie = result === 'bothDestroyed';
  const blocked = s.blocked && !loses && !tie;
  const target = s.target;
  const home: XY = { ...u.home };
  const ground: XY = target ? { ...target.home } : s.toGround;
  const pan = panAt(home.x);
  const tpan = panAt(ground.x);
  const charge = takeCharge(u, chargeName(s.power), { volume: 0.9, pan });
  let alive = true;
  const live = () => alive && u.sprite.active && !u.retired;

  // ---- the wind-up: the bulb's light grows, the own-tile pool rises, a drop per swell
  const bulb = followLight(sc, () => (live() ? ptOf(u, 'staff') : null), { color: PAL.leaf3, radius: 12, floorY: home.y, anim: 'flicker', intensity: 0.7 });
  const pool = lightPool(sc, home.x, home.y, { color: PAL.leaf3, spill: PAL.leaf2, radius: 24, intensity: 0.15, anim: 'flicker', fadeIn: 0 });
  pool.setIntensity(0.6, 350);
  const swellAt = (f: number, pitch: number, rad: number) =>
    atFrame(u, 'attack', f, () => {
      if (!live()) return;
      play('venomSwell', { volume: 0.8, pitch, pan });
      bulb.setRadius(rad, rad / 2, 60);
      dropFrom(sc, ptOf(u, 'staff'), home.y + 2 + (f % 2), home.x);
    }, { maxMs: 3000 });
  if (f0 <= 2) swellAt(2, 1, 14);
  if (f0 <= 3) swellAt(3, 1.12, 16);
  swellAt(4, 1.26, 20);
  atFrame(u, 'attack', 5, () => live() && play('venomWhip', { volume: 0.85, pan }), { maxMs: 3000 });

  const anim = u.playRange('attack', f0, watchF);
  try {
    await u.playToFrame('attack', relF);
  } catch {
    /* the sprite left */
  }
  charge.stop(30);
  void bulb.fadeOut(140);
  if (!live() || u.frameInfo().anim !== 'attack') {
    alive = false;
    void pool.fadeOut(200);
    return;
  }

  // ---- release: the glob leaves the stinger
  play('venomSpit', { volume: 0.9, pan });
  void shake(sc, 60, 1);
  const mz = ptOf(u, 'muzzle');
  splatCrown(sc, mz, mz.y + 2, 3, DEPTH.FX - 1, { up: 30, speed: 40 });
  // the glob lands on the flank that faces the drake (from the target's core toward the drake, level), never
  // on the snout's tip
  const side = (): XY => (target ? { x: target.core().x + (home.x < ground.x ? -40 : 40), y: target.core().y - 3 } : mz);
  const face0 = target ? (surfaceOf(target, side()) ?? { x: r(s.to.x), y: r(s.to.y) }) : { x: r(s.to.x), y: r(s.to.y) };
  const dir = { x: face0.x - mz.x, y: face0.y - mz.y };
  const dl = Math.max(1, Math.hypot(dir.x, dir.y));
  // blocked: the glob lands on the guard plane 9 px in front of the target
  const aim: XY = blocked ? { x: r(s.to.x - (dir.x / dl) * 9), y: r(s.to.y - (dir.y / dl) * 9) } : face0;
  let face = aim;
  const faceNow = (): XY => {
    if (blocked || !target) return aim;
    const p = surfaceOf(target, side());
    if (p) face = p;
    return face;
  };
  const key = target ? tileKey(target) : '';
  const FLIGHT = 260;
  // "the scar remembers" fires just before the splat
  let remembered = false;
  void sleep(sc, FLIGHT - 150).then(() => {
    if (key) remembered = scarRemembers(sc, key, tpan);
  });
  void anim.then(() => {
    if (live() && u.frameInfo().anim === 'attack') holdFrame(u, 'attack', watchF);
  });
  const hit = await flyGlob(sc, mz, aim, { ms: FLIGHT, apex: 12 + 0.12 * dl, floorFrom: home, floorTo: ground, to: faceNow });
  void remembered;

  // ---- contact: the splat
  const tDepth = target && target.sprite.active ? target.sprite.depth : DEPTH.FX - 2;
  play('venomSplat', { volume: blocked ? 0.8 : 1, pan: tpan });
  s.impact(hit);
  void lightFlash(sc, hit.x, hit.y, PAL.leaf3, 26, 260, { floorY: ground.y, intensity: 0.9 });
  splatCrown(sc, hit, ground.y, blocked ? 6 : 8, tDepth + 0.6, { side: -Math.sign(dir.x) });
  if (live()) {
    void playFrom(u, 'attack', conF);
    // the stinger rattles once the acid has eaten (never inside the held breath after the splat)
    void sleep(sc, 300).then(() => u.sprite.active ? play('venomRattle', { volume: 0.7, pan }) : undefined);
  }
  void pool.fadeOut(300);

  if (blocked) {
    // ---- the guard: no holes; the acid sheet slides down the guard and drips to the tile, it fizzes
    play('venomFizz', { volume: 0.9, pan: tpan });
    void sheet(sc, hit, ground.y, tDepth + 0.5, Math.sign(dir.x) || 1);
    steamThreads(sc, [{ x: hit.x - 2, y: hit.y - 2 }, { x: hit.x + 2, y: hit.y + 1 }], tDepth + 0.6, 60);
    void sleep(sc, 160).then(() => scarTile(sc, key, ground, { add: true, life: 'brief' }));
    await sleep(sc, 120);
    alive = false;
    return;
  }

  const holes = target && target.sprite.active ? acidHoles(target, hit, s.power) : null;
  // the splash leaves a brief scar on the target's tile (level 1, or +1)
  if (target) void sleep(sc, 120).then(() => scarTile(sc, key, ground, { add: true, life: 'brief' }));

  if (loses) {
    // the holes reach step 1 only, then the stronger side answers (the battle's backlash) on this frame
    await sleep(sc, 40);
    holes?.step(1);
    play('venomEat', { volume: 0.9, pan: tpan });
    await sleep(sc, 34);
    alive = false;
    // the winner shrugs the acid off: its holes close with a fizz
    void sleep(sc, 160).then(() => {
      play('venomFizz', { volume: 0.6, pan: tpan });
      void holes?.close(180);
    });
    return;
  }

  // ---- the eat: the held breath, then three dry fizz-pops (the holes in 3 steps of 80 ms)
  const EAT0 = 100;
  const dies = !!target && (tie || result === 'targetDestroyed');
  const eat = async () => {
    for (let i = 1; i <= 3; i++) {
      await sleep(sc, i === 1 ? EAT0 : 80);
      if (!holes) break;
      holes.step(i);
      play('venomEat', { volume: 0.75 + i * 0.08, pan: tpan });
      steamThreads(sc, holes.mouths(i === 3 ? 3 : 2), tDepth + 0.6);
      if (i === 3) play('venomSteam', { volume: 0.8, pan: tpan });
    }
    // a survivor closes its holes after its recovery
    if (holes && !dies) {
      await sleep(sc, 260);
      await holes.close(300);
    }
  };
  const eating = eat();
  // a tie: the drake's own death starts from the backlash once the strike lets go (the holes eat on)
  if (tie) {
    await sleep(sc, 34);
    alive = false;
    return;
  }
  // the strike resolves once the third tick has landed (the target's death has started at +150)
  await Promise.race([eating, sleep(sc, EAT0 + 170)]);
  alive = false;
}

/** One drop falls from the bulb onto the drake's own tile and etches a temporary dot. */
function dropFrom(sc: Phaser.Scene, from: XY, floorY: number, x0: number): void {
  const px = layer(sc, DEPTH.FX - 1);
  let y = from.y + 2;
  let vy = 0;
  const x = from.x;
  onFrame(sc, (dt) => {
    px.clear();
    vy += 520 * (dt / 1000);
    y += vy * (dt / 1000);
    if (y >= floorY) {
      etchDot(sc, x, floorY);
      return false;
    }
    px.dot(x, r(y), PAL.leaf3).dot(x, r(y) - 1, vy > 120 ? PAL.leaf2 : PAL.leaf3);
    return true;
  }, () => px.g.destroy());
  void x0;
}

/** Blocked: the blob slides down the guard face as a dripping sheet (3 frames), its drops fall to the tile. */
async function sheet(sc: Phaser.Scene, at: XY, floorY: number, depth: number, dir: number): Promise<void> {
  const px = layer(sc, depth);
  const H = Math.max(6, Math.min(18, floorY - at.y - 2));
  for (let k = 0; k < 4; k++) {
    px.clear();
    const top = at.y - 2 + r((k * H) / 5);
    const len = 3 + k * 3;
    const w = 6 - k;
    for (let i = -w; i <= w; i++) {
      const col = at.x - dir + i;
      const L = Math.max(1, len - Math.abs(i) * 2 + ((i * 7) % 3));
      px.dot(col, top - 1, PAL.ink);
      for (let j = 0; j < L; j++) px.dot(col, top + j, j === 0 ? PAL.leaf3 : j === L - 1 ? PAL.leaf3 : PAL.leaf2);
      px.dot(col, top + L, PAL.ink);
    }
    px.dot(at.x - dir, top, PAL.gold3);
    if (k === 2) for (const i of [-3, 1, 4]) dropFall(sc, { x: at.x - dir + i, y: top + 6 }, floorY + (i & 1));
    await sleep(sc, k < 3 ? STEP * 3 : STEP * 4);
  }
  px.g.destroy();
}

function dropFall(sc: Phaser.Scene, from: XY, floorY: number): void {
  dropFrom(sc, from, floorY, from.x);
}

// ================================================================ the spray (direct)

async function venomSprayV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 223 + 17);
  const has = u.has('special');
  const A: AnyMonsterAnim = has ? 'special' : 'attack';
  const relF = u.markFrame(A, 'release', 6);
  const held = strikeStartFrame(u);
  // special f0 = the held attack f1 pixel for pixel: go on from special f1
  const f0 = has ? Math.max(1, held > 0 ? 1 : 0) : held > 0 ? Math.min(held + 1, relF) : 0;
  const home: XY = { ...u.home };
  const pan = panAt(home.x);
  const charge = takeCharge(u, chargeName(s.power), { volume: 0.9, pan });
  let alive = true;
  const live = () => alive && u.sprite.active && !u.retired;
  const bulb = followLight(sc, () => (live() ? ptOf(u, 'staff') : null), { color: PAL.leaf3, radius: 12, floorY: home.y, anim: 'flicker', intensity: 0.5 });
  bulb.setIntensity(1.1, Math.max(120, u.rangeMs(A, f0, relF)));
  bulb.setRadius(20, 10, Math.max(120, u.rangeMs(A, f0, relF)));
  atFrame(u, A, Math.max(f0, relF - 1), () => live() && play('venomWhip', { volume: 0.85, pan }), { maxMs: 3000 });
  const anim = playFrom(u, A, f0);
  try {
    await u.playToFrame(A, relF);
  } catch {
    /* the sprite left */
  }
  charge.stop(30);
  void bulb.fadeOut(160);
  if (!live() || u.frameInfo().anim !== A) {
    alive = false;
    return;
  }
  play('venomSpit', { volume: 0.7, pan });
  void shake(sc, 60, 1);
  // five drops along the fan sweep: two floor tiles in front of the podium, the podium rim, the podium, the duelist
  const G = s.toGround;
  const side = u.player === 0 ? 1 : -1;
  const pts: XY[] = [
    { x: r(home.x + (G.x - home.x) * 0.7 - 6 * side), y: r(home.y + (G.y - home.y) * 0.7 + 3) },
    { x: r(home.x + (G.x - home.x) * 0.8 + 5 * side), y: r(home.y + (G.y - home.y) * 0.8 - 2) },
    { x: r(home.x + (G.x - home.x) * 0.9 - 3 * side), y: r(home.y + (G.y - home.y) * 0.9 + 2) },
    { x: r(G.x + 4 * side), y: r(G.y + 3) },
    { x: r(s.to.x), y: r(s.to.y) },
  ];
  const pitches = [1, 0.94, 0.89, 0.84];
  const flights: Promise<void>[] = [];
  let hitDone!: () => void;
  const hitP = new Promise<void>((res) => (hitDone = res));
  for (let i = 0; i < 5; i++) {
    const last = i === 4;
    flights.push(
      sleep(sc, i * 40).then(async () => {
        const from = live() ? ptOf(u, 'muzzle') : ptOf(u, 'muzzle');
        const to = pts[i];
        const floorTo = last ? G : to;
        const at = await flyGlob(sc, from, to, { ms: 220, apex: 16 + i * 4, floorFrom: home, floorTo, small: !last, trail: i % 2 === 0, light: last || i === 1 });
        if (!last) {
          // the drops splash on the floor: small crowns, a brief pit on the podium side
          play('venomDrip', { volume: 0.7, pitch: pitches[i], pan: panAt(at.x) });
          splatCrown(sc, at, at.y, 4, DEPTH.TILE_FX + 6, { up: 10, speed: 36 });
          void lightFlash(sc, at.x, at.y, PAL.leaf3, 12, 180, { intensity: 0.6 });
          etchDot(sc, at.x - 1, at.y);
          etchDot(sc, at.x + 1, at.y + 1);
          if (i === 3) scarTile(sc, podiumKey(s.ctx.ev.player === 0 ? 1 : 0), at, { level: 1, life: 'brief' });
          return;
        }
        // drop 5 hits the duelist: one gold3 frame first, then the leaf3 light
        play('venomSplat', { volume: 0.9, pan: panAt(at.x) });
        s.impact(at);
        void lightFlash(sc, at.x, at.y, PAL.gold3, 16, 60, { floorY: G.y, intensity: 0.9 }).then(() => lightFlash(sc, at.x, at.y, PAL.leaf3, 22, 260, { floorY: G.y, intensity: 0.9 }));
        splatCrown(sc, at, G.y, 6, DEPTH.FX + 1, { up: 30, speed: 50 });
        steamThreads(sc, [{ x: at.x - 2, y: at.y + 2 }, { x: at.x + 2, y: at.y + 4 }], DEPTH.FX + 1, 120);
        void sleep(sc, 140).then(() => play('venomFizz', { volume: 0.55, pan: panAt(at.x) }));
        hitDone();
      }),
    );
  }
  await hitP;
  // the strike resolves on the fizz; the settle plays on under the LP roll
  await sleep(sc, 190);
  alive = false;
  void anim;
}

if (LOOK_V3) registerStrike('venom_drake', venomMortarV3, { name: 'kart-a:venom_drake:strike' });
