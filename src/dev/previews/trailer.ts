// ?dev=trailer — the Steam trailer's in-engine cards (marketing/trailer/): drawn with the game's own pixel
// font (pixelLetters), palette and logo, filmed by marketing/trailer/build/capture.mjs on the frozen clock.
//
//   ?dev=trailer&card=0..3   a text card: synthwave floor scrolling toward the camera, stars, the line
//                            dropping in letter by letter, a spectrum (prism) glint crossing it
//   ?dev=trailer&card=end    the end card: the lit title screen (real TitleScene, attract) with the prompt
//                            replaced by the call to action; window.__neon.trailerHit() slams it in
//   &sync=1                  hold the card's clock at 0 until the shot tool freezes the loop
//
// Sounds go through sfx.play like the game's (the capture hooks them and renders them offline).
import Phaser from 'phaser';
import type { DevPreview } from '../types';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import { pixelLetters, pixelText, type PixelLetter } from '../../ui/text';
import { sfx } from '../../audio/sfx';
import { tween, wait } from '../../vfx/core';
import { TitleScene, type TitleData } from '../../scenes/TitleScene';
import { SCENARIOS, type Scenario } from '../../duel/scenarios';
import type { MonSpec } from '../../duel/scenario';
import duelPreview from './duel';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];

/** Trailer duels (?dev=trailer&s=<key>, filmed with --fresh like ?dev=duel). */
export const TRAILER_SCENARIOS: Record<string, Scenario> = {
  trBoard: {
    desc: 'trailer: a readable turn on a busy board: a summon, the battle phase, Crystal Wyrm strikes Kite Fencer (LP drop)',
    stage: {
      zones: 5,
      turn: 7,
      p0: {
        lp: 2650,
        hand: ['reed_heron', 'judgment_bolt', 'ashen_drake', 'mirror_barrier', 'dawn_swords'],
        monsters: five('ember_wolf', 'crystal_wyrm', N, { id: 'shield_titan', position: 'defense' }, N),
        spellTraps: [N, { id: 'chains_of_light', faceUp: false }, N, { id: 'mirror_barrier', faceUp: false }, N],
        graveyard: ['stone_sentinel', 'storm_hawk', 'healing_spring'],
      },
      p1: {
        lp: 3100,
        monsters: five('kite_fencer', 'polar_sovereign', N, 'abyss_magus', { id: 'thorn_lurker', faceUp: false, position: 'defense' }),
        graveyard: ['magma_titan', 'volt_lizard'],
      },
    },
    steps: [
      { ui: 'wait', ms: 300 },
      (D) => ({ type: 'normalSummon', player: 0, uid: D.uid('reed_heron', 0), zone: 2, tributes: [] }),
      { ui: 'wait', ms: 200 },
      { type: 'enterBattle', player: 0 },
      { type: 'attack', player: 0, attackerZone: 1, targetZone: 0 },
    ],
  },
};
Object.assign(SCENARIOS, TRAILER_SCENARIOS);

/** The four text cards: a small kicker line over the big punch line. */
const CARDS: { kicker: string; main: string; mainSize: 'lg' | 'xl'; ramp: Ramp }[] = [
  { kicker: 'EVERY CARD', main: 'IS A SHOW', mainSize: 'xl', ramp: RAMPS.cyan },
  { kicker: '80 HAND-CRAFTED', main: 'CARDS', mainSize: 'xl', ramp: RAMPS.gold },
  { kicker: 'EVERY MONSTER:', main: 'ITS OWN SUMMON, STRIKE AND FALL', mainSize: 'lg', ramp: RAMPS.crim },
  { kicker: 'DUEL A FRIEND ON ONE SCREEN', main: 'OR THE CPU', mainSize: 'xl', ramp: RAMPS.mag },
];

/** The dispersion order of the prism glint (same order as the logo's prism pass). */
const SPECTRUM: readonly Ramp[] = [RAMPS.crim, RAMPS.fire, RAMPS.gold, RAMPS.leaf, RAMPS.cyan, RAMPS.water, RAMPS.void];

const HORIZON = 232;

/** A clock that starts when the loop is frozen (sync) and advances with the scene's delta. */
function cardClock(scene: Phaser.Scene, sync: boolean): { t: () => number } {
  let t = 0;
  let started = !sync;
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_: number, dt: number) => {
    if (!started && !scene.game.loop.running) started = true;
    if (started) t += dt;
  });
  return { t: () => t };
}

/** Synthwave floor + sky: redrawn every frame (the grid scrolls toward the camera, stars twinkle). */
function drawBackdrop(g: Phaser.GameObjects.Graphics, t: number, accent: Ramp): void {
  g.clear();
  g.fillStyle(PAL.night0, 1).fillRect(0, 0, 640, 360);
  // sky: stepped bands toward the horizon (no smooth gradient)
  const bands = [PAL.night0, PAL.night1, PAL.night1, PAL.night2, PAL.void0, PAL.void1];
  for (let i = 0; i < bands.length; i++) g.fillStyle(bands[i], 1).fillRect(0, HORIZON - 72 + i * 12, 640, 12);
  // stars (seeded), a few twinkling
  const r = mulberry32(77);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(r() * 640);
    const y = Math.floor(r() * (HORIZON - 70));
    const ph = r() * 6.28;
    const tw = Math.sin(t / 260 + ph);
    const c = tw > 0.75 ? PAL.white : tw > 0 ? PAL.steel : PAL.night3;
    g.fillStyle(c, 1).fillRect(x, y, 1, 1);
    if (tw > 0.93) {
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x, y - 1, 1, 3);
    }
  }
  // horizon glow: the accent ramp in hard rows
  g.fillStyle(accent[1], 1).fillRect(0, HORIZON - 3, 640, 2);
  g.fillStyle(accent[2], 1).fillRect(0, HORIZON - 1, 640, 1);
  g.fillStyle(accent[3], 1).fillRect(0, HORIZON, 640, 1);
  // floor
  g.fillStyle(PAL.ink, 1).fillRect(0, HORIZON + 1, 640, 360 - HORIZON - 1);
  // receding horizontal lines (z scrolls toward the viewer)
  const speed = t / 900;
  for (let k = 0; k < 12; k++) {
    const d = (k + (speed % 1)) / 11;
    const y = Math.round(HORIZON + 2 + (360 - HORIZON) * d * d);
    if (y <= HORIZON + 1 || y >= 360) continue;
    const near = (y - HORIZON) / (360 - HORIZON);
    g.fillStyle(near > 0.55 ? PAL.void3 : near > 0.25 ? PAL.void2 : PAL.void1, 1).fillRect(0, y, 640, 1);
  }
  // converging verticals, stepped per row
  for (let i = -12; i <= 12; i++) {
    const xb = 320 + i * 64;
    for (let y = HORIZON + 2; y < 360; y++) {
      const k = (y - HORIZON) / (360 - HORIZON);
      const x = Math.round(320 + (xb - 320) * k);
      if (x < 0 || x >= 640) continue;
      g.fillStyle(k > 0.6 ? PAL.void3 : k > 0.3 ? PAL.void2 : PAL.void1, 1).fillRect(x, y, 1, 1);
    }
  }
}

function textCard(scene: Phaser.Scene, idx: number, sync: boolean): void {
  const card = CARDS[Math.max(0, Math.min(CARDS.length - 1, idx))];
  const clock = cardClock(scene, sync);
  const bg = scene.add.graphics().setDepth(0);
  // light pool behind the words: stepped halo rectangles
  const halo = scene.add.graphics().setDepth(1);
  const k = pixelLetters(scene, 320, 128, card.kicker, { size: 'lg', align: 'center', originX: 0.5, originY: 0.5, color: card.ramp[3], shadow: 1 });
  const m = pixelLetters(scene, 320, 178, card.main, { size: card.mainSize, align: 'center', originX: 0.5, originY: 0.5, color: PAL.white, shadow: 1 });
  const all: PixelLetter[] = [...k.letters, ...m.letters];
  for (const L of all) L.obj.setDepth(5).setVisible(false);
  const left = Math.min(k.left, m.left) - 14;
  const right = Math.max(k.left + k.w, m.left + m.w) + 14;
  const top = k.top - 12;
  const bottom = m.top + m.h + 12;
  const deco = scene.add.graphics().setDepth(4);
  const sparks = scene.add.graphics().setDepth(6);
  const cueAt = new Set<string>();
  const once = (key: string, f: () => void) => {
    if (cueAt.has(key)) return;
    cueAt.add(key);
    f();
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
    const t = clock.t();
    drawBackdrop(bg, t, card.ramp);
    // halo grows in two steps
    halo.clear();
    const hs = t < 60 ? 0 : t < 140 ? 0.6 : 1;
    if (hs > 0) {
      // a full-width title band (hard 1-px accent edges), opening from its centre line
      const cy = Math.round((top + bottom) / 2);
      const h = Math.round(((bottom - top) / 2 + 10) * hs);
      halo.fillStyle(PAL.ink, 0.72).fillRect(0, cy - h, 640, h * 2);
      halo.fillStyle(PAL.night1, 0.8).fillRect(0, cy - h + 3, 640, h * 2 - 6);
      halo.fillStyle(card.ramp[1], 1).fillRect(0, cy - h, 640, 1).fillRect(0, cy + h - 1, 640, 1);
      halo.fillStyle(card.ramp[2], 1).fillRect(160, cy - h, 320, 1).fillRect(160, cy + h - 1, 320, 1);
    }
    // the letters drop in: kicker first, then the punch line; each lands white-hot then cools
    if (t > 0) once('whoosh', () => sfx.play('whoosh', { volume: 0.5, pitch: 1.25 }));
    all.forEach((L, i) => {
      const isMain = i >= k.letters.length;
      const t0 = 40 + (isMain ? 150 + (i - k.letters.length) * 14 : i * 16);
      const lt = t - t0;
      if (lt < 0) {
        L.obj.setVisible(false);
        return;
      }
      L.obj.setVisible(true);
      const drop = lt < 34 ? -8 : lt < 67 ? -3 : lt < 84 ? 1 : 0;
      L.obj.setPosition(L.x, L.y + drop);
      L.obj.setTint(lt < 50 ? card.ramp[4] : isMain ? PAL.white : card.ramp[3]);
    });
    if (t >= 190) once('slam', () => sfx.play('cardSlam', { volume: 0.55, pitch: 1.1 }));
    // prism glint: a diagonal spectrum band crosses every letter
    const gt = t - 620;
    if (gt >= 0 && gt < 640) {
      once('chime', () => sfx.play('holyChime', { volume: 0.22, pitch: 1.7, pan: -0.3 }));
      const bx = left - 40 + ((right - left + 80) * gt) / 640;
      for (const [i, L] of all.entries()) {
        const d = bx - (L.x - (L.y - 150) * 0.5);
        if (d < 0 || d > SPECTRUM.length * 9 + 6) continue;
        if (d < 6) L.obj.setTint(PAL.gold4);
        else L.obj.setTint(SPECTRUM[Math.min(SPECTRUM.length - 1, Math.floor((d - 6) / 9))][3]);
        void i;
      }
    }
    // frame: corner brackets fly out from the centre, a line opens under the punch line
    deco.clear();
    const o = Math.min(1, Math.max(0, (t - 110) / 170));
    const ease = 1 - (1 - o) * (1 - o);
    if (o > 0) {
      const cx = 320;
      const hw = Math.round(((right - left) / 2) * ease);
      const x0 = cx - hw;
      const x1 = cx + hw;
      const c1 = RAMPS.cyan[3];
      const c2 = RAMPS.crim[3];
      deco.fillStyle(c1, 1).fillRect(x0, top, 10, 2).fillRect(x0, top, 2, 8).fillRect(x0, bottom - 2, 10, 2).fillRect(x0, bottom - 8, 2, 8);
      deco.fillStyle(c2, 1).fillRect(x1 - 10, top, 10, 2).fillRect(x1 - 2, top, 2, 8).fillRect(x1 - 10, bottom - 2, 10, 2).fillRect(x1 - 2, bottom - 8, 2, 8);
      const lw = Math.round(((m.w + 8) / 2) * Math.min(1, Math.max(0, (t - 230) / 200)));
      if (lw > 0) {
        deco.fillStyle(card.ramp[2], 1).fillRect(cx - lw, bottom - 6, lw * 2, 1);
        deco.fillStyle(card.ramp[4], 1).fillRect(cx - Math.round(lw * 0.6), bottom - 6, Math.round(lw * 1.2), 1);
      }
    }
    // sparks off the line ends and the landing letters (seeded per 50 ms step)
    sparks.clear();
    const r = mulberry32(Math.floor(t / 50) + 9);
    if (t > 200) {
      for (let s = 0; s < 10; s++) {
        const L = all[Math.floor(r() * all.length)];
        const x = Math.round(L.x + (r() * 2 - 1) * 14);
        const y = Math.round(L.y + (r() * 2 - 1) * 12);
        sparks.fillStyle(r() < 0.5 ? card.ramp[4] : PAL.white, 1).fillRect(x, y, 1, 1);
      }
    }
  });
}

async function endCard(scene: Phaser.Scene, sync: boolean): Promise<void> {
  const mgr = scene.game.scene;
  if (!mgr.keys['Title']) mgr.add('Title', TitleScene, false);
  const data: TitleData = { at: 'attract', sync, dev: true };
  const ready = new Promise<void>((resolve) => scene.game.events.once('title:ready', () => resolve()));
  scene.scene.start('Title', data);
  await ready;
  const title = mgr.getScene('Title') as unknown as Phaser.Scene & {
    prompt: { hide(): void };
    logo: { prismSweep(ms?: number, volume?: number): void; flashAll(ms?: number, amount?: number): Promise<void>; glitch(p?: number): Promise<void> };
    screen: string;
  };
  // the call to action takes the prompt's place: no "click to start", no cut-in banners from the showcase
  const hold = () => {
    title.prompt.hide();
    title.screen = 'busy';
  };
  hold();
  title.events.on(Phaser.Scenes.Events.UPDATE, hold);
  const s = title;
  const depth = 3000;
  const plate = s.add.graphics().setDepth(depth).setScrollFactor(0).setVisible(false);
  const cta = pixelLetters(s, 320, 300, 'WISHLIST NOW ON STEAM', { size: 'lg', align: 'center', originX: 0.5, originY: 0.5, color: PAL.white, shadow: 1 });
  const soon = pixelText(s, 320, 334, 'COMING SOON', { size: 'md', align: 'center', originX: 0.5, originY: 0.5, color: PAL.gold4 });
  soon.setDepth(depth).setScrollFactor(0).setVisible(false);
  for (const L of cta.letters) L.obj.setDepth(depth + 1).setScrollFactor(0).setVisible(false);
  const pw = cta.w + 36;
  const ph = cta.h + 14;
  const px = Math.round(320 - pw / 2);
  const py = Math.round(300 - ph / 2);
  const drawPlate = (open: number, glint: number) => {
    plate.clear();
    const w = Math.max(4, Math.round(pw * open));
    const x = Math.round(320 - w / 2);
    plate.fillStyle(PAL.ink, 0.92).fillRect(x, py, w, ph);
    plate.fillStyle(PAL.gold3, 1).fillRect(x, py, w, 1).fillRect(x, py + ph - 1, w, 1).fillRect(x, py, 1, ph).fillRect(x + w - 1, py, 1, ph);
    plate.fillStyle(PAL.gold1, 1).fillRect(x + 2, py + 2, w - 4, 1).fillRect(x + 2, py + ph - 3, w - 4, 1);
    // cyan / crimson arrow tips (the players' colours), like the title prompt
    if (open >= 1) {
      plate.fillStyle(RAMPS.cyan[3], 1);
      for (let i = 0; i < 4; i++) plate.fillRect(px - 10 + i, py + ph / 2 - 3 + i, 1, 7 - i * 2);
      plate.fillStyle(RAMPS.crim[3], 1);
      for (let i = 0; i < 4; i++) plate.fillRect(px + pw + 9 - i, py + ph / 2 - 3 + i, 1, 7 - i * 2);
    }
    if (glint >= 0) {
      // a stepped diagonal glint crossing the plate
      const gx = x + Math.round((w + 40) * glint) - 20;
      for (let yy = 0; yy < ph - 4; yy++) {
        const xx = gx - Math.floor(yy / 2);
        if (xx > x + 1 && xx < x + w - 3) plate.fillStyle(PAL.gold4, 0.9).fillRect(xx, py + 2 + yy, 3, 1);
      }
    }
  };
  const w = window.__neon as Record<string, unknown>;
  /** The final hit: the plate snaps open, the words slam in, the logo flashes and the prism passes. */
  w.trailerHit = async () => {
    // the final hit: the game's victory sting (its held chord rings the trailer out) over a heavy impact
    sfx.play('victory', { volume: 0.75 });
    sfx.play('impactHeavy', { volume: 0.6, pitch: 0.8 });
    sfx.play('cardSlam', { volume: 0.8, pitch: 0.9 });
    sfx.play('summonBurst', { volume: 0.55 });
    sfx.play('holyChime', { volume: 0.25, pitch: 1.6, pan: -0.4 });
    void title.logo.flashAll(420, 1.8);
    title.logo.prismSweep(900, 0);
    plate.setVisible(true);
    const o = { v: 0 };
    await tween(s, { targets: o, v: 1, duration: 120, ease: 'Stepped', easeParams: [4], onUpdate: () => drawPlate(o.v, -1) });
    drawPlate(1, -1);
    cta.letters.forEach((L, i) => {
      void wait(s, i * 12).then(() => {
        L.obj.setVisible(true).setTint(PAL.gold4).setPosition(L.x, L.y - 4);
        void wait(s, 50).then(() => L.obj.setPosition(L.x, L.y).setTint(PAL.white));
      });
    });
    await wait(s, 380);
    soon.setVisible(true);
    const g = { v: 0 };
    void tween(s, { targets: g, v: 1, duration: 700, ease: 'Sine.InOut', onUpdate: () => drawPlate(1, g.v) }).then(() => drawPlate(1, -1));
  };
  /** The opening glint of the end card. */
  w.trailerGlint = () => {
    void title.logo.glitch(0.6);
    title.logo.prismSweep(900, 0.12);
  };
}

const preview: DevPreview = {
  name: 'trailer',
  description: 'Steam trailer cards: &card=0..3 (text cards) | &card=end (end card; __neon.trailerHit()) &sync=1',
  async create(scene, params) {
    if (params.get('s')) return duelPreview.create(scene, params);
    const card = params.get('card') ?? '0';
    const sync = params.get('sync') === '1';
    if (card === 'end') await endCard(scene, sync);
    else textCard(scene, Number(card), sync);
  },
};

export default preview;
