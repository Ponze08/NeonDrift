import { LANES, type Lane } from '../systems/LaneModel';

export type PatternEntityKind =
  'coin' | 'power-up' | 'jump-barrier' | 'overhead-gate' | 'lane-blocker' | 'vehicle';

export type TraversalAction = 'none' | 'jump' | 'slide';

export interface PatternEntity {
  readonly kind: PatternEntityKind;
  readonly lane: Lane;
  /** Integer longitudinal slot within the segment. */
  readonly row: number;
  readonly height?: number;
  readonly moving?: boolean;
}

export interface ObstaclePattern {
  readonly id: string;
  readonly name: string;
  readonly length: number;
  readonly complexity: 1 | 2 | 3 | 4 | 5;
  /** Normalized difficulty at which this layout may appear. */
  readonly minimumDifficulty: number;
  readonly weight: number;
  readonly entities: readonly PatternEntity[];
}

export interface PatternValidationOptions {
  readonly startingLanes?: readonly Lane[];
  readonly maxLaneDeltaPerRow?: number;
  /** Number of clear rows required between jump/slide actions. */
  readonly minimumActionGapRows?: number;
}

export interface PatternValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly reachableLanesByRow: readonly ReadonlySet<Lane>[];
  readonly endingLanes: ReadonlySet<Lane>;
}

interface RouteState {
  readonly lane: Lane;
  readonly lastActionRow: number;
}

const IMPASSABLE_KINDS: ReadonlySet<PatternEntityKind> = new Set(['lane-blocker', 'vehicle']);

function requiredAction(entities: readonly PatternEntity[]): TraversalAction | 'impossible' {
  if (entities.some((entity) => IMPASSABLE_KINDS.has(entity.kind))) {
    return 'impossible';
  }
  const needsJump = entities.some((entity) => entity.kind === 'jump-barrier');
  const needsSlide = entities.some((entity) => entity.kind === 'overhead-gate');
  if (needsJump && needsSlide) return 'impossible';
  if (needsJump) return 'jump';
  if (needsSlide) return 'slide';
  return 'none';
}

function stateKey(state: RouteState): string {
  return `${state.lane}:${state.lastActionRow}`;
}

/**
 * Validates structure and performs a small reachability search through the layout.
 * It models one-lane movement per row and a recovery gap between jump/slide actions.
 */
export function validateObstaclePattern(
  pattern: ObstaclePattern,
  options: PatternValidationOptions = {},
): PatternValidationResult {
  const errors: string[] = [];
  const reachableLanesByRow: ReadonlySet<Lane>[] = [];
  const maxLaneDelta = options.maxLaneDeltaPerRow ?? 1;
  const minimumActionGap = options.minimumActionGapRows ?? 1;
  const startingLanes = [...new Set(options.startingLanes ?? LANES)];

  if (!pattern.id.trim()) errors.push('Pattern id cannot be empty');
  if (!Number.isInteger(pattern.length) || pattern.length <= 0) {
    errors.push('Pattern length must be a positive integer');
  }
  if (
    !Number.isFinite(pattern.minimumDifficulty) ||
    pattern.minimumDifficulty < 0 ||
    pattern.minimumDifficulty > 1
  ) {
    errors.push('minimumDifficulty must be between zero and one');
  }
  if (!Number.isInteger(maxLaneDelta) || maxLaneDelta < 0 || maxLaneDelta > 2) {
    errors.push('maxLaneDeltaPerRow must be an integer from zero to two');
  }
  if (!Number.isInteger(minimumActionGap) || minimumActionGap < 0) {
    errors.push('minimumActionGapRows must be a non-negative integer');
  }
  if (startingLanes.length === 0 || startingLanes.some((lane) => !LANES.includes(lane))) {
    errors.push('At least one valid starting lane is required');
  }

  const cellKinds = new Map<string, Set<PatternEntityKind>>();
  const entitiesByRowAndLane = new Map<string, PatternEntity[]>();
  for (const entity of pattern.entities) {
    if (!LANES.includes(entity.lane)) {
      errors.push(`Entity has invalid lane ${String(entity.lane)}`);
      continue;
    }
    if (!Number.isInteger(entity.row) || entity.row < 0 || entity.row >= pattern.length) {
      errors.push(`Entity in lane ${entity.lane} has out-of-range row ${entity.row}`);
      continue;
    }
    const key = `${entity.row}:${entity.lane}`;
    const kinds = cellKinds.get(key) ?? new Set<PatternEntityKind>();
    if (kinds.has(entity.kind)) {
      errors.push(`Duplicate ${entity.kind} at row ${entity.row}, lane ${entity.lane}`);
    }
    kinds.add(entity.kind);
    cellKinds.set(key, kinds);
    const cellEntities = entitiesByRowAndLane.get(key) ?? [];
    cellEntities.push(entity);
    entitiesByRowAndLane.set(key, cellEntities);
  }

  if (errors.length > 0 && (!Number.isInteger(pattern.length) || pattern.length <= 0)) {
    return { valid: false, errors, reachableLanesByRow, endingLanes: new Set<Lane>() };
  }

  let states = new Map<string, RouteState>();
  for (const lane of startingLanes) {
    const state: RouteState = { lane, lastActionRow: Number.NEGATIVE_INFINITY };
    states.set(stateKey(state), state);
  }

  for (let row = 0; row < pattern.length; row += 1) {
    const nextStates = new Map<string, RouteState>();
    for (const state of states.values()) {
      for (const candidateLane of LANES) {
        if (Math.abs(candidateLane - state.lane) > maxLaneDelta) continue;
        const action = requiredAction(entitiesByRowAndLane.get(`${row}:${candidateLane}`) ?? []);
        if (action === 'impossible') continue;
        if (action !== 'none' && row - state.lastActionRow <= minimumActionGap) {
          continue;
        }
        const nextState: RouteState = {
          lane: candidateLane,
          lastActionRow: action === 'none' ? state.lastActionRow : row,
        };
        nextStates.set(stateKey(nextState), nextState);
      }
    }
    states = nextStates;
    reachableLanesByRow.push(new Set([...states.values()].map((state) => state.lane)));
    if (states.size === 0) {
      errors.push(`No reachable route remains at row ${row}`);
      break;
    }
  }

  const endingLanes = new Set([...states.values()].map((state) => state.lane));
  return {
    valid: errors.length === 0,
    errors,
    reachableLanesByRow,
    endingLanes,
  };
}

export function isObstaclePatternValid(
  pattern: ObstaclePattern,
  options?: PatternValidationOptions,
): boolean {
  return validateObstaclePattern(pattern, options).valid;
}

const coinLine = (lane: Lane, from: number, to: number): PatternEntity[] => {
  const entities: PatternEntity[] = [];
  for (let row = from; row <= to; row += 1) entities.push({ kind: 'coin', lane, row });
  return entities;
};

export const OBSTACLE_PATTERNS: readonly ObstaclePattern[] = Object.freeze([
  {
    id: 'coin-straight',
    name: 'Light Trail',
    length: 12,
    complexity: 1,
    minimumDifficulty: 0,
    weight: 1.5,
    entities: coinLine(0, 1, 10),
  },
  {
    id: 'coin-arc',
    name: 'Sky Arc',
    length: 12,
    complexity: 1,
    minimumDifficulty: 0,
    weight: 1.1,
    entities: [
      { kind: 'coin', lane: 0, row: 2, height: 0.6 },
      { kind: 'coin', lane: 0, row: 3, height: 1.2 },
      { kind: 'coin', lane: 0, row: 4, height: 1.8 },
      { kind: 'coin', lane: 0, row: 5, height: 2.2 },
      { kind: 'coin', lane: 0, row: 6, height: 1.8 },
      { kind: 'coin', lane: 0, row: 7, height: 1.2 },
      { kind: 'coin', lane: 0, row: 8, height: 0.6 },
    ],
  },
  {
    id: 'coin-lane-weave',
    name: 'Signal Weave',
    length: 14,
    complexity: 2,
    minimumDifficulty: 0.08,
    weight: 1.15,
    entities: [
      ...coinLine(-1, 1, 3),
      ...coinLine(0, 4, 7),
      ...coinLine(1, 8, 11),
      { kind: 'coin', lane: 0, row: 12 },
    ],
  },
  {
    id: 'jump-line',
    name: 'Vault Line',
    length: 14,
    complexity: 2,
    minimumDifficulty: 0.1,
    weight: 1,
    entities: [
      ...coinLine(0, 1, 3),
      { kind: 'jump-barrier', lane: 0, row: 4 },
      { kind: 'coin', lane: 0, row: 4, height: 1.8 },
      ...coinLine(0, 5, 8),
      { kind: 'jump-barrier', lane: 0, row: 10 },
      { kind: 'coin', lane: 0, row: 10, height: 1.8 },
    ],
  },
  {
    id: 'slide-line',
    name: 'Laser Gates',
    length: 14,
    complexity: 2,
    minimumDifficulty: 0.14,
    weight: 0.95,
    entities: [
      { kind: 'overhead-gate', lane: 0, row: 4 },
      { kind: 'coin', lane: 0, row: 4, height: 0.35 },
      ...coinLine(0, 5, 8),
      { kind: 'overhead-gate', lane: 0, row: 10 },
      { kind: 'coin', lane: 0, row: 10, height: 0.35 },
    ],
  },
  {
    id: 'single-lane-blockers',
    name: 'Closed Channels',
    length: 13,
    complexity: 2,
    minimumDifficulty: 0.18,
    weight: 1.1,
    entities: [
      { kind: 'lane-blocker', lane: -1, row: 4 },
      { kind: 'lane-blocker', lane: 0, row: 4 },
      ...coinLine(1, 3, 7),
      { kind: 'lane-blocker', lane: 0, row: 9 },
      { kind: 'lane-blocker', lane: 1, row: 9 },
      { kind: 'coin', lane: -1, row: 9 },
    ],
  },
  {
    id: 'moving-vehicles',
    name: 'Transit Pulse',
    length: 16,
    complexity: 3,
    minimumDifficulty: 0.3,
    weight: 0.82,
    entities: [
      { kind: 'vehicle', lane: -1, row: 5, moving: true },
      { kind: 'vehicle', lane: 1, row: 5, moving: true },
      ...coinLine(0, 3, 8),
      { kind: 'vehicle', lane: 0, row: 11, moving: true },
      ...coinLine(-1, 10, 14),
    ],
  },
  {
    id: 'alternating-blockers',
    name: 'Cross Current',
    length: 17,
    complexity: 4,
    minimumDifficulty: 0.46,
    weight: 0.72,
    entities: [
      { kind: 'lane-blocker', lane: -1, row: 4 },
      { kind: 'lane-blocker', lane: 0, row: 4 },
      { kind: 'coin', lane: 1, row: 4 },
      { kind: 'lane-blocker', lane: 0, row: 8 },
      { kind: 'lane-blocker', lane: 1, row: 8 },
      { kind: 'coin', lane: -1, row: 8 },
      { kind: 'lane-blocker', lane: -1, row: 12 },
      { kind: 'lane-blocker', lane: 0, row: 12 },
      { kind: 'coin', lane: 1, row: 12 },
    ],
  },
  {
    id: 'mixed-actions',
    name: 'Up and Under',
    length: 18,
    complexity: 5,
    minimumDifficulty: 0.62,
    weight: 0.58,
    entities: [
      { kind: 'lane-blocker', lane: -1, row: 3 },
      { kind: 'overhead-gate', lane: 0, row: 3 },
      { kind: 'lane-blocker', lane: 1, row: 3 },
      ...coinLine(0, 4, 7),
      { kind: 'jump-barrier', lane: -1, row: 9 },
      { kind: 'lane-blocker', lane: 0, row: 9 },
      { kind: 'lane-blocker', lane: 1, row: 9 },
      { kind: 'coin', lane: -1, row: 9, height: 1.8 },
      ...coinLine(-1, 10, 13),
      { kind: 'lane-blocker', lane: -1, row: 15 },
      { kind: 'overhead-gate', lane: 0, row: 15 },
      { kind: 'lane-blocker', lane: 1, row: 15 },
    ],
  },
]);

export type RandomSource = () => number;
export type RandomSeed = number | string;

function hashSeed(seed: RandomSeed): number {
  if (typeof seed === 'number') return seed >>> 0;
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  public constructor(seed: RandomSeed) {
    this.state = hashSeed(seed) || 0x6d2b79f5;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }
}

export function createSeededRandom(seed: RandomSeed): RandomSource {
  const random = new SeededRandom(seed);
  return () => random.next();
}

export function selectObstaclePattern(
  randomOrSeed: RandomSource | RandomSeed,
  normalizedDifficulty = 0,
  excludedIds: ReadonlySet<string> = new Set<string>(),
): ObstaclePattern {
  const random =
    typeof randomOrSeed === 'function' ? randomOrSeed : createSeededRandom(randomOrSeed);
  const difficulty = Math.max(0, Math.min(1, normalizedDifficulty));
  let candidates = OBSTACLE_PATTERNS.filter(
    (pattern) =>
      pattern.minimumDifficulty <= difficulty &&
      !excludedIds.has(pattern.id) &&
      isObstaclePatternValid(pattern),
  );
  if (candidates.length === 0) {
    candidates = OBSTACLE_PATTERNS.filter((pattern) => isObstaclePatternValid(pattern));
  }
  if (candidates.length === 0) {
    throw new Error('No valid obstacle patterns are available');
  }

  const desiredComplexity = 1 + difficulty * 4;
  const weightedCandidates = candidates.map((pattern) => ({
    pattern,
    weight: pattern.weight / (1 + Math.abs(pattern.complexity - desiredComplexity) * 0.8),
  }));
  const totalWeight = weightedCandidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = Math.max(0, Math.min(0.999999999, random())) * totalWeight;
  for (const candidate of weightedCandidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.pattern;
  }
  const fallback = weightedCandidates[weightedCandidates.length - 1];
  if (fallback === undefined) throw new Error('No weighted obstacle pattern is available');
  return fallback.pattern;
}

export const TRACK_PATTERNS = OBSTACLE_PATTERNS;
