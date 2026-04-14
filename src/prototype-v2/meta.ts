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
} from './types';

export const ARENA_META_STORAGE_KEY = 'arena-v2-meta-v1';
export const ARENA_META_VERSION = 1;
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
  prismBoss: 'Prism Core',
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
  prismBoss: 'Phase-driven boss core that mutates its pressure patterns as health breaks.',
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

export function createArenaMetaState(): ArenaMetaState {
  return {
    version: ARENA_META_VERSION,
    lastUpdatedAt: new Date().toISOString(),
    codexEnemies: createArenaEnemyValueMap((kind) => createCodexEnemyEntry(kind)),
    codexBuilds: createArenaBuildValueMap((buildId) => createCodexBuildEntry(buildId)),
    mastery: createArenaBuildValueMap((buildId) => createMasteryEntry(buildId)),
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

  return {
    version: ARENA_META_VERSION,
    lastUpdatedAt:
      typeof candidate.lastUpdatedAt === 'string' ? candidate.lastUpdatedAt : defaultState.lastUpdatedAt,
    codexEnemies: normalizedEnemies,
    codexBuilds: normalizedBuilds,
    mastery: normalizedMastery,
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

  if (!didChange) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    codexEnemies: nextEnemies,
    lastUpdatedAt: new Date().toISOString(),
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
    const bossClears = kind === 'prismBoss' ? runSummary.bossClears : previousEntry.bossClears;

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

  if (!didChange) {
    return previousMetaState;
  }

  return {
    ...previousMetaState,
    codexEnemies: nextEnemies,
    mastery: nextMastery,
    lastUpdatedAt: new Date().toISOString(),
  };
}
