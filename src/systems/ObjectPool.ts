export interface ObjectPoolOptions<T> {
  readonly initialSize?: number;
  readonly maxSize?: number;
  readonly onAcquire?: (object: T) => void;
  readonly onRelease?: (object: T) => void;
  readonly onDispose?: (object: T) => void;
}

export interface ObjectPoolStats {
  readonly total: number;
  readonly active: number;
  readonly available: number;
  readonly peakActive: number;
}

/** Generic expanding pool that guards against double release and foreign objects. */
export class ObjectPool<T> {
  private readonly availableObjects: T[] = [];
  private readonly activeObjects = new Set<T>();
  private readonly allObjects = new Set<T>();
  private readonly maxSize: number;
  private peak = 0;
  private disposed = false;

  public constructor(
    private readonly factory: () => T,
    private readonly options: ObjectPoolOptions<T> = {},
  ) {
    const initialSize = options.initialSize ?? 0;
    this.maxSize = options.maxSize ?? Number.POSITIVE_INFINITY;
    if (!Number.isInteger(initialSize) || initialSize < 0) {
      throw new RangeError('initialSize must be a non-negative integer');
    }
    if (
      !(this.maxSize === Number.POSITIVE_INFINITY) &&
      (!Number.isInteger(this.maxSize) || this.maxSize < 0)
    ) {
      throw new RangeError('maxSize must be a non-negative integer or Infinity');
    }
    if (initialSize > this.maxSize) {
      throw new RangeError('initialSize cannot exceed maxSize');
    }
    this.expand(initialSize);
  }

  public acquire(): T | null {
    this.assertUsable();
    let object = this.availableObjects.pop();
    if (object === undefined) {
      if (this.allObjects.size >= this.maxSize) {
        return null;
      }
      object = this.createObject();
    }
    this.activeObjects.add(object);
    this.peak = Math.max(this.peak, this.activeObjects.size);
    this.options.onAcquire?.(object);
    return object;
  }

  public release(object: T): boolean {
    this.assertUsable();
    if (!this.activeObjects.delete(object)) {
      return false;
    }
    this.options.onRelease?.(object);
    this.availableObjects.push(object);
    return true;
  }

  public releaseAll(): void {
    this.assertUsable();
    for (const object of [...this.activeObjects]) {
      this.release(object);
    }
  }

  public prewarm(count: number): number {
    this.assertUsable();
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('count must be a non-negative integer');
    }
    const room = Math.max(0, this.maxSize - this.allObjects.size);
    const amount = Math.min(count, room);
    this.expand(amount);
    return amount;
  }

  public isActive(object: T): boolean {
    return this.activeObjects.has(object);
  }

  public owns(object: T): boolean {
    return this.allObjects.has(object);
  }

  public get stats(): ObjectPoolStats {
    return {
      total: this.allObjects.size,
      active: this.activeObjects.size,
      available: this.availableObjects.length,
      peakActive: this.peak,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    for (const object of this.allObjects) {
      this.options.onDispose?.(object);
    }
    this.activeObjects.clear();
    this.availableObjects.length = 0;
    this.allObjects.clear();
    this.disposed = true;
  }

  private expand(count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.availableObjects.push(this.createObject());
    }
  }

  private createObject(): T {
    const object = this.factory();
    this.allObjects.add(object);
    return object;
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('ObjectPool has been disposed');
    }
  }
}
