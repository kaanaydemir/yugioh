// Kutup Hükümdarı (polar_sovereign, lane D) — the death when the split FAILS (YENI_KARTLAR §C15 "tutmazsa üçü yere
// düşer ve kendi ölümleriyle söner"; §5.2: no generic stone / ash ending). Side-effect free (the `_` file is loaded
// by the cinematics glob but registers nothing).
//
// On the repel frame the sovereign's body flashes white and the three PIECES are born where their parts were drawn
// in it (temporary units of the pieces' own arts, never on the field): each is knocked a few px apart and drops to
// the floor of the sovereign's tile, then dies its OWN death with its own final material and sounds, staggered so
// they read one by one — the needle's spear is seized and ripped away spinning off-screen and its plates drop, the
// anvil's poles strobe and its halves repel apart as iron plates, the coil's wire unwinds and the empty spool rolls
// off spinning free. Iron dust settles on the tile under them.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { framePose as needlePose } from '../../art/monsters-v3/polar_needle-anims';
import { DEATH_PLATES } from '../../art/monsters-v3/polar_needle-anims';
import { skeleton as needleSkeleton } from '../../art/monsters-v3/polar_needle-rig';
import type { MonsterId } from '../../data/cards';
import { MonsterUnit } from '../../duel/MonsterUnit';
import type { PlayerId } from '../../engine/types';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { sleep } from '../../vfx/combat';
import { run } from '../../vfx/setpieces';
import { atFrame, panAt, play, start } from '../_v3/sound';
import { anvilRemains, deadPoles, ironPlates, poleStrobe, repelBurst } from './_polar_anvil-fx';
import { SPOOL_MS, coilRemains, coreSpill, emptySpool, spindleDust, unwindGlints } from './_polar_coil-fx';
import { flyingNeedle, forceGrip, needlePoint, needleRemains, plateClink, ripBurst, shellPlates } from './_polar_needle-fx';
import { dustShock } from './_polar_sovereign-fx';

const rnd = Math.round;

export interface FallingPiece {
  id: MonsterId;
  /** the piece's anchor where its part sits in the sovereign's body on the repel frame (world, floor point) */
  from: XY;
  /** where it lands on the floor */
  to: XY;
  /** the arc's height over the straight line (px) */
  arc: number;
  /** its own death starts this long after it lands (they read one by one) */
  delay: number;
}

/** A piece's temporary unit: the piece's own art (its P2 relight for player 2), off the field, badge hidden. */
function tempUnit(sc: Phaser.Scene, id: MonsterId, uid: number, player: PlayerId, zone: number): MonsterUnit {
  const u = new MonsterUnit(sc, { uid: uid as never, cardId: id, player, zone, position: 'attack', atk: 0, def: 0, hidden: true });
  u.badge.setVisible(false);
  u.posed = true;
  return u;
}

/**
 * The three pieces fall out of the sovereign and die their own deaths. Resolves when every final is over (the
 * remains broken); `onSettled` fires once the last piece has hit the floor and started dying (the card may leave).
 */
export async function piecesFall(sc: Phaser.Scene, o: { uidBase: number; player: PlayerId; zone: number; dir: 1 | -1; pieces: readonly FallingPiece[]; onSettled?: () => void }): Promise<void> {
  const units = o.pieces.map((p, i) => tempUnit(sc, p.id, o.uidBase + i, o.player, o.zone));
  // born white where the parts were (the repel's flash frame), in the recoil frame of their own deaths
  units.forEach((u, i) => {
    const p = o.pieces[i];
    u.pose('death', 0);
    u.sprite.setPosition(rnd(p.from.x), rnd(p.from.y)).setDepth(unitDepth(p.to.y) + 0.5 + i * 0.01);
    u.showSprite();
    u.sprite.setTintFill(PAL.white);
  });
  await sleep(sc, 34);
  units.forEach((u) => u.sprite.active && u.sprite.clearTint());
  // the knock apart and the fall: a short arc each, onto the sovereign's own tile
  await run(sc, 300, (t) => {
    units.forEach((u, i) => {
      if (!u.sprite.active) return;
      const p = o.pieces[i];
      const e = t * t;
      const x = p.from.x + (p.to.x - p.from.x) * Math.min(1, t * 1.15);
      const y = p.from.y + (p.to.y - p.from.y) * e - Math.sin(Math.PI * Math.min(1, t)) * p.arc;
      u.sprite.setPosition(rnd(x), rnd(y));
      u.lift = Math.max(0, rnd(p.to.y - y));
    });
  });
  units.forEach((u, i) => {
    u.lift = 0;
    u.sprite.setPosition(rnd(o.pieces[i].to.x), rnd(o.pieces[i].to.y));
  });
  // the heap hits the marble: one heavy thud, iron dust out from under it
  play('sovereignFall', { volume: 0.9, pan: panAt(o.pieces[1]?.to.x ?? o.pieces[0].to.x) });
  const mid: XY = { x: rnd(o.pieces.reduce((a, p) => a + p.to.x, 0) / o.pieces.length), y: rnd(o.pieces.reduce((a, p) => a + p.to.y, 0) / o.pieces.length) };
  void dustShock(sc, mid, 46, 460);
  void shake(sc, 120, 2);
  const jobs = units.map(async (u, i) => {
    const p = o.pieces[i];
    if (p.delay > 0) {
      // waiting its turn it is not still: the recoil frame shudders (the field still crackles in it)
      const t0 = sc.time.now;
      await run(sc, p.delay, (_t, el) => {
        if (!u.sprite.active) return;
        u.sprite.setPosition(rnd(p.to.x) + (Math.floor(el / 45) % 2 ? 1 : 0), rnd(p.to.y));
        if (Math.floor(el / 90) !== Math.floor((el - 17) / 90) && sc.time.now - t0 > 30) void lightFlash(sc, p.to.x, p.to.y - 20, i % 2 ? PAL.water4 : PAL.fire4, 10, 70, { floorY: p.to.y, intensity: 0.5 });
      });
      u.sprite.setPosition(rnd(p.to.x), rnd(p.to.y));
    }
    if (!u.sprite.active) return;
    const fin = p.id === 'polar_needle' ? needleFinal(sc, u, p.to, o.dir) : p.id === 'polar_anvil' ? anvilFinal(sc, u, p.to, o.dir) : coilFinal(sc, u, p.to, o.dir);
    await fin;
  });
  void sleep(sc, Math.max(...o.pieces.map((p) => p.delay)) + 120).then(() => o.onSettled?.());
  await Promise.all(jobs);
  for (const u of units) if (!u.retired) u.retire(0);
}

/** The needle's own death from where it fell: seized, ripped away spinning off-screen, its plates drop. */
async function needleFinal(sc: Phaser.Scene, u: MonsterUnit, ground: XY, dir: 1 | -1): Promise<void> {
  const pan = panAt(ground.x);
  const n = u.frameCount('death');
  atFrame(u, 'death', 1, () => {
    play('polarNeedleSeize', { volume: 0.75, pan });
    forceGrip(sc, u, ground, Math.max(120, u.rangeMs('death', 1, 3)), dir);
  }, { maxMs: 3000 });
  atFrame(u, 'death', 2, () => {
    play('polarNeedleRip', { volume: 0.85, pan });
    ripBurst(sc, needlePoint(u, 'pivot', 'death', 1) ?? u.core(), ground.y, u.sprite.depth + 0.3);
    void shake(sc, 110, 2);
  }, { maxMs: 3000 });
  atFrame(u, 'death', 4, () => play('polarNeedleWhirl', { volume: 0.8, pan }), { maxMs: 3000 });
  const P5 = needlePose('death', 5);
  const sk5 = needleSkeleton(P5);
  atFrame(u, 'death', 6, () => {
    if (!u.sprite.active) return;
    const from = u.framePoint(sk5.nc[0], sk5.nc[1]);
    void flyingNeedle(sc, { from: { x: from.x - dir * 6, y: from.y - 12 }, deg: P5.ra, back: -1, drift: dir < 0 ? 0.35 : 1, depth: DEPTH.FX + 2, flip: dir < 0 });
  }, { maxMs: 3000 });
  const plateAt: [number, number][] = [[-15, -2], [7, -1], [-9, -3], [0, -1]];
  const plateSnd = ['polarNeedlePlateHelm', 'polarNeedlePlatePauldron', 'polarNeedlePlatePauldronFar', 'polarNeedlePlateLegs'] as const;
  DEATH_PLATES.forEach((f, i) =>
    atFrame(u, 'death', f, () => {
      if (!u.sprite.active) return;
      plateClink(sc, { x: ground.x + dir * plateAt[i][0], y: ground.y + plateAt[i][1] }, u.sprite.depth + 0.2);
      play(plateSnd[i], { volume: 0.6, pan });
    }, { maxMs: 3000 }),
  );
  await u.playRange('death', 0, undefined, { hold: true });
  if (!u.sprite.active) return;
  await sleep(sc, u.frameMs('death', n - 1));
  needleRemains(sc, u.sprite, ground, 360);
  u.sprite.setVisible(false);
  shellPlates(sc, ground, dir, DEPTH.FX - 1);
  play('polarNeedleBurst', { volume: 0.8, pan });
  await sleep(sc, 380);
}

/** The anvil's own death: the poles swap wildly, the halves repel apart, iron plates fall. */
async function anvilFinal(sc: Phaser.Scene, u: MonsterUnit, home: XY, dir: 1 | -1): Promise<void> {
  const pan = panAt(home.x);
  const n = u.frameCount('death');
  const dissolveF = u.markFrame('death', 'dissolve', 4);
  const swap = start('polarAnvilSwap', { volume: 0.75, pan });
  atFrame(u, 'death', 1, () => poleStrobe(sc, home, Math.max(120, u.rangeMs('death', 1, dissolveF))), { maxMs: 3000 });
  atFrame(u, 'death', dissolveF, () => {
    swap.stop(40);
    play('polarAnvilRepel', { volume: 0.85, pan });
    repelBurst(sc, { x: home.x, y: u.core().y }, home, dir, u.sprite.depth + 0.3);
    void shake(sc, 120, 2);
  }, { maxMs: 3000 });
  atFrame(u, 'death', Math.min(n - 1, dissolveF + 3), () => play('polarAnvilPlate', { volume: 0.7, pan }), { maxMs: 3000 });
  atFrame(u, 'death', Math.min(n - 1, dissolveF + 4), () => play('polarAnvilPlate', { volume: 0.4, pan }), { maxMs: 3000 });
  await u.playRange('death', 0, undefined, { hold: true });
  swap.stop(40);
  if (!u.sprite.active) return;
  const poles = deadPoles(u);
  const ms = u.frameMs('death', n - 1) * 2 + 400;
  if (poles) {
    anvilRemains(sc, u.sprite, home, poles.heel, poles.horn, ms);
    u.sprite.setVisible(false);
  }
  await sleep(sc, u.frameMs('death', n - 1));
  ironPlates(sc, home, dir, DEPTH.FX - 1);
  play('polarAnvilBurst', { volume: 0.8, pan });
  await sleep(sc, ms - u.frameMs('death', n - 1));
}

/** The coil's own death: the wire unwinds, the empty spindle topples, the empty spool rolls off spinning free. */
async function coilFinal(sc: Phaser.Scene, u: MonsterUnit, home: XY, dir: 1 | -1): Promise<void> {
  const pan = panAt(home.x);
  const n = u.frameCount('death');
  const dissolveF = u.markFrame('death', 'dissolve', 5);
  atFrame(u, 'death', 1, () => {
    play('polarCoilUnwind', { volume: 0.8, pan });
    unwindGlints(sc, u, Math.max(120, u.rangeMs('death', 1, dissolveF)));
  }, { maxMs: 3000 });
  const spill = coreSpill(sc, home, dir, 0.8);
  const steps = [0.6, 0.42, 0.26, 0.12];
  steps.forEach((k, i) => atFrame(u, 'death', 2 + i, () => spill.level(k, 30), { maxMs: 3000 }));
  atFrame(u, 'death', dissolveF, () => {
    spill.fadeOut(80);
    play('polarCoilSlack', { volume: 0.85, pan });
  }, { maxMs: 3000 });
  atFrame(u, 'death', Math.min(n - 1, dissolveF + 2), () => play('polarCoilWobble', { volume: 0.8, pan }), { maxMs: 3000 });
  atFrame(u, 'death', n - 1, () => {
    play('polarCoilTok', { volume: 0.8, pan });
    spindleDust(sc, { x: home.x - dir * 18, y: home.y }, home.y);
  }, { maxMs: 3000 });
  await u.playRange('death', 0, undefined, { hold: true });
  spill.fadeOut(60);
  if (!u.sprite.active) return;
  const r = coilRemains(sc, u);
  u.sprite.setVisible(false);
  play('polarCoilBurst', { volume: 0.8, pan });
  r.burst(SPOOL_MS);
  await emptySpool(sc, home, dir, Math.max(DEPTH.FX - 1, u.sprite.depth + 0.6), r.spoolAt, () => play('polarCoilBreak', { volume: 0.85, pan }));
}
