/** The four produced resources plus Gold (premium, earn-only until M11). See GDD §3. */
export const RESOURCES = ['food', 'timber', 'iron', 'silver', 'gold'] as const;
export type ResourceId = (typeof RESOURCES)[number];

/** Resources that buildings produce and the Storehouse protects. Gold is never produced. */
export const PRODUCED_RESOURCES = [
  'food',
  'timber',
  'iron',
  'silver',
] as const satisfies readonly ResourceId[];
export type ProducedResourceId = (typeof PRODUCED_RESOURCES)[number];

export type Resources = Record<ResourceId, number>;
export type Cost = Partial<Record<ResourceId, number>>;

export const RESOURCE_NAMES: Record<ResourceId, string> = {
  food: 'Food',
  timber: 'Timber',
  iron: 'Iron',
  silver: 'Silver',
  gold: 'Gold',
};
