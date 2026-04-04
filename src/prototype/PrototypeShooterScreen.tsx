import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type AppGameId = 'defender' | 'prototype';

type EnemyShape = 'circle' | 'square' | 'diamond';
type EnemyArchetype = 'standard' | 'swarm' | 'tank' | 'splitter' | 'boss';
type BossVariant = 'prism' | 'bulwark';
type PrototypeEncounterType = 'swarmRush' | 'fortressLine' | 'splitterStorm' | 'salvageDrift' | 'boss';
type BuildProtocolKey = 'railFocus' | 'novaBloom' | 'missileCommand' | 'fractureCore';
type WeaponUpgradeType =
  | 'rapid'
  | 'twin'
  | 'heavy'
  | 'pierce'
  | 'focus'
  | 'chaos'
  | 'flare'
  | 'missile'
  | 'shatter'
  | 'bombard';
type PrototypeEffectKind = 'muzzle' | 'burst' | 'pickup' | 'bombard' | 'ultimate';
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
  archetype: EnemyArchetype;
  bossVariant: BossVariant | null;
  bossPhase: number;
  rewardMultiplier: number;
  splitGeneration: number;
  color: string;
  flash: number;
};

type PrototypeEncounter = {
  type: PrototypeEncounterType;
  label: string;
  accentColor: string;
  endsAt: number | null;
  displayTier: number;
};

type PrototypeArmoryChoice = {
  title: string;
  prompt: string;
  sourceDisplayTier: number;
  options: BuildProtocolKey[];
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
  archetype?: EnemyArchetype;
  shape?: EnemyShape;
  color?: string;
  sizeMultiplier?: number;
  healthMultiplier?: number;
  speedMultiplier?: number;
  rewardMultiplier?: number;
  splitGeneration?: number;
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
  chaosTimer: number;
  enemyCooldown: number;
  upgradeCooldown: number;
  nextBulletId: number;
  nextEnemyId: number;
  nextUpgradeId: number;
  nextEffectId: number;
  pickupMessage: string | null;
  pickupTimer: number;
  collectedUpgradeCount: number;
  revealedUpgradeTypes: WeaponUpgradeType[];
  activeEncounter: PrototypeEncounter | null;
  lastProcessedDisplayTier: number;
  bossEscortCooldown: number;
  buildProtocol: BuildProtocolKey | null;
  buildProtocolLevel: number;
  pendingArmoryChoice: PrototypeArmoryChoice | null;
  queuedArmoryChoice: PrototypeArmoryChoice | null;
  armoryTransitionTimer: number;
  armoryTransitionLabel: string | null;
  armoryTransitionColor: string | null;
  ultimateCharge: number;
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
const MAX_ULTIMATE_CHARGE = 100;
const ULTIMATE_CHARGE_GAIN_MULTIPLIER = 1.3;
const DIFFICULTY_TIER_DURATION_SECONDS = 15;
const BOSS_TIER_INTERVAL = 5;
const BOSS_CLEAR_TRANSITION_SECONDS = 1.45;
const TIER_EVENT_START_DISPLAY_TIER = 6;
const MAX_STRAIGHT_GUNS = 4;
const MAX_MISSILE_LEVEL = 2;
const CHAOS_OVERDRIVE_DURATION_SECONDS = 6;
const GUARANTEED_UPGRADE_REVEAL_TIER = 7;
const GUARANTEED_UPGRADE_ACTIVE_CAP = 5;
const CHAOS_AND_BOMBARD_UNLOCK_DISPLAY_TIER = 10;
const OPENING_UPGRADE_TYPES: WeaponUpgradeType[] = ['rapid', 'twin', 'heavy'];
const REQUIRED_EARLY_UPGRADE_TYPES: WeaponUpgradeType[] = [
  'rapid',
  'twin',
  'heavy',
  'flare',
];
const STANDARD_UPGRADE_TYPES: WeaponUpgradeType[] = [
  'rapid',
  'twin',
  'heavy',
  'pierce',
  'focus',
  'chaos',
  'chaos',
  'chaos',
  'chaos',
  'chaos',
  'flare',
  'flare',
  'missile',
  'missile',
  'shatter',
  'shatter',
  'bombard',
  'bombard',
  'bombard',
];
const BUILD_PROTOCOL_KEYS: BuildProtocolKey[] = ['railFocus', 'novaBloom', 'missileCommand', 'fractureCore'];
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

const BUILD_PROTOCOL_DEFINITIONS: Record<
  BuildProtocolKey,
  {
    label: string;
    color: string;
    accent: string;
    summary: string;
  }
> = {
  railFocus: {
    label: 'Rail Focus',
    color: '#FF85E1',
    accent: '#FFE4F7',
    summary: 'Compresses barrels into faster, piercing precision rails.',
  },
  novaBloom: {
    label: 'Nova Bloom',
    color: '#FFB45D',
    accent: '#FFF1D7',
    summary: 'Overclocks the primary into wider, hotter flare volleys.',
  },
  missileCommand: {
    label: 'Missile Command',
    color: '#FF7B63',
    accent: '#FFE1DA',
    summary: 'Promotes missile salvos into a first-class weapon system.',
  },
  fractureCore: {
    label: 'Fracture Core',
    color: '#FFBD6E',
    accent: '#FFF0D8',
    summary: 'Turns shatter fire into dense fragment cascades.',
  },
};

function applyDoctrineAdjustedUpgrade(
  state: PrototypeGameState,
  type: WeaponUpgradeType
): { weapon: PrototypeWeapon; pickupMessage: string } {
  const definition = UPGRADE_DEFINITIONS[type];

  if (type === 'twin' && state.buildProtocol === 'railFocus') {
    if (state.weapon.shotCount < 2) {
      return {
        weapon: definition.apply(state.weapon),
        pickupMessage: 'Second rail synced',
      };
    }

    return {
      weapon: {
        ...state.weapon,
        damage: Math.min(14, state.weapon.damage + 1),
        pierce: Math.min(5, state.weapon.pierce + 1),
        bulletSpeed: Math.min(1180, state.weapon.bulletSpeed + 40),
        effectIntensity: Math.min(2.15, state.weapon.effectIntensity + 0.08),
      },
      pickupMessage: 'Twin compressed into rail payload',
    };
  }

  return {
    weapon: definition.apply(state.weapon),
    pickupMessage: `${definition.label} upgrade secured`,
  };
}

function getChaosOverdriveWeapon(weapon: PrototypeWeapon): PrototypeWeapon {
  return {
    ...weapon,
    damage: Math.max(13, weapon.damage + 2),
    fireInterval: Math.min(0.035, weapon.fireInterval * 0.68),
    shotCount: Math.max(MAX_STRAIGHT_GUNS + 1, weapon.shotCount + 1),
    pierce: Math.max(5, weapon.pierce + 1),
    bulletSize: Math.max(15, weapon.bulletSize + 1),
    bulletSpeed: Math.max(1220, weapon.bulletSpeed + 140),
    spread: Math.max(50, weapon.spread + 6),
    aimAssist: Math.max(0.42, weapon.aimAssist + 0.12),
    spreadJitter: Math.max(18, weapon.spreadJitter + 4),
    effectIntensity: Math.max(2.65, weapon.effectIntensity + 0.45),
    bulletColor: '#FFF3DD',
    glowColor: '#FF9B55',
    muzzleColor: '#FFF1B4',
    trailScale: Math.max(2.15, weapon.trailScale + 0.28),
    missileLevel: Math.max(MAX_MISSILE_LEVEL + 1, weapon.missileLevel + 1),
    shatterLevel: Math.max(4, weapon.shatterLevel + 1),
  };
}

function getActiveWeapon(state: PrototypeGameState): PrototypeWeapon {
  const buildAdjustedWeapon = getBuildProtocolWeapon(state, state.weapon);
  return state.chaosTimer > 0 ? getChaosOverdriveWeapon(buildAdjustedWeapon) : buildAdjustedWeapon;
}

function getMissingGuaranteedUpgradeTypes(state: PrototypeGameState): WeaponUpgradeType[] {
  return REQUIRED_EARLY_UPGRADE_TYPES.filter((type) => !state.revealedUpgradeTypes.includes(type));
}

function getStandardUpgradeTypePool(state: PrototypeGameState, difficultyTier: number): WeaponUpgradeType[] {
  const displayTier = difficultyTier + 1;
  const basePool =
    displayTier >= CHAOS_AND_BOMBARD_UNLOCK_DISPLAY_TIER
      ? [...STANDARD_UPGRADE_TYPES]
      : STANDARD_UPGRADE_TYPES.filter((type) => type !== 'chaos' && type !== 'bombard');

  if (displayTier < CHAOS_AND_BOMBARD_UNLOCK_DISPLAY_TIER) {
    return basePool;
  }

  const activeEnemyCount = state.enemies.length;
  const chaosBonusWeight = Math.min(16, Math.floor(activeEnemyCount / 2));
  const bombardBonusWeight = Math.min(8, Math.floor(activeEnemyCount / 4));

  for (let index = 0; index < chaosBonusWeight; index += 1) {
    basePool.push('chaos');
  }

  for (let index = 0; index < bombardBonusWeight; index += 1) {
    basePool.push('bombard');
  }

  return basePool;
}

function createArmoryChoice(state: PrototypeGameState, sourceDisplayTier: number): PrototypeArmoryChoice {
  const currentProtocol = state.buildProtocol;
  const optionPool = currentProtocol
    ? shuffleCopy(BUILD_PROTOCOL_KEYS.filter((protocol) => protocol !== currentProtocol)).slice(0, 2)
    : shuffleCopy(BUILD_PROTOCOL_KEYS).slice(0, 3);
  const options = currentProtocol ? shuffleCopy([currentProtocol, ...optionPool]) : optionPool;

  return {
    title: currentProtocol ? 'Armory Sync' : 'Doctrine Select',
    prompt: currentProtocol
      ? 'Maintain your doctrine to deepen it, or reroute the ship into a new combat profile.'
      : 'Pick the doctrine that should define the run. Future boss clears let you maintain or reroute it.',
    sourceDisplayTier,
    options,
  };
}

function getBuildProtocolLevelLabel(level: number) {
  return `L${Math.max(1, level)}`;
}

function getBuildProtocolOptionDescription(protocol: BuildProtocolKey, nextLevel: number, isCurrentProtocol: boolean) {
  const definition = BUILD_PROTOCOL_DEFINITIONS[protocol];
  const prefix = isCurrentProtocol ? `Maintain to ${getBuildProtocolLevelLabel(nextLevel)}.` : 'Reroute the ship.';
  return `${prefix} ${definition.summary}`;
}

function getProtocolRamp(level: number) {
  const normalizedLevel = Math.max(1, level);
  const linear = normalizedLevel - 1;
  return {
    linear,
    curved: Math.sqrt(linear),
    logarithmic: Math.log2(normalizedLevel + 1),
  };
}

function getBuildProtocolSupport(state: PrototypeGameState) {
  const level = state.buildProtocolLevel;
  const ramp = getProtocolRamp(level);
  switch (state.buildProtocol) {
    case 'missileCommand':
      return {
        missileCountFloor: level >= 2 ? 4 : 2,
        missileDamageBonus: 1 + Math.round(ramp.linear * 1.4 + ramp.curved * 1.8),
        missileCooldownMultiplier: Math.max(0.56, 0.84 - ramp.linear * 0.035),
        missileTurnBonus: Math.min(0.34, 0.08 + ramp.linear * 0.026),
        shatterFragmentBonus: 0,
        shatterDamageBonus: 0,
        shatterCooldownMultiplier: 1,
      };
    case 'fractureCore':
      return {
        missileCountFloor: 0,
        missileDamageBonus: 0,
        missileCooldownMultiplier: 1,
        missileTurnBonus: 0,
        shatterFragmentBonus: Math.min(5, 1 + Math.floor(ramp.linear / 2)),
        shatterDamageBonus: 1 + Math.round(ramp.linear * 1.2 + ramp.curved * 1.4),
        shatterCooldownMultiplier: Math.max(0.58, 0.9 - ramp.linear * 0.05),
      };
    default:
      return {
        missileCountFloor: 0,
        missileDamageBonus: 0,
        missileCooldownMultiplier: 1,
        missileTurnBonus: 0,
        shatterFragmentBonus: 0,
        shatterDamageBonus: 0,
        shatterCooldownMultiplier: 1,
      };
  }
}

function getBuildProtocolWeapon(state: PrototypeGameState, weapon: PrototypeWeapon): PrototypeWeapon {
  const level = state.buildProtocolLevel;
  const ramp = getProtocolRamp(level);
  switch (state.buildProtocol) {
    case 'railFocus': {
      const suppressedShots = Math.max(0, weapon.shotCount - 2);
      return {
        ...weapon,
        damage: weapon.damage + 2 + suppressedShots + Math.round(ramp.linear * 0.8 + ramp.curved * 1.2),
        fireInterval: Math.max(0.032, weapon.fireInterval * Math.pow(0.965, ramp.linear)),
        shotCount: Math.min(2, Math.max(1, weapon.shotCount)),
        pierce: Math.min(8, weapon.pierce + 1 + Math.floor((ramp.linear + 1) / 2)),
        bulletSize: Math.min(15.5, weapon.bulletSize + 0.28 + ramp.linear * 0.18),
        bulletSpeed: Math.min(1750, weapon.bulletSpeed + 80 + ramp.linear * 28 + ramp.curved * 18),
        spread: Math.max(9, weapon.spread * 0.58),
        aimAssist: Math.min(0.58, weapon.aimAssist + 0.08 + ramp.linear * 0.025),
        spreadJitter: weapon.spreadJitter * 0.45,
        effectIntensity: Math.min(2.8, weapon.effectIntensity + 0.12 + ramp.linear * 0.05),
        bulletColor: '#FFE3F8',
        glowColor: '#FF86E1',
        muzzleColor: '#FFF0FA',
        trailScale: Math.min(2.3, weapon.trailScale + 0.12 + ramp.linear * 0.04),
      };
    }
    case 'novaBloom':
      return {
        ...weapon,
        damage: weapon.damage + 1 + Math.round(ramp.linear * 0.55 + ramp.curved * 0.8),
        fireInterval: Math.max(0.034, weapon.fireInterval * Math.pow(0.97, ramp.linear)),
        shotCount: Math.min(MAX_STRAIGHT_GUNS, weapon.shotCount + Math.min(ramp.linear + 1, MAX_STRAIGHT_GUNS)),
        bulletSize: Math.min(17.5, weapon.bulletSize + 0.8 + ramp.linear * 0.22),
        spread: Math.min(60, weapon.spread + 8 + ramp.linear * 3.2),
        aimAssist: Math.min(0.32, weapon.aimAssist + 0.03 + ramp.linear * 0.012),
        spreadJitter: Math.min(26, weapon.spreadJitter + 5 + ramp.linear * 1.7),
        effectIntensity: Math.min(2.95, weapon.effectIntensity + 0.24 + ramp.linear * 0.08),
        bulletColor: '#FFF2C3',
        glowColor: '#FFAA52',
        muzzleColor: '#FFF3BA',
        trailScale: Math.min(2.45, weapon.trailScale + 0.16 + ramp.linear * 0.05),
        pierce: Math.min(6, weapon.pierce + (level >= 3 ? 1 : 0) + (level >= 8 ? 1 : 0)),
      };
    case 'missileCommand':
      return {
        ...weapon,
        damage: weapon.damage + Math.round(ramp.linear * 0.35 + ramp.curved * 0.45),
        fireInterval: Math.max(0.038, weapon.fireInterval * Math.pow(0.985, ramp.linear)),
        aimAssist: Math.min(0.5, weapon.aimAssist + 0.04 + ramp.linear * 0.02),
        effectIntensity: Math.min(2.8, weapon.effectIntensity + 0.12 + ramp.linear * 0.05),
        trailScale: Math.min(2.3, weapon.trailScale + 0.08 + ramp.linear * 0.04),
        missileLevel: Math.max(1, weapon.missileLevel),
        bulletColor: '#FFECE6',
        glowColor: '#FF7B63',
        muzzleColor: '#FFE6D7',
      };
    case 'fractureCore':
      return {
        ...weapon,
        damage: weapon.damage + 1 + Math.round(ramp.linear * 0.9 + ramp.curved * 1.1),
        fireInterval: Math.max(0.04, weapon.fireInterval * Math.pow(0.982, ramp.linear)),
        bulletSize: Math.min(15.8, weapon.bulletSize + 0.42 + ramp.linear * 0.12),
        effectIntensity: Math.min(2.85, weapon.effectIntensity + 0.18 + ramp.linear * 0.06),
        trailScale: Math.min(2.25, weapon.trailScale + 0.1 + ramp.linear * 0.04),
        shatterLevel: Math.max(1, weapon.shatterLevel),
        bulletColor: '#FFF0D9',
        glowColor: '#FFB36B',
        muzzleColor: '#FFE5BE',
      };
    default:
      return weapon;
  }
}

function getBuildProtocolDisplay(state: PrototypeGameState) {
  if (!state.buildProtocol) {
    return null;
  }

  return {
    ...BUILD_PROTOCOL_DEFINITIONS[state.buildProtocol],
    levelLabel: getBuildProtocolLevelLabel(state.buildProtocolLevel),
  };
}

function hexToRgba(hexColor: string, alpha: number) {
  const normalizedHex = hexColor.replace('#', '');
  if (normalizedHex.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getBoardAtmosphere(
  difficultyTier: number,
  encounter: PrototypeEncounter | null,
  activeBoss: PrototypeEnemy | null,
  buildColor: string | null,
  ultimateReady: boolean,
  breachPressure: number
) {
  const tierHeat = clamp((difficultyTier - 1) / 24, 0, 1);
  const primaryColor = activeBoss?.color ?? encounter?.accentColor ?? buildColor ?? '#6DEBFF';
  const secondaryColor = buildColor ?? (activeBoss ? '#FF9DBA' : '#FF7BA4');
  const warningColor = activeBoss ? primaryColor : '#FF6D73';

  return {
    borderColor: hexToRgba(primaryColor, 0.22 + tierHeat * 0.12 + breachPressure * 0.1),
    hazeColor: hexToRgba(primaryColor, 0.03 + tierHeat * 0.05 + (activeBoss ? 0.04 : 0)),
    orbAColor: hexToRgba(primaryColor, 0.1 + tierHeat * 0.06),
    orbBColor: hexToRgba(secondaryColor, 0.08 + tierHeat * 0.05),
    gridColor: hexToRgba(primaryColor, 0.12 + tierHeat * 0.04),
    bottomGlowColor: hexToRgba(ultimateReady ? '#BBF16A' : primaryColor, 0.08 + breachPressure * 0.16),
    breachLineColor: hexToRgba(warningColor, 0.18 + breachPressure * 0.54),
    bossTelegraphColor: hexToRgba(primaryColor, 0.16 + breachPressure * 0.14),
  };
}

function getUltimateDefinition(state: PrototypeGameState) {
  switch (state.buildProtocol) {
    case 'railFocus':
      return {
        label: 'Sky Lance',
        color: '#FF86E1',
        summary: 'Piercing rail strikes spear the highest-threat targets.',
      };
    case 'novaBloom':
      return {
        label: 'Solar Bloom',
        color: '#FFB45D',
        summary: 'An expanding flare wave scorches the whole screen.',
      };
    case 'missileCommand':
      return {
        label: 'Missile Storm',
        color: '#FF7B63',
        summary: 'A coordinated missile strike hunts the densest threats.',
      };
    case 'fractureCore':
      return {
        label: 'Cascade Break',
        color: '#FFBD6E',
        summary: 'A shatter cascade cracks every enemy and bursts priority targets.',
      };
    default:
      return {
        label: 'Pulse Crash',
        color: '#7EDCFF',
        summary: 'A fallback pulse clears space and resets pressure.',
      };
  }
}

function addUltimateCharge(state: PrototypeGameState, amount: number) {
  if (amount <= 0) {
    return;
  }
  state.ultimateCharge = clamp(state.ultimateCharge + amount * ULTIMATE_CHARGE_GAIN_MULTIPLIER, 0, MAX_ULTIMATE_CHARGE);
}

function getUltimateHitCharge(enemy: PrototypeEnemy, dealtDamage: number) {
  if (dealtDamage <= 0) {
    return 0;
  }

  const damageFraction = dealtDamage / Math.max(20, enemy.maxHealth);
  const base = enemy.archetype === 'boss' ? 18 : enemy.archetype === 'tank' ? 11 : enemy.archetype === 'splitter' ? 9 : 7;
  const cap = enemy.archetype === 'boss' ? 2.6 : enemy.archetype === 'tank' ? 1.15 : 0.9;
  return Math.min(cap, damageFraction * base);
}

function getUltimateKillCharge(enemy: PrototypeEnemy) {
  switch (enemy.archetype) {
    case 'swarm':
      return 1.2;
    case 'tank':
      return 3.4;
    case 'splitter':
      return 2.7;
    case 'boss':
      return 34;
    default:
      return 1.8;
  }
}

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
    apply: (weapon) => weapon,
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
  bombard: {
    label: 'Bombard',
    color: '#FF6B5E',
    accent: '#FFE0D7',
    apply: (weapon) => weapon,
  },
};

const ENEMY_PALETTE = [
  '#6DEBFF',
  '#FF9E7A',
  '#C6B4FF',
  '#FF6F91',
  '#F4CC66',
] as const;

const ENEMY_ARCHETYPE_SETTINGS: Record<
  EnemyArchetype,
  {
    defaultShape: EnemyShape | null;
    defaultColor: string | null;
    sizeMultiplier: number;
    healthMultiplier: number;
    speedMultiplier: number;
    rewardMultiplier: number;
  }
> = {
  standard: {
    defaultShape: null,
    defaultColor: null,
    sizeMultiplier: 1,
    healthMultiplier: 1,
    speedMultiplier: 1,
    rewardMultiplier: 1,
  },
  swarm: {
    defaultShape: 'circle',
    defaultColor: '#79EBFF',
    sizeMultiplier: 0.78,
    healthMultiplier: 0.58,
    speedMultiplier: 1.22,
    rewardMultiplier: 0.62,
  },
  tank: {
    defaultShape: 'square',
    defaultColor: '#FFBB74',
    sizeMultiplier: 1.16,
    healthMultiplier: 1.48,
    speedMultiplier: 0.72,
    rewardMultiplier: 1.24,
  },
  splitter: {
    defaultShape: 'diamond',
    defaultColor: '#FF82B5',
    sizeMultiplier: 1.04,
    healthMultiplier: 0.92,
    speedMultiplier: 0.88,
    rewardMultiplier: 0.76,
  },
  boss: {
    defaultShape: 'diamond',
    defaultColor: '#FFD36B',
    sizeMultiplier: 1.52,
    healthMultiplier: 4.6,
    speedMultiplier: 0.34,
    rewardMultiplier: 4.8,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffleCopy<T>(items: readonly T[]) {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const previousValue = nextItems[index];
    nextItems[index] = nextItems[swapIndex];
    nextItems[swapIndex] = previousValue;
  }
  return nextItems;
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

function getDisplayTier(elapsedSeconds: number) {
  return getDifficultyTier(elapsedSeconds) + 1;
}

function formatCompactHealth(value: number) {
  const roundedValue = Math.max(0, Math.round(value));
  if (roundedValue < 1000) {
    return `${roundedValue}`;
  }
  if (roundedValue < 999950) {
    return `${(roundedValue / 1000).toFixed(1)}k`;
  }
  if (roundedValue < 10000000) {
    return `${(roundedValue / 1000000).toFixed(1)}M`;
  }
  return `${(roundedValue / 1000000).toFixed(1)}M`;
}

function getUpgradePressureMultiplier(collectedUpgradeCount: number) {
  return Math.min(24, Math.pow(1.18, collectedUpgradeCount));
}

function getTimePressureMultiplier(difficultyTier: number) {
  if (difficultyTier <= 8) {
    return Math.pow(1.24, difficultyTier);
  }
  if (difficultyTier <= 13) {
    return Math.pow(1.24, 8) * Math.pow(1.14, difficultyTier - 8);
  }
  return Math.pow(1.24, 8) * Math.pow(1.14, 5) * Math.pow(1.07, difficultyTier - 13);
}

function getUpgradeSpeedPenalty(collectedUpgradeCount: number) {
  return 1 - Math.min(0.18, collectedUpgradeCount * 0.014);
}

function getHealthSpeedPenalty(maxHealth: number) {
  if (maxHealth <= 100) {
    return 1;
  }
  if (maxHealth <= 200) {
    return lerp(1, 0.62, (maxHealth - 100) / 100);
  }
  if (maxHealth <= 350) {
    return lerp(0.62, 0.34, (maxHealth - 200) / 150);
  }
  if (maxHealth <= 500) {
    return lerp(0.34, 0.18, (maxHealth - 350) / 150);
  }
  if (maxHealth <= 900) {
    return lerp(0.18, 0.07, (maxHealth - 500) / 400);
  }
  return Math.max(0.04, 0.07 - (maxHealth - 900) * 0.00005);
}

function getEnemyReward(enemy: PrototypeEnemy) {
  return Math.max(10, Math.round(enemy.maxHealth * 10 * enemy.rewardMultiplier));
}

function getBossPhaseForHealth(enemy: PrototypeEnemy) {
  const healthRatio = enemy.health / Math.max(1, enemy.maxHealth);
  if (healthRatio > 0.66) {
    return 1;
  }
  if (healthRatio > 0.33) {
    return 2;
  }
  return 3;
}

function getBossLabel(variant: BossVariant) {
  return variant === 'bulwark' ? 'Bulwark Array' : 'Prism Core';
}

function getActiveBossEnemy(enemies: PrototypeEnemy[]) {
  return enemies.find((enemy) => enemy.archetype === 'boss' && enemy.health > 0) ?? null;
}

function shouldStartTierEvent(displayTier: number) {
  return displayTier >= TIER_EVENT_START_DISPLAY_TIER && displayTier % 2 === 0 && displayTier % BOSS_TIER_INTERVAL !== 0;
}

function createEncounter(type: PrototypeEncounterType, displayTier: number, elapsed: number): PrototypeEncounter {
  switch (type) {
    case 'swarmRush':
      return {
        type,
        label: 'Swarm Rush',
        accentColor: '#7DEEFF',
        endsAt: elapsed + 8.4,
        displayTier,
      };
    case 'fortressLine':
      return {
        type,
        label: 'Fortress Line',
        accentColor: '#FFC479',
        endsAt: elapsed + 9.2,
        displayTier,
      };
    case 'splitterStorm':
      return {
        type,
        label: 'Splitter Storm',
        accentColor: '#FF8DBB',
        endsAt: elapsed + 8.8,
        displayTier,
      };
    case 'salvageDrift':
      return {
        type,
        label: 'Salvage Drift',
        accentColor: '#8FC9FF',
        endsAt: elapsed + 7.6,
        displayTier,
      };
    case 'boss':
      return {
        type,
        label: 'Boss Intercept',
        accentColor: '#FFE08B',
        endsAt: null,
        displayTier,
      };
  }
}

function getTierEncounterType(displayTier: number): PrototypeEncounterType {
  const rotation: PrototypeEncounterType[] = ['swarmRush', 'fortressLine', 'splitterStorm', 'salvageDrift'];
  return rotation[Math.floor(displayTier / 2) % rotation.length];
}

function createSplitterChildren(
  state: PrototypeGameState,
  enemy: PrototypeEnemy,
  boardWidth: number
) {
  if (enemy.archetype !== 'splitter' || enemy.splitGeneration > 0) {
    return [] as PrototypeEnemy[];
  }

  const childCount = 2;
  const childHealth = Math.max(5, Math.round(enemy.maxHealth * 0.26));
  const childSize = clamp(enemy.size * 0.64, 26, MAX_ENEMY_RENDER_SIZE * 0.76);
  const childSpeed = Math.max(34, enemy.speed * 1.28);
  const children: PrototypeEnemy[] = [];

  for (let index = 0; index < childCount; index += 1) {
    const direction = index === 0 ? -1 : 1;
    children.push({
      id: `E${state.nextEnemyId}`,
      x: clamp(enemy.x + direction * enemy.size * 0.26, childSize / 2 + 8, boardWidth - childSize / 2 - 8),
      y: enemy.y + (Math.random() - 0.5) * 6,
      size: childSize,
      speed: childSpeed,
      health: childHealth,
      maxHealth: childHealth,
      shape: 'circle',
      archetype: 'swarm',
      bossVariant: null,
      bossPhase: 0,
      rewardMultiplier: 0.26,
      splitGeneration: enemy.splitGeneration + 1,
      color: '#87EEFF',
      flash: 0.45,
    });
    state.nextEnemyId += 1;
  }

  return children;
}

function createEnemyDefeatEffect(nextState: PrototypeGameState, enemy: PrototypeEnemy, colorOverride?: string) {
  const effectColor = colorOverride ?? enemy.color;
  const queuedEffects: PrototypeEffect[] = [
    createPrototypeEffect(
      'burst',
      enemy.x,
      enemy.y,
      enemy.archetype === 'tank' ? enemy.size * 1.38 : enemy.size * 1.2,
      effectColor,
      nextState.nextEffectId
    ),
  ];
  nextState.nextEffectId += 1;

  if (enemy.archetype === 'tank') {
    queuedEffects.push(createPrototypeEffect('pickup', enemy.x, enemy.y, enemy.size * 1.18, '#FFE4B8', nextState.nextEffectId));
    nextState.nextEffectId += 1;
  } else if (enemy.archetype === 'splitter') {
    queuedEffects.push(
      createPrototypeEffect('burst', enemy.x - enemy.size * 0.16, enemy.y, enemy.size * 0.78, '#FFD6EA', nextState.nextEffectId)
    );
    nextState.nextEffectId += 1;
    queuedEffects.push(
      createPrototypeEffect('burst', enemy.x + enemy.size * 0.16, enemy.y, enemy.size * 0.78, '#FFD6EA', nextState.nextEffectId)
    );
    nextState.nextEffectId += 1;
  } else if (enemy.archetype === 'boss') {
    queuedEffects.push(createPrototypeEffect('pickup', enemy.x, enemy.y, enemy.size * 1.34, '#FFF1C2', nextState.nextEffectId));
    nextState.nextEffectId += 1;
    queuedEffects.push(createPrototypeEffect('ultimate', enemy.x, enemy.y, enemy.size * 1.9, effectColor, nextState.nextEffectId));
    nextState.nextEffectId += 1;
  }

  nextState.effects = trimEffects([...nextState.effects, ...queuedEffects]);
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
    chaosTimer: 0,
    enemyCooldown: 5.4,
    upgradeCooldown: 10.8,
    nextBulletId: 1,
    nextEnemyId: 1,
    nextUpgradeId: 1,
    nextEffectId: 1,
    pickupMessage: 'Drag to move. Catch falling upgrades with the ship.',
    pickupTimer: 3.5,
    collectedUpgradeCount: 0,
    revealedUpgradeTypes: [],
    activeEncounter: null,
    lastProcessedDisplayTier: 1,
    bossEscortCooldown: 2.8,
    buildProtocol: null,
    buildProtocolLevel: 0,
    pendingArmoryChoice: null,
    queuedArmoryChoice: null,
    armoryTransitionTimer: 0,
    armoryTransitionLabel: null,
    armoryTransitionColor: null,
    ultimateCharge: 0,
  };
}

function createBulletVolleys(
  state: PrototypeGameState,
  boardHeight: number
): Pick<PrototypeGameState, 'bullets' | 'nextBulletId' | 'fireCooldown'> {
  const weapon = getActiveWeapon(state);
  const bullets = [...state.bullets];
  let nextBulletId = state.nextBulletId;
  const centerIndex = (weapon.shotCount - 1) / 2;
  const muzzleY = boardHeight - PLAYER_HEIGHT - 18;
  const aimTarget = findAimAssistTarget(state.enemies, state.playerX, muzzleY);

  for (let index = 0; index < weapon.shotCount; index += 1) {
    const lane = index - centerIndex;
    const originX = state.playerX + lane * weapon.spread;
    const jitter = weapon.spreadJitter > 0 ? (Math.random() - 0.5) * weapon.spreadJitter * 0.015 : 0;
    const defaultAngle = lane * 0.085 + jitter;
    let angle = defaultAngle;
    if (aimTarget) {
      const desiredAngle = Math.atan2(aimTarget.x - originX, muzzleY - aimTarget.y);
      const angleDelta = clamp(normalizeAngle(desiredAngle - defaultAngle), -0.28, 0.28);
      angle += angleDelta * weapon.aimAssist;
    }
    const vx = Math.sin(angle) * weapon.bulletSpeed * 0.42;
    const vy = -Math.cos(angle) * weapon.bulletSpeed;
    bullets.push({
      id: `B${nextBulletId}`,
      kind: 'standard',
      x: originX,
      y: muzzleY,
      angle,
      speed: weapon.bulletSpeed,
      vx,
      vy,
      damage: weapon.damage,
      size: weapon.bulletSize,
      pierce: weapon.pierce,
      age: 0,
      phase: Math.random() * Math.PI * 2,
      aimAssist: weapon.aimAssist,
      color: weapon.bulletColor,
      glowColor: weapon.glowColor,
      trailScale: weapon.trailScale,
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
    fireCooldown: weapon.fireInterval,
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
  const duration =
    kind === 'muzzle' ? 0.12 : kind === 'pickup' ? 0.42 : kind === 'bombard' ? 0.52 : kind === 'ultimate' ? 0.64 : 0.28;
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

function queueEffect(
  state: PrototypeGameState,
  kind: PrototypeEffectKind,
  x: number,
  y: number,
  size: number,
  color: string
) {
  state.effects = trimEffects([...state.effects, createPrototypeEffect(kind, x, y, size, color, state.nextEffectId)]);
  state.nextEffectId += 1;
}

function getBombardDamage(state: PrototypeGameState, enemy: PrototypeEnemy) {
  const difficultyTier = getDifficultyTier(state.elapsed);
  const weapon = getActiveWeapon(state);
  const flatDamage = 34 + weapon.damage * 8 + difficultyTier * 6 + weapon.effectIntensity * 10;
  const percentDamage = 0.28 + Math.min(0.12, weapon.effectIntensity * 0.04);
  return Math.round(Math.max(flatDamage, enemy.maxHealth * percentDamage));
}

function triggerBombardment(state: PrototypeGameState, boardWidth: number, boardHeight: number) {
  const queuedEffects: PrototypeEffect[] = [];
  const spawnedEnemies: PrototypeEnemy[] = [];
  const strikeCount = Math.min(6, Math.max(4, Math.round(boardWidth / 96)));

  for (let index = 0; index < strikeCount; index += 1) {
    const laneX = ((index + 0.5) / strikeCount) * boardWidth;
    const strikeX = clamp(laneX + (Math.random() - 0.5) * Math.min(26, boardWidth * 0.08), 20, boardWidth - 20);
    queuedEffects.push(
      createPrototypeEffect('bombard', strikeX, boardHeight * 0.48, boardHeight * 0.96, '#FFB26B', state.nextEffectId)
    );
    state.nextEffectId += 1;
  }

  queuedEffects.push(
    createPrototypeEffect(
      'pickup',
      state.playerX,
      getPlayerShipTop(boardHeight) + PLAYER_HEIGHT * 0.35,
      70,
      '#FFBF73',
      state.nextEffectId
    )
  );
  state.nextEffectId += 1;

  const activeEnemies = state.enemies.filter((enemy) => enemy.health > 0);
  const burstStride = Math.max(1, Math.ceil(activeEnemies.length / 7));
  let activeIndex = 0;

  for (const enemy of state.enemies) {
    if (enemy.health <= 0) {
      continue;
    }

    const previousEnemyHealth = enemy.health;
    const damage = getBombardDamage(state, enemy);
    enemy.health = Math.max(0, Math.round(enemy.health - damage));
    enemy.flash = 1;

    updateBossPhaseAfterDamage(state, enemy, previousEnemyHealth);

    if (enemy.health <= 0) {
      spawnedEnemies.push(...resolveEnemyDefeat(state, enemy, boardWidth, false));
      continue;
    }

    if (activeIndex % burstStride === 0) {
      queuedEffects.push(createPrototypeEffect('burst', enemy.x, enemy.y, enemy.size * 0.96, '#FFB26B', state.nextEffectId));
      state.nextEffectId += 1;
    }
    activeIndex += 1;
  }

  state.enemies = [
    ...state.enemies.filter((enemy) => enemy.health > 0),
    ...spawnedEnemies,
  ];
  state.effects = trimEffects([...state.effects, ...queuedEffects]);
}

function getMissileVolleyCooldown(weapon: PrototypeWeapon, state: PrototypeGameState) {
  const support = getBuildProtocolSupport(state);
  return Math.max(0.72, (2.35 - weapon.missileLevel * 0.42 - weapon.effectIntensity * 0.1) * support.missileCooldownMultiplier);
}

function getShatterVolleyCooldown(weapon: PrototypeWeapon, state: PrototypeGameState) {
  const support = getBuildProtocolSupport(state);
  return Math.max(0.92, (2.75 - weapon.shatterLevel * 0.38 - weapon.effectIntensity * 0.1) * support.shatterCooldownMultiplier);
}

function createMissileVolley(
  state: PrototypeGameState,
  boardHeight: number
): Pick<PrototypeGameState, 'bullets' | 'nextBulletId' | 'missileCooldown'> & {
  launchPoints: { x: number; y: number; color: string; size: number }[];
} {
  const weapon = getActiveWeapon(state);
  const support = getBuildProtocolSupport(state);
  const bullets = [...state.bullets];
  let nextBulletId = state.nextBulletId;
  const muzzleY = boardHeight - PLAYER_HEIGHT - 14;
  const shouldUseFourMissiles = weapon.missileLevel >= 2 || support.missileCountFloor >= 4;
  const slots = shouldUseFourMissiles ? [-1.5, -0.5, 0.5, 1.5] : [-1, 1];
  const launchPoints: { x: number; y: number; color: string; size: number }[] = [];
  const missileSpeed = Math.min(980, weapon.bulletSpeed * 0.82 + 120 + weapon.missileLevel * 42);
  const missileDamage = weapon.damage + 2 + weapon.missileLevel * 2 + support.missileDamageBonus;
  const missileSize = weapon.bulletSize + 3.2;
  const slotSpacing = slots.length === 4 ? 13 : 18;

  for (const slot of slots) {
    const curveDirection = Math.sign(slot);
    const curveStrength = slots.length === 4 ? Math.abs(slot) / 1.5 : 1;
    const originX = state.playerX + slot * slotSpacing;
    const angle = curveDirection * (1.16 + curveStrength * 0.26);
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
      pierce: weapon.pierce,
      age: 0,
      phase: Math.random() * Math.PI * 2,
      aimAssist: Math.max(0.18, weapon.aimAssist + 0.12 + weapon.missileLevel * 0.04),
      color: '#FFE8D8',
      glowColor: '#FF7B63',
      trailScale: Math.max(1.45, weapon.trailScale + 0.38),
      curveDirection,
      launchDuration: 0.38 + curveStrength * 0.08 + Math.random() * 0.04,
      turnRate: 0.42 + weapon.missileLevel * 0.12 + curveStrength * 0.04 + support.missileTurnBonus,
      maxAge: null,
      burstAge: null,
      fragmentCount: 0,
    });
    launchPoints.push({
      x: originX,
      y: muzzleY + 2,
      color: '#FFC3B6',
      size: 16 + weapon.effectIntensity * 5,
    });
    nextBulletId += 1;
  }

  return {
    bullets,
    nextBulletId,
    missileCooldown: getMissileVolleyCooldown(weapon, state),
    launchPoints,
  };
}

function createShatterVolley(
  state: PrototypeGameState,
  boardHeight: number
): Pick<PrototypeGameState, 'bullets' | 'nextBulletId' | 'shatterCooldown'> & {
  launchPoint: { x: number; y: number; color: string; size: number };
} {
  const weapon = getActiveWeapon(state);
  const support = getBuildProtocolSupport(state);
  const bullets = [...state.bullets];
  let nextBulletId = state.nextBulletId;
  const muzzleY = boardHeight - PLAYER_HEIGHT - 20;
  const aimTarget = findAimAssistTarget(state.enemies, state.playerX, muzzleY);
  const defaultAngle = (Math.random() - 0.5) * 0.12;
  let angle = defaultAngle;
  if (aimTarget) {
    const desiredAngle = Math.atan2(aimTarget.x - state.playerX, muzzleY - aimTarget.y);
    const angleDelta = clamp(normalizeAngle(desiredAngle - defaultAngle), -0.22, 0.22);
    angle += angleDelta * Math.min(0.18, weapon.aimAssist + 0.08);
  }

  const shellSpeed = Math.min(860, weapon.bulletSpeed * 0.74 + 70 + weapon.shatterLevel * 18);
  const shellSize = weapon.bulletSize + 4 + weapon.shatterLevel * 0.45;
  bullets.push({
    id: `B${nextBulletId}`,
    kind: 'shatterShell',
    x: state.playerX,
    y: muzzleY,
    angle,
    speed: shellSpeed,
    vx: Math.sin(angle) * shellSpeed * 0.42,
    vy: -Math.cos(angle) * shellSpeed,
    damage: weapon.damage + 2 + weapon.shatterLevel + support.shatterDamageBonus,
    size: shellSize,
    pierce: 0,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    aimAssist: Math.min(0.18, weapon.aimAssist * 0.6 + 0.06),
    color: '#FFE7C8',
    glowColor: '#FFB36B',
    trailScale: Math.max(1.25, weapon.trailScale + 0.22),
    curveDirection: 0,
    launchDuration: 0,
    turnRate: 0,
    maxAge: 0.72 + weapon.shatterLevel * 0.05,
    burstAge: 0.34 - weapon.shatterLevel * 0.02,
    fragmentCount: 4 + weapon.shatterLevel + support.shatterFragmentBonus,
  });
  nextBulletId += 1;

  return {
    bullets,
    nextBulletId,
    shatterCooldown: getShatterVolleyCooldown(weapon, state),
    launchPoint: {
      x: state.playerX,
      y: muzzleY,
      color: '#FFD8A8',
      size: 18 + weapon.effectIntensity * 5,
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

function createBossEnemy(
  state: PrototypeGameState,
  boardWidth: number,
  displayTier: number
): Pick<PrototypeGameState, 'enemies' | 'nextEnemyId'> {
  const difficultyTier = Math.max(0, displayTier - 1);
  const variant: BossVariant = displayTier % 10 === 0 ? 'bulwark' : 'prism';
  const timePressureMultiplier = getTimePressureMultiplier(difficultyTier);
  const upgradePressureMultiplier = 1 + Math.min(1.7, state.collectedUpgradeCount * 0.085);
  const maxHealth = Math.max(
    260,
    Math.round((84 + difficultyTier * 18) * timePressureMultiplier * upgradePressureMultiplier * 2.65)
  );
  const size = clamp(76 + difficultyTier * 2.1 + Math.sqrt(maxHealth) * 0.52, 94, 148);
  const healthSpeedPenalty = getHealthSpeedPenalty(maxHealth);
  const speed = Math.max(
    7,
    (24 + difficultyTier * 1.8) * getUpgradeSpeedPenalty(state.collectedUpgradeCount) * healthSpeedPenalty * 0.92
  );
  const shape: EnemyShape = variant === 'bulwark' ? 'square' : 'diamond';
  const color = variant === 'bulwark' ? '#FFD36B' : '#FF80C6';
  const boss: PrototypeEnemy = {
    id: `E${state.nextEnemyId}`,
    x: boardWidth / 2,
    y: -size * 0.92,
    size,
    speed,
    health: maxHealth,
    maxHealth,
    shape,
    archetype: 'boss',
    bossVariant: variant,
    bossPhase: 1,
    rewardMultiplier: 5.8,
    splitGeneration: 0,
    color,
    flash: 0,
  };

  return {
    enemies: [...state.enemies, boss],
    nextEnemyId: state.nextEnemyId + 1,
  };
}

function buildEncounterSpawnDrafts(
  state: PrototypeGameState,
  boardWidth: number,
  encounter: PrototypeEncounter
): { cooldown: number; drafts: EnemySpawnDraft[] } {
  const lanes = getSpawnLanes(boardWidth);
  const centerLane = Math.floor(Math.random() * lanes.length);
  const activeEnemyCount = state.enemies.length;

  if (activeEnemyCount >= 12) {
    return {
      cooldown: 1.3 + Math.min(0.6, (activeEnemyCount - 12) * 0.08),
      drafts: [] as EnemySpawnDraft[],
    };
  }

  switch (encounter.type) {
    case 'swarmRush': {
      const drafts: EnemySpawnDraft[] = [
        {
          x: lanes[centerLane],
          archetype: 'swarm',
          sizeMultiplier: 0.84,
          healthMultiplier: 0.74,
          speedMultiplier: 1.18,
        },
      ];
      if (activeEnemyCount <= 8) {
        const leftLane = Math.max(0, centerLane - 1);
        const rightLane = Math.min(lanes.length - 1, centerLane + 1);
        if (leftLane !== centerLane) {
          drafts.push({
            x: lanes[leftLane],
            archetype: 'swarm',
            sizeMultiplier: 0.8,
            healthMultiplier: 0.7,
            speedMultiplier: 1.22,
          });
        }
        if (rightLane !== centerLane && activeEnemyCount <= 6) {
          drafts.push({
            x: lanes[rightLane],
            archetype: 'swarm',
            sizeMultiplier: 0.8,
            healthMultiplier: 0.7,
            speedMultiplier: 1.22,
          });
        }
      }
      return {
        cooldown: 3.25 + activeEnemyCount * 0.08,
        drafts,
      };
    }
    case 'fortressLine': {
      const drafts: EnemySpawnDraft[] = [
        {
          x: lanes[centerLane],
          archetype: 'tank',
          shape: 'square',
          color: '#FFBE73',
          sizeMultiplier: 1.08,
          healthMultiplier: 1.16,
          speedMultiplier: 0.88,
        },
      ];
      if (activeEnemyCount <= 7) {
        const flankLane = centerLane <= 2 ? centerLane + 2 : centerLane - 2;
        drafts.push({
          x: lanes[clamp(flankLane, 0, lanes.length - 1)],
          shape: 'diamond',
          color: '#FF89B8',
          sizeMultiplier: 0.96,
          healthMultiplier: 0.92,
          speedMultiplier: 0.94,
        });
      }
      return {
        cooldown: 4.8 + activeEnemyCount * 0.08,
        drafts,
      };
    }
    case 'splitterStorm': {
      const drafts: EnemySpawnDraft[] = [
        {
          x: lanes[centerLane],
          archetype: 'splitter',
          shape: 'diamond',
          color: '#FF8CBC',
          sizeMultiplier: 1.04,
          healthMultiplier: 0.96,
          speedMultiplier: 0.9,
        },
      ];
      if (activeEnemyCount <= 8) {
        const sideLane = centerLane <= 1 ? centerLane + 1 : centerLane >= lanes.length - 2 ? centerLane - 1 : centerLane + (Math.random() < 0.5 ? -1 : 1);
        drafts.push({
          x: lanes[sideLane],
          archetype: 'swarm',
          sizeMultiplier: 0.82,
          healthMultiplier: 0.76,
          speedMultiplier: 1.16,
        });
      }
      return {
        cooldown: 4.15 + activeEnemyCount * 0.06,
        drafts,
      };
    }
    case 'salvageDrift':
      return {
        cooldown: 5 + activeEnemyCount * 0.08,
        drafts: [
          {
            x: lanes[centerLane],
            shape: 'circle',
            color: '#8FD5FF',
            sizeMultiplier: 0.94,
            healthMultiplier: 0.88,
            speedMultiplier: 0.86,
          },
        ],
      };
    case 'boss':
      return {
        cooldown: 2.4,
        drafts: [],
      };
  }
}

function buildBossEscortDrafts(
  state: PrototypeGameState,
  boardWidth: number,
  boss: PrototypeEnemy
): { cooldown: number; drafts: EnemySpawnDraft[] } {
  const activeEnemyCount = state.enemies.filter((enemy) => enemy.health > 0 && enemy.id !== boss.id).length;
  if (activeEnemyCount >= 6) {
    return {
      cooldown: 1.6 + Math.min(0.7, (activeEnemyCount - 6) * 0.12),
      drafts: [] as EnemySpawnDraft[],
    };
  }

  const lanes = getSpawnLanes(boardWidth);
  const phase = Math.max(1, boss.bossPhase || getBossPhaseForHealth(boss));
  const leftLane = lanes[1];
  const rightLane = lanes[lanes.length - 2];
  const preferRight = boss.x <= boardWidth / 2;
  const primaryLane = preferRight ? rightLane : leftLane;
  const secondaryLane = preferRight ? leftLane : rightLane;
  const drafts: EnemySpawnDraft[] = [
    {
      x: primaryLane,
      archetype: 'swarm',
      sizeMultiplier: 0.82,
      healthMultiplier: 0.74,
      speedMultiplier: 0.9,
    },
  ];

  if (phase >= 2 && activeEnemyCount <= 4) {
    drafts.push({
      x: secondaryLane,
      archetype: phase >= 3 ? 'splitter' : 'standard',
      shape: phase >= 3 ? 'diamond' : 'circle',
      color: phase >= 3 ? '#FF8CBD' : '#7BEAFF',
      sizeMultiplier: phase >= 3 ? 0.92 : 0.84,
      healthMultiplier: phase >= 3 ? 0.88 : 0.72,
      speedMultiplier: phase >= 3 ? 0.72 : 0.84,
    });
  }

  return {
    cooldown: 3.45 - phase * 0.28 + activeEnemyCount * 0.1,
    drafts,
  };
}

function buildEnemySpawnDrafts(
  state: PrototypeGameState,
  boardWidth: number
): { cooldown: number; drafts: EnemySpawnDraft[] } {
  const activeBoss = getActiveBossEnemy(state.enemies);
  if (activeBoss) {
    return {
      cooldown: 1.4,
      drafts: [] as EnemySpawnDraft[],
    };
  }

  if (state.activeEncounter && state.activeEncounter.type !== 'boss') {
    return buildEncounterSpawnDrafts(state, boardWidth, state.activeEncounter);
  }

  const difficultyTier = getDifficultyTier(state.elapsed);
  const isCrowdClampTier = difficultyTier >= 13;
  const isLateCrowdClampTier = difficultyTier >= 16;
  const activeEnemyCount = state.enemies.length;
  const lanes = getSpawnLanes(boardWidth);
  const centerLane = Math.floor(Math.random() * lanes.length);
  const drafts: EnemySpawnDraft[] = [{ x: lanes[centerLane] }];
  let cooldown = Math.max(1.45, 4.15 - difficultyTier * 0.06 - Math.random() * 0.24);
  const sideSpawnChance = isLateCrowdClampTier
    ? Math.min(0.028, 0.008 + (difficultyTier - 16) * 0.003)
    : isCrowdClampTier
      ? Math.min(0.055, 0.014 + (difficultyTier - 13) * 0.004)
      : Math.min(0.14, 0.02 + difficultyTier * 0.012);
  const flankBurstChance = isLateCrowdClampTier
    ? activeEnemyCount >= 14
      ? 0
      : Math.min(0.008, 0.002 + (difficultyTier - 16) * 0.0025)
    : isCrowdClampTier
      ? Math.min(0.025, 0.006 + (difficultyTier - 13) * 0.004)
      : Math.min(0.08, 0.01 + difficultyTier * 0.006);
  const eliteSpawnChance = isLateCrowdClampTier
    ? Math.min(0.028, 0.008 + (difficultyTier - 16) * 0.003)
    : isCrowdClampTier
      ? Math.min(0.05, 0.01 + (difficultyTier - 13) * 0.004)
      : Math.min(0.08, 0.01 + difficultyTier * 0.008);
  const tankSpawnChance = difficultyTier >= 6 ? (isLateCrowdClampTier ? 0.18 : isCrowdClampTier ? 0.24 : 0.28) : 0;
  const splitterSpawnChance =
    difficultyTier >= 9 && activeEnemyCount <= 12 ? (isCrowdClampTier ? 0.08 : 0.12 + Math.min(0.05, (difficultyTier - 9) * 0.008)) : 0;

  if (difficultyTier >= 6 && Math.random() < sideSpawnChance) {
    const sideOffset = centerLane <= 1 ? 1 : centerLane >= lanes.length - 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
    drafts.push({
      x: lanes[centerLane + sideOffset],
      archetype: 'swarm',
      sizeMultiplier: 0.88,
      healthMultiplier: 0.8,
      speedMultiplier: 1.04,
    });
    cooldown += 0.42;
  }

  if (difficultyTier >= 10 && Math.random() < flankBurstChance) {
    const leftLane = Math.max(0, centerLane - 1);
    const rightLane = Math.min(lanes.length - 1, centerLane + 1);
    const flankDraft = {
      archetype: 'swarm' as const,
      sizeMultiplier: 0.86,
      healthMultiplier: 0.78,
      speedMultiplier: 1.12,
      shape: 'circle' as const,
    };

    if (isCrowdClampTier) {
      const flankLane = Math.random() < 0.5 ? leftLane : rightLane;
      if (flankLane !== centerLane) {
        drafts.push({
          x: lanes[flankLane],
          ...flankDraft,
        });
      }
    } else {
      if (leftLane !== centerLane) {
        drafts.push({
          x: lanes[leftLane],
          ...flankDraft,
        });
      }
      if (rightLane !== centerLane && rightLane !== leftLane) {
        drafts.push({
          x: lanes[rightLane],
          ...flankDraft,
        });
      }
    }
    cooldown += isCrowdClampTier ? 0.72 : 0.56;
  }

  if (drafts.length > 0) {
    if (Math.random() < splitterSpawnChance) {
      drafts[0] = {
        ...drafts[0],
        archetype: 'splitter',
        shape: drafts[0].shape ?? 'diamond',
        color: drafts[0].color ?? '#FF83B7',
        sizeMultiplier: (drafts[0].sizeMultiplier ?? 1) * 1.02,
        healthMultiplier: (drafts[0].healthMultiplier ?? 1) * 0.94,
        speedMultiplier: (drafts[0].speedMultiplier ?? 1) * 0.92,
      };
      cooldown += 0.22;
    } else if (Math.random() < tankSpawnChance) {
      drafts[0] = {
        ...drafts[0],
        archetype: 'tank',
        shape: drafts[0].shape ?? 'square',
        color: drafts[0].color ?? '#FFBA74',
        sizeMultiplier: (drafts[0].sizeMultiplier ?? 1) * 1.1,
        healthMultiplier: (drafts[0].healthMultiplier ?? 1) * 1.14,
        speedMultiplier: (drafts[0].speedMultiplier ?? 1) * 0.88,
      };
      cooldown += 0.16;
    }
  }

  if (difficultyTier >= 8 && Math.random() < eliteSpawnChance) {
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

  if (difficultyTier >= 8) {
    cooldown += 0.2 + Math.min(0.18, (difficultyTier - 8) * 0.05);
  }

  if (isLateCrowdClampTier) {
    cooldown += 1.05 + Math.min(0.9, (difficultyTier - 16) * 0.22) + Math.min(0.75, Math.max(0, activeEnemyCount - 10) * 0.09);
  } else if (isCrowdClampTier) {
    cooldown += 0.8 + Math.min(0.5, (difficultyTier - 13) * 0.16);
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
  const archetype = draft?.archetype ?? 'standard';
  const archetypeSettings = ENEMY_ARCHETYPE_SETTINGS[archetype];
  const sizeMultiplier = (draft?.sizeMultiplier ?? 1) * archetypeSettings.sizeMultiplier;
  const healthMultiplier = (draft?.healthMultiplier ?? 1) * archetypeSettings.healthMultiplier;
  const speedMultiplier = (draft?.speedMultiplier ?? 1) * archetypeSettings.speedMultiplier;
  const baseSize = clamp((28 + difficultyTier * 1.2 + Math.random() * 12) * sizeMultiplier, 28, 74);
  const shapePool: EnemyShape[] =
    difficultyTier >= 7 ? ['circle', 'square', 'diamond'] : difficultyTier >= 4 ? ['circle', 'square'] : ['circle'];
  const shape = draft?.shape ?? archetypeSettings.defaultShape ?? randomChoice(shapePool);
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
  const isEarlyMidTankPressureTier = difficultyTier >= 9 && difficultyTier <= 24;
  const tankierEnemySpeedBoost =
    archetype !== 'boss' && isEarlyMidTankPressureTier && maxHealth >= 180 && maxHealth <= 650 ? 1.12 : 1;
  const speed =
    (54 + difficultyTier * 4.8 + Math.random() * 16) *
    speedMultiplier *
    upgradeSpeedPenalty *
    healthSpeedPenalty *
    tankierEnemySpeedBoost;
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
    archetype,
    bossVariant: null,
    bossPhase: 0,
    rewardMultiplier: (draft?.rewardMultiplier ?? 1) * archetypeSettings.rewardMultiplier,
    splitGeneration: draft?.splitGeneration ?? 0,
    color: draft?.color ?? archetypeSettings.defaultColor ?? randomChoice(ENEMY_PALETTE),
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
): Pick<PrototypeGameState, 'upgrades' | 'nextUpgradeId' | 'upgradeCooldown' | 'revealedUpgradeTypes'> {
  const difficultyTier = getDifficultyTier(state.elapsed);
  const missingGuaranteedTypes = getMissingGuaranteedUpgradeTypes(state);
  const shouldForceReveal = difficultyTier <= GUARANTEED_UPGRADE_REVEAL_TIER && missingGuaranteedTypes.length > 0;
  const standardTypePool = getStandardUpgradeTypePool(state, difficultyTier);
  const typePool = state.nextUpgradeId === 1 ? OPENING_UPGRADE_TYPES : standardTypePool;
  const type =
    shouldForceReveal && state.nextUpgradeId === 2 && missingGuaranteedTypes.includes('twin') && state.weapon.shotCount <= 1
      ? 'twin'
      : shouldForceReveal
        ? randomChoice(missingGuaranteedTypes)
        : state.nextUpgradeId === 2 &&
            state.weapon.shotCount <= 1 &&
            state.weapon.missileLevel === 0 &&
            state.weapon.shatterLevel === 0
      ? 'twin'
      : randomChoice(typePool);
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
    upgradeCooldown: shouldForceReveal ? 8.2 + Math.random() * 2.4 : 14.2 + Math.random() * 4.8,
    revealedUpgradeTypes: state.revealedUpgradeTypes.includes(type) ? state.revealedUpgradeTypes : [...state.revealedUpgradeTypes, type],
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

function applyEncounterTransition(state: PrototypeGameState, displayTier: number) {
  if (getActiveBossEnemy(state.enemies)) {
    return;
  }

  if (displayTier % BOSS_TIER_INTERVAL === 0) {
    state.activeEncounter = createEncounter('boss', displayTier, state.elapsed);
    state.enemyCooldown = Math.min(state.enemyCooldown, 0.18);
    state.bossEscortCooldown = 2.4;
    state.pickupMessage = `Boss contact incoming at T${displayTier}`;
    state.pickupTimer = 2.3;
    return;
  }

  if (shouldStartTierEvent(displayTier)) {
    const encounter = createEncounter(getTierEncounterType(displayTier), displayTier, state.elapsed);
    state.activeEncounter = encounter;
    state.enemyCooldown = Math.min(state.enemyCooldown, 0.72);
    state.pickupMessage = `${encounter.label} engaged`;
    state.pickupTimer = 1.9;
    if (encounter.type === 'salvageDrift') {
      state.upgradeCooldown = Math.min(state.upgradeCooldown, 2.2);
    }
    return;
  }
}

function resolveEnemyDefeat(
  nextState: PrototypeGameState,
  enemy: PrototypeEnemy,
  boardWidth: number,
  shouldGrantUltimateCharge = true
) {
  nextState.score += getEnemyReward(enemy);
  if (shouldGrantUltimateCharge) {
    addUltimateCharge(nextState, getUltimateKillCharge(enemy));
  }
  createEnemyDefeatEffect(
    nextState,
    enemy,
    enemy.archetype === 'boss' ? (enemy.bossVariant === 'bulwark' ? '#FFE3A0' : '#FFC1E5') : undefined
  );

  const spawnedEnemies = createSplitterChildren(nextState, enemy, boardWidth);

  if (enemy.archetype === 'boss' && enemy.bossVariant) {
    const sourceDisplayTier = nextState.activeEncounter?.displayTier ?? getDisplayTier(nextState.elapsed);
    const rewardEffectSize = enemy.size * 1.62;
    const transitionColor = enemy.bossVariant === 'bulwark' ? '#FFE3A0' : '#FFC1E5';
    queueEffect(nextState, 'pickup', enemy.x, enemy.y, rewardEffectSize, enemy.color);
    queueEffect(nextState, 'ultimate', enemy.x, enemy.y, enemy.size * 2.45, transitionColor);
    for (const lingeringEnemy of nextState.enemies) {
      if (lingeringEnemy.id === enemy.id || lingeringEnemy.health <= 0) {
        continue;
      }
      lingeringEnemy.health = 0;
      lingeringEnemy.flash = 1;
      createEnemyDefeatEffect(nextState, lingeringEnemy, transitionColor);
    }
    nextState.activeEncounter = null;
    nextState.bossEscortCooldown = 2.8;
    nextState.enemyCooldown = Math.max(nextState.enemyCooldown, BOSS_CLEAR_TRANSITION_SECONDS + 1.1);
    nextState.pickupMessage = `${getBossLabel(enemy.bossVariant)} neutralized`;
    nextState.pickupTimer = BOSS_CLEAR_TRANSITION_SECONDS;
    nextState.queuedArmoryChoice = createArmoryChoice(nextState, sourceDisplayTier);
    nextState.armoryTransitionTimer = BOSS_CLEAR_TRANSITION_SECONDS;
    nextState.armoryTransitionLabel = `${getBossLabel(enemy.bossVariant)} neutralized`;
    nextState.armoryTransitionColor = transitionColor;
  }

  return spawnedEnemies;
}

function updateBossPhaseAfterDamage(
  state: PrototypeGameState,
  enemy: PrototypeEnemy,
  previousEnemyHealth: number
) {
  if (enemy.archetype !== 'boss' || enemy.health <= 0) {
    return;
  }

  const previousBossPhase = enemy.bossPhase || getBossPhaseForHealth({ ...enemy, health: previousEnemyHealth });
  const nextBossPhase = getBossPhaseForHealth(enemy);
  enemy.bossPhase = nextBossPhase;
  if (nextBossPhase > previousBossPhase) {
    enemy.speed *= 1.06;
    state.bossEscortCooldown = Math.min(state.bossEscortCooldown, 0.45);
    state.pickupMessage = `${getBossLabel(enemy.bossVariant ?? 'prism')} phase ${nextBossPhase}`;
    state.pickupTimer = 1.6;
    state.effects = trimEffects([
      ...state.effects,
      createPrototypeEffect('pickup', enemy.x, enemy.y, enemy.size * 1.15, enemy.color, state.nextEffectId),
    ]);
    state.nextEffectId += 1;
  }
}

function triggerUltimate(state: PrototypeGameState, boardWidth: number, boardHeight: number) {
  if (state.ultimateCharge < MAX_ULTIMATE_CHARGE) {
    return;
  }

  const activeEnemies = state.enemies.filter((enemy) => enemy.health > 0);
  if (activeEnemies.length === 0) {
    return;
  }

  const definition = getUltimateDefinition(state);
  const weapon = getActiveWeapon(state);
  const protocolLevel = Math.max(1, state.buildProtocolLevel || 1);
  const shipEffectY = getPlayerShipTop(boardHeight) + PLAYER_HEIGHT * 0.28;
  const threatTargets = [...activeEnemies].sort((left, right) => {
    const threatDelta = right.y - left.y;
    if (Math.abs(threatDelta) > 6) {
      return threatDelta;
    }
    return right.maxHealth - left.maxHealth;
  });
  const spawnedEnemies: PrototypeEnemy[] = [];

  state.ultimateCharge = 0;
  state.pickupMessage = `${definition.label} engaged`;
  state.pickupTimer = 2.2;
  queueEffect(state, 'ultimate', state.playerX, shipEffectY, Math.max(boardWidth, boardHeight) * 0.84, definition.color);
  queueEffect(state, 'pickup', state.playerX, shipEffectY, 88 + protocolLevel * 10, definition.color);

  const applyUltimateDamage = (enemy: PrototypeEnemy, damage: number, effectColor: string) => {
    const previousEnemyHealth = enemy.health;
    enemy.health = Math.max(0, Math.round(enemy.health - damage));
    enemy.flash = 1;
    updateBossPhaseAfterDamage(state, enemy, previousEnemyHealth);

    if (enemy.health <= 0) {
      spawnedEnemies.push(...resolveEnemyDefeat(state, enemy, boardWidth, false));
      return;
    }

    queueEffect(state, 'burst', enemy.x, enemy.y, enemy.size * 1.02, effectColor);
  };

  switch (state.buildProtocol) {
    case 'railFocus': {
      const targetCount = Math.min(6, 4 + protocolLevel);
      for (const enemy of threatTargets.slice(0, targetCount)) {
        queueEffect(state, 'bombard', enemy.x, boardHeight * 0.48, boardHeight * 0.92, definition.color);
        queueEffect(state, 'ultimate', enemy.x, enemy.y, enemy.size * 1.26, '#FFD4F7');
        applyUltimateDamage(
          enemy,
          Math.max(96 + weapon.damage * 16 + protocolLevel * 24, enemy.maxHealth * (0.26 + protocolLevel * 0.06)),
          '#FFD4F7'
        );
      }
      break;
    }
    case 'novaBloom': {
      const bloomBursts = 5 + protocolLevel * 2;
      for (let index = 0; index < bloomBursts; index += 1) {
        const progress = (index + 0.5) / bloomBursts;
        const angle = progress * Math.PI * 2;
        const radius = lerp(boardWidth * 0.12, boardWidth * 0.42, (index % 3) / 2);
        const bloomX = clamp(state.playerX + Math.cos(angle) * radius, 42, boardWidth - 42);
        const bloomY = clamp(boardHeight * 0.46 + Math.sin(angle) * boardHeight * 0.2, 58, boardHeight - 84);
        queueEffect(state, 'ultimate', bloomX, bloomY, Math.max(boardWidth, boardHeight) * (0.18 + (index % 2) * 0.05), '#FFD789');
        if (index % 2 === 0) {
          queueEffect(state, 'pickup', bloomX, bloomY, 44 + protocolLevel * 6, '#FFF0B2');
        }
      }
      for (const enemy of activeEnemies) {
        const proximityToBottom = clamp(enemy.y / Math.max(1, boardHeight), 0.12, 1);
        const intensity = 0.74 + proximityToBottom * 0.5;
        applyUltimateDamage(
          enemy,
          Math.max(40 + weapon.damage * 12 + protocolLevel * 12, enemy.maxHealth * (0.16 + protocolLevel * 0.035)) * intensity,
          '#FFD79A'
        );
      }
      break;
    }
    case 'missileCommand': {
      const targetCount = Math.min(8, 5 + protocolLevel);
      const salvoCount = Math.min(4, 2 + protocolLevel);
      for (let index = 0; index < salvoCount; index += 1) {
        const strikeX = ((index + 0.5) / salvoCount) * boardWidth;
        queueEffect(state, 'bombard', strikeX, boardHeight * 0.5, boardHeight * 0.98, definition.color);
      }
      for (const enemy of threatTargets.slice(0, targetCount)) {
        queueEffect(state, 'bombard', enemy.x, boardHeight * 0.48, boardHeight * 0.96, definition.color);
        queueEffect(state, 'pickup', enemy.x, enemy.y, enemy.size * 0.8, '#FFE4D8');
        applyUltimateDamage(
          enemy,
          Math.max(74 + weapon.damage * 13 + protocolLevel * 18, enemy.maxHealth * (0.22 + protocolLevel * 0.05)),
          '#FFC7BF'
        );
      }
      break;
    }
    case 'fractureCore': {
      const focusedTargets = threatTargets.slice(0, Math.min(4, 2 + protocolLevel));
      for (const enemy of focusedTargets) {
        queueEffect(state, 'ultimate', enemy.x, enemy.y, enemy.size * 1.38, '#FFE4BE');
      }
      for (const enemy of activeEnemies) {
        const isFocused = focusedTargets.includes(enemy);
        const baseDamage = Math.max(34 + weapon.damage * 10 + protocolLevel * 10, enemy.maxHealth * (0.14 + protocolLevel * 0.03));
        const bonusDamage = isFocused
          ? Math.max(22 + protocolLevel * 10, enemy.maxHealth * (0.11 + protocolLevel * 0.025))
          : 0;
        applyUltimateDamage(enemy, baseDamage + bonusDamage, '#FFE0B6');
      }
      break;
    }
    default: {
      queueEffect(state, 'ultimate', boardWidth * 0.28, boardHeight * 0.44, Math.max(boardWidth, boardHeight) * 0.22, '#C5F3FF');
      queueEffect(state, 'ultimate', boardWidth * 0.72, boardHeight * 0.44, Math.max(boardWidth, boardHeight) * 0.22, '#C5F3FF');
      for (const enemy of activeEnemies) {
        applyUltimateDamage(
          enemy,
          Math.max(32 + weapon.damage * 9 + protocolLevel * 8, enemy.maxHealth * 0.14),
          '#C5F3FF'
        );
      }
      break;
    }
  }

  state.enemies = [
    ...state.enemies.filter((enemy) => enemy.health > 0),
    ...spawnedEnemies,
  ];
}

function tickPrototypeState(
  previousState: PrototypeGameState,
  deltaSeconds: number,
  boardWidth: number,
  boardHeight: number
): PrototypeGameState {
  const shouldForceUpgradeRevealFromPreviousState =
    getDifficultyTier(previousState.elapsed) <= GUARANTEED_UPGRADE_REVEAL_TIER &&
    getMissingGuaranteedUpgradeTypes(previousState).length > 0;
  const wasArmoryTransitionActive = previousState.armoryTransitionTimer > 0;
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
    chaosTimer: Math.max(0, previousState.chaosTimer - deltaSeconds),
    enemyCooldown: previousState.enemyCooldown - deltaSeconds,
    bossEscortCooldown: previousState.bossEscortCooldown - deltaSeconds,
    armoryTransitionTimer: Math.max(0, previousState.armoryTransitionTimer - deltaSeconds),
    upgradeCooldown:
      shouldForceUpgradeRevealFromPreviousState || previousState.upgrades.length < 2
        ? previousState.upgradeCooldown - deltaSeconds
        : previousState.upgradeCooldown,
    pickupTimer: Math.max(0, previousState.pickupTimer - deltaSeconds),
  };

  if (nextState.pickupTimer <= 0) {
    nextState.pickupMessage = null;
  }

  if (
    wasArmoryTransitionActive &&
    nextState.armoryTransitionTimer <= 0 &&
    nextState.queuedArmoryChoice &&
    !nextState.pendingArmoryChoice
  ) {
    nextState.pendingArmoryChoice = nextState.queuedArmoryChoice;
    nextState.queuedArmoryChoice = null;
    nextState.armoryTransitionLabel = null;
    nextState.armoryTransitionColor = null;
    nextState.pickupMessage = 'Armory sync ready';
    nextState.pickupTimer = 1.2;
  }

  if (
    nextState.activeEncounter &&
    nextState.activeEncounter.type !== 'boss' &&
    nextState.activeEncounter.endsAt !== null &&
    nextState.elapsed >= nextState.activeEncounter.endsAt
  ) {
    nextState.activeEncounter = null;
  }

  const currentDisplayTier = getDisplayTier(nextState.elapsed);
  if (currentDisplayTier > previousState.lastProcessedDisplayTier) {
    for (let displayTier = previousState.lastProcessedDisplayTier + 1; displayTier <= currentDisplayTier; displayTier += 1) {
      applyEncounterTransition(nextState, displayTier);
    }
    nextState.lastProcessedDisplayTier = currentDisplayTier;
  }

  while (!wasArmoryTransitionActive && nextState.fireCooldown <= 0) {
    const activeWeapon = getActiveWeapon(nextState);
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
        (16 + activeWeapon.shotCount * 4) * activeWeapon.effectIntensity,
        activeWeapon.muzzleColor,
        nextState.nextEffectId
      ),
    ]);
    nextState.nextEffectId += 1;

    if (activeWeapon.effectIntensity >= 1.35) {
      const sparkCount = Math.min(2, Math.floor((activeWeapon.effectIntensity - 1.15) * 2));
      for (let index = 0; index < sparkCount; index += 1) {
        nextState.effects = trimEffects([
          ...nextState.effects,
          createPrototypeEffect(
            'muzzle',
            nextState.playerX + (Math.random() - 0.5) * (12 + activeWeapon.spread * 0.4),
            boardHeight - PLAYER_HEIGHT - 20 - Math.random() * 6,
            (10 + activeWeapon.shotCount * 2) * (0.85 + activeWeapon.effectIntensity * 0.16),
            activeWeapon.glowColor,
            nextState.nextEffectId
          ),
        ]);
        nextState.nextEffectId += 1;
      }
    }
  }

  if (!wasArmoryTransitionActive && getActiveWeapon(nextState).missileLevel > 0) {
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

  if (!wasArmoryTransitionActive && getActiveWeapon(nextState).shatterLevel > 0) {
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

  if (!wasArmoryTransitionActive && nextState.activeEncounter?.type === 'boss' && !getActiveBossEnemy(nextState.enemies)) {
    const bossSpawn = createBossEnemy(nextState, boardWidth, nextState.activeEncounter.displayTier);
    nextState.enemies = bossSpawn.enemies;
    nextState.nextEnemyId = bossSpawn.nextEnemyId;
    nextState.enemyCooldown = Math.max(nextState.enemyCooldown, 2.4);
    nextState.bossEscortCooldown = Math.max(nextState.bossEscortCooldown, 2.8);
    nextState.effects = trimEffects([
      ...nextState.effects,
      createPrototypeEffect(
        'pickup',
        boardWidth / 2,
        boardHeight * 0.18,
        118,
        nextState.activeEncounter.accentColor,
        nextState.nextEffectId
      ),
    ]);
    nextState.nextEffectId += 1;
  }

  const activeBoss = getActiveBossEnemy(nextState.enemies);
  if (!wasArmoryTransitionActive && activeBoss) {
    while (nextState.bossEscortCooldown <= 0) {
      const escortGroup = buildBossEscortDrafts(nextState, boardWidth, activeBoss);
      for (const draft of escortGroup.drafts) {
        const spawn = createEnemy(nextState, boardWidth, draft);
        nextState.enemies = spawn.enemies;
        nextState.nextEnemyId = spawn.nextEnemyId;
      }
      nextState.bossEscortCooldown += escortGroup.cooldown;
    }
  }

  while (!wasArmoryTransitionActive && nextState.enemyCooldown <= 0) {
    const spawnGroup = buildEnemySpawnDrafts(nextState, boardWidth);
    for (const draft of spawnGroup.drafts) {
      const spawn = createEnemy(nextState, boardWidth, draft);
      nextState.enemies = spawn.enemies;
      nextState.nextEnemyId = spawn.nextEnemyId;
    }
    nextState.enemyCooldown += spawnGroup.cooldown;
  }

  const shouldForceUpgradeReveal =
    getDifficultyTier(nextState.elapsed) <= GUARANTEED_UPGRADE_REVEAL_TIER && getMissingGuaranteedUpgradeTypes(nextState).length > 0;
  const maxActiveUpgrades = shouldForceUpgradeReveal ? GUARANTEED_UPGRADE_ACTIVE_CAP : 2;

  if (!wasArmoryTransitionActive && (shouldForceUpgradeReveal || nextState.upgrades.length < maxActiveUpgrades)) {
    while (nextState.upgradeCooldown <= 0) {
      const spawn = createUpgrade(nextState, boardWidth);
      nextState.upgrades = spawn.upgrades;
      nextState.nextUpgradeId = spawn.nextUpgradeId;
      nextState.revealedUpgradeTypes = spawn.revealedUpgradeTypes;
      if (shouldForceUpgradeReveal && nextState.upgrades.length > GUARANTEED_UPGRADE_ACTIVE_CAP) {
        nextState.upgrades = nextState.upgrades.slice(nextState.upgrades.length - GUARANTEED_UPGRADE_ACTIVE_CAP);
      }
      nextState.upgradeCooldown += spawn.upgradeCooldown;

      if (!shouldForceUpgradeReveal && nextState.upgrades.length >= maxActiveUpgrades) {
        break;
      }
    }
  }

  const survivingBullets: PrototypeBullet[] = [];
  const survivingEnemies = [...nextState.enemies];
  const spawnedEnemies: PrototypeEnemy[] = [];

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

      const previousEnemyHealth = enemy.health;
      enemy.health = Math.max(0, enemy.health - activeBullet.damage);
      const dealtDamage = previousEnemyHealth - enemy.health;
      enemy.flash = 1;
      addUltimateCharge(nextState, getUltimateHitCharge(enemy, dealtDamage));

      updateBossPhaseAfterDamage(nextState, enemy, previousEnemyHealth);

      if (enemy.health <= 0) {
        spawnedEnemies.push(...resolveEnemyDefeat(nextState, enemy, boardWidth));
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
  nextState.enemies = [
    ...survivingEnemies.filter(
      (enemy) => enemy.health > 0 && enemy.y - enemy.size / 2 < boardHeight + 30
    ),
    ...spawnedEnemies,
  ];
  const remainingUpgrades: PrototypeUpgrade[] = [];
  for (const upgrade of nextState.upgrades) {
    if (upgrade.y - upgrade.size / 2 >= boardHeight + 12) {
      continue;
    }

    if (hitTestUpgradePickup(nextState.playerX, boardHeight, upgrade)) {
      const definition = UPGRADE_DEFINITIONS[upgrade.type];
      if (upgrade.type === 'bombard') {
        triggerBombardment(nextState, boardWidth, boardHeight);
        nextState.pickupMessage = 'Bombardment triggered';
        nextState.score += 40;
      } else if (upgrade.type === 'chaos') {
        nextState.chaosTimer = CHAOS_OVERDRIVE_DURATION_SECONDS;
        nextState.fireCooldown = Math.min(nextState.fireCooldown, 0.02);
        nextState.missileCooldown = Math.min(nextState.missileCooldown, 0.18);
        nextState.shatterCooldown = Math.min(nextState.shatterCooldown, 0.24);
        nextState.pickupMessage = 'Chaos overdrive engaged';
        nextState.score += 35;
        nextState.effects = trimEffects([
          ...nextState.effects,
          createPrototypeEffect('pickup', upgrade.x, upgrade.y, upgrade.size * 1.28, definition.color, nextState.nextEffectId),
        ]);
        nextState.nextEffectId += 1;
      } else {
        const previousMissileLevel = nextState.weapon.missileLevel;
        const previousShatterLevel = nextState.weapon.shatterLevel;
        const upgradeResult = applyDoctrineAdjustedUpgrade(nextState, upgrade.type);
        nextState.weapon = upgradeResult.weapon;
        nextState.collectedUpgradeCount += 1;
        if (nextState.weapon.missileLevel > previousMissileLevel) {
          nextState.missileCooldown = Math.min(nextState.missileCooldown, 0.24);
        }
        if (nextState.weapon.shatterLevel > previousShatterLevel) {
          nextState.shatterCooldown = Math.min(nextState.shatterCooldown, 0.3);
        }
        nextState.pickupMessage = upgradeResult.pickupMessage;
        nextState.score += 25;
        nextState.effects = trimEffects([
          ...nextState.effects,
          createPrototypeEffect('pickup', upgrade.x, upgrade.y, upgrade.size * 1.15, definition.color, nextState.nextEffectId),
        ]);
        nextState.nextEffectId += 1;
      }
      nextState.pickupTimer = 1.8;
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
  const isBoss = enemy.archetype === 'boss';
  const showAura = isBoss || enemy.archetype === 'tank' || enemy.archetype === 'splitter';
  const size = enemy.size;
  const flashScale = enemy.flash > 0 ? 1.06 : 1;
  const healthLabel = formatCompactHealth(enemy.health);
  const isCompactHealth = enemy.maxHealth >= 1000 || isBoss;

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
          borderColor: enemy.flash > 0 ? '#F9FDFF' : isBoss ? '#FFF1C3' : '#101827',
          borderWidth: isBoss ? 2.4 : 1.5,
        },
      ]}>
      {showAura ? (
        <View
          style={[
            shooterStyles.enemyAura,
            isBoss ? shooterStyles.enemyAuraBoss : enemy.archetype === 'tank' ? shooterStyles.enemyAuraTank : shooterStyles.enemyAuraSplitter,
            {
              borderRadius: isCircle ? size : 16,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          shooterStyles.enemyContent,
          isDiamond && {
            transform: [{ rotate: '-45deg' }],
          },
        ]}>
        {enemy.archetype === 'tank' ? (
          <View style={shooterStyles.enemyTankMarker}>
            <View style={shooterStyles.enemyTankCore} />
          </View>
        ) : null}
        {enemy.archetype === 'swarm' ? (
          <View style={shooterStyles.enemySwarmMarker}>
            <View style={shooterStyles.enemySwarmDot} />
            <View style={shooterStyles.enemySwarmDot} />
            <View style={shooterStyles.enemySwarmDot} />
          </View>
        ) : null}
        {enemy.archetype === 'splitter' ? (
          <View style={shooterStyles.enemySplitterMarker}>
            <View style={[shooterStyles.enemySplitterLine, shooterStyles.enemySplitterLineLeft]} />
            <View style={[shooterStyles.enemySplitterLine, shooterStyles.enemySplitterLineRight]} />
          </View>
        ) : null}
        {isBoss ? (
          <View style={shooterStyles.enemyBossMarker}>
            {Array.from({ length: 3 }, (_, index) => (
              <View
                key={`boss-phase-${index}`}
                style={[
                  shooterStyles.enemyBossPip,
                  index < enemy.bossPhase && shooterStyles.enemyBossPipActive,
                ]}
              />
            ))}
          </View>
        ) : null}
      <Text
        style={[
          shooterStyles.enemyHealthText,
          isCompactHealth && shooterStyles.enemyHealthTextCompact,
          isBoss && shooterStyles.enemyHealthTextBoss,
        ]}>
        {healthLabel}
      </Text>
      </View>
    </View>
  );
}

function BulletNode({ bullet }: { bullet: PrototypeBullet }) {
  const trailHeight = bullet.size * (2.5 + bullet.trailScale * (0.38 + Math.sin(bullet.age * 18 + bullet.phase) * 0.1));
  const glowScale = 1 + Math.sin(bullet.age * 20 + bullet.phase) * 0.08;
  const angleDegrees = (bullet.angle * 180) / Math.PI;
  const isMissile = bullet.kind === 'missile';
  const isShatterShell = bullet.kind === 'shatterShell';
  const isShatterShard = bullet.kind === 'shatterShard';

  if (isMissile) {
    const missileTrailHeight = bullet.size * (3 + bullet.trailScale * (0.72 + Math.sin(bullet.age * 16 + bullet.phase) * 0.14));
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

  if (effect.kind === 'ultimate') {
    const size = effect.size * (0.36 + progress * 0.9);
    const innerSize = size * (0.36 + (1 - progress) * 0.18);
    const outerRingSize = size * 1.18;
    const petalLength = size * 0.78;
    const petalThickness = Math.max(8, size * 0.08);
    return (
      <>
        <View
          pointerEvents="none"
          style={[
            shooterStyles.effectNode,
            shooterStyles.effectUltimateGlow,
            {
              left: effect.x - size / 2,
              top: effect.y - size / 2,
              width: size,
              height: size,
              opacity: opacity * 0.22,
              backgroundColor: effect.color,
              transform: [{ scale: 0.92 + progress * 0.18 }],
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            shooterStyles.effectNode,
            shooterStyles.effectRing,
            {
              left: effect.x - outerRingSize / 2,
              top: effect.y - outerRingSize / 2,
              width: outerRingSize,
              height: outerRingSize,
              opacity: opacity * 0.34,
              borderColor: effect.color,
            },
          ]}
        />
        {[0, 60, 120].map((rotation) => (
          <View
            key={`ultimate-petal-${effect.id}-${rotation}`}
            pointerEvents="none"
            style={[
              shooterStyles.effectNode,
              shooterStyles.effectUltimatePetal,
              {
                left: effect.x - petalLength / 2,
                top: effect.y - petalThickness / 2,
                width: petalLength,
                height: petalThickness,
                opacity: opacity * 0.22,
                backgroundColor: effect.color,
                transform: [{ rotate: `${rotation + progress * 18}deg` }, { scaleX: 0.86 + progress * 0.2 }],
              },
            ]}
          />
        ))}
        <View
          pointerEvents="none"
          style={[
            shooterStyles.effectNode,
            shooterStyles.effectRing,
            {
              left: effect.x - size / 2,
              top: effect.y - size / 2,
              width: size,
              height: size,
              opacity: opacity * 0.92,
              borderColor: effect.color,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            shooterStyles.effectNode,
            shooterStyles.effectCore,
            {
              left: effect.x - innerSize / 2,
              top: effect.y - innerSize / 2,
              width: innerSize,
              height: innerSize,
              opacity: opacity * 0.18,
              backgroundColor: effect.color,
            },
          ]}
        />
      </>
    );
  }

  if (effect.kind === 'bombard') {
    const height = effect.size * (1.06 - progress * 0.12);
    const glowWidth = Math.max(26, effect.size * 0.18);
    const coreWidth = Math.max(8, effect.size * 0.042);
    return (
      <>
        <View
          pointerEvents="none"
          style={[
            shooterStyles.effectNode,
            shooterStyles.effectBombardGlow,
            {
              left: effect.x - glowWidth / 2,
              top: effect.y - height / 2,
              width: glowWidth,
              height,
              opacity: opacity * 0.22,
              backgroundColor: effect.color,
              transform: [{ scaleY: 0.9 + progress * 0.16 }],
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            shooterStyles.effectNode,
            shooterStyles.effectBombardColumn,
            {
              left: effect.x - coreWidth,
              top: effect.y - height / 2,
              width: coreWidth * 2,
              height,
              opacity: 0.24 + opacity * 0.5,
              backgroundColor: effect.color,
              borderColor: '#FFE5C7',
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            shooterStyles.effectNode,
            shooterStyles.effectBombardCore,
            {
              left: effect.x - coreWidth * 0.24,
              top: effect.y - height / 2 + 8,
              width: coreWidth * 0.48,
              height: height - 16,
              opacity: opacity * 0.92,
            },
          ]}
        />
      </>
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

function BackgroundGrid({
  width,
  height,
  atmosphere,
}: {
  width: number;
  height: number;
  atmosphere: ReturnType<typeof getBoardAtmosphere>;
}) {
  const verticalLines = useMemo(() => {
    const lineCount = Math.max(6, Math.floor(width / 64));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * width) / (lineCount + 1));
  }, [width]);
  const horizontalLines = useMemo(() => {
    const lineCount = Math.max(4, Math.floor(height / 60));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * height) / (lineCount + 1));
  }, [height]);

  return (
    <>
      <View style={[shooterStyles.bgHaze, { backgroundColor: atmosphere.hazeColor }]} />
      <View style={[shooterStyles.bgOrb, shooterStyles.bgOrbA, { backgroundColor: atmosphere.orbAColor }]} />
      <View style={[shooterStyles.bgOrb, shooterStyles.bgOrbB, { backgroundColor: atmosphere.orbBColor }]} />
      {verticalLines.map((x, index) => (
        <View
          key={`shooter-grid-v-${index}`}
          pointerEvents="none"
          style={[shooterStyles.gridLine, { left: x, top: 0, bottom: 0, width: 1, backgroundColor: atmosphere.gridColor }]}
        />
      ))}
      {horizontalLines.map((y, index) => (
        <View
          key={`shooter-grid-h-${index}`}
          pointerEvents="none"
          style={[shooterStyles.gridLine, { top: y, left: 0, right: 0, height: 1, backgroundColor: atmosphere.gridColor }]}
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
  const hasInitializedBoardRef = useRef(false);
  const isPortraitViewport = windowHeight >= windowWidth;
  const isArmoryOpen = gameState.pendingArmoryChoice !== null;
  const isArmoryTransitionActive = gameState.armoryTransitionTimer > 0;

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    if (!hasInitializedBoardRef.current) {
      hasInitializedBoardRef.current = true;
      setGameState(createInitialState(boardSize.width, boardSize.height));
      setHasStarted(false);
      setIsPaused(true);
      return;
    }

    setGameState((previousState) => ({
      ...previousState,
      playerX: clamp(previousState.playerX, PLAYER_HALF_WIDTH + PLAYER_MARGIN, boardSize.width - PLAYER_HALF_WIDTH - PLAYER_MARGIN),
      enemies: previousState.enemies.map((enemy) => ({
        ...enemy,
        x: clamp(enemy.x, enemy.size / 2 + 8, boardSize.width - enemy.size / 2 - 8),
      })),
      upgrades: previousState.upgrades.map((upgrade) => ({
        ...upgrade,
        x: clamp(upgrade.x, upgrade.size / 2 + 10, boardSize.width - upgrade.size / 2 - 10),
      })),
    }));
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

      if (hasStarted && !isPaused && !isArmoryOpen) {
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
  }, [boardSize.height, boardSize.width, hasStarted, isArmoryOpen, isPaused]);

  useEffect(() => {
    if (gameState.status === 'lost') {
      setIsPaused(true);
    }
  }, [gameState.status]);

  useEffect(() => {
    if (gameState.pendingArmoryChoice && hasStarted && gameState.status === 'running') {
      setIsPaused(true);
      setIsMenuOpen(false);
    }
  }, [gameState.pendingArmoryChoice, gameState.status, hasStarted]);

  useEffect(() => {
    if (isArmoryTransitionActive) {
      setIsMenuOpen(false);
    }
  }, [isArmoryTransitionActive]);

  const difficultyTier = getDifficultyTier(gameState.elapsed) + 1;
  const activeBoss = getActiveBossEnemy(gameState.enemies);
  const buildProtocolDisplay = getBuildProtocolDisplay(gameState);
  const ultimateDefinition = getUltimateDefinition(gameState);
  const ultimateReady = gameState.ultimateCharge >= MAX_ULTIMATE_CHARGE;
  const lowestEnemyBottom = boardSize.height
    ? gameState.enemies.reduce(
        (lowest, enemy) => Math.max(lowest, enemy.y + enemy.size / 2),
        0
      )
    : 0;
  const breachPressure = boardSize.height
    ? clamp((lowestEnemyBottom - boardSize.height * 0.32) / (boardSize.height * 0.56), 0, 1)
    : 0;
  const atmosphere = getBoardAtmosphere(
    difficultyTier,
    gameState.activeEncounter,
    activeBoss,
    buildProtocolDisplay?.color ?? null,
    ultimateReady,
    breachPressure
  );
  const encounterTimeRemaining =
    gameState.activeEncounter && gameState.activeEncounter.endsAt !== null
      ? Math.max(0, gameState.activeEncounter.endsAt - gameState.elapsed)
      : null;
  const armoryTransitionProgress =
    isArmoryTransitionActive && BOSS_CLEAR_TRANSITION_SECONDS > 0
      ? 1 - gameState.armoryTransitionTimer / BOSS_CLEAR_TRANSITION_SECONDS
      : 0;
  const buildHudValue = buildProtocolDisplay ? `${buildProtocolDisplay.label} ${buildProtocolDisplay.levelLabel}` : 'No doctrine';
  const encounterHudValue = gameState.activeEncounter
    ? gameState.activeEncounter.label
    : isArmoryTransitionActive
      ? 'Boss clear'
      : 'Standby';
  const bossHudValue = activeBoss
    ? formatCompactHealth(activeBoss.health)
    : isArmoryTransitionActive
      ? 'Resolved'
      : 'No target';
  const displayMessage =
    !hasStarted
      ? 'Press Start to deploy the ship.'
      : gameState.status === 'lost'
        ? 'Game over. Restart to run again.'
        : isArmoryTransitionActive
          ? `${gameState.armoryTransitionLabel ?? 'Boss neutralized'} Armory sync stabilizing...`
        : isArmoryOpen
          ? 'Armory sync ready.'
        : isPaused
          ? 'Prototype paused.'
          : gameState.pickupMessage ??
            (activeBoss
              ? `${getBossLabel(activeBoss.bossVariant ?? 'prism')} phase ${activeBoss.bossPhase}`
              : gameState.activeEncounter
                ? encounterTimeRemaining !== null
                  ? `${gameState.activeEncounter.label} ${encounterTimeRemaining.toFixed(1)}s`
                  : gameState.activeEncounter.label
                : null) ??
            (gameState.chaosTimer > 0
              ? `Chaos overdrive ${gameState.chaosTimer.toFixed(1)}s`
              : 'Catch falling upgrades to modify the weapon.');

  const handleBoardTouch = (event: GestureResponderEvent) => {
    if (
          boardSize.width <= 0 ||
          boardSize.height <= 0 ||
          isMenuOpen ||
          isArmoryOpen ||
          isArmoryTransitionActive ||
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

    hasInitializedBoardRef.current = true;
    setGameState(createInitialState(boardSize.width, boardSize.height));
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
  };

  const handleSelectBuildProtocol = (protocol: BuildProtocolKey) => {
    if (boardSize.height <= 0) {
      return;
    }

    const definition = BUILD_PROTOCOL_DEFINITIONS[protocol];
    setGameState((previousState) => {
      if (!previousState.pendingArmoryChoice) {
        return previousState;
      }

      const isMaintainingProtocol = previousState.buildProtocol === protocol;
      const nextLevel = isMaintainingProtocol ? previousState.buildProtocolLevel + 1 : 1;
      const nextMessage = `${definition.label} synced ${getBuildProtocolLevelLabel(nextLevel)}`;

      return {
        ...previousState,
        buildProtocol: protocol,
        buildProtocolLevel: nextLevel,
        pendingArmoryChoice: null,
        queuedArmoryChoice: null,
        armoryTransitionTimer: 0,
        armoryTransitionLabel: null,
        armoryTransitionColor: null,
        pickupMessage: nextMessage,
        pickupTimer: 2.4,
        missileCooldown:
          protocol === 'missileCommand' ? Math.min(previousState.missileCooldown, 0.22) : previousState.missileCooldown,
        shatterCooldown:
          protocol === 'fractureCore' ? Math.min(previousState.shatterCooldown, 0.26) : previousState.shatterCooldown,
        effects: trimEffects([
          ...previousState.effects,
          createPrototypeEffect(
            'pickup',
            previousState.playerX,
            getPlayerShipTop(boardSize.height) + PLAYER_HEIGHT * 0.28,
            88,
            definition.color,
            previousState.nextEffectId
          ),
        ]),
        nextEffectId: previousState.nextEffectId + 1,
      };
    });

    if (hasStarted && gameState.status === 'running') {
      setIsPaused(false);
    }
  };

  const handleTriggerUltimate = () => {
    if (
      boardSize.width <= 0 ||
      boardSize.height <= 0 ||
      !hasStarted ||
      isPaused ||
      isArmoryOpen ||
      isArmoryTransitionActive ||
      isMenuOpen ||
      gameState.status !== 'running' ||
      !ultimateReady
    ) {
      return;
    }

    setGameState((previousState) => {
      if (previousState.status !== 'running' || previousState.ultimateCharge < MAX_ULTIMATE_CHARGE) {
        return previousState;
      }

      const nextState: PrototypeGameState = {
        ...previousState,
        bullets: [...previousState.bullets],
        enemies: previousState.enemies.map((enemy) => ({ ...enemy })),
        upgrades: [...previousState.upgrades],
        effects: [...previousState.effects],
      };
      triggerUltimate(nextState, boardSize.width, boardSize.height);
      return nextState;
    });
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
            if (isArmoryOpen || isArmoryTransitionActive) {
              return;
            }
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
          <Text numberOfLines={1} style={shooterStyles.statusPillText}>
            {displayMessage}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            if (isArmoryOpen || isArmoryTransitionActive) {
              return;
            }
            setIsMenuOpen((previousValue) => !previousValue);
          }}
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
        <Pressable
          onPress={handleTriggerUltimate}
          disabled={!ultimateReady || isPaused || !hasStarted || isArmoryOpen || isArmoryTransitionActive}
          style={[
            shooterStyles.hudChip,
            shooterStyles.hudChipAction,
            isPortraitViewport && shooterStyles.hudChipPortrait,
            ultimateReady && shooterStyles.hudChipActionReady,
          ]}>
          <Text style={shooterStyles.hudLabel}>Ultimate</Text>
          <Text style={[shooterStyles.hudValue, ultimateReady && { color: ultimateDefinition.color }]}>
            {ultimateReady ? `${ultimateDefinition.label} READY` : `${ultimateDefinition.label} ${Math.round(gameState.ultimateCharge)}%`}
          </Text>
        </Pressable>
        <View style={[shooterStyles.hudChip, isPortraitViewport && shooterStyles.hudChipPortrait]}>
          <Text style={shooterStyles.hudLabel}>Build</Text>
          <Text
            style={[
              shooterStyles.hudValue,
              !buildProtocolDisplay && shooterStyles.hudValueDim,
              buildProtocolDisplay && { color: buildProtocolDisplay.color },
            ]}>
            {buildHudValue}
          </Text>
        </View>
        <View style={[shooterStyles.hudChip, isPortraitViewport && shooterStyles.hudChipPortrait]}>
          <Text style={shooterStyles.hudLabel}>Encounter</Text>
          <Text
            style={[
              shooterStyles.hudValue,
              !gameState.activeEncounter && !isArmoryTransitionActive && shooterStyles.hudValueDim,
              gameState.activeEncounter && { color: gameState.activeEncounter.accentColor },
              isArmoryTransitionActive && gameState.armoryTransitionColor && { color: gameState.armoryTransitionColor },
            ]}>
            {encounterHudValue}
          </Text>
        </View>
        <View style={[shooterStyles.hudChip, isPortraitViewport && shooterStyles.hudChipPortrait]}>
          <Text style={shooterStyles.hudLabel}>Boss</Text>
          <Text style={[shooterStyles.hudValue, !activeBoss && !isArmoryTransitionActive && shooterStyles.hudValueDim]}>
            {bossHudValue}
          </Text>
        </View>
      </View>

      {gameState.pendingArmoryChoice ? (
        <View style={shooterStyles.armoryOverlay}>
          <View style={shooterStyles.armoryPanel}>
            <Text style={shooterStyles.armoryTitle}>{gameState.pendingArmoryChoice.title}</Text>
            <Text style={shooterStyles.armorySubtitle}>
              Boss clear at T{gameState.pendingArmoryChoice.sourceDisplayTier}
            </Text>
            <Text style={shooterStyles.armoryPrompt}>{gameState.pendingArmoryChoice.prompt}</Text>

            <View style={shooterStyles.armoryOptions}>
              {gameState.pendingArmoryChoice.options.map((protocol) => {
                const definition = BUILD_PROTOCOL_DEFINITIONS[protocol];
                const isCurrentProtocol = gameState.buildProtocol === protocol;
                const nextLevel = isCurrentProtocol ? gameState.buildProtocolLevel + 1 : 1;
                return (
                  <Pressable
                    key={protocol}
                    onPress={() => handleSelectBuildProtocol(protocol)}
                    style={[
                      shooterStyles.armoryCard,
                      { borderColor: definition.color, backgroundColor: definition.accent },
                      isCurrentProtocol && shooterStyles.armoryCardCurrent,
                    ]}>
                    <Text style={[shooterStyles.armoryCardLabel, { color: '#132132' }]}>{definition.label}</Text>
                    <Text style={[shooterStyles.armoryCardLevel, { color: definition.color }]}>
                      {isCurrentProtocol ? `Maintain ${getBuildProtocolLevelLabel(nextLevel)}` : 'Reroute'}
                    </Text>
                    <Text style={shooterStyles.armoryCardText}>
                      {getBuildProtocolOptionDescription(protocol, nextLevel, isCurrentProtocol)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {isArmoryTransitionActive ? (
        <View pointerEvents="none" style={shooterStyles.bossClearOverlay}>
          <View
            style={[
              shooterStyles.bossClearGlow,
              {
                backgroundColor: hexToRgba(gameState.armoryTransitionColor ?? '#FFE6A8', 0.18 + armoryTransitionProgress * 0.18),
                transform: [{ scale: 0.82 + armoryTransitionProgress * 0.32 }],
              },
            ]}
          />
          <View
            style={[
              shooterStyles.bossClearBeam,
              {
                backgroundColor: hexToRgba(gameState.armoryTransitionColor ?? '#FFE6A8', 0.26 + armoryTransitionProgress * 0.24),
              },
            ]}
          />
          <Text style={shooterStyles.bossClearTitle}>{gameState.armoryTransitionLabel ?? 'Boss neutralized'}</Text>
          <Text style={shooterStyles.bossClearSubtitle}>Armory sync calibrating</Text>
        </View>
      ) : null}

      <View style={shooterStyles.boardFrame}>
        <View
          onLayout={handleBoardLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleBoardTouch}
          onResponderMove={handleBoardTouch}
          style={[shooterStyles.board, { borderColor: atmosphere.borderColor }]}>
          <BackgroundGrid width={boardSize.width} height={boardSize.height} atmosphere={atmosphere} />

          {activeBoss ? (
            <View
              pointerEvents="none"
              style={[
                shooterStyles.bossTelegraph,
                {
                  left: activeBoss.x - Math.max(14, activeBoss.size * 0.14),
                  top: activeBoss.y + activeBoss.size * 0.34,
                  width: Math.max(28, activeBoss.size * 0.28),
                  bottom: 34,
                  backgroundColor: atmosphere.bossTelegraphColor,
                },
              ]}
            />
          ) : null}

          <View
            pointerEvents="none"
            style={[
              shooterStyles.breachLine,
              {
                backgroundColor: atmosphere.breachLineColor,
                opacity: 0.22 + breachPressure * 0.78,
              },
            ]}
          />

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

          <View
            style={[shooterStyles.bottomGlow, { backgroundColor: atmosphere.bottomGlowColor }]}
            pointerEvents="none"
          />
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '700',
  },
  hudRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
  },
  hudRowPortrait: {
    flexWrap: 'wrap',
    minHeight: 118,
    alignContent: 'flex-start',
  },
  hudChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22314A',
    backgroundColor: '#0D1724',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hudChipPortrait: {
    flexBasis: '48%',
    minWidth: '48%',
  },
  hudChipAction: {
    justifyContent: 'center',
  },
  hudChipActionReady: {
    borderColor: '#596F33',
    backgroundColor: '#1B2B17',
  },
  hudLabel: {
    color: '#7D93B5',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hudValue: {
    color: '#EEF5FF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  hudValueDim: {
    color: '#7E92AF',
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
  bossClearOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 10, 18, 0.26)',
    gap: 6,
    paddingHorizontal: 18,
  },
  bossClearGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  bossClearBeam: {
    position: 'absolute',
    width: 18,
    top: '24%',
    bottom: '24%',
    borderRadius: 999,
  },
  bossClearTitle: {
    color: '#FFF5E1',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  bossClearSubtitle: {
    color: '#D6E5F8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  armoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 26,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(5, 10, 18, 0.58)',
  },
  armoryPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3A5575',
    backgroundColor: '#0F1928',
    padding: 14,
    gap: 8,
  },
  armoryTitle: {
    color: '#F4F8FF',
    fontSize: 18,
    fontWeight: '900',
  },
  armorySubtitle: {
    color: '#9FB4D1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  armoryPrompt: {
    color: '#C1D3EA',
    fontSize: 13,
    lineHeight: 18,
  },
  armoryOptions: {
    marginTop: 4,
    gap: 10,
  },
  armoryCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
  },
  armoryCardCurrent: {
    shadowColor: '#FFF2D4',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  armoryCardLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
  armoryCardLevel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  armoryCardText: {
    color: '#223247',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
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
  effectBombardGlow: {
    borderRadius: 999,
  },
  effectUltimateGlow: {
    borderRadius: 999,
  },
  effectUltimatePetal: {
    borderRadius: 999,
  },
  effectBombardColumn: {
    borderRadius: 999,
    borderWidth: 1,
  },
  effectBombardCore: {
    borderRadius: 999,
    backgroundColor: '#FFF6E1',
  },
  effectRing: {
    borderRadius: 999,
    borderWidth: 2,
  },
  effectCore: {
    borderRadius: 999,
  },
  bgHaze: {
    ...StyleSheet.absoluteFillObject,
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
  enemyAura: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderWidth: 1,
  },
  enemyAuraTank: {
    borderColor: 'rgba(255, 235, 196, 0.56)',
    backgroundColor: 'rgba(255, 218, 145, 0.08)',
  },
  enemyAuraSplitter: {
    borderColor: 'rgba(255, 198, 226, 0.54)',
    backgroundColor: 'rgba(255, 162, 206, 0.07)',
  },
  enemyAuraBoss: {
    top: -10,
    right: -10,
    bottom: -10,
    left: -10,
    borderColor: 'rgba(255, 240, 195, 0.76)',
    backgroundColor: 'rgba(255, 224, 143, 0.08)',
  },
  enemyContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyTankMarker: {
    position: 'absolute',
    top: '18%',
    width: 18,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 245, 226, 0.85)',
    backgroundColor: 'rgba(19, 25, 35, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyTankCore: {
    width: 7,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#FFF4E2',
  },
  enemySwarmMarker: {
    position: 'absolute',
    top: '18%',
    flexDirection: 'row',
    gap: 3,
  },
  enemySwarmDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#EAFBFF',
  },
  enemySplitterMarker: {
    position: 'absolute',
    top: '17%',
    width: 16,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemySplitterLine: {
    position: 'absolute',
    width: 2,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FFF2F8',
  },
  enemySplitterLineLeft: {
    transform: [{ rotate: '-18deg' }, { translateX: -3 }],
  },
  enemySplitterLineRight: {
    transform: [{ rotate: '18deg' }, { translateX: 3 }],
  },
  enemyBossMarker: {
    position: 'absolute',
    top: '14%',
    flexDirection: 'row',
    gap: 4,
  },
  enemyBossPip: {
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 244, 208, 0.8)',
    backgroundColor: 'rgba(18, 26, 37, 0.35)',
  },
  enemyBossPipActive: {
    backgroundColor: '#FFF0BF',
  },
  enemyHealthText: {
    color: '#F7FBFF',
    fontSize: 13,
    fontWeight: '900',
  },
  enemyHealthTextCompact: {
    fontSize: 12,
  },
  enemyHealthTextBoss: {
    fontSize: 11,
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
    borderRadius: 120,
  },
  breachLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 22,
    height: 5,
    borderRadius: 999,
  },
  bossTelegraph: {
    position: 'absolute',
    borderRadius: 999,
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
