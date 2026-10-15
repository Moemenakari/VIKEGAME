import { describe, expect, it } from 'vitest';
import {
  plotSpot,
  DRAUGR_BANDS,
  MILITARY,
  TROOPS,
  apply,
  advance,
  createRng,
  deserialize,
  newGame,
  resolveBattle,
  serialize,
  STATE_VERSION,
  totalPower,
  trainCost,
  trainDurationMs,
  woundedCapacity,
  type Combatant,
  type Command,
  type GameState,
} from '../src';

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0);

function must(state: GameState, cmd: Command, now = T0): GameState {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`${cmd.type} rejected: ${r.error.message}`);
  return r.state;
}

/** A hold with all three training buildings and plenty of resources. */
function militaryHold(): GameState {
  const s = newGame(7, T0);
  s.buildings.hall!.level = 5;
  s.buildings.a3 = { id: 'a3', type: 'shieldYard', level: 5, ...plotSpot('a3') };
  s.buildings.a4 = { id: 'a4', type: 'bowyerRange', level: 1, ...plotSpot('a4') };
  s.buildings.a5 = { id: 'a5', type: 'wolfLodge', level: 1, ...plotSpot('a5') };
  s.buildings.a6 = { id: 'a6', type: 'healersHouse', level: 1, ...plotSpot('a6') };
  s.resources = { food: 99_999, timber: 99_999, iron: 0, silver: 9_999, gold: 100 };
  return s;
}

const stack = (key: string, type: Combatant['type'], count: number): Combatant => {
  const t = TROOPS[`${type}-1`]!;
  return { key, name: key, type, count, atk: t.atk, def: t.def, hp: t.hp };
};

describe('the counter triangle', () => {
  // Equal numbers: the side that counters should win every time.
  const cases: Array<[Combatant['type'], Combatant['type']]> = [
    ['shieldwall', 'berserker'],
    ['berserker', 'archer'],
    ['archer', 'shieldwall'],
  ];
  for (const [strong, weak] of cases) {
    it(`${strong} beats an equal number of ${weak}`, () => {
      // Balance the raw stats out so only the counter decides.
      const a = { ...stack('a', strong, 100), atk: 10, def: 8, hp: 30 };
      const d = { ...stack('d', weak, 100), atk: 10, def: 8, hp: 30 };
      const out = resolveBattle([a], [d], createRng(1));
      expect(out.attackerWon).toBe(true);
      const back = resolveBattle([d], [a], createRng(1));
      expect(back.attackerWon).toBe(false);
    });
  }

  it('is deterministic for the same seed', () => {
    const a = [stack('a', 'shieldwall', 50), stack('b', 'archer', 30)];
    const d = [stack('c', 'berserker', 60)];
    expect(resolveBattle(a, d, createRng(9))).toEqual(resolveBattle(a, d, createRng(9)));
  });

  it('never lets a battle run past the round limit', () => {
    const a = [{ ...stack('a', 'shieldwall', 1), atk: 0 }];
    const d = [{ ...stack('d', 'shieldwall', 1), atk: 0 }];
    const out = resolveBattle(a, d, createRng(1));
    expect(out.rounds).toBe(MILITARY.maxRounds);
    expect(out.attackerWon).toBe(false); // the defender holds
  });
});

describe('training', () => {
  it('pays, waits and adds troops', () => {
    let s = militaryHold();
    const food = s.resources.food;
    s = must(s, { type: 'train', buildingId: 'a3', troopId: 'shieldwall-1', count: 40 });
    expect(s.resources.food).toBe(food - trainCost('shieldwall-1', 40).food!);
    expect(s.army.troops['shieldwall-1']).toBeUndefined();
    const done = advance(s, T0 + trainDurationMs('shieldwall-1', 40));
    expect(done.state.army.troops['shieldwall-1']).toBe(40);
    expect(done.events.some((e) => e.type === 'training.completed')).toBe(true);
    expect(totalPower(done.state)).toBeGreaterThan(totalPower(s));
  });

  it('checks building, tier, batch size and one batch at a time', () => {
    const s = militaryHold();
    const code = (cmd: Command) => {
      const r = apply(s, cmd, T0);
      return r.ok ? 'ok' : r.error.code;
    };
    expect(code({ type: 'train', buildingId: 'a3', troopId: 'archer-1', count: 5 })).toBe('UNKNOWN');
    expect(code({ type: 'train', buildingId: 'a4', troopId: 'archer-2', count: 5 })).toBe('LOCKED');
    expect(code({ type: 'train', buildingId: 'a4', troopId: 'archer-1', count: 999 })).toBe('LIMIT');
    expect(code({ type: 'train', buildingId: 'a4', troopId: 'archer-1', count: 0 })).toBe('UNKNOWN');
    const busy = must(s, { type: 'train', buildingId: 'a4', troopId: 'archer-1', count: 5 });
    const r = apply(busy, { type: 'train', buildingId: 'a4', troopId: 'archer-1', count: 5 }, T0);
    expect(r.ok ? 'ok' : r.error.code).toBe('BUSY');
  });

  it('can be finished free in the last 5 minutes', () => {
    let s = militaryHold();
    s = must(s, { type: 'train', buildingId: 'a3', troopId: 'shieldwall-1', count: 10 });
    s = must(s, { type: 'finishFree', buildingId: 'a3', queue: 'train' });
    expect(s.army.troops['shieldwall-1']).toBe(10);
  });
});

describe('battles with the draugr', () => {
  function withArmy(): GameState {
    const s = militaryHold();
    s.army.troops = { 'shieldwall-1': 60, 'archer-1': 40, 'berserker-1': 30 };
    return s;
  }

  it('a strong army clears level 1, earns loot and writes a saga report', () => {
    const s = withArmy();
    const r = apply(s, { type: 'attackDraugr', level: 1, troops: s.army.troops }, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const report = r.state.reports[0]!;
    expect(report.won).toBe(true);
    expect(report.saga.length).toBeGreaterThan(2);
    expect(report.saga.join(' ')).toContain(DRAUGR_BANDS[0]!.name);
    expect(r.state.pve.draugrCleared).toBe(1);
    expect(r.state.resources.food).toBeGreaterThan(s.resources.food);
    expect(r.state.resources.gold).toBe(s.resources.gold + DRAUGR_BANDS[0]!.firstClearReward.gold!);
    expect(r.state.quests.progress['win-battle']).toBe(1);
  });

  it('levels unlock in order', () => {
    const s = withArmy();
    const r = apply(s, { type: 'attackDraugr', level: 3, troops: s.army.troops }, T0);
    expect(r.ok ? 'ok' : r.error.code).toBe('LOCKED');
  });

  it('cannot send troops you do not have', () => {
    const s = withArmy();
    const r = apply(s, { type: 'attackDraugr', level: 1, troops: { 'shieldwall-1': 999 } }, T0);
    expect(r.ok ? 'ok' : r.error.code).toBe('NOT_ENOUGH');
  });

  it('a tiny army loses; the fallen are wounded up to capacity, the rest die', () => {
    const s = militaryHold();
    s.army.troops = { 'archer-1': 5 };
    const r = apply(s, { type: 'attackDraugr', level: 1, troops: { 'archer-1': 5 } }, T0);
    if (!r.ok) throw new Error(r.error.message);
    const report = r.state.reports[0]!;
    expect(report.won).toBe(false);
    const line = report.attacker[0]!;
    expect(line.dead + line.wounded).toBe(5 - (r.state.army.troops['archer-1'] ?? 0));
    expect(line.wounded).toBeLessThanOrEqual(woundedCapacity(s));
    expect(r.state.pve.draugrCleared).toBe(0);
  });

  it('wounded can be healed back', () => {
    let s = militaryHold();
    s.army.wounded = { 'shieldwall-1': 20 };
    s = must(s, { type: 'heal' });
    expect(s.army.wounded).toEqual({});
    const { state } = advance(s, s.healing!.endsAt);
    expect(state.army.troops['shieldwall-1']).toBe(20);
    expect(state.healing).toBeNull();
  });

  it('reports can be marked read and the list stays short', () => {
    let s = withArmy();
    for (let i = 0; i < MILITARY.maxReports + 3; i++) {
      s.army.troops = { 'shieldwall-1': 60, 'archer-1': 40, 'berserker-1': 30 };
      s = must(s, { type: 'attackDraugr', level: 1, troops: s.army.troops });
    }
    expect(s.reports.length).toBe(MILITARY.maxReports);
    s = must(s, { type: 'readReport', reportId: s.reports[0]!.id });
    expect(s.reports[0]!.read).toBe(true);
  });
});

describe('save migration', () => {
  it('upgrades a version-1 save (M2) to the current version with an empty army', () => {
    const v2 = newGame(3, T0);
    const v1 = JSON.parse(serialize(v2));
    v1.version = 1;
    v1.state.version = 1;
    for (const k of ['army', 'training', 'healing', 'reports', 'nextReportId', 'pve', 'rngState'])
      delete v1.state[k];
    const loaded = deserialize(JSON.stringify(v1));
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(STATE_VERSION);
    expect(loaded!.profile.owned).toEqual([0, 1, 2]);
    expect(loaded!.quests.chests).toEqual([]);
    expect(loaded!.army).toEqual({ troops: {}, wounded: {} });
    expect(loaded!.buildings).toEqual(v2.buildings);
  });
});
