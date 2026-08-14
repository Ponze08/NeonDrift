export type EventKey<Events extends object> = keyof Events;
export type EventListener<Payload> = (payload: Payload) => void;
export type EventErrorHandler<Events extends object> = (
  error: unknown,
  event: EventKey<Events>,
) => void;

/** A small synchronous, typed event bus with mutation-safe dispatch. */
export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<EventListener<never>>>();

  public constructor(private readonly onListenerError?: EventErrorHandler<Events>) {}

  public on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    let eventListeners = this.listeners.get(event);
    if (eventListeners === undefined) {
      eventListeners = new Set<EventListener<never>>();
      this.listeners.set(event, eventListeners);
    }
    eventListeners.add(listener as EventListener<never>);
    return () => this.off(event, listener);
  }

  public once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    const wrapper: EventListener<Events[K]> = (payload) => {
      this.off(event, wrapper);
      listener(payload);
    };
    return this.on(event, wrapper);
  }

  public off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): boolean {
    const eventListeners = this.listeners.get(event);
    if (eventListeners === undefined) {
      return false;
    }
    const deleted = eventListeners.delete(listener as EventListener<never>);
    if (eventListeners.size === 0) {
      this.listeners.delete(event);
    }
    return deleted;
  }

  public emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners === undefined || eventListeners.size === 0) {
      return;
    }

    // A snapshot lets listeners safely subscribe or unsubscribe while dispatching.
    for (const listener of [...eventListeners]) {
      try {
        (listener as EventListener<Events[K]>)(payload);
      } catch (error: unknown) {
        if (this.onListenerError === undefined) {
          throw error;
        }
        this.onListenerError(error, event);
      }
    }
  }

  public clear<K extends keyof Events>(event?: K): void {
    if (event === undefined) {
      this.listeners.clear();
      return;
    }
    this.listeners.delete(event);
  }

  public listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
