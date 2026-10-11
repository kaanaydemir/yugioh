// HD render — the sprite renderer. A frame is built from PARTS (layers) in back-to-front order.
// Each part owns a G-buffer that its primitives depth-merge into; at finish() every part is lit
// and quantized (shading.ts), painted with details, then composited over the parts before it
// with 1 px inner lines and a 2 px contact shadow; the silhouette gets the selective colored
// outline, light overlays go on top, and the result is encoded as HDFrame { color, normal }
// plus an emissive mask (and optional debug stages).
//
//   const r = new HDRenderer(192, 192);
//   r.begin();
//   r.part('far-leg').tube(legPath, [6, 4], { mat: farSide(MAT.iceHide) });
//   r.part('body').ellipsoid([96, 110], 30, 24, { mat: MAT.iceHide });
//   r.part('eye', { lines: false, shadow: false }).sphere([120, 96], 3, { mat: MAT.eyeCyan, heat: 'radial' });
//   const frame = r.finish();             // { color, normal, emissive, ms }
//
// Cost: see README.md (≈ 4–15 ms for a 192×192 creature in V8; the renderer reuses all buffers).

import { PixelCanvas } from '../../art/pixel';
import type { HDFrame } from '../contracts';
import { EMPTY, GBuffer, LIT, type Brush } from './gbuffer';
import { FIXED, F_LINE, F_OUTLINE, F_OVERLAY, F_SHADOWED, FrameBuffers, contactKernel, outlinePass, toneColor } from './lines';
import { albedoTone, type HDMaterial } from './materials';
import { type V2, type V3, floor2 } from './math';
import * as prim from './primitives';
import { DEFAULT_RIG, GLINT, type LightRig, type MatInfo, NO_TONE, matInfo, shadePart } from './shading';

// ------------------------------------------------------------------ public types

/** How a primitive writes: material + optional per-primitive tone controls. */
export interface BrushOpts {
  mat: HDMaterial;
  /** Lit-intensity bias (+ lighter, − darker; ~0.15 ≈ one tone band). */
  bias?: number;
  /** Force a ramp index (flat authored tone, ignores light). */
  tone?: number;
  /** Clump / facet id (fur: higher id = on top). */
  id?: number;
  /** 'union' (default) depth-merge, 'over' always on top, 'under' only into empty pixels. */
  mode?: 'union' | 'over' | 'under';
}

export interface PartOptions {
  /** 1 px inner line where this part's edge lies over earlier parts (default true). */
  lines?: boolean;
  /** 2 px contact shadow cast on earlier parts (default true). */
  shadow?: boolean;
  /** Part of the silhouette outline (default true). False for light/energy that must stay soft. */
  outline?: boolean;
  /**
   * Compositing order (default: creation order). Parts are composited by ascending order, ties
   * by creation — lets a limb or wing switch between behind / in front per pose without
   * reordering the drawing code.
   */
  order?: number;
}

export interface RenderOptions {
  /** Light rig overrides (key direction, wrap, AO, baked rim). */
  light?: Partial<LightRig>;
  /** Selective silhouette outline (default true). */
  outline?: boolean;
  /** Inner lines between parts (default true). */
  innerLines?: boolean;
  /** Contact shadow band width in px, 0 = off (default 2). */
  contact?: number;
}

/** Output of one rendered frame. `color` + `normal` satisfy the HDFrame contract. */
export interface HDRenderResult extends HDFrame {
  /** RGB = pixel color, A = emissive strength (bloom mask). */
  emissive: PixelCanvas;
  /** Debug stages (only when finish({ stages: true })). */
  stages?: { albedo: PixelCanvas; normal: PixelCanvas; lit: PixelCanvas; final: PixelCanvas };
  /** Total time of this frame in ms, from begin() (primitives included) to the end of finish(). */
  ms: number;
  /** Breakdown in ms: rasterizing primitives (begin → finish), lighting, compositing, outline + overlays, encoding. */
  timing: { prims: number; shade: number; composite: number; outline: number; encode: number };
}

/** Post-shade painting on one part (eyes, veins, scars, glints). Coordinates are integer pixels. */
export interface DetailCtx {
  readonly w: number;
  readonly h: number;
  has(x: number, y: number): boolean;
  /** Ramp index at a pixel of this part (-1 if empty or explicitly colored). */
  tone(x: number, y: number): number;
  material(x: number, y: number): HDMaterial | null;
  normal(x: number, y: number): V3 | null;
  /** Explicit color. Only over this part's pixels unless `add` (then `mat` gives the outline colors). */
  set(x: number, y: number, color: number, o?: { emissive?: boolean; add?: boolean; mat?: HDMaterial }): void;
  /** Move a pixel along its own ramp (+ lighter / − darker). */
  shift(x: number, y: number, steps: number): void;
  /** Force a ramp index. */
  setTone(x: number, y: number, tone: number): void;
  /** 1 px Bresenham line of explicit color over this part's pixels. */
  line(a: V2, b: V2, color: number, o?: { emissive?: boolean; add?: boolean; mat?: HDMaterial }): void;
  /** 1 px line that shifts tones along the ramp instead of painting a color (creases, scale rows). */
  shiftLine(a: V2, b: V2, steps: number): void;
}

/** Light painted after the outline (glints, sparkles, smears): never outlined, never shaded. */
export interface OverlayCtx {
  readonly w: number;
  readonly h: number;
  has(x: number, y: number): boolean;
  get(x: number, y: number): number | null;
  isOutline(x: number, y: number): boolean;
  set(x: number, y: number, color: number, o?: { emissive?: number | boolean; alpha?: number; onlyOver?: boolean; onlyEmpty?: boolean }): void;
  line(a: V2, b: V2, color: number, o?: { emissive?: number | boolean; onlyOver?: boolean; onlyEmpty?: boolean }): void;
}

// ------------------------------------------------------------------ Part

type PartTubeOpts = Omit<prim.TubeOpts, 'belly' | 'rings'> & {
  belly?: { from: number; bias?: number; mat?: HDMaterial; tone?: number; side?: 1 | -1 };
  rings?: { every: number; width?: number; bias?: number; offset?: number; mat?: HDMaterial; from?: number; to?: number };
};

/** One layer of a frame. All primitive methods are chainable and take a material via BrushOpts. */
export class Part {
  readonly details: ((d: DetailCtx) => void)[] = [];
  readonly opts: Required<PartOptions>;

  constructor(
    readonly renderer: HDRenderer,
    readonly index: number,
    readonly name: string,
    readonly g: GBuffer,
    opts: PartOptions,
  ) {
    this.opts = { lines: opts.lines ?? true, shadow: opts.shadow ?? true, outline: opts.outline ?? true, order: opts.order ?? index };
  }

  /** Resolve material + options into a primitive brush. */
  brush(o: BrushOpts): Brush {
    return {
      mat: this.renderer.slot(o.mat),
      bias: o.bias ?? 0,
      tone: o.tone ?? LIT,
      id: o.id ?? 0,
      mode: o.mode === 'over' ? 1 : o.mode === 'under' ? 2 : 0,
    };
  }

  ellipsoid(c: V2, rx: number, ry: number, o: BrushOpts & prim.EllipsoidOpts): this {
    prim.ellipsoid(this.g, this.brush(o), c, rx, ry, o);
    return this;
  }

  sphere(c: V2, r: number, o: BrushOpts & prim.EllipsoidOpts): this {
    prim.sphere(this.g, this.brush(o), c, r, o);
    return this;
  }

  tube(path: readonly V2[], radius: prim.PerPoint, o: BrushOpts & PartTubeOpts): this {
    const b = this.brush(o);
    const t: prim.TubeOpts = { ...o, belly: undefined, rings: undefined };
    if (o.belly)
      t.belly = {
        from: o.belly.from,
        side: o.belly.side,
        brush: o.belly.mat || o.belly.tone !== undefined ? { ...b, mat: o.belly.mat ? this.renderer.slot(o.belly.mat) : b.mat, tone: o.belly.tone ?? LIT, bias: b.bias + (o.belly.bias ?? 0) } : undefined,
        bias: o.belly.bias,
      };
    if (o.rings)
      t.rings = { ...o.rings, brush: o.rings.mat ? { ...b, mat: this.renderer.slot(o.rings.mat), bias: b.bias + (o.rings.bias ?? 0) } : undefined };
    prim.tube(this.g, b, path, radius, t);
    return this;
  }

  capsule(a: V2, b: V2, ra: number, rb: number, o: BrushOpts & PartTubeOpts): this {
    return this.tube([a, b], [ra, rb], o);
  }

  facet(pts: readonly V2[], o: BrushOpts & prim.FacetOpts & { normal?: V3 }): this {
    prim.facet(this.g, this.brush(o), pts, o.normal, o);
    return this;
  }

  facet3(pts: readonly V3[], o: BrushOpts & prim.FacetOpts): this {
    prim.facet3(this.g, this.brush(o), pts, o);
    return this;
  }

  gem(outline: readonly V2[], o: BrushOpts & prim.GemOpts): this {
    prim.gem(this.g, this.brush(o), outline, o);
    return this;
  }

  cutGem(c: V2, rx: number, ry: number, o: BrushOpts & prim.CutGemOpts): this {
    prim.cutGem(this.g, this.brush(o), c, rx, ry, o);
    return this;
  }

  shard(base: V2, tip: V2, halfWidth: number, o: BrushOpts & prim.ShardOpts): this {
    prim.shard(this.g, this.brush(o), base, tip, halfWidth, o);
    return this;
  }

  membrane(pts: readonly V2[], o: BrushOpts & prim.MembraneOpts): this {
    prim.membrane(this.g, this.brush(o), pts, o);
    return this;
  }

  cloth(top: readonly V2[], bottom: readonly V2[], o: BrushOpts & prim.ClothOpts): this {
    prim.cloth(this.g, this.brush(o), top, bottom, o);
    return this;
  }

  flame(o: BrushOpts & prim.FlameOpts): this {
    prim.flame(this.g, this.brush(o), o);
    return this;
  }

  wisp(spine: readonly V2[], width: number, t: number, o: BrushOpts & Partial<prim.FlameOpts>): this {
    prim.wisp(this.g, this.brush(o), spine, width, t, o);
    return this;
  }

  furClump(root: V2, tip: V2, width: number, o: BrushOpts & prim.ClumpOpts): this {
    prim.furClump(this.g, this.brush(o), root, tip, width, o);
    return this;
  }

  furFringe(path: readonly V2[], o: BrushOpts & prim.FringeOpts): this {
    prim.furFringe(this.g, this.brush(o), path, o);
    return this;
  }

  furCoat(c: V2, rx: number, ry: number, o: BrushOpts & prim.CoatOpts): this {
    prim.furCoat(this.g, this.brush(o), c, rx, ry, o);
    return this;
  }

  /** Darken (−) / lighten (+) covered pixels inside a polygon (lighting bias decal). */
  bias(pts: readonly V2[], delta: number): this {
    prim.biasPoly(this.g, pts, delta);
    return this;
  }

  biasWhere(fn: (x: number, y: number) => number): this {
    prim.biasWhere(this.g, fn);
    return this;
  }

  /** Repaint covered pixels inside a polygon with another material / tone (markings, plates). */
  paint(pts: readonly V2[], o: BrushOpts): this {
    prim.paintPoly(this.g, this.brush(o), pts);
    return this;
  }

  /** Queue post-shade painting (eyes, veins, glints). Runs at finish(), before compositing. */
  detail(fn: (d: DetailCtx) => void): this {
    this.details.push(fn);
    return this;
  }

  has(x: number, y: number): boolean {
    return this.g.has(Math.floor(x), Math.floor(y));
  }

  normalAt(p: V2): V3 | null {
    return prim.normalAt(this.g, p[0], p[1]);
  }

  depthAt(p: V2): number | null {
    return prim.depthAt(this.g, p[0], p[1]);
  }
}

// ------------------------------------------------------------------ renderer

export class HDRenderer {
  readonly w: number;
  readonly h: number;
  rig: LightRig;
  readonly options: Required<RenderOptions>;
  private readonly pool: GBuffer[] = [];
  private parts: Part[] = [];
  private mats: HDMaterial[] = [];
  private matIndex = new Map<HDMaterial, number>();
  private infos: MatInfo[] = [];
  private overlays: ((o: OverlayCtx) => void)[] = [];
  private readonly F: FrameBuffers;
  private readonly ptone: Int8Array;
  private readonly ptmp: Int8Array;
  private readonly pcol: Int32Array;
  private readonly pemit: Uint8Array;
  private readonly shadow: Int8Array;
  private kernel: [number, number, number][];
  private kernelFlat: Int32Array;
  private t0 = 0;

  constructor(w: number, h: number, o: RenderOptions = {}) {
    this.w = w;
    this.h = h;
    this.rig = { ...DEFAULT_RIG, ...(o.light ?? {}) };
    this.options = { light: o.light ?? {}, outline: o.outline ?? true, innerLines: o.innerLines ?? true, contact: o.contact ?? 2 };
    const n = w * h;
    this.F = new FrameBuffers(w, h);
    this.ptone = new Int8Array(n).fill(NO_TONE);
    this.ptmp = new Int8Array(n);
    this.pcol = new Int32Array(n).fill(-1);
    this.pemit = new Uint8Array(n);
    this.shadow = new Int8Array(n);
    this.kernel = contactKernel(this.rig.key, this.options.contact);
    this.kernelFlat = Int32Array.from(this.kernel.flat());
  }

  /** Start a new frame (recycles every part buffer). */
  begin(): this {
    this.t0 = now();
    for (const p of this.parts) p.g.reset();
    this.parts = [];
    this.overlays = [];
    this.mats = [];
    this.infos = [];
    this.matIndex.clear();
    this.kernel = contactKernel(this.rig.key, this.options.contact);
    this.kernelFlat = Int32Array.from(this.kernel.flat());
    return this;
  }

  /** Add a layer on top of all previous ones. */
  part(name = 'part', o: PartOptions = {}): Part {
    const k = this.parts.length;
    if (k >= this.pool.length) this.pool.push(new GBuffer(this.w, this.h));
    const g = this.pool[k].reset();
    const p = new Part(this, k, name, g, o);
    this.parts.push(p);
    return p;
  }

  /** An existing part of this frame by name (the first with that name), to add more to it. */
  getPart(name: string): Part | undefined {
    return this.parts.find((p) => p.name === name);
  }

  /** begin() → draw(r) → finish(): one frame in one call. */
  frame(draw: (r: HDRenderer) => void, o: { stages?: boolean } = {}): HDRenderResult {
    this.begin();
    draw(this);
    return this.finish(o);
  }

  /** Queue light painted after the outline (never outlined / shaded). */
  overlay(fn: (o: OverlayCtx) => void): this {
    this.overlays.push(fn);
    return this;
  }

  /** Material slot for this frame. */
  slot(m: HDMaterial): number {
    let i = this.matIndex.get(m);
    if (i === undefined) {
      i = this.mats.length;
      this.mats.push(m);
      this.infos.push(matInfo(m, this.rig));
      this.matIndex.set(m, i);
    }
    return i;
  }

  /** Light, composite, outline and encode the frame. */
  finish(o: { stages?: boolean } = {}): HDRenderResult {
    const F = this.F;
    const t1 = now();
    let tShade = 0;
    let tComp = 0;
    F.reset();
    const ordered = this.parts.slice().sort((a, b) => a.opts.order - b.opts.order || a.index - b.index);
    for (let k = 0; k < ordered.length; k++) {
      const part = ordered[k];
      const g = part.g;
      if (g.empty) continue;
      const ta = now();
      shadePart(g, this.infos, this.rig, this.ptone, this.ptmp);
      const tb = now();
      tShade += tb - ta;
      for (let y = g.y0; y <= g.y1; y++) {
        const a = y * this.w + g.x0;
        const b = y * this.w + g.x1 + 1;
        this.pcol.fill(-1, a, b);
        this.pemit.fill(0, a, b);
      }
      if (part.details.length) {
        const ctx = this.detailCtx(part);
        for (const fn of part.details) fn(ctx);
      }
      this.composite(part);
      tComp += now() - tb;
    }
    const t2 = now();
    if (this.options.outline) {
      const skip = new Uint8Array(Math.max(1, this.parts.length));
      for (const p of this.parts) skip[p.index] = p.opts.outline ? 0 : 1;
      outlinePass(F, this.infos, this.rig.key, skip);
    }
    if (this.overlays.length) {
      const ctx = this.overlayCtx();
      for (const fn of this.overlays) fn(ctx);
    }
    const t3 = now();
    const res = this.encode(!!o.stages);
    const t4 = now();
    res.ms = t4 - this.t0;
    res.timing = { prims: t1 - this.t0, shade: tShade, composite: tComp, outline: t3 - t2, encode: t4 - t3 };
    return res;
  }

  // ---------------------------------------------------------------- internals

  private composite(part: Part): void {
    const F = this.F;
    const g = part.g;
    const W = this.w;
    const H = this.h;
    const infos = this.infos;
    const tone = this.ptone;
    const k = part.index;
    const key = this.rig.key;
    const kl = Math.hypot(key[0], key[1]) || 1;
    const lx = key[0] / kl;
    const ly = key[1] / kl;
    const ex0 = Math.max(0, g.x0 - 3);
    const ey0 = Math.max(0, g.y0 - 3);
    const ex1 = Math.min(W - 1, g.x1 + 3);
    const ey1 = Math.min(H - 1, g.y1 + 3);

    // 1) contact shadow on what is already there
    if (part.opts.shadow && this.kernel.length) {
      const S = this.shadow;
      const KR = this.kernelFlat;
      const KN = KR.length;
      for (let y = ey0; y <= ey1; y++) S.fill(0, y * W + ex0, y * W + ex1 + 1);
      let any = false;
      for (let y = g.y0; y <= g.y1; y++)
        for (let x = g.x0; x <= g.x1; x++) {
          const i = y * W + x;
          const mi = g.mat[i];
          if (mi === EMPTY) continue;
          const MI = infos[mi];
          if (MI.emissive || MI.translucent) continue;
          // interior pixels cannot reach outside the part (the kernel spans ≤ 2 px)
          if (
            x > 1 && y > 1 && x < W - 2 && y < H - 2 &&
            g.mat[i + 1] !== EMPTY && g.mat[i - 1] !== EMPTY && g.mat[i + W] !== EMPTY && g.mat[i - W] !== EMPTY &&
            g.mat[i + 2] !== EMPTY && g.mat[i + 2 * W] !== EMPTY && g.mat[i + 2 * W + 2] !== EMPTY && g.mat[i + W + 1] !== EMPTY &&
            g.mat[i + 2 * W + 1] !== EMPTY && g.mat[i + W + 2] !== EMPTY
          )
            continue;
          for (let q = 0; q < KN; q += 3) {
            const sx = x + KR[q];
            const sy = y + KR[q + 1];
            if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
            const j = sy * W + sx;
            if (g.mat[j] !== EMPTY || F.alpha[j] === 0) continue;
            const st = KR[q + 2];
            if (st > S[j]) {
              S[j] = st;
              any = true;
            }
          }
        }
      if (any)
        for (let y = ey0; y <= ey1; y++)
          for (let x = ex0; x <= ex1; x++) {
            const j = y * W + x;
            const st = S[j];
            if (!st || F.tone[j] === FIXED || F.mat[j] < 0) continue;
            const M = infos[F.mat[j]];
            if (M.emissive) continue;
            F.tone[j] -= st;
            F.col[j] = toneColor(M, F.tone[j]);
            F.flags[j] |= F_SHADOWED;
          }
    }

    // 2) write the part (with inner lines along edges that lie over earlier parts)
    const lines = this.options.innerLines && part.opts.lines;
    for (let y = g.y0; y <= g.y1; y++)
      for (let x = g.x0; x <= g.x1; x++) {
        const i = y * W + x;
        const mi = g.mat[i];
        if (mi === EMPTY) continue;
        const M = infos[mi];
        const t = tone[i];
        const behind = F.alpha[i] > 0;
        let col: number;
        let tv: number;
        if (this.pcol[i] >= 0) {
          col = this.pcol[i];
          tv = FIXED;
        } else if (t === GLINT) {
          col = M.spec ? M.spec.color : M.ramp[M.n - 1];
          tv = FIXED;
        } else {
          tv = t === NO_TONE ? 0 : t;
          if (M.translucent && behind) tv = Math.max(0, Math.min(M.n - 1, tv + (M.m.translucent!.behind ?? -1)));
          col = toneColor(M, tv);
        }
        const litCol = col;
        let isLine = false;
        if (lines) {
          for (let q = 0; q < 4; q++) {
            const dx = q === 0 ? -1 : q === 1 ? 1 : 0;
            const dy = q === 2 ? -1 : q === 3 ? 1 : 0;
            const sx = x + dx;
            const sy = y + dy;
            if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
            const j = sy * W + sx;
            if (g.mat[j] !== EMPTY || F.alpha[j] === 0) continue;
            // edge over an earlier part: selective inner line
            const facing = dx * lx + dy * ly;
            const nl = g.nx[i] * key[0] + g.ny[i] * key[1] + g.nz[i] * key[2];
            const lit = 0.6 * facing + 0.4 * nl > 0.2;
            if (lit) {
              if (tv !== FIXED) col = toneColor(M, Math.max(0, tv - 2));
            } else col = M.m.line ?? M.m.outline.dark;
            isLine = true;
            break;
          }
        }
        F.col[i] = col;
        F.tone[i] = isLine ? FIXED : tv;
        F.mat[i] = mi;
        F.part[i] = k;
        F.alpha[i] = M.translucent && !behind ? Math.round((M.m.translucent!.alpha ?? 1) * 255) : 255;
        F.nx[i] = g.nx[i];
        F.ny[i] = g.ny[i];
        F.nz[i] = g.nz[i];
        F.emit[i] = this.pemit[i] ? this.pemit[i] : M.emissive ? (tv === FIXED ? 255 : Math.round(110 + (145 * Math.max(0, tv)) / Math.max(1, M.n - 1))) : 0;
        F.lit[i] = litCol;
        F.alb[i] = this.pcol[i] >= 0 ? this.pcol[i] : M.ramp[albedoTone(M.m)];
        F.flags[i] = isLine ? F_LINE : 0;
      }
  }

  private detailCtx(part: Part): DetailCtx {
    const g = part.g;
    const W = this.w;
    const H = this.h;
    const tone = this.ptone;
    const pcol = this.pcol;
    const pemit = this.pemit;
    const infos = this.infos;
    let lastMat = -1;
    for (let i = g.y0 * W; i < (g.y1 + 1) * W && lastMat < 0; i++) if (g.mat[i] >= 0) lastMat = g.mat[i];
    const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const set = (x: number, y: number, color: number, o?: { emissive?: boolean; add?: boolean; mat?: HDMaterial }) => {
      x = Math.floor(x);
      y = Math.floor(y);
      if (!inB(x, y)) return;
      const i = y * W + x;
      if (g.mat[i] === EMPTY) {
        if (!o?.add) return;
        const mi = o.mat ? this.slot(o.mat) : lastMat;
        if (mi < 0) return;
        g.put(x, y, 0, 0, 1, 1e6, { mat: mi, bias: 0, tone: 0, id: 0, mode: 1 });
        tone[i] = 0;
      }
      pcol[i] = color;
      if (o?.emissive) pemit[i] = 255;
    };
    const bres = (a: V2, b: V2, fn: (x: number, y: number) => void) => {
      let [x0, y0] = floor2(a);
      const [x1, y1] = floor2(b);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        fn(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    };
    const shift = (x: number, y: number, steps: number) => {
      x = Math.floor(x);
      y = Math.floor(y);
      if (!inB(x, y)) return;
      const i = y * W + x;
      if (g.mat[i] === EMPTY || pcol[i] >= 0) return;
      const t = tone[i];
      if (t === GLINT || t === NO_TONE) return;
      tone[i] = Math.max(0, Math.min(infos[g.mat[i]].n - 1, t + steps));
    };
    return {
      w: W,
      h: H,
      has: (x, y) => g.has(Math.floor(x), Math.floor(y)),
      tone: (x, y) => {
        x = Math.floor(x);
        y = Math.floor(y);
        if (!g.has(x, y)) return -1;
        const i = y * W + x;
        const t = tone[i];
        return pcol[i] >= 0 || t === GLINT || t === NO_TONE ? -1 : t;
      },
      material: (x, y) => {
        x = Math.floor(x);
        y = Math.floor(y);
        return g.has(x, y) ? infos[g.mat[y * W + x]].m : null;
      },
      normal: (x, y) => prim.normalAt(g, x, y),
      set,
      shift,
      setTone: (x, y, t) => {
        x = Math.floor(x);
        y = Math.floor(y);
        if (!g.has(x, y)) return;
        const i = y * W + x;
        tone[i] = Math.max(0, Math.min(infos[g.mat[i]].n - 1, t));
        pcol[i] = -1;
      },
      line: (a, b, color, o) => bres(a, b, (x, y) => set(x, y, color, o)),
      shiftLine: (a, b, steps) => bres(a, b, (x, y) => shift(x, y, steps)),
    };
  }

  private overlayCtx(): OverlayCtx {
    const F = this.F;
    const W = this.w;
    const H = this.h;
    const set = (x: number, y: number, color: number, o?: { emissive?: number | boolean; alpha?: number; onlyOver?: boolean; onlyEmpty?: boolean }) => {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      const filled = F.alpha[i] > 0;
      if (o?.onlyOver && (!filled || F.flags[i] & F_OUTLINE)) return;
      if (o?.onlyEmpty && filled) return;
      if (!filled) {
        F.nx[i] = 0;
        F.ny[i] = 0;
        F.nz[i] = 1;
      }
      F.col[i] = color;
      F.alpha[i] = Math.round(255 * (o?.alpha ?? 1));
      F.tone[i] = FIXED;
      F.flags[i] |= F_OVERLAY;
      const e = o?.emissive;
      if (e !== undefined) F.emit[i] = e === true ? 255 : e === false ? 0 : Math.max(0, Math.min(255, Math.round(e)));
    };
    return {
      w: W,
      h: H,
      has: (x, y) => F.has(Math.floor(x), Math.floor(y)),
      get: (x, y) => {
        x = Math.floor(x);
        y = Math.floor(y);
        return F.has(x, y) ? F.col[y * W + x] : null;
      },
      isOutline: (x, y) => {
        x = Math.floor(x);
        y = Math.floor(y);
        return F.has(x, y) && (F.flags[y * W + x] & F_OUTLINE) !== 0;
      },
      set,
      line: (a, b, color, o) => {
        let [x0, y0] = floor2(a);
        const [x1, y1] = floor2(b);
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          set(x0, y0, color, o);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) {
            err += dy;
            x0 += sx;
          }
          if (e2 <= dx) {
            err += dx;
            y0 += sy;
          }
        }
      },
    };
  }

  private encode(stages: boolean): HDRenderResult {
    const F = this.F;
    const n = this.w * this.h;
    const color = new PixelCanvas(this.w, this.h);
    const normal = new PixelCanvas(this.w, this.h);
    const emissive = new PixelCanvas(this.w, this.h);
    const cd = color.data;
    const nd = normal.data;
    const ed = emissive.data;
    for (let i = 0; i < n; i++) {
      const a = F.alpha[i];
      if (!a) continue;
      const o = i * 4;
      const c = F.col[i];
      const r = (c >> 16) & 255;
      const gg = (c >> 8) & 255;
      const b = c & 255;
      cd[o] = r;
      cd[o + 1] = gg;
      cd[o + 2] = b;
      cd[o + 3] = a;
      // normal map: RGB = n * 0.5 + 0.5 with +Y UP (Phaser Light2D / OpenGL convention)
      nd[o] = Math.round((F.nx[i] * 0.5 + 0.5) * 255);
      nd[o + 1] = Math.round((-F.ny[i] * 0.5 + 0.5) * 255);
      nd[o + 2] = Math.round((F.nz[i] * 0.5 + 0.5) * 255);
      nd[o + 3] = a;
      if (F.emit[i]) {
        ed[o] = r;
        ed[o + 1] = gg;
        ed[o + 2] = b;
        ed[o + 3] = F.emit[i];
      }
    }
    const res: HDRenderResult = { color, normal, emissive, ms: 0, timing: { prims: 0, shade: 0, composite: 0, outline: 0, encode: 0 } };
    if (stages) {
      const albedo = new PixelCanvas(this.w, this.h);
      const lit = new PixelCanvas(this.w, this.h);
      for (let i = 0; i < n; i++) {
        if (!F.alpha[i] || F.part[i] < 0 || F.flags[i] & (F_OUTLINE | F_OVERLAY)) continue;
        const o = i * 4;
        const al = F.alb[i];
        const li = F.lit[i];
        albedo.data[o] = (al >> 16) & 255;
        albedo.data[o + 1] = (al >> 8) & 255;
        albedo.data[o + 2] = al & 255;
        albedo.data[o + 3] = 255;
        lit.data[o] = (li >> 16) & 255;
        lit.data[o + 1] = (li >> 8) & 255;
        lit.data[o + 2] = li & 255;
        lit.data[o + 3] = 255;
      }
      res.stages = { albedo, normal, lit, final: color };
    }
    return res;
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
