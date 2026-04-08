import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  ARENA_ENEMY_ZONE_RATIO,
  ARENA_FIXED_STEP_SECONDS,
  ARENA_MAX_CATCH_UP_STEPS,
  ARENA_MAX_FRAME_DELTA_SECONDS,
  ARENA_PLAYER_HALF_WIDTH,
  ARENA_PLAYER_HEIGHT,
  ARENA_PLAYER_MARGIN,
  ARENA_PLAYER_RENDER_HALF_WIDTH,
} from './config';
import { createInitialArenaState, getArenaActiveEnemyCap, getArenaDisplayTier, tickArenaState } from './engine';
import type { ArenaEffect, ArenaEnemy, ArenaProjectile } from './types';

type AppGameId = 'defender' | 'prototype' | 'prototypeV2';

type ArenaPrototypeScreenProps = {
  onSwitchGame: (game: AppGameId) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hexColor: string, alpha: number) {
  const normalizedHex = hexColor.replace('#', '');
  if (normalizedHex.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getPlayerShipTop(boardHeight: number) {
  return Math.max(0, boardHeight - ARENA_PLAYER_HEIGHT - 14);
}

function BackgroundGrid({ width, height }: { width: number; height: number }) {
  const verticalLines = useMemo(() => {
    const lineCount = Math.max(6, Math.floor(width / 62));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * width) / (lineCount + 1));
  }, [width]);
  const horizontalLines = useMemo(() => {
    const lineCount = Math.max(5, Math.floor(height / 62));
    return Array.from({ length: lineCount }, (_, index) => ((index + 1) * height) / (lineCount + 1));
  }, [height]);
  const enemyZoneHeight = height * ARENA_ENEMY_ZONE_RATIO;

  return (
    <>
      <View style={arenaStyles.bgFill} />
      <View style={arenaStyles.bgHazeTop} />
      <View style={arenaStyles.bgHazeBottom} />
      <View style={[arenaStyles.enemyZoneFill, { height: enemyZoneHeight }]} />
      <View style={[arenaStyles.enemyZoneLine, { top: enemyZoneHeight }]} />
      {verticalLines.map((x, index) => (
        <View key={`arena-grid-v-${index}`} pointerEvents="none" style={[arenaStyles.gridLine, { left: x, top: 0, bottom: 0, width: 1 }]} />
      ))}
      {horizontalLines.map((y, index) => (
        <View key={`arena-grid-h-${index}`} pointerEvents="none" style={[arenaStyles.gridLine, { top: y, left: 0, right: 0, height: 1 }]} />
      ))}
    </>
  );
}

function EnemyNode({ enemy }: { enemy: ArenaEnemy }) {
  const isCircle = enemy.shape === 'circle';
  const isDiamond = enemy.shape === 'diamond';

  return (
    <View
      pointerEvents="none"
      style={[
        arenaStyles.enemyBody,
        {
          width: enemy.size,
          height: enemy.size,
          left: enemy.x - enemy.size / 2,
          top: enemy.y - enemy.size / 2,
          backgroundColor: enemy.color,
          borderRadius: isCircle ? enemy.size / 2 : 12,
          transform: [{ scale: enemy.flash > 0 ? 1.05 : 1 }, ...(isDiamond ? [{ rotate: '45deg' as const }] : [])],
          borderColor: enemy.windupTimer > 0 ? '#FFF0C7' : '#0D1726',
          borderWidth: enemy.windupTimer > 0 ? 2.1 : 1.4,
        },
      ]}>
      {enemy.windupTimer > 0 ? (
        <View
          style={[
            arenaStyles.enemyWarningRing,
            {
              width: enemy.size * 1.32,
              height: enemy.size * 1.32,
              borderRadius: enemy.size,
              left: -(enemy.size * 0.16),
              top: -(enemy.size * 0.16),
            },
          ]}
        />
      ) : null}
      <View style={[arenaStyles.enemyContent, isDiamond && { transform: [{ rotate: '-45deg' }] }]}>
        <Text style={[arenaStyles.enemyHealthText, enemy.maxHealth >= 100 && arenaStyles.enemyHealthTextCompact]}>
          {enemy.health}
        </Text>
      </View>
    </View>
  );
}

function ProjectileNode({ projectile }: { projectile: ArenaProjectile }) {
  if (projectile.owner === 'enemy') {
    return (
      <View
        pointerEvents="none"
        style={[
          arenaStyles.enemyProjectile,
          {
            width: projectile.size,
            height: projectile.size,
            left: projectile.x - projectile.size / 2,
            top: projectile.y - projectile.size / 2,
            backgroundColor: projectile.color,
          },
        ]}
      />
    );
  }

  const trailHeight = projectile.size * 2.3;
  return (
    <View
      pointerEvents="none"
      style={[
        arenaStyles.playerProjectileShell,
        {
          left: projectile.x - projectile.size / 2,
          top: projectile.y - trailHeight,
          width: projectile.size,
          height: trailHeight,
        },
      ]}>
      <View
        style={[
          arenaStyles.playerProjectile,
          {
            width: projectile.size,
            height: trailHeight,
            borderRadius: projectile.size,
            backgroundColor: projectile.color,
          },
        ]}
      />
    </View>
  );
}

function EffectNode({ effect }: { effect: ArenaEffect }) {
  const progress = effect.age / effect.duration;
  const opacity = 1 - progress;
  const size = effect.size * (0.68 + progress * 0.62);

  if (effect.kind === 'muzzle') {
    return (
      <View
        pointerEvents="none"
        style={[
          arenaStyles.effectMuzzle,
          {
            width: effect.size * 0.42,
            height: effect.size,
            left: effect.x - effect.size * 0.21,
            top: effect.y - effect.size,
            opacity,
            backgroundColor: effect.color,
          },
        ]}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        effect.kind === 'warning' ? arenaStyles.effectWarning : effect.kind === 'shield' ? arenaStyles.effectShield : arenaStyles.effectBurst,
        {
          width: size,
          height: size,
          left: effect.x - size / 2,
          top: effect.y - size / 2,
          opacity,
          borderColor: effect.color,
          backgroundColor: effect.kind === 'warning' ? 'transparent' : hexToRgba(effect.color, effect.kind === 'shield' ? 0.14 : 0.08),
        },
      ]}
    />
  );
}

export function ArenaPrototypeScreen({ onSwitchGame }: ArenaPrototypeScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortraitViewport = windowHeight >= windowWidth;
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [gameState, setGameState] = useState(() => createInitialArenaState(900));
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasInitializedBoardRef = useRef(false);

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    if (!hasInitializedBoardRef.current) {
      hasInitializedBoardRef.current = true;
      setGameState(createInitialArenaState(boardSize.width));
      setHasStarted(false);
      setIsPaused(true);
      return;
    }

    setGameState((previousState) => ({
      ...previousState,
      playerX: clamp(previousState.playerX, ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN, boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN),
      enemies: previousState.enemies.map((enemy) => ({
        ...enemy,
        x: clamp(enemy.x, enemy.size / 2 + 8, boardSize.width - enemy.size / 2 - 8),
      })),
    }));
  }, [boardSize.height, boardSize.width]);

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    let animationFrameId = 0;
    let lastFrameTimeMs = 0;
    let accumulatedSimulationSeconds = 0;

    const frame = (timeMs: number) => {
      if (lastFrameTimeMs === 0) {
        lastFrameTimeMs = timeMs;
        animationFrameId = requestAnimationFrame(frame);
        return;
      }

      const elapsedSeconds = Math.min((timeMs - lastFrameTimeMs) / 1000, ARENA_MAX_FRAME_DELTA_SECONDS);
      lastFrameTimeMs = timeMs;

      if (hasStarted && !isPaused) {
        accumulatedSimulationSeconds += elapsedSeconds;
        const steps = Math.min(ARENA_MAX_CATCH_UP_STEPS, Math.floor(accumulatedSimulationSeconds / ARENA_FIXED_STEP_SECONDS));
        if (steps > 0) {
          accumulatedSimulationSeconds -= steps * ARENA_FIXED_STEP_SECONDS;
          setGameState((previousState) => {
            if (previousState.status !== 'running') {
              return previousState;
            }

            let nextState = previousState;
            for (let index = 0; index < steps; index += 1) {
              if (nextState.status !== 'running') {
                break;
              }
              nextState = tickArenaState(nextState, ARENA_FIXED_STEP_SECONDS, boardSize.width, boardSize.height);
            }
            return nextState;
          });
        }
      }

      animationFrameId = requestAnimationFrame(frame);
    };

    animationFrameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [boardSize.height, boardSize.width, hasStarted, isPaused]);

  useEffect(() => {
    if (gameState.status === 'lost') {
      setIsPaused(true);
    }
  }, [gameState.status]);

  const displayTier = getArenaDisplayTier(gameState.elapsed);
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const statusText =
    !hasStarted
      ? 'Press Start to deploy the arena test.'
      : gameState.status === 'lost'
        ? 'Hull collapse. Restart to run again.'
        : isPaused
          ? 'Arena Prototype paused.'
          : `Enemies hold the upper half. Keep the hull intact.`;

  const handleBoardTouch = (event: GestureResponderEvent) => {
    if (boardSize.width <= 0 || boardSize.height <= 0 || isMenuOpen || !hasStarted || isPaused || gameState.status !== 'running') {
      return;
    }

    const localX = event.nativeEvent.locationX;
    setGameState((previousState) => ({
      ...previousState,
      playerX: clamp(localX, ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN, boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN),
    }));
  };

  const handleBoardLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextWidth !== boardSize.width || nextHeight !== boardSize.height) {
      setBoardSize({ width: nextWidth, height: nextHeight });
    }
  };

  const handleRestart = () => {
    if (boardSize.width <= 0) {
      return;
    }
    setGameState(createInitialArenaState(boardSize.width));
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
  };

  const playerTop = getPlayerShipTop(boardSize.height);
  const playerStyle = {
    left: gameState.playerX - ARENA_PLAYER_RENDER_HALF_WIDTH,
    top: playerTop,
  };
  const hullRatio = gameState.hull / gameState.maxHull;

  return (
    <SafeAreaView style={[arenaStyles.container, isPortraitViewport && arenaStyles.containerPortrait]}>
      <View style={arenaStyles.topBar}>
        <Pressable
          onPress={() => {
            if (!hasStarted) {
              setHasStarted(true);
              setIsPaused(false);
              return;
            }
            if (gameState.status === 'lost') {
              handleRestart();
              return;
            }
            setIsPaused((previousValue) => !previousValue);
          }}
          style={[
            arenaStyles.primaryButton,
            !hasStarted && arenaStyles.primaryButtonStart,
            hasStarted && isPaused && gameState.status === 'running' && arenaStyles.primaryButtonActive,
          ]}>
          <Text style={arenaStyles.primaryButtonText}>
            {!hasStarted ? 'Start' : gameState.status === 'lost' ? 'Restart' : isPaused ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>

        <View style={arenaStyles.statusPill}>
          <Text numberOfLines={1} style={arenaStyles.statusPillText}>
            {statusText}
          </Text>
        </View>

        <Pressable onPress={() => setIsMenuOpen((value) => !value)} style={[arenaStyles.quickButton, isMenuOpen && arenaStyles.quickButtonActive]}>
          <Text style={arenaStyles.quickButtonText}>Menu</Text>
        </Pressable>
      </View>

      <View style={arenaStyles.hudRow}>
        <View style={arenaStyles.hudChip}>
          <Text style={arenaStyles.hudLabel}>Score</Text>
          <Text style={arenaStyles.hudValue}>{gameState.score}</Text>
        </View>
        <View style={arenaStyles.hudChip}>
          <Text style={arenaStyles.hudLabel}>Pressure</Text>
          <Text style={arenaStyles.hudValue}>T{displayTier}</Text>
        </View>
        <View style={arenaStyles.hudChip}>
          <Text style={arenaStyles.hudLabel}>Hull</Text>
          <Text style={[arenaStyles.hudValue, hullRatio <= 0.35 && arenaStyles.hudValueDanger]}>{Math.ceil(gameState.hull)}</Text>
        </View>
        <View style={arenaStyles.hudChip}>
          <Text style={arenaStyles.hudLabel}>Shield</Text>
          <Text style={[arenaStyles.hudValue, arenaStyles.hudValueShield]}>{Math.ceil(gameState.shield)}</Text>
        </View>
      </View>

      <View style={arenaStyles.subHudRow}>
        <View style={arenaStyles.statCard}>
          <Text style={arenaStyles.statLabel}>Damage</Text>
          <Text style={arenaStyles.statValue}>{gameState.weapon.damage}</Text>
        </View>
        <View style={arenaStyles.statCard}>
          <Text style={arenaStyles.statLabel}>RoF</Text>
          <Text style={arenaStyles.statValue}>{(1 / gameState.weapon.fireInterval).toFixed(1)}/s</Text>
        </View>
        <View style={arenaStyles.statCard}>
          <Text style={arenaStyles.statLabel}>Threat</Text>
          <Text style={arenaStyles.statValue}>
            {gameState.enemies.length}/{activeEnemyCap}
          </Text>
        </View>
      </View>

      <View style={arenaStyles.boardFrame}>
        <View
          onLayout={handleBoardLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleBoardTouch}
          onResponderMove={handleBoardTouch}
          style={arenaStyles.board}>
          <BackgroundGrid width={boardSize.width} height={boardSize.height} />

          {gameState.effects.map((effect) => (
            <EffectNode key={effect.id} effect={effect} />
          ))}

          {gameState.enemies.map((enemy) => (
            <EnemyNode key={enemy.id} enemy={enemy} />
          ))}

          {gameState.playerBullets.map((projectile) => (
            <ProjectileNode key={projectile.id} projectile={projectile} />
          ))}

          {gameState.enemyBullets.map((projectile) => (
            <ProjectileNode key={projectile.id} projectile={projectile} />
          ))}

          <View
            pointerEvents="none"
            style={[
              arenaStyles.playerShell,
              playerStyle,
              gameState.playerFlash > 0 && arenaStyles.playerShellHit,
            ]}>
            <View style={arenaStyles.playerCore}>
              <View style={arenaStyles.playerCockpit} />
              <View style={arenaStyles.playerWingLeft} />
              <View style={arenaStyles.playerWingRight} />
            </View>
          </View>

          <View pointerEvents="none" style={arenaStyles.bottomGlow} />
        </View>

        {isMenuOpen ? (
          <View style={arenaStyles.menuPanel}>
            <Text style={arenaStyles.menuTitle}>Arena Prototype Menu</Text>

            <Text style={arenaStyles.menuLabel}>Game</Text>
            <View style={arenaStyles.menuRow}>
              <Pressable style={[arenaStyles.menuButton, arenaStyles.menuButtonActive]}>
                <Text style={arenaStyles.menuButtonText}>Arena V2</Text>
              </Pressable>
              <Pressable onPress={() => onSwitchGame('prototype')} style={arenaStyles.menuButton}>
                <Text style={arenaStyles.menuButtonText}>Shooter Test</Text>
              </Pressable>
              <Pressable onPress={() => onSwitchGame('defender')} style={arenaStyles.menuButton}>
                <Text style={arenaStyles.menuButtonText}>Defender</Text>
              </Pressable>
            </View>

            <Text style={arenaStyles.menuLabel}>Notes</Text>
            <Text style={arenaStyles.menuHint}>
              Early combat sandbox. Enemies stay in the upper half, shoot back, and the run ends when hull reaches zero.
            </Text>

            <View style={arenaStyles.menuActions}>
              <Pressable onPress={handleRestart} style={[arenaStyles.menuActionButton, arenaStyles.menuActionPrimary]}>
                <Text style={arenaStyles.menuActionText}>Restart Run</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {gameState.status === 'lost' ? (
        <View style={arenaStyles.overlay}>
          <View style={arenaStyles.gameOverModal}>
            <Text style={arenaStyles.gameOverTitle}>Hull Collapse</Text>
            <Text style={arenaStyles.gameOverText}>
              Enemy fire broke through the shields. Score {gameState.score}. Pressure tier {displayTier}.
            </Text>
            <View style={arenaStyles.menuActions}>
              <Pressable onPress={handleRestart} style={[arenaStyles.menuActionButton, arenaStyles.menuActionPrimary]}>
                <Text style={arenaStyles.menuActionText}>Retry</Text>
              </Pressable>
              <Pressable onPress={() => onSwitchGame('prototype')} style={[arenaStyles.menuActionButton, arenaStyles.menuActionSecondary]}>
                <Text style={arenaStyles.menuActionText}>Back to Prototype</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const arenaStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07111A',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  containerPortrait: {
    paddingHorizontal: 10,
  },
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    minWidth: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F6683',
    backgroundColor: '#14263A',
    paddingVertical: 9,
    alignItems: 'center',
  },
  primaryButtonStart: {
    borderColor: '#86672A',
    backgroundColor: '#584118',
  },
  primaryButtonActive: {
    borderColor: '#4E83B5',
    backgroundColor: '#173755',
  },
  primaryButtonText: {
    color: '#F0F7FF',
    fontSize: 13,
    fontWeight: '800',
  },
  statusPill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24405D',
    backgroundColor: '#0E1A28',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusPillText: {
    color: '#BFD4F1',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickButton: {
    minWidth: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D4E6B',
    backgroundColor: '#112133',
    paddingVertical: 9,
    alignItems: 'center',
  },
  quickButtonActive: {
    borderColor: '#7FB8FF',
    backgroundColor: '#173653',
  },
  quickButtonText: {
    color: '#E6F1FF',
    fontSize: 12,
    fontWeight: '800',
  },
  hudRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hudChip: {
    flexBasis: '48%',
    minWidth: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#213A56',
    backgroundColor: '#0D1826',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  hudLabel: {
    color: '#7B92B0',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hudValue: {
    marginTop: 2,
    color: '#EDF6FF',
    fontSize: 13,
    fontWeight: '800',
  },
  hudValueDanger: {
    color: '#FFAA91',
  },
  hudValueShield: {
    color: '#9DEBFF',
  },
  subHudRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#24405D',
    backgroundColor: '#0E1A28',
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
  },
  statLabel: {
    color: '#7D93B5',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#BCD4F4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  boardFrame: {
    flex: 1,
    marginTop: 4,
    position: 'relative',
  },
  board: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#223852',
    backgroundColor: '#08131F',
  },
  bgFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#08131E',
  },
  bgHazeTop: {
    position: 'absolute',
    left: -40,
    top: -80,
    width: 260,
    height: 220,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 134, 190, 0.08)',
  },
  bgHazeBottom: {
    position: 'absolute',
    right: -60,
    bottom: -120,
    width: 280,
    height: 240,
    borderRadius: 220,
    backgroundColor: 'rgba(110, 234, 255, 0.06)',
  },
  enemyZoneFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 121, 183, 0.045)',
  },
  enemyZoneLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 184, 112, 0.28)',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(122, 149, 184, 0.12)',
  },
  enemyBody: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enemyWarningRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 234, 183, 0.88)',
  },
  enemyContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  enemyHealthText: {
    color: '#FBFEFF',
    fontSize: 14,
    fontWeight: '900',
  },
  enemyHealthTextCompact: {
    fontSize: 13,
  },
  playerProjectileShell: {
    position: 'absolute',
    alignItems: 'center',
  },
  playerProjectile: {
    borderWidth: 1,
    borderColor: '#FFF4CF',
  },
  enemyProjectile: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFEFD9',
  },
  playerShell: {
    position: 'absolute',
    width: 56,
    height: 40,
    alignItems: 'center',
  },
  playerShellHit: {
    opacity: 0.82,
  },
  playerCore: {
    width: 22,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#77E9FF',
    borderWidth: 1.5,
    borderColor: '#EAFDFF',
    alignItems: 'center',
  },
  playerCockpit: {
    marginTop: 5,
    width: 8,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF5CC',
  },
  playerWingLeft: {
    position: 'absolute',
    left: -12,
    top: 16,
    width: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#2A74B7',
  },
  playerWingRight: {
    position: 'absolute',
    right: -12,
    top: 16,
    width: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#2A74B7',
  },
  effectMuzzle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFF6D6',
  },
  effectBurst: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  effectWarning: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  effectShield: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  bottomGlow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    height: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(110, 234, 255, 0.08)',
  },
  menuPanel: {
    position: 'absolute',
    top: 64,
    left: 18,
    right: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#294563',
    backgroundColor: 'rgba(9, 17, 26, 0.96)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  menuTitle: {
    color: '#F3F9FF',
    fontSize: 16,
    fontWeight: '900',
  },
  menuLabel: {
    color: '#8DA8C8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  menuRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menuButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#37516F',
    backgroundColor: '#122131',
    paddingVertical: 9,
    alignItems: 'center',
  },
  menuButtonActive: {
    borderColor: '#8FC1FF',
    backgroundColor: '#1B3651',
  },
  menuButtonText: {
    color: '#E9F3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  menuHint: {
    color: '#A9BEDA',
    fontSize: 12,
    lineHeight: 18,
  },
  menuActions: {
    flexDirection: 'row',
    gap: 10,
  },
  menuActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  menuActionPrimary: {
    borderColor: '#59864A',
    backgroundColor: '#18301A',
  },
  menuActionSecondary: {
    borderColor: '#355271',
    backgroundColor: '#122033',
  },
  menuActionText: {
    color: '#F0F7FF',
    fontSize: 13,
    fontWeight: '800',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 10, 18, 0.66)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  gameOverModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#385978',
    backgroundColor: '#0E1826',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  gameOverTitle: {
    color: '#FFF2E9',
    fontSize: 20,
    fontWeight: '900',
  },
  gameOverText: {
    color: '#BFD0E5',
    fontSize: 13,
    lineHeight: 19,
  },
});
