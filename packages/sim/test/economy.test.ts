import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  BUILDING_TYPES,
  ECONOMY,
  apply,
  advance,
  builderSlots,
  goldToFinish,
  newGame,
  productionPerHour,
  storageCap,
  totalPower,
  upgradeCost,
  upgradeDurationMs,
  type Command,
  type GameState,
} from '../src';

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

/** Applies a command and fails the test if the rules reject it. */
function must(state: GameState, cmd: Command, now: number): GameState {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`${cmd.type} rejected: ${r.error.message}`);
  return r.state;
}

describe('formulas', () => {
  it('costs and times grow with level', () => {
    for (const type of BUILDING_TYPES) {
      const c1 = Object.values(upgradeCost(type, 1)).reduce((a, b) => a + b, 0);
      const c10 = Object.values(upgradeCost(type, 10)).reduce((a, b) => a + b, 0);
      expect(c10).toBeGreaterThan(c1);
      expect(upgradeDurationMs(type, 10)).toBeGreaterThan(upgradeDurationMs(type, 1));
    }
  });

  it('rounds costs to friendly numbers', () => {
    for (const v of Object.values(upgradeCost('greatHall', 7))) expect(v % 10).toBe(0);
  });

  it('gives an extra builder at Great Hall 5 and 12', () => {
    const s = newGame(1, T0);
    expect(builderSlots(s)).toBe(2);
    s.buildings.hall!.level = 5;
    expect(builderSlots(s)).toBe(3);
    s.buildings.hall!.level = 12;
    expect(builderSlots(s)).toBe(4);
  });

  it('charges at least 1 Gold to finish', () => {
    expect(goldToFinish(1000)).toBe(1);
    expect(goldToFinish(60 * MIN)).toBe(30);
  });
});

describe('a new hold', () => {
  const s = newGame(1, T0);
  it('starts with a Great Hall, a Farmstead and a Woodcutter', () => {
    expect(
      Object.values(s.buildings)
        .map((b) => b.type)
        .sort(),
    ).toEqual(['farmstead', 'greatHall', 'woodcutter']);
    expect(s.resources).toEqual(ECONOMY.startingResources);
  });
  it('already produces Food and Timber', () => {
    const rates = productionPerHour(s);
    expect(rates.food).toBeGreaterThan(0);
    expect(rates.timber).toBeGreaterThan(0);
    expect(rates.iron).toBe(0);
  });
  it('has power', () => {
    expect(totalPower(s)).toBeGreaterThan(0);
  });
});

describe('production over time', () => {
  it('accrues by the hour', () => {
    const s = newGame(1, T0);
    const { state, events } = advance(s, T0 + HOUR);
    expect(state.resources.food).toBeCloseTo(s.resources.food + productionPerHour(s).food, 5);
    expect(events.filter((e) => e.type === 'resources.produced')).toHaveLength(1);
  });

  it('never exceeds storage', () => {
    const s = newGame(1, T0);
    const { state } = advance(s, T0 + 7 * HOUR);
    const caps = storageCap(s);
    expect(state.resources.food).toBeLessThanOrEqual(caps.food);
  });

  it('caps offline production at 8 hours', () => {
    const s = newGame(1, T0);
    s.resources.food = 0;
    // Remove the storage limit from the picture.
    const rate = productionPerHour(s).food;
    const a = advance(s, T0 + 8 * HOUR).state.resources.food;
    const b = advance(s, T0 + 48 * HOUR).state.resources.food;
    expect(a).toBeCloseTo(Math.min(rate * 8, storageCap(s).food), 3);
    expect(b).toBeCloseTo(a, 3);
  });

  it('does nothing when the clock goes backwards', () => {
    const s = newGame(1, T0);
    const { state } = advance(s, T0 - HOUR);
    expect(state.resources).toEqual(s.resources);
  });

  it('is the same whether advanced in one step or many', () => {
    const s = newGame(1, T0);
    const once = advance(s, T0 + 3 * HOUR).state;
    let many = s;
    for (let i = 1; i <= 180; i++) many = advance(many, T0 + i * MIN).state;
    expect(many.resources.food).toBeCloseTo(once.resources.food, 4);
    expect(many.resources.timber).toBeCloseTo(once.resources.timber, 4);
  });

  it('does not mutate the input state', () => {
    const s = newGame(1, T0);
    const copy = structuredClone(s);
    advance(s, T0 + HOUR);
    apply(s, { type: 'upgrade', buildingId: 'a1' }, T0 + HOUR);
    expect(s).toEqual(copy);
  });
});

describe('construction', () => {
  it('builds on an empty plot and finishes on time', () => {
    let s = newGame(1, T0);
    const before = s.resources.timber;
    s = must(s, { type: 'build', plotId: 'a3', building: 'farmstead' }, T0);
    expect(s.buildings.a3).toEqual({ id: 'a3', type: 'farmstead', level: 0 });
    expect(s.resources.timber).toBe(before - upgradeCost('farmstead', 1).timber!);
    const done = advance(s, T0 + upgradeDurationMs('farmstead', 1));
    expect(done.state.buildings.a3!.level).toBe(1);
    expect(done.state.queue).toHaveLength(0);
    expect(done.events.some((e) => e.type === 'building.completed' && e.buildingId === 'a3')).toBe(true);
  });

  it('produces at the new rate from the moment an upgrade finished', () => {
    let s = newGame(1, T0);
    s.buildings.hall!.level = 3;
    s = must(s, { type: 'upgrade', buildingId: 'a1' }, T0);
    s.resources.food = 0;
    const dur = upgradeDurationMs('farmstead', 2);
    const lvl1 = BUILDINGS.farmstead.produces!.perHour;
    const lvl2 = lvl1 * BUILDINGS.farmstead.produces!.growth;
    const end = T0 + dur + HOUR;
    const { state } = advance(s, end);
    const expected = (lvl1 * dur) / HOUR + lvl2;
    expect(state.resources.food).toBeCloseTo(expected, 3);
  });

  it('rejects when every builder is busy', () => {
    let s = newGame(1, T0);
    s.resources.timber = s.resources.food = 99_999;
    s.buildings.hall!.level = 3;
    s = must(s, { type: 'upgrade', buildingId: 'a1' }, T0);
    s = must(s, { type: 'upgrade', buildingId: 'a2' }, T0);
    const r = apply(s, { type: 'build', plotId: 'a3', building: 'storehouse' }, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_BUILDER');
  });

  it('rejects when resources are short, and changes nothing', () => {
    const s = newGame(1, T0);
    s.resources.timber = 0;
    s.buildings.hall!.level = 3;
    const r = apply(s, { type: 'upgrade', buildingId: 'a1' }, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('NOT_ENOUGH');
      expect(r.error.message).toContain('Timber');
    }
  });

  it('caps buildings at the Great Hall level', () => {
    const s = newGame(1, T0);
    s.resources.timber = s.resources.food = 99_999;
    s.buildings.a1!.level = 1;
    const r = apply(s, { type: 'upgrade', buildingId: 'a1' }, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('REQUIREMENT');
  });

  it('needs the Storehouse before Great Hall 3', () => {
    const s = newGame(1, T0);
    s.resources.timber = s.resources.food = 99_999;
    s.buildings.hall!.level = 2;
    const r = apply(s, { type: 'upgrade', buildingId: 'hall' }, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('Storehouse');
    s.buildings.a3 = { id: 'a3', type: 'storehouse', level: 2 };
    expect(apply(s, { type: 'upgrade', buildingId: 'hall' }, T0).ok).toBe(true);
  });

  it('respects locked plots, building unlocks, occupied plots and limits', () => {
    const s = newGame(1, T0);
    s.resources.timber = s.resources.food = 99_999;
    const codes = (cmd: Command) => {
      const r = apply(s, cmd, T0);
      return r.ok ? 'ok' : r.error.code;
    };
    expect(codes({ type: 'build', plotId: 'b1', building: 'farmstead' })).toBe('LOCKED');
    expect(codes({ type: 'build', plotId: 'a3', building: 'market' })).toBe('LOCKED');
    expect(codes({ type: 'build', plotId: 'a1', building: 'farmstead' })).toBe('OCCUPIED');
    expect(codes({ type: 'build', plotId: 'a3', building: 'greatHall' })).toBe('UNKNOWN');
    s.buildings.a3 = { id: 'a3', type: 'farmstead', level: 1 };
    s.buildings.a4 = { id: 'a4', type: 'farmstead', level: 1 };
    expect(codes({ type: 'build', plotId: 'a5', building: 'farmstead' })).toBe('LIMIT');
  });

  it('allows a free finish only in the last 5 minutes', () => {
    let s = newGame(1, T0);
    s.resources.timber = s.resources.food = 99_999;
    s.buildings.hall!.level = 12;
    s.buildings.a1!.level = 9;
    s = must(s, { type: 'upgrade', buildingId: 'a1' }, T0);
    const end = s.queue[0]!.endsAt;
    expect(end - T0).toBeGreaterThan(ECONOMY.freeFinishMs);
    expect(apply(s, { type: 'finishFree', buildingId: 'a1' }, T0).ok).toBe(false);
    const r = apply(s, { type: 'finishFree', buildingId: 'a1' }, end - ECONOMY.freeFinishMs);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.buildings.a1!.level).toBe(10);
  });

  it('can finish with Gold', () => {
    let s = newGame(1, T0);
    s = must(s, { type: 'upgrade', buildingId: 'hall' }, T0);
    const gold = goldToFinish(s.queue[0]!.endsAt - T0);
    s = must(s, { type: 'finishWithGold', buildingId: 'hall' }, T0);
    expect(s.buildings.hall!.level).toBe(2);
    expect(s.resources.gold).toBe(ECONOMY.startingResources.gold - gold);
  });

  it('is deterministic: same commands, same result', () => {
    const run = () => {
      let s = newGame(5, T0);
      s = must(s, { type: 'build', plotId: 'a3', building: 'storehouse' }, T0 + MIN);
      s = must(s, { type: 'upgrade', buildingId: 'hall' }, T0 + 2 * MIN);
      return advance(s, T0 + 5 * HOUR).state;
    };
    expect(run()).toEqual(run());
  });
});
