import type {
  EnemyType,
  EnemyTypeId,
  TowerType,
  TowerTypeId,
  WaveDefinition,
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
    range: 3,
    fireRate: 0.75,
    projectileSpeed: 9,
    damage: 34,
    cost: 85,
    radius: 0.33,
    projectileRadius: 0.13,
  },
};

export const WAVES: WaveDefinition[] = [
  { enemyType: 'spark', count: 8, spawnInterval: 0.9, startDelay: 1 },
  { enemyType: 'spark', count: 12, spawnInterval: 0.7, startDelay: 0.7 },
  { enemyType: 'block', count: 8, spawnInterval: 0.85, startDelay: 1 },
  { enemyType: 'spike', count: 12, spawnInterval: 0.65, startDelay: 1 },
  { enemyType: 'block', count: 12, spawnInterval: 0.75, startDelay: 1.2 },
  { enemyType: 'spike', count: 16, spawnInterval: 0.55, startDelay: 1.2 },
];
