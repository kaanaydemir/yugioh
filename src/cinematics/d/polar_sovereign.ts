// Kutup Hükümdarı (polar_sovereign, lane D, C15) — its own v3 fusion, strike, split and death (?look=v3 only; v1
// falls through to the chain below every hook, byte-identical). Pixel set pieces: ./_polar_sovereign-fx.ts; sounds:
// src/audio/v3/polar_sovereign.ts; the sprite's own frames: src/art/monsters-v3/polar_sovereign-anims.ts.
//
// FUSION (the special summon from the hand, ≈ 6.3 s with the cut-in; YENI_KARTLAR §C15 steps 1–5). The camera never
// moves (EF-8): the push-in is faked with the arena dimming and the light pools.
//   0.0  the tribute hook takes the three pieces: the arena dims, the sovereign's card rises from the hand over the
//        middle zone, the three pieces flare in their pole colours and an IRON-DUST COMPASS ROSE is drawn on the floor
//        across the three zones (sovereignDust)
//   0.8  the pieces RISE off their tiles humming their own pitches (sovereignRise), their tiles burn away, their cards
//        arc to the graveyard; the rose's grains are pulled in; the pieces fly over to the middle zone into the
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
//   (death f0…f3, sovereignCrack), the field REPELS (sovereignRepel): the body is flung apart in three two-colour
//   streaks toward the landing zones; then the effect hook lands each piece in its zone in defense (from the sky of
//   the streak, toGuard on the floor, an iron-dust puff, its own pitch).
// DEATH (no split): the art's own death — the cracks, the repel, the three pieces fall and end in their own finals
//   (the needle-spear ripped away, the chest toppled with its wire unwound, the base pushed apart) and dissolve; the
//   burst is iron dust settling (sovereignBurst), no generic shatter.

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
import { deathV3 } from '../_v3/death';
import { atFrame, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { bg, run, runSummon, type Stage } from '../summon-a/_kit';
import { COIL_EXPLODED, NEEDLE_EXPLODED, RX as SRX } from '../../art/monsters-v3/polar_sovereign-rig';
import { ATTACK_CATCH, ATTACK_LOCK, ATTACK_THROW, DEATH_SPLIT, SUMMON_HOLD, SUMMON_KLAK, SUMMON_LAND, SUMMON_LIFT } from '../../art/monsters-v3/polar_sovereign-anims';
import { dustRose, dustShock, hoverSparks, landPuff, poleBlast, seedFx, spearShot, splitStreaks, targetRose, type DustRose } from './_polar_sovereign-fx';

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
/** the pieces' own pitches for their landing (needle A3 high, coil D3, anvil E2 low) */
const PIECE_PITCH: Readonly<Record<string, number>> = { polar_needle: 1.5, polar_coil: 1.12, polar_anvil: 0.8 };

/** Handed from the tribute pre-show to the summon entrance (same event batch, played in order). */
let pending: { rose: DustRose | null; pools: LightHandle[]; dimmed: boolean } | null = null;
/** The split's piece-sparks hanging over the landing zones, keyed by the sovereign's uid (destroyed → effect hook). */
const sparks = new Map<number, { zones: number[]; h: ReturnType<typeof hoverSparks> }>();
/** where a piece hangs before it drops (the streak's end): DROP px over its tile */
const DROP = 80;

const ease = (t: number) => t * t * (3 - 2 * t);

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
    await rose.draw(760);

    // ---- 0.8 the pieces rise humming, their tiles burn, their cards go; the rose's dust is pulled in
    const rise = start('sovereignRise', { volume: 0.9, pan: panAt(dest.x) });
    rel.forEach(({ g, tile, unit }, i) => {
      if (tile) bg(tile.dissolve(520).then(() => tile.destroy()));
      if (unit) unit.badge.setVisible(false);
      bg(fx.cardToGraveyard(ctx, { owner: g.owner, cardId: g.cardId as MonsterId, from: { x: homes[i].x, y: homes[i].y - 4 }, delay: 120 + i * 90 }));
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
    await run(sc, 560, (t) => {
      rose.pull(0.4 + t * 0.6);
      const e = ease(t);
      sprites.forEach((u, i) => {
        if (!u) return;
        const a = mids[i];
        const b = targets[i];
        u.sprite.setPosition(Math.round(a.x + (b.x - a.x) * e), Math.round(a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * 10));
      });
      pools.forEach((p, i) => {
        if (i < rel.length) p.setIntensity(0.75 - 0.5 * t, 0);
      });
    });
    rise.stop(60);
    // the card dives into the middle tile (the swap's flash covers its landing)
    if (card.active) {
      const c0 = { x: card.x, y: card.y };
      await run(sc, 140, (t) => card.active && card.setPosition(Math.round(c0.x + (dest.x - c0.x) * t * t), Math.round(c0.y + (dest.y - 6 - c0.y) * t * t)));
      ctx.sfx('cardSlam', { volume: 0.8 });
    }

    // ---- 1.9 swap: the magnetic flash; the card is spent, the pieces' units go, the sovereign's frames take over
    void lightFlash(sc, dest.x, dest.y - 30, PAL.white, 60, 260, { floorY: dest.y, intensity: 1 });
    rel.forEach(({ g, unit }) => {
      unit?.retire();
      field.forget(g.uid);
    });
    if (card.active) card.destroy();
    for (let i = 0; i < rel.length; i++) void pools[i].fadeOut(200);
    pending = { rose, pools: [centre], dimmed: true };
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
  const glow = S.glow({ color: PAL.gold3, radius: 46, intensity: 0.7, anim: 'breathe', fadeIn: 60 });
  await S.wait(u.frameMs('summon', 0));
  // the three KLAKs: each a 120 ms hit-stop, a white flash at its joint, a heavier shake, a tone lower
  const joint = (k: number): XY => ({ x: S.home.x, y: S.home.y - (k === 0 ? 14 : k === 1 ? 28 : 52) - SUMMON_LIFT });
  let from = 0;
  for (let k = 0; k < 3; k++) {
    const f = SUMMON_KLAK[k];
    await u.playRange('summon', from, f);
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
    const rose = targetRose(sc, aim, 420, s.target && s.target.sprite.active ? s.target.sprite.depth - 0.5 : DEPTH.FX - 1);
    play('sovereignRose', { volume: 0.75, pan: panAt(aim.x) });
    void u.playRange('attack', ATTACK_THROW, 12);
    const dist = Math.hypot(aim.x - from.x, aim.y - from.y);
    const flight = Math.round(Math.max(240, Math.min(420, dist * 1.4)));
    await spearShot(sc, from, aim, flight, depth);
    // ---- contact: the spear in the rose's heart
    rose.destroy();
    s.impact(aim);
    play('sovereignPierce', { volume: 1, pan: panAt(aim.x) });
    bg(poleBlast(sc, aim, s.toGround.y, DEPTH.FX + 2));
    void lightFlash(sc, aim.x, aim.y, PAL.white, 44, 260, { floorY: s.toGround.y, intensity: 1, ring: true });
    bg(shake(sc, 200, 5));
    // the ace's own extra beat over the heavy class's hit-stop (spec: 140 ms)
    await hitStop(sc, 20);
    if (loses || !u.sprite.active || u.retired) return;
    await wait(sc, 160);
    if (!u.sprite.active || u.retired) return;
    // ---- the recall: the spear snaps back into the fist, to the shoulder, home
    play('sovereignRecall', { volume: 0.85, pan });
    await spearShot(sc, aim, u.muzzle(), 220, depth, { back: true });
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
    if (!split) {
      // the split fails: the art's own death (the pieces fall into their own finals), iron dust at the burst
      atFrame(u, 'death', 1, () => play('sovereignCrack', { volume: 0.9, pan }), { maxMs: 3000 });
      atFrame(u, 'death', DEATH_SPLIT, () => {
        play('sovereignRepel', { volume: 0.9, pan });
        void lightFlash(sc, home.x, home.y - 40, PAL.white, 50, 220, { floorY: home.y, intensity: 1 });
        bg(shake(sc, 140, 3));
      }, { maxMs: 3000 });
      atFrame(u, 'death', DEATH_SPLIT + 1, () => {
        play('sovereignFall', { volume: 0.9, pan });
        bg(dustShock(sc, home, 50, 420));
      }, { maxMs: 3000 });
      return deathV3(ctx, { fallback: () => ctx.base() });
    }
    // ---- the split: cracks, the repel, the body flung apart toward the three zones
    const ev = ctx.ev;
    const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
    if (gi >= 0) ctx.consumeAt(gi);
    const owner = ctx.owner(ev.uid);
    const { tile } = ctx.views.field.release(ev.uid);
    u.badge.setVisible(false);
    play('sovereignCrack', { volume: 0.9, pan });
    await u.playRange('death', 0, DEATH_SPLIT);
    play('sovereignRepel', { volume: 1, pan });
    void lightFlash(sc, home.x, home.y - 40, PAL.white, 64, 260, { floorY: home.y, intensity: 1, ring: true });
    bg(shake(sc, 160, 4));
    await hitStop(sc, 80);
    const to = split.zones.map((z) => zoneXY(z.player, 'monster', z.zone));
    u.retire();
    ctx.views.field.forget(ev.uid);
    if (tile) bg(tile.dissolve(360).then(() => tile.destroy()));
    bg(fx.cardToGraveyard(ctx, { owner, cardId: ID as MonsterId, from: { x: home.x, y: home.y - 4 }, delay: 80 }));
    bg(dustShock(sc, home, 60, 480));
    await splitStreaks(sc, { x: home.x, y: home.y - 40 }, to.map((p) => ({ x: p.x, y: p.y - DROP - 24 + 60 })), 420);
    // the pieces hang in the sky over their zones until the graveyard activation drops them (a spell may resolve between)
    const h = hoverSparks(sc, to.map((p) => ({ x: p.x, y: p.y - DROP - 24 })));
    sparks.get(ev.uid)?.h.destroy();
    sparks.set(ev.uid, { zones: split.zones.map((z) => z.player * 10 + z.zone), h });
    bg(wait(sc, 6000).then(() => {
      sparks.get(ev.uid)?.h.destroy();
      sparks.delete(ev.uid);
    }));
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
    const jobs = idx.map(async (i, k) => {
      const e = ctx.events[i] as SummonEv;
      ctx.consumeAt(i);
      await wait(sc, k * 140);
      const home = zoneXY(e.player, 'monster', e.zone);
      const t = field.placeCard(e.player, 'monster', e.zone, e.uid, e.cardId, true, 'side');
      t.tileFlash(POLE_COLOR[e.cardId] ?? PAL.gold4, 300);
      const unit = field.addUnit(e.uid, { hidden: true, atk: ctx.atk(e.uid, 'next'), def: ctx.def(e.uid, 'next'), position: 'defense' });
      const si = hang ? hang.zones.indexOf(e.player * 10 + e.zone) : -1;
      if (hang && si >= 0) hang.h.release(si);
      if (!unit) return;
      await dropIn(unit, home, e.cardId);
    });
    await Promise.all(jobs);
    hang?.h.destroy();
  },
  { priority: 20, name: 'd:polar_sovereign:split' },
);

async function dropIn(u: MonsterUnit, home: XY, cardId: CardId): Promise<void> {
  const sc = u.sprite.scene;
  const r = u.rest0;
  const pan = panAt(home.x);
  u.badge.setVisible(false);
  u.pose(u.has('toGuard') ? 'toGuard' : 'guard', 0);
  u.sprite.setPosition(Math.round(r.x), Math.round(r.y - DROP));
  u.showSprite();
  await run(sc, 260, (t) => u.sprite.setPosition(Math.round(r.x), Math.round(r.y - DROP * (1 - t * t))));
  u.sprite.setPosition(Math.round(r.x), Math.round(r.y));
  play('sovereignPieceLand', { volume: 0.85, pan, pitch: PIECE_PITCH[cardId] ?? 1 });
  void lightFlash(sc, home.x, home.y - 10, POLE_COLOR[cardId] ?? PAL.gold4, 28, 240, { floorY: home.y, intensity: 0.9 });
  bg(landPuff(sc, home));
  bg(shake(sc, 90, 2));
  if (u.has('toGuard')) await u.playRange('toGuard', 0, undefined, { hold: true });
  u.rest();
  void u.badge.pop();
}
