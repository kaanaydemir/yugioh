// HD render — the per-part G-buffer. Every primitive rasterizes into one of these: per pixel
// a material slot, a unit surface normal (screen space: x right, y DOWN, z toward viewer),
// a depth, a lighting bias, an optional forced tone, an emissive "heat" and a clump/facet id.
//
// Inside one buffer primitives are depth-tested (higher z wins), so overlapping volumes merge
// like clay with the right normal on top. Separate parts get separate buffers and are
// composited back-to-front by the renderer (that is where inner lines and contact shadows
// appear). Buffers track a dirty bounding box so clearing and shading only touch what was drawn.

export const EMPTY = -1;
/** `tone` value meaning "no forced tone: light it". */
export const LIT = -1;

/** Resolved write state for a primitive (material slot + per-primitive constants). */
export interface Brush {
  /** Material slot (index into the renderer's material table). */
  mat: number;
  /** Lighting bias added to the lit intensity (0..1 scale; ~±0.15 is about one tone band). */
  bias: number;
  /** Forced ramp index (authored flat tone) or LIT (-1). */
  tone: number;
  /** Clump / facet id (0 = none). Used by fur clump lines and crystal edge light. */
  id: number;
  /** 0 = depth union (default), 1 = over (always write), 2 = under (only empty pixels). */
  mode: 0 | 1 | 2;
}

export class GBuffer {
  readonly w: number;
  readonly h: number;
  readonly mat: Int16Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  readonly z: Float32Array;
  readonly bias: Float32Array;
  readonly tone: Int8Array;
  readonly heat: Float32Array;
  readonly id: Uint16Array;
  /** Dirty bounds (inclusive). Empty when x1 < x0. */
  x0 = 0;
  y0 = 0;
  x1 = -1;
  y1 = -1;
  /** Draw-order counter (fur clumps use it so later clumps sit on top). Reset with the buffer. */
  seq = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.mat = new Int16Array(n).fill(EMPTY);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.z = new Float32Array(n).fill(-1e9);
    this.bias = new Float32Array(n);
    this.tone = new Int8Array(n).fill(LIT);
    this.heat = new Float32Array(n);
    this.id = new Uint16Array(n);
  }

  get empty(): boolean {
    return this.x1 < this.x0;
  }

  /** Clear only the dirty region. */
  reset(): this {
    if (this.x1 >= this.x0) {
      for (let y = this.y0; y <= this.y1; y++) {
        const a = y * this.w + this.x0;
        const b = y * this.w + this.x1 + 1;
        this.mat.fill(EMPTY, a, b);
        this.z.fill(-1e9, a, b);
        this.bias.fill(0, a, b);
        this.tone.fill(LIT, a, b);
        this.heat.fill(0, a, b);
        this.id.fill(0, a, b);
      }
    }
    this.x0 = this.w;
    this.y0 = this.h;
    this.x1 = -1;
    this.y1 = -1;
    this.seq = 0;
    return this;
  }

  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.mat[y * this.w + x] !== EMPTY;
  }

  /**
   * Write one pixel (depth-tested per brush mode). The normal need not be normalized.
   * Returns true if the pixel was written.
   */
  put(x: number, y: number, nx: number, ny: number, nz: number, z: number, b: Brush, heat = 0): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const i = y * this.w + x;
    const cur = this.mat[i];
    if (b.mode === 0) {
      if (cur !== EMPTY && z < this.z[i]) return false;
    } else if (b.mode === 2) {
      if (cur !== EMPTY) return false;
    }
    let m = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (m < 1e-6) {
      nx = 0;
      ny = 0;
      nz = 1;
      m = 1;
    }
    this.mat[i] = b.mat;
    this.nx[i] = nx / m;
    this.ny[i] = ny / m;
    this.nz[i] = nz / m;
    this.z[i] = z;
    this.bias[i] = b.bias;
    this.tone[i] = b.tone;
    this.heat[i] = heat;
    this.id[i] = b.id;
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
    return true;
  }
}
