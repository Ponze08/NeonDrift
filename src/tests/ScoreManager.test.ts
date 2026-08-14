import { describe, expect, it } from 'vitest';
import { type ScoreConfig } from '../core/Config';
import { ScoreManager } from '../systems/ScoreManager';

const config: ScoreConfig = {
  pointsPerMetre: 5,
  speedPointFactor: 0.1,
  pointsPerCoin: 10,
  multiplierDistanceStep: 10,
  maximumMultiplier: 3,
};

describe('ScoreManager', () => {
  it('scores distance using speed and awards coins', () => {
    const score = new ScoreManager(config);
    const update = score.update(1, 10);

    expect(update.distanceAdded).toBe(10);
    expect(update.scoreAdded).toBe(60);
    expect(update.multiplierChanged).toBe(true);
    expect(score.snapshot.baseMultiplier).toBe(2);

    expect(score.collectCoins(2)).toBe(40);
    expect(score.snapshot.coins).toBe(2);
    expect(score.snapshot.score).toBe(100);
  });

  it('splits scoring at multiplier thresholds so frame size does not alter the result', () => {
    const oneStep = new ScoreManager(config);
    const manySteps = new ScoreManager(config);

    oneStep.addDistance(25, 10);
    for (let index = 0; index < 5; index += 1) manySteps.addDistance(5, 10);

    expect(oneStep.snapshot.rawScore).toBe(270);
    expect(manySteps.snapshot.rawScore).toBe(oneStep.snapshot.rawScore);
    expect(oneStep.snapshot.baseMultiplier).toBe(3);
  });

  it('applies and clears score boosts without corrupting the base multiplier', () => {
    const score = new ScoreManager(config);
    score.setPowerUpMultiplier(2);
    score.addDistance(5, 0);
    expect(score.snapshot.rawScore).toBe(50);
    expect(score.snapshot.multiplier).toBe(2);

    score.setPowerUpMultiplier(Number.NaN);
    expect(score.snapshot.powerUpMultiplier).toBe(1);
    score.reset();
    expect(score.snapshot).toMatchObject({ score: 0, distance: 0, coins: 0, multiplier: 1 });
  });
});
