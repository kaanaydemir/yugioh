#!/usr/bin/env node
// Screenshot / filmstrip tool for Neon Düello (headless Chromium + Vite dev server).
//
//   node tools/shot.mjs "<query>" [options]
//
//   <query>            URL query, e.g. "?dev=monster&id=crystal_wyrm" or "?seed=3"; may start with a page,
//                      e.g. "trial.html?scene=loop" (default page index.html)
//   --out FILE         output PNG (default shots/shot.png)
//   --scale N          zoom (viewport = 640N×360N; default 2, film default 1)
//   --wait MS          real-time wait after ready before capture (default 400)
//   --step MS          freeze the game loop and advance exactly MS of game time before capture
//   --eval "JS"        async JS run in the page after ready (window.__neon is available)
//   --film N           capture N frames into one contact sheet (freezes time; deterministic)
//   --every MS         game time between film frames (default 100)
//   --start MS         game time to advance before the first film frame (default 0)
//   --cols C           contact sheet columns (default 4)
//   --clip x,y,w,h     crop to a region in GAME pixels (640×360 space)
//   --frames DIR       with --film: also write every film frame as DIR/fNNNN.png (for GIF / video)
//   --fresh            "?dev=duel&s=<key>": freeze, then restart the duel on that scenario under the
//                      frozen clock (__neon.duel.scenario) before the capture. The real-time duel before
//                      the freeze no longer leaks in, so a --film / --step capture is a function of the
//                      code alone: pixel-identical between runs (v3 plan A1.12).
//                      A duel launch ("?mode=hotseat&seed=1&holdIntro=1&curtain=0" …, A56.0): freeze,
//                      restart the same launch (seed, first player) under the frozen clock and wait
//                      until its opening is held again (holdIntro=1); the film starts the opening at
//                      t = 0 (tools/lib/pagekit.mjs freshLaunchInPage)
//   --timeout MS       ready timeout (default 30000); page loads wait at least 120 s
//   --help             this text
//   console.log / console.error output from the page (and from --eval) is printed
//
// Prints page errors / console errors. Exit code 1 if the page threw.

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshLaunchInPage } from './lib/pagekit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const o = { query: '', _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[k] = v;
    } else o._.push(a);
  }
  o.query = o._[0] ?? '';
  return o;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  const out = [];
  for (const l of fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1)) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
  process.exit(0);
}
const film = args.film ? Number(args.film) : 0;
const scale = Number(args.scale ?? (film ? 1 : 2));
const out = path.resolve(root, args.out ?? 'shots/shot.png');
fs.mkdirSync(path.dirname(out), { recursive: true });

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      if (/^chromium-\d+$/.test(d)) {
        const p = path.join(base, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {}
  return undefined;
}

const port = 5300 + Math.floor(Math.random() * 600);
const server = await createServer({
  root,
  logLevel: 'error',
  server: { port, host: '127.0.0.1', strictPort: false, hmr: false },
  clearScreen: false,
});
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 640 * scale, height: 360 * scale }, deviceScaleFactor: 1 });
  const logs = [];
  const navTimeout = Number(args.timeout ?? 30000);
  page.setDefaultNavigationTimeout(Math.max(navTimeout, 120000));
  page.setDefaultTimeout(Math.max(navTimeout, 120000));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[console.${m.type()}] ${t}`);
    else if (m.type() === 'log' && !t.startsWith('%c')) logs.push(`[console.log] ${t}`);
  });
  page.on('pageerror', (e) => {
    failed = true;
    logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`);
  });

  // The query may start with a page path, e.g. "trial.html?x=1" (default page: index.html).
  const m = /^([\w./-]+\.html)(.*)$/.exec(args.query);
  const pagePath = m ? m[1].replace(/^\//, '') : '';
  const rest = m ? m[2] : args.query;
  let q = rest.startsWith('?') ? rest : '?' + rest;
  q += (q.length > 1 ? '&' : '') + 'test=1';
  await page.goto(base + pagePath + q, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout: Number(args.timeout ?? 30000) });
  } catch {
    logs.push('[shot] timed out waiting for window.__neon.ready');
    failed = true;
  }

  if (args.eval) {
    try {
      await page.evaluate(`(async () => { ${args.eval} })()`);
    } catch (e) {
      logs.push(`[eval error] ${e.message}`);
      failed = true;
    }
  }

  if (args.fresh && !new URLSearchParams(q).get('s') && new URLSearchParams(q).get('mode')) {
    // a duel launch (the opening films of tools/filmdiff.mjs a6v1 / a6v3): restart it frozen
    try {
      await page.evaluate(freshLaunchInPage);
    } catch (e) {
      logs.push(`[fresh error] ${e.message}`);
      failed = true;
    }
  } else if (args.fresh) {
    const key = new URLSearchParams(q).get('s');
    try {
      await page.evaluate(async (key) => {
        const N = window.__neon;
        if (Array.isArray(N.__duelArmed)) N.__duelArmed.splice(0); // the real-time duel's armed start
        N.freeze();
        let done = false;
        N.duel.scenario(key, { film: true }).then(() => (done = true));
        for (let k = 0; !done && k < 3000; k++) await N.step(1000 / 60);
        if (!done) throw new Error('the restarted duel never became ready');
      }, key);
    } catch (e) {
      logs.push(`[fresh error] ${e.message}`);
      failed = true;
    }
  }

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  const clipArg = args.clip ? args.clip.split(',').map(Number) : null;
  const clip = clipArg && box
    ? { x: box.x + clipArg[0] * scale, y: box.y + clipArg[1] * scale, width: clipArg[2] * scale, height: clipArg[3] * scale }
    : box ?? undefined;

  if (film) {
    const every = Number(args.every ?? 100);
    const start = Number(args.start ?? 0);
    const cols = Number(args.cols ?? 4);
    await page.evaluate(() => window.__neon.freeze());
    if (start > 0) await page.evaluate((ms) => window.__neon.step(ms), start);
    if (args.frames) fs.mkdirSync(args.frames, { recursive: true });
    const frames = [];
    for (let i = 0; i < film; i++) {
      if (i > 0) await page.evaluate((ms) => window.__neon.step(ms), every);
      const buf = await page.screenshot({ clip });
      frames.push({ t: start + i * every, b64: buf.toString('base64') });
      if (args.frames) fs.writeFileSync(path.join(args.frames, `f${String(i).padStart(4, '0')}.png`), buf);
    }
    const sheet = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    const w = clip.width;
    const html = `<html><body style="margin:0;background:#000;font:12px monospace;color:#9ef">
      <div style="display:grid;grid-template-columns:repeat(${cols}, ${w}px);gap:4px;padding:4px">
      ${frames
        .map(
          (f, i) => `<div><div style="padding:1px 2px">#${i} t=${f.t}ms</div><img style="display:block" src="data:image/png;base64,${f.b64}"></div>`,
        )
        .join('')}
      </div></body></html>`;
    await sheet.setContent(html);
    await sheet.screenshot({ path: out, fullPage: true });
  } else {
    if (args.step) {
      await page.evaluate(() => window.__neon.freeze());
      await page.evaluate((ms) => window.__neon.step(ms), Number(args.step));
    } else {
      await page.waitForTimeout(Number(args.wait ?? 400));
    }
    await page.screenshot({ path: out, clip });
  }

  const errs = await page.evaluate(() => window.__neon?.errors ?? []).catch(() => []);
  for (const e of errs) logs.push(`[neon.errors] ${e}`);
  if (errs.length) failed = true;
  for (const l of logs) console.log(l);
  console.log(`[shot] wrote ${path.relative(root, out)}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
