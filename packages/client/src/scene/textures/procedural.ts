import * as THREE from 'three';

/**
 * Procedural PBR detail textures, generated on the device at start-up.
 *
 * Each surface gets three tileable maps: a detail map (albedo, multiplied with the
 * part's colour), a normal map (relief: plank grooves, wood grain, stone joints,
 * snow drifts) and a roughness map (wet stone shines, snow sparkles).
 * Everything is original (no downloaded images), so there is no licence to track
 * and nothing extra to download.
 */
export type Surface = 'wood' | 'timber' | 'stone' | 'turf' | 'snow' | 'cloth' | 'ground';

interface Field {
  /** Height 0..1, drives the normal map. */
  h: Float32Array;
  /** Albedo multiplier, around 0.75..1.1. */
  a: Float32Array;
  /** Roughness 0..1. */
  r: Float32Array;
}

// ---- tileable value noise ---------------------------------------------------------

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Value noise that wraps every `px` × `py` cells, so textures tile seamlessly. */
function vnoise(x: number, y: number, px: number, seed: number, py = px): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wx = (v: number) => ((v % px) + px) % px;
  const wy = (v: number) => ((v % py) + py) % py;
  const a = hash(wx(xi), wy(yi), seed);
  const b = hash(wx(xi + 1), wy(yi), seed);
  const c = hash(wx(xi), wy(yi + 1), seed);
  const d = hash(wx(xi + 1), wy(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Tileable fractal noise in 0..1. u, v in 0..1. */
function fbm(u: number, v: number, base: number, octaves: number, seed: number, sx = 1, sy = 1): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = base;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(u * p * sx, v * p * sy, p * sx, seed + o * 31, p * sy);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

// ---- surfaces ------------------------------------------------------------------------

function planks(n: number, seed: number, gaps: boolean): Field {
  const f = { h: new Float32Array(n * n), a: new Float32Array(n * n), r: new Float32Array(n * n) };
  const count = gaps ? 6 : 3;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const plank = Math.floor(u * count);
      const pu = u * count - plank;
      const tint = 0.85 + hash(plank, 7, seed) * 0.25;
      // Long grain: stretched noise along the plank, with fine fibres.
      const grain = fbm(u, v + plank * 0.37, 2, 4, seed, count * 6, 1);
      const fibre = vnoise(u * Math.round(n * 0.5), v * 16, Math.round(n * 0.5), seed + 5, 16);
      // Occasional knots.
      const kx = (plank + 0.5) / count;
      const ky = hash(plank, 3, seed);
      const kd = Math.hypot((u - kx) * count * 2.2, ((v - ky + 1.5) % 1) - 0.5) * 6;
      const knot = kd < 1 ? (1 - kd) ** 2 : 0;
      const edge = gaps ? Math.min(pu, 1 - pu) : 1;
      const groove = gaps ? THREE.MathUtils.smoothstep(edge, 0.0, 0.06) : 1;
      const i = y * n + x;
      f.h[i] = 0.55 * groove + 0.25 * grain + 0.08 * fibre - 0.25 * knot;
      f.a[i] = (0.72 + 0.32 * grain + 0.08 * fibre - 0.3 * knot) * tint * (0.55 + 0.45 * groove);
      f.r[i] = 0.75 + 0.2 * grain;
    }
  }
  return f;
}

function stone(n: number, seed: number): Field {
  const f = { h: new Float32Array(n * n), a: new Float32Array(n * n), r: new Float32Array(n * n) };
  // Worley cells on a wrapping grid: rounded stones with mortar between them.
  const cells = 5;
  const pts: Array<[number, number, number]> = [];
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      pts.push([
        (i + 0.15 + hash(i, j, seed) * 0.7) / cells,
        (j + 0.15 + hash(i, j, seed + 1) * 0.7) / cells,
        hash(i, j, seed + 2),
      ]);
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      let d1 = 9;
      let d2 = 9;
      let id = 0;
      for (const [px, py, pid] of pts) {
        for (const ox of [-1, 0, 1]) {
          for (const oy of [-1, 0, 1]) {
            const d = Math.hypot(u - px - ox, v - py - oy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              id = pid;
            } else if (d < d2) d2 = d;
          }
        }
      }
      const mortar = THREE.MathUtils.smoothstep(d2 - d1, 0, 0.035);
      const rough = fbm(u, v, 8, 4, seed + 9);
      const i = y * n + x;
      f.h[i] = mortar * (0.6 + 0.4 * (1 - d1 * cells)) + 0.15 * rough;
      f.a[i] = (0.62 + 0.3 * id + 0.18 * rough) * (0.5 + 0.5 * mortar);
      f.r[i] = 0.7 + 0.25 * rough;
    }
  }
  return f;
}

function turf(n: number, seed: number): Field {
  const f = { h: new Float32Array(n * n), a: new Float32Array(n * n), r: new Float32Array(n * n) };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const clumps = fbm(u, v, 6, 4, seed);
      const bx = Math.round(n * 0.35);
      const by = Math.round(n * 0.12);
      const blades = vnoise(u * bx, v * by, bx, seed + 3, by);
      const i = y * n + x;
      f.h[i] = 0.6 * clumps + 0.4 * blades;
      f.a[i] = 0.7 + 0.35 * clumps + 0.12 * blades;
      f.r[i] = 0.9;
    }
  }
  return f;
}

function snow(n: number, seed: number): Field {
  const f = { h: new Float32Array(n * n), a: new Float32Array(n * n), r: new Float32Array(n * n) };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const drift = fbm(u, v, 3, 5, seed);
      const sparkle = hash(x, y, seed) > 0.985 ? 1 : 0;
      const i = y * n + x;
      f.h[i] = drift;
      f.a[i] = 0.93 + 0.07 * drift + 0.1 * sparkle;
      // Ice crystals catch the light.
      f.r[i] = sparkle ? 0.15 : 0.75 + 0.15 * drift;
    }
  }
  return f;
}

function cloth(n: number, seed: number): Field {
  const f = { h: new Float32Array(n * n), a: new Float32Array(n * n), r: new Float32Array(n * n) };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const weave = (Math.sin((x / n) * Math.PI * 2 * 48) * Math.sin((y / n) * Math.PI * 2 * 48) + 1) / 2;
      const slub = fbm(x / n, y / n, 8, 3, seed);
      const i = y * n + x;
      f.h[i] = 0.5 * weave + 0.3 * slub;
      f.a[i] = 0.85 + 0.12 * weave + 0.1 * slub;
      f.r[i] = 0.95;
    }
  }
  return f;
}

function ground(n: number, seed: number): Field {
  const f = { h: new Float32Array(n * n), a: new Float32Array(n * n), r: new Float32Array(n * n) };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const big = fbm(u, v, 4, 5, seed);
      const pebbles = fbm(u, v, 32, 2, seed + 4);
      const sparkle = hash(x, y, seed + 8) > 0.99 ? 1 : 0;
      const i = y * n + x;
      f.h[i] = 0.7 * big + 0.3 * pebbles;
      f.a[i] = 0.82 + 0.2 * big + 0.06 * pebbles + 0.08 * sparkle;
      f.r[i] = sparkle ? 0.25 : 0.85;
    }
  }
  return f;
}

// ---- field → textures ------------------------------------------------------------------

function toTexture(
  n: number,
  fill: (i: number, out: Uint8Array, o: number) => void,
  srgb: boolean,
): THREE.DataTexture {
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) fill(i, data, i * 4);
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface SurfaceMaps {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

function bake(f: Field, n: number, strength: number): SurfaceMaps {
  const map = toTexture(
    n,
    (i, out, o) => {
      const v = Math.round(THREE.MathUtils.clamp(f.a[i]! * 225, 0, 255));
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
    },
    true,
  );
  const normalMap = toTexture(
    n,
    (i, out, o) => {
      const x = i % n;
      const y = (i / n) | 0;
      const hl = f.h[y * n + ((x - 1 + n) % n)]!;
      const hr = f.h[y * n + ((x + 1) % n)]!;
      const hd = f.h[((y - 1 + n) % n) * n + x]!;
      const hu = f.h[((y + 1) % n) * n + x]!;
      const nx = (hl - hr) * strength;
      const ny = (hd - hu) * strength;
      const len = Math.hypot(nx, ny, 1);
      out[o] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    },
    false,
  );
  const roughnessMap = toTexture(
    n,
    (i, out, o) => {
      // three.js reads roughness from the green channel.
      out[o] = out[o + 2] = 0;
      out[o + 1] = Math.round(THREE.MathUtils.clamp(f.r[i]!, 0, 1) * 255);
      out[o + 3] = 255;
    },
    false,
  );
  return { map, normalMap, roughnessMap };
}

/** Builds every surface's maps. `size` is the texture edge in pixels (256 on low-end phones). */
export function generateSurfaces(size: number): Record<Surface, SurfaceMaps> {
  const n = size;
  return {
    wood: bake(planks(n, 11, true), n, 6),
    timber: bake(planks(n, 23, false), n, 4),
    stone: bake(stone(n, 37), n, 7),
    turf: bake(turf(n, 41), n, 5),
    snow: bake(snow(n, 53), n, 3),
    cloth: bake(cloth(n, 61), n, 2),
    ground: bake(ground(n, 71), n, 3),
  };
}
