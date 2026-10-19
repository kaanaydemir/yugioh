// Kristal Ejder — "Prizma İnişi" (signature summon entrance).
//
//   0     the big gold circle draws on; a PRISM SHAFT of light stabs down from the sky onto the
//         tile (white core, crystal-cyan body, red→violet spectral fringes, light flowing down,
//         crystal glints drifting inside)
//   ~260  the shaft hits the floor: rainbow rings pool on the floor, chime
//   ~380  climax → ace tribute summons: the full-screen cut-in ("KRİSTAL EJDER!")
//   then  the dragon DESCENDS through the shaft wrapped in its crystal wings (guard pose), built
//         bottom → top as a crystal hologram with a riding scan bar
//   +340  it lands: squash, cyan dust, floor ring; the roar starts on its crouch (roar f1–2)
//   peak  roar f3 — wings burst open: the shaft explodes into a RAINBOW FLARE (spectral lens
//         streak + ghost hexes), rainbow floor rings, crystal shards, white flash, hit-stop,
//         4 px shake, ATK/DEF badge pop
// Budget: special summon ≈ 1.1 s; with the tribute + cut-in ≈ 3.7 s.

import { PAL, PLAYER_COLOR, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { TEX, shake } from '../../vfx/core';
import { STEX, landingDust, shockwave } from '../../vfx/summon';
import { clearHologram, holoRamp, setHologram } from '../../vfx/hologram';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { framePose } from '../../art/monsters-v3/crystal_wyrm-anims';
import { headFrame, rig } from '../../art/monsters-v3/crystal_wyrm-rig';
import { registerCardHook } from '../api';
import { atMark, fade as fadeV3, panAt, play as playV3 } from '../_v3/sound';
import {
  ADD,
  E,
  RAINBOW,
  R,
  RR,
  Raster,
  Sparks,
  bg,
  bodyBox,
  clamp,
  fs,
  holdFrame,
  holo,
  isoRing,
  lerp,
  lightBeam,
  lightFlash,
  onFrame,
  playSfx,
  run,
  scanBar,
  settleHolo,
  signatureSummon,
  untilFrame,
  type Stage,
} from './_kit';

/** Crystal hologram palette: night-steel → cyan → white (the wyrm is glass and light). */
const CRYSTAL: Ramp = [PAL.night2, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4];

interface Shaft {
  /** Stab down from the sky to the floor. */
  descend(ms: number): Promise<void>;
  /** Width multiplier (1 = full, 0 = thread). */
  width(k: number, ms: number): Promise<void>;
  /** Fade to a dither level (0 = gone). */
  fade(ms: number, to?: number): Promise<void>;
  destroy(): void;
}

function prismShaft(S: Stage, o: { hw?: number; glintDepth?: number } = {}): Shaft {
  const sc = S.scene;
  const { x, y } = S.home;
  const W = 96;
  const top = Math.min(-40, y - 320);
  const H = Math.ceil(y - top) + 24;
  const r = new Raster(sc, x - W / 2, top, W, H, S.depth - 1);
  const PW = fs(96);
  const PH = fs(36);
  const pool = new Raster(sc, x - PW / 2, y - PH / 2, PW, PH, DEPTH.CARD_ON_TILE + 2, ADD);
  // (v2) the shaft's soft glow (behind the dragon) and the white-cyan pool it pours on the marble
  const beam = lightBeam(sc, { x, y: top }, { x, y: top }, PAL.cyan4, 0, { width: 18, depth: S.depth - 1.5, intensity: 0.9, shimmer: 0.35 });
  const foot = S.glow({ color: PAL.cyan4, radius: fs(30), intensity: 0, anim: 'shimmer', fadeIn: 0, air: 0.35, airRadius: 18 });
  const st = { tip: top, wk: 1, fade: 1, t: 0, landed: 0 };
  const hw0 = o.hw ?? (S.big ? 12 : 9);
  const glints = new Sparks(sc, o.glintDepth ?? S.depth + 0.5, ADD);
  let alive = true;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    st.t += dt;
    const tip = Math.round(st.tip);
    const f = st.fade;
    r.draw((g) => {
      if (f <= 0.02) return;
      const hw = Math.max(0.5, hw0 * st.wk);
      for (let yy = top; yy <= tip; yy++) {
        // the column flares a little at the foot and breathes
        const foot = st.landed > 0 && yy > y - 10 ? ((yy - (y - 10)) / 10) * 4 * st.wk : 0;
        const h = hw + foot + Math.sin(yy * 0.09 - st.t * 0.02) * 0.6 * st.wk;
        const flow = ((yy - st.t * 0.22) % 16 + 16) % 16 < 1.2;
        for (let dx = -Math.ceil(h) - 3; dx <= Math.ceil(h) + 3; dx++) {
          const ax = Math.abs(dx + 0.5);
          let c: number | null = null;
          let lv = f;
          if (ax <= Math.max(0.6, h * 0.22)) c = PAL.white;
          else if (ax <= h * 0.6) c = flow ? PAL.white : PAL.cyan4;
          else if (ax <= h) c = flow ? PAL.cyan4 : PAL.cyan3;
          else {
            // spectral fringes: red side on the left, violet side on the right
            const k = Math.ceil(ax - h);
            const side = dx < 0 ? [PAL.gold4, PAL.fire3, PAL.crim3] : [PAL.leaf3, PAL.cyan3, PAL.void3];
            c = side[clamp(k - 1, 0, 2)];
            lv = f * (k === 1 ? 0.85 : k === 2 ? 0.6 : 0.35);
          }
          if (c !== null) g.dpx(x + dx, yy, c, lv);
        }
      }
      if (st.landed <= 0 && tip > top) {
        // the stabbing tip: a white star
        g.rect(x - 1, tip - 1, 3, 3, PAL.white);
        g.line(x - 6, tip, x + 6, tip, PAL.cyan4);
        g.line(x, tip - 8, x, tip + 4, PAL.white);
      }
    });
    pool.draw((g) => {
      if (st.landed <= 0 || f <= 0.02) return;
      const k = st.landed;
      const pulse = Math.sin(st.t * 0.02) * 1.2;
      g.ell(x, y, 9 * k * st.wk + 2, (9 * k * st.wk + 2) / 2, PAL.white, f);
      for (let i = 0; i < RAINBOW.length; i++) {
        const rad = fs(12 + i * 3) * k + pulse * (i % 2 ? 1 : -1);
        isoRing(g, x, y, rad, RAINBOW[i], f * (i < 3 ? 0.9 : 0.6));
      }
    });
    // crystal glints drifting down inside the shaft
    if (dt > 0 && st.fade > 0.5 && tip > top + 20 && R() < dt / 30) {
      const gx = x + RR(-hw0, hw0) * st.wk;
      glints.add({ x: gx, y: RR(Math.max(top, y - 170), Math.min(tip, y - 10)), vy: RR(18, 46), life: RR(260, 520), ramp: [PAL.white, PAL.cyan4, PAL.cyan3], tex: R() < 0.3 ? TEX.plus : TEX.px1, flicker: true });
    }
    return true;
  });
  const light = (): void => {
    if (!beam.alive) return;
    const k = st.fade * (0.35 + 0.65 * st.wk);
    beam.setEnds({ x, y: top }, { x, y: Math.round(st.tip) }).setIntensity(0.9 * k);
    foot.setIntensity(1.15 * st.landed * k);
  };
  return {
    async descend(ms) {
      await run(sc, ms, (t) => {
        st.tip = lerp(top, y, E.inQuad(t));
        light();
      });
      st.tip = y;
      void lightFlash(sc, x, y - 6, PAL.white, fs(34), 300, { floorY: y, intensity: 0.9 });
      bg(run(sc, 160, (t) => ((st.landed = E.outCubic(t)), light())));
    },
    width: (k, ms) => {
      const a = st.wk;
      return run(sc, ms, (t) => ((st.wk = lerp(a, k, E.outCubic(t))), light()));
    },
    fade: (ms, to = 0) => {
      const a = st.fade;
      return run(sc, ms, (t) => ((st.fade = lerp(a, to, t)), light()));
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      r.destroy();
      pool.destroy();
      glints.close();
      void beam.fadeOut(120);
      void foot.fadeOut(160);
    },
  };
}

/** The roar-peak payoff: a spectral lens streak with ghost hexes, rainbow floor rings, shards. */
function rainbowFlare(S: Stage, at: XY, o: { ghosts?: boolean; len?: number; spin?: number } = {}): void {
  const sc = S.scene;
  const X = Math.round(at.x);
  const Y = Math.round(at.y);
  const L = o.len ?? (S.big ? 130 : 80);
  const g = sc.add.graphics().setDepth(DEPTH.FX + 8);
  // ghost hexes along the line from the flare through the screen centre
  const cx = 320 - X;
  const cy = 180 - Y;
  const ghosts = [0.45, 0.8, 1.15, 1.5, 1.85].map((k, i) =>
    sc.add
      .image(Math.round(X + cx * k), Math.round(Y + cy * k), i % 2 ? STEX.hex7 : STEX.hex11)
      .setTint(RAINBOW[(i * 2) % RAINBOW.length])
      .setBlendMode(ADD)
      .setDepth(DEPTH.FX + 7)
      .setVisible(false),
  );
  bg(
    run(sc, 380, (t) => {
      const env = t < 0.1 ? E.outCubic(t / 0.1) : 1 - E.inQuad((t - 0.1) / 0.9);
      const l = Math.round(L * env);
      g.clear();
      if (l > 0) {
        g.fillStyle(PAL.white, 1).fillRect(X - l, Y, l * 2 + 1, 1);
        // spectral bands above and below the core streak
        for (let i = 0; i < 3; i++) {
          const li = Math.round(l * (0.7 - i * 0.18));
          if (li <= 0) continue;
          g.fillStyle(RAINBOW[2 - i], 1).fillRect(X - li, Y - 1 - i, li * 2 + 1, 1);
          g.fillStyle(RAINBOW[3 + i], 1).fillRect(X - li, Y + 1 + i, li * 2 + 1, 1);
        }
        const v = Math.round(l * 0.35);
        g.fillStyle(PAL.white, 1).fillRect(X, Y - v, 1, v * 2 + 1);
        if (env > 0.5) g.fillStyle(PAL.white, 1).fillRect(X - 2, Y - 2, 5, 5);
        const d = Math.round(l * 0.12);
        for (let i = 1; i <= d; i++) g.fillStyle(PAL.cyan4, 1).fillRect(X + i, Y - i, 1, 1).fillRect(X - i, Y + i, 1, 1).fillRect(X + i, Y + i, 1, 1).fillRect(X - i, Y - i, 1, 1);
      }
      ghosts.forEach((gh, i) => gh.setVisible(o.ghosts !== false && env > 0.2 && Math.floor(t * 20 + i) % 4 !== 0));
    }).then(() => {
      g.destroy();
      ghosts.forEach((gh) => gh.destroy());
    }),
  );
  // rainbow floor rings (each band a spectral colour), two waves
  const R1 = fs(S.big ? 100 : 64);
  const RW = Math.max(110, R1 + 10);
  const ras = new Raster(sc, S.home.x - RW, S.home.y - Math.ceil(RW / 2) - 1, RW * 2, Math.ceil(RW / 2) * 2 + 2, DEPTH.TILE_FX + 3);
  // the wings bursting open throw a white flash of prism light over the marble
  void lightFlash(sc, X, Y, PAL.white, Math.round(R1 * 0.55), 520, { floorY: S.home.y, intensity: 0.9 });
  bg(
    run(sc, 560, (t) => {
      ras.draw((rr) => {
        for (let w = 0; w < 2; w++) {
          const tt = clamp((t - w * 0.18) / 0.82, 0, 1);
          if (tt <= 0 || tt >= 1) continue;
          const rad = 8 + (R1 - 8) * E.outCubic(tt) * (w ? 0.75 : 1);
          const lv = tt < 0.5 ? 1 : 1 - (tt - 0.5) / 0.5;
          for (let i = 0; i < RAINBOW.length; i++) isoRing(rr, S.home.x, S.home.y, rad - i * 1.5, RAINBOW[i], lv * (i === 0 ? 1 : 0.85));
          isoRing(rr, S.home.x, S.home.y, rad + 1, PAL.white, lv);
        }
      });
    }).then(() => ras.destroy()),
  );
  // crystal shards burst out of the light and fall
  const sh = new Sparks(sc, DEPTH.FX + 6, ADD);
  for (let i = 0; i < (S.big ? 34 : 18); i++) {
    const a = RR(Math.PI * 1.05, Math.PI * 1.95);
    const v = RR(80, 200);
    sh.add({ x: X + RR(-6, 6), y: Y + RR(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 420, drag: 1.2, life: RR(420, 760), ramp: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], tex: i % 3 === 0 ? TEX.plus : i % 3 === 1 ? TEX.px2 : TEX.px1, spin: o.spin ?? 9 });
  }
  sh.close();
}

// ================================================================ v3 (?look=v3): the entrance on the summon pose
//
// "Prizma İnişi" in the new look, on the art's own `summon` pose (src/art/monsters-v3; 15 f /
// 1.32 s: wrapped in its wings it drops onto the tile, lands in a crouch, unfurls, folds back,
// shakes out). The prism shaft is kept but the BODY is readable from the start: the shaft is
// narrow and stands behind the sprite, and the body forms inside it while the drop already plays
// (crystal hologram ≤ 300 ms, true colours from there on):
//   0      the circle opens, the narrow prism shaft stabs down onto the tile (70 ms, chime)
//   0–280  the wrapped body builds bottom → top in the light while it drops (summon f0–3)
//   land   f4: the feet strike — dust, the rainbow rings pool, the shaft pinches out
//   spread f7: the wings burst open — the prism read on the floor (rainbow ring waves, prism light
//          on the marble), shards from behind the body, a 2-step glint on the horn tip; nothing
//          is drawn across the body from the land to the reveal (no lens streak)
//   cut-in f8 (an ace's tribute summon): the band-only cut-in on the spread hold; the fold-back
//          and shake-out play on under it, the finale (ring, light, badge) lands as it leaves
// suWyrm: the summon starts ≈ 1.17 s in (after the tribute stream) → true colours ≈ 1.45 s, the
// whole summon ≤ 3.0 s. No sprite scaling, no full-screen flash.

/** Summon pose beats of the v3 art (src/art/monsters-v3/crystal_wyrm-anims.ts SUMMON). */
const SPREAD_F = 7;
const CUT_F = 8;

/**
 * v3 reveal on the wings' spread frame. The prism read lives on the FLOOR only — two waves of
 * rainbow rings out of the feet and the white prism light on the marble (its air bloom stays
 * behind the body) — and nothing crosses the silhouette: no lens streak, no ghost hexes, no star
 * over the chest (A2 art review r3: the horizontal rainbow streak was a camera lens-flare trope
 * that cut the dragon in half on its hero frame). The one mark on the body is a 2-step 4-point
 * glint on the horn tip (9 px → 5 px, 40 + 40 ms = the spread frame's 80 ms hold); the crystal
 * shards are flung from BEHIND the body, so they only show once they clear its outline.
 */
function prismRevealV3(S: Stage): void {
  const sc = S.scene;
  const u = S.unit;
  const b = bodyBox(u);
  const X = Math.round((b.left + b.right) / 2);
  const Y = Math.round(lerp(b.top, b.bottom, 0.42));
  const R1 = fs(S.big ? 100 : 64);
  // the wings bursting open throw prism light on the marble (floor pool + a bloom behind the body)
  void lightFlash(sc, X, Y, PAL.white, Math.round(R1 * 0.55), 520, { floorY: S.home.y, intensity: 0.9 });
  // rainbow floor rings (each band a spectral colour), two waves out of the feet
  const RW = Math.max(110, R1 + 10);
  const ras = new Raster(sc, S.home.x - RW, S.home.y - Math.ceil(RW / 2) - 1, RW * 2, Math.ceil(RW / 2) * 2 + 2, DEPTH.TILE_FX + 3);
  bg(
    run(sc, 560, (t) => {
      ras.draw((rr) => {
        for (let w = 0; w < 2; w++) {
          const tt = clamp((t - w * 0.18) / 0.82, 0, 1);
          if (tt <= 0 || tt >= 1) continue;
          const rad = 8 + (R1 - 8) * E.outCubic(tt) * (w ? 0.75 : 1);
          const lv = tt < 0.5 ? 1 : 1 - (tt - 0.5) / 0.5;
          for (let i = 0; i < RAINBOW.length; i++) isoRing(rr, S.home.x, S.home.y, rad - i * 1.5, RAINBOW[i], lv * (i === 0 ? 1 : 0.85));
          isoRing(rr, S.home.x, S.home.y, rad + 1, PAL.white, lv);
        }
      });
    }).then(() => ras.destroy()),
  );
  // crystal shards thrown off by the wings: launched from behind the chest, under the sprite
  const sh = new Sparks(sc, S.depth - 0.5, ADD);
  for (let i = 0; i < (S.big ? 26 : 16); i++) {
    const a = RR(Math.PI * 1.05, Math.PI * 1.95);
    const v = RR(110, 210);
    sh.add({ x: X + RR(-6, 6), y: Y + RR(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 420, drag: 1.2, life: RR(460, 780), ramp: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], tex: i % 3 === 0 ? TEX.plus : i % 3 === 1 ? TEX.px2 : TEX.px1, spin: 0 });
  }
  sh.close();
  hornGlint(S);
}

/**
 * A crisp 4-point glint on the horn tip of the frame on screen: arms of 4 px (white, white,
 * cyan4, cyan3 → 9 px across) for 40 ms, then 2 px (white, cyan4 → 5 px) for 40 ms, then gone.
 * The tip is the end of the main horn's tube in the v3 rig (crystal_wyrm-rig.ts drawHead: the
 * gold sweep bezier ends at T(-16.2, -12)); it matches the drawn tip pixel to ≤ 1 px on f6–f9.
 */
function hornGlint(S: Stage): void {
  const u = S.unit;
  const fi = u.frameInfo();
  if (fi.anim !== 'summon' || !u.sprite.active) return;
  const P = framePose('summon', fi.frame);
  const { T } = headFrame(rig(P).head, P);
  const tip = T(-16.2, -12);
  const w = u.framePoint(Math.floor(tip[0]) + 0.5, Math.floor(tip[1]) + 0.5);
  const x = Math.floor(w.x);
  const y = Math.floor(w.y);
  const g = S.own(S.scene.add.graphics().setDepth(DEPTH.FX + 8));
  const arm = (cols: number[]): void => {
    g.clear();
    g.fillStyle(PAL.white, 1).fillRect(x, y, 1, 1);
    cols.forEach((c, i) => {
      const k = i + 1;
      g.fillStyle(c, 1).fillRect(x - k, y, 1, 1).fillRect(x + k, y, 1, 1).fillRect(x, y - k, 1, 1).fillRect(x, y + k, 1, 1);
    });
  };
  arm([PAL.white, PAL.white, PAL.cyan4, PAL.cyan3]);
  bg(
    S.wait(40)
      .then(() => (g.active ? arm([PAL.white, PAL.cyan4]) : undefined))
      .then(() => S.wait(40))
      .then(() => g.destroy()),
  );
}

async function prismLandingV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const n = u.frameCount('summon');
  const spreadF = Math.min(n - 1, SPREAD_F);
  const cutF = Math.min(n - 1, CUT_F);
  const circle = S.openCircle({ appearMs: 200 });
  // (its crystal glints drift behind the body: nothing is drawn over it from the land to the reveal)
  const shaft = S.own(prismShaft(S, { hw: S.big ? 6 : 5, glintDepth: S.depth - 0.5 }));
  // the shaft's arrival is the crystal's own chime (no generic riser under it; a tribute's still
  // sounding from the swallow gives way: sound QA #9, summonCharge held 62 % of this window)
  fadeV3(['summonCharge'], 160);
  bg(
    shaft.descend(70).then(() => {
      playV3('wyrmChime', { volume: 0.75, pan: panAt(S.home.x) });
      circle.pulse(120);
    }),
  );
  const p = S.pose({
    ramp: CRYSTAL,
    onLand: () => {
      bg(landingDust(sc, S.home.x, S.home.y, PAL.cyan3, { big: false, count: S.big ? 9 : 7, radius: 14 }));
      circle.pulse(100);
      bg(shaft.width(0.2, 100).then(() => shaft.fade(120)).then(() => shaft.destroy()));
    },
  });
  if (!p) {
    shaft.destroy();
    return;
  }
  // its weight on the marble, on the pose's own 'land' frame (_v3/sound.ts)
  atMark(u, 'summon', 'land', () => playV3('wyrmLand', { volume: S.big ? 0.9 : 0.75, pan: panAt(S.home.x) }));
  // (no generic 'materialize' on the solid frame: the land 17 ms before it is the beat)
  // ---- the wings burst open: the prism read on the floor, a glint on the horn tip
  await untilFrame(u, 'summon', spreadF);
  prismRevealV3(S);
  // the generic burst under the crystal's own ring / roar (sound QA #9: it was the summon's loudest beat)
  playSfx('summonBurst', { volume: 0.35, pitch: 1.15 });
  // the crystal rings as the wings burst open; without a cut-in (whose eyes roar) it roars here
  playV3(S.cutIn ? 'wyrmChime' : 'wyrmRoar', { volume: S.cutIn ? 0.6 : 0.75, pan: panAt(S.home.x) });
  const finale = () => S.finale({ ring: S.big ? 92 : 60, ramp: RAMPS.cyan, freezeMs: S.big ? 50 : 0, sfx: 'summonBurst' });
  if (!S.cutIn) {
    finale();
    bg(circle.dismiss(420));
    await p.done;
    return;
  }
  // ---- an ace: the cut-in on the spread hold; the finale as the band leaves
  await untilFrame(u, 'summon', cutF);
  await S.climax();
  finale();
  bg(circle.dismiss(420));
  await S.wait(120);
}

signatureSummon('crystal_wyrm', async (S) => {
  const sc = S.scene;
  const { unit, sprite, home, rest } = S;
  if (S.big) bg(S.ctx.focus({ x: home.x, y: home.y - 40 }, { zoom: 1.05, ms: 520, pan: 0.3 }));
  const circle = S.openCircle();
  const shaft = S.own(prismShaft(S));
  playSfx('summonCharge', { volume: 0.8 });
  await shaft.descend(200);
  playSfx('holyChime', { volume: 0.8 });
  circle.pulse(120);
  circle.spin(2);
  await S.wait(90);

  await S.climax();

  // ---- the descent, wrapped in its wings, built as a crystal hologram
  const DROP = S.big ? 74 : 56;
  holdFrame(unit, 'guard', 0);
  sprite.setPosition(rest.x, rest.y - DROP);
  unit.lift = DROP;
  const P = holo(unit, CRYSTAL, { reveal: 0, gain: 0.85 });
  unit.showSprite();
  const bar = S.own(scanBar(sc, CRYSTAL, S.depth + 0.6));
  // the light steps back so the dragon is the focal point as it comes down through it
  bg(shaft.width(0.6, 160));
  bg(shaft.fade(160, 0.6));
  const T = 300;
  await run(sc, T, (t) => {
    const e = 1 - Math.pow(1 - t, 2.2);
    const yy = Math.round(rest.y - DROP * (1 - e));
    sprite.setY(yy);
    unit.lift = rest.y - yy;
    P.reveal = clamp(t / 0.8, 0, 1);
    const b = bodyBox(unit);
    if (P.reveal < 1) bar.at(lerp(b.bottom + 1, b.top - 1, P.reveal), b.left, b.right);
    else bar.hide();
  });
  bar.destroy();
  sprite.setY(rest.y);
  unit.lift = 0;
  P.reveal = 1;
  // ---- landing: squash, dust, a floor ring; the shaft pinches toward a thread
  playSfx('impactLight', { volume: 0.6 });
  bg(landingDust(sc, home.x, home.y, PAL.cyan3, { big: S.big, count: S.big ? 12 : 8 }));
  bg(run(sc, 160, (t) => sprite.setScale(1 + 0.06 * (1 - t) * Math.cos(t * 7), 1 - 0.08 * (1 - t) * Math.cos(t * 7))).then(() => sprite.setScale(1)));
  bg(shaft.width(0.25, 200));
  bg(settleHolo(sc, unit, 260));
  circle.pulse(100);

  // ---- roar from the crouch; the wings burst open on the peak frame
  await S.roar({
    from: 1,
    peak: 3,
    onPeak: () => {
      const b = bodyBox(unit);
      rainbowFlare(S, { x: Math.round((b.left + b.right) / 2), y: Math.round(lerp(b.top, b.bottom, 0.38)) });
      bg(shaft.fade(140).then(() => shaft.destroy()));
      S.finale({ ring: S.big ? 96 : 60, ramp: RAMPS.cyan, flashColor: S.big ? PAL.white : undefined, flashAlpha: 0.32, freezeMs: S.big ? 70 : 0, sfx: 'summonBurst' });
      playSfx('holyChime', { volume: 0.6, pitch: 1.3 });
      bg(circle.dismiss(420));
    },
  });
  await S.wait(S.big ? 200 : 140);
}, { v3: prismLandingV3 });

// ================================================================ v3: the flip (a tribute-set wyrm)
//
// A face-down Kristal Ejder (tribute-SET on an earlier turn) turning face-up, on its own poses —
// never the old squash / stretch pop-out (sprite scaling) or the long gold hologram:
//   flipSummon  the card glows in its owner's colour and jumps over (the paired summon event is
//               consumed here, as summon-b's flip handler does), a crystal glint bursts from it,
//               the body forms CROUCHED BEHIND ITS WINGS (guard f0, crystal hologram ≤ 150 ms)
//               and rises on its `fromGuard` pose into attack position; ring + badge as it stands;
//   attacked    (flipped in defense by an attack) the card turns over, the body forms in its
//               guard pose (≤ 120 ms) and holds it — the battle goes on at once.
// Registered under ?look=v3 only (the old look keeps summon-b's flip handler untouched).

/** Short crystal hologram onset on the frame the unit shows: reveal, one bright frame, 3 steps back. */
function crystalOnset(sc: Phaser.Scene, u: MonsterUnit, ms: number): Promise<void> {
  const s = u.sprite;
  const P = setHologram(s, { reveal: 0, scan: 1, glitch: 0.08, tint: CRYSTAL[4], ramp: holoRamp(CRYSTAL), tintMix: 0.8, gain: 0.7, flicker: 0, alpha: 1, white: 0, clipY: null });
  const rev = Math.round(ms * 0.45);
  return run(sc, ms, (t) => {
    if (!s.active) return;
    const el = t * ms;
    if (el < rev) P.reveal = el / rev;
    else if (el < rev + 34) {
      P.reveal = 1;
      P.white = 0.4;
    } else {
      P.white = 0;
      const step = Math.min(3, Math.floor(((el - rev - 34) / Math.max(1, ms - rev - 34)) * 3) + 1) / 3;
      P.tintMix = 0.8 * (1 - step);
      P.scan = 1 - step;
      P.glitch = 0.08 * (1 - step);
    }
  }).then(() => {
    if (s.active) clearHologram(s);
  });
}

if (LOOK_V3)
  registerCardHook(
    'crystal_wyrm',
    'flip',
    async (ctx) => {
      const ev = ctx.ev;
      const v = ctx.views;
      const field = v.field;
      const sc = ctx.scene;
      const flipSummon = ev.cause === 'flipSummon';
      if (flipSummon) {
        const si = ctx.findType('summon', (e) => e.uid === ev.uid && e.method === 'flip');
        if (si >= 0) ctx.consumeAt(si);
        void v.duelists?.get(ev.player).play('command');
        void v.camera.unfocus(120);
      }
      let tile = field.tileOf(ev.uid);
      if (!tile) tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, false, 'side');
      tile.setCard(ev.cardId);
      const home = { x: tile.home.x, y: tile.home.y };
      ctx.sfx('flipReveal', { volume: 0.9 });
      // (A2 reviews r2: the flip summon ran 0.88 s, then 0.60 s, over / at the plan's 0.6 s flip
      // budget. The card now turns AT ONCE — the owner's glow and the one whole-pixel jolt run
      // inside the turn's own crouch (its first 15 %), never before it — on flipV3's 240 ms turn;
      // a ≈ 100 ms hologram of the very pose the body rises from, the rise already under way in it.
      // The flip summon ends ≈ 0.52 s.)
      const FLIP = flipSummon ? 240 : 220;
      const flipP = tile.flipUp(FLIP);
      if (flipSummon) {
        bg(tile.pulse(PLAYER_COLOR[ev.player], 240));
        const x0 = tile.home.x;
        if (tile.active) tile.x = x0 + 1;
        bg(ctx.wait(30).then(() => (tile && tile.active ? (tile.x = x0) : undefined)));
        bg(ctx.wait(Math.round(FLIP * 0.7)).then(() => (tile && tile.active && tile.orientation !== 'up' ? tile.rotateTo('up', 200) : undefined)));
      }
      await ctx.wait(Math.round(FLIP * (flipSummon ? 0.45 : 0.6)));
      const atk = ctx.atk(ev.uid, flipSummon ? 'after' : 'next');
      const dfn = ctx.def(ev.uid, flipSummon ? 'after' : 'next');
      const unit = field.addUnit(ev.uid, { hidden: true, atk, def: dfn, position: flipSummon ? 'attack' : 'defense' });
      // a crystal glint bursts from the turning card (light layer + crisp sparks)
      void lightFlash(sc, home.x, home.y - 12, PAL.cyan4, fs(flipSummon ? 34 : 26), flipSummon ? 380 : 280, { floorY: home.y, ring: flipSummon, intensity: flipSummon ? 0.9 : 0.6 });
      const sp = new Sparks(sc, DEPTH.FX + 1, ADD);
      for (let i = 0; i < (flipSummon ? 12 : 7); i++) {
        const a = Math.PI + (i / (flipSummon ? 11 : 6)) * Math.PI;
        sp.add({ x: home.x + Math.round(Math.cos(a) * 8), y: home.y - 2, vx: Math.cos(a) * 70, vy: Math.sin(a) * 50 - 20, drag: 3, life: 300, ramp: [PAL.white, PAL.cyan4, PAL.cyan3], tex: i % 3 === 0 ? TEX.plus : TEX.px1 });
      }
      sp.close();
      if (!unit) {
        await flipP;
        return;
      }
      unit.position = flipSummon ? 'attack' : 'defense';
      unit.badge.setPosition(unit.position);
      unit.posed = true;
      const s = unit.sprite;
      try {
        s.setPosition(unit.rest0.x, unit.rest0.y);
        const rise = flipSummon && unit.has('fromGuard') ? 'fromGuard' : null;
        // the hologram forms on the frame the body rises from (fromGuard f0), never another pose
        unit.pose(rise ?? 'guard', 0);
        unit.showSprite();
        playSfx('materialize', { volume: 0.5, pitch: 1.2 });
        const onset = crystalOnset(sc, unit, flipSummon ? 100 : 120);
        if (flipSummon) {
          // it rises out of its wing guard into attack position (feet planted) — the rise starts
          // with the hologram (the body already moves while it forms)
          const total = rise ? unit.animMs(rise) : 0;
          const play = rise ? unit.playRange(rise, 0, undefined, { hold: false }) : Promise.resolve();
          await ctx.wait(Math.round(total * 0.6));
          void shockwave(sc, home.x, home.y, { ramp: RAMPS.cyan, radius: fs(44), ms: 380, thickness: 5 });
          void lightFlash(sc, home.x, home.y - 16, PAL.cyan3, fs(30), 360, { floorY: home.y, ring: true, intensity: 0.8 });
          bg(shake(sc, 120, 1));
          playV3('wyrmChime', { volume: 0.6, pan: panAt(home.x) });
          unit.badge.setVisible(true);
          void unit.badge.pop();
          await play;
          await onset;
        } else {
          await onset;
          unit.badge.setVisible(true);
          void unit.badge.pop();
          unit.rest();
        }
        await Promise.race([flipP, ctx.wait(240)]);
      } finally {
        unit.posed = false;
        unit.lift = 0;
        if (s.active && !unit.retired) {
          s.setPosition(unit.rest0.x, unit.rest0.y);
          unit.show();
          if (!s.anims.isPlaying) unit.rest();
        }
      }
    },
    { name: 'summon-a:crystal_wyrm:flip-v3' },
  );
