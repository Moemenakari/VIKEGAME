import type { BuildingType } from './buildings';
import type { Cost } from './resources';

/**
 * The historical triangle (GDD §5.1, DECISIONS D-016). Vikings fought on foot:
 *   Shieldwall breaks Berserkers · Berserkers break Archers · Archers break Shieldwall.
 */
export const TROOP_TYPES = ['shieldwall', 'berserker', 'archer'] as const;
export type TroopType = (typeof TROOP_TYPES)[number];

export const COUNTERS: Record<TroopType, TroopType> = {
  shieldwall: 'berserker',
  berserker: 'archer',
  archer: 'shieldwall',
};

export interface CombatStats {
  atk: number;
  def: number;
  hp: number;
}

export interface TroopDef extends CombatStats {
  id: string;
  type: TroopType;
  tier: number;
  name: string;
  /** Cost of ONE unit. */
  cost: Cost;
  /** Seconds to train ONE unit. */
  trainSeconds: number;
  power: number;
  /** Level of the training building needed for this tier. */
  unlockLevel: number;
}

const TIER_NAMES: Record<TroopType, [string, string, string]> = {
  // The bóndi (free farmer) levy, then sworn karls, then a lord's húskarls.
  shieldwall: ['Bóndi Levy', 'Karl Shieldman', 'Húskarl'],
  // Raiders, then the berserkir and úlfheðnar of the sagas.
  berserker: ['Raider', 'Berserker', 'Úlfheðinn'],
  // Hunters with yew bows, then bowmen like those at Svolder.
  archer: ['Hunter', 'Bowman', 'Yew Archer'],
};

const BASE: Record<TroopType, CombatStats & { cost: Cost }> = {
  shieldwall: { atk: 8, def: 12, hp: 32, cost: { food: 30, timber: 12 } },
  berserker: { atk: 14, def: 5, hp: 28, cost: { food: 42 } },
  archer: { atk: 11, def: 6, hp: 22, cost: { food: 22, timber: 26 } },
};

export const TROOP_TIERS = 3;
const STAT_GROWTH = 1.45;
const COST_GROWTH = 1.6;
const TIER_UNLOCK_LEVEL = [1, 5, 10];
const TIER_SECONDS = [2, 4, 8];

function makeTroops(): Record<string, TroopDef> {
  const all: Record<string, TroopDef> = {};
  for (const type of TROOP_TYPES) {
    for (let tier = 1; tier <= TROOP_TIERS; tier++) {
      const g = STAT_GROWTH ** (tier - 1);
      const base = BASE[type];
      const cost: Cost = {};
      for (const [res, n] of Object.entries(base.cost))
        cost[res as keyof Cost] = Math.round(n * COST_GROWTH ** (tier - 1));
      if (tier === 3) cost.silver = 4;
      const id = `${type}-${tier}`;
      all[id] = {
        id,
        type,
        tier,
        name: TIER_NAMES[type][tier - 1]!,
        atk: Math.round(base.atk * g),
        def: Math.round(base.def * g),
        hp: Math.round(base.hp * g),
        cost,
        trainSeconds: TIER_SECONDS[tier - 1]!,
        power: Math.round(3 * g),
        unlockLevel: TIER_UNLOCK_LEVEL[tier - 1]!,
      };
    }
  }
  return all;
}

export const TROOPS: Record<string, TroopDef> = makeTroops();
export const TROOP_IDS = Object.keys(TROOPS);

/** Which building trains which troop type. */
export const TRAINED_AT: Record<TroopType, BuildingType> = {
  shieldwall: 'shieldYard',
  berserker: 'wolfLodge',
  archer: 'bowyerRange',
};

export const MILITARY = {
  /** Most units one training building can train in one batch: base + perLevel × level. */
  batchBase: 20,
  batchPerLevel: 15,
  /** Wounded the hold can care for without a Healer's House. */
  baseWoundedCapacity: 60,
  /** Healing costs this share of a unit's training cost, and takes this share of its time. */
  healCostFactor: 0.35,
  healTimeFactor: 0.5,
  /** Of the troops that fall in battle, this share is wounded (if there is room), the rest die. */
  woundedShare: 0.65,
  /** Counter bonus: +20 % damage against the type you break (GDD §5.1). */
  counterBonus: 1.2,
  /** Defence softening: damage × K / (K + def). */
  defenceK: 20,
  maxRounds: 10,
  /** Random spread of each strike, ± this share (seeded, so replays match). */
  variance: 0.05,
  /** Battle reports kept in the hold's mail. */
  maxReports: 20,
} as const;
