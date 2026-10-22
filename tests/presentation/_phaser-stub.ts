// A universal stand-in for the 'phaser' module (no WebGL / DOM in node): every property is another
// stand-in, every call / construction returns one, `class X extends Phaser.Y {}` works, and a value
// used as a number reads 0. Enough for the cinematics / light modules to LOAD in vitest so their pure
// accessors (the A3 §6.4 table accessors and bridges) can be called; nothing here renders.
// Use: vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

export function phaserStub(): { default: unknown } {
  const make = (path: string): unknown => {
    const target = function () {
      /* stand-in */
    };
    return new Proxy(target, {
      get(_t, k) {
        if (k === 'prototype') return {};
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === 'valueOf') return () => 0;
        if (k === 'toString') return () => path;
        if (k === 'then' || k === Symbol.iterator || k === Symbol.asyncIterator) return undefined;
        return make(`${path}.${String(k)}`);
      },
      apply: () => make(`${path}()`),
      construct: () => make(`new ${path}`) as object,
    });
  };
  return { default: make('Phaser') };
}
