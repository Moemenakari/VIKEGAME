import type { HoldTerrain } from '@jarlheim/sim';
import { PLOTS, createRng, nextFloat, nextInt, nextRange, sampleHeight } from '@jarlheim/sim';
import * as THREE from 'three';
import { ModelBuilder, paint } from './modelKit';

/**
 * Life in the hold: villagers walking the paths between the Great Hall and the
 * plots, and a small flock of sheep grazing by the shore. Each kind is one
 * InstancedMesh (one draw call per material for the whole crowd); positions are
 * updated in one pass per frame.
 */
export interface Life {
  group: THREE.Group;
  update(time: number, dt: number): void;
}

/** A villager: boots, legs, belted tunic, cloak, head and hood. About 1.7 units tall. */
function villagerGeometry(tunic: string): THREE.Mesh {
  const kit = new ModelBuilder();
  const cloth = (c: string) => paint(c, 'cloth');
  kit.add(new THREE.CylinderGeometry(0.09, 0.1, 0.75, 6), cloth('#3c342c'), [-0.11, 0.38, 0]);
  kit.add(new THREE.CylinderGeometry(0.09, 0.1, 0.75, 6), cloth('#3c342c'), [0.11, 0.38, 0]);
  // Tunic body: white so the per-instance colour shows through.
  kit.add(new THREE.CylinderGeometry(0.2, 0.32, 0.75, 8), cloth(tunic), [0, 1.05, 0]);
  kit.add(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 8), paint('#4a3426', 'timber'), [0, 0.95, 0]);
  kit.add(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 5), cloth(tunic), [-0.32, 1.1, 0], [0, 0, 0.2]);
  kit.add(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 5), cloth(tunic), [0.32, 1.1, 0], [0, 0, -0.2]);
  kit.add(new THREE.SphereGeometry(0.17, 10, 8), paint('#e2b896', 'plain'), [0, 1.6, 0]);
  kit.add(
    new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    cloth('#5a4a3a'),
    [0, 1.63, -0.02],
  );
  kit.add(new THREE.ConeGeometry(0.36, 0.8, 8, 1, true), cloth('#6b5a48'), [0, 1.15, -0.06]);
  return kit.build('villager');
}

function sheepGeometry(): THREE.Mesh {
  const kit = new ModelBuilder();
  const wool = paint('#ece6da', 'cloth');
  kit.add(new THREE.IcosahedronGeometry(0.45, 1), wool, [0, 0.62, 0], [0, 0, 0], [1.35, 0.95, 0.9]);
  kit.add(
    new THREE.IcosahedronGeometry(0.2, 1),
    paint('#2c2826', 'plain'),
    [0.62, 0.75, 0],
    [0, 0, 0],
    [1.3, 1, 0.9],
  );
  for (const [x, z] of [
    [-0.3, -0.18],
    [-0.3, 0.18],
    [0.3, -0.18],
    [0.3, 0.18],
  ] as const) {
    kit.add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), paint('#2c2826', 'plain'), [x, 0.2, z]);
  }
  return kit.build('sheep');
}

/** Dyed wool: madder red, woad blue, weld-and-woad green, undyed brown. */
const TUNICS = ['#9e3b2f', '#3b5f7a', '#5d6e3a', '#8a6a44'];

interface Walker {
  mesh: number;
  slot: number;
  from: THREE.Vector2;
  to: THREE.Vector2;
  toDoor: boolean;
  t: number;
  speed: number;
  pause: number;
}

export function createLife(terrain: HoldTerrain, villagers: number, sheep: number): Life {
  const group = new THREE.Group();
  const rng = createRng(terrain.seed + 99);
  const hall = new THREE.Vector2(terrain.hall.x, terrain.hall.z);
  const doors = [new THREE.Vector2(hall.x, hall.y + 3.6), new THREE.Vector2(hall.x, hall.y - 3.6)];
  const spots = PLOTS.slice(0, 8).map((p) => new THREE.Vector2(hall.x + p.dx * 0.8, hall.y + p.dz * 0.8));

  // ---- villagers: one instanced crowd per tunic colour -------------------------------
  const perMesh = Math.ceil(villagers / TUNICS.length);
  const crowds = TUNICS.map((tunic) => {
    const model = villagerGeometry(tunic);
    const mesh = new THREE.InstancedMesh(model.geometry, model.material, Math.max(1, perMesh));
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });
  const walkers: Walker[] = [];
  for (let i = 0; i < villagers; i++) {
    const mesh = i % TUNICS.length;
    const crowd = crowds[mesh]!;
    const spot = spots[nextInt(rng, 0, spots.length - 1)]!;
    walkers.push({
      mesh,
      slot: crowd.count++,
      from: doors[i % 2]!.clone(),
      to: spot.clone(),
      toDoor: false,
      t: nextFloat(rng),
      speed: nextRange(rng, 0.05, 0.09),
      pause: 0,
    });
  }

  // ---- sheep ------------------------------------------------------------------------
  const sModel = sheepGeometry();
  const flock = new THREE.InstancedMesh(sModel.geometry, sModel.material, Math.max(1, sheep));
  flock.count = sheep;
  flock.castShadow = true;
  flock.frustumCulled = false;
  // Graze on the far side of the settlement from the ship.
  const pasture = new THREE.Vector2(hall.x - 22, hall.y + 15.5);
  const grazers = Array.from({ length: sheep }, () => ({
    pos: new THREE.Vector2(pasture.x + nextRange(rng, -4, 4), pasture.y + nextRange(rng, -3, 3)),
    heading: nextFloat(rng) * Math.PI * 2,
    phase: nextFloat(rng) * 10,
  }));
  group.add(flock);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const p2 = new THREE.Vector2();

  return {
    group,
    update(time, dt) {
      walkers.forEach((w, i) => {
        if (w.pause > 0) {
          w.pause -= dt;
        } else {
          w.t += (w.speed * dt * 10) / Math.max(1, w.from.distanceTo(w.to));
          if (w.t >= 1) {
            // Arrived: rest a moment, then go back to the hall or out to another plot.
            w.from.copy(w.to);
            w.to.copy(w.toDoor ? spots[(i * 3 + Math.floor(time)) % spots.length]! : doors[i % 2]!);
            w.toDoor = !w.toDoor;
            w.t = 0;
            w.pause = 1 + (i % 4);
          }
        }
        p2.lerpVectors(w.from, w.to, w.t);
        const bob = w.pause > 0 ? 0 : Math.abs(Math.sin(time * 9 + i)) * 0.05;
        pos.set(p2.x, sampleHeight(terrain, p2.x, p2.y) + bob, p2.y);
        q.setFromAxisAngle(up, Math.atan2(w.to.x - w.from.x, w.to.y - w.from.y));
        m.compose(pos, q, one);
        crowds[w.mesh]!.setMatrixAt(w.slot, m);
      });
      for (const crowd of crowds) crowd.instanceMatrix.needsUpdate = true;

      grazers.forEach((g, i) => {
        // Amble a little, then graze.
        const moving = Math.sin(time * 0.4 + g.phase) > 0.6;
        if (moving) {
          g.heading += Math.sin(time * 0.7 + g.phase) * dt * 0.8;
          g.pos.x += Math.cos(g.heading) * dt * 0.35;
          g.pos.y += Math.sin(g.heading) * dt * 0.35;
          if (g.pos.distanceTo(pasture) > 6) g.heading = Math.atan2(pasture.y - g.pos.y, pasture.x - g.pos.x);
        }
        const graze = moving ? 0 : Math.sin(time * 2 + g.phase) * 0.03;
        pos.set(g.pos.x, sampleHeight(terrain, g.pos.x, g.pos.y) + graze, g.pos.y);
        q.setFromAxisAngle(up, -g.heading);
        m.compose(pos, q, one);
        flock.setMatrixAt(i, m);
      });
      flock.instanceMatrix.needsUpdate = true;
    },
  };
}
