// Kaya Baltacı — the death (v3 look only; YENI_KARTLAR §5.2, docs/v3/oturum-c-tasarim.md §2.3): he splits in two along
// his OWN seam. No rubble, no bounce, no dust cloud, no stone crumble (R1 and the sentinel own those), no turning to stone.
//
//   f0      the reaction frame (from wherever the blow left him; posematch / guardbreak as the shared kit)
//   f1      he staggers; the axe slips out of his hands (caxAxeSlip)
//   f2      the axe drops head-first and BITES the floor in front of him, haft upright (caxAxeBite: chips, a white floor
//           flash); a short Yarık opens from it toward his feet (the art)
//   f3      the seam reaches his feet and climbs his centre line, groin to crown (caxSeamRise); light pours out of it
//           (a white air light at his core)
//   f4      'dissolve': the halves separate 1 px, then 2 (caxTear — one long descending tear)
//   f6–f11  the halves tilt apart in steps (caxFall, panned to each side, 140 ms apart); the seam-burn starts at the cut
//   tail    the card is born on the last death frame (burnt scraps only); the burn eats the last of each half in ≥ 2-px
//           clusters (white → earth4 → gone; caxBurn); the planted axe stays 400 ms (its floor seam closing), then
//           tips flat ("tok": caxAxeTok) and sinks out in two palette steps
// The bookkeeping is the shared death kit's (the toGraveyard claimed, the tile released, the card born on the burst
// frame and flown to the graveyard: _v3/card.ts cardLeaves); the body is this card's own (no recipe: this hook is
// the card's only death handler above the defaults).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { framePose } from '../../art/monsters-v3/crag_axeman-anims';
import { AX, GY, H, W, drawAxeman, skeleton, type Pose } from '../../art/monsters-v3/crag_axeman-rig';
import type { GameEvent } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { LOOK_V3, zoneXY, type XY } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { onFrame, sleep } from '../../vfx/combat';
import { registerCardHook } from '../api';
import type { CinematicContext } from '../_core/types';
import { behindBodies, cardLeaves } from '../_v3/card';
import { deathV3 } from '../_v3/death';
import { contactFlash } from '../_v3/flash';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { atFrame, panAt, play } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { overlay } from '../strikes-a/_kit';
import { biteChips } from './crag_axeman';

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
type ToGraveyardEv = Extract<GameEvent, { type: 'toGraveyard' }>;

const ID = 'crag_axeman';

/** Resolve once `cond` holds, or after `ms` of scene time. */
function until(sc: Phaser.Scene, cond: () => boolean, ms: number): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    onFrame(sc, (_dt, el) => {
      if (cond() || el >= ms) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** The tail's frames, drawn from the rig (the burn carried on past the last death frame; the axe tipping flat). */
function tailPoses(): { burn: Pose[]; planted: Pose[]; tip: Pose[] } {
  const p = framePose('death', 11);
  const sk = skeleton(p);
  const head = sk.axe; // the buried axe head: the pivot of the tip
  const at = (ba: number, extra: Partial<Pose>): Pose => {
    const d = [Math.cos((ba * Math.PI) / 180), Math.sin((ba * Math.PI) / 180)];
    return { ...p, burn: 1.45, ba, agx: Math.round(head[0] - AX - d[0] * p.hl), agy: Math.round(head[1] - GY - d[1] * p.hl), ...extra };
  };
  return {
    burn: [{ ...p, burn: 0.8 }, { ...p, burn: 1.02 }],
    planted: [at(90, { crackK: 0.5 }), at(90, { crack: -7, crackK: 0.5 }), at(90, { crack: -3, crackK: 0.5 }), at(90, { crack: 0, crackK: 0 })],
    tip: [at(60, { crack: 0, crackK: 0 }), at(30, { crack: 0, crackK: 0, bury: 0 }), at(6, { crack: 0, crackK: 0, bury: 0 })],
  };
}
let TAIL: ReturnType<typeof tailPoses> | null = null;
const canvasCache = new Map<string, PixelCanvas>();
function tailCanvas(kind: 'burn' | 'planted' | 'tip', i: number, light: 'left' | 'right', dim = 0): PixelCanvas {
  const key = `${kind}:${i}:${light}:${dim}`;
  let pc = canvasCache.get(key);
  if (!pc) {
    TAIL ??= tailPoses();
    pc = new PixelCanvas(W, H);
    drawAxeman(pc, { ...TAIL[kind][i], dim }, light);
    canvasCache.set(key, pc);
  }
  return pc;
}

/** The body's part of the death: the art's split pose, scored, then the burn tail and the axe. Calls `burst` as the body goes. */
async function splitBody(ctx: DestroyCtx, u: MonsterUnit, home: XY, burst: () => void, hit: boolean, push: XY | undefined): Promise<void> {
  const sc = ctx.scene;
  const n = u.frameCount('death');
  const pan = panAt(home.x);
  const sgn = u.flipX ? -1 : 1;
  const light: 'left' | 'right' = u.flipX ? 'right' : 'left';
  if (hit) contactFlash(sc, u.sprite, push ?? { x: -sgn, y: 0 }, { frames: 2, coverage: 0.4 });
  const inDeath = () => u.frameInfo().anim === 'death';
  let planned = takePlannedEntry(u);
  if (!planned && !inDeath() && u.sprite.active && showsGuard(u)) {
    const g = planGuardBreak(u);
    if (g) {
      runGuardBreak(u, g);
      planned = takePlannedEntry(u);
    }
  }
  if (planned && !inDeath()) await until(sc, inDeath, Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
  if (!inDeath() && u.sprite.active) {
    const start = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
    u.asClaimant(() => void u.playRange('death', start, undefined, { hold: true }));
  }
  const untilFrame = (f: number): Promise<void> => {
    const fi = u.frameInfo();
    if (!u.sprite.active || fi.anim !== 'death' || fi.frame >= f) return Promise.resolve();
    if (!u.sprite.anims.isPlaying) return Promise.resolve();
    return u.asClaimant(() => u.playToFrame('death', f));
  };
  const dissolveF = u.markFrame('death', 'dissolve', 4);
  // ---- the beats on their frames
  atFrame(u, 'death', 1, () => play('caxAxeSlip', { volume: 0.9, pan }), { late: false });
  atFrame(u, 'death', 2, () => {
    play('caxAxeBite', { volume: 0.95, pan });
    const ax = u.framePoint(AX + 19, GY);
    const at = { x: Math.round(ax.x), y: Math.round(ax.y) };
    biteChips(sc, at, { x: -sgn, y: 0 }, 6);
    void lightFlash(sc, at.x, at.y - 2, PAL.white, 14, 220, { floorY: at.y, intensity: 0.75 });
  }, { late: true }); // a death joined past f2 (a heavy recoil) still shows the planted axe: its bite is heard then
  let pour: LightHandle | null = null;
  atFrame(u, 'death', 3, () => {
    play('caxSeamRise', { volume: 0.9, pan });
    // light pours out of the seam: a white light standing in the cut (stepped light layer; floor pool + air)
    const c = u.framePoint(AX + 1, GY - 30);
    pour = lightPool(sc, Math.round(c.x), Math.round(c.y), { color: PAL.white, radius: 18, floorY: home.y, air: 0.7, intensity: 0, anim: 'flicker', fadeIn: 0 });
    pour.setIntensity(1.1, 120);
  }, { late: false });
  atFrame(u, 'death', dissolveF, () => play('caxTear', { volume: 1, pan }), { late: false });
  atFrame(u, 'death', Math.min(n - 1, dissolveF + 2), () => play('caxFall', { volume: 0.85, pan: Math.max(-1, Math.min(1, pan - 0.4 * sgn)) }), { late: false });
  atFrame(u, 'death', Math.min(n - 1, dissolveF + 4), () => play('caxFall', { volume: 0.75, pitch: 0.92, pan: Math.max(-1, Math.min(1, pan + 0.4 * sgn)) }), { late: false });
  atFrame(u, 'death', Math.min(n - 1, dissolveF + 5), () => (pour as LightHandle | null)?.setIntensity(0.45, 160), { late: false });
  await untilFrame(n - 1);
  // the last frame: only burnt scraps of the halves are left — the card is born now (it flies while the burn ends)
  burst();
  if (u.sprite.active && inDeath()) await sleep(sc, u.frameMs('death', n - 1));
  // ---- the tail: the burn finishes on an overlay of the rig's own drawing (the sprite goes with the unit's shadow)
  if (!u.sprite.active) {
    (pour as LightHandle | null)?.fadeOut(120);
    return;
  }
  const ov = overlay(u, tailCanvas('burn', 0, light), { depth: u.sprite.depth });
  u.sprite.setVisible(false);
  play('caxBurn', { volume: 0.9, pan });
  if (!u.retired) u.retire(0);
  void (async () => {
    try {
      await sleep(sc, 50);
      ov.redraw(tailCanvas('burn', 1, light));
      await sleep(sc, 50);
      // the body is gone; the planted axe stays while the card flies (~400 ms from its birth): its floor seam closes
      ov.redraw(tailCanvas('planted', 0, light));
      (pour as LightHandle | null)?.fadeOut(140);
      for (const i of [2, 3]) {
        await sleep(sc, 70);
        ov.redraw(tailCanvas('planted', i, light));
      }
      await sleep(sc, 40);
      // it tips flat ("tok" on the landing frame)
      for (let i = 0; i < 3; i++) {
        ov.redraw(tailCanvas('tip', i, light));
        if (i === 2) play('caxAxeTok', { volume: 0.85, pan });
        await sleep(sc, i < 2 ? 40 : 90);
      }
      // and goes out in two palette steps into the night floor (never an on/off blink)
      for (const d of [1, 2]) {
        ov.redraw(tailCanvas('tip', 2, light, d));
        await sleep(sc, 60);
      }
    } finally {
      ov.destroy();
    }
  })();
}

/** The death (registerCardHook 'destroyed'): the shared bookkeeping around this card's own split. */
async function axemanDeath(ctx: DestroyCtx): Promise<void> {
  const ev = ctx.ev;
  const field = ctx.views.field;
  const unit = field.unit(ev.uid);
  if (!unit || unit.retired || !unit.sprite.active || !unit.sprite.visible || !unit.has('death')) return deathV3(ctx, { fallback: () => ctx.base() });
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as ToGraveyardEv) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  unit.badge.setVisible(false);
  unit.posed = true;
  let leave: Promise<void> | null = null;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  const burst = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[crag_axeman] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, unit) }).catch((e) => console.error('[crag_axeman] card', e));
    else if (tile && tile.active)
      leave = tile
        .dissolve(420)
        .then(() => {
          if (tile.active) tile.destroy();
        })
        .catch(() => undefined);
    else leave = Promise.resolve();
  };
  ctx.scene.events.emit('v3:dying', unit);
  try {
    await splitBody(ctx, unit, home, burst, ctx.hints.hit !== false, ctx.hints.push as XY | undefined);
  } catch (e) {
    console.error('[crag_axeman] death failed', e);
  } finally {
    burst();
    unit.posed = false;
    if (!unit.retired) unit.retire();
    field.forget(ev.uid);
    ctx.scene.events.emit('v3:dead', unit);
  }
  await leave;
}

if (LOOK_V3)
  registerCardHook(
  ID,
  'destroyed',
  async (ctx) => {
    if (!LOOK_V3 || ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
    return axemanDeath(ctx);
  },
  { name: 'kartc:crag_axeman:death' },
);
