/**
 * Free building placement (D-036, owner request): any building can stand anywhere
 * on the flat settlement ground around the Great Hall, and can be moved later.
 * The ground you may use grows with the Great Hall, like the land a settler could
 * claim in Landnámabók grew with what they could hold.
 */
export const PLACEMENT = {
  /** Usable radius around the hall centre at Great Hall 1, growing per level up to the max. */
  baseRadius: 16,
  radiusPerHall: 1.5,
  maxRadius: 23,
  /** Free space kept between two buildings (world units). */
  gap: 0.6,
  /** Ground must be at least this far above the sea, and this flat. */
  minHeightAboveWater: 0.6,
  maxSlope: 0.55,
  /** Keep clear of the draugr barrow. */
  barrowClearance: 8,
} as const;
