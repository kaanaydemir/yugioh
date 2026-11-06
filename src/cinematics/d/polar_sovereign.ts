// Kutup Hükümdarı (polar_sovereign, lane D, C15) — its own v3 fusion, strike, split and death (?look=v3 only; v1
// falls through to the chain below every hook, byte-identical). Pixel set pieces: ./_polar_sovereign-fx.ts; sounds:
// src/audio/v3/polar_sovereign.ts; the sprite's own frames: src/art/monsters-v3/polar_sovereign-anims.ts.
//
// FUSION (the special summon from the hand, ≈ 6.3 s with the cut-in; YENI_KARTLAR §C15 steps 1–5). The camera keeps
// only today's ace lean (EF-8: the same small integer pan the shared ace summon makes, zoom stays 1); the push-in is
// faked with the arena dimming and the light pools.
//   0.0  the tribute hook takes the three pieces: the arena dims, the sovereign's card rises from the hand over the
//        middle zone, the three pieces flare in their pole colours and an IRON-DUST COMPASS ROSE is drawn on the floor
//        across the three zones (sovereignDust)
//   0.8  the pieces RISE off their tiles humming their own pitches (sovereignRise), their cards peel off the tiles
//        under them and arc to the graveyard (a soft iron-dust tick each, never inside the KLAKs); the rose's grains are pulled in; the pieces fly over to the middle zone into the
//        exploded view the sprite's summon f0 draws
//   1.9  swap (a magnetic flash): the sovereign's sprite takes over on its summon frames — the anvil TUMBLES over
//        into the base → KLAK 1, the chest drops into the cup → KLAK 2, the needle splits into the arms + spear →
//        KLAK 3: each a 120 ms hit-stop, a white flash at the joint, a 3 / 4 / 5 px shake, each a whole tone lower
//   3.4  the ace cut-in "KUTUP HÜKÜMDARI!" (orange / blue split band) while the assembled body hangs in its field
//   4.6  the landing: the iron-dust shock ring, the gong, the crown forms on the pin, the spear struck down, ATK 3000
// STRIKE "Pusula Fırtınası": the declaration hums; the spear spins three turns as a compass card (sovereignCompass,
//   the ticks accelerate), locks on (TIK), is THROWN: it flies point first while the two-colour field lines close
//   round the target as a compass rose (sovereignRose); it pierces the rose's heart — the pole blast, the iron rain
//   (sovereignPierce), the heavy hit-stop + 20 ms of its own; the empty fist holds the tether and the spear snaps back
//   into it (sovereignRecall), to the shoulder, home.
// SPLIT (destroyed with the three pieces in the graveyard and three free zones): cracks run along the joints
//   (death f0…f3, sovereignCrack) while the field builds (sovereignStrain + seamSparks: sparks, arcs between the
//   seams, the body trembling harder), the field REPELS (sovereignRepel): the pieces fly apart on two-colour streaks
//   and hang over their zones — bobbing out of phase, arcs snapping between them, the chord held (sovereignHang from
//   the fling on); the destroying card leaves for its graveyard during the fling; then the effect hook drops each
//   piece from where its bob held it into its zone in defense (toGuard on the floor, an iron-dust puff, its pitch).
// DEATH (no split): the same cracks and repel; on the white flash frame the three PIECES are born where their parts
//   were and fall onto the tile, then each dies its OWN death with its own final material and sounds, staggered
//   (_polar_sovereign-finals: the needle ripped away spinning off-screen, the anvil's halves repelled apart as iron
//   plates, the coil unwound and its empty spool rolling off). No deathV3 / generic material break.

import { PAL, RAMPS } from '../../art/palette';
import type { CardId, MonsterId } from '../../data/cards';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightDim, lightFlash, lightPool, type LightHandle } from '../../view/light';
import { hitStop, shake, wait } from '../../vfx/core';
import { fx, registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { cardLeaves } from '../_v3/card';
import { CUTIN_BAND_SPLIT } from '../_v3/cutin';
import { atFrame, fade, hush, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { bg, run, runSummon, type Stage } from '../summon-a/_kit';
import { COIL_EXPLODED, NEEDLE_EXPLODED, RX as SRX } from '../../art/monsters-v3/polar_sovereign-rig';
import { ATTACK_CATCH, ATTACK_LOCK, ATTACK_THROW, DEATH_SPLIT, SUMMON_HOLD, SUMMON_KLAK, SUMMON_LAND, SUMMON_LIFT } from '../../art/monsters-v3/polar_sovereign-anims';
import { piecesFall, type FallingPiece } from './_polar_sovereign-finals';
import { dustRose, dustShock, flingPieces, landPuff, poleBlast, seamSparks, seedFx, spearShot, spearStuck, targetRose, type DustRose } from './_polar_sovereign-fx';

const ID = 'polar_sovereign';
const PIECES: readonly CardId[] = ['polar_needle', 'polar_anvil', 'polar_coil'];
type SummonEv = Extract<GameEvent, { type: 'summon' }>;
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

/** Where each piece's anchor sits in the summon's exploded view, relative to the sovereign's anchor (P1, px). The
 *  sovereign's anchor is its frame's RX + 6; see polar_sovereign-rig (anvil A, coil seat + COIL_EXPLODED, needle). */
const EXPLODED: Readonly<Record<string, XY>> = {
  // the upright anvil's floor point = the plinth origin A (x RX), its anchor RX + 1, hovering SUMMON_LIFT
  polar_anvil: { x: -5, y: -SUMMON_LIFT },
  // the coil (legs folded) seated COIL_EXPLODED px over its seat: its f1 → its anchor (legs 8 + 3 + 6 = 17 px under f1)
  polar_coil: { x: SRX + 1 - (SRX + 6), y: -SUMMON_LIFT - 30 - COIL_EXPLODED + 17 },
  // the closed needle drawn at R + NEEDLE_EXPLODED (its anchor is its root)
  polar_needle: { x: NEEDLE_EXPLODED[0] - 6, y: -SUMMON_LIFT + NEEDLE_EXPLODED[1] },
};
const POLE_COLOR: Readonly<Record<string, number>> = { polar_needle: PAL.fire4, polar_anvil: PAL.water4, polar_coil: PAL.gold4 };
/** the frame each piece holds its polar charge (`special`) at while the rose is drawn */
const SPECIAL_PEAK: Readonly<Record<string, number>> = { polar_needle: 5, polar_anvil: 4, polar_coil: 4 };
/** the fold in flight: each piece's own summon frames played backwards [from, to] — the anvil's arms tuck in (f10 →
 *  f7, arms 1 → 0), the coil's legs + whips wind back into the wire (f9 → f6), the needle closes (f16 → f12, LOCK) */
const FOLD: Readonly<Record<string, readonly [number, number]>> = { polar_anvil: [10, 7], polar_coil: [9, 6], polar_needle: [16, 12] };
/** the pieces' own pitches for their landing (needle A3 high, coil D3, anvil E2 low) */
const PIECE_PITCH: Readonly<Record<string, number>> = { polar_needle: 1.5, polar_coil: 1.12, polar_anvil: 0.8 };

/** Handed from the tribute pre-show to the summon entrance (same event batch, played in order). */
let pending: { rose: DustRose | null; pools: LightHandle[]; dimmed: boolean; tumble?: { stop(ms?: number): void } } | null = null;
/** The split's piece-sparks hanging over the landing zones, keyed by the sovereign's uid (destroyed → effect hook). */
const sparks = new Map<number, { zones: number[]; hangs: number[]; spread: number[]; h: ReturnType<typeof flingPieces>; hum: { stop(ms?: number): void } }>();
/** where a flung piece hangs before it drops: HANG px over its tile (default), HANGS by depth rank (back → front) */
const HANG = 30;
const HANGS = [16, 23, 30];
/** the hang's lateral spread by x rank (left → right), px */
const SPREAD = [-12, 0, 12];
/** the split's fling (kick → the field's brake), scene ms */
const FLING_MS = 720;
let lastSeam = -1;
const NO_HUM: { stop(ms?: number): void } = { stop: () => undefined };

const ease = (t: number) => t * t * (3 - 2 * t);

// the ace cut-in's band is split in its two poles: orange (N, fire) behind the portrait, blue (S, water) before it
if (LOOK_V3) CUTIN_BAND_SPLIT.set(ID as MonsterId, { back: RAMPS.fire, front: RAMPS.water });

// ================================================================ fusion: the pre-show (tribute hook)

registerCardHook(
  ID,
  'tribute',
  async (ctx) => {
    const ev = ctx.ev;
    if (!LOOK_V3) return ctx.base();
    const di = ctx.find((e) => e.type === 'summon' && e.uid === ev.forUid);
    const dEv = di >= 0 ? (ctx.events[di] as SummonEv) : null;
    if (!dEv || dEv.from !== 'hand' || dEv.method !== 'special') return ctx.base();
    // ---- this tribute group (+ its graveyard moves)
    const group: { uid: Uid; cardId: CardId; owner: PlayerId; zone: number }[] = [{ uid: ev.uid, cardId: ev.cardId, owner: ctx.owner(ev.uid), zone: ev.zone }];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      if (ctx.isConsumed(i)) continue;
      const e = ctx.events[i];
      if (e.type === 'tribute' && e.forUid === ev.forUid) group.push({ uid: e.uid, cardId: e.cardId, owner: ctx.owner(e.uid), zone: e.zone });
      else if (e.type === 'toGraveyard') continue;
      else break;
    }
    if (group.length !== 3 || !PIECES.every((id) => group.some((g) => g.cardId === id))) return ctx.base();
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      if (ctx.isConsumed(i)) continue;
      const e = ctx.events[i];
      if (e.type === 'tribute' && e.forUid === ev.forUid) ctx.consumeAt(i);
      else if (e.type === 'toGraveyard' && group.some((g) => g.uid === e.uid)) ctx.consumeAt(i);
      else if (e.type !== 'toGraveyard') break;
    }
    const sc = ctx.scene;
    const field = ctx.views.field;
    seedFx(ev.forUid * 37 + 11);
    const dest = zoneXY(dEv.player, 'monster', dEv.zone);
    const dir = dEv.player === 0 ? 1 : -1;
    // a face-down piece (the engine allows it) is turned face up on its tile first and stands up out of it, so all
    // three answer the call (the others wait the beat with it)
    const shut = group.filter((g) => {
      const u0 = field.unit(g.uid);
      return !u0 || u0.retired || !u0.sprite.active || !u0.sprite.visible;
    });
    if (shut.length) {
      await Promise.all(
        shut.map(async (g) => {
          const t = field.tileOf(g.uid);
          if (!t) return;
          t.setCard(g.cardId);
          ctx.sfx('cardFlip', { volume: 0.8 });
          await t.flipUp(320);
          const nu = field.addUnit(g.uid, { hidden: true, position: 'defense' });
          if (!nu) return;
          nu.badge.setVisible(false);
          nu.pose('guard', 0);
          nu.showSprite();
          void lightFlash(ctx.scene, t.home.x, t.home.y - 10, POLE_COLOR[g.cardId] ?? PAL.gold4, 22, 200, { floorY: t.home.y, intensity: 0.8 });
          if (nu.has('fromGuard')) await nu.playRange('fromGuard', 0);
        }),
      );
    }
    const rel = group.map((g) => ({ g, ...field.release(g.uid) }));
    const pools: LightHandle[] = [];

    // ---- 0.0 the arena dims; the card rises from the hand over the middle zone
    void lightDim(sc, -0.32, 420);
    const card = fx.takeHandCard(ctx, dEv.player, dEv.uid, dEv.cardId);
    void ctx.views.duelists?.get(dEv.player).play('command');
    ctx.sfx('cardSlide', { volume: 0.8 });
    const hover: XY = { x: dest.x, y: Math.max(40, dest.y - 96) };
    bg(card.flyTo(hover.x, hover.y, { ms: 380, arc: 40, scale: 0.7, reveal: !card.faceUp, rotation: 0, land: false, anticipate: false, ease: 'Cubic.Out' }).then(() => {
      if (card.active) card.setDepth(DEPTH.FX + 4).setHighlight(PAL.gold4);
    }));
    // the pieces flare in their pole colours; the iron-dust rose is drawn across the three zones
    const homes = rel.map(({ g, tile, unit }) => (unit && unit.sprite.active ? { ...unit.home } : tile ? { ...tile.home } : zoneXY(g.owner, 'monster', g.zone)));
    rel.forEach(({ g }, i) => pools.push(lightPool(sc, homes[i].x, homes[i].y, { color: POLE_COLOR[g.cardId] ?? PAL.gold4, radius: 30, floorY: homes[i].y, intensity: 0.75, anim: 'breathe', fadeIn: 160 })));
    // the rose's dial passes through the farthest piece (iso: the floor ellipse is 2 : 1)
    const reach = Math.max(40, ...homes.map((h) => Math.round(Math.hypot(h.x - dest.x, 2 * (h.y - dest.y))) + 14));
    const rose = dustRose(sc, dest, reach);
    play('sovereignDust', { volume: 0.9, pan: panAt(dest.x) });
    const centre = lightPool(sc, dest.x, dest.y, { color: PAL.gold3, radius: 40, floorY: dest.y, intensity: 0.5, anim: 'breathe', fadeIn: 400 });
    pools.push(centre);
    // each piece answers the call with its own polar charge (its `special`), held at the blaze until it rises
    rel.forEach(({ g, unit }, i) => {
      if (!unit || !unit.sprite.active || !unit.has('special')) return;
      bg(wait(sc, 60 + i * 110).then(() => (unit.sprite.active ? unit.playRange('special', 0, SPECIAL_PEAK[g.cardId] ?? 4) : undefined)));
    });
    await rose.draw(760);
    // the card sinks into the middle tile: the ace's seat is marked before the pieces come to it
    if (card.active) {
      const c0 = { x: card.x, y: card.y };
      await run(sc, 150, (t) => card.active && card.setPosition(Math.round(c0.x + (dest.x - c0.x) * t * t), Math.round(c0.y + (dest.y - 6 - c0.y) * t * t)));
      ctx.sfx('cardSlam', { volume: 0.8 });
      void lightFlash(sc, dest.x, dest.y - 4, PAL.gold4, 30, 220, { floorY: dest.y, intensity: 0.9 });
      centre.setIntensity(0.85, 80);
      bg(run(sc, 160, (t) => card.active && card.setAlpha(1 - t)).then(() => card.active && card.destroy()));
    }

    // ---- 0.8 the pieces rise humming, their tiles burn, their cards go; the rose's dust is pulled in
    const rise = start('sovereignRise', { volume: 0.9, pan: panAt(dest.x) });
    // each piece's card is spent as the piece leaves it: it peels off the tile under the rising body and arcs to the
    // graveyard (needle first, the anvil last), settling with a soft iron-dust tick long before the first KLAK —
    // the shared card-place sound is faded under it, so no UI sound reaches the clank sequence
    rel.forEach(({ g, tile, unit }, i) => {
      if (unit) unit.badge.setVisible(false);
      const k = PIECES.indexOf(g.cardId);
      const from = tile ? { ...tile.home } : homes[i];
      bg(
        cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from, tile, delay: 40 + k * 90, flash: false, lift: 4, depthAt: (fl) => unitDepth(fl.y) - 0.4 }).then(() => {
          fade(['cardPlace'], 12);
          play('sovereignTick', { volume: 0.7, pan: panAt(from.x), pitch: PIECE_PITCH[g.cardId] ?? 1 });
        }),
      );
    });
    const sprites = rel.map(({ unit }) => (unit && unit.sprite.active ? unit : null));
    const starts = sprites.map((u, i) => (u ? { x: u.sprite.x, y: u.sprite.y } : homes[i]));
    // rise 14 px (staggered by their weights: the needle first, the anvil last)
    const order = rel.map(({ g }) => PIECES.indexOf(g.cardId));
    await run(sc, 460, (t) => {
      rose.pull(t * 0.4);
      sprites.forEach((u, i) => {
        if (!u) return;
        const k = ease(Math.max(0, Math.min(1, (t - order[i] * 0.12) / 0.76)));
        u.sprite.setPosition(Math.round(starts[i].x), Math.round(starts[i].y - 14 * k));
      });
    });
    // fly to the exploded view over the middle zone (arcing in, whole px)
    const sovRest = { x: dest.x, y: dest.y };
    const targets = rel.map(({ g }) => {
      const o = EXPLODED[g.cardId] ?? { x: 0, y: -20 };
      return { x: sovRest.x + o.x * dir, y: sovRest.y + o.y };
    });
    const mids = sprites.map((u, i) => ({ x: u ? u.sprite.x : homes[i].x, y: u ? u.sprite.y : homes[i].y }));
    sprites.forEach((u) => u?.sprite.setDepth(unitDepth(dest.y) + 1));
    // in flight each piece FOLDS into the shape it takes in the sovereign (its own entrance played backwards):
    // the anvil tucks its maul arms into the block, the coil draws its legs and whips into the wire, the needle
    // closes into the compass-card lozenge — so the swap meets the exploded view pose for pose
    const shown = sprites.map(() => -1);
    await run(sc, 560, (t) => {
      rose.pull(0.4 + t * 0.6);
      const e = ease(t);
      sprites.forEach((u, i) => {
        if (!u) return;
        const fold = FOLD[rel[i].g.cardId];
        if (fold && u.has('summon')) {
          const k = Math.max(0, Math.min(1, (t - 0.08) / 0.7));
          const f = Math.round(fold[0] + (fold[1] - fold[0]) * k);
          if (f !== shown[i]) {
            shown[i] = f;
            u.pose('summon', f);
          }
        }
        const a = mids[i];
        const b = targets[i];
        u.sprite.setPosition(Math.round(a.x + (b.x - a.x) * e), Math.round(a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * 10));
      });
      pools.forEach((p, i) => {
        if (i < rel.length) p.setIntensity(0.75 - 0.5 * t, 0);
      });
    });
    // the hum is never cut: the chord is held through the swap and the anvil's tumble into KLAK 1 (sovereignTumble)
    rise.stop(220);
    const tumble = start('sovereignTumble', { volume: 0.95, pan: panAt(dest.x) });

    // ---- 1.9 swap: the magnetic flash; the card is spent, the pieces' units go, the sovereign's frames take over
    void lightFlash(sc, dest.x, dest.y - 30, PAL.white, 60, 260, { floorY: dest.y, intensity: 1 });
    rel.forEach(({ g, unit }) => {
      unit?.retire();
      field.forget(g.uid);
    });
    if (card.active) card.destroy();
    for (let i = 0; i < rel.length; i++) void pools[i].fadeOut(200);
    pending = { rose, pools: [centre], dimmed: true, tumble };
    await ctx.play(di, { tribute: true, noCard: true, cutIn: true });
  },
  { priority: 20, name: 'd:polar_sovereign:fusion' },
);

// ================================================================ fusion: the sprite (summon hook)

async function fusionV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const pan = panAt(S.home.x);
  const pre = pending;
  pending = null;
  const rose = pre?.rose ?? null;
  // the swap: the exploded pieces stand where the units were (the sprite's summon f0)
  u.sprite.setPosition(Math.round(u.rest0.x), Math.round(u.rest0.y));
  u.pose('summon', 0);
  u.showSprite();
  u.badge.setVisible(false);
  // today's ace lean, kept as it was (EF-8; the shared ace summon's focus, _core/helpers.ts) — runSummon unfocuses
  if (S.big) bg(S.ctx.focus({ x: S.home.x, y: S.home.y - 30 }, { zoom: 1.05, ms: 420, pan: 0.3 }));
  const glow = S.glow({ color: PAL.gold3, radius: 46, intensity: 0.7, anim: 'breathe', fadeIn: 60 });
  await S.wait(u.frameMs('summon', 0));
  // the three KLAKs: each a 120 ms hit-stop, a white flash at its joint, a heavier shake, a tone lower
  const joint = (k: number): XY => ({ x: S.home.x, y: S.home.y - (k === 0 ? 14 : k === 1 ? 28 : 52) - SUMMON_LIFT });
  let from = 0;
  for (let k = 0; k < 3; k++) {
    const f = SUMMON_KLAK[k];
    await u.playRange('summon', from, f);
    if (k === 0) pre?.tumble?.stop(30);
    play((['sovereignKlak1', 'sovereignKlak2', 'sovereignKlak3'] as const)[k], { volume: 0.95, pan });
    const at = joint(k);
    void lightFlash(sc, at.x, at.y, PAL.white, 34 + k * 8, 200, { floorY: S.home.y, intensity: 1 });
    glow.setIntensity(0.9 + k * 0.15, 30);
    rose?.pull(1);
    bg(shake(sc, 170, 3 + k));
    await hitStop(sc, 120);
    from = f;
  }
  // the assembled body hangs in its field: the ace cut-in
  await u.playRange('summon', from, SUMMON_HOLD);
  if (rose) bg(rose.dismiss(420));
  // the cut-in's own whine (two poles' sweeps crossing) over the band; the shared whoosh / slam thud step back
  play('sovereignCutin', { volume: 0.9, pan });
  bg(wait(sc, 90).then(() => fade(['whoosh'], 40)));
  bg(wait(sc, 420).then(() => fade(['impactHeavy'], 30)));
  await S.climax();
  // the landing: shock ring, gong, the light comes back up
  atFrame(u, 'summon', SUMMON_LAND, () => {
    play('sovereignLand', { volume: 1, pan });
    bg(dustShock(sc, S.home, 90, 620));
    S.finale({ ring: 96, ramp: RAMPS.water, shake: 4, sfx: null, freezeMs: 70, playerRing: true });
    glow.setIntensity(1.2, 40);
    void lightDim(sc, 0, 600);
  }, { late: false, maxMs: 3000 });
  // the spear struck down
  atFrame(u, 'summon', 13, () => {
    play('sovereignSpear', { volume: 0.9, pan });
    void lightFlash(sc, S.home.x + 26 * S.dir, S.home.y - 4, PAL.fire4, 22, 220, { floorY: S.home.y, intensity: 0.8 });
    bg(shake(sc, 90, 1));
  }, { late: false, maxMs: 3000 });
  await u.playRange('summon', SUMMON_HOLD, undefined, {});
  void glow.fadeOut(400);
  for (const p of pre?.pools ?? []) void p.fadeOut(400);
  if (pre?.dimmed) void lightDim(sc, 0, 300);
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    if (ev.from === 'field') return ctx.base();
    // the fusion only (special from the hand); a revival (soul_recall) takes the generic pose entrance
    if (ev.from !== 'hand' || ev.method !== 'special') return ctx.base();
    await runSummon(ctx, fusionV3, fusionV3);
  },
  { priority: 20, name: 'd:polar_sovereign:summon' },
);

// ================================================================ strike "Pusula Fırtınası"

registerStrike(
  ID,
  async (s: StrikeArgs) => {
    if (!LOOK_V3) return s.base?.();
    const u = s.attacker;
    const sc = s.scene;
    seedFx(u.uid * 43 + (s.target?.uid ?? 5));
    const res = (s.ctx.ev as BattleEv).result;
    const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
    const pan = panAt(u.home.x);
    const f0 = strikeStartFrame(u);
    // ---- the compass: three turns, the ticks accelerating (continues the declaration's held charge)
    const compass = takeCharge(u, 'sovereignCompass', { volume: 0.85, pan });
    atFrame(u, 'attack', ATTACK_LOCK, () => {
      compass.stop(30);
      play('sovereignLock', { volume: 0.9, pan });
      void lightFlash(sc, u.muzzle().x, u.muzzle().y, PAL.fire4, 16, 160, { floorY: u.home.y, intensity: 0.8 });
    }, { late: false });
    await u.playRange('attack', f0, ATTACK_THROW);
    // ---- the throw: the spear flies point first; the rose closes round the target
    play('sovereignThrow', { volume: 0.9, pan });
    const from = u.muzzle();
    const aim = s.to;
    const depth = DEPTH.FX + 1;
    // a throw, not a shove: the spear rises into a parabola (higher on a short throw, so on the same column it
    // goes UP over the foe and comes down onto it, its point outside the body until contact); the flight time
    // follows the real path length
    const dist = Math.hypot(aim.x - from.x, aim.y - from.y);
    const arc = Math.round(Math.max(14, Math.min(36, 44 - dist * 0.12)));
    const path = dist + arc * 1.4;
    const flight = Math.round(130 + path * 1.2);
    const rose = targetRose(sc, aim, flight + 40, s.target && s.target.sprite.active ? s.target.sprite.depth - 0.5 : DEPTH.FX - 1);
    play('sovereignRose', { volume: 0.75, pan: panAt(aim.x) });
    void u.playRange('attack', ATTACK_THROW, 12);
    await spearShot(sc, from, aim, flight, depth, { arc, tip: true });
    // ---- contact: the spear in the rose's heart
    rose.destroy();
    hush(['impactHeavy'], () => s.impact(aim));
    play('sovereignPierce', { volume: 1, pan: panAt(aim.x) });
    // a target without its own material sound gets the generic body blow from the reaction (react.ts) a tick
    // later, outside the hush: the pierce scores the contact on its own, so that layer steps back at once
    bg(wait(sc, 1).then(() => fade(['impactHeavy'], 25)));
    bg(poleBlast(sc, aim, s.toGround.y, DEPTH.FX + 2));
    void lightFlash(sc, aim.x, aim.y, PAL.white, 44, 260, { floorY: s.toGround.y, intensity: 1, ring: true });
    bg(shake(sc, 200, 5));
    // the spear stays buried in the rose's heart, quivering, until the recall rips it out
    const stuck = spearStuck(sc, { x: from.x, y: from.y - 4 * arc }, aim, depth);
    // the ace's own extra beat over the heavy class's hit-stop (spec: 140 ms)
    await hitStop(sc, 20);
    if (loses || !u.sprite.active || u.retired) {
      bg(wait(sc, 260).then(() => stuck.stop()));
      return;
    }
    await wait(sc, 160);
    stuck.stop();
    if (!u.sprite.active || u.retired) return;
    // ---- the recall: the spear snaps back into the fist, to the shoulder, home
    play('sovereignRecall', { volume: 0.85, pan });
    // out of the heart along the line it went in (the stuck spear's centre), back to the fist
    const dl = Math.hypot(aim.x - from.x, aim.y - from.y + 4 * arc) || 1;
    const outAt = { x: aim.x - ((aim.x - from.x) / dl) * 22, y: aim.y - ((aim.y - from.y + 4 * arc) / dl) * 22 };
    await spearShot(sc, outAt, u.muzzle(), 220, depth, { back: true, arc: Math.round(arc * 0.4) });
    if (!u.sprite.active || u.retired) return;
    void lightFlash(sc, u.muzzle().x, u.muzzle().y, PAL.water4, 14, 160, { floorY: u.home.y, intensity: 0.7 });
    await u.playRange('attack', ATTACK_CATCH);
  },
  { priority: 20, name: 'd:polar_sovereign:strike' },
);

// ================================================================ split / death

/** The split follows this destroy: the sovereign's graveyard activation summons the pieces. */
function splitInfo(ctx: { events: readonly GameEvent[]; index: number }, uid: Uid): { zones: { player: PlayerId; zone: number; cardId: CardId }[] } | null {
  let act = -1;
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'activate' && e.uid === uid && e.kind === 'monsterEffect' && e.from === 'graveyard') {
      act = i;
      break;
    }
  }
  if (act < 0) return null;
  const zones: { player: PlayerId; zone: number; cardId: CardId }[] = [];
  for (let i = act + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'summon' && e.sourceUid === uid) zones.push({ player: e.player, zone: e.zone, cardId: e.cardId });
  }
  return zones.length === 3 ? { zones } : null;
}

/** Where each piece's part is drawn in the body on the repel frame (death DEATH_SPLIT), as the piece's anchor offset
 *  from the sovereign's anchor (P1 px): the anvil = the plinth, the coil = the raised chest, the needle = the arms
 *  and the spear (checked by compositing the frames: the pieces are born there on the white flash frame). */
const REPEL_AT: Readonly<Record<string, XY>> = { polar_anvil: { x: -9, y: 0 }, polar_coil: { x: -1, y: -32 }, polar_needle: { x: -28, y: -38 } };
/** The no-split heap: where each piece falls on the sovereign's own tile (P1 px from its anchor), its arc and its turn. */
const FALL: Readonly<Record<string, { x: number; y: number; arc: number; delay: number }>> = {
  polar_needle: { x: -20, y: -5, arc: 18, delay: 0 },
  polar_anvil: { x: -5, y: 1, arc: 6, delay: 130 },
  polar_coil: { x: 17, y: 5, arc: 14, delay: 260 },
};

registerCardHook(
  ID,
  'destroyed',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
    const sc = ctx.scene;
    const u = ctx.views.field.unit(ctx.ev.uid);
    if (!u || u.retired || !u.sprite.active || !u.sprite.visible) return ctx.base();
    seedFx(u.uid * 59 + 13);
    const home = { ...u.home };
    const pan = panAt(home.x);
    const split = splitInfo(ctx, ctx.ev.uid);
    // ---- the sovereign owns its whole death (split or not): no generic material break
    const ev = ctx.ev;
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
    const hasCard = gi >= 0;
    if (gi >= 0) ctx.consumeAt(gi);
    const owner = ctx.owner(ev.uid);
    const { tile } = ctx.views.field.release(ev.uid);
    u.badge.setVisible(false);
    u.posed = true;
    // cracks run along the joints (death f0…f3)
    play('sovereignCrack', { volume: 0.9, pan });
    // the field builds in the cracked body from the first crack to the repel: a rising magnetic whine (the chord
    // detuning apart) and the seams spitting sparks, arcs jumping between them, iron dust shaken loose
    const strain = start('sovereignStrain', { volume: 0.85, pan });
    const seamFx = seamSparks(sc, home, dir, u.sprite.depth + 0.4);
    // a lethal blow's reaction may already have cracked it open (the death pose joined from the recoil): go on from
    // there, never replay the cracks
    const fi0 = u.frameInfo();
    const at0 = fi0.anim === 'death' ? fi0.frame : -1;
    if (at0 < DEATH_SPLIT) await u.playRange('death', Math.max(0, at0), DEATH_SPLIT);
    else u.pose('death', DEATH_SPLIT);
    // the cracks hold: the body trembles on its joints (1 px, ever faster) while the seams flicker in the pole colours
    const r0 = { x: u.sprite.x, y: u.sprite.y };
    const seams = [PAL.fire4, PAL.water4, PAL.gold4];
    await run(sc, split ? 380 : 300, (t, el) => {
      const step = Math.floor(el / (t < 0.5 ? 50 : 30));
      const amp = t > 0.7 ? 3 : t > 0.35 ? 2 : 1;
      u.sprite.setPosition(Math.round(r0.x + (step % 2 ? 1 : -1) * amp), Math.round(r0.y - (step % 3 === 0 && t > 0.5 ? 1 : 0)));
      if (step % 3 === 0 && step !== lastSeam) {
        lastSeam = step;
        const k = (step / 3) % 3;
        void lightFlash(sc, home.x, home.y - (k === 0 ? 28 : k === 1 ? 56 : 80), seams[k], 18, 90, { floorY: home.y, intensity: 0.7 });
      }
    });
    u.sprite.setPosition(Math.round(r0.x), Math.round(r0.y));
    // ---- the repel: the field throws the pieces apart. The body's last frame flashes WHITE, and the pieces are born
    // white where their parts were drawn (the flash frame carries the change of shape), then fly
    strain.stop(40);
    seamFx.stop();
    play('sovereignRepel', { volume: 1, pan });
    void lightFlash(sc, home.x, home.y - 40, PAL.white, 64, 260, { floorY: home.y, intensity: 1, ring: true });
    bg(shake(sc, 160, 4));
    await hitStop(sc, 80);
    u.sprite.setTintFill(PAL.white);
    const seat = (id: string): XY => {
      const o = REPEL_AT[id] ?? { x: 0, y: -20 };
      return { x: home.x + o.x * dir, y: home.y + o.y };
    };
    const cardOut = (): void => {
      if (tile) bg(tile.dissolve(360).then(() => tile.destroy()));
      if (hasCard) bg(fx.cardToGraveyard(ctx, { owner, cardId: ID as MonsterId, from: { x: home.x, y: home.y - 4 }, delay: 80 }));
    };
    const bodyGone = (): void => {
      // the white flash frame shows two frames, then only the pieces are left
      bg(wait(sc, 34).then(() => u.sprite.active && u.sprite.setVisible(false)));
      u.retire();
      ctx.views.field.forget(ev.uid);
    };
    bg(dustShock(sc, home, 60, 480));
    if (!split) {
      // ---- the split fails: the three fall onto the tile and die their own deaths (_polar_sovereign-finals)
      const pieces: FallingPiece[] = PIECES.map((id) => {
        const f = FALL[id];
        return { id: id as MonsterId, from: seat(id), to: { x: home.x + f.x * dir, y: home.y + f.y }, arc: f.arc, delay: f.delay, fold: FOLD[id], pole: POLE_COLOR[id] };
      });
      const fall = piecesFall(sc, { uidBase: 800000 + u.uid * 4, player: owner, zone: ev.zone, dir, pieces });
      bodyGone();
      await fall;
      // the card leaves only once the heap is gone (it never slides over the dying pieces)
      cardOut();
      return;
    }
    // ---- the split: each piece is kicked out along its own radial arc (left / up / right by where it is headed),
    // then braked by the field over its landing zone, hanging there until the graveyard activation drops it
    const to = split.zones.map((z) => zoneXY(z.player, 'monster', z.zone));
    // the hang heights: the back zones hang lowest (a piece over the back row never climbs over the duelist's
    // portrait), the front ones highest — the three read as a row held in the field, not a stacked cluster
    const byDepth = split.zones.map((_, i) => i).sort((a, b) => to[a].y - to[b].y || a - b);
    const hangOf = split.zones.map((_, i) => HANGS[byDepth.indexOf(i)] ?? HANG);
    // and spread a little wider than the zones (the field pushes them apart): the outer two lean out
    const byX = split.zones.map((_, i) => i).sort((a, b) => to[a].x - to[b].x || a - b);
    const spreadOf = split.zones.map((_, i) => SPREAD[byX.indexOf(i)] ?? 0);
    cardOut();
    const order = split.zones.map((_, i) => i).sort((a, b) => to[a].x - to[b].x || a - b);
    const LAUNCH: XY[] = [{ x: -86, y: -64 }, { x: 6, y: -128 }, { x: 86, y: -64 }];
    const launchOf = (i: number): XY => LAUNCH[order.indexOf(i)] ?? { x: 0, y: -80 };
    const h = flingPieces(
      sc,
      split.zones.map((z, i) => {
        const f = FOLD[z.cardId];
        const f1 = f ? f[1] : 0;
        return {
          id: z.cardId as MonsterId,
          from: seat(z.cardId),
          to: { x: to[i].x + spreadOf[i], y: to[i].y - hangOf[i] },
          launch: launchOf(i),
          anim: 'summon',
          frames: f ? [f1, f1 + 1, f1 + 2, f1 + 1, f1] : [0],
          flip: z.player === 1,
          pole: POLE_COLOR[z.cardId] ?? PAL.gold4,
        };
      }),
      FLING_MS,
    );
    bodyGone();
    const prev = sparks.get(ev.uid);
    prev?.h.destroy();
    prev?.hum.stop(80);
    const entry = { zones: split.zones.map((z) => z.player * 10 + z.zone), hangs: hangOf, spread: spreadOf, h, hum: NO_HUM };
    sparks.set(ev.uid, entry);
    // caught by the field: the chord held apart starts while the repel still rings (no hole in the bed)
    bg(wait(sc, FLING_MS * 0.2).then(() => {
      if (sparks.get(ev.uid) === entry && entry.hum === NO_HUM) entry.hum = start('sovereignHang', { volume: 0.8, pan });
    }));
    // the cards leaving between this death and the split's activation (the destroying spell's own card) go to
    // their graveyard WHILE the pieces fly: the hang is a beat, not a wait for a card to cross through it
    const actAt = ctx.find((e) => e.type === 'activate' && e.uid === ev.uid && e.from === 'graveyard');
    if (actAt > 0) {
      const leaving: number[] = [];
      for (let i = ctx.index + 1; i < actAt; i++) {
        const e = ctx.events[i];
        if (!ctx.isConsumed(i) && e.type === 'toGraveyard' && e.uid !== ev.uid) leaving.push(i);
      }
      if (leaving.length) bg(wait(sc, FLING_MS * 0.35).then(async () => {
        for (const i of leaving) if (!ctx.isConsumed(i)) await ctx.play(i);
      }));
    }
    bg(wait(sc, 6000).then(() => {
      if (sparks.get(ev.uid) !== entry) return;
      entry.h.destroy();
      entry.hum.stop(200);
      sparks.delete(ev.uid);
    }));
    await h.done;
    // the hang is a held beat of its own (bobbing, arcs snapping between them) before the first piece drops
    await wait(sc, 240);
  },
  { priority: 20, name: 'd:polar_sovereign:death' },
);

// the split's landing: the sovereign's graveyard activation — the three pieces drop out of their streaks' sky into
// their zones and land in defense (each with its own pitch); the pieces' own summon hooks defer to this one
registerCardHook(
  ID,
  'effect',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    if (ev.type !== 'activate' || ev.from !== 'graveyard') return ctx.base();
    const sc = ctx.scene;
    const field = ctx.views.field;
    const idx: number[] = [];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      if (ctx.isConsumed(i)) continue;
      const e = ctx.events[i];
      if (e.type === 'summon' && e.sourceUid === ev.uid && e.from === 'graveyard') idx.push(i);
    }
    if (idx.length === 0) return ctx.base();
    const hang = sparks.get(ev.uid);
    sparks.delete(ev.uid);
    // the held chord lets go as the first piece hits its tile (it falls through the chord, not into silence)
    if (hang) bg(wait(sc, 200).then(() => hang.hum.stop(160)));
    const jobs = idx.map(async (i, k) => {
      const e = ctx.events[i] as SummonEv;
      ctx.consumeAt(i);
      await wait(sc, k * 140);
      const home = zoneXY(e.player, 'monster', e.zone);
      const t = field.placeCard(e.player, 'monster', e.zone, e.uid, e.cardId, true, 'side');
      t.tileFlash(POLE_COLOR[e.cardId] ?? PAL.gold4, 300);
      const unit = field.addUnit(e.uid, { hidden: true, atk: ctx.atk(e.uid, 'next'), def: ctx.def(e.uid, 'next'), position: 'defense' });
      const si = hang ? hang.zones.indexOf(e.player * 10 + e.zone) : -1;
      const bob = hang && si >= 0 ? hang.h.release(si) : { x: 0, y: 0 };
      const off = { x: bob.x + (hang && si >= 0 ? hang.spread[si] : 0), y: bob.y };
      if (!unit) return;
      await dropIn(unit, home, e.cardId, hang && si >= 0 ? hang.hangs[si] : HANG, off);
    });
    await Promise.all(jobs);
    hang?.h.destroy();
  },
  { priority: 20, name: 'd:polar_sovereign:split' },
);

async function dropIn(u: MonsterUnit, home: XY, cardId: CardId, hang = HANG, off: XY = { x: 0, y: 0 }): Promise<void> {
  const sc = u.sprite.scene;
  const r = u.rest0;
  const pan = panAt(home.x);
  u.badge.setVisible(false);
  // it falls out of its hang still folded and unfolds on the way down (its own entrance's last frames)
  const fold = u.has('summon') ? FOLD[cardId] : undefined;
  u.pose(fold ? 'summon' : u.has('toGuard') ? 'toGuard' : 'guard', fold ? fold[1] : 0);
  // it starts exactly where its bob held it (no pop on the hand-over)
  const h0 = hang - off.y;
  u.sprite.setPosition(Math.round(r.x + off.x), Math.round(r.y - h0));
  u.showSprite();
  let shown = -1;
  await run(sc, 220, (t) => {
    u.sprite.setPosition(Math.round(r.x + off.x * (1 - t)), Math.round(r.y - h0 * (1 - t * t)));
    if (fold) {
      const f = Math.round(fold[1] + (fold[0] - fold[1]) * t);
      if (f !== shown) {
        shown = f;
        u.pose('summon', f);
      }
    }
  });
  u.sprite.setPosition(Math.round(r.x), Math.round(r.y));
  play('sovereignPieceLand', { volume: 0.85, pan, pitch: PIECE_PITCH[cardId] ?? 1 });
  void lightFlash(sc, home.x, home.y - 10, POLE_COLOR[cardId] ?? PAL.gold4, 28, 240, { floorY: home.y, intensity: 0.9 });
  bg(landPuff(sc, home));
  bg(shake(sc, 90, 2));
  if (u.has('toGuard')) await u.playRange('toGuard', 0, undefined, { hold: true });
  u.rest();
  void u.badge.pop();
}
