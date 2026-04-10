import { useEffect, useMemo, useState } from 'react';
import {
  Canvas,
  Circle,
  Group,
  Image,
  Line,
  Path,
  Rect,
  RoundedRect,
  Skia,
  drawAsImage,
  type SkImage,
  vec,
} from '@shopify/react-native-skia';

import {
  ARENA_ENEMY_ZONE_RATIO,
  ARENA_TIER_DURATION_SECONDS,
} from './config';
import type { ArenaEnemy, ArenaGameState } from './types';

type ArenaCanvasProps = {
  boardWidth: number;
  boardHeight: number;
  state: ArenaGameState;
};

const MAX_RENDERED_EFFECTS = 48;
const MAX_RENDERED_PLAYER_BULLETS = 96;
const MAX_RENDERED_ENEMY_BULLETS = 54;

const BACKGROUND_PLATES = [
  { x: 0.08, y: -30, width: 96, height: 152, radius: 18, speed: 18, color: '#132236', stroke: '#203754' },
  { x: 0.74, y: 54, width: 110, height: 180, radius: 20, speed: 26, color: '#102035', stroke: '#25415E' },
  { x: 0.42, y: 160, width: 84, height: 128, radius: 16, speed: 22, color: '#0E1C30', stroke: '#1F3550' },
  { x: 0.16, y: 300, width: 120, height: 168, radius: 20, speed: 28, color: '#12243A', stroke: '#274666' },
  { x: 0.68, y: 420, width: 92, height: 132, radius: 18, speed: 20, color: '#0E1D31', stroke: '#23415D' },
  { x: 0.5, y: 560, width: 124, height: 164, radius: 22, speed: 24, color: '#122439', stroke: '#284B6D' },
] as const;

const FLOW_STREAKS = [
  { x: 0.11, length: 94, speed: 180, width: 2 },
  { x: 0.19, length: 72, speed: 220, width: 1.5 },
  { x: 0.28, length: 110, speed: 200, width: 2 },
  { x: 0.41, length: 80, speed: 168, width: 1.5 },
  { x: 0.58, length: 96, speed: 214, width: 2 },
  { x: 0.74, length: 84, speed: 194, width: 1.5 },
  { x: 0.86, length: 120, speed: 206, width: 2 },
];

type ArenaTheme = {
  base: string;
  auraA: string;
  auraB: string;
  enemyZone: string;
  boundary: string;
  grid: string;
  overlay: string;
  flow: string;
  pulse: string;
};

const ARENA_THEMES: readonly ArenaTheme[] = [
  {
    base: '#08131E',
    auraA: 'rgba(255, 112, 176, 0.08)',
    auraB: 'rgba(102, 234, 255, 0.06)',
    enemyZone: 'rgba(255, 121, 183, 0.045)',
    boundary: 'rgba(255, 184, 112, 0.28)',
    grid: 'rgba(122, 149, 184, 0.12)',
    overlay: '#12253A',
    flow: '#91CDFF',
    pulse: '#FF9CC5',
  },
  {
    base: '#091521',
    auraA: 'rgba(120, 169, 255, 0.08)',
    auraB: 'rgba(142, 255, 218, 0.06)',
    enemyZone: 'rgba(112, 199, 255, 0.05)',
    boundary: 'rgba(148, 213, 255, 0.3)',
    grid: 'rgba(114, 154, 198, 0.12)',
    overlay: '#1A2F4D',
    flow: '#87E4FF',
    pulse: '#8BCBFF',
  },
  {
    base: '#101022',
    auraA: 'rgba(255, 149, 102, 0.08)',
    auraB: 'rgba(255, 217, 133, 0.05)',
    enemyZone: 'rgba(255, 169, 107, 0.05)',
    boundary: 'rgba(255, 209, 139, 0.3)',
    grid: 'rgba(156, 141, 188, 0.11)',
    overlay: '#2C2141',
    flow: '#FFD9A3',
    pulse: '#FFB589',
  },
];

function withAlpha(color: string, alpha: number) {
  const normalizedHex = color.startsWith('#') ? color.slice(1) : color;
  if (normalizedHex.length !== 6) {
    return color;
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
}

function sampleForRender<T>(items: T[], maxItems: number) {
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

function getProjectileBasis(vx: number, vy: number) {
  const speed = Math.max(1, Math.hypot(vx, vy));
  const forwardX = vx / speed;
  const forwardY = vy / speed;
  const rightX = -forwardY;
  const rightY = forwardX;
  return { forwardX, forwardY, rightX, rightY };
}

function createOrientedDiamondPath(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  rightX: number,
  rightY: number,
  length: number,
  halfWidth: number
) {
  const path = Skia.Path.Make();
  path.moveTo(x + forwardX * length, y + forwardY * length);
  path.lineTo(x + rightX * halfWidth, y + rightY * halfWidth);
  path.lineTo(x - forwardX * length * 0.95, y - forwardY * length * 0.95);
  path.lineTo(x - rightX * halfWidth, y - rightY * halfWidth);
  path.close();
  return path;
}

function createOrientedShardPath(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  rightX: number,
  rightY: number,
  length: number,
  halfWidth: number
) {
  const tailX = x - forwardX * (length * 0.75);
  const tailY = y - forwardY * (length * 0.75);
  const path = Skia.Path.Make();
  path.moveTo(x + forwardX * length, y + forwardY * length);
  path.lineTo(tailX + rightX * halfWidth, tailY + rightY * halfWidth);
  path.lineTo(tailX - rightX * halfWidth, tailY - rightY * halfWidth);
  path.close();
  return path;
}

function createMissileBodyPath(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  rightX: number,
  rightY: number,
  size: number
) {
  const tipLength = size * 1.62;
  const bodyHalfWidth = size * 0.42;
  const shoulderDistance = size * 0.66;
  const tailDistance = size * 0.96;
  const finDistance = size * 0.24;
  const finWidth = size * 0.72;

  const tipX = x + forwardX * tipLength;
  const tipY = y + forwardY * tipLength;
  const shoulderX = x + forwardX * shoulderDistance;
  const shoulderY = y + forwardY * shoulderDistance;
  const tailX = x - forwardX * tailDistance;
  const tailY = y - forwardY * tailDistance;
  const finX = x - forwardX * finDistance;
  const finY = y - forwardY * finDistance;

  const bodyPath = Skia.Path.Make();
  bodyPath.moveTo(tipX, tipY);
  bodyPath.lineTo(shoulderX + rightX * bodyHalfWidth, shoulderY + rightY * bodyHalfWidth);
  bodyPath.lineTo(finX + rightX * finWidth, finY + rightY * finWidth);
  bodyPath.lineTo(tailX + rightX * bodyHalfWidth * 0.52, tailY + rightY * bodyHalfWidth * 0.52);
  bodyPath.lineTo(tailX - rightX * bodyHalfWidth * 0.52, tailY - rightY * bodyHalfWidth * 0.52);
  bodyPath.lineTo(finX - rightX * finWidth, finY - rightY * finWidth);
  bodyPath.lineTo(shoulderX - rightX * bodyHalfWidth, shoulderY - rightY * bodyHalfWidth);
  bodyPath.close();

  return bodyPath;
}

function createNovaSweepPath(centerX: number, boardWidth: number, boardHeight: number) {
  const nearY = boardHeight - 18;
  const farY = boardHeight * 0.02;
  const nearHalf = Math.min(36, boardWidth * 0.11);
  const farHalf = Math.max(boardWidth * 0.3, nearHalf + 40);
  const path = Skia.Path.Make();
  path.moveTo(centerX - nearHalf, nearY);
  path.lineTo(centerX + nearHalf, nearY);
  path.lineTo(centerX + farHalf, farY);
  path.lineTo(centerX - farHalf, farY);
  path.close();
  return path;
}

function createEnemyPath(kind: ArenaEnemy['kind'], x: number, y: number, size: number) {
  const halfSize = size / 2;
  const path = Skia.Path.Make();

  if (kind === 'hover' || kind === 'orbiter') {
    path.addCircle(x, y, halfSize);
    return path;
  }

  if (kind === 'burst' || kind === 'interceptor' || kind === 'prismBoss') {
    path.moveTo(x, y - halfSize);
    path.lineTo(x + halfSize, y);
    path.lineTo(x, y + halfSize);
    path.lineTo(x - halfSize, y);
    path.close();
    return path;
  }

  if (kind === 'bomber') {
    path.moveTo(x - halfSize * 0.9, y - halfSize * 0.38);
    path.lineTo(x - halfSize * 0.42, y - halfSize);
    path.lineTo(x + halfSize * 0.42, y - halfSize);
    path.lineTo(x + halfSize * 0.9, y - halfSize * 0.38);
    path.lineTo(x + halfSize * 0.9, y + halfSize * 0.38);
    path.lineTo(x + halfSize * 0.42, y + halfSize);
    path.lineTo(x - halfSize * 0.42, y + halfSize);
    path.lineTo(x - halfSize * 0.9, y + halfSize * 0.38);
    path.close();
    return path;
  }

  path.addRRect(Skia.RRectXY(Skia.XYWHRect(x - halfSize, y - halfSize, size, size), 12, 12));
  return path;
}

function createEnemyWingPath(enemy: ArenaEnemy, side: -1 | 1) {
  const forwardX = Math.sin(enemy.aimAngle);
  const forwardY = Math.cos(enemy.aimAngle);
  const rightX = forwardY;
  const rightY = -forwardX;
  const size = enemy.size;
  const innerOffset = size * 0.18;
  const outerOffset = size * 0.46;
  const forwardOffset = size * 0.05;
  const backOffset = size * 0.28;

  const rootX = enemy.x - forwardX * size * 0.03 + rightX * side * innerOffset;
  const rootY = enemy.y - forwardY * size * 0.03 + rightY * side * innerOffset;
  const outerFrontX = enemy.x + forwardX * forwardOffset + rightX * side * outerOffset;
  const outerFrontY = enemy.y + forwardY * forwardOffset + rightY * side * outerOffset;
  const outerBackX = enemy.x - forwardX * backOffset + rightX * side * (outerOffset * 0.9);
  const outerBackY = enemy.y - forwardY * backOffset + rightY * side * (outerOffset * 0.9);
  const tailX = enemy.x - forwardX * (backOffset + size * 0.08) + rightX * side * (innerOffset * 0.75);
  const tailY = enemy.y - forwardY * (backOffset + size * 0.08) + rightY * side * (innerOffset * 0.75);

  const wingPath = Skia.Path.Make();
  wingPath.moveTo(rootX, rootY);
  wingPath.lineTo(outerFrontX, outerFrontY);
  wingPath.lineTo(outerBackX, outerBackY);
  wingPath.lineTo(tailX, tailY);
  wingPath.close();
  return wingPath;
}

function createEnemyTipPath(enemy: ArenaEnemy) {
  const forwardX = Math.sin(enemy.aimAngle);
  const forwardY = Math.cos(enemy.aimAngle);
  const rightX = forwardY;
  const rightY = -forwardX;
  const tipDistance = enemy.size * 0.62;
  const baseDistance = enemy.size * 0.3;
  const tipHalf = enemy.size * 0.12;
  const tipX = enemy.x + forwardX * tipDistance;
  const tipY = enemy.y + forwardY * tipDistance;
  const baseX = enemy.x + forwardX * baseDistance;
  const baseY = enemy.y + forwardY * baseDistance;

  const tipPath = Skia.Path.Make();
  tipPath.moveTo(tipX, tipY);
  tipPath.lineTo(baseX + rightX * tipHalf, baseY + rightY * tipHalf);
  tipPath.lineTo(baseX - rightX * tipHalf, baseY - rightY * tipHalf);
  tipPath.close();
  return tipPath;
}

function renderEnemyShipDetails(enemy: ArenaEnemy) {
  const tipPath = createEnemyTipPath(enemy);
  const leftWingPath = createEnemyWingPath(enemy, -1);
  const rightWingPath = createEnemyWingPath(enemy, 1);
  const forwardX = Math.sin(enemy.aimAngle);
  const forwardY = Math.cos(enemy.aimAngle);
  const muzzleX = enemy.x + forwardX * (enemy.size * 0.64);
  const muzzleY = enemy.y + forwardY * (enemy.size * 0.64);

  return (
    <>
      <Path path={leftWingPath} color={withAlpha(enemy.color, 0.26)} />
      <Path path={rightWingPath} color={withAlpha(enemy.color, 0.26)} />
      <Path path={leftWingPath} style="stroke" strokeWidth={1.15} color={withAlpha('#EAF7FF', 0.52)} />
      <Path path={rightWingPath} style="stroke" strokeWidth={1.15} color={withAlpha('#EAF7FF', 0.52)} />
      <Path path={tipPath} color={withAlpha('#FFE7C8', 0.95)} />
      <Path path={tipPath} style="stroke" strokeWidth={1.1} color={withAlpha('#FFFFFF', 0.82)} />
      <Circle cx={muzzleX} cy={muzzleY} r={enemy.size * 0.06} color={withAlpha('#FFF5DD', 0.9)} />
    </>
  );
}

function createStaticBackgroundScene({
  boardWidth,
  boardHeight,
  verticalGridLines,
  horizontalGridLines,
  theme,
}: {
  boardWidth: number;
  boardHeight: number;
  verticalGridLines: number[];
  horizontalGridLines: number[];
  theme: ArenaTheme;
}) {
  const enemyZoneHeight = boardHeight * ARENA_ENEMY_ZONE_RATIO;

  return (
    <Group>
      <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={theme.base} />
      <Circle cx={boardWidth * 0.18} cy={boardHeight * 0.1} r={boardWidth * 0.28} color={theme.auraA} />
      <Circle cx={boardWidth * 0.86} cy={boardHeight * 0.86} r={boardWidth * 0.32} color={theme.auraB} />
      <Rect x={0} y={0} width={boardWidth} height={enemyZoneHeight} color={theme.enemyZone} />
      <RoundedRect
        x={14}
        y={enemyZoneHeight}
        width={Math.max(0, boardWidth - 28)}
        height={2}
        r={999}
        color={theme.boundary}
      />
      {verticalGridLines.map((x, index) => (
        <Line
          key={`arena-bg-v-${index}`}
          p1={vec(x, 0)}
          p2={vec(x, boardHeight)}
          color={theme.grid}
          strokeWidth={1}
        />
      ))}
      {horizontalGridLines.map((y, index) => (
        <Line
          key={`arena-bg-h-${index}`}
          p1={vec(0, y)}
          p2={vec(boardWidth, y)}
          color={theme.grid}
          strokeWidth={1}
        />
      ))}
    </Group>
  );
}

function renderEnemyCore(enemy: ArenaEnemy) {
  const enemyPath = createEnemyPath(enemy.kind, enemy.x, enemy.y, enemy.size);
  const isElite = enemy.kind === 'interceptor';
  const isBoss = enemy.kind === 'prismBoss';
  const auraColor = isBoss ? '#FF89C0' : isElite ? '#CBBFFF' : enemy.color;

  return (
    <Group key={`enemy-${enemy.id}`}>
      {isElite || isBoss ? (
        <Circle
          cx={enemy.x}
          cy={enemy.y}
          r={enemy.size * (isBoss ? 0.82 : 0.68)}
          color={withAlpha(auraColor, isBoss ? 0.12 : 0.08)}
        />
      ) : null}
      <PathOrFallback path={enemyPath} fillColor={enemy.color} strokeColor={enemy.windupTimer > 0 ? '#FFF0C7' : isBoss ? '#FFE8BE' : isElite ? '#E5DDFF' : '#0D1726'} strokeWidth={isBoss ? 2.4 : isElite ? 1.8 : 1.4} />
      {renderEnemyShipDetails(enemy)}
      <Circle cx={enemy.x} cy={enemy.y} r={enemy.size * 0.12} color={withAlpha('#FFFFFF', 0.32)} />
    </Group>
  );
}

function PathOrFallback({
  path,
  fillColor,
  strokeColor,
  strokeWidth,
}: {
  path: ReturnType<typeof Skia.Path.Make>;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}) {
  return (
    <>
      <Path path={path} color={fillColor} />
      <Path path={path} style="stroke" strokeWidth={strokeWidth} color={strokeColor} />
    </>
  );
}

export function ArenaCanvas({ boardWidth, boardHeight, state }: ArenaCanvasProps) {
  const displayTier = Math.floor(state.elapsed / ARENA_TIER_DURATION_SECONDS) + 1;
  const themeIndex = Math.floor((displayTier - 1) / 5) % ARENA_THEMES.length;
  const theme = ARENA_THEMES[themeIndex];
  const themePulse = 0.5 + Math.sin(state.elapsed * 0.45) * 0.5;

  const verticalGridLines = useMemo(() => {
    const lineCount = Math.max(6, Math.floor(boardWidth / 62));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * boardWidth) / (lineCount + 1));
  }, [boardWidth]);
  const horizontalGridLines = useMemo(() => {
    const lineCount = Math.max(5, Math.floor(boardHeight / 62));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * boardHeight) / (lineCount + 1));
  }, [boardHeight]);

  const [backgroundImage, setBackgroundImage] = useState<SkImage | null>(null);

  useEffect(() => {
    if (boardWidth <= 0 || boardHeight <= 0) {
      return;
    }

    let cancelled = false;

    const loadBackground = async () => {
      try {
        const image = await drawAsImage(
          createStaticBackgroundScene({
            boardWidth,
            boardHeight,
            verticalGridLines,
            horizontalGridLines,
            theme,
          }),
          { width: boardWidth, height: boardHeight }
        );
        if (!cancelled) {
          setBackgroundImage(image);
        }
      } catch (error) {
        console.warn('Failed to snapshot V2 arena background', error);
      }
    };

    void loadBackground();

    return () => {
      cancelled = true;
    };
  }, [boardHeight, boardWidth, horizontalGridLines, theme, verticalGridLines]);

  const sampledEffects = useMemo(() => sampleForRender(state.effects, MAX_RENDERED_EFFECTS), [state.effects]);
  const sampledPlayerBullets = useMemo(() => sampleForRender(state.playerBullets, MAX_RENDERED_PLAYER_BULLETS), [state.playerBullets]);
  const sampledEnemyBullets = useMemo(() => sampleForRender(state.enemyBullets, MAX_RENDERED_ENEMY_BULLETS), [state.enemyBullets]);
  const ultimateStrength = Math.max(0, Math.min(1, state.ultimateTimer / 1.6));
  const ultimatePulse = 0.5 + Math.sin(state.elapsed * 16) * 0.5;

  return (
    <Canvas pointerEvents="none" style={{ width: boardWidth, height: boardHeight }}>
      {backgroundImage ? (
        <Image image={backgroundImage} x={0} y={0} width={boardWidth} height={boardHeight} />
      ) : (
        <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={theme.base} />
      )}

      <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={withAlpha(theme.overlay, 0.06 + themePulse * 0.05)} />

      {BACKGROUND_PLATES.map((plate, index) => {
        const travel = boardHeight + plate.height + 180;
        const y = ((plate.y + state.elapsed * plate.speed) % travel) - plate.height - 80;
        const x = boardWidth * plate.x;
        return (
          <Group key={`plate-${index}`} opacity={0.86}>
            <RoundedRect x={x} y={y} width={plate.width} height={plate.height} r={plate.radius} color={withAlpha(plate.color, 0.75)} />
            <RoundedRect x={x} y={y} width={plate.width} height={plate.height} r={plate.radius} style="stroke" strokeWidth={1} color={withAlpha(plate.stroke, 0.68)} />
          </Group>
        );
      })}

      {FLOW_STREAKS.map((streak, index) => {
        const span = boardHeight + streak.length + 80;
        const y = ((index * 90 + state.elapsed * streak.speed) % span) - streak.length - 40;
        const x = boardWidth * streak.x + Math.sin(state.elapsed * 0.5 + index) * 6;
        return (
          <Line
            key={`streak-${index}`}
            p1={vec(x, y)}
            p2={vec(x, y + streak.length)}
            color={withAlpha(theme.flow, 0.16)}
            strokeWidth={streak.width}
            strokeCap="round"
          />
        );
      })}

      {state.ultimateTimer > 0 ? (
        <Group opacity={0.24 + ultimateStrength * 0.76}>
          {state.ultimateBuild === 'railFocus' ? (
            <>
              <Rect
                x={0}
                y={0}
                width={boardWidth}
                height={boardHeight}
                color={withAlpha('#E9F2FF', 0.05 + ultimateStrength * 0.08)}
              />
              {state.ultimateColumns.map((columnX, index) => (
                <Group key={`ultimate-rail-${index}`}>
                  <Line
                    p1={vec(columnX, -24)}
                    p2={vec(columnX, boardHeight * 0.9)}
                    color={withAlpha('#BCD8FF', 0.18 + ultimateStrength * 0.22)}
                    strokeWidth={22}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(columnX, -24)}
                    p2={vec(columnX, boardHeight * 0.9)}
                    color={withAlpha('#FFF7E1', 0.72 + ultimateStrength * 0.18)}
                    strokeWidth={6}
                    strokeCap="round"
                  />
                  <Circle
                    cx={columnX}
                    cy={boardHeight * (0.18 + (index % 3) * 0.15)}
                    r={14 + ultimateStrength * 18}
                    color={withAlpha('#FFF1CC', 0.18 + ultimatePulse * 0.2)}
                  />
                </Group>
              ))}
            </>
          ) : null}

          {state.ultimateBuild === 'novaBloom' ? (
            <>
              <Rect
                x={0}
                y={0}
                width={boardWidth}
                height={boardHeight}
                color={withAlpha('#FFB8D9', 0.06 + ultimateStrength * 0.14)}
              />
              {(() => {
                const sweepPath = createNovaSweepPath(state.playerX, boardWidth, boardHeight);
                return (
                  <>
                    <Path path={sweepPath} color={withAlpha('#FFD3E8', 0.18 + ultimateStrength * 0.26)} />
                    <Path path={sweepPath} style="stroke" strokeWidth={2} color={withAlpha('#FFF2D9', 0.55)} />
                  </>
                );
              })()}
              {[-0.28, -0.14, 0, 0.14, 0.28].map((ratio, index) => (
                <Line
                  key={`ultimate-nova-band-${index}`}
                  p1={vec(state.playerX + ratio * boardWidth * 0.18, boardHeight - 20)}
                  p2={vec(state.playerX + ratio * boardWidth * 0.78, boardHeight * 0.02)}
                  color={withAlpha(index === 2 ? '#FFF6D6' : '#FFD3E8', index === 2 ? 0.74 : 0.44)}
                  strokeWidth={index === 2 ? 7 : 4}
                  strokeCap="round"
                />
              ))}
            </>
          ) : null}

          {state.ultimateBuild === 'missileCommand' ? (
            <>
              <Rect
                x={0}
                y={0}
                width={boardWidth}
                height={boardHeight}
                color={withAlpha('#FFD29C', 0.05 + ultimateStrength * 0.1)}
              />
              {state.ultimateColumns.map((columnX, index) => {
                const phase = state.elapsed * 8 + index * 0.7;
                const wobble = Math.sin(phase) * 10;
                const bodyY = boardHeight * (0.92 - ((state.ultimateTimer + index * 0.06) % 1.2) * 0.72);
                return (
                  <Group key={`ultimate-missile-${index}`}>
                    <Line
                      p1={vec(columnX + wobble, boardHeight * 0.96)}
                      p2={vec(columnX - wobble * 0.2, bodyY + 16)}
                      color={withAlpha('#FFD6A8', 0.34)}
                      strokeWidth={8}
                      strokeCap="round"
                    />
                    <Circle cx={columnX - wobble * 0.2} cy={bodyY + 18} r={7 + ultimatePulse * 3} color={withAlpha('#FFF1D2', 0.48)} />
                    <Circle cx={columnX - wobble * 0.2} cy={bodyY + 7} r={4} color={withAlpha('#FFF5E1', 0.82)} />
                  </Group>
                );
              })}
            </>
          ) : null}

          {state.ultimateBuild === 'fractureCore' ? (
            <>
              <Rect
                x={0}
                y={0}
                width={boardWidth}
                height={boardHeight}
                color={withAlpha('#C6D9FF', 0.05 + ultimateStrength * 0.12)}
              />
              <Circle
                cx={boardWidth * 0.5}
                cy={boardHeight * 0.45}
                r={boardWidth * (0.16 + ultimateStrength * 0.22)}
                color={withAlpha('#C8DCFF', 0.14 + ultimatePulse * 0.08)}
              />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
                const angle = (Math.PI * 2 * index) / 8 + state.elapsed * 0.7;
                const startRadius = boardWidth * 0.04;
                const endRadius = boardWidth * (0.28 + ultimateStrength * 0.2);
                const centerX = boardWidth * 0.5;
                const centerY = boardHeight * 0.45;
                return (
                  <Line
                    key={`ultimate-fracture-${index}`}
                    p1={vec(centerX + Math.cos(angle) * startRadius, centerY + Math.sin(angle) * startRadius)}
                    p2={vec(centerX + Math.cos(angle) * endRadius, centerY + Math.sin(angle) * endRadius)}
                    color={withAlpha(index % 2 === 0 ? '#FFF4D8' : '#D8E7FF', 0.42 + ultimateStrength * 0.34)}
                    strokeWidth={index % 2 === 0 ? 4 : 2.5}
                    strokeCap="round"
                  />
                );
              })}
            </>
          ) : null}
        </Group>
      ) : null}

      {state.drops.map((drop) => {
        const pulse = 1 + Math.sin(drop.age * 8) * 0.05;
        const size = drop.size * pulse;
        const x = drop.x - size / 2;
        const y = drop.y - size / 2;
        return (
          <Group key={`drop-${drop.id}`}>
            <RoundedRect x={x} y={y} width={size} height={size} r={12} color={drop.color} />
            <RoundedRect x={x} y={y} width={size} height={size} r={12} style="stroke" strokeWidth={1.5} color="#F8FCFF" />
            <Circle cx={drop.x} cy={drop.y} r={size * 0.1} color={withAlpha('#0A1320', 0.65)} />
          </Group>
        );
      })}

      {state.enemies.map((enemy) => (
        <Group key={`enemy-shell-${enemy.id}`}>
          <Circle cx={enemy.x} cy={enemy.y + enemy.size * 0.1} r={enemy.size * 0.4} color="rgba(4, 10, 18, 0.22)" />
          {renderEnemyCore(enemy)}
        </Group>
      ))}

      {sampledEffects.map((effect) => {
        const progress = Math.min(1, effect.age / effect.duration);
        const opacity = 1 - progress;
        const size = effect.size * (0.68 + progress * 0.62);

        if (effect.kind === 'ultimateRail') {
          return (
            <Group key={effect.id}>
              <Line
                p1={vec(effect.x, effect.y - effect.size * 0.5)}
                p2={vec(effect.x, effect.y + effect.size * 0.5)}
                color={withAlpha(effect.color, 0.2 + opacity * 0.35)}
                strokeWidth={18}
                strokeCap="round"
              />
              <Line
                p1={vec(effect.x, effect.y - effect.size * 0.5)}
                p2={vec(effect.x, effect.y + effect.size * 0.5)}
                color={withAlpha('#FFF5E1', 0.42 + opacity * 0.5)}
                strokeWidth={4}
                strokeCap="round"
              />
            </Group>
          );
        }

        if (effect.kind === 'ultimateNova') {
          const novaPath = createNovaSweepPath(effect.x, boardWidth, boardHeight);
          return (
            <Group key={effect.id} opacity={opacity}>
              <Path path={novaPath} color={withAlpha(effect.color, 0.18)} />
              <Path path={novaPath} style="stroke" strokeWidth={2} color={withAlpha('#FFF1DA', 0.62)} />
            </Group>
          );
        }

        if (effect.kind === 'ultimateMissile') {
          const phase = progress * 1.2;
          const bodyY = effect.y - effect.size * phase;
          const wobble = Math.sin(progress * Math.PI * 2 + effect.x * 0.02) * 8;
          return (
            <Group key={effect.id} opacity={opacity}>
              <Line
                p1={vec(effect.x, effect.y)}
                p2={vec(effect.x + wobble, bodyY + 14)}
                color={withAlpha(effect.color, 0.32)}
                strokeWidth={6}
                strokeCap="round"
              />
              <Circle cx={effect.x + wobble} cy={bodyY + 12} r={6} color={withAlpha('#FFEFD3', 0.64)} />
              <Circle cx={effect.x + wobble} cy={bodyY + 4} r={3.3} color={withAlpha('#FFF6E7', 0.9)} />
            </Group>
          );
        }

        if (effect.kind === 'ultimateFracture') {
          return (
            <Group key={effect.id} opacity={opacity}>
              <Circle cx={effect.x} cy={effect.y} r={size * 0.4} color={withAlpha(effect.color, 0.15)} />
              <Circle cx={effect.x} cy={effect.y} r={size * 0.4} style="stroke" strokeWidth={2.2} color={withAlpha('#EAF4FF', 0.7)} />
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const angle = (Math.PI * 2 * index) / 6 + progress * 0.9;
                const inner = size * 0.1;
                const outer = size * 0.46;
                return (
                  <Line
                    key={`${effect.id}-fracture-${index}`}
                    p1={vec(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner)}
                    p2={vec(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer)}
                    color={withAlpha(index % 2 === 0 ? '#FFF2D2' : effect.color, 0.48 + opacity * 0.36)}
                    strokeWidth={index % 2 === 0 ? 3.6 : 2.2}
                    strokeCap="round"
                  />
                );
              })}
            </Group>
          );
        }

        if (effect.kind === 'muzzle') {
          return (
            <RoundedRect
              key={effect.id}
              x={effect.x - effect.size * 0.21}
              y={effect.y - effect.size}
              width={effect.size * 0.42}
              height={effect.size}
              r={999}
              color={withAlpha(effect.color, opacity)}
            />
          );
        }

        return (
          <Group key={effect.id}>
            <Circle cx={effect.x} cy={effect.y} r={size * 0.5} color={withAlpha(effect.color, effect.kind === 'shield' ? 0.14 * opacity : 0.08 * opacity)} />
            <Circle cx={effect.x} cy={effect.y} r={size * 0.5} style="stroke" strokeWidth={effect.kind === 'warning' ? 2 : 1.8} color={withAlpha(effect.color, opacity)} />
          </Group>
        );
      })}

      {sampledEnemyBullets.map((bullet) => (
        <Group key={`enemy-bullet-${bullet.id}`}>
          <Line
            p1={vec(bullet.x, bullet.y - bullet.size * 1.8)}
            p2={vec(bullet.x, bullet.y + bullet.size * 0.15)}
            color={withAlpha(bullet.color, 0.34)}
            strokeWidth={bullet.size * 0.6}
            strokeCap="round"
          />
          <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.48} color={bullet.color} />
          <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.24} color="#FFF3E6" />
        </Group>
      ))}

      {sampledPlayerBullets.map((bullet) => (
        <Group key={`player-bullet-${bullet.id}`}>
          {(() => {
            const basis = getProjectileBasis(bullet.vx, bullet.vy);
            const trailLength = bullet.kind === 'missile' ? bullet.size * 4.8 : bullet.kind === 'shard' ? bullet.size * 2.4 : bullet.size * 3.7;
            const trailTailX = bullet.x - basis.forwardX * trailLength;
            const trailTailY = bullet.y - basis.forwardY * trailLength;

            if (bullet.kind === 'missile') {
              const missilePath = createMissileBodyPath(
                bullet.x,
                bullet.y,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                bullet.size
              );
              const missileCorePath = createOrientedDiamondPath(
                bullet.x + basis.forwardX * bullet.size * 0.16,
                bullet.y + basis.forwardY * bullet.size * 0.16,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                bullet.size * 0.62,
                bullet.size * 0.2
              );

              return (
                <>
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * bullet.size * 0.8, bullet.y - basis.forwardY * bullet.size * 0.8)}
                    color={withAlpha('#FFD4A2', 0.32)}
                    strokeWidth={bullet.size * 0.96}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * bullet.size * 0.9, bullet.y - basis.forwardY * bullet.size * 0.9)}
                    color={withAlpha('#FFF2D5', 0.42)}
                    strokeWidth={bullet.size * 0.38}
                    strokeCap="round"
                  />
                  <Path path={missilePath} color={bullet.color} />
                  <Path path={missilePath} style="stroke" strokeWidth={1.2} color={withAlpha('#FFF2DA', 0.88)} />
                  <Path path={missileCorePath} color={withAlpha('#FFF4DA', 0.76)} />
                  <Circle
                    cx={bullet.x - basis.forwardX * bullet.size * 1.05}
                    cy={bullet.y - basis.forwardY * bullet.size * 1.05}
                    r={bullet.size * 0.26}
                    color={withAlpha('#FFE8BD', 0.75)}
                  />
                </>
              );
            }

            if (bullet.kind === 'shard') {
              const shardPath = createOrientedShardPath(
                bullet.x,
                bullet.y,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                bullet.size * 1.25,
                bullet.size * 0.55
              );
              return (
                <>
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * bullet.size * 0.7, bullet.y - basis.forwardY * bullet.size * 0.7)}
                    color={withAlpha('#CCE4FF', 0.32)}
                    strokeWidth={bullet.size * 0.5}
                    strokeCap="round"
                  />
                  <Path path={shardPath} color={bullet.color} />
                  <Path path={shardPath} style="stroke" strokeWidth={1.1} color={withAlpha('#F2F8FF', 0.86)} />
                </>
              );
            }

            const boltPath = createOrientedDiamondPath(
              bullet.x,
              bullet.y,
              basis.forwardX,
              basis.forwardY,
              basis.rightX,
              basis.rightY,
              bullet.size * 1.06,
              bullet.size * 0.34
            );
            return (
              <>
                <Line
                  p1={vec(trailTailX, trailTailY)}
                  p2={vec(bullet.x - basis.forwardX * bullet.size * 0.7, bullet.y - basis.forwardY * bullet.size * 0.7)}
                  color={withAlpha('#FFE6A8', 0.34)}
                  strokeWidth={bullet.size * 0.86}
                  strokeCap="round"
                />
                <Line
                  p1={vec(trailTailX, trailTailY)}
                  p2={vec(bullet.x - basis.forwardX * bullet.size * 0.7, bullet.y - basis.forwardY * bullet.size * 0.7)}
                  color={withAlpha('#FFF8DE', 0.46)}
                  strokeWidth={bullet.size * 0.32}
                  strokeCap="round"
                />
                <Path path={boltPath} color={bullet.color} />
                <Path path={boltPath} style="stroke" strokeWidth={1.05} color={withAlpha('#FFF8E0', 0.86)} />
              </>
            );
          })()}
        </Group>
      ))}

    </Canvas>
  );
}
