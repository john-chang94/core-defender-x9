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
import type { SharedValue } from 'react-native-reanimated';

import {
  ARENA_ENEMY_ZONE_RATIO,
  ARENA_PLAYER_HEIGHT,
} from './config';
import type { ArenaEnemy, ArenaGameState } from './types';

type ArenaCanvasProps = {
  boardWidth: number;
  boardHeight: number;
  state: ArenaGameState;
  playerRenderX: SharedValue<number>;
};

const MAX_RENDERED_EFFECTS = 36;
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

  path.addRRect(Skia.RRectXY(Skia.XYWHRect(x - halfSize, y - halfSize, size, size), 12, 12));
  return path;
}

function createStaticBackgroundScene({
  boardWidth,
  boardHeight,
  verticalGridLines,
  horizontalGridLines,
}: {
  boardWidth: number;
  boardHeight: number;
  verticalGridLines: number[];
  horizontalGridLines: number[];
}) {
  const enemyZoneHeight = boardHeight * ARENA_ENEMY_ZONE_RATIO;

  return (
    <Group>
      <Rect x={0} y={0} width={boardWidth} height={boardHeight} color="#08131E" />
      <Circle cx={boardWidth * 0.18} cy={boardHeight * 0.1} r={boardWidth * 0.28} color="rgba(255, 112, 176, 0.08)" />
      <Circle cx={boardWidth * 0.86} cy={boardHeight * 0.86} r={boardWidth * 0.32} color="rgba(102, 234, 255, 0.06)" />
      <Rect x={0} y={0} width={boardWidth} height={enemyZoneHeight} color="rgba(255, 121, 183, 0.045)" />
      <RoundedRect
        x={14}
        y={enemyZoneHeight}
        width={Math.max(0, boardWidth - 28)}
        height={2}
        r={999}
        color="rgba(255, 184, 112, 0.28)"
      />
      {verticalGridLines.map((x, index) => (
        <Line
          key={`arena-bg-v-${index}`}
          p1={vec(x, 0)}
          p2={vec(x, boardHeight)}
          color="rgba(122, 149, 184, 0.12)"
          strokeWidth={1}
        />
      ))}
      {horizontalGridLines.map((y, index) => (
        <Line
          key={`arena-bg-h-${index}`}
          p1={vec(0, y)}
          p2={vec(boardWidth, y)}
          color="rgba(122, 149, 184, 0.12)"
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
      {enemy.windupTimer > 0 ? (
        <Circle
          cx={enemy.x}
          cy={enemy.y}
          r={enemy.size * 0.66}
          style="stroke"
          strokeWidth={1.6}
          color="rgba(255, 238, 200, 0.8)"
        />
      ) : null}
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

export function ArenaCanvas({ boardWidth, boardHeight, state, playerRenderX }: ArenaCanvasProps) {
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
  }, [boardHeight, boardWidth, horizontalGridLines, verticalGridLines]);

  const sampledEffects = useMemo(() => sampleForRender(state.effects, MAX_RENDERED_EFFECTS), [state.effects]);
  const sampledPlayerBullets = useMemo(() => sampleForRender(state.playerBullets, MAX_RENDERED_PLAYER_BULLETS), [state.playerBullets]);
  const sampledEnemyBullets = useMemo(() => sampleForRender(state.enemyBullets, MAX_RENDERED_ENEMY_BULLETS), [state.enemyBullets]);
  const playerTop = Math.max(0, boardHeight - ARENA_PLAYER_HEIGHT - 14);
  const playerCenterY = playerTop + 18;
  const ultimateProgress = state.ultimateTimer > 0 ? state.ultimateTimer / 1.15 : 0;

  return (
    <Canvas pointerEvents="none" style={{ width: boardWidth, height: boardHeight }}>
      {backgroundImage ? (
        <Image image={backgroundImage} x={0} y={0} width={boardWidth} height={boardHeight} />
      ) : (
        <Rect x={0} y={0} width={boardWidth} height={boardHeight} color="#08131E" />
      )}

      {BACKGROUND_PLATES.map((plate, index) => {
        const travel = boardHeight + plate.height + 180;
        const y = ((plate.y + state.elapsed * plate.speed) % travel) - plate.height - 80;
        const x = boardWidth * plate.x;
        return (
          <Group key={`plate-${index}`} opacity={0.86}>
            <RoundedRect x={x} y={y} width={plate.width} height={plate.height} r={plate.radius} color={plate.color} />
            <RoundedRect x={x} y={y} width={plate.width} height={plate.height} r={plate.radius} style="stroke" strokeWidth={1} color={withAlpha(plate.stroke, 0.7)} />
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
            color="rgba(145, 205, 255, 0.16)"
            strokeWidth={streak.width}
            strokeCap="round"
          />
        );
      })}

      {state.ultimateTimer > 0 ? (
        <Group opacity={0.24 + ultimateProgress * 0.76}>
          <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={withAlpha('#FFF1BF', 0.08 * ultimateProgress)} />
          {state.ultimateColumns.map((columnX, index) => (
            <Group key={`ultimate-${index}`}>
              <Line p1={vec(columnX, -24)} p2={vec(columnX, boardHeight * 0.9)} color="rgba(255, 214, 131, 0.26)" strokeWidth={28} strokeCap="round" />
              <Line p1={vec(columnX, -24)} p2={vec(columnX, boardHeight * 0.9)} color="rgba(255, 246, 219, 0.9)" strokeWidth={8} strokeCap="round" />
              <Circle cx={columnX} cy={boardHeight * (0.22 + (index % 3) * 0.12)} r={18 + ultimateProgress * 20} color="rgba(255, 232, 170, 0.16)" />
            </Group>
          ))}
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
          <Line
            p1={vec(bullet.x, bullet.y + bullet.size * 1.9)}
            p2={vec(bullet.x, bullet.y - bullet.size * 0.2)}
            color={withAlpha('#FFE5A3', 0.32)}
            strokeWidth={bullet.size * 0.72}
            strokeCap="round"
          />
          <Line
            p1={vec(bullet.x, bullet.y + bullet.size * 1.45)}
            p2={vec(bullet.x, bullet.y - bullet.size * 0.45)}
            color={bullet.color}
            strokeWidth={bullet.size * 0.46}
            strokeCap="round"
          />
          <Circle cx={bullet.x} cy={bullet.y - bullet.size * 0.28} r={bullet.size * 0.22} color="#FFF6D8" />
        </Group>
      ))}

      <Group
        opacity={state.playerFlash > 0 ? 0.82 : 1}
        transform={[{ translateX: playerRenderX as unknown as number }, { translateY: playerCenterY }]}>
        <Circle cx={0} cy={18} r={24} color="rgba(110, 234, 255, 0.08)" />
        <Line p1={vec(-6, 24)} p2={vec(-10, 40)} color="rgba(255, 156, 98, 0.6)" strokeWidth={5} strokeCap="round" />
        <Line p1={vec(6, 24)} p2={vec(10, 40)} color="rgba(255, 156, 98, 0.6)" strokeWidth={5} strokeCap="round" />
        <RoundedRect x={-10} y={-12} width={20} height={26} r={9} color={state.playerFlash > 0 ? '#FFD6CB' : '#77E9FF'} />
        <RoundedRect x={-10} y={-12} width={20} height={26} r={9} style="stroke" strokeWidth={1.4} color="#EAFDFF" />
        <RoundedRect x={-4} y={-6} width={8} height={10} r={4} color="#FFF5CC" />
        <RoundedRect x={-22} y={4} width={12} height={6} r={999} color="#2A74B7" />
        <RoundedRect x={10} y={4} width={12} height={6} r={999} color="#2A74B7" />
        <Line p1={vec(0, -14)} p2={vec(0, -30)} color={withAlpha('#B6EFFF', state.overclockTimer > 0 ? 0.74 : 0.24)} strokeWidth={4} strokeCap="round" />
      </Group>
    </Canvas>
  );
}
