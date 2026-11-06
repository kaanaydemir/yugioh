// Rebuild a texture-atlas frame at its REAL (untrimmed) size. A cropped / trimmed atlas frame stores only its opaque box
// (cutWidth × cutHeight) plus where that box sits inside the original frame (frame.x / frame.y) and the original size
// (realWidth / realHeight). Phaser draws a sprite's frame at its display origin as if it were the full real frame, with
// the cut at (x, y); under flipX the whole real frame mirrors, so the cut lands at realWidth − x − cutWidth.
// Tools that read sprite pixels (tools/contact-probe.mjs) must therefore work on the full real frame, not the cut.
//
// Pure (no DOM): also passed into the page as source text (contact-probe's page.evaluate cannot import modules).

/**
 * @param {{ data: Uint8ClampedArray | Uint8Array, w: number, h: number }} cut  RGBA of the cut box
 * @param {{ x?: number, y?: number, realWidth?: number, realHeight?: number }} frame  the frame's trim data
 * @returns {{ data: Uint8ClampedArray, w: number, h: number }} RGBA of the full real frame (transparent outside the cut)
 */
export function untrimFrame(cut, frame) {
  const ox = Math.round(frame.x || 0);
  const oy = Math.round(frame.y || 0);
  const w = Math.max(cut.w, Math.round(frame.realWidth || cut.w));
  const h = Math.max(cut.h, Math.round(frame.realHeight || cut.h));
  if (ox === 0 && oy === 0 && w === cut.w && h === cut.h) return { data: new Uint8ClampedArray(cut.data), w, h };
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < cut.h; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= h) continue;
    for (let x = 0; x < cut.w; x++) {
      const tx = x + ox;
      if (tx < 0 || tx >= w) continue;
      const si = (y * cut.w + x) * 4;
      const di = (ty * w + tx) * 4;
      data[di] = cut.data[si];
      data[di + 1] = cut.data[si + 1];
      data[di + 2] = cut.data[si + 2];
      data[di + 3] = cut.data[si + 3];
    }
  }
  return { data, w, h };
}
