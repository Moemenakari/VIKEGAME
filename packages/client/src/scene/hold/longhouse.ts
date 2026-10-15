import * as THREE from 'three';
import { ModelBuilder, bulge, gradient } from './modelKit';

/**
 * Procedural Viking longhouse, modelled on the boat-shaped halls of Trelleborg
 * and Borg (Lofoten): convex long walls, a turf roof under snow, crossed gable
 * boards, doors on the long side and painted round shields.
 *
 * Built along the x axis into a ModelBuilder, so a whole house is one draw call.
 */
export interface LonghouseSpec {
  length: number;
  width: number;
  wallHeight: number;
  roofHeight: number;
  shields: boolean;
  wallColor?: THREE.ColorRepresentation;
}

const WOOD = '#5b3f2c';
const WOOD_DARK = '#34241a';
const TURF = '#58593a';
const SNOW = '#f1f4f7';
const SHIELD_COLORS = ['#a83a2c', '#d8b13e', '#2f5a7a', '#e9e1cf', '#a83a2c'];
const BULGE = 0.14;
const FOOTING = 0.35;

/** Adds a longhouse to `kit`. Returns the height of the roof ridge. */
export function addLonghouse(kit: ModelBuilder, spec: LonghouseSpec): number {
  const { length: L, width: W, wallHeight: H, roofHeight: R } = spec;

  // Stone footing and timber walls.
  kit.add(bulge(new THREE.BoxGeometry(L + 0.5, FOOTING, W + 0.5, 10, 1, 1), L + 0.5, BULGE), '#77777a', [
    0,
    FOOTING / 2,
    0,
  ]);
  kit.add(bulge(new THREE.BoxGeometry(L, H, W, 12, 1, 1), L, BULGE), spec.wallColor ?? WOOD, [
    0,
    FOOTING + H / 2,
    0,
  ]);

  // Turf roof under snow: a triangular prism extruded along the length.
  const overhang = 0.45;
  const shape = new THREE.Shape();
  shape.moveTo(-(W / 2 + overhang), 0);
  shape.lineTo(W / 2 + overhang, 0);
  shape.lineTo(0, R);
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, { depth: L + 0.6, steps: 12, bevelEnabled: false });
  roof.translate(0, 0, -(L + 0.6) / 2);
  roof.rotateY(Math.PI / 2);
  bulge(roof, L + 0.6, BULGE);
  kit.add(gradient(roof, TURF, SNOW, R * 0.15, R * 0.55), undefined, [0, FOOTING + H - 0.05, 0]);

  // Crossed gable boards at both ends.
  const ridgeY = FOOTING + H + R;
  const board = new THREE.BoxGeometry(0.14, 1.5 * (R / 3.2), 0.22);
  for (const side of [-1, 1]) {
    for (const lean of [-1, 1]) {
      kit.add(
        board,
        WOOD_DARK,
        [side * (L / 2 + 0.32), ridgeY + 0.15, lean * 0.35 * (R / 3.2)],
        [lean * 0.6, 0, 0],
      );
    }
  }

  // Doors in the middle of each long side.
  const doorZ = (W / 2) * (1 + BULGE) + 0.02;
  const doorH = Math.min(1.7, H * 0.75);
  for (const side of [-1, 1]) {
    kit.add(new THREE.BoxGeometry(Math.min(1, L * 0.18), doorH, 0.12), WOOD_DARK, [
      0,
      FOOTING + doorH / 2,
      side * doorZ,
    ]);
  }

  if (spec.shields) {
    const shield = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14);
    const boss = new THREE.SphereGeometry(0.1, 8, 6);
    const count = SHIELD_COLORS.length;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count - 0.5) * (L - 2.2);
      if (Math.abs(x) < 0.9) continue; // keep the door clear
      const t = (2 * x) / L;
      const z = (W / 2) * (1 + BULGE * (1 - t * t)) + 0.06;
      kit.add(shield, SHIELD_COLORS[i], [x, FOOTING + H * 0.55, z], [Math.PI / 2, 0, 0]);
      kit.add(boss, '#b8b4a8', [x, FOOTING + H * 0.55, z + 0.06]);
    }
  }
  return ridgeY;
}

/** A tall pole with a triangular raven-red banner that ripples in the wind. */
export function createBanner(): { group: THREE.Group; update(time: number): void } {
  const group = new THREE.Group();
  const pole = new ModelBuilder()
    .add(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), '#4a3426', [0, 3, 0])
    .build('pole');
  group.add(pole);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9e2f25';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(128, 32);
  ctx.lineTo(0, 64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d8b13e';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#d8b13e';
  ctx.font = 'bold 34px serif';
  ctx.fillText('ᛉ', 20, 45);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const clothGeo = new THREE.PlaneGeometry(2.6, 1.3, 12, 1);
  clothGeo.translate(1.3, 0, 0);
  const rest = Float32Array.from(clothGeo.getAttribute('position').array);
  const cloth = new THREE.Mesh(
    clothGeo,
    new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  );
  cloth.position.y = 5.2;
  cloth.castShadow = true;
  group.add(cloth);

  return {
    group,
    update(time) {
      const pos = clothGeo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3]!;
        pos.setZ(i, Math.sin(x * 2.2 - time * 5) * 0.18 * (x / 2.6));
      }
      pos.needsUpdate = true;
    },
  };
}
