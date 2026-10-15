import type { BuildingType } from './buildings';
import type { Cost } from './resources';

/**
 * Troop types (GDD §5.1, DECISIONS D-016, D-035).
 * The core triangle: Shieldwall breaks Berserkers · Berserkers break Archers · Archers break Shieldwall.
 * Added on the owner's request, each with a source:
 *  - Riders: the Great Heathen Army took horses in East Anglia (Anglo-Saxon Chronicle, 866)
 *    and raided on horseback. Fast, they run down archers and siege crews, but spears stop them.
 *  - War bears (legend): Bǫðvarr Bjarki fought as a great bear (Hrólfs saga kraka).
 *    Horses panic at bears, and a bear can break a shield line; arrows bring it down.
 *  - Siege engines: rams and engines at the Siege of Paris, 885–886 (Abbo of Saint-Germain).
 *    Weak in open battle, but they smash walls.
 *  - Ships: snekkja, skeið and the dragon-ship (Skuldelev wrecks, sagas). They only fight at sea.
 */
export const TROOP_TYPES = ['shieldwall', 'berserker', 'archer', 'cavalry', 'bear', 'siege', 'ship'] as const;
export type TroopType = (typeof TROOP_TYPES)[number];
/** Everything that can stand in a battle: troops, and the wall of a hold. */
export type UnitType = TroopType | 'wall';

/** Who each type breaks (+counterBonus damage). Siege breaks walls (+siegeWallBonus). */
export const COUNTERS: Record<UnitType, readonly UnitType[]> = {
  shieldwall: ['berserker', 'cavalry'],
  berserker: ['archer', 'siege'],
  archer: ['shieldwall', 'bear'],
  cavalry: ['archer', 'siege'],
  bear: ['cavalry', 'shieldwall'],
  siege: ['wall'],
  ship: ['ship'],
  wall: [],
};

/** Ships fight only ships, and land troops never board them (GDD §5.2). */
export const isNaval = (type: UnitType): boolean => type === 'ship';

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
  cavalry: ['Mounted Raider', 'Horse Warrior', 'Hirð Rider'],
  bear: ['Bear Handler', 'War Bear', 'Bjarki Bear'],
  siege: ['Battering Ram', 'Stone Thrower', 'Siege Tower'],
  ship: ['Snekkja', 'Skeið', 'Drakkar'],
};

const BASE: Record<TroopType, CombatStats & { cost: Cost }> = {
  shieldwall: { atk: 8, def: 12, hp: 32, cost: { food: 30, timber: 12 } },
  berserker: { atk: 14, def: 5, hp: 28, cost: { food: 42 } },
  archer: { atk: 11, def: 6, hp: 22, cost: { food: 22, timber: 26 } },
  cavalry: { atk: 13, def: 8, hp: 34, cost: { food: 48, timber: 10, silver: 1 } },
  bear: { atk: 20, def: 9, hp: 70, cost: { food: 90, silver: 2 } },
  siege: { atk: 6, def: 10, hp: 60, cost: { timber: 90, food: 20 } },
  ship: { atk: 30, def: 14, hp: 160, cost: { timber: 220, food: 40, silver: 3 } },
};

/** Seconds to train one unit, by tier; slow, heavy units take longer. */
const TYPE_TIME_FACTOR: Record<TroopType, number> = {
  shieldwall: 1,
  berserker: 1,
  archer: 1,
  cavalry: 1.5,
  bear: 3,
  siege: 4,
  ship: 10,
};

/** How much power one unit adds, relative to a footman of the same tier. */
const TYPE_POWER: Record<TroopType, number> = {
  shieldwall: 1,
  berserker: 1,
  archer: 1,
  cavalry: 1.4,
  bear: 2.5,
  siege: 2,
  ship: 6,
};

/** How many fighters a ship carries into a raid (used by sea raids). */
export const SHIP_CREW = [20, 40, 70] as const;

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
        trainSeconds: Math.round(TIER_SECONDS[tier - 1]! * TYPE_TIME_FACTOR[type]),
        power: Math.round(3 * g * TYPE_POWER[type]),
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
  cavalry: 'stable',
  bear: 'bearDen',
  siege: 'siegeWorkshop',
  ship: 'shipyard',
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
  /** Siege engines do this many times their damage to walls. */
  siegeWallBonus: 4,
  /** Battle reports kept in the hold's mail. */
  maxReports: 20,
} as const;
