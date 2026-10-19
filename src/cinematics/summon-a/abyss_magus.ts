// Uçurum Büyücüsü — "Boşluk Yarığı" (signature summon entrance).
//
//   0     the big violet circle draws on; the floor TEARS OPEN into a void rift (an ink-black lens
//         with a jagged violet-white rim and a slow spiral inside); motes are sucked into it;
//         shadow tendrils snake up out of its edges and sway
//   ~330  climax → ace tribute summons: the cut-in ("UÇURUM BÜYÜCÜSÜ!")
//   then  the sorcerer RISES out of the rift (clipped at the floor line, void hologram with
//         scanlines, the rift rim flaring where the body passes); the tendrils curl in and wrap
//         around him as he comes up
//   +420  he floats free (hover); the hologram settles; the roar gathers (f1–2: motes rush in)
//   peak  roar f3 burst — the rift SNAPS SHUT (white seam), the tendrils burst into wisps, a
//         violet shock ring + rune ring race out, void flash, hit-stop, 4 px shake, badge pop
//
// v3 look (?look=v3; magusEntranceV3 below) — the body enters on the art's own `summon` pose
// (helm first out of a rift, the wrapped cloak opening as it clears it; no hologram, no clip mask):
//   0     the void circle draws on; the floor TEARS OPEN into the rift lens under the tile
//   +140  the pose starts: the horns, then the igniting eyes rise out of the rift; motes are sucked
//         in, shadow tendrils climb the rim and curl round the rising body; the rim flares white
//         where the body passes
//   land  (the pose's land mark) the cloak flings open at its float: the tendrils burst into
//         wisps, a rune ring races out over the floor, the rift closes under it (white seam)
//   peak  ace tribute summons: the v3 cut-in (band only, ≤ 1.0 s) over the reveal hold; the finale
//         (shock ring, light, badge) lands as the band leaves. No cut-in: the finale at the land.

import { PAL, PLAYER_COLOR, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { registerCardHook } from '../api';
import { atMark, fade as fadeV3, panAt, play as playV3 } from '../_v3/sound';
import { holoOnset } from '../_v3/summon';
import { TEX } from '../../vfx/core';
import { shadowWisps } from '../../vfx/particles';
import {
  ADD,
  E,
  R,
  RR,
  Raster,
  Sparks,
  TAU,
  bg,
  bodyBox,
  clamp,
  fs,
  glowPop,
  holo,
  isoRing,
  lerp,
  noise1,
  onFrame,
  playSfx,
  run,
  scanBar,
  settleHolo,
  signatureSummon,
  type Stage,
} from './_kit';

const VOID: Ramp = RAMPS.void;

interface Rift {
  open(ms: number): Promise<void>;
  /** Rim flare 0..1 (a body passing through). */
  flare(k: number): void;
  /** Snap shut with a white seam. */
  close(ms: number): Promise<void>;
  destroy(): void;
}

/** Where a rift / rune ring is drawn: a Stage, or (the v3 flip) a scene + floor point. */
interface Spot {
  readonly scene: Phaser.Scene;
  readonly home: XY;
}

function voidRift(S: Spot, A: number, B: number): Rift {
  const sc = S.scene;
  const { x, y } = S.home;
  const W = A * 2 + 24;
  const H = B * 2 + 20;
  const r = new Raster(sc, x - W / 2, y - H / 2, W, H, DEPTH.CARD_ON_TILE + 2);
  const st = { k: 0, t: 0, flare: 0, seam: 0, alive: true };
  const seed = R() * 50;
  const stop = onFrame(sc, (dt) => {
    if (!st.alive) return false;
    st.t += dt;
    const a = A * st.k;
    const b = B * st.k;
    r.draw((g) => {
      if (st.seam > 0) {
        const l = Math.round(A * 1.1 * st.seam);
        g.line(x - l, y, x + l, y, PAL.white);
        g.line(x - Math.round(l * 0.6), y - 1, x + Math.round(l * 0.6), y - 1, PAL.void4);
        g.line(x - Math.round(l * 0.6), y + 1, x + Math.round(l * 0.6), y + 1, PAL.void3);
        return;
      }
      if (a < 1) return;
      const by = Math.max(1, Math.round(b));
      for (let yy = -by; yy <= by; yy++) {
        const v = yy / Math.max(1, b);
        const jag = 1 + (noise1(yy * 0.9 + st.t * 0.004, seed) - 0.5) * 0.35;
        const hw = a * Math.sqrt(Math.max(0, 1 - v * v)) * jag;
        if (hw < 0.5) continue;
        const x0 = Math.round(x - hw);
        const x1 = Math.round(x + hw);
        for (let xx = x0; xx <= x1; xx++) {
          let c: number = PAL.ink;
          const u = (xx - x) / Math.max(1, a);
          // the swirl: a slow two-arm spiral of void light deep inside
          const ang = Math.atan2(v, u);
          const d = Math.hypot(u, v);
          const arm = ((ang * 2) / TAU + Math.log(d + 0.05) * 1.6 - st.t * 0.0012) % 1;
          if (d < 0.85 && ((arm + 1) % 1) < 0.16) c = d < 0.4 ? PAL.void2 : PAL.void1;
          if (xx === x0 || xx === x1) c = st.flare > 0.5 ? PAL.white : PAL.void4;
          else if (xx === x0 + 1 || xx === x1 - 1) c = PAL.void3;
          g.px(xx, y + yy, c);
        }
      }
      // lips: the top rim catches light, the bottom is a dark crust
      for (let xx = Math.round(x - a); xx <= Math.round(x + a); xx++) {
        const u = (xx - x) / a;
        const rimY = Math.round(b * Math.sqrt(Math.max(0, 1 - u * u)));
        g.px(xx, y - rimY - 1, st.flare > 0.3 ? PAL.white : PAL.void4);
        g.dpx(xx, y - rimY - 2, PAL.void3, 0.5 + st.flare * 0.5);
        g.px(xx, y + rimY + 1, PAL.void2);
      }
      // corner sparks
      const blink = Math.floor(st.t / 70) % 2;
      g.px(Math.round(x - a - 1), y, blink ? PAL.white : PAL.void4);
      g.px(Math.round(x + a + 1), y, blink ? PAL.void4 : PAL.white);
      // under-glow around the lens
      isoRing(g, x, y, a + 5, PAL.void2, 0.45 + st.flare * 0.4);
    });
    return true;
  });
  return {
    open: (ms) => run(sc, ms, (t) => (st.k = E.outBack(t))),
    flare: (k) => (st.flare = k),
    async close(ms) {
      await run(sc, ms, (t) => (st.k = 1 - E.inCubic(t)));
      st.k = 0;
      await run(sc, 120, (t) => (st.seam = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7));
      st.seam = 0;
      this.destroy();
    },
    destroy() {
      if (!st.alive) return;
      st.alive = false;
      stop();
      r.destroy();
    },
  };
}

interface Tendrils {
  grow(ms: number): Promise<void>;
  /** 0 = free swaying, 1 = curled in around the body. */
  wrap(k: number): void;
  /** Retract fast and burst into wisps (rim = at the rift's rim, fewer: the v3 entrance). */
  burst(rim?: boolean): void;
  destroy(): void;
}

interface Td {
  phi: number;
  len: number;
  ph: number;
  amp: number;
  delay: number;
}

function shadowTendrils(S: Stage, n: number, baseA: number, baseB: number, height: number): Tendrils {
  const sc = S.scene;
  const { x, y } = S.home;
  const W = baseA * 2 + 70;
  const H = height + 24;
  const back = new Raster(sc, x - W / 2, y - height - 12, W, H, S.depth - 0.5);
  const front = new Raster(sc, x - W / 2, y - height - 12, W, H, S.depth + 0.5);
  const ts: Td[] = Array.from({ length: n }, (_, i) => ({
    phi: (i / n) * TAU + RR(-0.25, 0.25),
    len: height * RR(0.6, 1),
    ph: R() * TAU,
    amp: RR(3, 6),
    delay: RR(0, 0.25),
  }));
  const st = { t: 0, ext: 0, wrap: 0, alive: true };
  const draw = (g: Raster, isFront: boolean) => {
    for (const td of ts) {
      if (Math.sin(td.phi) >= 0 !== isFront) continue;
      const e = clamp((st.ext - td.delay) / (1 - td.delay), 0, 1);
      if (e <= 0) continue;
      const bx = x + Math.cos(td.phi) * baseA;
      const by = y + Math.sin(td.phi) * baseB;
      const L = td.len * e;
      const steps = Math.ceil(L);
      for (let s = 0; s <= steps; s++) {
        const k = s / Math.max(1, td.len);
        const sway = Math.sin(k * 4 + st.t * 0.008 + td.ph) * td.amp * k * (1 - st.wrap * 0.7);
        // lean outward when free, curl in toward the body axis when wrapping
        const out = Math.cos(td.phi) * k * lerp(10, -baseA * 0.9, st.wrap);
        const X = bx + sway + out;
        const Y = by - s;
        const th = Math.max(1, (1 - k) * 6.5);
        const x0 = Math.round(X - th / 2);
        const x1 = Math.round(X + th / 2);
        const mid = Math.round(X);
        for (let xx = x0; xx <= x1; xx++) {
          // lit left rim, a glowing vein down the middle, dark right edge
          const col = xx === x0 ? PAL.void4 : xx === x1 && x1 > x0 + 1 ? PAL.ink : xx === mid && th > 2.5 ? PAL.void2 : PAL.void0;
          g.px(xx, Y, col);
        }
        if (s === steps) {
          g.px(Math.round(X), Y - 1, PAL.void4);
          g.px(Math.round(X), Y - 2, PAL.white);
        }
      }
    }
  };
  const stop = onFrame(sc, (dt) => {
    if (!st.alive) return false;
    st.t += dt;
    back.draw((g) => draw(g, false));
    front.draw((g) => draw(g, true));
    return true;
  });
  const T: Tendrils = {
    grow: (ms) => run(sc, ms, (t) => (st.ext = E.outCubic(t))),
    wrap: (k) => (st.wrap = k),
    burst(rim = false) {
      if (rim) shadowWisps(sc, x, y - 2, { radius: baseA + 4, count: S.big ? 8 : 6, depth: S.depth - 0.6 });
      else shadowWisps(sc, x, y - height * 0.4, { radius: baseA + 6, count: S.big ? 16 : 10, depth: DEPTH.FX - 1 });
      bg(run(sc, 140, (t) => (st.ext = 1 - E.inQuad(t))).then(() => T.destroy()));
    },
    destroy() {
      if (!st.alive) return;
      st.alive = false;
      stop();
      back.destroy();
      front.destroy();
    },
  };
  return T;
}

/** A ring of rune glyphs racing out along the floor (the sorcerer's sigil). */
function runeRing(S: Spot, R1: number): void {
  const sc = S.scene;
  const { x, y } = S.home;
  const ras = new Raster(sc, x - R1 - 8, y - R1 / 2 - 8, R1 * 2 + 16, R1 + 16, DEPTH.TILE_FX + 3);
  const glyphs = ['x.x/.x./x.x', 'xxx/.x./.x.', 'x../xxx/..x', '.x./x.x/.x.', 'xx./x.x/.xx'].map((s) => s.split('/'));
  const n = 18;
  bg(
    run(sc, 520, (t) => {
      const rad = lerp(10, R1, E.outCubic(t));
      const lv = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      ras.draw((g) => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + t * 1.2;
          const gx = Math.round(x + Math.cos(a) * rad) - 1;
          const gy = Math.round(y + Math.sin(a) * rad * 0.5) - 1;
          const gl = glyphs[i % glyphs.length];
          for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) if (gl[j][k] === 'x') g.dpx(gx + k, gy + j, t < 0.2 ? PAL.white : PAL.void4, lv);
        }
      });
    }).then(() => ras.destroy()),
  );
}

/** The v3 entrance on the art's summon pose (see the header). */
async function magusEntranceV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const { home } = S;
  if (S.big) bg(S.ctx.focus({ x: home.x, y: home.y - 30 }, { ms: 420, pan: 0.3 }));
  const circle = S.openCircle();
  const A = S.big ? 22 : 18;
  const B = S.big ? 9 : 7;
  const rift = S.own(voidRift(S, A, B));
  // the tendrils frame the rift (they lean out and sway; they never cover the rising body)
  const tend = S.own(shadowTendrils(S, S.big ? 5 : 4, A * 0.95, B * 0.95, S.big ? 26 : 22));
  const riftLight = S.glow({ color: PAL.void3, radius: fs(A + 12), intensity: 0, anim: 'breathe', fadeIn: 0 });
  riftLight.setIntensity(0.9, 160);
  // its presence: the rift tears and the low drone rises with the body (_v3/sound.ts). A tribute's
  // generic riser still sounding from the swallow gives way to it (sound QA #9: summonCharge held
  // 96 % of the entrance window over the presence)
  fadeV3(['summonCharge'], 160);
  playV3('magusPresence', { volume: 0.9, pan: panAt(home.x) });
  // motes sucked into the tear while the body climbs out of it
  const suck = new Sparks(sc, DEPTH.FX - 1);
  let sucking = true;
  const stopSuck = onFrame(sc, (dt) => {
    if (!sucking) return false;
    if (dt > 0 && R() < dt / 26) {
      const a = R() * TAU;
      const d = RR(fs(34), fs(56));
      suck.add({ x: Math.round(home.x + Math.cos(a) * d), y: Math.round(home.y + Math.sin(a) * d * 0.5 - RR(0, 24)), home: { x: home.x, y: home.y, k: 0.35 }, life: RR(300, 440), ramp: [PAL.void3, PAL.void4, PAL.white], tex: TEX.px1 });
    }
    return true;
  });
  S.own({ destroy: () => ((sucking = false), stopSuck(), suck.close()) });
  await rift.open(140);
  circle.pulse(100);
  circle.spin(2.2);
  bg(tend.grow(300));
  rift.flare(1);
  let landed = false;
  let finaled = false;
  const finale = () => {
    if (finaled) return;
    finaled = true;
    const c = S.coreRest;
    void lightFlash(sc, c.x, c.y, PAL.void4, fs(S.big ? 52 : 40), 520, { floorY: home.y, ring: true, intensity: 0.9 });
    // (the generic finale accents stay under the magus' own landing / call: sound QA #9)
    S.finale({ ring: S.big ? 88 : 56, ramp: VOID, freezeMs: S.big ? 50 : 0, sfx: null });
    playV3('summonBurst', { volume: S.big ? 0.45 : 0.3 });
    playSfx('darkPulse', { volume: 0.5, pitch: 0.7 });
    bg(circle.dismiss(360));
  };
  const t0 = sc.time.now;
  const pose = S.pose({
    ramp: VOID,
    hologram: false,
    onLand: () => {
      landed = true;
      sucking = false;
      rift.flare(0);
      tend.burst(true);
      runeRing(S, fs(S.big ? 70 : 50));
      circle.pulse(120);
      riftLight.setIntensity(1.2, 60);
      bg(S.wait(80).then(() => riftLight.fadeOut(260)));
      // the rift closes under the float a beat after the reveal (the pose's own lip closes with it)
      bg(S.wait(60).then(() => rift.close(180)));
      if (!S.cutIn) finale();
    },
  });
  if (!pose) {
    // (no summon pose: never for this art; the old entrance is the fallback)
    rift.destroy();
    tend.destroy();
    return;
  }
  // it arrives at its float on the pose's own 'land' frame
  atMark(S.unit, 'summon', 'land', () => playV3('magusLand', { volume: 0.85, pan: panAt(home.x) }));
  // the tendrils curl round the body as it rises, loosen as it clears the rift
  const landMs = pose.ms.land;
  const stopWrap = onFrame(sc, () => {
    if (landed) return false;
    const t = Math.min(1, (sc.time.now - t0) / Math.max(1, landMs));
    tend.wrap(0.05 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    return true;
  });
  S.own({ destroy: stopWrap });
  if (S.cutIn) {
    await pose.peak;
    await S.climax();
    finale();
    await S.wait(110);
  } else {
    await pose.done;
    finale();
  }
}

signatureSummon('abyss_magus', async (S) => {
  const sc = S.scene;
  const { unit, sprite, home, rest } = S;
  if (S.big) bg(S.ctx.focus({ x: home.x, y: home.y - 34 }, { zoom: 1.05, ms: 520, pan: 0.3 }));
  const circle = S.openCircle();
  const A = S.big ? 26 : 20;
  const B = S.big ? 8 : 6;
  const rift = S.own(voidRift(S, A, B));
  const tend = S.own(shadowTendrils(S, S.big ? 7 : 5, A * 0.9, B * 0.9, S.big ? 46 : 36));
  // (v2) the tear's violet rim light on the marble
  const riftLight = S.glow({ color: PAL.void3, radius: fs(A + 12), intensity: 0, anim: 'breathe', fadeIn: 0 });
  riftLight.setIntensity(0.85, 200);
  playSfx('darkPulse', { volume: 0.8 });
  playSfx('summonCharge', { volume: 0.6, pitch: 0.8 });
  // motes sucked into the tear
  const suck = new Sparks(sc, DEPTH.FX - 1, ADD);
  let sucking = true;
  const stopSuck = onFrame(sc, (dt) => {
    if (!sucking) return false;
    if (dt > 0 && R() < dt / 22) {
      const a = R() * TAU;
      const d = RR(fs(40), fs(64));
      suck.add({ x: home.x + Math.cos(a) * d, y: home.y + Math.sin(a) * d * 0.5 - RR(0, 30), home: { x: home.x, y: home.y, k: 0.35 }, life: RR(320, 480), ramp: [PAL.void3, PAL.void4, PAL.white], tex: R() < 0.25 ? TEX.px2 : TEX.px1 });
    }
    return true;
  });
  S.own({ destroy: () => ((sucking = false), stopSuck(), suck.close()) });
  await rift.open(200);
  bg(tend.grow(320));
  circle.pulse(100);
  circle.spin(2.2);
  await S.wait(130);

  await S.climax();

  // ---- the rise out of the rift (clipped at the floor line)
  playSfx('darkPulse', { volume: 0.7, pitch: 1.2 });
  playSfx('materialize', { volume: 0.7 });
  const box0 = bodyBox(unit);
  const dist = Math.ceil(box0.bottom - box0.top) + 4;
  sprite.setPosition(rest.x, rest.y + dist);
  const P = holo(unit, VOID, { clipY: home.y + 1, glitch: 0.15 });
  unit.showSprite();
  const bar = S.own(scanBar(sc, VOID, S.depth + 0.6));
  tend.wrap(0.2);
  riftLight.setIntensity(1.25, 120);
  const T = 380;
  await run(sc, T, (t) => {
    const e = E.outCubic(t);
    sprite.setY(Math.round(rest.y + dist * (1 - e)));
    tend.wrap(0.2 + 0.8 * Math.sin(Math.PI * Math.min(1, t * 1.2)) * (t < 0.8 ? 1 : 0.6));
    rift.flare(t < 0.85 ? 1 : 0);
    if (t < 0.92) bar.at(home.y, box0.left - 2, box0.right + 2);
    else bar.hide();
  });
  bar.destroy();
  sprite.setY(rest.y);
  P.clipY = null;
  rift.flare(0);
  riftLight.setIntensity(0.8, 200);
  tend.wrap(0.35);
  bg(settleHolo(sc, unit, 240));

  // ---- the roar: a gathering inhale, then the burst
  await S.roar({
    from: 1,
    peak: 3,
    onPeak: () => {
      sucking = false;
      bg(rift.close(90));
      void riftLight.fadeOut(180);
      tend.burst();
      runeRing(S, fs(S.big ? 84 : 56));
      const c = unit.core();
      bg(glowPop(sc, c.x, c.y, PAL.void3, { from: 0.6, to: 3.4, alpha: 0.9, ms: 340 }));
      S.finale({ ring: S.big ? 92 : 58, ramp: VOID, flashColor: S.big ? PAL.void4 : undefined, flashAlpha: 0.3, freezeMs: S.big ? 60 : 0, sfx: 'summonBurst' });
      playSfx('darkPulse', { volume: 0.9, pitch: 0.7 });
      bg(circle.dismiss(420));
    },
  });
  await S.wait(S.big ? 130 : 110);
}, { v3: magusEntranceV3 });

// ================================================================ v3: the flip (a tribute-set magus)
//
// A face-down Uçurum Büyücüsü (tribute-SET on an earlier turn) turning face-up, on its own poses and
// in the entrance's void language — never the old squash / stretch pop-out (sprite scaling), the
// roar or the long hologram build:
//   flipSummon  the card glows in its owner's colour and turns over (the paired summon event is
//               consumed here, as summon-b's flip handler does); half-way through the turn a small
//               void rift tears open on the tile and the body forms out of it CROUCHED IN ITS GUARD
//               (guard f0, a ≤ 150 ms palette-step onset, a few wisps at the rift's rim), then rises
//               on its `fromGuard` pose into attack position; as it stands the rift snaps shut (white
//               seam), a rune ring races out over the floor and the badge pops (≤ 0.6 s in all);
//   attacked    (flipped in defense by an attack) the card turns over, the body forms in its guard
//               pose (≤ 120 ms, a puff of wisps at its hem) and holds it — the battle goes on at once.
// Registered under ?look=v3 only (the old look keeps summon-b's flip handler untouched).

if (LOOK_V3)
  registerCardHook(
    'abyss_magus',
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
      // the card turns at once (its owner's glow runs alongside, never before it)
      if (flipSummon) bg(tile.pulse(PLAYER_COLOR[ev.player], 240));
      ctx.sfx('flipReveal', { volume: 0.9 });
      const FLIP = flipSummon ? 240 : 200;
      const flipP = tile.flipUp(FLIP);
      if (flipSummon) bg(ctx.wait(Math.round(FLIP * 0.7)).then(() => (tile && tile.active && tile.orientation !== 'up' ? tile.rotateTo('up', 200) : undefined)));
      await ctx.wait(Math.round(FLIP * 0.45));
      // half-way through the turn: the body forms in the guard the face-down magus held
      const atk = ctx.atk(ev.uid, flipSummon ? 'after' : 'next');
      const dfn = ctx.def(ev.uid, flipSummon ? 'after' : 'next');
      const unit = field.addUnit(ev.uid, { hidden: true, atk, def: dfn, position: flipSummon ? 'attack' : 'defense' });
      if (!unit) {
        await flipP;
        return;
      }
      unit.position = flipSummon ? 'attack' : 'defense';
      unit.badge.setPosition(unit.position);
      unit.posed = true;
      const s = unit.sprite;
      const spot: Spot = { scene: sc, home };
      const rift = flipSummon ? voidRift(spot, 14, 6) : null;
      try {
        s.setScale(1).setPosition(unit.rest0.x, unit.rest0.y);
        unit.pose('guard', 0);
        unit.showSprite();
        ctx.sfx('darkPulse', { volume: flipSummon ? 0.7 : 0.5, pitch: 1.2 });
        ctx.sfx('materialize', { volume: 0.45, pitch: 1.2 });
        // a few wisps breathe out at the hem (under the body: they never cover it)
        shadowWisps(sc, home.x, home.y - 1, { radius: flipSummon ? 14 : 12, count: flipSummon ? 6 : 4, depth: s.depth - 0.6 });
        const onset = holoOnset(sc, unit, VOID, flipSummon ? 150 : 120);
        if (flipSummon && rift) {
          bg(rift.open(90));
          rift.flare(1);
          // the rise out of the guard starts while the body is still forming (it already moves)
          await ctx.wait(60);
          const rise = unit.has('fromGuard') ? 'fromGuard' : null;
          const total = rise ? unit.animMs(rise) : 0;
          const play = rise ? unit.playRange(rise, 0, undefined, { hold: false }) : Promise.resolve();
          // it stands (fromGuard f3: the staff upright, the robe swinging past rest)
          await ctx.wait(rise ? unit.rangeMs(rise, 0, 3) : 120);
          rift.flare(0);
          bg(rift.close(90));
          floorRing(spot, unit.sprite.depth - 0.7);
          void lightFlash(sc, home.x, home.y - 14, PAL.void4, fs(30), 320, { floorY: home.y, ring: true, intensity: 0.8 });
          playV3('magusLand', { volume: 0.75, pan: panAt(home.x) });
          unit.badge.setVisible(true);
          void unit.badge.pop();
          await capped(sc, play, Math.max(0, total - (rise ? unit.rangeMs(rise, 0, 3) : 0)) + 60);
        } else {
          await capped(sc, onset, 140);
          unit.badge.setVisible(true);
          void unit.badge.pop();
          unit.rest();
        }
        await capped(sc, onset, 120);
        await capped(sc, flipP, 120);
      } finally {
        rift?.destroy();
        unit.posed = false;
        unit.lift = 0;
        if (s.active && !unit.retired) {
          s.setScale(1).setPosition(unit.rest0.x, unit.rest0.y);
          unit.show();
          if (!s.anims.isPlaying) unit.rest();
        }
      }
    },
    { name: 'summon-a:abyss_magus:flip-v3' },
  );

/**
 * The flip's stand beat on the floor: one iso ring of void light stepping out from the closing rift
 * in four whole-pixel steps (void4 → void3 → void2), under the body. No glyphs at this size (they
 * read as letters), no soft glow.
 */
function floorRing(S: Spot, depth: number): void {
  const { x, y } = S.home;
  const r = new Raster(S.scene, x - 40, y - 22, 80, 44, depth);
  const RX = [12, 19, 26, 32];
  const TONE = [PAL.void4, PAL.void4, PAL.void3, PAL.void2];
  bg(
    (async () => {
      for (let i = 0; i < RX.length; i++) {
        if (!r.alive) return;
        r.draw((g) => {
          isoRing(g, x, y, RX[i], TONE[i]);
          if (i < 2) isoRing(g, x, y, RX[i] - 3, PAL.void2);
        });
        await run(S.scene, 45, () => undefined);
      }
      r.destroy();
    })(),
  );
}

/** Wait for `p`, at most `ms` (game time). */
function capped(sc: Phaser.Scene, p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([p.then(() => undefined, () => undefined), run(sc, ms, () => undefined)]);
}
