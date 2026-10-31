import { describe, expect, it } from 'vitest';
import { COLLECTIBLE_CARDS, isMonster } from '../../src/data/cards';
import { ELEMENTS, gridMove, matches, sortPool, visibleIds } from '../../src/scenes/deck/pool';

describe('pool filter / sort', () => {
  it('shows every card with no filter and never hard-codes a count', () => {
    expect(visibleIds({ kind: 'all', attr: null }, 'level')).toHaveLength(COLLECTIBLE_CARDS.length);
  });

  it('kind and element filters', () => {
    const m = visibleIds({ kind: 'monster', attr: null }, 'name');
    expect(m.length).toBe(COLLECTIBLE_CARDS.filter(isMonster).length);
    expect(visibleIds({ kind: 'spell', attr: null }, 'name').length + visibleIds({ kind: 'trap', attr: null }, 'name').length + m.length).toBe(COLLECTIBLE_CARDS.length);
    for (const a of ELEMENTS) for (const id of visibleIds({ kind: 'all', attr: a }, 'atk')) expect(matches(COLLECTIBLE_CARDS.find((c) => c.id === id)!, { kind: 'all', attr: a })).toBe(true);
  });

  it('sorts by level desc, ATK desc, and name (Turkish)', () => {
    const byLevel = sortPool(COLLECTIBLE_CARDS, 'level').filter(isMonster);
    for (let i = 1; i < byLevel.length; i++) expect(byLevel[i - 1].level).toBeGreaterThanOrEqual(byLevel[i].level);
    const byAtk = sortPool(COLLECTIBLE_CARDS, 'atk').filter(isMonster);
    for (let i = 1; i < byAtk.length; i++) expect(byAtk[i - 1].atk).toBeGreaterThanOrEqual(byAtk[i].atk);
    const names = sortPool(COLLECTIBLE_CARDS, 'name').map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'tr')));
    // monsters come before spells / traps in the level and ATK sorts
    const kinds = sortPool(COLLECTIBLE_CARDS, 'level').map((c) => c.kind === 'monster');
    expect(kinds.indexOf(false)).toBe(kinds.lastIndexOf(true) + 1);
  });

  it('gridMove stays in bounds', () => {
    expect(gridMove(0, -1, 0, 3, 7)).toBe(0);
    expect(gridMove(0, 1, 0, 3, 7)).toBe(1);
    expect(gridMove(1, 0, 1, 3, 7)).toBe(4);
    expect(gridMove(5, 0, 1, 3, 7)).toBe(6); // last row is short
    expect(gridMove(6, 1, 0, 3, 7)).toBe(6);
    expect(gridMove(-1, 0, 0, 3, 7)).toBe(0);
    expect(gridMove(0, 0, 0, 3, 0)).toBe(-1);
  });
});
