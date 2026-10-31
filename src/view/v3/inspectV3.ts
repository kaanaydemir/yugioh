// The v3 inspect panel (K12) and its pile view — lane A6-A, step A2 (docs/v3/A6_PLAN.md §3 K12,
// §4.4 KO-1 … KO-4, KO-12; lane interface S-9). InspectPanel.ts picks InspectPanelV3 while lane A6-A
// is on (V3_A6_A); with it off the panel is today's, byte for byte.
//
//   - the frame language of S-1 (src/art/frame-v3.ts): a dark two-band body, 1-px ink outline, ONE
//     trim in the card kind's tone (monster gold, spell teal, trap magenta; a hidden card or a pile:
//     its owner's tone)
//   - the card at 2× (a crisp CardV3), breathing 0 / −1 px; behind it, instead of the soft ADD aura,
//     a two-tone stepped light rectangle in the card's accent ramp (its outer band steps out and back
//     every 1300 ms); single-pixel motes rise beside it in palette steps (no alpha, no ADD)
//   - name, type line, ATK / DEF and the picture change on the SAME frame as the hover (no edge-on
//     delay — the old panel showed one card's name over another's art for ~0.3 s on a quick scan);
//     the card's rim pulses once in its accent; the text types in over 120 ms (typeOn)
//   - first appearance: a 120 ms whole-pixel slide; leaving: a 140 ms grace, then a 120 ms slide out
//
// showPile (S-9): "Deste · 12 kart" / "Rakibin eli · 4 kart" / "Mezarlık · 3 kart" — the owner's v3
// back at 2× with the pile's thickness under it; hidden information stays hidden (KO-11). The frozen
// entry point is the function below; InspectPanel.showPile delegates to the panel.
//
//   if (!showPile(v.inspect, 'deck', player, n)) back();     // lane A6-B, HumanInput.hover (B3)

import Phaser from 'phaser';
import { ATTRIBUTE_NAMES, type CardId, cardDef, isMonster, isSpell } from '../../data/cards';
import { cardAccentRamp } from '../../art/cards';
import { frameRectV3, type TrimName } from '../../art/frame-v3';
import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { measureText, pixelText, revealText, textMetrics, type TextSize } from '../../ui/text';
import { TEX } from '../../vfx/core';
import type { InspectPanel, InspectStats } from '../InspectPanel';
import { DEPTH, UI } from '../layout';
import { ICON, typeOn } from '../ui-textures';
import { V3_A6_A } from '../v3flags';
import { createCardV3, type CardV3 } from './CardV3';
import { EASE, breathOf, pxMove } from './handV3';
import { REDUCED_MOTION } from './motion';

export type PileKind = 'deck' | 'graveyard' | 'hand';

/** Show `player`'s pile of `kind` (count cards) in the inspect panel; false = not handled (lane A6-A off). */
export function showPile(inspect: InspectPanel, kind: PileKind, player: PlayerId, count: number): boolean {
  if (!V3_A6_A) return false;
  return inspect.showPile(kind, player, count);
}

// ================================================================ layout (UI.inspect, v1 geometry)

const R = UI.inspect;
/** The 2× card's centre (96 × 136: left 16, top 8). */
const CARD_CX = Math.round(R.w / 2);
const CARD_CY = 76;
const CARD_HW = 48;
const CARD_HH = 68;
/** Air around the card for its light (6 on the 128-px panel; the narrow 5+5 panel has 2 px each side). */
const LIGHT_PAD = Math.max(1, Math.min(6, Math.floor((R.w - CARD_HW * 2) / 2)));
/** The panel is too narrow for margins beside the card: no motes there (they would float outside it). */
const NARROW = R.w < 120;
/** The name's cap top; the type line, divider, stats and body follow it (as v1, 2 px lower). */
const NAME_Y = 152;
const TEXT_W = R.w - 14;
/** Off-screen x of the panel (slid out). */
const OUT_X = -R.w - 12;
const SPELL_TYPE: Record<string, string> = { normal: 'Normal', equip: 'Kuşanma', field: 'Alan', continuous: 'Devamlı', quick: 'Hızlı' };

export const INSPECT3 = Object.freeze({
  slideMs: 120,
  hideGraceMs: 140,
  typeMs: 120,
  pulseMs: 120,
  /** The light rectangle's outer band steps out / back. */
  lightStepMs: 1300,
  motes: 10,
  /** Where the body bands split (the text sits on the darker lower band). */
  split: 150,
});

function capY(size: TextSize, capTop: number): number {
  return capTop - textMetrics(size).capTop;
}

/** The kind's trim (a hidden card or a pile: its owner's; unknown owner: neutral). */
export function trimFor(id: CardId | null, owner: PlayerId | null): TrimName {
  if (id) {
    const d = cardDef(id);
    return d.kind === 'monster' ? 'monster' : d.kind === 'spell' ? 'spell' : 'trap';
  }
  return owner === null ? 'neutral' : owner === 0 ? 'p1' : 'p2';
}

/** The accent ramp of what is shown (a card's attribute / kind ramp; hidden / pile: the owner's or night). */
export function accentRamp(id: CardId | null, owner: PlayerId | null): Ramp {
  if (id) return cardAccentRamp(id);
  return owner === null ? RAMPS.night : PLAYER_RAMP[owner];
}

// ================================================================ painters (pure)

/** The panel body: FRAME_V3 (two bands, ink outline, one trim) at the inspect size. */
export function paintPanel(trim: TrimName): PixelCanvas {
  return frameRectV3(new PixelCanvas(R.w, R.h), 0, 0, R.w, R.h, trim, { split: INSPECT3.split });
}

/**
 * The stepped light rectangle behind the 2× card (instead of the soft ADD aura): the light falls off
 * in palette steps away from the card — a 1-px ramp[2] edge on the card, a 2-px ramp[1] band, then a
 * ramp[0] band of 1 px (2 px on the breathing step). The inside is left clear for the card. Canvas
 * 108 × 148, its top-left at (CARD_CX − 54, CARD_CY − 74).
 */
export function paintLight(ramp: Ramp, step: 0 | 1): PixelCanvas {
  const W = CARD_HW * 2 + LIGHT_PAD * 2;
  const H = CARD_HH * 2 + LIGHT_PAD * 2;
  const p = new PixelCanvas(W, H);
  const ring = (inset: number, c: number) => {
    const x0 = inset;
    const y0 = inset;
    const x1 = W - 1 - inset;
    const y1 = H - 1 - inset;
    p.hline(x0 + 1, x1 - 1, y0, c);
    p.hline(x0 + 1, x1 - 1, y1, c);
    p.vline(x0, y0 + 1, y1 - 1, c);
    p.vline(x1, y0 + 1, y1 - 1, c);
  };
  // the card spans 6 .. W−7: its edge light at 5 (ramp[2]), the band at 3–4 (ramp[1]), the falloff
  // at 2 (ramp[0]; and 1 on the breathing step)
  // (a narrow panel, 5+5 board: LIGHT_PAD < 6 keeps the innermost rings and drops the outer ones)
  const o = 6 - LIGHT_PAD;
  const rings: [number, number][] = [[5, ramp[2]], [4, ramp[1]], [3, ramp[1]], [2, ramp[0]]];
  if (step === 1) rings.push([1, ramp[0]]);
  for (const [inset, c] of rings) if (inset - o >= 0) ring(inset - o, c);
  return p;
}

/** The divider under the type line: a 1-px rule in ramp[1], a 24-px centre in ramp[3], an ink-ringed diamond. */
export function paintDivider(ramp: Ramp): PixelCanvas {
  const w = R.w - 16;
  const p = new PixelCanvas(w, 5);
  const c = Math.floor(w / 2);
  p.hline(0, w - 1, 2, ramp[1]);
  p.hline(c - 12, c + 11, 2, ramp[3]);
  p.rect(c - 2, 0, 5, 5, PAL.ink);
  p.rect(c - 1, 1, 3, 3, ramp[3]);
  p.set(c, 2, PAL.white);
  return p;
}

/**
 * A pile's thickness behind its top card: up to 2 layers stepping 2 px down-right, each an ink edge
 * with a lit page line (the owner's ramp[3], the deeper one ramp[2]) so the steps read on the light.
 */
export function paintStack(layers: number, ramp: Ramp): PixelCanvas {
  const W = CARD_HW * 2 + 4;
  const H = CARD_HH * 2 + 4;
  const p = new PixelCanvas(W, H);
  for (let k = Math.min(2, layers); k >= 1; k--) {
    const o = k * 2;
    p.rect(o, o, CARD_HW * 2, CARD_HH * 2, PAL.ink);
    p.rect(o + 1, o + 1, CARD_HW * 2 - 2, CARD_HH * 2 - 2, k === 1 ? ramp[3] : ramp[2]);
  }
  return p;
}

/** An empty pile's slot: a dashed 1-px outline (steel) of the 2× card. */
export function paintEmptySlot(): PixelCanvas {
  const W = CARD_HW * 2;
  const H = CARD_HH * 2;
  const p = new PixelCanvas(W, H);
  for (let x = 1; x < W - 1; x++) if ((x >> 1) % 2 === 0) p.set(x, 0, PAL.steel).set(x, H - 1, PAL.steel);
  for (let y = 1; y < H - 1; y++) if ((y >> 1) % 2 === 0) p.set(0, y, PAL.steel).set(W - 1, y, PAL.steel);
  return p;
}

/** The words of a card (name, type line, text) as the panel shows them. */
export function cardWords(id: CardId | null): { name: string; type: string; text: string; flavor: boolean } {
  if (!id) return { name: 'Kapalı Kart', type: 'Gizli', text: 'Bu kartın ne olduğu rakibinden gizli.', flavor: false };
  const d = cardDef(id);
  if (isMonster(d)) return { name: d.name, type: `${ATTRIBUTE_NAMES[d.attribute]} / ${d.race} ★${d.level}`, text: d.text || `"${d.flavor}"`, flavor: !d.text };
  if (isSpell(d)) return { name: d.name, type: `Büyü · ${SPELL_TYPE[d.spellType] ?? 'Normal'}`, text: d.text, flavor: false };
  return { name: d.name, type: 'Tuzak · Normal', text: d.text, flavor: false };
}

/** The words of a pile (KO-11: counts only, nothing hidden is named). */
export function pileWords(kind: PileKind, player: PlayerId, count: number): { name: string; type: string; text: string } {
  const who = `OYUNCU ${player + 1}`;
  if (kind === 'deck') return { name: `Deste · ${count} kart`, type: who, text: count ? 'Çekilecek kartlar kapalı; sıraları gizli.' : 'Destede kart kalmadı.' };
  if (kind === 'hand') return { name: `Rakibin eli · ${count} kart`, type: who, text: 'Rakibinin elindeki kartlar sana gizli.' };
  return { name: `Mezarlık · ${count} kart`, type: who, text: count ? 'Mezarlık herkese açıktır.' : 'Mezarlık boş.' };
}

function canvasKey(scene: Phaser.Scene, key: string, paint: () => PixelCanvas): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paint().toCanvas());
  return key;
}

const rampId = (r: Ramp) => r.map((c) => c.toString(16)).join('-');

// ================================================================ the panel

interface Mote {
  img: Phaser.GameObjects.Image;
  t: number;
  x: number;
  speed: number;
  life: number;
}

/** The v3 inspect panel (the same surface as today's: show / hide / visible / destroy, + showPile). */
export class InspectPanelV3 {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly light: Phaser.GameObjects.Image;
  private readonly stack: Phaser.GameObjects.Image;
  private readonly card: CardV3;
  private name: Phaser.GameObjects.BitmapText;
  private readonly typeLine: Phaser.GameObjects.BitmapText;
  private readonly divider: Phaser.GameObjects.Image;
  private readonly stats: Phaser.GameObjects.Container;
  private readonly atkIcon: Phaser.GameObjects.Image;
  private readonly defIcon: Phaser.GameObjects.Image;
  private readonly atkText: Phaser.GameObjects.BitmapText;
  private readonly defText: Phaser.GameObjects.BitmapText;
  private body: Phaser.GameObjects.BitmapText;
  private readonly motes: Mote[] = [];
  private readonly updateFn: (t: number, dt: number) => void;
  private shown = false;
  /** What is shown: `c:<id>` / `c:-:<owner>` for a card, `p:<kind>:<player>:<count>` for a pile. */
  private current: string | null = null;
  private currentStats: InspectStats = {};
  private ramp: Ramp = RAMPS.night;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private token = 0;
  private clock = 0;
  private lightStep: 0 | 1 = 0;
  private seed = 5368103; // (the old panel's mote seed, written in decimal: hex literals are read as colours by the palette scan)

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(OUT_X, R.y).setDepth(DEPTH.INSPECT).setScrollFactor(0);
    this.bg = scene.add.image(0, 0, canvasKey(scene, 'ui3:inspect:panel:neutral', () => paintPanel('neutral'))).setOrigin(0);
    this.light = scene.add.image(CARD_CX - CARD_HW - LIGHT_PAD, CARD_CY - CARD_HH - LIGHT_PAD, this.lightKey(RAMPS.night, 0)).setOrigin(0);
    this.stack = scene.add.image(CARD_CX - CARD_HW, CARD_CY - CARD_HH, canvasKey(scene, 'ui3:inspect:empty', paintEmptySlot)).setOrigin(0).setVisible(false);
    this.card = createCardV3(scene, null, { x: CARD_CX, y: CARD_CY, faceUp: false });
    this.card.setScale(2);
    this.name = pixelText(scene, R.w / 2, 0, '', { size: 'md', color: PAL.white });
    this.typeLine = pixelText(scene, R.w / 2, 0, '', { size: 'sm', color: PAL.gold3 });
    this.divider = scene.add.image(8, 0, this.dividerKey(RAMPS.night)).setOrigin(0);
    this.stats = scene.add.container(0, 0);
    this.atkIcon = scene.add.image(0, 0, ICON.atk).setOrigin(0);
    this.defIcon = scene.add.image(0, 0, ICON.def).setOrigin(0);
    this.atkText = pixelText(scene, 0, 0, '', { size: 'md' });
    this.defText = pixelText(scene, 0, 0, '', { size: 'md' });
    this.stats.add([this.atkIcon, this.atkText, this.defIcon, this.defText]);
    this.body = pixelText(scene, 7, 0, '', { size: 'sm', color: PAL.mist, maxWidth: TEXT_W, lineSpacing: -1 });
    this.root.add([this.bg, this.light]);
    for (let i = 0; i < INSPECT3.motes; i++) {
      const img = scene.add.image(0, 0, TEX.px1).setOrigin(0).setVisible(false);
      this.root.add(img);
      if (NARROW) continue; // (no margin beside the card: the motes stay out)
      // beside the card: the left (x 4..11) or the right (x 116..123) margin, alternating
      const left = i % 2 === 0;
      this.motes.push({ img, t: this.rnd(), x: left ? 4 + Math.floor(this.rnd() * 8) : 116 + Math.floor(this.rnd() * 8), speed: 0.1 + this.rnd() * 0.12, life: 0.7 + this.rnd() * 0.3 });
    }
    this.root.add([this.stack, this.card, this.name, this.typeLine, this.divider, this.stats, this.body]);
    this.root.setVisible(false);
    this.updateFn = (_t, dt) => this.tick(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateFn);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Show a card (null = face-down; stats.owner picks its back). Everything changes on this frame. */
  show(cardId: CardId | null, stats: InspectStats = {}): void {
    this.hideTimer?.remove();
    this.hideTimer = null;
    const owner = stats.owner ?? null;
    const key = cardId ? `c:${cardId}` : `c:-:${owner ?? '-'}`;
    if (this.shown && key === this.current) {
      if (stats.atk !== this.currentStats.atk || stats.def !== this.currentStats.def) {
        this.currentStats = { ...stats };
        this.fillStats(cardId, true);
      }
      return;
    }
    const first = !this.shown;
    const token = ++this.token;
    this.current = key;
    this.currentStats = { ...stats };
    this.shown = true;
    this.ramp = accentRamp(cardId, owner);
    this.setLook(trimFor(cardId, owner));
    this.stack.setVisible(false);
    this.card.setVisible(true);
    if (owner !== null) this.card.setPlayerTint(owner);
    this.card.setCard(cardId).setFaceUp(cardId !== null);
    const w = cardWords(cardId);
    this.fillText(w.name, w.type, w.text, w.flavor, !!cardId && isMonster(cardDef(cardId)));
    this.fillStats(cardId, false);
    this.enter(first, token);
  }

  /** The pile view (S-9; see the header). */
  showPile(kind: PileKind, player: PlayerId, count: number): boolean {
    this.hideTimer?.remove();
    this.hideTimer = null;
    const n = Math.max(0, Math.round(count));
    const key = `p:${kind}:${player}:${n}`;
    if (this.shown && key === this.current) return true;
    const first = !this.shown;
    const token = ++this.token;
    this.current = key;
    this.currentStats = {};
    this.shown = true;
    this.ramp = PLAYER_RAMP[player];
    this.setLook(player === 0 ? 'p1' : 'p2');
    const empty = n === 0 || kind === 'graveyard';
    // the graveyard is public: its pile shows the slot, never a back (its cards are face-up)
    this.card.setVisible(!empty);
    if (!empty) {
      this.card.setPlayerTint(player);
      this.card.setCard(null).setFaceUp(false);
    }
    const layers = empty ? 0 : n > 8 ? 2 : n > 1 ? 1 : 0;
    if (empty) this.stack.setTexture(canvasKey(this.scene, 'ui3:inspect:empty', paintEmptySlot)).setPosition(CARD_CX - CARD_HW, CARD_CY - CARD_HH);
    else this.stack.setTexture(canvasKey(this.scene, `ui3:inspect:stack:${layers}:${rampId(this.ramp)}`, () => paintStack(layers, this.ramp))).setPosition(CARD_CX - CARD_HW, CARD_CY - CARD_HH);
    this.stack.setVisible(empty || layers > 0);
    const w = pileWords(kind, player, n);
    this.fillText(w.name, w.type, w.text, false, false);
    this.enter(first, token);
    return true;
  }

  /** Hide after a short grace delay (moving between cards does not flicker). */
  hide(immediate = false): void {
    if (!this.shown) return;
    this.hideTimer?.remove();
    const go = () => {
      this.hideTimer = null;
      this.shown = false;
      this.current = null;
      this.token++;
      if (REDUCED_MOTION) {
        this.root.setX(OUT_X).setVisible(false);
        return;
      }
      void pxMove(this.scene, this.root, { x: OUT_X }, INSPECT3.slideMs, EASE.inQuad).then(() => {
        if (!this.shown && this.root.active) this.root.setVisible(false);
      });
    };
    if (immediate) go();
    else this.hideTimer = this.scene.time.delayedCall(INSPECT3.hideGraceMs, go);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateFn);
    this.hideTimer?.remove();
    this.hideTimer = null;
    if (this.root.active) this.root.destroy();
  }

  // ------------------------------------------------------------ content

  private lightKey(ramp: Ramp, step: 0 | 1): string {
    return canvasKey(this.scene, `ui3:inspect:light:${rampId(ramp)}:${step}`, () => paintLight(ramp, step));
  }

  private dividerKey(ramp: Ramp): string {
    return canvasKey(this.scene, `ui3:inspect:div:${rampId(ramp)}`, () => paintDivider(ramp));
  }

  /** Panel trim, light rectangle, divider and mote tones for the current ramp (same frame). */
  private setLook(trim: TrimName): void {
    this.bg.setTexture(canvasKey(this.scene, `ui3:inspect:panel:${trim}`, () => paintPanel(trim)));
    this.light.setTexture(this.lightKey(this.ramp, this.lightStep));
    this.divider.setTexture(this.dividerKey(this.ramp));
    for (const m of this.motes) this.toneMote(m);
  }

  /** Slide in (first show) or pulse the card's rim (a swap); the body types in either way. */
  private enter(first: boolean, token: number): void {
    if (first) {
      this.root.setVisible(true);
      if (REDUCED_MOTION) this.root.setX(R.x);
      else {
        if (this.root.x === R.x) this.root.setX(OUT_X);
        void pxMove(this.scene, this.root, { x: R.x }, INSPECT3.slideMs, EASE.outCubic);
      }
    } else {
      this.root.setVisible(true);
      if (this.root.x !== R.x) void pxMove(this.scene, this.root, { x: R.x }, INSPECT3.slideMs, EASE.outCubic);
      if (this.card.visible) void this.card.pulse(this.ramp[3], INSPECT3.pulseMs);
    }
    this.typeIn(token);
  }

  private fillText(name: string, type: string, text: string, flavor: boolean, hasStats: boolean): void {
    const nameSize: TextSize = measureText(name, 'md').w <= R.w - 6 ? 'md' : 'sm';
    const nameIdx = this.root.getIndex(this.name);
    this.name.destroy();
    this.name = pixelText(this.scene, 0, capY(nameSize, NAME_Y + (nameSize === 'sm' ? 1 : 0)), name, { size: nameSize, color: PAL.white });
    this.name.x = Math.round(R.w / 2 - this.name.width / 2);
    this.root.addAt(this.name, nameIdx);
    // (the narrow 5+5 panel: a long type line first loses the spaces round its slash, then its star level)
    const typeFits = [type, type.replace(' / ', '/'), type.replace(' / ', '/').replace(/ ★\d+$/, '')].find((t) => measureText(t, 'sm').w <= R.w - 6) ?? type;
    this.typeLine.setText(typeFits).setTint(this.ramp[3]);
    this.typeLine.setPosition(Math.round(R.w / 2 - this.typeLine.width / 2), capY('sm', NAME_Y + 11));
    const dy = NAME_Y + 19;
    this.divider.setPosition(8, dy - 2);
    this.stats.setVisible(hasStats);
    this.stats.y = dy + 5;
    const bodyY = (hasStats ? dy + 15 : dy + 5) - 1;
    const room = R.h - 3 - bodyY;
    const tight = measureText(text, 'sm', TEXT_W, true, -1).h > room;
    // batch 2: a text longer than the panel even at tight spacing is cut at a word with "…" (never runs
    // over the LP panel below); every older card fits, so it keeps its text as it was
    if (tight && measureText(text, 'sm', TEXT_W, true, -2).h > room) {
      const words = text.split(' ');
      while (words.length > 1 && measureText(`${words.join(' ')}…`, 'sm', TEXT_W, true, -2).h > room) words.pop();
      text = `${words.join(' ')}…`;
    }
    const idx = this.root.getIndex(this.body);
    this.body.destroy();
    this.body = pixelText(this.scene, 7, bodyY, text, { size: 'sm', color: flavor ? PAL.mist : PAL.white, maxWidth: TEXT_W, lineSpacing: tight ? -2 : -1 });
    this.root.addAt(this.body, idx);
  }

  private fillStats(id: CardId | null, flash: boolean): void {
    if (!id) return;
    const d = cardDef(id);
    if (!isMonster(d)) return;
    const atk = this.currentStats.atk ?? d.atk;
    const def = this.currentStats.def ?? d.def;
    const fmt = (v: number, base: number) => (v > base ? `${v}↑` : v < base ? `${v}↓` : String(v));
    const col = (v: number, base: number) => (v > base ? PAL.leaf3 : v < base ? PAL.crim3 : PAL.white);
    this.atkText.setText(fmt(atk, d.atk)).setTint(col(atk, d.atk));
    this.defText.setText(fmt(def, d.def)).setTint(col(def, d.def));
    const gap = 12;
    const w1 = this.atkIcon.width + 3 + this.atkText.width;
    const w2 = this.defIcon.width + 3 + this.defText.width;
    let x = Math.round(R.w / 2 - (w1 + gap + w2) / 2);
    this.atkIcon.setPosition(x, 0).setTint(PAL.fire3);
    this.atkText.setPosition(x + this.atkIcon.width + 3, capY('md', 1));
    x += w1 + gap;
    this.defIcon.setPosition(x, -1).setTint(PAL.water3);
    this.defText.setPosition(x + this.defIcon.width + 3, capY('md', 1));
    if (flash) {
      // a changed value: two white frames, then its colour
      for (const t of [this.atkText, this.defText]) t.setTint(PAL.white);
      const token = this.token;
      this.scene.time.delayedCall(34, () => {
        if (token === this.token && this.atkText.active) this.fillStats(id, false);
      });
    }
  }

  /** The body text types in over 120 ms (typeOn); reduced motion: at once. */
  private typeIn(token: number): void {
    const body = this.body;
    const n = revealText(body, 0);
    if (REDUCED_MOTION || n === 0) {
      revealText(body, Infinity);
      return;
    }
    void typeOn(this.scene, body, (n * 1000) / INSPECT3.typeMs).then(() => {
      if (token !== this.token && body.active) revealText(body, Infinity);
    });
  }

  // ------------------------------------------------------------ idle life

  private toneMote(m: Mote): void {
    const u = m.t / m.life;
    // rising, stepping down the ramp: ramp[3] → ramp[2] → ramp[1], then gone
    const tone = u < 0.4 ? this.ramp[3] : u < 0.75 ? this.ramp[2] : this.ramp[1];
    m.img.setTint(tone);
  }

  private tick(rawDt: number): void {
    if (!this.root.active || !this.root.visible) return;
    const dt = Math.min(50, rawDt) * (this.scene.tweens?.timeScale ?? 1);
    this.clock += dt;
    // the card breathes (0 / −1 px), the light's outer band steps out and back
    this.card.y = CARD_CY + breathOf(this.clock, 0);
    const step: 0 | 1 = REDUCED_MOTION ? 0 : Math.floor(this.clock / INSPECT3.lightStepMs) % 2 === 0 ? 0 : 1;
    if (step !== this.lightStep) {
      this.lightStep = step;
      this.light.setTexture(this.lightKey(this.ramp, step));
    }
    const still = REDUCED_MOTION;
    for (const m of this.motes) {
      if (still) {
        m.img.setVisible(false);
        continue;
      }
      m.t += (dt / 1000) * m.speed;
      if (m.t > m.life) {
        m.t = 0;
        m.x = m.x < 64 ? 4 + Math.floor(this.rnd() * 8) : 116 + Math.floor(this.rnd() * 8);
      }
      const u = m.t / m.life;
      m.img.setPosition(m.x, Math.round(CARD_CY + CARD_HH - 4 - u * 120)).setVisible(u < 0.92);
      this.toneMote(m);
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
