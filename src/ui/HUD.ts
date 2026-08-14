import { clamp, formatDistance, formatInteger, requireElement, setText } from './dom';
import type { HUDSnapshot, MissionProgressSnapshot, PowerUpIndicator } from './types';

const POWER_ICONS: Record<string, string> = {
  magnet: '⌁',
  'coin-magnet': '⌁',
  shield: '◇',
  'energy-shield': '◇',
  booster: '×',
  'score-booster': '×',
  boots: '↥',
  'sky-boots': '↥',
  dash: '»',
  'dash-mode': '»',
};

export class HUD {
  readonly root: HTMLElement;
  private lastMultiplier = 1;

  constructor(root: HTMLElement = requireElement('#hud')) {
    this.root = root;
  }

  update(snapshot: Partial<HUDSnapshot>): void {
    if (snapshot.score !== undefined)
      setText(requireElement('#hud-score', this.root), formatInteger(snapshot.score));
    if (snapshot.coins !== undefined)
      setText(requireElement('#hud-coins', this.root), formatInteger(snapshot.coins));
    if (snapshot.distance !== undefined)
      setText(requireElement('#hud-distance', this.root), formatDistance(snapshot.distance));
    if (snapshot.speed !== undefined) {
      setText(
        requireElement('#hud-speed', this.root),
        `${Math.max(0, Math.round(snapshot.speed))} km/h`,
      );
      const maximum = Math.max(1, snapshot.maxSpeed ?? 60);
      requireElement<HTMLElement>('#hud-speed-fill', this.root).style.width =
        `${clamp((snapshot.speed / maximum) * 100, 0, 100)}%`;
    }
    if (snapshot.multiplier !== undefined) {
      const chip = requireElement<HTMLElement>('#hud-multiplier', this.root);
      setText(requireElement('b', chip), formatInteger(snapshot.multiplier));
      if (snapshot.multiplier !== this.lastMultiplier) {
        chip.classList.remove('is-pulsing');
        void chip.offsetWidth;
        chip.classList.add('is-pulsing');
        this.lastMultiplier = snapshot.multiplier;
      }
    }
    if (snapshot.hoverDevices !== undefined) this.setHoverDevices(snapshot.hoverDevices);
    if (snapshot.hoverDeviceActive !== undefined)
      this.setHoverDeviceActive(snapshot.hoverDeviceActive);
  }

  setPowerUps(powerUps: readonly PowerUpIndicator[]): void {
    const container = requireElement<HTMLElement>('#power-up-container', this.root);
    const activeIds = new Set(powerUps.map((powerUp) => powerUp.id));
    container.querySelectorAll<HTMLElement>('[data-power-up-id]').forEach((element) => {
      if (!activeIds.has(element.dataset.powerUpId ?? '')) element.remove();
    });
    powerUps.forEach((powerUp) => {
      let element = container.querySelector<HTMLElement>(
        `[data-power-up-id="${CSS.escape(powerUp.id)}"]`,
      );
      if (!element) {
        element = this.createPowerUp(powerUp);
        container.append(element);
      }
      const progress = clamp(powerUp.remaining / Math.max(0.001, powerUp.duration), 0, 1);
      element.style.setProperty('--power-color', powerUp.color ?? '#45f4ff');
      requireElement<HTMLElement>('.power-up-indicator__bar i', element).style.width =
        `${progress * 100}%`;
      setText(requireElement('time', element), `${Math.max(0, powerUp.remaining).toFixed(1)}s`);
      setText(requireElement('.power-up-indicator__copy b', element), powerUp.label);
    });
  }

  showMission(snapshot: MissionProgressSnapshot | null): void {
    const element = requireElement<HTMLElement>('#run-mission-progress', this.root);
    if (!snapshot) {
      element.hidden = true;
      return;
    }
    element.hidden = false;
    setText(requireElement('#run-mission-label', element), snapshot.label);
    setText(
      requireElement('#run-mission-value', element),
      `${formatInteger(snapshot.progress)} / ${formatInteger(snapshot.target)}`,
    );
    requireElement<HTMLElement>('#run-mission-fill', element).style.width =
      `${clamp((snapshot.progress / Math.max(1, snapshot.target)) * 100, 0, 100)}%`;
  }

  setHoverDevices(count: number): void {
    const button = requireElement<HTMLButtonElement>('#hover-device-button', this.root);
    setText(requireElement('#hud-hover-count', button), formatInteger(count));
    button.disabled = count <= 0 || button.classList.contains('is-active');
  }

  setHoverDeviceActive(active: boolean): void {
    const button = requireElement<HTMLButtonElement>('#hover-device-button', this.root);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    const count = Number.parseInt(
      requireElement('#hud-hover-count', button).textContent?.replace(/\D/g, '') || '0',
      10,
    );
    button.disabled = active || count <= 0;
  }

  reset(): void {
    this.update({ score: 0, coins: 0, distance: 0, multiplier: 1, speed: 0 });
    this.setPowerUps([]);
    this.showMission(null);
    this.lastMultiplier = 1;
  }

  private createPowerUp(powerUp: PowerUpIndicator): HTMLElement {
    const element = document.createElement('div');
    element.className = 'power-up-indicator';
    element.dataset.powerUpId = powerUp.id;
    const icon = document.createElement('span');
    icon.className = 'power-up-indicator__icon';
    icon.textContent = powerUp.icon ?? POWER_ICONS[powerUp.id] ?? '✦';
    icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'power-up-indicator__copy';
    const label = document.createElement('b');
    const bar = document.createElement('span');
    bar.className = 'power-up-indicator__bar';
    bar.append(document.createElement('i'));
    copy.append(label, bar);
    const time = document.createElement('time');
    element.append(icon, copy, time);
    return element;
  }
}
