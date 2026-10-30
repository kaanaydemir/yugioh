// DESTE SEÇ — the compact deck picker that sits between the title menu and a match (scene 'DeckPick').
//   2 Oyuncu: Oyuncu 1 picks, then Oyuncu 2.   Bilgisayara Karşı: you pick, then the opponent's deck
//   ("Rastgele" = a seeded-by-the-clock preset, or any preset).
// The list holds the classic deck, the six presets and the saved slots; the default highlight is the
// deck used last time. An unplayable deck (illegal / missing cards) is listed but cannot be chosen.
// The choice is handed to the duel as `decks` (see launch.ts); both sides on the classic deck leaves it
// undefined, i.e. exactly today's default flow.

import Phaser from 'phaser';
import { CARDS, ATTRIBUTE_NAMES, isMonster, type CardId } from '../../data/cards';
import { cardArtKey } from '../../art/cards';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import { music, sfx } from '../../audio/sfx';
import { CURVE_BUCKETS, DECK_HIGH_LEVEL, copiesOf, deckStats, presetDecks } from '../../data/decks';
import { measureText, pixelText } from '../../ui/text';
import { Button } from '../../view/Button';
import { GAME_H, GAME_W } from '../../view/layout';
import { ICON, playerStyle } from '../../view/ui-textures';
import { tween } from '../../vfx/core';
import type { DuelLaunch, DuelMode } from '../launch';
import { REF_CLASSIC, deckStore, matchDecks, presetRef, type DeckStore, type LastKey, type ResolvedDeck } from './store';
import { REDUCED_MOTION, backdropTex, panelV3, fadeFromInk, fadeToInk, fitText, latticeTex, orbTex, thumbTex } from './ui';
import type { PlayerId } from '../../engine/types';

export interface DeckPickData {
  mode: Exclude<DuelMode, 'demo'>;
  /** 0: first pick, 1: second pick (opponent / player 2). */
  step?: 0 | 1;
  dev?: boolean;
  /** Test / QA: the picks made so far. */
  first?: string;
}

const RANDOM_REF = 'random';
const LX = 32;
const LY = 46;
const LW = 206;
const ROW = 22;
const RX = 250;
/** Thumbnails: 5 columns x 4 rows visible; a deck of up to 80 cards shows its distinct cards (xN badge) and scrolls. */
const T_COLS = 5;
const T_ROWS = 4;

interface Opt {
  ref: string;
  deck: ResolvedDeck | null;
  title: string;
  sub: string;
  tag: string;
}

interface ListRow {
  box: Phaser.GameObjects.Container;
  hi: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.BitmapText;
  sub: Phaser.GameObjects.BitmapText;
  tag: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
}

export class DeckPickScene extends Phaser.Scene {
  private d!: DeckPickData;
  private store!: DeckStore;
  private opts: Opt[] = [];
  private sel = 0;
  private thumbSel = 0;
  private rows: ListRow[] = [];
  private thumbs: { img: Phaser.GameObjects.Image; frame: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone; cntBg: Phaser.GameObjects.Rectangle; cnt: Phaser.GameObjects.BitmapText }[] = [];
  /** Distinct cards of the shown deck with copy counts, and the first visible thumbnail row. */
  private entries: { id: CardId; n: number }[] = [];
  private thumbRow = 0;
  private pageText!: Phaser.GameObjects.BitmapText;
  private title!: Phaser.GameObjects.BitmapText;
  private legal!: Phaser.GameObjects.BitmapText;
  private cap!: Phaser.GameObjects.BitmapText;
  private capType!: Phaser.GameObjects.BitmapText;
  private capText!: Phaser.GameObjects.BitmapText;
  private stats!: Phaser.GameObjects.BitmapText;
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private curveLabels: Phaser.GameObjects.BitmapText[] = [];
  private okBtn!: Button;
  private lattice!: Phaser.GameObjects.TileSprite;
  private t = 0;
  private busy = false;
  private ready = false;
  private firstRef: string | undefined;
  private shownDeck: ResolvedDeck | null = null;

  constructor() {
    super('DeckPick');
  }

  init(data: DeckPickData | undefined): void {
    this.d = { mode: 'vsBot', step: 0, ...(data ?? {}) } as DeckPickData;
    this.busy = false;
    this.ready = false;
    this.rows = [];
    this.thumbs = [];
    this.bars = [];
    this.curveLabels = [];
    this.sel = 0;
    this.thumbSel = 0;
    this.thumbRow = 0;
    this.entries = [];
    this.firstRef = this.d.first;
  }

  private get step(): 0 | 1 {
    return this.d.step ?? 0;
  }

  /** Which player (colour) this step picks for. */
  private get who(): PlayerId {
    return this.d.mode === 'hotseat' ? (this.step as PlayerId) : this.step === 0 ? 0 : 1;
  }

  private get lastKey(): LastKey {
    return this.step === 0 ? 'p1' : this.d.mode === 'vsBot' ? 'cpu' : 'p2';
  }

  private get heading(): string {
    if (this.d.mode === 'hotseat') return this.step === 0 ? 'OYUNCU 1 · DESTENİ SEÇ' : 'OYUNCU 2 · DESTENİ SEÇ';
    return this.step === 0 ? 'SENİN DESTEN' : 'RAKİBİN DESTESİ';
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PAL.night0);
    this.store = deckStore();
    this.add.image(0, 0, backdropTex(this)).setOrigin(0);
    this.lattice = this.add.tileSprite(0, 0, GAME_W, GAME_H, latticeTex(this)).setOrigin(0);

    const style = playerStyle(this.who);
    this.add.image(20, 12, panelV3(this, this.who === 0 ? 'p1' : 'p2', 600, 336, 20)).setOrigin(0).setDepth(3);
    const head = pixelText(this, 32, 22, this.heading, { size: 'md', color: PAL.white }).setDepth(10);
    head.setTint(PLAYER_COLOR[this.who], PLAYER_COLOR[this.who], PAL.white, PAL.white);
    const stepNo = this.d.mode === 'hotseat' || this.d.mode === 'vsBot' ? `ADIM ${this.step + 1}/2` : '';
    pixelText(this, 608, 24, stepNo, { size: 'sm', color: PAL.steel, originX: 1 }).setDepth(10);

    this.buildOptions();
    this.buildList();
    this.buildPreview();
    this.buildButtons();

    const startRef = this.store.last(this.lastKey);
    const i = this.opts.findIndex((o) => o.ref === startRef && this.pickable(o));
    this.sel = i >= 0 ? i : Math.max(0, this.opts.findIndex((o) => this.pickable(o)));
    this.renderList();
    this.renderPreview();

    const onKey = (e: KeyboardEvent) => {
      if (!this.sys.isActive() || this.busy || !this.ready) return;
      if (this.onKey(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    const onUpdate = (_t: number, dt: number) => {
      this.t += dt;
      if (REDUCED_MOTION) return;
      this.lattice.tilePositionX = Math.floor(this.t / 140);
      this.lattice.tilePositionY = Math.floor(this.t / 280);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    });
    (window.__neon as Record<string, unknown>).deckPick = this;
    void fadeFromInk(this).then(() => (this.ready = true));
    if (this.d.dev) this.ready = true;
    this.game.events.emit('deck:ready');
    if (!this.d.dev && window.__neon) window.__neon.ready = true;
  }

  // ---------------------------------------------------------------- options

  private pickable(o: Opt): boolean {
    return o.ref === RANDOM_REF || (!!o.deck && o.deck.check.ok && !o.deck.missing);
  }

  private describe(r: ResolvedDeck): string {
    const s = r.check.stats;
    return `${s.size} kart · ${s.monsters} canavar · ${s.spells} büyü · ${s.traps} tuzak`;
  }

  private buildOptions(): void {
    const list: Opt[] = [];
    const cpuStep = this.d.mode === 'vsBot' && this.step === 1;
    if (cpuStep) list.push({ ref: RANDOM_REF, deck: null, title: 'Rastgele', sub: 'Hazır desteler arasından biri', tag: 'ZAR' });
    for (const o of this.store.options()) {
      if (cpuStep && o.kind === 'slot') continue;
      if (cpuStep && o.kind === 'klasik') {
        list.push({ ref: o.ref, deck: o, title: o.name, sub: this.describe(o), tag: 'KLASİK' });
        continue;
      }
      const tag = o.kind === 'klasik' ? 'KLASİK' : o.kind === 'preset' ? 'HAZIR' : 'KAYIT';
      const bad = !o.check.ok || o.missing;
      list.push({ ref: o.ref, deck: o, title: o.name, sub: bad ? (o.missing ? `Eksik kart: ${o.missing}` : o.check.issues[0]?.text ?? 'Oynanamaz') : this.describe(o), tag });
    }
    this.opts = list;
  }

  private markerFor(o: Opt): string {
    if (o.ref === RANDOM_REF) return ICON.pointer;
    if (o.ref.startsWith('preset:')) {
      const id = o.ref.slice(7);
      const attr = ({ ates: 'FIRE', su: 'WATER', isik: 'LIGHT', muhur: 'DARK', toprak: 'EARTH', dengeli: 'WIND' } as const)[id as 'ates'];
      return orbTex(this, attr ?? 'LIGHT');
    }
    if (o.ref === REF_CLASSIC) return ICON.crown;
    return ICON.deck;
  }

  private buildList(): void {
    this.opts.forEach((o, i) => {
      const y = LY + i * ROW;
      const box = this.add.container(LX, y).setDepth(8);
      const hi = this.add.rectangle(0, 0, LW, ROW - 2, PAL.night3).setOrigin(0).setVisible(false);
      const marker = this.add.image(10, 10, this.markerFor(o)).setTint(o.ref === RANDOM_REF || o.ref === REF_CLASSIC || o.ref.startsWith('slot') ? PAL.gold3 : 0xffffff);
      if (o.ref.startsWith('preset:')) marker.clearTint();
      const title = pixelText(this, 22, 2, fitText(o.title, 120, (s) => measureText(s, 'sm').w), { size: 'sm', color: PAL.white });
      const sub = pixelText(this, 22, 11, fitText(o.sub, 178, (s) => measureText(s, 'sm').w), { size: 'sm', color: PAL.steel });
      const tag = pixelText(this, LW - 4, 2, o.tag, { size: 'sm', color: PAL.night4, originX: 1 });
      box.add([hi, marker, title, sub, tag]);
      const zone = this.add.zone(LX, y, LW, ROW - 2).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (this.busy || this.sel === i) return;
        this.sel = i;
        sfx.play('uiHover', { volume: 0.45 });
        this.renderList();
        this.renderPreview();
      });
      zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
        if (this.busy || p.rightButtonReleased()) return;
        this.sel = i;
        this.renderList();
        this.renderPreview();
        void this.confirm();
      });
      this.rows.push({ box, hi, marker, title, sub, tag, zone });
    });
  }

  private buildPreview(): void {
    this.title = pixelText(this, RX, 46, '', { size: 'md', color: PAL.white }).setDepth(10);
    this.legal = pixelText(this, RX, 62, '', { size: 'sm', color: PAL.mist, maxWidth: 356 }).setDepth(10);
    for (let i = 0; i < T_COLS * T_ROWS; i++) {
      const x = RX + (i % T_COLS) * 49;
      const y = 78 + Math.floor(i / T_COLS) * 39;
      const frame = this.add.image(x, y, thumbTex(this, 'monster', false)).setOrigin(0).setDepth(8);
      const img = this.add.image(x + 1, y + 1, cardArtKey('crystal_wyrm')).setOrigin(0).setDepth(9);
      const cntBg = this.add.rectangle(x + 2, y + 34, 1, 8, PAL.ink).setOrigin(0, 1).setDepth(10);
      const cnt = pixelText(this, x + 3, y + 33, '', { size: 'sm', color: PAL.gold4, originY: 1 }).setDepth(11);
      const zone = this.add.zone(x, y, 46, 36).setOrigin(0).setDepth(12).setInteractive();
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        const k = this.thumbRow * T_COLS + i;
        if (this.thumbSel === k) return;
        this.thumbSel = k;
        this.renderCaption();
      });
      this.thumbs.push({ img, frame, zone, cntBg, cnt });
    }
    this.pageText = pixelText(this, RX + 244, 66, '', { size: 'sm', color: PAL.steel, originX: 1 }).setDepth(10);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (p.x >= RX && p.y >= 70 && p.y <= 236 && dy) this.scrollThumbs(dy > 0 ? 1 : -1);
    });
    // right column: counts + curve
    this.stats = pixelText(this, 506, 78, '', { size: 'sm', color: PAL.mist, lineSpacing: 1 }).setDepth(10);
    for (let b = 0; b < CURVE_BUCKETS; b++) {
      const bx = 506 + b * 12;
      this.bars.push(this.add.rectangle(bx, 160, 10, 1, PAL.gold2).setOrigin(0, 1).setDepth(10));
      this.curveLabels.push(pixelText(this, bx + 5, 162, b === CURVE_BUCKETS - 1 ? '8+' : String(b + 1), { size: 'sm', color: b + 1 >= DECK_HIGH_LEVEL ? PAL.crim3 : PAL.steel, originX: 0.5 }).setDepth(10));
    }
    this.curveLabels.push(pixelText(this, 506, 178, 'SEVİYE EĞRİSİ', { size: 'sm', color: PAL.night4 }).setDepth(10));
    this.add.rectangle(RX, 238, 358, 1, PAL.night3).setOrigin(0).setDepth(9);
    this.cap = pixelText(this, RX, 244, '', { size: 'md', color: PAL.white }).setDepth(10);
    this.capType = pixelText(this, RX, 260, '', { size: 'sm', color: PAL.gold3 }).setDepth(10);
    this.capText = pixelText(this, RX, 272, '', { size: 'sm', color: PAL.mist, maxWidth: 356, lineSpacing: -1 }).setDepth(10);
  }

  private buildButtons(): void {
    const back = new Button(this, 32, 322, { w: 78, h: 18, label: 'GERİ', size: 'sm', icon: ICON.close, style: 'neutral', depth: 20 });
    back.onClick = () => void this.back();
    const build = new Button(this, 116, 322, { w: 100, h: 18, label: 'DESTE KUR', size: 'sm', style: 'spell', depth: 20 });
    build.onClick = () => void this.openBuilder();
    this.okBtn = new Button(this, 470, 322, { w: 138, h: 18, label: this.step === 1 ? 'MAÇA BAŞLA' : 'SEÇ · SIRADAKİ', size: 'sm', style: playerStyle(this.who), depth: 20 });
    this.okBtn.onClick = () => void this.confirm();
    this.okBtn.setAttention(true);
    pixelText(this, 222, 328, '↑↓ SEÇ · ←→ KART · PGUP/PGDN · ENTER · ESC', { size: 'sm', color: PAL.steel }).setDepth(10);
  }

  // ---------------------------------------------------------------- render

  private renderList(): void {
    this.rows.forEach((r, i) => {
      const o = this.opts[i];
      const on = i === this.sel;
      const ok = this.pickable(o);
      r.hi.setVisible(on).setFillStyle(ok ? PAL.night3 : PAL.night2);
      r.title.setTint(!ok ? PAL.night4 : on ? PAL.white : PAL.mist);
      r.sub.setTint(!ok ? PAL.crim2 : on ? PAL.mist : PAL.steel);
      r.tag.setTint(on ? PAL.gold3 : PAL.night4);
      r.box.x = LX + (on && !REDUCED_MOTION ? 2 : 0);
    });
    this.okBtn.setEnabled(this.pickable(this.opts[this.sel]));
  }

  private renderPreview(): void {
    const o = this.opts[this.sel];
    const deck = o.deck;
    this.shownDeck = deck;
    this.thumbSel = 0;
    this.curveLabels.forEach((l) => l.setVisible(!!deck));
    if (!deck) {
      this.title.setText('Rastgele rakip');
      this.legal.setText('Rakip, hazır desteler arasından rastgele birini seçer:').setTint(PAL.mist);
      this.entries = [];
      this.pageText.setText('');
      this.thumbs.forEach((t) => {
        t.img.setVisible(false);
        t.frame.setVisible(false);
        t.cnt.setText('');
        t.cntBg.setVisible(false);
        t.zone.input!.enabled = false;
      });
      this.stats.setPosition(RX, 86).setText(presetDecks().map((p) => `· ${p.name}  —  ${p.blurb}`).join('\n'));
      this.bars.forEach((b) => b.setVisible(false));
      this.cap.setText('');
      this.capType.setText('');
      this.capText.setText('');
      return;
    }
    this.bars.forEach((b) => b.setVisible(true));
    this.stats.setPosition(506, 78);
    this.title.setText(deck.name);
    const bad = !deck.check.ok || deck.missing;
    if (bad) {
      const lines = deck.check.issues.map((i) => i.text);
      this.legal.setText(`Oynanamaz: ${lines.join(' · ')}`).setTint(PAL.crim3);
    } else if (deck.kind === 'preset') {
      this.legal.setText(presetDecks().find((p) => presetRef(p.id) === deck.ref)?.blurb ?? '').setTint(PAL.mist);
    } else this.legal.setText(deck.kind === 'klasik' ? 'Oyunun ilk 20 kartı, ikişer kopya (40 kart). Her zaman hazır.' : 'Kayıtlı destin. Hazır.').setTint(PAL.leaf3);
    this.thumbRow = 0;
    this.entries = [...new Set(deck.cards)].map((id) => ({ id, n: copiesOf(deck.cards, id) }));
    this.paintThumbs();
    const st = deckStats(deck.cards);
    this.stats.setText(`${st.size} kart\nCanavar ${st.monsters}\nBüyü ${st.spells}\nTuzak ${st.traps}`);
    const maxN = Math.max(1, ...st.curve);
    const unit = Math.min(4, 18 / maxN);
    st.curve.forEach((n, b) => this.bars[b].setSize(10, Math.max(1, Math.round(n * unit))).setFillStyle(n === 0 ? PAL.night3 : b + 1 >= DECK_HIGH_LEVEL ? PAL.crim2 : PAL.gold2));
    this.renderCaption();
  }

  /** Fills the visible thumbnail rows from `entries` starting at `thumbRow`. */
  private paintThumbs(): void {
    this.thumbs.forEach((t, i) => {
      const e = this.entries[this.thumbRow * T_COLS + i];
      t.img.setVisible(!!e);
      t.frame.setVisible(!!e);
      t.zone.input!.enabled = !!e;
      const show = !!e && e.n > 1;
      t.cnt.setText(show ? `x${e.n}` : '');
      t.cntBg.setVisible(show).setSize(show ? Math.ceil(measureText(`x${e.n}`, 'sm').w) + 3 : 1, 8);
      if (e) {
        t.img.setTexture(cardArtKey(e.id));
        t.frame.setTexture(thumbTex(this, CARDS[e.id].kind, false));
      }
    });
    const rows = Math.ceil(this.entries.length / T_COLS);
    this.pageText.setText(rows > T_ROWS ? `${this.thumbRow * T_COLS + 1}-${Math.min(this.entries.length, (this.thumbRow + T_ROWS) * T_COLS)} / ${this.entries.length} kart türü` : '');
  }

  private scrollThumbs(rows: number): void {
    const max = Math.max(0, Math.ceil(this.entries.length / T_COLS) - T_ROWS);
    const next = Math.max(0, Math.min(max, this.thumbRow + rows));
    if (next === this.thumbRow) return;
    this.thumbRow = next;
    this.paintThumbs();
    this.renderCaption();
  }

  private renderCaption(): void {
    const deck = this.shownDeck;
    const id = deck ? this.entries[this.thumbSel]?.id : undefined;
    this.thumbs.forEach((t, i) => {
      const e = this.entries[this.thumbRow * T_COLS + i];
      if (e) t.frame.setTexture(thumbTex(this, CARDS[e.id].kind, this.thumbRow * T_COLS + i === this.thumbSel));
    });
    if (!id) {
      this.cap.setText('');
      this.capType.setText('');
      this.capText.setText('');
      return;
    }
    const d = CARDS[id];
    this.cap.setText(`${d.name}${this.entries[this.thumbSel].n > 1 ? `  x${this.entries[this.thumbSel].n}` : ''}`);
    if (isMonster(d)) {
      this.capType.setText(`${ATTRIBUTE_NAMES[d.attribute]} / ${d.race} · Sv ${d.level} · ATK ${d.atk} / DEF ${d.def}`);
      this.capText.setText(d.text || `"${d.flavor}"`);
    } else {
      this.capType.setText(d.kind === 'spell' ? 'Büyü' : 'Tuzak');
      this.capText.setText(d.text);
    }
  }

  // ---------------------------------------------------------------- input / flow

  private onKey(e: KeyboardEvent): boolean {
    switch (e.code) {
      case 'ArrowUp':
        return this.moveSel(-1);
      case 'ArrowDown':
        return this.moveSel(1);
      case 'ArrowLeft':
      case 'ArrowRight': {
        const n = this.entries.length;
        if (!n) return true;
        this.thumbSel = (this.thumbSel + (e.code === 'ArrowRight' ? 1 : -1) + n) % n;
        const row = Math.floor(this.thumbSel / T_COLS);
        if (row < this.thumbRow) this.thumbRow = row;
        else if (row >= this.thumbRow + T_ROWS) this.thumbRow = row - T_ROWS + 1;
        sfx.play('uiHover', { volume: 0.35 });
        this.paintThumbs();
        this.renderCaption();
        return true;
      }
      case 'PageDown':
        this.scrollThumbs(T_ROWS - 1);
        return true;
      case 'PageUp':
        this.scrollThumbs(-(T_ROWS - 1));
        return true;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        if (!e.repeat) void this.confirm();
        return true;
      case 'Escape':
        void this.back();
        return true;
      case 'KeyD':
        if (!e.repeat) void this.openBuilder();
        return true;
    }
    return false;
  }

  private moveSel(d: number): boolean {
    const n = this.opts.length;
    this.sel = (this.sel + d + n) % n;
    sfx.play('uiHover', { volume: 0.5 });
    this.renderList();
    this.renderPreview();
    return true;
  }

  private async confirm(): Promise<void> {
    const o = this.opts[this.sel];
    if (this.busy || !this.ready) return;
    if (!this.pickable(o)) {
      sfx.play('uiError', { volume: 0.55 });
      return;
    }
    this.busy = true;
    sfx.play('uiConfirm', { volume: 0.75 });
    const lastStep = this.step === 1;
    this.store.setLast(this.lastKey, o.ref);
    if (!lastStep) {
      this.firstRef = o.ref;
      await fadeToInk(this, REDUCED_MOTION ? 1 : 120);
      this.scene.restart({ mode: this.d.mode, step: 1, dev: this.d.dev, first: o.ref } satisfies DeckPickData);
      return;
    }
    const first = this.store.resolve(this.firstRef ?? REF_CLASSIC);
    let second: ResolvedDeck | null = this.store.resolve(o.ref);
    if (o.ref === RANDOM_REF) {
      const pool = presetDecks();
      second = this.store.resolve(presetRef(pool[Math.floor(Math.random() * pool.length)].id));
    }
    const decks = matchDecks(first, second);
    const launch: DuelLaunch = { mode: this.d.mode, ...(decks ? { decks } : {}) };
    (window.__neon as Record<string, unknown>).deckLaunch = { launch, first: first?.name, second: second?.name };
    if (this.d.dev) {
      this.busy = false;
      return;
    }
    music.stop(500);
    await fadeToInk(this, 200);
    this.scene.start('Duel', launch);
  }

  private async back(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    sfx.play('uiBack', { volume: 0.6 });
    if (this.d.dev) {
      this.busy = false;
      return;
    }
    await fadeToInk(this, 160);
    if (this.step === 1) this.scene.restart({ mode: this.d.mode, step: 0, dev: this.d.dev } satisfies DeckPickData);
    else this.scene.start('Title', { from: 'duel', select: this.d.mode });
  }

  private async openBuilder(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    sfx.play('uiClick', { volume: 0.6 });
    if (this.d.dev) {
      this.busy = false;
      return;
    }
    await fadeToInk(this, 160);
    this.scene.start('Deck', { back: { key: 'DeckPick', data: { mode: this.d.mode, step: this.step, first: this.firstRef } } });
  }

  /** QA: state for tools / tests. */
  get qaState(): { step: number; sel: string; options: string[]; pickable: boolean } {
    return { step: this.step, sel: this.opts[this.sel].ref, options: this.opts.map((o) => o.ref), pickable: this.pickable(this.opts[this.sel]) };
  }

  qaKey(code: string): void {
    this.onKey({ code, repeat: false, preventDefault() {} } as unknown as KeyboardEvent);
  }

  qaLayout(): { rows: { ref: string; x: number; y: number }[]; ok: { x: number; y: number }; back: { x: number; y: number } } {
    return { rows: this.opts.map((o, i) => ({ ref: o.ref, x: LX + LW / 2, y: LY + i * ROW + 10 })), ok: { x: 470 + 69, y: 331 }, back: { x: 32 + 39, y: 331 } };
  }

}
