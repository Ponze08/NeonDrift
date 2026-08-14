import * as THREE from 'three';

export type LaneIndex = -1 | 0 | 1;

export const LANES: readonly LaneIndex[] = [-1, 0, 1] as const;

export enum EntityKind {
  Coin = 'coin',
  Obstacle = 'obstacle',
  Vehicle = 'vehicle',
  PowerUp = 'power-up',
  Decoration = 'decoration',
}

export interface SpawnPoint {
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
}

export interface PoolableEntity {
  readonly object: THREE.Object3D;
  readonly kind: EntityKind;
  active: boolean;
  reset(): void;
  update(deltaSeconds: number): void;
}

export abstract class BaseEntity extends THREE.Group implements PoolableEntity {
  public abstract readonly kind: EntityKind;
  public active = false;
  public lane: LaneIndex = 0;

  public get object(): THREE.Object3D {
    return this;
  }

  protected constructor() {
    super();
    this.visible = false;
    this.matrixAutoUpdate = true;
  }

  public activate(point: SpawnPoint): void {
    this.active = true;
    this.visible = true;
    this.lane = point.lane;
    this.position.set(point.x, point.y, point.z);
    this.rotation.set(0, 0, 0);
    this.scale.setScalar(1);
  }

  public reset(): void {
    this.active = false;
    this.visible = false;
    this.position.set(0, 0, 0);
    this.rotation.set(0, 0, 0);
    this.scale.setScalar(1);
  }

  public abstract update(deltaSeconds: number): void;
}
