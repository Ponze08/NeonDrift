export interface DifficultyStage {
  readonly id: string;
  readonly minimumDistance: number;
  readonly obstacleDensity: number;
  readonly movingObstacleChance: number;
  readonly complexPatternChance: number;
  readonly vehicleSpeedMultiplier: number;
  readonly reactionDistance: number;
  readonly coinDensity: number;
}

/** Ordered, deliberately conservative stages so difficulty rises without sudden spikes. */
export const DIFFICULTY_STAGES: readonly DifficultyStage[] = Object.freeze([
  {
    id: 'warm-up',
    minimumDistance: 0,
    obstacleDensity: 0.18,
    movingObstacleChance: 0,
    complexPatternChance: 0.05,
    vehicleSpeedMultiplier: 0.72,
    reactionDistance: 24,
    coinDensity: 0.9,
  },
  {
    id: 'flow',
    minimumDistance: 550,
    obstacleDensity: 0.28,
    movingObstacleChance: 0.08,
    complexPatternChance: 0.22,
    vehicleSpeedMultiplier: 0.88,
    reactionDistance: 21,
    coinDensity: 0.82,
  },
  {
    id: 'rush',
    minimumDistance: 1_450,
    obstacleDensity: 0.39,
    movingObstacleChance: 0.17,
    complexPatternChance: 0.43,
    vehicleSpeedMultiplier: 1,
    reactionDistance: 18,
    coinDensity: 0.75,
  },
  {
    id: 'overdrive',
    minimumDistance: 3_000,
    obstacleDensity: 0.5,
    movingObstacleChance: 0.27,
    complexPatternChance: 0.65,
    vehicleSpeedMultiplier: 1.16,
    reactionDistance: 16,
    coinDensity: 0.69,
  },
  {
    id: 'zenith',
    minimumDistance: 5_500,
    obstacleDensity: 0.58,
    movingObstacleChance: 0.35,
    complexPatternChance: 0.8,
    vehicleSpeedMultiplier: 1.28,
    reactionDistance: 15,
    coinDensity: 0.64,
  },
]);

export function assertDifficultyStages(
  stages: readonly DifficultyStage[],
): asserts stages is readonly [DifficultyStage, ...DifficultyStage[]] {
  if (stages.length === 0) {
    throw new Error('At least one difficulty stage is required');
  }
  let previousDistance = -1;
  for (const stage of stages) {
    if (!stage.id || !Number.isFinite(stage.minimumDistance) || stage.minimumDistance < 0) {
      throw new Error('Difficulty stages require an id and non-negative minimum distance');
    }
    if (stage.minimumDistance <= previousDistance) {
      throw new Error('Difficulty stages must be ordered by increasing minimum distance');
    }
    previousDistance = stage.minimumDistance;
  }
  const firstStage = stages[0];
  if (firstStage === undefined || firstStage.minimumDistance !== 0) {
    throw new Error('The first difficulty stage must start at zero metres');
  }
}
