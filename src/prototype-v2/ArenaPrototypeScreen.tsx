import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { ArenaCanvas } from "./ArenaCanvas";
import {
  getArenaBiomeDefinitionForTier,
  getArenaBiomeTierRange,
  isArenaBiomeTransitionTier,
} from "./biomes";
import { ARENA_BUILD_META, ARENA_BUILD_ORDER } from "./builds";
import {
  ARENA_CAMPAIGN_MISSIONS,
  ARENA_CAMPAIGN_SHIELDS,
  ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER,
  ARENA_CAMPAIGN_SHIP_STAT_UPGRADES,
  ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER,
  ARENA_CAMPAIGN_WEAPON_UPGRADES,
  ARENA_CAMPAIGN_WEAPONS,
  applyArenaCampaignWeaponUpgrades,
  getArenaCampaignShipStatBonuses,
  getArenaCampaignWeaponUpgradeMaxLevel,
  getArenaCampaignLevelProgress,
  getArenaCampaignRunXp,
  getArenaCampaignWeaponSlotCount,
} from "./campaign";
import {
  ARENA_ENEMY_ORDER,
  ARENA_FIXED_STEP_SECONDS,
  ARENA_MAX_CATCH_UP_STEPS,
  ARENA_MAX_FRAME_DELTA_SECONDS,
  ARENA_PLAYER_FLOOR_OFFSET,
  ARENA_PLAYER_HALF_WIDTH,
  ARENA_PLAYER_HEIGHT,
  ARENA_PLAYER_MARGIN,
  ARENA_PLAYER_RENDER_HALF_WIDTH,
  ARENA_TIER_DURATION_SECONDS,
  ARENA_VERSION_LABEL,
} from "./config";
import { getArenaCosmeticDefinition } from "./cosmetics";
import { createEncounterForTier } from "./encounters";
import {
  activateArenaShieldAbility,
  activateArenaUltimate,
  applyArenaArmoryUpgrade,
  createInitialArenaState,
  getArenaActiveEnemyCap,
  getArenaActiveWeapon,
  getArenaDisplayTier,
  setArenaBuild,
  tickArenaState,
} from "./engine";
import {
  ARENA_ENEMY_LABELS,
  applyArenaCampaignRunResult,
  applyArenaDiscoveryProgress,
  applyArenaRunSummary,
  claimArenaCosmetic,
  createArenaMetaState,
  createArenaRunMetaSummary,
  equipArenaCosmetic,
  getArenaBuildCollectionCosmeticIds,
  getArenaBuildUnlockIds,
  getArenaClaimableCosmeticIds,
  getArenaCosmeticDisplayState,
  getArenaCosmeticStatusLabel,
  getArenaEquippedBuildCosmeticId,
  getArenaEquippedGlobalCosmeticId,
  getArenaGlobalCollectionCosmeticIds,
  getArenaGlobalUnlockIds,
  getArenaMasteryProgress,
  getArenaNextBuildUnlock,
  getArenaUnlockRewardCosmeticEntry,
  loadArenaMetaState,
  markArenaCoachHintSeen,
  resetArenaCoachHints,
  saveArenaMetaState,
  setArenaCampaignShield,
  setArenaCampaignWeapon,
  upgradeArenaCampaignShipStat,
  upgradeArenaCampaignWeapon,
} from "./meta";
import type {
  ArenaBuildId,
  ArenaCampaignMissionId,
  ArenaCampaignShieldId,
  ArenaCampaignShipStatUpgradeKey,
  ArenaCampaignWeaponId,
  ArenaCampaignWeaponUpgradeKey,
  ArenaCoachHintId,
  ArenaCosmeticDefinition,
  ArenaCosmeticDisplayState,
  ArenaCosmeticId,
  ArenaDrop,
  ArenaEnemy,
  ArenaGameState,
  ArenaMetaState,
  ArenaRunMetaSummary,
  ArenaRunMode,
  ArenaUnlockEntry,
  ArenaVfxQuality,
} from "./types";
import {
  ARENA_ARMORY_UPGRADES,
  ARENA_ARMORY_UPGRADE_ORDER,
  isArenaArmoryUpgradeMaxed,
} from "./upgrades";

type AppGameId = "defender" | "prototype" | "prototypeV2";

type ArenaPrototypeScreenProps = {
  onSwitchGame: (game: AppGameId) => void;
};

type ArenaMenuTab = "run" | "codex" | "mastery" | "collection";
type ArenaHubPanel =
  | "root"
  | "mission"
  | "collection"
  | "codex"
  | "mastery"
  | "weapon"
  | "shield"
  | "extras";
type ArenaRunEndSummary = {
  tierReached: number;
  bossLabels: string[];
  masteryXp: number;
  campaignXp: number;
  campaignMissionLabel: string | null;
  campaignCompleted: boolean;
  newlyClaimableIds: ArenaCosmeticId[];
  dominantBuild: ArenaBuildId;
  progressNote: string | null;
};

const FEATURED_COLLECTION_REWARD_IDS: ArenaCosmeticId[] = [
  "bannerPrismShard",
  "bannerEclipseCut",
  "codexFrameEndlessApex",
  "codexFrameThreatCartographer",
  "bannerDeepCycle",
  "codexFrameOuterLimit",
  "codexFrameFullRotation",
  "bannerTriadBreaker",
];
const BOSS_ENEMY_ORDER = [
  "prismBoss",
  "hiveCarrierBoss",
  "vectorLoomBoss",
  "eclipseTalonBoss",
] as const;
const ARENA_COACH_HINT_COPY: Record<
  ArenaCoachHintId,
  { title: string; body: string }
> = {
  movement: {
    title: "Move zone",
    body: "Press and drag near the circle below the ship to steer without covering the hull.",
  },
  salvageArmory: {
    title: "Armory queued",
    body: "Salvage banks upgrade picks. Open the left armory button when there is a safe window.",
  },
  buildSwitching: {
    title: "Build swap",
    body: "The armory Builds tab lets you switch kits mid-run; mastery XP goes to the build used most.",
  },
  overdrive: {
    title: "Overdrive",
    body: "Overdrive temporarily pushes installed stats above cap. Use it to stabilize swarm spikes.",
  },
  ultimateCharge: {
    title: "Ultimate charge",
    body: "Ultimate charge is earned more slowly now. Save the right button for boss or swarm pressure.",
  },
  impactHazard: {
    title: "Impact warning",
    body: "Circular markers are delayed shell impacts. Leave the marker before it flashes solid.",
  },
  laneBandHazard: {
    title: "Lane band",
    body: "Column bands punish staying still. Cross into the open lane as the telegraph settles.",
  },
  bossPhase: {
    title: "Boss phase",
    body: "Bosses change pressure at health breaks. Expect a short pattern reset after each phase callout.",
  },
  collectionClaim: {
    title: "Rewards ready",
    body: "Claimable cosmetics wait in Collection. Claiming never auto-equips or changes combat stats.",
  },
  tierRewards: {
    title: "Long-run goals",
    body: "New cosmetic milestones now extend through T30, T45, and T60.",
  },
};
const ARENA_LOSS_TRANSITION_SECONDS = 1.35;

class ArenaCanvasErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ArenaCanvas] render crash:", error);
  }

  render() {
    if (this.state.hasError) {
      return <View style={{ flex: 1, backgroundColor: "#0a0a12" }} />;
    }
    return this.props.children;
  }
}

const ENDLESS_T40_DEMO_TIER = 40;
const ENDLESS_T40_DEMO_DAMAGE_UPGRADES = 8;
const ENDLESS_T40_DEMO_HULL_UPGRADES = 6;
const ENDLESS_T40_DEMO_SHIELD_UPGRADES = 6;
const ENDLESS_T40_DEMO_NEXT_ARMORY_COST = 620;
const ENDLESS_T40_DEMO_STATUS_TEXT =
  "T40 demo live. Progression, rewards, and codex discoveries are disabled for this run.";
const ENDLESS_T40_DEMO_CAPPED_UPGRADES = [
  "rapidCycle",
  "twinArray",
  "phasePierce",
  "accelerator",
] as const;
const ARENA_AUDIO_DISABLED_NOTE =
  "Audio is temporarily disabled while first-launch stability is debugged.";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampWorklet(value: number, min: number, max: number) {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hexColor: string, alpha: number) {
  const normalizedHex = hexColor.replace("#", "");
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
  const totalKills = ARENA_ENEMY_ORDER.reduce(
    (sum, kind) => sum + gameState.runKillCountsByEnemy[kind],
    0,
  );
  return (
    gameState.elapsed >= 3 ||
    totalKills > 0 ||
    gameState.runMiniBossClears > 0 ||
    gameState.runBossClears > 0 ||
    gameState.bestTierReached > 1
  );
}

function getArenaRunEarnedXp(runSummary: ArenaRunMetaSummary) {
  return (
    runSummary.tierReached * 20 +
    runSummary.miniBossClears * 35 +
    runSummary.bossClears * 100
  );
}

function createArenaRunEndSummary(
  metaState: ArenaMetaState,
  gameState: ArenaGameState,
): ArenaRunEndSummary | null {
  if (!isMeaningfulArenaRun(gameState)) {
    return null;
  }

  const runSummary = createArenaRunMetaSummary(gameState);
  const nextMetaState = gameState.isDebugDemoRun
    ? metaState
    : applyArenaRunSummary(metaState, runSummary);
  const campaignMission =
    gameState.runMode === "campaign" && gameState.campaignMissionId
      ? ARENA_CAMPAIGN_MISSIONS[gameState.campaignMissionId]
      : null;
  const claimableSet = new Set(getArenaClaimableCosmeticIds(metaState));
  const newlyClaimableIds = gameState.isDebugDemoRun
    ? []
    : getArenaClaimableCosmeticIds(nextMetaState).filter(
        (cosmeticId) => !claimableSet.has(cosmeticId),
      );

  return {
    tierReached: runSummary.tierReached,
    bossLabels: BOSS_ENEMY_ORDER.filter(
      (kind) => gameState.runBossClearsByEnemy[kind] > 0,
    ).map((kind) => ARENA_ENEMY_LABELS[kind]),
    masteryXp: gameState.isDebugDemoRun ? 0 : getArenaRunEarnedXp(runSummary),
    campaignXp: gameState.isDebugDemoRun ? 0 : getArenaCampaignRunXp(gameState),
    campaignMissionLabel: campaignMission?.label ?? null,
    campaignCompleted: gameState.status === "won",
    newlyClaimableIds,
    dominantBuild: runSummary.dominantBuild,
    progressNote: gameState.isDebugDemoRun
      ? "Demo run only: progression, rewards, and codex discoveries are not saved."
      : null,
  };
}

function getCollectionStatePriority(state: ArenaCosmeticDisplayState) {
  switch (state) {
    case "claimable":
      return 0;
    case "equipped":
      return 1;
    case "owned":
      return 2;
    case "locked":
    default:
      return 3;
  }
}

function EnemyNode({ enemy }: { enemy: ArenaEnemy }) {
  const isBoss =
    enemy.kind === "prismBoss" ||
    enemy.kind === "hiveCarrierBoss" ||
    enemy.kind === "vectorLoomBoss" ||
    enemy.kind === "eclipseTalonBoss";

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
      ]}
    >
      <Text
        style={[
          arenaStyles.enemyHealthText,
          enemy.maxHealth >= 100 && arenaStyles.enemyHealthTextCompact,
          isBoss && arenaStyles.enemyHealthTextBoss,
        ]}
      >
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
      ]}
    >
      <Text style={arenaStyles.dropLabel}>{drop.label}</Text>
    </View>
  );
}

const ULTIMATE_ICON_SLASH_ANGLES = ["-42deg", "42deg"] as const;
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

function ShieldAbilityControlIcon({
  ready,
  active,
  progress,
}: {
  ready: boolean;
  active: boolean;
  progress: number;
}) {
  return (
    <View pointerEvents="none" style={arenaStyles.shieldAbilityIconWrap}>
      <View
        style={[
          arenaStyles.shieldAbilityArc,
          active && arenaStyles.shieldAbilityArcActive,
          ready && arenaStyles.shieldAbilityArcReady,
        ]}
      />
      <View style={arenaStyles.shieldAbilityCore}>
        <View
          style={[
            arenaStyles.shieldAbilityCoreFill,
            { opacity: 0.18 + progress * 0.62 },
          ]}
        />
      </View>
      <View
        style={[
          arenaStyles.shieldAbilitySpark,
          ready && arenaStyles.shieldAbilitySparkReady,
        ]}
      />
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
            backgroundColor: ready
              ? accentDefinition.detailColor
              : accentDefinition.secondaryColor,
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
              backgroundColor: ready
                ? accentDefinition.glowColor
                : accentDefinition.primaryColor,
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
            borderColor: ready
              ? accentDefinition.glowColor
              : accentDefinition.secondaryColor,
          },
        ]}
      />
      <View
        style={[
          arenaStyles.ultimateIconDiamond,
          ready && arenaStyles.ultimateIconDiamondReady,
          {
            borderColor: ready
              ? accentDefinition.detailColor
              : accentDefinition.primaryColor,
          },
        ]}
      />
      <View
        style={[
          arenaStyles.ultimateIconCore,
          ready && arenaStyles.ultimateIconCoreReady,
          {
            backgroundColor: ready
              ? accentDefinition.primaryColor
              : accentDefinition.secondaryColor,
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
    position: "absolute" as const,
    borderRadius: Math.max(1, unit),
  };

  switch (crestDefinition.emblemKey) {
    case "rail-zenith":
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
                transform: [{ rotate: "45deg" }],
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
                transform: [{ rotate: "-28deg" }],
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
                transform: [{ rotate: "28deg" }],
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
    case "nova-default":
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
    case "nova-solar":
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
    case "missile-default":
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
                transform: [{ rotate: "-24deg" }],
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
                transform: [{ rotate: "24deg" }],
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
                transform: [{ rotate: "45deg" }],
              },
            ]}
          />
        </View>
      );
    case "missile-crown":
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
    case "fracture-default":
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
                transform: [{ rotate: "28deg" }],
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
                transform: [{ rotate: "-28deg" }],
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
    case "fracture-crown":
      return (
        <View pointerEvents="none" style={{ width: size, height: size }}>
          {[
            { left: unit * 4.6, top: unit * 0.8, rotate: "18deg" },
            { left: unit * 1.4, top: unit * 4.2, rotate: "-28deg" },
            { right: unit * 1.4, top: unit * 4.2, rotate: "28deg" },
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
                transform: [{ rotate: "45deg" }],
              },
            ]}
          />
        </View>
      );
    case "rail-default":
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
                transform: [{ rotate: "-26deg" }],
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
                transform: [{ rotate: "26deg" }],
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
  const status =
    rewardEntry?.displayState ?? (entry.unlocked ? "owned" : "locked");
  const statusLabel = getArenaCosmeticStatusLabel(status);
  const highlightColor =
    accentColor ??
    rewardEntry?.definition.primaryColor ??
    frameDefinition.secondaryColor;
  const borderColor =
    status === "equipped"
      ? hexToRgba(highlightColor, 0.84)
      : status === "claimable"
        ? hexToRgba(frameDefinition.detailColor, 0.82)
        : status === "owned"
          ? hexToRgba(frameDefinition.secondaryColor, 0.66)
          : "#29435B";
  const backgroundColor =
    status === "equipped"
      ? hexToRgba(highlightColor, 0.18)
      : status === "claimable"
        ? hexToRgba(frameDefinition.primaryColor, 0.24)
        : status === "owned"
          ? hexToRgba(frameDefinition.primaryColor, 0.14)
          : "rgba(11, 22, 34, 0.92)";

  return (
    <View
      style={[
        arenaStyles.unlockChip,
        status === "locked"
          ? arenaStyles.unlockChipLocked
          : arenaStyles.unlockChipUnlocked,
        {
          borderColor,
          backgroundColor,
        },
      ]}
    >
      <Text
        style={[
          arenaStyles.unlockChipLabel,
          status === "locked" && arenaStyles.unlockChipLabelLocked,
        ]}
      >
        {entry.rewardLabel}
      </Text>
      <Text
        style={arenaStyles.unlockChipMeta}
      >{`${statusLabel} • ${entry.description}`}</Text>
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
          borderColor: hexToRgba(
            biomeDefinition?.headerBorder ?? frameDefinition.secondaryColor,
            0.72,
          ),
          backgroundColor: hexToRgba(
            biomeDefinition?.headerBackground ?? bannerDefinition.primaryColor,
            0.76,
          ),
          shadowColor: biomeDefinition?.glowColor ?? bannerDefinition.glowColor,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          arenaStyles.metaShowcaseBanner,
          {
            backgroundColor: hexToRgba(
              biomeDefinition?.menuStripe ?? bannerDefinition.secondaryColor,
              0.84,
            ),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          arenaStyles.metaShowcaseGlow,
          {
            backgroundColor: hexToRgba(
              biomeDefinition?.announcementGlow ?? bannerDefinition.glowColor,
              0.16,
            ),
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
            ]}
          >
            {title}
          </Text>
          <Text style={arenaStyles.metaShowcaseSubtitle}>{subtitle}</Text>
          {note ? (
            <Text style={arenaStyles.metaShowcaseNote}>{note}</Text>
          ) : null}
        </View>
        {crestDefinition ? (
          <View
            style={[
              arenaStyles.metaShowcaseCrestWrap,
              {
                borderColor: hexToRgba(frameDefinition.detailColor, 0.5),
                backgroundColor: hexToRgba(frameDefinition.primaryColor, 0.26),
              },
            ]}
          >
            <BuildCrestMark crestDefinition={crestDefinition} size={18} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CollectionPreview({
  definition,
}: {
  definition: ArenaCosmeticDefinition;
}) {
  if (definition.slot === "banner") {
    return (
      <View
        style={[
          arenaStyles.collectionPreviewBanner,
          {
            backgroundColor: hexToRgba(definition.primaryColor, 0.94),
            borderColor: hexToRgba(definition.detailColor, 0.64),
          },
        ]}
      >
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

  if (definition.slot === "codexFrame") {
    return (
      <View
        style={[
          arenaStyles.collectionPreviewFrame,
          {
            borderColor: hexToRgba(definition.secondaryColor, 0.94),
            backgroundColor: hexToRgba(definition.primaryColor, 0.3),
          },
        ]}
      >
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

  if (definition.slot === "buildAccent") {
    return (
      <View
        style={[
          arenaStyles.collectionPreviewAccent,
          {
            borderColor: hexToRgba(definition.secondaryColor, 0.82),
            backgroundColor: hexToRgba(definition.primaryColor, 0.22),
          },
        ]}
      >
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
      ]}
    >
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
    displayState === "claimable"
      ? "Claim"
      : displayState === "owned"
        ? "Equip"
        : displayState === "equipped"
          ? "Equipped"
          : "Locked";
  const actionDisabled =
    displayState === "locked" || displayState === "equipped";
  const titleColor =
    displayState === "locked" ? "#B6C6D6" : definition.detailColor;
  const borderColor =
    displayState === "equipped"
      ? hexToRgba(definition.secondaryColor, 0.9)
      : displayState === "claimable"
        ? hexToRgba(frameDefinition.detailColor, 0.78)
        : displayState === "owned"
          ? hexToRgba(definition.secondaryColor, 0.66)
          : "#2B4258";

  return (
    <View
      style={[
        arenaStyles.collectionCard,
        {
          borderColor,
          backgroundColor:
            displayState === "locked"
              ? "rgba(12, 23, 35, 0.94)"
              : hexToRgba(definition.primaryColor, 0.14),
        },
      ]}
    >
      <CollectionPreview definition={definition} />
      <Text style={[arenaStyles.collectionCardLabel, { color: titleColor }]}>
        {definition.label}
      </Text>
      <Text style={arenaStyles.collectionCardMeta}>
        {`${getArenaCosmeticStatusLabel(displayState)} • ${definition.rarity.toUpperCase()}`}
      </Text>
      <Text style={arenaStyles.collectionCardText}>
        {definition.description}
      </Text>
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
        ]}
      >
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

export function ArenaPrototypeScreen({
  onSwitchGame,
}: ArenaPrototypeScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortraitViewport = windowHeight >= windowWidth;
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [gameState, setGameState] = useState(() =>
    createInitialArenaState(900),
  );
  const [shellMode, setShellMode] = useState<"hub" | "arena">("hub");
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isArmoryOpen, setIsArmoryOpen] = useState(false);
  const [armoryTab, setArmoryTab] = useState<"upgrade" | "build">("upgrade");
  const [vfxQuality, setVfxQuality] = useState<ArenaVfxQuality>("high");
  const [menuTab, setMenuTab] = useState<ArenaMenuTab>("run");
  const [hubPanel, setHubPanel] = useState<ArenaHubPanel>("root");
  const [hubWeaponUpgradeTargetId, setHubWeaponUpgradeTargetId] =
    useState<ArenaCampaignWeaponId>("railCannon");
  const [collectionBuildId, setCollectionBuildId] =
    useState<ArenaBuildId>("railFocus");
  const [arenaMeta, setArenaMeta] = useState<ArenaMetaState>(() =>
    createArenaMetaState(),
  );
  const [isMetaReady, setIsMetaReady] = useState(false);
  const [isMoveHintPressed, setIsMoveHintPressed] = useState(false);
  const [pendingCollectionNoticeIds, setPendingCollectionNoticeIds] = useState<
    ArenaCosmeticId[]
  >([]);
  const [activeCoachHintId, setActiveCoachHintId] =
    useState<ArenaCoachHintId | null>(null);
  const [sectorBannerTier, setSectorBannerTier] = useState<number | null>(null);
  const [lossTransitionTimer, setLossTransitionTimer] = useState(0);
  const [runEndSummary, setRunEndSummary] = useState<ArenaRunEndSummary | null>(
    null,
  );
  const [pendingRestartSummary, setPendingRestartSummary] =
    useState<ArenaRunEndSummary | null>(null);
  const hasInitializedBoardRef = useRef(false);
  const armoryResumeOnCloseRef = useRef(false);
  const persistedDiscoveryKeyRef = useRef("");
  const runMetaCommittedRef = useRef(false);
  const hasHydratedClaimablesRef = useRef(false);
  const claimableSignatureRef = useRef("");
  const lastBiomeBannerKeyRef = useRef("");
  const playerVisualX = useSharedValue(900 / 2);
  const playerShellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: playerVisualX.value - ARENA_PLAYER_RENDER_HALF_WIDTH },
    ],
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
    if (boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }

    if (!hasInitializedBoardRef.current) {
      hasInitializedBoardRef.current = true;
      playerVisualX.value = boardSize.width / 2;
      if (hasStarted) {
        setGameState((previousState) => {
          return {
            ...previousState,
            playerX: boardSize.width / 2,
          };
        });
      } else {
        const initialState = createInitialArenaState(boardSize.width);
        setGameState(initialState);
        setIsPaused(true);
      }
      runMetaCommittedRef.current = false;
      return;
    }

    playerVisualX.value = clamp(
      playerVisualX.value,
      ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
      boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN,
    );
    setGameState((previousState) => ({
      ...previousState,
      playerX: clamp(
        previousState.playerX,
        ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
        boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN,
      ),
      enemies: previousState.enemies.map((enemy) => ({
        ...enemy,
        x: clamp(
          enemy.x,
          enemy.size / 2 + 8,
          boardSize.width - enemy.size / 2 - 8,
        ),
      })),
    }));
  }, [boardSize.height, boardSize.width, hasStarted, playerVisualX]);

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

      const elapsedSeconds = Math.min(
        (timeMs - lastFrameTimeMs) / 1000,
        ARENA_MAX_FRAME_DELTA_SECONDS,
      );
      lastFrameTimeMs = timeMs;

      if (hasStarted && !isPaused && !isArmoryOpen && !isMenuOpen) {
        accumulatedSimulationSeconds += elapsedSeconds;
        const stepDurations: number[] = [];
        let remainingStepSeconds = accumulatedSimulationSeconds;
        while (
          remainingStepSeconds > 0.0001 &&
          stepDurations.length < maxSubstepsPerFrame
        ) {
          const stepSeconds = Math.min(
            ARENA_FIXED_STEP_SECONDS,
            remainingStepSeconds,
          );
          stepDurations.push(stepSeconds);
          remainingStepSeconds -= stepSeconds;
        }
        accumulatedSimulationSeconds =
          stepDurations.length >= maxSubstepsPerFrame
            ? 0
            : Math.max(0, remainingStepSeconds);
        const livePlayerX = clamp(
          playerVisualX.value,
          ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
          boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN,
        );
        setGameState((previousState) => {
          if (previousState.status !== "running") {
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
          try {
            for (let index = 0; index < stepDurations.length; index += 1) {
              if (nextState.status !== "running") {
                break;
              }
              nextState = tickArenaState(
                nextState,
                stepDurations[index],
                boardSize.width,
                boardSize.height,
              );
            }
          } catch (error) {
            console.error("[ArenaGame] tickArenaState crash:", error);
            return previousState;
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
  }, [
    boardSize.height,
    boardSize.width,
    hasStarted,
    isArmoryOpen,
    isMenuOpen,
    isPaused,
    playerVisualX,
  ]);

  useLayoutEffect(() => {
    if (gameState.status === "lost") {
      setLossTransitionTimer(ARENA_LOSS_TRANSITION_SECONDS);
      setIsPaused(true);
      setIsArmoryOpen(false);
      setIsMoveHintPressed(false);
      setPendingRestartSummary(null);
      armoryResumeOnCloseRef.current = false;
    } else if (gameState.status === "won") {
      setIsPaused(true);
      setIsArmoryOpen(false);
      setIsMoveHintPressed(false);
      setPendingRestartSummary(null);
      armoryResumeOnCloseRef.current = false;
    }
  }, [gameState.status]);

  useEffect(() => {
    if (lossTransitionTimer <= 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLossTransitionTimer((previousTimer) =>
        Math.max(0, previousTimer - 1 / 30),
      );
    }, 1000 / 30);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [lossTransitionTimer]);

  const discoverySignature = ARENA_ENEMY_ORDER.map(
    (kind) => `${kind}:${gameState.runSeenTierByEnemy[kind] ?? "-"}`,
  ).join("|");

  useEffect(() => {
    if (!isMetaReady || gameState.isDebugDemoRun) {
      return;
    }
    if (discoverySignature === persistedDiscoveryKeyRef.current) {
      return;
    }
    persistedDiscoveryKeyRef.current = discoverySignature;
    setArenaMeta((previousMetaState) => {
      const nextMetaState = applyArenaDiscoveryProgress(
        previousMetaState,
        gameState.runSeenTierByEnemy,
      );
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  }, [
    discoverySignature,
    gameState.isDebugDemoRun,
    gameState.runSeenTierByEnemy,
    isMetaReady,
  ]);

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
    const signature = claimableIds.join("|");
    if (!hasHydratedClaimablesRef.current) {
      hasHydratedClaimablesRef.current = true;
      claimableSignatureRef.current = signature;
      return;
    }

    const previousIds =
      claimableSignatureRef.current.length > 0
        ? claimableSignatureRef.current.split("|")
        : [];
    const previousIdSet = new Set(previousIds);
    const nextNoticeIds = claimableIds.filter(
      (cosmeticId) => !previousIdSet.has(cosmeticId),
    );
    if (nextNoticeIds.length > 0) {
      setPendingCollectionNoticeIds((previousIdsState) =>
        Array.from(new Set([...previousIdsState, ...nextNoticeIds])),
      );
    }
    claimableSignatureRef.current = signature;
  }, [arenaMeta, isMetaReady]);

  useEffect(() => {
    if (
      !isMenuOpen ||
      menuTab !== "collection" ||
      pendingCollectionNoticeIds.length === 0
    ) {
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
    nextBossEncounter?.type === "boss"
      ? `T${nextBossTier} • ${nextBossEncounter.label}`
      : "T6 • Prism Core";
  const activeEnemyCap = getArenaActiveEnemyCap(displayTier);
  const activeWeapon = getArenaActiveWeapon(gameState);
  const activeBuildMeta = ARENA_BUILD_META[gameState.activeBuild];
  const campaignLevelProgress = getArenaCampaignLevelProgress(arenaMeta.campaign.xp);
  const campaignWeaponSlotCount = getArenaCampaignWeaponSlotCount(arenaMeta.campaign.level);
  const activeCampaignWeaponId =
    arenaMeta.campaign.loadout.weaponSlots[arenaMeta.campaign.loadout.activeWeaponSlot] ??
    arenaMeta.campaign.loadout.weaponSlots[0];
  const activeCampaignWeapon = ARENA_CAMPAIGN_WEAPONS[activeCampaignWeaponId];
  const activeCampaignShield = ARENA_CAMPAIGN_SHIELDS[arenaMeta.campaign.loadout.shieldId];
  const hubWeaponUpgradeTargetLocked =
    ARENA_CAMPAIGN_WEAPONS[hubWeaponUpgradeTargetId].unlockLevel >
    arenaMeta.campaign.level;
  const hubWeaponUpgradeTargetIdSafe = hubWeaponUpgradeTargetLocked
    ? activeCampaignWeaponId
    : hubWeaponUpgradeTargetId;
  const hubWeaponUpgradeTarget =
    ARENA_CAMPAIGN_WEAPONS[hubWeaponUpgradeTargetIdSafe];
  const hubWeaponUpgradeTrack =
    arenaMeta.campaign.weaponUpgrades[hubWeaponUpgradeTargetIdSafe];
  const hubSpentWeaponUpgradeCount = Object.values(
    arenaMeta.campaign.weaponUpgrades,
  ).reduce(
    (total, track) =>
      total +
      ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER.reduce(
        (trackTotal, key) => trackTotal + track[key],
        0,
      ),
    0,
  );
  const hubSpentShipStatUpgradeCount = ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER.reduce(
    (total, key) => total + arenaMeta.campaign.shipStatUpgrades[key],
    0,
  );
  const hubCampaignShipStatBonuses = getArenaCampaignShipStatBonuses(
    arenaMeta.campaign.shipStatUpgrades,
  );
  const activeMission = ARENA_CAMPAIGN_MISSIONS.prismVergeRecon;
  const activeBannerDefinition = getArenaCosmeticDefinition(
    getArenaEquippedGlobalCosmeticId(arenaMeta, "banner"),
  );
  const activeFrameDefinition = getArenaCosmeticDefinition(
    getArenaEquippedGlobalCosmeticId(arenaMeta, "codexFrame"),
  );
  const activeAccentDefinition = getArenaCosmeticDefinition(
    getArenaEquippedBuildCosmeticId(
      arenaMeta,
      gameState.activeBuild,
      "buildAccent",
    ),
  );
  const activeCrestDefinition = getArenaCosmeticDefinition(
    getArenaEquippedBuildCosmeticId(
      arenaMeta,
      gameState.activeBuild,
      "buildCrest",
    ),
  );
  const playerHullBaseColor = "#E7F1FF";
  const playerHullEdgeColor = "#91A8C8";
  const playerHullPanelColor = "#14253B";
  const playerHullPanelEdgeColor = "#2E4B6A";
  const playerAccentStripColor = activeAccentDefinition.primaryColor;
  const playerWingAccentColor = activeAccentDefinition.secondaryColor;
  const playerCanopyColor = hexToRgba(activeAccentDefinition.detailColor, 0.84);
  const playerEngineGlowColor = activeAccentDefinition.glowColor;
  const claimableCosmeticIds = getArenaClaimableCosmeticIds(arenaMeta);
  const claimableCosmeticIdSet = new Set(claimableCosmeticIds);
  const pendingClaimableNoticeIds = pendingCollectionNoticeIds.filter((cosmeticId) =>
    claimableCosmeticIdSet.has(cosmeticId),
  );
  const newClaimableCount = pendingClaimableNoticeIds.length;
  const pendingClaimableLabels = pendingClaimableNoticeIds
    .slice(0, 2)
    .map((cosmeticId) => getArenaCosmeticDefinition(cosmeticId).label);
  const featuredRewardIds = [...FEATURED_COLLECTION_REWARD_IDS].sort(
    (leftId, rightId) => {
      const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
      const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
      return (
        getCollectionStatePriority(leftState) -
        getCollectionStatePriority(rightState)
      );
    },
  );
  const collectionNoticeText =
    newClaimableCount > 0
      ? `New rewards ready: ${pendingClaimableLabels.join(" • ")}${newClaimableCount > pendingClaimableLabels.length ? ` +${newClaimableCount - pendingClaimableLabels.length}` : ""}. Claim in Collection.`
      : claimableCosmeticIds.length > 0
        ? `Collection has ${claimableCosmeticIds.length} reward${claimableCosmeticIds.length === 1 ? "" : "s"} ready to claim.`
        : null;
  const fireRate = (1 / activeWeapon.fireInterval).toFixed(1);
  const ultimateChargeProgress = clamp(gameState.ultimateCharge / 100, 0, 1);
  const ultimateReady = gameState.ultimateCharge >= 100;
  const isLossTransitionActive =
    gameState.status === "lost" && lossTransitionTimer > 0;
  const lossTransitionProgress = isLossTransitionActive
    ? clamp(
        1 - lossTransitionTimer / ARENA_LOSS_TRANSITION_SECONDS,
        0,
        1,
      )
    : 1;
  const lossCurtainOffset =
    boardSize.height * 0.5 * (1 - lossTransitionProgress);
  const activeEncounterAnchor = gameState.activeEncounter
    ? ((gameState.activeEncounter.anchorEnemyId
        ? gameState.enemies.find(
            (enemy) => enemy.id === gameState.activeEncounter?.anchorEnemyId,
          )
        : null) ??
      gameState.enemies.find(
        (enemy) => enemy.kind === gameState.activeEncounter?.anchorKind,
      ) ??
      null)
    : null;
  const isCampaignRun = gameState.runMode === "campaign";
  const hasArmoryChoices = gameState.availableArmoryChoices > 0;
  const armoryAvailabilityLabel =
    !hasArmoryChoices
      ? "No upgrades pending"
      : gameState.availableArmoryChoices === 1
        ? "1 upgrade available"
        : `${gameState.availableArmoryChoices} upgrades available`;
  const canShowCoachHint =
    isMetaReady &&
    hasStarted &&
    !isPaused &&
    !isArmoryOpen &&
    !isMenuOpen &&
    gameState.status === "running";
  const eligibleCoachHintId: ArenaCoachHintId | null = (() => {
    if (!canShowCoachHint || activeCoachHintId !== null) {
      return null;
    }

    const isUnseen = (hintId: ArenaCoachHintId) =>
      !arenaMeta.coachHints[hintId]?.seen;
    if (
      isUnseen("laneBandHazard") &&
      gameState.hazards.some((hazard) => hazard.kind === "laneBand")
    ) {
      return "laneBandHazard";
    }
    if (
      isUnseen("impactHazard") &&
      gameState.hazards.some((hazard) => hazard.kind === "impact")
    ) {
      return "impactHazard";
    }
    if (
      isUnseen("bossPhase") &&
      gameState.activeEncounter?.type === "boss" &&
      gameState.activeEncounter.bossPhaseIndex > 0
    ) {
      return "bossPhase";
    }
    if (isUnseen("collectionClaim") && claimableCosmeticIds.length > 0) {
      return "collectionClaim";
    }
    if (!isCampaignRun && isUnseen("salvageArmory") && hasArmoryChoices) {
      return "salvageArmory";
    }
    if (isUnseen("ultimateCharge") && (ultimateReady || gameState.ultimateCharge >= 70)) {
      return "ultimateCharge";
    }
    if (isUnseen("overdrive") && gameState.overclockTimer > 0) {
      return "overdrive";
    }
    if (isUnseen("buildSwitching") && displayTier >= 3) {
      return "buildSwitching";
    }
    if (isUnseen("tierRewards") && displayTier >= 24) {
      return "tierRewards";
    }
    if (isUnseen("movement")) {
      return "movement";
    }
    return null;
  })();
  const activeCoachHintCopy = activeCoachHintId
    ? ARENA_COACH_HINT_COPY[activeCoachHintId]
    : null;
  const healthProgress = clamp(
    gameState.hull / Math.max(1, gameState.maxHull),
    0,
    1,
  );
  const shieldProgress = clamp(
    gameState.shield / Math.max(1, gameState.maxShield),
    0,
    1,
  );
  const salvageProgress = clamp(
    gameState.salvage / Math.max(1, gameState.nextArmoryCost),
    0,
    1,
  );
  const shieldAbilityDefinition = gameState.campaignShieldId
    ? ARENA_CAMPAIGN_SHIELDS[gameState.campaignShieldId]
    : null;
  const shieldAbilityReady =
    isCampaignRun &&
    shieldAbilityDefinition !== null &&
    gameState.shieldAbilityCooldown <= 0 &&
    gameState.shieldAbilityTimer <= 0;
  const shieldAbilityProgress =
    shieldAbilityDefinition === null
      ? 0
      : gameState.shieldAbilityTimer > 0
        ? 1
        : 1 -
          clamp(
            gameState.shieldAbilityCooldown /
              Math.max(1, shieldAbilityDefinition.cooldownSeconds),
            0,
            1,
          );
  const shakeEnabled =
    hasStarted &&
    !isPaused &&
    !isArmoryOpen &&
    !isMenuOpen &&
    gameState.status === "running";
  const overdriveShake =
    gameState.overclockTimer > 0
      ? 0.18 + Math.min(1, gameState.overclockTimer / 6) * 0.34
      : 0;
  const ultimateShake =
    gameState.ultimateTimer > 0
      ? 0.36 + Math.min(1, gameState.ultimateTimer / 1.6) * 0.46
      : 0;
  const boardShakeStrength = shakeEnabled
    ? clamp(Math.max(overdriveShake, ultimateShake), 0, 1)
    : 0;
  const boardShakeX =
    Math.sin(gameState.elapsed * 76) * boardShakeStrength * 1.5;
  const boardShakeY =
    Math.cos(gameState.elapsed * 63) * boardShakeStrength * 1.05;
  const hasEncounterAnnouncement =
    gameState.encounterAnnouncement !== null &&
    gameState.encounterAnnouncementTimer > 0;
  const encounterAnnouncementProgress = hasEncounterAnnouncement
    ? 1 - gameState.encounterAnnouncementTimer / 1.75
    : 0;
  const encounterAnnouncementOpacity = hasEncounterAnnouncement
    ? Math.sin(Math.min(1, encounterAnnouncementProgress) * Math.PI)
    : 0;
  const sideControlTop =
    boardSize.height > 0
      ? clamp(
          boardSize.height * 0.75 - 30,
          72,
          Math.max(72, boardSize.height - 102),
        )
      : 72;
  const armoryReadyPulse = hasArmoryChoices
    ? 0.5 + Math.sin(gameState.elapsed * 4.2) * 0.5
    : 0;
  const ultimateReadyPulse = ultimateReady
    ? 0.5 + Math.sin(gameState.elapsed * 5.8) * 0.5
    : 0;
  const statusText = (() => {
    if (!hasStarted) {
      return "Press Start to deploy the arena test.";
    }
    if (isArmoryOpen) {
      return `Armory open. ${armoryAvailabilityLabel}.`;
    }
    if (isMenuOpen) {
      return collectionNoticeText
        ? `Menu open. ${collectionNoticeText}`
        : "Menu open. Simulation paused.";
    }
    if (isLossTransitionActive) {
      return "Ship critical. Closing telemetry...";
    }
    if (gameState.status === "won") {
      return "Mission complete. Return to Home Base or deploy again.";
    }
    if (gameState.status === "lost") {
      return "Health depleted. Restart to run again.";
    }
    if (isPaused) {
      return "Arena Prototype paused.";
    }
    if (gameState.pickupMessage) {
      return gameState.pickupMessage;
    }
    if (activeEncounterAnchor && gameState.activeEncounter) {
      return `${gameState.activeEncounter.label} ${formatArenaValue(activeEncounterAnchor.health)}`;
    }
    if (gameState.activeEncounter) {
      return `${gameState.activeEncounter.label} active`;
    }
    if (gameState.overclockTimer > 0) {
      return `${activeBuildMeta.shortLabel} Overdrive ${gameState.overclockTimer.toFixed(1)}s. Threat ${gameState.enemies.length}/${activeEnemyCap}`;
    }
    if (isCampaignRun) {
      return `${activeCampaignWeapon.shortLabel} sortie. Objective T${gameState.campaignTargetTier ?? activeMission.targetTier}. Threat ${gameState.enemies.length}/${activeEnemyCap}`;
    }
    return `${activeBuildMeta.shortLabel} Build online. Threat ${gameState.enemies.length}/${activeEnemyCap}`;
  })();
  const shouldShowRunEndOverlay =
    ((gameState.status === "lost" && !isLossTransitionActive) ||
      gameState.status === "won") ||
    pendingRestartSummary !== null;
  const armorySubtitle = `${armoryAvailabilityLabel}. Next standard unlock ${gameState.nextArmoryCost} salvage.`;
  const armoryUpgrades = ARENA_ARMORY_UPGRADE_ORDER.map((key) => {
    const definition = ARENA_ARMORY_UPGRADES[key];
    const isMaxed = isArenaArmoryUpgradeMaxed(key, gameState.weapon, gameState.activeBuild);
    return {
      key,
      definition,
      isMaxed,
    };
  });
  const codexEnemyEntries = ARENA_ENEMY_ORDER.map(
    (kind) => arenaMeta.codexEnemies[kind],
  );
  const globalUnlockEntries = getArenaGlobalUnlockIds().map(
    (unlockId) => arenaMeta.unlocks[unlockId],
  );
  const nextGlobalRewardEntry =
    globalUnlockEntries.find((entry) => !entry.unlocked) ?? null;
  const nextRewardPreviewLabel = nextGlobalRewardEntry
    ? `${nextGlobalRewardEntry.rewardLabel} • ${nextGlobalRewardEntry.description}`
    : "All current global rewards unlocked.";
  const masteryCards = ARENA_BUILD_ORDER.map((buildId) => {
    const buildMeta = ARENA_BUILD_META[buildId];
    const accentDefinition = getArenaCosmeticDefinition(
      getArenaEquippedBuildCosmeticId(arenaMeta, buildId, "buildAccent"),
    );
    const crestDefinition = getArenaCosmeticDefinition(
      getArenaEquippedBuildCosmeticId(arenaMeta, buildId, "buildCrest"),
    );
    const mastery = arenaMeta.mastery[buildId];
    const progress = getArenaMasteryProgress(mastery.xp);
    const unlockEntries = getArenaBuildUnlockIds(buildId).map(
      (unlockId) => arenaMeta.unlocks[unlockId],
    );
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
  const collectionBannerIds = [
    ...getArenaGlobalCollectionCosmeticIds("banner"),
  ].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return (
      getCollectionStatePriority(leftState) -
      getCollectionStatePriority(rightState)
    );
  });
  const collectionFrameIds = [
    ...getArenaGlobalCollectionCosmeticIds("codexFrame"),
  ].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return (
      getCollectionStatePriority(leftState) -
      getCollectionStatePriority(rightState)
    );
  });
  const collectionAccentIds = [
    ...getArenaBuildCollectionCosmeticIds(collectionBuildId, "buildAccent"),
  ].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return (
      getCollectionStatePriority(leftState) -
      getCollectionStatePriority(rightState)
    );
  });
  const collectionCrestIds = [
    ...getArenaBuildCollectionCosmeticIds(collectionBuildId, "buildCrest"),
  ].sort((leftId, rightId) => {
    const leftState = getArenaCosmeticDisplayState(arenaMeta, leftId);
    const rightState = getArenaCosmeticDisplayState(arenaMeta, rightId);
    return (
      getCollectionStatePriority(leftState) -
      getCollectionStatePriority(rightState)
    );
  });
  const activeRunEndSummary = pendingRestartSummary ?? runEndSummary;
  const runEndRewardText =
    activeRunEndSummary && activeRunEndSummary.newlyClaimableIds.length > 0
      ? activeRunEndSummary.newlyClaimableIds
          .map((cosmeticId) => getArenaCosmeticDefinition(cosmeticId).label)
          .join(" • ")
      : null;

  const canControlShip =
    boardSize.width > 0 &&
    boardSize.height > 0 &&
    !isMenuOpen &&
    !isArmoryOpen &&
    hasStarted &&
    !isPaused &&
    gameState.status === "running";
  const moveHintTop =
    boardSize.height > 0
      ? Math.max(
          0,
          boardSize.height - MOVE_HINT_DIAMETER - MOVE_HINT_BOTTOM_OFFSET,
        )
      : 0;
  const shouldShowMoveHint = canControlShip && !isMoveHintPressed;
  const panGesture = useMemo(() => {
    const handleMoveHintTouchBegin = (touchX: number, touchY: number) => {
      if (boardSize.width <= 0 || boardSize.height <= 0) {
        setIsMoveHintPressed(false);
        return;
      }
      const hintCenterX = gameState.playerX;
      const hintCenterY = moveHintTop + MOVE_HINT_DIAMETER / 2;
      const dx = touchX - hintCenterX;
      const dy = touchY - hintCenterY;
      setIsMoveHintPressed(
        dx * dx + dy * dy <= Math.pow(MOVE_HINT_DIAMETER * 0.5 + 6, 2),
      );
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
          boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN,
        );
        runOnJS(handleMoveHintTouchBegin)(event.x, event.y);
      })
      .onUpdate((event) => {
        playerVisualX.value = clampWorklet(
          event.x,
          ARENA_PLAYER_HALF_WIDTH + ARENA_PLAYER_MARGIN,
          boardSize.width - ARENA_PLAYER_HALF_WIDTH - ARENA_PLAYER_MARGIN,
        );
      })
      .onFinalize(() => {
        runOnJS(handleMoveHintTouchEnd)();
      });
  }, [
    boardSize.height,
    boardSize.width,
    canControlShip,
    gameState.playerX,
    moveHintTop,
    playerVisualX,
  ]);

  useEffect(() => {
    if (!eligibleCoachHintId || activeCoachHintId !== null) {
      return;
    }

    setActiveCoachHintId(eligibleCoachHintId);
    setArenaMeta((previousMetaState) => {
      const nextMetaState = markArenaCoachHintSeen(
        previousMetaState,
        eligibleCoachHintId,
      );
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  }, [activeCoachHintId, eligibleCoachHintId]);

  useEffect(() => {
    if (!activeCoachHintId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setActiveCoachHintId((previousHintId) =>
        previousHintId === activeCoachHintId ? null : previousHintId,
      );
    }, 5200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [activeCoachHintId]);

  useEffect(() => {
    if (
      !hasStarted ||
      gameState.status !== "running" ||
      !isArenaBiomeTransitionTier(displayTier)
    ) {
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
    if (gameState.isDebugDemoRun) {
      return nextRunEndSummary;
    }
    const runSummary = createArenaRunMetaSummary(gameState);
    setArenaMeta((previousMetaState) => {
      const runProgressState = applyArenaRunSummary(
        previousMetaState,
        runSummary,
      );
      const nextMetaState = applyArenaCampaignRunResult(
        runProgressState,
        gameState,
      );
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
    return nextRunEndSummary;
  }, [arenaMeta, gameState, hasStarted, isMetaReady]);

  useEffect(() => {
    if (
      (gameState.status !== "lost" && gameState.status !== "won") ||
      !isMetaReady ||
      !hasStarted ||
      runMetaCommittedRef.current
    ) {
      return;
    }
    finalizeRunMetaProgress();
  }, [finalizeRunMetaProgress, gameState.status, hasStarted, isMetaReady]);

  const closeArmoryPanel = () => {
    setIsArmoryOpen(false);
    const shouldResume =
      armoryResumeOnCloseRef.current &&
      hasStarted &&
      gameState.status === "running";
    armoryResumeOnCloseRef.current = false;
    if (shouldResume) {
      setIsPaused(false);
    }
  };

  const handleOpenArmory = () => {
    if (!hasStarted || gameState.status !== "running" || isMenuOpen) {
      return;
    }
    armoryResumeOnCloseRef.current = !isPaused;
    setIsPaused(true);
    setIsMenuOpen(false);
    setIsArmoryOpen(true);
    setArmoryTab("upgrade");
  };

  const getDeploymentBoardWidth = () =>
    Math.max(320, boardSize.width > 0 ? boardSize.width : Math.round(windowWidth - 28));

  const createRunState = (
    runMode: ArenaRunMode,
    missionId: ArenaCampaignMissionId | null = null,
  ) => {
    const boardWidth = getDeploymentBoardWidth();
    if (runMode === "campaign" && missionId) {
      const mission = ARENA_CAMPAIGN_MISSIONS[missionId];
      const weaponId =
        arenaMeta.campaign.loadout.weaponSlots[arenaMeta.campaign.loadout.activeWeaponSlot] ??
        arenaMeta.campaign.loadout.weaponSlots[0];
      const baseCampaignState = createInitialArenaState(boardWidth, {
        runMode: "campaign",
        campaignMissionId: mission.id,
        campaignTargetTier: mission.targetTier,
        campaignShieldId: arenaMeta.campaign.loadout.shieldId,
        activeBuild: ARENA_CAMPAIGN_WEAPONS[weaponId].buildId,
      });
      const upgradedWeapon = applyArenaCampaignWeaponUpgrades(
        weaponId,
        baseCampaignState.weapon,
        arenaMeta.campaign.weaponUpgrades[weaponId],
      );
      const shipStatBonuses = getArenaCampaignShipStatBonuses(
        arenaMeta.campaign.shipStatUpgrades,
      );
      return {
        ...baseCampaignState,
        weapon: upgradedWeapon,
        weaponsByBuild: {
          ...baseCampaignState.weaponsByBuild,
          [ARENA_CAMPAIGN_WEAPONS[weaponId].buildId]: upgradedWeapon,
        },
        maxHull: baseCampaignState.maxHull + shipStatBonuses.health,
        hull: baseCampaignState.hull + shipStatBonuses.health,
        maxShield: baseCampaignState.maxShield + shipStatBonuses.shield,
        shield: baseCampaignState.shield + shipStatBonuses.shield,
      };
    }

    return createInitialArenaState(boardWidth, {
      runMode: "endless",
      activeBuild: gameState.activeBuild,
    });
  };

  const createEndlessTier40DemoState = () => {
    const boardWidth = getDeploymentBoardWidth();
    const baseState = createInitialArenaState(boardWidth, {
      runMode: "endless",
      activeBuild: gameState.activeBuild,
      isDebugDemoRun: true,
    });
    const demoWeapons = { ...baseState.weaponsByBuild };

    for (const buildId of ARENA_BUILD_ORDER) {
      let nextWeapon = { ...baseState.weaponsByBuild[buildId] };
      for (const key of ENDLESS_T40_DEMO_CAPPED_UPGRADES) {
        while (!isArenaArmoryUpgradeMaxed(key, nextWeapon, buildId)) {
          nextWeapon = ARENA_ARMORY_UPGRADES[key].apply(nextWeapon);
        }
      }
      for (
        let upgradeIndex = 0;
        upgradeIndex < ENDLESS_T40_DEMO_DAMAGE_UPGRADES;
        upgradeIndex += 1
      ) {
        nextWeapon = ARENA_ARMORY_UPGRADES.damageMatrix.apply(nextWeapon);
      }
      demoWeapons[buildId] = nextWeapon;
    }

    const hullBonus =
      (ARENA_ARMORY_UPGRADES.hullWeave.applyMeta?.hullBonus ?? 0) *
      ENDLESS_T40_DEMO_HULL_UPGRADES;
    const shieldBonus =
      (ARENA_ARMORY_UPGRADES.shieldCapacitor.applyMeta?.shieldBonus ?? 0) *
      ENDLESS_T40_DEMO_SHIELD_UPGRADES;

    return {
      ...baseState,
      elapsed: (ENDLESS_T40_DEMO_TIER - 1) * ARENA_TIER_DURATION_SECONDS,
      nextArmoryCost: ENDLESS_T40_DEMO_NEXT_ARMORY_COST,
      weapon: demoWeapons[baseState.activeBuild],
      weaponsByBuild: demoWeapons,
      maxHull: baseState.maxHull + hullBonus,
      hull: baseState.maxHull + hullBonus,
      maxShield: baseState.maxShield + shieldBonus,
      shield: baseState.maxShield + shieldBonus,
      enemySpawnCooldown: 0.08,
      fireCooldown: 0.02,
      missileCooldown: 0.16,
      pickupMessage: ENDLESS_T40_DEMO_STATUS_TEXT,
      pickupTimer: 4.2,
      encounterAnnouncement: "T40 demo",
      encounterAnnouncementColor: "#FFD68A",
      encounterAnnouncementTimer: 1.9,
      bestTierReached: ENDLESS_T40_DEMO_TIER,
      lastProcessedDisplayTier: ENDLESS_T40_DEMO_TIER - 1,
    };
  };

  const deployRun = (
    runMode: ArenaRunMode,
    missionId: ArenaCampaignMissionId | null = null,
  ) => {
    const nextState = createRunState(runMode, missionId);
    playerVisualX.value = getDeploymentBoardWidth() / 2;
    setGameState(nextState);
    setShellMode("arena");
    setHasStarted(true);
    setIsPaused(false);
    setIsMenuOpen(false);
    setIsArmoryOpen(false);
    setMenuTab("run");
    setIsMoveHintPressed(false);
    setActiveCoachHintId(null);
    setRunEndSummary(null);
    setPendingRestartSummary(null);
    setSectorBannerTier(null);
    setLossTransitionTimer(0);
    setHubPanel("root");
    armoryResumeOnCloseRef.current = false;
    runMetaCommittedRef.current = false;
    lastBiomeBannerKeyRef.current = "";
  };

  const handleOpenHubPanel = (tab: ArenaMenuTab) => {
    setShellMode("arena");
    setHasStarted(false);
    setIsPaused(true);
    setIsArmoryOpen(false);
    setIsMenuOpen(true);
    setMenuTab(tab);
  };

  const handleReturnHomeBase = () => {
    finalizeRunMetaProgress();
    setShellMode("hub");
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
    setIsArmoryOpen(false);
    setRunEndSummary(null);
    setPendingRestartSummary(null);
    setLossTransitionTimer(0);
    setHubPanel("root");
  };

  const resetArenaRun = () => {
    const nextState = createRunState(gameState.runMode, gameState.campaignMissionId);
    playerVisualX.value = getDeploymentBoardWidth() / 2;
    setGameState(nextState);
    setHasStarted(false);
    setIsPaused(true);
    setIsMenuOpen(false);
    setIsArmoryOpen(false);
    setMenuTab("run");
    setIsMoveHintPressed(false);
    setActiveCoachHintId(null);
    setRunEndSummary(null);
    setPendingRestartSummary(null);
    setSectorBannerTier(null);
    setLossTransitionTimer(0);
    armoryResumeOnCloseRef.current = false;
    runMetaCommittedRef.current = false;
    lastBiomeBannerKeyRef.current = "";
  };

  const handleRestartAtTier40Demo = () => {
    if (gameState.runMode !== "endless") {
      return;
    }

    const nextState = createEndlessTier40DemoState();
    playerVisualX.value = getDeploymentBoardWidth() / 2;
    setGameState(nextState);
    setShellMode("arena");
    setHasStarted(true);
    setIsPaused(false);
    setIsMenuOpen(false);
    setIsArmoryOpen(false);
    setMenuTab("run");
    setIsMoveHintPressed(false);
    setActiveCoachHintId(null);
    setRunEndSummary(null);
    setPendingRestartSummary(null);
    setSectorBannerTier(null);
    setLossTransitionTimer(0);
    setHubPanel("root");
    armoryResumeOnCloseRef.current = false;
    runMetaCommittedRef.current = false;
    lastBiomeBannerKeyRef.current = "";
  };

  const handleRestart = () => {
    if (gameState.status !== "lost") {
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

  const handleSelectArmoryUpgrade = (
    key: keyof typeof ARENA_ARMORY_UPGRADES,
  ) => {
    if (!hasArmoryChoices) {
      return;
    }
    if (isArenaArmoryUpgradeMaxed(key, gameState.weapon, gameState.activeBuild)) {
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

  const handleClaimCosmetic = (cosmeticId: ArenaCosmeticId) => {
    setArenaMeta((previousMetaState) => {
      const nextMetaState = claimArenaCosmetic(previousMetaState, cosmeticId);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
    setPendingCollectionNoticeIds((previousIds) =>
      previousIds.filter((id) => id !== cosmeticId),
    );
  };
  const handleClaimReadyCosmetics = () => {
    setArenaMeta((previousMetaState) => {
      const readyCosmeticIds = getArenaClaimableCosmeticIds(previousMetaState);
      if (readyCosmeticIds.length <= 0) {
        return previousMetaState;
      }
      let nextMetaState = previousMetaState;
      readyCosmeticIds.forEach((cosmeticId) => {
        nextMetaState = claimArenaCosmetic(nextMetaState, cosmeticId);
      });
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
    setPendingCollectionNoticeIds([]);
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
  const handleEquipCampaignWeapon = (
    slotIndex: 0 | 1,
    weaponId: ArenaCampaignWeaponId,
  ) => {
    setArenaMeta((previousMetaState) => {
      const nextMetaState = setArenaCampaignWeapon(
        previousMetaState,
        slotIndex,
        weaponId,
      );
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  };
  const handleEquipCampaignShield = (shieldId: ArenaCampaignShieldId) => {
    setArenaMeta((previousMetaState) => {
      const nextMetaState = setArenaCampaignShield(previousMetaState, shieldId);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  };
  const handleUpgradeCampaignWeapon = (
    weaponId: ArenaCampaignWeaponId,
    upgradeKey: ArenaCampaignWeaponUpgradeKey,
  ) => {
    setArenaMeta((previousMetaState) => {
      const nextMetaState = upgradeArenaCampaignWeapon(
        previousMetaState,
        weaponId,
        upgradeKey,
      );
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  };
  const handleUpgradeCampaignShipStat = (
    upgradeKey: ArenaCampaignShipStatUpgradeKey,
  ) => {
    setArenaMeta((previousMetaState) => {
      const nextMetaState = upgradeArenaCampaignShipStat(
        previousMetaState,
        upgradeKey,
      );
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  };
  const handleResetCoachHints = () => {
    setActiveCoachHintId(null);
    setArenaMeta((previousMetaState) => {
      const nextMetaState = resetArenaCoachHints(previousMetaState);
      if (nextMetaState !== previousMetaState) {
        void saveArenaMetaState(nextMetaState);
      }
      return nextMetaState;
    });
  };
  const hullRatio = gameState.hull / gameState.maxHull;
  const armoryButtonDisabled =
    isCampaignRun ||
    !hasStarted ||
    gameState.status !== "running" ||
    isMenuOpen ||
    isArmoryOpen;
  const shieldAbilityButtonDisabled =
    !isCampaignRun ||
    !hasStarted ||
    isPaused ||
    isMenuOpen ||
    gameState.status !== "running" ||
    !shieldAbilityReady;
  const ultimateButtonDisabled =
    isPaused || isArmoryOpen || isMenuOpen || gameState.status !== "running";
  const handleActivateShieldAbility = () => {
    if (
      boardSize.height <= 0 ||
      !isCampaignRun ||
      !hasStarted ||
      isPaused ||
      isMenuOpen ||
      gameState.status !== "running"
    ) {
      return;
    }
    setGameState((previousState) =>
      activateArenaShieldAbility(previousState, boardSize.height),
    );
  };
  const handleActivateUltimate = () => {
    if (
      boardSize.width <= 0 ||
      boardSize.height <= 0 ||
      !hasStarted ||
      isPaused ||
      isArmoryOpen ||
      isMenuOpen ||
      gameState.status !== "running"
    ) {
      return;
    }

    setGameState((previousState) =>
      activateArenaUltimate(previousState, boardSize.width, boardSize.height),
    );
  };
  const activeMissionProgress =
    arenaMeta.campaign.missionProgress[activeMission.id];
  const hubMissionBestTier = activeMissionProgress?.bestTier ?? 1;
  const hubCampaignRank =
    arenaMeta.campaign.level >= 8
      ? "Vanguard"
      : arenaMeta.campaign.level >= 4
        ? "Striker"
        : "Cadet";
  const hubOwnedCosmeticCount = Object.values(arenaMeta.cosmetics).filter(
    (entry) => entry.state === "owned",
  ).length;
  const hubDiscoveredEnemyCount = ARENA_ENEMY_ORDER.filter(
    (kind) => arenaMeta.codexEnemies[kind].discovered,
  ).length;
  const hubBossKinds = [
    "prismBoss",
    "hiveCarrierBoss",
    "vectorLoomBoss",
    "eclipseTalonBoss",
  ] as const;
  const hubBossClearCount = hubBossKinds.filter(
    (kind) => arenaMeta.codexEnemies[kind].bossClears > 0,
  ).length;
  const hubMasteryCards = ARENA_BUILD_ORDER.map((buildId) => ({
    buildId,
    meta: ARENA_BUILD_META[buildId],
    mastery: arenaMeta.mastery[buildId],
    progress: getArenaMasteryProgress(arenaMeta.mastery[buildId].xp),
  }));
  const hubPanelTitle =
    hubPanel === "mission"
      ? "Mission Launch"
      : hubPanel === "collection"
        ? "Collection"
        : hubPanel === "codex"
          ? "Codex"
          : hubPanel === "mastery"
            ? "Mastery"
            : hubPanel === "weapon"
              ? "Weapon Equip"
              : hubPanel === "shield"
                ? "Shield Equip"
                : hubPanel === "extras"
                  ? "Extras"
                  : "Home Base";

  if (shellMode === "hub") {
    return (
      <SafeAreaView
        style={[
          arenaStyles.container,
          isPortraitViewport && arenaStyles.containerPortrait,
        ]}
      >
        <View style={arenaStyles.hubFixedScreen}>
          <View style={arenaStyles.hubFixedTopBar}>
            <View
              style={[
                arenaStyles.hubCompactLevelBadge,
                {
                  borderColor: activeBannerDefinition.secondaryColor,
                  shadowColor: activeBannerDefinition.glowColor,
                },
              ]}
            >
              <Text style={arenaStyles.hubLevelLabel}>LV</Text>
              <Text style={arenaStyles.hubCompactLevelValue}>
                {campaignLevelProgress.level}
              </Text>
            </View>
            <View style={arenaStyles.hubFixedTitleBlock}>
              <Text style={arenaStyles.hubEyebrow}>Home Base</Text>
              <Text style={arenaStyles.hubFixedTitle}>
                {hubPanel === "root" ? "Orbital Command" : hubPanelTitle}
              </Text>
              <Text style={arenaStyles.hubRankText}>
                Rank: {hubCampaignRank}
              </Text>
            </View>
            {hubPanel === "root" ? (
              <Pressable
                onPress={() => setHubPanel("extras")}
                style={arenaStyles.hubTopUtilityButton}
              >
                <Text style={arenaStyles.hubTopUtilityText}>Extras</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setHubPanel("root")}
                style={arenaStyles.hubTopUtilityButton}
              >
                <Text style={arenaStyles.hubTopUtilityText}>Back</Text>
              </Pressable>
            )}
            <View style={arenaStyles.hubProgressTrack}>
              <View
                style={[
                  arenaStyles.hubProgressFill,
                  {
                    width: `${campaignLevelProgress.progress * 100}%`,
                    backgroundColor: activeBannerDefinition.detailColor,
                  },
                ]}
              />
            </View>
          </View>

          {hubPanel === "root" ? (
            <View style={arenaStyles.hubFixedDeck}>
              <View style={arenaStyles.hubHorizonWindowCompact}>
                <View style={arenaStyles.hubStar} />
                <View style={[arenaStyles.hubStar, arenaStyles.hubStarTwo]} />
                <View style={[arenaStyles.hubStar, arenaStyles.hubStarThree]} />
              </View>
              <Pressable
                onPress={() => setHubPanel("mission")}
                style={arenaStyles.hubRootMissionConsole}
              >
                <View
                  style={[
                    arenaStyles.hubCompactGlobe,
                    {
                      borderColor: activeFrameDefinition.secondaryColor,
                      shadowColor: activeFrameDefinition.glowColor,
                    },
                  ]}
                >
                  <View style={arenaStyles.hubGlobeCore} />
                  <View style={arenaStyles.hubGlobeMeridian} />
                  <View style={arenaStyles.hubGlobeLatitude} />
                  <View
                    style={[
                      arenaStyles.hubGlobeLatitude,
                      arenaStyles.hubGlobeLatitudeLow,
                    ]}
                  />
                </View>
                <View style={arenaStyles.hubRootMissionText}>
                  <Text style={arenaStyles.hubMapKicker}>Mission Launch</Text>
                  <Text style={arenaStyles.hubMapTitle}>
                    {activeMission.label}
                  </Text>
                  <Text style={arenaStyles.hubMapCopy}>
                    T1-T{activeMission.targetTier} / Best T{hubMissionBestTier}
                  </Text>
                </View>
              </Pressable>

              <View style={arenaStyles.hubRootShipBay}>
                <View style={arenaStyles.hubCompactShipPad}>
                  <View style={arenaStyles.hubShipShadow} />
                  <View
                    style={[
                      arenaStyles.hubShipWingLeftCompact,
                      { borderBottomColor: activeAccentDefinition.primaryColor },
                    ]}
                  />
                  <View
                    style={[
                      arenaStyles.hubShipWingRightCompact,
                      { borderBottomColor: activeAccentDefinition.primaryColor },
                    ]}
                  />
                  <View style={arenaStyles.hubShipBodyCompact} />
                  <View
                    style={[
                      arenaStyles.hubShipCanopyCompact,
                      { backgroundColor: activeAccentDefinition.detailColor },
                    ]}
                  />
                  <View style={arenaStyles.hubShipNoseCompact} />
                  <View style={arenaStyles.hubShipEngineLeftCompact} />
                  <View style={arenaStyles.hubShipEngineRightCompact} />
                </View>
                <View style={arenaStyles.hubRootRigReadout}>
                  <Text style={arenaStyles.hubShipReadoutLabel}>
                    Active Rig
                  </Text>
                  <Text style={arenaStyles.hubShipReadoutValue}>
                    {activeCampaignWeapon.shortLabel} /{" "}
                    {activeCampaignShield.shortLabel}
                  </Text>
                </View>
              </View>

              <View style={arenaStyles.hubRootStationGrid}>
                <Pressable
                  onPress={() => setHubPanel("weapon")}
                  style={[
                    arenaStyles.hubRootStationTile,
                    arenaStyles.hubStationTileBlue,
                  ]}
                >
                  <Text style={arenaStyles.hubStationIcon}>WPN</Text>
                  <Text style={arenaStyles.hubStationTitle}>Weapon</Text>
                  <Text style={arenaStyles.hubStationSubtitle}>
                    {arenaMeta.campaign.weaponUpgradePoints > 0
                      ? `${arenaMeta.campaign.weaponUpgradePoints} upgrade${arenaMeta.campaign.weaponUpgradePoints === 1 ? "" : "s"}`
                      : activeCampaignWeapon.shortLabel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setHubPanel("shield")}
                  style={[
                    arenaStyles.hubRootStationTile,
                    arenaStyles.hubStationTileGreen,
                  ]}
                >
                  <Text style={arenaStyles.hubStationIcon}>SHD</Text>
                  <Text style={arenaStyles.hubStationTitle}>Shield</Text>
                  <Text style={arenaStyles.hubStationSubtitle}>
                    {activeCampaignShield.shortLabel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setHubPanel("collection")}
                  style={[
                    arenaStyles.hubRootStationTile,
                    arenaStyles.hubStationTileGold,
                  ]}
                >
                  <Text style={arenaStyles.hubStationIcon}>BOX</Text>
                  <Text style={arenaStyles.hubStationTitle}>Collection</Text>
                  <Text style={arenaStyles.hubStationSubtitle}>
                    {claimableCosmeticIds.length} ready
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setHubPanel("codex")}
                  style={[
                    arenaStyles.hubRootStationTile,
                    arenaStyles.hubStationTileCyan,
                  ]}
                >
                  <Text style={arenaStyles.hubStationIcon}>LOG</Text>
                  <Text style={arenaStyles.hubStationTitle}>Codex</Text>
                  <Text style={arenaStyles.hubStationSubtitle}>
                    {hubDiscoveredEnemyCount}/{ARENA_ENEMY_ORDER.length}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setHubPanel("mastery")}
                  style={[
                    arenaStyles.hubRootStationTile,
                    arenaStyles.hubStationTilePurple,
                    arenaStyles.hubRootStationTileWide,
                  ]}
                >
                  <Text style={arenaStyles.hubStationIcon}>RANK</Text>
                  <Text style={arenaStyles.hubStationTitle}>Mastery</Text>
                  <Text style={arenaStyles.hubStationSubtitle}>
                    Build levels and rewards
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => deployRun("campaign", activeMission.id)}
                style={[
                  arenaStyles.hubCompactLaunchButton,
                  {
                    borderColor: activeBannerDefinition.secondaryColor,
                    shadowColor: activeBannerDefinition.glowColor,
                  },
                ]}
              >
                <Text style={arenaStyles.hubLaunchTitle}>Launch</Text>
                <Text style={arenaStyles.hubLaunchSubtitle}>Start Mission</Text>
              </Pressable>
            </View>
          ) : (
            <View style={arenaStyles.hubDetailDeck}>
              {hubPanel === "mission" ? (
                <View style={arenaStyles.hubDetailContent}>
                  <View style={arenaStyles.hubDetailHero}>
                    <Text style={arenaStyles.hubMapKicker}>
                      {activeMission.zoneLabel}
                    </Text>
                    <Text style={arenaStyles.hubDetailTitle}>
                      {activeMission.label}
                    </Text>
                    <Text style={arenaStyles.hubDetailCopy}>
                      {activeMission.summary} Final boss:{" "}
                      {activeMission.bossLabel}.
                    </Text>
                  </View>
                  <View style={arenaStyles.hubDetailStatGrid}>
                    <View style={arenaStyles.hubDetailStatCard}>
                      <Text style={arenaStyles.hubMapStatLabel}>Target</Text>
                      <Text style={arenaStyles.hubMapStatValue}>
                        T{activeMission.targetTier}
                      </Text>
                    </View>
                    <View style={arenaStyles.hubDetailStatCard}>
                      <Text style={arenaStyles.hubMapStatLabel}>Best</Text>
                      <Text style={arenaStyles.hubMapStatValue}>
                        T{hubMissionBestTier}
                      </Text>
                    </View>
                    <View style={arenaStyles.hubDetailStatCard}>
                      <Text style={arenaStyles.hubMapStatLabel}>Reward</Text>
                      <Text style={arenaStyles.hubMapStatValue}>
                        {activeMission.rewardXp} XP
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => deployRun("campaign", activeMission.id)}
                    style={arenaStyles.hubDetailPrimaryAction}
                  >
                    <Text style={arenaStyles.hubDetailPrimaryActionText}>
                      Launch Mission
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {hubPanel === "collection" ? (
                <View style={arenaStyles.hubDetailContent}>
                  <View style={arenaStyles.hubDetailHero}>
                    <Text style={arenaStyles.hubMapKicker}>
                      Rewards / Cosmetics
                    </Text>
                    <Text style={arenaStyles.hubDetailTitle}>
                      {claimableCosmeticIds.length} Claimable
                    </Text>
                    <Text style={arenaStyles.hubDetailCopy}>
                      {hubOwnedCosmeticCount} owned. Equipped banner:{" "}
                      {activeBannerDefinition.label}. Equipped frame:{" "}
                      {activeFrameDefinition.label}.
                    </Text>
                  </View>
                  <View style={arenaStyles.hubPreviewList}>
                    {claimableCosmeticIds.slice(0, 3).map((cosmeticId) => (
                      <View key={cosmeticId} style={arenaStyles.hubPreviewRow}>
                        <Text style={arenaStyles.hubPreviewTitle}>
                          {getArenaCosmeticDefinition(cosmeticId).label}
                        </Text>
                        <Text style={arenaStyles.hubPreviewMeta}>
                          Ready to claim
                        </Text>
                      </View>
                    ))}
                    {claimableCosmeticIds.length <= 0 ? (
                      <View style={arenaStyles.hubPreviewRow}>
                        <Text style={arenaStyles.hubPreviewTitle}>
                          No rewards waiting
                        </Text>
                        <Text style={arenaStyles.hubPreviewMeta}>
                          Keep clearing missions and bosses
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={arenaStyles.hubDetailActionRow}>
                    <Pressable
                      disabled={claimableCosmeticIds.length <= 0}
                      onPress={handleClaimReadyCosmetics}
                      style={[
                        arenaStyles.hubDetailPrimaryAction,
                        claimableCosmeticIds.length <= 0 &&
                          arenaStyles.hubDetailActionDisabled,
                      ]}
                    >
                      <Text style={arenaStyles.hubDetailPrimaryActionText}>
                        Claim Ready
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleOpenHubPanel("collection")}
                      style={arenaStyles.hubDetailSecondaryAction}
                    >
                      <Text style={arenaStyles.hubDetailSecondaryActionText}>
                        Equip Window
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {hubPanel === "codex" ? (
                <View style={arenaStyles.hubDetailContent}>
                  <View style={arenaStyles.hubDetailHero}>
                    <Text style={arenaStyles.hubMapKicker}>
                      Enemy Archives
                    </Text>
                    <Text style={arenaStyles.hubDetailTitle}>
                      {hubDiscoveredEnemyCount}/{ARENA_ENEMY_ORDER.length}{" "}
                      Discovered
                    </Text>
                    <Text style={arenaStyles.hubDetailCopy}>
                      Boss files cleared: {hubBossClearCount}/
                      {hubBossKinds.length}. Full enemy discovery feeds Codex
                      frame rewards.
                    </Text>
                  </View>
                  <View style={arenaStyles.hubBossRow}>
                    {hubBossKinds.map((kind) => (
                      <View key={kind} style={arenaStyles.hubBossChip}>
                        <Text style={arenaStyles.hubPreviewTitle}>
                          {ARENA_ENEMY_LABELS[kind]}
                        </Text>
                        <Text style={arenaStyles.hubPreviewMeta}>
                          Clears {arenaMeta.codexEnemies[kind].bossClears}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => handleOpenHubPanel("codex")}
                    style={arenaStyles.hubDetailPrimaryAction}
                  >
                    <Text style={arenaStyles.hubDetailPrimaryActionText}>
                      Open Codex Window
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {hubPanel === "mastery" ? (
                <View style={arenaStyles.hubDetailContent}>
                  <View style={arenaStyles.hubMasteryGrid}>
                    {hubMasteryCards.map(({ buildId, meta, mastery, progress }) => (
                      <View key={buildId} style={arenaStyles.hubMasteryCard}>
                        <Text
                          style={[
                            arenaStyles.hubPreviewTitle,
                            { color: meta.accent },
                          ]}
                        >
                          {meta.shortLabel}
                        </Text>
                        <Text style={arenaStyles.hubPreviewMeta}>
                          Lv {progress.level} / {progress.title}
                        </Text>
                        <View style={arenaStyles.hubSmallProgressTrack}>
                          <View
                            style={[
                              arenaStyles.hubSmallProgressFill,
                              {
                                width: `${progress.progress * 100}%`,
                                backgroundColor: meta.accent,
                              },
                            ]}
                          />
                        </View>
                        <Text style={arenaStyles.hubPreviewMeta}>
                          Best T{mastery.bestTier} / Boss {mastery.bossClears}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => handleOpenHubPanel("mastery")}
                    style={arenaStyles.hubDetailPrimaryAction}
                  >
                    <Text style={arenaStyles.hubDetailPrimaryActionText}>
                      Open Mastery Window
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {hubPanel === "weapon" ? (
                <View style={arenaStyles.hubDetailContent}>
                  <View style={arenaStyles.hubWeaponUpgradeHeader}>
                    <View>
                      <Text style={arenaStyles.hubMapKicker}>
                        Upgrade Points
                      </Text>
                      <Text style={arenaStyles.hubDetailTitle}>
                        {arenaMeta.campaign.weaponUpgradePoints} Available
                      </Text>
                    </View>
                    <Text style={arenaStyles.hubConsoleStatus}>
                      {hubSpentWeaponUpgradeCount + hubSpentShipStatUpgradeCount} installed
                    </Text>
                  </View>

                  <View style={arenaStyles.hubWeaponTargetRow}>
                    {Object.values(ARENA_CAMPAIGN_WEAPONS).map((weapon) => {
                      const locked = weapon.unlockLevel > arenaMeta.campaign.level;
                      const selected = hubWeaponUpgradeTargetIdSafe === weapon.id;
                      return (
                        <Pressable
                          key={`upgrade-target-${weapon.id}`}
                          disabled={locked}
                          onPress={() => setHubWeaponUpgradeTargetId(weapon.id)}
                          style={[
                            arenaStyles.hubChoicePill,
                            selected && arenaStyles.hubChoicePillActive,
                            locked && arenaStyles.hubChoicePillLocked,
                          ]}
                        >
                          <Text style={arenaStyles.hubChoiceText}>
                            {locked ? `Lv ${weapon.unlockLevel}` : weapon.shortLabel}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={arenaStyles.hubWeaponEquipGrid}>
                    {([0, 1] as const).map((slotIndex) => {
                      const isUnlocked = slotIndex < campaignWeaponSlotCount;
                      const equippedWeaponId =
                        arenaMeta.campaign.loadout.weaponSlots[slotIndex];
                      return (
                        <View
                          key={`weapon-detail-${slotIndex}`}
                          style={arenaStyles.hubEquipSlotCard}
                        >
                          <Text style={arenaStyles.hubLoadoutKicker}>
                            Slot {slotIndex + 1}
                          </Text>
                          <Text style={arenaStyles.hubLoadoutTitle}>
                            {isUnlocked && equippedWeaponId
                              ? ARENA_CAMPAIGN_WEAPONS[equippedWeaponId].shortLabel
                              : "Locked"}
                          </Text>
                          <Text style={arenaStyles.hubLoadoutCopy}>
                            {isUnlocked
                              ? "Tap a chip to equip."
                              : "Unlocks at campaign level 4."}
                          </Text>
                          {isUnlocked ? (
                            <View style={arenaStyles.hubChoiceRow}>
                              {Object.values(ARENA_CAMPAIGN_WEAPONS).map(
                                (weapon) => {
                                  const locked =
                                    weapon.unlockLevel >
                                    arenaMeta.campaign.level;
                                  const selected = equippedWeaponId === weapon.id;
                                  return (
                                    <Pressable
                                      key={`${slotIndex}-${weapon.id}`}
                                      disabled={locked}
                                      onPress={() => {
                                        handleEquipCampaignWeapon(
                                          slotIndex,
                                          weapon.id,
                                        );
                                        setHubWeaponUpgradeTargetId(weapon.id);
                                      }}
                                      style={[
                                        arenaStyles.hubChoicePill,
                                        selected &&
                                          arenaStyles.hubChoicePillActive,
                                        locked &&
                                          arenaStyles.hubChoicePillLocked,
                                      ]}
                                    >
                                      <Text style={arenaStyles.hubChoiceText}>
                                        {locked
                                          ? `Lv ${weapon.unlockLevel}`
                                          : weapon.shortLabel}
                                      </Text>
                                    </Pressable>
                                  );
                                },
                              )}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>

                  <View style={arenaStyles.hubWeaponUpgradeGrid}>
                    {ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER.map((upgradeKey) => {
                      const definition =
                        ARENA_CAMPAIGN_WEAPON_UPGRADES[upgradeKey];
                      const currentLevel = hubWeaponUpgradeTrack[upgradeKey];
                      const maxLevel = getArenaCampaignWeaponUpgradeMaxLevel(
                        hubWeaponUpgradeTargetIdSafe,
                        upgradeKey,
                      );
                      const maxed = maxLevel !== null && currentLevel >= maxLevel;
                      const disabled =
                        arenaMeta.campaign.weaponUpgradePoints <= 0 || maxed;
                      const levelLabel =
                        maxLevel === null
                          ? `Lv ${currentLevel}`
                          : `Lv ${currentLevel}/${maxLevel}`;
                      return (
                        <Pressable
                          key={`weapon-upgrade-${upgradeKey}`}
                          disabled={disabled}
                          onPress={() =>
                            handleUpgradeCampaignWeapon(
                              hubWeaponUpgradeTargetIdSafe,
                              upgradeKey,
                            )
                          }
                          style={[
                            arenaStyles.hubWeaponUpgradeCard,
                            disabled && arenaStyles.hubDetailActionDisabled,
                          ]}
                        >
                          <View style={arenaStyles.hubUpgradeCardHeader}>
                            <Text style={arenaStyles.hubPreviewTitle}>
                              {definition.shortLabel}
                            </Text>
                            <Text style={arenaStyles.hubPreviewMeta}>
                              {levelLabel}
                            </Text>
                          </View>
                          <Text style={arenaStyles.hubPreviewMeta}>
                            {definition.statLine}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={arenaStyles.hubUpgradeSeparator}>
                    <View style={arenaStyles.hubUpgradeSeparatorLine} />
                    <Text style={arenaStyles.hubUpgradeSeparatorText}>
                      Ship Stats
                    </Text>
                    <View style={arenaStyles.hubUpgradeSeparatorLine} />
                  </View>

                  <View style={arenaStyles.hubWeaponUpgradeGrid}>
                    {ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER.map((upgradeKey) => {
                      const definition =
                        ARENA_CAMPAIGN_SHIP_STAT_UPGRADES[upgradeKey];
                      const currentLevel =
                        arenaMeta.campaign.shipStatUpgrades[upgradeKey];
                      const disabled =
                        arenaMeta.campaign.weaponUpgradePoints <= 0;
                      const bonus =
                        upgradeKey === "health"
                          ? hubCampaignShipStatBonuses.health
                          : hubCampaignShipStatBonuses.shield;
                      return (
                        <Pressable
                          key={`ship-stat-upgrade-${upgradeKey}`}
                          disabled={disabled}
                          onPress={() =>
                            handleUpgradeCampaignShipStat(upgradeKey)
                          }
                          style={[
                            arenaStyles.hubShipStatUpgradeCard,
                            disabled && arenaStyles.hubDetailActionDisabled,
                          ]}
                        >
                          <View style={arenaStyles.hubUpgradeCardHeader}>
                            <Text style={arenaStyles.hubPreviewTitle}>
                              {definition.shortLabel}
                            </Text>
                            <Text style={arenaStyles.hubPreviewMeta}>
                              Lv {currentLevel}
                            </Text>
                          </View>
                          <Text style={arenaStyles.hubPreviewMeta}>
                            {definition.statLine} • +{bonus} active
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={arenaStyles.hubWeaponUpgradeFootnote}>
                    Target: {hubWeaponUpgradeTarget.label}. Weapon and ship stat
                    installs are permanent campaign-only upgrades.
                  </Text>
                </View>
              ) : null}

              {hubPanel === "shield" ? (
                <View style={arenaStyles.hubDetailContent}>
                  <View style={arenaStyles.hubShieldGrid}>
                    {Object.values(ARENA_CAMPAIGN_SHIELDS).map((shield) => {
                      const locked = shield.unlockLevel > arenaMeta.campaign.level;
                      const selected =
                        arenaMeta.campaign.loadout.shieldId === shield.id;
                      return (
                        <Pressable
                          key={shield.id}
                          disabled={locked}
                          onPress={() => handleEquipCampaignShield(shield.id)}
                          style={[
                            arenaStyles.hubShieldCard,
                            selected && arenaStyles.hubChoicePillActive,
                            locked && arenaStyles.hubChoicePillLocked,
                          ]}
                        >
                          <Text style={arenaStyles.hubLoadoutKicker}>
                            {locked ? `Unlock Lv ${shield.unlockLevel}` : "Ready"}
                          </Text>
                          <Text style={arenaStyles.hubLoadoutTitle}>
                            {shield.label}
                          </Text>
                          <Text style={arenaStyles.hubLoadoutCopy}>
                            {shield.summary}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {hubPanel === "extras" ? (
                <View style={arenaStyles.hubDetailContent}>
                  <View style={arenaStyles.hubDetailHero}>
                    <Text style={arenaStyles.hubMapKicker}>Optional Access</Text>
                    <Text style={arenaStyles.hubDetailTitle}>Extras</Text>
                    <Text style={arenaStyles.hubDetailCopy}>
                      Secondary actions live here so the Home Base floor stays
                      focused on campaign launch, Collection, Codex, Mastery,
                      weapons, and shields.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => deployRun("endless")}
                    style={arenaStyles.hubDetailPrimaryAction}
                  >
                    <Text style={arenaStyles.hubDetailPrimaryActionText}>
                      Endless Simulation
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSwitchGame("defender")}
                    style={arenaStyles.hubDetailSecondaryAction}
                  >
                    <Text style={arenaStyles.hubDetailSecondaryActionText}>
                      Switch Game
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        arenaStyles.container,
        isPortraitViewport && arenaStyles.containerPortrait,
      ]}
    >
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
            if (gameState.status === "lost") {
              handleRestart();
              return;
            }
            if (gameState.status === "won") {
              handleReturnHomeBase();
              return;
            }
            setIsPaused((previousValue) => !previousValue);
          }}
          style={[
            arenaStyles.primaryButton,
            !hasStarted && arenaStyles.primaryButtonStart,
            hasStarted &&
              isPaused &&
              gameState.status === "running" &&
              arenaStyles.primaryButtonActive,
          ]}
        >
          <Text style={arenaStyles.primaryButtonText}>
            {!hasStarted
              ? "Start"
              : gameState.status === "won"
                ? "Home"
                : gameState.status === "lost"
                ? "Restart"
                : isPaused
                  ? "Resume"
                  : "Pause"}
          </Text>
        </Pressable>

        <View
          style={[
            arenaStyles.statusPill,
            {
              borderColor: hexToRgba(
                activeAccentDefinition.secondaryColor,
                0.48,
              ),
              backgroundColor: hexToRgba(
                activeAccentDefinition.primaryColor,
                0.08,
              ),
            },
          ]}
        >
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
          style={[
            arenaStyles.quickButton,
            isMenuOpen && arenaStyles.quickButtonActive,
          ]}
        >
          <Text style={arenaStyles.quickButtonText}>Menu</Text>
        </Pressable>
      </View>

      <View
        style={[
          arenaStyles.overviewStrip,
          {
            borderColor: hexToRgba(activeAccentDefinition.secondaryColor, 0.48),
            backgroundColor: hexToRgba(
              activeAccentDefinition.primaryColor,
              0.06,
            ),
          },
        ]}
      >
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
          <Text
            style={[
              arenaStyles.overviewValue,
              { color: activeAccentDefinition.primaryColor },
            ]}
          >
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
          <Text style={arenaStyles.overviewValue}>
            {Math.round(activeWeapon.bulletSpeed)}
          </Text>
        </View>
      </View>

      <View
        style={[
          arenaStyles.resourceStrip,
          {
            borderColor: hexToRgba(activeAccentDefinition.secondaryColor, 0.42),
            backgroundColor: hexToRgba(
              activeAccentDefinition.primaryColor,
              0.05,
            ),
          },
        ]}
      >
        <View style={arenaStyles.resourceItem}>
          <View style={arenaStyles.resourceHeader}>
            <Text style={arenaStyles.resourceSymbol}>+</Text>
            <Text
              style={[
                arenaStyles.resourceValue,
                hullRatio <= 0.35 && arenaStyles.resourceValueDanger,
              ]}
            >
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
            <Text
              style={[
                arenaStyles.resourceValue,
                arenaStyles.resourceValueShield,
              ]}
            >
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
            <Text style={arenaStyles.resourceSymbol}>
              {isCampaignRun ? "◆" : "◈"}
            </Text>
            <Text style={arenaStyles.resourceValue}>
              {isCampaignRun
                ? `T${displayTier} / T${gameState.campaignTargetTier ?? activeMission.targetTier}`
                : `${gameState.salvage} / ${gameState.nextArmoryCost}`}
            </Text>
          </View>
          <View style={arenaStyles.hudMeter}>
            <View
              style={[
                arenaStyles.hudMeterFill,
                arenaStyles.hudMeterFillSalvage,
                {
                  backgroundColor: hexToRgba(
                    activeAccentDefinition.secondaryColor,
                    0.4,
                  ),
                },
                {
                  width: `${
                    (isCampaignRun
                      ? clamp(displayTier / Math.max(1, gameState.campaignTargetTier ?? activeMission.targetTier), 0, 1)
                      : salvageProgress) * 100
                  }%`,
                },
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
              transform: [
                { translateX: boardShakeX },
                { translateY: boardShakeY },
              ],
            },
          ]}
        >
          <ArenaCanvasErrorBoundary>
            <ArenaCanvas
              boardWidth={boardSize.width}
              boardHeight={boardSize.height}
              biomeDefinition={activeBiomeDefinition}
              state={gameState}
              vfxQuality={vfxQuality}
            />
          </ArenaCanvasErrorBoundary>

          <GestureDetector gesture={panGesture}>
            <View style={arenaStyles.gestureLayer} />
          </GestureDetector>

          <Animated.View
            pointerEvents="none"
            style={[
              arenaStyles.playerShell,
              {
                top: Math.max(
                  0,
                  boardSize.height -
                    ARENA_PLAYER_HEIGHT -
                    ARENA_PLAYER_FLOOR_OFFSET -
                    6,
                ),
                shadowColor: activeAccentDefinition.glowColor,
                shadowOpacity: 0.28,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              },
              playerShellAnimatedStyle,
              gameState.playerFlash > 0 && arenaStyles.playerShellHit,
            ]}
          >
            <View
              style={[
                arenaStyles.playerWingPlateLeft,
                {
                  backgroundColor: playerHullBaseColor,
                  borderColor: playerHullEdgeColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerWingPlateRight,
                {
                  backgroundColor: playerHullBaseColor,
                  borderColor: playerHullEdgeColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerWingBaseLeft,
                {
                  borderRightColor: playerWingAccentColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerWingBaseRight,
                {
                  borderLeftColor: playerWingAccentColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerWingTipLeft,
                {
                  backgroundColor: hexToRgba(playerEngineGlowColor, 0.72),
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerWingTipRight,
                {
                  backgroundColor: hexToRgba(playerEngineGlowColor, 0.72),
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerRearFinLeft,
                {
                  backgroundColor: playerWingAccentColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerRearFinRight,
                {
                  backgroundColor: playerWingAccentColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerFuselage,
                {
                  backgroundColor: playerHullBaseColor,
                  borderColor: playerHullEdgeColor,
                },
              ]}
            >
              <View
                style={[
                  arenaStyles.playerFuselagePanel,
                  {
                    backgroundColor: playerHullPanelColor,
                    borderColor: hexToRgba(playerHullPanelEdgeColor, 0.92),
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerFuselageStripeLeft,
                  {
                    backgroundColor: hexToRgba(playerAccentStripColor, 0.78),
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerFuselageStripeRight,
                  {
                    backgroundColor: hexToRgba(playerAccentStripColor, 0.78),
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerCanopy,
                  {
                    backgroundColor: playerCanopyColor,
                    borderColor: playerEngineGlowColor,
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerCanopyCore,
                  {
                    backgroundColor: hexToRgba(playerHullBaseColor, 0.94),
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerSpine,
                  {
                    backgroundColor: playerAccentStripColor,
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerIntakeLeft,
                  {
                    backgroundColor: hexToRgba(playerEngineGlowColor, 0.38),
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.playerIntakeRight,
                  {
                    backgroundColor: hexToRgba(playerEngineGlowColor, 0.38),
                  },
                ]}
              />
            </View>
            <View
              style={[
                arenaStyles.playerCrestWrap,
                {
                  borderColor: hexToRgba(
                    activeCrestDefinition.secondaryColor,
                    0.54,
                  ),
                  backgroundColor: hexToRgba(
                    activeCrestDefinition.primaryColor,
                    0.22,
                  ),
                },
              ]}
            >
              <BuildCrestMark
                crestDefinition={activeCrestDefinition}
                size={12}
              />
            </View>
            <View
              style={[
                arenaStyles.playerNoseShadow,
                {
                  borderBottomColor: playerHullPanelColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerNose,
                {
                  borderBottomColor: playerHullBaseColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerNoseCore,
                {
                  borderBottomColor: playerCanopyColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerEnginePodLeft,
                {
                  backgroundColor: playerHullPanelColor,
                  borderColor: hexToRgba(playerHullPanelEdgeColor, 0.9),
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerEnginePodRight,
                {
                  backgroundColor: playerHullPanelColor,
                  borderColor: hexToRgba(playerHullPanelEdgeColor, 0.9),
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerEngineLeft,
                {
                  backgroundColor: playerEngineGlowColor,
                },
              ]}
            />
            <View
              style={[
                arenaStyles.playerEngineRight,
                {
                  backgroundColor: playerEngineGlowColor,
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
              ]}
            >
              <View style={arenaStyles.moveHintCircle}>
                <MoveHintPointerIcon />
              </View>
            </Animated.View>
          ) : null}

          <View pointerEvents="none" style={arenaStyles.versionBadge}>
            <Text style={arenaStyles.versionBadgeText}>
              {ARENA_VERSION_LABEL}
            </Text>
          </View>

          {activeCoachHintCopy && canShowCoachHint ? (
            <View pointerEvents="none" style={arenaStyles.coachHintChip}>
              <Text style={arenaStyles.coachHintTitle}>
                {activeCoachHintCopy.title}
              </Text>
              <Text style={arenaStyles.coachHintBody}>
                {activeCoachHintCopy.body}
              </Text>
            </View>
          ) : null}

          {sectorBannerTier !== null ? (
            <View pointerEvents="none" style={arenaStyles.sectorBannerWrap}>
              <View
                style={[
                  arenaStyles.sectorBannerCard,
                  {
                    borderColor: hexToRgba(
                      activeBiomeDefinition.detailColor,
                      0.64,
                    ),
                    backgroundColor: hexToRgba(
                      activeBiomeDefinition.headerBackground,
                      0.78,
                    ),
                    shadowColor: activeBiomeDefinition.glowColor,
                  },
                ]}
              >
                <Text
                  style={[
                    arenaStyles.sectorBannerTitle,
                    { color: activeBiomeDefinition.detailColor },
                  ]}
                >
                  {activeBiomeDefinition.label}
                </Text>
                <Text style={arenaStyles.sectorBannerSubtitle}>
                  Sector {activeSectorLabel} • {activeBiomeDefinition.subtitle}
                </Text>
              </View>
            </View>
          ) : null}

          {hasEncounterAnnouncement ? (
            <View
              pointerEvents="none"
              style={arenaStyles.boardAnnouncementWrap}
            >
              <View
                style={[
                  arenaStyles.boardAnnouncementGlow,
                  {
                    backgroundColor: hexToRgba(
                      activeBiomeDefinition.announcementGlow,
                      0.1 + encounterAnnouncementOpacity * 0.22,
                    ),
                    opacity: encounterAnnouncementOpacity,
                    transform: [
                      { scale: 0.88 + encounterAnnouncementProgress * 0.16 },
                    ],
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.boardAnnouncementPanel,
                  {
                    borderColor: hexToRgba(
                      activeBiomeDefinition.detailColor,
                      0.52,
                    ),
                    backgroundColor: hexToRgba(
                      activeBiomeDefinition.headerBackground,
                      0.68,
                    ),
                    opacity: 0.25 + encounterAnnouncementOpacity * 0.75,
                  },
                ]}
              >
                <Text
                  style={[
                    arenaStyles.boardAnnouncementText,
                    {
                      color:
                        gameState.encounterAnnouncementColor ??
                        activeBiomeDefinition.detailColor,
                    },
                  ]}
                >
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

          {isLossTransitionActive ? (
            <View pointerEvents="none" style={arenaStyles.lossTransitionOverlay}>
              <View
                style={[
                  arenaStyles.lossTransitionCurtain,
                  arenaStyles.lossTransitionCurtainTop,
                  {
                    opacity: 0.72 + lossTransitionProgress * 0.16,
                    transform: [{ translateY: -lossCurtainOffset }],
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.lossTransitionCurtain,
                  arenaStyles.lossTransitionCurtainBottom,
                  {
                    opacity: 0.72 + lossTransitionProgress * 0.16,
                    transform: [{ translateY: lossCurtainOffset }],
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.lossTransitionGlow,
                  {
                    backgroundColor: hexToRgba(
                      activeBiomeDefinition.announcementGlow,
                      0.16 + lossTransitionProgress * 0.2,
                    ),
                    transform: [
                      { scale: 0.78 + lossTransitionProgress * 0.36 },
                    ],
                  },
                ]}
              />
              <View
                style={[
                  arenaStyles.lossTransitionBeam,
                  {
                    backgroundColor: hexToRgba(
                      activeBiomeDefinition.detailColor,
                      0.24 + lossTransitionProgress * 0.3,
                    ),
                    opacity: 0.5 + lossTransitionProgress * 0.45,
                  },
                ]}
              />
              <Text
                style={[
                  arenaStyles.lossTransitionTitle,
                  { color: activeBiomeDefinition.detailColor },
                ]}
              >
                Ship Lost
              </Text>
              <Text style={arenaStyles.lossTransitionSubtitle}>
                Telemetry closing
              </Text>
            </View>
          ) : null}

          {isCampaignRun ? (
            <Pressable
              onPress={handleActivateShieldAbility}
              disabled={shieldAbilityButtonDisabled}
              style={[
                arenaStyles.sideControlButton,
                arenaStyles.sideControlButtonLeft,
                shieldAbilityReady && arenaStyles.armoryButtonReady,
                shieldAbilityButtonDisabled && arenaStyles.sideControlButtonDisabled,
                {
                  top: sideControlTop,
                  borderColor: shieldAbilityReady
                    ? hexToRgba("#D9F8FF", 0.72)
                    : "#385673",
                  backgroundColor:
                    gameState.shieldAbilityTimer > 0
                      ? "rgba(20, 71, 88, 0.94)"
                      : "rgba(10, 20, 30, 0.9)",
                  shadowOpacity: shieldAbilityReady ? 0.32 : 0,
                  shadowRadius: shieldAbilityReady ? 16 : 0,
                },
              ]}
            >
              <ShieldAbilityControlIcon
                ready={shieldAbilityReady}
                active={gameState.shieldAbilityTimer > 0}
                progress={shieldAbilityProgress}
              />
              <View style={arenaStyles.ultimateButtonMeter}>
                <View
                  style={[
                    arenaStyles.ultimateButtonFill,
                    {
                      width: `${shieldAbilityProgress * 100}%`,
                      backgroundColor: hexToRgba("#BFF8FF", 0.8),
                    },
                  ]}
                />
              </View>
            </Pressable>
          ) : (
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
                    ? hexToRgba("#E6F6FF", 0.54 + armoryReadyPulse * 0.28)
                    : "#385673",
                  backgroundColor: hasArmoryChoices
                    ? hexToRgba("#183F61", 0.86 + armoryReadyPulse * 0.12)
                    : "rgba(10, 20, 30, 0.9)",
                  shadowOpacity: hasArmoryChoices
                    ? 0.26 + armoryReadyPulse * 0.26
                    : 0,
                  shadowRadius: hasArmoryChoices ? 12 + armoryReadyPulse * 9 : 0,
                },
              ]}
            >
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
                    opacity: hasArmoryChoices
                      ? 0.14 + armoryReadyPulse * 0.26
                      : 0,
                    transform: [{ scale: 0.9 + armoryReadyPulse * 0.18 }],
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  arenaStyles.armoryButtonPulseRing,
                  {
                    opacity: hasArmoryChoices
                      ? 0.18 + armoryReadyPulse * 0.28
                      : 0,
                    transform: [{ scale: 0.92 + armoryReadyPulse * 0.08 }],
                  },
                ]}
              />
              <ArmoryControlIcon />
              {hasArmoryChoices ? (
                <View style={arenaStyles.sideControlBadge}>
                  <Text style={arenaStyles.sideControlBadgeText}>
                    {gameState.availableArmoryChoices}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}

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
                shadowOpacity: ultimateReady
                  ? 0.2 + ultimateReadyPulse * 0.18
                  : 0,
                shadowRadius: ultimateReady ? 10 + ultimateReadyPulse * 7 : 0,
              },
            ]}
          >
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
                    backgroundColor: hexToRgba(
                      activeAccentDefinition.secondaryColor,
                      0.82,
                    ),
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
                  <Text style={arenaStyles.armorySubtitle}>
                    {armorySubtitle}
                  </Text>
                </View>
                <Pressable
                  onPress={closeArmoryPanel}
                  style={arenaStyles.armoryCloseButton}
                >
                  <Text style={arenaStyles.armoryCloseButtonText}>Close</Text>
                </Pressable>
              </View>

              <View style={arenaStyles.armoryTabRow}>
                {(["upgrade", "build"] as const).map((tab) => (
                  <Pressable
                    key={`armory-tab-${tab}`}
                    onPress={() => setArmoryTab(tab)}
                    style={[
                      arenaStyles.armoryTabButton,
                      armoryTab === tab && arenaStyles.armoryTabButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        arenaStyles.armoryTabText,
                        armoryTab === tab && arenaStyles.armoryTabTextActive,
                      ]}
                    >
                      {tab === "upgrade" ? "Upgrades" : "Builds"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {armoryTab === "upgrade" ? (
                <>
                  <Text style={arenaStyles.armoryPrompt}>
                    {hasArmoryChoices
                      ? "Pick one permanent install. Remaining upgrades stay banked until you open the armory again."
                      : `Browsing only — no choices pending. Next unlock at ${gameState.nextArmoryCost} salvage (${Math.floor(gameState.salvage)} collected).`}
                  </Text>
                  <View style={arenaStyles.armoryCountChip}>
                    <Text style={arenaStyles.armoryCountChipText}>
                      {armoryAvailabilityLabel}
                    </Text>
                  </View>
                  <ScrollView
                    style={arenaStyles.armoryOptionsScroll}
                    contentContainerStyle={arenaStyles.armoryOptions}
                  >
                    {armoryUpgrades.map(({ key, definition, isMaxed }) => (
                      <Pressable
                        key={key}
                        disabled={isMaxed || !hasArmoryChoices}
                        onPress={() => handleSelectArmoryUpgrade(key)}
                        style={[
                          arenaStyles.armoryCard,
                          (isMaxed || !hasArmoryChoices) && arenaStyles.armoryCardDisabled,
                        ]}
                      >
                        {isMaxed ? (
                          <View style={arenaStyles.armoryCardMaxBadge}>
                            <Text style={arenaStyles.armoryCardMaxBadgeText}>
                              MAX
                            </Text>
                          </View>
                        ) : null}
                        <View style={arenaStyles.armoryCardTopRow}>
                          <Text style={arenaStyles.armoryCardIcon}>
                            {definition.icon}
                          </Text>
                          <Text
                            style={[
                              arenaStyles.armoryCardStat,
                              isMaxed && arenaStyles.armoryCardStatDisabled,
                            ]}
                          >
                            {definition.statLine}
                          </Text>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            arenaStyles.armoryCardLabel,
                            isMaxed && arenaStyles.armoryCardLabelDisabled,
                          ]}
                        >
                          {definition.label}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            arenaStyles.armoryCardText,
                            isMaxed && arenaStyles.armoryCardTextDisabled,
                          ]}
                        >
                          {definition.compactHint}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <ScrollView
                  style={arenaStyles.armoryOptionsScroll}
                  contentContainerStyle={{ paddingBottom: 8, gap: 10 }}
                >
                  <View style={arenaStyles.menuBuildGrid}>
                    {ARENA_BUILD_ORDER.map((buildId) => {
                      const buildMeta = ARENA_BUILD_META[buildId];
                      const buildAccentDefinition = getArenaCosmeticDefinition(
                        getArenaEquippedBuildCosmeticId(arenaMeta, buildId, "buildAccent"),
                      );
                      const buildCrestDefinition = getArenaCosmeticDefinition(
                        getArenaEquippedBuildCosmeticId(arenaMeta, buildId, "buildCrest"),
                      );
                      const isActive = gameState.activeBuild === buildId;
                      return (
                        <Pressable
                          key={`armory-build-${buildId}`}
                          onPress={() => handleSelectBuild(buildId)}
                          style={[
                            arenaStyles.menuBuildButton,
                            isActive && arenaStyles.menuBuildButtonActive,
                          ]}
                        >
                          <View style={arenaStyles.menuBuildTitleRow}>
                            <BuildCrestMark
                              crestDefinition={buildCrestDefinition}
                              size={14}
                            />
                            <Text
                              style={[
                                arenaStyles.menuBuildTitle,
                                {
                                  color: isActive
                                    ? buildAccentDefinition.primaryColor
                                    : "#EAF4FF",
                                },
                              ]}
                            >
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
                  <View style={arenaStyles.menuBuildDetailsCard}>
                    <View style={arenaStyles.menuBuildDetailsHeader}>
                      <BuildCrestMark
                        crestDefinition={activeCrestDefinition}
                        size={16}
                      />
                      <Text
                        style={[
                          arenaStyles.menuBuildDetailsTitle,
                          { color: activeAccentDefinition.primaryColor },
                        ]}
                      >
                        {activeBuildMeta.label}
                      </Text>
                    </View>
                    <Text style={arenaStyles.menuBuildDetailsText}>
                      {activeBuildMeta.description}
                    </Text>
                    <Text style={arenaStyles.menuBuildDetailsText}>
                      Ultimate: {activeBuildMeta.ultimateLabel}.{" "}
                      {activeBuildMeta.ultimateDescription}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        ) : null}

        {isMenuOpen ? (
          <View
            style={[
              arenaStyles.menuPanel,
              {
                borderColor: hexToRgba(
                  activeBiomeDefinition.headerBorder,
                  0.72,
                ),
                backgroundColor: hexToRgba(
                  activeBiomeDefinition.menuSurface,
                  0.97,
                ),
              },
            ]}
          >
            <Text
              style={[
                arenaStyles.menuTitle,
                { color: activeBiomeDefinition.detailColor },
              ]}
            >
              Arena Prototype Menu
            </Text>
            <View style={arenaStyles.menuSegmentRow}>
              {(
                ["run", "codex", "mastery", "collection"] as ArenaMenuTab[]
              ).map((tab) => (
                <Pressable
                  key={`menu-tab-${tab}`}
                  onPress={() => setMenuTab(tab)}
                  style={[
                    arenaStyles.menuSegmentButton,
                    menuTab === tab && arenaStyles.menuSegmentButtonActive,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      arenaStyles.menuSegmentText,
                      menuTab === tab && arenaStyles.menuSegmentTextActive,
                    ]}
                  >
                    {tab === "run"
                      ? "Run"
                      : tab === "codex"
                        ? "Codex"
                        : tab === "mastery"
                          ? "Mastery"
                          : "Collection"}
                  </Text>
                  {tab === "collection" && claimableCosmeticIds.length > 0 ? (
                    <View style={arenaStyles.menuSegmentBadge}>
                      <Text style={arenaStyles.menuSegmentBadgeText}>
                        {claimableCosmeticIds.length}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>

            {menuTab === "run" ? (
              <ScrollView
                style={arenaStyles.menuScroll}
                contentContainerStyle={arenaStyles.menuScrollContent}
              >
                <MetaShowcaseCard
                  title={activeBiomeDefinition.label}
                  subtitle={`Sector ${activeSectorLabel}`}
                  note={`${activeBiomeDefinition.subtitle} Next boss ${nextBossPreviewLabel}. Next reward ${nextRewardPreviewLabel}`}
                  bannerDefinition={activeBannerDefinition}
                  frameDefinition={activeFrameDefinition}
                  biomeDefinition={activeBiomeDefinition}
                  accentColor={activeBiomeDefinition.detailColor}
                  crestDefinition={activeCrestDefinition}
                />

                <Text style={arenaStyles.menuLabel}>Run Stats</Text>
                <View style={arenaStyles.menuBuildDetailsCard}>
                  {(() => {
                    const runTotalKills = ARENA_ENEMY_ORDER.reduce(
                      (sum, kind) => sum + gameState.runKillCountsByEnemy[kind],
                      0,
                    );
                    const tier = getArenaDisplayTier(gameState.elapsed);
                    const minutes = Math.floor(gameState.elapsed / 60);
                    const seconds = Math.floor(gameState.elapsed % 60);
                    const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;
                    const stats = [
                      { label: "Tier", value: `${tier}` },
                      { label: "Time", value: timeLabel },
                      { label: "Score", value: formatArenaValue(gameState.score) },
                      { label: "Kills", value: `${runTotalKills}` },
                      { label: "Salvage", value: `${Math.floor(gameState.salvage)}` },
                      { label: "Mini-bosses", value: `${gameState.runMiniBossClears}` },
                      { label: "Bosses", value: `${gameState.runBossClears}` },
                    ];
                    return (
                      <View style={arenaStyles.runStatsGrid}>
                        {stats.map((stat) => (
                          <View key={stat.label} style={arenaStyles.runStatCell}>
                            <Text style={arenaStyles.runStatValue}>
                              {stat.value}
                            </Text>
                            <Text style={arenaStyles.runStatLabel}>
                              {stat.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>

                <Text style={arenaStyles.menuLabel}>Game</Text>
                <View style={arenaStyles.menuRow}>
                  <Pressable
                    style={[
                      arenaStyles.menuButton,
                      arenaStyles.menuButtonActive,
                    ]}
                  >
                    <Text style={arenaStyles.menuButtonText}>Arena V2</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSwitchGame("prototype")}
                    style={arenaStyles.menuButton}
                  >
                    <Text style={arenaStyles.menuButtonText}>Shooter Test</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSwitchGame("defender")}
                    style={arenaStyles.menuButton}
                  >
                    <Text style={arenaStyles.menuButtonText}>Defender</Text>
                  </Pressable>
                </View>

                <Text style={arenaStyles.menuLabel}>VFX</Text>
                <View style={arenaStyles.menuRow}>
                  <Pressable
                    onPress={() => setVfxQuality("balanced")}
                    style={[
                      arenaStyles.menuButton,
                      vfxQuality === "balanced" && arenaStyles.menuButtonActive,
                    ]}
                  >
                    <Text style={arenaStyles.menuButtonText}>Balanced</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setVfxQuality("high")}
                    style={[
                      arenaStyles.menuButton,
                      vfxQuality === "high" && arenaStyles.menuButtonActive,
                    ]}
                  >
                    <Text style={arenaStyles.menuButtonText}>High</Text>
                  </Pressable>
                </View>

                <Text style={arenaStyles.menuLabel}>Tips</Text>
                <View style={arenaStyles.menuRow}>
                  <Pressable
                    onPress={handleResetCoachHints}
                    style={arenaStyles.menuButton}
                  >
                    <Text style={arenaStyles.menuButtonText}>Reset tips</Text>
                  </Pressable>
                  <View style={arenaStyles.tipStatusCard}>
                    <Text style={arenaStyles.tipStatusText}>
                      Coaching chips are shown once and never pause combat.
                    </Text>
                  </View>
                </View>

                <Text style={arenaStyles.menuLabel}>Audio</Text>
                <View style={arenaStyles.menuRow}>
                  <View style={arenaStyles.tipStatusCard}>
                    <Text style={arenaStyles.tipStatusText}>
                      {ARENA_AUDIO_DISABLED_NOTE}
                    </Text>
                  </View>
                </View>

                {gameState.runMode === "endless" ? (
                  <>
                    <Text style={arenaStyles.menuLabel}>Testing</Text>
                    <View style={arenaStyles.menuActions}>
                      <Pressable
                        onPress={handleRestartAtTier40Demo}
                        style={[
                          arenaStyles.menuActionButton,
                          arenaStyles.menuActionSecondary,
                        ]}
                      >
                        <Text style={arenaStyles.menuActionText}>
                          Restart at T40 Demo
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                <View style={arenaStyles.menuActions}>
                  <Pressable
                    onPress={handleReturnHomeBase}
                    style={[
                      arenaStyles.menuActionButton,
                      arenaStyles.menuActionSecondary,
                    ]}
                  >
                    <Text style={arenaStyles.menuActionText}>Home Base</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRestart}
                    style={[
                      arenaStyles.menuActionButton,
                      arenaStyles.menuActionPrimary,
                    ]}
                  >
                    <Text style={arenaStyles.menuActionText}>Restart Run</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : menuTab === "codex" ? (
              <ScrollView
                style={arenaStyles.menuScroll}
                contentContainerStyle={arenaStyles.menuScrollContent}
              >
                {!isMetaReady ? (
                  <Text style={arenaStyles.menuBuildDetailsText}>
                    Loading persistent codex data...
                  </Text>
                ) : (
                  <>
                    <Text style={arenaStyles.menuBuildDetailsText}>
                      {`Codex Archive — ${codexEnemyEntries.filter((entry) => entry.discovered).length}/${codexEnemyEntries.length} signals logged`}
                    </Text>
                    <Text style={arenaStyles.menuLabel}>Rewards</Text>
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
                          <View
                            key={`codex-enemy-${entry.kind}`}
                            style={[
                              arenaStyles.codexCard,
                              isLocked && arenaStyles.codexCardLocked,
                            ]}
                          >
                            <View style={arenaStyles.codexCardHeader}>
                              <Text
                                style={[
                                  arenaStyles.codexCardTitle,
                                  isLocked && arenaStyles.codexCardTitleLocked,
                                ]}
                              >
                                {isLocked ? "Locked Signal" : entry.label}
                              </Text>
                              <Text style={arenaStyles.codexCardMeta}>
                                {isLocked
                                  ? "Awaiting encounter"
                                  : `Seen T${entry.firstSeenTier ?? "-"}`}
                              </Text>
                            </View>
                            <Text
                              style={[
                                arenaStyles.codexCardText,
                                isLocked && arenaStyles.codexCardTextLocked,
                              ]}
                            >
                              {isLocked
                                ? `Encounter ${ARENA_ENEMY_LABELS[entry.kind]} once to unlock this log entry.`
                                : entry.summary}
                            </Text>
                            {!isLocked ? (
                              <View style={arenaStyles.codexStatRow}>
                                <Text style={arenaStyles.codexStatText}>
                                  Kills {entry.totalKills}
                                </Text>
                                <Text style={arenaStyles.codexStatText}>
                                  {entry.firstKillTier
                                    ? `First kill T${entry.firstKillTier}`
                                    : "No kill logged"}
                                </Text>
                                <Text style={arenaStyles.codexStatText}>
                                  {entry.bossClears > 0
                                    ? `Boss clears ${entry.bossClears}`
                                    : entry.firstClearTier
                                      ? `First clear T${entry.firstClearTier}`
                                      : "No clear logged"}
                                </Text>
                              </View>
                            ) : null}
                            {!isLocked && entry.kind === "prismBoss" ? (
                              <UnlockChip
                                entry={arenaMeta.unlocks.prismCoreFirstClear}
                                metaState={arenaMeta}
                                accentColor="#A6D7FF"
                                frameDefinition={activeFrameDefinition}
                              />
                            ) : !isLocked &&
                              entry.kind === "hiveCarrierBoss" ? (
                              <UnlockChip
                                entry={arenaMeta.unlocks.hiveCarrierFirstClear}
                                metaState={arenaMeta}
                                accentColor="#93F0D5"
                                frameDefinition={activeFrameDefinition}
                              />
                            ) : !isLocked && entry.kind === "vectorLoomBoss" ? (
                              <UnlockChip
                                entry={arenaMeta.unlocks.vectorLoomFirstClear}
                                metaState={arenaMeta}
                                accentColor="#C7D4FF"
                                frameDefinition={activeFrameDefinition}
                              />
                            ) : !isLocked &&
                              entry.kind === "eclipseTalonBoss" ? (
                              <UnlockChip
                                entry={arenaMeta.unlocks.eclipseTalonFirstClear}
                                metaState={arenaMeta}
                                accentColor="#FFB36E"
                                frameDefinition={activeFrameDefinition}
                              />
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                  </>
                )}
              </ScrollView>
            ) : (
              <ScrollView
                style={arenaStyles.menuScroll}
                contentContainerStyle={arenaStyles.menuScrollContent}
              >
                {!isMetaReady ? (
                  <Text style={arenaStyles.menuBuildDetailsText}>
                    {menuTab === "mastery"
                      ? "Loading mastery records..."
                      : "Loading cosmetic collection..."}
                  </Text>
                ) : menuTab === "mastery" ? (
                  <>
                    <View style={arenaStyles.masteryIntroCard}>
                      <Text style={arenaStyles.masteryIntroText}>
                        Mastery XP is granted at run end to the build with the
                        most active time. Ties resolve to the build you finish
                        on.
                      </Text>
                    </View>
                    {masteryCards.map(
                      ({
                        buildId,
                        buildMeta,
                        accentDefinition,
                        crestDefinition,
                        mastery,
                        progress,
                        unlockEntries,
                        nextUnlock,
                      }) => (
                        <View
                          key={`mastery-${buildId}`}
                          style={[
                            arenaStyles.masteryCard,
                            gameState.activeBuild === buildId &&
                              arenaStyles.masteryCardActive,
                            {
                              borderColor: hexToRgba(
                                accentDefinition.secondaryColor,
                                gameState.activeBuild === buildId ? 0.82 : 0.56,
                              ),
                              backgroundColor: hexToRgba(
                                accentDefinition.primaryColor,
                                gameState.activeBuild === buildId ? 0.16 : 0.08,
                              ),
                            },
                          ]}
                        >
                          <View style={arenaStyles.masteryHeaderRow}>
                            <View style={arenaStyles.masteryHeaderCopy}>
                              <View style={arenaStyles.cardTitleRow}>
                                <BuildCrestMark
                                  crestDefinition={crestDefinition}
                                  size={16}
                                />
                                <Text
                                  style={[
                                    arenaStyles.masteryTitle,
                                    { color: accentDefinition.primaryColor },
                                  ]}
                                >
                                  {buildMeta.label}
                                </Text>
                              </View>
                              <Text style={arenaStyles.masterySubtitle}>
                                Level {mastery.level} • {mastery.title}
                              </Text>
                            </View>
                            <Text style={arenaStyles.masteryXpText}>
                              {mastery.xp} XP
                            </Text>
                          </View>
                          <View style={arenaStyles.masteryMeter}>
                            <View
                              style={[
                                arenaStyles.masteryMeterFill,
                                {
                                  width: `${progress.progress * 100}%`,
                                  backgroundColor: hexToRgba(
                                    accentDefinition.secondaryColor,
                                    0.76,
                                  ),
                                },
                              ]}
                            />
                          </View>
                          <Text style={arenaStyles.masteryThresholdText}>
                            {progress.nextThreshold > progress.currentThreshold
                              ? `${progress.currentThreshold} / ${progress.nextThreshold} threshold`
                              : "Top rank reached"}
                          </Text>
                          <Text style={arenaStyles.masteryThresholdText}>
                            {nextUnlock
                              ? `Next unlock: ${nextUnlock.rewardLabel} • ${nextUnlock.description}`
                              : "All current mastery reward hooks unlocked"}
                          </Text>
                          <View style={arenaStyles.masteryStatRow}>
                            <Text style={arenaStyles.masteryStatText}>
                              Best tier T{mastery.bestTier}
                            </Text>
                            <Text style={arenaStyles.masteryStatText}>
                              Mini-boss {mastery.miniBossClears}
                            </Text>
                            <Text style={arenaStyles.masteryStatText}>
                              Boss {mastery.bossClears}
                            </Text>
                            <Text style={arenaStyles.masteryStatText}>
                              Runs {mastery.runs}
                            </Text>
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
                      ),
                    )}
                  </>
                ) : (
                  <>
                    <Text style={arenaStyles.menuBuildDetailsText}>
                      {`Collection — ${claimableCosmeticIds.length} claimable • ${Object.values(arenaMeta.cosmetics).filter((entry) => entry.state === "owned").length} owned`}
                    </Text>
                    {collectionNoticeText ? (
                      <View style={arenaStyles.collectionNoticeCard}>
                        <Text style={arenaStyles.collectionNoticeText}>
                          {collectionNoticeText}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={arenaStyles.menuLabel}>Featured Rewards</Text>
                    <View style={arenaStyles.codexGrid}>
                      {featuredRewardIds.map((cosmeticId) => {
                        const definition =
                          getArenaCosmeticDefinition(cosmeticId);
                        const displayState = getArenaCosmeticDisplayState(
                          arenaMeta,
                          cosmeticId,
                        );
                        return (
                          <CollectionCard
                            key={`collection-featured-${cosmeticId}`}
                            definition={definition}
                            displayState={displayState}
                            frameDefinition={activeFrameDefinition}
                            onPress={() => {
                              if (displayState === "claimable") {
                                handleClaimCosmetic(cosmeticId);
                              } else if (displayState === "owned") {
                                handleEquipCosmetic(cosmeticId);
                              }
                            }}
                          />
                        );
                      })}
                    </View>

                    <Text style={arenaStyles.menuLabel}>Global</Text>
                    <Text style={arenaStyles.collectionSectionLabel}>
                      Banner
                    </Text>
                    <View style={arenaStyles.codexGrid}>
                      {collectionBannerIds.map((cosmeticId) => {
                        const definition =
                          getArenaCosmeticDefinition(cosmeticId);
                        const displayState = getArenaCosmeticDisplayState(
                          arenaMeta,
                          cosmeticId,
                        );
                        return (
                          <CollectionCard
                            key={`collection-banner-${cosmeticId}`}
                            definition={definition}
                            displayState={displayState}
                            frameDefinition={activeFrameDefinition}
                            onPress={() => {
                              if (displayState === "claimable") {
                                handleClaimCosmetic(cosmeticId);
                              } else if (displayState === "owned") {
                                handleEquipCosmetic(cosmeticId);
                              }
                            }}
                          />
                        );
                      })}
                    </View>

                    <Text style={arenaStyles.collectionSectionLabel}>
                      Codex Frame
                    </Text>
                    <View style={arenaStyles.codexGrid}>
                      {collectionFrameIds.map((cosmeticId) => {
                        const definition =
                          getArenaCosmeticDefinition(cosmeticId);
                        const displayState = getArenaCosmeticDisplayState(
                          arenaMeta,
                          cosmeticId,
                        );
                        return (
                          <CollectionCard
                            key={`collection-frame-${cosmeticId}`}
                            definition={definition}
                            displayState={displayState}
                            frameDefinition={activeFrameDefinition}
                            onPress={() => {
                              if (displayState === "claimable") {
                                handleClaimCosmetic(cosmeticId);
                              } else if (displayState === "owned") {
                                handleEquipCosmetic(cosmeticId);
                              }
                            }}
                          />
                        );
                      })}
                    </View>

                    <Text style={arenaStyles.menuLabel}>Build</Text>
                    <View style={arenaStyles.collectionBuildPillRow}>
                      {ARENA_BUILD_ORDER.map((buildId) => {
                        const isSelected = collectionBuildId === buildId;
                        return (
                          <Pressable
                            key={`collection-build-pill-${buildId}`}
                            onPress={() => setCollectionBuildId(buildId)}
                            style={[
                              arenaStyles.collectionBuildPill,
                              isSelected && arenaStyles.collectionBuildPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                arenaStyles.collectionBuildPillText,
                                isSelected && arenaStyles.collectionBuildPillTextActive,
                              ]}
                            >
                              {ARENA_BUILD_META[buildId].label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={arenaStyles.collectionSectionLabel}>
                      Accents
                    </Text>
                    <View style={arenaStyles.codexGrid}>
                      {collectionAccentIds.map((cosmeticId) => {
                        const definition =
                          getArenaCosmeticDefinition(cosmeticId);
                        const displayState = getArenaCosmeticDisplayState(
                          arenaMeta,
                          cosmeticId,
                        );
                        return (
                          <CollectionCard
                            key={`collection-accent-${cosmeticId}`}
                            definition={definition}
                            displayState={displayState}
                            frameDefinition={activeFrameDefinition}
                            onPress={() => {
                              if (displayState === "claimable") {
                                handleClaimCosmetic(cosmeticId);
                              } else if (displayState === "owned") {
                                handleEquipCosmetic(cosmeticId);
                              }
                            }}
                          />
                        );
                      })}
                    </View>

                    <Text style={arenaStyles.collectionSectionLabel}>
                      Crests
                    </Text>
                    <View style={arenaStyles.codexGrid}>
                      {collectionCrestIds.map((cosmeticId) => {
                        const definition =
                          getArenaCosmeticDefinition(cosmeticId);
                        const displayState = getArenaCosmeticDisplayState(
                          arenaMeta,
                          cosmeticId,
                        );
                        return (
                          <CollectionCard
                            key={`collection-crest-${cosmeticId}`}
                            definition={definition}
                            displayState={displayState}
                            frameDefinition={activeFrameDefinition}
                            onPress={() => {
                              if (displayState === "claimable") {
                                handleClaimCosmetic(cosmeticId);
                              } else if (displayState === "owned") {
                                handleEquipCosmetic(cosmeticId);
                              }
                            }}
                          />
                        );
                      })}
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>

      {shouldShowRunEndOverlay ? (
        <View style={arenaStyles.overlay}>
          <View style={arenaStyles.gameOverModal}>
            <Text style={arenaStyles.gameOverTitle}>
              {gameState.status === "won"
                ? "Mission Complete"
                : gameState.status === "lost"
                  ? "Health Depleted"
                  : "Restart Run"}
            </Text>
            <Text style={arenaStyles.gameOverText}>
              {gameState.status === "won"
                ? `${activeRunEndSummary?.campaignMissionLabel ?? "Campaign sortie"} cleared. Score ${gameState.score}.`
                : gameState.status === "lost"
                  ? `Enemy fire broke through the shields. Score ${gameState.score}.`
                  : "Review the current run summary before wiping the board."}
            </Text>
            {activeRunEndSummary ? (
              <View
                style={[
                  arenaStyles.runSummaryCard,
                  {
                    borderColor: hexToRgba(
                      activeBiomeDefinition.headerBorder,
                      0.62,
                    ),
                    backgroundColor: hexToRgba(
                      activeBiomeDefinition.headerBackground,
                      0.72,
                    ),
                  },
                ]}
              >
                <View style={arenaStyles.runSummaryHeader}>
                  <Text
                    style={[
                      arenaStyles.runSummaryTitle,
                      { color: activeBiomeDefinition.detailColor },
                    ]}
                  >
                    {activeBiomeDefinition.label}
                  </Text>
                  <Text style={arenaStyles.runSummaryTierText}>
                    T{activeRunEndSummary.tierReached}
                  </Text>
                </View>
                <Text style={arenaStyles.runSummaryText}>
                  Bosses cleared:{" "}
                  {activeRunEndSummary.bossLabels.length > 0
                    ? activeRunEndSummary.bossLabels.join(" • ")
                    : "None"}
                </Text>
                <Text style={arenaStyles.runSummaryText}>
                  Mastery XP: +{activeRunEndSummary.masteryXp} to{" "}
                  {ARENA_BUILD_META[activeRunEndSummary.dominantBuild].label}
                </Text>
                {activeRunEndSummary.campaignXp > 0 ? (
                  <Text style={arenaStyles.runSummaryText}>
                    Campaign XP: +{activeRunEndSummary.campaignXp}
                  </Text>
                ) : null}
                <Text style={arenaStyles.runSummaryText}>
                  Rewards ready:{" "}
                  {runEndRewardText ??
                    "No new claimable cosmetics from this run."}
                </Text>
                {activeRunEndSummary.progressNote ? (
                  <Text style={arenaStyles.runSummaryText}>
                    {activeRunEndSummary.progressNote}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {collectionNoticeText && !activeRunEndSummary ? (
              <Text style={arenaStyles.gameOverNoticeText}>
                {collectionNoticeText}
              </Text>
            ) : null}
            <View style={arenaStyles.menuActions}>
              {pendingRestartSummary ? (
                <>
                  <Pressable
                    onPress={() => {
                      setPendingRestartSummary(null);
                      if (gameState.status === "running") {
                        setIsPaused(false);
                      }
                    }}
                    style={[
                      arenaStyles.menuActionButton,
                      arenaStyles.menuActionSecondary,
                    ]}
                  >
                    <Text style={arenaStyles.menuActionText}>Continue Run</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirmRestart}
                    style={[
                      arenaStyles.menuActionButton,
                      arenaStyles.menuActionPrimary,
                    ]}
                  >
                    <Text style={arenaStyles.menuActionText}>Restart Now</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={
                      gameState.status === "won"
                        ? handleReturnHomeBase
                        : resetArenaRun
                    }
                    style={[
                      arenaStyles.menuActionButton,
                      arenaStyles.menuActionPrimary,
                    ]}
                  >
                    <Text style={arenaStyles.menuActionText}>
                      {gameState.status === "won" ? "Home Base" : "Retry"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={
                      gameState.status === "won"
                        ? () => deployRun(gameState.runMode, gameState.campaignMissionId)
                        : () => handleSwitchGame("prototype")
                    }
                    style={[
                      arenaStyles.menuActionButton,
                      arenaStyles.menuActionSecondary,
                    ]}
                  >
                    <Text style={arenaStyles.menuActionText}>
                      {gameState.status === "won" ? "Replay" : "Back to Prototype"}
                    </Text>
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
    backgroundColor: "#07111A",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  containerPortrait: {
    paddingHorizontal: 10,
  },
  hubScroll: {
    flex: 1,
  },
  hubContent: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  hubTopCommandBar: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(126, 190, 255, 0.28)",
    backgroundColor: "rgba(7, 16, 28, 0.96)",
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    shadowColor: "#6FD8FF",
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  hubLevelBadge: {
    width: 62,
    height: 62,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: "rgba(15, 26, 43, 0.98)",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  hubLevelLabel: {
    color: "#9EB8D7",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  hubLevelValue: {
    color: "#F8FCFF",
    fontSize: 25,
    fontWeight: "900",
    marginTop: -2,
  },
  hubCommanderBlock: {
    flex: 1,
    minWidth: 142,
  },
  hubEyebrow: {
    color: "#8DDCFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  hubTitle: {
    color: "#F4FBFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.4,
    marginTop: 4,
  },
  hubRankText: {
    color: "#9AB7E6",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: "uppercase",
  },
  hubResourceRail: {
    flexDirection: "row",
    gap: 8,
    flexGrow: 1,
    minWidth: 180,
  },
  hubResourceChip: {
    flex: 1,
    minWidth: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(133, 199, 255, 0.28)",
    backgroundColor: "rgba(3, 9, 18, 0.74)",
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  hubResourceSymbol: {
    color: "#80CFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hubResourceValue: {
    color: "#F3FAFF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 3,
  },
  hubProgressTrack: {
    width: "100%",
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  hubProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  hubFixedScreen: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
  },
  hubFixedTopBar: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(126, 190, 255, 0.28)",
    backgroundColor: "rgba(7, 16, 28, 0.96)",
    padding: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    shadowColor: "#6FD8FF",
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  hubCompactLevelBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: "rgba(15, 26, 43, 0.98)",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  hubCompactLevelValue: {
    color: "#F8FCFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: -2,
  },
  hubFixedTitleBlock: {
    flex: 1,
    minWidth: 150,
  },
  hubFixedTitle: {
    color: "#F4FBFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  hubTopUtilityButton: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(145, 204, 255, 0.32)",
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  hubTopUtilityText: {
    color: "#D7EEFF",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  hubFixedDeck: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(105, 171, 230, 0.25)",
    backgroundColor: "rgba(5, 12, 23, 0.98)",
    padding: 8,
    gap: 6,
    overflow: "hidden",
    shadowColor: "#4BBEFF",
    shadowOpacity: 0.14,
    shadowRadius: 22,
  },
  hubHorizonWindowCompact: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    height: 92,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(137, 189, 255, 0.14)",
    backgroundColor: "rgba(12, 24, 44, 0.68)",
  },
  hubRootMissionConsole: {
    zIndex: 1,
    minHeight: 94,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(164, 130, 255, 0.32)",
    backgroundColor: "rgba(20, 18, 42, 0.8)",
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hubCompactGlobe: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    backgroundColor: "rgba(114, 67, 220, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  hubRootMissionText: {
    flex: 1,
    gap: 3,
  },
  hubRootShipBay: {
    zIndex: 1,
    alignItems: "center",
    gap: 6,
  },
  hubCompactShipPad: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: "rgba(143, 199, 255, 0.32)",
    backgroundColor: "rgba(10, 27, 45, 0.74)",
    alignItems: "center",
    justifyContent: "center",
  },
  hubShipWingLeftCompact: {
    position: "absolute",
    top: 56,
    left: 21,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 35,
    borderBottomWidth: 31,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    opacity: 0.9,
    transform: [{ rotate: "17deg" }],
  },
  hubShipWingRightCompact: {
    position: "absolute",
    top: 56,
    right: 21,
    width: 0,
    height: 0,
    borderLeftWidth: 35,
    borderRightWidth: 6,
    borderBottomWidth: 31,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    opacity: 0.9,
    transform: [{ rotate: "-17deg" }],
  },
  hubShipBodyCompact: {
    position: "absolute",
    top: 37,
    width: 30,
    height: 55,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.34)",
    backgroundColor: "#BAC8D9",
  },
  hubShipCanopyCompact: {
    position: "absolute",
    top: 47,
    width: 12,
    height: 28,
    borderRadius: 7,
    opacity: 0.86,
  },
  hubShipNoseCompact: {
    position: "absolute",
    top: 15,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 28,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#E9F1F9",
  },
  hubShipEngineLeftCompact: {
    position: "absolute",
    bottom: 15,
    left: 43,
    width: 7,
    height: 20,
    borderRadius: 5,
    backgroundColor: "#80CFFF",
  },
  hubShipEngineRightCompact: {
    position: "absolute",
    bottom: 15,
    right: 43,
    width: 7,
    height: 20,
    borderRadius: 5,
    backgroundColor: "#80CFFF",
  },
  hubRootRigReadout: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(134, 203, 255, 0.22)",
    backgroundColor: "rgba(4, 11, 20, 0.72)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  hubRootStationGrid: {
    zIndex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hubRootStationTile: {
    flexGrow: 1,
    flexBasis: "48%",
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "space-between",
    backgroundColor: "rgba(8, 18, 30, 0.92)",
  },
  hubRootStationTileWide: {
    flexBasis: "100%",
    minHeight: 56,
  },
  hubStationTileGreen: {
    borderColor: "rgba(133, 255, 160, 0.42)",
    shadowColor: "#85FFA0",
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  hubCompactLaunchButton: {
    zIndex: 1,
    alignSelf: "center",
    minWidth: 192,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: "rgba(58, 39, 7, 0.92)",
    paddingHorizontal: 22,
    paddingVertical: 8,
    alignItems: "center",
    shadowOpacity: 0.28,
    shadowRadius: 15,
  },
  hubDetailDeck: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(105, 171, 230, 0.25)",
    backgroundColor: "rgba(5, 12, 23, 0.98)",
    padding: 12,
    overflow: "hidden",
  },
  hubDetailContent: {
    flex: 1,
    gap: 10,
    justifyContent: "center",
  },
  hubDetailHero: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(164, 130, 255, 0.26)",
    backgroundColor: "rgba(20, 18, 42, 0.78)",
    padding: 14,
    gap: 7,
  },
  hubDetailTitle: {
    color: "#FAF7FF",
    fontSize: 22,
    fontWeight: "900",
  },
  hubDetailCopy: {
    color: "#B9C8FF",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  hubDetailStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hubDetailStatCard: {
    flex: 1,
    minWidth: 92,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(207, 189, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    paddingHorizontal: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  hubDetailPrimaryAction: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 130, 0.58)",
    backgroundColor: "rgba(82, 56, 10, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  hubDetailPrimaryActionText: {
    color: "#FFE49A",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  hubPreviewList: {
    gap: 8,
  },
  hubPreviewRow: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(151, 221, 255, 0.18)",
    backgroundColor: "rgba(5, 15, 26, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hubPreviewTitle: {
    color: "#F2FAFF",
    fontSize: 12,
    fontWeight: "900",
  },
  hubPreviewMeta: {
    color: "#99AEC4",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },
  hubDetailActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  hubDetailActionDisabled: {
    opacity: 0.44,
  },
  hubDetailSecondaryAction: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(145, 204, 255, 0.28)",
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  hubDetailSecondaryActionText: {
    color: "#D7EEFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  hubBossRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hubBossChip: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(119, 239, 230, 0.24)",
    backgroundColor: "rgba(5, 15, 26, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hubMasteryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hubMasteryCard: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(205, 145, 255, 0.24)",
    backgroundColor: "rgba(5, 15, 26, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hubSmallProgressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    overflow: "hidden",
    marginTop: 8,
  },
  hubSmallProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  hubEquipSlotCard: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(151, 221, 255, 0.22)",
    backgroundColor: "rgba(5, 15, 26, 0.9)",
    padding: 12,
    gap: 8,
  },
  hubWeaponUpgradeHeader: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(123, 211, 255, 0.28)",
    backgroundColor: "rgba(7, 21, 35, 0.9)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hubWeaponTargetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  hubWeaponEquipGrid: {
    flexDirection: "row",
    gap: 8,
  },
  hubWeaponUpgradeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hubWeaponUpgradeCard: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 130, 0.28)",
    backgroundColor: "rgba(34, 25, 8, 0.86)",
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 5,
  },
  hubShipStatUpgradeCard: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(133, 255, 160, 0.28)",
    backgroundColor: "rgba(8, 34, 20, 0.82)",
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 5,
  },
  hubUpgradeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  hubUpgradeSeparator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hubUpgradeSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(145, 204, 255, 0.18)",
  },
  hubUpgradeSeparatorText: {
    color: "#8BFFAA",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hubWeaponUpgradeFootnote: {
    color: "#8FA3BA",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    textAlign: "center",
  },
  hubShieldGrid: {
    gap: 10,
  },
  hubShieldCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(133, 255, 160, 0.26)",
    backgroundColor: "rgba(5, 15, 26, 0.9)",
    padding: 14,
    gap: 8,
  },
  hubDeck: {
    minHeight: 650,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(105, 171, 230, 0.25)",
    backgroundColor: "rgba(5, 12, 23, 0.98)",
    padding: 14,
    gap: 14,
    overflow: "hidden",
    shadowColor: "#4BBEFF",
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  hubDeckStrutLeft: {
    position: "absolute",
    top: 8,
    bottom: 120,
    left: 28,
    width: 2,
    backgroundColor: "rgba(108, 159, 216, 0.26)",
    transform: [{ rotate: "10deg" }],
  },
  hubDeckStrutRight: {
    position: "absolute",
    top: 8,
    bottom: 120,
    right: 28,
    width: 2,
    backgroundColor: "rgba(108, 159, 216, 0.26)",
    transform: [{ rotate: "-10deg" }],
  },
  hubHorizonWindow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    height: 116,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(137, 189, 255, 0.16)",
    backgroundColor: "rgba(12, 24, 44, 0.74)",
  },
  hubStar: {
    position: "absolute",
    top: 20,
    left: "22%",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#D9F2FF",
  },
  hubStarTwo: {
    top: 58,
    left: "72%",
    opacity: 0.78,
  },
  hubStarThree: {
    top: 88,
    left: "46%",
    opacity: 0.56,
  },
  hubMissionConsole: {
    zIndex: 1,
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(164, 130, 255, 0.3)",
    backgroundColor: "rgba(20, 18, 42, 0.78)",
    padding: 15,
    gap: 7,
  },
  hubGlobe: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    backgroundColor: "rgba(114, 67, 220, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  hubGlobeCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(226, 204, 255, 0.44)",
    backgroundColor: "rgba(153, 95, 255, 0.2)",
  },
  hubGlobeMeridian: {
    position: "absolute",
    top: 8,
    bottom: 8,
    left: 54,
    width: 1,
    backgroundColor: "rgba(231, 219, 255, 0.42)",
  },
  hubGlobeLatitude: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 47,
    height: 1,
    backgroundColor: "rgba(231, 219, 255, 0.38)",
  },
  hubGlobeLatitudeLow: {
    top: 66,
    opacity: 0.74,
  },
  hubMapKicker: {
    color: "#C6B5FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hubMapTitle: {
    color: "#FAF7FF",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  hubMapCopy: {
    color: "#B9C8FF",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  hubMapStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  hubMapStat: {
    minWidth: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(207, 189, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    paddingHorizontal: 9,
    paddingVertical: 7,
    alignItems: "center",
  },
  hubMapStatLabel: {
    color: "#897DB2",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  hubMapStatValue: {
    color: "#FBFAFF",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  hubStationGrid: {
    zIndex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  hubStationTile: {
    width: "48%",
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    justifyContent: "space-between",
    backgroundColor: "rgba(8, 18, 30, 0.92)",
  },
  hubStationTileBlue: {
    borderColor: "rgba(123, 211, 255, 0.44)",
    shadowColor: "#6FD8FF",
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  hubStationTileGold: {
    borderColor: "rgba(255, 216, 121, 0.48)",
    shadowColor: "#FFD66B",
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  hubStationTileCyan: {
    borderColor: "rgba(119, 239, 230, 0.4)",
    shadowColor: "#77EFE6",
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  hubStationTilePurple: {
    borderColor: "rgba(205, 145, 255, 0.42)",
    shadowColor: "#C885FF",
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  hubStationIcon: {
    color: "#F4FBFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  hubStationTitle: {
    color: "#F8FCFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  hubStationSubtitle: {
    color: "#A9BED4",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  hubMiniActionRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  hubMiniAction: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(183, 240, 255, 0.28)",
    paddingVertical: 6,
    alignItems: "center",
  },
  hubMiniActionText: {
    color: "#D8FAFF",
    fontSize: 9,
    fontWeight: "900",
  },
  hubShipBay: {
    zIndex: 1,
    alignItems: "center",
    gap: 10,
  },
  hubShipPadOuter: {
    width: 214,
    height: 214,
    borderRadius: 107,
    borderWidth: 2,
    borderColor: "rgba(143, 199, 255, 0.32)",
    backgroundColor: "rgba(10, 27, 45, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  hubShipPadInner: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1,
    borderColor: "rgba(202, 229, 255, 0.28)",
    backgroundColor: "rgba(7, 17, 30, 0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  hubShipShadow: {
    position: "absolute",
    bottom: 40,
    width: 102,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.36)",
  },
  hubShipWingLeft: {
    position: "absolute",
    top: 80,
    left: 30,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 58,
    borderBottomWidth: 50,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    opacity: 0.9,
    transform: [{ rotate: "17deg" }],
  },
  hubShipWingRight: {
    position: "absolute",
    top: 80,
    right: 30,
    width: 0,
    height: 0,
    borderLeftWidth: 58,
    borderRightWidth: 8,
    borderBottomWidth: 50,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    opacity: 0.9,
    transform: [{ rotate: "-17deg" }],
  },
  hubShipBody: {
    position: "absolute",
    top: 58,
    width: 44,
    height: 78,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.34)",
    backgroundColor: "#BAC8D9",
  },
  hubShipCanopy: {
    position: "absolute",
    top: 70,
    width: 18,
    height: 42,
    borderRadius: 9,
    opacity: 0.86,
  },
  hubShipNose: {
    position: "absolute",
    top: 26,
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderRightWidth: 18,
    borderBottomWidth: 42,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#E9F1F9",
  },
  hubShipEngineLeft: {
    position: "absolute",
    bottom: 30,
    left: 65,
    width: 8,
    height: 24,
    borderRadius: 5,
    backgroundColor: "#80CFFF",
  },
  hubShipEngineRight: {
    position: "absolute",
    bottom: 30,
    right: 65,
    width: 8,
    height: 24,
    borderRadius: 5,
    backgroundColor: "#80CFFF",
  },
  hubShipReadout: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(134, 203, 255, 0.22)",
    backgroundColor: "rgba(4, 11, 20, 0.72)",
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: "center",
  },
  hubShipReadoutLabel: {
    color: "#7F9BB8",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hubShipReadoutValue: {
    color: "#F2FAFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },
  hubLaunchButton: {
    zIndex: 1,
    alignSelf: "center",
    minWidth: 210,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: "rgba(58, 39, 7, 0.92)",
    paddingHorizontal: 28,
    paddingVertical: 13,
    alignItems: "center",
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  hubLaunchTitle: {
    color: "#FFE49A",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  hubLaunchSubtitle: {
    color: "#FFD15A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  hubLoadoutConsole: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(130, 208, 255, 0.24)",
    backgroundColor: "rgba(9, 22, 36, 0.96)",
    padding: 13,
    gap: 10,
  },
  hubConsoleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  hubConsoleKicker: {
    color: "#83D7FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hubConsoleTitle: {
    color: "#F4FBFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  hubConsoleStatus: {
    color: "#A7BAD0",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  hubLoadoutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  hubLoadoutCard: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(151, 221, 255, 0.22)",
    backgroundColor: "rgba(5, 15, 26, 0.9)",
    padding: 13,
    gap: 8,
  },
  hubLoadoutKicker: {
    color: "#84BBDD",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  hubLoadoutTitle: {
    color: "#F3FAFF",
    fontSize: 15,
    fontWeight: "900",
  },
  hubLoadoutCopy: {
    color: "#AFC1D1",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  hubChoiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  hubChoicePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(141, 220, 255, 0.28)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hubChoicePillActive: {
    borderColor: "#9EEBFF",
    backgroundColor: "rgba(94, 204, 255, 0.18)",
  },
  hubChoicePillLocked: {
    opacity: 0.42,
  },
  hubChoiceText: {
    color: "#EAF8FF",
    fontSize: 10,
    fontWeight: "900",
  },
  hubBottomDock: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(116, 154, 198, 0.24)",
    backgroundColor: "rgba(5, 12, 22, 0.95)",
    padding: 8,
    flexDirection: "row",
    gap: 8,
  },
  hubDockButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(145, 174, 205, 0.22)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    paddingVertical: 9,
    alignItems: "center",
  },
  hubDockButtonActive: {
    flex: 1.15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(135, 198, 255, 0.42)",
    backgroundColor: "rgba(38, 93, 153, 0.22)",
    paddingVertical: 9,
    alignItems: "center",
  },
  hubDockIcon: {
    color: "#778BA4",
    fontSize: 10,
    fontWeight: "900",
  },
  hubDockIconActive: {
    color: "#98D8FF",
    fontSize: 10,
    fontWeight: "900",
  },
  hubDockText: {
    color: "#C7D8EA",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },
  hubDockTextActive: {
    color: "#EAF7FF",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },
  hubMapRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hubMapRailItem: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(164, 190, 225, 0.2)",
    backgroundColor: "rgba(10, 20, 34, 0.86)",
    padding: 11,
  },
  hubMapRailTitle: {
    color: "#EEF7FF",
    fontSize: 12,
    fontWeight: "900",
  },
  hubMapRailMeta: {
    color: "#95A9BF",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },
  topBar: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primaryButton: {
    minWidth: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3F6683",
    backgroundColor: "#14263A",
    paddingVertical: 4,
    alignItems: "center",
  },
  primaryButtonStart: {
    borderColor: "#86672A",
    backgroundColor: "#584118",
  },
  primaryButtonActive: {
    borderColor: "#4E83B5",
    backgroundColor: "#173755",
  },
  primaryButtonText: {
    color: "#F0F7FF",
    fontSize: 12,
    fontWeight: "800",
  },
  statusPill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#24405D",
    backgroundColor: "#0E1A28",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    color: "#BFD4F1",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  quickButton: {
    minWidth: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2D4E6B",
    backgroundColor: "#112133",
    paddingVertical: 4,
    alignItems: "center",
  },
  quickButtonActive: {
    borderColor: "#7FB8FF",
    backgroundColor: "#173653",
  },
  quickButtonText: {
    color: "#E6F1FF",
    fontSize: 11,
    fontWeight: "800",
  },
  overviewStrip: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#25425E",
    backgroundColor: "#0C1827",
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  overviewItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  overviewSymbol: {
    color: "#86A8CD",
    fontSize: 9,
    fontWeight: "800",
  },
  overviewValue: {
    color: "#EAF4FF",
    fontSize: 10.5,
    fontWeight: "800",
  },
  overviewDivider: {
    width: 1,
    height: 15,
    backgroundColor: "#243E58",
    marginHorizontal: 2,
  },
  resourceStrip: {
    marginTop: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#24405D",
    backgroundColor: "#0D1826",
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    gap: 8,
  },
  resourceItem: {
    flex: 1,
    gap: 3,
  },
  resourceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  resourceSymbol: {
    color: "#8CA8C8",
    fontSize: 11,
    fontWeight: "900",
  },
  resourceValue: {
    color: "#E7F0FF",
    fontSize: 10,
    fontWeight: "800",
  },
  resourceValueDanger: {
    color: "#FFD3C6",
  },
  resourceValueShield: {
    color: "#D1F8FF",
  },
  topHudRow: {
    marginTop: 2,
    flexDirection: "row",
    gap: 6,
  },
  meterRow: {
    marginTop: 4,
    flexDirection: "row",
    gap: 6,
  },
  statRow: {
    marginTop: 4,
    flexDirection: "row",
    gap: 6,
  },
  hudChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#213A56",
    backgroundColor: "#0D1826",
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
    color: "#7B92B0",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  hudValue: {
    marginTop: 1,
    color: "#EDF6FF",
    fontSize: 13,
    fontWeight: "800",
  },
  hudValueDanger: {
    color: "#FFAA91",
  },
  hudValueShield: {
    color: "#9DEBFF",
  },
  hudMeter: {
    height: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#30516F",
    backgroundColor: "#12253A",
    overflow: "hidden",
    justifyContent: "center",
  },
  hudMeterFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
  hudMeterFillHealth: {
    backgroundColor: "rgba(255, 145, 120, 0.36)",
  },
  hudMeterFillShield: {
    backgroundColor: "rgba(110, 234, 255, 0.34)",
  },
  hudMeterFillSalvage: {
    backgroundColor: "rgba(133, 176, 255, 0.38)",
  },
  hudMeterText: {
    color: "#E7F0FF",
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "center",
  },
  hudMeterTextDanger: {
    color: "#FFD3C6",
  },
  hudMeterTextShield: {
    color: "#D1F8FF",
  },
  statCard: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#24405D",
    backgroundColor: "#0E1A28",
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: "stretch",
    justifyContent: "center",
  },
  statLabel: {
    color: "#7D93B5",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },
  statValue: {
    color: "#BCD4F4",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
    textAlign: "center",
  },
  boardFrame: {
    flex: 1,
    marginTop: 4,
    position: "relative",
  },
  board: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#223852",
    backgroundColor: "#08131F",
  },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bgFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#08131E",
  },
  bgHazeTop: {
    position: "absolute",
    left: -40,
    top: -80,
    width: 260,
    height: 220,
    borderRadius: 200,
    backgroundColor: "rgba(255, 134, 190, 0.08)",
  },
  bgHazeBottom: {
    position: "absolute",
    right: -60,
    bottom: -120,
    width: 280,
    height: 240,
    borderRadius: 220,
    backgroundColor: "rgba(110, 234, 255, 0.06)",
  },
  enemyZoneFill: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 121, 183, 0.045)",
  },
  enemyZoneLine: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255, 184, 112, 0.28)",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(122, 149, 184, 0.12)",
  },
  boardAnnouncementWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "38%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  versionBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#284764",
    backgroundColor: "rgba(8, 19, 31, 0.84)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  versionBadgeText: {
    color: "#8BA9CB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  coachHintChip: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 86,
    zIndex: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(222, 243, 255, 0.42)",
    backgroundColor: "rgba(8, 18, 29, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: "#9ADFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  coachHintTitle: {
    color: "#F3FAFF",
    fontSize: 11.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coachHintBody: {
    marginTop: 3,
    color: "#BFD3E8",
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
  },
  boardAnnouncementGlow: {
    position: "absolute",
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
    color: "#F1F7FF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.8,
    textAlign: "center",
    textTransform: "uppercase",
  },
  sectorBannerWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 24,
    alignItems: "center",
    zIndex: 5,
  },
  sectorBannerCard: {
    minWidth: 220,
    maxWidth: 320,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  sectorBannerTitle: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectorBannerSubtitle: {
    marginTop: 2,
    color: "#DCEBFB",
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "center",
  },
  enemyLabelWrap: {
    position: "absolute",
    alignItems: "center",
  },
  enemyBody: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  enemyAura: {
    position: "absolute",
    borderWidth: 1.4,
  },
  enemyAuraElite: {
    borderColor: "rgba(203, 192, 255, 0.45)",
    backgroundColor: "rgba(177, 149, 255, 0.08)",
  },
  enemyAuraBoss: {
    borderColor: "rgba(255, 206, 171, 0.6)",
    backgroundColor: "rgba(255, 116, 173, 0.1)",
  },
  enemyWarningRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255, 234, 183, 0.88)",
  },
  enemyContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  enemyHealthText: {
    color: "#FBFEFF",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(5, 11, 20, 0.9)",
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
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(8, 19, 30, 0.52)",
  },
  enemyEliteMarker: {
    marginBottom: 2,
    flexDirection: "row",
    gap: 3,
  },
  enemyEliteSlash: {
    width: 3,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#F0E9FF",
    transform: [{ rotate: "18deg" }],
  },
  enemyOrbiterMarker: {
    marginBottom: 3,
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: "#E2FFF7",
    alignItems: "center",
    justifyContent: "center",
  },
  enemyOrbiterCore: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#F2FFF8",
  },
  enemySniperMarker: {
    marginBottom: 3,
    width: 16,
    height: 9,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: "#FFE4F1",
    alignItems: "center",
    justifyContent: "center",
  },
  enemySniperLens: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#FFF0F7",
  },
  enemyBossMarker: {
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  enemyBossPip: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#FFF5D2",
  },
  enemyBossPipWide: {
    width: 9,
  },
  playerProjectileShell: {
    position: "absolute",
    alignItems: "center",
  },
  playerProjectile: {
    borderWidth: 1,
    borderColor: "#FFF4CF",
  },
  enemyProjectile: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFEFD9",
  },
  dropToken: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#F8FCFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  dropLabel: {
    color: "#E9F5FF",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    textAlign: "center",
    textShadowColor: "rgba(4, 10, 18, 0.78)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  playerShell: {
    position: "absolute",
    width: 74,
    height: 62,
    alignItems: "center",
  },
  playerShellHit: {
    opacity: 0.82,
  },
  moveHintWrap: {
    position: "absolute",
    width: MOVE_HINT_DIAMETER,
    height: MOVE_HINT_DIAMETER,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  moveHintCircle: {
    width: MOVE_HINT_DIAMETER,
    height: MOVE_HINT_DIAMETER,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(221, 242, 255, 0.34)",
    backgroundColor: "rgba(16, 30, 45, 0.34)",
    alignItems: "center",
    justifyContent: "center",
  },
  moveHintPointerWrap: {
    width: 22,
    height: 22,
    transform: [{ rotate: "-18deg" }],
  },
  moveHintPointerHeadShadow: {
    position: "absolute",
    left: 4,
    top: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 0,
    borderRightWidth: 12,
    borderBottomWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(34, 52, 68, 0.88)",
  },
  moveHintPointerStemShadow: {
    position: "absolute",
    left: 7,
    top: 10,
    width: 6,
    height: 13,
    borderRadius: 3,
    backgroundColor: "rgba(34, 52, 68, 0.88)",
    transform: [{ rotate: "-34deg" }],
  },
  moveHintPointerHead: {
    position: "absolute",
    left: 5,
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 0,
    borderRightWidth: 10,
    borderBottomWidth: 15,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(239, 247, 255, 0.94)",
  },
  moveHintPointerStem: {
    position: "absolute",
    left: 8,
    top: 11,
    width: 5,
    height: 11,
    borderRadius: 3,
    backgroundColor: "rgba(228, 240, 250, 0.94)",
    transform: [{ rotate: "-34deg" }],
  },
  playerWingPlateLeft: {
    position: "absolute",
    left: 11,
    top: 30,
    width: 18,
    height: 10,
    borderRadius: 4,
    borderWidth: 1.1,
    transform: [{ rotate: "-44deg" }],
  },
  playerWingPlateRight: {
    position: "absolute",
    right: 11,
    top: 30,
    width: 18,
    height: 10,
    borderRadius: 4,
    borderWidth: 1.1,
    transform: [{ rotate: "44deg" }],
  },
  playerFuselage: {
    width: 24,
    height: 38,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: "#5BDDF9",
    borderWidth: 1.1,
    borderColor: "#E9FCFF",
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  playerFuselagePanel: {
    position: "absolute",
    left: 3,
    right: 3,
    top: 11,
    bottom: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  playerFuselageStripeLeft: {
    position: "absolute",
    left: 3,
    top: 13,
    width: 2,
    height: 17,
    borderRadius: 2,
  },
  playerFuselageStripeRight: {
    position: "absolute",
    right: 3,
    top: 13,
    width: 2,
    height: 17,
    borderRadius: 2,
  },
  playerCanopy: {
    marginTop: 4,
    width: 10,
    height: 17,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: "#FFF0CA",
    borderWidth: 1,
    borderColor: "#FFF9EA",
  },
  playerCanopyCore: {
    position: "absolute",
    top: 8,
    width: 2,
    height: 10,
    borderRadius: 2,
  },
  playerSpine: {
    marginTop: 4,
    width: 4,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#218EC0",
  },
  playerIntakeLeft: {
    position: "absolute",
    left: 3,
    bottom: 7,
    width: 4,
    height: 7,
    borderRadius: 2,
  },
  playerIntakeRight: {
    position: "absolute",
    right: 3,
    bottom: 7,
    width: 4,
    height: 7,
    borderRadius: 2,
  },
  playerNoseShadow: {
    position: "absolute",
    top: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 19,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#10233B",
  },
  playerNose: {
    position: "absolute",
    top: -11,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFE7B0",
  },
  playerNoseCore: {
    position: "absolute",
    top: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#AEEBFF",
  },
  playerWingBaseLeft: {
    position: "absolute",
    left: 7,
    top: 24,
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 8,
    borderRightWidth: 22,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#2D79BD",
    transform: [{ rotate: "-34deg" }],
  },
  playerWingBaseRight: {
    position: "absolute",
    right: 7,
    top: 24,
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 8,
    borderLeftWidth: 22,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#2D79BD",
    transform: [{ rotate: "34deg" }],
  },
  playerWingTipLeft: {
    position: "absolute",
    left: 5,
    top: 41,
    width: 12,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: "48deg" }],
  },
  playerWingTipRight: {
    position: "absolute",
    right: 5,
    top: 41,
    width: 12,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: "-48deg" }],
  },
  playerRearFinLeft: {
    position: "absolute",
    left: 21,
    bottom: 12,
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#2D79BD",
    transform: [{ rotate: "38deg" }],
  },
  playerRearFinRight: {
    position: "absolute",
    right: 21,
    bottom: 12,
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#2D79BD",
    transform: [{ rotate: "-38deg" }],
  },
  playerEnginePodLeft: {
    position: "absolute",
    left: 22,
    bottom: 7,
    width: 7,
    height: 15,
    borderRadius: 3,
    borderWidth: 1,
  },
  playerEnginePodRight: {
    position: "absolute",
    right: 22,
    bottom: 7,
    width: 7,
    height: 15,
    borderRadius: 3,
    borderWidth: 1,
  },
  playerEngineLeft: {
    position: "absolute",
    left: 23.5,
    bottom: 1,
    width: 4,
    height: 11,
    borderRadius: 2,
    backgroundColor: "#FFDCA1",
  },
  playerEngineRight: {
    position: "absolute",
    right: 23.5,
    bottom: 1,
    width: 4,
    height: 11,
    borderRadius: 2,
    backgroundColor: "#FFDCA1",
  },
  effectMuzzle: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFF6D6",
  },
  effectBurst: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
  },
  effectWarning: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
  },
  effectShield: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
  },
  bottomGlow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    height: 88,
    borderRadius: 999,
    backgroundColor: "rgba(110, 234, 255, 0.08)",
  },
  armoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 16,
    backgroundColor: "rgba(4, 10, 18, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  armoryPanel: {
    width: "100%",
    maxWidth: 380,
    height: "84%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#37536F",
    backgroundColor: "#0E1826",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  armoryHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  armoryHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  armoryTitle: {
    color: "#F5FAFF",
    fontSize: 17,
    fontWeight: "900",
  },
  armorySubtitle: {
    color: "#8FB2D4",
    fontSize: 11,
    fontWeight: "700",
  },
  armoryPrompt: {
    color: "#B9CCDF",
    fontSize: 11.5,
    lineHeight: 16,
  },
  armoryCloseButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#36526F",
    backgroundColor: "#122133",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  armoryCloseButtonText: {
    color: "#E8F2FF",
    fontSize: 11,
    fontWeight: "800",
  },
  armoryCountChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B6B8A",
    backgroundColor: "#102233",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  armoryCountChipText: {
    color: "#D9ECFF",
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  armoryOptionsScroll: {
    flex: 1,
  },
  armoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 4,
  },
  armoryCard: {
    width: "48%",
    minHeight: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#385470",
    backgroundColor: "#132131",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    position: "relative",
  },
  armoryCardDisabled: {
    borderColor: "#29415B",
    backgroundColor: "#101B2A",
    opacity: 0.85,
  },
  armoryCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  armoryCardIcon: {
    color: "#BFD6F2",
    fontSize: 12,
    fontWeight: "900",
  },
  armoryCardStat: {
    color: "#DFF1FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  armoryCardStatDisabled: {
    color: "#8FA7C1",
  },
  armoryCardLabel: {
    color: "#F3F8FF",
    fontSize: 12,
    fontWeight: "800",
  },
  armoryCardLabelDisabled: {
    color: "#A8BAD0",
  },
  armoryCardText: {
    color: "#B4C7DB",
    fontSize: 10.5,
    lineHeight: 14,
  },
  armoryCardTextDisabled: {
    color: "#7F96AF",
  },
  armoryCardMaxBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#6C8AA8",
    backgroundColor: "rgba(15, 30, 47, 0.92)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 2,
  },
  armoryCardMaxBadgeText: {
    color: "#D2E5FA",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  armoryTabRow: {
    flexDirection: "row",
    gap: 8,
  },
  armoryTabButton: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#304A66",
    backgroundColor: "#0E1826",
    paddingVertical: 7,
    alignItems: "center",
  },
  armoryTabButtonActive: {
    borderColor: "#7FBFFF",
    backgroundColor: "#173654",
  },
  armoryTabText: {
    color: "#7FA8C9",
    fontSize: 11.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  armoryTabTextActive: {
    color: "#F1F8FF",
  },
  menuPanel: {
    position: "absolute",
    top: 56,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#294563",
    backgroundColor: "rgba(9, 17, 26, 0.96)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  menuTitle: {
    color: "#F3F9FF",
    fontSize: 16,
    fontWeight: "900",
  },
  menuSegmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  menuSegmentButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#304A66",
    backgroundColor: "#10202F",
    paddingVertical: 6,
    alignItems: "center",
  },
  menuSegmentButtonActive: {
    borderColor: "#8BC5FF",
    backgroundColor: "#173654",
  },
  menuSegmentText: {
    color: "#9FB9D7",
    fontSize: 11.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  menuSegmentTextActive: {
    color: "#F1F8FF",
  },
  menuLabel: {
    color: "#8DA8C8",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    gap: 10,
    paddingBottom: 2,
  },
  menuRow: {
    flexDirection: "row",
    gap: 8,
  },
  menuBuildGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  menuBuildButton: {
    width: "48%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#355471",
    backgroundColor: "#122132",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  menuBuildButtonActive: {
    borderColor: "#8BC5FF",
    backgroundColor: "#163049",
  },
  menuBuildTitle: {
    color: "#EAF4FF",
    fontSize: 12,
    fontWeight: "800",
  },
  menuBuildText: {
    color: "#9EB9D8",
    fontSize: 10.5,
    lineHeight: 14,
  },
  menuButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#37516F",
    backgroundColor: "#122131",
    paddingVertical: 9,
    alignItems: "center",
  },
  menuButtonActive: {
    borderColor: "#8FC1FF",
    backgroundColor: "#1B3651",
  },
  menuButtonText: {
    color: "#E9F3FF",
    fontSize: 12,
    fontWeight: "700",
  },
  tipStatusCard: {
    flex: 1.4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2F4A66",
    backgroundColor: "#0E1D2B",
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  tipStatusText: {
    color: "#AFC4DC",
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
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
    color: "#DCEBFA",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  audioControlValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  audioControlValue: {
    color: "#F1F8FF",
    fontSize: 11.5,
    fontWeight: "900",
  },
  audioAdjustButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3A5570",
    backgroundColor: "#122233",
    alignItems: "center",
    justifyContent: "center",
  },
  audioAdjustButtonText: {
    color: "#F0F8FF",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },
  menuBuildDetails: {
    gap: 8,
  },
  menuBuildDetailsCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#304A66",
    backgroundColor: "#0E1D2D",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  menuBuildDetailsTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  menuBuildDetailsText: {
    color: "#A9BEDA",
    fontSize: 11.5,
    lineHeight: 16,
  },
  runStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  runStatCell: {
    minWidth: 64,
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  runStatValue: {
    color: "#F1F8FF",
    fontSize: 14,
    fontWeight: "800",
  },
  runStatLabel: {
    color: "#6B8DB5",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 1,
  },
  menuActions: {
    flexDirection: "row",
    gap: 10,
  },
  menuActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  menuActionPrimary: {
    borderColor: "#59864A",
    backgroundColor: "#18301A",
  },
  menuActionSecondary: {
    borderColor: "#355271",
    backgroundColor: "#122033",
  },
  menuActionText: {
    color: "#F0F7FF",
    fontSize: 13,
    fontWeight: "800",
  },
  codexGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  codexCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33526F",
    backgroundColor: "#0F1E2E",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 5,
  },
  codexCardLocked: {
    borderColor: "#293F57",
    backgroundColor: "#0C1723",
  },
  codexCardHeader: {
    gap: 3,
  },
  codexCardTitle: {
    color: "#F0F7FF",
    fontSize: 12,
    fontWeight: "800",
  },
  codexCardTitleLocked: {
    color: "#A3B7CB",
  },
  codexCardMeta: {
    color: "#7F9EBC",
    fontSize: 10,
    fontWeight: "700",
  },
  codexCardText: {
    color: "#B3C7DB",
    fontSize: 10.5,
    lineHeight: 14,
  },
  codexCardTextLocked: {
    color: "#7D93A9",
  },
  codexStatRow: {
    gap: 3,
  },
  codexStatText: {
    color: "#D8E7F7",
    fontSize: 10,
    fontWeight: "700",
  },
  unlockChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    borderColor: "#4C7AA0",
    backgroundColor: "#112335",
  },
  unlockChipLocked: {
    borderColor: "#29435B",
    backgroundColor: "#0B1622",
  },
  unlockChipLabel: {
    color: "#EAF4FF",
    fontSize: 10,
    fontWeight: "800",
  },
  unlockChipLabelLocked: {
    color: "#9BB3C9",
  },
  unlockChipMeta: {
    color: "#87A0B9",
    fontSize: 9.5,
    lineHeight: 12,
  },
  masteryIntroCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#32506B",
    backgroundColor: "#10202F",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  masteryIntroText: {
    color: "#B5C9DE",
    fontSize: 11,
    lineHeight: 16,
  },
  masteryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#34536F",
    backgroundColor: "#102030",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  masteryCardActive: {
    borderColor: "#7FBFFF",
    backgroundColor: "#13273A",
  },
  masteryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  masteryHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  masteryTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  masterySubtitle: {
    color: "#BDD0E3",
    fontSize: 10.5,
    fontWeight: "700",
  },
  masteryXpText: {
    color: "#E8F3FF",
    fontSize: 11,
    fontWeight: "800",
  },
  masteryMeter: {
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#33506B",
    backgroundColor: "#0C1926",
    overflow: "hidden",
  },
  masteryMeterFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  masteryThresholdText: {
    color: "#9AB3CD",
    fontSize: 10,
    fontWeight: "700",
  },
  masteryStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  masteryStatText: {
    color: "#D9E8F7",
    fontSize: 10,
    fontWeight: "700",
  },
  lossTransitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(4, 8, 15, 0.28)",
    gap: 6,
    overflow: "hidden",
    paddingHorizontal: 18,
  },
  lossTransitionCurtain: {
    position: "absolute",
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(4, 8, 15, 0.88)",
  },
  lossTransitionCurtainTop: {
    top: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(222, 240, 255, 0.18)",
  },
  lossTransitionCurtainBottom: {
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(222, 240, 255, 0.18)",
  },
  lossTransitionGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  lossTransitionBeam: {
    position: "absolute",
    width: 18,
    top: "22%",
    bottom: "22%",
    borderRadius: 999,
  },
  lossTransitionTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  lossTransitionSubtitle: {
    color: "#D8E7F8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 10, 18, 0.66)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  playerCrestWrap: {
    position: "absolute",
    left: 30,
    top: 19,
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuSegmentBadge: {
    position: "absolute",
    top: 5,
    right: 7,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F7FBFF",
    backgroundColor: "rgba(18, 40, 58, 0.96)",
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  menuSegmentBadgeText: {
    color: "#F4FBFF",
    fontSize: 9.5,
    fontWeight: "900",
  },
  menuBuildTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  menuBuildDetailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  metaShowcaseCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  metaShowcaseBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 12,
  },
  metaShowcaseGlow: {
    position: "absolute",
    left: -20,
    right: -20,
    bottom: -26,
    height: 80,
    borderRadius: 999,
  },
  metaShowcaseContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaShowcaseCopy: {
    flex: 1,
    gap: 4,
  },
  metaShowcaseTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  metaShowcaseSubtitle: {
    color: "#E0EEFF",
    fontSize: 11,
    fontWeight: "800",
  },
  metaShowcaseNote: {
    color: "#BFD4EA",
    fontSize: 10.5,
    lineHeight: 15,
  },
  metaShowcaseCrestWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionNoticeCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#34536F",
    backgroundColor: "#0F2031",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collectionNoticeText: {
    color: "#DCEBFA",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  collectionSectionLabel: {
    color: "#9DB6D0",
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  collectionBuildPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  collectionBuildPill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#304A66",
    backgroundColor: "#10202F",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  collectionBuildPillActive: {
    borderColor: "#7FBFFF",
    backgroundColor: "#173654",
  },
  collectionBuildPillText: {
    color: "#9FB9D7",
    fontSize: 11,
    fontWeight: "800",
  },
  collectionBuildPillTextActive: {
    color: "#F1F8FF",
  },
  collectionCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  collectionCardLabel: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  collectionCardMeta: {
    color: "#9AB3CC",
    fontSize: 10,
    fontWeight: "800",
  },
  collectionCardText: {
    color: "#C5D6E7",
    fontSize: 10.5,
    lineHeight: 14,
  },
  collectionCardAction: {
    marginTop: 2,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionCardActionDisabled: {
    borderColor: "#33485D",
    backgroundColor: "#132130",
    opacity: 0.9,
  },
  collectionCardActionText: {
    color: "#F0F8FF",
    fontSize: 10.5,
    fontWeight: "900",
  },
  collectionPreviewBanner: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  collectionPreviewBannerBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 12,
  },
  collectionPreviewBannerCore: {
    position: "absolute",
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  collectionPreviewAccentWing: {
    position: "absolute",
    top: 17,
    width: 14,
    height: 7,
    borderRadius: 7,
  },
  collectionPreviewAccentWingLeft: {
    left: 18,
    transform: [{ rotate: "-15deg" }],
  },
  collectionPreviewAccentWingRight: {
    right: 18,
    transform: [{ rotate: "15deg" }],
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
    alignItems: "center",
    justifyContent: "center",
  },
  gameOverModal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#385978",
    backgroundColor: "#0E1826",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  gameOverTitle: {
    color: "#FFF2E9",
    fontSize: 20,
    fontWeight: "900",
  },
  gameOverText: {
    color: "#BFD0E5",
    fontSize: 13,
    lineHeight: 19,
  },
  gameOverNoticeText: {
    color: "#DDEBFA",
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "700",
  },
  runSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  runSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  runSummaryTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  runSummaryTierText: {
    color: "#F2F8FF",
    fontSize: 12,
    fontWeight: "900",
  },
  runSummaryText: {
    color: "#D9E8F7",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  sideControlButton: {
    position: "absolute",
    width: 64,
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#385673",
    backgroundColor: "rgba(10, 20, 30, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 6,
    shadowColor: "#9FD7FF",
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
    shadowColor: "#96D2FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  armoryButtonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#8BCBFF",
  },
  armoryButtonCoreGlow: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "rgba(170, 228, 255, 0.86)",
  },
  armoryButtonPulseRing: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D9F5FF",
  },
  sideControlBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D8F2FF",
    backgroundColor: "rgba(12, 32, 48, 0.94)",
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  sideControlBadgeText: {
    color: "#F1FBFF",
    fontSize: 10,
    fontWeight: "900",
  },
  armoryIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  armorySword: {
    position: "absolute",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  armorySwordLeft: {
    transform: [{ rotate: "-44deg" }],
  },
  armorySwordRight: {
    transform: [{ rotate: "44deg" }],
  },
  armorySwordBlade: {
    width: 4,
    height: 15,
    borderRadius: 4,
    backgroundColor: "#EFF9FF",
    borderWidth: 1,
    borderColor: "#BDE1FF",
  },
  armorySwordGuard: {
    marginTop: 1,
    width: 11,
    height: 3,
    borderRadius: 3,
    backgroundColor: "#D7A767",
  },
  armorySwordGrip: {
    marginTop: 1,
    width: 3,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#5A84A6",
  },
  armorySwordPommel: {
    marginTop: 1,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#BFDFFF",
  },
  shieldAbilityIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  shieldAbilityArc: {
    position: "absolute",
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "rgba(176, 230, 255, 0.56)",
  },
  shieldAbilityArcActive: {
    borderColor: "#E8FBFF",
    backgroundColor: "rgba(122, 224, 255, 0.16)",
  },
  shieldAbilityArcReady: {
    borderColor: "#BFF8FF",
  },
  shieldAbilityCore: {
    width: 17,
    height: 21,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#ECFBFF",
    overflow: "hidden",
    backgroundColor: "rgba(9, 30, 42, 0.8)",
  },
  shieldAbilityCoreFill: {
    flex: 1,
    backgroundColor: "#BFF8FF",
  },
  shieldAbilitySpark: {
    position: "absolute",
    bottom: 3,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(188, 242, 255, 0.42)",
  },
  shieldAbilitySparkReady: {
    backgroundColor: "#F8FEFF",
  },
  ultimateButton: {
    justifyContent: "center",
  },
  ultimateButtonReady: {
    borderColor: "#FFE2A8",
    backgroundColor: "rgba(56, 40, 14, 0.94)",
  },
  ultimateButtonMeter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    backgroundColor: "rgba(23, 41, 60, 0.66)",
  },
  ultimateButtonFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 192, 96, 0.54)",
  },
  ultimateReadyGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFD285",
  },
  ultimateIconWrap: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  ultimateIconBlade: {
    position: "absolute",
    width: 5,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#E9F5FF",
    transform: [{ rotate: "0deg" }],
  },
  ultimateIconBladeReady: {
    backgroundColor: "#FFF1C8",
  },
  ultimateIconSlash: {
    position: "absolute",
    width: 4,
    height: 15,
    borderRadius: 2,
    backgroundColor: "#CDE2F7",
  },
  ultimateIconSlashReady: {
    backgroundColor: "#FFE3AA",
  },
  ultimateIconRing: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D4E6F8",
    backgroundColor: "rgba(11, 23, 35, 0.34)",
  },
  ultimateIconRingReady: {
    borderColor: "#FFE6B3",
    backgroundColor: "rgba(58, 41, 12, 0.32)",
  },
  ultimateIconDiamond: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#E8F5FF",
    backgroundColor: "rgba(14, 26, 40, 0.44)",
    transform: [{ rotate: "45deg" }],
  },
  ultimateIconDiamondReady: {
    borderColor: "#FFEABA",
    backgroundColor: "rgba(72, 50, 16, 0.42)",
  },
  ultimateIconCore: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 1,
    backgroundColor: "#EDF7FF",
    transform: [{ rotate: "45deg" }],
  },
  ultimateIconCoreReady: {
    backgroundColor: "#FFF0CA",
  },
});
