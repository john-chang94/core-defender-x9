export type ArenaEnemyKind =
  | 'hover'
  | 'burst'
  | 'tank'
  | 'orbiter'
  | 'sniper'
  | 'bomber'
  | 'interceptor'
  | 'prismBoss';

export type ArenaEnemyShape = 'circle' | 'square' | 'diamond';

export type ArenaProjectileOwner = 'player' | 'enemy';
export type ArenaProjectileKind = 'primary' | 'missile' | 'shard' | 'enemy';
export type ArenaBuildId = 'railFocus' | 'novaBloom' | 'missileCommand' | 'fractureCore';
export type ArenaVfxQuality = 'balanced' | 'high';
export type ArenaEffectFlavor = ArenaBuildId | 'enemy' | 'neutral';

export type ArenaEffectKind =
  | 'burst'
  | 'warning'
  | 'shield'
  | 'pickup'
  | 'fractureBits'
  | 'ultimateRail'
  | 'ultimateNova'
  | 'ultimateMissile'
  | 'ultimateFracture';

export type ArenaDropType = 'hullPatch' | 'shieldCell' | 'overdrive' | 'salvageBurst';

export type ArenaArmoryUpgradeKey =
  | 'damageMatrix'
  | 'rapidCycle'
  | 'twinArray'
  | 'phasePierce'
  | 'shieldCapacitor'
  | 'hullWeave'
  | 'accelerator';

export type ArenaEncounterType = 'miniBoss' | 'boss';

export type ArenaWeapon = {
  damage: number;
  fireInterval: number;
  shotCount: number;
  pierce: number;
  bulletSpeed: number;
  bulletSize: number;
  spread: number;
};

export type ArenaProjectile = {
  id: string;
  owner: ArenaProjectileOwner;
  kind: ArenaProjectileKind;
  buildFlavor?: ArenaBuildId;
  enemyStyle?: 'bolt' | 'orb' | 'needle' | 'bomb' | 'wave';
  driftAmp?: number;
  driftFreq?: number;
  driftPhase?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homing?: number;
  damage: number;
  size: number;
  color: string;
  age: number;
  maxAge: number;
  pierce: number;
};

export type ArenaEnemy = {
  id: string;
  kind: ArenaEnemyKind;
  shape: ArenaEnemyShape;
  x: number;
  y: number;
  vx: number;
  aimAngle: number;
  cruiseY: number;
  size: number;
  health: number;
  maxHealth: number;
  attackCooldown: number;
  windupTimer: number;
  flash: number;
  burnTimer: number;
  burnDps: number;
  inFormation: boolean;
  phase: number;
  color: string;
  reward: number;
};

export type ArenaEncounter = {
  type: ArenaEncounterType;
  label: string;
  accentColor: string;
  anchorKind: ArenaEnemyKind;
  rewardSalvage: number;
  startedAtTier: number;
};

export type ArenaEffect = {
  id: string;
  kind: ArenaEffectKind;
  flavor?: ArenaEffectFlavor;
  intensity?: number;
  angle?: number;
  x: number;
  y: number;
  size: number;
  color: string;
  age: number;
  duration: number;
};

export type ArenaDrop = {
  id: string;
  type: ArenaDropType;
  x: number;
  y: number;
  size: number;
  speed: number;
  label: string;
  color: string;
  age: number;
};

export type ArenaArmoryChoice = {
  title: string;
  prompt: string;
  cost: number;
  options: ArenaArmoryUpgradeKey[];
  source: 'standard' | 'boss';
};

export type ArenaGameState = {
  status: 'running' | 'lost';
  elapsed: number;
  score: number;
  salvage: number;
  nextArmoryCost: number;
  activeBuild: ArenaBuildId;
  playerX: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  shieldRegenCooldown: number;
  playerFlash: number;
  overclockTimer: number;
  overclockVisualBlend: number;
  ultimateCharge: number;
  ultimateTimer: number;
  ultimateBuild: ArenaBuildId | null;
  ultimateColumns: number[];
  weapon: ArenaWeapon;
  enemies: ArenaEnemy[];
  drops: ArenaDrop[];
  playerBullets: ArenaProjectile[];
  enemyBullets: ArenaProjectile[];
  effects: ArenaEffect[];
  fireCooldown: number;
  missileCooldown: number;
  missileBurstTimer: number;
  missileBurstInterval: number;
  pendingMissileOffsets: number[];
  pendingMissileDamageScale: number;
  enemySpawnCooldown: number;
  nextBulletId: number;
  nextEnemyId: number;
  nextDropId: number;
  nextEffectId: number;
  pickupMessage: string | null;
  pickupTimer: number;
  activeEncounter: ArenaEncounter | null;
  lastProcessedDisplayTier: number;
  encounterAnnouncement: string | null;
  encounterAnnouncementColor: string | null;
  encounterAnnouncementTimer: number;
  pendingArmoryChoice: ArenaArmoryChoice | null;
};
