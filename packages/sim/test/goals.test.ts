import { describe, expect, it } from 'vitest';
import {
  AVATARS,
  DAILY_CHESTS,
  MAIN_QUESTS,
  apply,
  currentMainQuest,
  newGame,
  type Command,
  type GameState,
} from '../src';

const T0 = Date.UTC(2026, 9, 16, 8, 0, 0);
const run = (s: GameState, cmd: Command) => apply(s, cmd, T0);

describe('main quest line', () => {
  it('starts at the first step, not yet done', () => {
    const s = newGame(1, T0);
    expect(currentMainQuest(s)).toEqual({ quest: MAIN_QUESTS[0], done: false });
    expect(run(s, { type: 'claimMainQuest' }).ok).toBe(false);
  });

  it('can be claimed once the hold meets the goal, then moves on', () => {
    const s = newGame(1, T0);
    s.buildings.hall!.level = 2;
    const r = run(s, { type: 'claimMainQuest' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.mainQuest).toBe(1);
    expect(r.state.resources.food).toBe(s.resources.food + MAIN_QUESTS[0]!.reward.food!);
  });

  it('checks troops and barrow goals', () => {
    const s = newGame(1, T0);
    s.mainQuest = MAIN_QUESTS.findIndex((q) => q.goal.kind === 'troops');
    s.army.troops = { 'shieldwall-1': 20 };
    expect(currentMainQuest(s)!.done).toBe(true);
    s.mainQuest = MAIN_QUESTS.findIndex((q) => q.goal.kind === 'barrow');
    expect(currentMainQuest(s)!.done).toBe(false);
    s.pve.draugrCleared = 1;
    expect(currentMainQuest(s)!.done).toBe(true);
  });
});

describe('daily chests', () => {
  it('open when enough daily quests were claimed, once', () => {
    const s = newGame(1, T0);
    expect(run(s, { type: 'claimQuestChest', index: 0 }).ok).toBe(false);
    s.quests.claimed = ['start-3'];
    const r = run(s, { type: 'claimQuestChest', index: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.resources.food).toBe(s.resources.food + DAILY_CHESTS[0]!.reward.food!);
    expect(run(r.state, { type: 'claimQuestChest', index: 0 }).ok).toBe(false);
  });
});

describe('profile', () => {
  it('renames within limits', () => {
    const s = newGame(1, T0);
    const r = run(s, { type: 'setName', name: '  Astrid  ' });
    expect(r.ok && r.state.profile.name).toBe('Astrid');
    expect(run(s, { type: 'setName', name: 'ab' }).ok).toBe(false);
  });

  it('has three free pictures and sells the rest for Gold', () => {
    const s = newGame(1, T0);
    expect(run(s, { type: 'setAvatar', avatar: 2 }).ok).toBe(true);
    expect(run(s, { type: 'setAvatar', avatar: 3 }).ok).toBe(false);
    const bought = run(s, { type: 'buyAvatar', avatar: 3 });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.resources.gold).toBe(s.resources.gold - AVATARS[3]!.cost);
    expect(bought.state.profile.avatar).toBe(3);
    s.resources.gold = 0;
    expect(run(s, { type: 'buyAvatar', avatar: 4 }).ok).toBe(false);
  });
});
