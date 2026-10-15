import type { TroopType } from './troops';

/**
 * Sea raids on your hold (D-037, owner request: "enemies attack the island by sea,
 * and get stronger over time"). The Anglo-Saxon Chronicle's raids came by ship
 * with little warning; Hákon the Good set beacon fires on the hills so that a fleet
 * was known in a day (Heimskringla). So: raiders are spotted a few minutes before
 * they land, you can meet them at sea with your own ships, and then they must break
 * your walls before they reach your warriors.
 */
export const RAIDS = {
  /** Raids begin once the Great Hall reaches this level (a newcomer is left alone). */
  startHall: 3,
  firstDelayMs: 20 * 60 * 1000,
  intervalMs: 4 * 60 * 60 * 1000,
  /** The beacon is lit this long before the fleet lands. */
  warningMs: 10 * 60 * 1000,
  /** A raid you call yourself (to practise) lands this soon. */
  practiceDelayMs: 60 * 1000,
  /** Raiders who win carry off this share of what is not hidden in the Jarl's House. */
  lootShare: 0.3,
  /** Smallest raiding force (strength points), and how strength grows with each raid. */
  minStrength: 160,
  baseDifficulty: 0.5,
  difficultyPerRaid: 0.07,
  maxDifficulty: 1.15,
  /** A rival's island fleet anchors close: a much bigger raid. */
  islandMultiplier: 1.4,
  /** Defenders who win salvage this share of the raiders' strength as Silver and Timber. */
  salvagePerStrength: { silver: 0.25, timber: 1.2 },
  /** Raiders get tougher troops as raids go on: tier = 1 + floor(raids / this). */
  raidsPerTier: 6,
} as const;

export interface RaidVariant {
  id: string;
  /** Shown in reports and on the warning banner. */
  name: string;
  /** First raid number (0-based) this variant can appear at. */
  fromRaid: number;
  /** Share of the force by troop type. */
  mix: Partial<Record<TroopType, number>>;
  island?: boolean;
}

/** Raiders change their ways as you grow: walls bring rams, open fields bring riders. */
export const RAID_VARIANTS: readonly RaidVariant[] = [
  { id: 'searovers', name: 'Sea-rovers', fromRaid: 0, mix: { berserker: 0.6, archer: 0.4 } },
  {
    id: 'shieldband',
    name: 'Shield-band from the skerries',
    fromRaid: 2,
    mix: { shieldwall: 0.4, berserker: 0.3, archer: 0.3 },
  },
  {
    id: 'rams',
    name: 'Wall-breakers with rams',
    fromRaid: 3,
    mix: { siege: 0.2, shieldwall: 0.3, berserker: 0.3, archer: 0.2 },
  },
  {
    id: 'riders',
    name: 'Horse-raiders',
    fromRaid: 4,
    mix: { cavalry: 0.4, berserker: 0.3, archer: 0.3 },
  },
  {
    id: 'island',
    name: "A rival jarl's island fleet",
    fromRaid: 5,
    mix: { shieldwall: 0.3, berserker: 0.25, archer: 0.2, siege: 0.1, cavalry: 0.15 },
    island: true,
  },
  {
    id: 'bears',
    name: 'Bear-warriors of the north',
    fromRaid: 6,
    mix: { bear: 0.25, berserker: 0.35, archer: 0.2, siege: 0.2 },
  },
];
