import { RESOURCE_NAMES, type Cost, type ResourceId } from '../data/resources';
import { nextInt, type Rng } from '../rng';
import type { BattleOutcome } from './combat';
import { countByType } from './combat';

/**
 * Tells a battle as a few lines in the plain, understated voice of the sagas.
 * All text is our own; the choice of lines is seeded, so a replay reads the same.
 */
const pick = (rng: Rng, lines: readonly string[]): string => lines[nextInt(rng, 0, lines.length - 1)]!;

const OPENINGS = [
  'At dusk the mound split open, and {band} came out into the snow.',
  'Cold light burned inside the barrow, and {band} rose to meet you.',
  'The dead do not rest easy in that howe. {band} stood waiting by the stones.',
] as const;

const ARCHERS_FIRST = [
  'Your archers loosed first, and arrows fell on the dead like hail.',
  'Yew bows sang, and the first rank of the dead went down.',
] as const;

const SHIELDWALL_HELD = [
  'Your shieldwall locked, and the ravagers broke upon it like waves on rock.',
  'Shield against shield your line stood, and the wild dead could not pass.',
] as const;

const BERSERKERS_RAN = [
  'Your berserkers ran down the wights before they could draw again.',
  'Howling, the wolf-coats fell on the wights among the stones.',
] as const;

const ENEMY_ARCHERS = ['Wights loosed black arrows out of the mist.'] as const;

const LONG_FIGHT = [
  'For {rounds} rounds iron rang on bone.',
  'The fight went on until the snow was trampled red.',
] as const;

const VICTORY = [
  'When the mist lifted, {band} lay still. The barrow is quiet, for now.',
  'At last the dead lay down again, and the howe was silent.',
] as const;

const DEFEAT = [
  'The dead would not fall. Your warriors fell back to the hold, carrying their wounded.',
  'It was not a day for winning. The survivors came home through the dark.',
] as const;

function list(cost: Cost): string {
  const parts = (Object.entries(cost) as Array<[ResourceId, number]>)
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${n.toLocaleString('en-US')} ${RESOURCE_NAMES[r]}`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export function writeSaga(
  outcome: BattleOutcome,
  band: string,
  casualties: { dead: number; wounded: number },
  reward: Cost,
  rng: Rng,
): string[] {
  const fill = (s: string) => s.replace('{band}', band).replace('{rounds}', String(outcome.rounds));
  const ours = countByType(outcome.attacker);
  const theirs = countByType(outcome.defender);
  const lines = [fill(pick(rng, OPENINGS))];

  if (ours.archer > 0) lines.push(pick(rng, ARCHERS_FIRST));
  else if (theirs.archer > 0) lines.push(pick(rng, ENEMY_ARCHERS));
  if (outcome.usedCounter.attacker.shieldwall) lines.push(pick(rng, SHIELDWALL_HELD));
  if (outcome.usedCounter.attacker.berserker) lines.push(pick(rng, BERSERKERS_RAN));
  if (outcome.rounds >= 4) lines.push(fill(pick(rng, LONG_FIGHT)));

  lines.push(fill(pick(rng, outcome.attackerWon ? VICTORY : DEFEAT)));

  if (casualties.dead + casualties.wounded === 0) {
    lines.push('Not one of your warriors was lost. That is a deed worth a song.');
  } else {
    lines.push(
      `${casualties.dead} of your warriors fell, and ${casualties.wounded} were carried home wounded.`,
    );
  }
  const loot = list(reward);
  if (outcome.attackerWon && loot) lines.push(`From the howe you carried home ${loot}.`);
  return lines;
}
