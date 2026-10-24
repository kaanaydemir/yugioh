// Shared browser plumbing of the A56.0 tools (tools/sbs.mjs, tools/card-hash.ts, tools/measure.mjs,
// tools/shot.mjs): a Vite dev server on a port Chromium accepts, a headless Chromium, and the two
// deterministic "fresh" restarts (run inside the page with page.evaluate):
//
//   freshScenarioInPage(key)  ?dev=duel&s=<key>: freeze, restart the duel on that scenario under the
//                             frozen clock; its steps start on the next freeze()  (= shot.mjs --fresh)
//   freshLaunchInPage()       a duel launch URL (?mode=hotseat&seed=1&holdIntro=1&curtain=0 …):
//                             freeze, restart the same launch (seed, first player) under the frozen
//                             clock and wait until its held opening is armed; the opening starts on
//                             the next freeze()
//
// After either, the caller's next __neon.freeze() starts the action at t = 0 and __neon.step(ms)
// advances it, so a capture is a function of the code alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Ports Chromium refuses to load (net::ERR_UNSAFE_PORT) in the ranges the tools pick from. */
export const UNSAFE_PORTS = new Set([5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

export function chromePath() {
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

/**
 * A Vite dev server of the repo on a random port in [lo, lo + span) that Chromium accepts (a port
 * Vite moved to because the chosen one was busy is checked too). Returns { server, base }.
 */
export async function startServer({ lo = 7400, span = 500, root = ROOT } = {}) {
  const { createServer } = await import('vite');
  for (let attempt = 0; attempt < 6; attempt++) {
    let port;
    do port = lo + Math.floor(Math.random() * span);
    while (UNSAFE_PORTS.has(port));
    const server = await createServer({
      root,
      logLevel: 'error',
      server: { port, host: '127.0.0.1', strictPort: false, hmr: false },
      clearScreen: false,
    });
    await server.listen();
    const base = server.resolvedUrls.local[0];
    if (!UNSAFE_PORTS.has(Number(new URL(base).port))) return { server, base };
    await server.close();
  }
  throw new Error('no port Chromium accepts');
}

export async function launchBrowser() {
  const { chromium } = await import('playwright-core');
  return chromium.launch({
    executablePath: chromePath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
}

/** page.goto + wait for window.__neon.ready (one retry of the load on a busy machine). */
export async function gotoReady(page, url, timeout = 120000) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  } catch {
    await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  }
  await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout });
}

/** The kind of page a query opens: 'scenario' (?dev=duel&s=…), 'launch' (?mode=…) or 'page'. */
export function queryKind(query) {
  const q = new URLSearchParams(query.replace(/^[^?]*\?/, ''));
  if (q.get('dev') === 'duel' && q.get('s')) return 'scenario';
  if (q.get('mode')) return 'launch';
  return 'page';
}

// ---------------------------------------------------------------- in-page (page.evaluate)

/** In the page: restart the duel on scenario `key` under the frozen clock (tools/shot.mjs --fresh). */
export async function freshScenarioInPage(key) {
  const N = window.__neon;
  if (Array.isArray(N.__duelArmed)) N.__duelArmed.splice(0); // the real-time duel's armed start
  N.freeze();
  let done = false;
  N.duel.scenario(key, { film: true }).then(() => (done = true));
  for (let k = 0; !done && k < 3000; k++) await N.step(1000 / 60);
  if (!done) throw new Error('the restarted duel never became ready');
}

/**
 * In the page: restart the current duel launch (same seed and first player; the URL's holdIntro=1
 * holds the opening again) under the frozen clock and wait until the opening is armed. Without
 * holdIntro=1 it waits until the restarted duel waits for its first action instead.
 */
export async function freshLaunchInPage() {
  const N = window.__neon;
  if (!N.duel || typeof N.duel.restart !== 'function') throw new Error('no duel on this page');
  const hold = new URLSearchParams(location.search).get('holdIntro') === '1';
  if (Array.isArray(N.__duelArmed)) N.__duelArmed.splice(0); // the real-time duel's held opening
  N.freeze();
  const L = N.duel.launch ?? {};
  let done = false;
  N.duel.restart({ seed: L.seed, firstPlayer: L.firstPlayer }).then(() => (done = true));
  for (let k = 0; k < 3000; k++) {
    if (hold ? Array.isArray(N.__duelArmed) && N.__duelArmed.length > 0 : done) return;
    await N.step(1000 / 60);
  }
  throw new Error(hold ? 'the restarted launch never armed its opening' : 'the restarted launch never became ready');
}
