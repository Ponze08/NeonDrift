import * as THREE from 'three';

export interface PlayerColliderConfig {
  width: number;
  height: number;
  depth: number;
  slideHeight: number;
  skin: number;
}

export const DEFAULT_PLAYER_COLLIDER_CONFIG: Readonly<PlayerColliderConfig> = {
  width: 0.9,
  height: 2.15,
  depth: 0.75,
  slideHeight: 0.82,
  skin: 0.06,
};

export class PlayerCollision {
  public readonly config: PlayerColliderConfig;
  private readonly bounds = new THREE.Box3();

  public constructor(config: Partial<PlayerColliderConfig> = {}) {
    this.config = { ...DEFAULT_PLAYER_COLLIDER_CONFIG, ...config };
  }

  public update(position: THREE.Vector3, sliding: boolean): THREE.Box3 {
    const height = sliding ? this.config.slideHeight : this.config.height;
    const halfWidth = Math.max(0.01, this.config.width * 0.5 - this.config.skin);
    const halfDepth = Math.max(0.01, this.config.depth * 0.5 - this.config.skin);
    this.bounds.min.set(position.x - halfWidth, position.y, position.z - halfDepth);
    this.bounds.max.set(position.x + halfWidth, position.y + height, position.z + halfDepth);
    return this.bounds;
  }

  public getBounds(): THREE.Box3 {
    return this.bounds;
  }

  public intersects(other: THREE.Box3): boolean {
    return this.bounds.intersectsBox(other);
  }

  public intersectsSphere(other: THREE.Sphere): boolean {
    return this.bounds.intersectsSphere(other);
  }
}
