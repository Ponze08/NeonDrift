import * as THREE from 'three';

export interface ParticleBurstOptions {
  count: number;
  colour: number;
  speed: number;
  spread: number;
  upwardBias: number;
  lifetime: number;
  gravity: number;
  drag: number;
  startSize: number;
  endSize: number;
  stretch: number;
}

export interface ParticleManagerConfig {
  initialCapacity: number;
  batchSize: number;
  maximumParticles: number;
  enabled: boolean;
}

export const DEFAULT_PARTICLE_MANAGER_CONFIG: Readonly<ParticleManagerConfig> = {
  initialCapacity: 64,
  batchSize: 64,
  maximumParticles: 256,
  enabled: true,
};

const DEFAULT_BURST: Readonly<ParticleBurstOptions> = {
  count: 8,
  colour: 0xffffff,
  speed: 3,
  spread: 1,
  upwardBias: 1.5,
  lifetime: 0.55,
  gravity: 5,
  drag: 1.5,
  startSize: 0.12,
  endSize: 0.01,
  stretch: 1,
};

interface ParticleState {
  active: boolean;
  age: number;
  lifetime: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  drag: number;
  startSize: number;
  endSize: number;
  stretch: number;
}

interface ParticleSlot {
  readonly state: ParticleState;
  readonly batch: ParticleBatch;
  readonly index: number;
}

interface ParticleBatch {
  readonly mesh: THREE.InstancedMesh;
  readonly slots: ParticleSlot[];
}

function makeState(): ParticleState {
  return {
    active: false,
    age: 0,
    lifetime: 0,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    gravity: 0,
    drag: 0,
    startSize: 0,
    endSize: 0,
    stretch: 1,
  };
}

export class ParticleManager extends THREE.Group {
  public readonly config: ParticleManagerConfig;

  private readonly geometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  private readonly batches: ParticleBatch[] = [];
  private readonly slots: ParticleSlot[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly colourScratch = new THREE.Color();
  private enabled: boolean;
  private disposed = false;

  public constructor(scene?: THREE.Scene, config: Partial<ParticleManagerConfig> = {}) {
    super();
    this.name = 'particle-manager';
    this.config = { ...DEFAULT_PARTICLE_MANAGER_CONFIG, ...config };
    this.enabled = this.config.enabled;
    const initial = Math.min(
      this.config.maximumParticles,
      Math.max(1, this.config.initialCapacity),
    );
    this.addBatch(initial);
    scene?.add(this);
  }

  public get activeCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.state.active) count += 1;
    return count;
  }

  public emitBurst(position: THREE.Vector3, options: Partial<ParticleBurstOptions> = {}): void {
    if (!this.enabled || this.disposed) return;
    const settings: ParticleBurstOptions = { ...DEFAULT_BURST, ...options };
    for (let index = 0; index < Math.max(0, Math.floor(settings.count)); index += 1) {
      const slot = this.acquireSlot();
      if (slot === undefined) return;
      const state = slot.state;
      const angle = Math.random() * Math.PI * 2;
      const radial = Math.random() * settings.spread;
      const speed = settings.speed * (0.55 + Math.random() * 0.65);
      state.active = true;
      state.age = 0;
      state.lifetime = Math.max(0.05, settings.lifetime * (0.78 + Math.random() * 0.42));
      state.x = position.x;
      state.y = position.y;
      state.z = position.z;
      state.vx = Math.cos(angle) * radial * speed;
      state.vy = (settings.upwardBias + (Math.random() * 2 - 1) * settings.spread) * speed;
      state.vz = Math.sin(angle) * radial * speed;
      state.gravity = settings.gravity;
      state.drag = settings.drag;
      state.startSize = settings.startSize * (0.7 + Math.random() * 0.6);
      state.endSize = settings.endSize;
      state.stretch = settings.stretch;
      this.colourScratch.setHex(settings.colour);
      slot.batch.mesh.setColorAt(slot.index, this.colourScratch);
      if (slot.batch.mesh.instanceColor !== null) slot.batch.mesh.instanceColor.needsUpdate = true;
    }
  }

  public emitCoinBurst(position: THREE.Vector3): void {
    this.emitBurst(position, {
      count: 9,
      colour: 0xffd447,
      speed: 2.6,
      spread: 0.75,
      upwardBias: 1.15,
      lifetime: 0.48,
      gravity: 4.5,
      startSize: 0.105,
    });
  }

  public emitImpact(position: THREE.Vector3, protectedHit = false): void {
    this.emitBurst(position, {
      count: protectedHit ? 24 : 18,
      colour: protectedHit ? 0x54ebff : 0xff5b6e,
      speed: 4.8,
      spread: 1,
      upwardBias: 0.7,
      lifetime: 0.72,
      gravity: 2.5,
      startSize: 0.15,
      endSize: 0.025,
    });
  }

  public emitPowerUp(position: THREE.Vector3, colour: number): void {
    this.emitBurst(position, {
      count: 20,
      colour,
      speed: 3.2,
      spread: 0.85,
      upwardBias: 0.9,
      lifetime: 0.9,
      gravity: -0.4,
      drag: 2.4,
      startSize: 0.14,
      endSize: 0.03,
    });
  }

  public emitSpeedLine(position: THREE.Vector3, colour = 0x8beeff): void {
    this.emitBurst(position, {
      count: 1,
      colour,
      speed: 0.25,
      spread: 0.25,
      upwardBias: 0,
      lifetime: 0.32,
      gravity: 0,
      drag: 0,
      startSize: 0.055,
      endSize: 0.01,
      stretch: 16,
    });
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    for (const batch of this.batches) {
      let changed = false;
      for (const slot of batch.slots) {
        const state = slot.state;
        if (!state.active) continue;
        state.age += dt;
        if (state.age >= state.lifetime) {
          state.active = false;
          this.dummy.position.set(0, -10000, 0);
          this.dummy.scale.setScalar(0);
          this.dummy.updateMatrix();
          batch.mesh.setMatrixAt(slot.index, this.dummy.matrix);
          changed = true;
          continue;
        }
        const drag = Math.exp(-state.drag * dt);
        state.vx *= drag;
        state.vy = state.vy * drag - state.gravity * dt;
        state.vz *= drag;
        state.x += state.vx * dt;
        state.y += state.vy * dt;
        state.z += state.vz * dt;
        const progress = state.age / state.lifetime;
        const size = THREE.MathUtils.lerp(state.startSize, state.endSize, progress);
        this.dummy.position.set(state.x, state.y, state.z);
        this.dummy.scale.set(size, size, size * state.stretch);
        this.dummy.rotation.set(state.age * 4, state.age * 2.7, 0);
        this.dummy.updateMatrix();
        batch.mesh.setMatrixAt(slot.index, this.dummy.matrix);
        changed = true;
      }
      if (changed) batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.visible = enabled;
    if (!enabled) this.clearParticles();
  }

  public clearParticles(): void {
    for (const batch of this.batches) {
      for (const slot of batch.slots) {
        slot.state.active = false;
        this.dummy.position.set(0, -10000, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        batch.mesh.setMatrixAt(slot.index, this.dummy.matrix);
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearParticles();
    this.geometry.dispose();
    this.material.dispose();
    this.clear();
    this.removeFromParent();
    this.batches.length = 0;
    this.slots.length = 0;
  }

  private acquireSlot(): ParticleSlot | undefined {
    for (const slot of this.slots) if (!slot.state.active) return slot;
    if (this.slots.length < this.config.maximumParticles) {
      const remaining = this.config.maximumParticles - this.slots.length;
      this.addBatch(Math.min(this.config.batchSize, remaining));
      return this.slots[this.slots.length - 1];
    }
    let oldest: ParticleSlot | undefined;
    let oldestProgress = -1;
    for (const slot of this.slots) {
      const progress = slot.state.age / Math.max(0.001, slot.state.lifetime);
      if (progress > oldestProgress) {
        oldestProgress = progress;
        oldest = slot;
      }
    }
    return oldest;
  }

  private addBatch(capacity: number): void {
    if (capacity <= 0) return;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    mesh.name = `particle-batch-${this.batches.length}`;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const batch: ParticleBatch = { mesh, slots: [] };
    this.batches.push(batch);
    this.add(mesh);
    for (let index = 0; index < capacity; index += 1) {
      const slot: ParticleSlot = { state: makeState(), batch, index };
      batch.slots.push(slot);
      this.slots.push(slot);
      this.dummy.position.set(0, -10000, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
