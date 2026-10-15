import { BUILDINGS, type BuildingType } from '../data/buildings';
import { ECONOMY } from '../data/economy';
import {
  PRODUCED_RESOURCES,
  type Cost,
  type ProducedResourceId,
  type ResourceId,
  type Resources,
} from '../data/resources';
import { HALL_PLOT_ID } from '../data/plots';
import type { GameState } from '../state';
import { troopPower } from './military';

/** Rounds costs to friendly numbers: 10s below 1,000, 50s below 10,000, then 100s. */
function niceRound(n: number): number {
  const step = n < 1_000 ? 10 : n < 10_000 ? 50 : 100;
  return Math.max(step, Math.round(n / step) * step);
}

/** Resources needed to raise a building to `toLevel`. */
export function upgradeCost(type: BuildingType, toLevel: number): Cost {
  const def = BUILDINGS[type];
  const factor = def.costGrowth ** (toLevel - 1);
  const cost: Cost = {};
  for (const [res, base] of Object.entries(def.baseCost) as Array<[ResourceId, number]>) {
    cost[res] = niceRound(base * factor);
  }
  return cost;
}

/** Sum over finished buildings of `pick(def) × level` (e.g. research or build speed). */
function perLevelBonus(
  state: GameState,
  pick: (def: (typeof BUILDINGS)[BuildingType]) => number | undefined,
): number {
  let bonus = 0;
  for (const b of Object.values(state.buildings)) bonus += (pick(BUILDINGS[b.type]) ?? 0) * b.level;
  return bonus;
}

/** Milliseconds needed to raise a building to `toLevel` (faster with a Builders' Lodge when `state` is given). */
export function upgradeDurationMs(type: BuildingType, toLevel: number, state?: GameState): number {
  const def = BUILDINGS[type];
  const speed = state
    ? Math.min(
        0.5,
        perLevelBonus(state, (d) => d.buildSpeedPerLevel),
      )
    : 0;
  return Math.round(def.baseSeconds * def.timeGrowth ** (toLevel - 1) * (1 - speed)) * 1000;
}

/** Production bonus from the Rune Hall (0.1 = +10 %). */
export function researchBonus(state: GameState): number {
  return perLevelBonus(state, (d) => d.researchPerLevel);
}

export function hallLevel(state: GameState): number {
  return state.buildings[HALL_PLOT_ID]?.level ?? 1;
}

export function builderSlots(state: GameState): number {
  const hall = hallLevel(state);
  let lodges = 0;
  for (const b of Object.values(state.buildings)) if (b.level > 0) lodges += BUILDINGS[b.type].builders ?? 0;
  return ECONOMY.baseBuilders + ECONOMY.extraBuilderAtHall.filter((lvl) => hall >= lvl).length + lodges;
}

export function countOfType(state: GameState, type: BuildingType): number {
  return Object.values(state.buildings).filter((b) => b.type === type).length;
}

/** Highest level among buildings of a type (0 if none). */
export function maxLevelOfType(state: GameState, type: BuildingType): number {
  return Object.values(state.buildings).reduce((m, b) => (b.type === type ? Math.max(m, b.level) : m), 0);
}

/** Hourly production of each resource, summed over all buildings in one pass. */
export function productionPerHour(state: GameState): Record<ProducedResourceId, number> {
  const rates = { food: 0, timber: 0, iron: 0, silver: 0 };
  for (const b of Object.values(state.buildings)) {
    const p = BUILDINGS[b.type].produces;
    if (p && b.level > 0) rates[p.resource] += p.perHour * p.growth ** (b.level - 1);
  }
  const boost = 1 + researchBonus(state);
  for (const r of PRODUCED_RESOURCES) rates[r] *= boost;
  return rates;
}

export function storageCap(state: GameState): Record<ProducedResourceId, number> {
  let extra = 0;
  for (const b of Object.values(state.buildings)) {
    const s = BUILDINGS[b.type].storage;
    if (s && b.level > 0) {
      for (let l = 1; l <= b.level; l++) extra += s.perLevel * s.growth ** (l - 1);
    }
  }
  const caps = { ...ECONOMY.baseStorage };
  for (const r of PRODUCED_RESOURCES) caps[r] = Math.round(caps[r] + extra);
  return caps;
}

export function totalPower(state: GameState): number {
  let power = troopPower(state);
  for (const b of Object.values(state.buildings)) {
    const per = BUILDINGS[b.type].power;
    // Each level is worth a little more than the last.
    for (let l = 1; l <= b.level; l++) power += Math.round(per * (1 + 0.15 * (l - 1)));
  }
  return power;
}

export function canAfford(resources: Resources, cost: Cost): ResourceId | null {
  for (const [res, amount] of Object.entries(cost) as Array<[ResourceId, number]>) {
    if (resources[res] < amount) return res;
  }
  return null;
}

export function pay(resources: Resources, cost: Cost): void {
  for (const [res, amount] of Object.entries(cost) as Array<[ResourceId, number]>) resources[res] -= amount;
}

export function grant(resources: Resources, reward: Cost): void {
  for (const [res, amount] of Object.entries(reward) as Array<[ResourceId, number]>) resources[res] += amount;
}

/** Gold needed to finish a timer instantly. */
export function goldToFinish(remainingMs: number): number {
  return Math.max(1, Math.ceil((remainingMs / 60_000) * ECONOMY.goldPerMinute));
}
