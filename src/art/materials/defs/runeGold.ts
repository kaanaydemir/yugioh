// runeGold — Taş Muhafız's eye slit and carved runes (REHBER §2.3 stone row, DRAFT until the pilot's
// acceptance). From the approved idle f0 (src/still/sentinel-map.ts): the eye is the focus and the only
// gold4 (gold2 → gold3 → gold4 core → gold3, a 7-px slit), the ᛉ rune one step quieter (gold3 stem,
// gold2 arms, no gold4); hand-placed, never outlined: light, drawn after the outline (IŞ-9), pulsing
// with the idle ("rün ve göz yarığı nabzı", A3_MIMARI §4.2). Seams / creases on gold as the wyrm's
// SEAM / CREASE. On death the light drains out of the glyph (rigkit drain), on revive it comes back;
// on its own a body of it would break as light (motes rising). A blow on a rune lands on the stone it
// is carved in (sound = stone). Its glow = today's MONSTER_GLOW.stone_sentinel top emissive tone.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'runeGold',
  status: 'draft',
  firstUser: 'stone_sentinel',
  draw: {
    ramp: [PAL.gold2, PAL.gold3, PAL.gold4],
    th: [],
    farShift: 0,
    seam: { [PAL.gold4]: PAL.gold2, [PAL.gold3]: PAL.gold1, [PAL.gold2]: PAL.gold1 },
    crease: { [PAL.gold4]: PAL.gold2, [PAL.gold3]: PAL.gold1, [PAL.gold2]: PAL.gold1 },
    edge: { hi: null, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: null,
    emissive: { tones: [PAL.gold4, PAL.gold3, PAL.gold2], pulse: 'breath' },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.gold2, PAL.gold3, PAL.gold4], debris: 'ember', flash: PAL.gold4 },
  death: { shatter: 'light', accent: 'light', pass: 'drain', revive: 'drain' },
  matter: [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4, PAL.white],
  sound: { same: 'stone' },
  light: { glow: PAL.gold4 },
} satisfies MaterialDef;
