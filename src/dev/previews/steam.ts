// ?dev=steam — Steam store visuals (marketing/steam/): staged boards for screenshots and the
// capsule compositions, all drawn from the game's own art (arena, monsters, logo).
//
//   ?dev=steam&s=<key>            a staged duel from STEAM_SCENARIOS below (same as ?dev=duel&s=…;
//                                 works with tools/shot.mjs --fresh)
//   ?dev=steam&cap=logo&bg=000000 the PRISM DUEL logo alone, lit, on a flat colour (&prism=F frame of
//                                 the prism pass, -1 = none; &stack=1 PRISM over DUEL)
//   ?dev=steam&cap=art&k=<key>    key art: a staged face-off with the HUD hidden (&zoom=2 close-up on
//                                 &cx,&cy world point; &beam=1 the prism beam between the monsters)
//   ?dev=steam&cap=icon           the community icon (46×46 at 0,0)
import Phaser from 'phaser';
import type { DevPreview } from '../types';
import { SCENARIOS, type Scenario } from '../../duel/scenarios';
import type { MonSpec } from '../../duel/scenario';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas, mulberry32, type Pt } from '../../art/pixel';
import type { MonsterId } from '../../data/cards';
import type { AnyMonsterAnim } from '../../art/types';
import { monsterArt } from '../../art/monsters';
import { monsterFrame } from '../../art/textures';
import { framePoint } from '../../art/animtime';
import { buildLogo, LOGO_RAMPS } from '../../scenes/title/logo';
import { duelReady } from '../../scenes/DuelScene';
import duelPreview from './duel';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];

/** Staged boards for the store screenshots / key art (no steps: they idle). */
export const STEAM_SCENARIOS: Record<string, Scenario> = {
  stBoard: {
    desc: 'steam: a busy mid-duel board, player 1 to move with a full hand',
    stage: {
      zones: 5,
      turn: 7,
      p0: {
        lp: 2650,
        hand: ['ashen_drake', 'judgment_bolt', 'windmane_knight', 'mirror_barrier', 'dawn_swords'],
        monsters: five('ember_wolf', 'crystal_wyrm', N, { id: 'shield_titan', position: 'defense' }, 'reed_heron'),
        spellTraps: [N, { id: 'chains_of_light', faceUp: false }, N, { id: 'mirror_barrier', faceUp: false }, N],
        graveyard: ['stone_sentinel', 'storm_hawk', 'healing_spring'],
      },
      p1: {
        lp: 3100,
        monsters: five('kite_fencer', 'polar_sovereign', N, 'abyss_magus', { id: 'thorn_lurker', faceUp: false, position: 'defense' }),
        spellTraps: [{ id: 'chasm_trap', faceUp: false }, N, N, { id: 'void_eye', faceUp: false }, N],
        graveyard: ['magma_titan', 'volt_lizard'],
      },
    },
    steps: [],
  },
  stFaceoff: {
    desc: 'steam: Crystal Wyrm (P1) faces Ashen Drake (P2) across the centre line',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five(N, N, 'crystal_wyrm') },
      p1: { monsters: five(N, N, 'ashen_drake') },
    },
    steps: [],
  },
  stArena: {
    desc: 'steam: the arena with a few set cards and no monsters (key-art backdrop)',
    stage: {
      zones: 5,
      p0: { deck: [], spellTraps: [N, { id: 'mirror_barrier', faceUp: false }, N, { id: 'chains_of_light', faceUp: false }, N] },
      p1: { deck: [], spellTraps: [N, { id: 'chasm_trap', faceUp: false }, N, { id: 'void_eye', faceUp: false }, N] },
    },
    steps: [],
  },
  stDrakeHitsWyrm: {
    desc: 'steam: Ashen Drake (P2) attacks Crystal Wyrm',
    stage: {
      zones: 5,
      phase: 'battle',
      active: 1,
      p0: { monsters: five(N, N, 'crystal_wyrm') },
      p1: { monsters: five(N, N, 'ashen_drake') },
    },
    steps: [{ type: 'attack', player: 1, attackerZone: 2, targetZone: 2 }],
  },
  stWyrmHitsDrake: {
    desc: 'steam: Crystal Wyrm attacks Ashen Drake',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five(N, N, 'crystal_wyrm') },
      p1: { monsters: five(N, N, 'ashen_drake') },
    },
    steps: [{ type: 'attack', player: 0, attackerZone: 2, targetZone: 2 }],
  },
};
Object.assign(SCENARIOS, STEAM_SCENARIOS);

// ---------------------------------------------------------------- pixel helpers

let texSeq = 0;
function addTex(scene: Phaser.Scene, pc: PixelCanvas): string {
  const key = `steam:${++texSeq}`;
  scene.textures.addCanvas(key, pc.toCanvas());
  return key;
}

/** Warm to cool: crimson → violet. */
const SPECTRUM: readonly Ramp[] = [RAMPS.crim, RAMPS.fire, RAMPS.gold, RAMPS.leaf, RAMPS.cyan, RAMPS.water, RAMPS.void];

/** Silhouette rings around a canvas (neon back-light): ring k = pixels at Chebyshev-ish distance k. */
function haloOf(src: PixelCanvas, rings: { r: number; c: number; a: number }[]): PixelCanvas {
  const R = Math.max(...rings.map((q) => q.r));
  const w = src.w + R * 2;
  const h = src.h + R * 2;
  const out = new PixelCanvas(w, h);
  const dist = new Float32Array(w * h).fill(Infinity);
  const pts: [number, number][] = [];
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.alpha(x, y) > 40) pts.push([x + R, y + R]);
  // brute force inside a window (frames are small)
  for (const [px, py] of pts)
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > R + 0.5) continue;
        const i = (py + dy) * w + (px + dx);
        if (d < dist[i]) dist[i] = d;
      }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = dist[y * w + x];
      if (d === 0 || d === Infinity) continue;
      const q = rings.find((r) => d <= r.r + 0.25);
      if (q) out.set(x, y, q.c, q.a);
    }
  return out;
}

interface MonsterPose {
  id: MonsterId;
  anim: AnyMonsterAnim;
  frame: number;
  player: 0 | 1;
}

/** One monster frame as a texture, facing its player's direction; returns the image + its muzzle in scene px. */
function monsterAt(
  scene: Phaser.Scene,
  m: MonsterPose,
  x: number,
  y: number,
  o: { halo?: Ramp; shadow?: boolean; light?: Ramp } = {},
): { img: Phaser.GameObjects.Image; muzzle: { x: number; y: number }; top: number } {
  const art = monsterArt(m.id);
  let pc = monsterFrame(m.id, m.anim, m.frame, m.player === 1 && art.p2 === 'relight' ? { lightFrom: 'right' } : undefined);
  if (m.player === 1) pc = pc.flippedX();
  const ax = m.player === 1 ? art.w - art.anchorX : art.anchorX;
  const ay = art.anchorY;
  const mp = framePoint(art, m.anim, m.frame, 'muzzle');
  const mx = m.player === 1 ? art.w - mp.x : mp.x;
  const ox = Math.round(x - ax);
  const oy = Math.round(y - ay);
  if (o.light) {
    // the light pool on the floor under it
    const lp = new PixelCanvas(120, 40);
    lp.ellipse(60, 20, 56, 18, o.light[1], 70);
    lp.ellipse(60, 20, 42, 13, o.light[2], 70);
    lp.ellipse(60, 20, 26, 8, o.light[3], 80);
    scene.add.image(Math.round(x) - 60, Math.round(y) - 20, addTex(scene, lp)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
  }
  if (o.shadow !== false) {
    const sh = new PixelCanvas(64, 16);
    sh.ellipse(32, 8, 30, 6, PAL.ink, 110);
    sh.ellipse(32, 8, 20, 4, PAL.ink, 120);
    scene.add.image(Math.round(x) - 32, Math.round(y) - 8, addTex(scene, sh)).setOrigin(0);
  }
  if (o.halo) {
    const r = o.halo;
    const halo = haloOf(pc, [
      { r: 1, c: r[3], a: 230 },
      { r: 2, c: r[2], a: 150 },
      { r: 4, c: r[1], a: 90 },
      { r: 7, c: r[1], a: 40 },
    ]);
    scene.add.image(ox - 7, oy - 7, addTex(scene, halo)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
  }
  const img = scene.add.image(ox, oy, addTex(scene, pc)).setOrigin(0);
  const b = pc.bounds();
  return { img, muzzle: { x: ox + mx, y: oy + mp.y }, top: oy + (b ? b.y : 0) };
}

/** A breath beam: stepped bands, thickest at the clash end. */
function beam(scene: Phaser.Scene, a: { x: number; y: number }, b: { x: number; y: number }, ramp: Ramp): void {
  const x0 = Math.min(a.x, b.x) - 8;
  const y0 = Math.min(a.y, b.y) - 8;
  const pc = new PixelCanvas(Math.abs(a.x - b.x) + 17, Math.abs(a.y - b.y) + 17);
  const ax = a.x - x0;
  const ay = a.y - y0;
  const bx = b.x - x0;
  const by = b.y - y0;
  const n = Math.ceil(Math.hypot(bx - ax, by - ay));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    const w = 1 + t * 2.6; // half width
    pc.disc(x, y, Math.round(w + 2), ramp[1], 255);
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    pc.disc(x, y, Math.round(1 + t * 2.6), ramp[3], 255);
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    pc.disc(x, y, Math.round(t * 1.6), ramp[4], 255);
    if (t > 0.35) pc.set(x, y, PAL.white);
  }
  scene.add.image(x0, y0, addTex(scene, pc)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);
}

/**
 * The spectrum fan: from (ox, oy) a wedge of hard-edged stripes, cool (violet) on the left to warm
 * (crimson) on the right, opening toward `dir` (radians, 0 = up). Stepped falloff in three bands.
 */
function fan(scene: Phaser.Scene, ox: number, oy: number, radius: number, half: number, dir = 0, alpha = 1): void {
  const R = Math.ceil(radius);
  const pc = new PixelCanvas(R * 2 + 1, R * 2 + 1);
  const n = SPECTRUM.length;
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const dx = x - R;
      const dy = R - y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 2) continue;
      let th = Math.atan2(dx, dy) - dir;
      while (th > Math.PI) th -= Math.PI * 2;
      while (th < -Math.PI) th += Math.PI * 2;
      if (Math.abs(th) > half) continue;
      const k = Math.min(n - 1, Math.floor(((th + half) / (half * 2)) * n));
      const ramp = SPECTRUM[n - 1 - k];
      const u = d / radius;
      const [c, a] = u < 0.22 ? [ramp[4], 210] : u < 0.45 ? [ramp[3], 170] : u < 0.7 ? [ramp[2], 120] : u < 0.88 ? [ramp[2], 70] : [ramp[1], 45];
      pc.set(x, y, c, Math.round(a * alpha));
    }
  scene.add.image(ox - R, oy - R, addTex(scene, pc)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
}

/** The prism crystal at the clash: a faceted diamond, ink outline, white-hot edge. */
function prismGem(scene: Phaser.Scene, x: number, y: number, s = 1): void {
  const w = 9 * s;
  const h = 13 * s;
  const pc = new PixelCanvas(w * 2 + 5, h * 2 + 5);
  const cx = w + 2;
  const cy = h + 2;
  const top: Pt = [cx, cy - h];
  const bot: Pt = [cx, cy + h];
  const l: Pt = [cx - w, cy - Math.round(h * 0.15)];
  const r: Pt = [cx + w, cy - Math.round(h * 0.15)];
  const m: Pt = [cx, cy - Math.round(h * 0.15)];
  pc.poly([top, l, m], PAL.white);
  pc.poly([top, m, r], PAL.cyan4);
  pc.poly([l, bot, m], PAL.mag3);
  pc.poly([m, bot, r], PAL.void3);
  pc.line(l[0], l[1], r[0], r[1], PAL.white);
  pc.line(top[0], top[1], bot[0], bot[1], PAL.mist);
  pc.outline(PAL.ink);
  // glints
  pc.set(cx - 2 * s, cy - h + 3 * s, PAL.white);
  scene.add.image(x - cx, y - cy, addTex(scene, pc)).setOrigin(0);
}

/** A white-hot 4-point star burst. */
function burst(scene: Phaser.Scene, x: number, y: number, r: number): void {
  const pc = new PixelCanvas(r * 2 + 1, r * 2 + 1);
  pc.disc(r, r, Math.round(r * 0.45), PAL.gold2, 120);
  pc.disc(r, r, Math.round(r * 0.3), PAL.gold4, 200);
  pc.disc(r, r, Math.round(r * 0.16), PAL.white, 255);
  for (let i = 0; i <= r; i++) {
    const a = i < r * 0.5 ? 255 : i < r * 0.8 ? 180 : 90;
    const c = i < r * 0.6 ? PAL.white : PAL.gold4;
    pc.set(r + i, r, c, a).set(r - i, r, c, a).set(r, r + i, c, a).set(r, r - i, c, a);
    if (i < r * 0.4) {
      const j = Math.round(i * 0.7);
      pc.set(r + j, r + j, PAL.gold4, 150).set(r - j, r - j, PAL.gold4, 150).set(r + j, r - j, PAL.gold4, 150).set(r - j, r + j, PAL.gold4, 150);
    }
  }
  scene.add.image(x - r, y - r, addTex(scene, pc)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
}

/** Spectrum sparks (pluses and single pixels) scattered in an ellipse. */
function sparks(scene: Phaser.Scene, x: number, y: number, rx: number, ry: number, n: number, seed: number): void {
  const rnd = mulberry32(seed);
  const pc = new PixelCanvas(rx * 2 + 5, ry * 2 + 5);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd());
    const px = Math.round(rx + 2 + Math.cos(a) * d * rx);
    const py = Math.round(ry + 2 + Math.sin(a) * d * ry);
    const ramp = SPECTRUM[Math.floor(rnd() * SPECTRUM.length)];
    const big = rnd() < 0.3;
    pc.set(px, py, big ? PAL.white : ramp[3]);
    if (big) pc.set(px + 1, py, ramp[3]).set(px - 1, py, ramp[3]).set(px, py + 1, ramp[3]).set(px, py - 1, ramp[3]);
  }
  scene.add.image(x - rx - 2, y - ry - 2, addTex(scene, pc)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
}

// ---------------------------------------------------------------- the logo

const LOGO_PAD = 13;

/**
 * A static, fully lit PRISM DUEL built from the title logo's textures (TitleLogo's lit state without
 * its animation loop) with a halo that fits inside its own padding. word: draw only that word
 * (0 = PRISM, 1 = DUEL) with its own left edge at x. Returns the inked width.
 */
function logoAt(scene: Phaser.Scene, x: number, y: number, o: { prism?: number; word?: 0 | 1; halo?: boolean; only?: number } = {}): { w: number; h: number; objs: Phaser.GameObjects.GameObject[] } {
  const L = buildLogo(scene);
  const objs: Phaser.GameObjects.GameObject[] = [];
  const letters = L.letters.filter((l, i) => (o.word === undefined || l.word === o.word) && (o.only === undefined || i < o.only));
  const ox = Math.round(x);
  const oy = Math.round(y);
  // halo: stepped rings around the union of the letter silhouettes, in each word's ramp
  if (o.halo !== false) {
    const R = 12;
    const minX = Math.min(...letters.map((l) => l.x)) - R;
    const maxX = Math.max(...letters.map((l) => l.x + l.w)) + R;
    const minY = Math.min(...letters.map((l) => l.y)) - R;
    const maxY = Math.max(...letters.map((l) => l.y + l.h)) + R;
    const W = maxX - minX;
    const H = maxY - minY;
    const sil = new Int8Array(W * H).fill(-1);
    for (const l of letters) {
      const img = scene.textures.get(l.keys.sil).getSourceImage() as HTMLCanvasElement;
      const data = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
      for (let yy = 0; yy < img.height; yy++)
        for (let xx = 0; xx < img.width; xx++)
          if (data[(yy * img.width + xx) * 4 + 3] > 40) sil[(l.y - minY + yy) * W + (l.x - minX + xx)] = l.word;
    }
    const pc = new PixelCanvas(W, H);
    const rings: [number, number, number][] = [
      [2, 3, 120],
      [4, 2, 90],
      [7, 2, 55],
      [11, 1, 40],
    ];
    for (let yy = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++) {
        if (sil[yy * W + xx] >= 0) continue;
        let best = Infinity;
        let wd = 0;
        for (let v = -R; v <= R; v++)
          for (let u = -R; u <= R; u++) {
            const X = xx + u;
            const Y = yy + v;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const s = sil[Y * W + X];
            if (s < 0) continue;
            const d = Math.hypot(u, v);
            if (d < best) {
              best = d;
              wd = s;
            }
          }
        const ring = rings.find((r) => best <= r[0] + 0.3);
        if (ring) pc.set(xx, yy, LOGO_RAMPS[wd][ring[1]], ring[2]);
      }
    objs.push(scene.add.image(ox + minX, oy + minY, addTex(scene, pc)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
  }
  for (const l of letters) objs.push(scene.add.image(ox + l.x + 2, oy + l.y + 3, l.keys.sil).setOrigin(0).setTint(PAL.ink).setAlpha(0.55));
  for (const l of letters) {
    objs.push(scene.add.image(ox + l.x - 1, oy + l.y, l.keys.sil).setOrigin(0).setTint(PAL.cyan3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.42));
    objs.push(scene.add.image(ox + l.x + 1, oy + l.y, l.keys.sil).setOrigin(0).setTint(PAL.mag3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.42));
  }
  for (const l of letters) {
    objs.push(scene.add.image(ox + l.x, oy + l.y, l.keys.off).setOrigin(0));
    objs.push(scene.add.image(ox + l.x, oy + l.y, l.keys.on).setOrigin(0));
  }
  if (o.prism !== undefined && o.prism >= 0) {
    const img = scene.add.image(ox - LOGO_PAD, oy - LOGO_PAD, L.prismKey, `p:${Math.min(L.prismFrames - 1, o.prism)}`).setOrigin(0);
    if (o.word !== undefined || o.only !== undefined) {
      // only this word's / letter's tubes (the neighbours' tubes reach into its padding)
      const lx = Math.min(...letters.map((l) => l.x)) + LOGO_PAD + 6;
      const rx = Math.max(...letters.map((l) => l.x + l.w)) + LOGO_PAD - 6;
      img.setCrop(lx, 0, rx - lx, L.padH);
    }
    objs.push(img);
  }
  return { w: logoSize(scene, o.word).w, h: L.h, objs };
}

/** Logo inked size (single line). */
function logoSize(scene: Phaser.Scene, word?: 0 | 1): { w: number; h: number; x0: number } {
  const L = buildLogo(scene);
  const letters = L.letters.filter((l) => word === undefined || l.word === word);
  const inkL = Math.min(...letters.map((l) => l.x)) + LOGO_PAD - 7;
  const inkR = Math.max(...letters.map((l) => l.x + l.w)) - LOGO_PAD + 7;
  return { w: inkR - inkL, h: L.h, x0: inkL };
}

/** Stacked logo (PRISM over DUEL, centred on cx). */
function logoStacked(scene: Phaser.Scene, cx: number, y: number, gap: number, prism?: number): number {
  const a = logoSize(scene, 0);
  const b = logoSize(scene, 1);
  logoAt(scene, Math.round(cx - a.w / 2) - a.x0, y, { word: 0, prism });
  const L = buildLogo(scene);
  logoAt(scene, Math.round(cx - b.w / 2) - b.x0, y + L.h + gap, { word: 1, prism });
  return L.h * 2 + gap;
}

// ---------------------------------------------------------------- the community icon

/**
 * The community icon (ICON × ICON, captured ×2 → 184): the logo's neon P, lit, with the prism pass
 * crossing it, on a cut-corner night badge trimmed cyan (left / top) and crimson (right / bottom).
 */
const ICON = 92;
function drawIcon(scene: Phaser.Scene, x: number, y: number, prismFrame: number): void {
  const S = ICON;
  const pc = new PixelCanvas(S, S);
  const cut = 12;
  const inside = (px: number, py: number, inset: number) => {
    const a = px - inset;
    const b = py - inset;
    const n = S - 1 - inset * 2;
    if (a < 0 || b < 0 || a > n || b > n) return false;
    const c = cut - inset * 0.42;
    return a + b >= c && n - a + b >= c && a + n - b >= c && 2 * n - a - b >= c;
  };
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      if (!inside(px, py, 0)) continue;
      const warm = Math.min(S - 1 - py, S - 1 - px) < Math.min(py, px);
      if (!inside(px, py, 1)) pc.set(px, py, PAL.ink);
      else if (!inside(px, py, 3)) pc.set(px, py, warm ? PAL.crim3 : PAL.cyan3);
      else if (!inside(px, py, 4)) pc.set(px, py, warm ? PAL.crim1 : PAL.cyan1);
      else if (!inside(px, py, 5)) pc.set(px, py, PAL.ink);
      else pc.set(px, py, py < 30 ? PAL.night1 : py < 62 ? PAL.night1 : PAL.night0);
    }
  // a few dithered night bands for depth
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      if (!inside(px, py, 6)) continue;
      if (py >= 58 && py < 64 && (px + py) % 2 === 0) pc.set(px, py, PAL.night0);
      if (py >= 26 && py < 30 && (px + py) % 2 === 0) pc.set(px, py, PAL.night2);
      if (py < 26) pc.set(px, py, PAL.night2);
    }
  scene.add.image(x, y, addTex(scene, pc)).setOrigin(0);
  // the P: the logo's own letter textures (halo, shadow, fringes, lit tube, prism pass)
  const L = buildLogo(scene);
  const P = L.letters[0];
  // centre the P's inked box (centre-line w 24 + tube) in the badge
  const inkW = 24 + 14;
  const inkH = 42 + 14;
  const ox = x + Math.round((S - inkW) / 2) - (13 - 7) + 1;
  const oy = y + Math.round((S - inkH) / 2) - (13 - 7);
  const m = scene.children.list.length;
  logoAt(scene, ox - P.x, oy - P.y, { prism: prismFrame, only: 1 });
  void m;
}

// ---------------------------------------------------------------- capsule compositions

interface Placed {
  pose: MonsterPose;
  x: number;
  y: number;
}

interface Comp {
  /** Base size in screen px (captured at 0,0). */
  w: number;
  h: number;
  /** Art zoom: the arena and every art-layer object are drawn at this integer scale. */
  zoom: 1 | 2;
  /** Duel world point shown at the composition's top-left. */
  scroll: [number, number];
  wyrm?: Placed;
  drake?: Placed;
  /** Clash point (art space): beams meet here, the prism gem and the fan sit here. */
  clash?: [number, number];
  fan?: { r: number; half: number; dir?: number; alpha?: number };
  gem?: number;
  /** Logo top-left in SCREEN px (1× logo pixels); stacked = PRISM over DUEL centred on x. */
  logo?: { x: number; y: number; stacked?: boolean; prism?: number };
  /** Darken the art toward the frame edges (0..1 per band). */
  vignette?: number;
  /** Art rows (from the top) darkened behind the logo. */
  sky?: number;
  /** Uniform extra darkening (0..1). */
  dim?: number;
}

const WYRM = (frame = 4, anim: AnyMonsterAnim = 'roar'): MonsterPose => ({ id: 'crystal_wyrm', anim, frame, player: 0 });
const DRAKE = (frame = 4, anim: AnyMonsterAnim = 'roar'): MonsterPose => ({ id: 'ashen_drake', anim, frame, player: 1 });

const COMPS: Record<string, Comp> = {
  header: {
    w: 460,
    h: 215,
    zoom: 1,
    scroll: [90, 40],
    wyrm: { pose: WYRM(), x: 112, y: 206 },
    drake: { pose: DRAKE(), x: 352, y: 200 },
    clash: [232, 132],
    fan: { r: 150, half: 0.62 },
    gem: 1,
    logo: { x: 50, y: 10, prism: 16 },
    vignette: 0.5,
    sky: 70,
  },
  small: {
    w: 462,
    h: 174,
    zoom: 1,
    scroll: [90, 70],
    wyrm: { pose: WYRM(), x: 46, y: 196 },
    drake: { pose: DRAKE(), x: 420, y: 192 },
    clash: [231, 168],
    fan: { r: 175, half: 0.95, alpha: 0.8 },
    logo: { x: 51, y: 56, prism: 16 },
    vignette: 0.8,
    sky: 150,
    dim: 0.35,
  },
  main: {
    w: 616,
    h: 353,
    zoom: 2,
    scroll: [168, 66],
    wyrm: { pose: WYRM(), x: 84, y: 172 },
    drake: { pose: DRAKE(), x: 226, y: 166 },
    clash: [155, 112],
    fan: { r: 100, half: 0.62 },
    gem: 1,
    logo: { x: 128, y: 12, prism: 16 },
    vignette: 0.45,
    sky: 38,
  },
  hero: {
    w: 480,
    h: 155,
    zoom: 1,
    scroll: [64, 66],
    wyrm: { pose: WYRM(), x: 176, y: 154 },
    drake: { pose: DRAKE(), x: 330, y: 140 },
    clash: [256, 82],
    fan: { r: 100, half: 0.7 },
    gem: 1,
    vignette: 0.3,
  },
  vertical: {
    w: 187,
    h: 224,
    zoom: 1,
    scroll: [226, 52],
    wyrm: { pose: WYRM(), x: 46, y: 226 },
    drake: { pose: DRAKE(), x: 152, y: 200 },
    clash: [97, 112],
    fan: { r: 112, half: 0.55 },
    gem: 1,
    vignette: 0.45,
    sky: 72,
  },
  library: {
    w: 200,
    h: 300,
    zoom: 1,
    scroll: [222, 0],
    wyrm: { pose: WYRM(), x: 54, y: 300 },
    drake: { pose: DRAKE(), x: 154, y: 250 },
    clash: [103, 172],
    fan: { r: 150, half: 0.6 },
    gem: 1,
    vignette: 0.45,
    sky: 96,
  },
};

class SteamOverlay extends Phaser.Scene {
  constructor() {
    super('SteamOverlay');
  }

  create(data: { comp: Comp }): void {
    const c = data.comp;
    const z = c.zoom;
    const aw = Math.ceil(c.w / z);
    const ah = Math.ceil(c.h / z);
    const artCam = this.cameras.main;
    artCam.setOrigin(0, 0).setZoom(z).setScroll(0, 0).setRoundPixels(true);
    const mark = this.children.list.length;
    // vignette: stepped night bands (top and sides darker; the logo needs a calm sky)
    if (c.vignette) {
      const v = new PixelCanvas(aw, ah);
      for (let y = 0; y < ah; y++)
        for (let x = 0; x < aw; x++) {
          const ex = Math.min(x, aw - 1 - x) / (aw / 2);
          const ey = y / ah;
          const t = Math.min(ex * 1.6, 1) * 0.55 + Math.min(ey * 1.5, 1) * 0.45;
          let a = (t < 0.35 ? 0.9 : t < 0.55 ? 0.62 : t < 0.75 ? 0.36 : t < 0.9 ? 0.16 : 0) * c.vignette;
          if (c.sky) {
            const u = y / c.sky;
            const b = u < 0.75 ? 0.62 : u < 1 ? 0.45 : u < 1.25 ? 0.28 : u < 1.5 ? 0.12 : 0;
            a = 1 - (1 - a) * (1 - b);
          }
          if (c.dim) a = 1 - (1 - a) * (1 - c.dim);
          if (a > 0) v.set(x, y, PAL.night0, Math.round(255 * a));
        }
      this.add.image(0, 0, addTex(this, v)).setOrigin(0);
    }
    if (c.clash && c.fan) fan(this, c.clash[0], c.clash[1], c.fan.r, c.fan.half, c.fan.dir ?? 0, c.fan.alpha ?? 1);
    let wm: { x: number; y: number } | null = null;
    let dm: { x: number; y: number } | null = null;
    // the drake stands further back (it is drawn first)
    if (c.drake) dm = monsterAt(this, c.drake.pose, c.drake.x, c.drake.y, { halo: RAMPS.crim, light: RAMPS.crim }).muzzle;
    if (c.wyrm) wm = monsterAt(this, c.wyrm.pose, c.wyrm.x, c.wyrm.y, { halo: RAMPS.cyan, light: RAMPS.cyan }).muzzle;
    if (c.clash) {
      const p = { x: c.clash[0], y: c.clash[1] };
      if (wm) beam(this, wm, p, RAMPS.cyan);
      if (dm) beam(this, dm, p, RAMPS.crim);
      burst(this, p.x, p.y, 18);
      if (c.gem) prismGem(this, p.x, p.y, c.gem);
      sparks(this, p.x, p.y, 40, 26, 30, 7);
    }
    const artObjs = this.children.list.slice(mark);
    if (c.logo) {
      const ui = this.cameras.add(0, 0, 640, 360, false, 'logo');
      const m2 = this.children.list.length;
      if (c.logo.stacked) logoStacked(this, c.logo.x, c.logo.y, 4, c.logo.prism);
      else logoAt(this, c.logo.x, c.logo.y, { prism: c.logo.prism });
      const logoObjs = this.children.list.slice(m2);
      ui.ignore(artObjs);
      artCam.ignore(logoObjs);
    }
    // frame guide outside the composition: nothing (the clip ignores it)
  }
}

async function startComp(scene: Phaser.Scene, name: string, params: URLSearchParams): Promise<void> {
  const c = COMPS[name];
  if (!c) throw new Error(`unknown composition ${name}`);
  const p = new URLSearchParams(params);
  p.set('k', params.get('k') ?? 'stArena');
  if (!p.has('figures')) p.set('figures', '0');
  const duel = await startArt(scene, p);
  const cam = duel.cameras.main;
  cam.setOrigin(0, 0).setZoom(c.zoom).setScroll(c.scroll[0], c.scroll[1]);
  if (params.get('art') === '0') return;
  const game = scene.game;
  if (!game.scene.keys['SteamOverlay']) game.scene.add('SteamOverlay', SteamOverlay, false);
  game.scene.run('SteamOverlay', { comp: c });
  game.scene.bringToTop('SteamOverlay');
}

// ---------------------------------------------------------------- key art backdrop

/** Start a staged duel (no steps run) and hide its HUD camera (&hud=1 keeps it). */
async function startArt(scene: Phaser.Scene, params: URLSearchParams): Promise<Phaser.Scene> {
  const key = params.get('k') ?? 'stFaceoff';
  const sc = SCENARIOS[key];
  const game = scene.game;
  const ready = duelReady();
  scene.scene.start('Duel', { mode: 'hotseat', curtain: false, skipIntro: true, stage: sc.stage, scenario: key, filmScenario: true });
  await ready;
  const duel = game.scene.getScene('Duel');
  const ui = duel.cameras.getCamera('ui');
  if (ui && params.get('hud') !== '1') ui.setVisible(false);
  if (params.get('figures') === '0') {
    // the little duelist figurines on their podiums would peek out behind the capsule monsters
    const hide = () => {
      for (const o of duel.children.list) {
        const t = (o as Phaser.GameObjects.Image).texture?.key ?? '';
        if (t.startsWith('duelist:')) (o as Phaser.GameObjects.Image).setVisible(false);
      }
    };
    hide();
    duel.events.on(Phaser.Scenes.Events.POST_UPDATE, hide);
  }
  return duel;
}

const preview: DevPreview = {
  name: 'steam',
  description: 'Steam store visuals: &s=<steam scenario> | &cap=logo|icon|art|header|small|main|hero|vertical|library',
  async create(scene, params) {
    const cap = params.get('cap');
    if (!cap) return duelPreview.create(scene, params);
    const bg = params.get('bg');
    if (cap === 'logo') {
      scene.cameras.main.setBackgroundColor(bg ? Number('0x' + bg) : PAL.night1);
      const prism = Number(params.get('prism') ?? -1);
      const halo = params.get('halo') !== '0';
      if (params.get('stack') === '1') logoStacked(scene, 320, 120, 4, prism);
      else {
        const L = buildLogo(scene);
        logoAt(scene, Math.round(320 - L.w / 2), Math.round(180 - L.h / 2), { prism, halo });
      }
      return;
    }
    if (cap === 'icon') {
      scene.cameras.main.setBackgroundColor(bg ? Number('0x' + bg) : PAL.night1);
      drawIcon(scene, 0, 0, Number(params.get('prism') ?? 3));
      return;
    }
    if (cap === 'art') {
      await startArt(scene, params);
      return;
    }
    await startComp(scene, cap, params);
  },
};

export default preview;
