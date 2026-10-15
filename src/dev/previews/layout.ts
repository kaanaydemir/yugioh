// ?dev=layout — the board geometry and HUD regions of the active arena variant (layout.ts),
// drawn schematically so spacing and screen fit can be judged. Add &arena=v2 for the demo arena.
//   every grid cell: zone pads (P1 cyan / P2 crimson), v2 gap tiles (dim), bridge rows (teal)
//   real monster sprites on all six monster zones (P2 flipped), duelists, piles, set cards,
//   HUD rects outlined + a mock resting hand.
//   &p1=a,b,c &p2=d,e,f   monster ids per zone index (default: the biggest ones side by side)
//   &anim=idle|roar|attack|hit|guard   animation every monster plays (default idle)
//   &labels=0   hide zone labels      &hud=0   hide HUD rects + mock hand
//   &grid=0     hide the schematic grid (e.g. with &board=1)
//   &board=1    the real BoardView behind (the arena art of the active variant)
//   &rects=0    keep the mock hand but hide the HUD rect outlines
//   &corner=1   v2: apply the deck-corner contract (layout pileTagAnchor / deckPylonXY) to the real
//               art — the preview's piles get their count tag beside the stack and the board's two
//               deck-corner pylons slide along the trim — i.e. the look once PileView / geom.ts adopt it
//   &info=1     print geometry numbers on screen (they always go to the console)
// With the HUD overlay on, the v2 contract spots are outlined too (tags gold, deck pylons mist).
import Phaser from 'phaser';
import { CARD_BACK, ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey } from '../../art/cards';
import { DUELIST_ANCHOR, DUELIST_H, DUELIST_W, duelistAnimKey, duelistTextureKey } from '../../art/duelists';
import { monsterArt } from '../../art/monsters';
import { PAL } from '../../art/palette';
import { monsterAnimKey, monsterTextureKey } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { MONSTER_IDS, type MonsterId } from '../../data/cards';
import { PYLONS } from '../../art/arena-v2/geom';
import { PileView } from '../../duel/PileView';
import type { PlayerId } from '../../engine/types';
import {
  ARENA_V2,
  ARENA_VARIANT,
  BOARD_BOUNDS,
  BOARD_CENTER,
  BOARD_COLS,
  BOARD_OX,
  BOARD_OY,
  BOARD_ROWS,
  BRIDGE_ROWS,
  CARD_H,
  CARD_W,
  DEPTH,
  GAME_H,
  GAME_W,
  PILE_TAG_H,
  TILE_H,
  TILE_W,
  UI,
  type BoardSpot,
  type Rect,
  cellKind,
  deckPylonXY,
  duelistXY,
  isoToScreen,
  pileTagAnchor,
  tagLeft,
  unitDepth,
  zoneAtCell,
  zoneXY,
} from '../../view/layout';
import { BoardView } from '../../view/BoardView';
import type { DevPreview } from '../types';

/** How far the v2 referee pylons stand outside the tile grid (art/arena-v2/geom.ts BORDER − 0.14). */
const PYLON_OUTSET = 0.16;

const SHORT: Record<BoardSpot, string> = { monster: 'M', spellTrap: 'ST', field: 'FLD', graveyard: 'GY', deck: 'DK', banish: 'BAN' };
const DEFAULT_P1: MonsterId[] = ['stone_sentinel', 'crystal_wyrm', 'magma_titan'];
const DEFAULT_P2: MonsterId[] = ['ember_wolf', 'abyss_magus', 'coral_serpent'];

function monsterList(param: string | null, fallback: MonsterId[]): MonsterId[] {
  if (!param) return fallback;
  const ids = param.split(',').map((s) => s.trim()) as MonsterId[];
  return fallback.map((d, i) => (ids[i] && MONSTER_IDS.includes(ids[i]) ? ids[i] : d));
}

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, hw: number, hh: number): void {
  g.beginPath();
  g.moveTo(x, y - hh);
  g.lineTo(x + hw, y);
  g.lineTo(x, y + hh);
  g.lineTo(x - hw, y);
  g.closePath();
}

/** Width of a pile count tag for `n` cards (PileView: 4 px per digit + 5). */
function tagWidth(n: number): number {
  return String(n).length * 4 + 5;
}

/**
 * &corner=1 (v2): what the deck corners look like once PileView and geom.ts adopt the layout
 * contract. Moves the preview's own pile tags to pileTagAnchor and the board's two deck-corner
 * pylons (post, beacon, glow) to deckPylonXY. Dev-only: reaches into PileView's tag objects.
 */
function applyCornerContract(scene: Phaser.Scene, piles: PileView[]): void {
  for (const pile of piles) {
    const pv = pile as unknown as { tag: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.BitmapText };
    const w = tagWidth(pile.count);
    const a = pileTagAnchor(pile.player, pile.kind);
    const x = tagLeft(a, w);
    // PileView draws the tag graphics at (round(home.x − w/2), round(home.y + 8)): shift it
    pv.tag.setPosition(x - Math.round(pile.home.x - w / 2), a.y - Math.round(pile.home.y + 8));
    pv.label.setPosition(x + Math.floor(w / 2), a.y + 5);
  }
  let moved = 0;
  for (const p of [0, 1] as PlayerId[]) {
    const deck = zoneXY(p, 'deck');
    const old = PYLONS.reduce((b, q) => (Math.hypot(q.x - deck.x, q.y - deck.y) < Math.hypot(b.x - deck.x, b.y - deck.y) ? q : b));
    const to = deckPylonXY(p, PYLON_OUTSET);
    // board-v2/stadium.ts: post at (x − 5, y − 22), beacon at (x − 2, y − 21), glow at (x, y − 17)
    const spots: [string, number, number][] = [
      ['arena2:pylon', old.x - 5, old.y - 22],
      ['arena2:beacon', old.x - 2, old.y - 21],
      ['arena:glow', old.x, old.y - 17],
    ];
    for (const o of scene.children.list) {
      if (!(o instanceof Phaser.GameObjects.Image)) continue;
      if (!spots.some(([k, x, y]) => o.texture.key === k && o.x === x && o.y === y)) continue;
      o.setPosition(o.x + to.x - old.x, o.y + to.y - old.y);
      moved++;
    }
  }
  console.log(`[layout] corner contract: ${piles.length} pile tags, ${moved}/6 pylon parts moved`);
}

function label(scene: Phaser.Scene, x: number, y: number, s: string, color: string, bg = '#07070fc0'): Phaser.GameObjects.Text {
  return scene.add
    .text(Math.round(x), Math.round(y), s, { fontFamily: 'monospace', fontSize: '8px', color, backgroundColor: bg, padding: { x: 1, y: 0 } })
    .setResolution(4)
    .setDepth(DEPTH.DEBUG);
}

const preview: DevPreview = {
  name: 'layout',
  description: 'board geometry + HUD regions of the arena variant (&arena=v2): &p1=&p2= ids, &anim=, &labels=0 &hud=0 &grid=0 &board=1 &info=1',
  async create(scene, params) {
    scene.cameras.main.setBackgroundColor(PAL.night0);
    const showGrid = params.get('grid') !== '0';
    const showLabels = params.get('labels') !== '0';
    const showHud = params.get('hud') !== '0';
    const showRects = showHud && params.get('rects') !== '0';
    const anim = (params.get('anim') ?? 'idle') as MonsterAnim;

    if (params.get('board') === '1') {
      const board = new BoardView(scene, { active: 0 });
      (window.__neon as Record<string, unknown>).board = board;
    }

    // ------------------------------------------------------------ grid
    if (showGrid) {
      const g = scene.add.graphics().setDepth(DEPTH.TILE);
      const hw = TILE_W / 2;
      const hh = TILE_H / 2;
      for (let row = 0; row < BOARD_ROWS; row++)
        for (let col = 0; col < BOARD_COLS; col++) {
          const s = isoToScreen(col, row);
          const kind = cellKind(col, row);
          const z = zoneAtCell(col, row);
          let fill: number = PAL.night1;
          let line: number = PAL.night3;
          if (kind === 'bridge') {
            fill = PAL.teal0;
            line = PAL.teal1;
          } else if (z) {
            fill = z.player === 0 ? PAL.cyan0 : PAL.crim0;
            line = z.player === 0 ? PAL.cyan2 : PAL.crim2;
            if (z.spot !== 'monster' && z.spot !== 'spellTrap') line = z.player === 0 ? PAL.cyan1 : PAL.crim1;
          }
          g.fillStyle(fill, 1);
          diamond(g, s.x, s.y, hw, hh);
          g.fillPath();
          g.lineStyle(1, line, 1);
          diamond(g, s.x, s.y, hw - 1, hh - 0.5);
          g.strokePath();
          if (z && (z.spot === 'monster' || z.spot === 'spellTrap')) {
            // inner pad ring, as a zone pad would have
            g.lineStyle(1, z.player === 0 ? PAL.cyan1 : PAL.crim1, 1);
            diamond(g, s.x, s.y, hw - 9, hh - 4.5);
            g.strokePath();
          }
          // tile center pixel
          g.fillStyle(PAL.white, 0.6).fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        }
      // grid bounds
      const b = BOARD_BOUNDS;
      g.lineStyle(1, PAL.night4, 0.8).strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      // board center
      g.fillStyle(PAL.gold3, 1).fillRect(Math.round(BOARD_CENTER.x) - 1, Math.round(BOARD_CENTER.y), 3, 1).fillRect(Math.round(BOARD_CENTER.x), Math.round(BOARD_CENTER.y) - 1, 1, 3);
    }

    // ------------------------------------------------------------ piles + set cards
    const piles: PileView[] = [];
    for (const p of [0, 1] as PlayerId[]) {
      const deck = new PileView(scene, p, 'deck');
      deck.set(16, null);
      const grave = new PileView(scene, p, 'graveyard');
      grave.set(6, 'judgment_bolt');
      piles.push(deck, grave);
      // a face-down set card on spell/trap 1 and a face-up field spell
      const st = zoneXY(p, 'spellTrap', 1);
      if (scene.textures.exists(cardIsoKey('back', 'up', p)))
        scene.add.image(st.x, st.y, cardIsoKey('back', 'up', p)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setDepth(DEPTH.CARD_ON_TILE);
      const fl = zoneXY(p, 'field');
      if (scene.textures.exists(cardIsoKey('volcano_arena', 'up', p)))
        scene.add.image(fl.x, fl.y, cardIsoKey('volcano_arena', 'up', p)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setDepth(DEPTH.CARD_ON_TILE);
    }

    // ------------------------------------------------------------ monsters
    const lists: Record<PlayerId, MonsterId[]> = { 0: monsterList(params.get('p1'), DEFAULT_P1), 1: monsterList(params.get('p2'), DEFAULT_P2) };
    const shadow = scene.add.graphics().setDepth(DEPTH.SHADOW);
    for (const p of [0, 1] as PlayerId[])
      for (let i = 0; i < 3; i++) {
        const id = lists[p][i];
        const art = monsterArt(id);
        const at = zoneXY(p, 'monster', i);
        const flip = p === 1;
        const rx = Math.round(art.w * 0.3);
        shadow.fillStyle(PAL.ink, 0.45).fillEllipse(at.x, at.y, rx * 2, Math.max(6, Math.round(rx * 0.55)));
        const spr = scene.add.sprite(Math.round(at.x), Math.round(at.y), monsterTextureKey(id));
        spr.setOrigin((flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h).setFlipX(flip);
        spr.setDepth(unitDepth(at.y));
        spr.play({ key: monsterAnimKey(id, anim), repeat: -1, repeatDelay: art.anims[anim].loop ? 0 : 500 });
      }

    // ------------------------------------------------------------ duelists
    for (const p of [0, 1] as PlayerId[]) {
      const q = duelistXY(p);
      const key = duelistTextureKey(p);
      if (!scene.textures.exists(key)) continue;
      const ox = DUELIST_ANCHOR.x / DUELIST_W;
      const spr = scene.add.sprite(Math.round(q.x), Math.round(q.y), key).setOrigin(p === 1 ? 1 - ox : ox, DUELIST_ANCHOR.y / DUELIST_H).setFlipX(p === 1);
      spr.setDepth(unitDepth(q.y));
      const k = duelistAnimKey(p, 'idle');
      if (scene.anims.exists(k)) spr.play({ key: k, repeat: -1 });
      shadow.fillStyle(PAL.ink, 0.45).fillEllipse(q.x, q.y, 18, 6);
      if (showGrid) {
        // podium hint
        const pg = scene.add.graphics().setDepth(DEPTH.TILE);
        pg.lineStyle(1, p === 0 ? PAL.cyan1 : PAL.crim1, 1);
        diamond(pg, Math.round(q.x), Math.round(q.y), 18, 9);
        pg.strokePath();
      }
    }

    // ------------------------------------------------------------ zone labels
    if (showLabels) {
      for (let row = 0; row < BOARD_ROWS; row++)
        for (let col = 0; col < BOARD_COLS; col++) {
          const z = zoneAtCell(col, row);
          if (!z) continue;
          const s = isoToScreen(col, row);
          const txt = `${SHORT[z.spot]}${z.spot === 'monster' || z.spot === 'spellTrap' ? z.index : ''}`;
          const t = label(scene, s.x, s.y + TILE_H / 2 - 9, txt, z.player === 0 ? '#b6fbff' : '#ffb6bb', '#07070f90');
          t.setOrigin(0.5, 0).setX(Math.round(s.x)).setAlpha(0.9);
        }
      for (const r of BRIDGE_ROWS) {
        const s = isoToScreen(BOARD_COLS - 0.5, r);
        label(scene, s.x + 2, s.y - 4, `bridge r${r}`, '#c2ffe7', '#07070f00').setAlpha(0.8);
      }
    }

    // ------------------------------------------------------------ HUD rects + mock hand
    if (showRects) {
      const g = scene.add.graphics().setDepth(DEPTH.HUD);
      const rects: [string, Rect][] = [
        ['phaseBar', UI.phaseBar],
        ['p1Panel', UI.p1Panel],
        ['p2Panel', UI.p2Panel],
        ['hand', UI.hand],
        ['inspect', UI.inspect],
        ['buttons', UI.buttons],
      ];
      for (const [name, r] of rects) {
        g.fillStyle(PAL.ink, name === 'hand' ? 0.25 : 0.6).fillRect(r.x, r.y, r.w, r.h);
        g.lineStyle(1, PAL.gold3, 0.9).strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        label(scene, r.x + 2, r.y + 1, `${name} ${r.w}x${r.h}`, '#fff4b5', '#00000000').setDepth(DEPTH.DEBUG + 1);
      }
      g.lineStyle(1, PAL.gold2, 0.6).lineBetween(0, UI.bannerY + 0.5, GAME_W, UI.bannerY + 0.5);
      label(scene, 2, UI.bannerY - 9, `bannerY ${UI.bannerY}`, '#ffd447', '#00000000');
      // deck-corner contract spots: pile count tags (2 digits) and, in v2, the deck-corner pylons
      for (const pile of piles) {
        const w = tagWidth(10);
        const a = pileTagAnchor(pile.player, pile.kind);
        g.lineStyle(1, PAL.gold2, 0.9).strokeRect(tagLeft(a, w) - 0.5, a.y - 0.5, w + 1, PILE_TAG_H + 1);
      }
      if (ARENA_V2)
        for (const p of [0, 1] as PlayerId[]) {
          const q = deckPylonXY(p, PYLON_OUTSET);
          g.lineStyle(1, PAL.mist, 0.9).strokeRect(q.x - 5 - 0.5, q.y - 22 - 0.5, 12, 25);
        }
    }
    if (showHud) {
      // mock resting hand: five card backs fanned; the visible strip is what normal play shows
      const n = 5;
      const step = Math.min(52, (UI.hand.w - CARD_W - 8) / (n - 1));
      const top = UI.handRestTop;
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        const cx = Math.round(UI.hand.x + UI.hand.w / 2 + off * step);
        const cy = Math.round(top + CARD_H / 2 + off * off * 1.5);
        scene.add.image(cx, cy, CARD_BACK).setRotation(off * 0.05).setDepth(DEPTH.HAND + i);
      }
    }

    if (params.get('corner') === '1' && ARENA_V2) applyCornerContract(scene, piles);

    // ------------------------------------------------------------ numbers
    const m0 = zoneXY(0, 'monster', 0);
    const m1 = zoneXY(0, 'monster', 1);
    const f1 = zoneXY(1, 'monster', 2);
    const lane = Math.hypot(m1.x - m0.x, m1.y - m0.y);
    const across = Math.hypot(f1.x - m0.x, f1.y - m0.y);
    const lines = [
      `arena ${ARENA_VARIANT}  tile ${TILE_W}x${TILE_H}  grid ${BOARD_COLS}x${BOARD_ROWS}  origin (${BOARD_OX},${BOARD_OY})  bounds ${BOARD_BOUNDS.x},${BOARD_BOUNDS.y} ${BOARD_BOUNDS.w}x${BOARD_BOUNDS.h}`,
      `lane step dx ${m1.x - m0.x} dy ${m1.y - m0.y} (${lane.toFixed(1)} px)   front rows apart ${across.toFixed(1)} px   bridge rows ${BRIDGE_ROWS.join(',')}`,
      `duelists P1 (${duelistXY(0).x},${duelistXY(0).y})  P2 (${duelistXY(1).x},${duelistXY(1).y})   screen ${GAME_W}x${GAME_H}`,
    ];
    console.log(`[layout] ${lines.join('\n[layout] ')}`);
    if (params.get('info') === '1') label(scene, 4, GAME_H / 2 - 20, lines.join('\n'), '#fff4b5', '#07070fd0');
  },
};

export default preview;
