import * as THREE from 'three';
import { BaseEntity, EntityKind, type SpawnPoint } from './Entity';

export type VehicleDirection = -1 | 1;

const BODY_GEOMETRY = new THREE.BoxGeometry(2.15, 1.25, 4.4);
const CABIN_GEOMETRY = new THREE.BoxGeometry(1.75, 0.72, 2.1);
const LIGHT_GEOMETRY = new THREE.BoxGeometry(0.42, 0.2, 0.08);
const BODY_MATERIALS = [
  new THREE.MeshStandardMaterial({ color: 0xff4d8d, metalness: 0.15, roughness: 0.48 }),
  new THREE.MeshStandardMaterial({ color: 0x39d9b7, metalness: 0.15, roughness: 0.48 }),
  new THREE.MeshStandardMaterial({ color: 0xffa62b, metalness: 0.15, roughness: 0.48 }),
];
const GLASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x173d62,
  emissive: 0x0b2947,
  emissiveIntensity: 0.35,
  metalness: 0.3,
  roughness: 0.2,
});
const LIGHT_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xe7fbff,
  transparent: true,
  opacity: 1,
});

export class Vehicle extends BaseEntity {
  public readonly kind = EntityKind.Vehicle;
  public speed = 5;
  public direction: VehicleDirection = -1;

  private readonly body: THREE.Mesh;
  private readonly leftLight: THREE.Mesh;
  private readonly rightLight: THREE.Mesh;

  public constructor() {
    super();
    this.body = new THREE.Mesh(BODY_GEOMETRY, BODY_MATERIALS[0]!);
    this.body.position.y = 0.8;
    this.body.castShadow = true;
    this.body.receiveShadow = true;

    const cabin = new THREE.Mesh(CABIN_GEOMETRY, GLASS_MATERIAL);
    cabin.position.set(0, 1.65, 0.15);
    cabin.castShadow = true;

    this.leftLight = new THREE.Mesh(LIGHT_GEOMETRY, LIGHT_MATERIAL);
    this.rightLight = new THREE.Mesh(LIGHT_GEOMETRY, LIGHT_MATERIAL);
    this.leftLight.position.set(-0.65, 0.75, -2.24);
    this.rightLight.position.set(0.65, 0.75, -2.24);
    this.add(this.body, cabin, this.leftLight, this.rightLight);
  }

  public spawn(
    point: SpawnPoint,
    speed: number,
    direction: VehicleDirection = -1,
    colourVariant = 0,
  ): void {
    this.activate(point);
    this.speed = Math.max(0, speed);
    this.direction = direction;
    this.rotation.y = direction === -1 ? 0 : Math.PI;
    this.body.material =
      BODY_MATERIALS[Math.abs(colourVariant) % BODY_MATERIALS.length] ?? BODY_MATERIALS[0]!;
  }

  public update(deltaSeconds: number): void {
    if (!this.active) return;
    this.position.z += this.direction * this.speed * deltaSeconds;
    const pulse = 0.78 + Math.sin(this.position.z * 0.22) * 0.22;
    (this.leftLight.material as THREE.MeshBasicMaterial).opacity = pulse;
    (this.rightLight.material as THREE.MeshBasicMaterial).opacity = pulse;
  }

  public getBounds(out: THREE.Box3): THREE.Box3 {
    out.min.set(this.position.x - 1.075, this.position.y, this.position.z - 2.2);
    out.max.set(this.position.x + 1.075, this.position.y + 2.05, this.position.z + 2.2);
    return out;
  }
}
