import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { FIXED_STEP_SECONDS, TOWER_TYPES } from '@/src/game/config';
import {
  canPlaceTower,
  canUpgradeTower,
  createInitialGameState,
  cycleTowerTargetMode,
  getTowerSellValue,
  getTowerStats,
  getTowerUpgradeCost,
  placeTower,
  sellTower,
  tickGame,
  upgradeTower,
} from '@/src/game/engine';
import { BoardCanvas } from '@/src/game/BoardCanvas';
import { getDefaultGameLevelIdForMap, listGameLevels, loadGameLevel } from '@/src/game/levels';
import { DEFAULT_GAME_MAP_ID, listGameMaps, loadGameMap } from '@/src/game/maps';
import { cellCenter } from '@/src/game/path';
import type { GameEvent, GameLevelId, GameMapId, TargetMode, TowerTypeId } from '@/src/game/types';

const BOARD_PADDING = 14;
const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  first: 'First',
  last: 'Last',
  strong: 'Strong',
};

type SimulationSpeed = 1 | 2 | 3;
type SoundEffectKey =
  | 'spawn'
  | 'hit'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'targetMode'
  | 'pulseFire'
  | 'lanceFire'
  | 'sprayFire'
  | 'bombFire'
  | 'coldFire'
  | 'laserFire'
  | 'bombImpact'
  | 'coldImpact';

const SOUND_FILES: Record<SoundEffectKey, number> = {
  spawn: require('../../assets/sfx/spawn.wav'),
  hit: require('../../assets/sfx/hit.wav'),
  place: require('../../assets/sfx/place.wav'),
  upgrade: require('../../assets/sfx/upgrade.wav'),
  sell: require('../../assets/sfx/sell.wav'),
  targetMode: require('../../assets/sfx/target-mode.wav'),
  pulseFire: require('../../assets/sfx/hit.wav'),
  lanceFire: require('../../assets/sfx/lance-fire.wav'),
  sprayFire: require('../../assets/sfx/hit.wav'),
  bombFire: require('../../assets/sfx/bomb-fire.wav'),
  coldFire: require('../../assets/sfx/cold-fire.wav'),
  laserFire: require('../../assets/sfx/laser-fire.wav'),
  bombImpact: require('../../assets/sfx/bomb-hit.wav'),
  coldImpact: require('../../assets/sfx/cold-hit.wav'),
};

const SOUND_POOL_SIZE: Record<SoundEffectKey, number> = {
  spawn: 2,
  hit: 3,
  place: 2,
  upgrade: 2,
  sell: 2,
  targetMode: 1,
  pulseFire: 4,
  lanceFire: 2,
  sprayFire: 4,
  bombFire: 2,
  coldFire: 3,
  laserFire: 2,
  bombImpact: 2,
  coldImpact: 3,
};

const SOUND_VOLUMES: Record<SoundEffectKey, number> = {
  spawn: 0.32,
  hit: 0.24,
  place: 0.32,
  upgrade: 0.36,
  sell: 0.28,
  targetMode: 0.22,
  pulseFire: 0.14,
  lanceFire: 0.24,
  sprayFire: 0.1,
  bombFire: 0.22,
  coldFire: 0.16,
  laserFire: 0.14,
  bombImpact: 0.28,
  coldImpact: 0.18,
};

const SOUND_MIN_INTERVAL_MS: Record<SoundEffectKey, number> = {
  spawn: 80,
  hit: 55,
  place: 0,
  upgrade: 0,
  sell: 0,
  targetMode: 0,
  pulseFire: 85,
  lanceFire: 120,
  sprayFire: 45,
  bombFire: 140,
  coldFire: 100,
  laserFire: 160,
  bombImpact: 120,
  coldImpact: 90,
};

function createEmptySoundPool(): Record<SoundEffectKey, Audio.Sound[]> {
  return {
    spawn: [],
    hit: [],
    place: [],
    upgrade: [],
    sell: [],
    targetMode: [],
    pulseFire: [],
    lanceFire: [],
    sprayFire: [],
    bombFire: [],
    coldFire: [],
    laserFire: [],
    bombImpact: [],
    coldImpact: [],
  };
}

function createEmptySoundCursor(): Record<SoundEffectKey, number> {
  return {
    spawn: 0,
    hit: 0,
    place: 0,
    upgrade: 0,
    sell: 0,
    targetMode: 0,
    pulseFire: 0,
    lanceFire: 0,
    sprayFire: 0,
    bombFire: 0,
    coldFire: 0,
    laserFire: 0,
    bombImpact: 0,
    coldImpact: 0,
  };
}

function mapGameEventToSound(event: GameEvent): SoundEffectKey | null {
  if (event.type === 'targetMode') {
    return 'targetMode';
  }

  if (event.type === 'fire') {
    if (event.towerType === 'bomb') {
      return 'bombFire';
    }
    if (event.towerType === 'cold') {
      return 'coldFire';
    }
    if (event.towerType === 'laser') {
      return 'laserFire';
    }
    if (event.towerType === 'lance') {
      return 'lanceFire';
    }
    if (event.towerType === 'spray') {
      return 'sprayFire';
    }
    if (event.towerType === 'pulse') {
      return 'pulseFire';
    }
    return null;
  }

  if (event.type === 'hit') {
    if (event.towerType === 'bomb') {
      return 'bombImpact';
    }
    if (event.towerType === 'cold') {
      return 'coldImpact';
    }
    return 'hit';
  }

  if (event.type === 'splash') {
    return 'bombImpact';
  }

  if (event.type === 'chill') {
    return 'coldImpact';
  }

  return event.type;
}

export default function DefenseScreen() {
  const [gameState, setGameState] = useState(() => createInitialGameState(DEFAULT_GAME_MAP_ID));
  const [selectedBuildTower, setSelectedBuildTower] = useState<TowerTypeId>('pulse');
  const [selectedPlacedTowerId, setSelectedPlacedTowerId] = useState<string | null>(null);
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(1);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundsReady, setSoundsReady] = useState(false);

  const soundPoolsRef = useRef<Record<SoundEffectKey, Audio.Sound[]>>(createEmptySoundPool());
  const soundCursorRef = useRef<Record<SoundEffectKey, number>>(createEmptySoundCursor());
  const lastSoundAtRef = useRef<Record<SoundEffectKey, number>>({
    spawn: 0,
    hit: 0,
    place: 0,
    upgrade: 0,
    sell: 0,
    targetMode: 0,
    pulseFire: 0,
    lanceFire: 0,
    sprayFire: 0,
    bombFire: 0,
    coldFire: 0,
    laserFire: 0,
    bombImpact: 0,
    coldImpact: 0,
  });
  const gameMaps = useMemo(() => listGameMaps(), []);
  const activeLevel = useMemo(
    () => loadGameLevel(gameState.levelId ?? getDefaultGameLevelIdForMap(gameState.mapId)),
    [gameState.levelId, gameState.mapId]
  );
  const mapLevels = useMemo(() => listGameLevels(gameState.mapId), [gameState.mapId]);
  const waves = activeLevel.waves;
  const activeMap = useMemo(() => loadGameMap(gameState.mapId), [gameState.mapId]);

  const { width, height } = useWindowDimensions();
  const sidePanelWidth = Math.min(336, Math.max(260, width * 0.31));
  const boardMaxWidth = Math.max(260, width - sidePanelWidth - 42);
  const boardMaxHeight = Math.max(220, height - 96);
  const cellSize = Math.max(14, Math.min(boardMaxWidth / activeMap.cols, boardMaxHeight / activeMap.rows));
  const boardWidth = activeMap.cols * cellSize;
  const boardHeight = activeMap.rows * cellSize;

  const playSound = useCallback(
    async (soundKey: SoundEffectKey) => {
      if (!soundEnabled || !soundsReady) {
        return;
      }

      const pool = soundPoolsRef.current[soundKey];
      if (!pool.length) {
        return;
      }

      const now = Date.now();
      const minInterval = SOUND_MIN_INTERVAL_MS[soundKey];
      const lastPlayedAt = lastSoundAtRef.current[soundKey];
      if (minInterval > 0 && now - lastPlayedAt < minInterval) {
        return;
      }
      lastSoundAtRef.current[soundKey] = now;

      const nextCursor = soundCursorRef.current[soundKey] % pool.length;
      soundCursorRef.current[soundKey] = (nextCursor + 1) % pool.length;

      const sound = pool[nextCursor];
      try {
        await sound.replayAsync();
      } catch {
        // Ignore audio playback errors; gameplay should remain unaffected.
      }
    },
    [soundEnabled, soundsReady]
  );

  useEffect(() => {
    let disposed = false;

    const loadSounds = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });

        const nextPool = createEmptySoundPool();
        const keys = Object.keys(SOUND_FILES) as SoundEffectKey[];

        for (const soundKey of keys) {
          const poolSize = SOUND_POOL_SIZE[soundKey];
          for (let index = 0; index < poolSize; index += 1) {
            const sound = new Audio.Sound();
            await sound.loadAsync(SOUND_FILES[soundKey], {
              volume: SOUND_VOLUMES[soundKey],
            });
            nextPool[soundKey].push(sound);
          }
        }

        if (disposed) {
          for (const soundKey of keys) {
            for (const sound of nextPool[soundKey]) {
              await sound.unloadAsync();
            }
          }
          return;
        }

        soundPoolsRef.current = nextPool;
        setSoundsReady(true);
      } catch {
        setSoundsReady(false);
      }
    };

    void loadSounds();

    return () => {
      disposed = true;
      setSoundsReady(false);
      soundCursorRef.current = createEmptySoundCursor();
      lastSoundAtRef.current = {
        spawn: 0,
        hit: 0,
        place: 0,
        upgrade: 0,
        sell: 0,
        targetMode: 0,
        pulseFire: 0,
        lanceFire: 0,
        sprayFire: 0,
        bombFire: 0,
        coldFire: 0,
        laserFire: 0,
        bombImpact: 0,
        coldImpact: 0,
      };

      const keys = Object.keys(SOUND_FILES) as SoundEffectKey[];
      const pools = soundPoolsRef.current;
      soundPoolsRef.current = createEmptySoundPool();

      for (const soundKey of keys) {
        for (const sound of pools[soundKey]) {
          void sound.unloadAsync();
        }
      }
    };
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      if (isPaused) {
        return;
      }

      setGameState((previousState) => {
        return tickGame(previousState, FIXED_STEP_SECONDS * simulationSpeed);
      });
    }, 1000 / 30);

    return () => {
      clearInterval(timerId);
    };
  }, [isPaused, simulationSpeed]);

  useEffect(() => {
    if (!selectedPlacedTowerId) {
      return;
    }

    const stillExists = gameState.towers.some((tower) => tower.id === selectedPlacedTowerId);
    if (!stillExists) {
      setSelectedPlacedTowerId(null);
    }
  }, [gameState.towers, selectedPlacedTowerId]);

  useEffect(() => {
    if (!gameState.recentEvents.length) {
      return;
    }

    for (const event of gameState.recentEvents) {
      const soundKey = mapGameEventToSound(event);
      if (soundKey) {
        void playSound(soundKey);
      }
    }
  }, [gameState.recentEvents, playSound]);

  const statusText = useMemo(() => {
    if (gameState.status === 'won') {
      return 'Server stabilized. Waves cleared.';
    }

    if (gameState.status === 'lost') {
      return 'Core breached. Press restart.';
    }

    const wave = waves[gameState.waveIndex];
    if (!wave) {
      return 'Finishing simulation...';
    }

    if (gameState.timeUntilWaveStart > 0) {
      return `Wave ${gameState.waveIndex + 1} in ${gameState.timeUntilWaveStart.toFixed(1)}s`;
    }

    if (gameState.spawnedInWave < wave.count) {
      return `Spawning ${wave.enemyType} ${gameState.spawnedInWave}/${wave.count}`;
    }

    return `Cleanup phase: ${gameState.enemies.length} enemies left`;
  }, [gameState, waves]);

  const countdownSeconds = gameState.timeUntilWaveStart;
  const isCountdownActive = hasStarted && gameState.status === 'running' && countdownSeconds > 0;
  const isCountdownCritical = isCountdownActive && countdownSeconds <= 3;
  const isCountdownDanger = isCountdownActive && countdownSeconds <= 1.5;

  let displayStatusText = statusText;
  if (!hasStarted && gameState.status === 'running') {
    displayStatusText = 'Press Start to begin defense simulation.';
  } else if (isPaused && gameState.status === 'running') {
    displayStatusText = `${statusText} (Paused)`;
  }

  const selectedTowerType = TOWER_TYPES[selectedBuildTower];
  const selectedPlacedTower = useMemo(
    () => gameState.towers.find((tower) => tower.id === selectedPlacedTowerId) ?? null,
    [gameState.towers, selectedPlacedTowerId]
  );

  const selectedPlacedTowerStats = selectedPlacedTower ? getTowerStats(selectedPlacedTower) : null;
  const selectedUpgradeCost = selectedPlacedTower ? getTowerUpgradeCost(selectedPlacedTower) : null;
  const selectedSellValue = selectedPlacedTower ? getTowerSellValue(selectedPlacedTower) : null;
  const selectedTowerBadgePosition = useMemo(() => {
    if (!selectedPlacedTower) {
      return null;
    }

    const towerType = TOWER_TYPES[selectedPlacedTower.towerType];
    const levelScale = 1 + Math.max(0, selectedPlacedTower.level - 1) * 0.08;
    const radius = towerType.radius * cellSize * levelScale;
    const center = cellCenter(selectedPlacedTower.cell);

    return {
      left: center.x * cellSize + radius - 16,
      top: center.y * cellSize + radius - 14,
    };
  }, [cellSize, selectedPlacedTower]);

  const canUpgradeSelectedTower = selectedPlacedTower
    ? canUpgradeTower(gameState, selectedPlacedTower.id)
    : false;

  const handleRestart = () => {
    setGameState(createInitialGameState(gameState.mapId, gameState.levelId));
    setSelectedPlacedTowerId(null);
    setHasStarted(false);
    setIsPaused(true);
    setSimulationSpeed(1);
    setIsMenuOpen(false);
  };

  const handleBoardPress = (event: GestureResponderEvent) => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }

    const col = Math.floor(event.nativeEvent.locationX / cellSize);
    const row = Math.floor(event.nativeEvent.locationY / cellSize);

    const tappedTower = gameState.towers.find((tower) => tower.cell.col === col && tower.cell.row === row);
    if (tappedTower) {
      setSelectedPlacedTowerId((previousId) => (previousId === tappedTower.id ? null : tappedTower.id));
      return;
    }

    if (gameState.status !== 'running') {
      return;
    }

    setSelectedPlacedTowerId(null);

    setGameState((previousState) => {
      if (!canPlaceTower(previousState, { col, row }, selectedBuildTower)) {
        return previousState;
      }
      return placeTower(previousState, { col, row }, selectedBuildTower);
    });
  };

  const handleUpgradeTower = () => {
    if (!selectedPlacedTower) {
      return;
    }

    setGameState((previousState) => upgradeTower(previousState, selectedPlacedTower.id));
  };

  const handleSellTower = () => {
    if (!selectedPlacedTower) {
      return;
    }

    setGameState((previousState) => sellTower(previousState, selectedPlacedTower.id));
    setSelectedPlacedTowerId(null);
  };

  const handleCycleTargetMode = () => {
    if (!selectedPlacedTower) {
      return;
    }

    setGameState((previousState) => cycleTowerTargetMode(previousState, selectedPlacedTower.id));
  };

  const handleSwitchMap = (mapId: GameMapId) => {
    const nextLevelId = getDefaultGameLevelIdForMap(mapId);
    setGameState(createInitialGameState(mapId, nextLevelId));
    setSelectedPlacedTowerId(null);
    setHasStarted(false);
    setIsPaused(true);
    setSimulationSpeed(1);
    setIsMenuOpen(false);
  };

  const handleSwitchLevel = (levelId: GameLevelId) => {
    const level = loadGameLevel(levelId);
    setGameState(createInitialGameState(level.mapId, levelId));
    setSelectedPlacedTowerId(null);
    setHasStarted(false);
    setIsPaused(true);
    setSimulationSpeed(1);
    setIsMenuOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gameShell}>
        <View style={styles.boardPane}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => {
                if (!hasStarted) {
                  setHasStarted(true);
                  setIsPaused(false);
                  return;
                }
                setIsPaused((previousValue) => !previousValue);
              }}
              style={[
                styles.pauseButton,
                !hasStarted && styles.pauseButtonStart,
                hasStarted && isPaused && styles.pauseButtonActive,
              ]}>
              <Text style={styles.pauseButtonText}>
                {!hasStarted ? 'Start' : isPaused ? 'Resume' : 'Pause'}
              </Text>
            </Pressable>

            <View
              style={[
                styles.timerPill,
                isCountdownCritical && styles.timerPillCritical,
                isCountdownDanger && styles.timerPillDanger,
              ]}>
              <Text
                style={[
                  styles.timerText,
                  isCountdownCritical && styles.timerTextCritical,
                  isCountdownDanger && styles.timerTextDanger,
                ]}>
                {isCountdownActive
                  ? `Next ${countdownSeconds.toFixed(1)}s`
                  : `Wave ${Math.min(gameState.waveIndex + 1, waves.length)}/${waves.length}`}
              </Text>
            </View>

            <View style={styles.topBarRight}>
              <Pressable
                onPress={() => setSimulationSpeed((value) => (value === 2 ? 1 : 2))}
                style={[styles.quickButton, simulationSpeed === 2 && styles.quickButtonActive]}>
                <Text style={styles.quickButtonText}>2x {'>>'}</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsMenuOpen((value) => !value)}
                style={[styles.quickButton, isMenuOpen && styles.quickButtonActive]}>
                <Text style={styles.quickButtonText}>Menu</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.boardFrame}>
            <Pressable
              onPress={handleBoardPress}
              style={[
                styles.board,
                {
                  width: boardWidth,
                  height: boardHeight,
                },
              ]}>
          <BoardCanvas
            boardWidth={boardWidth}
            boardHeight={boardHeight}
            cellSize={cellSize}
            map={activeMap}
            state={gameState}
            selectedTowerId={selectedPlacedTowerId}
          />
          {selectedPlacedTower && selectedTowerBadgePosition ? (
            <View
              pointerEvents="none"
              style={[
                styles.towerLevelBadgeOverlay,
                {
                  left: selectedTowerBadgePosition.left,
                  top: selectedTowerBadgePosition.top,
                },
              ]}>
              <Text style={styles.towerLevel}>L{selectedPlacedTower.level}</Text>
            </View>
          ) : null}
            </Pressable>

            <Text
              style={[
                styles.statusText,
                isCountdownCritical && styles.statusTextCritical,
                isCountdownDanger && styles.statusTextDanger,
              ]}>
              {displayStatusText}
            </Text>
          </View>

          {isMenuOpen ? (
            <View style={styles.menuPanel}>
              <Text style={styles.menuTitle}>Menu</Text>
              <Text style={styles.menuLabel}>Map</Text>
              <View style={styles.menuMapRow}>
                {gameMaps.map((map) => {
                  const isActive = map.id === gameState.mapId;
                  return (
                    <Pressable
                      key={`menu-map-${map.id}`}
                      onPress={() => handleSwitchMap(map.id)}
                      style={[styles.menuMapButton, isActive && styles.menuMapButtonActive]}>
                      <Text style={styles.menuMapButtonText}>{map.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.menuLabel}>Level</Text>
              <View style={styles.menuLevelGrid}>
                {mapLevels.map((level) => {
                  const isActive = level.id === gameState.levelId;
                  return (
                    <Pressable
                      key={`menu-level-${level.id}`}
                      onPress={() => handleSwitchLevel(level.id)}
                      style={[styles.menuLevelButton, isActive && styles.menuLevelButtonActive]}>
                      <Text style={styles.menuLevelButtonText}>{level.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.menuActions}>
                <Pressable
                  onPress={() => setSoundEnabled((enabled) => !enabled)}
                  style={[styles.menuActionButton, !soundEnabled && styles.menuActionButtonMuted]}>
                  <Text style={styles.menuActionButtonText}>
                    {soundEnabled ? (soundsReady ? 'SFX On' : 'SFX Loading') : 'SFX Off'}
                  </Text>
                </Pressable>

                <Pressable onPress={handleRestart} style={[styles.menuActionButton, styles.menuRestartButton]}>
                  <Text style={styles.menuActionButtonText}>Restart</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.sidePanel, { width: sidePanelWidth }]}>
          <View style={styles.hudRow}>
            <View style={styles.hudChip}>
              <Text style={styles.hudLabel}>Credits</Text>
              <Text style={styles.hudValue}>${gameState.money}</Text>
            </View>
            <View style={styles.hudChip}>
              <Text style={styles.hudLabel}>Lives</Text>
              <Text style={styles.hudValue}>{gameState.lives}</Text>
            </View>
            <View style={styles.hudChip}>
              <Text style={styles.hudLabel}>Wave</Text>
              <Text style={styles.hudValue}>
                {Math.min(gameState.waveIndex + 1, waves.length)}/{waves.length}
              </Text>
            </View>
            <View style={styles.hudChip}>
              <Text style={styles.hudLabel}>Enemies</Text>
              <Text style={styles.hudValue}>{gameState.enemies.length}</Text>
            </View>
          </View>

          <View style={styles.toolbar}>
            {(Object.keys(TOWER_TYPES) as TowerTypeId[]).map((towerTypeId) => {
              const towerType = TOWER_TYPES[towerTypeId];
              const isSelected = selectedBuildTower === towerTypeId;
              const isAffordable = gameState.money >= towerType.cost;

              return (
                <Pressable
                  key={towerTypeId}
                  onPress={() => setSelectedBuildTower(towerTypeId)}
                  style={[
                    styles.towerCard,
                    { borderColor: towerType.color },
                    isSelected && styles.towerCardSelected,
                    !isAffordable && styles.towerCardDisabled,
                  ]}>
                  <Text style={styles.towerCardTitle}>{towerType.label}</Text>
                  <Text style={styles.towerCardMeta}>${towerType.cost}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.detailsShell}>
            {selectedPlacedTower && selectedPlacedTowerStats && selectedSellValue !== null ? (
              <View style={styles.selectedPanel}>
                <Text style={styles.selectedPanelTitle}>
                  {TOWER_TYPES[selectedPlacedTower.towerType].label} {selectedPlacedTower.id} Lv{' '}
                  {selectedPlacedTower.level}
                </Text>

                <Text style={styles.selectedPanelStats}>
                  Dmg {selectedPlacedTowerStats.damage} · Range {selectedPlacedTowerStats.range.toFixed(1)} · RoF{' '}
                  {selectedPlacedTowerStats.fireRate.toFixed(2)}
                </Text>

                <Pressable
                  onPress={handleCycleTargetMode}
                  style={[styles.panelButton, gameState.status !== 'running' && styles.panelButtonDisabled]}
                  disabled={gameState.status !== 'running'}>
                  <Text style={styles.panelButtonText}>
                    Target: {TARGET_MODE_LABELS[selectedPlacedTower.targetMode]}
                  </Text>
                </Pressable>

                <View style={styles.selectedPanelActions}>
                  <Pressable
                    onPress={handleUpgradeTower}
                    style={[styles.panelButton, !canUpgradeSelectedTower && styles.panelButtonDisabled]}
                    disabled={!canUpgradeSelectedTower}>
                    <Text style={styles.panelButtonText}>
                      {selectedUpgradeCost === null ? 'Max Level' : `Upgrade $${selectedUpgradeCost}`}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSellTower}
                    style={[styles.panelButton, gameState.status !== 'running' && styles.panelButtonDisabled]}
                    disabled={gameState.status !== 'running'}>
                    <Text style={styles.panelButtonText}>Sell +${selectedSellValue}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.helperText}>
                Tap grid to place {selectedTowerType.label} (${selectedTowerType.cost}). Tap placed towers to manage.
              </Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070C14',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  gameShell: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  boardPane: {
    flex: 1,
    minWidth: 0,
  },
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  pauseButton: {
    minWidth: 82,
    borderWidth: 1,
    borderColor: '#4A5D88',
    backgroundColor: '#222C44',
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  pauseButtonActive: {
    borderColor: '#D8AE5E',
    backgroundColor: '#58462A',
  },
  pauseButtonStart: {
    borderColor: '#4BD391',
    backgroundColor: '#174431',
  },
  pauseButtonText: {
    color: '#F7EDDA',
    fontSize: 12,
    fontWeight: '700',
  },
  timerPill: {
    marginHorizontal: 8,
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderColor: '#34598B',
    backgroundColor: '#132846',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  timerPillCritical: {
    borderColor: '#D18D3E',
    backgroundColor: '#442C13',
  },
  timerPillDanger: {
    borderColor: '#DE5D5D',
    backgroundColor: '#4A1E1E',
  },
  timerText: {
    color: '#ECF5FF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  timerTextCritical: {
    color: '#FFDFA8',
  },
  timerTextDanger: {
    color: '#FFD2D2',
  },
  quickButton: {
    minWidth: 78,
    borderWidth: 1,
    borderColor: '#2A5878',
    backgroundColor: '#11314A',
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  quickButtonActive: {
    borderColor: '#5F93D2',
    backgroundColor: '#1B4061',
  },
  quickButtonText: {
    color: '#E3F3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  boardFrame: {
    marginTop: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  statusText: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 6,
    color: '#AFC5E9',
    fontSize: 12,
    backgroundColor: '#081221CC',
    borderWidth: 1,
    borderColor: '#243855',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  statusTextCritical: {
    color: '#FFD6A1',
    fontWeight: '700',
  },
  statusTextDanger: {
    color: '#FFB3B3',
    fontWeight: '800',
  },
  menuPanel: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 300,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: '#334A70',
    backgroundColor: '#0C1626',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    zIndex: 4,
  },
  menuTitle: {
    color: '#EAF4FF',
    fontSize: 14,
    fontWeight: '700',
  },
  menuLabel: {
    color: '#9AB1D2',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuMapRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menuMapButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334462',
    borderRadius: 8,
    backgroundColor: '#101B2D',
    paddingVertical: 8,
    alignItems: 'center',
  },
  menuMapButtonActive: {
    borderColor: '#90B8FF',
    backgroundColor: '#1A2A45',
  },
  menuMapButtonText: {
    color: '#DFEAFF',
    fontSize: 12,
    fontWeight: '700',
  },
  menuLevelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuLevelButton: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#334462',
    borderRadius: 8,
    backgroundColor: '#101B2D',
    paddingVertical: 8,
    alignItems: 'center',
  },
  menuLevelButtonActive: {
    borderColor: '#9ED88C',
    backgroundColor: '#1F3A2B',
  },
  menuLevelButtonText: {
    color: '#DFEAFF',
    fontSize: 12,
    fontWeight: '700',
  },
  menuActions: {
    flexDirection: 'row',
    gap: 8,
  },
  menuActionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A5878',
    backgroundColor: '#11314A',
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  menuActionButtonMuted: {
    borderColor: '#4F425C',
    backgroundColor: '#2A2133',
  },
  menuRestartButton: {
    borderColor: '#4A5D88',
    backgroundColor: '#222C44',
  },
  menuActionButtonText: {
    color: '#E3F3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  sidePanel: {
    gap: 8,
  },
  hudRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hudChip: {
    width: '48%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22314A',
    backgroundColor: '#0D1522',
  },
  hudLabel: {
    color: '#7E91B0',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  hudValue: {
    color: '#EAF3FF',
    marginTop: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  towerCard: {
    width: '31%',
    minWidth: 78,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#0E1725',
  },
  towerCardSelected: {
    backgroundColor: '#16263D',
  },
  towerCardDisabled: {
    opacity: 0.45,
  },
  towerCardTitle: {
    color: '#F4F8FF',
    fontSize: 13,
    fontWeight: '700',
  },
  towerCardMeta: {
    marginTop: 1,
    color: '#B9C9E5',
    fontSize: 11,
    fontWeight: '600',
  },
  detailsShell: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A3C5A',
    backgroundColor: '#0E1827',
    borderRadius: 10,
    padding: 9,
    minHeight: 150,
    justifyContent: 'center',
  },
  helperText: {
    color: '#90A6C8',
    fontSize: 12,
    textAlign: 'center',
  },
  selectedPanel: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  selectedPanelTitle: {
    color: '#EAF4FF',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedPanelStats: {
    color: '#AFC3E2',
    fontSize: 12,
  },
  selectedPanelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  panelButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#35507B',
    backgroundColor: '#15243B',
  },
  panelButtonDisabled: {
    opacity: 0.4,
  },
  panelButtonText: {
    color: '#DEEAFF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  board: {
    backgroundColor: '#0D1523',
    borderWidth: 1,
    borderColor: '#25344E',
    borderRadius: BOARD_PADDING,
    overflow: 'hidden',
  },
  gridCell: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: '#172339',
  },
  pathCell: {
    position: 'absolute',
    backgroundColor: '#1E324E',
    borderWidth: 0.5,
    borderColor: '#2A4B75',
  },
  effect: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  tower: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#0B101B',
    backgroundColor: '#0B132080',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  towerActive: {
    borderColor: '#E7F28D',
  },
  towerRangeIndicator: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  towerLevelBadgeOverlay: {
    position: 'absolute',
    minWidth: 17,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#08111D',
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  towerLevel: {
    color: '#122237',
    fontSize: 9,
    fontWeight: '800',
  },
  beam: {
    position: 'absolute',
    opacity: 0.85,
  },
  projectile: {
    position: 'absolute',
  },
  enemyWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  slowAura: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#8FE8FF',
    backgroundColor: '#6FDFFF22',
  },
  healthTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0A1220',
    borderWidth: 0.5,
    borderColor: '#3A4E71',
    marginBottom: 3,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    backgroundColor: '#73F0AE',
  },
});
