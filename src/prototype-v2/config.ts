import type { ArenaEnemyKind, ArenaEnemyShape, ArenaWeapon } from './types';

export const ARENA_PLAYER_HALF_WIDTH = 22;
export const ARENA_PLAYER_RENDER_HALF_WIDTH = 28;
export const ARENA_PLAYER_HEIGHT = 28;
export const ARENA_PLAYER_MARGIN = 14;
export const ARENA_PLAYER_FLOOR_OFFSET = 14;
export const ARENA_TIER_DURATION_SECONDS = 15;
export const ARENA_MAX_FRAME_DELTA_SECONDS = 0.1;
export const ARENA_FIXED_STEP_SECONDS = 1 / 60;
export const ARENA_MAX_CATCH_UP_STEPS = 5;
export const ARENA_MAX_ACTIVE_EFFECTS = 36;
export const ARENA_ENEMY_ZONE_RATIO = 0.46;
export const ARENA_MIN_ENEMY_CRUISE_Y_RATIO = 0.15;
export const ARENA_MAX_ENEMY_CRUISE_Y_RATIO = 0.41;
export const ARENA_SHIELD_REGEN_DELAY_SECONDS = 2.2;
export const ARENA_SHIELD_REGEN_PER_SECOND = 11;
export const ARENA_VERSION_LABEL = 'v0.40';

export const BASE_ARENA_WEAPON: ArenaWeapon = {
  damage: 12,
  fireInterval: 0.11,
  shotCount: 1,
  pierce: 0,
  bulletSpeed: 980,
  bulletSize: 8,
  spread: 14,
};

export const ARENA_ENEMY_COLORS: Record<ArenaEnemyKind, string> = {
  hover: '#6FEAFF',
  burst: '#FF86BE',
  tank: '#FFC874',
  orbiter: '#7EFFF1',
  sniper: '#FFB6D8',
  bomber: '#FFB88A',
  interceptor: '#B9A3FF',
  prismBoss: '#FF6EAE',
};

export const ARENA_ENEMY_SHAPES: Record<ArenaEnemyKind, ArenaEnemyShape> = {
  hover: 'circle',
  burst: 'diamond',
  tank: 'square',
  orbiter: 'circle',
  sniper: 'square',
  bomber: 'square',
  interceptor: 'diamond',
  prismBoss: 'diamond',
};

export const ARENA_ENEMY_CONFIG: Record<
  ArenaEnemyKind,
  {
    size: number;
    baseHealth: number;
    healthPerTier: number;
    strafeSpeed: number;
    descendSpeed: number;
    fireInterval: number;
    windupDuration: number;
    bulletSpeed: number;
    bulletDamage: number;
    bulletSize: number;
    reward: number;
    burstCount: number;
    spreadAngle: number;
    bobAmplitude: number;
  }
> = {
  hover: {
    size: 38,
    baseHealth: 28,
    healthPerTier: 6,
    strafeSpeed: 58,
    descendSpeed: 108,
    fireInterval: 1.55,
    windupDuration: 0.16,
    bulletSpeed: 238,
    bulletDamage: 8,
    bulletSize: 9,
    reward: 90,
    burstCount: 1,
    spreadAngle: 0,
    bobAmplitude: 8,
  },
  burst: {
    size: 46,
    baseHealth: 48,
    healthPerTier: 9,
    strafeSpeed: 44,
    descendSpeed: 96,
    fireInterval: 2.45,
    windupDuration: 0.42,
    bulletSpeed: 255,
    bulletDamage: 7,
    bulletSize: 8,
    reward: 140,
    burstCount: 3,
    spreadAngle: 0.28,
    bobAmplitude: 6,
  },
  tank: {
    size: 58,
    baseHealth: 88,
    healthPerTier: 16,
    strafeSpeed: 28,
    descendSpeed: 84,
    fireInterval: 3.15,
    windupDuration: 0.6,
    bulletSpeed: 220,
    bulletDamage: 16,
    bulletSize: 12,
    reward: 240,
    burstCount: 1,
    spreadAngle: 0,
    bobAmplitude: 4,
  },
  orbiter: {
    size: 44,
    baseHealth: 54,
    healthPerTier: 10,
    strafeSpeed: 46,
    descendSpeed: 96,
    fireInterval: 2.2,
    windupDuration: 0.32,
    bulletSpeed: 262,
    bulletDamage: 9,
    bulletSize: 8,
    reward: 165,
    burstCount: 2,
    spreadAngle: 0.34,
    bobAmplitude: 16,
  },
  sniper: {
    size: 50,
    baseHealth: 72,
    healthPerTier: 12,
    strafeSpeed: 24,
    descendSpeed: 90,
    fireInterval: 3.55,
    windupDuration: 0.82,
    bulletSpeed: 410,
    bulletDamage: 22,
    bulletSize: 10,
    reward: 230,
    burstCount: 1,
    spreadAngle: 0,
    bobAmplitude: 0,
  },
  bomber: {
    size: 54,
    baseHealth: 80,
    healthPerTier: 14,
    strafeSpeed: 34,
    descendSpeed: 88,
    fireInterval: 2.95,
    windupDuration: 0.6,
    bulletSpeed: 236,
    bulletDamage: 15,
    bulletSize: 11,
    reward: 255,
    burstCount: 3,
    spreadAngle: 0.16,
    bobAmplitude: 0,
  },
  interceptor: {
    size: 64,
    baseHealth: 220,
    healthPerTier: 34,
    strafeSpeed: 74,
    descendSpeed: 112,
    fireInterval: 1.9,
    windupDuration: 0.46,
    bulletSpeed: 290,
    bulletDamage: 10,
    bulletSize: 9,
    reward: 420,
    burstCount: 5,
    spreadAngle: 0.2,
    bobAmplitude: 4,
  },
  prismBoss: {
    size: 96,
    baseHealth: 680,
    healthPerTier: 120,
    strafeSpeed: 36,
    descendSpeed: 80,
    fireInterval: 2.55,
    windupDuration: 0.62,
    bulletSpeed: 272,
    bulletDamage: 15,
    bulletSize: 11,
    reward: 980,
    burstCount: 5,
    spreadAngle: 0.22,
    bobAmplitude: 0,
  },
};
