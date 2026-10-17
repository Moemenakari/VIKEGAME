import { describe, expect, it } from 'vitest';
import {
  ALLIANCES,
  REALMS,
  WORLD,
  apply,
  bordersHold,
  kingsWar,
  newGame,
  productionPerHour,
  realmMap,
  tileAt,
  tileKey,
  type GameState,
} from '../src';

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0); // a Thursday

/** A free land tile next to the hold. */
function freeNeighbour(s: GameState) {
  const map = realmMap(s.world.realm);
  const { x, y } = s.world.home;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const t = tileAt(map, x + dx, y + dy);
    if (t && t.kind !== 'sea' && t.kind !== 'capital' && t.kind !== 'fort' && t.owner === null) return t;
  }
  throw new Error('no free neighbour');
}

describe('the world map', () => {
  it('is the same every time for a realm, with the Law Rock held by the King’s alliance', () => {
    for (const realm of REALMS) {
      const a = realmMap(realm.id);
      const c = (a.size - 1) / 2;
      expect(tileAt(a, c, c)!.kind).toBe('capital');
      expect(tileAt(a, c, c)!.owner).toBe(realm.kingAlliance);
      expect(a.seats).toHaveLength(ALLIANCES.length);
      const home = tileAt(a, a.home.x, a.home.y)!;
      expect(home.kind).not.toBe('sea');
      expect(home.owner).toBeNull();
    }
  });

  it('lets a strong warband take free land next to the hold, which then yields resources', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'shieldwall-3': 300, 'berserker-3': 300, 'archer-3': 300 };
    const tile = freeNeighbour(s);
    expect(bordersHold(s, tile.x, tile.y)).toBe(true);
    const before = productionPerHour(s);
    const r = apply(s, { type: 'conquerTile', x: tile.x, y: tile.y, troops: s.army.troops }, T0);
    if (!r.ok) throw new Error(r.error.message);
    s = r.state;
    expect(s.world.owned).toContain(tileKey(tile.x, tile.y));
    expect(s.reports[0]!.kind).toBe('conquest');
    const after = productionPerHour(s);
    const gained = Object.keys(after).some(
      (k) => after[k as keyof typeof after] > before[k as keyof typeof before],
    );
    expect(gained || WORLD.tileYield[tile.kind] === undefined).toBe(true);
  });

  it('refuses the Law Rock, far-away land and an empty march', () => {
    const s = newGame(1, T0);
    const map = realmMap(1);
    const c = (map.size - 1) / 2;
    s.army.troops = { 'shieldwall-1': 10 };
    expect(apply(s, { type: 'conquerTile', x: c, y: c, troops: s.army.troops }, T0).ok).toBe(false);
    expect(apply(s, { type: 'conquerTile', x: 0, y: c, troops: s.army.troops }, T0).ok).toBe(false);
    const t = freeNeighbour(s);
    expect(apply(s, { type: 'conquerTile', x: t.x, y: t.y, troops: {} }, T0).ok).toBe(false);
  });

  it('holds a King’s War every Saturday against another realm', () => {
    const w = kingsWar(T0, 1);
    expect(new Date(w.start).getUTCDay()).toBe(6);
    expect(w.start).toBeGreaterThan(T0);
    expect(w.opponent.id).not.toBe(1);
    expect(kingsWar(w.start + 1000, 1).live).toBe(true);
    // Pairings are symmetric: if 1 fights X, X fights 1.
    expect(kingsWar(T0, w.opponent.id).opponent.id).toBe(1);
  });
});
