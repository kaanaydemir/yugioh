// DUEL FLOW — the opening (gameStart, ≤ 6 s) and the deck shuffle.
//
//   0.00 s  music starts low; the stadium towers ignite one by one while the camera, high in the
//           night sky, glides down onto the floating arena (CameraRig.descend).
//   0.95 s  a beam of light strikes each podium and the duelists materialize as holograms
//           (P1 cyan, then P2 crimson); both raise their duel disks.
//   1.50 s  a hologram coin appears over the middle of the board and is tossed: it flips end over
//           end, lands with a clink, bounces and settles on the first player's face. "OYUNCU n
//           BAŞLIYOR!" pops under it; the coin zips into that duelist as a comet while both
//           decks riffle-shuffle.
//   3.70 s  the HUD comes on, "DÜELLO!" slams in (banner shake) and four cards each are dealt in
//           alternating arcs into the hands (the opening ends ≈ 5.3 s).
//
// Any click / Enter / Space / Esc fast-forwards the rest of the opening (×4). With skipIntro
// (QA, "Tekrar Oyna") only a quick shuffle + deal plays.

import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL, PLAYER_RAMP, RAMPS } from '../../art/palette';
import { DEPTH, GAME_H, GAME_W, type XY, isoToScreen } from '../../view/layout';
import { pixelLetters, pixelText } from '../../ui/text';
import { duelStart } from '../../vfx/banners';
import { materialize } from '../../vfx/hologram';
import { shockwave, sparkleBurst } from '../../vfx/summon';
import { Raster, run } from '../../vfx/setpieces';
import { fx, registerEvent } from '../api';
import { COIN_N, INTENSITY, TAU, all, beamDrop, bg, clamp01, coinFrame, coinTexture, isoGhost, lerp, type AnyCtx, type Ctx, type EvOf } from './_kit';

type DrawEv = EvOf<'draw'>;

// ================================================================ skip (fast-forward)

interface Skipper {
  /** Fade the corner hint (the HUD comes on under it). */
  hideHint(): void;
  dispose(): void;
}

/** Click / key during the opening: run the rest at ×4. A small hint sits in the corner. */
function installSkip(ctx: AnyCtx): Skipper {
  const sc = ctx.scene;
  const speed = ctx.views.speed;
  const base0 = speed.base;
  const fast = base0 * 4;
  let skipped = false;
  const hint = pixelText(sc, GAME_W - 6, GAME_H - 6, 'Atlamak için tıkla', { size: 'sm', color: PAL.mist, originX: 1, originY: 1 })
    .setScrollFactor(0)
    .setDepth(DEPTH.HUD + 60)
    .setAlpha(0);
  const blink = sc.tweens.add({ targets: hint, alpha: { from: 0, to: 0.8 }, delay: 900, duration: 600, yoyo: true, hold: 900, repeat: -1, ease: 'Sine.InOut' });
  const go = () => {
    if (skipped) return;
    skipped = true;
    speed.setBase(fast);
    blink.stop();
    hint.setVisible(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape' || e.code === 'NumpadEnter') go();
  };
  sc.input.on('pointerdown', go);
  window.addEventListener('keydown', onKey);
  return {
    hideHint() {
      blink.stop();
      if (hint.active) void ctx.tween({ targets: hint, alpha: 0, duration: 200 });
    },
    dispose() {
      sc.input?.off('pointerdown', go);
      window.removeEventListener('keydown', onKey);
      blink.stop();
      hint.destroy();
      if (skipped && speed.base === fast) speed.setBase(base0);
    },
  };
}

// ================================================================ duelists

/** A beam strikes the podium and the duelist materializes as a hologram; then raises the disk. */
async function duelistEnter(ctx: AnyCtx, p: PlayerId): Promise<void> {
  const d = ctx.views.duelists?.get(p);
  if (!d) return;
  const sc = ctx.scene;
  const R = PLAYER_RAMP[p];
  const home = d.home;
  d.sprite.setVisible(false).setAlpha(1);
  ctx.sfx('summonBurst', { volume: 0.35, pitch: 1.35, pan: p === 0 ? -0.3 : 0.3 });
  let mat: Promise<void> = Promise.resolve();
  await beamDrop(sc, home.x, home.y, R, {
    dropMs: 120,
    holdMs: 260,
    outMs: 200,
    width: 13,
    depth: d.sprite.depth - 1,
    onHit: () => {
      ctx.sfx('materialize', { volume: 0.55, pan: p === 0 ? -0.3 : 0.3 });
      bg(shockwave(sc, home.x, home.y, { ramp: R, radius: 26, ms: 380, thickness: 4 }));
      mat = materialize(sc, d.sprite, { ramp: R, ms: 460 });
    },
  });
  await mat;
  d.rest();
}

/** Both duel disks come alive: the command pose + a glint on the disk arm. */
async function disksOn(ctx: AnyCtx): Promise<void> {
  const v = ctx.views;
  if (!v.duelists) return;
  ctx.sfx('cardSlide', { volume: 0.4, pitch: 1.3 });
  const jobs = ([0, 1] as PlayerId[]).map(async (p, i) => {
    await ctx.wait(i * 90);
    const d = v.duelists!.get(p);
    const c = d.chest();
    bg(d.play('command'));
    await ctx.wait(160);
    bg(sparkleBurst(ctx.scene, c.x + (p === 0 ? 7 : -7), c.y + 4, { ramp: PLAYER_RAMP[p], count: 8, depth: d.sprite.depth + 2 }));
  });
  await all(jobs);
}

// ================================================================ coin toss

const COIN_REST = 22; // hover height of the resting coin centre above the floor

/** Hologram coin: toss, flips end over end, clink + bounce, settles on the first player's face. */
async function coinToss(ctx: AnyCtx, first: PlayerId, onExit?: () => void): Promise<void> {
  const sc = ctx.scene;
  const key = coinTexture(sc);
  const C = isoToScreen(2, 2);
  const ground: XY = { x: Math.round(C.x), y: Math.round(C.y + 2) };
  const restY = ground.y - COIN_REST;
  const R = PLAYER_RAMP[first];
  const coin = sc.add.sprite(ground.x, restY, key, 0).setDepth(DEPTH.FX_TOP + 4);
  const shadow = new Raster(sc, ground.x - 24, ground.y - 6, 48, 12, DEPTH.TILE_FX + 4);
  const drawShadow = (h: number, lv: number) =>
    shadow.draw((g) => {
      const k = clamp01(1 - h / 110);
      g.ell(ground.x, ground.y, 6 + 10 * k, 2 + 2.5 * k, PAL.ink, lv * (0.35 + 0.45 * k));
    });
  drawShadow(COIN_REST, 1);
  bg(ctx.focus({ x: C.x, y: C.y - 28 }, { zoom: 1.06, ms: 420, pan: 0.3 }));
  // the coin is projected by the duel system: a quick hologram build
  ctx.sfx('holyChime', { volume: 0.35, pitch: 1.5 });
  bg(materialize(sc, coin, { ramp: RAMPS.gold, ms: 220, converge: true }));
  await ctx.wait(220);

  // toss — timeline (ms): up 400 (Quad.Out) · down 330 (Quad.In) · bounce 200 · settle
  const UP = 360;
  const DOWN = 300;
  const BOUNCE = 180;
  const SPIN = UP + DOWN + BOUNCE + 120;
  const H = 88;
  const turns = 5;
  const aEnd = TAU * turns + (first === 0 ? 0 : Math.PI);
  ctx.sfx('whoosh', { volume: 0.55, pitch: 1.4 });
  // anticipation: the coin dips before the throw
  await run(sc, 70, (t) => {
    coin.y = Math.round(restY + 3 * Math.sin(t * Math.PI * 0.5));
    coin.setScale(1 + 0.12 * t, 1 - 0.12 * t);
  });
  coin.setScale(1);
  let landed = false;
  let bounced = false;
  await run(sc, SPIN, (_t, el) => {
    // angle: fast at the throw, slowing to the result
    const s = clamp01(el / SPIN);
    const a = aEnd * (1 - Math.pow(1 - s, 3));
    coin.setFrame(coinFrame(a));
    let h = 0;
    if (el < UP) {
      const k = el / UP;
      h = H * (1 - (1 - k) * (1 - k));
    } else if (el < UP + DOWN) {
      const k = (el - UP) / DOWN;
      h = H * (1 - k * k);
    } else if (el < UP + DOWN + BOUNCE) {
      if (!landed) {
        landed = true;
        ctx.sfx('shieldBlock', { volume: 0.32, pitch: 1.9 });
        ctx.sfx('cardPlace', { volume: 0.4, pitch: 1.6 });
        bg(sparkleBurst(sc, ground.x, restY + 12, { ramp: RAMPS.gold, count: 6, depth: DEPTH.FX_TOP + 3 }));
      }
      const k = (el - UP - DOWN) / BOUNCE;
      h = 8 * Math.sin(Math.PI * k);
      // squash on contact, stretch on the rebound
      const sq = k < 0.18 ? 1 - k / 0.18 : 0;
      coin.setScale(1 + 0.18 * sq, 1 - 0.2 * sq);
    } else {
      if (!bounced) {
        bounced = true;
        ctx.sfx('cardPlace', { volume: 0.25, pitch: 1.9 });
      }
      coin.setScale(1);
    }
    coin.y = Math.round(restY - h);
    drawShadow(h + COIN_REST, 1);
  });
  coin.setFrame(first === 0 ? 0 : COIN_N / 2).setScale(1);
  coin.y = restY;

  // the result: flash, burst in the winner's colour, the name pops
  coin.setTintFill(PAL.white);
  void ctx.wait(60).then(() => coin.active && coin.clearTint());
  ctx.sfx('holyChime', { volume: 0.55, pitch: 1.1 });
  ctx.sfx('impactLight', { volume: 0.45, pitch: 1.2 });
  bg(sparkleBurst(sc, ground.x, restY, { ramp: R, count: 22, depth: DEPTH.FX_TOP + 5 }));
  bg(shockwave(sc, ground.x, ground.y, { ramp: R, radius: 44, ms: 420, thickness: 5 }));
  bg(run(sc, 160, (t) => coin.setScale(lerp(1.25, 1, t), lerp(0.85, 1, t))));
  const txt = pixelLetters(sc, ground.x, ground.y + 22, first === 0 ? 'OYUNCU 1 BAŞLIYOR!' : 'OYUNCU 2 BAŞLIYOR!', {
    size: 'lg',
    color: R[3],
    originX: 0.5,
    originY: 0.5,
    shadow: 1,
  });
  const letters = txt.letters;
  for (const l of letters) l.obj.setDepth(DEPTH.FX_TOP + 6).setAlpha(0);
  await run(sc, 14 * letters.length + 140, (_t, el) => {
    letters.forEach((l, i) => {
      const lt = el - i * 14;
      if (lt < 0) return;
      const k = clamp01(lt / 140);
      const sy = lt < 50 ? lerp(1.6, 0.75, lt / 50) : lerp(0.75, 1, clamp01((lt - 50) / 90));
      l.obj.setAlpha(1).setScale(lerp(1.25, 1, k), sy);
      l.obj.y = Math.round(l.y - (1 - k) * 6);
      l.obj.setTint(lt < 40 ? PAL.white : R[3]);
    });
  });
  for (const l of letters) l.obj.setScale(1).setPosition(l.x, l.y).setTint(R[3]);
  await ctx.wait(190);

  // exit: the coin becomes a comet into the first player's duelist; the line fades
  onExit?.();
  const d = ctx.views.duelists?.get(first);
  const to = d ? d.chest() : { x: ground.x, y: ground.y + (first === 0 ? 60 : -60) };
  bg(ctx.tween({ targets: letters.map((l) => l.obj), alpha: 0, duration: 220 }).then(() => letters.forEach((l) => l.obj.destroy())));
  bg(ctx.tween({ targets: shadow.img, alpha: 0, duration: 160 }).then(() => shadow.destroy()));
  ctx.sfx('whoosh', { volume: 0.4, pitch: 1.7 });
  bg(ctx.unfocus(360));
  await ctx.tween({ targets: coin, scaleX: 0.2, scaleY: 0.2, duration: 100, ease: 'Back.In' });
  const from = { x: coin.x, y: coin.y };
  coin.destroy();
  await fx.energyBolt(sc, from, to, R, 240);
  if (d) {
    bg(d.play('command'));
    ctx.sfx('lockOn', { volume: 0.35, pitch: 1.3 });
  }
}

// ================================================================ shuffle + deal

/** Riffle shuffle on each deck pile: the top half splits off both sides and interleaves back. */
export async function riffle(ctx: AnyCtx, players: PlayerId[], rounds = 2): Promise<void> {
  const sc = ctx.scene;
  ctx.sfx('shuffle', { volume: 0.8 });
  const jobs = players.map(async (p) => {
    const pile = ctx.views.field.pile(p, 'deck');
    if (pile.count <= 0) return;
    const top = pile.topXY();
    const depth = DEPTH.CARD_ON_TILE + 2;
    const a = isoGhost(sc, p, top, depth);
    const b = isoGhost(sc, p, top, depth + 0.01);
    for (let r = 0; r < rounds; r++) {
      await run(sc, 200, (t) => {
        // split → lift → swap sides → drop back in
        const out = Math.sin(Math.PI * t);
        const lift = Math.sin(Math.PI * Math.min(1, t * 1.25));
        a.setPosition(Math.round(top.x - 9 * out), Math.round(top.y - 2 - 5 * lift + 2 * out));
        b.setPosition(Math.round(top.x + 9 * out), Math.round(top.y - 4 - 6 * lift + 2 * out));
        b.setDepth(t < 0.5 ? depth + 0.01 : depth - 0.01);
      });
      pile.bump();
    }
    a.destroy();
    b.destroy();
  });
  await all(jobs);
}

/** Opening hands: alternating staggered arcs from the deck piles into the hands. */
async function deal(ctx: AnyCtx, draws: DrawEv[], step: number): Promise<void> {
  const v = ctx.views;
  const piles = { 0: v.field.pile(0, 'deck'), 1: v.field.pile(1, 'deck') };
  const counts = { 0: piles[0].count, 1: piles[1].count };
  const jobs = draws.map(async (d, i) => {
    await ctx.wait(i * step);
    const pile = piles[d.player];
    const from = pile.topXY();
    counts[d.player] = Math.max(0, counts[d.player] - 1);
    pile.set(counts[d.player], null);
    pile.bump();
    await v.hand.addCard(d.uid, d.cardId, { x: from.x, y: from.y - 4 }, d.player);
  });
  await all(jobs);
}

// ================================================================ gameStart

registerEvent(
  'gameStart',
  async (ctx: Ctx<'gameStart'>) => {
    const sc = ctx.scene;
    const v = ctx.views;
    // the opening owns the shuffles and the opening hands
    const draws: DrawEv[] = [];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e: GameEvent = ctx.events[i];
      if (e.type === 'shuffle') ctx.consumeAt(i);
      else if (e.type === 'draw' && e.initial) {
        draws.push(e);
        ctx.consumeAt(i);
      } else break;
    }
    if (ctx.settings.music) ctx.music.play('duel');
    if (ctx.skipIntro) {
      ctx.music.setIntensity(INTENSITY.calm);
      void v.board.setLights(true, false);
      v.hud.setVisible(true);
      v.duelists?.setVisible(true);
      await riffle(ctx, [0, 1], 1);
      await deal(ctx, draws, 70);
      return;
    }
    const skip = installSkip(ctx);
    try {
      ctx.music.setIntensity(INTENSITY.opening);
      v.hud.setVisible(false);
      v.duelists?.setVisible(false);
      // 1. lights + descent
      const lights = v.board.setLights(true, true);
      const descent = ctx.wait(120).then(() => v.camera.descend(1380, -300));
      // 2. the duelists arrive while the camera settles
      const entrance = (async () => {
        await ctx.wait(950);
        if (!v.duelists) return;
        v.duelists.setVisible(true);
        for (const p of [0, 1] as PlayerId[]) v.duelists.get(p).sprite.setVisible(false);
        const a = duelistEnter(ctx, 0);
        await ctx.wait(170);
        const b = duelistEnter(ctx, 1);
        await all([a, b]);
        await disksOn(ctx);
      })();
      await all([descent, ctx.wait(1500)]);
      // 3. the coin decides who starts
      let shuffled: Promise<void> = Promise.resolve();
      await coinToss(ctx, ctx.ev.firstPlayer, () => {
        // the decks riffle while the coin flies home (both are in view, before the banner)
        shuffled = riffle(ctx, [0, 1], 2);
      });
      // 4. "DÜELLO!" — the HUD comes on under its flash; the deal starts as the letters land
      v.hud.setVisible(true);
      skip.hideHint();
      ctx.music.setIntensity(INTENSITY.calm);
      const duel = duelStart(sc);
      await all([ctx.wait(420), shuffled]);
      await deal(ctx, draws, 80);
      await all([duel, lights, entrance]);
    } finally {
      skip.dispose();
      v.hud.setVisible(true);
      v.duelists?.setVisible(true);
      for (const p of [0, 1] as PlayerId[]) v.duelists?.get(p).sprite.setVisible(true);
    }
  },
  { name: 'flow:gameStart' },
);

registerEvent(
  'shuffle',
  async (ctx: Ctx<'shuffle'>) => {
    await riffle(ctx, [ctx.ev.player], 2);
  },
  { name: 'flow:shuffle' },
);

