// Shots for the r/indiegaming clip (marketing/reddit). Same format as marketing/trailer/build/shots.mjs.
//   node marketing/trailer/build/capture.mjs --shots ../../reddit/shots.mjs
const shot = (name, query, inF, frames, o = {}) => ({ name: 'rd_' + name, query, fresh: true, in: inF, start: (inF * 1000) / 60, frames, ...o });
export const SHOTS = [
  shot('summon', '?dev=duel&s=suWyrm&look=v3', 0, 200),
  shot('clash', '?dev=steam&s=stWyrmHitsDrake&look=v3', 20, 200, { zoom: [2, 310, 130] }),
  shot('board', '?dev=trailer&s=trBoard&look=v3', 0, 420),
];
