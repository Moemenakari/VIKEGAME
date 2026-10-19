import { THING } from '../data/thing';
import type { Cost } from '../data/resources';
import type { GameEvent } from '../events';
import { dayIndex, type GameState } from '../state';
import { addItems } from './items';
import { maxLevelOfType } from './economy';
import { sendNotice } from './mail';

const mound = (state: GameState) => maxLevelOfType(state, 'thingMound');

/** How many alliance-mates answer a call for help. */
export const helpersFor = (state: GameState) => THING.baseHelpers + mound(state);

/** Asks the alliance to help with one build: it finishes sooner (once per build). */
export function allianceHelp(
  state: GameState,
  buildingId: string,
  now: number,
  events: GameEvent[],
): string | null {
  if (mound(state) < 1) return 'Build the Thing Mound first';
  if (state.world.alliance === null) return 'Join an alliance first';
  const job = state.queue.find((j) => j.buildingId === buildingId);
  if (!job || job.endsAt <= now) return 'Nothing is being built there';
  if (job.helped) return 'Your alliance already helped with this';
  const left = job.endsAt - now;
  const cut = Math.min(helpersFor(state) * THING.helpMs, Math.floor(left * THING.maxHelpShare));
  job.endsAt -= cut;
  job.helped = true;
  events.push({ type: 'alliance.helped', buildingId, ms: cut });
  return null;
}

/** The daily gift from your alliance, larger with a higher Thing Mound. */
export function claimAllianceGift(state: GameState, now: number): string | null {
  const level = mound(state);
  if (level < 1) return 'Build the Thing Mound first';
  if (state.world.alliance === null) return 'Join an alliance first';
  const day = dayIndex(now);
  if (state.allianceGiftDay === day) return 'Already claimed';
  state.allianceGiftDay = day;
  const reward: Cost = {};
  for (const [r, v] of Object.entries(THING.giftPerLevel)) {
    const n = v * level;
    reward[r as keyof Cost] = n;
    state.resources[r as keyof Cost] += n;
  }
  addItems(state, THING.giftItems);
  sendNotice(
    state,
    now,
    'Gift · Alliance gift',
    ['Your alliance sent its daily gift to the Thing Mound.'],
    reward,
    THING.giftItems,
  );
  return null;
}
