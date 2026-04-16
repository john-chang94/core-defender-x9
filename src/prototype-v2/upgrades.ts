import type {
  ArenaArmoryChoice,
  ArenaArmoryUpgradeKey,
  ArenaWeapon,
} from "./types";

export type ArenaArmoryUpgradeDefinition = {
  label: string;
  summary: string;
  icon: string;
  statLine: string;
  compactHint: string;
  apply: (weapon: ArenaWeapon) => ArenaWeapon;
  applyMeta?: {
    hullBonus?: number;
    shieldBonus?: number;
  };
};

export const ARENA_ARMORY_UPGRADES: Record<
  ArenaArmoryUpgradeKey,
  ArenaArmoryUpgradeDefinition
> = {
  damageMatrix: {
    label: "Damage Matrix",
    summary: "+3 damage per shot.",
    icon: "✦",
    statLine: "DMG +3",
    compactHint: "Harder hit",
    apply: (weapon) => ({
      ...weapon,
      damage: weapon.damage + 3,
    }),
  },
  rapidCycle: {
    label: "Rapid Cycle",
    summary: "Increase rate of fire by 12% and tighten spread.",
    icon: "⏱",
    statLine: "RoF +12%",
    compactHint: "Faster loop",
    apply: (weapon) => ({
      ...weapon,
      fireInterval: Math.max(0.065, weapon.fireInterval * 0.88),
      spread: Math.max(8, Math.round(weapon.spread * 0.94)),
    }),
  },
  twinArray: {
    label: "Twin Array",
    summary: "+1 primary barrel and a slightly wider spread.",
    icon: "∥",
    statLine: "GUN +1",
    compactHint: "Extra barrel",
    apply: (weapon) => ({
      ...weapon,
      shotCount: Math.min(4, weapon.shotCount + 1),
      spread: Math.min(26, weapon.spread + 3),
    }),
  },
  phasePierce: {
    label: "Phase Pierce",
    summary: "+1 pierce. Shots pass through one more target.",
    icon: "⟐",
    statLine: "PIER +1",
    compactHint: "Pass through",
    apply: (weapon) => ({
      ...weapon,
      pierce: Math.min(3, weapon.pierce + 1),
    }),
  },
  shieldCapacitor: {
    label: "Shield Capacitor",
    summary: "+16 max shield.",
    icon: "🛡",
    statLine: "SHD +16",
    compactHint: "More shield",
    apply: (weapon) => weapon,
    applyMeta: {
      shieldBonus: 16,
    },
  },
  hullWeave: {
    label: "Reinforced Plating",
    summary: "+20 max health.",
    icon: "+",
    statLine: "HP +20",
    compactHint: "More health",
    apply: (weapon) => weapon,
    applyMeta: {
      hullBonus: 20,
    },
  },
  accelerator: {
    label: "Accelerator",
    summary: "+240 projectile speed, +0.7 shot size, +1 pierce.",
    icon: "➤",
    statLine: "SPD+ / SIZE+",
    compactHint: "Faster rounds",
    apply: (weapon) => ({
      ...weapon,
      bulletSpeed: Math.min(1700, weapon.bulletSpeed + 240),
      bulletSize: Math.min(12.5, weapon.bulletSize + 0.7),
      pierce: Math.min(4, weapon.pierce + 1),
    }),
  },
};

export const ARENA_ARMORY_UPGRADE_ORDER = Object.keys(
  ARENA_ARMORY_UPGRADES,
) as ArenaArmoryUpgradeKey[];

export function isArenaArmoryUpgradeMaxed(
  key: ArenaArmoryUpgradeKey,
  weapon: ArenaWeapon,
) {
  const epsilon = 0.0001;
  switch (key) {
    case "damageMatrix":
      return false;
    case "rapidCycle":
      return weapon.fireInterval <= 0.065 + epsilon;
    case "twinArray":
      return weapon.shotCount >= 4;
    case "phasePierce":
      return weapon.pierce >= 3;
    case "shieldCapacitor":
    case "hullWeave":
      return false;
    case "accelerator":
      return (
        weapon.bulletSpeed >= 1700 - epsilon &&
        weapon.bulletSize >= 12.5 - epsilon &&
        weapon.pierce >= 4
      );
  }
}

export function createArenaArmoryChoice(cost: number): ArenaArmoryChoice {
  return {
    title: "Armory Draft",
    prompt: "Spend salvage to harden the run. Pick one permanent upgrade.",
    cost,
    options: [...ARENA_ARMORY_UPGRADE_ORDER],
    source: "standard",
  };
}

export function createArenaBossArmoryChoice(bossLabel = "Boss"): ArenaArmoryChoice {
  return {
    title: "Boss Cache",
    prompt:
      `${bossLabel} wreckage exposed a clean tech cache. Pick one premium install for free.`,
    cost: 0,
    options: [...ARENA_ARMORY_UPGRADE_ORDER],
    source: "boss",
  };
}
