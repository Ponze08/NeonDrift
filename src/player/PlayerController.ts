import type { LaneIndex } from '../entities/Entity';

export interface PlayerControllerConfig {
  laneSpacing: number;
  laneSwitchSpeed: number;
  jumpHeight: number;
  jumpDuration: number;
  gravity: number;
  slideDuration: number;
}

export const DEFAULT_PLAYER_CONTROLLER_CONFIG: Readonly<PlayerControllerConfig> = {
  laneSpacing: 2.65,
  laneSwitchSpeed: 13,
  jumpHeight: 2.35,
  jumpDuration: 0.86,
  gravity: 22,
  slideDuration: 0.72,
};

export interface PlayerMotionState {
  readonly lane: LaneIndex;
  readonly targetLane: LaneIndex;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly lateralVelocity: number;
  readonly grounded: boolean;
  readonly sliding: boolean;
  readonly jumpProgress: number;
}

function clampLane(value: number): LaneIndex {
  return Math.max(-1, Math.min(1, Math.round(value))) as LaneIndex;
}

export class PlayerController {
  public readonly config: PlayerControllerConfig;

  private currentLane: LaneIndex = 0;
  private desiredLane: LaneIndex = 0;
  private currentX = 0;
  private currentY = 0;
  private currentZ = 0;
  private previousX = 0;
  private jumpElapsed = 0;
  private jumpScale = 1;
  private slideRemaining = 0;
  private isJumping = false;

  public constructor(config: Partial<PlayerControllerConfig> = {}) {
    this.config = { ...DEFAULT_PLAYER_CONTROLLER_CONFIG, ...config };
  }

  public get state(): PlayerMotionState {
    return {
      lane: this.currentLane,
      targetLane: this.desiredLane,
      x: this.currentX,
      y: this.currentY,
      z: this.currentZ,
      lateralVelocity: this.currentX - this.previousX,
      grounded: !this.isJumping,
      sliding: this.slideRemaining > 0,
      jumpProgress: this.isJumping
        ? Math.min(1, this.jumpElapsed / Math.max(0.001, this.config.jumpDuration))
        : 0,
    };
  }

  public get lane(): LaneIndex {
    return this.currentLane;
  }

  public get targetLane(): LaneIndex {
    return this.desiredLane;
  }

  public get grounded(): boolean {
    return !this.isJumping;
  }

  public get sliding(): boolean {
    return this.slideRemaining > 0;
  }

  public reset(z = 0): void {
    this.currentLane = 0;
    this.desiredLane = 0;
    this.currentX = 0;
    this.previousX = 0;
    this.currentY = 0;
    this.currentZ = z;
    this.jumpElapsed = 0;
    this.slideRemaining = 0;
    this.isJumping = false;
    this.jumpScale = 1;
  }

  public setLane(lane: LaneIndex, snap = false): void {
    this.desiredLane = clampLane(lane);
    if (snap) {
      this.currentLane = this.desiredLane;
      this.currentX = this.desiredLane * this.config.laneSpacing;
      this.previousX = this.currentX;
    }
  }

  public moveLeft(): boolean {
    if (this.desiredLane <= -1) return false;
    this.desiredLane = clampLane(this.desiredLane - 1);
    return true;
  }

  public moveRight(): boolean {
    if (this.desiredLane >= 1) return false;
    this.desiredLane = clampLane(this.desiredLane + 1);
    return true;
  }

  public jump(heightScale = 1): boolean {
    if (this.isJumping || this.slideRemaining > 0) return false;
    this.isJumping = true;
    this.jumpElapsed = 0;
    this.jumpScale = Math.max(0.25, heightScale);
    return true;
  }

  public slide(): boolean {
    if (this.isJumping) return false;
    const wasSliding = this.slideRemaining > 0;
    this.slideRemaining = this.config.slideDuration;
    return !wasSliding;
  }

  public update(deltaSeconds: number, forwardSpeed: number): PlayerMotionState {
    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    this.previousX = this.currentX;
    this.currentZ += Math.max(0, forwardSpeed) * dt;

    const targetX = this.desiredLane * this.config.laneSpacing;
    const smoothing =
      1 - Math.exp((-this.config.laneSwitchSpeed * dt) / Math.max(0.01, this.config.laneSpacing));
    this.currentX += (targetX - this.currentX) * smoothing;
    if (Math.abs(targetX - this.currentX) < 0.006) {
      this.currentX = targetX;
      this.currentLane = this.desiredLane;
    }

    if (this.isJumping) {
      this.jumpElapsed += dt;
      const durationFromGravity = Math.sqrt(
        (8 * this.config.jumpHeight * this.jumpScale) / Math.max(0.01, this.config.gravity),
      );
      const duration = Math.max(0.2, (this.config.jumpDuration + durationFromGravity) * 0.5);
      const progress = Math.min(1, this.jumpElapsed / duration);
      this.currentY = 4 * this.config.jumpHeight * this.jumpScale * progress * (1 - progress);
      if (progress >= 1) {
        this.isJumping = false;
        this.jumpElapsed = 0;
        this.currentY = 0;
      }
    } else {
      this.currentY = 0;
    }

    if (this.slideRemaining > 0) {
      this.slideRemaining = Math.max(0, this.slideRemaining - dt);
    }

    return this.state;
  }
}
