import type {
  ArenaBuildId,
  ArenaCampaignMissionId,
  ArenaCampaignShieldId,
  ArenaCampaignWeaponId,
  ArenaGameState,
} from './types';

export const ARENA_CAMPAIGN_XP_THRESHOLDS = [0, 120, 280, 520, 860, 1300, 1840, 2480, 3220, 4060, 5000] as const;

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
};

export const ARENA_CAMPAIGN_MISSION_ORDER: ArenaCampaignMissionId[] = ['prismVergeRecon'];

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
