import type {
  EnemyType,
  EnemyTypeId,
  TowerType,
  TowerTypeId,
} from '@/src/game/types';

export const FIXED_STEP_SECONDS = 1 / 30;

export const STARTING_MONEY = 160;
export const STARTING_LIVES = 20;

export const INTER_WAVE_DELAY_SECONDS = 2.5;
export const MAX_TOWER_LEVEL = 3;
export const TOWER_UPGRADE_COST_MULTIPLIERS = [0.65, 0.95];
export const TOWER_SELL_REFUND_RATIO = 0.7;
export const TOWER_LEVEL_RANGE_BONUS = 0.1;
export const TOWER_LEVEL_FIRE_RATE_BONUS = 0.12;
export const TOWER_LEVEL_PROJECTILE_SPEED_BONUS = 0.08;
export const TOWER_LEVEL_DAMAGE_BONUS = 0.45;

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyType> = {
  spark: {
    id: 'spark',
    label: 'Spark',
    shape: 'circle',
    color: '#6DEBFF',
    radius: 0.24,
    maxHealth: 24,
    speed: 1.5,
    reward: 10,
    coreDamage: 1,
  },
  block: {
    id: 'block',
    label: 'Block',
    shape: 'square',
    color: '#FF9E7A',
    radius: 0.3,
    maxHealth: 52,
    speed: 1,
    reward: 16,
    coreDamage: 2,
  },
  spike: {
    id: 'spike',
    label: 'Spike',
    shape: 'triangle',
    color: '#C6B4FF',
    radius: 0.28,
    maxHealth: 34,
    speed: 1.3,
    reward: 13,
    coreDamage: 1,
  },
};

export const TOWER_TYPES: Record<TowerTypeId, TowerType> = {
  pulse: {
    id: 'pulse',
    label: 'Pulse',
    color: '#67F4A5',
    attackKind: 'projectile',
    range: 2.3,
    fireRate: 1.35,
    projectileSpeed: 7,
    damage: 16,
    cost: 55,
    radius: 0.28,
    projectileRadius: 0.11,
  },
  lance: {
    id: 'lance',
    label: 'Lance',
    color: '#FFD56A',
    attackKind: 'projectile',
    range: 3,
    fireRate: 0.75,
    projectileSpeed: 9,
    damage: 34,
    cost: 85,
    radius: 0.33,
    projectileRadius: 0.13,
  },
  spray: {
    id: 'spray',
    label: 'Spray',
    color: '#7FD5FF',
    attackKind: 'projectile',
    range: 1.9,
    fireRate: 5.2,
    projectileSpeed: 10.5,
    damage: 5,
    cost: 72,
    radius: 0.27,
    projectileRadius: 0.08,
  },
  bomb: {
    id: 'bomb',
    label: 'Bomb',
    color: '#FF8A5C',
    attackKind: 'splash',
    range: 2.6,
    fireRate: 0.62,
    projectileSpeed: 5.8,
    damage: 36,
    cost: 118,
    radius: 0.31,
    projectileRadius: 0.12,
    splashRadius: 1.1,
  },
  cold: {
    id: 'cold',
    label: 'Cold',
    color: '#7EE3FF',
    attackKind: 'slow',
    range: 2.65,
    fireRate: 1.45,
    projectileSpeed: 7,
    damage: 7,
    cost: 95,
    radius: 0.29,
    projectileRadius: 0.1,
    slowMultiplier: 0.52,
    slowDuration: 2.4,
  },
  laser: {
    id: 'laser',
    label: 'Laser',
    color: '#FF5ED0',
    attackKind: 'beam',
    range: 3.5,
    fireRate: 10,
    projectileSpeed: 0,
    damage: 44,
    cost: 235,
    radius: 0.34,
    projectileRadius: 0,
    beamWidth: 0.13,
    beamColor: '#FF89E7',
  },
};
