import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { GameState, GameStateMachine } from '../core/GameState';

describe('EventBus', () => {
  it('types payloads and handles once/unsubscribe during safe dispatch', () => {
    interface Events {
      score: { value: number };
    }
    const events = new EventBus<Events>();
    const persistent = vi.fn();
    const once = vi.fn();
    const unsubscribe = events.on('score', persistent);
    events.once('score', once);

    events.emit('score', { value: 1 });
    unsubscribe();
    events.emit('score', { value: 2 });

    expect(persistent).toHaveBeenCalledTimes(1);
    expect(once).toHaveBeenCalledTimes(1);
    expect(events.listenerCount('score')).toBe(0);
  });
});

describe('GameStateMachine', () => {
  it('allows explicit lifecycle transitions and rejects illegal ones', () => {
    const states = new GameStateMachine();
    const listener = vi.fn();
    states.subscribe(listener);

    expect(states.transition(GameState.Running)).toBe(false);
    expect(states.transition(GameState.MainMenu)).toBe(true);
    expect(states.transition(GameState.Countdown)).toBe(true);
    expect(states.transition(GameState.Running)).toBe(true);
    expect(states.transition(GameState.Paused, 'user')).toBe(true);
    expect(states.transition(GameState.Running)).toBe(true);
    expect(states.transition(GameState.GameOver)).toBe(true);
    expect(states.previousState).toBe(GameState.Running);
    expect(listener).toHaveBeenCalledTimes(6);
  });
});
