import type { ArenaBuildId } from './types';

export const ARENA_BUILD_ORDER: readonly ArenaBuildId[] = [
  'railFocus',
  'novaBloom',
  'missileCommand',
  'fractureCore',
];

export const ARENA_BUILD_META: Record<
  ArenaBuildId,
  {
    label: string;
    shortLabel: string;
    accent: string;
    summary: string;
    description: string;
    ultimateLabel: string;
    ultimateDescription: string;
  }
> = {
  railFocus: {
    label: 'Rail Focus',
    shortLabel: 'Rail',
    accent: '#9BCBFF',
    summary: 'Precision profile. Heavy single-shot pressure with high pierce.',
    description:
      'Concentrates power into tight, high-pierce lances that punish elites and bosses. Lower spread, stronger direct impact, and cleaner long-lane control.',
    ultimateLabel: 'Rail Surge',
    ultimateDescription:
      'Marks the highest-threat enemies and drops concentrated rail lances on each marked lane.',
  },
  novaBloom: {
    label: 'Nova Bloom',
    shortLabel: 'Nova',
    accent: '#FFB8D9',
    summary: 'Spread profile. Fast volley pressure with burn stacking.',
    description:
      'Accelerates primary fire into a broad spread that continuously layers burn damage. Excellent for crowd control and area denial against dense waves.',
    ultimateLabel: 'Solar Bloom',
    ultimateDescription:
      'Unleashes a wide solar sweep, overdrives the ship, and applies heavy lingering burn across the field.',
  },
  missileCommand: {
    label: 'Missile Command',
    shortLabel: 'Missile',
    accent: '#FFD097',
    summary: 'Ordnance profile. Primary fire plus auto-homing missile pressure.',
    description:
      'Pairs core gunfire with autonomous homing missiles and splash impact. Best for tracking evasive targets and stabilizing multi-lane pressure.',
    ultimateLabel: 'Missile Barrage',
    ultimateDescription:
      'Launches a synchronized barrage pattern with repeated strike lanes and high splash pressure.',
  },
  fractureCore: {
    label: 'Fracture Core',
    shortLabel: 'Fracture',
    accent: '#B9D5FF',
    summary: 'Fragment profile. Impact shatter chains into shard bursts.',
    description:
      'Converts impacts into fragmentation chains that split into secondary shard hits. Excels when enemies cluster and chip damage can cascade.',
    ultimateLabel: 'Cascade Break',
    ultimateDescription:
      'Triggers field-wide shatter pulses that erupt into fragment storms across multiple enemy groups.',
  },
};
