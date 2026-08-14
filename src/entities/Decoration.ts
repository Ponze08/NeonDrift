import * as THREE from 'three';
import { BaseEntity, EntityKind, type SpawnPoint } from './Entity';

const BUILDING_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const SIGN_GEOMETRY = new THREE.PlaneGeometry(0.7, 0.26);
const BUILDING_MATERIALS = [
  new THREE.MeshStandardMaterial({ color: 0x25305c, roughness: 0.86 }),
  new THREE.MeshStandardMaterial({ color: 0x3d2763, roughness: 0.86 }),
  new THREE.MeshStandardMaterial({ color: 0x17495b, roughness: 0.86 }),
];
const SIGN_MATERIALS = [
  new THREE.MeshBasicMaterial({ color: 0x55eaff }),
  new THREE.MeshBasicMaterial({ color: 0xff5ca8 }),
  new THREE.MeshBasicMaterial({ color: 0xffd45d }),
];

export class Decoration extends BaseEntity {
  public readonly kind = EntityKind.Decoration;
  private readonly building: THREE.Mesh;
  private readonly sign: THREE.Mesh;
  private baseSignY = 1;
  private age = 0;

  public constructor() {
    super();
    this.building = new THREE.Mesh(BUILDING_GEOMETRY, BUILDING_MATERIALS[0]!);
    this.building.receiveShadow = true;
    this.sign = new THREE.Mesh(SIGN_GEOMETRY, SIGN_MATERIALS[0]!);
    this.sign.position.z = -0.505;
    this.add(this.building, this.sign);
  }

  public spawn(
    point: SpawnPoint,
    width: number,
    height: number,
    depth: number,
    variant: number,
  ): void {
    this.activate(point);
    const index = Math.abs(variant) % BUILDING_MATERIALS.length;
    this.building.material = BUILDING_MATERIALS[index] ?? BUILDING_MATERIALS[0]!;
    this.sign.material = SIGN_MATERIALS[index] ?? SIGN_MATERIALS[0]!;
    this.building.scale.set(width, height, depth);
    this.building.position.y = height * 0.5;
    this.sign.scale.set(Math.min(width * 0.72, 2.3), 1, 1);
    this.baseSignY = Math.min(height * 0.62, height - 0.5);
    this.sign.position.set(0, this.baseSignY, -depth * 0.5 - 0.01);
    this.age = variant * 0.7;
  }

  public update(deltaSeconds: number): void {
    if (!this.active) return;
    this.age += deltaSeconds;
    this.sign.position.y = this.baseSignY + Math.sin(this.age * 1.5) * 0.035;
  }
}
