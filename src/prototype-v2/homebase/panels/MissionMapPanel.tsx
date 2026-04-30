import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';

import {
  ARENA_CAMPAIGN_MISSIONS,
  ARENA_CAMPAIGN_MISSION_ORDER,
  isCampaignMissionUnlocked,
} from '../../campaign';
import type { ArenaCampaignMissionId, ArenaCampaignMissionProgress, ArenaMetaState } from '../../types';
import { hubStyles } from '../homebaseStyles';

const MISSION_GRADIENT_COLORS: Record<ArenaCampaignMissionId, [string, string]> = {
  prismVergeRecon:   ['#1A0838', '#0C1E3A'],
  hiveForgeAssault:  ['#1A1408', '#1A2C0A'],
  vectorSpindlePurge:['#06141A', '#062230'],
  eclipseEdgeBreak:  ['#1A0614', '#100A20'],
  nexusGateSiege:    ['#0A100A', '#0E1A24'],
};

const MISSION_ACCENT_COLORS: Record<ArenaCampaignMissionId, string> = {
  prismVergeRecon:   '#A78BFA',
  hiveForgeAssault:  '#FBBF24',
  vectorSpindlePurge:'#22D3EE',
  eclipseEdgeBreak:  '#F472B6',
  nexusGateSiege:    '#4ADE80',
};

type Props = {
  arenaMeta: ArenaMetaState;
  onLaunchMission: (missionId: ArenaCampaignMissionId) => void;
};

export function MissionMapPanel({ arenaMeta, onLaunchMission }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const missionProgress = arenaMeta.campaign.missionProgress;
  const activeMissionId = ARENA_CAMPAIGN_MISSION_ORDER[activeIndex];
  const isUnlocked = isCampaignMissionUnlocked(activeMissionId, missionProgress);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderItem = ({ item: missionId }: ListRenderItemInfo<ArenaCampaignMissionId>) => {
    const mission = ARENA_CAMPAIGN_MISSIONS[missionId];
    const progress: ArenaCampaignMissionProgress | undefined = missionProgress[missionId];
    const unlocked = isCampaignMissionUnlocked(missionId, missionProgress);
    const [gradFrom, gradTo] = MISSION_GRADIENT_COLORS[missionId];
    const accent = MISSION_ACCENT_COLORS[missionId];
    const bestTier = progress?.bestTier ?? 1;
    const completed = progress?.completed ?? false;

    return (
      <View style={{ width: '100%', height: '100%' }}>
        <View style={hubStyles.missionCard}>
          {/* Skia gradient background */}
          <Canvas style={hubStyles.missionCardBg}>
            <Rect x={0} y={0} width={1000} height={1000}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, 600)}
                colors={[gradFrom, gradTo]}
              />
            </Rect>
          </Canvas>

          {/* Decorative accent line */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: accent,
              opacity: 0.8,
            }}
          />

          <View style={hubStyles.missionCardContent}>
            <Text style={hubStyles.missionCardZone}>{mission.zoneLabel}</Text>
            <Text style={hubStyles.missionCardTitle}>{mission.label}</Text>
            <Text style={hubStyles.missionCardSummary}>{mission.summary}</Text>

            <View style={hubStyles.missionCardStats}>
              <View style={hubStyles.missionStatPill}>
                <Text style={hubStyles.missionStatLabel}>TIERS</Text>
                <Text style={[hubStyles.missionStatValue, { color: accent }]}>
                  T{mission.biomeTier}–T{mission.targetTier}
                </Text>
              </View>
              <View style={hubStyles.missionStatPill}>
                <Text style={hubStyles.missionStatLabel}>BOSS</Text>
                <Text style={hubStyles.missionStatValue}>{mission.bossLabel}</Text>
              </View>
              <View style={hubStyles.missionStatPill}>
                <Text style={hubStyles.missionStatLabel}>BEST</Text>
                <Text style={hubStyles.missionStatValue}>T{bestTier}</Text>
              </View>
              <View style={hubStyles.missionStatPill}>
                <Text style={hubStyles.missionStatLabel}>REWARD</Text>
                <Text style={hubStyles.missionStatValue}>{mission.rewardXp} XP</Text>
              </View>
            </View>

            {completed ? (
              <View
                style={{
                  marginTop: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: 'rgba(74,222,128,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(74,222,128,0.35)',
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#4ADE80' }}>
                  COMPLETED
                </Text>
              </View>
            ) : null}
          </View>

          {!unlocked ? (
            <View style={hubStyles.missionCardLockOverlay}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🔒</Text>
              <Text style={hubStyles.missionCardLockText}>
                Complete{' '}
                {ARENA_CAMPAIGN_MISSIONS[
                  ARENA_CAMPAIGN_MISSION_ORDER[
                    ARENA_CAMPAIGN_MISSION_ORDER.indexOf(missionId) - 1
                  ]
                ]?.label ?? 'previous mission'}{' '}
                to unlock
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={ARENA_CAMPAIGN_MISSION_ORDER}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={hubStyles.missionCarousel}
      />

      {/* Page dots */}
      <View style={hubStyles.missionPageDots}>
        {ARENA_CAMPAIGN_MISSION_ORDER.map((id, index) => (
          <View
            key={id}
            style={[
              hubStyles.missionPageDot,
              index === activeIndex && hubStyles.missionPageDotActive,
            ]}
          />
        ))}
      </View>

      {/* Launch CTA */}
      <Pressable
        style={[
          hubStyles.primaryAction,
          { marginHorizontal: 14, marginBottom: 14 },
          !isUnlocked && hubStyles.actionDisabled,
        ]}
        disabled={!isUnlocked}
        onPress={() => onLaunchMission(activeMissionId)}
      >
        <Text style={hubStyles.primaryActionText}>
          {isUnlocked ? `Launch  ${ARENA_CAMPAIGN_MISSIONS[activeMissionId].label}` : 'Mission Locked'}
        </Text>
      </Pressable>
    </View>
  );
}
