import { ALLIANCES, createNoise2D, hashString, type RealmMap } from '@jarlheim/sim';

/**
 * Paints Midgard once per realm into an offscreen picture: smooth coastlines (the tile
 * grid is blended, never shown as squares), sea that darkens with depth, snow towards
 * the north, forests and hills drawn as little marks. Territories are a second picture
 * with soft fills and clear borders. The visible map just draws these two images, so
 * panning and zooming cost one drawImage each (one trip, not one per tile).
 */
export const PX = 30;

const KIND_RGB: Record<string, [number, number, number]> = {
  field: [205, 214, 190],
  forest: [92, 124, 86],
  hills: [150, 146, 138],
  town: [214, 206, 182],
  fort: [180, 174, 160],
  capital: [228, 214, 168],
  sea: [30, 74, 110],
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function paintBase(map: RealmMap): HTMLCanvasElement {
  const n = map.size;
  const W = n * PX;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, W);
  const seed = hashString(`midgard-art-${map.realm.id}`);
  const wobble = createNoise2D(seed);
  const grain = createNoise2D(seed ^ 0x2545f491);
  const biome = createNoise2D(seed ^ 0x68e31da4);
  const land = new Float32Array(n * n);
  const rgb = new Float32Array(n * n * 3);
  for (const t of map.tiles) {
    const i = t.y * n + t.x;
    land[i] = t.kind === 'sea' ? 0 : 1;
    const c = KIND_RGB[t.kind] ?? KIND_RGB.field!;
    rgb[i * 3] = c[0];
    rgb[i * 3 + 1] = c[1];
    rgb[i * 3 + 2] = c[2];
  }
  const at = (arr: Float32Array, x: number, y: number, k = 1, o = 0) => {
    const cx = Math.max(0, Math.min(n - 1, x));
    const cy = Math.max(0, Math.min(n - 1, y));
    return arr[(cy * n + cx) * k + o]!;
  };
  // Smooth (bilinear between tile centres) sample of a field.
  const sample = (arr: Float32Array, gx: number, gy: number, k = 1, o = 0) => {
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const top = mix(at(arr, x0, y0, k, o), at(arr, x0 + 1, y0, k, o), tx);
    const bottom = mix(at(arr, x0, y0 + 1, k, o), at(arr, x0 + 1, y0 + 1, k, o), tx);
    return mix(top, bottom, ty);
  };
  const d = img.data;
  for (let py = 0; py < W; py++) {
    for (let px = 0; px < W; px++) {
      const gx = px / PX - 0.5;
      const gy = py / PX - 0.5;
      const l =
        sample(land, gx, gy) + wobble(px * 0.035, py * 0.035) * 0.16 + wobble(px * 0.11, py * 0.11) * 0.05;
      const g = grain(px * 0.18, py * 0.18);
      let r: number, gg: number, b: number;
      if (l > 0.5) {
        r = sample(rgb, gx, gy, 3, 0);
        gg = sample(rgb, gx, gy, 3, 1);
        b = sample(rgb, gx, gy, 3, 2);
        // Lands differ (owner request): dry heath, green grassland and bogs with dark pools.
        const wet = biome(px * 0.012, py * 0.012) + g * 0.08;
        if (wet < -0.3) {
          const k = Math.min(1, (-0.3 - wet) * 2.5) * 0.7;
          r = mix(r, 198, k);
          gg = mix(gg, 176, k);
          b = mix(b, 128, k);
        } else if (wet > 0.38) {
          const k = Math.min(1, (wet - 0.38) * 2.5) * 0.65;
          r = mix(r, 84, k);
          gg = mix(gg, 110, k);
          b = mix(b, 88, k);
          if (g > 0.5 && k > 0.35) {
            r = mix(r, 62, 0.7);
            gg = mix(gg, 98, 0.7);
            b = mix(b, 112, 0.7);
          }
        } else {
          gg = Math.min(255, gg + 10);
          r -= 6;
        }
        // Snow grows towards the north (the top of the map), and on high ground.
        const north = Math.max(0, 1 - py / (W * 0.55));
        const snow = Math.min(0.75, north * 0.8 + Math.max(0, g) * 0.15);
        r = mix(r, 244, snow);
        gg = mix(gg, 247, snow);
        b = mix(b, 250, snow);
        // Light from the north-west: a soft rim along the coast.
        const shade = 1 + g * 0.06 - Math.max(0, 0.62 - l) * 0.6;
        r *= shade;
        gg *= shade;
        b *= shade;
        // Beach and foam at the very edge.
        if (l < 0.54) {
          const foam = (0.54 - l) / 0.04;
          r = mix(r, 236, foam * 0.6);
          gg = mix(gg, 232, foam * 0.6);
          b = mix(b, 214, foam * 0.6);
        }
      } else {
        const depth = Math.min(1, (0.5 - l) * 2.2);
        r = mix(70, 18, depth);
        gg = mix(150, 52, depth);
        b = mix(178, 92, depth);
        const wave = Math.sin((px + py * 0.6) * 0.09 + g * 3) * 0.5 + 0.5;
        const k = 1 + (wave > 0.92 ? 0.08 : 0) + g * 0.03;
        r *= k;
        gg *= k;
        b *= k;
      }
      const o = (py * W + px) * 4;
      d[o] = r;
      d[o + 1] = gg;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Little marks: pines in forests, ridges on hills (seeded, so every visit looks the same).
  for (const t of map.tiles) {
    const h = hashString(`${t.x},${t.y}`);
    const cx = (t.x + 0.5) * PX;
    const cy = (t.y + 0.5) * PX;
    if (t.kind === 'forest') {
      for (let k = 0; k < 3; k++) {
        const x = cx + (((h >> (k * 4)) & 15) / 15 - 0.5) * PX * 0.7;
        const y = cy + (((h >> (k * 4 + 12)) & 15) / 15 - 0.5) * PX * 0.6;
        ctx.fillStyle = '#2f4a2e';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 4, y + 4);
        ctx.lineTo(x - 4, y + 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 1.6, y - 2);
        ctx.lineTo(x - 1.6, y - 2);
        ctx.fill();
      }
    } else if (t.kind === 'hills') {
      ctx.strokeStyle = 'rgba(70,64,58,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 5);
      ctx.lineTo(cx - 2, cy - 4);
      ctx.lineTo(cx + 3, cy + 2);
      ctx.lineTo(cx + 7, cy - 2);
      ctx.stroke();
    }
  }
  // The Law Rock: a ring of standing stones on a green mound.
  const c = ((n - 1) / 2 + 0.5) * PX;
  ctx.fillStyle = 'rgba(120,150,90,0.55)';
  ctx.beginPath();
  ctx.arc(c, c, PX * 1.4, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = '#6f6f74';
    ctx.fillRect(c + Math.cos(a) * PX * 1.25 - 1.5, c + Math.sin(a) * PX * 1.25 - 3, 3, 6);
  }
  return canvas;
}

/** Soft territory colours, clipped to land, with crisp borders between owners. */
export function paintTerritory(
  map: RealmMap,
  base: HTMLCanvasElement,
  ownerOf: (x: number, y: number) => number | null,
): HTMLCanvasElement {
  const n = map.size;
  const W = n * PX;
  const small = document.createElement('canvas');
  small.width = n;
  small.height = n;
  const sctx = small.getContext('2d')!;
  const color = (o: number) => (o === -1 ? [255, 214, 119] : hexRgb(ALLIANCES[o]!.color));
  const img = sctx.createImageData(n, n);
  for (const t of map.tiles) {
    if (t.kind === 'sea') continue;
    const o = ownerOf(t.x, t.y);
    if (o === null) continue;
    const [r, g, b] = color(o);
    const i = (t.y * n + t.x) * 4;
    img.data[i] = r!;
    img.data[i + 1] = g!;
    img.data[i + 2] = b!;
    img.data[i + 3] = o === -1 ? 150 : 105;
  }
  sctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = W;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, W, W);
  // Keep the colour on land only: use the land of the base picture as a mask.
  const mask = landMask(base);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  // Borders where the owner changes.
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const t of map.tiles) {
    if (t.kind === 'sea') continue;
    const o = ownerOf(t.x, t.y);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const nb = map.tiles[(t.y + dy) * n + (t.x + dx)];
      if (!nb || t.x + dx >= n || nb.kind === 'sea') continue;
      const o2 = ownerOf(nb.x, nb.y);
      if (o === o2) continue;
      const which = o ?? o2;
      if (which === null) continue;
      const [r, g, b] = color(which);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.95)`;
      ctx.beginPath();
      if (dx) {
        ctx.moveTo((t.x + 1) * PX, t.y * PX + 2);
        ctx.lineTo((t.x + 1) * PX, (t.y + 1) * PX - 2);
      } else {
        ctx.moveTo(t.x * PX + 2, (t.y + 1) * PX);
        ctx.lineTo((t.x + 1) * PX - 2, (t.y + 1) * PX);
      }
      ctx.stroke();
    }
  }
  return out;
}

const maskCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function landMask(base: HTMLCanvasElement): HTMLCanvasElement {
  const hit = maskCache.get(base);
  if (hit) return hit;
  const m = document.createElement('canvas');
  m.width = base.width;
  m.height = base.height;
  const ctx = m.getContext('2d')!;
  const src = base.getContext('2d')!.getImageData(0, 0, base.width, base.height);
  const out = ctx.createImageData(base.width, base.height);
  for (let i = 0; i < src.data.length; i += 4) {
    // Sea is blue-dominant and darker; land is everything else.
    const r = src.data[i]!;
    const b = src.data[i + 2]!;
    const sea = b > r + 30;
    out.data[i + 3] = sea ? 0 : 255;
  }
  ctx.putImageData(out, 0, 0);
  maskCache.set(base, m);
  return m;
}

function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
