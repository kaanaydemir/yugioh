// Kaya Baltacı — the entrance (v3 look only; docs/v3/oturum-c-tasarim.md §2.3 "Summon", scene ≈ 1.75 s with the slam).
// The clean line, first use: a boulder rolls in, a silence, the axe blade punches out through it, ONE straight light
// seam runs up its face and it splits clean; he steps out of it and shouts the nara.
//
//   0–220      the card slam (the summon kit)
//   +0–400     summon f0–3: a ~28 px BOULDER (the art's 4 drawn roll frames, never setAngle) rolls in sideways from off
//              the tile's back edge along the iso axis; it bounces twice (the second a 1 px shake), stops and rocks 1 px
//              twice (caxRoll, caxBounce ×2)
//   +400–600   f4: a still beat — the rock is silent
//   +600       f5: the blade punches out through the boulder's front (caxPunch: stone chips, one white spark)
//   +680–850   f6–f7: one vertical light seam runs up the boulder's face; it splits clean and the halves fall apart
//              (caxSplit, caxHalves); a short Yarık opens on the floor where it split
//   +850       f8 'land': he steps out (caxStepOut: 2 px shake, dust at the boots)
//   +960       f9: the NARA, axe raised one-handed (caxNara), the ATK/DEF badge pops
//   → idle     f10–11: the axe back onto the shoulder; the floor seam fades in three steps
// No hologram build (the boulder is matter), no magic circle, no floor ring: C6's log drops vertically and opens like
// doors; the sentinel's rocks orbit; this one rolls in and is CUT. No camera move.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { LOOK_V3, unitDepth, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { E, Sparks, onFrame, sleep } from '../../vfx/combat';
import { PixelCanvas } from '../../art/pixel';
import { framePose } from '../../art/monsters-v3/crag_axeman-anims';
import { H, W, drawAxeman, type Pose } from '../../art/monsters-v3/crag_axeman-rig';
import { overlay } from '../strikes-a/_kit';
import { registerCardHook } from '../api';
import { atFrame, fade, panAt, play } from '../_v3/sound';
import { poseEntrance } from '../_v3/summon';
import { runSummon, type Stage } from '../summon-a/_kit';
import { biteChips, plantDust } from './crag_axeman';
import { Seam, SEAM_DEPTH } from './crag_axeman-yarik';

const ID = 'crag_axeman';

function placeAt(u: MonsterUnit, feet: XY, lift = 0): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(feet.x), Math.round(feet.y - u.hover - lift));
  s.setDepth(unitDepth(feet.y));
}

/** Rig-drawn canvases for the parts of the entrance that are not sprite frames (cached per light side). */
const CANVAS = new Map<string, PixelCanvas>();
function rigCanvas(key: string, pose: Pose, light: 'left' | 'right'): PixelCanvas {
  const k = `${key}:${light}`;
  let pc = CANVAS.get(k);
  if (!pc) {
    pc = new PixelCanvas(W, H);
    drawAxeman(pc, pose, light);
    CANVAS.set(k, pc);
  }
  return pc;
}
/** The rolling boulder two palette steps down (night-tinted as it comes in from the dark, then one step lit). */
const dimBoulder = (roll: number, dim: number, light: 'left' | 'right') => rigCanvas(`dim${dim}:${roll}`, { ...framePose('summon', roll), dim }, light);
/** The two fallen halves lying on the floor, sinking in palette steps (0…3). */
const lyingHalves = (sink: number, light: 'left' | 'right') => rigCanvas(`halves:${sink}`, { ...framePose('summon', 9), hide: true, bould: 5, bk: sink, fseam: 0, chips: 0, dust: 0 }, light);

async function boulderEntrance(S: Stage): Promise<void> {
  const sc: Phaser.Scene = S.scene;
  const u = S.unit;
  const home = S.home;
  const pan = panAt(home.x);
  if (!u.has('summon')) {
    await poseEntrance({ scene: sc, unit: u, home, player: S.player, ramp: S.ramp, big: S.big, cutIn: S.cutIn, lightColor: S.lightColor, finale: () => void u.badge.pop() });
    return;
  }
  const light: 'left' | 'right' = u.flipX ? 'right' : 'left';
  // a tribute's riser (if any) gives way: the boulder is the arrival
  fade(['summonCharge'], 140);
  const landF = u.markFrame('summon', 'land', 10);
  // from 1.5 tiles out beyond the tile's back edge (P1 the back-left, P2 mirrored), along the iso axis: a long roll in
  const from: XY = { x: home.x - S.dir * 58, y: home.y - 29 };
  const ROLL_MS = 340;
  const STILL_MS = 130;
  u.pose('summon', 0);
  placeAt(u, from);
  // it comes in out of the dark in two palette steps (no pop-in): two dim rig canvases over the hidden sprite, then lit
  const ov = overlay(u, dimBoulder(0, 2, light), { depth: u.sprite.depth });
  u.sprite.setVisible(false);
  play('caxRoll', { volume: 0.9, pan: panAt(from.x) });
  // ---- the roll: the 4 drawn frames cycled by the distance rolled (never setAngle), two bounces (2 px, then 1 px) with
  // a dust kick on each touch, then the stop and two 1-px rocks in the silent still beat
  let bounce = 0;
  const bounceAt = [0.5, 0.8];
  let ovLive = true;
  const total = Math.hypot(home.x - from.x, home.y - from.y);
  await new Promise<void>((resolve) => {
    onFrame(sc, (_dt, el) => {
      if (!u.sprite.active) return false;
      const t = Math.min(1, el / ROLL_MS);
      const e = E.outQ(t);
      const p = { x: from.x + (home.x - from.x) * e, y: from.y + (home.y - from.y) * e };
      const roll = Math.floor((total * e) / 6) % 4;
      const dim = t < 0.18 ? 2 : t < 0.36 ? 1 : 0;
      if (ovLive) {
        if (dim === 0) {
          ov.destroy();
          ovLive = false;
          u.showSprite();
          u.sprite.setVisible(true);
        } else {
          ov.redraw(dimBoulder(roll, dim, light));
        }
      }
      if (!ovLive) u.pose('summon', roll);
      // the hops: 2 px before the first touch, 1 px before the second (held a frame at the top so they read)
      let lift = 0;
      if (t < bounceAt[0]) lift = Math.min(2, Math.sin((t / bounceAt[0]) * Math.PI) * 2.6);
      else if (t < bounceAt[1]) lift = Math.min(1, Math.sin(((t - bounceAt[0]) / (bounceAt[1] - bounceAt[0])) * Math.PI) * 1.6);
      while (bounce < 2 && t >= bounceAt[bounce]) {
        const k = bounce++;
        play('caxBounce', { volume: k ? 0.95 : 0.6, pitch: k ? 0.94 : 1.04, pan: panAt(p.x) });
        plantDust(sc, { x: Math.round(p.x), y: Math.round(p.y) }, k, { x: -S.dir, y: 0 });
        if (k === 1) void shake(sc, 80, 1);
      }
      if (t >= 1) {
        // the stop: it rocks 1 px forward and back (the still beat, silent)
        const r = el - ROLL_MS;
        const rock = r < 40 ? 1 : r < 80 ? 0 : r < 115 ? -1 : 0;
        placeAt(u, { x: home.x + rock * S.dir, y: home.y });
        if (r >= STILL_MS) {
          resolve();
          return false;
        }
        return true;
      }
      placeAt(u, p, Math.round(lift));
      return true;
    }, () => {
      if (ovLive) {
        ov.destroy();
        ovLive = false;
      }
      u.sprite.setVisible(true);
      placeAt(u, home);
      resolve();
    });
  });
  // ---- the beats on the pose's own frames
  atFrame(u, 'summon', 4, () => {
    // the blade punches out through the boulder's front: chips toward the camera side, one white spark
    play('caxPunch', { volume: 0.95, pan });
    const at = u.framePoint(u.art.anchorX + 12, u.art.anchorY - 16);
    biteChips(sc, { x: Math.round(at.x), y: Math.round(home.y) }, { x: S.dir, y: 0.2 }, 6);
    const sp = new Sparks(sc, unitDepth(home.y) + 1);
    sp.add({ x: Math.round(at.x), y: Math.round(at.y), life: 70, colors: [PAL.white], shape: 'plus', size: 2, fadeAt: 1 });
    sp.release();
    void lightFlash(sc, Math.round(at.x), Math.round(at.y), PAL.white, 14, 200, { floorY: home.y, intensity: 0.7 });
    void shake(sc, 60, 1);
  });
  atFrame(u, 'summon', 5, () => {
    // the light seam runs up the boulder's face (drawn by the art); the light it pours on the floor, and the Yarık it
    // leaves: a short floor seam along the axis where the boulder split
    play('caxSplit', { volume: 0.95, pan });
    const c = u.framePoint(u.art.anchorX + 1, u.art.anchorY - 14);
    void lightFlash(sc, Math.round(c.x), Math.round(c.y), PAL.white, 22, 320, { floorY: home.y, intensity: 0.9 });
    const fwd = { x: S.dir * 2, y: -1 };
    const L = Math.hypot(fwd.x, fwd.y);
    new Seam(sc, {
      from: { x: Math.round(home.x - (fwd.x / L) * 6), y: Math.round(home.y - (fwd.y / L) * 6) },
      to: { x: Math.round(home.x + (fwd.x / L) * 16), y: Math.round(home.y + (fwd.y / L) * 16) },
      runMs: 90,
      persistMs: 1050,
      ticks: false,
      spark: false,
      quiet: true,
      light: false,
    });
  });
  // the halves fall apart (f7, f8) and land (f9): the landing thumps
  atFrame(u, 'summon', 9, () => {
    play('caxHalves', { volume: 0.85, pan });
    // from here the halves are FLOOR props (decal depth: behind his boots), sinking in palette steps over ~600 ms
    const halves = overlay(u, lyingHalves(0, light), { depth: SEAM_DEPTH + 0.5 });
    void (async () => {
      try {
        for (let k = 1; k <= 3; k++) {
          await sleep(sc, 190);
          halves.redraw(lyingHalves(k, light));
        }
        await sleep(sc, 160);
      } finally {
        halves.destroy();
      }
    })();
  });
  atFrame(u, 'summon', landF, () => {
    play('caxStepOut', { volume: 0.95, pan });
    void shake(sc, 90, 2);
    plantDust(sc, { x: Math.round(home.x + S.dir * 6), y: Math.round(home.y) }, 2, { x: -S.dir, y: 0 });
    plantDust(sc, { x: Math.round(home.x - S.dir * 6), y: Math.round(home.y) }, 1, { x: S.dir, y: 0 });
  });
  await u.playRange('summon', 4, landF);
  await sleep(sc, u.frameMs('summon', landF));
  // ---- the NARA: the roar's own drawn frames (build, the axe raised one-handed with the mouth open held ~460 ms, the
  // mouth closing with the axe still up, the release) — the shout (~0.8 s) lasts as long as its picture
  if (u.has('roar') && u.sprite.active) {
    const beats: [number, number][] = [[2, 100], [3, 90], [4, 170], [5, 170], [6, 120], [7, 90], [8, 90]];
    for (const [f, ms] of beats) {
      if (!u.sprite.active) break;
      u.pose('roar', f);
      if (f === 2) play('caxNara', { volume: 0.95, pan });
      if (f === 3) void u.badge.pop();
      await sleep(sc, ms);
    }
  } else void u.badge.pop();
  placeAt(u, home);
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (!LOOK_V3 || ctx.ev.from === 'field') return ctx.base();
      await runSummon(ctx, boulderEntrance, boulderEntrance);
    },
    { name: 'kartc:crag_axeman:summon' },
  );
