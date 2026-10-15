import type { HoldTerrain } from '@jarlheim/sim';
import { createRng, nextRange, sampleHeight } from '@jarlheim/sim';
import * as THREE from 'three';
import type { QualitySettings } from '../quality';
import { SKY, createSky } from '../sky';
import { createSmoke, createSnow, type Particles } from '../fx/particles';
import { createBanner, createLonghouse } from './longhouse';
import { createLongship } from './longship';
import { createForest, createRocks } from './props';
import { createTerrainMesh } from './terrainMesh';
import { createWater, type Water } from './water';

/** Things the player can tap. The id is what the UI shows information for. */
export type PickId = 'great-hall' | 'longship';

/** The player's settlement: terrain, sea, forest, buildings, ship, weather. */
export class HoldScene {
  readonly scene = new THREE.Scene();
  readonly pickables: Array<{ id: PickId; object: THREE.Object3D }> = [];
  readonly sun: THREE.DirectionalLight;

  private readonly sky: THREE.Mesh;
  private readonly water: Water;
  private readonly snow: Particles;
  private readonly smoke: Particles;
  private readonly ship: ReturnType<typeof createLongship>;
  private readonly banner: ReturnType<typeof createBanner>;

  constructor(
    readonly terrain: HoldTerrain,
    quality: QualitySettings,
    pixelRatio: number,
  ) {
    const { scene } = this;
    scene.fog = new THREE.Fog(SKY.horizon, 90, 260);

    this.sky = createSky();
    scene.add(this.sky);

    // Low winter sun from the south-west: long shadows, warm light.
    const sunDirection = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();
    this.sun = new THREE.DirectionalLight('#ffe2bd', 2.6);
    this.sun.position.copy(sunDirection).multiplyScalar(120);
    if (quality.shadowMapSize > 0) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      const cam = this.sun.shadow.camera;
      const half = terrain.size / 2 + 4;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 10;
      cam.far = 300;
      this.sun.shadow.bias = -0.0005;
      this.sun.shadow.normalBias = 0.04;
    }
    scene.add(this.sun, this.sun.target);
    scene.add(new THREE.HemisphereLight('#bcd3ee', '#5a5248', 1.1));

    scene.add(createTerrainMesh(terrain));
    this.water = createWater(terrain, sunDirection, SKY.horizon);
    scene.add(this.water.mesh);
    scene.add(createForest(terrain.trees));
    scene.add(createRocks(terrain.rocks));

    // The Great Hall at the heart of the hold.
    const hall = createLonghouse({ length: 13, width: 5.2, wallHeight: 2.4, roofHeight: 3.2, shields: true });
    hall.position.set(terrain.hall.x, terrain.hall.y, terrain.hall.z);
    hall.rotation.y = 0.12;
    scene.add(hall);
    this.addPickable('great-hall', hall, new THREE.Vector3(14, 8, 8));

    // A handful of smaller houses around it, placed with a seeded RNG.
    const rng = createRng(terrain.seed + 3);
    const ring = [0.4, 1.5, 2.6, 3.7, 4.8, 5.7];
    for (const a of ring) {
      const angle = a + nextRange(rng, -0.25, 0.25);
      const r = nextRange(rng, 9.6, 11.4);
      const x = terrain.hall.x + Math.cos(angle) * r;
      const z = terrain.hall.z + Math.sin(angle) * r;
      const hut = createLonghouse({
        length: nextRange(rng, 3.8, 5.2),
        width: nextRange(rng, 2.4, 3),
        wallHeight: 1.5,
        roofHeight: 1.9,
        shields: false,
      });
      hut.position.set(x, sampleHeight(terrain, x, z) - 0.1, z);
      hut.rotation.y = -angle + Math.PI / 2 + nextRange(rng, -0.2, 0.2);
      scene.add(hut);
    }

    this.banner = createBanner();
    this.banner.group.position.set(terrain.hall.x + 4.5, terrain.hall.y, terrain.hall.z + 5.4);
    scene.add(this.banner.group);

    this.smoke = createSmoke((hall.userData.smokeOrigin as THREE.Vector3).clone().add(hall.position));
    scene.add(this.smoke.points);

    // The longship at anchor in the fjord.
    this.ship = createLongship();
    this.ship.group.position.set(terrain.harbor.x, terrain.waterLevel, terrain.harbor.z);
    this.ship.group.rotation.y = terrain.harbor.heading;
    scene.add(this.ship.group);
    this.addPickable('longship', this.ship.group, new THREE.Vector3(4, 8, 19), new THREE.Vector3(0, 3, 0));

    this.snow = createSnow(quality.snowflakes);
    (this.snow.points.material as THREE.ShaderMaterial).uniforms.uScale!.value = pixelRatio;
    scene.add(this.snow.points);
  }

  /** Invisible box used for tap selection, cheaper and easier to hit than the real meshes. */
  private addPickable(
    id: PickId,
    parent: THREE.Object3D,
    size: THREE.Vector3,
    offset = new THREE.Vector3(0, size.y / 2, 0),
  ): void {
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.copy(offset);
    proxy.userData.pickId = id;
    parent.add(proxy);
    this.pickables.push({ id, object: proxy });
  }

  /** World position of a pickable (for UI anchors and tests). */
  anchorOf(id: PickId): THREE.Vector3 {
    const entry = this.pickables.find((p) => p.id === id)!;
    return entry.object.getWorldPosition(new THREE.Vector3());
  }

  update(time: number, camera: THREE.Camera, focus: THREE.Vector3): void {
    this.sky.position.copy(camera.position);
    this.water.update(time);
    this.snow.update(time, focus);
    this.smoke.update(time, focus);
    this.ship.update(time);
    this.banner.update(time);
  }
}
