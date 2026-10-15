import type { Cost } from './resources';
import type { CombatStats, TroopType } from './troops';

/**
 * Draugr: the restless dead of the sagas (Grettis saga's Glámr, Eyrbyggja saga),
 * here risen from a burial mound near your hold. Each barrow level is a band to beat.
 */
export interface EnemyUnit extends CombatStats {
  id: string;
  name: string;
  /** Which side of the triangle it fights on. */
  type: TroopType;
}

export const DRAUGR_UNITS: Record<string, EnemyUnit> = {
  shambler: { id: 'shambler', name: 'Barrow Shambler', type: 'shieldwall', atk: 7, def: 10, hp: 30 },
  ravager: { id: 'ravager', name: 'Grave Ravager', type: 'berserker', atk: 12, def: 4, hp: 24 },
  wight: { id: 'wight', name: 'Mound Wight', type: 'archer', atk: 10, def: 5, hp: 20 },
};

export interface DraugrBand {
  level: number;
  name: string;
  units: Record<string, number>;
  reward: Cost;
  /** Paid only the first time the band is defeated. */
  firstClearReward: Cost;
}

const NAMES = [
  'The Restless Few',
  'Barrow Watchers',
  'Cold Hands',
  'The Mound Kin',
  'Howe Guard',
  'Glámr’s Shadow',
  'The Sleepless Host',
  'Wights of the Fell',
  'The Draugr Lord’s Hird',
  'Glámr Unburied',
];

/** Ten levels, each about 45 % stronger than the last, with mixes that reward using counters. */
export const DRAUGR_BANDS: readonly DraugrBand[] = NAMES.map((name, i) => {
  const level = i + 1;
  const size = Math.round(18 * 1.45 ** i);
  const mix = [
    [1, 0, 0],
    [0.6, 0.4, 0],
    [0.4, 0.3, 0.3],
    [0.2, 0.6, 0.2],
    [0.3, 0.2, 0.5],
  ][i % 5]!;
  const units: Record<string, number> = {};
  (['shambler', 'ravager', 'wight'] as const).forEach((u, k) => {
    const n = Math.round(size * mix[k]!);
    if (n > 0) units[u] = n;
  });
  const r = Math.round(300 * 1.5 ** i);
  return {
    level,
    name,
    units,
    reward: { food: r, timber: r, silver: Math.round(r / 6) },
    firstClearReward: { gold: level % 5 === 0 ? 25 : 5 },
  };
});
