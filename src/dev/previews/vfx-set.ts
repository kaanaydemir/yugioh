// ?dev=vfx-set — spell/trap set pieces, effect deliveries, the ace cut-in and banners.
//   &fx=<name>        which piece (no fx → menu). Names: see FX below.
//   &player=1|2       acting player (default 1)
//   &period=MS        loop period override
//   &arena=0          plain tiles instead of the arena stage
//   &once=1           play once (no loop)
// The first run starts 150 ms after the screenshot tool freezes the loop, so films are deterministic.
import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../../data/cards';
import { cardDef, isMonster } from '../../data/cards';
import { monsterArt } from '../../art/monsters';
import { PAL } from '../../art/palette';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import type { PlayerId } from '../../engine/types';
import { DEPTH, TILE_H, TILE_W, type XY, isoToScreen, panelRect, unitDepth, zoneXY } from '../../view/layout';
import { wait } from '../../vfx/core';
import {
  burnFly,
  chainsBind,
  chasm,
  ghostRise,
  healFly,
  healingFountain,
  mirrorDome,
  seedSetFx,
  setVolcanoAmbience,
  spriteBox,
  stormStrike,
  swordForge,
  tendril,
  trapSpring,
  vineBurst,
} from '../../vfx/setpieces';
import { cutIn } from '../../vfx/cutin';
import { banner, clearBanners, duelStart, phaseBanner, trapBanner, turnBanner, victory } from '../../vfx/banners';
import { pixelText } from '../../ui/text';
import type { DevPreview } from '../types';

type Spr = Phaser.GameObjects.Sprite;

const LINEUP: Record<PlayerId, MonsterId[]> = {
  0: ['ember_wolf', 'crystal_wyrm', 'stone_sentinel'],
  1: ['tide_golem', 'shade_assassin', 'storm_hawk'],
};

interface BoardLike {
  setTheme(theme: 'normal' | 'volcano', animate?: boolean, from?: PlayerId | null): Promise<void>;
}

interface Ctx {
  scene: Phaser.Scene;
  board: BoardLike | null;
  player: PlayerId;
  opp: PlayerId;
  mons: Record<PlayerId, Spr[]>;
  reset(): void;
  panel(p: PlayerId): XY;
}

function makeMonster(scene: Phaser.Scene, id: MonsterId, x: number, y: number, player: PlayerId): Spr {
  const art = monsterArt(id);
  const flip = player === 1;
  const spr = scene.add.sprite(x, y, monsterTextureKey(id), monsterFrameName('idle', 0));
  spr.setOrigin((flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h).setFlipX(flip).setDepth(unitDepth(y));
  spr.play(monsterAnimKey(id, 'idle'));
  return spr;
}

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

/** A stand-in face-down card on a tile (the real card view belongs to another module). */
function cardStub(scene: Phaser.Scene, at: XY, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.CARD_ON_TILE);
  g.fillStyle(PAL.night1, 1);
  g.lineStyle(1, color, 1);
  g.beginPath();
  g.moveTo(at.x, at.y - 11);
  g.lineTo(at.x + 18, at.y - 2);
  g.lineTo(at.x, at.y + 7);
  g.lineTo(at.x - 18, at.y - 2);
  g.closePath();
  g.fillPath();
  g.strokePath();
  return g;
}

const ATTR_OF = (id: MonsterId): Attribute => {
  const d = cardDef(id);
  return isMonster(d) ? d.attribute : 'LIGHT';
};

const FX: Record<string, { desc: string; period: number; play: (c: Ctx) => Promise<void> }> = {
  storm: {
    desc: 'Yıldırım Hükmü on the opponent monster',
    period: 2400,
    play: async (c) => {
      const t = c.mons[c.opp][1];
      const at = zoneXY(c.opp, 'monster', 1);
      await stormStrike(c.scene, at.x, at.y, { target: t, onImpact: () => undefined });
      t.setVisible(false);
    },
  },
  fountain: {
    desc: 'Şifa Pınarı: spring → LP panel',
    period: 2400,
    play: (c) => healingFountain(c.scene, c.player, c.panel(c.player)),
  },
  ghost: {
    desc: 'Ruh Çağrısı: ghost from the graveyard to a tile',
    period: 2400,
    play: async (c) => {
      const tgt = c.mons[c.player][1];
      tgt.setVisible(false);
      await ghostRise(c.scene, zoneXY(c.player, 'graveyard'), zoneXY(c.player, 'monster', 1), LINEUP[c.player][1]);
      tgt.setVisible(true);
    },
  },
  sword: {
    desc: 'Ejder Kılıcı: rune sword forge + persistent aura',
    period: 3200,
    play: async (c) => {
      const aura = await swordForge(c.scene, c.mons[c.player][1]);
      await wait(c.scene, 1200);
      aura.destroy();
    },
  },
  volcano: {
    desc: 'Volkan Arenası ambience on → off',
    period: 4600,
    play: async (c) => {
      // in the duel the board's own lava/sky transformation runs alongside (&board=0 to isolate)
      const withBoard = new URLSearchParams(location.search).get('board') !== '0';
      await Promise.all([setVolcanoAmbience(c.scene, true), withBoard ? c.board?.setTheme('volcano', true, c.player) : undefined]);
      await wait(c.scene, 2000);
      await Promise.all([setVolcanoAmbience(c.scene, false), withBoard ? c.board?.setTheme('normal', true) : undefined]);
    },
  },
  trap: {
    desc: 'trap opening burst at a set tile',
    period: 1600,
    play: async (c) => {
      const at = zoneXY(c.player, 'spellTrap', 1);
      await trapSpring(c.scene, at.x, at.y);
    },
  },
  mirror: {
    desc: 'Ayna Kalkanı: dome + reflected beams',
    period: 3000,
    play: async (c) => {
      const attackers = c.mons[c.opp];
      const pts = attackers.map((s) => {
        const b = spriteBox(c.scene, s);
        return { x: b.cx, y: b.cy };
      });
      await mirrorDome(c.scene, c.player, pts, { onHit: (i) => attackers[i].setVisible(false) });
    },
  },
  chains: {
    desc: 'Işık Zincirleri: chains bind the attacker and pull it home',
    period: 2800,
    play: async (c) => {
      const s = c.mons[c.opp][1];
      const home = zoneXY(c.opp, 'monster', 1);
      // the attacker is mid-lunge toward us
      s.setPosition(home.x - (c.opp === 1 ? 26 : -26), home.y + (c.opp === 1 ? 14 : -14));
      await chainsBind(c.scene, zoneXY(c.player, 'spellTrap', 1), s, { home });
    },
  },
  chasm: {
    desc: 'Yer Yarığı: the ground swallows a monster',
    period: 2600,
    play: async (c) => {
      const at = zoneXY(c.opp, 'monster', 1);
      await chasm(c.scene, at.x, at.y, c.mons[c.opp][1]);
    },
  },
  fireball: {
    desc: 'burnFly fireball (Magma Titanı) → opponent panel',
    period: 1800,
    play: async (c) => {
      const s = c.mons[c.player][0];
      const b = spriteBox(c.scene, s);
      await burnFly(c.scene, { x: b.cx, y: b.cy }, c.panel(c.opp), { kind: 'fireball' });
    },
  },
  wisp: {
    desc: 'burnFly wisp (Kor Kurdu flame spirit)',
    period: 1800,
    play: async (c) => {
      const b = spriteBox(c.scene, c.mons[c.player][0]);
      await burnFly(c.scene, { x: b.cx, y: b.top + 6 }, c.panel(c.opp), { kind: 'wisp' });
    },
  },
  bolt: {
    desc: 'burnFly bolt (Şimşek Kertenkelesi)',
    period: 1600,
    play: async (c) => {
      const b = spriteBox(c.scene, c.mons[c.player][1]);
      await burnFly(c.scene, { x: b.cx, y: b.cy }, c.panel(c.opp), { kind: 'bolt' });
    },
  },
  heal: {
    desc: 'healFly sparkles (Işık Perisi) → own panel',
    period: 1800,
    play: async (c) => {
      const b = spriteBox(c.scene, c.mons[c.player][1]);
      await healFly(c.scene, { x: b.cx, y: b.cy }, c.panel(c.player));
    },
  },
  tendril: {
    desc: 'Uçurum Büyücüsü shadow tendril → opponent spell/trap',
    period: 2200,
    play: async (c) => {
      const from = zoneXY(c.player, 'monster', 1);
      const to = zoneXY(c.opp, 'spellTrap', 1);
      await tendril(c.scene, from, to);
    },
  },
  vines: {
    desc: 'Dikenli Pusucu flip: vines crush a monster',
    period: 2400,
    play: async (c) => {
      const at = zoneXY(c.opp, 'monster', 1);
      await vineBurst(c.scene, at.x, at.y, c.mons[c.opp][1]);
      c.mons[c.opp][1].setVisible(false);
    },
  },
  cutin: {
    desc: 'ace cut-in (&id=crystal_wyrm|abyss_magus|magma_titan|coral_serpent)',
    period: 2400,
    play: async (c) => {
      const id = (new URLSearchParams(location.search).get('id') as MonsterId | null) ?? 'crystal_wyrm';
      await cutIn(c.scene, { monsterId: id, name: cardDef(id).name, attribute: ATTR_OF(id), player: c.player });
    },
  },
  turn: {
    desc: 'turn banner',
    period: 1700,
    play: (c) => turnBanner(c.scene, c.player, 3),
  },
  phase: {
    desc: 'phase banners (battle, draw, main, end)',
    period: 4600,
    play: async (c) => {
      await phaseBanner(c.scene, 'battle');
      await wait(c.scene, 200);
      await phaseBanner(c.scene, 'draw');
      await wait(c.scene, 200);
      await phaseBanner(c.scene, 'main');
      await wait(c.scene, 200);
      await phaseBanner(c.scene, 'end');
    },
  },
  trapbanner: {
    desc: '"TUZAK!" slam',
    period: 1700,
    play: (c) => trapBanner(c.scene),
  },
  spellbanner: {
    desc: 'spell banner with sub line',
    period: 1700,
    play: (c) => banner(c.scene, 'YILDIRIM HÜKMÜ', { style: 'spell', sub: 'BÜYÜ KARTI' }),
  },
  battleover: {
    desc: '"SAVAŞ BİTTİ" banner',
    period: 1700,
    play: (c) => banner(c.scene, 'SAVAŞ BİTTİ', { style: 'trap' }),
  },
  deckout: {
    desc: '"DESTE BİTTİ!" big slam in crimson (color option)',
    period: 2200,
    play: (c) => banner(c.scene, 'DESTE BİTTİ!', { style: 'big', color: PAL.crim3 }),
  },
  duel: {
    desc: '"DÜELLO!" slam',
    period: 2200,
    play: (c) => duelStart(c.scene),
  },
  victory: {
    desc: '"KAZANAN: OYUNCU 1" + fireworks',
    period: 4600,
    play: (c) => victory(c.scene, c.player, { hold: 2400 }),
  },
};

const preview: DevPreview = {
  name: 'vfx-set',
  description: 'spell/trap set pieces, deliveries, cut-in, banners: &fx=' + Object.keys(FX).join('|') + ' &player=1|2',
  async create(scene, params) {
    seedSetFx(11);
    const fxName = params.get('fx') ?? '';
    const player: PlayerId = params.get('player') === '2' ? 1 : 0;
    const opp: PlayerId = player === 0 ? 1 : 0;

    let board: BoardLike | null = null;
    if (params.get('arena') !== '0') {
      try {
        const mod = await import('../../view/BoardView');
        board = new mod.BoardView(scene, { active: player });
      } catch (e) {
        console.warn('[vfx-set] BoardView unavailable, drawing plain tiles', e);
        drawTiles(scene);
      }
    } else drawTiles(scene);

    const entry = FX[fxName];
    if (!entry) {
      pixelText(scene, 8, 8, 'VFX-SET  (?dev=vfx-set&fx=...)', { size: 'md', color: PAL.teal3 }).setDepth(DEPTH.DEBUG);
      Object.entries(FX).forEach(([k, v], i) => {
        const t = pixelText(scene, 8 + Math.floor(i / 16) * 320, 24 + (i % 16) * 10, `${k} — ${v.desc}`, { size: 'sm', color: PAL.mist })
          .setDepth(DEPTH.DEBUG)
          .setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => (location.search = `?dev=vfx-set&fx=${k}`));
      });
      return;
    }

    // stand-in set cards
    cardStub(scene, zoneXY(player, 'spellTrap', 1), player === 0 ? PAL.cyan3 : PAL.crim3);
    cardStub(scene, zoneXY(opp, 'spellTrap', 1), opp === 0 ? PAL.cyan3 : PAL.crim3);

    const mons: Record<PlayerId, Spr[]> = { 0: [], 1: [] };
    const reset = () => {
      clearBanners(scene, 0);
      for (const p of [0, 1] as PlayerId[]) {
        mons[p].forEach((s) => s.destroy());
        mons[p] = LINEUP[p].map((id, i) => {
          const xy = zoneXY(p, 'monster', i);
          return makeMonster(scene, id, xy.x, xy.y, p);
        });
      }
    };
    reset();
    const ctx: Ctx = {
      scene,
      board,
      player,
      opp,
      mons,
      reset,
      panel: (p) => {
        const r = panelRect(p);
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      },
    };
    // panels stand-ins so deliveries have a visible destination
    for (const p of [0, 1] as PlayerId[]) {
      const r = panelRect(p);
      const g = scene.add.graphics().setDepth(DEPTH.HUD);
      g.fillStyle(PAL.night0, 0.85).fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(1, p === 0 ? PAL.cyan2 : PAL.crim2, 1).strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      pixelText(scene, r.x + 6, r.y + 6, `OYUNCU ${p + 1}`, { size: 'md', color: p === 0 ? PAL.cyan3 : PAL.crim3 }).setDepth(DEPTH.HUD + 1);
      pixelText(scene, r.x + 6, r.y + 24, 'LP 4000', { size: 'lg', color: PAL.white }).setDepth(DEPTH.HUD + 1);
    }

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

    const period = Number(params.get('period') ?? entry.period);
    const once = params.get('once') === '1';
    void (async () => {
      await frozen();
      await wait(scene, 150);
      for (let n = 0; ; n++) {
        seedSetFx(11 + n);
        const t0 = scene.time.now;
        const beats = { resolved: -1 };
        (window.__neon as Record<string, unknown>).vfxSet = beats;
        try {
          await entry.play(ctx);
        } catch (e) {
          console.error(e);
          window.__neon.errors.push(`vfx-set ${fxName}: ${String(e)}`);
        }
        beats.resolved = Math.round(scene.time.now - t0);
        const used = scene.time.now - t0;
        if (once) return;
        await wait(scene, Math.max(300, period - used));
        reset();
      }
    })();
  },
};

export default preview;
