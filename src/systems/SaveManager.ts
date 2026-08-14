import { type GraphicsQuality } from '../core/Config';
import {
  CHARACTER_DEFINITIONS,
  COSMETIC_DEFINITIONS,
  DEFAULT_CHARACTER_ID,
} from '../data/characters';
import { type PersistedMissionState } from '../data/missions';

export const CURRENT_SAVE_VERSION = 3;
export const DEFAULT_SAVE_KEY = 'skyline-sprint.save';

export interface GameSettings {
  readonly musicVolume: number;
  readonly soundEffectsVolume: number;
  readonly swipeSensitivity: number;
  readonly graphicsQuality: GraphicsQuality;
  readonly cameraShake: boolean;
  readonly shadows: boolean;
  readonly particleEffects: boolean;
  readonly language: string;
}

export interface EquippedCosmetics {
  readonly outfit: string | null;
  readonly colour: string | null;
  readonly hoverDevice: string | null;
}

export interface GameStatistics {
  readonly totalRuns: number;
  readonly totalDistance: number;
  readonly totalCoinsCollected: number;
  readonly highestScore: number;
  readonly longestDistance: number;
  readonly longestRun: number;
  readonly totalJumps: number;
  readonly totalSlides: number;
  readonly totalLaneChanges: number;
  readonly totalPowerUpsCollected: number;
  readonly totalCrashes: number;
  readonly totalPlayTime: number;
}

export interface SaveData {
  readonly version: number;
  readonly updatedAt: number;
  readonly highScore: number;
  readonly totalCoins: number;
  readonly playerLevel: number;
  /** Experience accumulated within the current level. */
  readonly experience: number;
  readonly activeMissions: readonly PersistedMissionState[];
  readonly completedMissionCount: number;
  readonly settings: GameSettings;
  readonly ownedCharacters: readonly string[];
  readonly equippedCharacter: string;
  readonly ownedCosmetics: readonly string[];
  readonly equippedCosmetics: EquippedCosmetics;
  readonly hoverDeviceInventory: number;
  readonly statistics: GameStatistics;
}

export interface RunStatisticsUpdate {
  readonly score: number;
  readonly distance: number;
  readonly coins: number;
  readonly durationSeconds?: number;
  readonly jumps?: number;
  readonly slides?: number;
  readonly laneChanges?: number;
  readonly powerUpsCollected?: number;
  readonly crashed?: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveManagerOptions {
  readonly storage?: StorageLike;
  readonly key?: string;
  readonly now?: () => number;
  readonly keepCorruptedBackup?: boolean;
}

export interface SaveValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

type MutableSaveData = {
  -readonly [K in keyof SaveData]: SaveData[K];
};

const DEFAULT_SETTINGS: GameSettings = Object.freeze({
  musicVolume: 0.55,
  soundEffectsVolume: 0.75,
  swipeSensitivity: 1,
  graphicsQuality: 'medium',
  cameraShake: true,
  shadows: true,
  particleEffects: true,
  language: 'en',
});

const DEFAULT_STATISTICS: GameStatistics = Object.freeze({
  totalRuns: 0,
  totalDistance: 0,
  totalCoinsCollected: 0,
  highestScore: 0,
  longestDistance: 0,
  longestRun: 0,
  totalJumps: 0,
  totalSlides: 0,
  totalLaneChanges: 0,
  totalPowerUpsCollected: 0,
  totalCrashes: 0,
  totalPlayTime: 0,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number, minimum = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

function integerOr(value: unknown, fallback: number, minimum = 0): number {
  return Math.floor(numberOr(value, fallback, minimum));
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0)),
  ];
}

function missionArray(value: unknown): PersistedMissionState[] {
  if (!Array.isArray(value)) return [];
  const missions: PersistedMissionState[] = [];
  for (const entry of value.slice(0, 3)) {
    if (!isRecord(entry)) continue;
    const definitionId = stringOr(entry.definitionId ?? entry.id, '');
    if (!definitionId) continue;
    const target = numberOr(entry.target, 1, 1);
    const progress = clamp(numberOr(entry.progress, 0), 0, target);
    missions.push({
      instanceId: stringOr(entry.instanceId, `${definitionId}:${missions.length}`),
      definitionId,
      tier: integerOr(entry.tier, 1, 1),
      target,
      progress,
      completed: booleanOr(entry.completed, progress >= target),
    });
  }
  return missions;
}

function sanitiseSettings(value: unknown): GameSettings {
  const source = isRecord(value) ? value : {};
  const quality = source.graphicsQuality;
  return {
    musicVolume: clamp(numberOr(source.musicVolume, DEFAULT_SETTINGS.musicVolume), 0, 1),
    soundEffectsVolume: clamp(
      numberOr(source.soundEffectsVolume ?? source.sfxVolume, DEFAULT_SETTINGS.soundEffectsVolume),
      0,
      1,
    ),
    swipeSensitivity: clamp(
      numberOr(source.swipeSensitivity, DEFAULT_SETTINGS.swipeSensitivity, 0.25),
      0.25,
      3,
    ),
    graphicsQuality:
      quality === 'low' || quality === 'medium' || quality === 'high'
        ? quality
        : DEFAULT_SETTINGS.graphicsQuality,
    cameraShake: booleanOr(source.cameraShake, DEFAULT_SETTINGS.cameraShake),
    shadows: booleanOr(source.shadows, DEFAULT_SETTINGS.shadows),
    particleEffects: booleanOr(source.particleEffects, DEFAULT_SETTINGS.particleEffects),
    language: stringOr(source.language, DEFAULT_SETTINGS.language),
  };
}

function sanitiseStatistics(value: unknown, highScore: number): GameStatistics {
  const source = isRecord(value) ? value : {};
  return {
    totalRuns: integerOr(source.totalRuns, 0),
    totalDistance: numberOr(source.totalDistance, 0),
    totalCoinsCollected: integerOr(source.totalCoinsCollected, 0),
    highestScore: Math.max(integerOr(source.highestScore, 0), highScore),
    longestDistance: numberOr(source.longestDistance, 0),
    longestRun: numberOr(source.longestRun, 0),
    totalJumps: integerOr(source.totalJumps, 0),
    totalSlides: integerOr(source.totalSlides, 0),
    totalLaneChanges: integerOr(source.totalLaneChanges, 0),
    totalPowerUpsCollected: integerOr(source.totalPowerUpsCollected, 0),
    totalCrashes: integerOr(source.totalCrashes, 0),
    totalPlayTime: numberOr(source.totalPlayTime, 0),
  };
}

function cloneSaveData(data: SaveData): SaveData {
  return JSON.parse(JSON.stringify(data)) as SaveData;
}

export function createDefaultSaveData(now = Date.now()): SaveData {
  const ownedCharacters = CHARACTER_DEFINITIONS.filter((item) => item.unlockedByDefault).map(
    (item) => item.id,
  );
  const ownedCosmetics = COSMETIC_DEFINITIONS.filter((item) => item.unlockedByDefault).map(
    (item) => item.id,
  );
  return {
    version: CURRENT_SAVE_VERSION,
    updatedAt: now,
    highScore: 0,
    totalCoins: 0,
    playerLevel: 1,
    experience: 0,
    activeMissions: [],
    completedMissionCount: 0,
    settings: { ...DEFAULT_SETTINGS },
    ownedCharacters,
    equippedCharacter: DEFAULT_CHARACTER_ID,
    ownedCosmetics,
    equippedCosmetics: {
      outfit: ownedCosmetics.find((id) => id.startsWith('outfit-')) ?? null,
      colour: null,
      hoverDevice: ownedCosmetics.find((id) => id.startsWith('board-')) ?? null,
    },
    hoverDeviceInventory: 3,
    statistics: { ...DEFAULT_STATISTICS },
  };
}

/** Migrates legacy field names, then validates and fills all current fields. */
export function migrateSaveData(value: unknown, now = Date.now()): SaveData {
  if (!isRecord(value)) throw new TypeError('Save data must be an object');
  const version = integerOr(value.version, 0);
  if (version > CURRENT_SAVE_VERSION) {
    throw new Error(
      `Save version ${version} is newer than supported version ${CURRENT_SAVE_VERSION}`,
    );
  }

  const defaults = createDefaultSaveData(now);
  const highScore = integerOr(value.highScore ?? value.highestScore, defaults.highScore);
  const ownedCharacters = stringArray(value.ownedCharacters);
  for (const defaultId of defaults.ownedCharacters) {
    if (!ownedCharacters.includes(defaultId)) ownedCharacters.push(defaultId);
  }
  const requestedCharacter = stringOr(value.equippedCharacter, defaults.equippedCharacter);
  const equippedCharacter = ownedCharacters.includes(requestedCharacter)
    ? requestedCharacter
    : defaults.equippedCharacter;

  const ownedCosmetics = stringArray(value.ownedCosmetics);
  for (const defaultId of defaults.ownedCosmetics) {
    if (!ownedCosmetics.includes(defaultId)) ownedCosmetics.push(defaultId);
  }
  const equippedSource = isRecord(value.equippedCosmetics) ? value.equippedCosmetics : {};
  const keepOwnedCosmetic = (candidate: unknown): string | null => {
    const id = nullableString(candidate);
    return id !== null && ownedCosmetics.includes(id) ? id : null;
  };

  const save: SaveData = {
    version: CURRENT_SAVE_VERSION,
    updatedAt: numberOr(value.updatedAt, now),
    highScore,
    totalCoins: integerOr(value.totalCoins ?? value.coins, defaults.totalCoins),
    playerLevel: integerOr(value.playerLevel ?? value.level, defaults.playerLevel, 1),
    experience: integerOr(value.experience ?? value.xp, defaults.experience),
    activeMissions: missionArray(value.activeMissions ?? value.missions),
    completedMissionCount: integerOr(value.completedMissionCount, 0),
    settings: sanitiseSettings(value.settings),
    ownedCharacters,
    equippedCharacter,
    ownedCosmetics,
    equippedCosmetics: {
      outfit: keepOwnedCosmetic(equippedSource.outfit),
      colour: keepOwnedCosmetic(equippedSource.colour),
      hoverDevice: keepOwnedCosmetic(equippedSource.hoverDevice),
    },
    hoverDeviceInventory: integerOr(
      value.hoverDeviceInventory ?? value.hoverDevices,
      defaults.hoverDeviceInventory,
    ),
    statistics: sanitiseStatistics(value.statistics, highScore),
  };
  return save;
}

export function validateSaveData(value: unknown): SaveValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Save data is not an object'] };
  if (value.version !== CURRENT_SAVE_VERSION) errors.push('Save version is not current');
  const requiredNumbers = [
    'updatedAt',
    'highScore',
    'totalCoins',
    'playerLevel',
    'experience',
    'completedMissionCount',
    'hoverDeviceInventory',
  ] as const;
  for (const key of requiredNumbers) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0) {
      errors.push(`${key} must be a non-negative finite number`);
    }
  }
  if (!isRecord(value.settings)) errors.push('settings must be an object');
  if (!isRecord(value.statistics)) errors.push('statistics must be an object');
  if (!Array.isArray(value.activeMissions)) errors.push('activeMissions must be an array');
  if (!Array.isArray(value.ownedCharacters)) errors.push('ownedCharacters must be an array');
  if (!Array.isArray(value.ownedCosmetics)) errors.push('ownedCosmetics must be an array');
  if (typeof value.equippedCharacter !== 'string') {
    errors.push('equippedCharacter must be a string');
  }
  return { valid: errors.length === 0, errors };
}

function isStorageLike(value: unknown): value is StorageLike {
  return (
    isRecord(value) &&
    typeof value.getItem === 'function' &&
    typeof value.setItem === 'function' &&
    typeof value.removeItem === 'function'
  );
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export class SaveManager {
  private readonly storage: StorageLike | undefined;
  private readonly key: string;
  private readonly now: () => number;
  private readonly keepCorruptedBackup: boolean;
  private cached: SaveData;
  public lastError: unknown = null;
  public lastRecoveryReason: string | null = null;

  public constructor(optionsOrStorage: SaveManagerOptions | StorageLike = {}) {
    const options = isStorageLike(optionsOrStorage)
      ? { storage: optionsOrStorage }
      : optionsOrStorage;
    this.storage = options.storage ?? browserStorage();
    this.key = options.key ?? DEFAULT_SAVE_KEY;
    this.now = options.now ?? Date.now;
    this.keepCorruptedBackup = options.keepCorruptedBackup ?? true;
    this.cached = createDefaultSaveData(this.now());
  }

  public get data(): SaveData {
    return cloneSaveData(this.cached);
  }

  public load(): SaveData {
    let raw: string | null = null;
    try {
      raw = this.storage?.getItem(this.key) ?? null;
      if (raw === null) {
        this.cached = createDefaultSaveData(this.now());
        this.persist();
        return this.data;
      }
      this.cached = this.deserialize(raw);
      this.persist();
      this.lastError = null;
      this.lastRecoveryReason = null;
      return this.data;
    } catch (error: unknown) {
      this.lastError = error;
      this.lastRecoveryReason = error instanceof Error ? error.message : 'Unknown save error';
      if (raw !== null && this.storage !== undefined && this.keepCorruptedBackup) {
        try {
          this.storage.setItem(`${this.key}.corrupted.${this.now()}`, raw);
        } catch {
          // Recovery must still succeed when storage is full or blocked.
        }
      }
      try {
        this.storage?.removeItem(this.key);
      } catch {
        // The in-memory default remains usable even when storage is unavailable.
      }
      this.cached = createDefaultSaveData(this.now());
      this.persist();
      return this.data;
    }
  }

  public save(data: SaveData = this.cached): SaveData {
    this.cached = migrateSaveData(data, this.now());
    this.cached = { ...this.cached, updatedAt: this.now() };
    this.persist();
    return this.data;
  }

  public update(mutator: (draft: MutableSaveData) => void): SaveData {
    const draft = cloneSaveData(this.cached) as MutableSaveData;
    mutator(draft);
    return this.save(draft);
  }

  public reset(): SaveData {
    this.cached = createDefaultSaveData(this.now());
    this.persist();
    return this.data;
  }

  public serialize(data: SaveData = this.cached): string {
    return JSON.stringify(migrateSaveData(data, this.now()));
  }

  public deserialize(raw: string): SaveData {
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateSaveData(parsed, this.now());
    const validation = validateSaveData(migrated);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    return migrated;
  }

  public import(raw: string): SaveData {
    this.cached = this.deserialize(raw);
    this.cached = { ...this.cached, updatedAt: this.now() };
    this.persist();
    return this.data;
  }

  public recordRun(run: RunStatisticsUpdate): SaveData {
    return this.update((draft) => {
      const score = integerOr(run.score, 0);
      const distance = numberOr(run.distance, 0);
      const coins = integerOr(run.coins, 0);
      const old = draft.statistics;
      draft.highScore = Math.max(draft.highScore, score);
      draft.totalCoins += coins;
      draft.statistics = {
        totalRuns: old.totalRuns + 1,
        totalDistance: old.totalDistance + distance,
        totalCoinsCollected: old.totalCoinsCollected + coins,
        highestScore: Math.max(old.highestScore, score),
        longestDistance: Math.max(old.longestDistance, distance),
        longestRun: Math.max(old.longestRun, numberOr(run.durationSeconds, 0)),
        totalJumps: old.totalJumps + integerOr(run.jumps, 0),
        totalSlides: old.totalSlides + integerOr(run.slides, 0),
        totalLaneChanges: old.totalLaneChanges + integerOr(run.laneChanges, 0),
        totalPowerUpsCollected: old.totalPowerUpsCollected + integerOr(run.powerUpsCollected, 0),
        totalCrashes: old.totalCrashes + (run.crashed === false ? 0 : 1),
        totalPlayTime: old.totalPlayTime + numberOr(run.durationSeconds, 0),
      };
    });
  }

  private persist(): void {
    if (this.storage === undefined) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.cached));
      this.lastError = null;
    } catch (error: unknown) {
      this.lastError = error;
    }
  }
}
