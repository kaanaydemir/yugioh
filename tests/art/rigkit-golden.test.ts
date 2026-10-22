// A3 Y2 — the rigkit core's golden digests (A3_MIMARI §3.6, §12).
//
// The core was proven a byte-exact copy of the slice ONCE (every frame of crystal_wyrm and
// abyss_magus, P1 + P2 relight, rendered with the slice's own rig source but every craft helper
// running in src/art/rigkit: 532/532 frames identical — shots/v3/a3/y2/fidelity.txt). From then on
// this test pins the core: fixed inputs → sha256 of the pixels (or of the numbers) per case, compared
// with tests/art/fixtures/rigkit-golden.json. A behaviour change of the core is only ever a NEW
// opt-in CraftOpts option (§3.6): its cases are added, the old digests never change.
//
//   add new cases:  RIGKIT_GOLDEN=write npx vitest run tests/art/rigkit-golden.test.ts
//   (an existing digest that differs is still a failure; RIGKIT_GOLDEN=force rewrites everything —
//    only for a deliberate, reviewed core change)

import { beforeAll, describe, expect, it } from 'vitest';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { cloth, comp, edges, geom, lightOf, maps, passes, raster, type Light } from './fixtures/rigkit-golden-cases';
import { FX_H, FX_POSES, FX_W, drawFixture, fixtureWorkspace, fxPose } from '../../src/dev/fixtures/rigkit-creature';
import golden from './fixtures/rigkit-golden.json';

const GOLDEN_URL = new URL('./fixtures/rigkit-golden.json', import.meta.url);
const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
/** sha256 (Web Crypto) of pixels or of a JSON-able value. */
async function digest(x: PixelCanvas | unknown): Promise<string> {
  const bytes = x instanceof PixelCanvas ? new Uint8Array(x.data) : new TextEncoder().encode(JSON.stringify(x));
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

type Case = () => unknown;
const LIGHTS: Light[] = [lightOf('left'), lightOf('right')];

// ------------------------------------------------------------------ the cases (name → output)

function cases(): Record<string, Case> {
  const out: Record<string, Case> = {};
  for (const L of LIGHTS) {
    const s = L.from === 'left' ? 'P1' : 'P2';
    out[`light/${s}`] = () => ({ from: L.from, v: L.v, v2: L.v2, side: L.side, lift: L.lift, lx: L.lx(3) });
    out[`raster/scene/${s}`] = () => raster.scene(L).render;
    out[`raster/scene-nospeck/${s}`] = () => raster.scene(L, { speck: false }).render;
    out[`raster/scene-shift/${s}`] = () => raster.scene(L, { shift: -0.2 }).render;
    out[`raster/shards/${s}`] = () => raster.shards(L);
    out[`edges/edgePaint/${s}`] = () => edges.paint(L);
    out[`edges/rimLight/${s}`] = () => edges.rim(L);
    out[`comp/castShadow/${s}`] = () => comp.shadow(L);
    out[`comp/castShadow-mask-onto/${s}`] = () => comp.shadowMask(L);
    out[`maps/stamp/${s}`] = () => maps.stamps(L);
    out[`passes/cracks/${s}`] = () => passes.cracks(L);
    out[`passes/gather/${s}`] = () => passes.gather(L, 0.55);
    out[`passes/gather-early/${s}`] = () => passes.gather(L, 0.15);
    for (const n of Object.keys(FX_POSES)) out[`fixture/${n}/${s}`] = () => fixtureFrame(n, L);
  }
  out['raster/materialTable'] = () => raster.tables();
  out['raster/despeckle-noise'] = () => raster.noise(2);
  out['raster/despeckle-noise-box'] = () => raster.noise(1, { x0: 4, y0: 3, x1: 20, y1: 15 });
  out['comp/composite-seams'] = () => comp.seams();
  out['comp/composite-folds'] = () => comp.folds();
  out['comp/tables'] = () => comp.tables();
  out['comp/cleanCrumbs'] = () => comp.crumbs(false);
  out['comp/cleanCrumbs-keep'] = () => comp.crumbs(true);
  out['comp/partComp'] = () => comp.parts();
  out['edges/lines-twinkle'] = () => edges.lines();
  out['cloth/planes-rim-teeth'] = () => cloth.planes();
  out['cloth/numbers'] = () => cloth.numbers();
  out['passes/drain'] = () => passes.drain();
  out['passes/split-1'] = () => passes.split(0.5);
  out['passes/split-2'] = () => passes.split(1);
  out['passes/dissolve'] = () => passes.dissolve(true);
  out['passes/dissolve-nomotes'] = () => passes.dissolve(false);
  out['passes/gatherMotes'] = () => passes.motes();
  out['passes/cells'] = () => passes.cells();
  out['geom/numbers'] = () => geom.numbers();
  return out;
}

function fixtureFrame(name: string, L: Light): PixelCanvas {
  const p = new PixelCanvas(FX_W, FX_H);
  drawFixture(p, fxPose(FX_POSES[name]), L, fixtureWorkspace(L));
  return p;
}

// ------------------------------------------------------------------ tests

describe('rigkit golden digests (A3_MIMARI §3.6)', () => {
  const now: Record<string, string> = {};
  const have: { cases: Record<string, string> } = { cases: { ...(golden as { cases: Record<string, string> }).cases } };

  beforeAll(async () => {
    for (const [name, run] of Object.entries(cases())) now[name] = await digest(run());
    const mode = ENV.RIGKIT_GOLDEN;
    if (mode !== 'write' && mode !== 'force') return;
    const changed = Object.keys(now).filter((k) => have.cases[k] !== undefined && have.cases[k] !== now[k]);
    if (mode === 'write' && changed.length) throw new Error(`RIGKIT_GOLDEN=write refuses to change existing digests: ${changed.join(', ')}`);
    const merged = mode === 'force' ? { ...now } : { ...have.cases, ...now };
    const sorted = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
    const fs = await import(/* @vite-ignore */ 'node:fs' as string);
    fs.writeFileSync(GOLDEN_URL, JSON.stringify({ about: 'sha256 per case of tests/art/rigkit-golden.test.ts (rigkit core, A3_MIMARI §3.6); grows only', cases: sorted }, null, 1) + '\n');
    have.cases = sorted;
  });

  it('every golden case is still computed (none silently dropped)', () => {
    const gone = Object.keys(have.cases).filter((k) => !(k in now));
    expect(gone).toEqual([]);
  });

  it('every computed case has a golden digest (new cases: RIGKIT_GOLDEN=write)', () => {
    const fresh = Object.keys(now).filter((k) => !(k in have.cases));
    expect(fresh).toEqual([]);
  });

  it('core outputs equal their golden digests', () => {
    const bad = Object.keys(now).filter((k) => k in have.cases && have.cases[k] !== now[k]);
    expect(bad).toEqual([]);
  });
});

describe('rigkit core properties', () => {
  it('despeckle applied a second time changes nothing (rendered layers, both lights, and noise)', () => {
    const layers: PixelCanvas[] = [];
    for (const L of LIGHTS) layers.push(...raster.scene(L).layers);
    layers.push(raster.noise(2));
    for (const c of layers) {
      const once = c.clone();
      raster.despeckle(c, 2);
      expect(Array.from(c.data)).toEqual(Array.from(once.data));
    }
  });

  it('the default CraftOpts is the A2 craft', () => {
    const r = new raster.Raster(8, 8, LIGHTS[0], raster.materialTable([{ ramp: [PAL.night2, PAL.white], th: [0] }]));
    expect(r.craft).toEqual(raster.CRAFT_A2);
    expect(raster.CRAFT_A2).toEqual({ despecklePasses: 2, v: 1 });
  });

  it('the core holds no light: the same Raster call under either light depends only on its own Light', async () => {
    const a = raster.scene(LIGHTS[0]).render;
    raster.scene(LIGHTS[1]);
    expect(await digest(raster.scene(LIGHTS[0]).render)).toBe(await digest(a));
  });

  it('lightOf: P1 by default, DrawOpts and names agree, Light values pass through, the P2 lift is the A2 0.1', () => {
    expect(lightOf()).toBe(lightOf('left'));
    expect(lightOf({ lightFrom: 'right' })).toBe(lightOf('right'));
    const r = lightOf('right');
    expect(lightOf(r)).toBe(r);
    expect(r.lift).toBe(0.1);
    expect(lightOf('right', { p2Lift: 0 }).lift).toBe(0);
    expect(r.lx(2)).toBe(-2);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('materialTable rejects thresholds that do not fit the ramp', () => {
    expect(() => raster.materialTable([{ ramp: [1, 2, 3], th: [0] }])).toThrow(/th.length/);
  });

  it('fixture creature: margin ≥ 2 on body frames, isolated pixels within IŞ-10, ≤ 20 colours', () => {
    for (const L of LIGHTS)
      for (const n of Object.keys(FX_POSES)) {
        const p = fixtureFrame(n, L);
        const iso = isolatedShare(p);
        const effect = n === 'gather' || n === 'dissolve' || n === 'split' || n === 'drained';
        expect(iso, `${n} ${L.from}`).toBeLessThanOrEqual(effect ? 0.2 : 0.15);
        if (n === 'idle0') expect(iso).toBeLessThanOrEqual(0.1);
        if (!effect) {
          const b = p.bounds()!;
          expect(Math.min(b.x, b.y, FX_W - b.x - b.w, FX_H - b.y - b.h), `${n} margin`).toBeGreaterThanOrEqual(2);
          expect(colours(p), `${n} colours`).toBeLessThanOrEqual(20);
        }
      }
  });
});

/** IŞ-10: opaque pixels without a same-coloured 4-neighbour ÷ opaque pixels. */
function isolatedShare(p: PixelCanvas): number {
  let iso = 0;
  let opaque = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      opaque++;
      if (p.get(x - 1, y) !== c && p.get(x + 1, y) !== c && p.get(x, y - 1) !== c && p.get(x, y + 1) !== c) iso++;
    }
  return iso / opaque;
}
function colours(p: PixelCanvas): number {
  const s = new Set<number>();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) !== null) s.add(p.get(x, y)!);
  return s.size;
}
