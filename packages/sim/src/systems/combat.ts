import { COUNTERS, MILITARY, TROOP_TYPES, type TroopType, type UnitType } from '../data/troops';
import { nextFloat, type Rng } from '../rng';

/** A stack of identical fighters on one side of a battle. */
export interface Combatant {
  key: string;
  name: string;
  type: UnitType;
  count: number;
  atk: number;
  def: number;
  hp: number;
}

export interface StackResult {
  key: string;
  name: string;
  type: UnitType;
  start: number;
  alive: number;
}

export interface RoundLog {
  round: number;
  /** Damage dealt by each side this round. */
  attackerDamage: number;
  defenderDamage: number;
}

export interface BattleOutcome {
  attackerWon: boolean;
  rounds: number;
  attacker: StackResult[];
  defender: StackResult[];
  log: RoundLog[];
  /** Did the side ever strike the type it counters? Used by the saga writer. */
  usedCounter: {
    attacker: Partial<Record<UnitType, boolean>>;
    defender: Partial<Record<UnitType, boolean>>;
  };
}

interface Live extends Combatant {
  pool: number;
}

const alive = (s: Live) => (s.pool <= 0 ? 0 : Math.ceil(s.pool / s.hp - 1e-9));

/**
 * Who is hit when no countered type is standing: the wall first (raiders must break
 * through it), then the front line, with siege engines and archers at the back.
 */
const FRONT: readonly UnitType[] = [
  'wall',
  'shieldwall',
  'bear',
  'berserker',
  'cavalry',
  'archer',
  'siege',
  'ship',
];

function pickTarget(attackerType: UnitType, enemies: Live[]): { target: Live; counter: boolean } | null {
  for (const wanted of COUNTERS[attackerType]) {
    const countered = enemies.find((e) => e.type === wanted && alive(e) > 0);
    if (countered) return { target: countered, counter: true };
  }
  for (const type of FRONT) {
    const t = enemies.find((e) => e.type === type && alive(e) > 0);
    if (t) return { target: t, counter: false };
  }
  return null;
}

/**
 * Deterministic battle: up to MILITARY.maxRounds rounds. In each round every
 * stack on both sides strikes at the same moment (damage is based on who was
 * standing when the round began), so no side gets a free first blow and the
 * counter triangle decides. The attacker wins only by leaving no defender standing.
 */
export function resolveBattle(attackers: Combatant[], defenders: Combatant[], rng: Rng): BattleOutcome {
  const A: Live[] = attackers.filter((c) => c.count > 0).map((c) => ({ ...c, pool: c.count * c.hp }));
  const D: Live[] = defenders.filter((c) => c.count > 0).map((c) => ({ ...c, pool: c.count * c.hp }));
  const startA = A.map(alive);
  const startD = D.map(alive);
  const log: RoundLog[] = [];
  const usedCounter: BattleOutcome['usedCounter'] = { attacker: {}, defender: {} };
  const standing = (side: Live[]) => side.some((s) => alive(s) > 0);

  let round = 0;
  while (round < MILITARY.maxRounds && standing(A) && standing(D)) {
    round++;
    const entry: RoundLog = { round, attackerDamage: 0, defenderDamage: 0 };
    const hits: Array<{ target: Live; damage: number }> = [];
    for (const [side, enemies, key] of [
      [A, D, 'attacker'],
      [D, A, 'defender'],
    ] as const) {
      for (const stack of side) {
        const n = alive(stack);
        if (n === 0) continue;
        const pick = pickTarget(stack.type, enemies);
        if (!pick) continue;
        const spread = 1 + MILITARY.variance * (2 * nextFloat(rng) - 1);
        const counter = !pick.counter
          ? 1
          : pick.target.type === 'wall'
            ? MILITARY.siegeWallBonus
            : MILITARY.counterBonus;
        const soften = MILITARY.defenceK / (MILITARY.defenceK + pick.target.def);
        const damage = n * stack.atk * counter * spread * soften;
        hits.push({ target: pick.target, damage });
        if (pick.counter) usedCounter[key][stack.type] = true;
        if (key === 'attacker') entry.attackerDamage += damage;
        else entry.defenderDamage += damage;
      }
    }
    for (const h of hits) h.target.pool -= h.damage;
    log.push({
      round,
      attackerDamage: Math.round(entry.attackerDamage),
      defenderDamage: Math.round(entry.defenderDamage),
    });
  }

  const result = (side: Live[], start: number[]): StackResult[] =>
    side.map((s, i) => ({ key: s.key, name: s.name, type: s.type, start: start[i]!, alive: alive(s) }));
  return {
    attackerWon: standing(A) && !standing(D),
    rounds: round,
    attacker: result(A, startA),
    defender: result(D, startD),
    log,
    usedCounter,
  };
}

/** Sum of fighters per troop type (handy for checks and for the saga). */
export function countByType(stacks: Array<{ type: UnitType; start: number }>): Record<TroopType, number> {
  const out = Object.fromEntries(TROOP_TYPES.map((t) => [t, 0])) as Record<TroopType, number>;
  for (const s of stacks) if (s.type !== 'wall') out[s.type] += s.start;
  return out;
}
