import { describe, expect, it } from 'vitest';
import {
  DAILY_QUESTS,
  PLOTS,
  apply,
  advance,
  deserialize,
  generateHoldTerrain,
  newGame,
  sampleHeight,
  serialize,
  slopeAt,
} from '../src';

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0);
const HOUR = 3_600_000;

describe('daily quests', () => {
  it('count progress from events and pay out once', () => {
    let s = newGame(1, T0);
    for (const plotId of ['a3', 'a4', 'a5']) {
      const r = apply(
        s,
        { type: 'build', plotId, building: plotId === 'a3' ? 'storehouse' : 'farmstead' },
        T0,
      );
      if (r.ok) s = r.state;
      else {
        // Out of builders: wait for the first jobs to finish, then continue.
        s = advance(s, T0 + HOUR).state;
        const again = apply(s, { type: 'build', plotId, building: 'farmstead' }, T0 + HOUR);
        if (!again.ok) throw new Error(again.error.message);
        s = again.state;
      }
    }
    expect(s.quests.progress['start-3']).toBe(3);
    const silver = s.resources.silver;
    const claim = apply(s, { type: 'claimQuest', questId: 'start-3' }, T0 + HOUR);
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.state.resources.silver).toBeGreaterThan(silver);
    expect(apply(claim.state, { type: 'claimQuest', questId: 'start-3' }, T0 + HOUR).ok).toBe(false);
  });

  it('count produced Food', () => {
    const s = newGame(1, T0);
    s.resources.food = 0;
    const { state } = advance(s, T0 + 6 * HOUR);
    const q = DAILY_QUESTS.find((q) => q.id === 'food-2000')!;
    expect(state.quests.progress[q.id]).toBe(q.target);
  });

  it('cannot be claimed before they are done', () => {
    const r = apply(newGame(1, T0), { type: 'claimQuest', questId: 'complete-2' }, T0);
    expect(r.ok).toBe(false);
  });

  it('reset at midnight UTC', () => {
    const s = newGame(1, T0);
    s.quests.progress['start-3'] = 2;
    s.quests.claimed.push('free-finish');
    const { state, events } = advance(s, Date.UTC(2026, 9, 16, 0, 0, 1));
    expect(state.quests.progress['start-3']).toBeUndefined();
    expect(state.quests.claimed).toEqual([]);
    expect(events.some((e) => e.type === 'quests.reset')).toBe(true);
  });
});

describe('save files', () => {
  it('round-trip the whole game in one document', () => {
    let s = newGame(9, T0);
    const r = apply(s, { type: 'build', plotId: 'a3', building: 'storehouse' }, T0);
    if (r.ok) s = r.state;
    const text = serialize(s);
    expect(deserialize(text)).toEqual(s);
  });

  it('reject broken or foreign data', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{}')).toBeNull();
    const s = newGame(9, T0);
    const bad = JSON.parse(serialize(s));
    bad.state.resources.food = 'lots';
    expect(deserialize(JSON.stringify(bad))).toBeNull();
    const future = JSON.parse(serialize(s));
    future.version = 999;
    expect(deserialize(JSON.stringify(future))).toBeNull();
  });
});

describe('building plots', () => {
  it('sit on flat dry land for several seeds', () => {
    for (const seed of [20260930, 1, 2, 3]) {
      const t = generateHoldTerrain(seed);
      for (const p of PLOTS) {
        const x = t.hall.x + p.dx;
        const z = t.hall.z + p.dz;
        expect(sampleHeight(t, x, z), `plot ${p.id} seed ${seed}`).toBeGreaterThan(t.waterLevel + 0.5);
        expect(slopeAt(t, x, z), `plot ${p.id} seed ${seed}`).toBeLessThan(0.35);
      }
    }
  });

  it('have unique ids', () => {
    expect(new Set(PLOTS.map((p) => p.id)).size).toBe(PLOTS.length);
  });
});
