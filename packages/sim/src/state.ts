import type { BuildingType } from './data/buildings';
import { ECONOMY } from './data/economy';
import { HALL_PLOT_ID } from './data/plots';
import type { Cost, Resources } from './data/resources';
import type { TroopType } from './data/troops';

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
  type: TroopType;
  start: number;
  /** Fell for good. */
  dead: number;
  /** Carried home to heal (player side only). */
  wounded: number;
}

export interface BattleReport {
  id: number;
  at: number;
  kind: 'draugr';
  level: number;
  title: string;
  won: boolean;
  rounds: number;
  attacker: ReportLine[];
  defender: ReportLine[];
  /** The battle told as a short saga (generated, our own words). */
  saga: string[];
  reward: Cost;
  read: boolean;
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
}

export const STATE_VERSION = 3;

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
    quests: { day: dayIndex(now), progress: {}, claimed: [], chests: [] },
    ...emptyMilitary(seed),
    ...freshProfile(),
  };
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
