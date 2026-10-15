/**
 * Time is an input to the simulation, never read from a global.
 * The client passes a real clock, tests pass a fixed one, and the future
 * server will pass its own authoritative clock.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/** A clock that only moves when told to. Used by tests and replays. */
export class ManualClock implements Clock {
  constructor(private time = 0) {}

  now(): number {
    return this.time;
  }

  advance(ms: number): void {
    this.time += ms;
  }

  set(ms: number): void {
    this.time = ms;
  }
}
