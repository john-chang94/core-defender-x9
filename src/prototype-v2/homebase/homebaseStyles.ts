import { StyleSheet } from 'react-native';

export const HUB_ACCENT_COLORS = {
  ship: '#C084FC',
  weapons: '#60A5FA',
  map: '#22D3EE',
  rewards: '#FBBF24',
  collections: '#FB923C',
  codex: '#2DD4BF',
  achievements: '#4ADE80',
  endless: '#94A3B8',
} as const;

export const HUB_BG = '#060A10';
export const HUB_SURFACE = '#0D1520';
export const HUB_BORDER = '#1C2C40';
export const HUB_TEXT_PRIMARY = '#E8F0FC';
export const HUB_TEXT_SECONDARY = '#7A9AB8';
export const HUB_TEXT_DIM = '#3A5068';
export const HUB_LAUNCH_COLOR = '#F97316';
export const HUB_LAUNCH_GLOW = '#FF6B0050';

export const hubStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HUB_BG,
  },
  safeArea: {
    flex: 1,
    backgroundColor: HUB_BG,
  },

  // ── Top Bar ──────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
  },
  rankBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1520',
  },
  rankBadgeLv: {
    fontSize: 8,
    fontWeight: '700',
    color: '#7A9AB8',
    letterSpacing: 1,
    lineHeight: 9,
  },
  rankBadgeNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#E8F0FC',
    lineHeight: 18,
  },
  topBarCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A9AB8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  topBarSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E8F0FC',
  },
  topBarRank: {
    fontSize: 10,
    color: '#7A9AB8',
    marginTop: 1,
  },
  xpTrack: {
    height: 3,
    backgroundColor: HUB_BORDER,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 2,
  },
  extrasButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
  },
  extrasButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: HUB_TEXT_SECONDARY,
  },

  // ── Status Strip ─────────────────────────────────
  statusStrip: {
    marginHorizontal: 14,
    marginBottom: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A9AB8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
    color: HUB_TEXT_PRIMARY,
    marginTop: 1,
  },
  statusReady: {
    fontSize: 11,
    color: '#4ADE80',
    marginTop: 2,
  },

  // ── Endless Chip ─────────────────────────────────
  endlessChip: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1C2C40',
    backgroundColor: '#0D1520',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  endlessChipLabel: {
    fontSize: 11,
    color: '#7A9AB8',
  },
  endlessChipArrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ADE80',
  },

  // ── Hex Grid ─────────────────────────────────────
  hexGrid: {
    flex: 1,
    paddingHorizontal: 10,
  },
  hexRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  hexCellWrapper: {
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexCellContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  hexCellIcon: {
    fontSize: 22,
    marginBottom: 3,
  },
  hexCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: HUB_TEXT_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  hexCellSubtitle: {
    fontSize: 9,
    color: HUB_TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 1,
  },

  // ── Ship Bay ─────────────────────────────────────
  shipBay: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  shipPadGlow: {
    position: 'absolute',
    width: 100,
    height: 20,
    borderRadius: 50,
    bottom: 0,
  },

  // ── Launch CTA ────────────────────────────────────
  launchCta: {
    marginHorizontal: 14,
    marginVertical: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: HUB_LAUNCH_COLOR,
    backgroundColor: '#1A0D04',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  launchCtaLeft: {
    flex: 1,
  },
  launchCtaKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: HUB_LAUNCH_COLOR,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  launchCtaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF5F0',
    marginTop: 1,
  },
  launchCtaSubtitle: {
    fontSize: 11,
    color: '#B87A60',
    marginTop: 2,
  },
  launchArrow: {
    fontSize: 22,
    color: HUB_LAUNCH_COLOR,
    fontWeight: '700',
  },

  // ── Bottom Nav ────────────────────────────────────
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: HUB_BORDER,
    backgroundColor: '#080E18',
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 2,
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: HUB_TEXT_DIM,
    letterSpacing: 0.5,
  },
  navLabelActive: {
    color: '#E8F0FC',
  },
  navDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: HUB_LAUNCH_COLOR,
    position: 'absolute',
    bottom: 2,
  },

  // ── Panel Shell ────────────────────────────────────
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: HUB_BORDER,
    gap: 10,
  },
  panelBackButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
  },
  panelBackText: {
    fontSize: 11,
    fontWeight: '600',
    color: HUB_TEXT_SECONDARY,
  },
  panelHeaderCenter: {
    flex: 1,
  },
  panelKicker: {
    fontSize: 9,
    fontWeight: '700',
    color: HUB_TEXT_DIM,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: HUB_TEXT_PRIMARY,
  },
  panelContent: {
    flex: 1,
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    padding: 14,
    paddingBottom: 24,
  },

  // ── Common Card ────────────────────────────────────
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
    padding: 12,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: '#60A5FA',
    backgroundColor: '#091828',
  },
  cardLocked: {
    opacity: 0.45,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: HUB_TEXT_PRIMARY,
  },
  cardMeta: {
    fontSize: 11,
    color: HUB_TEXT_SECONDARY,
    marginTop: 2,
  },
  cardBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#1C3040',
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
  },

  // ── Primary Action ────────────────────────────────
  primaryAction: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HUB_LAUNCH_COLOR,
    backgroundColor: '#1A0D04',
    alignItems: 'center',
    marginTop: 6,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF0E8',
    letterSpacing: 0.5,
  },
  secondaryAction: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: HUB_TEXT_SECONDARY,
  },
  actionDisabled: {
    opacity: 0.4,
  },

  // ── Progress Bar ──────────────────────────────────
  progressTrack: {
    height: 5,
    backgroundColor: HUB_BORDER,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── Chip Pills ────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
  },
  chipActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#091828',
  },
  chipLocked: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: HUB_TEXT_SECONDARY,
  },
  chipTextActive: {
    color: '#A0D4FF',
  },

  // ── Stat Row ──────────────────────────────────────
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: '#0A1424',
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: HUB_TEXT_DIM,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: HUB_TEXT_PRIMARY,
    marginTop: 2,
  },

  // ── Section Header ────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: HUB_TEXT_DIM,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: HUB_BORDER,
  },

  // ── Cosmetic Tile ─────────────────────────────────
  cosmeticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cosmeticTile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  cosmeticTileEquipped: {
    borderColor: '#FBBF24',
    backgroundColor: '#1A1400',
  },
  cosmeticTileLocked: {
    opacity: 0.35,
  },
  cosmeticTileLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: HUB_TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 4,
  },
  cosmeticColorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cosmeticEquippedBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FBBF24',
  },

  // ── Upgrade Card ─────────────────────────────────
  upgradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  upgradeCard: {
    width: '48%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
    padding: 10,
  },
  upgradeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  upgradeCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: HUB_TEXT_PRIMARY,
  },
  upgradeCardLevel: {
    fontSize: 10,
    color: HUB_TEXT_SECONDARY,
  },
  upgradeCardStat: {
    fontSize: 10,
    color: HUB_TEXT_DIM,
  },

  // ── Enemy Shape Cell ─────────────────────────────
  codexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  codexCell: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  codexCellUndiscovered: {
    opacity: 0.3,
  },
  codexCellLabel: {
    position: 'absolute',
    bottom: 2,
    fontSize: 7,
    color: HUB_TEXT_DIM,
    textAlign: 'center',
    width: '100%',
  },

  // ── Badge Cell ────────────────────────────────────
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCell: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HUB_BORDER,
    backgroundColor: HUB_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeCellEarned: {
    borderColor: '#4ADE80',
    backgroundColor: '#061610',
  },
  badgeLabel: {
    fontSize: 8,
    color: HUB_TEXT_DIM,
    textAlign: 'center',
    marginTop: 3,
    width: 58,
  },
  badgeLabelEarned: {
    color: '#4ADE80',
  },

  // ── Mission Card (carousel) ───────────────────────
  missionCarousel: {
    flex: 1,
  },
  missionCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    margin: 14,
  },
  missionCardBg: {
    ...StyleSheet.absoluteFillObject,
  },
  missionCardContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  missionCardLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,16,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionCardLockText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A9AB8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  missionCardZone: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  missionCardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  missionCardSummary: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 14,
  },
  missionCardStats: {
    flexDirection: 'row',
    gap: 10,
  },
  missionStatPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  missionStatLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
  missionStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  missionPageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 10,
  },
  missionPageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HUB_BORDER,
  },
  missionPageDotActive: {
    backgroundColor: '#E8F0FC',
    width: 18,
  },
});
