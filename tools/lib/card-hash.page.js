// In-page part of tools/card-hash.ts: evaluated as TEXT by page.evaluate (an async function
// expression called at once), so neither vite-node's transform nor a bundler touches it. Returns
// { entries, textures, frames, ids, deterministic, nondeterministic, errors } — see card-hash.ts.
(async () => {
  const N = window.__neon;
  const load = new Function('u', 'return import(u)'); // the game's own module instances
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const sha = async (u8) => hex(await crypto.subtle.digest('SHA-256', u8));
  const entries = {};
  const errors = [];

  // 1. every card:* texture of the texture manager: the whole source and its named frames
  const tm = N.game.textures;
  const keys = tm.getTextureKeys().filter((k) => k.startsWith('card:')).sort();
  let frames = 0;
  for (const key of keys) {
    const tex = tm.get(key);
    const src = tex.source[0];
    const img = src.image;
    const W = src.width;
    const H = src.height;
    let data;
    try {
      if (img instanceof HTMLCanvasElement) data = img.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
      else {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        data = g.getImageData(0, 0, W, H).data;
      }
    } catch (e) {
      errors.push(`${key}: ${String(e)}`);
      continue;
    }
    entries[`tex:${key}`] = `${W}x${H}:${await sha(data)}`;
    for (const name of tex.getFrameNames().sort()) {
      const f = tex.get(name);
      const fx = f.cutX;
      const fy = f.cutY;
      const fw = f.cutWidth;
      const fh = f.cutHeight;
      const sub = new Uint8Array(fw * fh * 4);
      for (let y = 0; y < fh; y++) sub.set(data.subarray(((fy + y) * W + fx) * 4, ((fy + y) * W + fx + fw) * 4), y * fw * 4);
      entries[`tex:${key}#${name}`] = `${fx},${fy},${fw}x${fh}:${await sha(sub)}`;
      frames++;
    }
  }

  // 2. the pixel sources of src/art/cards.ts
  const C = await load('/src/art/cards.ts');
  const D = await load('/src/data/cards.ts');
  const ids = [...D.ALL_CARD_IDS];
  const pc = async (p) => `${p.w}x${p.h}:${await sha(p.data)}`;
  const sources = async (order, fresh) => {
    const e = {};
    for (const id of order) {
      e[`src:face:${id}`] = await pc(C.cardFaceCanvas(id));
      e[`src:art:${id}`] = await pc(C.cardArtCanvas(id));
      const mip = C.cardMip(id);
      for (let l = 0; l < mip.levels.length; l++) e[`src:mip:${id}:${l}`] = await pc(mip.levels[l]);
    }
    for (const p of [0, 1]) {
      e[`src:back:p${p + 1}`] = await pc(C.cardBackCanvas(p));
      const bm = C.cardMip('back', p);
      for (let l = 0; l < bm.levels.length; l++) e[`src:backmip:p${p + 1}:${l}`] = await pc(bm.levels[l]);
      e[`key:back:p${p + 1}`] = typeof C.cardBackKey === 'function' ? String(C.cardBackKey(p)) : String(C.CARD_BACK);
    }
    for (const o of ['up', 'side']) {
      for (const p of [0, 1]) {
        for (const id of [...order, 'back']) {
          // the iso cache was filled at boot; the second pass renders afresh from the new mips
          e[`src:iso:${id}:${o}:p${p + 1}`] = await pc(fresh ? C.renderFlat(id, o, p) : C.isoCanvas(id, o, p));
        }
      }
    }
    return e;
  };
  const first = await sources(ids, false);
  Object.assign(entries, first);

  // determinism: empty the caches and draw everything again, in reverse order
  let deterministic = true;
  const nondeterministic = [];
  if (typeof C.resetCardCaches === 'function') {
    C.resetCardCaches();
    const again = await sources([...ids].reverse(), true);
    for (const [k, v] of Object.entries(again)) {
      if (first[k] !== v) {
        deterministic = false;
        if (nondeterministic.length < 20) nondeterministic.push(k);
      }
    }
  } else errors.push('no resetCardCaches(): determinism not checked');
  for (const e of N.errors ?? []) errors.push(String(e));
  return { entries, textures: keys.length, frames, ids, deterministic, nondeterministic, errors };
})();
