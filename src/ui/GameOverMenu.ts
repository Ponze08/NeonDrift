import { formatDistance, formatInteger, requireElement, setText } from './dom';
import type { GameOverSummary } from './types';

export class GameOverMenu {
  readonly root: HTMLElement;

  constructor(root: HTMLElement = requireElement('#game-over-screen')) {
    this.root = root;
  }

  update(summary: GameOverSummary): void {
    setText(requireElement('#final-score', this.root), formatInteger(summary.score));
    setText(requireElement('#final-high-score', this.root), formatInteger(summary.highScore));
    setText(requireElement('#final-distance', this.root), formatDistance(summary.distance));
    setText(requireElement('#final-coins', this.root), formatInteger(summary.coins));
    setText(requireElement('#final-xp', this.root), `+${formatInteger(summary.experienceEarned)}`);
    setText(
      requireElement('#final-multiplier', this.root),
      `x${formatInteger(summary.multiplier ?? 1)}`,
    );
    requireElement<HTMLElement>('#new-record-badge', this.root).hidden = !summary.isNewRecord;

    const wrapper = requireElement<HTMLElement>('#game-over-missions', this.root);
    const list = requireElement<HTMLElement>('#game-over-mission-list', this.root);
    const missions = summary.missions ?? [];
    wrapper.hidden = missions.length === 0;
    list.replaceChildren(
      ...missions.map((mission) => {
        const row = document.createElement('div');
        row.className = 'result-mission';
        const label = document.createElement('span');
        label.textContent = mission.label;
        const value = document.createElement('b');
        value.textContent = `${formatInteger(mission.progress)} / ${formatInteger(mission.target)}`;
        row.append(label, value);
        return row;
      }),
    );
  }
}
