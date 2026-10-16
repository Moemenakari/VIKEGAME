import {
  BUILDINGS,
  DAILY_QUESTS,
  apply,
  suggestSpot,
  type BuildingType,
  type Command,
  type GameState,
  type MainGoal,
  type Need,
  type ResourceId,
} from '@jarlheim/sim';

/**
 * Where a "Go" arrow takes the player: which building (or the barrow, the build menu,
 * the builders) to open, and which button to make pulse there. If the step cannot be
 * done yet, the arrow follows what blocks it, step by step (Great Hall first, a missing
 * resource, a free builder...), until it reaches something the player CAN do now.
 * Pure: it only reads the state.
 */
export interface Route {
  /** A building id, 'barrow', 'build' (build menu) or 'builders'. */
  target: string;
  /** data-hint of the button to highlight once the panel is open. */
  hint: string;
}

/** Who makes each resource (where a "not enough" arrow leads). */
const PRODUCER: Partial<Record<ResourceId, BuildingType>> = {
  food: 'farmstead',
  timber: 'woodcutter',
  iron: 'smelter',
  silver: 'market',
};

const hasJob = (state: GameState, id: string) => state.queue.some((j) => j.buildingId === id);

/** The best building of a type: highest level first. */
function idOf(state: GameState, type: BuildingType): string | null {
  let best: { id: string; level: number } | null = null;
  for (const b of Object.values(state.buildings)) {
    if (b.type === type && (!best || b.level > best.level)) best = { id: b.id, level: b.level };
  }
  return best?.id ?? null;
}

function blocker(state: GameState, cmd: Command, now: number): Need | null {
  const r = apply(state, cmd, now);
  return r.ok ? null : (r.error.need ?? null);
}

/** Route that unblocks a need (depth-limited, so a loop can never hang the UI). */
export function routeForNeed(state: GameState, need: Need, now: number, depth = 0): Route | null {
  if (depth > 5) return null;
  switch (need.kind) {
    case 'builder':
      return { target: 'builders', hint: 'builder-go' };
    case 'troops':
      return toTraining(state, now, depth + 1);
    case 'resource': {
      const producer = PRODUCER[need.resource];
      return producer ? toBuilding(state, producer, now, depth + 1) : { target: 'quests', hint: '' };
    }
    case 'building':
      return toBuilding(state, need.building, now, depth + 1);
  }
}

/** Go to a building to raise it (or to build it), following blockers first. */
function toBuilding(state: GameState, type: BuildingType, now: number, depth = 0): Route | null {
  const id = idOf(state, type);
  if (id) {
    if (hasJob(state, id)) return { target: id, hint: 'finish' };
    const need = blocker(state, { type: 'upgrade', buildingId: id }, now);
    if (need && depth < 5) return routeForNeed(state, need, now, depth) ?? { target: id, hint: 'upgrade' };
    return { target: id, hint: 'upgrade' };
  }
  const spot = suggestSpot(state, type);
  if (spot) {
    const need = blocker(state, { type: 'build', building: type, ...spot }, now);
    if (need && depth < 5)
      return routeForNeed(state, need, now, depth) ?? { target: 'build', hint: `build-${type}` };
  }
  return { target: 'build', hint: `build-${type}` };
}

function toTraining(state: GameState, now: number, depth = 0): Route | null {
  const trainer = Object.values(state.buildings)
    .filter((b) => BUILDINGS[b.type].trains && BUILDINGS[b.type].trains !== 'ship' && b.level > 0)
    .sort((a, b) => b.level - a.level)[0];
  return trainer ? { target: trainer.id, hint: 'train' } : toBuilding(state, 'shieldYard', now, depth);
}

export function routeForGoal(state: GameState, goal: MainGoal, now: number): Route | null {
  switch (goal.kind) {
    case 'building':
      return toBuilding(state, goal.building, now);
    case 'troops':
      return toTraining(state, now);
    case 'barrow':
      return { target: 'barrow', hint: 'attack' };
  }
}

/** Any construction: the Great Hall if it can go up now, otherwise a new farm. */
function toAnyConstruction(state: GameState, now: number): Route | null {
  if (!hasJob(state, 'hall') && !blocker(state, { type: 'upgrade', buildingId: 'hall' }, now))
    return { target: 'hall', hint: 'upgrade' };
  return toBuilding(state, 'farmstead', now);
}

export function routeForDaily(state: GameState, questId: string, now: number): Route | null {
  const quest = DAILY_QUESTS.find((q) => q.id === questId);
  if (!quest) return null;
  switch (quest.metric) {
    case 'produced.food':
      return toBuilding(state, 'farmstead', now);
    case 'produced.timber':
      return toBuilding(state, 'woodcutter', now);
    case 'troops.trained':
      return toTraining(state, now);
    case 'battle.won':
      return { target: 'barrow', hint: 'attack' };
    case 'finish.free':
    case 'building.completed': {
      const job = state.queue[0];
      if (job) return { target: job.buildingId, hint: 'finish' };
      return toAnyConstruction(state, now);
    }
    default:
      return toAnyConstruction(state, now);
  }
}
