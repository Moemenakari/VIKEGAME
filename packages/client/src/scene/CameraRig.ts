import * as THREE from 'three';

/**
 * City-builder camera: orbits a ground target at a low FOV (near-isometric).
 *
 * Touch:  one finger pans, two fingers pinch to zoom and twist to rotate.
 * Mouse:  left-drag pans, right-drag (or shift-drag) rotates, wheel zooms.
 * A short press without movement is reported as a tap (for selecting things).
 */
export interface CameraRigOptions {
  bounds: number; // max distance of the target from the origin
  minDistance: number;
  maxDistance: number;
  onTap: (clientX: number, clientY: number) => void;
  onInteract: () => void;
}

const TAP_MAX_MOVE = 8;
const TAP_MAX_MS = 350;
const DAMPING = 10;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private target = new THREE.Vector3(0, 1.5, 0);
  private goalTarget = this.target.clone();
  private yaw = 0.35;
  private goalYaw = this.yaw;
  private distance: number;
  private goalDistance: number;

  private pointers = new Map<number, { x: number; y: number }>();
  private pressStart: { id: number; x: number; y: number; t: number; moved: boolean } | null = null;
  private rotating = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly opts: CameraRigOptions,
  ) {
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 600);
    this.distance = this.goalDistance = THREE.MathUtils.lerp(opts.minDistance, opts.maxDistance, 0.42);
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('pointermove', this.onMove);
    this.element.removeEventListener('pointerup', this.onUp);
    this.element.removeEventListener('pointercancel', this.onUp);
    this.element.removeEventListener('wheel', this.onWheel);
  }

  setAspect(aspect: number): void {
    // Portrait phones are narrow: widen the vertical FOV so at least ~34° is visible across.
    const minHorizontal = THREE.MathUtils.degToRad(34);
    const vertical = 2 * Math.atan(Math.tan(minHorizontal / 2) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vertical), 32, 58);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  focus(x: number, y: number, z: number): void {
    this.goalTarget.set(x, y, z);
    this.target.copy(this.goalTarget);
  }

  /** Glides the camera to a new focus point instead of jumping there. */
  glideTo(x: number, y: number, z: number): void {
    this.goalTarget.set(x, y, z);
  }

  /** Smoothly follows the goals. Returns true while the camera is still moving. */
  update(dt: number): boolean {
    const k = 1 - Math.exp(-DAMPING * dt);
    this.target.lerp(this.goalTarget, k);
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.distance += (this.goalDistance - this.distance) * k;

    // Tilt with zoom: closer = more horizontal view, further = more top-down.
    const zoom01 = (this.distance - this.opts.minDistance) / (this.opts.maxDistance - this.opts.minDistance);
    const pitch = THREE.MathUtils.lerp(0.62, 1.02, zoom01);

    const horizontal = this.distance * Math.cos(pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + this.distance * Math.sin(pitch),
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);

    return (
      this.target.distanceToSquared(this.goalTarget) > 1e-4 ||
      Math.abs(this.goalYaw - this.yaw) > 1e-4 ||
      Math.abs(this.goalDistance - this.distance) > 1e-3
    );
  }

  get focusPoint(): THREE.Vector3 {
    return this.target;
  }

  // ---- input -------------------------------------------------------------

  private onDown = (e: PointerEvent): void => {
    this.element.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.rotating = e.button === 2 || e.shiftKey;
    this.pressStart =
      this.pointers.size === 1
        ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false }
        : null;
    this.opts.onInteract();
  };

  private onMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;

    if (this.pressStart && this.pressStart.id === e.pointerId) {
      const moved = Math.hypot(e.clientX - this.pressStart.x, e.clientY - this.pressStart.y);
      if (moved > TAP_MAX_MOVE) this.pressStart.moved = true;
    }

    if (this.pointers.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (this.rotating) this.goalYaw -= dx * 0.008;
      else this.pan(dx, dy);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.entries()];
      const other = a![0] === e.pointerId ? b![1] : a![1];
      const before = {
        dist: Math.hypot(prev.x - other.x, prev.y - other.y),
        ang: Math.atan2(prev.y - other.y, prev.x - other.x),
      };
      const after = {
        dist: Math.hypot(e.clientX - other.x, e.clientY - other.y),
        ang: Math.atan2(e.clientY - other.y, e.clientX - other.x),
      };
      if (before.dist > 0 && after.dist > 0) this.zoomBy(before.dist / after.dist);
      let dAng = after.ang - before.ang;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      this.goalYaw -= dAng;
      // Two-finger drag also pans (half, since each finger reports the move).
      this.pan((e.clientX - prev.x) / 2, (e.clientY - prev.y) / 2);
    }

    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.opts.onInteract();
  };

  private onUp = (e: PointerEvent): void => {
    const press = this.pressStart;
    if (press && press.id === e.pointerId && !press.moved && performance.now() - press.t < TAP_MAX_MS) {
      this.opts.onTap(e.clientX, e.clientY);
    }
    this.pointers.delete(e.pointerId);
    this.pressStart = null;
    this.opts.onInteract();
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomBy(Math.exp(e.deltaY * 0.0012));
    this.opts.onInteract();
  };

  private zoomBy(factor: number): void {
    this.goalDistance = THREE.MathUtils.clamp(
      this.goalDistance * factor,
      this.opts.minDistance,
      this.opts.maxDistance,
    );
  }

  /** Moves the target so the ground under the finger follows the finger. */
  private pan(dx: number, dy: number): void {
    const height = this.element.clientHeight || 1;
    const worldPerPixel =
      (2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / height;
    const sin = Math.sin(this.goalYaw);
    const cos = Math.cos(this.goalYaw);
    // Screen right = (cos, -sin) on the ground, screen up = (-sin, -cos).
    this.goalTarget.x -= (dx * cos + dy * sin) * worldPerPixel;
    this.goalTarget.z -= (-dx * sin + dy * cos) * worldPerPixel;
    const r = Math.hypot(this.goalTarget.x, this.goalTarget.z);
    if (r > this.opts.bounds) {
      this.goalTarget.x *= this.opts.bounds / r;
      this.goalTarget.z *= this.opts.bounds / r;
    }
  }
}
