import * as THREE from 'three';
import { HoverDevice } from '../entities/HoverDevice';
import { POWER_UP_DEFINITIONS, PowerUpType } from '../entities/PowerUp';
import type { LaneIndex } from '../entities/Entity';
import { InputAction } from '../input/InputAction';
import { PlayerAnimator, type CharacterPalette } from './PlayerAnimator';
import { PlayerCollision, type PlayerColliderConfig } from './PlayerCollision';
import { PlayerController, type PlayerControllerConfig } from './PlayerController';

export interface PlayerConfig extends PlayerControllerConfig, PlayerColliderConfig {
  startingSpeed: number;
  maximumSpeed: number;
  acceleration: number;
  dashSpeedMultiplier: number;
  magnetRadius: number;
  skyBootsJumpMultiplier: number;
}

export const DEFAULT_PLAYER_CONFIG: Readonly<PlayerConfig> = {
  startingSpeed: 11,
  maximumSpeed: 28,
  acceleration: 0.18,
  laneSpacing: 2.65,
  laneSwitchSpeed: 13,
  jumpHeight: 2.35,
  jumpDuration: 0.86,
  gravity: 22,
  slideDuration: 0.72,
  width: 0.9,
  height: 2.15,
  depth: 0.75,
  slideHeight: 0.82,
  skin: 0.06,
  dashSpeedMultiplier: 1.12,
  magnetRadius: 6.5,
  skyBootsJumpMultiplier: 1.35,
};

export type PlayerEventName =
  | 'lane-change'
  | 'jump'
  | 'slide'
  | 'power-up'
  | 'shield-break'
  | 'hover-break'
  | 'collision'
  | 'crash';

export interface PlayerEvent {
  readonly type: PlayerEventName;
  readonly powerUp?: PowerUpType;
}

export type PlayerEventHandler = (event: PlayerEvent) => void;

export enum CollisionOutcome {
  Ignored = 'ignored',
  ShieldAbsorbed = 'shield-absorbed',
  HoverDeviceAbsorbed = 'hover-device-absorbed',
  Crashed = 'crashed',
}

function createPowerTimers(): Record<PowerUpType, number> {
  return {
    [PowerUpType.CoinMagnet]: 0,
    [PowerUpType.EnergyShield]: 0,
    [PowerUpType.ScoreBooster]: 0,
    [PowerUpType.SkyBoots]: 0,
    [PowerUpType.DashMode]: 0,
  };
}

export class Player extends THREE.Group {
  public readonly config: PlayerConfig;
  public readonly controller: PlayerController;
  public readonly collision: PlayerCollision;
  public readonly animator: PlayerAnimator;
  public readonly hoverDevice: HoverDevice;

  public currentSpeed: number;
  public crashed = false;

  private baseSpeed: number;
  private readonly powerTimers = createPowerTimers();
  private readonly eventHandler?: PlayerEventHandler;
  private invulnerabilityRemaining = 0;
  private hoverDeviceActive = false;
  private shieldAvailable = false;

  public constructor(
    config: Partial<PlayerConfig> = {},
    palette: Partial<CharacterPalette> = {},
    onEvent?: PlayerEventHandler,
  ) {
    super();
    this.name = 'player';
    this.config = { ...DEFAULT_PLAYER_CONFIG, ...config };
    this.controller = new PlayerController(this.config);
    this.collision = new PlayerCollision(this.config);
    this.animator = new PlayerAnimator(palette);
    this.hoverDevice = new HoverDevice();
    this.hoverDevice.position.z = 0.04;
    this.eventHandler = onEvent;
    this.baseSpeed = this.config.startingSpeed;
    this.currentSpeed = this.config.startingSpeed;
    this.add(this.hoverDevice, this.animator.object);
    this.reset();
  }

  public get lane(): LaneIndex {
    return this.controller.lane;
  }

  public get targetLane(): LaneIndex {
    return this.controller.targetLane;
  }

  public get grounded(): boolean {
    return this.controller.grounded;
  }

  public get sliding(): boolean {
    return this.controller.sliding;
  }

  public get scoreMultiplierBonus(): number {
    return this.isPowerUpActive(PowerUpType.ScoreBooster) ? 2 : 1;
  }

  public get magnetRadius(): number {
    if (this.isPowerUpActive(PowerUpType.DashMode)) return this.config.magnetRadius * 1.4;
    return this.isPowerUpActive(PowerUpType.CoinMagnet) ? this.config.magnetRadius : 0;
  }

  public get hasHoverDevice(): boolean {
    return this.hoverDeviceActive;
  }

  public get isInvulnerable(): boolean {
    return this.invulnerabilityRemaining > 0 || this.isPowerUpActive(PowerUpType.DashMode);
  }

  public reset(startZ = 0): void {
    this.controller.reset(startZ);
    this.animator.reset();
    this.hoverDevice.deactivate();
    this.hoverDeviceActive = false;
    this.shieldAvailable = false;
    this.invulnerabilityRemaining = 0;
    this.crashed = false;
    this.currentSpeed = this.config.startingSpeed;
    this.baseSpeed = this.config.startingSpeed;
    for (const type of Object.values(PowerUpType)) this.powerTimers[type] = 0;
    this.position.set(0, 0, startZ);
    this.rotation.set(0, 0, 0);
    this.visible = true;
    this.collision.update(this.position, false);
  }

  public handleAction(action: InputAction): boolean {
    if (this.crashed && action !== InputAction.Restart) return false;
    switch (action) {
      case InputAction.MoveLeft:
        if (this.controller.moveLeft()) {
          this.emit({ type: 'lane-change' });
          return true;
        }
        return false;
      case InputAction.MoveRight:
        if (this.controller.moveRight()) {
          this.emit({ type: 'lane-change' });
          return true;
        }
        return false;
      case InputAction.Jump: {
        const scale = this.isPowerUpActive(PowerUpType.SkyBoots)
          ? this.config.skyBootsJumpMultiplier
          : 1;
        if (this.controller.jump(scale)) {
          this.emit({ type: 'jump' });
          return true;
        }
        return false;
      }
      case InputAction.Slide:
        if (this.controller.slide()) {
          this.emit({ type: 'slide' });
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  public update(deltaSeconds: number, requestedSpeed?: number): void {
    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    this.updatePowerTimers(dt);
    if (!this.crashed) {
      this.baseSpeed =
        requestedSpeed === undefined
          ? Math.min(this.config.maximumSpeed, this.baseSpeed + this.config.acceleration * dt)
          : Math.min(this.config.maximumSpeed, Math.max(0, requestedSpeed));
      const dashScale = this.isPowerUpActive(PowerUpType.DashMode)
        ? this.config.dashSpeedMultiplier
        : 1;
      this.currentSpeed = Math.min(
        this.config.maximumSpeed * dashScale,
        this.baseSpeed * dashScale,
      );
      const motion = this.controller.update(dt, this.currentSpeed);
      this.position.set(motion.x, motion.y, motion.z);
      this.animator.update(dt, motion, this.currentSpeed);
    } else {
      this.animator.update(dt, this.controller.state, 0);
    }
    this.hoverDevice.update(dt);
    this.collision.update(this.position, this.controller.sliding);
  }

  public activatePowerUp(type: PowerUpType, duration = POWER_UP_DEFINITIONS[type].duration): void {
    this.powerTimers[type] = Math.max(this.powerTimers[type], Math.max(0, duration));
    if (type === PowerUpType.EnergyShield) this.shieldAvailable = true;
    this.emit({ type: 'power-up', powerUp: type });
  }

  public isPowerUpActive(type: PowerUpType): boolean {
    return this.powerTimers[type] > 0;
  }

  public getPowerUpRemaining(type: PowerUpType): number {
    return this.powerTimers[type];
  }

  public activateHoverDevice(): boolean {
    if (this.crashed || this.hoverDeviceActive) return false;
    this.hoverDeviceActive = true;
    this.hoverDevice.activate();
    return true;
  }

  public setTemporaryInvulnerability(seconds: number): void {
    this.invulnerabilityRemaining = Math.max(this.invulnerabilityRemaining, Math.max(0, seconds));
  }

  public handleHazardCollision(): CollisionOutcome {
    if (this.crashed || this.isInvulnerable) return CollisionOutcome.Ignored;
    this.emit({ type: 'collision' });
    if (this.shieldAvailable && this.isPowerUpActive(PowerUpType.EnergyShield)) {
      this.shieldAvailable = false;
      this.powerTimers[PowerUpType.EnergyShield] = 0;
      this.setTemporaryInvulnerability(1.15);
      this.emit({ type: 'shield-break' });
      return CollisionOutcome.ShieldAbsorbed;
    }
    if (this.hoverDeviceActive) {
      this.hoverDeviceActive = false;
      this.hoverDevice.deactivate();
      this.setTemporaryInvulnerability(1.35);
      this.emit({ type: 'hover-break' });
      return CollisionOutcome.HoverDeviceAbsorbed;
    }
    this.crashed = true;
    this.animator.crash();
    this.emit({ type: 'crash' });
    return CollisionOutcome.Crashed;
  }

  public getCollider(): THREE.Box3 {
    return this.collision.getBounds();
  }

  private updatePowerTimers(deltaSeconds: number): void {
    this.invulnerabilityRemaining = Math.max(0, this.invulnerabilityRemaining - deltaSeconds);
    for (const type of Object.values(PowerUpType)) {
      this.powerTimers[type] = Math.max(0, this.powerTimers[type] - deltaSeconds);
    }
    if (this.powerTimers[PowerUpType.EnergyShield] <= 0) this.shieldAvailable = false;
  }

  private emit(event: PlayerEvent): void {
    this.eventHandler?.(event);
  }
}
