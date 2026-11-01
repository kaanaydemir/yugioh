// Kabuk Zıpkıncı — world-space bridges for the card's own effect painters (src/art/monsters-v3/tide_harpooner-fx.ts).
// The painters draw on a PixelCanvas; here a `Surface` gives them the same set / get / isOpaque surface over a Px
// (one Graphics, whole pixels, palette colours only, no alpha), so the rope, the exit spray, the wave wall and the
// splinters are drawn in the world (or on the HUD for the LP-panel stake) by the very code the sheet uses.
// Also: the flying harpoon as an image (one cached texture per angle), the KORUNUYOR plate texture, wet beads that
// land as floor dots, the tide sheet over a tile, and the reverse pull (the game's only one).
// Nothing runs at import (lazy caches only); every user is LOOK_V3-gated.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import { harpoonFrame, korunuyorPlate, type HarpoonFrame } from '../../art/monsters-v3/tide_harpooner-fx';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, TILE_H, TILE_W, type XY } from '../../view/layout';
import { sfx, type SfxName } from '../../audio/sfx';
import { canvasTexture } from '../../view/v3/hudSkin';
import { Px, onFrame } from '../../vfx/combat';
import { lightLayer } from '../../view/light';

export const rnd = Math.round;
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const TAU = Math.PI * 2;
export type Pt = readonly [number, number];
export const pt = (p: XY): Pt => [p.x, p.y];
export const xy = (p: Pt): XY => ({ x: p[0], y: p[1] });
export function norm(a: XY): XY {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
}
export const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: XY, b: XY, k = 1): XY => ({ x: a.x + b.x * k, y: a.y + b.y * k });
export const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const snapXY = (p: XY): XY => ({ x: rnd(p.x), y: rnd(p.y) });

/** Deterministic 0…1 hash (films and measure re-run identically). */
export function hash(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ================================================================ a PixelCanvas-like surface over a Px

/** Every display object this card's cinematics create carries this name (the contact sweep never touches them). */
export const OWN = 'thp:own';

/**
 * The painters' surface in world (or screen) pixels: set() paints one whole pixel through the Px and remembers its
 * colour (rope2 reads it back), clear() wipes both. `ox / oy` offset every pixel.
 */
export class Surface {
  readonly px: Px;
  private readonly m = new Map<number, number>();
  ox = 0;
  oy = 0;
  constructor(scene: Phaser.Scene, depth: number, o: { screen?: boolean } = {}) {
    const g = scene.add.graphics().setDepth(depth).setName(OWN);
    if (o.screen) g.setScrollFactor(0);
    this.px = new Px(g);
  }
  private k(x: number, y: number): number {
    return (rnd(y) + 4096) * 16384 + (rnd(x) + 4096);
  }
  set(x: number, y: number, c: number): this {
    this.m.set(this.k(x, y), c);
    this.px.dot(rnd(x) + this.ox, rnd(y) + this.oy, c);
    return this;
  }
  get(x: number, y: number): number | null {
    return this.m.get(this.k(x, y)) ?? null;
  }
  isOpaque(x: number, y: number): boolean {
    return this.m.has(this.k(x, y));
  }
  erase(_x: number, _y: number): this {
    return this;
  }
  clear(): this {
    this.m.clear();
    this.px.clear();
    return this;
  }
  setDepth(d: number): this {
    this.px.g.setDepth(d);
    return this;
  }
  /** As the painters' PixelCanvas (they only call set / get / isOpaque on it). */
  get canvas(): PixelCanvas {
    return this as unknown as PixelCanvas;
  }
  destroy(): void {
    this.m.clear();
    if (this.px.g.active) this.px.g.destroy();
  }
}

// ================================================================ the flying harpoon

/** Harpoon angles are drawn every 2° (each a cached texture). */
const STEP = 2;

/**
 * The thrown harpoon as one image: set(tip, angle) shows the rig's own harpoon (driftwood shaft, lashing, stone head,
 * barbs, the white glint) pointing along `angle` (deg, screen: 0 right, 90 down) with its tip on `tip`. Always lit
 * from the screen's top-left (world-space art: never flipped). `bury` cuts the head into the LP panel.
 */
export class HarpoonImg {
  readonly img: Phaser.GameObjects.Image;
  private f: HarpoonFrame | null = null;
  private tipAt: XY = { x: 0, y: 0 };
  /** the toggle head only (the shaft stays in the claw) */
  readonly dart: boolean;
  /** the angle last set (deg) */
  angle = 0;
  constructor(private readonly scene: Phaser.Scene, depth: number, o: { screen?: boolean; dart?: boolean } = {}) {
    this.img = scene.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(depth).setVisible(false).setName(OWN);
    if (o.screen) this.img.setScrollFactor(0);
    this.dart = !!o.dart;
  }
  /** Place it by its tail (the line end) instead of its tip. */
  setTail(tail: XY, angle: number, o: HarpOpts = {}): this {
    const f = this.frame(angle, o);
    return this.set({ x: tail.x + f.tip[0] - f.butt[0], y: tail.y + f.tip[1] - f.butt[1] }, angle, o);
  }
  private frame(angle: number, o: HarpOpts): HarpoonFrame {
    const a = (((Math.round(angle / STEP) * STEP) % 360) + 360) % 360;
    return harpoonFrame(a, 'left', { bury: o.bury ?? 0, smear: o.smear ?? 0, dart: this.dart });
  }
  set(tip: XY, angle: number, o: HarpOpts = {}): this {
    if (!this.img.active) return this;
    const a = (((Math.round(angle / STEP) * STEP) % 360) + 360) % 360;
    const bury = o.bury ?? 0;
    const smear = o.smear ?? 0;
    const pop = o.pop ? 1 : 0;
    this.angle = angle;
    const f = this.frame(angle, o);
    const key = canvasTexture(this.scene, `thp:harp:${a}:${bury}:${smear}:${this.dart ? 1 : 0}:${pop}`, () => (pop ? popped(f) : f.px));
    if (this.img.texture.key !== key) this.img.setTexture(key);
    this.f = f;
    this.tipAt = snapXY(tip);
    this.img.setPosition(this.tipAt.x - f.tip[0], this.tipAt.y - f.tip[1]).setVisible(true);
    return this;
  }
  /** World point of the line ring (where the rope is tied), for the current frame. */
  ring(): XY {
    if (!this.f) return this.tipAt;
    return { x: this.tipAt.x + this.f.ring[0] - this.f.tip[0], y: this.tipAt.y + this.f.ring[1] - this.f.tip[1] };
  }
  butt(): XY {
    if (!this.f) return this.tipAt;
    return { x: this.tipAt.x + this.f.butt[0] - this.f.tip[0], y: this.tipAt.y + this.f.butt[1] - this.f.tip[1] };
  }
  tip(): XY {
    return this.tipAt;
  }
  get visible(): boolean {
    return this.img.visible;
  }
  hide(): void {
    if (this.img.active) this.img.setVisible(false);
  }
  setDepth(d: number): this {
    if (this.img.active) this.img.setDepth(d);
    return this;
  }
  destroy(): void {
    if (this.img.active) this.img.destroy();
  }
}

export interface HarpOpts {
  bury?: number;
  smear?: number;
  /**
   * The head where it pokes out of a body: a 1-px ink outline round the whole head and the tip pixel white (a grey
   * stone head on a grey stone body would otherwise melt into it).
   */
  pop?: boolean;
}

/** The harpoon frame with a 1-px ink outline and a white tip glint (see HarpOpts.pop). */
function popped(f: HarpoonFrame): PixelCanvas {
  const c = f.px.clone().outline(PAL.ink);
  c.set(f.tip[0], f.tip[1], PAL.white);
  return c;
}

/** Screen angle (deg) of a direction. */
export function angleOf(d: XY): number {
  return (Math.atan2(d.y, d.x) * 180) / Math.PI;
}

// ================================================================ KORUNUYOR

/** The plate's texture key (cached): `big` the one-size-bigger pop, `fade` 0 / 1 / 2 tone steps out. */
export function plateKey(scene: Phaser.Scene, big: boolean, fade: number): { key: string; w: number; h: number } {
  const pc = korunuyorPlate(big, fade);
  const key = canvasTexture(scene, `thp:plate:${big ? 1 : 0}:${fade}`, () => pc);
  return { key, w: pc.w, h: pc.h };
}

// ================================================================ foam beads → wet dots on the floor

interface Bead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  age: number;
  landed: number;
}

/**
 * Foam beads (2-px white) flung off the twirl's front pass: they fly, fall and land as 1-px wet dots (water4 → water3,
 * then gone). One Surface; resolves itself.
 */
export function flingBeads(scene: Phaser.Scene, from: XY, dir: 1 | -1, floorY: number, depth: number, seed: number, n = 4): void {
  const s = new Surface(scene, depth);
  const beads: Bead[] = [];
  for (let i = 0; i < n; i++) {
    const h = hash(seed, i, 7);
    beads.push({ x: from.x, y: from.y, vx: dir * (40 + h * 70) * (i % 2 ? 1 : 0.6), vy: -40 - hash(seed, i, 9) * 50, floor: floorY + rnd(hash(seed, i, 11) * 8) - 4, age: 0, landed: -1 });
  }
  onFrame(scene, (dt, el) => {
    s.clear();
    const k = dt / 1000;
    let alive = 0;
    for (const b of beads) {
      b.age += dt;
      if (b.landed < 0) {
        b.vy += 520 * k;
        b.x += b.vx * k;
        b.y += b.vy * k;
        if (b.y >= b.floor && b.vy > 0) {
          b.y = b.floor;
          b.landed = b.age;
        }
      }
      if (b.landed < 0) {
        alive++;
        s.set(b.x, b.y, PAL.white).set(b.x + 1, b.y, PAL.white).set(b.x, b.y + 1, PAL.water4).set(b.x + 1, b.y + 1, PAL.water4);
      } else {
        const since = b.age - b.landed;
        if (since < 420) {
          alive++;
          s.set(b.x, b.y, since < 200 ? PAL.water4 : PAL.water3);
        }
      }
    }
    return alive > 0 && el < 2000;
  }, () => s.destroy());
}

// ================================================================ the tide sheet over the tile

export interface TideState {
  /** 0…1: how far the sheet has slid in from the back-left (0 none, 1 the whole tile) */
  inK: number;
  /** 0…1: how far it has drawn back out (uncovering wet sand behind it) */
  outK: number;
  /** 0…1: the wet sand fading back to the dry tile (2 palette steps) */
  dry: number;
  /** ms: drifts the ripple dashes on the sheet (optional) */
  t?: number;
}

/**
 * The tide sheet across a tile at `c` (the tile centre on the floor). Review 3: a thin sheet of WATER, not a lit tile —
 *  - the front is SCALLOPED: uneven tongues (two sines and a per-3-row hash) advance from the back-left corner, laced
 *    with a 1–2 px white / water4 foam line that breaks up into beads at the tongue tips;
 *  - the body is a band pattern (water3 / water2 rows, every third row left open) drifting along the sheet, so the
 *    tile reads THROUGH the water;
 *  - drawing back, it leaves wet sand (earth1 / earth2, Bayer 2×2, drying in two steps), a 1-px water4 sheen line on
 *    the sand just behind the receding edge, and three foam beads stranded where the sheet reached furthest.
 * Whole pixels, palette only, always inside the tile's diamond.
 */
export function paintTide(s: Surface, c: XY, st: TideState, seed = 1, scale = 1): void {
  // `scale` > 1 (the death's wash only): the sheet spills past the tile so the burial reads round the damage number
  const hw = Math.floor((TILE_W / 2) * scale) - 2;
  const hh = Math.floor((TILE_H / 2) * scale) - 1;
  const drift = Math.floor((st.t ?? 0) / 110);
  /** the front's scallop offset for row y (ring fraction of the u axis) */
  const scallop = (y: number): number => 0.045 * Math.sin(y * 0.62 + seed) + 0.03 * Math.sin(y * 0.23 + seed * 2.1) + (hash(Math.floor((y + 64) / 3), seed, 3) - 0.5) * 0.04;
  const edgeIn = st.inK * 1.12;
  const edgeOut = st.outK * 1.12;
  for (let y = -hh; y <= hh; y++) {
    // the sheet's sides are ragged too (0–2 px in from the tile's edge, per row): never the tile's own outline
    const span = Math.floor(hw * (1 - Math.abs(y) / (hh + 0.5))) - Math.floor(hash(y + 90, seed, 5) * 2.6);
    const sc = scallop(y);
    for (let x = -span; x <= span; x++) {
      // back-left (u = 0) → front-right (u = 1) across the diamond
      const u = x / (2 * hw) + y / (2 * hh) + 0.5;
      const px = c.x + x;
      const py = c.y + y;
      const fIn = edgeIn + sc;
      const fOut = edgeOut + sc * 0.6;
      if (st.outK > 0 && u <= fOut) {
        // uncovered: wet sand (drying back in two steps), the sheen line just behind the receding edge — only where
        // the sheet actually reached
        if (st.dry >= 1 || u > fIn) continue;
        if (st.dry < 0.5 && st.outK < 1 && fOut - u < 0.025 && ((px + drift) & 1) === 0) {
          s.set(px, py, PAL.water4);
          continue;
        }
        const bayer = (px + py) & 1;
        if (st.dry >= 0.5 && bayer) continue;
        s.set(px, py, st.dry < 0.5 ? (bayer ? PAL.earth1 : PAL.earth2) : PAL.earth1);
        continue;
      }
      if (u > fIn) continue;
      const d = fIn - u;
      // the foam lace on the advancing front: 1 px everywhere, 2 px on the tongue tips (where the scallop leads)
      const lace = sc > 0.02 ? 0.05 : 0.028;
      if (st.outK <= 0 || st.inK < 1) {
        if (d < lace) {
          s.set(px, py, d < 0.018 ? PAL.white : hash(px, py, seed) < 0.5 ? PAL.white : PAL.water4);
          continue;
        }
      }
      // the receding edge's foam line (it trails the water drawing back)
      const fromOut = u - fOut;
      if (st.outK > 0 && fromOut < 0.03) {
        s.set(px, py, hash(px, py, seed + 1) < 0.55 ? PAL.white : PAL.water4);
        continue;
      }
      // the sheet's body: drifting bands, every third row open (the tile shows through)
      const band = (((y + drift + Math.floor(x / 6)) % 3) + 3) % 3;
      if (band === 2) continue;
      s.set(px, py, band === 0 ? PAL.water3 : PAL.water2);
    }
  }
  // three foam beads stranded where the sheet reached furthest, left on the sand as it draws back
  if (st.outK > 0.15 && st.dry < 1) {
    for (let i = 0; i < 3; i++) {
      const y = rnd((i - 1) * hh * 0.55 + (hash(i, seed, 9) - 0.5) * 3);
      const span = Math.floor(hw * (1 - Math.abs(y) / (hh + 0.5)));
      // the furthest reach on this row: u = min(1.12, …) → x
      const uMax = Math.min(0.97, edgeIn + scallop(y) - 0.04);
      const x = clamp(rnd((uMax - 0.5 - y / (2 * hh)) * 2 * hw), -span + 1, span - 1);
      const col = st.dry >= 0.5 ? PAL.water3 : PAL.white;
      s.set(c.x + x, c.y + y, col);
      if (st.dry < 0.5) s.set(c.x + x + 1, c.y + y, PAL.water4);
    }
  }
}

// ================================================================ the pull (toward the crab)

const pulls = new WeakMap<Phaser.GameObjects.Sprite, Phaser.Tweens.Tween>();

/**
 * Haul the struck unit `px` whole pixels toward `toward` (the crab; y × 0.6 on the floor): the knock-back API turned
 * round. It takes over the sprite from the kit's knock (its tweens are stopped), steps one pixel at once, the rest over
 * 70 ms, then (unless `hold`: a death follows from here) eases back to its rest point.
 */
export function haul(u: MonsterUnit, toward: XY, px: number, o: { hold?: boolean; backMs?: number } = {}): void {
  const s = u.sprite;
  if (!s.active || u.retired || px <= 0) return;
  const sc = u.scene;
  sc.tweens.killTweensOf(s);
  pulls.get(s)?.stop();
  const base = u.rest0;
  const d = norm(sub(toward, base));
  const to = { x: rnd(base.x + d.x * px), y: rnd(base.y + d.y * px * 0.6) };
  const first = { x: s.x + Math.sign(to.x - s.x), y: s.y + (to.x === s.x ? Math.sign(to.y - s.y) : 0) };
  s.setPosition(first.x, first.y);
  const tw = sc.tweens.add({
    targets: s,
    x: to.x,
    y: to.y,
    duration: 70,
    ease: 'Quad.Out',
    onUpdate: () => s.setPosition(rnd(s.x), rnd(s.y)),
    onComplete: () => {
      if (o.hold || !s.active) return;
      const back = sc.tweens.add({
        targets: s,
        x: base.x,
        y: base.y,
        delay: 140,
        duration: o.backMs ?? 220,
        ease: 'Quad.InOut',
        onUpdate: () => s.setPosition(rnd(s.x), rnd(s.y)),
      });
      pulls.set(s, back);
    },
  });
  pulls.set(s, tw);
}

// ================================================================ the contact frame is the card's own

/** The shared kit's generic body-blow and clang sounds (v1 recipes, §0.2): never heard on this card's contacts. */
const GENERIC_HIT: readonly SfxName[] = ['impactLight', 'impactHeavy', 'shieldBlock'];

/**
 * Call synchronously ON a contact frame, wrapped round the call that stages it: `stage` is the synchronous contact stack
 * (the strike's s.impact, or the kit's own staging when called from a 'v3:contact' listener — then pass a no-op and the
 * filter stays up only until the end of this tick's microtasks). For that stack only:
 *  - the generic sounds above are dropped at the source (they never start: no transient leaks through a fade);
 *  - `motifs`: the foreign shared motifs the stage draws are hidden on their first frame — the ranged counter's white
 *    lightning bolt (clash.backlash: an ADD image at DEPTH.FX + 3), the hex-shield clang (vfx blockClang: graphics at
 *    DEPTH.FX + 0.1 / + 0.2) and, with `glint`, the guard's dashed hex glint (react guard: graphics at DEPTH.FX + 0.3).
 *  - `struck`: the shared reaction kit's contact visuals on THAT body are the card's to draw (the puncture: an entry
 *    rosette, the exit streaks, the wring on the line): its contact flash (an `fx:cflash:` image at the body's depth
 *    + 0.05, re-made whenever the frame size changes, so it is watched for ~450 ms) and the impact burst drawn behind
 *    the body (vfx/combat impact at the body's depth − 0.4: the star / shock-ring layer at + 0.1 and the glow motes at
 *    + 0.3 hidden at once; the material sparks at + 0.2 allowed for 2 raw frames — a ≤ 8-px fleck — then hidden).
 *    tests/art/tide_harpooner.test.ts pins those depths in the shared kits' source.
 * The card draws its own beat in their place (`after`). The global sfx.play is restored in a finally right after
 * `stage` returns (a throw never leaves it patched); a listener-side call (no stage of its own) restores it in the
 * same microtask, still the contact frame. Objects named OWN (this card's) are never touched.
 */
export function ownContact(scene: Phaser.Scene, o: { motifs?: boolean; glint?: boolean; stage?: () => void; struck?: MonsterUnit | null } = {}, after?: () => void): void {
  const before = o.motifs || o.struck ? new Set(scene.children.list) : null;
  const orig = sfx.play;
  const ban = new Set(GENERIC_HIT);
  const mine: typeof sfx.play = (name, opts) => {
    if (ban.has(name)) return;
    orig.call(sfx, name, opts);
  };
  const restore = () => {
    if (sfx.play === mine) sfx.play = orig;
  };
  const tDepth = o.struck && o.struck.sprite.active ? o.struck.sprite.depth : null;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  /** sweep one object the contact stack made (true: it is a struck-kit object and was dealt with) */
  const sweepStruck = (c: Phaser.GameObjects.GameObject): void => {
    if (tDepth === null || c.name === OWN) return;
    const g = c as Phaser.GameObjects.Image;
    const d = g.depth;
    // alpha, not visibility: the kits re-assert setVisible every tick (contactFlash syncs it to the body's)
    if (c.type === 'Image' && g.texture?.key?.startsWith('fx:cflash:') && near(d, tDepth + 0.05)) g.setAlpha(0);
    else if (c.type === 'Graphics') {
      const rel = d - (tDepth - 0.4);
      if (near(rel, 0.1) || near(rel, 0.3)) g.setAlpha(0);
      else if (near(rel, 0.2)) rawFramesFx(scene, 2, () => g.active && g.setAlpha(0));
    }
  };
  const finish = () => {
    restore();
    if (before) {
      for (const c of scene.children.list) {
        if (before.has(c) || c.name === OWN) continue;
        const g = c as Phaser.GameObjects.Image;
        const d = g.depth;
        if (o.motifs) {
          const bolt = c.type === 'Image' && d === DEPTH.FX + 3 && g.blendMode === Phaser.BlendModes.ADD;
          const clang = c.type === 'Graphics' && (d === DEPTH.FX + 0.1 || d === DEPTH.FX + 0.2 || (o.glint === true && d === DEPTH.FX + 0.3));
          if (bolt || clang) g.setVisible(false);
        }
        sweepStruck(c);
      }
      if (tDepth !== null) {
        // the contact flash re-makes its image when the struck frame changes size: keep watching for a moment
        const seen = new Set(scene.children.list);
        let k = 0;
        const upd = () => {
          if (++k > 28) return void scene.events.off('update', upd);
          for (const c of scene.children.list) {
            if (seen.has(c)) continue;
            seen.add(c);
            const g = c as Phaser.GameObjects.Image;
            if (c.type === 'Image' && c.name !== OWN && g.texture?.key?.startsWith('fx:cflash:') && near(g.depth, tDepth + 0.05)) g.setAlpha(0);
          }
        };
        scene.events.on('update', upd);
        scene.events.once('shutdown', () => scene.events.off('update', upd));
      }
    }
    try {
      after?.();
    } catch (e) {
      console.error('[tide_harpooner] contact', e);
    }
  };
  sfx.play = mine;
  // the shared contact light (battle contactLight: a 36-px pale pool + air bloom over the struck body, which read as a
  // white egg over the entry) is the card's too while the stage runs: a small wet water4 glint at the hole instead
  const L = tDepth !== null ? lightLayer(scene) : null;
  const lflash = L?.flash;
  if (L && lflash) {
    L.flash = (x, y, _c, radius, ms, fo = {}) => lflash.call(L, x, y, PAL.water4, Math.min(radius, 14), Math.min(ms, 160), { ...fo, ring: false, air: 0.15, intensity: Math.min(fo.intensity ?? 0.6, 0.35) });
  }
  const unlight = () => {
    if (L && lflash) delete (L as { flash?: unknown }).flash;
  };
  if (o.stage) {
    try {
      o.stage();
    } finally {
      restore();
      unlight();
    }
    // the kit may open its motifs a microtask later (async stage): sweep them then, still the contact frame
    queueMicrotask(finish);
    return;
  }
  unlight();
  queueMicrotask(finish);
}

/** Run `fn` after `n` RAW rendered frames (scene updates, counted even through a hit-stop's frozen clock). */
export function rawFramesFx(sc: Phaser.Scene, n: number, fn: () => void): void {
  let k = 0;
  const upd = () => {
    if (++k < n + 1) return;
    sc.events.off('update', upd);
    try {
      fn();
    } catch (e) {
      console.error('[tide_harpooner]', e);
    }
  };
  sc.events.on('update', upd);
  sc.events.once('shutdown', () => sc.events.off('update', upd));
}

// ================================================================ the target's silhouette (the puncture)

/** Is world point `p` on an opaque pixel of the unit's sprite, as it shows NOW (frame, flip, position)? */
export function opaqueAt(u: MonsterUnit, p: XY): boolean {
  const s = u.sprite;
  if (!s.active || !s.visible) return false;
  const l = s.getWorldTransformMatrix().applyInverse(p.x, p.y);
  const w = s.frame.realWidth;
  const v = l.x + s.displayOriginX;
  const fx = Math.floor(s.flipX ? w - v : v);
  const fy = Math.floor(l.y + s.displayOriginY);
  if (fx < 0 || fy < 0 || fx >= w || fy >= s.frame.realHeight) return false;
  try {
    return (s.scene.textures.getPixelAlpha(fx, fy, s.texture.key, s.frame.name) ?? 0) >= 128;
  } catch {
    return false;
  }
}

/**
 * Along `dir` from `from` (inside the body): the last opaque pixel before the silhouette is left for good (`gap` clear
 * pixels in a row), within `max` px. Null when it never leaves.
 */
export function farEdge(u: MonsterUnit, from: XY, dir: XY, max = 90, gap = 3): XY | null {
  let last: XY = from;
  let clear = 0;
  for (let d = 1; d <= max; d++) {
    const p = add(from, dir, d);
    if (opaqueAt(u, p)) {
      last = p;
      clear = 0;
    } else if (++clear >= gap) return snapXY(last);
  }
  return null;
}

// ================================================================ the cut-in speaks with the card's own kit

/**
 * While the shared cut-in inside the summon runs, ONLY its four known stingers are answered by this card's own sounds
 * (§0.2: lane C never plays 'whoosh' / 'impactHeavy', not even as a quiet fill; the slam / exit stingers are the
 * wyrm's too): the band's whoosh becomes a rope whirr (harpSwish, lower), the plate's cardSlam the conch-shell slam
 * (a low harpShellTok), its impactHeavy layer is dropped (the tok IS the slam) and the exit's summonBurst a foam
 * spray (harpBeads). Every other name passes through untouched, whoever plays it. The global sfx.play is restored on
 * the exit stinger (the cut-in's last sound), when `until` settles or after `maxMs`, whichever comes first.
 */
export function cutinVoice(scene: Phaser.Scene, until: Promise<unknown>, maxMs = 1700): void {
  const orig = sfx.play;
  let done = false;
  const restore = () => {
    if (done) return;
    done = true;
    if (sfx.play === mine) sfx.play = orig;
  };
  const vol = (opts: Parameters<typeof sfx.play>[1], k: number) => Math.min(1, (opts?.volume ?? 1) * k);
  const mine: typeof sfx.play = (name, opts) => {
    switch (name) {
      case 'whoosh':
        return orig.call(sfx, 'harpSwish', { ...opts, pitch: 0.8 * (opts?.pitch ?? 1), volume: vol(opts, 1.2) });
      case 'cardSlam':
        return orig.call(sfx, 'harpShellTok', { ...opts, pitch: 0.72, volume: vol(opts, 2.2) });
      case 'impactHeavy':
        return;
      case 'summonBurst':
        restore();
        return orig.call(sfx, 'harpBeads', { ...opts, pitch: 0.9, volume: vol(opts, 2.6) });
      default:
        return orig.call(sfx, name, opts);
    }
  };
  sfx.play = mine;
  void until.then(restore, restore);
  const t = scene.time.delayedCall(maxMs, restore);
  scene.events.once('shutdown', () => {
    t.remove(false);
    restore();
  });
}
