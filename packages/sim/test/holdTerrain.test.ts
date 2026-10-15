import { describe, expect, it } from 'vitest';
import { HOLD_TERRAIN, generateHoldTerrain, sampleHeight, slopeAt } from '../src';

describe('generateHoldTerrain', () => {
  const terrain = generateHoldTerrain(1234);

  it('is deterministic for the same seed', () => {
    const again = generateHoldTerrain(1234);
    expect(again.heights).toEqual(terrain.heights);
    expect(again.trees).toEqual(terrain.trees);
    expect(again.rocks).toEqual(terrain.rocks);
  });

  it('changes with the seed', () => {
    const other = generateHoldTerrain(9876);
    expect(other.heights).not.toEqual(terrain.heights);
  });

  it('has the configured size', () => {
    expect(terrain.heights.length).toBe(HOLD_TERRAIN.resolution ** 2);
    expect(terrain.size).toBe((HOLD_TERRAIN.resolution - 1) * HOLD_TERRAIN.cellSize);
  });

  it('puts the Great Hall on flat dry land', () => {
    const { x, z } = terrain.hall;
    expect(sampleHeight(terrain, x, z)).toBeGreaterThan(terrain.waterLevel);
    expect(slopeAt(terrain, x, z)).toBeLessThan(0.05);
  });

  it('anchors the longship in water', () => {
    expect(sampleHeight(terrain, terrain.harbor.x, terrain.harbor.z)).toBeLessThan(terrain.waterLevel - 1);
  });

  it('has sea, land and mountains', () => {
    let water = 0;
    let mountain = 0;
    for (const h of terrain.heights) {
      if (h < terrain.waterLevel) water++;
      if (h > 12) mountain++;
    }
    const total = terrain.heights.length;
    expect(water / total).toBeGreaterThan(0.2);
    expect(water / total).toBeLessThan(0.75);
    expect(mountain).toBeGreaterThan(0);
  });

  it('only places trees on dry land, away from the hall', () => {
    expect(terrain.trees.length).toBeGreaterThan(100);
    for (const t of terrain.trees) {
      expect(t.y).toBeGreaterThan(terrain.waterLevel);
      expect(Math.hypot(t.x - terrain.hall.x, t.z - terrain.hall.z)).toBeGreaterThan(
        HOLD_TERRAIN.hallClearingRadius,
      );
    }
  });

  it('keeps the coast stable across several seeds', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const t = generateHoldTerrain(seed);
      expect(sampleHeight(t, t.hall.x, t.hall.z)).toBeGreaterThan(t.waterLevel);
      expect(sampleHeight(t, t.harbor.x, t.harbor.z)).toBeLessThan(t.waterLevel);
    }
  });
});
