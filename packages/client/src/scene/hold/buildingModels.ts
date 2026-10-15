import type { BuildingType } from '@jarlheim/sim';
import * as THREE from 'three';
import { addLonghouse } from './longhouse';
import { ModelBuilder, bulge, gradient, paint } from './modelKit';

/**
 * One procedural model per building type, each merged into a single mesh.
 * Shapes follow the History Bible: turf longhouses, stockfish racks (hjallr),
 * a clay bog-iron furnace, a raised storehouse on posts (útibúr), market stalls.
 * Models gain small details as they level up.
 */
const WOOD = paint('#7a573c', 'wood');
const WOOD_DARK = paint('#4a3426', 'timber');
const WOOD_LIGHT = paint('#a07a52', 'timber');
const STONE = paint('#86848a', 'stone');
const SNOW = paint('#f2f5f8', 'snow');
const SOIL = paint('#5d4636', 'ground');
const STRAW = paint('#c9a65a', 'turf');
const IRON = paint('#5d6268', 'metal');
const CLOTH = (c: string) => paint(c, 'cloth');

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg);

function farmstead(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 4.8, width: 2.6, wallHeight: 1.5, roofHeight: 1.9, shields: false });
  // Fields in front: furrows of soil with snow between them.
  const fields = level >= 8 ? 3 : level >= 3 ? 2 : 1;
  for (let f = 0; f < fields; f++) {
    const x = (f - (fields - 1) / 2) * 2.5;
    for (let i = 0; i < 6; i++) {
      kit.add(box(2.2, 0.08, 0.26), i % 2 ? SOIL : SNOW, [x, 0.05, 2.6 + i * 0.28]);
    }
  }
  if (level >= 4) kit.add(new THREE.ConeGeometry(0.7, 1.3, 10), STRAW, [2.8, 0.65, -0.6]);
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
        paint('#b4bcc2', 'cloth'),
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
  kit.add(box(0.3, 0.25, 0.05), IRON, [1.92, 1.3, 2.2], [0, 0, 0.5]);
}

function smelter(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, {
    length: 3.2,
    width: 2.4,
    wallHeight: 1.3,
    roofHeight: 1.5,
    shields: false,
    wall: STONE,
  });
  // Clay shaft furnace with a glowing mouth, bellows and a slag heap.
  kit.add(new THREE.CylinderGeometry(0.45, 0.7, 1.6, 12), paint('#8a5a3c', 'stone'), [0, 0.8, 2.4]);
  kit.add(cyl(0.32, 0.06, 10), paint('#ff9a3c', 'glow'), [0, 1.62, 2.4]);
  kit.add(box(0.5, 0.35, 0.3), paint('#ffb35c', 'glow'), [0, 0.35, 2.95]);
  kit.add(box(0.8, 0.3, 0.6), CLOTH('#4a3426'), [-1.1, 0.25, 2.4]);
  kit.add(new THREE.ConeGeometry(0.8, 0.6, 7), paint('#2f2b2a', 'stone'), [1.4, 0.3, 2.6]);
  if (level >= 3)
    kit.add(new THREE.CylinderGeometry(0.4, 0.6, 1.3, 12), paint('#8a5a3c', 'stone'), [-0.3, 0.65, 3.6]);
}

function market(kit: ModelBuilder, level: number): void {
  const awnings = ['#a3332a', '#2f5a7a', '#c9a24a'];
  const stalls = level >= 5 ? 3 : 2;
  for (let s = 0; s < stalls; s++) {
    const x = (s - (stalls - 1) / 2) * 2.6;
    for (const dx of [-1, 1]) {
      for (const dz of [-0.7, 0.7]) kit.add(box(0.1, 1.8, 0.1), WOOD_DARK, [x + dx * 1, 0.9, dz]);
    }
    kit.add(box(2.3, 0.08, 1.8), CLOTH(awnings[s % 3]!), [x, 1.95, 0], [0.25, 0, 0]);
    kit.add(box(2, 0.7, 0.7), WOOD, [x, 0.35, 0.4]);
    // Wares: barrels and a set of scales for weighing hacksilver.
    kit.add(cyl(0.28, 0.6, 10), WOOD_LIGHT, [x - 0.6, 1.0, 0.4]);
    kit.add(box(0.5, 0.05, 0.05), IRON, [x + 0.4, 1.15, 0.4]);
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
    kit.add(cyl(0.4, 0.07, 16), paint(colors[i % 4]!, 'wood'), [x, 1.1, 1.52], [Math.PI / 2, 0, 0]);
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
  kit.add(box(3.6, 0.12, 1.9), paint('#6b6a45', 'turf'), [0, 1.7, -0.5], [-0.35, 0, 0]);
  kit.add(box(3.7, 0.08, 1.95), SNOW, [0, 1.79, -0.5], [-0.35, 0, 0]);
  const targets = level >= 5 ? 3 : 2;
  for (let i = 0; i < targets; i++) {
    const x = (i - (targets - 1) / 2) * 1.8;
    kit.add(box(0.1, 1.1, 0.1), WOOD_DARK, [x - 0.3, 0.55, 3.2], [0, 0, 0.2]);
    kit.add(box(0.1, 1.1, 0.1), WOOD_DARK, [x + 0.3, 0.55, 3.2], [0, 0, -0.2]);
    kit.add(cyl(0.55, 0.25, 16), STRAW, [x, 1.1, 3.3], [Math.PI / 2, 0, 0]);
    kit.add(cyl(0.34, 0.27, 16), CLOTH('#a83a2c'), [x, 1.1, 3.3], [Math.PI / 2, 0, 0]);
    kit.add(cyl(0.14, 0.29, 12), CLOTH('#e9e1cf'), [x, 1.1, 3.3], [Math.PI / 2, 0, 0]);
  }
  // A bundle of yew staves.
  for (let i = 0; i < 4; i++)
    kit.add(
      box(0.06, 1.7, 0.06),
      paint('#9a6a3a', 'timber'),
      [-2.4 + i * 0.1, 0.85, -0.4],
      [0, 0, 0.12 - i * 0.05],
    );
}

function wolfLodge(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, {
    length: 4.6,
    width: 2.6,
    wallHeight: 1.5,
    roofHeight: 1.9,
    shields: false,
    wall: '#4a3426',
  });
  // Wolf pelts stretched to dry, and a fire pit.
  for (let i = 0; i < 3; i++) {
    kit.add(box(0.75, 0.9, 0.05), CLOTH('#8a8784'), [-1.4 + i * 1.4, 1.1, 1.62]);
    kit.add(box(0.3, 0.25, 0.06), CLOTH('#5f5c59'), [-1.4 + i * 1.4, 1.62, 1.63]);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    kit.add(new THREE.DodecahedronGeometry(0.2, 0), STONE, [Math.cos(a) * 0.7, 0.12, 3 + Math.sin(a) * 0.7]);
  }
  kit.add(new THREE.ConeGeometry(0.45, 0.8, 7), paint('#ff8a32', 'glow'), [0, 0.4, 3]);
  kit.add(new THREE.ConeGeometry(0.25, 0.55, 6), paint('#ffd36b', 'glow'), [0, 0.35, 3]);
  if (level >= 5) kit.add(box(0.18, 2.4, 0.18), WOOD_DARK, [1.8, 1.2, 3]);
}

function healersHouse(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 4, width: 2.5, wallHeight: 1.4, roofHeight: 1.7, shields: false });
  // Herb beds under the snow and a rack of drying herbs.
  const beds = level >= 4 ? 3 : 2;
  for (let i = 0; i < beds; i++) {
    kit.add(box(1.1, 0.25, 1.6), WOOD_DARK, [-1.6 + i * 1.4, 0.12, 2.8]);
    kit.add(box(1, 0.12, 1.5), paint('#5f7d4a', 'turf'), [-1.6 + i * 1.4, 0.3, 2.8]);
  }
  kit.add(box(2.2, 0.06, 0.06), WOOD_LIGHT, [2.4, 1.5, 0.6]);
  for (const x of [1.3, 3.5]) kit.add(box(0.08, 1.5, 0.08), WOOD_DARK, [x, 0.75, 0.6]);
  for (let i = 0; i < 5; i++)
    kit.add(
      new THREE.ConeGeometry(0.12, 0.45, 5),
      paint('#7a8a4a', 'turf'),
      [1.6 + i * 0.4, 1.25, 0.6],
      [Math.PI, 0, 0],
    );
}

function greatHall(kit: ModelBuilder): void {
  addLonghouse(kit, { length: 13, width: 5.2, wallHeight: 2.4, roofHeight: 3.2, shields: true });
}

// ---- added with free placement and sea raids (D-035–D-037) -------------------------

/** A row of sharpened logs from x0 to x1 along x, at depth z. */
function logWall(kit: ModelBuilder, x0: number, x1: number, z: number, height: number): void {
  for (let x = x0; x <= x1 + 1e-6; x += 0.32) {
    const h = height * (0.92 + 0.08 * Math.sin(x * 7.3));
    kit.add(cyl(0.16, h, 6), WOOD, [x, h / 2, z]);
    kit.add(new THREE.ConeGeometry(0.16, 0.35, 6), WOOD_DARK, [x, h + 0.17, z]);
  }
  kit.add(box(x1 - x0 + 0.3, 0.12, 0.12), WOOD_DARK, [(x0 + x1) / 2, height * 0.35, z + 0.18]);
  kit.add(box(x1 - x0 + 0.3, 0.12, 0.12), WOOD_DARK, [(x0 + x1) / 2, height * 0.75, z + 0.18]);
}

function watchTower(kit: ModelBuilder, x: number, z: number, height: number): void {
  for (const dx of [-0.6, 0.6])
    for (const dz of [-0.6, 0.6]) kit.add(box(0.18, height, 0.18), WOOD_DARK, [x + dx, height / 2, z + dz]);
  kit.add(box(1.7, 0.15, 1.7), WOOD_LIGHT, [x, height, z]);
  for (const [dx, dz, w, d] of [
    [0, -0.8, 1.7, 0.1],
    [0, 0.8, 1.7, 0.1],
    [-0.8, 0, 0.1, 1.7],
    [0.8, 0, 0.1, 1.7],
  ] as const)
    kit.add(box(w, 0.5, d), WOOD, [x + dx, height + 0.3, z + dz]);
  kit.add(
    new THREE.ConeGeometry(1.3, 1, 4),
    paint('#55543a', 'turf'),
    [x, height + 1.1, z],
    [0, Math.PI / 4, 0],
  );
  kit.add(new THREE.ConeGeometry(1.32, 0.5, 4), SNOW, [x, height + 1.36, z], [0, Math.PI / 4, 0]);
}

function palisade(kit: ModelBuilder, level: number): void {
  const h = 2.2 + Math.min(level, 20) * 0.03;
  logWall(kit, -3.2, -1, 0, h);
  logWall(kit, 1, 3.2, 0, h);
  // Gate: two posts, a lintel and a pair of plank doors standing open.
  for (const x of [-0.85, 0.85]) kit.add(box(0.3, h + 0.8, 0.3), WOOD_DARK, [x, (h + 0.8) / 2, 0]);
  kit.add(box(2.1, 0.3, 0.35), WOOD_DARK, [0, h + 0.7, 0]);
  kit.add(box(0.8, h - 0.2, 0.1), WOOD_LIGHT, [-0.6, (h - 0.2) / 2, 0.55], [0, 0.9, 0]);
  kit.add(box(0.8, h - 0.2, 0.1), WOOD_LIGHT, [0.6, (h - 0.2) / 2, 0.55], [0, -0.9, 0]);
  watchTower(kit, -3.3, -0.9, h + 0.6);
  if (level >= 5) watchTower(kit, 3.3, -0.9, h + 0.6);
  // A beacon pile ready to be lit (Hákon the Good's warning fires).
  kit.add(new THREE.ConeGeometry(0.4, 0.8, 6), WOOD_LIGHT, [-3.3, h + 1.05, -0.9]);
}

function rampart(kit: ModelBuilder, level: number): void {
  // An earth bank faced with timber, like the Trelleborg ring forts, with a gate passage.
  const bank = new THREE.CylinderGeometry(1.1, 1.8, 1.6, 4, 1);
  for (const x of [-2.4, 2.4]) {
    kit.add(
      gradient(bank.clone(), '#5d5a3c', '#f2f5f8', 0.2, 0.8),
      undefined,
      [x, 0.8, 0],
      [0, Math.PI / 4, 0],
      [1.6, 1, 0.9],
      'turf',
    );
    logWall(kit, x - 1.4, x + 1.4, -0.2, 1.3);
    kit.add(box(2.9, 0.12, 1.2), WOOD_LIGHT, [x, 1.65, -0.9]);
  }
  kit.add(box(1.6, 0.25, 3.4), STONE, [0, 0.12, 0]);
  for (const x of [-0.9, 0.9]) kit.add(box(0.35, 3, 0.35), WOOD_DARK, [x, 1.5, 1.2]);
  kit.add(box(2.2, 0.4, 0.5), WOOD_DARK, [0, 3.1, 1.2]);
  kit.add(box(2.4, 0.15, 0.7), SNOW, [0, 3.38, 1.2]);
  if (level >= 3) watchTower(kit, 0, -1.4, 3);
}

function builderLodge(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 3.8, width: 2.4, wallHeight: 1.4, roofHeight: 1.6, shields: false });
  // A half-raised frame for practice, sawhorses and stacked planks.
  for (const x of [1.4, 3]) {
    kit.add(box(0.14, 2.2, 0.14), WOOD_LIGHT, [x - 1, 1.1, 2.4]);
    kit.add(box(0.14, 2.2, 0.14), WOOD_LIGHT, [x - 1, 1.1, 3.6]);
  }
  kit.add(box(1.8, 0.14, 0.14), WOOD_LIGHT, [1.2, 2.2, 2.4]);
  kit.add(box(1.8, 0.14, 0.14), WOOD_LIGHT, [1.2, 2.2, 3.6]);
  kit.add(box(0.14, 0.14, 1.4), WOOD_LIGHT, [0.4, 2.2, 3]);
  for (let i = 0; i < 5; i++)
    kit.add(box(2.4, 0.08, 0.3), paint('#b08a5e', 'timber'), [-1.6, 0.06 + i * 0.09, 2.8 + (i % 2) * 0.05]);
  kit.add(box(1.2, 0.08, 0.3), WOOD, [-1.5, 0.7, 3.8]);
  for (const x of [-2, -1]) kit.add(box(0.08, 0.7, 0.5), WOOD_DARK, [x, 0.35, 3.8]);
  if (level >= 5) kit.add(cyl(0.3, 0.8, 8), WOOD_LIGHT, [2.5, 0.4, 0.8]);
}

/** A clinker-built hull along x, open on top (for the boathouse and slipway). */
function hull(kit: ModelBuilder, length: number, x = 0, z = 0, y = 0.4): void {
  const shape = new THREE.Shape();
  shape.moveTo(-0.9, 0.5);
  shape.quadraticCurveTo(-0.85, -0.2, 0, -0.35);
  shape.quadraticCurveTo(0.85, -0.2, 0.9, 0.5);
  shape.lineTo(0.75, 0.5);
  shape.quadraticCurveTo(0.7, -0.05, 0, -0.2);
  shape.quadraticCurveTo(-0.7, -0.05, -0.75, 0.5);
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 6 });
  g.translate(0, 0, -length / 2);
  g.rotateY(Math.PI / 2);
  bulge(g, length, 0.0);
  // Pinch the ends into a bow and a stern.
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = Math.abs((2 * pos.getX(i)) / length);
    pos.setZ(i, pos.getZ(i) * (1 - t ** 3));
    pos.setY(i, pos.getY(i) + t ** 2 * 0.5);
  }
  g.computeVertexNormals();
  kit.add(g, paint('#6e4c33', 'wood'), [x, y, z]);
  for (const dir of [-1, 1]) {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.25 * dir, 0.6, 0),
      new THREE.Vector3(0.1 * dir, 1.2, 0),
    ];
    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.08, 5, false), WOOD_DARK, [
      x + (dir * length) / 2,
      y + 0.5,
      z,
    ]);
  }
}

function shipyard(kit: ModelBuilder, level: number): void {
  // Naust: a long, low boathouse with stone side walls, open towards the water.
  for (const z of [-1.4, 1.4]) kit.add(box(6.4, 1, 0.5), STONE, [0, 0.5, z]);
  kit.add(box(0.5, 1, 3.3), STONE, [-3.1, 0.5, 0]);
  const roof = new ModelBuilder();
  addLonghouse(roof, { length: 6.4, width: 3.3, wallHeight: 0.2, roofHeight: 2, shields: false });
  kit.addBuilder(roof, [0, 0.9, 0]);
  hull(kit, 5.2, 0.4, 0, 0.5);
  // Slipway logs out of the open end, and a keel being laid at higher levels.
  for (let i = 0; i < 5; i++)
    kit.add(cyl(0.12, 2.4, 6), WOOD_LIGHT, [3.6 + i * 0.6, 0.12, 0], [Math.PI / 2, 0, 0]);
  if (level >= 3) {
    kit.add(box(4, 0.2, 0.2), WOOD_DARK, [0.5, 0.35, 3.1]);
    for (let i = 0; i < 4; i++) kit.add(box(0.12, 1, 0.12), WOOD_LIGHT, [-1 + i * 1, 0.7, 3.1], [0, 0, 0.3]);
  }
}

function horse(kit: ModelBuilder, x: number, z: number, rot: number, color: string): void {
  const coat = paint(color, 'cloth');
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const at = (dx: number, y: number, dz = 0): [number, number, number] => [
    x + dx * c - dz * s,
    y,
    z + dx * s + dz * c,
  ];
  kit.add(box(1.1, 0.45, 0.38), coat, at(0, 0.85), [0, -rot, 0]);
  for (const dx of [-0.42, 0.42])
    for (const dz of [-0.13, 0.13]) kit.add(box(0.1, 0.65, 0.1), coat, at(dx, 0.33, dz), [0, -rot, 0]);
  kit.add(box(0.22, 0.5, 0.22), coat, at(0.6, 1.15), [0, -rot, -0.6]);
  kit.add(box(0.36, 0.18, 0.18), coat, at(0.82, 1.38), [0, -rot, 0.2]);
  kit.add(box(0.06, 0.4, 0.12), paint('#2a1d14', 'cloth'), at(0.5, 1.25), [0, -rot, -0.6]);
}

function stable(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, {
    length: 4.4,
    width: 2.4,
    wallHeight: 1.4,
    roofHeight: 1.7,
    shields: false,
    wall: '#5e4330',
  });
  // A fenced paddock with small, sturdy Nordic horses.
  for (let i = 0; i <= 6; i++) {
    kit.add(box(0.1, 0.9, 0.1), WOOD_DARK, [-3 + i, 0.45, 4]);
    if (i < 6) kit.add(box(1, 0.07, 0.07), WOOD_LIGHT, [-2.5 + i, 0.7, 4]);
  }
  for (const x of [-3, 3]) kit.add(box(0.07, 0.07, 2.4), WOOD_LIGHT, [x, 0.7, 2.8]);
  horse(kit, -1.3, 2.7, 0.3, '#7a5236');
  horse(kit, 1.2, 3.1, 2.6, '#c9b08a');
  if (level >= 4) horse(kit, 0, 2.2, 1.4, '#3a2a20');
  kit.add(new THREE.ConeGeometry(0.6, 1, 9), STRAW, [2.6, 0.5, 2]);
}

function bearDen(kit: ModelBuilder, level: number): void {
  // A rocky den with a dark mouth, a stake fence and a great bear.
  const rock = new THREE.DodecahedronGeometry(1, 0);
  kit.add(
    gradient(rock.clone(), '#6f6f74', '#f2f5f8', 0.3, 1),
    undefined,
    [0, 0.9, -0.8],
    [0.3, 0.5, 0],
    [2.4, 1.5, 1.8],
    'stone',
  );
  kit.add(
    gradient(rock.clone(), '#6f6f74', '#f2f5f8', 0.3, 1),
    undefined,
    [-1.9, 0.6, 0.2],
    [0.8, 0.1, 0.4],
    [1.1, 0.9, 1.1],
    'stone',
  );
  kit.add(
    gradient(rock.clone(), '#6f6f74', '#f2f5f8', 0.3, 1),
    undefined,
    [1.9, 0.5, 0.1],
    [0.2, 1.1, 0.4],
    [1, 0.8, 1],
    'stone',
  );
  kit.add(box(1.4, 1.2, 0.4), '#111214', [0, 0.6, 0.85]);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (i / 8) * 0.7);
    kit.add(
      box(0.12, 1.1, 0.12),
      WOOD_DARK,
      [Math.cos(a) * 3, 0.55, Math.sin(a) * 3],
      [0, 0, (i % 2 ? 1 : -1) * 0.1],
    );
  }
  const fur = paint('#4a3426', 'cloth');
  const size = 1 + Math.min(level, 20) * 0.01;
  kit.add(
    new THREE.SphereGeometry(0.75, 10, 8),
    fur,
    [0.6, 0.75, 2],
    [0, 0.4, 0],
    [1.5 * size, 0.9 * size, 0.9 * size],
  );
  kit.add(new THREE.SphereGeometry(0.42, 10, 8), fur, [1.65, 1.05, 2.35], [0, 0, 0], [1.1, 1, 1]);
  kit.add(box(0.26, 0.2, 0.26), paint('#2a1d14', 'cloth'), [2.05, 0.98, 2.5]);
  for (const [x, z] of [
    [0, 1.7],
    [1.1, 1.7],
    [0, 2.4],
    [1.1, 2.5],
  ] as const)
    kit.add(cyl(0.18, 0.55, 6), fur, [x, 0.27, z]);
}

function siegeWorkshop(kit: ModelBuilder, level: number): void {
  // An open shed, a covered ram on wheels and a stone thrower.
  for (const x of [-2.4, 0.2]) for (const z of [-1.6, 0]) kit.add(box(0.18, 2, 0.18), WOOD_DARK, [x, 1, z]);
  kit.add(box(3, 0.12, 2.2), paint('#55543a', 'turf'), [-1.1, 2.05, -0.8], [0.15, 0, 0]);
  kit.add(box(3.05, 0.08, 2.25), SNOW, [-1.1, 2.13, -0.8], [0.15, 0, 0]);
  // Ram: a log hung under a gabled roof on four wheels.
  const ram = new ModelBuilder();
  ram.add(box(2.6, 0.12, 1), WOOD_DARK, [0, 0.55, 0]);
  for (const x of [-1, 1])
    for (const z of [-0.55, 0.55]) ram.add(cyl(0.32, 0.12, 10), WOOD, [x, 0.32, z], [Math.PI / 2, 0, 0]);
  ram.add(cyl(0.18, 3, 8), WOOD_LIGHT, [0.2, 0.95, 0], [0, 0, Math.PI / 2]);
  ram.add(cyl(0.22, 0.3, 8), IRON, [1.75, 0.95, 0], [0, 0, Math.PI / 2]);
  ram.add(box(2.6, 0.1, 0.8), paint('#6b6a45', 'turf'), [0, 1.45, 0.3], [0.7, 0, 0]);
  ram.add(box(2.6, 0.1, 0.8), paint('#6b6a45', 'turf'), [0, 1.45, -0.3], [-0.7, 0, 0]);
  kit.addBuilder(ram, [0.6, 0, 2.2]);
  if (level >= 3) {
    // Stone thrower: an A-frame with a throwing arm and a sling.
    for (const z of [-0.5, 0.5]) {
      kit.add(box(0.12, 1.8, 0.12), WOOD_DARK, [-2.2, 0.9, 1.6 + z], [0, 0, 0.25]);
      kit.add(box(0.12, 1.8, 0.12), WOOD_DARK, [-1.4, 0.9, 1.6 + z], [0, 0, -0.25]);
    }
    kit.add(box(2.6, 0.12, 0.12), WOOD_LIGHT, [-1.8, 1.6, 1.6], [0, 0, 0.6]);
    kit.add(new THREE.DodecahedronGeometry(0.25, 0), STONE, [-2.8, 0.25, 2.4]);
  }
}

function thingMound(kit: ModelBuilder, level: number): void {
  // The Thing: a low mound with the Law Rock, ringed by standing stones, and a banner.
  const mound = new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  kit.add(
    gradient(mound, '#5f7d4a', '#f2f5f8', 0.2, 1.1),
    undefined,
    [0, -0.3, 0],
    [0, 0, 0],
    [1, 0.5, 1],
    'turf',
  );
  kit.add(box(1.2, 0.9, 0.7), STONE, [0, 1.1, 0], [0, 0.3, 0]);
  const stones = 10;
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2;
    kit.add(
      box(0.35, 1.1, 0.25),
      i % 2 ? STONE : paint('#86868b', 'stone'),
      [Math.cos(a) * 3, 0.55, Math.sin(a) * 3],
      [0, -a, 0],
    );
  }
  kit.add(cyl(0.07, 3.6, 6), WOOD_DARK, [1, 1.8 + 0.2, -0.5]);
  kit.add(box(0.9, 0.6, 0.04), CLOTH(level >= 5 ? '#d8b13e' : '#a83a2c'), [1.48, 3.2, -0.5]);
}

function envoyHouse(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, { length: 4, width: 2.4, wallHeight: 1.4, roofHeight: 1.7, shields: true });
  // Banners of the realms the envoys visit, and gifts ready to carry.
  const flags = ['#2f5a7a', '#d8b13e', '#3f6e3a', '#a83a2c'];
  for (let i = 0; i < (level >= 4 ? 4 : 3); i++) {
    const x = -1.8 + i * 1.2;
    kit.add(cyl(0.05, 2.6, 5), WOOD_DARK, [x, 1.3, 2.4]);
    kit.add(box(0.6, 0.4, 0.03), CLOTH(flags[i]!), [x + 0.32, 2.3, 2.4]);
  }
  kit.add(box(0.8, 0.5, 0.5), WOOD, [1.9, 0.25, 1.9]);
  kit.add(box(0.82, 0.08, 0.52), paint('#d8b13e', 'metal'), [1.9, 0.5, 1.9]);
}

function runeHall(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, {
    length: 4.2,
    width: 2.5,
    wallHeight: 1.5,
    roofHeight: 1.8,
    shields: false,
    wall: '#6b4a32',
  });
  // Runestones in front, painted red like the Jelling stones once were.
  const count = level >= 5 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * 1.6;
    const h = 1.6 + (i % 2) * 0.4;
    kit.add(box(0.8, h, 0.3), paint('#8f8d8a', 'stone'), [x, h / 2, 2.6], [0, 0.15 * (i - 1), 0.04]);
    for (let r = 0; r < 4; r++)
      kit.add(box(0.5, 0.05, 0.02), paint('#a83a2c', 'plain'), [x, 0.4 + r * 0.32, 2.77]);
    kit.add(box(0.05, h * 0.8, 0.02), paint('#a83a2c', 'plain'), [x - 0.3, h * 0.45, 2.77]);
  }
}

function jarlHouse(kit: ModelBuilder, level: number): void {
  addLonghouse(kit, {
    length: 6,
    width: 3,
    wallHeight: 1.8,
    roofHeight: 2.2,
    shields: true,
    wall: '#7a4a2e',
  });
  // A carved porch, a cellar hatch and a well.
  for (const x of [-0.6, 0.6]) kit.add(box(0.2, 1.8, 0.2), WOOD_DARK, [x, 0.9, 2.2]);
  kit.add(box(1.6, 0.15, 1), WOOD_DARK, [0, 1.85, 1.95], [0.2, 0, 0]);
  kit.add(box(1.7, 0.08, 1.05), SNOW, [0, 1.93, 1.95], [0.2, 0, 0]);
  kit.add(box(1, 0.1, 0.8), WOOD_LIGHT, [2.2, 0.08, 2.4]);
  kit.add(box(0.06, 0.06, 0.8), IRON, [2.2, 0.15, 2.4]);
  if (level >= 3) {
    kit.add(cyl(0.5, 0.6, 10), STONE, [-2.4, 0.3, 2.4]);
    kit.add(box(1.1, 0.08, 0.08), WOOD_DARK, [-2.4, 1.3, 2.4]);
    for (const x of [-2.9, -1.9]) kit.add(box(0.08, 1.3, 0.08), WOOD_DARK, [x, 0.65, 2.4]);
  }
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
  palisade,
  rampart,
  builderLodge,
  shipyard,
  stable,
  bearDen,
  siegeWorkshop,
  thingMound,
  envoyHouse,
  runeHall,
  jarlHouse,
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
  palisade: { radius: 3.4, height: 4 },
  rampart: { radius: 3.8, height: 3.6 },
  builderLodge: { radius: 3, height: 3.4 },
  shipyard: { radius: 3.8, height: 3.4 },
  stable: { radius: 3.4, height: 3.6 },
  bearDen: { radius: 3.2, height: 2.6 },
  siegeWorkshop: { radius: 3.6, height: 2.6 },
  thingMound: { radius: 3.4, height: 3.6 },
  envoyHouse: { radius: 3, height: 3.6 },
  runeHall: { radius: 3.2, height: 3.8 },
  jarlHouse: { radius: 3.6, height: 4.4 },
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
      paint('#b08a5e', 'timber'),
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
      i % 2 ? STONE : paint('#9a989c', 'stone'),
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
  kit.add(
    gradient(mound, '#6b6a45', '#f2f5f8', 0.5, 2.6),
    undefined,
    [0, -0.2, 0],
    [0, 0, 0],
    [1.25, 0.75, 1],
    'snow',
  );
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
        i % 2 ? paint('#6f6f74', 'stone') : paint('#86868b', 'stone'),
        [x, tall / 2, side * w],
        [0, i * 0.4, side * 0.05],
      );
    }
  }
  kit.add(box(1.1, 1.3, 0.6), '#121417', [0, 0.55, 3.5], [-0.25, 0, 0]);
  kit.add(box(0.8, 1, 0.1), paint('#6fd3ff', 'glow'), [0, 0.5, 3.75], [-0.25, 0, 0]);
  return kit.build('barrow');
}
