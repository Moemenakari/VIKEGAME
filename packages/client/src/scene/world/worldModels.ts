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

/** A small fenced field of barley rows next to a hold. */
export function fieldModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  kit.add(new THREE.BoxGeometry(4.4, 0.12, 3), paint('#6b5a3a', 'ground'), [0, 0.06, 0]);
  for (let i = 0; i < 6; i++)
    kit.add(new THREE.BoxGeometry(4, 0.35, 0.28), paint('#c9a94e', 'turf'), [0, 0.25, -1.2 + i * 0.48]);
  const post = paint('#5a4030', 'timber');
  for (const [x, z, w, d] of [
    [0, -1.55, 4.6, 0.08],
    [0, 1.55, 4.6, 0.08],
    [-2.3, 0, 0.08, 3.1],
    [2.3, 0, 0.08, 3.1],
  ] as const)
    kit.add(new THREE.BoxGeometry(w, 0.08, d), post, [x, 0.5, z]);
  return kit.build('field');
}

/** Low bushes for open land (one InstancedMesh for the whole realm). */
export function createBushes(
  props: Array<{ x: number; y: number; z: number; scale: number; rotation: number }>,
) {
  const kit = new ModelBuilder();
  kit.add(
    new THREE.IcosahedronGeometry(0.7, 0),
    paint('#3f5a34', 'turf'),
    [0, 0.45, 0],
    [0, 0, 0],
    [1.2, 0.8, 1],
  );
  kit.add(
    new THREE.IcosahedronGeometry(0.5, 0),
    paint('#4d6a3c', 'turf'),
    [0.6, 0.35, 0.2],
    [0.4, 0, 0],
    [1, 0.8, 1],
  );
  const model = kit.build('bush');
  const mesh = new THREE.InstancedMesh(model.geometry, model.material, Math.max(1, props.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  props.forEach((p, i) => {
    q.setFromAxisAngle(up, p.rotation);
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
    mesh.setMatrixAt(i, m);
  });
  mesh.count = props.length;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Fine detail for the painted ground: a tiling grain (grass blades, snow crust, gravel)
 * mixed in at two scales, so the land stays crisp when you zoom right in.
 */
export function addGroundDetail(material: THREE.MeshStandardMaterial, repeat: number): void {
  const N = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  // Periodic waves (whole numbers of cycles, so it tiles) plus a fine seeded grain.
  let seed = 1234567;
  const rand = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const waves = Array.from({ length: 14 }, () => ({
    fx: 1 + Math.floor(rand() * 9),
    fy: 1 + Math.floor(rand() * 9),
    ph: rand() * Math.PI * 2,
    a: 0.3 + rand(),
  }));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0;
      for (const w of waves) v += Math.sin(((w.fx * x + w.fy * y) / N) * Math.PI * 2 + w.ph) * w.a;
      v = 0.5 + v / 18 + (rand() - 0.5) * 0.35;
      const c = Math.max(0, Math.min(255, v * 255));
      const o = (y * N + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = c;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: tex };
    shader.uniforms.detailRepeat = { value: repeat };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D detailMap;\nuniform float detailRepeat;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float dn = texture2D(detailMap, vMapUv * detailRepeat).r * 0.6
          + texture2D(detailMap, vMapUv * detailRepeat * 3.7).r * 0.4;
        diffuseColor.rgb *= 0.8 + dn * 0.4;`,
      );
  };
}

/** An ox grazing by a farm (the Viking Age plough and cart beast). */
export function oxModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  const hide = paint('#6e5640', 'cloth');
  kit.add(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), hide, [0, 0.95, 0], [0, 0, Math.PI / 2]);
  kit.add(new THREE.SphereGeometry(0.3, 8, 6), hide, [0.82, 0.95, 0], [0, 0, 0], [1.2, 0.9, 0.9]);
  for (const z of [-0.22, 0.22])
    kit.add(
      new THREE.ConeGeometry(0.05, 0.35, 5),
      paint('#e8dcc4', 'plain'),
      [0.85, 1.25, z],
      [0.6 * Math.sign(z), 0, -0.4],
    );
  for (const [x, z] of [
    [-0.45, -0.2],
    [-0.45, 0.2],
    [0.45, -0.2],
    [0.45, 0.2],
  ] as const)
    kit.add(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 5), paint('#3a2a1e', 'plain'), [x, 0.3, z]);
  return kit.build('ox');
}

export function sheepModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  kit.add(
    new THREE.IcosahedronGeometry(0.45, 1),
    paint('#ece6da', 'cloth'),
    [0, 0.62, 0],
    [0, 0, 0],
    [1.35, 0.95, 0.9],
  );
  kit.add(
    new THREE.IcosahedronGeometry(0.2, 1),
    paint('#2c2826', 'plain'),
    [0.62, 0.75, 0],
    [0, 0, 0],
    [1.3, 1, 0.9],
  );
  for (const [x, z] of [
    [-0.3, -0.18],
    [-0.3, 0.18],
    [0.3, -0.18],
    [0.3, 0.18],
  ] as const)
    kit.add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), paint('#2c2826', 'plain'), [x, 0.2, z]);
  return kit.build('sheep');
}

/** A covered battering ram on wheels (Siege of Paris, 885–886): the war machines of the march. */
export function ramModel(): THREE.Mesh {
  const kit = new ModelBuilder();
  const wood = paint('#6a4a2e', 'wood');
  kit.add(new THREE.BoxGeometry(3, 0.25, 1.4), wood, [0, 0.7, 0]);
  for (const x of [-1.1, 1.1])
    for (const z of [-0.78, 0.78])
      kit.add(
        new THREE.CylinderGeometry(0.42, 0.42, 0.15, 12),
        paint('#3d2a1c', 'timber'),
        [x, 0.42, z],
        [Math.PI / 2, 0, 0],
      );
  // The roof of hides over the ram.
  kit.add(
    new THREE.CylinderGeometry(0.01, 1.1, 1.3, 4, 1),
    paint('#8a6e4c', 'cloth'),
    [0, 1.5, 0],
    [0, Math.PI / 4, 0],
    [1.9, 1, 0.9],
  );
  kit.add(
    new THREE.CylinderGeometry(0.2, 0.22, 3.6, 8),
    paint('#5a3e28', 'timber'),
    [0.4, 1.05, 0],
    [0, 0, Math.PI / 2],
  );
  kit.add(new THREE.SphereGeometry(0.28, 8, 6), paint('#8d939a', 'metal'), [2.2, 1.05, 0]);
  return kit.build('ram');
}
