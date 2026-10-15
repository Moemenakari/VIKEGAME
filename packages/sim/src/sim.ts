import { BUILDINGS, type BuildingType } from './data/buildings';
import { ECONOMY } from './data/economy';
import { HALL_PLOT_ID } from './data/plots';
import { placementError } from './systems/placement';
import { advanceRaids, callPracticeRaid } from './systems/raids';
import { ALLIANCES, WORLD } from './data/world';
import { bordersHold, realmMap, tileAt, tileGarrison, tileKey, tileLimit, tileOwner } from './systems/world';
import type { Cost } from './data/resources';
import { DAILY_QUESTS } from './data/quests';
import { AVATARS, DAILY_CHESTS, MAIN_QUESTS } from './data/mainQuests';
import { activityPoints, mainGoalDone } from './systems/goals';
import { DRAUGR_BANDS, DRAUGR_UNITS } from './data/draugr';
import { MILITARY, TRAINED_AT, TROOPS } from './data/troops';
import { createRng } from './rng';
import { PRODUCED_RESOURCES, RESOURCE_NAMES, type ProducedResourceId } from './data/resources';
import type { GameEvent } from './events';
import type { BattleReport, ConstructionJob, GameState, ReportLine } from './state';
import { resolveBattle, type Combatant } from './systems/combat';
import {
  addCounts,
  batchLimit,
  healCost,
  healDurationMs,
  sumCounts,
  trainCost,
  trainDurationMs,
  woundedCapacity,
} from './systems/military';
import { writeSaga } from './systems/saga';
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
  | { type: 'build'; building: BuildingType; x: number; z: number; rot?: number }
  | { type: 'move'; buildingId: string; x: number; z: number; rot?: number }
  | { type: 'callRaid' }
  | { type: 'joinAlliance'; alliance: number | null }
  | { type: 'conquerTile'; x: number; y: number; troops: Record<string, number> }
  | { type: 'upgrade'; buildingId: string }
  | { type: 'finishFree'; buildingId: string; queue?: TimerKind }
  | { type: 'finishWithGold'; buildingId: string; queue?: TimerKind }
  | { type: 'claimQuest'; questId: string }
  | { type: 'train'; buildingId: string; troopId: string; count: number }
  | { type: 'heal' }
  | { type: 'attackDraugr'; level: number; troops: Record<string, number> }
  | { type: 'readReport'; reportId: number }
  | { type: 'claimMainQuest' }
  | { type: 'claimQuestChest'; index: number }
  | { type: 'setName'; name: string }
  | { type: 'setAvatar'; avatar: number }
  | { type: 'buyAvatar'; avatar: number };

/** Which timer a finish command targets: a construction, a training batch, or healing. */
export type TimerKind = 'build' | 'train' | 'heal';

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

function completeTraining(state: GameState, job: GameState['training'][number], events: GameEvent[]): void {
  state.training = state.training.filter((j) => j !== job);
  addCounts(state.army.troops, { [job.troopId]: job.count });
  events.push({
    type: 'training.completed',
    buildingId: job.buildingId,
    troopId: job.troopId,
    count: job.count,
  });
}

function completeHealing(state: GameState, events: GameEvent[]): void {
  const job = state.healing;
  if (!job) return;
  state.healing = null;
  addCounts(state.army.troops, job.troops);
  events.push({ type: 'healing.completed', count: sumCounts(job.troops) });
}

/** Finds a running timer and how to complete it. */
function findTimer(
  state: GameState,
  kind: TimerKind,
  buildingId: string,
): { endsAt: number; complete: (events: GameEvent[]) => void } | null {
  if (kind === 'heal') {
    return state.healing
      ? { endsAt: state.healing.endsAt, complete: (e) => completeHealing(state, e) }
      : null;
  }
  if (kind === 'train') {
    const job = state.training.find((j) => j.buildingId === buildingId);
    return job ? { endsAt: job.endsAt, complete: (e) => completeTraining(state, job, e) } : null;
  }
  const job = state.queue.find((j) => j.buildingId === buildingId);
  return job ? { endsAt: job.endsAt, complete: (e) => completeJob(state, job, e) } : null;
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

  for (const job of state.training.filter((j) => j.endsAt <= now)) completeTraining(state, job, events);
  if (state.healing && state.healing.endsAt <= now) completeHealing(state, events);
  advanceRaids(state, now, events);

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
    endsAt: now + upgradeDurationMs(type, targetLevel, state),
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
    const def = BUILDINGS[cmd.building];
    if (!def || cmd.building === 'greatHall') return fail('UNKNOWN', 'You cannot build that here');
    if (hallLevel(state) < def.unlockHall)
      return fail('LOCKED', `${def.name} unlocks at Great Hall ${def.unlockHall}`);
    if (countOfType(state, cmd.building) >= def.maxCount) {
      return fail('LIMIT', `Your hold can have ${def.maxCount} × ${def.name}`);
    }
    const where = placementError(state, cmd.building, cmd.x, cmd.z);
    if (where) return fail('OCCUPIED', where);
    const err = checkBuilderAndCost(state, cmd.building, 1);
    if (err) return err;
    pay(state.resources, upgradeCost(cmd.building, 1));
    const id = `b${state.nextBuildingId++}`;
    state.buildings[id] = {
      id,
      type: cmd.building,
      level: 0,
      x: cmd.x,
      z: cmd.z,
      rot: cmd.rot ?? Math.atan2(-cmd.x, -cmd.z),
    };
    startJob(state, id, cmd.building, 1, now, events);
    return null;
  },

  move(state, cmd) {
    const b = state.buildings[cmd.buildingId];
    if (!b) return fail('UNKNOWN', 'No building there');
    if (b.id === HALL_PLOT_ID) return fail('LOCKED', 'The Great Hall stays at the heart of the hold');
    const where = placementError(state, b.type, cmd.x, cmd.z, b.id);
    if (where) return fail('OCCUPIED', where);
    b.x = cmd.x;
    b.z = cmd.z;
    if (cmd.rot !== undefined) b.rot = cmd.rot;
    return null;
  },

  joinAlliance(state, cmd) {
    if (cmd.alliance !== null && !ALLIANCES[cmd.alliance]) return fail('UNKNOWN', 'No such alliance');
    state.world.alliance = cmd.alliance;
    return null;
  },

  conquerTile(state, cmd, now, events) {
    const map = realmMap(state.world.realm);
    const tile = tileAt(map, cmd.x, cmd.y);
    if (!tile || tile.kind === 'sea') return fail('UNKNOWN', 'You cannot march there');
    if (tile.kind === 'capital') return fail('LOCKED', "The Law Rock is won only in the King's War");
    if (tile.kind === 'fort') return fail('LOCKED', 'A ring fort falls only to a whole alliance');
    const owner = tileOwner(state, tile);
    if (owner === -1) return fail('OCCUPIED', 'This land is already yours');
    if (owner !== null && owner === state.world.alliance)
      return fail('LOCKED', 'This land belongs to your alliance');
    if (!bordersHold(state, tile.x, tile.y)) return fail('LOCKED', 'You can only take land next to your own');
    if (state.world.owned.length + 1 >= tileLimit(hallLevel(state)))
      return fail('LIMIT', 'Upgrade the Great Hall to hold more land');
    const sent: Record<string, number> = {};
    for (const [id, n] of Object.entries(cmd.troops)) {
      const count = Math.floor(n);
      if (count <= 0) continue;
      if (!TROOPS[id] || TROOPS[id].type === 'ship' || (state.army.troops[id] ?? 0) < count)
        return fail('NOT_ENOUGH', 'Not enough troops at home');
      sent[id] = count;
    }
    if (sumCounts(sent) === 0) return fail('NOT_READY', 'Choose warriors to send');

    const rng = createRng(state.rngState);
    const garrison = tileGarrison(tile, owner);
    const attackers: Combatant[] = Object.entries(sent).map(([id, count]) => {
      const t = TROOPS[id]!;
      return { key: id, name: t.name, type: t.type, count, atk: t.atk, def: t.def, hp: t.hp };
    });
    const outcome = resolveBattle(attackers, garrison, rng);
    let room = Math.max(
      0,
      woundedCapacity(state) - sumCounts(state.army.wounded) - sumCounts(state.healing?.troops ?? {}),
    );
    const attackerLines: ReportLine[] = [];
    for (const s of outcome.attacker) {
      const fallen = s.start - s.alive;
      const hurt = Math.min(room, Math.floor(fallen * MILITARY.woundedShare));
      room -= hurt;
      addCounts(state.army.troops, { [s.key]: fallen }, -1);
      if (hurt > 0) addCounts(state.army.wounded, { [s.key]: hurt });
      attackerLines.push({
        unit: s.key,
        name: s.name,
        type: s.type,
        start: s.start,
        dead: fallen - hurt,
        wounded: hurt,
      });
    }
    const reward: Cost = {};
    if (outcome.attackerWon) {
      state.world.owned.push(tileKey(tile.x, tile.y));
      for (const [r, v] of Object.entries(WORLD.conquestReward)) reward[r as keyof Cost] = v * tile.level;
      grant(state.resources, reward);
    }
    const where = `${tile.region} (${tile.x}, ${tile.y})`;
    const report: BattleReport = {
      id: state.nextReportId++,
      at: now,
      kind: 'conquest',
      level: tile.level,
      title: `${outcome.attackerWon ? 'Land taken' : 'Driven back'} · ${where}`,
      won: outcome.attackerWon,
      rounds: outcome.rounds,
      attacker: attackerLines,
      defender: outcome.defender.map((s) => ({
        unit: s.key,
        name: s.name,
        type: s.type,
        start: s.start,
        dead: s.start - s.alive,
        wounded: 0,
      })),
      saga: [
        owner === null
          ? `Your warriors marched on free land in ${tile.region}, where the local karls stood to meet them.`
          : `Your warriors marched on land held by the ${ALLIANCES[owner]!.name} in ${tile.region}.`,
        outcome.attackerWon
          ? 'When the fighting was done, your banner stood on the hill, and the land was yours.'
          : 'The defenders held, and your warriors fell back to the hold.',
      ],
      reward,
      read: false,
    };
    state.rngState = rng.state;
    state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
    events.push({ type: 'battle.resolved', reportId: report.id, won: report.won, level: tile.level });
    return null;
  },

  callRaid(state, _cmd, now) {
    const err = callPracticeRaid(state, now);
    return err ? fail('BUSY', err) : null;
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
    const timer = findTimer(state, cmd.queue ?? 'build', cmd.buildingId);
    if (!timer) return fail('UNKNOWN', 'Nothing is running there');
    if (timer.endsAt - now > ECONOMY.freeFinishMs) {
      return fail('NOT_READY', 'Free finish unlocks in the last 5 minutes');
    }
    timer.complete(events);
    events.push({ type: 'finish.free', buildingId: cmd.buildingId });
    return null;
  },

  finishWithGold(state, cmd, now, events) {
    const timer = findTimer(state, cmd.queue ?? 'build', cmd.buildingId);
    if (!timer) return fail('UNKNOWN', 'Nothing is running there');
    const gold = goldToFinish(timer.endsAt - now);
    if (state.resources.gold < gold) return fail('NOT_ENOUGH', 'Not enough Gold');
    state.resources.gold -= gold;
    timer.complete(events);
    events.push({ type: 'finish.gold', buildingId: cmd.buildingId, gold });
    return null;
  },

  train(state, cmd, now, events) {
    const b = state.buildings[cmd.buildingId];
    const troop = TROOPS[cmd.troopId];
    if (!b || !troop || TRAINED_AT[troop.type] !== b.type)
      return fail('UNKNOWN', 'That cannot be trained here');
    if (b.level < 1) return fail('NOT_READY', `${BUILDINGS[b.type].name} is still being raised`);
    if (b.level < troop.unlockLevel) {
      return fail('LOCKED', `${troop.name} needs ${BUILDINGS[b.type].name} level ${troop.unlockLevel}`);
    }
    if (state.training.some((j) => j.buildingId === b.id)) return fail('BUSY', 'Already training a batch');
    const count = Math.floor(cmd.count);
    if (!(count >= 1)) return fail('UNKNOWN', 'Choose how many to train');
    const limit = batchLimit(b.level);
    if (count > limit) return fail('LIMIT', `At most ${limit} per batch at this level`);
    const cost = trainCost(troop.id, count);
    const missing = canAfford(state.resources, cost);
    if (missing) return fail('NOT_ENOUGH', `Not enough ${RESOURCE_NAMES[missing]}`);
    pay(state.resources, cost);
    state.training.push({
      buildingId: b.id,
      troopId: troop.id,
      count,
      startedAt: now,
      endsAt: now + trainDurationMs(troop.id, count),
    });
    events.push({ type: 'training.started', buildingId: b.id, troopId: troop.id, count });
    return null;
  },

  heal(state, _cmd, now, events) {
    if (state.healing) return fail('BUSY', 'The healers are already at work');
    const count = sumCounts(state.army.wounded);
    if (count === 0) return fail('NOT_READY', 'No one is wounded');
    const cost = healCost(state.army.wounded);
    const missing = canAfford(state.resources, cost);
    if (missing) return fail('NOT_ENOUGH', `Not enough ${RESOURCE_NAMES[missing]}`);
    pay(state.resources, cost);
    state.healing = {
      troops: { ...state.army.wounded },
      startedAt: now,
      endsAt: now + healDurationMs(state.army.wounded),
    };
    state.army.wounded = {};
    events.push({ type: 'healing.started', count });
    return null;
  },

  attackDraugr(state, cmd, now, events) {
    const band = DRAUGR_BANDS.find((d) => d.level === cmd.level);
    if (!band) return fail('UNKNOWN', 'No such barrow');
    if (band.level > state.pve.draugrCleared + 1) {
      return fail('LOCKED', `Defeat level ${state.pve.draugrCleared + 1} first`);
    }
    const sent: Record<string, number> = {};
    for (const [id, n] of Object.entries(cmd.troops)) {
      const count = Math.floor(n);
      if (count <= 0) continue;
      if (!TROOPS[id] || TROOPS[id].type === 'ship' || (state.army.troops[id] ?? 0) < count)
        return fail('NOT_ENOUGH', 'Not enough troops at home');
      sent[id] = count;
    }
    if (sumCounts(sent) === 0) return fail('NOT_READY', 'Choose warriors to send');

    const rng = createRng(state.rngState);
    const attackers: Combatant[] = Object.entries(sent).map(([id, count]) => {
      const t = TROOPS[id]!;
      return { key: id, name: t.name, type: t.type, count, atk: t.atk, def: t.def, hp: t.hp };
    });
    const defenders: Combatant[] = Object.entries(band.units).map(([id, count]) => {
      const u = DRAUGR_UNITS[id]!;
      return { key: id, name: u.name, type: u.type, count, atk: u.atk, def: u.def, hp: u.hp };
    });
    const outcome = resolveBattle(attackers, defenders, rng);

    // The fallen: some are wounded if the healers have room, the rest are dead.
    let room = Math.max(
      0,
      woundedCapacity(state) - sumCounts(state.army.wounded) - sumCounts(state.healing?.troops ?? {}),
    );
    const attackerLines: ReportLine[] = [];
    let dead = 0;
    let wounded = 0;
    for (const s of outcome.attacker) {
      const fallen = s.start - s.alive;
      const hurt = Math.min(room, Math.floor(fallen * MILITARY.woundedShare));
      room -= hurt;
      addCounts(state.army.troops, { [s.key]: fallen }, -1);
      if (hurt > 0) addCounts(state.army.wounded, { [s.key]: hurt });
      dead += fallen - hurt;
      wounded += hurt;
      attackerLines.push({
        unit: s.key,
        name: s.name,
        type: s.type,
        start: s.start,
        dead: fallen - hurt,
        wounded: hurt,
      });
    }

    const reward = outcome.attackerWon ? { ...band.reward } : {};
    if (outcome.attackerWon) {
      grant(state.resources, reward);
      if (band.level > state.pve.draugrCleared) {
        grant(state.resources, band.firstClearReward);
        for (const [r, n] of Object.entries(band.firstClearReward)) {
          reward[r as keyof typeof reward] = (reward[r as keyof typeof reward] ?? 0) + n;
        }
        state.pve.draugrCleared = band.level;
      }
    }

    const report: BattleReport = {
      id: state.nextReportId++,
      at: now,
      kind: 'draugr',
      level: band.level,
      title: `${outcome.attackerWon ? 'Victory' : 'Defeat'} at the Barrow · ${band.name}`,
      won: outcome.attackerWon,
      rounds: outcome.rounds,
      attacker: attackerLines,
      defender: outcome.defender.map((s) => ({
        unit: s.key,
        name: s.name,
        type: s.type,
        start: s.start,
        dead: s.start - s.alive,
        wounded: 0,
      })),
      saga: writeSaga(outcome, band.name, { dead, wounded }, reward, rng),
      reward,
      read: false,
    };
    state.rngState = rng.state;
    state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
    events.push({ type: 'battle.resolved', reportId: report.id, won: report.won, level: band.level });
    return null;
  },

  readReport(state, cmd) {
    const report = state.reports.find((r) => r.id === cmd.reportId);
    if (!report) return fail('UNKNOWN', 'No such report');
    report.read = true;
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

  claimMainQuest(state, _cmd, _now, events) {
    const quest = MAIN_QUESTS[state.mainQuest];
    if (!quest) return fail('NOT_READY', 'All main quests are done');
    if (!mainGoalDone(state, quest.goal)) return fail('NOT_READY', 'Quest not finished yet');
    grant(state.resources, quest.reward);
    state.mainQuest++;
    events.push({ type: 'quest.claimed', questId: quest.id, reward: quest.reward });
    return null;
  },

  claimQuestChest(state, cmd, _now, events) {
    const chest = DAILY_CHESTS[cmd.index];
    if (!chest) return fail('UNKNOWN', 'No such chest');
    if (state.quests.chests.includes(cmd.index)) return fail('NOT_READY', 'Already claimed');
    if (activityPoints(state) < chest.points) return fail('NOT_READY', 'Quest not finished yet');
    grant(state.resources, chest.reward);
    state.quests.chests.push(cmd.index);
    events.push({ type: 'quest.claimed', questId: `chest-${cmd.index}`, reward: chest.reward });
    return null;
  },

  setName(state, cmd) {
    const name = cmd.name.trim();
    if (name.length < 3 || name.length > 16) return fail('UNKNOWN', 'Names are 3 to 16 letters');
    state.profile.name = name;
    return null;
  },

  setAvatar(state, cmd) {
    if (!state.profile.owned.includes(cmd.avatar)) return fail('LOCKED', 'Unlock this picture first');
    state.profile.avatar = cmd.avatar;
    return null;
  },

  buyAvatar(state, cmd) {
    const a = AVATARS.find((x) => x.id === cmd.avatar);
    if (!a) return fail('UNKNOWN', 'No such picture');
    if (state.profile.owned.includes(a.id)) return fail('NOT_READY', 'Already claimed');
    if (state.resources.gold < a.cost) return fail('NOT_ENOUGH', 'Not enough Gold');
    state.resources.gold -= a.cost;
    state.profile.owned.push(a.id);
    state.profile.avatar = a.id;
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
