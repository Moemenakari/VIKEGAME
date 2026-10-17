import type { Cost, ProducedResourceId } from './resources';
import type { TroopType } from './troops';

/** Buildings of the hold (GDD §4.1). Placed freely on the settlement ground (D-036). */
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
  'palisade',
  'rampart',
  'builderLodge',
  'shipyard',
  'stable',
  'bearDen',
  'siegeWorkshop',
  'thingMound',
  'envoyHouse',
  'runeHall',
  'jarlHouse',
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
  /** Radius of the ground the building stands on (world units), for placement. */
  footprint: number;
  /** A wall: the first thing raiders must break. Hit points and arrow damage per level. */
  wall?: { hp: number; atk: number; growth: number };
  /** Extra builder slots once built. */
  builders?: number;
  /** One more builder every this many levels (the lodge hires more as it grows). */
  builderEvery?: number;
  /** Construction time saved per level (0.02 = 2 %). */
  buildSpeedPerLevel?: number;
  /** Production bonus per level from research (0.02 = 2 %). */
  researchPerLevel?: number;
  /** Resources raiders cannot take, at level 1, growing per level. */
  protect?: { perLevel: number; growth: number };
  /** Raids come this much later per level (0.03 = 3 %): envoys buy time with gifts. */
  peacePerLevel?: number;
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
    footprint: 7,
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
    footprint: 3.4,
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
    footprint: 3.2,
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
    footprint: 3,
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
    footprint: 3,
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
    footprint: 3.6,
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
    footprint: 2.6,
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
    footprint: 3.6,
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
    footprint: 3.4,
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
    footprint: 3.4,
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
    footprint: 3.2,
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
  palisade: {
    type: 'palisade',
    footprint: 3.4,
    name: 'Palisade',
    norse: 'Skíðgarðr',
    description:
      'A fence of split logs with a gate and a watch platform. Raiders must break it before they reach your people.',
    unlockHall: 2,
    maxCount: 1,
    baseCost: { timber: 300, food: 60 },
    costGrowth: 1.5,
    baseSeconds: 20,
    timeGrowth: 1.55,
    wall: { hp: 600, atk: 4, growth: 1.3 },
    power: 45,
  },
  rampart: {
    type: 'rampart',
    footprint: 3.8,
    name: 'Ring Rampart',
    norse: 'Virki',
    description: 'An earth and timber rampart like the Trelleborg ring forts. A second, stronger wall.',
    unlockHall: 6,
    maxCount: 1,
    baseCost: { timber: 1_400, food: 600, iron: 100 },
    costGrowth: 1.5,
    baseSeconds: 90,
    timeGrowth: 1.55,
    wall: { hp: 1_800, atk: 8, growth: 1.3 },
    power: 70,
  },
  builderLodge: {
    type: 'builderLodge',
    footprint: 3,
    name: "Builders' Lodge",
    norse: 'Smiðir',
    description:
      'Home of the master carpenters. Adds a builder, and one more every 4 levels, and makes every construction a little faster.',
    unlockHall: 3,
    maxCount: 1,
    baseCost: { timber: 600, food: 300 },
    costGrowth: 1.5,
    baseSeconds: 40,
    timeGrowth: 1.55,
    builders: 1,
    builderEvery: 4,
    buildSpeedPerLevel: 0.02,
    power: 35,
  },
  shipyard: {
    type: 'shipyard',
    footprint: 3.8,
    name: 'Boathouse',
    norse: 'Naust',
    description: 'A long shed where keels of oak are laid. Builds warships that meet raiders at sea.',
    unlockHall: 4,
    maxCount: 1,
    baseCost: { timber: 900, food: 300 },
    costGrowth: 1.5,
    baseSeconds: 60,
    timeGrowth: 1.55,
    trains: 'ship',
    power: 50,
  },
  stable: {
    type: 'stable',
    footprint: 3.4,
    name: 'Stable',
    norse: 'Hesthús',
    description:
      'Horses for raiding on land, as the Great Army did in England. Trains Riders, who break archers.',
    unlockHall: 5,
    maxCount: 1,
    baseCost: { timber: 700, food: 500 },
    costGrowth: 1.5,
    baseSeconds: 50,
    timeGrowth: 1.55,
    trains: 'cavalry',
    power: 45,
  },
  bearDen: {
    type: 'bearDen',
    footprint: 3.2,
    name: 'Bear Den',
    norse: 'Híði',
    description:
      'From the saga of Bjarki, who fought as a bear. Raises war bears that scatter horses and shields.',
    unlockHall: 7,
    maxCount: 1,
    baseCost: { timber: 900, food: 1_200, silver: 100 },
    costGrowth: 1.5,
    baseSeconds: 80,
    timeGrowth: 1.55,
    trains: 'bear',
    power: 55,
  },
  siegeWorkshop: {
    type: 'siegeWorkshop',
    footprint: 3.6,
    name: 'Siege Workshop',
    norse: 'Vélasmiðja',
    description: 'Rams and stone throwers, like those at the siege of Paris in 885. They break walls.',
    unlockHall: 6,
    maxCount: 1,
    baseCost: { timber: 1_200, food: 400, iron: 80 },
    costGrowth: 1.5,
    baseSeconds: 70,
    timeGrowth: 1.55,
    trains: 'siege',
    power: 50,
  },
  thingMound: {
    type: 'thingMound',
    footprint: 3.4,
    name: 'Thing Mound',
    norse: 'Þing',
    description: 'Where free men meet to speak and swear. The seat of your alliance.',
    unlockHall: 5,
    maxCount: 1,
    baseCost: { timber: 800, food: 800 },
    costGrowth: 1.5,
    // Owner feedback: it felt slow for a building you need to join the alliance game.
    baseSeconds: 30,
    timeGrowth: 1.45,
    power: 40,
  },
  envoyHouse: {
    type: 'envoyHouse',
    footprint: 3,
    name: "Envoys' House",
    norse: 'Sendiboðar',
    description: 'Envoys carry gifts to rival jarls. Each level keeps raiders away a little longer.',
    unlockHall: 6,
    maxCount: 1,
    baseCost: { timber: 900, food: 700, silver: 150 },
    costGrowth: 1.5,
    baseSeconds: 60,
    timeGrowth: 1.55,
    peacePerLevel: 0.03,
    power: 35,
  },
  runeHall: {
    type: 'runeHall',
    footprint: 3.2,
    name: 'Rune Hall',
    norse: 'Rúnar',
    description:
      'Rune carvers keep knowledge in wood and stone. Each level makes every farm, camp and furnace work harder.',
    unlockHall: 4,
    maxCount: 1,
    baseCost: { timber: 700, food: 500, silver: 50 },
    costGrowth: 1.5,
    baseSeconds: 50,
    timeGrowth: 1.55,
    researchPerLevel: 0.02,
    power: 45,
  },
  jarlHouse: {
    type: 'jarlHouse',
    footprint: 3.6,
    name: "Jarl's House",
    norse: 'Höfðingjasetr',
    description: 'Your own house, with a hidden cellar. Raiders cannot carry off what is stored there.',
    unlockHall: 3,
    maxCount: 1,
    baseCost: { timber: 500, food: 400 },
    costGrowth: 1.5,
    baseSeconds: 35,
    timeGrowth: 1.55,
    protect: { perLevel: 1_500, growth: 1.3 },
    power: 35,
  },
};
