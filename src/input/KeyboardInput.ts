import { InputAction, type InputActionHandler } from './InputAction';

const KEY_ACTIONS: Readonly<Record<string, InputAction>> = {
  ArrowLeft: InputAction.MoveLeft,
  KeyA: InputAction.MoveLeft,
  ArrowRight: InputAction.MoveRight,
  KeyD: InputAction.MoveRight,
  ArrowUp: InputAction.Jump,
  KeyW: InputAction.Jump,
  Space: InputAction.Jump,
  ArrowDown: InputAction.Slide,
  KeyS: InputAction.Slide,
  Escape: InputAction.Pause,
  KeyR: InputAction.Restart,
  KeyB: InputAction.ActivateHoverDevice,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  );
}

export class KeyboardInput {
  private readonly target: Window | Document;
  private readonly handler: InputActionHandler;
  private attached = false;

  public constructor(handler: InputActionHandler, target: Window | Document = window) {
    this.handler = handler;
    this.target = target;
  }

  public attach(): void {
    if (this.attached) return;
    this.target.addEventListener('keydown', this.onKeyDown as EventListener, { passive: false });
    this.attached = true;
  }

  public detach(): void {
    if (!this.attached) return;
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.attached = false;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) return;
    const action = KEY_ACTIONS[event.code];
    if (action === undefined) return;
    event.preventDefault();
    if (event.repeat) return;
    this.handler(action);
  };
}
