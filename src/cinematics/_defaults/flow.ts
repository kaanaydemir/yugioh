// Default cinematics: duel flow (opening, shuffle, draw, turn, phase, decisions, deck-out, game over).
import Phaser from 'phaser';
import { PAL, PLAYER_COLOR, PLAYER_RAMP } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { GameEvent, PlayerId } from '../../engine/types';
import { pixelText } from '../../ui/text';
import { DEPTH, GAME_W } from '../../view/layout';
import { flash, shake, tween, wait } from '../../vfx/core';
import { dematerialize, glitch } from '../../vfx/hologram';
import { sparkleBurst } from '../../vfx/summon';
import { banner, duelStart, phaseBanner, turnBanner } from '../../vfx/banners';
import { DEFAULT_PRIORITY, registerEvent } from '../_core/registry';
import type { CinematicContext } from '../_core/types';
import { all } from '../_core/helpers';

const P = { priority: DEFAULT_PRIORITY };

type Ctx<T extends GameEvent['type']> = CinematicContext<Extract<GameEvent, { type: T }>>;

// ================================================================ opening

/** Pixel coin (both faces) for the first-player flip. */
function coinTexture(scene: Phaser.Scene, p: PlayerId): string {
  const key = `duel:coin:${p}`;
  if (scene.textures.exists(key)) return key;
  const S = 23;
  const c = new PixelCanvas(S, S);
  const R = PLAYER_RAMP[p];
  c.disc(11, 11, 11, PAL.gold1);
  c.disc(11, 11, 10, PAL.gold3);
  c.disc(11, 11, 8, PAL.gold2);
  c.disc(11, 11, 7, R[2]);
  c.disc(10, 10, 5, R[3]);
  // the player number
  const one = ['.#.', '##.', '.#.', '.#.', '###'];
  const two = ['##.', '..#', '.#.', '#..', '###'];
  c.stamp(p === 0 ? one : two, { '#': PAL.white }, 10, 9);
  c.set(6, 5, PAL.gold4).set(7, 4, PAL.gold4).set(5, 6, PAL.gold4);
  c.outline(PAL.ink);
  scene.textures.addCanvas(key, c.toCanvas());
  return key;
}

async function coinFlip(ctx: Ctx<'gameStart'>, first: PlayerId): Promise<void> {
  const sc = ctx.scene;
  const cx = GAME_W / 2;
  const cy = 118;
  const keys = [coinTexture(sc, 0), coinTexture(sc, 1)];
  const coin = sc.add.image(cx, cy + 40, keys[0]).setDepth(DEPTH.BANNER - 5).setScrollFactor(0).setScale(2);
  const shadow = sc.add.ellipse(cx, cy + 62, 30, 8, PAL.ink, 0.5).setDepth(DEPTH.BANNER - 6).setScrollFactor(0);
  ctx.sfx('whoosh', { volume: 0.6 });
  const spins = 7 + first; // ends on the first player's face
  const o = { t: 0 };
  await tween(sc, {
    targets: o,
    t: 1,
    duration: 800,
    ease: 'Linear',
    onUpdate: () => {
      const t = o.t;
      const ang = t * spins * Math.PI;
      const face = Math.floor((ang + Math.PI / 2) / Math.PI) % 2;
      coin.setTexture(keys[face as 0 | 1]);
      coin.scaleX = 2 * Math.max(0.08, Math.abs(Math.cos(ang)));
      // up and down: a throw
      const h = Math.sin(Math.PI * t) * 64;
      coin.y = Math.round(cy + 40 - h);
      shadow.setScale(1 - h / 140);
    },
  });
  coin.setTexture(keys[first]).setScale(2.4, 1.6);
  ctx.sfx('cardSlam', { volume: 0.6 });
  void tween(sc, { targets: coin, scaleX: 2, scaleY: 2, duration: 220, ease: 'Back.Out' });
  void sparkleBurst(sc, cx, cy + 40, { ramp: PLAYER_RAMP[first], count: 18 });
  const t = pixelText(sc, cx, cy + 74, first === 0 ? 'OYUNCU 1 BAŞLIYOR!' : 'OYUNCU 2 BAŞLIYOR!', { size: 'md', color: PLAYER_COLOR[first], originX: 0.5, originY: 0.5, shadow: 1 })
    .setDepth(DEPTH.BANNER - 4)
    .setScrollFactor(0)
    .setAlpha(0);
  await tween(sc, { targets: t, alpha: 1, y: t.y - 4, duration: 200 });
  await wait(sc, 320);
  await all([tween(sc, { targets: [coin, t], alpha: 0, duration: 180 }), tween(sc, { targets: shadow, alpha: 0, duration: 220 })]);
  coin.destroy();
  shadow.destroy();
  t.destroy();
}

async function shuffleDecks(ctx: CinematicContext, players: PlayerId[]): Promise<void> {
  ctx.sfx('shuffle', { volume: 0.8 });
  const jobs = players.map(async (p) => {
    const pile = ctx.views.field.pile(p, 'deck');
    for (let i = 0; i < 4; i++) {
      pile.bump();
      await wait(ctx.scene, 70);
    }
  });
  await all(jobs);
}

registerEvent(
  'gameStart',
  async (ctx) => {
    const sc = ctx.scene;
    const v = ctx.views;
    // the opening owns the shuffles and the opening hands
    const draws: Extract<GameEvent, { type: 'draw' }>[] = [];
    let opening: Promise<void> = Promise.resolve();
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (e.type === 'shuffle') ctx.consumeAt(i);
      else if (e.type === 'draw' && e.initial) {
        draws.push(e);
        ctx.consumeAt(i);
      } else break;
    }
    if (!ctx.skipIntro) {
      if (ctx.settings.music) ctx.music.play('duel');
      ctx.music.setIntensity(0.2);
      v.hud.setVisible(false);
      v.duelists?.setVisible(false);
      const lights = v.board.setLights(true, true);
      await v.camera.descend(1500, -300);
      await lights;
      if (v.duelists) {
        v.duelists.setVisible(true);
        for (const p of [0, 1] as PlayerId[]) {
          const d = v.duelists.get(p);
          d.sprite.setAlpha(0);
          void tween(sc, { targets: d.sprite, alpha: 1, duration: 260 });
          void sparkleBurst(sc, d.home.x, d.home.y - 14, { ramp: PLAYER_RAMP[p], count: 12 });
        }
        ctx.sfx('materialize', { volume: 0.6 });
      }
      await coinFlip(ctx, ctx.ev.firstPlayer);
      v.hud.setVisible(true);
      // the deal starts while "DÜELLO!" is still leaving the screen (opening ≤ 6 s)
      const duel = duelStart(sc);
      await Promise.race([duel, wait(sc, 1000)]);
      opening = duel;
    } else {
      void v.board.setLights(true, false);
      if (ctx.settings.music) ctx.music.play('duel');
    }
    await shuffleDecks(ctx, [0, 1]);
    // deal: alternate players, staggered arcs from the deck piles into the hands
    const piles = { 0: v.field.pile(0, 'deck'), 1: v.field.pile(1, 'deck') };
    const counts = { 0: piles[0].count, 1: piles[1].count };
    const step = ctx.skipIntro ? 70 : 110;
    const jobs = draws.map(async (d, i) => {
      await wait(sc, i * step);
      const pile = piles[d.player];
      const from = pile.topXY();
      counts[d.player] = Math.max(0, counts[d.player] - 1);
      pile.set(counts[d.player], null);
      await v.hand.addCard(d.uid, d.cardId, from, d.player);
    });
    await all([...jobs, opening]);
  },
  P,
);

registerEvent(
  'shuffle',
  async (ctx) => {
    await shuffleDecks(ctx, [ctx.ev.player]);
  },
  P,
);

// ================================================================ draw

registerEvent(
  'draw',
  async (ctx) => {
    const { player, uid, cardId } = ctx.ev;
    const pile = ctx.views.field.pile(player, 'deck');
    const from = pile.topXY();
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    await ctx.views.hand.addCard(uid, cardId, from, player);
  },
  P,
);

// ================================================================ turn / phase

registerEvent(
  'turnStart',
  async (ctx) => {
    const { player, turn } = ctx.ev;
    const v = ctx.views;
    await v.camera.unfocus(120);
    // hot-seat: pass the device before anything private of the new player shows
    await v.info.ensureViewer(player);
    v.board.setActivePlayer(player, true);
    v.hud.setActive(player, true);
    v.hud.setTurn(turn, true);
    ctx.sfx('turnStart', { volume: 0.7 });
    ctx.music.setIntensity(0.35);
    await all([turnBanner(ctx.scene, player, turn), v.board.pulseSide(player), wait(ctx.scene, 600)]);
  },
  P,
);

registerEvent(
  'phaseChange',
  async (ctx) => {
    const { phase, player } = ctx.ev;
    const hud = ctx.views.hud;
    if (phase === 'battle') {
      ctx.sfx('phaseChange', { volume: 0.8 });
      ctx.music.setIntensity(0.85);
      await all([hud.setPhase('battle', player, true), phaseBanner(ctx.scene, 'battle')]);
      return;
    }
    void hud.setPhase(phase, player, true);
    if (phase === 'end') ctx.music.setIntensity(0.35);
    await wait(ctx.scene, phase === 'main' ? 200 : 140);
  },
  P,
);

// ================================================================ decisions

registerEvent(
  'decision',
  async (ctx) => {
    const pd = ctx.ev.pending;
    const field = ctx.views.field;
    if (pd.kind === 'trapResponse') {
      // the defender's set cards pulse magenta: "a trap could open now"
      const jobs = pd.options.map((uid) => field.tileOf(uid)?.pulse(PAL.mag3, 520) ?? Promise.resolve());
      ctx.sfx('lockOn', { volume: 0.4, pitch: 0.8 });
      await all(jobs);
    } else if (pd.kind === 'chooseTarget') {
      const col = PLAYER_COLOR[pd.player];
      const jobs = pd.candidates.map((r) => {
        const t = field.tileAt(r.player, r.zone, r.index);
        return t ? t.pulse(col, 420) : Promise.resolve();
      });
      await all(jobs);
    }
  },
  P,
);

registerEvent(
  'responseDeclined',
  async (ctx) => {
    const p = ctx.ev.player;
    const sc = ctx.scene;
    const at = ctx.views.field.tileAt(p, 'spellTrap', 1)?.home ?? { x: GAME_W / 2, y: 180 };
    const t = pixelText(sc, at.x, at.y - 18, 'GEÇ', { size: 'md', color: PAL.mist, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.FX_TOP);
    ctx.sfx('uiBack', { volume: 0.5 });
    await tween(sc, { targets: t, y: t.y - 12, alpha: 0, duration: 520, ease: 'Quad.Out' });
    t.destroy();
  },
  P,
);

registerEvent(
  'deckOut',
  async (ctx) => {
    const pile = ctx.views.field.pile(ctx.ev.player, 'deck');
    void pile.flash(PAL.crim3);
    void shake(ctx.scene, 300, 3);
    ctx.sfx('defeat', { volume: 0.6 });
    await banner(ctx.scene, 'DESTE BİTTİ!', { style: 'big', color: PAL.crim3 });
  },
  P,
);

// ================================================================ game over

registerEvent(
  'gameOver',
  async (ctx) => {
    const sc = ctx.scene;
    const v = ctx.views;
    const loser: PlayerId = ctx.ev.winner === 0 ? 1 : 0;
    ctx.music.stop(500);
    v.speed.slowMo(0.45, 900);
    await v.camera.unfocus(200);
    // the loser's holograms short out and collapse, one after another
    const units = v.field.units().filter((u) => u.player === loser && u.sprite.visible);
    const jobs = units.map(async (u, i) => {
      await wait(sc, i * 140);
      u.badge.setVisible(false);
      await glitch(sc, u.sprite, 260, 1, { attribute: u.attribute });
      await dematerialize(sc, u.sprite, 480, { attribute: u.attribute });
    });
    const d = v.duelists;
    if (d) {
      void d.get(loser).play('defeat');
      void d.get(ctx.ev.winner).play('victory');
    }
    ctx.sfx('defeat', { volume: 0.7 });
    await all(jobs);
    void flash(sc, 260, PAL.white, 0.5);
    await wait(sc, 300);
  },
  P,
);
