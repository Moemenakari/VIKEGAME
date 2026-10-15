import type { HoldTerrain } from '@jarlheim/sim';
import * as THREE from 'three';

/**
 * Stylised fjord water: depth-tinted colour from the terrain heights, animated
 * ripples, a fresnel sky reflection, a sun glint and foam along the shore.
 * One draw call, no reflections render pass, so it stays cheap on phones.
 */
export interface Water {
  mesh: THREE.Mesh;
  update(time: number): void;
}

const MAX_DEPTH = 6;

function createDepthTexture(t: HoldTerrain): THREE.DataTexture {
  const res = t.resolution;
  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    const depth = THREE.MathUtils.clamp((t.waterLevel - t.heights[i]!) / MAX_DEPTH, 0, 1);
    data[i * 4] = Math.round(depth * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createWater(t: HoldTerrain, sunDirection: THREE.Vector3, skyColor: THREE.Color): Water {
  const extent = t.size * 3;
  const geometry = new THREE.PlaneGeometry(extent, extent, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDepth: { value: createDepthTexture(t) },
        uMapSize: { value: t.size },
        uSunDir: { value: sunDirection.clone().normalize() },
        uDeep: { value: new THREE.Color('#174463') },
        uShallow: { value: new THREE.Color('#3f8a8f') },
        uSky: { value: skyColor.clone() },
        uFoam: { value: new THREE.Color('#e9f1f4') },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform sampler2D uDepth;
      uniform float uMapSize;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uFoam;
      varying vec3 vWorld;

      float wave(vec2 p, vec2 dir, float freq, float speed) {
        return sin(dot(p, dir) * freq + uTime * speed);
      }

      void main() {
        vec2 uv = vWorld.xz / uMapSize + 0.5;
        bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
        float depth = inside ? texture2D(uDepth, uv).r : 1.0;

        // Ripple normal from a few crossing sine waves.
        vec2 p = vWorld.xz;
        float e = 0.15;
        float h  = wave(p, vec2(0.8, 0.6), 0.9, 1.1) + 0.6 * wave(p, vec2(-0.5, 0.9), 1.7, 1.7) + 0.3 * wave(p, vec2(0.2, -1.0), 3.1, 2.3);
        float hx = wave(p + vec2(e, 0.0), vec2(0.8, 0.6), 0.9, 1.1) + 0.6 * wave(p + vec2(e, 0.0), vec2(-0.5, 0.9), 1.7, 1.7) + 0.3 * wave(p + vec2(e, 0.0), vec2(0.2, -1.0), 3.1, 2.3);
        float hz = wave(p + vec2(0.0, e), vec2(0.8, 0.6), 0.9, 1.1) + 0.6 * wave(p + vec2(0.0, e), vec2(-0.5, 0.9), 1.7, 1.7) + 0.3 * wave(p + vec2(0.0, e), vec2(0.2, -1.0), 3.1, 2.3);
        vec3 n = normalize(vec3(-(hx - h) / e * 0.06, 1.0, -(hz - h) / e * 0.06));

        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
        vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 0.8, depth));
        vec3 color = mix(base, uSky, fresnel * 0.65);

        vec3 halfDir = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(n, halfDir), 0.0), 180.0);
        color += vec3(1.0, 0.86, 0.66) * spec * 1.4;

        // Foam where the water meets the shore, broken up by the ripples.
        float foam = smoothstep(0.07, 0.0, depth) * (0.6 + 0.4 * sin(uTime * 1.3 + h * 2.0));
        color = mix(color, uFoam, clamp(foam, 0.0, 1.0));

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = t.waterLevel;
  mesh.receiveShadow = false;
  mesh.name = 'water';

  return {
    mesh,
    update(time) {
      material.uniforms.uTime!.value = time;
    },
  };
}
