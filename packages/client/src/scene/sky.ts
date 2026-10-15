import * as THREE from 'three';

/** Colours of a northern winter afternoon: deep blue overhead, warm amber at the horizon. */
export const SKY = {
  zenith: new THREE.Color('#2b4a6f'),
  horizon: new THREE.Color('#e9c9a6'),
  ground: new THREE.Color('#8fa3b5'),
};

/** A gradient dome around the scene. It follows the camera so it never clips. */
export function createSky(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(400, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: SKY.zenith },
      uHorizon: { value: SKY.horizon },
      uGround: { value: SKY.ground },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 color = y > 0.0
          ? mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, y), 0.8))
          : mix(uHorizon, uGround, smoothstep(0.0, -0.2, y));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}
