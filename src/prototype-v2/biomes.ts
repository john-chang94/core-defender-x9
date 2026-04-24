import type { ArenaBiomeDefinition, ArenaBiomeId } from './types';

export const ARENA_BIOME_TIER_SPAN = 6;
export const ARENA_BIOME_ROTATION_TIER_SPAN = 18;

export const ARENA_BIOME_ORDER: ArenaBiomeId[] = ['prismVerge', 'hiveForge', 'vectorSpindle'];

const ARENA_BIOME_DEFINITIONS: Record<ArenaBiomeId, ArenaBiomeDefinition> = {
  prismVerge: {
    id: 'prismVerge',
    label: 'Prism Verge',
    subtitle: 'Fractured light lanes and cold prism spill.',
    accentColor: '#FF6FE3',
    detailColor: '#FFF0FF',
    glowColor: '#FFAFF4',
    base: '#050914',
    auraA: 'rgba(255, 82, 214, 0.1)',
    auraB: 'rgba(49, 204, 255, 0.08)',
    enemyZone: 'rgba(162, 83, 255, 0.06)',
    boundary: 'rgba(255, 154, 79, 0.34)',
    grid: 'rgba(128, 94, 220, 0.15)',
    overlay: '#170A2A',
    flow: '#34D2FF',
    pulse: '#FF74EA',
    headerBackground: '#0D0918',
    headerBorder: '#7156D3',
    menuSurface: '#0A0815',
    menuStripe: '#FF78E6',
    announcementGlow: '#FFB7F5',
    backgroundPlates: [
      { color: '#0D1021', stroke: '#FF874C' },
      { color: '#101428', stroke: '#566DFF' },
      { color: '#0A0E1D', stroke: '#FF9658' },
      { color: '#121631', stroke: '#734FFF' },
      { color: '#0C1021', stroke: '#FF9A50' },
      { color: '#151A34', stroke: '#36C6FF' },
    ],
    atmosphereOrbs: [
      { color: '#43CCFF', opacity: 0.072 },
      { color: '#FF6FDF', opacity: 0.066 },
      { color: '#9B7FFF', opacity: 0.054 },
      { color: '#FFB46B', opacity: 0.046 },
    ],
    energySweeps: [
      { color: '#39D5FF', opacity: 0.046 },
      { color: '#FF87E7', opacity: 0.044 },
      { color: '#B996FF', opacity: 0.042 },
    ],
  },
  hiveForge: {
    id: 'hiveForge',
    label: 'Hive Forge',
    subtitle: 'Carrier furnaces, green exhaust, and welded siege lanes.',
    accentColor: '#67F5E3',
    detailColor: '#EDFFFB',
    glowColor: '#BAFFF6',
    base: '#041016',
    auraA: 'rgba(86, 255, 225, 0.085)',
    auraB: 'rgba(194, 114, 255, 0.05)',
    enemyZone: 'rgba(91, 253, 214, 0.055)',
    boundary: 'rgba(255, 156, 82, 0.33)',
    grid: 'rgba(77, 212, 255, 0.12)',
    overlay: '#0C1A29',
    flow: '#34E6FF',
    pulse: '#7BFFD7',
    headerBackground: '#0B1320',
    headerBorder: '#2C7FAE',
    menuSurface: '#08111A',
    menuStripe: '#63F5DA',
    announcementGlow: '#BAFFF0',
    backgroundPlates: [
      { color: '#09141F', stroke: '#FF894E' },
      { color: '#0C1A28', stroke: '#2ACFFF' },
      { color: '#08131E', stroke: '#FF9D59' },
      { color: '#0E2032', stroke: '#53F0D7' },
      { color: '#091521', stroke: '#FF9450' },
      { color: '#102538', stroke: '#6D8DFF' },
    ],
    atmosphereOrbs: [
      { color: '#67FFE1', opacity: 0.066 },
      { color: '#34CFFF', opacity: 0.05 },
      { color: '#C57AFF', opacity: 0.042 },
      { color: '#FFBA73', opacity: 0.04 },
    ],
    energySweeps: [
      { color: '#5DFFE3', opacity: 0.044 },
      { color: '#36D9FF', opacity: 0.042 },
      { color: '#C391FF', opacity: 0.036 },
    ],
  },
  vectorSpindle: {
    id: 'vectorSpindle',
    label: 'Vector Spindle',
    subtitle: 'Thread lattices, cold grids, and loom control fields.',
    accentColor: '#B58BFF',
    detailColor: '#F7EDFF',
    glowColor: '#D9C5FF',
    base: '#050813',
    auraA: 'rgba(177, 124, 255, 0.09)',
    auraB: 'rgba(45, 205, 255, 0.06)',
    enemyZone: 'rgba(169, 120, 255, 0.06)',
    boundary: 'rgba(255, 159, 83, 0.34)',
    grid: 'rgba(106, 123, 255, 0.14)',
    overlay: '#130C31',
    flow: '#6FD7FF',
    pulse: '#C17DFF',
    headerBackground: '#0C091C',
    headerBorder: '#6249C9',
    menuSurface: '#090814',
    menuStripe: '#B687FF',
    announcementGlow: '#E0C4FF',
    backgroundPlates: [
      { color: '#0C1020', stroke: '#FF8A50' },
      { color: '#10142A', stroke: '#6D5CFF' },
      { color: '#090D1D', stroke: '#FF9758' },
      { color: '#131737', stroke: '#3CCEFF' },
      { color: '#0B1021', stroke: '#FF924D' },
      { color: '#151A3C', stroke: '#9A7BFF' },
    ],
    atmosphereOrbs: [
      { color: '#C599FF', opacity: 0.068 },
      { color: '#42CFFF', opacity: 0.05 },
      { color: '#8EA3FF', opacity: 0.048 },
      { color: '#FFBA76', opacity: 0.04 },
    ],
    energySweeps: [
      { color: '#D2B0FF', opacity: 0.042 },
      { color: '#72D8FF', opacity: 0.04 },
      { color: '#FFB376', opacity: 0.032 },
    ],
  },
};

export function getArenaBiomeDefinition(biomeId: ArenaBiomeId) {
  return ARENA_BIOME_DEFINITIONS[biomeId];
}

export function getArenaBiomeIdForTier(displayTier: number): ArenaBiomeId {
  const zeroIndexedTier = Math.max(0, displayTier - 1);
  const biomeIndex = Math.floor((zeroIndexedTier % ARENA_BIOME_ROTATION_TIER_SPAN) / ARENA_BIOME_TIER_SPAN);
  return ARENA_BIOME_ORDER[biomeIndex] ?? 'prismVerge';
}

export function getArenaBiomeDefinitionForTier(displayTier: number) {
  return getArenaBiomeDefinition(getArenaBiomeIdForTier(displayTier));
}

export function getArenaBiomeTierRange(displayTier: number) {
  const zeroIndexedTier = Math.max(0, displayTier - 1);
  const cycleStartTier = Math.floor(zeroIndexedTier / ARENA_BIOME_TIER_SPAN) * ARENA_BIOME_TIER_SPAN + 1;
  return {
    startTier: cycleStartTier,
    endTier: cycleStartTier + ARENA_BIOME_TIER_SPAN - 1,
  };
}

export function isArenaBiomeTransitionTier(displayTier: number) {
  return (Math.max(1, displayTier) - 1) % ARENA_BIOME_TIER_SPAN === 0;
}
