// rockAssembly — the 'assemble' summon's set piece for a body of stone (A0 §1.3), in Taş Muhafız's ornament budget
// (A3_MIMARI §6.2). 0: the floor splits round the tile, rune-gold light in the fissures, six rocks tear loose;
// they climb to their orbits (8–24 px) round the rising column (behind it on the far half), then bottom up each
// flies onto the body part the pose closes on that frame (feet … helm: the art's joints()) and seats with a
// spark, two chips and a click; land: the light sinks; done: the fissures close. floorCracks / keepDecal are
// the pilot's floor-decal kit (its hooks crack the floor with them too).

import { PAL } from '../../../art/palette';
import { mulberry32 } from '../../../art/pixel';
import { DEPTH, type XY } from '../../../view/layout';
import { Sparks, onFrame } from '../../../vfx/combat';
import { Raster } from '../../../vfx/setpieces';
import type { CinematicContext } from '../../_core/types';
import { panAt, play } from '../../_v3/sound';
import { registerSetPiece } from '../summon';

/** A decal leaves in three palette / dither steps (90 ms each), then goes. */
function stepOut(r: Raster, paint: (step: number) => void): void {
  if (!r.alive || !r.scene.sys?.isActive()) return r.destroy();
  onFrame(r.scene, (_dt, el) => (r.alive && el < 270 ? (paint(1 + Math.floor(el / 90)), true) : false), () => r.destroy());
}

/** A floor decal kept for the scene (ctx.keep: until the batch ends), then stepped out. */
export function keepDecal(ctx: CinematicContext, key: string, r: Raster, paint: (step: number) => void): void {
  paint(0);
  ctx.keep(key, { destroy: () => stepOut(r, paint) });
}

/**
 * Cracks run out over the floor from `at` in three growth steps: jagged whole-pixel rays (foreshortened),
 * ink with a lit lip in the floor's own ramp, or rune-gold light inside while `gold()` > 0. Kept for the
 * scene under `key`; else close() steps it out.
 */
export function floorCracks(ctx: CinematicContext, at: XY, seed: number, o: { n?: number; len?: number; from?: number; key?: string; gold?: () => number } = {}): { close(): void } {
  const rnd = mulberry32(seed);
  const [n, len, r0] = [o.n ?? 6, o.len ?? 14, o.from ?? 0];
  const rays = Array.from({ length: n }, (_, i) => {
    let a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
    const L = (len * (0.6 + rnd() * 0.6)) / 3;
    const pts: XY[] = [{ x: at.x + Math.cos(a) * r0, y: at.y + Math.sin(a) * r0 * 0.5 }];
    for (let k = 1; k <= 3; k++) (a += (rnd() - 0.5) * 0.8), pts.push({ x: pts[k - 1].x + Math.cos(a) * L, y: pts[k - 1].y + Math.sin(a) * L * 0.45 });
    return pts;
  });
  // over the stepped floor light (LIGHT_DEPTH.FLOOR 48.5), under the cards lying on the tiles
  const r = Raster.around(ctx.scene, at.x, at.y, (len + r0) * 4 + 8, (len + r0) * 2 + 8, DEPTH.CARD_ON_TILE - 1);
  let grow = 1;
  let closing = false;
  const paint = (step: number) =>
    r.draw(() => {
      const lv = [1, 1, 0.5, 0.25][step] ?? 0;
      const glow = step === 0 ? (o.gold?.() ?? 0) : 0;
      for (const p of rays)
        for (let i = 1; i <= grow; i++) {
          r.line(p[i - 1].x, p[i - 1].y - 1, p[i].x, p[i].y - 1, PAL.night3, lv * 0.75);
          r.line(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y, glow > 0 && i < 3 ? (glow > 0.6 && i === 1 ? PAL.gold3 : PAL.gold1) : PAL.ink, lv);
        }
    });
  const close = () => void (!closing && ((closing = true), stepOut(r, paint)));
  if (o.key) ctx.keep(o.key, { destroy: close });
  onFrame(ctx.scene, (_dt, el) => {
    grow = Math.min(3, 1 + Math.floor(el / 40));
    if (r.alive && !closing) paint(0);
    return r.alive && !closing && (grow < 3 || !!o.gold);
  });
  return { close };
}

registerSetPiece('rockAssembly', ({ ctx, scene, unit: u, home, land, done, lead }) => {
  const rnd = mulberry32(u.uid * 71 + 3);
  const at = { x: Math.round(home.x), y: Math.round(home.y) };
  const landPose = u.markMs('summon', 'land', 7);
  let glow = 1;
  // the fissures run out from under the card on the tile (its diamond), gold light breathing up out of them
  const cracks = floorCracks(ctx, at, u.uid * 13 + 7, { n: 7, len: 14, from: 19, gold: () => glow });
  /** Rock i seats bottom up over the pose's closing (40 … 100 % of its way to 'land'), on the part shown there. */
  const seat = (i: number): { ms: number; p: XY } => {
    const ms = Math.round(landPose * (0.4 + (0.6 * i) / 5));
    let f = 0;
    for (let t = u.frameMs('summon', 0); f < u.frameCount('summon') - 1 && t <= ms; t += u.frameMs('summon', ++f));
    const j = u.art.joints?.('summon', f);
    const k = [0, 0.04, 0.3, 0.58, 0.84, 1][i];
    if (!j?.hip || !j.head || !j.footN || !j.footF) {
      const top = u.worldPoint('top');
      return { ms, p: { x: Math.round(at.x + (i % 2 ? 3 : -3)), y: Math.round(at.y - 2 + (top.y - at.y + 2) * k) } };
    }
    const q = i === 0 ? j.footN : i === 1 ? j.footF : { x: j.hip.x + (j.head.x - j.hip.x) * k + (i === 4 ? 6 : 0), y: j.hip.y + (j.head.y - j.hip.y) * (i === 2 ? 0 : (k - 0.3) / 0.7) };
    const w = u.framePoint(q.x, q.y);
    return { ms, p: { x: Math.round(w.x), y: Math.round(w.y) } };
  };
  const rocks = Array.from({ length: 6 }, (_, i) => ({ i, a0: (i / 6) * Math.PI * 2 + rnd() * 0.4, r0: 22 + rnd() * 8, w: 4.2 + rnd() * 1.2, hb: 8 + 3.2 * i, big: i % 2 === 0, moss: i % 3 === 1, t0: i * 26, ...seat(i), seated: false }));
  const back = Raster.around(scene, at.x, at.y - 30, 100, 84, u.sprite.depth - 0.3);
  const front = Raster.around(scene, at.x, at.y - 30, 100, 84, u.sprite.depth + 0.3);
  const chips = new Sparks(scene, u.sprite.depth + 1);
  // a chunk of the floor's stone, 6–8 px: a lit top-left facet (stone4), a mid face, a dark underside, an ink rim;
  // a moss cap on some
  const KEY: Record<string, number> = { '4': PAL.stone4, '3': PAL.stone3, '2': PAL.stone2, '1': PAL.stone1, '#': PAL.ink, m: PAL.leaf3, n: PAL.leaf2 };
  const [BIG, SMALL] = [['.#####..', '#44433#.', '#443332#', '#433221#', '.#32211#', '..#####.'], ['.###..', '#443#.', '#4332#', '.#321#', '..###.']];
  const stone = (g: Raster, x: number, y: number, big: boolean, moss: boolean) =>
    (big ? BIG : SMALL).forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && g.px(x + i, y + j, KEY[moss && j === 1 && ch === '4' ? (i % 2 ? 'n' : 'm') : ch])));
  onFrame(
    scene,
    (_dt, el) => {
      if (!u.sprite.active) return false;
      back.begin();
      front.begin();
      for (const k of rocks) {
        if (el < k.t0 || k.seated) continue;
        const due = lead + k.ms;
        if (el >= due) {
          // seated: a white spark where it locks, two chips falling off, its click
          k.seated = true;
          chips.add({ x: k.p.x, y: k.p.y, life: 50, colors: [PAL.white], shape: 'px', fadeAt: 1 });
          for (let j = 0; j < 2; j++) chips.add({ x: k.p.x + j * 2 - 1, y: k.p.y + 1, vx: (j - 0.5) * 30, vy: -20, ay: 400, life: 260, colors: [PAL.stone3, PAL.stone2], shape: 'px', floor: at.y + 1, bounce: 0.3, fadeAt: 1 });
          play('hitStoneLight', { volume: 0.25 + 0.04 * k.i, pan: panAt(at.x) });
          continue;
        }
        // off the floor up to its orbit band, round the column, then (its last 180 ms) onto its seat
        const a = k.a0 + k.w * ((el - k.t0) / 1000);
        const o = { x: at.x + Math.cos(a) * k.r0, y: at.y + Math.sin(a) * k.r0 * 0.5 - k.hb * Math.min(1, (el - k.t0) / 160) };
        const q = Math.max(0, Math.min(1, (el - (due - 180)) / 180));
        const c = q * q * (3 - 2 * q);
        const h = k.big ? 4 : 3;
        stone(c < 0.5 && Math.sin(a) < 0 ? back : front, Math.round(o.x + (k.p.x - o.x) * c) - h, Math.round(o.y + (k.p.y - o.y) * c) - h + 1, k.big, k.moss);
      }
      back.end();
      front.end();
      return rocks.some((k) => !k.seated);
    },
    () => {
      back.destroy();
      front.destroy();
      chips.release();
    },
  );
  // the light sinks back into the floor on 'land'; the fissures close once the pose is done
  void land.then(() => (glow = 0));
  void done.then(() => cracks.close());
});
