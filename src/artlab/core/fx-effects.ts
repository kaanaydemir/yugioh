// Art Lab effects (variant-independent; colours from LabFxSettings).
//
// Every effect is a window + a pure render(local) function: particles are analytic
// (p = p0 + v·τ + ½·g·τ², parameters drawn once from mulberry32), sprites are baked strips placed
// at integer pixels, lights are baked soft glows whose intensity is animated through alpha.
// Nothing is scaled, rotated or tweened.

import Phaser from 'phaser';
import { mulberry32 } from '../../art/pixel';
import { LAB_DEPTH, type LabFxSettings, type XY } from '../types';
import type { LabActor } from './actors';
import { frameStart } from './anim';
import { boltAt, boltEase, firstContact, pathLength, type ActorId, type BattleScript, type FxCue } from './battle';
import { place, type Bag, type Effect, type EffectSpec } from './fx-manager';
import { CIRCLE_DRAW, CIRCLE_FADE, CIRCLE_LOOP, rc, type FxTextures, type Strip } from './fx-textures';
import type { TimeMap } from './time';

export interface FxWorld {
  scene: Phaser.Scene;
  tex: FxTextures;
  fx: LabFxSettings;
  time: TimeMap;
  actors: Record<ActorId, LabActor>;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Ramp colour counted from the light end (0 = lightest). */
const top = (r: readonly number[], k: number) => r[Math.max(0, r.length - 1 - k)];

/** One pixel particle rectangle at integer coordinates. */
function px(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, w = 1, h = 1): void {
  g.fillStyle(c, a);
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

function frameOf(strip: Strip, i: number): number {
  return Math.max(0, Math.min(strip.n - 1, Math.floor(i)));
}

// ---------------------------------------------------------------- dust (shared by landings and hops)

interface Dust {
  n: number;
  th: Float32Array;
  v: Float32Array;
  vz: Float32Array;
  life: Float32Array;
  big: Uint8Array;
}

function makeDust(n: number, seed: number, power: number): Dust {
  const r = mulberry32(seed);
  const d: Dust = { n, th: new Float32Array(n), v: new Float32Array(n), vz: new Float32Array(n), life: new Float32Array(n), big: new Uint8Array(n) };
  for (let i = 0; i < n; i++) {
    d.th[i] = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.6;
    d.v[i] = (24 + r() * 46) * power;
    d.vz[i] = 14 + r() * 26;
    d.life[i] = 340 + r() * 320;
    d.big[i] = r() < 0.4 ? 1 : 0;
  }
  return d;
}

/** Draws dust at τ ms after the burst around a footprint (rx, rx/2). Returns the particle count. */
function drawDust(g: Phaser.GameObjects.Graphics, d: Dust, colors: readonly number[], cx: number, cy: number, rx: number, tau: number): number {
  let n = 0;
  const ts = tau / 1000;
  for (let i = 0; i < d.n; i++) {
    const u = tau / d.life[i];
    if (u < 0 || u >= 1) continue;
    const k = 6;
    const disp = (d.v[i] / k) * (1 - Math.exp(-k * ts));
    const z = Math.max(0, d.vz[i] * ts - 0.5 * 120 * ts * ts);
    const c = Math.cos(d.th[i]);
    const s = Math.sin(d.th[i]);
    const x = cx + c * (rx * 0.5 + disp);
    const y = cy + s * 0.5 * (rx * 0.5 + disp) - z;
    const col = u < 0.3 ? top(colors, 0) : u < 0.65 ? top(colors, 1) : top(colors, 2);
    const size = d.big[i] && u < 0.45 ? 2 : 1;
    px(g, x, y - size + 1, col, u > 0.8 ? 0.6 : 1, size, size);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- builders

export function buildEffectSpecs(w: FxWorld, script: BattleScript): EffectSpec[] {
  const specs: EffectSpec[] = [];
  const toLab = (a: number) => w.time.toLab(a);
  const action = (name: string, a0: number, a1: number, make: (bag: Bag) => Effect): EffectSpec => ({
    name,
    start: toLab(a0),
    end: toLab(a1),
    clock: 'action',
    origin: a0,
    make,
  });
  for (const cue of script.cues) {
    switch (cue.kind) {
      case 'summon':
        specs.push(...summon(w, cue, action));
        break;
      case 'charge':
        specs.push(action('orb-charge', cue.start, cue.release + 30, (bag) => orbCharge(w, bag, cue.start, cue.release)));
        break;
      case 'release':
        specs.push(action('release-flash', cue.at, cue.at + 260, (bag) => releaseFlash(w, bag, cue.at)));
        break;
      case 'bolt':
        specs.push(action('bolt', cue.start, cue.impact + 200, (bag) => bolt(w, bag, cue)));
        break;
      case 'impact':
        specs.push(action('impact', cue.at, cue.at + 560, (bag) => impactBurst(w, bag, cue)));
        break;
      case 'breath':
        specs.push(...breath(w, cue, action));
        break;
      case 'dissolve': {
        const d = dissolveData(w, cue.deathStart);
        if (d) specs.push(action('dissolve', d.first, d.last, (bag) => dissolve(w, bag, d)));
        break;
      }
      case 'victory':
        specs.push(action('victory', cue.start, cue.end + 500, (bag) => victory(w, bag, cue.start, cue.end, cue.hop)));
        break;
    }
  }
  return specs;
}

type ActionSpec = (name: string, a0: number, a1: number, make: (bag: Bag) => Effect) => EffectSpec;

// ---------------------------------------------------------------- summon

function summon(w: FxWorld, cue: Extract<FxCue, { kind: 'summon' }>, action: ActionSpec): EffectSpec[] {
  const actor = w.actors[cue.who];
  const slot = actor.slot;
  const side = cue.who === 'dragon' ? w.fx.sideP1 : w.fx.sideP2;
  const accent = cue.who === 'dragon' ? w.fx.crystal : w.fx.magic;
  const light = cue.who === 'dragon' ? w.fx.lightCrystal : w.fx.lightMagic;
  const circle = w.tex.circle[cue.who];
  const rx = (circle.w - 5) >> 1;
  const drawMs = Math.max(120, cue.appear - cue.circle);
  const endMs = cue.end + 380 - cue.circle;
  const FADE_STEP = 70;
  const fadeMs = CIRCLE_FADE * FADE_STEP;
  const floorKey = rx > 26 ? w.tex.floor[44] : w.tex.floor[32];

  const circleFx = (bag: Bag): Effect => {
    const img = bag.image(circle.key, 0, LAB_DEPTH.FLOOR_FX);
    const glow = bag.light(floorKey.key, rc(side, 0.85), LAB_DEPTH.FLOOR_FX + 1);
    return {
      render(t) {
        let f: number;
        let env: number;
        if (t < drawMs) {
          f = Math.floor((t / drawMs) * CIRCLE_DRAW);
          env = t / drawMs;
        } else if (t < endMs - fadeMs) {
          f = CIRCLE_DRAW + (Math.floor((t - drawMs) / 90) % CIRCLE_LOOP);
          env = 1;
        } else {
          const k = Math.floor((t - (endMs - fadeMs)) / FADE_STEP);
          f = CIRCLE_DRAW + CIRCLE_LOOP + Math.min(CIRCLE_FADE - 1, k);
          env = clamp01(1 - (t - (endMs - fadeMs)) / fadeMs);
        }
        place(img, slot.x, slot.y, frameOf(circle, f));
        place(glow, slot.x, slot.y, 0, 0.22 * env);
      },
    };
  };

  // light column + rising motes as the monster appears
  const colAt = cue.appear - 40;
  const motes = (() => {
    const r = mulberry32(cue.who === 'dragon' ? 101 : 202);
    return Array.from({ length: 16 }, () => ({ x: (r() - 0.5) * 1.5 * rx, t0: r() * 320, vy: 46 + r() * 60, life: 300 + r() * 260, tall: r() < 0.35 }));
  })();
  const columnFx = (bag: Bag): Effect => {
    const cols = w.tex.column.map((s) => bag.light(s.key, light));
    const base = bag.light(w.tex.glow[24].key, light);
    const g = bag.graphics(LAB_DEPTH.FX);
    return {
      render(t) {
        const env = t < 80 ? t / 80 : t < 260 ? 1 : clamp01(1 - (t - 260) / 380);
        const wi = t < 300 ? 0 : t < 460 ? 1 : 2;
        cols.forEach((img, i) => {
          if (i !== wi || env <= 0) return void img.setVisible(false);
          img.setPosition(slot.x - (img.frame.width >> 1), slot.y + 4 - img.frame.height).setAlpha(0.3 * env).setVisible(true);
        });
        place(base, slot.x, slot.y - 6, 0, 0.22 * env);
        g.clear();
        let n = 0;
        for (const m of motes) {
          const age = t - m.t0;
          if (age < 0 || age >= m.life) continue;
          const u = age / m.life;
          const y = slot.y - 4 - (m.vy * age) / 1000;
          const c = u < 0.4 ? top(accent, 0) : u < 0.75 ? top(accent, 1) : top(accent, 2);
          px(g, slot.x + m.x, y, c, 1, 1, m.tall && u < 0.5 ? 2 : 1);
          n++;
        }
        bag.particles = n;
      },
    };
  };

  // landing: dust + an iso ring in the side colour
  const dust = makeDust(20, cue.who === 'dragon' ? 11 : 22, 1);
  const landFx = (bag: Bag): Effect => {
    const g = bag.graphics(LAB_DEPTH.FX);
    const ring = bag.image(w.tex.isoRing.key, 0, LAB_DEPTH.FLOOR_FX + 2);
    const radii = w.tex.isoRingRadii;
    return {
      render(t) {
        g.clear();
        bag.particles = drawDust(g, dust, w.fx.dust, slot.x, slot.y, rx * 0.9, t);
        if (t < 300) {
          const r = lerp(8, rx + 10, Math.sqrt(t / 300));
          const i = radii.findIndex((q) => q >= r);
          ring.setTint(t < 120 ? top(side, 0) : t < 220 ? top(side, 1) : top(side, 2));
          place(ring, slot.x, slot.y, i < 0 ? radii.length - 1 : i, t < 220 ? 1 : 0.6);
        } else ring.setVisible(false);
      },
    };
  };

  return [
    action(`summon-circle:${cue.who}`, cue.circle, cue.end + 380, circleFx),
    action(`summon-column:${cue.who}`, colAt, colAt + 680, columnFx),
    action(`summon-land:${cue.who}`, cue.land, cue.land + 680, landFx),
  ];
}

// ---------------------------------------------------------------- wizard: orb charge, release, bolt, impact

function orbCharge(w: FxWorld, bag: Bag, a0: number, release: number): Effect {
  const wiz = w.actors.wizard;
  const M = w.fx.magic;
  const D = Math.max(120, release - a0);
  const r = mulberry32(303);
  const motes = Array.from({ length: 22 }, (_, i) => ({
    t0: (i / 22) * Math.max(60, D - 180) + r() * 40,
    life: 190 + r() * 130,
    th: r() * Math.PI * 2,
    r0: 12 + r() * 11,
    big: i % 4 === 0,
  }));
  const g = bag.graphics(LAB_DEPTH.FX);
  const orb = bag.image(w.tex.orb.key, 0, LAB_DEPTH.FX + 1);
  const glow = bag.light(w.tex.glow[16].key, w.fx.lightMagic);
  return {
    render(t) {
      const m = wiz.lastPointAt(a0 + t, 'muzzle');
      const prog = clamp01(t / D);
      g.clear();
      let n = 0;
      for (const p of motes) {
        const age = t - p.t0;
        if (age < 0 || age >= p.life) continue;
        const u = age / p.life;
        const rr = p.r0 * (1 - u * u);
        const th = p.th + 1.3 * u;
        const c = u < 0.4 ? top(M, 2) : u < 0.75 ? top(M, 1) : top(M, 0);
        const s = p.big && u < 0.5 ? 2 : 1;
        px(g, m.x + Math.cos(th) * rr, m.y + Math.sin(th) * rr, c, 1, s, s);
        n++;
      }
      bag.particles = n;
      const k = Math.min(w.tex.orb.n - 1, Math.floor(prog * w.tex.orb.n));
      place(orb, m.x, m.y, k);
      const flick = Math.floor(t / 70) % 2 ? 0.06 : 0;
      place(glow, m.x, m.y, 0, 0.12 + 0.42 * prog + flick);
    },
  };
}

function releaseFlash(w: FxWorld, bag: Bag, at: number): Effect {
  const m = w.actors.wizard.lastPointAt(at, 'muzzle');
  const M = w.fx.magic;
  const star = bag.image(w.tex.flashMagic.key, 0, LAB_DEPTH.FX + 2);
  const glow = bag.light(w.tex.glow[24].key, w.fx.lightMagic);
  const g = bag.graphics(LAB_DEPTH.FX + 1);
  const r = mulberry32(404);
  const sparks = Array.from({ length: 8 }, (_, i) => ({ th: (i / 8) * Math.PI * 2 + r() * 0.5, v: 60 + r() * 60, life: 140 + r() * 90 }));
  const steps = [50, 110, 170, 240];
  return {
    render(t) {
      const f = steps.findIndex((s) => t < s);
      if (f < 0) star.setVisible(false);
      else place(star, m.x, m.y, f);
      place(glow, m.x, m.y, 0, 0.75 * clamp01(1 - t / 240));
      g.clear();
      let n = 0;
      for (const s of sparks) {
        if (t >= s.life) continue;
        const d = (s.v * t) / 1000 + 4;
        const u = t / s.life;
        px(g, m.x + Math.cos(s.th) * d, m.y + Math.sin(s.th) * d, u < 0.5 ? top(M, 0) : top(M, 2));
        n++;
      }
      bag.particles = n;
    },
  };
}

function bolt(w: FxWorld, bag: Bag, cue: Extract<FxCue, { kind: 'bolt' }>): Effect {
  const M = w.fx.magic;
  const F = Math.max(1, cue.impact - cue.start);
  const ground0 = w.actors.wizard.slot;
  const ground1 = w.actors.dragon.slot;
  // the orb → the first solid contact with the dragon (computed by the battle script), reached
  // exactly at the impact
  const path = (tau: number): XY => boltAt(cue.path, boltEase(tau / F) * cue.uEnd);
  const STEP = 12;
  const r = mulberry32(505);
  const nSamples = Math.ceil(F / STEP);
  const jit = Array.from({ length: nSamples + 1 }, () => ({ j: Math.round((r() - 0.5) * 2.4), sv: { x: (r() - 0.5) * 50, y: (r() - 0.7) * 40 } }));
  const head = bag.image(w.tex.bolt.key, 0, LAB_DEPTH.FX + 2);
  const g = bag.graphics(LAB_DEPTH.FX + 1);
  const glow = bag.light(w.tex.glow[16].key, w.fx.lightMagic);
  const pool = bag.light(w.tex.floor[20].key, w.fx.lightMagic, LAB_DEPTH.FLOOR_FX + 1);
  return {
    render(t) {
      g.clear();
      let n = 0;
      // laid-down trail: squares dropped every STEP ms, shrinking and cooling with age
      for (let j = 0; j <= nSamples; j++) {
        const tj = j * STEP;
        if (tj > t || tj > F) break;
        const age = t - tj;
        if (age >= 190) continue;
        const p = path(tj);
        const size = age < 45 ? 3 : age < 100 ? 2 : 1;
        if (j % 5 === 4 && size < 3) continue;
        const c = age < 45 ? top(M, 1) : age < 110 ? top(M, 2) : top(M, 3);
        const off = jit[j].j;
        px(g, p.x - (size >> 1) + (off > 0 ? 0 : off), p.y - (size >> 1) + off, c, 1, size, size);
        n++;
        // every third sample sheds a falling spark
        if (j % 3 === 0 && age < 230) {
          const as = age / 1000;
          px(g, p.x + jit[j].sv.x * as, p.y + jit[j].sv.y * as + 0.5 * 140 * as * as, age < 110 ? top(M, 0) : top(M, 2));
          n++;
        }
      }
      bag.particles = n;
      if (t < F) {
        const p = path(t);
        place(head, p.x, p.y, Math.floor(t / 50) % w.tex.bolt.n);
        place(glow, p.x, p.y, 0, 0.55);
        const u = boltEase(t / F) * cue.uEnd;
        place(pool, lerp(ground0.x, ground1.x, u), lerp(ground0.y, ground1.y, u), 0, 0.22);
      } else {
        head.setVisible(false);
        glow.setVisible(false);
        pool.setVisible(false);
      }
    },
  };
}

/** Impact / frost-contact light on the struck body: peak alpha and decay (ms). */
const IMPACT_LIGHT_PEAK = 0.18;
const IMPACT_LIGHT = 180;

/** Impact star: frames 0 and 1 only (the later ones carry a small cross / dot ring). */
const IMPACT_STAR: readonly number[] = [60, 110];
/** The broken shock ring: starts once the star is gone and lives this long. */
const IMPACT_RING = 150;
const IMPACT_RING_ARCS = 5;

function impactBurst(w: FxWorld, bag: Bag, cue: Extract<FxCue, { kind: 'impact' }>): Effect {
  const M = w.fx.magic;
  const S = w.fx.spark;
  const actor = w.actors[cue.target];
  // centred on the contact pixel (front of the body), not on the core behind it
  const P = cue.point;
  const star = bag.image(w.tex.flashImpact.key, 0, LAB_DEPTH.FX + 3);
  const g = bag.graphics(LAB_DEPTH.FX + 2);
  const ringG = bag.graphics(LAB_DEPTH.FX + 2);
  // local light: a small glow on the contact pixel that is gone within IMPACT_LIGHT ms (a big,
  // slow one washed the white hide's tone bands flat); the pool stays on the floor, under the actor
  const glow = bag.light(w.tex.glow[16].key, w.fx.lightMagic);
  const pool = bag.light(w.tex.floor[44].key, w.fx.lightMagic, LAB_DEPTH.FLOOR_FX + 1);
  const r = mulberry32(606);
  const sparks = Array.from({ length: 16 }, (_, i) => ({
    th: (i / 16) * Math.PI * 2 + (r() - 0.5) * 0.35,
    v: 90 + r() * 110,
    life: 260 + r() * 200,
  }));
  // the shock ring is broken into short arcs that only show OFF the struck body (it splashes off
  // the surface instead of drawing a reticle over the chest), starts once the star's rays are gone,
  // steps down in colour and alpha, and is over IMPACT_RING ms later
  const ringStart = IMPACT_STAR[IMPACT_STAR.length - 1];
  const arcPhase = 0.35;
  const ring = (t: number) => {
    ringG.clear();
    const age = t - ringStart;
    if (age < 0 || age >= IMPACT_RING) return;
    const u = age / IMPACT_RING;
    const step = Math.min(2, Math.floor(u * 3));
    const col = [top(M, 1), top(M, 2), top(M, 3)][step];
    const alpha = [1, 0.75, 0.45][step];
    const rad = Math.round(lerp(6, 15, Math.sqrt(u)));
    // each arc covers 60 % of its sector early and shrinks to 35 % (the ring breaks up as it grows)
    const cover = lerp(0.6, 0.35, u);
    const pose = actor.poseAt(cue.at + t);
    const seen = new Set<number>();
    ringG.fillStyle(col, alpha);
    const sector = (Math.PI * 2) / IMPACT_RING_ARCS;
    const dth = 0.5 / rad;
    for (let k = 0; k < IMPACT_RING_ARCS; k++) {
      const a0 = arcPhase + k * sector + 0.25 * u;
      for (let th = a0; th < a0 + sector * cover; th += dth) {
        const x = Math.round(P.x + rad * Math.cos(th));
        const y = Math.round(P.y + rad * Math.sin(th));
        const key = y * 4096 + x;
        if (seen.has(key)) continue;
        seen.add(key);
        if (pose && actor.opaque(pose.anim, pose.frame, { x, y })) continue;
        ringG.fillRect(x, y, 1, 1);
      }
    }
  };
  return {
    render(t) {
      const f = IMPACT_STAR.findIndex((e) => t < e);
      if (f < 0) star.setVisible(false);
      else place(star, P.x, P.y, f);
      ring(t);
      g.clear();
      let n = 0;
      const ts = t / 1000;
      const k = 4;
      for (const s of sparks) {
        if (t >= s.life) continue;
        const u = t / s.life;
        const disp = (q: number) => (s.v / k) * (1 - Math.exp(-k * q));
        const pos = (q: number): XY => ({ x: P.x + Math.cos(s.th) * (disp(q) + 3), y: P.y + Math.sin(s.th) * (disp(q) + 3) + 0.5 * 220 * q * q });
        const a = pos(ts);
        const b = pos(Math.max(0, ts - 0.02));
        const c = u < 0.4 ? top(S, 2) : u < 0.7 ? top(M, 2) : top(M, 3);
        px(g, a.x, a.y, c);
        if (Math.abs(b.x - a.x) >= 1 || Math.abs(b.y - a.y) >= 1) px(g, (a.x + b.x) / 2, (a.y + b.y) / 2, c);
        n++;
      }
      bag.particles = n;
      place(glow, P.x, P.y, 0, IMPACT_LIGHT_PEAK * Math.pow(clamp01(1 - t / IMPACT_LIGHT), 1.5));
      place(pool, actor.slot.x, actor.slot.y, 0, 0.3 * clamp01(1 - t / 420));
    },
  };
}

// ---------------------------------------------------------------- dragon: crystal breath + frost burst

interface Shard {
  /** Emission (action ms) and flight time to the contact. */
  s: number;
  F: number;
  /** Mouth at emission, aim point (the wizard's core) and the curve fraction of the contact. */
  M: XY;
  T: XY;
  uEnd: number;
  /** Contact pixel (where it shatters) and its unit travel direction there. */
  E: XY;
  dir: XY;
  lat: number;
  ph: number;
  kind: number;
  mote: { u: number; vx: number; vy: number };
  frags: { th: number; v: number; life: number; big: boolean }[];
}

/** The breath leaves the mouth this far (px) in front of the muzzle point, along the aim. */
const BREATH_LIP = 4;
/** Muzzle light while the breath fires (soft, so the drawn open mouth stays readable). */
const BREATH_MUZZLE_LIGHT = 0.12;

/**
 * Where the breath leaves the mouth: BREATH_LIP px in front of the muzzle point along the aim, and
 * further out (up to 8 px) until it is off the dragon's drawing — the stream and the puff start at
 * the jaw tips, never inside the open mouth.
 */
function lipPoint(dragon: LabActor, a: number, M: XY, T: XY): XY {
  const dx = T.x - M.x;
  const dy = T.y - M.y;
  const L = Math.hypot(dx, dy) || 1;
  const pose = dragon.poseAt(a);
  let k = BREATH_LIP;
  while (k < 8 && pose && dragon.opaque(pose.anim, pose.frame, { x: M.x + (dx / L) * k, y: M.y + (dy / L) * k })) k++;
  return { x: M.x + (dx / L) * k, y: M.y + (dy / L) * k };
}

/** Shard curve: straight mouth → aim line, a lateral spread growing with u and a small wobble. */
function shardCurve(M: XY, T: XY, lat: number, ph: number): (u: number) => XY {
  const dx = T.x - M.x;
  const dy = T.y - M.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  return (u) => {
    const off = lat * 7 * u + 1.3 * Math.sin(ph + 9 * u) * 4 * u * (1 - u);
    return { x: M.x + dx * u + nx * off, y: M.y + dy * u + ny * off };
  };
}

function breath(w: FxWorld, cue: Extract<FxCue, { kind: 'breath' }>, action: ActionSpec): EffectSpec[] {
  const C = w.fx.crystal;
  const dragon = w.actors.dragon;
  const wizard = w.actors.wizard;
  const INT = 14;
  const r = mulberry32(707);
  const shards: Shard[] = [];
  // the first shard flies straight to the contact the battle script computed (exactly at
  // cue.contact); its speed is the stream speed for the others, each of which stops at its OWN
  // first solid contact with the wizard pose shown when it arrives (the wizard recoils meanwhile)
  const M0 = dragon.lastPointAt(cue.start, 'muzzle');
  const v = Math.max(0.05, Math.hypot(cue.point.x - M0.x, cue.point.y - M0.y) / Math.max(1, cue.flight));
  for (let s = cue.start; s < cue.stop; s += INT) {
    const first = shards.length === 0;
    const jit = first ? 1 : 0.92 + r() * 0.16;
    const roll = r();
    const lat = first ? 0 : (r() - 0.5) * 2;
    const ph = r() * Math.PI * 2;
    const mouth = dragon.lastPointAt(s, 'muzzle');
    let T: XY;
    let M: XY;
    let uEnd = 1;
    let F: number;
    if (first) {
      T = cue.point;
      M = lipPoint(dragon, s, mouth, T);
      F = cue.flight;
    } else {
      F = cue.flight * jit;
      const c0 = wizard.lastPointAt(s + F, 'core');
      T = { x: c0.x, y: c0.y + cue.aimDy };
      M = lipPoint(dragon, s, mouth, T);
      for (let it = 0; it < 2; it++) {
        const f = shardCurve(M, T, lat, ph);
        const pose = wizard.poseAt(s + F - 1);
        const c = pose ? firstContact(wizard, pose.anim, pose.frame, f) : null;
        uEnd = c ? c.u : 1;
        F = Math.max(60, (pathLength(f, uEnd) / v) * jit);
      }
    }
    const f = shardCurve(M, T, lat, ph);
    const E = f(uEnd);
    const E1 = f(Math.max(0, uEnd - 0.05));
    const dl = Math.hypot(E.x - E1.x, E.y - E1.y) || 1;
    const sh: Shard = {
      s,
      F,
      M,
      T,
      uEnd,
      E: { x: Math.round(E.x), y: Math.round(E.y) },
      dir: { x: (E.x - E1.x) / dl, y: (E.y - E1.y) / dl },
      lat,
      ph,
      kind: roll < 0.3 ? 0 : roll < 0.65 ? 1 : roll < 0.9 ? 2 : 3,
      mote: { u: 0.25 + r() * 0.5, vx: (r() - 0.5) * 22, vy: -10 - r() * 16 },
      frags: [],
    };
    for (let k = 0; k < 2; k++) sh.frags.push({ th: (r() - 0.5) * 2.6, v: 50 + r() * 70, life: 220 + r() * 150, big: r() < 0.35 });
    shards.push(sh);
  }
  if (!shards.length) return [];
  const lastArrival = Math.max(...shards.map((s) => s.s + s.F));
  const curves = shards.map((sh) => shardCurve(sh.M, sh.T, sh.lat, sh.ph));
  const posAt = (i: number, a: number): XY | null => {
    const sh = shards[i];
    const k = (a - sh.s) / sh.F;
    if (k < 0 || k >= 1) return null;
    return curves[i](k * sh.uEnd);
  };

  // unit aim direction of each shard (its sprite is baked along the stream; the tail trails it)
  const dirs = shards.map((sh) => {
    const L = Math.hypot(sh.T.x - sh.M.x, sh.T.y - sh.M.y) || 1;
    return { x: (sh.T.x - sh.M.x) / L, y: (sh.T.y - sh.M.y) / L };
  });
  const SHARD_TAIL = 6;
  const streamFx = (bag: Bag): Effect => {
    const imgs = shards.map(() => bag.image(w.tex.shards.key, 0, LAB_DEPTH.FX + 1));
    const puffG = bag.graphics(LAB_DEPTH.FX + 2);
    const g = bag.graphics(LAB_DEPTH.FX);
    const mGlow = bag.light(w.tex.glow[16].key, w.fx.lightCrystal);
    const sGlow = [bag.light(w.tex.glow[10].key, w.fx.lightCrystal), bag.light(w.tex.glow[10].key, w.fx.lightCrystal)];
    return {
      render(t) {
        const a = cue.start + t;
        const pose = dragon.poseAt(a);
        const onDragon = (p: XY) => !!pose && dragon.opaque(pose.anim, pose.frame, p);
        // a shard sprite shows only once neither its head nor its tail lies on the dragon's
        // drawing (the open mouth, teeth and throat glow stay clear)
        const shown: (XY | null)[] = shards.map((sh, i) => {
          const p = posAt(i, a);
          if (!p) return null;
          const d = dirs[i];
          if (onDragon(p) || onDragon({ x: p.x - d.x * SHARD_TAIL, y: p.y - d.y * SHARD_TAIL })) return null;
          return p;
        });
        shards.forEach((sh, i) => {
          const p = shown[i];
          if (!p) return void imgs[i].setVisible(false);
          place(imgs[i], p.x, p.y, sh.kind);
        });
        // mist motes shed along the stream
        g.clear();
        let n = 0;
        shards.forEach((sh, i) => {
          const born = sh.s + sh.F * sh.mote.u;
          const age = a - born;
          if (age < 0 || age >= 260) return;
          const p0 = curves[i](sh.mote.u * sh.uEnd);
          const as = age / 1000;
          px(g, p0.x + sh.mote.vx * as, p0.y + sh.mote.vy * as, age < 80 ? top(C, 0) : age < 170 ? top(C, 1) : top(C, 2), age < 170 ? 1 : 0.6);
          n++;
        });
        bag.particles = n + shown.reduce((s, p) => s + (p ? 1 : 0), 0);
        // the jaw tips: frost puff + a soft light while emitting, BREATH_LIP px in front of the
        // muzzle along the aim; puff pixels that fall on the dragon's drawing are not drawn
        const emitting = a < cue.stop;
        const m = lipPoint(dragon, Math.min(a, cue.stop), dragon.lastPointAt(Math.min(a, cue.stop), 'muzzle'), cue.point);
        puffG.clear();
        if (a < cue.stop + 70) {
          const f = t < 50 ? 0 : emitting ? 1 + (Math.floor((t - 50) / 55) % 2) : 3;
          const pc = w.tex.frostPx[f];
          const x0 = Math.round(m.x) - (pc.w >> 1);
          const y0 = Math.round(m.y) - (pc.h >> 1);
          for (let y = 0; y < pc.h; y++)
            for (let x = 0; x < pc.w; x++) {
              const c = pc.get(x, y);
              if (c === null || onDragon({ x: x0 + x, y: y0 + y })) continue;
              puffG.fillStyle(c, 1);
              puffG.fillRect(x0 + x, y0 + y, 1, 1);
            }
        }
        const env = emitting ? 1 : clamp01(1 - (a - cue.stop) / 200);
        place(mGlow, m.x, m.y, 0, BREATH_MUZZLE_LIGHT * env);
        // stream lights ride on the shards shown: the leading one and the middle of the stream
        const alive: XY[] = [];
        for (const p of shown) if (p) alive.push(p);
        const picks = alive.length ? [alive[0], alive[Math.floor(alive.length / 2)]] : [];
        sGlow.forEach((gl, k) => {
          const p = picks[k];
          if (!p || (k === 1 && alive.length < 4)) return void gl.setVisible(false);
          place(gl, p.x, p.y, 0, Math.floor(t / 60 + k) % 2 ? 0.2 : 0.28);
        });
      },
    };
  };

  // frost burst at the contacts: short and kept OFF the wizard's silhouette (fragments splash back
  // toward the dragon from just outside the surface, twinkles sit outside the body), so the hit
  // pose's arm and robe stay readable; everything is gone FROST_TAIL ms after the last arrival
  const FROST_TAIL = 300;
  const frostFx = (bag: Bag): Effect => {
    const g = bag.graphics(LAB_DEPTH.FX + 2);
    const flash = bag.image(w.tex.flashCrystal.key, 0, LAB_DEPTH.FX + 3);
    const rings = [0, 1, 2].map(() => bag.image(w.tex.ring.key, 0, LAB_DEPTH.FX + 2));
    const tw = Array.from({ length: 8 }, () => bag.image(w.tex.twinkleCrystal.key, 0, LAB_DEPTH.FX + 3));
    const glow = bag.light(w.tex.glow[16].key, w.fx.lightCrystal);
    const pool = bag.light(w.tex.floor[32].key, w.fx.lightCrystal, LAB_DEPTH.FLOOR_FX + 1);
    const rr = mulberry32(808);
    const span = Math.max(1, lastArrival - cue.contact);
    const back = { x: -shards[0].dir.x, y: -shards[0].dir.y };
    /** Push a world point back along the stream until it is ≥ `m` px off the wizard's pose at `a`. */
    const outside = (p: XY, a: number, m = 2): XY => {
      const pose = wizard.poseAt(a);
      if (!pose) return p;
      const hit = (q: XY) => {
        for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) if (wizard.opaque(pose.anim, pose.frame, { x: q.x + dx, y: q.y + dy })) return true;
        return false;
      };
      let q = p;
      for (let k = 0; k < 20 && hit(q); k++) q = { x: q.x + back.x, y: q.y + back.y };
      return { x: Math.round(q.x), y: Math.round(q.y) };
    };
    const T0 = cue.point;
    const twk = tw.map((_, k) => {
      const d = 3 + rr() * 12;
      const sp = (rr() - 0.5) * 22;
      const at = cue.contact + (k / tw.length) * span;
      return { at, p: outside({ x: T0.x + back.x * d - back.y * sp, y: T0.y + back.y * d + back.x * sp - 4 }, at, 4) };
    });
    // fragments start just off the surface, on the dragon's side
    const starts = shards.map((sh) => outside({ x: sh.E.x - sh.dir.x * 2, y: sh.E.y - sh.dir.y * 2 }, sh.s + sh.F));
    // rings sit clear of the body (≥ 6 px: their own radius stays off the glove / robe)
    const ringAt = shards.map((sh) => outside({ x: sh.E.x, y: sh.E.y }, sh.s + sh.F, 6));
    const ringShards = shards.map((sh, i) => ({ sh, i })).filter(({ i }) => i % 4 === 0);
    const radii = w.tex.ringRadii;
    const flashP = outside(T0, cue.contact);
    return {
      render(t) {
        const a = cue.contact + t;
        const ff = t < 50 ? 0 : t < 100 ? 1 : t < 150 ? 2 : t < 200 ? 3 : -1;
        if (ff < 0) flash.setVisible(false);
        else place(flash, flashP.x, flashP.y, ff);
        // ice fragments: a quick splash back and to the sides, falling a little
        g.clear();
        let n = 0;
        shards.forEach((sh, si) => {
          const arr = sh.s + sh.F;
          const base = Math.atan2(-sh.dir.y, -sh.dir.x);
          const S = starts[si];
          for (const fr of sh.frags) {
            const age = a - arr;
            const life = Math.min(220, fr.life * 0.6);
            if (age < 0 || age >= life) continue;
            const as = age / 1000;
            const th = base + fr.th * 0.6;
            const v = fr.v + 30;
            const x = S.x + Math.cos(th) * v * as;
            const y = S.y + Math.sin(th) * v * as - 30 * as + 0.5 * 200 * as * as;
            const u = age / life;
            const c = u < 0.3 ? top(C, 0) : u < 0.6 ? top(C, 1) : top(C, 2);
            const sz = fr.big && u < 0.5 ? 2 : 1;
            px(g, x, y, c, 1, sz, sz);
            n++;
          }
        });
        bag.particles = n;
        // small frost rings at every fourth arrival (three images cycle), on the surface point
        rings.forEach((img) => img.setVisible(false));
        let ri = 0;
        for (const { sh, i } of ringShards) {
          const age = a - (sh.s + sh.F);
          if (age < 0 || age >= 140 || ri >= rings.length) continue;
          const rad = Math.round(lerp(2, 6, Math.sqrt(age / 140)));
          rings[ri].setTint(age < 70 ? top(C, 0) : top(C, 2));
          place(rings[ri], ringAt[i].x, ringAt[i].y, radii.indexOf(rad));
          ri++;
        }
        tw.forEach((img, k) => {
          const age = a - twk[k].at;
          if (age < 0 || age >= 200) return void img.setVisible(false);
          place(img, twk[k].p.x, twk[k].p.y, Math.min(4, Math.floor(age / 40)));
        });
        // local light on the contact point only while shards land, then a quick fade
        const on = a < lastArrival;
        const fade = clamp01(1 - (a - lastArrival) / IMPACT_LIGHT);
        place(glow, T0.x, T0.y, 0, on ? (Math.floor(t / 50) % 2 ? 0.12 : IMPACT_LIGHT_PEAK) : IMPACT_LIGHT_PEAK * fade);
        place(pool, wizard.slot.x, wizard.slot.y, 0, on ? 0.3 : 0.3 * clamp01(1 - (a - lastArrival) / 250));
      },
    };
  };

  return [
    action('breath', cue.start, lastArrival + 300, streamFx),
    action('frost-burst', cue.contact, lastArrival + FROST_TAIL, frostFx),
  ];
}

// ---------------------------------------------------------------- wizard dissolve (from its own pixels)

/** Share of the vanishing BODY pixels that lift off as particles. */
const DISSOLVE_KEEP = 0.2;
/** Longest particle life (ms, hold included). */
const DISSOLVE_LIFE = 480;

/** Deterministic per-pixel hash in [0, 1). */
function liftHash(x: number, y: number, k: number): number {
  let h = (x * 374761393 + y * 668265263 + k * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Opaque 4-neighbours of a pixel. */
function neighbours4(p: { isOpaque(x: number, y: number): boolean }, x: number, y: number): number {
  return (p.isOpaque(x - 1, y) ? 1 : 0) + (p.isOpaque(x + 1, y) ? 1 : 0) + (p.isOpaque(x, y - 1) ? 1 : 0) + (p.isOpaque(x, y + 1) ? 1 : 0);
}

interface DissolveData {
  first: number;
  last: number;
  n: number;
  x: Float32Array;
  y: Float32Array;
  born: Float32Array;
  life: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  ph: Float32Array;
  hold: Float32Array;
  col: Uint32Array;
  core: XY;
}

/**
 * For every death frame from 'dissolve' on: BODY pixels (≥ 2 opaque 4-neighbours — the art's own
 * drifting motes are single pixels and are left to the drawing) present in frame k but gone in
 * frame k+1 (after removing a whole-body shift of up to 2 px) become particles at the moment frame
 * k+1 appears, in their own colour, at their exact world position. Only a fifth of them lift off
 * (a fixed hash per pixel, so it is deterministic); the rest vanish with the drawn erosion. They
 * move like the drawn motes — up, and a little outward from the body's axis — step down the magic
 * ramp at full alpha and are gone within half a second, so the drawn erosion stays readable.
 */
function dissolveData(w: FxWorld, deathStart: number): DissolveData | null {
  const wiz = w.actors.wizard;
  const spec = wiz.spec('death');
  const nF = spec.durations.length;
  const d0 = Math.max(1, Math.min(nF - 1, spec.marks?.dissolve ?? 1));
  const xs: number[] = [];
  const ys: number[] = [];
  const born: number[] = [];
  const cols: number[] = [];
  for (let k = d0 - 1; k < nF; k++) {
    const A = wiz.canvas('death', k);
    if (!A) continue;
    const B = k + 1 < nF ? wiz.canvas('death', k + 1) : undefined;
    const t = deathStart + frameStart(spec, k + 1);
    // best whole-body shift between the frames
    let sx = 0;
    let sy = 0;
    if (B) {
      let best = -1;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          let hits = 0;
          for (let y = 0; y < A.h; y += 2) for (let x = 0; x < A.w; x += 2) if (A.isOpaque(x, y) && B.isOpaque(x + dx, y + dy)) hits++;
          if (hits > best || (hits === best && Math.abs(dx) + Math.abs(dy) < Math.abs(sx) + Math.abs(sy))) {
            best = hits;
            sx = dx;
            sy = dy;
          }
        }
    }
    for (let y = 0; y < A.h; y++)
      for (let x = 0; x < A.w; x++) {
        const c = A.get(x, y);
        if (c === null) continue;
        if (B && B.isOpaque(x + sx, y + sy)) continue;
        if (neighbours4(A, x, y) < 2) continue;
        if (liftHash(x, y, k) >= DISSOLVE_KEEP) continue;
        const p = wiz.toWorld({ x, y });
        xs.push(p.x);
        ys.push(p.y);
        born.push(t);
        cols.push(c);
      }
  }
  const n = xs.length;
  if (!n) return null;
  const core = wiz.point('death', d0, 'core');
  // the body's axis (the anchor column), like the drawn motes
  const axis = wiz.slot.x;
  const r = mulberry32(909);
  const d: DissolveData = {
    first: Math.min(...born),
    last: 0,
    n,
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    born: Float32Array.from(born),
    life: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    ph: new Float32Array(n),
    hold: new Float32Array(n),
    col: Uint32Array.from(cols),
    core,
  };
  let last = 0;
  for (let i = 0; i < n; i++) {
    d.hold[i] = r() * 50;
    d.life[i] = Math.min(DISSOLVE_LIFE, d.hold[i] + 240 + r() * 220);
    const out = Math.sign(d.x[i] - axis) || (r() < 0.5 ? -1 : 1);
    d.vx[i] = out * (5 + r() * 13);
    d.vy[i] = -(20 + r() * 34);
    d.ph[i] = r() * Math.PI * 2;
    last = Math.max(last, d.born[i] + d.life[i]);
  }
  d.last = last + 20;
  return d;
}

function dissolve(w: FxWorld, bag: Bag, d: DissolveData): Effect {
  const M = w.fx.magic;
  const g = bag.graphics(LAB_DEPTH.FX);
  const glow = bag.light(w.tex.glow[16].key, w.fx.lightMagic);
  const span = Math.max(1, d.last - d.first);
  return {
    render(t) {
      const a = d.first + t;
      g.clear();
      let n = 0;
      for (let i = 0; i < d.n; i++) {
        const age = a - d.born[i];
        if (age < 0 || age >= d.life[i]) continue;
        const u = age / d.life[i];
        // a short beat in place, then up and a little outward (rising faster as it goes)
        const as = Math.max(0, age - d.hold[i]) / 1000;
        const x = d.x[i] + d.vx[i] * as + Math.sin(d.ph[i] + as * 9) * Math.min(1, as * 5);
        const y = d.y[i] + d.vy[i] * as - 0.5 * 40 * as * as;
        // own colour → bright magic → down the ramp, always at full alpha (no translucent haze)
        const c = u < 0.18 ? d.col[i] : u < 0.38 ? top(M, 1) : u < 0.6 ? top(M, 2) : u < 0.82 ? top(M, 3) : top(M, 4);
        px(g, x, y, c);
        n++;
      }
      bag.particles = n;
      place(glow, d.core.x, d.core.y, 0, 0.18 * clamp01(1 - t / span) * (n > 0 ? 1 : 0));
    },
  };
}

// ---------------------------------------------------------------- dragon victory

/** A random world point 3–6 px outside the actor's silhouette at action time `a` (upper 80 %). */
function haloPoint(actor: LabActor, a: number, r: () => number): XY | null {
  const pose = actor.poseAt(a);
  const pc = pose ? actor.canvas(pose.anim, pose.frame) : undefined;
  if (!pc) return null;
  const W = pc.w;
  const H = pc.h;
  const dist = new Int16Array(W * H).fill(99);
  let front: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (pc.isOpaque(x, y)) {
        dist[y * W + x] = 0;
        front.push(x, y);
      }
  for (let d = 1; d <= 6 && front.length; d++) {
    const next: number[] = [];
    for (let i = 0; i < front.length; i += 2)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = front[i] + dx;
          const y = front[i + 1] + dy;
          if (x < 0 || y < 0 || x >= W || y >= H || dist[y * W + x] <= d) continue;
          dist[y * W + x] = d;
          next.push(x, y);
        }
    front = next;
  }
  const b = pc.bounds();
  if (!b) return null;
  const yMax = b.y + Math.floor(b.h * 0.8);
  const cand: number[] = [];
  for (let y = 0; y < yMax; y++) for (let x = 0; x < W; x++) if (dist[y * W + x] >= 3 && dist[y * W + x] <= 6) cand.push(x, y);
  if (!cand.length) return null;
  const i = Math.floor(r() * (cand.length / 2)) * 2;
  return actor.toWorld({ x: cand[i], y: cand[i + 1] });
}

function victory(w: FxWorld, bag: Bag, a0: number, end: number, hop: number | null): Effect {
  const dragon = w.actors.dragon;
  const core = dragon.lastPointAt(a0, 'core');
  const len = Math.max(200, end - a0);
  const r = mulberry32(1001);
  // glints sit just OUTSIDE the silhouette (3–6 px off the body, above the feet) of the pose shown
  // at their moment, so they read against the background instead of vanishing on the white hide
  const glints = Array.from({ length: 7 }, (_, k) => {
    const at = (k / 7) * len * 0.9;
    const p = haloPoint(dragon, a0 + at, r) ?? { x: core.x + (r() - 0.5) * 64, y: core.y - 6 - r() * 34 };
    return { at, x: p.x, y: p.y, spark: k % 2 === 0 };
  });
  const imgs = glints.map((gl) => bag.image(gl.spark ? w.tex.twinkleSpark.key : w.tex.twinkleCrystal.key, 0, LAB_DEPTH.FX + 1));
  const g = bag.graphics(LAB_DEPTH.FX);
  const ring = bag.image(w.tex.isoRing.key, 0, LAB_DEPTH.FLOOR_FX + 2);
  const glow = bag.light(w.tex.glow[24].key, w.fx.lightWarm);
  const dust = makeDust(12, 33, 0.7);
  const radii = w.tex.isoRingRadii;
  return {
    render(t) {
      glints.forEach((gl, k) => {
        const age = t - gl.at;
        if (age < 0 || age >= 350) return void imgs[k].setVisible(false);
        place(imgs[k], gl.x, gl.y, Math.min(4, Math.floor(age / 70)));
      });
      g.clear();
      bag.particles = 0;
      if (hop !== null) {
        const ht = t - (hop - a0);
        if (ht >= 0) bag.particles = drawDust(g, dust, w.fx.dust, dragon.slot.x, dragon.slot.y, 22, ht);
        if (ht >= 0 && ht < 240) {
          const rad = lerp(8, 30, Math.sqrt(ht / 240));
          const i = radii.findIndex((q) => q >= rad);
          ring.setTint(top(w.fx.dust, ht < 120 ? 0 : 1));
          place(ring, dragon.slot.x, dragon.slot.y, i < 0 ? radii.length - 1 : i, 0.8);
        } else ring.setVisible(false);
      } else ring.setVisible(false);
      const pulse = clamp01(Math.sin((Math.PI * Math.min(t, len)) / len));
      place(glow, core.x, core.y - 8, 0, 0.2 * pulse);
    },
  };
}
