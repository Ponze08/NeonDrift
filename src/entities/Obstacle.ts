import * as THREE from 'three';
import { BaseEntity, EntityKind, type SpawnPoint } from './Entity';

export type ObstacleType = 'low' | 'high' | 'blocker';
export type RequiredMove = 'jump' | 'slide' | 'lane-change';

const LOW_GEOMETRY = new THREE.BoxGeometry(1.75, 0.72, 0.72);
const HIGH_GEOMETRY = new THREE.BoxGeometry(1.95, 0.72, 0.76);
const BLOCKER_GEOMETRY = new THREE.BoxGeometry(2.25, 2.55, 0.9);
const STRIPE_GEOMETRY = new THREE.BoxGeometry(1.8, 0.12, 0.05);

const LOW_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xff7657, roughness: 0.6 });
const HIGH_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x65e6ff, roughness: 0.48 });
const BLOCKER_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8b65ff, roughness: 0.58 });
const STRIPE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffef99 });

export class Obstacle extends BaseEntity {
  public readonly kind = EntityKind.Obstacle;
  public obstacleType: ObstacleType = 'low';
  public requiredMove: RequiredMove = 'jump';
  public countedAsPassed = false;

  private readonly body: THREE.Mesh;
  private readonly stripe: THREE.Mesh;
  private readonly halfSize = new THREE.Vector3();
  private minY = 0;

  public constructor() {
    super();
    this.body = new THREE.Mesh(LOW_GEOMETRY, LOW_MATERIAL);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.stripe = new THREE.Mesh(STRIPE_GEOMETRY, STRIPE_MATERIAL);
    this.stripe.position.z = -0.39;
    this.add(this.body, this.stripe);
  }

  public spawn(point: SpawnPoint, type: ObstacleType): void {
    this.activate(point);
    this.countedAsPassed = false;
    this.obstacleType = type;

    switch (type) {
      case 'low':
        this.requiredMove = 'jump';
        this.body.geometry = LOW_GEOMETRY;
        this.body.material = LOW_MATERIAL;
        this.halfSize.set(0.875, 0.36, 0.36);
        this.minY = 0;
        this.body.position.y = 0.36;
        this.stripe.position.set(0, 0.48, -0.39);
        this.stripe.scale.set(0.9, 1, 1);
        break;
      case 'high':
        this.requiredMove = 'slide';
        this.body.geometry = HIGH_GEOMETRY;
        this.body.material = HIGH_MATERIAL;
        this.halfSize.set(0.975, 0.36, 0.38);
        this.minY = 1.08;
        this.body.position.y = 1.44;
        this.stripe.position.set(0, 1.44, -0.41);
        this.stripe.scale.set(1, 1, 1);
        break;
      case 'blocker':
        this.requiredMove = 'lane-change';
        this.body.geometry = BLOCKER_GEOMETRY;
        this.body.material = BLOCKER_MATERIAL;
        this.halfSize.set(1.125, 1.275, 0.45);
        this.minY = 0;
        this.body.position.y = 1.275;
        this.stripe.position.set(0, 1.3, -0.48);
        this.stripe.scale.set(1.05, 1, 1);
        break;
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.active) return;
    this.stripe.material = STRIPE_MATERIAL;
    this.stripe.scale.y = 1 + Math.sin(this.position.z * 0.1 + deltaSeconds) * 0.02;
  }

  public override reset(): void {
    super.reset();
    this.countedAsPassed = false;
  }

  public getBounds(out: THREE.Box3): THREE.Box3 {
    out.min.set(
      this.position.x - this.halfSize.x,
      this.position.y + this.minY,
      this.position.z - this.halfSize.z,
    );
    out.max.set(
      this.position.x + this.halfSize.x,
      this.position.y + this.minY + this.halfSize.y * 2,
      this.position.z + this.halfSize.z,
    );
    return out;
  }
}
