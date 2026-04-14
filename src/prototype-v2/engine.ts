import {
  ARENA_ENEMY_COLORS,
  ARENA_ENEMY_CONFIG,
  ARENA_ENEMY_ORDER,
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
import {
  ARENA_BOSS_TIER_INTERVAL,
  ARENA_MINI_BOSS_TIER_INTERVAL,
  createEncounterForTier,
  getArenaBossPhaseDefinition,
  getArenaEncounterScript,
  pickFormationScript,
} from './encounters';
import type {
  ArenaBuildId,
  ArenaArmoryUpgradeKey,
  ArenaBuildValueMap,
  ArenaDrop,
  ArenaDropType,
  ArenaEncounter,
  ArenaEncounterScriptId,
  ArenaEffect,
  ArenaEffectFlavor,
  ArenaEffectKind,
  ArenaEnemy,
  ArenaEnemyKind,
  ArenaEnemyValueMap,
  ArenaGameState,
  ArenaHazard,
  ArenaProjectile,
  ArenaWeapon,
} from './types';
import {
  ARENA_ARMORY_UPGRADES,
  isArenaArmoryUpgradeMaxed,
} from './upgrades';

const ARENA_ANNOUNCEMENT_DURATION_SECONDS = 1.75;
const ARENA_MAX_ULTIMATE_CHARGE = 100;
const ARENA_ULTIMATE_DURATION_SECONDS = 1.15;
const ARENA_BUILD_DEFAULT: ArenaBuildId = 'railFocus';
const ARENA_GLOBAL_HEALTH_MULTIPLIER = 1.52;
const ARENA_MAX_HAZARDS = 6;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function isBossKind(kind: ArenaEnemyKind) {
  return kind === 'prismBoss' || kind === 'hiveCarrierBoss';
}

function createBuildValueMap<T>(factory: (buildId: ArenaBuildId) => T): ArenaBuildValueMap<T> {
  return {
    railFocus: factory('railFocus'),
    novaBloom: factory('novaBloom'),
    missileCommand: factory('missileCommand'),
    fractureCore: factory('fractureCore'),
  };
}

function createEnemyValueMap<T>(factory: (kind: ArenaEnemyKind) => T): ArenaEnemyValueMap<T> {
  return ARENA_ENEMY_ORDER.reduce((accumulator, kind) => {
    accumulator[kind] = factory(kind);
    return accumulator;
  }, {} as ArenaEnemyValueMap<T>);
}

function getBuildProjectileCap(build: ArenaBuildId, overdrive = false) {
  if (overdrive) {
    switch (build) {
      case 'railFocus':
        return 3;
      case 'novaBloom':
        return 5;
      case 'missileCommand':
        return 12;
      case 'fractureCore':
        return 4;
    }
  }

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
    angle?: number;
  }
): ArenaEffect {
  const duration =
    kind === 'warning'
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
    angle: options?.angle,
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
    angle?: number;
  }
) {
  state.effects = trimEffects([...state.effects, createArenaEffect(kind, x, y, size, color, state.nextEffectId, options)]);
  state.nextEffectId += 1;
}

function shouldRenderCombatHitEffect(
  state: ArenaGameState,
  emphasis = 1,
  flavor: ArenaEffectFlavor = 'neutral'
) {
  const visualLoad =
    state.effects.length +
    Math.min(12, Math.floor(state.playerBullets.length / 6)) +
    Math.min(10, Math.floor(state.enemyBullets.length / 4));

  if (visualLoad < 24) {
    return true;
  }

  const emphasisBonus =
    flavor === 'missileCommand' || flavor === 'fractureCore'
      ? 0.16
      : flavor === 'railFocus'
        ? 0.08
        : 0;
  const weightedEmphasis = emphasis + emphasisBonus;

  if (visualLoad < 30) {
    return weightedEmphasis >= 1.18 || state.nextEffectId % 2 === 0;
  }
  if (visualLoad < 36) {
    return weightedEmphasis >= 1.24 ? state.nextEffectId % 2 === 0 : state.nextEffectId % 3 === 0;
  }
  return weightedEmphasis >= 1.32 ? state.nextEffectId % 3 === 0 : state.nextEffectId % 4 === 0;
}

function queueEncounterAnnouncement(state: ArenaGameState, label: string, accentColor: string) {
  state.encounterAnnouncement = label;
  state.encounterAnnouncementColor = accentColor;
  state.encounterAnnouncementTimer = ARENA_ANNOUNCEMENT_DURATION_SECONDS;
}

function addUltimateCharge(state: ArenaGameState, amount: number) {
  state.ultimateCharge = Math.min(ARENA_MAX_ULTIMATE_CHARGE, state.ultimateCharge + amount);
}

function getArmoryReadyMessage(availableChoices: number) {
  return availableChoices > 1 ? `Armory x${availableChoices} ready` : 'Armory install ready';
}

function markEnemyEncountered(state: ArenaGameState, kind: ArenaEnemyKind, displayTier: number) {
  if (state.runSeenTierByEnemy[kind] === null) {
    state.runSeenTierByEnemy[kind] = displayTier;
  }
}

function clearProtectionLink(enemy: ArenaEnemy) {
  enemy.protectedTimer = 0;
  enemy.protectedByEnemyId = null;
}

function releaseProtectionLinksFromSource(state: ArenaGameState, sourceEnemyId: string) {
  for (const enemy of state.enemies) {
    if (enemy.protectedByEnemyId === sourceEnemyId) {
      clearProtectionLink(enemy);
    }
  }
}

function queueLaneWarningEffects(
  state: ArenaGameState,
  targetX: number,
  sourceY: number,
  boardHeight: number,
  count: number,
  color: string
) {
  const travelHeight = Math.max(48, boardHeight - sourceY - 24);
  const stepCount = Math.max(1, count - 1);
  for (let index = 0; index < count; index += 1) {
    const y = sourceY + (travelHeight * index) / stepCount;
    queueEffect(state, 'warning', targetX, y, 30 + index * 6, color, {
      flavor: 'enemy',
      intensity: 1.02 + index * 0.06,
    });
  }
}

function getArenaHazardCap(displayTier: number) {
  if (displayTier <= 10) {
    return 2;
  }
  if (displayTier <= 18) {
    return 3;
  }
  if (displayTier <= 28) {
    return 4;
  }
  return 5;
}

function clearEncounterHazards(state: ArenaGameState, encounterTag?: ArenaEncounterScriptId | null) {
  if (!encounterTag) {
    state.hazards = [];
    return;
  }
  state.hazards = state.hazards.filter((hazard) => hazard.encounterTag !== encounterTag);
}

function createImpactHazard(
  state: ArenaGameState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  options?: {
    warningDuration?: number;
    lingerDuration?: number;
    color?: string;
    accentColor?: string;
    sourceEnemyId?: string | null;
    ownerKind?: ArenaEnemyKind | null;
    encounterTag?: ArenaEncounterScriptId | null;
  }
) {
  if (state.hazards.length >= ARENA_MAX_HAZARDS) {
    state.hazards = state.hazards.slice(state.hazards.length - ARENA_MAX_HAZARDS + 1);
  }
  state.hazards = [
    ...state.hazards,
    {
      id: `HZ${state.nextHazardId}`,
      kind: 'impact',
      x,
      y,
      radius,
      damage,
      age: 0,
      warningDuration: options?.warningDuration ?? 0.82,
      lingerDuration: options?.lingerDuration ?? 0.18,
      triggered: false,
      color: options?.color ?? '#FFB98A',
      accentColor: options?.accentColor ?? '#FFE2C4',
      sourceEnemyId: options?.sourceEnemyId ?? null,
      ownerKind: options?.ownerKind ?? null,
      encounterTag: options?.encounterTag ?? null,
    },
  ];
  state.nextHazardId += 1;
}

function queueImpactHazardPattern(
  state: ArenaGameState,
  enemy: ArenaEnemy,
  boardWidth: number,
  boardHeight: number,
  options?: {
    count?: number;
    radius?: number;
    damageScale?: number;
    spread?: number;
    warningDuration?: number;
    patternOffset?: number;
  }
) {
  const count = options?.count ?? 1;
  const radius = options?.radius ?? 42;
  const damageScale = options?.damageScale ?? 1;
  const spread = options?.spread ?? 76;
  const baseY = clamp(boardHeight * 0.74, getEnemyZoneMaxY(boardHeight) + 32, boardHeight - 72);
  const centerX = clamp(state.playerX + (options?.patternOffset ?? 0), radius + 18, boardWidth - radius - 18);
  const stepCount = Math.max(1, count - 1);

  for (let index = 0; index < count; index += 1) {
    const lane = index - stepCount / 2;
    const hazardX = clamp(centerX + lane * spread, radius + 18, boardWidth - radius - 18);
    createImpactHazard(state, hazardX, baseY + Math.abs(lane) * 10, radius, ARENA_ENEMY_CONFIG[enemy.kind].bulletDamage * damageScale, {
      warningDuration: options?.warningDuration ?? 0.82,
      lingerDuration: 0.18,
      color: enemy.kind === 'hiveCarrierBoss' ? '#9DF2D8' : '#FFB88D',
      accentColor: enemy.kind === 'hiveCarrierBoss' ? '#E7FFF5' : '#FFF0D6',
      sourceEnemyId: enemy.id,
      ownerKind: enemy.kind,
      encounterTag: enemy.encounterTag,
    });
  }
}

function tickHazards(state: ArenaGameState, boardWidth: number, boardHeight: number, deltaSeconds: number) {
  const playerHitbox = getPlayerHitbox(state, boardHeight);
  const nextHazards: ArenaHazard[] = [];

  for (const hazard of state.hazards) {
    const nextAge = hazard.age + deltaSeconds;
    const triggered = hazard.triggered || nextAge >= hazard.warningDuration;

    if (!hazard.triggered && triggered) {
      queueEffect(state, 'burst', hazard.x, hazard.y, hazard.radius * 1.8, hazard.color, {
        flavor: 'enemy',
        intensity: 1.14,
      });
      const closestX = clamp(hazard.x, playerHitbox.left, playerHitbox.right);
      const closestY = clamp(hazard.y, playerHitbox.top, playerHitbox.bottom);
      if (hitTestCircle(hazard.x, hazard.y, hazard.radius, closestX, closestY, 2)) {
        applyPlayerDamage(state, hazard.damage, boardHeight);
        if (state.status !== 'running') {
          state.playerBullets = [];
          state.enemyBullets = [];
          state.enemies = [];
          state.hazards = [];
          return;
        }
      }
    }

    if (
      nextAge >= hazard.warningDuration + hazard.lingerDuration ||
      hazard.x + hazard.radius < -32 ||
      hazard.x - hazard.radius > boardWidth + 32 ||
      hazard.y - hazard.radius > boardHeight + 32
    ) {
      continue;
    }

    nextHazards.push({
      ...hazard,
      age: nextAge,
      triggered,
    });
  }

  state.hazards = nextHazards;
}

function getBossPhaseIndex(state: ArenaGameState, enemy: ArenaEnemy) {
  if (!isBossKind(enemy.kind) || !state.activeEncounter || state.activeEncounter.type !== 'boss') {
    return 0;
  }
  if (state.activeEncounter.anchorEnemyId && state.activeEncounter.anchorEnemyId !== enemy.id) {
    return 0;
  }
  return state.activeEncounter.bossPhaseIndex;
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

function getFractureUltimateEffectSize(boardWidth: number, boardHeight: number, scale = 1) {
  const enemyZoneMaxY = getEnemyZoneMaxY(boardHeight);
  const radius = Math.min(boardWidth * 0.31 * scale, enemyZoneMaxY * 0.33 * scale, boardHeight * 0.18 * scale);
  return radius / 0.4;
}

function getRandomFractureUltimateCenter(
  boardWidth: number,
  boardHeight: number,
  radius: number,
  avoid?: { x: number; y: number; radius: number }
) {
  const padding = 18;
  const enemyZoneMaxY = getEnemyZoneMaxY(boardHeight) - 8;
  const minX = radius + padding;
  const maxX = Math.max(minX, boardWidth - radius - padding);
  const minY = radius + padding;
  const maxY = Math.max(minY, enemyZoneMaxY - radius - padding);

  let fallback = {
    x: clamp(boardWidth * 0.5, minX, maxX),
    y: clamp(enemyZoneMaxY * 0.54, minY, maxY),
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = {
      x: lerp(minX, maxX, Math.random()),
      y: lerp(minY, maxY, Math.random()),
    };
    if (!avoid) {
      return candidate;
    }

    const distance = Math.hypot(candidate.x - avoid.x, candidate.y - avoid.y);
    if (distance >= radius + avoid.radius * 0.42) {
      return candidate;
    }

    const fallbackDistance = Math.hypot(fallback.x - avoid.x, fallback.y - avoid.y);
    if (distance > fallbackDistance) {
      fallback = candidate;
    }
  }

  return fallback;
}

export function getArenaDisplayTier(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds / ARENA_TIER_DURATION_SECONDS) + 1;
}

export function getArenaActiveWeapon(state: ArenaGameState): ArenaWeapon {
  const displayTier = getArenaDisplayTier(state.elapsed);
  const overdriveActive = state.overclockTimer > 0;
  let nextWeapon: ArenaWeapon = {
    ...state.weapon,
    damage: state.weapon.damage + Math.floor((displayTier - 1) / 6),
    fireInterval: Math.max(0.07, state.weapon.fireInterval - Math.min(0.01, (displayTier - 1) * 0.0006)),
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
        fireInterval: Math.max(0.085, nextWeapon.fireInterval * 0.93),
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
        damage: Math.round(nextWeapon.damage * 1.2),
        fireInterval: Math.max(0.062, nextWeapon.fireInterval * 0.86),
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
        damage: Math.round(nextWeapon.damage * 1.64),
        fireInterval: Math.max(0.38, nextWeapon.fireInterval * 2.55),
        shotCount: Math.min(3, Math.max(1, nextWeapon.shotCount)),
        pierce: Math.min(4, nextWeapon.pierce + 1),
        bulletSpeed: Math.min(1500, nextWeapon.bulletSpeed + 20),
        bulletSize: Math.min(23.2, nextWeapon.bulletSize + 4.8),
        spread: Math.min(20, nextWeapon.spread),
      };
      break;
  }

  if (overdriveActive) {
    const projectileCap = getBuildProjectileCap(state.activeBuild, true);
    const overdriveFireMultiplier = state.activeBuild === 'fractureCore' ? 0.72 : 0.74;
    const overdriveFireFloor = state.activeBuild === 'fractureCore' ? 0.26 : 0.065;
    const overdriveBulletSizeCap = state.activeBuild === 'fractureCore' ? 26.5 : 14.2;
    nextWeapon = {
      ...nextWeapon,
      damage: nextWeapon.damage + 10,
      fireInterval: Math.max(overdriveFireFloor, nextWeapon.fireInterval * overdriveFireMultiplier),
      shotCount: projectileCap,
      pierce: Math.min(7, nextWeapon.pierce + 2),
      bulletSpeed: Math.min(1850, nextWeapon.bulletSpeed + 180),
      bulletSize: Math.min(overdriveBulletSizeCap, nextWeapon.bulletSize + 1),
      spread: Math.min(30, nextWeapon.spread + 3),
    };
  }

  nextWeapon = {
    ...nextWeapon,
    shotCount: Math.max(1, Math.min(getBuildProjectileCap(state.activeBuild, overdriveActive), nextWeapon.shotCount)),
  };

  return nextWeapon;
}

function getMissileIntervalSeconds(state: ArenaGameState) {
  return getMissileBurstWindowSeconds(state);
}

function getRapidCycleUpgradeCount(weapon: ArenaWeapon) {
  let count = 0;
  let probeFireInterval = BASE_ARENA_WEAPON.fireInterval;
  while (count < 12 && probeFireInterval > weapon.fireInterval + 0.0001) {
    probeFireInterval = Math.max(0.065, probeFireInterval * 0.88);
    count += 1;
  }
  return count;
}

export function getArenaActiveEnemyCap(displayTier: number) {
  if (displayTier <= 4) {
    return 5;
  }
  if (displayTier <= 9) {
    return 6;
  }
  if (displayTier <= 14) {
    return 7;
  }
  if (displayTier <= 20) {
    return 8;
  }
  if (displayTier <= 28) {
    return 9;
  }
  return 10;
}

function getArenaEnemyBulletCap(displayTier: number) {
  if (displayTier <= 5) {
    return 10;
  }
  if (displayTier <= 10) {
    return 12;
  }
  if (displayTier <= 16) {
    return 14;
  }
  if (displayTier <= 24) {
    return 16;
  }
  return 18;
}

function getArenaSpawnCooldown(displayTier: number, activeEnemyCount: number, activeEnemyBulletCount: number) {
  const baseCooldown =
    displayTier <= 4
      ? 2.32
      : displayTier <= 9
        ? 2.12
        : displayTier <= 14
          ? 1.96
          : displayTier <= 20
            ? 1.86
            : 1.78;
  const tierAcceleration = Math.min(0.6, Math.max(0, displayTier - 1) * 0.034);
  const densityPenalty = activeEnemyCount * 0.12;
  const bulletPenalty = Math.min(0.52, activeEnemyBulletCount * 0.024);
  return Math.max(0.98, baseCooldown - tierAcceleration + densityPenalty + bulletPenalty);
}

function getEnemyKindPool(displayTier: number): ArenaEnemyKind[] {
  const pool: ArenaEnemyKind[] = [];
  const addWeighted = (kind: ArenaEnemyKind, weight: number) => {
    for (let index = 0; index < weight; index += 1) {
      pool.push(kind);
    }
  };

  addWeighted(
    'hover',
    displayTier <= 4 ? 7 : displayTier <= 10 ? 8 : displayTier <= 18 ? 9 : displayTier <= 28 ? 10 : 11
  );
  addWeighted('burst', displayTier <= 3 ? 2 : displayTier <= 12 ? 3 : 4);
  if (displayTier >= 3) {
    addWeighted('orbiter', displayTier <= 12 ? 2 : 3);
  }
  if (displayTier >= 6) {
    addWeighted('tank', displayTier <= 14 ? 1 : 2);
  }
  if (displayTier >= 8) {
    addWeighted('sniper', displayTier <= 18 ? 1 : 2);
  }
  if (displayTier >= 10) {
    addWeighted('bomber', displayTier <= 20 ? 1 : 2);
  }
  if (displayTier >= 9) {
    addWeighted('warden', displayTier <= 18 ? 1 : 2);
  }
  if (displayTier >= 11) {
    addWeighted('lancer', displayTier <= 20 ? 1 : 2);
  }
  if (displayTier >= 12) {
    addWeighted('carrier', displayTier <= 22 ? 1 : 2);
  }
  if (displayTier >= 14) {
    addWeighted('artillery', displayTier <= 22 ? 1 : 2);
  }
  if (displayTier >= 15) {
    addWeighted('interceptor', 1);
  }
  return pool;
}

function getEnemyAttackCooldown(
  kind: ArenaEnemyKind,
  displayTier: number,
  baseFireInterval: number,
  activeEnemyBulletCount: number,
  multiplier = 1
) {
  const tierReductionPerTier: Record<ArenaEnemyKind, number> = {
    hover: 0.018,
    burst: 0.02,
    tank: 0.016,
    orbiter: 0.018,
    sniper: 0.017,
    bomber: 0.016,
    interceptor: 0.024,
    warden: 0.014,
    lancer: 0.018,
    carrier: 0.014,
    artillery: 0.012,
    prismBoss: 0.014,
    hiveCarrierBoss: 0.013,
  };
  const floorByKind: Record<ArenaEnemyKind, number> = {
    hover: 0.92,
    burst: 1.06,
    tank: 1.32,
    orbiter: 1.02,
    sniper: 1.28,
    bomber: 1.24,
    interceptor: 0.9,
    warden: 1.2,
    lancer: 1.48,
    carrier: 1.52,
    artillery: 1.8,
    prismBoss: 1.15,
    hiveCarrierBoss: 1.24,
  };
  const tierReduction = Math.min(0.75, Math.max(0, displayTier - 1) * tierReductionPerTier[kind]);
  const bulletBackPressure = Math.min(0.44, Math.max(0, activeEnemyBulletCount - 8) * 0.025);
  return Math.max(floorByKind[kind], baseFireInterval - tierReduction + bulletBackPressure) * multiplier;
}

function getEnemyTierHealthMultiplier(displayTier: number, kind: ArenaEnemyKind) {
  const postT10Multiplier =
    displayTier <= 10
      ? 1
      : displayTier <= 15
        ? 1 + (displayTier - 10) * 0.12
        : displayTier <= 20
          ? 1.6 + (displayTier - 15) * 0.1
          : displayTier <= 30
            ? 2.1 + (displayTier - 20) * 0.08
            : 2.9 + (displayTier - 30) * 0.05;

  if (isBossKind(kind)) {
    return postT10Multiplier * 1.35;
  }
  if (kind === 'interceptor') {
    return postT10Multiplier * 1.2;
  }
  if (kind === 'carrier') {
    return postT10Multiplier * 1.14;
  }
  if (kind === 'artillery') {
    return postT10Multiplier * 1.18;
  }
  if (kind === 'lancer') {
    return postT10Multiplier * 1.15;
  }
  if (kind === 'warden') {
    return postT10Multiplier * 1.08;
  }
  if (kind === 'tank' || kind === 'bomber') {
    return postT10Multiplier * 1.12;
  }
  return postT10Multiplier;
}

function spawnEncounterScript(
  state: ArenaGameState,
  boardWidth: number,
  boardHeight: number,
  encounter: ArenaEncounter,
  healthScale = 1,
  rewardScale = 1
) {
  const script = getArenaEncounterScript(encounter.scriptId);
  const lanes = getSpawnLanes(boardWidth);
  const centerLane = Math.floor(Math.random() * Math.max(1, lanes.length - 2)) + 1;
  let anchorEnemyId: string | null = encounter.anchorEnemyId;

  for (const step of script.steps) {
    const laneIndex =
      step.laneIndex ??
      clamp(centerLane + (step.laneOffset ?? 0), 0, Math.max(0, lanes.length - 1));
    const enemy = spawnEnemy(state, boardWidth, boardHeight, step.kind, {
      laneIndex,
      x: step.xRatio !== undefined ? boardWidth * step.xRatio : undefined,
      cruiseY: step.cruiseYRatio !== undefined ? boardHeight * step.cruiseYRatio : undefined,
      healthMultiplier: (step.healthMultiplier ?? 1) * healthScale,
      rewardMultiplier: (step.rewardMultiplier ?? 1) * rewardScale,
      attackCooldownMultiplier: step.attackCooldownMultiplier ?? 1,
      supportCooldownMultiplier: step.supportCooldownMultiplier ?? 1,
      specialCooldownMultiplier: step.specialCooldownMultiplier ?? 1,
      deployChargeBonus: step.deployChargeBonus ?? 0,
      vx:
        step.vxMultiplier !== undefined
          ? ARENA_ENEMY_CONFIG[step.kind].strafeSpeed * step.vxMultiplier
          : undefined,
      encounterTag: encounter.scriptId,
    });
    if (step.anchor) {
      anchorEnemyId = enemy.id;
    }
  }

  return anchorEnemyId;
}

function spawnFormationGroup(state: ArenaGameState, boardWidth: number, boardHeight: number, displayTier: number) {
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const remainingCapacity = activeEnemyCap - state.enemies.length;
  if (remainingCapacity <= 0 || displayTier < 5) {
    return false;
  }

  const bulletPressure = clamp(state.enemyBullets.length / Math.max(1, getArenaEnemyBulletCap(displayTier)), 0, 1);
  const hazardPressure = clamp(state.hazards.length / Math.max(1, getArenaHazardCap(displayTier)), 0, 1);
  const script = pickFormationScript(displayTier, remainingCapacity, bulletPressure, hazardPressure);
  if (!script) {
    return false;
  }

  const formationEncounter: ArenaEncounter = {
    type: 'miniBoss',
    scriptId: script.id,
    label: script.label,
    accentColor: script.accentColor,
    anchorKind: script.anchorKind ?? script.steps[0]?.kind ?? 'hover',
    anchorEnemyId: null,
    rewardSalvage: 0,
    startedAtTier: displayTier,
    announcement: script.announcement,
    bossPhaseIndex: 0,
  };
  spawnEncounterScript(state, boardWidth, boardHeight, formationEncounter, 1, 1);
  return true;
}

function getPlayerShipTop(boardHeight: number) {
  return Math.max(0, boardHeight - ARENA_PLAYER_HEIGHT - ARENA_PLAYER_FLOOR_OFFSET);
}

function getEnemyAimAngle(enemy: ArenaEnemy, playerX: number, boardHeight: number) {
  const targetY = getPlayerShipTop(boardHeight) + ARENA_PLAYER_HEIGHT * 0.22;
  const leadFactor =
    enemy.kind === 'sniper'
      ? 0.18
      : enemy.kind === 'interceptor'
        ? 0.24
        : enemy.kind === 'lancer'
          ? 0.14
        : enemy.kind === 'prismBoss'
          ? 0.22
          : enemy.kind === 'hiveCarrierBoss'
          ? 0.22
          : enemy.kind === 'warden'
            ? 0.06
            : enemy.kind === 'carrier'
              ? 0.08
              : enemy.kind === 'artillery'
                ? 0.04
          : 0.08;
  const targetX = enemy.kind === 'lancer' && enemy.laneTargetX !== null ? enemy.laneTargetX : playerX;
  const leadX = targetX + enemy.vx * leadFactor;
  let angle = Math.atan2(leadX - enemy.x, targetY - enemy.y);
  if (enemy.kind === 'orbiter') {
    angle += Math.sin(enemy.phase) * 0.18;
  }
  if (enemy.kind === 'sniper') {
    angle *= 0.9;
  }
  if (enemy.kind === 'interceptor') {
    angle += Math.sin(enemy.phase * 2.6) * 0.1;
  }
  if (enemy.kind === 'warden') {
    angle += Math.sin(enemy.phase * 1.7) * 0.04;
  }
  if (enemy.kind === 'lancer') {
    angle *= 0.66;
  }
  if (enemy.kind === 'prismBoss') {
    angle += Math.sin(enemy.phase * 0.9) * 0.16;
  }
  if (enemy.kind === 'hiveCarrierBoss') {
    angle += Math.sin(enemy.phase * 0.84) * 0.08;
  }
  if (enemy.kind === 'bomber') {
    angle += Math.sin(enemy.phase * 0.8) * 0.06;
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
  size: number,
  options?: {
    style?: ArenaProjectile['enemyStyle'];
    driftAmp?: number;
    driftFreq?: number;
    driftPhase?: number;
  }
) {
  const forwardX = Math.sin(angle);
  const forwardY = Math.cos(angle);
  const originX = enemy.x + forwardX * enemy.size * 0.58;
  const originY = enemy.y + forwardY * enemy.size * 0.58;
  const projectileColor = (() => {
    switch (enemy.kind) {
      case 'tank':
      case 'bomber':
      case 'artillery':
        return '#FFD6AB';
      case 'sniper':
        return '#F3D4FF';
      case 'burst':
        return '#FFB8E2';
      case 'orbiter':
        return '#B5FFF5';
      case 'interceptor':
        return '#C7D1FF';
      case 'warden':
        return '#B6F4FF';
      case 'lancer':
        return '#FFE0B9';
      case 'carrier':
        return '#D8FFE6';
      case 'hiveCarrierBoss':
        return '#CFFFF0';
      case 'prismBoss':
        return '#FFC2DF';
      default:
        return '#FFD9F2';
    }
  })();
  const projectileStyle =
    options?.style ??
    (() => {
      switch (enemy.kind) {
        case 'sniper':
        case 'lancer':
          return 'needle' as const;
        case 'tank':
        case 'bomber':
        case 'artillery':
        case 'hiveCarrierBoss':
          return 'bomb' as const;
        case 'orbiter':
          return 'wave' as const;
        case 'hover':
        case 'warden':
        case 'carrier':
          return 'orb' as const;
        default:
          return 'bolt' as const;
      }
    })();
  const projectile: ArenaProjectile = {
    id: `B${state.nextBulletId}`,
    owner: 'enemy',
    kind: 'enemy',
    enemyStyle: projectileStyle,
    driftAmp: options?.driftAmp,
    driftFreq: options?.driftFreq,
    driftPhase: options?.driftPhase ?? enemy.phase,
    x: originX,
    y: originY,
    vx: forwardX * speed,
    vy: forwardY * speed,
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

function createEnemyLaneStrike(
  state: ArenaGameState,
  enemy: ArenaEnemy,
  laneTargetX: number,
  boardHeight: number,
  options?: {
    offsetPattern?: number[];
    speedScale?: number;
    damageScale?: number;
    sizeScale?: number;
  }
) {
  const config = ARENA_ENEMY_CONFIG[enemy.kind];
  const offsets = options?.offsetPattern ?? [-18, 0, 18];
  for (const offset of offsets) {
    state.enemyBullets = [
      ...state.enemyBullets,
      {
        id: `B${state.nextBulletId}`,
        owner: 'enemy',
        kind: 'enemy',
        enemyStyle: 'needle',
        x: laneTargetX + offset,
        y: enemy.y + enemy.size * 0.56,
        vx: 0,
        vy: config.bulletSpeed * (options?.speedScale ?? 1),
        damage: config.bulletDamage * (options?.damageScale ?? 1),
        size: config.bulletSize * (options?.sizeScale ?? 1),
        color:
          enemy.kind === 'prismBoss'
            ? '#FFD8E9'
            : enemy.kind === 'hiveCarrierBoss'
              ? '#D4FFF0'
              : '#FFE8C8',
        age: 0,
        maxAge: Math.max(1.8, (boardHeight - enemy.y) / Math.max(220, config.bulletSpeed) + 0.8),
        pierce: 0,
      },
    ];
    state.nextBulletId += 1;
  }
  return offsets.length;
}

function fireEnemyPattern(state: ArenaGameState, enemy: ArenaEnemy, boardWidth: number, boardHeight: number) {
  const config = ARENA_ENEMY_CONFIG[enemy.kind];
  const desiredAngle = enemy.aimAngle;
  const displayTier = getArenaDisplayTier(state.elapsed);
  const bossPhase = getBossPhaseIndex(state, enemy);
  const cappedEnemyBulletCap = getArenaEnemyBulletCap(displayTier);
  const remainingBulletBudget = Math.max(0, cappedEnemyBulletCap - state.enemyBullets.length);
  const remainingHazardBudget = Math.max(0, getArenaHazardCap(displayTier) - state.hazards.length);
  if (remainingBulletBudget <= 0 && remainingHazardBudget <= 0) {
    return;
  }
  const pressureRatio = clamp(state.enemyBullets.length / Math.max(1, cappedEnemyBulletCap), 0, 1);
  const pressureCountScale = pressureRatio > 0.82 ? 0.68 : pressureRatio > 0.66 ? 0.82 : 1;
  const scaledCount = (count: number, minimum = 1) =>
    Math.max(minimum, Math.min(count, Math.round(count * pressureCountScale)));

  let budget = remainingBulletBudget;
  const fireShot = (
    angle: number,
    damageScale: number,
    speedScale: number,
    sizeScale: number,
    options?: Parameters<typeof createEnemyProjectile>[7]
  ) => {
    if (budget <= 0) {
      return;
    }
    createEnemyProjectile(
      state,
      enemy,
      boardHeight,
      angle,
      config.bulletDamage * damageScale,
      config.bulletSpeed * speedScale,
      config.bulletSize * sizeScale,
      options
    );
    budget -= 1;
  };
  const fireFan = (
    count: number,
    spreadAngle: number,
    damageScale: number,
    speedScale: number,
    sizeScale: number,
    options?: Parameters<typeof createEnemyProjectile>[7]
  ) => {
    const fanCount = Math.min(count, budget);
    for (let index = 0; index < fanCount; index += 1) {
      const lane = index - (fanCount - 1) / 2;
      fireShot(desiredAngle + lane * spreadAngle, damageScale, speedScale, sizeScale, options);
    }
  };

  switch (enemy.kind) {
    case 'hover':
      fireFan(displayTier >= 10 ? scaledCount(2) : 1, 0.12, 0.92, 1.04, 0.86, {
        style: 'orb',
        driftAmp: 10,
        driftFreq: 8,
      });
      break;
    case 'burst':
      fireFan(displayTier >= 14 ? scaledCount(4, 2) : scaledCount(3, 2), Math.max(0.14, config.spreadAngle * 0.78), 0.84, 1.1, 0.9, {
        style: 'bolt',
      });
      if (displayTier >= 7 && pressureRatio < 0.9) {
        fireShot(desiredAngle, 1.06, 1.12, 0.92, { style: 'bolt' });
      }
      break;
    case 'warden':
      fireFan(2, 0.15, 0.78, 1, 0.86, {
        style: 'orb',
        driftAmp: 8,
        driftFreq: 7.2,
      });
      if (pressureRatio < 0.82) {
        fireShot(desiredAngle, 0.88, 1.06, 0.82, {
          style: 'wave',
          driftAmp: 10,
          driftFreq: 5.8,
        });
      }
      break;
    case 'lancer':
      budget -= createEnemyLaneStrike(state, enemy, enemy.laneTargetX ?? enemy.x, boardHeight, {
        offsetPattern: (displayTier >= 16 ? [-20, 0, 20] : [-14, 0, 14]).slice(0, budget),
        speedScale: displayTier >= 18 ? 1.08 : 1,
        damageScale: 1.04,
        sizeScale: 0.96,
      });
      break;
    case 'carrier':
      fireFan(displayTier >= 18 ? scaledCount(3, 2) : 2, 0.12, 0.84, 0.98, 0.9, {
        style: 'orb',
        driftAmp: 9,
        driftFreq: 6.8,
      });
      if (pressureRatio < 0.78) {
        fireShot(desiredAngle, 1, 0.96, 0.92, {
          style: 'wave',
          driftAmp: 10,
          driftFreq: 5.6,
        });
      }
      break;
    case 'artillery':
      if (remainingHazardBudget > 0) {
        queueImpactHazardPattern(state, enemy, boardWidth, boardHeight, {
          count: displayTier >= 18 ? 2 : 1,
          radius: displayTier >= 18 ? 48 : 44,
          damageScale: 1.02,
          spread: 82,
          warningDuration: 0.86,
        });
      }
      if (pressureRatio < 0.7) {
        fireShot(desiredAngle, 1.06, 0.9, 1.08, { style: 'bomb' });
      }
      break;
    case 'tank':
      fireShot(desiredAngle, 1.42, 0.8, 1.28, { style: 'bomb' });
      if (displayTier >= 15 && pressureRatio < 0.84) {
        fireShot(desiredAngle + (Math.random() < 0.5 ? -0.06 : 0.06), 0.95, 0.84, 1.05, { style: 'bomb' });
      }
      break;
    case 'orbiter': {
      const swirl = 0.18 + Math.sin(enemy.phase * 2.1) * 0.1;
      fireShot(desiredAngle + swirl, 0.92, 1.02, 0.9, {
        style: 'wave',
        driftAmp: 14,
        driftFreq: 6.8,
      });
      fireShot(desiredAngle - swirl, 0.92, 1.02, 0.9, {
        style: 'wave',
        driftAmp: 14,
        driftFreq: 6.8,
      });
      if (displayTier >= 12 && pressureRatio < 0.82) {
        fireShot(desiredAngle, 0.88, 1.08, 0.82, {
          style: 'orb',
          driftAmp: 8,
          driftFreq: 9.2,
        });
      }
      break;
    }
    case 'sniper':
      fireShot(desiredAngle, 1.5, 1.28, 0.78, { style: 'needle' });
      if (displayTier >= 14 && pressureRatio < 0.78) {
        fireShot(desiredAngle + Math.sin(enemy.phase) * 0.03, 1.0, 1.18, 0.74, { style: 'needle' });
      }
      break;
    case 'bomber':
      fireFan(displayTier >= 16 ? scaledCount(3, 2) : 2, 0.24, 1.1, 0.82, 1.2, { style: 'bomb' });
      if (displayTier >= 16 && pressureRatio < 0.8) {
        fireFan(scaledCount(2, 1), 0.12, 0.82, 0.92, 0.94, {
          style: 'wave',
          driftAmp: 12,
          driftFreq: 5.8,
        });
      }
      break;
    case 'interceptor':
      fireFan(displayTier >= 18 ? scaledCount(5, 3) : scaledCount(4, 3), 0.11, 0.82, 1.18, 0.86, { style: 'bolt' });
      if (displayTier >= 20 && pressureRatio < 0.8) {
        fireShot(desiredAngle, 0.95, 1.22, 0.82, { style: 'needle' });
      }
      break;
    case 'prismBoss':
      if (bossPhase === 0) {
        if (Math.sin(enemy.phase * 0.6) > 0) {
          fireFan(displayTier >= 18 ? scaledCount(7, 5) : scaledCount(6, 4), 0.2, 0.92, 0.98, 1, {
            style: 'wave',
            driftAmp: 16,
            driftFreq: 5.2,
          });
        } else {
          fireFan(scaledCount(4, 3), 0.34, 1.14, 1.08, 0.9, { style: 'needle' });
          if (pressureRatio < 0.88) {
            fireShot(desiredAngle, 1.3, 1.02, 1.1, { style: 'bomb' });
          }
        }
      } else if (bossPhase === 1) {
        fireFan(displayTier >= 18 ? scaledCount(8, 5) : scaledCount(7, 4), 0.16, 0.94, 1.02, 0.94, {
          style: 'wave',
          driftAmp: 18,
          driftFreq: 5.6,
        });
        if (pressureRatio < 0.86) {
          fireFan(scaledCount(3, 2), 0.28, 1.08, 1.1, 0.86, { style: 'needle' });
        }
      } else {
        budget -= createEnemyLaneStrike(state, enemy, enemy.laneTargetX ?? state.playerX, boardHeight, {
          offsetPattern: [-28, -8, 8, 28].slice(0, budget),
          speedScale: 1.08,
          damageScale: 1.1,
          sizeScale: 0.94,
        });
        if (pressureRatio < 0.86) {
          fireFan(scaledCount(4, 3), 0.18, 1.02, 1.14, 0.86, { style: 'bolt' });
        }
      }
      break;
    case 'hiveCarrierBoss':
      if (bossPhase === 0) {
        fireFan(displayTier >= 18 ? scaledCount(5, 3) : scaledCount(4, 3), 0.16, 0.9, 0.98, 0.98, {
          style: 'orb',
          driftAmp: 10,
          driftFreq: 5.4,
        });
        if (remainingHazardBudget > 0 && pressureRatio < 0.82) {
          queueImpactHazardPattern(state, enemy, boardWidth, boardHeight, {
            count: 1,
            radius: 44,
            damageScale: 0.92,
            spread: 0,
            warningDuration: 0.92,
          });
        }
      } else if (bossPhase === 1) {
        if (remainingHazardBudget > 0) {
          queueImpactHazardPattern(state, enemy, boardWidth, boardHeight, {
            count: remainingHazardBudget >= 3 ? 3 : 2,
            radius: 48,
            damageScale: 1.04,
            spread: 86,
            warningDuration: 0.82,
          });
        }
        if (pressureRatio < 0.8) {
          fireFan(scaledCount(4, 2), 0.18, 0.92, 1.02, 0.96, { style: 'wave', driftAmp: 14, driftFreq: 5.2 });
        }
      } else {
        budget -= createEnemyLaneStrike(state, enemy, enemy.laneTargetX ?? state.playerX, boardHeight, {
          offsetPattern: [-30, -10, 10, 30].slice(0, budget),
          speedScale: 1.06,
          damageScale: 1.08,
          sizeScale: 0.96,
        });
        if (remainingHazardBudget > 0) {
          queueImpactHazardPattern(state, enemy, boardWidth, boardHeight, {
            count: remainingHazardBudget >= 2 ? 2 : 1,
            radius: 50,
            damageScale: 1.08,
            spread: 92,
            warningDuration: 0.76,
          });
        }
        if (pressureRatio < 0.82) {
          fireFan(scaledCount(4, 2), 0.16, 0.96, 1.08, 0.92, { style: 'bolt' });
        }
      }
      break;
    default:
      if (config.burstCount <= 1) {
        fireShot(desiredAngle, 1, 1, 1);
        break;
      }
      fireFan(config.burstCount, config.spreadAngle, 1, 1, 1);
      break;
  }
}

function beginEnemyAttackWindup(
  state: ArenaGameState,
  enemy: ArenaEnemy,
  boardWidth: number,
  boardHeight: number,
  displayTier: number
) {
  const config = ARENA_ENEMY_CONFIG[enemy.kind];
  const bossPhase = getBossPhaseIndex(state, enemy);
  const attackMultiplier =
    isBossKind(enemy.kind)
      ? bossPhase === 2
        ? 0.74
        : bossPhase === 1
          ? 0.84
          : 1
      : enemy.kind === 'artillery'
        ? 0.94
      : enemy.kind === 'lancer'
        ? 0.92
        : 1;

  enemy.windupTimer = config.windupDuration;
  enemy.attackCooldown = getEnemyAttackCooldown(
    enemy.kind,
    displayTier,
    config.fireInterval,
    state.enemyBullets.length,
    attackMultiplier
  );

  if (
    enemy.kind === 'lancer' ||
    (enemy.kind === 'prismBoss' && bossPhase === 2) ||
    (enemy.kind === 'hiveCarrierBoss' && bossPhase === 2)
  ) {
    const targetX = clamp(state.playerX, 24, boardWidth - 24);
    enemy.laneTargetX = targetX;
    queueLaneWarningEffects(
      state,
      targetX,
      enemy.y + enemy.size * 0.18,
      boardHeight,
      isBossKind(enemy.kind) ? 4 : 3,
      enemy.kind === 'prismBoss' ? '#FFD8E7' : '#E3FFEF'
    );
  } else {
    enemy.laneTargetX = null;
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
    supportCooldownMultiplier?: number;
    specialCooldownMultiplier?: number;
    deployChargeBonus?: number;
    vx?: number;
    encounterTag?: ArenaEncounter['scriptId'] | null;
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
  const archetypeHealthMultiplier =
    isBossKind(kind)
      ? kind === 'hiveCarrierBoss'
        ? 2.45
        : 2.3
      : kind === 'interceptor'
        ? 1.4
        : kind === 'carrier'
          ? 1.12
          : kind === 'artillery'
            ? 1.1
            : 1;
  const tierHealthMultiplier = getEnemyTierHealthMultiplier(displayTier, kind);
  const health = Math.round(
    (config.baseHealth + (displayTier - 1) * config.healthPerTier + Math.random() * config.healthPerTier * 0.35) *
      (options?.healthMultiplier ?? 1) *
      archetypeHealthMultiplier *
      (displayTier <= 10 ? 1.24 - (displayTier - 1) * 0.02 : 1) *
      tierHealthMultiplier *
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
    attackCooldown: getEnemyAttackCooldown(
      kind,
      displayTier,
      config.fireInterval,
      state.enemyBullets.length,
      options?.attackCooldownMultiplier ?? 1
    ),
    windupTimer: 0,
    flash: 0,
    burnTimer: 0,
    burnDps: 0,
    inFormation: false,
    phase: Math.random() * Math.PI * 2,
    color: ARENA_ENEMY_COLORS[kind],
    reward: Math.round((config.reward + displayTier * 10) * (options?.rewardMultiplier ?? 1)),
    supportCooldown:
      kind === 'warden'
        ? (1.1 + Math.random() * 0.8) * (options?.supportCooldownMultiplier ?? 1)
        : 0,
    specialCooldown:
      kind === 'lancer'
        ? (0.4 + Math.random() * 0.35) * (options?.specialCooldownMultiplier ?? 1)
        : kind === 'carrier'
          ? (1.7 + Math.random() * 0.45) * (options?.specialCooldownMultiplier ?? 1)
          : kind === 'artillery'
            ? (1.3 + Math.random() * 0.4) * (options?.specialCooldownMultiplier ?? 1)
            : kind === 'hiveCarrierBoss'
              ? (1.45 + Math.random() * 0.35) * (options?.specialCooldownMultiplier ?? 1)
              : 0,
    protectedTimer: 0,
    protectedByEnemyId: null,
    laneTargetX: null,
    deployCharges:
      (kind === 'carrier' ? 2 : kind === 'hiveCarrierBoss' ? 4 : 0) +
      (options?.deployChargeBonus ?? 0),
    encounterTag: options?.encounterTag ?? null,
  };

  state.enemies = [...state.enemies, enemy];
  state.nextEnemyId += 1;
  markEnemyEncountered(state, kind, displayTier);
  return enemy;
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
  if (remainingCapacity <= 0) {
    return;
  }

  const bulletPressure = clamp(state.enemyBullets.length / Math.max(1, getArenaEnemyBulletCap(displayTier)), 0, 1);
  const wingmanChanceByKind: Record<ArenaEnemyKind, number> = {
    hover: displayTier >= 10 ? 0.5 : 0.34,
    burst: displayTier >= 10 ? 0.42 : 0.28,
    orbiter: 0.26,
    tank: 0.22,
    sniper: 0.18,
    bomber: 0.2,
    interceptor: 0.12,
    warden: 0.18,
    lancer: 0.16,
    carrier: 0.14,
    artillery: 0.1,
    prismBoss: 0,
    hiveCarrierBoss: 0,
  };
  const wingmanChance = Math.max(0.08, wingmanChanceByKind[primaryKind] - bulletPressure * 0.24);
  if (displayTier >= 4 && Math.random() < wingmanChance) {
    const offset = laneIndex <= 1 ? 1 : laneIndex >= lanes.length - 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
    spawnEnemy(state, boardWidth, boardHeight, 'hover', {
      laneIndex: clamp(laneIndex + offset, 0, lanes.length - 1),
      attackCooldownMultiplier: 1.05,
    });
  }

  const canAddSwarmExtra = remainingCapacity >= 2 && displayTier >= 12;
  if (canAddSwarmExtra && (primaryKind === 'hover' || primaryKind === 'burst') && Math.random() < 0.22 - bulletPressure * 0.12) {
    spawnEnemy(state, boardWidth, boardHeight, 'hover', {
      laneIndex: clamp(laneIndex + (Math.random() < 0.5 ? -2 : 2), 0, lanes.length - 1),
      attackCooldownMultiplier: 1.08,
    });
  }
}

function startEncounter(state: ArenaGameState, boardWidth: number, boardHeight: number, encounter: ArenaEncounter) {
  const healthScale =
    encounter.type === 'boss'
      ? 1.02 + Math.max(0, encounter.startedAtTier - ARENA_BOSS_TIER_INTERVAL) * 0.085
      : 1 + Math.max(0, encounter.startedAtTier - ARENA_MINI_BOSS_TIER_INTERVAL) * 0.055;
  const rewardScale = encounter.type === 'boss' ? 1.02 : 1;
  clearEncounterHazards(state);
  const anchorEnemyId = spawnEncounterScript(state, boardWidth, boardHeight, encounter, healthScale, rewardScale);

  state.activeEncounter = {
    ...encounter,
    anchorEnemyId,
    bossPhaseIndex: encounter.type === 'boss' ? 0 : encounter.bossPhaseIndex,
  };
  queueEncounterAnnouncement(state, encounter.label, encounter.accentColor);
  state.pickupMessage = encounter.announcement;
  state.pickupTimer = 1.9;
  state.enemySpawnCooldown = Math.max(state.enemySpawnCooldown, encounter.type === 'boss' ? 3.8 : 2.7);
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
      ? 0.14
      : enemy.kind === 'bomber'
        ? 0.1
        : enemy.kind === 'carrier'
          ? 0.09
          : enemy.kind === 'artillery'
            ? 0.08
        : enemy.kind === 'burst'
          ? 0.07
          : 0.045;
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
      : enemy.kind === 'carrier'
        ? roll < 0.22
          ? 'overdrive'
          : roll < 0.46
            ? 'salvageBurst'
            : roll < 0.66
              ? 'shieldCell'
              : 'hullPatch'
      : enemy.kind === 'artillery'
        ? roll < 0.34
          ? 'salvageBurst'
          : roll < 0.56
            ? 'shieldCell'
            : roll < 0.68
              ? 'overdrive'
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

function awardAffordableArmoryChoices(state: ArenaGameState) {
  let grantedChoices = 0;
  while (state.salvage >= state.nextArmoryCost) {
    state.salvage -= state.nextArmoryCost;
    state.nextArmoryCost += 80;
    state.availableArmoryChoices += 1;
    grantedChoices += 1;
  }
  return grantedChoices;
}

function awardBossArmoryChoice(state: ArenaGameState) {
  state.availableArmoryChoices += 1;
  return 1;
}

function processWardenSupport(
  state: ArenaGameState,
  enemies: ArenaEnemy[],
  displayTier: number
) {
  const liveEnemies = enemies.filter((enemy) => enemy.health > 0);
  const liveEnemyIds = new Set(liveEnemies.map((enemy) => enemy.id));

  for (const enemy of liveEnemies) {
    if (
      enemy.protectedByEnemyId &&
      (!liveEnemyIds.has(enemy.protectedByEnemyId) || enemy.protectedTimer <= 0)
    ) {
      clearProtectionLink(enemy);
    }
  }

  for (const warden of liveEnemies) {
    if (warden.kind !== 'warden' || !warden.inFormation || warden.supportCooldown > 0) {
      continue;
    }

    const protectionTargets = liveEnemies
      .filter(
        (enemy) =>
          enemy.id !== warden.id &&
          enemy.health > 0 &&
          Math.hypot(enemy.x - warden.x, enemy.y - warden.y) <= 184
      )
      .sort((left, right) => {
        const leftScore = (isBossKind(left.kind) ? -1000 : 0) + Math.hypot(left.x - warden.x, left.y - warden.y);
        const rightScore = (isBossKind(right.kind) ? -1000 : 0) + Math.hypot(right.x - warden.x, right.y - warden.y);
        return leftScore - rightScore;
      })
      .slice(0, 2);

    if (protectionTargets.length === 0) {
      warden.supportCooldown = 1.4;
      continue;
    }

    const duration = 2.35 + Math.min(0.5, Math.max(0, displayTier - 1) * 0.02);
    for (const target of protectionTargets) {
      target.protectedTimer = Math.max(target.protectedTimer, duration);
      target.protectedByEnemyId = warden.id;
      queueEffect(state, 'shield', target.x, target.y, target.size * 1.08, '#A8EEFF', {
        flavor: 'neutral',
        intensity: 1.08,
      });
    }

    queueEffect(state, 'shield', warden.x, warden.y, warden.size * 1.16, '#92E8FF', {
      flavor: 'neutral',
      intensity: 1.12,
    });
    warden.supportCooldown = Math.max(1.85, 3.15 - Math.min(0.65, Math.max(0, displayTier - 1) * 0.03));
  }
}

function processCarrierDeployments(
  state: ArenaGameState,
  boardWidth: number,
  boardHeight: number,
  displayTier: number
) {
  const liveEnemies = state.enemies.filter((enemy) => enemy.health > 0);
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const lanes = getSpawnLanes(boardWidth);

  for (const carrier of liveEnemies) {
    if (
      (carrier.kind !== 'carrier' && carrier.kind !== 'hiveCarrierBoss') ||
      !carrier.inFormation ||
      carrier.deployCharges <= 0 ||
      carrier.specialCooldown > 0
    ) {
      continue;
    }

    const remainingCapacity = activeEnemyCap - state.enemies.filter((enemy) => enemy.health > 0).length;
    if (remainingCapacity <= 0) {
      carrier.specialCooldown = 0.8;
      continue;
    }

    const bossPhase = carrier.kind === 'hiveCarrierBoss' ? getBossPhaseIndex(state, carrier) : 0;
    const deployCount = Math.min(
      remainingCapacity,
      carrier.kind === 'hiveCarrierBoss' ? (bossPhase === 2 ? 3 : 2) : 2
    );
    const carrierLaneIndex = lanes.reduce((bestIndex, laneX, laneIndex) => {
      const bestDistance = Math.abs(lanes[bestIndex] - carrier.x);
      const nextDistance = Math.abs(laneX - carrier.x);
      return nextDistance < bestDistance ? laneIndex : bestIndex;
    }, 0);

    for (let index = 0; index < deployCount; index += 1) {
      const laneOffset =
        deployCount <= 1
          ? 0
          : index === 0
            ? -1
            : index === 1
              ? 1
              : 0;
      const escortKind: ArenaEnemyKind =
        carrier.kind === 'hiveCarrierBoss'
          ? bossPhase === 0
            ? 'hover'
            : bossPhase === 1
              ? index % 2 === 0
                ? 'hover'
                : 'burst'
              : index === 1
                ? 'burst'
                : 'hover'
          : index % 2 === 0
            ? 'hover'
            : 'burst';
      spawnEnemy(state, boardWidth, boardHeight, escortKind, {
        laneIndex: clamp(carrierLaneIndex + laneOffset, 0, lanes.length - 1),
        x: clamp(carrier.x + laneOffset * 32, 24, boardWidth - 24),
        cruiseY: clamp(carrier.cruiseY + 22 + index * 8, 44, getEnemyZoneMaxY(boardHeight) - 20),
        healthMultiplier: carrier.kind === 'hiveCarrierBoss' ? 1.18 : 1.06,
        rewardMultiplier: 0.82,
        attackCooldownMultiplier: carrier.kind === 'hiveCarrierBoss' ? 0.94 : 0.98,
        encounterTag: carrier.encounterTag,
      });
    }

    carrier.deployCharges -= 1;
    queueEffect(state, 'pickup', carrier.x, carrier.y, carrier.size * 0.84, carrier.color, {
      flavor: 'enemy',
      intensity: 1.04,
    });
    carrier.specialCooldown =
      carrier.kind === 'hiveCarrierBoss'
        ? bossPhase === 2
          ? 1.1
          : 1.45
        : 1.8;
  }
}

function maybeAdvanceBossPhase(
  state: ArenaGameState,
  boardWidth: number,
  boardHeight: number
) {
  if (!state.activeEncounter || state.activeEncounter.type !== 'boss') {
    return;
  }

  const anchorEnemy = state.enemies.find((enemy) => enemy.id === state.activeEncounter?.anchorEnemyId);
  if (!anchorEnemy) {
    return;
  }

  const nextPhaseIndex = (state.activeEncounter.bossPhaseIndex + 1) as 1 | 2 | 3;
  if (nextPhaseIndex > 2) {
    return;
  }

  const nextPhaseDefinition = getArenaBossPhaseDefinition(
    state.activeEncounter.scriptId as Extract<ArenaEncounter['scriptId'], 'prismCore' | 'hiveCarrier'>,
    nextPhaseIndex as 1 | 2
  );
  const anchorHealthRatio = anchorEnemy.health / Math.max(1, anchorEnemy.maxHealth);
  if (anchorHealthRatio > nextPhaseDefinition.threshold) {
    return;
  }

  state.activeEncounter = {
    ...state.activeEncounter,
    bossPhaseIndex: nextPhaseDefinition.phaseIndex,
  };
  state.enemyBullets = [];
  clearEncounterHazards(state, state.activeEncounter.scriptId);
  queueEncounterAnnouncement(state, nextPhaseDefinition.label, nextPhaseDefinition.accentColor);
  state.pickupMessage = nextPhaseDefinition.announcement;
  state.pickupTimer = 1.7;

  const phaseCenterRatio = anchorEnemy.x / Math.max(1, boardWidth);
  const lanes = getSpawnLanes(boardWidth);
  const phaseCenterLane = clamp(
    lanes.findIndex((lane) => Math.abs(lane - anchorEnemy.x) === Math.min(...lanes.map((candidate) => Math.abs(candidate - anchorEnemy.x)))),
    1,
    Math.max(1, lanes.length - 2)
  );

  for (const step of nextPhaseDefinition.steps) {
    spawnEnemy(state, boardWidth, boardHeight, step.kind, {
      laneIndex: step.laneIndex ?? clamp(phaseCenterLane + (step.laneOffset ?? 0), 0, lanes.length - 1),
      x: step.xRatio !== undefined ? boardWidth * step.xRatio : step.laneIndex === undefined ? boardWidth * phaseCenterRatio : undefined,
      cruiseY: step.cruiseYRatio !== undefined ? boardHeight * step.cruiseYRatio : undefined,
      healthMultiplier: step.healthMultiplier ?? 1,
      rewardMultiplier: step.rewardMultiplier ?? 1,
      attackCooldownMultiplier: step.attackCooldownMultiplier ?? 1,
      supportCooldownMultiplier: step.supportCooldownMultiplier ?? 1,
      specialCooldownMultiplier: step.specialCooldownMultiplier ?? 1,
      deployChargeBonus: step.deployChargeBonus ?? 0,
      encounterTag: state.activeEncounter.scriptId,
    });
  }

  state.enemySpawnCooldown = Math.max(state.enemySpawnCooldown, 2.1);
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

  const displayTier = getArenaDisplayTier(state.elapsed);
  const protectedScale = enemy.protectedTimer > 0 ? (isBossKind(enemy.kind) ? 0.34 : 0.46) : 1;
  const finalDamage = damage * protectedScale;
  enemy.health = Math.max(0, enemy.health - finalDamage);
  enemy.flash = 1;
  if (enemy.protectedTimer > 0) {
    queueEffect(state, 'shield', enemy.x, enemy.y, enemy.size * 1.05, '#AEEFFF', {
      flavor: 'neutral',
      intensity: 1.06,
    });
  }
  if (
    !options?.silentEffect &&
    shouldRenderCombatHitEffect(
      state,
      options?.effectIntensity ?? 1,
      options?.effectFlavor ?? 'neutral'
    )
  ) {
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
    addUltimateCharge(state, Math.min(4.8, finalDamage * 0.05));
  }

  if (enemy.health > 0) {
    return;
  }

  state.runKillCountsByEnemy[enemy.kind] += 1;
  if (state.runFirstKillTierByEnemy[enemy.kind] === null) {
    state.runFirstKillTierByEnemy[enemy.kind] = displayTier;
  }
  state.score += enemy.reward;
  state.salvage += Math.max(7, Math.round(enemy.reward / 9.5));
  queueEffect(state, 'burst', enemy.x, enemy.y, enemy.size * 1.24, enemy.color, {
    flavor: 'enemy',
    intensity: 1.2,
  });
  if (enemy.kind === 'warden') {
    releaseProtectionLinksFromSource(state, enemy.id);
  }
  maybeSpawnEnemyDrop(state, enemy);

  if (options?.grantCharge !== false) {
    addUltimateCharge(state, Math.min(8, Math.max(2, enemy.reward / 95)));
  }

  if (options?.allowDrafts && !state.activeEncounter) {
    const grantedChoices = awardAffordableArmoryChoices(state);
    if (grantedChoices > 0) {
      state.pickupMessage = getArmoryReadyMessage(state.availableArmoryChoices);
      state.pickupTimer = 1.6;
    }
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
  if (state.overclockTimer > 0) {
    return [-58, -48, -38, -28, -18, -8, 8, 18, 28, 38, 48, 58];
  }

  const volleyCount = Math.max(1, Math.min(6, weapon.shotCount));

  switch (volleyCount) {
    case 6:
      return [-34, -20, -8, 8, 20, 34];
    case 5:
      return [-32, -16, 0, 16, 32];
    case 4:
      return [-28, -10, 10, 28];
    case 3:
      return [-22, 0, 22];
    case 1:
      return [0];
    default:
      return [-18, 18];
  }
}

function getMissileBurstWindowSeconds(state: ArenaGameState) {
  if (state.overclockTimer > 0) {
    return 0.5;
  }
  const rapidCycleCount = getRapidCycleUpgradeCount(state.weapon);
  return Math.max(0.5, 1 - rapidCycleCount * 0.1);
}

function orderMissileOffsetsForBurst(offsets: number[]) {
  return offsets.slice().sort((left, right) => Math.abs(right) - Math.abs(left) || left - right);
}

function createPlayerMissile(
  state: ArenaGameState,
  boardHeight: number,
  offset: number,
  damageScale: number
) {
  const weapon = getArenaActiveWeapon(state);
  const muzzleY = boardHeight - ARENA_PLAYER_HEIGHT - 16;
  state.playerBullets = [
    ...state.playerBullets,
    {
      id: `B${state.nextBulletId}`,
      owner: 'player',
      kind: 'missile',
      buildFlavor: 'missileCommand',
      x: state.playerX + offset,
      y: muzzleY + 5,
      vx: offset === 0 ? 0 : offset < 0 ? -120 : 120,
      vy: -560,
      homing: 6.4,
      damage: Math.max(14, Math.round(weapon.damage * 3.35 * damageScale)),
      size: Math.min(state.overclockTimer > 0 ? 13.2 : 11.4, weapon.bulletSize + (state.overclockTimer > 0 ? 1.4 : 0.9)),
      color: '#FFD8A6',
      age: 0,
      maxAge: 3.4,
      pierce: 1,
    },
  ];
  state.nextBulletId += 1;
}

function queuePlayerMissileVolley(state: ArenaGameState) {
  if ((state.pendingMissileOffsets?.length ?? 0) > 0) {
    return;
  }

  const weapon = getArenaActiveWeapon(state);
  const launchOffsets = orderMissileOffsetsForBurst(getMissileLaunchOffsets(state, weapon));
  const salvoCount = launchOffsets.length;
  const salvoDamageScale =
    state.overclockTimer > 0
      ? 0.82
      : salvoCount >= 6
        ? 0.9
        : salvoCount >= 4
          ? 0.95
          : salvoCount === 3
            ? 0.98
            : 1;
  const burstWindow = getMissileBurstWindowSeconds(state);
  const burstInterval = salvoCount <= 1 ? 0 : burstWindow / (salvoCount - 1);

  state.pendingMissileOffsets = launchOffsets;
  state.pendingMissileDamageScale = salvoDamageScale;
  state.missileBurstInterval = burstInterval;
  state.missileBurstTimer = 0;
}

function tickQueuedMissileVolley(state: ArenaGameState, boardHeight: number, deltaSeconds: number) {
  if ((state.pendingMissileOffsets?.length ?? 0) <= 0) {
    return;
  }

  state.missileBurstTimer -= deltaSeconds;
  while (state.pendingMissileOffsets.length > 0 && state.missileBurstTimer <= 0) {
    const nextOffset = state.pendingMissileOffsets.shift();
    if (nextOffset === undefined) {
      break;
    }

    createPlayerMissile(state, boardHeight, nextOffset, state.pendingMissileDamageScale);
    if (state.pendingMissileOffsets.length > 0) {
      state.missileBurstTimer += Math.max(0.04, state.missileBurstInterval);
    } else {
      state.missileBurstTimer = 0;
      state.missileBurstInterval = 0;
      state.pendingMissileDamageScale = 1;
    }
  }
}

function createPlayerMissileVolleyInstant(state: ArenaGameState, boardHeight: number) {
  const weapon = getArenaActiveWeapon(state);
  const launchOffsets = orderMissileOffsetsForBurst(getMissileLaunchOffsets(state, weapon));
  const salvoCount = launchOffsets.length;
  const salvoDamageScale =
    state.overclockTimer > 0
      ? 0.82
      : salvoCount >= 6
        ? 0.9
        : salvoCount >= 4
          ? 0.95
          : salvoCount === 3
            ? 0.98
            : 1;
  for (const offset of launchOffsets) {
    createPlayerMissile(state, boardHeight, offset, salvoDamageScale);
  }
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
  queueEffect(state, 'fractureBits', x, y, 34, '#CDE5FF', {
    flavor: 'fractureCore',
    intensity: 1.16,
    angle: Math.random() * Math.PI * 2,
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
    const fractureJitter = state.activeBuild === 'fractureCore' ? (Math.random() - 0.5) * 0.08 : 0;
    const fractureOffsetFactor = state.activeBuild === 'fractureCore' ? 0.9 + Math.random() * 0.25 : 1;
    const fractureOffset = state.activeBuild === 'fractureCore' ? (Math.random() - 0.5) * weapon.spread * 0.22 : 0;
    const shotAngle =
      state.activeBuild === 'novaBloom'
        ? lane * 0.09
        : state.activeBuild === 'fractureCore'
          ? lane * 0.08 + fractureJitter
          : state.activeBuild === 'railFocus'
            ? lane * 0.04
            : lane * 0.06;
    const x =
      state.playerX +
      lane * weapon.spread * (state.activeBuild === 'novaBloom' ? 0.9 : fractureOffsetFactor) +
      fractureOffset;
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
    availableArmoryChoices: 0,
    activeBuild: ARENA_BUILD_DEFAULT,
    playerX: boardWidth / 2,
    hull: 100,
    maxHull: 100,
    shield: 42,
    maxShield: 42,
    shieldRegenCooldown: 0,
    playerFlash: 0,
    overclockTimer: 0,
    overclockVisualBlend: 0,
    ultimateCharge: 0,
    ultimateTimer: 0,
    ultimateBuild: null,
    ultimateColumns: [],
    weapon: BASE_ARENA_WEAPON,
    enemies: [],
    drops: [],
    hazards: [],
    playerBullets: [],
    enemyBullets: [],
    effects: [],
    fireCooldown: 0.06,
    missileCooldown: 0.45,
    missileBurstTimer: 0,
    missileBurstInterval: 0,
    pendingMissileOffsets: [],
    pendingMissileDamageScale: 1,
    enemySpawnCooldown: 1.3,
    nextBulletId: 1,
    nextEnemyId: 1,
    nextDropId: 1,
    nextHazardId: 1,
    nextEffectId: 1,
    pickupMessage: 'Enemies are active now. Catch drops and spend salvage on armory drafts.',
    pickupTimer: 3.4,
    activeEncounter: null,
    lastProcessedDisplayTier: 1,
    encounterAnnouncement: 'Arena live',
    encounterAnnouncementColor: '#8BCBFF',
    encounterAnnouncementTimer: 1.5,
    bestTierReached: 1,
    runMiniBossClears: 0,
    runBossClears: 0,
    runBossClearsByEnemy: createEnemyValueMap(() => 0),
    runBuildActiveSeconds: createBuildValueMap(() => 0),
    runSeenTierByEnemy: createEnemyValueMap(() => null),
    runKillCountsByEnemy: createEnemyValueMap(() => 0),
    runFirstKillTierByEnemy: createEnemyValueMap(() => null),
    runFirstClearTierByEnemy: createEnemyValueMap(() => null),
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
    hazards: [],
    ultimateCharge: 0,
    ultimateTimer: ARENA_ULTIMATE_DURATION_SECONDS,
    ultimateBuild: previousState.activeBuild,
    ultimateColumns: buildUltimateColumns(previousState.enemies, boardWidth),
    pickupMessage: `${ARENA_BUILD_META[previousState.activeBuild].ultimateLabel} unleashed`,
    pickupTimer: 1.2,
    effects: previousState.effects,
    activeEncounter: previousState.activeEncounter ? { ...previousState.activeEncounter } : null,
    runBuildActiveSeconds: { ...previousState.runBuildActiveSeconds },
    runSeenTierByEnemy: { ...previousState.runSeenTierByEnemy },
    runKillCountsByEnemy: { ...previousState.runKillCountsByEnemy },
    runFirstKillTierByEnemy: { ...previousState.runFirstKillTierByEnemy },
    runFirstClearTierByEnemy: { ...previousState.runFirstClearTierByEnemy },
    runBossClearsByEnemy: { ...previousState.runBossClearsByEnemy },
  };

  if (previousState.activeBuild === 'railFocus') {
    const targets = nextState.enemies.slice().sort((left, right) => right.maxHealth - left.maxHealth).slice(0, 6);
    nextState.ultimateColumns = targets.map((target) => target.x);
    nextState.ultimateTimer = 0.98;
    for (const enemy of targets) {
      const damage =
        isBossKind(enemy.kind)
          ? enemy.maxHealth * 0.58 + 240
          : enemy.kind === 'interceptor'
            ? enemy.maxHealth * 0.78 + 162
            : enemy.maxHealth * 0.96 + 112;
      applyDamageToEnemy(nextState, enemy, damage, {
        allowDrafts: false,
        grantCharge: false,
        effectScale: isBossKind(enemy.kind) ? 2.15 : 1.65,
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
        effectScale: isBossKind(enemy.kind) ? 1.95 : 1.48,
        effectColor: '#FFD0E7',
        effectFlavor: 'novaBloom',
        effectIntensity: 1.3,
      });
    }
  } else if (previousState.activeBuild === 'missileCommand') {
    nextState.ultimateTimer = 1.34;
    nextState.missileCooldown = Math.min(nextState.missileCooldown, 0.08);
    nextState.pendingMissileOffsets = [];
    nextState.missileBurstTimer = 0;
    nextState.missileBurstInterval = 0;
    nextState.pendingMissileDamageScale = 1;
    const strikeColumns = buildUltimateColumns(nextState.enemies, boardWidth);
    nextState.ultimateColumns = strikeColumns;
    for (let volleyIndex = 0; volleyIndex < 3; volleyIndex += 1) {
      createPlayerMissileVolleyInstant(nextState, boardHeight);
    }
    for (const columnX of strikeColumns) {
      queueEffect(nextState, 'ultimateMissile', columnX, boardHeight - 10, boardHeight * 0.92, '#FFD8AD', {
        flavor: 'missileCommand',
        intensity: 1.48,
      });
    }
    for (const enemy of nextState.enemies) {
      const damage =
        isBossKind(enemy.kind)
          ? enemy.maxHealth * 0.36 + 168
          : enemy.kind === 'interceptor'
            ? enemy.maxHealth * 0.54 + 104
            : enemy.maxHealth * 0.58 + 70;
      applyDamageToEnemy(nextState, enemy, damage, {
        allowDrafts: false,
        grantCharge: false,
        effectScale: isBossKind(enemy.kind) ? 2.0 : 1.5,
        effectColor: '#FFD8AD',
        effectFlavor: 'missileCommand',
        effectIntensity: 1.28,
      });
    }
  } else {
    nextState.ultimateTimer = 1.38;
    const primaryFractureSize = getFractureUltimateEffectSize(boardWidth, boardHeight);
    const primaryFractureRadius = primaryFractureSize * 0.4;
    const primaryFractureCenter = getRandomFractureUltimateCenter(boardWidth, boardHeight, primaryFractureRadius);
    const echoFractureSize = primaryFractureSize * 0.54;
    const echoFractureRadius = echoFractureSize * 0.4;
    const echoFractureCenter = getRandomFractureUltimateCenter(boardWidth, boardHeight, echoFractureRadius, {
      ...primaryFractureCenter,
      radius: primaryFractureRadius,
    });
    queueEffect(
      nextState,
      'ultimateFracture',
      primaryFractureCenter.x,
      primaryFractureCenter.y,
      primaryFractureSize,
      '#C7DCFF',
      {
        flavor: 'fractureCore',
        intensity: 1.5,
        angle: Math.random() * Math.PI * 2,
      }
    );
    queueEffect(
      nextState,
      'ultimateFracture',
      echoFractureCenter.x,
      echoFractureCenter.y,
      echoFractureSize,
      '#D5E7FF',
      {
        flavor: 'fractureCore',
        intensity: 1.18,
        angle: Math.random() * Math.PI * 2,
      }
    );
    let shatterBursts = 0;
    for (const enemy of nextState.enemies) {
      const damage =
        isBossKind(enemy.kind)
          ? enemy.maxHealth * 0.42 + 172
          : enemy.kind === 'interceptor'
            ? enemy.maxHealth * 0.62 + 116
            : enemy.maxHealth * 0.68 + 86;
      applyDamageToEnemy(nextState, enemy, damage, {
        allowDrafts: false,
        grantCharge: false,
        effectScale: isBossKind(enemy.kind) ? 2.04 : 1.64,
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
  if (previousState.availableArmoryChoices <= 0 || isArenaArmoryUpgradeMaxed(key, previousState.weapon)) {
    return previousState;
  }

  const definition = ARENA_ARMORY_UPGRADES[key];
  const hullBonus = definition.applyMeta?.hullBonus ?? 0;
  const shieldBonus = definition.applyMeta?.shieldBonus ?? 0;
  const nextWeapon = definition.apply(previousState.weapon);
  const remainingChoices = Math.max(0, previousState.availableArmoryChoices - 1);
  const nextMissileState = {
    ...previousState,
    weapon: nextWeapon,
  };

  return {
    ...previousState,
    weapon: nextWeapon,
    maxHull: previousState.maxHull + hullBonus,
    hull: Math.min(previousState.maxHull + hullBonus, previousState.hull + hullBonus),
    maxShield: previousState.maxShield + shieldBonus,
    shield: Math.min(previousState.maxShield + shieldBonus, previousState.shield + shieldBonus),
    availableArmoryChoices: remainingChoices,
    fireCooldown:
      previousState.activeBuild === 'missileCommand'
        ? previousState.fireCooldown
        : Math.min(previousState.fireCooldown, nextWeapon.fireInterval),
    missileCooldown:
      previousState.activeBuild === 'missileCommand'
        ? Math.min(previousState.missileCooldown, getMissileIntervalSeconds(nextMissileState))
        : previousState.missileCooldown,
    pickupMessage:
      remainingChoices > 0
        ? `${definition.label} installed. ${getArmoryReadyMessage(remainingChoices)}`
        : `${definition.label} installed`,
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
    missileCooldown: nextBuild === 'missileCommand' ? 0.32 : previousState.missileCooldown,
    missileBurstTimer: 0,
    missileBurstInterval: 0,
    pendingMissileOffsets: [],
    pendingMissileDamageScale: 1,
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
  const nextOverclockTimer = Math.max(0, previousState.overclockTimer - deltaSeconds);
  const previousOverclockBlend =
    previousState.overclockVisualBlend ?? (previousState.overclockTimer > 0 ? 1 : 0);
  const overclockBlendTarget = nextOverclockTimer > 0 ? 1 : 0;
  const overclockBlendRate =
    overclockBlendTarget > previousOverclockBlend ? 9.2 : 7.8;
  const nextOverclockVisualBlend =
    overclockBlendTarget > previousOverclockBlend
      ? Math.min(1, previousOverclockBlend + deltaSeconds * overclockBlendRate)
      : Math.max(0, previousOverclockBlend - deltaSeconds * overclockBlendRate);

  const nextState: ArenaGameState = {
    ...previousState,
    elapsed: previousState.elapsed + deltaSeconds,
    salvage: previousState.salvage,
    hull: previousState.hull,
    shield: previousState.shield,
    shieldRegenCooldown: Math.max(0, previousState.shieldRegenCooldown - deltaSeconds),
    playerFlash: Math.max(0, previousState.playerFlash - deltaSeconds * 4.5),
    overclockTimer: nextOverclockTimer,
    overclockVisualBlend: nextOverclockVisualBlend,
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
    missileBurstTimer: previousState.missileBurstTimer ?? 0,
    missileBurstInterval: previousState.missileBurstInterval ?? 0,
    pendingMissileOffsets: [...(previousState.pendingMissileOffsets ?? [])],
    pendingMissileDamageScale: previousState.pendingMissileDamageScale ?? 1,
    enemySpawnCooldown: previousState.enemySpawnCooldown - deltaSeconds,
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    hazards: previousState.hazards.map((hazard) => ({ ...hazard })),
    weapon: previousState.weapon,
    activeEncounter: previousState.activeEncounter ? { ...previousState.activeEncounter } : null,
    nextHazardId: previousState.nextHazardId,
    bestTierReached: previousState.bestTierReached,
    runMiniBossClears: previousState.runMiniBossClears,
    runBossClears: previousState.runBossClears,
    runBossClearsByEnemy: { ...previousState.runBossClearsByEnemy },
    runBuildActiveSeconds: { ...previousState.runBuildActiveSeconds },
    runSeenTierByEnemy: { ...previousState.runSeenTierByEnemy },
    runKillCountsByEnemy: { ...previousState.runKillCountsByEnemy },
    runFirstKillTierByEnemy: { ...previousState.runFirstKillTierByEnemy },
    runFirstClearTierByEnemy: { ...previousState.runFirstClearTierByEnemy },
  };

  if (nextState.status !== 'running') {
    return nextState;
  }

  if (nextState.activeBuild === 'missileCommand') {
    nextState.fireCooldown = 0;
  } else {
    nextState.pendingMissileOffsets = [];
    nextState.missileBurstTimer = 0;
    nextState.missileBurstInterval = 0;
    nextState.pendingMissileDamageScale = 1;
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
  nextState.bestTierReached = Math.max(previousState.bestTierReached, displayTier);
  nextState.runBuildActiveSeconds[nextState.activeBuild] += deltaSeconds;
  if (nextState.activeBuild !== 'missileCommand') {
    while (nextState.fireCooldown <= 0) {
      createPlayerVolley(nextState, boardHeight);
    }
  } else {
    tickQueuedMissileVolley(nextState, boardHeight, deltaSeconds);
    while (nextState.missileCooldown <= 0 && nextState.pendingMissileOffsets.length === 0) {
      queuePlayerMissileVolley(nextState);
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
      nextState.enemySpawnCooldown += getArenaSpawnCooldown(
        displayTier,
        nextState.enemies.length,
        nextState.enemyBullets.length
      );
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
    const hadReachedCruise = enemy.inFormation || enemy.y >= enemy.cruiseY;
    const minX = enemy.size / 2 + 8;
    const maxX = boardWidth - enemy.size / 2 - 8;
    const minY = enemy.size / 2 + 10;
    const maxY = getEnemyZoneMaxY(boardHeight) - enemy.size / 2 - 10;
    let nextEnemy: ArenaEnemy = {
      ...enemy,
      flash: Math.max(0, enemy.flash - deltaSeconds * 4.5),
      attackCooldown: enemy.attackCooldown - deltaSeconds,
      windupTimer: Math.max(0, enemy.windupTimer - deltaSeconds),
      supportCooldown: Math.max(0, enemy.supportCooldown - deltaSeconds),
      specialCooldown: Math.max(0, enemy.specialCooldown - deltaSeconds),
      protectedTimer: Math.max(0, enemy.protectedTimer - deltaSeconds),
      inFormation: hadReachedCruise,
      phase:
        enemy.phase +
          deltaSeconds *
          (enemy.kind === 'hover'
            ? 2.4
            : enemy.kind === 'burst'
              ? 1.9
              : enemy.kind === 'tank'
                ? 0.8
                : enemy.kind === 'orbiter'
                  ? 2.2
                  : enemy.kind === 'sniper'
                    ? 0.9
                    : enemy.kind === 'bomber'
                      ? 1.2
                      : enemy.kind === 'warden'
                        ? 1.05
                        : enemy.kind === 'lancer'
                          ? 1.9
                          : enemy.kind === 'carrier'
                            ? 0.92
                            : enemy.kind === 'artillery'
                              ? 0.62
                              : enemy.kind === 'interceptor'
                                ? 2.6
                                : enemy.kind === 'prismBoss'
                                  ? 0.75
                                  : enemy.kind === 'hiveCarrierBoss'
                                    ? 0.68
                                    : 1),
    };
    if (nextEnemy.protectedTimer <= 0) {
      nextEnemy.protectedByEnemyId = null;
    }

    if (!hadReachedCruise) {
      nextEnemy.y = Math.min(nextEnemy.cruiseY, enemy.y + config.descendSpeed * deltaSeconds);
      nextEnemy.x = clamp(nextEnemy.x + Math.sin(nextEnemy.phase) * deltaSeconds * 12, minX, maxX);
      if (nextEnemy.y >= nextEnemy.cruiseY) {
        nextEnemy.y = nextEnemy.cruiseY;
        nextEnemy.inFormation = true;
      }
    } else {
      nextEnemy.inFormation = true;
      if (enemy.kind === 'interceptor') {
        const chaseDirection = Math.sign(nextState.playerX - nextEnemy.x);
        const desiredVx =
          chaseDirection === 0 ? 0 : chaseDirection * config.strafeSpeed * 1.2;
        const chaseBlend = Math.min(1, deltaSeconds * 4.1);
        nextEnemy.vx += (desiredVx - nextEnemy.vx) * chaseBlend;
      } else if (enemy.kind === 'lancer') {
        const targetX = nextEnemy.laneTargetX ?? nextState.playerX;
        const chaseDirection = Math.sign(targetX - nextEnemy.x);
        const desiredVx = chaseDirection === 0 ? 0 : chaseDirection * config.strafeSpeed * 0.95;
        const chaseBlend = Math.min(1, deltaSeconds * 3.6);
        nextEnemy.vx += (desiredVx - nextEnemy.vx) * chaseBlend;
      } else if (enemy.kind === 'sniper') {
        const desiredVx = clamp(nextState.playerX - nextEnemy.x, -1, 1) * config.strafeSpeed * 0.45;
        const settleBlend = Math.min(1, deltaSeconds * 1.9);
        nextEnemy.vx += (desiredVx - nextEnemy.vx) * settleBlend;
      } else if (enemy.kind === 'tank') {
        const slowDrift = Math.sign(nextEnemy.vx || 1) * config.strafeSpeed * 0.72;
        nextEnemy.vx += (slowDrift - nextEnemy.vx) * Math.min(1, deltaSeconds * 0.9);
      } else if (enemy.kind === 'warden') {
        const settleTarget = Math.sign(nextEnemy.vx || 1) * config.strafeSpeed * 0.42;
        nextEnemy.vx += (settleTarget - nextEnemy.vx) * Math.min(1, deltaSeconds * 1.25);
      } else if (enemy.kind === 'carrier') {
        const settleTarget = Math.sign(nextEnemy.vx || 1) * config.strafeSpeed * 0.54;
        nextEnemy.vx += (settleTarget - nextEnemy.vx) * Math.min(1, deltaSeconds * 1.1);
      } else if (enemy.kind === 'artillery') {
        const holdTarget = Math.sign(nextEnemy.vx || 1) * config.strafeSpeed * 0.32;
        nextEnemy.vx += (holdTarget - nextEnemy.vx) * Math.min(1, deltaSeconds * 0.8);
      } else if (enemy.kind === 'prismBoss') {
        const prismBossPhase = getBossPhaseIndex(nextState, nextEnemy);
        const phaseSpeedMultiplier = prismBossPhase === 2 ? 1.58 : prismBossPhase === 1 ? 0.92 : 1.18;
        const figureEightVx =
          Math.sin(nextEnemy.phase * (prismBossPhase === 2 ? 0.94 : 0.72)) *
          config.strafeSpeed *
          phaseSpeedMultiplier;
        nextEnemy.vx += (figureEightVx - nextEnemy.vx) * Math.min(1, deltaSeconds * 1.2);
      } else if (enemy.kind === 'hiveCarrierBoss') {
        const hivePhase = getBossPhaseIndex(nextState, nextEnemy);
        const sweepTarget =
          Math.sin(nextEnemy.phase * (hivePhase === 2 ? 1.05 : 0.8)) *
          config.strafeSpeed *
          (hivePhase === 1 ? 0.74 : hivePhase === 2 ? 1.2 : 0.92);
        nextEnemy.vx += (sweepTarget - nextEnemy.vx) * Math.min(1, deltaSeconds * 1.05);
      }

      nextEnemy.x += nextEnemy.vx * deltaSeconds;
      if (nextEnemy.x <= minX) {
        nextEnemy.x = minX;
        nextEnemy.vx = Math.abs(nextEnemy.vx);
      } else if (nextEnemy.x >= maxX) {
        nextEnemy.x = maxX;
        nextEnemy.vx = -Math.abs(nextEnemy.vx);
      }

      switch (enemy.kind) {
        case 'hover':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 2.6) * config.bobAmplitude * 0.88;
          break;
        case 'burst':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 2.0) * config.bobAmplitude * 0.64;
          break;
        case 'tank':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 0.8) * Math.max(2, config.bobAmplitude * 0.3);
          break;
        case 'orbiter':
          nextEnemy.x = clamp(nextEnemy.x + Math.cos(nextEnemy.phase * 1.6) * deltaSeconds * 26, minX, maxX);
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 1.6) * config.bobAmplitude;
          break;
        case 'sniper':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 0.8) * 2;
          break;
        case 'bomber':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 1.15) * config.bobAmplitude * 0.56;
          break;
        case 'warden':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 1.1) * config.bobAmplitude * 0.42;
          break;
        case 'lancer':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 1.9) * config.bobAmplitude * 0.4;
          break;
        case 'carrier':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 0.95) * config.bobAmplitude * 0.48;
          break;
        case 'artillery':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 0.7) * Math.max(1.5, config.bobAmplitude * 0.28);
          break;
        case 'interceptor':
          nextEnemy.y = nextEnemy.cruiseY + Math.sin(nextEnemy.phase * 2.4) * config.bobAmplitude * 0.5;
          break;
        case 'prismBoss':
          nextEnemy.y =
            nextEnemy.cruiseY +
            Math.sin(nextEnemy.phase * (getBossPhaseIndex(nextState, nextEnemy) === 2 ? 1.24 : 0.94)) *
              config.bobAmplitude *
              (getBossPhaseIndex(nextState, nextEnemy) === 2 ? 1.85 : 1.45);
          break;
        case 'hiveCarrierBoss':
          nextEnemy.y =
            nextEnemy.cruiseY +
            Math.sin(nextEnemy.phase * (getBossPhaseIndex(nextState, nextEnemy) === 2 ? 1.14 : 0.88)) *
              config.bobAmplitude *
              (getBossPhaseIndex(nextState, nextEnemy) === 1 ? 1.58 : 1.34);
          break;
        default:
          nextEnemy.y = nextEnemy.cruiseY;
          break;
      }

      nextEnemy.y = clamp(nextEnemy.y, minY, maxY);
    }
    nextEnemy.aimAngle = getEnemyAimAngle(nextEnemy, nextState.playerX, boardHeight);

    if (nextEnemy.health <= 0) {
      movedEnemies.push(nextEnemy);
      continue;
    }

    if (previousWindup > 0 && nextEnemy.windupTimer <= 0) {
      fireEnemyPattern(nextState, nextEnemy, boardWidth, boardHeight);
    } else if (previousWindup <= 0 && nextEnemy.attackCooldown <= 0) {
      beginEnemyAttackWindup(nextState, nextEnemy, boardWidth, boardHeight, displayTier);
    }

    movedEnemies.push(nextEnemy);
  }

  processWardenSupport(nextState, movedEnemies, displayTier);
  nextState.enemies = movedEnemies;
  processCarrierDeployments(nextState, boardWidth, boardHeight, displayTier);
  const survivingEnemies = nextState.enemies;
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
        (enemy.kind === 'interceptor' || isBossKind(enemy.kind) || enemy.windupTimer > 0)
      ) {
        hitDamage *= 1.58;
        railPrecisionHit = true;
      }
      if (nextState.activeBuild === 'fractureCore' && activeBullet.kind === 'primary') {
        hitDamage *= 1.16;
      }
      const useCustomImpactEffect = activeBullet.kind === 'missile' || activeBullet.buildFlavor === 'fractureCore';

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
        silentEffect: useCustomImpactEffect,
      });

      if (railPrecisionHit) {
        addUltimateCharge(nextState, 0.45);
      }

      if (nextState.activeBuild === 'fractureCore' && activeBullet.kind === 'primary' && !triggeredFracture) {
        triggeredFracture = true;
        queueEffect(nextState, 'fractureBits', activeBullet.x, activeBullet.y, activeBullet.size * 5.8, '#D4E8FF', {
          flavor: 'fractureCore',
          intensity: 1.36,
          angle: Math.random() * Math.PI * 2,
        });
        createFractureShards(nextState, activeBullet.x, activeBullet.y, hitDamage * 1.1);
        const fracturePulseRadius = 66;
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
            silentEffect: true,
          });
        }
      }

      if (activeBullet.kind === 'shard') {
        const fragmentSplashRadius = 44;
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
            silentEffect: true,
          });
        }
        queueEffect(nextState, 'fractureBits', activeBullet.x, activeBullet.y, activeBullet.size * 4.6, '#D8EAFF', {
          flavor: 'fractureCore',
          intensity: 1.18,
          angle: Math.random() * Math.PI * 2,
        });
      }

      if (activeBullet.kind === 'missile') {
        const splashRadius = nextState.activeBuild === 'missileCommand' ? 66 : 52;
        const splashDamageScale = nextState.activeBuild === 'missileCommand' ? 0.84 : 0.58;
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
            silentEffect: true,
          });
        }
        if (shouldRenderCombatHitEffect(nextState, 1.22, 'missileCommand')) {
          queueEffect(nextState, 'burst', activeBullet.x, activeBullet.y, 44, '#FFD9AE', {
            flavor: 'missileCommand',
            intensity: 1.2,
          });
        }
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
    const nextAge = bullet.age + deltaSeconds;
    const driftOffsetX =
      bullet.driftAmp && bullet.driftFreq
        ? Math.sin(nextAge * bullet.driftFreq + (bullet.driftPhase ?? 0)) *
          bullet.driftAmp *
          deltaSeconds
        : 0;
    const driftOffsetY =
      bullet.enemyStyle === 'wave' && bullet.driftAmp && bullet.driftFreq
        ? Math.cos(nextAge * bullet.driftFreq * 0.58 + (bullet.driftPhase ?? 0)) *
          bullet.driftAmp *
          0.12 *
          deltaSeconds
        : 0;
    const nextBullet: ArenaProjectile = {
      ...bullet,
      x: bullet.x + bullet.vx * deltaSeconds + driftOffsetX,
      y: bullet.y + bullet.vy * deltaSeconds + driftOffsetY,
      age: nextAge,
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
        nextState.hazards = [];
        return nextState;
      }
      continue;
    }

    survivingEnemyBullets.push(nextBullet);
  }

  nextState.enemyBullets = survivingEnemyBullets;
  tickHazards(nextState, boardWidth, boardHeight, deltaSeconds);
  if (nextState.status !== 'running') {
    return nextState;
  }
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
        if (nextState.activeBuild === 'missileCommand') {
          nextState.missileCooldown = Math.min(nextState.missileCooldown, getMissileIntervalSeconds(nextState));
        } else {
          nextState.fireCooldown = Math.min(nextState.fireCooldown, getArenaActiveWeapon(nextState).fireInterval);
        }
        nextState.pickupMessage = 'Overdrive engaged';
      } else {
        nextState.salvage += 55;
        const grantedChoices = !nextState.activeEncounter ? awardAffordableArmoryChoices(nextState) : 0;
        nextState.pickupMessage =
          grantedChoices > 0 ? getArmoryReadyMessage(nextState.availableArmoryChoices) : 'Salvage burst secured';
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
  maybeAdvanceBossPhase(nextState, boardWidth, boardHeight);

  if (nextState.activeEncounter) {
    const anchorAlive = nextState.activeEncounter.anchorEnemyId
      ? nextState.enemies.some((enemy) => enemy.id === nextState.activeEncounter?.anchorEnemyId)
      : nextState.enemies.some((enemy) => enemy.kind === nextState.activeEncounter?.anchorKind);
    if (!anchorAlive) {
      const completedEncounter = nextState.activeEncounter;
      nextState.activeEncounter = null;
      nextState.salvage += completedEncounter.rewardSalvage;
      addUltimateCharge(nextState, completedEncounter.type === 'boss' ? 30 : 16);
      if (nextState.runFirstClearTierByEnemy[completedEncounter.anchorKind] === null) {
        nextState.runFirstClearTierByEnemy[completedEncounter.anchorKind] = completedEncounter.startedAtTier;
      }
      if (completedEncounter.type === 'boss') {
        nextState.runBossClears += 1;
        nextState.runBossClearsByEnemy[completedEncounter.anchorKind] += 1;
      } else {
        nextState.runMiniBossClears += 1;
      }
      const salvageChoicesGranted = awardAffordableArmoryChoices(nextState);
      let bonusChoicesGranted = 0;
      clearEncounterHazards(nextState, completedEncounter.scriptId);
      if (completedEncounter.type === 'boss') {
        nextState.enemyBullets = [];
        bonusChoicesGranted = awardBossArmoryChoice(nextState);
      }
      const armoryReadyMessage =
        salvageChoicesGranted + bonusChoicesGranted > 0
          ? getArmoryReadyMessage(nextState.availableArmoryChoices)
          : null;
      nextState.pickupMessage =
        completedEncounter.type === 'boss'
          ? armoryReadyMessage
            ? `${completedEncounter.label} cache secured. ${armoryReadyMessage}`
            : `${completedEncounter.label} cache secured`
          : armoryReadyMessage
            ? `${completedEncounter.label} cleared. ${armoryReadyMessage}`
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
