import { describe, expect, it } from 'vitest';
import {
  HEROES,
  HERO_RULES,
  apply,
  createRng,
  heroMods,
  heroPower,
  newGame,
  resolveBattle,
  totalPower,
  type Command,
  type GameState,
} from '../src';

const T0 = Date.UTC(2026, 9, 16, 8, 0, 0);

function must(state: GameState, cmd: Command): GameState {
  const r = apply(state, cmd, T0);
  if (!r.ok) throw new Error(`${cmd.type} rejected: ${r.error.message}`);
  return r.state;
}

describe('heroes', () => {
  it('start with Bóndi Ketil in the squad and a few Saga Horns', () => {
    const s = newGame(1, T0);
    expect(s.heroes.squad).toEqual(['ketil']);
    expect(s.heroes.horns).toBe(HERO_RULES.startingHorns);
    expect(totalPower(s)).toBeGreaterThan(heroPower(s));
    expect(heroPower(s)).toBeGreaterThan(0);
  });

  it('are recruited with horns or Gold, and the pity promises an Epic every 10', () => {
    let s = newGame(1, T0);
    s.heroes.horns = 10;
    s = must(s, { type: 'recruitHero', count: 10 });
    expect(s.heroes.horns).toBe(0);
    const rarities = Object.keys(s.heroes.owned).map((id) => HEROES.find((h) => h.id === id)!.rarity);
    expect(rarities.some((r) => r !== 'rare')).toBe(true);
    expect(apply(s, { type: 'recruitHero', count: 1 }, T0).ok).toBe(false);
    const gold = s.resources.gold;
    s = must(s, { type: 'recruitHero', count: 1, gold: true });
    expect(s.resources.gold).toBe(gold - HERO_RULES.goldPerRecruit);
  });

  it('give a Legendary within 50 recruits, always', () => {
    let s = newGame(3, T0);
    s.resources.gold = 99_999;
    for (let i = 0; i < 5; i++) s = must(s, { type: 'recruitHero', count: 10, gold: true });
    const legendary = Object.keys(s.heroes.owned).some(
      (id) => HEROES.find((h) => h.id === id)!.rarity === 'legendary',
    );
    expect(legendary).toBe(true);
  });

  it('level up with Silver up to five levels per Great Hall level', () => {
    let s = newGame(1, T0);
    s.resources.silver = 99_999;
    for (let i = 0; i < 4; i++) s = must(s, { type: 'levelHero', heroId: 'ketil' });
    expect(s.heroes.owned.ketil!.level).toBe(5);
    expect(apply(s, { type: 'levelHero', heroId: 'ketil' }, T0).ok).toBe(false);
  });

  it('change battles: Lagertha shields the wall, Egil curses the foe', () => {
    const s = newGame(1, T0);
    s.heroes.owned.lagertha = { level: 1, stars: 0, dupes: 0 };
    s.heroes.owned.egil = { level: 1, stars: 0, dupes: 0 };
    s.heroes.squad = ['lagertha', 'egil'];
    const { ours, theirs } = heroMods(s, 'barrow');
    expect(ours.taken('shieldwall', 1)).toBeLessThan(1);
    expect(ours.taken('shieldwall', 3)).toBe(1);
    expect(theirs.attack('berserker', 1, false)).toBeLessThan(1);
    const stack = (key: string) => ({
      key,
      name: key,
      type: 'shieldwall' as const,
      count: 50,
      atk: 10,
      def: 8,
      hp: 30,
    });
    const plain = resolveBattle([stack('a')], [stack('b')], createRng(5));
    const led = resolveBattle([stack('a')], [stack('b')], createRng(5), { attacker: ours, defender: theirs });
    expect(led.attacker[0]!.alive).toBeGreaterThan(plain.attacker[0]!.alive);
  });

  it('a squad holds three different heroes you own', () => {
    const s = newGame(1, T0);
    expect(apply(s, { type: 'setSquad', squad: ['lagertha'] }, T0).ok).toBe(false);
    s.heroes.owned.leif = { level: 1, stars: 0, dupes: 0 };
    expect(must(s, { type: 'setSquad', squad: ['leif', 'ketil'] }).heroes.squad).toEqual(['leif', 'ketil']);
  });
});
