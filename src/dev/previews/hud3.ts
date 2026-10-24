// ?dev=hud3 — the v3 HUD (docs/v3/A6_PLAN.md F10, lane A6-B B0) over the calm arena. Open with
// &look=v3 (without it the page shows today's HUD, for the old | new comparison).
//   &state=still (default)  the idle layout: hint line, counts, SAVAŞ / TURU BİTİR, toolbar
//          states          every Button state per style (normal / hover / pressed / disabled /
//                          attention) + panels at LP ≤ 1000 and 0 + a flashed hint (a static sheet)
//          lp              LP loss / gain on both panels, looping (trim flash, roll, bar)
//          turn            the turn passes: setActive + setTurn + phase cycle, looping
//          hint            hint line: set → change → flash ("why not") → clear, looping
//          buttons         a button hovered, pressed, released, disabled-clicked, attention on
//          duel            F0 (B-open): the HUD arrives (once) and the "DÜELLO!" plate drops in, holds,
//                          leaves (looping); &wake=1: the HUD's skipIntro wake instead of the slide
//   &active=1|2      active player (default 1)
//   &loop=0          run once
//   &sync=1          film t = 0 = demo start (tools/shot.mjs --film)
//   &noboard=1       plain background instead of the arena
//   &nohand=1        no hand
//
//   node tools/shot.mjs "?dev=hud3&look=v3" --scale 3 --out shots/…/hud3-still-x3.png
//   node tools/shot.mjs "?dev=hud3&look=v3&state=lp&sync=1" --film 24 --every 50 --cols 6 --clip 480,0,160,80 --scale 3

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { BoardView } from '../../view/BoardView';
import { Button } from '../../view/Button';
import { HandView, type HandCard } from '../../view/HandView';
import { HudView } from '../../view/HudView';
import { DEPTH } from '../../view/layout';
import { ICON, type UiStyle } from '../../view/ui-textures';
import { HudV3 } from '../../view/v3/hudV3';
import { DuelPlate } from '../../view/v3/TurnPlate';
import { wait } from '../../vfx/core';
import type { DevPreview } from '../types';
import { installVirtualClock } from './cardfx';

const HAND0: HandCard[] = [
  { uid: 1, cardId: 'crystal_wyrm' },
  { uid: 2, cardId: 'judgment_bolt' },
  { uid: 3, cardId: 'mirror_barrier' },
  { uid: 4, cardId: 'ember_wolf' },
];
const HAND1: HandCard[] = [
  { uid: 11, cardId: 'coral_serpent' },
  { uid: 12, cardId: 'healing_spring' },
  { uid: 13, cardId: 'shade_assassin' },
];

interface Ctx {
  scene: Phaser.Scene;
  hud: HudView;
  active: PlayerId;
  loop: boolean;
  /** state=duel: the skipIntro wake instead of the slide (&wake=1). */
  wake: boolean;
}

/** Drive a Button's private state like the pointer would (dev page only). */
interface ButtonDrive {
  setHover(on: boolean): void;
  setPressed(on: boolean): void;
}
const drive = (b: Button): ButtonDrive => b as unknown as ButtonDrive;

async function repeat(c: Ctx, fn: () => Promise<void>): Promise<void> {
  do await fn();
  while (c.loop);
}

const STATES: Record<string, (c: Ctx) => Promise<void>> = {
  async still() {},
  async states(c) {
    const sc = c.scene;
    // a dark sheet over the middle of the board: one row per style, one column per state
    const styles: [UiStyle, string, string | undefined][] = [
      ['fire', 'SAVAŞ', ICON.swords],
      ['spell', 'TURU BİTİR', ICON.endTurn],
      ['neutral', 'GEÇ', undefined],
      ['trap', 'AÇ', ICON.trap],
      ['gold', 'EVET', ICON.check],
      ['p1', 'TAMAM', undefined],
    ];
    const cols = ['normal', 'hover', 'pressed', 'disabled', 'attention'];
    const x0 = 120;
    const y0 = 86;
    const w = 76;
    const h = 22;
    const bg = sc.add.graphics().setDepth(DEPTH.HUD - 1);
    bg.fillStyle(PAL.night0, 1).fillRect(x0 - 6, y0 - 6, cols.length * (w + 6) + 6, styles.length * (h + 4) + 8);
    styles.forEach(([style, label, icon], r) => {
      cols.forEach((col, k) => {
        const b = new Button(sc, x0 + k * (w + 6), y0 + r * (h + 4), { w, h, label, icon, style, size: 'md', depth: DEPTH.HUD, sound: false });
        if (col === 'hover') drive(b).setHover(true);
        if (col === 'pressed') {
          drive(b).setHover(true);
          drive(b).setPressed(true);
        }
        if (col === 'disabled') b.setEnabled(false);
        if (col === 'attention') b.setAttention(true);
      });
    });
    // panels: P1 low LP, P2 at 0; a flashed hint
    void c.hud.setLp(0, 900, false);
    void c.hud.setLp(1, 0, false);
    c.hud.setCounts(0, { deck: 2, hand: 4, grave: 7 }, false);
    c.hud.flashHint('Bu tur zaten bir canavar çağırdın (turda 1 hak)', { ms: 1e9 });
  },
  async lp(c) {
    await repeat(c, async () => {
      await wait(c.scene, 300);
      await c.hud.setLp(1, 2800, true, { maxMs: 400 });
      await wait(c.scene, 300);
      await c.hud.setLp(0, 2500, true, { maxMs: 400 });
      await wait(c.scene, 300);
      await c.hud.setLp(0, 3300, true, { maxMs: 400 });
      await wait(c.scene, 300);
      c.hud.shake(1, 5, 420);
      await c.hud.setLp(1, 800, true, { maxMs: 400 });
      await wait(c.scene, 900);
      await c.hud.setLp(0, 4000, false);
      await c.hud.setLp(1, 4000, false);
    });
  },
  async turn(c) {
    let turn = 3;
    let p: PlayerId = c.active;
    await repeat(c, async () => {
      await wait(c.scene, 300);
      await c.hud.setPhase('battle', p);
      await wait(c.scene, 400);
      await c.hud.setPhase('end', p);
      await wait(c.scene, 300);
      p = p === 0 ? 1 : 0;
      c.hud.setActive(p);
      c.hud.setTurn(++turn);
      await c.hud.setPhase('draw', p);
      await wait(c.scene, 200);
      await c.hud.setPhase('main', p);
      await wait(c.scene, 600);
    });
  },
  async hint(c) {
    await repeat(c, async () => {
      c.hud.setHint("Bir kart seç ya da SAVAŞ'a geç", { player: c.active });
      await wait(c.scene, 900);
      c.hud.setHint('Ne yapacağını seç · Esc: vazgeç', { player: c.active });
      await wait(c.scene, 700);
      c.hud.flashHint('Bu tur zaten bir canavar çağırdın (turda 1 hak)', { ms: 900 });
      await wait(c.scene, 1200);
      c.hud.setHint(null);
      await wait(c.scene, 500);
    });
  },
  async duel(c) {
    const h = c.hud as unknown;
    if (h instanceof HudV3) {
      if (!c.wake) h.setVisible(false);
      h.arrive(c.wake ? 'wake' : 'slide');
    }
    await repeat(c, async () => {
      const plate = DuelPlate.show(c.scene);
      await plate.entered;
      await wait(c.scene, 900);
      await plate.leave();
      await wait(c.scene, 400);
    });
  },
  async buttons(c) {
    const b = c.hud.battleButton;
    const e = c.hud.endTurnButton;
    await repeat(c, async () => {
      await wait(c.scene, 300);
      drive(b).setHover(true);
      await wait(c.scene, 300);
      drive(b).setPressed(true);
      await wait(c.scene, 120);
      drive(b).setPressed(false);
      await wait(c.scene, 300);
      drive(b).setHover(false);
      c.hud.setButtons({ battle: false, endTurn: true, attention: 'endTurn' });
      await wait(c.scene, 1600);
      c.hud.setButtons({ battle: true, attention: null });
      e.setAttention(false);
      await wait(c.scene, 500);
    });
  },
};

const preview: DevPreview = {
  name: 'hud3',
  description: 'v3 HUD (A6-B F10, F0; add &look=v3): &state=still|states|lp|turn|hint|buttons|duel &active=1|2 &loop=0 &sync=1 &noboard=1 &nohand=1 &wake=1',
  async create(scene, params) {
    installVirtualClock();
    const state = params.get('state') ?? 'still';
    const active: PlayerId = params.get('active') === '2' ? 1 : 0;
    if (params.get('noboard') !== '1') new BoardView(scene, { active });
    const hud = new HudView(scene, { active, turn: 3, phase: 'main' });
    hud.setCounts(0, { deck: 14, hand: 4, grave: 2 }, false);
    hud.setCounts(1, { deck: 13, hand: 3, grave: 1 }, false);
    hud.setButtons({ battle: true, endTurn: true });
    if (state !== 'hint' && state !== 'states' && state !== 'duel') hud.setHint("Bir kart seç ya da SAVAŞ'a geç", { player: active });
    if (params.get('nohand') !== '1') {
      const hand = new HandView(scene, { owner: active });
      hand.setCards(active === 0 ? HAND0 : HAND1, active);
      hand.setCards(active === 0 ? HAND1 : HAND0, active === 0 ? 1 : 0);
    }
    const ctx: Ctx = { scene, hud, active, loop: params.get('loop') !== '0', wake: params.get('wake') === '1' };
    Object.assign(window.__neon as Record<string, unknown>, { hud });
    const runState = STATES[state];
    if (!runState) throw new Error(`unknown state ${state}`);
    const start = () => void runState(ctx);
    if (params.get('sync') === '1') {
      const neon = window.__neon;
      const freeze = neon.freeze;
      let started = false;
      neon.freeze = () => {
        freeze();
        if (!started) {
          started = true;
          start();
        }
      };
    } else start();
  },
};
export default preview;
