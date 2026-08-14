import { GAME_CONFIG } from '../core/Config';
import {
  DIFFICULTY_STAGES,
  assertDifficultyStages,
  type DifficultyStage,
} from '../data/difficulty';

export interface DifficultyManagerOptions {
  readonly stages?: readonly DifficultyStage[];
  readonly startingSpeed?: number;
  readonly maximumSpeed?: number;
  readonly acceleration?: number;
}

export interface DifficultySnapshot {
  readonly stage: DifficultyStage;
  readonly stageIndex: number;
  readonly stageProgress: number;
  readonly normalizedDifficulty: number;
  readonly speed: number;
  readonly obstacleDensity: number;
  readonly movingObstacleChance: number;
  readonly complexPatternChance: number;
  readonly vehicleSpeedMultiplier: number;
  readonly reactionDistance: number;
  readonly coinDensity: number;
}

export type DifficultyStageListener = (
  nextStage: DifficultyStage,
  previousStage: DifficultyStage,
) => void;

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export class DifficultyManager {
  private readonly stages: readonly [DifficultyStage, ...DifficultyStage[]];
  private readonly startingSpeed: number;
  private readonly maximumSpeed: number;
  private readonly acceleration: number;
  private distance = 0;
  private elapsedSeconds = 0;
  private stageIndex = 0;
  private readonly stageListeners = new Set<DifficultyStageListener>();

  public constructor(options: DifficultyManagerOptions = {}) {
    const stages = options.stages ?? DIFFICULTY_STAGES;
    assertDifficultyStages(stages);
    this.stages = stages;
    this.startingSpeed = options.startingSpeed ?? GAME_CONFIG.player.startingSpeed;
    this.maximumSpeed = options.maximumSpeed ?? GAME_CONFIG.player.maximumSpeed;
    this.acceleration = options.acceleration ?? GAME_CONFIG.player.acceleration;
    if (
      !Number.isFinite(this.startingSpeed) ||
      !Number.isFinite(this.maximumSpeed) ||
      this.startingSpeed <= 0 ||
      this.maximumSpeed < this.startingSpeed
    ) {
      throw new RangeError('Difficulty speed range is invalid');
    }
    if (!Number.isFinite(this.acceleration) || this.acceleration < 0) {
      throw new RangeError('Difficulty acceleration must be non-negative');
    }
  }

  public update(distance: number, elapsedSeconds = this.elapsedSeconds): DifficultySnapshot {
    this.distance = Number.isFinite(distance) ? Math.max(0, distance) : this.distance;
    this.elapsedSeconds = Number.isFinite(elapsedSeconds)
      ? Math.max(0, elapsedSeconds)
      : this.elapsedSeconds;
    this.refreshStage();
    return this.snapshot;
  }

  public advance(deltaSeconds: number, distanceDelta: number): DifficultySnapshot {
    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) this.elapsedSeconds += deltaSeconds;
    if (Number.isFinite(distanceDelta) && distanceDelta > 0) this.distance += distanceDelta;
    this.refreshStage();
    return this.snapshot;
  }

  public get snapshot(): DifficultySnapshot {
    const stage = this.getStage(this.stageIndex);
    const nextStage = this.stages[this.stageIndex + 1] ?? stage;
    const distanceRange = nextStage.minimumDistance - stage.minimumDistance;
    const stageProgress =
      distanceRange <= 0
        ? 1
        : Math.max(0, Math.min(1, (this.distance - stage.minimumDistance) / distanceRange));
    const denominator = Math.max(1, this.stages.length - 1);
    const normalizedDifficulty = Math.min(1, (this.stageIndex + stageProgress) / denominator);

    return {
      stage,
      stageIndex: this.stageIndex,
      stageProgress,
      normalizedDifficulty,
      speed: Math.min(
        this.maximumSpeed,
        this.startingSpeed + this.acceleration * this.elapsedSeconds,
      ),
      obstacleDensity: lerp(stage.obstacleDensity, nextStage.obstacleDensity, stageProgress),
      movingObstacleChance: lerp(
        stage.movingObstacleChance,
        nextStage.movingObstacleChance,
        stageProgress,
      ),
      complexPatternChance: lerp(
        stage.complexPatternChance,
        nextStage.complexPatternChance,
        stageProgress,
      ),
      vehicleSpeedMultiplier: lerp(
        stage.vehicleSpeedMultiplier,
        nextStage.vehicleSpeedMultiplier,
        stageProgress,
      ),
      reactionDistance: lerp(stage.reactionDistance, nextStage.reactionDistance, stageProgress),
      coinDensity: lerp(stage.coinDensity, nextStage.coinDensity, stageProgress),
    };
  }

  public onStageChange(listener: DifficultyStageListener): () => void {
    this.stageListeners.add(listener);
    return () => this.stageListeners.delete(listener);
  }

  public reset(): DifficultySnapshot {
    this.distance = 0;
    this.elapsedSeconds = 0;
    this.stageIndex = 0;
    return this.snapshot;
  }

  private refreshStage(): void {
    let nextIndex = 0;
    for (let index = 1; index < this.stages.length; index += 1) {
      if (this.distance < this.getStage(index).minimumDistance) break;
      nextIndex = index;
    }
    if (nextIndex === this.stageIndex) return;
    const previousStage = this.getStage(this.stageIndex);
    this.stageIndex = nextIndex;
    const nextStage = this.getStage(this.stageIndex);
    for (const listener of [...this.stageListeners]) listener(nextStage, previousStage);
  }

  private getStage(index: number): DifficultyStage {
    return this.stages[index] ?? this.stages[0];
  }
}
