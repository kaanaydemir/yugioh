// Kül Ejderi (ashen_drake) — "Kül Fırtınası Nefesi" and the ash-heap death (docs/v3/kart-a/ashen_drake.md
// §5.2–§5.6). v3 look only (the v1 look has no art for this card: it keeps the generic strike / death).
//
// The strike (THE signature, R1):
//   charge   the cloak tears into the ribs (the art draws the chips; we add motes sucked into the heart),
//            the floor pool rises fire2 → fire3, the inhale holds with plate-rip grains
//   release  the ASH BANK is born at the jaw ON the floor — a pyroclastic flow of stepped billows whose top
//            lips tumble BACKWARDS while it advances (the nose hugs the floor: no crest, no crash); the first
//            billows carry 2×3 plate chips (the cloak, exhaled); 14 buried embers blink slowly; it leaves a
//            soot trail
//   swallow  the bank settles over the target as a LATTICE veil (≤ 70 % of its height, slits every 4 px)
//   LUB      the drake's heart beats once (a light pulse at its core) — the one sound of the silence
//   silence  160 ms: the veil's embers go dark in three steps, the floodlights dip one step
//   VUF      on the beat where the DUB should be, every ember ignites at once: the billows step inside-out
//            to fire bands, the target a BLACK SILHOUETTE inside the orange (R1, card-level EF-3
//            exception), flame tongues on its top edge
//   fuse     the soot trail burns back to the drake in four shrinking segments; the heart answers, the rib
//            spill pours and the cloak re-grows (the art, attack f10–f14); ash snow drifts onto the tile
// Blocked: the bank piles up against the guard and ignites only on its front face; half of it rolls back
// as a cooling backwash; no fuse. Losing: the fire does not take (three embers pop), the strike resolves at
// contact (the battle's backlash answers along the line). Tie: the full ignition, no fuse.
// Death: the v3 death kit on the art's crumble; the ash HEAP is this file's layer (from death f9), it cools,
// the wind strips it top-down and the last ember goes out dark (no rebirth promise).
// Everything on whole pixels, palette tones only, no alpha on the drawn pieces, stepped light, no camera.

import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, LOOK_V3, TILE_W, type XY, unitDepth } from '../../view/layout';
import { lightDim, lightFlash, lightPool } from '../../view/light';
import type { StrikeArgs } from '../_core/types';
import { registerCardHook, registerStrike } from '../api';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { atFrame, fade, panAt, play, start, takeCharge } from '../_v3/sound';
import { Sparks, clamp, currentPixels, followLight, holdFrame, layer, lerp, onFrame, overlay, playFrom, seed, sleep, sourceOwnsDestroy, RR, type Ctx } from './_kit';
import type { Px } from '../../vfx/combat';
import { drawAshenSeated } from '../../art/monsters-v3/ashen_drake';
import { ASH_T, BURN_T, CHAR_T, COOL_T, DEAD_T, HOT_T, WHITE_T, drawPuff, hash, latticeSlots, tongues, veilSlots, type Tones } from './ashen_drake-fx';

const ASH = [PAL.stone1, PAL.stone2, PAL.stone3] as const;
const STEP = 1000 / 60;

/** The frame-space point `name` of the frame the unit shows, in world px (null: no art points). */
function framePt(u: MonsterUnit, name: 'muzzle' | 'core'): XY {
  const fi = u.frameInfo();
  const p = u.art.points && fi.anim ? u.art.points(fi.anim as AnyMonsterAnim, fi.frame)[name] : undefined;
  if (!p) return name === 'muzzle' ? u.muzzle() : u.core();
  const w = u.framePoint(p.x, p.y);
  return { x: Math.round(w.x), y: Math.round(w.y) };
}

// ================================================================ the bank

interface Billow {
  /** position along the path (px from the start) */
  s: number;
  /** lateral offset (px, ± across the path) */
  o: number;
  rx: number;
  /** the top lip's angle (rad), tumbling BACK toward the drake */
  lip: number;
  born: number;
  chip: boolean;
}

// ================================================================ the strike

async function ashStormV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 131 + (s.target?.uid ?? 7));
  const n = u.frameCount('attack');
  const relF = u.markFrame('attack', 'release', 6);
  const conF = Math.max(relF + 1, u.markFrame('attack', 'contact', 9));
  const recF = Math.max(conF + 1, Math.min(n - 1, u.markFrame('attack', 'recover', conF + 1)));
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const dir = u.flipX ? -1 : 1;
  const home = u.home;
  const result = s.ctx.ev.result;
  const loses = result === 'attackerDestroyed';
  const tie = result === 'bothDestroyed';
  const blocked = s.blocked && !loses && !tie;
  const target = s.direct ? null : s.target;
  const ground: XY = target ? target.home : s.toGround;
  const pan = panAt(home.x);
  const tpan = panAt(ground.x);
  const charge = takeCharge(u, 'ashenInhale', { volume: 0.9, pan });
  let alive = true;
  const live = () => alive && u.sprite.active;

  // ---- charge: the floor pool rises, motes are sucked into the heart
  const pool = lightPool(sc, home.x, home.y, { color: PAL.fire2, spill: PAL.fire1, radius: 28, intensity: 0.15, anim: 'flicker', fadeIn: 0 });
  pool.setIntensity(0.8, Math.max(150, u.rangeMs('attack', f0, relF)));
  const jaw = followLight(sc, () => (live() ? framePt(u, 'muzzle') : null), { color: PAL.fire3, radius: 10, floorY: home.y, air: 0.6, intensity: 0.6 });
  const fx = layer(sc, DEPTH.FX - 1);
  const motes: { x: number; y: number; age: number; life: number; c: number }[] = [];
  let charging = true;
  let acc = 0;
  onFrame(sc, (dt) => {
    fx.clear();
    if (!charging || !live()) return false;
    const c = framePt(u, 'core');
    acc += dt;
    while (acc > 14) {
      acc -= 14;
      const a = RR(0, Math.PI * 2);
      const r = RR(12, 24);
      motes.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.8, age: 0, life: RR(120, 200), c: Math.random() < 0.6 ? PAL.stone2 : PAL.fire2 });
    }
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.age += dt;
      const t = m.age / m.life;
      if (t >= 1) {
        motes.splice(i, 1);
        continue;
      }
      const k = t * t;
      const x = Math.round(lerp(m.x, c.x, k));
      const y = Math.round(lerp(m.y, c.y, k));
      fx.dot(x, y, t > 0.7 ? PAL.fire3 : m.c);
      if (m.c === PAL.stone2) fx.dot(x + 1, y, PAL.stone1);
    }
    return true;
  }, () => fx.g.destroy());

  const toContact = u.playRange('attack', f0, conF);
  try {
    await u.playToFrame('attack', relF);
  } catch {
    /* the sprite left */
  }
  charging = false;
  charge.stop(30);
  void jaw.fadeOut(140);
  if (!live()) {
    void pool.fadeOut(200);
    alive = false;
    return;
  }

  // ---- release: the bank is born at the jaw, on the floor
  play('ashenExhale', { volume: 0.9, pan });
  const roll = start('ashenRoll', { volume: 0.8, pan });
  const mz = framePt(u, 'muzzle');
  const A: XY = { x: mz.x, y: home.y + 1 };
  // blocked: the bank stops on the guard plane in front of the target
  const B: XY = blocked ? { x: ground.x - dir * 12, y: ground.y + 1 } : { x: ground.x, y: ground.y + 1 };
  const L = Math.max(1, Math.hypot(B.x - A.x, B.y - A.y));
  // a tie kills the drake too: its own death has to fit the budget, so the bank's floor speed is a bit higher
  const T = clamp(L * 1.6, tie ? 150 : 190, 240);
  const ux = (B.x - A.x) / L;
  const uy = (B.y - A.y) / L;
  const at = (sAlong: number, o = 0): XY => ({ x: A.x + ux * sAlong + -uy * o, y: A.y + uy * sAlong + ux * o * 0.5 });
  const W = Math.round(TILE_W * 0.5);
  const billows: Billow[] = [];
  const trail: XY[] = [];
  const embers: { s: number; o: number; dy: number; ph: number }[] = [];
  for (let i = 0; i < 14; i++) embers.push({ s: RR(-W * 0.5, W * 0.5), o: RR(-W * 0.4, W * 0.4), dy: RR(2, 14), ph: Math.floor(RR(0, 5)) });
  const relAt = sc.time.now;
  let front = 0;
  let phase: 'roll' | 'veil' | 'silence' | 'ignite' | 'burn' | 'fizzle' | 'done' = 'roll';
  let phaseAt = 0;
  let darkSteps = 0;
  let frames = 0;
  let igniteFrame = -1;
  const floorL = layer(sc, DEPTH.SHADOW - 2);
  const bankL = layer(sc, DEPTH.FX - 2);
  // over the target body; at a duelist the bank swallows the podium base in front of the figure
  const veilDepth = target ? target.sprite.depth + 0.4 : DEPTH.FX - 2;
  const veilL = layer(sc, veilDepth);
  const trailPool = lightPool(sc, A.x, A.y, { color: PAL.fire1, radius: 14, intensity: 0.2, anim: 'flicker' });
  let spawnAcc = 0;
  // the veil's own height: 65 % of the target's bounding box (critic r1 #2: it covered ~35 %, read as rubble)
  const tBox = target ? currentPixels(target).pc.bounds() : null;
  const tTop = target ? (tBox ? Math.round(target.framePoint(0, tBox.y).y) : Math.min(target.core().y - 6, ground.y - 18)) : ground.y - 22;
  const lattice = !!target && !blocked;
  const veilH = lattice
    ? clamp(Math.round((ground.y - tTop) * 0.65), 18, 52)
    : blocked
      ? clamp(Math.round((ground.y - tTop) * 0.75), 18, 36) // the pile-up climbs the guard face (critic r1 #6)
      : clamp(Math.round((ground.y - tTop) * 0.7), 14, 30);
  const VW = lattice && tBox ? clamp(Math.round(tBox.w * 0.85), W, Math.round(W * 1.7)) : W;
  const chips: { a: number; r: number; age: number }[] = [];
  for (let i = 0; i < 7; i++) chips.push({ a: RR(0, Math.PI * 2), r: RR(2, 6), age: 0 });

  // ---- the veil: the bank's billows settle into a soft mound over the target (EF-2: gaps between the
  // upper puffs, ≤ 70 % of its height); the blocked bank piles up as a wide low wall on the guard plane
  // direct (critic r1 #5): a LOW bank at the podium front (the base and back rows only, smaller puffs), so
  // the fire never hides the duelist above the knees
  const slots = lattice
    ? latticeSlots(VW, veilH)
    : !target && !blocked
      ? veilSlots(W, veilH, true).filter((sl) => sl.row === 2).map((sl) => ({ ...sl, r: Math.max(3, Math.round(sl.r * 0.7)) }))
      : veilSlots(W, veilH, blocked);
  const pr = slots.map((sl, i) => ({ r: sl.r, gone: false, charred: false, seed: i * 7 + 3, start: 0 }));
  slots.forEach((sl, i) => (pr[i].start = 6 + sl.row * 3 + Math.floor(hash(i, 5) * 3)));
  let swallowFrame = -1;
  const veilXY = (i: number): XY => {
    const sl = slots[i];
    const fy = B.y - (sl.z === 0 ? 2 : 0);
    const r = pr[i].r;
    // the lattice CLIMBS: each cell rises out of the bank's nose a frame per ~8 px of height
    const climbs = lattice || blocked;
    const k = clamp((frames - swallowFrame - (climbs ? sl.h / 8 : 0)) / (climbs ? 3 : 4), 0, 1);
    // blocked: the pile splays sideways along the guard plane as it piles up
    const splay = blocked ? 0.55 + 0.45 * clamp((frames - swallowFrame) / 7, 0, 1) : 1;
    const tx = B.x + Math.round(sl.x * splay);
    const ty = fy - sl.h - r * 0.8 + 1;
    if (k >= 1) return { x: tx, y: ty };
    // settling: the puffs swell out of the bank's nose
    const n = at(Math.max(0, L - 4));
    return { x: Math.round(lerp(n.x, tx, k)), y: Math.round(lerp(n.y - 4, ty, k)) };
  };
  const capOf = (i: number, slow: number): number => -Math.PI / 2 + dir * (0.7 - ((Math.floor((frames + i * 2) / slow) % 6) / 5) * 1.4);
  const drawVeil = (fire: number) => {
    veilL.clear();
    const k = frames - igniteFrame;
    const grow = clamp(0.6 + (frames - swallowFrame) / 8, 0.6, 1);
    let any = false;
    for (let i = 0; i < slots.length; i++) {
      const P = pr[i];
      if (P.gone) continue;
      const sl = slots[i];
      const inner = sl.row < 2 || Math.abs(sl.x) < W * 0.3;
      let t: Tones = ASH_T;
      let core = -1;
      let heat = 0;
      let r = P.r * grow;
      if (fire === -1) {
        // the fizzle: the veil sinks as dead grey ash
        t = DEAD_T;
        r = P.r * clamp(1 - (frames - igniteFrame) / 18, 0, 1);
      } else if (fire >= 1) {
        if (k <= 0) t = ASH_T;
        else if (k === 1) t = inner ? WHITE_T : COOL_T;
        else if (k < P.start) {
          t = HOT_T;
          heat = 1;
          if (inner && k < (target ? 5 : 3)) core = PAL.fire4;
        } else {
          const st = Math.floor((k - P.start) / 2);
          if (st === 0) (t = BURN_T), (heat = 0.6);
          else if (st === 1) (t = COOL_T), (heat = 0.25);
          else {
            t = CHAR_T;
            if (!P.charred) {
              P.charred = true;
              const c = veilXY(i);
              puffEnds(c, P.r);
            }
            r = P.r - (st - 1) * 1.5;
          }
        }
      }
      if (r < 1.5) {
        if (fire >= 1 || fire === -1) P.gone = fire >= 1;
        continue;
      }
      any = true;
      const c = veilXY(i);
      // the lattice: not yet risen → nothing; the ink seam round every cell
      if ((lattice || blocked) && frames - swallowFrame < sl.h / 8) continue;
      if (lattice) veilL.ellipse(c.x, Math.round(c.y + (P.r - r) * 0.8), Math.round(r) + 1, Math.round(r * 0.8) + 1, fire === 0 || fire === -1 ? PAL.ink : PAL.fire1);
      drawPuff(veilL, c.x, c.y + (P.r - r) * 0.8, r, t, capOf(i, fire >= 1 ? 2 : 6), 0.8, core);
      if (heat > 0) tongues(veilL, c.x, Math.round(c.y + (P.r - r) * 0.8 - r * 0.8), r, heat * (blocked && sl.row < 2 ? 1.4 : 1), frames, P.seed + k);
    }
    // blocked: a 3-frame WALL of fire on the guard face, as high as the pile again (critic r1 #6)
    if (fire >= 1 && blocked && k >= 1 && k <= 3) {
      const top = Math.round(B.y - veilH * 0.8);
      for (let j = 0; j < 5; j++) tongues(veilL, B.x + Math.round((j / 4 - 0.5) * W * 1.1), top + (j % 2) * 2, 5, 2.4 - (k - 1) * 0.5, frames, 31 + j * 13);
    }
    // direct: a 3-frame column of flame climbs the podium front out of the burning bank
    // (narrow, at the podium front, under the duelist's chest: critic r1 #5)
    if (fire >= 1 && !target && !blocked && k >= 1 && k <= 4) {
      const top = Math.round(B.y - 6);
      tongues(veilL, B.x, top, 4, 1.5 - (k - 1) * 0.25, frames, 91);
    }
    // the buried embers: white on the ignition frame; in the silence a third of them go dark per step
    for (const [i, e] of embers.entries()) {
      const x = Math.round(B.x + e.o * (blocked ? 1.25 : 1));
      const y = Math.round(B.y - e.dy * (veilH / 16));
      if (fire >= 1) {
        if (k === 0) {
          veilL.dot(x, y, PAL.white);
          if (i % 3 === 0) veilL.dot(x - 1, y, PAL.fire4).dot(x + 1, y, PAL.fire4).dot(x, y - 1, PAL.fire4).dot(x, y + 1, PAL.fire4);
        }
        continue;
      }
      if (fire === -1) continue;
      const kk = i % 3;
      const step = darkSteps - kk;
      if (step >= 2) continue;
      const on = (frames + e.ph) % 5 < 2;
      if (!on && darkSteps === 0) continue;
      // the last frame before the VUF: the surviving embers flicker one px inward
      const inward = darkSteps >= 3 ? Math.sign(B.x - x) : 0;
      veilL.dot(x + inward, y, step >= 1 ? PAL.fire1 : PAL.fire2);
    }
    return any;
  };
  /** a charred puff lets go: two embers rise, two ash flakes fall */
  const puffEnds = (c: XY, r: number) => {
    const sp = new Sparks(sc, veilDepth + 0.2);
    for (let j = 0; j < 4; j++) {
      const ember = j < 2;
      sp.add({ x: Math.round(c.x + RR(-r, r) * 0.6), y: Math.round(c.y - RR(0, r) * 0.6), vx: RR(-14, 14), vy: ember ? RR(-46, -24) : RR(-12, -4), ay: ember ? 30 : 110, drag: 1.2, life: RR(320, 560), colors: ember ? [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] : [PAL.stone2, PAL.stone1], shape: 'px', fadeAt: 1 });
    }
    sp.release();
  };

  // the soot trail lives on its own (≈ 2 s): the fuse burns along it after the bank is gone
  let soot = 0;
  onFrame(sc, (dt) => {
    soot += dt;
    floorL.clear();
    if (soot > 2300 || !sc.sys.isActive()) return false;
    const fadeCol = PAL.stone0;
    // soot (stone0, darker than the tiles) with a few smouldering fire1 grains, blinking slowly
    trail.forEach((p, i) => {
      // the last 300 ms the soot thins out in two steps (stepped, no alpha)
      if (soot > 2000 && i % (soot > 2150 ? 3 : 2) !== 0) return;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      floorL.rect(x - 1, y, 3, 1, fadeCol).dot(x + ((i % 2) ? 1 : -1), y + 1, fadeCol);
      if (i % 4 === 1 && soot < 1600 && (Math.floor(soot / 70) + i) % 7 < 4) floorL.dot(x, y, PAL.fire1);
    });
    return true;
  }, () => floorL.g.destroy());

  onFrame(sc, (dt) => {
    if (phase === 'done') return false;
    frames++;
    const el = sc.time.now - relAt;
    bankL.clear();
    // the soot trail (kept for the fuse)
    if (phase === 'roll') {
      const k = clamp(el / T, 0, 1);
      front = L * (1 - (1 - k) * (1 - k));
      spawnAcc += dt;
      if (el < 200 && spawnAcc >= 30) {
        spawnAcc = 0;
        billows.push({ s: 0, o: RR(-3, 3), rx: RR(4, 6), lip: RR(0, 1), born: el, chip: billows.length < 3 });
      }
      if (billows.length === 0) billows.push({ s: 0, o: 0, rx: 5, lip: 0, born: el, chip: true });
      const nb = billows.length;
      billows.forEach((b, i) => {
        // the bank travels as one: the newest billows trail, the front billow leads (a low nose)
        b.s = Math.max(0, front - (nb - 1 - i) * 6 * (0.6 + 0.4 * k));
        const grow = clamp((el - b.born) / 160, 0, 1);
        const mid = 1 - Math.abs((i + 0.5) / nb - 0.45) * 1.2;
        b.rx = lerp(3, 5 + 8 * mid * (0.5 + 0.5 * k), grow) * (i === nb - 1 ? 0.7 : 1);
        b.lip += 0.06;
      });
      // the leading edge leaves soot
      const lead = at(front);
      const last = trail[trail.length - 1];
      if (!last) trail.push({ x: Math.round(lead.x), y: Math.round(lead.y) });
      else {
        // fill the gap every 3 px (the front moves up to ~20 px a frame)
        const d = Math.hypot(lead.x - last.x, lead.y - last.y);
        const n = Math.floor(d / 3);
        for (let j = 1; j <= n; j++) trail.push({ x: Math.round(lerp(last.x, lead.x, (j * 3) / d)), y: Math.round(lerp(last.y, lead.y, (j * 3) / d)) });
      }
      trailPool.setPosition(lead.x, lead.y);
      const drawn = billows.map((b, i) => ({ b, i, p: at(b.s, b.o) })).sort((x, y) => x.p.y - y.p.y || x.i - y.i);
      for (const { b, p } of drawn) {
        const r = Math.max(2, b.rx);
        const cap = -Math.PI / 2 + dir * (0.9 - ((Math.floor(b.lip * 6) % 6) / 5) * 1.8);
        drawPuff(bankL, p.x, p.y - r * 0.72 + 1, r, ASH_T, cap, 0.75);
      }
      // the cloak, exhaled: plate chips tumble in the first billows' lip (the first 140 ms)
      if (el < 140)
        for (const c of chips) {
          c.age += dt;
          const p = at(Math.max(0, front - 4));
          const a = c.a + c.age * 0.02 * -dir;
          const x = Math.round(p.x + Math.cos(a) * c.r);
          const y = Math.round(p.y - 8 + Math.sin(a) * c.r * 0.6);
          bankL.rect(x, y, 2, 3, PAL.stone2).rect(x, y + 1, 2, 1, PAL.stone1).dot(x, y, PAL.stone3);
        }
      // buried embers blink slowly (2 on / 3 off)
      for (const [i, e] of embers.entries()) {
        if ((frames + e.ph) % 5 >= 2) continue;
        const b = billows[i % billows.length];
        const p = at(b.s, b.o * 0.5);
        bankL.dot(Math.round(p.x + (i % 5) - 2), Math.round(p.y - 2 - (i % 3) * 2), PAL.fire2);
      }
      return true;
    }
    if (phase === 'veil' || phase === 'silence') {
      if (swallowFrame < 0) swallowFrame = frames;
      drawVeil(0);
      return true;
    }
    if (phase === 'fizzle') {
      return drawVeil(-1) || frames - igniteFrame < 4;
    }
    if (phase === 'ignite' || phase === 'burn') {
      const k = frames - igniteFrame;
      if (k > 40) return false;
      return drawVeil(1) || k < 6;
    }
    return false;
  }, () => {
    bankL.g.destroy();
    veilL.g.destroy();
    void trailPool.fadeOut(120);
  });
  const finish = () => {
    phase = 'done';
    alive = false;
    void pool.fadeOut(240);
    roll.stop(60);
  };

  try {
    // ---- the roll; the drake reaches its watch frame (contact) and holds it there
    void toContact.then(() => {
      if (live() && u.frameInfo().anim === 'attack') holdFrame(u, 'attack', conF);
    });
    await sleep(sc, Math.max(0, T - 40));
    play('ashenHush', { volume: 1 });
    fade(['ashenRoll'], 40);
    roll.stop(40);
    await sleep(sc, 40);
    // ---- SWALLOW
    phase = 'veil';
    void trailPool.fadeOut(60);
    if (blocked) play('ashenSnuff', { volume: 0.9, pan: tpan });
    play('ashenLub', { volume: 0.7, pan: tpan });
    // (its duck re-anchors the hush's: the music stays down through the silence)
    void lightDim(sc, -0.3, 60);
    // LUB: the drake's heart beats once (light only, 3 stepped frames at its core)
    const c0 = framePt(u, 'core');
    const lub = lightPool(sc, c0.x, c0.y, { color: PAL.fire3, radius: 8, floorY: home.y, air: 0.7, intensity: 0, fadeIn: 0 });
    lub.setIntensity(0.7, 50);
    void sleep(sc, 50).then(() => lub.fadeOut(60));
    phase = 'silence';
    // the silence: three visible dark steps, nothing to hear
    const SIL = tie ? 140 : 150; // never below 140 (§5.7)
    for (let i = 1; i <= 3; i++) {
      await sleep(sc, (SIL - 40) / 3);
      darkSteps = i;
    }
    play('ashenSuck', { volume: 0.9, pan: tpan });
    await sleep(sc, 40);
    const hit: XY = blocked ? { x: B.x, y: B.y - 8 } : target ? { x: Math.round(target.core().x), y: Math.round(target.core().y) } : { x: s.to.x, y: s.to.y };

    // ---- losing: the fire does not take
    if (loses) {
      phase = 'fizzle';
      igniteFrame = frames;
      play('ashenSputter', { volume: 0.9, pan: tpan });
      s.impact(hit);
      void lightDim(sc, 0, 300);
      const sp = new Sparks(sc, veilDepth + 0.1);
      for (let i = 0; i < 3; i++) sp.add({ x: B.x + RR(-6, 6), y: B.y - RR(4, 12), vx: RR(-20, 20), vy: RR(-60, -30), ay: 200, life: RR(200, 320), colors: [PAL.fire4, PAL.fire2, PAL.fire1], shape: 'px', fadeAt: 1 });
      sp.release();
      // the cloak tries to come home: plate chips fly BACK toward the drake on the backlash line
      chipsHome(sc, { x: B.x, y: B.y - 6 }, framePt(u, 'core'), DEPTH.FX - 1);
      reseat(sc, u, 70, 270);
      // the veil sinks as grey ash
      void sleep(sc, 300).then(() => finish());
      void pool.fadeOut(200);
      return;
    }

    // ---- IGNITION (the VUF on the second beat)
    phase = 'ignite';
    igniteFrame = frames;
    play('ashenIgnite', { volume: blocked ? 0.6 : 1, pitch: blocked ? 0.85 : 1, pan: tpan });
    s.impact(hit);
    // one ring per beat: at a duelist the kit's hit already rings, ours stays a plain light swell
    void lightFlash(sc, hit.x, hit.y, PAL.fire3, 40, 300, { ring: !!target, intensity: 1, floorY: ground.y });
    const fire = lightPool(sc, ground.x, ground.y, { color: PAL.fire3, spill: PAL.fire2, radius: 30, intensity: 1.2, anim: 'flicker', fadeIn: 0 });
    void lightDim(sc, 0, 300);
    if (target && !blocked) silhouette(sc, target);
    const marks = scorch(sc, ground, blocked);
    // the strike resolves after the hit-stop (a tie: at contact, the drake's own death must start);
    // the rest is fire-and-forget
    // a tie: the backlash takes the drake bare; its cloak flies home and re-seats as it dies (critic r1 #3)
    if (tie) {
      chipsHome(sc, { x: B.x, y: B.y - 6 }, framePt(u, 'core'), DEPTH.FX - 1);
      reseat(sc, u, 70, 270);
    }
    if (!tie) await sleep(sc, 130);
    void burnOff(sc, B, VW, veilH, veilDepth).then(() => undefined);
    phase = 'burn';
    fire.setIntensity(0.4, 300);
    void sleep(sc, 300).then(() => fire.fadeOut(300));
    void pool.fadeOut(300);
    if (blocked) {
      // half of the bank rolls back as a cooling backwash, then the cloak re-grows on the bare bones
      void backwash(sc, B, A, dir).then(() => {
        if (live()) {
          void playFrom(u, 'attack', recF);
          play('ashenRegrow', { volume: 0.8, pan });
        }
      });
      void marks;
      return;
    }
    if (tie) return;
    void fuseBack(sc, u, trail, recF, pan, () => undefined);
    if (s.direct || target) void ashSnow(sc, ground);
  } catch (e) {
    finish();
    throw e;
  }
}

/**
 * The target as a BLACK silhouette inside the orange (R1, §5.2.2): from frame +1 it holds through the kit's
 * heavy flash and its hit-stop (+2 frames past it; critic r1 #2: it showed for 2 film frames only), while
 * flame tongues CLIMB its contour from the feet to the crown (re-rolled every 2 frames); then it chars in
 * two stepped frames (ink → stone0 inside, the rim cooling) and lets the body go.
 */
function silhouette(sc: Phaser.Scene, t: MonsterUnit): void {
  if (!t.sprite.active) return;
  const HOLD = 18;
  const make = (k: number): PixelCanvas => {
    const src = currentPixels(t).pc;
    const pc = new PixelCanvas(src.w, src.h);
    const b = src.bounds();
    if (!b) return pc;
    const climb = clamp((k - 2) / 9, 0, 1);
    const front = b.y + b.h - Math.round(b.h * climb);
    const charred = k > HOLD;
    const step = Math.floor(k / 2);
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        if (!src.isOpaque(x, y)) continue;
        const top = !src.isOpaque(x, y - 1);
        const edge = top || !src.isOpaque(x - 1, y) || !src.isOpaque(x + 1, y) || !src.isOpaque(x, y + 1);
        if (charred) {
          // two stepped charring frames: the rim dulls to fire1, the inside to stone0; then only the rim
          if (k > HOLD + 2) {
            if (edge) pc.set(x, y, PAL.stone0);
          } else pc.set(x, y, edge ? PAL.fire1 : PAL.stone0);
          continue;
        }
        // backlit by the blaze: a 1-px fire rim inside the contour (fire2 low, fire1 high), ink inside
        pc.set(x, y, edge ? (y > b.y + b.h * 0.55 || y >= front ? PAL.fire2 : PAL.fire1) : PAL.ink);
        if (!edge || y < front) continue;
        // the climbing flames: tongues lick OUT of the burning contour (left / right / up), 1–3 px
        const hsh = hash(x * 3 + y * 7, step);
        if (hsh < 0.55) continue;
        const len = 1 + Math.floor(hsh * 3.2);
        const dx = !src.isOpaque(x - 1, y) ? -1 : !src.isOpaque(x + 1, y) ? 1 : 0;
        for (let j = 1; j <= len; j++) {
          const xx = x + (dx !== 0 ? (j <= 1 ? dx : 0) : 0);
          const yy = y - j;
          if (xx < 0 || xx >= pc.w || yy < 0 || src.isOpaque(xx, yy)) break;
          pc.set(xx, yy, j === len ? PAL.fire4 : j === 1 ? PAL.fire2 : PAL.fire3);
        }
      }
    // the crown catches last: a ragged fire3 / fire4 crest once the front has climbed all the way
    if (climb >= 1)
      for (let x = b.x; x < b.x + b.w; x++)
        for (let y = b.y; y < b.y + b.h; y++)
          if (src.isOpaque(x, y)) {
            if ((x + step) % 3 === 0 && y > 1) pc.set(x, y - 1, PAL.fire3).set(x, Math.max(0, y - 2), (x + step) % 2 ? PAL.fire4 : PAL.fire3);
            break;
          }
    return pc;
  };
  let ov: ReturnType<typeof overlay> | null = null;
  let k = 0;
  onFrame(sc, () => {
    k++;
    if (!t.sprite.active || !t.sprite.visible) return false;
    if (k === 2) ov = overlay(t, make(k), { depth: t.sprite.depth + 0.2 });
    else if (k > 2 && k <= HOLD + 4) ov?.redraw(make(k));
    return k <= HOLD + 4;
  }, () => (ov as ReturnType<typeof overlay> | null)?.destroy());
}

/**
 * Lost / tied clash (critic r1 #3): the drake takes the backlash BARE (the cloak was the ammunition) and the
 * cloak re-seats plate by plate in the accretion order over ~270 ms, the newest 8 plates welding, while the
 * chips fly home onto them — never the cloaked hit pose popping on in one frame. The unit's own frame (hit /
 * hitHeavy / death, whatever the battle plays) is redrawn with `seated` plates in an overlay; the sprite is
 * hidden under it meanwhile (alpha 0, restored at once when done or if anything else takes the sprite).
 */
function reseat(sc: Phaser.Scene, u: MonsterUnit, startMs: number, ms: number): void {
  if (!u.sprite.active) return;
  const s = u.sprite;
  const light: 'left' | 'right' = u.flipX ? 'right' : 'left';
  let ov: ReturnType<typeof overlay> | null = null;
  let el = 0;
  let last = '';
  let hid = false;
  const end = () => {
    if (hid && s.active && s.alpha === 0) s.setAlpha(1);
    hid = false;
    ov?.destroy();
    ov = null;
  };
  onFrame(sc, (dt) => {
    el += dt;
    if (!s.active || !s.visible || u.retired) return false;
    const fi = u.frameInfo();
    if (!fi.anim) return false;
    // stepped every 2 frames (≈ 33 ms): 44 plates in 8 steps
    const t = clamp((el - startMs) / ms, 0, 1);
    const seated = t >= 1 ? 44 : Math.floor(Math.floor(t * 8) * 5.5);
    if (seated >= 44) return false;
    const key = `${fi.anim}:${fi.frame}:${seated}`;
    if (key !== last) {
      last = key;
      const pc = new PixelCanvas(u.art.w, u.art.h);
      drawAshenSeated(pc, fi.anim as AnyMonsterAnim, fi.frame, seated, light);
      if (!ov) ov = overlay(u, pc, { depth: s.depth + 0.05 });
      else ov.redraw(pc);
    }
    if (!hid) {
      s.setAlpha(0);
      hid = true;
    }
    return true;
  }, end);
}

/** Losing: 9 plate chips (2×3 / 2×2, stone2 with a stone1 crease) arc back from the fizzled veil to the drake. */
function chipsHome(sc: Phaser.Scene, from: XY, to: XY, depth: number): void {
  const px = layer(sc, depth);
  const chips = Array.from({ length: 9 }, (_, i) => ({ d: i * 18 + RR(0, 10), h: RR(6, 16), o: RR(-6, 6), big: i % 2 === 0 }));
  let el = 0;
  onFrame(sc, (dt) => {
    el += dt;
    px.clear();
    let any = false;
    for (const c of chips) {
      const t = (el - c.d) / 170;
      if (t < 0) {
        any = true;
        continue;
      }
      if (t >= 1) continue;
      any = true;
      const e = 1 - (1 - t) * (1 - t);
      const x = Math.round(lerp(from.x + c.o, to.x, e));
      const y = Math.round(lerp(from.y, to.y + c.o * 0.5, e) - Math.sin(t * Math.PI) * c.h);
      px.rect(x, y, 2, c.big ? 3 : 2, PAL.stone2).rect(x, y + (c.big ? 2 : 1), 2, 1, PAL.stone1).dot(x, y, PAL.stone3);
    }
    return any;
  }, () => px.g.destroy());
}

/** Floor scorch: a stone0 blob and six glowing cracks (fire2 → fire1 → stone0). */
function scorch(sc: Phaser.Scene, g: XY, small: boolean): Px {
  const px = layer(sc, DEPTH.TILE_FX + 4);
  const cracks: { a: number; l: number }[] = [];
  for (let i = 0; i < (small ? 3 : 6); i++) cracks.push({ a: (i / 6) * Math.PI * 2 + RR(-0.3, 0.3), l: RR(6, 13) });
  let el = 0;
  onFrame(sc, (dt) => {
    el += dt;
    px.clear();
    if (el > 1400) return false;
    const t = el / 1400;
    const r = small ? 8 : 14;
    px.ellipse(g.x, g.y, r, r * 0.45, PAL.stone0);
    const col = t < 0.3 ? PAL.fire2 : t < 0.6 ? PAL.fire1 : PAL.stone0;
    for (const c of cracks) {
      let x = g.x;
      let y = g.y;
      for (let s = 0; s < c.l; s += 3) {
        const nx = x + Math.cos(c.a + Math.sin(s) * 0.4) * 3;
        const ny = y + Math.sin(c.a + Math.sin(s) * 0.4) * 1.5;
        px.line(Math.round(x), Math.round(y), Math.round(nx), Math.round(ny), col);
        x = nx;
        y = ny;
      }
    }
    return true;
  }, () => px.g.destroy());
  return px;
}

/** The burn-off: flames lick up 3 frames, then the veil burns away top-down into ash flakes and embers. */
function burnOff(sc: Phaser.Scene, B: XY, W: number, h: number, depth: number): Promise<void> {
  const sp = new Sparks(sc, depth + 0.2);
  for (let i = 0; i < 18; i++) {
    const ember = i % 3 === 0;
    sp.add({
      x: Math.round(B.x + RR(-W * 0.5, W * 0.5)),
      y: Math.round(B.y - RR(2, h)),
      vx: RR(-10, 10),
      vy: RR(-30, -8),
      ay: 120,
      drag: 1.2,
      delay: RR(0, 200),
      life: RR(380, 640),
      colors: ember ? [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] : [PAL.stone2, PAL.stone1],
      shape: 'px',
      fadeAt: 1,
    });
  }
  sp.release();
  return Promise.resolve();
}

/**
 * Blocked: half of the bank rolls back toward the drake as a cooling backwash (≈ 36 px), drawn ABOVE the
 * battle's backlash bolt (critic r1 #6): five billows, still burning as they leave the wall, cooling and
 * charring as they slow, shrinking to nothing.
 */
function backwash(sc: Phaser.Scene, B: XY, A: XY, dir: number): Promise<void> {
  const px = layer(sc, DEPTH.FX_TOP - 1);
  let el = 0;
  const L = Math.hypot(A.x - B.x, A.y - B.y) || 1;
  const ux = (A.x - B.x) / L;
  const uy = (A.y - B.y) / L;
  const MS = 440;
  return new Promise((res) => {
    onFrame(sc, (dt) => {
      el += dt;
      px.clear();
      if (el > MS) return false;
      const t = el / MS;
      const d = 36 * (1 - (1 - t) * (1 - t));
      for (let i = 0; i < 5; i++) {
        const s = d - i * 6;
        if (s < 0) continue;
        const rx = Math.max(1, (8 - i) * (1 - t * 0.75));
        const tones = t < 0.25 ? BURN_T : t < 0.55 ? COOL_T : CHAR_T;
        const x = B.x + ux * s + (i % 2 ? 0 : -uy * 4);
        const y = B.y + uy * s - rx * 0.72 + 1;
        drawPuff(px, x, y, rx, tones, -Math.PI / 2 - dir * (0.9 - ((Math.floor(el / 50 + i) % 6) / 5) * 1.8), 0.75);
        if (t < 0.3) tongues(px, Math.round(x), Math.round(y - rx * 0.7), rx, 1 - t * 3, Math.floor(el / 17), 7 + i);
      }
      return true;
    }, () => {
      px.g.destroy();
      res();
    });
  });
}

/**
 * The fuse back: the soot trail lights from the target back to the jaw in four shrinking segments
 * (60 ms each: fire3 → fire1 → stone0); at the jaw the heart answers and the cloak re-grows.
 */
async function fuseBack(sc: Phaser.Scene, u: MonsterUnit, trail: XY[], recF: number, pan: number, done: () => void): Promise<void> {
  await sleep(sc, 0);
  if (trail.length < 2) {
    done();
    if (u.sprite.active && !u.retired) void playFrom(u, 'attack', recF);
    return;
  }
  play('ashenFuse', { volume: 0.9, pan });
  // over a card lying on the tile (CARD_ON_TILE), under shadows and bodies
  const px = layer(sc, DEPTH.SHADOW - 1);
  const N = trail.length;
  const seg = 4;
  let el = 0;
  const lit: number[] = new Array(seg).fill(-1);
  const end = new Promise<void>((res) => {
    onFrame(sc, (dt) => {
      el += dt;
      px.clear();
      const k = Math.floor(el / 60);
      for (let i = 0; i < seg; i++) {
        if (k < i) continue;
        if (lit[i] < 0) {
          lit[i] = el;
          // a small fire2 flash per segment, each smaller (r 8 → 5)
          const p = trail[Math.round((N - 1) * (1 - (i + 0.5) / seg))];
          void lightFlash(sc, p.x, p.y, PAL.fire2, 8 - i, 160, { intensity: 0.8 });
        }
        const age = el - lit[i];
        if (age > 260) continue;
        // 2×2 burning segments (fire3 → fire2 → fire1 → soot) with a 3×3 fire3 head, fire4 at its heart,
        // running toward the drake while the segment is fresh (critic r1 #13: 2-px dots read as dust)
        const col = age < 60 ? PAL.fire3 : age < 120 ? PAL.fire2 : age < 190 ? PAL.fire1 : PAL.stone0;
        const a = Math.floor((N - 1) * (1 - (i + 1) / seg));
        const b = Math.ceil((N - 1) * (1 - i / seg));
        const run = age < 60 ? Math.round(b - (b - a) * (age / 60)) : a;
        for (let j = run; j <= b; j++) {
          const p = trail[j];
          px.rect(p.x - 1, p.y - 1, 2, 2, col);
        }
        if (age < 60) {
          const h = trail[run];
          px.rect(h.x - 1, h.y - 2, 3, 3, PAL.fire3).dot(h.x, h.y - 1, PAL.fire4).dot(h.x, h.y - 3, PAL.fire2);
        }
      }
      return el < seg * 60 + 260;
    }, () => {
      px.g.destroy();
      res();
    });
  });
  await sleep(sc, seg * 60);
  done();
  // the heart answers: the rib spill pours while the cloak re-grows (the art, f10 on)
  if (u.sprite.active && !u.retired) {
    play('ashenHeartbeat', { volume: 0.8, pan });
    void playFrom(u, 'attack', recF);
    atFrame(u, 'attack', recF + 2, () => {
      play('ashenSpill', { volume: 0.7, pan });
      play('ashenRegrow', { volume: 0.7, pan });
      spillSparks(sc, u);
    });
  }
  await end;
}

/** 6–8 fire3 → fire1 grains from the rib gaps reaching the floor (the art pours the stream). */
function spillSparks(sc: Phaser.Scene, u: MonsterUnit): void {
  if (!u.sprite.active) return;
  const c = framePt(u, 'core');
  const sp = new Sparks(sc, u.sprite.depth + 0.3);
  for (let i = 0; i < 7; i++)
    sp.add({ x: c.x + RR(-4, 4), y: c.y + RR(4, 9), vx: RR(-12, 12), vy: RR(-10, 10), ay: 220, life: RR(300, 460), floor: u.home.y, bounce: 0.1, colors: [PAL.fire3, PAL.fire2, PAL.fire1], shape: 'px', fadeAt: 1 });
  sp.release();
  const pool = lightPool(sc, u.home.x + (u.flipX ? -4 : 4), u.home.y, { color: PAL.fire2, radius: 10, intensity: 0.4, fadeIn: 0 });
  void sleep(sc, 300).then(() => pool.fadeOut(300));
}

/** Ash snow: single stone2 / stone1 flakes drift onto the scorched tile, settle, blink out (flakes only). */
async function ashSnow(sc: Phaser.Scene, g: XY): Promise<void> {
  await sleep(sc, 440);
  const px = layer(sc, DEPTH.TILE_FX + 8);
  const flakes: { x: number; y: number; t0: number; land: number; c: number; big: boolean }[] = [];
  for (let i = 0; i < 8; i++) flakes.push({ x: g.x + RR(-14, 14), y: g.y + RR(-4, 4), t0: i * 300 + RR(0, 80), land: 0, c: i % 2 ? PAL.stone1 : PAL.stone2, big: i % 3 === 0 });
  let el = 0;
  onFrame(sc, (dt) => {
    el += dt;
    px.clear();
    let any = false;
    for (const f of flakes) {
      const t = el - f.t0;
      if (t < 0) {
        any = true;
        continue;
      }
      const fall = 900;
      if (t < fall) {
        any = true;
        const k = t / fall;
        const x = Math.round(f.x + Math.sin(t * 0.012 + f.x) * 1);
        const y = Math.round(f.y - 40 * (1 - k));
        px.rect(x, y, f.big ? 2 : 1, 1, f.c);
      } else if (t < fall + 400) {
        any = true;
        px.rect(Math.round(f.x), Math.round(f.y), f.big ? 2 : 1, 1, Math.floor(t / 70) % 2 && t > fall + 260 ? PAL.stone0 : f.c);
      }
    }
    return any;
  }, () => px.g.destroy());
}

// ================================================================ the death: the ash heap

/**
 * The heap at the talons (the ONLY heap; the art draws none from death f9): a stepped cone that grows over
 * f9–f11, the heart glowing through a gap; on the burst it cools, the wind strips it top-down, the last
 * ember pulses once and goes out dark. Killed at once if another monster takes the tile.
 */
function ashHeap(ctx: Ctx<'destroy'>, u: MonsterUnit, home: XY): { burst(at: XY): void } {
  const sc = ctx.scene;
  // above the card born on the tile (CARD_ON_TILE), under shadows and bodies
  const px = layer(sc, DEPTH.SHADOW - 1);
  const dir = u.flipX ? -1 : 1;
  let el = 0;
  let burstAt = -1;
  let killed = false;
  const zone = ctx.ev.zone;
  const player = ctx.ev.player;
  const uid = ctx.ev.uid;
  const occupied = (): boolean => {
    try {
      const f = ctx.views.field as unknown as { unitAt?: (p: number, z: number) => MonsterUnit | null };
      const o = f.unitAt?.(player, zone);
      return !!o && o.uid !== uid;
    } catch {
      return false;
    }
  };
  const embers: { x: number; y: number }[] = [];
  onFrame(sc, (dt) => {
    el += dt;
    px.clear();
    if (killed || occupied()) return false;
    // it grows fast (≈ 120 ms) from death f8, while the crumble still falls into it (no empty-tile frame)
    const grow = clamp(el / 120, 0, 1);
    const sinceBurst = burstAt < 0 ? -1 : el - burstAt;
    // the wind strips it top-down from +420 ms
    const strip = sinceBurst < 420 ? 0 : clamp((sinceBurst - 420) / 580, 0, 1);
    const H = Math.round(14 * Math.sqrt(grow) * (1 - strip));
    const hw = Math.round(15 * Math.sqrt(grow));
    const cx = home.x + dir * 1;
    const halfAt = (j: number): number => Math.round(hw * Math.sqrt(1 - (j + 1) / (H + 1)));
    // a 1-px ink outline round the cone, so it separates from the dark tile (critic r1 #4)
    if (H > 0) {
      for (let j = 0; j < H; j++) px.run(home.y - j, cx - halfAt(j) - 1, cx + halfAt(j) + 1, PAL.ink);
      px.run(home.y - H, cx - Math.max(1, halfAt(H - 1)), cx + Math.max(1, halfAt(H - 1)), PAL.ink);
      px.run(home.y + 1, cx - hw + 1, cx + hw - 1, PAL.ink);
    }
    for (let j = 0; j < H; j++) {
      const k = (j + 1) / (H + 1);
      const half = halfAt(j);
      const y = home.y - j;
      // tone bands: a stone1 foot, a stone2 body, the lit stone3 top; the shadow flank (away from the
      // light, P1 top-left) one band darker
      const col = k > 0.62 ? PAL.stone3 : k > 0.25 ? PAL.stone2 : PAL.stone1;
      const dark = k > 0.62 ? PAL.stone2 : k > 0.25 ? PAL.stone1 : PAL.stone0;
      px.run(y, cx - half, cx + half, col);
      if (half >= 2) px.run(y, cx + Math.ceil(half * 0.45), cx + half, dark);
      // strata: a stone1 crease every 4 rows on the lit side
      if (j % 4 === 2 && half > 3) px.run(y, cx - half + 1, cx - 1, PAL.stone1);
    }
    if (H > 2) px.run(home.y - H + 1, cx - 1, cx, PAL.stone3);
    // the heart through a 2-px eye: fire3 with a fire4 pulse → (cooling) fire2 → fire1 → stone1
    const pulse = sinceBurst < 0 && Math.floor(el / 130) % 3 === 0;
    const hc = sinceBurst < 0 ? (pulse ? PAL.fire4 : PAL.fire3) : sinceBurst < 120 ? PAL.fire2 : sinceBurst < 240 ? PAL.fire1 : sinceBurst < 360 ? PAL.stone1 : -1;
    if (H > 4 && hc >= 0) {
      const ey = home.y - Math.round(H * 0.42);
      px.rect(cx - 1, ey, 2, 2, hc).run(ey - 1, cx - 1, cx, PAL.ink);
      if (sinceBurst < 0) px.dot(cx - 2, ey + 1, PAL.fire1).dot(cx + 1, ey + 1, PAL.fire1);
    }
    // the last ember: stays after the heap, pulses once (fire1 → fire2 → fire1), then blinks out dark
    if (strip >= 1 || (sinceBurst > 900 && H <= 1)) {
      const t = sinceBurst - 1000;
      const col = t < 120 ? PAL.fire1 : t < 220 ? PAL.fire2 : t < 340 ? PAL.fire1 : t < 400 ? PAL.stone0 : t < 440 ? PAL.fire1 : t < 520 ? PAL.stone0 : -1;
      if (col >= 0) px.dot(cx, home.y, col);
      if (t >= 400 && t < 640) {
        // the smoke curl rising 4 px
        const r = Math.round((t - 400) / 60);
        px.dot(cx + (r % 2), home.y - 1 - r, PAL.stone2);
      }
      if (t > 640) return false;
    }
    for (const e of embers) px.dot(e.x, e.y, PAL.fire1);
    return el < 4000;
  }, () => px.g.destroy());
  return {
    burst(at: XY) {
      if (burstAt >= 0) return;
      burstAt = el;
      void at;
      // the gust: rows of particles stripped off top-down (P1 → +x)
      const sp = new Sparks(sc, DEPTH.SHADOW);
      for (let i = 0; i < 26; i++)
        sp.add({ x: home.x + RR(-12, 12), y: home.y - RR(1, 13), vx: dir * RR(60, 110), vy: RR(-30, -10), drag: 1.2, delay: 420 + i * 22, life: RR(500, 800), colors: i % 2 ? [PAL.stone2, PAL.stone1] : [PAL.stone1, PAL.stone0], shape: 'px', fadeAt: 1 });
      sp.release();
      void sleep(sc, 1000).then(() => play('ashenLastBeat', { volume: 0.8, pan: panAt(home.x) }));
      // a faint grey stain fades last (stepped: stone0 then gone)
      const st = layer(sc, DEPTH.TILE_FX + 3);
      st.ellipse(home.x, home.y, 12, 5, PAL.stone0);
      void sleep(sc, 1200).then(() => st.g.destroy());
    },
  };
}

async function ashenDeathV3(ctx: Ctx<'destroy'>): Promise<void> {
  if (ctx.ev.location !== 'monster' || sourceOwnsDestroy(ctx)) return ctx.base();
  const u = ctx.views.field.unit(ctx.ev.uid);
  let heap: { burst(at: XY): void } | null = null;
  if (u && !u.retired && u.sprite.active) {
    const home = { ...u.home };
    atFrame(u, 'death', 8, () => {
      // the burst may already have made it (the shatter runs on the dissolve mark): never a second heap
      if (!heap) heap = ashHeap(ctx, u, home);
    });
  }
  // the death's first crackle (critic r1 #9): the shared kit plays `deathStart` only when the pose is seen
  // on f0 first; a lethal recoil hands over to death on a later frame, so the crackle was never heard.
  // Here: the pose first seen past f0 → we play it on that frame (f0 first → the kit's own beat on f1).
  if (u && u.sprite.active) {
    const pan = panAt(u.home.x);
    onFrame(ctx.scene, (_dt, el) => {
      if (!u.sprite.active || el > 1500) return false;
      const fi = u.frameInfo();
      if (fi.anim !== 'death') return true;
      if (fi.frame >= 1) play('ashenCrackle', { volume: 1, pan });
      return false;
    });
  }
  return deathV3(ctx, {
    fallback: () => ctx.base(),
    onBurst: (unit, at) => {
      if (!heap) heap = ashHeap(ctx, unit, { ...unit.home });
      heap.burst(at);
    },
  });
}

if (LOOK_V3) {
  registerStrike('ashen_drake', ashStormV3, { name: 'strikes-a:ashen_drake' });
  registerCardHook('ashen_drake', 'destroyed', ashenDeathV3, { name: 'strikes-a:ashen_drake:death' });
}

export { RAMPS };
