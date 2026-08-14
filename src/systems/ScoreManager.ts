import { GAME_CONFIG, type ScoreConfig } from '../core/Config';

export interface ScoreSnapshot {
  readonly score: number;
  readonly rawScore: number;
  readonly distance: number;
  readonly coins: number;
  readonly multiplier: number;
  readonly baseMultiplier: number;
  readonly powerUpMultiplier: number;
  readonly elapsedSeconds: number;
  readonly speed: number;
}

export interface ScoreUpdate {
  readonly scoreAdded: number;
  readonly distanceAdded: number;
  readonly multiplierChanged: boolean;
  readonly snapshot: ScoreSnapshot;
}

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export class ScoreManager {
  private rawScoreValue = 0;
  private distanceValue = 0;
  private coinsValue = 0;
  private elapsedValue = 0;
  private speedValue = 0;
  private boostMultiplier = 1;

  public constructor(private readonly config: ScoreConfig = GAME_CONFIG.score) {
    if (config.multiplierDistanceStep <= 0 || config.maximumMultiplier < 1) {
      throw new RangeError('Score multiplier configuration is invalid');
    }
  }

  public get snapshot(): ScoreSnapshot {
    const baseMultiplier = this.getBaseMultiplier(this.distanceValue);
    return {
      score: Math.floor(this.rawScoreValue),
      rawScore: this.rawScoreValue,
      distance: this.distanceValue,
      coins: this.coinsValue,
      multiplier: baseMultiplier * this.boostMultiplier,
      baseMultiplier,
      powerUpMultiplier: this.boostMultiplier,
      elapsedSeconds: this.elapsedValue,
      speed: this.speedValue,
    };
  }

  public update(deltaSeconds: number, speed: number): ScoreUpdate {
    const safeDelta = finitePositive(deltaSeconds);
    const safeSpeed = finitePositive(speed);
    const beforeScore = this.rawScoreValue;
    const previousMultiplier = this.getBaseMultiplier(this.distanceValue);
    const distanceAdded = safeDelta * safeSpeed;
    this.elapsedValue += safeDelta;
    this.speedValue = safeSpeed;
    this.addScoredDistance(distanceAdded, safeSpeed);
    return {
      scoreAdded: this.rawScoreValue - beforeScore,
      distanceAdded,
      multiplierChanged: previousMultiplier !== this.getBaseMultiplier(this.distanceValue),
      snapshot: this.snapshot,
    };
  }

  /** Useful when the world reports authoritative distance rather than speed * dt. */
  public addDistance(distance: number, speed = this.speedValue): number {
    const safeDistance = finitePositive(distance);
    const before = this.rawScoreValue;
    this.speedValue = finitePositive(speed);
    this.addScoredDistance(safeDistance, this.speedValue);
    return this.rawScoreValue - before;
  }

  public collectCoins(count = 1): number {
    if (!Number.isInteger(count) || count <= 0) return 0;
    this.coinsValue += count;
    const points =
      count *
      this.config.pointsPerCoin *
      this.getBaseMultiplier(this.distanceValue) *
      this.boostMultiplier;
    this.rawScoreValue += points;
    return points;
  }

  public addBonus(points: number, affectedByMultiplier = false): number {
    const safePoints = finitePositive(points);
    const awarded = affectedByMultiplier
      ? safePoints * this.getBaseMultiplier(this.distanceValue) * this.boostMultiplier
      : safePoints;
    this.rawScoreValue += awarded;
    return awarded;
  }

  public setPowerUpMultiplier(multiplier: number): void {
    this.boostMultiplier = Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
  }

  public reset(): void {
    this.rawScoreValue = 0;
    this.distanceValue = 0;
    this.coinsValue = 0;
    this.elapsedValue = 0;
    this.speedValue = 0;
    this.boostMultiplier = 1;
  }

  private getBaseMultiplier(distance: number): number {
    return Math.min(
      this.config.maximumMultiplier,
      1 + Math.floor(distance / this.config.multiplierDistanceStep),
    );
  }

  private addScoredDistance(distance: number, speed: number): void {
    let remaining = distance;
    while (remaining > 0) {
      const multiplier = this.getBaseMultiplier(this.distanceValue);
      const nextThreshold =
        multiplier >= this.config.maximumMultiplier
          ? Number.POSITIVE_INFINITY
          : multiplier * this.config.multiplierDistanceStep;
      const chunk = Math.min(remaining, nextThreshold - this.distanceValue);
      const basePointsPerMetre = this.config.pointsPerMetre + speed * this.config.speedPointFactor;
      this.rawScoreValue += chunk * basePointsPerMetre * multiplier * this.boostMultiplier;
      this.distanceValue += chunk;
      remaining -= chunk;
    }
  }
}
