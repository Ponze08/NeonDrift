import { describe, expect, it, vi } from 'vitest';
import { type DifficultyStage } from '../data/difficulty';
import { DifficultyManager } from '../systems/DifficultyManager';

const stages: readonly DifficultyStage[] = [
  {
    id: 'easy',
    minimumDistance: 0,
    obstacleDensity: 0.1,
    movingObstacleChance: 0,
    complexPatternChance: 0,
    vehicleSpeedMultiplier: 0.7,
    reactionDistance: 24,
    coinDensity: 1,
  },
  {
    id: 'hard',
    minimumDistance: 100,
    obstacleDensity: 0.5,
    movingObstacleChance: 0.4,
    complexPatternChance: 0.8,
    vehicleSpeedMultiplier: 1.3,
    reactionDistance: 14,
    coinDensity: 0.6,
  },
];

describe('DifficultyManager', () => {
  it('smoothly interpolates fair tuning values between stages', () => {
    const difficulty = new DifficultyManager({
      stages,
      startingSpeed: 10,
      maximumSpeed: 20,
      acceleration: 1,
    });
    const halfway = difficulty.update(50, 5);

    expect(halfway.stage.id).toBe('easy');
    expect(halfway.stageProgress).toBe(0.5);
    expect(halfway.normalizedDifficulty).toBe(0.5);
    expect(halfway.obstacleDensity).toBeCloseTo(0.3);
    expect(halfway.reactionDistance).toBe(19);
    expect(halfway.speed).toBe(15);
  });

  it('announces stage changes and caps speed', () => {
    const difficulty = new DifficultyManager({
      stages,
      startingSpeed: 10,
      maximumSpeed: 12,
      acceleration: 1,
    });
    const listener = vi.fn();
    difficulty.onStageChange(listener);

    difficulty.update(99, 2);
    difficulty.update(100, 20);
    difficulty.update(150, 30);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].id).toBe('hard');
    expect(difficulty.snapshot.speed).toBe(12);
    expect(difficulty.snapshot.stageProgress).toBe(1);
  });

  it('rejects unordered stage data', () => {
    expect(
      () =>
        new DifficultyManager({
          stages: [stages[1]!, stages[0]!],
        }),
    ).toThrow(/ordered|zero/i);
  });
});
