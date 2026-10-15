import { BUILDINGS, type BuildingType } from './data/buildings';
import { ECONOMY } from './data/economy';
import { HALL_PLOT_ID, PLOTS } from './data/plots';
import { DAILY_QUESTS } from './data/quests';
import { PRODUCED_RESOURCES, RESOURCE_NAMES, type ProducedResourceId } from './data/resources';
import type { GameEvent } from './events';
import type { ConstructionJob, GameState } from './state';
import {
  builderSlots,
  canAfford,
  countOfType,
  goldToFinish,
  grant,
  hallLevel,
  maxLevelOfType,
  pay,
  productionPerHour,
  storageCap,
  upgradeCost,
  upgradeDurationMs,
} from './systems/economy';
import { rollQuestDay, trackQuests } from './systems/quests';

/** Every player action is one of these plain, serialisable commands (ARCHITECTURE §3). */
export type Command =
  | { type: 'build'; plotId: string; building: BuildingType }
  | { type: 'upgrade'; buildingId: string }
  | { type: 'finishFree'; buildingId: string }
  | { type: 'finishWithGold'; buildingId: string }
  | { type: 'claimQuest'; questId: string };

export type RuleErrorCode =
  | 'UNKNOWN'
  | 'LOCKED'
  | 'OCCUPIED'
  | 'LIMIT'
  | 'NO_BUILDER'
  | 'NOT_ENOUGH'
  | 'BUSY'
  | 'MAX_LEVEL'
  | 'REQUIREMENT'
  | 'NOT_READY';

export interface RuleError {
  code: RuleErrorCode;
  message: string;
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export type ApplyResult = ({ ok: true } & StepResult) | { ok: false; error: RuleError };

const fail = (code: RuleErrorCode, message: string): RuleError => ({ code, message });

// ---- time ------------------------------------------------------------------

function produce(state: GameState, ms: number, produced: Partial<Record<ProducedResourceId, number>>): void {
  if (ms <= 0) return;
  const rates = productionPerHour(state);
  const caps = storageCap(state);
  for (const r of PRODUCED_RESOURCES) {
    const current = state.resources[r];
    if (rates[r] <= 0 || current >= caps[r]) continue;
    const next = Math.min(caps[r], current + (rates[r] * ms) / 3_600_000);
    state.resources[r] = next;
    produced[r] = (produced[r] ?? 0) + (next - current);
  }
}

function completeJob(state: GameState, job: ConstructionJob, events: GameEvent[]): void {
  const building = state.buildings[job.buildingId];
  state.queue = state.queue.filter((j) => j !== job);
  if (!building) return;
  building.level = job.targetLevel;
  events.push({
    type: 'building.completed',
    buildingId: building.id,
    building: building.type,
    level: building.level,
  });
}

/**
 * Moves the world forward to `now`: finishes due constructions in the order they
 * end, and accrues production between them (so an upgrade that finished 3 hours
 * ago produces at its new rate from that moment). Production while away is
 * capped at ECONOMY.offlineCapMs.
 */
function advanceInPlace(state: GameState, now: number, events: GameEvent[]): void {
  rollQuestDay(state, now, events);
  const start = state.lastTick;
  if (now <= start) return; // clock went backwards or no time passed: nothing to do

  const elapsed = now - start;
  const scale = Math.min(1, ECONOMY.offlineCapMs / elapsed);
  const produced: Partial<Record<ProducedResourceId, number>> = {};

  const due = state.queue
    .filter((j) => j.endsAt <= now)
    .sort((a, b) => a.endsAt - b.endsAt || a.buildingId.localeCompare(b.buildingId));
  let t = start;
  for (const job of due) {
    const at = Math.max(t, job.endsAt);
    produce(state, (at - t) * scale, produced);
    t = at;
    completeJob(state, job, events);
  }
  produce(state, (now - t) * scale, produced);
  state.lastTick = now;

  if (Object.values(produced).some((v) => v > 0)) {
    events.push({ type: 'resources.produced', amounts: produced });
  }
}

/** Pure: returns a new state advanced to `now`, plus what happened on the way. */
export function advance(prev: GameState, now: number): StepResult {
  const state = structuredClone(prev);
  const events: GameEvent[] = [];
  advanceInPlace(state, now, events);
  trackQuests(state, events);
  return { state, events };
}

// ---- commands --------------------------------------------------------------

function startJob(
  state: GameState,
  buildingId: string,
  type: BuildingType,
  targetLevel: number,
  now: number,
  events: GameEvent[],
) {
  state.queue.push({
    buildingId,
    targetLevel,
    startedAt: now,
    endsAt: now + upgradeDurationMs(type, targetLevel),
  });
  events.push({ type: 'construction.started', buildingId, building: type, targetLevel });
}

function checkBuilderAndCost(state: GameState, type: BuildingType, targetLevel: number): RuleError | null {
  if (state.queue.length >= builderSlots(state)) return fail('NO_BUILDER', 'All builders are busy');
  const cost = upgradeCost(type, targetLevel);
  const missing = canAfford(state.resources, cost);
  if (missing) return fail('NOT_ENOUGH', `Not enough ${RESOURCE_NAMES[missing]}`);
  return null;
}

type Handler<C extends Command> = (
  state: GameState,
  cmd: C,
  now: number,
  events: GameEvent[],
) => RuleError | null;

const handlers: { [K in Command['type']]: Handler<Extract<Command, { type: K }>> } = {
  build(state, cmd, now, events) {
    const plot = PLOTS.find((p) => p.id === cmd.plotId);
    const def = BUILDINGS[cmd.building];
    if (!plot || !def || cmd.building === 'greatHall') return fail('UNKNOWN', 'You cannot build that here');
    if (hallLevel(state) < plot.unlockHall)
      return fail('LOCKED', `This plot opens at Great Hall ${plot.unlockHall}`);
    if (state.buildings[plot.id]) return fail('OCCUPIED', 'This plot is already in use');
    if (hallLevel(state) < def.unlockHall)
      return fail('LOCKED', `${def.name} unlocks at Great Hall ${def.unlockHall}`);
    if (countOfType(state, cmd.building) >= def.maxCount) {
      return fail('LIMIT', `Your hold can have ${def.maxCount} × ${def.name}`);
    }
    const err = checkBuilderAndCost(state, cmd.building, 1);
    if (err) return err;
    pay(state.resources, upgradeCost(cmd.building, 1));
    state.buildings[plot.id] = { id: plot.id, type: cmd.building, level: 0 };
    startJob(state, plot.id, cmd.building, 1, now, events);
    return null;
  },

  upgrade(state, cmd, now, events) {
    const b = state.buildings[cmd.buildingId];
    if (!b) return fail('UNKNOWN', 'No building there');
    if (state.queue.some((j) => j.buildingId === b.id)) return fail('BUSY', 'Already under construction');
    const target = b.level + 1;
    if (target > ECONOMY.maxBuildingLevel) return fail('MAX_LEVEL', 'Already at the highest level');
    const def = BUILDINGS[b.type];
    if (b.id !== HALL_PLOT_ID && target > hallLevel(state)) {
      return fail('REQUIREMENT', `Upgrade the Great Hall to level ${target} first`);
    }
    for (const req of def.requires ?? []) {
      const needed = target + req.levelOffset;
      if (target >= req.fromLevel && maxLevelOfType(state, req.type) < needed) {
        return fail('REQUIREMENT', `Needs ${BUILDINGS[req.type].name} level ${needed}`);
      }
    }
    const err = checkBuilderAndCost(state, b.type, target);
    if (err) return err;
    pay(state.resources, upgradeCost(b.type, target));
    startJob(state, b.id, b.type, target, now, events);
    return null;
  },

  finishFree(state, cmd, now, events) {
    const job = state.queue.find((j) => j.buildingId === cmd.buildingId);
    if (!job) return fail('UNKNOWN', 'Nothing is being built there');
    if (job.endsAt - now > ECONOMY.freeFinishMs)
      return fail('NOT_READY', 'Free finish unlocks in the last 5 minutes');
    completeJob(state, job, events);
    events.push({ type: 'finish.free', buildingId: cmd.buildingId });
    return null;
  },

  finishWithGold(state, cmd, now, events) {
    const job = state.queue.find((j) => j.buildingId === cmd.buildingId);
    if (!job) return fail('UNKNOWN', 'Nothing is being built there');
    const gold = goldToFinish(job.endsAt - now);
    if (state.resources.gold < gold) return fail('NOT_ENOUGH', 'Not enough Gold');
    state.resources.gold -= gold;
    completeJob(state, job, events);
    events.push({ type: 'finish.gold', buildingId: cmd.buildingId, gold });
    return null;
  },

  claimQuest(state, cmd, _now, events) {
    const quest = DAILY_QUESTS.find((q) => q.id === cmd.questId);
    if (!quest) return fail('UNKNOWN', 'Unknown quest');
    if (state.quests.claimed.includes(quest.id)) return fail('NOT_READY', 'Already claimed');
    if ((state.quests.progress[quest.id] ?? 0) < quest.target)
      return fail('NOT_READY', 'Quest not finished yet');
    grant(state.resources, quest.reward);
    state.quests.claimed.push(quest.id);
    events.push({ type: 'quest.claimed', questId: quest.id, reward: quest.reward });
    return null;
  },
};

/**
 * Pure: advances to `now`, validates the command and applies it.
 * On a rule error nothing changes and the reason is returned for the UI.
 */
export function apply(prev: GameState, cmd: Command, now: number): ApplyResult {
  const state = structuredClone(prev);
  const events: GameEvent[] = [];
  advanceInPlace(state, now, events);
  const handler = handlers[cmd.type] as Handler<Command> | undefined;
  if (!handler) return { ok: false, error: fail('UNKNOWN', 'Unknown command') };
  const error = handler(state, cmd, now, events);
  if (error) return { ok: false, error };
  trackQuests(state, events);
  return { ok: true, state, events };
}

/** Time left on a building's construction, or null if it is not being built. */
export function remainingMs(state: GameState, buildingId: string, now: number): number | null {
  const job = state.queue.find((j) => j.buildingId === buildingId);
  return job ? Math.max(0, job.endsAt - now) : null;
}
