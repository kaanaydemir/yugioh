// Kum Saati Cücesi (hourglass_imp) — its v3 cinematics (?look=v3 only; docs/v3/oturum-f/hourglass_imp.md §5, §0.9).
// Every registration below is gated on LOOK_V3: the v1 look keeps today's paths byte for byte (KK-9).
//
// Summon — "Dökülüş" (poured into being): his hourglass hangs UPSIDE DOWN over the tile (the sprite's own glass
//   painter, paintGlass: critique #11), pops in with a one-frame gold4 outline and pours a glowing stream down onto
//   the tile (hgiPour); the sprite's summon builds the sand cone under it and sculpts him top-down (hgiShed); the
//   stream runs dry and the empty glass drops (135° → caught on the land frame, hgiCatch: brass tink + soft thud);
//   with no target he hugs it and giggles (hgiGiggle); with a chooseTarget pending he goes straight into THE AIM
//   (special f1: the glass held up at eye level, he squints at the foe through the lower bulb) and holds it across
//   the pick (ctx.keep 'ks:aim'), a grain glinting at the neck.
// Effect — "Kum Mührü" (summonFreezeAttack; activate + target, batch 2): no projectile (rev. 1 #1). He flips the
//   glass overhead and his upper bulb drains; a dotted TIME LINE of still grains lights up one by one from his glass
//   to the target (hgiThread); a brass cap pops in over the target, a giant hourglass outline steps out round it
//   (hgiCage), its lower bulb fills over the feet (hgiFill) — THE STOP (hgiSeal: the trickle cuts dead, silence,
//   "tık", a flat glass tone): every grain hangs, the target's frame is held, a gold rim outside its silhouette, the
//   cage flashes white, "SALDIRAMAZ"; then the cage condenses into the 7 × 11 emblem over its head (hgiCondense)
//   and the floor keeps the cage's bottom cap as a brass hairline. The seal then lives in ./hourglass_imp-seal.ts
//   (bite at the frozen turn's start, strain on its battle phase, thaw at its end phase, drop if it leaves early).
// Strike — "Kum Topu" (the sand cannon): the glass tipped to the hip, the stopper flicked (hgiCork), a parabolic
//   hose of glowing grains (hgiJet) that scours the target (hgiScour: sand sprays back off it, grains settle at its
//   feet), thins 3 → 2 → 1 px and is re-corked (hgiRight). Blocked: it splashes off the guard (hgiSplash) and the
//   recoil skids him back 3 px. Direct: a longer arc onto the duelist, a little dune piles up and slides off
//   (hgiJetLp, hgiDune). Losing: the jet runs back into the neck.
// Death — "Kendi kum saatine akar" (option b, no shatter): the sprite's death (he dries to sand top-down and pours
//   into his own top cap, the hat lands on the cap, the glass topples and lies cracked: hgiDrain, hgiTopple); the
//   cinematic bleeds it — a ≤ 8 px gold rivulet out of the crack, the glass empties in 4 steps (hgiBleed), goes
//   dark ("the clock stops"), the last grain falls (hgiLastGrain) and the card is born from the empty glass.
// No camera moves of its own (EF-8).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { lightOf } from '../../art/rigkit/light';
import type { AnyMonsterAnim } from '../../art/types';
import { paintGlass, glassFrame, GLASS0, type GlassPose } from '../../art/monsters-v3/hourglass_imp-glass';
import { drawImp } from '../../art/monsters-v3/hourglass_imp-rig';
import { BLOCKED_CATCH, BLOCKED_RESUME, DEATH_TOPPLE, SPECIAL_THUNK, framePose } from '../../art/monsters-v3/hourglass_imp-anims';
import { BADGE_DEPTH } from '../../duel/StatBadge';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { Disposable } from '../../duel/types';
import type { GameEvent, Uid } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightFlash, type LightHandle } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { shake } from '../../vfx/core';
import { pixelText } from '../../ui/text';
import { onDuelStart } from '../../duel/seeds';
import { registerCardHook, registerEvent, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { atFrame, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { strikeStartFrame } from '../_v3/clash';
import { behindBodies, cardLeaves } from '../_v3/card';
import { contactFlash } from '../_v3/flash';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import {
  addSeal,
  animating,
  biteSeal,
  bodyOf,
  capBar,
  frozenUids,
  hash,
  lerp,
  live,
  paintCage,
  reconcileSeals,
  rimOf,
  rint,
  sealUids,
  strainSeal,
  thawSeal,
  timeLine,
  type CageGeo,
} from './hourglass_imp-seal';

type Ev<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEvent['type']> = CinematicContext<Ev<T>>;

const ID = 'hourglass_imp';
const N = (name: string) => `kart-f:${ID}:${name}`;
/** The glowing sand (emissive) and the resting sand. */
const GLOW = [PAL.gold4, PAL.gold3] as const;
const SAND = [PAL.earth4, PAL.earth3] as const;

// ================================================================ random (per uid, reset per duel)

let rs = 0x6a11;
onDuelStart(() => (rs = 0x6a11));
function seed(n: number): void {
  rs = (Math.imul(n | 0, 2654435761) ^ 0x6a11) >>> 0;
}
function R(): number {
  rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0;
  return rs / 4294967296;
}
const RR = (a: number, b: number): number => a + (b - a) * R();
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** A frame point of `anim` frame `f` in world space, wherever the sprite stands now. */
function pointOf(u: MonsterUnit, anim: AnyMonsterAnim, f: number, name: 'muzzle' | 'head' | 'core' | 'hand' | 'grip'): XY {
  const p = u.art.points ? u.art.points(anim, f)[name] : undefined;
  const q = p ?? (name === 'core' ? u.art.core : u.art.muzzle);
  return u.framePoint(q.x, q.y);
}

/** Resolve once `cond` holds, or after `ms`. */
function until(sc: Phaser.Scene, cond: () => boolean, ms: number): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise<void>((res) => {
    onFrame(sc, (_dt, el) => {
      if (cond() || el >= ms) {
        res();
        return false;
      }
      return true;
    });
  });
}

const lightFromOf = (u: MonsterUnit): 'left' | 'right' => (u.player === 1 ? 'right' : 'left');

// ================================================================ a raster laid exactly over the sprite (frame coords)

/** The imp's own frame space (+ `top` px of headroom above the frame), placed / flipped like the sprite. */
class ImpLayer {
  readonly r: Raster;
  readonly h: number;
  constructor(sc: Phaser.Scene, private readonly u: MonsterUnit, readonly top: number, depth: number) {
    const a = u.art;
    this.h = a.h + top;
    this.r = new Raster(sc, 0, 0, a.w, this.h, depth);
    this.place();
  }
  place(): void {
    const s = this.u.sprite;
    const a = this.u.art;
    this.r.img.setOrigin(s.originX, (a.anchorY + this.top) / this.h).setFlipX(this.u.flipX).setPosition(Math.round(s.x), Math.round(s.y));
  }
  /** Draw on a cleared canvas in frame coords (y already shifted by `top`). */
  draw(fn: (p: PixelCanvas) => void): void {
    this.r.begin();
    fn(this.r.pc);
    this.r.end();
  }
  hide(): void {
    this.r.begin();
    this.r.end();
  }
  destroy(): void {
    this.r.destroy();
  }
}

/** Paint the hourglass at `g` (frame coords) on `p` with `top` headroom: matter, ink outline, then the light. */
function glassOn(p: PixelCanvas, g: GlassPose, top: number, from: 'left' | 'right', o: { ghost?: boolean } = {}): void {
  const out = paintGlass(p.w, p.h, { ...g, oy: g.oy + top }, lightOf(from));
  if (o.ghost) {
    // the pop-in frame: only a 1-px gold4 outline of the glass
    const q = out.layer;
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) if (!q.isOpaque(x, y) && (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1))) p.set(x, y, PAL.gold4);
    return;
  }
  p.blit(out.layer, 0, 0);
  p.outline(PAL.ink);
  for (let i = 0; i < out.light.length; i += 3) p.set(out.light[i], out.light[i + 1], out.light[i + 2]);
}

/** The pour column (2 px, the sprite's own pourLight pattern) from y0 to y1 at x (frame coords, shifted). */
function pourColumn(p: PixelCanvas, x: number, y0: number, y1: number, ph: number, top: number): void {
  for (let y = y0; y <= y1; y++) {
    const fy = y - top;
    const head = y >= y1 - 1;
    if ((fy + ph) % 6 === 5 && !head) continue;
    p.set(x, y, head ? PAL.gold4 : PAL.gold3);
    if (!head) p.set(x + 1, y, (fy + ph) % 3 === 0 ? PAL.gold4 : PAL.gold3);
  }
}

// ================================================================ summon: "Dökülüş"

const HANG_TOP = 48;
/** The hanging glass: upside down, its stopper hole right over the sprite's pour column (frame x 20–21, y ≈ 18, ≈ 42 px over the tile: low enough to read as his own glass, above the cone crest). */
const HANG: GlassPose = { ...GLASS0, a: 180, ox: 21, oy: -10, sA: 0.95, sB: 0.08, flow: 1, open: 1 };

/** Is the batch waiting for THIS imp's target pick (the effect follows in the next batch)? */
function aimPending(ctx: CinematicContext, uid: Uid): boolean {
  const pd = ctx.after.pending;
  return !!pd && pd.kind === 'chooseTarget' && pd.sourceUid === uid;
}

async function pourV3(S: Stage, aim: boolean): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const from = lightFromOf(u);
  const pan = panAt(S.home.x);
  seed(u.uid * 41 + 7);
  const layer = new ImpLayer(sc, u, HANG_TOP, S.depth + 0.4);
  S.own(layer);
  const pool: LightHandle = S.glow({ color: PAL.gold3, radius: 12, intensity: 0.2, anim: 'breathe', fadeIn: 80, at: { x: S.home.x, y: S.home.y } });
  const LAND = u.markFrame('summon', 'land', 9);
  const T = HANG_TOP;
  const mz = { x: 20, y: HANG.oy + 28 + T };
  // ---- 1. the glass pops in: one frame of a gold4 outline, then the full glass
  layer.draw((p) => glassOn(p, HANG, T, from, { ghost: true }));
  await sleep(sc, 50);
  let ph = 0;
  layer.draw((p) => glassOn(p, { ...HANG, ph }, T, from));
  const pour = start('hgiPour', { volume: 0.9, pan });
  // ---- 2. the stream falls from the hole to the tile (before the sprite takes over at frame y 2)
  const floorY = T + u.art.anchorY;
  await animate(sc, 130, (k) => {
    const head = Math.round(lerp(mz.y + 1, floorY, k * k));
    layer.draw((p) => {
      glassOn(p, { ...HANG, ph: Math.floor(k * 3) }, T, from);
      pourColumn(p, mz.x, mz.y + 1, head, Math.floor(k * 3), T);
    });
  });
  // ---- 3. the sprite pours / sculpts / catches; the hanging glass drains over it until the stream runs dry
  u.pose('summon', 0);
  u.showSprite();
  const end = aim ? u.markFrame('summon', 'land', 9) + 2 : undefined;
  const done = u.playRange('summon', 0, end, { hold: false });
  pool.setIntensity(0.45, 120);
  atFrame(u, 'summon', 3, () => pool.setIntensity(0.7, 120), { late: false });
  atFrame(u, 'summon', 6, () => play('hgiShed', { volume: 0.8, pan }), { late: false });
  let dropped = false;
  let caught = false;
  let el0 = 0;
  const stopLoop = onFrame(sc, (dt) => {
    el0 += dt;
    if (!u.sprite.active) return false;
    layer.place();
    const fi = u.frameInfo();
    const f = fi.anim === 'summon' ? fi.frame : LAND;
    ph = Math.floor(el0 / 60);
    if (f < LAND - 2 && !dropped) {
      const k = clamp(f / (LAND - 3), 0, 1);
      const g: GlassPose = { ...HANG, ph, sA: lerp(0.9, 0.12, k), sB: 0.08 };
      layer.draw((p) => {
        glassOn(p, g, T, from);
        pourColumn(p, mz.x, mz.y + 1, T + 1, ph, T);
        // a grain flicked off the column's side now and then
        if (R() < 0.25) p.set(mz.x + (R() < 0.5 ? -2 : 3), T - 2 + Math.floor(R() * 4), PAL.gold3);
      });
      return true;
    }
    if (!dropped) {
      dropped = true;
      pour.stop(60);
      // the stream runs dry; the empty glass falls (whole px) to where the land frame catches it (135°)
      const end9 = framePose('summon', LAND).g;
      void animate(sc, 100, (k) => {
        const e = k * k;
        const a = k < 0.5 ? 180 : k < 0.85 ? 160 : 145;
        const cy0 = HANG.oy + 13.5;
        const cx0 = HANG.ox;
        const r = (end9.a * Math.PI) / 180;
        const cx1 = end9.ox + 13.5 * Math.sin(r);
        const cy1 = end9.oy - 13.5 * Math.cos(r);
        const cx = lerp(cx0, cx1, e);
        const cy = lerp(cy0, cy1, e);
        const ra = (a * Math.PI) / 180;
        const g: GlassPose = { ...HANG, a, ox: Math.round(cx - 13.5 * Math.sin(ra)), oy: Math.round(cy + 13.5 * Math.cos(ra)), sA: 0.1, sB: 0.06, flow: 0 };
        if (!caught) layer.draw((p) => glassOn(p, g, T, from));
      });
      return true;
    }
    if (f >= LAND && !caught) {
      caught = true;
      layer.hide();
    }
    return !caught;
  });
  // ---- 4. land: the catch, the twirl, the plant
  atFrame(
    u,
    'summon',
    LAND,
    () => {
      caught = true;
      layer.hide();
      play('hgiCatch', { volume: 1, pan });
      pool.setIntensity(1, 40);
      void sleep(sc, 140).then(() => pool.setIntensity(0.55, 300));
    },
    { late: true, maxMs: 4000 },
  );
  atFrame(
    u,
    'summon',
    LAND + 2,
    () => {
      // planted: a puff each side of the glass's foot, a 1-px shake
      plantPuffs(sc, u);
      void shake(sc, 110, 1);
      void u.badge.pop();
    },
    { late: false, maxMs: 4000 },
  );
  if (!aim) atFrame(u, 'summon', LAND + 3, () => play('hgiGiggle', { volume: 0.6, pan }), { late: false, maxMs: 4000 });
  await done;
  stopLoop();
  pour.stop(60);
  void sleep(sc, 160).then(() => pool.fadeOut(420));
}

/** The plant: a puff of sand dust each side of the glass's foot (whole px, falling). */
function plantPuffs(sc: Phaser.Scene, u: MonsterUnit): void {
  const a = u.framePoint(30, 60);
  const b = u.framePoint(44, 60);
  const sp = new Sparks(sc, unitDepth(u.home.y) + 0.4);
  for (const [p, s] of [[a, -1], [b, 1]] as const)
    for (let i = 0; i < 6; i++) sp.add({ x: Math.round(p.x), y: Math.round(p.y - RR(0, 2)), vx: s * (u.flipX ? -1 : 1) * RR(20, 60), vy: RR(-30, -8), ay: 160, drag: 3, life: RR(220, 320), colors: SAND, shape: 'px', fadeAt: 1 });
  sp.release();
}

// ================================================================ the aim hold (between the summon and the pick)

interface AimHandle extends Disposable {
  release(): void;
}

function startAim(ctx: CinematicContext, u: MonsterUnit): void {
  const sc = ctx.scene;
  if (!u.has('special')) return;
  void u.playRange('special', 0, 1);
  // the stream's neck glints (a gold4 grain flicker) while he squints: the only motion of the held pose
  const layer = new ImpLayer(sc, u, 0, u.sprite.depth + 0.1);
  const g = framePose('special', 1).g;
  const nk = glassFrame(g).at(13.5, 0);
  let el = 0;
  let released = false;
  const stop = onFrame(sc, (dt) => {
    if (!u.sprite.active || released) return false;
    el += dt;
    layer.place();
    const on = Math.floor(el / 170) % 3 !== 2;
    const fi = u.frameInfo();
    const shown = fi.anim === 'special' && fi.frame === 1;
    layer.draw((p) => {
      if (on && shown) p.set(Math.floor(nk[0]), Math.floor(nk[1]) + (Math.floor(el / 170) % 2), PAL.gold4);
    });
    return true;
  });
  const h: AimHandle = {
    release() {
      released = true;
      stop();
      layer.destroy();
    },
    destroy() {
      if (!released) {
        h.release();
        if (u.sprite.active && !u.retired) u.rest();
      }
    },
  };
  ctx.keep('ks:aim', h);
}

// ================================================================ effect: "Kum Mührü"

async function sealV3(ctx: Ctx<'activate'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const ti = ctx.findType('target', (e) => e.sourceUid === ev.uid);
  if (ti < 0) return ctx.base();
  const tev = ctx.events[ti] as Ev<'target'>;
  const ref = tev.targets[0];
  const slot = ref && ref.zone === 'monster' ? ctx.state.players[ref.player].monsters[ref.index] : null;
  if (!slot) return ctx.base();
  const tuid = slot.uid;
  ctx.consumeAt(ti);
  animating.add(tuid);
  seed(ev.uid * 13 + tuid * 7);
  const aim = ctx.take('ks:aim') as AimHandle | null;
  aim?.release?.();
  const u = live(ctx.unit(ev.uid));
  const tu = live(ctx.unit(tuid));
  const tile = ctx.views.field.tileOf(tuid);
  const home = tile ? tile.home : zoneXY(ref.player, 'monster', ref.index);
  // ---- the cage's geometry round the target (its idle silhouette + 4 px), or round the set card
  let cage: CageGeo;
  if (tu) {
    const b = bodyOf(tu);
    cage = { cx: b.cx, top: Math.max(26, b.top - 6), bot: Math.round(tu.home.y + 2), R: clamp(b.hw + 4, 9, 22) };
  } else cage = { cx: Math.round(home.x), top: Math.round(home.y - 24), bot: Math.round(home.y + 3), R: 14 };
  const floorDepth = unitDepth(home.y) + 0.5;
  const fx = new Raster(sc, 0, 0, 640, 360, floorDepth);
  const line = new Raster(sc, 0, 0, 640, 360, DEPTH.FX - 1);
  const pan = panAt(home.x);
  const panImp = panAt(u ? u.home.x : home.x);
  let thread: { stop(ms?: number): void } | null = null;
  let held = false;
  let label: Phaser.GameObjects.BitmapText | null = null;
  let bump: { u: MonsterUnit; d: number } | null = null;
  const unbump = () => {
    if (bump && bump.u.sprite.active) bump.u.sprite.setDepth(bump.d);
    bump = null;
  };
  try {
    // ---- 1. the flip: the glass goes up overhead and turns over (special f2–f4), the release on f5
    const from = aim ? 2 : 0;
    const REL = u ? u.markFrame('special', 'release', 5) : 5;
    const CON = u ? u.markFrame('special', 'contact', 6) : 6;
    let imp: Promise<void> = Promise.resolve();
    if (u && u.has('special')) {
      // Round 1 #4: the flip is the "who did it" beat — for its length the imp is drawn over every stat plate (a
      // back-row neighbour's plate sits right in the band the glass turns through); restored after the pour / finally
      bump = { u, d: u.sprite.depth };
      u.sprite.setDepth(BADGE_DEPTH + 1);
      play('hgiFlip', { volume: 0.85, pan: panImp });
      imp = u.playRange('special', from, CON);
      await until(sc, () => !u.sprite.active || (u.frameInfo().anim === 'special' && u.frameInfo().frame >= REL), u.rangeMs('special', from, REL) + 120);
    } else await sleep(sc, 200);
    // ---- 2. the time line: still grains light up one by one from his glass to the cap's place
    const src = u ? rint(pointOf(u, 'special', CON, 'muzzle')) : { x: home.x, y: home.y - 40 };
    const capAt = { x: cage.cx, y: cage.top - 4 };
    const dots = timeLine(src, capAt, clamp(Math.hypot(capAt.x - src.x, capAt.y - src.y) * 0.16, 16, 34));
    thread = start('hgiThread', { volume: 0.9, pan: panImp });
    const LINE_MS = 240;
    await animate(sc, LINE_MS, (k) => {
      const lit = Math.floor(k * dots.length);
      line.draw((r) => {
        for (let i = 0; i <= Math.min(lit, dots.length - 1); i++) {
          const d = dots[i];
          r.px(d.x, d.y, i >= lit - 1 ? PAL.gold4 : PAL.gold3);
          // the lit head is a 2-px grain; every grain keeps a 1-px earth4 tail below (still, never moving)
          if (i >= lit - 1) r.px(d.x + 1, d.y, PAL.gold3);
          else r.px(d.x, d.y + 1, PAL.earth3);
        }
      });
      // the brass top cap pops in over the target in steps as the line arrives
      const capStep = k < 0.55 ? 0 : k < 0.75 ? 1 : k < 0.9 ? 2 : 3;
      fx.draw((r) => {
        if (capStep > 0) capBar(r, cage.cx, cage.top - 1, Math.round([0, 3, Math.max(4, cage.R / 2), cage.R][capStep]));
      });
    });
    // ---- 3. the cage steps out from the stream (3 whole-px steps), the stream pours down from the cap
    play('hgiCage', { volume: 0.9, pan });
    let ph = 0;
    const drawLine = (dim: number) =>
      line.draw((r) => {
        if (dim >= 3) return;
        for (let i = 0; i < dots.length; i++)
          if (dim < 2 || i % 2 === 0) {
            r.px(dots[i].x, dots[i].y, dim === 0 ? PAL.gold3 : PAL.gold2);
            if (dim === 0) r.px(dots[i].x, dots[i].y + 1, PAL.earth3);
          }
      });
    drawLine(0);
    await animate(sc, 200, (k, el) => {
      ph = Math.floor(el / 34);
      const step = Math.min(3, 1 + Math.floor(k * 3));
      fx.draw((r) => paintCage(r, cage, { grow: step / 3, fill: 0, ph, stream: true, caps: 2 }));
    });
    // ---- 4. the lower bulb fills over its feet (3 steps) — in sync with the imp's own glass pouring
    play('hgiFill', { volume: 0.85, pan });
    const FILL = clamp(Math.round((cage.bot - cage.top) * 0.28), 5, 12);
    await animate(sc, 120, (k, el) => {
      ph = Math.floor((200 + el) / 34);
      const f = Math.round((Math.min(3, 1 + Math.floor(k * 3)) / 3) * FILL);
      fx.draw((r) => paintCage(r, cage, { grow: 1, fill: f, ph, stream: true, caps: 2 }));
    });
    // ---- 5. THE STOP: the trickle cuts dead; every grain hangs; the target's frame is held; a gold rim
    unbump(); // the flip and the pour have been seen; the neighbour's plate reads again
    thread.stop(0);
    thread = null;
    play('hgiSeal', { volume: 1, pan });
    const t2 = live(ctx.unit(tuid));
    if (t2) {
      const fi = t2.frameInfo();
      if (fi.anim && !t2.claimed) {
        t2.pose(fi.anim, fi.frame);
        held = true;
      }
    }
    const rim = t2 ? rimOf(t2) : [];
    const frozenPh = ph;
    const stopDraw = (white: boolean, rimOn: number) =>
      fx.draw((r) => {
        paintCage(r, cage, { grow: 1, fill: FILL, ph: frozenPh, stream: true, caps: 2, white });
        if (rimOn > 0) for (const p of rim) if (rimOn > 1 || (p.x + p.y) % 2 === 0) r.px(p.x, p.y, PAL.gold3);
      });
    stopDraw(true, 2);
    void lightFlash(sc, cage.cx, Math.round((cage.top + cage.bot) / 2), PAL.gold3, 26, 260, { floorY: cage.bot, air: 0.6, intensity: 0.7 });
    await sleep(sc, 40);
    stopDraw(false, 2);
    label = pixelText(sc, cage.cx, cage.top - 7, 'SALDIRAMAZ', { size: 'sm', color: PAL.gold4, originX: 0.5, originY: 1 }).setDepth(DEPTH.FX_TOP);
    await sleep(sc, 220);
    // ---- 6. condense: the giant glass steps into the emblem over its head (4 steps)
    play('hgiCondense', { volume: 0.9, pan });
    drawLine(1);
    const em = { top: Math.max(14, cage.top - 4 - 12), bot: Math.max(25, cage.top - 4 - 1) };
    for (let s = 1; s <= 4; s++) {
      const k = s / 4;
      const g: CageGeo = { cx: cage.cx, top: Math.round(lerp(cage.top, em.top + 1, k)), bot: Math.round(lerp(cage.bot, em.bot, k)), R: Math.max(3, Math.round(lerp(cage.R, 3, k))) };
      if (s === 2) drawLine(2);
      if (s === 3) {
        drawLine(3);
        label?.destroy();
        label = null;
      }
      if (s === 2 && held && t2 && t2.sprite.active && !t2.retired) {
        t2.rest();
        held = false;
      }
      fx.draw((r) => {
        paintCage(r, g, { grow: 1, fill: Math.max(0, Math.round(FILL * (1 - k * 1.2))), ph: frozenPh, stream: s < 4, caps: 1 });
        if (s === 1) for (const p of rim) if ((p.x + p.y) % 2 === 0) r.px(p.x, p.y, PAL.gold3);
      });
      await sleep(sc, 60);
    }
    fx.draw(() => undefined);
    animating.delete(tuid);
    addSeal(sc, ctx.views, tuid, { fresh: true });
    // ---- 7. he turns his glass back upright and thunks it down (in the background: the seal is done)
    if (u && u.sprite.active) {
      void imp.then(() => {
        if (!u.sprite.active || u.retired) return;
        atFrame(u, 'special', SPECIAL_THUNK, () => play('hgiRight', { volume: 0.8, pan: panImp }), { late: false, maxMs: 2500 });
        void u.playRange('special', CON + 1, undefined, { hold: false });
      });
    }
  } finally {
    thread?.stop(40);
    animating.delete(tuid);
    unbump();
    if (held) {
      const t3 = live(ctx.unit(tuid));
      if (t3) t3.rest();
    }
    fx.destroy();
    line.destroy();
    if (label) {
      const lb = label;
      void sleep(sc, 260).then(() => lb.destroy());
    }
  }
}

// ================================================================ strike: "Kum Topu"

/** The arc (whole px, 1-px steps) from a to b, apex `h` px above the line. */
function arc(a: XY, b: XY, h: number): XY[] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(2, Math.ceil(d * 1.4));
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = { x: Math.round(lerp(a.x, b.x, t)), y: Math.round(lerp(a.y, b.y, t) - 4 * h * t * (1 - t)) };
    const l = out[out.length - 1];
    if (!l || l.x !== p.x || l.y !== p.y) out.push(p);
  }
  return out;
}

/**
 * The jet along `pts` from index i0 (tail) to i1 (head): a hose of sand, not a line (Round 1 #7) — a 2–3 px core
 * (gold3 over an earth4 underside, gold4 grains glinting along its top), a 2 × 2 gold4 head, gaps marching with the
 * flow, and grains peeling off its underside that fall a pixel further below the arc every frame (whole px).
 */
function paintJet(r: Raster, pts: XY[], i0: number, i1: number, w: number, ph: number): void {
  const a = Math.max(0, Math.floor(i0));
  const b = Math.min(pts.length - 1, Math.floor(i1));
  for (let i = a; i <= b; i++) {
    const p = pts[i];
    const head = i >= b - 2;
    const gap = (i + ph) % 9 === 8 && !head && w < 3;
    if (gap) continue;
    r.px(p.x, p.y, head ? PAL.gold4 : (i + ph) % 5 === 0 ? PAL.gold4 : PAL.gold3);
    if (w >= 2) r.px(p.x, p.y + 1, head ? PAL.gold4 : (i + ph) % 4 === 0 ? PAL.gold3 : PAL.earth4);
    if (w >= 3) r.px(p.x, p.y - 1, (i + ph) % 3 === 0 ? PAL.gold4 : PAL.gold3);
    if (head && w >= 2) r.px(p.x + 1, p.y, PAL.gold4);
    // grains peeling off the underside: each falls 1 px a frame below its point, then lets go (4-frame life)
    if (!head && w >= 2 && (i * 7) % 5 === 0) {
      const life = (ph + i) % 4;
      r.px(p.x + (i % 2), p.y + 2 + life, life < 2 ? PAL.earth4 : PAL.earth3);
    }
  }
}

/** A little pile of sand at the struck monster's feet: rises in 3 steps, sits, then sinks and blinks out (whole px). */
async function footPile(sc: Phaser.Scene, at: XY, floorY: number): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, unitDepth(floorY) + 0.35);
  const x0 = Math.round(at.x);
  const y0 = Math.round(floorY) + 1;
  const paint = (h: number, c: number[]) =>
    r.draw((q) => {
      for (let y = 0; y < h; y++) {
        const hw = (h - y) * 2 + 1;
        for (let x = -hw; x <= hw; x++) q.px(x0 + x, y0 - y, y === h - 1 ? c[0] : (x + y) % 3 === 0 ? c[2] : c[1]);
      }
    });
  try {
    for (const h of [1, 2, 3]) {
      paint(h, [PAL.gold3, PAL.earth4, PAL.earth3]);
      await sleep(sc, 50);
    }
    await sleep(sc, 380);
    for (const [h, c] of [[2, [PAL.earth4, PAL.earth3, PAL.earth2]], [1, [PAL.earth3, PAL.earth2, PAL.earth2]]] as [number, number[]][]) {
      paint(h, c);
      await sleep(sc, 70);
    }
  } finally {
    r.destroy();
  }
}

async function cannonV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 53 + (s.target?.uid ?? 3));
  const res = (s.ctx.ev as Ev<'battle'>).result;
  const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
  const n = u.frameCount('attack');
  const f0 = strikeStartFrame(u);
  const REL = u.markFrame('attack', 'release', 6);
  const CON = u.markFrame('attack', 'contact', REL + 1);
  const REC = u.markFrame('attack', 'recover', CON + 2);
  const pan = panAt(u.home.x);
  const dir = u.flipX ? -1 : 1;
  takeCharge(u, 'hgiFlip', { volume: 0.85, pan });
  atFrame(u, 'attack', Math.max(f0 + 1, REL - 1), () => play('hgiCork', { volume: 0.9, pan }), { late: false });
  // ---- heave, aim, the stopper: to the release frame
  await u.playRange('attack', f0, REL, { timeScale: 1.25 });
  const m0 = rint(pointOf(u, 'attack', REL, 'muzzle'));
  const to = rint(s.direct ? s.to : s.to);
  const pts = arc(m0, to, s.direct ? 26 : 10);
  const jet = new Raster(sc, 0, 0, 640, 360, DEPTH.FX - 1);
  const jetS = start('hgiJet', { volume: 0.85, pan });
  const spray = new Sparks(sc, DEPTH.FX);
  let jetStopped = false;
  const stopJet = (ms: number) => {
    if (jetStopped) return;
    jetStopped = true;
    jetS.stop(ms);
  };
  try {
    // ---- the jet: a hose of grains leaves the neck and falls along its arc (recoil: the sprite's f6)
    void u.playRange('attack', REL, CON);
    const travel = s.direct ? 150 : 120;
    let ph = 0;
    await animate(sc, travel, (k, el) => {
      ph = Math.floor(el / 34);
      const head = k * (pts.length - 1);
      jet.draw((r) => paintJet(r, pts, Math.max(0, head - pts.length * 0.9), head, 3, ph));
      if (R() < 0.5) {
        const p = pts[Math.floor(head * R())];
        spray.add({ x: p.x, y: p.y, vx: RR(-10, 10), vy: RR(0, 20), ay: 220, life: RR(160, 260), colors: [PAL.earth4, PAL.gold3], shape: 'px', fadeAt: 1 });
      }
    });
    // ---- contact
    const at = pts[pts.length - 1];
    s.impact(at);
    const floorY = s.target ? s.target.home.y : s.toGround.y;
    if (s.direct) play('hgiJetLp', { volume: 1, pan: panAt(at.x) });
    else play(s.blocked ? 'hgiSplash' : 'hgiScour', { volume: 1, pan: panAt(at.x) });
    void lightFlash(sc, at.x, at.y, PAL.gold3, s.blocked ? 22 : 30, 280, { floorY, air: 0.7, intensity: 0.85 });
    scour(sc, spray, at, m0, floorY, s.blocked, s.direct);
    if (!s.blocked && !s.direct && s.target) void footPile(sc, { x: s.target.home.x, y: floorY }, floorY);
    if (loses) {
      // the counter-blow comes back along the jet: the grains rush back into his neck
      stopJet(60);
      void animate(sc, 120, (k) => jet.draw((r) => paintJet(r, pts, 0, (1 - k) * (pts.length - 1), 2, 0))).then(() => jet.destroy());
      return;
    }
    let dune: Promise<void> = Promise.resolve();
    if (s.direct) dune = duneAt(sc, s.toGround, dir);
    // he keeps spraying two more dashes, the stream holding full
    const keepMs = s.direct ? 90 : 170;
    let skid: Promise<void> = Promise.resolve();
    if (s.blocked) skid = recoilSkid(sc, u, dir);
    await animate(sc, keepMs, (_k, el) => {
      ph = Math.floor((travel + el) / 34);
      jet.draw((r) => paintJet(r, pts, 0, pts.length - 1, 3, ph));
      if (R() < 0.6) scourGrain(spray, at, m0, s.blocked, s.direct);
    });
    // ---- the stream thins 3 → 2 → 1 and lets go of the neck (EF-13), he re-corks
    stopJet(120);
    for (const w of [2, 1]) {
      jet.draw((r) => paintJet(r, pts, 0, pts.length - 1, w, ph));
      await sleep(sc, 45);
    }
    await animate(sc, 110, (k) => jet.draw((r) => paintJet(r, pts, k * (pts.length - 1), pts.length - 1, 1, ph)));
    jet.draw(() => undefined);
    atFrame(u, 'attack', Math.min(n - 1, REC), () => play('hgiRight', { volume: 0.8, pan }), { late: true, maxMs: 2500 });
    await skid;
    if (s.blocked && u.sprite.active && !u.retired) await blockedCatch(sc, u, pan);
    const rest = u.playRange('attack', s.blocked ? Math.min(n - 1, BLOCKED_RESUME) : CON + 1, undefined, { hold: false });
    await Promise.race([rest, sleep(sc, 900)]);
    void dune;
  } finally {
    stopJet(60);
    spray.release();
    if (jet.alive && !loses) jet.destroy();
    if (u.sprite.active && !u.retired && !loses) {
      const r0 = u.rest0;
      u.sprite.setPosition(r0.x, r0.y);
    }
  }
}

/** The scour: sand sprays back off the struck silhouette in a fan; on a hit body the grains settle at its feet. */
function scour(sc: Phaser.Scene, sp: Sparks, at: XY, from: XY, floorY: number, blocked: boolean, direct: boolean): void {
  for (let i = 0; i < 18; i++) scourGrain(sp, at, from, blocked, direct, floorY);
  if (!blocked && !direct) {
    // the grains fall to its feet and lie there a moment (whole px)
    const lay = new Sparks(sc, unitDepth(floorY) + 0.3);
    for (let i = 0; i < 12; i++) lay.add({ x: at.x + Math.round(RR(-8, 8)), y: at.y + Math.round(RR(-4, 4)), vx: RR(-14, 14), vy: RR(-10, 10), ay: 280, floor: floorY + Math.round(RR(-2, 2)), bounce: 0, life: RR(520, 680), delay: i * 10, colors: i % 3 ? SAND : GLOW, shape: 'px', fadeAt: 0.85 });
    lay.release();
  }
}

function scourGrain(sp: Sparks, at: XY, from: XY, blocked: boolean, direct: boolean, floorY?: number): void {
  const bx = from.x < at.x ? -1 : 1;
  const sym = blocked ? (R() < 0.5 ? -1 : 1) : bx;
  sp.add({ x: at.x + Math.round(RR(-2, 2)), y: at.y + Math.round(RR(-3, 3)), vx: sym * RR(30, blocked ? 110 : 80), vy: RR(-80, direct ? -10 : -20), ay: 300, floor: floorY, bounce: 0.15, life: RR(200, 340), colors: R() < 0.3 ? GLOW : SAND, shape: 'px', fadeAt: 1 });
}

/** Blocked: the doubled recoil skids him back 3 px (whole px) and he wobbles, then the recover walks him home. */
async function recoilSkid(sc: Phaser.Scene, u: MonsterUnit, dir: number): Promise<void> {
  const s = u.sprite;
  const x0 = u.rest0.x;
  await animate(sc, 150, (_k, el) => {
    if (!s.active) return;
    const st = Math.min(3, Math.floor(el / 30));
    s.x = Math.round(x0 - dir * st + (el > 90 && Math.floor(el / 30) % 2 ? dir : 0));
  });
  await sleep(sc, 60);
  if (s.active) s.x = x0;
}

/** Blocked: the comic catch (Round 1 #8) — the sprite is held hidden while its own rig draws BLOCKED_CATCH on a layer. */
async function blockedCatch(sc: Phaser.Scene, u: MonsterUnit, pan: number): Promise<void> {
  const L = new ImpLayer(sc, u, 0, u.sprite.depth + 0.05);
  const from = lightFromOf(u);
  try {
    u.sprite.setVisible(false);
    for (let i = 0; i < BLOCKED_CATCH.length; i++) {
      const st = BLOCKED_CATCH[i];
      L.place();
      L.draw((p) => drawImp(p, st.pose, from));
      if (i === 2) play('hgiCatch', { volume: 0.8, pan });
      await sleep(sc, st.ms);
    }
  } finally {
    if (u.sprite.active) u.sprite.setVisible(true);
    L.destroy();
  }
}

/** Direct: a little dune piles up against the duelist's spot (6 px), then slides off and blinks out in 3 steps. */
async function duneAt(sc: Phaser.Scene, ground: XY, dir: number): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.FX - 1);
  const g = rint(ground);
  const paint = (h: number, dx: number, c: number[]) =>
    r.draw((q) => {
      for (let y = 0; y < h; y++) {
        const w = Math.round((h - y) * 1.6);
        for (let x = -w; x <= w; x++) q.px(g.x + x + dx, g.y - y, y === h - 1 ? c[0] : y >= h - 2 ? c[1] : c[2]);
      }
    });
  try {
    for (let h = 2; h <= 6; h += 2) {
      paint(h, 0, [PAL.gold3, PAL.earth4, PAL.earth3]);
      await sleep(sc, 60);
    }
    await sleep(sc, 220);
    play('hgiDune', { volume: 0.7, pan: panAt(g.x) });
    const steps: [number, number, number[]][] = [
      [5, 3, [PAL.earth4, PAL.earth3, PAL.earth3]],
      [3, 6, [PAL.earth3, PAL.earth3, PAL.earth2]],
      [2, 9, [PAL.earth2, PAL.earth2, PAL.earth1]],
    ];
    for (const [h, dx, c] of steps) {
      paint(h, -dir * dx, c);
      await sleep(sc, 70);
    }
  } finally {
    r.destroy();
  }
}

// ================================================================ death: "Kendi kum saatine akar"

async function deathOwn(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const u = live(field.unit(ev.uid));
  if (!u || !u.has('death')) return ctx.base();
  seed(ev.uid * 29 + 11);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as Ev<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  u.badge.setVisible(false);
  u.posed = true;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  let leave: Promise<void> | null = null;
  const born = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[hourglass_imp] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[hourglass_imp] card', e));
    else if (tile && tile.active)
      leave = tile
        .dissolve(420)
        .then(() => {
          if (tile.active) tile.destroy();
        })
        .catch(() => undefined);
    else leave = Promise.resolve();
  };
  ctx.scene.events.emit('v3:dying', u);
  const pan = panAt(home.x);
  const drainH: { h: { stop(ms?: number): void } | null } = { h: null };
  let layer: ImpLayer | null = null;
  let rivR: Raster | null = null;
  try {
    const n = u.frameCount('death');
    if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, (ctx.hints.push as XY | undefined) ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
    // join a lethal recoil where it hands over (react.ts), break a guard open, or start where the shown frame fits
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
      const st = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
      u.asClaimant(() => void u.playRange('death', st, undefined, { hold: true }));
    }
    const DIS = u.markFrame('death', 'dissolve', 4);
    const TOP = Math.min(n - 3, DEATH_TOPPLE);
    atFrame(u, 'death', DIS, () => (drainH.h = start('hgiDrain', { volume: 0.9, pan })), { late: true, maxMs: 3000 });
    atFrame(
      u,
      'death',
      TOP,
      () => {
        drainH.h?.stop(40);
        play('hgiTopple', { volume: 1, pan });
      },
      { late: true, maxMs: 3000 },
    );
    atFrame(
      u,
      'death',
      n - 2,
      () => {
        void shake(sc, 100, 1);
        lieDust(sc, u);
      },
      { late: true, maxMs: 3000 },
    );
    await until(sc, () => !u.sprite.active || (inDeath() && u.frameInfo().frame >= n - 1), u.rangeMs('death', 0, n) + 300);
    drainH.h?.stop(40);
    if (!u.sprite.active) return;
    await sleep(sc, Math.min(90, u.frameMs('death', n - 1)));
    // ---- the bleed: the lying, cracked glass empties out of its crack in 4 steps, a gold rivulet ≤ 8 px
    layer = new ImpLayer(sc, u, 0, u.sprite.depth + 0.05);
    const L = layer;
    const from = lightFromOf(u);
    const last = framePose('death', n - 1);
    const g0 = last.g;
    const gf = glassFrame(g0);
    // the crack: on the base-side bulb's lower edge (a 1-px mist zigzag); the rivulet runs out of it along the floor
    const crack = gf.at(6.5, 3.2);
    const cx = Math.round(crack[0]);
    const cy = Math.round(crack[1]);
    const face = u.flipX ? -1 : 1;
    const s0 = rint(u.framePoint(cx + 0.5, u.art.anchorY + 1.5));
    // Round 1 #9: the rivulet runs OFF the card onto the bare tile, drawn over the card (and the glass's foot), 12 px
    const riv = new Raster(sc, 0, 0, 640, 360, u.sprite.depth + 0.2);
    rivR = riv;
    const rivAt = (i: number): XY => ({ x: s0.x - face * i, y: s0.y + Math.floor((i + 1) / 2) });
    const drawRiv = (len: number, dark: boolean, grain: number) =>
      riv.draw((r) => {
        for (let i = 0; i < len; i++) {
          const q = rivAt(i);
          const head = i >= len - 2;
          r.px(q.x, q.y, dark ? (i < 3 ? PAL.earth4 : PAL.earth3) : head ? PAL.gold3 : i % 3 === 0 ? PAL.earth4 : PAL.earth3);
          // a 2-px-wide body: an earth2 shadow under it (the bank), so it reads on any card / tile
          r.px(q.x, q.y + 1, dark ? PAL.earth2 : head ? PAL.earth4 : PAL.earth2);
        }
        if (!dark && len > 0) r.px(rivAt(len - 1).x - face, rivAt(len - 1).y, PAL.gold4);
        if (grain > 0) r.px(s0.x, s0.y - 3 + grain, PAL.gold4);
      });
    const crackPx = (p: PixelCanvas) => {
      // a clear mist zig-zag across the bulb's lit face, with a white glint where it starts
      for (const [dx, dy] of [[-2, -3], [-1, -2], [-1, -1], [0, 0], [1, 1], [1, 2], [2, 3]] as const) p.set(cx + dx, cy + dy, PAL.mist);
      p.set(cx - 2, cy - 3, PAL.white);
    };
    const frame = (k: number, dark: boolean) =>
      L.draw((p) => {
        drawImp(p, { ...last, g: { ...g0, sA: (g0.sA ?? 0.42) * (1 - k), sB: Math.max(0.04, 1 - k), dark: dark ? 1 : 0 } }, from);
        crackPx(p);
      });
    u.sprite.setVisible(false);
    const bleed = start('hgiBleed', { volume: 0.85, pan });
    for (let st = 1; st <= 4; st++) {
      frame(st / 4, false);
      drawRiv(st * 3, false, 0);
      await sleep(sc, 55);
    }
    bleed.stop(40);
    // ---- the clock stops: the glass goes dark; the last grain falls from the crack
    play('hgiLastGrain', { volume: 0.9, pan });
    frame(1, true);
    for (let gy = 1; gy <= 3; gy++) {
      drawRiv(12, true, gy);
      await sleep(sc, 25);
    }
    born();
    // ---- the generic pixel dissolve of the empty glass, the hat and the rivulet (150 ms, 3 steps)
    const pc = new PixelCanvas(u.art.w, u.art.h);
    drawImp(pc, { ...last, g: { ...g0, sA: 0, sB: 0.04, dark: 1 } }, from);
    crackPx(pc);
    let ki = 0;
    for (const k of [0.4, 0.75, 1]) {
      L.draw((p) => {
        for (let y = 0; y < pc.h; y++)
          for (let x = 0; x < pc.w; x++) {
            const c = pc.get(x, y);
            if (c === null || hash(x * 7 + ev.uid, y) < k) continue;
            p.set(x, y, c);
          }
      });
      riv.draw((r) => {
        for (let i = 0; i < 12; i++) if (hash(i + ev.uid, ki) >= k) r.px(rivAt(i).x, rivAt(i).y, PAL.earth3);
      });
      ki++;
      await sleep(sc, 50);
    }
    L.hide();
  } catch (e) {
    console.error('[hourglass_imp] death failed', e);
  } finally {
    born();
    drainH.h?.stop(40);
    layer?.destroy();
    rivR?.destroy();
    u.posed = false;
    if (!u.retired) u.retire(0);
    field.forget(ev.uid);
    ctx.scene.events.emit('v3:dead', u);
  }
  await leave;
}

/** The glass lands on its side: a whisper of sand dust along the tile (whole px). */
function lieDust(sc: Phaser.Scene, u: MonsterUnit): void {
  const a = u.framePoint(12, 59);
  const b = u.framePoint(40, 59);
  const sp = new Sparks(sc, unitDepth(u.home.y) + 0.4);
  for (let i = 0; i < 10; i++) {
    const t = R();
    sp.add({ x: Math.round(lerp(a.x, b.x, t)), y: Math.round(lerp(a.y, b.y, t)), vx: RR(-30, 30), vy: RR(-20, -6), ay: 140, drag: 3, life: RR(200, 300), colors: SAND, shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

// ================================================================ the seal across turns (no events of its own)

function turnBeats(ctx: Ctx<'turnStart'>): Promise<void> {
  const st = ctx.stateNext;
  for (const f of frozenUids(st)) if (f.until === ctx.ev.turn && f.player === ctx.ev.player) biteSeal(f.uid, 160);
  return ctx.base();
}

function phaseBeats(ctx: Ctx<'phaseChange'>): Promise<void> {
  const st = ctx.stateNext;
  const ev = ctx.ev;
  if (ev.phase === 'battle' || ev.phase === 'end')
    for (const f of frozenUids(st)) {
      if (f.until !== st.turn || f.player !== ev.player) continue;
      const m = st.players[f.player].monsters[f.index];
      if (!m) continue;
      if (ev.phase === 'battle' && m.faceUp && m.position === 'attack') strainSeal(f.uid, 120);
      if (ev.phase === 'end') thawSeal(f.uid, 80);
    }
  return ctx.base();
}

// ================================================================ registrations (v3 only)

if (LOOK_V3) {
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      const aim = aimPending(ctx, ctx.ev.uid);
      if (ctx.ev.from !== 'hand') {
        // a revive (soul_recall) / a flip: the kit's own entrance, then the aim when the pick follows
        await ctx.base();
      } else await runSummon(ctx, async () => undefined, (S) => pourV3(S, aim));
      const u = live(ctx.unit(ctx.ev.uid));
      if (aim && u) startAim(ctx, u);
    },
    { priority: 20, name: N('summon') },
  );
  registerCardHook(ID, 'effect', (ctx) => sealV3(ctx), { priority: 20, name: N('effect') });
  registerStrike(ID, (s) => cannonV3(s), { priority: 20, name: N('strike') });
  registerCardHook(
    ID,
    'destroyed',
    (ctx) => {
      if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
      return deathOwn(ctx);
    },
    { priority: 20, name: N('death') },
  );
  registerEvent('turnStart', turnBeats, { priority: 20, name: N('seal-turn') });
  registerEvent('phaseChange', phaseBeats, { priority: 20, name: N('seal-phase') });
  // the seals follow the engine's truth (a staged board, a restore, a slot that left the field)
  registerObserver((ev, ctx) => {
    if (ev.type === 'target' || ev.type === 'activate') return;
    if (!frozenUids(ctx.stateNext).length && !sealUids().length) return;
    reconcileSeals(ctx.scene, ctx.views, ctx.stateNext);
  });
}
