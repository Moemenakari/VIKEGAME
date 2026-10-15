import { DAILY_QUESTS, type QuestMetric } from '../data/quests';
import type { GameEvent } from '../events';
import { dayIndex, type GameState } from '../state';

/** Starts a fresh set of daily quests when the UTC day changes. */
export function rollQuestDay(state: GameState, now: number, events: GameEvent[]): void {
  const today = dayIndex(now);
  if (today !== state.quests.day) {
    state.quests = { day: today, progress: {}, claimed: [] };
    events.push({ type: 'quests.reset', day: today });
  }
}

function metricAmount(event: GameEvent, metric: QuestMetric): number {
  switch (metric) {
    case 'construction.started':
    case 'building.completed':
    case 'finish.free':
      return event.type === metric ? 1 : 0;
    case 'produced.food':
      return event.type === 'resources.produced' ? (event.amounts.food ?? 0) : 0;
    case 'produced.timber':
      return event.type === 'resources.produced' ? (event.amounts.timber ?? 0) : 0;
  }
}

/** Feeds a step's events into the daily quest counters (in one pass over the events). */
export function trackQuests(state: GameState, events: GameEvent[]): void {
  const newlyDone: string[] = [];
  for (const quest of DAILY_QUESTS) {
    const before = state.quests.progress[quest.id] ?? 0;
    if (before >= quest.target) continue;
    let gained = 0;
    for (const e of events) gained += metricAmount(e, quest.metric);
    if (gained === 0) continue;
    const after = Math.min(quest.target, before + gained);
    state.quests.progress[quest.id] = after;
    if (after >= quest.target) newlyDone.push(quest.id);
  }
  for (const questId of newlyDone) events.push({ type: 'quest.completed', questId });
}
