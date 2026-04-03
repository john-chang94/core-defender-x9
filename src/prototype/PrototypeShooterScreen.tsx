import { useEffect, useMemo, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type AppGameId = 'defender' | 'prototype';

type EnemyShape = 'circle' | 'square' | 'diamond';
type WeaponUpgradeType = 'rapid' | 'twin' | 'heavy' | 'pierce' | 'focus';
type PrototypeEffectKind = 'muzzle' | 'burst' | 'pickup';

type PrototypeBullet = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  size: number;
  pierce: number;
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
  enemyCooldown: number;
  upgradeCooldown: number;
  nextBulletId: number;
  nextEnemyId: number;
  nextUpgradeId: number;
  nextEffectId: number;
  pickupMessage: string | null;
  pickupTimer: number;
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
const DIFFICULTY_TIER_DURATION_SECONDS = 15;
const OPENING_UPGRADE_TYPES: WeaponUpgradeType[] = ['rapid', 'twin', 'heavy'];
const BASE_WEAPON: PrototypeWeapon = {
  damage: 1,
  fireInterval: 0.1,
  shotCount: 1,
  pierce: 0,
  bulletSize: 8,
  bulletSpeed: 760,
  spread: 15,
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
      shotCount: Math.min(5, weapon.shotCount + 1),
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

function getDifficultyTier(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds / DIFFICULTY_TIER_DURATION_SECONDS);
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
    enemyCooldown: 2.1,
    upgradeCooldown: 3.6,
    nextBulletId: 1,
    nextEnemyId: 1,
    nextUpgradeId: 1,
    nextEffectId: 1,
    pickupMessage: 'Drag to move. Catch falling upgrades with the ship.',
    pickupTimer: 3.5,
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

  for (let index = 0; index < state.weapon.shotCount; index += 1) {
    const lane = index - centerIndex;
    const angle = lane * 0.085;
    bullets.push({
      id: `B${nextBulletId}`,
      x: state.playerX + lane * state.weapon.spread,
      y: muzzleY,
      vx: Math.sin(angle) * state.weapon.bulletSpeed * 0.42,
      vy: -Math.cos(angle) * state.weapon.bulletSpeed,
      damage: state.weapon.damage,
      size: state.weapon.bulletSize,
      pierce: state.weapon.pierce,
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
  let cooldown = Math.max(0.55, 1.68 - difficultyTier * 0.05 - Math.random() * 0.14);

  if (difficultyTier >= 4 && Math.random() < Math.min(0.2, 0.04 + difficultyTier * 0.016)) {
    const sideOffset = centerLane <= 1 ? 1 : centerLane >= lanes.length - 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
    drafts.push({
      x: lanes[centerLane + sideOffset],
      sizeMultiplier: 0.88,
      healthMultiplier: 0.8,
      speedMultiplier: 1.04,
    });
    cooldown += 0.18;
  }

  if (difficultyTier >= 8 && Math.random() < Math.min(0.12, 0.015 + difficultyTier * 0.008)) {
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
    cooldown += 0.26;
  }

  if (difficultyTier >= 6 && Math.random() < Math.min(0.12, 0.02 + difficultyTier * 0.01)) {
    const eliteIndex = Math.floor(Math.random() * drafts.length);
    drafts[eliteIndex] = {
      ...drafts[eliteIndex],
      shape: 'diamond',
      color: '#FF7CA2',
      sizeMultiplier: 1.14,
      healthMultiplier: 1.35,
      speedMultiplier: 0.88,
    };
    cooldown += 0.14;
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
  const size = clamp((30 + difficultyTier * 1.5 + Math.random() * 14) * sizeMultiplier, 28, 82);
  const shapePool: EnemyShape[] =
    difficultyTier >= 7 ? ['circle', 'square', 'diamond'] : difficultyTier >= 4 ? ['circle', 'square'] : ['circle'];
  const shape = draft?.shape ?? randomChoice(shapePool);
  const maxHealth = Math.max(2, Math.round((2 + difficultyTier * 0.75 + size / 13 + Math.random() * 2.4) * healthMultiplier));
  const speed = (64 + difficultyTier * 6.5 + Math.random() * 24) * speedMultiplier;
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
  const typePool =
    state.nextUpgradeId === 1 ? OPENING_UPGRADE_TYPES : (Object.keys(UPGRADE_DEFINITIONS) as WeaponUpgradeType[]);
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
    upgradeCooldown: 4.8 + Math.random() * 2.2,
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
    bullets: previousState.bullets.map((bullet) => ({
      ...bullet,
      x: bullet.x + bullet.vx * deltaSeconds,
      y: bullet.y + bullet.vy * deltaSeconds,
    })),
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
        16 + nextState.weapon.shotCount * 4,
        '#F4FCFF',
        nextState.nextEffectId
      ),
    ]);
    nextState.nextEffectId += 1;
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
      nextState.weapon = definition.apply(nextState.weapon);
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

function formatRate(weapon: PrototypeWeapon) {
  return `${(1 / weapon.fireInterval).toFixed(1)}/s`;
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
  return (
    <View
      pointerEvents="none"
      style={[
        shooterStyles.bullet,
        {
          left: bullet.x - bullet.size / 2,
          top: bullet.y - bullet.size * 1.6,
          width: bullet.size,
          height: bullet.size * 2.8,
          borderRadius: bullet.size,
        },
      ]}
    />
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
        <View style={[shooterStyles.hudChip, isPortraitViewport && shooterStyles.hudChipPortrait]}>
          <Text style={shooterStyles.hudLabel}>Rate</Text>
          <Text style={shooterStyles.hudValue}>{formatRate(gameState.weapon)}</Text>
        </View>
        <View style={[shooterStyles.hudChip, isPortraitViewport && shooterStyles.hudChipPortrait]}>
          <Text style={shooterStyles.hudLabel}>Payload</Text>
          <Text style={shooterStyles.hudValue}>
            {gameState.weapon.damage} dmg · {gameState.weapon.shotCount} shot
          </Text>
        </View>
      </View>

      <View style={[shooterStyles.weaponRow, isPortraitViewport && shooterStyles.weaponRowPortrait]}>
        <View style={shooterStyles.weaponPill}>
          <Text style={shooterStyles.weaponPillText}>Pierce {gameState.weapon.pierce}</Text>
        </View>
        <View style={shooterStyles.weaponPill}>
          <Text style={shooterStyles.weaponPillText}>Speed {Math.round(gameState.weapon.bulletSpeed)}</Text>
        </View>
        <View style={[shooterStyles.weaponPill, isPortraitViewport && shooterStyles.weaponPillWide]}>
          <Text style={shooterStyles.weaponPillText}>Catch upgrades to evolve the gun</Text>
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
    marginTop: 8,
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
    paddingVertical: 6,
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
    marginTop: 10,
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
  bullet: {
    position: 'absolute',
    backgroundColor: '#EEFBFF',
    borderWidth: 1,
    borderColor: '#79DFFF',
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
