// Ruh Çağrısı (soul_recall) — "Seçilen mezarlık parlar. Canavarın yarı saydam ruhu yükselir ve
// hedef karoya süzülür. Cyan bir sütun onu tam bir çağırmaya dönüştürür (hologram belirme)."
//
//   0       common opening (hand / set tile)
//   +0      release: the card's energy dives into the chosen graveyard (either player's)
//   +~200   the graveyard bursts open in cyan: a ring, spirit flames, the pile loses its card;
//           the translucent cyan ghost of the monster rises out of the pile (cropped by the floor)
//   +~400   it floats along an arc (afterimages, ectoplasm) to the destination tile, where a cyan
//           summoning circle has opened
//   +~780   arrival: a CYAN pillar slams up through the ghost (tile flash, shockwave); the ghost
//           melts into the light and the pillar pinches out …
//   +~950   … and the revived monster makes its OWN signature entrance: the special summon event
//           is played through its summon hook with hints { noCard: true, ghost: true } (summon-a /
//           summon-b honour both: no card flight, cyan tile flash) — the wolf's fire run, the
//           serpent's whirlpool, the hawk's tornado, the wyrm's light column…
//   then    the spent card drops into its owner's graveyard; on-summon effects (Magma Titanı's
//           burn) follow as their own events
// Whole spell ≈ 2.85–3.15 s at speed 1 (≤ 3.2 s). QA: `&recall=generic` in the URL plays the
// older generic cyan rematerialization instead of the signature entrance (for comparison films).
//
// v3 look (?look=v3; docs/v3/A0_ENVANTER.md §6.2 item 5, plan §4 "Diriltme normal çağırmanın aynısı
// değildir ve onunla üst üste oynatılmaz"): recallV3 — the revive is NEVER the summon entrance
// replayed (no ctx.play of the summon with { noCard, ghost }): the summon event is consumed here.
//   0      the opening (short hold), the energy dives into the chosen graveyard
//   +~200  the grave opens, the ghost tears free (shorter rise) and glides to the tile
//   arrive the revived card is born on the tile (cyan flash); the ghost breaks into the body:
//          with the art's `revive` pose the body reassembles on that pose (the matter gathers back:
//          crystal shards, dark motes…) — without it (the old monsters) a ≤ 300 ms cyan rebuild of
//          the body (bottom → top) — never a roar, a cut-in or an on-summon effect
//   land   the body has re-formed: cyan ring, the badge pops, and only now does the spent card
//          leave — born on the grave the energy went into, flying on whole pixels to its owner's pile
//   end    resolves once the card has landed and the body stands (its last breath plays on)
// Budget ≤ 2.1 s (suRevive, spRecallSet, sliceMagusRevive…).

import Phaser from 'phaser';
import { CARDS, isMonster, type CardId, type MonsterId } from '../../data/cards';
import { currentAtk, currentDef } from '../../engine';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { ARENA_V2, DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { TEX, flash, shake, wait } from '../../vfx/core';
import { E, Raster, Sparks, floorRing, ghostTexture, lerp, onFrame, qbez, rnd, rr, run } from '../../vfx/setpieces';
import { createMagicCircle, createPillar, landingDust, shockwave } from '../../vfx/summon';
import { materialize } from '../../vfx/hologram';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { CYAN_FX, bg, evAt, idxOf, relax, sendResolved, setTileOf, spellOpening, fs, lightBeam, lightFlash, lightPool } from './_kit';
import { summonPose } from '../_v3/summon';
import { monsterArt } from '../../art/monsters';
import { artMarkMs, hasAnim, holdOf } from '../../art/animtime';
import { monsterFrame } from '../../art/textures';
import { PixelCanvas } from '../../art/pixel';
import { Sparks as PxSparks } from '../../vfx/combat';
import { matterRamp } from '../_v3/death';
import { warmPoses } from '../_v3/warm';
import { atMark, panAt, play as playV3, soundsOf, start as startV3 } from '../_v3/sound';
// ---- lane A5-A step A-7 (V3_A5_A, docs/v3/A5_PLAN.md §3.6): a set card's own pixels pour into the orb
// (no noise block) and the spell's own sounds — recallOpen as the grave opens, recallGlide as the soul glides
import { V3_A5_A } from '../../view/v3flags';
// (step A-8: the reduced-motion profile, A5 §3.0 — the particles of the v3 recall halved; lane A5-A only)
import { REDUCED_MOTION } from '../../view/v3/motion';
import { fxCount } from '../_v3/spellfx';
import { clearHologram, holoRamp, setHologram } from '../../vfx/hologram';

const ADD = Phaser.BlendModes.ADD;
const TAU = Math.PI * 2;
/** Reduced motion in the v3 recall (lane A5-A's switch on: A5 §3.0, particles × 0.5; times unchanged). */
const RM = V3_A5_A && REDUCED_MOTION;
const CYAN = RAMPS.cyan;

type AnyCtx = CinematicContext<GameEvent>;

interface Ghost {
  /** Melt down into the pillar (white, fading). */
  melt(ms?: number): Promise<void>;
}

/**
 * The graveyard glows; the monster's cyan ghost rises out of the pile and floats to `to`.
 * Resolves when it hovers over the tile. `onLeave` fires the moment it leaves the pile.
 */
async function soulRise(ctx: AnyCtx, from: XY, to: XY, id: MonsterId, player: PlayerId, onLeave: () => void, tm: { rise?: number; float?: number; settle?: number } = {}): Promise<Ghost> {
  const sc = ctx.scene;
  const flip = player === 1;
  const gx = Math.round(from.x);
  const gy = Math.round(from.y);
  const tex = ghostTexture(sc, id);
  const grave = Raster.around(sc, gx, gy, 80, 44, DEPTH.SHADOW - 1, ADD);
  const flames = new Sparks(sc, unitDepth(gy) - 1, ADD);
  const mist = new Sparks(sc, DEPTH.FX + 1, ADD);
  let graveOn = 0;
  let burst = 0;
  let alive = true;
  const stopGrave = onFrame(sc, (dt, el) => {
    if (!alive) return false;
    burst = Math.max(0, burst - dt / 260);
    grave.draw((g) => {
      if (graveOn <= 0.01) return;
      const r = 18 + Math.sin(el * 0.012) * 1.2 + burst * 10;
      g.ell(gx, gy, r, r / 2, PAL.cyan1, 0.5 * graveOn);
      g.ring(gx, gy, r, r / 2, burst > 0.5 ? PAL.white : PAL.cyan3, graveOn);
      g.ring(gx, gy, r * 0.62, r * 0.31, PAL.cyan4, graveOn * 0.8);
      for (let i = 0; i < 6; i++) {
        const a = el * 0.004 + (i / 6) * TAU;
        g.disc(gx + Math.cos(a) * r * 0.82, gy + Math.sin(a) * r * 0.41, 1, PAL.white, graveOn);
      }
    });
    if (dt > 0 && graveOn > 0.3 && rnd() < dt / 22)
      flames.add({ x: gx + rr(-13, 13), y: gy + rr(-3, 3), vy: rr(-46, -24), wobble: 9, life: rr(320, 560), ramp: [PAL.cyan4, PAL.cyan3, PAL.cyan2, PAL.cyan1], tex: rnd() < 0.3 ? TEX.px2 : TEX.px1 });
    return true;
  });
  // the grave bursts open
  graveOn = 1;
  burst = 1;
  ctx.sfx('revive', { volume: 0.9 });
  bg(floorRing(sc, gx, gy, { r0: 6, r1: fs(42), ms: 360, ramp: CYAN_FX, depth: DEPTH.SHADOW - 1 }));
  // (v2) the open grave's cyan light on the marble
  void lightFlash(sc, gx, gy - 10, PAL.cyan4, fs(36), 420, { floorY: gy, intensity: 1, ring: true });
  const graveLight = lightPool(sc, gx, gy, { color: PAL.cyan3, radius: fs(26), intensity: 0.8, anim: 'breathe', fadeIn: 120 });

  // ghost sprites (body + additive glow copy)
  let ghost: Phaser.GameObjects.Sprite | null = null;
  let glow: Phaser.GameObjects.Sprite | null = null;
  const fh = tex?.art.h ?? 48;
  if (tex) {
    const ox = (flip ? tex.art.w - tex.art.anchorX : tex.art.anchorX) / tex.art.w;
    const oy = tex.art.anchorY / tex.art.h;
    ghost = sc.add.sprite(gx, gy + fh, tex.key, 'g0').setOrigin(ox, oy).setFlipX(flip).setAlpha(0.82).setDepth(DEPTH.FX);
    glow = sc.add.sprite(gx, gy + fh, tex.key, 'g0').setOrigin(ox, oy).setFlipX(flip).setAlpha(0.25).setDepth(DEPTH.FX + 0.5).setBlendMode(ADD);
    ghost.play(tex.key);
    glow.play(tex.key);
  }
  const place = (x: number, y: number, ground: number | null) => {
    for (const s of [ghost, glow]) {
      if (!s || !tex) continue;
      s.setPosition(Math.round(x), Math.round(y));
      if (ground !== null) {
        const keep = Math.round(tex.art.anchorY - (y - ground));
        s.setCrop(0, 0, tex.art.w, Math.max(0, keep));
        s.setVisible(keep > 0);
      } else s.setCrop();
    }
  };
  // destination circle opens while the ghost travels
  const dest = createMagicCircle(sc, to.x, to.y, { attribute: 'LIGHT', player, ramp: CYAN, appearMs: 240 });

  // ---- rise out of the pile (crop at the floor line)
  const lift = 20;
  await run(sc, tm.rise ?? 200, (t, el) => {
    const k = E.outCubic(t);
    place(gx + Math.sin(el * 0.02) * 1.2, gy + (1 - k) * fh * 0.95 - k * lift, gy);
    if (rnd() < 0.6) mist.add({ x: gx + rr(-10, 10), y: gy - rr(0, 4), vy: rr(-34, -12), life: rr(260, 420), ramp: [PAL.white, PAL.cyan4, PAL.cyan3], flicker: true });
  });
  place(gx, gy - lift, null);
  onLeave();

  // ---- float along an arc to the tile, afterimages trailing
  const start = { x: gx, y: gy - lift };
  const end = { x: to.x, y: to.y - 16 };
  // v2: the graveyards sit on the outer pads, far from the zones — the flight takes its time and
  // arcs higher over the long way (v1 keeps its authored 320 ms / 46 px)
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const FLOAT = tm.float ?? (ARENA_V2 ? Math.round(Math.min(560, Math.max(320, 200 + dist * 1.1))) : 320);
  const ctrl = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - (ARENA_V2 ? Math.round(Math.min(80, 46 + dist * 0.1)) : 46) };
  ctx.sfx('whoosh', { volume: 0.4, pitch: 0.7 });
  let lastEcho = -999;
  // the ghost carries a soft cyan light along the floor
  const ghostLight = lightPool(sc, start.x, start.y - fh * 0.4, { color: PAL.cyan3, radius: fs(20), floorY: gy, air: 0.45, airRadius: 18, intensity: 0.7, anim: 'breathe', fadeIn: 80 });
  void graveLight.fadeOut(360);
  await run(sc, FLOAT, (t, el) => {
    const p = qbez(start, ctrl, end, E.inOutSine(t));
    if (ghostLight.alive) ghostLight.setPosition(p.x, p.y - fh * 0.4, lerp(gy, to.y, E.inOutSine(t)));
    place(p.x, p.y + Math.sin(el * 0.02) * 1.5, null);
    if (ghost && el - lastEcho > 45) {
      lastEcho = el;
      const echo = sc.add
        .image(ghost.x, ghost.y, ghost.texture.key, ghost.frame.name)
        .setOrigin(ghost.originX, ghost.originY)
        .setFlipX(flip)
        .setAlpha(0.4)
        .setTint(PAL.cyan2)
        .setDepth(DEPTH.FX - 1)
        .setBlendMode(ADD);
      bg(run(sc, 220, (u) => echo.setAlpha(u < 0.4 ? 0.4 : u < 0.75 ? 0.22 : 0.1)).then(() => echo.destroy()));
    }
    mist.add({ x: p.x + rr(-8, 8), y: p.y - rr(0, fh * 0.5), vx: rr(-10, 10), vy: rr(-12, 6), life: rr(260, 440), ramp: [PAL.cyan4, PAL.cyan3, PAL.cyan2], flicker: true });
  });
  graveOn = 0;
  // ---- settle over the tile
  if ((tm.settle ?? 60) > 0) await run(sc, tm.settle ?? 60, (t) => place(end.x, end.y + Math.sin(Math.PI * t) * 2, null));
  void ghostLight.fadeOut(260);

  return {
    async melt(ms = 220) {
      dest.pulse(120);
      await run(sc, ms, (t) => {
        const a = t < 0.3 ? 0.9 : t < 0.6 ? 0.55 : 0.2;
        for (const s of [ghost, glow]) {
          if (!s) continue;
          // v3: the ghost thins into cyan (no full-body white flash over the re-forming body)
          s.setTintFill(LOOK_V3 ? (t < 0.3 ? PAL.cyan4 : PAL.cyan3) : PAL.white).setAlpha(s === glow ? a * 0.5 : LOOK_V3 ? a * 0.7 : a);
          s.setY(Math.round(end.y + E.inQuad(t) * 10));
          // v3: no fractional squash (the body takes over from the ghost)
          if (!LOOK_V3) s.setScale(1 + t * 0.15, 1 - t * 0.1);
        }
      });
      ghost?.destroy();
      glow?.destroy();
      alive = false;
      stopGrave();
      grave.destroy();
      flames.close();
      mist.close();
      bg(dest.dismiss(320));
    },
  };
}

/** (v2) The cyan pillar's light: a column glow behind the tile's unit + a bright pool on the marble. */
function pillarLight(sc: Phaser.Scene, home: XY): void {
  void lightFlash(sc, home.x, home.y - 30, PAL.cyan4, fs(48), 560, { floorY: home.y, ring: true, intensity: 1.2, air: 0.4 });
  bg(lightBeam(sc, { x: home.x, y: home.y - 150 }, { x: home.x, y: home.y - 4 }, PAL.cyan4, 360, { width: 20, depth: unitDepth(home.y) - 1.5, intensity: 0.9 }).done);
}

/** QA switch (?recall=generic): the old generic cyan rematerialization instead of the signature entrance. */
function recallStyle(): 'signature' | 'generic' {
  try {
    if (new URLSearchParams(location.search).get('recall') === 'generic') return 'generic';
  } catch {
    /* no location (tests) */
  }
  return 'signature';
}

/** Stats of the revived monster right after its summon event. */
function statsAt(s: GameState, uid: Uid, id: CardId): { atk: number; def: number } {
  const d = CARDS[id];
  const base = isMonster(d) ? { atk: d.atk, def: d.def } : { atk: 0, def: 0 };
  try {
    return { atk: currentAtk(s, uid), def: currentDef(s, uid) };
  } catch {
    return base;
  }
}

/** The cyan pillar turns the ghost into a full special summon (hologram reveal, roar, badge). */
async function rematerialize(ctx: AnyCtx, ev: Extract<GameEvent, { type: 'summon' }>, ghost: Ghost, stats: { atk: number; def: number }): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const home = zoneXY(ev.player, 'monster', ev.zone);
  const tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, true, 'up');
  tile.tileFlash(PAL.cyan3, 380);
  tile.ringBurst(PAL.cyan4, 380);
  const unit: MonsterUnit | null = field.addUnit(ev.uid, { hidden: true, atk: stats.atk, def: stats.def, position: 'attack' });
  // the pillar slams up through the ghost
  ctx.sfx('summonBurst', { volume: 0.9 });
  const pillar = createPillar(sc, home.x, home.y, { attribute: 'LIGHT', ramp: CYAN, style: 'beam', height: 150, width: 20, riseMs: 100 });
  bg(shockwave(sc, home.x, home.y, { ramp: CYAN, radius: fs(44), ms: 360 }));
  pillarLight(sc, home);
  void shake(sc, 120, 1);
  bg(ghost.melt(200));
  await wait(sc, 90);
  if (!unit) {
    await pillar.collapse(140);
    return;
  }
  unit.sprite.setPosition(unit.rest0.x, unit.rest0.y);
  // the reveal reaches the top → roar + impact (shockwave, dust, badge pop)
  let landed = false;
  const impact = () => {
    if (landed) return;
    landed = true;
    void unit.play('roar');
    ctx.sfx(fx.isAce(ev.cardId) ? 'roarBig' : 'roarSmall', { volume: 0.85 });
    bg(shockwave(sc, home.x, home.y, { ramp: CYAN, radius: fs(60), ms: 420, thickness: 7 }));
    void lightFlash(sc, home.x, home.y - 20, PAL.cyan4, fs(40), 420, { floorY: home.y, ring: true, intensity: 0.9 });
    bg(landingDust(sc, home.x, home.y, PAL.cyan3, { count: 8 }));
    void shake(sc, 150, 2);
    ctx.sfx('impactHeavy', { volume: 0.4 });
    if (fx.isAce(ev.cardId)) bg(flash(sc, 100, PAL.cyan4, 0.22));
    bg(unit.badge.pop());
  };
  ctx.sfx('materialize', { volume: 0.8 });
  const mat = materialize(sc, unit.sprite, { ramp: CYAN, ms: 420, onRevealed: impact });
  unit.showSprite();
  // the column pinches out as the scan reaches the top of the body
  await wait(sc, 280);
  pillar.pulse(80);
  bg(pillar.collapse(110));
  await mat;
  impact();
  unit.show();
}

/**
 * The cyan pillar takes the ghost (tile, circle burst, shockwave, the ghost melts into the light)
 * and pinches out — the stage for the revived monster's OWN signature entrance, which the caller
 * then plays through its summon hook. Resolves as the pillar starts to collapse.
 */
async function pillarHandoff(ctx: AnyCtx, ev: Extract<GameEvent, { type: 'summon' }>, ghost: Ghost): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const home = zoneXY(ev.player, 'monster', ev.zone);
  // the tile is placed now (cyan), so the summon hook only refreshes it (no card flight)
  if (!field.tileOf(ev.uid)) {
    const tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, true, 'up');
    tile.tileFlash(PAL.cyan3, 380);
    tile.ringBurst(PAL.cyan4, 380);
  }
  ctx.sfx('summonBurst', { volume: 0.9 });
  const pillar = createPillar(sc, home.x, home.y, { attribute: 'LIGHT', ramp: CYAN, style: 'beam', height: 150, width: 20, riseMs: 100 });
  bg(shockwave(sc, home.x, home.y, { ramp: CYAN, radius: fs(44), ms: 360 }));
  pillarLight(sc, home);
  void shake(sc, 120, 1);
  bg(ghost.melt(200));
  await wait(sc, 160);
  pillar.pulse(80);
  bg(pillar.collapse(170));
  await wait(sc, 40);
}

registerCardHook('soul_recall', 'activate', async (ctx) => {
  const ev = ctx.ev;
  const field = ctx.views.field;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const tEv = evAt(ctx, ti, 'target');
  const si = idxOf(ctx, run0, (e) => e.type === 'summon' && e.from === 'graveyard');
  const sEv = evAt(ctx, si, 'summon');
  // v3: the revive pose is painted from now on, in the background (the opening comes first)
  if (LOOK_V3 && sEv && isMonster(CARDS[sEv.cardId])) warmPoses(sEv.cardId as MonsterId, sEv.player, ['revive']);
  const gi = idxOf(ctx, run0, (e) => e.type === 'toGraveyard' && e.from === 'resolved' && e.uid === ev.uid);
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: LOOK_V3 ? 120 : 260, setRelease: V3_A5_A ? 'flow' : undefined });
  const gUid = tEv?.graveyardUid;
  if (!tEv || !sEv || gUid === undefined || !isMonster(CARDS[sEv.cardId])) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  ctx.consumeAt(ti);
  if (LOOK_V3) return recallV3(ctx, { op, run0, si, sEv, gi, gUid });
  // the special summon itself is played below through its own summon hook (the revived monster's
  // signature entrance); it is only consumed here for the generic cyan rematerialization
  const signature = recallStyle() === 'signature';
  if (!signature) ctx.consumeAt(si);
  const owner = ctx.owner(gUid);
  const pile = field.pile(owner, 'graveyard');
  const gyAt = pile.topXY();
  const dest = zoneXY(sEv.player, 'monster', sEv.zone);
  const stats = statsAt(ctx.stateAt(si + 1), sEv.uid, sEv.cardId);
  bg(ctx.focus({ x: (gyAt.x + dest.x) / 2, y: Math.min(gyAt.y, dest.y) - 10 }, { zoom: 1.04, ms: 520, pan: 0.25 }));
  // the grave bursts open just as the orb dives in
  const DIVE = 200;
  let risen!: (g: { g: Promise<Ghost> }) => void;
  const ghostP = new Promise<{ g: Promise<Ghost> }>((r) => (risen = r));
  const rise = () =>
    risen({
      g: soulRise(ctx, gyAt, dest, sEv.cardId as MonsterId, sEv.player, () => {
        // the card leaves the pile as the ghost tears free
        const g = ctx.stateAt(si + 1).players[owner].graveyard;
        pile.set(g.length, g.length ? ctx.stateAt(si + 1).cards[g[g.length - 1]].cardId : null);
        pile.bump();
      }),
    });
  await op.release({ x: gyAt.x, y: gyAt.y - 4 }, { path: 'dive', lift: 30, ms: DIVE, ramp: CYAN_FX, onLaunch: () => bg(wait(ctx.scene, DIVE - 40).then(rise)) });
  bg(pile.flash(PAL.cyan4));
  const ghost = await (await ghostP).g;
  // the spent card heads for its graveyard while the pillar rises
  const send = sendResolved(ctx, gi, { x: dest.x, y: dest.y - 70 }, 200);
  if (signature) {
    await pillarHandoff(ctx, sEv, ghost);
    // the monster's own entrance (summon-a / summon-b hooks honour noCard + ghost: no card
    // flight, cyan tile flash); without a hook the default summon plays
    await ctx.play(si, { noCard: true, ghost: true });
  } else await rematerialize(ctx, sEv, ghost, stats);
  relax(ctx, 360);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  await send;
});

// ================================================================ the v3 look

type Opening = Awaited<ReturnType<typeof spellOpening>>;
type SummonEv = Extract<GameEvent, { type: 'summon' }>;

/** v3: the ghost's timings (shorter rise, a quick glide, no hover: the body takes over at once). */
const GHOST_V3 = { rise: 140, float: 200, settle: 0 };
/** v3: the revive pose's `land` the timings above are cut for (ms; the wyrm's). A later land shortens
 *  the glide by the difference, down to GHOST_FLOAT_MIN, so every revive stays ≤ 2.1 s (A0 §6.2 5). */
const REVIVE_LAND_REF = 330;
const GHOST_FLOAT_MIN = 140;

/** The ghost's timings for a monster: a revive pose that lands late gets a shorter glide. */
function ghostTimings(id: MonsterId): typeof GHOST_V3 {
  const art = monsterArt(id);
  const late = hasAnim(art, 'revive') ? Math.max(0, artMarkMs(art, 'revive', 'land') - REVIVE_LAND_REF) : 0;
  return { ...GHOST_V3, float: Math.max(GHOST_FLOAT_MIN, GHOST_V3.float - late) };
}

/** v3 (no revive pose): a ≤ 300 ms cyan rebuild of the body, bottom → top, then its true colours. */
function rebuild(sc: Phaser.Scene, u: MonsterUnit, ms = 280): Promise<void> {
  const s = u.sprite;
  u.rest();
  u.showSprite();
  const P = setHologram(s, { reveal: 0, scan: 1, glitch: 0.1, tint: PAL.cyan4, ramp: holoRamp(CYAN), tintMix: 0.85, gain: 0.75, flicker: 0.05, alpha: 1, white: 0, clipY: null });
  const rev = Math.round(ms * 0.6);
  return run(sc, ms, (_t, el) => {
    if (!s.active) return;
    if (el < rev) P.reveal = el / rev;
    else {
      P.reveal = 1;
      const k = Math.min(1, (el - rev) / Math.max(1, ms - rev));
      const step = Math.min(3, Math.floor(k * 3) + 1) / 3;
      P.white = step <= 1 / 3 ? 0.35 : 0;
      P.tintMix = 0.85 * (1 - step);
      P.scan = 1 - step;
    }
  }).then(() => {
    if (s.active) clearHologram(s);
  });
}

/** Angular shards of the body's matter skidding out along the floor on landing (two tones, no puffs). */
function landShards(sc: Phaser.Scene, x: number, y: number, ramp: Ramp): void {
  const sp = new PxSparks(sc, unitDepth(y) + 0.5);
  const n = fxCount(7, RM);
  for (let i = 0; i < n; i++) {
    // out to both sides along the floor plane, a few hopping toward the camera
    const side = i % 2 === 0 ? -1 : 1;
    const a = side < 0 ? Math.PI + rr(-0.35, 0.25) : rr(-0.25, 0.35);
    const v = rr(36, 74);
    sp.add({
      x: Math.round(x + side * rr(4, 10)),
      y: Math.round(y - rr(0, 3)),
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v * 0.5 - rr(30, 60),
      ay: 380,
      floor: Math.round(y + rr(1, 4)),
      bounce: 0.25,
      drag: 1.2,
      rot: rr(0, TAU),
      vrot: rr(-10, 10),
      life: rr(300, 440),
      colors: [ramp[3], ramp[2]],
      shape: 'shard',
      size: rr(2, 3),
      fadeAt: 1,
    });
  }
  sp.release();
}

/** Matter motes streaming from the ghost into the re-forming body (crisp pixels, the matter's tones). */
function gather(sc: Phaser.Scene, u: MonsterUnit, from: XY, ms: number): void {
  const ramp = matterRamp(u.cardId);
  const sp = new PxSparks(sc, u.sprite.depth + 0.5);
  const to = u.core();
  const n = fxCount(22, RM);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const sx = Math.round(from.x + Math.cos(a) * rr(8, 20));
    const sy = Math.round(from.y + Math.sin(a) * rr(6, 14));
    sp.add({ x: sx, y: sy, tx: Math.round(to.x + rr(-8, 8)), ty: Math.round(to.y + rr(-12, 10)), curl: rr(-14, 14), delay: rr(0, ms * 0.35), life: rr(ms * 0.45, ms * 0.65), colors: [ramp[2], ramp[3], ramp[4], PAL.white], shape: i % 4 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sp.release();
}

// ---------------------------------------------------------------- the v3 ghost
//
// The soul is an OPAQUE palette silhouette of the monster's idle loop (A2 art review r2 #1: the old
// ghost was a 0.82-alpha sprite + an additive glow copy + additive echoes — a translucent smear with
// the board showing through and ~1000 blended colours). Every pixel is one of five palette tones:
//   1-px night outline (night0) · lit plane cyan4 · shadow plane cyan2 · deep shadow / inner lines
//   cyan0 — the planes cut from the art's own values (luminance percentiles of idle f0, so a dark
//   monster keeps a lit plane too).
// A2 art review r3 #1: no dither used as a transparency gradient anywhere on the ghost (the old 4×4
// ordered dither of the tail, the checker echoes and the dithered melt read as a noisy 50 % checker
// cloud). What breaks up does so in hard-edged 3×3 CLUSTERS (fixed per cell, frame space: they
// travel with the body, never crawl):
//   - the tail: the lowest ~third of the body loses whole clusters, more toward the bottom;
//   - the echoes: one stepped silhouette at a time behind it — solid, two tones (cyan1 / cyan0),
//     for one beat;
//   - the melt at arrival: a row sweep from the head down — every cluster above the sweep line is
//     gone, the clusters of the band at the line drop out by their fixed rank, the rest holds; two
//     tones a step (the outline opens), sinking 2 px a step into the body gathering below.

/** Tones of a ghost mask cell: 0 empty · 1 outline · 2 lit · 3 shadow · 4 deep. */
const GHOST_TONE = [0, PAL.night0, PAL.cyan4, PAL.cyan2, PAL.cyan0] as const;
/** The echo: tones per mask tone (two tones, solid). */
const ECHO_TONES = [[0, PAL.cyan0, PAL.cyan1, PAL.cyan1, PAL.cyan0]] as const;
/** Melt steps: where the sweep line stands (share of the body's height from its top) and the two tones. */
const MELT_SWEEP = [0.3, 0.6, 0.9] as const;
const MELT_TONES = [
  [0, PAL.cyan2, PAL.cyan4, PAL.cyan2, PAL.cyan2],
  [0, PAL.cyan1, PAL.cyan3, PAL.cyan1, PAL.cyan1],
  [0, PAL.cyan0, PAL.cyan2, PAL.cyan0, PAL.cyan0],
] as const;
/** Cluster size (px) of everything that breaks up. */
const CLUSTER = 3;
/** Rows (in clusters) of the melt's sweep band, where clusters drop out by rank. */
const SWEEP_BAND = 2;

/** Fixed rank in [0, 1) of the 3×3 cluster holding frame pixel (x, y) (an integer hash, no RNG). */
function clusterRank(x: number, y: number): number {
  let h = Math.imul(Math.floor(x / CLUSTER) + 0x9e37, 0x85ebca6b) ^ Math.imul(Math.floor(y / CLUSTER) + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** The top row of the cluster holding frame row y. */
function clusterRow(y: number): number {
  return Math.floor(y / CLUSTER) * CLUSTER;
}

interface GhostSheetV3 {
  key: string;
  frames: number;
  w: number;
  h: number;
  anchorX: number;
  anchorY: number;
  /** Per frame: the tone of every pixel (GHOST_TONE index). */
  masks: Uint8Array[];
}

const ghostSheets = new Map<string, GhostSheetV3>();

/** The v3 ghost sheet of a monster (P2 with a relight art: drawn lit from the frame's right). */
function ghostSheetV3(sc: Phaser.Scene, id: MonsterId, relight: boolean): GhostSheetV3 | null {
  const key = `set:ghost3:${id}${relight ? ':r' : ''}`;
  const hit = ghostSheets.get(key);
  if (hit && sc.textures.exists(key) && sc.anims.exists(key)) return hit;
  try {
    const art = monsterArt(id);
    const spec = art.anims.idle;
    const W = art.w;
    const H = art.h;
    const o = relight ? ({ lightFrom: 'right' } as const) : undefined;
    const lum = (c: number) => (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255;
    // the planes: cut at the art's own value percentiles (≈ half lit, a sixth deep)
    const f0 = monsterFrame(id, 'idle', 0, o);
    const ls: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = f0.get(x, y);
        if (c !== null && c !== PAL.ink) ls.push(lum(c));
      }
    ls.sort((a, b) => a - b);
    const t1 = ls.length ? ls[Math.floor(ls.length * 0.5)] : 0.6;
    const t2 = ls.length ? ls[Math.floor(ls.length * 0.17)] : 0.25;
    const masks: Uint8Array[] = [];
    const sheet = new PixelCanvas(W * spec.frames, H);
    for (let f = 0; f < spec.frames; f++) {
      const src = monsterFrame(id, 'idle', f, o);
      const m = new Uint8Array(W * H);
      const b = src.bounds();
      if (b) {
        for (let y = 0; y < H; y++) {
          // the lower body thins out by whole clusters (the last ~third of the body; a cluster's
          // share is read at its own top row, so it stays whole)
          const v = (clusterRow(y) + 1 - b.y) / Math.max(1, b.h);
          const keep = v < 0.7 ? 1 : 1 - (v - 0.7) / 0.34;
          for (let x = 0; x < W; x++) {
            const c = src.get(x, y);
            if (c === null || clusterRank(x, y) >= keep) continue;
            const edge = !src.isOpaque(x - 1, y) || !src.isOpaque(x + 1, y) || !src.isOpaque(x, y - 1) || !src.isOpaque(x, y + 1);
            const t = edge ? 1 : c === PAL.ink ? 4 : lum(c) >= t1 ? 2 : lum(c) >= t2 ? 3 : 4;
            m[y * W + x] = t;
            sheet.set(f * W + x, y, GHOST_TONE[t]);
          }
        }
      }
      masks.push(m);
    }
    if (sc.textures.exists(key)) sc.textures.remove(key);
    const tex = sc.textures.addCanvas(key, sheet.toCanvas())!;
    for (let f = 0; f < spec.frames; f++) tex.add(`g${f}`, 0, f * W, 0, W, H);
    if (!sc.anims.exists(key)) {
      const fr = Array.from({ length: spec.frames }, (_, f) => (holdOf(spec, f) ? { key, frame: `g${f}`, duration: holdOf(spec, f) } : { key, frame: `g${f}` }));
      sc.anims.create({ key, frames: fr, frameRate: spec.fps, repeat: -1 });
    }
    const gs: GhostSheetV3 = { key, frames: spec.frames, w: W, h: H, anchorX: art.anchorX, anchorY: art.anchorY, masks };
    ghostSheets.set(key, gs);
    return gs;
  } catch (e) {
    console.warn('[soul_recall] v3 ghost sheet failed', e);
    return null;
  }
}

/**
 * Stepped variants of one ghost frame (cells `v0`…): the echo steps or the melt steps (see the
 * section header). Made on first use (one frame, a few ms) and cached with the sheet.
 */
function ghostVariant(sc: Phaser.Scene, gs: GhostSheetV3, f: number, kind: 'echo' | 'melt'): string {
  const key = `${gs.key}:${kind}${f}`;
  if (sc.textures.exists(key)) return key;
  const steps = kind === 'echo' ? ECHO_TONES.length : MELT_TONES.length;
  const W = gs.w;
  const pc = new PixelCanvas(W * steps, gs.h);
  const m = gs.masks[f] ?? gs.masks[0];
  // the body's rows (for the melt's sweep)
  let top = gs.h;
  let bottom = -1;
  for (let y = 0; y < gs.h; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const span = Math.max(1, bottom - top + 1);
  for (let s = 0; s < steps; s++) {
    const line = top + span * (kind === 'melt' ? MELT_SWEEP[s] : 0);
    for (let y = 0; y < gs.h; y++) {
      const row = clusterRow(y);
      for (let x = 0; x < W; x++) {
        const t = m[y * W + x];
        if (!t) continue;
        let c: number;
        if (kind === 'echo') c = ECHO_TONES[s][t];
        else {
          // above the sweep band: gone; in it: clusters drop out by rank, deeper ones later
          if (row + CLUSTER <= line - SWEEP_BAND * CLUSTER) continue;
          if (row < line) {
            const k = (line - row) / (SWEEP_BAND * CLUSTER);
            if (clusterRank(x, y) < k) continue;
          }
          c = MELT_TONES[s][t];
        }
        if (c) pc.set(s * W + x, y, c);
      }
    }
  }
  const tex = sc.textures.addCanvas(key, pc.toCanvas())!;
  for (let s = 0; s < steps; s++) tex.add(`v${s}`, 0, s * W, 0, W, gs.h);
  return key;
}

/**
 * v3: the destination circle — opaque iso rings on the tile (no translucent pool, no mixed tones):
 * it opens in three radius steps, six white runes orbit, pulse() lifts the rings one palette step,
 * dismiss() closes it in three steps.
 */
function tileCircleV3(sc: Phaser.Scene, x: number, y: number): { pulse(ms: number): void; dismiss(ms: number): Promise<void> } {
  const R = 30;
  const ras = Raster.around(sc, Math.round(x), Math.round(y), R * 2 + 10, R + 10, DEPTH.TILE_FX);
  const cx = Math.round(x);
  const cy = Math.round(y);
  let k = 0; // 0..3 radius steps
  let hi = 0;
  let closing = false;
  let el = 0;
  const stop = onFrame(sc, (dt) => {
    el += dt;
    if (!closing) k = Math.min(3, Math.floor(el / 80) + 1);
    if (hi > 0) hi = Math.max(0, hi - dt);
    ras.draw((g) => {
      if (k <= 0) return;
      const r = Math.round((R * k) / 3);
      const ry = Math.max(1, Math.round(r / 2));
      const lit = hi > 0;
      g.ring(cx, cy, r + 2, ry + 1, PAL.cyan0, 1);
      g.ring(cx, cy, r, ry, lit ? PAL.cyan4 : PAL.cyan3, 1);
      if (k >= 2) g.ring(cx, cy, Math.round(r * 0.6), Math.round(ry * 0.6), lit ? PAL.cyan3 : PAL.cyan2, 1);
      if (k >= 3)
        for (let i = 0; i < 6; i++) {
          // the runes step around the ring (one whole-pixel position every 50 ms)
          const a = Math.floor(el / 50) * 0.12 + (i / 6) * TAU;
          g.px(Math.round(cx + Math.cos(a) * r * 0.8), Math.round(cy + Math.sin(a) * ry * 0.8), PAL.white);
        }
    });
    return true;
  });
  return {
    pulse(ms: number) {
      hi = ms;
    },
    async dismiss(ms: number) {
      closing = true;
      const step = Math.max(17, Math.round(ms / 3));
      for (let s = 2; s >= 0; s--) {
        k = Math.min(k, s);
        await wait(sc, step);
      }
      stop();
      ras.destroy();
    },
  };
}

/**
 * v3 soulRise: the grave opens (opaque rings, crisp spirit flames), the opaque ghost rises out of
 * the pile (cropped by the floor) and glides to the tile with 1–2 stepped echoes behind it. No
 * alpha, no blend mode, no soft light over the body (the floor lights are the stepped layer's).
 */
async function soulRiseV3(ctx: AnyCtx, from: XY, to: XY, id: MonsterId, player: PlayerId, onLeave: () => void, tm: { rise?: number; float?: number; settle?: number } = {}): Promise<Ghost> {
  const sc = ctx.scene;
  const flip = player === 1;
  const gx = Math.round(from.x);
  const gy = Math.round(from.y);
  const art = monsterArt(id);
  const gs = ghostSheetV3(sc, id, flip && art.p2 === 'relight');
  const grave = Raster.around(sc, gx, gy, 80, 44, DEPTH.SHADOW - 1);
  const flames = new PxSparks(sc, unitDepth(gy) - 1);
  const mist = new PxSparks(sc, DEPTH.FX - 2);
  let graveOn = 0;
  let burst = 0;
  let alive = true;
  const stopGrave = onFrame(sc, (dt, el) => {
    if (!alive) return false;
    burst = Math.max(0, burst - dt / 260);
    grave.draw((g) => {
      if (graveOn <= 0.01) return;
      // whole-pixel radii; the fill and the rings are solid
      const r = Math.round(18 + Math.sin(el * 0.012) * 1.2 + burst * 10);
      // (A2 art review r3 #1: a solid pit, no 50 % dither field)
      g.ell(gx, gy, r, Math.round(r / 2), PAL.cyan0, 1);
      g.ring(gx, gy, r, Math.round(r / 2), burst > 0.5 ? PAL.white : PAL.cyan3, 1);
      g.ring(gx, gy, Math.round(r * 0.62), Math.round(r * 0.31), PAL.cyan4, 1);
      for (let i = 0; i < 6; i++) {
        const a = el * 0.004 + (i / 6) * TAU;
        g.px(Math.round(gx + Math.cos(a) * r * 0.82), Math.round(gy + Math.sin(a) * r * 0.41), PAL.white);
      }
    });
    if (dt > 0 && graveOn > 0.3 && rnd() < dt / (RM ? 52 : 26))
      flames.add({ x: gx + Math.round(rr(-13, 13)), y: gy + Math.round(rr(-3, 3)), vx: rr(-4, 4), vy: rr(-46, -24), life: rr(320, 520), colors: [PAL.cyan4, PAL.cyan3, PAL.cyan2, PAL.cyan1], shape: 'px', fadeAt: 1 });
    return true;
  });
  // the grave bursts open
  graveOn = 1;
  burst = 1;
  // a monster with its own revive voice (_v3/sound.ts) gathers in it at the tile: the generic
  // revive swell opens the grave and fades as the ghost arrives — its bell crest (≈ 1 s in) never
  // rings over the body's own gather / land (sound QA #9: 89 % of the gather window, a second
  // accent 14 frames after the land)
  // A5-A (A-7): the spell's own grave opening (recallOpen: a hollow low voice + one soft bell) instead
  // of the shared 'revive' swell; with a voiced monster it fades as the ghost leaves, the same way
  const graveSnd = V3_A5_A ? 'recallOpen' : 'revive';
  const reviveSnd = soundsOf(id) ? startV3(graveSnd, { volume: V3_A5_A ? 0.9 : 0.75, pan: V3_A5_A ? panAt(gx) : undefined }) : null;
  if (!reviveSnd) {
    if (V3_A5_A) playV3('recallOpen', { volume: 0.9, pan: panAt(gx) });
    else ctx.sfx('revive', { volume: 0.9 });
  }
  bg(floorRing(sc, gx, gy, { r0: 6, r1: fs(42), ms: 360, ramp: CYAN_FX, depth: DEPTH.SHADOW - 1 }));
  void lightFlash(sc, gx, gy - 10, PAL.cyan4, fs(36), 420, { floorY: gy, intensity: 1, ring: true });
  const graveLight = lightPool(sc, gx, gy, { color: PAL.cyan3, radius: fs(26), intensity: 0.8, anim: 'breathe', fadeIn: 120 });

  // ---- the ghost: one opaque sprite (no glow copy)
  let ghost: Phaser.GameObjects.Sprite | null = null;
  const fh = gs?.h ?? 48;
  if (gs) {
    const ox = (flip ? gs.w - gs.anchorX : gs.anchorX) / gs.w;
    const oy = gs.anchorY / gs.h;
    ghost = sc.add.sprite(gx, gy + fh, gs.key, 'g0').setOrigin(ox, oy).setFlipX(flip).setDepth(DEPTH.FX);
    ghost.play(gs.key);
  }
  const frameIdx = (): number => (ghost ? Number(String(ghost.frame.name).slice(1)) || 0 : 0);
  const place = (x: number, y: number, ground: number | null) => {
    if (!ghost || !gs) return;
    ghost.setPosition(Math.round(x), Math.round(y));
    if (ground !== null) {
      const keep = Math.round(gs.anchorY - (y - ground));
      ghost.setCrop(0, 0, gs.w, Math.max(0, keep));
      ghost.setVisible(keep > 0);
    } else ghost.setCrop();
  };
  const dest = tileCircleV3(sc, to.x, to.y);
  /** Wisps from the dithered tail (behind the body, crisp pixels). */
  const wisp = (x: number, y: number) =>
    mist.add({ x: Math.round(x + rr(-9, 9)), y: Math.round(y - rr(0, 5)), vx: rr(-8, 8), vy: rr(-14, 4), life: rr(200, 320), colors: [PAL.cyan3, PAL.cyan2, PAL.cyan1], shape: 'px', fadeAt: 1 });

  // ---- rise out of the pile (cropped at the floor line)
  const lift = 20;
  await run(sc, tm.rise ?? 200, (t, el) => {
    const k = E.outCubic(t);
    place(gx + Math.round(Math.sin(el * 0.02)), gy + (1 - k) * fh * 0.95 - k * lift, gy);
    if (rnd() < (RM ? 0.25 : 0.5)) wisp(gx, gy);
  });
  place(gx, gy - lift, null);
  onLeave();
  // (the generic swell is the grave's: it fades as the ghost leaves it)
  reviveSnd?.stop(240);

  // ---- glide along an arc to the tile, a stepped echo behind
  const start = { x: gx, y: gy - lift };
  const end = { x: Math.round(to.x), y: Math.round(to.y - 16) };
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const FLOAT = tm.float ?? Math.round(Math.min(560, Math.max(320, 200 + dist * 1.1)));
  const ctrl = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - Math.round(Math.min(80, 46 + dist * 0.1)) };
  // A5-A (A-7): the soul's glide has the spell's own sound (recallGlide), panned to the glide's middle
  if (V3_A5_A) playV3('recallGlide', { volume: 0.85, pan: panAt((start.x + end.x) / 2) });
  else ctx.sfx('whoosh', { volume: 0.4, pitch: 0.7 });
  const ghostLight = lightPool(sc, start.x, start.y, { color: PAL.cyan3, radius: fs(20), floorY: gy, intensity: 0.6, fadeIn: 80 });
  void graveLight.fadeOut(360);
  const ECHO_EVERY = 80;
  const ECHO_STEP = 60;
  let lastEcho = -999;
  await run(sc, FLOAT, (t, el) => {
    const p = qbez(start, ctrl, end, E.inOutSine(t));
    if (ghostLight.alive) ghostLight.setPosition(p.x, lerp(gy, to.y, E.inOutSine(t)), lerp(gy, to.y, E.inOutSine(t)));
    place(p.x, p.y + Math.round(Math.sin(el * 0.02) * 1.5), null);
    if (ghost && gs && el - lastEcho >= ECHO_EVERY && t < 0.9) {
      lastEcho = el;
      const vk = ghostVariant(sc, gs, frameIdx(), 'echo');
      const echo = sc.add.image(ghost.x, ghost.y, vk, 'v0').setOrigin(ghost.originX, ghost.originY).setFlipX(flip).setDepth(DEPTH.FX - 1);
      bg(wait(sc, ECHO_STEP).then(() => echo.destroy()));
    }
    if (rnd() < (RM ? 0.25 : 0.5)) wisp(p.x, p.y);
  });
  graveOn = 0;
  if ((tm.settle ?? 0) > 0) await run(sc, tm.settle ?? 0, (t) => place(end.x, end.y + Math.round(Math.sin(Math.PI * t) * 2), null));
  void ghostLight.fadeOut(200);
  reviveSnd?.stop(180);

  return {
    async melt(ms = 160) {
      dest.pulse(120);
      if (ghost && gs) {
        // the ghost breaks up in three swept cluster steps, sinking into the body gathering below it
        const vk = ghostVariant(sc, gs, frameIdx(), 'melt');
        ghost.anims.stop();
        ghost.setTexture(vk, 'v0');
        const step = Math.max(17, Math.round(ms / MELT_SWEEP.length));
        for (let s = 0; s < MELT_SWEEP.length; s++) {
          if (!ghost.active) break;
          ghost.setFrame(`v${s}`).setY(end.y + 2 * s);
          await wait(sc, step);
        }
      } else await wait(sc, ms);
      ghost?.destroy();
      alive = false;
      stopGrave();
      grave.destroy();
      flames.release();
      mist.release();
      bg(dest.dismiss(320));
    },
  };
}

/**
 * v3 Ruh Çağrısı (see the header): the ghost glides to the tile and the body reassembles there —
 * on its `revive` pose when the art has one, else a short cyan rebuild. The summon event is
 * consumed (never the entrance replayed); the spent card leaves once the body has re-formed.
 */
async function recallV3(ctx: CinematicContext<Extract<GameEvent, { type: 'activate' }>>, o: { op: Opening; run0: number[]; si: number; sEv: SummonEv; gi: number; gUid: Uid }): Promise<void> {
  const { op, si, sEv, gi, gUid } = o;
  const sc = ctx.scene;
  const field = ctx.views.field;
  ctx.consumeAt(si);
  const owner = ctx.owner(gUid);
  const pile = field.pile(owner, 'graveyard');
  const gyAt = pile.topXY();
  const dest = zoneXY(sEv.player, 'monster', sEv.zone);
  const stats = statsAt(ctx.stateAt(si + 1), sEv.uid, sEv.cardId);
  bg(ctx.focus({ x: (gyAt.x + dest.x) / 2, y: Math.min(gyAt.y, dest.y) - 10 }, { zoom: 1.03, ms: 420, pan: 0.22 }));
  // ---- the energy dives into the grave; the ghost tears free and glides to the tile
  const DIVE = 180;
  let risen!: (g: { g: Promise<Ghost> }) => void;
  const ghostP = new Promise<{ g: Promise<Ghost> }>((r) => (risen = r));
  const rise = () =>
    risen({
      g: soulRiseV3(
        ctx,
        gyAt,
        dest,
        sEv.cardId as MonsterId,
        sEv.player,
        () => {
          const g = ctx.stateAt(si + 1).players[owner].graveyard;
          pile.set(g.length, g.length ? ctx.stateAt(si + 1).cards[g[g.length - 1]].cardId : null);
          pile.bump();
        },
        ghostTimings(sEv.cardId as MonsterId),
      ),
    });
  await op.release({ x: gyAt.x, y: gyAt.y - 4 }, { path: 'dive', lift: 30, ms: DIVE, ramp: CYAN_FX, onLaunch: () => bg(wait(sc, DIVE - 40).then(rise)) });
  bg(pile.flash(PAL.cyan4));
  const ghost = await (await ghostP).g;
  // ---- arrival: the revived card is born on its tile; the ghost breaks into the body
  // (the tile's own flash / ring burst are additive washes: the stepped circle pulses instead)
  field.placeCard(sEv.player, 'monster', sEv.zone, sEv.uid, sEv.cardId, true, sEv.position === 'defense' ? 'side' : 'up');
  // a monster with its own revive sounds (_v3/sound.ts) gathers in its own voice from here (the
  // generic 'materialize' only without one: below, once the pose is known — same frame)
  const voice = soundsOf(sEv.cardId);
  void lightFlash(sc, dest.x, dest.y - 12, PAL.cyan4, fs(34), 360, { floorY: dest.y, ring: true, intensity: 0.85 });
  bg(ghost.melt(120));
  const unit: MonsterUnit | null = field.addUnit(sEv.uid, { hidden: true, atk: stats.atk, def: stats.def, position: sEv.position });
  let landed!: () => void;
  const landP = new Promise<void>((r) => (landed = r));
  let revSound = false;
  const land = () => {
    bg(shockwave(sc, dest.x, dest.y, { ramp: CYAN, radius: fs(44), ms: 360, thickness: 4 }));
    void lightFlash(sc, dest.x, dest.y - 16, PAL.cyan4, fs(30), 300, { floorY: dest.y, ring: true, intensity: 0.7 });
    // A2 art review r3 #1: a few angular shards of the monster's own matter skid out along the
    // floor (no round, soft dust puffs under the rising body)
    landShards(sc, dest.x, dest.y, unit ? matterRamp(unit.cardId) : RAMPS.cyan);
    if (!revSound) ctx.sfx('impactLight', { volume: 0.55 });
    if (unit) {
      unit.badge.setVisible(true);
      bg(unit.badge.pop());
    }
    landed();
  };
  let body: Promise<void> = Promise.resolve();
  if (unit) {
    unit.badge.setVisible(false);
    unit.sprite.setPosition(unit.rest0.x, unit.rest0.y);
    const pose = summonPose(sc, unit, { anim: 'revive', ramp: matterRamp(unit.cardId), hologram: false, onLand: land });
    if (!(pose && voice)) ctx.sfx('materialize', { volume: voice ? 0.45 : 0.8 });
    if (pose && voice) {
      // the gathering (sustained) ends on the pose's own 'land' frame, where the body locks whole
      revSound = true;
      const pan = panAt(dest.x);
      const gather = startV3(voice.reviveGather, { volume: 1, pan });
      atMark(unit, 'revive', 'land', () => {
        gather.stop(40);
        playV3(voice.reviveLand, { volume: 0.9, pan });
      });
    }
    if (pose) {
      // the matter gathers back into the collapsed body while its pose re-forms it
      gather(sc, unit, { x: dest.x, y: dest.y - 16 }, pose.ms.land);
      // the stand is enough: the last breath plays on while the game moves on
      body = Promise.all([pose.land, wait(sc, 300)]).then(() => undefined);
    } else {
      gather(sc, unit, { x: dest.x, y: dest.y - 16 }, 260);
      body = rebuild(sc, unit, 280).then(land);
    }
  } else {
    ctx.sfx('materialize', { volume: voice ? 0.45 : 0.8 });
    land();
  }
  await landP;
  // ---- only now does the spent card leave (born on the grave its energy went into)
  const g = evAt(ctx, gi, 'toGraveyard');
  let send: Promise<void> = Promise.resolve();
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = fx.cardToGraveyard(ctx, { owner: g.owner, cardId: g.cardId, from: { x: gyAt.x, y: gyAt.y } });
  }
  await body;
  if (unit && !unit.retired) unit.show();
  relax(ctx, 300);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  await send;
}
