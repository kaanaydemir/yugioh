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

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, type XY } from '../../view/layout';
import { TEX } from '../../vfx/core';
import { STEX, landingDust } from '../../vfx/summon';
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
  holdFrame,
  holo,
  isoRing,
  lerp,
  onFrame,
  playSfx,
  run,
  scanBar,
  settleHolo,
  signatureSummon,
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

function prismShaft(S: Stage): Shaft {
  const sc = S.scene;
  const { x, y } = S.home;
  const W = 96;
  const top = Math.min(-40, y - 320);
  const H = Math.ceil(y - top) + 24;
  const r = new Raster(sc, x - W / 2, top, W, H, S.depth - 1);
  const pool = new Raster(sc, x - 48, y - 18, 96, 36, DEPTH.CARD_ON_TILE + 2, ADD);
  const st = { tip: top, wk: 1, fade: 1, t: 0, landed: 0 };
  const hw0 = S.big ? 12 : 9;
  const glints = new Sparks(sc, S.depth + 0.5, ADD);
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
        const rad = (12 + i * 3) * k + pulse * (i % 2 ? 1 : -1);
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
  return {
    async descend(ms) {
      await run(sc, ms, (t) => (st.tip = lerp(top, y, E.inQuad(t))));
      st.tip = y;
      bg(run(sc, 160, (t) => (st.landed = E.outCubic(t))));
    },
    width: (k, ms) => {
      const a = st.wk;
      return run(sc, ms, (t) => (st.wk = lerp(a, k, E.outCubic(t))));
    },
    fade: (ms, to = 0) => {
      const a = st.fade;
      return run(sc, ms, (t) => (st.fade = lerp(a, to, t)));
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      r.destroy();
      pool.destroy();
      glints.close();
    },
  };
}

/** The roar-peak payoff: a spectral lens streak with ghost hexes, rainbow floor rings, shards. */
function rainbowFlare(S: Stage, at: XY): void {
  const sc = S.scene;
  const X = Math.round(at.x);
  const Y = Math.round(at.y);
  const L = S.big ? 130 : 80;
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
      ghosts.forEach((gh, i) => gh.setVisible(env > 0.2 && Math.floor(t * 20 + i) % 4 !== 0));
    }).then(() => {
      g.destroy();
      ghosts.forEach((gh) => gh.destroy());
    }),
  );
  // rainbow floor rings (each band a spectral colour), two waves
  const ras = new Raster(sc, S.home.x - 110, S.home.y - 56, 220, 112, DEPTH.TILE_FX + 3);
  const R1 = S.big ? 100 : 64;
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
    sh.add({ x: X + RR(-6, 6), y: Y + RR(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 420, drag: 1.2, life: RR(420, 760), ramp: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], tex: i % 3 === 0 ? TEX.plus : i % 3 === 1 ? TEX.px2 : TEX.px1, spin: 9 });
  }
  sh.close();
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
});
