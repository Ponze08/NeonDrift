import { Game } from './core/Game';

declare global {
  interface Window {
    neonDrift?: Game;
  }
}

function showFatalError(error: unknown): void {
  console.error('[Neon Drift] Startup failed', error);
  const status = document.querySelector<HTMLElement>('#loading-status');
  const progress = document.querySelector<HTMLElement>('#loading-progress-fill');
  const button = document.querySelector<HTMLButtonElement>('#start-button');
  if (status) status.textContent = 'The skyline could not start. Refresh to retry.';
  if (progress) progress.style.width = '100%';
  if (button) {
    button.hidden = false;
    button.disabled = false;
    button.classList.remove('is-hidden');
    button.textContent = 'Reload game';
    button.addEventListener('click', () => window.location.reload(), { once: true });
  }
}

try {
  const game = new Game();
  window.neonDrift = game;
  void game.start().catch(showFatalError);
} catch (error: unknown) {
  showFatalError(error);
}
