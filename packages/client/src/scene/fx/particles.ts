import * as THREE from 'three';

/**
 * GPU particles: all motion happens in the vertex shader from a time uniform,
 * so the CPU does no per-particle work each frame.
 */
export interface Particles {
  points: THREE.Points;
  update(time: number, focus: THREE.Vector3): void;
}

/** Snowfall in a box that follows the camera's focus point. */
export function createSnow(count: number, area = 90, height = 40): Particles {
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Deterministic spread (golden-ratio sequence), no Math.random needed.
    seeds[i * 3] = (i * 0.618034) % 1;
    seeds[i * 3 + 1] = (i * 0.754877) % 1;
    seeds[i * 3 + 2] = (i * 0.56984) % 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFocus: { value: new THREE.Vector3() },
      uArea: { value: area },
      uHeight: { value: height },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFocus;
      uniform float uArea;
      uniform float uHeight;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vec3 s = position;
        float fall = mod(s.y * uHeight - uTime * (1.2 + s.z * 1.3), uHeight);
        vec3 p = vec3(
          uFocus.x + (s.x - 0.5) * uArea + sin(uTime * 0.7 + s.z * 30.0) * 0.8,
          uFocus.y + fall - 4.0,
          uFocus.z + (s.z - 0.5) * uArea + cos(uTime * 0.5 + s.x * 30.0) * 0.8
        );
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + s.z * 3.0) * uScale * (60.0 / -mv.z);
        vAlpha = smoothstep(0.0, 4.0, fall) * smoothstep(uHeight, uHeight - 6.0, fall);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vAlpha * 0.9;
        if (a < 0.01) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'snow';
  return {
    points,
    update(time, focus) {
      material.uniforms.uTime!.value = time;
      (material.uniforms.uFocus!.value as THREE.Vector3).copy(focus);
    },
  };
}

/** Hearth smoke rising from a roof, drifting with the wind. */
export function createSmoke(origin: THREE.Vector3, count = 40): Particles {
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i * 3] = i / count;
    seeds[i * 3 + 1] = (i * 0.618034) % 1;
    seeds[i * 3 + 2] = (i * 0.754877) % 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOrigin: { value: origin.clone() } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uOrigin;
      varying float vLife;
      void main() {
        float life = fract(position.x + uTime * 0.12);
        vLife = life;
        vec3 p = uOrigin + vec3(
          life * life * 6.0 + sin(position.y * 20.0 + uTime) * 0.3 * life,
          life * 9.0,
          (position.z - 0.5) * life * 2.0
        );
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (10.0 + life * 40.0) * (40.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * smoothstep(0.0, 0.1, vLife) * (1.0 - vLife) * 0.35;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.82, 0.84, 0.86), a);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'smoke';
  return {
    points,
    update(time) {
      material.uniforms.uTime!.value = time;
    },
  };
}
