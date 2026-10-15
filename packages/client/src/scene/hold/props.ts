import type { Prop } from '@jarlheim/sim';
import { createRng, nextRange } from '@jarlheim/sim';
import * as THREE from 'three';
import { surfaceMaterial } from '../textures/surfaces';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Paints every vertex of a geometry, optionally blending towards `top` by height. */
function paint(
  geo: THREE.BufferGeometry,
  base: THREE.Color,
  top?: THREE.Color,
  from = 0,
  to = 1,
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(base);
    if (top) c.lerp(top, THREE.MathUtils.smoothstep(pos.getY(i), from, to));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** A low-poly Norway spruce: trunk + three snow-tipped tiers, one geometry. */
function pineGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1.1, 5).translate(0, 0.55, 0);
  const green = new THREE.Color('#2c5a3c');
  const snow = new THREE.Color('#e8eef3');
  const parts = [paint(trunk, new THREE.Color('#4a3426'))];
  const tiers = [
    { r: 1.25, h: 1.9, y: 1.6 },
    { r: 0.95, h: 1.6, y: 2.5 },
    { r: 0.62, h: 1.3, y: 3.3 },
  ];
  for (const tier of tiers) {
    const cone = new THREE.ConeGeometry(tier.r, tier.h, 7).translate(0, tier.y, 0);
    parts.push(paint(cone, green, snow, tier.y + tier.h * 0.3, tier.y + tier.h * 0.55));
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  return merged;
}

/** A craggy boulder with snow on top. Jitter is seeded so every build looks the same. */
function rockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const pos = geo.getAttribute('position');
  const rng = createRng(77);
  for (let i = 0; i < pos.count; i++) {
    const s = nextRange(rng, 0.75, 1.2);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s * 0.7, pos.getZ(i) * s);
  }
  geo.computeVertexNormals();
  return paint(geo, new THREE.Color('#5f636b'), new THREE.Color('#edf2f6'), 0.1, 0.55);
}

function instanced(
  geometry: THREE.BufferGeometry,
  props: Prop[],
  sink: number,
  name: string,
  material: THREE.Material,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, props.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  props.forEach((p, i) => {
    q.setFromAxisAngle(up, p.rotation);
    m.compose(
      new THREE.Vector3(p.x, p.y - sink * p.scale, p.z),
      q,
      new THREE.Vector3(p.scale, p.scale, p.scale),
    );
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function createForest(trees: Prop[]): THREE.InstancedMesh {
  return instanced(pineGeometry(), trees, 0.15, 'forest', surfaceMaterial('turf'));
}

export function createRocks(rocks: Prop[]): THREE.InstancedMesh {
  return instanced(rockGeometry(), rocks, 0.3, 'rocks', surfaceMaterial('stone'));
}
