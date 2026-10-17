import { HERO_RULES } from '../data/heroes';
import { itemDef, type ItemDef } from '../data/items';
import type { GameState } from '../state';
import { grant } from './economy';
import { grantHero, heroMaxLevel } from './heroes';

export function addItems(state: GameState, items: Record<string, number>): void {
  for (const [id, n] of Object.entries(items)) if (n > 0) state.items[id] = (state.items[id] ?? 0) + n;
}

/** Where a speed-up is used: a construction, a training batch or the healers. */
export type ItemTarget = { queue: 'build' | 'train' | 'heal'; buildingId: string } | { heroId: string };

/** Uses `count` of an item. Returns an error message, or null when done. */
export function useItem(
  state: GameState,
  id: string,
  count: number,
  target: ItemTarget | undefined,
  now: number,
): string | null {
  const def: ItemDef | undefined = itemDef(id);
  const have = state.items[id] ?? 0;
  if (!def) return 'No such item';
  if (!Number.isInteger(count) || count < 1) return 'Choose how many to use';
  if (have < count) return 'You do not have enough of that item';
  switch (def.kind) {
    case 'chest':
      for (let i = 0; i < count; i++) grant(state.resources, def.contents);
      break;
    case 'speedup': {
      if (!target || !('queue' in target)) return 'Choose a timer to speed up';
      const ms = def.minutes * 60_000 * count;
      if (target.queue === 'heal') {
        if (!state.healing) return 'Nothing is running there';
        state.healing.endsAt = Math.max(now, state.healing.endsAt - ms);
      } else {
        const list = target.queue === 'train' ? state.training : state.queue;
        const job = list.find((j) => j.buildingId === target.buildingId);
        if (!job) return 'Nothing is running there';
        job.endsAt = Math.max(now, job.endsAt - ms);
      }
      break;
    }
    case 'heroXp': {
      if (!target || !('heroId' in target)) return 'Choose a hero';
      const h = state.heroes.owned[target.heroId];
      if (!h) return 'You do not have this hero';
      const room = heroMaxLevel(state) - h.level;
      if (room < count * def.levels) return 'Upgrade the Great Hall to train heroes higher';
      h.level += count * def.levels;
      break;
    }
    case 'teleport':
      return 'Use it on the world map';
    case 'stamina':
      state.wallet.stamina += def.amount * count;
      break;
    case 'starShard': {
      if (!target || !('heroId' in target)) return 'Choose a hero';
      const h = state.heroes.owned[target.heroId];
      if (!h) return 'You do not have this hero';
      if (h.stars >= HERO_RULES.maxStars) return 'This hero has all the stars';
      for (let i = 0; i < count; i++) grantHero(state, target.heroId);
      break;
    }
  }
  state.items[id] = have - count;
  if (state.items[id] === 0) delete state.items[id];
  return null;
}

/** Records a battle on the profile and drops its spoils into the Bag. */
export function recordBattle(
  state: GameState,
  won: boolean,
  kills: number,
  drops?: Record<string, number>,
): void {
  state.stats.kills += Math.max(0, Math.floor(kills));
  if (won) state.stats.battlesWon++;
  else state.stats.battlesLost++;
  if (won && drops) addItems(state, drops);
}

/** Fallen enemies in a battle result (walls are not counted). */
export const killsOf = (side: Array<{ type: string; start: number; alive: number }>) =>
  side.reduce((n, s) => (s.type === 'wall' ? n : n + s.start - s.alive), 0);
