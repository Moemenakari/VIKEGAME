import { BUILDINGS, DAILY_QUESTS, type BuildingType, type GameState, type MainGoal } from '@jarlheim/sim';

/**
 * Where a quest's "Go" arrow takes the player: which plot (or the barrow) to open,
 * and which button to make pulse there. Pure: it only reads the state.
 */
export interface Route {
  /** A building id, 'barrow', or 'build' for the build menu. */
  target: string;
  /** data-testid of the button to highlight once the panel is open. */
  hint: string;
}

const hasJob = (state: GameState, id: string) => state.queue.some((j) => j.buildingId === id);

/** The best plot holding this building type: highest level first. */
function plotOf(state: GameState, type: BuildingType): string | null {
  let best: { id: string; level: number } | null = null;
  for (const b of Object.values(state.buildings)) {
    if (b.type === type && (!best || b.level > best.level)) best = { id: b.id, level: b.level };
  }
  return best?.id ?? null;
}

function toBuilding(state: GameState, type: BuildingType): Route | null {
  const plot = plotOf(state, type);
  if (plot) return { target: plot, hint: hasJob(state, plot) ? 'finish' : 'upgrade' };
  return { target: 'build', hint: `build-${type}` };
}

function toTraining(state: GameState): Route | null {
  const trainer = Object.values(state.buildings)
    .filter((b) => BUILDINGS[b.type].trains && BUILDINGS[b.type].trains !== 'ship' && b.level > 0)
    .sort((a, b) => b.level - a.level)[0];
  return trainer ? { target: trainer.id, hint: 'train' } : toBuilding(state, 'shieldYard');
}

export function routeForGoal(state: GameState, goal: MainGoal): Route | null {
  switch (goal.kind) {
    case 'building':
      return toBuilding(state, goal.building);
    case 'troops':
      return toTraining(state);
    case 'barrow':
      return { target: 'barrow', hint: 'attack' };
  }
}

/** Any construction: the Great Hall if it is free, otherwise the build menu. */
function toAnyConstruction(state: GameState): Route | null {
  if (!hasJob(state, 'hall')) return toBuilding(state, 'greatHall');
  return { target: 'build', hint: 'build-farmstead' };
}

export function routeForDaily(state: GameState, questId: string): Route | null {
  const quest = DAILY_QUESTS.find((q) => q.id === questId);
  if (!quest) return null;
  switch (quest.metric) {
    case 'produced.food':
      return toBuilding(state, 'farmstead');
    case 'produced.timber':
      return toBuilding(state, 'woodcutter');
    case 'troops.trained':
      return toTraining(state);
    case 'battle.won':
      return { target: 'barrow', hint: 'attack' };
    case 'finish.free':
    case 'building.completed': {
      const job = state.queue[0];
      if (job) return { target: job.buildingId, hint: 'finish' };
      return toAnyConstruction(state);
    }
    default:
      return toAnyConstruction(state);
  }
}
