import type { BuildingType } from '@jarlheim/sim';
import * as THREE from 'three';
import { addLonghouse } from './longhouse';
import { ModelBuilder, gradient } from './modelKit';

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

function shieldYard(kit: ModelBuilder, level: number): void {
  // A fenced drill yard: practice posts with shields, a spear rack, a small hut behind.
  const hut = new ModelBuilder();
  addLonghouse(hut, { length: 3.4, width: 2.2, wallHeight: 1.3, roofHeight: 1.5, shields: false });
  kit.addBuilder(hut, [0, 0, -2.2]);
  for (let i = 0; i <= 6; i++) {
    const x = -3 + i;
    kit.add(box(0.12, 0.9, 0.12), WOOD_DARK, [x, 0.45, 3.4]);
    if (i < 6) kit.add(box(1, 0.08, 0.08), WOOD_LIGHT, [x + 0.5, 0.75, 3.4]);
  }
  for (const z of [-0.6, 3.4]) kit.add(box(0.08, 0.08, 4), WOOD_LIGHT, [z < 0 ? -3 : 3, 0.75, 1.4]);
  const posts = level >= 5 ? 4 : 3;
  const colors = ['#a83a2c', '#d8b13e', '#2f5a7a', '#e9e1cf'];
  for (let i = 0; i < posts; i++) {
    const x = -1.8 + i * 1.2;
    kit.add(box(0.16, 1.5, 0.16), WOOD, [x, 0.75, 1.4]);
    kit.add(cyl(0.4, 0.07, 12), colors[i % 4], [x, 1.1, 1.52], [Math.PI / 2, 0, 0]);
  }
  // Spear rack.
  kit.add(box(1.6, 0.1, 0.1), WOOD, [2.2, 1.2, -0.2]);
  for (let i = 0; i < 5; i++)
    kit.add(box(0.05, 2.2, 0.05), WOOD_LIGHT, [1.6 + i * 0.3, 1.1, -0.1], [0.15, 0, 0]);
}

function bowyerRange(kit: ModelBuilder, level: number): void {
  // A lean-to shelter and straw targets painted with rings.
  for (const x of [-1.6, 1.6]) {
    kit.add(box(0.14, 2, 0.14), WOOD_DARK, [x, 1, -1.2]);
    kit.add(box(0.14, 1.3, 0.14), WOOD_DARK, [x, 0.65, 0.2]);
  }
  kit.add(box(3.6, 0.12, 1.9), '#58593a', [0, 1.7, -0.5], [-0.35, 0, 0]);
  kit.add(box(3.7, 0.08, 1.95), SNOW, [0, 1.79, -0.5], [-0.35, 0, 0]);
  const targets = level >= 5 ? 3 : 2;
  for (let i = 0; i < targets; i++) {
    const x = (i - (targets - 1) / 2) * 1.8;
    kit.add(box(0.1, 1.1, 0.1), WOOD_DARK, [x - 0.3, 0.55, 3.2], [0, 0, 0.2]);
    kit.add(box(0.1, 1.1, 0.1), WOOD_DARK, [x + 0.3, 0.55, 3.2], [0, 0, -0.2]);
    kit.add(cyl(0.55, 0.25, 14), '#d9c27a', [x, 1.1, 3.3], [Math.PI / 2, 0, 0]);
    kit.add(cyl(0.34, 0.27, 14), '#a83a2c', [x, 1.1, 3.3], [Math.PI / 2, 0, 0]);
    kit.add(cyl(0.14, 0.29, 10), '#e9e1cf', [x, 1.1, 3.3], [Math.PI / 2, 0, 0]);
  }
  // A bundle of yew staves.
  for (let i = 0; i < 4; i++)
    kit.add(box(0.06, 1.7, 0.06), '#9a6a3a', [-2.4 + i * 0.1, 0.85, -0.4], [0, 0, 0.12 - i * 0.05]);
}

function wolfLodge(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, {
    length: 4.6,
    width: 2.6,
    wallHeight: 1.5,
    roofHeight: 1.9,
    shields: false,
    wallColor: '#3b2a20',
  });
  // Wolf pelts stretched to dry, and a fire pit.
  for (let i = 0; i < 3; i++) {
    kit.add(box(0.75, 0.9, 0.05), '#7d7b78', [-1.4 + i * 1.4, 1.1, 1.62]);
    kit.add(box(0.3, 0.25, 0.06), '#5f5c59', [-1.4 + i * 1.4, 1.62, 1.63]);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    kit.add(new THREE.DodecahedronGeometry(0.2, 0), STONE, [Math.cos(a) * 0.7, 0.12, 3 + Math.sin(a) * 0.7]);
  }
  kit.add(new THREE.ConeGeometry(0.45, 0.8, 7), '#ff8a32', [0, 0.4, 3]);
  kit.add(new THREE.ConeGeometry(0.25, 0.55, 6), '#ffd36b', [0, 0.35, 3]);
  if (level >= 5) kit.add(box(0.18, 2.4, 0.18), WOOD_DARK, [1.8, 1.2, 3]);
}

function healersHouse(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 4, width: 2.5, wallHeight: 1.4, roofHeight: 1.7, shields: false });
  // Herb beds under the snow and a rack of drying herbs.
  const beds = level >= 4 ? 3 : 2;
  for (let i = 0; i < beds; i++) {
    kit.add(box(1.1, 0.25, 1.6), '#4a3a2c', [-1.6 + i * 1.4, 0.12, 2.8]);
    kit.add(box(1, 0.12, 1.5), '#5f7d4a', [-1.6 + i * 1.4, 0.3, 2.8]);
  }
  kit.add(box(2.2, 0.06, 0.06), WOOD_LIGHT, [2.4, 1.5, 0.6]);
  for (const x of [1.3, 3.5]) kit.add(box(0.08, 1.5, 0.08), WOOD_DARK, [x, 0.75, 0.6]);
  for (let i = 0; i < 5; i++)
    kit.add(new THREE.ConeGeometry(0.12, 0.45, 5), '#7a8a4a', [1.6 + i * 0.4, 1.25, 0.6], [Math.PI, 0, 0]);
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
  shieldYard,
  bowyerRange,
  wolfLodge,
  healersHouse,
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
  shieldYard: { radius: 3.6, height: 3.4 },
  bowyerRange: { radius: 3.4, height: 3 },
  wolfLodge: { radius: 3.4, height: 4 },
  healersHouse: { radius: 3.2, height: 3.8 },
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

/**
 * The draugr barrow: a snow-covered burial mound inside a ship-shaped setting of
 * standing stones (after Lindholm Høje and Anundshög), with a dark opening and a
 * cold glow where the dead come out.
 */
export function createBarrow(): THREE.Mesh {
  const kit = new ModelBuilder();
  const mound = new THREE.SphereGeometry(4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  kit.add(gradient(mound, '#5a5a3c', SNOW, 0.5, 2.6), undefined, [0, -0.2, 0], [0, 0, 0], [1.25, 0.75, 1]);
  // Ship setting: stones along two arcs meeting at a tall prow stone and stern stone.
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (t - 0.5) * 15;
    const w = Math.sin(Math.PI * t) * 4.4;
    const tall = i === 0 || i === n ? 1.9 : 0.8 + 0.4 * Math.sin(Math.PI * t);
    for (const side of [-1, 1]) {
      if ((i === 0 || i === n) && side === 1) continue;
      kit.add(
        box(0.5, tall, 0.35),
        i % 2 ? '#6f6f74' : '#86868b',
        [x, tall / 2, side * w],
        [0, i * 0.4, side * 0.05],
      );
    }
  }
  kit.add(box(1.1, 1.3, 0.6), '#121417', [0, 0.55, 3.5], [-0.25, 0, 0]);
  kit.add(box(0.8, 1, 0.1), '#6fd3ff', [0, 0.5, 3.75], [-0.25, 0, 0]);
  return kit.build('barrow');
}
