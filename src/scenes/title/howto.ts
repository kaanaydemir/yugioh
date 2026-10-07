// NASIL OYNANIR — a paged rules summary (GAME_DESIGN §2) with a live illustration per page,
// played with the real game VFX: LP and winning, the turn's phases, tribute summoning, the
// battle maths (three worked examples), spells & traps, and the controls.

import Phaser from 'phaser';
import type { Attribute, CardId, MonsterId } from '../../data/cards';
import { cardIsoKey, ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W } from '../../art/cards';
import { monsterArt } from '../../art/monsters';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas, mix } from '../../art/pixel';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import { sfx, type SfxName } from '../../audio/sfx';
import type { PlayerId } from '../../engine/types';
import { pixelText, upper } from '../../ui/text';
import { Button } from '../../view/Button';
import { CardSprite } from '../../view/CardSprite';
import { DEPTH, unitDepth } from '../../view/layout';
import { ICON, UI_RAMP, haloTex, panelTex, type UiStyle } from '../../view/ui-textures';
import { safe, tween, tweenValue, wait } from '../../vfx/core';
import {
  attackArrow,
  beam,
  blockClang,
  dive,
  framePointToWorld,
  impact,
  lightning,
  lockOn,
  lunge,
  skyBolt,
  xSlash,
} from '../../vfx/combat';
import { dematerialize, materialize } from '../../vfx/hologram';
import { damageNumber } from '../../vfx/numbers';
import { shatter } from '../../vfx/shatter';
import { attributeSummon, sparkleBurst, tributeStream } from '../../vfx/summon';
import { TICON } from './icons';
import { HEADER_H, OV_FLOOR, OV_UI, Overlay, hitZone } from './overlay';

const W = 600;
const H = 320;
/** Text column (panel-local). */
const TX = 16;
const TW = 268;
/** Illustration area (panel-local). */
const AX = 300;
const AY = HEADER_H + 6;
const AW = 288;
const AH = 254;

class Abort extends Error {}

// ---------------------------------------------------------------- pages

interface Page {
  title: string;
  lines: string[];
  run(st: Stage): Promise<void>;
}

/** Iso floor tile (1×, 64×32 + 3px side) in a player's colours. */
function tileTex(scene: Phaser.Scene, R: Ramp): string {
  const key = `title:tile:${R[3].toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const hw = 31;
  const hh = 15;
  const w = hw * 2 + 2;
  const h = hh * 2 + 6;
  const p = new PixelCanvas(w, h);
  const cx = hw + 0.5;
  const cy = hh + 0.5;
  const inTop = (x: number, y: number) => Math.abs(x + 0.5 - cx) / hw + Math.abs(y + 0.5 - cy) / hh <= 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (inTop(x, y)) {
        const edge = !inTop(x - 1, y) || !inTop(x + 1, y) || !inTop(x, y - 1) || !inTop(x, y + 1);
        const d = Math.abs(x + 0.5 - cx) / hw + Math.abs(y + 0.5 - cy) / hh;
        let c: number = PixelCanvas.ditherAt(x, y, Math.round((1 - d) * 9)) ? PAL.night2 : PAL.night1;
        if (edge) c = y < cy ? R[3] : R[2];
        else if (d > 0.74 && d < 0.8) c = mix(R[1], PAL.night1, 0.35);
        p.set(x, y, c);
      } else {
        for (let k = 1; k <= 3; k++)
          if (inTop(x, y - k) && y - k >= cy) {
            p.set(x, y, k === 3 ? PAL.ink : x < cx ? mix(R[0], PAL.night1, 0.5) : PAL.night0);
            if (k === 1) p.set(x, y, x < cx ? R[1] : mix(R[1], PAL.night0, 0.5));
            break;
          }
      }
    }
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

/** Per-page illustration context: tracks objects, aborts cleanly when the page changes. */
class Stage {
  readonly objs: Phaser.GameObjects.GameObject[] = [];
  constructor(
    readonly scene: Phaser.Scene,
    private readonly alive: () => boolean,
    /** Screen origin of the illustration area. */
    readonly ox: number,
    readonly oy: number,
  ) {}

  /** Area-local → screen. */
  at(x: number, y: number): { x: number; y: number } {
    return { x: Math.round(this.ox + x), y: Math.round(this.oy + y) };
  }

  check(): void {
    if (!this.alive()) throw new Abort();
  }

  async wait(ms: number): Promise<void> {
    await wait(this.scene, ms);
    this.check();
  }

  async all(ps: Promise<unknown>[]): Promise<void> {
    await Promise.all(ps.map((p) => safe(p)));
    this.check();
  }

  add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  sfx(name: SfxName, volume = 0.5, pitch = 1): void {
    if (this.alive()) sfx.play(name, { volume, pitch });
  }

  tile(x: number, y: number, player: PlayerId | 'gold'): Phaser.GameObjects.Image {
    const R = player === 'gold' ? RAMPS.gold : player === 0 ? RAMPS.cyan : RAMPS.crim;
    const p = this.at(x, y);
    return this.add(this.scene.add.image(p.x, p.y, tileTex(this.scene, R)).setOrigin(32 / 64, 16 / 36).setDepth(OV_FLOOR));
  }

  monster(id: MonsterId, x: number, y: number, player: PlayerId, visible = false): Phaser.GameObjects.Sprite {
    const art = monsterArt(id);
    const p = this.at(x, y);
    const flip = player === 1;
    const spr = this.scene.add.sprite(p.x, p.y - art.hover, monsterTextureKey(id), monsterFrameName('idle', 0));
    spr.setOrigin((flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h).setFlipX(flip).setDepth(unitDepth(p.y)).setVisible(visible);
    spr.play(monsterAnimKey(id, 'idle'));
    return this.add(spr);
  }

  core(spr: Phaser.GameObjects.Sprite, id: MonsterId): { x: number; y: number } {
    const art = monsterArt(id);
    return framePointToWorld(spr, art.core.x, art.core.y);
  }

  /** World-layer label (above the FX). */
  label(x: number, y: number, s: string, color: number, size: 'sm' | 'md' | 'lg' = 'sm'): Phaser.GameObjects.BitmapText {
    const p = this.at(x, y);
    return this.add(pixelText(this.scene, p.x, p.y, s, { size, originX: 0.5, originY: 0.5, color, align: 'center' }).setDepth(DEPTH.FX_TOP + 60));
  }

  chip(x: number, y: number, w: number, h: number, style: UiStyle, dim = false): Phaser.GameObjects.Image {
    const p = this.at(x, y);
    return this.add(this.scene.add.image(p.x, p.y, panelTex(this.scene, style, w, h, { chamfer: 2, dim })).setDepth(DEPTH.FX_TOP + 55));
  }

  async appear(spr: Phaser.GameObjects.Sprite, attribute: Attribute, ms = 420): Promise<void> {
    this.sfx('materialize', 0.3);
    await safe(materialize(this.scene, spr, { attribute, ms }));
    this.check();
  }

  async vanish(spr: Phaser.GameObjects.Sprite, attribute: Attribute, ms = 360): Promise<void> {
    if (!spr.visible) return;
    await safe(dematerialize(this.scene, spr, ms, { attribute }));
    this.check();
  }

  destroy(): void {
    for (const o of this.objs) if (o.active) o.destroy();
    this.objs.length = 0;
  }
}


/** An LP panel drawn in the world layer (above the FX), with a rolling counter. */
function lpPanel(st: Stage, x: number, y: number, player: PlayerId, lp: number) {
  const s = st.scene;
  const p = st.at(x, y);
  const bg = st.add(s.add.image(p.x, p.y, panelTex(s, player === 0 ? 'p1' : 'p2', 92, 32, { header: 11 })).setDepth(DEPTH.FX_TOP + 40));
  const name = st.add(pixelText(s, p.x - 41, p.y - 10, upper(`Oyuncu ${player + 1}`), { size: 'sm', originY: 0.5, color: PAL.white }).setDepth(DEPTH.FX_TOP + 41));
  const val = st.add(pixelText(s, p.x - 41, p.y + 6, `LP ${lp}`, { size: 'md', originY: 0.5, color: PAL.gold4 }).setDepth(DEPTH.FX_TOP + 41));
  const items = [bg, name, val];
  let cur = lp;
  return {
    x: p.x,
    y: p.y,
    get lp() {
      return cur;
    },
    set(v: number) {
      cur = v;
      val.setText(`LP ${v}`);
    },
    async roll(to: number, ms = 520): Promise<void> {
      const from = cur;
      let last = -1;
      val.setTint(to < from ? PAL.crim3 : PAL.leaf3);
      await tweenValue(s, from, to, ms, (v) => {
        const n = Math.round(v / 10) * 10;
        if (n !== last) {
          last = n;
          cur = n;
          val.setText(`LP ${n}`);
          if (n % 200 === 0) sfx.play('lpTick', { volume: 0.25 });
        }
      }, 'Cubic.Out');
      cur = to;
      val.setText(`LP ${to}`).setTint(PAL.gold4);
    },
    jolt(): void {
      const x0 = p.x;
      void tweenValue(s, 0, 1, 260, (t) => {
        const dx = Math.round(Math.sin(t * Math.PI * 7) * 3 * (1 - t));
        bg.x = x0 + dx;
        name.x = x0 - 41 + dx;
        val.x = x0 - 41 + dx;
      });
      bg.setTintFill(PAL.white);
      s.time.delayedCall(60, () => bg.active && bg.clearTint());
    },
    items,
  };
}

function pop(st: Stage, t: Phaser.GameObjects.BitmapText, scale = 1): Promise<void> {
  t.setScale(scale * 2.2).setAlpha(0);
  return tween(st.scene, { targets: t, scale, alpha: 1, duration: 220, ease: 'Back.Out' });
}

const PAGES: Page[] = [
  // ------------------------------------------------------------ 1. goal
  {
    title: 'Amaç',
    lines: [
      'Her oyuncu 4000 LP ile başlar. Rakibinin LP\'sini 0\'a indiren düelloyu kazanır.',
      'Deste 20 karttır: 12 canavar, 5 büyü ve 3 tuzak. İki oyuncu da aynı kartları karıştırılmış olarak oynar.',
      'Başlangıç elin 4 kart. Kart çekmen gerekirken desten boşsa kaybedersin.',
      'Teslim olan oyuncu kaybeder.',
    ],
    async run(st) {
      const s = st.scene;
      st.tile(78, 214, 0);
      const wyrm = st.monster('crystal_wyrm', 78, 214, 0);
      const lp = lpPanel(st, 214, 60, 1, 4000);
      const win = st.label(144, 132, 'KAZANAN: OYUNCU 1', PAL.gold3, 'lg').setAlpha(0);
      await st.appear(wyrm, 'LIGHT', 520);
      for (;;) {
        lp.set(4000);
        win.setAlpha(0);
        await st.wait(500);
        for (const to of [1200, 0]) {
          const art = monsterArt('crystal_wyrm');
          wyrm.play(monsterAnimKey('crystal_wyrm', 'attack'));
          wyrm.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => wyrm.active && wyrm.play(monsterAnimKey('crystal_wyrm', 'idle')));
          st.sfx('beamCharge', 0.35);
          await st.wait((art.attackImpactFrame / art.anims.attack.fps) * 1000 - 60);
          const m = framePointToWorld(wyrm, art.muzzle.x, art.muzzle.y);
          await st.all([
            beam(s, m, { x: lp.x - 20, y: lp.y }, 'prism', {
              chargeMs: 60,
              fireMs: 360,
              width: 9,
              onImpact: () => {
                void impact(s, lp.x - 20, lp.y, { power: 2, noStop: true });
                void damageNumber(s, lp.x, lp.y - 26, 2800, 'damage', { size: 2 });
                lp.jolt();
                void lp.roll(to);
              },
            }),
          ]);
          await st.wait(700);
        }
        st.sfx('holyChime', 0.5);
        void sparkleBurst(s, st.at(144, 132).x, st.at(144, 132).y, { ramp: RAMPS.gold, count: 22, depth: DEPTH.FX_TOP + 50 });
        await pop(st, win);
        await st.wait(1800);
        await tween(s, { targets: win, alpha: 0, duration: 200 });
        st.check();
        await lp.roll(4000, 700);
        st.check();
      }
    },
  },

  // ------------------------------------------------------------ 2. turn flow
  {
    title: 'Tur Akışı',
    lines: [
      'Her tur dört aşamadan geçer: Çekme → Ana → Savaş → Bitiş.',
      'Çekme: destenden 1 kart çekersin.',
      'Ana: canavar çağırır, kart koyar, büyü açarsın.',
      'Savaş: saldırı pozisyonundaki canavarlarınla saldırırsın.',
      'Bitiş: elinde en fazla 6 kart kalır, sıra rakibe geçer.',
      'İlk oyuncu ilk turda kart çekmez ve saldıramaz.',
    ],
    async run(st) {
      const s = st.scene;
      const phases = ['ÇEKME', 'ANA', 'SAVAŞ', 'BİTİŞ'];
      const chips = phases.map((_, i) => st.chip(36 + i * 72, 18, 66, 18, 'neutral', true));
      const labels = phases.map((p, i) => st.label(36 + i * 72, 18, p, PAL.steel, 'md'));
      const marker = st.add(s.add.image(0, 0, ICON.caret).setAngle(90).setTint(PAL.gold3).setDepth(DEPTH.FX_TOP + 60));
      const setPhase = (i: number) => {
        phases.forEach((_, k) => {
          const on = k === i;
          chips[k].setTexture(panelTex(s, on ? (k === 2 ? 'p2' : 'gold') : 'neutral', 66, 18, { chamfer: 2, dim: !on }));
          labels[k].setTint(on ? PAL.white : PAL.steel);
        });
        const p = st.at(36 + i * 72, 6);
        s.tweens.killTweensOf(marker);
        void tween(s, { targets: marker, x: p.x, y: p.y - 2, duration: 180, ease: 'Back.Out' });
        st.sfx('phaseChange', 0.35);
      };
      const mp = st.at(36, 6);
      marker.setPosition(mp.x, mp.y);
      const deckP = st.at(40, 136);
      st.add(new CardSprite(s, deckP.x, deckP.y, null).setDepth(DEPTH.FX + 10));
      for (let k = 1; k <= 3; k++) st.add(s.add.image(deckP.x + k, deckP.y + k, 'card:back').setDepth(DEPTH.FX + 10 - k));
      st.tile(156, 168, 0);
      st.tile(240, 126, 1);
      const enemy = st.monster('stone_sentinel', 240, 126, 1, true);
      enemy.play(monsterAnimKey('stone_sentinel', 'guard'));
      const red = st.add(s.add.rectangle(st.ox + AW / 2, st.oy + AH / 2 + 14, AW, AH - 28, PAL.crim1, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.FX - 5).setAlpha(0));
      const note = st.label(144, 236, '', PAL.mist, 'sm');
      for (;;) {
        // ÇEKME
        setPhase(0);
        note.setText('Destenden 1 kart çek');
        await st.wait(300);
        const handP = st.at(236, 200);
        const card = st.add(new CardSprite(s, deckP.x, deckP.y, 'ember_wolf', { faceUp: false }).setDepth(DEPTH.FX + 20));
        st.sfx('cardDraw', 0.5);
        await st.all([card.flyTo(handP.x, handP.y, { ms: 420, arc: 40, reveal: true })]);
        await st.wait(700);
        // ANA
        setPhase(1);
        note.setText('Canavar çağır, kart koy, büyü aç');
        await st.wait(350);
        const tileP = st.at(156, 168);
        st.sfx('cardSlide', 0.4);
        await st.all([card.flyTo(tileP.x, tileP.y - 6, { ms: 340, arc: 30, scale: 0.5 })]);
        st.sfx('cardSlam', 0.4);
        card.destroy();
        const wolf = st.monster('ember_wolf', 156, 168, 0);
        await st.all([
          attributeSummon(s, {
            x: tileP.x,
            y: tileP.y,
            attribute: 'FIRE',
            player: 0,
            sprite: wolf,
            monsterId: 'ember_wolf',
            onBeat: (b) => {
              if (b === 'pillar') st.sfx('summonBurst', 0.3);
              if (b === 'roar') st.sfx('roarSmall', 0.3);
            },
          }),
        ]);
        await st.wait(400);
        // SAVAŞ
        setPhase(2);
        note.setText('Saldırı pozisyonundaki canavarlarla saldır');
        void tween(s, { targets: red, alpha: { from: 0.35, to: 0 }, duration: 700, ease: 'Quad.Out' });
        st.sfx('attackDeclare', 0.4);
        await st.wait(400);
        const target = st.at(240, 126);
        const tc = st.core(enemy, 'stone_sentinel');
        await st.all([
          lunge(s, wolf, target, {
            onImpact: () => {
              void blockClang(s, tc.x - 8, tc.y + 4, { from: tileP, color: PAL.crim3 });
              st.sfx('shieldBlock', 0.4);
            },
          }),
        ]);
        await st.wait(500);
        // BİTİŞ
        setPhase(3);
        note.setText('Sıra rakibe geçer');
        await st.wait(1300);
        await st.vanish(wolf, 'FIRE');
        wolf.destroy();
      }
    },
  },

  // ------------------------------------------------------------ 3. summoning
  {
    title: 'Çağırma ve Kurbanlar',
    lines: [
      'Ana Aşamada turda 1 kez Normal Çağırma ya da Kapalı Koyma yapabilirsin.',
      'Seviye 1–4: kurbansız. Seviye 5–6: 1 kurban. Seviye 7 ve üzeri: 2 kurban.',
      'Kurban verilen canavarlar mezarlığa gider; as kartlar sahaya dev bir sinematikle gelir!',
      'Kapalı konan canavarı sonraki bir turda çevirerek açabilirsin.',
      'Pozisyon değiştirme turda 1 kez (yeni gelen ya da saldıran canavar hariç).',
    ],
    async run(st) {
      const s = st.scene;
      const L = { x: 64, y: 150 };
      const R = { x: 224, y: 150 };
      const C = { x: 144, y: 196 };
      st.tile(L.x, L.y, 0);
      st.tile(R.x, R.y, 0);
      st.tile(C.x, C.y, 'gold');
      const cap = st.label(144, 22, '★7 KRİSTAL EJDER  =  2 KURBAN', PAL.gold4, 'md');
      const capL = st.label(L.x, L.y + 22, '★2', PAL.mist, 'sm');
      const capR = st.label(R.x, R.y + 22, '★3', PAL.mist, 'sm');
      cap.setAlpha(0);
      for (;;) {
        const a = st.monster('lumen_sprite', L.x, L.y, 0);
        const b = st.monster('storm_hawk', R.x, R.y, 0);
        capL.setAlpha(1);
        capR.setAlpha(1);
        await st.all([st.appear(a, 'LIGHT'), st.appear(b, 'WIND')]);
        await st.wait(500);
        await pop(st, cap);
        st.sfx('tribute', 0.45);
        await st.wait(300);
        capL.setAlpha(0);
        capR.setAlpha(0);
        const to = st.at(C.x, C.y);
        await st.all([tributeStream(s, a, to, { attribute: 'LIGHT' }), tributeStream(s, b, to, { attribute: 'WIND' })]);
        const wyrm = st.monster('crystal_wyrm', C.x, C.y, 0);
        await st.all([
          attributeSummon(s, {
            x: to.x,
            y: to.y,
            attribute: 'LIGHT',
            player: 0,
            sprite: wyrm,
            monsterId: 'crystal_wyrm',
            big: true,
            onBeat: (bt) => {
              if (bt === 'circle') st.sfx('summonCharge', 0.35);
              if (bt === 'pillar') st.sfx('summonBurst', 0.4);
              if (bt === 'roar') st.sfx('roarBig', 0.4);
              if (bt === 'impact') st.sfx('impactHeavy', 0.35);
            },
          }),
        ]);
        await st.wait(1500);
        void tween(s, { targets: cap, alpha: 0, duration: 200 });
        await st.vanish(wyrm, 'LIGHT', 420);
        a.destroy();
        b.destroy();
        wyrm.destroy();
        await st.wait(300);
      }
    },
  },

  // ------------------------------------------------------------ 4. battle maths
  {
    title: 'Savaş Hesabı',
    lines: [
      'Saldırı – Saldırı: yüksek ATK kazanır. Düşük olan yok olur, fark sahibine hasar olarak gider. Eşitse ikisi de yok olur.',
      'Saldırı – Savunma: ATK > DEF ise savunan yok olur, hasar olmaz. ATK < DEF ise saldıran oyuncu farkı hasar olarak alır.',
      'Rakibin canavarı yoksa doğrudan saldırırsın.',
      'Kapalı savunmadaki canavar saldırıya uğrayınca açılır.',
    ],
    async run(st) {
      const s = st.scene;
      const P1 = { x: 76, y: 186 };
      const P2 = { x: 212, y: 118 };
      st.tile(P1.x, P1.y, 0);
      st.tile(P2.x, P2.y, 1);
      const title = st.label(144, 14, '', PAL.gold4, 'md');
      const cap1 = st.label(144, 226, '', PAL.white, 'sm');
      const cap2 = st.label(144, 238, '', PAL.mist, 'sm');
      const badge = (x: number, y: number, s1: string, color: number) => st.label(x, y, s1, color, 'sm');
      const declare = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
        const a = attackArrow(s, st.at(from.x, from.y - 14), st.at(to.x, to.y - 14), 0);
        const l = lockOn(s, st.at(to.x, to.y - 16).x, st.at(to.x, to.y - 16).y, { size: 24 });
        st.sfx('attackDeclare', 0.4);
        await st.wait(520);
        a.destroy();
        l.destroy();
      };
      for (;;) {
        // A — attack vs attack
        title.setText('SALDIRI – SALDIRI');
        cap1.setText('');
        cap2.setText('');
        let atk = st.monster('shade_assassin', P1.x, P1.y, 0);
        let def = st.monster('ember_wolf', P2.x, P2.y, 1);
        const b1 = badge(P1.x - 34, P1.y + 14, 'ATK 1900', PAL.cyan3);
        const b2 = badge(P2.x + 34, P2.y + 14, 'ATK 1700', PAL.crim3);
        await st.all([st.appear(atk, 'DARK'), st.appear(def, 'FIRE')]);
        await declare(P1, P2);
        const dc = st.core(def, 'ember_wolf');
        await st.all([
          lunge(s, atk, st.at(P2.x - 4, P2.y + 2), {
            trail: PAL.void3,
            onImpact: () => {
              void xSlash(s, dc.x, dc.y, { ramp: RAMPS.void });
              void impact(s, dc.x, dc.y, { power: 2, sprite: def, ramp: RAMPS.void });
              s.time.delayedCall(180, () => {
                if (!st.objs.includes(def)) return;
                void damageNumber(s, st.at(P2.x, P2.y - 40).x, st.at(P2.x, P2.y - 40).y, 200, 'damage', { size: 2 });
                st.sfx('lpDown', 0.4);
                cap1.setText('1900 > 1700  →  Kor Kurdu yok olur');
                cap2.setText('Oyuncu 2 farkı hasar olarak alır: −200 LP');
              });
            },
          }),
          st.wait(260).then(async () => {
            await safe(shatter(s, def, { monsterId: 'ember_wolf', attribute: 'FIRE', push: { x: 1, y: -0.5 } }));
          }),
        ]);
        b2.setAlpha(0.3);
        await st.wait(2000);
        await st.vanish(atk, 'DARK');
        atk.destroy();
        def.destroy();
        b1.destroy();
        b2.destroy();

        // B — attack vs defence
        title.setText('SALDIRI – SAVUNMA');
        cap1.setText('');
        cap2.setText('');
        atk = st.monster('ember_wolf', P1.x, P1.y, 0);
        def = st.monster('tide_golem', P2.x, P2.y, 1);
        def.play(monsterAnimKey('tide_golem', 'guard'));
        const c1 = badge(P1.x - 34, P1.y + 14, 'ATK 1700', PAL.cyan3);
        const c2 = badge(P2.x + 34, P2.y + 14, 'DEF 2000', PAL.water3);
        await st.all([st.appear(atk, 'FIRE'), st.appear(def, 'WATER')]);
        def.play(monsterAnimKey('tide_golem', 'guard'));
        await declare(P1, P2);
        const gc = st.core(def, 'tide_golem');
        await st.all([
          lunge(s, atk, st.at(P2.x - 4, P2.y + 2), {
            onImpact: () => {
              void blockClang(s, gc.x - 10, gc.y + 6, { from: st.at(P1.x, P1.y - 14), color: PAL.water3 });
              st.sfx('shieldBlock', 0.45);
              s.time.delayedCall(260, () => {
                if (!st.objs.includes(atk)) return;
                void damageNumber(s, st.at(P1.x, P1.y - 44).x, st.at(P1.x, P1.y - 44).y, 300, 'damage', { size: 2 });
                st.sfx('lpDown', 0.4);
                cap1.setText('1700 < 2000  →  kimse yok olmaz');
                cap2.setText('Saldıran oyuncu farkı hasar olarak alır: −300 LP');
              });
            },
          }),
        ]);
        await st.wait(2000);
        await st.all([st.vanish(atk, 'FIRE'), st.vanish(def, 'WATER')]);
        atk.destroy();
        def.destroy();
        c1.destroy();
        c2.destroy();

        // C — direct attack
        title.setText('DOĞRUDAN SALDIRI');
        cap1.setText('');
        cap2.setText('');
        atk = st.monster('storm_hawk', P1.x, P1.y, 0);
        const d1 = badge(P1.x - 34, P1.y + 14, 'ATK 1000', PAL.cyan3);
        await st.appear(atk, 'WIND');
        const lp = lpPanel(st, 220, 54, 1, 4000);
        await st.wait(300);
        const hit = st.at(P2.x + 6, P2.y - 30);
        await st.all([
          dive(s, atk, hit, {
            ramp: RAMPS.leaf,
            onImpact: () => {
              void impact(s, hit.x, hit.y, { power: 2, ramp: RAMPS.leaf, noStop: true });
              void damageNumber(s, lp.x, lp.y - 26, 1000, 'damage', { size: 2 });
              lp.jolt();
              void lp.roll(3000);
            },
          }),
        ]);
        cap1.setText('Rakipte canavar yok: doğrudan saldırı!');
        cap2.setText('ATK kadar hasar: −1000 LP');
        await st.wait(2000);
        await st.vanish(atk, 'WIND');
        atk.destroy();
        d1.destroy();
        for (const o of lp.items) o.destroy();
      }
    },
  },

  // ------------------------------------------------------------ 5. spells & traps
  {
    title: 'Büyüler ve Tuzaklar',
    lines: [
      'Büyüleri Ana Aşamada elden ya da sahadan açarsın (koyduğun tur bile).',
      'Tuzaklar kapalı konur ve koyulduğu tur açılamaz.',
      'Tuzak, rakibin hamlesine yanıt olarak açılır: saldırı ilanı (Ayna Kalkanı, Işık Zincirleri) ya da ATK ≥ 1000 bir canavarın çağrılması (Yer Yarığı).',
      'Pencere açılınca "Aç" ya da "Geç" seçersin.',
    ],
    async run(st) {
      const s = st.scene;
      const P1 = { x: 70, y: 190 };
      const P2 = { x: 180, y: 112 };
      const ST = { x: 226, y: 170 };
      st.tile(P1.x, P1.y, 0);
      st.tile(P2.x, P2.y, 1);
      st.tile(ST.x, ST.y, 1);
      const title = st.label(144, 14, '', PAL.mag3, 'md');
      const cap = st.label(144, 236, '', PAL.mist, 'sm');
      const stp = st.at(ST.x, ST.y);
      const setCard = st.add(
        s.add
          .image(stp.x, stp.y, cardIsoKey('back', 'up', 1))
          .setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H)
          .setDepth(DEPTH.CARD_ON_TILE),
      );
      for (;;) {
        // ---- trap
        title.setText('TUZAK: AYNA KALKANI').setTint(PAL.mag3);
        cap.setText('Kapalı tuzak, rakip saldırı ilan edince açılır');
        setCard.setVisible(true);
        const titan = st.monster('magma_titan', P1.x, P1.y, 0);
        await st.appear(titan, 'FIRE');
        await st.wait(300);
        const a = attackArrow(s, st.at(P1.x, P1.y - 20), st.at(P2.x, P2.y - 10), 0);
        st.sfx('attackDeclare', 0.4);
        await st.wait(520);
        // the trap springs: the set card stands up and flips
        setCard.setVisible(false);
        const card = st.add(new CardSprite(s, stp.x, stp.y - 4, null).setDepth(DEPTH.FX + 30).setScale(0.6));
        card.setCard('mirror_barrier');
        card.setFaceUp(false);
        st.sfx('trapActivate', 0.5);
        await st.all([tween(s, { targets: card, y: stp.y - 52, scale: 1, duration: 260, ease: 'Back.Out' })]);
        await st.all([card.flip(true, 240)]);
        card.pulse(PAL.mag3, 320);
        const tz = st.label(stp.x - st.ox, stp.y - st.oy - 100, 'TUZAK!', PAL.mag3, 'lg');
        void pop(st, tz);
        await st.wait(380);
        a.destroy();
        const tc = st.core(titan, 'magma_titan');
        st.sfx('mirror', 0.45);
        await st.all([
          lightning(s, { x: card.x, y: card.y }, tc, {
            ramp: RAMPS.mag,
            ms: 360,
            flash: 0.15,
            onImpact: () => void impact(s, tc.x, tc.y, { power: 2, ramp: RAMPS.mag, sprite: titan, noStop: true }),
          }),
        ]);
        await safe(shatter(s, titan, { monsterId: 'magma_titan', attribute: 'FIRE', push: { x: -1, y: 0.4 } }));
        st.check();
        cap.setText('Saldıran canavarlar yansıyan ışınla yok olur');
        await st.wait(900);
        await st.all([card.dissolve(500)]);
        card.destroy();
        tz.destroy();
        titan.destroy();
        await st.wait(300);

        // ---- spell
        title.setText('BÜYÜ: YILDIRIM HÜKMÜ').setTint(PAL.teal3);
        cap.setText('Büyü kartı açılır, etkisi hemen çözülür');
        setCard.setVisible(false);
        const foe = st.monster('shade_assassin', P2.x, P2.y, 1);
        await st.appear(foe, 'DARK');
        const sp = st.at(96, 112);
        const spell = st.add(new CardSprite(s, sp.x, sp.y + 30, 'judgment_bolt').setDepth(DEPTH.FX + 30).setAlpha(0));
        const aura = st.add(s.add.image(sp.x, sp.y, haloTex(s, 12)).setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.teal3).setDisplaySize(110, 110).setDepth(DEPTH.FX + 29).setAlpha(0));
        st.sfx('spellActivate', 0.5);
        await st.all([tween(s, { targets: spell, y: sp.y, alpha: 1, duration: 300, ease: 'Back.Out' }), tween(s, { targets: aura, alpha: 0.8, duration: 300 })]);
        spell.pulse(PAL.teal4, 300);
        await st.wait(600);
        const fc = st.core(foe, 'shade_assassin');
        void tween(s, { targets: [spell, aura], alpha: 0, duration: 260 });
        st.sfx('lightning', 0.45);
        await st.all([
          skyBolt(s, fc.x, st.at(P2.x, P2.y).y - 2, {
            onImpact: () => void impact(s, fc.x, fc.y, { power: 2, sprite: foe, noStop: true }),
          }),
        ]);
        await safe(shatter(s, foe, { monsterId: 'shade_assassin', attribute: 'DARK' }));
        st.check();
        cap.setText('Rakibin 1 canavarı yok edilir');
        await st.wait(1400);
        spell.destroy();
        aura.destroy();
        foe.destroy();
      }
    },
  },

  // ------------------------------------------------------------ 6. controls
  {
    title: 'Kontroller',
    lines: [
      'Elindeki ya da sahadaki bir karta tıkla: yapabileceğin eylemler açılır.',
      'Bir kartın üstüne gel: ayrıntıları kart panelinde gör.',
      'Space ya da basılı tutulan tıklama animasyonları 3× hızlandırır.',
      'Aynı ekranda oynarken sıra perdesi elini rakibinden gizler (Ayarlar).',
      'İpucu: as kartlar (★) sahaya özel bir sinematikle gelir!',
    ],
    async run(st) {
      const s = st.scene;
      const ids: CardId[] = ['lumen_sprite', 'judgment_bolt', 'stone_sentinel', 'mirror_barrier'];
      const hand = ids.map((id, i) => {
        const p = st.at(84 + i * 40, 214);
        const c = st.add(new CardSprite(s, p.x, p.y, id).setDepth(DEPTH.FX + 20 + i));
        c.setAngle((i - 1.5) * 4);
        return c;
      });
      const T = { x: 144, y: 96 };
      st.tile(T.x, T.y, 0);
      const ptr = st.add(s.add.image(0, 0, ICON.pointer).setOrigin(0.2, 0).setDepth(DEPTH.FX_TOP + 70));
      const menuBg = st.add(s.add.image(0, 0, panelTex(s, 'neutral', 70, 34, { chamfer: 2 })).setOrigin(0).setDepth(DEPTH.FX_TOP + 62).setVisible(false));
      const m1 = st.add(pixelText(s, 0, 0, 'ÇAĞIR', { size: 'sm', color: PAL.white }).setDepth(DEPTH.FX_TOP + 63).setVisible(false));
      const m2 = st.add(pixelText(s, 0, 0, 'KAPALI KOY', { size: 'sm', color: PAL.mist }).setDepth(DEPTH.FX_TOP + 63).setVisible(false));
      const hl = st.add(s.add.rectangle(0, 0, 66, 11, PAL.cyan1, 1).setOrigin(0).setDepth(DEPTH.FX_TOP + 62.5).setVisible(false));
      const space = st.chip(232, 30, 54, 16, 'neutral', true);
      const spaceT = st.label(232, 30, 'SPACE', PAL.steel, 'sm');
      const speedT = st.label(232, 48, '3× HIZ', PAL.gold3, 'md').setAlpha(0);
      const move = (x: number, y: number, ms = 360) => tween(s, { targets: ptr, x, y, duration: ms, ease: 'Sine.InOut' });
      for (;;) {
        hand.forEach((c, i) => {
          const p = st.at(84 + i * 40, 214);
          c.setPosition(p.x, p.y).setVisible(true).setScale(1).setAlpha(1).setAngle((i - 1.5) * 4);
        });
        const start = st.at(250, 240);
        ptr.setPosition(start.x, start.y);
        await st.wait(300);
        for (const i of [3, 1, 0]) {
          await st.all([move(hand[i].x + 4, hand[i].y - 10)]);
          st.sfx('uiHover', 0.35);
          await st.all([hand[i].hoverLift(true)]);
          await st.wait(380);
          if (i !== 0) void hand[i].hoverLift(false);
        }
        // click → action menu
        st.sfx('uiClick', 0.5);
        const c0 = hand[0];
        menuBg.setPosition(c0.x + 18, c0.y - 70).setVisible(true);
        m1.setPosition(menuBg.x + 6, menuBg.y + 6).setVisible(true);
        m2.setPosition(menuBg.x + 6, menuBg.y + 19).setVisible(true);
        hl.setPosition(menuBg.x + 2, menuBg.y + 4).setVisible(true);
        await st.all([move(menuBg.x + 30, menuBg.y + 10, 300)]);
        st.sfx('uiConfirm', 0.5);
        await st.wait(200);
        menuBg.setVisible(false);
        m1.setVisible(false);
        m2.setVisible(false);
        hl.setVisible(false);
        // the card flies to the tile and the fairy appears
        const tp = st.at(T.x, T.y);
        void move(start.x, start.y, 500);
        st.sfx('cardSlide', 0.4);
        await st.all([c0.flyTo(tp.x, tp.y - 6, { ms: 360, arc: 40, scale: 0.5 })]);
        c0.setVisible(false);
        const fairy = st.monster('lumen_sprite', T.x, T.y, 0);
        await st.all([
          attributeSummon(s, {
            x: tp.x,
            y: tp.y,
            attribute: 'LIGHT',
            player: 0,
            sprite: fairy,
            monsterId: 'lumen_sprite',
            onBeat: (b) => b === 'roar' && st.sfx('roarSmall', 0.3, 1.4),
          }),
        ]);
        // hold space → 3×
        space.setTexture(panelTex(s, 'gold', 54, 16, { chamfer: 2 }));
        spaceT.setTint(PAL.white);
        st.sfx('uiClick', 0.4);
        void pop(st, speedT);
        await st.wait(1400);
        space.setTexture(panelTex(s, 'neutral', 54, 16, { chamfer: 2, dim: true }));
        spaceT.setTint(PAL.steel);
        void tween(s, { targets: speedT, alpha: 0, duration: 200 });
        await st.vanish(fairy, 'LIGHT');
        fairy.destroy();
        void hand[1].hoverLift(false);
      }
    },
  },
];

// ---------------------------------------------------------------- overlay

export class HowToOverlay extends Overlay {
  private page = 0;
  private gen = 0;
  private stage: Stage | null = null;
  private content!: Phaser.GameObjects.Container;
  private dots: Phaser.GameObjects.Image[] = [];
  private pageT!: Phaser.GameObjects.BitmapText;
  private prev: Button | null = null;
  private next: Button | null = null;
  private areaFrame!: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, page = 0) {
    super(scene, W, H, 'Nasıl Oynanır', 'spell');
    this.page = Math.max(0, Math.min(PAGES.length - 1, page));
  }

  protected build(): void {
    const s = this.scene;
    // the illustration well sits at panel level (the illustration itself is in the world layer)
    this.areaFrame = this.own(
      s.add
        .image(this.px + AX - 4, this.py + AY - 2, panelTex(s, 'spell', AW + 8, AH + 6, { alpha: 120, dim: true, scan: false }))
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(OV_FLOOR - 0.5),
    );
    this.content = s.add.container(0, 0);
    this.root.add(this.content);

    // footer: ◀ dots ▶
    const fy = H - 22;
    this.prev = new Button(s, this.px + 16, this.py + fy, { w: 28, h: 18, icon: TICON.left, style: 'spell', depth: OV_UI + 5 });
    this.next = new Button(s, this.px + 16 + 28 + 6 + PAGES.length * 10 + 6, this.py + fy, { w: 28, h: 18, icon: TICON.right, style: 'spell', depth: OV_UI + 5 });
    for (const b of [this.prev, this.next]) b.setScrollFactor(0, 0, true);
    this.prev.onClick = () => this.go(this.page - 1);
    this.next.onClick = () => this.go(this.page + 1);
    PAGES.forEach((_, i) => {
      const d = s.add.image(16 + 28 + 6 + i * 10 + 4, fy + 8, panelTex(s, 'spell', 7, 7, { chamfer: 1, scan: false }));
      this.root.add(d);
      this.dots.push(d);
      const z = this.own(hitZone(s, this.px + d.x - 5, this.py + d.y - 6, 10, 12));
      z.on(Phaser.Input.Events.POINTER_OVER, () => sfx.play('uiHover', { volume: 0.35 }));
      z.on(Phaser.Input.Events.POINTER_DOWN, () => this.go(i));
    });
    this.pageT = pixelText(s, 16 + 28 + 6 + PAGES.length * 10 + 6 + 28 + 8, fy + 8, '', { size: 'sm', originY: 0.5, color: PAL.steel });
    this.root.add(this.pageT);
    this.root.add(pixelText(s, TX + TW, fy + 8, '←→ SAYFA', { size: 'sm', originX: 1, originY: 0.5, color: PAL.night4 }));
    this.show(this.page, 0);
  }

  private go(i: number): void {
    if (i < 0 || i >= PAGES.length || i === this.page) {
      sfx.play('uiError', { volume: 0.35 });
      return;
    }
    const dir = i > this.page ? 1 : -1;
    this.page = i;
    sfx.play('cardFlip', { volume: 0.5, pitch: 1.1 });
    this.show(i, dir);
  }

  private show(i: number, dir: number): void {
    const s = this.scene;
    const page = PAGES[i];
    // stop the old illustration
    this.gen++;
    this.stage?.destroy();
    // text
    this.content.removeAll(true);
    const R = UI_RAMP.spell;
    const num = pixelText(s, TX, AY + 2, `${i + 1}`, { size: 'lg', color: R[3] });
    const title = pixelText(s, TX + 22, AY + 8, upper(page.title), { size: 'md', color: PAL.white });
    title.setTint(R[4], R[4], PAL.white, PAL.white);
    const rule = s.add.rectangle(TX, AY + 26, TW, 1, R[1]).setOrigin(0);
    this.content.add([num, title, rule]);
    let y = AY + 34;
    page.lines.forEach((line, k) => {
      const bullet = s.add.image(TX + 2, y + 6, ICON.caret).setTint(R[3]).setOrigin(0, 0.5);
      const t = pixelText(s, TX + 10, y, line, { size: 'sm', color: PAL.white, maxWidth: TW - 10 });
      this.content.add([bullet, t]);
      if (dir !== 0) {
        for (const o of [bullet, t]) {
          const x = o.x;
          o.x = x + dir * 14;
          o.setAlpha(0);
          void tween(s, { targets: o, x, alpha: 1, duration: 200, delay: 40 + k * 35, ease: 'Cubic.Out' });
        }
      }
      y += t.height + 5;
    });
    if (dir !== 0) {
      for (const o of [num, title]) {
        const x = o.x;
        o.x = x + dir * 10;
        o.setAlpha(0);
        void tween(s, { targets: o, x, alpha: 1, duration: 180, ease: 'Cubic.Out' });
      }
    }
    // footer
    this.dots.forEach((d, k) => {
      d.setTexture(panelTex(s, k === i ? 'gold' : 'spell', 7, 7, { chamfer: 1, scan: false, dim: k !== i }));
      d.setScale(k === i ? 1.3 : 1);
    });
    this.pageT.setText(`${i + 1} / ${PAGES.length}`);
    this.prev?.setEnabled(i > 0);
    this.next?.setEnabled(i < PAGES.length - 1);
    // illustration
    const gen = this.gen;
    const st = new Stage(s, () => gen === this.gen && this.open_, this.px + AX, this.py + AY);
    this.stage = st;
    void page.run(st).catch((e) => {
      if (!(e instanceof Abort)) console.error('[howto]', e);
    });
  }

  onKey(e: KeyboardEvent): boolean {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
      case 'PageUp':
        this.go(this.page - 1);
        return true;
      case 'ArrowRight':
      case 'KeyD':
      case 'PageDown':
      case 'Space':
      case 'Enter':
      case 'NumpadEnter':
        if (this.page < PAGES.length - 1 || e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'PageDown') this.go(this.page + 1);
        else void this.close();
        return true;
      case 'Escape':
      case 'Backspace':
        void this.close();
        return true;
    }
    return false;
  }

  protected teardown(): void {
    this.gen++;
    this.stage?.destroy();
    this.stage = null;
    this.prev?.destroy();
    this.next?.destroy();
    this.prev = null;
    this.next = null;
  }
}

export const HOWTO_PAGES = PAGES.length;
