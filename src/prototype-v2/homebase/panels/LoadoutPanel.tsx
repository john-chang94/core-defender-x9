import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  ARENA_CAMPAIGN_MISSIONS,
  ARENA_CAMPAIGN_SHIELDS,
  ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER,
  ARENA_CAMPAIGN_SHIP_STAT_UPGRADES,
  ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER,
  ARENA_CAMPAIGN_WEAPON_UPGRADES,
  ARENA_CAMPAIGN_WEAPONS,
  getArenaCampaignShipStatBonuses,
  getArenaCampaignWeaponUpgradeMaxLevel,
  getArenaCampaignWeaponSlotCount,
} from '../../campaign';
import { getArenaCosmeticDefinition } from '../../cosmetics';
import type {
  ArenaCampaignMissionId,
  ArenaCampaignShieldId,
  ArenaCampaignShipStatUpgradeKey,
  ArenaCampaignWeaponId,
  ArenaCampaignWeaponUpgradeKey,
  ArenaMetaState,
} from '../../types';
import {
  HUB_ACCENT_COLORS,
  HUB_TEXT_DIM,
  HUB_TEXT_SECONDARY,
  hubStyles,
} from '../homebaseStyles';

type Props = {
  arenaMeta: ArenaMetaState;
  onEquipWeapon: (slotIndex: 0 | 1, weaponId: ArenaCampaignWeaponId) => void;
  onEquipShield: (shieldId: ArenaCampaignShieldId) => void;
  onUpgradeWeapon: (weaponId: ArenaCampaignWeaponId, key: ArenaCampaignWeaponUpgradeKey) => void;
  onUpgradeShipStat: (key: ArenaCampaignShipStatUpgradeKey) => void;
};

export function LoadoutPanel({
  arenaMeta,
  onEquipWeapon,
  onEquipShield,
  onUpgradeWeapon,
  onUpgradeShipStat,
}: Props) {
  const [upgradeTargetId, setUpgradeTargetId] = useState<ArenaCampaignWeaponId>(
    arenaMeta.campaign.loadout.weaponSlots[0] ?? 'railCannon',
  );

  const { campaign } = arenaMeta;
  const slotCount = getArenaCampaignWeaponSlotCount(campaign.level);
  const activeBanner = getArenaCosmeticDefinition(arenaMeta.equippedCosmetics.banner);
  const shipStatBonuses = getArenaCampaignShipStatBonuses(campaign.shipStatUpgrades);

  const upgradeTarget = ARENA_CAMPAIGN_WEAPONS[upgradeTargetId];
  const upgradeTrack = campaign.weaponUpgrades[upgradeTargetId];

  return (
    <ScrollView
      style={hubStyles.panelScroll}
      contentContainerStyle={hubStyles.panelScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Ship Viewer ───────────────────────── */}
      <View style={hubStyles.sectionHeader}>
        <Text style={hubStyles.sectionTitle}>Ship</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      <View
        style={[
          hubStyles.card,
          { alignItems: 'center', paddingVertical: 20 },
        ]}
      >
        {/* Code-drawn ship silhouette (placeholder for ship PNG) */}
        <View style={{ width: 60, height: 90, alignItems: 'center', position: 'relative' }}>
          <View style={{ position: 'absolute', bottom: 0, width: 80, height: 12, borderRadius: 40, backgroundColor: activeBanner.glowColor, opacity: 0.3 }} />
          <View style={[
            { position: 'absolute', bottom: 14, width: 0, height: 0,
              borderLeftWidth: 22, borderRightWidth: 22, borderBottomWidth: 18,
              borderLeftColor: 'transparent', borderRightColor: 'transparent',
              borderBottomColor: activeBanner.primaryColor, opacity: 0.7 }
          ]} />
          <View style={{ position: 'absolute', bottom: 28, width: 20, height: 50, borderRadius: 3, backgroundColor: '#1E3050' }} />
          <View style={[
            { position: 'absolute', bottom: 48, width: 12, height: 24, borderRadius: 6,
              backgroundColor: activeBanner.detailColor, opacity: 0.9 }
          ]} />
          <View style={{ position: 'absolute', bottom: 72, width: 6, height: 16, borderRadius: 3, backgroundColor: '#2A4060' }} />
        </View>

        <Text style={[hubStyles.cardTitle, { marginTop: 12 }]}>Active Ship</Text>
        <Text style={hubStyles.cardMeta}>
          HP {100 + shipStatBonuses.health} / SHD {42 + shipStatBonuses.shield}
        </Text>

        {/* Module slot placeholders */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#1C2C40',
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 8, color: HUB_TEXT_DIM }}>MODULE</Text>
              <Text style={{ fontSize: 7, color: HUB_TEXT_DIM }}>SLOT {i + 1}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Ship Stat Upgrades ────────────────── */}
      <View style={hubStyles.sectionHeader}>
        <Text style={hubStyles.sectionTitle}>Ship Stats</Text>
        <View style={hubStyles.sectionLine} />
        <Text style={{ fontSize: 11, color: campaign.weaponUpgradePoints > 0 ? '#FBBF24' : HUB_TEXT_DIM }}>
          {campaign.weaponUpgradePoints} pts
        </Text>
      </View>

      <View style={hubStyles.upgradeGrid}>
        {ARENA_CAMPAIGN_SHIP_STAT_UPGRADE_ORDER.map((upgradeKey) => {
          const definition = ARENA_CAMPAIGN_SHIP_STAT_UPGRADES[upgradeKey];
          const currentLevel = campaign.shipStatUpgrades[upgradeKey];
          const disabled = campaign.weaponUpgradePoints <= 0;
          const bonus = upgradeKey === 'health' ? shipStatBonuses.health : shipStatBonuses.shield;
          return (
            <Pressable
              key={upgradeKey}
              disabled={disabled}
              onPress={() => onUpgradeShipStat(upgradeKey)}
              style={[
                hubStyles.upgradeCard,
                { width: '100%' },
                disabled && hubStyles.actionDisabled,
              ]}
            >
              <View style={hubStyles.upgradeCardHeader}>
                <Text style={hubStyles.upgradeCardLabel}>{definition.label}</Text>
                <Text style={hubStyles.upgradeCardLevel}>Lv {currentLevel}</Text>
              </View>
              <Text style={hubStyles.upgradeCardStat}>
                {definition.statLine} · +{bonus} active
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Weapons ───────────────────────────── */}
      <View style={[hubStyles.sectionHeader, { marginTop: 16 }]}>
        <Text style={hubStyles.sectionTitle}>Weapon Slots</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      {([0, 1] as const).map((slotIndex) => {
        const isSlotUnlocked = slotIndex < slotCount;
        const equippedId = campaign.loadout.weaponSlots[slotIndex];
        return (
          <View key={slotIndex} style={[hubStyles.card, !isSlotUnlocked && hubStyles.cardLocked]}>
            <View style={hubStyles.cardHeader}>
              <Text style={hubStyles.cardTitle}>
                Slot {slotIndex + 1}{' '}
                {equippedId && isSlotUnlocked
                  ? `— ${ARENA_CAMPAIGN_WEAPONS[equippedId].label}`
                  : ''}
              </Text>
              {!isSlotUnlocked ? (
                <View style={hubStyles.cardBadge}>
                  <Text style={hubStyles.cardBadgeText}>Lv 4</Text>
                </View>
              ) : null}
            </View>
            {isSlotUnlocked ? (
              <View style={hubStyles.chipRow}>
                {Object.values(ARENA_CAMPAIGN_WEAPONS).map((weapon) => {
                  const locked = weapon.unlockLevel > campaign.level;
                  const selected = equippedId === weapon.id;
                  return (
                    <Pressable
                      key={weapon.id}
                      disabled={locked}
                      onPress={() => {
                        onEquipWeapon(slotIndex, weapon.id);
                        setUpgradeTargetId(weapon.id);
                      }}
                      style={[
                        hubStyles.chip,
                        selected && hubStyles.chipActive,
                        locked && hubStyles.chipLocked,
                      ]}
                    >
                      <Text
                        style={[
                          hubStyles.chipText,
                          selected && hubStyles.chipTextActive,
                        ]}
                      >
                        {locked ? `Lv ${weapon.unlockLevel}` : weapon.shortLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={hubStyles.cardMeta}>Unlocks at campaign level 4</Text>
            )}
          </View>
        );
      })}

      {/* ── Shield ────────────────────────────── */}
      <View style={[hubStyles.sectionHeader, { marginTop: 4 }]}>
        <Text style={hubStyles.sectionTitle}>Shield Ability</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      {Object.values(ARENA_CAMPAIGN_SHIELDS).map((shield) => {
        const locked = shield.unlockLevel > campaign.level;
        const selected = campaign.loadout.shieldId === shield.id;
        return (
          <Pressable
            key={shield.id}
            disabled={locked}
            onPress={() => onEquipShield(shield.id)}
            style={[
              hubStyles.card,
              selected && hubStyles.cardSelected,
              locked && hubStyles.cardLocked,
            ]}
          >
            <View style={hubStyles.cardHeader}>
              <Text style={hubStyles.cardTitle}>{shield.label}</Text>
              {locked ? (
                <View style={hubStyles.cardBadge}>
                  <Text style={hubStyles.cardBadgeText}>Lv {shield.unlockLevel}</Text>
                </View>
              ) : selected ? (
                <View style={[hubStyles.cardBadge, { backgroundColor: '#091828' }]}>
                  <Text style={hubStyles.cardBadgeText}>Equipped</Text>
                </View>
              ) : null}
            </View>
            <Text style={hubStyles.cardMeta}>{shield.summary}</Text>
            <Text style={[hubStyles.cardMeta, { marginTop: 4, color: HUB_TEXT_DIM }]}>
              {shield.cooldownSeconds}s cooldown · {shield.durationSeconds}s duration
            </Text>
          </Pressable>
        );
      })}

      {/* ── Weapon Upgrades ───────────────────── */}
      <View style={[hubStyles.sectionHeader, { marginTop: 4 }]}>
        <Text style={hubStyles.sectionTitle}>Weapon Upgrades</Text>
        <View style={hubStyles.sectionLine} />
        <Text style={{ fontSize: 11, color: campaign.weaponUpgradePoints > 0 ? '#FBBF24' : HUB_TEXT_DIM }}>
          {campaign.weaponUpgradePoints} pts
        </Text>
      </View>

      {/* Weapon target selector */}
      <View style={hubStyles.chipRow}>
        {Object.values(ARENA_CAMPAIGN_WEAPONS).map((weapon) => {
          const locked = weapon.unlockLevel > campaign.level;
          const selected = upgradeTargetId === weapon.id;
          return (
            <Pressable
              key={weapon.id}
              disabled={locked}
              onPress={() => setUpgradeTargetId(weapon.id)}
              style={[
                hubStyles.chip,
                selected && hubStyles.chipActive,
                locked && hubStyles.chipLocked,
              ]}
            >
              <Text style={[hubStyles.chipText, selected && hubStyles.chipTextActive]}>
                {locked ? `Lv ${weapon.unlockLevel}` : weapon.shortLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[hubStyles.cardMeta, { marginTop: 8, marginBottom: 10 }]}>
        Target: {upgradeTarget.label}
      </Text>

      <View style={hubStyles.upgradeGrid}>
        {ARENA_CAMPAIGN_WEAPON_UPGRADE_ORDER.map((upgradeKey) => {
          const definition = ARENA_CAMPAIGN_WEAPON_UPGRADES[upgradeKey];
          const currentLevel = upgradeTrack[upgradeKey];
          const maxLevel = getArenaCampaignWeaponUpgradeMaxLevel(upgradeTargetId, upgradeKey);
          const maxed = maxLevel !== null && currentLevel >= maxLevel;
          const disabled = campaign.weaponUpgradePoints <= 0 || maxed;
          const levelLabel = maxLevel === null ? `Lv ${currentLevel}` : `${currentLevel}/${maxLevel}`;
          return (
            <Pressable
              key={upgradeKey}
              disabled={disabled}
              onPress={() => onUpgradeWeapon(upgradeTargetId, upgradeKey)}
              style={[hubStyles.upgradeCard, disabled && hubStyles.actionDisabled]}
            >
              <View style={hubStyles.upgradeCardHeader}>
                <Text style={hubStyles.upgradeCardLabel}>{definition.shortLabel}</Text>
                <Text style={hubStyles.upgradeCardLevel}>{levelLabel}</Text>
              </View>
              <Text style={hubStyles.upgradeCardStat}>{definition.statLine}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[hubStyles.cardMeta, { marginTop: 12, color: HUB_TEXT_DIM }]}>
        Weapon and ship stat upgrades are permanent campaign-only installs.
      </Text>
    </ScrollView>
  );
}
