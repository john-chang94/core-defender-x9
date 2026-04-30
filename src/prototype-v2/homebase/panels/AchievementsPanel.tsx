import { ScrollView, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

import { ARENA_BUILD_ORDER } from '../../builds';
import { ARENA_ENEMY_ORDER } from '../../config';
import { ARENA_ENEMY_LABELS } from '../../meta';
import type { ArenaMetaState } from '../../types';
import { HUB_TEXT_DIM, hubStyles } from '../homebaseStyles';

type Challenge = {
  id: string;
  label: string;
  description: string;
  progress: number;
  total: number;
  completed: boolean;
  color: string;
  seasonXp: number;
};

function buildChallenges(arenaMeta: ArenaMetaState): Challenge[] {
  const { campaign, mastery, codexEnemies } = arenaMeta;
  const missionOrder = ['prismVergeRecon', 'hiveForgeAssault', 'vectorSpindlePurge', 'eclipseEdgeBreak', 'nexusGateSiege'] as const;
  const completedMissions = missionOrder.filter(
    (id) => campaign.missionProgress[id]?.completed ?? false,
  ).length;
  const bestEndlessTier = Math.max(...ARENA_BUILD_ORDER.map((b) => mastery[b].bestTier));
  const discoveredCount = ARENA_ENEMY_ORDER.filter((k) => codexEnemies[k].discovered).length;
  const bossKinds = ['prismBoss', 'hiveCarrierBoss', 'vectorLoomBoss', 'eclipseTalonBoss'] as const;
  const bossesCleared = bossKinds.filter((k) => codexEnemies[k].bossClears > 0).length;
  const maxMasteryLevel = Math.max(...ARENA_BUILD_ORDER.map((b) => mastery[b].level));

  return [
    {
      id: 'campaign_complete',
      label: 'Campaign Complete',
      description: 'Clear all 5 campaign missions',
      progress: completedMissions,
      total: 5,
      completed: completedMissions >= 5,
      color: '#F97316',
      seasonXp: 200,
    },
    {
      id: 'campaign_first',
      label: 'First Contact',
      description: 'Clear the first campaign mission',
      progress: Math.min(1, completedMissions),
      total: 1,
      completed: completedMissions >= 1,
      color: '#A78BFA',
      seasonXp: 50,
    },
    {
      id: 'boss_all',
      label: 'Boss Hunter',
      description: 'Defeat all 4 rotating bosses at least once',
      progress: bossesCleared,
      total: 4,
      completed: bossesCleared >= 4,
      color: '#FBBF24',
      seasonXp: 150,
    },
    {
      id: 'tier_30',
      label: 'Endless Pioneer',
      description: 'Reach Tier 30 in Endless mode',
      progress: Math.min(bestEndlessTier, 30),
      total: 30,
      completed: bestEndlessTier >= 30,
      color: '#22D3EE',
      seasonXp: 100,
    },
    {
      id: 'tier_45',
      label: 'Deep Run',
      description: 'Reach Tier 45 in Endless mode',
      progress: Math.min(bestEndlessTier, 45),
      total: 45,
      completed: bestEndlessTier >= 45,
      color: '#60A5FA',
      seasonXp: 150,
    },
    {
      id: 'tier_60',
      label: 'Outer Limit',
      description: 'Reach Tier 60 in Endless mode',
      progress: Math.min(bestEndlessTier, 60),
      total: 60,
      completed: bestEndlessTier >= 60,
      color: '#818CF8',
      seasonXp: 250,
    },
    {
      id: 'codex_complete',
      label: 'Threat Cartographer',
      description: `Discover all ${ARENA_ENEMY_ORDER.length} enemy types`,
      progress: discoveredCount,
      total: ARENA_ENEMY_ORDER.length,
      completed: discoveredCount >= ARENA_ENEMY_ORDER.length,
      color: '#2DD4BF',
      seasonXp: 120,
    },
    {
      id: 'mastery_10',
      label: 'Zenith',
      description: 'Reach mastery rank 10 with any build',
      progress: Math.min(maxMasteryLevel, 10),
      total: 10,
      completed: maxMasteryLevel >= 10,
      color: '#4ADE80',
      seasonXp: 200,
    },
  ];
}

function BadgeShape({ color, earned, size = 44 }: { color: string; earned: boolean; size?: number }) {
  const path = Skia.Path.Make();
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * (Math.PI / 180);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.close();

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path
        path={path}
        color={earned ? color : '#1C2C40'}
        style="fill"
      />
      <Path
        path={path}
        color={earned ? color : '#2A3C50'}
        style="stroke"
        strokeWidth={1.5}
      />
    </Canvas>
  );
}

type Props = {
  arenaMeta: ArenaMetaState;
};

export function AchievementsPanel({ arenaMeta }: Props) {
  const challenges = buildChallenges(arenaMeta);
  const completedCount = challenges.filter((c) => c.completed).length;
  const seasonPass = arenaMeta.seasonPass;

  return (
    <ScrollView
      style={hubStyles.panelScroll}
      contentContainerStyle={hubStyles.panelScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Season Pass status */}
      <View style={hubStyles.card}>
        <View style={hubStyles.cardHeader}>
          <Text style={hubStyles.cardTitle}>Season Pass</Text>
          <View style={hubStyles.cardBadge}>
            <Text style={hubStyles.cardBadgeText}>Tier {seasonPass.tier}</Text>
          </View>
        </View>
        <Text style={hubStyles.cardMeta}>
          {seasonPass.xp} XP · {challenges.filter((c) => c.completed).length}/{challenges.length} challenges complete
        </Text>
        <View style={hubStyles.progressTrack}>
          <View
            style={[
              hubStyles.progressFill,
              {
                width: `${((seasonPass.xp % 500) / 500) * 100}%`,
                backgroundColor: '#F97316',
              },
            ]}
          />
        </View>
        <Text style={[hubStyles.cardMeta, { marginTop: 4, color: HUB_TEXT_DIM }]}>
          Complete challenges to earn season XP
        </Text>
      </View>

      {/* Badge grid */}
      <View style={hubStyles.sectionHeader}>
        <Text style={hubStyles.sectionTitle}>Badges</Text>
        <View style={hubStyles.sectionLine} />
        <Text style={{ fontSize: 11, color: '#4ADE80' }}>
          {completedCount}/{challenges.length}
        </Text>
      </View>

      <View style={hubStyles.badgeGrid}>
        {challenges.map((challenge) => (
          <View key={challenge.id} style={{ alignItems: 'center', width: 68 }}>
            <View style={[
              hubStyles.badgeCell,
              challenge.completed && hubStyles.badgeCellEarned,
            ]}>
              <BadgeShape
                color={challenge.color}
                earned={challenge.completed}
                size={40}
              />
            </View>
            <Text
              style={[
                hubStyles.badgeLabel,
                challenge.completed && hubStyles.badgeLabelEarned,
              ]}
              numberOfLines={2}
            >
              {challenge.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Challenge list */}
      <View style={[hubStyles.sectionHeader, { marginTop: 20 }]}>
        <Text style={hubStyles.sectionTitle}>Challenges</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      {challenges.map((challenge) => (
        <View
          key={challenge.id}
          style={[
            hubStyles.card,
            challenge.completed && { borderColor: challenge.color + '40' },
          ]}
        >
          <View style={hubStyles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: challenge.completed ? challenge.color : '#1C2C40',
                }}
              />
              <Text style={[hubStyles.cardTitle, { flex: 1 }]}>{challenge.label}</Text>
            </View>
            <Text style={{ fontSize: 10, color: challenge.completed ? '#4ADE80' : HUB_TEXT_DIM }}>
              {challenge.seasonXp} XP
            </Text>
          </View>
          <Text style={hubStyles.cardMeta}>{challenge.description}</Text>
          <Text style={[hubStyles.cardMeta, { marginTop: 3, color: HUB_TEXT_DIM }]}>
            {challenge.progress} / {challenge.total}
          </Text>
          <View style={hubStyles.progressTrack}>
            <View
              style={[
                hubStyles.progressFill,
                {
                  width: `${Math.min(1, challenge.progress / challenge.total) * 100}%`,
                  backgroundColor: challenge.color,
                  opacity: challenge.completed ? 1 : 0.6,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
