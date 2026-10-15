import * as THREE from 'three';
import { generateSurfaces, type Surface } from './procedural';

/** Every kind of surface a model part can be made of. */
export type SurfaceKind = Surface | 'plain' | 'metal' | 'glow';

export const SURFACE_KINDS: readonly SurfaceKind[] = [
  'plain',
  'wood',
  'timber',
  'stone',
  'turf',
  'snow',
  'cloth',
  'ground',
  'metal',
  'glow',
];

/** How many texture repeats per world unit (about one metre): sets plank width, stone size... */
export const TEXEL_SCALE: Record<SurfaceKind, number> = {
  plain: 0.5,
  wood: 0.5,
  timber: 0.7,
  stone: 0.55,
  turf: 0.45,
  snow: 0.25,
  cloth: 1,
  ground: 0.12,
  metal: 1,
  glow: 1,
};

const materials = new Map<SurfaceKind, THREE.MeshStandardMaterial>();

function plain(opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts });
}

/**
 * Creates the shared materials. With `textureSize` > 0 the surfaces get generated
 * detail, normal and roughness maps; with 0 (low-end phones) they stay plain colours.
 */
export function initSurfaces(textureSize: number): void {
  materials.clear();
  materials.set('plain', plain());
  materials.set('metal', plain({ metalness: 0.75, roughness: 0.35 }));
  materials.set(
    'glow',
    plain({ emissive: new THREE.Color('#ff7a26'), emissiveIntensity: 2.2, roughness: 1 }),
  );
  if (textureSize <= 0) {
    for (const k of SURFACE_KINDS) if (!materials.has(k)) materials.set(k, plain());
    return;
  }
  const maps = generateSurfaces(textureSize);
  const normalStrength: Record<string, number> = {
    wood: 1,
    timber: 0.8,
    stone: 1.2,
    turf: 0.9,
    snow: 0.6,
    cloth: 0.5,
    ground: 0.7,
  };
  for (const [kind, m] of Object.entries(maps)) {
    materials.set(
      kind as Surface,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: m.map,
        normalMap: m.normalMap,
        normalScale: new THREE.Vector2(normalStrength[kind] ?? 1, normalStrength[kind] ?? 1),
        roughnessMap: m.roughnessMap,
        roughness: 1,
      }),
    );
  }
}

export function surfaceMaterial(kind: SurfaceKind): THREE.MeshStandardMaterial {
  if (!materials.size) initSurfaces(0);
  return materials.get(kind) ?? materials.get('plain')!;
}
