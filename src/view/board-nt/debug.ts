// ?ntdebug=1 overlay: outlines every region of layout-nt.ts (platform footprint, pads, wall, tower,
// emblem, screens, holograms + plinths, stands) and the HUD keep-out rects (dashed grey) over the
// game, with short labels. Dev / QA only (NT_DEBUG > 0); drawn at NT_DEPTH.debug, destroyed with the view.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { pixelText } from '../../ui/text';
import { KEEP_OUT, NT_DEPTH, PLATE_OUTLINE, ntIso, ntRegions } from './layout-nt';

export function drawNtDebug(scene: Phaser.Scene, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
  const g = add(scene.add.graphics().setDepth(NT_DEPTH.debug));
  // the platform top outline (grid → screen), pads included
  g.lineStyle(1, PAL.gold3, 1);
  g.beginPath();
  PLATE_OUTLINE.forEach(([c, r], i) => {
    const s = ntIso(c, r);
    if (i === 0) g.moveTo(Math.round(s.x) + 0.5, Math.round(s.y) + 0.5);
    else g.lineTo(Math.round(s.x) + 0.5, Math.round(s.y) + 0.5);
  });
  g.closePath();
  g.strokePath();
  for (const r of Object.values(KEEP_OUT)) {
    g.lineStyle(1, PAL.steel, 0.7);
    g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  for (const reg of ntRegions()) {
    g.lineStyle(1, reg.color, 1);
    g.strokeRect(reg.rect.x + 0.5, reg.rect.y + 0.5, reg.rect.w - 1, reg.rect.h - 1);
    add(pixelText(scene, reg.rect.x + 2, reg.rect.y + 2, reg.name, { size: 'sm', color: reg.color }).setDepth(NT_DEPTH.debug));
  }
}
