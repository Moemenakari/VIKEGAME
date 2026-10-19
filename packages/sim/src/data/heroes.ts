import type { TroopType } from './troops';

/**
 * Heroes: real people of the sagas and chronicles, all long in the public domain
 * (GDD §6, HISTORY_BIBLE.md). Up to three lead your warriors as a squad; their
 * skills act in every battle you fight, at the barrow, on the world map and when
 * raiders land.
 */
export type Rarity = 'rare' | 'epic' | 'legendary';

export type HeroSkill =
  /** Your shieldwall takes less damage in the first rounds. */
  | { kind: 'wallGuard'; reduce: number; rounds: number }
  /** Your whole army strikes harder. */
  | { kind: 'allAttack'; bonus: number }
  /** The enemy strikes weaker. */
  | { kind: 'curse'; reduce: number }
  /** One troop type strikes harder. */
  | { kind: 'typeAttack'; type: TroopType; bonus: number }
  /** One troop type strikes much harder in one round. */
  | { kind: 'volley'; type: TroopType; round: number; multiplier: number }
  /** More damage against the dead of the barrows. */
  | { kind: 'draugrBane'; bonus: number }
  /** More damage while your side is losing. */
  | { kind: 'fearless'; bonus: number }
  /** More production for the hold. */
  | { kind: 'production'; bonus: number }
  /** More yield from conquered land. */
  | { kind: 'land'; bonus: number }
  /** Your side takes less damage when defending the hold. */
  | { kind: 'defend'; reduce: number };

export interface HeroDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** The troops this hero leads best (their skill aside, +stats for that type). */
  troop: TroopType | 'support';
  skill: HeroSkill;
  source: string;
  /** Portrait colours (drawn in code, no downloaded art). */
  look: { bg: string; hair: string; gear: string; female?: boolean };
}

export const HEROES: readonly HeroDef[] = [
  {
    id: 'ketil',
    name: 'Bóndi Ketil',
    rarity: 'rare',
    troop: 'shieldwall',
    skill: { kind: 'typeAttack', type: 'shieldwall', bonus: 0.12 },
    source: 'Original: a farmer-soldier who grows with you',
    look: { bg: '#4a5a3a', hair: '#8a5a36', gear: '#9aa3ad' },
  },
  {
    id: 'thorfinn',
    name: 'Thorfinn Karlsefni',
    rarity: 'rare',
    troop: 'archer',
    skill: { kind: 'land', bonus: 0.25 },
    source: "Erik the Red's saga",
    look: { bg: '#2f4a5e', hair: '#c9a24a', gear: '#7a5236' },
  },
  {
    id: 'ibnfadlan',
    name: 'Ahmad ibn Faḍlān',
    rarity: 'rare',
    troop: 'support',
    skill: { kind: 'production', bonus: 0.06 },
    source: 'Risāla (922)',
    look: { bg: '#5e4a2a', hair: '#2a1a10', gear: '#e9dcc0' },
  },
  {
    id: 'grettir',
    name: 'Grettir the Strong',
    rarity: 'epic',
    troop: 'shieldwall',
    skill: { kind: 'draugrBane', bonus: 0.4 },
    source: 'Grettis saga (Glámr)',
    look: { bg: '#3a3a4a', hair: '#a83a2c', gear: '#6f7780' },
  },
  {
    id: 'olaf',
    name: 'Olaf Tryggvason',
    rarity: 'epic',
    troop: 'ship',
    skill: { kind: 'typeAttack', type: 'ship', bonus: 0.4 },
    source: 'Heimskringla (the Long Serpent)',
    look: { bg: '#1f3a5e', hair: '#e0c070', gear: '#c9a24a' },
  },
  {
    id: 'freydis',
    name: 'Freydís Eiríksdóttir',
    rarity: 'epic',
    troop: 'berserker',
    skill: { kind: 'fearless', bonus: 0.3 },
    source: 'Vínland sagas',
    look: { bg: '#5e2a2a', hair: '#c96a2a', gear: '#9aa3ad', female: true },
  },
  {
    id: 'leif',
    name: 'Leif Erikson',
    rarity: 'epic',
    troop: 'archer',
    skill: { kind: 'typeAttack', type: 'archer', bonus: 0.2 },
    source: 'Saga of the Greenlanders',
    look: { bg: '#2a5e4a', hair: '#c96a2a', gear: '#7a5236' },
  },
  {
    id: 'aud',
    name: 'Aud the Deep-Minded',
    rarity: 'epic',
    troop: 'support',
    skill: { kind: 'production', bonus: 0.12 },
    source: 'Landnámabók; Laxdæla saga',
    look: { bg: '#4a2a5e', hair: '#d9d4c8', gear: '#c9a24a', female: true },
  },
  {
    id: 'gunnhild',
    name: 'Gunnhild, Mother of Kings',
    rarity: 'epic',
    troop: 'support',
    skill: { kind: 'defend', reduce: 0.15 },
    source: 'Heimskringla; Egils saga',
    look: { bg: '#2a1a3a', hair: '#1a1010', gear: '#a83a2c', female: true },
  },
  {
    id: 'lagertha',
    name: 'Lagertha',
    rarity: 'legendary',
    troop: 'shieldwall',
    skill: { kind: 'wallGuard', reduce: 0.3, rounds: 2 },
    source: 'Gesta Danorum IX',
    look: { bg: '#5e4a1a', hair: '#e8c070', gear: '#c9d0d6', female: true },
  },
  {
    id: 'harald',
    name: 'Harald Hardrada',
    rarity: 'legendary',
    troop: 'shieldwall',
    skill: { kind: 'allAttack', bonus: 0.12 },
    source: 'Heimskringla (the Varangian Guard)',
    look: { bg: '#3a1a1a', hair: '#e0c070', gear: '#d8b13e' },
  },
  {
    id: 'egil',
    name: 'Egil Skallagrímsson',
    rarity: 'legendary',
    troop: 'berserker',
    skill: { kind: 'curse', reduce: 0.15 },
    source: 'Egils saga (the níðstang)',
    look: { bg: '#1a2a1a', hair: '#2a1a10', gear: '#6f7780' },
  },
  {
    id: 'hervor',
    name: 'Hervor',
    rarity: 'legendary',
    troop: 'berserker',
    skill: { kind: 'typeAttack', type: 'berserker', bonus: 0.45 },
    source: 'Hervarar saga (the sword Tyrfing)',
    look: { bg: '#1a1a2a', hair: '#f0e0b0', gear: '#a83a2c', female: true },
  },
  {
    id: 'einar',
    name: 'Einar Thambarskelfir',
    rarity: 'legendary',
    troop: 'archer',
    skill: { kind: 'volley', type: 'archer', round: 3, multiplier: 3 },
    source: 'Heimskringla (Svolder)',
    look: { bg: '#2a3a1a', hair: '#c9a24a', gear: '#7a5236' },
  },
  {
    id: 'sigurd',
    name: 'Sigurd Fáfnisbane',
    rarity: 'legendary',
    troop: 'berserker',
    skill: { kind: 'typeAttack', type: 'berserker', bonus: 0.3 },
    source: 'Völsunga saga',
    look: { bg: '#3a2a0a', hair: '#e0b040', gear: '#d8b13e' },
  },
];

/**
 * Squads (owner request: "four squads, each with its heroes and its warriors, saved and
 * sent every time"). A squad can carry more warriors the higher its heroes' levels.
 */
export const FORMATIONS = {
  count: 4,
  heroesPer: 3,
  baseCapacity: 300,
  capacityPerHeroLevel: 20,
};

export const HERO_RULES = {
  squadSize: 3,
  /** Each hero adds this share to the stats of the troop type they lead, per level. */
  troopBonusPerLevel: 0.004,
  /** Each star raises the hero's skill by this share. */
  skillPerStar: 0.1,
  maxStars: 5,
  /** Duplicates needed for the next star: index = current stars. */
  dupesForStar: [1, 2, 3, 4, 5],
  /** Highest hero level: five per Great Hall level. */
  levelsPerHall: 5,
  /** Silver to raise a hero from level L to L+1. */
  levelCost: (level: number) => Math.round(20 * level ** 1.35),
  /** Recruit chances (shown to the player, always). */
  odds: { legendary: 0.03, epic: 0.22, rare: 0.75 },
  /** Pity: an Epic or better at least every 10 recruits, a Legendary at least every 50. */
  epicPity: 10,
  legendaryPity: 50,
  /** Gold for one recruit when you have no Saga Horns (Gold is earned in play). */
  goldPerRecruit: 30,
  /** Power per hero: by rarity, times level, times stars. */
  power: { rare: 40, epic: 70, legendary: 110 },
  startingHorns: 3,
} as const;
