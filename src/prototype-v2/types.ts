export type ArenaEnemyKind = 'hover' | 'burst' | 'tank';

export type ArenaEnemyShape = 'circle' | 'square' | 'diamond';

export type ArenaProjectileOwner = 'player' | 'enemy';

export type ArenaEffectKind = 'muzzle' | 'burst' | 'warning' | 'shield';

export type ArenaWeapon = {
  damage: number;
  fireInterval: number;
  shotCount: number;
  pierce: number;
  bulletSpeed: number;
  bulletSize: number;
  spread: number;
};

export type ArenaProjectile = {
  id: string;
  owner: ArenaProjectileOwner;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  size: number;
  color: string;
  age: number;
  maxAge: number;
  pierce: number;
};

export type ArenaEnemy = {
  id: string;
  kind: ArenaEnemyKind;
  shape: ArenaEnemyShape;
  x: number;
  y: number;
  vx: number;
  cruiseY: number;
  size: number;
  health: number;
  maxHealth: number;
  attackCooldown: number;
  windupTimer: number;
  flash: number;
  phase: number;
  color: string;
  reward: number;
};

export type ArenaEffect = {
  id: string;
  kind: ArenaEffectKind;
  x: number;
  y: number;
  size: number;
  color: string;
  age: number;
  duration: number;
};

export type ArenaGameState = {
  status: 'running' | 'lost';
  elapsed: number;
  score: number;
  playerX: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  shieldRegenCooldown: number;
  playerFlash: number;
  weapon: ArenaWeapon;
  enemies: ArenaEnemy[];
  playerBullets: ArenaProjectile[];
  enemyBullets: ArenaProjectile[];
  effects: ArenaEffect[];
  fireCooldown: number;
  enemySpawnCooldown: number;
  nextBulletId: number;
  nextEnemyId: number;
  nextEffectId: number;
};
