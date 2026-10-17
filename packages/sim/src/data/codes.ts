import type { Cost } from './resources';

/**
 * Gift codes (owner request, for testing): typed in Settings, each works once per hold.
 * Only a hash of each code is kept here, so the code itself is not in the game files.
 * The test code gives a million of everything (decision D-057: a testing aid, to be
 * removed or replaced by real event codes before the stores).
 */
export interface GiftCode {
  hash: number;
  name: string;
  reward: Cost;
  items: Record<string, number>;
  wallet: { alliance: number; medals: number; stamina: number };
}

export const GIFT_CODES: readonly GiftCode[] = [
  {
    hash: 212_599_635,
    name: 'Test: a million of everything',
    reward: { food: 1_000_000, timber: 1_000_000, iron: 1_000_000, silver: 1_000_000, gold: 1_000_000 },
    items: {
      'speed-5m': 100,
      'speed-1h': 100,
      'speed-8h': 100,
      'chest-spoils': 100,
      'hero-scroll': 100,
      'star-shard': 100,
      'teleport-random': 100,
      'teleport-advanced': 100,
      'teleport-alliance': 100,
      'teleport-war': 100,
      'stamina-50': 100,
    },
    wallet: { alliance: 1_000_000, medals: 1_000_000, stamina: 1_000 },
  },
];
