// Default strike motions per monster (GAME_DESIGN §7), composed from vfx/combat.
// A strike animates the attacker's attack and calls s.impact() at the moment of contact; it
// resolves when the attacker is back home. The battle handler does the outcome.
//
// Override one with registerStrike('<monster_id>', async (s) => { ... }) in a new file.
import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import { PAL, RAMPS } from '../../art/palette';
import * as wyrmArt from '../../art/monsters/crystal_wyrm';
import { type XY, unitDepth } from '../../view/layout';
import { shake, tween, wait } from '../../vfx/core';
import { afterimages, beam, bite, dive, lightning, lunge, projectile, puddleTravel, shadowPuddle, sinkInto, slash, vineWhip, xSlash } from '../../vfx/combat';
import { DEFAULT_PRIORITY, registerStrike, type StrikeFn } from '../_core/registry';
import type { StrikeArgs } from '../_core/types';

const P = { priority: DEFAULT_PRIORITY };

type Pt = { x: number; y: number };
const MOUTHS: Partial<Record<MonsterId, Pt[]>> = {
  crystal_wyrm: (wyrmArt as unknown as { CRYSTAL_WYRM_MOUTH?: Pt[] }).CRYSTAL_WYRM_MOUTH,
};

/** Live mouth point: per-frame table if the art has one, else the impact-frame muzzle. */
function mouth(s: StrikeArgs): () => XY {
  const u = s.attacker;
  const table = MOUTHS[u.cardId];
  return () => {
    const fi = u.frameInfo();
    const m = table && fi.anim === 'attack' && table[fi.frame] ? table[fi.frame] : u.art.muzzle;
    return u.framePoint(m.x, m.y);
  };
}

/** Start 'attack'; resolve when a charge of the returned length should begin (ends on the impact frame). */
async function chargeWindow(s: StrikeArgs, tracksMouth: boolean): Promise<number> {
  const u = s.attacker;
  void u.play('attack');
  const ms = u.impactMs;
  if (tracksMouth) return ms;
  const charge = Math.min(ms, 1000 / u.art.anims.attack.fps + 20);
  await wait(s.scene, ms - charge);
  return charge;
}

/** Ground point a little short of the target (where melee attackers plant their feet). */
function meleeSpot(s: StrikeArgs): XY {
  return s.toGround;
}

/** Make sure we rest after a strike even if the anim was cut. */
function settleSoon(s: StrikeArgs): void {
  void wait(s.scene, 50).then(() => {
    if (!s.attacker.retired && s.attacker.frameInfo().anim !== 'attack') s.attacker.rest();
  });
}

// ---------------------------------------------------------------- beams

function beamStrike(style: 'prism' | 'water' | 'dark', o: { width?: number } = {}): StrikeFn {
  return async (s) => {
    const track = !!MOUTHS[s.attacker.cardId];
    const chargeMs = await chargeWindow(s, track);
    const piercing = s.attacker.card.effect === 'piercing' && !s.direct && !s.blocked && s.ctx.ev.targetPosition === 'defense';
    const through = piercing ? throughPoint(s) : undefined;
    await beam(s.scene, mouth(s), s.to, style, {
      chargeMs,
      width: o.width,
      through,
      onImpact: () => s.impact(),
    });
    settleSoon(s);
  };
}

function throughPoint(s: StrikeArgs): XY {
  const opp = s.attacker.player === 0 ? 1 : 0;
  const d = s.ctx.views.duelists?.get(opp);
  if (d) return d.chest();
  return { x: s.to.x + (s.attacker.player === 0 ? 70 : -70), y: s.to.y + (s.attacker.player === 0 ? -36 : 36) };
}

// ---------------------------------------------------------------- projectiles

const darkOrbStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  void u.play('attack');
  const fps = u.art.anims.attack.fps;
  await wait(s.scene, Math.max(0, ((u.art.attackImpactFrame - 1) / fps) * 1000 - 120));
  await projectile(s.scene, mouth(s), s.to, 'darkOrb', { chargeMs: 120 + 1000 / fps, onImpact: () => s.impact() });
  settleSoon(s);
};

const boulderStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  void u.play('attack');
  await wait(s.scene, u.impactMs);
  await projectile(s.scene, u.muzzle(), s.to, 'boulder', { chargeMs: 0, onImpact: () => s.impact() });
  settleSoon(s);
};

const sparkStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  void u.play('attack');
  await wait(s.scene, Math.max(0, u.impactMs - 160));
  await projectile(s.scene, () => u.muzzle(), s.to, 'spark', { chargeMs: 160, onImpact: () => s.impact() });
  settleSoon(s);
};

const waveStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  void u.play('attack');
  await wait(s.scene, u.impactMs);
  const m = u.muzzle();
  await projectile(s.scene, { x: m.x, y: u.home.y }, s.toGround, 'wave', { onImpact: () => s.impact() });
  settleSoon(s);
};

const lightningStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  void u.play('attack');
  await wait(s.scene, u.impactMs);
  await lightning(s.scene, u.muzzle(), s.to, { ramp: [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], onImpact: () => s.impact() });
  settleSoon(s);
};

const vineStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  void u.play('attack');
  const root = u.framePoint(36, 41);
  await vineWhip(s.scene, root, s.to, { onImpact: () => s.impact() });
  settleSoon(s);
};

// ---------------------------------------------------------------- melee

function lungeStrike(o: { trail: number; anticipation: number; ms: number; distance: number; onImpact?: (s: StrikeArgs) => void; onDash?: (s: StrikeArgs) => void; stomp?: boolean }): StrikeFn {
  return async (s) => {
    const u = s.attacker;
    // the art's attack wind-up lines up with the lunge's anticipation + dash
    const lead = Math.max(0, u.impactMs - (o.anticipation + o.ms));
    void u.play('attack');
    if (lead > 0) await wait(s.scene, lead);
    if (o.stomp) void wait(s.scene, o.anticipation * 0.7).then(() => shake(s.scene, 120, 2));
    await lunge(s.scene, u.sprite, meleeSpot(s), {
      distance: s.direct ? 26 : o.distance,
      anticipation: o.anticipation,
      ms: o.ms,
      trail: o.trail,
      hold: s.blocked ? 90 : 170,
      onDash: () => o.onDash?.(s),
      onImpact: () => {
        o.onImpact?.(s);
        s.impact();
      },
    });
    settleSoon(s);
  };
}

const titanStrike = lungeStrike({
  trail: PAL.fire2,
  anticipation: 260,
  ms: 150,
  distance: 18,
  stomp: true,
  onImpact: (s) => void slash(s.scene, s.to.x, s.to.y, { color: PAL.fire3, angle: -0.4, size: 18, flip: s.attacker.player === 1 }),
});

const wolfStrike = lungeStrike({
  trail: PAL.fire3,
  anticipation: 290,
  ms: 125,
  distance: 16,
  onDash: (s) => void bite(s.scene, s.to.x - (s.attacker.player === 0 ? 2 : -2), s.to.y, PAL.fire3, { snapAt: 125 }),
});

/** Gölge Adımı: sink into a shadow pool, glide under the target, rise behind it, X-slash, return. */
const shadeStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const home = { ...u.home };
  const tg = s.toGround;
  const behind = { x: tg.x + (tg.x - home.x) * 0.3, y: tg.y + (tg.y - home.y) * 0.3 };
  const pud = shadowPuddle(sc, home.x, home.y);
  await pud.opened;
  await sinkInto(sc, spr, { ms: 200 });
  await puddleTravel(sc, home, behind, { puddle: pud, ms: 320 });
  // emerge facing back toward the target
  const flip = !u.flipX;
  spr.setPosition(behind.x, behind.y - u.hover).setFlipX(flip);
  spr.setOrigin((flip ? u.art.w - u.art.anchorX : u.art.anchorX) / u.art.w, u.art.anchorY / u.art.h);
  spr.setDepth(unitDepth(behind.y));
  await sinkInto(sc, spr, { ms: 180, reverse: true });
  void u.play('attack');
  await wait(sc, u.impactMs);
  s.impact();
  await xSlash(sc, s.to.x, s.to.y, { color: PAL.void3 });
  await wait(sc, 140);
  await sinkInto(sc, spr, { ms: 160 });
  spr.setFlipX(u.flipX);
  spr.setOrigin((u.flipX ? u.art.w - u.art.anchorX : u.art.anchorX) / u.art.w, u.art.anchorY / u.art.h).setDepth(unitDepth(home.y));
  await puddleTravel(sc, behind, home, { puddle: pud, ms: 280 });
  spr.setPosition(home.x, home.y - u.hover);
  await sinkInto(sc, spr, { ms: 180, reverse: true });
  await pud.close();
  u.rest();
};

/** Kasırga Dalışı: rise, spiral dive onto the target (over the defenders on a direct attack), back. */
const hawkStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  const ms = s.direct ? 760 : 640;
  void wait(s.scene, Math.max(0, ms - u.impactMs)).then(() => u.play('attack'));
  const to = s.direct ? { x: s.to.x, y: s.to.y + 6 } : { x: s.toGround.x - (u.player === 0 ? 8 : -8), y: s.toGround.y - 6 };
  u.lift = 1;
  await dive(s.scene, u.sprite, to, { ms, rise: s.direct ? 84 : 58, onImpact: () => s.impact() });
  u.lift = 0;
  settleSoon(s);
};

/** Fallback for monsters without a registered strike: lunge + slash in the attribute colour. */
export const genericStrike: StrikeFn = async (s) => {
  const u = s.attacker;
  const R = RAMPS.gold;
  void u.play('attack');
  await lunge(s.scene, u.sprite, s.toGround, {
    distance: s.direct ? 26 : 16,
    trail: PAL.white,
    onImpact: () => {
      void slash(s.scene, s.to.x, s.to.y, { ramp: R, angle: -0.5, flip: u.player === 1 });
      s.impact();
    },
  });
  settleSoon(s);
};

// a little extra drama on big beams: afterimages on the wyrm's rear-up
const wyrmStrike: StrikeFn = async (s) => {
  void afterimages(s.scene, s.attacker.sprite, 260, PAL.cyan4, { every: 60, alpha: 0.35 });
  await beamStrike('prism', { width: 12 })(s);
};

export function installStrikes(): void {
  registerStrike('crystal_wyrm', wyrmStrike, P);
  registerStrike('abyss_magus', darkOrbStrike, P);
  registerStrike('magma_titan', titanStrike, P);
  registerStrike('coral_serpent', beamStrike('water'), P);
  registerStrike('ember_wolf', wolfStrike, P);
  registerStrike('tide_golem', waveStrike, P);
  registerStrike('storm_hawk', hawkStrike, P);
  registerStrike('stone_sentinel', boulderStrike, P);
  registerStrike('lumen_sprite', sparkStrike, P);
  registerStrike('shade_assassin', shadeStrike, P);
  registerStrike('volt_lizard', lightningStrike, P);
  registerStrike('thorn_lurker', vineStrike, P);
}

// keep imports referenced for tree-shaking clarity
void tween;
void Phaser;
