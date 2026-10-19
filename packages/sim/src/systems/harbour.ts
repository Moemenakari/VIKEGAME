import { TROOPS } from '../data/troops';
import type { GameState } from '../state';

/** Ships you own, by kind. */
export function ownShips(state: GameState): Record<string, number> {
  return Object.fromEntries(
    Object.entries(state.army.troops).filter(([id, n]) => TROOPS[id]?.type === 'ship' && n > 0),
  );
}

/** Ships kept in the boathouse (never more than you own: losses at sea come off the guard). */
export function dockedShips(state: GameState): Record<string, number> {
  const own = ownShips(state);
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(state.harbour?.docked ?? {})) {
    const c = Math.min(n, own[id] ?? 0);
    if (c > 0) out[id] = c;
  }
  return out;
}

/** Ships on guard in the fjord: they sail out against every raid. */
export function guardShips(state: GameState): Record<string, number> {
  const docked = dockedShips(state);
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(ownShips(state))) {
    const c = n - (docked[id] ?? 0);
    if (c > 0) out[id] = c;
  }
  return out;
}

/** Sets how many of each ship stay docked (the rest guard the fjord). */
export function setHarbour(state: GameState, docked: Record<string, number>): string | null {
  const own = ownShips(state);
  const clean: Record<string, number> = {};
  for (const [id, n] of Object.entries(docked)) {
    if (TROOPS[id]?.type !== 'ship') return 'Only ships can be docked';
    const c = Math.floor(n);
    if (c < 0 || c > (own[id] ?? 0)) return 'You do not have that many ships';
    if (c > 0) clean[id] = c;
  }
  state.harbour = { docked: clean };
  return null;
}
