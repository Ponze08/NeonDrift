export function requireElement<T extends Element>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Neon Drift UI is missing required element: ${selector}`);
  }
  return element;
}

export function setText(element: Element, value: string | number): void {
  element.textContent = String(value);
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function formatInteger(value: number): string {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0)).toLocaleString();
}

export function formatDistance(value: number): string {
  const distance = Math.max(0, Number.isFinite(value) ? value : 0);
  return distance >= 10_000
    ? `${(distance / 1000).toFixed(1)} km`
    : `${Math.floor(distance).toLocaleString()} m`;
}

export function formatDuration(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : `${seconds}s`;
}

export function setVisible(element: HTMLElement, visible: boolean): void {
  element.hidden = !visible;
  element.classList.toggle('is-active', visible);
}
