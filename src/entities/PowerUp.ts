import * as THREE from 'three';
import { BaseEntity, EntityKind, type SpawnPoint } from './Entity';

export enum PowerUpType {
  CoinMagnet = 'coin-magnet',
  EnergyShield = 'energy-shield',
  ScoreBooster = 'score-booster',
  SkyBoots = 'sky-boots',
  DashMode = 'dash-mode',
}

export interface PowerUpDefinition {
  readonly duration: number;
  readonly colour: number;
}

export const POWER_UP_DEFINITIONS: Readonly<Record<PowerUpType, PowerUpDefinition>> = {
  [PowerUpType.CoinMagnet]: { duration: 9, colour: 0xff4c88 },
  [PowerUpType.EnergyShield]: { duration: 14, colour: 0x4be8ff },
  [PowerUpType.ScoreBooster]: { duration: 10, colour: 0xffce45 },
  [PowerUpType.SkyBoots]: { duration: 10, colour: 0x9c74ff },
  [PowerUpType.DashMode]: { duration: 6, colour: 0x50ff9d },
};

const CORE_GEOMETRY = new THREE.OctahedronGeometry(0.42, 0);
const RING_GEOMETRY = new THREE.TorusGeometry(0.58, 0.045, 5, 16);

export class PowerUp extends BaseEntity {
  public readonly kind = EntityKind.PowerUp;
  public readonly collectionRadius = 0.78;
  public powerType: PowerUpType = PowerUpType.CoinMagnet;

  private readonly core: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly basePosition = new THREE.Vector3();
  private age = 0;

  public constructor() {
    super();
    const material = new THREE.MeshStandardMaterial({
      color: POWER_UP_DEFINITIONS[this.powerType].colour,
      emissive: POWER_UP_DEFINITIONS[this.powerType].colour,
      emissiveIntensity: 0.52,
      metalness: 0.25,
      roughness: 0.25,
    });
    this.core = new THREE.Mesh(CORE_GEOMETRY, material);
    this.ring = new THREE.Mesh(
      RING_GEOMETRY,
      new THREE.MeshBasicMaterial({ color: POWER_UP_DEFINITIONS[this.powerType].colour }),
    );
    this.core.castShadow = true;
    this.ring.rotation.x = Math.PI * 0.5;
    this.add(this.core, this.ring);
  }

  public spawn(point: SpawnPoint, type: PowerUpType): void {
    this.activate(point);
    this.powerType = type;
    this.basePosition.copy(this.position);
    this.age = 0;
    const colour = POWER_UP_DEFINITIONS[type].colour;
    const coreMaterial = this.core.material as THREE.MeshStandardMaterial;
    coreMaterial.color.setHex(colour);
    coreMaterial.emissive.setHex(colour);
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(colour);
  }

  public update(deltaSeconds: number): void {
    if (!this.active) return;
    this.age += deltaSeconds;
    this.rotation.y += deltaSeconds * 2.8;
    this.ring.rotation.z -= deltaSeconds * 1.8;
    this.position.y = this.basePosition.y + Math.sin(this.age * 3.5) * 0.16;
    const scale = 1 + Math.sin(this.age * 5) * 0.06;
    this.core.scale.setScalar(scale);
  }

  public getBoundingSphere(out: THREE.Sphere): THREE.Sphere {
    out.center.copy(this.position);
    out.radius = this.collectionRadius;
    return out;
  }
}
