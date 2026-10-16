import { freshHeroes } from './systems/heroes';
import { BUILDING_TYPES } from './data/buildings';
import { RESOURCES } from './data/resources';
import {
  STATE_VERSION,
  emptyMilitary,
  freshProfile,
  freshBag,
  freshRaids,
  freshWorld,
  plotSpot,
  type GameState,
} from './state';

/**
 * Save format: the WHOLE game in one JSON document, written and read in one trip
 * (never one record per building). Old saves are upgraded by the migration chain.
 */
interface SaveFile {
  format: 'jarlheim-save';
  version: number;
  state: unknown;
}

/** migrations[n] upgrades a version-n state to version n+1. */
const migrations: Record<number, (state: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 → v2 (M3): the hold gains an army, training and healing queues, reports and PvE progress.
  1: (state) => ({ ...emptyMilitary(typeof state.seed === 'number' ? state.seed : 1), ...state }),
  // v2 → v3: player profile, main quest line and daily chests.
  2: (state) => {
    const quests = (state.quests ?? {}) as Record<string, unknown>;
    return { ...freshProfile(), ...state, quests: { chests: [], ...quests } };
  },
  // v3 → v4: buildings get a free position (where their old plot was), and sea raids begin.
  3: (state) => {
    const buildings: Record<string, unknown> = {};
    for (const [id, b] of Object.entries((state.buildings ?? {}) as Record<string, Record<string, unknown>>))
      buildings[id] = { ...plotSpot(id), ...b };
    return { ...freshRaids(), ...state, buildings };
  },
  // v4 → v5: a place on the world map.
  4: (state) => ({ ...freshWorld(), ...state }),
  // v5 → v6: heroes (Bóndi Ketil leads from the start, plus a few Saga Horns).
  5: (state) => ({ heroes: freshHeroes(), ...state }),
  // v6 → v7: the Bag and the profile's deeds.
  6: (state) => ({ ...freshBag(), ...state }),
};

export function serialize(state: GameState): string {
  const file: SaveFile = { format: 'jarlheim-save', version: state.version, state };
  return JSON.stringify(file);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isCounts = (v: unknown): v is Record<string, number> =>
  isObj(v) && Object.values(v).every((n) => isNum(n) && n >= 0);

function isGameState(s: unknown): s is GameState {
  if (!isObj(s)) return false;
  if (!isNum(s.version) || !isNum(s.seed) || !isNum(s.createdAt) || !isNum(s.lastTick)) return false;
  if (!isObj(s.resources) || !RESOURCES.every((r) => isNum((s.resources as Record<string, unknown>)[r])))
    return false;
  if (!isObj(s.buildings)) return false;
  for (const [id, b] of Object.entries(s.buildings)) {
    if (
      !isObj(b) ||
      b.id !== id ||
      !isNum(b.level) ||
      !isNum(b.x) ||
      !isNum(b.z) ||
      !isNum(b.rot) ||
      !(BUILDING_TYPES as readonly unknown[]).includes(b.type)
    ) {
      return false;
    }
  }
  if (!Array.isArray(s.queue)) return false;
  for (const j of s.queue) {
    if (
      !isObj(j) ||
      typeof j.buildingId !== 'string' ||
      !isNum(j.targetLevel) ||
      !isNum(j.startedAt) ||
      !isNum(j.endsAt)
    ) {
      return false;
    }
  }
  const q = s.quests;
  if (!isObj(q) || !isNum(q.day) || !isObj(q.progress) || !Array.isArray(q.claimed)) return false;
  const army = s.army;
  if (!isObj(army) || !isCounts(army.troops) || !isCounts(army.wounded)) return false;
  if (!Array.isArray(s.training) || !Array.isArray(s.reports)) return false;
  if (s.healing !== null && !(isObj(s.healing) && isCounts(s.healing.troops) && isNum(s.healing.endsAt))) {
    return false;
  }
  if (!Array.isArray(q.chests)) return false;
  const p = s.profile;
  if (!isObj(p) || typeof p.name !== 'string' || !isNum(p.avatar) || !Array.isArray(p.owned)) return false;
  if (!isCounts(s.items) || !isObj(s.stats) || !isNum(s.stats.kills)) return false;
  const hz = s.heroes;
  if (!isObj(hz) || !isObj(hz.owned) || !Array.isArray(hz.squad) || !isNum(hz.horns) || !isObj(hz.pity))
    return false;
  const w = s.world;
  if (!isObj(w) || !isNum(w.realm) || !isObj(w.home) || !Array.isArray(w.owned)) return false;
  const raid = s.raid;
  if (!isObj(raid) || !isNum(raid.count) || !(raid.nextAt === null || isNum(raid.nextAt))) return false;
  return (
    isNum(s.nextBuildingId) &&
    isNum(s.mainQuest) &&
    isNum(s.nextReportId) &&
    isObj(s.pve) &&
    isNum(s.pve.draugrCleared) &&
    isNum(s.rngState)
  );
}

/** Returns the saved game, upgraded to the current version, or null if the save is unusable. */
export function deserialize(text: string): GameState | null {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(file) || file.format !== 'jarlheim-save' || !isNum(file.version) || !isObj(file.state))
    return null;
  let version = file.version;
  let state = file.state;
  while (version < STATE_VERSION) {
    const migrate = migrations[version];
    if (!migrate) return null;
    state = migrate(state);
    version++;
    state.version = version;
  }
  if (version > STATE_VERSION) return null; // saved by a newer game
  return isGameState(state) ? state : null;
}
