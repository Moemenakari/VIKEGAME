import { createRng, hashString, nextRange, tileAt, type BuildingType, type RealmMap } from '@jarlheim/sim';
import * as THREE from 'three';
import { createBarrow, createBuildingModel } from '../hold/buildingModels';
import { createForest, createRocks } from '../hold/props';
import { createBushes, fieldModel } from './worldModels';
import { createGround, type Ground } from './ground';
import { createLongship } from '../hold/longship';
import type { QualitySettings } from '../quality';
import {
  bearModel,
  cartModel,
  chestModel,
  horseModel,
  oxModel,
  ramModel,
  sheepModel,
  soldierModel,
  tentModel,
  wolfModel,
} from './worldModels';

/**
 * Midgard in 3D (owner request, after the genre's world map): the painted realm as the
 * ground, real trees and rocks, every hold as a little hall with a coloured ring under it
 * (your alliance blue, neutral yellow, enemy red), ring forts, the Law Rock, camps with
 * wolves, bears, outlaw tents and draugr mounds, and the roads alive with marching
 * warriors, riders, ox carts and longships. Zoomed out, the halls give way to clear
 * coloured dots; zoomed in, name plates appear.
 *
 * One trip, not N trips: each kind of thing is ONE InstancedMesh (one draw call per
 * material), rebuilt only when the list changes; moving units are updated in one pass.
 */

/** World units per map tile. */
export const U = 10;

export interface HoldView {
  key: string;
  x: number;
  y: number;
  kind: 'jarl' | 'player' | 'me' | 'fort' | 'capital' | 'town';
  color: string;
  label: string;
  level: number;
  shield?: boolean;
}

export interface MarchView {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Where the column is now, 0 = home, 1 = target. */
  at: number;
  /** Marching (or fighting) or carrying goods home. */
  phase: 'out' | 'there' | 'back';
  unit: 'troops' | 'riders' | 'cart' | 'siege';
  color: string;
  /** Fighting at the target (smoke and fire). */
  battle: boolean;
}

export interface WorldViewData {
  holds: HoldView[];
  camps: Array<{
    id: string;
    x: number;
    y: number;
    kind: 'wolves' | 'bear' | 'outlaws' | 'draugr';
    level: number;
  }>;
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    kind: 'farm' | 'wood' | 'iron' | 'silver';
    level: number;
  }>;
  picked: { x: number; y: number } | null;
}

interface Pool {
  mesh: THREE.InstancedMesh;
  used: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function instancedFrom(model: THREE.Mesh, count: number, name: string): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(model.geometry, model.material, Math.max(1, count));
  mesh.count = 0;
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
}

/** Writes one instance: position (world), turn, uniform scale. */
function place(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  rot: number,
  s: number,
) {
  tmpQ.setFromAxisAngle(UP, rot);
  tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(s, s, s));
  mesh.setMatrixAt(i, tmpM);
}

export class WorldScene {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector2(200, 200);
  private distance = 160;
  /** Turn of the map (two-finger twist), 0 = north up. */
  private yaw = 0;
  /** Glide after a flick (world units per second), like any map app. */
  private readonly velocity = new THREE.Vector2();
  private lastMove = 0;
  private compass: HTMLElement | null = null;
  private size = 41;
  private raf = 0;
  private last = 0;
  private time = 0;
  private sun!: THREE.DirectionalLight;
  private groundMesh: Ground | null = null;
  private readonly statics = new THREE.Group();
  private readonly dynamics = new THREE.Group();
  private readonly holdMeshes = new Map<string, THREE.InstancedMesh>();
  private discs!: THREE.InstancedMesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private rings!: THREE.InstancedMesh;
  private holdKey = '';
  private holds: HoldView[] = [];
  private units: Record<'soldier' | 'horse' | 'cart' | 'ram' | 'ox' | 'sheep' | 'flag', Pool>;
  private ships: Array<ReturnType<typeof createLongship>> = [];
  private smoke: THREE.Mesh[] = [];
  private pickRing: THREE.Mesh;
  private map: RealmMap | null = null;
  private labelsRoot: HTMLDivElement;
  private labels: Array<{ el: HTMLDivElement; name: HTMLElement; level: HTMLElement }> = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private resizeObserver: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number }>();
  private press: { x: number; y: number; moved: boolean } | null = null;
  private marches: () => MarchView[] = () => [];

  constructor(
    private readonly container: HTMLElement,
    quality: QualitySettings,
    private readonly onTap: (x: number, y: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: quality.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'world-canvas';
    this.renderer.domElement.dataset.testid = 'world-canvas';
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
    this.scene.background = new THREE.Color('#12345c');
    this.scene.fog = new THREE.Fog('#12345c', 600, 1400);
    this.scene.add(new THREE.HemisphereLight('#e6eef6', '#5d5446', 1.5));
    const sun = new THREE.DirectionalLight('#fff1d8', 2.2);
    sun.position.set(-300, 500, -200);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    // Close up, halls and warriors cast real shadows (the shadow box follows the camera).
    if (quality.shadowMapSize > 0) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      const cam = sun.shadow.camera;
      cam.left = cam.bottom = -90;
      cam.right = cam.top = 90;
      cam.near = 10;
      cam.far = 900;
      sun.shadow.bias = -0.0008;
    }
    this.scene.add(this.statics, this.dynamics);

    const discMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      fog: false,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
    });
    this.discs = new THREE.InstancedMesh(
      new THREE.CircleGeometry(4.4, 28).rotateX(-Math.PI / 2) as THREE.CircleGeometry,
      discMat,
      400,
    );
    this.rings = new THREE.InstancedMesh(
      new THREE.RingGeometry(3.9, 4.6, 32).rotateX(-Math.PI / 2),
      ringMat,
      400,
    );
    for (const m of [this.discs, this.rings]) {
      m.count = 0;
      m.frustumCulled = false;
      m.renderOrder = 1;
      this.dynamics.add(m);
    }

    const tint = (model: THREE.Mesh, n: number, name: string): Pool => {
      const mesh = instancedFrom(model, n, name);
      mesh.castShadow = true;
      this.dynamics.add(mesh);
      return { mesh, used: 0 };
    };
    this.units = {
      soldier: tint(soldierModel(), 260, 'soldiers'),
      horse: tint(horseModel(), 90, 'horses'),
      cart: tint(cartModel(), 40, 'carts'),
      ram: tint(ramModel(), 40, 'rams'),
      ox: tint(oxModel(), 260, 'oxen'),
      sheep: tint(sheepModel(), 360, 'sheep'),
      flag: (() => {
        const m = new THREE.InstancedMesh(
          new THREE.CircleGeometry(1.6, 16).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false }),
          120,
        );
        m.count = 0;
        m.frustumCulled = false;
        this.dynamics.add(m);
        return { mesh: m, used: 0 };
      })(),
    };
    for (let i = 0; i < 10; i++) {
      const ship = createLongship(i % 2 ? ['#efe6d2', '#3b5f7a'] : ['#efe6d2', '#a3332a']);
      ship.group.scale.setScalar(0.55);
      ship.group.visible = false;
      this.ships.push(ship);
      this.dynamics.add(ship.group);
    }
    const smokeMat = new THREE.MeshBasicMaterial({
      color: '#4a4440',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const fireMat = new THREE.MeshBasicMaterial({
      color: '#ff8a2a',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    for (let i = 0; i < 12; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), i % 4 === 0 ? fireMat : smokeMat);
      puff.visible = false;
      this.smoke.push(puff);
      this.dynamics.add(puff);
    }
    this.pickRing = new THREE.Mesh(
      new THREE.RingGeometry(5, 5.8, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.pickRing.visible = false;
    this.dynamics.add(this.pickRing);

    this.labelsRoot = document.createElement('div');
    this.labelsRoot.className = 'world-labels';
    container.appendChild(this.labelsRoot);
    for (let i = 0; i < 36; i++) {
      const el = document.createElement('div');
      el.className = 'wlabel';
      const name = document.createElement('b');
      const level = document.createElement('i');
      el.append(name, level);
      el.style.display = 'none';
      this.labelsRoot.appendChild(el);
      this.labels.push({ el, name, level });
    }

    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Every frame, where your columns (and the realm's traffic) are. */
  setMarches(fn: () => MarchView[]): void {
    this.marches = fn;
  }

  /** The realm itself: ground, territory, forests and hills. Rebuilt when the realm changes. */
  setRealm(map: RealmMap): void {
    for (const child of [...this.statics.children]) {
      this.statics.remove(child);
      if (child instanceof THREE.Mesh && child !== this.groundMesh?.mesh) child.geometry.dispose();
    }
    this.groundMesh?.dispose();
    this.map = map;
    this.size = map.size;
    // The ground is drawn by the GPU from a tiny map of the realm (no stretched picture).
    this.groundMesh = createGround(map, U);
    this.statics.add(this.groundMesh.mesh);
    // Trees on every forest tile, rocks on the hills (seeded: same every visit).
    const rng = createRng(hashString(`world3d-${map.realm.id}`));
    const trees: Array<{ x: number; y: number; z: number; scale: number; rotation: number }> = [];
    const rocks: typeof trees = [];
    for (const t of map.tiles) {
      if (t.kind === 'forest')
        for (let k = 0; k < 3; k++)
          trees.push({
            x: (t.x + nextRange(rng, 0.1, 0.9)) * U,
            y: 0,
            z: (t.y + nextRange(rng, 0.1, 0.9)) * U,
            scale: nextRange(rng, 0.55, 0.85),
            rotation: nextRange(rng, 0, 6.28),
          });
      else if (t.kind === 'hills')
        for (let k = 0; k < 2; k++)
          rocks.push({
            x: (t.x + nextRange(rng, 0.15, 0.85)) * U,
            y: 0,
            z: (t.y + nextRange(rng, 0.15, 0.85)) * U,
            scale: nextRange(rng, 0.9, 1.5),
            rotation: nextRange(rng, 0, 6.28),
          });
    }
    // Close-up detail: bushes and small stones scattered over open land, a few lone pines.
    const bushes: typeof trees = [];
    for (const t of map.tiles) {
      if (t.kind !== 'field' && t.kind !== 'hills' && t.kind !== 'forest') continue;
      for (let k = 0; k < 3; k++)
        bushes.push({
          x: (t.x + nextRange(rng, 0.05, 0.95)) * U,
          y: 0,
          z: (t.y + nextRange(rng, 0.05, 0.95)) * U,
          scale: nextRange(rng, 0.5, 1),
          rotation: nextRange(rng, 0, 6.28),
        });
      if (t.kind === 'field' && nextRange(rng, 0, 1) < 0.25)
        trees.push({
          x: (t.x + nextRange(rng, 0.1, 0.9)) * U,
          y: 0,
          z: (t.y + nextRange(rng, 0.1, 0.9)) * U,
          scale: nextRange(rng, 0.45, 0.7),
          rotation: nextRange(rng, 0, 6.28),
        });
      if (nextRange(rng, 0, 1) < 0.5)
        rocks.push({
          x: (t.x + nextRange(rng, 0.05, 0.95)) * U,
          y: 0,
          z: (t.y + nextRange(rng, 0.05, 0.95)) * U,
          scale: nextRange(rng, 0.25, 0.5),
          rotation: nextRange(rng, 0, 6.28),
        });
    }
    for (const m of [createForest(trees), createRocks(rocks), createBushes(bushes)]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.statics.add(m);
    }
    this.holdKey = '';
  }

  /** Who holds which tile, as alliance colours (tint and border lines on the ground). */
  setTerritory(color: (x: number, y: number) => string | null): void {
    this.groundMesh?.setOwners(color);
  }

  /** Holds, camps and nodes. Instances are rewritten only when something changed. */
  setView(view: WorldViewData): void {
    const key = JSON.stringify([view.holds, view.camps, view.nodes]);
    if (view.picked) {
      this.pickRing.visible = true;
      this.pickRing.position.set((view.picked.x + 0.5) * U, 0.4, (view.picked.y + 0.5) * U);
    } else this.pickRing.visible = false;
    if (key === this.holdKey) return;
    this.holdKey = key;
    this.discs.userData.far = undefined;
    this.holds = view.holds;
    for (const m of this.holdMeshes.values()) m.count = 0;
    const put = (
      name: string,
      make: () => THREE.Mesh,
      x: number,
      y: number,
      s: number,
      rot = 0,
      lift = 0,
    ) => {
      let mesh = this.holdMeshes.get(name);
      if (!mesh) {
        mesh = instancedFrom(make(), 260, name);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.holdMeshes.set(name, mesh);
        this.dynamics.add(mesh);
      }
      if (mesh.count >= 260) return;
      place(mesh, mesh.count++, (x + 0.5) * U, lift, (y + 0.5) * U, rot, s);
    };
    const hall = (type: BuildingType, level: number) => () => createBuildingModel(type, level);
    // Every hold is a little settlement (as in the genre's HQs): a palisade, houses and a field.
    const settlement = (x: number, y: number, rot: number, walled: boolean) => {
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      const at = (dx: number, dy: number) => [x + dx * c - dy * sn, y + dx * sn + dy * c] as const;
      const [ax, ay] = at(0.32, 0.3);
      put('house', hall('farmstead', 2), ax, ay, 0.38, rot + 0.4);
      const [bx, by] = at(-0.34, 0.26);
      put('store', hall('storehouse', 2), bx, by, 0.36, rot - 0.3);
      const [fx, fy] = at(0.05, -0.36);
      put('field', fieldModel, fx, fy, 1, rot);
      if (walled) put('wall', hall('palisade', 6), x, y, 0.95, rot + 0.8);
    };
    this.discs.count = this.rings.count = 0;
    for (const h of view.holds) {
      const rot = ((hashString(h.key) % 628) / 100) * 0.3 - 0.15 + 0.3;
      switch (h.kind) {
        case 'me':
          put('hall-me', hall('greatHall', 15), h.x, h.y, 0.85, rot);
          settlement(h.x, h.y, rot, true);
          break;
        case 'player':
          put('hall-player', hall('greatHall', 10), h.x, h.y, 0.75, rot);
          settlement(h.x, h.y, rot, true);
          break;
        case 'jarl':
          put(
            h.level >= 10 ? 'hall-big' : 'hall-small',
            hall('greatHall', h.level >= 10 ? 8 : 3),
            h.x,
            h.y,
            h.level >= 10 ? 0.72 : 0.62,
            rot,
          );
          settlement(h.x, h.y, rot, h.level >= 8);
          break;
        case 'fort':
          put('fort-wall', hall('rampart', 10), h.x, h.y, 1.05, rot);
          put('fort-hall', hall('jarlHouse', 10), h.x, h.y, 0.7, rot);
          break;
        case 'capital':
          put('capital-mound', hall('thingMound', 20), h.x, h.y, 1.4);
          put('capital-hall', hall('greatHall', 25), h.x + 0.9, h.y + 0.6, 0.55, 0.4);
          break;
        case 'town':
          put('town', hall('market', 6), h.x, h.y, 0.8, rot);
          break;
      }
      if (h.kind === 'town') continue;
      const s = h.kind === 'fort' || h.kind === 'capital' ? 1.5 : h.kind === 'me' ? 1.2 : 1;
      tmpC.set(h.color);
      for (const m of [this.discs, this.rings]) {
        place(m, m.count, (h.x + 0.5) * U, 0.25, (h.y + 0.5) * U, 0, s);
        m.setColorAt(m.count, tmpC);
        m.count++;
      }
    }
    for (const cp of view.camps) {
      switch (cp.kind) {
        case 'wolves':
          for (let k = 0; k < 3; k++)
            put('wolf', wolfModel, cp.x - 0.15 + k * 0.15, cp.y + (k % 2) * 0.2 - 0.1, 1.5, k * 1.9);
          break;
        case 'bear':
          put('bear', bearModel, cp.x, cp.y, 1.7, 0.8);
          break;
        case 'outlaws':
          put('tent', tentModel, cp.x - 0.1, cp.y, 1.1, 0.5);
          break;
        case 'draugr':
          put('barrow', createBarrow, cp.x, cp.y, 0.5, 0.3);
          break;
      }
    }
    for (const n of view.nodes) {
      const type: Record<string, () => THREE.Mesh> = {
        farm: hall('farmstead', 3),
        wood: hall('woodcutter', 3),
        iron: hall('smelter', 3),
        silver: chestModel,
      };
      put(`node-${n.kind}`, type[n.kind]!, n.x, n.y, n.kind === 'silver' ? 1.6 : 0.65, (n.x * 7 + n.y) % 6);
    }
    for (const m of this.holdMeshes.values()) {
      m.instanceMatrix.needsUpdate = true;
    }
    for (const m of [this.discs, this.rings]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  focus(x: number, y: number, distance?: number): void {
    this.velocity.set(0, 0);
    this.target.set((x + 0.5) * U, (y + 0.5) * U);
    if (distance) this.distance = distance;
    this.clamp();
  }

  /** The whole realm in view. */
  zoomAll(): void {
    this.target.set((this.size * U) / 2, (this.size * U) / 2);
    this.distance = this.maxDistance();
  }

  get zoom(): number {
    return this.distance;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('wheel', this.onWheel);
    this.labelsRoot.remove();
    this.groundMesh?.dispose();
    this.renderer.dispose();
    c.remove();
  }

  // ---- camera ------------------------------------------------------------------

  private maxDistance(): number {
    const W = this.size * U;
    const h = Math.max(1, this.container.clientHeight);
    const w = Math.max(1, this.container.clientWidth);
    const fit = Math.max(W, (W * h) / w) * 0.95;
    return fit / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
  }

  private clamp(): void {
    this.distance = Math.min(this.maxDistance(), Math.max(14, this.distance));
    // The view stays over the realm (the sea beyond its edge matches the painted sea).
    const W = this.size * U;
    this.target.x = Math.min(W, Math.max(0, this.target.x));
    this.target.y = Math.min(W, Math.max(0, this.target.y));
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.clamp();
  }

  private updateCamera(): void {
    // Tilted more when close (to see the halls), straight down when the realm is in view.
    const far = THREE.MathUtils.clamp(this.distance / this.maxDistance(), 0, 1);
    const pitch = THREE.MathUtils.lerp(0.78, 1.45, Math.sqrt(far));
    const h = Math.cos(pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * h,
      Math.sin(pitch) * this.distance,
      this.target.y + Math.cos(this.yaw) * h,
    );
    this.camera.lookAt(this.target.x, 0, this.target.y);
    this.camera.updateMatrixWorld();
    if (this.compass) this.compass.style.transform = `rotate(${this.yaw}rad)`;
  }

  /** The compass needle turns with the map; tapping it turns the map back to north. */
  setCompass(el: HTMLElement | null): void {
    this.compass = el;
  }

  resetNorth(): void {
    this.yaw = 0;
  }

  private groundAt(cx: number, cy: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((cx - rect.left) / rect.width) * 2 - 1,
      -((cy - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, hit);
  }

  private onDown = (e: PointerEvent) => {
    this.velocity.set(0, 0);
    this.lastMove = performance.now();
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.press = this.pointers.size === 1 ? { x: e.clientX, y: e.clientY, moved: false } : null;
  };

  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 8)
      this.press.moved = true;
    if (this.pointers.size === 1) {
      // Drag: the ground under your finger follows it (any direction, like a map app).
      this.updateCamera();
      const a = this.groundAt(prev.x, prev.y);
      const b = this.groundAt(e.clientX, e.clientY);
      if (a && b) {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        this.target.x -= dx;
        this.target.y -= dz;
        this.clamp();
        const now = performance.now();
        const dt = Math.max(1, now - this.lastMove) / 1000;
        this.velocity.set(-dx / dt, -dz / dt).clampLength(0, 900);
        this.lastMove = now;
      }
    } else if (this.pointers.size === 2) {
      // Pinch to zoom, twist to turn the map.
      const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (after > 0) {
        this.distance *= before / after;
        this.clamp();
      }
      const a0 = Math.atan2(prev.y - other.y, prev.x - other.x);
      const a1 = Math.atan2(e.clientY - other.y, e.clientX - other.x);
      let d = a1 - a0;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.yaw -= d;
      this.velocity.set(0, 0);
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    this.pointers.delete(e.pointerId);
    this.press = null;
    // A slow release does not glide.
    if (performance.now() - this.lastMove > 80) this.velocity.set(0, 0);
    if (!p || p.moved) return;
    this.velocity.set(0, 0);
    const hit = this.groundAt(e.clientX, e.clientY);
    if (hit) this.onTap(Math.floor(hit.x / U), Math.floor(hit.z / U));
  };

  private onWheel = (e: WheelEvent) => {
    this.distance *= Math.exp(e.deltaY * 0.0015);
    this.clamp();
  };

  // ---- every frame ------------------------------------------------------------

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (this.pointers.size === 0 && this.velocity.lengthSq() > 1) {
      this.target.x += this.velocity.x * dt;
      this.target.y += this.velocity.y * dt;
      this.velocity.multiplyScalar(Math.exp(-dt * 4));
      this.clamp();
    }
    this.updateCamera();
    this.groundMesh?.update(this.time);
    this.sun.position.set(this.target.x - 120, 260, this.target.y - 80);
    this.sun.target.position.set(this.target.x, 0, this.target.y);
    this.sun.castShadow = this.distance < 260 && this.renderer.shadowMap.enabled;
    // Haze only beyond what you are looking at, so the realm never looks washed out.
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.distance * 1.4;
    fog.far = this.distance * 3.5;
    const far = this.distance > this.maxDistance() * 0.55;
    // Zoomed out: halls and units hide, the rings grow into clear coloured dots.
    for (const m of this.holdMeshes.values()) m.visible = !far;
    const dot = far ? THREE.MathUtils.clamp(this.distance / 650, 1, 1.5) : 1;
    this.discs.material.opacity = far ? 0.95 : 0.35;
    this.rings.visible = !far;
    if (far !== (this.discs.userData.far as boolean | undefined)) {
      this.discs.userData.far = far;
      this.holds
        .filter((h) => h.kind !== 'town')
        .forEach((h, i) => {
          const s = (h.kind === 'fort' || h.kind === 'capital' ? 1.5 : h.kind === 'me' ? 1.4 : 1) * dot;
          place(this.discs, i, (h.x + 0.5) * U, 0.25, (h.y + 0.5) * U, 0, s);
        });
      this.discs.instanceMatrix.needsUpdate = true;
    }
    this.updateUnits(far);
    if (this.pickRing.visible) this.pickRing.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    this.renderer.render(this.scene, this.camera);
    this.updateLabels(far);
  };

  private updateUnits(far: boolean): void {
    for (const p of Object.values(this.units)) p.used = 0;
    for (const s of this.ships) s.group.visible = false;
    for (const s of this.smoke) s.visible = false;
    let ship = 0;
    let puff = 0;
    if (!far && this.map) {
      for (const m of this.marches()) {
        const fx = (m.fromX + 0.5) * U;
        const fz = (m.fromY + 0.5) * U;
        const tx = (m.toX + 0.5) * U;
        const tz = (m.toY + 0.5) * U;
        const dir = Math.atan2(tx - fx, tz - fz) + (m.phase === 'back' ? Math.PI : 0);
        const x = fx + (tx - fx) * m.at;
        const z = fz + (tz - fz) * m.at;
        const tile = tileAt(this.map, Math.floor(x / U), Math.floor(z / U));
        const atSea = !tile || tile.kind === 'sea';
        if (m.battle && puff < this.smoke.length - 4) {
          for (let k = 0; k < 4; k++) {
            const s = this.smoke[puff++]!;
            const t = (this.time * 0.8 + k * 0.25) % 1;
            s.visible = true;
            s.position.set(tx + Math.sin(k * 2.1) * 2.5, 1 + t * 8, tz + Math.cos(k * 2.1) * 2.5);
            s.scale.setScalar(1 + t * 2.5);
          }
        }
        if (m.phase === 'there' && !m.battle) continue;
        if (atSea && ship < this.ships.length) {
          const sh = this.ships[ship++]!;
          sh.group.visible = true;
          sh.group.position.set(x, 0.2, z);
          sh.group.rotation.y = dir - Math.PI / 2;
          sh.update(this.time);
          continue;
        }
        tmpC.set(m.color).lerp(new THREE.Color('#ffffff'), 0.55);
        const flags = this.units.flag;
        // One column: what leads it (carts, riders or rams), then warriors on foot.
        const column = (kind: 'soldier' | 'horse' | 'cart' | 'ram', n: number, from: number) => {
          const pool = this.units[kind];
          const spacing = kind === 'cart' || kind === 'ram' ? 5 : 2.2;
          for (let k = 0; k < n && pool.used < pool.mesh.instanceMatrix.count; k++) {
            const back = from + k * spacing;
            const side = ((k % 2) - 0.5) * (kind === 'soldier' ? 1.4 : kind === 'ram' ? 0 : 1.8);
            const bx = x - Math.sin(dir) * back + Math.cos(dir) * side;
            const bz = z - Math.cos(dir) * back - Math.sin(dir) * side;
            const bob = kind === 'cart' || kind === 'ram' ? 0 : Math.abs(Math.sin(this.time * 9 + k)) * 0.25;
            const scale = kind === 'soldier' ? 2.2 : kind === 'ram' ? 1.5 : 1.8;
            place(pool.mesh, pool.used, bx, bob, bz, dir + (kind === 'soldier' ? 0 : -Math.PI / 2), scale);
            pool.mesh.setColorAt(pool.used, tmpC);
            pool.used++;
          }
          return from + n * spacing;
        };
        if (m.unit === 'cart' && m.phase === 'back') column('cart', 2, 0);
        else if (m.unit === 'riders') column('horse', 3, 0);
        else if (m.unit === 'siege') column('soldier', 3, column('ram', 2, 0));
        else column('soldier', 5, 0);
        if (flags.used < flags.mesh.instanceMatrix.count) {
          place(flags.mesh, flags.used, x, 0.3, z, 0, 1);
          flags.mesh.setColorAt(flags.used, tmpC.set(m.color));
          flags.used++;
        }
      }
    }
    if (!far) this.updateHerds();
    for (const p of Object.values(this.units)) {
      p.mesh.count = p.used;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Oxen and sheep graze by every hold near the camera, wandering slowly. */
  private updateHerds(): void {
    const ox = this.units.ox;
    const sheep = this.units.sheep;
    const reach = Math.max(160, this.distance * 1.6);
    for (const h of this.holds) {
      if (h.kind === 'fort' || h.kind === 'capital' || h.kind === 'town') continue;
      const cx = (h.x + 0.5) * U;
      const cz = (h.y + 0.5) * U;
      if (Math.abs(cx - this.target.x) > reach || Math.abs(cz - this.target.y) > reach) continue;
      const seed = hashString(h.key);
      // Graze on the side of the hold that has dry land (never out at sea).
      let side = ((seed % 628) / 100) * 1.0;
      for (let k = 0; k < 8; k++) {
        const a = side + (k * Math.PI) / 4;
        const t =
          this.map &&
          tileAt(
            this.map,
            Math.floor(h.x + 0.5 + Math.cos(a) * 0.9),
            Math.floor(h.y + 0.5 + Math.sin(a) * 0.9),
          );
        if (t && t.kind !== 'sea') {
          side = a;
          break;
        }
      }
      const px = cx + Math.cos(side) * 6;
      const pz = cz + Math.sin(side) * 6;
      for (let k = 0; k < 5; k++) {
        const pool = k < 2 ? ox : sheep;
        if (pool.used >= pool.mesh.instanceMatrix.count) continue;
        const a = this.time * (0.05 + k * 0.012) + k * 1.3 + seed * 0.001;
        const r = 0.8 + (k % 3) * 0.6;
        place(pool.mesh, pool.used++, px + Math.cos(a) * r, 0, pz + Math.sin(a) * r, -a, k < 2 ? 0.75 : 0.65);
      }
    }
  }

  /** Name plates for the holds nearest the middle of the screen (close up only). */
  private updateLabels(far: boolean): void {
    const show = !far && this.distance < 230;
    let used = 0;
    if (show) {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      const near = this.holds
        .map((hd) => ({
          hd,
          d: Math.hypot((hd.x + 0.5) * U - this.target.x, (hd.y + 0.5) * U - this.target.y),
        }))
        .filter((o) => o.d < this.distance * 1.1)
        .sort((a, b) => a.d - b.d)
        .slice(0, this.labels.length);
      for (const { hd } of near) {
        tmpP
          .set((hd.x + 0.5) * U, hd.kind === 'fort' || hd.kind === 'capital' ? 13 : 8, (hd.y + 0.5) * U)
          .project(this.camera);
        if (tmpP.z > 1) continue;
        const sx = (tmpP.x * 0.5 + 0.5) * w;
        const sy = (-tmpP.y * 0.5 + 0.5) * h;
        if (sx < -60 || sx > w + 60 || sy < -20 || sy > h + 20) continue;
        const l = this.labels[used++]!;
        l.el.style.display = '';
        l.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
        l.name.textContent = hd.label;
        l.name.style.color = hd.color;
        l.level.textContent = hd.level > 0 ? String(hd.level) : '';
        l.level.style.display = hd.level > 0 ? '' : 'none';
        l.el.classList.toggle('shield', !!hd.shield);
      }
    }
    for (let i = used; i < this.labels.length; i++) this.labels[i]!.el.style.display = 'none';
  }
}
