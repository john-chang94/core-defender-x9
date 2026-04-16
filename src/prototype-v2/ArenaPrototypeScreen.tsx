import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

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
import { createEncounterForTier } from './encounters';
import {
  ARENA_ENEMY_LABELS,
  applyArenaDiscoveryProgress,
  applyArenaRunSummary,
  claimArenaCosmetic,
  createArenaMetaState,
  getArenaBuildUnlockIds,
  getArenaBuildCollectionCosmeticIds,
  getArenaClaimableCosmeticIds,
  getArenaCosmeticDisplayState,
  getArenaCosmeticStatusLabel,
  getArenaEquippedBuildCosmeticId,
  getArenaEquippedGlobalCosmeticId,
  getArenaGlobalCollectionCosmeticIds,
  getArenaGlobalUnlockIds,
  createArenaRunMetaSummary,
  getArenaMasteryProgress,
  getArenaNextBuildUnlock,
  getArenaUnlockRewardCosmeticEntry,
  equipArenaCosmetic,
  loadArenaMetaState,
  saveArenaMetaState,
} from './meta';
import { getArenaCosmeticDefinition } from './cosmetics';
import { ARENA_ARMORY_UPGRADES, ARENA_ARMORY_UPGRADE_ORDER, isArenaArmoryUpgradeMaxed } from './upgrades';
import {
  ARENA_AUDIO_CUE_FILES,
  ARENA_AUDIO_CUE_MIN_INTERVAL_MS,
  ARENA_AUDIO_CUE_POOL_SIZE,
  ARENA_AUDIO_CUE_VOLUMES,
  ARENA_BIOME_MUSIC_FILES,
  ARENA_BIOME_MUSIC_VOLUMES,
  DEFAULT_ARENA_AUDIO_SETTINGS,
  createArenaAudioSettings,
  loadArenaAudioSettings,
  saveArenaAudioSettings,
} from './audio';
import {
  ARENA_BIOME_ORDER,
  getArenaBiomeDefinitionForTier,
  getArenaBiomeTierRange,
  isArenaBiomeTransitionTier,
} from './biomes';
import type {
  ArenaAudioCueKey,
  ArenaAudioSettings,
  ArenaBiomeId,
  ArenaGameState,
  ArenaBuildId,
  ArenaCosmeticDefinition,
  ArenaCosmeticDisplayState,
  ArenaCosmeticId,
  ArenaDrop,
  ArenaEnemy,
  ArenaMetaState,
  ArenaRunMetaSummary,
  ArenaUnlockEntry,
  ArenaVfxQuality,
} from './types';

type AppGameId = 'defender' | 'prototype' | 'prototypeV2';

type ArenaPrototypeScreenProps = {
  onSwitchGame: (game: AppGameId) => void;
};

type ArenaMenuTab = 'run' | 'codex' | 'mastery' | 'collection';
type ArenaRunEndSummary = {
  tierReached: number;
  bossLabels: string[];
  masteryXp: number;
  newlyClaimableIds: ArenaCosmeticId[];
  dominantBuild: ArenaBuildId;
};

const FEATURED_COLLECTION_REWARD_IDS: ArenaCosmeticId[] = ['bannerPrismShard', 'codexFrameEndlessApex'];
const BOSS_ENEMY_ORDER = ['prismBoss', 'hiveCarrierBoss', 'vectorLoomBoss'] as const;
const ARENA_AUDIO_CUE_ORDER = Object.keys(ARENA_AUDIO_CUE_FILES) as ArenaAudioCueKey[];

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

function isMeaningfulArenaRun(gameState: ArenaGameState) {
  const totalKills = ARENA_ENEMY_ORDER.reduce((sum, kind) => sum + gameState.runKillCountsByEnemy[kind], 0);
  return (
    gameState.elapsed >= 3 ||
    totalKills > 0 ||
    gameState.runMiniBossClears > 0 ||
    gameState.runBossClears > 0 ||
    gameState.bestTierReached > 1
  );
}

function getArenaRunEarnedXp(runSummary: ArenaRunMetaSummary) {
  return runSummary.tierReached * 20 + runSummary.miniBossClears * 35 + runSummary.bossClears * 100;
}

function createArenaRunEndSummary(metaState: ArenaMetaState, gameState: ArenaGameState): ArenaRunEndSummary | null {
  if (!isMeaningfulArenaRun(gameState)) {
    return null;
  }

  const runSummary = createArenaRunMetaSummary(gameState);
  const nextMetaState = applyArenaRunSummary(metaState, runSummary);
  const claimableSet = new Set(getArenaClaimableCosmeticIds(metaState));
  const newlyClaimableIds = getArenaClaimableCosmeticIds(nextMetaState).filter((cosmeticId) => !claimableSet.has(cosmeticId));

  return {
    tierReached: runSummary.tierReached,
    bossLabels: BOSS_ENEMY_ORDER.filter((kind) => gameState.runBossClearsByEnemy[kind] > 0).map((kind) => ARENA_ENEMY_LABELS[kind]),
    masteryXp: getArenaRunEarnedXp(runSummary),
    newlyClaimableIds,
    dominantBuild: runSummary.dominantBuild,
  };
}

function getPlayerFireCueKey(buildId: ArenaBuildId): ArenaAudioCueKey {
  if (buildId === 'novaBloom') {
    return 'playerNova';
  }
  if (buildId === 'missileCommand') {
    return 'playerMissile';
  }
  if (buildId === 'fractureCore') {
    return 'playerFracture';
  }
  return 'playerRail';
}

function getEnemyFireCueKey(style: ArenaGameState['enemyBullets'][number]['enemyStyle']): ArenaAudioCueKey | null {
  switch (style) {
    case 'orb':
      return 'enemyOrb';
    case 'needle':
      return 'enemyNeedle';
    case 'bomb':
      return 'enemyBomb';
    case 'wave':
      return 'enemyWave';
    case 'bolt':
    default:
      return style ? 'enemyBolt' : null;
  }
}

function getCollectionStatePriority(state: ArenaCosmeticDisplayState) {
  switch (state) {
    case 'claimable':
      return 0;
    case 'equipped':
      return 1;
    case 'owned':
      return 2;
    case 'locked':
    default:
      return 3;
  }
}

function EnemyNode({ enemy }: { enemy: ArenaEnemy }) {
  const isBoss =
    enemy.kind === 'prismBoss' || enemy.kind === 'hiveCarrierBoss' || enemy.kind === 'vectorLoomBoss';

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

const ULTIMATE_ICON_SLASH_ANGLES = ['-42deg', '42deg'] as const;
const MOVE_HINT_DIAMETER = 48;
const MOVE_HINT_BOTTOM_OFFSET = 4;

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
  accentDefinition,
}: {
  ready: boolean;
  chargeProgress: number;
  accentDefinition: ArenaCosmeticDefinition;
}) {
  return (
    <View pointerEvents="none" style={arenaStyles.ultimateIconWrap}>
      <View
        style={[
          arenaStyles.ultimateIconBlade,
          ready && arenaStyles.ultimateIconBladeReady,
          {
            backgroundColor: ready ? accentDefinition.detailColor : accentDefinition.secondaryColor,
          },
        ]}
      />
      {ULTIMATE_ICON_SLASH_ANGLES.map((angle) => (
        <View
          key={`ult-slash-${angle}`}
          style={[
            arenaStyles.ultimateIconSlash,
            ready && arenaStyles.ultimateIconSlashReady,
            {
              backgroundColor: ready ? accentDefinition.glowColor : accentDefinition.primaryColor,
            },
            { transform: [{ rotate: angle }] },
          ]}
        />
      ))}
      <View
        style={[
          arenaStyles.ultimateIconRing,
          ready && arenaStyles.ultimateIconRingReady,
          {
            borderColor: ready ? accentDefinition.glowColor : accentDefinition.secondaryColor,
          },
        ]}
      />
      <View
        style={[
          arenaStyles.ultimateIconDiamond,
          ready && arenaStyles.ultimateIconDiamondReady,
          {
            borderColor: ready ? accentDefinition.detailColor : accentDefinition.primaryColor,
          },
        ]}
      />
      <View
        style={[
          arenaStyles.ultimateIconCore,
          ready && arenaStyles.ultimateIconCoreReady,
          {
            backgroundColor: ready ? accentDefinition.primaryColor : accentDefinition.secondaryColor,
            opacity: 0.52 + chargeProgress * 0.44,
          },
        ]}
      />
    </View>
  );
}

function BuildCrestMark({
  crestDefinition,
  size = 14,
}: {
  crestDefinition: ArenaCosmeticDefinition;
  size?: number;
}) {
  const baseColor = crestDefinition.primaryColor;
  const strokeColor = crestDefinition.secondaryColor;
  const detailColor = crestDefinition.detailColor;
  const unit = size / 12;
  const segmentStyle = {
    position: 'absolute' as const,
    borderRadius: Math.max(1, unit),
  };

  switch (crestDefinition.emblemKey) {
    case 'rail-zenith':
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          <View
            style={[
              segmentStyle,
              {
                left: unit * 4,
                top: unit * 3,
                width: unit * 4,
                height: unit * 4,
                backgroundColor: baseColor,
                borderWidth: 1,
                borderColor: detailColor,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 1.2,
                top: unit * 3,
                width: unit * 1.2,
                height: unit * 5.4,
                backgroundColor: strokeColor,
                transform: [{ rotate: '-28deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                right: unit * 1.2,
                top: unit * 3,
                width: unit * 1.2,
                height: unit * 5.4,
                backgroundColor: strokeColor,
                transform: [{ rotate: '28deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 4.8,
                top: unit * 0.8,
                width: unit * 2.4,
                height: unit * 1.4,
                backgroundColor: detailColor,
              },
            ]}
          />
        </View>
      );
    case 'nova-default':
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          <View
            style={[
              segmentStyle,
              {
                left: unit * 2.1,
                top: unit * 4.2,
                width: unit * 3.2,
                height: unit * 3.2,
                borderRadius: unit * 4,
                backgroundColor: strokeColor,
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                right: unit * 2.1,
                top: unit * 4.2,
                width: unit * 3.2,
                height: unit * 3.2,
                borderRadius: unit * 4,
                backgroundColor: strokeColor,
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 3.9,
                top: unit * 3.2,
                width: unit * 4.2,
                height: unit * 4.2,
                borderRadius: unit * 4,
                backgroundColor: baseColor,
                borderWidth: 1,
                borderColor: detailColor,
              },
            ]}
          />
        </View>
      );
    case 'nova-solar':
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          {[
            { left: unit * 4.2, top: unit * 0.8 },
            { left: unit * 4.2, bottom: unit * 0.8 },
            { left: unit * 0.8, top: unit * 4.2 },
            { right: unit * 0.8, top: unit * 4.2 },
          ].map((petal, index) => (
            <View
              key={`nova-solar-petal-${index}`}
              style={[
                segmentStyle,
                {
                  width: unit * 3,
                  height: unit * 3,
                  borderRadius: unit * 4,
                  backgroundColor: strokeColor,
                },
                petal,
              ]}
            />
          ))}
          <View
            style={[
              segmentStyle,
              {
                left: unit * 3.3,
                top: unit * 3.3,
                width: unit * 5.4,
                height: unit * 5.4,
                borderRadius: unit * 5,
                backgroundColor: baseColor,
                borderWidth: 1,
                borderColor: detailColor,
              },
            ]}
          />
        </View>
      );
    case 'missile-default':
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          <View
            style={[
              segmentStyle,
              {
                left: unit * 4.3,
                top: unit * 1.6,
                width: unit * 3.4,
                height: unit * 7.2,
                backgroundColor: baseColor,
                borderWidth: 1,
                borderColor: detailColor,
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 3.2,
                top: unit * 6.2,
                width: unit * 2,
                height: unit * 3.2,
                backgroundColor: strokeColor,
                transform: [{ rotate: '-24deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                right: unit * 3.2,
                top: unit * 6.2,
                width: unit * 2,
                height: unit * 3.2,
                backgroundColor: strokeColor,
                transform: [{ rotate: '24deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 4.7,
                top: unit * 0.6,
                width: unit * 2.4,
                height: unit * 2.2,
                backgroundColor: detailColor,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </View>
      );
    case 'missile-crown':
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          {[2.1, 4.4, 6.7].map((left, index) => (
            <View
              key={`missile-crown-${index}`}
              style={[
                segmentStyle,
                {
                  left: unit * left,
                  top: index === 1 ? unit * 1.2 : unit * 2.6,
                  width: unit * 1.8,
                  height: unit * 6.3,
                  backgroundColor: index === 1 ? detailColor : baseColor,
                  borderWidth: index === 1 ? 1 : 0,
                  borderColor: strokeColor,
                },
              ]}
            />
          ))}
          <View
            style={[
              segmentStyle,
              {
                left: unit * 2.4,
                bottom: unit * 1,
                width: unit * 7.2,
                height: unit * 1.8,
                backgroundColor: strokeColor,
              },
            ]}
          />
        </View>
      );
    case 'fracture-default':
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          <View
            style={[
              segmentStyle,
              {
                left: unit * 2.2,
                top: unit * 3.1,
                width: unit * 3.6,
                height: unit * 4.8,
                backgroundColor: baseColor,
                transform: [{ rotate: '28deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                right: unit * 2.2,
                top: unit * 3.1,
                width: unit * 3.6,
                height: unit * 4.8,
                backgroundColor: strokeColor,
                transform: [{ rotate: '-28deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 5.2,
                top: unit * 1.4,
                width: unit * 1.2,
                height: unit * 9,
                backgroundColor: detailColor,
              },
            ]}
          />
        </View>
      );
    case 'fracture-crown':
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          {[
            { left: unit * 4.6, top: unit * 0.8, rotate: '18deg' },
            { left: unit * 1.4, top: unit * 4.2, rotate: '-28deg' },
            { right: unit * 1.4, top: unit * 4.2, rotate: '28deg' },
          ].map((shard, index) => (
            <View
              key={`fracture-shard-${index}`}
              style={[
                segmentStyle,
                {
                  width: unit * 2.1,
                  height: unit * 4,
                  backgroundColor: index === 0 ? detailColor : strokeColor,
                  transform: [{ rotate: shard.rotate }],
                },
                shard,
              ]}
            />
          ))}
          <View
            style={[
              segmentStyle,
              {
                left: unit * 3.6,
                top: unit * 4,
                width: unit * 4.8,
                height: unit * 4.8,
                backgroundColor: baseColor,
                borderWidth: 1,
                borderColor: detailColor,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </View>
      );
    case 'rail-default':
    default:
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          <View
            style={[
              segmentStyle,
              {
                left: unit * 4.9,
                top: unit * 1.1,
                width: unit * 2.2,
                height: unit * 8.6,
                backgroundColor: detailColor,
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 2.2,
                top: unit * 3,
                width: unit * 1.5,
                height: unit * 5.2,
                backgroundColor: strokeColor,
                transform: [{ rotate: '-26deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                right: unit * 2.2,
                top: unit * 3,
                width: unit * 1.5,
                height: unit * 5.2,
                backgroundColor: strokeColor,
                transform: [{ rotate: '26deg' }],
              },
            ]}
          />
          <View
            style={[
              segmentStyle,
              {
                left: unit * 3.6,
                top: unit * 2.1,
                width: unit * 4.8,
                height: unit * 1.2,
                backgroundColor: baseColor,
              },
            ]}
          />
        </View>
      );
  }
}

function UnlockChip({
  entry,
  metaState,
  accentColor,
  frameDefinition,
}: {
  entry: ArenaUnlockEntry;
  metaState: ArenaMetaState;
  accentColor?: string;
  frameDefinition: ArenaCosmeticDefinition;
}) {
  const rewardEntry = getArenaUnlockRewardCosmeticEntry(metaState, entry.id);
  const status = rewardEntry?.displayState ?? (entry.unlocked ? 'owned' : 'locked');
  const statusLabel = getArenaCosmeticStatusLabel(status);
  const highlightColor = accentColor ?? rewardEntry?.definition.primaryColor ?? frameDefinition.secondaryColor;
  const borderColor =
    status === 'equipped'
      ? hexToRgba(highlightColor, 0.84)
      : status === 'claimable'
        ? hexToRgba(frameDefinition.detailColor, 0.82)
        : status === 'owned'
          ? hexToRgba(frameDefinition.secondaryColor, 0.66)
          : '#29435B';
  const backgroundColor =
    status === 'equipped'
      ? hexToRgba(highlightColor, 0.18)
      : status === 'claimable'
        ? hexToRgba(frameDefinition.primaryColor, 0.24)
        : status === 'owned'
          ? hexToRgba(frameDefinition.primaryColor, 0.14)
          : 'rgba(11, 22, 34, 0.92)';

  return (
    <View
      style={[
        arenaStyles.unlockChip,
        status === 'locked' ? arenaStyles.unlockChipLocked : arenaStyles.unlockChipUnlocked,
        {
          borderColor,
          backgroundColor,
        },
      ]}>
      <Text style={[arenaStyles.unlockChipLabel, status === 'locked' && arenaStyles.unlockChipLabelLocked]}>
        {entry.rewardLabel}
      </Text>
      <Text style={arenaStyles.unlockChipMeta}>{`${statusLabel} • ${entry.description}`}</Text>
    </View>
  );
}

function MetaShowcaseCard({
  title,
  subtitle,
  note,
  bannerDefinition,
  frameDefinition,
  biomeDefinition,
  accentColor,
  crestDefinition,
}: {
  title: string;
  subtitle: string;
  note?: string | null;
  bannerDefinition: ArenaCosmeticDefinition;
  frameDefinition: ArenaCosmeticDefinition;
  biomeDefinition?: ReturnType<typeof getArenaBiomeDefinitionForTier>;
  accentColor?: string;
  crestDefinition?: ArenaCosmeticDefinition | null;
}) {
  return (
    <View
      style={[
        arenaStyles.metaShowcaseCard,
        {
          borderColor: hexToRgba(biomeDefinition?.headerBorder ?? frameDefinition.secondaryColor, 0.72),
          backgroundColor: hexToRgba(biomeDefinition?.headerBackground ?? bannerDefinition.primaryColor, 0.76),
          shadowColor: biomeDefinition?.glowColor ?? bannerDefinition.glowColor,
        },
      ]}>
      <View
        pointerEvents="none"
        style={[
          arenaStyles.metaShowcaseBanner,
          {
            backgroundColor: hexToRgba(biomeDefinition?.menuStripe ?? bannerDefinition.secondaryColor, 0.84),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          arenaStyles.metaShowcaseGlow,
          {
            backgroundColor: hexToRgba(biomeDefinition?.announcementGlow ?? bannerDefinition.glowColor, 0.16),
          },
        ]}
      />
      <View style={arenaStyles.metaShowcaseContent}>
        <View style={arenaStyles.metaShowcaseCopy}>
          <Text
            style={[
              arenaStyles.metaShowcaseTitle,
              {
                color: accentColor ?? frameDefinition.detailColor,
              },
            ]}>
            {title}
          </Text>
          <Text style={arenaStyles.metaShowcaseSubtitle}>{subtitle}</Text>
          {note ? <Text style={arenaStyles.metaShowcaseNote}>{note}</Text> : null}
        </View>
        {crestDefinition ? (
          <View
            style={[
              arenaStyles.metaShowcaseCrestWrap,
              {
                borderColor: hexToRgba(frameDefinition.detailColor, 0.5),
                backgroundColor: hexToRgba(frameDefinition.primaryColor, 0.26),
              },
            ]}>
            <BuildCrestMark crestDefinition={crestDefinition} size={18} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CollectionPreview({ definition }: { definition: ArenaCosmeticDefinition }) {
  if (definition.slot === 'banner') {
    return (
      <View
        style={[
          arenaStyles.collectionPreviewBanner,
          {
            backgroundColor: hexToRgba(definition.primaryColor, 0.94),
            borderColor: hexToRgba(definition.detailColor, 0.64),
          },
        ]}>
        <View
          style={[
            arenaStyles.collectionPreviewBannerBand,
            {
              backgroundColor: hexToRgba(definition.secondaryColor, 0.86),
            },
          ]}
        />
        <View
          style={[
            arenaStyles.collectionPreviewBannerCore,
            {
              backgroundColor: hexToRgba(definition.glowColor, 0.72),
            },
          ]}
        />
      </View>
    );
  }

  if (definition.slot === 'codexFrame') {
    return (
      <View
        style={[
          arenaStyles.collectionPreviewFrame,
          {
            borderColor: hexToRgba(definition.secondaryColor, 0.94),
            backgroundColor: hexToRgba(definition.primaryColor, 0.3),
          },
        ]}>
        <View
          style={[
            arenaStyles.collectionPreviewFrameInner,
            {
              borderColor: hexToRgba(definition.detailColor, 0.74),
              backgroundColor: hexToRgba(definition.glowColor, 0.12),
            },
          ]}
        />
      </View>
    );
  }

  if (definition.slot === 'buildAccent') {
    return (
      <View
        style={[
          arenaStyles.collectionPreviewAccent,
          {
            borderColor: hexToRgba(definition.secondaryColor, 0.82),
            backgroundColor: hexToRgba(definition.primaryColor, 0.22),
          },
        ]}>
        <View
          style={[
            arenaStyles.collectionPreviewAccentWing,
            arenaStyles.collectionPreviewAccentWingLeft,
            {
              backgroundColor: definition.secondaryColor,
            },
          ]}
        />
        <View
          style={[
            arenaStyles.collectionPreviewAccentWing,
            arenaStyles.collectionPreviewAccentWingRight,
            {
              backgroundColor: definition.secondaryColor,
            },
          ]}
        />
        <View
          style={[
            arenaStyles.collectionPreviewAccentCore,
            {
              backgroundColor: definition.primaryColor,
              borderColor: definition.detailColor,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        arenaStyles.collectionPreviewCrest,
        {
          borderColor: hexToRgba(definition.secondaryColor, 0.76),
          backgroundColor: hexToRgba(definition.primaryColor, 0.18),
        },
      ]}>
      <BuildCrestMark crestDefinition={definition} size={18} />
    </View>
  );
}

function CollectionCard({
  definition,
  displayState,
  frameDefinition,
  onPress,
}: {
  definition: ArenaCosmeticDefinition;
  displayState: ArenaCosmeticDisplayState;
  frameDefinition: ArenaCosmeticDefinition;
  onPress: () => void;
}) {
  const actionLabel =
    displayState === 'claimable'
      ? 'Claim'
      : displayState === 'owned'
        ? 'Equip'
        : displayState === 'equipped'
          ? 'Equipped'
          : 'Locked';
  const actionDisabled = displayState === 'locked' || displayState === 'equipped';
  const titleColor = displayState === 'locked' ? '#B6C6D6' : definition.detailColor;
  const borderColor =
    displayState === 'equipped'
      ? hexToRgba(definition.secondaryColor, 0.9)
      : displayState === 'claimable'
        ? hexToRgba(frameDefinition.detailColor, 0.78)
        : displayState === 'owned'
          ? hexToRgba(definition.secondaryColor, 0.66)
          : '#2B4258';

  return (
    <View
      style={[
        arenaStyles.collectionCard,
        {
          borderColor,
          backgroundColor:
            displayState === 'locked'
              ? 'rgba(12, 23, 35, 0.94)'
              : hexToRgba(definition.primaryColor, 0.14),
        },
      ]}>
      <CollectionPreview definition={definition} />
      <Text style={[arenaStyles.collectionCardLabel, { color: titleColor }]}>{definition.label}</Text>
      <Text style={arenaStyles.collectionCardMeta}>
        {`${getArenaCosmeticStatusLabel(displayState)} • ${definition.rarity.toUpperCase()}`}
      </Text>
      <Text style={arenaStyles.collectionCardText}>{definition.description}</Text>
      <Pressable
        disabled={actionDisabled}
        onPress={onPress}
        style={[
          arenaStyles.collectionCardAction,
          actionDisabled && arenaStyles.collectionCardActionDisabled,
          !actionDisabled && {
            borderColor: hexToRgba(definition.secondaryColor, 0.76),
            backgroundColor: hexToRgba(definition.primaryColor, 0.18),
          },
        ]}>
        <Text style={arenaStyles.collectionCardActionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function MoveHintPointerIcon() {
  return (
    <View pointerEvents="none" style={arenaStyles.moveHintPointerWrap}>
      <View style={arenaStyles.moveHintPointerHeadShadow} />
      <View style={arenaStyles.moveHintPointerStemShadow} />
      <View style={arenaStyles.moveHintPointerHead} />
      <View style={arenaStyles.moveHintPointerStem} />
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
  const [collectionBuildId, setCollectionBuildId] = useState<ArenaBuildId>('railFocus');
  const [arenaMeta, setArenaMeta] = useState<ArenaMetaState>(() => createArenaMetaState());
  const [isMetaReady, setIsMetaReady] = useState(false);
  const [arenaAudioSettings, setArenaAudioSettings] = useState<ArenaAudioSettings>(() => createArenaAudioSettings());
  const [isAudioSettingsReady, setIsAudioSettingsReady] = useState(false);
  const [isArenaAudioReady, setIsArenaAudioReady] = useState(false);
  const [isAppActive, setIsAppActive] = useState(true);
  const [isMoveHintPressed, setIsMoveHintPressed] = useState(false);
  const [pendingCollectionNoticeIds, setPendingCollectionNoticeIds] = useState<ArenaCosmeticId[]>([]);
  const [sectorBannerTier, setSectorBannerTier] = useState<number | null>(null);
  const [runEndSummary, setRunEndSummary] = useState<ArenaRunEndSummary | null>(null);
  const [pendingRestartSummary, setPendingRestartSummary] = useState<ArenaRunEndSummary | null>(null);
  const hasInitializedBoardRef = useRef(false);
  const armoryResumeOnCloseRef = useRef(false);
  const persistedDiscoveryKeyRef = useRef('');
  const runMetaCommittedRef = useRef(false);
  const hasHydratedClaimablesRef = useRef(false);
  const claimableSignatureRef = useRef('');
  const soundPoolsRef = useRef<Partial<Record<ArenaAudioCueKey, AudioPlayer[]>>>({});
  const soundCursorRef = useRef<Partial<Record<ArenaAudioCueKey, number>>>({});
  const lastSoundAtRef = useRef<Partial<Record<ArenaAudioCueKey, number>>>({});
  const musicPlayersRef = useRef<Record<ArenaBiomeId, AudioPlayer | null>>({
    prismVerge: null,
    hiveForge: null,
    vectorSpindle: null,
  });
  const activeMusicBiomeRef = useRef<ArenaBiomeId | null>(null);
  const previousGameStateRef = useRef(gameState);
  const lastBiomeBannerKeyRef = useRef('');
  const playerVisualX = useSharedValue(900 / 2);
  const playerShellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerVisualX.value - ARENA_PLAYER_RENDER_HALF_WIDTH }],
  }));
  const moveHintAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerVisualX.value - MOVE_HINT_DIAMETER / 2 }],
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
    let cancelled = false;

    const hydrateArenaAudioSettings = async () => {
      const loadedSettings = await loadArenaAudioSettings();
      if (cancelled) {
        return;
      }
      setArenaAudioSettings(loadedSettings);
      setIsAudioSettingsReady(true);
    };

    void hydrateArenaAudioSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAudioSettingsReady) {
      return;
    }
    void saveArenaAudioSettings(arenaAudioSettings);
  }, [arenaAudioSettings, isAudioSettingsReady]);

  useEffect(() => {
    let cancelled = false;
    const bootstrapAudioSettings = DEFAULT_ARENA_AUDIO_SETTINGS;

    const initializeArenaAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'duckOthers',
          interruptionModeAndroid: 'duckOthers',
          shouldRouteThroughEarpiece: false,
        });

        for (const cueKey of ARENA_AUDIO_CUE_ORDER) {
          const pool: AudioPlayer[] = [];
          const volume = ARENA_AUDIO_CUE_VOLUMES[cueKey] * bootstrapAudioSettings.sfxVolume;
          for (let index = 0; index < ARENA_AUDIO_CUE_POOL_SIZE[cueKey]; index += 1) {
            const player = createAudioPlayer(ARENA_AUDIO_CUE_FILES[cueKey]);
            player.volume = volume;
            pool.push(player);
          }
          soundPoolsRef.current[cueKey] = pool;
          soundCursorRef.current[cueKey] = 0;
          lastSoundAtRef.current[cueKey] = 0;
        }

        for (const biomeId of ARENA_BIOME_ORDER) {
          const player = createAudioPlayer(ARENA_BIOME_MUSIC_FILES[biomeId]);
          player.volume = ARENA_BIOME_MUSIC_VOLUMES[biomeId] * bootstrapAudioSettings.musicVolume;
          player.loop = true;
          musicPlayersRef.current[biomeId] = player;
        }

        if (!cancelled) {
          setIsArenaAudioReady(true);
        }
      } catch (error) {
        console.warn('Failed to initialize Arena V2 audio', error);
      }
    };

    void initializeArenaAudio();

    return () => {
      cancelled = true;
      setIsArenaAudioReady(false);
      activeMusicBiomeRef.current = null;
      const activeSoundPools = soundPoolsRef.current;
      soundPoolsRef.current = {};
      [
        ...Object.values(activeSoundPools).flatMap((pool) => pool ?? []),
        ...ARENA_BIOME_ORDER.map((biomeId) => musicPlayersRef.current[biomeId]).filter(
          (player): player is AudioPlayer => player !== null
        ),
      ].forEach((player) => {
        try {
          player.remove();
        } catch {
          // Ignore removal failures during teardown.
        }
      });
      musicPlayersRef.current = {
        prismVerge: null,
        hiveForge: null,
        vectorSpindle: null,
      };
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    if (!hasInitializedBoardRef.current) {
      hasInitializedBoardRef.current = true;
      playerVisualX.value = boardSize.width / 2;
      const initialState = createInitialArenaState(boardSize.width);
      previousGameStateRef.current = initialState;
      setGameState(initialState);
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
      setIsMoveHintPressed(false);
      setPendingRestartSummary(null);
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

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    setCollectionBuildId(gameState.activeBuild);
  }, [gameState.activeBuild, isMenuOpen]);

  useEffect(() => {
    if (!isMetaReady) {
      return;
    }

    const claimableIds = getArenaClaimableCosmeticIds(arenaMeta);
    const signature = claimableIds.join('|');
    if (!hasHydratedClaimablesRef.current) {
      hasHydratedClaimablesRef.current = true;
      claimableSignatureRef.current = signature;
      return;
    }

    const previousIds = claimableSignatureRef.current.length > 0 ? claimableSignatureRef.current.split('|') : [];
    const previousIdSet = new Set(previousIds);
    const nextNoticeIds = claimableIds.filter((cosmeticId) => !previousIdSet.has(cosmeticId));
    if (nextNoticeIds.length > 0) {
      setPendingCollectionNoticeIds((previousIdsState) => Array.from(new Set([...previousIdsState, ...nextNoticeIds])));
    }
    claimableSignatureRef.current = signature;
  }, [arenaMeta, isMetaReady]);

  useEffect(() => {
    if (!isMenuOpen || menuTab !== 'collection' || pendingCollectionNoticeIds.length === 0) {
      return;
    }
    setPendingCollectionNoticeIds([]);
  }, [isMenuOpen, menuTab, pendingCollectionNoticeIds.length]);

  const displayTier = getArenaDisplayTier(gameState.elapsed);
  const activeBiomeDefinition = getArenaBiomeDefinitionForTier(displayTier);
  const activeBiomeTierRange = getArenaBiomeTierRange(displayTier);
  const activeSectorLabel = `T${activeBiomeTierRange.startTier}-T${activeBiomeTierRange.endTier}`;
  const nextBossTier = Math.floor(displayTier / 6) * 6 + 6;
  const nextBossEncounter = createEncounterForTier(nextBossTier);
  const nextBossPreviewLabel =
    nextBossEncounter?.type === 'boss' ? `T${nextBossTier} • ${nextBossEncounter.label}` : 'T6 • Prism Core';
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const activeWeapon = getArenaActiveWeapon(gameState);
  const activeBuildMeta = ARENA_BUILD_META[gameState.activeBuild];
  const activeBannerDefinition = getArenaCosmeticDefinition(getArenaEquippedGlobalCosmeticId(arenaMeta, 'banner'));
  const activeFrameDefinition = getArenaCosmeticDefinition(getArenaEquippedGlobalCosmeticId(arenaMeta, 'codexFrame'));
  const activeAccentDefinition = getArenaCosmeticDefinition(
    getArenaEquippedBuildCosmeticId(arenaMeta, gameState.activeBuild, 'buildAccent')
  );
  const activeCrestDefinition = getArenaCosmeticDefinition(
    getArenaEquippedBuildCosmeticId(arenaMeta, gameState.activeBuild, 'buildCrest')
  );
  const claimableCosmeticIds = getArenaClaimableCosmeticIds(arenaMeta);
  const claimableCosmeticIdSet = new Set(claimableCosmeticIds);
  const newClaimableCount = pendingCollectionNoticeIds.filter((cosmeticId) => claimableCosmeticIdSet.has(cosmeticId)).length;
  const featuredRewardIds = [...FEATURED_COLLECTION_REWARD_IDS].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return getCollectionStatePriority(leftState) - getCollectionStatePriority(rightState);
  });
  const collectionNoticeText =
    newClaimableCount > 0
      ? `New cosmetics ready in Collection: ${newClaimableCount}.`
      : claimableCosmeticIds.length > 0
        ? `Collection has ${claimableCosmeticIds.length} reward${claimableCosmeticIds.length === 1 ? '' : 's'} ready to claim.`
        : null;
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
        ? collectionNoticeText
          ? `Menu open. ${collectionNoticeText}`
          : 'Menu open. Simulation paused.'
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
    const accentDefinition = getArenaCosmeticDefinition(getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildAccent'));
    const crestDefinition = getArenaCosmeticDefinition(getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildCrest'));
    const mastery = arenaMeta.mastery[buildId];
    const progress = getArenaMasteryProgress(mastery.xp);
    const unlockEntries = getArenaBuildUnlockIds(buildId).map((unlockId) => arenaMeta.unlocks[unlockId]);
    const nextUnlockId = getArenaNextBuildUnlock(arenaMeta, buildId);
    return {
      buildId,
      buildMeta,
      accentDefinition,
      crestDefinition,
      mastery,
      progress,
      unlockEntries,
      nextUnlock: nextUnlockId ? arenaMeta.unlocks[nextUnlockId] : null,
    };
  });
  const collectionBannerIds = [...getArenaGlobalCollectionCosmeticIds('banner')].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return getCollectionStatePriority(leftState) - getCollectionStatePriority(rightState);
  });
  const collectionFrameIds = [...getArenaGlobalCollectionCosmeticIds('codexFrame')].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return getCollectionStatePriority(leftState) - getCollectionStatePriority(rightState);
  });
  const collectionAccentIds = [...getArenaBuildCollectionCosmeticIds(collectionBuildId, 'buildAccent')].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return getCollectionStatePriority(leftState) - getCollectionStatePriority(rightState);
  });
  const collectionCrestIds = [...getArenaBuildCollectionCosmeticIds(collectionBuildId, 'buildCrest')].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return getCollectionStatePriority(leftState) - getCollectionStatePriority(rightState);
  });
  const collectionBuildAccentDefinition = getArenaCosmeticDefinition(
    getArenaEquippedBuildCosmeticId(arenaMeta, collectionBuildId, 'buildAccent')
  );
  const collectionBuildCrestDefinition = getArenaCosmeticDefinition(
    getArenaEquippedBuildCosmeticId(arenaMeta, collectionBuildId, 'buildCrest')
  );
  const activeRunEndSummary = pendingRestartSummary ?? runEndSummary;
  const runEndRewardText =
    activeRunEndSummary && activeRunEndSummary.newlyClaimableIds.length > 0
      ? activeRunEndSummary.newlyClaimableIds
          .map((cosmeticId) => getArenaCosmeticDefinition(cosmeticId).label)
          .join(' • ')
      : null;

  const playArenaSound = useCallback(
    (cueKey: ArenaAudioCueKey) => {
      if (!isArenaAudioReady || !isAppActive || !arenaAudioSettings.soundEnabled) {
        return;
      }

      const now = Date.now();
      const minIntervalMs = ARENA_AUDIO_CUE_MIN_INTERVAL_MS[cueKey];
      const previousAt = lastSoundAtRef.current[cueKey] ?? 0;
      if (minIntervalMs > 0 && now - previousAt < minIntervalMs) {
        return;
      }

      const pool = soundPoolsRef.current[cueKey];
      if (!pool || pool.length === 0) {
        return;
      }

      const cursor = soundCursorRef.current[cueKey] ?? 0;
      const player = pool[cursor % pool.length];
      soundCursorRef.current[cueKey] = (cursor + 1) % pool.length;
      lastSoundAtRef.current[cueKey] = now;
      try {
        void player.seekTo(0);
        player.play();
      } catch {
        // Ignore individual playback failures; the pool can continue serving later sounds.
      }
    },
    [arenaAudioSettings.soundEnabled, isAppActive, isArenaAudioReady]
  );

  const canControlShip = boardSize.width > 0 && boardSize.height > 0 && !isMenuOpen && !isArmoryOpen && hasStarted && !isPaused && gameState.status === 'running';
  const moveHintTop = boardSize.height > 0 ? Math.max(0, boardSize.height - MOVE_HINT_DIAMETER - MOVE_HINT_BOTTOM_OFFSET) : 0;
  const shouldShowMoveHint = canControlShip && !isMoveHintPressed;
  const panGesture = useMemo(
    () => {
      const handleMoveHintTouchBegin = (touchX: number, touchY: number) => {
        if (boardSize.width <= 0 || boardSize.height <= 0) {
          setIsMoveHintPressed(false);
          return;
        }
        const hintCenterX = gameState.playerX;
        const hintCenterY = moveHintTop + MOVE_HINT_DIAMETER / 2;
        const dx = touchX - hintCenterX;
        const dy = touchY - hintCenterY;
        setIsMoveHintPressed(dx * dx + dy * dy <= Math.pow(MOVE_HINT_DIAMETER * 0.5 + 6, 2));
      };
      const handleMoveHintTouchEnd = () => {
        setIsMoveHintPressed(false);
      };

      return Gesture.Pan()
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
          runOnJS(handleMoveHintTouchBegin)(event.x, event.y);
        })
        .onUpdate((event) => {
          playerVisualX.value = clampWorklet(
            event.x,
            ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
            boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN
          );
        })
        .onFinalize(() => {
          runOnJS(handleMoveHintTouchEnd)();
        });
    },
    [boardSize.height, boardSize.width, canControlShip, gameState.playerX, moveHintTop, playerVisualX]
  );

  useEffect(() => {
    if (!isArenaAudioReady) {
      return;
    }

    for (const cueKey of ARENA_AUDIO_CUE_ORDER) {
      for (const player of soundPoolsRef.current[cueKey] ?? []) {
        player.volume = ARENA_AUDIO_CUE_VOLUMES[cueKey] * arenaAudioSettings.sfxVolume;
      }
    }
  }, [arenaAudioSettings.sfxVolume, isArenaAudioReady]);

  useEffect(() => {
    if (!isArenaAudioReady) {
      return;
    }

    for (const biomeId of ARENA_BIOME_ORDER) {
      const musicPlayer = musicPlayersRef.current[biomeId];
      if (musicPlayer) {
        musicPlayer.volume = ARENA_BIOME_MUSIC_VOLUMES[biomeId] * arenaAudioSettings.musicVolume;
      }
    }
  }, [arenaAudioSettings.musicVolume, isArenaAudioReady]);

  useEffect(() => {
    if (!isArenaAudioReady) {
      return;
    }

    const shouldPlayMusic =
      arenaAudioSettings.musicEnabled &&
      isAppActive &&
      hasStarted &&
      !isPaused &&
      !isArmoryOpen &&
      !isMenuOpen &&
      gameState.status === 'running';

    const syncMusic = () => {
      if (!shouldPlayMusic) {
        for (const biomeId of ARENA_BIOME_ORDER) {
          const musicPlayer = musicPlayersRef.current[biomeId];
          if (musicPlayer) {
            musicPlayer.pause();
          }
        }
        return;
      }

      const activeBiomeId = activeBiomeDefinition.id;
      for (const biomeId of ARENA_BIOME_ORDER) {
        if (biomeId !== activeBiomeId) {
          const musicPlayer = musicPlayersRef.current[biomeId];
          if (musicPlayer) {
            musicPlayer.pause();
          }
        }
      }

      const activeMusicPlayer = musicPlayersRef.current[activeBiomeId];
      if (!activeMusicPlayer) {
        return;
      }

      try {
        if (activeMusicBiomeRef.current !== activeBiomeId) {
          void activeMusicPlayer.seekTo(0);
          activeMusicPlayer.play();
        } else if (!activeMusicPlayer.playing) {
          activeMusicPlayer.play();
        }
        activeMusicBiomeRef.current = activeBiomeId;
      } catch {
        // Ignore playback failures and allow later state changes to retry.
      }
    };

    syncMusic();
  }, [
    activeBiomeDefinition.id,
    arenaAudioSettings.musicEnabled,
    gameState.status,
    hasStarted,
    isAppActive,
    isArenaAudioReady,
    isArmoryOpen,
    isMenuOpen,
    isPaused,
  ]);

  useEffect(() => {
    if (!hasStarted || gameState.status !== 'running' || !isArenaBiomeTransitionTier(displayTier)) {
      return;
    }

    const bannerKey = `${activeBiomeDefinition.id}:${activeBiomeTierRange.startTier}`;
    if (lastBiomeBannerKeyRef.current === bannerKey) {
      return;
    }

    lastBiomeBannerKeyRef.current = bannerKey;
    setSectorBannerTier(activeBiomeTierRange.startTier);
  }, [
    activeBiomeDefinition.id,
    activeBiomeTierRange.startTier,
    displayTier,
    gameState.status,
    hasStarted,
  ]);

  useEffect(() => {
    if (sectorBannerTier === null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setSectorBannerTier(null);
    }, 2200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [sectorBannerTier]);

  useEffect(() => {
    const previousState = previousGameStateRef.current;
    if (!hasStarted || previousState === gameState) {
      previousGameStateRef.current = gameState;
      return;
    }

    const previousPlayerBulletIds = new Set(previousState.playerBullets.map((bullet) => bullet.id));
    const nextPlayerCueKeys = new Set(
      gameState.playerBullets
        .filter((bullet) => !previousPlayerBulletIds.has(bullet.id))
        .map((bullet) => getPlayerFireCueKey(bullet.buildFlavor ?? gameState.activeBuild))
    );
    nextPlayerCueKeys.forEach((cueKey) => {
      playArenaSound(cueKey);
    });

    const previousEnemyBulletIds = new Set(previousState.enemyBullets.map((bullet) => bullet.id));
    const nextEnemyCueKeys = new Set(
      gameState.enemyBullets
        .filter((bullet) => !previousEnemyBulletIds.has(bullet.id))
        .map((bullet) => getEnemyFireCueKey(bullet.enemyStyle))
        .filter((cueKey): cueKey is ArenaAudioCueKey => cueKey !== null)
    );
    nextEnemyCueKeys.forEach((cueKey) => {
      playArenaSound(cueKey);
    });

    const previousHazardsById = new Map(previousState.hazards.map((hazard) => [hazard.id, hazard]));
    for (const hazard of gameState.hazards) {
      const previousHazard = previousHazardsById.get(hazard.id);
      if (!previousHazard) {
        playArenaSound('hazardTelegraph');
      } else if (!previousHazard.triggered && hazard.triggered) {
        playArenaSound('hazardImpact');
      }
    }

    if (gameState.pickupMessage !== previousState.pickupMessage && gameState.pickupMessage) {
      playArenaSound('pickup');
    }
    if (previousState.overclockTimer <= 0 && gameState.overclockTimer > 0) {
      playArenaSound('overdriveStart');
    } else if (previousState.overclockTimer > 0 && gameState.overclockTimer <= 0) {
      playArenaSound('overdriveEnd');
    }
    if (previousState.ultimateTimer <= 0 && gameState.ultimateTimer > 0) {
      playArenaSound('ultimate');
    }
    if (
      gameState.activeEncounter?.type === 'boss' &&
      (previousState.activeEncounter?.scriptId !== gameState.activeEncounter.scriptId ||
        previousState.activeEncounter?.startedAtTier !== gameState.activeEncounter.startedAtTier)
    ) {
      playArenaSound('bossIntro');
    }
    if (
      gameState.activeEncounter?.type === 'boss' &&
      previousState.activeEncounter?.type === 'boss' &&
      gameState.activeEncounter.bossPhaseIndex > previousState.activeEncounter.bossPhaseIndex
    ) {
      playArenaSound('bossPhase');
    }
    if (gameState.runBossClears > previousState.runBossClears) {
      playArenaSound('bossKill');
    }
    if (
      gameState.status === 'running' &&
      (gameState.hull < previousState.hull - 0.01 || gameState.shield < previousState.shield - 0.01)
    ) {
      playArenaSound('playerHit');
    }
    if (previousState.status !== 'lost' && gameState.status === 'lost') {
      playArenaSound('playerLoss');
    }

    previousGameStateRef.current = gameState;
  }, [gameState, hasStarted, playArenaSound]);

  const handleBoardLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextWidth !== boardSize.width || nextHeight !== boardSize.height) {
      setBoardSize({ width: nextWidth, height: nextHeight });
    }
  };

  const finalizeRunMetaProgress = useCallback(() => {
    if (!hasStarted || runMetaCommittedRef.current || !isMetaReady) {
      return null;
    }

    runMetaCommittedRef.current = true;
    const nextRunEndSummary = createArenaRunEndSummary(arenaMeta, gameState);
    if (!nextRunEndSummary) {
      return null;
    }

    setRunEndSummary(nextRunEndSummary);
    const runSummary = createArenaRunMetaSummary(gameState);
    setArenaMeta((previousMetaState) => {
      const nextMetaState = applyArenaRunSummary(previousMetaState, runSummary);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
    return nextRunEndSummary;
  }, [arenaMeta, gameState, hasStarted, isMetaReady]);

  useEffect(() => {
    if (gameState.status !== 'lost' || !isMetaReady || !hasStarted || runMetaCommittedRef.current) {
      return;
    }
    finalizeRunMetaProgress();
  }, [finalizeRunMetaProgress, gameState.status, hasStarted, isMetaReady]);

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
    playArenaSound('armoryOpen');
    setIsPaused(true);
    setIsMenuOpen(false);
    setIsArmoryOpen(true);
  };

  const resetArenaRun = () => {
    if (boardSize.width <= 0) {
      return;
    }
    const nextState = createInitialArenaState(boardSize.width);
    const resetState = setArenaBuild(nextState, gameState.activeBuild);
    playerVisualX.value = boardSize.width / 2;
    setGameState(resetState);
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
    setIsArmoryOpen(false);
    setMenuTab('run');
    setIsMoveHintPressed(false);
    setRunEndSummary(null);
    setPendingRestartSummary(null);
    setSectorBannerTier(null);
    armoryResumeOnCloseRef.current = false;
    runMetaCommittedRef.current = false;
    lastBiomeBannerKeyRef.current = '';
    activeMusicBiomeRef.current = null;
    previousGameStateRef.current = resetState;
  };

  const handleRestart = () => {
    if (gameState.status !== 'lost') {
      const nextRestartSummary = createArenaRunEndSummary(arenaMeta, gameState);
      if (nextRestartSummary) {
        setPendingRestartSummary(nextRestartSummary);
        setIsPaused(true);
        setIsMenuOpen(false);
        setIsArmoryOpen(false);
        return;
      }
      finalizeRunMetaProgress();
    }

    resetArenaRun();
  };

  const handleConfirmRestart = () => {
    finalizeRunMetaProgress();
    resetArenaRun();
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
    playArenaSound('armoryUpgrade');

    if (shouldCloseAfterInstall) {
      requestAnimationFrame(() => {
        closeArmoryPanel();
      });
    }
  };

  const handleClaimCosmetic = (cosmeticId: ArenaCosmeticId) => {
    setArenaMeta((previousMetaState) => {
      const nextMetaState = claimArenaCosmetic(previousMetaState, cosmeticId);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
    setPendingCollectionNoticeIds((previousIds) => previousIds.filter((id) => id !== cosmeticId));
  };

  const handleEquipCosmetic = (cosmeticId: ArenaCosmeticId) => {
    setArenaMeta((previousMetaState) => {
      const nextMetaState = equipArenaCosmetic(previousMetaState, cosmeticId);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  };
  const updateArenaAudioSetting = (partialSettings: Partial<ArenaAudioSettings>) => {
    setArenaAudioSettings((previousSettings) => ({
      ...previousSettings,
      ...partialSettings,
    }));
  };
  const adjustArenaAudioVolume = (key: 'sfxVolume' | 'musicVolume', delta: number) => {
    setArenaAudioSettings((previousSettings) => ({
      ...previousSettings,
      [key]: clamp(previousSettings[key] + delta, 0, 1),
    }));
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

        <View
          style={[
            arenaStyles.statusPill,
            {
              borderColor: hexToRgba(activeAccentDefinition.secondaryColor, 0.48),
              backgroundColor: hexToRgba(activeAccentDefinition.primaryColor, 0.08),
            },
          ]}>
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

      <View
        style={[
          arenaStyles.overviewStrip,
          {
            borderColor: hexToRgba(activeAccentDefinition.secondaryColor, 0.48),
            backgroundColor: hexToRgba(activeAccentDefinition.primaryColor, 0.06),
          },
        ]}>
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
          <Text style={[arenaStyles.overviewValue, { color: activeAccentDefinition.primaryColor }]}>
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

      <View
        style={[
          arenaStyles.resourceStrip,
          {
            borderColor: hexToRgba(activeAccentDefinition.secondaryColor, 0.42),
            backgroundColor: hexToRgba(activeAccentDefinition.primaryColor, 0.05),
          },
        ]}>
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
                { backgroundColor: hexToRgba(activeAccentDefinition.secondaryColor, 0.4) },
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
              borderColor: hexToRgba(activeBiomeDefinition.boundary, 0.7),
              backgroundColor: activeBiomeDefinition.base,
            },
            {
              transform: [{ translateX: boardShakeX }, { translateY: boardShakeY }],
            },
          ]}>
          <ArenaCanvas
            boardWidth={boardSize.width}
            boardHeight={boardSize.height}
            biomeDefinition={activeBiomeDefinition}
            state={gameState}
            vfxQuality={vfxQuality}
          />

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
            <View
              style={[
                arenaStyles.playerThrusterGlow,
                {
                  backgroundColor: hexToRgba(activeAccentDefinition.glowColor, 0.22),
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerWingBaseLeft,
                {
                  backgroundColor: activeAccentDefinition.secondaryColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerWingBaseRight,
                {
                  backgroundColor: activeAccentDefinition.secondaryColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerFuselage,
                {
                  backgroundColor: activeAccentDefinition.primaryColor,
                  borderColor: activeAccentDefinition.detailColor,
                },
              ]}>
              <View
                style={[
                  arenaStyles.playerCanopy,
                  {
                    backgroundColor: activeAccentDefinition.detailColor,
                    borderColor: activeAccentDefinition.glowColor,
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerSpine,
                  {
                    backgroundColor: activeAccentDefinition.secondaryColor,
                  },
                ]}
              />
            </View>
            <View
              style={[
                arenaStyles.playerCrestWrap,
                {
                  borderColor: hexToRgba(activeCrestDefinition.secondaryColor, 0.54),
                  backgroundColor: hexToRgba(activeCrestDefinition.primaryColor, 0.22),
                },
              ]}>
              <BuildCrestMark crestDefinition={activeCrestDefinition} size={12} />
            </View>
            <View
              style={[
                arenaStyles.playerNose,
                {
                  borderBottomColor: activeAccentDefinition.detailColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerEngineLeft,
                {
                  backgroundColor: activeAccentDefinition.glowColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerEngineRight,
                {
                  backgroundColor: activeAccentDefinition.glowColor,
                },
              ]}
            />
          </Animated.View>

          {shouldShowMoveHint ? (
            <Animated.View
              pointerEvents="none"
              style={[
                arenaStyles.moveHintWrap,
                { top: moveHintTop },
                moveHintAnimatedStyle,
              ]}>
              <View style={arenaStyles.moveHintCircle}>
                <MoveHintPointerIcon />
              </View>
            </Animated.View>
          ) : null}

          <View pointerEvents="none" style={arenaStyles.versionBadge}>
            <Text style={arenaStyles.versionBadgeText}>{ARENA_VERSION_LABEL}</Text>
          </View>

          {sectorBannerTier !== null ? (
            <View pointerEvents="none" style={arenaStyles.sectorBannerWrap}>
              <View
                style={[
                  arenaStyles.sectorBannerCard,
                  {
                    borderColor: hexToRgba(activeBiomeDefinition.detailColor, 0.64),
                    backgroundColor: hexToRgba(activeBiomeDefinition.headerBackground, 0.78),
                    shadowColor: activeBiomeDefinition.glowColor,
                  },
                ]}>
                <Text style={[arenaStyles.sectorBannerTitle, { color: activeBiomeDefinition.detailColor }]}>
                  {activeBiomeDefinition.label}
                </Text>
                <Text style={arenaStyles.sectorBannerSubtitle}>
                  Sector {activeSectorLabel} • {activeBiomeDefinition.subtitle}
                </Text>
              </View>
            </View>
          ) : null}

          {hasEncounterAnnouncement ? (
            <View pointerEvents="none" style={arenaStyles.boardAnnouncementWrap}>
              <View
                style={[
                  arenaStyles.boardAnnouncementGlow,
                  {
                    backgroundColor: hexToRgba(activeBiomeDefinition.announcementGlow, 0.1 + encounterAnnouncementOpacity * 0.22),
                    opacity: encounterAnnouncementOpacity,
                    transform: [{ scale: 0.88 + encounterAnnouncementProgress * 0.16 }],
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.boardAnnouncementPanel,
                  {
                    borderColor: hexToRgba(activeBiomeDefinition.detailColor, 0.52),
                    backgroundColor: hexToRgba(activeBiomeDefinition.headerBackground, 0.68),
                    opacity: 0.25 + encounterAnnouncementOpacity * 0.75,
                  },
                ]}>
                <Text
                  style={[
                    arenaStyles.boardAnnouncementText,
                    {
                      color: gameState.encounterAnnouncementColor ?? activeBiomeDefinition.detailColor,
                    },
                  ]}>
                  {gameState.encounterAnnouncement}
                </Text>
              </View>
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
            <UltimateControlIcon
              ready={ultimateReady}
              chargeProgress={ultimateChargeProgress}
              accentDefinition={activeAccentDefinition}
            />
            <View style={arenaStyles.ultimateButtonMeter}>
              <View
                style={[
                  arenaStyles.ultimateButtonFill,
                  {
                    width: `${ultimateChargeProgress * 100}%`,
                    backgroundColor: hexToRgba(activeAccentDefinition.secondaryColor, 0.82),
                  },
                ]}
              />
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
          <View
            style={[
              arenaStyles.menuPanel,
              {
                borderColor: hexToRgba(activeBiomeDefinition.headerBorder, 0.72),
                backgroundColor: hexToRgba(activeBiomeDefinition.menuSurface, 0.97),
              },
            ]}>
            <Text style={[arenaStyles.menuTitle, { color: activeBiomeDefinition.detailColor }]}>Arena Prototype Menu</Text>
            <View style={arenaStyles.menuSegmentRow}>
              {(['run', 'codex', 'mastery', 'collection'] as ArenaMenuTab[]).map((tab) => (
                <Pressable
                  key={`menu-tab-${tab}`}
                  onPress={() => setMenuTab(tab)}
                  style={[arenaStyles.menuSegmentButton, menuTab === tab && arenaStyles.menuSegmentButtonActive]}>
                  <Text style={[arenaStyles.menuSegmentText, menuTab === tab && arenaStyles.menuSegmentTextActive]}>
                    {tab === 'run'
                      ? 'Run'
                      : tab === 'codex'
                        ? 'Codex'
                        : tab === 'mastery'
                          ? 'Mastery'
                          : 'Collection'}
                  </Text>
                  {tab === 'collection' && claimableCosmeticIds.length > 0 ? (
                    <View style={arenaStyles.menuSegmentBadge}>
                      <Text style={arenaStyles.menuSegmentBadgeText}>{claimableCosmeticIds.length}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>

            {menuTab === 'run' ? (
              <ScrollView style={arenaStyles.menuScroll} contentContainerStyle={arenaStyles.menuScrollContent}>
                <MetaShowcaseCard
                  title={activeBiomeDefinition.label}
                  subtitle={`Sector ${activeSectorLabel}`}
                  note={`${activeBiomeDefinition.subtitle} Next boss ${nextBossPreviewLabel}.`}
                  bannerDefinition={activeBannerDefinition}
                  frameDefinition={activeFrameDefinition}
                  biomeDefinition={activeBiomeDefinition}
                  accentColor={activeBiomeDefinition.detailColor}
                  crestDefinition={activeCrestDefinition}
                />

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

                <Text style={arenaStyles.menuLabel}>Audio</Text>
                <View style={arenaStyles.menuRow}>
                  <View
                    style={[
                      arenaStyles.audioControlCard,
                      {
                        borderColor: hexToRgba(activeBiomeDefinition.headerBorder, 0.62),
                        backgroundColor: hexToRgba(activeBiomeDefinition.headerBackground, 0.72),
                      },
                    ]}>
                    <Text style={arenaStyles.audioControlTitle}>Sound</Text>
                    <Pressable
                      onPress={() => updateArenaAudioSetting({ soundEnabled: !arenaAudioSettings.soundEnabled })}
                      style={[arenaStyles.menuButton, arenaAudioSettings.soundEnabled && arenaStyles.menuButtonActive]}>
                      <Text style={arenaStyles.menuButtonText}>
                        {arenaAudioSettings.soundEnabled ? 'Enabled' : 'Muted'}
                      </Text>
                    </Pressable>
                    <View style={arenaStyles.audioControlValueRow}>
                      <Pressable
                        onPress={() => adjustArenaAudioVolume('sfxVolume', -0.08)}
                        style={arenaStyles.audioAdjustButton}>
                        <Text style={arenaStyles.audioAdjustButtonText}>-</Text>
                      </Pressable>
                      <Text style={arenaStyles.audioControlValue}>{Math.round(arenaAudioSettings.sfxVolume * 100)}%</Text>
                      <Pressable
                        onPress={() => adjustArenaAudioVolume('sfxVolume', 0.08)}
                        style={arenaStyles.audioAdjustButton}>
                        <Text style={arenaStyles.audioAdjustButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View
                    style={[
                      arenaStyles.audioControlCard,
                      {
                        borderColor: hexToRgba(activeBiomeDefinition.headerBorder, 0.62),
                        backgroundColor: hexToRgba(activeBiomeDefinition.headerBackground, 0.72),
                      },
                    ]}>
                    <Text style={arenaStyles.audioControlTitle}>Music</Text>
                    <Pressable
                      onPress={() => updateArenaAudioSetting({ musicEnabled: !arenaAudioSettings.musicEnabled })}
                      style={[arenaStyles.menuButton, arenaAudioSettings.musicEnabled && arenaStyles.menuButtonActive]}>
                      <Text style={arenaStyles.menuButtonText}>
                        {arenaAudioSettings.musicEnabled ? 'Enabled' : 'Muted'}
                      </Text>
                    </Pressable>
                    <View style={arenaStyles.audioControlValueRow}>
                      <Pressable
                        onPress={() => adjustArenaAudioVolume('musicVolume', -0.08)}
                        style={arenaStyles.audioAdjustButton}>
                        <Text style={arenaStyles.audioAdjustButtonText}>-</Text>
                      </Pressable>
                      <Text style={arenaStyles.audioControlValue}>{Math.round(arenaAudioSettings.musicVolume * 100)}%</Text>
                      <Pressable
                        onPress={() => adjustArenaAudioVolume('musicVolume', 0.08)}
                        style={arenaStyles.audioAdjustButton}>
                        <Text style={arenaStyles.audioAdjustButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Text style={arenaStyles.menuLabel}>Build</Text>
                <View style={arenaStyles.menuBuildGrid}>
                  {ARENA_BUILD_ORDER.map((buildId) => {
                    const buildMeta = ARENA_BUILD_META[buildId];
                    const buildAccentDefinition = getArenaCosmeticDefinition(
                      getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildAccent')
                    );
                    const buildCrestDefinition = getArenaCosmeticDefinition(
                      getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildCrest')
                    );
                    const isActive = gameState.activeBuild === buildId;
                    return (
                      <Pressable
                        key={`build-${buildId}`}
                        onPress={() => handleSelectBuild(buildId)}
                        style={[arenaStyles.menuBuildButton, isActive && arenaStyles.menuBuildButtonActive]}>
                        <View style={arenaStyles.menuBuildTitleRow}>
                          <BuildCrestMark crestDefinition={buildCrestDefinition} size={14} />
                          <Text style={[arenaStyles.menuBuildTitle, { color: isActive ? buildAccentDefinition.primaryColor : '#EAF4FF' }]}>
                            {buildMeta.label}
                          </Text>
                        </View>
                        <Text numberOfLines={2} style={arenaStyles.menuBuildText}>
                          {buildMeta.summary}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={arenaStyles.menuLabel}>Notes</Text>
                <View style={arenaStyles.menuBuildDetailsCard}>
                  <View style={arenaStyles.menuBuildDetailsHeader}>
                    <BuildCrestMark crestDefinition={activeCrestDefinition} size={16} />
                    <Text style={[arenaStyles.menuBuildDetailsTitle, { color: activeAccentDefinition.primaryColor }]}>
                      {activeBuildMeta.label}
                    </Text>
                  </View>
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
              </ScrollView>
            ) : menuTab === 'codex' ? (
              <ScrollView style={arenaStyles.menuScroll} contentContainerStyle={arenaStyles.menuScrollContent}>
                {!isMetaReady ? (
                  <Text style={arenaStyles.menuBuildDetailsText}>Loading persistent codex data...</Text>
                ) : (
                  <>
                    <MetaShowcaseCard
                      title="Codex Archive"
                      subtitle={`${codexEnemyEntries.filter((entry) => entry.discovered).length}/${codexEnemyEntries.length} signals logged`}
                      note={`${activeBannerDefinition.label} • ${activeFrameDefinition.label}`}
                      bannerDefinition={activeBannerDefinition}
                      frameDefinition={activeFrameDefinition}
                      biomeDefinition={activeBiomeDefinition}
                    />
                    <Text style={arenaStyles.menuLabel}>Reward Hooks</Text>
                    <View style={arenaStyles.unlockChipRow}>
                      {globalUnlockEntries.map((entry) => (
                        <UnlockChip
                          key={`codex-unlock-${entry.id}`}
                          entry={entry}
                          metaState={arenaMeta}
                          frameDefinition={activeFrameDefinition}
                        />
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
                            {!isLocked && entry.kind === 'prismBoss' ? (
                              <UnlockChip
                                entry={arenaMeta.unlocks.prismCoreFirstClear}
                                metaState={arenaMeta}
                                accentColor="#A6D7FF"
                                frameDefinition={activeFrameDefinition}
                              />
                            ) : !isLocked && entry.kind === 'hiveCarrierBoss' ? (
                              <UnlockChip
                                entry={arenaMeta.unlocks.hiveCarrierFirstClear}
                                metaState={arenaMeta}
                                accentColor="#93F0D5"
                                frameDefinition={activeFrameDefinition}
                              />
                            ) : !isLocked && entry.kind === 'vectorLoomBoss' ? (
                              <UnlockChip
                                entry={arenaMeta.unlocks.vectorLoomFirstClear}
                                metaState={arenaMeta}
                                accentColor="#C7D4FF"
                                frameDefinition={activeFrameDefinition}
                              />
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
                        const buildAccentDefinition = getArenaCosmeticDefinition(
                          getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildAccent')
                        );
                        const buildCrestDefinition = getArenaCosmeticDefinition(
                          getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildCrest')
                        );
                        const buildUnlockEntries = getArenaBuildUnlockIds(buildId).map((unlockId) => arenaMeta.unlocks[unlockId]);
                        return (
                          <View
                            key={`codex-build-${buildId}`}
                            style={[
                              arenaStyles.codexCard,
                              {
                                borderColor: hexToRgba(buildAccentDefinition.secondaryColor, 0.56),
                                backgroundColor: hexToRgba(buildAccentDefinition.primaryColor, 0.09),
                              },
                            ]}>
                            <View style={arenaStyles.codexCardHeader}>
                              <View style={arenaStyles.cardTitleRow}>
                                <BuildCrestMark crestDefinition={buildCrestDefinition} size={15} />
                                <Text style={[arenaStyles.codexCardTitle, { color: buildAccentDefinition.primaryColor }]}>
                                  {buildEntry.label}
                                </Text>
                              </View>
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
                                <UnlockChip
                                  key={`codex-build-unlock-${entry.id}`}
                                  entry={entry}
                                  metaState={arenaMeta}
                                  accentColor={buildAccentDefinition.primaryColor}
                                  frameDefinition={activeFrameDefinition}
                                />
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
                  <Text style={arenaStyles.menuBuildDetailsText}>
                    {menuTab === 'mastery' ? 'Loading mastery records...' : 'Loading cosmetic collection...'}
                  </Text>
                ) : (
                  menuTab === 'mastery' ? (
                    <>
                      <MetaShowcaseCard
                        title="Mastery Archive"
                        subtitle={`${masteryCards.reduce((sum, card) => sum + card.mastery.xp, 0)} XP banked across builds`}
                        note={`${activeBannerDefinition.label} • ${activeFrameDefinition.label}`}
                        bannerDefinition={activeBannerDefinition}
                        frameDefinition={activeFrameDefinition}
                        biomeDefinition={activeBiomeDefinition}
                      />
                      <View style={arenaStyles.masteryIntroCard}>
                        <Text style={arenaStyles.masteryIntroText}>
                          Mastery XP is granted at run end to the build with the most active time. Ties resolve to the build you finish on.
                        </Text>
                      </View>
                      {masteryCards.map(({ buildId, buildMeta, accentDefinition, crestDefinition, mastery, progress, unlockEntries, nextUnlock }) => (
                        <View
                          key={`mastery-${buildId}`}
                          style={[
                            arenaStyles.masteryCard,
                            gameState.activeBuild === buildId && arenaStyles.masteryCardActive,
                            {
                              borderColor: hexToRgba(accentDefinition.secondaryColor, gameState.activeBuild === buildId ? 0.82 : 0.56),
                              backgroundColor: hexToRgba(accentDefinition.primaryColor, gameState.activeBuild === buildId ? 0.16 : 0.08),
                            },
                          ]}>
                          <View style={arenaStyles.masteryHeaderRow}>
                            <View style={arenaStyles.masteryHeaderCopy}>
                              <View style={arenaStyles.cardTitleRow}>
                                <BuildCrestMark crestDefinition={crestDefinition} size={16} />
                                <Text style={[arenaStyles.masteryTitle, { color: accentDefinition.primaryColor }]}>{buildMeta.label}</Text>
                              </View>
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
                                  backgroundColor: hexToRgba(accentDefinition.secondaryColor, 0.76),
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
                              <UnlockChip
                                key={`mastery-unlock-${entry.id}`}
                                entry={entry}
                                metaState={arenaMeta}
                                accentColor={accentDefinition.primaryColor}
                                frameDefinition={activeFrameDefinition}
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                    </>
                  ) : (
                    <>
                      <MetaShowcaseCard
                        title="Collection"
                        subtitle={`${claimableCosmeticIds.length} claimable • ${Object.values(arenaMeta.cosmetics).filter((entry) => entry.state === 'owned').length} owned`}
                        note={collectionNoticeText ?? `${activeBannerDefinition.label} • ${activeFrameDefinition.label}`}
                        bannerDefinition={activeBannerDefinition}
                        frameDefinition={activeFrameDefinition}
                        biomeDefinition={activeBiomeDefinition}
                        accentColor={collectionBuildAccentDefinition.primaryColor}
                        crestDefinition={collectionBuildCrestDefinition}
                      />
                      {collectionNoticeText ? (
                        <View style={arenaStyles.collectionNoticeCard}>
                          <Text style={arenaStyles.collectionNoticeText}>{collectionNoticeText}</Text>
                        </View>
                      ) : null}

                      <Text style={arenaStyles.menuLabel}>Featured Rewards</Text>
                      <View style={arenaStyles.codexGrid}>
                        {featuredRewardIds.map((cosmeticId) => {
                          const definition = getArenaCosmeticDefinition(cosmeticId);
                          const displayState = getArenaCosmeticDisplayState(arenaMeta, cosmeticId);
                          return (
                            <CollectionCard
                              key={`collection-featured-${cosmeticId}`}
                              definition={definition}
                              displayState={displayState}
                              frameDefinition={activeFrameDefinition}
                              onPress={() => {
                                if (displayState === 'claimable') {
                                  handleClaimCosmetic(cosmeticId);
                                } else if (displayState === 'owned') {
                                  handleEquipCosmetic(cosmeticId);
                                }
                              }}
                            />
                          );
                        })}
                      </View>

                      <Text style={arenaStyles.menuLabel}>Global</Text>
                      <Text style={arenaStyles.collectionSectionLabel}>Banner</Text>
                      <View style={arenaStyles.codexGrid}>
                        {collectionBannerIds.map((cosmeticId) => {
                          const definition = getArenaCosmeticDefinition(cosmeticId);
                          const displayState = getArenaCosmeticDisplayState(arenaMeta, cosmeticId);
                          return (
                            <CollectionCard
                              key={`collection-banner-${cosmeticId}`}
                              definition={definition}
                              displayState={displayState}
                              frameDefinition={activeFrameDefinition}
                              onPress={() => {
                                if (displayState === 'claimable') {
                                  handleClaimCosmetic(cosmeticId);
                                } else if (displayState === 'owned') {
                                  handleEquipCosmetic(cosmeticId);
                                }
                              }}
                            />
                          );
                        })}
                      </View>

                      <Text style={arenaStyles.collectionSectionLabel}>Codex Frame</Text>
                      <View style={arenaStyles.codexGrid}>
                        {collectionFrameIds.map((cosmeticId) => {
                          const definition = getArenaCosmeticDefinition(cosmeticId);
                          const displayState = getArenaCosmeticDisplayState(arenaMeta, cosmeticId);
                          return (
                            <CollectionCard
                              key={`collection-frame-${cosmeticId}`}
                              definition={definition}
                              displayState={displayState}
                              frameDefinition={activeFrameDefinition}
                              onPress={() => {
                                if (displayState === 'claimable') {
                                  handleClaimCosmetic(cosmeticId);
                                } else if (displayState === 'owned') {
                                  handleEquipCosmetic(cosmeticId);
                                }
                              }}
                            />
                          );
                        })}
                      </View>

                      <Text style={arenaStyles.menuLabel}>Build</Text>
                      <View style={arenaStyles.menuBuildGrid}>
                        {ARENA_BUILD_ORDER.map((buildId) => {
                          const buildAccentDefinition = getArenaCosmeticDefinition(
                            getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildAccent')
                          );
                          const buildCrestDefinition = getArenaCosmeticDefinition(
                            getArenaEquippedBuildCosmeticId(arenaMeta, buildId, 'buildCrest')
                          );
                          const isSelected = collectionBuildId === buildId;
                          return (
                            <Pressable
                              key={`collection-build-${buildId}`}
                              onPress={() => setCollectionBuildId(buildId)}
                              style={[arenaStyles.menuBuildButton, isSelected && arenaStyles.menuBuildButtonActive]}>
                              <View style={arenaStyles.menuBuildTitleRow}>
                                <BuildCrestMark crestDefinition={buildCrestDefinition} size={14} />
                                <Text style={[arenaStyles.menuBuildTitle, { color: isSelected ? buildAccentDefinition.primaryColor : '#EAF4FF' }]}>
                                  {ARENA_BUILD_META[buildId].label}
                                </Text>
                              </View>
                              <Text numberOfLines={2} style={arenaStyles.menuBuildText}>
                                {ARENA_BUILD_META[buildId].summary}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <MetaShowcaseCard
                        title={ARENA_BUILD_META[collectionBuildId].label}
                        subtitle={`${collectionBuildAccentDefinition.label} • ${collectionBuildCrestDefinition.label}`}
                        note="Preview and equip build-specific cosmetics here."
                        bannerDefinition={activeBannerDefinition}
                        frameDefinition={activeFrameDefinition}
                        biomeDefinition={activeBiomeDefinition}
                        accentColor={collectionBuildAccentDefinition.primaryColor}
                        crestDefinition={collectionBuildCrestDefinition}
                      />

                      <Text style={arenaStyles.collectionSectionLabel}>Accents</Text>
                      <View style={arenaStyles.codexGrid}>
                        {collectionAccentIds.map((cosmeticId) => {
                          const definition = getArenaCosmeticDefinition(cosmeticId);
                          const displayState = getArenaCosmeticDisplayState(arenaMeta, cosmeticId);
                          return (
                            <CollectionCard
                              key={`collection-accent-${cosmeticId}`}
                              definition={definition}
                              displayState={displayState}
                              frameDefinition={activeFrameDefinition}
                              onPress={() => {
                                if (displayState === 'claimable') {
                                  handleClaimCosmetic(cosmeticId);
                                } else if (displayState === 'owned') {
                                  handleEquipCosmetic(cosmeticId);
                                }
                              }}
                            />
                          );
                        })}
                      </View>

                      <Text style={arenaStyles.collectionSectionLabel}>Crests</Text>
                      <View style={arenaStyles.codexGrid}>
                        {collectionCrestIds.map((cosmeticId) => {
                          const definition = getArenaCosmeticDefinition(cosmeticId);
                          const displayState = getArenaCosmeticDisplayState(arenaMeta, cosmeticId);
                          return (
                            <CollectionCard
                              key={`collection-crest-${cosmeticId}`}
                              definition={definition}
                              displayState={displayState}
                              frameDefinition={activeFrameDefinition}
                              onPress={() => {
                                if (displayState === 'claimable') {
                                  handleClaimCosmetic(cosmeticId);
                                } else if (displayState === 'owned') {
                                  handleEquipCosmetic(cosmeticId);
                                }
                              }}
                            />
                          );
                        })}
                      </View>
                    </>
                  )
                )}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>

      {gameState.status === 'lost' || pendingRestartSummary ? (
        <View style={arenaStyles.overlay}>
          <View style={arenaStyles.gameOverModal}>
            <Text style={arenaStyles.gameOverTitle}>
              {gameState.status === 'lost' ? 'Health Depleted' : 'Restart Run'}
            </Text>
            <Text style={arenaStyles.gameOverText}>
              {gameState.status === 'lost'
                ? `Enemy fire broke through the shields. Score ${gameState.score}.`
                : 'Review the current run summary before wiping the board.'}
            </Text>
            {activeRunEndSummary ? (
              <View
                style={[
                  arenaStyles.runSummaryCard,
                  {
                    borderColor: hexToRgba(activeBiomeDefinition.headerBorder, 0.62),
                    backgroundColor: hexToRgba(activeBiomeDefinition.headerBackground, 0.72),
                  },
                ]}>
                <View style={arenaStyles.runSummaryHeader}>
                  <Text style={[arenaStyles.runSummaryTitle, { color: activeBiomeDefinition.detailColor }]}>
                    {activeBiomeDefinition.label}
                  </Text>
                  <Text style={arenaStyles.runSummaryTierText}>T{activeRunEndSummary.tierReached}</Text>
                </View>
                <Text style={arenaStyles.runSummaryText}>
                  Bosses cleared:{' '}
                  {activeRunEndSummary.bossLabels.length > 0
                    ? activeRunEndSummary.bossLabels.join(' • ')
                    : 'None'}
                </Text>
                <Text style={arenaStyles.runSummaryText}>
                  Mastery XP: +{activeRunEndSummary.masteryXp} to {ARENA_BUILD_META[activeRunEndSummary.dominantBuild].label}
                </Text>
                <Text style={arenaStyles.runSummaryText}>
                  Rewards ready:{' '}
                  {runEndRewardText ?? 'No new claimable cosmetics from this run.'}
                </Text>
              </View>
            ) : null}
            {collectionNoticeText && !activeRunEndSummary ? <Text style={arenaStyles.gameOverNoticeText}>{collectionNoticeText}</Text> : null}
            <View style={arenaStyles.menuActions}>
              {pendingRestartSummary ? (
                <>
                  <Pressable
                    onPress={() => {
                      setPendingRestartSummary(null);
                      if (gameState.status === 'running') {
                        setIsPaused(false);
                      }
                    }}
                    style={[arenaStyles.menuActionButton, arenaStyles.menuActionSecondary]}>
                    <Text style={arenaStyles.menuActionText}>Continue Run</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirmRestart}
                    style={[arenaStyles.menuActionButton, arenaStyles.menuActionPrimary]}>
                    <Text style={arenaStyles.menuActionText}>Restart Now</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={resetArenaRun} style={[arenaStyles.menuActionButton, arenaStyles.menuActionPrimary]}>
                    <Text style={arenaStyles.menuActionText}>Retry</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSwitchGame('prototype')} style={[arenaStyles.menuActionButton, arenaStyles.menuActionSecondary]}>
                    <Text style={arenaStyles.menuActionText}>Back to Prototype</Text>
                  </Pressable>
                </>
              )}
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
  boardAnnouncementPanel: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  boardAnnouncementText: {
    color: '#F1F7FF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sectorBannerWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 24,
    alignItems: 'center',
    zIndex: 5,
  },
  sectorBannerCard: {
    minWidth: 220,
    maxWidth: 320,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  sectorBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sectorBannerSubtitle: {
    marginTop: 2,
    color: '#DCEBFB',
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
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
  moveHintWrap: {
    position: 'absolute',
    width: MOVE_HINT_DIAMETER,
    height: MOVE_HINT_DIAMETER,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  moveHintCircle: {
    width: MOVE_HINT_DIAMETER,
    height: MOVE_HINT_DIAMETER,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(221, 242, 255, 0.34)',
    backgroundColor: 'rgba(16, 30, 45, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveHintPointerWrap: {
    width: 22,
    height: 22,
    transform: [{ rotate: '-18deg' }],
  },
  moveHintPointerHeadShadow: {
    position: 'absolute',
    left: 4,
    top: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 0,
    borderRightWidth: 12,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(34, 52, 68, 0.88)',
  },
  moveHintPointerStemShadow: {
    position: 'absolute',
    left: 7,
    top: 10,
    width: 6,
    height: 13,
    borderRadius: 3,
    backgroundColor: 'rgba(34, 52, 68, 0.88)',
    transform: [{ rotate: '-34deg' }],
  },
  moveHintPointerHead: {
    position: 'absolute',
    left: 5,
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 0,
    borderRightWidth: 10,
    borderBottomWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(239, 247, 255, 0.94)',
  },
  moveHintPointerStem: {
    position: 'absolute',
    left: 8,
    top: 11,
    width: 5,
    height: 11,
    borderRadius: 3,
    backgroundColor: 'rgba(228, 240, 250, 0.94)',
    transform: [{ rotate: '-34deg' }],
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
  audioControlCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  audioControlTitle: {
    color: '#DCEBFA',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  audioControlValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  audioControlValue: {
    color: '#F1F8FF',
    fontSize: 11.5,
    fontWeight: '900',
  },
  audioAdjustButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A5570',
    backgroundColor: '#122233',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioAdjustButtonText: {
    color: '#F0F8FF',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
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
  playerCrestWrap: {
    position: 'absolute',
    left: 22,
    top: 11,
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSegmentBadge: {
    position: 'absolute',
    top: 5,
    right: 7,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F7FBFF',
    backgroundColor: 'rgba(18, 40, 58, 0.96)',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSegmentBadgeText: {
    color: '#F4FBFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  menuBuildTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuBuildDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaShowcaseCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  metaShowcaseBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 12,
  },
  metaShowcaseGlow: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: -26,
    height: 80,
    borderRadius: 999,
  },
  metaShowcaseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaShowcaseCopy: {
    flex: 1,
    gap: 4,
  },
  metaShowcaseTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  metaShowcaseSubtitle: {
    color: '#E0EEFF',
    fontSize: 11,
    fontWeight: '800',
  },
  metaShowcaseNote: {
    color: '#BFD4EA',
    fontSize: 10.5,
    lineHeight: 15,
  },
  metaShowcaseCrestWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionNoticeCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34536F',
    backgroundColor: '#0F2031',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collectionNoticeText: {
    color: '#DCEBFA',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  collectionSectionLabel: {
    color: '#9DB6D0',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  collectionCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  collectionCardLabel: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  collectionCardMeta: {
    color: '#9AB3CC',
    fontSize: 10,
    fontWeight: '800',
  },
  collectionCardText: {
    color: '#C5D6E7',
    fontSize: 10.5,
    lineHeight: 14,
  },
  collectionCardAction: {
    marginTop: 2,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionCardActionDisabled: {
    borderColor: '#33485D',
    backgroundColor: '#132130',
    opacity: 0.9,
  },
  collectionCardActionText: {
    color: '#F0F8FF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  collectionPreviewBanner: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  collectionPreviewBannerBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 12,
  },
  collectionPreviewBannerCore: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
    height: 8,
    borderRadius: 999,
  },
  collectionPreviewFrame: {
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    padding: 6,
  },
  collectionPreviewFrameInner: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  collectionPreviewAccent: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  collectionPreviewAccentWing: {
    position: 'absolute',
    top: 17,
    width: 14,
    height: 7,
    borderRadius: 7,
  },
  collectionPreviewAccentWingLeft: {
    left: 18,
    transform: [{ rotate: '-15deg' }],
  },
  collectionPreviewAccentWingRight: {
    right: 18,
    transform: [{ rotate: '15deg' }],
  },
  collectionPreviewAccentCore: {
    width: 16,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
  },
  collectionPreviewCrest: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  gameOverNoticeText: {
    color: '#DDEBFA',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  runSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  runSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  runSummaryTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  runSummaryTierText: {
    color: '#F2F8FF',
    fontSize: 12,
    fontWeight: '900',
  },
  runSummaryText: {
    color: '#D9E8F7',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
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
  ultimateIconBlade: {
    position: 'absolute',
    width: 5,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#E9F5FF',
    transform: [{ rotate: '0deg' }],
  },
  ultimateIconBladeReady: {
    backgroundColor: '#FFF1C8',
  },
  ultimateIconSlash: {
    position: 'absolute',
    width: 4,
    height: 15,
    borderRadius: 2,
    backgroundColor: '#CDE2F7',
  },
  ultimateIconSlashReady: {
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
  ultimateIconDiamond: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E8F5FF',
    backgroundColor: 'rgba(14, 26, 40, 0.44)',
    transform: [{ rotate: '45deg' }],
  },
  ultimateIconDiamondReady: {
    borderColor: '#FFEABA',
    backgroundColor: 'rgba(72, 50, 16, 0.42)',
  },
  ultimateIconCore: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 1,
    backgroundColor: '#EDF7FF',
    transform: [{ rotate: '45deg' }],
  },
  ultimateIconCoreReady: {
    backgroundColor: '#FFF0CA',
  },
});
