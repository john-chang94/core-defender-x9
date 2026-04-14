import type {
  ArenaBossPhaseDefinition,
  ArenaEncounter,
  ArenaEncounterScript,
  ArenaEncounterScriptId,
} from './types';

export const ARENA_MINI_BOSS_TIER_INTERVAL = 3;
export const ARENA_BOSS_TIER_INTERVAL = 6;

const FORMATION_SCRIPTS: readonly ArenaEncounterScript[] = [
  {
    id: 'shieldScreen',
    type: 'formation',
    label: 'Shield Screen',
    announcement: 'Warden support wing forming a shield screen.',
    accentColor: '#8FE7FF',
    rewardSalvage: 0,
    anchorKind: 'warden',
    minTier: 7,
    requiredCapacity: 3,
    maxBulletPressure: 0.86,
    selectionWeight: 4,
    steps: [
      {
        kind: 'warden',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.19,
        healthMultiplier: 1.06,
        attackCooldownMultiplier: 1.04,
      },
      {
        kind: 'burst',
        laneOffset: -1,
        cruiseYRatio: 0.23,
        healthMultiplier: 1.04,
      },
      {
        kind: 'sniper',
        laneOffset: 1,
        cruiseYRatio: 0.17,
        attackCooldownMultiplier: 1.06,
      },
    ],
  },
  {
    id: 'lancerSweep',
    type: 'formation',
    label: 'Lancer Sweep',
    announcement: 'Lancer sweep charging through the lane.',
    accentColor: '#FFD7A8',
    rewardSalvage: 0,
    anchorKind: 'lancer',
    minTier: 9,
    requiredCapacity: 3,
    maxBulletPressure: 0.8,
    selectionWeight: 3,
    steps: [
      {
        kind: 'lancer',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.2,
        healthMultiplier: 1.08,
        attackCooldownMultiplier: 0.98,
      },
      { kind: 'hover', laneOffset: -1 },
      { kind: 'hover', laneOffset: 1 },
    ],
  },
  {
    id: 'fortifiedBombard',
    type: 'formation',
    label: 'Fortified Bombard',
    announcement: 'Bombard line reinforced by a support warden.',
    accentColor: '#FFCB98',
    rewardSalvage: 0,
    anchorKind: 'warden',
    minTier: 11,
    requiredCapacity: 4,
    maxBulletPressure: 0.9,
    selectionWeight: 2,
    steps: [
      {
        kind: 'tank',
        laneOffset: -1,
        cruiseYRatio: 0.25,
        healthMultiplier: 1.08,
      },
      {
        kind: 'warden',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.1,
      },
      {
        kind: 'bomber',
        laneOffset: 1,
        cruiseYRatio: 0.22,
        healthMultiplier: 1.08,
        attackCooldownMultiplier: 0.96,
      },
    ],
  },
  {
    id: 'escortRelay',
    type: 'formation',
    label: 'Escort Relay',
    announcement: 'Carrier relay dropping fresh escorts into the lane.',
    accentColor: '#AEEFD0',
    rewardSalvage: 0,
    anchorKind: 'carrier',
    minTier: 10,
    requiredCapacity: 4,
    maxBulletPressure: 0.82,
    selectionWeight: 3,
    steps: [
      {
        kind: 'carrier',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.12,
        deployChargeBonus: 1,
      },
      {
        kind: 'hover',
        laneOffset: -1,
        cruiseYRatio: 0.21,
        healthMultiplier: 1.05,
      },
      {
        kind: 'burst',
        laneOffset: 1,
        cruiseYRatio: 0.23,
        healthMultiplier: 1.04,
      },
    ],
  },
  {
    id: 'carrierSurge',
    type: 'formation',
    label: 'Carrier Surge',
    announcement: 'Carrier surge extending the field with repeated escorts.',
    accentColor: '#9EE8C9',
    rewardSalvage: 0,
    anchorKind: 'carrier',
    minTier: 13,
    requiredCapacity: 5,
    maxBulletPressure: 0.76,
    selectionWeight: 2,
    steps: [
      {
        kind: 'carrier',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.17,
        healthMultiplier: 1.18,
        deployChargeBonus: 2,
      },
      { kind: 'hover', laneOffset: -2, cruiseYRatio: 0.2 },
      { kind: 'hover', laneOffset: 2, cruiseYRatio: 0.2 },
      { kind: 'orbiter', laneOffset: 1, cruiseYRatio: 0.24, healthMultiplier: 1.06 },
    ],
  },
  {
    id: 'crossfireLattice',
    type: 'formation',
    label: 'Crossfire Lattice',
    announcement: 'Sniper and lancer lanes are cross-linking the dodge window.',
    accentColor: '#FFD5B0',
    rewardSalvage: 0,
    anchorKind: 'lancer',
    minTier: 14,
    requiredCapacity: 4,
    maxBulletPressure: 0.78,
    selectionWeight: 2,
    steps: [
      {
        kind: 'lancer',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.21,
        healthMultiplier: 1.14,
      },
      {
        kind: 'sniper',
        laneOffset: -2,
        cruiseYRatio: 0.16,
        attackCooldownMultiplier: 0.96,
      },
      {
        kind: 'sniper',
        laneOffset: 2,
        cruiseYRatio: 0.16,
        attackCooldownMultiplier: 0.96,
      },
      { kind: 'orbiter', laneOffset: 1, cruiseYRatio: 0.24 },
    ],
  },
  {
    id: 'artilleryNet',
    type: 'formation',
    label: 'Artillery Net',
    announcement: 'Artillery net is bracketing the lower arena.',
    accentColor: '#FFC6A3',
    rewardSalvage: 0,
    anchorKind: 'artillery',
    minTier: 12,
    requiredCapacity: 4,
    maxBulletPressure: 0.72,
    maxHazardPressure: 0.34,
    selectionWeight: 3,
    steps: [
      {
        kind: 'artillery',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.12,
        specialCooldownMultiplier: 0.94,
      },
      { kind: 'burst', laneOffset: -1, cruiseYRatio: 0.23, healthMultiplier: 1.04 },
      { kind: 'hover', laneOffset: 1, cruiseYRatio: 0.21, healthMultiplier: 1.02 },
    ],
  },
  {
    id: 'siegeScreen',
    type: 'formation',
    label: 'Siege Screen',
    announcement: 'Siege screen forming behind a warden shield-link.',
    accentColor: '#FFD6A4',
    rewardSalvage: 0,
    anchorKind: 'artillery',
    minTier: 15,
    requiredCapacity: 5,
    maxBulletPressure: 0.76,
    maxHazardPressure: 0.4,
    selectionWeight: 2,
    steps: [
      {
        kind: 'artillery',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.18,
        specialCooldownMultiplier: 0.92,
      },
      { kind: 'warden', laneOffset: -1, cruiseYRatio: 0.18, healthMultiplier: 1.08 },
      { kind: 'tank', laneOffset: 1, cruiseYRatio: 0.24, healthMultiplier: 1.1 },
      { kind: 'bomber', laneOffset: 2, cruiseYRatio: 0.23, attackCooldownMultiplier: 0.96 },
    ],
  },
  {
    id: 'impactCorridor',
    type: 'formation',
    label: 'Impact Corridor',
    announcement: 'Impact corridor collapsing into a lancer kill lane.',
    accentColor: '#FFD8AE',
    rewardSalvage: 0,
    anchorKind: 'artillery',
    minTier: 16,
    requiredCapacity: 4,
    maxBulletPressure: 0.74,
    maxHazardPressure: 0.3,
    selectionWeight: 2,
    steps: [
      {
        kind: 'artillery',
        anchor: true,
        laneOffset: 0,
        cruiseYRatio: 0.17,
        healthMultiplier: 1.14,
        specialCooldownMultiplier: 0.9,
      },
      { kind: 'lancer', laneOffset: -1, cruiseYRatio: 0.21, healthMultiplier: 1.1 },
      { kind: 'hover', laneOffset: 1, cruiseYRatio: 0.22 },
      { kind: 'hover', laneOffset: 2, cruiseYRatio: 0.22 },
    ],
  },
];

const MINI_BOSS_SCRIPTS: readonly ArenaEncounterScript[] = [
  {
    id: 'interceptorSweep',
    type: 'miniBoss',
    label: 'Interceptor Sweep',
    announcement: 'Interceptor sweep breaching the upper lane.',
    accentColor: '#C3B5FF',
    rewardSalvage: 80,
    anchorKind: 'interceptor',
    minTier: 3,
    steps: [
      {
        kind: 'interceptor',
        anchor: true,
        xRatio: 0.5,
        cruiseYRatio: 0.25,
        healthMultiplier: 1.1,
        rewardMultiplier: 1.25,
        attackCooldownMultiplier: 0.95,
      },
      { kind: 'hover', laneIndex: 2, healthMultiplier: 1.08, rewardMultiplier: 0.82 },
      { kind: 'orbiter', laneIndex: 4, healthMultiplier: 1.06, rewardMultiplier: 0.88 },
    ],
  },
  {
    id: 'bombardWing',
    type: 'miniBoss',
    label: 'Bombard Wing',
    announcement: 'Bombard wing breaching the upper lane.',
    accentColor: '#FFC99F',
    rewardSalvage: 92,
    anchorKind: 'bomber',
    minTier: 6,
    steps: [
      {
        kind: 'bomber',
        anchor: true,
        xRatio: 0.5,
        cruiseYRatio: 0.24,
        healthMultiplier: 1.12,
        rewardMultiplier: 1.28,
        attackCooldownMultiplier: 0.9,
      },
      {
        kind: 'burst',
        laneIndex: 1,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.86,
        attackCooldownMultiplier: 0.95,
      },
      {
        kind: 'burst',
        laneIndex: 4,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.86,
        attackCooldownMultiplier: 0.95,
      },
    ],
  },
  {
    id: 'wardenBastion',
    type: 'miniBoss',
    label: 'Warden Bastion',
    announcement: 'Warden bastion projecting linked shields.',
    accentColor: '#92E9FF',
    rewardSalvage: 96,
    anchorKind: 'warden',
    minTier: 9,
    steps: [
      {
        kind: 'warden',
        anchor: true,
        xRatio: 0.5,
        cruiseYRatio: 0.2,
        healthMultiplier: 1.45,
        rewardMultiplier: 1.35,
        attackCooldownMultiplier: 0.94,
      },
      { kind: 'tank', laneIndex: 1, cruiseYRatio: 0.24, healthMultiplier: 1.18, rewardMultiplier: 0.92 },
      { kind: 'tank', laneIndex: 4, cruiseYRatio: 0.24, healthMultiplier: 1.18, rewardMultiplier: 0.92 },
      { kind: 'burst', laneIndex: 3, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
    ],
  },
  {
    id: 'lancerSpearhead',
    type: 'miniBoss',
    label: 'Lancer Spearhead',
    announcement: 'Lancer spearhead locking a piercing lane.',
    accentColor: '#FFD3A2',
    rewardSalvage: 98,
    anchorKind: 'lancer',
    minTier: 12,
    steps: [
      {
        kind: 'lancer',
        anchor: true,
        xRatio: 0.5,
        cruiseYRatio: 0.22,
        healthMultiplier: 1.4,
        rewardMultiplier: 1.3,
        attackCooldownMultiplier: 0.92,
      },
      { kind: 'hover', laneIndex: 1, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
      { kind: 'hover', laneIndex: 4, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
      { kind: 'sniper', laneIndex: 5, cruiseYRatio: 0.17, healthMultiplier: 1.06, rewardMultiplier: 0.9 },
    ],
  },
  {
    id: 'carrierNest',
    type: 'miniBoss',
    label: 'Carrier Nest',
    announcement: 'Carrier nest is flooding the lane with escort packets.',
    accentColor: '#A8ECCD',
    rewardSalvage: 104,
    anchorKind: 'carrier',
    minTier: 15,
    steps: [
      {
        kind: 'carrier',
        anchor: true,
        xRatio: 0.5,
        cruiseYRatio: 0.19,
        healthMultiplier: 1.42,
        rewardMultiplier: 1.34,
        deployChargeBonus: 3,
      },
      { kind: 'hover', laneIndex: 1, cruiseYRatio: 0.22, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
      { kind: 'hover', laneIndex: 4, cruiseYRatio: 0.22, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
      { kind: 'burst', laneIndex: 2, cruiseYRatio: 0.24, healthMultiplier: 1.06, rewardMultiplier: 0.86 },
    ],
  },
  {
    id: 'artilleryBastion',
    type: 'miniBoss',
    label: 'Artillery Bastion',
    announcement: 'Artillery bastion is shelling the lower arena.',
    accentColor: '#FFC2A0',
    rewardSalvage: 108,
    anchorKind: 'artillery',
    minTier: 18,
    maxHazardPressure: 0.35,
    steps: [
      {
        kind: 'artillery',
        anchor: true,
        xRatio: 0.5,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.46,
        rewardMultiplier: 1.36,
        specialCooldownMultiplier: 0.84,
      },
      { kind: 'warden', laneIndex: 1, cruiseYRatio: 0.19, healthMultiplier: 1.08, rewardMultiplier: 0.9 },
      { kind: 'tank', laneIndex: 4, cruiseYRatio: 0.24, healthMultiplier: 1.12, rewardMultiplier: 0.94 },
      { kind: 'hover', laneIndex: 2, cruiseYRatio: 0.22, healthMultiplier: 1.04, rewardMultiplier: 0.82 },
    ],
  },
];

const PRISM_BOSS_SCRIPT: ArenaEncounterScript = {
  id: 'prismCore',
  type: 'boss',
  label: 'Prism Core',
  announcement: 'Boss intercept. Break the prism core.',
  accentColor: '#FF89C0',
  rewardSalvage: 170,
  anchorKind: 'prismBoss',
  minTier: 6,
  steps: [
    {
      kind: 'prismBoss',
      anchor: true,
      xRatio: 0.5,
      cruiseYRatio: 0.21,
      healthMultiplier: 1.22,
      rewardMultiplier: 1.35,
      attackCooldownMultiplier: 0.92,
      vxMultiplier: 1,
    },
    { kind: 'hover', laneIndex: 1, healthMultiplier: 1.12, rewardMultiplier: 0.9 },
    { kind: 'hover', laneIndex: 4, healthMultiplier: 1.12, rewardMultiplier: 0.9 },
    {
      kind: 'sniper',
      laneIndex: 0,
      cruiseYRatio: 0.18,
      healthMultiplier: 1.08,
      rewardMultiplier: 0.94,
      attackCooldownMultiplier: 1.04,
    },
  ],
};

const HIVE_CARRIER_BOSS_SCRIPT: ArenaEncounterScript = {
  id: 'hiveCarrier',
  type: 'boss',
  label: 'Hive Carrier',
  announcement: 'Boss intercept. Break the hive carrier before the lane collapses.',
  accentColor: '#93F0D5',
  rewardSalvage: 182,
  anchorKind: 'hiveCarrierBoss',
  minTier: 12,
  steps: [
    {
      kind: 'hiveCarrierBoss',
      anchor: true,
      xRatio: 0.5,
      cruiseYRatio: 0.2,
      healthMultiplier: 1.18,
      rewardMultiplier: 1.38,
      attackCooldownMultiplier: 0.94,
      specialCooldownMultiplier: 0.94,
      deployChargeBonus: 4,
    },
    { kind: 'hover', laneIndex: 1, cruiseYRatio: 0.22, healthMultiplier: 1.1, rewardMultiplier: 0.88 },
    { kind: 'hover', laneIndex: 4, cruiseYRatio: 0.22, healthMultiplier: 1.1, rewardMultiplier: 0.88 },
    { kind: 'carrier', laneIndex: 2, cruiseYRatio: 0.18, healthMultiplier: 1.1, rewardMultiplier: 0.92 },
  ],
};

const PRISM_BOSS_PHASES: readonly ArenaBossPhaseDefinition[] = [
  {
    phaseIndex: 0,
    threshold: 1,
    label: 'Prism Core',
    announcement: 'Prism spread active. Clear the escorts and keep pressure on the core.',
    accentColor: '#FF89C0',
    steps: [],
  },
  {
    phaseIndex: 1,
    threshold: 0.7,
    label: 'Shield Lattice',
    announcement: 'Shield lattice online. Wardens are linking protection to the prism core.',
    accentColor: '#8CE7FF',
    steps: [
      { kind: 'warden', laneIndex: 1, cruiseYRatio: 0.18, healthMultiplier: 1.18, rewardMultiplier: 0.92 },
      { kind: 'warden', laneIndex: 4, cruiseYRatio: 0.18, healthMultiplier: 1.18, rewardMultiplier: 0.92 },
      { kind: 'hover', laneIndex: 2, healthMultiplier: 1.08, rewardMultiplier: 0.82 },
    ],
  },
  {
    phaseIndex: 2,
    threshold: 0.35,
    label: 'Overload Sweep',
    announcement: 'Overload sweep triggered. Lancers are carving the lane.',
    accentColor: '#FFD5A6',
    steps: [
      { kind: 'lancer', laneIndex: 1, cruiseYRatio: 0.2, healthMultiplier: 1.16, rewardMultiplier: 0.92 },
      { kind: 'lancer', laneIndex: 4, cruiseYRatio: 0.2, healthMultiplier: 1.16, rewardMultiplier: 0.92 },
      { kind: 'burst', laneIndex: 3, cruiseYRatio: 0.24, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
    ],
  },
];

const HIVE_CARRIER_PHASES: readonly ArenaBossPhaseDefinition[] = [
  {
    phaseIndex: 0,
    threshold: 1,
    label: 'Hive Carrier',
    announcement: 'Escort bays are active. Cut through the first wave and pressure the carrier.',
    accentColor: '#93F0D5',
    steps: [],
  },
  {
    phaseIndex: 1,
    threshold: 0.7,
    label: 'Siege Barrage',
    announcement: 'Siege bays opening. Artillery rounds are targeting the lower arena.',
    accentColor: '#FFC7A6',
    steps: [
      {
        kind: 'artillery',
        laneIndex: 1,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.18,
        rewardMultiplier: 0.9,
        specialCooldownMultiplier: 0.84,
      },
      {
        kind: 'artillery',
        laneIndex: 4,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.18,
        rewardMultiplier: 0.9,
        specialCooldownMultiplier: 0.84,
      },
      { kind: 'hover', laneIndex: 2, cruiseYRatio: 0.22, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
    ],
  },
  {
    phaseIndex: 2,
    threshold: 0.35,
    label: 'Collapse Mix',
    announcement: 'Collapse mix active. The carrier is combining shelling, escorts, and lancer lanes.',
    accentColor: '#F7D6A2',
    steps: [
      {
        kind: 'artillery',
        laneIndex: 1,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.2,
        rewardMultiplier: 0.94,
        specialCooldownMultiplier: 0.8,
      },
      { kind: 'lancer', laneIndex: 4, cruiseYRatio: 0.2, healthMultiplier: 1.14, rewardMultiplier: 0.9 },
      { kind: 'hover', laneIndex: 2, cruiseYRatio: 0.22, healthMultiplier: 1.06, rewardMultiplier: 0.82 },
      { kind: 'burst', laneIndex: 3, cruiseYRatio: 0.23, healthMultiplier: 1.08, rewardMultiplier: 0.84 },
    ],
  },
];

const BOSS_PHASES: Record<'prismCore' | 'hiveCarrier', readonly ArenaBossPhaseDefinition[]> = {
  prismCore: PRISM_BOSS_PHASES,
  hiveCarrier: HIVE_CARRIER_PHASES,
};

const ENCOUNTER_REGISTRY: Record<ArenaEncounterScriptId, ArenaEncounterScript> = {
  shieldScreen: FORMATION_SCRIPTS[0],
  lancerSweep: FORMATION_SCRIPTS[1],
  fortifiedBombard: FORMATION_SCRIPTS[2],
  escortRelay: FORMATION_SCRIPTS[3],
  carrierSurge: FORMATION_SCRIPTS[4],
  crossfireLattice: FORMATION_SCRIPTS[5],
  artilleryNet: FORMATION_SCRIPTS[6],
  siegeScreen: FORMATION_SCRIPTS[7],
  impactCorridor: FORMATION_SCRIPTS[8],
  interceptorSweep: MINI_BOSS_SCRIPTS[0],
  bombardWing: MINI_BOSS_SCRIPTS[1],
  wardenBastion: MINI_BOSS_SCRIPTS[2],
  lancerSpearhead: MINI_BOSS_SCRIPTS[3],
  carrierNest: MINI_BOSS_SCRIPTS[4],
  artilleryBastion: MINI_BOSS_SCRIPTS[5],
  prismCore: PRISM_BOSS_SCRIPT,
  hiveCarrier: HIVE_CARRIER_BOSS_SCRIPT,
};

const BOSS_ROTATION = [PRISM_BOSS_SCRIPT, HIVE_CARRIER_BOSS_SCRIPT] as const;

function pickWeightedScript(scripts: readonly ArenaEncounterScript[]) {
  const weightedPool = scripts.flatMap((script) =>
    Array.from({ length: Math.max(1, script.selectionWeight ?? 1) }, () => script)
  );
  return weightedPool[Math.floor(Math.random() * weightedPool.length)] ?? null;
}

export function getArenaEncounterScript(scriptId: ArenaEncounterScriptId) {
  return ENCOUNTER_REGISTRY[scriptId];
}

export function getArenaBossPhaseDefinition(scriptId: Extract<ArenaEncounterScriptId, 'prismCore' | 'hiveCarrier'>, phaseIndex: 0 | 1 | 2) {
  return BOSS_PHASES[scriptId][phaseIndex];
}

export function createEncounterForTier(displayTier: number): ArenaEncounter | null {
  if (displayTier >= ARENA_BOSS_TIER_INTERVAL && displayTier % ARENA_BOSS_TIER_INTERVAL === 0) {
    const bossIndex = Math.max(0, Math.floor(displayTier / ARENA_BOSS_TIER_INTERVAL) - 1);
    const script = BOSS_ROTATION[bossIndex % BOSS_ROTATION.length] ?? PRISM_BOSS_SCRIPT;
    return {
      type: 'boss',
      scriptId: script.id,
      label: script.label,
      accentColor: script.accentColor,
      anchorKind: script.anchorKind ?? script.steps[0]?.kind ?? 'prismBoss',
      anchorEnemyId: null,
      rewardSalvage: script.rewardSalvage,
      startedAtTier: displayTier,
      announcement: script.announcement,
      bossPhaseIndex: 0,
    };
  }

  if (displayTier >= ARENA_MINI_BOSS_TIER_INTERVAL && displayTier % ARENA_MINI_BOSS_TIER_INTERVAL === 0) {
    const eligibleScripts = MINI_BOSS_SCRIPTS.filter((script) => script.minTier <= displayTier);
    const rotationIndex = Math.max(0, Math.floor(displayTier / ARENA_MINI_BOSS_TIER_INTERVAL) - 1);
    const script = eligibleScripts[rotationIndex % eligibleScripts.length] ?? MINI_BOSS_SCRIPTS[0];
    return {
      type: 'miniBoss',
      scriptId: script.id,
      label: script.label,
      accentColor: script.accentColor,
      anchorKind: script.anchorKind ?? script.steps[0]?.kind ?? 'interceptor',
      anchorEnemyId: null,
      rewardSalvage: script.rewardSalvage,
      startedAtTier: displayTier,
      announcement: script.announcement,
      bossPhaseIndex: 0,
    };
  }

  return null;
}

export function pickFormationScript(
  displayTier: number,
  remainingCapacity: number,
  bulletPressure: number,
  hazardPressure: number
) {
  const eligibleScripts = FORMATION_SCRIPTS.filter((script) => {
    if (script.minTier > displayTier) {
      return false;
    }
    if ((script.requiredCapacity ?? 0) > remainingCapacity) {
      return false;
    }
    if (script.maxBulletPressure !== undefined && bulletPressure > script.maxBulletPressure) {
      return false;
    }
    if (script.maxHazardPressure !== undefined && hazardPressure > script.maxHazardPressure) {
      return false;
    }
    return true;
  });

  if (eligibleScripts.length === 0) {
    return null;
  }

  return pickWeightedScript(eligibleScripts);
}
