import type { LaneIndex } from '../entities/Entity';
import type { ObstacleType } from '../entities/Obstacle';
import { PowerUpType } from '../entities/PowerUp';
import type { VehicleDirection } from '../entities/Vehicle';
import type { DifficultySnapshot } from './DifficultyManager';
import type { TrackTheme } from './TrackSegment';

export interface CoinPlacement {
  readonly lane: LaneIndex;
  readonly offsetZ: number;
  readonly height: number;
}

export interface ObstaclePlacement {
  readonly lane: LaneIndex;
  readonly offsetZ: number;
  readonly type: ObstacleType;
}

export interface VehiclePlacement {
  readonly lane: LaneIndex;
  readonly offsetZ: number;
  readonly direction: VehicleDirection;
  readonly speedScale: number;
}

export interface PowerUpPlacement {
  readonly lane: LaneIndex;
  readonly offsetZ: number;
  readonly type: PowerUpType;
}

export interface DecorationPlacement {
  readonly side: -1 | 1;
  readonly offsetZ: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly setback: number;
  readonly variant: number;
}

export interface GeneratedSegment {
  readonly index: number;
  readonly patternId: PatternId;
  readonly theme: TrackTheme;
  readonly coins: CoinPlacement[];
  readonly obstacles: ObstaclePlacement[];
  readonly vehicles: VehiclePlacement[];
  readonly powerUps: PowerUpPlacement[];
  readonly decorations: DecorationPlacement[];
}

export type PatternId =
  | 'coins-straight'
  | 'coins-arc'
  | 'coins-weave'
  | 'low-jump'
  | 'high-slide'
  | 'lane-blockers'
  | 'moving-vehicle'
  | 'alternating-obstacles'
  | 'mixed-actions';

interface PatternDefinition {
  readonly id: PatternId;
  readonly minimumComplexity: number;
  readonly build: (segment: GeneratedSegment, random: SeededRandom, spacing: number) => void;
}

const THEMES: readonly TrackTheme[] = ['violet', 'cyan', 'sunset'];
const POWER_TYPES = Object.values(PowerUpType);

function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  public next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }

  public integer(minimum: number, maximumInclusive: number): number {
    const min = Math.ceil(minimum);
    const max = Math.floor(maximumInclusive);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  public pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error('Cannot pick from an empty collection.');
    return values[Math.floor(this.next() * values.length)]!;
  }
}

function addCoinLine(
  segment: GeneratedSegment,
  lane: LaneIndex,
  start: number,
  count: number,
  step = 1.65,
  height = 1.05,
): void {
  for (let index = 0; index < count; index += 1) {
    segment.coins.push({ lane, offsetZ: start + index * step, height });
  }
}

const PATTERNS: readonly PatternDefinition[] = [
  {
    id: 'coins-straight',
    minimumComplexity: 0,
    build: (segment, random) => {
      addCoinLine(segment, random.pick([-1, 0, 1] as const), 3.2, 12, 1.7);
    },
  },
  {
    id: 'coins-arc',
    minimumComplexity: 0,
    build: (segment, random) => {
      const lane = random.pick([-1, 0, 1] as const);
      for (let index = 0; index < 11; index += 1) {
        const progress = index / 10;
        segment.coins.push({
          lane,
          offsetZ: 4 + index * 1.65,
          height: 0.9 + Math.sin(progress * Math.PI) * 2.05,
        });
      }
    },
  },
  {
    id: 'coins-weave',
    minimumComplexity: 1,
    build: (segment, random, spacing) => {
      const direction = random.next() < 0.5 ? -1 : 1;
      const lanes: readonly LaneIndex[] = direction === 1 ? [-1, 0, 1, 0] : [1, 0, -1, 0];
      const groupSpacing = Math.max(3.8, spacing * 0.82);
      lanes.forEach((lane, group) =>
        addCoinLine(segment, lane, 2.8 + group * groupSpacing, 3, 0.72),
      );
    },
  },
  {
    id: 'low-jump',
    minimumComplexity: 0,
    build: (segment, random) => {
      const lane = random.pick([-1, 0, 1] as const);
      addCoinLine(segment, lane, 4.2, 4, 1.05, 0.92);
      segment.obstacles.push({ lane, offsetZ: 9.1, type: 'low' });
      for (let index = 0; index < 5; index += 1) {
        const progress = index / 4;
        segment.coins.push({
          lane,
          offsetZ: 8.2 + index * 1.05,
          height: 1.15 + Math.sin(progress * Math.PI) * 1.65,
        });
      }
    },
  },
  {
    id: 'high-slide',
    minimumComplexity: 1,
    build: (segment, random) => {
      const lane = random.pick([-1, 0, 1] as const);
      addCoinLine(segment, lane, 3.2, 4, 1.15);
      segment.obstacles.push({ lane, offsetZ: 9, type: 'high' });
      addCoinLine(segment, lane, 10.2, 7, 1.5, 0.55);
    },
  },
  {
    id: 'lane-blockers',
    minimumComplexity: 1,
    build: (segment, random) => {
      const safeLane = random.pick([-1, 0, 1] as const);
      for (const lane of [-1, 0, 1] as const) {
        if (lane !== safeLane) segment.obstacles.push({ lane, offsetZ: 10, type: 'blocker' });
      }
      addCoinLine(segment, safeLane, 4, 11, 1.55);
    },
  },
  {
    id: 'moving-vehicle',
    minimumComplexity: 2,
    build: (segment, random) => {
      const lane = random.pick([-1, 0, 1] as const);
      segment.vehicles.push({ lane, offsetZ: 21, direction: -1, speedScale: 1 });
      const rewardLane = (lane === 0 ? (random.next() < 0.5 ? -1 : 1) : 0) as LaneIndex;
      addCoinLine(segment, rewardLane, 3.2, 11, 1.65);
    },
  },
  {
    id: 'alternating-obstacles',
    minimumComplexity: 2,
    build: (segment, random, spacing) => {
      const first = random.pick([-1, 1] as const);
      const gap = Math.max(5.2, spacing);
      const sequence: readonly LaneIndex[] = [first, 0, (first * -1) as LaneIndex, 0];
      sequence.forEach((lane, index) => {
        segment.obstacles.push({ lane, offsetZ: 4.6 + index * gap, type: 'blocker' });
      });
      const coinLane = (first * -1) as LaneIndex;
      addCoinLine(segment, coinLane, 4.2, 11, 1.7);
    },
  },
  {
    id: 'mixed-actions',
    minimumComplexity: 3,
    build: (segment, random, spacing) => {
      const lane = random.pick([-1, 0, 1] as const);
      const otherLane = (lane === 0 ? (random.next() < 0.5 ? -1 : 1) : 0) as LaneIndex;
      const gap = Math.max(7, spacing + 1.2);
      segment.obstacles.push({ lane, offsetZ: 5.2, type: 'low' });
      segment.obstacles.push({ lane: otherLane, offsetZ: 5.2 + gap, type: 'high' });
      segment.obstacles.push({ lane, offsetZ: 5.2 + gap * 2, type: 'blocker' });
      addCoinLine(segment, lane, 2.4, 5, 1.05);
      addCoinLine(segment, otherLane, 5.2 + gap, 6, 1.05, 0.55);
    },
  },
] as const;

export interface SegmentGeneratorConfig {
  seed: string | number;
  segmentLength: number;
  powerUpChance: number;
}

export const DEFAULT_SEGMENT_GENERATOR_CONFIG: Readonly<SegmentGeneratorConfig> = {
  seed: 'neon-dash-default',
  segmentLength: 28,
  powerUpChance: 0.075,
};

export class SegmentGenerator {
  public readonly config: SegmentGeneratorConfig;
  private baseSeed: number;

  public constructor(config: Partial<SegmentGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_SEGMENT_GENERATOR_CONFIG, ...config };
    this.baseSeed = hashSeed(this.config.seed);
  }

  public reset(seed: string | number = this.config.seed): void {
    this.config.seed = seed;
    this.baseSeed = hashSeed(seed);
  }

  public generate(index: number, difficulty: DifficultySnapshot): GeneratedSegment {
    const mixedSeed = (this.baseSeed ^ Math.imul(index + 0x7f4a7c15, 0x9e3779b1)) >>> 0;
    const random = new SeededRandom(mixedSeed);
    let available = PATTERNS.filter(
      (pattern) => pattern.minimumComplexity <= difficulty.patternComplexity,
    );
    if (random.next() > difficulty.obstacleDensity) {
      available = available.filter((pattern) => pattern.id.startsWith('coins-'));
    } else if (random.next() > difficulty.movingObstacleChance) {
      available = available.filter((pattern) => pattern.id !== 'moving-vehicle');
    }
    const pattern = index === 0 ? PATTERNS[0]! : random.pick(available);
    const themeIndex = Math.floor(Math.max(0, index) / 12) + random.integer(0, 1);
    const segment: GeneratedSegment = {
      index,
      patternId: pattern.id,
      theme: THEMES[themeIndex % THEMES.length]!,
      coins: [],
      obstacles: [],
      vehicles: [],
      powerUps: [],
      decorations: [],
    };

    pattern.build(segment, random, difficulty.reactionSpacing);
    if (random.next() < this.config.powerUpChance) {
      segment.powerUps.push({
        lane: random.pick([-1, 0, 1] as const),
        offsetZ: random.integer(7, Math.floor(this.config.segmentLength - 5)),
        type: random.pick(POWER_TYPES),
      });
    }
    this.addDecorations(segment, random);

    if (!isGeneratedSegmentTraversable(segment, difficulty.reactionSpacing)) {
      segment.obstacles.length = 0;
      segment.vehicles.length = 0;
      addCoinLine(segment, 0, 3, 11, 1.7);
    }
    return segment;
  }

  private addDecorations(segment: GeneratedSegment, random: SeededRandom): void {
    const count = random.integer(3, 6);
    for (let index = 0; index < count; index += 1) {
      segment.decorations.push({
        side: random.next() < 0.5 ? -1 : 1,
        offsetZ: random.next() * this.config.segmentLength,
        width: 1.8 + random.next() * 2.7,
        height: 2.5 + random.next() * 7,
        depth: 1.6 + random.next() * 3,
        setback: random.next() * 2.8,
        variant: random.integer(0, 8),
      });
    }
  }
}

interface BlockedSlice {
  z: number;
  blocked: Set<LaneIndex>;
}

export function isGeneratedSegmentTraversable(
  segment: Pick<GeneratedSegment, 'obstacles' | 'vehicles'>,
  reactionSpacing = 5,
): boolean {
  const slices: BlockedSlice[] = [];
  const addBlocked = (z: number, lane: LaneIndex): void => {
    let slice = slices.find((candidate) => Math.abs(candidate.z - z) < 0.75);
    if (slice === undefined) {
      slice = { z, blocked: new Set<LaneIndex>() };
      slices.push(slice);
    }
    slice.blocked.add(lane);
  };

  for (const obstacle of segment.obstacles) {
    if (obstacle.type === 'blocker') addBlocked(obstacle.offsetZ, obstacle.lane);
  }
  for (const vehicle of segment.vehicles) addBlocked(vehicle.offsetZ, vehicle.lane);
  slices.sort((a, b) => a.z - b.z);

  let reachable = new Set<LaneIndex>([-1, 0, 1]);
  let previousZ = 0;
  for (const slice of slices) {
    const steps = Math.max(1, Math.floor((slice.z - previousZ) / Math.max(1, reactionSpacing)));
    const nextReachable = new Set<LaneIndex>();
    for (const candidate of [-1, 0, 1] as const) {
      if (slice.blocked.has(candidate)) continue;
      for (const prior of reachable) {
        if (Math.abs(candidate - prior) <= steps) {
          nextReachable.add(candidate);
          break;
        }
      }
    }
    if (nextReachable.size === 0) return false;
    reachable = nextReachable;
    previousZ = slice.z;
  }
  return reachable.size > 0;
}

export const TRACK_PATTERN_IDS: readonly PatternId[] = PATTERNS.map((pattern) => pattern.id);
