import { describe, expect, it, vi } from 'vitest';
import { MissionType, type MissionDefinition } from '../data/missions';
import { MissionManager } from '../systems/MissionManager';

const definitions: readonly MissionDefinition[] = [
  {
    id: 'coins',
    type: MissionType.CollectCoins,
    title: 'Coins',
    description: 'Collect coins',
    baseTarget: 3,
    targetGrowth: 1,
    baseCoinReward: 10,
    baseExperienceReward: 5,
    rewardGrowth: 0.5,
    weight: 1,
    unit: 'count',
  },
  {
    id: 'distance',
    type: MissionType.TravelDistance,
    title: 'Distance',
    description: 'Travel',
    baseTarget: 100,
    targetGrowth: 50,
    baseCoinReward: 20,
    baseExperienceReward: 8,
    rewardGrowth: 0.5,
    weight: 1,
    unit: 'metres',
  },
  {
    id: 'multiplier',
    type: MissionType.ReachMultiplier,
    title: 'Multiplier',
    description: 'Reach multiplier',
    baseTarget: 2,
    targetGrowth: 1,
    baseCoinReward: 30,
    baseExperienceReward: 10,
    rewardGrowth: 0.5,
    weight: 1,
    unit: 'multiplier',
  },
  {
    id: 'jumps',
    type: MissionType.JumpObstacles,
    title: 'Jumps',
    description: 'Jump',
    baseTarget: 2,
    targetGrowth: 1,
    baseCoinReward: 40,
    baseExperienceReward: 12,
    rewardGrowth: 0.5,
    weight: 1,
    unit: 'count',
  },
];

const createManager = (): MissionManager =>
  new MissionManager({ definitions, activeCount: 3, random: () => 0 });

describe('MissionManager', () => {
  it('maintains three distinct active mission types', () => {
    const manager = createManager();
    expect(manager.missions).toHaveLength(3);
    expect(new Set(manager.missions.map((mission) => mission.definition.type)).size).toBe(3);
  });

  it('tracks additive progress and only emits completion once', () => {
    const manager = createManager();
    const completed = vi.fn();
    manager.onCompleted(completed);

    manager.record(MissionType.CollectCoins, 2);
    manager.record(MissionType.CollectCoins, 1);
    manager.record(MissionType.CollectCoins, 10);

    const mission = manager.missions.find(
      (item) => item.definition.type === MissionType.CollectCoins,
    );
    expect(mission).toMatchObject({ progress: 3, target: 3, completed: true });
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('uses a maximum for multiplier telemetry', () => {
    const manager = createManager();
    manager.recordMaximum(MissionType.ReachMultiplier, 1);
    manager.recordMaximum(MissionType.ReachMultiplier, 2);

    const mission = manager.missions.find(
      (item) => item.definition.type === MissionType.ReachMultiplier,
    );
    expect(mission).toMatchObject({ progress: 2, completed: true });
  });

  it('claims rewards and replaces a completed mission', () => {
    const manager = createManager();
    const original = manager.missions.find(
      (item) => item.definition.type === MissionType.CollectCoins,
    );
    expect(original).toBeDefined();
    manager.record(MissionType.CollectCoins, 3);

    const reward = manager.claimCompleted(original!.instanceId);
    expect(reward).toMatchObject({ coins: 10, experience: 5 });
    expect(manager.completedMissionCount).toBe(1);
    expect(manager.missions).toHaveLength(3);
    expect(manager.missions.some((mission) => mission.instanceId === original!.instanceId)).toBe(
      false,
    );
  });

  it('restores saved progress defensively', () => {
    const source = createManager();
    source.record(MissionType.CollectCoins, 2);
    const restored = new MissionManager({
      definitions,
      activeCount: 3,
      random: () => 0,
      initialMissions: source.persistedMissions,
    });
    expect(restored.persistedMissions).toEqual(source.persistedMissions);
  });
});
