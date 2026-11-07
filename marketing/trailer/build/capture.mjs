#!/usr/bin/env node
// Trailer frame + SFX capture (Prism Duel). Loads each shot's page once in headless Chromium, freezes the
// game clock and loops step(1000/60) + canvas screenshot, so every PNG is one 60 fps video frame at 1×
// (640×360). While stepping, the page's sound contract (src/audio/sfx.ts: sfx.play / start / hush / fade)
// is hooked: every sound the game asks for is logged with its game frame (and, for sfx.start handles,
// the frame it was stopped on). Nothing is played live; build/audio.mjs renders the log offline.
//
//   node marketing/trailer/build/capture.mjs [--only a,b] [--jobs 2]
//
// Shots: marketing/trailer/build/shots.mjs. Output: marketing/trailer/build/cache/<shot>/fNNNNN.png +
// sfx.json ({ fps, frames, cues: [{ f, name, opts, stopF?, stopMs? } | { f, fade: [...], ms }] }).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chromePath, startServer, ROOT } from '../../../tools/lib/pagekit.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? args[i + 1] : d;
};
const SHOTS = (await import(new URL(opt('shots', './shots.mjs'), import.meta.url).href)).SHOTS;
const only = opt('only') ? new Set(opt('only').split(',')) : null;
const jobs = Number(opt('jobs', 2));
/** --survey K: keep only every K-th frame (still stepped one frame at a time) into cache/survey/. */
const survey = Number(opt('survey', 0));
const CACHE = path.join(ROOT, 'marketing/trailer/build/cache' + (survey ? '/survey' : ''));
const STEP = 1000 / 60;

/** Installed in the page before the action starts: logs the sound contract instead of playing it. */
async function hookSfx() {
  const S = await import('/src/audio/sfx.ts');
  const sfx = S.sfx;
  const log = (window.__trailerSfx = []);
  window.__tf = -1;
  const hushed = [];
  sfx.play = (name, opts) => {
    if (hushed.some((h) => h.has(name))) return;
    log.push({ f: window.__tf, name, opts: opts ? { ...opts } : undefined });
  };
  sfx.start = (name, opts) => {
    const n = log.length;
    sfx.play(name, opts);
    const rec = log.length > n ? log[n] : null;
    return {
      stop(ms = 60) {
        if (rec && rec.stopF === undefined) {
          rec.stopF = window.__tf;
          rec.stopMs = ms;
        }
      },
    };
  };
  sfx.hush = (names, fn) => {
    hushed.push(new Set(names));
    try {
      return fn();
    } finally {
      hushed.pop();
    }
  };
  sfx.fade = (names, ms = 120) => {
    log.push({ f: window.__tf, fade: [...names], ms });
  };
  return true;
}

async function captureShot(browser, base, shot) {
  const dir = path.join(CACHE, shot.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.setDefaultTimeout(180000);
  const q = shot.query + (shot.query.includes('?') ? '&' : '?') + 'test=1';
  await page.goto(base + q.replace(/^\//, ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout: 120000 });
  await page.evaluate(hookSfx);
  if (shot.fresh) {
    const key = new URLSearchParams(q.split('?')[1]).get('s');
    await page.evaluate(async (key) => {
      const N = window.__neon;
      if (Array.isArray(N.__duelArmed)) N.__duelArmed.splice(0);
      N.freeze();
      let done = false;
      N.duel.scenario(key, { film: true }).then(() => (done = true));
      window.__tf = -99999;
      for (let k = 0; !done && k < 3000; k++) await N.step(1000 / 60);
      if (!done) throw new Error('the restarted duel never became ready');
    }, key);
  }
  // sounds of the page boot / the fresh restart's set-up are not part of the shot
  await page.evaluate(() => {
    window.__trailerSfx.splice(0);
    window.__tf = 0;
    window.__neon.freeze();
  });
  if (shot.zoom) {
    // trailer camera: the world camera held at an integer zoom on a world point, re-applied before every
    // render (the HUD / cut-in camera stays at 1×, exactly like the game's own close-ups)
    await page.evaluate(([z, cx, cy, sceneKey]) => {
      const sc = window.__neon.game.scene.getScene(sceneKey);
      const cam = sc.cameras.main;
      const hw = 320 - 320 / z;
      const hh = 180 - 180 / z;
      const cl = (v, l) => Math.max(-l, Math.min(l, Math.round(v)));
      const apply = () => cam.setZoom(z).setScroll(cl(cx - 320, hw), cl(cy - 180, hh));
      sc.events.on('prerender', apply);
      apply();
    }, [...shot.zoom, shot.scene ?? 'Duel']);
  }
  if (shot.setup) await page.evaluate(`(async () => { ${shot.setup} })()`);
  // pre-roll: game time before the first frame (its sounds are logged with negative frames)
  const pre = Math.round((shot.start ?? 0) / STEP);
  for (let i = 0; i < pre; i++) {
    await page.evaluate((f) => {
      window.__tf = f;
      window.__neon.step(1000 / 60);
    }, i - pre);
    if (shot.at && shot.at[i - pre]) await page.evaluate(`(async () => { ${shot.at[i - pre]} })()`);
  }
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  const clip = { x: box.x, y: box.y, width: 640, height: 360 };
  const n = shot.frames;
  for (let i = 0; i < n; i++) {
    // frame 0 is the state after the pre-roll; each later frame advances one 1/60 s step
    if (shot.at && shot.at[i]) await page.evaluate(`(async () => { window.__tf = ${i}; ${shot.at[i]} })()`);
    if (i > 0)
      await page.evaluate((f) => {
        window.__tf = f;
        window.__neon.step(1000 / 60);
      }, i);
    if (!survey || i % survey === 0) await page.screenshot({ clip, path: path.join(dir, `f${String(i).padStart(5, '0')}.png`) });
  }
  const cues = await page.evaluate(() => window.__trailerSfx);
  const errs = await page.evaluate(() => window.__neon.errors ?? []);
  fs.writeFileSync(path.join(dir, 'sfx.json'), JSON.stringify({ fps: 60, frames: n, start: shot.start ?? 0, cues, errors: [...errors, ...errs] }, null, 1));
  await page.close();
  return { cues: cues.length, errors: errors.length + errs.length };
}

const { server, base } = await startServer();
const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const list = SHOTS.filter((s) => s.query && (!only || only.has(s.name)));
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const s = list[next++];
      const t0 = Date.now();
      try {
        const r = await captureShot(browser, base, s);
        console.log(`[capture] ${s.name}: ${s.frames} frames, ${r.cues} sfx cues, ${r.errors} errors, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      } catch (e) {
        console.log(`[capture] ${s.name}: FAILED ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
} finally {
  await browser.close();
  await server.close();
}
