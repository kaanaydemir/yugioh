// biped v1 — SLOTS: the default far → near draw order of a biped's parts (docs/v3/A3_MIMARI.md §3.3).
//
// A member's part painter names its slot (PartPainter.layer); planArt lays the parts slot by slot in
// this order (several parts in one slot: in the member's `parts` order). Everything before 'outline'
// is composited with seams / creases and then outlined once (the single silhouette contour); the
// slots after it are LIGHT (IŞ-9: emissive, never outlined).
//
// Stations ('armF.front', 'armN.tuck', 'head.front') are empty by default: a pose sends a part there
// for a frame with `slots` (BipedPose.slots: part → slot) — the v1 rigs needed exactly these swaps:
//   titan    far arm in front of the torso when guarding / roaring (farFront), head in front of the
//            near arm in the lunge (headFront)
//   sentinel near arm tucked behind the shield in guard (armBehind)
// A member that needs another order passes its own `order` (escape hatch L4).
//
// The approved Taş Muhafız still (src/still/sentinel-map.ts) fixed two orders the slots keep:
//   - the near arm comes out from UNDER its pauldron: 'armN' before 'shoulderN';
//   - the far pauldron is the part behind the chest: 'shoulderF' before 'torso'.

/** The pseudo-slot that outlines the frame (PAL.ink); later slots are light. */
export const OUTLINE = 'outline';

export const BIPED_ORDER: readonly string[] = Object.freeze([
  'back', //        behind everything: a cape's back half, an aura, the far half of a foam ring
  'armF', //        the far arm, behind the body
  'shoulderF', //   far pauldron / boulder (behind the chest)
  'legF',
  'legN',
  'lower', //       spout column, robe / skirt (over the legs)
  'torso', //       chest, belly, belt, tassets
  'armF.front', //  station: the far arm in front of the torso
  'head',
  'armN.tuck', //   station: the near arm behind the far prop
  'propF', //       the far hand's prop (tower shield)
  'armN', //        the near arm (under its pauldron)
  'shoulderN', //   near pauldron / boulder
  'head.front', //  station: the head in front of the near arm
  'propN', //       the near hand's prop (boulder, blade)
  'front', //       in front of everything: front foam, dust
  OUTLINE,
  'glow', //        emissive light: runes, eye slits, a core (drawn after the outline, never outlined)
  'fx', //          light effects: sparks, smear light
]);

/** Station slots (empty by default; reached through BipedPose.slots). */
export const BIPED_STATIONS: readonly string[] = Object.freeze(['armF.front', 'armN.tuck', 'head.front']);

/** The slot a part is drawn in this frame: the pose's station for it, else its painter's layer. */
export function bipedSlotOf(pose: { readonly slots?: Readonly<Record<string, string>> }, part: string, layer: string): string {
  return pose.slots?.[part] ?? layer;
}
