// ?dev=hud — HUD, hand, inspect panel, action menu, prompts and log in a mock duel layout.
//   &state=duel (default)  LP 4000 → 2800 roll, phase marker cycling, hovered card + inspect
//          menu            action menu open above a hand card
//          trap            trap response prompt (2 choices)
//          pass            pass-device curtain (click / Enter to continue; loops)
//          gameover        victory screen with fireworks
//          confirm | instruction | log | swap | draw | inspect | heal | hover | icons
//   &active=1|2      active player (default 1)
//   &loop=0          run the demo once
//   &sync=1          film t=0 = demo start (tools/shot.mjs --film)
//   &auto=1          pass: continue automatically after 2.6 s (films of the exit wipe)
//   &noboard=1       plain background instead of the arena
import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import { PAL } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { ActionMenu } from '../../view/ActionMenu';
import { BoardView } from '../../view/BoardView';
import { HandView, type HandCard } from '../../view/HandView';
import { HudView } from '../../view/HudView';
import { InspectPanel } from '../../view/InspectPanel';
import { DEPTH, zoneXY } from '../../view/layout';
import { LogView } from '../../view/LogView';
import { Prompt } from '../../view/Prompt';
import { ICON } from '../../view/ui-textures';
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
  { uid: 14, cardId: 'chains_of_light' },
  { uid: 15, cardId: 'volcano_arena' },
];
const CARD_OF = new Map<number, CardId>([...HAND0, ...HAND1].map((c) => [c.uid, c.cardId]));

function icons(scene: Phaser.Scene): void {
  Object.values(ICON).forEach((k, i) => {
    const x = 8 + (i % 8) * 24;
    const y = 8 + Math.floor(i / 8) * 24;
    scene.add.image(x, y, k).setOrigin(0).setDepth(DEPTH.DEBUG);
    scene.add.image(x + 200, y, k).setOrigin(0).setDepth(DEPTH.DEBUG).setTint(PAL.cyan3);
  });
}

interface Ctx {
  scene: Phaser.Scene;
  hud: HudView;
  hand: HandView;
  inspect: InspectPanel;
  menu: ActionMenu;
  prompt: Prompt;
  log: LogView;
  active: PlayerId;
  loop: boolean;
  auto: boolean;
}

async function repeat(ctx: Ctx, fn: () => Promise<void>): Promise<void> {
  do await fn();
  while (ctx.loop);
}

const STATES: Record<string, (c: Ctx) => Promise<void>> = {
  async duel(c) {
    c.hand.setHover(1);
    await repeat(c, async () => {
      await wait(c.scene, 400);
      await c.hud.setLp(1, 2800);
      c.log.add('Kristal Ejder doğrudan saldırdı: 1200 hasar', 0);
      await wait(c.scene, 300);
      await c.hud.setPhase('battle', c.active);
      await wait(c.scene, 600);
      await c.hud.setPhase('end', c.active);
      await wait(c.scene, 400);
      await c.hud.setPhase('draw', c.active);
      c.hud.setTurn(4);
      await c.hud.setPhase('main', c.active);
      await wait(c.scene, 400);
      await c.hud.setLp(1, 4000, false);
      c.hud.setTurn(3, false);
    });
  },
  async hover(c) {
    await repeat(c, async () => {
      for (const uid of [1, 2, 3, 4, 3, 2]) {
        c.hand.setHover(uid);
        await wait(c.scene, 420);
      }
      c.hand.setHover(null);
      await wait(c.scene, 500);
    });
  },
  async heal(c) {
    await repeat(c, async () => {
      await wait(c.scene, 300);
      await c.hud.setLp(0, 900);
      await wait(c.scene, 500);
      await c.hud.setLp(0, 1900);
      await wait(c.scene, 600);
      await c.hud.setLp(0, 4000, false);
    });
  },
  async menu(c) {
    c.hand.setSelected(4);
    c.inspect.show('ember_wolf');
    await repeat(c, async () => {
      const xy = c.hand.cardXY(4)!;
      const id = await c.menu.open(xy.x, xy.y - 46, [
        { id: 'summon', label: 'Çağır' },
        { id: 'set', label: 'Kapalı Koy' },
        { id: 'activate', label: 'Aktive Et', enabled: false },
      ], { style: c.active === 0 ? 'p1' : 'p2', title: 'Kor Kurdu' });
      c.log.add(`Menü: ${id ?? 'iptal'}`, c.active);
      await wait(c.scene, 300);
    });
  },
  async trap(c) {
    await repeat(c, async () => {
      const uid = await c.prompt.trapResponse(1, [
        { uid: 14, cardId: 'chains_of_light' },
        { uid: 16, cardId: 'mirror_barrier' },
      ]);
      c.log.add(uid === null ? 'Oyuncu 2 geçti' : `Tuzak açıldı (#${uid})`, 1);
      await wait(c.scene, 400);
    });
  },
  async pass(c) {
    await repeat(c, async () => {
      const next: PlayerId = c.hand.owner === 0 ? 1 : 0;
      // &auto=1: "click" after 2.6 s of scene time (deterministic films of the exit wipe)
      if (c.auto) void wait(c.scene, 2600).then(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
      await c.prompt.passDevice(next, async () => {
        await c.hand.setOwner(next, true);
        c.hud.setActive(next, false);
      });
      await c.hand.setFaceDown(false);
      await wait(c.scene, 600);
    });
  },
  async gameover(c) {
    await repeat(c, async () => {
      await c.prompt.gameOver(0, 'lp');
      await wait(c.scene, 300);
    });
  },
  async confirm(c) {
    await repeat(c, async () => {
      const ok = await c.prompt.confirm('Teslim olmak istediğine emin misin?');
      c.log.add(ok ? 'Evet' : 'Hayır');
      await wait(c.scene, 300);
    });
  },
  async instruction(c) {
    await repeat(c, async () => {
      const ins = c.prompt.instruction('Hedef seç: rakibin bir canavarı');
      await Promise.race([ins.cancelled, wait(c.scene, 2600)]);
      ins.close();
      await wait(c.scene, 500);
    });
  },
  async log(c) {
    c.log.setOpen(true);
    const lines: [string, PlayerId | number][] = [
      ['Düello başladı! İlk oyuncu: Oyuncu 1', PAL.gold3],
      ['Oyuncu 1 Kor Kurdu çağırdı', 0],
      ['Oyuncu 2 bir kart kapalı koydu', 1],
      ['Kor Kurdu saldırdı → kapalı kart', 0],
      ['Dikenli Pusucu çevrildi! ÇEVİR etkisi', 1],
      ['Kor Kurdu yok edildi', PAL.crim3],
      ['Oyuncu 2 Volkan Arenası aktive etti', 1],
      ['Tüm ATEŞ canavarlar +500 ATK', PAL.fire3],
    ];
    await repeat(c, async () => {
      c.log.clear();
      for (const [t, col] of lines) {
        c.log.add(t, col);
        await wait(c.scene, 260);
      }
      await wait(c.scene, 800);
    });
  },
  async swap(c) {
    await repeat(c, async () => {
      await wait(c.scene, 300);
      const next: PlayerId = c.hand.owner === 0 ? 1 : 0;
      c.hud.setActive(next);
      await c.hand.setOwner(next, false);
      await wait(c.scene, 700);
    });
  },
  async draw(c) {
    let uid = 100;
    const pool: CardId[] = ['storm_hawk', 'soul_recall', 'chasm_trap', 'magma_titan'];
    await repeat(c, async () => {
      c.hand.setCards(HAND0, 0);
      c.hand.setCards(HAND1.slice(0, 3), 1);
      await wait(c.scene, 300);
      await c.hand.addCard(++uid, pool[uid % pool.length], zoneXY(0, 'deck'));
      await wait(c.scene, 200);
      await c.hand.addCard(++uid, pool[uid % pool.length], zoneXY(0, 'deck'));
      await wait(c.scene, 200);
      await c.hand.addCard(++uid, 'judgment_bolt', zoneXY(1, 'deck'), 1);
      await wait(c.scene, 300);
      const s = c.hand.takeCard(uid - 1);
      if (s) {
        await s.flyTo(320, 160, { ms: 360, arc: 30, scale: 1 });
        await s.dissolve(500);
        s.destroy();
      }
      await c.hand.removeCard(4);
      await wait(c.scene, 600);
    });
  },
  async inspect(c) {
    const ids: CardId[] = ['crystal_wyrm', 'coral_serpent', 'dragon_blade', 'chasm_trap', 'volt_lizard'];
    await repeat(c, async () => {
      for (const id of ids) {
        c.inspect.show(id, id === 'volt_lizard' ? { atk: 2000, def: 900 } : {});
        await wait(c.scene, 900);
      }
      c.inspect.show(null);
      await wait(c.scene, 700);
      c.inspect.hide();
      await wait(c.scene, 600);
    });
  },
};

const preview: DevPreview = {
  name: 'hud',
  description: 'HUD/hand/inspect/menu/prompts: &state=duel|menu|trap|pass|gameover|confirm|instruction|log|swap|draw|inspect|heal|hover|icons &active=1|2 &loop=0 &sync=1',
  async create(scene, params) {
    installVirtualClock();
    const state = params.get('state') ?? 'duel';
    if (state === 'icons') {
      icons(scene);
      return;
    }
    const active: PlayerId = params.get('active') === '2' ? 1 : 0;
    if (params.get('noboard') !== '1') new BoardView(scene, { active });
    const hud = new HudView(scene, { active, turn: 3, phase: 'main' });
    hud.setCounts(0, { deck: 14, hand: 4, grave: 2 }, false);
    hud.setCounts(1, { deck: 13, hand: 5, grave: 1 }, false);
    hud.setButtons({ battle: true, endTurn: true });
    const hand = new HandView(scene, { owner: active });
    hand.setCards(active === 0 ? HAND0 : HAND1, active);
    hand.setCards(active === 0 ? HAND1 : HAND0, active === 0 ? 1 : 0);
    hand.setPlayable(active === 0 ? [1, 2, 4] : [11, 12]);
    const inspect = new InspectPanel(scene);
    hand.onHover = (uid) => (uid === null ? inspect.hide() : inspect.show(CARD_OF.get(uid) ?? null));
    const menu = new ActionMenu(scene);
    const prompt = new Prompt(scene);
    const log = new LogView(scene);
    hud.onLog = () => log.toggle();
    hud.onEndTurn = () => log.add('Tur bitti', active);
    hud.onBattle = () => log.add('Savaş aşaması!', PAL.fire3);
    const ctx: Ctx = { scene, hud, hand, inspect, menu, prompt, log, active, loop: params.get('loop') !== '0', auto: params.get('auto') === '1' };
    Object.assign(window.__neon as Record<string, unknown>, { hud, hand, inspect, menu, prompt, log });
    const run = STATES[state];
    if (!run) throw new Error(`unknown state ${state}`);
    const start = () => void run(ctx);
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
