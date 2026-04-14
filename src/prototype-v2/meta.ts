import AsyncStorage from '@react-native-async-storage/async-storage';

import { ARENA_BUILD_META, ARENA_BUILD_ORDER } from './builds';
import { ARENA_ENEMY_ORDER } from './config';
import type {
  ArenaBuildId,
  ArenaBuildMastery,
  ArenaBuildValueMap,
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
export const ARENA_META_VERSION = 2;
export const ARENA_BUILD_MASTERY_THRESHOLDS = [0, 100, 220, 360, 520, 700, 900, 1120, 1360, 1620, 1900] as const;

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
  prismBoss: 'Prism Core',
  hiveCarrierBoss: 'Hive Carrier',
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
  prismBoss: 'Phase-driven boss core that mutates its pressure patterns as health breaks.',
  hiveCarrierBoss: 'Rotating boss carrier that mixes escort deployment, shelling, and lane pressure.',
};

export const ARENA_UNLOCK_ORDER: ArenaUnlockId[] = [
  'hiveCarrierFirstClear',
  'enemyCodexComplete',
  'railFocusMastery4',
  'railFocusMastery8',
  'novaBloomMastery4',
  'novaBloomMastery8',
  'missileCommandMastery4',
  'missileCommandMastery8',
  'fractureCoreMastery4',
  'fractureCoreMastery8',
];

const ARENA_UNLOCK_DEFINITIONS: ArenaUnlockValueMap<Omit<ArenaUnlockEntry, 'unlocked' | 'unlockedAt'>> = {
  hiveCarrierFirstClear: {
    id: 'hiveCarrierFirstClear',
    label: 'Hive Carrier Clear',
    description: 'Clear Hive Carrier once.',
    rewardLabel: 'Boss Banner: Hive Trace',
    category: 'boss',
    buildId: null,
    sourceMilestoneId: 'boss:hive-carrier:first-clear',
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
};

const ARENA_BUILD_UNLOCK_ORDER: ArenaBuildValueMap<ArenaUnlockId[]> = {
  railFocus: ['railFocusMastery4', 'railFocusMastery8'],
  novaBloom: ['novaBloomMastery4', 'novaBloomMastery8'],
  missileCommand: ['missileCommandMastery4', 'missileCommandMastery8'],
  fractureCore: ['fractureCoreMastery4', 'fractureCoreMastery8'],
};

function createArenaBuildValueMap<T>(factory: (buildId: ArenaBuildId) => T): ArenaBuildValueMap<T> {
  return ARENA_BUILD_ORDER.reduce((accumulator, buildId) => {
    accumulator[buildId] = factory(buildId);
    return accumulator;
  }, {} as ArenaBuildValueMap<T>);
}

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

function isEnemyCodexComplete(codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>) {
  return ARENA_ENEMY_ORDER.every((kind) => codexEnemies[kind].discovered);
}

function isUnlockSatisfied(
  unlockId: ArenaUnlockId,
  codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>,
  mastery: ArenaBuildValueMap<ArenaBuildMastery>
) {
  switch (unlockId) {
    case 'hiveCarrierFirstClear':
      return codexEnemies.hiveCarrierBoss.bossClears > 0;
    case 'enemyCodexComplete':
      return isEnemyCodexComplete(codexEnemies);
    case 'railFocusMastery4':
      return mastery.railFocus.level >= 4;
    case 'railFocusMastery8':
      return mastery.railFocus.level >= 8;
    case 'novaBloomMastery4':
      return mastery.novaBloom.level >= 4;
    case 'novaBloomMastery8':
      return mastery.novaBloom.level >= 8;
    case 'missileCommandMastery4':
      return mastery.missileCommand.level >= 4;
    case 'missileCommandMastery8':
      return mastery.missileCommand.level >= 8;
    case 'fractureCoreMastery4':
      return mastery.fractureCore.level >= 4;
    case 'fractureCoreMastery8':
      return mastery.fractureCore.level >= 8;
  }
}

function applyArenaUnlockProgress(
  previousUnlocks: ArenaUnlockValueMap<ArenaUnlockEntry>,
  codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>,
  mastery: ArenaBuildValueMap<ArenaBuildMastery>,
  unlockedAt: string
) {
  let didChange = false;
  const nextUnlocks = createArenaUnlockValueMap((unlockId) => {
    const previousEntry = previousUnlocks[unlockId] ?? createUnlockEntry(unlockId);
    const definition = ARENA_UNLOCK_DEFINITIONS[unlockId];
    const shouldUnlock = isUnlockSatisfied(unlockId, codexEnemies, mastery);
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

export function createArenaMetaState(): ArenaMetaState {
  return {
    version: ARENA_META_VERSION,
    lastUpdatedAt: new Date().toISOString(),
    codexEnemies: createArenaEnemyValueMap((kind) => createCodexEnemyEntry(kind)),
    codexBuilds: createArenaBuildValueMap((buildId) => createCodexBuildEntry(buildId)),
    mastery: createArenaBuildValueMap((buildId) => createMasteryEntry(buildId)),
    unlocks: createArenaUnlockValueMap((unlockId) => createUnlockEntry(unlockId)),
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
  const unlockedAt = typeof candidate.lastUpdatedAt === 'string' ? candidate.lastUpdatedAt : defaultState.lastUpdatedAt;
  const unlockProgress = applyArenaUnlockProgress(
    normalizedUnlocks,
    normalizedEnemies,
    normalizedMastery,
    unlockedAt
  );

  return {
    version: ARENA_META_VERSION,
    lastUpdatedAt: unlockedAt,
    codexEnemies: normalizedEnemies,
    codexBuilds: normalizedBuilds,
    mastery: normalizedMastery,
    unlocks: unlockProgress.nextUnlocks,
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
  didChange = didChange || unlockProgress.didChange;

  if (!didChange) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    codexEnemies: nextEnemies,
    unlocks: unlockProgress.nextUnlocks,
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
  const unlockProgress = applyArenaUnlockProgress(previousMetaState.unlocks, nextEnemies, nextMastery, nowIso);
  didChange = didChange || unlockProgress.didChange;

  if (!didChange) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    codexEnemies: nextEnemies,
    mastery: nextMastery,
    unlocks: unlockProgress.nextUnlocks,
    lastUpdatedAt: nowIso,
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
