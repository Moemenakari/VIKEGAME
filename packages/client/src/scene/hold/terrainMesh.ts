import type { HoldTerrain } from '@jarlheim/sim';
import { HOLD_TERRAIN, createNoise2D } from '@jarlheim/sim';
import * as THREE from 'three';

/** Palette for a northern winter: snow, frozen grass, dark rock, wet shore. */
const C = {
  seabed: new THREE.Color('#2c3a44'),
  shore: new THREE.Color('#7d776c'),
  grass: new THREE.Color('#6f7d5a'),
  snow: new THREE.Color('#eef2f6'),
  snowShade: new THREE.Color('#cfd9e4'),
  rock: new THREE.Color('#545860'),
  rockDark: new THREE.Color('#3d4048'),
};

export function createTerrainMesh(t: HoldTerrain): THREE.Mesh {
  const res = t.resolution;
  const half = t.size / 2;
  const positions = new Float32Array(res * res * 3);
  for (let row = 0; row < res; row++) {
    for (let col = 0; col < res; col++) {
      const i = row * res + col;
      positions[i * 3] = col * t.cellSize - half;
      positions[i * 3 + 1] = t.heights[i]!;
      positions[i * 3 + 2] = row * t.cellSize - half;
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < res - 1; row++) {
    for (let col = 0; col < res - 1; col++) {
      const a = row * res + col;
      const b = a + 1;
      const c = a + res;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Colour each vertex from its height and steepness, with noise for snow patches.
  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(res * res * 3);
  const patches = createNoise2D(t.seed + 17);
  const color = new THREE.Color();
  for (let i = 0; i < res * res; i++) {
    const x = positions[i * 3]!;
    const h = positions[i * 3 + 1]!;
    const z = positions[i * 3 + 2]!;
    const up = normals.getY(i); // 1 = flat, 0 = vertical
    const patch = patches(x * 0.09, z * 0.09) * 0.5 + 0.5;

    if (h < t.waterLevel - 0.6) {
      color
        .copy(C.seabed)
        .lerp(C.shore, THREE.MathUtils.smoothstep(h, HOLD_TERRAIN.seabedDepth, t.waterLevel));
    } else if (h < t.waterLevel + 0.5) {
      color.copy(C.shore);
    } else {
      // Snow settles on flat ground; grass shows through in patches near sea level.
      const snowy = THREE.MathUtils.smoothstep(up, 0.72, 0.9);
      color.copy(C.grass).lerp(C.snowShade, THREE.MathUtils.smoothstep(patch + h * 0.05, 0.35, 0.6));
      color.lerp(C.snow, snowy * THREE.MathUtils.smoothstep(patch + h * 0.08, 0.3, 0.75));
      const rocky = 1 - THREE.MathUtils.smoothstep(up, 0.55, 0.78);
      color.lerp(patch > 0.5 ? C.rock : C.rockDark, rocky);
      // High peaks are white again.
      color.lerp(C.snow, THREE.MathUtils.smoothstep(h, 16, 22) * (0.4 + 0.6 * (1 - rocky)));
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Faceted, hand-made look: each triangle gets one flat normal.
  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
