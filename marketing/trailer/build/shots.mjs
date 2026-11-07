// The trailer's edit decision list. One entry per shot, in timeline order.
//
//   bars    length on the music grid (the duel track, 136 bpm: 1 bar = 16 sixteenths = 1.7647 s);
//           every cut lands on a bar (or half-bar) line of the music
//   in      the capture frame (60 fps) the shot starts on; frames before it are pre-roll
//   query   page + query (?test=1 is added); fresh: restart the duel scenario under the frozen clock
//   zoom    [z, x, y]: the world camera held at an integer zoom z on world point (x, y) (HUD / cut-ins
//           stay at 1×, as in the game's own close-ups)
//   setup   JS run once after the freeze; at: { frame: JS } run before that frame is stepped
//   tail    extra frames after the timeline end (the end card's hold)
export const BPM = 136;
export const FPS = 60;
export const BAR_SEC = (60 / BPM) * 4;

const duel = (s, o = {}) => ({ query: `?dev=duel&s=${s}&look=v3`, fresh: true, ...o });
const z2 = (x, y) => [2, x, y];

/** Hide the title's "click to start" prompt before every render (the trailer's own words take its place). */
const NO_PROMPT = `const T = window.__neon.game.scene.getScene('Title'); T.events.on('prerender', () => T.prompt.hide());`;

export const EDIT = [
  // ---- cold open: Crystal Wyrm's tribute summon, the pillar and the gold cut-in
  { name: 'coldWyrm', ...duel('suWyrm'), in: 0, bars: 2, label: 'Crystal Wyrm tribute summon + cut-in' },
  // ---- the logo ignites (real title intro), ignition flash on the bar line
  { name: 'logo', query: '?dev=title&sync=1&look=v3', setup: NO_PROMPT, in: 62, bars: 2, label: 'PRISM DUEL logo ignition + prism pass (title intro)' },
  // ---- montage 1
  { name: 'card0', query: '?dev=trailer&card=0&sync=1', in: 0, bars: 1, label: 'text: EVERY CARD IS A SHOW' },
  { name: 'ashenSummon', ...duel('kaAdSummon'), in: 110, bars: 1, label: 'Ashen Drake tribute summon cut-in' },
  { name: 'ashenAtk', ...duel('kaAdAtk'), zoom: z2(320, 140), in: 20, bars: 1, label: 'Ashen Drake ash-storm breath (2× close-up)' },
  { name: 'jester', ...duel('djAttack'), zoom: z2(330, 145), in: 40, bars: 1, label: 'Dial Jester strike (2×)' },
  { name: 'bolt', ...duel('spBoltAce'), zoom: z2(340, 125), in: 30, bars: 1, label: 'Judgment Bolt on Crystal Wyrm (2×)' },
  { name: 'card1', query: '?dev=trailer&card=1&sync=1', in: 0, bars: 1, label: 'text: 80 HAND-CRAFTED CARDS' },
  // ---- montage 2: spells and traps
  { name: 'mirror', ...duel('tbMirror'), zoom: z2(320, 125), in: 60, bars: 1, label: 'Mirror Barrier (Prism Ward) dome (2×)' },
  { name: 'dawn', ...duel('eDawn'), zoom: z2(340, 105), in: 40, bars: 1, label: 'Dawn Swords gilded cage (2×)' },
  { name: 'chains', ...duel('sliceChainsWyrm'), zoom: z2(320, 130), in: 90, bars: 1, label: 'Chains of Light bind Crystal Wyrm (2×)' },
  { name: 'venom', ...duel('kaVenomAtk'), zoom: z2(310, 150), in: 30, bars: 1, label: 'Venom Drake acid mortar (2×)' },
  { name: 'card2', query: '?dev=trailer&card=2&sync=1', in: 0, bars: 1, label: 'text: EVERY MONSTER: ITS OWN SUMMON, STRIKE AND FALL' },
  // ---- montage 3: monsters
  { name: 'hatch', ...duel('kaChGrow'), zoom: z2(320, 140), in: 150, bars: 1, label: 'Cloud Hatchling coin call + growth (2×)' },
  { name: 'titan', ...duel('kdWall'), zoom: z2(380, 135), in: 100, bars: 1, label: 'Shield Titan rampart blocks Shade Assassin (2×)' },
  { name: 'windmane', ...duel('fsStormAtk'), in: 180, bars: 1, label: 'Windmane Knight storm charge cut-in' },
  { name: 'shatter', ...duel('psTrade'), zoom: z2(300, 130), in: 110, bars: 1, label: 'Polar Sovereign shatters Crystal Wyrm (2×)' },
  { name: 'card3', query: '?dev=trailer&card=3&sync=1', in: 0, bars: 1, label: 'text: DUEL A FRIEND ON ONE SCREEN / OR THE CPU' },
  // ---- readable gameplay with HUD
  { name: 'board', query: '?dev=trailer&s=trBoard&look=v3', fresh: true, in: 0, bars: 3, label: 'a full turn on a busy board: summon, battle, Crystal Wyrm hits Kite Fencer, LP 3100 → 1200' },
  // ---- climax
  { name: 'fusion', ...duel('b2FusionAuto'), zoom: z2(288, 150), in: 110, bars: 1, label: 'Polar Sovereign fusion (2×)' },
  { name: 'voidEye', ...duel('b2WipeAuto'), in: 40, bars: 2.5, label: 'Void Eye: the eye opens and swallows the whole board' },
  { name: 'clash', query: '?dev=steam&s=stWyrmHitsDrake&look=v3', fresh: true, zoom: z2(310, 130), in: 20, bars: 1, label: 'Crystal Wyrm vs Ashen Drake: the breath duel and the drake\'s fall (2×)' },
  // ---- rapid half-bar cuts
  { name: 'rKite', ...duel('kfnAttack'), zoom: z2(320, 140), in: 25, bars: 0.5, label: 'Kite Fencer lunge (2×)' },
  { name: 'rTitan', ...duel('kaAdAtkTitan'), zoom: z2(320, 140), in: 85, bars: 0.5, label: 'Ashen Drake vs Magma Titan (2×)' },
  { name: 'rHarpoon', ...duel('thpAttack'), zoom: z2(320, 140), in: 50, bars: 0.5, label: 'Tide Harpooner strike (2×)' },
  { name: 'rAxe', ...duel('caxAttack'), zoom: z2(320, 140), in: 95, bars: 0.5, label: 'Crag Axeman strike (2×)' },
  { name: 'rHorn', ...duel('sshAttack'), zoom: z2(320, 140), in: 140, bars: 0.5, label: 'Steppe Spiralhorn strike (2×)' },
  // ---- end card: lit logo + prism glint, the call to action slams in on the final hit (bar 32)
  {
    name: 'end',
    query: '?dev=trailer&card=end&sync=1&look=v3',
    at: { 0: 'window.__neon.trailerGlint()', 212: 'window.__neon.trailerHit()' },
    in: 0,
    bars: 2,
    tail: 150,
    label: 'end card: logo, WISHLIST NOW ON STEAM, COMING SOON',
  },
];

/** Timeline: each shot's start / length in video frames (cuts rounded to the nearest frame of the bar grid). */
export function timeline() {
  let bar = 0;
  return EDIT.map((s) => {
    const a = Math.round(bar * BAR_SEC * FPS);
    bar += s.bars;
    const b = Math.round(bar * BAR_SEC * FPS);
    return { ...s, start: a, len: b - a + (s.tail ?? 0), bar0: bar - s.bars };
  });
}

/**
 * What capture.mjs films: `in` frames of pre-roll (stepped, not saved: their sounds are logged with negative
 * frames), then the shot's frames (+ 6 spare). Saved frame 0 = the shot's first frame on the timeline.
 */
export const SHOTS = timeline().map((s) => ({ ...s, startTl: s.start, start: (s.in * 1000) / 60, frames: s.len + 6 }));
