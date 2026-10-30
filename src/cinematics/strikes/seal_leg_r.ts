// Sağ Bacak Mührü (seal_leg_r) — "Yükselen Basış" (rising stomp), v3 look only.
//
// The sprite's own 15-frame attack is the performance: the leg stays PLANTED while the knee rises, the
// foot lifts ~26 px and the runes charge down the shin (frames 1-5), holds at the apex (f6), then
// drops (f7) and slams (f8 = impact). This strike only adds what the sprite cannot draw: at the end of
// the apex hold the whole leg hops forward on a short arc so the slam lands in front of the target
// (or the duelist), then a seal-light shock ring, floor cracks, dust and rubble burst from the sole at
// the contact, and after the recovery the leg hops back to its tile. Without ?look=v3 this strike is
// never used (falls back to the default lunge, v1 films unchanged).

import { PAL } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { E, FloorMarks, RR, Sparks, TAU, animate, facing, lerp, norm, playSfx, seed, sleep, sub, whiteFlash } from '../strikes-a/_kit';
import { groundRing } from '../strikes-b/_kit';

const MAG = [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1] as const;
const DUST = [PAL.stone3, PAL.stone2, PAL.stone1] as const;
const MARK_DEPTH = DEPTH.CARD_ON_TILE + 2;

registerStrike('seal_leg_r', async (s: StrikeArgs) => {
  if (!LOOK_V3) return s.base?.();
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  seed(u.uid * 31 + (s.target?.uid ?? 7));
  const sgn = facing(u);
  const home: XY = { ...u.rest0 };
  // where the leg lands: in front of the target (a foot-length short of it), further out for a direct blow
  const dir = norm(sub(s.toGround, u.home));
  const inset = s.direct ? 34 : s.blocked ? 30 : 26;
  const land: XY = { x: Math.round(s.toGround.x - dir.x * inset), y: Math.round(s.toGround.y - dir.y * inset) };
  const apexMs = u.frameMs('attack', 6);
  const dropMs = u.frameMs('attack', 7);
  const leapMs = Math.round(dropMs + apexMs * 0.45);
  const lead = Math.max(0, u.impactMs - leapMs);
  const marks = new FloorMarks(sc, MARK_DEPTH);
  const set = (x: number, y: number) => {
    if (spr.active) spr.setPosition(Math.round(x), Math.round(y));
  };
  void u.play('attack');
  // 1. planted: the sprite's own wind-up (knee up, foot off the floor, runes charging down the shin)
  void sleep(sc, Math.max(0, lead - 260)).then(() => {
    // rune glow at the sole while it hangs
    void lightFlash(sc, u.framePoint(52, 70).x, u.worldPoint('feet').y, PAL.mag3, 26, 260, { intensity: 0.7 });
  });
  await sleep(sc, lead);
  // 2. the drop: hop forward along an arc, the sprite's f6 -> f7 pose carries the foot
  const hopH = 8;
  await animate(sc, leapMs, (t) => {
    const e = E.inQ(t);
    set(lerp(home.x, land.x, e), lerp(home.y, land.y, e) - Math.sin(Math.PI * Math.min(1, t * 1.15)) * hopH * (1 - t));
  });
  set(land.x, land.y + 2);
  // 3. SLAM
  const at: XY = { x: land.x + sgn * 4, y: land.y };
  s.impact({ x: s.to.x, y: s.to.y });
  playSfx('impactHeavy', { volume: 0.85, pitch: 0.55 });
  playSfx('earthQuake', { volume: 0.5, pitch: 1.2 });
  void shake(sc, 200, s.power >= 3 ? 3 : 2);
  void whiteFlash(sc, spr, 2);
  void lightFlash(sc, at.x, at.y, PAL.mag3, 44, 560, { ring: true, intensity: 1.1 });
  void groundRing(sc, at.x, at.y, { r0: 6, r1: 34, ms: 380, colors: [PAL.white, ...MAG], th: 2 });
  void groundRing(sc, at.x, at.y, { r0: 3, r1: 20, ms: 300, colors: [PAL.mag4, PAL.mag2, PAL.void2], depth: DEPTH.TILE_FX + 5 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + RR(-0.25, 0.25);
    marks.crack(at.x + Math.cos(a) * 3, at.y + Math.sin(a) * 1.5, a, RR(9, 17), 900, [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1]);
  }
  marks.blob(at.x, at.y + 1, 7, 700, [PAL.mag3, PAL.mag2, PAL.mag1, PAL.void2]);
  const sp = new Sparks(sc, DEPTH.FX - 2);
  for (let i = 0; i < 12; i++) {
    const a = RR(0, TAU);
    sp.add({ x: at.x + Math.cos(a) * RR(4, 14), y: at.y + Math.sin(a) * RR(1, 5), vx: Math.cos(a) * RR(14, 36), vy: RR(-26, -6), drag: 2, life: RR(380, 640), colors: DUST, shape: 'puff', size: RR(2, 3.5), grow: 5, alpha: 0.7 });
  }
  for (let i = 0; i < 9; i++) {
    sp.add({ x: at.x + RR(-10, 10), y: at.y + RR(-2, 2), vx: RR(-40, 40), vy: RR(-120, -60), ay: 440, life: RR(300, 480), colors: [PAL.stone3, PAL.stone2, PAL.mag3, PAL.stone1], shape: 'sq', size: 2, floor: at.y + RR(0, 4), bounce: 0.25 });
  }
  for (let i = 0; i < 6; i++) {
    sp.add({ x: at.x + RR(-6, 6), y: at.y - RR(2, 8), vx: RR(-20, 20), vy: RR(-70, -30), life: RR(260, 420), colors: [PAL.void4, PAL.mag4], shape: 'sq', size: 1, flicker: true });
  }
  sp.release();
  // 4. hold the slam through the sprite's push-off frames, then hop home
  await sleep(sc, Math.max(120, u.frameMs('attack', 8) + u.frameMs('attack', 9) + u.frameMs('attack', 10)));
  set(land.x, land.y);
  await animate(sc, 340, (t) => {
    const e = E.inOutQ(t);
    set(lerp(land.x, home.x, e), lerp(land.y, home.y, e) - Math.sin(Math.PI * t) * 5);
  });
  set(home.x, home.y);
  marks.close();
  if (!u.retired && u.frameInfo().anim !== 'attack') u.rest();
});
