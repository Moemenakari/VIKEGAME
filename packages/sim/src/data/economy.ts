import type { ProducedResourceId, Resources } from './resources';

/** Global economy tuning (GDD §3–4). First-pass numbers, tuned with playtests. */
export const ECONOMY = {
  maxBuildingLevel: 30,
  /** Production while away is capped (GDD §3: 8 h, raised by research later). */
  offlineCapMs: 8 * 60 * 60 * 1000,
  /** Timers with this much time left can be finished for free (GDD §4). */
  freeFinishMs: 5 * 60 * 1000,
  /** Gold to finish a timer instantly: per started minute left. */
  goldPerMinute: 0.5,
  /** Storage before any Storehouse levels. */
  baseStorage: { food: 12_000, timber: 12_000, iron: 6_000, silver: 6_000 } satisfies Record<
    ProducedResourceId,
    number
  >,
  /** Builder slots: 2 at start, +1 at Great Hall 5 and +1 at Great Hall 12 (GDD §4). */
  baseBuilders: 2,
  extraBuilderAtHall: [5, 12],
  /** A new hold starts with these. */
  startingResources: { food: 1_500, timber: 1_500, iron: 0, silver: 150, gold: 100 } satisfies Resources,
} as const;
