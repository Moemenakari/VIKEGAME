/** Tuning values for the Hold terrain generator (worldgen/holdTerrain.ts). */
export const HOLD_TERRAIN = {
  /** Vertices per side. The map is (resolution - 1) cells wide. */
  resolution: 129,
  /** World units per cell. */
  cellSize: 1,
  /** Sea level. Everything below is water. */
  waterLevel: 0,
  seabedDepth: -5,
  /** Height of the flat farmland on the peninsula. */
  plateauHeight: 1.6,
  plateauVariation: 1.1,
  /** Peak height of the fjord walls. */
  mountainHeight: 26,
  /** Radius of the flat clearing around the Great Hall. */
  hallClearingRadius: 13,
  /** Trees and rocks. */
  treeAttempts: 5200,
  treeMinHeight: 1.0,
  treeMaxHeight: 14,
  treeMaxSlope: 0.9,
  rockAttempts: 380,
} as const;
