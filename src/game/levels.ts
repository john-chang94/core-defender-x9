import type {
  EnemyTypeId,
  GameLevelDefinition,
  GameLevelId,
  GameMapId,
  GameMode,
  WaveDefinition,
} from '@/src/game/types';

export const CLASSIC_LEVELS_PER_MAP = 15;
export const CLASSIC_TOTAL_LEVELS = CLASSIC_LEVELS_PER_MAP * 2;
export const CLASSIC_WAVES_PER_LEVEL = 10;

const MAP_ORDER: GameMapId[] = ['relay', 'switchback'];
const MIN_ENDLESS_START_DELAY = 0.55;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function chooseEnemyTypeForClassicWave(
  globalLevelNumber: number,
  waveNumber: number,
  isChallengeWave: boolean
): EnemyTypeId {
  if (isChallengeWave) {
    if (globalLevelNumber >= 20) {
      return 'hex';
    }
    if (globalLevelNumber >= 8) {
      return 'crusher';
    }
    return globalLevelNumber >= 4 ? 'block' : 'spike';
  }

  const pressure = globalLevelNumber + waveNumber;
  if (pressure >= 22) {
    return ['spike', 'block', 'crusher', 'hex'][(globalLevelNumber + waveNumber) % 4] as EnemyTypeId;
  }
  if (pressure >= 14) {
    return ['spark', 'spike', 'block', 'crusher'][(globalLevelNumber + waveNumber) % 4] as EnemyTypeId;
  }
  if (pressure >= 8) {
    return ['spark', 'spike', 'block'][(globalLevelNumber + waveNumber) % 3] as EnemyTypeId;
  }
  return ['spark', 'spike', 'block'][(waveNumber - 1) % 3] as EnemyTypeId;
}

function buildClassicLevelWaves(globalLevelNumber: number): WaveDefinition[] {
  const waves: WaveDefinition[] = [];

  for (let waveNumber = 1; waveNumber <= CLASSIC_WAVES_PER_LEVEL; waveNumber += 1) {
    const isChallengeWave = waveNumber % 10 === 0;
    const enemyType = chooseEnemyTypeForClassicWave(globalLevelNumber, waveNumber, isChallengeWave);
    const wavePressure = 1 + (waveNumber - 1) * 0.15;
    const challengeMultiplier = isChallengeWave ? 1.7 + Math.floor(globalLevelNumber / 10) * 0.2 : 1;

    let count = Math.round((6 + globalLevelNumber * 0.8 + waveNumber * 1.8) * wavePressure * challengeMultiplier);
    let spawnInterval = clamp(
      0.96 - globalLevelNumber * 0.012 - waveNumber * 0.035 - (isChallengeWave ? 0.08 : 0),
      0.2,
      1.05
    );

    if (enemyType === 'crusher') {
      count = Math.max(4, Math.round(count * 0.68));
      spawnInterval = Math.max(0.26, spawnInterval + 0.06);
    } else if (enemyType === 'hex') {
      count = Math.max(3, Math.round(count * 0.5));
      spawnInterval = Math.max(0.3, spawnInterval + 0.12);
    } else if (enemyType === 'block') {
      count = Math.max(5, Math.round(count * 0.82));
      spawnInterval = Math.max(0.24, spawnInterval + 0.05);
    }

    // Milestone levels (10, 20, 30) get a noticeably harder wave 10.
    if (isChallengeWave && globalLevelNumber % 10 === 0) {
      count = Math.round(count * 1.28);
      spawnInterval = Math.max(0.2, spawnInterval - 0.04);
    }

    waves.push({
      enemyType,
      count,
      spawnInterval,
      startDelay:
        waveNumber === 1
          ? 1 + Math.min(0.6, (globalLevelNumber - 1) * 0.02)
          : isChallengeWave
            ? 1.4
            : 0.75,
    });
  }

  return waves;
}

function buildClassicLevels(): GameLevelDefinition[] {
  const levels: GameLevelDefinition[] = [];
  let globalLevelNumber = 1;

  for (const mapId of MAP_ORDER) {
    for (let localLevelNumber = 1; localLevelNumber <= CLASSIC_LEVELS_PER_MAP; localLevelNumber += 1) {
      const isMilestoneLevel = globalLevelNumber % 10 === 0;

      levels.push({
        id: `${mapId}-classic-${localLevelNumber}`,
        label: `Classic ${globalLevelNumber}`,
        mapId,
        waves: buildClassicLevelWaves(globalLevelNumber),
        startingMoney:
          160 +
          Math.round(globalLevelNumber * 7.5) +
          (mapId === 'switchback' ? 8 : 0) +
          (isMilestoneLevel ? 22 : 0),
        startingLives: isMilestoneLevel ? 18 : globalLevelNumber >= 20 ? 19 : 20,
        levelNumber: globalLevelNumber,
        totalLevels: CLASSIC_TOTAL_LEVELS,
        isMilestoneLevel,
      });

      globalLevelNumber += 1;
    }
  }

  return levels;
}

const CLASSIC_LEVELS = buildClassicLevels();
const CLASSIC_LEVELS_BY_ID = new Map<GameLevelId, GameLevelDefinition>(
  CLASSIC_LEVELS.map((level) => [level.id, level])
);

export const DEFAULT_GAME_LEVEL_ID: GameLevelId = CLASSIC_LEVELS[0]?.id ?? 'relay-classic-1';

export function isChallengeWaveNumber(waveNumber: number): boolean {
  return waveNumber > 0 && waveNumber % 10 === 0;
}

export function buildEndlessWaveDefinition(waveIndex: number): WaveDefinition {
  const waveNumber = Math.max(1, waveIndex + 1);
  const isChallengeWave = isChallengeWaveNumber(waveNumber);

  let enemyType: EnemyTypeId;
  if (isChallengeWave) {
    enemyType = waveNumber >= 20 ? 'hex' : waveNumber >= 8 ? 'crusher' : 'block';
  } else if (waveNumber >= 28) {
    const cycle: EnemyTypeId[] = ['crusher', 'spike', 'hex', 'block', 'spark'];
    enemyType = cycle[(waveNumber - 1) % cycle.length];
  } else if (waveNumber >= 16) {
    const cycle: EnemyTypeId[] = ['spike', 'block', 'crusher', 'spark'];
    enemyType = cycle[(waveNumber - 1) % cycle.length];
  } else if (waveNumber >= 8) {
    const cycle: EnemyTypeId[] = ['spark', 'spike', 'block', 'crusher'];
    enemyType = cycle[(waveNumber - 1) % cycle.length];
  } else {
    const cycle: EnemyTypeId[] = ['spark', 'spike', 'block'];
    enemyType = cycle[(waveNumber - 1) % cycle.length];
  }

  const baseCount = 7 + waveNumber * 2.2;
  const countMultiplier = isChallengeWave ? 1.75 : 1;
  let count = Math.round(baseCount * countMultiplier);
  let spawnInterval = clamp(0.92 - waveNumber * 0.013 - (isChallengeWave ? 0.09 : 0), 0.18, 0.95);

  if (enemyType === 'block') {
    count = Math.max(5, Math.round(count * 0.8));
    spawnInterval = Math.max(0.22, spawnInterval + 0.04);
  } else if (enemyType === 'crusher') {
    count = Math.max(4, Math.round(count * 0.62));
    spawnInterval = Math.max(0.24, spawnInterval + 0.08);
  } else if (enemyType === 'hex') {
    count = Math.max(3, Math.round(count * 0.46));
    spawnInterval = Math.max(0.28, spawnInterval + 0.12);
  }

  return {
    enemyType,
    count,
    spawnInterval,
    startDelay: waveNumber === 1 ? 1 : isChallengeWave ? 1.6 : MIN_ENDLESS_START_DELAY,
  };
}

export function loadGameLevel(levelId: GameLevelId): GameLevelDefinition {
  const level = CLASSIC_LEVELS_BY_ID.get(levelId);
  if (!level) {
    throw new Error(`Unknown level id: '${levelId}'`);
  }
  return level;
}

export function listGameLevels(mapId?: GameMapId, mode: GameMode = 'classic'): GameLevelDefinition[] {
  if (mode !== 'classic') {
    return [];
  }

  if (!mapId) {
    return CLASSIC_LEVELS;
  }

  return CLASSIC_LEVELS.filter((level) => level.mapId === mapId);
}

export function getDefaultGameLevelIdForMap(mapId: GameMapId, mode: GameMode = 'classic'): GameLevelId {
  if (mode !== 'classic') {
    const fallback = CLASSIC_LEVELS.find((level) => level.mapId === mapId) ?? CLASSIC_LEVELS[0];
    if (!fallback) {
      throw new Error(`No classic levels configured for map: '${mapId}'`);
    }
    return fallback.id;
  }

  const firstLevel = CLASSIC_LEVELS.find((level) => level.mapId === mapId);
  if (!firstLevel) {
    throw new Error(`No levels configured for map: '${mapId}'`);
  }
  return firstLevel.id;
}
