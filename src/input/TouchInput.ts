import { InputAction, type InputActionHandler } from './InputAction';

export interface TouchInputConfig {
  swipeThreshold: number;
  maximumSwipeTime: number;
}

export const DEFAULT_TOUCH_INPUT_CONFIG: Readonly<TouchInputConfig> = {
  swipeThreshold: 42,
  maximumSwipeTime: 0.8,
};

export class TouchInput {
  public readonly config: TouchInputConfig;

  private readonly element: HTMLElement;
  private readonly handler: InputActionHandler;
  private readonly previousTouchAction: string;
  private readonly previousUserSelect: string;
  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private startTime = 0;
  private attached = false;

  public constructor(
    element: HTMLElement,
    handler: InputActionHandler,
    config: Partial<TouchInputConfig> = {},
  ) {
    this.element = element;
    this.handler = handler;
    this.config = { ...DEFAULT_TOUCH_INPUT_CONFIG, ...config };
    this.previousTouchAction = element.style.touchAction;
    this.previousUserSelect = element.style.userSelect;
  }

  public attach(): void {
    if (this.attached) return;
    this.element.style.touchAction = 'none';
    this.element.style.userSelect = 'none';
    this.element.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.element.addEventListener('pointermove', this.onPointerMove, { passive: false });
    this.element.addEventListener('pointerup', this.onPointerUp, { passive: false });
    this.element.addEventListener('pointercancel', this.onPointerCancel, { passive: false });
    this.element.addEventListener('contextmenu', this.preventDefault);
    document.addEventListener('gesturestart', this.preventDefault, { passive: false });
    document.addEventListener('gesturechange', this.preventDefault, { passive: false });
    this.attached = true;
  }

  public detach(): void {
    if (!this.attached) return;
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerCancel);
    this.element.removeEventListener('contextmenu', this.preventDefault);
    document.removeEventListener('gesturestart', this.preventDefault);
    document.removeEventListener('gesturechange', this.preventDefault);
    this.element.style.touchAction = this.previousTouchAction;
    this.element.style.userSelect = this.previousUserSelect;
    this.activePointerId = null;
    this.attached = false;
  }

  public setSwipeThreshold(pixels: number): void {
    this.config.swipeThreshold = Math.max(8, pixels);
  }

  private readonly preventDefault = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null || event.button !== 0) return;
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.currentX = event.clientX;
    this.currentY = event.clientY;
    this.startTime = event.timeStamp;
    this.element.setPointerCapture?.(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.currentX = event.clientX;
    this.currentY = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.currentX = event.clientX;
    this.currentY = event.clientY;
    const elapsedSeconds = (event.timeStamp - this.startTime) / 1000;
    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const threshold = this.config.swipeThreshold;

    if (elapsedSeconds <= this.config.maximumSwipeTime && Math.max(absX, absY) >= threshold) {
      if (absX > absY) {
        this.handler(deltaX < 0 ? InputAction.MoveLeft : InputAction.MoveRight);
      } else {
        this.handler(deltaY < 0 ? InputAction.Jump : InputAction.Slide);
      }
    }
    this.releasePointer(event.pointerId);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) this.releasePointer(event.pointerId);
  };

  private releasePointer(pointerId: number): void {
    if (this.element.hasPointerCapture?.(pointerId)) this.element.releasePointerCapture(pointerId);
    this.activePointerId = null;
  }
}
