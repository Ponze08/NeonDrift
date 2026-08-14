import { describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  SaveManager,
  createDefaultSaveData,
  migrateSaveData,
  type StorageLike,
} from '../systems/SaveManager';

class MemoryStorage implements StorageLike {
  public readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('SaveManager', () => {
  it('round-trips typed save data and does not expose mutable internal state', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager({ storage, key: 'test', now: () => 100 });
    first.load();
    first.update((draft) => {
      draft.highScore = 1_234;
      draft.totalCoins = 77;
    });

    const exposed = first.data as { highScore: number };
    exposed.highScore = 0;
    const second = new SaveManager({ storage, key: 'test', now: () => 200 });
    expect(second.load()).toMatchObject({ highScore: 1_234, totalCoins: 77 });
    expect(second.data.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('recovers from corrupted JSON and keeps a diagnostic backup', () => {
    const storage = new MemoryStorage();
    storage.setItem('test', '{ definitely-not-json');
    const saves = new SaveManager({ storage, key: 'test', now: () => 42 });

    const recovered = saves.load();

    expect(recovered).toEqual(createDefaultSaveData(42));
    expect(saves.lastRecoveryReason).toBeTruthy();
    expect(storage.values.get('test.corrupted.42')).toBe('{ definitely-not-json');
    expect(() => JSON.parse(storage.values.get('test')!)).not.toThrow();
  });

  it('migrates legacy field names and sanitises unsafe values', () => {
    const migrated = migrateSaveData(
      {
        coins: 42,
        highestScore: 900,
        level: 3,
        xp: 12,
        hoverDevices: 5,
        settings: { musicVolume: 9, sfxVolume: -2, graphicsQuality: 'ultra' },
      },
      10,
    );

    expect(migrated).toMatchObject({
      version: CURRENT_SAVE_VERSION,
      totalCoins: 42,
      highScore: 900,
      playerLevel: 3,
      experience: 12,
      hoverDeviceInventory: 5,
    });
    expect(migrated.settings.musicVolume).toBe(1);
    expect(migrated.settings.soundEffectsVolume).toBe(0);
    expect(migrated.settings.graphicsQuality).toBe('medium');
  });

  it('commits run currency and cumulative statistics', () => {
    const saves = new SaveManager({ storage: new MemoryStorage(), now: () => 1 });
    saves.load();
    const data = saves.recordRun({
      score: 500,
      distance: 250,
      coins: 12,
      durationSeconds: 30,
      jumps: 4,
      crashed: true,
    });

    expect(data.totalCoins).toBe(12);
    expect(data.highScore).toBe(500);
    expect(data.statistics).toMatchObject({
      totalRuns: 1,
      totalDistance: 250,
      longestDistance: 250,
      longestRun: 30,
      totalCoinsCollected: 12,
      totalJumps: 4,
      totalCrashes: 1,
    });
  });
});
