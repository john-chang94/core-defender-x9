import {
  ARENA_ENEMY_COLORS,
  ARENA_ENEMY_CONFIG,
  ARENA_ENEMY_SHAPES,
  ARENA_ENEMY_ZONE_RATIO,
  ARENA_MAX_ACTIVE_EFFECTS,
  ARENA_MAX_ENEMY_CRUISE_Y_RATIO,
  ARENA_MIN_ENEMY_CRUISE_Y_RATIO,
  ARENA_PLAYER_FLOOR_OFFSET,
  ARENA_PLAYER_HEIGHT,
  ARENA_SHIELD_REGEN_DELAY_SECONDS,
  ARENA_SHIELD_REGEN_PER_SECOND,
  ARENA_TIER_DURATION_SECONDS,
  BASE_ARENA_WEAPON,
} from './config';
import type {
  ArenaEffect,
  ArenaEffectKind,
  ArenaEnemy,
  ArenaEnemyKind,
  ArenaGameState,
  ArenaProjectile,
  ArenaWeapon,
} from './types';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createArenaEffect(
  kind: ArenaEffectKind,
  x: number,
  y: number,
  size: number,
  color: string,
  nextEffectId: number
): ArenaEffect {
  const duration =
    kind === 'muzzle' ? 0.12 : kind === 'warning' ? 0.42 : kind === 'shield' ? 0.34 : 0.24;
  return {
    id: `FX${nextEffectId}`,
    kind,
    x,
    y,
    size,
    color,
    age: 0,
    duration,
  };
}

function trimEffects(effects: ArenaEffect[]) {
  if (effects.length <= ARENA_MAX_ACTIVE_EFFECTS) {
    return effects;
  }
  return effects.slice(effects.length - ARENA_MAX_ACTIVE_EFFECTS);
}

function getSpawnLanes(boardWidth: number) {
  const laneCount = 6;
  return Array.from({ length: laneCount }, (_, index) => ((index + 0.5) * boardWidth) / laneCount);
}

function getEnemyZoneMaxY(boardHeight: number) {
  return boardHeight * ARENA_ENEMY_ZONE_RATIO;
}

function queueEffect(state: ArenaGameState, kind: ArenaEffectKind, x: number, y: number, size: number, color: string) {
  state.effects = trimEffects([...state.effects, createArenaEffect(kind, x, y, size, color, state.nextEffectId)]);
  state.nextEffectId += 1;
}

export function getArenaDisplayTier(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds / ARENA_TIER_DURATION_SECONDS) + 1;
}

export function getArenaActiveEnemyCap(displayTier: number) {
  return Math.min(10, 5 + Math.floor((displayTier - 1) / 4));
}

function getArenaEnemyBulletCap(displayTier: number) {
  return Math.min(20, 10 + Math.floor((displayTier - 1) / 2));
}

function getArenaSpawnCooldown(displayTier: number, activeEnemyCount: number) {
  const tierPressure = Math.min(1.1, (displayTier - 1) * 0.05);
  return Math.max(0.86, 1.95 - tierPressure + activeEnemyCount * 0.08);
}

function getEnemyKindPool(displayTier: number): ArenaEnemyKind[] {
  const pool: ArenaEnemyKind[] = ['hover', 'hover', 'hover', 'hover'];
  if (displayTier >= 3) {
    pool.push('burst', 'burst');
  }
  if (displayTier >= 6) {
    pool.push('tank');
  }
  return pool;
}

function getPlayerShipTop(boardHeight: number) {
  return Math.max(0, boardHeight - ARENA_PLAYER_HEIGHT - ARENA_PLAYER_FLOOR_OFFSET);
}

function createEnemyProjectile(
  state: ArenaGameState,
  enemy: ArenaEnemy,
  boardHeight: number,
  angle: number,
  damage: number,
  speed: number,
  size: number
) {
  const originY = enemy.y + enemy.size * 0.46;
  const projectile: ArenaProjectile = {
    id: `B${state.nextBulletId}`,
    owner: 'enemy',
    x: enemy.x,
    y: originY,
    vx: Math.sin(angle) * speed,
    vy: Math.cos(angle) * speed,
    damage,
    size,
    color: enemy.kind === 'tank' ? '#FFE6B8' : '#FFD9F2',
    age: 0,
    maxAge: 5.5,
    pierce: 0,
  };
  state.enemyBullets = [...state.enemyBullets, projectile];
  state.nextBulletId += 1;
}

function fireEnemyPattern(state: ArenaGameState, enemy: ArenaEnemy, boardHeight: number) {
  const config = ARENA_ENEMY_CONFIG[enemy.kind];
  const targetY = getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.22;
  const desiredAngle = Math.atan2(state.playerX - enemy.x, targetY - enemy.y);
  const cappedEnemyBulletCap = getArenaEnemyBulletCap(getArenaDisplayTier(state.elapsed));
  const remainingBulletBudget = Math.max(0, cappedEnemyBulletCap - state.enemyBullets.length);
  if (remainingBulletBudget <= 0) {
    return;
  }

  if (config.burstCount <= 1) {
    createEnemyProjectile(state, enemy, boardHeight, desiredAngle, config.bulletDamage, config.bulletSpeed, config.bulletSize);
    return;
  }

  const burstCount = Math.min(config.burstCount, remainingBulletBudget);
  for (let index = 0; index < burstCount; index += 1) {
    const lane = index - (burstCount - 1) / 2;
    createEnemyProjectile(
      state,
      enemy,
      boardHeight,
      desiredAngle + lane * config.spreadAngle,
      config.bulletDamage,
      config.bulletSpeed,
      config.bulletSize
    );
  }
}

function spawnEnemy(state: ArenaGameState, boardWidth: number, boardHeight: number, kind: ArenaEnemyKind, laneIndex?: number) {
  const displayTier = getArenaDisplayTier(state.elapsed);
  const config = ARENA_ENEMY_CONFIG[kind];
  const lanes = getSpawnLanes(boardWidth);
  const chosenLane = laneIndex ?? Math.floor(Math.random() * lanes.length);
  const x = clamp(
    lanes[chosenLane] + (Math.random() - 0.5) * 18,
    config.size / 2 + 10,
    boardWidth - config.size / 2 - 10
  );
  const zoneMaxY = getEnemyZoneMaxY(boardHeight);
  const cruiseY = clamp(
    lerp(boardHeight * ARENA_MIN_ENEMY_CRUISE_Y_RATIO, boardHeight * ARENA_MAX_ENEMY_CRUISE_Y_RATIO, Math.random()),
    config.size / 2 + 18,
    zoneMaxY - config.size / 2 - 10
  );
  const health = Math.round(config.baseHealth + (displayTier - 1) * config.healthPerTier + Math.random() * config.healthPerTier * 0.35);
  const enemy: ArenaEnemy = {
    id: `E${state.nextEnemyId}`,
    kind,
    shape: ARENA_ENEMY_SHAPES[kind],
    x,
    y: -config.size * 0.9,
    vx: config.strafeSpeed * (Math.random() < 0.5 ? -1 : 1) * (1 + Math.min(0.18, displayTier * 0.012)),
    cruiseY,
    size: config.size,
    health,
    maxHealth: health,
    attackCooldown: Math.max(0.62, config.fireInterval - Math.min(0.6, (displayTier - 1) * 0.035)),
    windupTimer: 0,
    flash: 0,
    phase: Math.random() * Math.PI * 2,
    color: ARENA_ENEMY_COLORS[kind],
    reward: config.reward + displayTier * 10,
  };

  state.enemies = [...state.enemies, enemy];
  state.nextEnemyId += 1;
}

function spawnEnemyGroup(state: ArenaGameState, boardWidth: number, boardHeight: number) {
  const displayTier = getArenaDisplayTier(state.elapsed);
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  if (state.enemies.length >= activeEnemyCap) {
    return;
  }

  const lanes = getSpawnLanes(boardWidth);
  const laneIndex = Math.floor(Math.random() * lanes.length);
  const kindPool = getEnemyKindPool(displayTier);
  const primaryKind = randomChoice(kindPool);
  spawnEnemy(state, boardWidth, boardHeight, primaryKind, laneIndex);

  const remainingCapacity = activeEnemyCap - state.enemies.length;
  const shouldAddWingman =
    remainingCapacity > 0 &&
    displayTier >= 4 &&
    (primaryKind === 'hover' || primaryKind === 'burst') &&
    Math.random() < (displayTier >= 8 ? 0.38 : 0.22);

  if (shouldAddWingman) {
    const offset = laneIndex <= 1 ? 1 : laneIndex >= lanes.length - 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
    const secondLane = clamp(laneIndex + offset, 0, lanes.length - 1);
    spawnEnemy(state, boardWidth, boardHeight, 'hover', secondLane);
  }
}

function hitTestCircle(xA: number, yA: number, radiusA: number, xB: number, yB: number, radiusB: number) {
  const dx = xA - xB;
  const dy = yA - yB;
  const radius = radiusA + radiusB;
  return dx * dx + dy * dy <= radius * radius;
}

function applyPlayerDamage(state: ArenaGameState, damage: number, boardHeight: number) {
  let remainingDamage = damage;
  if (state.shield > 0) {
    const absorbed = Math.min(state.shield, remainingDamage);
    state.shield -= absorbed;
    remainingDamage -= absorbed;
    queueEffect(state, 'shield', state.playerX, getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.35, 54, '#9EEBFF');
  }

  if (remainingDamage > 0) {
    state.hull = Math.max(0, state.hull - remainingDamage);
    queueEffect(state, 'burst', state.playerX, getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.3, 68, '#FF8A7D');
  }

  state.playerFlash = 1;
  state.shieldRegenCooldown = ARENA_SHIELD_REGEN_DELAY_SECONDS;
  if (state.hull <= 0) {
    state.status = 'lost';
  }
}

function createPlayerVolley(state: ArenaGameState, boardHeight: number) {
  const weapon = state.weapon;
  const bullets = [...state.playerBullets];
  const muzzleY = boardHeight - ARENA_PLAYER_HEIGHT - 18;
  const centerIndex = (weapon.shotCount - 1) / 2;

  for (let index = 0; index < weapon.shotCount; index += 1) {
    const lane = index - centerIndex;
    const x = state.playerX + lane * weapon.spread;
    bullets.push({
      id: `B${state.nextBulletId}`,
      owner: 'player',
      x,
      y: muzzleY,
      vx: 0,
      vy: -weapon.bulletSpeed,
      damage: weapon.damage,
      size: weapon.bulletSize,
      color: '#FFF1C9',
      age: 0,
      maxAge: 2,
      pierce: weapon.pierce,
    });
    state.nextBulletId += 1;
  }

  state.playerBullets = bullets;
  state.fireCooldown += weapon.fireInterval;
  queueEffect(state, 'muzzle', state.playerX, muzzleY, 24 + weapon.shotCount * 6, '#FFE4A8');
}

function getPlayerHitbox(state: ArenaGameState, boardHeight: number) {
  const top = getPlayerShipTop(boardHeight);
  return {
    left: state.playerX - 20,
    top,
    right: state.playerX + 20,
    bottom: top + ARENA_PLAYER_HEIGHT,
  };
}

function applyPlayerWeaponTierScaling(weapon: ArenaWeapon, displayTier: number): ArenaWeapon {
  return {
    ...weapon,
    damage: BASE_ARENA_WEAPON.damage + Math.floor((displayTier - 1) / 3),
    fireInterval: Math.max(0.075, BASE_ARENA_WEAPON.fireInterval - Math.min(0.022, (displayTier - 1) * 0.002)),
    shotCount: displayTier >= 9 ? 2 : 1,
    pierce: displayTier >= 12 ? 1 : 0,
  };
}

export function createInitialArenaState(boardWidth: number): ArenaGameState {
  return {
    status: 'running',
    elapsed: 0,
    score: 0,
    playerX: boardWidth / 2,
    hull: 100,
    maxHull: 100,
    shield: 42,
    maxShield: 42,
    shieldRegenCooldown: 0,
    playerFlash: 0,
    weapon: BASE_ARENA_WEAPON,
    enemies: [],
    playerBullets: [],
    enemyBullets: [],
    effects: [],
    fireCooldown: 0.06,
    enemySpawnCooldown: 1.3,
    nextBulletId: 1,
    nextEnemyId: 1,
    nextEffectId: 1,
  };
}

export function tickArenaState(
  previousState: ArenaGameState,
  deltaSeconds: number,
  boardWidth: number,
  boardHeight: number
): ArenaGameState {
  const nextState: ArenaGameState = {
    ...previousState,
    elapsed: previousState.elapsed + deltaSeconds,
    hull: previousState.hull,
    shield: previousState.shield,
    shieldRegenCooldown: Math.max(0, previousState.shieldRegenCooldown - deltaSeconds),
    playerFlash: Math.max(0, previousState.playerFlash - deltaSeconds * 4.5),
    effects: previousState.effects
      .map((effect) => ({ ...effect, age: effect.age + deltaSeconds }))
      .filter((effect) => effect.age < effect.duration),
    fireCooldown: previousState.fireCooldown - deltaSeconds,
    enemySpawnCooldown: previousState.enemySpawnCooldown - deltaSeconds,
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    weapon: applyPlayerWeaponTierScaling(previousState.weapon, getArenaDisplayTier(previousState.elapsed + deltaSeconds)),
  };

  if (nextState.status !== 'running') {
    return nextState;
  }

  if (nextState.shieldRegenCooldown <= 0 && nextState.shield < nextState.maxShield) {
    nextState.shield = Math.min(nextState.maxShield, nextState.shield + ARENA_SHIELD_REGEN_PER_SECOND * deltaSeconds);
  }

  while (nextState.fireCooldown <= 0) {
    createPlayerVolley(nextState, boardHeight);
  }

  const displayTier = getArenaDisplayTier(nextState.elapsed);
  while (nextState.enemySpawnCooldown <= 0) {
    spawnEnemyGroup(nextState, boardWidth, boardHeight);
    nextState.enemySpawnCooldown += getArenaSpawnCooldown(displayTier, nextState.enemies.length);
    if (nextState.enemies.length >= getArenaActiveEnemyCap(displayTier)) {
      break;
    }
  }

  const movedEnemies: ArenaEnemy[] = [];
  const preExistingEnemyBullets = [...previousState.enemyBullets];
  nextState.enemyBullets = [...preExistingEnemyBullets];
  const playerWeaponBullets = [...previousState.playerBullets, ...nextState.playerBullets];
  nextState.playerBullets = [];
  const enemyZoneMaxY = getEnemyZoneMaxY(boardHeight);

  for (const enemy of previousState.enemies.concat(nextState.enemies)) {
    if (enemy.health <= 0) {
      continue;
    }

    const config = ARENA_ENEMY_CONFIG[enemy.kind];
    const previousWindup = enemy.windupTimer;
    let nextEnemy: ArenaEnemy = {
      ...enemy,
      flash: Math.max(0, enemy.flash - deltaSeconds * 4.5),
      attackCooldown: enemy.attackCooldown - deltaSeconds,
      windupTimer: Math.max(0, enemy.windupTimer - deltaSeconds),
    };

    if (nextEnemy.y < nextEnemy.cruiseY) {
      nextEnemy.y = Math.min(nextEnemy.cruiseY, nextEnemy.y + config.descendSpeed * deltaSeconds);
    } else {
      nextEnemy.x += nextEnemy.vx * deltaSeconds;
      const minX = nextEnemy.size / 2 + 8;
      const maxX = boardWidth - nextEnemy.size / 2 - 8;
      if (nextEnemy.x <= minX) {
        nextEnemy.x = minX;
        nextEnemy.vx = Math.abs(nextEnemy.vx);
      } else if (nextEnemy.x >= maxX) {
        nextEnemy.x = maxX;
        nextEnemy.vx = -Math.abs(nextEnemy.vx);
      }
      nextEnemy.y = Math.min(
        enemyZoneMaxY - nextEnemy.size / 2,
        nextEnemy.cruiseY + Math.sin(nextState.elapsed * 1.4 + nextEnemy.phase) * config.bobAmplitude
      );
    }

    if (previousWindup > 0 && nextEnemy.windupTimer <= 0) {
      fireEnemyPattern(nextState, nextEnemy, boardHeight);
      queueEffect(nextState, 'muzzle', nextEnemy.x, nextEnemy.y + nextEnemy.size * 0.34, 20 + nextEnemy.size * 0.22, '#FFEED2');
    } else if (previousWindup <= 0 && nextEnemy.attackCooldown <= 0) {
      nextEnemy.windupTimer = config.windupDuration;
      nextEnemy.attackCooldown = Math.max(0.65, config.fireInterval - Math.min(0.7, (displayTier - 1) * 0.035));
      queueEffect(nextState, 'warning', nextEnemy.x, nextEnemy.y, nextEnemy.size * 1.25, nextEnemy.color);
    }

    movedEnemies.push(nextEnemy);
  }

  const survivingEnemies = [...movedEnemies];
  const survivingPlayerBullets: ArenaProjectile[] = [];

  for (const bullet of playerWeaponBullets) {
    let activeBullet: ArenaProjectile | null = {
      ...bullet,
      x: bullet.x + bullet.vx * deltaSeconds,
      y: bullet.y + bullet.vy * deltaSeconds,
      age: bullet.age + deltaSeconds,
    };

    if (activeBullet.age >= activeBullet.maxAge || activeBullet.y < -40) {
      continue;
    }

    for (const enemy of survivingEnemies) {
      if (!activeBullet || enemy.health <= 0) {
        continue;
      }

      if (!hitTestCircle(activeBullet.x, activeBullet.y, activeBullet.size * 0.6, enemy.x, enemy.y, enemy.size * 0.42)) {
        continue;
      }

      enemy.health = Math.max(0, enemy.health - activeBullet.damage);
      enemy.flash = 1;
      queueEffect(nextState, 'burst', enemy.x, enemy.y, enemy.size * 0.8, '#FFE5B3');

      if (enemy.health <= 0) {
        nextState.score += enemy.reward;
        queueEffect(nextState, 'burst', enemy.x, enemy.y, enemy.size * 1.24, enemy.color);
      }

      if (activeBullet.pierce > 0) {
        activeBullet = { ...activeBullet, pierce: activeBullet.pierce - 1 };
      } else {
        activeBullet = null;
      }
    }

    if (activeBullet) {
      survivingPlayerBullets.push(activeBullet);
    }
  }

  nextState.enemies = survivingEnemies.filter((enemy) => enemy.health > 0);
  nextState.playerBullets = survivingPlayerBullets;

  const playerHitbox = getPlayerHitbox(nextState, boardHeight);
  const survivingEnemyBullets: ArenaProjectile[] = [];

  for (const bullet of nextState.enemyBullets) {
    const nextBullet: ArenaProjectile = {
      ...bullet,
      x: bullet.x + bullet.vx * deltaSeconds,
      y: bullet.y + bullet.vy * deltaSeconds,
      age: bullet.age + deltaSeconds,
    };

    if (
      nextBullet.age >= nextBullet.maxAge ||
      nextBullet.y > boardHeight + 24 ||
      nextBullet.x < -24 ||
      nextBullet.x > boardWidth + 24
    ) {
      continue;
    }

    const closestX = clamp(nextBullet.x, playerHitbox.left, playerHitbox.right);
    const closestY = clamp(nextBullet.y, playerHitbox.top, playerHitbox.bottom);
    if (
      hitTestCircle(nextBullet.x, nextBullet.y, nextBullet.size * 0.56, closestX, closestY, 2)
    ) {
      applyPlayerDamage(nextState, nextBullet.damage, boardHeight);
      if (nextState.status !== 'running') {
        nextState.playerBullets = [];
        nextState.enemyBullets = [];
        nextState.enemies = [];
        return nextState;
      }
      continue;
    }

    survivingEnemyBullets.push(nextBullet);
  }

  nextState.enemyBullets = survivingEnemyBullets;
  return nextState;
}
