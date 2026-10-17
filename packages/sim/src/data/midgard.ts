import type { Cost, ProducedResourceId } from './resources';
import type { UnitType } from './troops';

/**
 * What lives on the Midgard map besides land (owner request, as in the genre): the holds
 * of other jarls (your alliance-mates and rivals), wild beasts and outlaw bands to hunt,
 * and fields, woods, bog iron and old hoards to gather from. See HISTORY_BIBLE.md §2.
 */

/**
 * Personal names for the AI jarls: Old Norse names attested on runestones (Rundata)
 * and in Landnámabók, with plain bynames of the kind those sources use.
 */
export const JARL_NAMES = [
  'Ásbjǫrn',
  'Ásgeirr',
  'Áslákr',
  'Bersi',
  'Bjǫrn',
  'Eyvindr',
  'Finnr',
  'Gautr',
  'Geirr',
  'Grímr',
  'Gunnarr',
  'Hallr',
  'Hávarðr',
  'Hrafn',
  'Ingimundr',
  'Ketill',
  'Kolbeinn',
  'Ormr',
  'Óttarr',
  'Skeggi',
  'Steinn',
  'Sveinn',
  'Tóki',
  'Þórir',
  'Þorsteinn',
  'Úlfr',
  'Vémundr',
  'Ǫzurr',
  'Ása',
  'Ástríðr',
  'Gunnhildr',
  'Guðrún',
  'Helga',
  'Ingiríðr',
  'Ragnhildr',
  'Sigríðr',
  'Þóra',
  'Þórunn',
] as const;

export const BYNAMES = [
  'the White',
  'the Black',
  'the Red',
  'the Old',
  'the Wise',
  'the Strong',
  'the Tall',
  'the Quiet',
  'Flatnose',
  'the Fair',
  'the Stout',
  'Shield-bearer',
] as const;

export type CampKind = 'wolves' | 'bear' | 'outlaws' | 'draugr';
export type NodeKind = 'farm' | 'wood' | 'iron' | 'silver';

export interface CampUnit {
  key: string;
  name: string;
  type: UnitType;
  atk: number;
  def: number;
  hp: number;
  /** Share of the camp's strength in this unit. */
  share: number;
}

export interface CampDef {
  name: string;
  source: string;
  minLevel: number;
  maxLevel: number;
  units: CampUnit[];
  /** Spoils per camp level. */
  reward: Cost;
  /** Items dropped into the Bag on a win. */
  drops: Record<string, number>;
}

export const CAMPS: Record<CampKind, CampDef> = {
  // Wolves (úlfr, vargr) roamed all of Scandinavia; fast, they harry like riders.
  wolves: {
    name: 'Wolf Pack',
    source: 'Grey wolves of Scandinavia; Old Norse úlfr, vargr',
    minLevel: 1,
    maxLevel: 4,
    units: [{ key: 'wolf', name: 'Grey Wolf', type: 'cavalry', atk: 10, def: 4, hp: 24, share: 1 }],
    reward: { food: 450 },
    drops: { 'speed-5m': 1 },
  },
  // Brown bears, hunted for their hides, a gift fit for kings (Auðunar þáttr vestfirzka).
  bear: {
    name: 'Brown Bear',
    source: 'Brown bears of the north; Auðunar þáttr vestfirzka',
    minLevel: 3,
    maxLevel: 7,
    units: [{ key: 'brownbear', name: 'Brown Bear', type: 'bear', atk: 22, def: 10, hp: 90, share: 1 }],
    reward: { food: 600, iron: 45 },
    drops: { 'chest-food': 1 },
  },
  // Outlaws (skóggangsmenn) lived beyond the law in the wilds (Grágás; Gísla and Grettis sagas).
  outlaws: {
    name: 'Outlaw Camp',
    source: 'Grágás (skóggangr, full outlawry); Gísla saga; Grettis saga',
    minLevel: 2,
    maxLevel: 8,
    units: [
      { key: 'outlaw', name: 'Outlaw', type: 'berserker', atk: 13, def: 5, hp: 28, share: 0.6 },
      { key: 'outlaw-bow', name: 'Outlaw Bowman', type: 'archer', atk: 11, def: 5, hp: 22, share: 0.4 },
    ],
    reward: { food: 300, timber: 300, silver: 30 },
    drops: { 'chest-spoils': 1 },
  },
  // Draugar, the restless dead in their mounds (Grettis saga: Glámr; Eyrbyggja saga).
  draugr: {
    name: 'Draugr Mound',
    source: 'Grettis saga (Glámr); Eyrbyggja saga',
    minLevel: 6,
    maxLevel: 10,
    units: [
      { key: 'draugr', name: 'Draugr', type: 'berserker', atk: 18, def: 9, hp: 46, share: 0.55 },
      { key: 'mound-guard', name: 'Mound Guard', type: 'shieldwall', atk: 10, def: 16, hp: 48, share: 0.45 },
    ],
    reward: { silver: 90, iron: 70 },
    drops: { 'hero-scroll': 1, 'chest-silver': 1 },
  },
};

export interface NodeDef {
  name: string;
  source: string;
  res: ProducedResourceId;
  /** How much a node holds per level. */
  perLevel: number;
  /** How fast warriors gather it (per hour). */
  perHour: number;
}

export const NODES: Record<NodeKind, NodeDef> = {
  farm: {
    name: 'Barley Fields',
    source: 'Farmsteads of the Viking Age',
    res: 'food',
    perLevel: 2_400,
    perHour: 7_200,
  },
  wood: {
    name: 'Old Oak Wood',
    source: 'Oak for ships (Skuldelev wrecks)',
    res: 'timber',
    perLevel: 2_400,
    perHour: 7_200,
  },
  // Bog iron, dug from the marshes and smelted in pit furnaces.
  iron: {
    name: 'Bog-iron Marsh',
    source: 'Bog-iron working in Viking-Age Norway',
    res: 'iron',
    perLevel: 480,
    perHour: 1_400,
  },
  // Buried silver hoards like Spillings (Gotland) and Cuerdale (England).
  silver: {
    name: 'Buried Hoard',
    source: 'Spillings and Cuerdale hoards',
    res: 'silver',
    perLevel: 260,
    perHour: 700,
  },
};

export const MIDGARD = {
  jarlsPerAlliance: 5,
  /** Jarls who belong to no alliance, out on the rim. */
  freeJarls: 12,
  camps: 40,
  nodes: { farm: 12, wood: 12, iron: 9, silver: 6 } satisfies Record<NodeKind, number>,
  /** Strength of a level-1 camp and its growth per level. */
  campStrength: 110,
  campGrowth: 1.42,
  /** Strength of a level-1 jarl's hold and its growth per level (levels 1–20). */
  jarlStrength: 240,
  jarlGrowth: 1.3,
  /** What a jarl keeps in the open per level (winners take PVP.lootShare of it). */
  jarlStores: { food: 2_600, timber: 2_600, iron: 320, silver: 160 } satisfies Cost,
  /** Marching: time per tile from your hold, and never less than this. */
  travelMsPerTile: 8_000,
  minTravelMs: 20_000,
  /** What one warrior carries, by tier. */
  carryPerTier: [0, 15, 25, 40] as readonly number[],
  /** Marches out at once: 2, plus one per 8 Great Hall levels. */
  marchesBase: 2,
  marchesPerHall: 8,
  /** A beaten camp is gone for a while; a beaten jarl raises a peace shield; a gathered node regrows. */
  campRespawnMs: 20 * 60_000,
  jarlShieldMs: 30 * 60_000,
  nodeRegrowMs: 45 * 60_000,
} as const;
