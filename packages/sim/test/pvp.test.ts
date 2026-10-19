import { describe, expect, it } from 'vitest';
import { apply, cleanSnapshot, defenceSnapshot, newGame, type Command, type GameState } from '../src';

const T0 = Date.UTC(2026, 9, 17, 8, 0, 0);

function must(state: GameState, cmd: Command): { state: GameState; events: ReturnType<typeof apply> } {
  const r = apply(state, cmd, T0);
  if (!r.ok) throw new Error(`${cmd.type} rejected: ${r.error.message}`);
  return { state: r.state, events: r };
}

describe('battles between players', () => {
  it('a strong attacker beats a weak hold and carries off at most 30 % of what is open', () => {
    const defender = newGame(2, T0);
    defender.army.troops = { 'shieldwall-1': 10 };
    defender.resources.food = 10_000;
    const snapshot = defenceSnapshot(defender);
    let attacker = newGame(1, T0);
    attacker.army.troops = { 'berserker-2': 200, 'archer-2': 200 };
    const food = attacker.resources.food;
    const r = apply(
      attacker,
      { type: 'attackPlayer', targetId: 'p2', targetName: 'Bjorn', snapshot, troops: attacker.army.troops },
      T0,
    );
    if (!r.ok) throw new Error(r.error.message);
    attacker = r.state;
    const fought = r.events.find((e) => e.type === 'pvp.fought');
    expect(fought && fought.type === 'pvp.fought' && fought.won).toBe(true);
    expect(attacker.resources.food - food).toBeLessThanOrEqual(snapshot.lootable.food! * 0.3);
    expect(attacker.reports[0]!.kind).toBe('pvp');
  });

  it('the defender loses troops and loot when the result is collected, never more than they have', () => {
    let s = newGame(2, T0);
    s.army.troops = { 'shieldwall-1': 10 };
    s.resources.food = 500;
    s = must(s, {
      type: 'sufferAttack',
      attackerId: 'u-astrid',
      attackerName: 'Astrid',
      attackerWon: true,
      losses: { 'shieldwall-1': 50 },
      loot: { food: 9_999 },
      at: T0,
    }).state;
    expect(s.army.troops['shieldwall-1'] ?? 0).toBe(0);
    expect(s.resources.food).toBe(0);
    expect(s.reports[0]!.title).toContain('Astrid');
    // Whoever attacks you is your foe: red on the map.
    expect(s.world.foes).toContain('u-astrid');
  });

  it('cleans snapshots from the server: unknown troops and absurd numbers are dropped', () => {
    const clean = cleanSnapshot({
      troops: { 'shieldwall-1': 5, 'dragon-9': 1000, 'ship-1': 4 },
      walls: [{ key: 'palisade', hp: 1e99 }, {}, {}],
      lootable: { food: -5, gold: 99 },
      heroes: { owned: { lagertha: { level: 999, stars: 9 } }, squad: ['lagertha', 'x', 'y', 'z'] },
    });
    expect(clean.troops).toEqual({ 'shieldwall-1': 5 });
    expect(clean.walls).toHaveLength(2);
    expect(clean.walls[0]!.hp).toBeLessThanOrEqual(10_000_000);
    expect(clean.lootable.food).toBe(0);
    expect(clean.heroes.owned.lagertha!.level).toBe(150);
    expect(clean.heroes.squad).toHaveLength(3);
  });

  it('moving to the place the server gave keeps the hold, and a new realm starts with no land', () => {
    let s = newGame(1, T0);
    s.world.owned = ['1,1'];
    const home = s.world.home;
    s = must(s, { type: 'setHome', realm: 1, x: home.x, y: home.y }).state;
    expect(s.world.owned).toEqual(['1,1']);
    expect(apply(s, { type: 'setHome', realm: 9, x: 1, y: 1 }, T0).ok).toBe(false);
  });
});
