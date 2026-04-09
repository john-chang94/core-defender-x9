import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  ARENA_FIXED_STEP_SECONDS,
  ARENA_MAX_CATCH_UP_STEPS,
  ARENA_MAX_FRAME_DELTA_SECONDS,
  ARENA_PLAYER_HALF_WIDTH,
  ARENA_PLAYER_MARGIN,
} from './config';
import {
  activateArenaUltimate,
  applyArenaArmoryUpgrade,
  createInitialArenaState,
  getArenaActiveEnemyCap,
  getArenaActiveWeapon,
  getArenaDisplayTier,
  tickArenaState,
} from './engine';
import { ArenaCanvas } from './ArenaCanvas';
import { ARENA_ARMORY_UPGRADES } from './upgrades';
import type { ArenaDrop, ArenaEnemy } from './types';

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

function formatArenaValue(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${Math.max(0, Math.ceil(value))}`;
}

function EnemyNode({ enemy }: { enemy: ArenaEnemy }) {
  const isBoss = enemy.kind === 'prismBoss';

  return (
    <View
      pointerEvents="none"
      style={[
        arenaStyles.enemyLabelWrap,
        {
          width: enemy.size + 24,
          left: Math.round(enemy.x - enemy.size / 2 - 12),
          top: Math.round(enemy.y - 11),
        },
      ]}>
      <Text style={[arenaStyles.enemyHealthText, enemy.maxHealth >= 100 && arenaStyles.enemyHealthTextCompact, isBoss && arenaStyles.enemyHealthTextBoss]}>
        {formatArenaValue(enemy.health)}
      </Text>
    </View>
  );
}

function DropNode({ drop }: { drop: ArenaDrop }) {
  return (
    <View
      pointerEvents="none"
      style={[
        arenaStyles.dropLabelWrap,
        {
          width: 84,
          left: Math.round(drop.x - 42),
          top: Math.round(drop.y + drop.size * 0.46),
        },
      ]}>
      <Text style={arenaStyles.dropLabel}>{drop.label}</Text>
    </View>
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
  const boardRef = useRef<View | null>(null);
  const boardWindowXRef = useRef(0);
  const pendingPlayerXRef = useRef<number | null>(null);
  const isArmoryOpen = gameState.pendingArmoryChoice !== null;

  const measureBoardBounds = () => {
    requestAnimationFrame(() => {
      boardRef.current?.measureInWindow((x) => {
        if (Number.isFinite(x)) {
          boardWindowXRef.current = x;
        }
      });
    });
  };

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

      if (hasStarted && !isPaused && !isArmoryOpen) {
        accumulatedSimulationSeconds += elapsedSeconds;
        const steps = Math.min(ARENA_MAX_CATCH_UP_STEPS, Math.floor(accumulatedSimulationSeconds / ARENA_FIXED_STEP_SECONDS));
        const pendingPlayerX = pendingPlayerXRef.current;
        if (steps > 0 || pendingPlayerX !== null) {
          accumulatedSimulationSeconds -= steps * ARENA_FIXED_STEP_SECONDS;
          setGameState((previousState) => {
            if (previousState.status !== 'running') {
              return previousState;
            }

            let nextState = previousState;
            if (pendingPlayerX !== null && Math.abs(previousState.playerX - pendingPlayerX) > 0.1) {
              nextState = {
                ...previousState,
                playerX: pendingPlayerX,
              };
            }
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
  }, [boardSize.height, boardSize.width, hasStarted, isArmoryOpen, isPaused]);

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }
    measureBoardBounds();
  }, [boardSize.height, boardSize.width, windowHeight, windowWidth]);

  useEffect(() => {
    if (gameState.status === 'lost') {
      pendingPlayerXRef.current = null;
      setIsPaused(true);
    }
  }, [gameState.status]);

  useEffect(() => {
    if (isArmoryOpen && hasStarted && gameState.status === 'running') {
      pendingPlayerXRef.current = null;
      setIsPaused(true);
      setIsMenuOpen(false);
    }
  }, [gameState.pendingArmoryChoice, gameState.status, hasStarted, isArmoryOpen]);

  const displayTier = getArenaDisplayTier(gameState.elapsed);
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const activeWeapon = getArenaActiveWeapon(gameState);
  const fireRate = (1 / activeWeapon.fireInterval).toFixed(1);
  const ultimateChargeProgress = clamp(gameState.ultimateCharge / 100, 0, 1);
  const ultimateReady = gameState.ultimateCharge >= 100;
  const activeEncounterAnchor = gameState.activeEncounter
    ? gameState.enemies.find((enemy) => enemy.kind === gameState.activeEncounter?.anchorKind) ?? null
    : null;
  const healthProgress = clamp(gameState.hull / Math.max(1, gameState.maxHull), 0, 1);
  const shieldProgress = clamp(gameState.shield / Math.max(1, gameState.maxShield), 0, 1);
  const salvageProgress = clamp(gameState.salvage / Math.max(1, gameState.nextArmoryCost), 0, 1);
  const hasEncounterAnnouncement = gameState.encounterAnnouncement !== null && gameState.encounterAnnouncementTimer > 0;
  const encounterAnnouncementProgress = hasEncounterAnnouncement
    ? 1 - gameState.encounterAnnouncementTimer / 1.75
    : 0;
  const encounterAnnouncementOpacity = hasEncounterAnnouncement
    ? Math.sin(Math.min(1, encounterAnnouncementProgress) * Math.PI)
    : 0;
  const statusText =
    !hasStarted
      ? 'Press Start to deploy the arena test.'
      : isArmoryOpen
        ? 'Armory draft ready.'
      : gameState.status === 'lost'
        ? 'Health depleted. Restart to run again.'
        : isPaused
          ? 'Arena Prototype paused.'
          : gameState.pickupMessage ??
            (activeEncounterAnchor && gameState.activeEncounter
              ? `${gameState.activeEncounter.label} ${formatArenaValue(activeEncounterAnchor.health)}`
              : gameState.activeEncounter
                ? `${gameState.activeEncounter.label} active`
                : gameState.overclockTimer > 0
                  ? `Overclock ${gameState.overclockTimer.toFixed(1)}s. Threat ${gameState.enemies.length}/${activeEnemyCap}`
                  : `Enemies hold the upper half. Threat ${gameState.enemies.length}/${activeEnemyCap}`);
  const armorySubtitle =
    gameState.pendingArmoryChoice?.source === 'boss'
      ? 'Boss cache unlocked. Pick one premium install.'
      : `Salvage spent ${gameState.pendingArmoryChoice?.cost}. Next draft ${gameState.nextArmoryCost}.`;

  const queueBoardTouch = (pageX: number) => {
    if (boardSize.width <= 0 || boardSize.height <= 0 || isMenuOpen || isArmoryOpen || !hasStarted || isPaused || gameState.status !== 'running') {
      return;
    }

    const localX = pageX - boardWindowXRef.current;
    pendingPlayerXRef.current = clamp(localX, ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN, boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        queueBoardTouch(gestureState.x0);
      },
      onPanResponderMove: (_, gestureState) => {
        queueBoardTouch(gestureState.moveX);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {
        pendingPlayerXRef.current = null;
      },
      onPanResponderTerminate: () => {
        pendingPlayerXRef.current = null;
      },
    })
  ).current;

  const handleBoardLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextWidth !== boardSize.width || nextHeight !== boardSize.height) {
      setBoardSize({ width: nextWidth, height: nextHeight });
    }
    measureBoardBounds();
  };

  const handleRestart = () => {
    if (boardSize.width <= 0) {
      return;
    }
    pendingPlayerXRef.current = null;
    setGameState(createInitialArenaState(boardSize.width));
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
  };

  const handleSelectArmoryUpgrade = (key: keyof typeof ARENA_ARMORY_UPGRADES) => {
    setGameState((previousState) => {
      if (!previousState.pendingArmoryChoice) {
        return previousState;
      }
      return applyArenaArmoryUpgrade(previousState, key);
    });

    if (hasStarted && gameState.status === 'running') {
      requestAnimationFrame(() => {
        setIsPaused(false);
      });
    }
  };
  const hullRatio = gameState.hull / gameState.maxHull;
  const handleActivateUltimate = () => {
    if (
      boardSize.width <= 0 ||
      boardSize.height <= 0 ||
      !hasStarted ||
      isPaused ||
      isArmoryOpen ||
      isMenuOpen ||
      gameState.status !== 'running'
    ) {
      return;
    }

    setGameState((previousState) => activateArenaUltimate(previousState, boardSize.width, boardSize.height));
  };

  return (
    <SafeAreaView style={[arenaStyles.container, isPortraitViewport && arenaStyles.containerPortrait]}>
      <View style={arenaStyles.topBar}>
        <Pressable
          onPress={() => {
            if (isArmoryOpen) {
              return;
            }
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

        <Pressable
          onPress={() => {
            if (isArmoryOpen) {
              return;
            }
            setIsMenuOpen((value) => !value);
          }}
          style={[arenaStyles.quickButton, isMenuOpen && arenaStyles.quickButtonActive]}>
          <Text style={arenaStyles.quickButtonText}>Menu</Text>
        </Pressable>
      </View>

      <View style={arenaStyles.topHudRow}>
        <View style={arenaStyles.hudChip}>
          <Text style={arenaStyles.hudLabel}>Score</Text>
          <Text style={arenaStyles.hudValue}>{gameState.score}</Text>
        </View>
        <View style={arenaStyles.hudChip}>
          <Text style={arenaStyles.hudLabel}>Pressure</Text>
          <Text style={arenaStyles.hudValue}>T{displayTier}</Text>
        </View>
      </View>

      <View style={arenaStyles.meterRow}>
        <View style={[arenaStyles.hudChip, arenaStyles.hudMeterChip, arenaStyles.meterCard]}>
          <Text style={arenaStyles.hudLabel}>Health</Text>
          <View style={arenaStyles.hudMeter}>
            <View
              style={[
                arenaStyles.hudMeterFill,
                arenaStyles.hudMeterFillHealth,
                { width: `${healthProgress * 100}%` },
              ]}
            />
            <Text style={[arenaStyles.hudMeterText, hullRatio <= 0.35 && arenaStyles.hudMeterTextDanger]}>
              {Math.ceil(gameState.hull)} / {Math.ceil(gameState.maxHull)}
            </Text>
          </View>
        </View>
        <View style={[arenaStyles.hudChip, arenaStyles.hudMeterChip, arenaStyles.meterCard]}>
          <Text style={arenaStyles.hudLabel}>Shield</Text>
          <View style={arenaStyles.hudMeter}>
            <View
              style={[
                arenaStyles.hudMeterFill,
                arenaStyles.hudMeterFillShield,
                { width: `${shieldProgress * 100}%` },
              ]}
            />
            <Text style={[arenaStyles.hudMeterText, arenaStyles.hudMeterTextShield]}>
              {Math.ceil(gameState.shield)} / {Math.ceil(gameState.maxShield)}
            </Text>
          </View>
        </View>
        <View style={[arenaStyles.hudChip, arenaStyles.hudMeterChip, arenaStyles.meterCard]}>
          <Text style={arenaStyles.hudLabel}>Salvage</Text>
          <View style={arenaStyles.hudMeter}>
            <View
              style={[
                arenaStyles.hudMeterFill,
                arenaStyles.hudMeterFillSalvage,
                { width: `${salvageProgress * 100}%` },
              ]}
            />
            <Text style={arenaStyles.hudMeterText}>
              {gameState.salvage} / {gameState.nextArmoryCost}
            </Text>
          </View>
        </View>
      </View>

      <View style={arenaStyles.statRow}>
        <View style={arenaStyles.statCard}>
          <Text style={arenaStyles.statLabel}>Damage</Text>
          <Text style={arenaStyles.statValue}>{activeWeapon.damage}</Text>
        </View>
        <View style={arenaStyles.statCard}>
          <Text style={arenaStyles.statLabel}>RoF</Text>
          <Text style={arenaStyles.statValue}>{fireRate}/s</Text>
        </View>
        <View style={arenaStyles.statCard}>
          <Text style={arenaStyles.statLabel}>Speed</Text>
          <Text style={arenaStyles.statValue}>{Math.round(activeWeapon.bulletSpeed)}</Text>
        </View>
      </View>

      <View style={arenaStyles.boardFrame}>
        <View
          ref={boardRef}
          onLayout={handleBoardLayout}
          {...panResponder.panHandlers}
          style={arenaStyles.board}>
          <ArenaCanvas boardWidth={boardSize.width} boardHeight={boardSize.height} state={gameState} />

          {hasEncounterAnnouncement ? (
            <View pointerEvents="none" style={arenaStyles.boardAnnouncementWrap}>
              <View
                style={[
                  arenaStyles.boardAnnouncementGlow,
                  {
                    backgroundColor: hexToRgba(gameState.encounterAnnouncementColor ?? '#8BCBFF', 0.14 + encounterAnnouncementOpacity * 0.18),
                    opacity: encounterAnnouncementOpacity,
                    transform: [{ scale: 0.88 + encounterAnnouncementProgress * 0.16 }],
                  },
                ]}
              />
              <Text
                style={[
                  arenaStyles.boardAnnouncementText,
                  {
                    color: gameState.encounterAnnouncementColor ?? '#F1F7FF',
                    opacity: 0.25 + encounterAnnouncementOpacity * 0.75,
                  },
                ]}>
                {gameState.encounterAnnouncement}
              </Text>
            </View>
          ) : null}

          {gameState.drops.map((drop) => (
            <DropNode key={drop.id} drop={drop} />
          ))}

          {gameState.enemies.map((enemy) => (
            <EnemyNode key={enemy.id} enemy={enemy} />
          ))}

          <Pressable
            onPress={handleActivateUltimate}
            style={[
              arenaStyles.ultimateButton,
              ultimateReady && arenaStyles.ultimateButtonReady,
              (isPaused || isArmoryOpen || isMenuOpen || gameState.status !== 'running') && arenaStyles.ultimateButtonDisabled,
            ]}>
            <View style={arenaStyles.ultimateButtonMeter}>
              <View style={[arenaStyles.ultimateButtonFill, { width: `${ultimateChargeProgress * 100}%` }]} />
            </View>
            <Text style={arenaStyles.ultimateButtonLabel}>ULT</Text>
            <Text style={arenaStyles.ultimateButtonValue}>{ultimateReady ? 'READY' : `${Math.round(gameState.ultimateCharge)}%`}</Text>
          </Pressable>
        </View>

        {isArmoryOpen ? (
          <View style={arenaStyles.armoryOverlay}>
            <View style={arenaStyles.armoryPanel}>
              <Text style={arenaStyles.armoryTitle}>{gameState.pendingArmoryChoice?.title}</Text>
              <Text style={arenaStyles.armorySubtitle}>{armorySubtitle}</Text>
              <Text style={arenaStyles.armoryPrompt}>{gameState.pendingArmoryChoice?.prompt}</Text>

              <View style={arenaStyles.armoryOptions}>
                {gameState.pendingArmoryChoice?.options.map((key) => {
                  const definition = ARENA_ARMORY_UPGRADES[key];
                  return (
                    <Pressable
                      key={key}
                      onPress={() => handleSelectArmoryUpgrade(key)}
                      style={arenaStyles.armoryCard}>
                      <Text style={arenaStyles.armoryCardLabel}>{definition.label}</Text>
                      <Text style={arenaStyles.armoryCardText}>{definition.summary}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

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
              Enemies stay in the upper half, shoot back, and the run ends when health reaches zero. Kills now generate salvage and can drop tactical pickups.
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
            <Text style={arenaStyles.gameOverTitle}>Health Depleted</Text>
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
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryButton: {
    minWidth: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F6683',
    backgroundColor: '#14263A',
    paddingVertical: 7,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
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
    paddingVertical: 7,
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
  topHudRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 6,
  },
  meterRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 6,
  },
  statRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 6,
  },
  hudChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#213A56',
    backgroundColor: '#0D1826',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  hudMeterChip: {
    gap: 4,
  },
  meterCard: {
    minHeight: 50,
  },
  hudLabel: {
    color: '#7B92B0',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hudValue: {
    marginTop: 1,
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
  hudMeter: {
    height: 22,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#30516F',
    backgroundColor: '#12253A',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hudMeterFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
  hudMeterFillHealth: {
    backgroundColor: 'rgba(255, 145, 120, 0.36)',
  },
  hudMeterFillShield: {
    backgroundColor: 'rgba(110, 234, 255, 0.34)',
  },
  hudMeterFillSalvage: {
    backgroundColor: 'rgba(133, 176, 255, 0.38)',
  },
  hudMeterText: {
    color: '#E7F0FF',
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  hudMeterTextDanger: {
    color: '#FFD3C6',
  },
  hudMeterTextShield: {
    color: '#D1F8FF',
  },
  statCard: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24405D',
    backgroundColor: '#0E1A28',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  statLabel: {
    color: '#7D93B5',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statValue: {
    color: '#BCD4F4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  boardFrame: {
    flex: 1,
    marginTop: 3,
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
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
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
  boardAnnouncementWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '38%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  boardAnnouncementGlow: {
    position: 'absolute',
    width: 260,
    height: 82,
    borderRadius: 999,
  },
  boardAnnouncementText: {
    color: '#F1F7FF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  enemyLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  enemyBody: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enemyAura: {
    position: 'absolute',
    borderWidth: 1.4,
  },
  enemyAuraElite: {
    borderColor: 'rgba(203, 192, 255, 0.45)',
    backgroundColor: 'rgba(177, 149, 255, 0.08)',
  },
  enemyAuraBoss: {
    borderColor: 'rgba(255, 206, 171, 0.6)',
    backgroundColor: 'rgba(255, 116, 173, 0.1)',
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
    textAlign: 'center',
    textShadowColor: 'rgba(5, 11, 20, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  enemyHealthTextCompact: {
    fontSize: 13,
  },
  enemyHealthTextBoss: {
    fontSize: 15,
  },
  dropLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(8, 19, 30, 0.52)',
  },
  enemyEliteMarker: {
    marginBottom: 2,
    flexDirection: 'row',
    gap: 3,
  },
  enemyEliteSlash: {
    width: 3,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#F0E9FF',
    transform: [{ rotate: '18deg' }],
  },
  enemyOrbiterMarker: {
    marginBottom: 3,
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: '#E2FFF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyOrbiterCore: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#F2FFF8',
  },
  enemySniperMarker: {
    marginBottom: 3,
    width: 16,
    height: 9,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: '#FFE4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemySniperLens: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#FFF0F7',
  },
  enemyBossMarker: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  enemyBossPip: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#FFF5D2',
  },
  enemyBossPipWide: {
    width: 9,
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
  dropToken: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F8FCFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dropLabel: {
    color: '#E9F5FF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(4, 10, 18, 0.78)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  armoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 16,
    backgroundColor: 'rgba(4, 10, 18, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  armoryPanel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#37536F',
    backgroundColor: '#0E1826',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  armoryTitle: {
    color: '#F5FAFF',
    fontSize: 18,
    fontWeight: '900',
  },
  armorySubtitle: {
    color: '#8FB2D4',
    fontSize: 12,
    fontWeight: '700',
  },
  armoryPrompt: {
    color: '#B9CCDF',
    fontSize: 13,
    lineHeight: 18,
  },
  armoryOptions: {
    gap: 10,
  },
  armoryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#385470',
    backgroundColor: '#132131',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  armoryCardLabel: {
    color: '#F3F8FF',
    fontSize: 15,
    fontWeight: '800',
  },
  armoryCardText: {
    color: '#B4C7DB',
    fontSize: 12,
    lineHeight: 17,
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
  ultimateButton: {
    position: 'absolute',
    right: 14,
    bottom: 16,
    width: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#385673',
    backgroundColor: 'rgba(10, 20, 30, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },
  ultimateButtonReady: {
    borderColor: '#FFE2A8',
    backgroundColor: 'rgba(56, 40, 14, 0.94)',
  },
  ultimateButtonDisabled: {
    opacity: 0.78,
  },
  ultimateButtonMeter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 12,
    backgroundColor: 'rgba(23, 41, 60, 0.66)',
  },
  ultimateButtonFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 192, 96, 0.54)',
  },
  ultimateButtonLabel: {
    color: '#EAF5FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  ultimateButtonValue: {
    marginTop: 2,
    color: '#BDD7F6',
    fontSize: 10,
    fontWeight: '800',
  },
});
