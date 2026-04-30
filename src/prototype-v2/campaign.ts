import type {
  ArenaBuildId,
  ArenaCampaignMissionId,
  ArenaCampaignShieldId,
  ArenaCampaignShipStatUpgradeKey,
  ArenaCampaignShipStatUpgrades,
  ArenaCampaignWeaponId,
  ArenaCampaignWeaponUpgradeKey,
  ArenaCampaignWeaponUpgradeTrack,
  ArenaGameState,
  ArenaWeapon,
} from './types';
import { BASE_ARENA_WEAPON } from './config';

export const ARENA_CAMPAIGN_XP_THRESHOLDS = [0, 120, 280, 520, 860, 1300, 1840, 2480, 3220, 4060, 5000] as const;
export const ARENA_CAMPAIGN_WEAPON_UPGRADE_DEFAULT_MAX_LEVEL = 5;
export const ARENA_CAMPAIGN_HEALTH_UPGRADE_BONUS = 16;
export const ARENA_CAMPAIGN_SHIELD_UPGRADE_BONUS = 12;

const CAMPAIGN_BUILD_MAX_SHOT_COUNT: Record<ArenaBuildId, number> = {
  railFocus: 2,
  novaBloom: 4,
  missileCommand: 6,
  fractureCore: 3,
};

const CAMPAIGN_BUILD_FIRE_INTERVAL_FLOOR: Record<ArenaBuildId, number> = {
  railFocus: 0.065,
  novaBloom: 0.085,
  missileCommand: 0.065,
  fractureCore: 0.30,
};

export type ArenaCampaignWeaponUpgradeDefinition = {
  key: ArenaCampaignWeaponUpgradeKey;
  label: string;
  shortLabel: string;
  statLine: string;
  summary: string;
};

export type ArenaCampaignShipStatUpgradeDefinition = {
  key: ArenaCampaignShipStatUpgradeKey;
  label: string;
  shortLabel: string;
  statLine: string;
  summary: string;
};

export type ArenaCampaignWeaponDefinition = {
  id: ArenaCampaignWeaponId;
  label: string;
  shortLabel: string;
  buildId: ArenaBuildId;
  unlockLevel: number;
  summary: string;
};

export type ArenaCampaignShieldDefinition = {
  id: ArenaCampaignShieldId;
  label: string;
  shortLabel: string;
  unlockLevel: number;
  cooldownSeconds: number;
  durationSeconds: number;
  damageTakenMultiplier: number;
  projectileCullRatio: number;
  summary: string;
};

export type ArenaCampaignMissionDefinition = {
  id: ArenaCampaignMissionId;
  label: string;
  zoneLabel: string;
  summary: string;
  biomeTier: number;
  targetTier: number;
  recommendedLevel: number;
  rewardXp: number;
  bossLabel: string;
};

export const ARENA_CAMPAIGN_WEAPON_UPGRADES: Record<
  ArenaCampaignWeaponUpgradeKey,
  ArenaCampaignWeaponUpgradeDefinition
> = {
  damage: {
    key: 'damage',
    label: 'Damage Matrix',
    shortLabel: 'DMG',
    statLine: '+2 damage / level',
    summary: 'Raises direct weapon damage before build tuning is applied.',
  },
  guns: {
    key: 'guns',
    label: 'Barrel Array',
    shortLabel: 'GUN',
    statLine: '+1 gun until build cap',
    summary: 'Adds another primary barrel until the weapon reaches its build family cap.',
  },
  cycle: {
    key: 'cycle',
    label: 'Cycle Accelerator',
    shortLabel: 'ROF',
    statLine: '+7% fire rate / level',
    summary: 'Shortens the primary firing loop while respecting each build floor.',
  },
  velocity: {
    key: 'velocity',
    label: 'Velocity Rails',
    shortLabel: 'SPD',
    statLine: '+110 speed / level',
    summary: 'Improves projectile speed and adds a small shot-size bump.',
  },
  stability: {
    key: 'stability',
    label: 'Stability Core',
    shortLabel: 'CTRL',
    statLine: '+focus / level',
    summary: 'Tightens spread and improves pierce every other level.',
  },
};

export const ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER = Object.keys(
  ARENA_CAMPAIGN_WEAPON_UPGRADES,
) as ArenaCampaignWeaponUpgradeKey[];

export const ARENA_CAMPAIGN_SHIP_STAT_UPGRADES: Record<
  ArenaCampaignShipStatUpgradeKey,
  ArenaCampaignShipStatUpgradeDefinition
> = {
  health: {
    key: 'health',
    label: 'Hull Weave',
    shortLabel: 'HP',
    statLine: `+${ARENA_CAMPAIGN_HEALTH_UPGRADE_BONUS} max health / level`,
    summary: 'Raises campaign ship health. This track has no cap.',
  },
  shield: {
    key: 'shield',
    label: 'Shield Capacitor',
    shortLabel: 'SHD',
    statLine: `+${ARENA_CAMPAIGN_SHIELD_UPGRADE_BONUS} max shield / level`,
    summary: 'Raises campaign shield capacity. This track has no cap.',
  },
};

export const ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER = Object.keys(
  ARENA_CAMPAIGN_SHIP_STAT_UPGRADES,
) as ArenaCampaignShipStatUpgradeKey[];

export const ARENA_CAMPAIGN_WEAPONS: Record<ArenaCampaignWeaponId, ArenaCampaignWeaponDefinition> = {
  railCannon: {
    id: 'railCannon',
    label: 'VX Rail Cannon',
    shortLabel: 'Rail',
    buildId: 'railFocus',
    unlockLevel: 1,
    summary: 'Precision cannon with tight lanes and stronger elite hits.',
  },
  bloomEmitter: {
    id: 'bloomEmitter',
    label: 'Solar Bloom Emitter',
    shortLabel: 'Bloom',
    buildId: 'novaBloom',
    unlockLevel: 2,
    summary: 'Wide fan emitter for crowd coverage and lower precision.',
  },
  missileRack: {
    id: 'missileRack',
    label: 'Siege Missile Rack',
    shortLabel: 'Missile',
    buildId: 'missileCommand',
    unlockLevel: 3,
    summary: 'Homing ordnance weapon with splash-heavy pressure.',
  },
  fractureDriver: {
    id: 'fractureDriver',
    label: 'Fracture Driver',
    shortLabel: 'Fracture',
    buildId: 'fractureCore',
    unlockLevel: 4,
    summary: 'Heavy shard cannon that trades rate of fire for fragmentation.',
  },
};

export const ARENA_CAMPAIGN_SHIELDS: Record<ArenaCampaignShieldId, ArenaCampaignShieldDefinition> = {
  aegisDampener: {
    id: 'aegisDampener',
    label: 'Aegis Dampener',
    shortLabel: 'Aegis',
    unlockLevel: 1,
    cooldownSeconds: 15,
    durationSeconds: 4.5,
    damageTakenMultiplier: 0.4,
    projectileCullRatio: 0,
    summary: 'Shield ability reduces incoming damage by 60% for a short window.',
  },
  pointScreen: {
    id: 'pointScreen',
    label: 'Point Screen',
    shortLabel: 'Screen',
    unlockLevel: 3,
    cooldownSeconds: 18,
    durationSeconds: 2.8,
    damageTakenMultiplier: 0.75,
    projectileCullRatio: 0.5,
    summary: 'Shield ability cuts active enemy projectiles by 50% and briefly reduces damage.',
  },
};

export const ARENA_CAMPAIGN_MISSIONS: Record<ArenaCampaignMissionId, ArenaCampaignMissionDefinition> = {
  prismVergeRecon: {
    id: 'prismVergeRecon',
    label: 'Prism Verge Recon',
    zoneLabel: 'Map 01',
    summary: 'A short 6-tier campaign sortie ending at the Prism Core checkpoint.',
    biomeTier: 1,
    targetTier: 6,
    recommendedLevel: 1,
    rewardXp: 140,
    bossLabel: 'Prism Core',
  },
  hiveForgeAssault: {
    id: 'hiveForgeAssault',
    label: 'Hive Forge Assault',
    zoneLabel: 'Map 02',
    summary: 'Push through the Hive Forge sector and shut down the Carrier boss.',
    biomeTier: 7,
    targetTier: 12,
    recommendedLevel: 3,
    rewardXp: 220,
    bossLabel: 'Hive Carrier',
  },
  vectorSpindlePurge: {
    id: 'vectorSpindlePurge',
    label: 'Vector Spindle Purge',
    zoneLabel: 'Map 03',
    summary: 'Break the Vector Spindle formation lines and destroy the Loom core.',
    biomeTier: 13,
    targetTier: 18,
    recommendedLevel: 5,
    rewardXp: 320,
    bossLabel: 'Vector Loom',
  },
  eclipseEdgeBreak: {
    id: 'eclipseEdgeBreak',
    label: 'Eclipse Edge Break',
    zoneLabel: 'Map 04',
    summary: 'Flank the Eclipse perimeter and neutralize the Talon command ship.',
    biomeTier: 19,
    targetTier: 24,
    recommendedLevel: 7,
    rewardXp: 440,
    bossLabel: 'Eclipse Talon',
  },
  nexusGateSiege: {
    id: 'nexusGateSiege',
    label: 'Nexus Gate Siege',
    zoneLabel: 'Map 05',
    summary: 'Final assault on the Nexus Gate. Breach the last defense line.',
    biomeTier: 25,
    targetTier: 30,
    recommendedLevel: 9,
    rewardXp: 600,
    bossLabel: 'Nexus Warden',
  },
};

export const ARENA_CAMPAIGN_MISSION_ORDER: ArenaCampaignMissionId[] = [
  'prismVergeRecon',
  'hiveForgeAssault',
  'vectorSpindlePurge',
  'eclipseEdgeBreak',
  'nexusGateSiege',
];

export function isCampaignMissionUnlocked(
  missionId: ArenaCampaignMissionId,
  missionProgress: Record<ArenaCampaignMissionId, { completed: boolean }>,
): boolean {
  const index = ARENA_CAMPAIGN_MISSION_ORDER.indexOf(missionId);
  if (index <= 0) return true;
  const previousMissionId = ARENA_CAMPAIGN_MISSION_ORDER[index - 1];
  return missionProgress[previousMissionId]?.completed ?? false;
}

export function getNextActiveCampaignMission(
  missionProgress: Record<ArenaCampaignMissionId, { completed: boolean }>,
): ArenaCampaignMissionId {
  for (const missionId of ARENA_CAMPAIGN_MISSION_ORDER) {
    if (!missionProgress[missionId]?.completed) {
      return missionId;
    }
  }
  return ARENA_CAMPAIGN_MISSION_ORDER[ARENA_CAMPAIGN_MISSION_ORDER.length - 1];
}

export function getArenaCampaignLevelFromXp(xp: number) {
  let level = 1;
  for (let index = 0; index < ARENA_CAMPAIGN_XP_THRESHOLDS.length; index += 1) {
    if (xp >= ARENA_CAMPAIGN_XP_THRESHOLDS[index]) {
      level = index + 1;
    }
  }
  return Math.min(level, ARENA_CAMPAIGN_XP_THRESHOLDS.length);
}

export function getArenaCampaignLevelProgress(xp: number) {
  const level = getArenaCampaignLevelFromXp(xp);
  const currentThreshold = ARENA_CAMPAIGN_XP_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = ARENA_CAMPAIGN_XP_THRESHOLDS[level] ?? currentThreshold;
  const needed = Math.max(1, nextThreshold - currentThreshold);
  return {
    level,
    currentXp: xp - currentThreshold,
    neededXp: needed,
    progress: nextThreshold === currentThreshold ? 1 : Math.min(1, Math.max(0, (xp - currentThreshold) / needed)),
  };
}

export function getArenaCampaignWeaponSlotCount(level: number) {
  return level >= 4 ? 2 : 1;
}

export function createArenaCampaignWeaponUpgradeTrack(): ArenaCampaignWeaponUpgradeTrack {
  return {
    damage: 0,
    guns: 0,
    cycle: 0,
    velocity: 0,
    stability: 0,
  };
}

export function createArenaCampaignShipStatUpgrades(): ArenaCampaignShipStatUpgrades {
  return {
    health: 0,
    shield: 0,
  };
}

function getCampaignWeaponBaseShotCount(weaponId: ArenaCampaignWeaponId) {
  return weaponId === 'missileRack' ? 2 : BASE_ARENA_WEAPON.shotCount;
}

export function getArenaCampaignWeaponUpgradeMaxLevel(
  weaponId: ArenaCampaignWeaponId,
  upgradeKey: ArenaCampaignWeaponUpgradeKey,
) {
  const weaponDefinition = ARENA_CAMPAIGN_WEAPONS[weaponId];
  switch (upgradeKey) {
    case 'damage':
      return null;
    case 'guns':
      return Math.max(
        0,
        CAMPAIGN_BUILD_MAX_SHOT_COUNT[weaponDefinition.buildId] -
          getCampaignWeaponBaseShotCount(weaponId),
      );
    case 'cycle': {
      const floor = CAMPAIGN_BUILD_FIRE_INTERVAL_FLOOR[weaponDefinition.buildId];
      if (BASE_ARENA_WEAPON.fireInterval <= floor) {
        return 0;
      }
      let level = 0;
      let nextInterval = BASE_ARENA_WEAPON.fireInterval;
      while (level < 32 && nextInterval > floor + 0.0001) {
        level += 1;
        nextInterval *= 0.93;
      }
      return level;
    }
    case 'velocity':
    case 'stability':
      return ARENA_CAMPAIGN_WEAPON_UPGRADE_DEFAULT_MAX_LEVEL;
  }
}

export function applyArenaCampaignWeaponUpgrades(
  weaponId: ArenaCampaignWeaponId,
  weapon: ArenaWeapon,
  upgrades: ArenaCampaignWeaponUpgradeTrack,
) {
  const damageLevel = Math.max(0, upgrades.damage);
  const gunsMaxLevel = getArenaCampaignWeaponUpgradeMaxLevel(weaponId, 'guns') ?? 0;
  const cycleMaxLevel = getArenaCampaignWeaponUpgradeMaxLevel(weaponId, 'cycle') ?? 0;
  const velocityMaxLevel = getArenaCampaignWeaponUpgradeMaxLevel(weaponId, 'velocity') ?? ARENA_CAMPAIGN_WEAPON_UPGRADE_DEFAULT_MAX_LEVEL;
  const stabilityMaxLevel = getArenaCampaignWeaponUpgradeMaxLevel(weaponId, 'stability') ?? ARENA_CAMPAIGN_WEAPON_UPGRADE_DEFAULT_MAX_LEVEL;
  const gunsLevel = Math.max(0, Math.min(gunsMaxLevel, upgrades.guns));
  const cycleLevel = Math.max(0, Math.min(cycleMaxLevel, upgrades.cycle));
  const velocityLevel = Math.max(0, Math.min(velocityMaxLevel, upgrades.velocity));
  const stabilityLevel = Math.max(0, Math.min(stabilityMaxLevel, upgrades.stability));
  const weaponDefinition = ARENA_CAMPAIGN_WEAPONS[weaponId];

  return {
    ...weapon,
    damage: weapon.damage + damageLevel * 2,
    fireInterval:
      cycleLevel <= 0
        ? weapon.fireInterval
        : Math.max(
            CAMPAIGN_BUILD_FIRE_INTERVAL_FLOOR[weaponDefinition.buildId],
            weapon.fireInterval * Math.pow(0.93, cycleLevel),
          ),
    shotCount: Math.min(
      CAMPAIGN_BUILD_MAX_SHOT_COUNT[weaponDefinition.buildId],
      weapon.shotCount + gunsLevel,
    ),
    bulletSpeed: Math.min(1900, weapon.bulletSpeed + velocityLevel * 110),
    bulletSize: Math.min(30, weapon.bulletSize + velocityLevel * 0.22),
    spread: Math.max(7, Math.round(weapon.spread * Math.pow(0.94, stabilityLevel))),
    pierce: weapon.pierce + Math.floor(stabilityLevel / 2),
  };
}

export function getArenaCampaignShipStatBonuses(upgrades: ArenaCampaignShipStatUpgrades) {
  return {
    health: Math.max(0, upgrades.health) * ARENA_CAMPAIGN_HEALTH_UPGRADE_BONUS,
    shield: Math.max(0, upgrades.shield) * ARENA_CAMPAIGN_SHIELD_UPGRADE_BONUS,
  };
}

export function getArenaCampaignRunXp(gameState: ArenaGameState) {
  if (gameState.runMode !== 'campaign' || !gameState.campaignMissionId) {
    return 0;
  }
  const mission = ARENA_CAMPAIGN_MISSIONS[gameState.campaignMissionId];
  const progressXp = Math.min(gameState.bestTierReached, mission.targetTier) * 18;
  const clearXp = gameState.status === 'won' ? mission.rewardXp : 0;
  const bossXp = gameState.runBossClears * 45;
  return progressXp + clearXp + bossXp;
}
