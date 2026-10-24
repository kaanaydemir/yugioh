// v3 lane A6-A — K4, the face-down set (setMonster / setSpellTrap) behind V3_A6_A
// (docs/v3/A6_PLAN.md §3 K4, §1.3 row "set", KO-1 … KO-12). Fills V3HOOKS.set (contract S-8); with
// the flag off nothing here runs and today's summon-b/set.ts plays (v1: never assigned).
//
// Brought forward to the A56.K checkpoint (the "kapalı koyma" pair failed: today's whole-card
// tint pulse hid the new owner-toned back on the landing frame). The beats, ms at 1× (A6_MS.set:
// input ≤ 400, tail ≤ 200; today 766):
//   0        today's unfocus safety (set.ts:35); the hand card leaves; cardSlide (today's slide)
//   0–210    flight: TileCard.slamIn `crisp` — today's 3D arc with the back showing; a monster
//            card turns 90° in the air and lands sideways. No grow, light, glint or white tint; a
//            dithered shadow; an owner-toned 2-px pixel trail (palette steps, no ADD)
//   ≈220     landing (made inside the landing frame's own update, so it shows ON that frame): the
//            static v3 back, nothing over it; a 1-px rim on its iso outline — 2 frames white, 1 frame
//            owner tone; 4 dust motes; cardSet (today's thunk, kept as the checkpoint pair's anchor —
//            A7 swaps in ui3Set and gives the pair an atAfter)
//   220–350  seal: the zone line one tone up; the pad one stepped-light tone up (a held lightPool);
//            the calm arena's four corner chevrons (the corner language of its target highlight)
//            close from 3 px out to 0 in three steps, owner tone. No filled pad, no ring (KO-3/4)
//   ≈ 365    latch: the four chevrons one white frame; ui3Latch (silent until A7); input returns
//            one frame later (≈ 383 ms measured from the event start)
//   383–560  tail (cancel-safe, KO-6): the chevrons fade in two palette steps, line and pad step
//            back, one 1-px glint line crosses the back (4 frames)
// The landing beats run on the scene's update (onFrame: speed / hit-stop aware, whole frames), so
// at ×2 / ×3 the rim's three frames and the latch frame are never skipped (KO-8).
// Reduced motion (KO-9): a straight 160 ms slide without trail or dust, the rim, the seal as one
// latch frame, no glint; ≤ 300 ms. No camera call besides today's unfocus (KO-10).

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { ISO_CX, ISO_CY, isoCanvas, type CardOrientation } from '../../art/cards';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import { addStaticCanvas } from '../../art/textures';
import { CALM, CALM_T, chevronPositions } from '../../view/board-calm/art';
import { DEPTH, type XY } from '../../view/layout';
import { lightPool, type LightHandle } from '../../view/light';
import type { TileCard } from '../../view/TileCard';
import { V3_A6_A } from '../../view/v3flags';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { contour, paletteSteps } from '../../view/v3/ui-kit';
import { TEX } from '../../vfx/core';
import { onFrame } from '../../vfx/setpieces';
import { fx, type CinematicContext } from '../api';
import { V3HOOKS } from './_hooks';

type SetEv = Extract<GameEvent, { type: 'setMonster' | 'setSpellTrap' }>;
type SetCtx = CinematicContext<SetEv>;
type Spot = 'monster' | 'spellTrap';

/**
 * The K4 beats (ms at 1×; the landing ones from the landing frame). K4's 220 / 140 / 20 ms are
 * trimmed by about a frame each way so that, with the frame the flight's tween needs to start and
 * the whole-frame landing, the input returns at ≈ 383 ms (K4: 380; A6_MS.set lock ≤ 400).
 */
export const SET_V3_MS = Object.freeze({
  flight: 210,
  /** The seal: 3 px out at the landing, 2 at +42, 1 at +84, 0 + the white latch frame at +126. */
  seal: [42, 84, 126] as readonly number[],
  /** Input returns (the handler ends) on the first frame at or past this (one frame after the latch). */
  inputBack: 140,
  /** Tail: the chevrons one palette step down at inputBack, another at fade2, gone at end (≤ 200). */
  fade2: 230,
  end: 320,
  /** Reduced motion: the straight slide, and the landing's whole length. */
  reducedFlight: 160,
  reducedLanding: 60,
});

/** Rim tones by frame after the landing: 2 frames white, 1 frame owner tone (K3 / K4). */
const RIM_FRAMES = 3;
/** The glint's frames (≈ 60 ms). */
const GLINT_FRAMES = 4;

// ================================================================ textures (v3 only, made on first use)

/** The iso card's static pixels at rest (exactly what TileCard shows face-down). */
function restPixels(o: CardOrientation, player: PlayerId): PixelCanvas {
  return isoCanvas('back', o, player);
}

/** The 1-px rim around the resting iso card in one palette tone (white, then the owner's tone). */
function rimKey(scene: Phaser.Scene, o: CardOrientation, player: PlayerId, tone: number): string {
  const key = `v3set:rim:${o}:p${player + 1}:${tone.toString(16)}`;
  if (!scene.textures.exists(key)) addStaticCanvas(scene, key, contour(restPixels(o, player), tone).toCanvas());
  return key;
}

/** The card's interior pixels (inside its ink outline), relative to the iso texture's top left. */
const interiorCache = new Map<string, [number, number][]>();
function interior(o: CardOrientation, player: PlayerId): [number, number][] {
  const k = `${o}:${player}`;
  let pts = interiorCache.get(k);
  if (!pts) {
    const px = restPixels(o, player);
    pts = [];
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y) && px.get(x, y) !== PAL.ink) pts.push([x, y]);
    interiorCache.set(k, pts);
  }
  return pts;
}

// ================================================================ the set

async function setV3(ctx: SetCtx, spot: Spot): Promise<void> {
  const ev = ctx.ev;
  void ctx.views.camera.unfocus(120); // today's safety (summon-b/set.ts:35)
  const cardId = ctx.state.cards[ev.uid]?.cardId as CardId | undefined;
  if (!cardId) return;
  const reduced = REDUCED_MOTION;
  const orientation: CardOrientation = spot === 'monster' ? 'side' : 'up';
  ctx.sfx('cardSlide', { volume: 0.7 });

  // the hand card leaves (as today's slamCard: hidden at once, destroyed a little later)
  const card = fx.takeHandCard(ctx, ev.player, ev.uid, null);
  card.setFaceUp(false);
  const from = { x: card.x, y: card.y };
  const scale = card.scaleX;
  card.setVisible(false);
  void ctx.wait(260).then(() => {
    if (card.active) card.destroy();
  });
  const tile = ctx.views.field.placeCard(ev.player, spot, ev.zone, ev.uid, cardId, false, orientation);
  const st: { landing: Landing | null } = { landing: null };
  await tile
    .slamIn(from, reduced ? SET_V3_MS.reducedFlight : SET_V3_MS.flight, {
      fromScale: scale,
      crisp: true,
      trail: !reduced,
      arc: reduced ? 0 : 34,
      onLand: () => {
        st.landing = new Landing(ctx, tile, orientation, ev.player, reduced);
      },
    })
    .catch((e) => console.error('[v3 set] slam', e));
  // a flight cut short (the card left, or a sync took over) lands nothing
  if (st.landing) await st.landing.inputBack;
}

/**
 * Everything that happens from the landing frame on, driven by the scene's update (whole frames;
 * speed and hit-stop scale its clock). Its objects live at the scene root and clean themselves up
 * whatever happens to the card; `inputBack` resolves when the input may return (the latch is over).
 */
class Landing {
  readonly inputBack: Promise<void>;
  private readonly sc: Phaser.Scene;
  private readonly ramp: Ramp;
  private readonly seal: Seal;
  private readonly pool: LightHandle;
  private rim: Phaser.GameObjects.Image | null;
  private glintG: Phaser.GameObjects.Graphics | null = null;
  private glintFrame = -1;
  private frame = 0;
  private sealStep = 0;
  private latched = false;
  private back = false;
  private resolveInput: () => void = () => undefined;

  constructor(
    private readonly ctx: SetCtx,
    private readonly tile: TileCard,
    private readonly o: CardOrientation,
    private readonly player: PlayerId,
    private readonly reduced: boolean,
  ) {
    this.sc = ctx.scene;
    this.ramp = PLAYER_RAMP[player];
    this.inputBack = new Promise((r) => (this.resolveInput = r));
    const home = tile.home;
    ctx.sfx('cardSet', { volume: 0.9 });
    this.rim = this.sc.add
      .image(home.x - ISO_CX - 1, home.y - ISO_CY - 1, rimKey(this.sc, o, player, PAL.white))
      .setOrigin(0, 0)
      .setDepth(DEPTH.CARD_ON_TILE + 0.5);
    if (!reduced) dustMotes(this.sc, home, o, player);
    this.pool = lightPool(this.sc, home.x, home.y, { color: this.ramp[3], radius: 30, fadeIn: 0 });
    this.seal = new Seal(this.sc, home, player);
    this.seal.lineUp(true);
    if (!reduced) this.seal.show(3, this.ramp[3]);
    onFrame(this.sc, (dt, el) => this.step(dt, el));
  }

  /**
   * One frame (`el` = scaled ms since the landing frame). false = done (the onFrame stops). A frame
   * with no scaled time (hit-stop) changes nothing, so the frame-counted beats freeze with the rest.
   */
  private step(dt: number, el: number): boolean {
    if (dt <= 0 && this.frame > 0) return true;
    const f = this.frame++;
    const cardOk = this.tile.active && this.tile.visible && !this.tile.faceUp;
    // ---- rim: frames 0, 1 white; 2 owner tone; then gone (frame-counted: never skipped)
    if (this.rim) {
      if (f >= RIM_FRAMES || !cardOk) {
        this.rim.destroy();
        this.rim = null;
      } else if (f === 2) this.rim.setTexture(rimKey(this.sc, this.o, this.player, this.ramp[3]));
    }
    const S = SET_V3_MS;
    if (this.reduced) {
      // the seal is one white latch frame on the third frame
      if (f === 2) {
        this.seal.show(0, PAL.white);
        this.ctx.sfx('ui3Latch');
      } else if (f > 2) this.seal.hide();
      if (el >= S.reducedLanding && f > 2) return this.finish(true);
      return true;
    }
    // ---- seal: close in three steps, then the latch frame (white), then owner tone
    while (this.sealStep < S.seal.length && el >= S.seal[this.sealStep]) this.sealStep++;
    if (this.sealStep < S.seal.length) this.seal.show(3 - this.sealStep, this.ramp[3]);
    else if (!this.latched) {
      this.latched = true;
      this.seal.show(0, PAL.white);
      this.ctx.sfx('ui3Latch'); // (silent until lane A6-A writes the UI sound recipes, step A7)
      return true; // the latch frame: exactly one frame, whatever the speed
    }
    // ---- input back: line and pad step back, the glint starts, the chevrons begin to fade
    if (this.latched && !this.back && el >= S.inputBack) {
      this.back = true;
      this.seal.lineUp(false);
      this.pool.fadeOut(150);
      this.glintFrame = 0;
      this.resolveInput();
    }
    if (this.latched) {
      // owner tone until the input is back, then two palette steps down (KO: stepped fades)
      const fade = !this.back ? 0 : el < S.fade2 ? 1 : 2;
      this.seal.show(0, this.ramp[3 - fade]);
    }
    // ---- glint: one 1-px line across the back, 4 frames
    if (this.glintFrame >= 0) {
      if (this.glintFrame < GLINT_FRAMES && cardOk) this.drawGlint(this.glintFrame);
      else this.clearGlint();
      this.glintFrame = this.glintFrame < GLINT_FRAMES ? this.glintFrame + 1 : GLINT_FRAMES;
    }
    if (this.back && el >= S.end && this.glintFrame >= GLINT_FRAMES) return this.finish(false);
    return true;
  }

  private finish(reducedPath: boolean): false {
    if (reducedPath) {
      this.seal.lineUp(false);
      this.pool.fadeOut(90);
    }
    this.rim?.destroy();
    this.rim = null;
    this.clearGlint();
    this.seal.destroy();
    this.resolveInput();
    return false;
  }

  /**
   * Frame `i` of the glint: a 1-px stair line parallel to the card's 2:1 iso edges (x − 2y = c),
   * white with an owner ramp[4] pixel beside it on each row, swept across the card's interior only
   * (never over its ink outline).
   */
  private drawGlint(i: number): void {
    const pts = interior(this.o, this.player);
    if (!pts.length) return;
    let cMin = Infinity;
    let cMax = -Infinity;
    for (const [x, y] of pts) {
      cMin = Math.min(cMin, x - 2 * y);
      cMax = Math.max(cMax, x - 2 * y);
    }
    if (!this.glintG) this.glintG = this.sc.add.graphics().setDepth(DEPTH.CARD_ON_TILE + 0.6);
    const g = this.glintG;
    const ox = this.tile.home.x - ISO_CX;
    const oy = this.tile.home.y - ISO_CY;
    const c = Math.round(cMin + ((i + 0.5) / GLINT_FRAMES) * (cMax - cMin));
    g.clear();
    for (const [x, y] of pts) {
      const v = x - 2 * y;
      if (v === c) g.fillStyle(PAL.white, 1).fillRect(ox + x, oy + y, 1, 1);
      else if (v === c + 1) g.fillStyle(this.ramp[4], 1).fillRect(ox + x, oy + y, 1, 1);
    }
  }

  private clearGlint(): void {
    this.glintG?.destroy();
    this.glintG = null;
  }
}

/** Four whole-pixel dust motes kicked out at the card's corners, stepping mist → steel → night4. */
function dustMotes(sc: Phaser.Scene, home: XY, o: CardOrientation, player: PlayerId): void {
  const b = restPixels(o, player).bounds();
  if (!b) return;
  const ox = home.x - ISO_CX;
  const oy = home.y - ISO_CY;
  // the left / right vertices and two points on the front edges; each flies out and down a little
  const midY = Math.round(b.y + (b.h - 1) / 2);
  const bot = b.y + b.h - 1;
  const cx = Math.round(b.x + (b.w - 1) / 2);
  const front = Math.round((midY + bot) / 2) + 1;
  const motes: { x: number; y: number; dx: number; dy: number }[] = [
    { x: b.x - 2, y: midY, dx: -6, dy: 1 },
    { x: b.x + b.w, y: midY, dx: 6, dy: 1 },
    { x: Math.round((b.x + cx) / 2) - 1, y: front, dx: -4, dy: 3 },
    { x: Math.round((cx + b.x + b.w - 1) / 2), y: front, dx: 4, dy: 3 },
  ];
  const tones = [PAL.mist, PAL.steel, PAL.night4];
  for (const m of motes) {
    const img = sc.add
      .image(Math.round(ox + m.x), Math.round(oy + m.y), TEX.px2)
      .setOrigin(0, 0)
      .setTint(tones[0])
      .setDepth(DEPTH.CARD_ON_TILE + 1);
    const x0 = img.x;
    const y0 = img.y;
    const s = { v: 0 };
    sc.tweens.add({
      targets: s,
      v: 1,
      duration: 160,
      onUpdate: () => {
        if (!img.active) return;
        const k = s.v;
        const e = 1 - (1 - k) * (1 - k);
        // out along (dx, dy) with a 2-px hop; whole pixels
        img.setPosition(Math.round(x0 + m.dx * e), Math.round(y0 + m.dy * e - 2 * Math.sin(Math.PI * Math.min(1, k * 1.4))));
        const i = Math.min(2, Math.floor(k * 3));
        img.setTint(tones[i]);
        if (i > 0 && img.texture.key !== TEX.px1) img.setTexture(TEX.px1);
      },
      onComplete: () => img.destroy(),
      onStop: () => img.destroy(),
    });
  }
}

/**
 * The seal on the zone: the calm arena's four highlight chevrons (white masks of its atlas, tinted
 * — the corner language of its target highlight) `d` px out from the tile edge, and the zone line
 * one tone up (the zone's line mask over its own line). Without the calm atlas (another arena) it
 * draws nothing: the rim, dust and light still land the card.
 */
class Seal {
  private readonly tips: Phaser.GameObjects.Image[] = [];
  private line: Phaser.GameObjects.Image | null = null;
  private readonly ok: boolean;

  constructor(
    private readonly sc: Phaser.Scene,
    private readonly at: XY,
    private readonly player: PlayerId,
  ) {
    this.ok = sc.textures.exists(CALM.atlas);
    if (!this.ok) return;
    const tip = (frame: string, fx: boolean, fy: boolean) =>
      sc.add.image(0, 0, CALM.atlas, frame).setOrigin(0, 0).setFlip(fx, fy).setDepth(DEPTH.TILE_FX + 3.5).setVisible(false);
    this.tips.push(tip(CALM.tipT, false, false), tip(CALM.tipT, false, true), tip(CALM.tipL, false, false), tip(CALM.tipL, true, false));
  }

  /** The chevrons `d` px out, in `tone` (whole pixels). */
  show(d: number, tone: number): void {
    if (!this.ok || this.tips.length < 4) return;
    const p = chevronPositions(Math.round(this.at.x), Math.round(this.at.y), d);
    const [t, b, l, r] = this.tips;
    t.setPosition(p.t.x, p.t.y);
    b.setPosition(p.b.x, p.b.y);
    l.setPosition(p.l.x, p.l.y);
    r.setPosition(p.r.x, p.r.y);
    for (const im of this.tips) if (im.active) im.setTint(tone).setVisible(true);
  }

  hide(): void {
    for (const im of this.tips) if (im.active) im.setVisible(false);
  }

  /** The zone line one tone up (on) or back to its own pixels (off). */
  lineUp(on: boolean): void {
    if (!this.ok) return;
    if (!on) {
      this.line?.destroy();
      this.line = null;
      return;
    }
    if (this.line) return;
    const up = paletteSteps(CALM_T.line[this.player], 1, 1)[0];
    // the zone's line mask, centred on the zone like the board's own line overlay, just above it
    this.line = this.sc.add.image(Math.round(this.at.x), Math.round(this.at.y), CALM.atlas, CALM.maskLine).setTint(up).setDepth(DEPTH.TILE + 2.2);
  }

  destroy(): void {
    for (const im of this.tips) if (im.active) im.destroy();
    this.tips.length = 0;
    this.lineUp(false);
  }
}

if (V3_A6_A) V3HOOKS.set = setV3;
