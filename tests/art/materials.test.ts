// Material library (src/art/materials, src/audio/v3/materials.ts; docs/v3/A3_MIMARI.md §5, §12):
//   integrity   every definition is pure data, every tone a palette colour, thresholds / far bands /
//               seam and crease tables / sound aliases well formed, the rigkit takes every definition
//   slice       the slice materials equal the slice's own tables: the wyrm's MATS / SEAM / CREASE / rim /
//               glint, the magus' armour-map tones, DEATH_PRESETS / MATTER_RAMP, MONSTER_GLOW /
//               STRIKE_LIGHT, and their sound: the generator rebuilds the slice's nine material hits
//               call for call from the definitions
//   sounds      the generated recipes (stone) play, are deterministic, collide with no existing name;
//               hitSfxName resolves every material
//   frozen      `verified` definitions match tests/art/fixtures/materials-golden.json (A3_MIMARI §3.6;
//               UPDATE_MATERIALS_GOLDEN=1 rewrites it — only for a NEW verified definition)

import { describe, expect, it } from 'vitest';
import { MATERIAL_IDS, farOf, hasMaterial, materialOf, soundOf, soundRootOf, type HitWeight, type MaterialDef, type MaterialSound } from '../../src/art/materials';
import { PAL, RAMPS } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { H as WYRM_H, M, MATS, W as WYRM_W, crease as wyrmCrease, rimLight as wyrmRim, selout as wyrmSeam, setLight as wyrmLight, twinkle as wyrmTwinkle } from '../../src/art/monsters-v3/crystal_wyrm-gbuf';
import { BUST, FIST_B, FIST_F, HELM, MAP_KEY, PAUL_B, PAUL_F } from '../../src/art/monsters-v3/abyss_magus-maps';
import { materialTable } from '../../src/art/rigkit/raster';
import { creaseOf, seamOf } from '../../src/art/rigkit/composite';
import { toneOfRole } from '../../src/art/rigkit/maps';
import { PASS_IDS } from '../../src/art/rigkit/passes/types';
import { RECIPES, type Recipe } from '../../src/audio/sounds';
import type { Voice } from '../../src/audio/synth';
import { GENERATED_HIT_MATERIALS, RING_KINDS, V3_MATERIAL_RECIPES, hitSfxName, materialHitRecipe } from '../../src/audio/v3/materials';
import { V3_RECIPES } from '../../src/audio/v3/slice';
import { DEATH_PRESETS, MATTER_RAMP } from '../../src/cinematics/_v3/presets';
import { MONSTER_IDS, type MonsterId } from '../../src/data/cards';
import { MONSTER_GLOW } from '../../src/view/light/profiles';
import battleKitSource from '../../src/cinematics/battle/_kit.ts?raw';
import golden from './fixtures/materials-golden.json';

const A3_MATERIALS = ['crystal', 'hide', 'metal', 'cloth', 'shadow', 'stone', 'moss', 'runeGold'];
const SLICE = ['crystal', 'hide', 'metal', 'cloth', 'shadow'];
const WEIGHTS: readonly HitWeight[] = ['Light', 'Heavy', 'Magic'];
const PAL_VALUES = new Set<number>(Object.values(PAL));
const DEFS: MaterialDef[] = MATERIAL_IDS.map(materialOf);

/** Relative luminance of a palette colour (0…1). */
function lum(c: number): number {
  const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Every colour a definition names (draw, hit, matter, light). */
function tonesOf(d: MaterialDef): number[] {
  const t: number[] = [...d.draw.ramp, ...(d.draw.far?.ramp ?? []), ...d.hit.sparks, d.hit.flash, ...d.matter];
  for (const tab of [d.draw.seam, d.draw.crease]) if (typeof tab !== 'string') for (const [k, v] of Object.entries(tab)) t.push(Number(k), v);
  const e = d.draw.edge;
  if (e.hi !== null) t.push(e.hi);
  if (e.lo !== null) t.push(e.lo);
  if (d.draw.rim !== null) t.push(d.draw.rim);
  if (d.draw.glint) t.push(d.draw.glint.tone);
  if (d.draw.emissive) t.push(...d.draw.emissive.tones);
  if (d.light?.glow !== undefined) t.push(d.light.glow);
  if (d.light?.pool !== undefined) t.push(d.light.pool);
  return t;
}

/**
 * A Voice stand-in that records every call a recipe makes (arguments as JSON, nodes as call ids) and
 * draws its random numbers from a fixed generator: two recipes with equal traces build the same audio
 * graph with the same values, i.e. the same sound.
 */
function trace(play: (v: Voice) => void): unknown[] {
  const log: unknown[] = [];
  let id = 0;
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const node = (kind: string) => {
    const tag = `${kind}#${++id}`;
    return {
      toJSON: () => tag,
      osc: { toJSON: () => `${tag}.osc`, detune: {}, frequency: {} },
      amp: { toJSON: () => `${tag}.amp`, gain: {} },
      gain: { toJSON: () => `${tag}.gain` },
      connect: (to: unknown) => (log.push(['connect', tag, JSON.parse(JSON.stringify(to ?? null))]), to),
    };
  };
  const v = new Proxy(
    {},
    {
      get(_t, p) {
        if (p === 'rnd') return rnd;
        if (p === 'r') return (lo: number, hi: number) => lo + (hi - lo) * rnd();
        if (typeof p !== 'string') return undefined;
        return (...args: unknown[]) => {
          log.push([p, JSON.parse(JSON.stringify(args))]);
          return node(p);
        };
      },
    },
  );
  play(v as unknown as Voice);
  return log;
}

const fields = (r: Recipe) => ({ cap: r.cap, gap: r.gap, verb: r.verb, duck: r.duck, vary: r.vary });
const cap1 = (s: string) => s[0].toUpperCase() + s.slice(1);

describe('material library: integrity', () => {
  it('registers the A3 materials, each under its file name, as pure data', () => {
    for (const id of A3_MATERIALS) expect(hasMaterial(id), id).toBe(true);
    expect(() => materialOf('no-such-material')).toThrow();
    for (const d of DEFS) {
      expect(JSON.parse(JSON.stringify(d)), `${d.id}: functions / undefined / NaN would be lost`).toEqual(d);
      expect(Object.isFrozen(d) && Object.isFrozen(d.draw) && Object.isFrozen(d.draw.ramp), d.id).toBe(true);
      expect(['verified', 'draft'], d.id).toContain(d.status);
      expect(MONSTER_IDS as readonly string[], `${d.id}.firstUser`).toContain(d.firstUser);
    }
    for (const id of SLICE) expect(materialOf(id).status, id).toBe('verified');
    for (const id of ['stone', 'moss', 'runeGold']) expect(materialOf(id).status, id).toBe('draft');
  });

  it('names only palette colours', () => {
    for (const d of DEFS) for (const c of tonesOf(d)) expect(PAL_VALUES.has(c), `${d.id}: 0x${c.toString(16)}`).toBe(true);
  });

  it('bands: ramps dark → light, ≤ 5 tones (glass and the slice armour 6), thresholds fit, far side one value darker', () => {
    const SIX = new Set(['crystal', 'metal']); // REHBER IŞ-11: glass 6; the magus armour night1…mist (REHBER §2.2, binding)
    for (const d of DEFS) {
      const { ramp, th } = d.draw;
      expect(new Set(ramp).size, `${d.id}: distinct tones`).toBe(ramp.length);
      expect(ramp.length, d.id).toBeLessThanOrEqual(SIX.has(d.id) ? 6 : 5);
      for (let i = 1; i < ramp.length; i++) expect(lum(ramp[i]), `${d.id} ramp[${i}]`).toBeGreaterThan(lum(ramp[i - 1]));
      for (const b of [d.draw, farOf(d)]) {
        if (b.th.length) {
          expect(b.th.length, d.id).toBe(b.ramp.length - 1);
          for (let i = 1; i < b.th.length; i++) expect(b.th[i], d.id).toBeGreaterThan(b.th[i - 1]);
        }
      }
      if (d.draw.far) expect(d.draw.farShift, `${d.id}: own far bands only with farShift 1`).toBe(1);
      const far = farOf(d);
      expect(far.ramp.length, d.id).toBe(ramp.length);
      if (d.draw.farShift === 1) expect(far.ramp.slice(1), `${d.id}: far = one value darker`).toEqual(ramp.slice(0, -1));
      else expect(far).toEqual({ ramp, th });
    }
  });

  it('seams and creases step down in value, cover the ramp and never ink a material that has its own cut tone', () => {
    for (const d of DEFS)
      for (const tab of [d.draw.seam, d.draw.crease]) {
        if (typeof tab === 'string') continue;
        for (const c of [...d.draw.ramp, ...farOf(d).ramp]) expect(tab[c], `${d.id}: 0x${c.toString(16)} has a step`).toBeDefined();
        for (const [k, v] of Object.entries(tab)) {
          expect(v, d.id).not.toBe(PAL.ink);
          expect(lum(v), `${d.id}: 0x${Number(k).toString(16)} → 0x${v.toString(16)}`).toBeLessThanOrEqual(lum(Number(k)));
        }
      }
  });

  it('edges, rims, glints, texture, noise budget, hit and death presets are well formed', () => {
    const passes = [...PASS_IDS, 'crumble', 'reassemble']; // crumble / reassemble arrive with the pilot (Y8)
    for (const d of DEFS) {
      expect(d.draw.edge.lit, d.id).toBeGreaterThanOrEqual(d.draw.edge.dark);
      expect(d.draw.noiseMax, d.id).toBeGreaterThan(0);
      expect(d.draw.noiseMax, d.id).toBeLessThanOrEqual(0.2);
      if (d.draw.texture) expect(d.draw.texture.density, d.id).toBeGreaterThan(0);
      if (d.draw.emissive) expect(d.draw.emissive.tones.length, d.id).toBeGreaterThan(0);
      expect(d.hit.sparks.length, d.id).toBeGreaterThan(0);
      for (let i = 1; i < d.hit.sparks.length; i++) expect(lum(d.hit.sparks[i]), `${d.id} sparks dark → light`).toBeGreaterThan(lum(d.hit.sparks[i - 1]));
      // vfx/shatter's keys: MATTER_RAMP is Record<ShatterMaterial, Ramp> (vfx/shatter itself needs a browser)
      expect(Object.keys(MATTER_RAMP), d.id).toContain(d.death.shatter);
      expect(Object.keys(MATTER_RAMP), d.id).toContain(d.death.accent);
      expect(passes, `${d.id}.death.pass`).toContain(d.death.pass);
      expect(passes, `${d.id}.death.revive`).toContain(d.death.revive);
      expect(d.matter, `${d.id}: matter = MATTER_RAMP of its shatter`).toEqual(MATTER_RAMP[d.death.shatter]);
    }
  });

  it('the rigkit takes every definition (raster table, seams, tone roles)', () => {
    expect(() => materialTable(DEFS)).not.toThrow();
    for (const d of DEFS) {
      const seam = seamOf(d);
      const crease = creaseOf(d);
      for (const c of d.draw.ramp) {
        expect(PAL_VALUES.has(seam(0, 0, c)), d.id).toBe(true);
        expect(PAL_VALUES.has(crease(0, 0, c)), d.id).toBe(true);
      }
    }
    // the sentinel's planes (src/still/sentinel-map.ts): lit stone3, mid stone2, shadow stone1
    const stone = materialOf('stone');
    expect([toneOfRole(stone, 'L'), toneOfRole(stone, 'M'), toneOfRole(stone, 'S')]).toEqual([PAL.stone3, PAL.stone2, PAL.stone1]);
  });

  it('stone thresholds light a block as the reference does (top / left lit, front mid, right / under shadow, cuts by bias only)', () => {
    const L = [-0.5, -0.74, 0.46];
    const n = Math.hypot(L[0], L[1], L[2]);
    const { ramp, th } = materialOf('stone').draw;
    const tone = (nx: number, ny: number, nz: number, bias = 0) => {
      const I = (nx * L[0] + ny * L[1] + nz * L[2]) / n + bias;
      let k = 0;
      while (k < th.length && I >= th[k]) k++;
      return ramp[k];
    };
    const h = Math.SQRT1_2;
    expect([tone(0, -1, 0), tone(-1, 0, 0), tone(0, 0, 1), tone(h, 0, h), tone(1, 0, 0), tone(0, 1, 0)]).toEqual([PAL.stone3, PAL.stone3, PAL.stone2, PAL.stone2, PAL.stone1, PAL.stone1]);
    // the darkest surface that faces the viewer (nz ≥ 0) turns straight away from the light in the
    // picture plane: n·L = −0.889, still above stone0's −0.9
    const away = Math.hypot(L[0], L[1]);
    for (const [nx, ny, nz] of [[1, 0, 0], [0, 1, 0], [h, h, 0], [-L[0] / away, -L[1] / away, 0]]) expect(tone(nx, ny, nz), 'no light alone reaches stone0').not.toBe(PAL.stone0);
    expect(tone(0, 0, 1, -1.5), 'a cut').toBe(PAL.stone0);
  });

  it('sound: every material resolves to interpretable parameters', () => {
    for (const d of DEFS) {
      const root = soundRootOf(d.id);
      const s: MaterialSound = soundOf(d.id);
      expect(hasMaterial(root), d.id).toBe(true);
      expect(RING_KINDS, `${d.id} → ${root}`).toContain(s.ring.kind);
      const [f0, f1, g, dec] = s.thump;
      for (const x of [f0, f1, dec, s.surf[0], s.sizzle]) expect(x > 0 && Number.isFinite(x), d.id).toBe(true);
      expect(f1, d.id).toBeLessThan(f0);
      for (const x of [g, s.surf[1]]) expect(x > 0 && x <= 1, d.id).toBe(true);
      for (const v of Object.values(s.ring)) {
        if (typeof v === 'string') continue;
        for (const x of (Array.isArray(v) ? v : [v]) as number[]) expect(x > 0 && Number.isFinite(x), `${d.id} ring`).toBe(true);
      }
    }
  });
});

describe('material library: the slice materials equal the slice tables', () => {
  it('crystal and hide = the wyrm\'s MATS (bands, far bands)', () => {
    const glass = materialOf('crystal').draw;
    expect(MATS[M.GLASS].direct).toBe(true);
    expect([...glass.ramp]).toEqual(MATS[M.GLASS].ramp);
    expect(glass.th).toEqual([]);
    expect([...glass.far!.ramp]).toEqual(MATS[M.GLASS_FAR].ramp);
    const hide = materialOf('hide').draw;
    expect([...hide.ramp]).toEqual(MATS[M.HIDE].ramp);
    expect([...hide.th]).toEqual(MATS[M.HIDE].th);
    expect([...hide.far!.ramp]).toEqual(MATS[M.HIDE_FAR].ramp);
    expect([...hide.far!.th]).toEqual(MATS[M.HIDE_FAR].th);
  });

  it('crystal and hide seams / creases = the wyrm\'s SEAM / CREASE on every tone they cover', () => {
    for (const id of ['crystal', 'hide']) {
      const d = materialOf(id).draw;
      for (const [k, v] of Object.entries(d.seam as Record<number, number>)) expect(v, `${id} seam 0x${Number(k).toString(16)}`).toBe(wyrmSeam(0, 0, Number(k)));
      for (const [k, v] of Object.entries(d.crease as Record<number, number>)) expect(v, `${id} crease 0x${Number(k).toString(16)}`).toBe(wyrmCrease(0, 0, Number(k)));
    }
  });

  it('the hide rim is the colour the wyrm\'s rimLight paints; the crystal glint the colour its twinkle paints', () => {
    wyrmLight('left');
    const c = new PixelCanvas(WYRM_W, WYRM_H);
    for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) c.set(x, y, PAL.steel);
    wyrmRim(c, new PixelCanvas(WYRM_W, WYRM_H));
    const painted = new Set<number>();
    for (let y = 0; y < WYRM_H; y++) for (let x = 0; x < WYRM_W; x++) if (c.isOpaque(x, y) && c.get(x, y) !== PAL.steel) painted.add(c.get(x, y)!);
    expect([...painted]).toEqual([materialOf('hide').draw.rim]);
    const g = new PixelCanvas(WYRM_W, WYRM_H);
    for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) g.set(x, y, PAL.cyan2);
    wyrmTwinkle(g, [30, 30], 2);
    expect(g.get(30, 30)).toBe(materialOf('crystal').draw.glint!.tone);
    expect(g.get(31, 30)).toBe(materialOf('crystal').draw.glint!.tone);
  });

  it('metal = the magus\' armour-map tones (plates + night0 cut + white glint); cloth and shadow = its void tones', () => {
    const armour = new Set<number>();
    const notArmour: number[] = [PAL.ink, ...RAMPS.void, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];
    const isArmour = (c: number) => !notArmour.includes(c);
    for (const pair of [HELM, BUST, PAUL_B, PAUL_F, FIST_F, FIST_B])
      for (const m of [pair.left, pair.right]) for (const row of m.rows) for (const ch of row) if (MAP_KEY[ch] !== undefined && isArmour(MAP_KEY[ch])) armour.add(MAP_KEY[ch]);
    const metal = materialOf('metal').draw;
    const cut = new Set(Object.values(metal.seam as Record<number, number>));
    expect([...cut]).toEqual([PAL.night0]);
    expect(new Set([...metal.ramp, PAL.night0, metal.glint!.tone])).toEqual(armour);
    const voids = new Set(Object.entries(MAP_KEY).filter(([k]) => 'abcde'.includes(k)).map(([, v]) => v));
    expect(new Set(materialOf('shadow').draw.ramp)).toEqual(voids);
    for (const c of materialOf('cloth').draw.ramp) expect(voids.has(c)).toBe(true);
    expect(new Set(Object.values(materialOf('cloth').draw.seam as Record<number, number>))).toEqual(new Set([PAL.void0]));
  });

  it('deaths = DEATH_PRESETS of the first user (and the pilot\'s stone = today\'s stone_sentinel)', () => {
    for (const id of [...SLICE, 'stone']) {
      const d = materialOf(id);
      expect({ material: d.death.shatter, accent: d.death.accent }, id).toEqual(DEATH_PRESETS[d.firstUser as MonsterId]);
    }
  });

  it('light = MONSTER_GLOW / STRIKE_LIGHT of the first user', () => {
    for (const id of ['crystal', 'shadow', 'runeGold']) {
      const d = materialOf(id);
      expect(d.light?.glow, id).toBe(MONSTER_GLOW[d.firstUser as MonsterId].emissive[0][0]);
    }
    // STRIKE_LIGHT lives in a Phaser module (src/cinematics/battle/_kit.ts): read its table from the source
    const table = /const STRIKE_LIGHT\b[^=]*=\s*\{([\s\S]*?)\};/.exec(battleKitSource);
    expect(table, 'the STRIKE_LIGHT table in src/cinematics/battle/_kit.ts').not.toBeNull();
    const block = table![1];
    const strike = (mid: string) => {
      const m = new RegExp(`\\b${mid}: PAL\\.(\\w+),`).exec(block);
      return m ? (PAL as Record<string, number>)[m[1]] : undefined;
    };
    for (const id of ['crystal', 'shadow', 'stone']) {
      const d = materialOf(id);
      expect(d.light?.pool, id).toBeDefined();
      expect(d.light?.pool, id).toBe(strike(d.firstUser));
    }
  });

  it('sound: the generator rebuilds the slice\'s nine material hits call for call (hide plays glass, shadow the cloth)', () => {
    const stem: Record<string, string> = { crystal: 'hitCrystal', hide: 'hitCrystal', metal: 'hitMetal', cloth: 'hitCloth', shadow: 'hitCloth' };
    for (const id of SLICE)
      for (const w of WEIGHTS) {
        const slice = (V3_RECIPES as Record<string, Recipe>)[`${stem[id]}${w}`];
        const gen = materialHitRecipe(soundOf(id), w);
        expect(fields(gen), `${id} ${w}`).toEqual(fields(slice));
        const a = trace((v) => gen.play(v));
        expect(a.length, `${id} ${w}`).toBeGreaterThan(5);
        expect(a, `${id} ${w}`).toEqual(trace((v) => slice.play(v)));
      }
    expect(soundRootOf('hide')).toBe('crystal');
    expect(soundRootOf('shadow')).toBe('cloth');
  });
});

describe('material sounds: the generated recipes', () => {
  it('stone × Light / Heavy / Magic, under hit<Material><Weight>, without touching an existing name', () => {
    expect(GENERATED_HIT_MATERIALS).toEqual(['stone']);
    expect(Object.keys(V3_MATERIAL_RECIPES).sort()).toEqual(['hitStoneHeavy', 'hitStoneLight', 'hitStoneMagic']);
    for (const [name, r] of Object.entries(V3_MATERIAL_RECIPES)) {
      expect(Object.keys(V3_RECIPES), name).not.toContain(name);
      expect((RECIPES as Record<string, Recipe>)[name], name).toBe(r);
    }
    // the slice's recipes still serve their own names
    for (const [name, r] of Object.entries(V3_RECIPES)) expect((RECIPES as Record<string, Recipe>)[name], name).toBe(r);
  });

  it('play deterministically, follow SE-5 (heavy longer and ducking more, magic an octave up) and stay distinct from each other', () => {
    const traces: Record<string, string> = {};
    for (const w of WEIGHTS) {
      const r = V3_MATERIAL_RECIPES[`hitStone${w}`];
      const t = JSON.stringify(trace((v) => r.play(v)));
      expect(t, w).toBe(JSON.stringify(trace((v) => r.play(v))));
      traces[w] = t;
    }
    expect(new Set(Object.values(traces)).size).toBe(3);
    const r = (w: HitWeight) => V3_MATERIAL_RECIPES[`hitStone${w}`];
    expect(r('Heavy').duck!).toBeGreaterThanOrEqual(0.55);
    expect(r('Light').duck!).toBeLessThanOrEqual(0.3);
    // no ring: stone never calls a tonal ring block (bell / FM) — a rumble, gravel and chips only
    for (const w of WEIGHTS) expect(traces[w], w).not.toMatch(/"bell"/);
  });

  it('hitSfxName: every material plays a recipe that exists (moss and runes sound like the stone under them)', () => {
    const expected: Record<string, string> = { crystal: 'hitCrystal', hide: 'hitCrystal', metal: 'hitMetal', cloth: 'hitCloth', shadow: 'hitCloth', stone: 'hitStone', moss: 'hitStone', runeGold: 'hitStone' };
    for (const id of A3_MATERIALS)
      for (const w of WEIGHTS) {
        const n = hitSfxName(id, w);
        expect(n, `${id} ${w}`).toBe(`${expected[id]}${w}`);
        expect(Object.keys(RECIPES), `${id} ${w}`).toContain(n);
      }
  });
});

// ================================================================ frozen definitions

const GOLDEN_URL = new URL('./fixtures/materials-golden.json', import.meta.url);
const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** JSON with sorted keys (a definition is pure data: this is all of it). */
function canonical(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(x);
}
/** sha256 (Web Crypto) of the canonical JSON. */
async function digest(d: MaterialDef): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(d)));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('material library: verified definitions are frozen', () => {
  it('match tests/art/fixtures/materials-golden.json', async () => {
    const verified = DEFS.filter((d) => d.status === 'verified');
    const now: Record<string, string> = {};
    for (const d of verified) now[d.id] = await digest(d);
    let have = golden as Record<string, string>;
    if (ENV.UPDATE_MATERIALS_GOLDEN === '1') {
      have = {
        _note: 'sha256 of the canonical JSON of every verified material definition (src/art/materials/defs). A verified definition is frozen: a change is a new definition (defs/<id>@2.ts), A3_MIMARI §3.6.',
        ...now,
      };
      const fs = await import(/* @vite-ignore */ 'node:fs' as string);
      fs.writeFileSync(GOLDEN_URL, JSON.stringify(have, null, 2) + '\n');
    }
    const ids = Object.keys(have).filter((k) => !k.startsWith('_'));
    expect(ids.sort(), 'every verified definition is in the golden file, and only those').toEqual(verified.map((d) => d.id).sort());
    for (const d of verified) expect(now[d.id], `${d.id} changed: a verified material is frozen (make ${d.id}@2)`).toBe(have[d.id]);
  });
});
