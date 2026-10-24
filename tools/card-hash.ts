// Card texture fingerprints (A56.0; docs/v3/A5_PLAN.md §5.0.2 item 3, §6.1, §6.2; A6_PLAN.md §6.1):
// sha256 of every card texture the game builds — faces, art windows, the flat iso cards of both
// players in both orientations, the backs of both players, the overlay sheets frame by frame —
// and of the pixel sources of src/art/cards.ts behind them (faces, art, the pose renderer's mip
// levels incl. the 18×26 mini level, iso renders, the per-player back canvases and mips). Card
// textures are not covered by tools/sheet-hash.ts (monster sheets only); this is their gate.
//
//   npx vite-node tools/card-hash.ts [--look v1|v3] [--query "&k=v"] [--out FILE] [--compare OLD.json]
//                                    [--allow "pat,…"] [--note "text"] [--in FILE] [--help]
//
//   e.g. the v1 gate:  npx vite-node tools/card-hash.ts --look v1 --compare shots/v3/a56/baseline/card-hashes-v1.json
//        A5-B's gate:  npx vite-node tools/card-hash.ts --look v3 --query "&a5=b&a6=off" \
//                        --compare shots/v3/a56/baseline/card-hashes-v3-a56-0.json
//
// Method: the game itself builds the textures (boot step 30-cards and any later card boot step),
// so this runs the real boot in headless Chromium (Vite dev server + playwright-core, like
// tools/measure.mjs): it opens ?dev=__cardhash&test=1 (an unknown dev preview: the full boot, then
// an empty page), plus &look=v3 for --look v3 and the --query text (lane kill-switches such as
// &a5=b&a6=off are URL parameters). In the page it reads every texture whose key starts with
// "card:" from the texture manager (the whole source and each named frame, e.g. card:glowrun
// run:0…23, card:foil s:0…13) and imports /src/art/cards.ts — the same module instance the game
// uses — for the pixel sources. The page hashes with crypto.subtle (sha256 of the RGBA bytes).
// The sources are then drawn a second time from emptied caches in reverse order
// (resetCardCaches): `deterministic: false` means the card art depends on draw order / state.
//
// Entries (the JSON's `entries`, name → hash; `--compare` works on these names):
//   tex:<key>                   a whole card texture (w×h:sha256)
//   tex:<key>#<frame>           one named frame of it (x,y,w×h:sha256)
//   src:face:<id>               cardFaceCanvas(id)            48×68
//   src:art:<id>                cardArtCanvas(id)             44×34
//   src:mip:<id>:<0|1|2>        cardMip(id).levels (2 = the 18×26 mini level the pose renderer uses)
//   src:iso:<id|back>:<o>:p<1|2>  isoCanvas(id, 'up'|'side', player)
//   src:back:p<1|2>             cardBackCanvas(player)        (the single back source, S-2)
//   src:backmip:p<1|2>:<level>  cardMip('back', player).levels
//   key:back:p<1|2>             cardBackKey(player) — the texture key each player's back uses
// Groups (the summary and the per-group lists): face, art, mini (src:mip of the faces), iso
// (faces), isoBack, back (back textures, sources, mips, keys), overlay (card:sil / glow / glowrun /
// sheen / foil and their iso sheets), other (any other card:* texture, e.g. a lane's new ones).
// summary.backSame: both players' back keys and pixels are the same (true in v1: no card:back:p2).
//
// --compare OLD.json: every entry that changed, appeared or disappeared, by group; exit 2 if any
// difference is not allowed, 0 when identical (or every difference is allowed). Without --allow
// every difference fails (the v1 gate: card-hash v1 must be identical).
// --allow "pat,…": glob patterns (* = any run of characters) of entries that may differ, e.g.
//   --allow "tex:card:face:*,tex:card:art:*,src:face:*,src:art:*,src:mip:*,tex:card:iso:*,src:iso:*,tex:card:foil*,tex:card:sheen*,!*back*"
// (a pattern starting with ! forbids what it matches even when another pattern allows it).
// A --look / --query that differs from OLD.json's is printed as a note (the comparison still runs).
// --in FILE: take an earlier fingerprint instead of running the game (re-check --compare / --allow);
// its look / query are used unless --look / --query are given, and nothing is written.
// Exit 1 on bad arguments or a page / boot failure.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// @ts-ignore — a plain ESM helper of the tools (no types)
import { startServer, launchBrowser, gotoReady, ROOT } from './lib/pagekit.mjs';

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a) => a !== '--');
const has = (k: string): boolean => argv.includes(`--${k}`);
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};

if (has('help') || has('h')) {
  const src = fs.readFileSync(new URL(import.meta.url).pathname, 'utf8').split('\n');
  const out: string[] = [];
  for (const l of src) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
  process.exit(0);
}

const IN = arg('in');
/** --in FILE: the earlier fingerprint (its look / query are this run's unless given). */
const PREV = IN ? JSON.parse(fs.readFileSync(path.resolve(process.cwd(), IN), 'utf8')) : null;
const LOOK = arg('look') ?? PREV?.look ?? 'v1';
if (LOOK !== 'v1' && LOOK !== 'v3') {
  console.error(`[card-hash] --look must be v1 or v3 (got ${LOOK})`);
  process.exit(1);
}
const QUERY_RAW = arg('query') ?? PREV?.query ?? '';
const QUERY = QUERY_RAW ? (QUERY_RAW.startsWith('&') ? QUERY_RAW : `&${QUERY_RAW}`) : '';
const OUT = path.resolve(process.cwd(), arg('out') ?? path.join(ROOT, LOOK === 'v3' ? 'shots/card-hashes-v3.json' : 'shots/card-hashes.json'));
const COMPARE = arg('compare');
const NOTE = arg('note') ?? null;
const ALLOW = (arg('allow') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const rel = (p: string): string => (p.startsWith(ROOT + path.sep) ? path.relative(ROOT, p) : p);

// ---------------------------------------------------------------- in-page

interface PageResult {
  entries: Record<string, string>;
  textures: number;
  frames: number;
  ids: string[];
  deterministic: boolean;
  nondeterministic: string[];
  errors: string[];
}

/**
 * The in-page code lives in tools/lib/card-hash.page.js and is evaluated as TEXT: a function passed
 * to page.evaluate would be serialized after vite-node's transform, which rewrites import() and
 * may add helpers the page does not have.
 */
const PAGE_SRC = fs.readFileSync(path.join(ROOT, 'tools/lib/card-hash.page.js'), 'utf8');

// ---------------------------------------------------------------- groups + compare

const GROUPS: [string, RegExp][] = [
  ['face', /^(tex:card:face:|src:face:)/],
  ['art', /^(tex:card:art:|src:art:)/],
  ['mini', /^src:mip:/],
  ['isoBack', /^(tex:card:iso:back:|src:iso:back:)/],
  ['iso', /^(tex:card:iso:(?!sil:|glow:|sheen:)|src:iso:)/],
  ['back', /^(tex:card:back|src:back:|src:backmip:|key:back:)/],
  ['overlay', /^tex:card:(sil|glow|glowrun|sheen|foil|iso:sil:|iso:glow:|iso:sheen:)/],
];
const groupOf = (name: string): string => GROUPS.find(([, re]) => re.test(name))?.[0] ?? 'other';

const globRe = (pat: string): RegExp => new RegExp(`^${pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
const allowPos = ALLOW.filter((p) => !p.startsWith('!')).map(globRe);
const allowNeg = ALLOW.filter((p) => p.startsWith('!')).map((p) => globRe(p.slice(1)));
const allowed = (name: string): boolean => allowPos.some((re) => re.test(name)) && !allowNeg.some((re) => re.test(name));

function gitInfo(): { head: string; srcDirty: boolean } | null {
  try {
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { head, srcDirty: dirty.length > 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- run

const url = `?dev=__cardhash&test=1${LOOK === 'v3' ? '&look=v3' : ''}${QUERY}`;
const t0 = Date.now();
let res: PageResult;
const pageErrors: string[] = [];
if (IN) {
  // --in FILE: an earlier fingerprint instead of a run (e.g. to re-check --compare / --allow)
  const prev = PREV;
  res = { entries: prev.entries, textures: prev.summary?.textures ?? 0, frames: prev.summary?.textureFrames ?? 0, ids: new Array(prev.summary?.cards ?? 0).fill(''), deterministic: prev.summary?.deterministic !== false, nondeterministic: prev.nondeterministic ?? [], errors: prev.errors ?? [] };
} else {
  const { server, base } = await startServer({ lo: 7400, span: 500 });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(600000);
    page.on('pageerror', (e: Error) => pageErrors.push(String(e.message).slice(0, 300)));
    await gotoReady(page, `${base}${url}`, 300000);
    res = (await page.evaluate(PAGE_SRC)) as PageResult;
  } catch (e) {
    console.error(`[card-hash] ${url}: ${String((e as Error)?.message ?? e).split('\n')[0]}`);
    await browser.close();
    await server.close();
    process.exit(1);
  }
  await browser.close();
  await server.close();
}

const entries = res.entries;
const groups: Record<string, number> = {};
for (const k of Object.keys(entries)) groups[groupOf(k)] = (groups[groupOf(k)] ?? 0) + 1;
const backSame = entries['key:back:p1'] === entries['key:back:p2'] && entries['src:back:p1'] === entries['src:back:p2'];
const doc = {
  tool: 'tools/card-hash.ts',
  version: 1,
  look: LOOK,
  query: QUERY,
  url,
  date: new Date().toISOString(),
  root: ROOT,
  git: gitInfo(),
  note: NOTE,
  summary: {
    cards: res.ids.length,
    textures: res.textures,
    textureFrames: res.frames,
    entries: Object.keys(entries).length,
    groups,
    backKeys: [entries['key:back:p1'], entries['key:back:p2']],
    backSame,
    hasBackP2Texture: Object.prototype.hasOwnProperty.call(entries, 'tex:card:back:p2'),
    deterministic: res.deterministic,
  },
  nondeterministic: res.nondeterministic,
  errors: [...res.errors, ...pageErrors],
  entries,
};
if (!IN) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
}
console.log(
  `[card-hash] look ${LOOK}${QUERY ? ` query ${QUERY}` : ''}: ${res.ids.length} cards, ${res.textures} card:* textures (${res.frames} named frames), ${Object.keys(entries).length} entries (${Object.entries(groups).map(([g, n]) => `${g} ${n}`).join(', ')}); back keys ${doc.summary.backKeys.join(' / ')}${backSame ? ' (both players the same pixels)' : ' (per player)'}; ${res.deterministic ? 'deterministic' : `NOT DETERMINISTIC (${res.nondeterministic.slice(0, 4).join(', ')}…)`}${doc.errors.length ? `; ${doc.errors.length} page error(s): ${doc.errors.slice(0, 2).join(' | ')}` : ''} ${IN ? `(read from ${rel(path.resolve(process.cwd(), IN))}, nothing written)` : `→ ${rel(OUT)}`} [${Math.round((Date.now() - t0) / 1000)} s]`,
);
let code = doc.errors.length ? 1 : 0;

if (COMPARE) {
  const old = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), COMPARE), 'utf8')) as typeof doc;
  if ((old.look ?? 'v1') !== LOOK) console.log(`[card-hash] note: ${COMPARE} is a --look ${old.look} fingerprint, this run is --look ${LOOK}`);
  if ((old.query ?? '') !== QUERY) console.log(`[card-hash] note: ${COMPARE} was taken with query "${old.query ?? ''}", this run with "${QUERY}"`);
  const a = old.entries ?? {};
  const names = [...new Set([...Object.keys(a), ...Object.keys(entries)])].sort();
  const byGroup: Record<string, { changed: string[]; added: string[]; removed: string[] }> = {};
  let unallowed = 0;
  let total = 0;
  const bad: string[] = [];
  for (const n of names) {
    const x = a[n];
    const y = entries[n];
    if (x === y) continue;
    total++;
    const g = groupOf(n);
    const slot = (byGroup[g] ??= { changed: [], added: [], removed: [] });
    (x === undefined ? slot.added : y === undefined ? slot.removed : slot.changed).push(n);
    if (!allowed(n)) {
      unallowed++;
      if (bad.length < 12) bad.push(n);
    }
  }
  if (old.summary?.deterministic !== false && !res.deterministic) {
    console.log('[card-hash] the card art is no longer deterministic');
    unallowed++;
  }
  console.log(`[card-hash] compare with ${COMPARE}: ${total ? `${total} entr${total === 1 ? 'y differs' : 'ies differ'}` : 'all entries identical'}${ALLOW.length ? ` (${total - unallowed} allowed by --allow, ${unallowed} not)` : ''}`);
  for (const [g, s] of Object.entries(byGroup)) {
    const n = s.changed.length + s.added.length + s.removed.length;
    const show = (l: string[]) => l.slice(0, 6).join(', ') + (l.length > 6 ? ` … (+${l.length - 6})` : '');
    console.log(`  ${g.padEnd(8)} ${String(n).padStart(4)} of ${String(groups[g] ?? 0).padStart(4)}${s.changed.length ? `  changed: ${show(s.changed)}` : ''}${s.added.length ? `  new: ${show(s.added)}` : ''}${s.removed.length ? `  gone: ${show(s.removed)}` : ''}`);
  }
  if (old.summary && old.summary.backSame !== backSame) console.log(`  back: both players the same ${old.summary.backSame} → ${backSame}`);
  if (unallowed) {
    if (ALLOW.length) console.log(`  not allowed: ${bad.join(', ')}${unallowed > bad.length ? ' …' : ''}`);
    code = 2;
  }
}
process.exit(code);
