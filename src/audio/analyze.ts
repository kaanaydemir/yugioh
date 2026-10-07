// Offline analysis helpers for ?dev=audio: level stats, waveform columns, spectrograms.
// Pure functions over AudioBuffers (no Phaser, no live context).

export interface Stats {
  /** Absolute sample peak over both channels. */
  peak: number;
  /** RMS over the audible part, dBFS. */
  rmsDb: number;
  /** Loudest 50 ms window, dBFS (perceived punch). */
  maxWinDb: number;
  /** Seconds until the signal falls below −50 dB of its peak for good. */
  len: number;
  /** Time of the loudest 50 ms window (s). */
  peakAt: number;
}

const db = (x: number) => (x > 1e-9 ? 20 * Math.log10(x) : -180);

/** Mono view (mean of channels). */
export function mono(b: AudioBuffer): Float32Array {
  const n = b.length;
  const out = new Float32Array(n);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / b.numberOfChannels;
  }
  return out;
}

export function stats(b: AudioBuffer): Stats {
  let peak = 0;
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
    }
  }
  const m = mono(b);
  const sr = b.sampleRate;
  // length: last 10 ms window whose rms is above peak −50 dB
  const win = Math.floor(sr * 0.01);
  const thr = peak * Math.pow(10, -50 / 20);
  let last = 0;
  for (let i = 0; i + win <= m.length; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) s += m[i + j] * m[i + j];
    if (Math.sqrt(s / win) > thr) last = i + win;
  }
  let sum = 0;
  for (let i = 0; i < last; i++) sum += m[i] * m[i];
  const rms = last ? Math.sqrt(sum / last) : 0;
  const w50 = Math.floor(sr * 0.05);
  let best = 0;
  let bestAt = 0;
  for (let i = 0; i + w50 <= m.length; i += Math.floor(w50 / 2)) {
    let s = 0;
    for (let j = 0; j < w50; j++) s += m[i + j] * m[i + j];
    const r = Math.sqrt(s / w50);
    if (r > best) {
      best = r;
      bestAt = i / sr;
    }
  }
  return { peak, rmsDb: db(rms), maxWinDb: db(best), len: last / sr, peakAt: bestAt };
}

/** Per-column min / max / rms of the mono signal over [0, len) seconds. */
export function columns(b: AudioBuffer, n: number, len: number): { min: Float32Array; max: Float32Array; rms: Float32Array } {
  const m = mono(b);
  const total = Math.min(m.length, Math.max(1, Math.floor(len * b.sampleRate)));
  const min = new Float32Array(n);
  const max = new Float32Array(n);
  const rms = new Float32Array(n);
  for (let c = 0; c < n; c++) {
    const a = Math.floor((c / n) * total);
    const z = Math.max(a + 1, Math.floor(((c + 1) / n) * total));
    let lo = 0;
    let hi = 0;
    let s = 0;
    for (let i = a; i < z; i++) {
      const v = m[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      s += v * v;
    }
    min[c] = lo;
    max[c] = hi;
    rms[c] = Math.sqrt(s / (z - a));
  }
  return { min, max, rms };
}

// ------------------------------------------------------------------ FFT / spectrogram

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * Log-frequency spectrogram: `cols` × `rows` dB values (row 0 = top = fHi).
 * Values are dBFS-ish (relative to a full-scale sine ≈ 0 dB).
 */
export function spectrogram(b: AudioBuffer, cols: number, rows: number, len: number, fLo = 40, fHi = 16000, size = 2048): Float32Array {
  const m = mono(b);
  const sr = b.sampleRate;
  const total = Math.min(m.length, Math.floor(len * sr));
  const out = new Float32Array(cols * rows).fill(-120);
  const win = new Float64Array(size);
  for (let i = 0; i < size; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const mag = new Float64Array(size / 2);
  const norm = 4 / size; // hann window + one-sided
  for (let c = 0; c < cols; c++) {
    const centre = Math.floor(((c + 0.5) / cols) * total);
    const start = centre - size / 2;
    for (let i = 0; i < size; i++) {
      const k = start + i;
      re[i] = k >= 0 && k < m.length ? m[k] * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let i = 0; i < size / 2; i++) mag[i] = Math.hypot(re[i], im[i]) * norm;
    for (let r = 0; r < rows; r++) {
      // row band edges in log frequency
      const f0 = fLo * Math.pow(fHi / fLo, (rows - 1 - r) / rows);
      const f1 = fLo * Math.pow(fHi / fLo, (rows - r) / rows);
      const b0 = Math.max(1, Math.floor((f0 / sr) * size));
      const b1 = Math.max(b0 + 1, Math.ceil((f1 / sr) * size));
      let best = 0;
      for (let i = b0; i < b1 && i < mag.length; i++) if (mag[i] > best) best = mag[i];
      out[r * cols + c] = db(best);
    }
  }
  return out;
}
