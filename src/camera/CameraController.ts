import * as THREE from 'three';

export interface CameraVectorConfig {
  x: number;
  y: number;
  z: number;
}

export interface CameraControllerConfig {
  positionOffset: CameraVectorConfig;
  lookAtOffset: CameraVectorConfig;
  followSharpness: number;
  lookSharpness: number;
  horizontalInfluence: number;
  baseFov: number;
  maximumFov: number;
  speedForMaximumFov: number;
  shakeEnabled: boolean;
  shakeDecay: number;
  maximumShake: number;
}

export const DEFAULT_CAMERA_CONFIG: Readonly<CameraControllerConfig> = {
  positionOffset: { x: 0, y: 5.4, z: -9.5 },
  lookAtOffset: { x: 0, y: 1.15, z: 10.5 },
  followSharpness: 7.5,
  lookSharpness: 10,
  horizontalInfluence: 0.34,
  baseFov: 61,
  maximumFov: 72,
  speedForMaximumFov: 29,
  shakeEnabled: true,
  shakeDecay: 4.8,
  maximumShake: 0.34,
};

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly config: CameraControllerConfig;

  private readonly targetWorldPosition = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLookAt = new THREE.Vector3();
  private readonly smoothedLookAt = new THREE.Vector3();
  private shakeTrauma = 0;
  private shakeEnabled: boolean;
  private initialized = false;

  public constructor(
    camera: THREE.PerspectiveCamera,
    config: Partial<CameraControllerConfig> = {},
  ) {
    this.camera = camera;
    this.config = {
      ...DEFAULT_CAMERA_CONFIG,
      ...config,
      positionOffset: { ...DEFAULT_CAMERA_CONFIG.positionOffset, ...config.positionOffset },
      lookAtOffset: { ...DEFAULT_CAMERA_CONFIG.lookAtOffset, ...config.lookAtOffset },
    };
    this.shakeEnabled = this.config.shakeEnabled;
    this.camera.fov = this.config.baseFov;
    this.camera.updateProjectionMatrix();
  }

  public reset(target: THREE.Object3D): void {
    target.getWorldPosition(this.targetWorldPosition);
    this.calculateDesired(this.targetWorldPosition);
    this.camera.position.copy(this.desiredPosition);
    this.smoothedLookAt.copy(this.desiredLookAt);
    this.camera.lookAt(this.smoothedLookAt);
    this.shakeTrauma = 0;
    this.initialized = true;
  }

  public update(deltaSeconds: number, target: THREE.Object3D, speed: number): void {
    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    target.getWorldPosition(this.targetWorldPosition);
    this.calculateDesired(this.targetWorldPosition);
    if (!this.initialized) this.reset(target);

    const followAlpha = 1 - Math.exp(-this.config.followSharpness * dt);
    const lookAlpha = 1 - Math.exp(-this.config.lookSharpness * dt);
    this.camera.position.lerp(this.desiredPosition, followAlpha);
    this.smoothedLookAt.lerp(this.desiredLookAt, lookAlpha);

    if (this.shakeEnabled && this.shakeTrauma > 0.001) {
      const magnitude = this.config.maximumShake * this.shakeTrauma * this.shakeTrauma;
      this.camera.position.x += (Math.random() * 2 - 1) * magnitude;
      this.camera.position.y += (Math.random() * 2 - 1) * magnitude * 0.72;
      this.camera.position.z += (Math.random() * 2 - 1) * magnitude * 0.35;
      this.shakeTrauma = Math.max(0, this.shakeTrauma - this.config.shakeDecay * dt);
    }
    this.camera.lookAt(this.smoothedLookAt);

    const speedProgress = THREE.MathUtils.clamp(
      speed / Math.max(1, this.config.speedForMaximumFov),
      0,
      1,
    );
    const desiredFov = THREE.MathUtils.lerp(
      this.config.baseFov,
      this.config.maximumFov,
      speedProgress * speedProgress,
    );
    const nextFov = THREE.MathUtils.lerp(this.camera.fov, desiredFov, 1 - Math.exp(-dt * 3.4));
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  public impact(intensity = 0.75): void {
    if (!this.shakeEnabled) return;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + Math.max(0, intensity));
  }

  public setShakeEnabled(enabled: boolean): void {
    this.shakeEnabled = enabled;
    if (!enabled) this.shakeTrauma = 0;
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  private calculateDesired(targetPosition: THREE.Vector3): void {
    const positionOffset = this.config.positionOffset;
    const lookAtOffset = this.config.lookAtOffset;
    this.desiredPosition.set(
      targetPosition.x * this.config.horizontalInfluence + positionOffset.x,
      targetPosition.y + positionOffset.y,
      targetPosition.z + positionOffset.z,
    );
    this.desiredLookAt.set(
      targetPosition.x + lookAtOffset.x,
      targetPosition.y + lookAtOffset.y,
      targetPosition.z + lookAtOffset.z,
    );
  }
}
