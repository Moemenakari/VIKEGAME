/**
 * Quality tiers. Players always get `high` (no picker: owner request); the lower
 * tiers stay for automated tests via `?quality=low|medium`.
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
  /** Edge of the generated surface textures in pixels (0 = plain colours). */
  textureSize: number;
  /** Post-processing: none, bloom only, or ambient occlusion + bloom. */
  postFx: 'none' | 'bloom' | 'full';
}

const PRESETS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    antialias: false,
    shadowMapSize: 0,
    snowflakes: 350,
    idleFps: 15,
    textureSize: 0,
    postFx: 'none',
  },
  medium: {
    tier: 'medium',
    maxPixelRatio: 1.5,
    antialias: true,
    shadowMapSize: 1024,
    snowflakes: 900,
    idleFps: 24,
    textureSize: 256,
    postFx: 'bloom',
  },
  high: {
    tier: 'high',
    maxPixelRatio: 2,
    antialias: true,
    shadowMapSize: 2048,
    snowflakes: 1800,
    idleFps: 30,
    textureSize: 512,
    postFx: 'full',
  },
};

function fromUrl(): QualityTier | null {
  try {
    const value = new URLSearchParams(location.search).get('quality');
    return value === 'low' || value === 'medium' || value === 'high' ? value : null;
  } catch {
    return null;
  }
}

/** Always the best look (owner decision D-031); `?quality=` is kept for tests and very old phones. */
export function loadQuality(): QualitySettings {
  return PRESETS[fromUrl() ?? 'high'];
}
