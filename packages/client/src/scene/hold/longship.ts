import * as THREE from 'three';

/**
 * Procedural longship after the Oseberg and Gokstad ships: a clinker-built hull
 * whose ends sweep up into a carved dragon prow and a curled stern, a single mast
 * with a striped woollen sail, and a row of shields along the gunwale.
 *
 * Built along the z axis with the bow at +z.
 */
const LENGTH = 16;
const BEAM = 2.6;
const DEPTH = 1.3;
const SHEER = 1.6; // how much the ends rise

function hullGeometry(): THREE.BufferGeometry {
  const segsL = 32;
  const segsW = 12;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const dark = new THREE.Color('#4a3424');
  const light = new THREE.Color('#77563a');
  const c = new THREE.Color();

  for (let i = 0; i <= segsL; i++) {
    const t = i / segsL; // 0 = stern, 1 = bow
    const s = Math.sin(Math.PI * t);
    const halfBeam = (BEAM / 2) * Math.pow(s, 0.55);
    const depth = DEPTH * Math.pow(s, 0.35);
    const end = Math.pow(Math.abs(2 * t - 1), 3);
    const gunwale = 0.4 + SHEER * end;
    const z = (t - 0.5) * LENGTH;
    for (let j = 0; j <= segsW; j++) {
      const k = (j / segsW) * 2 - 1; // -1 port gunwale, 0 keel, +1 starboard gunwale
      const x = halfBeam * Math.sin((k * Math.PI) / 2);
      const y = gunwale - (depth + SHEER * end * 0.6) * Math.cos((k * Math.PI) / 2);
      positions.push(x, y, z);
      // Clinker planks: alternating shades from keel to gunwale.
      const strake = Math.floor(Math.abs(k) * 7);
      c.copy(strake % 2 ? light : dark);
      colors.push(c.r, c.g, c.b);
    }
  }
  const row = segsW + 1;
  for (let i = 0; i < segsL; i++) {
    for (let j = 0; j < segsW; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Plank deck between the gunwales, so the open hull reads clearly from above. */
function deckGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const steps = 24;
  const outline: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = 0.1 + (i / steps) * 0.8;
    outline.push([(BEAM / 2) * 0.74 * Math.pow(Math.sin(Math.PI * t), 0.55), (t - 0.5) * LENGTH]);
  }
  shape.moveTo(outline[0]![0], outline[0]![1]);
  for (const [x, z] of outline) shape.lineTo(x, z);
  for (const [x, z] of [...outline].reverse()) shape.lineTo(-x, z);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2); // lay the outline flat: shape y becomes z
  return geo;
}

function curl(points: Array<[number, number]>, z0: number, dir: number, radius: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(([y, z]) => new THREE.Vector3(0, y, z0 + dir * z)));
  const geo = new THREE.TubeGeometry(curve, 24, radius, 6, false);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.8, flatShading: true }),
  );
  mesh.castShadow = true;
  return mesh;
}

function sailTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#efe6d2' : '#a3332a';
    ctx.fillRect(i * 16, 0, 16, 128);
  }
  // Rope lattice used to hold woollen sails in shape.
  ctx.strokeStyle = 'rgba(60,40,30,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLongship(): { group: THREE.Group; update(time: number): void } {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    hullGeometry(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const deck = new THREE.Mesh(
    deckGeometry(),
    new THREE.MeshStandardMaterial({ color: '#9a7652', roughness: 0.85, side: THREE.DoubleSide }),
  );
  deck.position.y = 0.05;
  deck.receiveShadow = true;
  group.add(deck);

  // Rowing benches (thwarts) across the deck.
  const benchGeo = new THREE.BoxGeometry(1, 0.12, 0.3);
  const benchMat = new THREE.MeshStandardMaterial({ color: '#5e4430', roughness: 0.8 });
  for (let i = 0; i < 8; i++) {
    const t = 0.22 + (i / 7) * 0.56;
    const width = BEAM * 0.9 * Math.pow(Math.sin(Math.PI * t), 0.55);
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.scale.x = width;
    bench.position.set(0, 0.2, (t - 0.5) * LENGTH);
    group.add(bench);
  }

  const endY = 0.4 + SHEER;
  // Dragon prow: rises, then bends forward into a head.
  group.add(
    curl(
      [
        [endY - 0.4, LENGTH / 2 - 0.4],
        [endY + 0.5, LENGTH / 2],
        [endY + 1.4, LENGTH / 2 + 0.1],
        [endY + 1.9, LENGTH / 2 + 0.6],
        [endY + 1.8, LENGTH / 2 + 1.1],
      ],
      0,
      1,
      0.17,
    ),
  );
  // Curled stern post.
  group.add(
    curl(
      [
        [endY - 0.4, LENGTH / 2 - 0.4],
        [endY + 0.6, LENGTH / 2],
        [endY + 1.3, LENGTH / 2 - 0.2],
        [endY + 1.4, LENGTH / 2 - 0.7],
        [endY + 1.0, LENGTH / 2 - 0.8],
      ],
      0,
      -1,
      0.15,
    ),
  );

  // Mast, yard and sail.
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3426', roughness: 0.8 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 8, 6), wood);
  mast.position.set(0, 4, 0.5);
  mast.castShadow = true;
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6.4, 6), wood);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 7.3, 0.6);
  group.add(mast, yard);

  const sailGeo = new THREE.PlaneGeometry(6, 4.6, 10, 8);
  const sailPos = sailGeo.getAttribute('position');
  const rest = Float32Array.from(sailPos.array);
  const sail = new THREE.Mesh(
    sailGeo,
    new THREE.MeshStandardMaterial({ map: sailTexture(), side: THREE.DoubleSide, roughness: 0.95 }),
  );
  sail.position.set(0, 4.95, 0.75);
  sail.castShadow = true;
  group.add(sail);

  // Shields along both gunwales, alternating yellow and black (as on the Gokstad ship).
  const shieldGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12).rotateZ(Math.PI / 2);
  const yellow = new THREE.MeshStandardMaterial({ color: '#d8b13e', roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: '#1f1d1b', roughness: 0.7 });
  for (let i = 0; i < 9; i++) {
    const t = 0.22 + (i / 8) * 0.56;
    const halfBeam = (BEAM / 2) * Math.pow(Math.sin(Math.PI * t), 0.55);
    const z = (t - 0.5) * LENGTH;
    for (const side of [-1, 1]) {
      const shield = new THREE.Mesh(shieldGeo, (i + (side > 0 ? 1 : 0)) % 2 ? yellow : black);
      shield.position.set(side * (halfBeam + 0.04), 0.42, z);
      group.add(shield);
    }
  }

  return {
    group,
    update(time) {
      // Wind fills the sail.
      for (let i = 0; i < sailPos.count; i++) {
        const x = rest[i * 3]!;
        const y = rest[i * 3 + 1]!;
        const belly = (1 - (x / 3) ** 2) * (0.75 - (y / 4.6) ** 2);
        sailPos.setZ(i, belly * (0.9 + Math.sin(time * 1.7) * 0.12));
      }
      sailPos.needsUpdate = true;
      // Gentle bobbing on the swell.
      // The hull floats with its deck about a metre above the waterline.
      group.position.y = Math.sin(time * 0.9) * 0.08 + 0.75;
      group.rotation.z = Math.sin(time * 0.7) * 0.025;
      group.rotation.x = Math.sin(time * 0.55 + 1) * 0.012;
    },
  };
}
