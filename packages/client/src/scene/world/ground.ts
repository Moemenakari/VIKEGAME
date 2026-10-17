import type { RealmMap } from '@jarlheim/sim';
import * as THREE from 'three';

/**
 * The ground of Midgard, drawn by the GPU (owner request: "like Google Maps, the closer
 * you get the clearer the land"). The realm is only a tiny data texture (one texel per
 * tile: land, forest, rock); every pixel on screen then works out its own coastline,
 * grass, heath, bog, rock, snow, beach, foam and waves from smooth noise in world space.
 * There is no picture to stretch, so zooming in never shows squares: finer and finer
 * detail fades in as you get closer. Territories are a second tiny texture, tinted and
 * outlined in the same pass. One mesh, one draw call, lit and shadowed like the rest.
 */
export interface Ground {
  mesh: THREE.Mesh;
  setOwners(color: (x: number, y: number) => string | null): void;
  update(time: number): void;
  dispose(): void;
}

const NOISE = /* glsl */ `
  float gHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x),
               mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float gFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * gNoise(p);
      p = p * 2.03 + 7.1;
      a *= 0.5;
    }
    return v;
  }
`;

export function createGround(map: RealmMap, tile: number): Ground {
  const n = map.size;
  const landData = new Uint8Array(n * n * 4);
  for (const t of map.tiles) {
    const i = (t.y * n + t.x) * 4;
    landData[i] = t.kind === 'sea' ? 0 : 255;
    landData[i + 1] = t.kind === 'forest' ? 255 : 0;
    landData[i + 2] = t.kind === 'hills' ? 255 : 0;
    // Trodden ground around towns, forts and the Law Rock.
    landData[i + 3] = t.kind === 'town' || t.kind === 'fort' || t.kind === 'capital' ? 255 : 0;
  }
  const landTex = new THREE.DataTexture(landData, n, n, THREE.RGBAFormat);
  landTex.magFilter = THREE.LinearFilter;
  landTex.minFilter = THREE.LinearMipmapLinearFilter;
  landTex.generateMipmaps = true;
  landTex.needsUpdate = true;

  const ownerData = new Uint8Array(n * n * 4);
  const ownerTex = new THREE.DataTexture(ownerData, n, n, THREE.RGBAFormat);
  ownerTex.magFilter = THREE.LinearFilter;
  ownerTex.minFilter = THREE.LinearFilter;
  ownerTex.needsUpdate = true;

  const uniforms = {
    tLand: { value: landTex },
    tOwner: { value: ownerTex },
    uSize: { value: n },
    uTile: { value: tile },
    uTime: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vGround;
        uniform sampler2D tLand;
        uniform sampler2D tOwner;
        uniform float uSize;
        uniform float uTile;
        uniform float uTime;
        ${NOISE}`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 tp = vGround / uTile;
        // Wobble the lookups so coasts and borders are organic, never stair-stepped.
        vec2 warp = vec2(gFbm(tp * 0.35), gFbm(tp * 0.35 + 17.3)) - 0.5;
        vec2 uv = (tp + warp * 0.5) / uSize;
        vec4 L = texture2D(tLand, uv);
        // Past the edge of the realm the land sinks into open sea.
        float inside = min(min(tp.x, tp.y), min(uSize - tp.x, uSize - tp.y));
        float edge = smoothstep(-1.6, 0.4, inside + (gFbm(tp * 0.6) - 0.5) * 1.2);
        float lv = L.r * edge + (gFbm(tp * 1.3) - 0.5) * 0.35 + (gFbm(tp * 6.0) - 0.5) * 0.08;
        float land = smoothstep(0.48, 0.52, lv);

        // Sea: shallow near the coast, deep further out, slow waves and foam on the shore.
        float near = texture2D(tLand, uv, 2.5).r * edge;
        vec3 deep = vec3(0.06, 0.17, 0.32);
        vec3 shallow = vec3(0.16, 0.45, 0.56);
        vec3 sea = mix(deep, shallow, smoothstep(0.05, 0.75, near * 0.7 + lv * 0.5));
        float wv = gFbm(tp * 2.2 + vec2(uTime * 0.04, uTime * 0.025));
        float wv2 = gNoise(tp * 9.0 - vec2(uTime * 0.15, uTime * 0.1));
        sea *= 0.9 + wv * 0.16 + wv2 * 0.05;
        float foam = smoothstep(0.40, 0.475, lv) * (1.0 - land);
        foam *= 0.55 + 0.45 * sin(uTime * 1.3 + lv * 40.0 + wv * 6.0);
        sea = mix(sea, vec3(0.86, 0.91, 0.93), clamp(foam, 0.0, 1.0) * 0.75);

        // Land: grassland, dry heath and bogs, forest floor, bare rock, trodden earth.
        float g = gFbm(tp * 2.0);
        float wet = gFbm(tp * 0.22 + 31.0);
        vec3 col = mix(vec3(0.33, 0.43, 0.22), vec3(0.50, 0.57, 0.31), g);
        col = mix(col, vec3(0.58, 0.50, 0.34), smoothstep(0.58, 0.72, 1.0 - wet));
        vec3 bog = mix(vec3(0.27, 0.35, 0.28), vec3(0.20, 0.32, 0.36), step(0.62, gNoise(tp * 3.0)));
        col = mix(col, bog, smoothstep(0.62, 0.74, wet));
        col = mix(col, vec3(0.22, 0.30, 0.19) * (0.85 + g * 0.3), L.g);
        float rock = L.b * smoothstep(0.35, 0.6, gFbm(tp * 1.6 + 5.0));
        col = mix(col, vec3(0.47, 0.46, 0.44) * (0.8 + gNoise(tp * 7.0) * 0.4), rock);
        col = mix(col, vec3(0.52, 0.44, 0.33), L.a * 0.7);
        // Snow towards the north and on high ground.
        float north = 1.0 - tp.y / (uSize * 0.62);
        float snow = smoothstep(0.25, 0.6, north + (gFbm(tp * 0.8) - 0.5) * 0.55 + rock * 0.25);
        col = mix(col, vec3(0.91, 0.94, 0.97), snow * 0.9);
        // Beach just above the waterline (not in the snow).
        col = mix(col, vec3(0.79, 0.73, 0.57), (1.0 - smoothstep(0.52, 0.58, lv)) * (1.0 - snow) * 0.85);

        // Finer and finer grain as you zoom in (faded out before it would shimmer).
        float px = length(fwidth(tp));
        float d1 = gNoise(tp * 14.0);
        float d2 = gNoise(tp * 55.0);
        float d3 = gNoise(tp * 210.0);
        col *= 1.0 + (d1 - 0.5) * 0.20 * (1.0 - smoothstep(0.03, 0.09, px))
                   + (d2 - 0.5) * 0.16 * (1.0 - smoothstep(0.008, 0.025, px))
                   + (d3 - 0.5) * 0.12 * (1.0 - smoothstep(0.002, 0.007, px));
        // Soft relief: lit slopes on the noise hills.
        float hA = gFbm(tp * 1.4) + rock * 0.5;
        float hB = gFbm((tp + vec2(0.05, 0.05)) * 1.4) + rock * 0.5;
        col *= 1.0 + (hA - hB) * 2.2;

        // Territories: a light tint and a clear border line in the alliance colour.
        vec4 O = texture2D(tOwner, uv);
        float own = smoothstep(0.35, 0.65, O.a) * land;
        vec3 oc = O.a > 0.01 ? O.rgb / max(O.a, 0.001) : vec3(0.0);
        col = mix(col, oc, own * 0.22);
        float lw = max(fwidth(O.a) * 1.6, 0.004);
        float line = (1.0 - smoothstep(lw * 0.5, lw, abs(O.a - 0.5))) * land;
        col = mix(col, oc, line * 0.85);

        vec3 groundColor = mix(sea, col, land);
        diffuseColor.rgb = pow(groundColor, vec3(2.2));
        `,
      );
  };
  // Big enough to reach the horizon in every direction.
  const W = n * tile;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 4, W * 4, 1, 1).rotateX(-Math.PI / 2).translate(W / 2, 0, W / 2),
    material,
  );
  mesh.receiveShadow = true;
  return {
    mesh,
    setOwners(color) {
      // Premultiplied colours, so the linear blend between tiles stays clean.
      const c = new THREE.Color();
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const i = (y * n + x) * 4;
          const hex = color(x, y);
          if (hex) {
            c.set(hex);
            ownerData[i] = c.r * 255;
            ownerData[i + 1] = c.g * 255;
            ownerData[i + 2] = c.b * 255;
            ownerData[i + 3] = 255;
          } else ownerData[i] = ownerData[i + 1] = ownerData[i + 2] = ownerData[i + 3] = 0;
        }
      ownerTex.needsUpdate = true;
    },
    update(time) {
      uniforms.uTime.value = time;
    },
    dispose() {
      landTex.dispose();
      ownerTex.dispose();
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
