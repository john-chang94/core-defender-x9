import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { TOWER_TYPES, WAVES } from '@/src/game/config';
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
  stepGame,
  upgradeTower,
} from '@/src/game/engine';
import { DEFAULT_GAME_MAP_ID, listGameMaps, loadGameMap } from '@/src/game/maps';
import { cellCenter, toCellKey } from '@/src/game/path';
import type { Cell, EnemyShape, GameEventType, GameMapId, TargetMode, TowerTypeId } from '@/src/game/types';

const BOARD_PADDING = 14;
const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  first: 'First',
  last: 'Last',
  strong: 'Strong',
};

type SimulationSpeed = 1 | 2 | 3;
type SoundEffectKey = 'spawn' | 'hit' | 'place' | 'upgrade' | 'sell' | 'targetMode';

const SPEED_OPTIONS: SimulationSpeed[] = [1, 2, 3];

const SOUND_FILES: Record<SoundEffectKey, number> = {
  spawn: require('../../assets/sfx/spawn.wav'),
  hit: require('../../assets/sfx/hit.wav'),
  place: require('../../assets/sfx/place.wav'),
  upgrade: require('../../assets/sfx/upgrade.wav'),
  sell: require('../../assets/sfx/sell.wav'),
  targetMode: require('../../assets/sfx/target-mode.wav'),
};

const SOUND_POOL_SIZE: Record<SoundEffectKey, number> = {
  spawn: 2,
  hit: 3,
  place: 2,
  upgrade: 2,
  sell: 2,
  targetMode: 1,
};

const SOUND_VOLUMES: Record<SoundEffectKey, number> = {
  spawn: 0.32,
  hit: 0.24,
  place: 0.32,
  upgrade: 0.36,
  sell: 0.28,
  targetMode: 0.22,
};

function createEmptySoundPool(): Record<SoundEffectKey, Audio.Sound[]> {
  return {
    spawn: [],
    hit: [],
    place: [],
    upgrade: [],
    sell: [],
    targetMode: [],
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
  };
}

function mapEventTypeToSound(type: GameEventType): SoundEffectKey {
  return type === 'targetMode' ? 'targetMode' : type;
}

function buildGridCells(cols: number, rows: number): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ col, row });
    }
  }
  return cells;
}

function EnemyGlyph({ shape, color, size }: { shape: EnemyShape; color: string; size: number }) {
  if (shape === 'circle') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: '#101827',
        }}
      />
    );
  }

  if (shape === 'square') {
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: '#101827',
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderBottomWidth: size,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          transform: [{ translateY: size * 0.08 }],
        }}
      />
    </View>
  );
}

export default function DefenseScreen() {
  const [gameState, setGameState] = useState(() => createInitialGameState(DEFAULT_GAME_MAP_ID));
  const [selectedBuildTower, setSelectedBuildTower] = useState<TowerTypeId>('pulse');
  const [selectedPlacedTowerId, setSelectedPlacedTowerId] = useState<string | null>(null);
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(1);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundsReady, setSoundsReady] = useState(false);

  const soundPoolsRef = useRef<Record<SoundEffectKey, Audio.Sound[]>>(createEmptySoundPool());
  const soundCursorRef = useRef<Record<SoundEffectKey, number>>(createEmptySoundCursor());
  const gameMaps = useMemo(() => listGameMaps(), []);
  const activeMap = useMemo(() => loadGameMap(gameState.mapId), [gameState.mapId]);
  const gridCells = useMemo(() => buildGridCells(activeMap.cols, activeMap.rows), [activeMap.cols, activeMap.rows]);

  const { width } = useWindowDimensions();
  const boardWidth = Math.min(width - 24, 560);
  const cellSize = boardWidth / activeMap.cols;
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
        let nextState = previousState;
        for (let step = 0; step < simulationSpeed; step += 1) {
          nextState = stepGame(nextState);
        }
        return nextState;
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
      void playSound(mapEventTypeToSound(event.type));
    }
  }, [gameState.recentEvents, playSound]);

  const statusText = useMemo(() => {
    if (gameState.status === 'won') {
      return 'Server stabilized. Waves cleared.';
    }

    if (gameState.status === 'lost') {
      return 'Core breached. Press restart.';
    }

    const wave = WAVES[gameState.waveIndex];
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
  }, [gameState]);

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

  const canUpgradeSelectedTower = selectedPlacedTower
    ? canUpgradeTower(gameState, selectedPlacedTower.id)
    : false;

  const handleBoardPress = (event: GestureResponderEvent) => {
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
    setGameState(createInitialGameState(mapId));
    setSelectedPlacedTowerId(null);
    setHasStarted(false);
    setIsPaused(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Defender Prototype</Text>
        <Pressable
          onPress={() => {
            setGameState(createInitialGameState(gameState.mapId));
            setSelectedPlacedTowerId(null);
            setHasStarted(false);
            setIsPaused(true);
          }}
          style={styles.restartButton}>
          <Text style={styles.restartButtonText}>Restart</Text>
        </Pressable>
      </View>

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
            {Math.min(gameState.waveIndex + 1, WAVES.length)}/{WAVES.length}
          </Text>
        </View>
        <View style={styles.hudChip}>
          <Text style={styles.hudLabel}>Enemies</Text>
          <Text style={styles.hudValue}>{gameState.enemies.length}</Text>
        </View>
      </View>

      <View style={styles.mapRow}>
        {gameMaps.map((map) => {
          const isActive = map.id === gameState.mapId;
          return (
            <Pressable
              key={map.id}
              onPress={() => handleSwitchMap(map.id)}
              style={[styles.mapButton, isActive && styles.mapButtonActive]}>
              <Text style={styles.mapButtonText}>{map.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.runtimeControls}>
        <View style={styles.speedButtons}>
          {SPEED_OPTIONS.map((speed) => {
            const isSelected = simulationSpeed === speed;
            return (
              <Pressable
                key={`speed-${speed}`}
                onPress={() => setSimulationSpeed(speed)}
                style={[styles.speedButton, isSelected && styles.speedButtonSelected]}>
                <Text style={styles.speedButtonText}>{`${speed}x`}</Text>
              </Pressable>
            );
          })}
        </View>

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

        <Pressable
          onPress={() => setSoundEnabled((enabled) => !enabled)}
          style={[styles.soundButton, !soundEnabled && styles.soundButtonMuted]}>
          <Text style={styles.soundButtonText}>
            {soundEnabled ? (soundsReady ? 'SFX On' : 'SFX Loading') : 'SFX Off'}
          </Text>
        </Pressable>
      </View>

      {isCountdownActive && (
        <View
          style={[
            styles.countdownBanner,
            isCountdownCritical && styles.countdownBannerCritical,
            isCountdownDanger && styles.countdownBannerDanger,
          ]}>
          <Text
            style={[
              styles.countdownLabel,
              isCountdownCritical && styles.countdownLabelCritical,
              isCountdownDanger && styles.countdownLabelDanger,
            ]}>
            Next Wave
          </Text>
          <Text
            style={[
              styles.countdownValue,
              isCountdownCritical && styles.countdownValueCritical,
              isCountdownDanger && styles.countdownValueDanger,
            ]}>
            {countdownSeconds.toFixed(1)}s
          </Text>
        </View>
      )}

      <Text
        style={[
          styles.statusText,
          isCountdownCritical && styles.statusTextCritical,
          isCountdownDanger && styles.statusTextDanger,
        ]}>
        {displayStatusText}
      </Text>

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

      {selectedPlacedTower && selectedPlacedTowerStats && selectedSellValue !== null ? (
        <View style={styles.selectedPanel}>
          <Text style={styles.selectedPanelTitle}>
            {TOWER_TYPES[selectedPlacedTower.towerType].label} {selectedPlacedTower.id} Lv {selectedPlacedTower.level}
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
          {gridCells.map((cell) => (
            <View
              key={`grid-${toCellKey(cell)}`}
              pointerEvents="none"
              style={[
                styles.gridCell,
                {
                  left: cell.col * cellSize,
                  top: cell.row * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}

          {activeMap.pathCells.map((cell) => (
            <View
              key={`path-${toCellKey(cell)}`}
              pointerEvents="none"
              style={[
                styles.pathCell,
                {
                  left: cell.col * cellSize,
                  top: cell.row * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}

          {gameState.effects.map((effect) => {
            const progress = Math.min(1, effect.age / effect.duration);
            const radius = (effect.startRadius + (effect.endRadius - effect.startRadius) * progress) * cellSize;
            const alphaHex = effect.kind === 'hit' ? '44' : '22';

            return (
              <View
                key={effect.id}
                pointerEvents="none"
                style={[
                  styles.effect,
                  {
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    left: effect.position.x * cellSize - radius,
                    top: effect.position.y * cellSize - radius,
                    borderColor: effect.color,
                    backgroundColor: `${effect.color}${alphaHex}`,
                    opacity: 1 - progress,
                  },
                ]}
              />
            );
          })}

          {gameState.towers.map((tower) => {
            const towerType = TOWER_TYPES[tower.towerType];
            const radius = towerType.radius * cellSize;
            const center = cellCenter(tower.cell);
            const isActive = tower.id === selectedPlacedTowerId;

            return (
              <View
                key={tower.id}
                pointerEvents="none"
                style={[
                  styles.tower,
                  isActive && styles.towerActive,
                  {
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    backgroundColor: towerType.color,
                    left: center.x * cellSize - radius,
                    top: center.y * cellSize - radius,
                  },
                ]}>
                <Text style={styles.towerLevel}>L{tower.level}</Text>
              </View>
            );
          })}

          {gameState.projectiles.map((projectile) => {
            const radius = projectile.radius * cellSize;
            return (
              <View
                key={projectile.id}
                pointerEvents="none"
                style={[
                  styles.projectile,
                  {
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    backgroundColor: projectile.color,
                    left: projectile.position.x * cellSize - radius,
                    top: projectile.position.y * cellSize - radius,
                  },
                ]}
              />
            );
          })}

          {gameState.enemies.map((enemy) => {
            const size = enemy.radius * 2 * cellSize;
            const left = enemy.position.x * cellSize - size / 2;
            const top = enemy.position.y * cellSize - size / 2;
            const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);

            return (
              <View
                key={enemy.id}
                pointerEvents="none"
                style={[
                  styles.enemyWrapper,
                  {
                    left,
                    top: top - 7,
                    width: size,
                    height: size + 7,
                  },
                ]}>
                <View style={styles.healthTrack}>
                  <View style={[styles.healthFill, { width: `${healthPercent * 100}%` }]} />
                </View>
                <EnemyGlyph shape={enemy.shape} color={enemy.color} size={size} />
              </View>
            );
          })}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070C14',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  header: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#ECF4FF',
    fontSize: 24,
    fontWeight: '700',
  },
  restartButton: {
    borderWidth: 1,
    borderColor: '#2F3D56',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#121B2A',
  },
  restartButtonText: {
    color: '#CFDEFF',
    fontSize: 13,
    fontWeight: '600',
  },
  hudRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  hudChip: {
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
  },
  mapRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334462',
    borderRadius: 8,
    backgroundColor: '#101B2D',
    paddingVertical: 7,
    alignItems: 'center',
  },
  mapButtonActive: {
    borderColor: '#90B8FF',
    backgroundColor: '#1A2A45',
  },
  mapButtonText: {
    color: '#DFEAFF',
    fontSize: 12,
    fontWeight: '700',
  },
  runtimeControls: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  speedButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  speedButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2C4164',
    backgroundColor: '#101D31',
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: 'center',
  },
  speedButtonSelected: {
    borderColor: '#89AFFF',
    backgroundColor: '#1B2D49',
  },
  speedButtonText: {
    color: '#DEEAFF',
    fontSize: 12,
    fontWeight: '700',
  },
  soundButton: {
    minWidth: 92,
    borderWidth: 1,
    borderColor: '#2A5878',
    backgroundColor: '#11314A',
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  soundButtonMuted: {
    borderColor: '#4F425C',
    backgroundColor: '#2A2133',
  },
  soundButtonText: {
    color: '#E3F3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  pauseButton: {
    minWidth: 78,
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
  countdownBanner: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#34598B',
    backgroundColor: '#132846',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  countdownBannerCritical: {
    borderColor: '#D18D3E',
    backgroundColor: '#442C13',
  },
  countdownBannerDanger: {
    borderColor: '#DE5D5D',
    backgroundColor: '#4A1E1E',
  },
  countdownLabel: {
    color: '#BBD0F2',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  countdownLabelCritical: {
    color: '#FFDFA8',
  },
  countdownLabelDanger: {
    color: '#FFD2D2',
  },
  countdownValue: {
    color: '#ECF5FF',
    fontSize: 22,
    fontWeight: '800',
  },
  countdownValueCritical: {
    color: '#FFD68A',
    fontSize: 24,
  },
  countdownValueDanger: {
    color: '#FFB4B4',
    fontSize: 28,
  },
  statusText: {
    marginTop: 10,
    color: '#AFC5E9',
    fontSize: 13,
  },
  statusTextCritical: {
    color: '#FFD6A1',
    fontWeight: '700',
  },
  statusTextDanger: {
    color: '#FFB3B3',
    fontWeight: '800',
  },
  toolbar: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  towerCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    fontSize: 15,
    fontWeight: '700',
  },
  towerCardMeta: {
    marginTop: 2,
    color: '#B9C9E5',
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    marginTop: 10,
    color: '#90A6C8',
    fontSize: 12,
  },
  selectedPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2A3C5A',
    backgroundColor: '#0E1827',
    borderRadius: 10,
    padding: 10,
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
  boardFrame: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingBottom: 10,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  towerActive: {
    borderColor: '#E7F28D',
  },
  towerLevel: {
    color: '#04121F',
    fontSize: 10,
    fontWeight: '800',
  },
  projectile: {
    position: 'absolute',
  },
  enemyWrapper: {
    position: 'absolute',
    alignItems: 'center',
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
