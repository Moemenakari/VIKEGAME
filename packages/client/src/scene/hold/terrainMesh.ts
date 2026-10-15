import type { HoldTerrain } from '@jarlheim/sim';
import { HOLD_TERRAIN, PLOTS, createNoise2D } from '@jarlheim/sim';
import * as THREE from 'three';
import { TEXEL_SCALE, surfaceMaterial } from '../textures/surfaces';

/** Palette for a northern winter: snow, frozen grass, dark rock, wet shore. */
const C = {
  seabed: new THREE.Color('#2c3a44'),
  shore: new THREE.Color('#7d776c'),
  grass: new THREE.Color('#6f7d5a'),
  snow: new THREE.Color('#eef2f6'),
  snowShade: new THREE.Color('#cfd9e4'),
  rock: new THREE.Color('#545860'),
  rockDark: new THREE.Color('#3d4048'),
  path: new THREE.Color('#a39886'),
  mud: new THREE.Color('#6e5d4c'),
};

/** Distance from point p to segment ab (2D). */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Colour each vertex from its height and steepness, with noise for snow patches.
  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(res * res * 3);
  const patches = createNoise2D(t.seed + 17);
  const color = new THREE.Color();
  // Footpaths trodden in the snow: from the hall's doors to every plot, a ring round
  // the hall, down to the shore by the ship, and out to the barrow.
  const hx = t.hall.x;
  const hz = t.hall.z;
  const paths: Array<[number, number, number, number]> = [];
  for (const p of PLOTS) {
    const door = p.dz > 0 ? 3.4 : -3.4;
    paths.push([hx, hz + door, hx + p.dx, hz + p.dz]);
  }
  paths.push([hx, hz + 3.4, t.harbor.x * 0.75, t.harbor.z * 0.7]);
  paths.push([hx, hz + 3.4, t.barrow.x, t.barrow.z]);
  for (let i = 0; i < res * res; i++) {
    const x = positions[i * 3]!;
    const h = positions[i * 3 + 1]!;
    const z = positions[i * 3 + 2]!;
    const up = normals.getY(i); // 1 = flat, 0 = vertical
    const patch = (patches(x * 0.16, z * 0.16) * 0.7 + patches(x * 0.45, z * 0.45) * 0.3) * 0.5 + 0.5;
    const inSettlement = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - hx, z - hz), 20, 30);

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
      // The settlement is under clean snow, with paths trodden through it.
      color.lerp(C.snow, inSettlement * 0.6 * (1 - rocky));
      let pathD = Math.abs(Math.hypot(x - hx, z - hz) - 8.6);
      for (const [ax, az, bx, bz] of paths) pathD = Math.min(pathD, segDist(x, z, ax, az, bx, bz));
      const onPath = 1 - THREE.MathUtils.smoothstep(pathD, 0.7, 1.8);
      if (onPath > 0) {
        color.lerp(C.path, onPath * 0.9);
        color.lerp(C.mud, (1 - THREE.MathUtils.smoothstep(pathD, 0, 0.8)) * 0.6 * (0.5 + patch));
      }
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Smooth shading plus a tiling ground texture (snow crust, pebbles, sparkle) for close-up detail.
  const uvs = new Float32Array(res * res * 2);
  for (let i = 0; i < res * res; i++) {
    uvs[i * 2] = positions[i * 3]! * TEXEL_SCALE.ground;
    uvs[i * 2 + 1] = positions[i * 3 + 2]! * TEXEL_SCALE.ground;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  const material = surfaceMaterial('ground');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
