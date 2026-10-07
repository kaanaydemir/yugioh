// ?dev=board — the arena stage with its ambient animation.
//   &labels=1   label every zone with player/spot/index (+ the hit-test under the pointer)
//   &theme=volcano   start in the volcano theme (&from=0|1 cracks from that player's field zone)
//   &active=1|2      player 1 / player 2 is the active player (trim emphasis + light runner)
//   &hl=1            highlight examples
//   &morph=1         play the normal → volcano transformation after 400 ms (&back=1 then returns)
//   &pulse=0|1       play pulseSide(player) after 300 ms
//   &flash=1         flashTile examples
//   &lights=intro    floodlights off, then the intro ignition
//   &ui=1            outline the HUD regions (hand, panels, inspect, buttons) to check composition
import Phaser from 'phaser';
import { cellZone } from '../../art/arena';
import { PAL } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { BOARD_COLS, BOARD_ROWS, DEPTH, UI, type Rect, isoToScreen } from '../../view/layout';
import { BoardView } from '../../view/BoardView';
import type { DevPreview } from '../types';

const SHORT: Record<string, string> = { monster: 'M', spellTrap: 'ST', field: 'FLD', graveyard: 'GY', deck: 'DK', banish: 'BAN' };

const preview: DevPreview = {
  name: 'board',
  description: 'arena stage: &labels=1 &theme=volcano&from=0|1 &active=1|2 &hl=1 &morph=1&back=1 &pulse=0|1 &flash=1 &lights=intro &ui=1',
  async create(scene, params) {
    const from = params.has('from') ? (Number(params.get('from')) as PlayerId) : null;
    // &active=1 → player 1 (id 0) is active, &active=2 → player 2 (id 1)
    const activeParam = params.get('active');
    const active: PlayerId | null = activeParam === '1' ? 0 : activeParam === '2' ? 1 : null;
    const board = new BoardView(scene, {
      theme: params.get('theme') === 'volcano' ? 'volcano' : 'normal',
      active,
      lights: params.get('lights') !== 'intro',
      volcanoFrom: from,
    });
    (window.__neon as Record<string, unknown>).board = board;

    if (params.get('labels') === '1') {
      for (let row = 0; row < BOARD_ROWS; row++)
        for (let col = 0; col < BOARD_COLS; col++) {
          const z = cellZone(col, row);
          const s = isoToScreen(col, row);
          const txt = z ? `P${z.player + 1} ${SHORT[z.spot]}${z.spot === 'monster' || z.spot === 'spellTrap' ? z.index : ''}` : `${col},${row}`;
          scene.add
            .text(s.x, s.y, txt, {
              fontFamily: 'monospace',
              fontSize: '8px',
              color: z ? (z.player === 0 ? '#b6fbff' : '#ffb6bb') : '#a3b1da',
              backgroundColor: '#07070fd0',
              padding: { x: 1, y: 0 },
            })
            .setOrigin(0.5)
            .setResolution(4)
            .setDepth(DEPTH.DEBUG);
        }
      const hover = scene.add.text(4, 348, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff4b5' }).setResolution(4).setDepth(DEPTH.DEBUG);
      scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        const z = board.zoneAt(p.worldX, p.worldY);
        hover.setText(z ? `zoneAt → P${z.player + 1} ${z.spot} ${z.index}` : 'zoneAt → null');
        board.clearHighlights();
        if (z) board.highlightZone(z.player, z.spot, z.index, PAL.gold3);
      });
    }

    if (params.get('ui') === '1') {
      const g = scene.add.graphics().setDepth(DEPTH.DEBUG);
      const rects: Rect[] = [UI.phaseBar, UI.p1Panel, UI.p2Panel, UI.hand, UI.inspect, UI.buttons];
      for (const r of rects) {
        g.fillStyle(PAL.ink, 0.55).fillRect(r.x, r.y, r.w, r.h);
        g.lineStyle(1, PAL.gold3, 0.9).strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      }
    }

    if (params.get('hl') === '1') {
      board.highlightZone(0, 'monster', 0, PAL.cyan3);
      board.highlightZone(0, 'monster', 2, PAL.cyan3);
      board.highlightZone(1, 'monster', 1, PAL.crim3);
      board.highlightZone(0, 'spellTrap', 1, PAL.mag3);
      board.highlightZone(1, 'graveyard', 0, PAL.teal3);
      board.highlightZone(0, 'field', 0, PAL.gold3);
    }

    if (params.get('lights') === 'intro') scene.time.delayedCall(300, () => void board.setLights(true, true));
    if (params.has('pulse')) {
      const pl = Number(params.get('pulse')) as PlayerId;
      scene.time.delayedCall(300, () => void board.pulseSide(pl));
    }
    if (params.get('flash') === '1') {
      scene.time.delayedCall(200, () => void board.flashTile(0, 'monster', 1, PAL.white, 400));
      scene.time.delayedCall(500, () => void board.flashTile(1, 'spellTrap', 2, PAL.mag3, 400));
    }
    if (params.get('morph') === '1') {
      scene.time.delayedCall(400, async () => {
        await board.setTheme('volcano', true, from);
        if (params.get('back') === '1') {
          scene.time.delayedCall(800, () => void board.setTheme('normal', true));
        }
      });
    }
  },
};

export default preview;
