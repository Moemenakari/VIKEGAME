import { BUILDINGS, type BuildingType } from '../data/buildings';
import { PLACEMENT } from '../data/placement';
import type { GameState } from '../state';
import { generateHoldTerrain, sampleHeight, slopeAt, type HoldTerrain } from '../worldgen/holdTerrain';
import { hallLevel } from './economy';

// Terrain is a pure function of the seed; keep the last one instead of regenerating it per check.
let cached: { seed: number; terrain: HoldTerrain } | null = null;
export function holdTerrainFor(seed: number): HoldTerrain {
  if (!cached || cached.seed !== seed) cached = { seed, terrain: generateHoldTerrain(seed) };
  return cached.terrain;
}

/** Radius around the Great Hall (world units) where buildings may stand at this hall level. */
export function buildRadius(state: GameState): number {
  return Math.min(
    PLACEMENT.maxRadius,
    PLACEMENT.baseRadius + PLACEMENT.radiusPerHall * (hallLevel(state) - 1),
  );
}

/**
 * Can a building of `type` stand at (x, z), measured from the centre of the Great Hall?
 * Returns null if it can, or the reason it cannot. `ignoreId` skips the building being moved.
 */
export function placementError(
  state: GameState,
  type: BuildingType,
  x: number,
  z: number,
  ignoreId?: string,
): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'You cannot build that here';
  const r = BUILDINGS[type].footprint;
  if (Math.hypot(x, z) + r > buildRadius(state)) return 'Too far out: upgrade the Great Hall for more land';
  for (const b of Object.values(state.buildings)) {
    if (b.id === ignoreId) continue;
    const min = r + BUILDINGS[b.type].footprint + PLACEMENT.gap;
    if (Math.hypot(b.x - x, b.z - z) < min) return 'Too close to another building';
  }
  const t = holdTerrainFor(state.seed);
  const wx = t.hall.x + x;
  const wz = t.hall.z + z;
  if (Math.hypot(t.barrow.x - wx, t.barrow.z - wz) < r + PLACEMENT.barrowClearance)
    return 'Too close to the barrow';
  // Test the centre and four points on the edge: all dry and flat enough.
  for (const [dx, dz] of [
    [0, 0],
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
  ] as const) {
    if (sampleHeight(t, wx + dx, wz + dz) < t.waterLevel + PLACEMENT.minHeightAboveWater)
      return 'The ground is too wet here';
    if (slopeAt(t, wx + dx, wz + dz) > PLACEMENT.maxSlope) return 'The ground is too steep here';
  }
  return null;
}

/** A free spot for a new building: scans outward from the hall in rings. */
export function suggestSpot(state: GameState, type: BuildingType): { x: number; z: number } | null {
  const max = buildRadius(state);
  // Ring by ring outwards from the hall, fine enough to find every free gap.
  for (let radius = 7; radius <= max; radius += 0.75) {
    const steps = Math.max(12, Math.round(radius * 4));
    for (let i = 0; i < steps; i++) {
      // Start in front of the hall (towards the camera), then go round.
      const a = Math.PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * ((Math.PI * 2) / steps);
      const x = Math.round(Math.cos(a) * radius * 10) / 10;
      const z = Math.round(Math.sin(a) * radius * 10) / 10;
      if (!placementError(state, type, x, z)) return { x, z };
    }
  }
  return null;
}
