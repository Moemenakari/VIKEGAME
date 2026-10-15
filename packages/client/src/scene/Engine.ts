import { generateHoldTerrain, type BuildingType, type GameState } from '@jarlheim/sim';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { initSurfaces } from './textures/surfaces';
import { CameraRig } from './CameraRig';
import { HoldScene, type PickId } from './hold/HoldScene';
import type { QualitySettings } from './quality';
import { bName, t } from '../ui/i18n';

export interface EngineCallbacks {
  onSelect: (id: PickId | null) => void;
  /** While placing: the building was dragged or tapped to a new spot (measured from the hall). */
  onPlace?: (x: number, z: number) => void;
  onFirstFrame: () => void;
  onFps?: (fps: number) => void;
}

/** After the last touch, keep rendering at full speed this long before idling. */
const ACTIVE_AFTER_INPUT_MS = 2000;

/**
 * Owns the WebGL renderer and the frame loop.
 *
 * Battery-friendly: while you touch the screen or the camera glides it renders at
 * the display rate; when idle it drops to `quality.idleFps` (water and snow keep
 * moving), and it stops completely when the tab is hidden.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly rig: CameraRig;
  readonly hold: HoldScene;

  private raf = 0;
  private lastFrame = 0;
  private sinceRender = 0;
  private lastInput = 0;
  private time = 0;
  private frames = 0;
  private fpsWindow = { start: 0, frames: 0 };
  private firstFrameSent = false;
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private labelsRoot: HTMLDivElement;
  private labels = new Map<string, { el: HTMLDivElement; text: HTMLSpanElement; bar: HTMLDivElement }>();
  private selected: string | null = null;
  private readonly tmp = new THREE.Vector3();
  private composer: EffectComposer | null = null;
  private placing = false;
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    private readonly container: HTMLElement,
    private readonly quality: QualitySettings,
    private readonly callbacks: EngineCallbacks,
    seed = 20260930,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: quality.antialias,
      powerPreference: 'high-performance',
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality.shadowMapSize > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    // Detail textures are generated once, before any model is built.
    initSurfaces(quality.textureSize);
    const terrain = generateHoldTerrain(seed);
    this.hold = new HoldScene(terrain, quality, pixelRatio);
    void this.loadEnvironment();
    // The sun never moves, so its shadow map only needs to be drawn when asked.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    this.rig = new CameraRig(this.renderer.domElement, {
      bounds: terrain.size * 0.42,
      minDistance: 22,
      maxDistance: 120,
      onTap: (x, y) => this.pick(x, y),
      onInteract: () => {
        this.lastInput = performance.now();
      },
      grab: (x, y) => this.placing && this.hitsGhost(x, y),
      onDrag: (x, y) => this.placeAt(x, y),
    });
    this.ground.constant = -terrain.hall.y;
    this.rig.focus(terrain.hall.x, terrain.hall.y, terrain.hall.z + 6);

    // Floating labels above buildings (names, levels, timers). Plain DOM, positioned each frame.
    this.labelsRoot = document.createElement('div');
    this.labelsRoot.className = 'labels';
    container.appendChild(this.labelsRoot);
    this.addLabel('barrow');

    if (quality.postFx !== 'none') this.composer = this.createComposer(pixelRatio);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private addLabel(id: string) {
    const el = document.createElement('div');
    el.className = 'plot-label';
    const text = document.createElement('span');
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.appendChild(document.createElement('i'));
    el.append(text, bar);
    this.labelsRoot.appendChild(el);
    const label = { el, text, bar };
    this.labels.set(id, label);
    return label;
  }

  start(): void {
    this.lastFrame = performance.now();
    this.lastInput = this.lastFrame;
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.rig.dispose();
    this.labelsRoot.remove();
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get frameCount(): number {
    return this.frames;
  }

  /**
   * Shows the game state: rebuilds plots whose building changed and refreshes the
   * label texts and timer bars. Called on every state change and once a second.
   */
  sync(state: GameState, now: number): void {
    if (this.hold.syncBuildings(state)) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastInput = performance.now();
    }
    if (state.raid.incoming || this.raidShown) {
      this.hold.syncRaid(state.raid.incoming, now);
      this.raidShown = !!state.raid.incoming;
      this.lastInput = performance.now();
    }
    for (const [id, label] of this.labels) {
      if (id !== 'barrow' && !state.buildings[id]) {
        label.el.remove();
        this.labels.delete(id);
      }
    }
    for (const b of Object.values(state.buildings)) if (!this.labels.has(b.id)) this.addLabel(b.id);
    for (const [id, label] of this.labels) {
      if (id === 'barrow') {
        label.text.textContent = `${t('barrow')} · ${Math.min(state.pve.draugrCleared + 1, 10)}`;
        label.el.dataset.kind = 'enemy';
        label.bar.style.display = 'none';
        continue;
      }
      const b = state.buildings[id]!;
      const job = state.queue.find((j) => j.buildingId === id);
      label.text.textContent = b.level > 0 ? `${bName(b.type)} · ${b.level}` : bName(b.type);
      label.el.dataset.kind = 'building';
      label.el.classList.toggle('selected', id === this.selected);
      if (job) {
        const total = job.endsAt - job.startedAt;
        const left = Math.max(0, job.endsAt - now);
        label.bar.style.display = 'block';
        (label.bar.firstChild as HTMLElement).style.width = `${(100 * (1 - left / total)).toFixed(1)}%`;
        label.bar.dataset.time = formatShort(left);
      } else {
        label.bar.style.display = 'none';
      }
    }
  }

  private raidShown = false;

  // ---- placing --------------------------------------------------------------------

  /** Starts placing (or moving) a building: a ghost follows the finger until confirmed. */
  startPlacement(type: BuildingType, level: number, state: GameState, moveId?: string): void {
    this.placing = true;
    this.hold.showGhost(type, level, state, moveId);
    const label = moveId ? this.labels.get(moveId) : undefined;
    if (label) label.el.style.display = 'none';
    this.lastInput = performance.now();
  }

  /** Moves the ghost (spot measured from the centre of the hall) and colours its ring. */
  setPlacement(x: number, z: number, rot: number, ok: boolean): void {
    this.hold.moveGhost(x, z, rot, ok);
    this.lastInput = performance.now();
  }

  endPlacement(): void {
    this.placing = false;
    this.hold.hideGhost();
    for (const label of this.labels.values()) label.el.style.display = '';
    this.lastInput = performance.now();
  }

  private rayFrom(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.rig.camera);
  }

  private hitsGhost(clientX: number, clientY: number): boolean {
    const ghost = this.hold.ghostObject;
    if (!ghost) return false;
    this.rayFrom(clientX, clientY);
    return this.raycaster.intersectObject(ghost, true).length > 0;
  }

  /** Reports the ground spot under the finger (snapped to half units) while placing. */
  private placeAt(clientX: number, clientY: number): void {
    this.rayFrom(clientX, clientY);
    const p = this.raycaster.ray.intersectPlane(this.ground, this.tmp);
    if (!p) return;
    const t = this.hold.terrain;
    this.callbacks.onPlace?.(Math.round((p.x - t.hall.x) * 2) / 2, Math.round((p.z - t.hall.z) * 2) / 2);
  }

  setSelected(id: string | null): void {
    this.selected = id;
    for (const [lid, label] of this.labels) label.el.classList.toggle('selected', lid === id);
  }

  /** Glides the camera to a building or the barrow (used by the quest "Go" arrows). */
  focusOn(id: PickId): void {
    const p = this.hold.anchorOf(id);
    this.rig.glideTo(p.x, p.y, p.z + 6);
    this.lastInput = performance.now();
  }

  /** Glides the camera to a spot measured from the hall (used when placing). */
  focusSpot(x: number, z: number): void {
    const p = this.hold.worldAt(x, z);
    this.rig.glideTo(p.x, p.y, p.z + 4);
    this.lastInput = performance.now();
  }

  setSnow(on: boolean): void {
    this.hold.setSnow(on);
    this.lastInput = performance.now();
  }

  /** Screen position (CSS pixels) of a pickable, used by tests and UI anchors. */
  screenPositionOf(id: PickId): { x: number; y: number } {
    const p = this.hold.anchorOf(id).project(this.rig.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }

  /**
   * Real sky light: a CC0 HDRI from Poly Haven (via @pmndrs/assets), loaded after
   * the first frame so start-up stays fast. It lights and reflects on every PBR surface.
   */
  private async loadEnvironment(): Promise<void> {
    try {
      const { default: url } = await import('@pmndrs/assets/hdri/sunset.exr');
      const texture = await new EXRLoader().loadAsync(url);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.hold.scene.environment = pmrem.fromEquirectangular(texture).texture;
      this.hold.scene.environmentIntensity = 0.55;
      texture.dispose();
      pmrem.dispose();
      this.lastInput = performance.now();
    } catch (err) {
      console.warn('Sky lighting unavailable', err);
    }
  }

  /** Ambient occlusion (soft contact shadows) and bloom (glowing fires), then tone mapping. */
  private createComposer(pixelRatio: number): EffectComposer {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const target = new THREE.WebGLRenderTarget(w * pixelRatio, h * pixelRatio, {
      type: THREE.HalfFloatType,
      samples: this.quality.antialias ? 4 : 0,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(pixelRatio);
    composer.addPass(new RenderPass(this.hold.scene, this.rig.camera));
    if (this.quality.postFx === 'full') {
      const ao = new GTAOPass(this.hold.scene, this.rig.camera, w, h);
      ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
      ao.blendIntensity = 0.85;
      composer.addPass(ao);
    }
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.28, 0.45, 0.92));
    composer.addPass(new OutputPass());
    return composer;
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.rig.setAspect(w / h);
    this.lastInput = performance.now();
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
    } else {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.time += dt;
    this.sinceRender += dt;

    const moving = this.rig.update(dt);
    const active = moving || now - this.lastInput < ACTIVE_AFTER_INPUT_MS;
    if (!active && this.sinceRender < 1 / this.quality.idleFps) return;

    this.hold.update(this.time, this.rig.camera, this.rig.focusPoint);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.hold.scene, this.rig.camera);
    this.placeLabels();
    this.sinceRender = 0;
    this.frames++;

    if (!this.firstFrameSent) {
      this.firstFrameSent = true;
      this.callbacks.onFirstFrame();
    }
    this.fpsWindow.frames++;
    if (now - this.fpsWindow.start > 1000) {
      this.callbacks.onFps?.((this.fpsWindow.frames * 1000) / (now - this.fpsWindow.start));
      this.fpsWindow = { start: now, frames: 0 };
    }
  };

  /** Moves each label to its plot's projected screen position (one pass, no layout reads). */
  private placeLabels(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const [id, label] of this.labels) {
      const p = this.hold.labelAnchor(id, this.tmp).project(this.rig.camera);
      const visible = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      label.el.style.visibility = visible ? '' : 'hidden';
      if (visible) {
        label.el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -100%)`;
      }
    }
  }

  private pick(clientX: number, clientY: number): void {
    if (this.placing) return this.placeAt(clientX, clientY);
    this.rayFrom(clientX, clientY);
    const hits = this.raycaster.intersectObjects(this.hold.pickTargets(), false);
    const id = (hits[0]?.object.userData.pickId as PickId | undefined) ?? null;
    this.callbacks.onSelect(id);
  }
}

/** "1h 05m", "4m 12s", "12s". */
export function formatShort(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
