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
import { E, Sparks, onFrame } from '../../vfx/combat';
import { registerCardHook } from '../api';
import { atFrame, fade, panAt, play } from '../_v3/sound';
import { poseEntrance } from '../_v3/summon';
import { runSummon, type Stage } from '../summon-a/_kit';
import { biteChips, plantDust } from './crag_axeman';
import { Seam } from './crag_axeman-yarik';

const ID = 'crag_axeman';

function placeAt(u: MonsterUnit, feet: XY, lift = 0): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(feet.x), Math.round(feet.y - u.hover - lift));
  s.setDepth(unitDepth(feet.y));
}

async function boulderEntrance(S: Stage): Promise<void> {
  const sc: Phaser.Scene = S.scene;
  const u = S.unit;
  const home = S.home;
  const pan = panAt(home.x);
  if (!u.has('summon')) {
    await poseEntrance({ scene: sc, unit: u, home, player: S.player, ramp: S.ramp, big: S.big, cutIn: S.cutIn, lightColor: S.lightColor, finale: () => void u.badge.pop() });
    return;
  }
  // a tribute's riser (if any) gives way: the boulder is the arrival
  fade(['summonCharge'], 140);
  const n = u.frameCount('summon');
  const rollEnd = 4; // f0–3 roll
  const landF = u.markFrame('summon', 'land', 8);
  // from off the tile's back edge (P1 the back-left, P2 mirrored), along the iso axis
  const from: XY = { x: home.x - S.dir * 26, y: home.y - 13 };
  const rollMs = u.rangeMs('summon', 0, rollEnd);
  u.pose('summon', 0);
  placeAt(u, from);
  u.showSprite();
  play('caxRoll', { volume: 0.9, pan: panAt(from.x) });
  // it tumbles in over the tile's edge: a kick of dust where it first touches
  plantDust(sc, { x: Math.round(from.x), y: Math.round(from.y) }, 1, { x: -S.dir, y: -0.5 });
  // ---- the roll: two bounces while it travels, then the stop and two 1-px rocks in the still beat
  let bounce = 0;
  const bounceAt = [0.42, 0.78];
  onFrame(sc, (_dt, el) => {
    if (!u.sprite.active) return false;
    const t = Math.min(1, el / Math.max(1, rollMs));
    const e = E.outQ(t);
    const p = { x: from.x + (home.x - from.x) * e, y: from.y + (home.y - from.y) * e };
    // the hops: 3 px before the first touch, 1 px before the second
    let lift = 0;
    if (t < bounceAt[0]) lift = Math.sin((t / bounceAt[0]) * Math.PI) * 3;
    else if (t < bounceAt[1]) lift = Math.sin(((t - bounceAt[0]) / (bounceAt[1] - bounceAt[0])) * Math.PI) * 1.6;
    while (bounce < 2 && t >= bounceAt[bounce]) {
      const k = bounce++;
      play('caxBounce', { volume: k ? 0.95 : 0.6, pitch: k ? 0.94 : 1.04, pan: panAt(p.x) });
      plantDust(sc, { x: Math.round(p.x), y: Math.round(p.y) }, k, { x: -S.dir, y: 0 });
      if (k === 1) void shake(sc, 80, 1);
    }
    if (t >= 1) {
      // the stop: it rocks 1 px forward and back (the still beat follows, silent)
      const r = el - rollMs;
      const rock = r < 50 ? 1 : r < 100 ? 0 : r < 150 ? -1 : 0;
      placeAt(u, { x: home.x + rock * S.dir, y: home.y });
      return r < 160;
    }
    placeAt(u, p, Math.round(lift));
    return true;
  }, () => placeAt(u, home));
  // ---- the beats on the pose's own frames
  atFrame(u, 'summon', 5, () => {
    // the blade punches out through the boulder's front: chips toward the camera side, one white spark
    play('caxPunch', { volume: 0.95, pan });
    const at = u.framePoint(u.art.anchorX + 20, u.art.anchorY - 18);
    biteChips(sc, { x: Math.round(at.x), y: Math.round(home.y) }, { x: S.dir, y: 0.2 }, 6);
    const sp = new Sparks(sc, unitDepth(home.y) + 1);
    sp.add({ x: Math.round(at.x), y: Math.round(at.y), life: 70, colors: [PAL.white], shape: 'plus', size: 2, fadeAt: 1 });
    sp.release();
    void lightFlash(sc, Math.round(at.x), Math.round(at.y), PAL.white, 14, 200, { floorY: home.y, intensity: 0.7 });
    void shake(sc, 60, 1);
  });
  atFrame(u, 'summon', 6, () => {
    // the light seam runs up the boulder's face (drawn by the art); the light it pours on the floor, and the Yarık it
    // leaves: a short floor seam along the axis where the boulder split
    play('caxSplit', { volume: 0.95, pan });
    const c = u.framePoint(u.art.anchorX + 1, u.art.anchorY - 16);
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
    });
  });
  atFrame(u, 'summon', 7, () => play('caxHalves', { volume: 0.85, pan }));
  atFrame(u, 'summon', landF, () => {
    play('caxStepOut', { volume: 0.95, pan });
    void shake(sc, 90, 2);
    plantDust(sc, { x: Math.round(home.x + S.dir * 6), y: Math.round(home.y) }, 2, { x: -S.dir, y: 0 });
    plantDust(sc, { x: Math.round(home.x - S.dir * 6), y: Math.round(home.y) }, 1, { x: S.dir, y: 0 });
  });
  atFrame(u, 'summon', Math.min(n - 1, landF + 1), () => {
    play('caxNara', { volume: 0.95, pan });
    void u.badge.pop();
  });
  await u.playRange('summon', 0, undefined, { hold: false });
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
