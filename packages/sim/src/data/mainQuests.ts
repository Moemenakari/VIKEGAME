import type { BuildingType } from './buildings';
import type { Cost } from './resources';

/**
 * The main quest line: one clear next step at a time, shown in the guide bar at the
 * bottom of the screen. Each step is checked against the hold's state, so it completes
 * no matter how the player got there.
 */
export type MainGoal =
  | { kind: 'building'; building: BuildingType; level: number }
  | { kind: 'troops'; count: number }
  | { kind: 'barrow'; level: number };

export interface MainQuestDef {
  id: string;
  goal: MainGoal;
  reward: Cost;
}

const b = (building: BuildingType, level: number, reward: Cost): MainQuestDef => ({
  id: `${building}-${level}`,
  goal: { kind: 'building', building, level },
  reward,
});

export const MAIN_QUESTS: readonly MainQuestDef[] = [
  b('greatHall', 2, { food: 500, timber: 500 }),
  b('storehouse', 1, { silver: 100 }),
  b('farmstead', 2, { food: 800 }),
  b('woodcutter', 2, { timber: 800 }),
  b('shieldYard', 1, { food: 600, timber: 300 }),
  { id: 'troops-20', goal: { kind: 'troops', count: 20 }, reward: { food: 800, gold: 10 } },
  { id: 'barrow-1', goal: { kind: 'barrow', level: 1 }, reward: { silver: 150, gold: 20 } },
  b('healersHouse', 1, { food: 600 }),
  b('storehouse', 2, { timber: 1_000 }),
  b('greatHall', 3, { food: 1_500, timber: 1_500, gold: 30 }),
  b('bowyerRange', 1, { timber: 800 }),
  b('market', 1, { food: 1_000 }),
  { id: 'troops-60', goal: { kind: 'troops', count: 60 }, reward: { food: 1_500, gold: 10 } },
  { id: 'barrow-3', goal: { kind: 'barrow', level: 3 }, reward: { silver: 300, gold: 30 } },
  b('greatHall', 4, { food: 2_500, timber: 2_500 }),
  b('wolfLodge', 1, { food: 1_500 }),
  b('greatHall', 5, { food: 4_000, timber: 4_000, gold: 50 }),
];

/** Daily activity chests: claiming daily quests fills the bar (GDD §13, like the reference's chest track). */
export const DAILY_CHESTS: ReadonlyArray<{ points: number; reward: Cost }> = [
  { points: 20, reward: { food: 500, timber: 500 } },
  { points: 40, reward: { silver: 100 } },
  { points: 80, reward: { food: 1_000, timber: 1_000 } },
  { points: 100, reward: { gold: 10 } },
  { points: 140, reward: { gold: 20 } },
];

/** Activity points per claimed daily quest. */
export const DAILY_QUEST_POINTS = 20;

/** Profile pictures: the first three are free, the rest cost Gold (owner request). */
export const AVATARS: ReadonlyArray<{ id: number; cost: number }> = [
  { id: 0, cost: 0 },
  { id: 1, cost: 0 },
  { id: 2, cost: 0 },
  { id: 3, cost: 50 },
  { id: 4, cost: 50 },
  { id: 5, cost: 80 },
];
