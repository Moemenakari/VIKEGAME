import { FORMATIONS } from '../data/heroes';
import { TROOPS } from '../data/troops';
import type { GameState } from '../state';
import { sumCounts } from './military';

export interface Formation {
  heroes: string[];
  troops: Record<string, number>;
}

/** Your four squads (empty until you set them). */
export function formations(state: GameState): Formation[] {
  const f = state.formations ?? [];
  return Array.from({ length: FORMATIONS.count }, (_, i) => f[i] ?? { heroes: [], troops: {} });
}

/** How many warriors a squad led by these heroes can take along. */
export function formationCapacity(state: GameState, heroes: string[]): number {
  const levels = heroes.reduce((n, id) => n + (state.heroes.owned[id]?.level ?? 0), 0);
  return FORMATIONS.baseCapacity + levels * FORMATIONS.capacityPerHeroLevel;
}

/** Heroes out with a march right now (a hero leads one squad at a time). */
export function busyHeroes(state: GameState): Set<string> {
  return new Set(state.marches.flatMap((m) => m.heroes ?? []));
}

/** Saves a squad. A hero moved here leaves any other squad. */
export function setFormation(
  state: GameState,
  index: number,
  heroes: string[],
  troops: Record<string, number>,
): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= FORMATIONS.count) return 'No such squad';
  const unique = [...new Set(heroes)];
  if (unique.length > FORMATIONS.heroesPer) return `A squad has at most ${FORMATIONS.heroesPer} heroes`;
  if (unique.some((id) => !state.heroes.owned[id])) return 'You do not have that hero';
  const clean: Record<string, number> = {};
  for (const [id, n] of Object.entries(troops)) {
    const c = Math.floor(n);
    if (c <= 0) continue;
    if (!TROOPS[id] || TROOPS[id].type === 'ship') return 'Ships do not march on land';
    clean[id] = c;
  }
  if (sumCounts(clean) > formationCapacity(state, unique)) return 'Too many warriors for this squad';
  const all = formations(state).map((f) => ({ ...f, heroes: f.heroes.filter((h) => !unique.includes(h)) }));
  all[index] = { heroes: unique, troops: clean };
  state.formations = all;
  return null;
}

/** What a squad sends now: its saved warriors (as many as are home) and its free heroes. */
export function formationSend(
  state: GameState,
  index: number,
): { troops: Record<string, number>; heroes: string[] } | string {
  const f = formations(state)[index];
  if (!f) return 'No such squad';
  const busy = busyHeroes(state);
  if (f.heroes.some((h) => busy.has(h))) return 'A hero of this squad is already marching';
  const troops: Record<string, number> = {};
  for (const [id, n] of Object.entries(f.troops)) {
    const c = Math.min(n, state.army.troops[id] ?? 0);
    if (c > 0) troops[id] = c;
  }
  if (sumCounts(troops) === 0) return 'Not enough troops at home';
  return { troops, heroes: f.heroes };
}
