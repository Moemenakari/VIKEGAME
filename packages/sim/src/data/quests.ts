import type { Cost } from './resources';

/** What a daily quest counts. Each metric is fed by a simulation event. */
export type QuestMetric =
  'construction.started' | 'building.completed' | 'produced.food' | 'produced.timber' | 'finish.free';

export interface QuestDef {
  id: string;
  title: string;
  metric: QuestMetric;
  target: number;
  reward: Cost;
}

/** Daily quests (GDD §13, LIVE_EVENTS §1). They reset at 00:00 UTC. Every day pays some Gold. */
export const DAILY_QUESTS: readonly QuestDef[] = [
  {
    id: 'start-3',
    title: 'Start 3 constructions',
    metric: 'construction.started',
    target: 3,
    reward: { silver: 120 },
  },
  {
    id: 'complete-2',
    title: 'Complete 2 upgrades',
    metric: 'building.completed',
    target: 2,
    reward: { food: 800, timber: 800 },
  },
  {
    id: 'food-2000',
    title: 'Produce 2,000 Food',
    metric: 'produced.food',
    target: 2_000,
    reward: { gold: 10 },
  },
  {
    id: 'timber-2000',
    title: 'Produce 2,000 Timber',
    metric: 'produced.timber',
    target: 2_000,
    reward: { gold: 10 },
  },
  { id: 'free-finish', title: 'Use a free finish', metric: 'finish.free', target: 1, reward: { gold: 5 } },
];
