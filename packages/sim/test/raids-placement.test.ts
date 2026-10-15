import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  RAIDS,
  advance,
  apply,
  builderSlots,
  deserialize,
  newGame,
  placementError,
  plotSpot,
  productionPerHour,
  resolveBattle,
  serialize,
  suggestSpot,
  createRng,
  type Command,
  type GameState,
} from '../src';

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0);
const MIN = 60_000;

function must(state: GameState, cmd: Command, now: number): GameState {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`${cmd.type} rejected: ${r.error.message}`);
  return r.state;
}

describe('free placement', () => {
  it('builds anywhere on free, dry ground and moves buildings later', () => {
    let s = newGame(1, T0);
    s = must(s, { type: 'build', building: 'farmstead', x: -6, z: 11 }, T0);
    expect(s.buildings.b1).toMatchObject({ type: 'farmstead', x: -6, z: 11 });
    s = must(s, { type: 'move', buildingId: 'b1', x: 4, z: -10.5 }, T0);
    expect(s.buildings.b1).toMatchObject({ x: 4, z: -10.5 });
  });

  it('refuses overlapping buildings, land beyond the hold and the Great Hall moving', () => {
    const s = newGame(1, T0);
    expect(placementError(s, 'farmstead', 0, 0)).toMatch(/close/);
    expect(placementError(s, 'farmstead', 0, 40)).toMatch(/far/);
    expect(apply(s, { type: 'move', buildingId: 'hall', x: 3, z: 12 }, T0).ok).toBe(false);
    const a1 = s.buildings.a1!;
    expect(apply(s, { type: 'move', buildingId: 'a2', x: a1.x, z: a1.z }, T0).ok).toBe(false);
  });

  it('suggests a valid spot for every building type', () => {
    const s = newGame(3, T0);
    s.buildings.hall!.level = 9;
    for (const type of ['farmstead', 'shipyard', 'palisade', 'bearDen'] as const) {
      const spot = suggestSpot(s, type)!;
      expect(spot).not.toBeNull();
      expect(placementError(s, type, spot.x, spot.z)).toBeNull();
    }
  });

  it('upgrades a version-3 save: buildings stand where their plots were', () => {
    const s = newGame(1, T0);
    const old = JSON.parse(serialize(s));
    old.version = 3;
    old.state.version = 3;
    for (const b of Object.values(old.state.buildings) as Array<Record<string, unknown>>) {
      delete b.x;
      delete b.z;
      delete b.rot;
    }
    delete old.state.raid;
    delete old.state.nextBuildingId;
    const loaded = deserialize(JSON.stringify(old))!;
    expect(loaded).not.toBeNull();
    expect(loaded.buildings.a3 ?? loaded.buildings.a1).toMatchObject(plotSpot('a1'));
    expect(loaded.raid).toEqual({ nextAt: null, count: 0, incoming: null });
  });
});

describe('new buildings', () => {
  it("Builders' Lodge adds a builder and Rune Hall boosts production", () => {
    const s = newGame(1, T0);
    const slots = builderSlots(s);
    const food = productionPerHour(s).food;
    s.buildings.x1 = { id: 'x1', type: 'builderLodge', level: 1, x: 0, z: 14, rot: 0 };
    s.buildings.x2 = { id: 'x2', type: 'runeHall', level: 5, x: 8, z: 12, rot: 0 };
    expect(builderSlots(s)).toBe(slots + 1);
    expect(productionPerHour(s).food).toBeCloseTo(food * (1 + 5 * BUILDINGS.runeHall.researchPerLevel!));
  });

  it('a Stable trains riders and a Boathouse builds ships', () => {
    let s = newGame(1, T0);
    s.resources.food = s.resources.timber = 99_999;
    s.resources.silver = 9_999;
    s.buildings.st = { id: 'st', type: 'stable', level: 1, x: 0, z: 14, rot: 0 };
    s.buildings.sh = { id: 'sh', type: 'shipyard', level: 1, x: 9, z: 12, rot: 0 };
    s = must(s, { type: 'train', buildingId: 'st', troopId: 'cavalry-1', count: 5 }, T0);
    s = must(s, { type: 'train', buildingId: 'sh', troopId: 'ship-1', count: 2 }, T0);
    s = advance(s, T0 + 10 * MIN).state;
    expect(s.army.troops['cavalry-1']).toBe(5);
    expect(s.army.troops['ship-1']).toBe(2);
    // Ships never march on land.
    expect(apply(s, { type: 'attackDraugr', level: 1, troops: { 'ship-1': 2 } }, T0 + 10 * MIN).ok).toBe(
      false,
    );
  });

  it('siege engines break walls far faster than footmen do', () => {
    const wall = { key: 'w', name: 'Wall', type: 'wall' as const, count: 1, atk: 0, def: 10, hp: 5_000 };
    const hit = (type: 'siege' | 'berserker') => {
      const out = resolveBattle(
        [{ key: type, name: type, type, count: 10, atk: 10, def: 5, hp: 50 }],
        [wall],
        createRng(1),
      );
      return out.log[0]!.attackerDamage;
    };
    expect(hit('siege')).toBeGreaterThan(hit('berserker') * 3);
  });
});

describe('sea raids', () => {
  it('leave a newcomer alone, then come after Great Hall 3 with a warning first', () => {
    let s = newGame(1, T0);
    s = advance(s, T0 + 2 * RAIDS.intervalMs).state;
    expect(s.raid.nextAt).toBeNull();
    s.buildings.hall!.level = 3;
    s = advance(s, T0 + 2 * RAIDS.intervalMs + 1000).state;
    const landsAt = s.raid.nextAt!;
    expect(landsAt).toBeGreaterThan(s.lastTick);
    const spotted = advance(s, landsAt - RAIDS.warningMs + 1000);
    expect(spotted.events.some((e) => e.type === 'raid.spotted')).toBe(true);
    expect(spotted.state.raid.incoming).not.toBeNull();
    const landed = advance(spotted.state, landsAt + 1000);
    expect(landed.events.some((e) => e.type === 'raid.resolved')).toBe(true);
    expect(landed.state.raid.count).toBe(1);
    expect(landed.state.reports[0]!.kind).toBe('raid');
  });

  it('an undefended hold is looted, but the Jarl’s House hides its share', () => {
    const run = (cellar: boolean) => {
      let s = newGame(1, T0);
      s.resources.food = s.resources.timber = 10_000;
      if (cellar) s.buildings.j = { id: 'j', type: 'jarlHouse', level: 3, x: 0, z: 14, rot: 0 };
      s = must(s, { type: 'callRaid' }, T0);
      s = advance(s, T0 + RAIDS.practiceDelayMs + 1000).state;
      return s;
    };
    const open = run(false);
    expect(open.reports[0]!.won).toBe(false);
    expect(open.resources.food).toBeLessThan(10_000);
    expect(run(true).resources.food).toBeGreaterThan(open.resources.food);
  });

  it('a strong warband and a palisade beat the raiders and salvage their goods', () => {
    let s = newGame(1, T0);
    s.raid.count = 1;
    s.army.troops = { 'shieldwall-2': 200, 'archer-2': 200, 'berserker-2': 200 };
    s.buildings.p = { id: 'p', type: 'palisade', level: 5, x: 0, z: 14, rot: 0 };
    // Practice raids are sized for the hold, so make a real (scheduled) raid against a weak plan.
    s = must(s, { type: 'callRaid' }, T0);
    s.raid.incoming!.practice = false;
    s.raid.incoming!.crew = { 'berserker-1': 30, 'archer-1': 20 };
    const silver = s.resources.silver;
    s = advance(s, T0 + RAIDS.practiceDelayMs + 1000).state;
    const report = s.reports[0]!;
    expect(report.won).toBe(true);
    expect(s.resources.silver).toBeGreaterThan(silver);
  });

  it('a practice raid does not make later raids harder', () => {
    let s = newGame(1, T0);
    s = must(s, { type: 'callRaid' }, T0);
    expect(apply(s, { type: 'callRaid' }, T0).ok).toBe(false);
    s = advance(s, T0 + RAIDS.practiceDelayMs + 1000).state;
    expect(s.raid.count).toBe(0);
    expect(s.raid.incoming).toBeNull();
  });

  it('are deterministic', () => {
    const run = () => {
      let s = newGame(7, T0);
      s.army.troops = { 'shieldwall-1': 20, 'archer-1': 15 };
      s = must(s, { type: 'callRaid' }, T0);
      return advance(s, T0 + 5 * MIN).state;
    };
    expect(run()).toEqual(run());
  });
});
