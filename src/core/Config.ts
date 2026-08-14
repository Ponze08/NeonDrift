export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface ColliderConfig {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly slideHeight: number;
}

export interface PlayerConfig {
  readonly startingSpeed: number;
  readonly maximumSpeed: number;
  readonly acceleration: number;
  readonly laneSpacing: number;
  readonly laneSwitchSpeed: number;
  readonly jumpHeight: number;
  readonly jumpDuration: number;
  readonly gravity: number;
  readonly slideDuration: number;
  readonly invulnerabilityDuration: number;
  readonly collider: ColliderConfig;
}

export interface InputConfig {
  readonly swipeThreshold: number;
  readonly inputCooldown: number;
  readonly maximumSwipeDuration: number;
}

export interface CameraConfig {
  readonly followSmoothing: number;
  readonly horizontalSmoothing: number;
  readonly lookAhead: number;
  readonly baseFieldOfView: number;
  readonly maximumFieldOfView: number;
  readonly shakeDuration: number;
  readonly shakeStrength: number;
}

export interface WorldConfig {
  readonly segmentLength: number;
  readonly segmentsAhead: number;
  readonly segmentsBehind: number;
  readonly laneCount: 3;
  readonly fogNear: number;
  readonly fogFar: number;
}

export interface ScoreConfig {
  readonly pointsPerMetre: number;
  readonly speedPointFactor: number;
  readonly pointsPerCoin: number;
  readonly multiplierDistanceStep: number;
  readonly maximumMultiplier: number;
}

export interface ProgressionConfig {
  readonly baseExperiencePerLevel: number;
  readonly experienceExponent: number;
  readonly levelRewardBaseCoins: number;
  readonly levelRewardGrowth: number;
}

export interface PerformanceConfig {
  readonly maximumDeltaSeconds: number;
  readonly maximumPixelRatio: number;
  readonly defaultQuality: GraphicsQuality;
}

export interface PowerUpRuntimeConfig {
  readonly coinMagnetDuration: number;
  readonly coinMagnetRadius: number;
  readonly scoreBoosterDuration: number;
  readonly scoreBoosterMultiplier: number;
  readonly skyBootsDuration: number;
  readonly skyBootsJumpMultiplier: number;
  readonly dashDuration: number;
  readonly dashSpeedMultiplier: number;
}

export interface GameConfig {
  readonly player: PlayerConfig;
  readonly input: InputConfig;
  readonly camera: CameraConfig;
  readonly world: WorldConfig;
  readonly score: ScoreConfig;
  readonly progression: ProgressionConfig;
  readonly performance: PerformanceConfig;
  readonly powerUps: PowerUpRuntimeConfig;
}

/**
 * Central gameplay tuning. Values use seconds and world metres.
 * Keeping this object data-only makes it safe to reuse in tests and tools.
 */
export const GAME_CONFIG: GameConfig = Object.freeze({
  player: Object.freeze({
    startingSpeed: 12,
    maximumSpeed: 28,
    acceleration: 0.22,
    laneSpacing: 3,
    laneSwitchSpeed: 12,
    jumpHeight: 2.8,
    jumpDuration: 0.82,
    gravity: 22,
    slideDuration: 0.72,
    invulnerabilityDuration: 1.4,
    collider: Object.freeze({
      width: 0.9,
      height: 1.85,
      depth: 0.75,
      slideHeight: 0.85,
    }),
  }),
  input: Object.freeze({
    swipeThreshold: 34,
    inputCooldown: 0.09,
    maximumSwipeDuration: 0.65,
  }),
  camera: Object.freeze({
    followSmoothing: 7,
    horizontalSmoothing: 5,
    lookAhead: 14,
    baseFieldOfView: 58,
    maximumFieldOfView: 72,
    shakeDuration: 0.28,
    shakeStrength: 0.22,
  }),
  world: Object.freeze({
    segmentLength: 42,
    segmentsAhead: 8,
    segmentsBehind: 2,
    laneCount: 3,
    fogNear: 52,
    fogFar: 245,
  }),
  score: Object.freeze({
    pointsPerMetre: 5,
    speedPointFactor: 0.08,
    pointsPerCoin: 25,
    multiplierDistanceStep: 220,
    maximumMultiplier: 12,
  }),
  progression: Object.freeze({
    baseExperiencePerLevel: 100,
    experienceExponent: 1.42,
    levelRewardBaseCoins: 75,
    levelRewardGrowth: 25,
  }),
  performance: Object.freeze({
    maximumDeltaSeconds: 0.05,
    maximumPixelRatio: 2,
    defaultQuality: 'medium',
  }),
  powerUps: Object.freeze({
    coinMagnetDuration: 8,
    coinMagnetRadius: 7,
    scoreBoosterDuration: 9,
    scoreBoosterMultiplier: 2,
    skyBootsDuration: 9,
    skyBootsJumpMultiplier: 1.35,
    dashDuration: 5,
    dashSpeedMultiplier: 1.12,
  }),
});

export const DEFAULT_GAME_CONFIG = GAME_CONFIG;

export function clampDeltaTime(
  deltaSeconds: number,
  maximumDeltaSeconds = GAME_CONFIG.performance.maximumDeltaSeconds,
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }
  return Math.min(deltaSeconds, Math.max(0, maximumDeltaSeconds));
}
