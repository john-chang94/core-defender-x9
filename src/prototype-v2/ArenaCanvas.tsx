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
  ARENA_PLAYER_FLOOR_OFFSET,
  ARENA_PLAYER_HEIGHT,
} from './config';
import type { ArenaBiomeDefinition, ArenaEnemy, ArenaGameState, ArenaVfxQuality } from './types';

type ArenaCanvasProps = {
  boardWidth: number;
  boardHeight: number;
  biomeDefinition: ArenaBiomeDefinition;
  state: ArenaGameState;
  vfxQuality: ArenaVfxQuality;
};

const MAX_RENDERED_EFFECTS = 40;
const MAX_RENDERED_PLAYER_BULLETS = 72;
const MAX_RENDERED_ENEMY_BULLETS = 30;

const BACKGROUND_PLATES = [
  { x: 0.08, y: -30, width: 96, height: 152, radius: 18, speed: 18 },
  { x: 0.74, y: 54, width: 110, height: 180, radius: 20, speed: 26 },
  { x: 0.42, y: 160, width: 84, height: 128, radius: 16, speed: 22 },
  { x: 0.16, y: 300, width: 120, height: 168, radius: 20, speed: 28 },
  { x: 0.68, y: 420, width: 92, height: 132, radius: 18, speed: 20 },
  { x: 0.5, y: 560, width: 124, height: 164, radius: 22, speed: 24 },
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
  { x: 0.14, y: -80, radius: 120, speed: 20 },
  { x: 0.84, y: 42, radius: 156, speed: 15 },
  { x: 0.34, y: 280, radius: 102, speed: 18 },
  { x: 0.72, y: 420, radius: 130, speed: 23 },
] as const;

const ENERGY_SWEEPS = [
  { x: 0.22, width: 52, height: 240, speed: 42 },
  { x: 0.56, width: 66, height: 290, speed: 35 },
  { x: 0.8, width: 58, height: 260, speed: 47 },
] as const;

const STARFIELD_POINTS = [
  { x: 0.06, y: 0.05, radius: 1.1, alpha: 0.54 },
  { x: 0.14, y: 0.12, radius: 0.8, alpha: 0.34 },
  { x: 0.25, y: 0.08, radius: 1.2, alpha: 0.46 },
  { x: 0.33, y: 0.18, radius: 0.9, alpha: 0.3 },
  { x: 0.42, y: 0.09, radius: 0.8, alpha: 0.32 },
  { x: 0.56, y: 0.06, radius: 1.0, alpha: 0.46 },
  { x: 0.68, y: 0.14, radius: 0.9, alpha: 0.38 },
  { x: 0.82, y: 0.07, radius: 1.3, alpha: 0.48 },
  { x: 0.9, y: 0.16, radius: 0.8, alpha: 0.28 },
  { x: 0.12, y: 0.34, radius: 0.9, alpha: 0.26 },
  { x: 0.28, y: 0.42, radius: 1.2, alpha: 0.38 },
  { x: 0.47, y: 0.3, radius: 0.8, alpha: 0.24 },
  { x: 0.62, y: 0.38, radius: 1.0, alpha: 0.34 },
  { x: 0.78, y: 0.31, radius: 0.9, alpha: 0.28 },
  { x: 0.88, y: 0.44, radius: 1.1, alpha: 0.32 },
  { x: 0.08, y: 0.66, radius: 0.9, alpha: 0.24 },
  { x: 0.24, y: 0.78, radius: 1.1, alpha: 0.3 },
  { x: 0.44, y: 0.7, radius: 0.8, alpha: 0.22 },
  { x: 0.71, y: 0.82, radius: 1.2, alpha: 0.34 },
  { x: 0.92, y: 0.74, radius: 0.9, alpha: 0.24 },
] as const;

const CYBER_PANEL_FRAMES = [
  { x: 0.03, y: 0.1, width: 0.24, height: 0.18, radius: 18 },
  { x: 0.71, y: 0.08, width: 0.22, height: 0.2, radius: 20 },
  { x: 0.12, y: 0.38, width: 0.34, height: 0.18, radius: 22 },
  { x: 0.56, y: 0.35, width: 0.29, height: 0.2, radius: 22 },
  { x: 0.05, y: 0.7, width: 0.29, height: 0.2, radius: 24 },
  { x: 0.56, y: 0.66, width: 0.28, height: 0.19, radius: 22 },
] as const;

const CYBER_TRACE_SEGMENTS = [
  { x1: 0.08, y1: 0.14, x2: 0.18, y2: 0.14, accent: 'warm' },
  { x1: 0.18, y1: 0.14, x2: 0.24, y2: 0.2, accent: 'warm' },
  { x1: 0.24, y1: 0.2, x2: 0.24, y2: 0.3, accent: 'cool' },
  { x1: 0.78, y1: 0.12, x2: 0.68, y2: 0.18, accent: 'cool' },
  { x1: 0.68, y1: 0.18, x2: 0.68, y2: 0.3, accent: 'warm' },
  { x1: 0.16, y1: 0.51, x2: 0.26, y2: 0.61, accent: 'warm' },
  { x1: 0.26, y1: 0.61, x2: 0.22, y2: 0.73, accent: 'warm' },
  { x1: 0.74, y1: 0.48, x2: 0.66, y2: 0.59, accent: 'cool' },
  { x1: 0.66, y1: 0.59, x2: 0.66, y2: 0.76, accent: 'warm' },
  { x1: 0.88, y1: 0.62, x2: 0.94, y2: 0.69, accent: 'warm' },
  { x1: 0.12, y1: 0.82, x2: 0.24, y2: 0.82, accent: 'cool' },
  { x1: 0.52, y1: 0.74, x2: 0.52, y2: 0.9, accent: 'warm' },
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

const HEX_RGB_CACHE = new Map<string, string>();
function withAlpha(color: string, alpha: number) {
  let rgb = HEX_RGB_CACHE.get(color);
  if (rgb === undefined) {
    const hex = color.startsWith('#') ? color.slice(1) : color;
    if (hex.length !== 6) return color;
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    rgb = `${r}, ${g}, ${b}`;
    HEX_RGB_CACHE.set(color, rgb);
  }
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return `rgba(${rgb}, ${a})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBuildProjectilePalette(buildFlavor: ArenaGameState['activeBuild'] | undefined) {
  if (buildFlavor === 'railFocus') {
    return {
      body: '#86DFFF',
      rim: '#E7FCFF',
      core: '#FFFFFF',
      trailOuter: withAlpha('#4BCBFF', 0.42),
      trailInner: withAlpha('#F2FEFF', 0.62),
      halo: '#8BEEFF',
    };
  }
  if (buildFlavor === 'novaBloom') {
    return {
      body: '#FF88EA',
      rim: '#FFE7FA',
      core: '#FFF7FF',
      trailOuter: withAlpha('#FF56DF', 0.42),
      trailInner: withAlpha('#FFF0FC', 0.62),
      halo: '#FF9BEE',
    };
  }
  if (buildFlavor === 'fractureCore') {
    return {
      body: '#A6B8FF',
      rim: '#EEF2FF',
      core: '#F9FBFF',
      trailOuter: withAlpha('#7F9FFF', 0.4),
      trailInner: withAlpha('#F1F4FF', 0.58),
      halo: '#C5D1FF',
    };
  }
  return {
    body: '#FFBF72',
    rim: '#FFF1D8',
    core: '#FFF8EA',
    trailOuter: withAlpha('#FF9952', 0.38),
    trailInner: withAlpha('#FFF7EB', 0.58),
    halo: '#FFD48F',
  };
}

function getUltimateScreenPalette(build: ArenaGameState['ultimateBuild']) {
  if (build === 'railFocus') {
    return {
      flash: '#3CCBFF',
      ring: '#BEEFFF',
      line: '#7DDCFF',
    };
  }
  if (build === 'novaBloom') {
    return {
      flash: '#FF79E7',
      ring: '#FFD8F6',
      line: '#FF9EF1',
    };
  }
  if (build === 'missileCommand') {
    return {
      flash: '#FFB162',
      ring: '#FFE1B5',
      line: '#FFC07A',
    };
  }
  if (build === 'fractureCore') {
    return {
      flash: '#A58FFF',
      ring: '#D7D0FF',
      line: '#AEC8FF',
    };
  }
  return {
    flash: '#42C7FF',
    ring: '#EEF5FF',
    line: '#BBD3F6',
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

function createMiniUltimateMissilePaths(
  x: number,
  y: number,
  forwardX: number,
  forwardY: number,
  size: number
) {
  const rightX = -forwardY;
  const rightY = forwardX;
  return {
    bodyPath: createMissileBodyPath(x, y, forwardX, forwardY, rightX, rightY, size),
    nosePath: createMissileNosePath(x, y, forwardX, forwardY, rightX, rightY, size),
    finLeftPath: createMissileFinPath(x, y, forwardX, forwardY, rightX, rightY, size, -1),
    finRightPath: createMissileFinPath(x, y, forwardX, forwardY, rightX, rightY, size, 1),
    corePath: createOrientedRectPath(
      x + forwardX * size * 0.04,
      y + forwardY * size * 0.04,
      forwardX,
      forwardY,
      rightX,
      rightY,
      size * 0.42,
      size * 0.14
    ),
  };
}

function createNovaSweepPath(centerX: number, boardWidth: number, boardHeight: number) {
  const nearY = Math.max(0, boardHeight - ARENA_PLAYER_HEIGHT - ARENA_PLAYER_FLOOR_OFFSET + 6);
  const farY = boardHeight * 0.01;
  const nearHalf = Math.min(54, boardWidth * 0.16);
  const farHalf = Math.max(boardWidth * 0.44, nearHalf + 92);
  const path = Skia.Path.Make();
  path.moveTo(centerX - nearHalf, nearY);
  path.lineTo(centerX + nearHalf, nearY);
  path.lineTo(centerX + farHalf, farY);
  path.lineTo(centerX - farHalf, farY);
  path.close();
  return path;
}

type EnemyLocalPoint = readonly [number, number];

// hover and orbiter are rendered as <Circle> — these stubs satisfy the Record type but are never accessed.
const CIRCLE_HULL_ENEMIES = new Set<ArenaEnemy['kind']>(['hover', 'orbiter']);

const ENEMY_HULL_POINTS: Record<ArenaEnemy['kind'], readonly EnemyLocalPoint[]> = {
  // Stubs for circle-hull enemies (never used in path construction)
  hover:    [[1, 0], [-0.5, 0.87], [-0.5, -0.87]],
  orbiter:  [[1, 0], [-0.5, 0.87], [-0.5, -0.87]],

  // Triangle — equilateral, nose forward
  burst:       [[1, 0], [-0.5, 0.87], [-0.5, -0.87]],
  // Triangle — slimmer, interceptor speed feel
  interceptor: [[1.08, 0], [-0.46, 0.76], [-0.46, -0.76]],

  // Diamond — elongated needle for sniper
  sniper: [[1.2, 0], [0, 0.32], [-0.88, 0], [0, -0.32]],
  // Diamond — wider for lancer
  lancer: [[1.02, 0], [0, 0.56], [-0.84, 0], [0, -0.56]],
  // Diamond — swept flank/pursuit silhouettes
  raider: [[1.14, 0], [0.1, 0.72], [-0.92, 0.42], [-0.54, 0], [-0.92, -0.42], [0.1, -0.72]],
  hunter: [[1.08, 0], [0.18, 0.58], [-0.72, 0.5], [-1.0, 0], [-0.72, -0.5], [0.18, -0.58]],

  // Rectangle — wide blocky tank
  tank:   [[0.9, 0.64], [0.9, -0.64], [-0.9, -0.64], [-0.9, 0.64]],
  // Square — warden support unit
  warden: [[0.76, 0.76], [0.76, -0.76], [-0.76, -0.76], [-0.76, 0.76]],

  // Pentagon — area denial / heavy
  bomber:    [[1, 0], [0.31, 0.95], [-0.81, 0.59], [-0.81, -0.59], [0.31, -0.95]],
  artillery: [[1.02, 0], [0.32, 0.94], [-0.83, 0.58], [-0.83, -0.58], [0.32, -0.94]],
  weaver:    [[1, 0], [0.31, 0.95], [-0.81, 0.59], [-0.81, -0.59], [0.31, -0.95]],

  // Hexagon — elite / complex
  carrier:   [[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]],
  conductor: [[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]],
  prismBoss: [
    [1.1, 0],
    [0.42, 0.92],
    [-0.46, 0.66],
    [-1, 0.2],
    [-1, -0.2],
    [-0.46, -0.66],
    [0.42, -0.92],
  ],
  hiveCarrierBoss: [
    [1.06, 0.24],
    [0.98, -0.24],
    [0.42, -0.88],
    [-0.18, -0.96],
    [-0.9, -0.58],
    [-1.08, 0],
    [-0.9, 0.58],
    [-0.18, 0.96],
    [0.42, 0.88],
  ],
  vectorLoomBoss: [
    [1.12, 0],
    [0.68, 0.52],
    [0.18, 1.04],
    [-0.5, 0.74],
    [-1.04, 0.18],
    [-1.04, -0.18],
    [-0.5, -0.74],
    [0.18, -1.04],
    [0.68, -0.52],
  ],
  eclipseTalonBoss: [
    [1.18, 0],
    [0.72, 0.64],
    [0.12, 0.48],
    [-0.48, 1.02],
    [-0.92, 0.32],
    [-1.1, 0],
    [-0.92, -0.32],
    [-0.48, -1.02],
    [0.12, -0.48],
    [0.72, -0.64],
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

type BarrelLine = { x1: number; y1: number; x2: number; y2: number; strokeWidth: number };

function getEnemyBarrelLines(enemy: ArenaEnemy): BarrelLine[] {
  const { forwardX, forwardY, rightX, rightY } = getEnemyBasis(enemy.aimAngle);
  const lines: BarrelLine[] = [];

  const mainHL = enemy.kind === 'sniper' ? enemy.size * 0.3 : enemy.size * 0.22;
  const mainHW = enemy.kind === 'tank' || enemy.kind === 'bomber' ? enemy.size * 0.1 : enemy.size * 0.075;
  const mainCx = enemy.x + forwardX * (enemy.size * 0.46);
  const mainCy = enemy.y + forwardY * (enemy.size * 0.46);
  lines.push({
    x1: mainCx - forwardX * mainHL,
    y1: mainCy - forwardY * mainHL,
    x2: mainCx + forwardX * mainHL,
    y2: mainCy + forwardY * mainHL,
    strokeWidth: mainHW * 2,
  });

  const hasSideBarrels =
    enemy.kind === 'bomber' ||
    enemy.kind === 'prismBoss' ||
    enemy.kind === 'hiveCarrierBoss' ||
    enemy.kind === 'vectorLoomBoss' ||
    enemy.kind === 'eclipseTalonBoss' ||
    enemy.kind === 'artillery' ||
    enemy.kind === 'interceptor';

  if (hasSideBarrels) {
    const sideOff = enemy.kind === 'prismBoss' ? enemy.size * 0.16 : enemy.size * 0.13;
    const sideHL =
      enemy.kind === 'prismBoss' ||
      enemy.kind === 'hiveCarrierBoss' ||
      enemy.kind === 'vectorLoomBoss' ||
      enemy.kind === 'eclipseTalonBoss'
        ? enemy.size * 0.18
        : enemy.size * 0.16;
    const sideSW = enemy.size * 0.052 * 2;
    const sideCDist = enemy.size * 0.4;
    for (const side of [-1, 1] as const) {
      const cx = enemy.x + forwardX * sideCDist + rightX * sideOff * side;
      const cy = enemy.y + forwardY * sideCDist + rightY * sideOff * side;
      lines.push({
        x1: cx - forwardX * sideHL,
        y1: cy - forwardY * sideHL,
        x2: cx + forwardX * sideHL,
        y2: cy + forwardY * sideHL,
        strokeWidth: sideSW,
      });
    }
  }

  return lines;
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
  theme: ArenaBiomeDefinition;
}) {
  const enemyZoneHeight = boardHeight * ARENA_ENEMY_ZONE_RATIO;
  const playerZoneHeight = boardHeight - enemyZoneHeight;

  // Decorative lane marker x-positions (5 vertical dividers)
  const laneXRatios = [0.165, 0.33, 0.5, 0.665, 0.835];

  // Diamond ring decorations centered in the player zone
  const dCx = boardWidth * 0.5;
  const dCy = enemyZoneHeight + playerZoneHeight * 0.44;
  const outerDR = Math.min(boardWidth * 0.43, playerZoneHeight * 0.38);
  const innerDR = outerDR * 0.55;
  const outerDiamond = Skia.Path.Make();
  outerDiamond.moveTo(dCx, dCy - outerDR);
  outerDiamond.lineTo(dCx + outerDR, dCy);
  outerDiamond.lineTo(dCx, dCy + outerDR);
  outerDiamond.lineTo(dCx - outerDR, dCy);
  outerDiamond.close();
  const innerDiamond = Skia.Path.Make();
  innerDiamond.moveTo(dCx, dCy - innerDR);
  innerDiamond.lineTo(dCx + innerDR, dCy);
  innerDiamond.lineTo(dCx, dCy + innerDR);
  innerDiamond.lineTo(dCx - innerDR, dCy);
  innerDiamond.close();

  return (
    <Group>
      <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={theme.base} />
      <Circle cx={boardWidth * 0.18} cy={boardHeight * 0.1} r={boardWidth * 0.28} color={theme.auraA} />
      <Circle cx={boardWidth * 0.86} cy={boardHeight * 0.86} r={boardWidth * 0.32} color={theme.auraB} />
      {/* Soft ambient glow behind player ship */}
      <Circle
        cx={boardWidth * 0.5}
        cy={boardHeight * 0.9}
        r={boardWidth * 0.4}
        color={withAlpha(theme.pulse, 0.09)}
      />
      {STARFIELD_POINTS.map((star, index) => (
        <Circle
          key={`arena-star-${index}`}
          cx={boardWidth * star.x}
          cy={boardHeight * star.y}
          r={star.radius}
          color={withAlpha(
            index % 3 === 0
              ? theme.detailColor
              : index % 2 === 0
                ? theme.flow
                : theme.glowColor,
            star.alpha
          )}
        />
      ))}
      {/* Neon lane markers — 3-layer stack for subtle glow effect */}
      {laneXRatios.map((lx, index) => (
        <Group key={`arena-lane-${index}`}>
          <Line
            p1={vec(boardWidth * lx, 0)}
            p2={vec(boardWidth * lx, boardHeight)}
            color={withAlpha('#040810', 0.55)}
            strokeWidth={6}
          />
          <Line
            p1={vec(boardWidth * lx, 0)}
            p2={vec(boardWidth * lx, boardHeight)}
            color={withAlpha(theme.flow, 0.18)}
            strokeWidth={2.8}
          />
          <Line
            p1={vec(boardWidth * lx, 0)}
            p2={vec(boardWidth * lx, boardHeight)}
            color={withAlpha(theme.flow, 0.30)}
            strokeWidth={1}
          />
        </Group>
      ))}
      <Rect x={0} y={0} width={boardWidth} height={enemyZoneHeight} color={theme.enemyZone} />
      <RoundedRect
        x={14}
        y={enemyZoneHeight}
        width={Math.max(0, boardWidth - 28)}
        height={2}
        r={999}
        color={theme.boundary}
      />
      {/* Decorative diamond ring in player zone */}
      <Path
        path={outerDiamond}
        style="stroke"
        strokeWidth={1.6}
        color={withAlpha(theme.accentColor, 0.12)}
      />
      <Path
        path={innerDiamond}
        style="stroke"
        strokeWidth={1.0}
        color={withAlpha(theme.flow, 0.14)}
      />
      {CYBER_PANEL_FRAMES.map((panel, index) => {
        const panelX = boardWidth * panel.x;
        const panelY = boardHeight * panel.y;
        const panelWidth = boardWidth * panel.width;
        const panelHeight = boardHeight * panel.height;
        const strokeColor = index % 2 === 0 ? theme.boundary : theme.headerBorder;
        return (
          <Group key={`arena-panel-${index}`}>
            <RoundedRect
              x={panelX}
              y={panelY}
              width={panelWidth}
              height={panelHeight}
              r={panel.radius}
              color={withAlpha(theme.overlay, 0.24)}
            />
            <RoundedRect
              x={panelX}
              y={panelY}
              width={panelWidth}
              height={panelHeight}
              r={panel.radius}
              style="stroke"
              strokeWidth={1.1}
              color={withAlpha(strokeColor, 0.26)}
            />
            <RoundedRect
              x={panelX + 8}
              y={panelY + 8}
              width={Math.max(0, panelWidth - 16)}
              height={Math.max(0, panelHeight - 16)}
              r={Math.max(4, panel.radius - 6)}
              style="stroke"
              strokeWidth={0.9}
              color={withAlpha(theme.grid, 0.32)}
            />
          </Group>
        );
      })}
      {CYBER_TRACE_SEGMENTS.map((segment, index) => {
        const accentColor = segment.accent === 'warm' ? theme.boundary : theme.flow;
        return (
          <Group key={`arena-trace-${index}`}>
            <Line
              p1={vec(boardWidth * segment.x1, boardHeight * segment.y1)}
              p2={vec(boardWidth * segment.x2, boardHeight * segment.y2)}
              color={withAlpha('#060A14', 0.52)}
              strokeWidth={4.0}
              strokeCap="round"
            />
            <Line
              p1={vec(boardWidth * segment.x1, boardHeight * segment.y1)}
              p2={vec(boardWidth * segment.x2, boardHeight * segment.y2)}
              color={withAlpha(accentColor, 0.46)}
              strokeWidth={1.4}
              strokeCap="round"
            />
          </Group>
        );
      })}
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
  const isBoss =
    enemy.kind === 'prismBoss' ||
    enemy.kind === 'hiveCarrierBoss' ||
    enemy.kind === 'vectorLoomBoss' ||
    enemy.kind === 'eclipseTalonBoss';
  const isElite =
    enemy.kind === 'interceptor' ||
    enemy.kind === 'carrier' ||
    enemy.kind === 'artillery' ||
    enemy.kind === 'raider' ||
    enemy.kind === 'hunter';
  const isCircleHull = CIRCLE_HULL_ENEMIES.has(enemy.kind);

  const barrelLines = getEnemyBarrelLines(enemy);
  const barrelFillOpacity = enemy.windupTimer > 0 ? 0.96 : 0.8;
  const barrelGlowOpacity = enemy.windupTimer > 0 ? 0.72 : 0.38;

  const isProtected = enemy.protectedTimer > 0;
  const strokeColor =
    enemy.windupTimer > 0
      ? '#FFF6D8'
      : isBoss
        ? '#FFF0D8'
        : isElite
          ? '#F4DFFF'
          : '#09111C';
  const auraColor =
    enemy.kind === 'hiveCarrierBoss'
      ? '#75FFE2'
      : enemy.kind === 'vectorLoomBoss'
        ? '#C5B1FF'
        : enemy.kind === 'eclipseTalonBoss'
          ? '#FFBC7B'
      : isBoss
        ? '#FF6BE1'
        : enemy.kind === 'carrier'
          ? '#77FFE0'
          : enemy.kind === 'artillery'
            ? '#FFC48D'
            : enemy.kind === 'raider'
              ? '#FF9D69'
              : enemy.kind === 'hunter'
                ? '#E3A9FF'
            : isElite
              ? '#C4AEFF'
              : enemy.color;

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
      {isProtected ? (
        <>
          <Circle cx={enemy.x} cy={enemy.y} r={enemy.size * 0.64} color={withAlpha('#9EEFFF', 0.12)} />
          <Circle cx={enemy.x} cy={enemy.y} r={enemy.size * 0.64} style="stroke" strokeWidth={2} color={withAlpha('#D9FAFF', 0.72)} />
        </>
      ) : null}
      {isCircleHull ? (
        <>
          <Circle cx={enemy.x} cy={enemy.y} r={enemy.size * 0.44} color={enemy.color} />
          <Circle cx={enemy.x} cy={enemy.y} r={enemy.size * 0.44} style="stroke" strokeWidth={1.4} color={strokeColor} />
        </>
      ) : (
        <PathOrFallback
          path={createEnemyHullPath(enemy)}
          fillColor={enemy.color}
          strokeColor={strokeColor}
          strokeWidth={isBoss ? 2.4 : isElite ? 1.8 : 1.4}
        />
      )}
      {barrelLines.map((barrel, index) => (
        <Line
          key={`enemy-barrel-${enemy.id}-${index}`}
          p1={vec(barrel.x1, barrel.y1)}
          p2={vec(barrel.x2, barrel.y2)}
          color={withAlpha('#FFE1D4', barrelFillOpacity)}
          strokeWidth={barrel.strokeWidth}
          strokeCap="round"
        />
      ))}
      {barrelLines.map((barrel, index) => (
        <Line
          key={`enemy-barrel-glow-${enemy.id}-${index}`}
          p1={vec(barrel.x1, barrel.y1)}
          p2={vec(barrel.x2, barrel.y2)}
          color={withAlpha('#FFF7FE', barrelGlowOpacity)}
          strokeWidth={barrel.strokeWidth * 0.4}
          strokeCap="round"
        />
      ))}
      <Circle cx={enemy.x} cy={enemy.y} r={enemy.size * 0.12} color={withAlpha('#FFFFFF', 0.4)} />
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

export function ArenaCanvas({ boardWidth, boardHeight, biomeDefinition, state, vfxQuality }: ArenaCanvasProps) {
  const theme = biomeDefinition;
  const themePulse = 0.5 + Math.sin(state.elapsed * 0.45) * 0.5;
  const overdriveBlend = clamp(state.overclockVisualBlend, 0, 1);
  const overdrivePulse = 0.5 + Math.sin(state.elapsed * 7.4) * 0.5;
  const isHighVfx = vfxQuality === 'high';
  // Stress is used only to scale VFX/effect budgets. Enemies use simple geometric shapes
  // (circles, triangles, diamonds, etc.) so their rendering cost is now fixed and low.
  const renderStress =
    state.enemies.length +
    Math.floor(state.playerBullets.length / 6) +
    Math.floor(state.enemyBullets.length / 8) +
    state.hazards.length * 2 +
    (state.overclockTimer > 0 ? 3 : 0) +
    (state.ultimateTimer > 0 ? 4 : 0);
  const renderBudgetScale =
    renderStress >= 34
      ? 0.52
      : renderStress >= 28
        ? 0.6
        : renderStress >= 18
          ? 0.76
          : renderStress >= 10
            ? 0.9
            : 1;
  const maxRenderedEffects = Math.max(18, Math.round((isHighVfx ? MAX_RENDERED_EFFECTS : 28) * renderBudgetScale));
  const maxRenderedPlayerBullets = Math.max(26, Math.round((isHighVfx ? MAX_RENDERED_PLAYER_BULLETS : 50) * renderBudgetScale));
  const maxRenderedEnemyBullets = Math.max(18, Math.round((isHighVfx ? MAX_RENDERED_ENEMY_BULLETS : 24) * renderBudgetScale));

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

      <Rect x={0} y={0} width={boardWidth} height={boardHeight} color={withAlpha(theme.overlay, 0.04 + themePulse * 0.04)} />
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
            const orbStyle = theme.atmosphereOrbs[index % theme.atmosphereOrbs.length] ?? theme.atmosphereOrbs[0];
            const travel = boardHeight + orb.radius * 2 + 220;
            const orbY = ((orb.y + state.elapsed * orb.speed) % travel) - orb.radius - 100;
            const orbX = boardWidth * orb.x + Math.sin(state.elapsed * 0.42 + index * 1.3) * 18;
            return (
              <Circle
                key={`orb-${index}`}
                cx={orbX}
                cy={orbY}
                r={orb.radius}
                color={withAlpha(orbStyle.color, orbStyle.opacity)}
              />
            );
          })
        : null}

      {isHighVfx
        ? ENERGY_SWEEPS.map((sweep, index) => {
            const sweepStyle = theme.energySweeps[index % theme.energySweeps.length] ?? theme.energySweeps[0];
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
                color={withAlpha(sweepStyle.color, sweepStyle.opacity)}
              />
            );
          })
        : null}

      {BACKGROUND_PLATES.map((plate, index) => {
        const plateStyle = theme.backgroundPlates[index % theme.backgroundPlates.length] ?? theme.backgroundPlates[0];
        const travel = boardHeight + plate.height + 180;
        const y = ((plate.y + state.elapsed * plate.speed) % travel) - plate.height - 80;
        const x = boardWidth * plate.x;
        return (
          <Group key={`plate-${index}`} opacity={0.9}>
            <RoundedRect
              x={x}
              y={y}
              width={plate.width}
              height={plate.height}
              r={plate.radius}
              color={withAlpha(plateStyle.color, 0.8)}
            />
            <RoundedRect
              x={x}
              y={y}
              width={plate.width}
              height={plate.height}
              r={plate.radius}
              style="stroke"
              strokeWidth={1}
              color={withAlpha(plateStyle.stroke, 0.74)}
            />
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
            color={withAlpha(theme.flow, 0.22)}
            strokeWidth={streak.width}
            strokeCap="round"
          />
        );
      })}

      {state.hazards.map((hazard) => {
        const warningProgress = clamp(hazard.age / Math.max(0.001, hazard.warningDuration), 0, 1);
        const pulse = 0.5 + Math.sin((state.elapsed + hazard.age) * 10) * 0.5;
        const activeProgress = clamp(
          (hazard.age - hazard.warningDuration) / Math.max(0.001, hazard.lingerDuration),
          0,
          1
        );
        return (
          <Group key={`hazard-${hazard.id}`}>
            {hazard.kind === 'impact' ? (
              !hazard.triggered ? (
                <>
                  <Circle
                    cx={hazard.x}
                    cy={hazard.y}
                    r={hazard.radius * (0.74 + warningProgress * 0.22 + pulse * 0.04)}
                    color={withAlpha(hazard.color, 0.12 + pulse * 0.08)}
                  />
                  <Circle
                    cx={hazard.x}
                    cy={hazard.y}
                    r={hazard.radius}
                    style="stroke"
                    strokeWidth={2}
                    color={withAlpha(hazard.accentColor, 0.5 + pulse * 0.2)}
                  />
                  <Circle
                    cx={hazard.x}
                    cy={hazard.y}
                    r={Math.max(8, hazard.radius * (0.2 + warningProgress * 0.34))}
                    color={withAlpha(hazard.accentColor, 0.12 + pulse * 0.12)}
                  />
                </>
              ) : (
                <>
                  <Circle
                    cx={hazard.x}
                    cy={hazard.y}
                    r={hazard.radius * (1 + activeProgress * 0.22)}
                    color={withAlpha(hazard.color, 0.18 * (1 - activeProgress))}
                  />
                  <Circle
                    cx={hazard.x}
                    cy={hazard.y}
                    r={hazard.radius * (0.84 + activeProgress * 0.14)}
                    style="stroke"
                    strokeWidth={3}
                    color={withAlpha(hazard.accentColor, 0.46 * (1 - activeProgress))}
                  />
                </>
              )
            ) : !hazard.triggered ? (
              <>
                <RoundedRect
                  x={hazard.x - hazard.width * 0.52}
                  y={hazard.y}
                  width={hazard.width * 1.04}
                  height={hazard.height}
                  r={hazard.width * 0.24}
                  color={withAlpha(hazard.color, 0.08 + pulse * 0.06)}
                />
                <RoundedRect
                  x={hazard.x - hazard.width / 2}
                  y={hazard.y}
                  width={hazard.width}
                  height={hazard.height}
                  r={hazard.width * 0.22}
                  style="stroke"
                  strokeWidth={2}
                  color={withAlpha(hazard.accentColor, 0.46 + pulse * 0.18)}
                />
                <RoundedRect
                  x={hazard.x - hazard.width * (0.12 + warningProgress * 0.14)}
                  y={hazard.y + hazard.height * 0.08}
                  width={hazard.width * (0.24 + warningProgress * 0.28)}
                  height={hazard.height * 0.84}
                  r={hazard.width * 0.12}
                  color={withAlpha(hazard.accentColor, 0.12 + pulse * 0.1)}
                />
              </>
            ) : (
              <>
                <RoundedRect
                  x={hazard.x - hazard.width / 2}
                  y={hazard.y}
                  width={hazard.width}
                  height={hazard.height}
                  r={hazard.width * 0.22}
                  color={withAlpha(hazard.color, 0.16 * (1 - activeProgress))}
                />
                <RoundedRect
                  x={hazard.x - hazard.width * 0.42}
                  y={hazard.y}
                  width={hazard.width * 0.84}
                  height={hazard.height}
                  r={hazard.width * 0.18}
                  style="stroke"
                  strokeWidth={3}
                  color={withAlpha(hazard.accentColor, 0.44 * (1 - activeProgress))}
                />
              </>
            )}
          </Group>
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
                const missileX = columnX - wobble * 0.2;
                const missileSize = 4.8 + ultimatePulse * 1.25;
                const driftBasis = getProjectileBasis(wobble * -0.04, -1);
                const miniMissilePaths = createMiniUltimateMissilePaths(
                  missileX,
                  bodyY + 12,
                  driftBasis.forwardX,
                  driftBasis.forwardY,
                  missileSize
                );
                return (
                  <Group key={`ultimate-missile-${index}`}>
                    <Line
                      p1={vec(columnX + wobble, boardHeight * 0.96)}
                      p2={vec(columnX - wobble * 0.2, bodyY + 16)}
                      color={withAlpha('#FFD6A8', 0.34)}
                      strokeWidth={8}
                      strokeCap="round"
                    />
                    <Path path={miniMissilePaths.bodyPath} color={withAlpha('#FFF1D2', 0.48)} />
                    <Path path={miniMissilePaths.nosePath} color={withAlpha('#FFF5E1', 0.82)} />
                    <Path path={miniMissilePaths.finLeftPath} color={withAlpha('#FFF5E1', 0.82)} />
                    <Path path={miniMissilePaths.finRightPath} color={withAlpha('#FFF5E1', 0.82)} />
                    <Path path={miniMissilePaths.corePath} color={withAlpha('#FFF5E1', 0.82)} />
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
          const missileX = effect.x + wobble;
          const driftBasis = getProjectileBasis(wobble * 0.05, -1);
          const miniMissilePaths = createMiniUltimateMissilePaths(
            missileX,
            bodyY + 8,
            driftBasis.forwardX,
            driftBasis.forwardY,
            4.35
          );
          return (
            <Group key={effect.id} opacity={opacity}>
              <Line
                p1={vec(effect.x, effect.y)}
                p2={vec(effect.x + wobble, bodyY + 14)}
                color={withAlpha(effect.color, 0.32)}
                strokeWidth={6}
                strokeCap="round"
              />
              <Path path={miniMissilePaths.bodyPath} color={withAlpha('#FFEFD3', 0.64)} />
              <Path path={miniMissilePaths.nosePath} color={withAlpha('#FFF6E7', 0.9)} />
              <Path path={miniMissilePaths.finLeftPath} color={withAlpha('#FFF6E7', 0.9)} />
              <Path path={miniMissilePaths.finRightPath} color={withAlpha('#FFF6E7', 0.9)} />
              <Path path={miniMissilePaths.corePath} color={withAlpha('#FFF6E7', 0.9)} />
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
          const shardCount = 3;
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
              ? '#88E4FF'
              : flavor === 'novaBloom'
                ? '#FF8EEB'
                : flavor === 'missileCommand'
                  ? '#FFC27D'
                  : flavor === 'fractureCore'
                    ? '#B5C8FF'
                    : flavor === 'enemy'
                      ? '#FF7E88'
                      : effect.color;
          const sparkPrimary =
            flavor === 'missileCommand'
              ? '#FFF0D8'
              : flavor === 'novaBloom'
                ? '#FFF1FE'
                : flavor === 'fractureCore'
                  ? '#F4F7FF'
                  : flavor === 'railFocus'
                    ? '#F3FEFF'
                    : '#FFF5DE';
          const sparkSecondary =
            flavor === 'enemy'
              ? '#FF616D'
              : flavor === 'missileCommand'
                ? '#FF9C61'
                : flavor === 'novaBloom'
                  ? '#FF65DD'
                  : flavor === 'fractureCore'
                    ? '#8FA3FF'
                    : flavor === 'railFocus'
                      ? '#49CFFF'
                    : ringColor;
          return (
            <Group key={effect.id}>
              <Circle cx={effect.x} cy={effect.y} r={size * 0.56 * (0.9 + intensity * 0.2)} color={withAlpha(ringColor, 0.05 + opacity * 0.1)} />
              <Circle cx={effect.x} cy={effect.y} r={ringRadius} style="stroke" strokeWidth={(2.2 - progress * 0.8) * (0.92 + intensity * 0.16)} color={withAlpha(ringColor, 0.42 + opacity * 0.4)} />
              {!denseEffectMode ? <Circle cx={effect.x} cy={effect.y} r={innerRadius} color={withAlpha('#FFF8F2', 0.48 + opacity * 0.34)} /> : null}
              {flavor === 'missileCommand' && !denseEffectMode ? (
                <Circle
                  cx={effect.x + Math.sin(progress * Math.PI * 2 + effect.x * 0.01) * 4}
                  cy={effect.y + Math.cos(progress * Math.PI * 2 + effect.y * 0.01) * 4}
                  r={size * (0.16 + progress * 0.08)}
                  color={withAlpha('#FF9B63', 0.2 + opacity * 0.24)}
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
                        color={withAlpha('#FFC6F6', 0.35 + opacity * 0.28)}
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
                color={withAlpha(bullet.color, 0.34)}
                strokeWidth={bullet.size * 0.5}
                strokeCap="round"
              />
              <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.5} color={withAlpha(bullet.color, 0.92)} />
              <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.3} color={withAlpha('#FFF7FE', 0.86)} />
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
                color={withAlpha(bullet.color, 0.42)}
                strokeWidth={bullet.size * 0.36}
                strokeCap="round"
              />
              <Path path={needlePath} color={withAlpha(bullet.color, 0.96)} />
              <Path path={needlePath} style="stroke" strokeWidth={1} color={withAlpha('#FFF7FF', 0.9)} />
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
                color={withAlpha(bullet.color, 0.3)}
                strokeWidth={bullet.size * 0.56}
                strokeCap="round"
              />
              <Path path={bombPath} color={withAlpha(bullet.color, 0.9)} />
              <Path path={bombPath} style="stroke" strokeWidth={1.12} color={withAlpha('#FFF5EF', 0.84)} />
              <Line
                p1={vec(bullet.x - basis.rightX * bullet.size * 0.22, bullet.y - basis.rightY * bullet.size * 0.22)}
                p2={vec(bullet.x + basis.rightX * bullet.size * 0.22, bullet.y + basis.rightY * bullet.size * 0.22)}
                color={withAlpha('#FFF8F2', 0.72)}
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
                color={withAlpha(bullet.color, 0.34)}
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
                color={withAlpha('#F5F8FF', 0.56)}
              />
            </Group>
          );
        }

        return (
          <Group key={`enemy-bullet-${bullet.id}`}>
            <Line
              p1={vec(tailX, tailY)}
              p2={vec(bullet.x - basis.forwardX * bullet.size * 0.66, bullet.y - basis.forwardY * bullet.size * 0.66)}
              color={withAlpha(bullet.color, 0.34)}
              strokeWidth={bullet.size * 0.62}
              strokeCap="round"
            />
            <Line
              p1={vec(tailX, tailY)}
              p2={vec(bullet.x - basis.forwardX * bullet.size * 0.64, bullet.y - basis.forwardY * bullet.size * 0.64)}
              color={withAlpha('#FFF4FA', 0.54)}
              strokeWidth={bullet.size * 0.2}
              strokeCap="round"
            />
            <Path path={boltPath} color={bullet.color} />
            <Path path={boltPath} style="stroke" strokeWidth={1.05} color={withAlpha('#FFF8FC', 0.88)} />
            <Circle cx={bullet.x} cy={bullet.y} r={bullet.size * 0.18} color={withAlpha('#FFF9FF', 0.92)} />
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
                    color={withAlpha('#FF9A54', 0.38)}
                    strokeWidth={renderSize * 0.58}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * renderSize * 0.9, bullet.y - basis.forwardY * renderSize * 0.9)}
                    color={withAlpha('#FFF8EF', 0.64)}
                    strokeWidth={renderSize * 0.24}
                    strokeCap="round"
                  />
                  <Path path={missileBodyPath} color={withAlpha('#FFB06C', 0.98)} />
                  <Path path={missileBodyPath} style="stroke" strokeWidth={1.25} color={withAlpha('#FFF0DD', 0.94)} />
                  <Path path={missileBandPath} color={withAlpha('#8C3559', 0.52)} />
                  <Path path={missileNosePath} color={withAlpha('#FFF6E8', 0.98)} />
                  <Path path={missileNosePath} style="stroke" strokeWidth={1.1} color={withAlpha('#FFFCF7', 0.92)} />
                  <Path path={missileFinLeftPath} color={withAlpha('#FFCC93', 0.96)} />
                  <Path path={missileFinRightPath} color={withAlpha('#FFCC93', 0.96)} />
                  <Path path={missileCorePath} color={withAlpha('#FFF4E3', 0.82)} />
                  <Circle
                    cx={bullet.x - basis.forwardX * renderSize * 1.04}
                    cy={bullet.y - basis.forwardY * renderSize * 1.04}
                    r={renderSize * 0.32}
                    color={withAlpha('#FFE0AA', 0.9)}
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
                    color={withAlpha('#B7C7FF', 0.34)}
                    strokeWidth={renderSize * 0.7}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(trailTailX, trailTailY)}
                    p2={vec(bullet.x - basis.forwardX * renderSize * 0.78, bullet.y - basis.forwardY * renderSize * 0.78)}
                    color={withAlpha('#F6F9FF', 0.42)}
                    strokeWidth={renderSize * 0.22}
                    strokeCap="round"
                  />
                  <Circle cx={bullet.x} cy={bullet.y} r={rockRadius} color={withAlpha('#90A8FF', 0.96)} />
                  <Circle cx={bullet.x} cy={bullet.y} r={rockRadius * 0.92} style="stroke" strokeWidth={1.35} color={withAlpha('#E6ECFF', 0.88)} />
                  <Line
                    p1={vec(bullet.x - rockRadius * 0.45, bullet.y - rockRadius * 0.08)}
                    p2={vec(bullet.x + rockRadius * 0.3, bullet.y + rockRadius * 0.22)}
                    color={withAlpha('#EEF4FF', 0.72)}
                    strokeWidth={1.15}
                    strokeCap="round"
                  />
                  <Line
                    p1={vec(bullet.x - rockRadius * 0.08, bullet.y - rockRadius * 0.38)}
                    p2={vec(bullet.x + rockRadius * 0.22, bullet.y + rockRadius * 0.02)}
                    color={withAlpha('#F2F6FF', 0.68)}
                    strokeWidth={1}
                    strokeCap="round"
                  />
                  <Circle cx={bullet.x + rockRadius * 0.1} cy={bullet.y - rockRadius * 0.16} r={rockRadius * (0.14 + rockPulse * 0.06)} color={withAlpha('#FAFCFF', 0.52)} />
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
