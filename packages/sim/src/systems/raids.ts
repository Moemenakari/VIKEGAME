import { BUILDINGS } from '../data/buildings';
import { PRODUCED_RESOURCES, type Cost } from '../data/resources';
import { RAIDS, RAID_VARIANTS, type RaidVariant } from '../data/raids';
import { MILITARY, SHIP_CREW, TROOPS, type TroopType } from '../data/troops';
import type { GameEvent } from '../events';
import { createRng, nextFloat, nextInt, type Rng } from '../rng';
import type { BattleReport, GameState, IncomingRaid, ReportLine } from '../state';
import { resolveBattle, type BattleOutcome, type Combatant, type StackResult } from './combat';
import { hallLevel } from './economy';
import { addCounts, armyStrength, homeStrength, sumCounts, woundedCapacity } from './military';

const unitStrength = (id: string) => armyStrength([{ ...TROOPS[id]!, count: 1 }]);

/** Strength of the walls, for sizing raids (a wall counts like the troops it holds back). */
export function wallStrength(state: GameState): number {
  let s = 0;
  for (const w of walls(state)) s += armyStrength([w]);
  return s;
}

/** The hold's walls as battle stacks: one stack per wall, hit first by raiders. */
function walls(state: GameState): Combatant[] {
  const out: Combatant[] = [];
  for (const b of Object.values(state.buildings)) {
    const w = BUILDINGS[b.type].wall;
    if (!w || b.level < 1) continue;
    const g = w.growth ** (b.level - 1);
    out.push({
      key: b.type,
      name: BUILDINGS[b.type].name,
      type: 'wall',
      count: 1,
      atk: Math.round(w.atk * 10 * g),
      def: Math.round(10 * g),
      hp: Math.round(w.hp * g),
    });
  }
  return out;
}

/** Resources the Jarl's House hides from raiders. */
export function protectedAmount(state: GameState): number {
  let total = 0;
  for (const b of Object.values(state.buildings)) {
    const p = BUILDINGS[b.type].protect;
    if (p && b.level > 0) for (let l = 1; l <= b.level; l++) total += p.perLevel * p.growth ** (l - 1);
  }
  return Math.floor(total);
}

/** Time between raids, stretched by the Envoys' House. */
function raidInterval(state: GameState): number {
  let peace = 0;
  for (const b of Object.values(state.buildings)) peace += (BUILDINGS[b.type].peacePerLevel ?? 0) * b.level;
  return Math.round(RAIDS.intervalMs * (1 + Math.min(1, peace)));
}

function pickVariant(number: number, rng: Rng): RaidVariant {
  const open = RAID_VARIANTS.filter((v) => v.fromRaid <= number);
  // Every third raid from the island's first appearance, the rival's island comes close.
  const island = open.find((v) => v.island);
  if (island && number >= island.fromRaid && (number - island.fromRaid) % 3 === 0) return island;
  const plain = open.filter((v) => !v.island);
  return plain[nextInt(rng, 0, plain.length - 1)]!;
}

/** Builds a raiding force sized against the hold's defences. Pure given the rng. */
export function planRaid(state: GameState, now: number, landsAt: number, practice: boolean): IncomingRaid {
  const rng = createRng(state.rngState);
  const number = state.raid.count;
  const variant = pickVariant(number, rng);
  const difficulty = Math.min(RAIDS.maxDifficulty, RAIDS.baseDifficulty + RAIDS.difficultyPerRaid * number);
  const defence = homeStrength(state.army.troops) + wallStrength(state);
  const budget =
    Math.max(RAIDS.minStrength, defence * difficulty) *
    (variant.island ? RAIDS.islandMultiplier : 1) *
    (0.92 + 0.16 * nextFloat(rng));
  const tier = Math.min(3, 1 + Math.floor(number / RAIDS.raidsPerTier));

  const crew: Record<string, number> = {};
  for (const [type, share] of Object.entries(variant.mix) as Array<[TroopType, number]>) {
    const id = `${type}-${tier}`;
    crew[id] = Math.max(1, Math.round((budget * share) / unitStrength(id)));
  }
  const shipId = `ship-${tier}`;
  const ships = { [shipId]: Math.max(1, Math.ceil(sumCounts(crew) / SHIP_CREW[tier - 1]!)) };
  state.rngState = rng.state;
  return { variant: variant.id, number, ships, crew, spottedAt: now, landsAt, practice };
}

const stacksOf = (counts: Record<string, number>): Combatant[] =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => {
      const t = TROOPS[id]!;
      return { key: id, name: t.name, type: t.type, count, atk: t.atk, def: t.def, hp: t.hp };
    });

const lines = (results: StackResult[], wounded: Record<string, number> = {}): ReportLine[] =>
  results.map((s) => ({
    unit: s.key,
    name: s.name,
    type: s.type,
    start: s.start,
    dead: s.start - s.alive - (wounded[s.key] ?? 0),
    wounded: wounded[s.key] ?? 0,
  }));

/** Takes the fallen out of the army: some wounded (if the healers have room), the rest dead. */
function bury(state: GameState, results: StackResult[]): Record<string, number> {
  let room = Math.max(
    0,
    woundedCapacity(state) - sumCounts(state.army.wounded) - sumCounts(state.healing?.troops ?? {}),
  );
  const wounded: Record<string, number> = {};
  for (const s of results) {
    if (s.type === 'wall') continue;
    const fallen = s.start - s.alive;
    if (fallen <= 0) continue;
    const hurt = s.type === 'ship' ? 0 : Math.min(room, Math.floor(fallen * MILITARY.woundedShare));
    room -= hurt;
    addCounts(state.army.troops, { [s.key]: fallen }, -1);
    if (hurt > 0) addCounts(state.army.wounded, { [s.key]: hurt });
    wounded[s.key] = hurt;
  }
  return wounded;
}

/**
 * The fleet lands. First the sea fight (your ships against theirs: a sunk ship
 * drowns its crew), then the land fight: the survivors must break your walls and
 * your warriors. Raiders who win carry off part of what is not hidden.
 */
export function resolveRaid(state: GameState, raid: IncomingRaid, now: number, events: GameEvent[]): void {
  const rng = createRng(state.rngState);
  const variant = RAID_VARIANTS.find((v) => v.id === raid.variant) ?? RAID_VARIANTS[0]!;
  const saga: string[] = [`${variant.name} came out of the sea mist with ${sumCounts(raid.ships)} ships.`];
  const defenderLines: ReportLine[] = [];
  const attackerLines: ReportLine[] = [];
  let crew = { ...raid.crew };

  // ---- at sea
  const ourShips = Object.fromEntries(
    Object.entries(state.army.troops).filter(([id, n]) => TROOPS[id]?.type === 'ship' && n > 0),
  );
  if (sumCounts(ourShips) > 0) {
    const sea = resolveBattle(stacksOf(ourShips), stacksOf(raid.ships), rng);
    const theirShips = sumCounts(raid.ships);
    const sunk = sea.defender.reduce((n, s) => n + (s.start - s.alive), 0);
    const drowned = theirShips ? sunk / theirShips : 0;
    crew = Object.fromEntries(Object.entries(crew).map(([id, n]) => [id, Math.round(n * (1 - drowned))]));
    defenderLines.push(...lines(sea.attacker));
    attackerLines.push(...lines(sea.defender));
    bury(state, sea.attacker);
    saga.push(
      sunk > 0
        ? `Your ships met them in the fjord and sent ${sunk} keel${sunk > 1 ? 's' : ''} to the bottom.`
        : 'Your ships met them in the fjord, but could not stop them.',
    );
  } else {
    saga.push('No ships of yours were on the water, and they beached unopposed.');
  }

  // ---- on land
  const landing = Object.fromEntries(Object.entries(crew).filter(([, n]) => n > 0));
  const homeTroops = Object.fromEntries(
    Object.entries(state.army.troops).filter(([id, n]) => TROOPS[id]?.type !== 'ship' && n > 0),
  );
  const wallStacks = walls(state);
  let land: BattleOutcome | null = null;
  let raidersWon: boolean;
  if (sumCounts(landing) === 0) {
    raidersWon = false;
    saga.push('Not one of them reached the shore alive.');
  } else if (wallStacks.length === 0 && sumCounts(homeTroops) === 0) {
    raidersWon = true;
    saga.push('There was no wall and no one to hold a shield. They walked into the hold.');
  } else {
    land = resolveBattle(stacksOf(landing), [...wallStacks, ...stacksOf(homeTroops)], rng);
    raidersWon = land.attackerWon;
    const wallsLeft = land.defender.filter((s) => s.type === 'wall' && s.alive > 0).length;
    if (wallStacks.length) {
      saga.push(
        wallsLeft
          ? 'They threw themselves at your wall, and the wall held.'
          : 'Rams and axes broke through your wall.',
      );
    }
    if (land.usedCounter.defender.shieldwall)
      saga.push('Your shieldwall locked, and the charge broke on it.');
    if (land.usedCounter.defender.archer) saga.push('Arrows fell on them from behind the stakes.');
    const wounded = bury(state, land.defender);
    defenderLines.push(
      ...lines(
        land.defender.filter((s) => s.type !== 'wall'),
        wounded,
      ),
    );
    attackerLines.push(...lines(land.attacker));
  }

  // ---- after
  const reward: Cost = {};
  const loot: Cost = {};
  if (raidersWon) {
    const hidden = protectedAmount(state);
    for (const r of PRODUCED_RESOURCES) {
      const take = Math.floor(Math.max(0, state.resources[r] - hidden) * RAIDS.lootShare);
      if (take > 0) {
        state.resources[r] -= take;
        loot[r] = take;
      }
    }
    saga.push('They carried off what they could find and rowed away laughing. They will be back.');
  } else {
    if (!raid.practice) {
      const strength = armyStrength(stacksOf(raid.crew));
      reward.silver = Math.round(strength * RAIDS.salvagePerStrength.silver);
      reward.timber = Math.round(strength * RAIDS.salvagePerStrength.timber);
      state.resources.silver += reward.silver;
      state.resources.timber += reward.timber;
    }
    saga.push('The raiders fled to their ships. Your hold stands, and the skalds will remember it.');
  }

  const report: BattleReport = {
    id: state.nextReportId++,
    at: now,
    kind: 'raid',
    level: raid.number + 1,
    title: `${raidersWon ? 'Raid lost' : 'Raid beaten'} · ${variant.name}`,
    won: !raidersWon,
    rounds: land?.rounds ?? 0,
    attacker: defenderLines,
    defender: attackerLines,
    saga,
    reward,
    loot,
    read: false,
  };
  state.rngState = rng.state;
  state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
  events.push({ type: 'raid.resolved', reportId: report.id, won: report.won });
  if (report.won) events.push({ type: 'battle.resolved', reportId: report.id, won: true, level: 0 });
}

/** Moves raids along: schedules the first one, lights the beacon, lands the fleet. */
export function advanceRaids(state: GameState, now: number, events: GameEvent[]): void {
  const raid = state.raid;
  if (raid.nextAt === null) {
    if (hallLevel(state) >= RAIDS.startHall) raid.nextAt = now + RAIDS.firstDelayMs;
    else if (!raid.incoming) return;
  }
  for (let guard = 0; guard < 3; guard++) {
    if (!raid.incoming && raid.nextAt !== null && now >= raid.nextAt - RAIDS.warningMs) {
      raid.incoming = planRaid(state, Math.min(now, raid.nextAt), raid.nextAt, false);
      events.push({ type: 'raid.spotted', landsAt: raid.nextAt });
    }
    const incoming = raid.incoming;
    if (!incoming || now < incoming.landsAt) return;
    raid.incoming = null;
    resolveRaid(state, incoming, incoming.landsAt, events);
    if (!incoming.practice) {
      raid.count++;
      raid.nextAt = incoming.landsAt + raidInterval(state);
    }
  }
}

/** The player lights the beacon and calls raiders to practise against (lands in a minute). */
export function callPracticeRaid(state: GameState, now: number): string | null {
  if (state.raid.incoming) return 'Raiders are already on their way';
  const landsAt = now + RAIDS.practiceDelayMs;
  state.raid.incoming = planRaid(state, now, landsAt, true);
  return null;
}
