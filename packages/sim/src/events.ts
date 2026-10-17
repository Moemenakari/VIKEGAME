import type { BuildingType } from './data/buildings';
import type { Cost, ProducedResourceId } from './data/resources';
import type { BattleReport, March } from './state';

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
  | { type: 'quest.claimed'; questId: string; reward: Cost }
  | { type: 'training.started'; buildingId: string; troopId: string; count: number }
  | { type: 'training.completed'; buildingId: string; troopId: string; count: number }
  | { type: 'healing.started'; count: number }
  | { type: 'healing.completed'; count: number }
  | { type: 'battle.resolved'; reportId: number; won: boolean; level: number; kind?: BattleReport['kind'] }
  | { type: 'raid.spotted'; landsAt: number }
  | { type: 'raid.resolved'; reportId: number; won: boolean }
  | { type: 'heroes.recruited'; heroes: string[] }
  | { type: 'march.started'; kind: March['kind']; target: string }
  | {
      type: 'march.returned';
      kind: March['kind'];
      load: Cost;
      items: Record<string, number>;
      troops: number;
    }
  | { type: 'chest.opened'; reward: Cost }
  | { type: 'item.used'; itemId: string; count: number; queue?: 'build' | 'train' | 'heal' }
  | { type: 'shop.bought'; shop: string; item: string; count: number }
  | { type: 'teleported'; mode: string; realm: number }
  | { type: 'scout.done'; reportId: number }
  | { type: 'hold.spied'; jarlId: string; reportId: number }
  | { type: 'vs.claimed'; won: boolean; items: Record<string, number>; reward: Cost }
  | {
      type: 'pvp.fought';
      targetId: string;
      won: boolean;
      defenderLosses: Record<string, number>;
      loot: Cost;
      reportId: number;
    };
