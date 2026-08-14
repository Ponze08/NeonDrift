import {
  MISSION_DEFINITIONS,
  MissionType,
  type MissionDefinition,
  type PersistedMissionState,
} from '../data/missions';
import { createSeededRandom, type RandomSeed, type RandomSource } from '../data/patterns';

export interface MissionManagerOptions {
  readonly definitions?: readonly MissionDefinition[];
  readonly activeCount?: number;
  readonly seed?: RandomSeed;
  readonly random?: RandomSource;
  readonly initialMissions?: readonly PersistedMissionState[];
  readonly completedMissionCount?: number;
}

export interface ActiveMission extends PersistedMissionState {
  readonly definition: MissionDefinition;
  readonly coinReward: number;
  readonly experienceReward: number;
}

export interface MissionProgressUpdate {
  readonly instanceId: string;
  readonly type: MissionType;
  readonly previousProgress: number;
  readonly progress: number;
  readonly target: number;
  readonly completedNow: boolean;
}

export interface MissionReward {
  readonly instanceId: string;
  readonly coins: number;
  readonly experience: number;
}

export interface CombinedMissionReward {
  readonly claimed: readonly string[];
  readonly coins: number;
  readonly experience: number;
}

export type MissionListener = (mission: ActiveMission) => void;
export type MissionProgressListener = (update: MissionProgressUpdate) => void;

function roundedTarget(definition: MissionDefinition, tier: number): number {
  const raw = definition.baseTarget + definition.targetGrowth * Math.max(0, tier - 1);
  if (definition.unit === 'metres') return Math.max(50, Math.round(raw / 50) * 50);
  if (definition.unit === 'seconds') return Math.max(5, Math.round(raw / 5) * 5);
  return Math.max(1, Math.round(raw));
}

function rewardFor(base: number, growth: number, tier: number): number {
  return Math.max(1, Math.round(base * (1 + growth * Math.max(0, tier - 1))));
}

export class MissionManager {
  private readonly definitions: readonly MissionDefinition[];
  private readonly definitionsById: ReadonlyMap<string, MissionDefinition>;
  private readonly activeCount: number;
  private readonly random: RandomSource;
  private active: PersistedMissionState[] = [];
  private completedCount: number;
  private serial = 0;
  private readonly progressListeners = new Set<MissionProgressListener>();
  private readonly completionListeners = new Set<MissionListener>();
  private readonly replacementListeners = new Set<MissionListener>();

  public constructor(options: MissionManagerOptions = {}) {
    this.definitions = options.definitions ?? MISSION_DEFINITIONS;
    this.activeCount = options.activeCount ?? 3;
    this.completedCount = Math.max(0, Math.floor(options.completedMissionCount ?? 0));
    this.random = options.random ?? createSeededRandom(options.seed ?? 'skyline-missions');
    if (!Number.isInteger(this.activeCount) || this.activeCount <= 0) {
      throw new RangeError('activeCount must be a positive integer');
    }
    const ids = new Set<string>();
    const types = new Set<MissionType>();
    for (const definition of this.definitions) {
      if (ids.has(definition.id)) throw new Error(`Duplicate mission definition: ${definition.id}`);
      ids.add(definition.id);
      types.add(definition.type);
    }
    if (types.size < this.activeCount) {
      throw new Error('Not enough distinct mission types to fill active missions');
    }
    this.definitionsById = new Map(
      this.definitions.map((definition) => [definition.id, definition]),
    );
    this.restore(options.initialMissions ?? []);
  }

  public get missions(): readonly ActiveMission[] {
    return this.active.map((state) => this.toActiveMission(state));
  }

  public get persistedMissions(): readonly PersistedMissionState[] {
    return this.active.map((mission) => ({ ...mission }));
  }

  public get completedMissionCount(): number {
    return this.completedCount;
  }

  public record(type: MissionType, amount = 1): readonly MissionProgressUpdate[] {
    if (!Number.isFinite(amount) || amount <= 0) return [];
    const updates: MissionProgressUpdate[] = [];
    this.active = this.active.map((mission) => {
      const definition = this.definitionsById.get(mission.definitionId);
      if (definition?.type !== type || mission.completed) return mission;
      const previousProgress = mission.progress;
      const rawProgress =
        type === MissionType.ReachMultiplier
          ? Math.max(previousProgress, amount)
          : previousProgress + amount;
      const progress = Math.min(mission.target, rawProgress);
      const completed = progress >= mission.target;
      const updated: PersistedMissionState = { ...mission, progress, completed };
      const progressUpdate: MissionProgressUpdate = {
        instanceId: mission.instanceId,
        type,
        previousProgress,
        progress,
        target: mission.target,
        completedNow: completed && !mission.completed,
      };
      updates.push(progressUpdate);
      for (const listener of [...this.progressListeners]) listener(progressUpdate);
      if (progressUpdate.completedNow) {
        const activeMission = this.toActiveMission(updated);
        for (const listener of [...this.completionListeners]) listener(activeMission);
      }
      return updated;
    });
    return updates;
  }

  /** Records an absolute best value, useful for multiplier and run-duration telemetry. */
  public recordMaximum(type: MissionType, value: number): readonly MissionProgressUpdate[] {
    if (!Number.isFinite(value) || value <= 0) return [];
    const updates: MissionProgressUpdate[] = [];
    this.active = this.active.map((mission) => {
      const definition = this.definitionsById.get(mission.definitionId);
      if (definition?.type !== type || mission.completed || value <= mission.progress)
        return mission;
      const previousProgress = mission.progress;
      const progress = Math.min(mission.target, value);
      const completed = progress >= mission.target;
      const updated: PersistedMissionState = { ...mission, progress, completed };
      const update: MissionProgressUpdate = {
        instanceId: mission.instanceId,
        type,
        previousProgress,
        progress,
        target: mission.target,
        completedNow: completed,
      };
      updates.push(update);
      for (const listener of [...this.progressListeners]) listener(update);
      if (completed) {
        const activeMission = this.toActiveMission(updated);
        for (const listener of [...this.completionListeners]) listener(activeMission);
      }
      return updated;
    });
    return updates;
  }

  public claimCompleted(instanceId: string): MissionReward | null {
    const index = this.active.findIndex((mission) => mission.instanceId === instanceId);
    if (index < 0) return null;
    const mission = this.active[index];
    if (mission === undefined) return null;
    if (!mission.completed) return null;
    const definition = this.definitionsById.get(mission.definitionId);
    if (definition === undefined) return null;
    const reward: MissionReward = {
      instanceId,
      coins: rewardFor(definition.baseCoinReward, definition.rewardGrowth, mission.tier),
      experience: rewardFor(definition.baseExperienceReward, definition.rewardGrowth, mission.tier),
    };
    this.active.splice(index, 1);
    this.completedCount += 1;
    const replacement = this.createMission();
    this.active.push(replacement);
    const activeReplacement = this.toActiveMission(replacement);
    for (const listener of [...this.replacementListeners]) listener(activeReplacement);
    return reward;
  }

  public claimAllCompleted(): CombinedMissionReward {
    const ids = this.active
      .filter((mission) => mission.completed)
      .map((mission) => mission.instanceId);
    let coins = 0;
    let experience = 0;
    const claimed: string[] = [];
    for (const id of ids) {
      const reward = this.claimCompleted(id);
      if (reward === null) continue;
      claimed.push(id);
      coins += reward.coins;
      experience += reward.experience;
    }
    return { claimed, coins, experience };
  }

  public onProgress(listener: MissionProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  public onCompleted(listener: MissionListener): () => void {
    this.completionListeners.add(listener);
    return () => this.completionListeners.delete(listener);
  }

  public onReplaced(listener: MissionListener): () => void {
    this.replacementListeners.add(listener);
    return () => this.replacementListeners.delete(listener);
  }

  private restore(saved: readonly PersistedMissionState[]): void {
    const activeTypes = new Set<MissionType>();
    for (const state of saved) {
      if (this.active.length >= this.activeCount) break;
      const definition = this.definitionsById.get(state.definitionId);
      if (definition === undefined || activeTypes.has(definition.type)) continue;
      const target = Number.isFinite(state.target)
        ? Math.max(1, state.target)
        : roundedTarget(definition, state.tier);
      const progress = Number.isFinite(state.progress)
        ? Math.max(0, Math.min(target, state.progress))
        : 0;
      const tier = Number.isFinite(state.tier) ? Math.max(1, Math.floor(state.tier)) : 1;
      const instanceId = state.instanceId || `${definition.id}:${tier}:${this.serial++}`;
      this.active.push({
        instanceId,
        definitionId: definition.id,
        tier,
        target,
        progress,
        completed: progress >= target || state.completed,
      });
      activeTypes.add(definition.type);
    }
    while (this.active.length < this.activeCount) this.active.push(this.createMission());
  }

  private createMission(): PersistedMissionState {
    const activeTypes = new Set(
      this.active
        .map((mission) => this.definitionsById.get(mission.definitionId)?.type)
        .filter((type): type is MissionType => type !== undefined),
    );
    const candidates = this.definitions.filter((definition) => !activeTypes.has(definition.type));
    if (candidates.length === 0) throw new Error('No mission definition can fill the active slot');
    const totalWeight = candidates.reduce(
      (sum, definition) => sum + Math.max(0, definition.weight),
      0,
    );
    let roll = this.random() * totalWeight;
    const fallback = candidates[candidates.length - 1];
    if (fallback === undefined) throw new Error('No weighted mission definition is available');
    let definition = fallback;
    for (const candidate of candidates) {
      roll -= Math.max(0, candidate.weight);
      if (roll <= 0) {
        definition = candidate;
        break;
      }
    }
    const tier = 1 + Math.floor(this.completedCount / Math.max(1, this.activeCount));
    const instanceId = `${definition.id}:${tier}:${this.serial++}`;
    return {
      instanceId,
      definitionId: definition.id,
      tier,
      target: roundedTarget(definition, tier),
      progress: 0,
      completed: false,
    };
  }

  private toActiveMission(state: PersistedMissionState): ActiveMission {
    const definition = this.definitionsById.get(state.definitionId);
    if (definition === undefined)
      throw new Error(`Unknown mission definition: ${state.definitionId}`);
    return {
      ...state,
      definition,
      coinReward: rewardFor(definition.baseCoinReward, definition.rewardGrowth, state.tier),
      experienceReward: rewardFor(
        definition.baseExperienceReward,
        definition.rewardGrowth,
        state.tier,
      ),
    };
  }
}
