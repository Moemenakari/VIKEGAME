import type { Cost } from './resources';

/**
 * Midgard, the world map (GDD §8), and the realms (servers) that each hold a copy of it.
 * Every realm has a King, chosen at the Midsummer Thing (GDD §10). Until players take
 * the throne, each realm is held by a king from the chronicles (HISTORY_BIBLE.md).
 */
export interface RealmDef {
  id: number;
  name: string;
  /** The reigning king of the realm (an AI king until a player wins the Thing). */
  king: string;
  kingSource: string;
  /** Index into ALLIANCES of the king's own alliance, which holds the Law Rock. */
  kingAlliance: number;
}

export const REALMS: readonly RealmDef[] = [
  {
    id: 1,
    name: 'Uppsala',
    king: 'Eiríkr the Victorious',
    kingSource: 'Adam of Bremen; Heimskringla',
    kingAlliance: 0,
  },
  {
    id: 2,
    name: 'Jelling',
    king: 'Haraldr Bluetooth',
    kingSource: 'Jelling stones; Heimskringla',
    kingAlliance: 1,
  },
  {
    id: 3,
    name: 'Hlaðir',
    king: 'Hákon Jarl',
    kingSource: 'Heimskringla; Jómsvíkinga saga',
    kingAlliance: 5,
  },
  {
    id: 4,
    name: 'Dyflin',
    king: 'Óláfr Cuarán',
    kingSource: 'Annals of Ulster; Irish annals',
    kingAlliance: 4,
  },
];

/** AI alliances on every realm, named after real Norse brotherhoods and war-bands. */
export interface AllianceDef {
  tag: string;
  name: string;
  color: string;
  source: string;
}

export const ALLIANCES: readonly AllianceDef[] = [
  { tag: 'SVE', name: 'Svear of Uppsala', color: '#c9a24a', source: 'Adam of Bremen' },
  { tag: 'JOM', name: 'Jómsvíkingar', color: '#a8402f', source: 'Jómsvíkinga saga' },
  { tag: 'VAR', name: 'Væringjar', color: '#3f7fa8', source: 'Russian Primary Chronicle' },
  { tag: 'MIK', name: 'The Great Army', color: '#6f8f3a', source: 'Anglo-Saxon Chronicle, 865' },
  { tag: 'DYF', name: 'Norse of Dyflin', color: '#7a5aa8', source: 'Irish annals' },
  { tag: 'HLA', name: 'Jarls of Hlaðir', color: '#c06a2a', source: 'Heimskringla' },
];

/** Regions of Midgard by compass direction from the Law Rock (GDD §8). */
export const REGIONS = [
  'Norðrvegr',
  'Garðaríki',
  'Miklagarðr',
  'Serkland',
  'Frankland',
  'Írland',
  'Vínland',
  'Ísland',
] as const;

export const WORLD = {
  /** Tiles per side (odd, so the Law Rock sits on the centre tile). */
  size: 41,
  /** The capital: tiles within this distance of the centre. */
  capitalRadius: 1.5,
  /** Ring forts that the alliances hold, and how far from the centre they stand. */
  fortRadius: 11,
  /** Land you can hold: 3 tiles plus one per Great Hall level. */
  baseTiles: 3,
  /** What one held tile yields per hour, by kind, times the tile's level. */
  tileYield: {
    field: { food: 60 },
    forest: { timber: 60 },
    hills: { iron: 15 },
    town: { silver: 30 },
    fort: { food: 40, timber: 40 },
  } as Record<string, Partial<Record<'food' | 'timber' | 'iron' | 'silver', number>>>,
  /** Garrison strength of a tile of level 1, growing per level; alliance land is better held. */
  garrisonBase: 140,
  garrisonGrowth: 1.42,
  allianceGarrison: 1.3,
  /** First conquest of a tile: a one-off reward per level. */
  conquestReward: { silver: 20, timber: 80 } satisfies Cost,
  /** The King's War: every Saturday from 12:00 to 14:00 UTC, realm against realm. */
  kingsWarDay: 6,
  kingsWarHourUtc: 12,
  kingsWarHours: 2,
} as const;

/** The Alliance Duel (alliance against alliance inside a realm): one theme per weekday. */
export const DUEL_THEMES = [
  { day: 1, theme: 'build', metric: 'construction.started', points: 300 },
  { day: 2, theme: 'train', metric: 'troops.trained', points: 15 },
  { day: 3, theme: 'gather', metric: 'produced.food', points: 1 },
  { day: 4, theme: 'battle', metric: 'battle.won', points: 2_000 },
  { day: 5, theme: 'build', metric: 'building.completed', points: 400 },
  { day: 6, theme: 'war', metric: 'battle.won', points: 3_000 },
  { day: 0, theme: 'gather', metric: 'produced.timber', points: 1 },
] as const;
