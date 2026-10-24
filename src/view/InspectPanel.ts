// InspectPanel — the hovered / selected card at 2× in the upper-left (UI.inspect), with its
// name, type line, current ATK/DEF (buffs green ▲, debuffs red ▼) and the effect or flavor text.
//
//   const inspect = new InspectPanel(scene);
//   inspect.show('crystal_wyrm');                       // slides in, card flips up, text types in
//   inspect.show('ember_wolf', { atk: 2200 });          // swap: card spins over, stats re-roll
//   inspect.show(null);                                 // a face-down card ("Kapalı Kart")
//   inspect.hide();                                     // slides out after a short grace delay
//
// The card floats over a pulsing aura in its accent color with drifting motes; aces keep their
// holo-foil sweep. Panel trim follows the card kind (monster gold, spell teal, trap magenta).
//
// Arena v2 (layout ARENA_VARIANT) uses the compact InspectPanelV2 below — same API: the card's
// 44×34 artwork in a floating window, level stars + ATK/DEF beside it, the type line and the text.

import Phaser from 'phaser';
import { ATTRIBUTE_NAMES, type CardId, cardDef, isMonster, isSpell } from '../data/cards';
import { cardAccent, cardArtKey, cardBackCanvas } from '../art/cards';
import { PAL, RAMPS } from '../art/palette';
import { mix } from '../art/pixel';
import { measureText, pixelText, textMetrics, type TextSize } from '../ui/text';
import { TEX, tween } from '../vfx/core';
import { CardSprite } from './CardSprite';
import { ARENA_V2, DEPTH, UI } from './layout';
import type { PlayerId } from '../engine/types';
import { V3_A6_A } from './v3flags';
import { InspectPanelV3, type PileKind } from './v3/inspectV3';
import { GLOW_PAD, ICON, SHEEN_FRAMES, type UiStyle, glowTex, ovalHaloTex, panelSheenTex, panelTex, typeOn } from './ui-textures';

export interface InspectStats {
  atk?: number;
  def?: number;
  /** v3 (lane A6-A): a face-down card's owner — its back is shown in that player's tone (S-2). */
  owner?: PlayerId;
}

const ADD = Phaser.BlendModes.ADD;
const R = UI.inspect;
const CARD_CX = 64;
const CARD_CY = 74;
const TEXT_W = R.w - 14;
const SPELL_TYPE: Record<string, string> = { normal: 'Normal', equip: 'Kuşanma', field: 'Alan' };

function capY(size: TextSize, capTop: number): number {
  return capTop - textMetrics(size).capTop;
}

function styleOf(id: CardId | null): UiStyle {
  if (!id) return 'neutral';
  const d = cardDef(id);
  return d.kind === 'monster' ? 'gold' : d.kind === 'spell' ? 'spell' : 'trap';
}

/** The original (v1) inspect panel: a 2× card over an aura + text in the 128×236 column. */
class InspectPanelV1 {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly bgNext: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly card: CardSprite;
  private name: Phaser.GameObjects.BitmapText;
  private readonly typeLine: Phaser.GameObjects.BitmapText;
  private readonly divider: Phaser.GameObjects.Graphics;
  private readonly stats: Phaser.GameObjects.Container;
  private readonly atkIcon: Phaser.GameObjects.Image;
  private readonly defIcon: Phaser.GameObjects.Image;
  private readonly atkText: Phaser.GameObjects.BitmapText;
  private readonly defText: Phaser.GameObjects.BitmapText;
  private body: Phaser.GameObjects.BitmapText;
  private readonly motes: { img: Phaser.GameObjects.Image; t: number; x: number; speed: number; life: number }[] = [];
  private readonly updateFn: (t: number, dt: number) => void;
  private shown = false;
  private current: CardId | null | undefined = undefined;
  private currentStats: InspectStats = {};
  private style: UiStyle = 'gold';
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private auraTween: Phaser.Tweens.Tween | null = null;
  private slideTween: Phaser.Tweens.Tween | null = null;
  private bob = 0;
  private token = 0;
  private seed = 0x51ed27;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(R.x, R.y).setDepth(DEPTH.INSPECT).setScrollFactor(0);
    this.glow = scene.add
      .image(-GLOW_PAD, -GLOW_PAD, glowTex(scene, R.w, R.h))
      .setOrigin(0)
      .setBlendMode(ADD)
      .setAlpha(0.35);
    this.bg = scene.add.image(0, 0, panelTex(scene, 'gold', R.w, R.h, { header: 0 })).setOrigin(0);
    this.bgNext = scene.add.image(0, 0, panelTex(scene, 'gold', R.w, R.h)).setOrigin(0).setAlpha(0);
    this.aura = scene.add
      .image(CARD_CX, CARD_CY, ovalHaloTex(scene, 62, 82))
      .setBlendMode(ADD)
      .setAlpha(0.5);
    this.card = new CardSprite(scene, CARD_CX, CARD_CY, null, { faceUp: false }).setScale(2);
    this.name = pixelText(scene, R.w / 2, 0, '', { size: 'md', color: PAL.white });
    this.typeLine = pixelText(scene, R.w / 2, 0, '', { size: 'sm', color: PAL.gold3 });
    this.divider = scene.add.graphics();
    this.stats = scene.add.container(0, 0);
    this.atkIcon = scene.add.image(0, 0, ICON.atk).setOrigin(0);
    this.defIcon = scene.add.image(0, 0, ICON.def).setOrigin(0);
    this.atkText = pixelText(scene, 0, 0, '', { size: 'md' });
    this.defText = pixelText(scene, 0, 0, '', { size: 'md' });
    this.stats.add([this.atkIcon, this.atkText, this.defIcon, this.defText]);
    this.body = pixelText(scene, 7, 0, '', { size: 'sm', color: PAL.mist, maxWidth: TEXT_W, lineSpacing: -1 });
    this.root.add([this.glow, this.bg, this.bgNext, this.aura, this.card, this.name, this.typeLine, this.divider, this.stats, this.body]);
    for (let i = 0; i < 14; i++) {
      const img = scene.add.image(0, 0, i % 4 === 0 ? TEX.px2 : TEX.px1).setBlendMode(ADD).setAlpha(0);
      this.root.addAt(img, 4);
      this.motes.push({ img, t: this.rnd(), x: 16 + this.rnd() * (R.w - 32), speed: 0.12 + this.rnd() * 0.18, life: 0.6 + this.rnd() * 0.4 });
    }
    this.root.x = -R.w - 12;
    this.root.setVisible(false);
    this.updateFn = (_t, dt) => this.tick(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateFn);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Show a card (null = face-down card). Updates in place if already showing. */
  show(cardId: CardId | null, stats: InspectStats = {}): void {
    this.hideTimer?.remove();
    this.hideTimer = null;
    const same = this.shown && cardId === this.current;
    if (same) {
      if (stats.atk !== this.currentStats.atk || stats.def !== this.currentStats.def) {
        this.currentStats = { ...stats };
        this.fillStats(cardId, true);
      }
      return;
    }
    const token = ++this.token;
    const first = !this.shown;
    this.current = cardId;
    this.currentStats = { ...stats };
    this.shown = true;
    const fill = () => {
      this.setStyle(styleOf(cardId), !first);
      this.fillText(cardId);
      this.fillStats(cardId, false);
    };
    if (first) fill();
    else {
      // swap the words when the card is edge-on, not before
      this.scene.time.delayedCall(70, () => {
        if (token !== this.token) return;
        fill();
        this.typeIn(token, 0);
      });
    }
    if (first) {
      this.slideTween?.stop();
      this.root.setVisible(true);
      this.card.setCard(cardId).setFaceUp(false);
      this.slideTween = this.scene.tweens.add({ targets: this.root, x: R.x, duration: 260, ease: 'Back.Out', easeParams: [1.2] });
      this.scene.time.delayedCall(90, () => {
        if (token !== this.token) return;
        void this.card.flip(cardId !== null, 280);
      });
      this.typeIn(token, 120);
    } else {
      // swap: the card spins over to the new face
      this.slideTween?.stop();
      this.root.x = R.x;
      void this.swapCard(cardId, token);
    }
  }

  /** Hide after a short grace delay (moving between cards does not flicker). */
  hide(immediate = false): void {
    if (!this.shown) return;
    this.hideTimer?.remove();
    const go = () => {
      this.hideTimer = null;
      this.shown = false;
      this.current = undefined;
      this.token++;
      this.slideTween?.stop();
      this.slideTween = this.scene.tweens.add({
        targets: this.root,
        x: -R.w - 12,
        duration: 180,
        ease: 'Quad.In',
        onComplete: () => this.root.setVisible(false),
      });
    };
    if (immediate) go();
    else this.hideTimer = this.scene.time.delayedCall(140, go);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateFn);
    this.hideTimer?.remove();
    this.auraTween?.stop();
    this.root.destroy();
  }

  // ------------------------------------------------------------ content

  private setStyle(style: UiStyle, animate: boolean): void {
    const key = panelTex(this.scene, style, R.w, R.h);
    const accent = this.current ? cardAccent(this.current) : PAL.steel;
    this.glow.setTint(style === 'neutral' ? PAL.steel : mix(accent, PAL.white, 0.2));
    this.aura.setTint(accent);
    this.auraTween?.stop();
    this.auraTween = this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.32, to: 0.62 },
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.97, to: 1.03 },
      duration: 1300,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    for (const m of this.motes) m.img.setTint(this.rnd() < 0.3 ? PAL.white : accent);
    if (style === this.style && this.bg.texture.key === key) return;
    this.style = style;
    if (!animate) {
      this.bg.setTexture(key);
      this.bgNext.setAlpha(0);
      return;
    }
    this.scene.tweens.killTweensOf(this.bgNext);
    this.bgNext.setTexture(key).setAlpha(0);
    this.scene.tweens.add({
      targets: this.bgNext,
      alpha: 1,
      duration: 160,
      onComplete: () => {
        this.bg.setTexture(key);
        this.bgNext.setAlpha(0);
      },
    });
  }

  private fillText(id: CardId | null): void {
    const accent = id ? cardAccent(id) : PAL.steel;
    let name = 'Kapalı Kart';
    let type = 'Gizli';
    let text = 'Bu kartın ne olduğu rakibinden gizli.';
    let flavor = false;
    if (id) {
      const d = cardDef(id);
      name = d.name;
      if (isMonster(d)) {
        type = `${ATTRIBUTE_NAMES[d.attribute]} / ${d.race} ★${d.level}`;
        text = d.text || `"${d.flavor}"`;
        flavor = !d.text;
      } else if (isSpell(d)) {
        type = `Büyü · ${SPELL_TYPE[d.spellType] ?? 'Normal'}`;
        text = d.text;
      } else {
        type = 'Tuzak · Normal';
        text = d.text;
      }
    }
    // name: md, falls back to sm when too wide
    const nameSize: TextSize = measureText(name, 'md').w <= R.w - 6 ? 'md' : 'sm';
    this.name.destroy();
    const nameY = 150;
    this.name = pixelText(this.scene, 0, capY(nameSize, nameY + (nameSize === 'sm' ? 1 : 0)), name, {
      size: nameSize,
      color: PAL.white,
    });
    this.name.x = Math.round(R.w / 2 - this.name.width / 2);
    this.root.add(this.name);
    this.typeLine.setText(type).setTint(mix(accent, PAL.white, 0.15));
    this.typeLine.setPosition(Math.round(R.w / 2 - this.typeLine.width / 2), capY('sm', nameY + 11));
    // divider with a center diamond
    const dy = nameY + 19;
    const g = this.divider;
    g.clear();
    g.fillStyle(mix(accent, PAL.night1, 0.55)).fillRect(8, dy, R.w - 16, 1);
    g.fillStyle(accent).fillRect(R.w / 2 - 12, dy, 24, 1);
    g.fillStyle(PAL.ink).fillRect(R.w / 2 - 2, dy - 2, 5, 5);
    g.fillStyle(accent).fillRect(R.w / 2 - 1, dy - 1, 3, 3);
    g.fillStyle(PAL.white).fillRect(R.w / 2, dy, 1, 1);
    const hasStats = !!id && isMonster(cardDef(id));
    this.stats.setVisible(hasStats);
    this.stats.y = dy + 5;
    const bodyY = (hasStats ? dy + 15 : dy + 5) - 1;
    // long texts tighten their leading so they always fit inside the panel (the line pitch is
    // a creation option of pixelText, so the body is rebuilt rather than re-spaced)
    const room = R.h - 3 - bodyY;
    const tight = measureText(text, 'sm', TEXT_W, true, -1).h > room;
    const idx = this.root.getIndex(this.body);
    this.body.destroy();
    this.body = pixelText(this.scene, 7, bodyY, text, {
      size: 'sm',
      color: flavor ? mix(PAL.mist, accent, 0.25) : PAL.white,
      maxWidth: TEXT_W,
      lineSpacing: tight ? -2 : -1,
    });
    this.root.addAt(this.body, idx);
  }

  private fillStats(id: CardId | null, animate: boolean): void {
    if (!id) return;
    const d = cardDef(id);
    if (!isMonster(d)) return;
    const atk = this.currentStats.atk ?? d.atk;
    const def = this.currentStats.def ?? d.def;
    const fmt = (v: number, base: number) => (v > base ? `${v}↑` : v < base ? `${v}↓` : String(v));
    const col = (v: number, base: number) => (v > base ? PAL.leaf3 : v < base ? PAL.crim3 : PAL.white);
    this.atkText.setText(fmt(atk, d.atk)).setTint(col(atk, d.atk));
    this.defText.setText(fmt(def, d.def)).setTint(col(def, d.def));
    // layout: [⚔ 2800]   [⛨ 2300] centered in the panel
    const gap = 12;
    const w1 = this.atkIcon.width + 3 + this.atkText.width;
    const w2 = this.defIcon.width + 3 + this.defText.width;
    let x = Math.round(R.w / 2 - (w1 + gap + w2) / 2);
    this.atkIcon.setPosition(x, 0).setTint(PAL.fire3);
    this.atkText.setPosition(x + this.atkIcon.width + 3, capY('md', 1));
    x += w1 + gap;
    this.defIcon.setPosition(x, -1).setTint(PAL.water3);
    this.defText.setPosition(x + this.defIcon.width + 3, capY('md', 1));
    if (animate) {
      for (const t of [this.atkText, this.defText]) {
        t.setTint(PAL.white);
        this.scene.time.delayedCall(60, () => this.fillStats(id, false));
      }
    }
  }

  private typeIn(token: number, delay: number): void {
    this.body.setAlpha(0);
    this.scene.time.delayedCall(delay, () => {
      if (token !== this.token) return;
      this.body.setAlpha(1);
      void typeOn(this.scene, this.body, 240);
    });
    // name + type line pop
    for (const [t, d] of [
      [this.name, 0],
      [this.typeLine, 40],
      [this.stats, 70],
    ] as const) {
      const y0 = t.y;
      t.setAlpha(0).setY(y0 + 3);
      this.scene.tweens.add({ targets: t, alpha: 1, y: y0, delay: delay + d, duration: 160, ease: 'Back.Out' });
    }
  }

  private async swapCard(id: CardId | null, token: number): Promise<void> {
    const inner = this.card.inner;
    this.scene.tweens.killTweensOf(inner);
    await tween(this.scene, { targets: inner, scaleX: 0, duration: 70, ease: 'Quad.In' });
    if (token !== this.token) {
      inner.scaleX = 1;
      return;
    }
    this.card.setCard(id).setFaceUp(id !== null);
    await tween(this.scene, { targets: inner, scaleX: 1, duration: 140, ease: 'Back.Out', easeParams: [2] });
    if (token !== this.token) return;
    this.card.playSweep(false);
    if (id) this.card.burst(cardAccent(id), 10);
  }

  // ------------------------------------------------------------ idle life

  private tick(dt: number): void {
    if (!this.shown && !this.root.visible) return;
    const k = this.scene.time.timeScale;
    this.bob += (dt * k) / 1000;
    // gentle float (whole pixels)
    this.card.y = CARD_CY + Math.round(Math.sin(this.bob * 2.2) * 1.4);
    for (const m of this.motes) {
      m.t += ((dt * k) / 1000) * m.speed;
      if (m.t > m.life) {
        m.t = 0;
        m.x = 16 + this.rnd() * (R.w - 32);
      }
      const u = m.t / m.life;
      m.img.setPosition(Math.round(m.x + Math.sin(u * 6 + m.x) * 3), Math.round(CARD_CY + 66 - u * 140));
      m.img.setAlpha(Math.sin(u * Math.PI) * 0.9);
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

// ====================================================================== v2 (compact)

/**
 * v2 compact layout inside UI.inspect (116×110), panel-relative:
 *   header (13)  card name, centered (md, sm when long)
 *   art box      the card's 44×34 artwork in a framed, softly floating window (left)
 *   side column  monsters: level stars, ATK, DEF — spells/traps: kind badge + subtype
 *   type rule    "IŞIK / Ejderha" between two thin accent rules
 *   body         effect (or flavor) text, 4 lines at pitch 10 or 5 at pitch 9
 */
const V2 = {
  header: 13,
  /** Top-left of the 44×34 artwork (frame is 2 px around it). */
  art: { x: 6, y: 16, w: 44, h: 34 },
  side: 55,
  starY: 16,
  atkY: 26,
  defY: 38,
  typeCap: 55,
  bodyCap: 64,
  bodyX: 5,
  textW: 106,
};

const BACK_ART = 'ui:inspect:backart';

function backArtKey(scene: Phaser.Scene): string {
  if (!scene.textures.exists(BACK_ART)) scene.textures.addCanvas(BACK_ART, cardBackCanvas().crop(2, 17, V2.art.w, V2.art.h).toCanvas());
  return BACK_ART;
}

class InspectPanelV2 {
  private readonly scene: Phaser.Scene;
  private readonly R = UI.inspect;
  private readonly root: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly bgNext: Phaser.GameObjects.Image;
  /** Art window (frame + aura + art + sheen) — floats a pixel up and down. */
  private readonly artBox: Phaser.GameObjects.Container;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly art: Phaser.GameObjects.Image;
  private readonly sheen: Phaser.GameObjects.Image;
  private name: Phaser.GameObjects.BitmapText;
  private readonly side: Phaser.GameObjects.Container;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly typeLine: Phaser.GameObjects.BitmapText;
  private readonly rules: Phaser.GameObjects.Graphics;
  private body: Phaser.GameObjects.BitmapText;
  private atkText: Phaser.GameObjects.BitmapText | null = null;
  private defText: Phaser.GameObjects.BitmapText | null = null;
  private readonly motes: { img: Phaser.GameObjects.Image; t: number; x: number; speed: number; life: number }[] = [];
  private readonly updateFn: (t: number, dt: number) => void;
  private shown = false;
  private current: CardId | null | undefined = undefined;
  private currentStats: InspectStats = {};
  private style: UiStyle = 'gold';
  private accent: number = PAL.gold3;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private auraTween: Phaser.Tweens.Tween | null = null;
  private slideTween: Phaser.Tweens.Tween | null = null;
  private sheenEvent: Phaser.Time.TimerEvent | null = null;
  private twinkle = 0;
  private bob = 0;
  private token = 0;
  private seed = 0x51ed27;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const R = this.R;
    const A = V2.art;
    this.root = scene.add.container(R.x, R.y).setDepth(DEPTH.INSPECT).setScrollFactor(0);
    this.glow = scene.add.image(-GLOW_PAD, -GLOW_PAD, glowTex(scene, R.w, R.h)).setOrigin(0).setBlendMode(ADD).setAlpha(0.35);
    this.bg = scene.add.image(0, 0, panelTex(scene, 'gold', R.w, R.h, { header: V2.header })).setOrigin(0);
    this.bgNext = scene.add.image(0, 0, panelTex(scene, 'gold', R.w, R.h, { header: V2.header })).setOrigin(0).setAlpha(0);
    // art window, centered on the artwork so it can flip (scaleX) like a card
    const acx = A.x + A.w / 2;
    const acy = A.y + A.h / 2;
    this.artBox = scene.add.container(acx, acy);
    this.aura = scene.add.image(0, 0, ovalHaloTex(scene, 34, 27)).setBlendMode(ADD).setAlpha(0.45);
    this.frame = scene.add.graphics();
    this.art = scene.add.image(0, 0, backArtKey(scene));
    this.sheen = scene.add.image(0, 0, panelSheenTex(scene, A.w, A.h, 0), 's:0').setBlendMode(ADD).setAlpha(0.6).setVisible(false);
    this.artBox.add([this.aura, this.frame, this.art, this.sheen]);
    this.name = pixelText(scene, 0, 0, '', { size: 'md', color: PAL.white });
    this.side = scene.add.container(0, 0);
    this.typeLine = pixelText(scene, 0, 0, '', { size: 'sm', color: PAL.gold3 });
    this.rules = scene.add.graphics();
    this.body = pixelText(scene, V2.bodyX, 0, '', { size: 'sm', color: PAL.white, maxWidth: V2.textW, lineSpacing: -1 });
    this.root.add([this.glow, this.bg, this.bgNext, this.artBox, this.name, this.side, this.rules, this.typeLine, this.body]);
    // motes rise through the art window and fade near the header
    for (let i = 0; i < 9; i++) {
      const img = scene.add.image(0, 0, i % 4 === 0 ? TEX.px2 : TEX.px1).setBlendMode(ADD).setAlpha(0);
      this.root.addAt(img, this.root.getIndex(this.artBox) + 1);
      this.motes.push({ img, t: this.rnd(), x: A.x + 2 + this.rnd() * (A.w - 4), speed: 0.16 + this.rnd() * 0.2, life: 0.6 + this.rnd() * 0.4 });
    }
    this.drawFrame();
    this.root.x = -R.w - 12;
    this.root.setVisible(false);
    this.updateFn = (_t, dt) => this.tick(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateFn);
    // a holo sweep crosses the artwork every few seconds while the panel is up
    this.sheenEvent = scene.time.addEvent({ delay: 2800, startAt: 1400, loop: true, callback: () => this.playSheen() });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get visible(): boolean {
    return this.shown;
  }

  show(cardId: CardId | null, stats: InspectStats = {}): void {
    this.hideTimer?.remove();
    this.hideTimer = null;
    const same = this.shown && cardId === this.current;
    if (same) {
      if (stats.atk !== this.currentStats.atk || stats.def !== this.currentStats.def) {
        this.currentStats = { ...stats };
        this.fillSide(cardId, true);
      }
      return;
    }
    const token = ++this.token;
    const first = !this.shown;
    this.current = cardId;
    this.currentStats = { ...stats };
    this.shown = true;
    const fill = () => {
      this.setStyle(styleOf(cardId), !first);
      this.fillText(cardId);
      this.fillSide(cardId, false);
    };
    this.slideTween?.stop();
    if (first) {
      fill();
      this.root.setVisible(true);
      this.art.setTexture(backArtKey(this.scene));
      this.slideTween = this.scene.tweens.add({ targets: this.root, x: this.R.x, duration: 240, ease: 'Back.Out', easeParams: [1.2] });
      // the artwork turns over from the card back once the panel has landed
      this.scene.time.delayedCall(90, () => token === this.token && void this.flipArt(cardId, token, 110));
      this.typeIn(token, 110);
    } else {
      this.root.x = this.R.x;
      // swap: the words change when the art is edge-on, not before
      this.scene.time.delayedCall(70, () => {
        if (token !== this.token) return;
        fill();
        this.typeIn(token, 0);
      });
      void this.flipArt(cardId, token, 70);
    }
  }

  hide(immediate = false): void {
    if (!this.shown) return;
    this.hideTimer?.remove();
    const go = () => {
      this.hideTimer = null;
      this.shown = false;
      this.current = undefined;
      this.token++;
      this.slideTween?.stop();
      this.slideTween = this.scene.tweens.add({
        targets: this.root,
        x: -this.R.w - 12,
        duration: 170,
        ease: 'Quad.In',
        onComplete: () => this.root.setVisible(false),
      });
    };
    if (immediate) go();
    else this.hideTimer = this.scene.time.delayedCall(140, go);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateFn);
    this.hideTimer?.remove();
    this.sheenEvent?.remove();
    this.auraTween?.stop();
    this.root.destroy();
  }

  // ------------------------------------------------------------ content

  private setStyle(style: UiStyle, animate: boolean): void {
    const R = this.R;
    const key = panelTex(this.scene, style, R.w, R.h, { header: V2.header });
    const accent = this.current ? cardAccent(this.current) : PAL.steel;
    this.accent = accent;
    this.glow.setTint(style === 'neutral' ? PAL.steel : mix(accent, PAL.white, 0.2));
    this.aura.setTint(accent);
    this.auraTween?.stop();
    this.auraTween = this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.3, to: 0.6 },
      scaleX: { from: 0.95, to: 1.05 },
      scaleY: { from: 0.96, to: 1.04 },
      duration: 1300,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    for (const m of this.motes) m.img.setTint(this.rnd() < 0.3 ? PAL.white : accent);
    this.drawFrame();
    if (style === this.style && this.bg.texture.key === key) return;
    this.style = style;
    if (!animate) {
      this.bg.setTexture(key);
      this.bgNext.setAlpha(0);
      return;
    }
    this.scene.tweens.killTweensOf(this.bgNext);
    this.bgNext.setTexture(key).setAlpha(0);
    this.scene.tweens.add({
      targets: this.bgNext,
      alpha: 1,
      duration: 160,
      onComplete: () => {
        this.bg.setTexture(key);
        this.bgNext.setAlpha(0);
      },
    });
  }

  /** Ink + accent frame around the artwork (lit from the top-left), corner rivets. */
  private drawFrame(): void {
    const A = V2.art;
    const g = this.frame;
    const c = this.accent;
    const x0 = -A.w / 2 - 2;
    const y0 = -A.h / 2 - 2;
    const w = A.w + 4;
    const h = A.h + 4;
    g.clear();
    g.fillStyle(PAL.ink).fillRect(x0, y0, w, h);
    g.fillStyle(mix(c, PAL.night1, 0.35)).fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
    g.fillStyle(mix(c, PAL.white, 0.25)).fillRect(x0 + 1, y0 + 1, w - 2, 1).fillRect(x0 + 1, y0 + 1, 1, h - 2);
    g.fillStyle(PAL.white).fillRect(x0 + 1, y0 + 1, 2, 1).fillRect(x0 + 1, y0 + 1, 1, 2);
  }

  private fillText(id: CardId | null): void {
    const R = this.R;
    const accent = id ? cardAccent(id) : PAL.steel;
    let name = 'Kapalı Kart';
    let type = 'Gizli';
    let text = 'Bu kartın ne olduğu rakibinden gizli.';
    let flavor = false;
    if (id) {
      const d = cardDef(id);
      name = d.name;
      if (isMonster(d)) {
        type = `${ATTRIBUTE_NAMES[d.attribute]} / ${d.race}`;
        if (measureText(type, 'sm').w > V2.textW - 12) type = d.race;
        text = d.text || `"${d.flavor}"`;
        flavor = !d.text;
      } else if (isSpell(d)) {
        type = `Büyü Kartı · ${SPELL_TYPE[d.spellType] ?? 'Normal'}`;
        text = d.text;
      } else {
        type = 'Tuzak Kartı · Normal';
        text = d.text;
      }
    }
    // name: md, the small font when too wide
    const nameSize: TextSize = measureText(name, 'md').w <= R.w - 8 ? 'md' : 'sm';
    const nameIdx = this.root.getIndex(this.name);
    this.name.destroy();
    this.name = pixelText(this.scene, 0, capY(nameSize, nameSize === 'md' ? 4 : 5), name, { size: nameSize, color: PAL.white });
    this.name.x = Math.round(R.w / 2 - this.name.width / 2);
    this.root.addAt(this.name, nameIdx);
    // type line between two thin rules (diamond studs at the outer ends)
    this.typeLine.setText(type).setTint(mix(accent, PAL.white, 0.2));
    const tw = Math.round(this.typeLine.width);
    const tx = Math.round(R.w / 2 - tw / 2);
    this.typeLine.setPosition(tx, capY('sm', V2.typeCap));
    const ry = V2.typeCap + 2;
    const g = this.rules;
    const dim = mix(accent, PAL.night1, 0.5);
    g.clear();
    const l0 = 6;
    const l1 = tx - 2;
    const r0 = tx + tw + 2;
    const r1 = R.w - 7;
    if (l1 > l0 + 4) {
      g.fillStyle(dim).fillRect(l0 + 2, ry, l1 - l0 - 2, 1);
      g.fillStyle(accent).fillRect(l1 - 6, ry, 6, 1);
      g.fillStyle(accent).fillRect(l0, ry - 1, 1, 3).fillRect(l0 - 1, ry, 3, 1);
    }
    if (r1 > r0 + 4) {
      g.fillStyle(dim).fillRect(r0, ry, r1 - r0 - 2, 1);
      g.fillStyle(accent).fillRect(r0, ry, 6, 1);
      g.fillStyle(accent).fillRect(r1, ry - 1, 1, 3).fillRect(r1 - 1, ry, 3, 1);
    }
    // body: pitch 10, tightened to 9 when five lines are needed
    const room = R.h - 3 - capY('sm', V2.bodyCap);
    const tight = measureText(text, 'sm', V2.textW, true, -1).h > room;
    const idx = this.root.getIndex(this.body);
    this.body.destroy();
    this.body = pixelText(this.scene, V2.bodyX, capY('sm', V2.bodyCap), text, {
      size: 'sm',
      color: flavor ? mix(PAL.mist, accent, 0.25) : PAL.white,
      maxWidth: V2.textW,
      lineSpacing: tight ? -2 : -1,
    });
    this.root.addAt(this.body, idx);
  }

  /** Right of the art: level stars + ATK/DEF (monsters), a kind badge (spells / traps), or "?". */
  private fillSide(id: CardId | null, animate: boolean): void {
    const sc = this.scene;
    const x = V2.side;
    if (!animate) {
      this.side.removeAll(true);
      this.stars.length = 0;
      this.atkText = null;
      this.defText = null;
    }
    if (!id) {
      if (animate) return;
      const q = pixelText(sc, x + 18, capY('lg', V2.atkY - 4), '?', { size: 'lg', color: PAL.steel });
      this.side.add(q);
      return;
    }
    const d = cardDef(id);
    if (!isMonster(d)) {
      if (animate) return;
      const spell = d.kind === 'spell';
      const ramp = spell ? RAMPS.teal : RAMPS.mag;
      const icon = sc.add.image(x, V2.starY + 1, spell ? ICON.spell : ICON.trap).setOrigin(0).setTint(ramp[4]);
      const kind = pixelText(sc, x + 12, capY('md', V2.starY + 2), spell ? 'BÜYÜ' : 'TUZAK', { size: 'md', color: ramp[3] });
      const sub = isSpell(d) ? SPELL_TYPE[d.spellType] ?? 'Normal' : 'Karşı Hamle';
      const subT = pixelText(sc, x, capY('sm', V2.atkY + 4), sub, { size: 'sm', color: mix(ramp[4], PAL.white, 0.3) });
      const when = pixelText(sc, x, capY('sm', V2.defY + 2), spell ? 'Ana Aşama' : 'Rakip turu', { size: 'sm', color: PAL.steel });
      this.side.add([icon, kind, subT, when]);
      return;
    }
    const atk = this.currentStats.atk ?? d.atk;
    const def = this.currentStats.def ?? d.def;
    const fmt = (v: number, base: number) => (v > base ? `${v}↑` : v < base ? `${v}↓` : String(v));
    const col = (v: number, base: number) => (v > base ? PAL.leaf3 : v < base ? PAL.crim3 : PAL.white);
    if (!animate) {
      // level stars (gold; aces burn brighter)
      for (let i = 0; i < d.level; i++) {
        const st = sc.add.image(x + i * 6, V2.starY, ICON.star).setOrigin(0).setTint(d.ace ? PAL.gold4 : PAL.gold3);
        this.stars.push(st);
        this.side.add(st);
      }
      const ai = sc.add.image(x, V2.atkY, ICON.atk).setOrigin(0).setTint(PAL.fire3);
      const di = sc.add.image(x, V2.defY - 1, ICON.def).setOrigin(0).setTint(PAL.water3);
      this.atkText = pixelText(sc, x + 12, capY('md', V2.atkY + 1), '', { size: 'md' });
      this.defText = pixelText(sc, x + 12, capY('md', V2.defY + 1), '', { size: 'md' });
      this.side.add([ai, di, this.atkText, this.defText]);
    }
    if (!this.atkText || !this.defText) return;
    this.atkText.setText(fmt(atk, d.atk)).setTint(col(atk, d.atk));
    this.defText.setText(fmt(def, d.def)).setTint(col(def, d.def));
    if (animate) {
      for (const t of [this.atkText, this.defText]) {
        t.setTint(PAL.white);
        const y0 = t.y;
        t.y = y0 - 2;
        this.scene.tweens.add({ targets: t, y: y0, duration: 160, ease: 'Bounce.Out' });
      }
      this.scene.time.delayedCall(60, () => {
        if (!this.atkText?.active || !this.defText?.active) return;
        this.atkText.setTint(col(atk, d.atk));
        this.defText.setTint(col(def, d.def));
      });
    }
  }

  private typeIn(token: number, delay: number): void {
    this.body.setAlpha(0);
    this.scene.time.delayedCall(delay, () => {
      if (token !== this.token) return;
      this.body.setAlpha(1);
      void typeOn(this.scene, this.body, 260);
    });
    for (const [t, d] of [
      [this.name, 0],
      [this.side, 40],
      [this.typeLine, 60],
    ] as const) {
      const y0 = t.y;
      t.setAlpha(0).setY(y0 + 3);
      this.scene.tweens.add({ targets: t, alpha: 1, y: y0, delay: delay + d, duration: 160, ease: 'Back.Out' });
    }
  }

  /** The art window turns edge-on, swaps to the new artwork and springs back (+ sweep, sparks). */
  private async flipArt(id: CardId | null, token: number, outMs: number): Promise<void> {
    const box = this.artBox;
    this.scene.tweens.killTweensOf(box);
    await tween(this.scene, { targets: box, scaleX: 0, duration: outMs, ease: 'Quad.In' });
    if (token !== this.token) {
      box.scaleX = 1;
      return;
    }
    this.art.setTexture(id ? cardArtKey(id) : backArtKey(this.scene));
    await tween(this.scene, { targets: box, scaleX: 1, duration: 150, ease: 'Back.Out', easeParams: [2] });
    if (token !== this.token) return;
    this.playSheen();
    if (id) this.sparks(cardAccent(id));
  }

  private playSheen(): void {
    if (!this.shown || !this.root.active) return;
    const o = { f: 0 };
    this.sheen.setVisible(true).setFrame('s:0');
    this.scene.tweens.add({
      targets: o,
      f: SHEEN_FRAMES - 1,
      duration: 520,
      ease: 'Sine.InOut',
      onUpdate: () => this.sheen.setFrame(`s:${Math.round(o.f)}`),
      onComplete: () => this.sheen.setVisible(false),
    });
  }

  /** A ring of pixel sparks bursting off the art frame. */
  private sparks(color: number): void {
    const A = V2.art;
    const cx = A.x + A.w / 2;
    const cy = A.y + A.h / 2;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + this.rnd() * 0.3;
      const x0 = cx + Math.cos(a) * (A.w / 2 + 1);
      const y0 = cy + Math.sin(a) * (A.h / 2 + 1);
      const sp = this.scene.add
        .image(Math.round(x0), Math.round(y0), k % 4 === 0 ? TEX.plus : TEX.px1)
        .setTint(k % 3 === 0 ? PAL.white : color)
        .setBlendMode(ADD);
      this.root.add(sp);
      this.scene.tweens.add({
        targets: sp,
        x: x0 + Math.cos(a) * 7,
        y: y0 + Math.sin(a) * 6,
        alpha: 0,
        duration: 260 + this.rnd() * 120,
        ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  // ------------------------------------------------------------ idle life

  private tick(dt: number): void {
    if (!this.shown && !this.root.visible) return;
    const k = this.scene.time.timeScale;
    const s = (dt * k) / 1000;
    this.bob += s;
    const A = V2.art;
    // the art window floats one pixel up and down (whole pixels)
    this.artBox.y = A.y + A.h / 2 + Math.round(Math.sin(this.bob * 2.2) * 0.8);
    for (const m of this.motes) {
      m.t += s * m.speed;
      if (m.t > m.life) {
        m.t = 0;
        m.x = A.x + 2 + this.rnd() * (A.w - 4);
      }
      const u = m.t / m.life;
      m.img.setPosition(Math.round(m.x + Math.sin(u * 6 + m.x) * 2), Math.round(A.y + A.h + 2 - u * (A.h + 6)));
      m.img.setAlpha(Math.sin(u * Math.PI) * 0.8);
    }
    // the level stars twinkle one after another
    if (this.stars.length) {
      this.twinkle += s * 2.4;
      const n = this.stars.length;
      const lit = Math.floor(this.twinkle) % (n + 3);
      const d = this.current ? cardDef(this.current) : null;
      const ace = !!d && isMonster(d) && d.ace;
      this.stars.forEach((st, i) => st.setTint(i === lit ? PAL.white : ace ? PAL.gold4 : PAL.gold3));
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

/** Common surface of the inspect panel variants (v3 adds the pile view). */
interface InspectImpl {
  readonly visible: boolean;
  show(cardId: CardId | null, stats?: InspectStats): void;
  hide(immediate?: boolean): void;
  destroy(): void;
  showPile?(kind: PileKind, player: PlayerId, count: number): boolean;
}

/**
 * The hovered / selected card's details. v1: the 2× card column; v2 (compact HUD): the 116×110
 * corner panel with the artwork window that slides in only while something is inspected.
 */
export class InspectPanel {
  private readonly impl: InspectImpl;

  constructor(scene: Phaser.Scene) {
    // v3 lane A6-A (K12): the crisp panel; the v3 look always runs on the v1 geometry
    this.impl = V3_A6_A ? new InspectPanelV3(scene) : ARENA_V2 ? new InspectPanelV2(scene) : new InspectPanelV1(scene);
  }

  get visible(): boolean {
    return this.impl.visible;
  }

  /** Show a card (null = face-down card). Updates in place if already showing. */
  show(cardId: CardId | null, stats: InspectStats = {}): void {
    this.impl.show(cardId, stats);
  }

  /** Hide after a short grace delay (moving between cards does not flicker). */
  hide(immediate = false): void {
    this.impl.hide(immediate);
  }

  /**
   * A pile in the panel (S-9, K12): "Deste · 12 kart" / "Rakibin eli · 4 kart" — hidden information
   * stays hidden. False when the panel has no pile view (lane A6-A off): the caller keeps its path.
   * Use the frozen entry point src/view/v3/inspectV3.ts showPile(inspect, kind, player, count).
   */
  showPile(kind: PileKind, player: PlayerId, count: number): boolean {
    return this.impl.showPile?.(kind, player, count) ?? false;
  }

  destroy(): void {
    this.impl.destroy();
  }
}
