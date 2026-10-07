// Ayna Kalkanı's hex mirror dome — a retimed, re-aimed local copy of setpieces.mirrorDome
// (the library version is untouched). Changes: a tighter timeline (the whole main beat ≈1.3 s
// instead of ≈1.6 s), clean reflected beams (gentle fanned arcs that leave the struck point of
// the shell and land on each monster, instead of tall hooks), the incoming streak drawn as a
// thick element-coloured bolt, and a struck-point hex flare. No registrations here.

import Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import { DEPTH, type XY, isoToScreen, screenToIso } from '../../view/layout';
import { TEX, flash, shake } from '../../vfx/core';
import { E, Raster, Sparks, clamp01, freeze, glowStroke, lerp, onFrame, qbez, rampOf, rnd, rr, run, seg, snd } from '../../vfx/setpieces';

const TAU = Math.PI * 2;
const TRAP_RAMP = [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1];

export interface DomeOpts {
  /** Called when the reflected beam reaches attacker i (shatter it here). */
  onHit?: (i: number) => void;
  /** Called when the incoming attack strikes the dome. */
  onBlock?: () => void;
  /** Where the incoming attack comes from (the declared attacker's muzzle). Default attackers[0]. */
  source?: XY;
  /** Colour of the incoming attack streak. Default: the attacking player's colour. */
  attackColor?: number;
  /** Called when the streak leaves the source (sync the attacker's lunge here). */
  onFire?: () => void;
}

export async function mirrorDomeTB(scene: Phaser.Scene, side: PlayerId, attackers: XY[], opts: DomeOpts = {}): Promise<void> {
  const a0 = 2;
  const b0 = side === 0 ? 3 : 1;
  const ra = 1.78;
  const rb = 1.02;
  const rz = 84;
  const fs = side === 0 ? -1 : 1; // forward sign along rows (toward the attacker)
  const k = 1 / 32;
  const cScr = isoToScreen(a0, b0);
  const x0 = Math.floor(cScr.x - (ra + rb) * 32) - 3;
  const x1 = Math.ceil(cScr.x + (ra + rb) * 32) + 3;
  const y0 = Math.floor(cScr.y - (ra + rb) * 16 - rz) - 3;
  const y1 = Math.ceil(cScr.y + (ra + rb) * 16) + 3;
  // far shell behind the row's units, near shell as glass in front of them
  const rowTop = cScr.y - 16;
  const far = new Raster(scene, x0, y0, x1 - x0, y1 - y0, DEPTH.UNIT + rowTop - 1);
  const nearR = new Raster(scene, x0, y0, x1 - x0, y1 - y0, DEPTH.FX - 10);
  const base = new Raster(scene, x0, y0, x1 - x0, y1 - y0, DEPTH.SHADOW - 1);
  const sparks = new Sparks(scene, DEPTH.FX + 6);

  const HEX = 0.13;
  const SQ3 = Math.sqrt(3);
  // hex cell of a (u, v) point → center + edge distance + id
  const hexAt = (u: number, v: number) => {
    const q = ((SQ3 / 3) * u - (1 / 3) * v) / HEX;
    const r = ((2 / 3) * v) / HEX;
    let rx = Math.round(q);
    let rz2 = Math.round(r);
    const ry = Math.round(-q - r);
    const dx = Math.abs(rx - q);
    const dy = Math.abs(ry - (-q - r));
    const dz = Math.abs(rz2 - r);
    if (dx > dy && dx > dz) rx = -ry - rz2;
    else if (dy <= dz) rz2 = -rx - ry;
    const cu = HEX * SQ3 * (rx + rz2 / 2);
    const cv = HEX * 1.5 * rz2;
    const lx = u - cu;
    const ly = v - cv;
    const d = Math.max(Math.abs(lx), Math.abs(lx / 2 + (ly * SQ3) / 2), Math.abs(-lx / 2 + (ly * SQ3) / 2));
    return { cu, cv, edge: (HEX * SQ3) / 2 - d, id: rx * 131 + rz2 * 17 };
  };
  const hash = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  // hex pattern lives on the sphere seen from above-front: (u, v) = (side axis, height) mixed
  // with the row axis so both shells get a full lattice
  const uvOf = (u: number, _w: number, v: number) => ({ hu: u, hv: v });

  // impact point on the shell facing a point, high on the dome
  const toward = (p: XY, el = 0.72) => {
    const g = screenToIso(p.x, p.y + 20);
    let du = (g.col - a0) / ra;
    let dw = (g.row - b0) / rb;
    const l = Math.hypot(du, dw) || 1;
    du /= l;
    dw /= l;
    const u = du * Math.cos(el);
    const w = dw * Math.cos(el);
    const v = Math.sin(el);
    const scr = isoToScreen(a0 + u * ra, b0 + w * rb);
    const h = uvOf(u, w, v);
    return { u: h.hu, v: h.hv, x: scr.x, y: scr.y - v * rz };
  };
  const mean = attackers.length ? { x: attackers.reduce((s2, p) => s2 + p.x, 0) / attackers.length, y: attackers.reduce((s2, p) => s2 + p.y, 0) / attackers.length } : { x: cScr.x - fs * -60, y: cScr.y + fs * 40 };
  const hit = toward(mean);

  let build = 0; // 0..1 materialize wave
  let rippleT = -1; // 0..1 after the block
  let charge = 0; // 0..1 before firing
  let shatter = 0; // 0..1 dissolve
  let flashAll = 0;

  const drawDome = (el: number) => {
    far.begin();
    nearR.begin();
    const qa = (k * k) / (ra * ra) + (k * k) / (rb * rb) + 1 / (rz * rz);
    for (let sy = y0; sy < y1; sy++) {
      const q0 = (sy - 96) / 16;
      for (let sx = x0; sx < x1; sx++) {
        const P = (sx + 0.5 - 320) / 32;
        const A0 = (P + q0) / 2 - a0;
        const B0 = (q0 - P) / 2 - b0;
        const qb = 2 * k * (A0 / (ra * ra) + B0 / (rb * rb));
        const qc = (A0 * A0) / (ra * ra) + (B0 * B0) / (rb * rb) - 1;
        const disc = qb * qb - 4 * qa * qc;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const thick = sq / (2 * qa) / rz; // ~0 at the silhouette
        for (let pass = 1; pass >= 0; pass--) {
          const z = pass === 0 ? (-qb + sq) / (2 * qa) : (-qb - sq) / (2 * qa);
          if (z < 0) continue;
          const near = pass === 0;
          const g = near ? nearR : far;
          const u = (A0 + z * k) / ra;
          const w = (B0 + z * k) / rb;
          const v = z / rz;
          const { hu, hv } = uvOf(u, w, v);
          const h = hexAt(hu, hv);
          // materialize: from the floor ring upward, spreading sideways
          const born = v * 0.8 + hash(h.id) * 0.2;
          const age = build * 1.25 - born;
          if (age < 0) continue;
          if (shatter > 0 && hash(h.id + 7) * 0.7 + Math.hypot(h.cu - hit.u, h.cv - hit.v) * 0.3 < shatter) continue;
          const fresh = age < 0.1;
          const edge = h.edge < (near ? 0.013 : 0.016);
          const rimK = thick < 0.045 || v < 0.03;
          let rip = 0;
          if (rippleT >= 0) {
            const d = Math.hypot(h.cu - hit.u, h.cv - hit.v);
            rip = Math.max(0, 1 - Math.abs(d - rippleT * 2.2) / 0.25) * (1 - rippleT);
          }
          const hot = Math.max(rip, charge * (0.55 + 0.45 * Math.sin(el * 0.03 + h.cu * 9 + h.cv * 5)), flashAll);
          let c: number;
          let lv: number;
          if (rimK && near) {
            c = hot > 0.4 || fresh ? PAL.white : PAL.mag4;
            lv = 1;
          } else if (edge) {
            // glass: hex seams fade where we look straight through the shell, glow at grazing angles
            const fresE = 1 - Math.min(1, thick * 2.2);
            c = fresh || hot > 0.75 ? PAL.white : hot > 0.35 ? PAL.mag4 : near ? (fresE > 0.45 ? PAL.mag3 : PAL.mag2) : PAL.mag2;
            lv = near ? (fresh || hot > 0.35 ? 1 : 0.2 + fresE * 0.8) : 0.35;
          } else {
            const fres = 1 - Math.min(1, thick * 2.2);
            if (fresh) {
              c = PAL.mag3;
              lv = 0.5;
            } else if (hot > 0.45) {
              c = near ? PAL.mag3 : PAL.mag2;
              lv = 0.15 + hot * 0.35;
            } else {
              c = near ? PAL.mag2 : PAL.mag1;
              lv = near ? fres * fres * 0.3 : 0.04 + fres * 0.1;
            }
          }
          // specular streaks on the near glass (light from the upper left)
          if (near && !fresh && w > 0) {
            const sa = Math.abs(u + 0.44 - (v - 0.62) * 0.35);
            if (sa < 0.025 && v > 0.42 && v < 0.86) {
              c = PAL.white;
              lv = 1;
            } else if (Math.abs(u + 0.36 - (v - 0.62) * 0.35) < 0.012 && v > 0.55 && v < 0.75) {
              c = PAL.mag4;
              lv = 1;
            }
          }
          g.dpx(sx, sy, c, lv);
        }
      }
    }
    far.end();
    nearR.end();
    base.draw((g) => {
      const kk = Math.min(1, build * 2) * (1 - shatter);
      if (kk <= 0) return;
      const n = 120;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * TAU;
        const p = isoToScreen(a0 + Math.cos(t) * ra, b0 + Math.sin(t) * rb);
        g.dpx(p.x, p.y, PAL.mag3, kk);
        g.dpx(p.x, p.y + 1, PAL.mag1, kk * 0.7);
        const q = isoToScreen(a0 + Math.cos(t) * ra * 0.93, b0 + Math.sin(t) * rb * 0.93);
        g.dpx(q.x, q.y, PAL.mag1, kk * 0.5);
      }
    });
  };
  const stopDraw = onFrame(scene, (_dt, el) => drawDome(el));

  // ---- 0–380 materialize
  snd('mirror', 0.9);
  await run(scene, 380, (t) => {
    build = E.outQuad(t);
    if (rnd() < 0.5) {
      const a = rr(-1.2, 1.2);
      const p = toward({ x: cScr.x + Math.sin(a) * 80, y: cScr.y - fs * 40 });
      sparks.add({ x: p.x, y: p.y, vx: rr(-20, 20), vy: rr(-30, -10), life: 260, ramp: TRAP_RAMP, tex: TEX.px1 });
    }
  });
  build = 1;

  // ---- 450–640 the incoming attack streaks into the shell
  const src = opts.source ?? attackers[0] ?? { x: cScr.x - fs * 60, y: cScr.y + fs * 60 };
  const atk = rampOf(opts.attackColor ?? PLAYER_COLOR[side === 0 ? 1 : 0]);
  const streak = new Raster(scene, Math.min(src.x, hit.x) - 12, Math.min(src.y, hit.y) - 12, Math.abs(src.x - hit.x) + 24, Math.abs(src.y - hit.y) + 24, DEPTH.FX + 4);
  snd('beamFire', 0.6, 1.2);
  opts.onFire?.();
  await run(scene, 140, (t) => {
    const kk = E.inQuad(t);
    const hx = lerp(src.x, hit.x, kk);
    const hy = lerp(src.y, hit.y, kk);
    const tx = lerp(src.x, hit.x, Math.max(0, kk - 0.35));
    const ty = lerp(src.y, hit.y, Math.max(0, kk - 0.35));
    streak.draw((g) => {
      glowStroke(g, [{ x: tx, y: ty }, { x: hx, y: hy }], [atk[1], atk[3], atk[4], PAL.white], 2.6);
      g.disc(hx, hy, 4.5, atk[4]);
      g.disc(hx, hy, 3, PAL.white);
    });
  });
  streak.destroy();
  // ---- block: hit-stop, hex ripple, sparks
  opts.onBlock?.();
  snd('shieldBlock', 1);
  snd('impactHeavy', 0.6, 1.3);
  rippleT = 0;
  flashAll = 0.6;
  sparks.burst(30, () => {
    const a = rr(0, TAU);
    const sp = rr(60, 200);
    return { x: hit.x, y: hit.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, drag: 3.5, life: rr(240, 480), ramp: TRAP_RAMP, tex: rnd() < 0.3 ? TEX.plus : TEX.px1, trail: true };
  });
  const star = scene.add.image(hit.x, hit.y, TEX.spark).setScale(5).setTint(PAL.white).setDepth(DEPTH.FX + 7);
  void shake(scene, 220, 3);
  await freeze(scene, 70);
  void run(scene, 160, (t) => star.setScale(Math.max(1, Math.round(5 * (1 - t))))).then(() => star.destroy());
  void run(scene, 140, (t) => (flashAll = 0.6 * (1 - t)));
  await run(scene, 190, (t) => (rippleT = t));
  rippleT = -1;

  // ---- charge: the shell glows hotter, light gathers at the impact point
  snd('beamCharge', 0.7, 1.4);
  // the light gathers at the impact point: a growing white core
  const core = scene.add.image(hit.x, hit.y, TEX.dot5).setDepth(DEPTH.FX + 7).setTint(PAL.mag4).setScale(0.2);
  await run(scene, 170, (t) => {
    charge = E.inQuad(t);
    core.setScale(Math.max(0.2, Math.round(E.inQuad(t) * 6) / 2)).setTint(Math.floor(t * 8) % 2 ? PAL.white : PAL.mag4);
    if (rnd() < 0.8) {
      const a = rr(0, TAU);
      const r = rr(20, 40);
      sparks.add({ x: hit.x + Math.cos(a) * r, y: hit.y + Math.sin(a) * r * 0.6, home: { x: hit.x, y: hit.y, k: 0.4 }, life: 200, ramp: [PAL.mag4, PAL.white], tex: TEX.px1 });
    }
  });

  // ---- reflect: one beam per attacker
  snd('mirror', 1, 1.3);
  snd('beamFire', 1, 1.1);
  flashAll = 1;
  void flash(scene, 120, PAL.mag4, 0.35);
  core.destroy();
  // each reflected beam arcs on its own curve (fanned so a row of attackers never overlaps)
  const nB = attackers.length;
  const beams = attackers.map((p, i) => {
    const spread = nB > 1 ? (i - (nB - 1) / 2) * 7 : 0;
    const from = { x: hit.x + spread, y: hit.y + Math.abs(spread) * 0.4 };
    const mx = (from.x + p.x) / 2;
    const my = (from.y + p.y) / 2;
    const dxB = p.x - from.x;
    const dyB = p.y - from.y;
    const lB = Math.hypot(dxB, dyB) || 1;
    // gentle fanned arcs (a small bow up, a little spread between neighbours)
    const fan = (i - (nB - 1) / 2) * 14;
    const ctrl = { x: mx + (-dyB / lB) * fan, y: my + (dxB / lB) * fan - 7 - Math.abs(fan) * 0.2 };
    const curve: XY[] = [];
    for (let k = 0; k <= 32; k++) curve.push(qbez(from, ctrl, p, k / 32));
    const xs = curve.map((q) => q.x);
    const ys = curve.map((q) => q.y);
    const bx0 = Math.min(...xs) - 14;
    const by0 = Math.min(...ys) - 14;
    const r = new Raster(scene, bx0, by0, Math.max(...xs) - bx0 + 14, Math.max(...ys) - by0 + 14, DEPTH.FX + 5);
    return { from, to: p, curve, r, i, hitDone: false };
  });
  // stray reflections splaying off the dome (anime "many beams")
  const strays = Array.from({ length: 7 }, (_, i) => {
    const a = -Math.PI / 2 + (i - 3) * 0.42 + rr(-0.1, 0.1) + (side === 0 ? 0.35 : -0.35);
    const len = rr(60, 130);
    return { a, len, d: rr(0, 60) };
  });
  const strayR = Raster.around(scene, hit.x, hit.y, 300, 300, DEPTH.FX + 4);
  void run(scene, 300, (t, el) => {
    strayR.draw((g) => {
      for (const st of strays) {
        const lt = clamp01((el - st.d) / 110);
        if (lt <= 0 || t > 0.95) continue;
        const r0 = st.len * Math.max(0, lt - 0.45) * 1.6;
        const r1 = st.len * E.outQuad(lt);
        const ca = Math.cos(st.a);
        const sa = Math.sin(st.a);
        g.line(hit.x + ca * r0, hit.y + sa * r0, hit.x + ca * r1, hit.y + sa * r1, lt < 0.6 ? PAL.white : PAL.mag3, 1 - t * 0.6, 1);
      }
    });
  }).then(() => strayR.destroy());
  void shake(scene, 300, 4);
  await run(scene, 380, (t, el) => {
    charge = Math.max(0, 1 - t * 2);
    flashAll = Math.max(0, 1 - t * 3);
    for (const b of beams) {
      const lt = clamp01((el - b.i * 40) / 120); // head travel
      const fade = seg(t, 0.55, 1);
      b.r.draw((g) => {
        if (lt <= 0) return;
        const n = Math.max(2, Math.round(E.outQuad(lt) * (b.curve.length - 1)) + 1);
        const tail = Math.max(0, Math.floor(seg(t, 0.45, 1) * (b.curve.length - 1)));
        const pts = b.curve.slice(Math.min(tail, n - 2), n);
        const wob = Math.sin(el * 0.08 + b.i) * 0.4;
        glowStroke(g, pts, [PAL.mag1, PAL.mag3, PAL.mag4, PAL.white], Math.max(0.6, 2.2 * (1 - fade) + wob), 1 - fade * 0.8);
        const h = pts[pts.length - 1];
        if (lt < 1) {
          g.disc(h.x, h.y, 3.5, PAL.mag4);
          g.disc(h.x, h.y, 2, PAL.white);
        }
        if (lt >= 1 && fade < 0.6) {
          g.disc(b.to.x, b.to.y, 7 * (1 - fade), PAL.mag4, 0.8);
          g.disc(b.to.x, b.to.y, 4 * (1 - fade), PAL.white);
        }
      });
      if (lt >= 1 && !b.hitDone) {
        b.hitDone = true;
        opts.onHit?.(b.i);
        snd('impactHeavy', 0.8);
        sparks.burst(22, () => {
          const a = rr(0, TAU);
          const sp = rr(60, 190);
          return { x: b.to.x, y: b.to.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 30, ay: 300, drag: 2, life: rr(260, 520), ramp: TRAP_RAMP, trail: true, tex: rnd() < 0.3 ? TEX.px2 : TEX.px1 };
        });
      }
    }
  });
  beams.forEach((b) => b.r.destroy());

  // ---- the dome shatters into hex shards (background)
  void (async () => {
    snd('shatter', 0.7, 1.4);
    sparks.burst(40, () => {
      const p = toward({ x: cScr.x + rr(-90, 90), y: cScr.y - fs * rr(20, 60) });
      return { x: p.x + rr(-10, 10), y: p.y + rr(-30, 10), vx: rr(-40, 40), vy: rr(-40, 10), ay: 260, life: rr(380, 700), ramp: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], tex: rnd() < 0.4 ? TEX.px2 : TEX.plus };
    });
    await run(scene, 340, (t) => (shatter = E.outQuad(t) * 1.15));
    stopDraw();
    far.destroy();
    nearR.destroy();
    base.destroy();
    sparks.close();
  })();
}
