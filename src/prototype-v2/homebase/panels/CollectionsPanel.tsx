import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ARENA_BUILD_ORDER } from '../../builds';
import {
  ARENA_COSMETIC_ORDER,
  getArenaBuildCosmeticIds,
  getArenaCosmeticDefinition,
  getArenaGlobalCosmeticIds,
} from '../../cosmetics';
import type {
  ArenaBuildId,
  ArenaCosmeticId,
  ArenaCosmeticSlot,
  ArenaMetaState,
} from '../../types';
import { HUB_TEXT_DIM, hubStyles } from '../homebaseStyles';

const SLOT_LABELS: Record<string, string> = {
  banner: 'Banners',
  codexFrame: 'Codex Frames',
  buildAccent: 'Build Accents',
  buildCrest: 'Build Crests',
};

type Props = {
  arenaMeta: ArenaMetaState;
  onEquipCosmetic: (id: ArenaCosmeticId) => void;
};

export function CollectionsPanel({ arenaMeta, onEquipCosmetic }: Props) {
  const [activeSlot, setActiveSlot] = useState<string>('banner');

  const bannerIds = getArenaGlobalCosmeticIds('banner');
  const frameIds = getArenaGlobalCosmeticIds('codexFrame');
  const accentIds = ARENA_BUILD_ORDER.flatMap((buildId) =>
    getArenaBuildCosmeticIds(buildId, 'buildAccent'),
  );
  const crestIds = ARENA_BUILD_ORDER.flatMap((buildId) =>
    getArenaBuildCosmeticIds(buildId, 'buildCrest'),
  );

  const cosmeticIdsBySlot: Record<string, ArenaCosmeticId[]> = {
    banner: bannerIds,
    codexFrame: frameIds,
    buildAccent: accentIds,
    buildCrest: crestIds,
  };

  const activeCosmeticIds = cosmeticIdsBySlot[activeSlot] ?? [];

  const isEquipped = (id: ArenaCosmeticId) => {
    const def = getArenaCosmeticDefinition(id);
    if (def.slot === 'banner') return arenaMeta.equippedCosmetics.banner === id;
    if (def.slot === 'codexFrame') return arenaMeta.equippedCosmetics.codexFrame === id;
    if (def.slot === 'buildAccent' && def.buildId)
      return arenaMeta.equippedCosmetics.buildAccent[def.buildId] === id;
    if (def.slot === 'buildCrest' && def.buildId)
      return arenaMeta.equippedCosmetics.buildCrest[def.buildId] === id;
    return false;
  };

  return (
    <ScrollView
      style={hubStyles.panelScroll}
      contentContainerStyle={hubStyles.panelScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Slot tabs */}
      <View style={hubStyles.chipRow}>
        {Object.keys(SLOT_LABELS).map((slot) => (
          <Pressable
            key={slot}
            onPress={() => setActiveSlot(slot)}
            style={[hubStyles.chip, activeSlot === slot && hubStyles.chipActive]}
          >
            <Text
              style={[hubStyles.chipText, activeSlot === slot && hubStyles.chipTextActive]}
            >
              {SLOT_LABELS[slot]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Cosmetic grid */}
      <View style={[hubStyles.cosmeticGrid, { marginTop: 14 }]}>
        {activeCosmeticIds.map((cosmeticId) => {
          const definition = getArenaCosmeticDefinition(cosmeticId);
          const ownership = arenaMeta.cosmetics[cosmeticId];
          const owned = ownership.state === 'owned';
          const equipped = isEquipped(cosmeticId);
          const claimable = ownership.state === 'claimable';

          return (
            <Pressable
              key={cosmeticId}
              disabled={!owned && !claimable}
              onPress={() => owned ? onEquipCosmetic(cosmeticId) : undefined}
              style={[
                hubStyles.cosmeticTile,
                equipped && hubStyles.cosmeticTileEquipped,
                !owned && !claimable && hubStyles.cosmeticTileLocked,
              ]}
            >
              <View
                style={[
                  hubStyles.cosmeticColorDot,
                  { backgroundColor: definition.primaryColor },
                ]}
              />
              <Text style={hubStyles.cosmeticTileLabel} numberOfLines={2}>
                {definition.label.replace('Boss Banner: ', '').replace('Codex Frame: ', '').replace('Build Accent: ', '').replace('Build Crest: ', '')}
              </Text>
              {equipped ? <View style={hubStyles.cosmeticEquippedBadge} /> : null}
              {claimable ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#4ADE80',
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Premium / Coming Soon section */}
      <View style={[hubStyles.sectionHeader, { marginTop: 24 }]}>
        <Text style={hubStyles.sectionTitle}>Premium</Text>
        <View style={hubStyles.sectionLine} />
        <Text style={{ fontSize: 10, color: HUB_TEXT_DIM, fontWeight: '700' }}>
          COMING SOON
        </Text>
      </View>

      <View style={[hubStyles.cosmeticGrid]}>
        {['Ship Skins', 'Projectile VFX', 'Biome Themes', 'Weapon Trails', 'Ultimate VFX'].map(
          (label) => (
            <View
              key={label}
              style={[hubStyles.cosmeticTile, hubStyles.cosmeticTileLocked, { borderStyle: 'dashed' }]}
            >
              <Text style={{ fontSize: 16 }}>🔒</Text>
              <Text style={hubStyles.cosmeticTileLabel} numberOfLines={2}>
                {label}
              </Text>
            </View>
          ),
        )}
      </View>

      <Text style={[hubStyles.cardMeta, { marginTop: 12, color: HUB_TEXT_DIM }]}>
        Cosmetics are purely visual and never affect combat performance.
      </Text>
    </ScrollView>
  );
}
