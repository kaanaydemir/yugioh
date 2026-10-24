// ?dev=cards3 — the v3 card object and the v3 back (lane A6-A, step A1; docs/v3/A6_PLAN.md §5.2 A1,
// §4.1 "Kart nesnesi", K4, S-2 / S-9). Open with &look=v3 (the v3 back and the crisp card exist only
// while lane A6-A is on; without it the page shows today's pictures). Shoot at ×3:
//   node tools/shot.mjs "?dev=cards3&look=v3" --scale 3 --step 400 --out shots/…/cards3-backs.png
//   (default)    &page=backs  today's back | the v3 back of P1 / P2 at 1× and 2× and every level
//                             (24×34, the 18×26 board level, the 9×13 mini-hand), face-down cards on
//                             board tiles (up / side, P1 / P2), deck stacks, the mini-hands
//   &page=card   live CardV3s: whole-pixel scales (1, 0.75, 0.5, 2) as crisp rasters, the 1-px rim +
//                running node (P1, P2, selected), a rim pulse, a punch, looping sharp flips
//   &page=turn   the turn frames (back → face, face → back, P1 / P2, 48 and 24 px wide), the
//                motion-LOD faces, rasters of a face at 36×51 / 24×34 / 12×17
//   &page=inspect  (step A2, K12) the v3 inspect panel cycling every 700 ms through a monster, a
//                spell, a trap, a hidden P2 card and the pile views (S-9 showPile: deck 12, the
//                rival's hand 4, graveyard 3, an empty deck); &state=<0..7> holds one of them
import type Phaser from 'phaser';
import type { DevPreview } from '../types';
import { ALL_CARD_IDS, type CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import {
  ISO_CX,
  ISO_CY,
  ISO_TEX_H,
  ISO_TEX_W,
  cardBackCanvas,
  cardBackKey,
  cardFaceCanvas,
  cardIsoKey,
  type CardOrientation,
} from '../../art/cards';
import { pixelText } from '../../ui/text';
import { DEPTH } from '../../view/layout';
import { drawIsoTile } from './monster';
import { V3_A6_A } from '../../view/v3flags';
import { drawBackV3, miniHandBackKey, todayBackCanvas } from '../../view/v3/cardBack';
import { lodFace } from '../../view/v3/cardLod';
import { rasterCard } from '../../view/v3/cardRaster';
import { cardTurnFrames, createCardV3, type CardV3 } from '../../view/v3/CardV3';
import { miniCardKey } from '../../view/ui-textures';
import { InspectPanel } from '../../view/InspectPanel';
import { showPile } from '../../view/v3/inspectV3';

let seq = 0;

/** A canvas as a one-off texture (dev page only). */
function tex(scene: Phaser.Scene, p: PixelCanvas): string {
  const key = `dev:cards3:${++seq}`;
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

function img(scene: Phaser.Scene, x: number, y: number, p: PixelCanvas, k = 1): Phaser.GameObjects.Image {
  return scene.add.image(x, y, tex(scene, p)).setOrigin(0).setScale(k);
}

function label(scene: Phaser.Scene, x: number, y: number, s: string, color: number = PAL.mist) {
  return pixelText(scene, x, y, s, { size: 'sm', color }).setDepth(DEPTH.DEBUG);
}

/** A board pad (dark diamond, 1-px owner line) at (x, y), as the calm arena draws it. */
function pad(scene: Phaser.Scene, x: number, y: number, player: PlayerId): void {
  drawIsoTile(scene.add.graphics(), x, y, PAL.night1, player === 0 ? PAL.cyan2 : PAL.crim2);
}

function isoCard(scene: Phaser.Scene, x: number, y: number, id: CardId | 'back', o: CardOrientation, player: PlayerId) {
  return scene.add.image(x, y, cardIsoKey(id, o, player)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H);
}

// ---------------------------------------------------------------- page: backs

function pageBacks(scene: Phaser.Scene): void {
  label(scene, 6, 4, V3_A6_A ? 'v3 ARKA YÜZ (S-2) — bugün | P1 | P2' : 'A6-A kapalı: bugünkü arka yüz', PAL.gold4);
  // 1× and 2×: today | P1 | P2
  img(scene, 6, 16, todayBackCanvas());
  scene.add.image(58, 16, cardBackKey(0)).setOrigin(0);
  scene.add.image(110, 16, cardBackKey(1)).setOrigin(0);
  label(scene, 6, 86, 'bugün');
  label(scene, 58, 86, 'P1');
  label(scene, 110, 86, 'P2');
  scene.add.image(166, 16, cardBackKey(0)).setOrigin(0).setScale(2);
  scene.add.image(270, 16, cardBackKey(1)).setOrigin(0).setScale(2);
  // hand-drawn levels of both players
  let x = 380;
  for (const pl of [0, 1] as PlayerId[]) {
    img(scene, x, 16, drawBackV3(pl, 'half'));
    img(scene, x + 28, 16, drawBackV3(pl, 'mini'));
    img(scene, x + 50, 16, drawBackV3(pl, 'hand'));
    img(scene, x, 54, drawBackV3(pl, 'half'), 2);
    x += 64;
  }
  label(scene, 380, 128, '24×34 · 18×26 · 9×13');
  // mini-hands as the HUD shows them: v3 | today
  for (const pl of [0, 1] as PlayerId[]) {
    for (let i = 0; i < 5; i++) {
      scene.add.image(520 + i * 7, 156 + pl * 16, V3_A6_A ? miniHandBackKey(scene, pl) : miniCardKey(pl)).setOrigin(0);
      scene.add.image(570 + i * 7, 156 + pl * 16, miniCardKey(pl)).setOrigin(0);
    }
  }
  label(scene, 520, 146, 'mini el v3 | bugün');
  // the board: face-down cards on pads (up / side, P1 / P2), today's beside for comparison
  const spots: [number, number, CardOrientation, PlayerId][] = [
    [40, 180, 'up', 0],
    [108, 180, 'side', 0],
    [176, 180, 'up', 1],
    [244, 180, 'side', 1],
  ];
  for (const [tx, ty, o, p] of spots) {
    pad(scene, tx, ty, p);
    isoCard(scene, tx, ty, 'back', o, p);
  }
  label(scene, 6, 202, 'sahadaki kapalı kart (yukarı / yan, P1 / P2)');
  // deck stacks as PileView draws them (layers 1 px apart, lower layers shaded)
  for (const p of [0, 1] as PlayerId[]) {
    const sx = 330 + p * 80;
    const sy = 190;
    pad(scene, sx, sy, p);
    const L = 7;
    for (let i = 0; i < L; i++) {
      const im = isoCard(scene, sx, sy - i, 'back', 'up', p);
      if (i < L - 1) {
        const k = 0.45 + 0.35 * (i / Math.max(1, L - 1));
        const c = Math.round(255 * k);
        im.setTint((c << 16) | (c << 8) | c);
      }
    }
  }
  label(scene, 300, 212, 'deste yığını P1 / P2');
  // a board row: pad, face-down card, deck, graveyard (a face on top) — must not be confused
  const row: [number, CardId | 'back' | null][] = [
    [40, null],
    [108, 'back'],
    [176, 'back'],
    [244, 'crystal_wyrm'],
  ];
  for (const [rx, id] of row) {
    pad(scene, rx, 260, 0);
    if (id === null) continue;
    const layers = rx === 176 || rx === 244 ? 4 : 1;
    for (let i = 0; i < layers; i++) isoCard(scene, rx, 260 - i, i === layers - 1 ? id : 'back', 'up', 0);
  }
  label(scene, 6, 282, 'boş ped | kapalı kart | deste | mezarlık');
  // the hand: face-down cards of both players (hot-seat curtain), as upright CardSprites
  for (let i = 0; i < 3; i++) {
    createCardV3(scene, 'ember_wolf', { x: 470 + i * 52, y: 300, faceUp: false, player: 0 });
  }
  label(scene, 446, 336, 'el, kapalı (P1)');
}

// ---------------------------------------------------------------- page: card

function pageCard(scene: Phaser.Scene): void {
  label(scene, 6, 2, V3_A6_A ? 'CardV3 — tam piksel boyut, 1 px kenar + düğüm, keskin dönüş' : 'A6-A kapalı: CardV3 = bugünkü CardSprite', PAL.gold4);
  // logical scales shown as crisp whole-pixel rasters: a P1 back, a P2 back, a face
  const xs = [30, 84, 126, 158];
  [1, 0.75, 0.5, 0.25].forEach((s, i) => {
    createCardV3(scene, null, { x: xs[i], y: 50, faceUp: false, player: 0 }).setScale(s);
    createCardV3(scene, null, { x: xs[i], y: 124, faceUp: false, player: 1 }).setScale(s);
    createCardV3(scene, 'abyss_magus', { x: xs[i], y: 198, player: 0 }).setScale(s);
    label(scene, xs[i] - 8, 234, `×${s}`);
  });
  createCardV3(scene, null, { x: 230, y: 124, faceUp: false, player: 1 }).setScale(1.5);
  label(scene, 268, 178, '×1.5');
  // highlights: P1 playable, P2 playable, selected (gold), marked (crimson)
  const tones: [CardId, number, string][] = [
    ['crystal_wyrm', PLAYER_RAMP[0][3], 'P1'],
    ['ember_wolf', PLAYER_RAMP[1][3], 'P2'],
    ['judgment_bolt', PAL.gold3, 'seçili'],
    ['mirror_barrier', PAL.crim3, 'işaretli'],
  ];
  tones.forEach(([id, c, t], i) => {
    createCardV3(scene, id, { x: 354 + i * 76, y: 56, player: 0 }).setHighlight(c);
    label(scene, 336 + i * 76, 94, t);
  });
  label(scene, 336, 106, '1 px kenar + koşan düğüm');
  // looping flips (P1 back ↔ wyrm, P2 back ↔ wolf, a 0.75 card), a rim pulse, a punch
  const flips: CardV3[] = [
    createCardV3(scene, 'crystal_wyrm', { x: 354, y: 170, faceUp: false, player: 0 }),
    createCardV3(scene, 'ember_wolf', { x: 410, y: 170, faceUp: false, player: 1 }),
    createCardV3(scene, 'judgment_bolt', { x: 460, y: 170, faceUp: false, player: 0 }).setScale(0.75),
  ];
  label(scene, 336, 208, 'keskin dönüş');
  const pulse = createCardV3(scene, 'soul_recall', { x: 530, y: 170, player: 0 });
  label(scene, 510, 208, 'flaş');
  const punch = createCardV3(scene, null, { x: 594, y: 170, faceUp: false, player: 1 });
  label(scene, 576, 208, 'vurma');
  let flipT = 0;
  let pulseT = 0;
  scene.events.on('update', (_t: number, dt: number) => {
    flipT += dt;
    pulseT += dt;
    if (flipT >= 900) {
      flipT = 0;
      for (const f of flips) void f.flip(!f.faceUp, 240);
    }
    if (pulseT >= 1000) {
      pulseT = 0;
      void pulse.pulse(PAL.gold3, 320);
      void punch.punch(0.12, 180);
    }
  });
  // the turn frames of one card at 1× (each frame 48×68 with the card centred in it)
  cardTurnFrames('crystal_wyrm', false, 0, 48, 68).forEach((f, i) => img(scene, 6 + i * 44, 252, f));
  label(scene, 320, 300, 'dönüş kareleri: 48 → 34 → 18 → 4 → 18 → 34 → 48');
}

// ---------------------------------------------------------------- page: turn

function pageTurn(scene: Phaser.Scene): void {
  label(scene, 6, 2, 'dönüş kareleri · hareket LOD yüzü · ham boyutlar', PAL.gold4);
  const rows: [CardId, boolean, PlayerId, number, number][] = [
    ['crystal_wyrm', false, 0, 48, 68],
    ['ember_wolf', false, 1, 48, 68],
    ['mirror_barrier', true, 0, 48, 68],
  ];
  rows.forEach(([id, up, pl, w, h], r) => {
    cardTurnFrames(id, up, pl, w, h).forEach((f, i) => img(scene, 6 + i * 50, 12 + r * 72, f));
  });
  // 24 px wide turns
  cardTurnFrames('judgment_bolt', false, 1, 24, 34).forEach((f, i) => img(scene, 360 + i * 27, 12, f));
  cardTurnFrames('abyss_magus', true, 0, 24, 34).forEach((f, i) => img(scene, 360 + i * 27, 50, f));
  // rasters of a face and both backs
  let x = 360;
  for (const src of [cardFaceCanvas('crystal_wyrm'), cardBackCanvas(0), cardBackCanvas(1)]) {
    for (const [w, h] of [
      [36, 51],
      [24, 34],
      [12, 17],
    ] as const) {
      img(scene, x, 92, rasterCard(src, w, h));
      x += w + 2;
    }
    x += 4;
  }
  // LOD faces of every card (motion frames)
  ALL_CARD_IDS.forEach((id, i) => img(scene, 6 + (i % 10) * 50, 220 + Math.floor(i / 10) * 70, lodFace(id)));
  label(scene, 520, 240, 'hareket LOD yüzleri');
}

// ---------------------------------------------------------------- page: inspect (A2, K12)

/** The states the inspect page shows, in order (label, what to show). */
const INSPECT_STATES: [string, (p: InspectPanel) => void][] = [
  ['canavar · Kristal Ejder', (p) => p.show('crystal_wyrm')],
  ['büyü · Yıldırım Hükmü', (p) => p.show('judgment_bolt')],
  ['tuzak · Ayna Bariyeri', (p) => p.show('mirror_barrier')],
  ['kapalı kart (P2)', (p) => p.show(null, { owner: 1 })],
  ['showPile deste P1 · 12', (p) => void showPile(p, 'deck', 0, 12)],
  ['showPile rakibin eli P2 · 4', (p) => void showPile(p, 'hand', 1, 4)],
  ['showPile mezarlık P1 · 3', (p) => void showPile(p, 'graveyard', 0, 3)],
  ['showPile boş deste P2', (p) => void showPile(p, 'deck', 1, 0)],
];

function pageInspect(scene: Phaser.Scene, params: URLSearchParams): void {
  scene.cameras.main.setBackgroundColor(PAL.night0);
  const panel = new InspectPanel(scene);
  const hold = params.get('state');
  const caption = label(scene, 150, 30, '', PAL.gold4);
  let i = hold !== null ? Math.max(0, Math.min(INSPECT_STATES.length - 1, Number(hold) || 0)) : 0;
  const showIt = () => {
    const [name, fn] = INSPECT_STATES[i];
    caption.setText(`${i} · ${name}`);
    fn(panel);
  };
  showIt();
  label(scene, 150, 44, V3_A6_A ? 'v3 inceleme paneli (K12) — aynı karede takas, 120 ms kayma' : 'A6-A kapalı: bugünkü panel', PAL.mist);
  if (hold !== null) return;
  scene.time.addEvent({
    delay: 700,
    loop: true,
    callback: () => {
      i = (i + 1) % INSPECT_STATES.length;
      showIt();
    },
  });
}

const preview: DevPreview = {
  name: 'cards3',
  description: 'v3 card object + v3 back (A6-A A1) + inspect panel (A2): &page=backs|card|turn|inspect (open with &look=v3)',
  create(scene, params) {
    scene.cameras.main.setBackgroundColor(PAL.night2);
    const page = params.get('page') ?? 'backs';
    if (page === 'card') pageCard(scene);
    else if (page === 'turn') pageTurn(scene);
    else if (page === 'inspect') pageInspect(scene, params);
    else pageBacks(scene);
  },
};

export default preview;
