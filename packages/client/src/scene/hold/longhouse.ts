import * as THREE from 'three';

/**
 * Procedural Viking longhouse, modelled on the boat-shaped halls of Trelleborg
 * and Borg (Lofoten): convex long walls, a turf roof under snow, crossed gable
 * boards, doors on the long side and painted round shields.
 *
 * The house is built along the x axis; rotate the returned group to place it.
 */
export interface LonghouseSpec {
  length: number;
  width: number;
  wallHeight: number;
  roofHeight: number;
  shields: boolean;
}

const WOOD = new THREE.Color('#5b3f2c');
const WOOD_DARK = new THREE.Color('#34241a');
const TURF = new THREE.Color('#58593a');
const SNOW = new THREE.Color('#f1f4f7');
const SHIELD_COLORS = ['#a83a2c', '#d8b13e', '#2f5a7a', '#e9e1cf', '#a83a2c'];

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(
  color: string | null,
  opts: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const key = `${color}|${JSON.stringify(opts)}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      ...(color ? { color } : { vertexColors: true }),
      roughness: 0.85,
      flatShading: true,
      ...opts,
    });
    materialCache.set(key, m);
  }
  return m;
}

/** Bows the long sides outward: 1 at the gables, 1 + amount in the middle. */
function bulge(geo: THREE.BufferGeometry, length: number, amount: number): void {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = (2 * pos.getX(i)) / length;
    pos.setZ(i, pos.getZ(i) * (1 + amount * (1 - t * t)));
  }
  geo.computeVertexNormals();
}

function colorByHeight(
  geo: THREE.BufferGeometry,
  low: THREE.Color,
  high: THREE.Color,
  from: number,
  to: number,
): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(low).lerp(high, THREE.MathUtils.smoothstep(pos.getY(i), from, to));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

export function createLonghouse(spec: LonghouseSpec): THREE.Group {
  const { length: L, width: W, wallHeight: H, roofHeight: R } = spec;
  const group = new THREE.Group();
  const BULGE = 0.14;

  // Stone footing.
  const footing = new THREE.BoxGeometry(L + 0.5, 0.35, W + 0.5, 10, 1, 1);
  bulge(footing, L + 0.5, BULGE);
  group.add(shadowed(new THREE.Mesh(footing, mat('#77777a'))).translateY(0.17));

  // Walls of vertical timber.
  const walls = new THREE.BoxGeometry(L, H, W, 12, 1, 1);
  bulge(walls, L, BULGE);
  group.add(shadowed(new THREE.Mesh(walls, mat(`#${WOOD.getHexString()}`))).translateY(0.35 + H / 2));

  // Turf roof with snow: a triangular prism extruded along the length.
  const overhang = 0.45;
  const shape = new THREE.Shape();
  shape.moveTo(-(W / 2 + overhang), 0);
  shape.lineTo(W / 2 + overhang, 0);
  shape.lineTo(0, R);
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, { depth: L + 0.6, steps: 12, bevelEnabled: false });
  roof.translate(0, 0, -(L + 0.6) / 2);
  roof.rotateY(Math.PI / 2); // extrusion now runs along x
  bulge(roof, L + 0.6, BULGE);
  colorByHeight(roof, TURF, SNOW, R * 0.15, R * 0.55);
  const roofMesh = shadowed(new THREE.Mesh(roof, mat(null, { roughness: 0.95 })));
  roofMesh.position.y = 0.35 + H - 0.05;
  group.add(roofMesh);

  // Crossed gable boards at both ends (the carved "dragon" tips of Norse halls).
  const ridgeY = 0.35 + H + R;
  for (const side of [-1, 1]) {
    for (const lean of [-1, 1]) {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 1.5, 0.22),
        mat(`#${WOOD_DARK.getHexString()}`),
      );
      board.position.set(side * (L / 2 + 0.32), ridgeY + 0.15, lean * 0.35);
      board.rotation.x = lean * 0.6;
      group.add(shadowed(board));
    }
  }

  // Doors in the middle of each long side.
  const doorZ = (W / 2) * (1 + BULGE) + 0.02;
  for (const side of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.12), mat(`#${WOOD_DARK.getHexString()}`));
    door.position.set(0, 0.35 + 0.85, side * doorZ);
    group.add(door);
  }

  // A row of painted round shields along the front wall.
  if (spec.shields) {
    const shieldGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14).rotateX(Math.PI / 2);
    const bossGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const count = SHIELD_COLORS.length;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count - 0.5) * (L - 2.2);
      if (Math.abs(x) < 0.9) continue; // keep the door clear
      const t = (2 * x) / L;
      const z = (W / 2) * (1 + BULGE * (1 - t * t)) + 0.06;
      const shield = new THREE.Mesh(shieldGeo, mat(SHIELD_COLORS[i]!));
      shield.position.set(x, 0.35 + H * 0.55, z);
      const boss = new THREE.Mesh(bossGeo, mat('#b8b4a8', { metalness: 0.6, roughness: 0.4 }));
      boss.position.set(x, 0.35 + H * 0.55, z + 0.06);
      group.add(shield, boss);
    }
  }

  group.userData.smokeOrigin = new THREE.Vector3(0, ridgeY + 0.1, 0);
  group.userData.footprint = Math.max(L, W) / 2 + 1;
  return group;
}

/** A tall pole with a triangular raven-red banner that ripples in the wind. */
export function createBanner(): { group: THREE.Group; update(time: number): void } {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), mat('#4a3426'));
  pole.position.y = 3;
  group.add(shadowed(pole));

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
