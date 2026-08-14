import * as THREE from 'three';
import { Coin } from '../entities/Coin';
import { Decoration } from '../entities/Decoration';
import type { BaseEntity } from '../entities/Entity';
import { Obstacle } from '../entities/Obstacle';
import { PowerUp, type PowerUpType } from '../entities/PowerUp';
import { Vehicle } from '../entities/Vehicle';
import { CollisionOutcome, Player } from '../player/Player';
import type { DifficultySnapshot } from './DifficultyManager';
import { createDifficultySnapshot } from './DifficultyManager';
import { EntityPool } from './EntityPool';
import {
  SegmentGenerator,
  type GeneratedSegment,
  type SegmentGeneratorConfig,
} from './SegmentGenerator';
import {
  DEFAULT_TRACK_SEGMENT_CONFIG,
  TrackSegment,
  type TrackSegmentConfig,
} from './TrackSegment';

export interface SegmentRuntime {
  segment: TrackSegment;
  coins: Coin[];
  obstacles: Obstacle[];
  vehicles: Vehicle[];
  powerUps: PowerUp[];
  decorations: Decoration[];
}

export interface TrackManagerConfig extends TrackSegmentConfig {
  segmentsAhead: number;
  segmentsBehind: number;
  seed: string | number;
  initialCoinPool: number;
  initialObstaclePool: number;
  initialVehiclePool: number;
  initialPowerUpPool: number;
  initialDecorationPool: number;
}

export const DEFAULT_TRACK_MANAGER_CONFIG: Readonly<TrackManagerConfig> = {
  ...DEFAULT_TRACK_SEGMENT_CONFIG,
  segmentsAhead: 8,
  segmentsBehind: 2,
  seed: 'neon-dash-default',
  initialCoinPool: 90,
  initialObstaclePool: 24,
  initialVehiclePool: 6,
  initialPowerUpPool: 5,
  initialDecorationPool: 45,
};

export interface TrackCollisionResult {
  coinsCollected: number;
  powerUpsCollected: PowerUpType[];
  jumpedObstacles: number;
  slidObstacles: number;
  hazard: Obstacle | Vehicle | null;
  hazardOutcome: CollisionOutcome | null;
  readonly lastCoinPosition: THREE.Vector3;
  readonly lastPowerUpPosition: THREE.Vector3;
  readonly hazardPosition: THREE.Vector3;
}

export function createTrackCollisionResult(): TrackCollisionResult {
  return {
    coinsCollected: 0,
    powerUpsCollected: [],
    jumpedObstacles: 0,
    slidObstacles: 0,
    hazard: null,
    hazardOutcome: null,
    lastCoinPosition: new THREE.Vector3(),
    lastPowerUpPosition: new THREE.Vector3(),
    hazardPosition: new THREE.Vector3(),
  };
}

export class TrackManager extends THREE.Group {
  public readonly config: TrackManagerConfig;
  public readonly generator: SegmentGenerator;

  private readonly segments: SegmentRuntime[] = [];
  private readonly segmentPool: EntityPool<TrackSegment>;
  private readonly coinPool: EntityPool<Coin>;
  private readonly obstaclePool: EntityPool<Obstacle>;
  private readonly vehiclePool: EntityPool<Vehicle>;
  private readonly powerUpPool: EntityPool<PowerUp>;
  private readonly decorationPool: EntityPool<Decoration>;
  private readonly sphereScratch = new THREE.Sphere();
  private readonly boxScratch = new THREE.Box3();
  private readonly collisionResult = createTrackCollisionResult();
  private readonly defaultDifficulty = createDifficultySnapshot();
  private currentDifficulty: DifficultySnapshot;
  private disposed = false;

  public constructor(config: Partial<TrackManagerConfig> = {}) {
    super();
    this.name = 'track-manager';
    this.config = { ...DEFAULT_TRACK_MANAGER_CONFIG, ...config };
    const segmentConfig: Partial<TrackSegmentConfig> = {
      length: this.config.length,
      width: this.config.width,
      laneSpacing: this.config.laneSpacing,
      markerSpacing: this.config.markerSpacing,
    };
    const generatorConfig: Partial<SegmentGeneratorConfig> = {
      seed: this.config.seed,
      segmentLength: this.config.length,
    };
    this.generator = new SegmentGenerator(generatorConfig);
    this.currentDifficulty = this.defaultDifficulty;

    const addToTrack = (entity: BaseEntity): void => {
      this.add(entity);
    };
    this.coinPool = new EntityPool(() => new Coin(), this.config.initialCoinPool, addToTrack);
    this.obstaclePool = new EntityPool(
      () => new Obstacle(),
      this.config.initialObstaclePool,
      addToTrack,
    );
    this.vehiclePool = new EntityPool(
      () => new Vehicle(),
      this.config.initialVehiclePool,
      addToTrack,
    );
    this.powerUpPool = new EntityPool(
      () => new PowerUp(),
      this.config.initialPowerUpPool,
      addToTrack,
    );
    this.decorationPool = new EntityPool(
      () => new Decoration(),
      this.config.initialDecorationPool,
      addToTrack,
    );
    this.segmentPool = new EntityPool(
      () => new TrackSegment(segmentConfig),
      this.config.segmentsAhead + this.config.segmentsBehind + 2,
      (segment) => this.add(segment),
    );
  }

  public get activeSegments(): readonly SegmentRuntime[] {
    return this.segments;
  }

  public get coins(): readonly Coin[] {
    return this.coinPool.items;
  }

  public get obstacles(): readonly Obstacle[] {
    return this.obstaclePool.items;
  }

  public get vehicles(): readonly Vehicle[] {
    return this.vehiclePool.items;
  }

  public get powerUps(): readonly PowerUp[] {
    return this.powerUpPool.items;
  }

  public get decorations(): readonly Decoration[] {
    return this.decorationPool.items;
  }

  public reset(
    seed: string | number = this.config.seed,
    playerZ = 0,
    difficulty: DifficultySnapshot = this.defaultDifficulty,
  ): void {
    if (this.disposed) return;
    for (let index = this.segments.length - 1; index >= 0; index -= 1) {
      this.releaseSegment(this.segments[index]!);
    }
    this.segments.length = 0;
    this.generator.reset(seed);
    this.currentDifficulty = difficulty;
    this.ensureSegments(playerZ, difficulty);
  }

  public update(
    deltaSeconds: number,
    playerZ: number,
    difficulty: DifficultySnapshot = this.currentDifficulty,
    magnetTarget?: THREE.Vector3,
    magnetRadius = 0,
  ): void {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    this.currentDifficulty = difficulty;
    this.ensureSegments(playerZ, difficulty);

    for (const coin of this.coinPool.items) {
      if (!coin.active) continue;
      coin.update(dt);
      if (magnetTarget !== undefined && Math.abs(coin.position.z - playerZ) < magnetRadius + 2) {
        coin.attractTo(magnetTarget, dt, magnetRadius);
      }
    }
    for (const obstacle of this.obstaclePool.items) obstacle.update(dt);
    for (const vehicle of this.vehiclePool.items) vehicle.update(dt);
    for (const powerUp of this.powerUpPool.items) powerUp.update(dt);
    for (const decoration of this.decorationPool.items) decoration.update(dt);
  }

  /**
   * Applies pickup and hazard effects to the player and recycles collected pickups.
   * The returned object is reused; consume it before the next call.
   */
  public checkCollisions(
    player: Player,
    out: TrackCollisionResult = this.collisionResult,
  ): TrackCollisionResult {
    out.coinsCollected = 0;
    out.powerUpsCollected.length = 0;
    out.jumpedObstacles = 0;
    out.slidObstacles = 0;
    out.hazard = null;
    out.hazardOutcome = null;
    const playerBounds = player.getCollider();

    for (const coin of this.coinPool.items) {
      if (!coin.active || Math.abs(coin.position.z - player.position.z) > 2) continue;
      coin.getBoundingSphere(this.sphereScratch);
      if (!playerBounds.intersectsSphere(this.sphereScratch)) continue;
      out.lastCoinPosition.copy(coin.position);
      out.coinsCollected += 1;
      this.recycle(coin);
    }

    for (const powerUp of this.powerUpPool.items) {
      if (!powerUp.active || Math.abs(powerUp.position.z - player.position.z) > 2) continue;
      powerUp.getBoundingSphere(this.sphereScratch);
      if (!playerBounds.intersectsSphere(this.sphereScratch)) continue;
      out.lastPowerUpPosition.copy(powerUp.position);
      out.powerUpsCollected.push(powerUp.powerType);
      player.activatePowerUp(powerUp.powerType);
      this.recycle(powerUp);
    }

    for (const obstacle of this.obstaclePool.items) {
      if (!obstacle.active || Math.abs(obstacle.position.z - player.position.z) > 2) continue;
      obstacle.getBounds(this.boxScratch);
      if (!playerBounds.intersectsBox(this.boxScratch)) continue;
      out.hazard = obstacle;
      out.hazardPosition.copy(obstacle.position);
      out.hazardOutcome = player.handleHazardCollision();
      return out;
    }
    for (const vehicle of this.vehiclePool.items) {
      if (!vehicle.active || Math.abs(vehicle.position.z - player.position.z) > 3) continue;
      vehicle.getBounds(this.boxScratch);
      if (!playerBounds.intersectsBox(this.boxScratch)) continue;
      out.hazard = vehicle;
      out.hazardPosition.copy(vehicle.position);
      out.hazardOutcome = player.handleHazardCollision();
      return out;
    }
    for (const obstacle of this.obstaclePool.items) {
      if (
        !obstacle.active ||
        obstacle.countedAsPassed ||
        obstacle.position.z >= player.position.z - 0.5
      ) {
        continue;
      }
      obstacle.countedAsPassed = true;
      const crossedSameLane = Math.abs(obstacle.position.x - player.position.x) < 1.15;
      if (!crossedSameLane) continue;
      if (obstacle.requiredMove === 'jump' && player.position.y > 0.5) {
        out.jumpedObstacles += 1;
      } else if (obstacle.requiredMove === 'slide' && player.sliding) {
        out.slidObstacles += 1;
      }
    }
    return out;
  }

  public recycle(entity: Coin | Obstacle | Vehicle | PowerUp | Decoration): void {
    this.detachEntityFromRuntime(entity);
    if (entity instanceof Coin) this.coinPool.release(entity);
    else if (entity instanceof Obstacle) this.obstaclePool.release(entity);
    else if (entity instanceof Vehicle) this.vehiclePool.release(entity);
    else if (entity instanceof PowerUp) this.powerUpPool.release(entity);
    else this.decorationPool.release(entity);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.segments.length = 0;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.clear();
    this.removeFromParent();
  }

  private ensureSegments(playerZ: number, difficulty: DifficultySnapshot): void {
    const centreIndex = Math.floor(playerZ / this.config.length);
    const minimum = centreIndex - this.config.segmentsBehind;
    const maximum = centreIndex + this.config.segmentsAhead;

    for (let index = this.segments.length - 1; index >= 0; index -= 1) {
      const runtime = this.segments[index]!;
      if (runtime.segment.index >= minimum && runtime.segment.index <= maximum) continue;
      this.releaseSegment(runtime);
      this.segments.splice(index, 1);
    }

    for (let index = minimum; index <= maximum; index += 1) {
      if (this.segments.some((runtime) => runtime.segment.index === index)) continue;
      this.segments.push(this.spawnSegment(this.generator.generate(index, difficulty), difficulty));
    }
    this.segments.sort((a, b) => a.segment.index - b.segment.index);
  }

  private spawnSegment(
    generated: GeneratedSegment,
    difficulty: DifficultySnapshot,
  ): SegmentRuntime {
    const segment = this.segmentPool.acquire();
    segment.spawn(generated.index, generated.theme);
    const runtime: SegmentRuntime = {
      segment,
      coins: [],
      obstacles: [],
      vehicles: [],
      powerUps: [],
      decorations: [],
    };
    const baseZ = generated.index * this.config.length;

    for (const placement of generated.coins) {
      const coin = this.coinPool.acquire();
      coin.spawn({
        lane: placement.lane,
        x: placement.lane * this.config.laneSpacing,
        y: placement.height,
        z: baseZ + placement.offsetZ,
      });
      runtime.coins.push(coin);
    }
    for (const placement of generated.obstacles) {
      const obstacle = this.obstaclePool.acquire();
      obstacle.spawn(
        {
          lane: placement.lane,
          x: placement.lane * this.config.laneSpacing,
          y: 0,
          z: baseZ + placement.offsetZ,
        },
        placement.type,
      );
      runtime.obstacles.push(obstacle);
    }
    for (const placement of generated.vehicles) {
      const vehicle = this.vehiclePool.acquire();
      vehicle.spawn(
        {
          lane: placement.lane,
          x: placement.lane * this.config.laneSpacing,
          y: 0,
          z: baseZ + placement.offsetZ,
        },
        difficulty.vehicleSpeed * placement.speedScale,
        placement.direction,
        generated.index,
      );
      runtime.vehicles.push(vehicle);
    }
    for (const placement of generated.powerUps) {
      const powerUp = this.powerUpPool.acquire();
      powerUp.spawn(
        {
          lane: placement.lane,
          x: placement.lane * this.config.laneSpacing,
          y: 1.15,
          z: baseZ + placement.offsetZ,
        },
        placement.type,
      );
      runtime.powerUps.push(powerUp);
    }
    for (const placement of generated.decorations) {
      const decoration = this.decorationPool.acquire();
      const x =
        placement.side *
        (this.config.width * 0.5 + 1.3 + placement.setback + placement.width * 0.5);
      decoration.spawn(
        {
          lane: 0,
          x,
          y: 0,
          z: baseZ + placement.offsetZ,
        },
        placement.width,
        placement.height,
        placement.depth,
        placement.variant,
      );
      if (placement.side === 1) decoration.rotation.y = Math.PI;
      runtime.decorations.push(decoration);
    }
    return runtime;
  }

  private releaseSegment(runtime: SegmentRuntime): void {
    runtime.coins.forEach((coin) => this.coinPool.release(coin));
    runtime.obstacles.forEach((obstacle) => this.obstaclePool.release(obstacle));
    runtime.vehicles.forEach((vehicle) => this.vehiclePool.release(vehicle));
    runtime.powerUps.forEach((powerUp) => this.powerUpPool.release(powerUp));
    runtime.decorations.forEach((decoration) => this.decorationPool.release(decoration));
    this.segmentPool.release(runtime.segment);
  }

  private detachEntityFromRuntime(entity: Coin | Obstacle | Vehicle | PowerUp | Decoration): void {
    for (const runtime of this.segments) {
      const collection =
        entity instanceof Coin
          ? runtime.coins
          : entity instanceof Obstacle
            ? runtime.obstacles
            : entity instanceof Vehicle
              ? runtime.vehicles
              : entity instanceof PowerUp
                ? runtime.powerUps
                : runtime.decorations;
      const index = (collection as Array<typeof entity>).indexOf(entity);
      if (index >= 0) {
        collection.splice(index, 1);
        return;
      }
    }
  }
}
