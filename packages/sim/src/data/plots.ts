/**
 * Building plots around the Great Hall. Offsets are in world units from the hall;
 * the inner ring is open from the start, the outer ring opens with the Great Hall.
 * (Claiming land beyond the settlement comes with the fire-carry loop in M6.)
 */
export interface PlotDef {
  id: string;
  dx: number;
  dz: number;
  /** Facing of the building, radians. */
  rotation: number;
  unlockHall: number;
}

const ring = (
  count: number,
  radius: number,
  offset: number,
  unlocks: (i: number) => number,
  prefix: string,
) =>
  Array.from({ length: count }, (_, i): PlotDef => {
    const angle = offset + (i / count) * Math.PI * 2;
    return {
      id: `${prefix}${i + 1}`,
      dx: Math.round(Math.cos(angle) * radius * 10) / 10,
      dz: Math.round(Math.sin(angle) * radius * 10) / 10,
      // Face the hall, like farms around a chieftain's seat.
      rotation: Math.round((-angle + Math.PI / 2) * 100) / 100,
      unlockHall: unlocks(i),
    };
  });

export const HALL_PLOT_ID = 'hall';

export const PLOTS: readonly PlotDef[] = [
  ...ring(6, 11.5, Math.PI / 6, () => 1, 'a'),
  ...ring(6, 18.5, 0, (i) => (i % 2 === 0 ? 3 : 5), 'b'),
];
