import { InputAction, type InputActionHandler } from './InputAction';
import { KeyboardInput } from './KeyboardInput';
import { TouchInput, type TouchInputConfig } from './TouchInput';

export interface InputManagerConfig extends TouchInputConfig {
  inputCooldown: number;
  keyboardTarget?: Window | Document;
}

export const DEFAULT_INPUT_MANAGER_CONFIG: Readonly<Omit<InputManagerConfig, 'keyboardTarget'>> = {
  swipeThreshold: 42,
  maximumSwipeTime: 0.8,
  inputCooldown: 0.075,
};

const BYPASS_COOLDOWN = new Set<InputAction>([
  InputAction.Pause,
  InputAction.Restart,
  InputAction.ActivateHoverDevice,
]);

export class InputManager {
  public readonly config: InputManagerConfig;

  private readonly keyboard: KeyboardInput;
  private readonly touch: TouchInput;
  private readonly queued = new Set<InputAction>();
  private readonly lastAccepted = new Map<InputAction, number>();
  private enabled = true;
  private attached = false;

  public constructor(element: HTMLElement, config: Partial<InputManagerConfig> = {}) {
    this.config = { ...DEFAULT_INPUT_MANAGER_CONFIG, ...config };
    this.keyboard = new KeyboardInput(this.queueAction, this.config.keyboardTarget ?? window);
    this.touch = new TouchInput(element, this.queueAction, this.config);
  }

  public attach(): void {
    if (this.attached) return;
    this.keyboard.attach();
    this.touch.attach();
    this.attached = true;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.queued.clear();
  }

  public wasPressed(action: InputAction): boolean {
    return this.queued.has(action);
  }

  public consume(action: InputAction): boolean {
    const present = this.queued.has(action);
    if (present) this.queued.delete(action);
    return present;
  }

  public drain(handler: InputActionHandler): void {
    this.queued.forEach(handler);
    this.queued.clear();
  }

  public endFrame(): void {
    this.queued.clear();
  }

  public setSwipeThreshold(pixels: number): void {
    this.config.swipeThreshold = Math.max(8, pixels);
    this.touch.setSwipeThreshold(this.config.swipeThreshold);
  }

  public destroy(): void {
    this.keyboard.detach();
    this.touch.detach();
    this.queued.clear();
    this.lastAccepted.clear();
    this.attached = false;
  }

  private readonly queueAction = (action: InputAction): void => {
    if (!this.enabled) return;
    const now = performance.now() * 0.001;
    const previous = this.lastAccepted.get(action) ?? -Infinity;
    if (!BYPASS_COOLDOWN.has(action) && now - previous < this.config.inputCooldown) return;
    this.lastAccepted.set(action, now);
    this.queued.add(action);
  };
}
