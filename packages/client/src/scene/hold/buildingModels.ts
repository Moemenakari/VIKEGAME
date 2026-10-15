import type { BuildingType } from '@jarlheim/sim';
import * as THREE from 'three';
import { addLonghouse } from './longhouse';
import { ModelBuilder } from './modelKit';

/**
 * One procedural model per building type, each merged into a single mesh.
 * Shapes follow the History Bible: turf longhouses, stockfish racks (hjallr),
 * a clay bog-iron furnace, a raised storehouse on posts (útibúr), market stalls.
 * Models gain small details as they level up.
 */
const WOOD = '#5b3f2c';
const WOOD_DARK = '#3a2a1e';
const WOOD_LIGHT = '#8a6a48';
const STONE = '#7b7b7f';
const SNOW = '#eef2f6';
const SOIL = '#5d4636';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg);

function farmstead(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 4.8, width: 2.6, wallHeight: 1.5, roofHeight: 1.9, shields: false });
  // Fields in front: furrows of soil with snow between them.
  const fields = level >= 8 ? 3 : level >= 3 ? 2 : 1;
  for (let f = 0; f < fields; f++) {
    const x = (f - (fields - 1) / 2) * 2.5;
    for (let i = 0; i < 6; i++) {
      kit.add(box(2.2, 0.08, 0.26), i % 2 ? SOIL : '#d9dccf', [x, 0.05, 2.6 + i * 0.28]);
    }
  }
  if (level >= 4) kit.add(new THREE.ConeGeometry(0.7, 1.3, 8), '#c9a65a', [2.8, 0.65, -0.6]);
}

function fishRacks(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 3.4, width: 2.2, wallHeight: 1.3, roofHeight: 1.5, shields: false });
  const racks = level >= 5 ? 3 : 2;
  for (let r = 0; r < racks; r++) {
    const z = 2.2 + r * 1.3;
    // A-frame ends and a cross pole, with stockfish hanging in pairs.
    for (const x of [-1.8, 1.8]) {
      kit.add(box(0.1, 2, 0.1), WOOD_DARK, [x, 0.95, z - 0.3], [0.3, 0, 0]);
      kit.add(box(0.1, 2, 0.1), WOOD_DARK, [x, 0.95, z + 0.3], [-0.3, 0, 0]);
    }
    kit.add(cyl(0.06, 3.8, 5), WOOD_LIGHT, [0, 1.85, z], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 7; i++) {
      kit.add(
        new THREE.OctahedronGeometry(0.22, 0),
        '#a9b3b9',
        [-1.5 + i * 0.5, 1.5, z],
        [0, 0, 0],
        [0.45, 1.3, 0.2],
      );
    }
  }
}

function woodcutter(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 3.8, width: 2.4, wallHeight: 1.4, roofHeight: 1.7, shields: false });
  // Stacked logs.
  const rows = level >= 5 ? 4 : 3;
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < rows - row + 1; i++) {
      const x = -1.4 + i * 0.45 + row * 0.22;
      kit.add(cyl(0.22, 2.2, 7), WOOD_LIGHT, [x, 0.22 + row * 0.38, 2.4], [Math.PI / 2, 0, 0]);
    }
  }
  // Chopping block with an axe.
  kit.add(cyl(0.35, 0.6, 8), WOOD, [1.7, 0.3, 2.2]);
  kit.add(box(0.06, 0.9, 0.06), WOOD_LIGHT, [1.7, 0.95, 2.2], [0, 0, 0.5]);
  kit.add(box(0.3, 0.25, 0.05), '#9aa3ad', [1.92, 1.3, 2.2], [0, 0, 0.5]);
}

function smelter(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, {
    length: 3.2,
    width: 2.4,
    wallHeight: 1.3,
    roofHeight: 1.5,
    shields: false,
    wallColor: STONE,
  });
  // Clay shaft furnace with a glowing mouth, bellows and a slag heap.
  kit.add(new THREE.CylinderGeometry(0.45, 0.7, 1.6, 10), '#8a5a3c', [0, 0.8, 2.4]);
  kit.add(cyl(0.32, 0.06, 10), '#ff9a3c', [0, 1.62, 2.4]);
  kit.add(box(0.5, 0.35, 0.3), '#ffb35c', [0, 0.35, 2.95]);
  kit.add(box(0.8, 0.3, 0.6), '#4a3426', [-1.1, 0.25, 2.4]);
  kit.add(new THREE.ConeGeometry(0.8, 0.6, 7), '#2f2b2a', [1.4, 0.3, 2.6]);
  if (level >= 3) kit.add(new THREE.CylinderGeometry(0.4, 0.6, 1.3, 10), '#8a5a3c', [-0.3, 0.65, 3.6]);
}

function market(kit: ModelBuilder, level: number): void {
  const awnings = ['#a3332a', '#2f5a7a', '#c9a24a'];
  const stalls = level >= 5 ? 3 : 2;
  for (let s = 0; s < stalls; s++) {
    const x = (s - (stalls - 1) / 2) * 2.6;
    for (const dx of [-1, 1]) {
      for (const dz of [-0.7, 0.7]) kit.add(box(0.1, 1.8, 0.1), WOOD_DARK, [x + dx * 1, 0.9, dz]);
    }
    kit.add(box(2.3, 0.08, 1.8), awnings[s % 3], [x, 1.95, 0], [0.25, 0, 0]);
    kit.add(box(2, 0.7, 0.7), WOOD, [x, 0.35, 0.4]);
    // Wares: barrels and a set of scales for weighing hacksilver.
    kit.add(cyl(0.28, 0.6, 10), WOOD_LIGHT, [x - 0.6, 1.0, 0.4]);
    kit.add(box(0.5, 0.05, 0.05), '#cfd6dc', [x + 0.4, 1.15, 0.4]);
  }
  kit.add(cyl(0.35, 0.8, 10), WOOD_LIGHT, [-3.4, 0.4, 1.4]);
  kit.add(cyl(0.35, 0.8, 10), WOOD_LIGHT, [-3.0, 0.4, 2.1]);
}

function storehouse(kit: ModelBuilder, level: number): void {
  // Útibúr: a small house raised on posts with flat stones against rats.
  const lift = 1.1;
  for (const x of [-1.2, 1.2]) {
    for (const z of [-0.9, 0.9]) {
      kit.add(box(0.25, lift, 0.25), WOOD_DARK, [x, lift / 2, z]);
      kit.add(cyl(0.3, 0.08, 8), STONE, [x, lift, z]);
    }
  }
  const raised = new ModelBuilder();
  addLonghouse(raised, { length: 3.2, width: 2.3, wallHeight: 1.4, roofHeight: 1.6, shields: false });
  kit.addBuilder(raised, [0, lift, 0]);
  // A notched-log ladder up to the door.
  kit.add(box(0.3, 1.6, 0.12), WOOD_LIGHT, [0, 0.75, 1.75], [-0.5, 0, 0]);
  if (level >= 4) kit.add(cyl(0.3, 0.6, 10), WOOD_LIGHT, [1.9, 0.3, 1.2]);
}

function greatHall(kit: ModelBuilder): void {
  addLonghouse(kit, { length: 13, width: 5.2, wallHeight: 2.4, roofHeight: 3.2, shields: true });
}

const BUILDERS: Record<BuildingType, (kit: ModelBuilder, level: number) => void> = {
  greatHall: (kit) => greatHall(kit),
  farmstead,
  fishRacks,
  woodcutter,
  smelter,
  market,
  storehouse,
};

/** Footprint radius used for scaffolding, picking and label height. */
export const FOOTPRINT: Record<BuildingType, { radius: number; height: number }> = {
  greatHall: { radius: 7, height: 7 },
  farmstead: { radius: 3.4, height: 4 },
  fishRacks: { radius: 3.2, height: 3.6 },
  woodcutter: { radius: 3, height: 3.8 },
  smelter: { radius: 3, height: 3.6 },
  market: { radius: 3.6, height: 3 },
  storehouse: { radius: 2.6, height: 4.6 },
};

/** The finished building, one mesh. Grows a little with level. */
export function createBuildingModel(type: BuildingType, level: number): THREE.Mesh {
  const kit = new ModelBuilder();
  BUILDERS[type](kit, level);
  const mesh = kit.build(type);
  const s = 1 + Math.min(level, 30) * 0.008;
  mesh.scale.setScalar(s);
  return mesh;
}

/** Timber scaffolding around a footprint, shown while something is being built. */
export function createScaffold(radius: number, height: number): THREE.Mesh {
  const kit = new ModelBuilder();
  const r = radius * 0.8;
  const h = Math.max(2.5, height * 0.8);
  for (const x of [-r, r]) {
    for (const z of [-r * 0.6, r * 0.6]) kit.add(box(0.12, h, 0.12), WOOD_LIGHT, [x, h / 2, z]);
  }
  for (const y of [h * 0.45, h * 0.9]) {
    for (const z of [-r * 0.6, r * 0.6]) kit.add(box(2 * r, 0.1, 0.1), WOOD_LIGHT, [0, y, z]);
    for (const x of [-r, r]) kit.add(box(0.1, 0.1, 1.2 * r), WOOD_LIGHT, [x, y, 0]);
  }
  kit.add(box(2 * r * 1.05, 0.08, 0.1), WOOD_LIGHT, [0, h * 0.45, r * 0.6 + 0.02], [0, 0, 0.45]);
  // A pile of fresh timber and a low stone footing.
  for (let i = 0; i < 4; i++)
    kit.add(
      cyl(0.16, 2, 6),
      '#b08a5e',
      [r + 0.9, 0.16 + (i % 2) * 0.28, -0.4 + i * 0.3],
      [Math.PI / 2, 0, 0],
    );
  return kit.build('scaffold');
}

export function createFooting(radius: number): THREE.Mesh {
  return new ModelBuilder().add(box(radius * 1.4, 0.3, radius), STONE, [0, 0.15, 0]).build('footing');
}

/** An open plot: a ring of marker stones and a carved stake. */
export function createEmptyPlot(): THREE.Mesh {
  const kit = new ModelBuilder();
  const stone = new THREE.DodecahedronGeometry(0.28, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    kit.add(
      stone,
      i % 2 ? STONE : '#8d8d90',
      [Math.cos(a) * 2.6, 0.12, Math.sin(a) * 2.6],
      [i, i * 2, 0],
      [1, 0.6, 1],
    );
  }
  kit.add(box(0.14, 1.4, 0.14), WOOD_DARK, [0, 0.7, 0]);
  kit.add(box(0.9, 0.5, 0.08), WOOD_LIGHT, [0, 1.25, 0.08]);
  kit.add(box(0.95, 0.06, 0.12), SNOW, [0, 1.52, 0.08]);
  return kit.build('plot');
}
