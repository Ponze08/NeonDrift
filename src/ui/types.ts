export type UIScreen = 'loading' | 'menu' | 'countdown' | 'running' | 'paused' | 'gameover';

export type MenuTab = 'play' | 'characters' | 'equipment' | 'missions' | 'settings' | 'statistics';

export type ToastKind = 'info' | 'success' | 'warning' | 'danger';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface UISettings {
  musicVolume: number;
  sfxVolume: number;
  swipeSensitivity: number;
  graphicsQuality: GraphicsQuality;
  cameraShake: boolean;
  shadows: boolean;
  particles: boolean;
  language: string;
}

export interface HUDSnapshot {
  score: number;
  coins: number;
  distance: number;
  multiplier: number;
  speed: number;
  maxSpeed?: number;
  hoverDevices?: number;
  hoverDeviceActive?: boolean;
}

export interface PowerUpIndicator {
  id: string;
  label: string;
  remaining: number;
  duration: number;
  color?: string;
  icon?: string;
}

export interface MissionViewModel {
  id: string;
  title: string;
  description?: string;
  progress: number;
  target: number;
  reward: number;
  completed?: boolean;
}

export interface MissionProgressSnapshot {
  id?: string;
  label: string;
  progress: number;
  target: number;
}

export interface CharacterViewModel {
  id: string;
  name: string;
  description: string;
  accent?: string;
  owned: boolean;
  equipped: boolean;
  price?: number;
}

export interface EquipmentViewModel {
  id: string;
  name: string;
  kind?: string;
  accent?: string;
  owned: boolean;
  equipped: boolean;
  price?: number;
}

export interface ProfileSnapshot {
  name?: string;
  level: number;
  experience: number;
  experienceForNextLevel: number;
  totalCoins: number;
  highScore: number;
  bestDistance: number;
  hoverDevices: number;
  equippedCharacterName?: string;
}

export interface StatisticsSnapshot {
  totalRuns: number;
  totalDistance: number;
  totalCoins: number;
  highestScore: number;
  longestRun: number;
  totalJumps: number;
  totalSlides: number;
  totalLaneChanges: number;
  totalPowerUps: number;
  totalCrashes: number;
}

export interface MainMenuData {
  profile?: Partial<ProfileSnapshot>;
  characters?: CharacterViewModel[];
  equipment?: EquipmentViewModel[];
  missions?: MissionViewModel[];
  statistics?: Partial<StatisticsSnapshot>;
}

export interface PauseSnapshot {
  score: number;
  distance: number;
}

export interface GameOverSummary {
  score: number;
  highScore: number;
  distance: number;
  coins: number;
  experienceEarned: number;
  multiplier?: number;
  isNewRecord?: boolean;
  missions?: MissionProgressSnapshot[];
}

export interface CharacterActionPayload {
  id: string;
  action: 'buy' | 'equip';
}

export interface EquipmentActionPayload {
  id: string;
  action: 'buy' | 'equip';
}

export interface UIEventMap {
  enter: void;
  start: void;
  pause: void;
  resume: void;
  restart: void;
  mainMenu: void;
  pauseSettings: void;
  activateHover: void;
  resetSave: void;
  fullscreen: boolean;
  settingsChange: UISettings;
  characterSelect: string;
  characterAction: CharacterActionPayload;
  equipmentAction: EquipmentActionPayload;
  buyHoverDevice: number;
}

export type UIEventName = keyof UIEventMap;

export type UIEventHandler<K extends UIEventName> = (payload: UIEventMap[K]) => void;
