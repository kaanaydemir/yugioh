// DESTE KUR — the deck builder (scene key 'Deck').
//
//   left    the game's own inspect panel (big card + Turkish text), a key-help / seal-hint plate under it
//   middle  the card pool: filter chips (kind, element), sort chips, a scrolling 3-column grid of cells
//           (44x34 picture, name, ATK/DEF, element orb, level) — click / Enter adds or removes a card
//   right   the deck: 5 save slots, the deck's name, the 20 slots as a list, the level curve, the
//           counts, the Turkish reasons while the deck is not playable, and the action buttons
//
// Mouse and keyboard both do everything (see HELP below). The pool is read from ALL_CARDS at
// runtime: 35 cards today, 60-80 later; the grid scrolls and nothing here counts cards.
// Rules and presets: src/data/decks.ts. Persistence: ./store.ts. Notes: docs/DESTE_KURMA.md.

import Phaser from 'phaser';
import { ALL_CARDS, ATTRIBUTE_NAMES, CARDS, SEAL_IDS, isMonster, type Attribute, type CardId } from '../../data/cards';
import { cardArtKey } from '../../art/cards';
import { ATTRIBUTE_COLOR, KIND_RAMP, PAL } from '../../art/palette';
import { sfx } from '../../audio/sfx';
import {
  CURVE_BUCKETS, DECK_HIGH_LEVEL, DECK_SIZE, addBlocker, autoFillDeck, classicDeck, deckStats, isSealCard, presetDecks, validateDeck,
} from '../../data/decks';
import { measureText, pixelText, wrapText } from '../../ui/text';
import { Button } from '../../view/Button';
import { InspectPanel } from '../../view/InspectPanel';
import { GAME_H, GAME_W } from '../../view/layout';
import { ICON, panelTex, miniCardKey } from '../../view/ui-textures';
import { TEX, tween, wait } from '../../vfx/core';
import { ELEMENTS, SORT_KEYS, SORT_LABEL, gridMove, sortPool, visibleIds, type KindFilter, type PoolFilter, type SortKey } from './pool';
import { NAME_MAX, SLOT_COUNT, deckStore, slotRef, type DeckStore } from './store';
import { CELL_H, CELL_W, REDUCED_MOTION, backdropTex, cellTex, chainTex, fadeFromInk, fadeToInk, fitText, latticeTex, orbOf, orbTex, tickTex, type CellKind } from './ui';

export interface DeckSceneData {
  /** Slot to open (default: the last edited one). */
  slot?: number;
  /** Opened by ?dev=deck (QA): Esc does not leave. */
  dev?: boolean;
  /** Where GERİ / ESC goes instead of the title menu (the deck picker that opened the builder). */
  back?: { key: string; data: object };
  /** QA: start with this filter / sort / deck. */
  qa?: { kind?: KindFilter; attr?: Attribute | null; sort?: SortKey; cards?: CardId[]; name?: string; cursor?: number };
}

// ---------------------------------------------------------------- layout
const PX = 136;
const PY = 24;
const PW = 340;
const PH = 332;
const DX = 480;
const DY = 24;
const DW = 156;
const DH = 332;
const COLS = 3;
const ROWS = 6;
const GAP = 2;
const GRID_X = PX + 6;
const GRID_Y = PY + 40;
const ROW_H = 9;
const LIST_Y = DY + 39;
const NAME_W = 96;
const BTN_Y = DY + DH - 2 * 17 - 1;
const KIND_LABEL: Record<KindFilter, string> = { all: 'Tümü', monster: 'Canavar', spell: 'Büyü', trap: 'Tuzak' };
const KINDS: readonly KindFilter[] = ['all', 'monster', 'spell', 'trap'];
const SPELL_WORD: Record<string, string> = { normal: 'Normal', equip: 'Kuşanma', field: 'Alan' };
const HELP: readonly (readonly [string, string])[] = [
  ['ENTER', 'Ekle / çıkar'],
  ['TAB', 'Alan değiştir'],
  ['1-5', 'Deste yuvası'],
  ['K · N', 'Kaydet · Ad ver'],
  ['R', 'Rastgele doldur'],
  ['H · D', 'Hazır · Klasik'],
  ['X', 'Temizle'],
  ['F E O', 'Süz/Element/Sıra'],
  ['ESC', 'Geri'],
];

type Zone = 'pool' | 'deck';
type Tone = 'info' | 'ok' | 'bad' | 'gold';
const TONE: Record<Tone, number> = { info: PAL.mist, ok: PAL.leaf3, bad: PAL.crim3, gold: PAL.gold3 };

interface Cell {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  art: Phaser.GameObjects.Image;
  orb: Phaser.GameObjects.Image;
  lvlBg: Phaser.GameObjects.Rectangle;
  lvl: Phaser.GameObjects.BitmapText;
  name: Phaser.GameObjects.BitmapText;
  atk: Phaser.GameObjects.BitmapText;
  def: Phaser.GameObjects.BitmapText;
  word: Phaser.GameObjects.BitmapText;
  chain: Phaser.GameObjects.Image;
  tick: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  x: number;
  y: number;
  index: number;
  id: CardId | null;
}

interface Row {
  box: Phaser.GameObjects.Container;
  hi: Phaser.GameObjects.Rectangle;
  orb: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  lvl: Phaser.GameObjects.BitmapText;
  atk: Phaser.GameObjects.BitmapText;
  num: Phaser.GameObjects.BitmapText;
  chain: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  id: CardId | null;
}

interface Draft {
  name: string;
  cards: CardId[];
  /** The saved copy it was loaded from (to tell if it changed). */
  savedKey: string;
}

const keyOf = (name: string, cards: readonly string[]) => `${name}|${cards.join(',')}`;

export class DeckScene extends Phaser.Scene {
  private data0: DeckSceneData = {};
  private store!: DeckStore;
  private insp!: InspectPanel;
  private drafts: Draft[] = [];
  private slot = 0;
  private filter: PoolFilter = { kind: 'all', attr: null };
  private sort: SortKey = 'level';
  private list: CardId[] = [];
  private cursor = 0;
  private scrollRow = 0;
  private zone: Zone = 'pool';
  private deckCursor = 0;
  private editing = false;
  /** The first character typed replaces the old name (select-all behaviour). */
  private nameFresh = false;
  private caretT = 0;
  private presetIdx = -1;
  private leaving = false;
  private exitArmed = 0;
  private ready = false;
  private pressedCell = -1;
  private msgGen = 0;
  private lastHoverSound = 0;

  private cells: Cell[] = [];
  private rows: Row[] = [];
  private kindBtns: Button[] = [];
  private attrBtns: Button[] = [];
  private sortBtns: Button[] = [];
  private slotBtns: Button[] = [];
  private slotPips: Phaser.GameObjects.Rectangle[] = [];
  private actionBtns: Button[] = [];
  private nameField!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.BitmapText;
  private nameCaret!: Phaser.GameObjects.Rectangle;
  private nameZone!: Phaser.GameObjects.Zone;
  private countText!: Phaser.GameObjects.BitmapText;
  private okIcon!: Phaser.GameObjects.Image;
  private curveBars: Phaser.GameObjects.Rectangle[] = [];
  private curveNums: Phaser.GameObjects.BitmapText[] = [];
  private countTexts: Phaser.GameObjects.BitmapText[] = [];
  private reasons!: Phaser.GameObjects.BitmapText;
  private footMsg!: Phaser.GameObjects.BitmapText;
  private footPage!: Phaser.GameObjects.BitmapText;
  private emptyHint!: Phaser.GameObjects.BitmapText;
  private thumb!: Phaser.GameObjects.Rectangle;
  private track!: Phaser.GameObjects.Rectangle;
  private plate: Phaser.GameObjects.GameObject[] = [];
  private plateSeal: Phaser.GameObjects.GameObject[] = [];
  private sealCount!: Phaser.GameObjects.BitmapText;
  private lattice!: Phaser.GameObjects.TileSprite;
  private motes: { img: Phaser.GameObjects.Image; x: number; y: number; v: number; ph: number }[] = [];
  private t = 0;

  constructor() {
    super('Deck');
  }

  init(data: DeckSceneData | undefined): void {
    this.data0 = { ...(data ?? {}) };
    this.leaving = false;
    this.editing = false;
    this.ready = false;
    this.cells = [];
    this.rows = [];
    this.kindBtns = [];
    this.attrBtns = [];
    this.sortBtns = [];
    this.slotBtns = [];
    this.slotPips = [];
    this.actionBtns = [];
    this.curveBars = [];
    this.curveNums = [];
    this.countTexts = [];
    this.motes = [];
    this.plate = [];
    this.plateSeal = [];
    this.scrollRow = 0;
    this.cursor = 0;
    this.deckCursor = 0;
    this.zone = 'pool';
    this.filter = { kind: 'all', attr: null };
    this.sort = 'level';
    this.presetIdx = -1;
    this.exitArmed = 0;
  }

  // ================================================================ build

  create(): void {
    this.cameras.main.setBackgroundColor(PAL.night0);
    this.store = deckStore();
    this.add.image(0, 0, backdropTex(this)).setOrigin(0).setDepth(0);
    this.lattice = this.add.tileSprite(0, 0, GAME_W, GAME_H, latticeTex(this)).setOrigin(0).setAlpha(0.55).setDepth(1);
    this.buildMotes();

    // drafts: one working copy per slot (an empty slot starts as an empty deck)
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = this.store.slot(i);
      this.drafts.push(s ? { name: s.name, cards: [...s.cards], savedKey: keyOf(s.name, s.cards) } : { name: `Deste ${i + 1}`, cards: [], savedKey: keyOf(`Deste ${i + 1}`, []) });
    }
    const lastEdit = Number((this.store.last('edit') ?? '').replace('slot:', ''));
    this.slot = this.data0.slot ?? (Number.isInteger(lastEdit) && lastEdit >= 0 && lastEdit < SLOT_COUNT ? lastEdit : 0);
    if (this.data0.qa?.cards) this.cur.cards = [...this.data0.qa.cards];
    if (this.data0.qa?.name) this.cur.name = this.data0.qa.name;
    if (this.data0.qa?.kind) this.filter.kind = this.data0.qa.kind;
    if (this.data0.qa && 'attr' in this.data0.qa) this.filter.attr = this.data0.qa.attr ?? null;
    if (this.data0.qa?.sort) this.sort = this.data0.qa.sort;

    this.buildHeader();
    this.buildPool();
    this.buildDeckPanel();
    this.buildPlate();
    this.insp = new InspectPanel(this);

    this.refreshList();
    if (this.data0.qa?.cursor !== undefined) this.cursor = Math.max(0, Math.min(this.list.length - 1, this.data0.qa.cursor));
    this.ensureVisible();
    this.renderAll();
    this.showInspect();
    this.say(this.cur.cards.length ? 'Kartlara tıklayarak desteni kur.' : 'Boş deste: bir karta tıkla, ya da Rastgele / Hazır dene.', 'info', true);

    const onKey = (e: KeyboardEvent) => {
      if (!this.sys.isActive()) return;
      if (this.onKey(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    const onWheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.wheel(dy);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, onWheel);
    const onUpdate = (_t: number, dt: number) => this.tick(dt);
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.input.off(Phaser.Input.Events.POINTER_WHEEL, onWheel);
      this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      this.insp?.destroy();
    });

    (window.__neon as Record<string, unknown>).deck = this;
    void fadeFromInk(this).then(() => {
      this.ready = true;
    });
    this.game.events.emit('deck:ready');
    if (this.data0.dev) this.ready = true;
    if (!this.data0.dev && window.__neon) window.__neon.ready = true;
  }

  private get cur(): Draft {
    return this.drafts[this.slot];
  }

  private buildMotes(): void {
    for (let i = 0; i < 16; i++) {
      const img = this.add.image(0, 0, TEX.px1).setDepth(2).setTint(i % 3 === 0 ? PAL.cyan2 : PAL.night4);
      const m = { img, x: (i * 97) % GAME_W, y: (i * 53) % GAME_H, v: 3 + (i % 5) * 1.5, ph: i * 0.7 };
      img.setPosition(m.x, m.y);
      this.motes.push(m);
    }
  }

  private panel(x: number, y: number, w: number, h: number, style: 'neutral' | 'gold' | 'p1' = 'neutral', header = 0): void {
    this.add.image(x, y, panelTex(this, style, w, h, { header, alpha: 236 })).setOrigin(0).setDepth(3);
  }

  private txt(x: number, y: number, s: string, color: number = PAL.mist, size: 'sm' | 'md' = 'sm', depth = 10): Phaser.GameObjects.BitmapText {
    return pixelText(this, x, y, s, { size, color }).setDepth(depth);
  }

  private buildHeader(): void {
    const t = pixelText(this, 10, 6, 'DESTE KUR', { size: 'md', color: PAL.white }).setDepth(10);
    t.setTint(PAL.gold4, PAL.gold4, PAL.gold3, PAL.gold3);
    this.txt(96, 8, 'Beş Mühür, tek kopya kuralı, 20 kart', PAL.steel);
    const back = new Button(this, GAME_W - 66, 2, { w: 62, h: 18, label: 'GERİ', size: 'sm', icon: ICON.close, style: 'neutral', depth: 20 });
    back.onClick = () => void this.leave();
    back.onHover = (on) => on && this.say('Ana menüye dön (ESC)', 'info');
  }

  private chip(x: number, y: number, w: number, label: string, onClick: () => void, icon?: string): Button {
    const b = new Button(this, x, y, { w, h: 14, label, size: 'sm', icon, style: 'neutral', depth: 20 });
    b.onClick = onClick;
    return b;
  }

  private buildPool(): void {
    this.panel(PX, PY, PW, PH);
    // row 1: kind + element chips
    let x = PX + 5;
    for (const k of KINDS) {
      const w = Math.ceil(measureText(KIND_LABEL[k], 'sm').w) + 10;
      const b = this.chip(x, PY + 4, w, KIND_LABEL[k], () => this.setKind(k));
      b.onHover = (on) => on && this.say(`Süz: ${KIND_LABEL[k]}`, 'info');
      this.kindBtns.push(b);
      x += w + 2;
    }
    x += 6;
    for (const a of ELEMENTS) {
      const b = this.chip(x, PY + 4, 17, '', () => this.setAttr(this.filter.attr === a ? null : a), orbTex(this, a));
      b.onHover = (on) => on && this.say(`Element: ${ATTRIBUTE_NAMES[a]}`, 'info');
      this.attrBtns.push(b);
      x += 19;
    }
    // row 2: sort chips
    this.txt(PX + 6, PY + 23, 'SIRALA', PAL.steel);
    x = PX + 46;
    for (const k of SORT_KEYS) {
      const w = Math.ceil(measureText(SORT_LABEL[k], 'sm').w) + 10;
      const b = this.chip(x, PY + 20, w, SORT_LABEL[k], () => this.setSort(k));
      b.onHover = (on) => on && this.say(`Sırala: ${SORT_LABEL[k]}`, 'info');
      this.sortBtns.push(b);
      x += w + 2;
    }
    this.footPage = pixelText(this, PX + PW - 10, PY + 23, '', { size: 'sm', color: PAL.steel, originX: 1 }).setDepth(10);

    // grid cells
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) this.cells.push(this.makeCell(r, c));
    this.emptyHint = pixelText(this, GRID_X + 164, GRID_Y + 110, 'Bu süzgeçte kart yok.', { size: 'md', color: PAL.steel, originX: 0.5, align: 'center' }).setDepth(10).setVisible(false);

    // scrollbar
    this.track = this.add.rectangle(PX + PW - 7, GRID_Y, 3, ROWS * (CELL_H + GAP) - GAP, PAL.night2).setOrigin(0).setDepth(10);
    this.thumb = this.add.rectangle(PX + PW - 7, GRID_Y, 3, 20, PAL.steel).setOrigin(0).setDepth(11);
    const tz = this.add.zone(PX + PW - 11, GRID_Y, 11, ROWS * (CELL_H + GAP) - GAP).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    tz.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.dragTrack(p));
    tz.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => p.isDown && this.dragTrack(p));

    // footer: message line
    const fy = GRID_Y + ROWS * (CELL_H + GAP) - GAP + 6;
    this.add.rectangle(PX + 6, fy - 2, PW - 12, 1, PAL.night3).setOrigin(0).setDepth(10);
    this.footMsg = pixelText(this, PX + 8, fy + 3, '', { size: 'sm', color: PAL.mist, maxWidth: PW - 16, lineSpacing: -1 }).setDepth(10);
  }

  private makeCell(r: number, c: number): Cell {
    const x = GRID_X + c * (CELL_W + GAP);
    const y = GRID_Y + r * (CELL_H + GAP);
    const box = this.add.container(x, y).setDepth(8);
    const bg = this.add.image(0, 0, cellTex(this, 'monster', false, false)).setOrigin(0);
    const art = this.add.image(3, 3, cardArtKey(ALL_CARDS[0].id)).setOrigin(0);
    const orb = this.add.image(5, 5, orbTex(this, 'FIRE')).setOrigin(0);
    const lvlBg = this.add.rectangle(46, 33, 1, 1, PAL.ink).setOrigin(1, 1).setAlpha(0.85);
    const lvl = pixelText(this, 46, 38, '', { size: 'sm', color: PAL.gold4, originX: 1, originY: 1 });
    const name = pixelText(this, 51, 3, '', { size: 'sm', color: PAL.white, maxWidth: CELL_W - 53, lineSpacing: -1 });
    const atk = pixelText(this, 52, 26, '', { size: 'sm', color: PAL.crim3 });
    const def = pixelText(this, 82, 26, '', { size: 'sm', color: PAL.cyan3 });
    const word = pixelText(this, 52, 26, '', { size: 'sm', color: PAL.mist });
    const chain = this.add.image(CELL_W - 12, 27, chainTex(this)).setOrigin(0);
    const tick = this.add.image(37, 4, tickTex(this)).setOrigin(0);
    box.add([bg, art, orb, lvlBg, lvl, name, atk, def, word, chain, tick]);
    const zone = this.add.zone(x, y, CELL_W, CELL_H).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    const cell: Cell = { box, bg, art, orb, lvlBg, lvl, name, atk, def, word, chain, tick, zone, x, y, index: -1, id: null };
    zone.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (cell.index < 0 || this.editing) return;
      this.setFocus('pool', cell.index, true);
    });
    zone.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (cell.index < 0 || this.editing) return;
      if (p.rightButtonDown()) {
        this.setFocus('pool', cell.index, false);
        return;
      }
      this.pressedCell = cell.index;
      this.setFocus('pool', cell.index, false);
      box.y = y + 1;
    });
    zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      box.y = y;
      if (cell.index < 0 || this.pressedCell !== cell.index || p.rightButtonReleased()) return;
      this.pressedCell = -1;
      this.togglePool(cell.index);
    });
    zone.on(Phaser.Input.Events.POINTER_OUT, () => {
      box.y = y;
      this.pressedCell = -1;
    });
    return cell;
  }

  private buildDeckPanel(): void {
    this.panel(DX, DY, DW, DH);
    // slot tabs
    for (let i = 0; i < SLOT_COUNT; i++) {
      const b = this.chip(DX + 5 + i * 29, DY + 4, 27, String(i + 1), () => this.selectSlot(i));
      b.onHover = (on) => on && this.say(`Yuva ${i + 1}: ${this.store.slot(i)?.name ?? 'boş'}`, 'info');
      this.slotBtns.push(b);
      this.slotPips.push(this.add.rectangle(DX + 5 + i * 29 + 21, DY + 4 + 9, 3, 3, PAL.leaf3).setOrigin(0).setDepth(22).setVisible(false));
    }
    // name field
    this.nameField = this.add.image(DX + 5, DY + 21, panelTex(this, 'neutral', NAME_W, 15, { chamfer: 2, scan: false, alpha: 255 })).setOrigin(0).setDepth(9);
    this.nameText = pixelText(this, DX + 10, DY + 25, '', { size: 'sm', color: PAL.white }).setDepth(10);
    this.nameCaret = this.add.rectangle(DX + 10, DY + 25, 1, 8, PAL.gold4).setOrigin(0).setDepth(11).setVisible(false);
    this.nameZone = this.add.zone(DX + 5, DY + 21, NAME_W, 15).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.nameZone.on(Phaser.Input.Events.POINTER_UP, () => this.setEditing(!this.editing));
    this.nameZone.on(Phaser.Input.Events.POINTER_OVER, () => !this.editing && this.say('Desteye ad ver (N)', 'info'));
    // count line + legal mark
    this.countText = pixelText(this, DX + NAME_W + 9, DY + 24, '', { size: 'md', color: PAL.white }).setDepth(10);
    this.okIcon = this.add.image(DX + DW - 9, DY + 28, ICON.check).setDepth(10).setVisible(false);

    // list rows
    for (let i = 0; i < DECK_SIZE; i++) {
      const y = LIST_Y + i * ROW_H;
      const box = this.add.container(DX + 4, y).setDepth(9);
      const hi = this.add.rectangle(0, 0, DW - 8, ROW_H, PAL.night3).setOrigin(0).setVisible(false);
      const num = pixelText(this, 1, 1, String(i + 1).padStart(2, '0'), { size: 'sm', color: PAL.night4 });
      const orb = this.add.image(12, 0, orbTex(this, 'FIRE')).setOrigin(0);
      const name = pixelText(this, 23, 1, '', { size: 'sm', color: PAL.mist });
      const chain = this.add.image(80, 2, chainTex(this)).setOrigin(0).setVisible(false);
      const lvl = pixelText(this, 113, 1, '', { size: 'sm', color: PAL.gold3, originX: 1 });
      const atk = pixelText(this, 147, 1, '', { size: 'sm', color: PAL.crim3, originX: 1 });
      box.add([hi, num, orb, name, chain, lvl, atk]);
      const zone = this.add.zone(DX + 4, y, DW - 8, ROW_H).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
      const row: Row = { box, hi, orb, name, lvl, atk, num, chain, zone, id: null };
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (!row.id || this.editing) return;
        this.zone = 'deck';
        this.deckCursor = i;
        this.renderFocus();
        this.showInspect();
        this.hoverSound();
      });
      zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
        if (!row.id || this.editing || p.rightButtonReleased()) return;
        this.removeCard(row.id);
      });
      this.rows.push(row);
    }

    // level curve + counts
    const cy = LIST_Y + DECK_SIZE * ROW_H + 3;
    this.add.rectangle(DX + 6, cy - 2, DW - 12, 1, PAL.night3).setOrigin(0).setDepth(10);
    for (let b = 0; b < CURVE_BUCKETS; b++) {
      const bx = DX + 8 + b * 11;
      this.curveBars.push(this.add.rectangle(bx, cy + 20, 9, 1, PAL.gold2).setOrigin(0, 1).setDepth(10));
      this.curveNums.push(pixelText(this, bx + 5, cy + 21, b === CURVE_BUCKETS - 1 ? '8+' : String(b + 1), { size: 'sm', color: b + 1 >= DECK_HIGH_LEVEL ? PAL.crim3 : PAL.steel, originX: 0.5 }).setDepth(10));
    }
    const icons = [ICON.swords, ICON.spell, ICON.trap];
    for (let i = 0; i < 3; i++) {
      const y = cy + 2 + i * 9;
      this.add.image(DX + 104, y + 4, icons[i]).setDepth(10).setTint(i === 0 ? PAL.gold3 : i === 1 ? PAL.teal3 : PAL.mag3);
      this.countTexts.push(pixelText(this, DX + 111, y, '', { size: 'sm', color: PAL.mist }).setDepth(10));
    }
    this.reasons = pixelText(this, DX + 8, cy + 33, '', { size: 'sm', color: PAL.crim3, maxWidth: DW - 16, lineSpacing: -1 }).setDepth(10);

    // action buttons (2 columns x 3 rows)
    const defs: { label: string; tip: string; run: () => void }[] = [
      { label: 'Kaydet', tip: 'Desteyi bu yuvaya kaydet (K)', run: () => this.save() },
      { label: 'Rastgele', tip: 'Rastgele doldur: kalan yerleri kurallara uygun doldurur (R)', run: () => this.randomFill() },
      { label: 'Hazır', tip: 'Hazır desteleri sırayla yükle (H)', run: () => this.nextPreset() },
      { label: 'Sıfırla', tip: 'Klasik 20 kartlık desteyi yükle (D)', run: () => this.resetClassic() },
      { label: 'Temizle', tip: 'Destedeki tüm kartları çıkar (X)', run: () => this.clearDeck() },
      { label: 'Ad Ver', tip: 'Desteye ad ver (N)', run: () => this.setEditing(true) },
    ];
    defs.forEach((d, i) => {
      const b = new Button(this, DX + 4 + (i % 3) * 50, BTN_Y + Math.floor(i / 3) * 17, { w: 49, h: 16, label: d.label, size: 'sm', style: i === 0 ? 'gold' : 'neutral', depth: 20 });
      b.onClick = d.run;
      b.onHover = (on) => on && this.say(d.tip, 'info');
      this.actionBtns.push(b);
    });
  }

  private buildPlate(): void {
    const x = 4;
    const y = 262;
    const w = 128;
    const h = 94;
    this.plate.push(this.add.image(x, y, panelTex(this, 'neutral', w, h, { alpha: 236 })).setOrigin(0).setDepth(3));
    HELP.forEach(([k, v], i) => {
      this.plate.push(this.txt(x + 8, y + 5 + i * 9, k, PAL.gold3));
      this.plate.push(this.txt(x + 44, y + 5 + i * 9, v, PAL.mist));
    });
    // seal mode
    this.plateSeal.push(this.txt(x + 8, y + 5, 'BEŞ MÜHÜR', PAL.gold3));
    this.plateSeal.push(this.add.image(x + w - 14, y + 8, chainTex(this)).setOrigin(0.5).setDepth(10));
    this.plateSeal.push(pixelText(this, x + 8, y + 19, 'Beş Mühür: 5 parça elde birleşirse kazanırsın', { size: 'sm', color: PAL.white, maxWidth: w - 16, lineSpacing: -1 }).setDepth(10));
    this.sealCount = pixelText(this, x + 8, y + 56, '', { size: 'sm', color: PAL.mist, maxWidth: w - 16, lineSpacing: -1 }).setDepth(10);
    this.plateSeal.push(this.sealCount);
    for (const o of this.plateSeal) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
  }

  // ================================================================ state changes

  private refreshList(keepId?: CardId): void {
    const prev = keepId ?? this.list[this.cursor];
    this.list = visibleIds(this.filter, this.sort);
    const i = prev ? this.list.indexOf(prev) : -1;
    this.cursor = i >= 0 ? i : Math.min(this.cursor, Math.max(0, this.list.length - 1));
    const maxRow = Math.max(0, Math.ceil(this.list.length / COLS) - ROWS);
    this.scrollRow = Math.min(this.scrollRow, maxRow);
  }

  private setKind(k: KindFilter): void {
    if (this.filter.kind === k) return;
    this.filter = { ...this.filter, kind: k, attr: k === 'spell' || k === 'trap' ? null : this.filter.attr };
    this.afterFilter();
  }

  private setAttr(a: Attribute | null): void {
    this.filter = { kind: a && this.filter.kind !== 'monster' ? 'monster' : this.filter.kind, attr: a };
    this.afterFilter();
  }

  private setSort(k: SortKey): void {
    if (this.sort === k) return;
    this.sort = k;
    this.afterFilter();
  }

  private afterFilter(): void {
    sfx.play('uiClick', { volume: 0.5, pitch: 1.1 });
    const keep = this.list[this.cursor];
    this.scrollRow = 0;
    this.refreshList(keep);
    this.ensureVisible();
    this.renderAll();
    this.showInspect();
    this.slideGrid(1);
  }

  private selectSlot(i: number): void {
    if (this.editing) this.setEditing(false);
    if (i === this.slot) return;
    this.slot = i;
    this.presetIdx = -1;
    this.deckCursor = 0;
    sfx.play('uiClick', { volume: 0.55, pitch: 1.05 });
    this.renderAll();
    this.say(`Yuva ${i + 1}: ${this.store.slot(i) ? this.cur.name : 'boş yuva'}`, 'info');
  }

  /** Cell index of the cursor card -> focus (mouse hover / keys). */
  private setFocus(zone: Zone, index: number, sound: boolean): void {
    const changed = this.zone !== zone || this.cursor !== index;
    this.zone = zone;
    if (zone === 'pool') this.cursor = index;
    if (!changed) return;
    if (sound) this.hoverSound();
    this.renderFocus();
    this.showInspect();
  }

  private hoverSound(): void {
    const now = this.time.now;
    if (now - this.lastHoverSound < 45) return;
    this.lastHoverSound = now;
    sfx.play('uiHover', { volume: 0.4 });
  }

  private ensureVisible(): void {
    const row = Math.floor(this.cursor / COLS);
    if (row < this.scrollRow) this.scrollRow = row;
    else if (row >= this.scrollRow + ROWS) this.scrollRow = row - ROWS + 1;
    const maxRow = Math.max(0, Math.ceil(this.list.length / COLS) - ROWS);
    this.scrollRow = Math.max(0, Math.min(maxRow, this.scrollRow));
  }

  private wheel(dy: number): void {
    if (!this.ready || this.editing || !dy) return;
    this.scrollBy(dy > 0 ? 1 : -1);
  }

  private scrollBy(rows: number): void {
    const maxRow = Math.max(0, Math.ceil(this.list.length / COLS) - ROWS);
    const next = Math.max(0, Math.min(maxRow, this.scrollRow + rows));
    if (next === this.scrollRow) return;
    const dir = next > this.scrollRow ? 1 : -1;
    this.scrollRow = next;
    // keep the cursor inside the window
    const lo = this.scrollRow * COLS;
    const hi = (this.scrollRow + ROWS) * COLS - 1;
    this.cursor = Math.max(lo, Math.min(Math.min(hi, this.list.length - 1), this.cursor));
    this.renderGrid();
    this.renderFocus();
    this.showInspect();
    this.slideGrid(dir);
  }

  private dragTrack(p: Phaser.Input.Pointer): void {
    const total = Math.ceil(this.list.length / COLS);
    const maxRow = Math.max(0, total - ROWS);
    if (!maxRow) return;
    const t = Math.max(0, Math.min(1, (p.y - GRID_Y) / (ROWS * (CELL_H + GAP))));
    const next = Math.round(t * maxRow);
    if (next !== this.scrollRow) this.scrollBy(next - this.scrollRow);
  }

  // ---------------------------------------------------------------- deck edits

  private inDeck(id: CardId): boolean {
    return this.cur.cards.includes(id);
  }

  private togglePool(index: number): void {
    const id = this.list[index];
    if (!id) return;
    if (this.inDeck(id)) this.removeCard(id);
    else this.addCard(id, index);
  }

  private addCard(id: CardId, fromIndex = this.cursor): void {
    const why = addBlocker(this.cur.cards, id);
    if (why) {
      sfx.play('uiError', { volume: 0.55 });
      this.say(why, 'bad');
      this.shakeCell(fromIndex);
      return;
    }
    this.cur.cards.push(id);
    sfx.play('uiClick', { volume: 0.7, pitch: 1.25 });
    this.afterEdit();
    const shown = this.sortedDeck().indexOf(id);
    this.flyTo(fromIndex, shown);
    this.flashRow(shown);
    this.say(`${CARDS[id].name} desteye eklendi (${this.cur.cards.length}/${DECK_SIZE})`, 'ok');
  }

  private removeCard(id: CardId): void {
    const i = this.cur.cards.indexOf(id);
    if (i < 0) return;
    this.cur.cards.splice(i, 1);
    sfx.play('uiClick', { volume: 0.6, pitch: 0.8 });
    this.afterEdit();
    this.say(`${CARDS[id].name} desteden çıkarıldı (${this.cur.cards.length}/${DECK_SIZE})`, 'info');
  }

  private afterEdit(): void {
    this.deckCursor = Math.max(0, Math.min(this.cur.cards.length - 1, this.deckCursor));
    this.renderGrid();
    this.renderDeck();
    this.renderFocus();
    this.renderPlate();
  }

  private sortedDeck(): CardId[] {
    const defs = this.cur.cards.map((id) => CARDS[id]);
    return sortPool(defs, 'level').map((d) => d.id);
  }

  private save(): void {
    if (this.editing) this.setEditing(false);
    const d = this.cur;
    this.store.setSlot(this.slot, { name: d.name, cards: d.cards });
    this.store.setLast('edit', slotRef(this.slot));
    d.savedKey = keyOf(this.store.slot(this.slot)!.name, d.cards);
    d.name = this.store.slot(this.slot)!.name;
    sfx.play('uiConfirm', { volume: 0.7 });
    this.renderDeck();
    this.pulse(this.nameField);
    const v = validateDeck(d.cards);
    const where = this.store.persisted ? '' : ' (bu oturumda; tarayıcı kaydetmeye izin vermiyor)';
    this.say(v.ok ? `Kaydedildi: yuva ${this.slot + 1} · oynanabilir${where}` : `Kaydedildi: yuva ${this.slot + 1} · henüz oynanamaz${where}`, v.ok ? 'ok' : 'gold');
  }

  private randomFill(): void {
    if (this.editing) this.setEditing(false);
    const before = this.cur.cards.length;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    this.cur.cards = autoFillDeck(this.cur.cards, seed);
    sfx.play('uiConfirm', { volume: 0.55, pitch: 1.2 });
    this.afterEdit();
    this.pulse(this.countText);
    this.say(this.cur.cards.length > before ? `${this.cur.cards.length - before} kart eklendi: ${this.cur.cards.length}/${DECK_SIZE}` : 'Eklenecek uygun kart bulunamadı', this.cur.cards.length > before ? 'ok' : 'bad');
  }

  private nextPreset(): void {
    if (this.editing) this.setEditing(false);
    const list = presetDecks();
    this.presetIdx = (this.presetIdx + 1) % list.length;
    const p = list[this.presetIdx];
    this.cur.cards = [...p.cards];
    this.cur.name = p.name.slice(0, NAME_MAX);
    sfx.play('uiConfirm', { volume: 0.55, pitch: 1.1 });
    this.afterEdit();
    this.renderDeck();
    this.say(`${p.name}: ${p.blurb}`, 'gold');
  }

  private resetClassic(): void {
    if (this.editing) this.setEditing(false);
    this.cur.cards = classicDeck();
    this.cur.name = 'Klasik Deste';
    this.presetIdx = -1;
    sfx.play('uiConfirm', { volume: 0.5, pitch: 0.95 });
    this.afterEdit();
    this.renderDeck();
    this.say('Klasik 20 kartlık deste yüklendi.', 'info');
  }

  private clearDeck(): void {
    if (this.editing) this.setEditing(false);
    if (!this.cur.cards.length) return;
    this.cur.cards = [];
    sfx.play('uiBack', { volume: 0.6 });
    this.afterEdit();
    this.say('Deste boşaltıldı.', 'info');
  }

  // ---------------------------------------------------------------- name editing

  private setEditing(on: boolean): void {
    if (on === this.editing) return;
    this.editing = on;
    this.nameFresh = on;
    this.caretT = 0;
    sfx.play(on ? 'uiClick' : 'uiConfirm', { volume: 0.45 });
    if (!on) this.cur.name = this.cur.name.trim() || `Deste ${this.slot + 1}`;
    this.renderDeck();
    this.say(on ? 'Ad yaz, ENTER ile bitir' : 'Ad güncellendi', 'info');
  }

  private typeName(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' || e.key === 'Escape') {
      this.setEditing(false);
      return true;
    }
    if (e.key === 'Backspace') {
      this.cur.name = this.nameFresh ? '' : this.cur.name.slice(0, -1);
      this.nameFresh = false;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[A-Za-z0-9çğıöşüÇĞİÖŞÜ _.!+-]/.test(e.key)) {
      if (this.nameFresh) this.cur.name = '';
      this.nameFresh = false;
      if (this.cur.name.length < NAME_MAX) this.cur.name += e.key;
    } else return e.key.length === 1 || e.key === 'Backspace';
    this.caretT = 0;
    this.renderDeck();
    return true;
  }

  // ================================================================ keyboard

  private onKey(e: KeyboardEvent): boolean {
    if (this.leaving || !this.ready) return false;
    if (this.editing) return this.typeName(e);
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const code = e.code;
    const dir = (dx: number, dy: number) => {
      if (this.zone === 'pool') {
        const atRight = dx > 0 && this.cursor % COLS === COLS - 1;
        if (atRight && this.cur.cards.length) return this.switchZone('deck');
        const n = gridMove(this.cursor, dx, dy, COLS, this.list.length);
        if (n >= 0) this.moveCursor(n);
      } else {
        if (dx < 0) return this.switchZone('pool');
        const n = this.cur.cards.length;
        if (n) {
          this.deckCursor = (this.deckCursor + dy + n) % n;
          this.renderFocus();
          this.showInspect();
          this.hoverSound();
        }
      }
    };
    switch (code) {
      case 'ArrowLeft':
        dir(-1, 0);
        return true;
      case 'ArrowRight':
        dir(1, 0);
        return true;
      case 'ArrowUp':
        dir(0, -1);
        return true;
      case 'ArrowDown':
        dir(0, 1);
        return true;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        if (e.repeat) return true;
        if (this.zone === 'pool') this.togglePool(this.cursor);
        else this.removeCard(this.sortedDeck()[this.deckCursor]);
        return true;
      case 'Delete':
      case 'Backspace': {
        const id = this.zone === 'pool' ? this.list[this.cursor] : this.sortedDeck()[this.deckCursor];
        if (id && this.inDeck(id)) this.removeCard(id);
        return true;
      }
      case 'Tab':
        this.switchZone(this.zone === 'pool' ? 'deck' : 'pool', e.shiftKey);
        return true;
      case 'PageDown':
        this.scrollBy(ROWS - 1);
        return true;
      case 'PageUp':
        this.scrollBy(-(ROWS - 1));
        return true;
      case 'Home':
        this.moveCursor(0);
        return true;
      case 'End':
        this.moveCursor(this.list.length - 1);
        return true;
      case 'Escape':
        void this.leave();
        return true;
    }
    const digit = /^(Digit|Numpad)([1-5])$/.exec(code);
    if (digit) {
      this.selectSlot(Number(digit[2]) - 1);
      return true;
    }
    if (e.repeat) return false;
    switch (code) {
      case 'KeyK':
        this.save();
        return true;
      case 'KeyR':
        this.randomFill();
        return true;
      case 'KeyH':
        this.nextPreset();
        return true;
      case 'KeyD':
        this.resetClassic();
        return true;
      case 'KeyX':
        this.clearDeck();
        return true;
      case 'KeyN':
        this.setEditing(true);
        return true;
      case 'KeyF':
        this.setKind(KINDS[(KINDS.indexOf(this.filter.kind) + 1) % KINDS.length]);
        return true;
      case 'KeyE': {
        const i = this.filter.attr ? ELEMENTS.indexOf(this.filter.attr) : -1;
        this.setAttr(i + 1 >= ELEMENTS.length ? null : ELEMENTS[i + 1]);
        return true;
      }
      case 'KeyO':
        this.setSort(SORT_KEYS[(SORT_KEYS.indexOf(this.sort) + 1) % SORT_KEYS.length]);
        return true;
    }
    return false;
  }

  private moveCursor(n: number): void {
    if (n === this.cursor) return;
    this.cursor = n;
    this.hoverSound();
    const before = this.scrollRow;
    this.ensureVisible();
    if (before !== this.scrollRow) {
      this.renderGrid();
      this.slideGrid(this.scrollRow > before ? 1 : -1);
    }
    this.renderFocus();
    this.showInspect();
  }

  private switchZone(z: Zone, _back = false): void {
    if (z === 'deck' && !this.cur.cards.length) {
      sfx.play('uiError', { volume: 0.35 });
      this.say('Deste boş: önce kart ekle', 'bad');
      return;
    }
    this.zone = z;
    this.deckCursor = Math.max(0, Math.min(this.cur.cards.length - 1, this.deckCursor));
    this.hoverSound();
    this.renderFocus();
    this.showInspect();
  }

  // ================================================================ rendering

  private renderAll(): void {
    this.renderChips();
    this.renderGrid();
    this.renderDeck();
    this.renderFocus();
    this.renderPlate();
  }

  private renderChips(): void {
    KINDS.forEach((k, i) => this.kindBtns[i].setStyle(this.filter.kind === k ? 'gold' : 'neutral'));
    ELEMENTS.forEach((a, i) => this.attrBtns[i].setStyle(this.filter.attr === a ? 'gold' : 'neutral'));
    SORT_KEYS.forEach((k, i) => this.sortBtns[i].setStyle(this.sort === k ? 'p1' : 'neutral'));
  }

  private cellKind(id: CardId): CellKind {
    return CARDS[id].kind;
  }

  private renderGrid(): void {
    const total = this.list.length;
    this.emptyHint.setVisible(total === 0);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r * COLS + c];
        const index = (this.scrollRow + r) * COLS + c;
        const id = this.list[index] ?? null;
        cell.index = id ? index : -1;
        cell.id = id;
        cell.box.setVisible(!!id);
        if (cell.zone.input) cell.zone.input.enabled = !!id;
        if (!id) continue;
        this.bindCell(cell, id);
      }
    // scrollbar
    const rowsTotal = Math.ceil(total / COLS);
    const need = rowsTotal > ROWS;
    this.track.setVisible(need);
    this.thumb.setVisible(need);
    if (need) {
      const h = this.track.height;
      const th = Math.max(10, Math.round((h * ROWS) / rowsTotal));
      const maxRow = rowsTotal - ROWS;
      this.thumb.setSize(3, th).setPosition(this.track.x, GRID_Y + Math.round(((h - th) * this.scrollRow) / maxRow));
    }
    const first = total ? this.scrollRow * COLS + 1 : 0;
    const last = Math.min(total, (this.scrollRow + ROWS) * COLS);
    this.footPage.setText(total ? `${first}-${last} / ${total} kart` : '0 kart');
  }

  private bindCell(cell: Cell, id: CardId): void {
    const d = CARDS[id];
    const inDeck = this.inDeck(id);
    const focus = this.zone === 'pool' && cell.index === this.cursor;
    cell.bg.setTexture(cellTex(this, this.cellKind(id), focus, inDeck));
    cell.art.setTexture(cardArtKey(id)).setAlpha(inDeck && !focus ? 0.62 : 1);
    cell.orb.setTexture(orbTex(this, orbOf(id)));
    cell.tick.setVisible(inDeck);
    cell.chain.setVisible(isSealCard(id));
    const nameW = CELL_W - 53;
    let lines = wrapText(d.name, 'sm', nameW);
    if (lines.length > 2) lines = [lines[0], fitText(lines.slice(1).join(' '), nameW, (s) => measureText(s, 'sm').w)];
    cell.name.setText(lines.join('\n')).setTint(PAL.white);
    if (isMonster(d)) {
      cell.lvl.setText(`Sv${d.level}`);
      const w = Math.ceil(measureText(`Sv${d.level}`, 'sm').w) - 1;
      cell.lvlBg.setSize(w + 3, 8).setVisible(true).setPosition(46, 37);
      cell.lvl.setPosition(45, 38).setVisible(true).setTint(d.level >= DECK_HIGH_LEVEL ? PAL.crim3 : PAL.gold4);
      cell.atk.setText(String(d.atk)).setVisible(true).setPosition(51, 27);
      cell.def.setText(String(d.def)).setVisible(true).setPosition(51 + Math.ceil(measureText(String(d.atk), 'sm').w) + 4, 27);
      cell.word.setVisible(false);
    } else {
      cell.lvl.setVisible(false);
      cell.lvlBg.setVisible(false);
      cell.atk.setVisible(false);
      cell.def.setVisible(false);
      cell.word.setText(d.kind === 'spell' ? `Büyü · ${SPELL_WORD[d.spellType] ?? 'Normal'}` : 'Tuzak').setVisible(true).setPosition(51, 27);
      cell.word.setTint(d.kind === 'spell' ? KIND_RAMP.spell[3] : KIND_RAMP.trap[3]);
    }
    cell.def.setTint(PAL.cyan3);
    cell.atk.setTint(PAL.crim3);
  }

  /** Only the focus ring / in-deck frames (cheap; used while the mouse sweeps). */
  private renderFocus(): void {
    for (const cell of this.cells) {
      if (!cell.id) continue;
      const focus = this.zone === 'pool' && cell.index === this.cursor;
      const inDeck = this.inDeck(cell.id);
      cell.bg.setTexture(cellTex(this, this.cellKind(cell.id), focus, inDeck));
      cell.art.setAlpha(inDeck && !focus ? 0.62 : 1);
      cell.tick.setVisible(inDeck);
    }
    const sorted = this.sortedDeck();
    this.rows.forEach((r, i) => {
      const on = this.zone === 'deck' && i === this.deckCursor && !!r.id;
      r.hi.setVisible(on);
      r.name.setTint(on ? PAL.white : r.id ? PAL.mist : PAL.night4);
    });
    void sorted;
  }

  private renderDeck(): void {
    const d = this.cur;
    const sorted = this.sortedDeck();
    // slot tabs
    this.slotBtns.forEach((b, i) => {
      b.setStyle(i === this.slot ? 'gold' : 'neutral');
      const saved = this.store.slot(i);
      const pip = this.slotPips[i];
      pip.setVisible(!!saved);
      if (saved) pip.setFillStyle(validateDeck(saved.cards).ok && !saved.missing ? PAL.leaf3 : PAL.crim3);
    });
    // name
    const dirty = keyOf(d.name, d.cards) !== d.savedKey;
    const shown = fitText(d.name, NAME_W - 18, (s) => measureText(s, 'sm').w);
    this.nameText.setText(shown + (dirty ? ' *' : ''));
    this.nameText.setTint(this.editing ? (this.nameFresh ? PAL.white : PAL.gold4) : PAL.white);
    this.nameField.setTexture(panelTex(this, this.editing ? 'gold' : 'neutral', NAME_W, 15, { chamfer: 2, scan: false, alpha: 255 }));
    this.updateCaret();
    // count + legality
    const v = validateDeck(d.cards);
    this.countText.setText(`${d.cards.length}/${DECK_SIZE}`);
    this.countText.setTint(v.ok ? PAL.leaf3 : d.cards.length >= DECK_SIZE ? PAL.crim3 : PAL.white);
    this.okIcon.setVisible(v.ok).setTint(PAL.leaf3);
    // rows
    this.rows.forEach((r, i) => {
      const id = sorted[i] ?? null;
      r.id = id;
      r.num.setTint(id ? PAL.steel : PAL.night3);
      if (r.zone.input) r.zone.input.enabled = !!id;
      if (!id) {
        r.orb.setVisible(false);
        r.name.setText('· · ·').setTint(PAL.night4);
        r.lvl.setText('');
        r.atk.setText('');
        r.chain.setVisible(false);
        return;
      }
      const def = CARDS[id];
      r.orb.setVisible(true).setTexture(orbTex(this, orbOf(id)));
      const nm = fitText(def.name, isSealCard(id) ? 62 : 72, (s) => measureText(s, 'sm').w);
      r.name.setText(nm).setTint(this.zone === 'deck' && i === this.deckCursor ? PAL.white : PAL.mist);
      r.chain.setVisible(isSealCard(id)).setX(23 + Math.ceil(measureText(nm, 'sm').w) + 3);
      if (isMonster(def)) {
        r.lvl.setText(`Sv${def.level}`).setTint(def.level >= DECK_HIGH_LEVEL ? PAL.crim3 : PAL.gold3);
        r.atk.setText(String(def.atk)).setTint(PAL.crim3);
      } else {
        r.lvl.setText('');
        r.atk.setText(def.kind === 'spell' ? 'BÜYÜ' : 'TUZAK').setTint(def.kind === 'spell' ? KIND_RAMP.spell[3] : KIND_RAMP.trap[3]);
      }
    });
    this.renderFocus();
    // curve + counts
    const st = deckStats(d.cards);
    const maxN = Math.max(1, ...st.curve);
    const unit = Math.min(4, Math.floor(16 / maxN));
    st.curve.forEach((n, b) => {
      this.curveBars[b].setSize(9, Math.max(1, n * unit)).setFillStyle(n === 0 ? PAL.night3 : b + 1 >= DECK_HIGH_LEVEL ? PAL.crim2 : PAL.gold2);
      this.curveNums[b].setTint(n ? (b + 1 >= DECK_HIGH_LEVEL ? PAL.crim3 : PAL.gold3) : PAL.night4);
    });
    this.countTexts[0].setText(`${st.monsters}`);
    this.countTexts[1].setText(`${st.spells}`);
    this.countTexts[2].setText(`${st.traps}`);
    // reasons
    if (v.ok) {
      this.reasons.setTint(PAL.leaf3).setText('Deste hazır. Maçta seçebilirsin.');
    } else {
      const text = v.issues.map((i) => `· ${i.text}`).join('\n');
      const lines = wrapText(text, 'sm', DW - 16).slice(0, 4);
      this.reasons.setTint(d.cards.length === 0 ? PAL.steel : PAL.crim3).setText(lines.join('\n'));
    }
  }

  private renderPlate(): void {
    const id = this.currentCard();
    const seal = !!id && isSealCard(id);
    for (const o of this.plate) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(!seal);
    for (const o of this.plateSeal) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(seal);
    if (seal) {
      const have = SEAL_IDS.filter((s) => this.inDeck(s)).length;
      this.sealCount.setText(`Destede: ${have}/${SEAL_IDS.length} parça. ${have === SEAL_IDS.length ? 'Beşi de elinde birleşirse düello biter.' : 'Hepsini toplarsan elde birleştirmek mümkün.'}`);
    }
  }

  private currentCard(): CardId | null {
    return this.zone === 'pool' ? (this.list[this.cursor] ?? null) : (this.sortedDeck()[this.deckCursor] ?? null);
  }

  private showInspect(): void {
    const id = this.currentCard();
    if (id) this.insp.show(id);
    this.renderPlate();
  }

  private say(text: string, tone: Tone, instant = false): void {
    const gen = ++this.msgGen;
    this.footMsg.setText(text).setTint(TONE[tone]);
    if (instant || REDUCED_MOTION) return;
    this.footMsg.setAlpha(0.4);
    void tween(this, { targets: this.footMsg, alpha: 1, duration: 120 }).then(() => gen === this.msgGen && this.footMsg.setAlpha(1));
  }

  // ---------------------------------------------------------------- small motion

  /** Rows of the grid step 3 px and settle (no easing in reduced motion). */
  private slideGrid(dir: number): void {
    if (REDUCED_MOTION) return;
    for (const c of this.cells) {
      if (!c.id) continue;
      c.box.y = c.y + dir * 4;
      c.box.setAlpha(0.5);
      this.tweens.add({ targets: c.box, y: c.y, alpha: 1, duration: 100, ease: 'Quad.Out' });
    }
  }

  private shakeCell(index: number): void {
    if (REDUCED_MOTION) return;
    const c = this.cells.find((k) => k.index === index);
    if (!c) return;
    this.tweens.add({ targets: c.box, x: { from: c.x - 2, to: c.x }, duration: 140, ease: 'Bounce.Out' });
  }

  private flashRow(i: number): void {
    const r = this.rows[i];
    if (!r || REDUCED_MOTION) return;
    r.hi.setVisible(true).setFillStyle(PAL.gold3).setAlpha(0.9);
    void tween(this, { targets: r.hi, alpha: 0, duration: 260, ease: 'Quad.Out' }).then(() => {
      r.hi.setFillStyle(PAL.night3).setAlpha(1);
      this.renderFocus();
    });
  }

  private pulse(o: Phaser.GameObjects.Image | Phaser.GameObjects.BitmapText): void {
    if (REDUCED_MOTION) return;
    o.setTint(PAL.white);
    void wait(this, 90).then(() => this.renderDeck());
  }

  /** A mini card flies from the grid cell to the deck row it joined. */
  private flyTo(fromIndex: number, rowIdx: number): void {
    if (REDUCED_MOTION || rowIdx < 0) return;
    const c = this.cells.find((k) => k.index === fromIndex);
    if (!c) return;
    const img = this.add.image(c.x + 24, c.y + 20, miniCardKey(0)).setDepth(40);
    const x1 = DX + 12;
    const y1 = LIST_Y + rowIdx * ROW_H + 4;
    const x0 = img.x;
    const y0 = img.y;
    void tween(this, {
      targets: { t: 0 },
      t: 1,
      duration: 190,
      ease: 'Cubic.In',
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        const t = (tw.targets[0] as { t: number }).t;
        img.setPosition(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 14));
      },
    }).then(() => img.destroy());
  }

  private updateCaret(): void {
    const w = Math.ceil(measureText(this.cur.name, 'sm').w);
    this.nameCaret.setPosition(DX + 10 + w + 1, DY + 25).setVisible(this.editing && (REDUCED_MOTION || this.caretT % 900 < 560));
  }

  private tick(dt: number): void {
    this.t += dt;
    if (this.editing) {
      this.caretT += dt;
      this.updateCaret();
    }
    if (REDUCED_MOTION) return;
    this.lattice.tilePositionX = Math.floor(this.t / 140);
    this.lattice.tilePositionY = Math.floor(this.t / 280);
    for (const m of this.motes) {
      const y = (m.y - (this.t / 1000) * m.v + GAME_H * 4) % GAME_H;
      m.img.setPosition(Math.round(m.x + Math.sin(this.t / 1400 + m.ph) * 3), Math.round(y));
      m.img.setAlpha(0.25 + 0.35 * (0.5 + 0.5 * Math.sin(this.t / 700 + m.ph)));
    }
  }

  // ================================================================ leaving

  private async leave(): Promise<void> {
    if (this.leaving || !this.ready) return;
    if (this.editing) {
      this.setEditing(false);
      return;
    }
    const dirty = this.drafts.some((d, i) => keyOf(d.name, d.cards) !== (this.store.slot(i) ? keyOf(this.store.slot(i)!.name, this.store.slot(i)!.cards) : d.savedKey) || keyOf(d.name, d.cards) !== d.savedKey);
    if (dirty && this.time.now - this.exitArmed > 2500) {
      this.exitArmed = this.time.now;
      sfx.play('uiError', { volume: 0.4 });
      this.say('Kaydedilmemiş değişiklik var. Çıkmak için yine ESC / GERİ.', 'gold');
      return;
    }
    if (this.data0.dev) {
      this.say('Önizleme: çıkış kapalı', 'info');
      return;
    }
    this.leaving = true;
    this.store.setLast('edit', slotRef(this.slot));
    sfx.play('uiBack', { volume: 0.6 });
    await fadeToInk(this, 160);
    if (this.data0.back) this.scene.start(this.data0.back.key, this.data0.back.data);
    else this.scene.start('Title', { from: 'duel', select: 'deck' });
  }

  // ================================================================ QA

  /** QA: the state the tests and tools read. */
  get qaState(): { slot: number; cards: CardId[]; name: string; list: number; cursor: number; zone: Zone; legal: boolean; scrollRow: number } {
    return { slot: this.slot, cards: [...this.cur.cards], name: this.cur.name, list: this.list.length, cursor: this.cursor, zone: this.zone, legal: validateDeck(this.cur.cards).ok, scrollRow: this.scrollRow };
  }

  qaKey(code: string, key = code): boolean {
    return this.onKey({ code, key, repeat: false, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault() {} } as unknown as KeyboardEvent);
  }

  /** QA: grid cell centres in game pixels, for real-mouse tools. */
  qaLayout(): { cells: { index: number; id: CardId; x: number; y: number }[]; rows: { id: CardId; x: number; y: number }[]; buttons: Record<string, { x: number; y: number }> } {
    const cells = this.cells.filter((c) => c.id).map((c) => ({ index: c.index, id: c.id as CardId, x: c.x + CELL_W / 2, y: c.y + CELL_H / 2 }));
    const rows = this.rows.filter((r) => r.id).map((r, i) => ({ id: r.id as CardId, x: DX + DW / 2, y: LIST_Y + i * ROW_H + 4 }));
    const buttons: Record<string, { x: number; y: number }> = {};
    ['kaydet', 'rastgele', 'hazir', 'sifirla', 'temizle', 'adver'].forEach((k, i) => {
      buttons[k] = { x: DX + 4 + (i % 3) * 50 + 24, y: BTN_Y + Math.floor(i / 3) * 17 + 8 };
    });
    this.slotBtns.forEach((b, i) => (buttons[`slot${i + 1}`] = { x: b.x + 13, y: b.y + 7 }));
    buttons.name = { x: DX + 5 + NAME_W / 2, y: DY + 28 };
    buttons.geri = { x: GAME_W - 35, y: 11 };
    return { cells, rows, buttons };
  }

  /** QA: the colour of an element, to check chips. */
  static elementColor(a: Attribute): number {
    return ATTRIBUTE_COLOR[a];
  }
}
