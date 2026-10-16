import { describe, expect, it } from 'vitest';
import { RAIDS, STARTING_ITEMS, advance, apply, newGame, type Command, type GameState } from '../src';

const T0 = Date.UTC(2026, 9, 17, 8, 0, 0);
const must = (s: GameState, cmd: Command, now = T0) => {
  const r = apply(s, cmd, now);
  if (!r.ok) throw new Error(`${cmd.type}: ${r.error.message}`);
  return r.state;
};

describe('the Bag', () => {
  it('starts with a few speed-ups, and a speed-up shortens a construction', () => {
    let s = newGame(1, T0);
    expect(s.items).toEqual(STARTING_ITEMS);
    s.resources.timber = s.resources.food = 99_999;
    s.buildings.hall!.level = 9;
    s.buildings.a1!.level = 8;
    s = must(s, { type: 'upgrade', buildingId: 'a1' });
    const before = s.queue[0]!.endsAt;
    s = must(s, {
      type: 'useItem',
      itemId: 'speed-1h',
      count: 1,
      target: { queue: 'build', buildingId: 'a1' },
    });
    expect(s.queue[0]?.endsAt ?? T0).toBeLessThanOrEqual(Math.max(T0, before - 3_600_000));
    expect(s.items['speed-1h']).toBeUndefined();
  });

  it('chests give resources; you cannot use what you do not have', () => {
    let s = newGame(1, T0);
    const food = s.resources.food;
    s = must(s, { type: 'useItem', itemId: 'chest-spoils', count: 1 });
    expect(s.resources.food).toBeGreaterThan(food);
    expect(apply(s, { type: 'useItem', itemId: 'chest-spoils', count: 1 }, T0).ok).toBe(false);
  });

  it('a Saga Scroll levels a hero, a Rune Shard brings a star closer', () => {
    let s = newGame(1, T0);
    s.items = { 'hero-scroll': 1, 'star-shard': 1 };
    s = must(s, { type: 'useItem', itemId: 'hero-scroll', count: 1, target: { heroId: 'ketil' } });
    expect(s.heroes.owned.ketil!.level).toBe(2);
    s = must(s, { type: 'useItem', itemId: 'star-shard', count: 1, target: { heroId: 'ketil' } });
    expect(s.heroes.owned.ketil!.stars).toBe(1);
  });

  it('battles fill the profile and drop spoils', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'shieldwall-2': 100, 'archer-2': 100, 'berserker-2': 100 };
    s = must(s, { type: 'attackDraugr', level: 1, troops: s.army.troops });
    expect(s.stats.battlesWon).toBe(1);
    expect(s.stats.kills).toBeGreaterThan(0);
    expect(s.items['chest-spoils']).toBe(2);
    s = must(s, { type: 'callRaid' });
    s.raid.incoming!.practice = false;
    s.raid.incoming!.crew = { 'berserker-1': 5 };
    s = advance(s, T0 + RAIDS.practiceDelayMs + 1000).state;
    expect(s.stats.raidsBeaten).toBe(1);
    expect(s.items['hero-scroll']).toBe(1);
  });
});
