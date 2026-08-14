import { describe, expect, it, vi } from 'vitest';
import { ObjectPool } from '../systems/ObjectPool';

interface PooledItem {
  readonly id: number;
  active: boolean;
}

describe('ObjectPool', () => {
  it('prewarms, expands, reuses, and respects maximum capacity', () => {
    let nextId = 0;
    const reset = vi.fn((item: PooledItem) => {
      item.active = false;
    });
    const pool = new ObjectPool<PooledItem>(() => ({ id: nextId++, active: false }), {
      initialSize: 1,
      maxSize: 2,
      onAcquire: (item) => {
        item.active = true;
      },
      onRelease: reset,
    });

    const first = pool.acquire();
    const second = pool.acquire();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(pool.acquire()).toBeNull();
    expect(pool.stats).toEqual({ total: 2, active: 2, available: 0, peakActive: 2 });

    expect(pool.release(first!)).toBe(true);
    expect(pool.release(first!)).toBe(false);
    expect(pool.acquire()).toBe(first);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('rejects foreign releases and disposes every owned item exactly once', () => {
    let nextId = 0;
    const dispose = vi.fn();
    const pool = new ObjectPool<PooledItem>(() => ({ id: nextId++, active: false }), {
      initialSize: 2,
      onDispose: dispose,
    });
    expect(pool.release({ id: 99, active: false })).toBe(false);
    pool.acquire();
    pool.dispose();

    expect(dispose).toHaveBeenCalledTimes(2);
    expect(() => pool.acquire()).toThrow(/disposed/i);
  });
});
