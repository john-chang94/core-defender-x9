import { buildPolylineData, expandPathCells, toCellKey, type PolylineData } from '@/src/game/path';
import type { GameMapDefinition, GameMapId } from '@/src/game/types';

export type LoadedGameMap = GameMapDefinition & {
  pathCells: ReturnType<typeof expandPathCells>;
  pathCellKeys: ReadonlySet<string>;
  route: PolylineData;
};

const MAP_DEFINITIONS: Record<GameMapId, GameMapDefinition> = {
  relay: {
    id: 'relay',
    label: 'Relay Corridor',
    cols: 12,
    rows: 8,
    pathWaypoints: [
      { col: 0, row: 4 },
      { col: 3, row: 4 },
      { col: 3, row: 1 },
      { col: 8, row: 1 },
      { col: 8, row: 6 },
      { col: 11, row: 6 },
    ],
    initialTowers: [{ towerType: 'pulse', cell: { col: 2, row: 6 } }],
  },
  switchback: {
    id: 'switchback',
    label: 'Switchback Junction',
    cols: 12,
    rows: 8,
    pathWaypoints: [
      { col: 0, row: 1 },
      { col: 4, row: 1 },
      { col: 4, row: 5 },
      { col: 1, row: 5 },
      { col: 1, row: 7 },
      { col: 10, row: 7 },
      { col: 10, row: 2 },
      { col: 11, row: 2 },
    ],
    initialTowers: [{ towerType: 'pulse', cell: { col: 2, row: 3 } }],
  },
};

export const DEFAULT_GAME_MAP_ID: GameMapId = 'relay';

const LOADED_MAP_CACHE = new Map<GameMapId, LoadedGameMap>();

function ensureMapCellsInBounds(map: GameMapDefinition): void {
  for (const waypoint of map.pathWaypoints) {
    const inBounds = waypoint.col >= 0 && waypoint.col < map.cols && waypoint.row >= 0 && waypoint.row < map.rows;
    if (!inBounds) {
      throw new Error(`Map '${map.id}' has waypoint out of bounds: ${waypoint.col},${waypoint.row}`);
    }
  }

  for (const tower of map.initialTowers) {
    const inBounds =
      tower.cell.col >= 0 && tower.cell.col < map.cols && tower.cell.row >= 0 && tower.cell.row < map.rows;
    if (!inBounds) {
      throw new Error(`Map '${map.id}' has initial tower out of bounds: ${tower.cell.col},${tower.cell.row}`);
    }
  }
}

function loadMap(mapId: GameMapId): LoadedGameMap {
  const cachedMap = LOADED_MAP_CACHE.get(mapId);
  if (cachedMap) {
    return cachedMap;
  }

  const definition = MAP_DEFINITIONS[mapId];
  if (!definition) {
    throw new Error(`Unknown map id: '${mapId}'`);
  }

  ensureMapCellsInBounds(definition);

  const pathCells = expandPathCells(definition.pathWaypoints);
  const pathCellKeys = new Set(pathCells.map(toCellKey));
  const route = buildPolylineData(definition.pathWaypoints);

  const loadedMap: LoadedGameMap = {
    ...definition,
    pathCells,
    pathCellKeys,
    route,
  };

  LOADED_MAP_CACHE.set(mapId, loadedMap);
  return loadedMap;
}

export function loadGameMap(mapId: GameMapId): LoadedGameMap {
  return loadMap(mapId);
}

export function listGameMaps(): LoadedGameMap[] {
  return (Object.keys(MAP_DEFINITIONS) as GameMapId[]).map(loadMap);
}
