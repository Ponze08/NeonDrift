import { describe, expect, it } from 'vitest';
import {
  OBSTACLE_PATTERNS,
  createSeededRandom,
  selectObstaclePattern,
  validateObstaclePattern,
  type ObstaclePattern,
} from '../data/patterns';

describe('obstacle patterns', () => {
  it('ships only layouts with a reachable route', () => {
    for (const pattern of OBSTACLE_PATTERNS) {
      expect(validateObstaclePattern(pattern), pattern.id).toMatchObject({
        valid: true,
        errors: [],
      });
    }
  });

  it('rejects a row that blocks every lane', () => {
    const impossible: ObstaclePattern = {
      id: 'impossible',
      name: 'Impossible',
      length: 3,
      complexity: 1,
      minimumDifficulty: 0,
      weight: 1,
      entities: [
        { kind: 'lane-blocker', lane: -1, row: 1 },
        { kind: 'lane-blocker', lane: 0, row: 1 },
        { kind: 'lane-blocker', lane: 1, row: 1 },
      ],
    };
    const result = validateObstaclePattern(impossible);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/No reachable route/);
  });

  it('accounts for lane-change speed and action recovery', () => {
    const noReactionTime: ObstaclePattern = {
      id: 'no-reaction',
      name: 'No Reaction',
      length: 2,
      complexity: 3,
      minimumDifficulty: 0,
      weight: 1,
      entities: [
        { kind: 'lane-blocker', lane: -1, row: 0 },
        { kind: 'lane-blocker', lane: 0, row: 0 },
      ],
    };
    expect(validateObstaclePattern(noReactionTime, { startingLanes: [-1] }).valid).toBe(false);

    const actionSpam: ObstaclePattern = {
      id: 'action-spam',
      name: 'Action Spam',
      length: 3,
      complexity: 5,
      minimumDifficulty: 0,
      weight: 1,
      entities: [
        { kind: 'lane-blocker', lane: -1, row: 1 },
        { kind: 'jump-barrier', lane: 0, row: 1 },
        { kind: 'lane-blocker', lane: 1, row: 1 },
        { kind: 'lane-blocker', lane: -1, row: 2 },
        { kind: 'overhead-gate', lane: 0, row: 2 },
        { kind: 'lane-blocker', lane: 1, row: 2 },
      ],
    };
    expect(validateObstaclePattern(actionSpam).valid).toBe(false);
  });

  it('selects deterministically from eligible difficulty tiers', () => {
    const firstRandom = createSeededRandom('same-run');
    const secondRandom = createSeededRandom('same-run');
    const firstSequence = Array.from(
      { length: 8 },
      () => selectObstaclePattern(firstRandom, 0.7).id,
    );
    const secondSequence = Array.from(
      { length: 8 },
      () => selectObstaclePattern(secondRandom, 0.7).id,
    );
    expect(firstSequence).toEqual(secondSequence);

    const earlyPattern = selectObstaclePattern(42, 0);
    expect(earlyPattern.minimumDifficulty).toBe(0);
  });
});
