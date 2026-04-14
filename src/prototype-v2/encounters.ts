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
      {
        kind: 'hover',
        laneOffset: -1,
      },
      {
        kind: 'hover',
        laneOffset: 1,
      },
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
      {
        kind: 'hover',
        laneIndex: 2,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.82,
      },
      {
        kind: 'orbiter',
        laneIndex: 4,
        healthMultiplier: 1.06,
        rewardMultiplier: 0.88,
      },
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
      {
        kind: 'tank',
        laneIndex: 1,
        cruiseYRatio: 0.24,
        healthMultiplier: 1.18,
        rewardMultiplier: 0.92,
      },
      {
        kind: 'tank',
        laneIndex: 4,
        cruiseYRatio: 0.24,
        healthMultiplier: 1.18,
        rewardMultiplier: 0.92,
      },
      {
        kind: 'burst',
        laneIndex: 3,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.84,
      },
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
      {
        kind: 'hover',
        laneIndex: 1,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.84,
      },
      {
        kind: 'hover',
        laneIndex: 4,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.84,
      },
      {
        kind: 'sniper',
        laneIndex: 5,
        cruiseYRatio: 0.17,
        healthMultiplier: 1.06,
        rewardMultiplier: 0.9,
      },
    ],
  },
];

const BOSS_SCRIPT: ArenaEncounterScript = {
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
    {
      kind: 'hover',
      laneIndex: 1,
      healthMultiplier: 1.12,
      rewardMultiplier: 0.9,
    },
    {
      kind: 'hover',
      laneIndex: 4,
      healthMultiplier: 1.12,
      rewardMultiplier: 0.9,
    },
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

export const PRISM_BOSS_PHASES: readonly ArenaBossPhaseDefinition[] = [
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
      {
        kind: 'warden',
        laneIndex: 1,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.18,
        rewardMultiplier: 0.92,
      },
      {
        kind: 'warden',
        laneIndex: 4,
        cruiseYRatio: 0.18,
        healthMultiplier: 1.18,
        rewardMultiplier: 0.92,
      },
      {
        kind: 'hover',
        laneIndex: 2,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.82,
      },
    ],
  },
  {
    phaseIndex: 2,
    threshold: 0.35,
    label: 'Overload Sweep',
    announcement: 'Overload sweep triggered. Lancers are carving the lane.',
    accentColor: '#FFD5A6',
    steps: [
      {
        kind: 'lancer',
        laneIndex: 1,
        cruiseYRatio: 0.2,
        healthMultiplier: 1.16,
        rewardMultiplier: 0.92,
      },
      {
        kind: 'lancer',
        laneIndex: 4,
        cruiseYRatio: 0.2,
        healthMultiplier: 1.16,
        rewardMultiplier: 0.92,
      },
      {
        kind: 'burst',
        laneIndex: 3,
        cruiseYRatio: 0.24,
        healthMultiplier: 1.08,
        rewardMultiplier: 0.84,
      },
    ],
  },
];

const ENCOUNTER_REGISTRY: Record<ArenaEncounterScriptId, ArenaEncounterScript> = {
  shieldScreen: FORMATION_SCRIPTS[0],
  lancerSweep: FORMATION_SCRIPTS[1],
  fortifiedBombard: FORMATION_SCRIPTS[2],
  interceptorSweep: MINI_BOSS_SCRIPTS[0],
  bombardWing: MINI_BOSS_SCRIPTS[1],
  wardenBastion: MINI_BOSS_SCRIPTS[2],
  lancerSpearhead: MINI_BOSS_SCRIPTS[3],
  prismCore: BOSS_SCRIPT,
};

function pickWeightedScript(scripts: readonly ArenaEncounterScript[]) {
  const weightedPool = scripts.flatMap((script) =>
    Array.from({ length: Math.max(1, script.selectionWeight ?? 1) }, () => script)
  );
  return weightedPool[Math.floor(Math.random() * weightedPool.length)] ?? null;
}

export function getArenaEncounterScript(scriptId: ArenaEncounterScriptId) {
  return ENCOUNTER_REGISTRY[scriptId];
}

export function getArenaBossPhaseDefinition(phaseIndex: 0 | 1 | 2) {
  return PRISM_BOSS_PHASES[phaseIndex];
}

export function createEncounterForTier(displayTier: number): ArenaEncounter | null {
  if (displayTier >= ARENA_BOSS_TIER_INTERVAL && displayTier % ARENA_BOSS_TIER_INTERVAL === 0) {
    return {
      type: 'boss',
      scriptId: BOSS_SCRIPT.id,
      label: BOSS_SCRIPT.label,
      accentColor: BOSS_SCRIPT.accentColor,
      anchorKind: BOSS_SCRIPT.anchorKind ?? 'prismBoss',
      anchorEnemyId: null,
      rewardSalvage: BOSS_SCRIPT.rewardSalvage,
      startedAtTier: displayTier,
      announcement: BOSS_SCRIPT.announcement,
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
      anchorKind: script.anchorKind ?? 'interceptor',
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
  bulletPressure: number
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
    return true;
  });

  if (eligibleScripts.length === 0) {
    return null;
  }

  return pickWeightedScript(eligibleScripts);
}
