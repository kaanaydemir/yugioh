// Prompt — modal moments, all promise-based:
//
//   const prompt = new Prompt(scene);
//   await prompt.passDevice(1, async () => { await hand.setOwner(1, true); });  // hot-seat curtain
//   const uid = await prompt.trapResponse(1, [{ uid: 12, cardId: 'mirror_barrier' }]);  // uid | null
//   const ins = prompt.instruction('Hedef seç: rakibin bir canavarı');   // top bar with İPTAL
//   ins.cancelled.then(() => ...);  ins.close();
//   const ok = await prompt.confirm('Teslim olmak istediğine emin misin?');
//   await prompt.gameOver(0, 'lp');                                      // resolves on "Tekrar Oyna"
//
// passDevice: a diagonal wipe in the player's colors covers the whole board (nothing of the
// previous player's hand stays visible), scrolling stripes + speed lines, the title slams in
// letter by letter, "Hazır olunca tıkla" blinks with a tapping hand; click / Enter / Space and
// the curtain wipes away. `onCovered` runs while the screen is fully covered.

import Phaser from 'phaser';
import { type CardId, cardDef } from '../data/cards';
import { PAL, PLAYER_COLOR, RAMPS } from '../art/palette';
import { mix } from '../art/pixel';
import { sfx } from '../audio/sfx';
import type { PlayerId, Uid, WinReason } from '../engine/types';
import { measureText, pixelLetters, pixelText, textMetrics, wrapText, type PixelLetter, type TextSize } from '../ui/text';
import { TEX, shake, tween, wait } from '../vfx/core';
import { Button } from './Button';
import { CardSprite } from './CardSprite';
import { CARD_H, CARD_W, DEPTH, GAME_H, GAME_W, UI } from './layout';
import { GLOW_PAD, ICON, UI_RAMP, type UiKeyHandler, crownTex, pushUiKeys, glowTex, haloTex, panelTex, playerStyle, streakTex, stripesTex, typeOn } from './ui-textures';

export interface TrapOption {
  uid: Uid;
  cardId: CardId;
}

export interface InstructionHandle {
  /** Remove the bar (does not resolve `cancelled`). */
  close(): void;
  /** Resolves when the player presses İPTAL / Esc. */
  cancelled: Promise<void>;
  /** Change the text in place. */
  setText(text: string): void;
}

const ADD = Phaser.BlendModes.ADD;
const NAME: Record<PlayerId, string> = { 0: 'OYUNCU 1', 1: 'OYUNCU 2' };
const NAME_TITLE: Record<PlayerId, string> = { 0: 'Oyuncu 1', 1: 'Oyuncu 2' };
const REASON: Record<WinReason, string> = {
  lp: "Rakibin LP'si sıfırlandı",
  deckout: 'Rakibin destesi bitti',
  surrender: 'Rakip teslim oldu',
};

function capY(size: TextSize, capTop: number): number {
  return capTop - textMetrics(size).capTop;
}

/** Possessive suffix for "OYUNCU 1'İN" / "OYUNCU 2'NİN". */
function possessive(p: PlayerId): string {
  return p === 0 ? "OYUNCU 1'İN" : "OYUNCU 2'NİN";
}

export class Prompt {
  private readonly scene: Phaser.Scene;
  /** Keyboard handlers this prompt holds on the shared UI focus stack (see pushUiKeys). */
  private readonly keyReleases = new Map<UiKeyHandler, () => void>();
  private seed = 0x1234567;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  destroy(): void {
    for (const release of this.keyReleases.values()) release();
    this.keyReleases.clear();
  }

  private addKeys(fn: UiKeyHandler): void {
    this.keyReleases.set(fn, pushUiKeys(fn));
  }

  private removeKeys(fn: UiKeyHandler): void {
    this.keyReleases.get(fn)?.();
    this.keyReleases.delete(fn);
  }

  // ================================================================ pass device

  /**
   * Full-screen "pass the device" curtain. Resolves after the player clicked and the curtain
   * has wiped away. `onCovered` is awaited while the screen is fully covered (swap the hand there).
   */
  async passDevice(player: PlayerId, onCovered?: () => void | Promise<void>): Promise<void> {
    const sc = this.scene;
    const style = playerStyle(player);
    const R = UI_RAMP[style];
    const root = sc.add.container(0, 0).setDepth(DEPTH.TRANSITION).setScrollFactor(0);
    const objs: Phaser.GameObjects.GameObject[] = [];
    // blocker (eats input below)
    const blocker = sc.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0).setInteractive();
    root.add(blocker);

    // ---- curtain body (masked by the wipe)
    const body = sc.add.container(0, 0);
    const base = sc.add.rectangle(0, 0, GAME_W, GAME_H, PAL.night0).setOrigin(0);
    const stripes = sc.add.tileSprite(0, 0, GAME_W, GAME_H, stripesTex(sc, style)).setOrigin(0);
    // letterbox bars
    const topBar = sc.add.rectangle(0, 0, GAME_W, 46, PAL.ink).setOrigin(0).setAlpha(0.85);
    const botBar = sc.add.rectangle(0, GAME_H - 46, GAME_W, 46, PAL.ink).setOrigin(0).setAlpha(0.85);
    const lines = sc.add.graphics();
    lines.fillStyle(R[3]).fillRect(0, 46, GAME_W, 1).fillRect(0, GAME_H - 47, GAME_W, 1);
    lines.fillStyle(R[1]).fillRect(0, 48, GAME_W, 1).fillRect(0, GAME_H - 49, GAME_W, 1);
    // big diagonal slashes drifting over the stripes
    const slashG = sc.add.graphics();
    const drawSlashes = (t: number) => {
      slashG.clear();
      const defs: [number, number, number][] = [
        [0, 70, 0.3],
        [380, 26, 0.45],
        [700, 110, 0.22],
        [930, 14, 0.6],
      ];
      for (const [x0, w, a] of defs) {
        const x = ((x0 + t * 0.03) % 1240) - 300;
        slashG.fillStyle(R[1], a);
        slashG.fillPoints(
          [
            new Phaser.Geom.Point(x + 140, 0),
            new Phaser.Geom.Point(x + 140 + w, 0),
            new Phaser.Geom.Point(x + w, GAME_H),
            new Phaser.Geom.Point(x, GAME_H),
          ],
          true,
        );
        slashG.fillStyle(R[2], a + 0.2);
        slashG.fillPoints(
          [
            new Phaser.Geom.Point(x + 140 + w, 0),
            new Phaser.Geom.Point(x + 142 + w, 0),
            new Phaser.Geom.Point(x + w + 2, GAME_H),
            new Phaser.Geom.Point(x + w, GAME_H),
          ],
          true,
        );
      }
    };
    drawSlashes(0);
    body.add([base, stripes, slashG, topBar, botBar, lines]);
    root.add(body);
    const maskG = sc.make.graphics({}, false);
    body.setMask(maskG.createGeometryMask());
    const edgeG = sc.add.graphics();
    root.add(edgeG);

    // ---- center band + title
    const band = sc.add.container(0, 0);
    const bandG = sc.add.graphics();
    const bandY = 128;
    const bandH = 96;
    bandG.fillStyle(PAL.ink, 0.82).fillRect(0, bandY, GAME_W, bandH);
    bandG.fillStyle(R[3]).fillRect(0, bandY, GAME_W, 2);
    bandG.fillStyle(R[4]).fillRect(0, bandY, GAME_W, 1);
    bandG.fillStyle(R[3]).fillRect(0, bandY + bandH - 2, GAME_W, 2);
    bandG.fillStyle(R[1]).fillRect(0, bandY + 4, GAME_W, 1).fillRect(0, bandY + bandH - 5, GAME_W, 1);
    // huge ghost player number inside the band
    const ghost = pixelText(sc, GAME_W - 18, bandY + bandH / 2, String(player + 1), { size: 'xl', color: R[2], outline: false })
      .setOrigin(1, 0.5)
      .setScale(3)
      .setAlpha(0.22);
    const ghost2 = pixelText(sc, 18, bandY + bandH / 2, String(player + 1), { size: 'xl', color: R[2], outline: false })
      .setOrigin(0, 0.5)
      .setScale(3)
      .setAlpha(0.22);
    band.add([bandG, ghost, ghost2]);
    band.x = GAME_W + 40;
    root.add(band);
    const small = pixelText(sc, GAME_W / 2, capY('md', bandY + 13), 'SIRA DEĞİŞİYOR', { size: 'md', color: R[4], originX: 0.5 });
    small.setAlpha(0);
    root.add(small);
    const title = pixelLetters(sc, GAME_W / 2, capY('xl', bandY + 32), `${possessive(player)} SIRASI`, {
      size: 'xl',
      color: PAL.white,
      originX: 0.5,
      shadow: 1,
    });
    for (const l of title.letters) {
      l.obj.setAlpha(0);
      root.add(l.obj);
    }
    const sub = pixelText(sc, GAME_W / 2 + 8, capY('md', bandY + 68), 'Hazır olunca tıkla', { size: 'md', color: PAL.white, originX: 0.5 });
    sub.setAlpha(0);
    const tap = sc.add.image(sub.x - sub.width / 2 - 14, bandY + 70, ICON.pointer).setTint(R[4]).setAlpha(0);
    root.add([sub, tap]);
    objs.push(root, maskG);

    // ---- wipe in
    sfx.play('passDevice');
    let edge = -200;
    const slant = 140;
    const drawWipe = (left: number, right: number) => {
      maskG.clear();
      maskG.fillStyle(0xffffff);
      maskG.fillPoints(
        [
          new Phaser.Geom.Point(left + slant, 0),
          new Phaser.Geom.Point(right + slant, 0),
          new Phaser.Geom.Point(right, GAME_H),
          new Phaser.Geom.Point(left, GAME_H),
        ],
        true,
      );
      edgeG.clear();
      // bright leading bands in front of the curtain edge
      const bands: [number, number, number][] = [
        [0, 6, R[4]],
        [9, 4, R[3]],
        [16, 2, R[2]],
        [21, 1, R[3]],
      ];
      for (const [off, w, c] of bands) {
        edgeG.fillStyle(c);
        edgeG.fillPoints(
          [
            new Phaser.Geom.Point(right + off + slant, 0),
            new Phaser.Geom.Point(right + off + w + slant, 0),
            new Phaser.Geom.Point(right + off + w, GAME_H),
            new Phaser.Geom.Point(right + off, GAME_H),
          ],
          true,
        );
      }
      if (left > -slant - 40) {
        for (const [off, w, c] of bands) {
          edgeG.fillStyle(c);
          edgeG.fillPoints(
            [
              new Phaser.Geom.Point(left - off - w + slant, 0),
              new Phaser.Geom.Point(left - off + slant, 0),
              new Phaser.Geom.Point(left - off, GAME_H),
              new Phaser.Geom.Point(left - off - w, GAME_H),
            ],
            true,
          );
        }
      }
    };
    drawWipe(-400, edge);
    let slashT = 0;
    const scroll = (_t: number, dt: number) => {
      stripes.tilePositionX -= (dt * sc.time.timeScale) / 40;
      slashT += dt * sc.time.timeScale;
      drawSlashes(slashT);
      ghost.y = bandY + bandH / 2 + Math.round(Math.sin(slashT / 700) * 2);
      ghost2.y = bandY + bandH / 2 - Math.round(Math.sin(slashT / 700) * 2);
    };
    sc.events.on(Phaser.Scenes.Events.UPDATE, scroll);
    const o = { e: edge };
    await tween(sc, {
      targets: o,
      e: GAME_W + 40,
      duration: 420,
      ease: 'Cubic.InOut',
      onUpdate: () => {
        edge = o.e;
        drawWipe(-400, edge);
      },
    });
    drawWipe(-400, GAME_W + 400);
    edgeG.clear();
    void shake(sc, 140, 2);

    // speed lines across the band
    const streaks = sc.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        const y = bandY + 6 + Math.floor(this.rnd() * (bandH - 12));
        const len = 24;
        const s = sc.add
          .image(-30, y, streakTex(sc, len))
          .setOrigin(1, 0)
          .setScale(1 + Math.floor(this.rnd() * 3), 1)
          .setTint(this.rnd() < 0.3 ? PAL.white : R[3])
          .setBlendMode(ADD)
          .setAlpha(0.55);
        root.addAt(s, root.getIndex(band) + 1);
        sc.tweens.add({ targets: s, x: GAME_W + 80, duration: 420 + this.rnd() * 300, onComplete: () => s.destroy() });
      },
    });

    // behind-the-curtain work (hand swap) runs while the title plays
    // (an error in the callback must never leave the curtain stuck on screen)
    const covered = Promise.resolve()
      .then(() => onCovered?.())
      .catch((e) => console.error('[prompt] passDevice onCovered', e));

    // band + title
    band.x = GAME_W;
    await tween(sc, { targets: band, x: 0, duration: 220, ease: 'Cubic.Out' });
    sc.tweens.add({ targets: small, alpha: 1, duration: 200 });
    await this.slamLetters(title.letters, R[3], 34);
    void shake(sc, 160, 3);
    sfx.play('turnStart', { volume: 0.7 });
    // gold glint along the title
    void this.glint(title.letters, R[4]);
    await covered;
    sc.tweens.add({ targets: [sub, tap], alpha: 1, duration: 260 });
    const blink = sc.tweens.add({ targets: sub, alpha: { from: 1, to: 0.55 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 300 });
    const tapT = sc.tweens.add({ targets: tap, y: tap.y + 3, duration: 260, yoyo: true, repeat: -1, ease: 'Quad.In' });

    // wait for click / key
    await new Promise<void>((resolve) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        this.removeKeys(keyFn);
        resolve();
      };
      const keyFn = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          go();
          return true;
        }
        return false;
      };
      this.addKeys(keyFn);
      blocker.setInteractive({ useHandCursor: true });
      blocker.once(Phaser.Input.Events.POINTER_DOWN, go);
    });
    sfx.play('uiConfirm');
    blink.stop();
    tapT.stop();

    // ---- out: letters scatter up, band slides away, curtain wipes off to the right
    title.letters.forEach((l, i) => {
      sc.tweens.add({ targets: l.obj, y: l.obj.y - 14, alpha: 0, delay: i * 12, duration: 180, ease: 'Quad.In' });
    });
    sc.tweens.add({ targets: [sub, tap, small], alpha: 0, duration: 140 });
    const bandOut = tween(sc, { targets: band, x: -GAME_W, duration: 240, ease: 'Cubic.In', delay: 60 });
    await wait(sc, 170);
    streaks.remove();
    sfx.play('whoosh', { volume: 0.5 });
    const o2 = { e: -400 };
    await Promise.all([
      bandOut,
      tween(sc, {
        targets: o2,
        e: GAME_W + 60,
        duration: 380,
        ease: 'Cubic.InOut',
        onUpdate: () => drawWipe(o2.e, GAME_W + 400),
      }),
    ]);
    sc.events.off(Phaser.Scenes.Events.UPDATE, scroll);
    for (const ob of objs) ob.destroy();
  }

  // ================================================================ trap response

  /**
   * "Oyuncu 2: Tuzak kartı açmak ister misin?" — pick one of the set traps (AÇ) or decline
   * (GEÇ). Resolves with the chosen uid or null. Keys: 1–9 select, Enter = AÇ, Esc = GEÇ.
   */
  async trapResponse(player: PlayerId, options: TrapOption[]): Promise<Uid | null> {
    if (options.length === 0) return null;
    const sc = this.scene;
    const R = RAMPS.mag;
    const root = sc.add.container(0, 0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    const dim = sc.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink).setOrigin(0).setAlpha(0).setInteractive();
    root.add(dim);
    // magenta pulse along the screen edges
    const edge = sc.add
      .image(-GLOW_PAD + 2, -GLOW_PAD + 2, glowTex(sc, GAME_W - 4, GAME_H - 4, GLOW_PAD, 6))
      .setOrigin(0)
      .setBlendMode(ADD)
      .setTint(R[3])
      .setAlpha(0);
    root.add(edge);

    const n = options.length;
    const gapX = 26;
    const cardsW = n * CARD_W + (n - 1) * gapX;
    const question = `${NAME_TITLE[player]}: Tuzak kartı açmak ister misin?`;
    const w = Math.max(252, cardsW + 40, measureText(question, 'sm').w + 24);
    const textY = 38 + CARD_H + 17;
    const lines = Math.max(...options.map((o) => wrapText(cardDef(o.cardId).text, 'sm', w - 20).length));
    const h = textY + lines * 10 + 46;
    const px = Math.round(GAME_W / 2 - w / 2);
    const py = Math.round(GAME_H / 2 - h / 2) - 14;
    const panel = sc.add.container(px, py);
    root.add(panel);
    const glow = sc.add.image(-GLOW_PAD, -GLOW_PAD, glowTex(sc, w, h)).setOrigin(0).setBlendMode(ADD).setTint(R[3]).setAlpha(0.6);
    const bg = sc.add.image(0, 0, panelTex(sc, 'trap', w, h, { header: 19, alpha: 248 })).setOrigin(0);
    panel.add([glow, bg]);
    const icon = sc.add.image(9, 5, ICON.trap).setOrigin(0).setTint(R[4]);
    const head = pixelText(sc, 22, capY('md', 6), 'TUZAK FIRSATI', { size: 'md', color: R[4] });
    const who = pixelText(sc, w - 9, capY('sm', 7), NAME[player], { size: 'sm', color: PLAYER_COLOR[player] });
    who.x = Math.round(w - 9 - who.width);
    const q = pixelText(sc, Math.round(w / 2), capY('sm', 26), question, { size: 'sm', color: PAL.white });
    q.x = Math.round(w / 2 - q.width / 2);
    panel.add([icon, head, who, q]);

    // card choices
    const cardY = 38 + CARD_H / 2;
    const cards = options.map((o, i) => {
      const cx = Math.round(w / 2 - cardsW / 2 + CARD_W / 2 + i * (CARD_W + gapX));
      const c = new CardSprite(sc, cx, cardY, o.cardId, { faceUp: false });
      c.setHighlight(R[3]);
      c.setInteractive({ useHandCursor: true });
      panel.add(c);
      const nm = pixelText(sc, cx, capY('sm', cardY + CARD_H / 2 + 5), cardDef(o.cardId).name, { size: 'sm', color: R[4] });
      nm.x = Math.round(cx - nm.width / 2);
      if (n > 1) {
        const key = pixelText(sc, cx - CARD_W / 2 - 2, cardY - CARD_H / 2 - 4, String(i + 1), { size: 'sm', color: PAL.white });
        panel.add(key);
      }
      panel.add(nm);
      return { opt: o, sprite: c, name: nm };
    });
    // effect text of the focused card
    const desc = pixelText(sc, 10, textY, '', { size: 'sm', color: PAL.mist, maxWidth: w - 20, lineSpacing: -1 });
    panel.add(desc);

    let selected = n === 1 ? 0 : -1;
    const bw = 76;
    const by = h - 33;
    const openBtn = new Button(sc, Math.round(w / 2 - bw - 6), by, { w: bw, h: 25, label: 'AÇ', icon: ICON.trap, style: 'trap' });
    const passBtn = new Button(sc, Math.round(w / 2 + 6), by, { w: bw, h: 25, label: 'GEÇ', style: 'neutral' });
    panel.add([openBtn, passBtn]);
    openBtn.setEnabled(selected >= 0);

    const focus = (i: number) => {
      const c = cards[i];
      desc.setText(cardDef(c.opt.cardId).text);
      desc.x = 10;
    };
    const select = (i: number) => {
      if (i < 0 || i >= n) return;
      selected = i;
      cards.forEach((c, k) => c.sprite.setHighlight(k === i ? PAL.gold3 : R[3]));
      void cards[i].sprite.punch(0.1, 160);
      focus(i);
      openBtn.setEnabled(true);
      openBtn.setAttention(true);
      sfx.play('uiClick', { volume: 0.6 });
    };
    cards.forEach((c, i) => {
      c.sprite.on(Phaser.Input.Events.POINTER_OVER, () => {
        void c.sprite.hoverLift(true);
        focus(i);
        sfx.play('uiHover', { volume: 0.4 });
      });
      c.sprite.on(Phaser.Input.Events.POINTER_OUT, () => {
        void c.sprite.hoverLift(false);
        if (selected >= 0) focus(selected);
      });
      c.sprite.on(Phaser.Input.Events.POINTER_DOWN, () => select(i));
    });

    // ---- intro
    sfx.play('yourMove');
    sc.tweens.add({ targets: dim, alpha: 0.58, duration: 200 });
    const edgeT = sc.tweens.add({ targets: edge, alpha: { from: 0.2, to: 0.85 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    panel.y = -h;
    await tween(sc, { targets: panel, y: py, duration: 300, ease: 'Back.Out', easeParams: [1.3] });
    void shake(sc, 100, 1);
    for (let i = 0; i < n; i++) {
      sc.time.delayedCall(i * 90, () => {
        void cards[i].sprite.flip(true, 260);
        sfx.play('cardFlip', { volume: 0.6 });
      });
    }
    focus(Math.max(0, selected));
    void typeOn(sc, desc, 200);
    if (selected >= 0) {
      cards[selected].sprite.setHighlight(PAL.gold3);
      openBtn.setAttention(true);
    }

    const result = await new Promise<Uid | null>((resolve) => {
      let done = false;
      const finish = (v: Uid | null) => {
        if (done) return;
        done = true;
        this.removeKeys(keyFn);
        resolve(v);
      };
      openBtn.onClick = () => {
        if (selected >= 0) finish(cards[selected].opt.uid);
      };
      passBtn.onClick = () => finish(null);
      const keyFn = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          passBtn.click();
          return true;
        }
        if (e.key === 'Enter') {
          openBtn.click();
          return true;
        }
        const k = Number(e.key);
        if (Number.isInteger(k) && k >= 1 && k <= n) {
          select(k - 1);
          return true;
        }
        return false;
      };
      this.addKeys(keyFn);
    });

    // ---- outro
    edgeT.stop();
    if (result !== null) {
      const c = cards[selected];
      sfx.play('trapActivate', { volume: 0.8 });
      void c.sprite.pulse(R[4], 300);
      c.sprite.burst(R[3], 18);
      await tween(sc, { targets: c.sprite, y: c.sprite.y - 8, duration: 160, ease: 'Back.Out' });
    }
    sc.tweens.add({ targets: dim, alpha: 0, duration: 220 });
    sc.tweens.add({ targets: edge, alpha: 0, duration: 160 });
    await tween(sc, { targets: panel, y: GAME_H + 10, alpha: 0.4, duration: 240, ease: 'Back.In' });
    root.destroy();
    return result;
  }

  // ================================================================ instruction bar

  /** Top bar with an instruction (target selection etc.) and an İPTAL button. */
  instruction(text: string, opts: { cancel?: boolean; style?: 'gold' | 'p1' | 'p2' | 'trap' | 'spell' } = {}): InstructionHandle {
    const sc = this.scene;
    const style = opts.style ?? 'gold';
    const R = UI_RAMP[style];
    const showCancel = opts.cancel ?? true;
    const root = sc.add.container(0, 0).setDepth(DEPTH.BANNER - 1).setScrollFactor(0);
    let bar: Phaser.GameObjects.Container | null = null;
    let label: Phaser.GameObjects.BitmapText | null = null;
    let cancelBtn: Button | null = null;
    let resolveCancel: () => void = () => undefined;
    const cancelled = new Promise<void>((r) => (resolveCancel = r));
    let closed = false;
    let H = 21;
    const Y = 25;
    /** Widest bar that stays clear of the inspect panel (left) and the P2 panel (right). */
    const MAX_W = 2 * (UI.p2Panel.x - 4 - GAME_W / 2);

    const build = (s: string, animate: boolean) => {
      bar?.destroy();
      const extra = 20 + (showCancel ? 58 : 10);
      // md when it fits, else the small font, wrapped onto two lines if it must
      let size: TextSize = 'md';
      let m = measureText(s, 'md');
      if (m.w > MAX_W - extra) {
        size = 'sm';
        m = measureText(s, 'sm', MAX_W - extra);
      }
      const lines = wrapText(s, size, size === 'sm' ? MAX_W - extra : undefined).length;
      H = lines > 1 ? 9 + lines * textMetrics('sm').lineHeight : 21;
      const w = extra + m.w;
      const x = Math.round(GAME_W / 2 - w / 2);
      bar = sc.add.container(x, Y);
      const glow = sc.add.image(-GLOW_PAD, -GLOW_PAD, glowTex(sc, w, H)).setOrigin(0).setBlendMode(ADD).setTint(R[3]).setAlpha(0.45);
      const bg = sc.add.image(0, 0, panelTex(sc, style, w, H, { alpha: 245 })).setOrigin(0);
      const arrow = sc.add.image(7, Math.round(H / 2) - 4, ICON.caret).setOrigin(0).setTint(R[4]);
      const tm = textMetrics(size);
      const textTop = Math.floor((H - ((lines - 1) * tm.lineHeight + tm.capHeight)) / 2);
      label = pixelText(sc, 16, capY(size, textTop), s, { size, color: PAL.white, maxWidth: size === 'sm' ? MAX_W - extra : undefined });
      bar.add([glow, bg, arrow, label]);
      sc.tweens.add({ targets: arrow, x: 9, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      sc.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.7 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      if (showCancel) {
        cancelBtn = new Button(sc, w - 52, Math.round(H / 2) - 7, { w: 48, h: 15, label: 'İPTAL', size: 'sm', icon: ICON.close, style: 'neutral' });
        cancelBtn.onClick = () => doCancel();
        bar.add(cancelBtn);
      }
      root.add(bar);
      if (animate) {
        bar.y = -H - 6;
        sc.tweens.add({ targets: bar, y: Y, duration: 260, ease: 'Back.Out' });
        void typeOn(sc, label, 90);
      }
    };
    const keyFn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCancel) {
        cancelBtn?.click();
        return true;
      }
      return false;
    };
    const close = () => {
      if (closed) return;
      closed = true;
      this.removeKeys(keyFn);
      const b = bar;
      if (b) sc.tweens.add({ targets: b, y: -H - 8, duration: 180, ease: 'Quad.In', onComplete: () => root.destroy() });
      else root.destroy();
    };
    const doCancel = () => {
      if (closed) return;
      sfx.play('uiBack');
      close();
      resolveCancel();
    };
    this.addKeys(keyFn);
    build(text, true);
    sfx.play('uiConfirm', { volume: 0.4, pitch: 1.3 });
    return {
      close,
      cancelled,
      setText: (s: string) => {
        if (!closed) build(s, false);
      },
    };
  }

  // ================================================================ confirm

  /** Yes / no dialog. Enter = EVET, Esc = HAYIR. */
  async confirm(text: string, opts: { yes?: string; no?: string; style?: 'neutral' | 'gold' | 'p1' | 'p2' | 'trap' } = {}): Promise<boolean> {
    const sc = this.scene;
    const style = opts.style ?? 'neutral';
    const R = UI_RAMP[style];
    const root = sc.add.container(0, 0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    const dim = sc.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink).setOrigin(0).setAlpha(0).setInteractive();
    root.add(dim);
    const maxW = 220;
    const m = measureText(text, 'md', maxW);
    const w = Math.max(200, m.w + 32);
    const h = 30 + m.h + 36;
    const panel = sc.add.container(Math.round(GAME_W / 2), Math.round(GAME_H / 2 - 10));
    const glow = sc.add.image(-w / 2 - GLOW_PAD, -h / 2 - GLOW_PAD, glowTex(sc, w, h)).setOrigin(0).setBlendMode(ADD).setTint(R[3]).setAlpha(0.5);
    const bg = sc.add.image(-Math.round(w / 2), -Math.round(h / 2), panelTex(sc, style, w, h, { alpha: 248 })).setOrigin(0);
    const t = pixelText(sc, 0, -Math.round(h / 2) + 12, text, { size: 'md', color: PAL.white, maxWidth: maxW, align: 'center' });
    t.x = -Math.round(t.width / 2);
    const bw = 72;
    const yes = new Button(sc, -bw - 5, Math.round(h / 2) - 34, { w: bw, h: 25, label: opts.yes ?? 'EVET', icon: ICON.check, style: style === 'neutral' ? 'gold' : style });
    const no = new Button(sc, 5, Math.round(h / 2) - 34, { w: bw, h: 25, label: opts.no ?? 'HAYIR', style: 'neutral' });
    panel.add([glow, bg, t, yes, no]);
    root.add(panel);
    sc.tweens.add({ targets: dim, alpha: 0.5, duration: 160 });
    panel.setScale(0.85).setAlpha(0);
    sfx.play('uiConfirm', { volume: 0.5 });
    await tween(sc, { targets: panel, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' });
    yes.setAttention(true);
    const result = await new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        this.removeKeys(keyFn);
        resolve(v);
      };
      yes.onClick = () => finish(true);
      no.onClick = () => finish(false);
      const keyFn = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          yes.click();
          return true;
        }
        if (e.key === 'Escape') {
          no.click();
          return true;
        }
        return false;
      };
      this.addKeys(keyFn);
    });
    sc.tweens.add({ targets: dim, alpha: 0, duration: 160 });
    await tween(sc, { targets: panel, scale: 0.9, alpha: 0, duration: 140, ease: 'Quad.In' });
    root.destroy();
    return result;
  }

  // ================================================================ game over

  /** Victory screen: "KAZANAN / OYUNCU 1", sunburst, gold fireworks. Resolves on "Tekrar Oyna". */
  async gameOver(winner: PlayerId, reason?: WinReason): Promise<void> {
    const sc = this.scene;
    const R = UI_RAMP[playerStyle(winner)];
    const root = sc.add.container(0, 0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    const dim = sc.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink).setOrigin(0).setAlpha(0).setInteractive();
    root.add(dim);
    const cx = GAME_W / 2;
    const cy = 150;
    // sunburst rays
    const rays = sc.add.graphics().setPosition(cx, cy).setBlendMode(ADD).setAlpha(0);
    const nr = 14;
    for (let i = 0; i < nr; i++) {
      const a0 = (i / nr) * Math.PI * 2;
      const a1 = a0 + (Math.PI / nr) * 0.55;
      rays.fillStyle(i % 2 ? PAL.gold2 : R[2], 0.17);
      rays.fillTriangle(0, 0, Math.cos(a0) * 420, Math.sin(a0) * 420, Math.cos(a1) * 420, Math.sin(a1) * 420);
    }
    root.add(rays);
    const fx = sc.add.container(0, 0);
    root.add(fx);
    // band behind the title
    const band = sc.add.graphics();
    band.fillStyle(PAL.ink, 0.75).fillRect(0, cy - 34, GAME_W, 82);
    band.fillStyle(PAL.gold3).fillRect(0, cy - 34, GAME_W, 1).fillRect(0, cy + 47, GAME_W, 1);
    band.fillStyle(PAL.gold1).fillRect(0, cy - 32, GAME_W, 1).fillRect(0, cy + 45, GAME_W, 1);
    band.setAlpha(0);
    root.add(band);
    const crown = sc.add.image(cx, cy - 50, crownTex(sc, winner)).setScale(2).setAlpha(0);
    const kaz = pixelText(sc, cx, capY('lg', cy - 26), 'KAZANAN', { size: 'lg', color: PAL.gold4, originX: 0.5, shadow: 1 });
    kaz.setAlpha(0);
    const title = pixelLetters(sc, cx, capY('xl', cy + 2), NAME[winner], { size: 'xl', color: R[3], originX: 0.5, shadow: 1 });
    for (const l of title.letters) {
      l.obj.setAlpha(0);
    }
    root.add([crown, kaz, ...title.letters.map((l) => l.obj)]);
    const why = reason ? pixelText(sc, cx, capY('sm', cy + 34), REASON[reason], { size: 'sm', color: PAL.mist, originX: 0.5 }).setAlpha(0) : null;
    if (why) root.add(why);

    sfx.play('victory');
    // fireworks start right away so the first bursts pop as the title lands
    const fw = sc.time.addEvent({
      delay: 330,
      loop: true,
      callback: () => {
        this.firework(fx, R[3]);
        if (this.rnd() < 0.35) sc.time.delayedCall(90, () => this.firework(fx, R[3]));
      },
    });
    this.firework(fx, R[3]);
    sc.time.delayedCall(150, () => this.firework(fx, R[3]));
    sc.tweens.add({ targets: dim, alpha: 0.62, duration: 500 });
    sc.tweens.add({ targets: rays, alpha: 1, duration: 800, delay: 200 });
    const spin = (_t: number, dt: number) => {
      rays.rotation += (dt * sc.time.timeScale) / 9000;
    };
    sc.events.on(Phaser.Scenes.Events.UPDATE, spin);
    await wait(sc, 250);
    sc.tweens.add({ targets: band, alpha: 1, duration: 200 });
    kaz.y -= 16;
    sc.tweens.add({ targets: kaz, alpha: 1, y: kaz.y + 16, duration: 380, ease: 'Bounce.Out' });
    await wait(sc, 260);
    await this.slamLetters(title.letters, PAL.gold4, 60, true);
    void shake(sc, 260, 4);
    sfx.play('impactHeavy', { volume: 0.6 });
    crown.setScale(4);
    sc.tweens.add({ targets: crown, alpha: 1, scale: 2, duration: 260, ease: 'Back.Out' });
    // the crown keeps a slow bob + an occasional sparkle on its tips
    sc.tweens.add({ targets: crown, y: crown.y - 2, duration: 900, ease: 'Sine.InOut', yoyo: true, repeat: -1, delay: 300 });
    if (why) sc.tweens.add({ targets: why, alpha: 1, duration: 300, delay: 200 });
    void this.glint(title.letters, PAL.gold4);
    const glintEv = sc.time.addEvent({ delay: 2200, loop: true, callback: () => void this.glint(title.letters, PAL.gold4) });


    await wait(sc, 600);
    const again = new Button(sc, Math.round(cx - 64), cy + 74, { w: 128, h: 25, label: 'TEKRAR OYNA', icon: ICON.replay, style: 'gold' });
    root.add(again);
    again.setAlpha(0);
    again.y += 10;
    await tween(sc, { targets: again, alpha: 1, y: again.y - 10, duration: 260, ease: 'Back.Out' });
    again.setAttention(true);
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.removeKeys(keyFn);
        resolve();
      };
      again.onClick = finish;
      const keyFn = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          again.click();
          return true;
        }
        return false;
      };
      this.addKeys(keyFn);
    });
    fw.remove();
    glintEv.remove();
    await tween(sc, { targets: root, alpha: 0, duration: 320 });
    sc.events.off(Phaser.Scenes.Events.UPDATE, spin);
    root.destroy();
  }

  // ================================================================ shared effects

  /** Letters drop in one by one: big + transparent → land with a white flash → color. */
  private async slamLetters(letters: PixelLetter[], landColor: number, stagger: number, heavy = false): Promise<void> {
    const sc = this.scene;
    for (const l of letters) if (typeof l.obj.getData('baseTint') !== 'number') l.obj.setData('baseTint', l.obj.tintTopLeft);
    const jobs = letters.map(async (l, i) => {
      await wait(sc, i * stagger);
      const o = l.obj;
      // the glyph drops in from above, stretched by its speed (crisp: no zoomed-up blob)
      o.setAlpha(0).setScale(0.8, 1.45).setPosition(l.x, l.y - (heavy ? 26 : 18));
      o.setTint(PAL.white);
      sfx.play('uiClick', { volume: 0.35, pitch: 0.8 + (i % 5) * 0.08 });
      sc.tweens.add({ targets: o, alpha: 1, duration: heavy ? 70 : 50 });
      await tween(sc, { targets: o, scaleX: 1, scaleY: 1, y: l.y, duration: heavy ? 150 : 120, ease: 'Quad.In' });
      // squash on landing
      o.setScale(1.25, 0.8);
      void tween(sc, { targets: o, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.Out', easeParams: [3] });
      this.letterDust(l.x, l.y + 10, landColor);
      sc.time.delayedCall(50, () => o.setTint(landColor));
      sc.time.delayedCall(110, () => o.clearTint().setTint(baseTintOf(o)));
    });
    await Promise.all(jobs);
  }

  private letterDust(x: number, y: number, color: number): void {
    const sc = this.scene;
    for (let k = 0; k < 4; k++) {
      const dir = k < 2 ? -1 : 1;
      const sp = sc.add
        .image(x + dir * 4, y, TEX.px1)
        .setTint(k % 2 ? color : PAL.white)
        .setBlendMode(ADD)
        .setDepth(DEPTH.TRANSITION + 2)
        .setScrollFactor(0);
      sc.tweens.add({
        targets: sp,
        x: x + dir * (8 + k * 3),
        y: y - 2 - (k % 2) * 3,
        alpha: 0,
        duration: 220,
        ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  /** A white glint sweeps across the letters. */
  private async glint(letters: PixelLetter[], color: number): Promise<void> {
    const sc = this.scene;
    for (const l of letters) {
      if (!l.obj.active) return;
      l.obj.setTint(color);
      sc.time.delayedCall(45, () => {
        if (!l.obj.active) return;
        l.obj.setTint(PAL.white);
      });
      sc.time.delayedCall(90, () => {
        if (!l.obj.active) return;
        l.obj.clearTint().setTint(baseTintOf(l.obj));
      });
      await wait(sc, 22);
    }
  }

  private firework(layer: Phaser.GameObjects.Container, accent: number): void {
    const sc = this.scene;
    const x0 = 60 + this.rnd() * (GAME_W - 120);
    const tx = x0 + (this.rnd() - 0.5) * 80;
    const ty = 40 + this.rnd() * 110;
    const colors = [PAL.gold3, PAL.gold4, PAL.white, accent, this.rnd() < 0.5 ? PAL.mag3 : PAL.teal3];
    const main = colors[Math.floor(this.rnd() * colors.length)];
    const rocket = sc.add.image(x0, GAME_H + 4, TEX.px2).setTint(PAL.gold4).setBlendMode(ADD);
    layer.add(rocket);
    const trail = sc.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        const t = sc.add.image(rocket.x, rocket.y + 2, TEX.px1).setTint(PAL.gold2).setBlendMode(ADD);
        layer.add(t);
        sc.tweens.add({ targets: t, alpha: 0, y: t.y + 4, duration: 260, onComplete: () => t.destroy() });
      },
    });
    sc.tweens.add({
      targets: rocket,
      x: tx,
      y: ty,
      duration: 520 + this.rnd() * 200,
      ease: 'Quad.Out',
      onComplete: () => {
        trail.remove();
        rocket.destroy();
        this.burst(layer, tx, ty, main);
      },
    });
  }

  private burst(layer: Phaser.GameObjects.Container, x: number, y: number, color: number): void {
    const sc = this.scene;
    const n = 44;
    const sp0 = 52 + this.rnd() * 34;
    const ring = this.rnd() < 0.35;
    const flash = sc.add.image(x, y, TEX.spark).setTint(PAL.white).setBlendMode(ADD).setScale(4);
    layer.add(flash);
    sc.tweens.add({ targets: flash, scale: 0.5, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    const halo = sc.add.image(x, y, haloTex(sc, 12)).setTint(color).setBlendMode(ADD).setScale(1.5).setAlpha(0.7);
    layer.add(halo);
    sc.tweens.add({ targets: halo, scale: 3, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => halo.destroy() });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rnd() * 0.15;
      const sp = sp0 * (ring ? 0.95 + this.rnd() * 0.1 : 0.45 + this.rnd() * 0.6);
      const big = i % 6 === 0;
      const p = sc.add.image(x, y, big ? TEX.plus : TEX.px2).setTint(i % 4 === 0 ? PAL.white : color).setBlendMode(ADD);
      layer.add(p);
      const life = 800 + this.rnd() * 600;
      const o = { t: 0 };
      let last = 0;
      sc.tweens.add({
        targets: o,
        t: 1,
        duration: life,
        onUpdate: () => {
          const t = o.t;
          const d = sp * (1 - Math.pow(1 - t, 3));
          const px = Math.round(x + Math.cos(a) * d);
          const py = Math.round(y + Math.sin(a) * d * 0.85 + 34 * t * t);
          p.setPosition(px, py);
          p.setAlpha(t < 0.65 ? 1 : (1 - t) / 0.35);
          // twinkle late in life
          if (t > 0.55) p.setVisible(((t * 60) | 0) % 3 !== 0);
          // sparse falling glitter trail
          if (big && t - last > 0.08 && t < 0.8) {
            last = t;
            const g = sc.add.image(px, py, TEX.px1).setTint(PAL.gold4).setBlendMode(ADD);
            layer.add(g);
            sc.tweens.add({ targets: g, y: py + 6, alpha: 0, duration: 380, onComplete: () => g.destroy() });
          }
        },
        onComplete: () => p.destroy(),
      });
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

/** The tint a pixelLetters() glyph was created with (top-left vertex tint). */
function baseTintOf(o: Phaser.GameObjects.BitmapText): number {
  const stored = o.getData('baseTint');
  if (typeof stored === 'number') return stored;
  const v = o.tintTopLeft;
  o.setData('baseTint', v);
  return v;
}
