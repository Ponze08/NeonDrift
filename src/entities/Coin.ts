import * as THREE from 'three';
import { BaseEntity, EntityKind, type SpawnPoint } from './Entity';

const COIN_GEOMETRY = new THREE.TorusGeometry(0.32, 0.095, 6, 12);
const COIN_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffd447,
  emissive: 0x7a3d00,
  emissiveIntensity: 0.42,
  metalness: 0.72,
  roughness: 0.24,
});

export class Coin extends BaseEntity {
  public readonly kind = EntityKind.Coin;
  public readonly collectionRadius = 0.62;

  private readonly mesh: THREE.Mesh;
  private readonly basePosition = new THREE.Vector3();
  private age = 0;
  private attracted = false;

  public constructor() {
    super();
    this.mesh = new THREE.Mesh(COIN_GEOMETRY, COIN_MATERIAL);
    this.mesh.rotation.y = Math.PI * 0.5;
    this.mesh.castShadow = true;
    this.add(this.mesh);
  }

  public spawn(point: SpawnPoint): void {
    this.activate(point);
    this.basePosition.copy(this.position);
    this.age = 0;
    this.attracted = false;
  }

  public override reset(): void {
    super.reset();
    this.age = 0;
    this.attracted = false;
  }

  public update(deltaSeconds: number): void {
    if (!this.active) return;
    this.age += deltaSeconds;
    this.rotation.y += deltaSeconds * 5.6;
    if (!this.attracted) {
      this.position.y = this.basePosition.y + Math.sin(this.age * 4.2) * 0.09;
    }
  }

  public attractTo(target: THREE.Vector3, deltaSeconds: number, radius: number): boolean {
    if (!this.active || radius <= 0) return false;
    const distanceSquared = this.position.distanceToSquared(target);
    if (!this.attracted && distanceSquared > radius * radius) return false;
    this.attracted = true;
    const alpha = 1 - Math.exp(-deltaSeconds * 12);
    this.position.lerp(target, alpha);
    return true;
  }

  public getBoundingSphere(out: THREE.Sphere): THREE.Sphere {
    out.center.copy(this.position);
    out.radius = this.collectionRadius;
    return out;
  }
}
