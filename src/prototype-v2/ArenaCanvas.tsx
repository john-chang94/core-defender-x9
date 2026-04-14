import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { ArenaEnemy, ArenaGameState, ArenaVfxQuality } from './types';

type ArenaCanvasProps = {
  boardWidth: number;
  boardHeight: number;
  state: ArenaGameState;
  vfxQuality: ArenaVfxQuality;
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

const ATMOSPHERE_ORBS = [
  { x: 0.14, y: -80, radius: 120, speed: 20, color: '#6EDCFF', opacity: 0.075 },
  { x: 0.84, y: 42, radius: 156, speed: 15, color: '#FF89C0', opacity: 0.07 },
  { x: 0.34, y: 280, radius: 102, speed: 18, color: '#9EC7FF', opacity: 0.06 },
  { x: 0.72, y: 420, radius: 130, speed: 23, color: '#FFD39C', opacity: 0.062 },
] as const;

const ENERGY_SWEEPS = [
  { x: 0.22, width: 52, height: 240, speed: 42, color: '#8BD2FF' },
  { x: 0.56, width: 66, height: 290, speed: 35, color: '#FFC9E5' },
  { x: 0.8, width: 58, height: 260, speed: 47, color: '#B6E7FF' },
] as const;

type OverdriveCrackSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  neonMix: number;
};

function createDeterministicRandom(seedValue: number) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function createOverdriveCrackSegments(boardWidth: number, boardHeight: number, highVfx: boolean, seedOffset: number) {
  const random = createDeterministicRandom(
    Math.floor(boardWidth * 31 + boardHeight * 17 + (highVfx ? 97 : 53) + seedOffset)
  );
  const segments: OverdriveCrackSegment[] = [];
  const chainCount = highVfx ? 10 : 7;
  const maxStep = Math.min(boardWidth, boardHeight) * (highVfx ? 0.22 : 0.18);

  for (let chainIndex = 0; chainIndex < chainCount; chainIndex += 1) {
    let x = random() * boardWidth;
    let y = random() * boardHeight * 0.96;
    const branchSteps = (highVfx ? 4 : 3) + Math.floor(random() * 2);
    for (let step = 0; step < branchSteps; step += 1) {
      const angle = -Math.PI * 0.5 + (random() - 0.5) * 2.1;
      const length = maxStep * (0.35 + random() * 0.65);
      const nextX = clamp(x + Math.cos(angle) * length, 0, boardWidth);
      const nextY = clamp(y + Math.sin(angle) * length, 0, boardHeight);
      segments.push({
        x1: x,
        y1: y,
        x2: nextX,
        y2: nextY,
        width: 1 + random() * 1.8,
        neonMix: random(),
      });
      x = nextX;
      y = nextY;
    }
  }

  return segments;
}

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBuildProjectilePalette(buildFlavor: ArenaGameState['activeBuild'] | undefined) {
  if (buildFlavor === 'railFocus') {
    return {
      body: '#CDE0FF',
      rim: '#ECF4FF',
      core: '#FFF6DC',
      trailOuter: withAlpha('#9EC4FF', 0.38),
      trailInner: withAlpha('#F4FAFF', 0.58),
      halo: '#D6E7FF',
    };
  }
  if (buildFlavor === 'novaBloom') {
    return {
      body: '#FFB7D9',
      rim: '#FFE2F1',
      core: '#FFF2DF',
      trailOuter: withAlpha('#FF9DCE', 0.36),
      trailInner: withAlpha('#FFEAF5', 0.56),
      halo: '#FFC7E3',
    };
  }
  if (buildFlavor === 'fractureCore') {
    return {
      body: '#B4C4D7',
      rim: '#E3EDFA',
      core: '#F7FBFF',
      trailOuter: withAlpha('#B8CCE0', 0.35),
      trailInner: withAlpha('#F3F8FF', 0.52),
      halo: '#CDDEEF',
    };
  }
  return {
    body: '#FFD7A9',
    rim: '#FFEAD1',
    core: '#FFF7E4',
    trailOuter: withAlpha('#FFD8A9', 0.35),
    trailInner: withAlpha('#FFF4E1', 0.52),
    halo: '#FFE5BF',
  };
}

function getUltimateScreenPalette(build: ArenaGameState['ultimateBuild']) {
  if (build === 'railFocus') {
    return {
      flash: '#CFE3FF',
      ring: '#EAF4FF',
      line: '#D2E4FF',
    };
  }
  if (build === 'novaBloom') {
    return {
      flash: '#FFD3E8',
      ring: '#FFE6F2',
      line: '#FFC2E0',
    };
  }
  if (build === 'missileCommand') {
    return {
      flash: '#FFD9B0',
      ring: '#FFEED8',
      line: '#FFC48D',
    };
  }
  if (build === 'fractureCore') {
    return {
      flash: '#D4E4FF',
      ring: '#EDF4FF',
      line: '#C4D7F6',
    };
  }
  return {
    flash: '#DCE8F8',
    ring: '#F0F5FF',
    line: '#D0DDF0',
  };
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

function createOrientedRectPath(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  rightX: number,
  rightY: number,
  halfLength: number,
  halfWidth: number
) {
  const path = Skia.Path.Make();
  path.moveTo(x + forwardX * halfLength + rightX * halfWidth, y + forwardY * halfLength + rightY * halfWidth);
  path.lineTo(x + forwardX * halfLength - rightX * halfWidth, y + forwardY * halfLength - rightY * halfWidth);
  path.lineTo(x - forwardX * halfLength - rightX * halfWidth, y - forwardY * halfLength - rightY * halfWidth);
  path.lineTo(x - forwardX * halfLength + rightX * halfWidth, y - forwardY * halfLength + rightY * halfWidth);
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
  return createOrientedRectPath(x, y, forwardX, forwardY, rightX, rightY, size * 1.02, size * 0.5);
}

function createMissileNosePath(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  rightX: number,
  rightY: number,
  size: number
) {
  const tipX = x + forwardX * (size * 1.92);
  const tipY = y + forwardY * (size * 1.92);
  const baseX = x + forwardX * (size * 1.02);
  const baseY = y + forwardY * (size * 1.02);
  const halfWidth = size * 0.47;

  const path = Skia.Path.Make();
  path.moveTo(tipX, tipY);
  path.lineTo(baseX + rightX * halfWidth, baseY + rightY * halfWidth);
  path.lineTo(baseX - rightX * halfWidth, baseY - rightY * halfWidth);
  path.close();
  return path;
}

function createMissileFinPath(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  rightX: number,
  rightY: number,
  size: number,
  side: -1 | 1
) {
  const rootX = x + forwardX * (size * 0.3) + rightX * side * (size * 0.48);
  const rootY = y + forwardY * (size * 0.3) + rightY * side * (size * 0.48);
  const outerX = x + forwardX * (size * 0.02) + rightX * side * (size * 0.94);
  const outerY = y + forwardY * (size * 0.02) + rightY * side * (size * 0.94);
  const tipX = x + forwardX * (size * 0.86) + rightX * side * (size * 0.58);
  const tipY = y + forwardY * (size * 0.86) + rightY * side * (size * 0.58);

  const path = Skia.Path.Make();
  path.moveTo(rootX, rootY);
  path.lineTo(outerX, outerY);
  path.lineTo(tipX, tipY);
  path.close();
  return path;
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

type EnemyLocalPoint = readonly [number, number];

const ENEMY_HULL_POINTS: Record<ArenaEnemy['kind'], readonly EnemyLocalPoint[]> = {
  hover: [
    [1.02, 0],
    [0.3, 0.68],
    [-0.5, 0.52],
    [-0.94, 0.1],
    [-0.94, -0.1],
    [-0.5, -0.52],
    [0.3, -0.68],
  ],
  burst: [
    [1.04, 0],
    [0.24, 0.8],
    [-0.66, 0.4],
    [-0.98, 0],
    [-0.66, -0.4],
    [0.24, -0.8],
  ],
  tank: [
    [0.86, 0.62],
    [1.02, 0.2],
    [1.02, -0.2],
    [0.86, -0.62],
    [-0.74, -0.62],
    [-1, -0.2],
    [-1, 0.2],
    [-0.74, 0.62],
  ],
  orbiter: [
    [0.96, 0],
    [0.34, 0.72],
    [-0.38, 0.6],
    [-0.9, 0.18],
    [-0.9, -0.18],
    [-0.38, -0.6],
    [0.34, -0.72],
  ],
  sniper: [
    [1.14, 0],
    [0.24, 0.38],
    [-0.92, 0.3],
    [-1.06, 0],
    [-0.92, -0.3],
    [0.24, -0.38],
  ],
  bomber: [
    [0.74, 0.86],
    [1.04, 0.34],
    [0.8, 0],
    [1.04, -0.34],
    [0.74, -0.86],
    [-0.22, -0.56],
    [-0.96, -0.32],
    [-0.96, 0.32],
    [-0.22, 0.56],
  ],
  interceptor: [
    [1.08, 0],
    [0.28, 0.72],
    [-0.58, 0.44],
    [-0.98, 0],
    [-0.58, -0.44],
    [0.28, -0.72],
  ],
  prismBoss: [
    [1.1, 0],
    [0.42, 0.92],
    [-0.46, 0.66],
    [-1, 0.2],
    [-1, -0.2],
    [-0.46, -0.66],
    [0.42, -0.92],
  ],
};

function getEnemyBasis(aimAngle: number) {
  const forwardX = Math.sin(aimAngle);
  const forwardY = Math.cos(aimAngle);
  const rightX = forwardY;
  const rightY = -forwardX;
  return { forwardX, forwardY, rightX, rightY };
}

function createOrientedPolygonPath(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  rightX: number,
  rightY: number,
  scale: number,
  points: readonly EnemyLocalPoint[]
) {
  const path = Skia.Path.Make();
  if (points.length === 0) {
    return path;
  }

  const [firstForward, firstRight] = points[0];
  path.moveTo(x + forwardX * firstForward * scale + rightX * firstRight * scale, y + forwardY * firstForward * scale + rightY * firstRight * scale);

  for (let index = 1; index < points.length; index += 1) {
    const [pointForward, pointRight] = points[index];
    path.lineTo(
      x + forwardX * pointForward * scale + rightX * pointRight * scale,
      y + forwardY * pointForward * scale + rightY * pointRight * scale
    );
  }

  path.close();
  return path;
}

function createEnemyHullPath(enemy: ArenaEnemy) {
  const { forwardX, forwardY, rightX, rightY } = getEnemyBasis(enemy.aimAngle);
  return createOrientedPolygonPath(
    enemy.x,
    enemy.y,
    forwardX,
    forwardY,
    rightX,
    rightY,
    enemy.size * 0.5,
    ENEMY_HULL_POINTS[enemy.kind]
  );
}

function createEnemyWingPanelPath(enemy: ArenaEnemy, side: -1 | 1) {
  const { forwardX, forwardY, rightX, rightY } = getEnemyBasis(enemy.aimAngle);
  const span =
    enemy.kind === 'prismBoss'
      ? 0.7
      : enemy.kind === 'tank'
        ? 0.62
        : enemy.kind === 'sniper'
          ? 0.52
          : 0.58;
  const points: EnemyLocalPoint[] = [
    [0.14, side * (span * 0.24)],
    [-0.02, side * span],
    [-0.36, side * (span * 0.8)],
    [-0.56, side * (span * 0.28)],
  ];
  return createOrientedPolygonPath(enemy.x, enemy.y, forwardX, forwardY, rightX, rightY, enemy.size * 0.5, points);
}

function createEnemyCanopyPath(enemy: ArenaEnemy) {
  const { forwardX, forwardY, rightX, rightY } = getEnemyBasis(enemy.aimAngle);
  const canopyLength =
    enemy.kind === 'sniper' ? enemy.size * 0.28 : enemy.kind === 'tank' ? enemy.size * 0.22 : enemy.size * 0.24;
  const canopyWidth =
    enemy.kind === 'tank' || enemy.kind === 'bomber' ? enemy.size * 0.16 : enemy.size * 0.13;
  return createOrientedRectPath(
    enemy.x + forwardX * (enemy.size * 0.02),
    enemy.y + forwardY * (enemy.size * 0.02),
    forwardX,
    forwardY,
    rightX,
    rightY,
    canopyLength,
    canopyWidth
  );
}

function createEnemyGunBarrelPaths(enemy: ArenaEnemy) {
  const { forwardX, forwardY, rightX, rightY } = getEnemyBasis(enemy.aimAngle);
  const barrels: ReturnType<typeof Skia.Path.Make>[] = [];

  const mainBarrel = createOrientedRectPath(
    enemy.x + forwardX * (enemy.size * 0.46),
    enemy.y + forwardY * (enemy.size * 0.46),
    forwardX,
    forwardY,
    rightX,
    rightY,
    enemy.kind === 'sniper' ? enemy.size * 0.3 : enemy.size * 0.22,
    enemy.kind === 'tank' || enemy.kind === 'bomber' ? enemy.size * 0.1 : enemy.size * 0.075
  );
  barrels.push(mainBarrel);

  if (enemy.kind === 'bomber' || enemy.kind === 'prismBoss' || enemy.kind === 'interceptor') {
    const sideOffset = enemy.kind === 'prismBoss' ? enemy.size * 0.16 : enemy.size * 0.13;
    const sideBarrelLength = enemy.kind === 'prismBoss' ? enemy.size * 0.18 : enemy.size * 0.16;
    const sideBarrelWidth = enemy.size * 0.052;
    barrels.push(
      createOrientedRectPath(
        enemy.x + forwardX * (enemy.size * 0.4) + rightX * sideOffset,
        enemy.y + forwardY * (enemy.size * 0.4) + rightY * sideOffset,
        forwardX,
        forwardY,
        rightX,
        rightY,
        sideBarrelLength,
        sideBarrelWidth
      )
    );
    barrels.push(
      createOrientedRectPath(
        enemy.x + forwardX * (enemy.size * 0.4) - rightX * sideOffset,
        enemy.y + forwardY * (enemy.size * 0.4) - rightY * sideOffset,
        forwardX,
        forwardY,
        rightX,
        rightY,
        sideBarrelLength,
        sideBarrelWidth
      )
    );
  }

  return barrels;
}

function renderEnemyShipDetails(enemy: ArenaEnemy) {
  const leftWingPath = createEnemyWingPanelPath(enemy, -1);
  const rightWingPath = createEnemyWingPanelPath(enemy, 1);
  const canopyPath = createEnemyCanopyPath(enemy);
  const gunBarrels = createEnemyGunBarrelPaths(enemy);
  const { forwardX, forwardY, rightX, rightY } = getEnemyBasis(enemy.aimAngle);
  const rearKeelPath = createOrientedRectPath(
    enemy.x - forwardX * (enemy.size * 0.36),
    enemy.y - forwardY * (enemy.size * 0.36),
    forwardX,
    forwardY,
    rightX,
    rightY,
    enemy.size * 0.16,
    enemy.size * 0.08
  );

  return (
    <>
      <Path path={leftWingPath} color={withAlpha(enemy.color, 0.3)} />
      <Path path={rightWingPath} color={withAlpha(enemy.color, 0.3)} />
      <Path path={leftWingPath} style="stroke" strokeWidth={1.1} color={withAlpha('#EAF7FF', 0.48)} />
      <Path path={rightWingPath} style="stroke" strokeWidth={1.1} color={withAlpha('#EAF7FF', 0.48)} />
      <Path path={rearKeelPath} color={withAlpha('#E8F2FF', 0.28)} />
      <Path path={canopyPath} color={withAlpha('#F2F7FF', 0.45)} />
      <Path path={canopyPath} style="stroke" strokeWidth={1} color={withAlpha('#FFFFFF', 0.72)} />
      {gunBarrels.map((barrelPath, index) => (
        <Path key={`enemy-barrel-${enemy.id}-${index}`} path={barrelPath} color={withAlpha('#FEE8CB', enemy.windupTimer > 0 ? 0.94 : 0.78)} />
      ))}
      {gunBarrels.map((barrelPath, index) => (
        <Path
          key={`enemy-barrel-outline-${enemy.id}-${index}`}
          path={barrelPath}
          style="stroke"
          strokeWidth={0.9}
          color={withAlpha('#FFF8EA', enemy.windupTimer > 0 ? 0.9 : 0.6)}
        />
      ))}
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
  const enemyPath = createEnemyHullPath(enemy);
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

export function ArenaCanvas({ boardWidth, boardHeight, state, vfxQuality }: ArenaCanvasProps) {
  const displayTier = Math.floor(state.elapsed / ARENA_TIER_DURATION_SECONDS) + 1;
  const themeIndex = Math.floor((displayTier - 1) / 5) % ARENA_THEMES.length;
  const theme = ARENA_THEMES[themeIndex];
  const themePulse = 0.5 + Math.sin(state.elapsed * 0.45) * 0.5;
  const overdriveBlend = clamp(state.overclockVisualBlend, 0, 1);
  const overdrivePulse = 0.5 + Math.sin(state.elapsed * 7.4) * 0.5;
  const isHighVfx = vfxQuality === 'high';
  const maxRenderedEffects = isHighVfx ? MAX_RENDERED_EFFECTS : 34;
  const maxRenderedPlayerBullets = isHighVfx ? MAX_RENDERED_PLAYER_BULLETS : 74;
  const maxRenderedEnemyBullets = isHighVfx ? MAX_RENDERED_ENEMY_BULLETS : 40;

  const verticalGridLines = useMemo(() => {
    const lineCount = Math.max(6, Math.floor(boardWidth / 62));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * boardWidth) / (lineCount + 1));
  }, [boardWidth]);
  const horizontalGridLines = useMemo(() => {
    const lineCount = Math.max(5, Math.floor(boardHeight / 62));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * boardHeight) / (lineCount + 1));
  }, [boardHeight]);
  const [overdriveCrackSeed, setOverdriveCrackSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const wasOverdriveActiveRef = useRef(false);
  useEffect(() => {
    const isOverdriveActive = overdriveBlend > 0.08;
    if (isOverdriveActive && !wasOverdriveActiveRef.current) {
      setOverdriveCrackSeed((previousSeed) => (previousSeed + Math.floor(Math.random() * 9_973) + 137) % 10_000_000);
    }
    wasOverdriveActiveRef.current = isOverdriveActive;
  }, [overdriveBlend]);
  const overdriveCrackSegments = useMemo(
    () =>
      createOverdriveCrackSegments(
        boardWidth,
        boardHeight,
        isHighVfx,
        overdriveCrackSeed * 31
      ),
    [boardHeight, boardWidth, isHighVfx, overdriveCrackSeed]
  );

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

  const sampledEffects = useMemo(() => sampleForRender(state.effects, maxRenderedEffects), [maxRenderedEffects, state.effects]);
  const sampledPlayerBullets = useMemo(() => sampleForRender(state.playerBullets, maxRenderedPlayerBullets), [maxRenderedPlayerBullets, state.playerBullets]);
  const sampledEnemyBullets = useMemo(() => sampleForRender(state.enemyBullets, maxRenderedEnemyBullets), [maxRenderedEnemyBullets, state.enemyBullets]);
  const denseEffectMode = sampledEffects.length > (isHighVfx ? 24 : 18);
  const ultimateStrength = Math.max(0, Math.min(1, state.ultimateTimer / 1.6));
  const ultimatePulse = 0.5 + Math.sin(state.elapsed * 16) * 0.5;
  const ultimateScreenPalette = getUltimateScreenPalette(state.ultimateBuild);

  return (
    <Canvas pointerEvents="none" style={{ width: boardWidth, height: boardHeight }}>
      {backgroundImage ? (
        <Image image={backgroundImage} x={0} y={0} width={boardWidth} height={boardHeight} />
      ) : (
        <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={theme.base} />
      )}

      <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={withAlpha(theme.overlay, 0.06 + themePulse * 0.05)} />
      {overdriveBlend > 0 ? (
        <Group opacity={overdriveBlend}>
          <Rect
            x={0}
            y={0}
            width={boardWidth}
            height={boardHeight}
            color={withAlpha('#4B1808', 0.13 + overdrivePulse * 0.06)}
          />
          <Circle
            cx={boardWidth * 0.86}
            cy={boardHeight * 0.16}
            r={boardWidth * 0.34}
            color={withAlpha('#FF9347', 0.12 + overdrivePulse * 0.08)}
          />
          <Circle
            cx={boardWidth * 0.24}
            cy={boardHeight * 0.85}
            r={boardWidth * 0.38}
            color={withAlpha('#FF6B2F', 0.1 + overdrivePulse * 0.06)}
          />
          <RoundedRect
            x={14}
            y={boardHeight * ARENA_ENEMY_ZONE_RATIO}
            width={Math.max(0, boardWidth - 28)}
            height={2}
            r={999}
            color={withAlpha('#FFC47A', 0.46 + overdrivePulse * 0.16)}
          />
          {overdriveCrackSegments.map((segment, index) => {
            const neonColor =
              segment.neonMix > 0.86
                ? '#6FFFFA'
                : segment.neonMix > 0.72
                  ? '#F8FF8C'
                  : segment.neonMix > 0.55
                    ? '#FFCC7A'
                    : '#FF7B42';
            return (
              <Group key={`overdrive-crack-${index}`}>
                <Line
                  p1={vec(segment.x1, segment.y1)}
                  p2={vec(segment.x2, segment.y2)}
                  color={withAlpha('#200A05', 0.64)}
                  strokeWidth={segment.width + 2.2}
                  strokeCap="round"
                />
                <Line
                  p1={vec(segment.x1, segment.y1)}
                  p2={vec(segment.x2, segment.y2)}
                  color={withAlpha('#FF7A3B', 0.22 + overdrivePulse * 0.1)}
                  strokeWidth={segment.width + 0.8}
                  strokeCap="round"
                />
                <Line
                  p1={vec(segment.x1, segment.y1)}
                  p2={vec(segment.x2, segment.y2)}
                  color={withAlpha(neonColor, 0.28 + overdrivePulse * 0.16)}
                  strokeWidth={Math.max(0.9, segment.width * 0.5)}
                  strokeCap="round"
                />
              </Group>
            );
          })}
          {(isHighVfx ? [0.14, 0.3, 0.5, 0.68, 0.84] : [0.22, 0.5, 0.78]).map((lane, index) => {
            const sway = Math.sin(state.elapsed * 2.9 + index * 0.8) * 7;
            return (
              <Line
                key={`overdrive-lane-${index}`}
                p1={vec(boardWidth * lane + sway, 0)}
                p2={vec(boardWidth * lane - sway * 0.35, boardHeight)}
                color={withAlpha('#FFD38F', isHighVfx ? 0.18 : 0.12)}
                strokeWidth={isHighVfx ? 1.6 : 1.2}
              />
            );
          })}
        </Group>
      ) : null}

      {isHighVfx
        ? ATMOSPHERE_ORBS.map((orb, index) => {
            const travel = boardHeight + orb.radius * 2 + 220;
            const orbY = ((orb.y + state.elapsed * orb.speed) % travel) - orb.radius - 100;
            const orbX = boardWidth * orb.x + Math.sin(state.elapsed * 0.42 + index * 1.3) * 18;
            return (
              <Circle
                key={`orb-${index}`}
                cx={orbX}
                cy={orbY}
                r={orb.radius}
                color={withAlpha(orb.color, orb.opacity)}
              />
            );
          })
        : null}

      {isHighVfx
        ? ENERGY_SWEEPS.map((sweep, index) => {
            const travel = boardHeight + sweep.height + 180;
            const sweepY = ((state.elapsed * sweep.speed + index * 170) % travel) - sweep.height - 90;
            const sweepX = boardWidth * sweep.x + Math.cos(state.elapsed * 0.31 + index * 0.9) * 14;
            return (
              <RoundedRect
                key={`sweep-${index}`}
                x={sweepX - sweep.width * 0.5}
                y={sweepY}
                width={sweep.width}
                height={sweep.height}
                r={sweep.width * 0.5}
                color={withAlpha(sweep.color, 0.05)}
              />
            );
          })
        : null}

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

      {isHighVfx ? (
        <RoundedRect
          x={boardWidth * 0.5 - Math.min(90, boardWidth * 0.18)}
          y={boardHeight - 70}
          width={Math.min(180, boardWidth * 0.36)}
          height={62}
          r={999}
          color={withAlpha(theme.pulse, 0.06 + themePulse * 0.05)}
        />
      ) : null}

      {state.ultimateTimer > 0 ? (
        <Group opacity={0.24 + ultimateStrength * 0.76}>
          <Rect
            x={0}
            y={0}
            width={boardWidth}
            height={boardHeight}
            color={withAlpha(ultimateScreenPalette.flash, 0.04 + ultimateStrength * 0.08)}
          />
          <Circle
            cx={state.playerX}
            cy={boardHeight - 22}
            r={boardWidth * (0.08 + ultimateStrength * 0.24)}
            color={withAlpha(ultimateScreenPalette.ring, 0.08 + ultimatePulse * 0.08)}
          />
          <Circle
            cx={state.playerX}
            cy={boardHeight - 22}
            r={boardWidth * (0.06 + ultimateStrength * 0.2)}
            style="stroke"
            strokeWidth={isHighVfx ? 2.6 : 1.7}
            color={withAlpha(ultimateScreenPalette.ring, 0.34 + ultimatePulse * 0.16)}
          />
          {(isHighVfx ? [0.14, 0.32, 0.5, 0.68, 0.86] : [0.2, 0.5, 0.8]).map((lane, index) => {
            const sway = Math.sin(state.elapsed * 3 + index * 0.8) * 8;
            return (
              <Line
                key={`ultimate-screen-lane-${index}`}
                p1={vec(boardWidth * lane + sway, 0)}
                p2={vec(boardWidth * lane - sway * 0.35, boardHeight)}
                color={withAlpha(ultimateScreenPalette.line, isHighVfx ? 0.12 : 0.08)}
                strokeWidth={isHighVfx ? 1.5 : 1}
              />
            );
          })}

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
          const ringRadius = size * 0.4;
          const baseAngle = effect.angle ?? effect.x * 0.01;
          const rayCount = denseEffectMode ? (isHighVfx ? 6 : 5) : isHighVfx ? 8 : 6;
          return (
            <Group key={effect.id} opacity={opacity}>
              <Circle cx={effect.x} cy={effect.y} r={ringRadius} color={withAlpha(effect.color, 0.15)} />
              <Circle cx={effect.x} cy={effect.y} r={ringRadius} style="stroke" strokeWidth={2.2} color={withAlpha('#EAF4FF', 0.7)} />
              <Circle
                cx={effect.x}
                cy={effect.y}
                r={ringRadius * 0.46}
                color={withAlpha('#F4FBFF', 0.08 + opacity * 0.06)}
              />
              {Array.from({ length: rayCount }, (_, index) => {
                const angle = baseAngle + (Math.PI * 2 * index) / rayCount + progress * 1.1;
                const inner = size * (0.08 + (index % 2) * 0.02);
                const outer = size * (0.42 + (index % 3) * 0.04);
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

        if (effect.kind === 'fractureBits') {
          const shardCount = denseEffectMode ? 6 : 8;
          const seedBase = (effect.angle ?? 0) + effect.x * 0.012 + effect.y * 0.009;
          return (
            <Group key={effect.id} opacity={opacity}>
              <Circle
                cx={effect.x}
                cy={effect.y}
                r={effect.size * (0.08 + progress * 0.04)}
                color={withAlpha('#F6FBFF', 0.12 + opacity * 0.12)}
              />
              {Array.from({ length: shardCount }, (_, index) => {
                const jitter = Math.sin(seedBase * 1.9 + index * 1.47) * 0.34;
                const angle = seedBase + (Math.PI * 2 * index) / shardCount + jitter;
                const forwardX = Math.cos(angle);
                const forwardY = Math.sin(angle);
                const rightX = -forwardY;
                const rightY = forwardX;
                const distance = effect.size * (0.16 + progress * (0.54 + (index % 3) * 0.12));
                const shardX = effect.x + forwardX * distance;
                const shardY = effect.y + forwardY * distance;
                const shardLength = Math.max(4, effect.size * (0.13 + (index % 4) * 0.026) * (1 - progress * 0.2));
                const shardHalfWidth = Math.max(1.4, effect.size * (0.018 + (index % 2) * 0.006) * (1 - progress * 0.28));
                const shardPath = createOrientedShardPath(
                  shardX,
                  shardY,
                  forwardX,
                  forwardY,
                  rightX,
                  rightY,
                  shardLength,
                  shardHalfWidth
                );
                return (
                  <Group
                    key={`${effect.id}-bit-${index}`}
                  >
                    <Line
                      p1={vec(effect.x + forwardX * effect.size * 0.1, effect.y + forwardY * effect.size * 0.1)}
                      p2={vec(shardX - forwardX * shardLength * 0.34, shardY - forwardY * shardLength * 0.34)}
                      color={withAlpha(index % 2 === 0 ? '#F4FAFF' : effect.color, 0.24 + opacity * 0.2)}
                      strokeWidth={Math.max(1, shardHalfWidth * 0.72)}
                      strokeCap="round"
                    />
                    <Path path={shardPath} color={withAlpha(index % 2 === 0 ? '#F7FCFF' : effect.color, 0.84)} />
                    <Path path={shardPath} style="stroke" strokeWidth={1} color={withAlpha('#F6FBFF', 0.78)} />
                  </Group>
                );
              })}
            </Group>
          );
        }

        if (effect.kind === 'burst') {
          const intensity = clamp(effect.intensity ?? 1, 0.72, 1.8);
          const ringRadius = size * (0.24 + progress * 0.5) * (0.92 + intensity * 0.22);
          const innerRadius = size * (0.08 + progress * 0.16) * (0.9 + intensity * 0.16);
          const flavor = effect.flavor ?? 'neutral';
          const sparkCount =
            flavor === 'missileCommand'
              ? isHighVfx
                ? 10
                : 7
              : flavor === 'fractureCore'
                ? isHighVfx
                  ? 9
                  : 6
                : flavor === 'novaBloom'
                  ? isHighVfx
                    ? 8
                    : 6
                  : isHighVfx
                    ? 7
                    : 5;
          const adjustedSparkCount = Math.max(3, denseEffectMode ? Math.ceil(sparkCount * 0.58) : sparkCount);
          const ringColor =
            flavor === 'railFocus'
              ? '#D6E7FF'
              : flavor === 'novaBloom'
                ? '#FFD5EA'
                : flavor === 'missileCommand'
                  ? '#FFDDB2'
                  : flavor === 'fractureCore'
                    ? '#D8E7FA'
                    : flavor === 'enemy'
                      ? '#FF9E94'
                      : effect.color;
          const sparkPrimary =
            flavor === 'missileCommand'
              ? '#FFE5C4'
              : flavor === 'novaBloom'
                ? '#FFE7F4'
                : flavor === 'fractureCore'
                  ? '#F1F7FF'
                  : '#FFF5DE';
          const sparkSecondary =
            flavor === 'enemy'
              ? '#FF8C82'
              : flavor === 'missileCommand'
                ? '#FFC48C'
                : flavor === 'novaBloom'
                  ? '#FFB8DB'
                  : flavor === 'fractureCore'
                    ? '#CFE0F5'
                    : ringColor;
          return (
            <Group key={effect.id}>
              <Circle cx={effect.x} cy={effect.y} r={size * 0.56 * (0.9 + intensity * 0.2)} color={withAlpha(ringColor, 0.05 + opacity * 0.1)} />
              <Circle cx={effect.x} cy={effect.y} r={ringRadius} style="stroke" strokeWidth={(2.2 - progress * 0.8) * (0.92 + intensity * 0.16)} color={withAlpha(ringColor, 0.42 + opacity * 0.4)} />
              {!denseEffectMode ? <Circle cx={effect.x} cy={effect.y} r={innerRadius} color={withAlpha('#FFF3DA', 0.48 + opacity * 0.34)} /> : null}
              {flavor === 'missileCommand' && !denseEffectMode ? (
                <Circle
                  cx={effect.x + Math.sin(progress * Math.PI * 2 + effect.x * 0.01) * 4}
                  cy={effect.y + Math.cos(progress * Math.PI * 2 + effect.y * 0.01) * 4}
                  r={size * (0.16 + progress * 0.08)}
                  color={withAlpha('#FFB988', 0.2 + opacity * 0.24)}
                />
              ) : null}
              {Array.from({ length: adjustedSparkCount }, (_, index) => {
                const angle = (Math.PI * 2 * index) / adjustedSparkCount + effect.x * 0.013 + effect.y * 0.009;
                const sparkStart = size * (0.12 + progress * 0.2);
                const sparkEnd =
                  flavor === 'railFocus'
                    ? size * (0.34 + progress * 0.62)
                    : flavor === 'missileCommand'
                      ? size * (0.32 + progress * 0.56)
                      : size * (0.28 + progress * 0.5);
                const startX = effect.x + Math.cos(angle) * sparkStart;
                const startY = effect.y + Math.sin(angle) * sparkStart;
                const endX = effect.x + Math.cos(angle) * sparkEnd;
                const endY = effect.y + Math.sin(angle) * sparkEnd;
                return (
                  <Line
                    key={`${effect.id}-spark-${index}`}
                    p1={vec(startX, startY)}
                    p2={vec(endX, endY)}
                    color={withAlpha(index % 2 === 0 ? sparkPrimary : sparkSecondary, 0.42 + opacity * 0.34)}
                    strokeWidth={index % 2 === 0 ? 1.9 + intensity * 0.16 : 1.2 + intensity * 0.14}
                    strokeCap="round"
                  />
                );
              })}
              {flavor === 'novaBloom' && !denseEffectMode
                ? Array.from({ length: isHighVfx ? 6 : 4 }, (_, index) => {
                    const angle = (Math.PI * 2 * index) / (isHighVfx ? 6 : 4) + progress * 0.8;
                    const petalX = effect.x + Math.cos(angle) * size * (0.18 + progress * 0.18);
                    const petalY = effect.y + Math.sin(angle) * size * (0.18 + progress * 0.18);
                    return (
                      <Circle
                        key={`${effect.id}-petal-${index}`}
                        cx={petalX}
                        cy={petalY}
                        r={size * 0.06}
                        color={withAlpha('#FFE1F0', 0.35 + opacity * 0.28)}
                      />
                    );
                  })
                : null}
            </Group>
          );
        }

        if (effect.kind === 'pickup') {
          return (
            <Group key={effect.id}>
              <Circle cx={effect.x} cy={effect.y} r={size * 0.46} color={withAlpha(effect.color, 0.12 + opacity * 0.14)} />
              <Circle cx={effect.x} cy={effect.y} r={size * (0.18 + progress * 0.42)} style="stroke" strokeWidth={2} color={withAlpha('#F4FAFF', 0.42 + opacity * 0.34)} />
              <Circle cx={effect.x} cy={effect.y} r={size * 0.1} color={withAlpha('#FFF3E0', 0.68 + opacity * 0.2)} />
            </Group>
          );
        }

        return (
          <Group key={effect.id}>
            <Circle cx={effect.x} cy={effect.y} r={size * 0.5} color={withAlpha(effect.color, effect.kind === 'shield' ? 0.14 * opacity : 0.08 * opacity)} />
            <Circle cx={effect.x} cy={effect.y} r={size * 0.5} style="stroke" strokeWidth={effect.kind === 'warning' ? 2 : 1.8} color={withAlpha(effect.color, opacity)} />
          </Group>
        );
      })}

      {sampledEnemyBullets.map((bullet) => {
        const basis = getProjectileBasis(bullet.vx, bullet.vy);
        const style = bullet.enemyStyle ?? 'bolt';
        const trailLength =
          style === 'needle'
            ? bullet.size * 4.6
            : style === 'bomb'
              ? bullet.size * 2.3
              : style === 'wave'
                ? bullet.size * 3.6
                : bullet.size * 3.2;
        const tailX = bullet.x - basis.forwardX * trailLength;
        const tailY = bullet.y - basis.forwardY * trailLength;
        const boltPath = createOrientedDiamondPath(
          bullet.x,
          bullet.y,
          basis.forwardX,
          basis.forwardY,
          basis.rightX,
          basis.rightY,
          bullet.size * 0.94,
          bullet.size * 0.42
        );

        if (style === 'orb') {
          return (
            <Group key={`enemy-bullet-${bullet.id}`}>
              <Line
                p1={vec(tailX, tailY)}
                p2={vec(bullet.x - basis.forwardX * bullet.size * 0.56, bullet.y - basis.forwardY * bullet.size * 0.56)}
                color={withAlpha(bullet.color, 0.26)}
                strokeWidth={bullet.size * 0.5}
                strokeCap="round"
              />
              <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.5} color={withAlpha(bullet.color, 0.85)} />
              <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.3} color={withAlpha('#F4FFF9', 0.8)} />
            </Group>
          );
        }

        if (style === 'needle') {
          const needlePath = createOrientedRectPath(
            bullet.x,
            bullet.y,
            basis.forwardX,
            basis.forwardY,
            basis.rightX,
            basis.rightY,
            bullet.size * 1.08,
            bullet.size * 0.18
          );
          return (
            <Group key={`enemy-bullet-${bullet.id}`}>
              <Line
                p1={vec(tailX, tailY)}
                p2={vec(bullet.x - basis.forwardX * bullet.size * 0.82, bullet.y - basis.forwardY * bullet.size * 0.82)}
                color={withAlpha(bullet.color, 0.34)}
                strokeWidth={bullet.size * 0.36}
                strokeCap="round"
              />
              <Path path={needlePath} color={withAlpha(bullet.color, 0.96)} />
              <Path path={needlePath} style="stroke" strokeWidth={1} color={withAlpha('#FFF3FC', 0.86)} />
            </Group>
          );
        }

        if (style === 'bomb') {
          const bombPath = createOrientedDiamondPath(
            bullet.x,
            bullet.y,
            basis.forwardX,
            basis.forwardY,
            basis.rightX,
            basis.rightY,
            bullet.size * 0.86,
            bullet.size * 0.54
          );
          return (
            <Group key={`enemy-bullet-${bullet.id}`}>
              <Line
                p1={vec(tailX, tailY)}
                p2={vec(bullet.x - basis.forwardX * bullet.size * 0.44, bullet.y - basis.forwardY * bullet.size * 0.44)}
                color={withAlpha(bullet.color, 0.24)}
                strokeWidth={bullet.size * 0.56}
                strokeCap="round"
              />
              <Path path={bombPath} color={withAlpha(bullet.color, 0.9)} />
              <Path path={bombPath} style="stroke" strokeWidth={1.12} color={withAlpha('#FFF1DD', 0.8)} />
              <Line
                p1={vec(bullet.x - basis.rightX * bullet.size * 0.22, bullet.y - basis.rightY * bullet.size * 0.22)}
                p2={vec(bullet.x + basis.rightX * bullet.size * 0.22, bullet.y + basis.rightY * bullet.size * 0.22)}
                color={withAlpha('#FFF4E6', 0.68)}
                strokeWidth={0.9}
                strokeCap="round"
              />
            </Group>
          );
        }

        if (style === 'wave') {
          return (
            <Group key={`enemy-bullet-${bullet.id}`}>
              <Line
                p1={vec(tailX, tailY)}
                p2={vec(bullet.x - basis.forwardX * bullet.size * 0.66, bullet.y - basis.forwardY * bullet.size * 0.66)}
                color={withAlpha(bullet.color, 0.28)}
                strokeWidth={bullet.size * 0.5}
                strokeCap="round"
              />
              <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.44} color={withAlpha(bullet.color, 0.84)} />
              <Circle
                cx={bullet.x}
                cy={bullet.y}
                r={bullet.size * 0.58}
                style="stroke"
                strokeWidth={1}
                color={withAlpha('#EFFFF8', 0.5)}
              />
            </Group>
          );
        }

        return (
          <Group key={`enemy-bullet-${bullet.id}`}>
            <Line
              p1={vec(tailX, tailY)}
              p2={vec(bullet.x - basis.forwardX * bullet.size * 0.66, bullet.y - basis.forwardY * bullet.size * 0.66)}
              color={withAlpha(bullet.color, 0.3)}
              strokeWidth={bullet.size * 0.62}
              strokeCap="round"
            />
            <Line
              p1={vec(tailX, tailY)}
              p2={vec(bullet.x - basis.forwardX * bullet.size * 0.64, bullet.y - basis.forwardY * bullet.size * 0.64)}
              color={withAlpha('#FFF3E2', 0.44)}
              strokeWidth={bullet.size * 0.2}
              strokeCap="round"
            />
            <Path path={boltPath} color={bullet.color} />
            <Path path={boltPath} style="stroke" strokeWidth={1.05} color={withAlpha('#FFF3E6', 0.8)} />
            <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.18} color={withAlpha('#FFF5E7', 0.86)} />
          </Group>
        );
      })}

      {sampledPlayerBullets.map((bullet) => (
        <Group key={`player-bullet-${bullet.id}`}>
          {(() => {
            const basis = getProjectileBasis(bullet.vx, bullet.vy);
            const launchScale = 1 + Math.max(0, 0.18 - bullet.age) * 1.15;
            const sizeScale = bullet.kind === 'missile' ? 0.94 : 1;
            const renderSize = bullet.size * launchScale * sizeScale;
            const trailLength = bullet.kind === 'missile' ? renderSize * 2.8 : bullet.kind === 'shard' ? renderSize * 2.8 : renderSize * 3.9;
            const trailTailX = bullet.x - basis.forwardX * trailLength;
            const trailTailY = bullet.y - basis.forwardY * trailLength;

            if (bullet.kind === 'missile') {
              const missileBodyPath = createMissileBodyPath(
                bullet.x,
                bullet.y,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                renderSize
              );
              const missileNosePath = createMissileNosePath(
                bullet.x,
                bullet.y,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                renderSize
              );
              const missileFinLeftPath = createMissileFinPath(
                bullet.x,
                bullet.y,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                renderSize,
                -1
              );
              const missileFinRightPath = createMissileFinPath(
                bullet.x,
                bullet.y,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                renderSize,
                1
              );
              const missileCorePath = createOrientedRectPath(
                bullet.x + basis.forwardX * renderSize * 0.08,
                bullet.y + basis.forwardY * renderSize * 0.08,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                renderSize * 0.52,
                renderSize * 0.18
              );
              const missileBandPath = createOrientedRectPath(
                bullet.x - basis.forwardX * renderSize * 0.08,
                bullet.y - basis.forwardY * renderSize * 0.08,
                basis.forwardX,
                basis.forwardY,
                basis.rightX,
                basis.rightY,
                renderSize * 0.2,
                renderSize * 0.46
              );

              return (
                <>
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * renderSize * 0.84, bullet.y - basis.forwardY * renderSize * 0.84)}
                    color={withAlpha('#FFB261', 0.34)}
                    strokeWidth={renderSize * 0.58}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * renderSize * 0.9, bullet.y - basis.forwardY * renderSize * 0.9)}
                    color={withAlpha('#FFF7E9', 0.58)}
                    strokeWidth={renderSize * 0.24}
                    strokeCap="round"
                  />
                  <Path path={missileBodyPath} color={withAlpha('#E69A62', 0.98)} />
                  <Path path={missileBodyPath} style="stroke" strokeWidth={1.25} color={withAlpha('#FFEED5', 0.92)} />
                  <Path path={missileBandPath} color={withAlpha('#8A4734', 0.64)} />
                  <Path path={missileNosePath} color={withAlpha('#FFF4E1', 0.96)} />
                  <Path path={missileNosePath} style="stroke" strokeWidth={1.1} color={withAlpha('#FFFDF6', 0.9)} />
                  <Path path={missileFinLeftPath} color={withAlpha('#FFC58F', 0.94)} />
                  <Path path={missileFinRightPath} color={withAlpha('#FFC58F', 0.94)} />
                  <Path path={missileCorePath} color={withAlpha('#FFF0D2', 0.78)} />
                  <Circle
                    cx={bullet.x - basis.forwardX * renderSize * 1.04}
                    cy={bullet.y - basis.forwardY * renderSize * 1.04}
                    r={renderSize * 0.32}
                    color={withAlpha('#FFE0AA', 0.82)}
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
                renderSize * 1.36,
                renderSize * 0.62
              );
              return (
                <>
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * renderSize * 0.72, bullet.y - basis.forwardY * renderSize * 0.72)}
                    color={withAlpha('#CCE4FF', 0.36)}
                    strokeWidth={renderSize * 0.58}
                    strokeCap="round"
                  />
                  <Path path={shardPath} color={bullet.color} />
                  <Path path={shardPath} style="stroke" strokeWidth={1.1} color={withAlpha('#F2F8FF', 0.86)} />
                </>
              );
            }

            if (bullet.buildFlavor === 'fractureCore') {
              const rockRadius = renderSize * 0.56;
              const rockPulse = 0.5 + Math.sin(bullet.age * 24 + bullet.x * 0.02) * 0.5;
              return (
                <>
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * renderSize * 0.74, bullet.y - basis.forwardY * renderSize * 0.74)}
                    color={withAlpha('#DCEBFF', 0.28)}
                    strokeWidth={renderSize * 0.7}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * renderSize * 0.78, bullet.y - basis.forwardY * renderSize * 0.78)}
                    color={withAlpha('#F7FCFF', 0.34)}
                    strokeWidth={renderSize * 0.22}
                    strokeCap="round"
                  />
                  <Circle cx={bullet.x} cy={bullet.y} r={rockRadius} color={withAlpha('#9EB2C7', 0.95)} />
                  <Circle cx={bullet.x} cy={bullet.y} r={rockRadius * 0.92} style="stroke" strokeWidth={1.35} color={withAlpha('#D6E4F2', 0.84)} />
                  <Line
                    p1={vec(bullet.x - rockRadius * 0.45, bullet.y - rockRadius * 0.08)}
                    p2={vec(bullet.x + rockRadius * 0.3, bullet.y + rockRadius * 0.22)}
                    color={withAlpha('#E8F2FF', 0.66)}
                    strokeWidth={1.15}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(bullet.x - rockRadius * 0.08, bullet.y - rockRadius * 0.38)}
                    p2={vec(bullet.x + rockRadius * 0.22, bullet.y + rockRadius * 0.02)}
                    color={withAlpha('#E8F2FF', 0.62)}
                    strokeWidth={1}
                    strokeCap="round"
                  />
                  <Circle cx={bullet.x + rockRadius * 0.1} cy={bullet.y - rockRadius * 0.16} r={rockRadius * (0.14 + rockPulse * 0.06)} color={withAlpha('#F3FAFF', 0.45)} />
                </>
              );
            }

            const palette = getBuildProjectilePalette(bullet.buildFlavor);
            const boltPath =
              bullet.buildFlavor === 'railFocus'
                ? createOrientedShardPath(
                    bullet.x,
                    bullet.y,
                    basis.forwardX,
                    basis.forwardY,
                    basis.rightX,
                    basis.rightY,
                    renderSize * 1.44,
                    renderSize * 0.34
                  )
                : createOrientedDiamondPath(
                    bullet.x,
                    bullet.y,
                    basis.forwardX,
                    basis.forwardY,
                    basis.rightX,
                    basis.rightY,
                    bullet.buildFlavor === 'novaBloom' ? renderSize * 1.02 : renderSize * 1.12,
                    bullet.buildFlavor === 'novaBloom' ? renderSize * 0.5 : renderSize * 0.38
                  );
            const corePath = createOrientedRectPath(
              bullet.x + basis.forwardX * renderSize * 0.14,
              bullet.y + basis.forwardY * renderSize * 0.14,
              basis.forwardX,
              basis.forwardY,
              basis.rightX,
              basis.rightY,
              renderSize * 0.36,
              renderSize * 0.16
            );
            const haloOpacity = clamp(0.16 + Math.sin(bullet.age * 22 + bullet.x * 0.03) * 0.06, 0.1, 0.24);

            return (
              <>
                <Line
                  p1={vec(trailTailX, trailTailY)}
                  p2={vec(bullet.x - basis.forwardX * renderSize * 0.72, bullet.y - basis.forwardY * renderSize * 0.72)}
                  color={palette.trailOuter}
                  strokeWidth={renderSize * 0.84}
                  strokeCap="round"
                />
                <Line
                  p1={vec(trailTailX, trailTailY)}
                  p2={vec(bullet.x - basis.forwardX * renderSize * 0.69, bullet.y - basis.forwardY * renderSize * 0.69)}
                  color={palette.trailInner}
                  strokeWidth={renderSize * 0.3}
                  strokeCap="round"
                />
                <Circle cx={bullet.x} cy={bullet.y} r={renderSize * 0.46} color={withAlpha(palette.halo, haloOpacity)} />
                <Path path={boltPath} color={palette.body} />
                <Path path={boltPath} style="stroke" strokeWidth={1.1} color={palette.rim} />
                <Path path={corePath} color={withAlpha(palette.core, 0.82)} />
                <Circle
                  cx={bullet.x + basis.forwardX * renderSize * 0.38}
                  cy={bullet.y + basis.forwardY * renderSize * 0.38}
                  r={renderSize * 0.12}
                  color={withAlpha('#FFF8E8', 0.72)}
                />
              </>
            );
          })()}
        </Group>
      ))}

    </Canvas>
  );
}
