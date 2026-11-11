// DECK BUILDER — the deck builder (scene key 'Deck'), layout v2 (step 1 of the redesign; target picture
// docs/v3/ref/hedef-deste-kurucu.png, notes docs/DESTE_KURMA.md).
//
//   top        title + crystal, the deck's name (pencil = rename), save slots 1-5, BACK
//   meters     one progress meter per rule (cards, monsters, Lv7+, copies); hover = the detailed reasons
//   left       the collection (hero): search, kind chips, element chips, sort dropdown, a 5×4 grid of the
//              real cards (48×60, art + level + ATK/DEF) with an "n/max" badge; at the limit: veiled + lock
//   middle     the focused card: art at 2×, name, level, type line, ATK/DEF, the effect text, its deck note
//   right      the deck: per section (MONSTERS / SPELLS / TRAPS) a grid of card thumbnails with an "xN"
//              badge (hover: - / +), a deck stack whose height follows the deck size, the level curve
//   bottom     AUTO-FILL, PRESETS, CLASSIC, CLEAR, the message line, SAVE DECK, "?" (keyboard overlay)
//
// Mouse: left click adds a copy, right click removes one (collection and deck); wheel scrolls the panel
// under the pointer. Keyboard does everything (HELP below, "?" shows it). The pool is read from
// COLLECTIBLE_CARDS at runtime; nothing here counts cards. Rules: src/data/decks.ts. Persistence: ./store.ts.
// Presentation hooks for step 2 (fly-in, drag & drop, add / remove feedback): ./fx.ts.

import Phaser from 'phaser';
import { ATTRIBUTE_COLOR, KIND_RAMP, PAL } from '../../art/palette';
import { ATTRIBUTE_NAMES, CARDS, MAGNET_PIECE_IDS, SEAL_IDS, isMonster, type Attribute, type CardId } from '../../data/cards';
import { cardArtKey, cardIsoKey } from '../../art/cards';
import type { TrimName } from '../../art/frame-v3';
import { PixelCanvas } from '../../art/pixel';
import { sfx } from '../../audio/sfx';
import { CURVE_BUCKETS, DECK_HIGH_LEVEL, DECK_MAX, DECK_MIN, addBlocker, autoFillDeck, classicDeck, copiesOf, deckStats, isSealCard, isSingleCopy, maxCopies, presetDecks, validateDeck } from '../../data/decks';
import { measureText, pixelText, wrapText } from '../../ui/text';
import { Button } from '../../view/Button';
import { GAME_H, GAME_W } from '../../view/layout';
import { canvasTexture } from '../../view/v3/hudSkin';
import { ICON, ovalHaloTex } from '../../view/ui-textures';
import { TEX, wait } from '../../vfx/core';
import {
  MINI_H, MINI_W, SPELL_WORD, STRIP_ART_H, STRIP_ART_W, THUMB_H, THUMB_W, buttonIcon, caretDownIcon, checkIcon, crystalIcon, deckThumbTex, lockIcon, meterIcon, miniCardTex, pencilIcon, ringTex, searchIcon, stripArtTex, veilTex,
} from './art';
import { SECTION_LABEL, deckEntries, deckLines, entryMove, lineOfEntry, maxLineScroll, scrollToEntry, visibleLines, type DeckEntry, type DeckLine, type LineMetrics } from './deckList';
import { defaultDeckFx, type DeckFx, type Pt } from './fx';
import { deckMeters, type Meter } from './meters';
import { ELEMENTS, SORT_KEYS, SORT_LABEL, gridMove, visibleIds, type KindFilter, type PoolFilter, type SortKey } from './pool';
import { NAME_MAX, SLOT_COUNT, deckStore, slotRef, type DeckStore } from './store';
import { REDUCED_MOTION, backdropTex, chainTex, fadeFromInk, fadeToInk, fitText, latticeTex, magnetTex, orbOf, orbTex, panelV3, singleTex } from './ui';

export interface DeckSceneData {
  /** Slot to open (default: the last edited one). */
  slot?: number;
  /** Opened by ?dev=deck (QA): Esc does not leave. */
  dev?: boolean;
  /** Where BACK / ESC goes instead of the title menu (the deck picker that opened the builder). */
  back?: { key: string; data: object };
  /** QA: start with this filter / sort / deck. */
  qa?: {
    kind?: KindFilter;
    attr?: Attribute | null;
    sort?: SortKey;
    cards?: CardId[];
    name?: string;
    cursor?: number;
    zone?: Zone;
    deckCursor?: number;
    missing?: number;
    /** Search text. */
    q?: string;
    /** Deck list view: thumbnail grid (default) or the strip mock. */
    list?: ListView;
    /** Show the keyboard overlay. */
    help?: boolean;
    /** Hover this requirement meter (0..3): its tooltip. */
    tip?: number;
    /** Scroll the deck list to this line. */
    deckScroll?: number;
    /** Show the - / + of the focused deck entry (as under the mouse). */
    hoverDeck?: boolean;
  };
}

type Zone = 'pool' | 'deck' | 'search';
type ListView = 'grid' | 'strip';
type Tone = 'info' | 'ok' | 'bad' | 'gold';
const TONE: Record<Tone, number> = { info: PAL.mist, ok: PAL.leaf3, bad: PAL.crim3, gold: PAL.gold3 };

// ---------------------------------------------------------------- layout (640×360)
const TOP_H = 21;
const NAME_X = 112;
const NAME_Y = 3;
const NAME_W = 112;
const NAME_H = 16;
const SLOT_X = 234;
const SLOT_PITCH = 21;
const REQ_Y = 22;
const REQ_H = 20;
const METER_X = 10;
const METER_PITCH = 157;
const METER_W = 146;
const MAIN_Y = 44;
const MAIN_H = 292;
const COL_X = 4;
const COL_W = 272;
const DET_X = 280;
const DET_W = 104;
const DK_X = 388;
const DK_W = 248;
const TB1_Y = 48;
const TB2_Y = 64;
const SEARCH_W = 118;
const GRID_X = 10;
const GRID_Y = 82;
const COLS = 5;
const ROWS = 4;
const PITCH_X = MINI_W + 3;
const PITCH_Y = MINI_H + 3;
const LIST_X = DK_X + 7;
const LIST_Y = 64;
const LIST_W = 226;
const LIST_H = 188;
const PER_ROW: Record<ListView, number> = { grid: 7, strip: 1 };
const METRICS: Record<ListView, LineMetrics> = { grid: { headH: 13, rowH: THUMB_H + 2 }, strip: { headH: 13, rowH: STRIP_ART_H + 1 } };
const THUMB_PITCH = THUMB_W + 2;
const POOL_THUMBS = 42;
const FOOT_Y = 256;
/** Centre of the bottom card of the deck stack. */
const STACK_BASE = FOOT_Y + 50;
const BOT_Y = 340;
const BOT_H = 18;
const MSG_X = 282;
const MSG_W = 214;

const KIND_LABEL: Record<KindFilter, string> = { all: 'ALL', monster: 'MONSTER', spell: 'SPELL', trap: 'TRAP' };
const KINDS: readonly KindFilter[] = ['all', 'monster', 'spell', 'trap'];
const SPELL_TYPE_LONG: Record<string, string> = { normal: 'Normal', equip: 'Equip', field: 'Field', continuous: 'Continuous', quick: 'Quick-Play' };

/** The keyboard overlay ("?"). */
const HELP: readonly (readonly [string, string])[] = [
  ['ARROWS', 'Move in the collection / deck'],
  ['ENTER · SPACE', 'Add (collection) / remove (deck)'],
  ['+ · =   - · DEL', 'Add / remove a copy'],
  ['TAB', 'Switch collection / deck'],
  ['/', 'Search by name (ESC clears)'],
  ['PGUP · PGDN', 'Scroll'],
  ['1-5', 'Deck slot'],
  ['N', 'Rename the deck'],
  ['S', 'Save deck'],
  ['R', 'Auto-fill'],
  ['P · D', 'Next preset · Classic deck'],
  ['X', 'Clear the deck'],
  ['F · E · O', 'Kind / element filter · sort'],
  ['?', 'This overlay'],
  ['ESC', 'Back'],
  ['MOUSE', 'Left click adds, right click removes'],
];

/** The polar fusion family (the three pieces + Polar Sovereign). */
function isMagnetCard(id: CardId): boolean {
  const d = CARDS[id];
  return isMonster(d) && (d.effect === 'magnetPiece' || d.effect === 'magnetFusion');
}

/** The small mark of a card: seal chain, polar magnet, single-copy "1" tag (or none). */
function markTexOf(scene: Phaser.Scene, id: CardId): string | null {
  if (isSealCard(id)) return chainTex(scene);
  if (isMagnetCard(id)) return magnetTex(scene);
  if (isSingleCopy(id)) return singleTex(scene);
  return null;
}

interface Cell {
  box: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Image;
  veil: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Image;
  mark: Phaser.GameObjects.Image;
  badgeBg: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
  x: number;
  y: number;
  index: number;
  id: CardId | null;
}

/** One deck-list entry on screen (grid thumbnail or strip). */
interface Thumb {
  box: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  badgeBg: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.BitmapText;
  name: Phaser.GameObjects.BitmapText;
  minus: StepBtn;
  plus: StepBtn;
  zone: Phaser.GameObjects.Zone;
  entry: DeckEntry | null;
  flat: number;
  x: number;
  y: number;
}

interface StepBtn {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
}

interface Head {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  count: Phaser.GameObjects.BitmapText;
  rule: Phaser.GameObjects.Rectangle;
}

interface MeterView {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  value: Phaser.GameObjects.BitmapText;
  check: Phaser.GameObjects.Image;
  fill: Phaser.GameObjects.Rectangle;
  shine: Phaser.GameObjects.Rectangle;
  x: number;
}

interface Draft {
  name: string;
  cards: CardId[];
  /** The saved copy it was loaded from (to tell if it changed). */
  savedKey: string;
  /** Cards dropped on load because they no longer exist; cleared by saving. */
  missing: number;
  /** Copies of a retired card swapped for a substitute on load (store `replaced`); cleared by saving. */
  replaced?: number;
}

const keyOf = (name: string, cards: readonly string[]) => `${name}|${cards.join(',')}`;

export class DeckScene extends Phaser.Scene {
  private data0: DeckSceneData = {};
  private store!: DeckStore;
  private fx!: DeckFx;
  private drafts: Draft[] = [];
  private slot = 0;
  private filter: PoolFilter = { kind: 'all', attr: null, q: '' };
  private sort: SortKey = 'new';
  private list: CardId[] = [];
  private cursor = 0;
  private scrollRow = 0;
  private zone: Zone = 'pool';
  private deckCursor = 0;
  /** First visible line of the deck list. */
  private deckScroll = 0;
  /** The deck entry under the mouse (-1: none) — shows its - / +. */
  private hoverFlat = -1;
  private view: ListView = 'grid';
  private editing = false;
  /** The first character typed replaces the old name (select-all behaviour). */
  private nameFresh = false;
  private caretT = 0;
  private presetIdx = -1;
  private leaving = false;
  private exitArmed = 0;
  private ready = false;
  private pressedCell = -1;
  private lastHoverSound = 0;
  private helpOpen = false;
  private sortOpen = false;
  private tipIndex = -1;

  private cells: Cell[] = [];
  private thumbs: Thumb[] = [];
  private heads: Head[] = [];
  private kindBtns: Button[] = [];
  private attrBtns: Button[] = [];
  private sortBtn!: Button;
  private sortMenu: Button[] = [];
  private slotBtns: Button[] = [];
  private slotPips: Phaser.GameObjects.Rectangle[] = [];
  private actionBtns: Record<string, Button> = {};
  private meters: MeterView[] = [];
  private nameField!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.BitmapText;
  private nameCaret!: Phaser.GameObjects.Rectangle;
  private searchField!: Phaser.GameObjects.Image;
  private searchText!: Phaser.GameObjects.BitmapText;
  private searchCaret!: Phaser.GameObjects.Rectangle;
  private searchClear!: Phaser.GameObjects.BitmapText;
  private poolCount!: Phaser.GameObjects.BitmapText;
  private emptyHint!: Phaser.GameObjects.BitmapText;
  private track!: Phaser.GameObjects.Rectangle;
  private thumbBar!: Phaser.GameObjects.Rectangle;
  private hoverRing!: Phaser.GameObjects.Image;
  private hoverGlow!: Phaser.GameObjects.Image;
  // detail panel
  private detBg!: Phaser.GameObjects.Image;
  private detFrame!: Phaser.GameObjects.Image;
  private detArt!: Phaser.GameObjects.Image;
  private detName!: Phaser.GameObjects.BitmapText;
  private detStars: Phaser.GameObjects.Image[] = [];
  private detKind!: Phaser.GameObjects.BitmapText;
  private detOrb!: Phaser.GameObjects.Image;
  private detType!: Phaser.GameObjects.BitmapText;
  private detAtk!: Phaser.GameObjects.BitmapText;
  private detDef!: Phaser.GameObjects.BitmapText;
  private detRule!: Phaser.GameObjects.Rectangle;
  private detBody!: Phaser.GameObjects.BitmapText;
  private detNote!: Phaser.GameObjects.BitmapText;
  private detMark!: Phaser.GameObjects.Image;
  private detEmpty!: Phaser.GameObjects.BitmapText;
  private detMore!: Phaser.GameObjects.BitmapText;
  private detLines: string[] = [];
  private detFit = 0;
  private detScroll = 0;
  private detFor: CardId | null = null;
  private shownId: CardId | null | undefined = undefined;
  // deck panel
  private deckTitle!: Phaser.GameObjects.BitmapText;
  private deckState!: Phaser.GameObjects.BitmapText;
  private deckOk!: Phaser.GameObjects.Image;
  private deckEmpty!: Phaser.GameObjects.BitmapText;
  private dTrack!: Phaser.GameObjects.Rectangle;
  private dThumb!: Phaser.GameObjects.Rectangle;
  private stack: Phaser.GameObjects.Image[] = [];
  private stackLabel!: Phaser.GameObjects.BitmapText;
  private stackPool!: Phaser.GameObjects.Image;
  private curveBars: Phaser.GameObjects.Rectangle[] = [];
  private curveTops: Phaser.GameObjects.Rectangle[] = [];
  private curveNums: Phaser.GameObjects.BitmapText[] = [];
  private curveVals: Phaser.GameObjects.BitmapText[] = [];
  private footMsg!: Phaser.GameObjects.BitmapText;
  private tip!: Phaser.GameObjects.Container;
  private help!: Phaser.GameObjects.Container;
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
    this.drafts = [];
    this.cells = [];
    this.thumbs = [];
    this.heads = [];
    this.kindBtns = [];
    this.attrBtns = [];
    this.sortMenu = [];
    this.slotBtns = [];
    this.slotPips = [];
    this.actionBtns = {};
    this.meters = [];
    this.detStars = [];
    this.stack = [];
    this.curveBars = [];
    this.curveTops = [];
    this.curveNums = [];
    this.curveVals = [];
    this.motes = [];
    this.scrollRow = 0;
    this.cursor = 0;
    this.deckCursor = 0;
    this.deckScroll = 0;
    this.hoverFlat = -1;
    this.zone = 'pool';
    this.filter = { kind: 'all', attr: null, q: '' };
    this.sort = 'new';
    this.presetIdx = -1;
    this.exitArmed = 0;
    this.helpOpen = false;
    this.sortOpen = false;
    this.tipIndex = -1;
    this.shownId = undefined;
    this.view = this.data0.qa?.list === 'strip' ? 'strip' : 'grid';
  }

  // ================================================================ build

  create(): void {
    this.cameras.main.setBackgroundColor(PAL.night0);
    this.input.mouse?.disableContextMenu();
    this.store = deckStore();
    this.fx = defaultDeckFx(this);
    this.add.image(0, 0, backdropTex(this)).setOrigin(0).setDepth(0);
    this.lattice = this.add.tileSprite(0, 0, GAME_W, GAME_H, latticeTex(this)).setOrigin(0).setDepth(1);
    this.buildMotes();

    // drafts: one working copy per slot (an empty slot starts as an empty deck)
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = this.store.slot(i);
      this.drafts.push(s ? { name: s.name, cards: [...s.cards], savedKey: keyOf(s.name, s.cards), missing: s.missing, replaced: s.replaced ?? 0 } : { name: `Deck ${i + 1}`, cards: [], savedKey: keyOf(`Deck ${i + 1}`, []), missing: 0 });
    }
    const lastEdit = Number((this.store.last('edit') ?? '').replace('slot:', ''));
    this.slot = this.data0.slot ?? (Number.isInteger(lastEdit) && lastEdit >= 0 && lastEdit < SLOT_COUNT ? lastEdit : 0);
    const qa = this.data0.qa;
    if (qa?.cards) this.cur.cards = [...qa.cards];
    if (qa?.name) this.cur.name = qa.name;
    if (qa?.kind) this.filter.kind = qa.kind;
    if (qa && 'attr' in qa) this.filter.attr = qa.attr ?? null;
    if (qa?.sort) this.sort = qa.sort;
    if (qa?.q) this.filter.q = qa.q;

    this.buildTop();
    this.buildMeters();
    this.buildCollection();
    this.buildDetail();
    this.buildDeckPanel();
    this.buildBottom();
    this.buildTip();
    this.buildHelp();

    this.refreshList();
    if (qa?.cursor !== undefined) this.cursor = Math.max(0, Math.min(this.list.length - 1, qa.cursor));
    if (qa?.zone === 'deck' && this.cur.cards.length) {
      this.zone = 'deck';
      this.deckCursor = Math.min(this.entries().length - 1, qa.deckCursor ?? 0);
      this.deckScroll = scrollToEntry(this.lines(), 0, this.deckCursor, LIST_H, this.metrics);
    }
    if (qa?.zone === 'search') this.zone = 'search';
    if (qa?.deckScroll !== undefined) this.deckScroll = qa.deckScroll;
    if (qa?.hoverDeck && this.zone === 'deck') this.hoverFlat = this.deckCursor;
    if (qa?.missing) this.cur.missing = qa.missing;
    this.ensureVisible();
    this.renderAll();
    this.showDetail();
    if (qa?.help) this.setHelp(true);
    if (qa?.tip !== undefined) this.showTip(qa.tip);
    this.say(this.cur.cards.length ? 'Left click adds a card, right click removes it.' : 'Empty deck: click cards, or try AUTO-FILL / PRESETS.', 'info');

    const onKey = (e: KeyboardEvent) => {
      if (!this.sys.isActive()) return;
      if (this.onKey(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    const onWheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.wheel(dy, p.x);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, onWheel);
    const onDown = (p: Phaser.Input.Pointer) => this.globalDown(p);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    const onUpdate = (_t: number, dt: number) => this.tick(dt);
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.input.off(Phaser.Input.Events.POINTER_WHEEL, onWheel);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
      this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
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

  private get metrics(): LineMetrics {
    return METRICS[this.view];
  }

  private entries(): DeckEntry[] {
    return deckEntries(this.cur.cards);
  }

  private lines(): DeckLine[] {
    return deckLines(this.cur.cards, PER_ROW[this.view]);
  }

  private buildMotes(): void {
    for (let i = 0; i < 16; i++) {
      const img = this.add.image(0, 0, TEX.px1).setDepth(2).setTint(i % 3 === 0 ? PAL.cyan2 : PAL.night4);
      const m = { img, x: (i * 97) % GAME_W, y: (i * 53) % GAME_H, v: 3 + (i % 5) * 1.5, ph: i * 0.7 };
      img.setPosition(m.x, m.y);
      this.motes.push(m);
    }
  }

  private panel(x: number, y: number, w: number, h: number, style: TrimName = 'neutral', header = 0): Phaser.GameObjects.Image {
    return this.add.image(x, y, panelV3(this, style, w, h, header)).setOrigin(0).setDepth(3);
  }

  private txt(x: number, y: number, s: string, color: number = PAL.mist, size: 'sm' | 'md' = 'sm', depth = 10): Phaser.GameObjects.BitmapText {
    return pixelText(this, x, y, s, { size, color }).setDepth(depth);
  }

  private chip(x: number, y: number, w: number, h: number, label: string, onClick: () => void, icon?: string): Button {
    const b = new Button(this, x, y, { w, h, label, size: 'sm', icon, style: 'neutral', depth: 20 });
    b.onClick = onClick;
    return b;
  }

  // ---------------------------------------------------------------- top bar

  private buildTop(): void {
    // a thin night band behind the bar, a cyan rule under it
    this.add.rectangle(0, 0, GAME_W, TOP_H, PAL.night0).setOrigin(0).setDepth(3);
    this.add.rectangle(0, TOP_H - 1, GAME_W, 1, PAL.cyan1).setOrigin(0).setDepth(3);
    this.add.image(5, 3, crystalIcon(this)).setOrigin(0).setDepth(10);
    const t = pixelText(this, 19, 3, 'DECK BUILDER', { size: 'md', color: PAL.cyan3 }).setDepth(10);
    t.setTint(PAL.cyan4, PAL.cyan4, PAL.cyan3, PAL.cyan3);
    this.add.rectangle(104, 4, 1, 13, PAL.night3).setOrigin(0).setDepth(10);

    // name field + pencil
    this.nameField = this.add.image(NAME_X, NAME_Y, panelV3(this, 'neutral', NAME_W, NAME_H)).setOrigin(0).setDepth(9);
    this.nameText = pixelText(this, NAME_X + 6, NAME_Y + 2, '', { size: 'sm', color: PAL.white }).setDepth(10);
    this.nameCaret = this.add.rectangle(NAME_X + 6, NAME_Y + 4, 1, 8, PAL.gold4).setOrigin(0).setDepth(11).setVisible(false);
    this.add.image(NAME_X + NAME_W - 13, NAME_Y + 3, pencilIcon(this)).setOrigin(0).setDepth(10);
    const nz = this.add.zone(NAME_X, NAME_Y, NAME_W, NAME_H).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    nz.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => !p.rightButtonReleased() && this.setEditing(!this.editing));
    nz.on(Phaser.Input.Events.POINTER_OVER, () => !this.editing && this.say('Rename the deck (N)', 'info'));

    // slot tabs
    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = SLOT_X + i * SLOT_PITCH;
      const b = this.chip(x, NAME_Y, 18, NAME_H, String(i + 1), () => this.selectSlot(i));
      b.onHover = (on) => on && this.say(`Slot ${i + 1}: ${this.store.slot(i)?.name ?? 'empty'}`, 'info');
      this.slotBtns.push(b);
      this.slotPips.push(this.add.rectangle(x + 13, NAME_Y + 2, 3, 3, PAL.leaf3).setOrigin(0).setDepth(22).setVisible(false));
    }

    const back = new Button(this, GAME_W - 70, NAME_Y, { w: 66, h: NAME_H, label: 'BACK', size: 'sm', icon: buttonIcon(this, 'back'), style: 'p1', depth: 20 });
    back.onClick = () => void this.leave();
    back.onHover = (on) => on && this.say(this.data0.back ? 'Back to the deck picker (ESC)' : 'Back to the main menu (ESC)', 'info');
    this.actionBtns.back = back;
  }

  // ---------------------------------------------------------------- requirement meters

  private buildMeters(): void {
    this.add.rectangle(0, REQ_Y, GAME_W, REQ_H, PAL.night1).setOrigin(0).setDepth(3);
    this.add.rectangle(0, REQ_Y + REQ_H, GAME_W, 1, PAL.night2).setOrigin(0).setDepth(3);
    const keys = ['cards', 'monsters', 'high', 'copies'] as const;
    keys.forEach((k, i) => {
      const x = METER_X + i * METER_PITCH;
      if (i) this.add.rectangle(x - 6, REQ_Y + 4, 1, REQ_H - 8, PAL.night3).setOrigin(0).setDepth(4);
      const icon = this.add.image(x, REQ_Y + 3, meterIcon(this, k)).setOrigin(0).setDepth(10);
      const label = this.txt(x + 17, REQ_Y + 1, '', PAL.mist);
      const value = this.txt(x + 17, REQ_Y + 1, '', PAL.white);
      const check = this.add.image(x, REQ_Y + 4, checkIcon(this)).setOrigin(0).setDepth(10);
      this.add.rectangle(x + 17, REQ_Y + 14, METER_W - 17, 3, PAL.night0).setOrigin(0).setDepth(9);
      const fill = this.add.rectangle(x + 17, REQ_Y + 14, 1, 3, PAL.cyan2).setOrigin(0).setDepth(10);
      const shine = this.add.rectangle(x + 17, REQ_Y + 14, 1, 1, PAL.cyan3).setOrigin(0).setDepth(11);
      const z = this.add.zone(x - 2, REQ_Y, METER_W + 4, REQ_H).setOrigin(0).setDepth(12).setInteractive();
      z.on(Phaser.Input.Events.POINTER_OVER, () => this.showTip(i));
      z.on(Phaser.Input.Events.POINTER_OUT, () => this.showTip(-1));
      this.meters.push({ icon, label, value, check, fill, shine, x });
    });
  }

  private renderMeters(): void {
    const ms = deckMeters(this.cur.cards, { missing: this.cur.missing, replaced: this.cur.replaced });
    ms.forEach((m, i) => {
      const v = this.meters[i];
      v.label.setText(m.label);
      const lw = Math.ceil(measureText(m.label, 'sm').w);
      v.value.setText(m.value).setX(v.x + 17 + lw + 4).setTint(m.met ? PAL.gold3 : PAL.cyan4);
      const vw = m.value ? Math.ceil(measureText(m.value, 'sm').w) + 4 : 0;
      v.check.setVisible(m.met).setPosition(v.x + 17 + lw + 4 + vw, REQ_Y + 3);
      v.icon.setAlpha(1);
      const w = Math.max(m.fill > 0 ? 1 : 0, Math.round((METER_W - 17) * m.fill));
      v.fill.setVisible(w > 0).setSize(w, 3).setFillStyle(m.met ? PAL.gold2 : PAL.cyan1);
      v.shine.setVisible(w > 0).setSize(w, 1).setFillStyle(m.met ? PAL.gold4 : PAL.cyan2);
      v.label.setTint(m.met ? PAL.white : PAL.mist);
    });
    if (this.tipIndex >= 0) this.showTip(this.tipIndex);
  }

  private buildTip(): void {
    this.tip = this.add.container(0, 0).setDepth(850).setVisible(false);
  }

  /** The tooltip of meter `i` (-1 hides). */
  private showTip(i: number): void {
    this.tipIndex = i;
    this.tip.removeAll(true);
    if (i < 0) {
      this.tip.setVisible(false);
      return;
    }
    const m: Meter = deckMeters(this.cur.cards, { missing: this.cur.missing, replaced: this.cur.replaced })[i];
    const W = 176;
    const lines = m.tip.flatMap((l) => wrapText(l, 'sm', W - 12));
    const H = 8 + lines.length * 10 + 1;
    const x = Math.min(GAME_W - W - 4, METER_X + i * METER_PITCH - 4);
    const bg = this.add.image(0, 0, panelV3(this, m.met ? 'monster' : 'p1', W, H)).setOrigin(0);
    const body = pixelText(this, 6, 3, '', { size: 'sm', color: PAL.white, lineSpacing: -1 });
    body.setText(lines.join('\n'));
    this.tip.add([bg, body]).setPosition(x, REQ_Y + REQ_H + 1).setVisible(true);
  }

  // ---------------------------------------------------------------- collection

  private buildCollection(): void {
    this.panel(COL_X, MAIN_Y, COL_W, MAIN_H, 'p1', 34);
    // search field
    this.searchField = this.add.image(GRID_X - 1, TB1_Y, panelV3(this, 'neutral', SEARCH_W, 14)).setOrigin(0).setDepth(9);
    this.add.image(GRID_X + 3, TB1_Y + 2, searchIcon(this)).setOrigin(0).setDepth(10);
    this.searchText = pixelText(this, GRID_X + 14, TB1_Y + 1, '', { size: 'sm', color: PAL.white }).setDepth(10);
    this.searchCaret = this.add.rectangle(GRID_X + 14, TB1_Y + 3, 1, 8, PAL.gold4).setOrigin(0).setDepth(11).setVisible(false);
    this.searchClear = pixelText(this, GRID_X + SEARCH_W - 9, TB1_Y + 1, 'x', { size: 'sm', color: PAL.steel }).setDepth(11).setVisible(false);
    const sz = this.add.zone(GRID_X - 1, TB1_Y, SEARCH_W - 12, 14).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    sz.on(Phaser.Input.Events.POINTER_UP, () => this.focusSearch(true));
    sz.on(Phaser.Input.Events.POINTER_OVER, () => this.say('Search by name (/)', 'info'));
    const cz = this.add.zone(GRID_X + SEARCH_W - 13, TB1_Y, 12, 14).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    cz.on(Phaser.Input.Events.POINTER_UP, () => (this.filter.q ? this.setQuery('') : this.focusSearch(true)));

    // element chips (row 1, right of the search)
    let x = GRID_X + SEARCH_W + 5;
    for (const a of ELEMENTS) {
      const b = this.chip(x, TB1_Y, 16, 14, '', () => this.setAttr(this.filter.attr === a ? null : a), orbTex(this, a));
      b.onHover = (on) => on && this.say(`Element: ${ATTRIBUTE_NAMES[a]} (E)`, 'info');
      this.attrBtns.push(b);
      x += 18;
    }

    // kind chips (row 2)
    x = GRID_X - 1;
    for (const k of KINDS) {
      const w = Math.ceil(measureText(KIND_LABEL[k], 'sm').w) + 10;
      const b = this.chip(x, TB2_Y, w, 14, KIND_LABEL[k], () => this.setKind(k));
      b.onHover = (on) => on && this.say(`Show: ${KIND_LABEL[k].toLowerCase()} (F)`, 'info');
      this.kindBtns.push(b);
      x += w + 2;
    }
    // sort dropdown (row 2, right)
    const SW = 64;
    const sx = COL_X + COL_W - 8 - SW;
    this.poolCount = pixelText(this, sx - 4, TB2_Y + 1, '', { size: 'sm', color: PAL.steel, originX: 1 }).setDepth(10);
    this.sortBtn = this.chip(sx, TB2_Y, SW, 14, '', () => this.toggleSort());
    this.sortBtn.onHover = (on) => on && this.say('Sort order (O)', 'info');
    this.add.image(sx + SW - 10, TB2_Y + 5, caretDownIcon(this)).setOrigin(0).setDepth(25);
    SORT_KEYS.forEach((k, i) => {
      const b = this.chip(sx, TB2_Y + 15 + i * 15, SW, 14, SORT_LABEL[k], () => {
        this.toggleSort(false);
        this.setSort(k);
      });
      b.setDepth(820).setVisible(false);
      this.sortMenu.push(b);
    });

    // light under the focused card + its ring
    this.hoverGlow = this.add.image(0, 0, ovalHaloTex(this, 30, 38)).setDepth(6).setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.gold3).setAlpha(0.32).setVisible(false);
    this.hoverRing = this.add.image(0, 0, ringTex(this, MINI_W, MINI_H)).setOrigin(0).setDepth(9).setVisible(false);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.cells.push(this.makeCell(r, c));
    this.emptyHint = pixelText(this, COL_X + COL_W / 2, GRID_Y + 100, 'No cards match.\nClear the search or the filters.', { size: 'sm', color: PAL.steel, originX: 0.5, align: 'center' }).setDepth(10).setVisible(false);

    // scrollbar
    const th = ROWS * PITCH_Y - 3;
    this.track = this.add.rectangle(COL_X + COL_W - 7, GRID_Y, 3, th, PAL.night2).setOrigin(0).setDepth(10);
    this.thumbBar = this.add.rectangle(COL_X + COL_W - 7, GRID_Y, 3, 20, PAL.cyan2).setOrigin(0).setDepth(11);
    const tz = this.add.zone(COL_X + COL_W - 10, GRID_Y, 9, th).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    tz.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.dragTrack(p));
    tz.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => p.isDown && this.dragTrack(p));
  }

  private makeCell(r: number, c: number): Cell {
    const x = GRID_X + c * PITCH_X;
    const y = GRID_Y + r * PITCH_Y;
    const box = this.add.container(x, y).setDepth(8);
    const card = this.add.image(0, 0, TEX.px1).setOrigin(0);
    const veil = this.add.image(0, 0, veilTex(this, MINI_W, MINI_H)).setOrigin(0).setVisible(false);
    const lock = this.add.image(MINI_W - 11, 2, lockIcon(this)).setOrigin(0).setVisible(false);
    const mark = this.add.image(MINI_W - 12, 3, chainTex(this)).setOrigin(0).setVisible(false);
    const badgeBg = this.add.rectangle(0, 25, 1, 10, PAL.ink).setOrigin(0);
    const badge = pixelText(this, 0, 24, '', { size: 'sm', color: PAL.white });
    box.add([card, veil, mark, lock, badgeBg, badge]);
    const zone = this.add.zone(x, y, MINI_W, MINI_H).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true });
    const cell: Cell = { box, card, veil, lock, mark, badgeBg, badge, zone, x, y, index: -1, id: null };
    zone.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (cell.index < 0 || this.editing || this.helpOpen) return;
      this.setFocus('pool', cell.index, true);
    });
    zone.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (cell.index < 0 || this.editing || this.helpOpen || this.sortOpen) return;
      this.setFocus('pool', cell.index, false);
      if (p.rightButtonDown()) {
        if (cell.id && this.copies(cell.id)) this.removeCard(cell.id, this.cellCentre(cell));
        return;
      }
      this.pressedCell = cell.index;
      box.y = y;
    });
    zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (cell.index < 0 || this.pressedCell !== cell.index || p.rightButtonReleased()) return;
      this.pressedCell = -1;
      this.addCard(cell.id, cell.index);
    });
    zone.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.pressedCell = -1;
    });
    return cell;
  }

  private cellCentre(c: Cell): Pt {
    return { x: c.x + MINI_W / 2, y: c.y + MINI_H / 2 };
  }

  // ---------------------------------------------------------------- detail

  private buildDetail(): void {
    this.detBg = this.panel(DET_X, MAIN_Y, DET_W, MAIN_H, 'monster', 76);
    this.detFrame = this.add.image(DET_X + 5, MAIN_Y + 5, TEX.px1).setOrigin(0).setDepth(9);
    this.detArt = this.add.image(DET_X + 7, MAIN_Y + 7, TEX.px1).setOrigin(0).setScale(2).setDepth(10);
    this.detName = pixelText(this, DET_X + DET_W / 2, MAIN_Y + 79, '', { size: 'md', color: PAL.white, originX: 0.5, align: 'center' }).setDepth(10);
    for (let i = 0; i < 8; i++) this.detStars.push(this.add.image(0, 0, ICON.star).setOrigin(0).setDepth(10).setVisible(false));
    this.detKind = pixelText(this, DET_X + DET_W / 2, 0, '', { size: 'sm', color: PAL.teal3, originX: 0.5 }).setDepth(10);
    this.detOrb = this.add.image(DET_X + 7, 0, orbTex(this, 'FIRE')).setOrigin(0).setDepth(10);
    this.detType = pixelText(this, DET_X + 19, 0, '', { size: 'sm', color: PAL.mist }).setDepth(10);
    this.detAtk = pixelText(this, DET_X + 7, 0, '', { size: 'sm', color: PAL.crim3 }).setDepth(10);
    this.detDef = pixelText(this, DET_X + 55, 0, '', { size: 'sm', color: PAL.cyan3 }).setDepth(10);
    this.detRule = this.add.rectangle(DET_X + 6, 0, DET_W - 12, 1, PAL.night3).setOrigin(0).setDepth(10);
    this.detBody = pixelText(this, DET_X + 7, 0, '', { size: 'sm', color: PAL.white, lineSpacing: -1 }).setDepth(10);
    this.detNote = pixelText(this, DET_X + 7, 0, '', { size: 'sm', color: PAL.gold3, lineSpacing: -1 }).setDepth(10);
    this.detMark = this.add.image(DET_X + DET_W - 16, 0, chainTex(this)).setOrigin(0).setDepth(10).setVisible(false);
    this.detMore = pixelText(this, DET_X + DET_W - 7, 0, 'more', { size: 'sm', color: PAL.steel, originX: 1 }).setDepth(11).setVisible(false);
    this.detEmpty = pixelText(this, DET_X + DET_W / 2, MAIN_Y + 120, 'Point at a card\nto see it here.', { size: 'sm', color: PAL.steel, originX: 0.5, align: 'center' }).setDepth(10).setVisible(false);
  }

  private artFrameTex(kind: 'monster' | 'spell' | 'trap'): string {
    return canvasTexture(this, `deck2:artframe:${kind}`, () => {
      const R = KIND_RAMP[kind];
      const p = new PixelCanvas(92, 72);
      p.rect(0, 0, 92, 72, PAL.ink);
      p.frame(1, 1, 90, 70, R[2]);
      p.hline(1, 90, 1, R[3]);
      p.vline(1, 1, 70, R[3]);
      p.set(1, 1, R[4]);
      for (const [x, y] of [[0, 0], [91, 0], [0, 71], [91, 71]] as const) p.erase(x, y);
      return p;
    });
  }

  private showDetail(): void {
    const id = this.currentCard();
    this.renderDetail(id);
  }

  private renderDetail(id: CardId | null): void {
    const objs = [this.detFrame, this.detArt, this.detName, this.detKind, this.detOrb, this.detType, this.detAtk, this.detDef, this.detRule, this.detBody, this.detNote];
    this.detEmpty.setVisible(!id);
    for (const o of objs) o.setVisible(!!id);
    this.detMore.setVisible(false);
    for (const s of this.detStars) s.setVisible(false);
    this.detMark.setVisible(false);
    if (!id) {
      this.detBg.setTexture(panelV3(this, 'neutral', DET_W, MAIN_H, 76));
      this.shownId = null;
      return;
    }
    const d = CARDS[id];
    this.shownId = id;
    this.detBg.setTexture(panelV3(this, d.kind, DET_W, MAIN_H, 76));
    this.detFrame.setTexture(this.artFrameTex(d.kind));
    this.detArt.setTexture(cardArtKey(id));
    const cx = DET_X + DET_W / 2;
    // name: md when it fits, otherwise sm on up to two lines
    let y = MAIN_Y + 80;
    if (measureText(d.name, 'md').w <= DET_W - 8) {
      this.detName.destroy();
      this.detName = pixelText(this, cx, y, d.name, { size: 'md', color: PAL.white, originX: 0.5, align: 'center' }).setDepth(10);
      y += 15;
    } else {
      const lines = wrapText(d.name, 'sm', DET_W - 8).slice(0, 2);
      this.detName.destroy();
      this.detName = pixelText(this, cx, y + 1, lines.join('\n'), { size: 'sm', color: PAL.white, originX: 0.5, align: 'center', lineSpacing: -1 }).setDepth(10);
      y += lines.length * 10 + 4;
    }
    if (isMonster(d)) {
      const n = Math.min(8, d.level);
      const sx = Math.round(cx - (n * 6 - 1) / 2);
      for (let i = 0; i < n; i++) this.detStars[i].setPosition(sx + i * 6, y + 1).setVisible(true).setTint(d.level >= DECK_HIGH_LEVEL ? PAL.fire3 : PAL.gold3);
      this.detKind.setVisible(false);
      y += 8;
      this.detOrb.setTexture(orbTex(this, d.attribute)).setY(y + 1);
      this.detType.setText(fitText(`${ATTRIBUTE_NAMES[d.attribute]} / ${d.race}`, DET_W - 26, (s) => measureText(s, 'sm').w)).setY(y);
      y += 12;
      this.detAtk.setText(`ATK ${d.atk}`).setY(y).setVisible(true);
      this.detDef.setText(`DEF ${d.def}`).setY(y).setX(DET_X + DET_W - 7 - Math.ceil(measureText(`DEF ${d.def}`, 'sm').w)).setVisible(true);
      y += 13;
    } else {
      const word = d.kind === 'spell' ? `SPELL · ${(SPELL_TYPE_LONG[d.spellType] ?? 'Normal').toUpperCase()}` : 'TRAP · NORMAL';
      this.detKind.setText(word).setY(y - 1).setTint(KIND_RAMP[d.kind][3]).setVisible(true);
      y += 11;
      this.detOrb.setTexture(orbTex(this, orbOf(id))).setY(y + 1);
      this.detType.setText(d.kind === 'spell' ? 'Spell card' : 'Trap card').setY(y);
      this.detAtk.setVisible(false);
      this.detDef.setVisible(false);
      y += 13;
    }
    this.detRule.setY(y);
    y += 4;
    // deck note at the bottom: copies + the card's rule mark
    const n = this.copies(id);
    const max = maxCopies(id);
    const noteFull = this.noteOf(id);
    const bottom = MAIN_Y + MAIN_H - 6;
    const note = (full: boolean) => [`In deck: ${n}/${max}`, ...(full && noteFull ? wrapText(noteFull, 'sm', DET_W - 14) : [])];
    const words = d.kind === 'monster' && !d.text ? `"${d.flavor}"` : d.text;
    const body = wrapText(words, 'sm', DET_W - 12);
    let noteLines = note(true);
    const rows = (k: number) => Math.floor((bottom - y - k * 10 - 3) / 10);
    if (body.length > rows(noteLines.length)) noteLines = note(false);
    if (this.detFor !== id) this.detScroll = 0;
    this.detFor = id;
    this.detLines = body;
    this.detFit = rows(noteLines.length);
    this.detBody.setY(y).setTint(d.kind === 'monster' && !d.text ? PAL.mist : PAL.white);
    this.paintDetBody();
    const ny = bottom - noteLines.length * 10;
    this.detNote.setText(noteLines.join('\n')).setY(ny).setTint(n >= max ? PAL.gold3 : n ? PAL.cyan3 : PAL.steel);
    const mark = markTexOf(this, id);
    if (mark) this.detMark.setTexture(mark).setPosition(DET_X + DET_W - 16, ny + 3).setVisible(true);
  }

  /** The effect text window (it scrolls with the wheel when the text is longer than the panel). */
  private paintDetBody(): void {
    const fit = this.detFit;
    const all = this.detLines;
    const over = all.length > fit;
    const max = Math.max(0, all.length - fit);
    this.detScroll = Math.max(0, Math.min(max, this.detScroll));
    const shown = all.slice(this.detScroll, this.detScroll + fit);
    this.detBody.setText(shown.join('\n'));
    this.detMore.setVisible(over).setY(this.detBody.y + fit * 10 - 9);
    this.detMore.setText(this.detScroll < max ? 'more' : 'top').setTint(PAL.steel);
  }

  private scrollDetail(dy: number): void {
    if (this.detLines.length <= this.detFit) return;
    const before = this.detScroll;
    this.detScroll += dy > 0 ? 2 : -2;
    this.paintDetBody();
    if (this.detScroll !== before) this.hoverSound();
  }

  /** The rule note of a marked card (seal / polar / single copy), with its deck count. */
  private noteOf(id: CardId): string | null {
    if (isSealCard(id)) {
      const have = SEAL_IDS.filter((s) => this.inDeck(s)).length;
      return `Five Seals: all 5 in hand wins. Deck: ${have}/${SEAL_IDS.length}.`;
    }
    if (isMagnetCard(id)) {
      const have = MAGNET_PIECE_IDS.filter((s) => this.inDeck(s)).length;
      return `Polar: 3 pieces on the field call Polar Sovereign. Deck: ${have}/${MAGNET_PIECE_IDS.length}, Sovereign ${this.inDeck('polar_sovereign') ? 'yes' : 'no'}.`;
    }
    if (isSingleCopy(id)) return 'Single copy: a deck holds only 1.';
    return null;
  }

  // ---------------------------------------------------------------- deck panel

  private buildDeckPanel(): void {
    this.panel(DK_X, MAIN_Y, DK_W, MAIN_H, 'p1', 18);
    this.deckTitle = pixelText(this, DK_X + 8, MAIN_Y + 3, '', { size: 'md', color: PAL.white }).setDepth(10);
    this.deckState = pixelText(this, DK_X + DK_W - 8, MAIN_Y + 5, '', { size: 'sm', color: PAL.steel, originX: 1 }).setDepth(10);
    this.deckOk = this.add.image(0, MAIN_Y + 7, checkIcon(this)).setOrigin(0).setDepth(10).setVisible(false);
    this.add.rectangle(DK_X + 6, MAIN_Y + 18, DK_W - 12, 1, PAL.cyan1).setOrigin(0).setDepth(10);
    this.deckEmpty = pixelText(this, LIST_X + LIST_W / 2, LIST_Y + 70, 'Your deck is empty.\nLeft click a card to add it,\nright click to take it out.', { size: 'sm', color: PAL.steel, originX: 0.5, align: 'center', lineSpacing: -1 }).setDepth(10).setVisible(false);

    for (let i = 0; i < 3; i++) {
      this.heads.push({
        icon: this.add.image(0, 0, this.diamondTex()).setOrigin(0).setDepth(10),
        label: pixelText(this, 0, 0, '', { size: 'sm', color: PAL.gold3 }).setDepth(10),
        count: pixelText(this, 0, 0, '', { size: 'sm', color: PAL.steel, originX: 1 }).setDepth(10),
        rule: this.add.rectangle(0, 0, 1, 1, PAL.night3).setOrigin(0).setDepth(10),
      });
    }
    for (let i = 0; i < POOL_THUMBS; i++) this.thumbs.push(this.makeThumb());

    // scrollbar
    this.dTrack = this.add.rectangle(DK_X + DK_W - 8, LIST_Y, 3, LIST_H, PAL.night2).setOrigin(0).setDepth(10);
    this.dThumb = this.add.rectangle(DK_X + DK_W - 8, LIST_Y, 3, 20, PAL.cyan2).setOrigin(0).setDepth(11);
    const dz = this.add.zone(DK_X + DK_W - 11, LIST_Y, 9, LIST_H).setOrigin(0).setDepth(14).setInteractive({ useHandCursor: true });
    const dragD = (p: Phaser.Input.Pointer) => {
      const max = maxLineScroll(this.lines(), LIST_H, this.metrics);
      if (!max) return;
      const t = Math.max(0, Math.min(1, (p.y - LIST_Y) / LIST_H));
      this.scrollDeck(Math.round(t * max) - this.deckScroll);
    };
    dz.on(Phaser.Input.Events.POINTER_DOWN, dragD);
    dz.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => p.isDown && dragD(p));

    // footer: deck stack (left) + level curve (right)
    this.add.rectangle(DK_X + 6, FOOT_Y - 3, DK_W - 12, 1, PAL.night3).setOrigin(0).setDepth(10);
    this.stackPool = this.add.image(DK_X + 44, STACK_BASE + 8, ovalHaloTex(this, 36, 11)).setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.cyan2).setAlpha(0.45);
    for (let i = 0; i < 24; i++) this.stack.push(this.add.image(DK_X + 44, 0, cardIsoKey('back', 'up', 0)).setDepth(6 + i * 0.01).setVisible(false));
    this.stackLabel = pixelText(this, DK_X + 44, STACK_BASE + 13, '', { size: 'sm', color: PAL.mist, originX: 0.5 }).setDepth(10);
    this.txt(DK_X + 92, FOOT_Y + 1, 'LEVEL CURVE', PAL.steel);
    const base = FOOT_Y + 62;
    for (let b = 0; b < CURVE_BUCKETS; b++) {
      const bx = DK_X + 94 + b * 18;
      this.add.rectangle(bx, base - 44, 12, 44, PAL.night1).setOrigin(0).setDepth(9);
      this.curveBars.push(this.add.rectangle(bx, base, 12, 1, PAL.cyan2).setOrigin(0, 1).setDepth(10));
      this.curveTops.push(this.add.rectangle(bx, base, 12, 1, PAL.cyan4).setOrigin(0).setDepth(11));
      this.curveVals.push(pixelText(this, bx + 6, base, '', { size: 'sm', color: PAL.white, originX: 0.5, originY: 1 }).setDepth(11));
      this.curveNums.push(pixelText(this, bx + 6, base + 1, b === CURVE_BUCKETS - 1 ? '8+' : String(b + 1), { size: 'sm', color: b + 1 >= DECK_HIGH_LEVEL ? PAL.fire3 : PAL.steel, originX: 0.5 }).setDepth(10));
    }
  }

  private diamondTex(): string {
    return canvasTexture(this, 'deck2:diamond', () => {
      const p = new PixelCanvas(7, 7);
      p.stamp(['...#...', '..###..', '.##W##.', '###W###', '.#####.', '..###..', '...#...'], { '#': PAL.white, W: PAL.white }, 0, 0);
      return p;
    });
  }

  private makeThumb(): Thumb {
    const box = this.add.container(0, 0).setDepth(9).setVisible(false);
    const img = this.add.image(0, 0, TEX.px1).setOrigin(0);
    const ring = this.add.image(-2, -2, ringTex(this, THUMB_W, THUMB_H)).setOrigin(0).setVisible(false);
    const badgeBg = this.add.rectangle(0, 0, 1, 10, PAL.ink).setOrigin(0);
    const badge = pixelText(this, 0, 0, '', { size: 'sm', color: PAL.gold4 });
    const name = pixelText(this, STRIP_ART_W + 4, 2, '', { size: 'sm', color: PAL.mist });
    const step = (label: string): StepBtn => {
      const bg = this.add.rectangle(0, 0, 10, 10, label === '+' ? PAL.cyan1 : PAL.crim1).setOrigin(0).setStrokeStyle(1, PAL.ink);
      const lt = pixelText(this, label === '+' ? 2 : 3, -1, label, { size: 'sm', color: PAL.white });
      const b = this.add.container(0, 0, [bg, lt]).setDepth(16).setVisible(false);
      const zone = this.add.zone(0, 0, 11, 11).setOrigin(0).setDepth(17).setInteractive({ useHandCursor: true });
      zone.input!.enabled = false;
      return { box: b, bg, label: lt, zone };
    };
    const minus = step('-');
    const plus = step('+');
    box.add([img, ring, name, badgeBg, badge]);
    const zone = this.add.zone(0, 0, THUMB_W, THUMB_H).setOrigin(0).setDepth(15).setInteractive({ useHandCursor: true });
    zone.input!.enabled = false;
    const th: Thumb = { box, img, ring, badgeBg, badge, name, minus, plus, zone, entry: null, flat: -1, x: 0, y: 0 };
    const focus = () => {
      if (!th.entry || this.editing || this.helpOpen) return;
      const changed = this.zone !== 'deck' || this.deckCursor !== th.flat || this.hoverFlat !== th.flat;
      this.zone = 'deck';
      this.deckCursor = th.flat;
      this.hoverFlat = th.flat;
      if (!changed) return;
      this.hoverSound();
      this.renderDeckList();
      this.renderFocus();
      this.showDetail();
    };
    zone.on(Phaser.Input.Events.POINTER_OVER, focus);
    zone.on(Phaser.Input.Events.POINTER_OUT, (p: Phaser.Input.Pointer) => {
      // leaving the entry (not onto its own - / +): hide the buttons
      const inside = p.x >= th.x && p.x < th.x + this.entryW() && p.y >= th.y && p.y < th.y + this.entryH();
      if (!inside && this.hoverFlat === th.flat) {
        this.hoverFlat = -1;
        this.renderDeckList();
      }
    });
    zone.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (!th.entry || this.editing || this.helpOpen || this.sortOpen) return;
      if (p.rightButtonDown()) this.removeCard(th.entry.id, this.thumbCentre(th));
    });
    zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!th.entry || this.editing || this.helpOpen || p.rightButtonReleased()) return;
      this.addCard(th.entry.id, -1);
    });
    for (const b of [minus, plus]) b.zone.on(Phaser.Input.Events.POINTER_OVER, focus);
    minus.zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!th.entry || this.editing || p.rightButtonReleased()) return;
      this.removeCard(th.entry.id, this.thumbCentre(th));
    });
    plus.zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!th.entry || this.editing || p.rightButtonReleased()) return;
      this.addCard(th.entry.id, -1);
    });
    return th;
  }

  private entryW(): number {
    return this.view === 'grid' ? THUMB_W : LIST_W;
  }

  private entryH(): number {
    return this.view === 'grid' ? THUMB_H : STRIP_ART_H;
  }

  private thumbCentre(th: Thumb): Pt {
    return { x: th.x + Math.round(this.entryW() / 2), y: th.y + Math.round(this.entryH() / 2) };
  }

  // ---------------------------------------------------------------- bottom row

  private buildBottom(): void {
    this.add.rectangle(0, BOT_Y - 3, GAME_W, 1, PAL.night2).setOrigin(0).setDepth(3);
    const defs: { key: string; label: string; icon: string; w: number; tip: string; run: () => void }[] = [
      { key: 'auto', label: 'AUTO-FILL', icon: buttonIcon(this, 'auto'), w: 74, tip: 'Fill the free space with legal cards (R)', run: () => this.randomFill() },
      { key: 'preset', label: 'PRESETS', icon: buttonIcon(this, 'preset'), w: 64, tip: 'Load the preset decks one by one (P)', run: () => this.nextPreset() },
      { key: 'classic', label: 'CLASSIC', icon: buttonIcon(this, 'classic'), w: 64, tip: 'Load the Classic deck: the first 20 cards x2 (D)', run: () => this.resetClassic() },
      { key: 'clear', label: 'CLEAR', icon: buttonIcon(this, 'clear'), w: 56, tip: 'Remove every card from the deck (X)', run: () => this.clearDeck() },
    ];
    let x = 4;
    for (const d of defs) {
      const b = new Button(this, x, BOT_Y, { w: d.w, h: BOT_H, label: d.label, icon: d.icon, size: 'sm', style: 'p1', depth: 20 });
      b.onClick = d.run;
      b.onHover = (on) => on && this.say(d.tip, 'info');
      this.actionBtns[d.key] = b;
      x += d.w + 4;
    }
    this.footMsg = pixelText(this, MSG_X, BOT_Y + 3, '', { size: 'sm', color: PAL.mist }).setDepth(10);
    const save = new Button(this, DK_X + 116 - 4, BOT_Y, { w: 102, h: BOT_H, label: 'SAVE DECK', icon: buttonIcon(this, 'save'), size: 'md', style: 'gold', depth: 20 });
    save.onClick = () => this.save();
    save.onHover = (on) => on && this.say('Save the deck to this slot (S)', 'info');
    this.actionBtns.save = save;
    const q = new Button(this, GAME_W - 24, BOT_Y, { w: 20, h: BOT_H, label: '?', size: 'md', style: 'p1', depth: 20 });
    q.onClick = () => this.setHelp(!this.helpOpen);
    q.onHover = (on) => on && this.say('Keyboard shortcuts (?)', 'info');
    this.actionBtns.help = q;
  }

  // ---------------------------------------------------------------- keyboard overlay

  private buildHelp(): void {
    const W = 300;
    const H = 30 + HELP.length * 11;
    const x = Math.round((GAME_W - W) / 2);
    const y = Math.round((GAME_H - H) / 2);
    const shade = this.add.image(0, 0, veilTex(this, GAME_W + 2, GAME_H + 2)).setOrigin(0).setPosition(-1, -1);
    const bg = this.add.image(x, y, panelV3(this, 'p1', W, H, 16)).setOrigin(0);
    const title = pixelText(this, x + 8, y + 3, 'KEYBOARD SHORTCUTS', { size: 'sm', color: PAL.cyan4 });
    const close = pixelText(this, x + W - 8, y + 3, '? / ESC closes', { size: 'sm', color: PAL.steel, originX: 1 });
    const parts: Phaser.GameObjects.GameObject[] = [shade, bg, title, close];
    HELP.forEach(([k, v], i) => {
      parts.push(pixelText(this, x + 10, y + 21 + i * 11, k, { size: 'sm', color: PAL.gold3 }));
      parts.push(pixelText(this, x + 100, y + 21 + i * 11, v, { size: 'sm', color: PAL.white }));
    });
    this.help = this.add.container(0, 0, parts).setDepth(900).setVisible(false);
    const z = this.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0).setDepth(901);
    z.setInteractive();
    z.input!.enabled = false;
    z.on(Phaser.Input.Events.POINTER_UP, () => this.setHelp(false));
    this.help.setData('zone', z);
  }

  private setHelp(on: boolean): void {
    if (on === this.helpOpen) return;
    this.helpOpen = on;
    this.help.setVisible(on);
    const z = this.help.getData('zone') as Phaser.GameObjects.Zone;
    // the closing click must not reach the cards under it: enable on the next frame, disable at once
    if (on) void wait(this, 1).then(() => this.helpOpen && (z.input!.enabled = true));
    else z.input!.enabled = false;
    if (on) this.toggleSort(false);
    sfx.play(on ? 'uiClick' : 'uiBack', { volume: 0.4 });
  }

  // ================================================================ state changes

  private refreshList(keepId?: CardId): void {
    const prev = keepId ?? this.list[this.cursor];
    this.list = visibleIds(this.filter, this.sort);
    const i = prev ? this.list.indexOf(prev) : -1;
    this.cursor = i >= 0 ? i : Math.min(this.cursor, Math.max(0, this.list.length - 1));
    this.scrollRow = Math.min(this.scrollRow, this.maxRow());
  }

  private maxRow(): number {
    return Math.max(0, Math.ceil(this.list.length / COLS) - ROWS);
  }

  private setKind(k: KindFilter): void {
    if (this.filter.kind === k) return;
    this.filter = { ...this.filter, kind: k, attr: k === 'spell' || k === 'trap' ? null : this.filter.attr };
    this.afterFilter();
  }

  private setAttr(a: Attribute | null): void {
    this.filter = { ...this.filter, kind: a && this.filter.kind !== 'monster' ? 'monster' : this.filter.kind, attr: a };
    this.afterFilter();
  }

  private setSort(k: SortKey): void {
    if (this.sort === k) return;
    this.sort = k;
    this.afterFilter();
  }

  private setQuery(q: string): void {
    if ((this.filter.q ?? '') === q) return;
    this.filter = { ...this.filter, q };
    this.afterFilter(false);
  }

  private afterFilter(sound = true): void {
    if (sound) sfx.play('uiClick', { volume: 0.5, pitch: 1.1 });
    const keep = this.list[this.cursor];
    this.scrollRow = 0;
    this.refreshList(keep);
    this.ensureVisible();
    this.renderAll();
    this.showDetail();
    this.slideGrid(1);
  }

  private toggleSort(on = !this.sortOpen): void {
    this.sortOpen = on;
    this.sortMenu.forEach((b, i) => b.setVisible(on).setStyle(SORT_KEYS[i] === this.sort ? 'gold' : 'neutral'));
    if (on) sfx.play('uiClick', { volume: 0.4 });
  }

  /** A click anywhere else closes the sort menu and ends the search / name typing. */
  private globalDown(p: Phaser.Input.Pointer): void {
    if (this.sortOpen) {
      const sx = this.sortBtn.x;
      const inMenu = p.x >= sx && p.x < sx + this.sortBtn.w && p.y >= TB2_Y && p.y < TB2_Y + 15 + SORT_KEYS.length * 15;
      if (!inMenu) this.toggleSort(false);
    }
    if (this.zone === 'search') {
      const inField = p.x >= GRID_X - 1 && p.x < GRID_X - 1 + SEARCH_W && p.y >= TB1_Y && p.y < TB1_Y + 14;
      if (!inField) this.focusSearch(false);
    }
    if (this.editing) {
      const inName = p.x >= NAME_X && p.x < NAME_X + NAME_W && p.y >= NAME_Y && p.y < NAME_Y + NAME_H;
      if (!inName) this.setEditing(false);
    }
  }

  private focusSearch(on: boolean): void {
    if (this.editing) this.setEditing(false);
    if (on) {
      if (this.zone === 'search') return;
      this.zone = 'search';
      this.caretT = 0;
      sfx.play('uiClick', { volume: 0.4 });
      this.say('Type to search · ENTER: to the cards · ESC: clear', 'info');
    } else {
      if (this.zone !== 'search') return;
      this.zone = 'pool';
    }
    this.renderSearch();
    this.renderFocus();
  }

  private typeSearch(e: KeyboardEvent): boolean {
    const q = this.filter.q ?? '';
    if (e.key === 'Escape') {
      if (q) this.setQuery('');
      else this.focusSearch(false);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'Tab') {
      this.focusSearch(false);
      return true;
    }
    if (e.key === 'Backspace') {
      this.setQuery(q.slice(0, -1));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[A-Za-z0-9 '\-.,!çğıöşüÇĞİÖŞÜ]/.test(e.key)) {
      if (q.length < 18) this.setQuery(q + e.key);
    } else return e.key.length === 1;
    this.caretT = 0;
    this.renderSearch();
    return true;
  }

  private selectSlot(i: number): void {
    if (this.editing) this.setEditing(false);
    if (i === this.slot) return;
    this.slot = i;
    this.presetIdx = -1;
    this.deckCursor = 0;
    this.deckScroll = 0;
    this.hoverFlat = -1;
    if (this.zone === 'deck' && !this.cur.cards.length) this.zone = 'pool';
    sfx.play('uiClick', { volume: 0.55, pitch: 1.05 });
    this.renderAll();
    this.showDetail();
    this.say(`Slot ${i + 1}: ${this.store.slot(i) ? this.cur.name : 'empty slot'}`, 'info');
  }

  private setFocus(zone: Zone, index: number, sound: boolean): void {
    if (this.zone === 'search') this.focusSearch(false);
    const changed = this.zone !== zone || this.cursor !== index;
    this.zone = zone;
    if (zone === 'pool') this.cursor = index;
    if (!changed) return;
    if (this.hoverFlat >= 0) {
      this.hoverFlat = -1;
      this.renderDeckList();
    }
    if (sound) this.hoverSound();
    this.renderFocus();
    this.showDetail();
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
    this.scrollRow = Math.max(0, Math.min(this.maxRow(), this.scrollRow));
  }

  private wheel(dy: number, x = 0): void {
    if (!this.ready || this.editing || this.helpOpen || !dy) return;
    if (x >= DK_X) this.scrollDeck(dy > 0 ? 1 : -1);
    else if (x < DET_X) this.scrollBy(dy > 0 ? 1 : -1);
    else this.scrollDetail(dy);
  }

  private scrollDeck(lines: number): void {
    const max = maxLineScroll(this.lines(), LIST_H, this.metrics);
    const next = Math.max(0, Math.min(max, this.deckScroll + lines));
    if (next === this.deckScroll) return;
    this.deckScroll = next;
    this.hoverFlat = -1;
    this.renderDeckList();
  }

  private ensureDeckVisible(): void {
    this.deckScroll = scrollToEntry(this.lines(), this.deckScroll, this.deckCursor, LIST_H, this.metrics);
  }

  private scrollBy(rows: number): void {
    const next = Math.max(0, Math.min(this.maxRow(), this.scrollRow + rows));
    if (next === this.scrollRow) return;
    const dir = next > this.scrollRow ? 1 : -1;
    this.scrollRow = next;
    const lo = this.scrollRow * COLS;
    const hi = (this.scrollRow + ROWS) * COLS - 1;
    if (this.zone === 'pool') this.cursor = Math.max(lo, Math.min(Math.min(hi, this.list.length - 1), this.cursor));
    this.renderGrid();
    this.renderFocus();
    this.showDetail();
    this.slideGrid(dir);
  }

  private dragTrack(p: Phaser.Input.Pointer): void {
    const maxRow = this.maxRow();
    if (!maxRow) return;
    const t = Math.max(0, Math.min(1, (p.y - GRID_Y) / (ROWS * PITCH_Y)));
    const next = Math.round(t * maxRow);
    if (next !== this.scrollRow) this.scrollBy(next - this.scrollRow);
  }

  // ---------------------------------------------------------------- deck edits

  private inDeck(id: CardId): boolean {
    return this.cur.cards.includes(id);
  }

  private copies(id: CardId): number {
    return copiesOf(this.cur.cards, id);
  }

  private countLabel(): string {
    return `${this.cur.cards.length}/${this.cur.cards.length <= DECK_MIN ? DECK_MIN : DECK_MAX}`;
  }

  /** Where entry `id` sits on screen now (null: scrolled away / not in the deck). */
  private entryCentre(id: CardId): Pt | null {
    const th = this.thumbs.find((t) => t.entry?.id === id);
    return th ? this.thumbCentre(th) : null;
  }

  private addCard(id: CardId | null, fromIndex = this.cursor): void {
    if (!id) return;
    const cell = fromIndex >= 0 ? this.cells.find((k) => k.index === fromIndex) : undefined;
    const why = addBlocker(this.cur.cards, id);
    if (why) {
      sfx.play('uiError', { volume: 0.55 });
      this.say(why, 'bad');
      this.shakeCell(fromIndex);
      this.fx.blocked(id, cell ? this.cellCentre(cell) : this.entryCentre(id));
      return;
    }
    this.cur.cards.push(id);
    sfx.play('uiClick', { volume: 0.7, pitch: 1.25 });
    const flat = this.entries().findIndex((e) => e.id === id);
    // keep the entry we touched on screen
    if (this.zone === 'deck') this.deckCursor = flat;
    this.deckScroll = scrollToEntry(this.lines(), this.deckScroll, flat, LIST_H, this.metrics);
    this.afterEdit();
    this.fx.added(id, cell ? this.cellCentre(cell) : null, this.entryCentre(id));
    this.say(`${CARDS[id].name} added (x${this.copies(id)}) · ${this.countLabel()}`, 'ok');
  }

  private removeCard(id: CardId, at: Pt | null = null): void {
    const i = this.cur.cards.lastIndexOf(id);
    if (i < 0) return;
    this.cur.cards.splice(i, 1);
    sfx.play('uiClick', { volume: 0.6, pitch: 0.8 });
    this.afterEdit();
    this.fx.removed(id, at);
    const left = this.copies(id);
    this.say(`${CARDS[id].name} removed${left ? ` (x${left} left)` : ''} · ${this.countLabel()}`, 'info');
  }

  private afterEdit(): void {
    const n = this.entries().length;
    this.deckCursor = Math.max(0, Math.min(n - 1, this.deckCursor));
    if (!n) {
      this.deckScroll = 0;
      this.hoverFlat = -1;
      if (this.zone === 'deck') this.zone = 'pool';
    }
    if (this.hoverFlat >= n) this.hoverFlat = -1;
    this.deckScroll = Math.max(0, Math.min(maxLineScroll(this.lines(), LIST_H, this.metrics), this.deckScroll));
    this.renderGrid();
    this.renderDeck();
    this.renderFocus();
    this.showDetail();
  }

  private save(): void {
    if (this.editing) this.setEditing(false);
    const d = this.cur;
    this.store.setSlot(this.slot, { name: d.name, cards: d.cards });
    this.store.setLast('edit', slotRef(this.slot));
    d.savedKey = keyOf(this.store.slot(this.slot)!.name, d.cards);
    d.missing = 0;
    d.replaced = 0;
    d.name = this.store.slot(this.slot)!.name;
    sfx.play('uiConfirm', { volume: 0.7 });
    this.renderDeck();
    this.pulse(this.nameText);
    this.fx.saved();
    const v = validateDeck(d.cards);
    const where = this.store.persisted ? '' : ' (this session only)';
    this.say(v.ok ? `Saved to slot ${this.slot + 1} · ready to duel${where}` : `Saved to slot ${this.slot + 1} · draft, not playable yet${where}`, v.ok ? 'ok' : 'gold');
  }

  private randomFill(): void {
    if (this.editing) this.setEditing(false);
    const before = this.cur.cards.length;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    this.cur.cards = autoFillDeck(this.cur.cards, seed, undefined, Math.max(DECK_MIN, this.cur.cards.length));
    sfx.play('uiConfirm', { volume: 0.55, pitch: 1.2 });
    this.afterEdit();
    this.fx.bulk('auto');
    const added = this.cur.cards.length - before;
    this.say(added > 0 ? `${added} card${added === 1 ? '' : 's'} added · ${this.countLabel()}` : this.cur.cards.length >= DECK_MIN ? 'The deck is already full' : 'No legal card left to add', added > 0 ? 'ok' : 'bad');
  }

  private nextPreset(): void {
    if (this.editing) this.setEditing(false);
    const list = presetDecks();
    this.presetIdx = (this.presetIdx + 1) % list.length;
    const p = list[this.presetIdx];
    this.cur.cards = [...p.cards];
    this.cur.name = p.name.slice(0, NAME_MAX);
    this.deckScroll = 0;
    sfx.play('uiConfirm', { volume: 0.55, pitch: 1.1 });
    this.afterEdit();
    this.fx.bulk('preset');
    this.say(`${p.name}: ${p.blurb}`, 'gold');
  }

  private resetClassic(): void {
    if (this.editing) this.setEditing(false);
    this.cur.cards = classicDeck();
    this.cur.name = 'Classic Deck';
    this.presetIdx = -1;
    this.deckScroll = 0;
    sfx.play('uiConfirm', { volume: 0.5, pitch: 0.95 });
    this.afterEdit();
    this.fx.bulk('classic');
    this.say('Classic deck: the first 20 cards, two copies each (40).', 'info');
  }

  private clearDeck(): void {
    if (this.editing) this.setEditing(false);
    if (!this.cur.cards.length) return;
    this.cur.cards = [];
    sfx.play('uiBack', { volume: 0.6 });
    this.afterEdit();
    this.fx.bulk('clear');
    this.say('Deck cleared.', 'info');
  }

  // ---------------------------------------------------------------- name editing

  private setEditing(on: boolean): void {
    if (on === this.editing) return;
    if (on && this.zone === 'search') this.focusSearch(false);
    this.editing = on;
    this.nameFresh = on;
    this.caretT = 0;
    sfx.play(on ? 'uiClick' : 'uiConfirm', { volume: 0.45 });
    if (!on) this.cur.name = this.cur.name.trim() || `Deck ${this.slot + 1}`;
    this.renderDeck();
    this.say(on ? 'Type a name, ENTER to finish' : 'Name updated', 'info');
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
    if (this.zone === 'search') return this.typeSearch(e);
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (this.helpOpen) {
      if (e.key === '?' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'F1') this.setHelp(false);
      return true;
    }
    if (e.key === '?' || e.code === 'F1') {
      this.setHelp(true);
      return true;
    }
    if (this.sortOpen && e.code === 'Escape') {
      this.toggleSort(false);
      return true;
    }
    const code = e.code;
    const deckId = () => this.entries()[this.deckCursor]?.id;
    const dir = (dx: number, dy: number) => {
      if (this.zone === 'pool') {
        if (dx > 0 && this.cursor % COLS === COLS - 1 && this.cur.cards.length) return this.switchZone('deck');
        if (dy < 0 && this.cursor < COLS) return this.focusSearch(true);
        const n = gridMove(this.cursor, dx, dy, COLS, this.list.length);
        if (n >= 0) this.moveCursor(n);
      } else {
        const lines = this.lines();
        const li = lineOfEntry(lines, this.deckCursor);
        const row = lines[li];
        if (dx < 0 && row?.kind === 'row' && this.deckCursor === row.start) return this.switchZone('pool');
        const n = entryMove(lines, this.deckCursor, dx, dy);
        if (n >= 0 && n !== this.deckCursor) {
          this.deckCursor = n;
          this.hoverFlat = -1;
          this.ensureDeckVisible();
          this.renderDeckList();
          this.renderFocus();
          this.showDetail();
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
        if (this.zone === 'pool') this.addCard(this.list[this.cursor] ?? null, this.cursor);
        else {
          const id = deckId();
          if (id) this.removeCard(id, this.entryCentre(id));
        }
        return true;
      case 'Delete':
      case 'Backspace':
      case 'Minus':
      case 'NumpadSubtract': {
        const id = this.zone === 'pool' ? this.list[this.cursor] : deckId();
        if (id && this.inDeck(id)) this.removeCard(id, this.entryCentre(id));
        return true;
      }
      case 'Equal':
      case 'NumpadAdd': {
        const id = this.zone === 'pool' ? this.list[this.cursor] : deckId();
        if (id) this.addCard(id, this.zone === 'pool' ? this.cursor : -1);
        return true;
      }
      case 'Slash':
        this.focusSearch(true);
        return true;
      case 'Tab':
        this.switchZone(this.zone === 'pool' ? 'deck' : 'pool');
        return true;
      case 'PageDown':
        if (this.zone === 'deck') this.scrollDeck(3);
        else this.scrollBy(ROWS - 1);
        return true;
      case 'PageUp':
        if (this.zone === 'deck') this.scrollDeck(-3);
        else this.scrollBy(-(ROWS - 1));
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
      case 'KeyS':
      case 'KeyK':
        this.save();
        return true;
      case 'KeyR':
        this.randomFill();
        return true;
      case 'KeyP':
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
    if (this.zone !== 'pool') this.zone = 'pool';
    if (n === this.cursor || n < 0) {
      this.renderFocus();
      return;
    }
    this.cursor = n;
    this.hoverSound();
    const before = this.scrollRow;
    this.ensureVisible();
    if (before !== this.scrollRow) {
      this.renderGrid();
      this.slideGrid(this.scrollRow > before ? 1 : -1);
    }
    this.renderFocus();
    this.showDetail();
  }

  private switchZone(z: Zone): void {
    if (z === 'deck' && !this.cur.cards.length) {
      sfx.play('uiError', { volume: 0.35 });
      this.say('The deck is empty: add a card first', 'bad');
      return;
    }
    this.zone = z;
    this.hoverFlat = -1;
    this.deckCursor = Math.max(0, Math.min(this.entries().length - 1, this.deckCursor));
    this.ensureDeckVisible();
    this.renderDeckList();
    this.hoverSound();
    this.renderFocus();
    this.showDetail();
  }

  // ================================================================ rendering

  private renderAll(): void {
    this.renderChips();
    this.renderSearch();
    this.renderGrid();
    this.renderDeck();
    this.renderFocus();
  }

  private renderChips(): void {
    KINDS.forEach((k, i) => this.kindBtns[i].setStyle(this.filter.kind === k ? 'gold' : 'neutral'));
    ELEMENTS.forEach((a, i) => this.attrBtns[i].setStyle(this.filter.attr === a ? 'gold' : 'neutral'));
    this.sortBtn.setLabel(`Sort: ${SORT_LABEL[this.sort]}`);
    this.sortMenu.forEach((b, i) => b.setStyle(SORT_KEYS[i] === this.sort ? 'gold' : 'neutral'));
  }

  private renderSearch(): void {
    const q = this.filter.q ?? '';
    const on = this.zone === 'search';
    this.searchField.setTexture(panelV3(this, on ? 'p1' : 'neutral', SEARCH_W, 14, 0, on ? 2 : 0));
    const shown = q ? fitText(q, SEARCH_W - 30, (s) => measureText(s, 'sm').w) : on ? '' : 'Search...';
    this.searchText.setText(shown).setTint(q ? PAL.white : PAL.steel);
    this.searchClear.setVisible(!!q);
    this.updateCaret();
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
        cell.card.setTexture(miniCardTex(this, id));
        this.paintCount(cell);
      }
    const rowsTotal = Math.ceil(total / COLS);
    const need = rowsTotal > ROWS;
    this.track.setVisible(need);
    this.thumbBar.setVisible(need);
    if (need) {
      const h = this.track.height;
      const th = Math.max(12, Math.round((h * ROWS) / rowsTotal));
      this.thumbBar.setSize(3, th).setPosition(this.track.x, GRID_Y + Math.round(((h - th) * this.scrollRow) / this.maxRow()));
    }
    this.poolCount.setText(String(total));
  }

  /** Badge "n/max", veil + lock at the limit, rule mark. */
  private paintCount(cell: Cell): void {
    const id = cell.id;
    if (!id) return;
    const n = this.copies(id);
    const max = maxCopies(id);
    const full = n >= max;
    cell.veil.setVisible(full);
    cell.lock.setVisible(full);
    const mark = markTexOf(this, id);
    cell.mark.setVisible(!!mark && !full);
    if (mark) cell.mark.setTexture(mark);
    const s = `${n}/${max}`;
    const w = Math.ceil(measureText(s, 'sm').w) + 3;
    const bx = Math.round((MINI_W - w) / 2);
    cell.badgeBg.setPosition(bx, 26).setSize(w, 10).setFillStyle(full ? PAL.gold0 : PAL.ink);
    cell.badge.setText(s).setPosition(bx + 1, 25).setTint(full ? PAL.gold4 : n ? PAL.cyan4 : PAL.mist);
  }

  /** Focus ring, lift and light (cheap; called while the mouse sweeps). */
  private renderFocus(): void {
    let focused: Cell | null = null;
    for (const cell of this.cells) {
      if (!cell.id) continue;
      const on = this.zone === 'pool' && cell.index === this.cursor;
      cell.box.y = on ? cell.y - 2 : cell.y;
      cell.box.setDepth(on ? 10 : 8);
      if (on) focused = cell;
    }
    this.hoverRing.setVisible(!!focused);
    this.hoverGlow.setVisible(!!focused && !REDUCED_MOTION);
    if (focused) {
      this.hoverRing.setPosition(focused.x - 2, focused.y - 4);
      this.hoverGlow.setPosition(focused.x + MINI_W / 2, focused.y + MINI_H / 2 + 4);
    }
    for (const th of this.thumbs) th.ring.setVisible(!!th.entry && this.zone === 'deck' && th.flat === this.deckCursor);
  }

  private renderDeck(): void {
    const d = this.cur;
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
    const shown = fitText(d.name, NAME_W - 30, (s) => measureText(s, 'sm').w);
    this.nameText.setText(shown + (dirty && !this.editing ? ' *' : ''));
    this.nameText.setTint(this.editing ? (this.nameFresh ? PAL.white : PAL.gold4) : PAL.white);
    this.nameField.setTexture(panelV3(this, this.editing ? 'monster' : 'neutral', NAME_W, NAME_H, 0, this.editing ? 2 : 0));
    this.updateCaret();
    // header
    const v = validateDeck(d.cards);
    const n = d.cards.length;
    this.deckTitle.setText(`DECK ${this.slot + 1} · ${n} / ${n <= DECK_MIN ? DECK_MIN : DECK_MAX}`).setTint(v.ok ? PAL.gold3 : PAL.white);
    this.deckState.setText(n === 0 ? 'EMPTY' : v.ok ? 'READY' : 'DRAFT').setTint(v.ok ? PAL.gold3 : PAL.steel);
    this.deckOk.setVisible(v.ok).setX(this.deckState.x - Math.ceil(measureText('READY', 'sm').w) - 12);
    this.renderMeters();
    this.renderDeckList();
    this.renderFooter();
  }

  private renderDeckList(): void {
    const lines = this.lines();
    const m = this.metrics;
    const max = maxLineScroll(lines, LIST_H, m);
    this.deckScroll = Math.max(0, Math.min(max, this.deckScroll));
    const vis = visibleLines(lines, this.deckScroll, LIST_H, m);
    this.deckEmpty.setVisible(!lines.length);
    let hi = 0;
    let ti = 0;
    const grid = this.view === 'grid';
    for (const { line, y: ly } of vis) {
      const y = LIST_Y + ly;
      if (line.kind === 'head') {
        const h = this.heads[hi++];
        const R = KIND_RAMP[line.section];
        h.icon.setPosition(LIST_X, y + 2).setTint(R[3]).setVisible(true);
        h.label.setText(SECTION_LABEL[line.section]).setPosition(LIST_X + 10, y).setTint(R[3]).setVisible(true);
        const lw = Math.ceil(measureText(SECTION_LABEL[line.section], 'sm').w);
        h.count.setText(String(line.copies)).setPosition(LIST_X + LIST_W, y).setVisible(true);
        h.rule.setPosition(LIST_X + 14 + lw, y + 6).setSize(Math.max(1, LIST_W - lw - 32), 1).setFillStyle(R[0]).setVisible(true);
        continue;
      }
      line.entries.forEach((e, k) => {
        const th = this.thumbs[ti++];
        if (!th) return;
        const x = grid ? LIST_X + k * THUMB_PITCH : LIST_X;
        this.bindThumb(th, e, line.start + k, x, y);
      });
    }
    for (; hi < this.heads.length; hi++) {
      const h = this.heads[hi];
      for (const o of [h.icon, h.label, h.count, h.rule]) o.setVisible(false);
    }
    for (; ti < this.thumbs.length; ti++) this.bindThumb(this.thumbs[ti], null, -1, 0, 0);
    // scrollbar
    this.dTrack.setVisible(max > 0);
    this.dThumb.setVisible(max > 0);
    if (max > 0) {
      const th = Math.max(12, Math.round((LIST_H * vis.length) / lines.length));
      this.dThumb.setSize(3, th).setPosition(this.dTrack.x, LIST_Y + Math.round(((LIST_H - th) * this.deckScroll) / max));
    }
    this.renderFocus();
  }

  private bindThumb(th: Thumb, e: DeckEntry | null, flat: number, x: number, y: number): void {
    th.entry = e;
    th.flat = flat;
    th.x = x;
    th.y = y;
    th.box.setVisible(!!e);
    if (th.zone.input) th.zone.input.enabled = !!e;
    const hover = !!e && flat === this.hoverFlat;
    for (const b of [th.minus, th.plus]) {
      b.box.setVisible(hover);
      if (b.zone.input) b.zone.input.enabled = hover;
    }
    if (!e) return;
    const grid = this.view === 'grid';
    const max = maxCopies(e.id);
    th.box.setPosition(x, y);
    th.img.setTexture(grid ? deckThumbTex(this, e.id) : stripArtTex(this, e.id));
    th.ring.setTexture(grid ? ringTex(this, THUMB_W, THUMB_H) : ringTex(this, LIST_W, STRIP_ART_H));
    const s = `x${e.n}`;
    const w = Math.ceil(measureText(s, 'sm').w) + 3;
    if (grid) {
      th.zone.setPosition(x, y).setSize(THUMB_W, THUMB_H);
      th.badgeBg.setPosition(THUMB_W - w - 1, THUMB_H - 11).setSize(w, 10).setFillStyle(PAL.ink);
      th.badge.setText(s).setPosition(THUMB_W - w, THUMB_H - 12);
      th.name.setVisible(false);
      th.minus.box.setPosition(x + 1, y + 1);
      th.plus.box.setPosition(x + THUMB_W - 12, y + 1);
    } else {
      th.zone.setPosition(x, y).setSize(LIST_W, STRIP_ART_H);
      th.badgeBg.setPosition(LIST_W - w - 26, 3).setSize(w, 10).setFillStyle(PAL.ink);
      th.badge.setText(s).setPosition(LIST_W - w - 25, 2);
      th.name.setText(fitText(CARDS[e.id].name, LIST_W - STRIP_ART_W - 60, (q) => measureText(q, 'sm').w)).setVisible(true).setTint(hover ? PAL.white : PAL.mist);
      th.minus.box.setPosition(x + LIST_W - 24, y + 3);
      th.plus.box.setPosition(x + LIST_W - 12, y + 3);
    }
    th.badge.setTint(e.n >= max ? PAL.gold3 : PAL.white);
    th.minus.zone.setPosition(th.minus.box.x, th.minus.box.y);
    th.plus.zone.setPosition(th.plus.box.x, th.plus.box.y);
    const blocked = addBlocker(this.cur.cards, e.id) !== null;
    th.plus.bg.setFillStyle(blocked ? PAL.night2 : PAL.cyan1);
    th.plus.label.setTint(blocked ? PAL.night4 : PAL.white);
  }

  private renderFooter(): void {
    const n = this.cur.cards.length;
    // the stack: one card back per ~3 cards, on a soft light pool
    const layers = n ? Math.min(this.stack.length, 1 + Math.round((n / DECK_MAX) * (this.stack.length - 1))) : 0;
    this.stack.forEach((img, i) => img.setVisible(i < layers).setPosition(DK_X + 44, STACK_BASE - Math.round(i * 1.5)));
    this.stackPool.setAlpha(n ? 0.45 : 0.2);
    this.stackLabel.setText(n ? `${n} card${n === 1 ? '' : 's'}` : 'no cards').setTint(n ? PAL.mist : PAL.steel);
    const st = deckStats(this.cur.cards);
    const maxN = Math.max(4, ...st.curve);
    const bb = FOOT_Y + 62;
    st.curve.forEach((v, b) => {
      const h = v ? Math.max(2, Math.round((v / maxN) * 40)) : 0;
      const high = b + 1 >= DECK_HIGH_LEVEL;
      this.curveBars[b].setSize(12, Math.max(1, h)).setVisible(h > 0).setFillStyle(high ? PAL.fire2 : PAL.cyan2);
      this.curveTops[b].setPosition(this.curveBars[b].x, bb - h).setVisible(h > 0).setFillStyle(high ? PAL.fire4 : PAL.cyan4);
      this.curveVals[b].setText(v ? String(v) : '').setY(bb - h - 1);
      this.curveNums[b].setTint(v ? (high ? PAL.fire3 : PAL.mist) : PAL.night4);
    });
  }

  private currentCard(): CardId | null {
    if (this.zone === 'deck') return this.entries()[this.deckCursor]?.id ?? null;
    return this.list[this.cursor] ?? null;
  }

  private say(text: string, tone: Tone): void {
    this.footMsg.setText(fitText(text, MSG_W, (s) => measureText(s, 'sm').w)).setTint(TONE[tone]);
  }

  // ---------------------------------------------------------------- small motion

  private slideGrid(dir: number): void {
    if (REDUCED_MOTION) return;
    for (const c of this.cells) {
      if (!c.id) continue;
      const to = c.box.y;
      c.box.y = to + dir * 4;
      this.tweens.add({ targets: c.box, y: to, duration: 100, ease: 'Quad.Out' });
    }
  }

  private shakeCell(index: number): void {
    if (REDUCED_MOTION) return;
    const c = this.cells.find((k) => k.index === index);
    if (!c) return;
    this.tweens.add({ targets: c.box, x: { from: c.x - 2, to: c.x }, duration: 140, ease: 'Bounce.Out' });
  }

  private pulse(o: Phaser.GameObjects.BitmapText): void {
    if (REDUCED_MOTION) return;
    o.setTint(PAL.gold4);
    void wait(this, 120).then(() => this.renderDeck());
  }

  private updateCaret(): void {
    const blink = REDUCED_MOTION || this.caretT % 900 < 560;
    const w = Math.ceil(measureText(this.cur.name, 'sm').w);
    this.nameCaret.setPosition(NAME_X + 6 + w + 1, NAME_Y + 4).setVisible(this.editing && blink);
    const q = this.filter.q ?? '';
    const qw = q ? Math.ceil(measureText(this.searchText.text, 'sm').w) : 0;
    this.searchCaret.setPosition(GRID_X + 14 + qw + 1, TB1_Y + 3).setVisible(this.zone === 'search' && blink);
  }

  private tick(dt: number): void {
    this.t += dt;
    if (this.editing || this.zone === 'search') {
      this.caretT += dt;
      this.updateCaret();
    }
    if (REDUCED_MOTION) return;
    this.lattice.tilePositionX = Math.floor(this.t / 140);
    this.lattice.tilePositionY = Math.floor(this.t / 280);
    for (const m of this.motes) {
      const y = (m.y - (this.t / 1000) * m.v + GAME_H * 4) % GAME_H;
      m.img.setPosition(Math.round(m.x + Math.sin(this.t / 1400 + m.ph) * 3), Math.round(y));
      m.img.setTint([PAL.night3, PAL.night4, PAL.steel][Math.floor((0.5 + 0.5 * Math.sin(this.t / 700 + m.ph)) * 2.99)]);
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
      this.say('Unsaved changes. Press ESC / BACK again to leave.', 'gold');
      return;
    }
    if (this.data0.dev) {
      this.say('Preview: exit disabled', 'info');
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
  get qaState(): {
    slot: number;
    cards: CardId[];
    name: string;
    list: number;
    cursor: number;
    zone: Zone;
    legal: boolean;
    scrollRow: number;
    deckScroll: number;
    entries: DeckEntry[];
    query: string;
    help: boolean;
    view: ListView;
  } {
    return {
      slot: this.slot,
      cards: [...this.cur.cards],
      name: this.cur.name,
      list: this.list.length,
      cursor: this.cursor,
      zone: this.zone,
      legal: validateDeck(this.cur.cards).ok,
      scrollRow: this.scrollRow,
      deckScroll: this.deckScroll,
      entries: this.entries(),
      query: this.filter.q ?? '',
      help: this.helpOpen,
      view: this.view,
    };
  }

  qaKey(code: string, key = code, shiftKey = false): boolean {
    return this.onKey({ code, key, repeat: false, shiftKey, ctrlKey: false, metaKey: false, altKey: false, preventDefault() {} } as unknown as KeyboardEvent);
  }

  /** QA: types `text` into whatever has the keyboard (search / name). */
  qaType(text: string): void {
    for (const ch of text) this.qaKey(ch === ' ' ? 'Space' : `Key${ch.toUpperCase()}`, ch);
  }

  /** QA: centres in game pixels, for real-mouse tools. */
  qaLayout(): {
    cells: { index: number; id: CardId; x: number; y: number }[];
    entries: { flat: number; id: CardId; x: number; y: number; minusX: number; plusX: number; stepY: number }[];
    buttons: Record<string, { x: number; y: number }>;
  } {
    const cells = this.cells.filter((c) => c.id).map((c) => ({ index: c.index, id: c.id as CardId, ...this.cellCentre(c) }));
    const entries = this.thumbs.filter((t) => t.entry).map((t) => ({ flat: t.flat, id: t.entry!.id, ...this.thumbCentre(t), minusX: t.minus.box.x + 5, plusX: t.plus.box.x + 5, stepY: t.minus.box.y + 5 }));
    const buttons: Record<string, { x: number; y: number }> = {};
    const at = (b: Button) => ({ x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) });
    buttons.kaydet = at(this.actionBtns.save);
    buttons.rastgele = at(this.actionBtns.auto);
    buttons.hazir = at(this.actionBtns.preset);
    buttons.sifirla = at(this.actionBtns.classic);
    buttons.temizle = at(this.actionBtns.clear);
    buttons.help = at(this.actionBtns.help);
    buttons.geri = at(this.actionBtns.back);
    buttons.adver = { x: NAME_X + NAME_W / 2, y: NAME_Y + NAME_H / 2 };
    buttons.name = buttons.adver;
    buttons.search = { x: GRID_X + 40, y: TB1_Y + 7 };
    buttons.sort = at(this.sortBtn);
    this.slotBtns.forEach((b, i) => (buttons[`slot${i + 1}`] = at(b)));
    return { cells, entries, buttons };
  }

  /** QA: the colour of an element, to check chips. */
  static elementColor(a: Attribute): number {
    return ATTRIBUTE_COLOR[a];
  }
}
