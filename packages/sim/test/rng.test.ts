import { describe, expect, it } from 'vitest';
import { ManualClock, createNoise2D, createRng, hashString, nextFloat, nextInt } from '../src';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 50 }, () => nextFloat(a));
    const seqB = Array.from({ length: 50 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('differs for different seeds', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('stays in [0, 1) and covers the range', () => {
    const rng = createRng(7);
    let min = 1;
    let max = 0;
    for (let i = 0; i < 10_000; i++) {
      const v = nextFloat(rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeLessThan(0.01);
    expect(max).toBeGreaterThan(0.99);
  });

  it('nextInt is inclusive on both ends', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(nextInt(rng, 1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('hashString is stable', () => {
    expect(hashString('jarlheim')).toBe(hashString('jarlheim'));
    expect(hashString('jarlheim')).not.toBe(hashString('Jarlheim'));
  });
});

describe('noise', () => {
  it('is deterministic and bounded', () => {
    const n1 = createNoise2D(99);
    const n2 = createNoise2D(99);
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37;
      const y = i * -0.21;
      expect(n1(x, y)).toBe(n2(x, y));
      expect(Math.abs(n1(x, y))).toBeLessThanOrEqual(1.0001);
    }
  });
});

describe('ManualClock', () => {
  it('only moves when told to', () => {
    const clock = new ManualClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
  });
});
