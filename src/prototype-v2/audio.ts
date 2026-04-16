import AsyncStorage from '@react-native-async-storage/async-storage';
import megaWallMusic from '../../assets/awake10_megaWall.mp3';
import bombFireSfx from '../../assets/sfx/bomb-fire.wav';
import bombHitSfx from '../../assets/sfx/bomb-hit.wav';
import coldFireSfx from '../../assets/sfx/cold-fire.wav';
import hitSfx from '../../assets/sfx/hit.wav';
import lanceFireSfx from '../../assets/sfx/lance-fire.wav';
import laserFireSfx from '../../assets/sfx/laser-fire.wav';
import placeSfx from '../../assets/sfx/place.wav';
import spawnSfx from '../../assets/sfx/spawn.wav';
import sprayFireSfx from '../../assets/sfx/spray-fire.wav';
import targetModeSfx from '../../assets/sfx/target-mode.wav';
import upgradeSfx from '../../assets/sfx/upgrade.wav';
import warningSfx from '../../assets/sfx/warning.mp3';
import winSfx from '../../assets/sfx/win.wav';
import sciFiDataReadSfx from '../../assets/ui-interface/sci-fi-data-read.mp3';
import sciFiGlitchShortSfx from '../../assets/ui-interface/sci-fi-glitch-short.mp3';
import sciFiHitLarge01Sfx from '../../assets/ui-interface/sci-fi-hit-large-01.mp3';
import sciFiHitLarge02Sfx from '../../assets/ui-interface/sci-fi-hit-large-02.mp3';
import sciFiSwooshWhooshSmall01Sfx from '../../assets/ui-interface/sci-fi-swoosh-whoosh-small-01.mp3';
import sciFiNotificationWapSfx from '../../assets/ui-interface/sci-fi-notification-wap.wav';
import youLoseViolinEffectSfx from '../../assets/ui-interface/you-lose-violin-effect.mp3';

import type { ArenaAudioCueKey, ArenaAudioSettings, ArenaBiomeId } from './types';

export const ARENA_AUDIO_STORAGE_KEY = 'arena-v2-audio-v1';

export const DEFAULT_ARENA_AUDIO_SETTINGS: ArenaAudioSettings = {
  soundEnabled: true,
  musicEnabled: true,
  sfxVolume: 0.78,
  musicVolume: 0.42,
};

export const ARENA_AUDIO_CUE_FILES: Record<ArenaAudioCueKey, number> = {
  playerRail: laserFireSfx,
  playerNova: sprayFireSfx,
  playerMissile: bombFireSfx,
  playerFracture: coldFireSfx,
  enemyOrb: lanceFireSfx,
  enemyBolt: laserFireSfx,
  enemyNeedle: sciFiHitLarge02Sfx,
  enemyBomb: bombFireSfx,
  enemyWave: sciFiDataReadSfx,
  hazardTelegraph: warningSfx,
  hazardImpact: bombHitSfx,
  pickup: placeSfx,
  armoryOpen: targetModeSfx,
  armoryUpgrade: upgradeSfx,
  overdriveStart: spawnSfx,
  overdriveEnd: sciFiSwooshWhooshSmall01Sfx,
  ultimate: sciFiHitLarge01Sfx,
  bossIntro: warningSfx,
  bossPhase: sciFiNotificationWapSfx,
  bossKill: winSfx,
  playerHit: hitSfx,
  playerLoss: youLoseViolinEffectSfx,
};

export const ARENA_AUDIO_CUE_POOL_SIZE: Record<ArenaAudioCueKey, number> = {
  playerRail: 3,
  playerNova: 3,
  playerMissile: 3,
  playerFracture: 2,
  enemyOrb: 3,
  enemyBolt: 3,
  enemyNeedle: 2,
  enemyBomb: 2,
  enemyWave: 2,
  hazardTelegraph: 1,
  hazardImpact: 2,
  pickup: 2,
  armoryOpen: 1,
  armoryUpgrade: 1,
  overdriveStart: 1,
  overdriveEnd: 1,
  ultimate: 1,
  bossIntro: 1,
  bossPhase: 1,
  bossKill: 1,
  playerHit: 2,
  playerLoss: 1,
};

export const ARENA_AUDIO_CUE_VOLUMES: Record<ArenaAudioCueKey, number> = {
  playerRail: 0.48,
  playerNova: 0.44,
  playerMissile: 0.46,
  playerFracture: 0.5,
  enemyOrb: 0.22,
  enemyBolt: 0.22,
  enemyNeedle: 0.24,
  enemyBomb: 0.28,
  enemyWave: 0.22,
  hazardTelegraph: 0.26,
  hazardImpact: 0.34,
  pickup: 0.28,
  armoryOpen: 0.34,
  armoryUpgrade: 0.38,
  overdriveStart: 0.42,
  overdriveEnd: 0.3,
  ultimate: 0.46,
  bossIntro: 0.42,
  bossPhase: 0.36,
  bossKill: 0.42,
  playerHit: 0.3,
  playerLoss: 0.5,
};

export const ARENA_AUDIO_CUE_MIN_INTERVAL_MS: Record<ArenaAudioCueKey, number> = {
  playerRail: 70,
  playerNova: 90,
  playerMissile: 120,
  playerFracture: 180,
  enemyOrb: 120,
  enemyBolt: 120,
  enemyNeedle: 160,
  enemyBomb: 220,
  enemyWave: 160,
  hazardTelegraph: 260,
  hazardImpact: 220,
  pickup: 180,
  armoryOpen: 0,
  armoryUpgrade: 0,
  overdriveStart: 0,
  overdriveEnd: 0,
  ultimate: 0,
  bossIntro: 0,
  bossPhase: 0,
  bossKill: 0,
  playerHit: 140,
  playerLoss: 0,
};

export const ARENA_BIOME_MUSIC_FILES: Record<ArenaBiomeId, number> = {
  prismVerge: megaWallMusic,
  hiveForge: megaWallMusic,
  vectorSpindle: megaWallMusic,
};

export const ARENA_BIOME_MUSIC_VOLUMES: Record<ArenaBiomeId, number> = {
  prismVerge: 0.42,
  hiveForge: 0.38,
  vectorSpindle: 0.4,
};

export function createArenaAudioSettings(): ArenaAudioSettings {
  return { ...DEFAULT_ARENA_AUDIO_SETTINGS };
}

function normalizeArenaAudioSettings(raw: unknown): ArenaAudioSettings {
  const defaults = createArenaAudioSettings();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const candidate = raw as Partial<ArenaAudioSettings>;
  return {
    soundEnabled: typeof candidate.soundEnabled === 'boolean' ? candidate.soundEnabled : defaults.soundEnabled,
    musicEnabled: typeof candidate.musicEnabled === 'boolean' ? candidate.musicEnabled : defaults.musicEnabled,
    sfxVolume:
      typeof candidate.sfxVolume === 'number'
        ? Math.max(0, Math.min(1, candidate.sfxVolume))
        : defaults.sfxVolume,
    musicVolume:
      typeof candidate.musicVolume === 'number'
        ? Math.max(0, Math.min(1, candidate.musicVolume))
        : defaults.musicVolume,
  };
}

export async function loadArenaAudioSettings() {
  try {
    const serializedSettings = await AsyncStorage.getItem(ARENA_AUDIO_STORAGE_KEY);
    if (!serializedSettings) {
      return createArenaAudioSettings();
    }
    return normalizeArenaAudioSettings(JSON.parse(serializedSettings));
  } catch (error) {
    console.warn('Failed to load Arena V2 audio settings', error);
    return createArenaAudioSettings();
  }
}

export async function saveArenaAudioSettings(settings: ArenaAudioSettings) {
  try {
    await AsyncStorage.setItem(ARENA_AUDIO_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save Arena V2 audio settings', error);
  }
}
