// Kristal Ejder — "Prizma Nefesi" (GAME_DESIGN §7) + crystal-shard impact + the ace's death.
//
// Strike (≈1.25 s): the head rears back while white-blue motes stream up from a glowing floor
// ring into the mouth (500 ms, tracked frame by frame with CRYSTAL_WYRM_MOUTH), the jaw snaps
// open on frame 5 and a thick prism beam (white core, cyan edges, rainbow fringe) fires; the body
// kicks back with the recoil. Impact: hit-stop + crystal shards + prism ring + light rays + a
// screen-wide glare. Blocked: the beam splinters off the shield into rainbow ricochets.
// Death: the dragon freezes in its recoil, glowing cracks race through its crystal body, light
// bursts out of them, time slows, and it shatters into glass and pixels.

import type Phaser from 'phaser';
import { onDuelStart } from '../../duel/seeds';
import { PAL } from '../../art/palette';
import * as wyrmArt from '../../art/monsters/crystal_wyrm';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { beam, type Px } from '../../vfx/combat';
import { shake } from '../../vfx/core';
import { strikeStartFrame } from '../_v3/clash';
import { lightBeam, lightPool } from '../../view/light';
import { registerCardHook, registerStrike } from '../api';
import { dimPulse } from '../battle/_kit';
import type { StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import {
  ADD,
  E,
  RR,
  Sparks,
  TAU,
  TK,
  animate,
  clamp,
  currentPixels,
  followLight,
  flavoredDeath,
  glow,
  glowPulse,
  holdFrame,
  layer,
  len,
  lerp,
  norm,
  onFrame,
  overlay,
  pick,
  playSfx,
  screenFlash,
  seed,
  shatterPx,
  sleep,
  sub,
  whiteFlash,
  type Ctx,
} from './_kit';

const MOUTH: { x: number; y: number }[] | undefined = (wyrmArt as unknown as { CRYSTAL_WYRM_MOUTH?: { x: number; y: number }[] }).CRYSTAL_WYRM_MOUTH;
const RAINBOW = [PAL.crim3, PAL.fire3, PAL.gold3, PAL.leaf3, PAL.teal3, PAL.cyan3, PAL.water3, PAL.void3, PAL.mag3] as const;
const GLASS = [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2] as const;
const WYRM_RAMP = [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white] as const;

/** Live mouth point (per-frame table during 'attack'). */
function mouthOf(u: MonsterUnit): () => XY {
  return () => {
    const fi = u.frameInfo();
    // v3 art carries the mouth of every frame in points() (the v1 art has none: its table below)
    const pt = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame).muzzle : undefined;
    const m = pt ?? (MOUTH && fi.anim === 'attack' && MOUTH[fi.frame] ? MOUTH[fi.frame] : u.art.muzzle);
    return u.framePoint(m.x, m.y);
  };
}

// ================================================================ charge: floor glow + rising motes

function chargeFx(s: StrikeArgs, ms: number, mouth: () => XY): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const home = u.home;
  const floor = layer(sc, DEPTH.TILE_FX + 5, ADD);
  const motes = new Sparks(sc, u.sprite.depth + 0.4);
  const halo = glow(sc, home.x, home.y - 2, PAL.cyan3, 0.2, 0, DEPTH.TILE_FX + 4);
  halo.setScale(0.9 * TK, 0.4 * TK);
  // arena v2: the gathering light — a glow swelling in the jaws, the rune ring lighting the marble
  const jawLight = followLight(sc, mouth, { color: PAL.cyan4, radius: 18, floorY: home.y, air: 0.85, intensity: 0.15 });
  jawLight.setIntensity(1.35, ms);
  const ringLight = lightPool(sc, home.x, home.y, { color: PAL.cyan3, spill: PAL.cyan2, radius: 30 * TK, intensity: 0.1, anim: 'shimmer', fadeIn: 0 });
  ringLight.setIntensity(0.9, ms);
  return new Promise((resolve) => {
    onFrame(
      sc,
      (dt, el) => {
        const t = clamp(el / ms, 0, 1);
        floor.clear();
        if (t >= 1) return false;
        const k = E.outQ(t);
        // a rune ring of prism light on the floor, closing in
        const rx = (30 - 8 * k) * TK;
        const ry = rx * 0.45;
        floor.ellipseRing(home.x, home.y, rx, ry, 1, PAL.cyan2, 0.5 + 0.4 * k);
        for (let i = 0; i < 14; i++) {
          const a = el * 0.004 + (i / 14) * TAU;
          floor.dot(home.x + Math.cos(a) * rx, home.y + Math.sin(a) * ry, i % 3 === 0 ? PAL.white : RAINBOW[i % RAINBOW.length], 0.9);
        }
        floor.ellipse(home.x, home.y, rx * 0.55 * k, ry * 0.55 * k, PAL.cyan1, 0.5 * k);
        halo.setAlpha(0.55 * k).setScale((0.9 + 0.5 * k) * TK, (0.4 + 0.2 * k) * TK);
        // white-blue motes leave the floor and stream into the mouth
        if (dt > 0) {
          const m = mouth();
          const n = (dt / 16.7) * (1 + 2.5 * k);
          for (let i = 0; i < n; i++) {
            const a = RR(0, TAU);
            motes.add({ x: home.x + Math.cos(a) * rx, y: home.y + Math.sin(a) * ry, tx: m.x, ty: m.y, curl: RR(-14, 14), life: RR(220, 380), colors: [PAL.cyan3, PAL.cyan4, PAL.white], shape: R3() ? 'plus' : 'px', size: 1, fadeAt: 1 });
          }
        }
        return true;
      },
      () => {
        floor.g.destroy();
        motes.release();
        void animate(sc, 180, (t) => halo.setAlpha(0.55 * (1 - t))).then(() => halo.destroy());
        void jawLight.fadeOut(260);
        void ringLight.fadeOut(320);
        resolve();
      },
    );
  });
}

let r3 = 0;
onDuelStart(() => (r3 = 0));
function R3(): boolean {
  return ++r3 % 3 === 0;
}

// ================================================================ impact: crystal explosion

interface Crystal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  l: number;
  w: number;
  age: number;
  life: number;
  floor: number;
  c: number;
}

/** Crystal shards (faceted rhombi), a prism ring, light rays and a screen-wide glare. */
export function crystalBurst(scene: Phaser.Scene, at: XY, o: { dir?: XY; floor: number; power?: number; glare?: boolean; count?: number }): Promise<void> {
  const power = o.power ?? 3;
  const px = layer(scene, DEPTH.FX + 3);
  const rays = layer(scene, DEPTH.FX + 2, ADD);
  const dir = o.dir ? norm(o.dir) : { x: 0, y: -1 };
  const base = Math.atan2(dir.y, dir.x);
  const list: Crystal[] = [];
  const n = o.count ?? 10 + power * 5;
  for (let i = 0; i < n; i++) {
    const a = base + RR(-1.6, 1.6) + (i % 4 === 0 ? Math.PI : 0) * 0.6;
    const v = RR(70, 170 + power * 25);
    list.push({ x: at.x + RR(-3, 3), y: at.y + RR(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v - RR(40, 110), rot: RR(0, TAU), vr: RR(-14, 14), l: RR(3, 6.5), w: RR(1.4, 2.6), age: 0, life: RR(520, 900), floor: o.floor + RR(-4, 6), c: pick([PAL.cyan2, PAL.cyan3, PAL.cyan3, PAL.mist]) });
  }
  const sparkle = new Sparks(scene, DEPTH.FX + 3.5, ADD);
  for (let i = 0; i < 16; i++) {
    const a = RR(0, TAU);
    sparkle.add({ x: at.x, y: at.y, vx: Math.cos(a) * RR(20, 90), vy: Math.sin(a) * RR(20, 70) - 20, drag: 2.2, life: RR(400, 800), colors: [PAL.white, PAL.cyan4, pick(RAINBOW)], shape: i % 3 === 0 ? 'star' : 'plus', size: i % 3 === 0 ? 2 : 1, flicker: true });
  }
  sparkle.release();
  if (o.glare !== false) {
    void screenFlash(scene, PAL.cyan4, 0.24 + 0.05 * power, 200);
    void dimPulse(scene, -0.35 - 0.12 * power, { in: 40, hold: 50, out: 420 });
    void glowPulse(scene, at.x, at.y, PAL.white, { from: 0.8, to: 3.2, alpha: 0.9, ms: 320, depth: DEPTH.FX + 1 });
  }
  playSfx('shatter', { volume: 0.55, pitch: 1.9 });
  playSfx('holyChime', { volume: 0.35, pitch: 1.5 });
  const rayAngles = Array.from({ length: 9 }, (_, i) => (i / 9) * TAU + RR(-0.15, 0.15));
  return new Promise((resolve) => {
    onFrame(
      scene,
      (dt, el) => {
        const s = dt / 1000;
        px.clear();
        rays.clear();
        // light rays + prism ring (first 260 ms)
        if (el < 260 && o.glare !== false) {
          const t = el / 260;
          for (let i = 0; i < rayAngles.length; i++) {
            const a = rayAngles[i] + t * 0.25;
            const r0 = 6 + 10 * t;
            const r1 = 30 + 70 * E.outQ(t) * (i % 2 ? 0.7 : 1);
            rays.seg(at.x + Math.cos(a) * r0, at.y + Math.sin(a) * r0 * 0.8, at.x + Math.cos(a) * r1, at.y + Math.sin(a) * r1 * 0.8, i % 2 ? 1 : 2, i % 3 === 0 ? PAL.white : PAL.cyan3, 1 - t);
          }
        }
        if (el < 420) {
          const t = el / 420;
          const rr = 6 + 38 * E.outC(t);
          for (let k = 0; k < 36; k++) {
            const a = (k / 36) * TAU;
            px.dot(at.x + Math.cos(a) * rr, at.y + Math.sin(a) * rr * 0.75, RAINBOW[(k + Math.floor(el / 40)) % RAINBOW.length], 1 - t);
          }
          if (t < 0.4) px.ellipseRing(at.x, at.y, rr * 0.7, rr * 0.52, 1, PAL.white, 1 - t / 0.4);
        }
        let alive = 0;
        for (const c of list) {
          if (c.age >= c.life) continue;
          alive++;
          c.age += dt;
          c.vy += 520 * s;
          c.vx *= Math.exp(-1.1 * s);
          c.x += c.vx * s;
          c.y += c.vy * s;
          c.rot += c.vr * s;
          if (c.y > c.floor && c.vy > 0) {
            c.y = c.floor;
            c.vy *= -0.32;
            c.vx *= 0.55;
            c.vr *= 0.4;
          }
          const t = c.age / c.life;
          const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
          if (t > 0.8 && Math.floor(c.age / 45) % 2 === 0) continue;
          const ca = Math.cos(c.rot);
          const sa = Math.sin(c.rot);
          const tip = { x: c.x + ca * c.l, y: c.y + sa * c.l };
          const tail = { x: c.x - ca * c.l * 0.6, y: c.y - sa * c.l * 0.6 };
          const side1 = { x: c.x - sa * c.w, y: c.y + ca * c.w };
          const side2 = { x: c.x + sa * c.w, y: c.y - ca * c.w };
          const fresh = c.age < 70;
          px.poly([tip.x, tip.y, side1.x, side1.y, tail.x, tail.y, side2.x, side2.y], fresh ? PAL.white : c.c, a);
          px.poly([tip.x, tip.y, side1.x, side1.y, c.x, c.y], fresh ? PAL.white : PAL.cyan4, a);
          px.dot(tip.x, tip.y, PAL.white, a);
        }
        return alive > 0 || el < 420;
      },
      () => {
        px.g.destroy();
        rays.g.destroy();
        resolve();
      },
    );
  });
}

/** Blocked beam: the prism splinters off the shield into rainbow ricochets. */
function prismScatter(scene: Phaser.Scene, at: XY, from: XY): void {
  const px = layer(scene, DEPTH.FX + 2, ADD);
  const back = norm(sub(from, at));
  const rays = Array.from({ length: 5 }, (_, i) => {
    const a = Math.atan2(back.y, back.x) + (i - 2) * 0.55 + RR(-0.15, 0.15) + (i % 2 ? Math.PI * 0.5 : -Math.PI * 0.5) * 0.6;
    return { a, l: RR(28, 52), c: RAINBOW[(i * 2) % RAINBOW.length] };
  });
  void animate(scene, 260, (t) => {
    px.clear();
    for (const r of rays) {
      const head = r.l * E.outQ(Math.min(1, t * 1.8));
      const tail = r.l * E.inQ(Math.max(0, (t - 0.3) / 0.7));
      const x0 = at.x + Math.cos(r.a) * tail;
      const y0 = at.y + Math.sin(r.a) * tail;
      const x1 = at.x + Math.cos(r.a) * head;
      const y1 = at.y + Math.sin(r.a) * head;
      px.seg(x0, y0, x1, y1, 2, r.c, 1 - t * 0.5);
      px.line(x0, y0, x1, y1, PAL.white, 1 - t);
    }
  }).then(() => px.g.destroy());
}

// ================================================================ v3 (?look=v3): the breath on the art's own frames
//
// The v3 art (src/art/monsters-v3/crystal_wyrm.ts) carries the motion; the strike only adds the
// light and keeps the beat on its marks:
//   charge   the declaration left the wyrm on its 'charge' frame; the attack plays on from the
//            next frame with the art's holds (the weight sinks back, the neck coils into an S).
//            Light gathers between the lips (a small stepped orb ON the per-frame mouth point),
//            motes stream into the jaws, a prism glyph closes on the floor;
//   release  the jaws are flung open: the beam leaves the MOUTH (points().muzzle of every frame)
//            along the open jaws (the first ~9 px follow the mouth's own axis, head → muzzle,
//            clamped into the opening between the jaws) and only then bends onto the target, so a
//            target far below / above the level head still reads as breathed out of the mouth;
//            its head reaches the target within the release frame (stepped);
//   contact  the 'contact' frame: the beam lands on the target's SURFACE (the first silhouette
//            pixel from the mouth's side, not its core) and s.impact() there (number, reaction,
//            hit-stop); crystal shards splash back OUT of the struck face, away from the body,
//            and a short prism arc flashes on the outside (≤150 ms) — or the prism splinters off
//            a shield;
//   sustain  the beam is spent at once: full width on the hit (held through the hit-stop), then
//            stepped thinner every ~2 frames to a 2 px thread by ~100 ms, so the victim's recoil
//            and the hand-over to its death read; the thread follows the mouth as the head is
//            pushed back and fades out through a 1 px glint as the jaws begin to close (the frame
//            before 'recover').
// The strike resolves as the beam becomes the thread (the anim plays on to idle by itself; the
// thread runs on its own clock). Crisp palette pixels only (tapered ribbon, white core, the
// prism's spectral fringe, energy dashes); no sprite scaling or tweening (the pose is the motion),
// no full-screen flash or dim: the light is local (stepped light layer). When the attacker loses
// the clash the beam is cut on contact and the strike resolves at once (_v3/clash: the handler
// takes it from the contact pose).

const PRISM_WARM = [PAL.crim3, PAL.fire3, PAL.gold4] as const;
const PRISM_COOL = [PAL.leaf3, PAL.cyan3, PAL.void3] as const;

const snapXY = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** The mouth's own axis (head → muzzle of the frame shown, world space), or null without points. */
function jawOf(u: MonsterUnit): XY | null {
  if (!u.sprite.active) return null;
  const fi = u.frameInfo();
  const P = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame) : undefined;
  if (!P?.muzzle || !P.head) return null;
  const d = sub(u.framePoint(P.muzzle.x, P.muzzle.y), u.framePoint(P.head.x, P.head.y));
  return len(d) < 2 ? null : norm(d);
}

/**
 * Where a line from the core toward `from` leaves the unit's silhouette (the struck face), on the
 * frame it shows now; null when it cannot be read (gone / hidden / no opaque pixel on the way).
 */
function surfaceOf(t: MonsterUnit | null | undefined, core: XY, from: XY): XY | null {
  if (!t || t.retired || !t.sprite.active || !t.sprite.visible) return null;
  const spr = t.sprite;
  const pc = currentPixels(t).pc;
  const m = spr.getWorldTransformMatrix();
  const w = spr.frame.realWidth;
  const d = norm(sub(from, core));
  let last: XY | null = null;
  let gap = 0;
  for (let i = 0; i < 52; i++) {
    const x = core.x + d.x * i;
    const y = core.y + d.y * i;
    const q = m.applyInverse(x, y);
    const lx = q.x + spr.displayOriginX;
    const fx = Math.floor(spr.flipX ? w - lx : lx);
    const fy = Math.floor(q.y + spr.displayOriginY);
    if (pc.isOpaque(fx, fy)) {
      last = { x, y };
      gap = 0;
    } else if (last && ++gap > 2) break;
  }
  return last ? snapXY(last) : null;
}

const rot = (v: XY, a: number): XY => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const DEG = Math.PI / 180;
/**
 * How far the beam may leave the mouth's axis and still come out between the jaws (facing-
 * normalised, + = toward the lower jaw). Above, the upper jaw is level and the muzzle sits at the
 * tip of the snout: a rising beam clears it (a target up the board stays a straight beam). Below,
 * the lower jaw hangs open under the muzzle: a beam steeper than the jaw would cross it.
 */
const MOUTH_UP = 50 * DEG;
const MOUTH_DOWN = 9 * DEG;
/** The straight lead along the jaws before the beam bends onto its target (px). */
const JAW_LEAD = 9;

/** A beam's centre line: points every ~3 px with their arc length. */
interface BeamPath {
  pts: XY[];
  cum: number[];
  len: number;
}

function pathOf(pts: XY[]): BeamPath {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, len: cum[cum.length - 1] };
}

/** Point + unit tangent at arc length s. */
function pathAt(p: BeamPath, s: number): { q: XY; d: XY } {
  const n = p.pts.length;
  let i = 1;
  while (i < n - 1 && p.cum[i] < s) i++;
  const a = p.pts[i - 1];
  const b = p.pts[i];
  const segL = p.cum[i] - p.cum[i - 1] || 1;
  const t = clamp((s - p.cum[i - 1]) / segL, 0, 1);
  return { q: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, d: norm(sub(b, a)) };
}

/**
 * The beam's centre line from the mouth A to the struck point B. Straight when the target lies
 * within the mouth's opening; otherwise a ~9 px lead along the open jaws (the mouth's axis turned
 * as far toward the target as the jaws allow), then a smooth bend (quadratic) onto B.
 */
function beamPath(A: XY, B: XY, jaw: XY | null, facing: number): BeamPath {
  const dist = len(sub(B, A));
  const direct = norm(sub(B, A));
  let t0 = direct;
  if (jaw && dist > JAW_LEAD + 12) {
    let dl = Math.atan2(direct.y, direct.x) - Math.atan2(jaw.y, jaw.x);
    while (dl > Math.PI) dl -= TAU;
    while (dl < -Math.PI) dl += TAU;
    const dn = dl * facing;
    const d0 = clamp(dn, -MOUTH_UP, MOUTH_DOWN);
    if (Math.abs(dn - d0) > 2 * DEG) t0 = rot(jaw, d0 * facing);
  }
  const raw: XY[] = [A];
  if (t0 === direct) raw.push(B);
  else {
    const K1 = { x: A.x + t0.x * JAW_LEAD, y: A.y + t0.y * JAW_LEAD };
    const rest = len(sub(B, K1));
    const c = clamp(rest * 0.32, 6, 18);
    const K2 = { x: K1.x + t0.x * c, y: K1.y + t0.y * c };
    raw.push(K1);
    const steps = Math.max(4, Math.ceil(rest / 3));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      raw.push({ x: u * u * K1.x + 2 * u * t * K2.x + t * t * B.x, y: u * u * K1.y + 2 * u * t * K2.y + t * t * B.y });
    }
  }
  // resample every 3 px (the ribbon's vertices; the taper and fringe read arc length off it)
  const src = pathOf(raw);
  const pts: XY[] = [];
  for (let s = 0; s < src.len; s += 3) pts.push(pathAt(src, s).q);
  pts.push(B);
  return pathOf(pts);
}

/** Beam cross-sections, outside → in: [width px, colour]. The full beam lives only on the hit. */
const BEAM_FULL: [number, number][] = [[13, PAL.cyan1], [11, PAL.cyan2], [9, PAL.cyan3], [7, PAL.cyan4], [5, PAL.white]];
const BEAM_9: [number, number][] = [[9, PAL.cyan1], [7, PAL.cyan2], [5, PAL.cyan3], [3, PAL.cyan4], [1, PAL.white]];
const BEAM_5: [number, number][] = [[5, PAL.cyan2], [3, PAL.cyan4], [1, PAL.white]];
const BEAM_THREAD: [number, number][] = [[2, PAL.cyan3], [1, PAL.white]];
const BEAM_GLINT: [number, number][] = [[1, PAL.cyan4]];

interface BeamState {
  /** Live origin (the mouth; frozen once the attack anim is gone). */
  from: XY;
  /** The struck point (the target's surface; re-read every frame). */
  to: XY;
  /** The centre line (rebuilt every frame from the mouth, the jaw axis and the struck point). */
  path: BeamPath | null;
  /** Cross-section (null = no beam). */
  sec: [number, number][] | null;
  /** 0…1 how far the head has travelled. */
  ext: number;
  /** ms since the release (flow / fringe scroll). */
  t: number;
}

/** One layer of the ribbon: the centre line offset both ways (averaged normals), tapered at the mouth. */
function ribbon(px: Px, p: BeamPath, L: number, half: number, c: number): void {
  const taper = Math.min(10, L);
  const h0 = Math.max(0.5, half * 0.4);
  const hAt = (s: number) => (s < taper ? lerp(h0, half, s / taper) : half);
  const left: number[] = [];
  const right: number[] = [];
  const put = (q: XY, nrm: XY, h: number) => {
    left.push(q.x + nrm.x * h, q.y + nrm.y * h);
    right.push(q.x - nrm.x * h, q.y - nrm.y * h);
  };
  const n = p.pts.length;
  for (let i = 0; i < n && p.cum[i] < L; i++) {
    const a = p.pts[Math.max(0, i - 1)];
    const b = p.pts[Math.min(n - 1, i + 1)];
    const d = norm(sub(b, a));
    put(p.pts[i], { x: -d.y, y: d.x }, hAt(p.cum[i]));
  }
  const end = pathAt(p, L);
  put(end.q, { x: -end.d.y, y: end.d.x }, hAt(L));
  const pts = left;
  for (let i = right.length - 2; i >= 0; i -= 2) pts.push(right[i], right[i + 1]);
  px.poly(pts, c);
}

/** The prism beam: a tapered ribbon along its path, layered cyan → white, spectral fringe, flowing dashes. */
function drawPrismBeam(px: Px, b: BeamState, frame: number): void {
  const p = b.path;
  if (!p || !b.sec) return;
  const L = p.len * b.ext;
  if (L < 2) return;
  const W = b.sec[0][0];
  for (const [ww, c] of b.sec) {
    if (ww <= 1) {
      // a 1 px core: the centre line itself (Bresenham through the path's vertices)
      for (let i = 1; i < p.pts.length && p.cum[i - 1] < L; i++) {
        const q = p.cum[i] <= L ? p.pts[i] : pathAt(p, L).q;
        px.line(p.pts[i - 1].x, p.pts[i - 1].y, q.x, q.y, c);
      }
      continue;
    }
    ribbon(px, p, L, ww / 2, c);
    if (b.ext >= 1 && ww >= 3) {
      const e = pathAt(p, L).q;
      px.disc(e.x, e.y, ww / 2, c);
    }
  }
  const taper = Math.min(10, L);
  // the spectral fringe: warm on one side, cool on the other, scrolling slowly away from the mouth
  if (W >= 9) {
    const off = (W - 4) / 2 + 3;
    for (let s = taper; s < L; s++) {
      const band = Math.floor((s - b.t * 0.06) / 3);
      if ((Math.floor(s) + frame) % 13 === 0) continue;
      const i = ((band % 3) + 3) % 3;
      const { q, d } = pathAt(p, s);
      px.dot(q.x - d.y * off, q.y + d.x * off, PRISM_WARM[i]);
      px.dot(q.x + d.y * off, q.y - d.x * off, PRISM_COOL[i]);
    }
  }
  // energy dashes racing along the bright band
  if (W >= 9) {
    const lane = Math.max(1, (W - 4) / 2 - 2);
    for (let s = 6; s < L - 2; s++) {
      const m = (((s - b.t * 0.3) % 14) + 14) % 14;
      const m2 = (((s - b.t * 0.3 + 7) % 14) + 14) % 14;
      if (m >= 3 && m2 >= 3) continue;
      const { q, d } = pathAt(p, s);
      if (m < 3) px.dot(q.x - d.y * lane, q.y + d.x * lane, PAL.white);
      if (m2 < 3) px.dot(q.x + d.y * lane, q.y - d.x * lane, PAL.white);
    }
  }
  // the travelling head: a white star until it lands
  if (b.ext < 1) {
    const e = pathAt(p, L).q;
    px.star(e.x, e.y, W - 2, 1.5, PAL.white);
  }
}

/** Prism glyph on the floor under the wyrm while it charges (closes in, rainbow ticks turning). */
function drawGlyph(px: Px, home: XY, k: number, el: number): void {
  const rx = Math.round((26 - 7 * k) * TK);
  const ry = Math.max(2, Math.round(rx * 0.45));
  px.ellipseRing(home.x, home.y, rx, ry, 1, k > 0.6 ? PAL.cyan3 : PAL.cyan2);
  const ticks = 12;
  for (let i = 0; i < ticks; i++) {
    const a = el * 0.003 + (i / ticks) * TAU;
    const c = i % 3 === 0 ? PAL.white : RAINBOW[(i * 2) % RAINBOW.length];
    px.dot(Math.round(home.x + Math.cos(a) * rx), Math.round(home.y + Math.sin(a) * ry), c);
  }
  if (k > 0.5) px.ellipseRing(home.x, home.y, Math.round(rx * 0.55), Math.max(1, Math.round(ry * 0.55)), 1, PAL.cyan2);
}

/** v3 blocked beam: the prism splinters off the shield into rainbow ricochets (crisp, stepped). */
function prismSplinter(scene: Phaser.Scene, at: XY, from: XY): void {
  const px = layer(scene, DEPTH.FX + 2);
  const back = norm(sub(from, at));
  const base = Math.atan2(back.y, back.x);
  const rays = Array.from({ length: 5 }, (_, i) => ({ a: base + (i - 2) * 0.62 + RR(-0.12, 0.12), l: RR(22, 40), c: RAINBOW[(i * 2 + 1) % RAINBOW.length] }));
  void animate(scene, 240, (t) => {
    px.clear();
    const step = Math.min(3, Math.floor(t * 4));
    for (const r of rays) {
      const head = r.l * Math.min(1, (step + 1) / 2);
      const tail = step >= 2 ? r.l * (step - 1) * 0.4 : 0;
      const x0 = at.x + Math.cos(r.a) * tail;
      const y0 = at.y + Math.sin(r.a) * tail;
      const x1 = at.x + Math.cos(r.a) * head;
      const y1 = at.y + Math.sin(r.a) * head;
      px.seg(x0, y0, x1, y1, step < 2 ? 2 : 1, r.c);
      if (step < 2) px.line(x0, y0, x1, y1, PAL.white);
    }
  }).then(() => px.g.destroy());
}

/**
 * v3 contact on a body: crystal shards splash back OUT of the struck face (a cone around `out`,
 * the side the beam came from, kicked up, falling to the floor and bouncing) — away from the body,
 * never across it — with a few sparks and a short prism arc on the outside of the face (≤150 ms,
 * stepped). The victim's silhouette stays readable for its recoil and its death.
 */
function crystalSplash(scene: Phaser.Scene, at: XY, out: XY, o: { floor: number; count: number }): void {
  const px = layer(scene, DEPTH.FX + 3);
  const o0 = norm(out);
  const base = Math.atan2(o0.y, o0.x);
  const list: Crystal[] = [];
  for (let i = 0; i < o.count; i++) {
    const a = base + RR(-1.25, 1.25);
    const v = RR(55, 135);
    list.push({ x: at.x + o0.x * 2, y: at.y + o0.y * 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - RR(40, 95), rot: RR(0, TAU), vr: RR(-12, 12), l: RR(2.2, 4.2), w: RR(1.1, 1.8), age: 0, life: RR(300, 520), floor: o.floor + RR(-3, 5), c: pick([PAL.cyan2, PAL.cyan3, PAL.cyan3, PAL.mist]) });
  }
  const sparks = new Sparks(scene, DEPTH.FX + 3.5);
  for (let i = 0; i < 6; i++) {
    const a = base + RR(-1.1, 1.1);
    sparks.add({ x: at.x + o0.x * 2, y: at.y + o0.y * 2, vx: Math.cos(a) * RR(40, 90), vy: Math.sin(a) * RR(30, 70) - 15, drag: 3, life: RR(160, 300), colors: [PAL.white, PAL.cyan4, pick(RAINBOW)], shape: i % 3 === 0 ? 'plus' : 'px', size: 1, flicker: true });
  }
  sparks.release();
  playSfx('shatter', { volume: 0.5, pitch: 1.9 });
  playSfx('holyChime', { volume: 0.32, pitch: 1.5 });
  onFrame(
    scene,
    (dt, el) => {
      const s = dt / 1000;
      px.clear();
      // the prism arc: on the outside of the struck face only, two steps out, gone by 150 ms
      if (el < 150) {
        const st = Math.min(2, Math.floor(el / 50));
        const rr = 5 + st * 4;
        for (let k = 0; k < 24; k++) {
          const a = base + (k / 24 - 0.5) * Math.PI * 1.15;
          px.dot(Math.round(at.x + Math.cos(a) * rr), Math.round(at.y + Math.sin(a) * rr * 0.75), st === 0 && k % 3 === 0 ? PAL.white : RAINBOW[(k + st * 3) % RAINBOW.length]);
        }
      }
      let alive = 0;
      for (const c of list) {
        if (c.age >= c.life) continue;
        alive++;
        c.age += dt;
        c.vy += 460 * s;
        c.vx *= Math.exp(-1.2 * s);
        c.x += c.vx * s;
        c.y += c.vy * s;
        c.rot += c.vr * s;
        if (c.y > c.floor && c.vy > 0) {
          c.y = c.floor;
          c.vy *= -0.3;
          c.vx *= 0.5;
          c.vr *= 0.4;
        }
        const t = c.age / c.life;
        if (t > 0.75 && Math.floor(c.age / 45) % 2 === 0) continue;
        const ca = Math.cos(c.rot);
        const sa = Math.sin(c.rot);
        const tip = { x: c.x + ca * c.l, y: c.y + sa * c.l };
        const tail = { x: c.x - ca * c.l * 0.6, y: c.y - sa * c.l * 0.6 };
        const fresh = c.age < 50;
        px.poly([tip.x, tip.y, c.x - sa * c.w, c.y + ca * c.w, tail.x, tail.y, c.x + sa * c.w, c.y - ca * c.w], fresh ? PAL.white : c.c);
        px.dot(tip.x, tip.y, fresh ? PAL.white : PAL.cyan4);
      }
      return alive > 0 || el < 150;
    },
    () => px.g.destroy(),
  );
}

async function prismBreathV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 97 + (s.target?.uid ?? 3));
  const mouth = mouthOf(u);
  const n = u.frameCount('attack');
  const relF = u.markFrame('attack', 'release', u.impactFrame);
  const conF = Math.max(relF + 1, u.markFrame('attack', 'contact', relF + 1));
  const recF = Math.max(conF + 1, Math.min(n - 1, u.markFrame('attack', 'recover', conF + 4)));
  // the strike hands the battle back once the beam is the thread (2 frames after contact); the
  // thread is gone as the jaws begin to close (the frame before 'recover')
  const thinF = Math.min(recF, conF + 2);
  const endF = recF - 1 > thinF ? recF - 1 : recF;
  const facing = u.flipX ? -1 : 1;
  // continue from the declaration's held charge pose (it has been shown): the next frame on
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const firstCharge = f0;
  const from0 = mouth();
  const aimDir = norm(sub(s.to, from0));
  // blocked: the beam stops on the shield plane in front of the target
  const aim: XY = snapXY(s.blocked ? { x: s.to.x - aimDir.x * 9, y: s.to.y - aimDir.y * 9 } : s.to);
  const target = s.blocked || s.direct ? null : s.target;
  /** The struck point now: the face of the target toward the mouth (else where it was last, else the aim point). */
  let face: XY | null = null;
  const struck = (m: XY): XY => {
    const p = target && target.sprite.active ? surfaceOf(target, target.core(), m) : null;
    if (p) face = p;
    return face ?? aim;
  };
  const loses = s.ctx.ev.result === 'attackerDestroyed' || s.ctx.ev.result === 'bothDestroyed';
  const home = u.home;
  const floorTo = s.target ? s.target.home : s.toGround;

  playSfx('beamCharge', { volume: 0.8 });
  const play = u.playRange('attack', f0);

  // ---- one layer, one clock: glyph + motes + orb (charge), beam (release → recover)
  const floor = layer(sc, DEPTH.TILE_FX + 5);
  const fxl = layer(sc, DEPTH.FX);
  const jaw = followLight(sc, () => (u.sprite.active ? mouth() : null), { color: PAL.cyan4, radius: 16, floorY: home.y, air: 0.8, intensity: 0.2 });
  jaw.setIntensity(1.2, Math.max(120, u.rangeMs('attack', f0, relF)));
  let jawGone = false;
  const fadeJaw = () => {
    if (jawGone) return;
    jawGone = true;
    void jaw.fadeOut(140);
  };
  const pool = lightPool(sc, home.x, home.y, { color: PAL.cyan3, radius: 28 * TK, intensity: 0.15, anim: 'shimmer', fadeIn: 0 });
  pool.setIntensity(0.8, 300);
  interface Mote { a: number; r: number; age: number; life: number; c: number }
  const motes: Mote[] = [];
  const beamSt: BeamState = { from: snapXY(from0), to: aim, path: null, sec: null, ext: 0, t: 0 };
  let lastJaw: XY | null = null;
  let released = false;
  let cut = false;
  let cutK = 0;
  let relAt = 0;
  let conAt = -1;
  let dimmed = false;
  let beamLight: ReturnType<typeof lightBeam> | null = null;
  let frameNo = 0;
  let acc = 0;
  let stopped = false;
  onFrame(sc, (dt, el) => {
    if (stopped) return false;
    if (dt > 0) frameNo++;
    const fi = u.frameInfo();
    const onAttack = u.sprite.active && fi.anim === 'attack';
    const f = onAttack ? fi.frame : released ? recF : firstCharge;
    floor.clear();
    fxl.clear();
    if (el > 5000) return false; // safety: never outlive a stuck strike
    // ---------------------------------------------------------------- charge
    if (!released) {
      // the attack was cut before the jaws opened (or never shows): nothing to fire
      if (cut || (!onAttack && el > 120)) return false;
      const k = clamp((f - firstCharge + 1) / Math.max(1, relF - firstCharge), 0, 1);
      drawGlyph(floor, home, k, el);
      const m = snapXY(mouth());
      // motes drawn into the jaws, attached to the moving mouth
      acc += dt * (0.05 + 0.1 * k);
      while (acc >= 1) {
        acc -= 1;
        motes.push({ a: RR(0, TAU), r: RR(9, 18), age: 0, life: RR(140, 240), c: pick([PAL.cyan3, PAL.cyan4, PAL.white]) });
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const q = motes[i];
        q.age += dt;
        const t = q.age / q.life;
        if (t >= 1) {
          motes.splice(i, 1);
          continue;
        }
        const r = q.r * (1 - t * t);
        const x = Math.round(m.x + Math.cos(q.a) * r);
        const y = Math.round(m.y + Math.sin(q.a) * r * 0.8);
        fxl.dot(x, y, t > 0.6 ? PAL.white : q.c);
        if (r > 4) fxl.dot(Math.round(x + Math.cos(q.a) * 2), Math.round(y + Math.sin(q.a) * 1.6), PAL.cyan2);
      }
      // the light between the lips: a stepped orb (1 → 3 px), trembling on the last charge frame
      const r = 1 + Math.round(2 * k);
      fxl.disc(m.x, m.y, r + 1, PAL.cyan3).disc(m.x, m.y, r, PAL.cyan4).disc(m.x, m.y, Math.max(0.6, r - 1), PAL.white);
      if (k >= 1) fxl.star(m.x, m.y, 4 + (Math.floor(el / 50) % 2), 1, PAL.white);
      if (onAttack && f >= relF) {
        released = true;
        relAt = el;
        motes.length = 0;
      } else return true;
    }
    // ---------------------------------------------------------------- the beam
    const sinceRel = el - relAt;
    beamSt.t = sinceRel;
    if (onAttack) {
      beamSt.from = snapXY(mouth());
      lastJaw = jawOf(u) ?? lastJaw;
    }
    if (cut) {
      // the beam is cut (the attacker lost the clash / left its attack): it collapses into the mouth
      cutK += dt / 90;
      const sec = beamSt.sec;
      if (cutK >= 1 || !sec) return false;
      beamSt.sec = sec === BEAM_FULL ? BEAM_9 : sec === BEAM_9 ? BEAM_5 : sec === BEAM_5 ? BEAM_THREAD : sec === BEAM_THREAD ? BEAM_GLINT : null;
      if (!beamSt.sec) return false;
    } else if (!onAttack || f >= endF) {
      cut = true;
    } else if (f === relF) {
      beamSt.sec = BEAM_9;
      beamSt.ext = Math.min(1, (Math.floor((sinceRel / Math.max(17, u.frameMs('attack', relF))) * 4) + 1) / 4);
    } else {
      beamSt.ext = 1;
      if (conAt < 0) conAt = el;
      // spent at once: full on the hit (held through the hit-stop), then a step thinner every
      // ~2 frames down to the thread (it fades out through a 1 px glint as the jaws close: cut)
      const k = el - conAt;
      beamSt.sec = k < 34 ? BEAM_FULL : k < 67 ? BEAM_9 : k < 100 ? BEAM_5 : BEAM_THREAD;
      if (k >= 67 && !dimmed) {
        dimmed = true;
        beamLight?.setIntensity(0.3, 80);
      }
    }
    if (!beamSt.sec) return !cut;
    // the struck face, read off the target's current frame (it recoils, then dies)
    beamSt.to = struck(beamSt.from);
    beamSt.path = beamPath(beamSt.from, beamSt.to, lastJaw, facing);
    drawPrismBeam(fxl, beamSt, frameNo);
    // the muzzle flare (small: the jaws stay readable) and, on the hit only, the impact flare
    const A = beamSt.from;
    const W = beamSt.sec[0][0];
    if (W >= 9) {
      const tw = Math.floor(frameNo / 3) % 2 === 0 ? 0 : Math.PI / 4;
      fxl.star(A.x, A.y, W * 0.45 + 2, 1.2, PAL.white, 1, tw);
      fxl.disc(A.x, A.y, 2.5, PAL.cyan4).disc(A.x, A.y, 1.5, PAL.white);
    } else fxl.dot(A.x, A.y, PAL.white);
    if (beamSt.ext >= 1) {
      const B = beamSt.to;
      if (W >= 13) {
        const tw = Math.floor(sinceRel / 50) % 2 === 0 ? 0 : Math.PI / 4;
        fxl.star(B.x, B.y, 5, 1.2, PAL.white, 1, tw);
        fxl.disc(B.x, B.y, 3, PAL.cyan3).disc(B.x, B.y, 2, PAL.cyan4).disc(B.x, B.y, 1, PAL.white);
      } else if (W >= 9) fxl.disc(B.x, B.y, 2, PAL.cyan4).disc(B.x, B.y, 1, PAL.white);
      else if (W >= 2) fxl.dot(B.x, B.y, Math.floor(frameNo / 2) % 2 ? PAL.white : PAL.cyan4);
    }
    beamLight?.setEnds(A, beamSt.to);
    return true;
  }, () => {
    stopped = true;
    floor.g.destroy();
    fxl.g.destroy();
    fadeJaw();
    void pool.fadeOut(240);
    if (beamLight) void beamLight.fadeOut(140);
    // residue: a few sparkles left hanging along the line
    const sp = new Sparks(sc, DEPTH.FX + 0.5);
    const path = beamSt.path;
    if (path) {
      for (let i = 0; i < 7; i++) {
        const q = pathAt(path, path.len * RR(0.15, 0.95)).q;
        sp.add({ x: Math.round(q.x), y: Math.round(q.y), vx: RR(-6, 6), vy: RR(-16, -4), life: RR(200, 380), colors: [PAL.white, PAL.cyan4, PAL.cyan3], shape: 'px', flicker: true, fadeAt: 1 });
      }
    }
    sp.release();
  });
  const finish = () => {
    if (!stopped) cut = true;
  };

  try {
    // ---- release: the jaws are flung open, the beam leaves the mouth
    await u.playToFrame('attack', relF);
    if (!u.sprite.active || u.frameInfo().anim !== 'attack') return finish();
    playSfx('beamFire', { volume: 0.9 });
    playSfx('roarBig', { volume: 0.35, pitch: 1.3 });
    void shake(sc, 90, 1);
    beamLight = lightBeam(sc, mouth(), aim, PAL.cyan4, 0, { width: 13, intensity: 1.2, floor: { from: home, to: floorTo }, floorWidth: 12, shimmer: 0.3 });
    fadeJaw();
    // ---- contact: the beam lands on the 'contact' frame, on the target's face
    await u.playToFrame('attack', conF);
    const hit = struck(snapXY(mouth()));
    beamSt.to = hit;
    s.impact(hit);
    const floorY = floorTo.y;
    // the shards leave the face back along the beam's last stretch (toward the open side)
    const out = beamSt.path && beamSt.path.pts.length > 1 ? sub(beamSt.path.pts[beamSt.path.pts.length - 2], hit) : sub(from0, hit);
    if (s.blocked) {
      prismSplinter(sc, hit, from0);
      crystalSplash(sc, hit, out, { floor: floorY, count: 5 });
    } else crystalSplash(sc, hit, out, { floor: floorY, count: 6 + s.power * 2 });
    if (loses) {
      // the stronger side answers on this frame: the beam is cut, the handler owns the attacker now
      finish();
      await sleep(sc, 34);
      return;
    }
    // ---- the beam is spent: resolve as it becomes the thread (it and the anim play on by themselves)
    await Promise.race([u.playToFrame('attack', thinF), play]);
  } catch (e) {
    finish();
    throw e;
  }
  // the attack left the screen early (a handler took the sprite): the beam goes with it
  if (!u.sprite.active || u.frameInfo().anim !== 'attack') finish();
}

// ================================================================ strike

/** The v1 / v2 strike (the old look; unchanged). */
async function strikeV1(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 97 + (s.target?.uid ?? 3));
  const mouth = mouthOf(u);
  const charge = u.impactMs; // 500 ms: frames 0–4, the jaw opens on frame 5
  const spr = u.sprite;
  const sgn = u.flipX ? -1 : 1;
  const rest = { x: spr.x, y: spr.y };
  const from = mouth();
  const aimDir = norm(sub(s.to, from));
  // blocked: the beam stops on the shield plane in front of the target
  const to: XY = s.blocked ? { x: s.to.x - aimDir.x * 9, y: s.to.y - aimDir.y * 9 } : s.to;
  void u.play('attack');
  // camera: hold on the dragon's head while it gathers light
  const head = from;
  void s.ctx.focus({ x: lerp(head.x, to.x, 0.3), y: lerp(head.y, to.y, 0.3) - 6 }, { zoom: 1.06, ms: 320, pan: 0.32 });
  void chargeFx(s, charge, mouth);
  // rear back (stretch) during the charge
  void animate(sc, charge, (t) => {
    if (!spr.active) return;
    const k = E.outQ(t);
    spr.setPosition(Math.round(rest.x - sgn * 2 * k), Math.round(rest.y - 1 * k));
    spr.setScale(1 - 0.02 * k, 1 + 0.04 * k);
  });
  await beam(sc, mouth, to, 'prism', {
    chargeMs: charge,
    width: 13,
    fireMs: s.blocked ? 320 : 460,
    onFire: () => {
      playSfx('roarBig', { volume: 0.35, pitch: 1.3 });
      // arena v2: the prism beam casts a bright line of light across the board and its floor
      const floorTo = s.target ? s.target.home : s.toGround;
      void lightBeam(sc, mouth(), to, PAL.cyan4, (s.blocked ? 320 : 460) + 90, { width: 15, intensity: 1.45, floor: { from: u.home, to: floorTo }, floorWidth: 14, shimmer: 0.35 });
      // recoil: the whole body kicks back, squashes
      void animate(sc, 360, (t) => {
        if (!spr.active) return;
        const k = t < 0.15 ? t / 0.15 : 1 - E.inOutQ((t - 0.15) / 0.85);
        spr.setPosition(Math.round(rest.x - sgn * (2 + 3 * k)), Math.round(rest.y - 1 + k));
        spr.setScale(1 + 0.05 * k, 1 - 0.04 * k + 0.04 * (1 - k));
      });
      void s.ctx.focus({ x: lerp(head.x, to.x, 0.6), y: lerp(head.y, to.y, 0.6) }, { zoom: 1.08, ms: 140, pan: 0.36 });
    },
    onImpact: () => {
      s.impact(to);
      const floorY = s.target ? s.target.home.y : s.toGround.y;
      if (s.blocked) {
        prismScatter(sc, to, from);
        void crystalBurst(sc, to, { dir: { x: -aimDir.x, y: -aimDir.y }, floor: floorY, power: 1, glare: false, count: 6 });
      } else {
        void crystalBurst(sc, to, { dir: aimDir, floor: floorY, power: s.power });
      }
    },
  });
  if (spr.active) {
    spr.setPosition(rest.x, rest.y).setScale(1);
    if (u.frameInfo().anim !== 'attack') u.rest();
  }
}

registerStrike('crystal_wyrm', (s) => (LOOK_V3 ? prismBreathV3(s) : strikeV1(s)));

// ================================================================ death: the crystals crack

/** Crack paths through the opaque pixels of a frame, branching out from `start`. */
function crackPaths(pc: PixelCanvas, start: XY, n: number, rnd: () => number): XY[][] {
  const paths: XY[][] = [];
  const queue: { p: XY; a: number; life: number }[] = [];
  for (let k = 0; k < n; k++) queue.push({ p: { ...start }, a: (k / n) * TAU + (rnd() - 0.5) * 0.6, life: 30 + rnd() * 22 });
  let guard = 0;
  while (queue.length && guard++ < 40) {
    const q = queue.shift()!;
    const path: XY[] = [];
    let { x, y } = q.p;
    let a = q.a;
    for (let i = 0; i < q.life; i++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 1.1;
      y += Math.sin(a) * 1.1;
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (!pc.isOpaque(rx, ry)) break;
      const last = path[path.length - 1];
      if (!last || last.x !== rx || last.y !== ry) path.push({ x: rx, y: ry });
      if (i > 4 && rnd() < 0.07 && queue.length < 20) queue.push({ p: { x: rx, y: ry }, a: a + (rnd() < 0.5 ? 0.9 : -0.9), life: q.life * 0.5 });
    }
    if (path.length > 2) paths.push(path);
  }
  return paths;
}

/**
 * v3: the wyrm dies on its own `death` pose through the shared death kit (_v3/death.ts: the
 * crystal preset — cracks and the light draining are in the pose, crystal glints and the floor
 * light are the kit's accent, the cold body breaks as crystal). Its flavour on top: the moment
 * the body breaks, glass shards and a prism ring burst from where its core lies (the light that
 * was left in it scatters once, then is gone). A watcher only: the kit owns the body and the card.
 */
function crystalBreakV3(ctx: Ctx<'destroy'>): void {
  const u = ctx.unit(ctx.ev.uid);
  if (!u || u.retired || !u.has('death') || !u.sprite.active || !u.sprite.visible) return;
  const sc = ctx.scene;
  const push = ctx.hints.push as XY | undefined;
  const floorY = u.home.y;
  let seen = false;
  let at: XY = u.core();
  onFrame(sc, (_dt, el) => {
    if (el > 4000) return false;
    const fi = u.frameInfo();
    if (u.sprite.active && u.sprite.visible && fi.anim === 'death') {
      seen = true;
      const c = u.art.points?.('death', fi.frame).core;
      if (c) at = u.framePoint(c.x, c.y);
      return true;
    }
    if (!seen) return true;
    // the body broke (the kit hides the sprite on the burst frame)
    seed(u.uid * 53 + 9);
    void crystalBurst(sc, { x: Math.round(at.x), y: Math.round(at.y) }, { dir: push ?? { x: u.player === 0 ? -1 : 1, y: -0.4 }, floor: floorY, power: 2, glare: false, count: 16 });
    return false;
  });
}

registerCardHook('crystal_wyrm', 'destroyed', (ctx) => {
  if (LOOK_V3) crystalBreakV3(ctx);
  return flavoredDeath(ctx, async (d) => {
    const u = d.unit;
    const sc = ctx.scene;
    seed(u.uid * 31 + 5);
    if (d.hit) {
      void u.play('hit', { hold: true });
      await whiteFlash(sc, u.sprite, 2);
    }
    await sleep(sc, 50);
    holdFrame(u, 'hit', 1);
    const { pc } = currentPixels(u);
    const crackPc = new PixelCanvas(pc.w, pc.h);
    const rnd = mulberry32(u.uid * 7 + 11);
    const core = u.art.core;
    // fissures start at the chest, the neck and the wing root and run through the whole body
    const paths = [
      ...crackPaths(pc, { x: core.x, y: core.y - 4 }, 6, rnd),
      ...crackPaths(pc, { x: core.x + 14, y: core.y - 22 }, 4, rnd),
      ...crackPaths(pc, { x: core.x - 16, y: core.y - 26 }, 4, rnd),
    ];
    const ov = overlay(u, crackPc);
    const glowPc = new PixelCanvas(pc.w, pc.h);
    const ovGlow = overlay(u, glowPc, { blend: ADD, depth: u.sprite.depth + 0.25 });
    const leak = glow(sc, u.core().x, u.core().y, PAL.cyan3, 0.6, 0, u.sprite.depth + 0.3);
    // arena v2: light leaking from the cracks swells on the floor
    const leakLight = lightPool(sc, u.core().x, u.core().y, { color: PAL.cyan4, spill: PAL.cyan3, radius: 26, floorY: d.home.y, air: 0.6, intensity: 0.2, anim: 'shimmer', fadeIn: 0 });
    leakLight.setIntensity(1.3, 380);
    // cracks race out from the chest (≈300 ms): dark fissures with a cyan glow, each step a
    // glassy tick and a 1 px jolt
    const CRACK = 300;
    let ticks = 0;
    const drawCracks = (g: number, hotAll: boolean) => {
      crackPc.clear();
      glowPc.clear();
      for (const p of paths) {
        const n = Math.max(1, Math.round(p.length * g));
        for (let i = 0; i < n; i++) {
          const q = p[i];
          const tip = i > n - 3;
          crackPc.set(q.x, q.y, hotAll || tip ? PAL.white : PAL.night1);
          if (!hotAll && pc.isOpaque(q.x, q.y + 1) && (i & 1) === 0) crackPc.set(q.x, q.y + 1, PAL.cyan2);
          if ((i & 1) === 1) glowPc.set(q.x, q.y - 1, PAL.cyan1);
        }
      }
      ov.redraw(crackPc);
      ovGlow.redraw(glowPc);
    };
    await animate(sc, CRACK, (t, el) => {
      drawCracks(E.outQ(t), false);
      leak.setAlpha(0.25 + 0.5 * t + (Math.floor(el / 60) % 2) * 0.12).setScale(0.6 + 0.9 * t);
      const k = Math.floor(t * 4);
      if (k > ticks) {
        ticks = k;
        playSfx('shatter', { volume: 0.25, pitch: 1.3 + k * 0.12 });
        if (u.sprite.active) u.sprite.x += k % 2 ? 1 : -1;
      }
    });
    drawCracks(1, true);
    // light bursts out through the cracks — the ace's last moment in slow motion
    ctx.views.speed.slowMo(0.55, 380);
    const rays = layer(sc, u.sprite.depth + 0.35, ADD);
    const c = u.core();
    const rayA = Array.from({ length: 10 }, (_, i) => (i / 10) * TAU + RR(-0.2, 0.2));
    await animate(sc, 90, (t) => {
      rays.clear();
      for (let i = 0; i < rayA.length; i++) {
        const L = (22 + (i % 3) * 10) * E.outQ(t) + 6;
        rays.seg(c.x, c.y, c.x + Math.cos(rayA[i]) * L, c.y + Math.sin(rayA[i]) * L * 0.85, i % 2 ? 1 : 2, i % 3 ? PAL.cyan4 : PAL.white, 1);
      }
    });
    rays.g.destroy();
    void whiteFlash(sc, u.sprite, 2);
    ov.destroy();
    ovGlow.destroy();
    leak.destroy();
    void leakLight.fadeOut(200);
    d.burst();
    void screenFlash(sc, PAL.cyan4, 0.3, 240);
    void dimPulse(sc, -0.55, { in: 40, hold: 80, out: 480 });
    void crystalBurst(sc, c, { dir: d.push, floor: d.home.y, power: 2, glare: false, count: 14 });
    // keep the cracks in the broken pieces
    const broken = pc.clone();
    for (const p of paths) for (const q of p) broken.set(q.x, q.y, PAL.cyan3);
    await shatterPx(sc, u, { pc: broken, ramp: WYRM_RAMP, push: d.push, glitchMs: 60, speed: 1.15, shards: 34, shardColors: GLASS, stopMs: 60, shakePx: 3 });
    void len;
  });
});
