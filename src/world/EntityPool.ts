export interface Recyclable {
  active: boolean;
  reset(): void;
}

export class EntityPool<T extends Recyclable> {
  private readonly objects: T[] = [];
  private readonly available: T[] = [];
  private readonly factory: () => T;
  private readonly onCreate?: (item: T) => void;

  public constructor(factory: () => T, initialSize = 0, onCreate?: (item: T) => void) {
    this.factory = factory;
    this.onCreate = onCreate;
    this.prewarm(initialSize);
  }

  public get items(): readonly T[] {
    return this.objects;
  }

  public get size(): number {
    return this.objects.length;
  }

  public get activeCount(): number {
    return this.objects.length - this.available.length;
  }

  public acquire(): T {
    const item = this.available.pop() ?? this.create();
    return item;
  }

  public release(item: T): void {
    if (!this.objects.includes(item) || !item.active) return;
    item.reset();
    this.available.push(item);
  }

  public releaseAll(): void {
    this.available.length = 0;
    for (const item of this.objects) {
      item.reset();
      this.available.push(item);
    }
  }

  public forEachActive(callback: (item: T) => void): void {
    for (const item of this.objects) {
      if (item.active) callback(item);
    }
  }

  public prewarm(count: number): void {
    const target = Math.max(0, Math.floor(count));
    while (this.objects.length < target) {
      const item = this.create();
      item.reset();
      this.available.push(item);
    }
  }

  private create(): T {
    const item = this.factory();
    this.objects.push(item);
    this.onCreate?.(item);
    return item;
  }
}
