import type { Cost, ProducedResourceId } from './resources';
import type { TroopType } from './troops';

/** Buildings available in M2 (GDD §4.1). More arrive with later milestones. */
export const BUILDING_TYPES = [
  'greatHall',
  'farmstead',
  'fishRacks',
  'woodcutter',
  'smelter',
  'market',
  'storehouse',
  'shieldYard',
  'bowyerRange',
  'wolfLodge',
  'healersHouse',
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export interface BuildingDef {
  type: BuildingType;
  name: string;
  /** Old Norse name shown under the English one (sources: HISTORY_BIBLE.md). */
  norse: string;
  description: string;
  /** Great Hall level needed to build the first one. */
  unlockHall: number;
  /** How many of this building a hold may have. */
  maxCount: number;
  /** Cost of level 1. Level L costs baseCost × costGrowth^(L−1). */
  baseCost: Cost;
  costGrowth: number;
  /** Seconds to reach level 1. Level L takes baseSeconds × timeGrowth^(L−1). */
  baseSeconds: number;
  timeGrowth: number;
  /** Hourly production at level 1; level L produces perHour × growth^(L−1). */
  produces?: { resource: ProducedResourceId; perHour: number; growth: number };
  /** Extra storage for every produced resource at level 1, growing per level. */
  storage?: { perLevel: number; growth: number };
  /** Trains this troop type (GDD §5). */
  trains?: TroopType;
  /** Extra wounded the hold can care for, at level 1, growing per level. */
  woundedCapacity?: { perLevel: number; growth: number };
  /** Power gained per level. */
  power: number;
  /**
   * Upgrade requirements on other buildings, e.g. the Great Hall needs the Storehouse
   * at (target level + levelOffset) once the target reaches fromLevel.
   */
  requires?: ReadonlyArray<{ type: BuildingType; levelOffset: number; fromLevel: number }>;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  greatHall: {
    type: 'greatHall',
    name: 'Great Hall',
    norse: 'Skáli',
    description: 'The heart of your hold. Its High Seat caps the level of every other building.',
    unlockHall: 1,
    maxCount: 1,
    baseCost: { timber: 500, food: 300 },
    costGrowth: 1.58,
    baseSeconds: 45,
    timeGrowth: 1.62,
    power: 120,
    requires: [{ type: 'storehouse', levelOffset: -1, fromLevel: 3 }],
  },
  farmstead: {
    type: 'farmstead',
    name: 'Farmstead',
    norse: 'Bær',
    description: 'Barley fields and a byre. Feeds your people and your warriors.',
    unlockHall: 1,
    maxCount: 3,
    baseCost: { timber: 120, food: 40 },
    costGrowth: 1.45,
    baseSeconds: 8,
    timeGrowth: 1.52,
    produces: { resource: 'food', perHour: 420, growth: 1.24 },
    power: 25,
  },
  fishRacks: {
    type: 'fishRacks',
    name: 'Fish Racks',
    norse: 'Hjallr',
    description: 'Cod hung to dry in the wind becomes stockfish that keeps for years.',
    unlockHall: 2,
    maxCount: 2,
    baseCost: { timber: 150 },
    costGrowth: 1.45,
    baseSeconds: 10,
    timeGrowth: 1.52,
    produces: { resource: 'food', perHour: 360, growth: 1.25 },
    power: 25,
  },
  woodcutter: {
    type: 'woodcutter',
    name: "Woodcutter's Camp",
    norse: 'Viðr',
    description: 'Oak for keels and pine for halls. Every building needs timber.',
    unlockHall: 1,
    maxCount: 3,
    baseCost: { food: 130, timber: 30 },
    costGrowth: 1.45,
    baseSeconds: 8,
    timeGrowth: 1.52,
    produces: { resource: 'timber', perHour: 420, growth: 1.24 },
    power: 25,
  },
  smelter: {
    type: 'smelter',
    name: 'Bog-iron Smelter',
    norse: 'Rauðablástr',
    description: 'Iron won from bog ore in a clay furnace, the way the Norse made theirs.',
    unlockHall: 8,
    maxCount: 2,
    baseCost: { timber: 900, food: 600 },
    costGrowth: 1.47,
    baseSeconds: 120,
    timeGrowth: 1.5,
    produces: { resource: 'iron', perHour: 180, growth: 1.24 },
    power: 40,
  },
  market: {
    type: 'market',
    name: 'Market',
    norse: 'Kaupangr',
    description: 'Traders weigh hacksilver on their scales. Taxes bring Silver to your hold.',
    unlockHall: 3,
    maxCount: 1,
    baseCost: { timber: 400, food: 250 },
    costGrowth: 1.5,
    baseSeconds: 40,
    timeGrowth: 1.55,
    produces: { resource: 'silver', perHour: 120, growth: 1.22 },
    power: 35,
  },
  storehouse: {
    type: 'storehouse',
    name: 'Storehouse',
    norse: 'Útibúr',
    description: 'Raised on posts to keep out damp and rats. Holds more of everything.',
    unlockHall: 1,
    maxCount: 1,
    baseCost: { timber: 200, food: 100 },
    costGrowth: 1.5,
    baseSeconds: 15,
    timeGrowth: 1.55,
    storage: { perLevel: 4_000, growth: 1.3 },
    power: 30,
  },
  shieldYard: {
    type: 'shieldYard',
    name: 'Shield Yard',
    norse: 'Skjaldborg',
    description: 'Where farmers learn to lock shields. Trains the Shieldwall, which breaks Berserkers.',
    unlockHall: 2,
    maxCount: 1,
    baseCost: { timber: 260, food: 160 },
    costGrowth: 1.5,
    baseSeconds: 20,
    timeGrowth: 1.55,
    trains: 'shieldwall',
    power: 40,
  },
  bowyerRange: {
    type: 'bowyerRange',
    name: "Bowyer's Range",
    norse: 'Ýr',
    description: 'Yew bows and straw targets. Trains Archers, who break the Shieldwall.',
    unlockHall: 3,
    maxCount: 1,
    baseCost: { timber: 320, food: 140 },
    costGrowth: 1.5,
    baseSeconds: 25,
    timeGrowth: 1.55,
    trains: 'archer',
    power: 40,
  },
  wolfLodge: {
    type: 'wolfLodge',
    name: 'Wolf-skin Lodge',
    norse: 'Úlfheðnar',
    description: 'Warriors in wolf pelts who fight in a fury. Trains Berserkers, who break Archers.',
    unlockHall: 4,
    maxCount: 1,
    baseCost: { timber: 300, food: 260 },
    costGrowth: 1.5,
    baseSeconds: 30,
    timeGrowth: 1.55,
    trains: 'berserker',
    power: 40,
  },
  healersHouse: {
    type: 'healersHouse',
    name: "Healer's House",
    norse: 'Læknishús',
    description: 'Herbs, linen and patient hands. Wounded warriors recover here instead of dying.',
    unlockHall: 2,
    maxCount: 1,
    baseCost: { timber: 220, food: 120 },
    costGrowth: 1.5,
    baseSeconds: 18,
    timeGrowth: 1.55,
    woundedCapacity: { perLevel: 120, growth: 1.25 },
    power: 30,
  },
};
