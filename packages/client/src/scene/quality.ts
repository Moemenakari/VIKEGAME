/**
 * Quality tiers. Picked automatically from the device, and overridable from the
 * settings panel (stored in localStorage) or with `?quality=low|medium|high`.
 */
export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  maxPixelRatio: number;
  antialias: boolean;
  shadowMapSize: number; // 0 = shadows off
  snowflakes: number;
  /** Frames per second while nothing moves (ambient water/snow animation). */
  idleFps: number;
}

const PRESETS: Record<QualityTier, QualitySettings> = {
  low: { tier: 'low', maxPixelRatio: 1, antialias: false, shadowMapSize: 0, snowflakes: 350, idleFps: 15 },
  medium: {
    tier: 'medium',
    maxPixelRatio: 1.5,
    antialias: true,
    shadowMapSize: 1024,
    snowflakes: 900,
    idleFps: 24,
  },
  high: {
    tier: 'high',
    maxPixelRatio: 2,
    antialias: true,
    shadowMapSize: 2048,
    snowflakes: 1800,
    idleFps: 30,
  },
};

const STORAGE_KEY = 'jarlheim.quality';

function readStored(): QualityTier | null {
  try {
    const fromUrl = new URLSearchParams(location.search).get('quality');
    const value = fromUrl ?? localStorage.getItem(STORAGE_KEY);
    return value === 'low' || value === 'medium' || value === 'high' ? value : null;
  } catch {
    return null;
  }
}

function detectTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|iPod/i.test(nav.userAgent) || matchMedia('(pointer: coarse)').matches;
  if (cores <= 4 || memory <= 2) return 'low';
  if (mobile) return cores >= 8 && memory >= 6 ? 'high' : 'medium';
  return 'high';
}

export function loadQuality(): QualitySettings {
  return PRESETS[readStored() ?? detectTier()];
}

/** Saves the choice and reloads, since antialiasing is fixed when the renderer is created. */
export function saveQualityAndReload(tier: QualityTier): void {
  try {
    localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    // Storage blocked (private mode): fall back to the URL parameter.
    const url = new URL(location.href);
    url.searchParams.set('quality', tier);
    location.href = url.toString();
    return;
  }
  location.reload();
}
