import * as THREE from 'three';
import type { Player } from '../player/Player';
import {
  DifficultyManager,
  createDifficultySnapshot,
  type DifficultySnapshot,
  type DifficultyStage,
} from './DifficultyManager';
import { TrackManager, type TrackCollisionResult, type TrackManagerConfig } from './TrackManager';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface WorldManagerConfig extends Partial<TrackManagerConfig> {
  fogNear: number;
  fogFar: number;
  backgroundColour: number;
  graphicsQuality: GraphicsQuality;
  difficultyStages?: readonly DifficultyStage[];
}

export const DEFAULT_WORLD_MANAGER_CONFIG: Readonly<
  Omit<WorldManagerConfig, keyof TrackManagerConfig | 'difficultyStages'>
> = {
  fogNear: 45,
  fogFar: 170,
  backgroundColour: 0x0d1028,
  graphicsQuality: 'high',
};

export class WorldManager extends THREE.Group {
  public readonly track: TrackManager;
  public readonly difficulty: DifficultyManager;
  public readonly difficultySnapshot = createDifficultySnapshot();

  private readonly scene: THREE.Scene;
  private readonly sun: THREE.DirectionalLight;
  private readonly atmosphere: THREE.Group;
  private readonly playerTarget = new THREE.Vector3();
  private readonly fogColour = new THREE.Color();
  private graphicsQuality: GraphicsQuality;
  private disposed = false;

  public constructor(scene: THREE.Scene, config: Partial<WorldManagerConfig> = {}) {
    super();
    this.name = 'world-manager';
    this.scene = scene;
    const merged = { ...DEFAULT_WORLD_MANAGER_CONFIG, ...config };
    this.graphicsQuality = merged.graphicsQuality;
    this.track = new TrackManager(config);
    this.difficulty = new DifficultyManager(config.difficultyStages);

    const hemisphere = new THREE.HemisphereLight(0x8bdcff, 0x211635, 1.45);
    this.sun = new THREE.DirectionalLight(0xffe5c2, 2.1);
    this.sun.position.set(-12, 25, -8);
    this.sun.castShadow = merged.graphicsQuality !== 'low';
    this.sun.shadow.mapSize.set(
      merged.graphicsQuality === 'high' ? 1536 : 768,
      merged.graphicsQuality === 'high' ? 1536 : 768,
    );
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -6;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 90;

    this.atmosphere = this.createAtmosphere();
    this.add(this.track, hemisphere, this.sun, this.atmosphere);
    this.scene.add(this);
    this.scene.background = new THREE.Color(merged.backgroundColour);
    this.scene.fog = new THREE.Fog(merged.backgroundColour, merged.fogNear, merged.fogFar);
  }

  public reset(seed?: string | number, playerZ = 0): void {
    const snapshot = this.difficulty.getDifficulty(0, this.difficultySnapshot);
    this.track.reset(seed, playerZ, snapshot);
    this.applyDecorationQuality();
    this.atmosphere.position.z = playerZ + 80;
  }

  public update(deltaSeconds: number, player: Player, distance: number): DifficultySnapshot {
    const snapshot = this.difficulty.getDifficulty(distance, this.difficultySnapshot);
    this.playerTarget.copy(player.position);
    this.playerTarget.y += 1;
    this.track.update(
      deltaSeconds,
      player.position.z,
      snapshot,
      this.playerTarget,
      player.magnetRadius,
    );
    this.applyDecorationQuality();
    this.sun.position.z = player.position.z - 8;
    this.sun.target.position.set(0, 0, player.position.z + 18);
    if (this.sun.target.parent !== this) this.add(this.sun.target);
    this.atmosphere.position.z = player.position.z + 82;
    this.atmosphere.rotation.z += deltaSeconds * 0.012;
    this.updateColour(distance);
    return snapshot;
  }

  public checkCollisions(player: Player, out?: TrackCollisionResult): TrackCollisionResult {
    return this.track.checkCollisions(player, out);
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphicsQuality = quality;
    this.sun.castShadow = quality !== 'low';
    const shadowSize = quality === 'high' ? 1536 : 768;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.applyDecorationQuality();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.track.dispose();
    this.atmosphere.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.clear();
    this.removeFromParent();
  }

  private createAtmosphere(): THREE.Group {
    const group = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x536fff,
      transparent: true,
      opacity: 0.22,
      fog: true,
    });
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(24 + index * 10, 0.12, 5, 64),
        ringMaterial,
      );
      ring.position.set(0, 17 + index * 4, index * 7);
      ring.rotation.x = Math.PI * 0.5;
      group.add(ring);
    }
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9bd4, fog: true }),
    );
    moon.position.set(-28, 26, 36);
    moon.rotation.y = Math.PI;
    group.add(moon);
    return group;
  }

  private updateColour(distance: number): void {
    const hue = (0.64 + Math.max(0, distance) * 0.000018) % 1;
    this.fogColour.setHSL(hue, 0.48, 0.105);
    if (this.scene.background instanceof THREE.Color)
      this.scene.background.lerp(this.fogColour, 0.012);
    if (this.scene.fog instanceof THREE.Fog)
      this.scene.fog.color.copy(this.scene.background as THREE.Color);
  }

  private applyDecorationQuality(): void {
    this.track.decorations.forEach((decoration) => {
      decoration.visible = this.graphicsQuality !== 'low' && decoration.active;
    });
  }
}
