// ?dev=vfx-combat&fx=<name> — combat VFX test bench (loops forever).
//   P1 monster on zone 1 (attacker, &a=<id>), P2 monster on zone 1 (defender, &b=<id>).
//   &sync=1   start when tools/shot.mjs freezes the loop (film t=0 = effect start)
//   &swap=1   P2 attacks P1 (mirrored)
//   &zoom=N   camera zoom on the duel (inspection only)
// Without &fx a menu of every effect is shown (click to open).
import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../../data/cards';
import { MONSTER_IDS, cardDef } from '../../data/cards';
import { monsterArt } from '../../art/monsters';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR, RAMPS } from '../../art/palette';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import type { MonsterArt, MonsterAnim } from '../../art/types';
import type { PlayerId } from '../../engine/types';
import { BOARD_COLS, BOARD_ROWS, DEPTH, isoToScreen, unitDepth, zoneXY, type XY } from '../../view/layout';
import { wait } from '../../vfx/core';
import * as fx from '../../vfx/combat';
import * as nums from '../../vfx/numbers';
import { shatter } from '../../vfx/shatter';
import * as wyrmArt from '../../art/monsters/crystal_wyrm';
import type { DevPreview } from '../types';

// ------------------------------------------------------------------ film-accurate clock (dev only)

/**
 * Phaser ≥3.60 tweens read Date.now(), and the stock step() runs frames back-to-back in one task
 * (await continuations would not run between frames). While frozen, make Date.now() follow the
 * stepped clock and yield a macrotask per frame. Same flag as other previews, so it installs once.
 */
function installVirtualClock(): void {
  const neon = window.__neon as typeof window.__neon & { __virtualClock?: boolean };
  if (!neon || neon.__virtualClock) return;
  neon.__virtualClock = true;
  const realNow = Date.now.bind(Date);
  let virt: number | null = null;
  const freeze = neon.freeze.bind(neon);
  const step = neon.step.bind(neon);
  const unfreeze = neon.unfreeze.bind(neon);
  Date.now = () => (virt === null ? realNow() : Math.floor(virt));
  neon.freeze = () => {
    virt = realNow();
    freeze();
  };
  (neon as unknown as { step: (ms: number) => Promise<void> }).step = async (ms: number) => {
    const dt = 1000 / 60;
    const n = Math.max(1, Math.round(ms / dt));
    for (let i = 0; i < n; i++) {
      if (virt !== null) virt += dt;
      step(dt);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  };
  neon.unfreeze = () => {
    virt = null;
    unfreeze();
  };
}

// ------------------------------------------------------------------ stage

function drawIsoTile(g: Phaser.GameObjects.Graphics, x: number, y: number, fill: number, line: number) {
  g.fillStyle(fill, 1);
  g.lineStyle(1, line, 1);
  g.beginPath();
  g.moveTo(x, y - 16);
  g.lineTo(x + 32, y);
  g.lineTo(x, y + 16);
  g.lineTo(x - 32, y);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

async function buildBoard(scene: Phaser.Scene): Promise<void> {
  try {
    const mod = await import('../../view/BoardView');
    new mod.BoardView(scene, { active: 0 });
    return;
  } catch (e) {
    console.warn('[vfx-combat] BoardView unavailable, drawing plain tiles', e);
  }
  const g = scene.add.graphics().setDepth(DEPTH.TILE);
  for (let r = 0; r < BOARD_ROWS; r++)
    for (let c = 0; c < BOARD_COLS; c++) {
      const { x, y } = isoToScreen(c, r);
      drawIsoTile(g, x, y, PAL.night1, r >= 3 ? PAL.cyan1 : r <= 1 ? PAL.crim1 : PAL.night3);
    }
}

export interface Unit {
  id: MonsterId;
  art: MonsterArt;
  player: PlayerId;
  sprite: Phaser.GameObjects.Sprite;
  /** Ground point (tile center). */
  ground: XY;
  core(): XY;
  muzzle(): XY;
  /** Live mouth/muzzle position following the current attack frame (falls back to art.muzzle). */
  mouth(): XY;
  play(anim: MonsterAnim, loop?: boolean): void;
  /** Play `attack` and resolve on the impact frame. */
  attackToImpact(): Promise<void>;
  /** Play `attack`; resolve when a charge of the returned length should start (whole wind-up if the art tracks its mouth, else the last ~180 ms). */
  attackCharge(): Promise<number>;
  reset(): void;
}

/** Per-attack-frame mouth tables exported by monster art (optional). */
const MOUTHS: Partial<Record<MonsterId, { x: number; y: number }[]>> = {
  crystal_wyrm: (wyrmArt as unknown as { CRYSTAL_WYRM_MOUTH?: { x: number; y: number }[] }).CRYSTAL_WYRM_MOUTH,
};

function makeUnit(scene: Phaser.Scene, id: MonsterId, player: PlayerId, zone: number, params: URLSearchParams): Unit {
  const art = monsterArt(id);
  const ground = zoneXY(player, 'monster', zone);
  const flip = player === 1;
  const spr = scene.add.sprite(ground.x, ground.y - art.hover, monsterTextureKey(id), monsterFrameName('idle', 0));
  spr.setOrigin((flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h).setFlipX(flip);
  spr.setDepth(unitDepth(ground.y));
  spr.play(monsterAnimKey(id, 'idle'));
  // drop shadow
  const sh = scene.add.ellipse(ground.x, ground.y, Math.max(16, art.w * 0.36), Math.max(6, art.w * 0.12), PAL.ink, 0.45).setDepth(DEPTH.SHADOW);
  void sh;
  const u: Unit = {
    id,
    art,
    player,
    sprite: spr,
    ground,
    core: () => fx.framePointToWorld(spr, art.core.x, art.core.y),
    muzzle: () => fx.framePointToWorld(spr, art.muzzle.x, art.muzzle.y),
    mouth: () => {
      const table = MOUTHS[id];
      const name = String(spr.frame.name);
      const f = name.startsWith('attack:') ? Number(name.slice(7)) : -1;
      const m = table && f >= 0 && table[f] ? table[f] : art.muzzle;
      return fx.framePointToWorld(spr, m.x, m.y);
    },
    play(anim, loop) {
      spr.play({ key: monsterAnimKey(id, anim), repeat: loop ? -1 : art.anims[anim].loop ? -1 : 0 });
      if (!loop && !art.anims[anim].loop) spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.play(monsterAnimKey(id, 'idle')));
    },
    attackToImpact() {
      u.play('attack');
      const ms = (art.attackImpactFrame / art.anims.attack.fps) * 1000;
      return wait(scene, ms);
    },
    async attackCharge() {
      u.play('attack');
      const ms = (art.attackImpactFrame / art.anims.attack.fps) * 1000;
      if (MOUTHS[id]) return ms;
      const charge = Math.min(ms, 1000 / art.anims.attack.fps + 20);
      await wait(scene, ms - charge);
      return charge;
    },
    reset() {
      spr.setVisible(true).setAlpha(1).setPosition(ground.x, ground.y - art.hover).setScale(1).setAngle(0).clearTint();
      spr.setCrop();
      spr.setDepth(unitDepth(ground.y));
      spr.play(monsterAnimKey(id, 'idle'));
    },
  };
  return u;
}

interface Ctx {
  scene: Phaser.Scene;
  A: Unit; // attacker
  B: Unit; // defender
  say(s: string): void;
}

interface Stage {
  a?: MonsterId;
  b?: MonsterId;
  gap?: number;
  desc: string;
  run(c: Ctx): Promise<void>;
}

// ------------------------------------------------------------------ stages

function attrOf(id: MonsterId): Attribute {
  const d = cardDef(id);
  return d.kind === 'monster' ? d.attribute : 'LIGHT';
}

const STAGES: Record<string, Stage> = {
  arrow: {
    desc: 'attackArrow + lockOn (attack declaration)',
    async run({ scene, A, B }) {
      const arrow = fx.attackArrow(scene, A.core(), B.core(), A.player);
      const lock = fx.lockOn(scene, B.core().x, B.core().y, { color: PLAYER_COLOR[A.player], size: Math.round(B.art.w * 0.45) });
      await arrow.done;
      await wait(scene, 900);
      arrow.destroy();
      lock.destroy();
      await wait(scene, 300);
    },
  },
  impact1: {
    desc: 'impact power 1',
    async run({ scene, B }) {
      await wait(scene, 200);
      B.play('hit');
      await fx.impact(scene, B.core().x, B.core().y, { power: 1, sprite: B.sprite });
      await wait(scene, 500);
    },
  },
  impact2: {
    desc: 'impact power 2',
    async run({ scene, B }) {
      await wait(scene, 200);
      B.play('hit');
      await fx.impact(scene, B.core().x, B.core().y, { power: 2, sprite: B.sprite, dir: { x: 1, y: -0.5 } });
      await wait(scene, 500);
    },
  },
  impact3: {
    desc: 'impact power 3',
    async run({ scene, B }) {
      await wait(scene, 200);
      B.play('hit');
      await fx.impact(scene, B.core().x, B.core().y, { power: 3, sprite: B.sprite, ramp: RAMPS.cyan });
      await wait(scene, 600);
    },
  },
  clang: {
    desc: 'blockClang (attack bounces off a defender)',
    async run({ scene, A, B }) {
      await wait(scene, 200);
      await fx.blockClang(scene, B.core().x - 8, B.core().y, { from: A.core() });
      await wait(scene, 500);
    },
  },
  prism: {
    a: 'crystal_wyrm',
    desc: 'beam prism — Kristal Ejder "Prizma Nefesi"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      const chargeMs = await A.attackCharge();
      await fx.beam(scene, () => A.mouth(), B.core(), 'prism', {
        chargeMs,
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 3, sprite: B.sprite, ramp: RAMPS.cyan, dir: { x: 1, y: -0.5 } });
        },
      });
      await wait(scene, 500);
    },
  },
  water: {
    a: 'coral_serpent',
    b: 'ember_wolf',
    desc: 'beam water — Mercan Yılanı "Gelgit Mızrağı" (piercing → duelist)',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      const chargeMs = await A.attackCharge();
      await fx.beam(scene, () => A.mouth(), B.core(), 'water', {
        chargeMs,
        through: { x: B.core().x + 70, y: B.core().y - 40 },
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 2, sprite: B.sprite, ramp: RAMPS.water });
        },
      });
      await wait(scene, 500);
    },
  },
  dark: {
    a: 'abyss_magus',
    b: 'crystal_wyrm',
    desc: 'beam dark',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      const chargeMs = await A.attackCharge();
      await fx.beam(scene, () => A.mouth(), B.core(), 'dark', {
        chargeMs,
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 2, sprite: B.sprite, ramp: RAMPS.void });
        },
      });
      await wait(scene, 500);
    },
  },
  darkOrb: {
    a: 'abyss_magus',
    b: 'ember_wolf',
    desc: 'projectile darkOrb — Uçurum Büyücüsü "Uçurum Küresi"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      A.play('attack');
      // the magus art grows its own staff orb during the wind-up: runes join for the last beat
      await wait(scene, ((A.art.attackImpactFrame - 1) / A.art.anims.attack.fps) * 1000 - 120);
      await fx.projectile(scene, () => A.mouth(), B.core(), 'darkOrb', {
        chargeMs: 120 + 1000 / A.art.anims.attack.fps,
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 2, sprite: B.sprite, ramp: RAMPS.void });
        },
      });
      await wait(scene, 400);
    },
  },
  fireball: {
    a: 'magma_titan',
    b: 'tide_golem',
    desc: 'projectile fireball (Magma Titanı burn → P2 panel)',
    async run({ scene, A }) {
      await wait(scene, 150);
      await fx.projectile(scene, A.core(), { x: 560, y: 40 }, 'fireball', {
        onImpact: () => void nums.damageNumber(scene, 560, 30, 500, 'damage'),
      });
      await wait(scene, 600);
    },
  },
  spark: {
    a: 'lumen_sprite',
    b: 'shade_assassin',
    desc: 'projectile spark — Işık Perisi "Işık Kıvılcımı"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      await fx.projectile(scene, A.core(), B.core(), 'spark', {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 1, sprite: B.sprite, ramp: RAMPS.gold });
        },
      });
      await wait(scene, 400);
    },
  },
  boulder: {
    a: 'stone_sentinel',
    b: 'abyss_magus',
    desc: 'projectile boulder — Taş Muhafız "Kaya Fırlatma"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      const hands = { x: A.core().x + 6, y: A.core().y - 14 };
      await fx.projectile(scene, hands, B.core(), 'boulder', {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 2, sprite: B.sprite, ramp: RAMPS.earth });
        },
      });
      await wait(scene, 400);
    },
  },
  wave: {
    a: 'tide_golem',
    b: 'magma_titan',
    desc: 'projectile wave — Gelgit Golemi "Dalga Darbesi"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      A.play('attack');
      await fx.projectile(scene, A.ground, B.ground, 'wave', {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 2, sprite: B.sprite, ramp: RAMPS.water });
        },
      });
      await wait(scene, 400);
    },
  },
  waterball: {
    a: 'tide_golem',
    b: 'ember_wolf',
    desc: 'projectile water blob (Gelgit Golemi counter-splash)',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      await fx.projectile(scene, A.core(), B.core(), 'water', {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 1, sprite: B.sprite, ramp: RAMPS.water });
        },
      });
      await wait(scene, 400);
    },
  },
  lunge: {
    a: 'ember_wolf',
    b: 'stone_sentinel',
    desc: 'lunge + bite — Kor Kurdu "Kor Dişi"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      await fx.lunge(scene, A.sprite, B.ground, {
        distance: 16,
        trail: PAL.fire3,
        onDash: () => void fx.bite(scene, B.core().x - 2, B.core().y, PAL.fire3, { snapAt: 120 }),
        onImpact: () => {
          const c = B.core();
          B.play('hit');
          void fx.impact(scene, c.x, c.y, { power: 2, sprite: B.sprite, ramp: RAMPS.fire, dir: { x: 1, y: -0.5 } });
        },
      });
      await wait(scene, 400);
    },
  },
  melee: {
    a: 'magma_titan',
    b: 'shade_assassin',
    desc: 'lunge + slash — heavy punch (Magma Titanı "Lav Yumruğu")',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      await fx.lunge(scene, A.sprite, B.ground, {
        distance: 18,
        anticipation: 260,
        ms: 150,
        trail: PAL.fire2,
        onImpact: () => {
          const c = B.core();
          B.play('hit');
          void fx.slash(scene, c.x, c.y, { color: PAL.fire3, angle: -0.4, size: 16 });
          void fx.impact(scene, c.x, c.y, { power: 3, sprite: B.sprite, ramp: RAMPS.fire, dir: { x: 1, y: -0.5 } });
        },
      });
      await wait(scene, 400);
    },
  },
  slash: {
    desc: 'slash variations',
    async run({ scene, B }) {
      const c = B.core();
      await wait(scene, 150);
      await fx.slash(scene, c.x, c.y, { color: PAL.cyan3, angle: -0.5 });
      await wait(scene, 150);
      await fx.slash(scene, c.x, c.y, { color: PAL.fire3, angle: 0.6, flip: true, size: 22 });
      await wait(scene, 150);
      await fx.slash(scene, c.x, c.y, { color: PAL.white, angle: Math.PI / 2, size: 14 });
      await wait(scene, 300);
    },
  },
  xslash: {
    a: 'shade_assassin',
    b: 'lumen_sprite',
    desc: 'shadow step + xSlash — Gölge Suikastçı "Gölge Adımı"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      const home = { ...A.ground };
      const behind = { x: B.ground.x + (B.ground.x - A.ground.x) * 0.35, y: B.ground.y + (B.ground.y - A.ground.y) * 0.35 };
      const pud = fx.shadowPuddle(scene, home.x, home.y);
      await pud.opened;
      await fx.sinkInto(scene, A.sprite, { ms: 220 });
      await fx.puddleTravel(scene, home, behind, { puddle: pud, ms: 340 });
      A.sprite.setPosition(behind.x, behind.y).setFlipX(true);
      A.sprite.setOrigin((A.art.w - A.art.anchorX) / A.art.w, A.art.anchorY / A.art.h);
      A.sprite.setDepth(B.sprite.depth - 1);
      await fx.sinkInto(scene, A.sprite, { ms: 200, reverse: true });
      A.play('attack');
      await wait(scene, (A.art.attackImpactFrame / A.art.anims.attack.fps) * 1000);
      const c = B.core();
      B.play('hit');
      void fx.impact(scene, c.x, c.y, { power: 2, sprite: B.sprite, ramp: RAMPS.void, noStop: true });
      await fx.xSlash(scene, c.x, c.y, { color: PAL.void3 });
      await wait(scene, 200);
      await fx.sinkInto(scene, A.sprite, { ms: 180 });
      A.sprite.setFlipX(false).setOrigin(A.art.anchorX / A.art.w, A.art.anchorY / A.art.h).setDepth(unitDepth(home.y));
      await fx.puddleTravel(scene, behind, home, { puddle: pud, ms: 300 });
      A.sprite.setPosition(home.x, home.y);
      await fx.sinkInto(scene, A.sprite, { ms: 200, reverse: true });
      await pud.close();
      await wait(scene, 300);
    },
  },
  bite: {
    desc: 'bite jaws alone',
    async run({ scene, B }) {
      await wait(scene, 150);
      const c = B.core();
      await fx.bite(scene, c.x, c.y, PAL.fire3);
      await wait(scene, 200);
      await fx.bite(scene, c.x, c.y, PAL.void3, { size: 16 });
      await wait(scene, 300);
    },
  },
  dive: {
    a: 'storm_hawk',
    b: 'tide_golem',
    desc: 'dive spiral — Fırtına Atmacası "Kasırga Dalışı"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      await fx.dive(scene, A.sprite, { x: B.ground.x - 8, y: B.ground.y - 6 }, {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 1, sprite: B.sprite, ramp: RAMPS.leaf });
        },
      });
      await wait(scene, 400);
    },
  },
  vine: {
    a: 'thorn_lurker',
    b: 'magma_titan',
    desc: 'vineWhip — Dikenli Pusucu "Diken Kırbacı"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      A.play('attack');
      const from = { x: A.ground.x + 10, y: A.ground.y - 4 };
      await fx.vineWhip(scene, from, B.core(), {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 1, sprite: B.sprite, ramp: RAMPS.leaf });
        },
      });
      await wait(scene, 400);
    },
  },
  lightning: {
    a: 'volt_lizard',
    b: 'coral_serpent',
    desc: 'lightning — Şimşek Kertenkelesi "Şimşek Kuyruğu"',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      A.play('attack');
      await wait(scene, (A.art.attackImpactFrame / A.art.anims.attack.fps) * 1000);
      await fx.lightning(scene, A.muzzle(), B.core(), {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 2, sprite: B.sprite, ramp: RAMPS.gold });
        },
      });
      await wait(scene, 500);
    },
  },
  skybolt: {
    desc: 'skyBolt (Yıldırım Hükmü)',
    async run({ scene, B }) {
      await wait(scene, 150);
      await fx.skyBolt(scene, B.ground.x, B.ground.y, {
        onImpact: () => {
          B.play('hit');
          void fx.impact(scene, B.core().x, B.core().y, { power: 3, sprite: B.sprite, noStop: true });
        },
      });
      await wait(scene, 500);
    },
  },
  shatter: {
    b: 'crystal_wyrm',
    desc: 'shatter (destroy) — the monster bursts into its own pixels',
    gap: 500,
    async run({ scene, A, B }) {
      await wait(scene, 250);
      B.play('hit');
      await wait(scene, 120);
      await shatter(scene, B.sprite, { monsterId: B.id, attribute: attrOf(B.id), push: { x: B.ground.x - A.ground.x, y: B.ground.y - A.ground.y } });
      await wait(scene, 300);
    },
  },
  shatter2: {
    a: 'abyss_magus',
    b: 'shade_assassin',
    desc: 'shatter a small P2 (flipped) monster',
    gap: 500,
    async run({ scene, A, B }) {
      await wait(scene, 250);
      await shatter(scene, B.sprite, { monsterId: B.id, attribute: attrOf(B.id), push: { x: B.ground.x - A.ground.x, y: B.ground.y - A.ground.y } });
      await wait(scene, 300);
    },
  },
  numbers: {
    desc: 'damageNumber: damage / heal / buff / debuff (+ size 2)',
    async run({ scene, B }) {
      const c = B.core();
      await wait(scene, 150);
      void nums.damageNumber(scene, c.x, c.y - 20, 1700, 'damage');
      await wait(scene, 250);
      void nums.damageNumber(scene, c.x - 70, c.y + 10, 1000, 'heal');
      await wait(scene, 250);
      void nums.damageNumber(scene, c.x + 60, c.y + 30, 700, 'buff');
      await wait(scene, 250);
      void nums.damageNumber(scene, c.x - 40, c.y + 60, 300, 'debuff');
      await wait(scene, 250);
      await nums.damageNumber(scene, 200, 250, 2800, 'damage', { size: 2 });
      await wait(scene, 1200);
    },
  },
  statpop: {
    desc: 'statPop: ATK up (Ejder Kılıcı) and down (Volkan Arenası on WATER)',
    async run({ scene, A, B }) {
      await wait(scene, 150);
      await nums.statPop(scene, A.core().x, A.core().y - 34, 1700, 2400);
      await wait(scene, 300);
      await nums.statPop(scene, B.core().x, B.core().y - 34, 2300, 2000);
      await wait(scene, 900);
    },
  },
  combo: {
    a: 'crystal_wyrm',
    b: 'abyss_magus',
    gap: 600,
    desc: 'full battle: declare → lock → Prizma Nefesi → impact → −500 → shatter',
    async run({ scene, A, B }) {
      await wait(scene, 200);
      const arrow = fx.attackArrow(scene, A.core(), B.core(), A.player);
      const lock = fx.lockOn(scene, B.core().x, B.core().y, { color: PLAYER_COLOR[A.player], size: 34 });
      await arrow.done;
      await wait(scene, 350);
      arrow.destroy();
      lock.destroy();
      const chargeMs = await A.attackCharge();
      let hit!: Promise<void>;
      await fx.beam(scene, () => A.mouth(), B.core(), 'prism', {
        chargeMs,
        onImpact: () => {
          B.play('hit');
          const c = B.core();
          hit = fx.impact(scene, c.x, c.y, { power: 3, sprite: B.sprite, ramp: RAMPS.cyan, dir: { x: 1, y: -0.5 } });
          void hit.then(() => nums.damageNumber(scene, c.x, c.y - 30, 500, 'damage'));
        },
      });
      await shatter(scene, B.sprite, { monsterId: B.id, attribute: attrOf(B.id), push: { x: 1, y: -0.5 } });
      await wait(scene, 400);
    },
  },
  multi: {
    desc: 'stress: 3 overlapping impacts + shatter freeze (must never lock the clock)',
    async run({ scene, A, B, say }) {
      await wait(scene, 150);
      const hits = [
        fx.impact(scene, B.core().x, B.core().y, { power: 3, sprite: B.sprite }),
        fx.impact(scene, A.core().x, A.core().y, { power: 2, sprite: A.sprite, ramp: RAMPS.crim }),
      ];
      await wait(scene, 10);
      hits.push(fx.impact(scene, B.core().x + 10, B.core().y - 10, { power: 1 }));
      await Promise.all(hits);
      say(`multi: clock ok (tweens.timeScale=${scene.tweens.timeScale})`);
      await wait(scene, 400);
    },
  },
  direct: {
    desc: 'directHit on player 2',
    async run({ scene }) {
      await wait(scene, 200);
      await fx.directHit(scene, 1);
      await wait(scene, 700);
    },
  },
};

// ------------------------------------------------------------------ preview

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = '#b6fbff') {
  return scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: '8px', color }).setResolution(4).setDepth(DEPTH.DEBUG);
}

const preview: DevPreview = {
  name: 'vfx-combat',
  description: 'combat VFX bench: &fx=<name> (menu without) &a=<id> &b=<id> &swap=1 &sync=1',
  async create(scene, params) {
    installVirtualClock();
    fx.seedCombatFx(7);
    const name = params.get('fx') ?? '';
    const stage = STAGES[name];
    scene.cameras.main.setBackgroundColor(PAL.night0);
    if (!stage) {
      label(scene, 8, 6, 'VFX-COMBAT — ?dev=vfx-combat&fx=<name>   (click one)', '#fff4b5');
      Object.entries(STAGES).forEach(([k, s], i) => {
        const t = label(scene, 8 + Math.floor(i / 30) * 320, 20 + (i % 30) * 11, `${k.padEnd(12)} ${s.desc}`);
        t.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          const q = new URLSearchParams(location.search);
          q.set('fx', k);
          location.search = q.toString();
        });
      });
      return;
    }
    await buildBoard(scene);
    const swap = params.get('swap') === '1';
    const aId = (params.get('a') as MonsterId) ?? stage.a ?? 'crystal_wyrm';
    const bId = (params.get('b') as MonsterId) ?? stage.b ?? 'abyss_magus';
    for (const id of [aId, bId]) if (!MONSTER_IDS.includes(id)) throw new Error(`unknown monster ${id}`);
    const p1 = makeUnit(scene, swap ? bId : aId, 0, 1, params);
    const p2 = makeUnit(scene, swap ? aId : bId, 1, 1, params);
    const A = swap ? p2 : p1;
    const B = swap ? p1 : p2;
    const zoom = Number(params.get('zoom') ?? 1);
    if (zoom !== 1) {
      const mid = { x: (A.ground.x + B.ground.x) / 2, y: (A.ground.y + B.ground.y) / 2 - 20 };
      scene.cameras.main.setZoom(zoom).centerOn(mid.x, mid.y);
    }
    const title = label(scene, 4, 350, `fx=${name}  ${cardDef(A.id).name} → ${cardDef(B.id).name}  — ${stage.desc}`, '#a3b1da');
    title.setScrollFactor(0);
    const ctx: Ctx = { scene, A, B, say: (s) => title.setText(s) };
    const loop = async () => {
      for (;;) {
        fx.seedCombatFx(7);
        A.reset();
        B.reset();
        await stage.run(ctx);
        await wait(scene, stage.gap ?? 300);
      }
    };
    if (params.get('sync') === '1') {
      const neon = window.__neon;
      const freeze = neon.freeze;
      let started = false;
      neon.freeze = () => {
        freeze();
        if (!started) {
          started = true;
          void loop();
        }
      };
    } else void loop();
    void ATTRIBUTE_RAMP;
  },
};

export default preview;
