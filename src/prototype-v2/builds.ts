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
    summary: 'Precision profile. Tight, high-pierce pressure for elites and bosses.',
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
    summary: 'Spread profile. Wide fan pressure built for crowd control.',
    description:
      'Pushes the primary guns into a wide bloom pattern that covers lanes and chews through clustered enemies. Best when pressure comes from density rather than a single elite target.',
    ultimateLabel: 'Solar Bloom',
    ultimateDescription:
      'Unleashes a wide solar sweep that slams the whole field without triggering overdrive.',
  },
  missileCommand: {
    label: 'Missile Command',
    shortLabel: 'Missile',
    accent: '#FFD097',
    summary: 'Ordnance profile. Sequential homing volleys with strong splash.',
    description:
      'Drops the standard gun loop and fires homing missiles one at a time inside each volley window. Built for off-axis pressure, splash damage, and chasing evasive targets.',
    ultimateLabel: 'Missile Barrage',
    ultimateDescription:
      'Launches repeated strike volleys and layered lane barrages for heavy ordnance pressure.',
  },
  fractureCore: {
    label: 'Fracture Core',
    shortLabel: 'Fracture',
    accent: '#B9D5FF',
    summary: 'Fragment profile. Heavy impacts split into shard bursts.',
    description:
      'Fires slower, heavier core shots that crack apart on impact and throw damaging fragments through clustered enemies. Best when targets overlap and shatter damage can chain.',
    ultimateLabel: 'Cascade Break',
    ultimateDescription:
      'Detonates randomized fracture fields across the upper arena and erupts into chained shard storms.',
  },
};
