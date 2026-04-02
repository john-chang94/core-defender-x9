import { useEffect, useState } from 'react';
import {
  Circle,
  Group,
  Line,
  Path,
  Rect,
  RoundedRect,
  Skia,
  drawAsImage,
  type SkImage,
} from '@shopify/react-native-skia';

import { ENEMY_TYPES, TOWER_TYPES } from '@/src/game/config';
import type { EnemyShape, EffectKind, TowerTypeId } from '@/src/game/types';

const ATLAS_COLUMNS = 5;
const ATLAS_CELL_SIZE = 80;
const ATLAS_MARGIN = 16;

const ENEMY_DRAW_SIZE = 50;
const TOWER_DRAW_SIZE = 56;
const PROJECTILE_DRAW_SIZE = 28;
const EFFECT_DRAW_SIZE = 56;

export const GAME_ATLAS_SIZE = {
  width: 512,
  height: 512,
};

const SPRITE_LAYOUT = [
  ['enemy-circle', ENEMY_DRAW_SIZE],
  ['enemy-square', ENEMY_DRAW_SIZE],
  ['enemy-triangle', ENEMY_DRAW_SIZE],
  ['enemy-diamond', ENEMY_DRAW_SIZE],
  ['enemy-hexagon', ENEMY_DRAW_SIZE],
  ['tower-pulse', TOWER_DRAW_SIZE],
  ['tower-lance', TOWER_DRAW_SIZE],
  ['tower-spray', TOWER_DRAW_SIZE],
  ['tower-bomb', TOWER_DRAW_SIZE],
  ['tower-cold', TOWER_DRAW_SIZE],
  ['tower-laser', TOWER_DRAW_SIZE],
  ['projectile-pulse', PROJECTILE_DRAW_SIZE],
  ['projectile-spray', PROJECTILE_DRAW_SIZE],
  ['projectile-lance', PROJECTILE_DRAW_SIZE],
  ['projectile-bomb', PROJECTILE_DRAW_SIZE],
  ['projectile-cold', PROJECTILE_DRAW_SIZE],
  ['effect-hit', EFFECT_DRAW_SIZE],
  ['effect-spawn', EFFECT_DRAW_SIZE],
  ['effect-muzzle', EFFECT_DRAW_SIZE],
  ['effect-burst', EFFECT_DRAW_SIZE],
  ['effect-splash', EFFECT_DRAW_SIZE],
  ['effect-chill', EFFECT_DRAW_SIZE],
  ['effect-shock', EFFECT_DRAW_SIZE],
  ['effect-place', EFFECT_DRAW_SIZE],
  ['effect-upgrade', EFFECT_DRAW_SIZE],
  ['effect-sell', EFFECT_DRAW_SIZE],
] as const;

export type GameSpriteId = (typeof SPRITE_LAYOUT)[number][0];

export type AtlasFrameDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
  nominalSize: number;
  rect: ReturnType<typeof Skia.XYWHRect>;
};

function createFrame(index: number, nominalSize: number): AtlasFrameDefinition {
  const col = index % ATLAS_COLUMNS;
  const row = Math.floor(index / ATLAS_COLUMNS);
  const x = ATLAS_MARGIN + col * ATLAS_CELL_SIZE;
  const y = ATLAS_MARGIN + row * ATLAS_CELL_SIZE;

  return {
    x,
    y,
    width: ATLAS_CELL_SIZE,
    height: ATLAS_CELL_SIZE,
    nominalSize,
    rect: Skia.XYWHRect(x, y, ATLAS_CELL_SIZE, ATLAS_CELL_SIZE),
  };
}

export const GAME_ATLAS_FRAMES = Object.fromEntries(
  SPRITE_LAYOUT.map(([spriteId, nominalSize], index) => [spriteId, createFrame(index, nominalSize)])
) as Record<GameSpriteId, AtlasFrameDefinition>;

export const ENEMY_SPRITE_BY_SHAPE: Record<EnemyShape, GameSpriteId> = {
  circle: 'enemy-circle',
  square: 'enemy-square',
  triangle: 'enemy-triangle',
  diamond: 'enemy-diamond',
  hexagon: 'enemy-hexagon',
};

export const TOWER_SPRITE_BY_TYPE: Record<TowerTypeId, GameSpriteId> = {
  pulse: 'tower-pulse',
  lance: 'tower-lance',
  spray: 'tower-spray',
  bomb: 'tower-bomb',
  cold: 'tower-cold',
  laser: 'tower-laser',
};

export const PROJECTILE_SPRITE_BY_TOWER: Partial<Record<TowerTypeId, GameSpriteId>> = {
  pulse: 'projectile-pulse',
  spray: 'projectile-spray',
  lance: 'projectile-lance',
  bomb: 'projectile-bomb',
  cold: 'projectile-cold',
};

export const EFFECT_SPRITE_BY_KIND: Record<EffectKind, GameSpriteId> = {
  hit: 'effect-hit',
  spawn: 'effect-spawn',
  muzzle: 'effect-muzzle',
  burst: 'effect-burst',
  splash: 'effect-splash',
  chill: 'effect-chill',
  shock: 'effect-shock',
  place: 'effect-place',
  upgrade: 'effect-upgrade',
  sell: 'effect-sell',
};

function createTrianglePath(cx: number, cy: number, size: number) {
  const half = size / 2;
  const path = Skia.Path.Make();
  path.moveTo(cx, cy - half);
  path.lineTo(cx - half, cy + half);
  path.lineTo(cx + half, cy + half);
  path.close();
  return path;
}

function createRegularPolygonPath(
  cx: number,
  cy: number,
  sides: number,
  radius: number,
  rotationRadians = 0
) {
  const path = Skia.Path.Make();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotationRadians + (Math.PI * 2 * index) / sides - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.close();
  return path;
}

function createSpearPath(cx: number, cy: number, size: number) {
  const half = size / 2;
  const path = Skia.Path.Make();
  path.moveTo(cx, cy - half * 1.2);
  path.lineTo(cx - half * 0.34, cy + half);
  path.lineTo(cx + half * 0.34, cy + half);
  path.close();
  return path;
}

function createDiamondBombPath(cx: number, cy: number, size: number) {
  const outer = size / 2;
  const inner = outer * 0.45;
  const path = Skia.Path.Make();
  path.moveTo(cx, cy - outer);
  path.lineTo(cx - inner, cy - inner);
  path.lineTo(cx - outer, cy);
  path.lineTo(cx - inner, cy + inner);
  path.lineTo(cx, cy + outer);
  path.lineTo(cx + inner, cy + inner);
  path.lineTo(cx + outer, cy);
  path.lineTo(cx + inner, cy - inner);
  path.close();
  return path;
}

function SpriteCell({
  spriteId,
  children,
}: {
  spriteId: GameSpriteId;
  children: (centerX: number, centerY: number, nominalSize: number) => React.ReactNode;
}) {
  const frame = GAME_ATLAS_FRAMES[spriteId];
  return <>{children(frame.x + frame.width / 2, frame.y + frame.height / 2, frame.nominalSize)}</>;
}

function EnemySprite({
  spriteId,
  shape,
  color,
}: {
  spriteId: GameSpriteId;
  shape: EnemyShape;
  color: string;
}) {
  return (
    <SpriteCell spriteId={spriteId}>
      {(cx, cy, size) => {
        const half = size / 2;
        const left = cx - half;
        const top = cy - half;
        const trianglePath = shape === 'triangle' ? createTrianglePath(cx, cy, size) : null;
        const diamondPath = shape === 'diamond' ? createRegularPolygonPath(cx, cy, 4, half, Math.PI / 4) : null;
        const hexPath = shape === 'hexagon' ? createRegularPolygonPath(cx, cy, 6, half, Math.PI / 6) : null;

        return (
          <Group>
            <Circle cx={cx} cy={cy} r={half * 0.78} color="rgba(255, 255, 255, 0.1)" />
            {shape === 'circle' ? <Circle cx={cx} cy={cy} r={half * 0.78} color={color} /> : null}
            {shape === 'square' ? <Rect x={left} y={top} width={size} height={size} color={color} /> : null}
            {shape === 'triangle' && trianglePath ? <Path path={trianglePath} color={color} /> : null}
            {shape === 'diamond' && diamondPath ? <Path path={diamondPath} color={color} /> : null}
            {shape === 'hexagon' && hexPath ? <Path path={hexPath} color={color} /> : null}
            {shape === 'circle' ? (
              <Circle cx={cx} cy={cy} r={half * 0.34} color="rgba(255, 255, 255, 0.15)" />
            ) : (
              <RoundedRect
                x={cx - size * 0.18}
                y={cy - size * 0.18}
                width={size * 0.36}
                height={size * 0.36}
                r={size * 0.08}
                color="rgba(255, 255, 255, 0.12)"
              />
            )}
          </Group>
        );
      }}
    </SpriteCell>
  );
}

function DefaultTowerBody({
  cx,
  cy,
  size,
  color,
  barrelColor = '#DCEBFF',
}: {
  cx: number;
  cy: number;
  size: number;
  color: string;
  barrelColor?: string;
}) {
  const bodyRadius = size * 0.44;
  const barrelWidth = size * 0.2;
  const barrelHeight = size * 0.34;

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={bodyRadius} color={color} />
      <Circle cx={cx} cy={cy} r={bodyRadius} style="stroke" strokeWidth={2} color="#0D1420" />
      <Circle cx={cx} cy={cy} r={size * 0.18} color="rgba(255, 255, 255, 0.12)" />
      <RoundedRect
        x={cx - barrelWidth / 2}
        y={cy - size * 0.48}
        width={barrelWidth}
        height={barrelHeight}
        r={size * 0.08}
        color={barrelColor}
      />
      <RoundedRect
        x={cx - barrelWidth / 2}
        y={cy - size * 0.48}
        width={barrelWidth}
        height={barrelHeight}
        r={size * 0.08}
        style="stroke"
        strokeWidth={1.2}
        color="#122133"
      />
    </Group>
  );
}

function TowerSprite({ towerType }: { towerType: TowerTypeId }) {
  const spriteId = TOWER_SPRITE_BY_TYPE[towerType];
  const color = TOWER_TYPES[towerType].color;

  return (
    <SpriteCell spriteId={spriteId}>
      {(cx, cy, size) => {
        const lancePath = createTrianglePath(cx, cy - size * 0.06, size * 0.68);
        const bombCore = createRegularPolygonPath(cx, cy, 6, size * 0.25, Math.PI / 6);
        const laserCore = createRegularPolygonPath(cx, cy, 8, size * 0.28, Math.PI / 8);

        return (
          <Group>
            <Circle cx={cx} cy={cy} r={size * 0.5} color="rgba(0, 0, 0, 0.28)" />
            {towerType === 'lance' ? (
              <Group>
                <RoundedRect
                  x={cx - size * 0.11}
                  y={cy + size * 0.04}
                  width={size * 0.22}
                  height={size * 0.34}
                  r={size * 0.07}
                  color="#BFD3F4"
                />
                <Path path={lancePath} color={color} />
                <Path path={lancePath} style="stroke" strokeWidth={1.4} color="#0D1420" />
              </Group>
            ) : null}
            {towerType === 'pulse' ? <DefaultTowerBody cx={cx} cy={cy} size={size} color={color} /> : null}
            {towerType === 'spray' ? (
              <Group>
                <RoundedRect
                  x={cx - size * 0.29}
                  y={cy - size * 0.23}
                  width={size * 0.58}
                  height={size * 0.5}
                  r={size * 0.12}
                  color={color}
                />
                <RoundedRect
                  x={cx - size * 0.1}
                  y={cy - size * 0.48}
                  width={size * 0.2}
                  height={size * 0.28}
                  r={size * 0.08}
                  color="#DCEBFF"
                />
                <RoundedRect
                  x={cx - size * 0.29}
                  y={cy - size * 0.23}
                  width={size * 0.58}
                  height={size * 0.5}
                  r={size * 0.12}
                  style="stroke"
                  strokeWidth={1.4}
                  color="#0D1420"
                />
              </Group>
            ) : null}
            {towerType === 'bomb' ? (
              <Group>
                <DefaultTowerBody cx={cx} cy={cy} size={size} color={color} barrelColor="#FFE8BD" />
                <Path path={bombCore} color="rgba(255, 255, 255, 0.14)" />
              </Group>
            ) : null}
            {towerType === 'cold' ? (
              <Group>
                <DefaultTowerBody cx={cx} cy={cy} size={size} color={color} barrelColor="#F4FCFF" />
                <Line
                  p1={Skia.Point(cx - size * 0.24, cy)}
                  p2={Skia.Point(cx + size * 0.24, cy)}
                  color="rgba(255, 255, 255, 0.35)"
                  strokeWidth={1.4}
                  strokeCap="round"
                />
                <Line
                  p1={Skia.Point(cx, cy - size * 0.24)}
                  p2={Skia.Point(cx, cy + size * 0.24)}
                  color="rgba(255, 255, 255, 0.35)"
                  strokeWidth={1.4}
                  strokeCap="round"
                />
              </Group>
            ) : null}
            {towerType === 'laser' ? (
              <Group>
                <Path path={laserCore} color={color} />
                <Path path={laserCore} style="stroke" strokeWidth={1.4} color="#0D1420" />
                <RoundedRect
                  x={cx - size * 0.09}
                  y={cy - size * 0.52}
                  width={size * 0.18}
                  height={size * 0.38}
                  r={size * 0.08}
                  color="#FFD4F5"
                />
                <RoundedRect
                  x={cx - size * 0.09}
                  y={cy - size * 0.52}
                  width={size * 0.18}
                  height={size * 0.38}
                  r={size * 0.08}
                  style="stroke"
                  strokeWidth={1.2}
                  color="#1A0F1D"
                />
                <Circle cx={cx} cy={cy} r={size * 0.15} color="rgba(255, 255, 255, 0.16)" />
              </Group>
            ) : null}
          </Group>
        );
      }}
    </SpriteCell>
  );
}

function ProjectileSprite({ spriteId }: { spriteId: GameSpriteId }) {
  return (
    <SpriteCell spriteId={spriteId}>
      {(cx, cy, size) => {
        const lancePath = createSpearPath(cx, cy, size);
        const bombPath = createDiamondBombPath(cx, cy, size * 1.2);
        const projectileColor =
          spriteId === 'projectile-pulse'
            ? TOWER_TYPES.pulse.color
            : spriteId === 'projectile-spray'
              ? TOWER_TYPES.spray.color
              : spriteId === 'projectile-lance'
                ? TOWER_TYPES.lance.color
                : spriteId === 'projectile-bomb'
                  ? TOWER_TYPES.bomb.color
                  : TOWER_TYPES.cold.color;

        return (
          <Group>
            <Circle cx={cx} cy={cy} r={size * 0.62} color="rgba(255, 255, 255, 0.1)" />
            {spriteId === 'projectile-pulse' ? (
              <>
                <Circle cx={cx} cy={cy} r={size * 0.36} color={projectileColor} />
                <Circle cx={cx} cy={cy} r={size * 0.18} color="rgba(255, 255, 255, 0.28)" />
              </>
            ) : null}
            {spriteId === 'projectile-spray' ? (
              <>
                <RoundedRect
                  x={cx - size * 0.13}
                  y={cy - size * 0.45}
                  width={size * 0.26}
                  height={size * 0.9}
                  r={size * 0.08}
                  color={projectileColor}
                />
                <RoundedRect
                  x={cx - size * 0.13}
                  y={cy - size * 0.45}
                  width={size * 0.26}
                  height={size * 0.9}
                  r={size * 0.08}
                  style="stroke"
                  strokeWidth={1}
                  color="#0F1826"
                />
              </>
            ) : null}
            {spriteId === 'projectile-lance' ? (
              <>
                <Path path={lancePath} color={projectileColor} />
                <Path path={lancePath} style="stroke" strokeWidth={1} color="#0F1826" />
              </>
            ) : null}
            {spriteId === 'projectile-bomb' ? (
              <>
                <Path path={bombPath} color={projectileColor} />
                <Path path={bombPath} style="stroke" strokeWidth={1} color="#151E2D" />
              </>
            ) : null}
            {spriteId === 'projectile-cold' ? (
              <>
                <Line
                  p1={Skia.Point(cx - size * 0.5, cy)}
                  p2={Skia.Point(cx + size * 0.5, cy)}
                  color="#E8FAFF"
                  strokeWidth={1.3}
                  strokeCap="round"
                />
                <Line
                  p1={Skia.Point(cx, cy - size * 0.5)}
                  p2={Skia.Point(cx, cy + size * 0.5)}
                  color="#E8FAFF"
                  strokeWidth={1.3}
                  strokeCap="round"
                />
                <Line
                  p1={Skia.Point(cx - size * 0.34, cy - size * 0.34)}
                  p2={Skia.Point(cx + size * 0.34, cy + size * 0.34)}
                  color="#E8FAFF"
                  strokeWidth={1.1}
                  strokeCap="round"
                />
                <Line
                  p1={Skia.Point(cx - size * 0.34, cy + size * 0.34)}
                  p2={Skia.Point(cx + size * 0.34, cy - size * 0.34)}
                  color="#E8FAFF"
                  strokeWidth={1.1}
                  strokeCap="round"
                />
                <Circle cx={cx} cy={cy} r={size * 0.18} color={projectileColor} />
              </>
            ) : null}
          </Group>
        );
      }}
    </SpriteCell>
  );
}

function BurstSprite({
  spriteId,
  innerColor,
  ringColor,
  spokeColor,
  spokeCount,
}: {
  spriteId: GameSpriteId;
  innerColor: string;
  ringColor: string;
  spokeColor: string;
  spokeCount: number;
}) {
  return (
    <SpriteCell spriteId={spriteId}>
      {(cx, cy, size) => {
        const outerRadius = size * 0.46;
        const innerRadius = size * 0.2;

        return (
          <Group>
            <Circle cx={cx} cy={cy} r={outerRadius} color={innerColor} />
            <Circle cx={cx} cy={cy} r={outerRadius} style="stroke" strokeWidth={2} color={ringColor} />
            <Circle cx={cx} cy={cy} r={innerRadius} color="rgba(255, 255, 255, 0.16)" />
            {Array.from({ length: spokeCount }, (_, index) => {
              const angle = (Math.PI * 2 * index) / spokeCount;
              return (
                <Line
                  key={`${spriteId}-spoke-${index}`}
                  p1={Skia.Point(cx + Math.cos(angle) * (size * 0.16), cy + Math.sin(angle) * (size * 0.16))}
                  p2={Skia.Point(cx + Math.cos(angle) * (size * 0.56), cy + Math.sin(angle) * (size * 0.56))}
                  color={spokeColor}
                  strokeWidth={1.3}
                  strokeCap="round"
                />
              );
            })}
          </Group>
        );
      }}
    </SpriteCell>
  );
}

function SpriteAtlasScene() {
  return (
    <Group>
      <EnemySprite spriteId="enemy-circle" shape="circle" color={ENEMY_TYPES.spark.color} />
      <EnemySprite spriteId="enemy-square" shape="square" color={ENEMY_TYPES.block.color} />
      <EnemySprite spriteId="enemy-triangle" shape="triangle" color={ENEMY_TYPES.spike.color} />
      <EnemySprite spriteId="enemy-diamond" shape="diamond" color={ENEMY_TYPES.crusher.color} />
      <EnemySprite spriteId="enemy-hexagon" shape="hexagon" color={ENEMY_TYPES.hex.color} />

      <TowerSprite towerType="pulse" />
      <TowerSprite towerType="lance" />
      <TowerSprite towerType="spray" />
      <TowerSprite towerType="bomb" />
      <TowerSprite towerType="cold" />
      <TowerSprite towerType="laser" />

      <ProjectileSprite spriteId="projectile-pulse" />
      <ProjectileSprite spriteId="projectile-spray" />
      <ProjectileSprite spriteId="projectile-lance" />
      <ProjectileSprite spriteId="projectile-bomb" />
      <ProjectileSprite spriteId="projectile-cold" />

      <BurstSprite
        spriteId="effect-hit"
        innerColor="rgba(255, 210, 125, 0.26)"
        ringColor="rgba(255, 219, 150, 0.92)"
        spokeColor="rgba(255, 226, 165, 0.95)"
        spokeCount={6}
      />
      <BurstSprite
        spriteId="effect-spawn"
        innerColor="rgba(125, 235, 255, 0.16)"
        ringColor="rgba(125, 235, 255, 0.72)"
        spokeColor="rgba(168, 245, 255, 0.86)"
        spokeCount={5}
      />
      <BurstSprite
        spriteId="effect-muzzle"
        innerColor="rgba(255, 243, 181, 0.24)"
        ringColor="rgba(255, 247, 212, 0.86)"
        spokeColor="rgba(255, 247, 212, 0.95)"
        spokeCount={4}
      />
      <BurstSprite
        spriteId="effect-burst"
        innerColor="rgba(255, 210, 127, 0.24)"
        ringColor="rgba(255, 212, 127, 0.84)"
        spokeColor="rgba(255, 214, 145, 0.92)"
        spokeCount={8}
      />
      <BurstSprite
        spriteId="effect-splash"
        innerColor="rgba(255, 156, 101, 0.18)"
        ringColor="rgba(255, 171, 128, 0.84)"
        spokeColor="rgba(255, 184, 150, 0.88)"
        spokeCount={7}
      />
      <BurstSprite
        spriteId="effect-chill"
        innerColor="rgba(142, 235, 255, 0.18)"
        ringColor="rgba(142, 235, 255, 0.82)"
        spokeColor="rgba(219, 248, 255, 0.94)"
        spokeCount={6}
      />
      <BurstSprite
        spriteId="effect-shock"
        innerColor="rgba(255, 94, 149, 0.18)"
        ringColor="rgba(255, 109, 168, 0.84)"
        spokeColor="rgba(255, 151, 192, 0.9)"
        spokeCount={6}
      />
      <BurstSprite
        spriteId="effect-place"
        innerColor="rgba(137, 255, 184, 0.18)"
        ringColor="rgba(137, 255, 184, 0.82)"
        spokeColor="rgba(198, 255, 220, 0.9)"
        spokeCount={5}
      />
      <BurstSprite
        spriteId="effect-upgrade"
        innerColor="rgba(141, 184, 255, 0.18)"
        ringColor="rgba(141, 184, 255, 0.82)"
        spokeColor="rgba(214, 228, 255, 0.9)"
        spokeCount={6}
      />
      <BurstSprite
        spriteId="effect-sell"
        innerColor="rgba(255, 155, 155, 0.16)"
        ringColor="rgba(255, 155, 155, 0.8)"
        spokeColor="rgba(255, 210, 210, 0.86)"
        spokeCount={5}
      />
    </Group>
  );
}

export function useGameSpriteAtlas(): SkImage | null {
  const [atlasImage, setAtlasImage] = useState<SkImage | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAtlas = async () => {
      try {
        const nextImage = await drawAsImage(<SpriteAtlasScene />, GAME_ATLAS_SIZE);
        if (!cancelled) {
          setAtlasImage(nextImage);
        }
      } catch (error) {
        console.warn('Failed to generate sprite atlas', error);
      }
    };

    void loadAtlas();

    return () => {
      cancelled = true;
    };
  }, []);

  return atlasImage;
}
