import { describe, expect, it, vi } from 'vitest';
import { type ProgressionConfig } from '../core/Config';
import {
  ProgressionManager,
  calculateRunExperience,
  experienceForLevel,
  totalExperienceForLevel,
} from '../systems/ProgressionManager';

const config: ProgressionConfig = {
  baseExperiencePerLevel: 100,
  experienceExponent: 1,
  levelRewardBaseCoins: 50,
  levelRewardGrowth: 10,
};

describe('ProgressionManager', () => {
  it('uses progressively larger level thresholds', () => {
    expect(experienceForLevel(1, config)).toBe(100);
    expect(experienceForLevel(2, config)).toBe(200);
    expect(totalExperienceForLevel(3, config)).toBe(300);
  });

  it('rolls experience through multiple levels and combines rewards', () => {
    const progression = new ProgressionManager({ level: 1, experience: 0 }, config);
    const listener = vi.fn();
    progression.onLevelUp(listener);

    const result = progression.addExperience(350);

    expect(result.levelsGained).toBe(2);
    expect(result.coinReward).toBe(110);
    expect(result.snapshot).toMatchObject({ level: 3, experience: 50 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('normalises overflow loaded from a save', () => {
    const progression = new ProgressionManager({ level: 1, experience: 310 }, config);
    expect(progression.snapshot).toMatchObject({ level: 3, experience: 10 });
    expect(progression.snapshot.progress).toBeCloseTo(10 / 300);
  });

  it('calculates run experience from all supported sources', () => {
    expect(
      calculateRunExperience({
        distance: 1_000,
        coins: 10,
        score: 5_000,
        completedMissions: 2,
      }),
    ).toBe(150);
  });
});
