// Widescreen for wide phones (MOBILE only; the desktop game never runs any of this).
//
// The game is laid out for 640×360. A phone in landscape is ~2.17:1, so a 640-wide frame leaves
// empty bars left and right. Here the canvas grows to W = 640 + 2·OX (OX = WIDE_OX, up to 80) and:
//
//   core   Every camera a scene makes keeps the 640×360 frame, moved OX to the right (centred).
//          What it draws is pixel-for-pixel today's game: HUD, menus, cut-ins, cinematics.
//   input  Pointer coordinates stay in that 640 space (a touch in the left bar has x < 0), so no
//          game code changes: ScaleManager.transformX takes OX off, and the two Phaser internals
//          that compare a pointer with camera rectangles (getWorldPoint, getCamerasBelowPointer)
//          put it back.
//   sides  Scenes that opt in (wideSides) get, for every core camera, two "bar" cameras (left and
//          right bar, scissored to the bar) that mirror it exactly: same zoom, scroll, shake, fade,
//          flash and the same objects, placed so a pixel of the frame's coordinate space lands where
//          it would if the frame simply went on. So the arena continues into the bars, a cut-in band
//          drawn past the frame reaches the screen edge, and the centre is never drawn twice.
//          Full-frame screen-space rectangles (the light dim, cinematic dims, fades to black) end at
//          the frame, so each gets a twin across the whole canvas, drawn by the bar cameras only.
//
// Read once at boot (the app is landscape-locked).

import Phaser from 'phaser';
import { GAME_H, GAME_W } from './layout';
import { WIDE_OX } from './mobile';

export { WIDE_OX };
/** Canvas width: GAME_W, plus both side bars on a wide phone. */
export const CANVAS_W: number = GAME_W + WIDE_OX * 2;

type Cam = Phaser.Cameras.Scene2D.Camera & { __side?: boolean };
interface Bar {
  cam: Cam;
  /** The core camera it mirrors. */
  core: Cam;
  side: 'l' | 'r';
}
interface SideState {
  bars: Bar[];
  /** Full-frame screen-space rectangles → their twin across the canvas. */
  twins: Map<Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle>;
}

type Twin = Phaser.GameObjects.Rectangle & { __twin?: boolean };

const sides = new Map<Phaser.Scene, SideState>();

/**
 * Patch Phaser so pointer x stays in 640 space while the core cameras sit OX to the right.
 * Call once, before `new Phaser.Game`.
 */
export function installWide(): void {
  if (!WIDE_OX) return;
  const OX = WIDE_OX;
  const SM = Phaser.Scale.ScaleManager.prototype as unknown as { transformX(pageX: number): number };
  const tx = SM.transformX;
  SM.transformX = function (this: unknown, pageX: number) {
    return tx.call(this, pageX) - OX;
  };
  const CamP = Phaser.Cameras.Scene2D.Camera.prototype as unknown as {
    getWorldPoint(x: number, y: number, out?: Phaser.Math.Vector2): Phaser.Math.Vector2;
  };
  const gwp = CamP.getWorldPoint;
  CamP.getWorldPoint = function (this: unknown, x: number, y: number, out?: Phaser.Math.Vector2) {
    return gwp.call(this, x + OX, y, out);
  };
  const CM = Phaser.Cameras.Scene2D.CameraManager.prototype as unknown as {
    cameras: Cam[];
    getCamerasBelowPointer(p: Phaser.Input.Pointer): Cam[];
  };
  CM.getCamerasBelowPointer = function (this: { cameras: Cam[] }, p: Phaser.Input.Pointer) {
    const x = p.x + OX;
    const y = p.y;
    const out: Cam[] = [];
    for (const c of this.cameras) {
      if (c.visible && c.inputEnabled && x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.height) out.unshift(c);
    }
    return out;
  };
}

/** Every frame, before rendering: keep core cameras centred, glue the side cameras. Call once after `new Phaser.Game`. */
export function driveWide(game: Phaser.Game): void {
  if (!WIDE_OX) return;
  const OX = WIDE_OX;
  game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
    for (const scene of game.scene.getScenes(true)) {
      for (const c of scene.cameras.cameras as Cam[]) {
        if (c.__side) continue;
        // a camera made for the whole canvas (the default main camera) or the 640 frame at x 0
        if (c.x === 0 && (c.width === CANVAS_W || c.width === GAME_W)) c.setViewport(OX, c.y, GAME_W, c.height);
      }
      const s = sides.get(scene);
      if (s) glue(scene, s);
    }
  });
}

/** Give this scene bar cameras (call in create(); the arena scenes: title, duel). */
export function wideSides(scene: Phaser.Scene): void {
  if (!WIDE_OX) return;
  const state: SideState = { bars: [], twins: new Map() };
  sides.set(scene, state);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    sides.delete(scene);
    for (const t of state.twins.values()) t.destroy();
    state.twins.clear();
    for (const b of state.bars) scene.cameras.remove(b.cam);
    state.bars = [];
  });
}

/** One pair of bar cameras per core camera (cores may be added later, e.g. the duel's UI camera). */
function ensureBars(scene: Phaser.Scene, s: SideState): void {
  const mgr = scene.cameras;
  const list = mgr.cameras as Cam[];
  for (const core of list) {
    if (core.__side || s.bars.some((b) => b.core === core)) continue;
    for (const side of ['l', 'r'] as const) {
      const cam = mgr.add(side === 'l' ? 0 : WIDE_OX + GAME_W, 0, WIDE_OX, GAME_H, false, `wide-${side}`) as Cam;
      cam.__side = true;
      cam.inputEnabled = false;
      cam.setRoundPixels(true);
      const bar: Bar = { cam, core, side };
      // after Phaser's own matrix: shift so frame coordinates line up with the core camera (see glue)
      const pre = cam.preRender.bind(cam);
      (cam as unknown as { preRender: () => void }).preRender = () => {
        pre();
        const t = barShift(bar);
        (cam as unknown as { matrix: Phaser.GameObjects.Components.TransformMatrix }).matrix.translate(t.x, t.y);
      };
      s.bars.push(bar);
    }
  }
  // drop bars whose core is gone; keep every bar camera before every core camera (they draw first)
  s.bars = s.bars.filter((b) => {
    if (list.includes(b.core)) return true;
    mgr.remove(b.cam);
    return false;
  });
  const bars = s.bars.map((b) => b.cam);
  const cores = list.filter((c) => !c.__side);
  list.length = 0;
  list.push(...bars, ...cores);
}

/**
 * Local (pre-zoom) shift that maps the frame's coordinates onto this bar the way the core camera maps
 * them onto the frame. Phaser draws a point at  vx + o + z·(p − scroll·sf − o + t)  (o = half the
 * viewport width); the core has vx = OX, o = 320, t = 0. Equal for every point and scroll factor when
 * the bar copies the core's scroll and  t = (OX + 320 − vx − o) / z − 320 + o  (plus the core's shake).
 */
function barShift(b: Bar): { x: number; y: number } {
  const z = b.cam.zoom;
  const o = b.cam.width / 2;
  const vx = b.cam.x;
  const sh = b.core.shakeEffect as unknown as { isRunning: boolean; _offsetX: number; _offsetY: number };
  const shx = sh.isRunning ? sh._offsetX : 0;
  const shy = sh.isRunning ? sh._offsetY : 0;
  return { x: (WIDE_OX + GAME_W / 2 - vx - o) / z - GAME_W / 2 + o + shx, y: shy };
}

type Fx = Record<string, unknown>;
function copyFx(from: unknown, to: unknown, keys: readonly string[]): void {
  const a = from as Fx;
  const b = to as Fx;
  for (const k of keys) b[k] = a[k];
}
const FADE_KEYS = ['isRunning', 'isComplete', 'direction', 'progress', 'alpha', 'red', 'green', 'blue'] as const;
const FLASH_KEYS = ['isRunning', 'progress', 'alpha', 'red', 'green', 'blue'] as const;

type Obj = Phaser.GameObjects.GameObject & { cameraFilter: number; __twin?: boolean };

function glue(scene: Phaser.Scene, s: SideState): void {
  ensureBars(scene, s);
  for (const b of s.bars) {
    const { cam, core } = b;
    cam.setZoom(core.zoom);
    cam.setScroll(core.scrollX, core.scrollY);
    cam.setVisible(core.visible);
    cam.setAlpha(core.alpha);
    // only the bottom core camera paints a background (the others are transparent overlays)
    const bg = core.backgroundColor;
    cam.setBackgroundColor(bg.alpha ? bg.color : 'rgba(0,0,0,0)');
    copyFx(core.fadeEffect, cam.fadeEffect, FADE_KEYS);
    copyFx(core.flashEffect, cam.flashEffect, FLASH_KEYS);
  }
  const list = scene.sys.displayList?.list as Obj[] | undefined;
  if (!list) return;
  syncTwins(scene, s, list);
  // a bar camera draws exactly what its core camera draws (minus what lies wholly inside the frame,
  // which no bar can show); a twin only in the bars of its source's core
  for (const o of list) {
    if (o.__twin) continue;
    for (const b of s.bars) {
      if (o.cameraFilter & b.core.id || insideFrame(o, b.core)) o.cameraFilter |= b.cam.id;
      else o.cameraFilter &= ~b.cam.id;
    }
  }
  for (const [src, t] of s.twins) {
    let f = -1; // hidden everywhere …
    for (const b of s.bars) if (!((src as unknown as Obj).cameraFilter & b.core.id)) f &= ~b.cam.id; // … but the bars of the cores that draw the source
    (t as unknown as Obj).cameraFilter = f;
  }
}

/** A screen-space rectangle that covers the whole 640×360 frame (a dim, a fade, a flash plate). */
function coversFrame(o: Phaser.GameObjects.Rectangle): boolean {
  if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0 || o.rotation !== 0 || o.parentContainer) return false;
  const w = o.width * o.scaleX;
  const h = o.height * o.scaleY;
  const x0 = o.x - w * o.originX;
  const y0 = o.y - h * o.originY;
  return x0 <= 0 && y0 <= 0 && x0 + w >= GAME_W && y0 + h >= GAME_H;
}

/**
 * Full-frame overlays reach the bars too: each gets a twin rectangle from the canvas's left edge to its
 * right edge (in frame coordinates −OX … 640 + OX), copying colour, alpha, blend, depth and visibility.
 */
function syncTwins(scene: Phaser.Scene, s: SideState, list: readonly Phaser.GameObjects.GameObject[]): void {
  const seen = new Set<Phaser.GameObjects.Rectangle>();
  for (const o of list) {
    if (!(o instanceof Phaser.GameObjects.Rectangle) || (o as Twin).__twin || !coversFrame(o)) continue;
    seen.add(o);
    let t = s.twins.get(o);
    if (!t) {
      t = scene.add.rectangle(-WIDE_OX, 0, CANVAS_W, GAME_H).setOrigin(0).setScrollFactor(0) as Twin;
      (t as Twin).__twin = true;
      s.twins.set(o, t);
    }
    t.setFillStyle(o.fillColor, o.fillAlpha)
      .setAlpha(o.alpha)
      .setBlendMode(o.blendMode)
      .setVisible(o.visible)
      .setDepth(o.depth);
  }
  for (const [src, t] of s.twins) {
    if (seen.has(src)) continue;
    t.destroy();
    s.twins.delete(src);
  }
}

const SIMPLE = new Set(['Image', 'Sprite', 'Rectangle', 'BitmapText', 'Text', 'TileSprite']);
type Boundable = Phaser.GameObjects.GameObject & {
  getBounds(): Phaser.Geom.Rectangle;
  scrollFactorX: number;
  rotation: number;
  parentContainer: Phaser.GameObjects.Container | null;
};

/**
 * Cheap cull for the bar cameras: a plain object (no container, no rotation) whose box lies wholly
 * inside the 640 frame as the core camera (at 1×) shows it cannot appear in a bar. Anything else —
 * containers, rotated or zoomed views, effects reaching past the frame — is drawn as usual.
 */
function insideFrame(o: Phaser.GameObjects.GameObject, core: Cam): boolean {
  if (!SIMPLE.has(o.type) || core.zoom !== 1) return false;
  const g = o as Boundable;
  if (g.parentContainer || g.rotation !== 0) return false;
  const r = g.getBounds();
  const x0 = r.x - core.scrollX * g.scrollFactorX;
  return x0 >= 8 && x0 + r.width <= GAME_W - 8; // 8 px: a shake never pushes it into a bar
}
