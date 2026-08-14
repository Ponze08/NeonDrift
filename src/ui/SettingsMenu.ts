import { clamp, requireElement } from './dom';
import type { GraphicsQuality, UISettings } from './types';

const DEFAULT_SETTINGS: UISettings = {
  musicVolume: 0.65,
  sfxVolume: 0.8,
  swipeSensitivity: 45,
  graphicsQuality: 'high',
  cameraShake: true,
  shadows: true,
  particles: true,
  language: 'en',
};

export class SettingsMenu {
  readonly form: HTMLFormElement;
  readonly backButton: HTMLButtonElement;

  constructor(form: HTMLFormElement = requireElement('#settings-form')) {
    this.form = form;
    this.backButton = requireElement('#settings-back-button', form);
    this.syncOutputs();
  }

  read(): UISettings {
    const music = requireElement<HTMLInputElement>('#music-volume', this.form);
    const sfx = requireElement<HTMLInputElement>('#sfx-volume', this.form);
    const swipe = requireElement<HTMLInputElement>('#swipe-sensitivity', this.form);
    const graphics = requireElement<HTMLSelectElement>('#graphics-quality', this.form);
    return {
      musicVolume: clamp(music.valueAsNumber, 0, 1),
      sfxVolume: clamp(sfx.valueAsNumber, 0, 1),
      swipeSensitivity: clamp(swipe.valueAsNumber, 20, 100),
      graphicsQuality: (['low', 'medium', 'high'].includes(graphics.value)
        ? graphics.value
        : 'medium') as GraphicsQuality,
      cameraShake: requireElement<HTMLInputElement>('#camera-shake-toggle', this.form).checked,
      shadows: requireElement<HTMLInputElement>('#shadows-toggle', this.form).checked,
      particles: requireElement<HTMLInputElement>('#particles-toggle', this.form).checked,
      language: requireElement<HTMLSelectElement>('#language-select', this.form).value || 'en',
    };
  }

  write(settings: Partial<UISettings>): void {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    requireElement<HTMLInputElement>('#music-volume', this.form).value = String(
      clamp(merged.musicVolume, 0, 1),
    );
    requireElement<HTMLInputElement>('#sfx-volume', this.form).value = String(
      clamp(merged.sfxVolume, 0, 1),
    );
    requireElement<HTMLInputElement>('#swipe-sensitivity', this.form).value = String(
      clamp(merged.swipeSensitivity, 20, 100),
    );
    requireElement<HTMLSelectElement>('#graphics-quality', this.form).value =
      merged.graphicsQuality;
    requireElement<HTMLInputElement>('#camera-shake-toggle', this.form).checked =
      merged.cameraShake;
    requireElement<HTMLInputElement>('#shadows-toggle', this.form).checked = merged.shadows;
    requireElement<HTMLInputElement>('#particles-toggle', this.form).checked = merged.particles;
    requireElement<HTMLSelectElement>('#language-select', this.form).value = merged.language;
    this.syncOutputs();
  }

  syncOutputs(): void {
    const music = requireElement<HTMLInputElement>('#music-volume', this.form);
    const sfx = requireElement<HTMLInputElement>('#sfx-volume', this.form);
    const swipe = requireElement<HTMLInputElement>('#swipe-sensitivity', this.form);
    requireElement<HTMLOutputElement>('output[for="music-volume"]', this.form).value =
      `${Math.round(music.valueAsNumber * 100)}%`;
    requireElement<HTMLOutputElement>('output[for="sfx-volume"]', this.form).value =
      `${Math.round(sfx.valueAsNumber * 100)}%`;
    requireElement<HTMLOutputElement>('output[for="swipe-sensitivity"]', this.form).value =
      `${Math.round(swipe.valueAsNumber)} px`;
  }

  setPauseContext(fromPause: boolean): void {
    this.backButton.hidden = !fromPause;
  }
}
