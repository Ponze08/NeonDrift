import {
  clamp,
  formatDistance,
  formatDuration,
  formatInteger,
  requireElement,
  setText,
} from './dom';
import type {
  CharacterViewModel,
  EquipmentViewModel,
  MainMenuData,
  MenuTab,
  MissionViewModel,
  ProfileSnapshot,
  StatisticsSnapshot,
} from './types';

const DEFAULT_PROFILE: ProfileSnapshot = {
  name: 'Rookie Drifter',
  level: 1,
  experience: 0,
  experienceForNextLevel: 500,
  totalCoins: 0,
  highScore: 0,
  bestDistance: 0,
  hoverDevices: 0,
  equippedCharacterName: 'Nova',
};

const DEFAULT_CHARACTERS: CharacterViewModel[] = [
  {
    id: 'nova',
    name: 'Nova',
    description: 'A fearless courier tuned to the pulse of Aurora Heights.',
    accent: '#45f4ff',
    owned: true,
    equipped: true,
  },
  {
    id: 'miko',
    name: 'Miko',
    description: 'A rooftop signal hacker with a taste for impossible shortcuts.',
    accent: '#ff4fd8',
    owned: false,
    equipped: false,
    price: 1_500,
  },
  {
    id: 'sol',
    name: 'Sol',
    description: 'A district speed champion who reads traffic like a waveform.',
    accent: '#ffd166',
    owned: false,
    equipped: false,
    price: 3_200,
  },
  {
    id: 'vee',
    name: 'Vee',
    description: 'A workshop-built synthetic runner engineered for precision.',
    accent: '#8d5bff',
    owned: false,
    equipped: false,
    price: 5_000,
  },
];

const DEFAULT_EQUIPMENT: EquipmentViewModel[] = [
  {
    id: 'flux',
    name: 'Flux Standard',
    kind: 'Fluxboard',
    accent: '#45f4ff',
    owned: true,
    equipped: true,
  },
  {
    id: 'board-comet',
    name: 'Comet Board',
    kind: 'Fluxboard',
    accent: '#ffd166',
    owned: true,
    equipped: false,
  },
  {
    id: 'board-orbit',
    name: 'Orbit Board',
    kind: 'Fluxboard',
    accent: '#8d5bff',
    owned: false,
    equipped: false,
    price: 2_400,
  },
];

const DEFAULT_MISSIONS: MissionViewModel[] = [
  {
    id: 'first-coins',
    title: 'Prism Collector',
    description: 'Collect 100 Prism coins',
    progress: 0,
    target: 100,
    reward: 250,
  },
  {
    id: 'first-distance',
    title: 'Skyline Scout',
    description: 'Travel 2,000 metres',
    progress: 0,
    target: 2_000,
    reward: 400,
  },
  {
    id: 'first-jumps',
    title: 'Air Time',
    description: 'Jump over 20 obstacles',
    progress: 0,
    target: 20,
    reward: 300,
  },
];

const DEFAULT_STATS: StatisticsSnapshot = {
  totalRuns: 0,
  totalDistance: 0,
  totalCoins: 0,
  highestScore: 0,
  longestRun: 0,
  totalJumps: 0,
  totalSlides: 0,
  totalLaneChanges: 0,
  totalPowerUps: 0,
  totalCrashes: 0,
};

export class MainMenu {
  readonly root: HTMLElement;
  private readonly characterList: HTMLElement;
  private readonly equipmentList: HTMLElement;
  private readonly missionList: HTMLElement;
  private readonly statisticsGrid: HTMLElement;
  private selectedCharacterId = 'nova';
  private characters: CharacterViewModel[] = DEFAULT_CHARACTERS;

  constructor(root: HTMLElement = requireElement('#main-menu-screen')) {
    this.root = root;
    this.characterList = requireElement('#character-list', root);
    this.equipmentList = requireElement('#equipment-list', root);
    this.missionList = requireElement('#mission-list', root);
    this.statisticsGrid = requireElement('#statistics-grid', root);
    this.updateProfile(DEFAULT_PROFILE);
    this.updateCharacters(DEFAULT_CHARACTERS);
    this.updateEquipment(DEFAULT_EQUIPMENT);
    this.updateMissions(DEFAULT_MISSIONS);
    this.updateStatistics(DEFAULT_STATS);
  }

  openTab(tab: MenuTab): void {
    this.root.querySelectorAll<HTMLElement>('[data-menu-tab]').forEach((button) => {
      const selected = button.dataset.menuTab === tab;
      button.classList.toggle('is-selected', selected);
      if (button.matches('[role="tab"], .menu-tab'))
        button.setAttribute('aria-selected', String(selected));
    });

    this.root.querySelectorAll<HTMLElement>('[data-menu-panel]').forEach((panel) => {
      const selected = panel.dataset.menuPanel === tab;
      panel.hidden = !selected;
      panel.classList.toggle('is-active', selected);
      if (selected) panel.scrollTop = 0;
    });
  }

  update(data: MainMenuData): void {
    if (data.profile) this.updateProfile({ ...DEFAULT_PROFILE, ...data.profile });
    if (data.characters) this.updateCharacters(data.characters);
    if (data.equipment) this.updateEquipment(data.equipment);
    if (data.missions) this.updateMissions(data.missions);
    if (data.statistics) this.updateStatistics({ ...DEFAULT_STATS, ...data.statistics });
  }

  updateProfile(profile: ProfileSnapshot): void {
    const levelTarget = Math.max(1, profile.experienceForNextLevel);
    setText(requireElement('#profile-level', this.root), formatInteger(profile.level));
    setText(
      requireElement('#profile-name', this.root),
      profile.name ?? `Level ${profile.level} Drifter`,
    );
    setText(
      requireElement('#profile-xp-label', this.root),
      `${formatInteger(profile.experience)} / ${formatInteger(levelTarget)} XP`,
    );
    requireElement<HTMLElement>('#profile-xp-fill', this.root).style.width =
      `${clamp((profile.experience / levelTarget) * 100, 0, 100)}%`;
    setText(requireElement('#profile-coins', this.root), formatInteger(profile.totalCoins));
    setText(requireElement('#menu-high-score', this.root), formatInteger(profile.highScore));
    setText(requireElement('#menu-best-distance', this.root), formatDistance(profile.bestDistance));
    setText(requireElement('#menu-hover-count', this.root), formatInteger(profile.hoverDevices));
    setText(
      requireElement('#equipment-hover-count', this.root),
      formatInteger(profile.hoverDevices),
    );
    setText(
      requireElement('#equipped-character-label', this.root),
      `${profile.equippedCharacterName ?? 'Nova'} // Equipped`,
    );
  }

  updateCharacters(characters: CharacterViewModel[]): void {
    this.characters = characters.length ? [...characters] : DEFAULT_CHARACTERS;
    const equipped = this.characters.find((character) => character.equipped);
    if (equipped) this.selectedCharacterId = equipped.id;
    if (!this.characters.some((character) => character.id === this.selectedCharacterId))
      this.selectedCharacterId = this.characters[0]?.id ?? '';
    this.renderCharacters();
    this.selectCharacter(this.selectedCharacterId);
  }

  selectCharacter(id: string): CharacterViewModel | undefined {
    const selected = this.characters.find((character) => character.id === id);
    if (!selected) return undefined;
    this.selectedCharacterId = id;
    this.characterList
      .querySelectorAll<HTMLElement>('[data-character-id]')
      .forEach((card) => card.classList.toggle('is-selected', card.dataset.characterId === id));
    setText(requireElement('#character-detail-name', this.root), selected.name);
    setText(requireElement('#character-detail-description', this.root), selected.description);
    const action = requireElement<HTMLButtonElement>('#character-action-button', this.root);
    action.dataset.characterId = selected.id;
    action.disabled = selected.equipped;
    action.dataset.mode = selected.equipped ? 'equipped' : selected.owned ? 'equip' : 'buy';
    action.textContent = selected.equipped
      ? 'Equipped'
      : selected.owned
        ? 'Equip runner'
        : `Unlock · ${formatInteger(selected.price ?? 0)} ◈`;
    return selected;
  }

  updateEquipment(equipment: EquipmentViewModel[]): void {
    const items = equipment.length ? equipment : DEFAULT_EQUIPMENT;
    this.equipmentList.replaceChildren(...items.map((item) => this.createEquipmentCard(item)));
  }

  updateMissions(missions: MissionViewModel[]): void {
    this.missionList.replaceChildren(
      ...missions.map((mission, index) => this.createMissionCard(mission, index)),
    );
    const claimable = missions.some(
      (mission) => mission.completed || mission.progress >= mission.target,
    );
    requireElement<HTMLElement>('#mission-nav-badge', this.root).hidden = !claimable;
  }

  updateStatistics(statistics: StatisticsSnapshot): void {
    const values: Record<keyof StatisticsSnapshot, string> = {
      totalRuns: formatInteger(statistics.totalRuns),
      totalDistance: formatDistance(statistics.totalDistance),
      totalCoins: formatInteger(statistics.totalCoins),
      highestScore: formatInteger(statistics.highestScore),
      longestRun: formatDuration(statistics.longestRun),
      totalJumps: formatInteger(statistics.totalJumps),
      totalSlides: formatInteger(statistics.totalSlides),
      totalLaneChanges: formatInteger(statistics.totalLaneChanges),
      totalPowerUps: formatInteger(statistics.totalPowerUps),
      totalCrashes: formatInteger(statistics.totalCrashes),
    };
    Object.entries(values).forEach(([key, value]) => {
      const element = this.statisticsGrid.querySelector(`[data-stat="${key}"]`);
      if (element) setText(element, value);
    });
  }

  private renderCharacters(): void {
    this.characterList.replaceChildren(
      ...this.characters.map((character) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'select-card';
        card.dataset.characterId = character.id;
        card.style.setProperty('--card-accent', character.accent ?? '#45f4ff');
        card.setAttribute('aria-label', `Select ${character.name}`);
        const art = document.createElement('span');
        art.className = 'select-card__art';
        art.setAttribute('aria-hidden', 'true');
        const category = document.createElement('small');
        category.textContent = 'Skyline runner';
        const name = document.createElement('b');
        name.textContent = character.name;
        const status = document.createElement('span');
        status.className = 'select-card__status';
        status.textContent = character.equipped
          ? 'Equipped'
          : character.owned
            ? 'Owned'
            : `${formatInteger(character.price ?? 0)} ◈`;
        card.append(art, category, name, status);
        return card;
      }),
    );
  }

  private createEquipmentCard(item: EquipmentViewModel): HTMLButtonElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card${item.equipped ? ' is-selected' : ''}`;
    card.dataset.equipmentId = item.id;
    card.dataset.mode = item.equipped ? 'equipped' : item.owned ? 'equip' : 'buy';
    card.style.setProperty('--card-accent', item.accent ?? '#8d5bff');
    card.disabled = item.equipped;
    const art = document.createElement('span');
    art.className = 'select-card__art';
    art.setAttribute('aria-hidden', 'true');
    const kind = document.createElement('small');
    kind.textContent = item.kind ?? 'Equipment';
    const name = document.createElement('b');
    name.textContent = item.name;
    const status = document.createElement('span');
    status.className = 'select-card__status';
    status.textContent = item.equipped
      ? 'Equipped'
      : item.owned
        ? 'Equip'
        : `${formatInteger(item.price ?? 0)} ◈`;
    card.append(art, kind, name, status);
    return card;
  }

  private createMissionCard(mission: MissionViewModel, index: number): HTMLElement {
    const completed = Boolean(mission.completed || mission.progress >= mission.target);
    const card = document.createElement('article');
    card.className = `mission-card${completed ? ' is-complete' : ''}`;
    const counter = document.createElement('span');
    counter.className = 'mission-card__index';
    counter.textContent = completed ? '✓' : String(index + 1).padStart(2, '0');
    const copy = document.createElement('div');
    copy.className = 'mission-card__copy';
    const title = document.createElement('b');
    title.textContent = mission.title;
    const description = document.createElement('small');
    description.textContent =
      mission.description ??
      `${formatInteger(mission.progress)} / ${formatInteger(mission.target)}`;
    const bar = document.createElement('div');
    bar.className = 'mission-card__bar';
    const fill = document.createElement('i');
    fill.style.width = `${clamp((mission.progress / Math.max(1, mission.target)) * 100, 0, 100)}%`;
    bar.append(fill);
    copy.append(title, description, bar);
    const reward = document.createElement('span');
    reward.className = 'mission-card__reward';
    reward.textContent = completed ? 'Complete' : `+${formatInteger(mission.reward)} ◈`;
    card.append(counter, copy, reward);
    return card;
  }
}
