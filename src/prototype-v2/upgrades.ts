import type { ArenaArmoryChoice, ArenaArmoryUpgradeKey, ArenaWeapon } from './types';

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const ARENA_ARMORY_UPGRADES: Record<
  ArenaArmoryUpgradeKey,
  {
    label: string;
    summary: string;
    apply: (weapon: ArenaWeapon) => ArenaWeapon;
    applyMeta?: {
      hullBonus?: number;
      shieldBonus?: number;
    };
  }
> = {
  damageMatrix: {
    label: 'Damage Matrix',
    summary: '+3 damage per shot.',
    apply: (weapon) => ({
      ...weapon,
      damage: weapon.damage + 3,
    }),
  },
  rapidCycle: {
    label: 'Rapid Cycle',
    summary: 'Cuts fire interval by 12% for faster RoF.',
    apply: (weapon) => ({
      ...weapon,
      fireInterval: Math.max(0.055, weapon.fireInterval * 0.88),
    }),
  },
  twinArray: {
    label: 'Twin Array',
    summary: '+1 primary barrel and a slightly wider spread.',
    apply: (weapon) => ({
      ...weapon,
      shotCount: Math.min(4, weapon.shotCount + 1),
      spread: Math.min(26, weapon.spread + 3),
    }),
  },
  phasePierce: {
    label: 'Phase Pierce',
    summary: '+1 pierce. Shots pass through one more target.',
    apply: (weapon) => ({
      ...weapon,
      pierce: Math.min(3, weapon.pierce + 1),
    }),
  },
  shieldCapacitor: {
    label: 'Shield Capacitor',
    summary: '+16 max shield.',
    apply: (weapon) => weapon,
    applyMeta: {
      shieldBonus: 16,
    },
  },
  hullWeave: {
    label: 'Reinforced Plating',
    summary: '+20 max health.',
    apply: (weapon) => weapon,
    applyMeta: {
      hullBonus: 20,
    },
  },
  accelerator: {
    label: 'Accelerator',
    summary: '+160 projectile speed and +0.5 shot size.',
    apply: (weapon) => ({
      ...weapon,
      bulletSpeed: Math.min(1500, weapon.bulletSpeed + 160),
      bulletSize: Math.min(11.5, weapon.bulletSize + 0.5),
    }),
  },
};

const ALL_ARENA_ARMORY_UPGRADES = Object.keys(ARENA_ARMORY_UPGRADES) as ArenaArmoryUpgradeKey[];

export function createArenaArmoryChoice(cost: number): ArenaArmoryChoice {
  const pool = [...ALL_ARENA_ARMORY_UPGRADES];
  const options: ArenaArmoryUpgradeKey[] = [];

  while (pool.length > 0 && options.length < 3) {
    const pick = randomChoice(pool);
    options.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }

  return {
    title: 'Armory Draft',
    prompt: 'Spend salvage to harden the run. Pick one permanent upgrade.',
    cost,
    options,
    source: 'standard',
  };
}

export function createArenaBossArmoryChoice(): ArenaArmoryChoice {
  const pool = [...ALL_ARENA_ARMORY_UPGRADES];
  const options: ArenaArmoryUpgradeKey[] = [];

  while (pool.length > 0 && options.length < 4) {
    const pick = randomChoice(pool);
    options.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }

  return {
    title: 'Boss Cache',
    prompt: 'Prism wreckage exposed a clean tech cache. Pick one premium install for free.',
    cost: 0,
    options,
    source: 'boss',
  };
}
