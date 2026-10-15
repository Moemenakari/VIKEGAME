import { HOLD_TERRAIN } from '../data/terrain';
import { createNoise2D, fbm, ridged } from '../noise';
import { createRng, hashString, nextFloat, nextRange } from '../rng';

/**
 * Generates the player's Hold: a snowy peninsula reaching into a fjord, walled
 * by mountains at the back and on both sides. Pure and deterministic: the same
 * seed always gives the same land, trees and rocks.
 *
 * Coordinates: x to the right, z towards the open sea (the camera looks from +z).
 */

export interface Prop {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
}

export interface HoldTerrain {
  seed: number;
  resolution: number;
  cellSize: number;
  /** Total width/depth in world units. */
  size: number;
  waterLevel: number;
  /** Row-major heights, index = row * resolution + col (row along z, col along x). */
  heights: Float32Array;
  hall: { x: number; y: number; z: number };
  /** Where the longship rests in the fjord, and the direction it faces (radians). */
  harbor: { x: number; z: number; heading: number };
  trees: Prop[];
  rocks: Prop[];
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function generateHoldTerrain(seed: number): HoldTerrain {
  const cfg = HOLD_TERRAIN;
  const res = cfg.resolution;
  const size = (res - 1) * cfg.cellSize;
  const half = size / 2;

  const coast = createNoise2D(hashString(`coast:${seed}`));
  const hills = createNoise2D(hashString(`hills:${seed}`));
  const peaks = createNoise2D(hashString(`peaks:${seed}`));

  const hallX = 0;
  const hallZ = -0.06 * half;

  /** 0 = deep water, 1 = solid land; and how "mountainous" a spot is. */
  const landAt = (u: number, v: number): { land: number; mountain: number } => {
    const wobble = fbm(coast, u * 2.2, v * 2.2, 4) * 0.13;
    // The peninsula: an oval blob in the middle, joined to the back wall by a neck.
    const pdx = u / 0.5;
    const pdz = (v + 0.08) / 0.46;
    const peninsula = 1 - Math.sqrt(pdx * pdx + pdz * pdz) + wobble;
    const neck = 0.22 - Math.abs(u) + wobble * 0.6 - smoothstep(-0.2, 0.25, v) * 0.5;
    // Fjord walls: the back edge and the two sides.
    const back = (-v - 0.62) / 0.3 + wobble;
    const sides = (Math.abs(u) - 0.74) / 0.22 + wobble - smoothstep(0.35, 1, v) * 0.6;
    const wall = Math.max(back, sides);
    const land = Math.max(peninsula, neck, wall);
    return { land, mountain: smoothstep(0, 0.9, wall) };
  };

  const heights = new Float32Array(res * res);
  for (let row = 0; row < res; row++) {
    for (let col = 0; col < res; col++) {
      const x = col * cfg.cellSize - half;
      const z = row * cfg.cellSize - half;
      const u = x / half;
      const v = z / half;
      const { land, mountain } = landAt(u, v);

      const shore = smoothstep(-0.04, 0.12, land);
      const plateau = cfg.plateauHeight + fbm(hills, u * 3, v * 3, 3) * cfg.plateauVariation;
      let h = cfg.seabedDepth + (plateau - cfg.seabedDepth) * shore;
      h += mountain * ridged(peaks, u * 2.6, v * 2.6, 5) * cfg.mountainHeight;

      // Level a clearing for the Great Hall.
      const dh = Math.hypot(x - hallX, z - hallZ);
      const clear = 1 - smoothstep(cfg.hallClearingRadius * 0.6, cfg.hallClearingRadius, dh);
      h = h * (1 - clear) + cfg.plateauHeight * clear;

      heights[row * res + col] = h;
    }
  }

  const terrain: HoldTerrain = {
    seed,
    resolution: res,
    cellSize: cfg.cellSize,
    size,
    waterLevel: cfg.waterLevel,
    heights,
    hall: { x: hallX, y: cfg.plateauHeight, z: hallZ },
    harbor: { x: 0.34 * half, z: 0.5 * half, heading: -0.5 },
    trees: [],
    rocks: [],
  };

  const rng = createRng(hashString(`props:${seed}`));
  const forest = createNoise2D(hashString(`forest:${seed}`));
  const randomPoint = () => ({ x: nextRange(rng, -half, half), z: nextRange(rng, -half, half) });

  for (let i = 0; i < cfg.treeAttempts; i++) {
    const { x, z } = randomPoint();
    const y = sampleHeight(terrain, x, z);
    if (y < cfg.treeMinHeight || y > cfg.treeMaxHeight) continue;
    if (slopeAt(terrain, x, z) > cfg.treeMaxSlope) continue;
    if (Math.hypot(x - hallX, z - hallZ) < cfg.hallClearingRadius + 3) continue;
    // Trees grow in groves, not evenly.
    if (fbm(forest, x * 0.05, z * 0.05, 2) < -0.05) continue;
    terrain.trees.push({
      x,
      y,
      z,
      scale: nextRange(rng, 0.55, 1.05),
      rotation: nextFloat(rng) * Math.PI * 2,
    });
  }

  for (let i = 0; i < cfg.rockAttempts; i++) {
    const { x, z } = randomPoint();
    const y = sampleHeight(terrain, x, z);
    if (y < cfg.waterLevel - 0.5) continue;
    if (Math.hypot(x - hallX, z - hallZ) < cfg.hallClearingRadius) continue;
    terrain.rocks.push({ x, y, z, scale: nextRange(rng, 0.4, 1.6), rotation: nextFloat(rng) * Math.PI * 2 });
  }

  return terrain;
}

/** Bilinear height lookup at world position (x, z). Clamped to the map edge. */
export function sampleHeight(t: HoldTerrain, x: number, z: number): number {
  const half = t.size / 2;
  const fx = Math.min(t.resolution - 1.001, Math.max(0, (x + half) / t.cellSize));
  const fz = Math.min(t.resolution - 1.001, Math.max(0, (z + half) / t.cellSize));
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const tx = fx - c0;
  const tz = fz - r0;
  const at = (r: number, c: number) => t.heights[r * t.resolution + c]!;
  const top = at(r0, c0) * (1 - tx) + at(r0, c0 + 1) * tx;
  const bottom = at(r0 + 1, c0) * (1 - tx) + at(r0 + 1, c0 + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

/** Steepness at (x, z): rise over run across one cell. */
export function slopeAt(t: HoldTerrain, x: number, z: number): number {
  const d = t.cellSize;
  const dx = sampleHeight(t, x + d, z) - sampleHeight(t, x - d, z);
  const dz = sampleHeight(t, x, z + d) - sampleHeight(t, x, z - d);
  return Math.hypot(dx, dz) / (2 * d);
}
