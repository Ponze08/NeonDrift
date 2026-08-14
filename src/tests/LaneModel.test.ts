import { describe, expect, it } from 'vitest';
import { LaneModel, clampLane, laneToX } from '../systems/LaneModel';

describe('LaneModel', () => {
  it('enforces the three legal lanes', () => {
    const lanes = new LaneModel({ laneSpacing: 3, switchSpeed: 12 });

    expect(lanes.moveLeft()).toBe(true);
    expect(lanes.moveLeft()).toBe(false);
    lanes.update(1);
    expect(lanes.lane).toBe(-1);
    expect(lanes.x).toBe(-3);

    expect(lanes.moveRight()).toBe(true);
    expect(lanes.moveRight()).toBe(true);
    expect(lanes.moveRight()).toBe(false);
    lanes.update(1);
    expect(lanes.lane).toBe(1);
    expect(lanes.x).toBe(3);
  });

  it('moves smoothly and can reverse before a lane switch completes', () => {
    const lanes = new LaneModel({ laneSpacing: 4, switchSpeed: 2 });
    lanes.moveRight();

    expect(lanes.update(0.5)).toBe(1);
    expect(lanes.isSwitching).toBe(true);
    expect(lanes.lane).toBe(0);

    lanes.moveLeft();
    expect(lanes.targetLane).toBe(0);
    expect(lanes.update(0.5)).toBe(0);
    expect(lanes.isSwitching).toBe(false);
    expect(lanes.lane).toBe(0);
  });

  it('provides stable lane helpers and ignores invalid time deltas', () => {
    const lanes = new LaneModel({ laneSpacing: 2.5, switchSpeed: 10, initialLane: -1 });
    expect(clampLane(-99)).toBe(-1);
    expect(clampLane(0.2)).toBe(0);
    expect(clampLane(9)).toBe(1);
    expect(laneToX(1, 2.5)).toBe(2.5);
    expect(lanes.update(Number.NaN)).toBe(-2.5);
    expect(lanes.update(-1)).toBe(-2.5);
  });
});
