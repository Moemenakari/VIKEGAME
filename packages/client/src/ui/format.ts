import { RESOURCE_NAMES, type Cost, type ResourceId } from '@jarlheim/sim';
export { formatShort as formatDuration } from '../scene/Engine';

/** 950 → "950", 12_400 → "12.4K", 3_200_000 → "3.2M". */
export function formatAmount(n: number): string {
  const v = Math.floor(n);
  if (v < 1_000) return String(v);
  if (v < 1_000_000) return `${(v / 1_000).toFixed(v < 10_000 ? 1 : 0)}K`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

export function formatCost(cost: Cost): Array<{ res: ResourceId; text: string }> {
  return (Object.entries(cost) as Array<[ResourceId, number]>).map(([res, amount]) => ({
    res,
    text: `${formatAmount(amount)} ${RESOURCE_NAMES[res]}`,
  }));
}
