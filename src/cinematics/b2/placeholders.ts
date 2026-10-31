// Batch-2 cards (docs/v3/YENI_KARTLAR.md) — PLACEHOLDER presentation for the new event types, so every new card
// plays readably in the duel while its signature cinematic is still to come (golden rule: each of these gets its
// own unique VFX + SFX later; nothing here is meant to ship as a signature moment).
//   controlChange  the monster glides from its zone to the new one in a player-coloured streak, "ELE GEÇİRİLDİ" /
//                  "SAHİBİNE DÖNDÜ" over it
//   massDestroy    a short red sweep: every doomed card's zone flares at once, then the destroys play
//   coinToss       a gold coin spins over the board, lands on YAZI / TURA, "BİLDİ!" / "BİLEMEDİ!"
//   diceRoll       a white die tumbles through faces and stops on the value
//   banish         a void wisp rises out of the owner's graveyard: "OYUNDAN ÇIKTI"
//   tokenVanish    the straw token squashes and scatters into straw bits
// Only the new event types are registered (never an old one), so v1 and every old card are untouched.

import Phaser from 'phaser';
import { CARDS } from '../../data/cards';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { DEPTH, zoneXY, type XY } from '../../view/layout';
import { pixelText } from '../../ui/text';
import { TEX, shake, tween, wait } from '../../vfx/core';
import { registerEvent, type CinematicContext } from '../api';
import type { GameEvent } from '../../engine/types';

type Ctx<T extends GameEvent['type']> = CinematicContext<Extract<GameEvent, { type: T }>>;
const ADD = Phaser.BlendModes.ADD;
const R = (v: number) => Math.round(v);

/** A short word that rises and fades over a world point. */
function floatWord(scene: Phaser.Scene, at: XY, text: string, color: number, ms = 900): Promise<void> {
  const t = pixelText(scene, R(at.x), R(at.y), text, { size: 'md', color }).setOrigin(0.5, 1).setDepth(DEPTH.FX_TOP);
  t.setAlpha(0);
  return (async () => {
    await tween(scene, { targets: t, alpha: 1, y: R(at.y - 6), duration: 140 });
    await wait(scene, ms - 320);
    await tween(scene, { targets: t, alpha: 0, y: R(at.y - 12), duration: 180 });
    t.destroy();
  })();
}

/** A still copy of a unit's current frame (the unit itself is hidden; the copy is yours to move and destroy). */
function ghostOf(scene: Phaser.Scene, unit: { sprite: Phaser.GameObjects.Sprite; hide(): void }): Phaser.GameObjects.Image {
  const s = unit.sprite;
  const g = scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setDepth(s.depth);
  unit.hide();
  return g;
}

/** A few pixel sparks bursting from a point. */
function sparks(scene: Phaser.Scene, at: XY, color: number, n = 10, r = 18, ms = 420): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.2;
    const p = scene.add.image(R(at.x), R(at.y), i % 4 === 0 ? TEX.plus : TEX.px2).setTint(i % 3 === 0 ? PAL.white : color).setBlendMode(ADD).setDepth(DEPTH.FX);
    scene.tweens.add({ targets: p, x: R(at.x + Math.cos(a) * r), y: R(at.y + Math.sin(a) * r * 0.6), alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => p.destroy() });
  }
}

// ================================================================ control switch

registerEvent(
  'controlChange',
  async (ctx: Ctx<'controlChange'>) => {
    const ev = ctx.ev;
    const v = ctx.views;
    const scene = ctx.scene;
    const from = zoneXY(ev.from, 'monster', ev.fromZone);
    const to = zoneXY(ev.to, 'monster', ev.toZone);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const color = PLAYER_COLOR[ev.to];
    // the source card (Kukla İpi / Ruh Tasması) sends a thin line to the monster first
    if (ev.sourceUid !== null && ev.reason === 'take') {
      const st = v.field.tileOf(ev.sourceUid);
      if (st) {
        const g = scene.add.graphics().setDepth(DEPTH.FX).setBlendMode(ADD);
        g.lineStyle(1, color, 1).lineBetween(R(st.home.x), R(st.home.y), R(from.x), R(from.y - 10));
        ctx.sfx('cardSlide', { volume: 0.6 });
        void tween(scene, { targets: g, alpha: 0, duration: 520, delay: 260, onComplete: () => g.destroy() });
        await wait(scene, 260);
      }
    }
    const { tile, unit } = v.field.release(ev.uid);
    const movers: Phaser.GameObjects.GameObject[] = [];
    if (tile) movers.push(tile);
    let ghost: Phaser.GameObjects.Image | null = null;
    if (unit) {
      ghost = ghostOf(scene, unit);
      movers.push(ghost);
      ghost.setTintFill(color);
      scene.time.delayedCall(90, () => ghost?.active && ghost.clearTint());
    }
    ctx.sfx('whoosh', { volume: 0.7 });
    sparks(scene, from, color, 8, 14);
    const word = floatWord(scene, { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 34 }, ev.reason === 'take' ? 'ELE GEÇİRİLDİ' : 'SAHİBİNE DÖNDÜ', color, 1000);
    // the glide: an arc over the board's middle line
    const o = { t: 0 };
    const starts = movers.map((m) => ({ m: m as unknown as { x: number; y: number }, x: (m as unknown as { x: number }).x, y: (m as unknown as { y: number }).y }));
    await tween(scene, {
      targets: o,
      t: 1,
      duration: 560,
      ease: 'Cubic.InOut',
      onUpdate: () => {
        const lift = Math.sin(o.t * Math.PI) * 18;
        for (const s of starts) {
          s.m.x = R(s.x + dx * o.t);
          s.m.y = R(s.y + dy * o.t - lift);
        }
      },
    });
    ctx.sfx('cardPlace', { volume: 0.7 });
    sparks(scene, to, color, 10, 16);
    // hand over to the real objects: the field rebuilds the tile + unit on the new side (P2 faces left)
    tile?.destroy();
    ghost?.destroy();
    if (unit) v.field.forget(ev.uid);
    v.field.sync(ctx.stateNext);
    const nu = v.field.unit(ev.uid);
    if (nu) {
      nu.sprite.setTintFill(PAL.white);
      scene.time.delayedCall(70, () => nu.sprite.active && nu.sprite.clearTint());
    }
    await word;
  },
  { name: 'b2:controlChange' },
);

// ================================================================ mass destruction

registerEvent(
  'massDestroy',
  async (ctx: Ctx<'massDestroy'>) => {
    const ev = ctx.ev;
    const scene = ctx.scene;
    if (!ev.refs.length) return;
    const src = ev.sourceUid !== null ? ctx.cardId(ev.sourceUid) : null;
    const color = src === 'sweeping_gale' ? PAL.leaf3 : src === 'dial_jester' ? PAL.gold3 : PAL.crim3;
    ctx.sfx('impactHeavy', { volume: 0.6 });
    void shake(scene, 220, 2);
    const marks: Phaser.GameObjects.Image[] = [];
    for (const r of ev.refs) {
      const at = zoneXY(r.player, r.zone, r.index);
      const m = scene.add.image(R(at.x), R(at.y), TEX.spark).setTint(color).setBlendMode(ADD).setDepth(DEPTH.FX).setScale(1);
      marks.push(m);
      scene.tweens.add({ targets: m, scale: 4, alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => m.destroy() });
      sparks(scene, at, color, 8, 16, 480);
    }
    const mid = zoneXY(ev.player === 0 ? 1 : 0, 'monster', 2);
    void floatWord(scene, { x: mid.x, y: mid.y - 40 }, src ? `${CARDS[src].name.toLocaleUpperCase('tr')}!` : 'YOK ET!', color, 900);
    await wait(scene, 420);
  },
  { name: 'b2:massDestroy' },
);

// ================================================================ coin toss (Kadran Soytarısı)

registerEvent(
  'coinToss',
  async (ctx: Ctx<'coinToss'>) => {
    const ev = ctx.ev;
    const scene = ctx.scene;
    const loc = ctx.locate(ev.sourceUid);
    const base = loc && 'player' in loc && 'index' in loc ? zoneXY(loc.player as PlayerId, 'monster', loc.index as number) : zoneXY(ev.player, 'monster', 2);
    const x = R(base.x);
    const y0 = R(base.y - 30);
    const face = (f: 'heads' | 'tails') => (f === 'heads' ? 'TURA' : 'YAZI');
    const coin = scene.add.container(x, y0).setDepth(DEPTH.FX_TOP);
    const g = scene.add.graphics();
    g.fillStyle(PAL.gold1).fillCircle(0, 0, 11);
    g.fillStyle(PAL.gold3).fillCircle(0, -1, 10);
    g.fillStyle(PAL.gold4).fillCircle(-2, -3, 5);
    const label = pixelText(scene, 0, 0, face(ev.call), { size: 'sm', color: PAL.night0, outline: false }).setOrigin(0.5);
    coin.add([g, label]);
    ctx.sfx('uiClick', { volume: 0.8, pitch: 1.6 });
    void floatWord(scene, { x, y: y0 - 20 }, `${ev.player === 0 ? 'OYUNCU 1' : 'OYUNCU 2'}: ${face(ev.call)}`, PLAYER_COLOR[ev.player], 900);
    // up, spinning (scaleX flips), down
    const o = { t: 0 };
    let lastHalf = -1;
    await tween(scene, {
      targets: o,
      t: 1,
      duration: 1100,
      onUpdate: () => {
        const t = o.t;
        coin.y = R(y0 - Math.sin(t * Math.PI) * 46);
        const spin = t * 9;
        coin.scaleX = Math.max(0.12, Math.abs(Math.cos(spin * Math.PI)));
        const half = Math.floor(spin + 0.5);
        if (half !== lastHalf) {
          lastHalf = half;
          label.setText(face(half % 2 ? (ev.call === 'heads' ? 'tails' : 'heads') : ev.call));
          if (half % 2 === 0) ctx.sfx('uiHover', { volume: 0.4, pitch: 1.8 });
        }
      },
    });
    coin.scaleX = 1;
    label.setText(face(ev.result));
    ctx.sfx('uiClick', { volume: 0.9, pitch: 2 });
    await tween(scene, { targets: coin, y: y0 - 6, duration: 90, yoyo: true, ease: 'Quad.Out' });
    await wait(scene, 250);
    const color = ev.win ? PAL.leaf4 : PAL.crim4;
    ctx.sfx(ev.win ? 'uiConfirm' : 'uiError', { volume: 0.9 });
    sparks(scene, { x, y: y0 }, ev.win ? PAL.gold4 : PAL.crim3, 14, 22);
    await floatWord(scene, { x, y: y0 - 18 }, ev.win ? `${face(ev.result)} — BİLDİ!` : `${face(ev.result)} — BİLEMEDİ!`, color, 1000);
    await tween(scene, { targets: coin, alpha: 0, duration: 160 });
    coin.destroy();
  },
  { name: 'b2:coinToss' },
);

// ================================================================ die roll (Talih Zarı)

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-4, -4], [4, 4]],
  3: [[-4, -4], [0, 0], [4, 4]],
  4: [[-4, -4], [4, -4], [-4, 4], [4, 4]],
  5: [[-4, -4], [4, -4], [0, 0], [-4, 4], [4, 4]],
  6: [[-4, -4], [4, -4], [-4, 0], [4, 0], [-4, 4], [4, 4]],
};

registerEvent(
  'diceRoll',
  async (ctx: Ctx<'diceRoll'>) => {
    const ev = ctx.ev;
    const scene = ctx.scene;
    const base = zoneXY(ev.player, 'monster', 2);
    const x = R(base.x);
    const y0 = R(base.y - 36);
    const die = scene.add.graphics().setDepth(DEPTH.FX_TOP);
    const draw = (n: number) => {
      die.clear();
      die.fillStyle(PAL.ink).fillRect(-9, -9, 18, 18);
      die.fillStyle(PAL.mist).fillRect(-8, -8, 16, 16);
      die.fillStyle(PAL.white).fillRect(-8, -8, 16, 3);
      die.fillStyle(n === 1 ? PAL.crim3 : PAL.night0);
      for (const [px, py] of PIPS[n]) die.fillRect(px - 1, py - 1, 2, 2);
    };
    let n = ((ev.value + 2) % 6) + 1;
    draw(n);
    die.setPosition(x - 40, y0);
    ctx.sfx('cardSlide', { volume: 0.6 });
    // tumbling across, faces changing on each bounce
    for (let i = 0; i < 5; i++) {
      n = (n % 6) + 1;
      draw(i === 4 ? ev.value : n);
      ctx.sfx('uiClick', { volume: 0.5, pitch: 0.7 + i * 0.1 });
      await tween(scene, { targets: die, x: R(x - 40 + ((i + 1) * 40) / 5), y: { from: y0 - 10 + i * 2, to: y0 }, duration: 110 + i * 25, ease: 'Quad.In' });
    }
    draw(ev.value);
    ctx.sfx('uiConfirm', { volume: 0.8 });
    sparks(scene, { x, y: y0 }, PAL.gold4, 10, 18);
    await floatWord(scene, { x, y: y0 - 14 }, `ZAR: ${ev.value}`, PAL.gold4, 900);
    await tween(scene, { targets: die, alpha: 0, duration: 160 });
    die.destroy();
  },
  { name: 'b2:diceRoll' },
);

// ================================================================ banish (Kovuk Devi)

registerEvent(
  'banish',
  async (ctx: Ctx<'banish'>) => {
    const ev = ctx.ev;
    const scene = ctx.scene;
    const at = zoneXY(ev.owner, 'graveyard', 0);
    ctx.sfx('whoosh', { volume: 0.5 });
    const w = scene.add.image(R(at.x), R(at.y - 4), TEX.spark).setTint(PAL.void4).setBlendMode(ADD).setDepth(DEPTH.FX).setScale(2);
    sparks(scene, at, PAL.void3, 8, 12);
    void tween(scene, { targets: w, y: R(at.y - 40), alpha: 0, scale: 0.5, duration: 600, ease: 'Quad.In', onComplete: () => w.destroy() });
    await floatWord(scene, { x: at.x, y: at.y - 18 }, `${CARDS[ev.cardId].name}: OYUNDAN ÇIKTI`, PAL.void4, 800);
  },
  { name: 'b2:banish' },
);

// ================================================================ token leaves (Saman Korkuluk)

registerEvent(
  'tokenVanish',
  async (ctx: Ctx<'tokenVanish'>) => {
    const ev = ctx.ev;
    const scene = ctx.scene;
    const field = ctx.views.field;
    const at = zoneXY(ev.player, 'monster', ev.zone);
    const { tile, unit } = field.release(ev.uid);
    ctx.sfx('cardSlide', { volume: 0.6, pitch: 1.4 });
    sparks(scene, { x: at.x, y: at.y - 10 }, PAL.gold3, 12, 20, 520);
    const jobs: Promise<void>[] = [];
    let ghost: Phaser.GameObjects.Image | null = null;
    if (unit) {
      ghost = ghostOf(scene, unit);
      jobs.push(tween(scene, { targets: ghost, scaleY: 0.2, alpha: 0, duration: 260, ease: 'Quad.In' }));
    }
    if (tile) jobs.push(tween(scene, { targets: tile, alpha: 0, duration: 260 }));
    await Promise.all(jobs);
    ghost?.destroy();
    tile?.destroy();
    if (unit) field.forget(ev.uid);
  },
  { name: 'b2:tokenVanish' },
);

// ================================================================ spite_axe back onto its owner's deck

registerEvent(
  'toDeck',
  async (ctx: Ctx<'toDeck'>) => {
    const ev = ctx.ev;
    if (ev.from !== 'spellTrap') return ctx.base(); // (graveyard → deck shuffles: unchanged)
    const scene = ctx.scene;
    const field = ctx.views.field;
    const deck = zoneXY(ev.owner, 'deck', 0);
    const { tile } = field.release(ev.uid);
    ctx.sfx('cardSlide', { volume: 0.7 });
    if (tile) {
      await tween(scene, { targets: tile, x: R(deck.x), y: R(deck.y - 4), alpha: 0.4, duration: 420, ease: 'Cubic.In' });
      tile.destroy();
    }
    sparks(scene, deck, PAL.fire3, 8, 12);
    await floatWord(scene, { x: deck.x, y: deck.y - 16 }, `${CARDS[ev.cardId].name}: DESTEYE DÖNDÜ`, PAL.fire4, 800);
  },
  { name: 'b2:toDeck' },
);
