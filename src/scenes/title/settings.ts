// AYARLAR — animation speed, sound effects, music, hot-seat curtain. Every change is saved
// immediately (saveSettings) and audio changes apply at once.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { music, sfx } from '../../audio/sfx';
import { pixelText, upper } from '../../ui/text';
import { Button } from '../../view/Button';
import { UI_RAMP, panelTex, type UiStyle } from '../../view/ui-textures';
import { tween } from '../../vfx/core';
import { saveSettings, type Settings } from '../launch';
import { HEADER_H, OV_UI, Overlay, hitZone, keyHint } from './overlay';

/** Apply the audio part of the settings (title + anywhere else). */
export function applyAudioSettings(s: Settings, track: 'title' | 'duel' | null = 'title'): void {
  if ((s.sound || s.music) && sfx.isMuted()) sfx.setMuted(false);
  sfx.setVolume(s.sound ? 1 : 0);
  if (!s.music) music.stop(400);
  else if (track) music.play(track);
}

type RowKind = 'speed' | 'sound' | 'music' | 'curtain';

interface Chip {
  bg: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
  w: number;
  h: number;
}

interface Row {
  kind: RowKind;
  y: number;
  title: Phaser.GameObjects.BitmapText;
  sub: Phaser.GameObjects.BitmapText;
  chips: Chip[];
  zone: Phaser.GameObjects.Zone;
  /** Toggle rows: the knob. */
  knob?: Phaser.GameObjects.Image;
}

const ROW_H = 38;
const W = 400;
const H = 236;

export class SettingsOverlay extends Overlay {
  private readonly settings: Settings;
  private readonly rows: Row[] = [];
  private focus = 0;
  private focusBar!: Phaser.GameObjects.Rectangle;
  private ok: Button | null = null;
  /** Called after every change (the title applies music on/off). */
  onChange: ((s: Settings) => void) | null = null;

  constructor(scene: Phaser.Scene, settings: Settings) {
    super(scene, W, H, 'Ayarlar', 'neutral');
    this.settings = settings;
  }

  protected build(): void {
    const s = this.scene;
    this.focusBar = s.add.rectangle(6, 0, W - 12, ROW_H - 4, PAL.night3, 0.55).setOrigin(0);
    this.root.add(this.focusBar);
    const defs: { kind: RowKind; title: string; sub: string }[] = [
      { kind: 'speed', title: 'Animasyon hızı', sub: 'Düello animasyonları. Space basılıyken 3×.' },
      { kind: 'sound', title: 'Ses efektleri', sub: 'Kart, büyü ve darbe sesleri.' },
      { kind: 'music', title: 'Müzik', sub: 'Menü ve düello müziği.' },
      { kind: 'curtain', title: 'Sıra perdesi', sub: 'Aynı ekranda oynarken sıra geçişinde eli gizler.' },
    ];
    defs.forEach((d, i) => {
      const y = HEADER_H + 10 + i * ROW_H;
      const title = pixelText(s, 18, y + 5, upper(d.title), { size: 'md', color: PAL.white });
      const sub = pixelText(s, 18, y + 20, d.sub, { size: 'sm', color: PAL.steel, maxWidth: 250 });
      this.root.add([title, sub]);
      const zone = hitZone(s, this.px + 6, this.py + y, W - 12, ROW_H - 4);
      zone.setDepth(OV_UI - 1);
      this.own(zone);
      const row: Row = { kind: d.kind, y, title, sub, chips: [], zone };
      zone.on(Phaser.Input.Events.POINTER_OVER, () => this.setFocus(i, true));
      if (d.kind === 'speed') {
        ([1, 2, 3] as const).forEach((k, j) => {
          const chip = this.chip(W - 128 + j * 38, y + 8, 34, 18, `${k}×`);
          chip.zone.on(Phaser.Input.Events.POINTER_OVER, () => this.setFocus(i, true));
          chip.zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.change('speed', k));
          row.chips.push(chip);
        });
      } else {
        const chip = this.chip(W - 128, y + 8, 110, 18, '');
        chip.zone.on(Phaser.Input.Events.POINTER_OVER, () => this.setFocus(i, true));
        chip.zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.change(d.kind));
        row.chips.push(chip);
        row.knob = s.add.image(0, 0, panelTex(s, 'neutral', 14, 12, { chamfer: 2, scan: false })).setOrigin(0);
        this.root.add(row.knob);
      }
      this.rows.push(row);
    });
    this.root.add(pixelText(s, 18, H - 20, 'Ayarlar otomatik kaydedilir.', { size: 'sm', color: PAL.steel }));
    this.root.add(keyHint(s, 156, H - 15, '↑↓', 'Seç'));
    this.root.add(keyHint(s, 206, H - 15, '←→', 'Değiştir'));
    this.ok = new Button(s, this.px + W - 92, this.py + H - 30, { w: 80, h: 22, label: 'TAMAM', style: 'p1', depth: OV_UI + 5 });
    this.ok.setScrollFactor(0, 0, true);
    this.ok.onClick = () => void this.close();
    this.refresh(true);
    this.setFocus(0, false);
    // content entrance: rows slide in
    this.rows.forEach((r, i) => {
      for (const o of [r.title, r.sub]) {
        const x = o.x;
        o.x = x - 10;
        o.setAlpha(0);
        void tween(this.scene, { targets: o, x, alpha: 1, duration: 200, delay: i * 50, ease: 'Cubic.Out' });
      }
    });
  }

  private chip(x: number, y: number, w: number, h: number, text: string): Chip {
    const s = this.scene;
    const bg = s.add.image(x, y, panelTex(s, 'neutral', w, h, { chamfer: 2 })).setOrigin(0);
    const label = pixelText(s, x + w / 2, y + h / 2, text, { size: 'md', originX: 0.5, originY: 0.5, color: PAL.mist });
    this.root.add([bg, label]);
    const zone = hitZone(s, this.px + x, this.py + y, w, h);
    this.own(zone);
    return { bg, label, zone, w, h };
  }

  private chipStyle(c: Chip, style: UiStyle, on: boolean): void {
    c.bg.setTexture(panelTex(this.scene, on ? style : 'neutral', c.w, c.h, { chamfer: 2, dim: !on }));
    c.label.setTint(on ? PAL.white : PAL.steel);
  }

  private refresh(instant = false): void {
    const st = this.settings;
    for (const r of this.rows) {
      if (r.kind === 'speed') {
        r.chips.forEach((c, j) => this.chipStyle(c, 'gold', st.speed === j + 1));
        continue;
      }
      const on = r.kind === 'sound' ? st.sound : r.kind === 'music' ? st.music : st.curtain;
      const c = r.chips[0];
      this.chipStyle(c, on ? 'leaf' : 'stone', true);
      c.label.setText(on ? 'AÇIK' : 'KAPALI');
      c.label.setTint(on ? PAL.white : PAL.stone3);
      const kx = W - 128 + (on ? c.w - 18 : 4);
      c.label.x = W - 128 + (on ? (c.w - 18) / 2 : 18 + (c.w - 18) / 2);
      if (r.knob) {
        r.knob.y = r.y + 11;
        r.knob.setTexture(panelTex(this.scene, on ? 'leaf' : 'stone', 14, 12, { chamfer: 2, scan: false }));
        if (instant) r.knob.x = kx;
        else {
          this.scene.tweens.killTweensOf(r.knob);
          void tween(this.scene, { targets: r.knob, x: kx, duration: 140, ease: 'Back.Out' });
        }
      }
    }
  }

  private setFocus(i: number, sound: boolean): void {
    if (i === this.focus && this.focusBar.visible && this.focusBar.y === this.rows[i]?.y - 2) return;
    this.focus = i;
    const r = this.rows[i];
    if (!r) return;
    if (sound) sfx.play('uiHover', { volume: 0.45 });
    this.scene.tweens.killTweensOf(this.focusBar);
    void tween(this.scene, { targets: this.focusBar, y: r.y - 2, duration: 100, ease: 'Cubic.Out' });
    this.rows.forEach((row, k) => row.title.setTint(k === i ? UI_RAMP.gold[4] : PAL.white));
  }

  /** Change a row: toggles flip; speed takes an explicit value or cycles by `dir`. */
  private change(kind: RowKind, value?: 1 | 2 | 3, dir = 1): void {
    const st = this.settings;
    if (kind === 'speed') {
      const next = value ?? ((((st.speed - 1 + dir + 3) % 3) + 1) as 1 | 2 | 3);
      if (next === st.speed && value !== undefined) {
        sfx.play('uiClick', { volume: 0.5 });
        return;
      }
      st.speed = next;
    } else if (kind === 'sound') st.sound = !st.sound;
    else if (kind === 'music') st.music = !st.music;
    else st.curtain = !st.curtain;
    saveSettings(st);
    applyAudioSettings(st);
    this.onChange?.(st);
    if (kind !== 'sound' || st.sound) sfx.play(kind === 'speed' ? 'uiClick' : 'uiConfirm', { volume: 0.6, pitch: kind === 'speed' ? 0.8 + st.speed * 0.2 : 1 });
    this.refresh();
    const r = this.rows.find((x) => x.kind === kind);
    if (r) {
      const c = kind === 'speed' ? r.chips[st.speed - 1] : r.chips[0];
      c.bg.setTintFill(PAL.white);
      this.scene.time.delayedCall(60, () => c.bg.active && c.bg.clearTint());
    }
  }

  onKey(e: KeyboardEvent): boolean {
    const r = this.rows[this.focus];
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.setFocus((this.focus + this.rows.length - 1) % this.rows.length, true);
        return true;
      case 'ArrowDown':
      case 'KeyS':
        this.setFocus((this.focus + 1) % this.rows.length, true);
        return true;
      case 'ArrowLeft':
      case 'KeyA':
        if (r) this.change(r.kind, undefined, -1);
        return true;
      case 'ArrowRight':
      case 'KeyD':
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        if (r) this.change(r.kind, undefined, 1);
        return true;
      case 'Escape':
      case 'Backspace':
        void this.close();
        return true;
    }
    return false;
  }

  protected teardown(): void {
    this.ok?.destroy();
    this.ok = null;
  }
}
