import { formatDistance, formatInteger, requireElement, setText } from './dom';
import type { PauseSnapshot } from './types';

export class PauseMenu {
  readonly root: HTMLElement;

  constructor(root: HTMLElement = requireElement('#pause-screen')) {
    this.root = root;
  }

  update(snapshot: Partial<PauseSnapshot>): void {
    if (snapshot.score !== undefined)
      setText(requireElement('#pause-score', this.root), formatInteger(snapshot.score));
    if (snapshot.distance !== undefined)
      setText(requireElement('#pause-distance', this.root), formatDistance(snapshot.distance));
  }
}
