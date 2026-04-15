import { ARENA_BUILD_META, ARENA_BUILD_ORDER } from './builds';
import type {
  ArenaBuildId,
  ArenaBuildValueMap,
  ArenaCosmeticDefinition,
  ArenaCosmeticId,
  ArenaCosmeticSlot,
  ArenaUnlockId,
} from './types';

type ArenaGlobalCosmeticSlot = Extract<ArenaCosmeticSlot, 'banner' | 'codexFrame'>;
type ArenaBuildCosmeticSlot = Extract<ArenaCosmeticSlot, 'buildAccent' | 'buildCrest'>;

export const ARENA_COSMETIC_ORDER: ArenaCosmeticId[] = [
  'bannerDefault',
  'bannerHiveTrace',
  'codexFrameDefault',
  'codexFrameFullSpectrum',
  'railFocusAccentDefault',
  'railFocusAccentHalo',
  'novaBloomAccentDefault',
  'novaBloomAccentEcho',
  'missileCommandAccentDefault',
  'missileCommandAccentStrikeMesh',
  'fractureCoreAccentDefault',
  'fractureCoreAccentFractureVein',
  'railFocusCrestDefault',
  'railFocusCrestZenith',
  'novaBloomCrestDefault',
  'novaBloomCrestSolarBloom',
  'missileCommandCrestDefault',
  'missileCommandCrestOrdnanceCrown',
  'fractureCoreCrestDefault',
  'fractureCoreCrestShatterCrown',
];

export const ARENA_COSMETIC_DEFINITIONS: Record<ArenaCosmeticId, ArenaCosmeticDefinition> = {
  bannerDefault: {
    id: 'bannerDefault',
    label: 'Default Banner',
    description: 'Standard arena command strip with clean blue framing.',
    slot: 'banner',
    buildId: null,
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: '#193349',
    secondaryColor: '#4A7AA3',
    detailColor: '#B4D8FF',
    glowColor: '#D8EEFF',
  },
  bannerHiveTrace: {
    id: 'bannerHiveTrace',
    label: 'Boss Banner: Hive Trace',
    description: 'Emerald carrier signal bands recovered from the first Hive Carrier clear.',
    slot: 'banner',
    buildId: null,
    sourceType: 'reward',
    rarity: 'rare',
    rewardUnlockId: 'hiveCarrierFirstClear',
    primaryColor: '#163A31',
    secondaryColor: '#3E9A84',
    detailColor: '#93F0D5',
    glowColor: '#C7FFF1',
  },
  codexFrameDefault: {
    id: 'codexFrameDefault',
    label: 'Default Codex Frame',
    description: 'Baseline tactical frame used for arena records and collection panels.',
    slot: 'codexFrame',
    buildId: null,
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: '#1A2D42',
    secondaryColor: '#547897',
    detailColor: '#A7C6E7',
    glowColor: '#D5EAFF',
  },
  codexFrameFullSpectrum: {
    id: 'codexFrameFullSpectrum',
    label: 'Codex Frame: Full Spectrum',
    description: 'Full-spectrum prism frame awarded for completing every enemy signal entry.',
    slot: 'codexFrame',
    buildId: null,
    sourceType: 'reward',
    rarity: 'rare',
    rewardUnlockId: 'enemyCodexComplete',
    primaryColor: '#31245C',
    secondaryColor: '#63B9FF',
    detailColor: '#FFD976',
    glowColor: '#FFB7D9',
  },
  railFocusAccentDefault: {
    id: 'railFocusAccentDefault',
    label: 'Rail Focus Accent: Standard',
    description: 'Default Rail Focus trim with cool lane-control highlights.',
    slot: 'buildAccent',
    buildId: 'railFocus',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: ARENA_BUILD_META.railFocus.accent,
    secondaryColor: '#2D79BD',
    detailColor: '#FFF0CA',
    glowColor: '#6FE7FF',
  },
  railFocusAccentHalo: {
    id: 'railFocusAccentHalo',
    label: 'Build Accent: Rail Halo',
    description: 'Brightened Rail Focus trim unlocked at mastery rank 4.',
    slot: 'buildAccent',
    buildId: 'railFocus',
    sourceType: 'reward',
    rarity: 'rare',
    rewardUnlockId: 'railFocusMastery4',
    primaryColor: '#D9F0FF',
    secondaryColor: '#69B8FF',
    detailColor: '#F9F6D8',
    glowColor: '#F3FCFF',
  },
  novaBloomAccentDefault: {
    id: 'novaBloomAccentDefault',
    label: 'Nova Bloom Accent: Standard',
    description: 'Default Nova Bloom trim with rose fan highlights.',
    slot: 'buildAccent',
    buildId: 'novaBloom',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: ARENA_BUILD_META.novaBloom.accent,
    secondaryColor: '#C65991',
    detailColor: '#FFF0CA',
    glowColor: '#FFD9EB',
  },
  novaBloomAccentEcho: {
    id: 'novaBloomAccentEcho',
    label: 'Build Accent: Bloom Echo',
    description: 'Luminous bloom trim unlocked at mastery rank 4.',
    slot: 'buildAccent',
    buildId: 'novaBloom',
    sourceType: 'reward',
    rarity: 'rare',
    rewardUnlockId: 'novaBloomMastery4',
    primaryColor: '#FFD9EC',
    secondaryColor: '#FF82C4',
    detailColor: '#FFF4B8',
    glowColor: '#FFF2D6',
  },
  missileCommandAccentDefault: {
    id: 'missileCommandAccentDefault',
    label: 'Missile Command Accent: Standard',
    description: 'Default Missile Command trim with warm ordnance highlights.',
    slot: 'buildAccent',
    buildId: 'missileCommand',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: ARENA_BUILD_META.missileCommand.accent,
    secondaryColor: '#C98732',
    detailColor: '#FFF0CA',
    glowColor: '#FFE2B6',
  },
  missileCommandAccentStrikeMesh: {
    id: 'missileCommandAccentStrikeMesh',
    label: 'Build Accent: Strike Mesh',
    description: 'High-visibility strike mesh trim unlocked at mastery rank 4.',
    slot: 'buildAccent',
    buildId: 'missileCommand',
    sourceType: 'reward',
    rarity: 'rare',
    rewardUnlockId: 'missileCommandMastery4',
    primaryColor: '#FFF0B8',
    secondaryColor: '#FFAF57',
    detailColor: '#FFF6DE',
    glowColor: '#FFF9EC',
  },
  fractureCoreAccentDefault: {
    id: 'fractureCoreAccentDefault',
    label: 'Fracture Core Accent: Standard',
    description: 'Default Fracture Core trim with cold shard highlights.',
    slot: 'buildAccent',
    buildId: 'fractureCore',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: ARENA_BUILD_META.fractureCore.accent,
    secondaryColor: '#6B8FDE',
    detailColor: '#FFF0CA',
    glowColor: '#DCEBFF',
  },
  fractureCoreAccentFractureVein: {
    id: 'fractureCoreAccentFractureVein',
    label: 'Build Accent: Fracture Vein',
    description: 'Crystalline shard trim unlocked at mastery rank 4.',
    slot: 'buildAccent',
    buildId: 'fractureCore',
    sourceType: 'reward',
    rarity: 'rare',
    rewardUnlockId: 'fractureCoreMastery4',
    primaryColor: '#E7F2FF',
    secondaryColor: '#96B7FF',
    detailColor: '#FFF4D8',
    glowColor: '#F5FBFF',
  },
  railFocusCrestDefault: {
    id: 'railFocusCrestDefault',
    label: 'Rail Focus Crest: Standard',
    description: 'Default Rail Focus crest marker.',
    slot: 'buildCrest',
    buildId: 'railFocus',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: '#D8EEFF',
    secondaryColor: '#5DAEFF',
    detailColor: '#FFFFFF',
    glowColor: '#DFF8FF',
    emblemKey: 'rail-default',
  },
  railFocusCrestZenith: {
    id: 'railFocusCrestZenith',
    label: 'Build Crest: Rail Zenith',
    description: 'Zenith crest unlocked at Rail Focus mastery rank 8.',
    slot: 'buildCrest',
    buildId: 'railFocus',
    sourceType: 'reward',
    rarity: 'epic',
    rewardUnlockId: 'railFocusMastery8',
    primaryColor: '#F1FAFF',
    secondaryColor: '#9BD7FF',
    detailColor: '#FFF2C7',
    glowColor: '#F9FDFF',
    emblemKey: 'rail-zenith',
  },
  novaBloomCrestDefault: {
    id: 'novaBloomCrestDefault',
    label: 'Nova Bloom Crest: Standard',
    description: 'Default Nova Bloom crest marker.',
    slot: 'buildCrest',
    buildId: 'novaBloom',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: '#FFE1EE',
    secondaryColor: '#FF8BC8',
    detailColor: '#FFF7D5',
    glowColor: '#FFF1F7',
    emblemKey: 'nova-default',
  },
  novaBloomCrestSolarBloom: {
    id: 'novaBloomCrestSolarBloom',
    label: 'Build Crest: Solar Bloom',
    description: 'Solar bloom crest unlocked at Nova Bloom mastery rank 8.',
    slot: 'buildCrest',
    buildId: 'novaBloom',
    sourceType: 'reward',
    rarity: 'epic',
    rewardUnlockId: 'novaBloomMastery8',
    primaryColor: '#FFF0C2',
    secondaryColor: '#FF9FD1',
    detailColor: '#FFFBEA',
    glowColor: '#FFF7D5',
    emblemKey: 'nova-solar',
  },
  missileCommandCrestDefault: {
    id: 'missileCommandCrestDefault',
    label: 'Missile Command Crest: Standard',
    description: 'Default Missile Command crest marker.',
    slot: 'buildCrest',
    buildId: 'missileCommand',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: '#FFF1D0',
    secondaryColor: '#FFBC69',
    detailColor: '#FFFFFF',
    glowColor: '#FFF6E6',
    emblemKey: 'missile-default',
  },
  missileCommandCrestOrdnanceCrown: {
    id: 'missileCommandCrestOrdnanceCrown',
    label: 'Build Crest: Ordnance Crown',
    description: 'Ordnance crown crest unlocked at Missile Command mastery rank 8.',
    slot: 'buildCrest',
    buildId: 'missileCommand',
    sourceType: 'reward',
    rarity: 'epic',
    rewardUnlockId: 'missileCommandMastery8',
    primaryColor: '#FFF5D7',
    secondaryColor: '#FFD877',
    detailColor: '#FFFDF3',
    glowColor: '#FFF8E7',
    emblemKey: 'missile-crown',
  },
  fractureCoreCrestDefault: {
    id: 'fractureCoreCrestDefault',
    label: 'Fracture Core Crest: Standard',
    description: 'Default Fracture Core crest marker.',
    slot: 'buildCrest',
    buildId: 'fractureCore',
    sourceType: 'default',
    rarity: 'common',
    rewardUnlockId: null,
    primaryColor: '#E2EEFF',
    secondaryColor: '#96B4FF',
    detailColor: '#FFF3D8',
    glowColor: '#F5FAFF',
    emblemKey: 'fracture-default',
  },
  fractureCoreCrestShatterCrown: {
    id: 'fractureCoreCrestShatterCrown',
    label: 'Build Crest: Shatter Crown',
    description: 'Shatter crown crest unlocked at Fracture Core mastery rank 8.',
    slot: 'buildCrest',
    buildId: 'fractureCore',
    sourceType: 'reward',
    rarity: 'epic',
    rewardUnlockId: 'fractureCoreMastery8',
    primaryColor: '#F2F7FF',
    secondaryColor: '#B6CBFF',
    detailColor: '#FFF7E5',
    glowColor: '#FBFDFF',
    emblemKey: 'fracture-crown',
  },
};

const ARENA_GLOBAL_COSMETIC_ORDER: Record<ArenaGlobalCosmeticSlot, ArenaCosmeticId[]> = {
  banner: ['bannerDefault', 'bannerHiveTrace'],
  codexFrame: ['codexFrameDefault', 'codexFrameFullSpectrum'],
};

const ARENA_BUILD_COSMETIC_ORDER: ArenaBuildValueMap<Record<ArenaBuildCosmeticSlot, ArenaCosmeticId[]>> = {
  railFocus: {
    buildAccent: ['railFocusAccentDefault', 'railFocusAccentHalo'],
    buildCrest: ['railFocusCrestDefault', 'railFocusCrestZenith'],
  },
  novaBloom: {
    buildAccent: ['novaBloomAccentDefault', 'novaBloomAccentEcho'],
    buildCrest: ['novaBloomCrestDefault', 'novaBloomCrestSolarBloom'],
  },
  missileCommand: {
    buildAccent: ['missileCommandAccentDefault', 'missileCommandAccentStrikeMesh'],
    buildCrest: ['missileCommandCrestDefault', 'missileCommandCrestOrdnanceCrown'],
  },
  fractureCore: {
    buildAccent: ['fractureCoreAccentDefault', 'fractureCoreAccentFractureVein'],
    buildCrest: ['fractureCoreCrestDefault', 'fractureCoreCrestShatterCrown'],
  },
};

const ARENA_DEFAULT_GLOBAL_COSMETICS: Record<ArenaGlobalCosmeticSlot, ArenaCosmeticId> = {
  banner: 'bannerDefault',
  codexFrame: 'codexFrameDefault',
};

const ARENA_DEFAULT_BUILD_COSMETICS: ArenaBuildValueMap<Record<ArenaBuildCosmeticSlot, ArenaCosmeticId>> = {
  railFocus: {
    buildAccent: 'railFocusAccentDefault',
    buildCrest: 'railFocusCrestDefault',
  },
  novaBloom: {
    buildAccent: 'novaBloomAccentDefault',
    buildCrest: 'novaBloomCrestDefault',
  },
  missileCommand: {
    buildAccent: 'missileCommandAccentDefault',
    buildCrest: 'missileCommandCrestDefault',
  },
  fractureCore: {
    buildAccent: 'fractureCoreAccentDefault',
    buildCrest: 'fractureCoreCrestDefault',
  },
};

const ARENA_UNLOCK_REWARD_COSMETICS: Record<ArenaUnlockId, ArenaCosmeticId> = {
  hiveCarrierFirstClear: 'bannerHiveTrace',
  enemyCodexComplete: 'codexFrameFullSpectrum',
  railFocusMastery4: 'railFocusAccentHalo',
  railFocusMastery8: 'railFocusCrestZenith',
  novaBloomMastery4: 'novaBloomAccentEcho',
  novaBloomMastery8: 'novaBloomCrestSolarBloom',
  missileCommandMastery4: 'missileCommandAccentStrikeMesh',
  missileCommandMastery8: 'missileCommandCrestOrdnanceCrown',
  fractureCoreMastery4: 'fractureCoreAccentFractureVein',
  fractureCoreMastery8: 'fractureCoreCrestShatterCrown',
};

export function getArenaCosmeticDefinition(cosmeticId: ArenaCosmeticId) {
  return ARENA_COSMETIC_DEFINITIONS[cosmeticId];
}

export function getArenaGlobalCosmeticIds(slot: ArenaGlobalCosmeticSlot) {
  return ARENA_GLOBAL_COSMETIC_ORDER[slot];
}

export function getArenaBuildCosmeticIds(buildId: ArenaBuildId, slot: ArenaBuildCosmeticSlot) {
  return ARENA_BUILD_COSMETIC_ORDER[buildId][slot];
}

export function getArenaDefaultGlobalCosmetic(slot: ArenaGlobalCosmeticSlot) {
  return ARENA_DEFAULT_GLOBAL_COSMETICS[slot];
}

export function getArenaDefaultBuildCosmetic(buildId: ArenaBuildId, slot: ArenaBuildCosmeticSlot) {
  return ARENA_DEFAULT_BUILD_COSMETICS[buildId][slot];
}

export function getArenaUnlockRewardCosmeticId(unlockId: ArenaUnlockId) {
  return ARENA_UNLOCK_REWARD_COSMETICS[unlockId] ?? null;
}

export function createArenaBuildValueMap<T>(factory: (buildId: ArenaBuildId) => T): ArenaBuildValueMap<T> {
  return ARENA_BUILD_ORDER.reduce((accumulator, buildId) => {
    accumulator[buildId] = factory(buildId);
    return accumulator;
  }, {} as ArenaBuildValueMap<T>);
}
