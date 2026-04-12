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
import { ARENA_BUILD_META } from './builds';
import type {
  ArenaBuildId,
  ArenaArmoryUpgradeKey,
  ArenaDrop,
  ArenaDropType,
  ArenaEncounter,
  ArenaEffect,
  ArenaEffectFlavor,
  ArenaEffectKind,
  ArenaEnemy,
  ArenaEnemyKind,
  ArenaGameState,
  ArenaProjectile,
  ArenaWeapon,
} from './types';
import { ARENA_ARMORY_UPGRADES, createArenaArmoryChoice, createArenaBossArmoryChoice } from './upgrades';

const ARENA_MINI_BOSS_TIER_INTERVAL = 3;
const ARENA_BOSS_TIER_INTERVAL = 6;
const ARENA_ANNOUNCEMENT_DURATION_SECONDS = 1.75;
const ARENA_MAX_ULTIMATE_CHARGE = 100;
const ARENA_ULTIMATE_DURATION_SECONDS = 1.15;
const ARENA_BUILD_DEFAULT: ArenaBuildId = 'railFocus';
const ARENA_GLOBAL_HEALTH_MULTIPLIER = 1.16;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getBuildProjectileCap(build: ArenaBuildId) {
  switch (build) {
    case 'railFocus':
      return 2;
    case 'novaBloom':
      return 4;
    case 'missileCommand':
      return 6;
    case 'fractureCore':
      return 3;
  }
}

function createArenaEffect(
  kind: ArenaEffectKind,
  x: number,
  y: number,
  size: number,
  color: string,
  nextEffectId: number,
  options?: {
    flavor?: ArenaEffectFlavor;
    intensity?: number;
  }
): ArenaEffect {
  const duration =
    kind === 'muzzle'
      ? 0.12
      : kind === 'warning'
        ? 0.42
        : kind === 'shield'
          ? 0.34
          : kind === 'pickup'
            ? 0.4
            : kind === 'fractureBits'
              ? 0.34
            : kind === 'ultimateRail'
              ? 0.92
              : kind === 'ultimateNova'
                ? 1.45
                : kind === 'ultimateMissile'
                  ? 1.2
                  : kind === 'ultimateFracture'
                    ? 1.25
                    : 0.24;
  return {
    id: `FX${nextEffectId}`,
    kind,
    flavor: options?.flavor,
    intensity: options?.intensity,
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

function queueEffect(
  state: ArenaGameState,
  kind: ArenaEffectKind,
  x: number,
  y: number,
  size: number,
  color: string,
  options?: {
    flavor?: ArenaEffectFlavor;
    intensity?: number;
  }
) {
  state.effects = trimEffects([...state.effects, createArenaEffect(kind, x, y, size, color, state.nextEffectId, options)]);
  state.nextEffectId += 1;
}

function queueEncounterAnnouncement(state: ArenaGameState, label: string, accentColor: string) {
  state.encounterAnnouncement = label;
  state.encounterAnnouncementColor = accentColor;
  state.encounterAnnouncementTimer = ARENA_ANNOUNCEMENT_DURATION_SECONDS;
}

function addUltimateCharge(state: ArenaGameState, amount: number) {
  state.ultimateCharge = Math.min(ARENA_MAX_ULTIMATE_CHARGE, state.ultimateCharge + amount);
}

function buildUltimateColumns(enemies: ArenaEnemy[], boardWidth: number) {
  const fallbackColumns = [0.16, 0.34, 0.5, 0.66, 0.84].map((ratio) => boardWidth * ratio);
  const priorityColumns = enemies
    .slice()
    .sort((left, right) => right.maxHealth - left.maxHealth)
    .map((enemy) => enemy.x);

  const columns: number[] = [];
  for (const candidate of [...priorityColumns, ...fallbackColumns]) {
    const clampedCandidate = clamp(candidate, 26, boardWidth - 26);
    if (columns.some((existing) => Math.abs(existing - clampedCandidate) < 34)) {
      continue;
    }
    columns.push(clampedCandidate);
    if (columns.length >= 5) {
      break;
    }
  }

  return columns;
}

export function getArenaDisplayTier(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds / ARENA_TIER_DURATION_SECONDS) + 1;
}

export function getArenaActiveWeapon(state: ArenaGameState): ArenaWeapon {
  const displayTier = getArenaDisplayTier(state.elapsed);
  let nextWeapon: ArenaWeapon = {
    ...state.weapon,
    damage: state.weapon.damage + Math.floor((displayTier - 1) / 6),
    fireInterval: Math.max(0.055, state.weapon.fireInterval - Math.min(0.012, (displayTier - 1) * 0.0008)),
  };

  switch (state.activeBuild) {
    case 'railFocus':
      nextWeapon = {
        ...nextWeapon,
        damage: Math.round(nextWeapon.damage * 1.44),
        fireInterval: Math.min(0.2, nextWeapon.fireInterval * 1.08),
        shotCount: Math.max(1, Math.min(2, nextWeapon.shotCount)),
        pierce: Math.min(6, nextWeapon.pierce + 3),
        bulletSpeed: Math.min(1700, nextWeapon.bulletSpeed + 180),
        bulletSize: Math.min(13.2, nextWeapon.bulletSize + 0.8),
        spread: Math.max(9, Math.round(nextWeapon.spread * 0.56)),
      };
      break;
    case 'novaBloom':
      nextWeapon = {
        ...nextWeapon,
        damage: Math.round(nextWeapon.damage * 0.82),
        fireInterval: Math.max(0.042, nextWeapon.fireInterval * 0.72),
        shotCount: Math.min(4, Math.max(2, nextWeapon.shotCount + 1)),
        pierce: Math.max(0, nextWeapon.pierce),
        bulletSpeed: Math.min(1600, nextWeapon.bulletSpeed + 40),
        bulletSize: Math.min(11.8, nextWeapon.bulletSize + 0.2),
        spread: Math.min(40, nextWeapon.spread + 9),
      };
      break;
    case 'missileCommand':
      nextWeapon = {
        ...nextWeapon,
        damage: Math.round(nextWeapon.damage * 1.08),
        fireInterval: Math.max(0.045, nextWeapon.fireInterval * 0.8),
        shotCount: Math.min(6, Math.max(2, nextWeapon.shotCount + 1)),
        pierce: Math.min(4, nextWeapon.pierce + 1),
        bulletSpeed: Math.min(1700, nextWeapon.bulletSpeed + 120),
        bulletSize: Math.min(12.6, nextWeapon.bulletSize + 0.5),
        spread: Math.max(9, Math.round(nextWeapon.spread * 0.68)),
      };
      break;
    case 'fractureCore':
      nextWeapon = {
        ...nextWeapon,
        damage: Math.round(nextWeapon.damage * 1.56),
        fireInterval: Math.max(0.11, nextWeapon.fireInterval * 1.42),
        shotCount: Math.min(3, Math.max(1, nextWeapon.shotCount)),
        pierce: Math.min(4, nextWeapon.pierce + 1),
        bulletSpeed: Math.min(1500, nextWeapon.bulletSpeed + 20),
        bulletSize: Math.min(19.2, nextWeapon.bulletSize + 3.4),
        spread: Math.min(24, nextWeapon.spread + 1),
      };
      break;
  }

  if (state.overclockTimer > 0) {
    const projectileCap = getBuildProjectileCap(state.activeBuild);
    const overdriveFireMultiplier = state.activeBuild === 'fractureCore' ? 0.9 : 0.68;
    const overdriveFireFloor = state.activeBuild === 'fractureCore' ? 0.092 : 0.038;
    const overdriveBulletSizeCap = state.activeBuild === 'fractureCore' ? 20.2 : 12.5;
    nextWeapon = {
      ...nextWeapon,
      damage: nextWeapon.damage + 6,
      fireInterval: Math.max(overdriveFireFloor, nextWeapon.fireInterval * overdriveFireMultiplier),
      shotCount: Math.min(projectileCap, nextWeapon.shotCount + 1),
      pierce: Math.min(4, nextWeapon.pierce + 1),
      bulletSpeed: Math.min(1600, nextWeapon.bulletSpeed + 120),
      bulletSize: Math.min(overdriveBulletSizeCap, nextWeapon.bulletSize + 0.7),
      spread: Math.min(30, nextWeapon.spread + 3),
    };
  }

  nextWeapon = {
    ...nextWeapon,
    shotCount: Math.max(1, Math.min(getBuildProjectileCap(state.activeBuild), nextWeapon.shotCount)),
  };

  return nextWeapon;
}

function getMissileIntervalSeconds(state: ArenaGameState) {
  const displayTier = getArenaDisplayTier(state.elapsed);
  const tierBonus = Math.min(0.22, Math.max(0, displayTier - 1) * 0.01);
  const overclockBonus = state.overclockTimer > 0 ? 0.14 : 0;
  return Math.max(0.26, 0.66 - tierBonus - overclockBonus);
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
  if (displayTier >= 4) {
    pool.push('orbiter', 'orbiter');
  }
  if (displayTier >= 6) {
    pool.push('tank');
  }
  if (displayTier >= 8) {
    pool.push('sniper');
  }
  if (displayTier >= 10) {
    pool.push('bomber');
  }
  return pool;
}

function spawnFormationGroup(state: ArenaGameState, boardWidth: number, boardHeight: number, displayTier: number) {
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const remainingCapacity = activeEnemyCap - state.enemies.length;
  if (remainingCapacity <= 0 || displayTier < 5) {
    return false;
  }

  const lanes = getSpawnLanes(boardWidth);
  const trySpawn = (kind: ArenaEnemyKind, options?: Parameters<typeof spawnEnemy>[4]) => {
    if (state.enemies.length >= activeEnemyCap) {
      return false;
    }
    spawnEnemy(state, boardWidth, boardHeight, kind, options);
    return true;
  };
  const randomInnerLane = () => Math.floor(Math.random() * (lanes.length - 2)) + 1;
  const roll = Math.random();

  if (displayTier >= 12 && remainingCapacity >= 2 && roll < 0.2) {
    const centerLane = randomInnerLane();
    const flankLane = clamp(centerLane + (Math.random() < 0.5 ? -1 : 1), 0, lanes.length - 1);
    trySpawn('bomber', {
      laneIndex: centerLane,
      healthMultiplier: 1.1,
      attackCooldownMultiplier: 0.92,
    });
    trySpawn('burst', {
      laneIndex: flankLane,
      healthMultiplier: 1.06,
      attackCooldownMultiplier: 0.94,
    });
    if (Math.random() < 0.55) {
      trySpawn('hover', { laneIndex: clamp(centerLane + (flankLane > centerLane ? -1 : 1), 0, lanes.length - 1) });
    }
    return true;
  }

  if (displayTier >= 8 && remainingCapacity >= 2 && roll < 0.42) {
    trySpawn('sniper', {
      laneIndex: 0,
      cruiseY: boardHeight * 0.18,
      attackCooldownMultiplier: 0.95,
    });
    trySpawn('sniper', {
      laneIndex: lanes.length - 1,
      cruiseY: boardHeight * 0.18,
      attackCooldownMultiplier: 0.95,
    });
    if (Math.random() < 0.6) {
      trySpawn('hover', { laneIndex: randomInnerLane() });
    }
    return true;
  }

  if (displayTier >= 6 && remainingCapacity >= 3 && roll < 0.64) {
    const centerLane = randomInnerLane();
    trySpawn('orbiter', {
      laneIndex: centerLane,
      healthMultiplier: 1.05,
    });
    trySpawn('hover', { laneIndex: clamp(centerLane - 1, 0, lanes.length - 1) });
    trySpawn('hover', { laneIndex: clamp(centerLane + 1, 0, lanes.length - 1) });
    return true;
  }

  if (remainingCapacity >= 3 && roll < 0.82) {
    const laneIndex = randomInnerLane();
    trySpawn('burst', {
      laneIndex,
      attackCooldownMultiplier: 0.94,
    });
    trySpawn('hover', { laneIndex: clamp(laneIndex - 1, 0, lanes.length - 1) });
    trySpawn('hover', { laneIndex: clamp(laneIndex + 1, 0, lanes.length - 1) });
    return true;
  }

  return false;
}

function createEncounterForTier(displayTier: number): ArenaEncounter | null {
  if (displayTier >= ARENA_BOSS_TIER_INTERVAL && displayTier % ARENA_BOSS_TIER_INTERVAL === 0) {
    return {
      type: 'boss',
      label: 'Prism Core',
      accentColor: '#FF89C0',
      anchorKind: 'prismBoss',
      rewardSalvage: 170,
      startedAtTier: displayTier,
    };
  }

  if (displayTier >= ARENA_MINI_BOSS_TIER_INTERVAL && displayTier % ARENA_MINI_BOSS_TIER_INTERVAL === 0) {
    const useBombardWing = displayTier >= 9 && Math.floor(displayTier / (ARENA_MINI_BOSS_TIER_INTERVAL * 2)) % 2 === 1;
    return {
      type: 'miniBoss',
      label: useBombardWing ? 'Bombard Wing' : 'Interceptor Sweep',
      accentColor: useBombardWing ? '#FFC99F' : '#C3B5FF',
      anchorKind: useBombardWing ? 'bomber' : 'interceptor',
      rewardSalvage: useBombardWing ? 92 : 80,
      startedAtTier: displayTier,
    };
  }

  return null;
}

function getPlayerShipTop(boardHeight: number) {
  return Math.max(0, boardHeight - ARENA_PLAYER_HEIGHT - ARENA_PLAYER_FLOOR_OFFSET);
}

function getEnemyAimAngle(enemy: ArenaEnemy, playerX: number, boardHeight: number) {
  const targetY = getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.22;
  let angle = Math.atan2(playerX - enemy.x, targetY - enemy.y);
  if (enemy.kind === 'orbiter') {
    angle += Math.sin(enemy.phase) * 0.18;
  }
  if (enemy.kind === 'sniper') {
    angle *= 0.9;
  }
  return angle;
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
  const projectileColor =
    enemy.kind === 'tank'
      ? '#FFE6B8'
      : enemy.kind === 'sniper'
        ? '#FFD8EF'
        : enemy.kind === 'bomber'
          ? '#FFD7B6'
        : enemy.kind === 'orbiter'
          ? '#CFFFF9'
      : enemy.kind === 'interceptor'
        ? '#E3D7FF'
        : enemy.kind === 'prismBoss'
          ? '#FFD5EA'
          : '#FFD9F2';
  const projectile: ArenaProjectile = {
    id: `B${state.nextBulletId}`,
    owner: 'enemy',
    kind: 'enemy',
    x: enemy.x,
    y: originY,
    vx: Math.sin(angle) * speed,
    vy: Math.cos(angle) * speed,
    damage,
    size,
    color: projectileColor,
    age: 0,
    maxAge: 5.5,
    pierce: 0,
  };
  state.enemyBullets = [...state.enemyBullets, projectile];
  state.nextBulletId += 1;
}

function fireEnemyPattern(state: ArenaGameState, enemy: ArenaEnemy, boardHeight: number) {
  const config = ARENA_ENEMY_CONFIG[enemy.kind];
  const desiredAngle = enemy.aimAngle;
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

function spawnEnemy(
  state: ArenaGameState,
  boardWidth: number,
  boardHeight: number,
  kind: ArenaEnemyKind,
  options?: {
    laneIndex?: number;
    x?: number;
    cruiseY?: number;
    healthMultiplier?: number;
    rewardMultiplier?: number;
    attackCooldownMultiplier?: number;
    vx?: number;
  }
) {
  const displayTier = getArenaDisplayTier(state.elapsed);
  const config = ARENA_ENEMY_CONFIG[kind];
  const lanes = getSpawnLanes(boardWidth);
  const chosenLane = options?.laneIndex ?? Math.floor(Math.random() * lanes.length);
  const x = clamp(
    options?.x ?? lanes[chosenLane] + (Math.random() - 0.5) * 18,
    config.size / 2 + 10,
    boardWidth - config.size / 2 - 10
  );
  const zoneMaxY = getEnemyZoneMaxY(boardHeight);
  const cruiseY = clamp(
    options?.cruiseY ??
      lerp(boardHeight * ARENA_MIN_ENEMY_CRUISE_Y_RATIO, boardHeight * ARENA_MAX_ENEMY_CRUISE_Y_RATIO, Math.random()),
    config.size / 2 + 18,
    zoneMaxY - config.size / 2 - 10
  );
  const health = Math.round(
    (config.baseHealth + (displayTier - 1) * config.healthPerTier + Math.random() * config.healthPerTier * 0.35) *
      (options?.healthMultiplier ?? 1) *
      (displayTier <= 10 ? 1.24 - (displayTier - 1) * 0.02 : 1) *
      ARENA_GLOBAL_HEALTH_MULTIPLIER
  );
  const enemy: ArenaEnemy = {
    id: `E${state.nextEnemyId}`,
    kind,
    shape: ARENA_ENEMY_SHAPES[kind],
    x,
    y: -config.size * 0.9,
    vx:
      options?.vx ??
      config.strafeSpeed * (Math.random() < 0.5 ? -1 : 1) * (1 + Math.min(0.18, displayTier * 0.012)),
    aimAngle: 0,
    cruiseY,
    size: config.size,
    health,
    maxHealth: health,
    attackCooldown:
      Math.max(0.62, config.fireInterval - Math.min(0.6, (displayTier - 1) * 0.035)) * (options?.attackCooldownMultiplier ?? 1),
    windupTimer: 0,
    flash: 0,
    burnTimer: 0,
    burnDps: 0,
    phase: Math.random() * Math.PI * 2,
    color: ARENA_ENEMY_COLORS[kind],
    reward: Math.round((config.reward + displayTier * 10) * (options?.rewardMultiplier ?? 1)),
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

  if (spawnFormationGroup(state, boardWidth, boardHeight, displayTier)) {
    return;
  }

  const lanes = getSpawnLanes(boardWidth);
  const laneIndex = Math.floor(Math.random() * lanes.length);
  const kindPool = getEnemyKindPool(displayTier);
  const primaryKind = randomChoice(kindPool);
  spawnEnemy(state, boardWidth, boardHeight, primaryKind, { laneIndex });

  const remainingCapacity = activeEnemyCap - state.enemies.length;
  const shouldAddWingman =
    remainingCapacity > 0 &&
    displayTier >= 4 &&
    (primaryKind === 'hover' || primaryKind === 'burst' || primaryKind === 'orbiter' || primaryKind === 'bomber') &&
    Math.random() < (displayTier >= 8 ? 0.38 : 0.22);

  if (shouldAddWingman) {
    const offset = laneIndex <= 1 ? 1 : laneIndex >= lanes.length - 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
    const secondLane = clamp(laneIndex + offset, 0, lanes.length - 1);
    spawnEnemy(state, boardWidth, boardHeight, 'hover', { laneIndex: secondLane });
  }
}

function startEncounter(state: ArenaGameState, boardWidth: number, boardHeight: number, encounter: ArenaEncounter) {
  state.activeEncounter = encounter;
  queueEncounterAnnouncement(state, encounter.label, encounter.accentColor);
  state.pickupMessage =
    encounter.type === 'boss'
      ? 'Boss intercept. Break the prism core.'
      : encounter.anchorKind === 'bomber'
        ? 'Bombard wing breaching the upper lane.'
        : 'Mini-boss breach detected.';
  state.pickupTimer = 1.9;

  if (encounter.type === 'boss') {
    spawnEnemy(state, boardWidth, boardHeight, 'prismBoss', {
      x: boardWidth / 2,
      cruiseY: boardHeight * 0.21,
      healthMultiplier: 1 + Math.max(0, encounter.startedAtTier - ARENA_BOSS_TIER_INTERVAL) * 0.05,
      rewardMultiplier: 1.35,
      attackCooldownMultiplier: 0.92,
      vx: ARENA_ENEMY_CONFIG.prismBoss.strafeSpeed,
    });
    spawnEnemy(state, boardWidth, boardHeight, 'hover', {
      laneIndex: 1,
      healthMultiplier: 1.15,
      rewardMultiplier: 0.9,
    });
    spawnEnemy(state, boardWidth, boardHeight, 'hover', {
      laneIndex: 4,
      healthMultiplier: 1.15,
      rewardMultiplier: 0.9,
    });
    if (encounter.startedAtTier >= 12) {
      spawnEnemy(state, boardWidth, boardHeight, 'sniper', {
        laneIndex: 0,
        healthMultiplier: 1.1,
        rewardMultiplier: 0.95,
        attackCooldownMultiplier: 1.05,
      });
    }
    state.enemySpawnCooldown = Math.max(state.enemySpawnCooldown, 3.8);
    return;
  }

  if (encounter.anchorKind === 'bomber') {
    spawnEnemy(state, boardWidth, boardHeight, 'bomber', {
      x: boardWidth / 2,
      cruiseY: boardHeight * 0.24,
      healthMultiplier: 1 + Math.max(0, encounter.startedAtTier - ARENA_MINI_BOSS_TIER_INTERVAL) * 0.05,
      rewardMultiplier: 1.28,
      attackCooldownMultiplier: 0.9,
      vx: ARENA_ENEMY_CONFIG.bomber.strafeSpeed,
    });
    spawnEnemy(state, boardWidth, boardHeight, 'burst', {
      laneIndex: 1,
      healthMultiplier: 1.1,
      rewardMultiplier: 0.86,
      attackCooldownMultiplier: 0.95,
    });
    spawnEnemy(state, boardWidth, boardHeight, 'burst', {
      laneIndex: 4,
      healthMultiplier: 1.1,
      rewardMultiplier: 0.86,
      attackCooldownMultiplier: 0.95,
    });
    if (encounter.startedAtTier >= 12) {
      spawnEnemy(state, boardWidth, boardHeight, 'sniper', {
        laneIndex: Math.random() < 0.5 ? 0 : 5,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.9,
      });
    }
    state.enemySpawnCooldown = Math.max(state.enemySpawnCooldown, 2.8);
    return;
  }

  spawnEnemy(state, boardWidth, boardHeight, 'interceptor', {
    x: boardWidth / 2,
    cruiseY: boardHeight * 0.25,
    healthMultiplier: 1 + Math.max(0, encounter.startedAtTier - ARENA_MINI_BOSS_TIER_INTERVAL) * 0.04,
    rewardMultiplier: 1.25,
    attackCooldownMultiplier: 0.95,
    vx: ARENA_ENEMY_CONFIG.interceptor.strafeSpeed,
  });
  spawnEnemy(state, boardWidth, boardHeight, 'hover', {
    laneIndex: 2,
    healthMultiplier: 1.1,
    rewardMultiplier: 0.82,
  });
  if (encounter.startedAtTier >= 9) {
    spawnEnemy(state, boardWidth, boardHeight, 'orbiter', {
      laneIndex: 4,
      healthMultiplier: 1.08,
      rewardMultiplier: 0.9,
    });
  }
  state.enemySpawnCooldown = Math.max(state.enemySpawnCooldown, 2.6);
}

function hitTestCircle(xA: number, yA: number, radiusA: number, xB: number, yB: number, radiusB: number) {
  const dx = xA - xB;
  const dy = yA - yB;
  const radius = radiusA + radiusB;
  return dx * dx + dy * dy <= radius * radius;
}

function createDrop(state: ArenaGameState, x: number, y: number, type: ArenaDropType) {
  const palette: Record<ArenaDropType, { label: string; color: string }> = {
    hullPatch: { label: 'Health', color: '#FF8D7A' },
    shieldCell: { label: 'Shield', color: '#7CEAFF' },
    overdrive: { label: 'Overdrive', color: '#FFCB6F' },
    salvageBurst: { label: 'Salvage', color: '#C1B2FF' },
  };
  const definition = palette[type];
  const drop: ArenaDrop = {
    id: `D${state.nextDropId}`,
    type,
    x,
    y,
    size: 44,
    speed: 88,
    label: definition.label,
    color: definition.color,
    age: 0,
  };
  state.drops = [...state.drops, drop];
  state.nextDropId += 1;
}

function maybeSpawnEnemyDrop(state: ArenaGameState, enemy: ArenaEnemy) {
  const chance =
    enemy.kind === 'tank'
      ? 0.28
      : enemy.kind === 'bomber'
        ? 0.2
        : enemy.kind === 'burst'
          ? 0.14
          : 0.09;
  if (Math.random() > chance) {
    return;
  }

  const roll = Math.random();
  const type: ArenaDropType =
    enemy.kind === 'tank'
      ? roll < 0.1
        ? 'hullPatch'
        : roll < 0.18
          ? 'shieldCell'
          : roll < 0.32
            ? 'salvageBurst'
            : 'overdrive'
      : enemy.kind === 'bomber'
        ? roll < 0.5
          ? 'overdrive'
          : roll < 0.63
            ? 'salvageBurst'
            : roll < 0.74
              ? 'shieldCell'
              : 'hullPatch'
      : roll < 0.12
        ? 'shieldCell'
        : roll < 0.24
          ? 'salvageBurst'
          : roll < 0.33
            ? 'hullPatch'
            : 'overdrive';

  createDrop(state, enemy.x, enemy.y, type);
}

function maybeQueueArmoryChoice(state: ArenaGameState) {
  if (state.pendingArmoryChoice || state.salvage < state.nextArmoryCost) {
    return;
  }

  const cost = state.nextArmoryCost;
  state.salvage -= cost;
  state.nextArmoryCost += 80;
  state.pendingArmoryChoice = createArenaArmoryChoice(cost);
  state.pickupMessage = 'Armory draft ready';
  state.pickupTimer = 1.6;
}

function queueBossRewardChoice(state: ArenaGameState) {
  if (state.pendingArmoryChoice) {
    return;
  }

  state.pendingArmoryChoice = createArenaBossArmoryChoice();
  state.pickupMessage = 'Boss cache recovered';
  state.pickupTimer = 1.9;
}

function applyDamageToEnemy(
  state: ArenaGameState,
  enemy: ArenaEnemy,
  damage: number,
  options?: {
    allowDrafts?: boolean;
    grantCharge?: boolean;
    effectScale?: number;
    effectColor?: string;
    effectFlavor?: ArenaEffectFlavor;
    effectIntensity?: number;
    silentEffect?: boolean;
  }
) {
  if (enemy.health <= 0) {
    return;
  }

  enemy.health = Math.max(0, enemy.health - damage);
  enemy.flash = 1;
  if (!options?.silentEffect) {
    queueEffect(
      state,
      'burst',
      enemy.x,
      enemy.y,
      enemy.size * (options?.effectScale ?? 0.8),
      options?.effectColor ?? '#FFE5B3',
      {
        flavor: options?.effectFlavor ?? 'neutral',
        intensity: options?.effectIntensity ?? 1,
      }
    );
  }

  if (options?.grantCharge !== false) {
    addUltimateCharge(state, Math.min(4.8, damage * 0.05));
  }

  if (enemy.health > 0) {
    return;
  }

  state.score += enemy.reward;
  state.salvage += Math.max(12, Math.round(enemy.reward / 6));
  queueEffect(state, 'burst', enemy.x, enemy.y, enemy.size * 1.24, enemy.color, {
    flavor: 'enemy',
    intensity: 1.2,
  });
  maybeSpawnEnemyDrop(state, enemy);

  if (options?.grantCharge !== false) {
    addUltimateCharge(state, Math.min(8, Math.max(2, enemy.reward / 95)));
  }

  if (options?.allowDrafts && !state.activeEncounter) {
    maybeQueueArmoryChoice(state);
  }
}

function applyPlayerDamage(state: ArenaGameState, damage: number, boardHeight: number) {
  let remainingDamage = damage;
  if (state.shield > 0) {
    const absorbed = Math.min(state.shield, remainingDamage);
    state.shield -= absorbed;
    remainingDamage -= absorbed;
    queueEffect(state, 'shield', state.playerX, getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.35, 54, '#9EEBFF', {
      flavor: 'neutral',
      intensity: 1,
    });
  }

  if (remainingDamage > 0) {
    state.hull = Math.max(0, state.hull - remainingDamage);
    queueEffect(state, 'burst', state.playerX, getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.3, 68, '#FF8A7D', {
      flavor: 'enemy',
      intensity: 1.4,
    });
  }

  state.playerFlash = 1;
  state.shieldRegenCooldown = ARENA_SHIELD_REGEN_DELAY_SECONDS;
  if (state.hull <= 0) {
    state.status = 'lost';
  }
}

function getMissileLaunchOffsets(state: ArenaGameState, weapon: ArenaWeapon) {
  const displayTier = getArenaDisplayTier(state.elapsed);
  const tierBonus = displayTier >= 16 ? 2 : displayTier >= 9 ? 1 : 0;
  const overdriveBonus = state.overclockTimer > 0 ? 1 : 0;
  const volleyCount = Math.max(2, Math.min(6, weapon.shotCount + tierBonus + overdriveBonus));

  switch (volleyCount) {
    case 6:
      return [-34, -20, -8, 8, 20, 34];
    case 5:
      return [-32, -16, 0, 16, 32];
    case 4:
      return [-28, -10, 10, 28];
    case 3:
      return [-22, 0, 22];
    default:
      return [-18, 18];
  }
}

function createPlayerMissileVolley(state: ArenaGameState, boardHeight: number) {
  const weapon = getArenaActiveWeapon(state);
  const muzzleY = boardHeight - ARENA_PLAYER_HEIGHT - 16;
  const launchOffsets = getMissileLaunchOffsets(state, weapon);
  const salvoCount = launchOffsets.length;
  const salvoDamageScale = salvoCount >= 6 ? 0.8 : salvoCount >= 4 ? 0.88 : salvoCount === 3 ? 0.94 : 1;
  const missiles = [...state.playerBullets];
  for (const offset of launchOffsets) {
    missiles.push({
      id: `B${state.nextBulletId}`,
      owner: 'player',
      kind: 'missile',
      buildFlavor: 'missileCommand',
      x: state.playerX + offset,
      y: muzzleY + 5,
      vx: offset < 0 ? -120 : 120,
      vy: -560,
      homing: 6.4,
      damage: Math.max(10, Math.round(weapon.damage * 2.05 * salvoDamageScale)),
      size: Math.min(10.4, weapon.bulletSize + 0.5),
      color: '#FFD8A6',
      age: 0,
      maxAge: 3.4,
      pierce: 1,
    });
    state.nextBulletId += 1;
  }
  state.playerBullets = missiles;
  queueEffect(state, 'muzzle', state.playerX, muzzleY, 24, '#FFD9A6', {
    flavor: 'missileCommand',
    intensity: 1.2,
  });
}

function createFractureShards(state: ArenaGameState, x: number, y: number, baseDamage: number) {
  if (state.playerBullets.length >= 160) {
    return;
  }
  const shardCount = 8;
  const shardSpeed = 560;
  const bullets = [...state.playerBullets];
  for (let index = 0; index < shardCount; index += 1) {
    const ratio = shardCount <= 1 ? 0 : index / (shardCount - 1);
    const angle = -0.88 + ratio * 1.76 + (Math.random() - 0.5) * 0.06;
    bullets.push({
      id: `B${state.nextBulletId}`,
      owner: 'player',
      kind: 'shard',
      buildFlavor: 'fractureCore',
      x,
      y,
      vx: Math.sin(angle) * shardSpeed,
      vy: -Math.cos(angle) * shardSpeed,
      damage: Math.max(4, Math.round(baseDamage * 0.34)),
      size: 4.9,
      color: '#DDEBFF',
      age: 0,
      maxAge: 0.86,
      pierce: 0,
    });
    state.nextBulletId += 1;
  }
  state.playerBullets = bullets;
  queueEffect(state, 'burst', x, y, 28, '#CDE5FF', {
    flavor: 'fractureCore',
    intensity: 1.08,
  });
}

function createPlayerVolley(state: ArenaGameState, boardHeight: number) {
  const weapon = getArenaActiveWeapon(state);
  if (state.activeBuild === 'missileCommand') {
    state.fireCooldown = 0;
    return;
  }
  const bullets = [...state.playerBullets];
  const muzzleY = boardHeight - ARENA_PLAYER_HEIGHT - 18;
  const centerIndex = (weapon.shotCount - 1) / 2;
  const bulletColor =
    state.activeBuild === 'railFocus'
      ? '#D7E9FF'
      : state.activeBuild === 'novaBloom'
        ? '#FFD2E8'
        : '#D8E7FF';

  for (let index = 0; index < weapon.shotCount; index += 1) {
    const lane = index - centerIndex;
    const shotAngle =
      state.activeBuild === 'novaBloom'
        ? lane * 0.09
        : state.activeBuild === 'fractureCore'
          ? lane * 0.1
          : state.activeBuild === 'railFocus'
            ? lane * 0.04
            : lane * 0.06;
    const x = state.playerX + lane * weapon.spread * (state.activeBuild === 'novaBloom' ? 0.9 : 1);
    const lateralFactor = state.activeBuild === 'novaBloom' ? 0.34 : state.activeBuild === 'fractureCore' ? 0.28 : 0.36;
    bullets.push({
      id: `B${state.nextBulletId}`,
      owner: 'player',
      kind: 'primary',
      buildFlavor: state.activeBuild,
      x,
      y: muzzleY,
      vx: Math.sin(shotAngle) * weapon.bulletSpeed * lateralFactor,
      vy: -Math.cos(shotAngle) * weapon.bulletSpeed,
      homing: 0,
      damage: weapon.damage,
      size: weapon.bulletSize,
      color: bulletColor,
      age: 0,
      maxAge: 2,
      pierce: weapon.pierce,
    });
    state.nextBulletId += 1;
  }

  state.playerBullets = bullets;
  state.fireCooldown += weapon.fireInterval;
  queueEffect(state, 'muzzle', state.playerX, muzzleY, 24 + weapon.shotCount * 6, '#FFE4A8', {
    flavor: state.activeBuild,
    intensity: state.activeBuild === 'novaBloom' ? 1.16 : state.activeBuild === 'railFocus' ? 1.1 : 1,
  });
}

function getPlayerHitbox(state: ArenaGameState, boardHeight: number) {
  const top = getPlayerShipTop(boardHeight);
  return {
    left: state.playerX - 18,
    top,
    right: state.playerX + 18,
    bottom: top + ARENA_PLAYER_HEIGHT,
  };
}

export function createInitialArenaState(boardWidth: number): ArenaGameState {
  return {
    status: 'running',
    elapsed: 0,
    score: 0,
    salvage: 0,
    nextArmoryCost: 120,
    activeBuild: ARENA_BUILD_DEFAULT,
    playerX: boardWidth / 2,
    hull: 100,
    maxHull: 100,
    shield: 42,
    maxShield: 42,
    shieldRegenCooldown: 0,
    playerFlash: 0,
    overclockTimer: 0,
    ultimateCharge: 0,
    ultimateTimer: 0,
    ultimateBuild: null,
    ultimateColumns: [],
    weapon: BASE_ARENA_WEAPON,
    enemies: [],
    drops: [],
    playerBullets: [],
    enemyBullets: [],
    effects: [],
    fireCooldown: 0.06,
    missileCooldown: 0.45,
    enemySpawnCooldown: 1.3,
    nextBulletId: 1,
    nextEnemyId: 1,
    nextDropId: 1,
    nextEffectId: 1,
    pickupMessage: 'Enemies are active now. Catch drops and spend salvage on armory drafts.',
    pickupTimer: 3.4,
    activeEncounter: null,
    lastProcessedDisplayTier: 1,
    encounterAnnouncement: 'Arena live',
    encounterAnnouncementColor: '#8BCBFF',
    encounterAnnouncementTimer: 1.5,
    pendingArmoryChoice: null,
  };
}

export function activateArenaUltimate(
  previousState: ArenaGameState,
  boardWidth: number,
  boardHeight: number
): ArenaGameState {
  if (previousState.status !== 'running' || previousState.ultimateCharge < ARENA_MAX_ULTIMATE_CHARGE) {
    return previousState;
  }

  const nextState: ArenaGameState = {
    ...previousState,
    shield: Math.min(previousState.maxShield, previousState.shield + 12),
    enemyBullets: [],
    ultimateCharge: 0,
    ultimateTimer: ARENA_ULTIMATE_DURATION_SECONDS,
    ultimateBuild: previousState.activeBuild,
    ultimateColumns: buildUltimateColumns(previousState.enemies, boardWidth),
    pickupMessage: `${ARENA_BUILD_META[previousState.activeBuild].ultimateLabel} unleashed`,
    pickupTimer: 1.2,
    effects: previousState.effects,
  };

  if (previousState.activeBuild === 'railFocus') {
    const targets = nextState.enemies.slice().sort((left, right) => right.maxHealth - left.maxHealth).slice(0, 6);
    nextState.ultimateColumns = targets.map((target) => target.x);
    nextState.ultimateTimer = 0.98;
    for (const enemy of targets) {
      const damage =
        enemy.kind === 'prismBoss'
          ? enemy.maxHealth * 0.58 + 240
          : enemy.kind === 'interceptor'
            ? enemy.maxHealth * 0.78 + 162
            : enemy.maxHealth * 0.96 + 112;
      applyDamageToEnemy(nextState, enemy, damage, {
        allowDrafts: false,
        grantCharge: false,
        effectScale: enemy.kind === 'prismBoss' ? 2.15 : 1.65,
        effectColor: '#CFE2FF',
        effectFlavor: 'railFocus',
        effectIntensity: 1.24,
      });
    }
    for (const columnX of nextState.ultimateColumns) {
      queueEffect(nextState, 'ultimateRail', columnX, boardHeight * 0.44, boardHeight * 0.96, '#CEE4FF', {
        flavor: 'railFocus',
        intensity: 1.5,
      });
    }
  } else if (previousState.activeBuild === 'novaBloom') {
    nextState.ultimateTimer = 1.56;
    nextState.overclockTimer = Math.max(nextState.overclockTimer, 8.4);
    queueEffect(
      nextState,
      'ultimateNova',
      previousState.playerX,
      boardHeight - 26,
      Math.max(boardWidth, boardHeight) * 1.04,
      '#FFD0E7',
      {
        flavor: 'novaBloom',
        intensity: 1.52,
      }
    );
    for (const enemy of nextState.enemies) {
      const damage = enemy.maxHealth * 0.22 + 52;
      applyDamageToEnemy(nextState, enemy, damage, {
        allowDrafts: false,
        grantCharge: false,
        effectScale: enemy.kind === 'prismBoss' ? 1.95 : 1.48,
        effectColor: '#FFD0E7',
        effectFlavor: 'novaBloom',
        effectIntensity: 1.3,
      });
      enemy.burnTimer = Math.max(enemy.burnTimer, 6.6);
      enemy.burnDps = Math.max(enemy.burnDps, Math.max(28, enemy.maxHealth * 0.035));
    }
  } else if (previousState.activeBuild === 'missileCommand') {
    nextState.ultimateTimer = 1.34;
    nextState.missileCooldown = Math.min(nextState.missileCooldown, 0.08);
    const strikeColumns = buildUltimateColumns(nextState.enemies, boardWidth);
    nextState.ultimateColumns = strikeColumns;
    for (let volleyIndex = 0; volleyIndex < 3; volleyIndex += 1) {
      createPlayerMissileVolley(nextState, boardHeight);
    }
    for (const columnX of strikeColumns) {
      queueEffect(nextState, 'ultimateMissile', columnX, boardHeight - 10, boardHeight * 0.92, '#FFD8AD', {
        flavor: 'missileCommand',
        intensity: 1.48,
      });
    }
    for (const enemy of nextState.enemies) {
      const damage =
        enemy.kind === 'prismBoss'
          ? enemy.maxHealth * 0.36 + 168
          : enemy.kind === 'interceptor'
            ? enemy.maxHealth * 0.54 + 104
            : enemy.maxHealth * 0.58 + 70;
      applyDamageToEnemy(nextState, enemy, damage, {
        allowDrafts: false,
        grantCharge: false,
        effectScale: enemy.kind === 'prismBoss' ? 2.0 : 1.5,
        effectColor: '#FFD8AD',
        effectFlavor: 'missileCommand',
        effectIntensity: 1.28,
      });
    }
  } else {
    nextState.ultimateTimer = 1.38;
    queueEffect(
      nextState,
      'ultimateFracture',
      boardWidth * 0.5,
      boardHeight * 0.44,
      Math.max(boardWidth, boardHeight) * 0.9,
      '#C7DCFF',
      {
        flavor: 'fractureCore',
        intensity: 1.5,
      }
    );
    let shatterBursts = 0;
    for (const enemy of nextState.enemies) {
      const damage =
        enemy.kind === 'prismBoss'
          ? enemy.maxHealth * 0.42 + 172
          : enemy.kind === 'interceptor'
            ? enemy.maxHealth * 0.62 + 116
            : enemy.maxHealth * 0.68 + 86;
      applyDamageToEnemy(nextState, enemy, damage, {
        allowDrafts: false,
        grantCharge: false,
        effectScale: enemy.kind === 'prismBoss' ? 2.04 : 1.64,
        effectColor: '#BFD8FF',
        effectFlavor: 'fractureCore',
        effectIntensity: 1.3,
      });
      if (enemy.health > 0 && shatterBursts < 12) {
        createFractureShards(nextState, enemy.x, enemy.y, damage * 0.34);
        shatterBursts += 1;
      }
    }
  }

  nextState.enemies = nextState.enemies.filter((enemy) => enemy.health > 0);
  queueEffect(nextState, 'shield', previousState.playerX, getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.35, 92, '#9EEBFF', {
    flavor: 'neutral',
    intensity: 1.2,
  });
  return nextState;
}

export function applyArenaArmoryUpgrade(
  previousState: ArenaGameState,
  key: ArenaArmoryUpgradeKey
): ArenaGameState {
  const definition = ARENA_ARMORY_UPGRADES[key];
  const hullBonus = definition.applyMeta?.hullBonus ?? 0;
  const shieldBonus = definition.applyMeta?.shieldBonus ?? 0;
  const nextWeapon = definition.apply(previousState.weapon);

  return {
    ...previousState,
    weapon: nextWeapon,
    maxHull: previousState.maxHull + hullBonus,
    hull: Math.min(previousState.maxHull + hullBonus, previousState.hull + hullBonus),
    maxShield: previousState.maxShield + shieldBonus,
    shield: Math.min(previousState.maxShield + shieldBonus, previousState.shield + shieldBonus),
    fireCooldown: Math.min(previousState.fireCooldown, nextWeapon.fireInterval),
    pendingArmoryChoice: null,
    pickupMessage: `${definition.label} installed`,
    pickupTimer: 2,
  };
}

export function setArenaBuild(previousState: ArenaGameState, nextBuild: ArenaBuildId): ArenaGameState {
  if (previousState.activeBuild === nextBuild) {
    return previousState;
  }
  return {
    ...previousState,
    activeBuild: nextBuild,
    playerBullets: [],
    fireCooldown: nextBuild === 'missileCommand' ? 0 : Math.max(0, previousState.fireCooldown),
    missileCooldown: nextBuild === 'missileCommand' ? 0.22 : previousState.missileCooldown,
    pickupMessage: `${ARENA_BUILD_META[nextBuild].label} online`,
    pickupTimer: 1.8,
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
    salvage: previousState.salvage,
    hull: previousState.hull,
    shield: previousState.shield,
    shieldRegenCooldown: Math.max(0, previousState.shieldRegenCooldown - deltaSeconds),
    playerFlash: Math.max(0, previousState.playerFlash - deltaSeconds * 4.5),
    overclockTimer: Math.max(0, previousState.overclockTimer - deltaSeconds),
    ultimateCharge: previousState.ultimateCharge,
    ultimateTimer: Math.max(0, previousState.ultimateTimer - deltaSeconds),
    ultimateBuild: previousState.ultimateTimer > deltaSeconds ? previousState.ultimateBuild : null,
    ultimateColumns: previousState.ultimateTimer > deltaSeconds ? previousState.ultimateColumns : [],
    encounterAnnouncementTimer: Math.max(0, previousState.encounterAnnouncementTimer - deltaSeconds),
    effects: previousState.effects
      .map((effect) => ({ ...effect, age: effect.age + deltaSeconds }))
      .filter((effect) => effect.age < effect.duration),
    drops: previousState.drops
      .map((drop) => ({
        ...drop,
        y: drop.y + drop.speed * deltaSeconds,
        age: drop.age + deltaSeconds,
      }))
      .filter((drop) => drop.y - drop.size / 2 < boardHeight + 24),
    fireCooldown: previousState.fireCooldown - deltaSeconds,
    missileCooldown: Math.max(0, previousState.missileCooldown - deltaSeconds),
    enemySpawnCooldown: previousState.enemySpawnCooldown - deltaSeconds,
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    weapon: previousState.weapon,
  };

  if (nextState.status !== 'running') {
    return nextState;
  }

  if (nextState.activeBuild === 'missileCommand') {
    nextState.fireCooldown = 0;
  }

  if (nextState.pickupTimer > 0) {
    nextState.pickupTimer = Math.max(0, previousState.pickupTimer - deltaSeconds);
    if (nextState.pickupTimer <= 0) {
      nextState.pickupMessage = null;
    }
  }

  if (nextState.encounterAnnouncementTimer <= 0) {
    nextState.encounterAnnouncement = null;
    nextState.encounterAnnouncementColor = null;
  }

  if (nextState.shieldRegenCooldown <= 0 && nextState.shield < nextState.maxShield) {
    nextState.shield = Math.min(nextState.maxShield, nextState.shield + ARENA_SHIELD_REGEN_PER_SECOND * deltaSeconds);
  }

  const displayTier = getArenaDisplayTier(nextState.elapsed);
  if (nextState.activeBuild !== 'missileCommand') {
    while (nextState.fireCooldown <= 0) {
      createPlayerVolley(nextState, boardHeight);
    }
  } else {
    while (nextState.missileCooldown <= 0) {
      createPlayerMissileVolley(nextState, boardHeight);
      nextState.missileCooldown += getMissileIntervalSeconds(nextState);
    }
  }

  if (displayTier > previousState.lastProcessedDisplayTier) {
    for (let tier = previousState.lastProcessedDisplayTier + 1; tier <= displayTier; tier += 1) {
      nextState.lastProcessedDisplayTier = tier;
      if (nextState.activeEncounter) {
        continue;
      }
      const encounter = createEncounterForTier(tier);
      if (encounter) {
        startEncounter(nextState, boardWidth, boardHeight, encounter);
      }
    }
  }

  if (!nextState.activeEncounter) {
    while (nextState.enemySpawnCooldown <= 0) {
      spawnEnemyGroup(nextState, boardWidth, boardHeight);
      nextState.enemySpawnCooldown += getArenaSpawnCooldown(displayTier, nextState.enemies.length);
      if (nextState.enemies.length >= getArenaActiveEnemyCap(displayTier)) {
        break;
      }
    }
  }

  const movedEnemies: ArenaEnemy[] = [];
  const preExistingEnemyBullets = [...previousState.enemyBullets];
  nextState.enemyBullets = [...preExistingEnemyBullets];
  const playerWeaponBullets = [...previousState.playerBullets, ...nextState.playerBullets];
  nextState.playerBullets = [];

  for (const enemy of previousState.enemies.concat(nextState.enemies)) {
    if (enemy.health <= 0) {
      continue;
    }

    const config = ARENA_ENEMY_CONFIG[enemy.kind];
    const previousWindup = enemy.windupTimer;
    const hadReachedCruise = enemy.y >= enemy.cruiseY;
    let nextEnemy: ArenaEnemy = {
      ...enemy,
      flash: Math.max(0, enemy.flash - deltaSeconds * 4.5),
      attackCooldown: enemy.attackCooldown - deltaSeconds,
      windupTimer: Math.max(0, enemy.windupTimer - deltaSeconds),
      phase: enemy.phase + deltaSeconds * (enemy.kind === 'orbiter' ? 2.2 : enemy.kind === 'prismBoss' ? 0.65 : 1),
    };

    if (!hadReachedCruise) {
      nextEnemy.y = Math.min(nextEnemy.cruiseY, enemy.y + config.descendSpeed * deltaSeconds);
      if (nextEnemy.y >= nextEnemy.cruiseY) {
        nextEnemy.y = nextEnemy.cruiseY;
      }
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
      nextEnemy.y =
        enemy.kind === 'orbiter'
          ? clamp(nextEnemy.cruiseY + Math.sin(nextEnemy.phase) * config.bobAmplitude, enemy.size / 2 + 10, getEnemyZoneMaxY(boardHeight) - enemy.size / 2 - 10)
          : nextEnemy.cruiseY;
    }
    nextEnemy.aimAngle = getEnemyAimAngle(nextEnemy, nextState.playerX, boardHeight);

    if (nextEnemy.burnTimer > 0) {
      const burnDamage = nextEnemy.burnDps * deltaSeconds;
      nextEnemy.burnTimer = Math.max(0, nextEnemy.burnTimer - deltaSeconds);
      if (nextEnemy.burnTimer <= 0) {
        nextEnemy.burnDps = 0;
      }
      if (burnDamage > 0.01) {
        applyDamageToEnemy(nextState, nextEnemy, burnDamage, {
          allowDrafts: false,
          grantCharge: false,
          silentEffect: true,
        });
      }
    }
    if (nextEnemy.health <= 0) {
      movedEnemies.push(nextEnemy);
      continue;
    }

    if (previousWindup > 0 && nextEnemy.windupTimer <= 0) {
      fireEnemyPattern(nextState, nextEnemy, boardHeight);
      queueEffect(nextState, 'muzzle', nextEnemy.x, nextEnemy.y + nextEnemy.size * 0.34, 20 + nextEnemy.size * 0.22, '#FFEED2', {
        flavor: 'enemy',
        intensity: nextEnemy.kind === 'prismBoss' ? 1.28 : 1,
      });
    } else if (previousWindup <= 0 && nextEnemy.attackCooldown <= 0) {
      nextEnemy.windupTimer = config.windupDuration;
      nextEnemy.attackCooldown = Math.max(0.65, config.fireInterval - Math.min(0.7, (displayTier - 1) * 0.035));
    }

    movedEnemies.push(nextEnemy);
  }

  const survivingEnemies = [...movedEnemies];
  const survivingPlayerBullets: ArenaProjectile[] = [];

  for (const bullet of playerWeaponBullets) {
    let nextVx = bullet.vx;
    let nextVy = bullet.vy;
    if (bullet.kind === 'missile' && survivingEnemies.length > 0) {
      let bestTarget: ArenaEnemy | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const enemy of survivingEnemies) {
        if (enemy.health <= 0) {
          continue;
        }
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < bestDistance) {
          bestDistance = distanceSq;
          bestTarget = enemy;
        }
      }
      if (bestTarget) {
        const currentSpeed = Math.max(320, Math.hypot(nextVx, nextVy));
        const dx = bestTarget.x - bullet.x;
        const dy = bestTarget.y - bullet.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const desiredVx = (dx / distance) * currentSpeed;
        const desiredVy = (dy / distance) * currentSpeed;
        const turnRate = Math.max(0, bullet.homing ?? 0);
        const blend = Math.min(1, turnRate * deltaSeconds);
        nextVx += (desiredVx - nextVx) * blend;
        nextVy += (desiredVy - nextVy) * blend;
      }
    }

    let activeBullet: ArenaProjectile | null = {
      ...bullet,
      x: bullet.x + nextVx * deltaSeconds,
      y: bullet.y + nextVy * deltaSeconds,
      vx: nextVx,
      vy: nextVy,
      age: bullet.age + deltaSeconds,
    };
    let triggeredFracture = false;

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

      let hitDamage = activeBullet.damage;
      let railPrecisionHit = false;
      if (
        nextState.activeBuild === 'railFocus' &&
        activeBullet.kind === 'primary' &&
        (enemy.kind === 'interceptor' || enemy.kind === 'prismBoss' || enemy.windupTimer > 0)
      ) {
        hitDamage *= 1.58;
        railPrecisionHit = true;
      }
      if (nextState.activeBuild === 'fractureCore' && activeBullet.kind === 'primary') {
        hitDamage *= 1.16;
      }

      applyDamageToEnemy(nextState, enemy, hitDamage, {
        allowDrafts: !nextState.activeEncounter,
        effectScale: activeBullet.kind === 'primary' ? 0.9 : 0.84,
        effectColor:
          activeBullet.buildFlavor === 'fractureCore'
            ? '#D6E8FF'
            : activeBullet.buildFlavor === 'novaBloom'
              ? '#FFD1E7'
              : activeBullet.buildFlavor === 'railFocus'
                ? '#D8E9FF'
                : '#FFE5B3',
        effectFlavor: activeBullet.buildFlavor ?? 'neutral',
        effectIntensity: activeBullet.kind === 'missile' ? 1.12 : activeBullet.kind === 'shard' ? 0.92 : 1,
      });

      if (activeBullet.kind !== 'missile') {
        const impactSize =
          activeBullet.buildFlavor === 'fractureCore'
            ? activeBullet.size * 4.5
            : activeBullet.kind === 'shard'
              ? activeBullet.size * 3.7
              : activeBullet.size * 3.1;
        queueEffect(
          nextState,
          'burst',
          activeBullet.x,
          activeBullet.y,
          impactSize,
          activeBullet.buildFlavor === 'fractureCore'
            ? '#D4E7FF'
            : activeBullet.buildFlavor === 'novaBloom'
              ? '#FFD3E8'
              : activeBullet.kind === 'shard'
                ? '#DCEBFF'
                : '#FFE4B1',
          {
            flavor: activeBullet.buildFlavor ?? 'neutral',
            intensity:
              activeBullet.buildFlavor === 'railFocus'
                ? 1.06
                : activeBullet.buildFlavor === 'novaBloom'
                  ? 1.12
                  : activeBullet.buildFlavor === 'fractureCore'
                    ? 1.2
                    : 1,
          }
        );
      }

      if (railPrecisionHit) {
        addUltimateCharge(nextState, 0.45);
      }

      if (nextState.activeBuild === 'novaBloom' && activeBullet.kind === 'primary' && enemy.health > 0) {
        enemy.burnTimer = Math.max(enemy.burnTimer, 2.6);
        enemy.burnDps = Math.max(enemy.burnDps, Math.max(10, hitDamage * 0.9));
        const emberRadius = 42;
        for (const emberTarget of survivingEnemies) {
          if (emberTarget === enemy || emberTarget.health <= 0) {
            continue;
          }
          if (!hitTestCircle(activeBullet.x, activeBullet.y, emberRadius, emberTarget.x, emberTarget.y, emberTarget.size * 0.42)) {
            continue;
          }
          emberTarget.burnTimer = Math.max(emberTarget.burnTimer, 1.8);
          emberTarget.burnDps = Math.max(emberTarget.burnDps, Math.max(8, hitDamage * 0.34));
        }
      }

      if (nextState.activeBuild === 'fractureCore' && activeBullet.kind === 'primary' && !triggeredFracture) {
        triggeredFracture = true;
        queueEffect(nextState, 'fractureBits', activeBullet.x, activeBullet.y, activeBullet.size * 4.2, '#D4E8FF', {
          flavor: 'fractureCore',
          intensity: 1.26,
        });
        createFractureShards(nextState, activeBullet.x, activeBullet.y, hitDamage * 1.1);
        const fracturePulseRadius = 48;
        for (const pulseTarget of survivingEnemies) {
          if (pulseTarget === enemy || pulseTarget.health <= 0) {
            continue;
          }
          if (!hitTestCircle(activeBullet.x, activeBullet.y, fracturePulseRadius, pulseTarget.x, pulseTarget.y, pulseTarget.size * 0.44)) {
            continue;
          }
          applyDamageToEnemy(nextState, pulseTarget, hitDamage * 0.24, {
            allowDrafts: !nextState.activeEncounter,
            grantCharge: false,
            effectScale: 0.7,
            effectColor: '#D4E8FF',
            effectFlavor: 'fractureCore',
            effectIntensity: 1.08,
          });
        }
        queueEffect(nextState, 'burst', activeBullet.x, activeBullet.y, 58, '#CCE4FF', {
          flavor: 'fractureCore',
          intensity: 1.24,
        });
      }

      if (activeBullet.kind === 'shard') {
        const fragmentSplashRadius = 30;
        for (const fragmentTarget of survivingEnemies) {
          if (fragmentTarget === enemy || fragmentTarget.health <= 0) {
            continue;
          }
          if (
            !hitTestCircle(
              activeBullet.x,
              activeBullet.y,
              fragmentSplashRadius,
              fragmentTarget.x,
              fragmentTarget.y,
              fragmentTarget.size * 0.42
            )
          ) {
            continue;
          }
          applyDamageToEnemy(nextState, fragmentTarget, hitDamage * 0.42, {
            allowDrafts: !nextState.activeEncounter,
            grantCharge: false,
            effectScale: 0.52,
            effectColor: '#D8EAFF',
            effectFlavor: 'fractureCore',
            effectIntensity: 0.96,
          });
        }
        queueEffect(nextState, 'fractureBits', activeBullet.x, activeBullet.y, activeBullet.size * 3.2, '#D8EAFF', {
          flavor: 'fractureCore',
          intensity: 1.08,
        });
      }

      if (activeBullet.kind === 'missile') {
        const splashRadius = nextState.activeBuild === 'missileCommand' ? 66 : 52;
        const splashDamageScale = nextState.activeBuild === 'missileCommand' ? 0.58 : 0.44;
        for (const splashTarget of survivingEnemies) {
          if (splashTarget === enemy || splashTarget.health <= 0) {
            continue;
          }
          if (!hitTestCircle(activeBullet.x, activeBullet.y, splashRadius, splashTarget.x, splashTarget.y, splashTarget.size * 0.44)) {
            continue;
          }
          applyDamageToEnemy(nextState, splashTarget, hitDamage * splashDamageScale, {
            allowDrafts: !nextState.activeEncounter,
            grantCharge: false,
            effectScale: 0.65,
            effectColor: '#FFD9AE',
            effectFlavor: 'missileCommand',
            effectIntensity: 1.08,
          });
        }
        queueEffect(nextState, 'burst', activeBullet.x, activeBullet.y, 44, '#FFD9AE', {
          flavor: 'missileCommand',
          intensity: 1.2,
        });
      }

      if (activeBullet.kind === 'missile') {
        activeBullet = null;
      } else if (activeBullet.pierce > 0) {
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
      hitTestCircle(nextBullet.x, nextBullet.y, nextBullet.size * 0.42, closestX, closestY, 2)
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
  const remainingDrops: ArenaDrop[] = [];
  for (const drop of nextState.drops) {
    const closestX = clamp(drop.x, playerHitbox.left, playerHitbox.right);
    const closestY = clamp(drop.y, playerHitbox.top, playerHitbox.bottom);
    if (hitTestCircle(drop.x, drop.y, drop.size * 0.42, closestX, closestY, 2)) {
      if (drop.type === 'hullPatch') {
        nextState.hull = Math.min(nextState.maxHull, nextState.hull + 18);
        nextState.pickupMessage = 'Health restored';
      } else if (drop.type === 'shieldCell') {
        nextState.shield = Math.min(nextState.maxShield, nextState.shield + 24);
        nextState.pickupMessage = 'Shield cell absorbed';
      } else if (drop.type === 'overdrive') {
        nextState.overclockTimer = Math.max(nextState.overclockTimer, 6);
        nextState.pickupMessage = 'Overdrive engaged';
      } else {
        nextState.salvage += 55;
        nextState.pickupMessage = 'Salvage burst secured';
        if (!nextState.activeEncounter) {
          maybeQueueArmoryChoice(nextState);
        }
      }
      nextState.pickupTimer = 1.6;
      queueEffect(nextState, 'pickup', drop.x, drop.y, drop.size * 1.1, drop.color, {
        flavor: 'neutral',
        intensity: 1,
      });
      continue;
    }

    remainingDrops.push(drop);
  }

  nextState.drops = remainingDrops;

  if (nextState.activeEncounter) {
    const anchorAlive = nextState.enemies.some((enemy) => enemy.kind === nextState.activeEncounter?.anchorKind);
    if (!anchorAlive) {
      const completedEncounter = nextState.activeEncounter;
      nextState.activeEncounter = null;
      nextState.salvage += completedEncounter.rewardSalvage;
      addUltimateCharge(nextState, completedEncounter.type === 'boss' ? 30 : 16);
      if (completedEncounter.type === 'boss') {
        nextState.enemyBullets = [];
        queueBossRewardChoice(nextState);
      } else {
        maybeQueueArmoryChoice(nextState);
      }
      nextState.pickupMessage =
        completedEncounter.type === 'boss'
          ? `${completedEncounter.label} cache unlocked`
          : `${completedEncounter.label} cleared`;
      nextState.pickupTimer = 1.9;
      queueEncounterAnnouncement(
        nextState,
        completedEncounter.type === 'boss' ? 'Boss neutralized' : 'Mini-boss cleared',
        completedEncounter.accentColor
      );
      nextState.enemySpawnCooldown = Math.max(nextState.enemySpawnCooldown, completedEncounter.type === 'boss' ? 2.4 : 1.4);
    }
  }

  return nextState;
}
