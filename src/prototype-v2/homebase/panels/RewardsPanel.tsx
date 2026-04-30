import { Pressable, ScrollView, Text, View } from 'react-native';

import { ARENA_COSMETIC_ORDER, getArenaCosmeticDefinition } from '../../cosmetics';
import type { ArenaCosmeticId, ArenaMetaState } from '../../types';
import { hubStyles } from '../homebaseStyles';

type Props = {
  arenaMeta: ArenaMetaState;
  onClaimCosmetic: (id: ArenaCosmeticId) => void;
  onClaimAll: () => void;
};

export function RewardsPanel({ arenaMeta, onClaimCosmetic, onClaimAll }: Props) {
  const claimableIds = ARENA_COSMETIC_ORDER.filter(
    (id) => arenaMeta.cosmetics[id].state === 'claimable',
  );

  return (
    <ScrollView
      style={hubStyles.panelScroll}
      contentContainerStyle={hubStyles.panelScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={hubStyles.sectionHeader}>
        <Text style={hubStyles.sectionTitle}>Claimable Rewards</Text>
        <View style={hubStyles.sectionLine} />
        <Text style={{ fontSize: 11, color: claimableIds.length > 0 ? '#FBBF24' : '#3A5068' }}>
          {claimableIds.length}
        </Text>
      </View>

      {claimableIds.length <= 0 ? (
        <View style={[hubStyles.card, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={{ fontSize: 28, marginBottom: 8 }}>📭</Text>
          <Text style={hubStyles.cardTitle}>No rewards waiting</Text>
          <Text style={hubStyles.cardMeta}>
            Clear campaign missions, reach tier milestones, and defeat bosses to earn cosmetics.
          </Text>
        </View>
      ) : (
        <>
          {claimableIds.map((cosmeticId) => {
            const definition = getArenaCosmeticDefinition(cosmeticId);
            return (
              <View key={cosmeticId} style={hubStyles.card}>
                <View style={hubStyles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={[
                        hubStyles.cosmeticColorDot,
                        { backgroundColor: definition.primaryColor, width: 32, height: 32, borderRadius: 16 },
                      ]}
                    />
                    <View>
                      <Text style={hubStyles.cardTitle}>{definition.label}</Text>
                      <Text style={hubStyles.cardMeta}>{definition.description}</Text>
                    </View>
                  </View>
                  <View style={[hubStyles.cardBadge, { backgroundColor: '#0D1E1A' }]}>
                    <Text style={[hubStyles.cardBadgeText, { color: '#4ADE80' }]}>READY</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => onClaimCosmetic(cosmeticId)}
                  style={hubStyles.primaryAction}
                >
                  <Text style={hubStyles.primaryActionText}>Claim</Text>
                </Pressable>
              </View>
            );
          })}

          {claimableIds.length > 1 ? (
            <Pressable onPress={onClaimAll} style={hubStyles.secondaryAction}>
              <Text style={hubStyles.secondaryActionText}>
                Claim All ({claimableIds.length})
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      {/* Recent / upcoming rewards hint */}
      <View style={[hubStyles.sectionHeader, { marginTop: 16 }]}>
        <Text style={hubStyles.sectionTitle}>How to Earn</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      {[
        { label: 'Campaign Missions', note: 'Clear each mission for XP rewards' },
        { label: 'Boss Clears', note: 'Defeat each boss for the first time' },
        { label: 'Tier Milestones', note: 'Reach T24, T30, T45, T60 in Endless' },
        { label: 'Codex Discovery', note: 'Discover all enemy types' },
        { label: 'Mastery Ranks', note: 'Reach rank 4, 8, and 10 per build' },
      ].map(({ label, note }) => (
        <View key={label} style={hubStyles.card}>
          <Text style={hubStyles.cardTitle}>{label}</Text>
          <Text style={hubStyles.cardMeta}>{note}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
