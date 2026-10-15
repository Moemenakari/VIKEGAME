import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Builds a whole model (a house, its fields, its shields...) out of many simple
 * parts and merges them into ONE mesh with ONE shared material.
 *
 * This is the GPU version of "one query instead of 100": the renderer sends a
 * building to the GPU in a single draw call instead of one call per plank.
 */
export const KIT_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
});

export class ModelBuilder {
  private parts: THREE.BufferGeometry[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  /**
   * Adds a part. `color` paints it flat; omit it if the geometry already carries
   * a `color` attribute. Position / rotation / scale place it inside the model.
   */
  add(
    geometry: THREE.BufferGeometry,
    color?: THREE.ColorRepresentation,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ): this {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (color !== undefined || !g.getAttribute('color')) {
      const c = new THREE.Color(color ?? '#ff00ff');
      const colors = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    this.e.set(...rotation);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(...position), this.q, new THREE.Vector3(...scale));
    g = g.applyMatrix4(this.m);
    this.parts.push(g);
    return this;
  }

  /** Adds everything from another builder, transformed. */
  addBuilder(other: ModelBuilder, position: [number, number, number] = [0, 0, 0], rotationY = 0): this {
    for (const part of other.parts) this.add(part, undefined, position, [0, rotationY, 0]);
    return this;
  }

  build(name: string): THREE.Mesh {
    const merged = mergeGeometries(this.parts) ?? new THREE.BufferGeometry();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, KIT_MATERIAL);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    return mesh;
  }
}

/** Paints a geometry from `low` to `high` colour by height (e.g. turf to snow). */
export function gradient(
  geometry: THREE.BufferGeometry,
  low: THREE.ColorRepresentation,
  high: THREE.ColorRepresentation,
  from: number,
  to: number,
): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.getAttribute('position');
  const a = new THREE.Color(low);
  const b = new THREE.Color(high);
  const c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, THREE.MathUtils.smoothstep(pos.getY(i), from, to));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Bows the long (z) sides outward: 1 at the ends, 1 + amount in the middle. Length runs along x. */
export function bulge(geometry: THREE.BufferGeometry, length: number, amount: number): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = (2 * pos.getX(i)) / length;
    pos.setZ(i, pos.getZ(i) * (1 + amount * (1 - t * t)));
  }
  geometry.computeVertexNormals();
  return geometry;
}
