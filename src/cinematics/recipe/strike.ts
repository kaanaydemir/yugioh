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
// one picture until it lets go); a parabola (point-blank: a flat snap into the body); it spins (8 whole-pixel turns, lit from the top-left
// whatever its turn) — the thrower's OWN projectile when one is registered under its `attack.vfx`
// (registerProjectile, `recipe/projectiles/<vfx>.ts`: drawn with the art's own part painter, so the
// rock it holds and the rock that flies are one drawing), else a faceted lump in its material's
// tones; the flight takes over one tick in (no pop at the hand-over) and the contact is staged in the
// very update that puts it on the body (no frozen frame before the blow); its shadow slides over the
// floor from the thrower to the target, shrinking and thinning with height (dithered, never alpha,
// under the cards on the tiles); on contact it bursts (materialBurst, A3 pilot fix): its own drawing
// cut in four cracks in place through the hit-stop, the pieces tumble out sideways and toward the
// camera, bounce on the struck body's floor line, lie still a moment and blink out; a low dust cloud of
// dithered puffs in the matter's mid tones rolls out — all in the struck body's floor band; blocked,
// `attack.blocked` ('shatter': it breaks on the guard and the pieces fly back at the thrower;
// 'rebound': it glances off, falls short and breaks on the floor); a direct attack lands it on the
// duelist.
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
import { DEPTH, type XY, unitDepth } from '../../view/layout';
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
 * What a registered projectile is made of (Y8, additive): `tones` (dark → light) are the tones its
 * pieces, grit, dust and flight grains take — the thrown thing's own matter, which need not be the
 * thrower's body (the pilot's grey stone body throws a brown earth boulder); `accent` the odd bits that
 * fly off it (the boulder's moss tuft: two shards). Without it the pieces take the body's material.
 */
export interface ProjectileMatter {
  tones: readonly number[];
  accent?: readonly number[];
}

const PROJ_MATTER = new Map<string, ProjectileMatter>();

/**
 * Register the projectile a recipe names by `attack.vfx` (`recipe/projectiles/<vfx>.ts` at module load:
 * the cinematics loader loads it with every other cinematics file, before anything plays). It counts in
 * its first user's ornament budget (A3_MIMARI §6.2, ≤ 250 lines with the hooks and set pieces).
 * Returns its unregister.
 */
export function registerProjectile(vfx: string, draw: ProjectileDraw, matter?: ProjectileMatter): () => void {
  PROJECTILES.set(vfx, draw);
  if (matter) PROJ_MATTER.set(vfx, matter);
  else PROJ_MATTER.delete(vfx);
  PROJ_VERSION.set(vfx, (PROJ_VERSION.get(vfx) ?? 0) + 1);
  return () => {
    if (PROJECTILES.get(vfx) !== draw) return;
    PROJECTILES.delete(vfx);
    PROJ_MATTER.delete(vfx);
  };
}

/** The registered projectile of `attack.vfx`, or null (the throw draws its default faceted lump). */
export function projectileOf(vfx: string | null | undefined): ProjectileDraw | null {
  return (vfx && PROJECTILES.get(vfx)) || null;
}

/** The matter a registered projectile breaks into, or null (its pieces take the thrower's body material). */
export function projectileMatter(vfx: string | null | undefined): ProjectileMatter | null {
  return (vfx && PROJECTILES.has(vfx) && PROJ_MATTER.get(vfx)) || null;
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

/**
 * The house shadow (MonsterUnit's): a solid ink core, a checkered band, a sparse rim — whole pixels.
 * `faint` (the projectile high in the air) thins it one dither step instead of fading it: the band
 * checkered, no rim — but the solid core stays at every height (A3 pilot fix: a shadow of rx ≥ 4 that
 * reads as one, never a 3-px glyph).
 */
function floorShadow(g: Raster, cx: number, cy: number, rx: number, faint = false): void {
  const ry = Math.max(1, Math.round(rx * 0.42));
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const dx = x / (rx + 0.5);
      const dy = y / (ry + 0.5);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const X = cx + x;
      const Y = cy + y;
      const checker = (X + Y) % 2 === 0;
      const sparse = X % 2 === 0 && Y % 2 === 0;
      const on = faint ? d < 0.4 || (d < 0.8 && checker) : d < 0.6 || (d < 0.85 && checker) || sparse;
      if (on) g.px(X, Y, PAL.ink);
    }
}

// ================================================================ the burst (rock-throw item 6)

/** A projectile's pieces per drawing version: per piece its tumble poses (see projectileChunks). */
const CHUNKS = new Map<string, PixelCanvas[][]>();

/** `q` mirrored vertically (a tumble pose: whole pixels, never rotated by a fraction). */
function flippedY(q: PixelCanvas): PixelCanvas {
  return new PixelCanvas(q.w, q.h).blit(q, 0, 0, { flipY: true });
}

/**
 * The pieces a registered projectile breaks into (A3 pilot fix, rock-throw item 6: real chunks of the
 * thing thrown, not specks): its turn-0 drawing — the held rock — without its ink rim, cut in four
 * along a jagged cross through its centre; each piece trimmed, with its own 1-px ink rim. Per piece four
 * whole-pixel tumble poses: as drawn (lit from the top-left: the pose it lies in), mirrored, upside
 * down, both. Pieces are listed top-left, top-right, bottom-left, bottom-right, each with its offset
 * from the drawing's centre (so the rock first cracks in place). null without a registered drawing.
 */
export function projectileChunks(vfx: string, mat: MaterialDef | null): { poses: PixelCanvas[]; off: XY }[] | null {
  const own = projectileOf(vfx);
  if (!own) return null;
  const key = `${vfx}:${mat?.id ?? '-'}:${PROJ_VERSION.get(vfx) ?? 0}`;
  let set = CHUNKS.get(key);
  const src = own({ mat, turn: 0, turns: TURNS }).clone().map((c) => (c === PAL.ink ? null : c));
  const b = src.bounds();
  if (!b) return null;
  const cx = b.x + Math.floor(b.w / 2);
  const cy = b.y + Math.floor(b.h / 2);
  // a jagged cross: each cut steps a pixel either way along its length
  const cutX = (y: number) => cx + ((y * 5) % 3) - 1;
  const cutY = (x: number) => cy + ((x * 7) % 3) - 1;
  const offs: XY[] = [];
  const pieces: PixelCanvas[] = [];
  for (let q = 0; q < 4; q++) {
    const piece = new PixelCanvas(src.w + 2, src.h + 2);
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c === null || (x >= cutX(y) ? 1 : 0) + (y >= cutY(x) ? 2 : 0) !== q) continue;
        piece.set(x + 1, y + 1, c);
      }
    const pb = piece.bounds();
    if (!pb || pb.w * pb.h < 4) continue;
    pieces.push(piece.crop(pb.x - 1, pb.y - 1, pb.w + 2, pb.h + 2).outline(PAL.ink));
    // the piece's centre relative to the drawing's centre (frame px; the canvas carries a 1-px margin)
    offs.push({ x: pb.x - 1 + (pb.w + 2) / 2 - (src.w + 2) / 2, y: pb.y - 1 + (pb.h + 2) / 2 - (src.h + 2) / 2 });
  }
  if (!set) {
    set = pieces.map((t) => [t, t.flippedX(), flippedY(t.flippedX()), flippedY(t)]);
    CHUNKS.set(key, set);
  }
  return set.map((poses, i) => ({ poses, off: offs[i] }));
}

/** Options of materialBurst. */
export interface BurstOpts {
  /** Blocked: the pieces are thrown back toward the thrower. */
  rebound?: boolean;
  /** Size of the burst (1: a hit). */
  big?: number;
  seed?: number;
  /** A registered projectile's own matter (ProjectileMatter): its tones take the material's place. */
  matter?: ProjectileMatter | null;
  /** The registered projectile that breaks (its own drawing is cut into the pieces, projectileChunks). */
  vfx?: string | null;
  /** The floor band everything is drawn in (default DEPTH.FX + 1): the struck body's (unitDepth + 0.6). */
  depth?: number;
}

/** A burst piece: a ground point (gx, gy) on the floor, its height h over it; screen = (gx, gy − h). */
interface Piece {
  poses: PixelCanvas[];
  gx: number;
  gy: number;
  h: number;
  vgx: number;
  vgy: number;
  vh: number;
  bounces: number;
  /** ms it has lain still (−1: still moving). */
  rest: number;
  spin: number;
}

/** Pieces lie still this long, then blink out over BLINK_MS (stepped: whole, dithered, sparse). */
const REST_MS = 110;
const BLINK_MS = 90;
/** Pieces fall at this gravity (px/s²) and keep this much of their speed on a bounce. */
const PIECE_G = 1150;
const PIECE_BOUNCE = 0.36;

/**
 * The burst of a thrown body of `mat` at `at` (rock-throw item 6, A3 pilot fix): the projectile's own
 * pieces — its drawing cut in four (projectileChunks; without a drawing, faceted lumps of its tones) —
 * crack apart where it struck and are thrown out sideways and toward the camera, tumbling; they land on
 * the floor line in front of the struck body (`floorY`), bounce once or twice, lie still a moment and
 * blink out. Blocked (`rebound`) they fly back toward the thrower. A little grit; the odd bits of its
 * matter (the boulder's moss) drop from just under the contact; a low dust cloud rolls out along the
 * floor in the matter's mid tones (dithered puffs that grow a little, lift a few pixels and thin out in
 * dither steps — never an opaque disc, never the lightest tone). Everything in the struck body's floor
 * band (`o.depth`): a body standing in front of it hides it.
 */
export function materialBurst(scene: Phaser.Scene, at: XY, floorY: number, dir: XY, mat: MaterialDef | null, o: BurstOpts = {}): void {
  const rnd = mulberry32(o.seed ?? 11);
  const rr = (a: number, b: number) => a + (b - a) * rnd();
  const k = o.big ?? 1;
  const ramp = o.matter?.tones ?? (mat ? mat.draw.ramp : [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3]);
  const lit = [o.matter ? ramp[ramp.length - 1] : (mat?.draw.edge.hi ?? ramp[ramp.length - 1]), ...[...ramp].reverse()];
  const depth = o.depth ?? DEPTH.FX + 1;
  const d = norm(dir);
  const back = { x: -d.x, y: -d.y };
  const floor = Math.round(floorY);
  const h0 = Math.max(2, floor - at.y);
  // ---- the pieces (the rock cracks in place on the frame after the contact, then they fly)
  const chunks = o.vfx ? projectileChunks(o.vfx, mat) : null;
  const pieces: Piece[] = [];
  const lump = (n: number) => {
    // no drawing of its own: lumps of the material (a lit facet, a mid face, an ink rim), 3–4 px
    const q = new PixelCanvas(n + 2, n + 1);
    q.rect(1, 1, n, n - 1, ramp[Math.max(0, ramp.length - 2)]);
    q.rect(1, 1, n - 1, 1, lit[0]);
    q.set(n, n - 1, ramp[Math.max(0, ramp.length - 3)]);
    q.outline(PAL.ink);
    return [q, q.flippedX(), flippedY(q.flippedX()), flippedY(q)];
  };
  const parts = chunks ?? [3, 4, 3, 4].map((n, i) => ({ poses: lump(n), off: { x: (i % 2 ? 2 : -2), y: i < 2 ? -2 : 2 } }));
  parts.forEach((c, i) => {
    const s = i % 2 === 0 ? -1 : 1;
    const low = i >= 2;
    // a hit: off the struck face sideways and toward the camera, a little back; blocked: back at the thrower
    const vgx = o.rebound ? back.x * rr(45, 80) + s * rr(8, 24) : s * rr(26, 52) * (low ? 1.25 : 1) + back.x * rr(10, 24);
    const vgy = o.rebound ? back.y * rr(45, 80) + rr(10, 22) : rr(14, 30) + back.y * rr(4, 12);
    // it starts where that piece of the rock was: its bottom edge over the floor by the contact's height
    const gy = floor + (low ? 1 : 0);
    pieces.push({ poses: c.poses, gx: at.x + c.off.x, gy, h: Math.max(0, gy - (at.y + c.off.y + c.poses[0].h / 2)), vgx: vgx * k, vgy: vgy * k, vh: rr(35, 70) * (low ? 0.8 : 1), bounces: 0, rest: -1, spin: rr(55, 85) });
  });
  // in the air the pieces fly over everything (the guard's own hex glint included: the rock is seen breaking
  // on it); near the floor they are in the struck body's floor band (a body in front of it hides them)
  const span = 150;
  const air = Raster.around(scene, at.x, (at.y + floor) / 2, span, h0 + 70, DEPTH.FX + 3);
  const ras = Raster.around(scene, at.x, (at.y + floor) / 2, span, h0 + 70, depth);
  let first = true;
  onFrame(
    scene,
    (dt, el) => {
      // the contact frame still shows the whole rock: the pieces take over on the next update
      if (first) {
        first = false;
        return true;
      }
      const s = dt / 1000;
      ras.begin();
      air.begin();
      let alive = false;
      for (const p of pieces) {
        if (p.rest < 0) {
          p.vh -= PIECE_G * s;
          p.gx += p.vgx * s;
          p.gy += p.vgy * s;
          p.h += p.vh * s;
          if (p.h <= 0) {
            p.h = 0;
            if (p.bounces < 2 && -p.vh > 90) {
              p.bounces++;
              p.vh = -p.vh * PIECE_BOUNCE;
              p.vgx *= 0.55;
              p.vgy *= 0.55;
            } else p.rest = 0;
          }
        } else p.rest += dt;
        if (p.rest > REST_MS + BLINK_MS) continue;
        alive = true;
        // tumbling in the air (a pose every `spin` ms), lit side up once it lies still
        const pose = p.rest >= 0 || p.h <= 0 ? p.poses[0] : p.poses[Math.floor(el / p.spin) % p.poses.length];
        const x = Math.round(p.gx - pose.w / 2);
        const y = Math.round(p.gy - p.h - pose.h + 1);
        const fade = p.rest > REST_MS ? (p.rest - REST_MS) / BLINK_MS : 0;
        const level = fade <= 0 ? 1 : fade < 0.34 ? 0.75 : fade < 0.67 ? 0.5 : 0.25;
        const g = p.h >= 6 ? air : ras;
        for (let yy = 0; yy < pose.h; yy++)
          for (let xx = 0; xx < pose.w; xx++) {
            const c = pose.get(xx, yy);
            if (c !== null) g.dpx(x + xx, y + yy, c, level);
          }
      }
      ras.end();
      air.end();
      return alive;
    },
    () => (ras.destroy(), air.destroy()),
  );
  // ---- grit and the odd bits of its matter (the boulder's moss: from just under the contact, never across the face)
  const sp = new Sparks(scene, depth + 0.01);
  for (let i = 0; i < Math.round(8 * k); i++) {
    const s = i % 2 === 0 ? -1 : 1;
    sp.add({ x: Math.round(at.x + rr(-2, 2)), y: Math.round(at.y + rr(-1, 3)), vx: (o.rebound ? back.x * rr(40, 90) : s * rr(30, 80)) + back.x * 10, vy: -rr(30, 80), ay: 600, life: rr(260, 420), colors: lit.slice(1), shape: 'px', floor: floor + Math.round(rr(0, 5)), bounce: 0.25, fadeAt: 1 });
  }
  const acc = o.matter?.accent;
  if (acc?.length)
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      sp.add({ x: Math.round(at.x + s * 2), y: Math.round(at.y + 4), vx: (o.rebound ? back.x * rr(30, 60) : s * rr(20, 45)) + back.x * 8, vy: -rr(20, 45), ay: 520, rot: rr(0, 6), vrot: rr(-10, 10), life: rr(420, 560), colors: acc, shape: 'shard', size: 2, floor: floor + 2 + i, bounce: 0.3, fadeAt: 1 });
    }
  sp.release();
  // ---- the low dust cloud rolls out along the floor, lifting a little, thinning in dither steps
  dustCloud(scene, { x: at.x, y: floor }, ramp, k, depth - 0.01, rnd);
}

/**
 * A low dust cloud at a floor point `foot` in a ramp's mid tones (light → mid → dark of the three below
 * its lightest: earth3 → earth2 → earth1 for the boulder): `7 × k` dithered puffs (Raster bayer dither,
 * world-aligned, so overlapping puffs never thicken into a disc) that roll out along the floor, grow by
 * at most 2 px/s, lift 6–14 px/s and thin out 3/4 → 1/2 → 1/4 → gone over 300–480 ms.
 */
function dustCloud(scene: Phaser.Scene, foot: XY, ramp: readonly number[], k: number, depth: number, rnd: () => number): void {
  const rr = (a: number, b: number) => a + (b - a) * rnd();
  const n = ramp.length;
  const tones = [ramp[Math.max(0, n - 2)], ramp[Math.max(0, n - 3)], ramp[Math.max(0, n - 4)]];
  const puffs = Array.from({ length: Math.round(7 * k) }, () => {
    const a = rr(0, Math.PI * 2);
    const r = rr(3, 9);
    return { x: foot.x + Math.cos(a) * r, y: foot.y - 1 + Math.sin(a) * r * 0.4, vx: Math.cos(a) * rr(24, 48), vy: Math.sin(a) * rr(4, 10), lift: rr(6, 14), r: rr(2.2, 3), life: rr(300, 480), delay: rr(10, 80) };
  });
  const ras = Raster.around(scene, foot.x, foot.y - 6, 100, 36, depth);
  onFrame(
    scene,
    (_dt, el) => {
      ras.begin();
      let alive = false;
      for (const p of puffs) {
        const age = el - p.delay;
        if (age >= p.life) continue;
        alive = true;
        if (age < 0) continue;
        const t = age / p.life;
        const s = age / 1000;
        const roll = (1 - Math.exp(-2.6 * s)) / 2.6; // drag 2.6: it rolls out and slows
        const r = p.r + 2 * s;
        ras.ell(p.x + p.vx * roll, p.y + p.vy * roll - p.lift * s, r, Math.max(1, r * 0.6), tones[t < 0.34 ? 0 : t < 0.67 ? 1 : 2], t < 0.4 ? 0.75 : t < 0.7 ? 0.5 : 0.25);
      }
      ras.end();
      return alive;
    },
    () => ras.destroy(),
  );
}

/** Below this distance (px) a throw is a flat snap into the body, not an arcing flight. */
const THROW_SNAP_DIST = 30;

/** The game's frame (ms): the flight's hand-over lead and its arrival snap are counted in it. */
const FRAME_MS = 1000 / 60;

/**
 * Fly the projectile from `from` to `to` along a parabola: whole-pixel positions, TURNS-step spin, the
 * shadow sliding over the floor from `g0` to `g1`, grains falling off. `arrive()` runs IN the update that
 * puts it on its contact point (A3 pilot fix: the contact is staged on that very frame — no frame of the
 * rock frozen on the body before the blow); the rock is still drawn there on that frame and goes on the
 * next update (the pieces of the burst take over). Resolves after `arrive()`.
 */
function flyThrow(s: StrikeArgs, r: PresentationRecipe, mat: MaterialDef | null, from: XY, to: XY, g0: XY, g1: XY, rnd: () => number, lead: number, arrive: () => void): Promise<void> {
  const sc = s.scene;
  const { key } = ensureProjectile(sc, r.attack.vfx, mat);
  const dist = len(sub(to, from));
  // a point-blank shot (the two stand close: the body is already at the hand) is hurled flat into it
  // (≈ 80–120 ms, as the A2 magus orb's snap), not a lob that hangs in front of it; a long one arcs
  const snap = dist < THROW_SNAP_DIST;
  const ms = r.attack.travel?.ms ?? (snap ? clamp(Math.round(70 + dist * 1.6), 80, 120) : clamp(Math.round(110 + dist * 1.1), 200, 380));
  const arc = r.attack.travel?.arc ?? (snap ? Math.round(dist * 0.25) : clamp(Math.round(dist * 0.38), 16, 52));
  const spin = to.x >= from.x ? 1 : -1;
  const rock = sc.add.image(from.x, from.y, key, 0).setDepth(DEPTH.FX - 4);
  const x0 = Math.floor(Math.min(g0.x, g1.x) - 12);
  const y0 = Math.floor(Math.min(g0.y, g1.y) - 6);
  // the shadow lies on the floor: over the stepped floor light, UNDER the cards on the tiles (it never
  // paints ink over a card it passes)
  const shadow = new Raster(sc, x0, y0, Math.ceil(Math.abs(g1.x - g0.x) + 24), Math.ceil(Math.abs(g1.y - g0.y) + 12), DEPTH.CARD_ON_TILE - 1);
  const ramp = projectileMatter(r.attack.vfx)?.tones ?? (mat ? mat.draw.ramp : [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3]);
  const grains = new Sparks(sc, DEPTH.FX - 5);
  const gone = () => {
    rock.destroy();
    shadow.destroy();
  };
  return new Promise<void>((resolve) => {
    let done = false;
    const end = (hit: boolean) => {
      if (done) return;
      done = true;
      grains.release();
      if (hit) {
        // the contact frame still shows the rock touching the body; it goes with the next update
        sc.events.once('update', gone);
        try {
          arrive();
        } catch (e) {
          console.error('[recipe] throw contact', e);
        }
      } else gone();
      resolve();
    };
    // `lead`: ms the projectile has already flown when the flight takes over (it is placed there at once)
    const place = (el: number, dt: number): { p: XY; t: number } => {
      // the last step snaps onto the contact point when less than half a frame of flight is left (no
      // frame of the rock still a pixel short of the body)
      const t = ms - (el + lead) < dt * 0.5 ? 1 : Math.min(1, (el + lead) / ms);
      const p = rint({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - arc * 4 * t * (1 - t) });
      rock.setPosition(p.x, p.y);
      const f = Math.floor((el + lead) / 55) % TURNS;
      rock.setFrame(spin > 0 ? f : (TURNS - f) % TURNS);
      // the shadow: a dithered ellipse sliding thrower → target, smaller and thinner the higher the rock
      // flies — opaque and stepped (a 50 % shadow vanishes on the v3 night floor), never under rx 4
      const gp = { x: g0.x + (g1.x - g0.x) * t, y: g0.y + (g1.y - g0.y) * t };
      const h = Math.max(0, gp.y - p.y);
      const rx = clamp(Math.round(6 - h / 14), 4, 6);
      shadow.draw((g) => floorShadow(g, Math.round(gp.x), Math.round(gp.y), rx, h > 34));
      return { p, t };
    };
    if (lead > 0) place(0, 0);
    onFrame(
      sc,
      (dt, el) => {
        if (!rock.active) {
          end(false);
          return false;
        }
        const { p, t } = place(el, dt);
        if (dt > 0 && t < 0.92 && rnd() < 0.45) grains.add({ x: p.x + Math.round(rnd() * 6 - 3), y: p.y + Math.round(rnd() * 5 - 2), vx: rnd() * 16 - 8, vy: 6 + rnd() * 14, ay: 300, life: 220 + rnd() * 160, colors: [ramp[ramp.length - 1], ramp[Math.max(0, ramp.length - 2)]], shape: 'px', fadeAt: 1 });
        if (t >= 1) {
          end(true);
          return false;
        }
        return true;
      },
      () => end(false),
    );
  });
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
  const REL = clamp(u.markFrame('attack', 'release', u.impactFrame), 0, Math.max(0, n - 1));
  // the declaration held its charge frame (the hand-over): the strike goes on from the NEXT frame, as
  // the slice's strikes do — that frame's own hold has been shown already, and longer
  const held = strikeStartFrame(u);
  const f0 = u.frameInfo().anim === 'attack' && !u.sprite.anims.isPlaying ? Math.min(held + 1, REL) : held;
  // ---- the gathering goes on from the declaration's held charge pose (its voice taken over)
  const charge = voice ? takeCharge(u, voice.charge, { volume: 0.85, pan }) : null;
  runHook(hooks?.onCharge, s, r, originPoint(u, r.attack.from), u.frameInfo().frame);
  void u.playRange('attack', f0);
  // ---- the release frame: its voice and hook play IN the frame update that shows it (d = 0), and the
  // projectile leaves the origin point drawn on THAT frame. A thrower's OWN projectile is drawn in the hand
  // through the release frame (ProjectileDraw: turn 0 is that drawing): the flight takes over in the update
  // that shows the next frame — never two rocks on screen, never a frame without one — its clock one tick
  // in (the rock left during the release frame: A3 pilot fix, a first step of ≈ 7 px, near the lob's own
  // 5–6 px a frame, not a 13-px pop)
  const own = !!projectileOf(r.attack.vfx);
  const relHold = own && REL < n - 1 ? u.rangeMs('attack', REL, REL + 1) : 0;
  const matter = projectileMatter(r.attack.vfx);
  const target = s.direct ? null : s.target;
  let from = originPoint(u, r.attack.from, REL);
  let to = from;
  // ---- contact, staged IN the update that puts the projectile on the body (flyThrow): the battle
  // handler's hit-stop, number and reactions, the impact voice, the burst and the hook on that frame
  const contact = () => {
    s.impact(to);
    if (voice) play(voice.impact, { volume: 0.8, pan: panAt(to.x) });
    else s.ctx.sfx('earthQuake', { volume: 0.75 });
    const floorY = target ? target.home.y + 2 : s.toGround.y + 2;
    const dir = norm(sub(to, from));
    const blocked = s.blocked ? (r.attack.blocked ?? 'shatter') : null;
    // the pieces and the dust lie in the struck body's floor band: a body standing in front of it (the
    // thrower itself at point-blank range) is drawn over them
    const depth = target ? unitDepth(target.home.y) + 0.6 : DEPTH.FX + 1;
    if (blocked === 'rebound') {
      // it glances off the guard, drops short and breaks on the floor
      void bounceOff(s, r, mat, to, dir, floorY, u.uid, depth);
    } else {
      // 'shatter' (and, until their first user, 'clang' / 'splash'): it breaks where it lands
      materialBurst(sc, to, floorY, dir, mat, { rebound: !!blocked, big: s.direct ? 1.2 : blocked ? 0.8 : 1, seed: u.uid * 13 + 5, matter, vfx: own ? r.attack.vfx : null, depth });
    }
    runHook(hooks?.onContact, s, r, to, u.frameInfo().frame);
  };
  let fly: Promise<void> | null = null;
  await new Promise<void>((go) => {
    let released = false;
    const launch = () => {
      if (fly) return;
      // the flight: to the body's face (a guard's face when blocked), or the duelist
      const face = surfaceToward(target, from, s.blocked ? 1 : ensureProjectile(sc, r.attack.vfx, mat).r - 1);
      const dirIn = norm(sub(s.to, from));
      to = face ?? (s.blocked ? rint({ x: s.to.x - dirIn.x * 8, y: s.to.y - dirIn.y * 8 }) : rint(s.to));
      const g0 = { x: u.home.x + (target ? norm(sub(target.home, u.home)).x * 10 : 0), y: u.home.y };
      const g1 = target ? { x: target.home.x - dirIn.x * 6, y: target.home.y } : s.toGround;
      fly = flyThrow(s, r, mat, from, to, g0, g1, rnd, Math.min(relHold, FRAME_MS), contact);
      go();
    };
    const release = () => {
      if (released) return;
      released = true;
      charge?.stop(30);
      if (voice) play(voice.release, { volume: 0.85, pan });
      else s.ctx.sfx('whoosh', { volume: 0.7, pitch: 0.6 });
      from = originPoint(u, r.attack.from, REL);
      runHook(hooks?.onRelease, s, r, from, REL);
      if (!(relHold > 0 && u.frameInfo().anim === 'attack' && u.frameInfo().frame <= REL)) return launch();
      const off = atFrame(u, 'attack', REL + 1, launch, { maxMs: 2000 });
      void sleep(sc, relHold + 100).then(() => (off(), launch()));
    };
    if (f0 >= REL) return release();
    const off = atFrame(u, 'attack', REL, release, { maxMs: 4000 });
    void sleep(sc, u.rangeMs('attack', f0, REL) + 400).then(() => (off(), release()));
  });
  const flight = fly as Promise<void> | null;
  if (!flight) return;
  await flight;
  if (loses) return; // the handler answers on this frame and owns the body from here
  // ---- recover: the follow-through plays on; the strike ends with the attack
  const rec = u.spec('attack')?.marks?.recover;
  if (hooks?.onRecover && typeof rec === 'number') atMark(u, 'attack', 'recover', () => runHook(hooks.onRecover, s, r, originPoint(u, r.attack.from), rec), { maxMs: 3000 });
  const rest = Math.max(0, u.rangeMs('attack', Math.min(REL, n - 1), n - 1)) + 300;
  const t0 = sc.time.now;
  while (u.sprite.active && !u.retired && u.frameInfo().anim === 'attack' && u.sprite.anims.isPlaying && sc.time.now - t0 < rest) await sleep(sc, 30);
}

/** 'rebound': the projectile glances back off the guard in a short hop and breaks on the floor. */
async function bounceOff(s: StrikeArgs, r: PresentationRecipe, mat: MaterialDef | null, at: XY, dir: XY, floorY: number, seed: number, depth: number): Promise<void> {
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
  materialBurst(sc, land, floorY, back, mat, { big: 0.7, seed: seed * 17 + 3, matter: projectileMatter(r.attack.vfx), vfx: projectileOf(r.attack.vfx) ? r.attack.vfx : null, depth });
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
