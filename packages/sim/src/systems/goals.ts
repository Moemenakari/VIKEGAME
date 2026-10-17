import { DAILY_QUEST_POINTS, mainQuestAt, type MainGoal } from '../data/mainQuests';
import type { GameState } from '../state';
import { maxLevelOfType } from './economy';
import { sumCounts } from './military';

/** Is a main-quest goal met by the hold as it is now? */
export function mainGoalDone(state: GameState, goal: MainGoal): boolean {
  switch (goal.kind) {
    case 'building':
      return maxLevelOfType(state, goal.building) >= goal.level;
    case 'troops':
      return sumCounts(state.army.troops) >= goal.count;
    case 'barrow':
      return state.pve.draugrCleared >= goal.level;
  }
}

/** The current main quest and whether it can be claimed (the line never ends). */
export function currentMainQuest(state: GameState) {
  const quest = mainQuestAt(state.mainQuest);
  return { quest, done: mainGoalDone(state, quest.goal) };
}

/** Activity points earned today by claiming daily quests. */
export function activityPoints(state: GameState): number {
  return state.quests.claimed.length * DAILY_QUEST_POINTS;
}
