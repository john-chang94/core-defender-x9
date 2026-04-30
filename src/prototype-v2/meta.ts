import AsyncStorage from '@react-native-async-storage/async-storage';

import { ARENA_BUILD_META, ARENA_BUILD_ORDER } from './builds';
import {
  ARENA_CAMPAIGN_MISSION_ORDER,
  ARENA_CAMPAIGN_MISSIONS,
  ARENA_CAMPAIGN_SHIELDS,
  ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER,
  ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER,
  ARENA_CAMPAIGN_WEAPONS,
  createArenaCampaignShipStatUpgrades,
  createArenaCampaignWeaponUpgradeTrack,
  getArenaCampaignWeaponUpgradeMaxLevel,
  getArenaCampaignLevelFromXp,
  getArenaCampaignRunXp,
  getArenaCampaignWeaponSlotCount,
} from './campaign';
import {
  ARENA_COSMETIC_ORDER,
  createArenaBuildValueMap,
  getArenaBuildCosmeticIds,
  getArenaCosmeticDefinition,
  getArenaDefaultBuildCosmetic,
  getArenaDefaultGlobalCosmetic,
  getArenaGlobalCosmeticIds,
  getArenaUnlockRewardCosmeticId,
} from './cosmetics';
import { ARENA_ENEMY_ORDER } from './config';
import type {
  ArenaBuildId,
  ArenaBuildMastery,
  ArenaBuildValueMap,
  ArenaCampaignLoadout,
  ArenaCampaignMissionId,
  ArenaCampaignMissionProgress,
  ArenaCampaignShieldId,
  ArenaCampaignShipStatUpgradeKey,
  ArenaCampaignShipStatUpgrades,
  ArenaCampaignState,
  ArenaCampaignWeaponId,
  ArenaCampaignWeaponUpgradeKey,
  ArenaCampaignWeaponUpgradeMap,
  ArenaCampaignWeaponUpgradeTrack,
  ArenaCoachHintEntry,
  ArenaCoachHintId,
  ArenaCoachHintValueMap,
  ArenaCosmeticDisplayState,
  ArenaCosmeticId,
  ArenaCosmeticOwnershipEntry,
  ArenaCosmeticState,
  ArenaCosmeticValueMap,
  ArenaEquippedCosmetics,
  ArenaCodexBuildEntry,
  ArenaCodexEnemyEntry,
  ArenaEnemyKind,
  ArenaEnemyValueMap,
  ArenaGameState,
  ArenaMetaState,
  ArenaRunMetaSummary,
  ArenaUnlockEntry,
  ArenaUnlockId,
  ArenaUnlockValueMap,
} from './types';

export const ARENA_META_STORAGE_KEY = 'arena-v2-meta-v1';
export const ARENA_META_VERSION = 11;
export const ARENA_BUILD_MASTERY_THRESHOLDS = [0, 100, 220, 360, 520, 700, 900, 1120, 1360, 1620, 1900] as const;

export const ARENA_COACH_HINT_ORDER: ArenaCoachHintId[] = [
  'movement',
  'salvageArmory',
  'buildSwitching',
  'overdrive',
  'ultimateCharge',
  'impactHazard',
  'laneBandHazard',
  'bossPhase',
  'collectionClaim',
  'tierRewards',
];

const ARENA_BUILD_MASTERY_TITLES = [
  'Cadet',
  'Operator',
  'Striker',
  'Vanguard',
  'Adept',
  'Specialist',
  'Breaker',
  'Commander',
  'Mythic',
  'Paragon',
  'Zenith',
] as const;

export const ARENA_ENEMY_LABELS: ArenaEnemyValueMap<string> = {
  hover: 'Hover Drone',
  burst: 'Burst Drone',
  tank: 'Bulwark Tank',
  orbiter: 'Orbiter',
  sniper: 'Needle Sniper',
  bomber: 'Bombard',
  interceptor: 'Interceptor',
  warden: 'Warden',
  lancer: 'Lancer',
  carrier: 'Carrier',
  artillery: 'Artillery',
  weaver: 'Weaver',
  conductor: 'Conductor',
  raider: 'Raider',
  hunter: 'Hunter',
  prismBoss: 'Prism Core',
  hiveCarrierBoss: 'Hive Carrier',
  vectorLoomBoss: 'Vector Loom',
  eclipseTalonBoss: 'Eclipse Talon',
};

const ARENA_ENEMY_SUMMARIES: ArenaEnemyValueMap<string> = {
  hover: 'Entry pressure drone with light drifting fire and fast descend speed.',
  burst: 'Close spread attacker that stacks short bolt fans around the midline.',
  tank: 'Heavy hull that lobs dense bombs and soaks burst damage.',
  orbiter: 'Oscillating skirmisher with drifting wave shots and unstable movement.',
  sniper: 'Backline marksman with long telegraphs and punishing needle fire.',
  bomber: 'Formation breaker that floods lanes with bomb arcs and splash pressure.',
  interceptor: 'Mini-boss pursuit craft that chases the player across the lane.',
  warden: 'Support ship that links temporary protection to nearby allies.',
  lancer: 'Lane-control striker with telegraphed piercing attacks that force horizontal dodges.',
  carrier: 'Escort carrier that extends encounters by deploying light reinforcement packets.',
  artillery: 'Siege craft that paints delayed impact zones in the lower arena.',
  weaver: 'Control ship that deploys paired lane-band hazards while preserving one full safe lane.',
  conductor: 'Control striker that sweeps adjacent lane bands in readable multi-beat patterns.',
  raider: 'Fast flank craft that telegraphs a side dash before firing angled crossing bursts.',
  hunter: 'Pursuit marksman that marks a lane, delays, then fires staggered needle volleys around the lock.',
  prismBoss: 'Phase-driven boss core that mutates its pressure patterns as health breaks.',
  hiveCarrierBoss: 'Rotating boss carrier that mixes escort deployment, shelling, and lane pressure.',
  vectorLoomBoss: 'Rotating control boss that combines thread walls, sweep beats, and support pressure.',
  eclipseTalonBoss: 'Rotating flank boss that combines raider dashes, hunter marks, and support pressure.',
};

export const ARENA_UNLOCK_ORDER: ArenaUnlockId[] = [
  'prismCoreFirstClear',
  'hiveCarrierFirstClear',
  'vectorLoomFirstClear',
  'eclipseTalonFirstClear',
  'bossTriadComplete',
  'bossFullRotationComplete',
  'singleRunBossTriadClear',
  'tier24Clear',
  'tier30Clear',
  'tier45Clear',
  'tier60Clear',
  'enemyCodexComplete',
  'railFocusMastery4',
  'railFocusMastery8',
  'railFocusMastery10',
  'novaBloomMastery4',
  'novaBloomMastery8',
  'novaBloomMastery10',
  'missileCommandMastery4',
  'missileCommandMastery8',
  'missileCommandMastery10',
  'fractureCoreMastery4',
  'fractureCoreMastery8',
  'fractureCoreMastery10',
];

const ARENA_UNLOCK_DEFINITIONS: ArenaUnlockValueMap<Omit<ArenaUnlockEntry, 'unlocked' | 'unlockedAt'>> = {
  prismCoreFirstClear: {
    id: 'prismCoreFirstClear',
    label: 'Prism Core Clear',
    description: 'Clear Prism Core once.',
    rewardLabel: 'Boss Banner: Prism Shard',
    category: 'boss',
    buildId: null,
    sourceMilestoneId: 'boss:prism-core:first-clear',
  },
  hiveCarrierFirstClear: {
    id: 'hiveCarrierFirstClear',
    label: 'Hive Carrier Clear',
    description: 'Clear Hive Carrier once.',
    rewardLabel: 'Boss Banner: Hive Trace',
    category: 'boss',
    buildId: null,
    sourceMilestoneId: 'boss:hive-carrier:first-clear',
  },
  vectorLoomFirstClear: {
    id: 'vectorLoomFirstClear',
    label: 'Vector Loom Clear',
    description: 'Clear Vector Loom once.',
    rewardLabel: 'Boss Banner: Loom Static',
    category: 'boss',
    buildId: null,
    sourceMilestoneId: 'boss:vector-loom:first-clear',
  },
  eclipseTalonFirstClear: {
    id: 'eclipseTalonFirstClear',
    label: 'Eclipse Talon Clear',
    description: 'Clear Eclipse Talon once.',
    rewardLabel: 'Boss Banner: Eclipse Cut',
    category: 'boss',
    buildId: null,
    sourceMilestoneId: 'boss:eclipse-talon:first-clear',
  },
  bossTriadComplete: {
    id: 'bossTriadComplete',
    label: 'Boss Triad Complete',
    description: 'Clear Prism Core, Hive Carrier, and Vector Loom at least once each.',
    rewardLabel: 'Codex Frame: Triad Grid',
    category: 'codex',
    buildId: null,
    sourceMilestoneId: 'boss:triad:complete',
  },
  bossFullRotationComplete: {
    id: 'bossFullRotationComplete',
    label: 'Full Boss Rotation',
    description: 'Clear Prism Core, Hive Carrier, Vector Loom, and Eclipse Talon at least once each.',
    rewardLabel: 'Codex Frame: Full Rotation',
    category: 'codex',
    buildId: null,
    sourceMilestoneId: 'boss:rotation:complete',
  },
  singleRunBossTriadClear: {
    id: 'singleRunBossTriadClear',
    label: 'Single-Run Triad Break',
    description: 'Clear Prism Core, Hive Carrier, and Vector Loom in one run.',
    rewardLabel: 'Boss Banner: Triad Breaker',
    category: 'boss',
    buildId: null,
    sourceMilestoneId: 'boss:triad:single-run',
  },
  tier24Clear: {
    id: 'tier24Clear',
    label: 'Tier 24 Clear',
    description: 'Reach pressure tier 24 in a single run.',
    rewardLabel: 'Codex Frame: Endless Apex',
    category: 'codex',
    buildId: null,
    sourceMilestoneId: 'tier:24:first-clear',
  },
  tier30Clear: {
    id: 'tier30Clear',
    label: 'Tier 30 Clear',
    description: 'Reach pressure tier 30 in a single run.',
    rewardLabel: 'Codex Frame: Threat Cartographer',
    category: 'codex',
    buildId: null,
    sourceMilestoneId: 'tier:30:first-clear',
  },
  tier45Clear: {
    id: 'tier45Clear',
    label: 'Tier 45 Clear',
    description: 'Reach pressure tier 45 in a single run.',
    rewardLabel: 'Boss Banner: Deep Cycle',
    category: 'codex',
    buildId: null,
    sourceMilestoneId: 'tier:45:first-clear',
  },
  tier60Clear: {
    id: 'tier60Clear',
    label: 'Tier 60 Clear',
    description: 'Reach pressure tier 60 in a single run.',
    rewardLabel: 'Codex Frame: Outer Limit',
    category: 'codex',
    buildId: null,
    sourceMilestoneId: 'tier:60:first-clear',
  },
  enemyCodexComplete: {
    id: 'enemyCodexComplete',
    label: 'Enemy Codex Complete',
    description: 'Discover every enemy and boss signal in Arena V2.',
    rewardLabel: 'Codex Frame: Full Spectrum',
    category: 'codex',
    buildId: null,
    sourceMilestoneId: 'codex:enemy:complete',
  },
  railFocusMastery4: {
    id: 'railFocusMastery4',
    label: 'Rail Focus Rank 4',
    description: 'Reach Rail Focus mastery rank 4.',
    rewardLabel: 'Build Accent: Rail Halo',
    category: 'mastery',
    buildId: 'railFocus',
    sourceMilestoneId: 'mastery:railFocus:4',
  },
  railFocusMastery8: {
    id: 'railFocusMastery8',
    label: 'Rail Focus Rank 8',
    description: 'Reach Rail Focus mastery rank 8.',
    rewardLabel: 'Build Crest: Rail Zenith',
    category: 'mastery',
    buildId: 'railFocus',
    sourceMilestoneId: 'mastery:railFocus:8',
  },
  railFocusMastery10: {
    id: 'railFocusMastery10',
    label: 'Rail Focus Rank 10',
    description: 'Reach Rail Focus mastery rank 10.',
    rewardLabel: 'Rail Focus: Apex Rail',
    category: 'mastery',
    buildId: 'railFocus',
    sourceMilestoneId: 'mastery:railFocus:10',
  },
  novaBloomMastery4: {
    id: 'novaBloomMastery4',
    label: 'Nova Bloom Rank 4',
    description: 'Reach Nova Bloom mastery rank 4.',
    rewardLabel: 'Build Accent: Bloom Echo',
    category: 'mastery',
    buildId: 'novaBloom',
    sourceMilestoneId: 'mastery:novaBloom:4',
  },
  novaBloomMastery8: {
    id: 'novaBloomMastery8',
    label: 'Nova Bloom Rank 8',
    description: 'Reach Nova Bloom mastery rank 8.',
    rewardLabel: 'Build Crest: Solar Bloom',
    category: 'mastery',
    buildId: 'novaBloom',
    sourceMilestoneId: 'mastery:novaBloom:8',
  },
  novaBloomMastery10: {
    id: 'novaBloomMastery10',
    label: 'Nova Bloom Rank 10',
    description: 'Reach Nova Bloom mastery rank 10.',
    rewardLabel: 'Nova Bloom: Solar Crown',
    category: 'mastery',
    buildId: 'novaBloom',
    sourceMilestoneId: 'mastery:novaBloom:10',
  },
  missileCommandMastery4: {
    id: 'missileCommandMastery4',
    label: 'Missile Command Rank 4',
    description: 'Reach Missile Command mastery rank 4.',
    rewardLabel: 'Build Accent: Strike Mesh',
    category: 'mastery',
    buildId: 'missileCommand',
    sourceMilestoneId: 'mastery:missileCommand:4',
  },
  missileCommandMastery8: {
    id: 'missileCommandMastery8',
    label: 'Missile Command Rank 8',
    description: 'Reach Missile Command mastery rank 8.',
    rewardLabel: 'Build Crest: Ordnance Crown',
    category: 'mastery',
    buildId: 'missileCommand',
    sourceMilestoneId: 'mastery:missileCommand:8',
  },
  missileCommandMastery10: {
    id: 'missileCommandMastery10',
    label: 'Missile Command Rank 10',
    description: 'Reach Missile Command mastery rank 10.',
    rewardLabel: 'Missile Command: Siege Mesh',
    category: 'mastery',
    buildId: 'missileCommand',
    sourceMilestoneId: 'mastery:missileCommand:10',
  },
  fractureCoreMastery4: {
    id: 'fractureCoreMastery4',
    label: 'Fracture Core Rank 4',
    description: 'Reach Fracture Core mastery rank 4.',
    rewardLabel: 'Build Accent: Fracture Vein',
    category: 'mastery',
    buildId: 'fractureCore',
    sourceMilestoneId: 'mastery:fractureCore:4',
  },
  fractureCoreMastery8: {
    id: 'fractureCoreMastery8',
    label: 'Fracture Core Rank 8',
    description: 'Reach Fracture Core mastery rank 8.',
    rewardLabel: 'Build Crest: Shatter Crown',
    category: 'mastery',
    buildId: 'fractureCore',
    sourceMilestoneId: 'mastery:fractureCore:8',
  },
  fractureCoreMastery10: {
    id: 'fractureCoreMastery10',
    label: 'Fracture Core Rank 10',
    description: 'Reach Fracture Core mastery rank 10.',
    rewardLabel: 'Fracture Core: Singularity Vein',
    category: 'mastery',
    buildId: 'fractureCore',
    sourceMilestoneId: 'mastery:fractureCore:10',
  },
};

const ARENA_BUILD_UNLOCK_ORDER: ArenaBuildValueMap<ArenaUnlockId[]> = {
  railFocus: ['railFocusMastery4', 'railFocusMastery8', 'railFocusMastery10'],
  novaBloom: ['novaBloomMastery4', 'novaBloomMastery8', 'novaBloomMastery10'],
  missileCommand: ['missileCommandMastery4', 'missileCommandMastery8', 'missileCommandMastery10'],
  fractureCore: ['fractureCoreMastery4', 'fractureCoreMastery8', 'fractureCoreMastery10'],
};

function createArenaEnemyValueMap<T>(factory: (kind: ArenaEnemyKind) => T): ArenaEnemyValueMap<T> {
  return ARENA_ENEMY_ORDER.reduce((accumulator, kind) => {
    accumulator[kind] = factory(kind);
    return accumulator;
  }, {} as ArenaEnemyValueMap<T>);
}

function createArenaUnlockValueMap<T>(factory: (unlockId: ArenaUnlockId) => T): ArenaUnlockValueMap<T> {
  return ARENA_UNLOCK_ORDER.reduce((accumulator, unlockId) => {
    accumulator[unlockId] = factory(unlockId);
    return accumulator;
  }, {} as ArenaUnlockValueMap<T>);
}

function createArenaCosmeticValueMap<T>(factory: (cosmeticId: ArenaCosmeticId) => T): ArenaCosmeticValueMap<T> {
  return ARENA_COSMETIC_ORDER.reduce((accumulator, cosmeticId) => {
    accumulator[cosmeticId] = factory(cosmeticId);
    return accumulator;
  }, {} as ArenaCosmeticValueMap<T>);
}

function createArenaCoachHintValueMap<T>(factory: (hintId: ArenaCoachHintId) => T): ArenaCoachHintValueMap<T> {
  return ARENA_COACH_HINT_ORDER.reduce((accumulator, hintId) => {
    accumulator[hintId] = factory(hintId);
    return accumulator;
  }, {} as ArenaCoachHintValueMap<T>);
}

function createCodexEnemyEntry(kind: ArenaEnemyKind): ArenaCodexEnemyEntry {
  return {
    kind,
    label: ARENA_ENEMY_LABELS[kind],
    discovered: false,
    firstSeenTier: null,
    firstKillTier: null,
    firstClearTier: null,
    totalKills: 0,
    bossClears: 0,
    summary: ARENA_ENEMY_SUMMARIES[kind],
  };
}

function createCodexBuildEntry(buildId: ArenaBuildId): ArenaCodexBuildEntry {
  const buildMeta = ARENA_BUILD_META[buildId];
  return {
    buildId,
    label: buildMeta.label,
    shortLabel: buildMeta.shortLabel,
    summary: buildMeta.summary,
    description: buildMeta.description,
    ultimateLabel: buildMeta.ultimateLabel,
    ultimateDescription: buildMeta.ultimateDescription,
  };
}

function getMasteryTitle(level: number) {
  return ARENA_BUILD_MASTERY_TITLES[Math.max(0, Math.min(level, ARENA_BUILD_MASTERY_TITLES.length - 1))];
}

function createMasteryEntry(buildId: ArenaBuildId): ArenaBuildMastery {
  return {
    buildId,
    xp: 0,
    level: 0,
    title: getMasteryTitle(0),
    runs: 0,
    bestTier: 1,
    miniBossClears: 0,
    bossClears: 0,
  };
}

function createUnlockEntry(unlockId: ArenaUnlockId): ArenaUnlockEntry {
  const definition = ARENA_UNLOCK_DEFINITIONS[unlockId];
  return {
    ...definition,
    unlocked: false,
    unlockedAt: null,
  };
}

function createCosmeticOwnershipEntry(cosmeticId: ArenaCosmeticId): ArenaCosmeticOwnershipEntry {
  const definition = getArenaCosmeticDefinition(cosmeticId);
  return {
    id: cosmeticId,
    state: definition.sourceType === 'default' ? 'owned' : 'locked',
    claimedAt: null,
  };
}

function createCoachHintEntry(hintId: ArenaCoachHintId): ArenaCoachHintEntry {
  return {
    id: hintId,
    seen: false,
    seenAt: null,
  };
}

function createCampaignMissionProgress(missionId: ArenaCampaignMissionId): ArenaCampaignMissionProgress {
  return {
    missionId,
    bestTier: 1,
    completed: false,
    completions: 0,
  };
}

function createCampaignMissionProgressMap() {
  return ARENA_CAMPAIGN_MISSION_ORDER.reduce(
    (progress, missionId) => ({
      ...progress,
      [missionId]: createCampaignMissionProgress(missionId),
    }),
    {} as Record<ArenaCampaignMissionId, ArenaCampaignMissionProgress>
  );
}

function createCampaignLoadout(): ArenaCampaignLoadout {
  return {
    weaponSlots: ['railCannon', null],
    activeWeaponSlot: 0,
    shieldId: 'aegisDampener',
  };
}

function createCampaignWeaponUpgradeMap(): ArenaCampaignWeaponUpgradeMap {
  return {
    railCannon: createArenaCampaignWeaponUpgradeTrack(),
    bloomEmitter: createArenaCampaignWeaponUpgradeTrack(),
    missileRack: createArenaCampaignWeaponUpgradeTrack(),
    fractureDriver: createArenaCampaignWeaponUpgradeTrack(),
  };
}

function createCampaignState(): ArenaCampaignState {
  return {
    xp: 0,
    level: 1,
    weaponUpgradePoints: 0,
    weaponUpgrades: createCampaignWeaponUpgradeMap(),
    shipStatUpgrades: createArenaCampaignShipStatUpgrades(),
    loadout: createCampaignLoadout(),
    missionProgress: createCampaignMissionProgressMap(),
  };
}

function createEquippedCosmetics(): ArenaEquippedCosmetics {
  return {
    banner: getArenaDefaultGlobalCosmetic('banner'),
    codexFrame: getArenaDefaultGlobalCosmetic('codexFrame'),
    buildAccent: createArenaBuildValueMap((buildId) => getArenaDefaultBuildCosmetic(buildId, 'buildAccent')),
    buildCrest: createArenaBuildValueMap((buildId) => getArenaDefaultBuildCosmetic(buildId, 'buildCrest')),
  };
}

function isCosmeticOwned(entry: ArenaCosmeticOwnershipEntry | undefined) {
  return entry?.state === 'owned';
}

function isGlobalCosmeticCompatible(
  cosmeticId: ArenaCosmeticId,
  slot: 'banner' | 'codexFrame',
  cosmetics: ArenaCosmeticValueMap<ArenaCosmeticOwnershipEntry>
) {
  const definition = getArenaCosmeticDefinition(cosmeticId);
  return definition.slot === slot && definition.buildId === null && isCosmeticOwned(cosmetics[cosmeticId]);
}

function isBuildCosmeticCompatible(
  cosmeticId: ArenaCosmeticId,
  buildId: ArenaBuildId,
  slot: 'buildAccent' | 'buildCrest',
  cosmetics: ArenaCosmeticValueMap<ArenaCosmeticOwnershipEntry>
) {
  const definition = getArenaCosmeticDefinition(cosmeticId);
  return definition.slot === slot && definition.buildId === buildId && isCosmeticOwned(cosmetics[cosmeticId]);
}

function normalizeEquippedCosmetics(
  candidate: Partial<ArenaEquippedCosmetics> | undefined,
  cosmetics: ArenaCosmeticValueMap<ArenaCosmeticOwnershipEntry>
) {
  const defaultEquipped = createEquippedCosmetics();

  return {
    banner:
      typeof candidate?.banner === 'string' && isGlobalCosmeticCompatible(candidate.banner, 'banner', cosmetics)
        ? candidate.banner
        : defaultEquipped.banner,
    codexFrame:
      typeof candidate?.codexFrame === 'string' &&
      isGlobalCosmeticCompatible(candidate.codexFrame, 'codexFrame', cosmetics)
        ? candidate.codexFrame
        : defaultEquipped.codexFrame,
    buildAccent: createArenaBuildValueMap((buildId) => {
      const nextId = candidate?.buildAccent?.[buildId];
      return typeof nextId === 'string' && isBuildCosmeticCompatible(nextId, buildId, 'buildAccent', cosmetics)
        ? nextId
        : defaultEquipped.buildAccent[buildId];
    }),
    buildCrest: createArenaBuildValueMap((buildId) => {
      const nextId = candidate?.buildCrest?.[buildId];
      return typeof nextId === 'string' && isBuildCosmeticCompatible(nextId, buildId, 'buildCrest', cosmetics)
        ? nextId
        : defaultEquipped.buildCrest[buildId];
    }),
  };
}

function isCampaignWeaponId(value: unknown): value is ArenaCampaignWeaponId {
  return typeof value === 'string' && value in ARENA_CAMPAIGN_WEAPONS;
}

function isCampaignShieldId(value: unknown): value is ArenaCampaignShieldId {
  return typeof value === 'string' && value in ARENA_CAMPAIGN_SHIELDS;
}

function normalizeCampaignWeaponUpgradeTrack(
  weaponId: ArenaCampaignWeaponId,
  candidate: Partial<ArenaCampaignWeaponUpgradeTrack> | undefined
): ArenaCampaignWeaponUpgradeTrack {
  const nextTrack = createArenaCampaignWeaponUpgradeTrack();
  ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER.forEach((key) => {
    const level = Math.max(0, Math.floor(Number(candidate?.[key]) || 0));
    const maxLevel = getArenaCampaignWeaponUpgradeMaxLevel(weaponId, key);
    nextTrack[key] = maxLevel === null ? level : Math.min(maxLevel, level);
  });
  return nextTrack;
}

function normalizeCampaignWeaponUpgradeMap(
  candidate: Partial<ArenaCampaignWeaponUpgradeMap> | undefined
): ArenaCampaignWeaponUpgradeMap {
  return {
    railCannon: normalizeCampaignWeaponUpgradeTrack('railCannon', candidate?.railCannon),
    bloomEmitter: normalizeCampaignWeaponUpgradeTrack('bloomEmitter', candidate?.bloomEmitter),
    missileRack: normalizeCampaignWeaponUpgradeTrack('missileRack', candidate?.missileRack),
    fractureDriver: normalizeCampaignWeaponUpgradeTrack('fractureDriver', candidate?.fractureDriver),
  };
}

function normalizeCampaignShipStatUpgrades(
  candidate: Partial<ArenaCampaignShipStatUpgrades> | undefined
): ArenaCampaignShipStatUpgrades {
  const nextUpgrades = createArenaCampaignShipStatUpgrades();
  ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER.forEach((key) => {
    nextUpgrades[key] = Math.max(0, Math.floor(Number(candidate?.[key]) || 0));
  });
  return nextUpgrades;
}

function getSpentCampaignUpgradeCount(
  weaponUpgrades: ArenaCampaignWeaponUpgradeMap,
  shipStatUpgrades: ArenaCampaignShipStatUpgrades
) {
  const spentWeaponUpgrades = Object.values(weaponUpgrades).reduce(
    (total, track) =>
      total +
      ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER.reduce(
        (trackTotal, key) => trackTotal + track[key],
        0,
      ),
    0,
  );
  const spentShipStatUpgrades = ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER.reduce(
    (total, key) => total + shipStatUpgrades[key],
    0,
  );
  return spentWeaponUpgrades + spentShipStatUpgrades;
}

function normalizeCampaignState(candidate: Partial<ArenaCampaignState> | undefined): ArenaCampaignState {
  const defaultState = createCampaignState();
  const xp = Math.max(0, Math.floor(Number(candidate?.xp) || 0));
  const level = getArenaCampaignLevelFromXp(xp);
  const slotCount = getArenaCampaignWeaponSlotCount(level);
  const firstWeapon = isCampaignWeaponId(candidate?.loadout?.weaponSlots?.[0])
    ? candidate.loadout.weaponSlots[0]
    : defaultState.loadout.weaponSlots[0];
  const secondWeapon =
    slotCount >= 2 && isCampaignWeaponId(candidate?.loadout?.weaponSlots?.[1])
      ? candidate.loadout.weaponSlots[1]
      : null;
  const activeWeaponSlot = slotCount >= 2 && candidate?.loadout?.activeWeaponSlot === 1 ? 1 : 0;
  const shieldId = isCampaignShieldId(candidate?.loadout?.shieldId)
    ? candidate.loadout.shieldId
    : defaultState.loadout.shieldId;
  const weaponUpgrades = normalizeCampaignWeaponUpgradeMap(candidate?.weaponUpgrades);
  const shipStatUpgrades = normalizeCampaignShipStatUpgrades(candidate?.shipStatUpgrades);
  const spentUpgradeCount = getSpentCampaignUpgradeCount(weaponUpgrades, shipStatUpgrades);
  const retroactiveUpgradePoints = Math.max(0, level - 1 - spentUpgradeCount);
  const weaponUpgradePoints =
    typeof candidate?.weaponUpgradePoints === 'number'
      ? Math.max(0, Math.floor(candidate.weaponUpgradePoints))
      : retroactiveUpgradePoints;
  const missionProgress = ARENA_CAMPAIGN_MISSION_ORDER.reduce(
    (progress, missionId) => {
      const previousEntry = candidate?.missionProgress?.[missionId];
      progress[missionId] = {
        ...createCampaignMissionProgress(missionId),
        ...(previousEntry ?? {}),
        missionId,
        bestTier: Math.max(1, Math.floor(Number(previousEntry?.bestTier) || 1)),
        completed: previousEntry?.completed ?? false,
        completions: Math.max(0, Math.floor(Number(previousEntry?.completions) || 0)),
      };
      return progress;
    },
    {} as Record<ArenaCampaignMissionId, ArenaCampaignMissionProgress>
  );

  return {
    xp,
    level,
    weaponUpgradePoints,
    weaponUpgrades,
    shipStatUpgrades,
    loadout: {
      weaponSlots: [firstWeapon, secondWeapon],
      activeWeaponSlot,
      shieldId,
    },
    missionProgress,
  };
}

function isEnemyCodexComplete(codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>) {
  return ARENA_ENEMY_ORDER.every((kind) => codexEnemies[kind].discovered);
}

function isBossTriadComplete(codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>) {
  return (
    codexEnemies.prismBoss.bossClears > 0 &&
    codexEnemies.hiveCarrierBoss.bossClears > 0 &&
    codexEnemies.vectorLoomBoss.bossClears > 0
  );
}

function isBossFullRotationComplete(codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>) {
  return (
    codexEnemies.prismBoss.bossClears > 0 &&
    codexEnemies.hiveCarrierBoss.bossClears > 0 &&
    codexEnemies.vectorLoomBoss.bossClears > 0 &&
    codexEnemies.eclipseTalonBoss.bossClears > 0
  );
}

function hasReachedTier(mastery: ArenaBuildValueMap<ArenaBuildMastery>, tier: number) {
  return ARENA_BUILD_ORDER.some((buildId) => mastery[buildId].bestTier >= tier);
}

function getTierUnlockThreshold(unlockId: ArenaUnlockId) {
  switch (unlockId) {
    case 'tier24Clear':
      return 24;
    case 'tier30Clear':
      return 30;
    case 'tier45Clear':
      return 45;
    case 'tier60Clear':
      return 60;
    default:
      return null;
  }
}

function isSingleRunBossTriadComplete(runSummary: ArenaRunMetaSummary | undefined) {
  if (!runSummary) {
    return false;
  }

  return (
    runSummary.bossClearCounts.prismBoss > 0 &&
    runSummary.bossClearCounts.hiveCarrierBoss > 0 &&
    runSummary.bossClearCounts.vectorLoomBoss > 0
  );
}

function isUnlockSatisfied(
  unlockId: ArenaUnlockId,
  codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>,
  mastery: ArenaBuildValueMap<ArenaBuildMastery>,
  runSummary?: ArenaRunMetaSummary
) {
  const tierThreshold = getTierUnlockThreshold(unlockId);
  if (tierThreshold !== null) {
    return hasReachedTier(mastery, tierThreshold);
  }

  switch (unlockId) {
    case 'prismCoreFirstClear':
      return codexEnemies.prismBoss.bossClears > 0;
    case 'hiveCarrierFirstClear':
      return codexEnemies.hiveCarrierBoss.bossClears > 0;
    case 'vectorLoomFirstClear':
      return codexEnemies.vectorLoomBoss.bossClears > 0;
    case 'eclipseTalonFirstClear':
      return codexEnemies.eclipseTalonBoss.bossClears > 0;
    case 'bossTriadComplete':
      return isBossTriadComplete(codexEnemies);
    case 'bossFullRotationComplete':
      return isBossFullRotationComplete(codexEnemies);
    case 'singleRunBossTriadClear':
      return isSingleRunBossTriadComplete(runSummary);
    case 'enemyCodexComplete':
      return isEnemyCodexComplete(codexEnemies);
    case 'railFocusMastery4':
      return mastery.railFocus.level >= 4;
    case 'railFocusMastery8':
      return mastery.railFocus.level >= 8;
    case 'railFocusMastery10':
      return mastery.railFocus.level >= 10;
    case 'novaBloomMastery4':
      return mastery.novaBloom.level >= 4;
    case 'novaBloomMastery8':
      return mastery.novaBloom.level >= 8;
    case 'novaBloomMastery10':
      return mastery.novaBloom.level >= 10;
    case 'missileCommandMastery4':
      return mastery.missileCommand.level >= 4;
    case 'missileCommandMastery8':
      return mastery.missileCommand.level >= 8;
    case 'missileCommandMastery10':
      return mastery.missileCommand.level >= 10;
    case 'fractureCoreMastery4':
      return mastery.fractureCore.level >= 4;
    case 'fractureCoreMastery8':
      return mastery.fractureCore.level >= 8;
    case 'fractureCoreMastery10':
      return mastery.fractureCore.level >= 10;
  }

  return false;
}

function applyArenaUnlockProgress(
  previousUnlocks: ArenaUnlockValueMap<ArenaUnlockEntry>,
  codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>,
  mastery: ArenaBuildValueMap<ArenaBuildMastery>,
  unlockedAt: string,
  runSummary?: ArenaRunMetaSummary
) {
  let didChange = false;
  const nextUnlocks = createArenaUnlockValueMap((unlockId) => {
    const previousEntry = previousUnlocks[unlockId] ?? createUnlockEntry(unlockId);
    const definition = ARENA_UNLOCK_DEFINITIONS[unlockId];
    const shouldUnlock = isUnlockSatisfied(unlockId, codexEnemies, mastery, runSummary);
    const nextEntry: ArenaUnlockEntry = {
      ...definition,
      unlocked: previousEntry.unlocked || shouldUnlock,
      unlockedAt: previousEntry.unlocked
        ? previousEntry.unlockedAt
        : shouldUnlock
          ? unlockedAt
          : null,
    };
    if (
      nextEntry.unlocked !== previousEntry.unlocked ||
      nextEntry.unlockedAt !== previousEntry.unlockedAt ||
      nextEntry.rewardLabel !== previousEntry.rewardLabel ||
      nextEntry.description !== previousEntry.description ||
      nextEntry.sourceMilestoneId !== previousEntry.sourceMilestoneId
    ) {
      didChange = true;
    }
    return nextEntry;
  });

  return { nextUnlocks, didChange };
}

function applyArenaCosmeticProgress(
  previousCosmetics: ArenaCosmeticValueMap<ArenaCosmeticOwnershipEntry>,
  unlocks: ArenaUnlockValueMap<ArenaUnlockEntry>
) {
  let didChange = false;
  const nextCosmetics = createArenaCosmeticValueMap((cosmeticId) => {
    const definition = getArenaCosmeticDefinition(cosmeticId);
    const previousEntry = previousCosmetics[cosmeticId] ?? createCosmeticOwnershipEntry(cosmeticId);
    const rewardUnlocked = definition.rewardUnlockId ? unlocks[definition.rewardUnlockId].unlocked : false;
    const nextState: ArenaCosmeticState =
      definition.sourceType === 'default'
        ? 'owned'
        : rewardUnlocked && previousEntry.state === 'locked'
          ? 'claimable'
          : previousEntry.state;
    const nextEntry: ArenaCosmeticOwnershipEntry = {
      id: cosmeticId,
      state: nextState,
      claimedAt: nextState === 'owned' ? previousEntry.claimedAt : null,
    };

    if (nextEntry.state !== previousEntry.state || nextEntry.claimedAt !== previousEntry.claimedAt) {
      didChange = true;
    }

    return nextEntry;
  });

  return { nextCosmetics, didChange };
}

export function createArenaMetaState(): ArenaMetaState {
  return {
    version: ARENA_META_VERSION,
    lastUpdatedAt: new Date().toISOString(),
    codexEnemies: createArenaEnemyValueMap((kind) => createCodexEnemyEntry(kind)),
    codexBuilds: createArenaBuildValueMap((buildId) => createCodexBuildEntry(buildId)),
    mastery: createArenaBuildValueMap((buildId) => createMasteryEntry(buildId)),
    unlocks: createArenaUnlockValueMap((unlockId) => createUnlockEntry(unlockId)),
    cosmetics: createArenaCosmeticValueMap((cosmeticId) => createCosmeticOwnershipEntry(cosmeticId)),
    equippedCosmetics: createEquippedCosmetics(),
    coachHints: createArenaCoachHintValueMap((hintId) => createCoachHintEntry(hintId)),
    campaign: createCampaignState(),
    isPremium: false,
    seasonPass: { tier: 0, xp: 0 },
  };
}

function normalizeArenaMetaState(raw: unknown): ArenaMetaState {
  const defaultState = createArenaMetaState();
  if (!raw || typeof raw !== 'object') {
    return defaultState;
  }

  const candidate = raw as Partial<ArenaMetaState>;
  const normalizedEnemies = createArenaEnemyValueMap((kind) => ({
    ...defaultState.codexEnemies[kind],
    ...(candidate.codexEnemies?.[kind] ?? {}),
    kind,
    label: ARENA_ENEMY_LABELS[kind],
    summary: ARENA_ENEMY_SUMMARIES[kind],
  }));
  const normalizedBuilds = createArenaBuildValueMap((buildId) => ({
    ...defaultState.codexBuilds[buildId],
    ...(candidate.codexBuilds?.[buildId] ?? {}),
    ...createCodexBuildEntry(buildId),
  }));
  const normalizedMastery = createArenaBuildValueMap((buildId) => {
    const mergedEntry = {
      ...defaultState.mastery[buildId],
      ...(candidate.mastery?.[buildId] ?? {}),
      buildId,
    };
    const level = getArenaMasteryLevelFromXp(mergedEntry.xp);
    return {
      ...mergedEntry,
      level,
      title: getMasteryTitle(level),
    };
  });
  const normalizedUnlocks = createArenaUnlockValueMap((unlockId) => ({
    ...createUnlockEntry(unlockId),
    ...(candidate.unlocks?.[unlockId] ?? {}),
    ...ARENA_UNLOCK_DEFINITIONS[unlockId],
    unlocked: candidate.unlocks?.[unlockId]?.unlocked ?? false,
    unlockedAt: candidate.unlocks?.[unlockId]?.unlockedAt ?? null,
  }));
  const normalizedCosmetics = createArenaCosmeticValueMap((cosmeticId) => ({
    ...createCosmeticOwnershipEntry(cosmeticId),
    ...(candidate.cosmetics?.[cosmeticId] ?? {}),
    id: cosmeticId,
  }));
  const normalizedCoachHints = createArenaCoachHintValueMap((hintId) => {
    const previousEntry = candidate.coachHints?.[hintId];
    return {
      ...createCoachHintEntry(hintId),
      ...(previousEntry ?? {}),
      id: hintId,
      seen: previousEntry?.seen ?? false,
      seenAt: previousEntry?.seenAt ?? null,
    };
  });
  const unlockedAt = typeof candidate.lastUpdatedAt === 'string' ? candidate.lastUpdatedAt : defaultState.lastUpdatedAt;
  const unlockProgress = applyArenaUnlockProgress(
    normalizedUnlocks,
    normalizedEnemies,
    normalizedMastery,
    unlockedAt
  );
  const cosmeticProgress = applyArenaCosmeticProgress(normalizedCosmetics, unlockProgress.nextUnlocks);
  const equippedCosmetics = normalizeEquippedCosmetics(candidate.equippedCosmetics, cosmeticProgress.nextCosmetics);
  const normalizedCampaign = normalizeCampaignState(candidate.campaign);

  const isPremium = typeof (candidate as Partial<ArenaMetaState>).isPremium === 'boolean'
    ? (candidate as Partial<ArenaMetaState>).isPremium as boolean
    : false;
  const rawSeasonPass = (candidate as Partial<ArenaMetaState>).seasonPass;
  const seasonPass = {
    tier: Math.max(0, Math.floor(Number(rawSeasonPass?.tier) || 0)),
    xp: Math.max(0, Math.floor(Number(rawSeasonPass?.xp) || 0)),
  };

  return {
    version: ARENA_META_VERSION,
    lastUpdatedAt: unlockedAt,
    codexEnemies: normalizedEnemies,
    codexBuilds: normalizedBuilds,
    mastery: normalizedMastery,
    unlocks: unlockProgress.nextUnlocks,
    cosmetics: cosmeticProgress.nextCosmetics,
    equippedCosmetics,
    coachHints: normalizedCoachHints,
    campaign: normalizedCampaign,
    isPremium,
    seasonPass,
  };
}

export function awardSeasonPassXp(metaState: ArenaMetaState, xp: number): ArenaMetaState {
  if (xp <= 0) return metaState;
  const nextXp = metaState.seasonPass.xp + xp;
  const xpPerTier = 500;
  const nextTier = Math.floor(nextXp / xpPerTier);
  return {
    ...metaState,
    lastUpdatedAt: new Date().toISOString(),
    seasonPass: { tier: nextTier, xp: nextXp },
  };
}

export async function loadArenaMetaState() {
  try {
    const serializedState = await AsyncStorage.getItem(ARENA_META_STORAGE_KEY);
    if (!serializedState) {
      return createArenaMetaState();
    }
    return normalizeArenaMetaState(JSON.parse(serializedState));
  } catch (error) {
    console.warn('Failed to load Arena V2 meta state', error);
    return createArenaMetaState();
  }
}

export async function saveArenaMetaState(metaState: ArenaMetaState) {
  try {
    await AsyncStorage.setItem(ARENA_META_STORAGE_KEY, JSON.stringify(metaState));
  } catch (error) {
    console.warn('Failed to save Arena V2 meta state', error);
  }
}

export function markArenaCoachHintSeen(metaState: ArenaMetaState, hintId: ArenaCoachHintId) {
  const previousEntry = metaState.coachHints[hintId];
  if (previousEntry.seen) {
    return metaState;
  }

  const nowIso = new Date().toISOString();
  return {
    ...metaState,
    lastUpdatedAt: nowIso,
    coachHints: {
      ...metaState.coachHints,
      [hintId]: {
        id: hintId,
        seen: true,
        seenAt: nowIso,
      },
    },
  };
}

export function resetArenaCoachHints(metaState: ArenaMetaState) {
  const nextCoachHints = createArenaCoachHintValueMap((hintId) => createCoachHintEntry(hintId));
  const didChange = ARENA_COACH_HINT_ORDER.some(
    (hintId) =>
      metaState.coachHints[hintId].seen !== nextCoachHints[hintId].seen ||
      metaState.coachHints[hintId].seenAt !== nextCoachHints[hintId].seenAt
  );

  if (!didChange) {
    return metaState;
  }

  return {
    ...metaState,
    lastUpdatedAt: new Date().toISOString(),
    coachHints: nextCoachHints,
  };
}

export function getArenaMasteryLevelFromXp(xp: number) {
  let level = 0;
  for (let index = 0; index < ARENA_BUILD_MASTERY_THRESHOLDS.length; index += 1) {
    if (xp >= ARENA_BUILD_MASTERY_THRESHOLDS[index]) {
      level = index;
    } else {
      break;
    }
  }
  return level;
}

export function getArenaMasteryProgress(xp: number) {
  const level = getArenaMasteryLevelFromXp(xp);
  const currentThreshold = ARENA_BUILD_MASTERY_THRESHOLDS[level] ?? 0;
  const nextThreshold = ARENA_BUILD_MASTERY_THRESHOLDS[level + 1] ?? currentThreshold;
  const progress =
    nextThreshold <= currentThreshold ? 1 : (xp - currentThreshold) / (nextThreshold - currentThreshold);
  return {
    level,
    currentThreshold,
    nextThreshold,
    progress: Math.max(0, Math.min(1, progress)),
    title: getMasteryTitle(level),
  };
}

export function getArenaDominantBuild(
  buildActiveSeconds: ArenaBuildValueMap<number>,
  fallbackBuild: ArenaBuildId
) {
  let dominantBuild = fallbackBuild;
  let dominantSeconds = -1;

  for (const buildId of ARENA_BUILD_ORDER) {
    const activeSeconds = buildActiveSeconds[buildId];
    if (activeSeconds > dominantSeconds) {
      dominantBuild = buildId;
      dominantSeconds = activeSeconds;
    } else if (Math.abs(activeSeconds - dominantSeconds) < 0.0001 && buildId === fallbackBuild) {
      dominantBuild = buildId;
    }
  }

  return dominantBuild;
}

export function createArenaRunMetaSummary(gameState: ArenaGameState): ArenaRunMetaSummary {
  return {
    dominantBuild: getArenaDominantBuild(gameState.runBuildActiveSeconds, gameState.activeBuild),
    currentBuild: gameState.activeBuild,
    tierReached: gameState.bestTierReached,
    miniBossClears: gameState.runMiniBossClears,
    bossClears: gameState.runBossClears,
    bossClearCounts: gameState.runBossClearsByEnemy,
    buildActiveSeconds: gameState.runBuildActiveSeconds,
    killCounts: gameState.runKillCountsByEnemy,
    firstSeenTierByEnemy: gameState.runSeenTierByEnemy,
    firstKillTierByEnemy: gameState.runFirstKillTierByEnemy,
    firstClearTierByEnemy: gameState.runFirstClearTierByEnemy,
  };
}

export function applyArenaDiscoveryProgress(
  previousMetaState: ArenaMetaState,
  firstSeenTierByEnemy: ArenaEnemyValueMap<number | null>
) {
  let didChange = false;
  const nextEnemies = createArenaEnemyValueMap((kind) => {
    const previousEntry = previousMetaState.codexEnemies[kind];
    const firstSeenTier = firstSeenTierByEnemy[kind];
    if (firstSeenTier === null) {
      return previousEntry;
    }

    const nextEntry: ArenaCodexEnemyEntry = {
      ...previousEntry,
      discovered: true,
      firstSeenTier:
        previousEntry.firstSeenTier === null ? firstSeenTier : Math.min(previousEntry.firstSeenTier, firstSeenTier),
    };
    if (
      nextEntry.discovered !== previousEntry.discovered ||
      nextEntry.firstSeenTier !== previousEntry.firstSeenTier
    ) {
      didChange = true;
    }
    return nextEntry;
  });

  const nowIso = new Date().toISOString();
  const unlockProgress = applyArenaUnlockProgress(previousMetaState.unlocks, nextEnemies, previousMetaState.mastery, nowIso);
  const cosmeticProgress = applyArenaCosmeticProgress(previousMetaState.cosmetics, unlockProgress.nextUnlocks);
  didChange = didChange || unlockProgress.didChange || cosmeticProgress.didChange;

  if (!didChange) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    codexEnemies: nextEnemies,
    unlocks: unlockProgress.nextUnlocks,
    cosmetics: cosmeticProgress.nextCosmetics,
    lastUpdatedAt: nowIso,
  };
}

export function applyArenaRunSummary(
  previousMetaState: ArenaMetaState,
  runSummary: ArenaRunMetaSummary
) {
  let didChange = false;
  const nextEnemies = createArenaEnemyValueMap((kind) => {
    const previousEntry = previousMetaState.codexEnemies[kind];
    const killCount = runSummary.killCounts[kind];
    const firstSeenTier = runSummary.firstSeenTierByEnemy[kind];
    const firstKillTier = runSummary.firstKillTierByEnemy[kind];
    const firstClearTier = runSummary.firstClearTierByEnemy[kind];
    const bossClears = previousEntry.bossClears + runSummary.bossClearCounts[kind];

    const nextEntry: ArenaCodexEnemyEntry = {
      ...previousEntry,
      discovered: previousEntry.discovered || firstSeenTier !== null,
      firstSeenTier:
        previousEntry.firstSeenTier === null
          ? firstSeenTier
          : firstSeenTier === null
            ? previousEntry.firstSeenTier
            : Math.min(previousEntry.firstSeenTier, firstSeenTier),
      firstKillTier:
        previousEntry.firstKillTier === null
          ? firstKillTier
          : firstKillTier === null
            ? previousEntry.firstKillTier
            : Math.min(previousEntry.firstKillTier, firstKillTier),
      firstClearTier:
        previousEntry.firstClearTier === null
          ? firstClearTier
          : firstClearTier === null
            ? previousEntry.firstClearTier
            : Math.min(previousEntry.firstClearTier, firstClearTier),
      totalKills: previousEntry.totalKills + killCount,
      bossClears,
    };

    if (
      nextEntry.discovered !== previousEntry.discovered ||
      nextEntry.firstSeenTier !== previousEntry.firstSeenTier ||
      nextEntry.firstKillTier !== previousEntry.firstKillTier ||
      nextEntry.firstClearTier !== previousEntry.firstClearTier ||
      nextEntry.totalKills !== previousEntry.totalKills ||
      nextEntry.bossClears !== previousEntry.bossClears
    ) {
      didChange = true;
    }

    return nextEntry;
  });

  const earnedXp = runSummary.tierReached * 20 + runSummary.miniBossClears * 35 + runSummary.bossClears * 100;
  const nextMastery = createArenaBuildValueMap((buildId) => {
    const previousEntry = previousMetaState.mastery[buildId];
    if (buildId !== runSummary.dominantBuild) {
      return previousEntry;
    }

    const nextXp = previousEntry.xp + earnedXp;
    const level = getArenaMasteryLevelFromXp(nextXp);
    const nextEntry: ArenaBuildMastery = {
      ...previousEntry,
      xp: nextXp,
      level,
      title: getMasteryTitle(level),
      runs: previousEntry.runs + 1,
      bestTier: Math.max(previousEntry.bestTier, runSummary.tierReached),
      miniBossClears: previousEntry.miniBossClears + runSummary.miniBossClears,
      bossClears: previousEntry.bossClears + runSummary.bossClears,
    };

    if (
      nextEntry.xp !== previousEntry.xp ||
      nextEntry.level !== previousEntry.level ||
      nextEntry.runs !== previousEntry.runs ||
      nextEntry.bestTier !== previousEntry.bestTier ||
      nextEntry.miniBossClears !== previousEntry.miniBossClears ||
      nextEntry.bossClears !== previousEntry.bossClears
    ) {
      didChange = true;
    }
    return nextEntry;
  });

  const nowIso = new Date().toISOString();
  const unlockProgress = applyArenaUnlockProgress(
    previousMetaState.unlocks,
    nextEnemies,
    nextMastery,
    nowIso,
    runSummary
  );
  const cosmeticProgress = applyArenaCosmeticProgress(previousMetaState.cosmetics, unlockProgress.nextUnlocks);
  didChange = didChange || unlockProgress.didChange || cosmeticProgress.didChange;

  if (!didChange) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    codexEnemies: nextEnemies,
    mastery: nextMastery,
    unlocks: unlockProgress.nextUnlocks,
    cosmetics: cosmeticProgress.nextCosmetics,
    lastUpdatedAt: nowIso,
  };
}

export function applyArenaCampaignRunResult(
  previousMetaState: ArenaMetaState,
  gameState: ArenaGameState
) {
  if (gameState.runMode !== 'campaign' || !gameState.campaignMissionId) {
    return previousMetaState;
  }

  const mission = ARENA_CAMPAIGN_MISSIONS[gameState.campaignMissionId];
  const earnedXp = getArenaCampaignRunXp(gameState);
  const previousCampaign = previousMetaState.campaign;
  const previousMissionProgress =
    previousCampaign.missionProgress[mission.id] ?? createCampaignMissionProgress(mission.id);
  const nextMissionProgress: ArenaCampaignMissionProgress = {
    ...previousMissionProgress,
    bestTier: Math.max(previousMissionProgress.bestTier, Math.min(gameState.bestTierReached, mission.targetTier)),
    completed: previousMissionProgress.completed || gameState.status === 'won',
    completions: previousMissionProgress.completions + (gameState.status === 'won' ? 1 : 0),
  };
  const nextXp = previousCampaign.xp + earnedXp;
  const nextLevel = getArenaCampaignLevelFromXp(nextXp);
  const gainedLevels = Math.max(0, nextLevel - previousCampaign.level);
  const nextCampaign: ArenaCampaignState = {
    ...previousCampaign,
    xp: nextXp,
    level: nextLevel,
    weaponUpgradePoints: previousCampaign.weaponUpgradePoints + gainedLevels,
    missionProgress: {
      ...previousCampaign.missionProgress,
      [mission.id]: nextMissionProgress,
    },
  };

  if (
    nextCampaign.xp === previousCampaign.xp &&
    nextCampaign.weaponUpgradePoints === previousCampaign.weaponUpgradePoints &&
    nextMissionProgress.bestTier === previousMissionProgress.bestTier &&
    nextMissionProgress.completed === previousMissionProgress.completed &&
    nextMissionProgress.completions === previousMissionProgress.completions
  ) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    campaign: normalizeCampaignState(nextCampaign),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function setArenaCampaignWeapon(
  previousMetaState: ArenaMetaState,
  slotIndex: 0 | 1,
  weaponId: ArenaCampaignWeaponId
) {
  const slotCount = getArenaCampaignWeaponSlotCount(previousMetaState.campaign.level);
  if (slotIndex >= slotCount || ARENA_CAMPAIGN_WEAPONS[weaponId].unlockLevel > previousMetaState.campaign.level) {
    return previousMetaState;
  }

  const weaponSlots: [ArenaCampaignWeaponId, ArenaCampaignWeaponId | null] = [
    previousMetaState.campaign.loadout.weaponSlots[0],
    previousMetaState.campaign.loadout.weaponSlots[1],
  ];
  weaponSlots[slotIndex] = weaponId;
  const nextCampaign = normalizeCampaignState({
    ...previousMetaState.campaign,
    loadout: {
      ...previousMetaState.campaign.loadout,
      weaponSlots,
      activeWeaponSlot: slotIndex,
    },
  });
  return {
    ...previousMetaState,
    campaign: nextCampaign,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function setArenaCampaignShield(
  previousMetaState: ArenaMetaState,
  shieldId: ArenaCampaignShieldId
) {
  if (ARENA_CAMPAIGN_SHIELDS[shieldId].unlockLevel > previousMetaState.campaign.level) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    campaign: normalizeCampaignState({
      ...previousMetaState.campaign,
      loadout: {
        ...previousMetaState.campaign.loadout,
        shieldId,
      },
    }),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function upgradeArenaCampaignWeapon(
  previousMetaState: ArenaMetaState,
  weaponId: ArenaCampaignWeaponId,
  upgradeKey: ArenaCampaignWeaponUpgradeKey
) {
  if (
    previousMetaState.campaign.weaponUpgradePoints <= 0 ||
    ARENA_CAMPAIGN_WEAPONS[weaponId].unlockLevel > previousMetaState.campaign.level
  ) {
    return previousMetaState;
  }

  const currentTrack = previousMetaState.campaign.weaponUpgrades[weaponId];
  const currentLevel = currentTrack[upgradeKey];
  const maxLevel = getArenaCampaignWeaponUpgradeMaxLevel(weaponId, upgradeKey);
  if (maxLevel !== null && currentLevel >= maxLevel) {
    return previousMetaState;
  }

  const nextCampaign = normalizeCampaignState({
    ...previousMetaState.campaign,
    weaponUpgradePoints: previousMetaState.campaign.weaponUpgradePoints - 1,
    weaponUpgrades: {
      ...previousMetaState.campaign.weaponUpgrades,
      [weaponId]: {
        ...currentTrack,
        [upgradeKey]: currentLevel + 1,
      },
    },
  });

  return {
    ...previousMetaState,
    campaign: nextCampaign,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function upgradeArenaCampaignShipStat(
  previousMetaState: ArenaMetaState,
  upgradeKey: ArenaCampaignShipStatUpgradeKey
) {
  if (previousMetaState.campaign.weaponUpgradePoints <= 0) {
    return previousMetaState;
  }

  const nextCampaign = normalizeCampaignState({
    ...previousMetaState.campaign,
    weaponUpgradePoints: previousMetaState.campaign.weaponUpgradePoints - 1,
    shipStatUpgrades: {
      ...previousMetaState.campaign.shipStatUpgrades,
      [upgradeKey]: previousMetaState.campaign.shipStatUpgrades[upgradeKey] + 1,
    },
  });

  return {
    ...previousMetaState,
    campaign: nextCampaign,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function getArenaBuildUnlockIds(buildId: ArenaBuildId) {
  return ARENA_BUILD_UNLOCK_ORDER[buildId];
}

export function getArenaNextBuildUnlock(metaState: ArenaMetaState, buildId: ArenaBuildId) {
  const unlockIds = ARENA_BUILD_UNLOCK_ORDER[buildId];
  return unlockIds.find((unlockId) => !metaState.unlocks[unlockId].unlocked) ?? null;
}

export function getArenaGlobalUnlockIds() {
  return ARENA_UNLOCK_ORDER.filter((unlockId) => ARENA_UNLOCK_DEFINITIONS[unlockId].buildId === null);
}

export function getArenaEquippedGlobalCosmeticId(metaState: ArenaMetaState, slot: 'banner' | 'codexFrame') {
  return slot === 'banner' ? metaState.equippedCosmetics.banner : metaState.equippedCosmetics.codexFrame;
}

export function getArenaEquippedBuildCosmeticId(
  metaState: ArenaMetaState,
  buildId: ArenaBuildId,
  slot: 'buildAccent' | 'buildCrest'
) {
  return metaState.equippedCosmetics[slot][buildId];
}

export function isArenaCosmeticEquipped(metaState: ArenaMetaState, cosmeticId: ArenaCosmeticId) {
  if (
    metaState.equippedCosmetics.banner === cosmeticId ||
    metaState.equippedCosmetics.codexFrame === cosmeticId
  ) {
    return true;
  }

  return ARENA_BUILD_ORDER.some(
    (buildId) =>
      metaState.equippedCosmetics.buildAccent[buildId] === cosmeticId ||
      metaState.equippedCosmetics.buildCrest[buildId] === cosmeticId
  );
}

export function getArenaCosmeticDisplayState(
  metaState: ArenaMetaState,
  cosmeticId: ArenaCosmeticId
): ArenaCosmeticDisplayState {
  if (isArenaCosmeticEquipped(metaState, cosmeticId)) {
    return 'equipped';
  }

  return metaState.cosmetics[cosmeticId].state;
}

export function getArenaClaimableCosmeticIds(metaState: ArenaMetaState) {
  return ARENA_COSMETIC_ORDER.filter((cosmeticId) => metaState.cosmetics[cosmeticId].state === 'claimable');
}

export function claimArenaCosmetic(metaState: ArenaMetaState, cosmeticId: ArenaCosmeticId) {
  const previousEntry = metaState.cosmetics[cosmeticId];
  if (previousEntry.state !== 'claimable') {
    return metaState;
  }

  const nowIso = new Date().toISOString();
  return {
    ...metaState,
    lastUpdatedAt: nowIso,
    cosmetics: {
      ...metaState.cosmetics,
      [cosmeticId]: {
        ...previousEntry,
        state: 'owned',
        claimedAt: nowIso,
      },
    },
  };
}

export function equipArenaCosmetic(metaState: ArenaMetaState, cosmeticId: ArenaCosmeticId) {
  if (metaState.cosmetics[cosmeticId].state !== 'owned') {
    return metaState;
  }

  const definition = getArenaCosmeticDefinition(cosmeticId);
  const nowIso = new Date().toISOString();

  if (definition.slot === 'banner' && definition.buildId === null) {
    if (metaState.equippedCosmetics.banner === cosmeticId) {
      return metaState;
    }
    return {
      ...metaState,
      lastUpdatedAt: nowIso,
      equippedCosmetics: {
        ...metaState.equippedCosmetics,
        banner: cosmeticId,
      },
    };
  }

  if (definition.slot === 'codexFrame' && definition.buildId === null) {
    if (metaState.equippedCosmetics.codexFrame === cosmeticId) {
      return metaState;
    }
    return {
      ...metaState,
      lastUpdatedAt: nowIso,
      equippedCosmetics: {
        ...metaState.equippedCosmetics,
        codexFrame: cosmeticId,
      },
    };
  }

  if (definition.slot === 'buildAccent' && definition.buildId) {
    if (metaState.equippedCosmetics.buildAccent[definition.buildId] === cosmeticId) {
      return metaState;
    }
    return {
      ...metaState,
      lastUpdatedAt: nowIso,
      equippedCosmetics: {
        ...metaState.equippedCosmetics,
        buildAccent: {
          ...metaState.equippedCosmetics.buildAccent,
          [definition.buildId]: cosmeticId,
        },
      },
    };
  }

  if (definition.slot === 'buildCrest' && definition.buildId) {
    if (metaState.equippedCosmetics.buildCrest[definition.buildId] === cosmeticId) {
      return metaState;
    }
    return {
      ...metaState,
      lastUpdatedAt: nowIso,
      equippedCosmetics: {
        ...metaState.equippedCosmetics,
        buildCrest: {
          ...metaState.equippedCosmetics.buildCrest,
          [definition.buildId]: cosmeticId,
        },
      },
    };
  }

  return metaState;
}

export function getArenaCosmeticStatusLabel(status: ArenaCosmeticDisplayState) {
  switch (status) {
    case 'locked':
      return 'Locked';
    case 'claimable':
      return 'Claimable';
    case 'owned':
      return 'Owned';
    case 'equipped':
      return 'Equipped';
  }
}

export function getArenaUnlockRewardCosmeticEntry(metaState: ArenaMetaState, unlockId: ArenaUnlockId) {
  const cosmeticId = getArenaUnlockRewardCosmeticId(unlockId);
  if (!cosmeticId) {
    return null;
  }

  return {
    cosmeticId,
    definition: getArenaCosmeticDefinition(cosmeticId),
    ownership: metaState.cosmetics[cosmeticId],
    displayState: getArenaCosmeticDisplayState(metaState, cosmeticId),
  };
}

export function getArenaGlobalCollectionCosmeticIds(slot: 'banner' | 'codexFrame') {
  return getArenaGlobalCosmeticIds(slot);
}

export function getArenaBuildCollectionCosmeticIds(
  buildId: ArenaBuildId,
  slot: 'buildAccent' | 'buildCrest'
) {
  return getArenaBuildCosmeticIds(buildId, slot);
}
