import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Canvas, LinearGradient, Paint, Path, Rect, Skia, vec } from '@shopify/react-native-skia';

import {
  ARENA_CAMPAIGN_MISSIONS,
  getArenaCampaignLevelProgress,
  getNextActiveCampaignMission,
} from '../campaign';
import { getArenaCosmeticDefinition } from '../cosmetics';
import type {
  ArenaCampaignMissionId,
  ArenaCampaignShieldId,
  ArenaCampaignShipStatUpgradeKey,
  ArenaCampaignWeaponId,
  ArenaCampaignWeaponUpgradeKey,
  ArenaCosmeticId,
  ArenaMetaState,
} from '../types';
import { HUB_ACCENT_COLORS, hubStyles } from './homebaseStyles';
import { AchievementsPanel } from './panels/AchievementsPanel';
import { CodexPanel } from './panels/CodexPanel';
import { CollectionsPanel } from './panels/CollectionsPanel';
import { LoadoutPanel } from './panels/LoadoutPanel';
import { MissionMapPanel } from './panels/MissionMapPanel';
import { RewardsPanel } from './panels/RewardsPanel';

type ActivePanel =
  | 'root'
  | 'map'
  | 'loadout'
  | 'rewards'
  | 'collections'
  | 'codex'
  | 'achievements';

type AppGameId = 'defender' | 'prototype' | 'prototypeV2';

export type HomeBaseScreenProps = {
  arenaMeta: ArenaMetaState;
  isMetaReady: boolean;
  onLaunchMission: (missionId: ArenaCampaignMissionId) => void;
  onLaunchEndless: () => void;
  onSwitchGame: (game: AppGameId) => void;
  onClaimCosmetic: (id: ArenaCosmeticId) => void;
  onClaimAllCosmetics: () => void;
  onEquipCosmetic: (id: ArenaCosmeticId) => void;
  onEquipWeapon: (slotIndex: 0 | 1, weaponId: ArenaCampaignWeaponId) => void;
  onEquipShield: (shieldId: ArenaCampaignShieldId) => void;
  onUpgradeWeapon: (weaponId: ArenaCampaignWeaponId, key: ArenaCampaignWeaponUpgradeKey) => void;
  onUpgradeShipStat: (key: ArenaCampaignShipStatUpgradeKey) => void;
};

// ── Skia hex path helper ──────────────────────────────────────────────────────
function makeHexPath(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * (Math.PI / 180);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.close();
  return path;
}

// ── Individual hex cell ───────────────────────────────────────────────────────
type HexCellProps = {
  label: string;
  subtitle: string;
  icon: string;
  accent: string;
  size: number;
  onPress: () => void;
};

function HexCell({ label, subtitle, icon, accent, size, onPress }: HexCellProps) {
  const [pressed, setPressed] = useState(false);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.48;
  const innerR = size * 0.43;
  const hexOutline = makeHexPath(cx, cy, outerR);
  const hexFill = makeHexPath(cx, cy, innerR);

  return (
    <View style={[hubStyles.hexCellWrapper, { width: size, height: size }]}>
      {/* Skia canvas is purely visual — pointerEvents="none" lets touches through */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path path={hexFill} color={pressed ? '#101E30' : '#0A1520'} />
        <Path
          path={hexOutline}
          color="transparent"
          style="stroke"
          strokeWidth={1.5}
        >
          <Paint color={accent} opacity={pressed ? 1 : 0.7} />
        </Path>
        <Path
          path={hexOutline}
          color="transparent"
          style="stroke"
          strokeWidth={0.5}
        >
          <Paint color={accent} opacity={0.3} />
        </Path>
      </Canvas>

      {/* Pressable sits on top and receives all touch events */}
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      >
        <View style={[hubStyles.hexCellContent, { top: 0, left: 0, right: 0, bottom: 0 }]}>
          <Text style={hubStyles.hexCellIcon}>{icon}</Text>
          <Text style={hubStyles.hexCellLabel}>{label}</Text>
          <Text style={hubStyles.hexCellSubtitle}>{subtitle}</Text>
        </View>
      </Pressable>
    </View>
  );
}

// ── Code-drawn ship for hub center ────────────────────────────────────────────
function HubShip({ accentColor }: { accentColor: string }) {
  return (
    <View style={{ width: 50, height: 80, alignItems: 'center', position: 'relative' }}>
      {/* engine glow */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: 60,
          height: 12,
          borderRadius: 30,
          backgroundColor: accentColor,
          opacity: 0.2,
        }}
      />
      {/* wing left */}
      <View
        style={{
          position: 'absolute',
          bottom: 12,
          left: 0,
          width: 0,
          height: 0,
          borderTopWidth: 0,
          borderBottomWidth: 16,
          borderRightWidth: 14,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: accentColor,
          opacity: 0.75,
        }}
      />
      {/* wing right */}
      <View
        style={{
          position: 'absolute',
          bottom: 12,
          right: 0,
          width: 0,
          height: 0,
          borderTopWidth: 0,
          borderBottomWidth: 16,
          borderLeftWidth: 14,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: accentColor,
          opacity: 0.75,
        }}
      />
      {/* hull body */}
      <View
        style={{
          position: 'absolute',
          bottom: 14,
          width: 18,
          height: 50,
          borderRadius: 3,
          backgroundColor: '#1C2E48',
        }}
      />
      {/* canopy */}
      <View
        style={{
          position: 'absolute',
          bottom: 44,
          width: 10,
          height: 20,
          borderRadius: 5,
          backgroundColor: accentColor,
          opacity: 0.85,
        }}
      />
      {/* nose */}
      <View
        style={{
          position: 'absolute',
          bottom: 62,
          width: 6,
          height: 16,
          borderRadius: 3,
          backgroundColor: '#2A4060',
        }}
      />
      {/* left engine */}
      <View
        style={{
          position: 'absolute',
          bottom: 6,
          left: 8,
          width: 5,
          height: 10,
          borderRadius: 3,
          backgroundColor: '#3A6090',
        }}
      />
      {/* right engine */}
      <View
        style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          width: 5,
          height: 10,
          borderRadius: 3,
          backgroundColor: '#3A6090',
        }}
      />
    </View>
  );
}

// ── Skia star background ──────────────────────────────────────────────────────
function HubBackground({ width, height }: { width: number; height: number }) {
  const STARS = [
    { x: 0.12, y: 0.08, r: 1.2 }, { x: 0.78, y: 0.05, r: 0.9 },
    { x: 0.34, y: 0.18, r: 1.5 }, { x: 0.91, y: 0.22, r: 1.0 },
    { x: 0.05, y: 0.32, r: 0.8 }, { x: 0.55, y: 0.28, r: 1.3 },
    { x: 0.23, y: 0.45, r: 0.7 }, { x: 0.68, y: 0.42, r: 1.1 },
    { x: 0.88, y: 0.55, r: 0.9 }, { x: 0.15, y: 0.62, r: 1.4 },
    { x: 0.45, y: 0.70, r: 0.8 }, { x: 0.72, y: 0.75, r: 1.2 },
    { x: 0.30, y: 0.85, r: 0.9 }, { x: 0.85, y: 0.88, r: 1.0 },
    { x: 0.60, y: 0.92, r: 0.7 }, { x: 0.40, y: 0.12, r: 0.6 },
    { x: 0.95, y: 0.38, r: 1.1 }, { x: 0.08, y: 0.78, r: 0.8 },
  ];

  const starPath = Skia.Path.Make();
  STARS.forEach(({ x, y, r }) => {
    starPath.addCircle(x * width, y * height, r);
  });

  return (
    <Canvas style={{ ...hubStyles.missionCardBg, width, height }}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(width / 2, 0)}
          end={vec(width / 2, height)}
          colors={['#06080F', '#060A14', '#050810']}
        />
      </Rect>
      <Path path={starPath} color="rgba(160,200,255,0.55)" />
    </Canvas>
  );
}

const PANEL_TITLES: Record<ActivePanel, string> = {
  root: 'Home Base',
  map: 'Mission Map',
  loadout: 'Loadout',
  rewards: 'Rewards',
  collections: 'Collections',
  codex: 'Codex',
  achievements: 'Achievements',
};

const PANEL_KICKERS: Record<ActivePanel, string> = {
  root: 'Orbital Command',
  map: 'Sector Select',
  loadout: 'Ship · Weapons · Shield',
  rewards: 'Claimable Cosmetics',
  collections: 'Cosmetic Inventory',
  codex: 'Enemy Archives',
  achievements: 'Challenges · Badges',
};

// ── Main hub root ─────────────────────────────────────────────────────────────
export function HomeBaseScreen({
  arenaMeta,
  isMetaReady,
  onLaunchMission,
  onLaunchEndless,
  onSwitchGame,
  onClaimCosmetic,
  onClaimAllCosmetics,
  onEquipCosmetic,
  onEquipWeapon,
  onEquipShield,
  onUpgradeWeapon,
  onUpgradeShipStat,
}: HomeBaseScreenProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>('root');
  const { width: windowWidth } = useWindowDimensions();

  const campaignLevelProgress = getArenaCampaignLevelProgress(arenaMeta.campaign.xp);
  const activeMissionId = getNextActiveCampaignMission(arenaMeta.campaign.missionProgress);
  const activeMission = ARENA_CAMPAIGN_MISSIONS[activeMissionId];
  const activeBannerDef = getArenaCosmeticDefinition(arenaMeta.equippedCosmetics.banner);
  const claimableCount = Object.values(arenaMeta.cosmetics).filter(
    (e) => e.state === 'claimable',
  ).length;
  const discoveredCount = Object.values(arenaMeta.codexEnemies).filter(
    (e) => e.discovered,
  ).length;

  const HEX_SIZE = Math.min(Math.floor((windowWidth - 20) / 3), 120);
  const accentColor = activeBannerDef.primaryColor;

  // ── Panel view ─────────────────────────────────────────────────────────────
  if (activePanel !== 'root') {
    return (
      <SafeAreaView style={hubStyles.safeArea}>
        {/* Panel header */}
        <View style={hubStyles.panelHeader}>
          <Pressable onPress={() => setActivePanel('root')} style={hubStyles.panelBackButton}>
            <Text style={hubStyles.panelBackText}>← Back</Text>
          </Pressable>
          <View style={hubStyles.panelHeaderCenter}>
            <Text style={hubStyles.panelKicker}>{PANEL_KICKERS[activePanel]}</Text>
            <Text style={hubStyles.panelTitle}>{PANEL_TITLES[activePanel]}</Text>
          </View>
        </View>

        <View style={hubStyles.panelContent}>
          {activePanel === 'map' && (
            <MissionMapPanel
              arenaMeta={arenaMeta}
              onLaunchMission={(missionId) => {
                setActivePanel('root');
                onLaunchMission(missionId);
              }}
            />
          )}
          {activePanel === 'loadout' && (
            <LoadoutPanel
              arenaMeta={arenaMeta}
              onEquipWeapon={onEquipWeapon}
              onEquipShield={onEquipShield}
              onUpgradeWeapon={onUpgradeWeapon}
              onUpgradeShipStat={onUpgradeShipStat}
            />
          )}
          {activePanel === 'rewards' && (
            <RewardsPanel
              arenaMeta={arenaMeta}
              onClaimCosmetic={onClaimCosmetic}
              onClaimAll={onClaimAllCosmetics}
            />
          )}
          {activePanel === 'collections' && (
            <CollectionsPanel
              arenaMeta={arenaMeta}
              onEquipCosmetic={onEquipCosmetic}
            />
          )}
          {activePanel === 'codex' && <CodexPanel arenaMeta={arenaMeta} />}
          {activePanel === 'achievements' && (
            <AchievementsPanel arenaMeta={arenaMeta} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Root hub view ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={hubStyles.safeArea}>
      {/* Skia star background */}
      <View style={{ ...hubStyles.missionCardBg, overflow: 'hidden' }} pointerEvents="none">
        <HubBackground width={windowWidth} height={900} />
      </View>

      {/* Top bar */}
      <View style={hubStyles.topBar}>
        <View
          style={[
            hubStyles.rankBadge,
            { borderColor: activeBannerDef.secondaryColor },
          ]}
        >
          <Text style={hubStyles.rankBadgeLv}>LV</Text>
          <Text style={hubStyles.rankBadgeNumber}>{campaignLevelProgress.level}</Text>
        </View>
        <View style={hubStyles.topBarCenter}>
          <Text style={hubStyles.topBarTitle}>Home Base</Text>
          <Text style={hubStyles.topBarSubtitle}>Orbital Command</Text>
          <View style={hubStyles.xpTrack}>
            <View
              style={[
                hubStyles.xpFill,
                {
                  width: `${campaignLevelProgress.progress * 100}%`,
                  backgroundColor: activeBannerDef.detailColor,
                },
              ]}
            />
          </View>
        </View>
        <Pressable
          onPress={() => onSwitchGame('defender')}
          style={hubStyles.extrasButton}
        >
          <Text style={hubStyles.extrasButtonText}>⚙ Game</Text>
        </Pressable>
      </View>

      {/* Command status strip */}
      <View style={hubStyles.statusStrip}>
        <Text style={hubStyles.statusLabel}>Command Status</Text>
        <Text style={hubStyles.statusValue}>
          {activeMission.zoneLabel} · {activeMission.label}
        </Text>
        <Text style={hubStyles.statusReady}>
          {arenaMeta.campaign.missionProgress[activeMissionId]?.completed
            ? 'All missions complete'
            : 'Next run ready'}
        </Text>
      </View>

      {/* Endless quick-access chip */}
      <Pressable style={hubStyles.endlessChip} onPress={onLaunchEndless}>
        <Text style={hubStyles.endlessChipLabel}>Quick Play — Endless Mode</Text>
        <Text style={hubStyles.endlessChipArrow}>→</Text>
      </Pressable>

      {/* ── Hex Grid ──────────────────────────────────────────────────────── */}
      <View style={hubStyles.hexGrid}>
        {/* Row 1: SHIP centered */}
        <View style={hubStyles.hexRow}>
          <HexCell
            label="SHIP"
            subtitle="Configure"
            icon="🚀"
            accent={HUB_ACCENT_COLORS.ship}
            size={HEX_SIZE}
            onPress={() => setActivePanel('loadout')}
          />
        </View>

        {/* Row 2: WEAPONS | ship bay | MAP */}
        <View style={[hubStyles.hexRow, { alignItems: 'center' }]}>
          <HexCell
            label="WEAPONS"
            subtitle={`${arenaMeta.campaign.weaponUpgradePoints > 0 ? `${arenaMeta.campaign.weaponUpgradePoints} upgrades` : 'Loadout'}`}
            icon="🎯"
            accent={HUB_ACCENT_COLORS.weapons}
            size={HEX_SIZE}
            onPress={() => setActivePanel('loadout')}
          />
          {/* Ship bay in center */}
          <View style={[hubStyles.shipBay, { width: HEX_SIZE, height: HEX_SIZE }]}>
            <View
              style={[
                hubStyles.shipPadGlow,
                { backgroundColor: accentColor },
              ]}
            />
            <HubShip accentColor={accentColor} />
          </View>
          <HexCell
            label="MAP"
            subtitle={activeMission.zoneLabel}
            icon="🗺"
            accent={HUB_ACCENT_COLORS.map}
            size={HEX_SIZE}
            onPress={() => setActivePanel('map')}
          />
        </View>

        {/* Row 3: REWARDS | [gap] | COLLECTIONS */}
        <View style={[hubStyles.hexRow, { alignItems: 'center' }]}>
          <HexCell
            label="REWARDS"
            subtitle={claimableCount > 0 ? `${claimableCount} ready` : 'Claim'}
            icon="📦"
            accent={HUB_ACCENT_COLORS.rewards}
            size={HEX_SIZE}
            onPress={() => setActivePanel('rewards')}
          />
          <View style={{ width: HEX_SIZE }} />
          <HexCell
            label="COLLECTIONS"
            subtitle="Cosmetics"
            icon="🎨"
            accent={HUB_ACCENT_COLORS.collections}
            size={HEX_SIZE}
            onPress={() => setActivePanel('collections')}
          />
        </View>

        {/* Row 4: CODEX | ACHIEVEMENTS | [empty] */}
        <View style={hubStyles.hexRow}>
          <HexCell
            label="CODEX"
            subtitle={`${discoveredCount} found`}
            icon="📖"
            accent={HUB_ACCENT_COLORS.codex}
            size={HEX_SIZE}
            onPress={() => setActivePanel('codex')}
          />
          <HexCell
            label="ACHIEVEMENTS"
            subtitle="Challenges"
            icon="🏆"
            accent={HUB_ACCENT_COLORS.achievements}
            size={HEX_SIZE}
            onPress={() => setActivePanel('achievements')}
          />
        </View>
      </View>

      {/* ── Launch CTA ─────────────────────────────────────────────────────── */}
      <Pressable
        style={hubStyles.launchCta}
        onPress={() => onLaunchMission(activeMissionId)}
      >
        <View style={hubStyles.launchCtaLeft}>
          <Text style={hubStyles.launchCtaKicker}>Launch Mission</Text>
          <Text style={hubStyles.launchCtaTitle}>{activeMission.label}</Text>
          <Text style={hubStyles.launchCtaSubtitle}>
            T{activeMission.biomeTier}–T{activeMission.targetTier} · Boss: {activeMission.bossLabel}
          </Text>
        </View>
        <Text style={hubStyles.launchArrow}>▶</Text>
      </Pressable>

      {/* ── Bottom Nav ─────────────────────────────────────────────────────── */}
      <View style={hubStyles.bottomNav}>
        {[
          { icon: '⚙', label: 'Settings', active: false, onPress: () => {} },
          { icon: '✉', label: 'Inbox', active: false, onPress: () => {} },
          { icon: '⌂', label: 'Home Base', active: true, onPress: () => {} },
          { icon: '📊', label: 'Stats', active: false, onPress: () => {} },
          { icon: '👤', label: 'Profile', active: false, onPress: () => {} },
        ].map(({ icon, label, active, onPress }) => (
          <Pressable key={label} style={hubStyles.navItem} onPress={onPress}>
            <Text style={[hubStyles.navIcon, { opacity: active ? 1 : 0.45 }]}>{icon}</Text>
            <Text style={[hubStyles.navLabel, active && hubStyles.navLabelActive]}>{label}</Text>
            {active ? <View style={hubStyles.navDot} /> : null}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
