import { useMemo } from 'react';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';

import { TOWER_TYPES } from '@/src/game/config';
import { getTowerStats } from '@/src/game/engine';
import type { LoadedGameMap } from '@/src/game/maps';
import { cellCenter } from '@/src/game/path';
import type { GameState, TowerTypeId } from '@/src/game/types';

type BoardCanvasProps = {
  boardWidth: number;
  boardHeight: number;
  cellSize: number;
  map: LoadedGameMap;
  state: GameState;
  selectedTowerId: string | null;
};

const alphaColorCache = new Map<string, string>();
const MAX_RENDERED_PROJECTILES = 130;
const MAX_RENDERED_EFFECTS = 70;

function withAlpha(color: string, alpha: number): string {
  const boundedAlpha = Math.max(0, Math.min(1, alpha));
  const roundedAlpha = Math.round(boundedAlpha * 1000) / 1000;
  const cacheKey = `${color}|${roundedAlpha}`;
  const cachedColor = alphaColorCache.get(cacheKey);
  if (cachedColor) {
    return cachedColor;
  }

  const hex = color.startsWith('#') ? color.slice(1) : null;
  if (!hex) {
    return color;
  }

  const expandedHex =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex.length === 4
        ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;

  if (expandedHex.length !== 6 && expandedHex.length !== 8) {
    return color;
  }

  const rgbHex = expandedHex.slice(0, 6);
  const red = Number.parseInt(rgbHex.slice(0, 2), 16);
  const green = Number.parseInt(rgbHex.slice(2, 4), 16);
  const blue = Number.parseInt(rgbHex.slice(4, 6), 16);

  const rgba = `rgba(${red}, ${green}, ${blue}, ${roundedAlpha})`;
  alphaColorCache.set(cacheKey, rgba);
  return rgba;
}

function createTrianglePath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
) {
  const path = Skia.Path.Make();
  path.moveTo(ax, ay);
  path.lineTo(bx, by);
  path.lineTo(cx, cy);
  path.close();
  return path;
}

function sampleForRender<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) {
    return items;
  }

  const step = Math.ceil(items.length / maxItems);
  const sampled: T[] = [];
  for (let index = 0; index < items.length; index += step) {
    sampled.push(items[index]);
  }
  return sampled;
}

function TowerGlyphSkia({
  towerType,
  color,
  size,
  cx,
  cy,
  aimAngle,
}: {
  towerType: TowerTypeId;
  color: string;
  size: number;
  cx: number;
  cy: number;
  aimAngle: number;
}) {
  const barrelColor = '#DCEBFF';
  const localRotation = aimAngle + Math.PI / 2;
  const lancePath = useMemo(
    () =>
      createTrianglePath(
        cx,
        cy - size * 0.42,
        cx - size * 0.21,
        cy + size * 0.28,
        cx + size * 0.21,
        cy + size * 0.28
      ),
    [cx, cy, size]
  );

  if (towerType === 'lance') {
    const tailWidth = size * 0.2;
    const tailHeight = size * 0.42;
    const tailX = cx - tailWidth / 2;
    const tailY = cy + size * 0.08;

    return (
      <Group origin={vec(cx, cy)} transform={[{ rotate: localRotation }]}>
        <RoundedRect
          x={tailX}
          y={tailY}
          width={tailWidth}
          height={tailHeight}
          r={size * 0.08}
          color="#BFD3F4"
        />
        <RoundedRect
          x={tailX}
          y={tailY}
          width={tailWidth}
          height={tailHeight}
          r={size * 0.08}
          style="stroke"
          strokeWidth={1}
          color="#0E1D2F"
        />
        <Path path={lancePath} color={color} />
        <Path path={lancePath} style="stroke" strokeWidth={1} color="#101827" />
      </Group>
    );
  }

  if (towerType === 'spray') {
    const bodyWidth = size * 0.62;
    const bodyHeight = size * 0.58;
    const bodyX = cx - bodyWidth / 2;
    const bodyY = cy - bodyHeight / 2;
    const barrelWidth = size * 0.2;
    const barrelHeight = size * 0.32;
    const barrelX = cx - barrelWidth / 2;
    const barrelY = cy - size * 0.47;

    return (
      <Group origin={vec(cx, cy)} transform={[{ rotate: localRotation }]}>
        <RoundedRect
          x={bodyX}
          y={bodyY}
          width={bodyWidth}
          height={bodyHeight}
          r={size * 0.14}
          color={color}
        />
        <RoundedRect
          x={bodyX}
          y={bodyY}
          width={bodyWidth}
          height={bodyHeight}
          r={size * 0.14}
          style="stroke"
          strokeWidth={1}
          color="#101827"
        />
        <RoundedRect
          x={barrelX}
          y={barrelY}
          width={barrelWidth}
          height={barrelHeight}
          r={size * 0.1}
          color={barrelColor}
        />
        <RoundedRect
          x={barrelX}
          y={barrelY}
          width={barrelWidth}
          height={barrelHeight}
          r={size * 0.1}
          style="stroke"
          strokeWidth={1}
          color="#0F1E31"
        />
      </Group>
    );
  }

  const bodyRadius = size * 0.44;
  const innerRadius = size * 0.19;
  const barrelWidth = size * 0.2;
  const barrelHeight = size * 0.32;

  return (
    <Group origin={vec(cx, cy)} transform={[{ rotate: localRotation }]}>
      <Circle cx={cx} cy={cy} r={bodyRadius} color={color} />
      <Circle cx={cx} cy={cy} r={bodyRadius} style="stroke" strokeWidth={1} color="#101827" />
      <Circle
        cx={cx}
        cy={cy}
        r={innerRadius}
        style="stroke"
        strokeWidth={1.5}
        color="rgba(10, 26, 42, 0.45)"
      />
      <RoundedRect
        x={cx - barrelWidth / 2}
        y={cy - size * 0.47}
        width={barrelWidth}
        height={barrelHeight}
        r={size * 0.1}
        color={barrelColor}
      />
      <RoundedRect
        x={cx - barrelWidth / 2}
        y={cy - size * 0.47}
        width={barrelWidth}
        height={barrelHeight}
        r={size * 0.1}
        style="stroke"
        strokeWidth={1}
        color="#0F1E31"
      />
    </Group>
  );
}

export function BoardCanvas({
  boardWidth,
  boardHeight,
  cellSize,
  map,
  state,
  selectedTowerId,
}: BoardCanvasProps) {
  const verticalGridLines = useMemo(
    () => Array.from({ length: map.cols + 1 }, (_, col) => col * cellSize),
    [map.cols, cellSize]
  );
  const horizontalGridLines = useMemo(
    () => Array.from({ length: map.rows + 1 }, (_, row) => row * cellSize),
    [map.rows, cellSize]
  );
  const sampledEffects = useMemo(
    () => sampleForRender(state.effects, MAX_RENDERED_EFFECTS),
    [state.effects]
  );
  const sampledProjectiles = useMemo(
    () => sampleForRender(state.projectiles, MAX_RENDERED_PROJECTILES),
    [state.projectiles]
  );
  const renderLoad = state.enemies.length + state.projectiles.length + state.effects.length;
  const useReducedDetail = renderLoad > 95;
  const hideHealthBars = state.enemies.length > 52;
  const gridLayer = useMemo(
    () => (
      <>
        {verticalGridLines.map((x, index) => (
          <Line
            key={`grid-v-${index}`}
            p1={vec(x, 0)}
            p2={vec(x, boardHeight)}
            color="#172339"
            strokeWidth={0.5}
          />
        ))}
        {horizontalGridLines.map((y, index) => (
          <Line
            key={`grid-h-${index}`}
            p1={vec(0, y)}
            p2={vec(boardWidth, y)}
            color="#172339"
            strokeWidth={0.5}
          />
        ))}
      </>
    ),
    [boardHeight, boardWidth, horizontalGridLines, verticalGridLines]
  );
  const pathLayer = useMemo(
    () => (
      <>
        {map.pathCells.map((cell) => (
          <Group key={`path-${cell.col}-${cell.row}`}>
            <Rect
              x={cell.col * cellSize}
              y={cell.row * cellSize}
              width={cellSize}
              height={cellSize}
              color="#1E324E"
            />
            <Rect
              x={cell.col * cellSize}
              y={cell.row * cellSize}
              width={cellSize}
              height={cellSize}
              style="stroke"
              strokeWidth={0.5}
              color="#2A4B75"
            />
          </Group>
        ))}
      </>
    ),
    [cellSize, map.pathCells]
  );

  return (
    <Canvas style={{ width: boardWidth, height: boardHeight }}>
      {gridLayer}
      {pathLayer}

      {sampledEffects.map((effect) => {
        const progress = Math.min(1, effect.age / effect.duration);
        const radius = (effect.startRadius + (effect.endRadius - effect.startRadius) * progress) * cellSize;
        const opacity = 1 - progress;
        const fillBaseAlpha = effect.kind === 'hit' ? 0.26 : 0.13;
        return (
          <Group key={effect.id}>
            <Circle
              cx={effect.position.x * cellSize}
              cy={effect.position.y * cellSize}
              r={radius}
              color={withAlpha(effect.color, fillBaseAlpha * opacity)}
            />
            {!useReducedDetail ? (
              <Circle
                cx={effect.position.x * cellSize}
                cy={effect.position.y * cellSize}
                r={radius}
                style="stroke"
                strokeWidth={1.5}
                color={withAlpha(effect.color, 0.9 * opacity)}
              />
            ) : null}
          </Group>
        );
      })}

      {state.towers.map((tower) => {
        const towerType = TOWER_TYPES[tower.towerType];
        const towerStats = getTowerStats(tower);
        const levelScale = 1 + Math.max(0, tower.level - 1) * 0.08;
        const radius = towerType.radius * cellSize * levelScale;
        const center = cellCenter(tower.cell);
        const cx = center.x * cellSize;
        const cy = center.y * cellSize;
        const isActive = tower.id === selectedTowerId;
        const aimAngle = Number.isFinite(tower.aimAngle) ? tower.aimAngle : -Math.PI / 2;

        return (
          <Group key={tower.id}>
            {isActive ? (
              <Group>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={towerStats.range * cellSize}
                  color={withAlpha(towerType.color, 0.13)}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={towerStats.range * cellSize}
                  style="stroke"
                  strokeWidth={1.5}
                  color={towerType.color}
                />
              </Group>
            ) : null}

            <Circle cx={cx} cy={cy} r={radius} color={withAlpha('#0B1320', 0.5)} />
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              style="stroke"
              strokeWidth={2}
              color={isActive ? '#E7F28D' : '#0B101B'}
            />

            <TowerGlyphSkia
              towerType={tower.towerType}
              color={towerType.color}
              size={radius * 2}
              cx={cx}
              cy={cy}
              aimAngle={aimAngle}
            />
          </Group>
        );
      })}

      {state.beams.map((beam) => (
        <Line
          key={beam.id}
          p1={vec(beam.start.x * cellSize, beam.start.y * cellSize)}
          p2={vec(beam.end.x * cellSize, beam.end.y * cellSize)}
          color={withAlpha(beam.color, 0.85)}
          strokeWidth={Math.max(2, beam.width * cellSize)}
          strokeCap="round"
        />
      ))}

      {sampledProjectiles.map((projectile) => (
        <Circle
          key={projectile.id}
          cx={projectile.position.x * cellSize}
          cy={projectile.position.y * cellSize}
          r={projectile.radius * cellSize}
          color={projectile.color}
        />
      ))}

      {state.enemies.map((enemy) => {
        const size = enemy.radius * 2 * cellSize;
        const cx = enemy.position.x * cellSize;
        const cy = enemy.position.y * cellSize;
        const left = cx - size / 2;
        const top = cy - size / 2;
        const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
        const isSlowed = enemy.slowTimeRemaining > 0 && enemy.slowMultiplier < 1;

        const trianglePath =
          enemy.shape === 'triangle'
            ? createTrianglePath(cx, top, left, top + size, left + size, top + size)
            : null;

        return (
          <Group key={enemy.id}>
            {!hideHealthBars ? (
              <>
                <Rect x={left} y={top - 7} width={size} height={4} color="#1D2B43" />
                <Rect x={left} y={top - 7} width={size * healthPercent} height={4} color="#5EF69A" />
              </>
            ) : null}

            {isSlowed ? (
              <Group>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={(size * 1.24) / 2}
                  color={withAlpha('#6FDFFF', Math.min(0.26, 1 - enemy.slowMultiplier))}
                />
                {!useReducedDetail ? (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={(size * 1.24) / 2}
                    style="stroke"
                    strokeWidth={2}
                    color={withAlpha('#8FE8FF', Math.min(0.72, 1 - enemy.slowMultiplier))}
                  />
                ) : null}
              </Group>
            ) : null}

            {enemy.shape === 'circle' ? (
              <Group>
                <Circle cx={cx} cy={cy} r={size / 2} color={enemy.color} />
                {!useReducedDetail ? (
                  <Circle cx={cx} cy={cy} r={size / 2} style="stroke" strokeWidth={1} color="#101827" />
                ) : null}
              </Group>
            ) : null}

            {enemy.shape === 'square' ? (
              <Group>
                <Rect x={left} y={top} width={size} height={size} color={enemy.color} />
                {!useReducedDetail ? (
                  <Rect
                    x={left}
                    y={top}
                    width={size}
                    height={size}
                    style="stroke"
                    strokeWidth={1}
                    color="#101827"
                  />
                ) : null}
              </Group>
            ) : null}

            {enemy.shape === 'triangle' && trianglePath ? (
              <Group>
                <Path path={trianglePath} color={enemy.color} />
                {!useReducedDetail ? (
                  <Path path={trianglePath} style="stroke" strokeWidth={1} color="#101827" />
                ) : null}
              </Group>
            ) : null}
          </Group>
        );
      })}
    </Canvas>
  );
}
