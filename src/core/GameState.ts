export enum GameState {
  Loading = 'loading',
  MainMenu = 'main-menu',
  Countdown = 'countdown',
  Running = 'running',
  Paused = 'paused',
  GameOver = 'game-over',
}

export interface GameStateTransition {
  readonly from: GameState;
  readonly to: GameState;
  readonly reason?: string;
}

export type GameStateListener = (transition: GameStateTransition) => void;

const LEGAL_TRANSITIONS: Readonly<Record<GameState, ReadonlySet<GameState>>> = {
  [GameState.Loading]: new Set([GameState.MainMenu]),
  [GameState.MainMenu]: new Set([GameState.Countdown, GameState.Loading]),
  [GameState.Countdown]: new Set([GameState.Running, GameState.MainMenu]),
  [GameState.Running]: new Set([GameState.Paused, GameState.GameOver, GameState.MainMenu]),
  [GameState.Paused]: new Set([
    GameState.Running,
    GameState.Countdown,
    GameState.MainMenu,
    GameState.GameOver,
  ]),
  [GameState.GameOver]: new Set([GameState.Countdown, GameState.MainMenu]),
};

export function isGameplayState(state: GameState): boolean {
  return state === GameState.Countdown || state === GameState.Running;
}

export class GameStateMachine {
  private current: GameState;
  private previous: GameState | null = null;
  private readonly listeners = new Set<GameStateListener>();

  public constructor(initialState = GameState.Loading) {
    this.current = initialState;
  }

  public get state(): GameState {
    return this.current;
  }

  public get previousState(): GameState | null {
    return this.previous;
  }

  public is(state: GameState): boolean {
    return this.current === state;
  }

  public canTransition(nextState: GameState): boolean {
    return nextState !== this.current && LEGAL_TRANSITIONS[this.current].has(nextState);
  }

  public transition(nextState: GameState, reason?: string): boolean {
    if (!this.canTransition(nextState)) {
      return false;
    }

    const transition: GameStateTransition = {
      from: this.current,
      to: nextState,
      ...(reason === undefined ? {} : { reason }),
    };
    this.previous = this.current;
    this.current = nextState;
    for (const listener of [...this.listeners]) {
      listener(transition);
    }
    return true;
  }

  public requireTransition(nextState: GameState, reason?: string): void {
    if (!this.transition(nextState, reason)) {
      throw new Error(`Illegal game-state transition: ${this.current} -> ${nextState}`);
    }
  }

  public subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
