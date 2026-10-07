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

import Phaser from 'phaser';
import { ATTRIBUTE_NAMES, type CardId, cardDef, isMonster, isSpell } from '../data/cards';
import { cardAccent } from '../art/cards';
import { PAL } from '../art/palette';
import { mix } from '../art/pixel';
import { measureText, pixelText, setTextMaxWidth, textMetrics, type TextSize } from '../ui/text';
import { TEX, tween } from '../vfx/core';
import { CardSprite } from './CardSprite';
import { DEPTH, UI } from './layout';
import { GLOW_PAD, ICON, type UiStyle, glowTex, ovalHaloTex, panelTex, typeOn } from './ui-textures';

export interface InspectStats {
  atk?: number;
  def?: number;
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

export class InspectPanel {
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
  private readonly body: Phaser.GameObjects.BitmapText;
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
    const nameY = 154;
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
    setTextMaxWidth(this.body, TEXT_W);
    this.body.setText(text).setTint(flavor ? mix(PAL.mist, accent, 0.25) : PAL.white);
    const bodyY = (hasStats ? dy + 15 : dy + 5) - 1;
    this.body.setPosition(7, bodyY);
    // long texts tighten their leading so they always fit inside the panel
    const room = R.h - 3 - bodyY;
    const tight = measureText(text, 'sm', TEXT_W, true, -1).h > room;
    this.body.setLineSpacing(tight ? -3 : -2);
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
