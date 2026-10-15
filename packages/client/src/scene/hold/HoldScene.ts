import type { BuildingType, GameState, HoldTerrain, IncomingRaid } from '@jarlheim/sim';
import { BUILDINGS, buildRadius, sampleHeight, sumCounts } from '@jarlheim/sim';
import * as THREE from 'three';
import type { QualitySettings } from '../quality';
import { SKY, createSky } from '../sky';
import { createSmoke, createSnow, type Particles } from '../fx/particles';
import {
  FOOTPRINT,
  createBarrow,
  createBuildingModel,
  createFooting,
  createScaffold,
} from './buildingModels';
import { createBanner } from './longhouse';
import { createLife, type Life } from './life';
import { createLongship } from './longship';
import { createForest, createRocks } from './props';
import { createTerrainMesh } from './terrainMesh';
import { createWater, type Water } from './water';

/** Things the player can tap: a building id (including 'hall'), the barrow or the longship. */
export type PickId = string;

interface Slot {
  id: string;
  group: THREE.Group;
  proxy: THREE.Mesh;
  /** What is currently shown, so models are only rebuilt when something changed. */
  key: string;
  /** Height above the plot where its label floats. */
  labelHeight: number;
}

const PROXY_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const PROXY_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });

/** The player's settlement: terrain, sea, forest, buildings, ship, weather. */
export class HoldScene {
  readonly scene = new THREE.Scene();
  readonly pickables: Array<{ id: PickId; object: THREE.Object3D }> = [];
  readonly slots = new Map<string, Slot>();
  readonly sun: THREE.DirectionalLight;

  private readonly sky: THREE.Mesh;
  private readonly water: Water;
  private readonly snow: Particles;
  private smoke: Particles;
  private smokeKey = '';
  private readonly life: Life;
  private lastTime = 0;
  private readonly ship: ReturnType<typeof createLongship>;
  private readonly banner: ReturnType<typeof createBanner>;
  private ghost: { group: THREE.Group; ring: THREE.Mesh; area: THREE.Mesh; type: BuildingType } | null = null;
  private raiders: Array<ReturnType<typeof createLongship>> = [];
  private raidKey = '';

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
    this.sun = new THREE.DirectionalLight('#ffdcb0', 2.5);
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
      this.sun.shadow.radius = 2.5;
    }
    scene.add(this.sun, this.sun.target);
    // Soft fill until the HDRI sky light arrives (then it only adds a little).
    scene.add(new THREE.HemisphereLight('#bcd3ee', '#5a5248', 0.55));

    scene.add(createTerrainMesh(terrain));
    this.water = createWater(terrain, sunDirection, SKY.horizon);
    scene.add(this.water.mesh);
    scene.add(createForest(terrain.trees));
    scene.add(createRocks(terrain.rocks));

    const hallPos = new THREE.Vector3(terrain.hall.x, terrain.hall.y, terrain.hall.z);

    this.banner = createBanner();
    this.banner.group.position.set(terrain.hall.x + 4.5, terrain.hall.y, terrain.hall.z + 5.4);
    scene.add(this.banner.group);

    this.smoke = createSmoke([hallPos.clone().add(new THREE.Vector3(0, 6, 0))]);
    scene.add(this.smoke.points);

    // Villagers on the paths and sheep at pasture (fewer on low-end phones).
    const crowd = { low: [6, 4], medium: [12, 6], high: [20, 9] }[quality.tier];
    this.life = createLife(terrain, crowd[0]!, crowd[1]!);
    scene.add(this.life.group);

    // The draugr barrow outside the settlement.
    const barrow = createBarrow();
    barrow.position.set(terrain.barrow.x, terrain.barrow.y - 0.1, terrain.barrow.z);
    barrow.scale.setScalar(0.7);
    barrow.rotation.y =
      Math.atan2(terrain.hall.x - terrain.barrow.x, terrain.hall.z - terrain.barrow.z) - Math.PI / 2;
    scene.add(barrow);
    this.addPickable('barrow', barrow, new THREE.Vector3(16, 6, 10));

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

  /** World position for a spot measured from the centre of the Great Hall. */
  worldAt(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
    const wx = this.terrain.hall.x + x;
    const wz = this.terrain.hall.z + z;
    return target.set(wx, Math.max(this.terrain.hall.y, sampleHeight(this.terrain, wx, wz)) - 0.05, wz);
  }

  private addSlot(id: string): Slot {
    const group = new THREE.Group();
    const proxy = new THREE.Mesh(PROXY_GEOMETRY, PROXY_MATERIAL);
    proxy.userData.pickId = id;
    group.add(proxy);
    this.scene.add(group);
    const slot = { id, group, proxy, key: '', labelHeight: 2 };
    this.slots.set(id, slot);
    return slot;
  }

  private clearSlot(slot: Slot): void {
    for (const child of [...slot.group.children]) {
      if (child === slot.proxy) continue;
      slot.group.remove(child);
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
  }

  /** Objects the tap raycast tests: open plots, buildings and the ship. */
  pickTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = this.pickables.map((p) => p.object);
    for (const slot of this.slots.values()) if (slot.group.visible) targets.push(slot.proxy);
    return targets;
  }

  /**
   * Brings the 3D hold in line with the game state. Only plots whose content
   * changed are rebuilt. Returns true if anything changed.
   */
  syncBuildings(state: GameState): boolean {
    let changed = false;
    // Buildings that are gone (none today, but a save can be reset).
    for (const [id, slot] of this.slots) {
      if (state.buildings[id]) continue;
      this.clearSlot(slot);
      this.scene.remove(slot.group);
      this.slots.delete(id);
      changed = true;
    }
    for (const b of Object.values(state.buildings)) {
      const slot = this.slots.get(b.id) ?? this.addSlot(b.id);
      const building = state.queue.some((j) => j.buildingId === b.id);
      const key = `${b.type}|${b.level}|${building}|${b.x}|${b.z}|${b.rot}`;
      if (key === slot.key) continue;
      const modelKey = key.split('|').slice(0, 3).join('|');
      const rebuild = slot.key.split('|').slice(0, 3).join('|') !== modelKey;
      slot.key = key;
      changed = true;
      this.worldAt(b.x, b.z, slot.group.position);
      slot.group.rotation.y = b.rot;
      if (!rebuild) continue;

      this.clearSlot(slot);
      const { radius, height } = FOOTPRINT[b.type];
      slot.group.add(b.level > 0 ? createBuildingModel(b.type, b.level) : createFooting(radius));
      if (building && b.type !== 'greatHall') slot.group.add(createScaffold(radius, height));
      if (building && b.type === 'greatHall') {
        const s = createScaffold(3.5, 5);
        s.position.x = 7.6;
        slot.group.add(s);
      }
      slot.labelHeight = height + 0.6;
      const hallShape = b.type === 'greatHall';
      slot.proxy.scale.set(hallShape ? 14 : radius * 2, height + 1, hallShape ? 8 : radius * 2);
      slot.proxy.position.y = (height + 1) / 2;
    }
    if (changed) this.updateSmoke(state);
    return changed;
  }

  // ---- placing and moving buildings -------------------------------------------------

  /** Shows a building where it would stand, with a green or red ring, and the land you hold. */
  showGhost(type: BuildingType, level: number, state: GameState, hideId?: string): void {
    this.hideGhost();
    const group = new THREE.Group();
    group.add(createBuildingModel(type, Math.max(1, level)));
    const r = BUILDINGS[type].footprint;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.25, r + 0.15, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#7fe07a', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    ring.position.y = 0.12;
    group.add(ring);
    this.scene.add(group);
    const R = buildRadius(state);
    const area = new THREE.Mesh(
      new THREE.RingGeometry(R - 0.3, R, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd677', transparent: true, opacity: 0.6, depthWrite: false }),
    );
    area.position.set(this.terrain.hall.x, this.terrain.hall.y + 0.15, this.terrain.hall.z);
    this.scene.add(area);
    this.ghost = { group, ring, area, type };
    if (hideId) this.slots.get(hideId)!.group.visible = false;
  }

  moveGhost(x: number, z: number, rot: number, ok: boolean): void {
    if (!this.ghost) return;
    this.worldAt(x, z, this.ghost.group.position);
    this.ghost.group.rotation.y = rot;
    (this.ghost.ring.material as THREE.MeshBasicMaterial).color.set(ok ? '#7fe07a' : '#ff5a4a');
  }

  hideGhost(): void {
    if (!this.ghost) return;
    this.scene.remove(this.ghost.group, this.ghost.area);
    this.ghost.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.ghost.area.geometry.dispose();
    this.ghost = null;
    for (const slot of this.slots.values()) slot.group.visible = true;
  }

  /** The ghost's tap target (for dragging it). */
  get ghostObject(): THREE.Object3D | null {
    return this.ghost?.group ?? null;
  }

  // ---- raiders at sea -----------------------------------------------------------------

  /** Shows the raiding fleet sailing in from the open sea while the beacon burns. */
  syncRaid(raid: IncomingRaid | null, now: number): void {
    const key = raid ? `${raid.spottedAt}|${raid.landsAt}` : '';
    if (key !== this.raidKey) {
      this.raidKey = key;
      for (const r of this.raiders) this.scene.remove(r.group);
      this.raiders = [];
      if (raid) {
        const n = Math.min(4, Math.max(1, sumCounts(raid.ships)));
        for (let i = 0; i < n; i++) {
          const ship = createLongship(['#2a2422', '#5a1a16']);
          this.raiders.push(ship);
          this.scene.add(ship.group);
        }
      }
    }
    if (!raid) return;
    const t = Math.min(1, Math.max(0, (now - raid.spottedAt) / Math.max(1, raid.landsAt - raid.spottedAt)));
    const { harbor, hall } = this.terrain;
    const dir = new THREE.Vector2(harbor.x - hall.x, harbor.z - hall.z).normalize();
    const side = new THREE.Vector2(-dir.y, dir.x);
    const far = 70;
    const near = 12;
    const d = far + (near - far) * t;
    this.raiders.forEach((ship, i) => {
      const off = (i - (this.raiders.length - 1) / 2) * 9;
      ship.group.position.x = harbor.x + dir.x * d + side.x * off;
      ship.group.position.z = harbor.z + dir.y * d + side.y * off - (i % 2) * 4;
      ship.group.rotation.y = Math.atan2(-dir.x, -dir.y);
    });
  }

  /** Every finished house with a hearth gets a column of smoke (rebuilt only when that set changes). */
  private updateSmoke(state: GameState): void {
    const hearths = new Set([
      'greatHall',
      'farmstead',
      'fishRacks',
      'woodcutter',
      'smelter',
      'wolfLodge',
      'healersHouse',
      'storehouse',
    ]);
    const origins: THREE.Vector3[] = [];
    for (const slot of this.slots.values()) {
      const b = state.buildings[slot.id];
      if (!b || b.level < 1 || !hearths.has(b.type)) continue;
      const height = b.type === 'greatHall' ? 6 : FOOTPRINT[b.type].height * 0.85;
      origins.push(slot.group.position.clone().add(new THREE.Vector3(0, height, 0)));
    }
    const key = origins.map((o) => `${o.x.toFixed(1)},${o.z.toFixed(1)}`).join('|');
    if (key === this.smokeKey) return;
    this.smokeKey = key;
    this.scene.remove(this.smoke.points);
    this.smoke.points.geometry.dispose();
    this.smoke = createSmoke(origins);
    this.scene.add(this.smoke.points);
  }

  /** World position of a pickable (for UI anchors and tests). */
  anchorOf(id: PickId): THREE.Vector3 {
    const slot = this.slots.get(id);
    if (slot) return slot.group.position.clone().add(new THREE.Vector3(0, slot.labelHeight * 0.5, 0));
    const entry = this.pickables.find((p) => p.id === id)!;
    return entry.object.getWorldPosition(new THREE.Vector3());
  }

  /** Where a plot's (or the barrow's) floating label sits. */
  labelAnchor(id: string, target: THREE.Vector3): THREE.Vector3 {
    if (id === 'barrow') {
      return target.set(this.terrain.barrow.x, this.terrain.barrow.y + 3.5, this.terrain.barrow.z);
    }
    const slot = this.slots.get(id)!;
    return target.copy(slot.group.position).setY(slot.group.position.y + slot.labelHeight);
  }

  /** Snowfall on or off (player setting). */
  setSnow(on: boolean): void {
    this.snow.points.visible = on;
  }

  update(time: number, camera: THREE.Camera, focus: THREE.Vector3): void {
    this.sky.position.copy(camera.position);
    this.water.update(time);
    this.snow.update(time, focus);
    this.smoke.update(time, focus);
    this.ship.update(time);
    this.banner.update(time);
    for (const r of this.raiders) r.update(time + r.group.position.x);
    this.life.update(time, Math.min(0.1, Math.max(0, time - this.lastTime)));
    this.lastTime = time;
  }
}
