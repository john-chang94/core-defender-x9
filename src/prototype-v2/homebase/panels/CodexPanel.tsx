import { ScrollView, Text, View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';

import { ARENA_ENEMY_ORDER } from '../../config';
import { ARENA_ENEMY_LABELS, ARENA_UNLOCK_ORDER } from '../../meta';
import type { ArenaEnemyKind, ArenaMetaState } from '../../types';
import { HUB_TEXT_DIM, hubStyles } from '../homebaseStyles';

const BOSS_KINDS: ArenaEnemyKind[] = [
  'prismBoss',
  'hiveCarrierBoss',
  'vectorLoomBoss',
  'eclipseTalonBoss',
];

const ENEMY_SHAPE_COLORS: Partial<Record<ArenaEnemyKind, string>> = {
  hover: '#7AD4FF',
  burst: '#FF8C6B',
  tank: '#A0B8D0',
  orbiter: '#C084FC',
  sniper: '#FFD080',
  bomber: '#FF6B9D',
  interceptor: '#FF9850',
  warden: '#60EFDA',
  lancer: '#80D4FF',
  carrier: '#A8D880',
  artillery: '#FFBF60',
  weaver: '#D084FF',
  conductor: '#80C4FF',
  raider: '#FF8080',
  hunter: '#FFD060',
  prismBoss: '#C084FC',
  hiveCarrierBoss: '#FBBF24',
  vectorLoomBoss: '#22D3EE',
  eclipseTalonBoss: '#F472B6',
};

function EnemyShapeCanvas({ kind, size, discovered }: { kind: ArenaEnemyKind; size: number; discovered: boolean }) {
  const color = discovered ? (ENEMY_SHAPE_COLORS[kind] ?? '#7A9AB8') : '#2A3A4A';
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.3;

  const isCircle = kind === 'hover' || kind === 'orbiter';
  const isTriangle = kind === 'burst' || kind === 'interceptor';
  const isDiamond = kind === 'sniper' || kind === 'lancer' || kind === 'raider' || kind === 'hunter';
  const isRect = kind === 'tank' || kind === 'warden';
  const isPentagon = kind === 'bomber' || kind === 'artillery' || kind === 'weaver';
  const isHex = kind === 'carrier' || kind === 'conductor';
  const isBoss = BOSS_KINDS.includes(kind);

  const path = Skia.Path.Make();

  if (isCircle) {
    // drawn via Circle component
  } else if (isTriangle) {
    path.moveTo(cx, cy - r);
    path.lineTo(cx + r * 0.9, cy + r * 0.7);
    path.lineTo(cx - r * 0.9, cy + r * 0.7);
    path.close();
  } else if (isDiamond) {
    path.moveTo(cx, cy - r);
    path.lineTo(cx + r * 0.7, cy);
    path.lineTo(cx, cy + r);
    path.lineTo(cx - r * 0.7, cy);
    path.close();
  } else if (isRect) {
    path.addRect({ x: cx - r * 0.8, y: cy - r * 0.6, width: r * 1.6, height: r * 1.2 });
  } else if (isPentagon || isHex) {
    const sides = isPentagon ? 5 : 6;
    for (let i = 0; i < sides; i++) {
      const angle = ((i * 360) / sides - 90) * (Math.PI / 180);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.close();
  } else if (isBoss) {
    // Star-like shape for bosses
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? r : r * 0.5;
      const angle = (i * 45 - 90) * (Math.PI / 180);
      const x = cx + rr * Math.cos(angle);
      const y = cy + rr * Math.sin(angle);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.close();
  }

  return (
    <Canvas style={{ width: size, height: size }}>
      {isCircle ? (
        <Circle cx={cx} cy={cy} r={r} color={color} />
      ) : (
        <Path path={path} color={color} style="fill" />
      )}
    </Canvas>
  );
}

type Props = {
  arenaMeta: ArenaMetaState;
};

export function CodexPanel({ arenaMeta }: Props) {
  const discoveredCount = ARENA_ENEMY_ORDER.filter(
    (kind) => arenaMeta.codexEnemies[kind].discovered,
  ).length;

  const regularEnemies = ARENA_ENEMY_ORDER.filter((kind) => !BOSS_KINDS.includes(kind));
  const bossEnemies = BOSS_KINDS;

  return (
    <ScrollView
      style={hubStyles.panelScroll}
      contentContainerStyle={hubStyles.panelScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Discovery progress */}
      <View style={hubStyles.card}>
        <View style={hubStyles.cardHeader}>
          <Text style={hubStyles.cardTitle}>Enemy Discovery</Text>
          <Text style={hubStyles.cardMeta}>
            {discoveredCount} / {ARENA_ENEMY_ORDER.length}
          </Text>
        </View>
        <View style={hubStyles.progressTrack}>
          <View
            style={[
              hubStyles.progressFill,
              {
                width: `${(discoveredCount / ARENA_ENEMY_ORDER.length) * 100}%`,
                backgroundColor: '#22D3EE',
              },
            ]}
          />
        </View>
      </View>

      {/* Boss row */}
      <View style={hubStyles.sectionHeader}>
        <Text style={hubStyles.sectionTitle}>Boss Files</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {bossEnemies.map((kind) => {
          const entry = arenaMeta.codexEnemies[kind];
          const discovered = entry.discovered;
          return (
            <View
              key={kind}
              style={[
                hubStyles.card,
                { flex: 1, alignItems: 'center', padding: 10 },
                !discovered && hubStyles.cardLocked,
              ]}
            >
              <EnemyShapeCanvas kind={kind} size={36} discovered={discovered} />
              <Text
                style={[hubStyles.cosmeticTileLabel, { marginTop: 4, textAlign: 'center' }]}
                numberOfLines={2}
              >
                {ARENA_ENEMY_LABELS[kind]}
              </Text>
              <Text style={{ fontSize: 9, color: HUB_TEXT_DIM, marginTop: 2 }}>
                {entry.bossClears}x
              </Text>
            </View>
          );
        })}
      </View>

      {/* Regular enemy grid */}
      <View style={hubStyles.sectionHeader}>
        <Text style={hubStyles.sectionTitle}>Enemy Roster</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      <View style={hubStyles.codexGrid}>
        {regularEnemies.map((kind) => {
          const entry = arenaMeta.codexEnemies[kind];
          const discovered = entry.discovered;
          return (
            <View
              key={kind}
              style={[
                hubStyles.codexCell,
                !discovered && hubStyles.codexCellUndiscovered,
              ]}
            >
              <EnemyShapeCanvas kind={kind} size={32} discovered={discovered} />
              <Text style={hubStyles.codexCellLabel} numberOfLines={1}>
                {discovered ? ARENA_ENEMY_LABELS[kind].split(' ')[0] : '???'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Codex reward unlock chips */}
      <View style={[hubStyles.sectionHeader, { marginTop: 16 }]}>
        <Text style={hubStyles.sectionTitle}>Reward Unlocks</Text>
        <View style={hubStyles.sectionLine} />
      </View>

      {ARENA_UNLOCK_ORDER.filter((id) => {
        const entry = arenaMeta.unlocks[id];
        return entry.category === 'codex' || entry.category === 'boss';
      }).map((unlockId) => {
        const entry = arenaMeta.unlocks[unlockId];
        return (
          <View
            key={unlockId}
            style={[hubStyles.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: entry.unlocked ? '#4ADE80' : '#1C2C40',
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={hubStyles.cardTitle}>{entry.label}</Text>
              <Text style={hubStyles.cardMeta}>{entry.rewardLabel}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
