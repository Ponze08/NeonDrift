export interface DifficultyStage {
  readonly distance: number;
  readonly speed: number;
  readonly obstacleDensity: number;
  readonly movingObstacleChance: number;
  readonly vehicleSpeed: number;
  readonly patternComplexity: number;
  readonly reactionSpacing: number;
}

export interface DifficultySnapshot {
  stage: number;
  stageProgress: number;
  speed: number;
  obstacleDensity: number;
  movingObstacleChance: number;
  vehicleSpeed: number;
  patternComplexity: number;
  reactionSpacing: number;
}

export const DEFAULT_DIFFICULTY_STAGES: readonly DifficultyStage[] = [
  {
    distance: 0,
    speed: 11,
    obstacleDensity: 0.3,
    movingObstacleChance: 0,
    vehicleSpeed: 3.5,
    patternComplexity: 0,
    reactionSpacing: 7,
  },
  {
    distance: 350,
    speed: 14,
    obstacleDensity: 0.46,
    movingObstacleChance: 0.12,
    vehicleSpeed: 4.5,
    patternComplexity: 1,
    reactionSpacing: 6,
  },
  {
    distance: 900,
    speed: 17.5,
    obstacleDensity: 0.62,
    movingObstacleChance: 0.22,
    vehicleSpeed: 5.8,
    patternComplexity: 2,
    reactionSpacing: 5.25,
  },
  {
    distance: 1750,
    speed: 21,
    obstacleDensity: 0.76,
    movingObstacleChance: 0.32,
    vehicleSpeed: 7,
    patternComplexity: 3,
    reactionSpacing: 4.7,
  },
  {
    distance: 3000,
    speed: 25,
    obstacleDensity: 0.86,
    movingObstacleChance: 0.4,
    vehicleSpeed: 8.2,
    patternComplexity: 4,
    reactionSpacing: 4.25,
  },
  {
    distance: 5000,
    speed: 28,
    obstacleDensity: 0.92,
    movingObstacleChance: 0.46,
    vehicleSpeed: 9,
    patternComplexity: 5,
    reactionSpacing: 4,
  },
] as const;

export function createDifficultySnapshot(): DifficultySnapshot {
  return {
    stage: 0,
    stageProgress: 0,
    speed: 11,
    obstacleDensity: 0.3,
    movingObstacleChance: 0,
    vehicleSpeed: 3.5,
    patternComplexity: 0,
    reactionSpacing: 7,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class DifficultyManager {
  public readonly stages: readonly DifficultyStage[];
  private readonly reusableSnapshot = createDifficultySnapshot();

  public constructor(stages: readonly DifficultyStage[] = DEFAULT_DIFFICULTY_STAGES) {
    if (stages.length === 0) throw new Error('DifficultyManager requires at least one stage.');
    this.stages = [...stages].sort((a, b) => a.distance - b.distance);
  }

  public getDifficulty(
    distance: number,
    out: DifficultySnapshot = this.reusableSnapshot,
  ): DifficultySnapshot {
    const safeDistance = Math.max(0, Number.isFinite(distance) ? distance : 0);
    let stageIndex = 0;
    for (let index = 1; index < this.stages.length; index += 1) {
      if (safeDistance < this.stages[index]!.distance) break;
      stageIndex = index;
    }

    const current = this.stages[stageIndex]!;
    const next = this.stages[Math.min(stageIndex + 1, this.stages.length - 1)]!;
    const span = Math.max(1, next.distance - current.distance);
    const progress = current === next ? 1 : Math.min(1, (safeDistance - current.distance) / span);
    out.stage = stageIndex;
    out.stageProgress = progress;
    out.speed = lerp(current.speed, next.speed, progress);
    out.obstacleDensity = lerp(current.obstacleDensity, next.obstacleDensity, progress);
    out.movingObstacleChance = lerp(
      current.movingObstacleChance,
      next.movingObstacleChance,
      progress,
    );
    out.vehicleSpeed = lerp(current.vehicleSpeed, next.vehicleSpeed, progress);
    out.patternComplexity = Math.floor(
      lerp(current.patternComplexity, next.patternComplexity, progress),
    );
    out.reactionSpacing = lerp(current.reactionSpacing, next.reactionSpacing, progress);
    return out;
  }
}
