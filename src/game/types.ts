export type Vector2 = {
  x: number;
  y: number;
};

export type Cell = {
  col: number;
  row: number;
};

export type EnemyShape = 'circle' | 'square' | 'triangle';

export type EnemyTypeId = 'spark' | 'block' | 'spike';

export type TowerTypeId = 'pulse' | 'lance';
export type TargetMode = 'first' | 'last' | 'strong';
export type EffectKind = 'spawn' | 'hit' | 'place' | 'upgrade' | 'sell';
export type GameEventType = EffectKind | 'targetMode';
export type GameMapId = 'relay' | 'switchback';

export type EnemyType = {
  id: EnemyTypeId;
  label: string;
  shape: EnemyShape;
  color: string;
  radius: number;
  maxHealth: number;
  speed: number;
  reward: number;
  coreDamage: number;
};

export type TowerType = {
  id: TowerTypeId;
  label: string;
  color: string;
  range: number;
  fireRate: number;
  projectileSpeed: number;
  damage: number;
  cost: number;
  radius: number;
  projectileRadius: number;
};

export type WaveDefinition = {
  enemyType: EnemyTypeId;
  count: number;
  spawnInterval: number;
  startDelay?: number;
};

export type InitialTowerPlacement = {
  towerType: TowerTypeId;
  cell: Cell;
};

export type GameMapDefinition = {
  id: GameMapId;
  label: string;
  cols: number;
  rows: number;
  pathWaypoints: Cell[];
  initialTowers: InitialTowerPlacement[];
};

export type MatchStatus = 'running' | 'won' | 'lost';

export type Enemy = {
  id: string;
  enemyType: EnemyTypeId;
  shape: EnemyShape;
  color: string;
  radius: number;
  speed: number;
  reward: number;
  coreDamage: number;
  maxHealth: number;
  health: number;
  progress: number;
  position: Vector2;
};

export type Tower = {
  id: string;
  towerType: TowerTypeId;
  cell: Cell;
  level: number;
  targetMode: TargetMode;
  cooldown: number;
};

export type Projectile = {
  id: string;
  sourceTowerId: string;
  towerType: TowerTypeId;
  targetEnemyId: string;
  damage: number;
  speed: number;
  radius: number;
  color: string;
  position: Vector2;
};

export type VisualEffect = {
  id: string;
  kind: EffectKind;
  position: Vector2;
  age: number;
  duration: number;
  startRadius: number;
  endRadius: number;
  color: string;
};

export type GameEvent = {
  id: number;
  type: GameEventType;
};

export type GameState = {
  mapId: GameMapId;
  status: MatchStatus;
  elapsed: number;
  money: number;
  lives: number;
  waveIndex: number;
  spawnedInWave: number;
  timeUntilWaveStart: number;
  timeUntilNextSpawn: number;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  effects: VisualEffect[];
  recentEvents: GameEvent[];
  nextEnemyId: number;
  nextTowerId: number;
  nextProjectileId: number;
  nextEffectId: number;
  nextEventId: number;
};
