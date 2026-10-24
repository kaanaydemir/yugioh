// The v3 card object (K1 … K6, KO-1 / KO-2 / KO-3) — lane interface S-9 (docs/v3/A6_PLAN.md §4.1
// "Kart nesnesi", §5.0.4). Lane A6-A, step A1.
//
// CardV3 extends CardSprite with the same API (flyTo, flip, setHighlight, hoverLift, punch, pulse,
// dissolve, setTrail …) and, while lane A6-A is on (V3_A6_A), draws the card the v3 way:
//   - never rotated, never at a fractional scale: `rotation` / `angle` are kept as logical values
//     only, and a logical scale (setScale, a tween of `scale`, flyTo's scale) is shown as a crisp
//     raster of whole-pixel size (cardRaster: nearest-neighbour, the 1-px outline and trim kept);
//     a whole-number scale shows the static texture k× — the container itself stays at scale 1
//   - always on whole pixels: the card's own motion is rounded, and a fractional position set from
//     outside is snapped on the next update (the drawn image never sits between pixels)
//   - flip = sharp turn frames (48 → 34 → 18 → 4 → 18 → 34 → 48 px, the face after the edge-on
//     frame; the narrow frames use the motion-LOD face), flipFrames() hands them to a caller
//   - setHighlight = a 1-px rim + a running light node (white head, ramp[4] / ramp[2] tail);
//     pulse = a rim flash in palette steps; punch = a 1–2 px drop; hoverLift = a whole-pixel lift
//   - no ADD glow ring, no soft rim light, no alpha drop shadow, no sparkle burst
// At rest at scale 1 it shows the static texture (`card:face:<id>` / the owner's back, S-2 / S-13);
// a raster or a turn frame goes into ONE small live canvas per card (TileCard's method).
// With lane A6-A off (v1, &a6=off|b) a CardV3 is exactly today's CardSprite (every override hands
// over to it), and flipFrames() is empty (callers fall back to flip()).
//
//   const c = createCardV3(scene, 'crystal_wyrm', { x, y, player: 0, faceUp: false });
//   c.setScale(0.75);                        // shown as a 36×51 raster, crisp
//   await c.flip(true);                      // sharp turn frames, ≈ 260 ms
//   for (const f of c.flipFrames()) …        // or step the frames yourself (TrapPromptV3)

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import { cardAccent, cardBackCanvas, cardFaceCanvas, cardMip } from '../../art/cards';
import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { TEX } from '../../vfx/core';
import { CardSprite, burnAway, rootDepth, type FlyOpts } from '../CardSprite';
import { V3_A6_A } from '../v3flags';
import { miniHandBackV3 } from './cardBack';
import { lodFace } from './cardLod';
import { displaySize, integerScale, rasterCard, turnFrames } from './cardRaster';
import { REDUCED_MOTION } from './motion';
import { paletteSteps, rimPath } from './ui-kit';

export interface CardV3Opts {
  x?: number;
  y?: number;
  /** Default: face-up when the card is known (as CardSprite). */
  faceUp?: boolean;
  /** Owner: the back's tone, the trail and the rim light (as CardSprite). */
  player?: PlayerId;
}

// ================================================================ sides and frames (pure)

/**
 * The source pixels of one side of a card shown `w` px wide: the face (48×68, or its 24×34 level
 * for small rasters) or the owner's back (S-2: 48×68, the 24×34 level, the 9×13 mini-hand back).
 */
export function sideSource(cardId: CardId | null, faceUp: boolean, player: PlayerId, w: number): PixelCanvas {
  if (faceUp && cardId) return w >= 25 ? cardFaceCanvas(cardId) : cardMip(cardId).levels[1];
  if (w >= 25) return cardBackCanvas(player);
  if (w >= 13) return cardMip('back', player).levels[1];
  return miniHandBackV3(player);
}

const RASTER_CAP = 192;
const rasterCache = new Map<string, PixelCanvas>();

function remember(key: string, make: () => PixelCanvas): PixelCanvas {
  let p = rasterCache.get(key);
  if (p) {
    rasterCache.delete(key);
    rasterCache.set(key, p);
    return p;
  }
  p = make();
  rasterCache.set(key, p);
  if (rasterCache.size > RASTER_CAP) rasterCache.delete(rasterCache.keys().next().value!);
  return p;
}

function sideKey(cardId: CardId | null, faceUp: boolean, player: PlayerId): string {
  return faceUp && cardId ? `f:${cardId}` : `b:${player}`;
}

/** One side of a card as a crisp raster of w × h whole pixels (cached). */
export function cardRaster(cardId: CardId | null, faceUp: boolean, player: PlayerId, w: number, h: number): PixelCanvas {
  return remember(`${sideKey(cardId, faceUp, player)}:${w}x${h}`, () => rasterCard(sideSource(cardId, faceUp, player, w), w, h));
}

/**
 * The sharp turn frames of a card shown w × h, from the side shown now (`fromFaceUp`) to the
 * other: the narrowing frames, the edge-on frame, the widening frames and the new side at full
 * width — every frame w × h with the card centred. Unknown card (null): no frames.
 */
export function cardTurnFrames(cardId: CardId | null, fromFaceUp: boolean, player: PlayerId, w: number, h: number): PixelCanvas[] {
  if (cardId === null || w < 1 || h < 1) return [];
  const from = sideSource(cardId, fromFaceUp, player, w);
  const to = sideSource(cardId, !fromFaceUp, player, w);
  const lod = lodFace(cardId);
  return turnFrames(from, to, w, h, { fromLod: fromFaceUp ? lod : undefined, toLod: fromFaceUp ? undefined : lod });
}

const turnCache = new Map<string, PixelCanvas[]>();

function cachedTurn(cardId: CardId, fromFaceUp: boolean, player: PlayerId, w: number, h: number): PixelCanvas[] {
  const key = `${cardId}:${fromFaceUp ? 1 : 0}:${player}:${w}x${h}`;
  let f = turnCache.get(key);
  if (!f) {
    f = cardTurnFrames(cardId, fromFaceUp, player, w, h);
    turnCache.set(key, f);
    if (turnCache.size > 48) turnCache.delete(turnCache.keys().next().value!);
  }
  return f;
}

/** The tone ramp a highlight colour belongs to (its node's tail tones), else the neutral one. */
export function rampOf(color: number): Ramp {
  for (const r of [PLAYER_RAMP[0], PLAYER_RAMP[1], ...Object.values(RAMPS)]) if (r.includes(color)) return r;
  return [PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];
}

/**
 * The rim style of a card (K1 / KO-3): a 1-px ring just outside the card, its top + left edges in
 * `tl` and its bottom + right edges in `br` (the frame language's light from the top left; null
 * leaves those edges out — e.g. only a top-left light strip), with 0–2 running light nodes.
 */
export interface RimStyle {
  /** Tone of the top and left edges (null: not drawn). */
  tl: number | null;
  /** Tone of the bottom and right edges (null: not drawn). */
  br: number | null;
  /** Running light nodes on the ring, evenly spaced: 0 (default), 1 or 2. Use them on a full ring. */
  nodes?: number;
  /** The nodes travel (default true); false holds them where they are (a locked hand). */
  run?: boolean;
  /** The nodes' tones: a white head, then ramp[4], ramp[2] (default: the ramp of tl / br). */
  ramp?: Ramp;
}

/**
 * The ring pixels around a w × h card (1 px outside it, corners cut): the top + left edges in `tl`,
 * the bottom + right edges in `br` (null = not painted). Pure; a canvas (w + 2) × (h + 2).
 */
export function paintRing(w: number, h: number, tl: number | null, br: number | null): PixelCanvas {
  const W = w + 2;
  const H = h + 2;
  const p = new PixelCanvas(W, H);
  for (const [x, y] of rimPath(0, 0, W, H, 1)) {
    const c = y === 0 || x === 0 ? tl : br;
    if (c !== null) p.set(x, y, c);
  }
  return p;
}

/** The ring texture (see paintRing; palette pixels, no tint). */
function ringKey(scene: Phaser.Scene, w: number, h: number, tl: number | null, br: number | null): string {
  const key = `cv3:ring:${w}x${h}:${tl === null ? '-' : tl.toString(16)}:${br === null ? '-' : br.toString(16)}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintRing(w, h, tl, br).toCanvas());
  return key;
}

// ================================================================ the card

/** One lap of the running rim node (the HUD runner's speed, F10). */
const NODE_LAP_MS = 2400;
/** Whole-pixel lift of a hovered card (as CardSprite's 6 px). */
const HOVER_PX = 6;
/** Size of the live canvas (fits rasters up to ≈ 2.05× — larger whole-number scales use the static texture). */
const LIVE_W = 100;
const LIVE_H = 140;

let liveSeq = 0;
let phaseSeq = 0;

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface TurnState {
  /** The side the turn starts from. */
  fromFaceUp: boolean;
  /** Index into the turn frames. */
  step: number;
}

export class CardV3 extends CardSprite {
  /** v3 drawing is on (lane A6-A); false = exactly today's CardSprite. */
  readonly crisp: boolean = V3_A6_A;
  /** Set at the end of the constructor: before it, every override hands over to CardSprite. */
  private v3on = false;
  /** The renderer is drawing this card (the accessors answer with the real transform meanwhile). */
  private rendering = false;
  /** Logical scale / rotation (shown as crisp rasters / not at all). */
  private lsx = 1;
  private lsy = 1;
  private lr = 0;
  /** Whole-pixel lift of the card (hover / punch / landing), added to the snap offset. */
  private liftY = 0;
  /** The display size of the last redraw. */
  private dispW = 48;
  private dispH = 68;
  private turn: TurnState | null = null;
  private live: Phaser.Textures.CanvasTexture | null = null;
  private liveKey = '';
  private rimImg: Phaser.GameObjects.Image | null = null;
  private readonly nodeImgs: Phaser.GameObjects.Image[] = [];
  /** The rim style (null: none; setHighlight / setRim) and a flash tone over the whole ring (pulse / flashRim). */
  private rimSt: RimStyle | null = null;
  private flashTone: number | null = null;
  /** flashRim's pending end (a newer flash replaces it). */
  private flashSeq = 0;
  /** A flash over the whole ring ('full') or only over the edges the rim style draws ('style'). */
  private flashShape: 'full' | 'style' = 'full';
  private nodeT = 0;
  private readonly onUpdate = (_t: number, dt: number) => this.tick(dt);

  constructor(scene: Phaser.Scene, x: number, y: number, cardId: CardId | null, opts: { faceUp?: boolean; player?: PlayerId } = {}) {
    super(scene, x, y, cardId, opts);
    if (!this.crisp) return;
    // today's soft layers never show on a v3 card (ADD ring, rim light, alpha shadow, ADD flash)
    this.rim.setVisible(false);
    this.glow.setVisible(false);
    this.glowRun.setVisible(false);
    this.flashImg.setVisible(false);
    this.shadow.setVisible(false);
    this.nodeT = (phaseSeq++ * 0.37) % 1;
    this.v3on = true;
    realSet(this, 'scaleX', 1);
    realSet(this, 'scaleY', 1);
    realSet(this, 'rotation', 0);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    this.redraw();
    this.snap();
  }

  // ------------------------------------------------------------ logical transform

  /** Logical scale x (the shown raster's width is round(48 · |sx|)). */
  get logicalScaleX(): number {
    return this.v3on ? this.lsx : realGet(this, 'scaleX');
  }

  get logicalScaleY(): number {
    return this.v3on ? this.lsy : realGet(this, 'scaleY');
  }

  /** The whole-pixel size the card is shown at. */
  get displayW(): number {
    return this.v3on ? this.dispW : Math.round(48 * Math.abs(realGet(this, 'scaleX')));
  }

  get displayH(): number {
    return this.v3on ? this.dispH : Math.round(68 * Math.abs(realGet(this, 'scaleY')));
  }

  /** @internal accessor hooks (see installCrispTransform). */
  _getLogical(k: 'scaleX' | 'scaleY' | 'rotation'): number {
    return k === 'scaleX' ? this.lsx : k === 'scaleY' ? this.lsy : this.lr;
  }

  /** @internal */
  _setLogical(k: 'scaleX' | 'scaleY' | 'rotation', v: number): void {
    if (k === 'rotation') {
      this.lr = v;
      return;
    }
    if (k === 'scaleX') this.lsx = v;
    else this.lsy = v;
    const { w, h } = displaySize(this.lsx, this.lsy);
    if (w !== this.dispW || h !== this.dispH || !this.face.visible) this.redraw();
  }

  /**
   * @internal The logical transform is on (lane A6-A) and the card is not being rendered right now:
   * Phaser's container renderer reads scaleX / scaleY / rotation through the public accessors, and
   * it must see the REAL ones (1, 1, 0) — the logical scale is already in the raster / k× texture.
   */
  _crispOn(): boolean {
    return this.v3on && !this.rendering;
  }

  /** @internal set while the renderer draws this card (installCrispTransform wraps renderWebGL / renderCanvas). */
  _setRendering(on: boolean): void {
    this.rendering = on;
  }

  // ------------------------------------------------------------ drawing

  /** The side shown (face only when the card is known and face-up). */
  private get showsFace(): boolean {
    return this.faceUp && this.cardId !== null;
  }

  private ownerOf(): PlayerId {
    return this.player ?? 0;
  }

  /**
   * The pixels the face image shows right now (a shared reference: do not modify): the side's
   * 48×68 pixels when the static texture is shown (at 1× or a whole-number k×, the image is scaled
   * k×), else the raster / turn frame at the whole-pixel display size (the image at 1×).
   */
  shownPixels(): PixelCanvas {
    if (!this.v3on) return this.pixels;
    const w = Math.max(1, this.dispW);
    const h = Math.max(1, this.dispH);
    if (this.turn && this.cardId) {
      const frames = cachedTurn(this.cardId, this.turn.fromFaceUp, this.ownerOf(), w, h);
      const f = frames[Math.min(frames.length - 1, this.turn.step)];
      if (f) return f;
    }
    const k = integerScale(this.lsx, this.lsy);
    if (k !== null && k * 48 === w && k * 68 === h) return this.pixels;
    return cardRaster(this.cardId, this.showsFace, this.ownerOf(), w, h);
  }

  /** Redraw the face image (static texture or raster), the rim and the overlays. */
  protected redraw(): void {
    if (!this.v3on || this.dead || !this.face.active) return;
    const { w, h } = displaySize(this.lsx, this.lsy);
    this.dispW = w;
    this.dispH = h;
    if (w < 1 || h < 1) {
      this.face.setVisible(false);
      this.sheen.setVisible(false);
      this.placeRim();
      return;
    }
    this.face.setVisible(true);
    const k = integerScale(this.lsx, this.lsy);
    if (!this.turn && k !== null && k * 48 === w && k * 68 === h) {
      this.face.setTexture(this.textureKey).setOrigin(0.5).setScale(k);
    } else {
      this.showRaster(this.shownPixels());
    }
    if (!(k === 1 && !this.turn)) this.sheen.setVisible(false);
    this.placeRim();
  }

  /** Put a raster into the card's live canvas and show it (scale 1, whole-pixel origin). */
  private showRaster(px: PixelCanvas): void {
    const w = px.w;
    const h = px.h;
    if (!this.live || this.live.width < w || this.live.height < h) {
      if (this.live) this.scene.textures.remove(this.liveKey);
      this.liveKey = `cv3:live:${++liveSeq}`;
      this.live = this.scene.textures.createCanvas(this.liveKey, Math.max(LIVE_W, w), Math.max(LIVE_H, h))!;
    }
    const tex = this.live;
    tex.context.clearRect(0, 0, w, h);
    tex.context.putImageData(px.toImageData(), 0, 0);
    const name = `r${w}x${h}`;
    if (!tex.has(name)) tex.add(name, 0, 0, 0, w, h);
    tex.refresh();
    this.face
      .setTexture(this.liveKey, name)
      .setOrigin(Math.floor(w / 2) / w, Math.floor(h / 2) / h)
      .setScale(1);
  }

  /** The rim ring + nodes at the current size (shown while a rim style is set or a flash runs). */
  private placeRim(): void {
    const st = this.rimSt;
    const flash = this.flashTone;
    const partial = flash !== null && this.flashShape === 'style' && st !== null;
    const tl = partial ? (st!.tl !== null ? flash : null) : (flash ?? st?.tl ?? null);
    const br = partial ? (st!.br !== null ? flash : null) : (flash ?? st?.br ?? null);
    const w = this.dispW;
    const h = this.dispH;
    const show = (tl !== null || br !== null) && w >= 1 && h >= 1 && this.face.visible;
    if (!show) {
      this.rimImg?.setVisible(false);
      for (const n of this.nodeImgs) n.setVisible(false);
      return;
    }
    const key = ringKey(this.scene, w, h, tl, br);
    const x0 = -Math.floor(w / 2) - 1;
    const y0 = -Math.floor(h / 2) - 1;
    if (!this.rimImg) {
      this.rimImg = this.scene.add.image(0, 0, key).setOrigin(0);
      this.inner.addAt(this.rimImg, this.inner.getIndex(this.face));
    }
    this.rimImg.setTexture(key).setPosition(x0, y0).setVisible(true);
    this.placeNode();
  }

  /** The running nodes on the rim (only on a rim style with nodes, not during a flash). */
  private placeNode(): void {
    const st = this.rimSt;
    const count = st ? Math.max(0, Math.min(2, Math.round(st.nodes ?? 0))) : 0;
    const show = count > 0 && this.flashTone === null && this.face.visible && this.dispW >= 1;
    if (!show) {
      for (const n of this.nodeImgs) n.setVisible(false);
      return;
    }
    while (this.nodeImgs.length < count * 3) {
      const img = this.scene.add.image(0, 0, TEX.px1).setOrigin(0);
      this.inner.add(img);
      this.nodeImgs.push(img);
    }
    const w = this.dispW + 2;
    const h = this.dispH + 2;
    const path = rimPath(0, 0, w, h, 1);
    const L = path.length;
    const x0 = -Math.floor(this.dispW / 2) - 1;
    const y0 = -Math.floor(this.dispH / 2) - 1;
    const R = st!.ramp ?? rampOf(st!.tl ?? st!.br ?? PAL.mist);
    const tones = [PAL.white, R[4], R[2]];
    for (let k = 0; k < this.nodeImgs.length; k++) if (k >= count * 3) this.nodeImgs[k].setVisible(false);
    for (let n = 0; n < count; n++) {
      const t = this.nodeT + n / count;
      const head = Math.floor((((t % 1) + 1) % 1) * L) % L;
      for (let i = 0; i < 3; i++) {
        const [px, py] = path[(head - i + L * 2) % L];
        this.nodeImgs[n * 3 + i].setPosition(x0 + px, y0 + py).setTint(tones[i]).setVisible(true);
      }
    }
  }

  /** Snap the drawn card to whole pixels (and apply the lift). */
  private snap(): void {
    if (!this.v3on || this.dead) return;
    const m = this.getWorldTransformMatrix();
    this.inner.x = Math.round(m.tx) - m.tx;
    this.inner.y = Math.round(m.ty) - m.ty + this.liftY;
  }

  private tick(dt: number): void {
    if (!this.v3on || this.dead) return;
    this.snap();
    const st = this.rimSt;
    if (st && (st.nodes ?? 0) > 0 && st.run !== false && this.flashTone === null && !REDUCED_MOTION) {
      this.nodeT = (this.nodeT + dt / NODE_LAP_MS) % 1;
      this.placeNode();
    }
  }

  // ------------------------------------------------------------ state overrides

  protected override refreshFace(): void {
    super.refreshFace();
    if (this.v3on) this.redraw();
  }

  override setPlayerTint(player: PlayerId | null): this {
    if (!this.v3on) return super.setPlayerTint(player);
    const was = this.player;
    this.player = player;
    if (this.dead) return this;
    this.rim.setVisible(false);
    if (was !== player) this.redraw();
    return this;
  }

  override playSweep(foil = false): void {
    if (!this.v3on) return super.playSweep(foil);
    // the overlay sheets are 48×68: only on the static card at 1×
    if (this.turn || integerScale(this.lsx, this.lsy) !== 1) return;
    super.playSweep(foil);
  }

  // ------------------------------------------------------------ looks

  /** 1-px rim + running node in `color` (KO-3); null removes it. */
  override setHighlight(color: number | null): this {
    if (!this.v3on) return super.setHighlight(color);
    if (color === this.highlight) return this;
    this.highlight = color;
    this.rimSt = color === null ? null : { tl: color, br: color, nodes: 1 };
    if (!this.dead) this.placeRim();
    return this;
  }

  /**
   * The rim in full (K1 / KO-3): top-left / bottom-right tones, 0–2 running nodes, held nodes (a
   * locked hand). null removes it. Lane A6-A off: maps onto setHighlight (the top-left tone).
   */
  setRim(style: RimStyle | null): this {
    if (!this.v3on) return this.setHighlight(style ? (style.tl ?? style.br) : null);
    // a later setHighlight must always apply (no colour equals this marker)
    this.highlight = style === null ? null : -1;
    const was = this.rimSt;
    if (style && was && style.tl === was.tl && style.br === was.br && (style.nodes ?? 0) === (was.nodes ?? 0) && style.run === was.run && style.ramp === was.ramp) return this;
    this.rimSt = style ? { ...style } : null;
    if (!this.dead) this.placeRim();
    return this;
  }

  /** The rim style set now (null: none). */
  get rimStyle(): Readonly<RimStyle> | null {
    return this.rimSt;
  }

  /**
   * The ring in `tone` for `ms` (e.g. two frames of white on a hover settle, of crimson on a reject),
   * over the rim style or on a card without one; the nodes wait meanwhile. `shape` 'style' lights
   * only the edges the rim style draws (a top-left light strip stays a strip). A newer flash
   * replaces it. Lane A6-A off: nothing.
   */
  flashRim(tone: number, ms: number, shape: 'full' | 'style' = 'full'): void {
    if (!this.v3on || this.dead) return;
    const seq = ++this.flashSeq;
    this.flashShape = shape;
    this.flashTone = tone;
    this.placeRim();
    this.later(Math.max(1, ms), () => {
      if (seq !== this.flashSeq) return;
      this.flashTone = null;
      this.placeRim();
    });
  }

  /** Whole-pixel lift (hover): 0 → −6 px, no sweep, no shadow. */
  override hoverLift(on: boolean): Promise<void> {
    if (!this.v3on) return super.hoverLift(on);
    if (on === this.lifted || this.dead) return Promise.resolve();
    this.lifted = on;
    const from = this.liftY;
    const to = on ? -HOVER_PX : 0;
    if (REDUCED_MOTION) {
      this.liftY = to;
      this.snap();
      return Promise.resolve();
    }
    return this.tv(0, 1, on ? 120 : 100, (t) => {
      this.liftY = Math.round(from + (to - from) * easeOutQuad(t));
      this.snap();
    });
  }

  /** A 1–2 px drop and back (whole pixels; no squash). */
  override punch(amount = 0.12, ms = 180): Promise<void> {
    if (!this.v3on) return super.punch(amount, ms);
    if (this.dead || REDUCED_MOTION) return Promise.resolve();
    const base = this.lifted ? -HOVER_PX : 0;
    const drop = amount >= 0.1 ? 2 : 1;
    return this.tv(0, 1, ms, (t) => {
      const d = t < 0.3 ? drop : t < 0.65 ? Math.ceil(drop / 2) : 0;
      this.liftY = base + d;
      this.snap();
    });
  }

  /** Rim flash: one white frame, then `color`, then two palette steps down, then off. */
  override pulse(color: number = PAL.white, ms = 320): Promise<void> {
    if (!this.v3on) return super.pulse(color, ms);
    if (this.dead) return Promise.resolve();
    const steps = [PAL.white, color, ...paletteSteps(color, 2, -1)];
    const at = [0, Math.min(34, ms * 0.12), ms * 0.55, ms * 0.78];
    const seq = ++this.flashSeq;
    this.flashShape = 'full';
    return this.tv(0, ms, ms, (t) => {
      if (seq !== this.flashSeq) return;
      let i = 0;
      while (i + 1 < at.length && t >= at[i + 1]) i++;
      const tone = steps[i];
      if (tone !== this.flashTone) {
        this.flashTone = tone;
        this.placeRim();
      }
    }).then(() => {
      if (seq !== this.flashSeq) return;
      this.flashTone = null;
      if (!this.dead) this.placeRim();
    });
  }

  /** No sparkle ring on a v3 card (ADD sparks are not in the v3 language). */
  override burst(color: number, n = 12): void {
    if (!this.v3on) return super.burst(color, n);
  }

  /** An owner-toned trail of single pixels while the card moves (palette steps, no ADD ghost). */
  override setTrail(on: boolean): this {
    if (!this.v3on) return super.setTrail(on);
    if (!on) {
      this.trailEvent?.remove();
      this.trailEvent = null;
      return this;
    }
    if (this.trailEvent || this.dead || REDUCED_MOTION) return this;
    let lx = NaN;
    let ly = NaN;
    this.trailEvent = this.scene.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        if (this.dead || !this.visible || !this.face.visible) return;
        const m = this.getWorldTransformMatrix();
        const tx = Math.round(m.tx);
        const ty = Math.round(m.ty + this.liftY);
        const moved = Math.hypot(tx - lx, ty - ly);
        lx = tx;
        ly = ty;
        if (!(moved >= 2)) return;
        const R = PLAYER_RAMP[this.ownerOf()];
        const depth = rootDepth(this) - 0.5;
        const spread = Math.max(2, Math.floor(this.dispW / 4));
        for (let i = 0; i < 3; i++) {
          const img = this.scene.add
            .image(tx + (i - 1) * spread, ty, TEX.px1)
            .setOrigin(0)
            .setTint(R[3])
            .setDepth(depth);
          const tones = [R[2], R[1]];
          let k = 0;
          const step = () => {
            if (!img.active) return;
            if (k >= tones.length) {
              img.destroy();
              return;
            }
            img.setTint(tones[k++]);
            this.scene?.time.delayedCall(45, step);
          };
          this.scene.time.delayedCall(45, step);
        }
      },
    });
    return this;
  }

  // ------------------------------------------------------------ motion

  /**
   * S-9: the sharp turn frames from the side shown now to the other (w × h each, the card centred;
   * the last frame is the other side at full width). The caller shows one per step (≤ 300 ms in
   * all) and then calls setFaceUp(). Empty with lane A6-A off or for an unknown card: use flip().
   */
  flipFrames(): readonly PixelCanvas[] {
    if (!this.v3on || this.cardId === null) return [];
    return cachedTurn(this.cardId, this.showsFace, this.ownerOf(), Math.max(1, this.dispW), Math.max(1, this.dispH));
  }

  /** Turn to the given side in sharp frames (≈ ms / 6 each; the face shows after the edge frame). */
  override async flip(toFaceUp: boolean, ms = 260): Promise<void> {
    if (!this.v3on) return super.flip(toFaceUp, ms);
    if (this.dead) return;
    if (toFaceUp && this.cardId === null) toFaceUp = false;
    if (toFaceUp === this.showsFace || this.cardId === null) {
      this.setFaceUp(toFaceUp);
      return;
    }
    const fromFaceUp = this.showsFace;
    const frames = cachedTurn(this.cardId, fromFaceUp, this.ownerOf(), Math.max(1, this.dispW), Math.max(1, this.dispH));
    const n = frames.length;
    if (REDUCED_MOTION || n === 0) {
      // reduced motion: edge frame, then the new side (2 frames)
      const edge = Math.floor((n - 1) / 2);
      this.turn = { fromFaceUp, step: edge };
      this.redraw();
      await this.tw({ targets: { v: 0 }, v: 1, duration: Math.min(ms, 60) });
      this.turn = null;
      if (!this.dead) this.setFaceUp(toFaceUp);
      return;
    }
    const per = ms / n;
    const edgeAt = Math.floor((n - 1) / 2);
    this.turn = { fromFaceUp, step: 0 };
    this.redraw();
    await this.tv(0, n, per * n, (v) => {
      const step = Math.min(n - 1, Math.floor(v));
      if (!this.turn || step === this.turn.step) return;
      this.turn.step = step;
      // the card's side changes on the far side of the edge-on frame
      if (step > edgeAt) this.faceUp = toFaceUp;
      this.redraw();
    });
    this.turn = null;
    if (this.dead) return;
    this.faceUp = toFaceUp;
    this.refreshFace();
  }

  /**
   * Fly along a whole-pixel arc to (x, y): a short pull-back, the travel (no lean, no spin, no
   * puff), the logical scale stepping through crisp raster sizes, an optional reveal turn, and a
   * 1-px settle on landing. `rotation` is kept as a logical value only.
   */
  override async flyTo(x: number, y: number, opts: FlyOpts = {}): Promise<void> {
    if (!this.v3on) return super.flyTo(x, y, opts);
    if (this.dead) return;
    const ms = opts.ms ?? 420;
    const arc = opts.arc ?? 40;
    const s0x = this.lsx;
    const s0y = this.lsy;
    const s1 = opts.scale ?? s0x;
    this.lr = opts.rotation ?? 0;
    const tx = Math.round(x);
    const ty = Math.round(y);
    let x0 = Math.round(this.x);
    let y0 = Math.round(this.y);
    const dx = tx - x0;
    const dy = ty - y0;
    const len = Math.hypot(dx, dy) || 1;
    const anticipate = (opts.anticipate ?? ms >= 200) && !REDUCED_MOTION;
    const a = anticipate ? Math.min(ms * 0.16, 90) : 0;
    if (anticipate) {
      const bx = x0;
      const by = y0;
      await this.tv(0, 1, a, (t) => {
        const k = easeOutQuad(t);
        this.x = Math.round(bx - (dx / len) * 3 * k);
        this.y = Math.round(by - (dy / len) * 3 * k + 1 * k);
      });
      if (this.dead) return;
      x0 = this.x;
      y0 = this.y;
    }
    const travel = ms - a;
    if (opts.reveal && !this.faceUp && this.cardId) {
      this.later(travel * 0.3, () => void this.flip(true, Math.max(120, Math.min(170, travel * 0.42))));
    }
    const cx = (x0 + tx) / 2;
    const cy = (y0 + ty) / 2 - arc;
    await this.tv(
      0,
      1,
      travel,
      (t) => {
        const u = 1 - t;
        this.x = Math.round(u * u * x0 + 2 * u * t * cx + t * t * tx);
        this.y = Math.round(u * u * y0 + 2 * u * t * cy + t * t * ty);
        this.setScale(s0x + (s1 - s0x) * t, s0y + (s1 - s0y) * t);
      },
      opts.ease ?? (anticipate ? 'Cubic.Out' : 'Sine.InOut'),
    );
    if (this.dead) return;
    this.setPosition(tx, ty);
    this.setScale(s1);
    if ((opts.land ?? true) && !REDUCED_MOTION) {
      // a 1-px settle, in CardSprite's 160 ms landing window (callers await the same time)
      const base = this.liftY;
      await this.tv(0, 1, 160, (t) => {
        this.liftY = base + (t < 0.375 ? 1 : 0);
        this.snap();
      });
      if (!this.dead) this.liftY = base;
    }
    this.snap();
  }

  /** Burn the SHOWN pixels (the raster at its whole-pixel size) into embers. Hides the card. */
  override async dissolve(ms = 650): Promise<void> {
    if (!this.v3on) return super.dissolve(ms);
    if (this.dead) return;
    const ember = this.showsFace ? cardAccent(this.cardId!) : PLAYER_RAMP[this.ownerOf()][3];
    this.setHighlight(null);
    this.flashSeq++;
    this.flashTone = null;
    this.placeRim();
    this.sheen.setVisible(false);
    const px = this.shownPixels();
    await burnAway(this.scene, this.face, px, ms, ember, { seed: (this.cardId?.length ?? 7) * 97 });
    if (this.dead) return;
    this.setVisible(false);
    this.face.setVisible(true);
  }

  protected override cleanup(): void {
    super.cleanup();
    const sc = this.scene;
    sc?.events?.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    if (this.liveKey && sc?.textures?.exists(this.liveKey)) sc.textures.remove(this.liveKey);
    this.live = null;
  }
}

// ================================================================ logical transform accessors
//
// Phaser keeps a game object's scale and rotation behind accessors (Transform: scale, scaleX,
// scaleY, rotation, angle) that every tween, setScale / setRotation and flyTo goes through, and
// it renders from the private fields behind them. A crisp CardV3 overrides those accessors on its
// own prototype: the values set become LOGICAL (shown as whole-pixel rasters / not at all), the
// real ones stay 1 and 0. Before the constructor ends — and on every CardV3 with lane A6-A off —
// they hand over to Phaser's own accessors.

type Acc = { get: (this: unknown) => number; set: (this: unknown, v: number) => void };

function findAccessor(name: string): Acc {
  let o: object | null = CardSprite.prototype;
  while (o) {
    const d = Object.getOwnPropertyDescriptor(o, name);
    if (d && d.get && d.set) return { get: d.get, set: d.set };
    o = Object.getPrototypeOf(o);
  }
  throw new Error(`CardV3: no ${name} accessor on Phaser's Container`);
}

let REAL: Record<'scale' | 'scaleX' | 'scaleY' | 'rotation' | 'angle', Acc> | null = null;

function real(): NonNullable<typeof REAL> {
  if (!REAL) {
    REAL = {
      scale: findAccessor('scale'),
      scaleX: findAccessor('scaleX'),
      scaleY: findAccessor('scaleY'),
      rotation: findAccessor('rotation'),
      angle: findAccessor('angle'),
    };
  }
  return REAL;
}

function realGet(o: CardV3, k: 'scaleX' | 'scaleY' | 'rotation'): number {
  return real()[k].get.call(o);
}

function realSet(o: CardV3, k: 'scaleX' | 'scaleY' | 'rotation', v: number): void {
  real()[k].set.call(o, v);
}

function installCrispTransform(): void {
  let r: NonNullable<typeof REAL>;
  try {
    r = real();
  } catch {
    return; // no Phaser runtime (tests with a stand-in module): nothing to override
  }
  const def = (name: string, get: (this: CardV3) => number, set: (this: CardV3, v: number) => void) =>
    Object.defineProperty(CardV3.prototype, name, { configurable: true, enumerable: false, get, set });
  // the renderer reads the transform through the same accessors: while it draws a card they must
  // answer with the real values, or a logical scale / rotation would be applied a second time
  for (const name of ['renderWebGL', 'renderCanvas'] as const) {
    const orig = (CardSprite.prototype as unknown as Record<string, unknown>)[name];
    if (typeof orig !== 'function') continue;
    const fn = orig as (this: CardV3, ...a: unknown[]) => unknown;
    Object.defineProperty(CardV3.prototype, name, {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function (this: CardV3, ...a: unknown[]) {
        this._setRendering(true);
        try {
          return fn.apply(this, a);
        } finally {
          this._setRendering(false);
        }
      },
    });
  }
  def(
    'scaleX',
    function () {
      return this._crispOn() ? this._getLogical('scaleX') : r.scaleX.get.call(this);
    },
    function (v) {
      if (this._crispOn()) this._setLogical('scaleX', v);
      else r.scaleX.set.call(this, v);
    },
  );
  def(
    'scaleY',
    function () {
      return this._crispOn() ? this._getLogical('scaleY') : r.scaleY.get.call(this);
    },
    function (v) {
      if (this._crispOn()) this._setLogical('scaleY', v);
      else r.scaleY.set.call(this, v);
    },
  );
  def(
    'scale',
    function () {
      return this._crispOn() ? (this._getLogical('scaleX') + this._getLogical('scaleY')) / 2 : r.scale.get.call(this);
    },
    function (v) {
      if (this._crispOn()) {
        this._setLogical('scaleX', v);
        this._setLogical('scaleY', v);
      } else r.scale.set.call(this, v);
    },
  );
  def(
    'rotation',
    function () {
      return this._crispOn() ? this._getLogical('rotation') : r.rotation.get.call(this);
    },
    function (v) {
      if (this._crispOn()) this._setLogical('rotation', v);
      else r.rotation.set.call(this, v);
    },
  );
  def(
    'angle',
    function () {
      return this._crispOn() ? (this._getLogical('rotation') * 180) / Math.PI : r.angle.get.call(this);
    },
    function (v) {
      if (this._crispOn()) this._setLogical('rotation', (v * Math.PI) / 180);
      else r.angle.set.call(this, v);
    },
  );
}

installCrispTransform();

/** A card for the v3 views (hand, prompts, pickers, flights): crisp with lane A6-A on, else today's CardSprite. */
export function createCardV3(scene: Phaser.Scene, cardId: CardId | null, opts: CardV3Opts = {}): CardV3 {
  return new CardV3(scene, opts.x ?? 0, opts.y ?? 0, cardId, { faceUp: opts.faceUp, player: opts.player });
}
