import { useEffect, useMemo, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type AppGameId = 'defender' | 'prototype';

type EnemyShape = 'circle' | 'square' | 'diamond';
type WeaponUpgradeType = 'rapid' | 'twin' | 'heavy' | 'pierce' | 'focus' | 'chaos' | 'flare' | 'missile' | 'shatter';
type PrototypeEffectKind = 'muzzle' | 'burst' | 'pickup';
type PrototypeProjectileKind = 'standard' | 'missile' | 'shatterShell' | 'shatterShard';

type PrototypeBullet = {
  id: string;
  kind: PrototypeProjectileKind;
  x: number;
  y: number;
  angle: number;
  speed: number;
  vx: number;
  vy: number;
  damage: number;
  size: number;
  pierce: number;
  age: number;
  phase: number;
  aimAssist: number;
  color: string;
  glowColor: string;
  trailScale: number;
  curveDirection: number;
  launchDuration: number;
  turnRate: number;
  maxAge: number | null;
  burstAge: number | null;
  fragmentCount: number;
};

type PrototypeEnemy = {
  id: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  health: number;
  maxHealth: number;
  shape: EnemyShape;
  color: string;
  flash: number;
};

type PrototypeUpgrade = {
  id: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  type: WeaponUpgradeType;
  label: string;
  color: string;
  age: number;
};

type PrototypeWeapon = {
  damage: number;
  fireInterval: number;
  shotCount: number;
  pierce: number;
  bulletSize: number;
  bulletSpeed: number;
  spread: number;
  aimAssist: number;
  spreadJitter: number;
  effectIntensity: number;
  bulletColor: string;
  glowColor: string;
  muzzleColor: string;
  trailScale: number;
  missileLevel: number;
  shatterLevel: number;
};

type PrototypeEffect = {
  id: string;
  kind: PrototypeEffectKind;
  x: number;
  y: number;
  size: number;
  age: number;
  duration: number;
  color: string;
};

type EnemySpawnDraft = {
  x: number;
  shape?: EnemyShape;
  color?: string;
  sizeMultiplier?: number;
  healthMultiplier?: number;
  speedMultiplier?: number;
};

type PrototypeGameState = {
  status: 'running' | 'lost';
  elapsed: number;
  score: number;
  playerX: number;
  bullets: PrototypeBullet[];
  enemies: PrototypeEnemy[];
  upgrades: PrototypeUpgrade[];
  effects: PrototypeEffect[];
  weapon: PrototypeWeapon;
  fireCooldown: number;
  missileCooldown: number;
  shatterCooldown: number;
  enemyCooldown: number;
  upgradeCooldown: number;
  nextBulletId: number;
  nextEnemyId: number;
  nextUpgradeId: number;
  nextEffectId: number;
  pickupMessage: string | null;
  pickupTimer: number;
  collectedUpgradeCount: number;
};

type PrototypeShooterScreenProps = {
  onSwitchGame: (game: AppGameId) => void;
};

const PLAYER_HALF_WIDTH = 22;
const PLAYER_RENDER_HALF_WIDTH = 28;
const PLAYER_HEIGHT = 28;
const PLAYER_MARGIN = 14;
const PLAYER_FLOOR_OFFSET = 14;
const MAX_FRAME_DELTA_SECONDS = 0.1;
const FIXED_STEP_SECONDS = 1 / 60;
const MAX_CATCH_UP_STEPS = 5;
const MAX_ACTIVE_EFFECTS = 28;
const MAX_ENEMY_RENDER_SIZE = 92;
const DIFFICULTY_TIER_DURATION_SECONDS = 15;
const MAX_STRAIGHT_GUNS = 3;
const MAX_MISSILE_LEVEL = 2;
const OPENING_UPGRADE_TYPES: WeaponUpgradeType[] = ['rapid', 'twin', 'heavy'];
const STANDARD_UPGRADE_TYPES: WeaponUpgradeType[] = [
  'rapid',
  'twin',
  'heavy',
  'pierce',
  'focus',
  'chaos',
  'chaos',
  'flare',
  'flare',
  'missile',
  'missile',
  'shatter',
  'shatter',
];
const BASE_WEAPON: PrototypeWeapon = {
  damage: 1,
  fireInterval: 0.1,
  shotCount: 1,
  pierce: 0,
  bulletSize: 8,
  bulletSpeed: 760,
  spread: 15,
  aimAssist: 0,
  spreadJitter: 0,
  effectIntensity: 1,
  bulletColor: '#EEFBFF',
  glowColor: '#79DFFF',
  muzzleColor: '#F4FCFF',
  trailScale: 1,
  missileLevel: 0,
  shatterLevel: 0,
};

const UPGRADE_DEFINITIONS: Record<
  WeaponUpgradeType,
  {
    label: string;
    color: string;
    accent: string;
    apply: (weapon: PrototypeWeapon) => PrototypeWeapon;
  }
> = {
  rapid: {
    label: 'Rapid',
    color: '#6BD6FF',
    accent: '#DCF8FF',
    apply: (weapon) => ({
      ...weapon,
      fireInterval: Math.max(0.045, weapon.fireInterval * 0.84),
    }),
  },
  twin: {
    label: 'Twin',
    color: '#9D89FF',
    accent: '#EEE8FF',
    apply: (weapon) => ({
      ...weapon,
      shotCount: Math.min(MAX_STRAIGHT_GUNS, weapon.shotCount + 1),
      spread: Math.min(28, weapon.spread + 2),
    }),
  },
  heavy: {
    label: 'Heavy',
    color: '#FFAA66',
    accent: '#FFF0DF',
    apply: (weapon) => ({
      ...weapon,
      damage: Math.min(12, weapon.damage + 1),
      bulletSize: Math.min(13, weapon.bulletSize + 0.45),
    }),
  },
  pierce: {
    label: 'Pierce',
    color: '#7AF5C5',
    accent: '#E7FFF4',
    apply: (weapon) => ({
      ...weapon,
      pierce: Math.min(4, weapon.pierce + 1),
    }),
  },
  focus: {
    label: 'Focus',
    color: '#FF7ABD',
    accent: '#FFE3F1',
    apply: (weapon) => ({
      ...weapon,
      bulletSpeed: Math.min(1100, weapon.bulletSpeed + 95),
      damage: Math.min(12, weapon.damage + 1),
      aimAssist: Math.min(0.34, weapon.aimAssist + 0.09),
      effectIntensity: Math.min(1.8, weapon.effectIntensity + 0.08),
      bulletColor: '#FFE1F4',
      glowColor: '#FF7ABD',
      muzzleColor: '#FFE3F1',
    }),
  },
  chaos: {
    label: 'Chaos',
    color: '#FF9B55',
    accent: '#FFF0DE',
    apply: (weapon) => ({
      ...weapon,
      shotCount: Math.min(MAX_STRAIGHT_GUNS, weapon.shotCount + 1),
      spread: Math.min(40, weapon.spread + 5),
      spreadJitter: Math.min(14, weapon.spreadJitter + 3.5),
      effectIntensity: Math.min(2.1, weapon.effectIntensity + 0.3),
      bulletColor: '#FFF0C9',
      glowColor: '#FF9B55',
      muzzleColor: '#FFD5B1',
      trailScale: Math.min(1.8, weapon.trailScale + 0.18),
    }),
  },
  flare: {
    label: 'Flare',
    color: '#FFD55C',
    accent: '#FFF7D4',
    apply: (weapon) => ({
      ...weapon,
      damage: Math.min(12, weapon.damage + 1),
      bulletSize: Math.min(14, weapon.bulletSize + 0.7),
      effectIntensity: Math.min(2.1, weapon.effectIntensity + 0.24),
      bulletColor: '#FFF8C9',
      glowColor: '#FFC84E',
      muzzleColor: '#FFF0B0',
      trailScale: Math.min(1.9, weapon.trailScale + 0.12),
    }),
  },
  missile: {
    label: 'Missile',
    color: '#FF7B63',
    accent: '#FFE2DB',
    apply: (weapon) => ({
      ...weapon,
      missileLevel: Math.min(MAX_MISSILE_LEVEL, weapon.missileLevel + 1),
      effectIntensity: Math.min(2.25, weapon.effectIntensity + 0.16),
    }),
  },
  shatter: {
    label: 'Shatter',
    color: '#FFB86B',
    accent: '#FFF1D8',
    apply: (weapon) => ({
      ...weapon,
      shatterLevel: Math.min(3, weapon.shatterLevel + 1),
      effectIntensity: Math.min(2.3, weapon.effectIntensity + 0.22),
    }),
  },
};

const ENEMY_PALETTE = [
  '#6DEBFF',
  '#FF9E7A',
  '#C6B4FF',
  '#FF6F91',
  '#F4CC66',
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function normalizeAngle(angle: number) {
  let nextAngle = angle;
  while (nextAngle > Math.PI) {
    nextAngle -= Math.PI * 2;
  }
  while (nextAngle < -Math.PI) {
    nextAngle += Math.PI * 2;
  }
  return nextAngle;
}

function getDifficultyTier(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds / DIFFICULTY_TIER_DURATION_SECONDS);
}

function getUpgradePressureMultiplier(collectedUpgradeCount: number) {
  return Math.min(24, Math.pow(1.18, collectedUpgradeCount));
}

function getTimePressureMultiplier(difficultyTier: number) {
  return Math.pow(1.24, difficultyTier);
}

function getUpgradeSpeedPenalty(collectedUpgradeCount: number) {
  return 1 - Math.min(0.18, collectedUpgradeCount * 0.014);
}

function getHealthSpeedPenalty(maxHealth: number) {
  return 1 - Math.min(0.38, Math.sqrt(maxHealth) * 0.018);
}

function getPlayerShipTop(boardHeight: number) {
  return Math.max(0, boardHeight - PLAYER_HEIGHT - PLAYER_FLOOR_OFFSET);
}

function createInitialState(boardWidth: number, boardHeight: number): PrototypeGameState {
  return {
    status: 'running',
    elapsed: 0,
    score: 0,
    playerX: boardWidth / 2,
    bullets: [],
    enemies: [],
    upgrades: [],
    effects: [],
    weapon: BASE_WEAPON,
    fireCooldown: 0.03,
    missileCooldown: 0.4,
    shatterCooldown: 0.9,
    enemyCooldown: 5.4,
    upgradeCooldown: 13.5,
    nextBulletId: 1,
    nextEnemyId: 1,
    nextUpgradeId: 1,
    nextEffectId: 1,
    pickupMessage: 'Drag to move. Catch falling upgrades with the ship.',
    pickupTimer: 3.5,
    collectedUpgradeCount: 0,
  };
}

function createBulletVolleys(
  state: PrototypeGameState,
  boardHeight: number
): Pick<PrototypeGameState, 'bullets' | 'nextBulletId' | 'fireCooldown'> {
  const bullets = [...state.bullets];
  let nextBulletId = state.nextBulletId;
  const centerIndex = (state.weapon.shotCount - 1) / 2;
  const muzzleY = boardHeight - PLAYER_HEIGHT - 18;
  const aimTarget = findAimAssistTarget(state.enemies, state.playerX, muzzleY);

  for (let index = 0; index < state.weapon.shotCount; index += 1) {
    const lane = index - centerIndex;
    const originX = state.playerX + lane * state.weapon.spread;
    const jitter = state.weapon.spreadJitter > 0 ? (Math.random() - 0.5) * state.weapon.spreadJitter * 0.015 : 0;
    const defaultAngle = lane * 0.085 + jitter;
    let angle = defaultAngle;
    if (aimTarget) {
      const desiredAngle = Math.atan2(aimTarget.x - originX, muzzleY - aimTarget.y);
      const angleDelta = clamp(normalizeAngle(desiredAngle - defaultAngle), -0.28, 0.28);
      angle += angleDelta * state.weapon.aimAssist;
    }
    const vx = Math.sin(angle) * state.weapon.bulletSpeed * 0.42;
    const vy = -Math.cos(angle) * state.weapon.bulletSpeed;
    bullets.push({
      id: `B${nextBulletId}`,
      kind: 'standard',
      x: originX,
      y: muzzleY,
      angle,
      speed: state.weapon.bulletSpeed,
      vx,
      vy,
      damage: state.weapon.damage,
      size: state.weapon.bulletSize,
      pierce: state.weapon.pierce,
      age: 0,
      phase: Math.random() * Math.PI * 2,
      aimAssist: state.weapon.aimAssist,
      color: state.weapon.bulletColor,
      glowColor: state.weapon.glowColor,
      trailScale: state.weapon.trailScale,
      curveDirection: 0,
      launchDuration: 0,
      turnRate: 0,
      maxAge: null,
      burstAge: null,
      fragmentCount: 0,
    });
    nextBulletId += 1;
  }

  return {
    bullets,
    nextBulletId,
    fireCooldown: state.weapon.fireInterval,
  };
}

function createPrototypeEffect(
  kind: PrototypeEffectKind,
  x: number,
  y: number,
  size: number,
  color: string,
  nextEffectId: number
): PrototypeEffect {
  const duration = kind === 'muzzle' ? 0.12 : kind === 'pickup' ? 0.42 : 0.28;
  return {
    id: `FX${nextEffectId}`,
    kind,
    x,
    y,
    size,
    age: 0,
    duration,
    color,
  };
}

function getMissileVolleyCooldown(weapon: PrototypeWeapon) {
  return Math.max(1.2, 2.55 - weapon.missileLevel * 0.26 - weapon.effectIntensity * 0.08);
}

function getShatterVolleyCooldown(weapon: PrototypeWeapon) {
  return Math.max(1.45, 2.9 - weapon.shatterLevel * 0.34 - weapon.effectIntensity * 0.08);
}

function createMissileVolley(
  state: PrototypeGameState,
  boardHeight: number
): Pick<PrototypeGameState, 'bullets' | 'nextBulletId' | 'missileCooldown'> & {
  launchPoints: { x: number; y: number; color: string; size: number }[];
} {
  const bullets = [...state.bullets];
  let nextBulletId = state.nextBulletId;
  const muzzleY = boardHeight - PLAYER_HEIGHT - 14;
  const slots = [-1, 1];
  const launchPoints: { x: number; y: number; color: string; size: number }[] = [];
  const missileSpeed = Math.min(940, state.weapon.bulletSpeed * 0.8 + 105 + state.weapon.missileLevel * 28);
  const missileDamage = state.weapon.damage + 2 + state.weapon.missileLevel * 2;
  const missileSize = state.weapon.bulletSize + 3.2;

  for (const slot of slots) {
    const curveDirection = Math.sign(slot);
    const originX = state.playerX + slot * 18;
    const angle = curveDirection * 1.42;
    bullets.push({
      id: `B${nextBulletId}`,
      kind: 'missile',
      x: originX,
      y: muzzleY + 2,
      angle,
      speed: missileSpeed,
      vx: Math.sin(angle) * missileSpeed * 0.42,
      vy: -Math.cos(angle) * missileSpeed,
      damage: missileDamage,
      size: missileSize,
      pierce: state.weapon.pierce,
      age: 0,
      phase: Math.random() * Math.PI * 2,
      aimAssist: Math.max(0.18, state.weapon.aimAssist + 0.12 + state.weapon.missileLevel * 0.03),
      color: '#FFE8D8',
      glowColor: '#FF7B63',
      trailScale: Math.max(1.45, state.weapon.trailScale + 0.38),
      curveDirection,
      launchDuration: 0.34 + Math.random() * 0.06,
      turnRate: 0.36 + state.weapon.missileLevel * 0.07,
      maxAge: null,
      burstAge: null,
      fragmentCount: 0,
    });
    launchPoints.push({
      x: originX,
      y: muzzleY + 2,
      color: '#FFC3B6',
      size: 16 + state.weapon.effectIntensity * 5,
    });
    nextBulletId += 1;
  }

  return {
    bullets,
    nextBulletId,
    missileCooldown: getMissileVolleyCooldown(state.weapon),
    launchPoints,
  };
}

function createShatterVolley(
  state: PrototypeGameState,
  boardHeight: number
): Pick<PrototypeGameState, 'bullets' | 'nextBulletId' | 'shatterCooldown'> & {
  launchPoint: { x: number; y: number; color: string; size: number };
} {
  const bullets = [...state.bullets];
  let nextBulletId = state.nextBulletId;
  const muzzleY = boardHeight - PLAYER_HEIGHT - 20;
  const aimTarget = findAimAssistTarget(state.enemies, state.playerX, muzzleY);
  const defaultAngle = (Math.random() - 0.5) * 0.12;
  let angle = defaultAngle;
  if (aimTarget) {
    const desiredAngle = Math.atan2(aimTarget.x - state.playerX, muzzleY - aimTarget.y);
    const angleDelta = clamp(normalizeAngle(desiredAngle - defaultAngle), -0.22, 0.22);
    angle += angleDelta * Math.min(0.18, state.weapon.aimAssist + 0.08);
  }

  const shellSpeed = Math.min(860, state.weapon.bulletSpeed * 0.74 + 70 + state.weapon.shatterLevel * 18);
  const shellSize = state.weapon.bulletSize + 4 + state.weapon.shatterLevel * 0.45;
  bullets.push({
    id: `B${nextBulletId}`,
    kind: 'shatterShell',
    x: state.playerX,
    y: muzzleY,
    angle,
    speed: shellSpeed,
    vx: Math.sin(angle) * shellSpeed * 0.42,
    vy: -Math.cos(angle) * shellSpeed,
    damage: state.weapon.damage + 2 + state.weapon.shatterLevel,
    size: shellSize,
    pierce: 0,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    aimAssist: Math.min(0.18, state.weapon.aimAssist * 0.6 + 0.06),
    color: '#FFE7C8',
    glowColor: '#FFB36B',
    trailScale: Math.max(1.25, state.weapon.trailScale + 0.22),
    curveDirection: 0,
    launchDuration: 0,
    turnRate: 0,
    maxAge: 0.72 + state.weapon.shatterLevel * 0.05,
    burstAge: 0.34 - state.weapon.shatterLevel * 0.02,
    fragmentCount: 4 + state.weapon.shatterLevel,
  });
  nextBulletId += 1;

  return {
    bullets,
    nextBulletId,
    shatterCooldown: getShatterVolleyCooldown(state.weapon),
    launchPoint: {
      x: state.playerX,
      y: muzzleY,
      color: '#FFD8A8',
      size: 18 + state.weapon.effectIntensity * 5,
    },
  };
}

function burstShatterShell(shell: PrototypeBullet, nextState: PrototypeGameState) {
  nextState.effects = trimEffects([
    ...nextState.effects,
    createPrototypeEffect('burst', shell.x, shell.y, shell.size * 1.5, shell.glowColor, nextState.nextEffectId),
  ]);
  nextState.nextEffectId += 1;

  const fragmentCount = Math.max(4, shell.fragmentCount);
  const centerAngle = clamp(shell.angle * 0.65, -0.45, 0.45);
  const shardSpeed = Math.max(420, shell.speed * 0.82);
  const shardDamage = Math.max(1, Math.round(shell.damage * 0.58));

  for (let index = 0; index < fragmentCount; index += 1) {
    const lane = index - (fragmentCount - 1) / 2;
    const angle = centerAngle + lane * 0.24 + (Math.random() - 0.5) * 0.18;
    nextState.bullets.push({
      id: `B${nextState.nextBulletId}`,
      kind: 'shatterShard',
      x: shell.x,
      y: shell.y,
      angle,
      speed: shardSpeed,
      vx: Math.sin(angle) * shardSpeed * 0.42,
      vy: -Math.cos(angle) * shardSpeed,
      damage: shardDamage,
      size: shell.size * 0.56,
      pierce: 0,
      age: 0,
      phase: Math.random() * Math.PI * 2,
      aimAssist: 0,
      color: '#FFF1D8',
      glowColor: '#FFB36B',
      trailScale: 1.18,
      curveDirection: 0,
      launchDuration: 0,
      turnRate: 0,
      maxAge: 0.46 + Math.random() * 0.08,
      burstAge: null,
      fragmentCount: 0,
    });
    nextState.nextBulletId += 1;
  }
}

function findAimAssistTarget(enemies: PrototypeEnemy[], originX: number, originY: number) {
  let bestEnemy: PrototypeEnemy | null = null;
  let bestScore = -Infinity;

  for (const enemy of enemies) {
    if (enemy.health <= 0 || enemy.y >= originY - 12) {
      continue;
    }

    const horizontalOffset = Math.abs(enemy.x - originX);
    const score = enemy.y - horizontalOffset * 0.55 + enemy.speed * 0.08;
    if (score > bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  return bestEnemy;
}

function advanceBullet(
  bullet: PrototypeBullet,
  deltaSeconds: number,
  enemies: PrototypeEnemy[]
): PrototypeBullet {
  let nextAngle = bullet.angle;
  let nextSpeed = bullet.speed;

  if (bullet.kind === 'missile') {
    if (bullet.age < bullet.launchDuration) {
      const launchProgress = clamp(bullet.age / bullet.launchDuration, 0, 1);
      if (launchProgress < 0.58) {
        const outwardProgress = launchProgress / 0.58;
        nextAngle = bullet.curveDirection * lerp(1.55, 2.9, outwardProgress);
        nextSpeed = bullet.speed * lerp(0.18, 0.32, outwardProgress);
      } else {
        const curveProgress = (launchProgress - 0.58) / 0.42;
        nextAngle = bullet.curveDirection * lerp(2.9, 0.08, curveProgress);
        nextSpeed = bullet.speed * lerp(0.32, 0.74, curveProgress);
      }
    } else {
      const target = findAimAssistTarget(enemies, bullet.x, bullet.y);
      if (target) {
        const desiredAngle = Math.atan2(target.x - bullet.x, bullet.y - target.y);
        const angleDelta = clamp(normalizeAngle(desiredAngle - bullet.angle), -0.34, 0.34);
        nextAngle = bullet.angle + angleDelta * Math.min(0.3, bullet.turnRate * deltaSeconds * 5.1);
      } else {
        const recoveryAngle = bullet.curveDirection * 0.02;
        const angleDelta = clamp(normalizeAngle(recoveryAngle - bullet.angle), -0.18, 0.18);
        nextAngle = bullet.angle + angleDelta * Math.min(0.18, bullet.turnRate * deltaSeconds * 4.6);
      }

      const cruiseAge = bullet.age - bullet.launchDuration;
      nextSpeed = bullet.speed * Math.min(1, 0.72 + cruiseAge * 1.25);
    }
  }

  if (bullet.aimAssist > 0) {
    const target = bullet.kind === 'missile' ? null : findAimAssistTarget(enemies, bullet.x, bullet.y);
    if (target) {
      const desiredAngle = Math.atan2(target.x - bullet.x, bullet.y - target.y);
      const angleDelta = clamp(normalizeAngle(desiredAngle - bullet.angle), -0.22, 0.22);
      nextAngle = bullet.angle + angleDelta * Math.min(0.24, bullet.aimAssist * deltaSeconds * 5.5);
    }
  }

  const vx = Math.sin(nextAngle) * nextSpeed * 0.42;
  const vy = -Math.cos(nextAngle) * nextSpeed;

  return {
    ...bullet,
    angle: nextAngle,
    speed: bullet.speed,
    vx,
    vy,
    x: bullet.x + vx * deltaSeconds,
    y: bullet.y + vy * deltaSeconds,
    age: bullet.age + deltaSeconds,
  };
}

function trimEffects(effects: PrototypeEffect[]) {
  if (effects.length <= MAX_ACTIVE_EFFECTS) {
    return effects;
  }
  return effects.slice(effects.length - MAX_ACTIVE_EFFECTS);
}

function getSpawnLanes(boardWidth: number) {
  const laneCount = 7;
  return Array.from({ length: laneCount }, (_, index) => ((index + 0.5) * boardWidth) / laneCount);
}

function buildEnemySpawnDrafts(state: PrototypeGameState, boardWidth: number) {
  const difficultyTier = getDifficultyTier(state.elapsed);
  const lanes = getSpawnLanes(boardWidth);
  const centerLane = Math.floor(Math.random() * lanes.length);
  const drafts: EnemySpawnDraft[] = [{ x: lanes[centerLane] }];
  let cooldown = Math.max(1.45, 4.15 - difficultyTier * 0.06 - Math.random() * 0.24);

  if (difficultyTier >= 6 && Math.random() < Math.min(0.14, 0.02 + difficultyTier * 0.012)) {
    const sideOffset = centerLane <= 1 ? 1 : centerLane >= lanes.length - 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
    drafts.push({
      x: lanes[centerLane + sideOffset],
      sizeMultiplier: 0.88,
      healthMultiplier: 0.8,
      speedMultiplier: 1.04,
    });
    cooldown += 0.42;
  }

  if (difficultyTier >= 10 && Math.random() < Math.min(0.08, 0.01 + difficultyTier * 0.006)) {
    const leftLane = Math.max(0, centerLane - 1);
    const rightLane = Math.min(lanes.length - 1, centerLane + 1);
    if (leftLane !== centerLane) {
      drafts.push({
        x: lanes[leftLane],
        sizeMultiplier: 0.86,
        healthMultiplier: 0.78,
        speedMultiplier: 1.12,
        shape: 'circle',
      });
    }
    if (rightLane !== centerLane && rightLane !== leftLane) {
      drafts.push({
        x: lanes[rightLane],
        sizeMultiplier: 0.86,
        healthMultiplier: 0.78,
        speedMultiplier: 1.12,
        shape: 'circle',
      });
    }
    cooldown += 0.56;
  }

  if (difficultyTier >= 8 && Math.random() < Math.min(0.08, 0.01 + difficultyTier * 0.008)) {
    const eliteIndex = Math.floor(Math.random() * drafts.length);
    drafts[eliteIndex] = {
      ...drafts[eliteIndex],
      shape: 'diamond',
      color: '#FF7CA2',
      sizeMultiplier: 1.14,
      healthMultiplier: 1.35,
      speedMultiplier: 0.88,
    };
    cooldown += 0.24;
  }

  return {
    cooldown,
    drafts,
  };
}

function createEnemy(
  state: PrototypeGameState,
  boardWidth: number,
  draft?: EnemySpawnDraft
): Pick<PrototypeGameState, 'enemies' | 'nextEnemyId'> {
  const difficultyTier = getDifficultyTier(state.elapsed);
  const sizeMultiplier = draft?.sizeMultiplier ?? 1;
  const healthMultiplier = draft?.healthMultiplier ?? 1;
  const speedMultiplier = draft?.speedMultiplier ?? 1;
  const baseSize = clamp((28 + difficultyTier * 1.2 + Math.random() * 12) * sizeMultiplier, 28, 74);
  const shapePool: EnemyShape[] =
    difficultyTier >= 7 ? ['circle', 'square', 'diamond'] : difficultyTier >= 4 ? ['circle', 'square'] : ['circle'];
  const shape = draft?.shape ?? randomChoice(shapePool);
  const timePressureMultiplier = getTimePressureMultiplier(difficultyTier);
  const upgradePressureMultiplier = getUpgradePressureMultiplier(state.collectedUpgradeCount);
  const upgradeSpeedPenalty = getUpgradeSpeedPenalty(state.collectedUpgradeCount);
  const maxHealth = Math.max(
    2,
    Math.round(
      (4 + difficultyTier * 6 + baseSize * 0.16 + Math.random() * 3) *
        healthMultiplier *
        timePressureMultiplier *
        upgradePressureMultiplier
    )
  );
  const size = clamp(24 + difficultyTier * 0.6 + Math.sqrt(maxHealth) * 4.1, 30, MAX_ENEMY_RENDER_SIZE);
  const healthSpeedPenalty = getHealthSpeedPenalty(maxHealth);
  const speed = (54 + difficultyTier * 4.8 + Math.random() * 16) * speedMultiplier * upgradeSpeedPenalty * healthSpeedPenalty;
  const spawnPadding = size / 2 + 12;
  const enemy: PrototypeEnemy = {
    id: `E${state.nextEnemyId}`,
    x: clamp(
      draft?.x ?? spawnPadding + Math.random() * (boardWidth - spawnPadding * 2),
      spawnPadding,
      boardWidth - spawnPadding
    ),
    y: -size * 0.8,
    size,
    speed,
    health: maxHealth,
    maxHealth,
    shape,
    color: draft?.color ?? randomChoice(ENEMY_PALETTE),
    flash: 0,
  };

  return {
    enemies: [...state.enemies, enemy],
    nextEnemyId: state.nextEnemyId + 1,
  };
}

function createUpgrade(
  state: PrototypeGameState,
  boardWidth: number
): Pick<PrototypeGameState, 'upgrades' | 'nextUpgradeId' | 'upgradeCooldown'> {
  const typePool = state.nextUpgradeId === 1 ? OPENING_UPGRADE_TYPES : STANDARD_UPGRADE_TYPES;
  const type = randomChoice(typePool);
  const definition = UPGRADE_DEFINITIONS[type];
  const size = 52;
  const upgrade: PrototypeUpgrade = {
    id: `U${state.nextUpgradeId}`,
    x: clamp(size / 2 + 10 + Math.random() * (boardWidth - size - 20), size / 2 + 10, boardWidth - size / 2 - 10),
    y: -size,
    size,
    speed: 68 + Math.random() * 20,
    type,
    label: definition.label,
    color: definition.color,
    age: 0,
  };

  return {
    upgrades: [...state.upgrades, upgrade],
    nextUpgradeId: state.nextUpgradeId + 1,
    upgradeCooldown: 18 + Math.random() * 6,
  };
}

function hitTestBulletEnemyPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  bullet: PrototypeBullet,
  enemy: PrototypeEnemy
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  let closestX = endX;
  let closestY = endY;
  if (lengthSquared > 0) {
    const t = clamp(((enemy.x - startX) * dx + (enemy.y - startY) * dy) / lengthSquared, 0, 1);
    closestX = startX + dx * t;
    closestY = startY + dy * t;
  }

  const hitDx = closestX - enemy.x;
  const hitDy = closestY - enemy.y;
  const enemyRadius = enemy.size * 0.42;
  const collisionRadius = enemyRadius + bullet.size * 0.6;
  return hitDx * hitDx + hitDy * hitDy <= collisionRadius * collisionRadius;
}

function hitTestUpgradePickup(playerX: number, boardHeight: number, upgrade: PrototypeUpgrade) {
  const playerLeft = playerX - PLAYER_HALF_WIDTH;
  const playerTop = getPlayerShipTop(boardHeight);
  const playerRight = playerLeft + PLAYER_HALF_WIDTH * 2;
  const playerBottom = playerTop + PLAYER_HEIGHT;
  const closestX = clamp(upgrade.x, playerLeft, playerRight);
  const closestY = clamp(upgrade.y, playerTop, playerBottom);
  const dx = upgrade.x - closestX;
  const dy = upgrade.y - closestY;
  const pickupRadius = upgrade.size * 0.42;
  return dx * dx + dy * dy <= pickupRadius * pickupRadius;
}

function tickPrototypeState(
  previousState: PrototypeGameState,
  deltaSeconds: number,
  boardWidth: number,
  boardHeight: number
): PrototypeGameState {
  const nextState: PrototypeGameState = {
    ...previousState,
    elapsed: previousState.elapsed + deltaSeconds,
    bullets: previousState.bullets.map((bullet) => advanceBullet(bullet, deltaSeconds, previousState.enemies)),
    enemies: previousState.enemies.map((enemy) => ({
      ...enemy,
      y: enemy.y + enemy.speed * deltaSeconds,
      flash: Math.max(0, enemy.flash - deltaSeconds * 4.6),
    })),
    upgrades: previousState.upgrades.map((upgrade) => ({
      ...upgrade,
      y: upgrade.y + upgrade.speed * deltaSeconds,
      age: upgrade.age + deltaSeconds,
    })),
    effects: previousState.effects
      .map((effect) => ({
        ...effect,
        age: effect.age + deltaSeconds,
      }))
      .filter((effect) => effect.age < effect.duration),
    fireCooldown: previousState.fireCooldown - deltaSeconds,
    missileCooldown: previousState.missileCooldown - deltaSeconds,
    shatterCooldown: previousState.shatterCooldown - deltaSeconds,
    enemyCooldown: previousState.enemyCooldown - deltaSeconds,
    upgradeCooldown:
      previousState.upgrades.length < 2 ? previousState.upgradeCooldown - deltaSeconds : previousState.upgradeCooldown,
    pickupTimer: Math.max(0, previousState.pickupTimer - deltaSeconds),
  };

  if (nextState.pickupTimer <= 0) {
    nextState.pickupMessage = null;
  }

  while (nextState.fireCooldown <= 0) {
    const volley = createBulletVolleys(nextState, boardHeight);
    nextState.bullets = volley.bullets;
    nextState.nextBulletId = volley.nextBulletId;
    nextState.fireCooldown += volley.fireCooldown;
    nextState.effects = trimEffects([
      ...nextState.effects,
      createPrototypeEffect(
        'muzzle',
        nextState.playerX,
        boardHeight - PLAYER_HEIGHT - 18,
        (16 + nextState.weapon.shotCount * 4) * nextState.weapon.effectIntensity,
        nextState.weapon.muzzleColor,
        nextState.nextEffectId
      ),
    ]);
    nextState.nextEffectId += 1;

    if (nextState.weapon.effectIntensity >= 1.35) {
      const sparkCount = Math.min(2, Math.floor((nextState.weapon.effectIntensity - 1.15) * 2));
      for (let index = 0; index < sparkCount; index += 1) {
        nextState.effects = trimEffects([
          ...nextState.effects,
          createPrototypeEffect(
            'muzzle',
            nextState.playerX + (Math.random() - 0.5) * (12 + nextState.weapon.spread * 0.4),
            boardHeight - PLAYER_HEIGHT - 20 - Math.random() * 6,
            (10 + nextState.weapon.shotCount * 2) * (0.85 + nextState.weapon.effectIntensity * 0.16),
            nextState.weapon.glowColor,
            nextState.nextEffectId
          ),
        ]);
        nextState.nextEffectId += 1;
      }
    }
  }

  if (nextState.weapon.missileLevel > 0) {
    while (nextState.missileCooldown <= 0) {
      const missileVolley = createMissileVolley(nextState, boardHeight);
      nextState.bullets = missileVolley.bullets;
      nextState.nextBulletId = missileVolley.nextBulletId;
      nextState.missileCooldown += missileVolley.missileCooldown;
      for (const launchPoint of missileVolley.launchPoints) {
        nextState.effects = trimEffects([
          ...nextState.effects,
          createPrototypeEffect(
            'muzzle',
            launchPoint.x,
            launchPoint.y,
            launchPoint.size,
            launchPoint.color,
            nextState.nextEffectId
          ),
        ]);
        nextState.nextEffectId += 1;
      }
    }
  }

  if (nextState.weapon.shatterLevel > 0) {
    while (nextState.shatterCooldown <= 0) {
      const shatterVolley = createShatterVolley(nextState, boardHeight);
      nextState.bullets = shatterVolley.bullets;
      nextState.nextBulletId = shatterVolley.nextBulletId;
      nextState.shatterCooldown += shatterVolley.shatterCooldown;
      nextState.effects = trimEffects([
        ...nextState.effects,
        createPrototypeEffect(
          'muzzle',
          shatterVolley.launchPoint.x,
          shatterVolley.launchPoint.y,
          shatterVolley.launchPoint.size,
          shatterVolley.launchPoint.color,
          nextState.nextEffectId
        ),
      ]);
      nextState.nextEffectId += 1;
    }
  }

  while (nextState.enemyCooldown <= 0) {
    const spawnGroup = buildEnemySpawnDrafts(nextState, boardWidth);
    for (const draft of spawnGroup.drafts) {
      const spawn = createEnemy(nextState, boardWidth, draft);
      nextState.enemies = spawn.enemies;
      nextState.nextEnemyId = spawn.nextEnemyId;
    }
    nextState.enemyCooldown += spawnGroup.cooldown;
  }

  if (nextState.upgrades.length < 2) {
    while (nextState.upgradeCooldown <= 0) {
      const spawn = createUpgrade(nextState, boardWidth);
      nextState.upgrades = spawn.upgrades;
      nextState.nextUpgradeId = spawn.nextUpgradeId;
      nextState.upgradeCooldown += spawn.upgradeCooldown;
    }
  }

  const survivingBullets: PrototypeBullet[] = [];
  const survivingEnemies = [...nextState.enemies];

  for (const bullet of nextState.bullets) {
    let activeBullet: PrototypeBullet | null = bullet;

    if (bullet.maxAge !== null && bullet.age >= bullet.maxAge) {
      if (bullet.kind === 'shatterShell') {
        burstShatterShell(bullet, nextState);
      }
      continue;
    }

    if (
      bullet.y < -bullet.size * 3 ||
      bullet.x < -40 ||
      bullet.x > boardWidth + 40 ||
      bullet.y > boardHeight + 40
    ) {
      continue;
    }

    for (const enemy of survivingEnemies) {
      if (enemy.health <= 0 || !activeBullet) {
        continue;
      }

      const previousBulletX = activeBullet.x - activeBullet.vx * deltaSeconds;
      const previousBulletY = activeBullet.y - activeBullet.vy * deltaSeconds;
      if (!hitTestBulletEnemyPath(previousBulletX, previousBulletY, activeBullet.x, activeBullet.y, activeBullet, enemy)) {
        continue;
      }

      enemy.health = Math.max(0, enemy.health - activeBullet.damage);
      enemy.flash = 1;

      if (enemy.health <= 0) {
        nextState.score += enemy.maxHealth * 10;
        nextState.effects = trimEffects([
          ...nextState.effects,
          createPrototypeEffect('burst', enemy.x, enemy.y, enemy.size * 1.2, enemy.color, nextState.nextEffectId),
        ]);
        nextState.nextEffectId += 1;
      }

      if (activeBullet.kind === 'shatterShell') {
        burstShatterShell(activeBullet, nextState);
        activeBullet = null;
        continue;
      }

      if (activeBullet.pierce > 0) {
        activeBullet = {
          ...activeBullet,
          pierce: activeBullet.pierce - 1,
        };
      } else {
        activeBullet = null;
      }
    }

    if (activeBullet) {
      survivingBullets.push(activeBullet);
    }
  }

  nextState.bullets = survivingBullets;
  nextState.enemies = survivingEnemies.filter((enemy) => enemy.health > 0 && enemy.y - enemy.size / 2 < boardHeight + 30);
  const remainingUpgrades: PrototypeUpgrade[] = [];
  for (const upgrade of nextState.upgrades) {
    if (upgrade.y - upgrade.size / 2 >= boardHeight + 12) {
      continue;
    }

    if (hitTestUpgradePickup(nextState.playerX, boardHeight, upgrade)) {
      const definition = UPGRADE_DEFINITIONS[upgrade.type];
      const previousMissileLevel = nextState.weapon.missileLevel;
      const previousShatterLevel = nextState.weapon.shatterLevel;
      nextState.weapon = definition.apply(nextState.weapon);
      nextState.collectedUpgradeCount += 1;
      if (nextState.weapon.missileLevel > previousMissileLevel) {
        nextState.missileCooldown = Math.min(nextState.missileCooldown, 0.24);
      }
      if (nextState.weapon.shatterLevel > previousShatterLevel) {
        nextState.shatterCooldown = Math.min(nextState.shatterCooldown, 0.3);
      }
      nextState.pickupMessage = `${definition.label} upgrade secured`;
      nextState.pickupTimer = 1.8;
      nextState.score += 25;
      nextState.effects = trimEffects([
        ...nextState.effects,
        createPrototypeEffect('pickup', upgrade.x, upgrade.y, upgrade.size * 1.15, definition.color, nextState.nextEffectId),
      ]);
      nextState.nextEffectId += 1;
      continue;
    }

    remainingUpgrades.push(upgrade);
  }
  nextState.upgrades = remainingUpgrades;

  if (nextState.enemies.some((enemy) => enemy.y + enemy.size / 2 >= boardHeight - 8)) {
    nextState.status = 'lost';
    nextState.pickupMessage = 'Hull breach. A shape slipped through.';
    nextState.pickupTimer = 99;
  }

  return nextState;
}

function EnemyNode({ enemy }: { enemy: PrototypeEnemy }) {
  const isCircle = enemy.shape === 'circle';
  const isDiamond = enemy.shape === 'diamond';
  const size = enemy.size;
  const flashScale = enemy.flash > 0 ? 1.06 : 1;

  return (
    <View
      pointerEvents="none"
      style={[
        shooterStyles.enemyBody,
        {
          width: size,
          height: size,
          left: enemy.x - size / 2,
          top: enemy.y - size / 2,
          backgroundColor: enemy.color,
          borderRadius: isCircle ? size / 2 : 12,
          transform: [{ scale: flashScale }, ...(isDiamond ? [{ rotate: '45deg' as const }] : [])],
          borderColor: enemy.flash > 0 ? '#F9FDFF' : '#101827',
        },
      ]}>
      <Text
        style={[
          shooterStyles.enemyHealthText,
          isDiamond && {
            transform: [{ rotate: '-45deg' }],
          },
        ]}>
        {enemy.health}
      </Text>
    </View>
  );
}

function BulletNode({ bullet }: { bullet: PrototypeBullet }) {
  const trailHeight = bullet.size * (2.8 + bullet.trailScale * (0.45 + Math.sin(bullet.age * 18 + bullet.phase) * 0.12));
  const glowScale = 1 + Math.sin(bullet.age * 20 + bullet.phase) * 0.08;
  const angleDegrees = (bullet.angle * 180) / Math.PI;
  const isMissile = bullet.kind === 'missile';
  const isShatterShell = bullet.kind === 'shatterShell';
  const isShatterShard = bullet.kind === 'shatterShard';

  if (isMissile) {
    const missileTrailHeight = bullet.size * (3.3 + bullet.trailScale * (0.82 + Math.sin(bullet.age * 16 + bullet.phase) * 0.16));
    const bodyHeight = bullet.size * 1.75;
    const shellWidth = bullet.size * 2.4;

    return (
      <View
        pointerEvents="none"
        style={[
          shooterStyles.bulletShell,
          {
            left: bullet.x - shellWidth / 2,
            top: bullet.y - missileTrailHeight + bullet.size * 0.65,
            width: shellWidth,
            height: missileTrailHeight,
            transform: [{ rotate: `${angleDegrees}deg` }],
          },
        ]}>
        <View
          style={[
            shooterStyles.bulletGlow,
            {
              backgroundColor: bullet.glowColor,
              opacity: 0.28 + bullet.trailScale * 0.05,
              transform: [{ scaleX: 1.18 + bullet.trailScale * 0.09 }, { scaleY: 1.08 + glowScale * 0.12 }],
            },
          ]}
        />
        <View
          style={[
            shooterStyles.missileExhaust,
            {
              width: bullet.size * 0.72,
              height: missileTrailHeight - bodyHeight * 0.7,
              backgroundColor: bullet.glowColor,
              opacity: 0.3 + Math.sin(bullet.age * 26 + bullet.phase) * 0.06,
            },
          ]}
        />
        <View
          style={[
            shooterStyles.missileBody,
            {
              width: bullet.size * 0.86,
              height: bodyHeight,
              backgroundColor: bullet.color,
              borderColor: bullet.glowColor,
            },
          ]}>
          <View
            style={[
              shooterStyles.missileNose,
              {
                marginLeft: -(bullet.size * 0.42),
                borderLeftWidth: bullet.size * 0.42,
                borderRightWidth: bullet.size * 0.42,
                borderBottomWidth: bullet.size * 0.82,
                borderBottomColor: bullet.color,
              },
            ]}
          />
          <View
            style={[
              shooterStyles.missileFinLeft,
              {
                borderTopWidth: bullet.size * 0.42,
                borderRightWidth: bullet.size * 0.34,
                borderTopColor: bullet.glowColor,
              },
            ]}
          />
          <View
            style={[
              shooterStyles.missileFinRight,
              {
                borderTopWidth: bullet.size * 0.42,
                borderLeftWidth: bullet.size * 0.34,
                borderTopColor: bullet.glowColor,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  if (isShatterShell) {
    const shellSize = bullet.size * 1.3;
    return (
      <View
        pointerEvents="none"
        style={[
          shooterStyles.bulletShell,
          {
            left: bullet.x - shellSize,
            top: bullet.y - shellSize * 1.25,
            width: shellSize * 2,
            height: shellSize * 2.4,
            transform: [{ rotate: `${angleDegrees}deg` }],
          },
        ]}>
        <View
          style={[
            shooterStyles.bulletGlow,
            {
              backgroundColor: bullet.glowColor,
              opacity: 0.26,
              transform: [{ scaleX: 1.14 }, { scaleY: 1.1 + glowScale * 0.1 }],
            },
          ]}
        />
        <View
          style={[
            shooterStyles.shatterShellCore,
            {
              width: shellSize,
              height: shellSize,
              backgroundColor: bullet.color,
              borderColor: bullet.glowColor,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      </View>
    );
  }

  if (isShatterShard) {
    const shardSize = bullet.size * 1.15;
    return (
      <View
        pointerEvents="none"
        style={[
          shooterStyles.bulletShell,
          {
            left: bullet.x - shardSize,
            top: bullet.y - shardSize * 1.2,
            width: shardSize * 2,
            height: shardSize * 2.2,
            transform: [{ rotate: `${angleDegrees}deg` }],
          },
        ]}>
        <View
          style={[
            shooterStyles.bulletGlow,
            {
              backgroundColor: bullet.glowColor,
              opacity: 0.22,
              transform: [{ scaleX: 1.06 }, { scaleY: 1 + glowScale * 0.08 }],
            },
          ]}
        />
        <View
          style={[
            shooterStyles.shatterShard,
            {
              borderBottomColor: bullet.color,
              borderLeftWidth: shardSize * 0.42,
              borderRightWidth: shardSize * 0.42,
              borderBottomWidth: shardSize * 1.18,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        shooterStyles.bulletShell,
        {
          left: bullet.x - bullet.size,
          top: bullet.y - trailHeight + bullet.size * 0.2,
          width: bullet.size * 2,
          height: trailHeight,
          transform: [{ rotate: `${angleDegrees}deg` }],
        },
      ]}>
      <View
        style={[
          shooterStyles.bulletGlow,
          {
            backgroundColor: bullet.glowColor,
            opacity: 0.22 + bullet.trailScale * 0.05,
            transform: [{ scaleX: 1.05 + bullet.trailScale * 0.08 }, { scaleY: glowScale }],
          },
        ]}
      />
      <View
        style={[
          shooterStyles.bullet,
          {
            width: bullet.size,
            height: trailHeight,
            borderRadius: bullet.size,
            backgroundColor: bullet.color,
            borderColor: bullet.glowColor,
          },
        ]}
      />
    </View>
  );
}

function UpgradeNode({ upgrade }: { upgrade: PrototypeUpgrade }) {
  const pulseScale = 1 + Math.sin(upgrade.age * 7) * 0.06;

  return (
    <View
      pointerEvents="none"
      style={[
        shooterStyles.upgradeToken,
        {
          width: upgrade.size,
          height: upgrade.size,
          left: upgrade.x - upgrade.size / 2,
          top: upgrade.y - upgrade.size / 2,
          backgroundColor: upgrade.color,
          transform: [{ scale: pulseScale }, { rotate: `${Math.sin(upgrade.age * 2.8) * 10}deg` }],
        },
      ]}>
      <Text style={shooterStyles.upgradeLabel}>{upgrade.label}</Text>
    </View>
  );
}

function EffectNode({ effect }: { effect: PrototypeEffect }) {
  const progress = clamp(effect.age / effect.duration, 0, 1);
  const opacity = 1 - progress;
  const scale = 0.72 + progress * 0.95;

  if (effect.kind === 'muzzle') {
    const width = effect.size * 0.5;
    const height = effect.size * 1.35;
    return (
      <View
        pointerEvents="none"
        style={[
          shooterStyles.effectNode,
          shooterStyles.effectMuzzle,
          {
            left: effect.x - width / 2,
            top: effect.y - height,
            width,
            height,
            opacity,
            backgroundColor: effect.color,
            transform: [{ scaleY: 0.82 + progress * 0.65 }],
          },
        ]}
      />
    );
  }

  const size = effect.size * scale;
  const left = effect.x - size / 2;
  const top = effect.y - size / 2;
  const borderColor = effect.color;
  const fillColor = effect.kind === 'pickup' ? 'rgba(255,255,255,0.08)' : 'transparent';

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          shooterStyles.effectNode,
          shooterStyles.effectRing,
          {
            left,
            top,
            width: size,
            height: size,
            opacity,
            borderColor,
            backgroundColor: fillColor,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          shooterStyles.effectNode,
          shooterStyles.effectCore,
          {
            left: effect.x - (size * 0.22) / 2,
            top: effect.y - (size * 0.22) / 2,
            width: size * 0.22,
            height: size * 0.22,
            opacity: opacity * 0.9,
            backgroundColor: effect.color,
          },
        ]}
      />
    </>
  );
}

function BackgroundGrid({ width, height }: { width: number; height: number }) {
  const verticalLines = useMemo(
    () => Array.from({ length: Math.max(6, Math.floor(width / 64)) }, (_, index) => ((index + 1) * width) / 14),
    [width]
  );
  const horizontalLines = useMemo(
    () => Array.from({ length: Math.max(4, Math.floor(height / 60)) }, (_, index) => ((index + 1) * height) / 10),
    [height]
  );

  return (
    <>
      <View style={[shooterStyles.bgOrb, shooterStyles.bgOrbA]} />
      <View style={[shooterStyles.bgOrb, shooterStyles.bgOrbB]} />
      {verticalLines.map((x, index) => (
        <View
          key={`shooter-grid-v-${index}`}
          pointerEvents="none"
          style={[shooterStyles.gridLine, { left: x, top: 0, bottom: 0, width: 1 }]}
        />
      ))}
      {horizontalLines.map((y, index) => (
        <View
          key={`shooter-grid-h-${index}`}
          pointerEvents="none"
          style={[shooterStyles.gridLine, { top: y, left: 0, right: 0, height: 1 }]}
        />
      ))}
    </>
  );
}

export function PrototypeShooterScreen({ onSwitchGame }: PrototypeShooterScreenProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [gameState, setGameState] = useState<PrototypeGameState>(() => createInitialState(900, 420));
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPortraitViewport = windowHeight >= windowWidth;

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    setGameState(createInitialState(boardSize.width, boardSize.height));
    setHasStarted(false);
    setIsPaused(true);
  }, [boardSize.height, boardSize.width]);

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    let animationFrameId = 0;
    let lastFrameTimeMs = 0;
    let accumulatedSimulationSeconds = 0;

    const frame = (timeMs: number) => {
      if (lastFrameTimeMs === 0) {
        lastFrameTimeMs = timeMs;
        animationFrameId = requestAnimationFrame(frame);
        return;
      }

      const elapsedSeconds = Math.min((timeMs - lastFrameTimeMs) / 1000, MAX_FRAME_DELTA_SECONDS);
      lastFrameTimeMs = timeMs;

      if (hasStarted && !isPaused) {
        accumulatedSimulationSeconds += elapsedSeconds;
        const steps = Math.min(MAX_CATCH_UP_STEPS, Math.floor(accumulatedSimulationSeconds / FIXED_STEP_SECONDS));
        if (steps > 0) {
          accumulatedSimulationSeconds -= steps * FIXED_STEP_SECONDS;
          setGameState((previousState) => {
            if (previousState.status !== 'running') {
              return previousState;
            }

            let nextState = previousState;
            for (let index = 0; index < steps; index += 1) {
              if (nextState.status !== 'running') {
                break;
              }
              nextState = tickPrototypeState(nextState, FIXED_STEP_SECONDS, boardSize.width, boardSize.height);
            }
            return nextState;
          });
        }
      }

      animationFrameId = requestAnimationFrame(frame);
    };

    animationFrameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [boardSize.height, boardSize.width, hasStarted, isPaused]);

  useEffect(() => {
    if (gameState.status === 'lost') {
      setIsPaused(true);
    }
  }, [gameState.status]);

  const difficultyTier = getDifficultyTier(gameState.elapsed) + 1;
  const displayMessage =
    !hasStarted
      ? 'Press Start to deploy the ship.'
      : gameState.status === 'lost'
        ? 'Game over. Restart to run again.'
        : isPaused
          ? 'Prototype paused.'
          : gameState.pickupMessage ?? 'Catch falling upgrades to modify the weapon.';

  const handleBoardTouch = (event: GestureResponderEvent) => {
    if (
      boardSize.width <= 0 ||
      boardSize.height <= 0 ||
      isMenuOpen ||
      !hasStarted ||
      isPaused ||
      gameState.status !== 'running'
    ) {
      return;
    }

    const localX = event.nativeEvent.locationX;

    setGameState((previousState) => {
      if (previousState.status !== 'running') {
        return previousState;
      }

      return {
        ...previousState,
        playerX: clamp(localX, PLAYER_HALF_WIDTH + PLAYER_MARGIN, boardSize.width - PLAYER_HALF_WIDTH - PLAYER_MARGIN),
      };
    });
  };

  const handleBoardLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextWidth !== boardSize.width || nextHeight !== boardSize.height) {
      setBoardSize({ width: nextWidth, height: nextHeight });
    }
  };

  const handleRestart = () => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    setGameState(createInitialState(boardSize.width, boardSize.height));
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
  };

  const playerStyle = {
    left: gameState.playerX - PLAYER_RENDER_HALF_WIDTH,
    top: getPlayerShipTop(boardSize.height),
  };

  return (
    <SafeAreaView style={[shooterStyles.container, isPortraitViewport && shooterStyles.containerPortrait]}>
      <View style={shooterStyles.topBar}>
        <Pressable
          onPress={() => {
            if (!hasStarted) {
              setHasStarted(true);
              setIsPaused(false);
              return;
            }
            if (gameState.status === 'lost') {
              handleRestart();
              return;
            }
            setIsPaused((previousValue) => !previousValue);
          }}
          style={[
            shooterStyles.primaryButton,
            !hasStarted && shooterStyles.primaryButtonStart,
            hasStarted && isPaused && gameState.status === 'running' && shooterStyles.primaryButtonActive,
          ]}>
          <Text style={shooterStyles.primaryButtonText}>
            {!hasStarted ? 'Start' : gameState.status === 'lost' ? 'Restart' : isPaused ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>

        <View style={shooterStyles.statusPill}>
          <Text style={shooterStyles.statusPillText}>{displayMessage}</Text>
        </View>

        <Pressable
          onPress={() => setIsMenuOpen((previousValue) => !previousValue)}
          style={[shooterStyles.quickButton, isMenuOpen && shooterStyles.quickButtonActive]}>
          <Text style={shooterStyles.quickButtonText}>Menu</Text>
        </Pressable>
      </View>

      <View style={[shooterStyles.hudRow, isPortraitViewport && shooterStyles.hudRowPortrait]}>
        <View style={[shooterStyles.hudChip, isPortraitViewport && shooterStyles.hudChipPortrait]}>
          <Text style={shooterStyles.hudLabel}>Score</Text>
          <Text style={shooterStyles.hudValue}>{gameState.score}</Text>
        </View>
        <View style={[shooterStyles.hudChip, isPortraitViewport && shooterStyles.hudChipPortrait]}>
          <Text style={shooterStyles.hudLabel}>Pressure</Text>
          <Text style={shooterStyles.hudValue}>T{difficultyTier}</Text>
        </View>
      </View>

      <View style={shooterStyles.boardFrame}>
        <View
          onLayout={handleBoardLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleBoardTouch}
          onResponderMove={handleBoardTouch}
          style={shooterStyles.board}>
          <BackgroundGrid width={boardSize.width} height={boardSize.height} />

          {gameState.effects.map((effect) => (
            <EffectNode key={effect.id} effect={effect} />
          ))}

          {gameState.bullets.map((bullet) => (
            <BulletNode key={bullet.id} bullet={bullet} />
          ))}

          {gameState.enemies.map((enemy) => (
            <EnemyNode key={enemy.id} enemy={enemy} />
          ))}

          {gameState.upgrades.map((upgrade) => (
            <UpgradeNode key={upgrade.id} upgrade={upgrade} />
          ))}

          <View pointerEvents="none" style={[shooterStyles.playerShip, playerStyle]}>
            <View style={shooterStyles.playerNose} />
            <View style={shooterStyles.playerWingLeft} />
            <View style={shooterStyles.playerCore}>
              <View style={shooterStyles.playerCanopy} />
            </View>
            <View style={shooterStyles.playerWingRight} />
            <View style={shooterStyles.playerThrusterLeft} />
            <View style={shooterStyles.playerThrusterRight} />
          </View>

          <View style={shooterStyles.bottomGlow} pointerEvents="none" />
        </View>

        {isMenuOpen ? (
          <View style={shooterStyles.menuPanel}>
            <Text style={shooterStyles.menuTitle}>Prototype Menu</Text>

            <Text style={shooterStyles.menuLabel}>Game</Text>
            <View style={shooterStyles.menuRow}>
              <Pressable style={[shooterStyles.menuButton, shooterStyles.menuButtonActive]}>
                <Text style={shooterStyles.menuButtonText}>Shooter Test</Text>
              </Pressable>
              <Pressable
                onPress={() => onSwitchGame('defender')}
                style={shooterStyles.menuButton}>
                <Text style={shooterStyles.menuButtonText}>Defender</Text>
              </Pressable>
            </View>

            <Text style={shooterStyles.menuLabel}>Notes</Text>
            <Text style={shooterStyles.menuHint}>
              This is a temporary prototype. Drag anywhere to steer the ship. The ship now catches upgrades by overlap.
            </Text>

            <View style={shooterStyles.menuActions}>
              <Pressable onPress={handleRestart} style={[shooterStyles.menuActionButton, shooterStyles.menuActionPrimary]}>
                <Text style={shooterStyles.menuActionText}>Restart Run</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {gameState.status === 'lost' ? (
        <View style={shooterStyles.overlay}>
          <View style={shooterStyles.gameOverModal}>
            <Text style={shooterStyles.gameOverTitle}>Run Terminated</Text>
            <Text style={shooterStyles.gameOverText}>
              An enemy crossed the floor line. Score {gameState.score}. Pressure tier {difficultyTier}.
            </Text>
            <View style={shooterStyles.gameOverActions}>
              <Pressable onPress={handleRestart} style={[shooterStyles.menuActionButton, shooterStyles.menuActionPrimary]}>
                <Text style={shooterStyles.menuActionText}>Retry</Text>
              </Pressable>
              <Pressable
                onPress={() => onSwitchGame('defender')}
                style={[shooterStyles.menuActionButton, shooterStyles.menuActionSecondary]}>
                <Text style={shooterStyles.menuActionText}>Back to Defender</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const shooterStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07111A',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  containerPortrait: {
    paddingHorizontal: 10,
  },
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    minWidth: 86,
    borderWidth: 1,
    borderColor: '#48688B',
    backgroundColor: '#22324A',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  primaryButtonStart: {
    borderColor: '#49D3A4',
    backgroundColor: '#153D31',
  },
  primaryButtonActive: {
    borderColor: '#E1B061',
    backgroundColor: '#543E22',
  },
  primaryButtonText: {
    color: '#F2F7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  statusPill: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#28435F',
    backgroundColor: '#102131',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  statusPillText: {
    color: '#D9EBFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickButton: {
    minWidth: 78,
    borderWidth: 1,
    borderColor: '#2A5878',
    backgroundColor: '#11314A',
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  quickButtonActive: {
    borderColor: '#7DBDFF',
    backgroundColor: '#1B4164',
  },
  quickButtonText: {
    color: '#E3F3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  hudRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  hudRowPortrait: {
    flexWrap: 'wrap',
  },
  hudChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22314A',
    backgroundColor: '#0D1724',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hudChipPortrait: {
    flexBasis: '48%',
    minWidth: '48%',
  },
  hudLabel: {
    color: '#7D93B5',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hudValue: {
    color: '#EEF5FF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  weaponRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  weaponRowPortrait: {
    flexWrap: 'wrap',
  },
  weaponPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#24405D',
    backgroundColor: '#0E1A28',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  weaponPillWide: {
    width: '100%',
  },
  weaponPillText: {
    color: '#BCD4F4',
    fontSize: 11,
    fontWeight: '700',
  },
  boardFrame: {
    flex: 1,
    marginTop: 6,
    position: 'relative',
  },
  board: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#223852',
    backgroundColor: '#08131F',
  },
  effectNode: {
    position: 'absolute',
  },
  effectMuzzle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7F7FF',
  },
  effectRing: {
    borderRadius: 999,
    borderWidth: 2,
  },
  effectCore: {
    borderRadius: 999,
  },
  bgOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  bgOrbA: {
    top: -90,
    left: -20,
    backgroundColor: 'rgba(65, 130, 210, 0.12)',
  },
  bgOrbB: {
    right: -40,
    top: 40,
    backgroundColor: 'rgba(255, 110, 145, 0.1)',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(92, 126, 164, 0.14)',
  },
  enemyBody: {
    position: 'absolute',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyHealthText: {
    color: '#F7FBFF',
    fontSize: 13,
    fontWeight: '900',
  },
  bulletShell: {
    position: 'absolute',
    alignItems: 'center',
  },
  bulletGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    borderRadius: 999,
  },
  bullet: {
    borderWidth: 1,
    alignSelf: 'center',
  },
  shatterShellCore: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1.5,
    borderRadius: 6,
  },
  shatterShard: {
    position: 'absolute',
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
  missileExhaust: {
    position: 'absolute',
    bottom: 0,
    borderRadius: 999,
    alignSelf: 'center',
  },
  missileBody: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'visible',
  },
  missileNose: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    top: -6,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
  missileFinLeft: {
    position: 'absolute',
    left: -5,
    bottom: 3,
    width: 0,
    height: 0,
    borderTopColor: '#FF7B63',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
  missileFinRight: {
    position: 'absolute',
    right: -5,
    bottom: 3,
    width: 0,
    height: 0,
    borderTopColor: '#FF7B63',
    borderLeftColor: 'transparent',
    backgroundColor: 'transparent',
  },
  upgradeToken: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#101827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  upgradeLabel: {
    color: '#07131C',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  playerShip: {
    position: 'absolute',
    width: 56,
    height: PLAYER_HEIGHT + 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  playerNose: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 8,
    height: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1.5,
    borderColor: '#0A1420',
    backgroundColor: '#B6F8FF',
  },
  playerCore: {
    width: 22,
    height: PLAYER_HEIGHT,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0A1420',
    backgroundColor: '#6EF4FF',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  playerCanopy: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E9FCFF',
  },
  playerWingLeft: {
    width: 13,
    height: 12,
    marginRight: 3,
    marginBottom: 4,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 9,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0A1420',
    backgroundColor: '#1D7BD0',
  },
  playerWingRight: {
    width: 13,
    height: 12,
    marginLeft: 3,
    marginBottom: 4,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 9,
    borderWidth: 1.5,
    borderColor: '#0A1420',
    backgroundColor: '#1D7BD0',
  },
  playerThrusterLeft: {
    position: 'absolute',
    left: 17,
    bottom: 0,
    width: 5,
    height: 7,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#FFB16C',
  },
  playerThrusterRight: {
    position: 'absolute',
    right: 17,
    bottom: 0,
    width: 5,
    height: 7,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#FFB16C',
  },
  bottomGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -40,
    height: 120,
    backgroundColor: 'rgba(80, 163, 255, 0.12)',
    borderRadius: 120,
  },
  menuPanel: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 320,
    maxWidth: '76%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304966',
    backgroundColor: '#0D1827',
    padding: 12,
    gap: 8,
    zIndex: 20,
  },
  menuTitle: {
    color: '#EFF6FF',
    fontSize: 14,
    fontWeight: '800',
  },
  menuLabel: {
    color: '#98B2D4',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  menuRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menuButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#37516F',
    backgroundColor: '#122131',
    paddingVertical: 9,
    alignItems: 'center',
  },
  menuButtonActive: {
    borderColor: '#8FC1FF',
    backgroundColor: '#1B3651',
  },
  menuButtonText: {
    color: '#E9F3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  menuHint: {
    color: '#A9BEDA',
    fontSize: 12,
    lineHeight: 18,
  },
  menuActions: {
    marginTop: 4,
  },
  menuActionButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  menuActionPrimary: {
    borderColor: '#7BB6FF',
    backgroundColor: '#1B3651',
  },
  menuActionSecondary: {
    borderColor: '#4E6381',
    backgroundColor: '#243042',
  },
  menuActionText: {
    color: '#EDF5FF',
    fontSize: 12,
    fontWeight: '800',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 10, 18, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 30,
  },
  gameOverModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#436286',
    backgroundColor: '#101C2D',
    padding: 18,
    gap: 12,
  },
  gameOverTitle: {
    color: '#EEF6FF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  gameOverText: {
    color: '#BCD2EE',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  gameOverActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
