// Kanat Hanımı (wing_lady) — the v3 presentation (lane F). Design: docs/v3/oturum-f/wing_lady.md (§11 wins over the
// older sections). Every registration is gated on LOOK_V3 (v1 registers nothing here), named kart-f:wing_lady:<part>.
// Sounds: src/audio/v3/wing_lady.ts (the voice ships with this file). Aura pieces: ./wing_lady-aura.ts (exports only).
//
// She is a kestrel-winged swordswoman who SINGS; her aura is GOLD LIGHT that lifts her WIND allies.
//
//   summon    "Rüzgâr Kapısı": a sunlit wing-shaped floor light sweeps in along her lane row from behind her; she
//             glides in low and level over it (summon f0–f1, the light locked under her, gold slipstreams off the
//             wingtips), brakes into a tall W (f2–f3), three backwing beats push gold crescents onto the floor (f4–f6)
//             as she sinks, lands toe-first (f7–f8), folds, and SALUTES (f11): the jewel flares, she sings A4
//   effect    "Kanat Selamı" (no activate event: the +300s are the statChange run after her arrival): one full
//             downstroke (special f4) sends a gold air current along the front edge of the lane row to every buffed
//             ally and to nobody else (it runs at the feet, drawn at each floor row's depth: a FIRE neighbour is passed); on arrival the
//             ally's floor light unfolds, its crest blooms over the ATK, the badge rolls +300, a white "+300", the
//             ally lifts 1 px — and one harmony voice joins her song (the chord counts the allies). Then every
//             floor light of her side beats once together; from now on they breathe with her idle (f7)
//   arrival   an ally summoned / flipped next to her (no event: it is born buffed): she lifts her head (roar), one
//             current to the newcomer, its crest blooms, "+300", a chord voice
//   loss      "Kanatlar Döner": the crests fold, the floor lights fold and drift toward her (her tile, her new tile or
//             her graveyard) stepping down gold3 → gold1; the badges roll −300; the chord voices fall a semitone and
//             drop out
//   strike    "Kerkenez Hamlesi": she rises and HOVERS like a kestrel (attack f2/f3 alternating, the head locked dead
//             still), folds (f4), stoops flat and sword-first (f5), and her wings CLAP around the target (f6: two
//             gold brackets close, then break into dashes); she rebounds and back-flaps home still facing it.
//             direct: a long flat glide to the duelist, a smaller clap, a high backward arc home on the wind.
//             blocked: the brackets fail to close (they bend outward on the guard), she PERCHES one beat on top of the
//             defender, kicks off backwards and flaps home
//   death     "Düşen Pelerin": struck, the song breaks, both wings fall over her like a cape (f2), she tips and falls
//             flat forward (f4–f9; the allies' floor lights fold toward her on f4); then her outline lifts off the
//             floor as a gold-rimmed bird silhouette that opens its wings and flies UP and back to the graveyard while
//             her card is born — no shatter, no shadow on the floor, no sinking

import type Phaser from 'phaser';
import { CARDS } from '../../data/cards';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import type { AnyMonsterAnim, MonsterPointName } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { FieldView } from '../../duel/FieldView';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { E, type Px, animate, onFrame, sleep } from '../../vfx/combat';
import { pixelText } from '../../ui/text';
import { registerCardHook, registerEvent, registerObserver, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, fade, hitSoundFor, hush, panAt, play, start, takeCharge } from '../_v3/sound';
import { setCombatSfx } from '../../vfx/combat';
import type { SfxName } from '../../audio/sfx';
import { behindBodies, cardLeaves } from '../_v3/card';
import { contactFlash } from '../_v3/flash';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { runSummon, type Stage } from '../summon-a/_kit';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { contactFeet, layer } from '../strikes-a/_kit';
import { AURA_KEY, FLOOR_DEPTH, LADY, STEP_MS, auraOf, crestAnchor, paintFloorLight, wingAura } from './wing_lady-aura';
import { auraDelta, bonusIn, slotOf } from './wing_lady-rules';

const ID = LADY;
type EvOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEvent['type']> = CinematicContext<EvOf<T>>;
type AnyCtx = CinematicContext<GameEvent>;
type StatEv = EvOf<'statChange'>;

const GOLD = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;
const BLESS: readonly SfxName[] = ['khBless1', 'khBless2', 'khBless3', 'khBless4'];

/** Uids an animation of ours currently owns (the observer keeps its hands off them). */
const BUSY = new Set<Uid>();

/** Scene time of the last khSong we started (round 2 #1: a bless run holds its own root when the song has decayed). */
let songAt = -1e9;
function singSong(sc: Phaser.Scene, o: { volume: number; pan: number }): void {
  songAt = sc.time.now;
  play('khSong', o);
}
/** Her song is still holding its A4 (the slur returns to A4 at 0.78 s and fades by 1.25 s). */
function songHeld(sc: Phaser.Scene): boolean {
  return sc.time.now - songAt < 650;
}

// ================================================================ geometry

const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** A named art point on the frame the unit shows now (world, whole pixels); `fb` when the art has none. */
function pointNow(u: MonsterUnit, name: MonsterPointName, fb?: XY): XY {
  const fi = u.frameInfo();
  const pts = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame) : null;
  const p = pts?.[name];
  if (p) return rint(u.framePoint(p.x, p.y));
  return rint(fb ?? u.core());
}

function artPoint(u: MonsterUnit, anim: AnyMonsterAnim, f: number, name: MonsterPointName): XY | null {
  return u.art.points?.(anim, f)?.[name] ?? null;
}

/** Put the sprite's feet on `p` (whole pixels); its depth from the floor point `ground` (default: p). */
function setFeet(u: MonsterUnit, p: XY, ground?: XY, depthOver?: number): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(p.x), Math.round(p.y - u.art.hover));
  s.setDepth(depthOver ?? unitDepth(Math.round((ground ?? p).y)));
}

function feetOf(u: MonsterUnit): XY {
  return { x: Math.round(u.sprite.x), y: Math.round(u.sprite.y + u.art.hover) };
}

/** Resolve when the unit shows `anim` frame ≥ f (or at most `max` ms). */
function untilShown(u: MonsterUnit, anim: AnyMonsterAnim, f: number, max = 3000): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      resolve();
    };
    atFrame(u, anim, f, fin, { maxMs: max });
    void sleep(u.scene, max).then(fin);
  });
}

function capped(sc: Phaser.Scene, p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([p.then(() => undefined, () => undefined), sleep(sc, ms)]);
}

/** Bezier point. */
function quad(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** A polyline resampled to whole pixels (no repeats). */
function pixelPath(pts: XY[]): XY[] {
  const out: XY[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let k = 0; k < n; k++) {
      const p = rint({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
      const l = out[out.length - 1];
      if (!l || l.x !== p.x || l.y !== p.y) out.push(p);
    }
  }
  const z = rint(pts[pts.length - 1]);
  const l = out[out.length - 1];
  if (!l || l.x !== z.x || l.y !== z.y) out.push(z);
  return out;
}

// ================================================================ small pieces

/** A white "+300" chip rising off the plate (the existing small text style; white, never gold). */
function chip(sc: Phaser.Scene, at: XY, text: string): Promise<void> {
  const t = pixelText(sc, at.x, at.y, text, { size: 'sm', color: PAL.white, outline: true, align: 'center', originX: 0.5, originY: 1, shadow: 0 });
  t.setDepth(DEPTH.FX_TOP + 40);
  return animate(sc, 560, (k) => {
    if (!t.active) return;
    t.setPosition(Math.round(at.x), Math.round(at.y - 3 * E.outBack(Math.min(1, k * 4)) - 4 * k));
    t.setVisible(k < 0.8 || Math.floor(k * 40) % 2 === 0);
  }).then(() => t.destroy());
}

/** The jewel flare: a 3-px leaf4 cross for two frames + a leaf3 light on her tile. */
function jewelFlare(sc: Phaser.Scene, u: MonsterUnit, ms = 120): void {
  const h = pointNow(u, 'head', u.worldPoint('top'));
  const px = layer(sc, u.sprite.depth + 0.6);
  void animate(sc, ms, (t) => {
    px.clear();
    if (t >= 1) return;
    const c = t < 0.5 ? PAL.leaf4 : PAL.leaf3;
    px.dot(h.x, h.y, PAL.white).dot(h.x - 1, h.y, c).dot(h.x + 1, h.y, c).dot(h.x, h.y - 1, c).dot(h.x, h.y + 1, c);
    if (t < 0.5) px.dot(h.x - 2, h.y, PAL.leaf3).dot(h.x + 2, h.y, PAL.leaf3).dot(h.x, h.y - 2, PAL.leaf3);
  }).then(() => px.g.destroy());
  void lightFlash(sc, h.x, h.y, PAL.leaf3, 14, 220, { floorY: u.home.y, air: 1, intensity: 0.75 });
}

/** A gold air crescent pushed down and forward onto the floor (a backwing beat): 1-px arc, 3 palette steps. */
function crescent(sc: Phaser.Scene, at: XY, dir: number, w = 10): Promise<void> {
  const px = layer(sc, FLOOR_DEPTH + 1);
  return animate(sc, 220, (t) => {
    px.clear();
    if (t >= 1) return;
    const k = Math.min(2, Math.floor(t * 3));
    const c = [PAL.gold3, PAL.gold2, PAL.gold1][k];
    const R = Math.round(w / 2 + k * 2);
    const cx = at.x + dir * (2 + k * 3);
    for (let i = -R; i <= R; i++) {
      const y = Math.round(at.y + ((i * i) / (R * R)) * -2) + k;
      if (k === 2 && (i + R) % 2) continue;
      px.dot(cx + i, y, c);
    }
  }).then(() => px.g.destroy());
}

/** Slipstreams: a 1-px gold line trailing `len` px behind `p` against `vel` (3 palette steps). */
function slip(px: Px, p: XY, vel: XY, len: number): void {
  const L = Math.hypot(vel.x, vel.y) || 1;
  const dx = -vel.x / L;
  const dy = -vel.y / L;
  for (let i = 1; i <= len; i++) {
    const c = i < len * 0.35 ? PAL.gold3 : i < len * 0.7 ? PAL.gold2 : PAL.gold1;
    px.dot(Math.round(p.x + dx * i), Math.round(p.y + dy * i), c);
  }
}

// ================================================================ the current (her wingtip → an ally's tile)

/**
 * A gold air current: from her wingtip it drops to the FRONT edge of her lane row (at the feet), runs along it at each
 * floor row's depth (a FIRE neighbour is passed, never stopped at) and curls round the ally's feet. Resolves on arrival.
 */
function current(sc: Phaser.Scene, from: XY, ladyFloor: XY, to: XY, ms: number): Promise<void> {
  const side = to.x >= ladyFloor.x ? 1 : -1;
  // the floor run: along the FRONT edge of the row (in front of the feet), from her tile to the ally's; a FIRE
  // neighbour on the way is passed (the current never stops there)
  const f0 = { x: ladyFloor.x + side * 8, y: ladyFloor.y + 5 };
  const f1 = { x: to.x - side * 10, y: to.y + 5 };
  const pts: XY[] = [];
  for (let i = 0; i <= 8; i++) pts.push(quad(from, { x: from.x + side * 10, y: f0.y - 4 }, f0, i / 8));
  // a gentle lift between the tiles (an air stream, 2 px)
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    pts.push({ x: f0.x + (f1.x - f0.x) * t, y: f0.y + (f1.y - f0.y) * t - Math.round(Math.sin(Math.PI * t) * 2) });
  }
  // the curl into the ally's tile (a half loop around its feet, ending under it)
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 1.2;
    pts.push({ x: to.x - side * 10 * Math.cos(a) , y: to.y + 5 - Math.sin(a) * 7 });
  }
  const path = pixelPath(pts);
  const n = path.length;
  const TRAIL = 22;
  // every pixel sits at the depth of its floor row: in front of the bodies standing behind it
  const air = layer(sc, DEPTH.FX - 4);
  const rows = new Map<number, Px>();
  const rowOf = (y: number): Px => {
    let L = rows.get(y);
    if (!L) rows.set(y, (L = layer(sc, unitDepth(y + 1) + 0.2)));
    return L;
  };
  const airN = 9;
  const i0floor = (y: number) => Math.max(y, Math.min(to.y, ladyFloor.y));
  // the head carries a small light (the light layer: it spills on the floor it passes)
  const glow = lightPool(sc, path[0].x, path[0].y, { color: PAL.gold3, spill: PAL.gold1, radius: 9, floorY: to.y, intensity: 0.7, air: 0.6, fadeIn: 60 });
  return animate(sc, ms + 140, (_t, el) => {
    air.clear();
    for (const L of rows.values()) L.clear();
    const head = Math.min(n - 1, Math.floor(E.inOutQ(Math.min(1, el / ms)) * (n - 1)));
    const cut = el >= ms ? Math.floor(((el - ms) / 140) * TRAIL) : 0;
    for (let k = cut; k < TRAIL; k++) {
      const i = head - k;
      if (i < 0) break;
      // 2-px dashes travelling along the line
      if (k > 4 && (i + Math.floor(el / 40)) % 5 === 4) continue;
      const c = k < 3 ? PAL.gold4 : k < 8 ? PAL.gold3 : k < 15 ? PAL.gold2 : PAL.gold1;
      const p = path[i];
      const L = i < airN ? air : rowOf(p.y);
      L.dot(p.x, p.y, c);
      // a 2-px body: the lit row above the head and the first stretch
      if (k < 10) L.dot(p.x, p.y - 1, k < 3 ? PAL.gold4 : PAL.gold2);
    }
    const hp = path[head];
    if (glow.alive) glow.setPosition(hp.x, hp.y, i0floor(hp.y));
  }).then(() => {
    if (glow.alive) void glow.fadeOut(160);
    air.g.destroy();
    for (const L of rows.values()) L.g.destroy();
  });
}

// ================================================================ bless / unbless

interface Ally {
  uid: Uid;
  ev: StatEv | null;
  unit: MonsterUnit | null;
}

function ladyUnitsOf(field: FieldView, p: PlayerId): MonsterUnit[] {
  return field.units().filter((u) => u.cardId === ID && u.player === p && !u.retired && u.sprite.active);
}

/** 1-px buoyancy for two frames (whole pixels, restored exactly; never on a unit an animation owns). */
function liftOnce(u: MonsterUnit): void {
  if (u.posed || !u.sprite.active) return;
  const s = u.sprite;
  const y0 = s.y;
  s.y = y0 - 1;
  void sleep(u.scene, 2 * STEP_MS).then(() => {
    if (s.active && Math.abs(s.y - (y0 - 1)) < 0.01 && !u.posed) s.y = y0;
  });
}

/** Give `u` the aura (or a second crest pair), blooming. */
function blessUnit(ctx: AnyCtx, u: MonsterUnit, count: number, bloom: boolean): void {
  const cur = auraOf(u);
  if (cur && !cur.folding) {
    cur.setCount(count);
    cur.flare();
    return;
  }
  const field = ctx.views.field;
  const p = u.player;
  u.setAura(AURA_KEY, wingAura(ctx.scene, u, { count, bloom, ladies: () => ladyUnitsOf(field, u.player === p ? p : u.player) }) as never);
}

type BlessMode = 'full' | 'afterSummon' | 'compact' | 'arrive';

/**
 * "Kanat Selamı": `lady` (may be null / hidden: the currents start from `ladyHome` at shoulder height) sends one
 * current to each ally; on arrival the aura blooms and the badge rolls to its event's values.
 */
async function blessBeat(ctx: AnyCtx, ladyUid: Uid | null, ladyHome: XY, allies: Ally[], mode: BlessMode): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const lady = ladyUid !== null ? field.unit(ladyUid) : null;
  const ladyOk = !!lady && !lady.retired && lady.sprite.active && lady.sprite.visible;
  for (const a of allies) BUSY.add(a.uid);
  // nearest first
  const list = allies
    .map((a) => ({ ...a, unit: a.unit ?? field.unit(a.uid) }))
    .filter((a) => a.unit && !a.unit.retired)
    .sort((a, b) => Math.abs(a.unit!.home.x - ladyHome.x) - Math.abs(b.unit!.home.x - ladyHome.x));
  // keep the badges on their old numbers until the lift (a sync may have snapped them already)
  for (const a of list) if (a.ev && a.unit!.shownStats.atk !== a.ev.prevAtk && mode !== 'arrive') void a.unit!.setStats(a.ev.prevAtk, a.ev.prevDef, false);
  const pan = panAt(ladyHome.x);
  let anim: Promise<void> = Promise.resolve();
  let root: { stop(ms?: number): void } | null = null;
  try {
    // ---- the charge: her wings lift, the blade rises, the jewel steps up
    if (ladyOk && lady && mode !== 'compact') {
      lady.posed = true;
      if (mode === 'arrive') {
        // she lifts her head toward the newcomer: the current leaves on the gather, the flare on the release
        anim = lady.playRange('roar', 1);
        const rel = lady.markFrame('roar', 'release', 3);
        atFrame(lady, 'roar', rel, () => jewelFlare(sc, lady), { late: true, maxMs: 900 });
        await untilShown(lady, 'roar', 2, 400);
      } else if (mode === 'afterSummon') {
        // the salute was the charge (critique 7): the downstroke at once, the currents leave on it
        anim = lady.playRange('special', lady.markFrame('special', 'release', 4));
      } else {
        const f0 = 0;
        if (mode === 'full') singSong(sc, { volume: 0.8, pan });
        void lightPool(sc, lady.home.x, lady.home.y, { color: PAL.leaf3, radius: 16, floorY: lady.home.y, intensity: 0.4, fadeIn: 120 })
          .fadeOut(900)
          .catch(() => undefined);
        anim = lady.playRange('special', f0);
        await untilShown(lady, 'special', lady.markFrame('special', 'release', 4), 900);
        jewelFlare(sc, lady, 100);
      }
    }
    // ---- release: the downstroke sends one current per ally (staggered)
    const total = list.length;
    // the chord's root (round 2 #1): her A4 held under the voices, so the first ally's voice already makes a dyad
    // and the chord never thins to a lone voice once her song has decayed (softer while the song still holds its A4)
    if (total > 0) root = start('khBlessRoot', { volume: songHeld(sc) ? 0.55 : 0.85, pan });
    let n0 = 0;
    // the chord: count the allies already blessed by her (an arrival completes the existing chord)
    if (mode === 'arrive') n0 = Math.max(0, field.units().filter((u) => u.player === (lady?.player ?? list[0]?.unit?.player) && auraOf(u) && !list.some((a) => a.uid === u.uid)).length);
    const jobs = list.map(async (a, k) => {
      const u = a.unit!;
      await sleep(sc, k * 100);
      const near = ladyOk && lady ? (u.home.x >= lady.home.x ? (lady.flipX ? 'claw' : 'staff') : lady.flipX ? 'staff' : 'claw') : 'staff';
      const from = ladyOk && lady ? pointNow(lady, near as MonsterPointName, { x: ladyHome.x, y: ladyHome.y - 34 }) : { x: ladyHome.x, y: ladyHome.y - 30 };
      const dist = Math.hypot(u.home.x - ladyHome.x, u.home.y - ladyHome.y);
      const T = mode === 'compact' ? 160 : Math.min(360, 200 + dist * 0.9);
      play('khCurrent', { volume: 0.7, pan: panAt(u.home.x) });
      await current(sc, from, ladyHome, u.home, T);
      // ---- the lift
      const count = Math.max(1, Math.round(bonusIn(ctx.stateAt(ctx.events.length), a.uid) / 300) || 1);
      blessUnit(ctx, u, count, true);
      liftOnce(u);
      if (a.ev) void u.setStats(a.ev.atk, a.ev.def, true);
      const at = crestAnchor(u) ?? { x: u.home.x, y: u.home.y + 4 };
      void chip(sc, { x: at.x, y: at.y - 6 - (count - 1) * 3 }, `+${a.ev ? a.ev.atk - a.ev.prevAtk : 300}`);
      void lightFlash(sc, u.home.x, u.home.y, PAL.gold3, 18, 260, { floorY: u.home.y, intensity: 0.7 });
      const voice = BLESS[Math.min(BLESS.length - 1, n0 + k)];
      if (mode !== 'compact' || k === 0) play(voice, { volume: 0.85, pan: panAt(u.home.x) });
      play('khCrest', { volume: 0.55, pan: panAt(u.home.x) });
    });
    await Promise.all(jobs);
    // ---- the first beat together (it teaches that they belong together)
    if (total > 0 && mode !== 'compact') {
      await sleep(sc, mode === 'arrive' ? 100 : 120);
      const side = list[0].unit!.player;
      for (const u of field.units()) if (u.player === side) auraOf(u)?.beat();
    }
    // her salute settles on its own (the next event may start: the sprite returns to idle by itself)
    if (ladyOk && lady) await capped(sc, anim, mode === 'arrive' ? 0 : mode === 'afterSummon' ? 80 : 200);
  } finally {
    // the root rings on under the held voices and fades with them
    root?.stop(900);
    if (lady) lady.posed = false;
    for (const a of allies) BUSY.delete(a.uid);
  }
}

/** "Kanatlar Döner": the allies' lights fold toward `origin`; badges roll to their event values. */
async function unblessBeat(ctx: AnyCtx, origin: XY | null, allies: Ally[], o: { sound?: boolean } = {}): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  for (const a of allies) BUSY.add(a.uid);
  try {
    // the chord counts DOWN (round 2 #1): exactly as many voices fall as allies lose the aura
    const n = Math.max(1, Math.min(4, allies.length));
    const voice = `khUnbless${n}` as SfxName;
    const sing = o.sound !== false && allies.length > 0 ? start(voice, { volume: 0.8, pan: panAt(origin?.x ?? 320) }) : null;
    const jobs = allies.map(async (a, k) => {
      const u = a.unit ?? field.unit(a.uid);
      // each peel is its own beat after the voice (round 2 #6: never on the same ms)
      await sleep(sc, 80 + k * 110);
      if (!u || u.retired) return;
      const after = bonusIn(ctx.stateAt(ctx.events.length), a.uid);
      const aura = auraOf(u);
      if (after > 0 && aura) aura.setCount(Math.round(after / 300));
      else if (aura) {
        aura.fold(origin);
        u.setAura(AURA_KEY, null);
      }
      play('khPeel', { volume: 0.6, pan: panAt(u.home.x) });
      await sleep(sc, 150);
      if (a.ev && (u.shownStats.atk !== a.ev.atk || u.shownStats.def !== a.ev.def)) await u.setStats(a.ev.atk, a.ev.def, true);
    });
    await Promise.all(jobs);
    // the voices keep falling after the beat lets go (the fade carries the last drop and the root)
    await sleep(sc, 40 + n * 60);
    sing?.stop(120 + n * 130);
  } finally {
    for (const a of allies) BUSY.delete(a.uid);
  }
}

/** The lady whose arrival / departure caused the run that holds statChange `i` (null: none found). */
function causeLady(ctx: AnyCtx, i: number, gain: boolean, ally: Uid): Uid | null {
  const s0 = ctx.stateAt(blockStartOf(ctx, i));
  const s1 = ctx.stateAt(i);
  const p0 = slotOf(s0, ally)?.p;
  const p1 = slotOf(s1, ally)?.p;
  const lad = (s: GameState, p: PlayerId | undefined) => (p === undefined ? [] : s.players[p].monsters.filter((m) => m && m.faceUp && CARDS[s.cards[m.uid].cardId] && (CARDS[s.cards[m.uid].cardId] as { effect?: string }).effect === 'windAura300').map((m) => m!.uid));
  const before = lad(s0, p0);
  const after = lad(s1, p1);
  const diff = gain ? after.filter((x) => !before.includes(x)) : before.filter((x) => !after.includes(x));
  return diff[0] ?? (gain ? after[0] : before[0]) ?? null;
}

function blockStartOf(ctx: AnyCtx, i: number): number {
  let k = i;
  while (k - 1 >= 0 && ctx.events[k - 1].type === 'statChange') k--;
  let j = k - 1;
  while (j >= 0 && ctx.events[j].type !== 'statChange') j--;
  return j + 1;
}

/** Where a lady is (or was) for the beat's origin: her unit, her last tile, her graveyard pile. */
function ladyPlace(ctx: AnyCtx, uid: Uid, i: number): XY {
  const u = ctx.views.field.unit(uid);
  if (u && !u.retired && u.sprite.active) return { ...u.home };
  const now = slotOf(ctx.stateAt(i), uid);
  if (now) return zoneXY(now.p, 'monster', now.i);
  const was = slotOf(ctx.stateAt(blockStartOf(ctx, i)), uid);
  const owner = ctx.owner(uid);
  try {
    const pile = ctx.views.field.pile(owner, 'graveyard').topXY();
    if (pile) return pile;
  } catch {
    /* no pile */
  }
  return was ? zoneXY(was.p, 'monster', was.i) : { x: 320, y: 180 };
}

/**
 * Take the aura-caused statChange run that starts at or after `from` (stopping at anything that is not a
 * statChange / an already played event). Consumes it. `sign` +1 gains, −1 losses, 0 both.
 */
function takeAuraRun(ctx: AnyCtx, from: number, sign: number, o: { through?: (e: GameEvent) => boolean } = {}): { i: number; ev: StatEv; d: number }[] {
  const out: { i: number; ev: StatEv; d: number }[] = [];
  let i = from;
  for (; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (ctx.isConsumed(i)) continue;
    if (e.type === 'statChange') break;
    if (!o.through?.(e)) return out;
  }
  for (; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type !== 'statChange') break;
    if (ctx.isConsumed(i)) continue;
    const d = auraDelta(ctx.events, ctx.stateAt, i);
    if (d === 0 || (sign > 0 && d < 0) || (sign < 0 && d > 0)) continue;
    ctx.consumeAt(i);
    out.push({ i, ev: e, d });
  }
  return out;
}

/** Play a taken run: gains as Kanat Selamı from their lady, losses as Kanatlar Döner toward theirs. */
async function playRun(ctx: AnyCtx, run: { i: number; ev: StatEv; d: number }[], mode: BlessMode): Promise<void> {
  if (!run.length) return;
  const gains = run.filter((r) => r.d > 0);
  const losses = run.filter((r) => r.d < 0);
  const jobs: Promise<void>[] = [];
  if (losses.length) {
    const lady = causeLady(ctx, losses[0].i, false, losses[0].ev.uid);
    const origin = lady !== null ? ladyPlace(ctx, lady, losses[0].i) : null;
    jobs.push(unblessBeat(ctx, origin, losses.map((r) => ({ uid: r.ev.uid, ev: r.ev, unit: ctx.unit(r.ev.uid) }))));
  }
  if (gains.length) {
    // group by side (a steal: one side loses, the other gains)
    const lady = causeLady(ctx, gains[0].i, true, gains[0].ev.uid);
    const home = lady !== null ? ladyPlace(ctx, lady, gains[0].i) : ctx.unit(gains[0].ev.uid)?.home ?? { x: 320, y: 180 };
    const inBattle = ctx.events.slice(0, gains[0].i).some((e) => e.type === 'battle');
    const go = async () => {
      if (losses.length) await sleep(ctx.scene, 260);
      await blessBeat(ctx, lady, home, gains.map((r) => ({ uid: r.ev.uid, ev: r.ev, unit: ctx.unit(r.ev.uid) })), inBattle ? 'compact' : mode);
    };
    jobs.push(go());
  }
  await Promise.all(jobs);
}

// ================================================================ the aura's statChange (Kanat Selamı / Kanatlar Döner)

if (LOOK_V3)
  registerEvent(
    'statChange',
    async (ctx: Ctx<'statChange'>) => {
      const d0 = auraDelta(ctx.events, ctx.stateAt, ctx.index);
      if (d0 === 0) {
        // not ours — but take any aura event of the same run so the generic group never plays it
        const later: { i: number; ev: StatEv; d: number }[] = [];
        for (let i = ctx.index + 1; i < ctx.events.length; i++) {
          const e = ctx.events[i];
          if (e.type !== 'statChange') break;
          if (ctx.isConsumed(i)) continue;
          const d = auraDelta(ctx.events, ctx.stateAt, i);
          if (d !== 0) {
            ctx.consumeAt(i);
            later.push({ i, ev: e, d });
          }
        }
        await ctx.base();
        await playRun(ctx as unknown as AnyCtx, later, 'full');
        return;
      }
      const run = [{ i: ctx.index, ev: ctx.ev, d: d0 }, ...takeAuraRun(ctx as unknown as AnyCtx, ctx.index + 1, 0)];
      // her own summon / flip just before: the salute already charged it (critique 7)
      const prev = ctx.events[blockStartOf(ctx as unknown as AnyCtx, ctx.index)];
      const after = prev && (prev.type === 'summon' || prev.type === 'flip') && ctx.cardId((prev as { uid: Uid }).uid) === ID;
      await playRun(ctx as unknown as AnyCtx, run, after ? 'afterSummon' : 'full');
    },
    { priority: 25, name: `kart-f:${ID}:aura` },
  );

// ================================================================ the arrival bless (an ally born buffed)

async function arrivalBless(ctx: AnyCtx, uid: Uid, stateAfter: GameState): Promise<void> {
  const u = ctx.unit(uid);
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible) return;
  const bonus = bonusIn(stateAfter, uid);
  if (bonus <= 0 || auraOf(u)) return;
  const field = ctx.views.field;
  const ladies = ladyUnitsOf(field, u.player).filter((l) => l.uid !== uid && l.sprite.visible);
  const lady = ladies.sort((a, b) => Math.abs(a.home.x - u.home.x) - Math.abs(b.home.x - u.home.x))[0] ?? null;
  const home = lady ? { ...lady.home } : { ...u.home };
  await blessBeat(ctx, lady ? lady.uid : null, home, [{ uid, ev: null, unit: u }], 'arrive');
  const a = auraOf(u);
  if (a) a.setCount(Math.round(bonus / 300));
}

if (LOOK_V3)
  registerEvent(
    'summon',
    async (ctx: Ctx<'summon'>) => {
      await ctx.base();
      const uid = ctx.ev.uid;
      // her own summon from the hand: the bless (the statChange run) is played inside her summon hook
      await arrivalBless(ctx as unknown as AnyCtx, uid, ctx.stateNext);
    },
    { priority: 30, name: `kart-f:${ID}:arrive` },
  );

if (LOOK_V3)
  registerEvent(
    'flip',
    async (ctx: Ctx<'flip'>) => {
      const ev = ctx.ev;
      // her own flip (round 2 #2): the shared flip's generic beast roar (summon-b/flip.ts roarSmall / roarBig on the
      // rise) is skipped — her song (khSong, the bless below) is her one voice
      if (ctx.cardId(ev.uid) === ID) {
        const sfx0 = ctx.sfx;
        ctx.sfx = (name, opts) => {
          if (name !== 'roarSmall' && name !== 'roarBig') sfx0(name, opts);
        };
        try {
          await ctx.base();
        } finally {
          ctx.sfx = sfx0;
        }
      } else await ctx.base();
      if (ev.cause !== 'flipSummon' && ev.cause !== 'attacked') return;
      const uid = ev.uid;
      // a lady flipped: her statChange run follows (after the paired summon) — bless now, before a sync snaps it
      if (ctx.cardId(uid) === ID) {
        const run = takeAuraRun(ctx as unknown as AnyCtx, ctx.index + 1, 1, { through: (e) => e.type === 'summon' && e.uid === uid });
        await playRun(ctx as unknown as AnyCtx, run, ev.cause === 'attacked' ? 'compact' : 'full');
        return;
      }
      const end = ctx.stateAt(Math.min(ctx.events.length, ctx.index + 2));
      if (ev.cause === 'attacked') {
        // silent: the crest blooms, no current (the battle's tempo stays)
        const u = ctx.unit(uid);
        const b = bonusIn(end, uid);
        if (u && b > 0 && !auraOf(u)) blessUnit(ctx as unknown as AnyCtx, u, Math.round(b / 300), true);
        return;
      }
      await arrivalBless(ctx as unknown as AnyCtx, uid, end);
    },
    { priority: 30, name: `kart-f:${ID}:flip` },
  );

// ================================================================ the declaration flare (a buffed ally attacks)

if (LOOK_V3)
  registerEvent(
    'attackDeclare',
    async (ctx: Ctx<'attackDeclare'>) => {
      const u = ctx.unit(ctx.ev.attackerUid);
      const a = auraOf(u);
      if (u && a && !a.folding && bonusIn(ctx.state, u.uid) > 0) {
        a.flare();
        play('khCrest', { volume: 0.35, pan: panAt(u.home.x) });
      }
      return ctx.base();
    },
    { priority: 25, name: `kart-f:${ID}:declare` },
  );

// ================================================================ summon "Rüzgâr Kapısı"

/**
 * Her materialisation out of the floor light: the glide frame appears as a SOLID sunlit silhouette that steps down
 * the gold ramp (gold4 → gold3 → gold2, one palette step per frame) and then shows her own colours — flat palette
 * steps, no dither / scan-line hologram (critique r1 #13).
 */
function goldOnset(sc: Phaser.Scene, u: MonsterUnit): Promise<void> {
  const s = u.sprite;
  const tones = [PAL.gold4, PAL.gold3, PAL.gold2];
  return animate(sc, tones.length * STEP_MS, (t) => {
    if (!s.active) return;
    if (t >= 1) s.clearTint();
    else s.setTintFill(tones[Math.min(tones.length - 1, Math.floor(t * tones.length))]);
  }).then(() => {
    if (s.active) s.clearTint();
  });
}

/** The first of the six back-wing beat frames (summon f4). */
const first0 = 4;

/** The salute's floor wing: span 12 → 24 → 36 over three frames (tone 3), then tone 3 → 2 → 1 → gone in 300 ms. */
function saluteWing(sc: Phaser.Scene, home: XY): Promise<void> {
  const px = layer(sc, FLOOR_DEPTH + 1);
  const open = 3 * STEP_MS;
  return animate(sc, open + 300, (_t, el) => {
    px.clear();
    if (el >= open + 300) return;
    if (el < open) {
      const k = Math.min(2, Math.floor(el / STEP_MS));
      paintFloorLight(px, home.x, home.y - 1, 12 + k * 12, 3);
      return;
    }
    const k = Math.min(2, Math.floor(((el - open) / 300) * 3));
    paintFloorLight(px, home.x, home.y - 1, 36 - k * 2, (3 - k) as 1 | 2 | 3);
  }).then(() => px.g.destroy());
}

async function glideIn(S: Stage, rush0: { stop(ms?: number): void } | null): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const home = { ...S.home };
  const facing = u.flipX ? -1 : 1;
  // ---- the start: along her own lane row from behind her back, 95 px out, clamped to the board
  const zone = S.ev.zone;
  const nb = zoneXY(S.player, 'monster', zone === 0 ? 1 : zone - 1);
  let rx = nb.x - home.x;
  let ry = nb.y - home.y;
  const L = Math.hypot(rx, ry) || 1;
  rx /= L;
  ry /= L;
  if (Math.sign(rx) !== -facing) {
    rx = -rx;
    ry = -ry;
  }
  let far = 95;
  const bx = home.x + rx * far;
  if (bx < 22 && rx < 0) far = (22 - home.x) / rx;
  if (bx > 618 && rx > 0) far = (618 - home.x) / rx;
  const startFloor = rint({ x: home.x + rx * far, y: home.y + ry * far });
  const hoverY = 14;
  const lift0 = 30;
  // ---- 0–200: a sunlit wing of floor light sweeps in ahead of her
  const glow = layer(sc, FLOOR_DEPTH + 1);
  const pan0 = panAt(startFloor.x);
  // the rush was started under the card slam by the summon hook (round 2 #5: a far air out of silence)
  const rush = rush0 ?? start('khGlideIn', { volume: 0.9, pan: pan0 });
  let lightAt = { ...startFloor };
  let lightSpan = 6;
  let lightTone: 1 | 2 | 3 = 1;
  const stopLight = onFrame(sc, () => {
    glow.clear();
    paintFloorLight(glow, Math.round(lightAt.x), Math.round(lightAt.y) - 1, lightSpan, lightTone);
    return true;
  });
  const pool = lightPool(sc, startFloor.x, startFloor.y, { color: PAL.gold3, spill: PAL.gold1, radius: 16, floorY: startFloor.y, intensity: 0.4, fadeIn: 120 });
  S.own({ destroy: () => (pool.alive ? void pool.fadeOut(200) : undefined) });
  await animate(sc, 160, (t) => {
    const k = E.outQ(t);
    lightAt = { x: startFloor.x + (home.x - startFloor.x) * k * 0.35, y: startFloor.y + (home.y - startFloor.y) * k * 0.35 };
    lightSpan = 6 + Math.floor(t * 4) * 3;
    lightTone = t < 0.33 ? 1 : t < 0.66 ? 2 : 3;
    pool.setPosition(lightAt.x, lightAt.y, lightAt.y);
  });
  // ---- 200: she appears behind, 30 px up, gliding level (summon f0), the hologram onset riding the glide
  u.pose('summon', 0);
  const p0 = { x: startFloor.x + (home.x - startFloor.x) * 0.2, y: startFloor.y + (home.y - startFloor.y) * 0.2 };
  setFeet(u, { x: p0.x, y: p0.y - lift0 }, p0, DEPTH.FX - 6);
  u.showSprite();
  void goldOnset(sc, u);
  const streams = layer(sc, DEPTH.FX - 5);
  let prev = { ...p0, y: p0.y - lift0 };
  const GLIDE = 360;
  await animate(sc, GLIDE, (t) => {
    const k = Math.sin((t * Math.PI) / 2);
    const fl = { x: p0.x + (home.x - p0.x) * k, y: p0.y + (home.y - p0.y) * k };
    const lift = lift0 + (hoverY - lift0) * k;
    const at = { x: fl.x, y: fl.y - lift };
    setFeet(u, at, fl, DEPTH.FX - 6);
    if (t > 0.5 && u.frameInfo().frame < 1) u.pose('summon', 1);
    lightAt = fl;
    lightSpan = 18;
    lightTone = 3;
    pool.setPosition(fl.x, fl.y, fl.y);
    // the slipstreams off both wingtips (whole pixels, 3 palette steps)
    streams.clear();
    const vel = { x: at.x - prev.x, y: at.y - prev.y };
    if (Math.hypot(vel.x, vel.y) > 0.2) {
      slip(streams, pointNow(u, 'staff', at), vel, 9);
      slip(streams, pointNow(u, 'claw', at), vel, 7);
    }
    prev = at;
  });
  streams.g.destroy();
  // ---- 620: the brake-flare (f2–f3), the W; the rush's tail runs on under the first backwing downstroke and lets
  // go 80 ms after it (round 2 #5: no hole between the glide and the beats)
  atFrame(u, 'summon', first0 + 1, () => void sleep(sc, 80).then(() => rush.stop(160)), { late: true, maxMs: 1600 });
  void sleep(sc, 1200).then(() => rush.stop(200));
  // the brake runs a touch quicker than the table, the run-out and fold quicker still (the salute must come
  // while the glide is still in the eye: summon + bless ≤ 2.4 s scene, critique 7)
  const brake = u.playRange('summon', 2, undefined, { timeScale: 1.25 });
  const landF = u.markFrame('summon', 'land', 7);
  atFrame(u, 'summon', landF + 1, () => {
    if (u.sprite.active && u.frameInfo().anim === 'summon') u.sprite.anims.timeScale = 1.6;
  }, { late: true, maxMs: 2200 });
  // three back-wing beats over six frames (mid · down · mid · up · mid · down, summon f4–f9): the sprite bobs in
  // its own frames, the cinematic sinks her toward the floor under it; a beat sound and a crescent on each downstroke
  const first = first0;
  const lifts = [10, 8, 6, 5, 3, 1];
  for (let b = 0; b < lifts.length; b++) {
    const f = first + b;
    const down = b === 1 || b === 5;
    const up = b === 3;
    atFrame(
      u,
      'summon',
      f,
      () => {
        if (down || up) play('khWingBeat', { volume: up ? 0.55 : b === 1 ? 0.8 : 0.6, pan: panAt(home.x) });
        const fl = { ...home };
        setFeet(u, { x: fl.x, y: fl.y - lifts[b] }, fl, DEPTH.FX - 6);
        if (down) void crescent(sc, { x: home.x + facing * 6, y: home.y + 1 }, facing, b === 1 ? 12 : 9);
        lightSpan = 18 - (b >> 1);
      },
      { late: true, maxMs: 1600 },
    );
  }
  atFrame(
    u,
    'summon',
    landF,
    () => {
      setFeet(u, home);
      play('khBackwing', { volume: 0.9, pan: panAt(home.x) });
      void lightFlash(sc, home.x, home.y, PAL.gold3, 20, 200, { floorY: home.y, intensity: 0.6 });
      stopLight();
      glow.g.destroy();
      if (pool.alive) void pool.fadeOut(300);
    },
    { late: true, maxMs: 2000 },
  );
  atFrame(u, 'summon', landF + 1, () => play('khToe', { volume: 0.7, pan: panAt(home.x) }), { late: false, maxMs: 2200 });
  // two frames on: the jewel glints (a soft shimmer bridging the land and the song, round 2 #5)
  atFrame(u, 'summon', landF + 2, () => play('khJewel', { volume: 0.7, pan: panAt(home.x) }), { late: false, maxMs: 2400 });
  // ---- the salute (f11): the jewel flares, she sings her first note, the badge pops
  const saluteF = landF + 4;
  await untilShown(u, 'summon', saluteF, 2600);
  stopLight();
  if (glow.g.active) glow.g.destroy();
  setFeet(u, home);
  jewelFlare(sc, u, 140);
  singSong(sc, { volume: 0.85, pan: panAt(home.x) });
  // the salute's own word (round 2 #3: no shared finale ring around the tile): her wing-shaped floor light flares
  // OPEN under her at twice the aura's span in three steps and settles to nothing — the same gold wing the aura
  // will lay under every buffed ally; then the badge pops
  void saluteWing(sc, home);
  void lightFlash(sc, home.x, home.y - 2, PAL.gold3, 26, 360, { floorY: home.y, intensity: 0.6 });
  void u.badge.pop();
  // the bless (if any) launches off the salute's flare; alone, she holds the salute out
  const blessNext = S.ctx.events.some((e, i) => i > S.ctx.index && e.type === 'statChange');
  await capped(sc, brake, blessNext ? 90 : 600);
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from !== 'hand') return ctx.base();
      // the rush starts under the card slam (round 2 #5: the far air rises out of silence while the card lands)
      const rush = start('khGlideIn', { volume: 0.9, pan: panAt(zoneXY(ctx.ev.player, 'monster', ctx.ev.zone).x) });
      try {
        await runSummon(ctx, async () => undefined, (S) => glideIn(S, rush));
      } finally {
        void sleep(ctx.scene, 1600).then(() => rush.stop(200));
      }
      // Kanat Selamı follows at once (inside this handler: no sync snaps the allies' plates in between)
      const run = takeAuraRun(ctx as unknown as AnyCtx, ctx.index + 1, 0);
      await playRun(ctx as unknown as AnyCtx, run, 'afterSummon');
    },
    { priority: 20, name: `kart-f:${ID}:summon` },
  );

// ================================================================ strike "Kerkenez Hamlesi"

/** The clap brackets: two 1-px gold arcs closing around `c` (front / back), then 6 dashes flying out. `fail`: they bend outward. */
function clapFx(sc: Phaser.Scene, c: XY, h: number, dir: number, fail: boolean): Promise<void> {
  const px = layer(sc, DEPTH.FX + 4);
  const H = Math.round(h / 2);
  return animate(sc, 230, (t) => {
    px.clear();
    if (t >= 1) return;
    const f = Math.floor(t * 5); // 0 closing, 1 closed, 2–4 dashes
    if (f <= 1) {
      const gap = f === 0 ? 15 : fail ? 16 : 10;
      for (const s of [-1, 1]) {
        for (let y = -H; y <= H; y++) {
          const bow = Math.round(((H * H - y * y) / (H * H)) * 3);
          const x = c.x + s * dir * (gap + (fail ? bow : -bow + 3));
          px.dot(x, c.y + y, Math.abs(y) > H - 2 ? PAL.gold4 : PAL.gold3);
        }
      }
      return;
    }
    const k = f - 2;
    const tone = [PAL.gold3, PAL.gold2, PAL.gold1][k];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const r = 8 + k * 5;
      const x = Math.round(c.x + Math.cos(a) * r);
      const y = Math.round(c.y + Math.sin(a) * r * 0.8 + (fail ? k * 3 : 0));
      px.dot(x, y, tone).dot(x + Math.sign(Math.cos(a)), y, tone);
    }
  }).then(() => px.g.destroy());
}

/** Beat arcs off the wingtips on a hover downstroke (3 px, 1 frame). */
function beatArcs(sc: Phaser.Scene, u: MonsterUnit): void {
  const px = layer(sc, u.sprite.depth + 0.4);
  for (const n of ['staff', 'claw'] as MonsterPointName[]) {
    const p = pointNow(u, n, u.core());
    px.dot(p.x - 1, p.y + 2, PAL.gold1).dot(p.x, p.y + 3, PAL.gold1).dot(p.x + 1, p.y + 2, PAL.gold1);
  }
  void sleep(sc, STEP_MS).then(() => px.g.destroy());
}

async function kestrel(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const home = { ...u.home };
  const dir = u.flipX ? -1 : 1;
  const pan = panAt(home.x);
  const charge = takeCharge(u, 'khHover', { volume: 0.85, pan });
  const conF = u.markFrame('attack', 'contact', 6);
  const relF = u.markFrame('attack', 'release', 5);
  // the follow-through after the clap (sprite order): open (the brackets spring outward / fail on a guard) ·
  // sweep (wings level) · rebound (wings up) · two back-flaps · touch down
  const F = { open: conF + 1, sweep: conF + 2, rebound: conF + 3 };
  const loses = s.ctx.ev.result === 'attackerDestroyed' || s.ctx.ev.result === 'bothDestroyed';
  const aim: XY = s.direct || !s.target || !s.target.sprite.active ? { x: s.to.x, y: s.to.y } : s.target.core();
  const tip = artPoint(u, 'attack', conF, 'muzzle') ?? u.art.muzzle;
  let goal = rint(contactFeet(u, tip.x, tip.y, aim, s.direct ? 8 : s.blocked ? 9 : 3));
  if (s.direct) {
    const dx = goal.x - home.x;
    const dy = goal.y - home.y;
    const Ld = Math.hypot(dx, dy);
    if (Ld > 70) goal = rint({ x: home.x + (dx / Ld) * 70, y: home.y + (dy / Ld) * 70 });
  }
  const streams = layer(sc, DEPTH.FX - 3);
  u.posed = true;
  try {
    // ---- f1 → f2: one big downstroke, she rises 14 px (the shadow stays on the floor)
    if (strikeStartFrame(u) < 1) u.pose('attack', 1);
    await sleep(sc, 40);
    u.pose('attack', 2);
    beatArcs(sc, u);
    await animate(sc, 100, (t) => setFeet(u, { x: home.x, y: home.y - 14 * E.outQ(t) }, home));
    // ---- the hover: f2 / f3 alternating every 60 ms, the head locked
    const beats = s.direct ? 3 : 4;
    for (let b = 0; b < beats; b++) {
      u.pose('attack', b % 2 === 0 ? 3 : 2);
      if (b % 2 === 1) beatArcs(sc, u);
      await sleep(sc, 60);
      if (!u.sprite.active) return;
    }
    // ---- f4: the fold — a tiny drop
    u.pose('attack', 4);
    setFeet(u, { x: home.x, y: home.y - 12 }, home);
    await sleep(sc, 60);
    // ---- f5 release: the stoop — a flat line, sword first, gold slipstreams off the folded wingtips
    u.pose('attack', relF);
    charge.stop(60);
    play('khStoop', { volume: 0.9, pan });
    const startP = { x: home.x, y: home.y - 12 };
    const goalAir = { x: goal.x, y: goal.y - (s.direct ? 6 : 0) };
    const stoopMs = s.direct ? 240 : 200;
    let prev = startP;
    const over = s.target && !s.direct ? s.target.sprite.depth + 1 : undefined;
    await animate(sc, stoopMs, (t) => {
      const k = E.inQ(t);
      const p = { x: startP.x + (goalAir.x - startP.x) * k, y: startP.y + (goalAir.y - startP.y) * k };
      const ground = { x: home.x + (goal.x - home.x) * k, y: home.y + (goal.y - home.y) * k };
      setFeet(u, p, ground, t > 0.6 ? over : undefined);
      streams.clear();
      const vel = { x: p.x - prev.x, y: p.y - prev.y };
      if (Math.hypot(vel.x, vel.y) > 0.2) {
        slip(streams, pointNow(u, 'staff', p), vel, 10);
        slip(streams, pointNow(u, 'claw', p), vel, 8);
      }
      prev = p;
    });
    streams.clear();
    // ---- f6 contact: the wing clap
    u.pose('attack', conF);
    const tipNow = pointNow(u, 'muzzle', aim);
    // her clap / cry / skid IS the contact (round 2 #2): the battle's generic body blow (impactHeavy / impactLight,
    // the duelist's on a direct hit) and the guard's shield bell are skipped inside the contact call; a struck body
    // with its own material still answers, re-played ~7 dB under her accent (the reed_heron precedent)
    const tgt = s.target && !s.direct && s.target.sprite.active ? s.target : null;
    const mats = tgt ? [hitSoundFor(tgt, { kind: 'physical', heavy: true }), hitSoundFor(tgt, { kind: 'physical', heavy: false })].filter((x): x is SfxName => !!x) : [];
    const generic: SfxName[] = ['impactHeavy', 'impactLight', ...(s.blocked ? (['shieldBlock'] as SfxName[]) : []), ...mats];
    hush(generic, () => s.impact(tipNow));
    const struck = tgt ? hitSoundFor(tgt, { kind: 'physical', heavy: !s.blocked }) : null;
    if (struck) play(struck, { volume: s.blocked ? 0.5 : 0.45, pan: panAt(tipNow.x) });
    const tgtH = s.target && !s.direct ? Math.max(14, Math.min(30, Math.abs(s.target.worldPoint('top').y - s.target.home.y) * 0.6)) : 10;
    const centre = s.target && !s.direct ? s.target.core() : { x: tipNow.x, y: tipNow.y };
    void clapFx(sc, rint(centre), s.direct ? 10 : tgtH, dir, s.blocked);
    if (s.blocked) play('khSkid', { volume: 0.95, pan: panAt(tipNow.x) });
    else if (s.direct) play('khDirectCry', { volume: 0.95, pan: panAt(tipNow.x) });
    else play('khClap', { volume: 1, pan: panAt(tipNow.x) });
    void lightFlash(sc, centre.x, centre.y, PAL.gold3, 18, 160, { floorY: s.target?.home.y ?? s.toGround.y, air: 1, intensity: 0.6 });
    if (loses) {
      await sleep(sc, 34);
      return;
    }
    // blocked: the battle claims her animation on this frame for its generic recoil (battle.ts recoilAfterStop);
    // the perch is HER answer, so a stand-in image of her own frames carries it from the contact frame on while
    // the claimed sprite plays the recoil hidden underneath (kite_fencer's blocked bow does the same)
    const spr = u.sprite;
    const stand = s.blocked && s.target && s.target.sprite.active
      ? sc.add.image(spr.x, spr.y, spr.texture.key, `attack:${conF}`).setOrigin(spr.originX, spr.originY).setFlipX(spr.flipX).setDepth(s.target.sprite.depth + 1)
      : null;
    if (stand) spr.setVisible(false);
    // the clap holds its contact beat (the class hit-stop rides on top)
    await sleep(sc, 60);
    const f6 = feetOf(u);
    if (stand && !(s.target && s.target.sprite.active)) {
      stand.destroy();
      if (spr.active) spr.setVisible(true);
    }
    if (stand && stand.active && s.target && s.target.sprite.active) {
      // ---- blocked: she STAYS in contact while the brackets bend outward on the guard (the open pose, a 1-px
      // shiver), then rises straight off the contact point onto the defender's head along a short arc with an
      // anticipation dip; the rebound pose is the arc's apex and the perch; the feet plant with a 1-px squash
      const tc = s.target.core();
      const th = s.target.home;
      const top = s.target.worldPoint('top');
      const perch = rint({ x: tc.x - dir * 3, y: Math.max(top.y + 10, tc.y - (th.y - tc.y) + 6) });
      const dTop = s.target.sprite.depth + 1;
      const img = stand;
      const show = (f: number, p: XY) => {
        setFeet(u, p, goal, dTop);
        if (img.active) img.setFrame(`attack:${f}`).setPosition(Math.round(p.x), Math.round(p.y - u.art.hover)).setDepth(dTop);
      };
      try {
        for (let k = 0; k < 3; k++) {
          show(F.open, { x: f6.x - dir * (k % 2), y: f6.y });
          await sleep(sc, 25);
        }
        // the anticipation dip (2 px down) with the wings sweeping level
        show(F.sweep, { x: f6.x, y: f6.y + 2 });
        await sleep(sc, 34);
        const apex = { x: (f6.x + perch.x) / 2, y: Math.min(f6.y, perch.y) - 7 };
        await animate(sc, 130, (t) => show(t > 0.35 ? F.rebound : F.sweep, quad({ x: f6.x, y: f6.y + 2 }, apex, perch, E.outQ(t))));
        // plant: a 1-px squash (one frame down), then the perch beat
        show(F.rebound, { x: perch.x, y: perch.y + 1 });
        play('khPerch', { volume: 0.9, pan: panAt(perch.x) });
        await sleep(sc, 34);
        show(F.rebound, perch);
        await sleep(sc, 90);
      } finally {
        img.destroy();
        if (spr.active) spr.setVisible(true);
      }
      // the recoil is over (or cut): the sprite is hers again
      if (u.claimed) u.unclaim();
      if (u.retired || !u.sprite.active) return;
      u.pose('attack', F.rebound);
      setFeet(u, perch, goal, dTop);
      // the kick: the defender is pushed 1 px down for two frames
      const ts = s.target.sprite;
      const ty = ts.y;
      if (ts.active && !s.target.posed) {
        ts.y = ty + 1;
        void sleep(sc, 2 * STEP_MS).then(() => {
          if (ts.active && Math.abs(ts.y - (ty + 1)) < 0.01) ts.y = ty;
        });
      }
      play('khKickOff', { volume: 0.85, pan: panAt(perch.x) });
      u.pose('attack', F.rebound + 1);
      // a short push back off the head (not a climb: high over the back rows she would read as standing there)
      const kick = { x: perch.x - dir * 12, y: perch.y - 3 };
      await animate(sc, 120, (t) => setFeet(u, { x: perch.x + (kick.x - perch.x) * E.outQ(t), y: perch.y + (kick.y - perch.y) * E.outQ(t) }, home));
      await flapHome(u, kick, home, 340, false, F.rebound + 1);
    } else if (s.direct) {
      // ---- direct: she bursts up off the clap (open → sweep → rebound, moving together) and the wind carries her
      // home on a high backward arc
      const top = { x: (f6.x + home.x) / 2, y: Math.min(f6.y, home.y) - 26 };
      await animate(sc, 340, (t) => {
        const p = quad(f6, top, { x: home.x, y: home.y - 3 }, E.inOutQ(t));
        const ground = { x: f6.x + (home.x - f6.x) * t, y: goal.y + (home.y - goal.y) * t };
        setFeet(u, p, ground);
        const want = t < 0.08 ? F.open : t < 0.18 ? F.sweep : t < 0.4 ? F.rebound : t < 0.7 ? F.rebound + 1 : F.rebound + 2;
        if (u.frameInfo().frame !== want) {
          u.pose('attack', want);
          if (want > F.rebound) play('khWingBeat', { volume: want === F.rebound + 1 ? 0.5 : 0.45, pan: panAt(p.x) });
        }
      });
      await touchDown(u, home, F.rebound + 3);
    } else {
      // ---- normal: the recoil — the brackets open, the torso unrolls head-first, the wings sweep up through
      // level to the rebound pose WHILE she is carried 8 back / 4 up (Quad.Out from the contact frame: position and
      // pose change together over five game frames), then two back-flaps home, still facing it
      const rb = { x: f6.x - dir * 8, y: f6.y - 4 };
      await animate(sc, 170, (t) => {
        const k = E.outQ(t);
        setFeet(u, { x: f6.x + (rb.x - f6.x) * k, y: f6.y + (rb.y - f6.y) * k }, goal);
        const want = t < 0.25 ? F.open : t < 0.5 ? F.sweep : F.rebound;
        if (u.frameInfo().frame !== want) u.pose('attack', want);
      });
      await flapHome(u, rb, home, 430, false, F.rebound + 1);
    }
  } finally {
    charge.stop(80);
    streams.g.destroy();
    u.posed = false;
    const settle = () => {
      if (u.sprite.active && !u.retired && u.frameInfo().anim !== 'death' && !u.posed) {
        setFeet(u, home);
        if (u.frameInfo().anim === 'attack') u.rest();
      }
    };
    // she lost: she falls where she struck (the death follows 150 ms after contact); a save sends her home later
    if (loses && u.sprite.active) {
      setFeet(u, feetOf(u));
      void sleep(sc, 900).then(settle);
    } else settle();
  }
}

/** Two strong back-beats (attack f8 / f9) along a shallow arc to just above her tile, then the touch down. */
async function flapHome(u: MonsterUnit, from: XY, home: XY, ms: number, high: boolean, back1: number): Promise<void> {
  const sc = u.scene;
  // a descending arc: from a high start (the perch) she sinks all the way home instead of cruising at head height
  const mid = { x: (from.x + home.x) / 2, y: Math.min(Math.min(from.y, home.y) + Math.abs(home.y - from.y) * 0.45, Math.max(from.y, home.y) - 4) - (high ? 10 : 6) };
  let beat = 0;
  await animate(sc, ms, (t) => {
    const p = quad(from, mid, { x: home.x, y: home.y - 2 }, E.inOutQ(t));
    setFeet(u, p, { x: from.x + (home.x - from.x) * t, y: home.y });
    const want = t < 0.5 ? 1 : 2;
    if (want > beat) {
      beat = want;
      u.pose('attack', want === 1 ? back1 : back1 + 1);
      play('khWingBeat', { volume: 0.55, pan: panAt(p.x) });
    }
  });
  await touchDown(u, home, back1 + 2);
}

async function touchDown(u: MonsterUnit, home: XY, touchF: number): Promise<void> {
  u.pose('attack', touchF);
  setFeet(u, home);
  play('khToe', { volume: 0.6, pan: panAt(home.x) });
  await sleep(u.scene, u.frameMs('attack', touchF));
  u.pose('attack', touchF + 1);
  await sleep(u.scene, Math.min(120, u.frameMs('attack', touchF + 1)));
}

if (LOOK_V3) registerStrike(ID, (s) => kestrel(s), { priority: 20, name: `kart-f:${ID}:strike` });

// ================================================================ guard "Kanat Kalkanı": her own guard read

/**
 * A blow on her guard: the shared hex-shield glint (MonsterUnit.guardHit) is hidden on the contact frame — her
 * buckler wing IS the shield — and a gold feather-edge spark runs along the buckler's leading edge (gold4 → gold3 →
 * gold2 over three frames) with three short gold dashes thrown back along the blow. The pose answer is the sprite's:
 * guardHit's brace plays toGuard f4 (the buckler flares) → f3 (it bends, the shoulders rock back) → guard.
 */
function featherEdgeSpark(sc: Phaser.Scene, u: MonsterUnit, face: number): void {
  const tip = pointNow(u, 'staff', u.core());
  const c = u.core();
  const wrist = rint({ x: c.x + face * 3, y: c.y - 6 });
  const path = pixelPath([wrist, { x: (wrist.x + tip.x) / 2 + face * 2, y: (wrist.y + tip.y) / 2 - 1 }, tip]);
  const px = layer(sc, u.sprite.depth + 0.7);
  // round 2 #10: five frames (gold4 held two, then gold3, gold3, gold2) and 5–7 px dashes with a gold4 head, so the
  // buckler is the readable event of the blow at 1×
  const tones = [PAL.gold4, PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold2];
  void animate(sc, tones.length * STEP_MS, (t) => {
    px.clear();
    if (t >= 1) return;
    const f = Math.min(tones.length - 1, Math.floor(t * tones.length));
    const tone = tones[f];
    const step = Math.max(0, f - 1);
    path.forEach((p, i) => {
      if (f <= 1 || (i + f) % 2 === 0) {
        px.dot(p.x + face * step, p.y, tone);
        if (f <= 1) px.dot(p.x + face * step, p.y - 1, PAL.gold3);
      }
    });
    for (let k = 0; k < 4; k++) {
      const p = path[Math.min(path.length - 1, Math.round(((k + 1) * path.length) / 5))];
      const d = 2 + f * 2;
      const len = k % 2 === 0 ? 7 : 5;
      const y = p.y - k + 1;
      // a dash flying back along the blow: dim tail at the buckler, the gold4 head leading
      for (let j = 0; j < len; j++) px.dot(p.x + face * (d + j), y, j >= len - 2 ? PAL.gold4 : j >= len - 4 ? tone : PAL.gold2);
    }
  }).then(() => px.g.destroy());
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'defend',
    async (ctx) => {
      const ev = ctx.ev;
      const u = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
      if (!u || ev.targetPosition !== 'defense' || !u.has('toGuard')) return ctx.base();
      const sc = ctx.scene;
      const onContact = (uid: unknown) => {
        if (uid !== ev.attackerUid) return;
        sc.events.off('v3:contact', onContact);
        if (!u.sprite.active || !u.guarding) return;
        const before = new Set(sc.children.list);
        const face = u.flipX ? -1 : 1; // she faces the attacker
        // her buckler owns the beat's sound (round 2 #2): the struck-body call plays khBuckler (CharacterSounds.struck
        // .guard); the battle's generic shield bell / impact, played synchronously right after this event (vfx/combat
        // blockClang, combatImpact), stay off for this call and anything already ringing fades (shield_titan precedent)
        setCombatSfx(false);
        queueMicrotask(() => {
          setCombatSfx(true);
          fade(['shieldBlock', 'impactLight', 'impactHeavy'], 12);
        });
        const bodyD = u.sprite.depth;
        const hide = onFrame(sc, (_dt, el) => {
          const want = u.sprite.depth + 0.5;
          for (const o of sc.children.list) {
            if (before.has(o)) continue;
            // the shared impact burst drawn just behind the struck body (_v3/react.ts behindBody: the white star, the
            // air rings and the cyan (water-ramp) sparks at depth − 0.4 … − 0.1): hidden — her gold spark is the read
            const od = (o as unknown as { depth?: number }).depth;
            if (typeof od === 'number' && od >= bodyD - 0.45 && od < bodyD - 0.05 && 'setVisible' in o) (o as unknown as { setVisible(v: boolean): void }).setVisible(false);
            if (o.type === 'Image' && (o as Phaser.GameObjects.Image).texture.key.startsWith('fx:cflash:')) {
              // the shared white contact disc on her body (_v3/flash.ts; it re-applies its visibility each frame, so
              // it is cropped to nothing — the reed_heron precedent): the gold buckler spark is the contact read
              (o as Phaser.GameObjects.Image).setCrop(0, 0, 0, 0);
            } else if (o.type === 'Image') {
              // the hex-shield glint (MonsterUnit guardGlint: an ADD raster at the body's depth + 0.5)
              const im = o as Phaser.GameObjects.Image;
              if (im.blendMode === 1 && Math.abs(im.depth - want) < 0.01 && im.texture.key.startsWith('fx:set:')) im.setVisible(false);
            } else if (o.type === 'Graphics') {
              // the battle's hex-plate clang (vfx blockClang: graphics at DEPTH.FX + 0.1 / + 0.2; reed_heron hides it too)
              const g = o as Phaser.GameObjects.Graphics;
              if (Math.abs(g.depth - (DEPTH.FX + 0.1)) < 1e-6 || Math.abs(g.depth - (DEPTH.FX + 0.2)) < 1e-6) g.setVisible(false);
            }
          }
          return el < 420;
        });
        void hide;
        featherEdgeSpark(sc, u, face);
      };
      sc.events.on('v3:contact', onContact);
      try {
        return await ctx.base();
      } finally {
        sc.events.off('v3:contact', onContact);
      }
    },
    { priority: 20, name: `kart-f:${ID}:guard` },
  );

// ================================================================ death "Düşen Pelerin"

/**
 * The bird silhouette — HER kestrel (round 2 #7, no longer a black bat stamp): the inner wings and the body in her
 * own rufous earth2 (an earth3 lit row on top) barred with night2 dashes, the pointed hands slate (night2 with a
 * night3 lit row), a 1-px night0 outline, and the gold rim on the LEADING (top) edge only. `span` half wingspan, `up`
 * wing lift (px at the tips), `dim` the far end of the flight (one tone darker), `flat` the cape slab on her back.
 */
function paintBird(px: Px, cx: number, cy: number, span: number, up: number, rim: number, dim = false, flat = false): void {
  const S = Math.max(2, Math.round(span));
  const set = new Set<string>();
  const put = (x: number, y: number) => set.add(`${x},${y}`);
  if (flat) {
    for (let x = -S; x <= S; x++) {
      const h = Math.max(1, Math.round(3 * Math.sqrt(1 - (x / (S + 1)) ** 2)));
      for (let y = 0; y < h; y++) put(cx + x, cy - y);
    }
  } else {
    // a kestrel seen from above: broad inner wings (5 px at the root), a wrist bend at 55 % of the span, pointed
    // slate-sharp hands with three primary fingers on the trailing edge, a 3-px body, a head and a fanned tail
    for (let x = -S; x <= S; x++) {
      const a = Math.abs(x) / S;
      // the leading edge: rises with the stroke, the hand swept back past the wrist
      const yc = Math.round(cy - up * a + (a > 0.55 ? (a - 0.55) * 6 : 0) - (a < 0.55 ? a * 2 : 1.1));
      let th = a < 0.2 ? 5 : a < 0.55 ? Math.round(5 - (a - 0.2) * 4) : Math.max(1, Math.round(3.6 - (a - 0.55) * 6));
      // primary fingers: every second column of the hand trails one pixel further
      if (a > 0.6 && Math.abs(x) % 2 === 0) th += 1;
      for (let y = 0; y < th; y++) put(cx + x, yc + y);
    }
    // body (3 px), head, a fanned tail
    for (let y = -2; y <= 5; y++) for (const dx of [-1, 0, 1]) put(cx + dx, cy + y);
    put(cx, cy - 3);
    put(cx, cy - 4);
    for (const dx of [-2, -1, 0, 1, 2]) put(cx + dx, cy + 6);
    for (const dx of [-3, -1, 1, 3]) put(cx + dx, cy + 7);
  }
  const lit = dim ? PAL.earth2 : PAL.earth3;
  const warm = dim ? PAL.earth1 : PAL.earth2;
  const bar = dim ? PAL.night1 : PAL.night2;
  const hand = dim ? PAL.night1 : PAL.night2;
  const handLit = dim ? PAL.night2 : PAL.night3;
  for (const k of set) {
    const [x, y] = k.split(',').map(Number);
    const top = !set.has(`${x},${y - 1}`);
    const dx = Math.abs(x - cx);
    const isHand = !flat && dx > Math.max(2, S * 0.55);
    let c: number;
    if (isHand) c = top ? handLit : hand;
    else if (top) c = lit;
    // the barring: short night2 dashes across the inner wing (every third column, below the lit row)
    else if (!flat && dx > 1 && dx % 3 === 1 && set.has(`${x},${y - 1}`) && set.has(`${x},${y + 1}`)) c = bar;
    else if (flat && dx % 4 === 2 && set.has(`${x},${y - 1}`)) c = bar;
    else c = warm;
    px.dot(x, y, c);
  }
  // the outline: gold on the leading (top) edge, night0 everywhere else
  for (const k of set) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const q = `${x + dx},${y + dy}`;
      if (set.has(q)) continue;
      const leading = dy === -1;
      px.dot(x + dx, y + dy, leading ? rim : PAL.night0);
    }
  }
}

async function fallingCape(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const field = ctx.views.field;
  const unit = field.unit(ev.uid);
  if (!unit || unit.retired || !unit.sprite.active || !unit.sprite.visible || !unit.has('death')) return ctx.base();
  const sc = ctx.scene;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  // the allies' +300s go with her: the aura run right after her toGraveyard
  const run = gi >= 0 ? takeAuraRun(ctx as unknown as AnyCtx, gi + 1, -1, { through: (e) => e.type === 'toGraveyard' || e.type === 'destroy' }) : [];
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  unit.badge.setVisible(false);
  unit.posed = true;
  const u = unit;
  const pan = panAt(home.x);
  const dir = u.flipX ? -1 : 1;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  let leave: Promise<void> | null = null;
  const born = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[wing_lady] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[wing_lady] card', e));
    else if (tile && tile.active) leave = tile.dissolve(420).then(() => (tile.active ? tile.destroy() : undefined)).catch(() => undefined);
    else leave = Promise.resolve();
  };
  ctx.scene.events.emit('v3:dying', u);
  let unbless: Promise<void> = Promise.resolve();
  try {
    const n = u.frameCount('death');
    const inDeath = () => u.frameInfo().anim === 'death';
    if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, (ctx.hints.push as XY | undefined) ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
    let planned = takePlannedEntry(u);
    if (!planned && !inDeath() && showsGuard(u)) {
      const g = planGuardBreak(u);
      if (g) {
        runGuardBreak(u, g);
        planned = takePlannedEntry(u);
      }
    }
    if (planned && !inDeath()) await capped(sc, untilShown(u, 'death', 0, 700), Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
    if (!inDeath() && u.sprite.active) {
      const st = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
      u.asClaimant(() => void u.playRange('death', st, undefined, { hold: true }));
    }
    const at = (f: number, cb: () => void) => atFrame(u, 'death', f, cb, { late: false, maxMs: 2400 });
    // f1: the song breaks off mid-note
    let brokeAt = -1e9;
    atFrame(
      u,
      'death',
      1,
      () => {
        brokeAt = sc.time.now;
        play('khSongBreak', { volume: 0.9, pan });
      },
      { late: true, maxMs: 2400 },
    );
    // f2: both wings fall over her like a cape (the jewel goes dark in the sprite); joined late, the fold still
    // follows the broken note by a beat instead of sitting on it
    atFrame(
      u,
      'death',
      2,
      () => {
        const gap = sc.time.now - brokeAt;
        if (gap < 80) void sleep(sc, 90 - gap).then(() => play('khFold', { volume: 0.9, pan }));
        else play('khFold', { volume: 0.9, pan });
      },
      { late: true, maxMs: 2400 },
    );
    // f4 dissolve: she tips forward — the allies' lights fold toward her
    atFrame(
      u,
      'death',
      u.markFrame('death', 'dissolve', 4),
      () => {
        play('khFlatten', { volume: 0.85, pan });
        // the unbless is its own beat, 120 ms after the flatten (round 2 #6; its peels follow it by 80 ms more)
        if (run.length) unbless = sleep(sc, 120).then(() => unblessBeat(ctx as unknown as AnyCtx, home, run.map((r) => ({ uid: r.ev.uid, ev: r.ev, unit: ctx.unit(r.ev.uid) }))));
      },
      { late: true, maxMs: 2400 },
    );
    at(7, () => play('khFallThud', { volume: 0.9, pan }));
    // the prone hold lives: the primaries settle a pixel a frame (death f7–f9 in the sprite), the braid slides, and
    // the jewel gives one last green flicker on f8 (a 1-px leaf3 dot over the dark jewel, two frames)
    at(8, () => {
      if (!u.sprite.active) return;
      const j = pointNow(u, 'head', u.core());
      const fl = layer(sc, u.sprite.depth + 0.3);
      fl.dot(j.x, j.y, PAL.leaf3);
      void sleep(sc, 2 * 17).then(() => fl.g.destroy());
    });
    await capped(sc, untilShown(u, 'death', n - 1, 1600), 1600);
    // ---- lift-off: the cape on her back rises as a gold-rimmed bird WHILE the body under it darkens into the floor
    // (three palette steps night2 → night1 → night0, then gone); the card is born once the bird is off her
    const spr = u.sprite;
    const body = spr.active ? { x: Math.round(spr.x + dir * 4), y: feetOf(u).y - 4 } : { x: home.x, y: home.y - 4 };
    play('khBirdFlight', { volume: 0.9, pan });
    let pile: XY = { x: home.x - dir * 60, y: home.y - 40 };
    try {
      pile = ctx.views.field.pile(owner, 'graveyard').topXY();
    } catch {
      /* keep */
    }
    // over the card that will be born on the same tile (the bird lifts off ABOVE it)
    const px = layer(sc, DEPTH.FX + 40);
    void lightFlash(sc, body.x, body.y, PAL.gold3, 22, 240, { floorY: home.y, intensity: 0.55 });
    // 4 frames: the cape slab lifts off her back → half wings → full bird (2–5 px a frame); the body fades by steps
    const fade = [PAL.night2, PAL.night1, PAL.night0];
    for (let k = 0; k < 4; k++) {
      px.clear();
      if (k === 0) paintBird(px, body.x, body.y - 1, 13, 0, PAL.gold3, false, true);
      else paintBird(px, body.x, body.y - 1 - k * 4, k === 1 ? 10 : k === 2 ? 14 : 17, k === 1 ? 1 : k === 2 ? 4 : 6, PAL.gold4);
      if (spr.active) {
        if (k < fade.length) spr.setTintFill(fade[k]);
        else spr.setVisible(false);
      }
      // the wings open fully: the first beat in the air
      if (k === 3) play('khBirdBeat', { volume: 0.75, pan });
      await sleep(sc, STEP_MS);
    }
    if (spr.active) {
      spr.setVisible(false);
      spr.clearTint();
    }
    const from = { x: body.x, y: body.y - 13 };
    const ctl = { x: (from.x + pile.x) / 2, y: Math.min(from.y, pile.y) - 34 };
    // the bird LEADS (round 2 #7): her card is born only once the bird is on its way (110 ms into the flight) and
    // follows it — the bird dives into the pile, the card lands after it (death ≤ 2.03 s game: flight 400 → 360 ms)
    let lastFlap = 0;
    await animate(sc, 360, (t, el) => {
      px.clear();
      if (el >= 110) born();
      if (t >= 1) return;
      const p = rint(quad(from, ctl, { x: pile.x, y: pile.y - 4 }, E.inOutQ(t)));
      const span = Math.max(8, Math.round(17 - Math.max(0, t - 0.4) * 16));
      const flap = Math.floor(t * 9) % 4;
      const up = flap === 0 ? 7 : flap === 1 ? 2 : flap === 2 ? -3 : 3;
      // a soft wing beat on each downstroke, panned along the path toward the graveyard (round 2 #6)
      if (flap === 2 && lastFlap !== 2) play('khBirdBeat', { volume: t < 0.5 ? 0.65 : 0.5, pan: panAt(p.x) });
      lastFlap = flap;
      const rim = t < 0.45 ? PAL.gold4 : t < 0.75 ? PAL.gold3 : PAL.gold2;
      paintBird(px, p.x, p.y, span, up, rim, t >= 0.8);
    });
    px.g.destroy();
  } catch (e) {
    console.error('[wing_lady] death failed', e);
  } finally {
    born();
    u.posed = false;
    if (!u.retired) u.retire(0);
    field.forget(ev.uid);
    ctx.scene.events.emit('v3:dead', u);
  }
  await unbless;
  await leave;
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'destroyed',
    (ctx) => {
      if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
      return fallingCape(ctx);
    },
    { priority: 20, name: `kart-f:${ID}:death` },
  );

// ================================================================ the aura's lifetime (observer)

/** An unplayed statChange of `uid` still waits in the batch (its handler will drive the beat). */
function pendingStat(ctx: AnyCtx, uid: Uid): boolean {
  for (let i = ctx.index; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'statChange' && e.uid === uid && !(i !== ctx.index && ctx.isConsumed(i))) return true;
  }
  return false;
}

if (LOOK_V3)
  registerObserver((ev, ctx) => {
    if (!ctx.scene.sys.isActive()) return;
    const s0 = ctx.state;
    const s1 = ctx.stateNext;
    for (const u of ctx.views.field.units()) {
      if (u.retired || BUSY.has(u.uid)) continue;
      const aura = auraOf(u);
      const b1 = bonusIn(s1, u.uid);
      if (aura && !aura.folding) {
        if (b1 === 0 && !pendingStat(ctx, u.uid) && ev.type !== 'destroy' && ev.type !== 'toGraveyard') {
          // a lady left without a beat of ours (a rebuild, a sweep): fold in place
          u.setAura(AURA_KEY, null);
        } else if (b1 > 0 && aura.count !== b1 / 300 && !pendingStat(ctx, u.uid)) aura.setCount(b1 / 300);
        continue;
      }
      // steady state only (the bonus was already on before this event): a rebuild dropped it, or a staged board
      const b0 = bonusIn(s0, u.uid);
      // (or a loss is about to be played on a staged board: show what it takes away, at once, no bloom)
      const steady = b0 > 0 && b1 > 0 && !pendingStat(ctx, u.uid);
      const losing = b0 > 0 && b1 < b0 && pendingStat(ctx, u.uid);
      if ((steady || losing) && u.sprite.visible && ev.type !== 'summon') {
        const field = ctx.views.field;
        const p = u.player;
        u.setAura(AURA_KEY, wingAura(ctx.scene, u, { count: (steady ? b1 : b0) / 300, bloom: steady, ladies: () => ladyUnitsOf(field, p) }) as never);
      }
    }
  });
