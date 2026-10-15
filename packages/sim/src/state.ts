import type { BuildingType } from './data/buildings';
import { ECONOMY } from './data/economy';
import { HALL_PLOT_ID } from './data/plots';
import type { Resources } from './data/resources';

/** One building on one plot. Its id is the plot id (one building per plot). */
export interface Building {
  id: string;
  type: BuildingType;
  /** 0 while the first construction is still running. */
  level: number;
}

export interface ConstructionJob {
  buildingId: string;
  targetLevel: number;
  startedAt: number;
  endsAt: number;
}

export interface DailyQuestState {
  /** UTC day number (days since 1970-01-01) these counters belong to. */
  day: number;
  progress: Record<string, number>;
  claimed: string[];
}

/**
 * The whole saved game. Plain JSON-friendly data only, so the entire hold can be
 * saved and loaded in ONE read/write, and later sent to a server in one message.
 */
export interface GameState {
  version: number;
  seed: number;
  createdAt: number;
  /** Production has been applied up to this moment (ms since epoch). */
  lastTick: number;
  resources: Resources;
  buildings: Record<string, Building>;
  queue: ConstructionJob[];
  quests: DailyQuestState;
}

export const STATE_VERSION = 1;

export const dayIndex = (now: number): number => Math.floor(now / 86_400_000);

/** A fresh hold: the Great Hall, one Farmstead and one Woodcutter's Camp, ready to grow. */
export function newGame(seed: number, now: number): GameState {
  return {
    version: STATE_VERSION,
    seed,
    createdAt: now,
    lastTick: now,
    resources: { ...ECONOMY.startingResources },
    buildings: {
      [HALL_PLOT_ID]: { id: HALL_PLOT_ID, type: 'greatHall', level: 1 },
      a1: { id: 'a1', type: 'farmstead', level: 1 },
      a2: { id: 'a2', type: 'woodcutter', level: 1 },
    },
    queue: [],
    quests: { day: dayIndex(now), progress: {}, claimed: [] },
  };
}
