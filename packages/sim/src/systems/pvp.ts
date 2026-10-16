import { BUILDINGS } from '../data/buildings';
import { PRODUCED_RESOURCES, type Cost } from '../data/resources';
import { MILITARY, TROOPS } from '../data/troops';
import type { GameEvent } from '../events';
import { createRng } from '../rng';
import type { BattleReport, GameState, ReportLine } from '../state';
import { resolveBattle, type Combatant } from './combat';
import { heroMods } from './heroes';
import { addCounts, sumCounts, woundedCapacity } from './military';
import { protectedAmount } from './raids';
import { killsOf, recordBattle } from './items';
import { BATTLE_DROPS } from '../data/items';

/**
 * Battles between players (asynchronous, like the genre): the attacker's game fights
 * the defender's last synced snapshot, the server checks the rules (realm, cooldown,
 * peace shield, loot cap) and the defender's game applies the result when it next syncs.
 */
export interface DefenceSnapshot {
  troops: Record<string, number>;
  walls: Array<{ key: string; name: string; atk: number; def: number; hp: number }>;
  heroes: GameState['heroes'];
  /** Resources raiders could carry off (what is not hidden in the Jarl's House). */
  lootable: Partial<Record<'food' | 'timber' | 'iron' | 'silver', number>>;
}

export const PVP = {
  /** Winners carry off this share of what the defender had open. */
  lootShare: 0.3,
} as const;

/** What other players fight when they attack you (sent with each sync, one write). */
export function defenceSnapshot(state: GameState): DefenceSnapshot {
  const walls: DefenceSnapshot['walls'] = [];
  for (const b of Object.values(state.buildings)) {
    const w = BUILDINGS[b.type].wall;
    if (!w || b.level < 1) continue;
    const g = w.growth ** (b.level - 1);
    walls.push({
      key: b.type,
      name: BUILDINGS[b.type].name,
      atk: Math.round(w.atk * 10 * g),
      def: Math.round(10 * g),
      hp: Math.round(w.hp * g),
    });
  }
  const hidden = protectedAmount(state);
  const lootable: DefenceSnapshot['lootable'] = {};
  for (const r of PRODUCED_RESOURCES) lootable[r] = Math.max(0, Math.floor(state.resources[r] - hidden));
  const troops = Object.fromEntries(
    Object.entries(state.army.troops).filter(([id, n]) => n > 0 && TROOPS[id] && TROOPS[id].type !== 'ship'),
  );
  return { troops, walls, heroes: state.heroes, lootable };
}

/** Cleans a snapshot that came from the server (another player's data: never trusted). */
export function cleanSnapshot(raw: unknown): DefenceSnapshot {
  const o = (typeof raw === 'object' && raw ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
  const troops: Record<string, number> = {};
  for (const [id, n] of Object.entries((o.troops ?? {}) as Record<string, unknown>))
    if (TROOPS[id] && TROOPS[id].type !== 'ship') troops[id] = num(n, 1_000_000);
  const walls = (Array.isArray(o.walls) ? o.walls : []).slice(0, 2).map((w: Record<string, unknown>) => ({
    key: String(w.key ?? 'wall').slice(0, 20),
    name: String(w.name ?? 'Wall').slice(0, 30),
    atk: num(w.atk, 100_000),
    def: num(w.def, 10_000),
    hp: num(w.hp, 10_000_000),
  }));
  const lootable: DefenceSnapshot['lootable'] = {};
  const l = (o.lootable ?? {}) as Record<string, unknown>;
  for (const r of PRODUCED_RESOURCES) lootable[r] = num(l[r], 1e12);
  const h = (o.heroes ?? {}) as Partial<GameState['heroes']>;
  const owned: GameState['heroes']['owned'] = {};
  for (const [id, v] of Object.entries(h.owned ?? {}))
    owned[id] = { level: num(v?.level, 150), stars: num(v?.stars, 5), dupes: 0 };
  const heroes: GameState['heroes'] = {
    owned,
    squad: (Array.isArray(h.squad) ? h.squad : [])
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 3),
    horns: 0,
    pity: { epic: 0, legendary: 0 },
  };
  return { troops, walls, heroes, lootable };
}

const stacks = (counts: Record<string, number>): Combatant[] =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => {
      const t = TROOPS[id]!;
      return { key: id, name: t.name, type: t.type, count, atk: t.atk, def: t.def, hp: t.hp };
    });

/** Takes the fallen out of an army; returns the lines for the report. */
function takeLosses(
  state: GameState,
  results: Array<{ key: string; name: string; type: ReportLine['type']; start: number; alive: number }>,
): ReportLine[] {
  let room = Math.max(
    0,
    woundedCapacity(state) - sumCounts(state.army.wounded) - sumCounts(state.healing?.troops ?? {}),
  );
  return results
    .filter((s) => s.type !== 'wall')
    .map((s) => {
      const fallen = Math.min(s.start - s.alive, state.army.troops[s.key] ?? 0);
      const hurt = Math.min(room, Math.floor(fallen * MILITARY.woundedShare));
      room -= hurt;
      if (fallen > 0) addCounts(state.army.troops, { [s.key]: fallen }, -1);
      if (hurt > 0) addCounts(state.army.wounded, { [s.key]: hurt });
      return { unit: s.key, name: s.name, type: s.type, start: s.start, dead: fallen - hurt, wounded: hurt };
    });
}

/** The attacker's side of a battle against another player's snapshot. */
export function fightPlayer(
  state: GameState,
  sent: Record<string, number>,
  target: { id: string; name: string; snapshot: DefenceSnapshot },
  now: number,
  events: GameEvent[],
): BattleReport {
  const rng = createRng(state.rngState);
  const ours = heroMods(state, 'conquest');
  const theirs = heroMods({ heroes: target.snapshot.heroes } as GameState, 'raid');
  const defenders: Combatant[] = [
    ...target.snapshot.walls.map((w) => ({ ...w, type: 'wall' as const, count: 1 })),
    ...stacks(target.snapshot.troops),
  ];
  const outcome = resolveBattle(stacks(sent), defenders, rng, {
    attacker: {
      attack: (t, r, l) => ours.ours.attack(t, r, l) * theirs.theirs.attack(t, r, l),
      taken: ours.ours.taken,
    },
    defender: {
      attack: (t, r, l) => theirs.ours.attack(t, r, l) * ours.theirs.attack(t, r, l),
      taken: theirs.ours.taken,
    },
  });
  const attacker = takeLosses(state, outcome.attacker);
  recordBattle(state, outcome.attackerWon, killsOf(outcome.defender), BATTLE_DROPS.pvpWon);
  const defenderLosses: Record<string, number> = {};
  for (const s of outcome.defender)
    if (s.type !== 'wall' && s.start > s.alive) defenderLosses[s.key] = s.start - s.alive;
  const loot: Cost = {};
  if (outcome.attackerWon) {
    for (const r of PRODUCED_RESOURCES) {
      const take = Math.floor((target.snapshot.lootable[r] ?? 0) * PVP.lootShare);
      if (take > 0) loot[r] = take;
    }
    for (const [r, n] of Object.entries(loot)) state.resources[r as keyof typeof loot] += n;
  }
  const report: BattleReport = {
    id: state.nextReportId++,
    at: now,
    kind: 'pvp',
    level: 0,
    title: `${outcome.attackerWon ? 'Victory' : 'Defeat'} · ${target.name}`,
    won: outcome.attackerWon,
    rounds: outcome.rounds,
    attacker,
    defender: outcome.defender.map((s) => ({
      unit: s.key,
      name: s.name,
      type: s.type,
      start: s.start,
      dead: s.start - s.alive,
      wounded: 0,
    })),
    saga: [
      `Your warriors sailed against the hold of ${target.name}.`,
      outcome.attackerWon
        ? 'Their wall fell, their warriors broke, and your crews rowed home low in the water with plunder.'
        : 'The defenders held, and your warriors fell back to the ships.',
    ],
    reward: loot,
    read: false,
  };
  state.rngState = rng.state;
  state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
  events.push({
    type: 'pvp.fought',
    targetId: target.id,
    won: report.won,
    defenderLosses,
    loot,
    reportId: report.id,
  });
  return report;
}

/** The defender's side: apply what an attacker did while you were away (collected from the server). */
export function sufferAttack(
  state: GameState,
  attack: {
    attackerName: string;
    attackerWon: boolean;
    losses: Record<string, number>;
    loot: Cost;
    at: number;
  },
  events: GameEvent[],
): void {
  const lines: ReportLine[] = [];
  let room = Math.max(
    0,
    woundedCapacity(state) - sumCounts(state.army.wounded) - sumCounts(state.healing?.troops ?? {}),
  );
  for (const [id, n] of Object.entries(attack.losses)) {
    const t = TROOPS[id];
    if (!t) continue;
    const fallen = Math.min(Math.max(0, Math.floor(n)), state.army.troops[id] ?? 0);
    const hurt = Math.min(room, Math.floor(fallen * MILITARY.woundedShare));
    room -= hurt;
    if (fallen > 0) addCounts(state.army.troops, { [id]: fallen }, -1);
    if (hurt > 0) addCounts(state.army.wounded, { [id]: hurt });
    lines.push({ unit: id, name: t.name, type: t.type, start: fallen, dead: fallen - hurt, wounded: hurt });
  }
  const loot: Cost = {};
  for (const r of PRODUCED_RESOURCES) {
    const take = Math.min(Math.max(0, Math.floor(attack.loot[r] ?? 0)), Math.floor(state.resources[r]));
    if (take > 0) {
      state.resources[r] -= take;
      loot[r] = take;
    }
  }
  const report: BattleReport = {
    id: state.nextReportId++,
    at: attack.at,
    kind: 'pvp',
    level: 0,
    title: `${attack.attackerWon ? 'Hold raided' : 'Attack beaten'} · ${attack.attackerName}`,
    won: !attack.attackerWon,
    rounds: 0,
    attacker: lines,
    defender: [],
    saga: [
      `${attack.attackerName} came against your hold while you were away.`,
      attack.attackerWon
        ? 'They broke through and carried off what they found.'
        : 'Your wall and your warriors held them off.',
    ],
    reward: {},
    loot,
    read: false,
  };
  state.reports = [report, ...state.reports].slice(0, MILITARY.maxReports);
  events.push({ type: 'raid.resolved', reportId: report.id, won: report.won });
}
