import { BUILDINGS } from '../data/buildings';
import { MILITARY, TROOPS, type TroopDef } from '../data/troops';
import type { Cost, ResourceId } from '../data/resources';
import type { GameState } from '../state';

export const troopDef = (id: string): TroopDef | undefined => TROOPS[id];

/** Largest batch a training building of this level can take at once. */
export function batchLimit(level: number): number {
  return MILITARY.batchBase + MILITARY.batchPerLevel * level;
}

export function trainCost(troopId: string, count: number): Cost {
  const def = TROOPS[troopId]!;
  const cost: Cost = {};
  for (const [res, n] of Object.entries(def.cost) as Array<[ResourceId, number]>) cost[res] = n * count;
  return cost;
}

export function trainDurationMs(troopId: string, count: number): number {
  return TROOPS[troopId]!.trainSeconds * count * 1000;
}

export function woundedCapacity(state: GameState): number {
  let cap = MILITARY.baseWoundedCapacity;
  for (const b of Object.values(state.buildings)) {
    const w = BUILDINGS[b.type].woundedCapacity;
    if (w) for (let l = 1; l <= b.level; l++) cap += w.perLevel * w.growth ** (l - 1);
  }
  return Math.floor(cap);
}

export const sumCounts = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);

export function healCost(wounded: Record<string, number>): Cost {
  const cost: Cost = {};
  for (const [id, n] of Object.entries(wounded)) {
    for (const [res, per] of Object.entries(TROOPS[id]?.cost ?? {}) as Array<[ResourceId, number]>) {
      cost[res] = (cost[res] ?? 0) + per * n * MILITARY.healCostFactor;
    }
  }
  for (const res of Object.keys(cost) as ResourceId[]) cost[res] = Math.ceil(cost[res]!);
  return cost;
}

export function healDurationMs(wounded: Record<string, number>): number {
  let seconds = 0;
  for (const [id, n] of Object.entries(wounded))
    seconds += (TROOPS[id]?.trainSeconds ?? 0) * n * MILITARY.healTimeFactor;
  return Math.round(seconds) * 1000;
}

export function troopPower(state: GameState): number {
  let power = 0;
  for (const [id, n] of Object.entries(state.army.troops)) power += (TROOPS[id]?.power ?? 0) * n;
  return power;
}

/** Adds counts into a record, dropping zeros. */
export function addCounts(into: Record<string, number>, add: Record<string, number>, sign = 1): void {
  for (const [id, n] of Object.entries(add)) {
    const v = (into[id] ?? 0) + sign * n;
    if (v > 0) into[id] = v;
    else delete into[id];
  }
}
