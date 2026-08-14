export type FrameHandler = (deltaSeconds: number, elapsedSeconds: number) => void;

/** A visibility-aware requestAnimationFrame loop with a bounded delta. */
export class GameLoop {
  private frameId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private running = false;

  constructor(
    private readonly onFrame: FrameHandler,
    private readonly maxDelta = 1 / 20,
  ) {
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  resetElapsed(): void {
    this.elapsed = 0;
    this.lastTime = performance.now();
  }

  dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return;
    const delta = Math.min(Math.max((time - this.lastTime) / 1000, 0), this.maxDelta);
    this.lastTime = time;
    this.elapsed += delta;
    this.onFrame(delta, this.elapsed);
    this.frameId = requestAnimationFrame(this.tick);
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) {
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      this.frameId = null;
      return;
    }
    if (this.running && this.frameId === null) {
      this.lastTime = performance.now();
      this.frameId = requestAnimationFrame(this.tick);
    }
  };
}
