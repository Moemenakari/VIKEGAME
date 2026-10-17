import type { Cost } from '../data/resources';
import { MILITARY } from '../data/troops';
import type { BattleReport, GameState } from '../state';

/**
 * The mail: battle and scout reports and these notices (owner request: joining an
 * alliance, gifts and rewards land in the mail too). Rewards in a notice are already
 * granted; the notice only tells what came.
 */
export function sendNotice(
  state: GameState,
  now: number,
  title: string,
  saga: string[],
  reward: Cost = {},
  items?: Record<string, number>,
): void {
  const notice: BattleReport = {
    id: state.nextReportId++,
    at: now,
    kind: 'notice',
    level: 0,
    title,
    won: true,
    rounds: 0,
    attacker: [],
    defender: [],
    saga,
    reward,
    ...(items && Object.keys(items).length ? { items } : {}),
    read: false,
  };
  state.reports = [notice, ...state.reports].slice(0, MILITARY.maxReports);
}

/** Marks every report and notice as read (one tap at the top of the mail). */
export function readAll(state: GameState): void {
  for (const r of state.reports) r.read = true;
}
