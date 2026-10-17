import { ALLIANCES, REALMS, REGIONS, WORLD, type RealmDef } from '../data/world';
import { createNoise2D } from '../noise';
import { createRng, hashString, nextInt } from '../rng';
import { TROOPS } from '../data/troops';
import type { Combatant } from './combat';
import { armyStrength } from './military';
import { heroLand } from './heroes';
import type { GameState } from '../state';

export type TileKind = 'sea' | 'field' | 'forest' | 'hills' | 'capital' | 'fort' | 'town';

export interface Tile {
  x: number;
  y: number;
  kind: TileKind;
  /** 1 at the rim, 10 by the Law Rock. */
  level: number;
  region: (typeof REGIONS)[number];
  /** Index into ALLIANCES, or null for free land. */
  owner: number | null;
}

export interface RealmMap {
  realm: RealmDef;
  size: number;
  tiles: Tile[];
  /** Where each alliance has its seat (a ring fort). */
  seats: Array<{ alliance: number; x: number; y: number }>;
  towns: Array<{ name: string; x: number; y: number }>;
  /** A free spot on the rim for a newcomer's hold. */
  home: { x: number; y: number };
}

const TOWNS = ['Hedeby', 'Birka', 'Kaupang', 'Dyflin', 'Miklagarðr', 'Jórvík'] as const;

export const tileKey = (x: number, y: number) => `${x},${y}`;

const cache = new Map<number, RealmMap>();

/** The map of a realm. Pure and deterministic from the realm id (cached). */
export function realmMap(realmId: number): RealmMap {
  const hit = cache.get(realmId);
  if (hit) return hit;
  const realm = REALMS.find((r) => r.id === realmId) ?? REALMS[0]!;
  const seed = hashString(`midgard-${realm.id}`);
  const noise = createNoise2D(seed);
  const detail = createNoise2D(seed ^ 0x5bd1e995);
  const rng = createRng(seed);
  const n = WORLD.size;
  const c = (n - 1) / 2;
  const tiles: Tile[] = [];

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy) / c;
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const region = REGIONS[Math.floor((angle / (Math.PI * 2)) * REGIONS.length) % REGIONS.length]!;
      // Land masses around a central sea-girt island, with fjords and sounds between.
      const h = noise(x * 0.075, y * 0.075) * 0.5 + detail(x * 0.22, y * 0.22) * 0.12 + 0.62 - d * 0.78;
      let kind: TileKind = h > 0.06 ? 'field' : 'sea';
      if (kind === 'field') {
        const f = detail(x * 0.21 + 40, y * 0.21);
        kind = f > 0.35 ? 'hills' : f > -0.05 ? 'forest' : 'field';
      }
      if (d * c <= WORLD.capitalRadius + 2.2 && d * c > WORLD.capitalRadius)
        kind = kind === 'sea' ? 'field' : kind;
      if (d * c <= WORLD.capitalRadius) kind = 'capital';
      const level = Math.max(1, Math.min(10, 1 + Math.floor((1 - d) * 10)));
      tiles.push({ x, y, kind, level, region, owner: null });
    }
  }
  const at = (x: number, y: number) => tiles[y * n + x];

  // Ring forts: one per alliance, evenly round the Law Rock, on the nearest land.
  const seats: RealmMap['seats'] = [];
  ALLIANCES.forEach((_, i) => {
    const a = (i / ALLIANCES.length) * Math.PI * 2 + 0.4;
    let best: Tile | undefined;
    for (let r = WORLD.fortRadius; r < WORLD.fortRadius + 6 && !best; r++) {
      for (let k = -3; k <= 3 && !best; k++) {
        const t = at(Math.round(c + Math.cos(a + k * 0.06) * r), Math.round(c + Math.sin(a + k * 0.06) * r));
        if (t && t.kind !== 'sea' && t.kind !== 'capital') best = t;
      }
    }
    best ??= at(
      Math.round(c + Math.cos(a) * WORLD.fortRadius),
      Math.round(c + Math.sin(a) * WORLD.fortRadius),
    )!;
    best.kind = 'fort';
    seats.push({ alliance: i, x: best.x, y: best.y });
  });

  // Trading towns further out.
  const towns: RealmMap['towns'] = [];
  TOWNS.forEach((name, i) => {
    const a = (i / TOWNS.length) * Math.PI * 2 + 0.9;
    for (let r = 15; r < 19; r++) {
      const t = at(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r));
      if (t && (t.kind === 'field' || t.kind === 'forest' || t.kind === 'hills')) {
        t.kind = 'town';
        towns.push({ name, x: t.x, y: t.y });
        break;
      }
    }
  });

  // Territory: each alliance holds the land nearest its fort, out to a few tiles.
  for (const t of tiles) {
    if (t.kind === 'sea') continue;
    if (t.kind === 'capital' || Math.hypot(t.x - c, t.y - c) <= WORLD.capitalRadius + 1.6) {
      t.owner = realm.kingAlliance;
      continue;
    }
    let bestD = Infinity;
    for (const s of seats) {
      const dd = Math.hypot(t.x - s.x, t.y - s.y);
      if (dd < bestD) {
        bestD = dd;
        t.owner = s.alliance;
      }
    }
    if (bestD > 4.2) t.owner = null;
  }

  // A newcomer's hold: free land on the rim.
  // A newcomer needs room to grow: free land on at least three sides.
  const freeLand = (x: number, y: number) => {
    const t = x < 0 || y < 0 || x >= n || y >= n ? undefined : at(x, y);
    return !!t && t.owner === null && (t.kind === 'field' || t.kind === 'forest' || t.kind === 'hills');
  };
  const roomy = (t: Tile) =>
    [freeLand(t.x + 1, t.y), freeLand(t.x - 1, t.y), freeLand(t.x, t.y + 1), freeLand(t.x, t.y - 1)].filter(
      Boolean,
    ).length >= 3;
  const open = tiles.filter(
    (t) => t.owner === null && t.kind !== 'sea' && t.kind !== 'town' && Math.hypot(t.x - c, t.y - c) > 13,
  );
  const rim = open.filter(roomy).length ? open.filter(roomy) : open;
  const home = rim.length ? rim[nextInt(rng, 0, rim.length - 1)]! : at(0, 0)!;

  const map: RealmMap = { realm, size: n, tiles, seats, towns, home: { x: home.x, y: home.y } };
  cache.set(realmId, map);
  return map;
}

export const tileAt = (map: RealmMap, x: number, y: number): Tile | undefined =>
  x < 0 || y < 0 || x >= map.size || y >= map.size ? undefined : map.tiles[y * map.size + x];

/** The realm this hold belongs to. */
export function homeRealm(state?: GameState): RealmDef {
  return REALMS.find((r) => r.id === state?.world.realm) ?? REALMS[0]!;
}

/** How many tiles the hold may hold (its own tile included). */
export function tileLimit(hall: number): number {
  return WORLD.baseTiles + hall;
}

/** Is (x, y) next to the hold or to land it already holds? */
export function bordersHold(state: GameState, x: number, y: number): boolean {
  const mine = new Set([tileKey(state.world.home.x, state.world.home.y), ...state.world.owned]);
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => mine.has(tileKey(x + dx!, y + dy!)));
}

/** Who owns a tile now: the player (-1), an alliance, or no one. */
export function tileOwner(state: GameState, tile: Tile): number | null {
  if (state.world.owned.includes(tileKey(tile.x, tile.y))) return -1;
  if (tile.x === state.world.home.x && tile.y === state.world.home.y) return -1;
  return tile.owner;
}

/** Hourly yield from the land the hold has conquered. */
export function territoryYield(state: GameState): Record<'food' | 'timber' | 'iron' | 'silver', number> {
  const out = { food: 0, timber: 0, iron: 0, silver: 0 };
  if (!state.world.owned.length) return out;
  const map = realmMap(state.world.realm);
  for (const key of state.world.owned) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const t = tileAt(map, x, y);
    const y1 = t ? WORLD.tileYield[t.kind] : undefined;
    if (!t || !y1) continue;
    for (const [r, v] of Object.entries(y1)) out[r as keyof typeof out] += v * t.level;
  }
  const boost = 1 + heroLand(state);
  for (const r of Object.keys(out) as Array<keyof typeof out>) out[r] *= boost;
  return out;
}

/** The next King's War window (realm against realm, every Saturday). */
export function kingsWar(now: number, realmId: number) {
  const day = 86_400_000;
  const d = new Date(now);
  const todayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daysAhead = (WORLD.kingsWarDay - d.getUTCDay() + 7) % 7;
  let start = todayStart + daysAhead * day + WORLD.kingsWarHourUtc * 3_600_000;
  const end = (s: number) => s + WORLD.kingsWarHours * 3_600_000;
  if (end(start) <= now) start += 7 * day;
  const week = Math.floor(start / (7 * day));
  // Opponents change each week: 1–2 and 3–4, then 1–3 and 2–4, then 1–4 and 2–3.
  const pairings = [
    [2, 1, 4, 3],
    [3, 4, 1, 2],
    [4, 3, 2, 1],
  ][week % 3]!;
  const opponent = pairings[(realmId - 1) % 4]!;
  return { start, end: end(start), live: now >= start, opponent: REALMS.find((r) => r.id === opponent)! };
}

/** The warriors holding a tile: stronger towards the Law Rock, and on alliance land. */
export function tileGarrison(tile: Tile, owner: number | null): Combatant[] {
  const strength =
    WORLD.garrisonBase *
    WORLD.garrisonGrowth ** (tile.level - 1) *
    (owner === null ? 1 : WORLD.allianceGarrison);
  const tier = Math.min(3, 1 + Math.floor((tile.level - 1) / 4));
  return (['shieldwall', 'berserker', 'archer'] as const).map((type) => {
    const t = TROOPS[`${type}-${tier}`]!;
    const per = armyStrength([{ ...t, count: 1 }]);
    return {
      key: t.id,
      name: t.name,
      type,
      count: Math.max(1, Math.round(strength / 3 / per)),
      atk: t.atk,
      def: t.def,
      hp: t.hp,
    };
  });
}
