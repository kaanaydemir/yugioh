// ?dev=cardfx — card motion test bench (loops forever; use tools/shot.mjs --film to inspect).
//   &fx=all (default) | flip | hover | fly | slam | flipup | rotate | sheen | stand | dissolve | highlight
// Add &sync=1 when filming so the stage starts exactly at film t=0.
// Suggested film clips (game px):
//   slam/flipup/rotate/stand/sheen: --clip 160,60,320,200     flip/hover/dissolve: --clip 120,200,400,160
import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { CardSprite } from '../../view/CardSprite';
import { TileCard } from '../../view/TileCard';
import { BOARD_COLS, BOARD_ROWS, DEPTH, isoToScreen, zoneXY } from '../../view/layout';
import { wait } from '../../vfx/core';
import type { DevPreview } from '../types';
import { drawIsoTile } from './monster';

function label(scene: Phaser.Scene, x: number, y: number, s: string) {
  return scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: '8px', color: '#7f8fc0' }).setResolution(4).setDepth(DEPTH.DEBUG);
}

function board(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(DEPTH.TILE);
  for (let r = 0; r < BOARD_ROWS; r++)
    for (let c = 0; c < BOARD_COLS; c++) {
      const { x, y } = isoToScreen(c, r);
      const p1 = r >= 3;
      const p2 = r <= 1;
      drawIsoTile(g, x, y, PAL.night1, p1 ? PAL.cyan1 : p2 ? PAL.crim1 : PAL.night3);
    }
}

/**
 * Film-accuracy shim (dev only):
 *  1. Phaser ≥3.60 tweens time themselves with Date.now(), so tools/shot.mjs --film (which
 *     freezes the RAF loop and steps it) would advance tweens by wall-clock time. While frozen,
 *     Date.now() follows the stepped game clock.
 *  2. step(ms) ran every frame in one synchronous task, so `await` continuations of async
 *     cinematics could not run until the whole step finished. Steps now yield a macrotask
 *     between frames (step returns a Promise; page.evaluate awaits it).
 */
export function installVirtualClock(): void {
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

function loop(fn: () => Promise<void>) {
  void (async () => {
    for (;;) await fn();
  })();
}

const HAND: CardId[] = ['crystal_wyrm', 'judgment_bolt', 'mirror_barrier', 'ember_wolf', 'volcano_arena'];

function stageSlam(scene: Phaser.Scene) {
  const a = new TileCard(scene, 0, 'monster', 1, 'ember_wolf', true, 'up').setVisible(false);
  const b = new TileCard(scene, 1, 'spellTrap', 0, 'chasm_trap', false, 'up').setVisible(false);
  const c = new TileCard(scene, 0, 'monster', 0, 'tide_golem', false, 'side').setVisible(false);
  loop(async () => {
    await wait(scene, 200);
    await a.slamIn({ x: 300, y: 330 });
    await wait(scene, 250);
    await b.slamIn({ x: 340, y: 330 });
    await wait(scene, 250);
    await c.slamIn({ x: 280, y: 330 });
    await wait(scene, 900);
    a.setVisible(false);
    b.setVisible(false);
    c.setVisible(false);
  });
}

function stageFlipUp(scene: Phaser.Scene) {
  const a = new TileCard(scene, 0, 'monster', 1, 'thorn_lurker', false, 'side');
  const b = new TileCard(scene, 1, 'monster', 1, 'shade_assassin', false, 'up');
  loop(async () => {
    await wait(scene, 500);
    await a.flipUp();
    await wait(scene, 200);
    await b.flipUp();
    await wait(scene, 900);
    a.sync('thorn_lurker', false, 'side');
    b.sync('shade_assassin', false, 'up');
  });
}

function stageRotate(scene: Phaser.Scene) {
  const a = new TileCard(scene, 0, 'monster', 1, 'stone_sentinel', true, 'up');
  const b = new TileCard(scene, 1, 'monster', 1, 'coral_serpent', true, 'up');
  loop(async () => {
    await wait(scene, 450);
    await Promise.all([a.rotateTo('side'), b.rotateTo('side')]);
    await wait(scene, 600);
    await Promise.all([a.rotateTo('up'), b.rotateTo('up')]);
  });
}

function stageStand(scene: Phaser.Scene) {
  const a = new TileCard(scene, 0, 'spellTrap', 1, 'mirror_barrier', false, 'up');
  const b = new TileCard(scene, 1, 'spellTrap', 1, 'chains_of_light', false, 'up');
  loop(async () => {
    await wait(scene, 500);
    await a.standUp();
    a.setHighlight(PAL.mag3);
    await a.pulse(PAL.mag3);
    await wait(scene, 500);
    a.setHighlight(null);
    await a.layDown();
    await wait(scene, 300);
    await b.standUp(460, { reveal: false, scale: 0.5 });
    await b.flipUp();
    await wait(scene, 500);
    await b.dissolve();
    await wait(scene, 400);
    a.sync('mirror_barrier', false, 'up');
    b.sync('chains_of_light', false, 'up');
  });
}

function stageSheen(scene: Phaser.Scene) {
  const cards: TileCard[] = [];
  for (const p of [0, 1] as PlayerId[])
    for (let i = 0; i < 3; i++) {
      const t = new TileCard(scene, p, 'spellTrap', i, null, false, 'up').setSheen(true);
      cards.push(t);
      cards.push(new TileCard(scene, p, 'monster', i, null, false, i === 1 ? 'up' : 'side').setSheen(true));
    }
  loop(async () => {
    await wait(scene, 300);
    for (const c of cards) {
      c.playSheen();
      await wait(scene, 90);
    }
    await wait(scene, 800);
  });
}

function stageFlip(scene: Phaser.Scene) {
  const ids: CardId[] = ['crystal_wyrm', 'healing_spring', 'chains_of_light'];
  const cards = ids.map((id, i) => new CardSprite(scene, 200 + i * 60, 280, id, { faceUp: false }).setDepth(DEPTH.HAND));
  const big = new CardSprite(scene, 440, 270, 'abyss_magus', { faceUp: false }).setScale(2).setDepth(DEPTH.HAND);
  loop(async () => {
    await wait(scene, 400);
    for (const c of cards) {
      void c.flip(true);
      await wait(scene, 120);
    }
    await big.flip(true, 320);
    await wait(scene, 900);
    for (const c of [...cards, big]) void c.flip(false, 200);
    await wait(scene, 500);
  });
}

function stageHover(scene: Phaser.Scene) {
  const cards = HAND.map((id, i) =>
    new CardSprite(scene, 224 + i * 48, 312, id).setRotation((i - 2) * 0.06).setDepth(DEPTH.HAND + i).setPlayerTint(0),
  );
  cards[1].setHighlight(PLAYER_COLOR[0]);
  cards[3].setHighlight(PAL.gold3);
  loop(async () => {
    for (const c of cards) {
      await c.hoverLift(true);
      await wait(scene, 260);
      await c.hoverLift(false);
    }
  });
}

function stageFly(scene: Phaser.Scene) {
  const c = new CardSprite(scene, 260, 320, 'judgment_bolt').setDepth(DEPTH.HAND).setPlayerTint(0);
  const d = new CardSprite(scene, 380, 320, null).setDepth(DEPTH.HAND).setPlayerTint(1);
  loop(async () => {
    await wait(scene, 300);
    c.setTrail(true);
    await c.flyTo(320, 150, { ms: 480, arc: 60, scale: 2 });
    c.setTrail(false);
    await c.pulse(PAL.teal3);
    await wait(scene, 400);
    await c.dissolve(650);
    await wait(scene, 300);
    c.setVisible(true).setPosition(260, 320).setScale(1).setRotation(0);
    d.setTrail(true);
    await d.flyTo(560, 280, { ms: 420, arc: 40, rotation: 0.3, spin: 1 });
    d.setTrail(false);
    await wait(scene, 300);
    await d.flyTo(380, 320, { ms: 360, arc: 30 });
  });
}

function stageDissolve(scene: Phaser.Scene) {
  loop(async () => {
    const c = new CardSprite(scene, 240, 270, 'magma_titan').setDepth(DEPTH.HAND);
    const d = new CardSprite(scene, 330, 270, 'volcano_arena').setScale(2).setDepth(DEPTH.HAND);
    const t = new TileCard(scene, 0, 'spellTrap', 2, 'dragon_blade', true, 'up');
    await wait(scene, 400);
    void c.dissolve();
    void t.dissolve();
    await d.dissolve(800);
    await wait(scene, 500);
    c.destroy();
    d.destroy();
    t.destroy();
  });
}

function stageHighlight(scene: Phaser.Scene) {
  new TileCard(scene, 0, 'monster', 0, 'ember_wolf', true, 'up').setHighlight(PLAYER_COLOR[0]);
  new TileCard(scene, 1, 'monster', 2, 'tide_golem', true, 'side').setHighlight(PLAYER_COLOR[1]);
  new TileCard(scene, 1, 'spellTrap', 1, null, false, 'up').setHighlight(PAL.mag3);
  new CardSprite(scene, 300, 300, 'storm_hawk').setHighlight(PAL.gold3).setDepth(DEPTH.HAND);
  new CardSprite(scene, 360, 300, 'soul_recall').setHighlight(PLAYER_COLOR[0]).setDepth(DEPTH.HAND);
}

function stageTableau(scene: Phaser.Scene) {
  const t = (p: PlayerId, spot: 'monster' | 'spellTrap' | 'field', i: number, id: CardId | null, up: boolean, o: 'up' | 'side' = 'up') =>
    new TileCard(scene, p, spot, i, id, up, o);
  t(0, 'monster', 0, 'ember_wolf', true);
  t(0, 'monster', 1, 'crystal_wyrm', true);
  t(0, 'monster', 2, null, false, 'side').setSheen(true);
  t(0, 'spellTrap', 0, null, false).setSheen(true);
  t(0, 'spellTrap', 1, 'dragon_blade', true);
  t(0, 'field', 0, 'volcano_arena', true);
  t(1, 'monster', 0, 'tide_golem', true, 'side');
  t(1, 'monster', 1, 'abyss_magus', true);
  t(1, 'spellTrap', 1, null, false).setSheen(true);
  t(1, 'spellTrap', 2, null, false).setSheen(true);
  HAND.forEach((id, i) =>
    new CardSprite(scene, 236 + i * 42, 322, id).setRotation((i - 2) * 0.05).setDepth(DEPTH.HAND + i).setPlayerTint(0),
  );
}

const STAGES: Record<string, (scene: Phaser.Scene) => void> = {
  tableau: stageTableau,
  slam: stageSlam,
  flipup: stageFlipUp,
  rotate: stageRotate,
  stand: stageStand,
  sheen: stageSheen,
  flip: stageFlip,
  hover: stageHover,
  fly: stageFly,
  dissolve: stageDissolve,
  highlight: stageHighlight,
};

const preview: DevPreview = {
  name: 'cardfx',
  description: 'card animations: &fx=all|flip|hover|fly|slam|flipup|rotate|sheen|stand|dissolve|highlight|tableau (&arena=1, &sync=1)',
  async create(scene, params) {
    const fx = params.get('fx') ?? 'all';
    installVirtualClock();
    scene.cameras.main.setBackgroundColor(PAL.night0);
    // &arena=1: stage the cards on the real arena (BoardView) when it is available.
    let arena = false;
    if (params.get('arena') === '1') {
      try {
        const mod = (await import('../../view/BoardView')) as unknown as { BoardView: new (s: Phaser.Scene) => unknown };
        new mod.BoardView(scene);
        arena = true;
      } catch (err) {
        console.warn('[cardfx] BoardView unavailable', err);
      }
    }
    if (!arena) board(scene);
    label(scene, 4, 4, `cardfx: ${fx}`);
    if (fx === 'all') {
      stageRotate(scene);
      stageFlipUp(scene);
      stageHover(scene);
      return;
    }
    const st = STAGES[fx];
    if (!st) throw new Error(`unknown fx ${fx}`);
    // &sync=1: start when the film tool freezes the loop, so film t=0 = stage start.
    if (params.get('sync') === '1') {
      const neon = window.__neon;
      const freeze = neon.freeze;
      let started = false;
      neon.freeze = () => {
        freeze();
        if (!started) {
          started = true;
          st(scene);
        }
      };
    } else st(scene);
    void zoneXY;
  },
};

export default preview;
