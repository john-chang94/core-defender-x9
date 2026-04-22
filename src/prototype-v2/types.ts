export type ArenaEnemyKind =
  | 'hover'
  | 'burst'
  | 'tank'
  | 'orbiter'
  | 'sniper'
  | 'bomber'
  | 'interceptor'
  | 'warden'
  | 'lancer'
  | 'carrier'
  | 'artillery'
  | 'weaver'
  | 'conductor'
  | 'prismBoss'
  | 'hiveCarrierBoss'
  | 'vectorLoomBoss';

export type ArenaEnemyShape = 'circle' | 'square' | 'diamond';

export type ArenaProjectileOwner = 'player' | 'enemy';
export type ArenaProjectileKind = 'primary' | 'missile' | 'shard' | 'enemy';
export type ArenaBuildId = 'railFocus' | 'novaBloom' | 'missileCommand' | 'fractureCore';
export type ArenaVfxQuality = 'balanced' | 'high';
export type ArenaEffectFlavor = ArenaBuildId | 'enemy' | 'neutral';
export type ArenaBiomeId = 'prismVerge' | 'hiveForge' | 'vectorSpindle';
export type ArenaBuildValueMap<T> = Record<ArenaBuildId, T>;
export type ArenaEnemyValueMap<T> = Record<ArenaEnemyKind, T>;
export type ArenaUnlockValueMap<T> = Record<ArenaUnlockId, T>;
export type ArenaCosmeticValueMap<T> = Record<ArenaCosmeticId, T>;
export type ArenaCoachHintValueMap<T> = Record<ArenaCoachHintId, T>;

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

export type ArenaBiomePlateStyle = {
  color: string;
  stroke: string;
};

export type ArenaBiomeOrbStyle = {
  color: string;
  opacity: number;
};

export type ArenaBiomeSweepStyle = {
  color: string;
  opacity: number;
};

export type ArenaBiomeDefinition = {
  id: ArenaBiomeId;
  label: string;
  subtitle: string;
  accentColor: string;
  detailColor: string;
  glowColor: string;
  base: string;
  auraA: string;
  auraB: string;
  enemyZone: string;
  boundary: string;
  grid: string;
  overlay: string;
  flow: string;
  pulse: string;
  headerBackground: string;
  headerBorder: string;
  menuSurface: string;
  menuStripe: string;
  announcementGlow: string;
  backgroundPlates: readonly ArenaBiomePlateStyle[];
  atmosphereOrbs: readonly ArenaBiomeOrbStyle[];
  energySweeps: readonly ArenaBiomeSweepStyle[];
};

export type ArenaAudioSettings = {
  soundEnabled: boolean;
  musicEnabled: boolean;
  sfxVolume: number;
  musicVolume: number;
};

export type ArenaAudioCueKey =
  | 'playerRail'
  | 'playerNova'
  | 'playerMissile'
  | 'playerFracture'
  | 'enemyOrb'
  | 'enemyBolt'
  | 'enemyNeedle'
  | 'enemyBomb'
  | 'enemyWave'
  | 'hazardTelegraph'
  | 'hazardImpact'
  | 'pickup'
  | 'armoryOpen'
  | 'armoryUpgrade'
  | 'overdriveStart'
  | 'overdriveEnd'
  | 'ultimate'
  | 'bossIntro'
  | 'bossPhase'
  | 'bossKill'
  | 'playerHit'
  | 'playerLoss';

export type ArenaDropType = 'hullPatch' | 'shieldCell' | 'overdrive' | 'salvageBurst';

export type ArenaArmoryUpgradeKey =
  | 'damageMatrix'
  | 'rapidCycle'
  | 'twinArray'
  | 'phasePierce'
  | 'shieldCapacitor'
  | 'hullWeave'
  | 'accelerator';

export type ArenaEncounterType = 'formation' | 'miniBoss' | 'boss';
export type ArenaEncounterScriptId =
  | 'shieldScreen'
  | 'lancerSweep'
  | 'fortifiedBombard'
  | 'escortRelay'
  | 'carrierSurge'
  | 'crossfireLattice'
  | 'artilleryNet'
  | 'siegeScreen'
  | 'impactCorridor'
  | 'threadGate'
  | 'crossWeave'
  | 'conductorShift'
  | 'suppressionRail'
  | 'pinnedScreen'
  | 'corridorCollapse'
  | 'interceptorSweep'
  | 'bombardWing'
  | 'wardenBastion'
  | 'lancerSpearhead'
  | 'carrierNest'
  | 'artilleryBastion'
  | 'weaverLoom'
  | 'conductorArray'
  | 'prismCore'
  | 'hiveCarrier'
  | 'vectorLoom';

export type ArenaHazardKind = 'impact' | 'laneBand';

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
  supportCooldown: number;
  specialCooldown: number;
  protectedTimer: number;
  protectedByEnemyId: string | null;
  laneTargetX: number | null;
  deployCharges: number;
  encounterTag: ArenaEncounterScriptId | null;
};

export type ArenaEncounterSpawnStep = {
  kind: ArenaEnemyKind;
  anchor?: boolean;
  laneIndex?: number;
  laneOffset?: number;
  xRatio?: number;
  cruiseYRatio?: number;
  healthMultiplier?: number;
  rewardMultiplier?: number;
  attackCooldownMultiplier?: number;
  vxMultiplier?: number;
  supportCooldownMultiplier?: number;
  specialCooldownMultiplier?: number;
  deployChargeBonus?: number;
};

export type ArenaEncounterScript = {
  id: ArenaEncounterScriptId;
  type: ArenaEncounterType;
  label: string;
  announcement: string;
  accentColor: string;
  rewardSalvage: number;
  anchorKind?: ArenaEnemyKind;
  minTier: number;
  requiredCapacity?: number;
  maxBulletPressure?: number;
  maxHazardPressure?: number;
  selectionWeight?: number;
  steps: ArenaEncounterSpawnStep[];
};

export type ArenaBossPhaseDefinition = {
  phaseIndex: 0 | 1 | 2;
  threshold: number;
  label: string;
  announcement: string;
  accentColor: string;
  steps: ArenaEncounterSpawnStep[];
};

export type ArenaEncounter = {
  type: Extract<ArenaEncounterType, 'miniBoss' | 'boss'>;
  scriptId: ArenaEncounterScriptId;
  label: string;
  accentColor: string;
  anchorKind: ArenaEnemyKind;
  anchorEnemyId: string | null;
  rewardSalvage: number;
  startedAtTier: number;
  announcement: string;
  bossPhaseIndex: 0 | 1 | 2;
};

type ArenaHazardBase = {
  id: string;
  kind: ArenaHazardKind;
  damage: number;
  age: number;
  warningDuration: number;
  lingerDuration: number;
  triggered: boolean;
  color: string;
  accentColor: string;
  sourceEnemyId: string | null;
  ownerKind: ArenaEnemyKind | null;
  encounterTag: ArenaEncounterScriptId | null;
};

export type ArenaImpactHazard = ArenaHazardBase & {
  kind: 'impact';
  x: number;
  y: number;
  radius: number;
};

export type ArenaLaneBandHazard = ArenaHazardBase & {
  kind: 'laneBand';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArenaHazard = ArenaImpactHazard | ArenaLaneBandHazard;

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

export type ArenaCodexEnemyEntry = {
  kind: ArenaEnemyKind;
  label: string;
  discovered: boolean;
  firstSeenTier: number | null;
  firstKillTier: number | null;
  firstClearTier: number | null;
  totalKills: number;
  bossClears: number;
  summary: string;
};

export type ArenaCodexBuildEntry = {
  buildId: ArenaBuildId;
  label: string;
  shortLabel: string;
  summary: string;
  description: string;
  ultimateLabel: string;
  ultimateDescription: string;
};

export type ArenaBuildMastery = {
  buildId: ArenaBuildId;
  xp: number;
  level: number;
  title: string;
  runs: number;
  bestTier: number;
  miniBossClears: number;
  bossClears: number;
};

export type ArenaUnlockCategory = 'boss' | 'codex' | 'mastery';

export type ArenaUnlockId =
  | 'prismCoreFirstClear'
  | 'hiveCarrierFirstClear'
  | 'vectorLoomFirstClear'
  | 'bossTriadComplete'
  | 'singleRunBossTriadClear'
  | 'tier24Clear'
  | 'tier30Clear'
  | 'tier45Clear'
  | 'tier60Clear'
  | 'enemyCodexComplete'
  | 'railFocusMastery4'
  | 'railFocusMastery8'
  | 'railFocusMastery10'
  | 'novaBloomMastery4'
  | 'novaBloomMastery8'
  | 'novaBloomMastery10'
  | 'missileCommandMastery4'
  | 'missileCommandMastery8'
  | 'missileCommandMastery10'
  | 'fractureCoreMastery4'
  | 'fractureCoreMastery8'
  | 'fractureCoreMastery10';

export type ArenaUnlockEntry = {
  id: ArenaUnlockId;
  label: string;
  description: string;
  rewardLabel: string;
  category: ArenaUnlockCategory;
  buildId: ArenaBuildId | null;
  unlocked: boolean;
  unlockedAt: string | null;
  sourceMilestoneId: string | null;
};

export type ArenaCosmeticSlot = 'banner' | 'codexFrame' | 'buildAccent' | 'buildCrest';
export type ArenaCosmeticState = 'locked' | 'claimable' | 'owned';
export type ArenaCosmeticDisplayState = ArenaCosmeticState | 'equipped';
export type ArenaCosmeticSourceType = 'default' | 'reward' | 'season' | 'premium';
export type ArenaCosmeticRarity = 'common' | 'rare' | 'epic';

export type ArenaCosmeticId =
  | 'bannerDefault'
  | 'bannerPrismShard'
  | 'bannerHiveTrace'
  | 'bannerLoomStatic'
  | 'bannerTriadBreaker'
  | 'bannerDeepCycle'
  | 'codexFrameDefault'
  | 'codexFrameFullSpectrum'
  | 'codexFrameEndlessApex'
  | 'codexFrameTriadGrid'
  | 'codexFrameThreatCartographer'
  | 'codexFrameOuterLimit'
  | 'railFocusAccentDefault'
  | 'railFocusAccentHalo'
  | 'railFocusAccentApexRail'
  | 'novaBloomAccentDefault'
  | 'novaBloomAccentEcho'
  | 'novaBloomAccentSolarCrown'
  | 'missileCommandAccentDefault'
  | 'missileCommandAccentStrikeMesh'
  | 'missileCommandAccentSiegeMesh'
  | 'fractureCoreAccentDefault'
  | 'fractureCoreAccentFractureVein'
  | 'fractureCoreAccentSingularityVein'
  | 'railFocusCrestDefault'
  | 'railFocusCrestZenith'
  | 'novaBloomCrestDefault'
  | 'novaBloomCrestSolarBloom'
  | 'missileCommandCrestDefault'
  | 'missileCommandCrestOrdnanceCrown'
  | 'fractureCoreCrestDefault'
  | 'fractureCoreCrestShatterCrown';

export type ArenaCosmeticDefinition = {
  id: ArenaCosmeticId;
  label: string;
  description: string;
  slot: ArenaCosmeticSlot;
  buildId: ArenaBuildId | null;
  sourceType: ArenaCosmeticSourceType;
  rarity: ArenaCosmeticRarity;
  rewardUnlockId: ArenaUnlockId | null;
  primaryColor: string;
  secondaryColor: string;
  detailColor: string;
  glowColor: string;
  emblemKey?: string;
};

export type ArenaCosmeticOwnershipEntry = {
  id: ArenaCosmeticId;
  state: ArenaCosmeticState;
  claimedAt: string | null;
};

export type ArenaEquippedCosmetics = {
  banner: ArenaCosmeticId;
  codexFrame: ArenaCosmeticId;
  buildAccent: ArenaBuildValueMap<ArenaCosmeticId>;
  buildCrest: ArenaBuildValueMap<ArenaCosmeticId>;
};

export type ArenaCoachHintId =
  | 'movement'
  | 'salvageArmory'
  | 'buildSwitching'
  | 'overdrive'
  | 'ultimateCharge'
  | 'impactHazard'
  | 'laneBandHazard'
  | 'bossPhase'
  | 'collectionClaim'
  | 'tierRewards';

export type ArenaCoachHintEntry = {
  id: ArenaCoachHintId;
  seen: boolean;
  seenAt: string | null;
};

export type ArenaMetaState = {
  version: number;
  lastUpdatedAt: string;
  codexEnemies: ArenaEnemyValueMap<ArenaCodexEnemyEntry>;
  codexBuilds: ArenaBuildValueMap<ArenaCodexBuildEntry>;
  mastery: ArenaBuildValueMap<ArenaBuildMastery>;
  unlocks: ArenaUnlockValueMap<ArenaUnlockEntry>;
  cosmetics: ArenaCosmeticValueMap<ArenaCosmeticOwnershipEntry>;
  equippedCosmetics: ArenaEquippedCosmetics;
  coachHints: ArenaCoachHintValueMap<ArenaCoachHintEntry>;
};

export type ArenaRunMetaSummary = {
  dominantBuild: ArenaBuildId;
  currentBuild: ArenaBuildId;
  tierReached: number;
  miniBossClears: number;
  bossClears: number;
  bossClearCounts: ArenaEnemyValueMap<number>;
  buildActiveSeconds: ArenaBuildValueMap<number>;
  killCounts: ArenaEnemyValueMap<number>;
  firstSeenTierByEnemy: ArenaEnemyValueMap<number | null>;
  firstKillTierByEnemy: ArenaEnemyValueMap<number | null>;
  firstClearTierByEnemy: ArenaEnemyValueMap<number | null>;
};

export type ArenaGameState = {
  status: 'running' | 'lost';
  elapsed: number;
  score: number;
  salvage: number;
  nextArmoryCost: number;
  availableArmoryChoices: number;
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
  weaponsByBuild: ArenaBuildValueMap<ArenaWeapon>;
  enemies: ArenaEnemy[];
  drops: ArenaDrop[];
  hazards: ArenaHazard[];
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
  nextHazardId: number;
  nextEffectId: number;
  pickupMessage: string | null;
  pickupTimer: number;
  activeEncounter: ArenaEncounter | null;
  lastProcessedDisplayTier: number;
  encounterAnnouncement: string | null;
  encounterAnnouncementColor: string | null;
  encounterAnnouncementTimer: number;
  bestTierReached: number;
  runMiniBossClears: number;
  runBossClears: number;
  runBossClearsByEnemy: ArenaEnemyValueMap<number>;
  runBuildActiveSeconds: ArenaBuildValueMap<number>;
  runSeenTierByEnemy: ArenaEnemyValueMap<number | null>;
  runKillCountsByEnemy: ArenaEnemyValueMap<number>;
  runFirstKillTierByEnemy: ArenaEnemyValueMap<number | null>;
  runFirstClearTierByEnemy: ArenaEnemyValueMap<number | null>;
};
