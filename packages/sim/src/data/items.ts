import type { Cost } from './resources';

/**
 * Items in the Bag (owner request, as in the genre): speed-ups, chests of goods won in
 * battle, hero scrolls and star shards. All are earned by playing (no payments before M11).
 */
export type ItemDef =
  | { id: string; kind: 'speedup'; minutes: number; name: string }
  | { id: string; kind: 'chest'; contents: Cost; name: string }
  | { id: string; kind: 'heroXp'; levels: number; name: string }
  | { id: string; kind: 'starShard'; name: string };

export const ITEMS: readonly ItemDef[] = [
  { id: 'speed-5m', kind: 'speedup', minutes: 5, name: 'Rune of Haste (5 min)' },
  { id: 'speed-1h', kind: 'speedup', minutes: 60, name: 'Rune of Haste (1 h)' },
  { id: 'speed-8h', kind: 'speedup', minutes: 480, name: 'Rune of Haste (8 h)' },
  { id: 'chest-food', kind: 'chest', contents: { food: 2_000 }, name: 'Sack of Barley' },
  { id: 'chest-timber', kind: 'chest', contents: { timber: 2_000 }, name: 'Bundle of Oak' },
  { id: 'chest-iron', kind: 'chest', contents: { iron: 400 }, name: 'Bog-iron Bars' },
  { id: 'chest-silver', kind: 'chest', contents: { silver: 300 }, name: 'Pouch of Hacksilver' },
  {
    id: 'chest-spoils',
    kind: 'chest',
    contents: { food: 1_200, timber: 1_200, silver: 120 },
    name: 'War Spoils',
  },
  { id: 'hero-scroll', kind: 'heroXp', levels: 1, name: 'Saga Scroll' },
  { id: 'star-shard', kind: 'starShard', name: 'Rune Shard' },
];

export const itemDef = (id: string): ItemDef | undefined => ITEMS.find((i) => i.id === id);

/** A new hold starts with a few speed-ups. */
export const STARTING_ITEMS: Record<string, number> = { 'speed-5m': 3, 'speed-1h': 1, 'chest-spoils': 1 };

/** What battles drop (on top of their normal rewards). */
export const BATTLE_DROPS = {
  barrow: { 'chest-spoils': 1, 'speed-5m': 1 },
  raidBeaten: { 'chest-spoils': 1, 'speed-1h': 1, 'hero-scroll': 1 },
  pvpWon: { 'chest-spoils': 2, 'star-shard': 1 },
  landTaken: { 'chest-food': 1, 'speed-5m': 1 },
} as const satisfies Record<string, Record<string, number>>;

/** Daily activity chests also give items (index → items). */
export const CHEST_ITEMS: Record<number, Record<string, number>> = {
  0: { 'speed-5m': 2 },
  1: { 'hero-scroll': 1 },
  2: { 'speed-1h': 1 },
  3: { 'star-shard': 1 },
  4: { 'speed-8h': 1, 'chest-spoils': 1 },
};
