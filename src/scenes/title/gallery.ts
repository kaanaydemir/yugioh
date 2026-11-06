// CARD GALLERY — every collectible card. A paged 5×4 thumbnail grid on the left (pager row with
// arrows, page pips and a count under it; ←→ walk across page edges, PgUp/PgDn or Q/E flip a page,
// the mouse wheel flips pages), the selected card's face at 2× in the middle, and a hologram stage on
// the right: monsters materialize at 2× and cycle through every animation (idle, roar, attack, hit,
// guard — or pick one with the chips); spells and traps float over a rune circle with their element
// effects. Card text below the pager, always clear of the grid.

import Phaser from 'phaser';
import { COLLECTIBLE_CARD_IDS, ATTRIBUTE_NAMES, CARDS, isMonster, tributesFor, type Attribute, type CardDef, type CardId, type MonsterId } from '../../data/cards';
import { ANIM_SHEEN, CARD_GLOW, CARD_SHEEN, cardArtKey, cardFaceKey } from '../../art/cards';
import { monsterArt } from '../../art/monsters';
import { ATTRIBUTE_RAMP, KIND_RAMP, PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas, mix } from '../../art/pixel';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { sfx, type SfxName } from '../../audio/sfx';
import { pixelText } from '../../ui/text';
import { unitDepth } from '../../view/layout';
import { haloTex, panelTex } from '../../view/ui-textures';
import { safe, tween, wait } from '../../vfx/core';
import { framePointToWorld, skyBolt } from '../../vfx/combat';
import { glitch, materialize, whiteFlash } from '../../vfx/hologram';
import { bubbles, droplets, dust, embers, glints, rocks, shadowWisps, sparkles } from '../../vfx/particles';
import { createMagicCircle, lightPillar, shockwave, sparkleBurst, type MagicCircleCtl } from '../../vfx/summon';
import { HEADER_H, OV_UI, Overlay, hitZone, keyHint } from './overlay';

const W = 624;
const H = 344;
const COLS = 5;
const CELL_W = 46;
const CELL_H = 36;
const GRID_X = 12;
const GRID_Y = HEADER_H + 9;
const GAP = 3;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;
const GRID_W = COLS * (CELL_W + GAP) - GAP;
const GRID_H = ROWS * (CELL_H + GAP) - GAP;
/** Pager row (panel-local): arrow chips at both ends, page pips in the middle. */
const PAGER_Y = GRID_Y + GRID_H + 5;
const PAGER_H = 13;
const ARROW_W = 20;
const PIP_W = 12;
const PIP_GAP = 3;
/** Stage centre (panel-local). */
const STAGE_X = 498;
const STAGE_Y = 262;

const ANIMS: { anim: MonsterAnim; label: string }[] = [
  { anim: 'idle', label: 'Idle' },
  { anim: 'roar', label: 'Roar' },
  { anim: 'attack', label: 'Attack' },
  { anim: 'hit', label: 'Hit' },
  { anim: 'guard', label: 'Guard' },
];

const AUTO: MonsterAnim[] = ['idle', 'roar', 'idle', 'attack', 'idle', 'hit', 'guard'];

const ATTR_SFX: Record<Attribute, SfxName> = {
  LIGHT: 'holyChime',
  DARK: 'darkPulse',
  FIRE: 'fireBurst',
  WATER: 'waterSplash',
  EARTH: 'earthQuake',
  WIND: 'windGust',
};

/** Header line: "12 MONSTERS · 5 SPELLS · 3 TRAPS", counted from the gallery's cards. */
function galleryCounts(ids: CardId[]): string {
  const n = (k: CardDef['kind']) => ids.filter((id) => CARDS[id].kind === k).length;
  const part = (c: number, one: string) => `${c} ${one}${c === 1 ? '' : 'S'}`;
  return [part(n('monster'), 'MONSTER'), part(n('spell'), 'SPELL'), part(n('trap'), 'TRAP')].join(' · ');
}

const SPELL_TYPE: Record<string, string> = { normal: 'Normal', equip: 'Equip', field: 'Field', continuous: 'Continuous', quick: 'Quick-Play' };

function kindRampOf(def: CardDef): Ramp {
  return KIND_RAMP[def.kind];
}

function stageRamp(def: CardDef): Ramp {
  return isMonster(def) ? ATTRIBUTE_RAMP[def.attribute] : kindRampOf(def);
}

/** 48×38 thumbnail frame in a kind ramp (sel = bright). */
function thumbFrame(scene: Phaser.Scene, kind: CardDef['kind'], sel: boolean): string {
  const key = `title:thumb:${kind}:${sel ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const R = KIND_RAMP[kind];
  const w = CELL_W + 2;
  const h = CELL_H + 2;
  const p = new PixelCanvas(w, h);
  p.rect(0, 0, w, h, PAL.ink);
  p.frame(1, 1, w - 2, h - 2, sel ? R[4] : R[1]);
  p.hline(2, w - 3, 1, sel ? PAL.white : R[2]);
  p.vline(1, 2, h - 3, sel ? PAL.white : R[2]);
  p.rect(2, 2, w - 4, h - 4, PAL.night0);
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

/** 5×7 pager chevron (dir 1 = right), ink outline baked in so it reads on the chip. */
function chevronTex(scene: Phaser.Scene, dir: 1 | -1, lit: boolean): string {
  const key = `title:chev:${dir}:${lit ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const rows = ['#....', '##...', '###..', '####.', '###..', '##...', '#....'];
  const p = new PixelCanvas(7, 9);
  const R = KIND_RAMP.trap;
  const at = (x: number) => (dir === 1 ? x : 4 - x);
  rows.forEach((r, y) => {
    for (let x = 0; x < 5; x++) if (r[x] === '#') for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) p.set(1 + at(x) + dx, 1 + y + dy, PAL.ink);
  });
  rows.forEach((r, y) => {
    for (let x = 0; x < 5; x++) if (r[x] === '#') p.set(1 + at(x), 1 + y, y <= 2 ? (lit ? PAL.white : R[4]) : lit ? R[4] : R[3]);
  });
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

/** Iso pedestal for the stage (drawn 1×, shown 2×). */
function pedestalTex(scene: Phaser.Scene, R: Ramp): string {
  const key = `title:pedestal:${R[3].toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const hw = 38;
  const hh = 19;
  const depth = 5;
  const w = hw * 2 + 1;
  const h = hh * 2 + depth + 2;
  const p = new PixelCanvas(w, h);
  const inTop = (x: number, y: number) => Math.abs(x - hw) / hw + Math.abs(y - hh) / hh <= 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (inTop(x, y)) {
        const edge = !inTop(x - 1, y) || !inTop(x + 1, y) || !inTop(x, y - 1) || !inTop(x, y + 1);
        if (edge) p.set(x, y, y < hh ? R[3] : R[2]);
        else {
          const d = Math.abs(x - hw) / hw + Math.abs(y - hh) / hh;
          let c: number = PixelCanvas.ditherAt(x, y, Math.round((1 - d) * 10)) ? PAL.night2 : PAL.night1;
          if (d > 0.82 && d < 0.88) c = mix(R[1], PAL.night1, 0.4);
          if (Math.abs(d - 0.5) < 0.03 && (x + y) % 3 === 0) c = R[1];
          p.set(x, y, c);
        }
      } else {
        // side faces below the diamond's lower edges
        for (let k = 1; k <= depth; k++) {
          if (inTop(x, y - k) && y - k >= hh) {
            const left = x < hw;
            p.set(x, y, k === depth ? PAL.ink : left ? mix(R[0], PAL.night1, 0.4) : PAL.night0);
            if (k === 1) p.set(x, y, left ? R[1] : mix(R[1], PAL.night0, 0.4));
            break;
          }
        }
      }
    }
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

interface Thumb {
  id: CardId;
  /** Centred on the cell so a page flip can fold it on its vertical axis. */
  box: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Image;
  art: Phaser.GameObjects.Image;
  star: Phaser.GameObjects.BitmapText | null;
  /** Cell top-left (panel-local). */
  x: number;
  y: number;
}

interface PagerArrow {
  dir: 1 | -1;
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
}

interface AnimChip {
  anim: MonsterAnim;
  bg: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
}

export class GalleryOverlay extends Overlay {
  private sel = 0;
  private readonly ids: CardId[] = [...COLLECTIBLE_CARD_IDS];
  private readonly thumbs: Thumb[] = [];
  /** Page whose thumbnails are on screen (or flipping in). */
  private page = 0;
  private readonly pages: number;
  private pageGen = 0;
  private wheelAt = 0;
  private pagerArrows: PagerArrow[] = [];
  private pips: Phaser.GameObjects.Rectangle[] = [];
  private pipCursor!: Phaser.GameObjects.Rectangle;
  private pipCursorHi!: Phaser.GameObjects.Rectangle;
  private pageT!: Phaser.GameObjects.BitmapText;
  private rangeT!: Phaser.GameObjects.BitmapText;
  private sweep!: Phaser.GameObjects.Rectangle;
  private onWheel: ((p: Phaser.Input.Pointer, o: unknown, dx: number, dy: number) => void) | null = null;
  private selGlow!: Phaser.GameObjects.Image;
  private big!: Phaser.GameObjects.Image;
  private bigGlow!: Phaser.GameObjects.Image;
  private bigSheen!: Phaser.GameObjects.Sprite;
  private nameT!: Phaser.GameObjects.BitmapText;
  private tagT!: Phaser.GameObjects.BitmapText;
  private typeT!: Phaser.GameObjects.BitmapText;
  private starsT!: Phaser.GameObjects.BitmapText;
  private statsT!: Phaser.GameObjects.BitmapText;
  private ruleT!: Phaser.GameObjects.BitmapText;
  private textT!: Phaser.GameObjects.BitmapText;
  private chips: AnimChip[] = [];
  private animLabel!: Phaser.GameObjects.BitmapText;
  // world-space stage
  private pedestal!: Phaser.GameObjects.Image;
  private halo!: Phaser.GameObjects.Image;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private shadow: Phaser.GameObjects.Ellipse | null = null;
  private art: Phaser.GameObjects.Image | null = null;
  private artFrame: Phaser.GameObjects.Image | null = null;
  private circle: MagicCircleCtl | null = null;
  private fxTimer: Phaser.Time.TimerEvent | null = null;
  private bobTween: Phaser.Tweens.Tween | null = null;
  private gen = 0;
  private current: MonsterAnim = 'idle';
  private readonly initial: CardId | null;

  constructor(scene: Phaser.Scene, initial?: string) {
    super(scene, W, H, 'Card Gallery', 'trap');
    this.initial = initial && (COLLECTIBLE_CARD_IDS as string[]).includes(initial) ? (initial as CardId) : null;
    this.pages = Math.max(1, Math.ceil(this.ids.length / PER_PAGE));
  }

  private get sx(): number {
    return this.px + STAGE_X;
  }
  private get sy(): number {
    return this.py + STAGE_Y;
  }

  protected build(): void {
    const s = this.scene;
    const counts = pixelText(s, 146, Math.round(HEADER_H / 2), galleryCounts(this.ids), { size: 'sm', originY: 0.5, color: PAL.steel });
    this.root.add(counts);

    // ---- thumbnails
    this.selGlow = s.add
      .image(0, 0, haloTex(s, 12))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(CELL_W + 22, CELL_H + 22)
      .setAlpha(0.8);
    this.root.add(this.selGlow);
    this.ids.forEach((id, i) => {
      const def = CARDS[id];
      const slot = i % PER_PAGE;
      const x = GRID_X + (slot % COLS) * (CELL_W + GAP);
      const y = GRID_Y + Math.floor(slot / COLS) * (CELL_H + GAP);
      const box = s.add.container(x + CELL_W / 2, y + CELL_H / 2).setVisible(false);
      const frame = s.add.image(-CELL_W / 2 - 1, -CELL_H / 2 - 1, thumbFrame(s, def.kind, false)).setOrigin(0);
      const art = s.add.image(-CELL_W / 2 + 1, -CELL_H / 2 + 1, cardArtKey(id)).setOrigin(0);
      const star = isMonster(def) && def.ace ? pixelText(s, CELL_W / 2 - 3, -CELL_H / 2 + 3, '★', { size: 'sm', originX: 1, color: PAL.gold3 }) : null;
      box.add([frame, art]);
      if (star) box.add(star);
      this.root.add(box);
      this.thumbs.push({ id, box, frame, art, star, x, y });
    });
    // one hit zone per grid slot; it maps to whichever card the current page puts there
    for (let slot = 0; slot < PER_PAGE; slot++) {
      const x = GRID_X + (slot % COLS) * (CELL_W + GAP);
      const y = GRID_Y + Math.floor(slot / COLS) * (CELL_H + GAP);
      const zone = this.own(hitZone(s, this.px + x - 1, this.py + y - 1, CELL_W + 2, CELL_H + 2));
      const at = () => this.thumbs[this.page * PER_PAGE + slot] as Thumb | undefined;
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        const t = at();
        if (!t) return;
        if (this.page * PER_PAGE + slot !== this.sel) t.art.setTint(mix(PAL.white, PAL.gold4, 0.3));
        sfx.play('uiHover', { volume: 0.35 });
      });
      zone.on(Phaser.Input.Events.POINTER_OUT, () => at()?.art.clearTint());
      zone.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (at()) this.select(this.page * PER_PAGE + slot);
      });
    }
    // the bright line a page flip sweeps across the grid
    this.sweep = s.add.rectangle(0, GRID_Y - 2, 2, GRID_H + 4, KIND_RAMP.trap[4]).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.root.add(this.sweep);
    this.buildPager();
    const gridBottom = PAGER_Y + PAGER_H;

    // ---- info box
    const ix = GRID_X;
    const iy = gridBottom + 8;
    this.root.add(s.add.rectangle(ix, iy - 3, GRID_W, 1, PAL.night3).setOrigin(0));
    this.nameT = pixelText(s, ix, iy, '', { size: 'md', color: PAL.white });
    this.tagT = pixelText(s, ix + 242, iy, '', { size: 'sm', originX: 1, color: PAL.gold3 });
    this.typeT = pixelText(s, ix, iy + 15, '', { size: 'sm', color: PAL.mist });
    this.starsT = pixelText(s, ix + 242, iy + 15, '', { size: 'sm', originX: 1, color: PAL.gold3 });
    this.statsT = pixelText(s, ix, iy + 28, '', { size: 'md', color: PAL.gold4 });
    this.ruleT = pixelText(s, ix + 242, iy + 30, '', { size: 'sm', originX: 1, color: PAL.steel });
    this.textT = pixelText(s, ix, iy + 46, '', { size: 'sm', color: PAL.white, maxWidth: 242 });
    this.root.add([this.nameT, this.tagT, this.typeT, this.starsT, this.statsT, this.ruleT, this.textT]);

    // ---- big card (2×)
    const bx = 268 + 48;
    const by = GRID_Y + 70;
    this.bigGlow = s.add.image(bx, by, CARD_GLOW, 'g:0').setScale(2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
    this.big = s.add.image(bx, by, cardFaceKey(this.ids[0])).setScale(2);
    this.bigSheen = s.add.sprite(bx, by, CARD_SHEEN, 's:0').setScale(2).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.bigSheen.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.bigSheen.setVisible(false));
    this.root.add([this.bigGlow, this.big, this.bigSheen]);
    const bigZone = this.own(hitZone(s, this.px + bx - 48, this.py + by - 68, 96, 136));
    bigZone.on(Phaser.Input.Events.POINTER_DOWN, () => this.playSheen());

    // ---- keyboard hints under the big card
    this.root.add(keyHint(s, 0, 0, '←↑↓→', 'Card').setPosition(268, by + 82));
    this.root.add(keyHint(s, 0, 0, 'SPACE', 'Animation').setPosition(268, by + 98));
    this.root.add(keyHint(s, 0, 0, 'PGUP PGDN', 'Page').setPosition(268, by + 114));

    // ---- mouse wheel flips pages (one page per notch, gated while a flip is running)
    this.onWheel = (_p, _o, _dx, dy) => {
      if (!this.open_ || dy === 0) return;
      const now = this.scene.time.now;
      if (now - this.wheelAt < 220) return;
      this.wheelAt = now;
      this.flipPage(dy > 0 ? 1 : -1);
    };
    s.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);

    // ---- stage (world space; the title camera rests at scroll 0,0 while overlays are open)
    this.halo = this.own(
      s.add
        .image(this.sx, this.sy - 60, haloTex(s, 12))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(190, 190)
        .setAlpha(0.22)
        .setDepth(unitDepth(this.sy) - 3),
    );
    this.pedestal = this.own(
      s.add
        .image(this.sx, this.sy, pedestalTex(s, KIND_RAMP.monster))
        .setOrigin(0.5, 19 / (19 * 2 + 7))
        .setScale(2)
        .setDepth(unitDepth(this.sy) - 4),
    );

    // ---- animation chips
    const cw = 48;
    const cx0 = STAGE_X - 22 - Math.round((ANIMS.length * (cw + 3) - 3) / 2);
    const cy = H - 26;
    ANIMS.forEach((a, k) => {
      const x = cx0 + k * (cw + 3);
      const bg = s.add.image(x, cy, panelTex(s, 'neutral', cw, 16, { chamfer: 2 })).setOrigin(0);
      const label = pixelText(s, x + cw / 2, cy + 8, a.label.toUpperCase(), { size: 'sm', originX: 0.5, originY: 0.5, color: PAL.steel });
      this.root.add([bg, label]);
      const zone = this.own(hitZone(s, this.px + x, this.py + cy, cw, 16));
      zone.on(Phaser.Input.Events.POINTER_OVER, () => sfx.play('uiHover', { volume: 0.35 }));
      zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.manual(a.anim));
      this.chips.push({ anim: a.anim, bg, label, zone });
    });
    this.animLabel = pixelText(s, STAGE_X - 22, cy - 9, '', { size: 'sm', originX: 0.5, originY: 0.5, color: PAL.steel });
    this.root.add(this.animLabel);

    const start = Math.max(0, this.initial ? this.ids.indexOf(this.initial) : 0);
    this.sel = -1;
    this.showPage(Math.floor(start / PER_PAGE), 0, true);
    this.select(start, true);
  }

  // ------------------------------------------------------------ pages

  private buildPager(): void {
    const s = this.scene;
    const y = PAGER_Y;
    for (const dir of [-1, 1] as const) {
      const x = dir < 0 ? GRID_X : GRID_X + GRID_W - ARROW_W;
      const bg = s.add.image(x, y, panelTex(s, 'neutral', ARROW_W, PAGER_H, { chamfer: 2 })).setOrigin(0);
      const icon = s.add.image(x + ARROW_W / 2 - 3 + (dir < 0 ? -1 : 0), y + 2, chevronTex(s, dir, false)).setOrigin(0);
      this.root.add([bg, icon]);
      const zone = this.own(hitZone(s, this.px + x, this.py + y, ARROW_W, PAGER_H));
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (!this.canFlip(dir)) return;
        bg.setTexture(panelTex(s, 'trap', ARROW_W, PAGER_H, { chamfer: 2 }));
        icon.setTexture(chevronTex(s, dir, true));
        sfx.play('uiHover', { volume: 0.35 });
      });
      zone.on(Phaser.Input.Events.POINTER_OUT, () => this.paintPager());
      zone.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (!this.canFlip(dir)) return;
        // the chip presses in by a pixel
        icon.y = y + 3;
        void wait(s, 90).then(() => (icon.y = y + 2));
        this.flipPage(dir);
      });
      this.pagerArrows.push({ dir, bg, icon, zone });
    }
    const mid = GRID_X + GRID_W / 2;
    const cy = y + Math.round(PAGER_H / 2);
    this.pageT = pixelText(s, GRID_X + ARROW_W + 5, cy, '', { size: 'sm', originY: 0.5, color: PAL.mist });
    this.rangeT = pixelText(s, GRID_X + GRID_W - ARROW_W - 5, cy, '', { size: 'sm', originX: 1, originY: 0.5, color: PAL.steel });
    this.root.add([this.pageT, this.rangeT]);
    // page pips: a dim track per page plus a bright cursor that slides to the current one
    const pipsW = this.pages * (PIP_W + PIP_GAP) - PIP_GAP;
    const px0 = Math.round(mid - pipsW / 2);
    for (let k = 0; k < this.pages; k++) {
      const x = px0 + k * (PIP_W + PIP_GAP);
      const pip = s.add.rectangle(x, cy - 1, PIP_W, 3, PAL.night3).setOrigin(0);
      this.root.add(pip);
      this.pips.push(pip);
      const zone = this.own(hitZone(s, this.px + x - 1, this.py + y, PIP_W + 2, PAGER_H));
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (k !== this.page) pip.setFillStyle(PAL.steel);
        sfx.play('uiHover', { volume: 0.35 });
      });
      zone.on(Phaser.Input.Events.POINTER_OUT, () => this.paintPager());
      zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.gotoPage(k));
    }
    const R = KIND_RAMP.trap;
    this.pipCursor = s.add.rectangle(px0, cy - 2, PIP_W, 5, R[3]).setOrigin(0);
    this.pipCursorHi = s.add.rectangle(px0 + 1, cy - 2, PIP_W - 2, 1, PAL.white).setOrigin(0);
    this.root.add([this.pipCursor, this.pipCursorHi]);
  }

  private canFlip(dir: 1 | -1): boolean {
    const p = this.page + dir;
    return p >= 0 && p < this.pages;
  }

  /** Arrow chips dim at the ends, page text and range follow the current page. */
  private paintPager(): void {
    const s = this.scene;
    for (const a of this.pagerArrows) {
      const ok = this.canFlip(a.dir);
      a.bg.setTexture(panelTex(s, 'neutral', ARROW_W, PAGER_H, { chamfer: 2, dim: !ok }));
      a.icon.setTexture(chevronTex(s, a.dir, false)).setAlpha(ok ? 1 : 0.3);
      if (a.zone.input) a.zone.input.cursor = ok ? 'pointer' : 'default';
    }
    this.pips.forEach((p, k) => p.setFillStyle(k === this.page ? PAL.night4 : PAL.night3));
    this.pageT.setText(`PAGE ${this.page + 1}/${this.pages}`);
    const a = this.page * PER_PAGE + 1;
    const b = Math.min(this.ids.length, (this.page + 1) * PER_PAGE);
    this.rangeT.setText(`${a}-${b} OF ${this.ids.length}`);
  }

  /** Flip one page (keeps the selected slot, clamped to the last card). */
  private flipPage(dir: 1 | -1): void {
    if (!this.canFlip(dir)) {
      sfx.play('uiError', { volume: 0.3 });
      return;
    }
    this.gotoPage(this.page + dir);
  }

  private gotoPage(p: number): void {
    if (p === this.page || p < 0 || p >= this.pages) return;
    const slot = this.sel % PER_PAGE;
    this.select(Math.min(this.ids.length - 1, p * PER_PAGE + slot));
  }

  /**
   * Bring page `p` on screen. A flip folds the old page's cells shut column by column (in the
   * direction of travel), sweeps a bright line across the grid and unfolds the new page behind it.
   */
  private showPage(p: number, dir: number, instant = false): void {
    const s = this.scene;
    const old = this.page;
    this.page = p;
    const gen = ++this.pageGen;
    const onPage = (k: number) => Math.floor(k / PER_PAGE) === p;
    const wasOn = (k: number) => Math.floor(k / PER_PAGE) === old;
    this.paintPager();
    // the pip cursor slides to its pip
    const pipX = this.pips[p].x;
    s.tweens.killTweensOf([this.pipCursor, this.pipCursorHi]);
    if (instant) {
      this.pipCursor.x = pipX;
      this.pipCursorHi.x = pipX + 1;
    } else {
      const from = this.pipCursor.x;
      const pos = { t: 0 };
      s.tweens.add({
        targets: pos,
        t: 1,
        duration: 220,
        ease: 'Cubic.Out',
        onUpdate: () => {
          const x = Math.round(from + (pipX - from) * pos.t);
          this.pipCursor.x = x;
          this.pipCursorHi.x = x + 1;
        },
      });
    }
    for (const t of this.thumbs) s.tweens.killTweensOf(t.box);
    if (instant) {
      this.thumbs.forEach((t, k) => t.box.setVisible(onPage(k)).setScale(1));
      return;
    }
    sfx.play('cardSlide', { volume: 0.4, pitch: dir > 0 ? 1.2 : 1.05 });
    this.selGlow.setVisible(false);
    // column order in the direction of travel
    const order = (k: number) => {
      const c = (k % PER_PAGE) % COLS;
      const r = Math.floor((k % PER_PAGE) / COLS);
      return (dir > 0 ? c : COLS - 1 - c) + r * 0.5;
    };
    const STEP = 22;
    this.thumbs.forEach((t, k) => {
      if (wasOn(k) && t.box.visible) {
        s.tweens.add({ targets: t.box, scaleX: 0, duration: 70, delay: order(k) * STEP, ease: 'Quad.In', onComplete: () => t.box.setVisible(false).setScale(1) });
      } else if (onPage(k)) {
        t.box.setVisible(true).setScale(0, 1);
        s.tweens.add({
          targets: t.box,
          scaleX: 1,
          duration: 130,
          delay: 90 + order(k) * STEP,
          ease: 'Back.Out',
          onComplete: () => t.box.setScale(1),
        });
      } else t.box.setVisible(false).setScale(1);
    });
    // sweep line
    const x0 = dir > 0 ? GRID_X - 4 : GRID_X + GRID_W + 2;
    const x1 = dir > 0 ? GRID_X + GRID_W + 2 : GRID_X - 4;
    s.tweens.killTweensOf(this.sweep);
    this.sweep.setVisible(true).setAlpha(0.9);
    this.sweep.x = x0;
    const sw = { t: 0 };
    s.tweens.add({
      targets: sw,
      t: 1,
      duration: 90 + (COLS + 1) * STEP + 60,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this.sweep.x = Math.round(x0 + (x1 - x0) * sw.t);
        this.sweep.setAlpha(0.9 * Math.sin(Math.PI * sw.t) + 0.1);
      },
      onComplete: () => this.sweep.setVisible(false),
    });
    void wait(s, 90 + (COLS + 1.5) * STEP + 130).then(() => {
      if (gen !== this.pageGen || !this.open_) return;
      this.selGlow.setVisible(true).setAlpha(0);
      void tween(s, { targets: this.selGlow, alpha: 0.8, duration: 140 });
    });
  }

  // ------------------------------------------------------------ selection

  select(i: number, first = false): void {
    if (i === this.sel || i < 0 || i >= this.ids.length) return;
    const prev = this.sel;
    this.sel = i;
    const id = this.ids[i];
    const def = CARDS[id];
    const R = kindRampOf(def);
    if (!first) sfx.play('cardFlip', { volume: 0.55 });
    const page = Math.floor(i / PER_PAGE);
    if (!first && page !== this.page) this.showPage(page, prev < 0 ? 1 : Math.sign(i - prev) || 1);
    // thumbs (the selected one lifts by two pixels)
    this.thumbs.forEach((t, k) => {
      const on = k === i;
      const lift = on ? 2 : 0;
      t.frame.setTexture(thumbFrame(this.scene, CARDS[t.id].kind, on));
      t.frame.y = -CELL_H / 2 - 1 - lift;
      t.art.y = -CELL_H / 2 + 1 - lift;
      if (t.star) t.star.y = -CELL_H / 2 + 3 - lift;
      t.art.clearTint();
    });
    const t = this.thumbs[i];
    this.selGlow.setPosition(t.x + CELL_W / 2, t.y + CELL_H / 2 - 2).setTint(R[3]);

    // big card: flip to the new face
    this.scene.tweens.killTweensOf(this.big);
    if (first) {
      this.big.setTexture(cardFaceKey(id)).setScale(2);
      this.playSheen();
    } else {
      void tween(this.scene, { targets: [this.big], scaleX: 0, duration: 90, ease: 'Quad.In' }).then(() => {
        this.big.setTexture(cardFaceKey(id));
        void tween(this.scene, { targets: [this.big], scaleX: 2, duration: 130, ease: 'Back.Out' }).then(() => this.playSheen());
      });
    }
    this.bigGlow.setTint(R[3]);

    // text
    this.nameT.setText(def.name);
    this.textT.setText('');
    if (isMonster(def)) {
      this.tagT.setText(def.ace ? '★ ACE CARD' : '');
      this.typeT.setText(`${ATTRIBUTE_NAMES[def.attribute]} / ${def.race}`);
      this.typeT.setTint(mix(ATTRIBUTE_RAMP[def.attribute][3], PAL.white, 0.35));
      this.starsT.setText(`LV ${def.level} ` + '★'.repeat(def.level));
      this.statsT.setText(`ATK ${def.atk}  ·  DEF ${def.def}`);
      const tr = tributesFor(def.level);
      this.ruleT.setText(tr === 0 ? 'No Tribute needed' : `Needs ${tr} Tribute${tr > 1 ? 's' : ''}`);
      this.textT.setText(def.text || def.flavor);
      this.textT.setTint(def.text ? PAL.white : PAL.mist);
    } else {
      this.tagT.setText('');
      this.typeT.setText(def.kind === 'spell' ? `SPELL · ${SPELL_TYPE[def.spellType] ?? def.spellType}` : 'TRAP');
      this.typeT.setTint(R[3]);
      this.starsT.setText('');
      this.statsT.setText('');
      this.ruleT.setText(def.kind === 'trap' ? 'Cannot activate the turn it is Set' : '');
      this.textT.setText(def.text);
      this.textT.setTint(PAL.white);
    }
    this.statsT.y = isMonster(def) ? this.typeT.y + 13 : this.typeT.y;
    this.textT.y = isMonster(def) ? this.typeT.y + 31 : this.typeT.y + 16;
    if (!isMonster(def)) this.ruleT.y = this.typeT.y + 16 + this.textT.height + 4;
    else this.ruleT.y = this.typeT.y + 15;
    if (!isMonster(def)) this.ruleT.setOrigin(0, 0).setX(GRID_X);
    else this.ruleT.setOrigin(1, 0).setX(GRID_X + 242);

    // chips only for monsters
    for (const c of this.chips) {
      c.bg.setVisible(isMonster(def));
      c.label.setVisible(isMonster(def));
      if (c.zone.input) c.zone.input.enabled = isMonster(def);
    }
    this.animLabel.setText(isMonster(def) ? '' : def.kind === 'spell' ? 'SPELL CARD' : 'TRAP CARD');
    void this.stage(def, first);
  }

  private playSheen(): void {
    this.bigSheen.setVisible(true).play(ANIM_SHEEN);
  }

  // ------------------------------------------------------------ the stage

  private clearStage(): void {
    this.gen++;
    this.fxTimer?.remove(false);
    this.fxTimer = null;
    this.bobTween?.stop();
    this.bobTween = null;
    if (this.sprite) {
      const old = this.sprite;
      this.sprite = null;
      void safe(glitch(this.scene, old, 120, 1.2)).then(() => old.destroy());
    }
    this.shadow?.destroy();
    this.shadow = null;
    this.art?.destroy();
    this.art = null;
    this.artFrame?.destroy();
    this.artFrame = null;
    if (this.circle) void this.circle.dismiss(200);
    this.circle = null;
  }

  private async stage(def: CardDef, first: boolean): Promise<void> {
    this.clearStage();
    const gen = this.gen;
    const s = this.scene;
    const R = stageRamp(def);
    this.pedestal.setTexture(pedestalTex(s, R));
    this.halo.setTint(R[3]);
    if (!first) await wait(s, 120);
    if (gen !== this.gen || !this.open_) return;
    void shockwave(s, this.sx, this.sy, { ramp: R, radius: 70, ms: 420, thickness: 5, depth: unitDepth(this.sy) - 2 });
    if (isMonster(def)) await this.stageMonster(def.id, def.attribute, gen);
    else await this.stageCard(def, gen);
  }

  private async stageMonster(id: MonsterId, attribute: Attribute, gen: number): Promise<void> {
    const s = this.scene;
    const art = monsterArt(id);
    const ramp = ATTRIBUTE_RAMP[attribute];
    const sprite = s.add.sprite(this.sx, this.sy - art.hover * 2, monsterTextureKey(id), monsterFrameName('idle', 0));
    sprite.setOrigin(art.anchorX / art.w, art.anchorY / art.h).setScale(2).setDepth(unitDepth(this.sy)).setVisible(false);
    this.sprite = sprite;
    this.own(sprite);
    const rx = Math.max(12, Math.min(40, Math.round(art.w * 0.5)));
    this.shadow = this.own(s.add.ellipse(this.sx, this.sy + 1, rx * 2, Math.round(rx * 0.8), PAL.ink, art.hover ? 0.35 : 0.5).setDepth(unitDepth(this.sy) - 1));
    sfx.play('materialize', { volume: 0.5 });
    void sparkleBurst(s, this.sx, this.sy - 30, { ramp, count: 18, depth: unitDepth(this.sy) + 2 });
    sprite.play(monsterAnimKey(id, 'idle'));
    await safe(materialize(s, sprite, { attribute, ms: 620 }));
    if (gen !== this.gen) return;
    void this.autoCycle(gen, 0);
  }

  private async autoCycle(gen: number, from: number): Promise<void> {
    let k = from;
    while (gen === this.gen && this.open_) {
      const anim = AUTO[k % AUTO.length];
      k++;
      await this.playAnim(anim, gen);
    }
  }

  /** Play one animation on the stage sprite (loops are held for a while). */
  private async playAnim(anim: MonsterAnim, gen: number): Promise<void> {
    const s = this.scene;
    const sprite = this.sprite;
    const id = this.ids[this.sel];
    const def = CARDS[id];
    if (!sprite || !isMonster(def)) return;
    const art = monsterArt(def.id);
    const spec = art.anims[anim];
    this.current = anim;
    this.chips.forEach((c) => {
      const on = c.anim === anim;
      c.bg.setTexture(panelTex(s, on ? 'trap' : 'neutral', 48, 16, { chamfer: 2, dim: !on }));
      c.label.setTint(on ? PAL.white : PAL.steel);
    });
    this.animLabel.setText(`${spec.frames} FRAMES · ${spec.fps} FPS${spec.loop ? ' · LOOP' : ''}`);
    sprite.play(monsterAnimKey(def.id, anim));
    const ramp = ATTRIBUTE_RAMP[def.attribute];
    const frameMs = 1000 / spec.fps;
    if (anim === 'roar') sfx.play(def.level >= 5 ? 'roarBig' : 'roarSmall', { volume: 0.45 });
    if (anim === 'attack') {
      sfx.play('whoosh', { volume: 0.35 });
      void wait(s, art.attackImpactFrame * frameMs).then(() => {
        if (gen !== this.gen || !sprite.active) return;
        const m = framePointToWorld(sprite, art.muzzle.x, art.muzzle.y);
        void sparkleBurst(s, m.x, m.y, { ramp, count: 16, depth: unitDepth(this.sy) + 3 });
        const flash = s.add
          .image(m.x, m.y, haloTex(s, 12))
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(ramp[4])
          .setDepth(unitDepth(this.sy) + 2)
          .setScale(0.6);
        void tween(s, { targets: flash, scale: 2.2, alpha: 0, duration: 260, ease: 'Quad.Out' }).then(() => flash.destroy());
        sfx.play(ATTR_SFX[def.attribute], { volume: 0.45 });
      });
    }
    if (anim === 'hit') {
      sfx.play('impactLight', { volume: 0.5 });
      void safe(whiteFlash(s, sprite, 70));
      const x0 = sprite.x;
      void tween(s, { targets: sprite, x: x0 - 6, duration: 50, yoyo: true, ease: 'Quad.Out' }).then(() => (sprite.x = x0));
    }
    const hold = spec.loop ? (anim === 'idle' ? 1900 : 2300) : (spec.frames / spec.fps) * 1000 + 160;
    await wait(s, hold);
  }

  /** A chip was clicked: play that animation now, then resume the auto cycle after it. */
  private manual(anim: MonsterAnim): void {
    const def = CARDS[this.ids[this.sel]];
    if (!isMonster(def) || !this.sprite) return;
    sfx.play('uiClick', { volume: 0.5 });
    const gen = ++this.gen;
    void this.playAnim(anim, gen).then(() => {
      if (gen !== this.gen) return;
      const next = AUTO.indexOf(anim);
      void this.autoCycle(gen, next >= 0 ? next + 1 : 0);
    });
  }

  private async stageCard(def: CardDef, gen: number): Promise<void> {
    const s = this.scene;
    const R = kindRampOf(def);
    const y = this.sy - 74;
    this.circle = createMagicCircle(s, this.sx, this.sy, { attribute: 'LIGHT', ramp: R, size: 'big', appearMs: 300, depth: unitDepth(this.sy) - 2 });
    this.artFrame = this.own(
      s.add
        .image(this.sx, y, panelTex(s, def.kind === 'spell' ? 'spell' : 'trap', 44 * 3 + 8, 34 * 3 + 8, { chamfer: 4 }))
        .setDepth(unitDepth(this.sy))
        .setAlpha(0),
    );
    this.art = this.own(s.add.image(this.sx, y, cardArtKey(def.id)).setScale(3).setDepth(unitDepth(this.sy) + 0.5));
    sfx.play(def.kind === 'spell' ? 'spellActivate' : 'trapActivate', { volume: 0.4 });
    await safe(materialize(s, this.art, { ramp: R, ms: 520 }));
    if (gen !== this.gen) return;
    void tween(s, { targets: this.artFrame, alpha: 1, duration: 160 });
    const bob = { t: 0 };
    this.bobTween = s.tweens.add({
      targets: bob,
      t: Math.PI * 2,
      duration: 2400,
      repeat: -1,
      onUpdate: () => {
        const dy = Math.round(Math.sin(bob.t) * 3);
        this.art?.setY(y + dy);
        this.artFrame?.setY(y + dy);
      },
    });
    this.cardFx(def, gen, true);
    this.fxTimer = s.time.addEvent({ delay: 2600, loop: true, callback: () => this.cardFx(def, gen, false) });
  }

  /** Looping element effect around a spell/trap on the stage. */
  private cardFx(def: CardDef, gen: number, first: boolean): void {
    if (gen !== this.gen || !this.open_) return;
    const s = this.scene;
    const x = this.sx;
    const y = this.sy;
    const d = unitDepth(y) + 4;
    const R = kindRampOf(def);
    switch (def.id) {
      case 'judgment_bolt':
        if (!first) {
          void skyBolt(s, x + 52, y - 4, { ms: 520, width: 3, depth: d });
          sfx.play('lightning', { volume: 0.3 });
        }
        sparkles(s, x, y - 70, { ramp: RAMPS.gold, count: 6, w: 120, h: 90, depth: d });
        break;
      case 'healing_spring':
        droplets(s, x, y - 20, { ramp: RAMPS.teal, count: 10, w: 60, depth: d });
        bubbles(s, x, y - 10, { ramp: RAMPS.teal, count: 8, w: 80, h: 20, depth: d, duration: 1200, frequency: 160 });
        sparkles(s, x, y - 70, { ramp: RAMPS.teal, count: 8, w: 120, h: 90, depth: d });
        break;
      case 'soul_recall':
        void lightPillar(s, x, y, { attribute: 'LIGHT', ramp: RAMPS.cyan, height: 150, width: 16, ms: 1100, depth: unitDepth(y) - 1 });
        sparkles(s, x, y - 70, { ramp: RAMPS.cyan, count: 8, w: 120, h: 90, depth: d });
        break;
      case 'dragon_blade':
        glints(s, x, y - 74, { ramp: RAMPS.gold, count: 8, w: 132, h: 102, depth: d });
        sparkles(s, x, y - 70, { ramp: RAMPS.gold, count: 10, w: 140, h: 110, depth: d });
        break;
      case 'volcano_arena':
        embers(s, x, y, { ramp: RAMPS.fire, count: 3, radius: 60, depth: d, duration: 2400, frequency: 90 });
        break;
      case 'mirror_barrier':
        glints(s, x, y - 74, { ramp: RAMPS.mag, count: 10, w: 140, h: 110, depth: d });
        sparkles(s, x, y - 70, { ramp: RAMPS.mag, count: 8, w: 140, h: 110, depth: d });
        break;
      case 'chains_of_light':
        sparkles(s, x, y - 70, { ramp: RAMPS.gold, count: 14, w: 150, h: 110, depth: d });
        break;
      case 'chasm_trap':
        dust(s, x, y, { ramp: RAMPS.earth, count: 2, radius: 50, depth: d, duration: 1200, frequency: 120 });
        rocks(s, x, y, { radius: 30, count: 4, depth: d });
        shadowWisps(s, x, y, { ramp: RAMPS.void, count: 4, radius: 40, depth: d });
        break;
      default:
        sparkles(s, x, y - 70, { ramp: R, count: 8, w: 120, h: 90, depth: d });
    }
    this.circle?.pulse(200);
  }

  // ------------------------------------------------------------ input

  onKey(e: KeyboardEvent): boolean {
    const n = this.ids.length;
    const last = n - 1;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        // walks across page edges; wraps from the first card to the last
        this.select(this.sel === 0 ? last : this.sel - 1);
        return true;
      case 'ArrowRight':
      case 'KeyD':
        this.select(this.sel === last ? 0 : this.sel + 1);
        return true;
      case 'ArrowUp':
      case 'KeyW':
        // a row up; off the top row it continues on the previous page's bottom row
        if (this.sel - COLS >= 0) this.select(this.sel - COLS);
        else this.select(Math.min(last, (Math.ceil(n / COLS) - 1) * COLS + (this.sel % COLS)));
        return true;
      case 'ArrowDown':
      case 'KeyS':
        if (this.sel + COLS <= last) this.select(this.sel + COLS);
        else if (Math.floor(this.sel / COLS) < Math.floor(last / COLS)) this.select(last);
        else this.select(this.sel % COLS);
        return true;
      case 'PageUp':
      case 'KeyQ':
        this.flipPage(-1);
        return true;
      case 'PageDown':
      case 'KeyE':
        this.flipPage(1);
        return true;
      case 'Home':
        this.select(0);
        return true;
      case 'End':
        this.select(last);
        return true;
      case 'Space':
      case 'Enter':
      case 'NumpadEnter': {
        const def = CARDS[this.ids[this.sel]];
        if (isMonster(def)) {
          const k = ANIMS.findIndex((a) => a.anim === this.current);
          this.manual(ANIMS[(k + 1) % ANIMS.length].anim);
        } else {
          this.cardFx(def, this.gen, false);
          this.playSheen();
        }
        return true;
      }
      case 'Escape':
      case 'Backspace':
        void this.close();
        return true;
    }
    return false;
  }

  protected teardown(): void {
    this.clearStage();
    this.pageGen++;
    if (this.onWheel) this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    this.onWheel = null;
    void OV_UI;
  }
}
