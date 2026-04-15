import type { ArenaBiomeDefinition, ArenaBiomeId } from './types';

export const ARENA_BIOME_TIER_SPAN = 6;
export const ARENA_BIOME_ROTATION_TIER_SPAN = 18;

export const ARENA_BIOME_ORDER: ArenaBiomeId[] = ['prismVerge', 'hiveForge', 'vectorSpindle'];

const ARENA_BIOME_DEFINITIONS: Record<ArenaBiomeId, ArenaBiomeDefinition> = {
  prismVerge: {
    id: 'prismVerge',
    label: 'Prism Verge',
    subtitle: 'Fractured light lanes and cold prism spill.',
    accentColor: '#FF96C7',
    detailColor: '#FFE9F4',
    glowColor: '#FFBEDC',
    base: '#08121E',
    auraA: 'rgba(255, 112, 176, 0.08)',
    auraB: 'rgba(102, 234, 255, 0.06)',
    enemyZone: 'rgba(255, 121, 183, 0.05)',
    boundary: 'rgba(255, 184, 112, 0.28)',
    grid: 'rgba(122, 149, 184, 0.12)',
    overlay: '#12253A',
    flow: '#91CDFF',
    pulse: '#FF9CC5',
    headerBackground: '#111D31',
    headerBorder: '#4B6B8E',
    menuSurface: '#0D1726',
    menuStripe: '#FF8FC3',
    announcementGlow: '#FFB7D9',
    backgroundPlates: [
      { color: '#132236', stroke: '#203754' },
      { color: '#102035', stroke: '#25415E' },
      { color: '#0E1C30', stroke: '#1F3550' },
      { color: '#12243A', stroke: '#274666' },
      { color: '#0E1D31', stroke: '#23415D' },
      { color: '#122439', stroke: '#284B6D' },
    ],
    atmosphereOrbs: [
      { color: '#6EDCFF', opacity: 0.075 },
      { color: '#FF89C0', opacity: 0.07 },
      { color: '#9EC7FF', opacity: 0.06 },
      { color: '#FFD39C', opacity: 0.062 },
    ],
    energySweeps: [
      { color: '#8BD2FF', opacity: 0.05 },
      { color: '#FFC9E5', opacity: 0.05 },
      { color: '#B6E7FF', opacity: 0.05 },
    ],
  },
  hiveForge: {
    id: 'hiveForge',
    label: 'Hive Forge',
    subtitle: 'Carrier furnaces, green exhaust, and welded siege lanes.',
    accentColor: '#9EF0D4',
    detailColor: '#EAFFF6',
    glowColor: '#CAFFF0',
    base: '#07161A',
    auraA: 'rgba(120, 255, 218, 0.08)',
    auraB: 'rgba(255, 194, 112, 0.05)',
    enemyZone: 'rgba(112, 255, 188, 0.05)',
    boundary: 'rgba(150, 238, 199, 0.32)',
    grid: 'rgba(120, 174, 162, 0.12)',
    overlay: '#16302D',
    flow: '#8FF2D8',
    pulse: '#B8FFC9',
    headerBackground: '#102622',
    headerBorder: '#477A70',
    menuSurface: '#0D1D1D',
    menuStripe: '#6BE0B6',
    announcementGlow: '#B8FFE8',
    backgroundPlates: [
      { color: '#102B2D', stroke: '#1E5152' },
      { color: '#113033', stroke: '#216064' },
      { color: '#0E2627', stroke: '#1A4747' },
      { color: '#153333', stroke: '#2A6767' },
      { color: '#0F2627', stroke: '#215252' },
      { color: '#163838', stroke: '#2E7470' },
    ],
    atmosphereOrbs: [
      { color: '#80FFD5', opacity: 0.07 },
      { color: '#FFDA99', opacity: 0.05 },
      { color: '#7EF2FF', opacity: 0.05 },
      { color: '#C2FFC7', opacity: 0.058 },
    ],
    energySweeps: [
      { color: '#9EF7D5', opacity: 0.05 },
      { color: '#FFDE9C', opacity: 0.045 },
      { color: '#B2FFF0', opacity: 0.05 },
    ],
  },
  vectorSpindle: {
    id: 'vectorSpindle',
    label: 'Vector Spindle',
    subtitle: 'Thread lattices, cold grids, and loom control fields.',
    accentColor: '#C9D5FF',
    detailColor: '#F0F4FF',
    glowColor: '#DDE7FF',
    base: '#0A1121',
    auraA: 'rgba(169, 186, 255, 0.08)',
    auraB: 'rgba(255, 225, 132, 0.05)',
    enemyZone: 'rgba(166, 186, 255, 0.05)',
    boundary: 'rgba(198, 214, 255, 0.3)',
    grid: 'rgba(132, 156, 212, 0.12)',
    overlay: '#1C2645',
    flow: '#D7E0FF',
    pulse: '#FFE69B',
    headerBackground: '#131C38',
    headerBorder: '#556EAE',
    menuSurface: '#10192C',
    menuStripe: '#B9C8FF',
    announcementGlow: '#E5EBFF',
    backgroundPlates: [
      { color: '#151F3B', stroke: '#2D4171' },
      { color: '#12203F', stroke: '#33518A' },
      { color: '#10203A', stroke: '#2A4575' },
      { color: '#172643', stroke: '#385B94' },
      { color: '#11203A', stroke: '#2E4A7D' },
      { color: '#18284B', stroke: '#4067A5' },
    ],
    atmosphereOrbs: [
      { color: '#C5D3FF', opacity: 0.07 },
      { color: '#FFE39E', opacity: 0.05 },
      { color: '#AFC3FF', opacity: 0.052 },
      { color: '#E3EDFF', opacity: 0.05 },
    ],
    energySweeps: [
      { color: '#DCE6FF', opacity: 0.05 },
      { color: '#FFE7B8', opacity: 0.042 },
      { color: '#C4D5FF', opacity: 0.05 },
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
