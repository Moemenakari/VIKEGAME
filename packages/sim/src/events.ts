import type { BuildingType } from './data/buildings';
import type { Cost, ProducedResourceId } from './data/resources';

/** Everything that happened during a step. The UI turns these into toasts, sounds and effects. */
export type GameEvent =
  | { type: 'construction.started'; buildingId: string; building: BuildingType; targetLevel: number }
  | { type: 'building.completed'; buildingId: string; building: BuildingType; level: number }
  | { type: 'finish.free'; buildingId: string }
  | { type: 'finish.gold'; buildingId: string; gold: number }
  /** One aggregated event per step, never one per tick or per building. */
  | { type: 'resources.produced'; amounts: Partial<Record<ProducedResourceId, number>> }
  | { type: 'quests.reset'; day: number }
  | { type: 'quest.completed'; questId: string }
  | { type: 'quest.claimed'; questId: string; reward: Cost };
