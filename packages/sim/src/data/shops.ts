/**
 * Shops (owner request, as in the genre). Every currency is earned by playing (no payments
 * before M11, see docs/MONETIZATION.md):
 *  - Gold: barrow first clears, main quests, daily chests, camps (draugr and outlaws most),
 *    VS season rewards.
 *  - Alliance points: hunting and gathering while in an alliance, rallies, the VS.
 *  - VS medals: one for every 100 VS points you earn, plus the season reward.
 *  - Silver: your Market, trading towns and plunder.
 * Each offer has a daily limit, so no one can empty a shop in one day.
 */
export type ShopId = 'gold' | 'alliance' | 'vs' | 'energy';
export type ShopCurrency = 'gold' | 'alliance' | 'medals' | 'silver';

export interface ShopOffer {
  id: string;
  item: string;
  count: number;
  price: number;
  /** How many times a day it can be bought. */
  limit: number;
}

export const SHOPS: Record<ShopId, { currency: ShopCurrency; offers: ShopOffer[] }> = {
  gold: {
    currency: 'gold',
    offers: [
      { id: 'g-tp-random', item: 'teleport-random', count: 1, price: 60, limit: 5 },
      { id: 'g-tp-advanced', item: 'teleport-advanced', count: 1, price: 250, limit: 3 },
      { id: 'g-tp-war', item: 'teleport-war', count: 1, price: 400, limit: 1 },
      { id: 'g-speed-1h', item: 'speed-1h', count: 1, price: 90, limit: 10 },
      { id: 'g-stamina-50', item: 'stamina-50', count: 1, price: 120, limit: 3 },
      { id: 'g-scroll', item: 'hero-scroll', count: 1, price: 150, limit: 5 },
      { id: 'g-shard', item: 'star-shard', count: 1, price: 400, limit: 1 },
      { id: 'g-spoils', item: 'chest-spoils', count: 1, price: 80, limit: 5 },
    ],
  },
  alliance: {
    currency: 'alliance',
    offers: [
      { id: 'a-tp-alliance', item: 'teleport-alliance', count: 1, price: 400, limit: 2 },
      { id: 'a-speed-5m', item: 'speed-5m', count: 1, price: 40, limit: 20 },
      { id: 'a-stamina-10', item: 'stamina-10', count: 1, price: 60, limit: 5 },
      { id: 'a-food', item: 'chest-food', count: 1, price: 120, limit: 5 },
      { id: 'a-scroll', item: 'hero-scroll', count: 1, price: 300, limit: 2 },
    ],
  },
  vs: {
    currency: 'medals',
    offers: [
      { id: 'v-tp-war', item: 'teleport-war', count: 1, price: 150, limit: 1 },
      { id: 'v-scroll', item: 'hero-scroll', count: 1, price: 120, limit: 5 },
      { id: 'v-shard', item: 'star-shard', count: 1, price: 300, limit: 2 },
      { id: 'v-speed-8h', item: 'speed-8h', count: 1, price: 400, limit: 1 },
      { id: 'v-silver', item: 'chest-silver', count: 1, price: 80, limit: 5 },
    ],
  },
  energy: {
    currency: 'silver',
    offers: [
      { id: 'e-stamina-10', item: 'stamina-10', count: 1, price: 200, limit: 5 },
      { id: 'e-stamina-50', item: 'stamina-50', count: 1, price: 900, limit: 2 },
    ],
  },
};

/** Stamina: hunting a camp costs it, and it comes back by itself. */
export const STAMINA = {
  max: 100,
  /** One point back every 6 minutes. */
  regenMs: 6 * 60_000,
  cost: { wolves: 8, bear: 10, outlaws: 10, draugr: 14, treasure: 0 } as Record<string, number>,
} as const;

/** Alliance points and medals for deeds (balance lives here, not in the systems). */
export const EARN = {
  alliancePerHuntLevel: 10,
  alliancePerGathered: 1 / 200,
  alliancePerRallyLevel: 50,
  vsPointsPerMedal: 100,
  medalsWin: 300,
  medalsLose: 100,
  /** Gold found in camps: base + one per 3 levels. */
  campGold: { wolves: 0, bear: 1, outlaws: 2, draugr: 4, treasure: 3 } as Record<string, number>,
} as const;

/** Rallies and scouting. */
export const WARFARE = {
  /** A rally waits this long for the alliance to gather before it marches. */
  rallyWaitMs: 60_000,
  /** Alliance-mates who join a rally, and the share of their strength each sends. */
  rallySlots: 4,
  rallyShare: 0.3,
  /** Silver to scout a hold, per Great Hall level. */
  scoutSilverPerLevel: 15,
} as const;
