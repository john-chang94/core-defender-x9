import {
  ENEMY_TYPES,
  FIXED_STEP_SECONDS,
  INTER_WAVE_DELAY_SECONDS,
  MAX_TOWER_LEVEL,
  STARTING_LIVES,
  STARTING_MONEY,
  TOWER_LEVEL_DAMAGE_BONUS,
  TOWER_LEVEL_FIRE_RATE_BONUS,
  TOWER_LEVEL_PROJECTILE_SPEED_BONUS,
  TOWER_LEVEL_RANGE_BONUS,
  TOWER_SELL_REFUND_RATIO,
  TOWER_TYPES,
  TOWER_UPGRADE_COST_MULTIPLIERS,
} from '@/src/game/config';
import {
  getDefaultGameLevelIdForMap,
  loadGameLevel,
} from '@/src/game/levels';
import { cellCenter, isCellInBounds, samplePolyline, toCellKey } from '@/src/game/path';
import { DEFAULT_GAME_MAP_ID, loadGameMap, type LoadedGameMap } from '@/src/game/maps';
import type {
  Beam,
  Cell,
  EffectKind,
  Enemy,
  EnemyTypeId,
  GameEvent,
  GameEventType,
  GameLevelId,
  GameMapId,
  GameState,
  MatchStatus,
  Projectile,
  TargetMode,
  Tower,
  TowerType,
  TowerTypeId,
  Vector2,
  VisualEffect,
} from '@/src/game/types';

const TARGET_MODE_ORDER: TargetMode[] = ['first', 'last', 'strong'];
const DEFAULT_TOWER_AIM_ANGLE = -Math.PI / 2;
const BEAM_FIRE_EVENT_INTERVAL_SECONDS = 0.12;

type EffectPreset = {
  duration: number;
  startRadius: number;
  endRadius: number;
  color: string;
};

const EFFECT_PRESETS: Record<EffectKind, EffectPreset> = {
  spawn: {
    duration: 0.45,
    startRadius: 0.12,
    endRadius: 0.56,
    color: '#7DEBFF',
  },
  hit: {
    duration: 0.22,
    startRadius: 0.08,
    endRadius: 0.34,
    color: '#FFD67A',
  },
  place: {
    duration: 0.3,
    startRadius: 0.16,
    endRadius: 0.45,
    color: '#89FFB8',
  },
  upgrade: {
    duration: 0.34,
    startRadius: 0.16,
    endRadius: 0.55,
    color: '#8DB8FF',
  },
  sell: {
    duration: 0.36,
    startRadius: 0.2,
    endRadius: 0.54,
    color: '#FF9B9B',
  },
  splash: {
    duration: 0.34,
    startRadius: 0.2,
    endRadius: 1.15,
    color: '#FF9C65',
  },
  chill: {
    duration: 0.42,
    startRadius: 0.14,
    endRadius: 0.78,
    color: '#8EEBFF',
  },
};

function appendEvent(
  events: GameEvent[],
  nextEventId: number,
  type: GameEventType,
  towerType?: TowerTypeId
): number {
  events.push({
    id: nextEventId,
    type,
    towerType,
  });
  return nextEventId + 1;
}

function createEffect(kind: EffectKind, position: Vector2, nextEffectId: number): VisualEffect {
  const preset = EFFECT_PRESETS[kind];

  return {
    id: `FX${nextEffectId}`,
    kind,
    position,
    age: 0,
    duration: preset.duration,
    startRadius: preset.startRadius,
    endRadius: preset.endRadius,
    color: preset.color,
  };
}

function createEnemy(enemyTypeId: EnemyTypeId, nextEnemyId: number, map: LoadedGameMap): Enemy {
  const template = ENEMY_TYPES[enemyTypeId];
  return {
    id: `E${nextEnemyId}`,
    enemyType: template.id,
    shape: template.shape,
    color: template.color,
    radius: template.radius,
    speed: template.speed,
    reward: template.reward,
    coreDamage: template.coreDamage,
    maxHealth: template.maxHealth,
    health: template.maxHealth,
    progress: 0,
    position: samplePolyline(map.route, 0),
    slowMultiplier: 1,
    slowTimeRemaining: 0,
  };
}

function isBetterTarget(candidate: Enemy, incumbent: Enemy | null, targetMode: TargetMode): boolean {
  if (!incumbent) {
    return true;
  }

  if (targetMode === 'first') {
    if (candidate.progress !== incumbent.progress) {
      return candidate.progress > incumbent.progress;
    }
    return candidate.health > incumbent.health;
  }

  if (targetMode === 'last') {
    if (candidate.progress !== incumbent.progress) {
      return candidate.progress < incumbent.progress;
    }
    return candidate.health > incumbent.health;
  }

  if (candidate.health !== incumbent.health) {
    return candidate.health > incumbent.health;
  }

  return candidate.progress > incumbent.progress;
}

function selectTarget(
  enemies: Enemy[],
  towerCell: Cell,
  towerStats: TowerType,
  targetMode: TargetMode
): Enemy | null {
  const towerPosition = cellCenter(towerCell);
  const rangeSquared = towerStats.range * towerStats.range;

  let bestTarget: Enemy | null = null;

  for (const enemy of enemies) {
    const dx = enemy.position.x - towerPosition.x;
    const dy = enemy.position.y - towerPosition.y;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared > rangeSquared) {
      continue;
    }

    if (isBetterTarget(enemy, bestTarget, targetMode)) {
      bestTarget = enemy;
    }
  }

  return bestTarget;
}

function createInitialTowers(map: LoadedGameMap): Tower[] {
  return map.initialTowers.map((tower, index) => ({
    id: `T${index + 1}`,
    towerType: tower.towerType,
    cell: tower.cell,
    level: 1,
    targetMode: 'first',
    cooldown: 0,
    aimAngle: DEFAULT_TOWER_AIM_ANGLE,
  }));
}

function findTower(state: GameState, towerId: string): Tower | undefined {
  return state.towers.find((tower) => tower.id === towerId);
}

export function getTowerStats(tower: Tower): TowerType {
  const baseTowerType = TOWER_TYPES[tower.towerType];
  const levelOffset = Math.max(0, tower.level - 1);

  return {
    ...baseTowerType,
    range: baseTowerType.range * (1 + TOWER_LEVEL_RANGE_BONUS * levelOffset),
    fireRate: baseTowerType.fireRate * (1 + TOWER_LEVEL_FIRE_RATE_BONUS * levelOffset),
    projectileSpeed:
      baseTowerType.projectileSpeed * (1 + TOWER_LEVEL_PROJECTILE_SPEED_BONUS * levelOffset),
    damage: Math.round(baseTowerType.damage * (1 + TOWER_LEVEL_DAMAGE_BONUS * levelOffset)),
  };
}

export function getTowerUpgradeCost(tower: Tower): number | null {
  if (tower.level >= MAX_TOWER_LEVEL) {
    return null;
  }

  const baseTowerType = TOWER_TYPES[tower.towerType];
  const multiplier = TOWER_UPGRADE_COST_MULTIPLIERS[tower.level - 1];
  if (multiplier === undefined) {
    return null;
  }

  return Math.round(baseTowerType.cost * multiplier);
}

export function getTowerSellValue(tower: Tower): number {
  const baseTowerType = TOWER_TYPES[tower.towerType];
  let totalInvested = baseTowerType.cost;

  for (let level = 1; level < tower.level; level += 1) {
    const multiplier = TOWER_UPGRADE_COST_MULTIPLIERS[level - 1];
    if (multiplier !== undefined) {
      totalInvested += Math.round(baseTowerType.cost * multiplier);
    }
  }

  return Math.max(1, Math.round(totalInvested * TOWER_SELL_REFUND_RATIO));
}

export function createInitialGameState(
  mapId: GameMapId = DEFAULT_GAME_MAP_ID,
  levelId?: GameLevelId
): GameState {
  const resolvedLevelId = levelId ?? getDefaultGameLevelIdForMap(mapId);
  const level = loadGameLevel(resolvedLevelId);
  const map = loadGameMap(level.mapId);

  return {
    mapId: level.mapId,
    levelId: level.id,
    status: 'running',
    elapsed: 0,
    money: level.startingMoney ?? STARTING_MONEY,
    lives: level.startingLives ?? STARTING_LIVES,
    waveIndex: 0,
    spawnedInWave: 0,
    timeUntilWaveStart: level.waves[0]?.startDelay ?? 0,
    timeUntilNextSpawn: 0,
    enemies: [],
    towers: createInitialTowers(map),
    projectiles: [],
    beams: [],
    effects: [],
    recentEvents: [],
    nextEnemyId: 1,
    nextTowerId: map.initialTowers.length + 1,
    nextProjectileId: 1,
    nextEffectId: 1,
    nextEventId: 1,
  };
}

export function canPlaceTower(state: GameState, cell: Cell, towerTypeId: TowerTypeId): boolean {
  if (state.status !== 'running') {
    return false;
  }

  const map = loadGameMap(state.mapId);

  if (!isCellInBounds(cell, map.cols, map.rows)) {
    return false;
  }

  if (map.pathCellKeys.has(toCellKey(cell))) {
    return false;
  }

  if (state.towers.some((tower) => tower.cell.col === cell.col && tower.cell.row === cell.row)) {
    return false;
  }

  const towerType = TOWER_TYPES[towerTypeId];
  return state.money >= towerType.cost;
}

export function placeTower(state: GameState, cell: Cell, towerTypeId: TowerTypeId): GameState {
  if (!canPlaceTower(state, cell, towerTypeId)) {
    return state;
  }

  const towerType = TOWER_TYPES[towerTypeId];

  const nextTower: Tower = {
    id: `T${state.nextTowerId}`,
    towerType: towerTypeId,
    cell,
    level: 1,
    targetMode: 'first',
    cooldown: 0,
    aimAngle: DEFAULT_TOWER_AIM_ANGLE,
  };

  const nextEvents: GameEvent[] = [];
  const nextEventId = appendEvent(nextEvents, state.nextEventId, 'place');

  const placeEffect = createEffect('place', cellCenter(cell), state.nextEffectId);

  return {
    ...state,
    money: state.money - towerType.cost,
    towers: [...state.towers, nextTower],
    effects: [...state.effects, placeEffect],
    recentEvents: nextEvents,
    nextTowerId: state.nextTowerId + 1,
    nextEffectId: state.nextEffectId + 1,
    nextEventId,
  };
}

export function canUpgradeTower(state: GameState, towerId: string): boolean {
  if (state.status !== 'running') {
    return false;
  }

  const tower = findTower(state, towerId);
  if (!tower) {
    return false;
  }

  const upgradeCost = getTowerUpgradeCost(tower);
  return upgradeCost !== null && state.money >= upgradeCost;
}

export function upgradeTower(state: GameState, towerId: string): GameState {
  if (!canUpgradeTower(state, towerId)) {
    return state;
  }

  const tower = findTower(state, towerId);
  if (!tower) {
    return state;
  }

  const upgradeCost = getTowerUpgradeCost(tower);
  if (upgradeCost === null) {
    return state;
  }

  const nextEvents: GameEvent[] = [];
  const nextEventId = appendEvent(nextEvents, state.nextEventId, 'upgrade');
  const effect = createEffect('upgrade', cellCenter(tower.cell), state.nextEffectId);

  return {
    ...state,
    money: state.money - upgradeCost,
    towers: state.towers.map((item) =>
      item.id === towerId
        ? {
            ...item,
            level: item.level + 1,
          }
        : item
    ),
    effects: [...state.effects, effect],
    recentEvents: nextEvents,
    nextEffectId: state.nextEffectId + 1,
    nextEventId,
  };
}

export function sellTower(state: GameState, towerId: string): GameState {
  if (state.status !== 'running') {
    return state;
  }

  const tower = findTower(state, towerId);
  if (!tower) {
    return state;
  }

  const sellValue = getTowerSellValue(tower);
  const nextEvents: GameEvent[] = [];
  const nextEventId = appendEvent(nextEvents, state.nextEventId, 'sell');
  const effect = createEffect('sell', cellCenter(tower.cell), state.nextEffectId);

  return {
    ...state,
    money: state.money + sellValue,
    towers: state.towers.filter((item) => item.id !== towerId),
    projectiles: state.projectiles.filter((projectile) => projectile.sourceTowerId !== towerId),
    beams: state.beams.filter((beam) => beam.sourceTowerId !== towerId),
    effects: [...state.effects, effect],
    recentEvents: nextEvents,
    nextEffectId: state.nextEffectId + 1,
    nextEventId,
  };
}

export function cycleTowerTargetMode(state: GameState, towerId: string): GameState {
  if (state.status !== 'running') {
    return state;
  }

  let changed = false;

  const towers = state.towers.map((tower) => {
    if (tower.id !== towerId) {
      return tower;
    }

    const currentIndex = TARGET_MODE_ORDER.indexOf(tower.targetMode);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % TARGET_MODE_ORDER.length;
    changed = true;

    return {
      ...tower,
      targetMode: TARGET_MODE_ORDER[nextIndex],
    };
  });

  if (!changed) {
    return state;
  }

  const nextEvents: GameEvent[] = [];
  const nextEventId = appendEvent(nextEvents, state.nextEventId, 'targetMode');

  return {
    ...state,
    towers,
    recentEvents: nextEvents,
    nextEventId,
  };
}

export function tickGame(state: GameState, deltaSeconds: number): GameState {
  if (state.status !== 'running') {
    return state;
  }

  const dt = Math.max(0, deltaSeconds);
  if (dt === 0) {
    return state;
  }

  const levelId = state.levelId ?? getDefaultGameLevelIdForMap(state.mapId);
  const level = loadGameLevel(levelId);
  const waves = level.waves;
  const map = loadGameMap(level.mapId);

  const events: GameEvent[] = [];
  let hitEventBudget = 3;
  let fireEventBudget = 4;
  let impactEffectBudget = 8;

  let status: MatchStatus = state.status;
  let lives = state.lives;
  let money = state.money;

  let waveIndex = state.waveIndex;
  let spawnedInWave = state.spawnedInWave;
  let timeUntilWaveStart = state.timeUntilWaveStart;
  let timeUntilNextSpawn = state.timeUntilNextSpawn;

  let nextEnemyId = state.nextEnemyId;
  let nextProjectileId = state.nextProjectileId;
  let nextEffectId = state.nextEffectId;
  let nextEventId = state.nextEventId;

  let enemies: Enemy[] = [...state.enemies];
  const spawnedEffects: VisualEffect[] = [];

  const currentWave = waves[waveIndex];
  if (currentWave) {
    if (timeUntilWaveStart > 0) {
      timeUntilWaveStart = Math.max(0, timeUntilWaveStart - dt);
    } else if (spawnedInWave < currentWave.count) {
      timeUntilNextSpawn -= dt;

      while (timeUntilNextSpawn <= 0 && spawnedInWave < currentWave.count) {
        const newEnemy = createEnemy(currentWave.enemyType, nextEnemyId, map);
        enemies.push(newEnemy);
        spawnedEffects.push(createEffect('spawn', newEnemy.position, nextEffectId));

        nextEnemyId += 1;
        nextEffectId += 1;
        spawnedInWave += 1;
        timeUntilNextSpawn += currentWave.spawnInterval;
        nextEventId = appendEvent(events, nextEventId, 'spawn');
      }
    }
  }

  const movedEnemies: Enemy[] = [];
  for (const enemy of enemies) {
    const nextSlowTimeRemaining = Math.max(0, enemy.slowTimeRemaining - dt);
    const nextSlowMultiplier = nextSlowTimeRemaining > 0 ? enemy.slowMultiplier : 1;
    const nextProgress = enemy.progress + enemy.speed * nextSlowMultiplier * dt;
    if (nextProgress >= map.route.totalLength) {
      lives -= enemy.coreDamage;
      continue;
    }

    movedEnemies.push({
      ...enemy,
      progress: nextProgress,
      position: samplePolyline(map.route, nextProgress),
      slowMultiplier: nextSlowMultiplier,
      slowTimeRemaining: nextSlowTimeRemaining,
    });
  }
  enemies = movedEnemies;

  const towers: Tower[] = [];
  const spawnedProjectiles: Projectile[] = [];
  const activeBeams: Beam[] = [];
  const damageByEnemy = new Map<string, number>();
  const slowByEnemy = new Map<string, { multiplier: number; duration: number }>();

  const applyDamage = (enemyId: string, damage: number) => {
    if (damage <= 0) {
      return;
    }
    const currentDamage = damageByEnemy.get(enemyId) ?? 0;
    damageByEnemy.set(enemyId, currentDamage + damage);
  };

  const applySlow = (enemyId: string, multiplier: number, duration: number) => {
    if (multiplier <= 0 || multiplier >= 1 || duration <= 0) {
      return;
    }

    const existing = slowByEnemy.get(enemyId);
    if (!existing) {
      slowByEnemy.set(enemyId, { multiplier, duration });
      return;
    }

    slowByEnemy.set(enemyId, {
      multiplier: Math.min(existing.multiplier, multiplier),
      duration: Math.max(existing.duration, duration),
    });
  };

  for (const tower of state.towers) {
    const towerStats = getTowerStats(tower);
    let cooldown = Math.max(0, tower.cooldown - dt);
    const towerPosition = cellCenter(tower.cell);
    const target = selectTarget(enemies, tower.cell, towerStats, tower.targetMode);
    let aimAngle = Number.isFinite(tower.aimAngle) ? tower.aimAngle : DEFAULT_TOWER_AIM_ANGLE;

    if (target) {
      const dx = target.position.x - towerPosition.x;
      const dy = target.position.y - towerPosition.y;
      aimAngle = Math.atan2(dy, dx);
    }

    if (towerStats.attackKind === 'beam' && target) {
      const beamDamage = towerStats.damage * dt;
      applyDamage(target.id, beamDamage);

      activeBeams.push({
        id: `B-${tower.id}`,
        sourceTowerId: tower.id,
        color: towerStats.beamColor ?? towerStats.color,
        width: towerStats.beamWidth ?? 0.1,
        start: towerPosition,
        end: target.position,
      });

      if (cooldown <= 0 && fireEventBudget > 0) {
        nextEventId = appendEvent(events, nextEventId, 'fire', tower.towerType);
        fireEventBudget -= 1;
        cooldown += BEAM_FIRE_EVENT_INTERVAL_SECONDS;
      }
    } else if (cooldown <= 0 && target) {
      spawnedProjectiles.push({
        id: `P${nextProjectileId}`,
        sourceTowerId: tower.id,
        towerType: tower.towerType,
        targetEnemyId: target.id,
        damage: towerStats.damage,
        speed: towerStats.projectileSpeed,
        radius: towerStats.projectileRadius,
        color: towerStats.color,
        position: towerPosition,
        splashRadius: towerStats.splashRadius,
        slowMultiplier: towerStats.slowMultiplier,
        slowDuration: towerStats.slowDuration,
      });
      nextProjectileId += 1;
      if (fireEventBudget > 0) {
        nextEventId = appendEvent(events, nextEventId, 'fire', tower.towerType);
        fireEventBudget -= 1;
      }
      cooldown += 1 / towerStats.fireRate;
    }

    towers.push({
      ...tower,
      cooldown,
      aimAngle,
    });
  }

  const incomingProjectiles = [...state.projectiles, ...spawnedProjectiles];
  const enemiesById = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const nextProjectiles: Projectile[] = [];
  const hitEffects: VisualEffect[] = [];

  for (const projectile of incomingProjectiles) {
    const target = enemiesById.get(projectile.targetEnemyId);
    if (!target) {
      continue;
    }

    const dx = target.position.x - projectile.position.x;
    const dy = target.position.y - projectile.position.y;
    const distance = Math.hypot(dx, dy);
    const travel = projectile.speed * dt;

    if (distance <= travel || distance === 0) {
      const impactPosition = target.position;
      const impactedEnemies =
        projectile.splashRadius && projectile.splashRadius > 0
          ? enemies.filter((enemy) => {
              const splashDx = enemy.position.x - impactPosition.x;
              const splashDy = enemy.position.y - impactPosition.y;
              return Math.hypot(splashDx, splashDy) <= projectile.splashRadius!;
            })
          : [target];

      for (const impactedEnemy of impactedEnemies) {
        applyDamage(impactedEnemy.id, projectile.damage);

        if (
          projectile.slowMultiplier !== undefined &&
          projectile.slowDuration !== undefined &&
          projectile.slowDuration > 0
        ) {
          applySlow(impactedEnemy.id, projectile.slowMultiplier, projectile.slowDuration);
        }
      }

      if (impactEffectBudget > 0) {
        if (projectile.splashRadius && projectile.splashRadius > 0) {
          hitEffects.push(createEffect('splash', impactPosition, nextEffectId));
        } else if (
          projectile.slowMultiplier !== undefined &&
          projectile.slowDuration !== undefined &&
          projectile.slowDuration > 0
        ) {
          hitEffects.push(createEffect('chill', impactPosition, nextEffectId));
        } else {
          hitEffects.push(createEffect('hit', impactPosition, nextEffectId));
        }
        nextEffectId += 1;
        impactEffectBudget -= 1;
      }
      if (hitEventBudget > 0) {
        nextEventId = appendEvent(events, nextEventId, 'hit', projectile.towerType);
        hitEventBudget -= 1;
      }
      continue;
    }

    nextProjectiles.push({
      ...projectile,
      position: {
        x: projectile.position.x + (dx / distance) * travel,
        y: projectile.position.y + (dy / distance) * travel,
      },
    });
  }

  const survivingEnemies: Enemy[] = [];
  for (const enemy of enemies) {
    const damage = damageByEnemy.get(enemy.id) ?? 0;
    let nextEnemy: Enemy | null = enemy;

    if (damage > 0) {
      const health = enemy.health - damage;
      if (health > 0) {
        nextEnemy = {
          ...enemy,
          health,
        };
      } else {
        nextEnemy = null;
      }
    }

    if (!nextEnemy) {
      money += enemy.reward;
      continue;
    }

    const slowStatus = slowByEnemy.get(enemy.id);
    if (slowStatus) {
      nextEnemy = {
        ...nextEnemy,
        slowMultiplier:
          nextEnemy.slowTimeRemaining > 0
            ? Math.min(nextEnemy.slowMultiplier, slowStatus.multiplier)
            : slowStatus.multiplier,
        slowTimeRemaining: Math.max(nextEnemy.slowTimeRemaining, slowStatus.duration),
      };
    }

    survivingEnemies.push(nextEnemy);
  }

  enemies = survivingEnemies;

  if (lives <= 0) {
    status = 'lost';
    lives = 0;
  } else {
    const activeWave = waves[waveIndex];
    if (activeWave && spawnedInWave >= activeWave.count && enemies.length === 0) {
      waveIndex += 1;
      spawnedInWave = 0;
      timeUntilNextSpawn = 0;

      const nextWave = waves[waveIndex];
      if (nextWave) {
        timeUntilWaveStart = INTER_WAVE_DELAY_SECONDS + (nextWave.startDelay ?? 0);
      } else {
        timeUntilWaveStart = 0;
      }
    }

    if (waveIndex >= waves.length && enemies.length === 0) {
      status = 'won';
    }
  }

  const effects = [...state.effects, ...spawnedEffects, ...hitEffects]
    .map((effect) => ({
      ...effect,
      age: effect.age + dt,
    }))
    .filter((effect) => effect.age < effect.duration);

  return {
    ...state,
    status,
    elapsed: state.elapsed + dt,
    money,
    lives,
    waveIndex,
    spawnedInWave,
    timeUntilWaveStart,
    timeUntilNextSpawn,
    enemies,
    towers,
    projectiles: nextProjectiles,
    beams: activeBeams,
    effects,
    recentEvents: events,
    nextEnemyId,
    nextTowerId: state.nextTowerId,
    nextProjectileId,
    nextEffectId,
    nextEventId,
  };
}

export function stepGame(state: GameState): GameState {
  return tickGame(state, FIXED_STEP_SECONDS);
}
