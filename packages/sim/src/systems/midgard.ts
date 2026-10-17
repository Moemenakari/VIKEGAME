import { ALLIANCES, REALMS } from '../data/world';
import { BYNAMES, CAMPS, JARL_NAMES, MIDGARD, NODES, type CampKind, type NodeKind } from '../data/midgard';
import { AVATARS } from '../data/mainQuests';
import { BUILDINGS } from '../data/buildings';
import { MILITARY, TROOPS } from '../data/troops';
import { PRODUCED_RESOURCES, type Cost } from '../data/resources';
import type { GameEvent } from '../events';
import { createRng, hashString, nextInt, type Rng } from '../rng';
import type { BattleReport, GameState, March, ReportLine } from '../state';
import { resolveBattle, type Combatant } from './combat';
import { heroMods } from './heroes';
import { killsOf, recordBattle } from './items';
import { addCounts, armyStrength, sumCounts, woundedCapacity } from './military';
import { hallLevel } from './economy';
import { PVP } from './pvp';
import { EARN, STAMINA, WARFARE } from '../data/shops';
import { HEROES } from '../data/heroes';
import { realmMap, tileKey, type Tile } from './world';

/**
 * Midgard's people and wilds: AI jarls' holds, camps to hunt and nodes to gather,
 * all generated from the realm id (pure, cached), plus the marches that go to them.
 * Warriors walk there and back; battles are fought when they arrive.
 */
export interface MapJarl {
  id: string;
  name: string;
  /** Index into ALLIANCES, or null. */
  alliance: number | null;
  x: number;
  y: number;
  /** Great Hall level, 1–20. */
  level: number;
  power: number;
  avatar: number;
}

export interface MapCamp {
  id: string;
  kind: CampKind;
  level: number;
  x: number;
  y: number;
}

export interface MapNode {
  id: string;
  kind: NodeKind;
  level: number;
  x: number;
  y: number;
}

export interface Midgard {
  jarls: MapJarl[];
  camps: MapCamp[];
  nodes: MapNode[];
  /** "x,y" → what stands there. */
  at: Map<string, MapJarl | MapCamp | MapNode>;
}

const cache = new Map<number, Midgard>();

const levelAt = (size: number, x: number, y: number) => {
  const c = (size - 1) / 2;
  return Math.max(1, Math.min(10, 1 + Math.floor((1 - Math.hypot(x - c, y - c) / c) * 10)));
};

function pick<T>(rng: Rng, list: T[]): T | undefined {
  if (!list.length) return undefined;
  const i = nextInt(rng, 0, list.length - 1);
  const [item] = list.splice(i, 1);
  return item;
}

/** Everyone and everything on a realm's map. Pure and deterministic from the realm id. */
export function midgard(realmId: number): Midgard {
  const hit = cache.get(realmId);
  if (hit) return hit;
  const map = realmMap(realmId);
  const rng = createRng(hashString(`midgard-pop-${realmId}`));
  const c = (map.size - 1) / 2;
  // The newcomer's tile and the land around it stay clear, so a new hold has room to grow.
  const taken = new Set<string>();
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) taken.add(tileKey(map.home.x + dx, map.home.y + dy));
  const land = (t: Tile) =>
    (t.kind === 'field' || t.kind === 'forest' || t.kind === 'hills') && !taken.has(tileKey(t.x, t.y));
  const take = <T extends { x: number; y: number }>(o: T) => {
    taken.add(tileKey(o.x, o.y));
    return o;
  };
  const jarlPower = (level: number) =>
    Math.round(jarlStrengthOf(level) * 9 + level * 1_800 + nextInt(rng, 0, 900));

  const jarls: MapJarl[] = [];
  const newJarl = (t: Tile, alliance: number | null, level: number) => {
    const n = jarls.length + 1;
    const name = `${JARL_NAMES[nextInt(rng, 0, JARL_NAMES.length - 1)]} ${BYNAMES[nextInt(rng, 0, BYNAMES.length - 1)]}`;
    jarls.push(
      take({
        id: `j${n}`,
        name,
        alliance,
        x: t.x,
        y: t.y,
        level,
        power: jarlPower(level),
        avatar: nextInt(rng, 0, AVATARS.length - 1),
      }),
    );
  };
  // Each alliance's jarls live on its land; stronger alliances (nearer the Law Rock) have stronger jarls.
  ALLIANCES.forEach((_, a) => {
    let home = map.tiles.filter((t) => t.owner === a && land(t));
    // An alliance squeezed onto a rocky shore settles the free land nearest its fort.
    if (home.length < MIDGARD.jarlsPerAlliance) {
      const seat = map.seats.find((q) => q.alliance === a)!;
      home = home.concat(
        map.tiles
          .filter((t) => t.owner === null && land(t))
          .sort((p, q) => Math.hypot(p.x - seat.x, p.y - seat.y) - Math.hypot(q.x - seat.x, q.y - seat.y))
          .slice(0, MIDGARD.jarlsPerAlliance * 2),
      );
    }
    for (let k = 0; k < MIDGARD.jarlsPerAlliance; k++) {
      const t = pick(rng, home);
      if (!t) break;
      const near = 1 - Math.hypot(t.x - c, t.y - c) / c;
      newJarl(t, a, Math.max(1, Math.min(20, Math.round(4 + near * 12 + nextInt(rng, -2, 3)))));
    }
  });
  const rim = map.tiles.filter((t) => t.owner === null && land(t) && Math.hypot(t.x - c, t.y - c) > 9);
  for (let k = 0; k < MIDGARD.freeJarls; k++) {
    const t = pick(rng, rim);
    if (t && land(t)) newJarl(t, null, nextInt(rng, 1, 8));
  }

  const nodes: MapNode[] = [];
  const kindTile: Record<NodeKind, Tile['kind'][]> = {
    farm: ['field'],
    wood: ['forest'],
    iron: ['hills'],
    silver: ['field', 'forest', 'hills'],
  };
  for (const kind of Object.keys(MIDGARD.nodes) as NodeKind[]) {
    const spots = map.tiles.filter((t) => kindTile[kind].includes(t.kind) && land(t));
    for (let k = 0; k < MIDGARD.nodes[kind]; k++) {
      const t = pick(rng, spots);
      if (!t || !land(t)) continue;
      nodes.push(
        take({ id: `n${nodes.length + 1}`, kind, level: levelAt(map.size, t.x, t.y), x: t.x, y: t.y }),
      );
    }
  }

  const camps: MapCamp[] = [];
  const wild = map.tiles.filter((t) => land(t) && Math.hypot(t.x - c, t.y - c) > 3);
  for (let k = 0; k < MIDGARD.camps; k++) {
    const t = pick(rng, wild);
    if (!t || !land(t)) continue;
    const level = levelAt(map.size, t.x, t.y);
    const kinds = (Object.keys(CAMPS) as CampKind[]).filter(
      (q) => q !== 'treasure' && level >= CAMPS[q].minLevel && level <= CAMPS[q].maxLevel,
    );
    const kind = kinds[nextInt(rng, 0, kinds.length - 1)] ?? 'wolves';
    camps.push(take({ id: `c${camps.length + 1}`, kind, level, x: t.x, y: t.y }));
  }

  // Shipwreck chests wash up on the shores (land tiles next to the sea).
  const shore = map.tiles.filter((t) => {
    if (!land(t)) return false;
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => map.tiles[(t.y + dy!) * map.size + (t.x + dx!)]?.kind === 'sea');
  });
  for (let k = 0; k < MIDGARD.treasures; k++) {
    const t = pick(rng, shore);
    if (!t || !land(t)) continue;
    camps.push(
      take({
        id: `c${camps.length + 1}`,
        kind: 'treasure',
        level: levelAt(map.size, t.x, t.y),
        x: t.x,
        y: t.y,
      }),
    );
  }

  const at = new Map<string, MapJarl | MapCamp | MapNode>();
  for (const o of [...jarls, ...camps, ...nodes]) at.set(tileKey(o.x, o.y), o);
  const out: Midgard = { jarls, camps, nodes, at };
  cache.set(realmId, out);
  return out;
}

export const jarlStrengthOf = (level: number) => MIDGARD.jarlStrength * MIDGARD.jarlGrowth ** (level - 1);

/** Is this map object gone for now (beaten, shielded or gathered)? */
export const isCleared = (state: GameState, id: string, now: number) => (state.world.cleared[id] ?? 0) > now;

/** Combined strength of every alliance in a realm (its jarls, plus its land). */
export function alliancePower(realmId: number, alliance: number): number {
  const map = realmMap(realmId);
  const land = map.tiles.reduce((n, t) => n + (t.owner === alliance ? 1 : 0), 0);
  const jarls = midgard(realmId).jarls.reduce((n, j) => n + (j.alliance === alliance ? j.power : 0), 0);
  const king = REALMS.find((r) => r.id === realmId)?.kingAlliance === alliance ? 1.15 : 1;
  return Math.round((jarls + land * 2_500) * king);
}

function stacksFor(
  units: Array<{
    key: string;
    name: string;
    type: Combatant['type'];
    atk: number;
    def: number;
    hp: number;
    share: number;
  }>,
  strength: number,
): Combatant[] {
  return units.map((u) => {
    const per = armyStrength([{ ...u, count: 1 }]);
    return {
      key: u.key,
      name: u.name,
      type: u.type,
      atk: u.atk,
      def: u.def,
      hp: u.hp,
      count: Math.max(1, Math.round((strength * u.share) / per)),
    };
  });
}

/** The beasts or outlaws in a camp. */
export function campDefenders(camp: MapCamp): Combatant[] {
  return stacksFor(CAMPS[camp.kind].units, MIDGARD.campStrength * MIDGARD.campGrowth ** (camp.level - 1));
}

/** A jarl's warriors and palisade. */
export function jarlDefenders(jarl: MapJarl): Combatant[] {
  const tier = Math.min(3, 1 + Math.floor((jarl.level - 1) / 6));
  const shares = { shieldwall: 0.32, berserker: 0.26, archer: 0.26, cavalry: 0.16 } as const;
  const troops = (Object.keys(shares) as Array<keyof typeof shares>).map((type) => {
    const t = TROOPS[`${type}-${tier}`]!;
    return { key: t.id, name: t.name, type, atk: t.atk, def: t.def, hp: t.hp, share: shares[type] };
  });
  const out = stacksFor(troops, jarlStrengthOf(jarl.level));
  const w = BUILDINGS.palisade.wall;
  if (w && jarl.level >= 3) {
    const g = w.growth ** (Math.floor(jarl.level / 2) - 1);
    out.unshift({
      key: 'palisade',
      name: BUILDINGS.palisade.name,
      type: 'wall',
      count: 1,
      atk: Math.round(w.atk * 10 * g),
      def: Math.round(10 * g),
      hp: Math.round(w.hp * g),
    });
  }
  return out;
}

/**
 * Jarls' columns out on the roads (owner request: a moving army can be attacked). Every
 * fourth jarl sends carts to a node or warriors to a camp, back and forth on a fixed beat.
 */
export interface MapColumn {
  /** `t` + the jarl's id. */
  id: string;
  jarl: MapJarl;
  toX: number;
  toY: number;
  period: number;
  offset: number;
  unit: 'cart' | 'riders' | 'siege' | 'troops';
}

const columnCache = new Map<number, MapColumn[]>();

export function columns(realmId: number): MapColumn[] {
  const hit = columnCache.get(realmId);
  if (hit) return hit;
  const w = midgard(realmId);
  const out: MapColumn[] = [];
  w.jarls.forEach((j, i) => {
    if (i % 4) return;
    const goal = i % 8 ? nearest(w.nodes, j.x + 0.1, j.y + 0.1) : nearest(w.camps, j.x + 0.1, j.y + 0.1);
    if (!goal) return;
    out.push({
      id: `t${j.id}`,
      jarl: j,
      toX: goal.x,
      toY: goal.y,
      period: 90_000 + (i % 5) * 20_000,
      offset: (i * 0.137) % 1,
      unit: i % 8 ? 'cart' : i % 3 === 0 ? 'riders' : i % 3 === 1 ? 'siege' : 'troops',
    });
  });
  columnCache.set(realmId, out);
  return out;
}

/** Where a jarl's column is at `now` (0 at the hold, 1 at its goal) and which way it goes. */
export function columnAt(c: MapColumn, now: number): { x: number; y: number; at: number; out: boolean } {
  const f = (((now / c.period + c.offset) % 1) + 1) % 1;
  const at = f < 0.5 ? f * 2 : 2 - f * 2;
  return { x: c.jarl.x + (c.toX - c.jarl.x) * at, y: c.jarl.y + (c.toY - c.jarl.y) * at, at, out: f < 0.5 };
}

/** A column on the road: no palisade, and only part of the hold's warriors. */
export function columnDefenders(c: MapColumn): Combatant[] {
  return jarlDefenders(c.jarl)
    .filter((d) => d.type !== 'wall')
    .map((d) => ({ ...d, count: Math.max(1, Math.round(d.count * MIDGARD.columnShare)) }));
}

/** Where one of your columns is at `now`. */
export function marchPos(state: GameState, m: March, now: number): { x: number; y: number } {
  const home = state.world.home;
  if (now >= m.doneAt) {
    const f = Math.min(1, (now - m.doneAt) / Math.max(1, m.returnAt - m.doneAt));
    return { x: m.x + (home.x - m.x) * f, y: m.y + (home.y - m.y) * f };
  }
  if (now >= m.arriveAt) return { x: m.x, y: m.y };
  const from = m.from ?? home;
  const outStart = m.startAt + (m.allies ? WARFARE.rallyWaitMs : 0);
  const f = Math.max(0, (now - outStart) / Math.max(1, m.arriveAt - outStart));
  return { x: from.x + (m.x - from.x) * f, y: from.y + (m.y - from.y) * f };
}

/** What one warrior band can carry home. */
export function carryOf(troops: Record<string, number>): number {
  let n = 0;
  for (const [id, count] of Object.entries(troops))
    n += count * (MIDGARD.carryPerTier[TROOPS[id]?.tier ?? 0] ?? 0);
  return n;
}

export function marchLimit(state: GameState): number {
  return MIDGARD.marchesBase + Math.floor(hallLevel(state) / MIDGARD.marchesPerHall);
}

export function travelMs(state: GameState, x: number, y: number, troops?: Record<string, number>): number {
  const d = Math.hypot(x - state.world.home.x, y - state.world.home.y);
  return Math.max(MIDGARD.minTravelMs, Math.round(d * msPerTile(troops)));
}

/**
 * Share (0–1) of the straight road from your hold to (x, y) that runs over open sea.
 * Those legs are sailed: the column boards longships at the shore and lands on the far side.
 */
export function seaShare(state: GameState, x: number, y: number): number {
  const map = realmMap(state.world.realm);
  const { x: hx, y: hy } = state.world.home;
  const steps = Math.max(1, Math.ceil(Math.hypot(x - hx, y - hy) * 2));
  let wet = 0;
  for (let k = 1; k < steps; k++) {
    const tx = Math.round(hx + ((x - hx) * k) / steps);
    const ty = Math.round(hy + ((y - hy) * k) / steps);
    if (map.tiles[ty * map.size + tx]?.kind === 'sea') wet++;
  }
  return steps > 1 ? wet / (steps - 1) : 0;
}

/** A column moves at the pace of its slowest troop type (riders fastest, siege engines slowest). */
export function msPerTile(troops?: Record<string, number>): number {
  let ms = 0;
  for (const [id, n] of Object.entries(troops ?? {}))
    if (n > 0) ms = Math.max(ms, MIDGARD.msPerTileByType[TROOPS[id]?.type ?? ''] ?? MIDGARD.travelMsPerTile);
  return ms || MIDGARD.travelMsPerTile;
}

/** March speed as tiles per minute (what the cards show). */
export const tilesPerMinute = (troops?: Record<string, number>) =>
  Math.round(600_000 / msPerTile(troops)) / 10;

/** What a jarl's card shows: power split, deeds, march speed and heroes (deterministic). */
export function jarlProfile(jarl: MapJarl) {
  const defenders = jarlDefenders(jarl);
  const troops: Record<string, number> = {};
  let wall = 0;
  for (const d of defenders) {
    if (d.type === 'wall') wall = d.hp;
    else troops[d.key] = d.count;
  }
  // The same split the jarl's power is made of: warriors, then heroes, the rest is buildings.
  const troopPower = Math.round(jarlStrengthOf(jarl.level) * 9);
  const heroes = jarlHeroes(jarl);
  const heroPower = heroes.reduce((n, h) => n + h.level * 40, 0);
  const buildingPower = Math.max(0, jarl.power - troopPower - heroPower);
  const rng = createRng(hashString(`deeds-${jarl.id}-${jarl.name}`));
  return {
    troops,
    troopCount: Object.values(troops).reduce((a, b) => a + b, 0),
    wall,
    troopPower,
    heroPower,
    buildingPower,
    heroes,
    kills: Math.round(jarl.power * (0.4 + nextInt(rng, 0, 100) / 80)),
    battlesWon: jarl.level * 6 + nextInt(rng, 0, 40),
    speed: tilesPerMinute(troops),
  };
}

/** How much a node gives this band, and how long the gathering takes. */
export function gatherPlan(node: MapNode, troops: Record<string, number>): { amount: number; ms: number } {
  const def = NODES[node.kind];
  const amount = Math.min(def.perLevel * node.level, carryOf(troops));
  return { amount, ms: Math.round((amount / def.perHour) * 3_600_000) };
}

/** Takes the chosen warriors from home, or explains why not. */
export function takeTroops(
  state: GameState,
  troops: Record<string, number>,
): Record<string, number> | string {
  const sent: Record<string, number> = {};
  for (const [id, n] of Object.entries(troops)) {
    const count = Math.floor(n);
    if (count <= 0) continue;
    if (!TROOPS[id] || TROOPS[id].type === 'ship' || (state.army.troops[id] ?? 0) < count)
      return 'Not enough troops at home';
    sent[id] = count;
  }
  if (sumCounts(sent) === 0) return 'Choose warriors to send';
  return sent;
}

/** Validates and starts a march. Returns an error message, or null. */
/**
 * What a march can go for: a jarl's hold, a ring fort, a jarl's column on the road, a camp or
 * a node. A column is met where it will be when the march gets there.
 */
function marchTarget(
  state: GameState,
  kind: March['kind'],
  targetId: string,
  now: number,
  from: { x: number; y: number },
  pace: number,
): MapJarl | MapCamp | MapNode | string {
  const world = midgard(state.world.realm);
  const isJarl = targetId.startsWith('j') || targetId.startsWith('f') || targetId.startsWith('t');
  const isCamp = targetId.startsWith('c');
  let target: MapJarl | MapCamp | MapNode | undefined;
  if (targetId.startsWith('t')) {
    const c = columns(state.world.realm).find((q) => q.id === targetId);
    if (c) {
      let p = columnAt(c, now);
      for (let k = 0; k < 2; k++) p = columnAt(c, now + Math.hypot(p.x - from.x, p.y - from.y) * pace);
      target = { ...c.jarl, id: c.id, x: p.x, y: p.y };
    }
  } else
    target = [...world.jarls, ...forts(state.world.realm), ...world.camps, ...world.nodes].find(
      (o) => o.id === targetId,
    );
  if (!target || (kind === 'attack') !== isJarl || (kind === 'hunt') !== isCamp)
    return 'Nothing to march on there';
  if (target.x === state.world.home.x && target.y === state.world.home.y) return 'Nothing to march on there';
  if (
    isJarl &&
    (target as MapJarl).alliance !== null &&
    (target as MapJarl).alliance === state.world.alliance
  )
    return 'This jarl is in your alliance';
  if (isCleared(state, targetId, now))
    return targetId.startsWith('t')
      ? 'That column was broken; it is back at its hold'
      : isJarl
        ? 'This hold is under a peace shield'
        : 'Nothing is left there for now';
  return target;
}

export function startMarch(
  state: GameState,
  kind: March['kind'],
  targetId: string,
  troops: Record<string, number>,
  now: number,
  events: GameEvent[],
  rally = false,
): string | null {
  const found = marchTarget(state, kind, targetId, now, state.world.home, msPerTile(troops));
  if (typeof found === 'string') return found;
  const target = found;
  if (rally && targetId.startsWith('t')) return 'A rally cannot catch a column on the road';
  if (state.marches.some((m) => m.target === targetId)) return 'Your warriors are already on their way there';
  if (state.marches.length >= marchLimit(state)) return 'All your march columns are out';
  const stamina = kind === 'hunt' ? (STAMINA.cost[(target as MapCamp).kind] ?? 10) : 0;
  if (state.wallet.stamina < stamina) return 'Not enough stamina';
  const allies = rally ? rallyAllies(state) : undefined;
  if (rally && !allies) return 'No alliance-mates can join a rally';
  const sent = takeTroops(state, troops);
  if (typeof sent === 'string') return sent;
  state.wallet.stamina -= stamina;
  const travel = travelMs(state, target.x, target.y, sent);
  // A rally waits for the alliance to gather before it sets out.
  const start = now + (rally ? WARFARE.rallyWaitMs : 0);
  let doneAt = start + travel;
  if (kind === 'gather') {
    const plan = gatherPlan(target as MapNode, sent);
    if (plan.amount <= 0) return 'Choose warriors to send';
    doneAt += plan.ms;
    state.world.cleared[targetId] = doneAt + MIDGARD.nodeRegrowMs;
  }
  addCounts(state.army.troops, sent, -1);
  const march: March = {
    id: state.nextMarchId++,
    kind,
    target: targetId,
    x: target.x,
    y: target.y,
    troops: sent,
    startAt: now,
    arriveAt: start + travel,
    doneAt,
    returnAt: doneAt + travel,
    load: {},
    reportId: null,
    ...(allies ? { allies } : {}),
  };
  state.marches.push(march);
  events.push({ type: 'march.started', kind, target: targetId });
  return null;
}

/** Calls a march home early. Gatherers bring what they have so far. */
export function recallMarch(state: GameState, id: number, now: number): string | null {
  const m = state.marches.find((q) => q.id === id);
  if (!m) return 'No such march';
  if (now >= m.doneAt) return 'They are already on their way home';
  if (now < m.arriveAt) {
    const pos = marchPos(state, m, now);
    const home = state.world.home;
    m.returnAt =
      m.from || m.allies
        ? now + Math.round(Math.hypot(pos.x - home.x, pos.y - home.y) * msPerTile(m.troops))
        : now + (now - m.startAt);
    m.x = pos.x;
    m.y = pos.y;
    m.arriveAt = m.doneAt = now;
    // 0: turned back before any battle.
    m.reportId = 0;
    if (m.kind === 'gather') delete state.world.cleared[m.target];
    return null;
  }
  // Gathering: bring home a share of the load.
  const node = midgard(state.world.realm).nodes.find((n) => n.id === m.target);
  if (node) {
    const plan = gatherPlan(node, m.troops);
    const share = (now - m.arriveAt) / Math.max(1, m.doneAt - m.arriveAt);
    m.load = { [NODES[node.kind].res]: Math.floor(plan.amount * share) };
    state.world.cleared[m.target] = now + MIDGARD.nodeRegrowMs;
  }
  m.doneAt = now;
  m.returnAt = node
    ? now + (m.arriveAt - m.startAt)
    : now + Math.round(Math.hypot(m.x - state.world.home.x, m.y - state.world.home.y) * msPerTile(m.troops));
  return null;
}

/** A spot on the map as a march target: `p:x,y`. */
export const isWaypoint = (id: string) => id.startsWith('p:');
/** A column standing at a spot waits until told otherwise. */
const STAND_FOREVER = Number.MAX_SAFE_INTEGER;

/**
 * Turns a column on the road out towards a new target (owner request: steer your army
 * while it marches). It sets off from where it stands now, at its own pace.
 */
export function redirectMarch(
  state: GameState,
  id: number,
  targetId: string,
  now: number,
  events: GameEvent[],
): string | null {
  const m = state.marches.find((q) => q.id === id);
  if (!m) return 'No such march';
  if (m.kind === 'gather' || m.allies) return 'Gatherers and rallies keep their course';
  // On the road out, or heading home after a fight: straight on to the next target.
  const outbound = now < m.arriveAt && m.reportId === null;
  const homeward = now >= m.doneAt && now < m.returnAt && sumCounts(m.troops) > 0;
  const stationed = isWaypoint(m.target) && now >= m.arriveAt && now < m.doneAt;
  if (!outbound && !homeward && !stationed) return 'They are no longer on the road';
  if (m.target === targetId) return 'Your warriors are already on their way there';
  if (state.marches.some((q) => q.target === targetId)) return 'Your warriors are already on their way there';
  const pos = marchPos(state, m, now);
  const pace = msPerTile(m.troops);
  // Any spot on the map: they walk there and stand until the next order (owner request).
  if (isWaypoint(targetId)) {
    const [px, py] = targetId.slice(2).split(',').map(Number) as [number, number];
    const map = realmMap(state.world.realm);
    if (
      !Number.isInteger(px) ||
      !Number.isInteger(py) ||
      px < 0 ||
      py < 0 ||
      px >= map.size ||
      py >= map.size
    )
      return 'Nothing to march on there';
    m.target = targetId;
    m.from = pos;
    m.reportId = null;
    m.x = px;
    m.y = py;
    m.startAt = now;
    m.arriveAt = now + Math.max(MIDGARD.minRedirectMs, Math.round(Math.hypot(px - pos.x, py - pos.y) * pace));
    m.doneAt = m.returnAt = STAND_FOREVER;
    events.push({ type: 'march.started', kind: m.kind, target: targetId });
    return null;
  }
  const kind = targetId.startsWith('c') ? 'hunt' : 'attack';
  const target = marchTarget(state, kind, targetId, now, pos, pace);
  if (typeof target === 'string') return target;
  const stamina = kind === 'hunt' ? (STAMINA.cost[(target as MapCamp).kind] ?? 10) : 0;
  if (state.wallet.stamina < stamina) return 'Not enough stamina';
  state.wallet.stamina -= stamina;
  m.kind = kind;
  m.target = targetId;
  m.from = pos;
  m.reportId = null;
  m.x = target.x;
  m.y = target.y;
  m.startAt = now;
  m.arriveAt = m.doneAt =
    now + Math.max(MIDGARD.minRedirectMs, Math.round(Math.hypot(target.x - pos.x, target.y - pos.y) * pace));
  m.returnAt = m.doneAt + travelMs(state, target.x, target.y, m.troops);
  events.push({ type: 'march.started', kind, target: targetId });
  return null;
}

/** A battle at the end of a march: survivors stay in the column, the fallen are wounded or dead. */
function fightAt(state: GameState, m: March, events: GameEvent[]): void {
  const world = midgard(state.world.realm);
  const rng = createRng(state.rngState);
  const col = m.target.startsWith('t')
    ? columns(state.world.realm).find((c) => c.id === m.target)
    : undefined;
  const jarl = col
    ? col.jarl
    : m.kind === 'attack'
      ? [...world.jarls, ...forts(state.world.realm)].find((j) => j.id === m.target)
      : undefined;
  const camp = m.kind === 'hunt' ? world.camps.find((c) => c.id === m.target) : undefined;
  if (!jarl && !camp) return;
  const attackers: Combatant[] = Object.entries(m.troops).map(([id, count]) => {
    const t = TROOPS[id]!;
    return { key: id, name: t.name, type: t.type, count, atk: t.atk, def: t.def, hp: t.hp };
  });
  for (const [id, count] of Object.entries(m.allies ?? {})) {
    const t = TROOPS[id]!;
    attackers.push({
      key: `ally-${id}`,
      name: t.name,
      type: t.type,
      count,
      atk: t.atk,
      def: t.def,
      hp: t.hp,
    });
  }
  const defenders = col ? columnDefenders(col) : jarl ? jarlDefenders(jarl) : campDefenders(camp!);
  const hm = heroMods(state, jarl ? 'conquest' : 'barrow');
  const outcome = resolveBattle(attackers, defenders, rng, { attacker: hm.ours, defender: hm.theirs });
  let room = Math.max(
    0,
    woundedCapacity(state) - sumCounts(state.army.wounded) - sumCounts(state.healing?.troops ?? {}),
  );
  const lines: ReportLine[] = [];
  const alive: Record<string, number> = {};
  for (const s of outcome.attacker) {
    const fallen = s.start - s.alive;
    if (s.key.startsWith('ally-')) {
      // Alliance-mates' warriors: in the report, but not yours to heal or lose.
      lines.push({
        unit: s.key,
        name: `⚑ ${s.name}`,
        type: s.type,
        start: s.start,
        dead: fallen,
        wounded: 0,
      });
      continue;
    }
    const hurt = Math.min(room, Math.floor(fallen * MILITARY.woundedShare));
    room -= hurt;
    if (hurt > 0) addCounts(state.army.wounded, { [s.key]: hurt });
    if (s.alive > 0) alive[s.key] = s.alive;
    lines.push({
      unit: s.key,
      name: s.name,
      type: s.type,
      start: s.start,
      dead: fallen - hurt,
      wounded: hurt,
    });
  }
  m.troops = alive;
  const won = outcome.attackerWon;
  const drops = jarl ? { 'chest-spoils': 1, 'speed-5m': 1 } : CAMPS[camp!.kind].drops;
  recordBattle(state, won, killsOf(outcome.defender), drops);
  const load: Cost = {};
  if (won) {
    const level = jarl ? jarl.level : camp!.level;
    const base = jarl ? MIDGARD.jarlStores : CAMPS[camp!.kind].reward;
    const share = col ? MIDGARD.columnShare : jarl ? PVP.lootShare : 1;
    for (const [r, v] of Object.entries(base)) load[r as keyof Cost] = Math.floor(v * level * share);
    // Warriors carry home only what they can lift.
    const total = Object.values(load).reduce((a, b) => a + (b ?? 0), 0);
    const cap = carryOf(alive);
    if (total > cap && total > 0)
      for (const r of PRODUCED_RESOURCES) if (load[r]) load[r] = Math.floor(load[r]! * (cap / total));
    state.world.cleared[m.target] =
      m.arriveAt +
      (col
        ? MIDGARD.campRespawnMs
        : jarl
          ? MIDGARD.jarlShieldMs
          : camp?.kind === 'treasure'
            ? MIDGARD.treasureRespawnMs
            : MIDGARD.campRespawnMs);
    if (camp) {
      // Camps hide a little Gold, and hunting for an alliance earns alliance points.
      const gold = (EARN.campGold[camp.kind] ?? 0) + Math.floor(camp.level / 3);
      if (gold > 0) load.gold = gold;
      if (state.world.alliance !== null) state.wallet.alliance += EARN.alliancePerHuntLevel * camp.level;
    }
    if (jarl && m.allies) state.wallet.alliance += EARN.alliancePerRallyLevel * jarl.level;
  }
  // A column that fought before on this trip keeps what it already carries.
  for (const [r, v] of Object.entries(m.load))
    load[r as keyof Cost] = (load[r as keyof Cost] ?? 0) + (v ?? 0);
  m.load = load;
  const name = jarl ? jarl.name : CAMPS[camp!.kind].name;
  const tag = jarl && jarl.alliance !== null ? `[${ALLIANCES[jarl.alliance]!.tag}] ` : '';
  const report: BattleReport = {
    id: state.nextReportId++,
    at: m.arriveAt,
    kind: jarl ? 'jarl' : 'hunt',
    level: jarl ? jarl.level : camp!.level,
    title: `${won ? 'Victory' : 'Defeat'} · ${tag}${name}${col ? ' (column)' : ''}`,
    won,
    rounds: outcome.rounds,
    attacker: lines,
    defender: outcome.defender.map((s) => ({
      unit: s.key,
      name: s.name,
      type: s.type,
      start: s.start,
      dead: s.start - s.alive,
      wounded: 0,
    })),
    saga: col
      ? [
          `Your warriors caught the column of ${name} out on the road.`,
          won
            ? 'They broke it and drove off with what its carts carried.'
            : 'The column closed ranks and beat them off.',
        ]
      : jarl
        ? [
            `Your warriors marched on the hold of ${name}.`,
            won
              ? 'The palisade fell and the defenders broke. Your warriors loaded what they could carry and turned for home.'
              : 'The defenders held the gate, and your warriors fell back.',
          ]
        : camp!.kind === 'treasure'
          ? [
              'Your warriors found the wreck on the shore and pried open the sea chest.',
              'They are hauling the silver home.',
            ]
          : [
              `Your warriors tracked the ${name.toLowerCase()} across the wilds.`,
              won
                ? 'The fight was hard but short, and the spoils are on their way home.'
                : 'It was too strong for them, and they fell back.',
            ],
    reward: load,
    ...(won ? { items: drops } : {}),
    read: false,
  };
  state.rngState = rng.state;
  state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
  m.reportId = report.id;
  if (sumCounts(alive) === 0) m.returnAt = m.arriveAt;
  events.push({ type: 'battle.resolved', reportId: report.id, won, level: report.level, kind: report.kind });
}

/** Moves every march forward to `now`: battles on arrival, loads home on return. */
export function advanceMarches(state: GameState, now: number, events: GameEvent[]): void {
  if (!state.marches.length) return;
  const sorted = [...state.marches].sort((a, b) => a.arriveAt - b.arriveAt || a.id - b.id);
  for (const m of sorted) {
    if (m.kind !== 'gather' && m.reportId === null && m.arriveAt <= now) {
      // 0: no battle (they reached a spot and stand there).
      if (isWaypoint(m.target)) m.reportId = 0;
      else fightAt(state, m, events);
    }
    if (m.kind === 'gather' && now >= m.doneAt && !Object.keys(m.load).length) {
      const node = midgard(state.world.realm).nodes.find((n) => n.id === m.target);
      if (node && m.doneAt > m.arriveAt)
        m.load = { [NODES[node.kind].res]: gatherPlan(node, m.troops).amount };
    }
    if (m.returnAt <= now) {
      state.marches = state.marches.filter((q) => q !== m);
      addCounts(state.army.troops, m.troops);
      for (const [r, v] of Object.entries(m.load)) state.resources[r as keyof Cost] += v ?? 0;
      if (m.kind === 'gather' && state.world.alliance !== null) {
        const total = Object.values(m.load).reduce((a, b) => a + (b ?? 0), 0);
        state.wallet.alliance += Math.floor(total * EARN.alliancePerGathered);
      }
      const report = m.reportId ? state.reports.find((r) => r.id === m.reportId) : undefined;
      events.push({
        type: 'march.returned',
        kind: m.kind,
        load: m.load,
        items: report?.items ?? {},
        troops: sumCounts(m.troops),
      });
    }
  }
}

/** The closest of a list of map objects to (x, y). */
export function nearest<T extends { x: number; y: number }>(list: T[], x: number, y: number): T | undefined {
  let best: T | undefined;
  let bd = Infinity;
  for (const o of list) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** Your alliance-mates who answer a rally (the strongest first), as one band of warriors. */
export function rallyAllies(state: GameState): Record<string, number> | undefined {
  const a = state.world.alliance;
  if (a === null) return undefined;
  // In the war zone your alliance came with you: its jarls are those of your home realm.
  const realm = state.world.origin?.realm ?? state.world.realm;
  const mates = midgard(realm)
    .jarls.filter((j) => j.alliance === a)
    .sort((p, q) => q.power - p.power)
    .slice(0, WARFARE.rallySlots);
  if (!mates.length) return undefined;
  const out: Record<string, number> = {};
  for (const j of mates) {
    const tier = Math.min(3, 1 + Math.floor((j.level - 1) / 6));
    for (const type of ['shieldwall', 'berserker', 'archer'] as const) {
      const t = TROOPS[`${type}-${tier}`]!;
      const per = armyStrength([{ ...t, count: 1 }]);
      const n = Math.round((jarlStrengthOf(j.level) * WARFARE.rallyShare) / 3 / per);
      if (n > 0) out[t.id] = (out[t.id] ?? 0) + n;
    }
  }
  return out;
}

export const rallySize = (state: GameState) => {
  const a = state.world.alliance;
  if (a === null) return 0;
  const realm = state.world.origin?.realm ?? state.world.realm;
  return Math.min(WARFARE.rallySlots, midgard(realm).jarls.filter((j) => j.alliance === a).length);
};

/** The heroes leading a jarl's hold (three saga heroes, deterministic per jarl). */
export function jarlHeroes(jarl: MapJarl): Array<{ id: string; level: number }> {
  const rng = createRng(hashString(`heroes-${jarl.id}-${jarl.name}`));
  const pool = HEROES.map((h) => h.id);
  const out: Array<{ id: string; level: number }> = [];
  while (out.length < 3 && pool.length) {
    const [id] = pool.splice(nextInt(rng, 0, pool.length - 1), 1);
    out.push({ id: id!, level: Math.max(1, jarl.level * 3 + nextInt(rng, -3, 3)) });
  }
  return out;
}

/** Scouts a jarl's hold: warriors, wall, stores and heroes, in a report. Returns an error, or null. */
export function scoutJarl(state: GameState, jarlId: string, now: number, events: GameEvent[]): string | null {
  const jarl = [...midgard(state.world.realm).jarls, ...forts(state.world.realm)].find(
    (j) => j.id === jarlId,
  );
  if (!jarl) return 'Nothing to march on there';
  if (jarl.alliance !== null && jarl.alliance === state.world.alliance)
    return 'This jarl is in your alliance';
  const cost = WARFARE.scoutSilverPerLevel * jarl.level;
  if (state.resources.silver < cost) return 'Not enough Silver';
  state.resources.silver -= cost;
  const defenders = jarlDefenders(jarl);
  const troops: Record<string, number> = {};
  let wall = 0;
  for (const d of defenders) {
    if (d.type === 'wall') wall = d.hp;
    else troops[d.key] = d.count;
  }
  const stores: Cost = {};
  for (const [r, v] of Object.entries(MIDGARD.jarlStores))
    stores[r as keyof Cost] = Math.floor(v * jarl.level);
  const tag = jarl.alliance !== null ? `[${ALLIANCES[jarl.alliance]!.tag}] ` : '';
  const report: BattleReport = {
    id: state.nextReportId++,
    at: now,
    kind: 'scout',
    level: jarl.level,
    title: `Scouted · ${tag}${jarl.name}`,
    won: true,
    rounds: 0,
    attacker: [],
    defender: [],
    saga: [
      `Your scouts reached the hold of ${tag}${jarl.name} unseen.`,
      'Below: the warriors guarding it, its wall, the stores you could take and its heroes. Compare them with your army before you attack.',
    ],
    reward: {},
    scout: { troops, wall, stores, heroes: jarlHeroes(jarl), power: jarl.power },
    read: false,
  };
  state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
  events.push({ type: 'scout.done', reportId: report.id });
  return null;
}

/** Marks or unmarks a foe (shown red on the map). */
export function markFoe(state: GameState, id: string, on: boolean): void {
  const foes = new Set(state.world.foes ?? []);
  if (on) foes.add(id);
  else foes.delete(id);
  state.world.foes = [...foes];
}

/**
 * Rival jarls spy on growing holds (owner request: being scouted shows in your mail).
 * Every few hours one of the nearest rivals sends scouts; the report names them and
 * they become your foe (red on the map).
 */
export function advanceSpies(state: GameState, now: number, events: GameEvent[]): void {
  if (hallLevel(state) < MIDGARD.spyFromHall || state.world.origin) return;
  if (state.world.spyAt === undefined) {
    state.world.spyAt = now + MIDGARD.spyEveryMs;
    return;
  }
  if (now < state.world.spyAt) return;
  const rng = createRng(state.rngState);
  const { x, y } = state.world.home;
  const rivals = midgard(state.world.realm)
    .jarls.filter((j) => j.alliance === null || j.alliance !== state.world.alliance)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
    .slice(0, 6);
  // Only one spy report per wait, however long you were away.
  state.world.spyAt = now + Math.round(MIDGARD.spyEveryMs * (0.6 + nextInt(rng, 0, 80) / 100));
  state.rngState = rng.state;
  const jarl = rivals[nextInt(rng, 0, Math.max(0, rivals.length - 1))];
  if (!jarl) return;
  state.rngState = rng.state;
  const tag = jarl.alliance !== null ? `[${ALLIANCES[jarl.alliance]!.tag}] ` : '';
  const report: BattleReport = {
    id: state.nextReportId++,
    at: now,
    kind: 'spied',
    level: jarl.level,
    title: `Spied on · ${tag}${jarl.name}`,
    won: false,
    rounds: 0,
    attacker: [],
    defender: [],
    saga: [
      `Your watchmen caught scouts of ${tag}${jarl.name} near your hold.`,
      'They counted your warriors and your stores, then slipped away. Expect them; they are your foe now.',
    ],
    reward: {},
    read: false,
  };
  state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
  markFoe(state, jarl.id, true);
  events.push({ type: 'hold.spied', jarlId: jarl.id, reportId: report.id });
}

const fortCache = new Map<number, MapJarl[]>();

/**
 * The alliances' ring forts as targets (owner request: "attack anything you are strong
 * enough for"). A fort is held like a great jarl's hold, the King's alliance strongest;
 * a rally of the alliance is the sensible way to take one.
 */
export function forts(realmId: number): MapJarl[] {
  const hit = fortCache.get(realmId);
  if (hit) return hit;
  const map = realmMap(realmId);
  const king = REALMS.find((r) => r.id === realmId)?.kingAlliance;
  const out = map.seats.map((seat) => {
    const level = seat.alliance === king ? MIDGARD.fortLevel + 2 : MIDGARD.fortLevel;
    return {
      id: `f${seat.alliance}`,
      name: `${ALLIANCES[seat.alliance]!.name} Ring Fort`,
      alliance: seat.alliance,
      x: seat.x,
      y: seat.y,
      level,
      power: Math.round(jarlStrengthOf(level) * 9 + level * 1_800),
      avatar: 0,
    };
  });
  fortCache.set(realmId, out);
  return out;
}
