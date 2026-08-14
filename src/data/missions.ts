export enum MissionType {
  CollectCoins = 'collect-coins',
  TravelDistance = 'travel-distance',
  JumpObstacles = 'jump-obstacles',
  SlideObstacles = 'slide-obstacles',
  ChangeLanes = 'change-lanes',
  UsePowerUps = 'use-power-ups',
  ReachMultiplier = 'reach-multiplier',
  BreakHoverDevice = 'break-hover-device',
  SurviveSeconds = 'survive-seconds',
}

export interface MissionDefinition {
  readonly id: string;
  readonly type: MissionType;
  readonly title: string;
  readonly description: string;
  readonly baseTarget: number;
  readonly targetGrowth: number;
  readonly baseCoinReward: number;
  readonly baseExperienceReward: number;
  readonly rewardGrowth: number;
  readonly weight: number;
  readonly unit: 'count' | 'metres' | 'seconds' | 'multiplier';
}

export interface PersistedMissionState {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly tier: number;
  readonly target: number;
  readonly progress: number;
  readonly completed: boolean;
}

export const MISSION_DEFINITIONS: readonly MissionDefinition[] = Object.freeze([
  {
    id: 'coin-circuit',
    type: MissionType.CollectCoins,
    title: 'Coin Circuit',
    description: 'Collect energy coins',
    baseTarget: 45,
    targetGrowth: 18,
    baseCoinReward: 100,
    baseExperienceReward: 45,
    rewardGrowth: 0.16,
    weight: 1.2,
    unit: 'count',
  },
  {
    id: 'city-crossing',
    type: MissionType.TravelDistance,
    title: 'City Crossing',
    description: 'Travel through the neon district',
    baseTarget: 1_000,
    targetGrowth: 400,
    baseCoinReward: 125,
    baseExperienceReward: 55,
    rewardGrowth: 0.18,
    weight: 1.2,
    unit: 'metres',
  },
  {
    id: 'vault-master',
    type: MissionType.JumpObstacles,
    title: 'Vault Master',
    description: 'Jump over barriers',
    baseTarget: 12,
    targetGrowth: 5,
    baseCoinReward: 110,
    baseExperienceReward: 50,
    rewardGrowth: 0.18,
    weight: 1,
    unit: 'count',
  },
  {
    id: 'low-profile',
    type: MissionType.SlideObstacles,
    title: 'Low Profile',
    description: 'Slide under gates',
    baseTarget: 10,
    targetGrowth: 4,
    baseCoinReward: 110,
    baseExperienceReward: 50,
    rewardGrowth: 0.18,
    weight: 1,
    unit: 'count',
  },
  {
    id: 'lane-weaver',
    type: MissionType.ChangeLanes,
    title: 'Lane Weaver',
    description: 'Change lanes while running',
    baseTarget: 35,
    targetGrowth: 14,
    baseCoinReward: 90,
    baseExperienceReward: 42,
    rewardGrowth: 0.15,
    weight: 1,
    unit: 'count',
  },
  {
    id: 'charged-up',
    type: MissionType.UsePowerUps,
    title: 'Charged Up',
    description: 'Collect power modules',
    baseTarget: 4,
    targetGrowth: 2,
    baseCoinReward: 130,
    baseExperienceReward: 60,
    rewardGrowth: 0.2,
    weight: 0.85,
    unit: 'count',
  },
  {
    id: 'chain-reaction',
    type: MissionType.ReachMultiplier,
    title: 'Chain Reaction',
    description: 'Reach a score multiplier',
    baseTarget: 4,
    targetGrowth: 1,
    baseCoinReward: 140,
    baseExperienceReward: 65,
    rewardGrowth: 0.22,
    weight: 0.72,
    unit: 'multiplier',
  },
  {
    id: 'board-breaker',
    type: MissionType.BreakHoverDevice,
    title: 'Board Breaker',
    description: 'Let an active hover device absorb a crash',
    baseTarget: 1,
    targetGrowth: 1,
    baseCoinReward: 145,
    baseExperienceReward: 65,
    rewardGrowth: 0.22,
    weight: 0.55,
    unit: 'count',
  },
  {
    id: 'staying-power',
    type: MissionType.SurviveSeconds,
    title: 'Staying Power',
    description: 'Keep a run alive',
    baseTarget: 90,
    targetGrowth: 30,
    baseCoinReward: 135,
    baseExperienceReward: 60,
    rewardGrowth: 0.18,
    weight: 0.85,
    unit: 'seconds',
  },
]);

export function getMissionDefinition(id: string): MissionDefinition | undefined {
  return MISSION_DEFINITIONS.find((definition) => definition.id === id);
}
