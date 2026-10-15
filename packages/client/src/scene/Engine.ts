import { generateHoldTerrain } from '@jarlheim/sim';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { HoldScene, type PickId } from './hold/HoldScene';
import type { QualitySettings } from './quality';

export interface EngineCallbacks {
  onSelect: (id: PickId | null) => void;
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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    const terrain = generateHoldTerrain(seed);
    this.hold = new HoldScene(terrain, quality, pixelRatio);
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
    });
    this.rig.focus(terrain.hall.x, terrain.hall.y, terrain.hall.z + 6);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    document.addEventListener('visibilitychange', this.onVisibility);
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get frameCount(): number {
    return this.frames;
  }

  /** Screen position (CSS pixels) of a pickable, used by tests and UI anchors. */
  screenPositionOf(id: PickId): { x: number; y: number } {
    const p = this.hold.anchorOf(id).project(this.rig.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
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
    this.renderer.render(this.hold.scene, this.rig.camera);
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

  private pick(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    const hits = this.raycaster.intersectObjects(
      this.hold.pickables.map((p) => p.object),
      false,
    );
    const id = (hits[0]?.object.userData.pickId as PickId | undefined) ?? null;
    this.callbacks.onSelect(id);
  }
}
