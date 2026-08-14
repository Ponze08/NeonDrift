export enum InputAction {
  MoveLeft = 'move-left',
  MoveRight = 'move-right',
  Jump = 'jump',
  Slide = 'slide',
  Pause = 'pause',
  Restart = 'restart',
  ActivateHoverDevice = 'activate-hover-device',
}

export type InputActionHandler = (action: InputAction) => void;
