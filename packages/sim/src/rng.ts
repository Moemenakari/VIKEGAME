/**
 * Seeded pseudo-random numbers (mulberry32).
 *
 * The simulation never calls Math.random(): every random draw comes from an Rng
 * whose state lives in game data, so the same seed + the same commands always
 * produce the same game. That is what makes replays, tests and bug reports work.
 */
export interface Rng {
  /** 32-bit unsigned state. Mutated by every draw. */
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Returns a float in [0, 1) and advances the state. */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Float in [min, max). */
export function nextRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * nextFloat(rng);
}

/** Integer in [min, max] (inclusive). */
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

/** Stable 32-bit hash of a string (FNV-1a). Handy for deriving sub-seeds. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
