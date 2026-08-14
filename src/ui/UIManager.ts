import { clamp, requireElement, setText, setVisible } from './dom';
import { GameOverMenu } from './GameOverMenu';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { SettingsMenu } from './SettingsMenu';
import type {
  CharacterActionPayload,
  GameOverSummary,
  HUDSnapshot,
  MainMenuData,
  MenuTab,
  MissionProgressSnapshot,
  PauseSnapshot,
  PowerUpIndicator,
  ToastKind,
  UIEventHandler,
  UIEventMap,
  UIEventName,
  UISettings,
  UIScreen,
} from './types';

const TOAST_ICONS: Record<ToastKind, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '×',
};

/**
 * Owns every HTML overlay and translates DOM input into typed, game-agnostic events.
 * The Three.js game can depend on this class without this class depending on Game.
 */
export class UIManager {
  readonly mainMenu: MainMenu;
  readonly hud: HUD;
  readonly pauseMenu: PauseMenu;
  readonly gameOverMenu: GameOverMenu;
  readonly settingsMenu: SettingsMenu;

  private readonly app: HTMLElement;
  private readonly loadingScreen: HTMLElement;
  private readonly countdownScreen: HTMLElement;
  private readonly toastRegion: HTMLElement;
  private readonly announcer: HTMLElement;
  private readonly abortController = new AbortController();
  private readonly listeners = new Map<UIEventName, Set<(payload: unknown) => void>>();
  private readonly toastTimers = new Map<HTMLElement, number>();
  private currentScreen: UIScreen = 'loading';
  private pausedSettingsOpen = false;
  private levelTimer: number | undefined;

  constructor(root: Document = document) {
    this.app = requireElement('#app', root);
    this.loadingScreen = requireElement('#loading-screen', root);
    this.countdownScreen = requireElement('#countdown-screen', root);
    this.toastRegion = requireElement('#toast-region', root);
    this.announcer = requireElement('#a11y-announcer', root);
    this.mainMenu = new MainMenu(requireElement<HTMLElement>('#main-menu-screen', root));
    this.hud = new HUD(requireElement<HTMLElement>('#hud', root));
    this.pauseMenu = new PauseMenu(requireElement<HTMLElement>('#pause-screen', root));
    this.gameOverMenu = new GameOverMenu(requireElement<HTMLElement>('#game-over-screen', root));
    this.settingsMenu = new SettingsMenu(requireElement<HTMLFormElement>('#settings-form', root));
    this.bindControls();
    this.showLoading();
  }

  get screen(): UIScreen {
    return this.currentScreen;
  }

  on<K extends UIEventName>(event: K, handler: UIEventHandler<K>): () => void {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    const wrapped = handler as (payload: unknown) => void;
    bucket.add(wrapped);
    return () => bucket?.delete(wrapped);
  }

  once<K extends UIEventName>(event: K, handler: UIEventHandler<K>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  showLoading(progress = 0, status = 'Calibrating skyline…'): void {
    this.activateScreen('loading');
    this.setLoadingProgress(progress, status, false);
  }

  setLoadingProgress(progress: number, status?: string, ready = progress >= 1): void {
    const normalized = clamp(progress > 1 ? progress / 100 : progress, 0, 1);
    const progressBar = requireElement<HTMLElement>('.loading-progress', this.loadingScreen);
    requireElement<HTMLElement>('#loading-progress-fill', this.loadingScreen).style.width =
      `${normalized * 100}%`;
    progressBar.setAttribute('aria-valuenow', String(Math.round(normalized * 100)));
    setText(
      requireElement('#loading-percent', this.loadingScreen),
      `${Math.round(normalized * 100)}%`,
    );
    if (status) setText(requireElement('#loading-status', this.loadingScreen), status);
    if (ready) this.setLoadingReady(true);
  }

  setLoadingReady(ready = true, label = 'Enter the skyline'): void {
    const button = requireElement<HTMLButtonElement>('#start-button', this.loadingScreen);
    button.disabled = !ready;
    button.classList.toggle('is-hidden', !ready);
    if (ready) {
      setText(requireElement('span', button), label);
      setText(requireElement('#loading-status', this.loadingScreen), 'Skyline ready');
    }
  }

  showMainMenu(data?: MainMenuData, tab: MenuTab = 'play'): void {
    this.pausedSettingsOpen = false;
    this.settingsMenu.setPauseContext(false);
    if (data) this.mainMenu.update(data);
    this.mainMenu.openTab(tab);
    this.activateScreen('menu');
  }

  openMenuTab(tab: MenuTab): void {
    this.mainMenu.openTab(tab);
  }

  updateMenuData(data: MainMenuData): void {
    this.mainMenu.update(data);
  }

  showCountdown(value: number | string = 3, label = 'Get ready'): void {
    this.activateScreen('countdown');
    this.setCountdown(value, label);
  }

  setCountdown(value: number | string, label?: string): void {
    const element = requireElement<HTMLElement>('#countdown-value', this.countdownScreen);
    const display = String(value);
    setText(element, display);
    element.classList.toggle('is-go', display.toLowerCase() === 'go' || display === '0');
    element.style.animation = 'none';
    void element.offsetWidth;
    element.style.animation = '';
    if (label !== undefined)
      setText(requireElement('#countdown-label', this.countdownScreen), label);
    this.announce(display.toLowerCase() === 'go' ? 'Go!' : display);
  }

  showHUD(snapshot: Partial<HUDSnapshot> = {}): void {
    this.activateScreen('running');
    this.hud.update(snapshot);
  }

  showRunning(snapshot: Partial<HUDSnapshot> = {}): void {
    this.showHUD(snapshot);
  }

  updateHUD(snapshot: Partial<HUDSnapshot>): void {
    this.hud.update(snapshot);
  }

  updatePowerUps(powerUps: readonly PowerUpIndicator[]): void {
    this.hud.setPowerUps(powerUps);
  }

  showMissionProgress(progress: MissionProgressSnapshot | null): void {
    this.hud.showMission(progress);
  }

  setHoverDeviceInventory(count: number): void {
    this.hud.setHoverDevices(count);
  }

  setHoverDeviceActive(active: boolean): void {
    this.hud.setHoverDeviceActive(active);
  }

  showPause(snapshot: Partial<PauseSnapshot> = {}): void {
    this.pausedSettingsOpen = false;
    this.settingsMenu.setPauseContext(false);
    this.pauseMenu.update(snapshot);
    this.activateScreen('paused');
  }

  showPauseMenu(snapshot: Partial<PauseSnapshot> = {}): void {
    this.showPause(snapshot);
  }

  showGameOver(summary: GameOverSummary): void {
    this.gameOverMenu.update(summary);
    this.activateScreen('gameover');
    this.announce(`Run complete. Score ${Math.round(summary.score)}.`);
  }

  hideAll(): void {
    this.screenElements().forEach((element) => setVisible(element, false));
    setVisible(this.hud.root, false);
  }

  setSettings(settings: Partial<UISettings>): void {
    this.settingsMenu.write(settings);
  }

  getSettings(): UISettings {
    return this.settingsMenu.read();
  }

  showToast(message: string, kind: ToastKind = 'info', duration = 2_600): void {
    const toast = document.createElement('div');
    toast.className = `toast toast--${kind}`;
    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.textContent = TOAST_ICONS[kind];
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = message;
    toast.append(icon, text);
    this.toastRegion.append(toast);
    const timer = window.setTimeout(() => this.removeToast(toast), Math.max(700, duration));
    this.toastTimers.set(toast, timer);
  }

  showScorePopup(text: string, horizontalOffset = 0): void {
    const container = requireElement<HTMLElement>('#score-popups', this.app);
    const popup = document.createElement('span');
    popup.className = 'score-popup';
    popup.textContent = text;
    popup.style.marginLeft = `${clamp(horizontalOffset, -180, 180)}px`;
    container.append(popup);
    window.setTimeout(() => popup.remove(), 900);
  }

  showLevelUp(level: number): void {
    const overlay = requireElement<HTMLElement>('#level-up-overlay', this.app);
    setText(requireElement('#level-up-value', overlay), Math.max(1, Math.floor(level)));
    overlay.hidden = false;
    overlay.style.animation = 'none';
    void overlay.offsetWidth;
    overlay.style.animation = '';
    if (this.levelTimer !== undefined) window.clearTimeout(this.levelTimer);
    this.levelTimer = window.setTimeout(() => {
      overlay.hidden = true;
    }, 2_450);
    this.announce(`Level up. You reached level ${Math.floor(level)}.`);
  }

  announce(message: string): void {
    this.announcer.textContent = '';
    window.setTimeout(() => {
      this.announcer.textContent = message;
    }, 20);
  }

  async toggleFullscreen(): Promise<boolean> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.app.requestFullscreen({ navigationUI: 'hide' });
      const active = Boolean(document.fullscreenElement);
      this.emit('fullscreen', active);
      this.showToast(active ? 'Fullscreen enabled' : 'Fullscreen disabled', 'info', 1_600);
      return active;
    } catch {
      this.showToast('Fullscreen is unavailable in this browser', 'warning');
      this.emit('fullscreen', false);
      return false;
    }
  }

  destroy(): void {
    this.abortController.abort();
    this.toastTimers.forEach((timer) => window.clearTimeout(timer));
    this.toastTimers.clear();
    if (this.levelTimer !== undefined) window.clearTimeout(this.levelTimer);
    this.listeners.forEach((handlers) => handlers.clear());
    this.listeners.clear();
  }

  private activateScreen(screen: UIScreen): void {
    this.currentScreen = screen;
    this.app.dataset.state = screen;
    const showHUD = screen === 'running' || screen === 'countdown' || screen === 'paused';
    setVisible(this.loadingScreen, screen === 'loading');
    setVisible(this.mainMenu.root, screen === 'menu');
    setVisible(this.countdownScreen, screen === 'countdown');
    setVisible(this.pauseMenu.root, screen === 'paused');
    setVisible(this.gameOverMenu.root, screen === 'gameover');
    setVisible(this.hud.root, showHUD);
    if (screen !== 'paused') this.pausedSettingsOpen = false;
  }

  private showSettingsFromPause(): void {
    this.pausedSettingsOpen = true;
    this.currentScreen = 'paused';
    this.app.dataset.state = 'paused';
    setVisible(this.pauseMenu.root, false);
    setVisible(this.hud.root, false);
    setVisible(this.mainMenu.root, true);
    this.mainMenu.openTab('settings');
    this.settingsMenu.setPauseContext(true);
    this.settingsMenu.backButton.focus();
  }

  private returnToPause(): void {
    if (!this.pausedSettingsOpen) return;
    this.showPause();
    requireElement<HTMLButtonElement>('#resume-button', this.pauseMenu.root).focus();
  }

  private bindControls(): void {
    const signal = this.abortController.signal;
    const click = (selector: string, handler: () => void): void => {
      requireElement<HTMLElement>(selector, this.app).addEventListener('click', handler, {
        signal,
      });
    };

    click('#start-button', () => this.emit('enter', undefined));
    click('#play-button', () => this.emit('start', undefined));
    click('#pause-button', () => this.emit('pause', undefined));
    click('#resume-button', () => this.emit('resume', undefined));
    click('#pause-restart-button', () => this.emit('restart', undefined));
    click('#game-over-restart-button', () => this.emit('restart', undefined));
    click('#pause-menu-button', () => this.emit('mainMenu', undefined));
    click('#game-over-menu-button', () => this.emit('mainMenu', undefined));
    click('#hover-device-button', () => this.emit('activateHover', undefined));
    click('#pause-settings-button', () => {
      this.showSettingsFromPause();
      this.emit('pauseSettings', undefined);
    });
    click('#settings-back-button', () => this.returnToPause());
    click('#fullscreen-button', () => {
      void this.toggleFullscreen();
    });
    click('#reset-save-button', () => {
      const confirmed = window.confirm(
        'Reset all Neon Drift progress and settings on this device? This cannot be undone.',
      );
      if (confirmed) this.emit('resetSave', undefined);
    });
    click('#buy-hover-button', () => {
      const cost = Number(
        requireElement<HTMLElement>('#buy-hover-button', this.app).dataset.cost ?? 0,
      );
      this.emit('buyHoverDevice', cost);
    });

    this.app.querySelectorAll<HTMLElement>('[data-menu-tab]').forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const tab = button.dataset.menuTab as MenuTab | undefined;
          if (tab && (!this.pausedSettingsOpen || tab === 'settings')) this.mainMenu.openTab(tab);
        },
        { signal },
      );
    });

    requireElement('#character-list', this.app).addEventListener(
      'click',
      (event) => {
        const button = (event.target as Element).closest<HTMLElement>('[data-character-id]');
        if (!button?.dataset.characterId) return;
        this.mainMenu.selectCharacter(button.dataset.characterId);
        this.emit('characterSelect', button.dataset.characterId);
      },
      { signal },
    );

    requireElement('#character-action-button', this.app).addEventListener(
      'click',
      (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        const id = button.dataset.characterId;
        const mode = button.dataset.mode;
        if (!id || (mode !== 'buy' && mode !== 'equip')) return;
        const payload: CharacterActionPayload = { id, action: mode };
        this.emit('characterAction', payload);
      },
      { signal },
    );

    requireElement('#equipment-list', this.app).addEventListener(
      'click',
      (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-equipment-id]');
        const id = button?.dataset.equipmentId;
        const mode = button?.dataset.mode;
        if (!id || (mode !== 'buy' && mode !== 'equip')) return;
        this.emit('equipmentAction', { id, action: mode });
      },
      { signal },
    );

    this.settingsMenu.form.addEventListener(
      'input',
      () => {
        this.settingsMenu.syncOutputs();
        this.emit('settingsChange', this.settingsMenu.read());
      },
      { signal },
    );
    this.settingsMenu.form.addEventListener(
      'change',
      () => {
        this.settingsMenu.syncOutputs();
        this.emit('settingsChange', this.settingsMenu.read());
      },
      { signal },
    );

    requireElement<HTMLCanvasElement>('#game-canvas', this.app).addEventListener(
      'contextmenu',
      (event) => event.preventDefault(),
      { signal },
    );
  }

  private emit<K extends UIEventName>(event: K, payload: UIEventMap[K]): void {
    const handlers = this.listeners.get(event);
    handlers?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[Neon Drift UI] ${event} handler failed`, error);
      }
    });
  }

  private removeToast(toast: HTMLElement): void {
    const timer = this.toastTimers.get(toast);
    if (timer !== undefined) window.clearTimeout(timer);
    this.toastTimers.delete(toast);
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 260);
  }

  private screenElements(): HTMLElement[] {
    return [
      this.loadingScreen,
      this.mainMenu.root,
      this.countdownScreen,
      this.pauseMenu.root,
      this.gameOverMenu.root,
    ];
  }
}

export default UIManager;
