import type { GameLevelDefinition, GameLevelId, GameMapId } from '@/src/game/types';

const LEVEL_ORDER: GameLevelId[] = [
  'relay-1',
  'relay-2',
  'relay-3',
  'relay-4',
  'switchback-1',
  'switchback-2',
  'switchback-3',
  'switchback-4',
];

const LEVEL_DEFINITIONS: Record<GameLevelId, GameLevelDefinition> = {
  'relay-1': {
    id: 'relay-1',
    label: 'Relay 1',
    mapId: 'relay',
    waves: [
      { enemyType: 'spark', count: 8, spawnInterval: 0.9, startDelay: 1 },
      { enemyType: 'spark', count: 12, spawnInterval: 0.7, startDelay: 0.7 },
      { enemyType: 'block', count: 8, spawnInterval: 0.85, startDelay: 1 },
      { enemyType: 'spike', count: 12, spawnInterval: 0.65, startDelay: 1 },
      { enemyType: 'block', count: 12, spawnInterval: 0.75, startDelay: 1.2 },
      { enemyType: 'spike', count: 16, spawnInterval: 0.55, startDelay: 1.2 },
    ],
  },
  'relay-2': {
    id: 'relay-2',
    label: 'Relay 2',
    mapId: 'relay',
    startingMoney: 170,
    waves: [
      { enemyType: 'spark', count: 12, spawnInterval: 0.78, startDelay: 1 },
      { enemyType: 'spike', count: 12, spawnInterval: 0.64, startDelay: 0.8 },
      { enemyType: 'block', count: 10, spawnInterval: 0.82, startDelay: 1 },
      { enemyType: 'spark', count: 18, spawnInterval: 0.52, startDelay: 0.9 },
      { enemyType: 'block', count: 14, spawnInterval: 0.7, startDelay: 1.1 },
      { enemyType: 'spike', count: 18, spawnInterval: 0.56, startDelay: 1.1 },
      { enemyType: 'block', count: 16, spawnInterval: 0.64, startDelay: 1.2 },
    ],
  },
  'relay-3': {
    id: 'relay-3',
    label: 'Relay 3',
    mapId: 'relay',
    startingMoney: 185,
    waves: [
      { enemyType: 'spark', count: 14, spawnInterval: 0.72, startDelay: 1 },
      { enemyType: 'block', count: 12, spawnInterval: 0.78, startDelay: 0.9 },
      { enemyType: 'spike', count: 18, spawnInterval: 0.56, startDelay: 0.9 },
      { enemyType: 'spark', count: 22, spawnInterval: 0.46, startDelay: 0.9 },
      { enemyType: 'block', count: 18, spawnInterval: 0.62, startDelay: 1.1 },
      { enemyType: 'spike', count: 22, spawnInterval: 0.5, startDelay: 1.1 },
      { enemyType: 'block', count: 22, spawnInterval: 0.56, startDelay: 1.2 },
      { enemyType: 'spike', count: 24, spawnInterval: 0.48, startDelay: 1.2 },
    ],
  },
  'relay-4': {
    id: 'relay-4',
    label: 'Relay 4',
    mapId: 'relay',
    startingMoney: 205,
    startingLives: 18,
    waves: [
      { enemyType: 'spark', count: 18, spawnInterval: 0.62, startDelay: 1 },
      { enemyType: 'spike', count: 18, spawnInterval: 0.52, startDelay: 0.8 },
      { enemyType: 'block', count: 16, spawnInterval: 0.68, startDelay: 0.9 },
      { enemyType: 'spark', count: 24, spawnInterval: 0.44, startDelay: 0.9 },
      { enemyType: 'spike', count: 24, spawnInterval: 0.46, startDelay: 1 },
      { enemyType: 'block', count: 22, spawnInterval: 0.54, startDelay: 1.1 },
      { enemyType: 'spike', count: 28, spawnInterval: 0.44, startDelay: 1.2 },
      { enemyType: 'block', count: 26, spawnInterval: 0.5, startDelay: 1.2 },
      { enemyType: 'spark', count: 30, spawnInterval: 0.4, startDelay: 1.25 },
    ],
  },
  'switchback-1': {
    id: 'switchback-1',
    label: 'Switchback 1',
    mapId: 'switchback',
    waves: [
      { enemyType: 'spark', count: 10, spawnInterval: 0.84, startDelay: 1 },
      { enemyType: 'block', count: 8, spawnInterval: 0.9, startDelay: 0.9 },
      { enemyType: 'spike', count: 12, spawnInterval: 0.68, startDelay: 1 },
      { enemyType: 'spark', count: 16, spawnInterval: 0.56, startDelay: 1 },
      { enemyType: 'block', count: 12, spawnInterval: 0.74, startDelay: 1.1 },
      { enemyType: 'spike', count: 16, spawnInterval: 0.58, startDelay: 1.1 },
    ],
  },
  'switchback-2': {
    id: 'switchback-2',
    label: 'Switchback 2',
    mapId: 'switchback',
    startingMoney: 175,
    waves: [
      { enemyType: 'spark', count: 12, spawnInterval: 0.78, startDelay: 1 },
      { enemyType: 'block', count: 10, spawnInterval: 0.82, startDelay: 0.9 },
      { enemyType: 'spike', count: 16, spawnInterval: 0.62, startDelay: 0.9 },
      { enemyType: 'block', count: 14, spawnInterval: 0.7, startDelay: 1 },
      { enemyType: 'spark', count: 20, spawnInterval: 0.5, startDelay: 1 },
      { enemyType: 'spike', count: 20, spawnInterval: 0.54, startDelay: 1.1 },
      { enemyType: 'block', count: 18, spawnInterval: 0.62, startDelay: 1.2 },
    ],
  },
  'switchback-3': {
    id: 'switchback-3',
    label: 'Switchback 3',
    mapId: 'switchback',
    startingMoney: 190,
    waves: [
      { enemyType: 'spark', count: 14, spawnInterval: 0.72, startDelay: 1 },
      { enemyType: 'spike', count: 18, spawnInterval: 0.56, startDelay: 0.9 },
      { enemyType: 'block', count: 14, spawnInterval: 0.7, startDelay: 1 },
      { enemyType: 'spark', count: 22, spawnInterval: 0.46, startDelay: 0.9 },
      { enemyType: 'block', count: 20, spawnInterval: 0.56, startDelay: 1.1 },
      { enemyType: 'spike', count: 24, spawnInterval: 0.48, startDelay: 1.1 },
      { enemyType: 'block', count: 22, spawnInterval: 0.54, startDelay: 1.2 },
      { enemyType: 'spike', count: 26, spawnInterval: 0.44, startDelay: 1.2 },
    ],
  },
  'switchback-4': {
    id: 'switchback-4',
    label: 'Switchback 4',
    mapId: 'switchback',
    startingMoney: 210,
    startingLives: 18,
    waves: [
      { enemyType: 'spark', count: 16, spawnInterval: 0.66, startDelay: 1 },
      { enemyType: 'block', count: 16, spawnInterval: 0.64, startDelay: 0.9 },
      { enemyType: 'spike', count: 20, spawnInterval: 0.5, startDelay: 0.9 },
      { enemyType: 'spark', count: 24, spawnInterval: 0.42, startDelay: 0.9 },
      { enemyType: 'block', count: 24, spawnInterval: 0.5, startDelay: 1.1 },
      { enemyType: 'spike', count: 28, spawnInterval: 0.42, startDelay: 1.1 },
      { enemyType: 'block', count: 28, spawnInterval: 0.46, startDelay: 1.2 },
      { enemyType: 'spike', count: 30, spawnInterval: 0.4, startDelay: 1.2 },
      { enemyType: 'spark', count: 34, spawnInterval: 0.36, startDelay: 1.25 },
    ],
  },
};

export const DEFAULT_GAME_LEVEL_ID: GameLevelId = 'relay-1';

export function loadGameLevel(levelId: GameLevelId): GameLevelDefinition {
  const level = LEVEL_DEFINITIONS[levelId];
  if (!level) {
    throw new Error(`Unknown level id: '${levelId}'`);
  }
  return level;
}

export function listGameLevels(mapId?: GameMapId): GameLevelDefinition[] {
  const levels = LEVEL_ORDER.map((levelId) => LEVEL_DEFINITIONS[levelId]);
  if (!mapId) {
    return levels;
  }
  return levels.filter((level) => level.mapId === mapId);
}

export function getDefaultGameLevelIdForMap(mapId: GameMapId): GameLevelId {
  const firstLevel = listGameLevels(mapId)[0];
  if (!firstLevel) {
    throw new Error(`No levels configured for map: '${mapId}'`);
  }
  return firstLevel.id;
}
