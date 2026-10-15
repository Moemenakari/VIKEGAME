import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SURFACE_KINDS, TEXEL_SCALE, surfaceMaterial, type SurfaceKind } from '../textures/surfaces';

/**
 * Builds a whole model (a house, its beams, its shields...) out of many simple
 * parts, then merges every part made of the same surface (wood, stone, snow...)
 * into one geometry. A building becomes ONE mesh with a handful of material
 * groups: the GPU version of "one query instead of 100".
 */
export interface Paint {
  color: THREE.ColorRepresentation;
  surface: SurfaceKind;
}

export const paint = (color: THREE.ColorRepresentation, surface: SurfaceKind): Paint => ({ color, surface });

const isPaint = (c: unknown): c is Paint => typeof c === 'object' && c !== null && 'surface' in c;

interface Part {
  geometry: THREE.BufferGeometry;
  surface: SurfaceKind;
}

/** Box-projected UVs in model space: textures keep the same scale however a part is stretched. */
function boxUV(g: THREE.BufferGeometry, scale: number): void {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k]!;
      let u: number;
      let v: number;
      if (ay >= ax && ay >= az) {
        u = p.x;
        v = p.z;
      } else if (ax >= az) {
        u = p.z;
        v = p.y;
      } else {
        u = p.x;
        v = p.y;
      }
      uv[(i + k) * 2] = u * scale;
      uv[(i + k) * 2 + 1] = v * scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class ModelBuilder {
  private parts: Part[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  /**
   * Adds a part. `color` is a flat colour (plain surface) or a Paint (colour +
   * surface). Omit it if the geometry already carries a `color` attribute, and
   * pass `surface` to say what it is made of.
   */
  add(
    geometry: THREE.BufferGeometry,
    color?: THREE.ColorRepresentation | Paint,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    surface?: SurfaceKind,
  ): this {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    }
    g.clearGroups();
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const tint = isPaint(color) ? color.color : color;
    if (tint !== undefined || !g.getAttribute('color')) {
      const c = new THREE.Color(tint ?? '#ff00ff');
      const colors = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    this.e.set(...rotation);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(...position), this.q, new THREE.Vector3(...scale));
    g = g.applyMatrix4(this.m);
    this.parts.push({ geometry: g, surface: surface ?? (isPaint(color) ? color.surface : 'plain') });
    return this;
  }

  /** Adds everything from another builder, moved and turned. */
  addBuilder(other: ModelBuilder, position: [number, number, number] = [0, 0, 0], rotationY = 0): this {
    for (const part of other.parts)
      this.add(part.geometry, undefined, position, [0, rotationY, 0], [1, 1, 1], part.surface);
    return this;
  }

  build(name: string): THREE.Mesh {
    const merged: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];
    for (const kind of SURFACE_KINDS) {
      const parts = this.parts.filter((p) => p.surface === kind).map((p) => p.geometry);
      if (!parts.length) continue;
      const g = mergeGeometries(parts);
      if (!g) continue;
      boxUV(g, TEXEL_SCALE[kind]);
      merged.push(g);
      mats.push(surfaceMaterial(kind));
    }
    const geometry = merged.length ? mergeGeometries(merged, true)! : new THREE.BufferGeometry();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, mats);
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
