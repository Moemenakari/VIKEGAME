import * as THREE from 'three';
import { ModelBuilder, bulge, paint, type Paint } from './modelKit';

/**
 * Procedural Viking longhouse, modelled on the boat-shaped halls of Trelleborg
 * and Borg (Lofoten): convex plank walls on a stone footing, slanting outer posts
 * propping the walls (as at Trelleborg), a timber frame, a turf roof with a thick
 * snow cap, carved dragon-head gable ends, doors with iron bands and painted shields.
 *
 * Built along the x axis into a ModelBuilder, so a whole house is one mesh.
 */
export interface LonghouseSpec {
  length: number;
  width: number;
  wallHeight: number;
  roofHeight: number;
  shields: boolean;
  /** Walls of another material or colour (a plain colour means planks of that colour). */
  wall?: Paint | THREE.ColorRepresentation;
}

export const P = {
  wood: paint('#8a6446', 'wood'),
  timber: paint('#5e4330', 'timber'),
  timberDark: paint('#3e2c20', 'timber'),
  stone: paint('#8c8a86', 'stone'),
  turf: paint('#55543a', 'turf'),
  snow: paint('#f4f7fa', 'snow'),
  iron: paint('#5d6268', 'metal'),
} satisfies Record<string, Paint>;

const SHIELD_COLORS = ['#a83a2c', '#d8b13e', '#2f5a7a', '#e9e1cf', '#a83a2c'];
const BULGE = 0.14;
const FOOTING = 0.35;

/** Smooth pseudo-random wobble for snow edges (deterministic). */
const wobble = (x: number, seed: number) =>
  Math.sin(x * 2.1 + seed) * 0.5 + Math.sin(x * 5.3 + seed * 2) * 0.3;

function roofPrism(halfWidth: number, height: number, length: number, steps: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, steps, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** A carved dragon head on a curling neck, for the gable tips. */
function dragonHead(kit: ModelBuilder, x: number, y: number, dir: number, size: number): void {
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.15 * dir, 0.45, 0),
    new THREE.Vector3(0.45 * dir, 0.8, 0),
    new THREE.Vector3(0.85 * dir, 0.85, 0),
    new THREE.Vector3(1.05 * dir, 0.65, 0),
  ].map((p) => p.multiplyScalar(size));
  const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.09 * size, 6, false);
  kit.add(neck, P.timberDark, [x, y, 0]);
  kit.add(
    new THREE.ConeGeometry(0.12 * size, 0.42 * size, 6),
    P.timberDark,
    [x + 1.15 * dir * size, y + 0.62 * size, 0],
    [0, 0, (dir * -Math.PI) / 2.4],
  );
}

/** Adds a longhouse to `kit`. Returns the height of the roof ridge. */
export function addLonghouse(kit: ModelBuilder, spec: LonghouseSpec): number {
  const { length: L, width: W, wallHeight: H, roofHeight: R } = spec;
  const wall =
    spec.wall === undefined
      ? P.wood
      : typeof spec.wall === 'object' && 'surface' in spec.wall
        ? spec.wall
        : paint(spec.wall, 'wood');
  const zAt = (x: number, half: number) => half * (1 + BULGE * (1 - ((2 * x) / L) ** 2));

  // Stone footing and plank walls.
  kit.add(bulge(new THREE.BoxGeometry(L + 0.5, FOOTING, W + 0.5, 10, 1, 1), L + 0.5, BULGE), P.stone, [
    0,
    FOOTING / 2,
    0,
  ]);
  kit.add(bulge(new THREE.BoxGeometry(L, H, W, 12, 1, 1), L, BULGE), wall, [0, FOOTING + H / 2, 0]);

  // Timber frame: sill and wall-plate beams, corner posts, and raking outer posts.
  for (const side of [-1, 1]) {
    for (const y of [FOOTING + 0.08, FOOTING + H - 0.08]) {
      const beam = bulge(new THREE.BoxGeometry(L + 0.1, 0.16, 0.16, 12, 1, 1), L, 0);
      const pos = beam.getAttribute('position');
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + side * zAt(pos.getX(i), W / 2 + 0.06));
      beam.computeVertexNormals();
      kit.add(beam, P.timber, [0, y, 0]);
    }
    const posts = Math.max(2, Math.round(L / 2.4));
    for (let i = 0; i <= posts; i++) {
      const x = -L / 2 + (i / posts) * L;
      const z = side * zAt(x, W / 2 + 0.1);
      kit.add(new THREE.BoxGeometry(0.18, H, 0.18), P.timber, [x, FOOTING + H / 2, z]);
      if (i > 0 && i < posts && L > 6) {
        // Trelleborg-style slanting post leaning against the wall.
        kit.add(
          new THREE.BoxGeometry(0.16, H * 1.05, 0.16),
          P.timberDark,
          [x, FOOTING + H / 2 - 0.05, z + side * 0.42],
          [side * 0.32, 0, 0],
        );
      }
    }
  }

  // Turf roof, then a thick snow cap with a ragged lower edge.
  const overhang = 0.45;
  const turf = roofPrism(W / 2 + overhang, R, L + 0.6, 12);
  bulge(turf, L + 0.6, BULGE);
  kit.add(turf, P.turf, [0, FOOTING + H - 0.05, 0]);

  const capBase = 0.28;
  const cap = roofPrism((W / 2 + overhang) * (1 - capBase) + 0.08, R * (1 - capBase) + 0.12, L + 0.75, 24);
  bulge(cap, L + 0.75, BULGE);
  const cp = cap.getAttribute('position');
  for (let i = 0; i < cp.count; i++) {
    if (cp.getY(i) < 0.02)
      cp.setY(i, cp.getY(i) - 0.12 - 0.18 * (wobble(cp.getX(i), cp.getZ(i) > 0 ? 1 : 2) + 0.8) * 0.5);
  }
  cap.computeVertexNormals();
  kit.add(cap, P.snow, [0, FOOTING + H - 0.05 + R * capBase, 0]);

  // Ridge beam and barge boards along the gable edges, ending in dragon heads.
  const ridgeY = FOOTING + H + R;
  kit.add(new THREE.BoxGeometry(L + 0.9, 0.16, 0.2), P.timberDark, [0, ridgeY + 0.08, 0]);
  const slope = Math.atan2(R, W / 2 + overhang);
  const rafter = Math.hypot(R, W / 2 + overhang);
  for (const end of [-1, 1]) {
    const x = end * (L / 2 + 0.36);
    for (const side of [-1, 1]) {
      kit.add(
        new THREE.BoxGeometry(0.12, 0.22, rafter + 0.2),
        P.timber,
        [x, FOOTING + H + R / 2, (side * (W / 2 + overhang)) / 2],
        [side * slope, 0, 0],
      );
    }
    if (R > 1.6) dragonHead(kit, x, ridgeY, end, R / 3.2);
  }

  // Doors with iron bands in the middle of each long side.
  const doorZ = zAt(0, W / 2) + 0.03;
  const doorH = Math.min(1.7, H * 0.75);
  const doorW = Math.min(1, L * 0.18);
  for (const side of [-1, 1]) {
    kit.add(new THREE.BoxGeometry(doorW + 0.24, doorH + 0.14, 0.14), P.timber, [
      0,
      FOOTING + doorH / 2 + 0.04,
      side * doorZ,
    ]);
    kit.add(new THREE.BoxGeometry(doorW, doorH, 0.16), P.timberDark, [0, FOOTING + doorH / 2, side * doorZ]);
    for (const y of [0.3, 0.75]) {
      kit.add(new THREE.BoxGeometry(doorW * 0.9, 0.06, 0.18), P.iron, [0, FOOTING + doorH * y, side * doorZ]);
    }
  }

  if (spec.shields) {
    const shield = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18);
    const rim = new THREE.TorusGeometry(0.42, 0.035, 6, 18);
    const boss = new THREE.SphereGeometry(0.1, 10, 8);
    const count = SHIELD_COLORS.length;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count - 0.5) * (L - 2.2);
      if (Math.abs(x) < 0.9) continue; // keep the door clear
      const z = zAt(x, W / 2) + 0.12;
      const y = FOOTING + H * 0.55;
      kit.add(shield, paint(SHIELD_COLORS[i]!, 'wood'), [x, y, z], [Math.PI / 2, 0, 0]);
      kit.add(rim, P.iron, [x, y, z + 0.03]);
      kit.add(boss, P.iron, [x, y, z + 0.07]);
    }
  }
  return ridgeY;
}

/** A tall pole with a triangular raven-red banner that ripples in the wind. */
export function createBanner(): { group: THREE.Group; update(time: number): void } {
  const group = new THREE.Group();
  const pole = new ModelBuilder()
    .add(new THREE.CylinderGeometry(0.07, 0.09, 6, 8), P.timber, [0, 3, 0])
    .add(new THREE.ConeGeometry(0.12, 0.35, 8), P.iron, [0, 6.15, 0])
    .build('pole');
  group.add(pole);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9e2f25';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(256, 64);
  ctx.lineTo(0, 128);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d8b13e';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = '#d8b13e';
  ctx.font = 'bold 68px serif';
  ctx.fillText('ᛉ', 40, 90);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const clothGeo = new THREE.PlaneGeometry(2.6, 1.3, 16, 2);
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
      clothGeo.computeVertexNormals();
    },
  };
}
