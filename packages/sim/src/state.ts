import type { BuildingType } from './data/buildings';
import { ECONOMY } from './data/economy';
import { HALL_PLOT_ID, PLOTS } from './data/plots';
import { realmMap } from './systems/world';
import { freshHeroes } from './systems/heroes';
import type { Cost, Resources } from './data/resources';
import type { UnitType } from './data/troops';

/** One building, standing where the player put it (D-036). */
export interface Building {
  id: string;
  type: BuildingType;
  /** 0 while the first construction is still running. */
  level: number;
  /** Position measured from the centre of the Great Hall (world units), and facing (radians). */
  x: number;
  z: number;
  rot: number;
}

export interface ConstructionJob {
  buildingId: string;
  targetLevel: number;
  startedAt: number;
  endsAt: number;
}

export interface TrainingJob {
  buildingId: string;
  troopId: string;
  count: number;
  startedAt: number;
  endsAt: number;
}

export interface HealingJob {
  troops: Record<string, number>;
  startedAt: number;
  endsAt: number;
}

/** One line of a battle report: a stack of troops and what happened to it. */
export interface ReportLine {
  unit: string;
  name: string;
  type: UnitType;
  start: number;
  /** Fell for good. */
  dead: number;
  /** Carried home to heal (player side only). */
  wounded: number;
}

export interface BattleReport {
  id: number;
  at: number;
  kind: 'draugr' | 'raid' | 'conquest';
  /** Barrow level, or the raid number. */
  level: number;
  title: string;
  won: boolean;
  rounds: number;
  attacker: ReportLine[];
  defender: ReportLine[];
  /** The battle told as a short saga (generated, our own words). */
  saga: string[];
  reward: Cost;
  /** Resources the raiders carried off (raids you lost). */
  loot?: Cost;
  read: boolean;
}

/** A raiding fleet on its way (spotted by the beacon). */
export interface IncomingRaid {
  variant: string;
  /** Raid number (difficulty grows with it). */
  number: number;
  ships: Record<string, number>;
  crew: Record<string, number>;
  spottedAt: number;
  landsAt: number;
  /** Called by the player to practise: no salvage, and it does not raise the difficulty. */
  practice: boolean;
}

export interface RaidState {
  /** When the next fleet lands (null until raids begin). */
  nextAt: number | null;
  /** Raids fought so far (not counting practice). */
  count: number;
  incoming: IncomingRaid | null;
}

export interface DailyQuestState {
  /** UTC day number (days since 1970-01-01) these counters belong to. */
  day: number;
  progress: Record<string, number>;
  claimed: string[];
  /** Indexes of the daily activity chests already opened today. */
  chests: number[];
}

export interface PlayerProfile {
  name: string;
  avatar: number;
  owned: number[];
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
  army: {
    /** Healthy troops at home, by troop id (e.g. "shieldwall-1"). */
    troops: Record<string, number>;
    /** Wounded troops waiting for the healers. */
    wounded: Record<string, number>;
  };
  training: TrainingJob[];
  healing: HealingJob | null;
  /** Battle reports, newest first (the hold's mail). */
  reports: BattleReport[];
  nextReportId: number;
  pve: { draugrCleared: number };
  /** Seeded RNG state for battles, so the same game always plays out the same. */
  rngState: number;
  profile: PlayerProfile;
  /** Index of the current step in the main quest line. */
  mainQuest: number;
  /** Next id for a new building ("b1", "b2"...). */
  nextBuildingId: number;
  raid: RaidState;
  /** Your place in Midgard: realm (server), hold tile, conquered land and alliance. */
  world: {
    realm: number;
    home: { x: number; y: number };
    /** Conquered tiles as "x,y". */
    owned: string[];
    /** Index into ALLIANCES, or null. */
    alliance: number | null;
  };
  /** Heroes you have recruited, the squad of three that leads your warriors, and Saga Horns. */
  heroes: {
    owned: Record<string, { level: number; stars: number; dupes: number }>;
    squad: string[];
    horns: number;
    pity: { epic: number; legendary: number };
  };
}

export const STATE_VERSION = 6;

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
      [HALL_PLOT_ID]: { id: HALL_PLOT_ID, type: 'greatHall', level: 1, ...plotSpot(HALL_PLOT_ID) },
      a1: { id: 'a1', type: 'farmstead', level: 1, ...plotSpot('a1') },
      a2: { id: 'a2', type: 'woodcutter', level: 1, ...plotSpot('a2') },
    },
    queue: [],
    quests: { day: dayIndex(now), progress: {}, claimed: [], chests: [] },
    ...emptyMilitary(seed),
    ...freshProfile(),
    ...freshRaids(),
    ...freshWorld(),
    heroes: freshHeroes(),
  };
}

/** Fields added in save version 5: the world map. Realm 1 until accounts choose one. */
export function freshWorld(realm = 1): Pick<GameState, 'world'> {
  return { world: { realm, home: realmMap(realm).home, owned: [], alliance: null } };
}

/** Where the old fixed plots were: used for the starting buildings and to upgrade old saves. */
export function plotSpot(id: string): { x: number; z: number; rot: number } {
  if (id === HALL_PLOT_ID) return { x: 0, z: 0, rot: 0.12 };
  const p = PLOTS.find((q) => q.id === id);
  return p ? { x: p.dx, z: p.dz, rot: p.rotation } : { x: 0, z: 12, rot: 0 };
}

/** Fields added in save version 4: free placement and sea raids. */
export function freshRaids(): Pick<GameState, 'nextBuildingId' | 'raid'> {
  return { nextBuildingId: 1, raid: { nextAt: null, count: 0, incoming: null } };
}

/** Military fields added in save version 2 (M3). Also used to migrate version-1 saves. */
export function emptyMilitary(seed: number) {
  return {
    army: { troops: {}, wounded: {} },
    training: [],
    healing: null,
    reports: [],
    nextReportId: 1,
    pve: { draugrCleared: 0 },
    rngState: (seed ^ 0x9e3779b9) >>> 0,
  } satisfies Pick<
    GameState,
    'army' | 'training' | 'healing' | 'reports' | 'nextReportId' | 'pve' | 'rngState'
  >;
}

/** Fields added in save version 3: profile and main quest line. */
export function freshProfile(): Pick<GameState, 'profile' | 'mainQuest'> {
  return { profile: { name: 'Jarl', avatar: 0, owned: [0, 1, 2] }, mainQuest: 0 };
}
