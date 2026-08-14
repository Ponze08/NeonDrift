export const LANES = [-1, 0, 1] as const;
export type Lane = (typeof LANES)[number];

export interface LaneModelOptions {
  readonly laneSpacing: number;
  readonly switchSpeed: number;
  readonly initialLane?: Lane;
}

export function isLane(value: number): value is Lane {
  return value === -1 || value === 0 || value === 1;
}

export function clampLane(value: number): Lane {
  if (value <= -1) return -1;
  if (value >= 1) return 1;
  return 0;
}

export function laneToX(lane: Lane, laneSpacing: number): number {
  return lane * laneSpacing;
}

/** Pure lane-position model; renderers can copy `x` onto any scene object. */
export class LaneModel {
  private current: Lane;
  private target: Lane;
  private positionX: number;
  private readonly laneSpacing: number;
  private readonly switchSpeed: number;

  public constructor(options: LaneModelOptions) {
    if (!Number.isFinite(options.laneSpacing) || options.laneSpacing <= 0) {
      throw new RangeError('laneSpacing must be greater than zero');
    }
    if (!Number.isFinite(options.switchSpeed) || options.switchSpeed <= 0) {
      throw new RangeError('switchSpeed must be greater than zero');
    }
    this.laneSpacing = options.laneSpacing;
    this.switchSpeed = options.switchSpeed;
    this.current = options.initialLane ?? 0;
    this.target = this.current;
    this.positionX = laneToX(this.current, this.laneSpacing);
  }

  public get lane(): Lane {
    return this.current;
  }

  public get targetLane(): Lane {
    return this.target;
  }

  public get x(): number {
    return this.positionX;
  }

  public get isSwitching(): boolean {
    return Math.abs(this.positionX - laneToX(this.target, this.laneSpacing)) > 1e-6;
  }

  public moveLeft(): boolean {
    return this.requestLane(clampLane(this.target - 1));
  }

  public moveRight(): boolean {
    return this.requestLane(clampLane(this.target + 1));
  }

  public requestLane(lane: Lane): boolean {
    if (lane === this.target) {
      return false;
    }
    this.target = lane;
    return true;
  }

  public update(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return this.positionX;
    }
    const targetX = laneToX(this.target, this.laneSpacing);
    const distance = targetX - this.positionX;
    const movement = Math.min(Math.abs(distance), this.switchSpeed * deltaSeconds);
    this.positionX += Math.sign(distance) * movement;
    if (Math.abs(targetX - this.positionX) <= 1e-6) {
      this.positionX = targetX;
      this.current = this.target;
    }
    return this.positionX;
  }

  public reset(lane: Lane = 0): void {
    this.current = lane;
    this.target = lane;
    this.positionX = laneToX(lane, this.laneSpacing);
  }
}
