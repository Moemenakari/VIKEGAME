import type { Cost } from './resources';

/**
 * What the Thing Mound does (owner request: every building must do something real). The
 * Thing (þing) was where free men met, settled matters and stood together; here it is
 * where your alliance helps you build and sends a daily gift. Both grow with its level.
 */
export const THING = {
  /** Alliance-mates who answer a call for help: this many, plus one per Thing Mound level. */
  baseHelpers: 3,
  /** Each helper cuts this much off the build… */
  helpMs: 60_000,
  /** …but all of them together never more than this share of what is left. */
  maxHelpShare: 0.3,
  /** The daily alliance gift, per Thing Mound level. */
  giftPerLevel: { food: 600, timber: 600, silver: 40 } satisfies Cost,
  giftItems: { 'speed-5m': 1 } as Record<string, number>,
};
