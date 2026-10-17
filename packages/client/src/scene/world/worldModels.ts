import * as THREE from 'three';
import { ModelBuilder, paint } from '../hold/modelKit';

/**
 * Small models for the world map (procedural, like everything else: D-021): marching
 * warriors, riders' horses, ox carts, wolves, bears, outlaw tents and treasure chests.
 * Each is one merged mesh, drawn as an InstancedMesh (one draw call per kind).
 */

const cloth = (c: string) => paint(c, 'cloth');

/** A warrior on the march: legs, tunic, round shield on the back, spear over the shoulder. */
export function soldierModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  kit.add(new THREE.CylinderGeometry(0.1, 0.11, 0.75, 6), cloth('#3c342c'), [-0.12, 0.38, 0]);
  kit.add(new THREE.CylinderGeometry(0.1, 0.11, 0.75, 6), cloth('#3c342c'), [0.12, 0.38, 0]);
  // White tunic: the instance colour (alliance) shows through.
  kit.add(new THREE.CylinderGeometry(0.22, 0.32, 0.8, 8), cloth('#ffffff'), [0, 1.1, 0]);
  kit.add(new THREE.SphereGeometry(0.18, 10, 8), paint('#e2b896', 'plain'), [0, 1.68, 0]);
  // Iron helmet (no horns: D-019).
  kit.add(
    new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    paint('#8d939a', 'metal'),
    [0, 1.72, 0],
  );
  kit.add(
    new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14),
    paint('#a3332a', 'wood'),
    [0, 1.15, -0.3],
    [Math.PI / 2, 0, 0],
  );
  kit.add(
    new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5),
    paint('#6b4a2e', 'timber'),
    [0.3, 1.4, 0.05],
    [0.25, 0, 0],
  );
  return kit.build('soldier');
}

/** A rider's horse with its rider (Anglo-Saxon Chronicle 866: the Great Army took horses). */
export function horseModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  const hide = paint('#6a4a32', 'cloth');
  kit.add(new THREE.CapsuleGeometry(0.42, 1.2, 4, 10), hide, [0, 1.2, 0], [0, 0, Math.PI / 2]);
  kit.add(new THREE.CapsuleGeometry(0.2, 0.6, 4, 8), hide, [0.85, 1.65, 0], [0, 0, -0.7]);
  kit.add(new THREE.BoxGeometry(0.5, 0.26, 0.26), hide, [1.15, 1.95, 0], [0, 0, -0.3]);
  for (const [x, z] of [
    [-0.55, -0.22],
    [-0.55, 0.22],
    [0.55, -0.22],
    [0.55, 0.22],
  ] as const)
    kit.add(new THREE.CylinderGeometry(0.08, 0.07, 1, 6), paint('#3a2a1e', 'plain'), [x, 0.5, z]);
  kit.add(new THREE.ConeGeometry(0.12, 0.7, 6), paint('#2a1e16', 'plain'), [-0.95, 1.2, 0], [0, 0, -2.4]);
  // Rider: white cloak takes the alliance colour.
  kit.add(new THREE.CylinderGeometry(0.2, 0.28, 0.75, 8), cloth('#ffffff'), [0, 1.95, 0]);
  kit.add(new THREE.SphereGeometry(0.17, 10, 8), paint('#e2b896', 'plain'), [0, 2.5, 0]);
  kit.add(
    new THREE.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    paint('#8d939a', 'metal'),
    [0, 2.54, 0],
  );
  return kit.build('horse');
}

/** An ox cart carrying goods home. */
export function cartModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  const wood = paint('#7a573c', 'wood');
  kit.add(new THREE.BoxGeometry(1.8, 0.5, 1.1), wood, [0, 0.9, 0]);
  for (const z of [-0.62, 0.62])
    kit.add(
      new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12),
      paint('#4a3426', 'timber'),
      [0, 0.5, z],
      [Math.PI / 2, 0, 0],
    );
  // Sacks and logs on the cart (white sacks take the alliance colour).
  kit.add(new THREE.SphereGeometry(0.35, 8, 6), cloth('#ffffff'), [-0.35, 1.35, 0], [0, 0, 0], [1, 0.8, 1]);
  kit.add(new THREE.SphereGeometry(0.35, 8, 6), cloth('#ffffff'), [0.35, 1.35, 0.1], [0, 0, 0], [1, 0.8, 1]);
  kit.add(new THREE.BoxGeometry(1.5, 0.1, 0.1), wood, [1.6, 0.85, 0]);
  // The ox.
  const ox = paint('#5a4636', 'cloth');
  kit.add(new THREE.CapsuleGeometry(0.38, 0.8, 4, 8), ox, [2.4, 0.95, 0], [0, 0, Math.PI / 2]);
  kit.add(new THREE.SphereGeometry(0.26, 8, 6), ox, [3.05, 1.05, 0]);
  for (const [x, z] of [
    [2.05, -0.2],
    [2.05, 0.2],
    [2.75, -0.2],
    [2.75, 0.2],
  ] as const)
    kit.add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 5), paint('#3a2a1e', 'plain'), [x, 0.3, z]);
  return kit.build('cart');
}

export function wolfModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  const fur = paint('#8a8c90', 'cloth');
  kit.add(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), fur, [0, 0.75, 0], [0, 0, Math.PI / 2]);
  kit.add(new THREE.ConeGeometry(0.22, 0.6, 6), fur, [0.85, 0.9, 0], [0, 0, -Math.PI / 2]);
  kit.add(new THREE.ConeGeometry(0.07, 0.2, 4), fur, [0.62, 1.15, -0.1]);
  kit.add(new THREE.ConeGeometry(0.07, 0.2, 4), fur, [0.62, 1.15, 0.1]);
  for (const [x, z] of [
    [-0.4, -0.15],
    [-0.4, 0.15],
    [0.4, -0.15],
    [0.4, 0.15],
  ] as const)
    kit.add(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 5), fur, [x, 0.25, z]);
  kit.add(new THREE.ConeGeometry(0.1, 0.7, 5), fur, [-0.8, 0.8, 0], [0, 0, 2.2]);
  return kit.build('wolf');
}

export function bearModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  const fur = paint('#5e3e26', 'cloth');
  kit.add(new THREE.CapsuleGeometry(0.75, 1.3, 4, 10), fur, [0, 1.15, 0], [0, 0, Math.PI / 2]);
  kit.add(new THREE.SphereGeometry(0.5, 10, 8), fur, [1.2, 1.4, 0]);
  kit.add(new THREE.SphereGeometry(0.22, 8, 6), paint('#3a2616', 'plain'), [1.6, 1.3, 0]);
  for (const z of [-0.3, 0.3]) kit.add(new THREE.SphereGeometry(0.14, 6, 6), fur, [1.15, 1.85, z]);
  for (const [x, z] of [
    [-0.6, -0.4],
    [-0.6, 0.4],
    [0.6, -0.4],
    [0.6, 0.4],
  ] as const)
    kit.add(new THREE.CylinderGeometry(0.22, 0.2, 0.8, 7), fur, [x, 0.4, z]);
  return kit.build('bear');
}

/** An outlaws' camp: a hide tent, a fire, a stolen chest. */
export function tentModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  kit.add(new THREE.ConeGeometry(2, 2.6, 6), paint('#8a7454', 'cloth'), [0, 1.3, 0]);
  kit.add(new THREE.BoxGeometry(0.7, 1.1, 0.1), '#1d1712', [0, 0.55, 1.62], [-0.45, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    kit.add(
      new THREE.CylinderGeometry(0.08, 0.08, 0.9, 5),
      paint('#4a3426', 'timber'),
      [3 + Math.cos(a) * 0.3, 0.15, 1 + Math.sin(a) * 0.3],
      [Math.PI / 2, a, 0],
    );
  }
  kit.add(new THREE.ConeGeometry(0.35, 0.8, 6), paint('#ff8a2a', 'glow'), [3, 0.5, 1]);
  kit.add(new THREE.BoxGeometry(0.9, 0.6, 0.6), paint('#7a573c', 'wood'), [-2.4, 0.3, 1.2]);
  return kit.build('tent');
}

/** A buried hoard dug up: an iron-bound chest and silver. */
export function chestModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  kit.add(new THREE.BoxGeometry(1.6, 0.9, 1), paint('#6a4a2e', 'wood'), [0, 0.45, 0]);
  kit.add(
    new THREE.CylinderGeometry(0.5, 0.5, 1.6, 12, 1, false, 0, Math.PI),
    paint('#7a573c', 'wood'),
    [0, 0.9, 0],
    [0, 0, Math.PI / 2],
  );
  kit.add(new THREE.BoxGeometry(1.64, 0.12, 1.04), paint('#8d939a', 'metal'), [0, 0.7, 0]);
  for (let i = 0; i < 6; i++)
    kit.add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), paint('#d8dde3', 'metal'), [
      -1.4 + (i % 3) * 0.4,
      0.04 + Math.floor(i / 3) * 0.06,
      0.9,
    ]);
  return kit.build('chest');
}
