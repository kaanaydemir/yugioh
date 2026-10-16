// Art Lab variant registry. A variant is ready when its module is listed here; the others are
// shown in the switcher as "(yakında)" and cannot be picked. A and B are ready. To add variant C:
// create src/artlab/variant-c/index.ts (default export ArtVariant with id 'C') and set `load` below.

import type { ArtVariant } from './types';
import variantA from './variant-a';
import variantB from './variant-b';
import variantC from './variant-c';

export interface VariantEntry {
  id: ArtVariant['id'];
  /** Turkish label in the switcher. */
  label: string;
  /** Null while the variant is not built yet. */
  load: (() => ArtVariant) | null;
}

export const VARIANTS: readonly VariantEntry[] = [
  { id: 'A', label: 'A — Sıcak ve Sevimli', load: () => variantA },
  { id: 'B', label: 'B — Sıcak ama Heybetli', load: () => variantB },
  { id: 'C', label: 'C — Orijinal Neon, Yüksek Detay', load: () => variantC },
  { id: 'D', label: 'D (yakında)', load: null },
];

export function readyVariants(): VariantEntry[] {
  return VARIANTS.filter((v) => v.load);
}

export function findVariant(id: string | null | undefined): VariantEntry | undefined {
  const k = (id ?? '').toUpperCase();
  return VARIANTS.find((v) => v.id === k && v.load);
}
