import { GAME_CONFIG, type ProgressionConfig } from '../core/Config';

export interface ProgressionState {
  readonly level: number;
  readonly experience: number;
}

export interface ProgressionSnapshot extends ProgressionState {
  readonly experienceForNextLevel: number;
  readonly progress: number;
  readonly totalExperience: number;
}

export interface ExperienceGain {
  readonly experienceAdded: number;
  readonly previousLevel: number;
  readonly levelsGained: number;
  readonly coinReward: number;
  readonly snapshot: ProgressionSnapshot;
}

export interface RunExperienceSummary {
  readonly score: number;
  readonly distance: number;
  readonly coins: number;
  readonly completedMissions?: number;
}

export type LevelUpListener = (newLevel: number, coinReward: number) => void;

export function experienceForLevel(
  level: number,
  config: ProgressionConfig = GAME_CONFIG.progression,
): number {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return Math.max(
    1,
    Math.round(config.baseExperiencePerLevel * safeLevel ** config.experienceExponent),
  );
}

export function totalExperienceForLevel(
  level: number,
  config: ProgressionConfig = GAME_CONFIG.progression,
): number {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  let total = 0;
  for (let current = 1; current < safeLevel; current += 1) {
    total += experienceForLevel(current, config);
  }
  return total;
}

export function calculateRunExperience(summary: RunExperienceSummary): number {
  const score = Number.isFinite(summary.score) ? Math.max(0, summary.score) : 0;
  const distance = Number.isFinite(summary.distance) ? Math.max(0, summary.distance) : 0;
  const coins = Number.isFinite(summary.coins) ? Math.max(0, summary.coins) : 0;
  const missions = Number.isFinite(summary.completedMissions)
    ? Math.max(0, summary.completedMissions ?? 0)
    : 0;
  return Math.max(0, Math.floor(distance / 20 + coins * 2 + score / 500 + missions * 35));
}

export class ProgressionManager {
  private levelValue: number;
  private experienceValue: number;
  private readonly levelListeners = new Set<LevelUpListener>();

  public constructor(
    initialState: ProgressionState = { level: 1, experience: 0 },
    private readonly config: ProgressionConfig = GAME_CONFIG.progression,
  ) {
    this.levelValue = Math.max(1, Math.floor(initialState.level));
    this.experienceValue = Math.max(0, Math.floor(initialState.experience));
    this.normaliseOverflow();
  }

  public get snapshot(): ProgressionSnapshot {
    const required = experienceForLevel(this.levelValue, this.config);
    return {
      level: this.levelValue,
      experience: this.experienceValue,
      experienceForNextLevel: required,
      progress: required <= 0 ? 0 : this.experienceValue / required,
      totalExperience: totalExperienceForLevel(this.levelValue, this.config) + this.experienceValue,
    };
  }

  public addExperience(amount: number): ExperienceGain {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    const previousLevel = this.levelValue;
    let coinReward = 0;
    this.experienceValue += safeAmount;
    while (this.experienceValue >= experienceForLevel(this.levelValue, this.config)) {
      this.experienceValue -= experienceForLevel(this.levelValue, this.config);
      this.levelValue += 1;
      const reward = Math.round(
        this.config.levelRewardBaseCoins +
          Math.max(0, this.levelValue - 2) * this.config.levelRewardGrowth,
      );
      coinReward += reward;
      for (const listener of [...this.levelListeners]) listener(this.levelValue, reward);
    }
    return {
      experienceAdded: safeAmount,
      previousLevel,
      levelsGained: this.levelValue - previousLevel,
      coinReward,
      snapshot: this.snapshot,
    };
  }

  public applyRun(summary: RunExperienceSummary): ExperienceGain {
    return this.addExperience(calculateRunExperience(summary));
  }

  public setState(state: ProgressionState): ProgressionSnapshot {
    this.levelValue = Number.isFinite(state.level) ? Math.max(1, Math.floor(state.level)) : 1;
    this.experienceValue = Number.isFinite(state.experience)
      ? Math.max(0, Math.floor(state.experience))
      : 0;
    this.normaliseOverflow();
    return this.snapshot;
  }

  public onLevelUp(listener: LevelUpListener): () => void {
    this.levelListeners.add(listener);
    return () => this.levelListeners.delete(listener);
  }

  private normaliseOverflow(): void {
    while (this.experienceValue >= experienceForLevel(this.levelValue, this.config)) {
      this.experienceValue -= experienceForLevel(this.levelValue, this.config);
      this.levelValue += 1;
    }
  }
}
