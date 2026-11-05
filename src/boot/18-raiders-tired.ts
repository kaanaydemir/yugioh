// Registers scrap_raiders' hidden 'tired' sheet (the attackThenDefense lock pose, lane D C5) as a monster variant
// at game load, so its sheets are built by the variant machinery (src/art/variants.ts ensureVariantSheet). Its
// `when` is always false: no unit ever GETS the variant; src/cinematics/d/_scrap_raiders-tired.ts only swaps the
// sheet a unit shows while its lock lasts. Lives here (not in the art module) for the same reason as the
// hatchling's: variants.ts pulls in the Phaser texture layer. Harmless in v1 (nothing shows it there).
import { registerMonsterVariant } from '../art/variants';
import { monsterArtV3 } from '../art/monsters';
import { tiredRaidersVariant } from '../art/monsters-v3/_scrap_raiders-tired';
import type { BootStep } from './types';

function register(): void {
  const base = monsterArtV3('scrap_raiders');
  if (base) registerMonsterVariant('scrap_raiders', tiredRaidersVariant(base));
}
register();

const step: BootStep = {
  name: 'raiders-tired',
  order: 18,
  build: register,
};
export default step;
