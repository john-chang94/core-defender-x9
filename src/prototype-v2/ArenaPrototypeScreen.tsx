import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import {
  ARENA_FIXED_STEP_SECONDS,
  ARENA_MAX_CATCH_UP_STEPS,
  ARENA_MAX_FRAME_DELTA_SECONDS,
  ARENA_ENEMY_ORDER,
  ARENA_PLAYER_FLOOR_OFFSET,
  ARENA_PLAYER_HALF_WIDTH,
  ARENA_PLAYER_MARGIN,
  ARENA_PLAYER_RENDER_HALF_WIDTH,
  ARENA_PLAYER_HEIGHT,
  ARENA_VERSION_LABEL,
} from './config';
import {
  activateArenaUltimate,
  applyArenaArmoryUpgrade,
  createInitialArenaState,
  getArenaActiveEnemyCap,
  getArenaActiveWeapon,
  setArenaBuild,
  getArenaDisplayTier,
  tickArenaState,
} from './engine';
import { ArenaCanvas } from './ArenaCanvas';
import { ARENA_BUILD_META, ARENA_BUILD_ORDER } from './builds';
import {
  ARENA_ENEMY_LABELS,
  applyArenaDiscoveryProgress,
  applyArenaRunSummary,
  createArenaMetaState,
  getArenaBuildUnlockIds,
  getArenaGlobalUnlockIds,
  createArenaRunMetaSummary,
  getArenaMasteryProgress,
  getArenaNextBuildUnlock,
  loadArenaMetaState,
  saveArenaMetaState,
} from './meta';
import { ARENA_ARMORY_UPGRADES, ARENA_ARMORY_UPGRADE_ORDER, isArenaArmoryUpgradeMaxed } from './upgrades';
import type { ArenaBuildId, ArenaDrop, ArenaEnemy, ArenaMetaState, ArenaUnlockEntry, ArenaVfxQuality } from './types';

type AppGameId = 'defender' | 'prototype' | 'prototypeV2';

type ArenaPrototypeScreenProps = {
  onSwitchGame: (game: AppGameId) => void;
};

type ArenaMenuTab = 'run' | 'codex' | 'mastery';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampWorklet(value: number, min: number, max: number) {
  'worklet';
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
  const isBoss = enemy.kind === 'prismBoss' || enemy.kind === 'hiveCarrierBoss';

  return (
    <View
      pointerEvents="none"
      style={[
        arenaStyles.enemyLabelWrap,
        {
          width: enemy.size + 24,
          left: enemy.x - enemy.size / 2 - 12,
          top: enemy.y - 11,
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
          left: drop.x - 42,
          top: drop.y + drop.size * 0.46,
        },
      ]}>
      <Text style={arenaStyles.dropLabel}>{drop.label}</Text>
    </View>
  );
}

const ULTIMATE_ICON_RAY_ANGLES = ['0deg', '45deg', '90deg', '135deg'] as const;
const ULTIMATE_ICON_SPARK_ANGLES = ['22deg', '68deg', '112deg', '158deg'] as const;

function ArmoryControlIcon() {
  return (
    <View pointerEvents="none" style={arenaStyles.armoryIconWrap}>
      <View style={[arenaStyles.armorySword, arenaStyles.armorySwordLeft]}>
        <View style={arenaStyles.armorySwordBlade} />
        <View style={arenaStyles.armorySwordGuard} />
        <View style={arenaStyles.armorySwordGrip} />
        <View style={arenaStyles.armorySwordPommel} />
      </View>
      <View style={[arenaStyles.armorySword, arenaStyles.armorySwordRight]}>
        <View style={arenaStyles.armorySwordBlade} />
        <View style={arenaStyles.armorySwordGuard} />
        <View style={arenaStyles.armorySwordGrip} />
        <View style={arenaStyles.armorySwordPommel} />
      </View>
    </View>
  );
}

function UltimateControlIcon({
  ready,
  chargeProgress,
}: {
  ready: boolean;
  chargeProgress: number;
}) {
  return (
    <View pointerEvents="none" style={arenaStyles.ultimateIconWrap}>
      {ULTIMATE_ICON_RAY_ANGLES.map((angle, index) => (
        <View
          key={`ult-ray-${angle}`}
          style={[
            arenaStyles.ultimateIconRay,
            index % 2 === 0 ? arenaStyles.ultimateIconRayLong : arenaStyles.ultimateIconRayShort,
            ready && arenaStyles.ultimateIconRayReady,
            { transform: [{ rotate: angle }] },
          ]}
        />
      ))}
      {ULTIMATE_ICON_SPARK_ANGLES.map((angle) => (
        <View
          key={`ult-spark-${angle}`}
          style={[
            arenaStyles.ultimateIconSpark,
            ready && arenaStyles.ultimateIconSparkReady,
            { transform: [{ rotate: angle }] },
          ]}
        />
      ))}
      <View style={[arenaStyles.ultimateIconRing, ready && arenaStyles.ultimateIconRingReady]} />
      <View
        style={[
          arenaStyles.ultimateIconCore,
          ready && arenaStyles.ultimateIconCoreReady,
          {
            opacity: 0.52 + chargeProgress * 0.44,
          },
        ]}
      />
    </View>
  );
}

function UnlockChip({
  entry,
  accentColor,
}: {
  entry: ArenaUnlockEntry;
  accentColor?: string;
}) {
  return (
    <View
      style={[
        arenaStyles.unlockChip,
        entry.unlocked ? arenaStyles.unlockChipUnlocked : arenaStyles.unlockChipLocked,
        entry.unlocked && accentColor
          ? {
              borderColor: hexToRgba(accentColor, 0.58),
              backgroundColor: hexToRgba(accentColor, 0.12),
            }
          : null,
      ]}>
      <Text style={[arenaStyles.unlockChipLabel, !entry.unlocked && arenaStyles.unlockChipLabelLocked]}>
        {entry.unlocked ? entry.rewardLabel : entry.label}
      </Text>
      <Text style={arenaStyles.unlockChipMeta}>{entry.unlocked ? 'Unlocked' : entry.description}</Text>
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
  const [isArmoryOpen, setIsArmoryOpen] = useState(false);
  const [vfxQuality, setVfxQuality] = useState<ArenaVfxQuality>('high');
  const [menuTab, setMenuTab] = useState<ArenaMenuTab>('run');
  const [arenaMeta, setArenaMeta] = useState<ArenaMetaState>(() => createArenaMetaState());
  const [isMetaReady, setIsMetaReady] = useState(false);
  const hasInitializedBoardRef = useRef(false);
  const armoryResumeOnCloseRef = useRef(false);
  const persistedDiscoveryKeyRef = useRef('');
  const runMetaCommittedRef = useRef(false);
  const playerVisualX = useSharedValue(900 / 2);
  const playerShellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerVisualX.value - ARENA_PLAYER_RENDER_HALF_WIDTH }],
  }));

  useEffect(() => {
    let cancelled = false;

    const hydrateArenaMeta = async () => {
      const loadedMetaState = await loadArenaMetaState();
      if (cancelled) {
        return;
      }
      setArenaMeta(loadedMetaState);
      setIsMetaReady(true);
    };

    void hydrateArenaMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    if (!hasInitializedBoardRef.current) {
      hasInitializedBoardRef.current = true;
      playerVisualX.value = boardSize.width / 2;
      setGameState(createInitialArenaState(boardSize.width));
      setHasStarted(false);
      setIsPaused(true);
      runMetaCommittedRef.current = false;
      return;
    }

    playerVisualX.value = clamp(playerVisualX.value, ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN, boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN);
    setGameState((previousState) => ({
      ...previousState,
      playerX: clamp(previousState.playerX, ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN, boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN),
      enemies: previousState.enemies.map((enemy) => ({
        ...enemy,
        x: clamp(enemy.x, enemy.size / 2 + 8, boardSize.width - enemy.size / 2 - 8),
      })),
    }));
  }, [boardSize.height, boardSize.width, playerVisualX]);

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    let animationFrameId = 0;
    let lastFrameTimeMs = 0;
    let accumulatedSimulationSeconds = 0;
    const maxSubstepsPerFrame = ARENA_MAX_CATCH_UP_STEPS * 2;

    const frame = (timeMs: number) => {
      if (lastFrameTimeMs === 0) {
        lastFrameTimeMs = timeMs;
        animationFrameId = requestAnimationFrame(frame);
        return;
      }

      const elapsedSeconds = Math.min((timeMs - lastFrameTimeMs) / 1000, ARENA_MAX_FRAME_DELTA_SECONDS);
      lastFrameTimeMs = timeMs;

      if (hasStarted && !isPaused && !isArmoryOpen && !isMenuOpen) {
        accumulatedSimulationSeconds += elapsedSeconds;
        const stepDurations: number[] = [];
        let remainingStepSeconds = accumulatedSimulationSeconds;
        while (remainingStepSeconds > 0.0001 && stepDurations.length < maxSubstepsPerFrame) {
          const stepSeconds = Math.min(ARENA_FIXED_STEP_SECONDS, remainingStepSeconds);
          stepDurations.push(stepSeconds);
          remainingStepSeconds -= stepSeconds;
        }
        accumulatedSimulationSeconds =
          stepDurations.length >= maxSubstepsPerFrame ? 0 : Math.max(0, remainingStepSeconds);
        const livePlayerX = clamp(
          playerVisualX.value,
          ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
          boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN
        );
        setGameState((previousState) => {
          if (previousState.status !== 'running') {
            return previousState;
          }

          let nextState = previousState;
          if (Math.abs(previousState.playerX - livePlayerX) > 0.1) {
            nextState = {
              ...previousState,
              playerX: livePlayerX,
            };
          }
          if (stepDurations.length === 0 && nextState === previousState) {
            return previousState;
          }
          for (let index = 0; index < stepDurations.length; index += 1) {
            if (nextState.status !== 'running') {
              break;
            }
            nextState = tickArenaState(nextState, stepDurations[index], boardSize.width, boardSize.height);
          }
          return nextState;
        });
      }

      animationFrameId = requestAnimationFrame(frame);
    };

    animationFrameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [boardSize.height, boardSize.width, hasStarted, isArmoryOpen, isMenuOpen, isPaused, playerVisualX]);

  useEffect(() => {
    if (gameState.status === 'lost') {
      setIsPaused(true);
      setIsArmoryOpen(false);
      armoryResumeOnCloseRef.current = false;
    }
  }, [gameState.status]);

  const discoverySignature = ARENA_ENEMY_ORDER.map((kind) => `${kind}:${gameState.runSeenTierByEnemy[kind] ?? '-'}`).join('|');

  useEffect(() => {
    if (!isMetaReady) {
      return;
    }
    if (discoverySignature === persistedDiscoveryKeyRef.current) {
      return;
    }
    persistedDiscoveryKeyRef.current = discoverySignature;
    setArenaMeta((previousMetaState) => {
      const nextMetaState = applyArenaDiscoveryProgress(previousMetaState, gameState.runSeenTierByEnemy);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  }, [discoverySignature, gameState.runSeenTierByEnemy, isMetaReady]);

  const displayTier = getArenaDisplayTier(gameState.elapsed);
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const activeWeapon = getArenaActiveWeapon(gameState);
  const activeBuildMeta = ARENA_BUILD_META[gameState.activeBuild];
  const fireRate = (1 / activeWeapon.fireInterval).toFixed(1);
  const ultimateChargeProgress = clamp(gameState.ultimateCharge / 100, 0, 1);
  const ultimateReady = gameState.ultimateCharge >= 100;
  const activeEncounterAnchor = gameState.activeEncounter
    ? (gameState.activeEncounter.anchorEnemyId
        ? gameState.enemies.find((enemy) => enemy.id === gameState.activeEncounter?.anchorEnemyId)
        : null) ??
      gameState.enemies.find((enemy) => enemy.kind === gameState.activeEncounter?.anchorKind) ??
      null
    : null;
  const hasArmoryChoices = gameState.availableArmoryChoices > 0;
  const armoryAvailabilityLabel =
    gameState.availableArmoryChoices === 1
      ? '1 upgrade available'
      : `${gameState.availableArmoryChoices} upgrades available`;
  const healthProgress = clamp(gameState.hull / Math.max(1, gameState.maxHull), 0, 1);
  const shieldProgress = clamp(gameState.shield / Math.max(1, gameState.maxShield), 0, 1);
  const salvageProgress = clamp(gameState.salvage / Math.max(1, gameState.nextArmoryCost), 0, 1);
  const shakeEnabled =
    hasStarted && !isPaused && !isArmoryOpen && !isMenuOpen && gameState.status === 'running';
  const overdriveShake =
    gameState.overclockTimer > 0 ? 0.18 + Math.min(1, gameState.overclockTimer / 6) * 0.34 : 0;
  const ultimateShake =
    gameState.ultimateTimer > 0 ? 0.36 + Math.min(1, gameState.ultimateTimer / 1.6) * 0.46 : 0;
  const boardShakeStrength = shakeEnabled ? clamp(Math.max(overdriveShake, ultimateShake), 0, 1) : 0;
  const boardShakeX = Math.sin(gameState.elapsed * 76) * boardShakeStrength * 1.5;
  const boardShakeY = Math.cos(gameState.elapsed * 63) * boardShakeStrength * 1.05;
  const hasEncounterAnnouncement = gameState.encounterAnnouncement !== null && gameState.encounterAnnouncementTimer > 0;
  const encounterAnnouncementProgress = hasEncounterAnnouncement
    ? 1 - gameState.encounterAnnouncementTimer / 1.75
    : 0;
  const encounterAnnouncementOpacity = hasEncounterAnnouncement
    ? Math.sin(Math.min(1, encounterAnnouncementProgress) * Math.PI)
    : 0;
  const sideControlTop =
    boardSize.height > 0
      ? clamp(boardSize.height * 0.75 - 30, 72, Math.max(72, boardSize.height - 102))
      : 72;
  const armoryReadyPulse = hasArmoryChoices ? 0.5 + Math.sin(gameState.elapsed * 4.2) * 0.5 : 0;
  const ultimateReadyPulse = ultimateReady ? 0.5 + Math.sin(gameState.elapsed * 5.8) * 0.5 : 0;
  const statusText =
    !hasStarted
      ? 'Press Start to deploy the arena test.'
      : isArmoryOpen
        ? `Armory open. ${armoryAvailabilityLabel}.`
      : isMenuOpen
        ? 'Menu open. Simulation paused.'
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
                  ? `${activeBuildMeta.shortLabel} Overdrive ${gameState.overclockTimer.toFixed(1)}s. Threat ${gameState.enemies.length}/${activeEnemyCap}`
                  : `${activeBuildMeta.shortLabel} Build online. Threat ${gameState.enemies.length}/${activeEnemyCap}`);
  const armorySubtitle = `${armoryAvailabilityLabel}. Next standard unlock ${gameState.nextArmoryCost} salvage.`;
  const armoryUpgrades = ARENA_ARMORY_UPGRADE_ORDER.map((key) => {
    const definition = ARENA_ARMORY_UPGRADES[key];
    const isMaxed = isArenaArmoryUpgradeMaxed(key, gameState.weapon);
    return {
      key,
      definition,
      isMaxed,
    };
  });
  const codexEnemyEntries = ARENA_ENEMY_ORDER.map((kind) => arenaMeta.codexEnemies[kind]);
  const globalUnlockEntries = getArenaGlobalUnlockIds().map((unlockId) => arenaMeta.unlocks[unlockId]);
  const masteryCards = ARENA_BUILD_ORDER.map((buildId) => {
    const buildMeta = ARENA_BUILD_META[buildId];
    const mastery = arenaMeta.mastery[buildId];
    const progress = getArenaMasteryProgress(mastery.xp);
    const unlockEntries = getArenaBuildUnlockIds(buildId).map((unlockId) => arenaMeta.unlocks[unlockId]);
    const nextUnlockId = getArenaNextBuildUnlock(arenaMeta, buildId);
    return {
      buildId,
      buildMeta,
      mastery,
      progress,
      unlockEntries,
      nextUnlock: nextUnlockId ? arenaMeta.unlocks[nextUnlockId] : null,
    };
  });

  const canControlShip = boardSize.width > 0 && boardSize.height > 0 && !isMenuOpen && !isArmoryOpen && hasStarted && !isPaused && gameState.status === 'running';
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canControlShip)
        .maxPointers(1)
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
          playerVisualX.value = clampWorklet(
            event.x,
            ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
            boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN
          );
        })
        .onUpdate((event) => {
          playerVisualX.value = clampWorklet(
            event.x,
            ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
            boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN
          );
        }),
    [boardSize.width, canControlShip, playerVisualX]
  );

  const handleBoardLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextWidth !== boardSize.width || nextHeight !== boardSize.height) {
      setBoardSize({ width: nextWidth, height: nextHeight });
    }
  };

  const finalizeRunMetaProgress = () => {
    if (!hasStarted || runMetaCommittedRef.current || !isMetaReady) {
      return;
    }

    runMetaCommittedRef.current = true;
    const totalKills = ARENA_ENEMY_ORDER.reduce(
      (sum, kind) => sum + gameState.runKillCountsByEnemy[kind],
      0
    );
    const hasMeaningfulRun =
      gameState.elapsed >= 3 ||
      totalKills > 0 ||
      gameState.runMiniBossClears > 0 ||
      gameState.runBossClears > 0 ||
      gameState.bestTierReached > 1;

    if (!hasMeaningfulRun) {
      return;
    }

    const runSummary = createArenaRunMetaSummary(gameState);
    setArenaMeta((previousMetaState) => {
      const nextMetaState = applyArenaRunSummary(previousMetaState, runSummary);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  };

  useEffect(() => {
    if (gameState.status !== 'lost' || !isMetaReady || !hasStarted || runMetaCommittedRef.current) {
      return;
    }

    runMetaCommittedRef.current = true;
    const totalKills = ARENA_ENEMY_ORDER.reduce(
      (sum, kind) => sum + gameState.runKillCountsByEnemy[kind],
      0
    );
    const hasMeaningfulRun =
      gameState.elapsed >= 3 ||
      totalKills > 0 ||
      gameState.runMiniBossClears > 0 ||
      gameState.runBossClears > 0 ||
      gameState.bestTierReached > 1;

    if (!hasMeaningfulRun) {
      return;
    }

    const runSummary = createArenaRunMetaSummary(gameState);
    setArenaMeta((previousMetaState) => {
      const nextMetaState = applyArenaRunSummary(previousMetaState, runSummary);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  }, [gameState, hasStarted, isMetaReady]);

  const closeArmoryPanel = () => {
    setIsArmoryOpen(false);
    const shouldResume = armoryResumeOnCloseRef.current && hasStarted && gameState.status === 'running';
    armoryResumeOnCloseRef.current = false;
    if (shouldResume) {
      setIsPaused(false);
    }
  };

  const handleOpenArmory = () => {
    if (!hasStarted || gameState.status !== 'running' || isMenuOpen || !hasArmoryChoices) {
      return;
    }
    armoryResumeOnCloseRef.current = !isPaused;
    setIsPaused(true);
    setIsMenuOpen(false);
    setIsArmoryOpen(true);
  };

  const handleRestart = () => {
    if (boardSize.width <= 0) {
      return;
    }
    finalizeRunMetaProgress();
    const nextState = createInitialArenaState(boardSize.width);
    playerVisualX.value = boardSize.width / 2;
    setGameState(setArenaBuild(nextState, gameState.activeBuild));
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
    setIsArmoryOpen(false);
    setMenuTab('run');
    armoryResumeOnCloseRef.current = false;
    runMetaCommittedRef.current = false;
  };

  const handleSelectBuild = (buildId: ArenaBuildId) => {
    setGameState((previousState) => setArenaBuild(previousState, buildId));
  };

  const handleSwitchGame = (nextGame: AppGameId) => {
    finalizeRunMetaProgress();
    onSwitchGame(nextGame);
  };

  const handleSelectArmoryUpgrade = (key: keyof typeof ARENA_ARMORY_UPGRADES) => {
    if (!hasArmoryChoices) {
      return;
    }
    if (isArenaArmoryUpgradeMaxed(key, gameState.weapon)) {
      return;
    }

    const shouldCloseAfterInstall = gameState.availableArmoryChoices <= 1;

    setGameState((previousState) => {
      if (previousState.availableArmoryChoices <= 0) {
        return previousState;
      }
      return applyArenaArmoryUpgrade(previousState, key);
    });

    if (shouldCloseAfterInstall) {
      requestAnimationFrame(() => {
        closeArmoryPanel();
      });
    }
  };
  const hullRatio = gameState.hull / gameState.maxHull;
  const armoryButtonDisabled = !hasStarted || gameState.status !== 'running' || isMenuOpen || isArmoryOpen || !hasArmoryChoices;
  const ultimateButtonDisabled = isPaused || isArmoryOpen || isMenuOpen || gameState.status !== 'running';
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

      <View style={arenaStyles.overviewStrip}>
        <View style={arenaStyles.overviewItem}>
          <Text style={arenaStyles.overviewSymbol}>★</Text>
          <Text style={arenaStyles.overviewValue}>{gameState.score}</Text>
        </View>
        <View style={arenaStyles.overviewDivider} />
        <View style={arenaStyles.overviewItem}>
          <Text style={arenaStyles.overviewSymbol}>T</Text>
          <Text style={arenaStyles.overviewValue}>T{displayTier}</Text>
        </View>
        <View style={arenaStyles.overviewDivider} />
        <View style={arenaStyles.overviewItem}>
          <Text style={arenaStyles.overviewSymbol}>▣</Text>
          <Text style={[arenaStyles.overviewValue, { color: activeBuildMeta.accent }]}>
            {activeBuildMeta.shortLabel}
          </Text>
        </View>
        <View style={arenaStyles.overviewDivider} />
        <View style={arenaStyles.overviewItem}>
          <Text style={arenaStyles.overviewSymbol}>✦</Text>
          <Text style={arenaStyles.overviewValue}>{activeWeapon.damage}</Text>
        </View>
        <View style={arenaStyles.overviewDivider} />
        <View style={arenaStyles.overviewItem}>
          <Text style={arenaStyles.overviewSymbol}>⏱</Text>
          <Text style={arenaStyles.overviewValue}>{fireRate}/s</Text>
        </View>
        <View style={arenaStyles.overviewDivider} />
        <View style={arenaStyles.overviewItem}>
          <Text style={arenaStyles.overviewSymbol}>➤</Text>
          <Text style={arenaStyles.overviewValue}>{Math.round(activeWeapon.bulletSpeed)}</Text>
        </View>
      </View>

      <View style={arenaStyles.resourceStrip}>
        <View style={arenaStyles.resourceItem}>
          <View style={arenaStyles.resourceHeader}>
            <Text style={arenaStyles.resourceSymbol}>+</Text>
            <Text style={[arenaStyles.resourceValue, hullRatio <= 0.35 && arenaStyles.resourceValueDanger]}>
              {Math.ceil(gameState.hull)} / {Math.ceil(gameState.maxHull)}
            </Text>
          </View>
          <View style={arenaStyles.hudMeter}>
            <View
              style={[
                arenaStyles.hudMeterFill,
                arenaStyles.hudMeterFillHealth,
                { width: `${healthProgress * 100}%` },
              ]}
            />
          </View>
        </View>
        <View style={arenaStyles.resourceItem}>
          <View style={arenaStyles.resourceHeader}>
            <Text style={arenaStyles.resourceSymbol}>🛡</Text>
            <Text style={[arenaStyles.resourceValue, arenaStyles.resourceValueShield]}>
              {Math.ceil(gameState.shield)} / {Math.ceil(gameState.maxShield)}
            </Text>
          </View>
          <View style={arenaStyles.hudMeter}>
            <View
              style={[
                arenaStyles.hudMeterFill,
                arenaStyles.hudMeterFillShield,
                { width: `${shieldProgress * 100}%` },
              ]}
            />
          </View>
        </View>
        <View style={arenaStyles.resourceItem}>
          <View style={arenaStyles.resourceHeader}>
            <Text style={arenaStyles.resourceSymbol}>◈</Text>
            <Text style={arenaStyles.resourceValue}>
              {gameState.salvage} / {gameState.nextArmoryCost}
            </Text>
          </View>
          <View style={arenaStyles.hudMeter}>
            <View
              style={[
                arenaStyles.hudMeterFill,
                arenaStyles.hudMeterFillSalvage,
                { width: `${salvageProgress * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={arenaStyles.boardFrame}>
        <View
          onLayout={handleBoardLayout}
          style={[
            arenaStyles.board,
            {
              transform: [{ translateX: boardShakeX }, { translateY: boardShakeY }],
            },
          ]}>
          <ArenaCanvas boardWidth={boardSize.width} boardHeight={boardSize.height} state={gameState} vfxQuality={vfxQuality} />

          <GestureDetector gesture={panGesture}>
            <View style={arenaStyles.gestureLayer} />
          </GestureDetector>

          <Animated.View
            pointerEvents="none"
            style={[
              arenaStyles.playerShell,
              { top: Math.max(0, boardSize.height - ARENA_PLAYER_HEIGHT - ARENA_PLAYER_FLOOR_OFFSET - 6) },
              playerShellAnimatedStyle,
              gameState.playerFlash > 0 && arenaStyles.playerShellHit,
            ]}>
            <View style={arenaStyles.playerThrusterGlow} />
            <View style={arenaStyles.playerWingBaseLeft} />
            <View style={arenaStyles.playerWingBaseRight} />
            <View style={arenaStyles.playerFuselage}>
              <View style={arenaStyles.playerCanopy} />
              <View style={arenaStyles.playerSpine} />
            </View>
            <View style={arenaStyles.playerNose} />
            <View style={arenaStyles.playerEngineLeft} />
            <View style={arenaStyles.playerEngineRight} />
          </Animated.View>

          <View pointerEvents="none" style={arenaStyles.versionBadge}>
            <Text style={arenaStyles.versionBadgeText}>{ARENA_VERSION_LABEL}</Text>
          </View>

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
            onPress={handleOpenArmory}
            disabled={armoryButtonDisabled}
            style={[
              arenaStyles.sideControlButton,
              arenaStyles.sideControlButtonLeft,
              hasArmoryChoices && arenaStyles.armoryButtonReady,
              armoryButtonDisabled && arenaStyles.sideControlButtonDisabled,
              {
                top: sideControlTop,
                borderColor: hasArmoryChoices
                  ? hexToRgba('#E6F6FF', 0.54 + armoryReadyPulse * 0.28)
                  : '#385673',
                backgroundColor: hasArmoryChoices
                  ? hexToRgba('#183F61', 0.86 + armoryReadyPulse * 0.12)
                  : 'rgba(10, 20, 30, 0.9)',
                shadowOpacity: hasArmoryChoices ? 0.26 + armoryReadyPulse * 0.26 : 0,
                shadowRadius: hasArmoryChoices ? 12 + armoryReadyPulse * 9 : 0,
              },
            ]}>
            <View
              pointerEvents="none"
              style={[
                arenaStyles.armoryButtonGlow,
                {
                  opacity: hasArmoryChoices ? 0.2 + armoryReadyPulse * 0.28 : 0,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                arenaStyles.armoryButtonCoreGlow,
                {
                  opacity: hasArmoryChoices ? 0.14 + armoryReadyPulse * 0.26 : 0,
                  transform: [{ scale: 0.9 + armoryReadyPulse * 0.18 }],
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                arenaStyles.armoryButtonPulseRing,
                {
                  opacity: hasArmoryChoices ? 0.18 + armoryReadyPulse * 0.28 : 0,
                  transform: [{ scale: 0.92 + armoryReadyPulse * 0.08 }],
                },
              ]}
            />
            <ArmoryControlIcon />
            {hasArmoryChoices ? (
              <View style={arenaStyles.sideControlBadge}>
                <Text style={arenaStyles.sideControlBadgeText}>{gameState.availableArmoryChoices}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={handleActivateUltimate}
            disabled={ultimateButtonDisabled}
            style={[
              arenaStyles.sideControlButton,
              arenaStyles.sideControlButtonRight,
              arenaStyles.ultimateButton,
              ultimateReady && arenaStyles.ultimateButtonReady,
              ultimateButtonDisabled && arenaStyles.sideControlButtonDisabled,
              {
                top: sideControlTop,
                shadowOpacity: ultimateReady ? 0.2 + ultimateReadyPulse * 0.18 : 0,
                shadowRadius: ultimateReady ? 10 + ultimateReadyPulse * 7 : 0,
              },
            ]}>
            {ultimateReady ? (
              <View
                pointerEvents="none"
                style={[
                  arenaStyles.ultimateReadyGlow,
                  {
                    opacity: 0.16 + ultimateReadyPulse * 0.18,
                  },
                ]}
              />
            ) : null}
            <UltimateControlIcon ready={ultimateReady} chargeProgress={ultimateChargeProgress} />
            <View style={arenaStyles.ultimateButtonMeter}>
              <View style={[arenaStyles.ultimateButtonFill, { width: `${ultimateChargeProgress * 100}%` }]} />
            </View>
          </Pressable>
        </View>

        {isArmoryOpen ? (
          <View style={arenaStyles.armoryOverlay}>
            <View style={arenaStyles.armoryPanel}>
              <View style={arenaStyles.armoryHeaderRow}>
                <View style={arenaStyles.armoryHeaderCopy}>
                  <Text style={arenaStyles.armoryTitle}>Armory</Text>
                  <Text style={arenaStyles.armorySubtitle}>{armorySubtitle}</Text>
                </View>
                <Pressable onPress={closeArmoryPanel} style={arenaStyles.armoryCloseButton}>
                  <Text style={arenaStyles.armoryCloseButtonText}>Close</Text>
                </Pressable>
              </View>
              <Text style={arenaStyles.armoryPrompt}>
                Pick one permanent install. Remaining upgrades stay banked until you open the armory again.
              </Text>
              <View style={arenaStyles.armoryCountChip}>
                <Text style={arenaStyles.armoryCountChipText}>{armoryAvailabilityLabel}</Text>
              </View>

              <ScrollView style={arenaStyles.armoryOptionsScroll} contentContainerStyle={arenaStyles.armoryOptions}>
                {armoryUpgrades.map(({ key, definition, isMaxed }) => (
                  <Pressable
                    key={key}
                    disabled={isMaxed}
                    onPress={() => handleSelectArmoryUpgrade(key)}
                    style={[arenaStyles.armoryCard, isMaxed && arenaStyles.armoryCardDisabled]}>
                    {isMaxed ? (
                      <View style={arenaStyles.armoryCardMaxBadge}>
                        <Text style={arenaStyles.armoryCardMaxBadgeText}>MAX</Text>
                      </View>
                    ) : null}
                    <View style={arenaStyles.armoryCardTopRow}>
                      <Text style={arenaStyles.armoryCardIcon}>{definition.icon}</Text>
                      <Text style={[arenaStyles.armoryCardStat, isMaxed && arenaStyles.armoryCardStatDisabled]}>
                        {definition.statLine}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={[arenaStyles.armoryCardLabel, isMaxed && arenaStyles.armoryCardLabelDisabled]}>
                      {definition.label}
                    </Text>
                    <Text numberOfLines={1} style={[arenaStyles.armoryCardText, isMaxed && arenaStyles.armoryCardTextDisabled]}>
                      {definition.compactHint}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {isMenuOpen ? (
          <View style={arenaStyles.menuPanel}>
            <Text style={arenaStyles.menuTitle}>Arena Prototype Menu</Text>
            <View style={arenaStyles.menuSegmentRow}>
              {(['run', 'codex', 'mastery'] as ArenaMenuTab[]).map((tab) => (
                <Pressable
                  key={`menu-tab-${tab}`}
                  onPress={() => setMenuTab(tab)}
                  style={[arenaStyles.menuSegmentButton, menuTab === tab && arenaStyles.menuSegmentButtonActive]}>
                  <Text style={[arenaStyles.menuSegmentText, menuTab === tab && arenaStyles.menuSegmentTextActive]}>
                    {tab === 'run' ? 'Run' : tab === 'codex' ? 'Codex' : 'Mastery'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {menuTab === 'run' ? (
              <>
                <Text style={arenaStyles.menuLabel}>Game</Text>
                <View style={arenaStyles.menuRow}>
                  <Pressable style={[arenaStyles.menuButton, arenaStyles.menuButtonActive]}>
                    <Text style={arenaStyles.menuButtonText}>Arena V2</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSwitchGame('prototype')} style={arenaStyles.menuButton}>
                    <Text style={arenaStyles.menuButtonText}>Shooter Test</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSwitchGame('defender')} style={arenaStyles.menuButton}>
                    <Text style={arenaStyles.menuButtonText}>Defender</Text>
                  </Pressable>
                </View>

                <Text style={arenaStyles.menuLabel}>VFX</Text>
                <View style={arenaStyles.menuRow}>
                  <Pressable
                    onPress={() => setVfxQuality('balanced')}
                    style={[arenaStyles.menuButton, vfxQuality === 'balanced' && arenaStyles.menuButtonActive]}>
                    <Text style={arenaStyles.menuButtonText}>Balanced</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setVfxQuality('high')}
                    style={[arenaStyles.menuButton, vfxQuality === 'high' && arenaStyles.menuButtonActive]}>
                    <Text style={arenaStyles.menuButtonText}>High</Text>
                  </Pressable>
                </View>

                <Text style={arenaStyles.menuLabel}>Build</Text>
                <View style={arenaStyles.menuBuildGrid}>
                  {ARENA_BUILD_ORDER.map((buildId) => {
                    const buildMeta = ARENA_BUILD_META[buildId];
                    const isActive = gameState.activeBuild === buildId;
                    return (
                      <Pressable
                        key={`build-${buildId}`}
                        onPress={() => handleSelectBuild(buildId)}
                        style={[arenaStyles.menuBuildButton, isActive && arenaStyles.menuBuildButtonActive]}>
                        <Text style={[arenaStyles.menuBuildTitle, isActive && { color: buildMeta.accent }]}>
                          {buildMeta.label}
                        </Text>
                        <Text numberOfLines={2} style={arenaStyles.menuBuildText}>
                          {buildMeta.summary}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={arenaStyles.menuLabel}>Notes</Text>
                <View style={arenaStyles.menuBuildDetailsCard}>
                  <Text style={[arenaStyles.menuBuildDetailsTitle, { color: activeBuildMeta.accent }]}>
                    {activeBuildMeta.label}
                  </Text>
                  <Text style={arenaStyles.menuBuildDetailsText}>{activeBuildMeta.description}</Text>
                  <Text style={arenaStyles.menuBuildDetailsText}>
                    Ultimate: {activeBuildMeta.ultimateLabel}. {activeBuildMeta.ultimateDescription}
                  </Text>
                </View>

                <View style={arenaStyles.menuActions}>
                  <Pressable onPress={handleRestart} style={[arenaStyles.menuActionButton, arenaStyles.menuActionPrimary]}>
                    <Text style={arenaStyles.menuActionText}>Restart Run</Text>
                  </Pressable>
                </View>
              </>
            ) : menuTab === 'codex' ? (
              <ScrollView style={arenaStyles.menuScroll} contentContainerStyle={arenaStyles.menuScrollContent}>
                {!isMetaReady ? (
                  <Text style={arenaStyles.menuBuildDetailsText}>Loading persistent codex data...</Text>
                ) : (
                  <>
                    <Text style={arenaStyles.menuLabel}>Reward Hooks</Text>
                    <View style={arenaStyles.unlockChipRow}>
                      {globalUnlockEntries.map((entry) => (
                        <UnlockChip key={`codex-unlock-${entry.id}`} entry={entry} />
                      ))}
                    </View>

                    <Text style={arenaStyles.menuLabel}>Enemy Log</Text>
                    <View style={arenaStyles.codexGrid}>
                      {codexEnemyEntries.map((entry) => {
                        const isLocked = !entry.discovered;
                        return (
                          <View key={`codex-enemy-${entry.kind}`} style={[arenaStyles.codexCard, isLocked && arenaStyles.codexCardLocked]}>
                            <View style={arenaStyles.codexCardHeader}>
                              <Text style={[arenaStyles.codexCardTitle, isLocked && arenaStyles.codexCardTitleLocked]}>
                                {isLocked ? 'Locked Signal' : entry.label}
                              </Text>
                              <Text style={arenaStyles.codexCardMeta}>
                                {isLocked ? 'Awaiting encounter' : `Seen T${entry.firstSeenTier ?? '-'}`}
                              </Text>
                            </View>
                            <Text style={[arenaStyles.codexCardText, isLocked && arenaStyles.codexCardTextLocked]}>
                              {isLocked
                                ? `Encounter ${ARENA_ENEMY_LABELS[entry.kind]} once to unlock this log entry.`
                                : entry.summary}
                            </Text>
                            {!isLocked ? (
                              <View style={arenaStyles.codexStatRow}>
                                <Text style={arenaStyles.codexStatText}>Kills {entry.totalKills}</Text>
                                <Text style={arenaStyles.codexStatText}>
                                  {entry.firstKillTier ? `First kill T${entry.firstKillTier}` : 'No kill logged'}
                                </Text>
                                <Text style={arenaStyles.codexStatText}>
                                  {entry.bossClears > 0
                                    ? `Boss clears ${entry.bossClears}`
                                    : entry.firstClearTier
                                      ? `First clear T${entry.firstClearTier}`
                                      : 'No clear logged'}
                                </Text>
                              </View>
                            ) : null}
                            {!isLocked && entry.kind === 'hiveCarrierBoss' ? (
                              <UnlockChip entry={arenaMeta.unlocks.hiveCarrierFirstClear} accentColor="#93F0D5" />
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    <Text style={arenaStyles.menuLabel}>Build Log</Text>
                    <View style={arenaStyles.codexGrid}>
                      {ARENA_BUILD_ORDER.map((buildId) => {
                        const buildEntry = arenaMeta.codexBuilds[buildId];
                        const masteryEntry = arenaMeta.mastery[buildId];
                        const buildUnlockEntries = getArenaBuildUnlockIds(buildId).map((unlockId) => arenaMeta.unlocks[unlockId]);
                        return (
                          <View key={`codex-build-${buildId}`} style={arenaStyles.codexCard}>
                            <View style={arenaStyles.codexCardHeader}>
                              <Text style={[arenaStyles.codexCardTitle, { color: ARENA_BUILD_META[buildId].accent }]}>
                                {buildEntry.label}
                              </Text>
                              <Text style={arenaStyles.codexCardMeta}>
                                L{masteryEntry.level} {masteryEntry.title}
                              </Text>
                            </View>
                            <Text style={arenaStyles.codexCardText}>{buildEntry.description}</Text>
                            <Text style={arenaStyles.codexStatText}>
                              Ultimate: {buildEntry.ultimateLabel}. {buildEntry.ultimateDescription}
                            </Text>
                            <View style={arenaStyles.unlockChipRow}>
                              {buildUnlockEntries.map((entry) => (
                                <UnlockChip key={`codex-build-unlock-${entry.id}`} entry={entry} accentColor={ARENA_BUILD_META[buildId].accent} />
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </ScrollView>
            ) : (
              <ScrollView style={arenaStyles.menuScroll} contentContainerStyle={arenaStyles.menuScrollContent}>
                {!isMetaReady ? (
                  <Text style={arenaStyles.menuBuildDetailsText}>Loading mastery records...</Text>
                ) : (
                  <>
                    <View style={arenaStyles.masteryIntroCard}>
                      <Text style={arenaStyles.masteryIntroText}>
                        Mastery XP is granted at run end to the build with the most active time. Ties resolve to the build you finish on.
                      </Text>
                    </View>
                    {masteryCards.map(({ buildId, buildMeta, mastery, progress, unlockEntries, nextUnlock }) => (
                      <View
                        key={`mastery-${buildId}`}
                        style={[arenaStyles.masteryCard, gameState.activeBuild === buildId && arenaStyles.masteryCardActive]}>
                        <View style={arenaStyles.masteryHeaderRow}>
                          <View style={arenaStyles.masteryHeaderCopy}>
                            <Text style={[arenaStyles.masteryTitle, { color: buildMeta.accent }]}>{buildMeta.label}</Text>
                            <Text style={arenaStyles.masterySubtitle}>
                              Level {mastery.level} • {mastery.title}
                            </Text>
                          </View>
                          <Text style={arenaStyles.masteryXpText}>{mastery.xp} XP</Text>
                        </View>
                        <View style={arenaStyles.masteryMeter}>
                          <View
                            style={[
                              arenaStyles.masteryMeterFill,
                              {
                                width: `${progress.progress * 100}%`,
                                backgroundColor: hexToRgba(buildMeta.accent, 0.72),
                              },
                            ]}
                          />
                        </View>
                        <Text style={arenaStyles.masteryThresholdText}>
                          {progress.nextThreshold > progress.currentThreshold
                            ? `${progress.currentThreshold} / ${progress.nextThreshold} threshold`
                            : 'Top rank reached'}
                        </Text>
                        <Text style={arenaStyles.masteryThresholdText}>
                          {nextUnlock
                            ? `Next unlock: ${nextUnlock.rewardLabel} • ${nextUnlock.description}`
                            : 'All current mastery reward hooks unlocked'}
                        </Text>
                        <View style={arenaStyles.masteryStatRow}>
                          <Text style={arenaStyles.masteryStatText}>Best tier T{mastery.bestTier}</Text>
                          <Text style={arenaStyles.masteryStatText}>Mini-boss {mastery.miniBossClears}</Text>
                          <Text style={arenaStyles.masteryStatText}>Boss {mastery.bossClears}</Text>
                          <Text style={arenaStyles.masteryStatText}>Runs {mastery.runs}</Text>
                        </View>
                        <View style={arenaStyles.unlockChipRow}>
                          {unlockEntries.map((entry) => (
                            <UnlockChip key={`mastery-unlock-${entry.id}`} entry={entry} accentColor={buildMeta.accent} />
                          ))}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
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
              <Pressable onPress={() => handleSwitchGame('prototype')} style={[arenaStyles.menuActionButton, arenaStyles.menuActionSecondary]}>
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
    paddingBottom: 6,
  },
  containerPortrait: {
    paddingHorizontal: 10,
  },
  topBar: {
    height: 34,
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
    paddingVertical: 4,
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
    fontSize: 12,
    fontWeight: '800',
  },
  statusPill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24405D',
    backgroundColor: '#0E1A28',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    color: '#BFD4F1',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickButton: {
    minWidth: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D4E6B',
    backgroundColor: '#112133',
    paddingVertical: 4,
    alignItems: 'center',
  },
  quickButtonActive: {
    borderColor: '#7FB8FF',
    backgroundColor: '#173653',
  },
  quickButtonText: {
    color: '#E6F1FF',
    fontSize: 11,
    fontWeight: '800',
  },
  overviewStrip: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25425E',
    backgroundColor: '#0C1827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  overviewSymbol: {
    color: '#86A8CD',
    fontSize: 9,
    fontWeight: '800',
  },
  overviewValue: {
    color: '#EAF4FF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  overviewDivider: {
    width: 1,
    height: 15,
    backgroundColor: '#243E58',
    marginHorizontal: 2,
  },
  resourceStrip: {
    marginTop: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24405D',
    backgroundColor: '#0D1826',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    gap: 8,
  },
  resourceItem: {
    flex: 1,
    gap: 3,
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  resourceSymbol: {
    color: '#8CA8C8',
    fontSize: 11,
    fontWeight: '900',
  },
  resourceValue: {
    color: '#E7F0FF',
    fontSize: 10,
    fontWeight: '800',
  },
  resourceValueDanger: {
    color: '#FFD3C6',
  },
  resourceValueShield: {
    color: '#D1F8FF',
  },
  topHudRow: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 6,
  },
  meterRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 6,
  },
  statRow: {
    marginTop: 4,
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
    paddingVertical: 5,
  },
  hudMeterChip: {
    gap: 4,
  },
  meterCard: {
    minHeight: 44,
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
    height: 14,
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
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24405D',
    backgroundColor: '#0E1A28',
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
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
  versionBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#284764',
    backgroundColor: 'rgba(8, 19, 31, 0.84)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  versionBadgeText: {
    color: '#8BA9CB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
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
    width: 60,
    height: 42,
    alignItems: 'center',
  },
  playerShellHit: {
    opacity: 0.82,
  },
  playerThrusterGlow: {
    position: 'absolute',
    bottom: 1,
    width: 42,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(110, 231, 255, 0.2)',
  },
  playerFuselage: {
    width: 20,
    height: 27,
    borderRadius: 10,
    backgroundColor: '#5BDDF9',
    borderWidth: 1.4,
    borderColor: '#E9FCFF',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  playerCanopy: {
    marginTop: 4,
    width: 9,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFF0CA',
    borderWidth: 1,
    borderColor: '#FFF9EA',
  },
  playerSpine: {
    marginTop: 2,
    width: 4,
    height: 8,
    borderRadius: 3,
    backgroundColor: '#218EC0',
  },
  playerNose: {
    position: 'absolute',
    top: -3,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFE7B0',
  },
  playerWingBaseLeft: {
    position: 'absolute',
    left: 3,
    top: 16,
    width: 15,
    height: 8,
    borderRadius: 6,
    backgroundColor: '#2D79BD',
    transform: [{ rotate: '-14deg' }],
  },
  playerWingBaseRight: {
    position: 'absolute',
    right: 3,
    top: 16,
    width: 15,
    height: 8,
    borderRadius: 6,
    backgroundColor: '#2D79BD',
    transform: [{ rotate: '14deg' }],
  },
  playerEngineLeft: {
    position: 'absolute',
    left: 20,
    bottom: 2,
    width: 5,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFDCA1',
  },
  playerEngineRight: {
    position: 'absolute',
    right: 20,
    bottom: 2,
    width: 5,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFDCA1',
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
    maxHeight: '86%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#37536F',
    backgroundColor: '#0E1826',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  armoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  armoryHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  armoryTitle: {
    color: '#F5FAFF',
    fontSize: 17,
    fontWeight: '900',
  },
  armorySubtitle: {
    color: '#8FB2D4',
    fontSize: 11,
    fontWeight: '700',
  },
  armoryPrompt: {
    color: '#B9CCDF',
    fontSize: 11.5,
    lineHeight: 16,
  },
  armoryCloseButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#36526F',
    backgroundColor: '#122133',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  armoryCloseButtonText: {
    color: '#E8F2FF',
    fontSize: 11,
    fontWeight: '800',
  },
  armoryCountChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B6B8A',
    backgroundColor: '#102233',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  armoryCountChipText: {
    color: '#D9ECFF',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  armoryOptionsScroll: {
    maxHeight: 360,
  },
  armoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 4,
  },
  armoryCard: {
    width: '48%',
    minHeight: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#385470',
    backgroundColor: '#132131',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    position: 'relative',
  },
  armoryCardDisabled: {
    borderColor: '#29415B',
    backgroundColor: '#101B2A',
    opacity: 0.85,
  },
  armoryCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  armoryCardIcon: {
    color: '#BFD6F2',
    fontSize: 12,
    fontWeight: '900',
  },
  armoryCardStat: {
    color: '#DFF1FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  armoryCardStatDisabled: {
    color: '#8FA7C1',
  },
  armoryCardLabel: {
    color: '#F3F8FF',
    fontSize: 12,
    fontWeight: '800',
  },
  armoryCardLabelDisabled: {
    color: '#A8BAD0',
  },
  armoryCardText: {
    color: '#B4C7DB',
    fontSize: 10.5,
    lineHeight: 14,
  },
  armoryCardTextDisabled: {
    color: '#7F96AF',
  },
  armoryCardMaxBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6C8AA8',
    backgroundColor: 'rgba(15, 30, 47, 0.92)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 2,
  },
  armoryCardMaxBadgeText: {
    color: '#D2E5FA',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  menuPanel: {
    position: 'absolute',
    top: 56,
    left: 18,
    right: 18,
    bottom: 18,
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
  menuSegmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menuSegmentButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#304A66',
    backgroundColor: '#10202F',
    paddingVertical: 8,
    alignItems: 'center',
  },
  menuSegmentButtonActive: {
    borderColor: '#8BC5FF',
    backgroundColor: '#173654',
  },
  menuSegmentText: {
    color: '#9FB9D7',
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  menuSegmentTextActive: {
    color: '#F1F8FF',
  },
  menuLabel: {
    color: '#8DA8C8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    gap: 10,
    paddingBottom: 2,
  },
  menuRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menuBuildGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuBuildButton: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#355471',
    backgroundColor: '#122132',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  menuBuildButtonActive: {
    borderColor: '#8BC5FF',
    backgroundColor: '#163049',
  },
  menuBuildTitle: {
    color: '#EAF4FF',
    fontSize: 12,
    fontWeight: '800',
  },
  menuBuildText: {
    color: '#9EB9D8',
    fontSize: 10.5,
    lineHeight: 14,
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
  menuBuildDetails: {
    gap: 8,
  },
  menuBuildDetailsCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#304A66',
    backgroundColor: '#0E1D2D',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  menuBuildDetailsTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  menuBuildDetailsText: {
    color: '#A9BEDA',
    fontSize: 11.5,
    lineHeight: 16,
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
  codexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  codexCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#33526F',
    backgroundColor: '#0F1E2E',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 5,
  },
  codexCardLocked: {
    borderColor: '#293F57',
    backgroundColor: '#0C1723',
  },
  codexCardHeader: {
    gap: 3,
  },
  codexCardTitle: {
    color: '#F0F7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  codexCardTitleLocked: {
    color: '#A3B7CB',
  },
  codexCardMeta: {
    color: '#7F9EBC',
    fontSize: 10,
    fontWeight: '700',
  },
  codexCardText: {
    color: '#B3C7DB',
    fontSize: 10.5,
    lineHeight: 14,
  },
  codexCardTextLocked: {
    color: '#7D93A9',
  },
  codexStatRow: {
    gap: 3,
  },
  codexStatText: {
    color: '#D8E7F7',
    fontSize: 10,
    fontWeight: '700',
  },
  unlockChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unlockChip: {
    flexShrink: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  unlockChipUnlocked: {
    borderColor: '#4C7AA0',
    backgroundColor: '#112335',
  },
  unlockChipLocked: {
    borderColor: '#29435B',
    backgroundColor: '#0B1622',
  },
  unlockChipLabel: {
    color: '#EAF4FF',
    fontSize: 10,
    fontWeight: '800',
  },
  unlockChipLabelLocked: {
    color: '#9BB3C9',
  },
  unlockChipMeta: {
    color: '#87A0B9',
    fontSize: 9.5,
    lineHeight: 12,
  },
  masteryIntroCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#32506B',
    backgroundColor: '#10202F',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  masteryIntroText: {
    color: '#B5C9DE',
    fontSize: 11,
    lineHeight: 16,
  },
  masteryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34536F',
    backgroundColor: '#102030',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  masteryCardActive: {
    borderColor: '#7FBFFF',
    backgroundColor: '#13273A',
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  masteryHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  masteryTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  masterySubtitle: {
    color: '#BDD0E3',
    fontSize: 10.5,
    fontWeight: '700',
  },
  masteryXpText: {
    color: '#E8F3FF',
    fontSize: 11,
    fontWeight: '800',
  },
  masteryMeter: {
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#33506B',
    backgroundColor: '#0C1926',
    overflow: 'hidden',
  },
  masteryMeterFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  masteryThresholdText: {
    color: '#9AB3CD',
    fontSize: 10,
    fontWeight: '700',
  },
  masteryStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  masteryStatText: {
    color: '#D9E8F7',
    fontSize: 10,
    fontWeight: '700',
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
  sideControlButton: {
    position: 'absolute',
    width: 64,
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#385673',
    backgroundColor: 'rgba(10, 20, 30, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 6,
    shadowColor: '#9FD7FF',
  },
  sideControlButtonLeft: {
    left: 14,
  },
  sideControlButtonRight: {
    right: 14,
  },
  sideControlButtonDisabled: {
    opacity: 0.74,
  },
  armoryButtonReady: {
    shadowColor: '#96D2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  armoryButtonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#8BCBFF',
  },
  armoryButtonCoreGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: 'rgba(170, 228, 255, 0.86)',
  },
  armoryButtonPulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D9F5FF',
  },
  sideControlBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8F2FF',
    backgroundColor: 'rgba(12, 32, 48, 0.94)',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideControlBadgeText: {
    color: '#F1FBFF',
    fontSize: 10,
    fontWeight: '900',
  },
  armoryIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  armorySword: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  armorySwordLeft: {
    transform: [{ rotate: '-44deg' }],
  },
  armorySwordRight: {
    transform: [{ rotate: '44deg' }],
  },
  armorySwordBlade: {
    width: 4,
    height: 15,
    borderRadius: 4,
    backgroundColor: '#EFF9FF',
    borderWidth: 1,
    borderColor: '#BDE1FF',
  },
  armorySwordGuard: {
    marginTop: 1,
    width: 11,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#D7A767',
  },
  armorySwordGrip: {
    marginTop: 1,
    width: 3,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5A84A6',
  },
  armorySwordPommel: {
    marginTop: 1,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#BFDFFF',
  },
  ultimateButton: {
    justifyContent: 'center',
  },
  ultimateButtonReady: {
    borderColor: '#FFE2A8',
    backgroundColor: 'rgba(56, 40, 14, 0.94)',
  },
  ultimateButtonMeter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    backgroundColor: 'rgba(23, 41, 60, 0.66)',
  },
  ultimateButtonFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 192, 96, 0.54)',
  },
  ultimateReadyGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFD285',
  },
  ultimateIconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ultimateIconRay: {
    position: 'absolute',
    width: 2,
    borderRadius: 999,
    backgroundColor: '#E9F5FF',
  },
  ultimateIconRayLong: {
    height: 20,
  },
  ultimateIconRayShort: {
    height: 14,
  },
  ultimateIconRayReady: {
    backgroundColor: '#FFF1C8',
  },
  ultimateIconSpark: {
    position: 'absolute',
    width: 2,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#BFD9F4',
  },
  ultimateIconSparkReady: {
    backgroundColor: '#FFE3AA',
  },
  ultimateIconRing: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D4E6F8',
    backgroundColor: 'rgba(11, 23, 35, 0.34)',
  },
  ultimateIconRingReady: {
    borderColor: '#FFE6B3',
    backgroundColor: 'rgba(58, 41, 12, 0.32)',
  },
  ultimateIconCore: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#EDF7FF',
  },
  ultimateIconCoreReady: {
    backgroundColor: '#FFF0CA',
  },
});
