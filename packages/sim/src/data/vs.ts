/**
 * The Alliance VS (owner request): every 3 days the alliances of a realm are ranked by
 * strength and paired 1 v 2, 3 v 4, 5 v 6… Each day of the season has a theme, drawn at
 * random for the season, and every deed of that theme earns VS points for you and your
 * alliance. The higher score when the season ends wins.
 */
export const VS_THEMES = ['build', 'train', 'gather', 'hunt', 'war', 'heroes'] as const;
export type VsTheme = (typeof VS_THEMES)[number];

export const VS = {
  seasonDays: 3,
  /** Seasons are counted from this moment (a Monday, 00:00 UTC). */
  epoch: Date.UTC(2026, 0, 5),
  /** Points per deed, by theme. */
  points: {
    build: { started: 300, completedPerLevel: 150 },
    train: { perTier: 12 },
    /** Speed-ups saved for the right day (build or train) score per minute. */
    speedupPerMinute: 20,
    gather: { food: 1, timber: 1, iron: 5, silver: 10 },
    hunt: { perLevel: 600 },
    /** Wins against jarls in the war zone (the enemy realm) score double. */
    war: { win: 2_500, perLevel: 250, warZone: 2 },
    heroes: { recruit: 700, scroll: 400, shard: 1_200 },
  },
  /** AI alliances: season total at full strength, and how much it varies. */
  allianceBase: 110_000,
  allianceSpread: 0.3,
  /** AI jarls: season total per Great Hall level. */
  jarlPerLevel: 2_600,
  rewards: {
    win: { items: { 'chest-spoils': 3, 'speed-1h': 2, 'hero-scroll': 2, 'star-shard': 1 }, gold: 60 },
    lose: { items: { 'chest-spoils': 1, 'speed-5m': 3 }, gold: 15 },
    /** Extra for your own points, whatever the result. */
    tiers: [
      { points: 5_000, items: { 'speed-5m': 2 } },
      { points: 20_000, items: { 'speed-1h': 1, 'chest-food': 1, 'chest-timber': 1 } },
      { points: 60_000, items: { 'speed-8h': 1, 'hero-scroll': 1 } },
    ],
  },
} as const;
