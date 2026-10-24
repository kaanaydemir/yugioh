// ?dev=a5fx — lane A5-A's shared kit (docs/v3/A5_PLAN.md §4.1–§4.3, §4.6): the spell / trap motifs
// (src/art/spellmotifs-v3.ts), the effect kit (src/cinematics/_v3/spellfx.ts) on real units over the
// calm arena, and the spell / trap sounds rendered offline. Open with &look=v3.
//   &page=motifs (default)  every motif drawing on one sheet (1× pixels; shoot it with --scale 3)
//   &page=live&fx=<name>    one kit effect, looping, on the board: column | drops | rim | steam |
//                           panel | chasm | sword | land | all (default all)
//   &page=sound             the 23 recipes rendered offline through the v3 chain: waveform, length,
//                           chain peak (red frame: over −1 dBFS), raw peak; &log=1 prints the table.
//   &sync=1                 the live page starts when tools/shot.mjs freezes the clock (films)
//   &loop=0                 run once
//
//   node tools/shot.mjs "?dev=a5fx&look=v3" --scale 3 --out shots/…/motifs-x3.png
//   node tools/shot.mjs "?dev=a5fx&look=v3&page=live&fx=chasm&sync=1" --film 24 --every 50 --cols 6

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { canvasTexture } from '../../art/textures';
import * as M from '../../art/spellmotifs-v3';
import { renderSfx, type SfxName } from '../../audio/sfx';
import { stats } from '../../audio/analyze';
import { V3_SPELL_RECIPES } from '../../audio/v3/spells';
import type { MonsterId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import { MonsterUnit } from '../../duel/MonsterUnit';
import { BoardView } from '../../view/BoardView';
import { TileCard } from '../../view/TileCard';
import { DEPTH, type XY, duelistXY, zoneXY } from '../../view/layout';
import { pixelText } from '../../ui/text';
import { wait } from '../../vfx/core';
import { run } from '../../vfx/setpieces';
import {
  chasmPad,
  dropArcs,
  embers,
  frontEdgeMask,
  honeycombPanel,
  jitter,
  motifImage,
  rimClimb,
  runCrack,
  setMotif,
  shards,
  silhouetteOf,
  steamEmitter,
  steamThreads,
  steppedColumn,
  swordFor,
  swordKey,
} from '../../cinematics/_v3/spellfx';
import type { DevPreview } from '../types';
import { installVirtualClock } from './cardfx';

// =================================================================================== motif sheet

function label(scene: Phaser.Scene, x: number, y: number, t: string, color: number = PAL.mist): void {
  pixelText(scene, x, y, t, { size: 'sm', color }).setDepth(DEPTH.HUD);
}

function motifSheet(scene: Phaser.Scene): void {
  const p = new PixelCanvas(640, 360);
  p.rect(0, 0, 640, 360, PAL.night0);
  // a calm pad strip under the floor motifs
  p.rect(0, 286, 640, 74, PAL.night1);

  // ---- swords: forge stages, break, bond rim, glint (1 px → cross), the 6 pre-drawn angles, a long one
  let x = 14;
  const sy = 44;
  for (const st of [1, 2, 3] as const) {
    M.paintSword(p, x, sy, { stage: st });
    x += 14;
  }
  M.paintSword(p, x, sy, { crack: true });
  x += 14;
  M.paintSword(p, x, sy, { rim: 'white' });
  x += 14;
  M.paintSword(p, x, sy, { glint: 0.3 });
  x += 14;
  M.paintSword(p, x, sy, { glint: 0.3, glintCross: true });
  x += 26;
  for (const f of [1, -1] as const) {
    M.paintSword(p, x + (f === 1 ? 0 : 10), sy, { angle: 'diag', facing: f });
    x += 26;
    M.paintSword(p, x + (f === 1 ? 4 : 16), sy - 6, { angle: 'flat', facing: f });
    x += 30;
  }
  M.paintSword(p, x + 6, sy, { len: 18 });

  // ---- honeycomb mirror: rest, struck (white) + ring 1 up, the wave's next frame, building, single cells
  const hy = 74;
  M.paintHoneycomb(p, 14, hy, [{}, {}, {}, { glint: true }, {}, {}, {}]);
  M.paintHoneycomb(p, 52, hy, [{ tone: 1 }, { tone: 1 }, { tone: 1 }, { white: true }, { tone: 1 }, { tone: 1 }, { tone: 1 }]);
  M.paintHoneycomb(p, 90, hy, [{ tone: -1 }, { tone: -1 }, { tone: -1 }, { white: true }, { tone: -1 }, { tone: -1 }, { tone: -1 }]);
  M.paintHoneycomb(p, 128, hy, [{ hidden: true }, { hidden: true }, { frameOnly: true }, {}, { frameOnly: true }, { hidden: true }, { hidden: true }]);
  M.paintHexCell(p, 166, hy + 7, {});
  M.paintHexCell(p, 180, hy + 7, { white: true });

  // ---- chain links (sm / lg × 4 angles, face-on and edge-on) and two chains
  let cx = 214;
  for (const size of ['sm', 'lg'] as const)
    for (const angle of [0, 45, 90, 135] as const) {
      M.blitMotif(p, M.chainLinkMotif({ angle, size }), cx, hy + 6);
      M.blitMotif(p, M.chainLinkMotif({ angle, size, face: false }), cx, hy + 22);
      cx += size === 'lg' ? 18 : 12;
    }
  M.paintChain(p, cx + 6, hy, cx + 56, hy + 26, { glintAt: 3 });
  M.paintChain(p, cx + 6, hy + 30, cx + 70, hy + 30);
  M.paintChain(p, cx + 80, hy, cx + 80, hy + 30, { size: 'lg' });

  // ---- spring column steps, flow phases, pool; lava column steps + phases; flame tongue loop + cooling
  const by = 186;
  let lx = 16;
  for (const h of [14, 26, 34]) {
    M.paintSpringColumn(p, lx, by, h, { phase: 0 });
    lx += 14;
  }
  for (const ph of [1, 2, 3]) {
    M.paintSpringColumn(p, lx, by, 34, { phase: ph });
    lx += 14;
  }
  M.paintPool(p, lx + 16, by + 2, 15, { rings: 2 });
  M.paintSpringColumn(p, lx + 16, by + 1, 30, { phase: 1 });
  lx += 46;
  for (const h of [8, 16, 24]) {
    M.paintLavaColumn(p, lx, by, h, { phase: 0 });
    lx += 16;
  }
  for (const ph of [1, 2]) {
    M.paintLavaColumn(p, lx, by, 24, { phase: ph });
    lx += 16;
  }
  lx += 6;
  for (const f of [0, 1, 2]) {
    M.paintFlameTongue(p, lx, by - 12, f);
    lx += 9;
  }
  for (const c of [1, 2, 3] as const) {
    M.paintFlameTongue(p, lx, by - 12, 0, { cool: c });
    lx += 9;
  }

  // ---- chasm: the pad closed (cracked), opening, open; the running crack
  let chx = 260;
  for (const st of [0, 1, 2] as const) {
    M.paintChasm(p, chx, 320, 26, 13, { step: st, crack: st === 0 ? 1 : 0 });
    chx += 66;
  }
  const path = M.crackPath({ x: 30, y: 336 }, { x: 200, y: 304 }, 7, 3);
  M.paintCrack(p, path, path.length);

  canvasTexture(scene, 'a5fx:sheet', p);
  scene.add.image(0, 0, 'a5fx:sheet').setOrigin(0, 0);
  label(scene, 6, 6, 'A5-A kit — motifler (S-12)', PAL.gold3);
  label(scene, 14, 56, 'kılıç: dövme 1·2·3, kırık, bağ kenarı, parıltı, 3 açı × 2 yön', PAL.mist);
  label(scene, 14, 104, 'ayna peteği · zincir halkaları', PAL.mist);
  label(scene, 14, 196, 'pınar sütunu · havuz · lav sütunu · alev dilleri + soğuma', PAL.mist);
  label(scene, 14, 274, 'yarık: koşan çatlak · ped kapalı / açılıyor / açık', PAL.mist);
}

// =================================================================================== live effects

interface Live {
  scene: Phaser.Scene;
  units: Record<string, MonsterUnit>;
  loop: boolean;
}

const UNITS: readonly { key: string; id: MonsterId; player: PlayerId; zone: number }[] = [
  { key: 'wolf', id: 'ember_wolf', player: 0, zone: 0 },
  { key: 'wyrm', id: 'crystal_wyrm', player: 0, zone: 2 },
  { key: 'magus', id: 'abyss_magus', player: 1, zone: 2 },
  { key: 'golem', id: 'tide_golem', player: 1, zone: 0 },
];

/** Where a P-side spell hovers (the cast spot's floor, as spells/_kit.ts castSpot + castFloor). */
function castFloor(player: PlayerId): XY {
  const d = duelistXY(player);
  return player === 0 ? { x: Math.round(d.x) - 40, y: Math.round(d.y) - 8 + 40 } : { x: Math.round(d.x) + 40, y: Math.round(d.y) + 8 + 40 };
}

const FX: Record<string, (c: Live) => Promise<void>> = {
  async column(c) {
    const at = castFloor(0);
    const col = steppedColumn(c.scene, { kind: 'water', at, rise: [0, 14, 26, 34] });
    const lava = steppedColumn(c.scene, { kind: 'lava', at: zoneXY(1, 'field'), rise: [0, 8, 16, 24], stepMs: 50 });
    await col.risen;
    await wait(c.scene, 420);
    await Promise.all([col.collapse([20, 8, 0]), lava.collapse([16, 8, 0], 50)]);
    await wait(c.scene, 200);
  },
  async drops(c) {
    const at = castFloor(0);
    const col = steppedColumn(c.scene, { kind: 'water', at, rise: [0, 14, 26, 34] });
    await col.risen;
    const d = duelistXY(0);
    await dropArcs(c.scene, { from: { x: at.x + 1, y: at.y - 36 }, to: { x: Math.round(d.x), y: Math.round(d.y) - 10 }, n: 6, kind: 'water', apex: 10, ms: 150, gap: 50 });
    // lava gobs from the field zone
    const f = zoneXY(1, 'field');
    await dropArcs(c.scene, { from: { x: f.x, y: f.y - 24 }, to: f, n: 8, kind: 'lava', apex: 16, ms: 260, gap: 18, spread: 28 });
    await col.collapse([20, 8, 0]);
    await wait(c.scene, 200);
  },
  async rim(c) {
    // the ATEŞ edge on the old-art wolf and the v3 wyrm at once; a buff edge (leaf) on the magus
    const peaks: Promise<void>[] = [
      rimClimb(c.scene, c.units.wolf.sprite, { onPeak: () => embers(c.scene, c.units.wolf.core(), { n: 5 }) }),
      rimClimb(c.scene, c.units.wyrm.sprite),
      rimClimb(c.scene, c.units.magus.sprite, { ramp: [PAL.leaf2, PAL.leaf3, PAL.leaf4], where: 'contour' }),
    ];
    await Promise.all(peaks);
    await wait(c.scene, 300);
  },
  async steam(c) {
    await steamThreads(c.scene, c.units.golem.sprite, { n: 4 });
    const em = steamEmitter(c.scene, c.units.magus.sprite);
    await wait(c.scene, 1600);
    em.stop();
    await wait(c.scene, 300);
  },
  async panel(c) {
    // in the lane between the P2 golem and the P1 wolf, the third nearer the defender
    const a = c.units.golem.core();
    const b = c.units.wolf.core();
    const at = { x: Math.round(a.x + (b.x - a.x) * 0.66), y: Math.round(a.y + (b.y - a.y) * 0.66) - 6 };
    const p = honeycombPanel(c.scene, { at });
    await p.build();
    await wait(c.scene, 160);
    p.wave(3);
    await wait(c.scene, 220);
    p.wave(1);
    await wait(c.scene, 300);
    await p.break();
    await wait(c.scene, 200);
  },
  async chasm(c) {
    const u = c.units.golem;
    // P1's trap answers P2's summon: the crack runs across the board to the victim's pad
    const pad = zoneXY(1, 'monster', 0);
    const trap = zoneXY(0, 'spellTrap', 1);
    const cr = runCrack(c.scene, trap, pad, { ms: 220 });
    const ch = chasmPad(c.scene, { at: pad });
    await cr.done;
    void cr.fade(160);
    await run(c.scene, 80, (t) => ch.crack(t));
    ch.open(1);
    await wait(c.scene, 34);
    ch.open(2);
    // the body sinks behind the front lip on whole-pixel steps (2, 4, 7, 11, 16 … px per frame)
    const mask = frontEdgeMask(c.scene, ch.lip());
    const s = u.sprite;
    const y0 = s.y;
    mask.apply(s);
    const steps = [2, 4, 7, 11, 16, 22, 29, 37];
    let k = 0;
    let dy = 0;
    await run(c.scene, steps.length * 34, (_t, _el, dt) => {
      if (dt > 0 && k < steps.length) dy += steps[k++];
      s.setY(y0 + dy);
    });
    await wait(c.scene, 120);
    ch.open(1);
    await wait(c.scene, 34);
    ch.open(0);
    await jitter(c.scene, { x: 0, y: 0, setPosition: () => undefined }, 120);
    await wait(c.scene, 300);
    mask.destroy();
    s.setY(y0);
    ch.destroy();
  },
  async sword(c) {
    const tile = zoneXY(0, 'spellTrap', 2);
    const u = c.units.wyrm;
    // forge: the sword draws itself above the card in 3 steps
    const forgeAt = { x: tile.x, y: tile.y - 6 };
    const [k1, m1] = swordKey({ stage: 1 });
    const img = motifImage(c.scene, k1, m1, forgeAt.x, forgeAt.y, DEPTH.FX + 2);
    for (const st of [2, 3] as const) {
      await wait(c.scene, 40);
      const [k, m] = swordKey({ stage: st });
      setMotif(img, k, m);
    }
    await wait(c.scene, 80);
    // flight: the pre-drawn angle closest to the travel direction on every frame
    const box = silhouetteOf(u.sprite);
    const dest = box ? { x: box.left - 4, y: Math.round((box.top + box.bottom) / 2) - 2 } : u.core();
    const p0 = { x: img.x, y: img.y };
    let prev = p0;
    await run(c.scene, 200, (t) => {
      const lift = Math.sin(Math.PI * t) * 26;
      const x = Math.round(p0.x + (dest.x - p0.x) * t);
      const y = Math.round(p0.y + (dest.y - p0.y) * t - lift);
      const d = swordFor(x - prev.x, y - prev.y);
      const [k, m] = swordKey({ angle: d.angle, facing: d.facing });
      if (x !== prev.x || y !== prev.y) setMotif(img, k, m);
      img.setPosition(x, y);
      prev = { x, y };
    });
    // bond: one white-rim frame, then the upright sword bobs 1 px and a glint runs down its edge
    setMotif(img, ...swordKey({ rim: 'white' }));
    await wait(c.scene, 17);
    setMotif(img, ...swordKey({}));
    const by = img.y;
    await run(c.scene, 1200, (_t, el) => {
      img.setY(by - (Math.floor(el / 200) % 2));
      const g = Math.floor(el / 50) - 10;
      if (g >= 0 && g < 3) setMotif(img, ...swordKey({ glint: 0.25, glintCross: g === 1 }));
      else setMotif(img, ...swordKey({}));
    });
    // break: a 2-frame white crack, then 7 gold shards fall to the floor and fade by steps
    setMotif(img, ...swordKey({ crack: true }));
    await wait(c.scene, 34);
    const floor = u.home.y + 2;
    img.destroy();
    await shards(c.scene, { from: { x: dest.x, y: dest.y }, n: 7, ramp: [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4], mode: 'fall', floor });
    await wait(c.scene, 200);
  },
  async land(c) {
    // landV3's mechanism: a card appears STANDING on its tile (no flat frame first) and lies down
    const t = new TileCard(c.scene, 0, 'spellTrap', 0, 'dragon_blade', true, 'up');
    t.standing = true;
    t.setCard('dragon_blade');
    await wait(c.scene, 300);
    await t.layDown(120);
    await wait(c.scene, 400);
    t.destroy();
  },
};

async function liveLoop(c: Live, name: string): Promise<void> {
  const order = name === 'all' ? ['column', 'drops', 'rim', 'steam', 'panel', 'chasm', 'sword', 'land'] : [name];
  for (const n of order) if (!FX[n]) throw new Error(`a5fx: unknown fx ${n}`);
  do {
    for (const n of order) await FX[n](c);
  } while (c.loop);
}

// =================================================================================== sound page

async function soundPage(scene: Phaser.Scene, log: boolean): Promise<void> {
  const names = Object.keys(V3_SPELL_RECIPES) as SfxName[];
  const p = new PixelCanvas(640, 360);
  p.rect(0, 0, 640, 360, PAL.night0);
  const rows: string[] = [];
  const TW = 160;
  const TH = 58;
  const CEIL = Math.pow(10, -1 / 20); // −1 dBFS
  const info: { n: SfxName; len: number; peak: number; raw: number; loud: number }[] = [];
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    const [buf, raw] = await Promise.all([renderSfx(n, { seconds: 3 }), renderSfx(n, { seconds: 3, chain: false })]);
    if (!buf || !raw) {
      window.__neon.errors.push(`a5fx sound: ${n} did not render`);
      continue;
    }
    const s = stats(buf);
    const r = stats(raw);
    info.push({ n, len: r.len, peak: s.peak, raw: r.peak, loud: s.maxWinDb });
    if (s.peak < 0.005) window.__neon.errors.push(`a5fx sound: ${n} is silent`);
    if (s.peak > CEIL) window.__neon.errors.push(`a5fx sound: ${n} peaks over -1 dBFS after the chain (${s.peak.toFixed(3)})`);
    // waveform thumbnail (min / max per column over the dry length + 0.3 s)
    const x0 = (i % 4) * TW;
    const y0 = Math.floor(i / 4) * TH + 12;
    p.rect(x0 + 1, y0, TW - 2, TH - 2, PAL.night1);
    const ch = buf.getChannelData(0);
    const span = Math.min(ch.length, Math.ceil((r.len + 0.3) * buf.sampleRate));
    const W = TW - 6;
    const mid = y0 + 26;
    for (let k = 0; k < W; k++) {
      let lo = 0;
      let hi = 0;
      const a = Math.floor((k / W) * span);
      const b = Math.max(a + 1, Math.floor(((k + 1) / W) * span));
      for (let j = a; j < b; j++) {
        lo = Math.min(lo, ch[j]);
        hi = Math.max(hi, ch[j]);
      }
      const yh = Math.round(mid - hi * 20);
      const yl = Math.round(mid - lo * 20);
      p.vline(x0 + 3 + k, yh, yl, PAL.teal3);
    }
    if (s.peak > CEIL) p.frame(x0, y0 - 1, TW, TH, PAL.crim3);
    rows.push(`${n.padEnd(13)} len ${r.len.toFixed(2)}s  raw pk ${r.peak.toFixed(2)}  chain pk ${s.peak.toFixed(3)} (${(20 * Math.log10(s.peak + 1e-9)).toFixed(1)} dBFS)  loud ${s.maxWinDb.toFixed(1)} dB`);
  }
  canvasTexture(scene, 'a5fx:sound', p);
  scene.add.image(0, 0, 'a5fx:sound').setOrigin(0, 0);
  label(scene, 4, 1, `A5-A sesleri (${info.length}) — zincir tepesi ≤ −1 dBFS, kırmızı çerçeve: aşıyor`, PAL.gold3);
  info.forEach((a, i) => {
    const x0 = (i % 4) * TW;
    const y0 = Math.floor(i / 4) * TH + 12;
    label(scene, x0 + 4, y0 + 1, a.n, PAL.gold3);
    label(scene, x0 + 4, y0 + TH - 12, `${a.len.toFixed(2)}s  ${(20 * Math.log10(a.peak + 1e-9)).toFixed(1)}dB  ham ${a.raw.toFixed(2)}`, PAL.mist);
  });
  if (log) console.warn('[a5fx sound]\n' + rows.join('\n'));
}

// =================================================================================== page

const preview: DevPreview = {
  name: 'a5fx',
  description: 'A5-A kit: &page=motifs|live|sound, live: &fx=column|drops|rim|steam|panel|chasm|sword|land|all &sync=1 &loop=0; sound: &log=1 (add &look=v3)',
  async create(scene, params) {
    installVirtualClock();
    const page = params.get('page') ?? 'motifs';
    if (page === 'motifs') return motifSheet(scene);
    if (page === 'sound') return soundPage(scene, params.get('log') === '1');
    new BoardView(scene, { active: 0 });
    const units: Record<string, MonsterUnit> = {};
    UNITS.forEach((d, i) => {
      units[d.key] = new MonsterUnit(scene, { uid: (9100 + i) as never, cardId: d.id, player: d.player, zone: d.zone, position: 'attack', atk: 0, def: 0 });
      units[d.key].badge.setVisible(false);
    });
    const c: Live = { scene, units, loop: params.get('loop') !== '0' };
    const start = () => void liveLoop(c, params.get('fx') ?? 'all').catch((e) => window.__neon.errors.push(`a5fx: ${String(e)}`));
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
