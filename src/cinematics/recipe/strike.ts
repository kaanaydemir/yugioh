// The recipe layer — strikes (docs/v3/A3_MIMARI.md §6.2). A strike built from a presentation recipe for a
// monster that does not draw its own (`custom.strike`): src/cinematics/recipe/install.ts registers it
// (registerStrike, priority 10) only in the v3 look and only for a monster with v3 art. The building
// blocks are the v3 kits'; the recipe only chooses and parametrises. A3 builds ONE kind, the pilot's
// 'throw' (Taş Muhafız); each other kind arrives with its first real user and its own reference film
// and measure budget (projectile / lunge A4.1 with Magma Titanı, beam with Mercan Yılanı).
//
// The timeline every kind follows (A2's timing rules): the declaration held the attack's 'charge'
// frame (battle/declare.ts) with the character's charge voice running → the strike continues the
// attack from there (strikeStartFrame) and takes that voice over (takeCharge) → on the 'release' frame
// the effect leaves the recipe's origin point (`attack.from`) AS DRAWN ON THAT FRAME (REHBER HA-25) →
// on contact s.impact() (the battle handler stages the hit-stop, the number, the reactions — the
// struck body plays its material, _v3/react.ts) → 'recover' → home. A losing attacker resolves right
// after the contact (the handler takes the body over, _v3/clash.ts).
//
// 'throw' (shared by every thrower, parametrised by the material): the projectile leaves points[from]
// of the release frame (the art draws what the hand holds up to that frame: the hand and the rock are
// one picture until it lets go); a parabola; it spins (8 whole-pixel turns, lit from the top-left
// whatever its turn) — the thrower's OWN projectile when one is registered under its `attack.vfx`
// (registerProjectile, `recipe/projectiles/<vfx>.ts`: drawn with the art's own part painter, so the
// rock it holds and the rock that flies are one drawing), else a faceted lump in its material's
// tones; its shadow slides over the floor from the thrower to the target, shrinking and
// thinning with height (dithered, never alpha); on contact it bursts into its material's pieces that
// bounce on the floor and a low dust cloud rolls out; blocked, `attack.blocked` ('shatter': it breaks
// on the guard and the pieces fly back; 'rebound': it glances off, falls short and breaks on the floor);
// a direct attack lands it on the duelist.
//
// Hooks (the card's flourishes, recipe.hooks → src/cinematics/recipe/hooks/<id>.ts, the normal tier's
// ornament budget): onCharge (the strike starts), onRelease, onContact, onRecover — each gets the beat's
// world point and the attack frame shown (StrikeHookArgs). They run beside the timeline (never awaited).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { hasMaterial, materialOf as materialDef, type MaterialDef } from '../../art/materials';
import type { MonsterPointName } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { AttackType, PresentationRecipe, RecipeHooks, StrikeHook } from '../../presentation/types';
import { DEPTH, type XY } from '../../view/layout';
import { Sparks, onFrame, sleep } from '../../vfx/combat';
import { Raster } from '../../vfx/setpieces';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, atMark, panAt, play, soundsOf, takeCharge } from '../_v3/sound';
import { currentPixels } from '../strikes-a/_kit';

// ================================================================ hooks (lazy modules, preloaded at install)

const HOOKS = new Map<string, RecipeHooks | null>();

/** Start loading a recipe's hooks module (install.ts, so a strike never waits for a module fetch). */
export function preloadHooks(r: PresentationRecipe): void {
  if (!r.hooks || HOOKS.has(r.id)) return;
  HOOKS.set(r.id, null);
  r.hooks()
    .then((m) => HOOKS.set(r.id, m.default ?? null))
    .catch((e) => console.error(`[recipe] hooks of ${r.id} failed to load`, e));
}

/** A recipe's hooks (null: none). Loaded at install; the first use before that waits for the module. */
export async function hooksOf(r: PresentationRecipe): Promise<RecipeHooks | null> {
  if (!r.hooks) return null;
  const have = HOOKS.get(r.id);
  if (have) return have;
  try {
    const m = await r.hooks();
    HOOKS.set(r.id, m.default ?? null);
    return m.default ?? null;
  } catch (e) {
    console.error(`[recipe] hooks of ${r.id} failed to load`, e);
    return null;
  }
}

// ================================================================ small helpers

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: XY): number => Math.hypot(a.x, a.y);
const norm = (a: XY): XY => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

/**
 * The world point of a named art point (`from`) on attack frame `frame` (default: the frame shown),
 * wherever the sprite stands now; the art's static muzzle / core when the art has no such point.
 */
export function originPoint(u: MonsterUnit, from: MonsterPointName, frame?: number): XY {
  const fi = u.frameInfo();
  const anim = frame !== undefined ? 'attack' : fi.anim;
  const f = frame ?? fi.frame;
  const p = anim && u.art.points ? u.art.points(anim, f)[from] : undefined;
  if (p) return rint(u.framePoint(p.x, p.y));
  return rint(from === 'core' ? u.core() : u.muzzle());
}

/**
 * Where something coming from `from` meets the body of `t`: walk from its core toward `from` along the
 * opaque pixels of the frame it shows now, `out` px past the last one (a projectile's radius); never
 * closer than 6 px to `from`. null when the unit is gone or nothing is hit.
 */
export function surfaceToward(t: MonsterUnit | null, from: XY, out = 0): XY | null {
  if (!t || t.retired || !t.sprite.active || !t.sprite.visible) return null;
  const spr = t.sprite;
  const core = t.core();
  const pc = currentPixels(t).pc;
  const m = spr.getWorldTransformMatrix();
  const w = spr.frame.realWidth;
  const d = norm(sub(from, core));
  const reach = len(sub(from, core));
  let last = -1;
  let gap = 0;
  for (let i = 0; i < reach; i++) {
    const q = m.applyInverse(core.x + d.x * i, core.y + d.y * i);
    const lx = q.x + spr.displayOriginX;
    const fx = Math.floor(spr.flipX ? w - lx : lx);
    const fy = Math.floor(q.y + spr.displayOriginY);
    if (pc.isOpaque(fx, fy)) {
      last = i;
      gap = 0;
    } else if (last >= 0 && ++gap > 2) break;
  }
  if (last < 0) return null;
  const k = Math.max(0, Math.min(last + out, reach - 6));
  return rint({ x: core.x + d.x * k, y: core.y + d.y * k });
}

/** Run a hook beside the timeline (errors are logged, never awaited). */
function runHook(h: StrikeHook | undefined, s: StrikeArgs, r: PresentationRecipe, at: XY, frame: number): void {
  if (!h) return;
  try {
    void Promise.resolve(h({ s, recipe: r, at, frame })).catch((e) => console.error('[recipe] strike hook', e));
  } catch (e) {
    console.error('[recipe] strike hook', e);
  }
}

/** The material a recipe's projectile is made of: its body's physical material (null: unknown id). */
function projectileMaterial(r: PresentationRecipe): MaterialDef | null {
  const id = r.body.physical;
  return hasMaterial(id) ? materialDef(id) : null;
}

// ================================================================ the projectile (whole-pixel turns)

const TURNS = 8;
const ROCK_R = 6;
const ROCK_S = ROCK_R * 2 + 5;
/** A registered projectile drawing is centred in a frame of at most this size (px; cropped beyond). */
const PROJ_MAX = 32;

/**
 * A thrower's own projectile (A3 core review F3: without one every thrower would throw the same
 * lump): turn `turn` of `turns` in `mat`'s tones. Turn 0 is the projectile as the art holds it on
 * the release frame; every turn stays lit from the top-left whatever its rotation (the light stays
 * put while it spins). Any size up to PROJ_MAX × PROJ_MAX, drawn centred on the flight point; its
 * opaque extent is the contact radius. Paint it with the art's own part painter (exported by the
 * art's -parts module) so the held rock and the thrown rock are one drawing. Deterministic.
 */
export type ProjectileDraw = (a: { mat: MaterialDef | null; turn: number; turns: number }) => PixelCanvas;

const PROJECTILES = new Map<string, ProjectileDraw>();
/** Registrations per name (the texture key carries it: a re-registered drawing never reuses a stale sheet). */
const PROJ_VERSION = new Map<string, number>();

/**
 * Register the projectile a recipe names by `attack.vfx` (`recipe/projectiles/<vfx>.ts` at module load:
 * the cinematics loader loads it with every other cinematics file, before anything plays). It counts in
 * its first user's ornament budget (A3_MIMARI §6.2, ≤ 250 lines with the hooks and set pieces).
 * Returns its unregister.
 */
export function registerProjectile(vfx: string, draw: ProjectileDraw): () => void {
  PROJECTILES.set(vfx, draw);
  PROJ_VERSION.set(vfx, (PROJ_VERSION.get(vfx) ?? 0) + 1);
  return () => {
    if (PROJECTILES.get(vfx) === draw) PROJECTILES.delete(vfx);
  };
}

/** The registered projectile of `attack.vfx`, or null (the throw draws its default faceted lump). */
export function projectileOf(vfx: string | null | undefined): ProjectileDraw | null {
  return (vfx && PROJECTILES.get(vfx)) || null;
}

/** A projectile's sheet: TURNS frames of `size` px, and its contact radius (px). */
export interface ProjectileSheet {
  key: string;
  size: number;
  r: number;
}

/** The projectile sheets built so far (key → size and radius; the texture itself lives in the scene's manager). */
const SHEETS = new Map<string, ProjectileSheet>();

/**
 * The TURNS frames of a registered drawing, each centred in a square frame (the largest turn's size,
 * ≤ PROJ_MAX), and the contact radius: the farthest opaque pixel from the frame's centre over all turns.
 */
export function projectileFrames(draw: ProjectileDraw, mat: MaterialDef | null): { frames: PixelCanvas[]; size: number; r: number } {
  const turns = Array.from({ length: TURNS }, (_, turn) => draw({ mat, turn, turns: TURNS }));
  const size = Math.min(PROJ_MAX, Math.max(3, ...turns.map((q) => Math.max(q.w, q.h))));
  let r2 = 0;
  const frames = turns.map((q) => {
    const f = new PixelCanvas(size, size);
    f.blit(q, Math.floor((size - q.w) / 2), Math.floor((size - q.h) / 2));
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) if (f.isOpaque(x, y)) r2 = Math.max(r2, (x + 0.5 - size / 2) ** 2 + (y + 0.5 - size / 2) ** 2);
    return f;
  });
  return { frames, size, r: Math.max(1, Math.round(Math.sqrt(r2))) };
}

/**
 * The spinning projectile's sheet. A registered drawing (projectileOf(vfx)) when there is one; else an
 * irregular faceted lump in the material's tones, TURNS rotations, each facet toned by where it faces
 * the key light (top-left) on that turn — the light stays put while the rock turns — a 1-px edge
 * highlight on the lit rim, an ink outline.
 */
function ensureProjectile(scene: Phaser.Scene, vfx: string, mat: MaterialDef | null): ProjectileSheet {
  const id = mat?.id ?? 'stone';
  const own = projectileOf(vfx);
  const key = `recipe:proj:${vfx}:${id}${own ? `:own${PROJ_VERSION.get(vfx) ?? 0}` : ''}`;
  const cached = SHEETS.get(key);
  if (cached && scene.textures.exists(key)) return cached;
  if (own) {
    const { frames, size, r } = projectileFrames(own, mat);
    const sheet = new PixelCanvas(size * TURNS, size);
    frames.forEach((f, i) => sheet.blit(f, i * size, 0));
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
      for (let f = 0; f < TURNS; f++) tex.add(f, 0, f * size, 0, size, size);
    }
    const out = { key, size, r };
    SHEETS.set(key, out);
    return out;
  }
  const out = { key, size: ROCK_S, r: ROCK_R };
  SHEETS.set(key, out);
  if (scene.textures.exists(key)) return out;
  const ramp = mat ? mat.draw.ramp : [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
  const hi = mat?.draw.edge.hi ?? PAL.stone4;
  const crease = ramp[0];
  const R = [6.3, 5.4, 6.1, 5.6, 6.4, 5.2, 6.0, 5.7];
  const sheet = new PixelCanvas(ROCK_S * TURNS, ROCK_S);
  const c = ROCK_S / 2;
  const L = norm({ x: -1, y: -1.2 });
  for (let f = 0; f < TURNS; f++) {
    const rot = (f / TURNS) * Math.PI * 2;
    const q = new PixelCanvas(ROCK_S, ROCK_S);
    const pts: XY[] = R.map((rr, i) => {
      const a = (i / R.length) * Math.PI * 2 + 0.2 + rot;
      return { x: c + Math.cos(a) * rr, y: c + Math.sin(a) * rr * 0.9 };
    });
    // facets: triangles from a lit off-centre peak, toned by their outward normal against the light
    const peak = { x: c - 0.8, y: c - 1 };
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const n = norm({ x: (a.x + b.x) / 2 - c, y: (a.y + b.y) / 2 - c });
      const lit = n.x * L.x + n.y * L.y;
      // three planes, as the material draws a block: lit top-left, mid front, shadow lower-right
      const tone = lit > 0.3 ? ramp[ramp.length - 1] : lit > -0.3 ? ramp[Math.max(1, ramp.length - 2)] : ramp[Math.max(1, ramp.length - 3)];
      q.poly([[peak.x, peak.y], [a.x, a.y], [b.x, b.y]], tone);
    }
    // one carved crease across the shadow side
    const k0 = pts[(5 + Math.round(f / 2)) % pts.length];
    q.set(Math.round((k0.x + c) / 2), Math.round((k0.y + c) / 2), crease);
    q.set(Math.round((k0.x * 2 + c) / 3), Math.round((k0.y * 2 + c) / 3), crease);
    // the lit rim: opaque pixels on the light side with an empty neighbour toward the light
    for (let y = 0; y < ROCK_S; y++)
      for (let x = 0; x < ROCK_S; x++) {
        if (!q.isOpaque(x, y)) continue;
        if (!q.isOpaque(x - 1, y) && !q.isOpaque(x, y - 1) && x < c && y < c + 1) q.set(x, y, hi);
      }
    q.outline(PAL.ink);
    sheet.blit(q, f * ROCK_S, 0);
  }
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  for (let f = 0; f < TURNS; f++) tex.add(f, 0, f * ROCK_S, 0, ROCK_S, ROCK_S);
  return out;
}

/** The house shadow (MonsterUnit's): a solid ink core, a checkered band, a sparse rim — whole pixels. */
function floorShadow(g: Raster, cx: number, cy: number, rx: number): void {
  const ry = Math.max(1, Math.round(rx * 0.42));
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const dx = x / (rx + 0.5);
      const dy = y / (ry + 0.5);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const X = cx + x;
      const Y = cy + y;
      if (d < 0.45 || (d < 0.75 && (X + Y) % 2 === 0) || (d >= 0.75 && X % 2 === 0 && Y % 2 === 0)) g.px(X, Y, PAL.ink);
    }
}

/** The burst of a thrown body of `mat` at `at`: its pieces bounce on `floorY`, a low dust cloud rolls out. */
export function materialBurst(scene: Phaser.Scene, at: XY, floorY: number, dir: XY, mat: MaterialDef | null, o: { rebound?: boolean; big?: number; seed?: number } = {}): void {
  const rnd = mulberry32(o.seed ?? 11);
  const rr = (a: number, b: number) => a + (b - a) * rnd();
  const k = o.big ?? 1;
  const ramp = mat ? mat.draw.ramp : [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
  const lit = [mat?.draw.edge.hi ?? ramp[ramp.length - 1], ...[...ramp].reverse()];
  const dust = [ramp[ramp.length - 1], ramp[Math.max(0, ramp.length - 2)], ramp[Math.max(0, ramp.length - 3)]];
  const sp = new Sparks(scene, DEPTH.FX + 2);
  const low = new Sparks(scene, DEPTH.FX + 1);
  const base = Math.atan2(dir.y, dir.x) + (o.rebound ? Math.PI : 0);
  // the big pieces (lit facet first, so they read on the dark floor)
  for (let i = 0; i < Math.round(7 * k); i++) {
    const a = base + rr(-1.3, 1.3);
    const v = rr(60, 140);
    sp.add({ x: Math.round(at.x + rr(-3, 3)), y: Math.round(at.y + rr(-3, 3)), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - rr(60, 120), ay: 520, rot: rr(0, 6), vrot: rr(-12, 12), life: rr(560, 860), colors: lit, shape: 'shard', size: rr(2.6, 3.8), floor: floorY + Math.round(rr(-2, 3)), bounce: 0.33, fadeAt: 1 });
  }
  // grit
  for (let i = 0; i < Math.round(12 * k); i++) {
    const a = rr(0, Math.PI * 2);
    const v = rr(50, 150);
    sp.add({ x: Math.round(at.x), y: Math.round(at.y), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 60, ay: 600, life: rr(300, 560), colors: lit.slice(1), shape: i % 3 ? 'px' : 'sq', size: 2, floor: floorY + Math.round(rr(-2, 4)), bounce: 0.25, fadeAt: 1 });
  }
  // the low dust cloud rolls out along the floor, then lifts a little
  for (let i = 0; i < Math.round(7 * k); i++) {
    const a = rr(0, Math.PI * 2);
    const r = rr(3, 9);
    low.add({ x: Math.round(at.x + Math.cos(a) * r), y: Math.round(floorY - 2 + Math.sin(a) * r * 0.4), vx: Math.cos(a) * rr(28, 56), vy: Math.sin(a) * rr(5, 12) - rr(3, 9), drag: 2.6, life: rr(520, 760), colors: dust, shape: 'puff', size: rr(2.2, 3.4), grow: 5, fadeAt: 1, delay: rr(10, 80) });
  }
  sp.release();
  low.release();
}

/**
 * Fly the projectile from `from` to `to` along a parabola: whole-pixel positions, TURNS-step spin, the
 * shadow sliding over the floor from `g0` to `g1`, grains falling off. Resolves on arrival with the
 * projectile still drawn on its contact point (that frame shows it touching the body); `clear()` removes
 * it — call it once the contact is staged, it takes effect on the next update (the contact frame's), so
 * no frame shows neither the rock nor the blow.
 */
function flyThrow(s: StrikeArgs, r: PresentationRecipe, mat: MaterialDef | null, from: XY, to: XY, g0: XY, g1: XY, rnd: () => number): { arrived: Promise<void>; clear(): void } {
  const sc = s.scene;
  const { key } = ensureProjectile(sc, r.attack.vfx, mat);
  const dist = len(sub(to, from));
  const ms = r.attack.travel?.ms ?? clamp(Math.round(230 + dist * 1.45), 300, 560);
  const arc = r.attack.travel?.arc ?? clamp(Math.round(dist * 0.38), 16, 52);
  const spin = to.x >= from.x ? 1 : -1;
  const rock = sc.add.image(from.x, from.y, key, 0).setDepth(DEPTH.FX - 4);
  const x0 = Math.floor(Math.min(g0.x, g1.x) - 12);
  const y0 = Math.floor(Math.min(g0.y, g1.y) - 6);
  const shadow = new Raster(sc, x0, y0, Math.ceil(Math.abs(g1.x - g0.x) + 24), Math.ceil(Math.abs(g1.y - g0.y) + 12), DEPTH.SHADOW + 0.5);
  const ramp = mat ? mat.draw.ramp : [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
  const grains = new Sparks(sc, DEPTH.FX - 5);
  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    onFrame(sc, () => {
      rock.destroy();
      shadow.destroy();
      return false;
    });
  };
  const arrived = new Promise<void>((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      grains.release();
      resolve();
    };
    onFrame(
      sc,
      (dt, el) => {
        if (!rock.active) {
          end();
          return false;
        }
        const t = Math.min(1, el / ms);
        const p = rint({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - arc * 4 * t * (1 - t) });
        rock.setPosition(p.x, p.y);
        const f = Math.floor(el / 55) % TURNS;
        rock.setFrame(spin > 0 ? f : (TURNS - f) % TURNS);
        // the shadow: a dithered ellipse sliding thrower → target, smaller and fainter the higher the rock flies
        const gp = { x: g0.x + (g1.x - g0.x) * t, y: g0.y + (g1.y - g0.y) * t };
        const h = Math.max(0, gp.y - p.y);
        const rx = clamp(Math.round(6 - h / 14), 3, 6);
        shadow.draw((g) => floorShadow(g, Math.round(gp.x), Math.round(gp.y), rx));
        shadow.img.setAlpha(0.5 * Math.max(0.35, 1 - h / 80));
        if (dt > 0 && t < 0.92 && rnd() < 0.45) grains.add({ x: p.x + Math.round(rnd() * 6 - 3), y: p.y + Math.round(rnd() * 5 - 2), vx: rnd() * 16 - 8, vy: 6 + rnd() * 14, ay: 300, life: 220 + rnd() * 160, colors: [ramp[ramp.length - 1], ramp[Math.max(0, ramp.length - 2)]], shape: 'px', fadeAt: 1 });
        if (t >= 1) {
          end();
          return false;
        }
        return true;
      },
      end,
    );
  });
  return { arrived, clear };
}

// ================================================================ 'throw'

/** The 'throw' strike (see the header). */
async function throwStrike(s: StrikeArgs, r: PresentationRecipe, hooks: RecipeHooks | null): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const rnd = mulberry32(u.uid * 977 + (s.target?.uid ?? 3) * 31 + 7);
  const res = s.ctx.ev.result;
  const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
  const voice = soundsOf(u.cardId);
  const pan = panAt(u.home.x);
  const mat = projectileMaterial(r);
  const n = u.frameCount('attack');
  const f0 = strikeStartFrame(u);
  const REL = clamp(u.markFrame('attack', 'release', u.impactFrame), 0, Math.max(0, n - 1));
  // ---- the gathering goes on from the declaration's held charge pose (its voice taken over)
  const charge = voice ? takeCharge(u, voice.charge, { volume: 0.85, pan }) : null;
  runHook(hooks?.onCharge, s, r, originPoint(u, r.attack.from), u.frameInfo().frame);
  void u.playRange('attack', f0);
  // ---- the release frame: the projectile leaves the origin point drawn on THAT frame
  if (f0 < REL) {
    let fire!: () => void;
    const reached = new Promise<void>((ok) => (fire = ok));
    const cancel = atFrame(u, 'attack', REL, () => fire(), { maxMs: 4000 });
    await Promise.race([reached, sleep(sc, u.rangeMs('attack', f0, REL) + 400)]);
    cancel();
  }
  charge?.stop(30);
  if (voice) play(voice.release, { volume: 0.85, pan });
  else s.ctx.sfx('whoosh', { volume: 0.7, pitch: 0.6 });
  const from = originPoint(u, r.attack.from, REL);
  runHook(hooks?.onRelease, s, r, from, REL);
  // ---- the flight: to the body's face (a guard's face when blocked), or the duelist
  const target = s.direct ? null : s.target;
  const face = surfaceToward(target, from, s.blocked ? 1 : ensureProjectile(sc, r.attack.vfx, mat).r - 1);
  const dirIn = norm(sub(s.to, from));
  const to = face ?? (s.blocked ? rint({ x: s.to.x - dirIn.x * 8, y: s.to.y - dirIn.y * 8 }) : rint(s.to));
  const g0 = { x: u.home.x + (target ? norm(sub(target.home, u.home)).x * 10 : 0), y: u.home.y };
  const g1 = target ? { x: target.home.x - dirIn.x * 6, y: target.home.y } : s.toGround;
  const fly = flyThrow(s, r, mat, from, to, g0, g1, rnd);
  await fly.arrived;
  // ---- contact: the battle handler stages the hit-stop, the number and the reactions on this frame
  s.impact(to);
  fly.clear();
  if (voice) play(voice.impact, { volume: 0.8, pan: panAt(to.x) });
  else s.ctx.sfx('earthQuake', { volume: 0.75 });
  const floorY = target ? target.home.y + 2 : s.toGround.y + 2;
  const dir = norm(sub(to, from));
  const blocked = s.blocked ? (r.attack.blocked ?? 'shatter') : null;
  if (blocked === 'rebound') {
    // it glances off the guard, drops short and breaks on the floor
    void bounceOff(s, r, mat, to, dir, floorY, u.uid);
  } else {
    // 'shatter' (and, until their first user, 'clang' / 'splash'): it breaks where it lands
    materialBurst(sc, to, floorY, dir, mat, { rebound: !!blocked, big: s.direct ? 1.2 : blocked ? 0.8 : 1, seed: u.uid * 13 + 5 });
  }
  runHook(hooks?.onContact, s, r, to, u.frameInfo().frame);
  if (loses) return; // the handler answers on this frame and owns the body from here
  // ---- recover: the follow-through plays on; the strike ends with the attack
  const rec = u.spec('attack')?.marks?.recover;
  if (hooks?.onRecover && typeof rec === 'number') atMark(u, 'attack', 'recover', () => runHook(hooks.onRecover, s, r, originPoint(u, r.attack.from), rec), { maxMs: 3000 });
  const rest = Math.max(0, u.rangeMs('attack', Math.min(REL, n - 1), n - 1)) + 300;
  const t0 = sc.time.now;
  while (u.sprite.active && !u.retired && u.frameInfo().anim === 'attack' && u.sprite.anims.isPlaying && sc.time.now - t0 < rest) await sleep(sc, 30);
}

/** 'rebound': the projectile glances back off the guard in a short hop and breaks on the floor. */
async function bounceOff(s: StrikeArgs, r: PresentationRecipe, mat: MaterialDef | null, at: XY, dir: XY, floorY: number, seed: number): Promise<void> {
  const sc = s.scene;
  const { key } = ensureProjectile(sc, r.attack.vfx, mat);
  const rock = sc.add.image(at.x, at.y, key, 0).setDepth(DEPTH.FX - 4);
  const back = { x: -dir.x, y: -dir.y };
  const land = rint({ x: at.x + back.x * 16, y: floorY - 2 });
  const ms = 200;
  await new Promise<void>((resolve) => {
    onFrame(
      sc,
      (_dt, el) => {
        const t = Math.min(1, el / ms);
        rock.setPosition(Math.round(at.x + (land.x - at.x) * t), Math.round(at.y + (land.y - at.y) * t - 10 * 4 * t * (1 - t)));
        rock.setFrame(Math.floor(el / 45) % TURNS);
        return t < 1;
      },
      () => {
        rock.destroy();
        resolve();
      },
    );
  });
  materialBurst(sc, land, floorY, back, mat, { big: 0.7, seed: seed * 17 + 3 });
}

// ================================================================ kinds

export type RecipeStrikeKind = (s: StrikeArgs, r: PresentationRecipe, hooks: RecipeHooks | null) => Promise<void>;

/** The strike kinds A3 builds (the others arrive with their first user, A3_MIMARI §6.2). */
const KINDS: Partial<Record<AttackType, RecipeStrikeKind>> = {
  throw: throwStrike,
};

/** The attack types the recipe layer can build a strike for. */
export const STRIKE_KINDS: readonly AttackType[] = Object.freeze(Object.keys(KINDS) as AttackType[]);

/** The strike of a recipe (registerStrike), or null when its attack type has no kind yet. */
export function recipeStrike(r: PresentationRecipe): ((s: StrikeArgs) => Promise<void>) | null {
  const kind = KINDS[r.attack.type];
  if (!kind) return null;
  return async (s) => kind(s, r, await hooksOf(r));
}
