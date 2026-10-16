import { HEROES, HERO_RULES, type HeroDef, type Rarity } from '../data/heroes';
import type { UnitType } from '../data/troops';
import { nextFloat, type Rng } from '../rng';
import type { GameState } from '../state';
import { hallLevel } from './economy';

/** How a side's strikes and wounds are changed in battle (by heroes). */
export interface SideMods {
  /** Multiplier on the damage a stack of `type` deals in `round`; `losing` = this side has less health left. */
  attack(type: UnitType, round: number, losing: boolean): number;
  /** Multiplier on the damage a stack of `type` takes in `round`. */
  taken(type: UnitType, round: number): number;
}

export type BattleKind = 'barrow' | 'conquest' | 'raid';

export const heroDef = (id: string): HeroDef | undefined => HEROES.find((h) => h.id === id);

/** A fresh hero roster: Bóndi Ketil leads from the start, with a few Saga Horns to recruit. */
export function freshHeroes(): GameState['heroes'] {
  return {
    owned: { ketil: { level: 1, stars: 0, dupes: 0 } },
    squad: ['ketil'],
    horns: HERO_RULES.startingHorns,
    pity: { epic: 0, legendary: 0 },
  };
}

/** Skill strength grows with stars. */
const starFactor = (stars: number) => 1 + HERO_RULES.skillPerStar * stars;

/** The squad as definitions with their level and stars. */
function squad(state: GameState) {
  return state.heroes.squad
    .map((id) => ({ def: heroDef(id), owned: state.heroes.owned[id] }))
    .filter(
      (h): h is { def: HeroDef; owned: { level: number; stars: number; dupes: number } } =>
        !!h.def && !!h.owned,
    );
}

/** Battle modifiers for your side, and for the enemy (curses), from your squad. */
export function heroMods(state: GameState, kind: BattleKind): { ours: SideMods; theirs: SideMods } {
  const typeAtk: Partial<Record<UnitType, number>> = {};
  let all = 0;
  let curse = 0;
  let fearless = 0;
  let draugr = 0;
  let defend = 0;
  const guards: Array<{ reduce: number; rounds: number }> = [];
  const volleys: Array<{ type: UnitType; round: number; multiplier: number }> = [];
  for (const { def, owned } of squad(state)) {
    const f = starFactor(owned.stars);
    if (def.troop !== 'support')
      typeAtk[def.troop] = (typeAtk[def.troop] ?? 0) + HERO_RULES.troopBonusPerLevel * owned.level;
    const s = def.skill;
    switch (s.kind) {
      case 'allAttack':
        all += s.bonus * f;
        break;
      case 'typeAttack':
        typeAtk[s.type] = (typeAtk[s.type] ?? 0) + s.bonus * f;
        break;
      case 'curse':
        curse += s.reduce * f;
        break;
      case 'fearless':
        fearless += s.bonus * f;
        break;
      case 'draugrBane':
        draugr += s.bonus * f;
        break;
      case 'defend':
        defend += s.reduce * f;
        break;
      case 'wallGuard':
        guards.push({ reduce: s.reduce * f, rounds: s.rounds });
        break;
      case 'volley':
        volleys.push({ type: s.type, round: s.round, multiplier: s.multiplier * f });
        break;
    }
  }
  const ours: SideMods = {
    attack(type, round, losing) {
      let m = 1 + all + (typeAtk[type] ?? 0) + (losing ? fearless : 0) + (kind === 'barrow' ? draugr : 0);
      for (const v of volleys) if (v.type === type && v.round === round) m *= v.multiplier;
      return m;
    },
    taken(type, round) {
      let m = kind === 'raid' ? 1 - Math.min(0.5, defend) : 1;
      for (const g of guards)
        if (type === 'shieldwall' && round <= g.rounds) m *= 1 - Math.min(0.6, g.reduce);
      return m;
    },
  };
  const theirs: SideMods = { attack: () => 1 - Math.min(0.5, curse), taken: () => 1 };
  return { ours, theirs };
}

/** Production bonus from support heroes in the squad (0.1 = +10 %). */
export function heroProduction(state: GameState): number {
  let b = 0;
  for (const { def, owned } of squad(state))
    if (def.skill.kind === 'production') b += def.skill.bonus * starFactor(owned.stars);
  return b;
}

/** Bonus on what conquered land yields. */
export function heroLand(state: GameState): number {
  let b = 0;
  for (const { def, owned } of squad(state))
    if (def.skill.kind === 'land') b += def.skill.bonus * starFactor(owned.stars);
  return b;
}

/** Hero power: every hero you own counts, by rarity, level and stars. */
export function heroPower(state: GameState): number {
  let p = 0;
  for (const [id, h] of Object.entries(state.heroes.owned)) {
    const def = heroDef(id);
    if (def) p += Math.round(HERO_RULES.power[def.rarity] * h.level * starFactor(h.stars));
  }
  return p;
}

export const heroMaxLevel = (state: GameState) => HERO_RULES.levelsPerHall * hallLevel(state);

/** Draws one hero, with the pity counters (an Epic at least every 10, a Legendary every 50). */
export function drawHero(state: GameState, rng: Rng): HeroDef {
  const pity = state.heroes.pity;
  pity.epic++;
  pity.legendary++;
  let rarity: Rarity;
  const roll = nextFloat(rng);
  if (pity.legendary >= HERO_RULES.legendaryPity || roll < HERO_RULES.odds.legendary) rarity = 'legendary';
  else if (pity.epic >= HERO_RULES.epicPity || roll < HERO_RULES.odds.legendary + HERO_RULES.odds.epic)
    rarity = 'epic';
  else rarity = 'rare';
  if (rarity === 'legendary') pity.legendary = 0;
  if (rarity !== 'rare') pity.epic = 0;
  const pool = HEROES.filter((h) => h.rarity === rarity);
  return pool[Math.floor(nextFloat(rng) * pool.length)]!;
}

/** Adds a recruited hero, or a duplicate towards their next star. */
export function grantHero(state: GameState, id: string): 'new' | 'dupe' {
  const owned = state.heroes.owned[id];
  if (!owned) {
    state.heroes.owned[id] = { level: 1, stars: 0, dupes: 0 };
    if (state.heroes.squad.length < HERO_RULES.squadSize) state.heroes.squad.push(id);
    return 'new';
  }
  if (owned.stars < HERO_RULES.maxStars) {
    owned.dupes++;
    const need = HERO_RULES.dupesForStar[owned.stars]!;
    if (owned.dupes >= need) {
      owned.dupes -= need;
      owned.stars++;
    }
  }
  return 'dupe';
}
