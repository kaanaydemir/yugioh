// ?dev=vfx-summon — summon & hologram VFX library.
//   &attr=LIGHT|DARK|FIRE|WATER|EARTH|WIND   attribute (default: the monster's, else LIGHT)
//   &monster=<id>        monster sprite (default: a typical monster of the attribute)
//   &big=1               tribute/ace variant
//   &player=1|2          owner side (default 1)
//   &fx=summon|circle|pillar|tribute|materialize|shockwave|flip|set|glitch   single pieces
//   &all=1               all six attributes at once (overview)
//   &arena=0             plain tiles instead of the arena stage
//   &period=MS           loop period (default 3000 / 3600 big)
// The first run starts 150 ms after ready, then loops.
import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../../data/cards';
import { MONSTER_IDS, cardDef, isMonster } from '../../data/cards';
import { monsterArt } from '../../art/monsters';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR } from '../../art/palette';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import type { PlayerId } from '../../engine/types';
import { DEPTH, TILE_H, TILE_W, isoToScreen, unitDepth, zoneXY } from '../../view/layout';
import { wait } from '../../vfx/core';
import { clearHologram, dematerialize, glitch, materialize } from '../../vfx/hologram';
import { seedFx } from '../../vfx/particles';
import { attributeSummon, flipBurst, landingDust, lightPillar, magicCircle, setPulse, shockwave, sparkleBurst, tributeStream } from '../../vfx/summon';
import type { DevPreview } from '../types';

const ATTRS: Attribute[] = ['LIGHT', 'DARK', 'FIRE', 'WATER', 'EARTH', 'WIND'];
const DEFAULT_MON: Record<Attribute, MonsterId> = {
  LIGHT: 'crystal_wyrm',
  DARK: 'shade_assassin',
  FIRE: 'ember_wolf',
  WATER: 'tide_golem',
  EARTH: 'stone_sentinel',
  WIND: 'storm_hawk',
};

function drawTiles(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(DEPTH.TILE);
  for (let c = 0; c < 5; c++)
    for (let r = 0; r < 5; r++) {
      const s = isoToScreen(c, r);
      g.fillStyle(r >= 3 ? PAL.night2 : r <= 1 ? PAL.night1 : PAL.night0, 1);
      g.lineStyle(1, r >= 3 ? PAL.cyan1 : r <= 1 ? PAL.crim1 : PAL.night3, 1);
      g.beginPath();
      g.moveTo(s.x, s.y - TILE_H / 2);
      g.lineTo(s.x + TILE_W / 2, s.y);
      g.lineTo(s.x, s.y + TILE_H / 2);
      g.lineTo(s.x - TILE_W / 2, s.y);
      g.closePath();
      g.fillPath();
      g.strokePath();
    }
}

function makeMonster(scene: Phaser.Scene, id: MonsterId, x: number, y: number, player: PlayerId): Phaser.GameObjects.Sprite {
  const art = monsterArt(id);
  const flip = player === 1;
  const spr = scene.add.sprite(x, y, monsterTextureKey(id), monsterFrameName('idle', 0));
  spr.setOrigin((flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h).setFlipX(flip).setDepth(unitDepth(y));
  spr.play(monsterAnimKey(id, 'idle'));
  return spr;
}

function label(scene: Phaser.Scene, s: string): void {
  scene.add.text(4, 350, s, { fontFamily: 'monospace', fontSize: '8px', color: '#b6fbff' }).setResolution(4).setDepth(DEPTH.DEBUG);
}

const preview: DevPreview = {
  name: 'vfx-summon',
  description: 'summon/hologram VFX: &attr=&monster=&big=1&player=1|2&fx=summon|circle|pillar|tribute|materialize|shockwave|flip|set|glitch&all=1&arena=0',
  async create(scene, params) {
    seedFx(7);
    const monParam = params.get('monster') as MonsterId | null;
    const monDef = monParam && MONSTER_IDS.includes(monParam) ? cardDef(monParam) : null;
    const attr: Attribute = (params.get('attr')?.toUpperCase() as Attribute) || (monDef && isMonster(monDef) ? monDef.attribute : 'LIGHT');
    const monster: MonsterId = monParam && MONSTER_IDS.includes(monParam) ? monParam : DEFAULT_MON[attr] ?? 'crystal_wyrm';
    const big = params.get('big') === '1';
    const player: PlayerId = params.get('player') === '2' ? 1 : 0;
    const fx = params.get('fx') ?? 'summon';
    const all = params.get('all') === '1';
    const period = Number(params.get('period') ?? (big ? 3600 : 3000));

    if (params.get('arena') !== '0') {
      try {
        const mod = await import('../../view/BoardView');
        new mod.BoardView(scene, { active: player });
      } catch (e) {
        console.warn('[vfx-summon] BoardView unavailable, drawing plain tiles', e);
        drawTiles(scene);
      }
    } else {
      scene.cameras.main.setBackgroundColor(PAL.night0);
      drawTiles(scene);
    }

    // In screenshot mode (&test=1) start only once the tool has frozen the loop, so films are
    // deterministic even when the machine is slow (falls back to real time after 20 s; use --film or --step).
    const frozen = () =>
      new Promise<void>((resolve) => {
        if (!params.has('test')) return resolve();
        const t0 = performance.now();
        const h = () => {
          if (!scene.game.loop.running || performance.now() - t0 > 20000) {
            scene.events.off(Phaser.Scenes.Events.UPDATE, h);
            resolve();
          }
        };
        scene.events.on(Phaser.Scenes.Events.UPDATE, h);
      });

    const loop = async (fn: () => Promise<void>, per = period) => {
      await frozen();
      await wait(scene, 150);
      for (;;) {
        const t0 = scene.time.now;
        await fn();
        const used = scene.time.now - t0;
        await wait(scene, Math.max(200, per - used));
      }
    };

    if (all) {
      label(scene, `all attributes${big ? ' (big)' : ''}`);
      const spots = ATTRS.map((a, i) => ({ a, p: (i < 3 ? 0 : 1) as PlayerId, idx: i % 3 }));
      if (fx === 'circle') {
        void loop(async () => {
          await Promise.all(
            spots.map((s) => {
              const xy = zoneXY(s.p, 'monster', s.idx);
              return magicCircle(scene, xy.x, xy.y, { attribute: s.a, player: s.p, size: big ? 'big' : 'normal', ms: period - 600 });
            }),
          );
        });
        return;
      }
      const sprites = spots.map((s) => {
        const xy = zoneXY(s.p, 'monster', s.idx);
        return { ...s, xy, spr: makeMonster(scene, DEFAULT_MON[s.a], xy.x, xy.y, s.p) };
      });
      sprites.forEach((s) => s.spr.setVisible(false));
      void loop(async () => {
        await Promise.all(
          sprites.map((s) =>
            attributeSummon(scene, { x: s.xy.x, y: s.xy.y, attribute: s.a, player: s.p, sprite: s.spr, monsterId: DEFAULT_MON[s.a], big }),
          ),
        );
      });
      return;
    }

    const at = zoneXY(player, 'monster', 1);
    label(scene, `${fx} · ${attr} · ${monster}${big ? ' · big' : ''} · P${player + 1}`);

    switch (fx) {
      case 'circle':
        void loop(() => magicCircle(scene, at.x, at.y, { attribute: attr, player, size: big ? 'big' : 'normal', ms: period - 600 }));
        return;
      case 'pillar':
        void loop(() => lightPillar(scene, at.x, at.y, { attribute: attr, height: big ? 210 : 150, width: big ? 26 : 18, ms: 1200 }));
        return;
      case 'shockwave':
        void loop(async () => {
          void shockwave(scene, at.x, at.y, { ramp: ATTRIBUTE_RAMP[attr], radius: big ? 84 : 54, ms: 440 });
          void sparkleBurst(scene, at.x, at.y - 16, { ramp: ATTRIBUTE_RAMP[attr], count: 16 });
          void landingDust(scene, at.x, at.y, PAL.stone3, { big });
          await wait(scene, 700);
          const set = zoneXY(player, 'spellTrap', 1);
          await setPulse(scene, set.x, set.y, PLAYER_COLOR[player]);
        });
        return;
      case 'set': {
        const set = zoneXY(player, 'spellTrap', 1);
        void loop(() => setPulse(scene, set.x, set.y, PLAYER_COLOR[player]), 1200);
        return;
      }
      case 'materialize':
      case 'glitch': {
        const spr = makeMonster(scene, monster, at.x, at.y, player);
        spr.setVisible(false);
        void loop(async () => {
          await materialize(scene, spr, { attribute: attr, ms: 700 });
          await wait(scene, 500);
          await glitch(scene, spr, 400, 1, { attribute: attr });
          await wait(scene, 400);
          await dematerialize(scene, spr, 520, { attribute: attr });
        }, 3200);
        return;
      }
      case 'flip': {
        const spr = makeMonster(scene, monster, at.x, at.y, player);
        spr.setVisible(false);
        void loop(async () => {
          spr.setVisible(false);
          clearHologram(spr);
          await flipBurst(scene, at.x, at.y, attr);
          await materialize(scene, spr, { attribute: attr, ms: 420 });
          await wait(scene, 900);
          spr.setVisible(false);
        }, 2400);
        return;
      }
      case 'tribute': {
        const from = zoneXY(player, 'monster', 0);
        const fromDef = DEFAULT_MON[attr === 'LIGHT' ? 'WIND' : 'LIGHT'];
        const tribute = makeMonster(scene, monster === DEFAULT_MON[attr] ? (fromDef as MonsterId) : 'lumen_sprite', from.x, from.y, player);
        const ace = makeMonster(scene, monster, at.x, at.y, player);
        ace.setVisible(false);
        const fromAttr = (cardDef(tribute.texture.key.slice(4) as MonsterId) as { attribute?: Attribute }).attribute ?? attr;
        const chain = params.get('chain') !== '0';
        void loop(async () => {
          tribute.setVisible(true);
          ace.setVisible(false);
          await wait(scene, 250);
          await tributeStream(scene, tribute, at, { attribute: fromAttr });
          if (chain) await attributeSummon(scene, { x: at.x, y: at.y, attribute: attr, player, sprite: ace, monsterId: monster, big: true });
          await wait(scene, 600);
        }, chain ? 4200 : 2200);
        return;
      }
      default: {
        const spr = makeMonster(scene, monster, at.x, at.y, player);
        spr.setVisible(false);
        void loop(async () => {
          spr.setVisible(false);
          clearHologram(spr);
          // beat timestamps (scene ms since start) for tools: window.__neon.vfxBeats
          const t0 = scene.time.now;
          const beats: Record<string, number> = {};
          (window.__neon as Record<string, unknown>).vfxBeats = beats;
          await attributeSummon(scene, {
            x: at.x,
            y: at.y,
            attribute: attr,
            player,
            sprite: spr,
            monsterId: monster,
            big,
            onBeat: (b) => (beats[b] = Math.round(scene.time.now - t0)),
          });
          beats.resolved = Math.round(scene.time.now - t0);
        });
      }
    }
  },
};

export default preview;
