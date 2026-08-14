export type PowerUpType =
  'coin-magnet' | 'energy-shield' | 'score-booster' | 'sky-boots' | 'dash-mode';

export interface PowerUpDefinition {
  readonly type: PowerUpType;
  readonly name: string;
  readonly description: string;
  readonly duration: number | null;
  readonly colour: number;
  readonly emissiveColour: number;
  readonly icon: string;
}

export const POWER_UP_DEFINITIONS: Readonly<Record<PowerUpType, PowerUpDefinition>> = Object.freeze(
  {
    'coin-magnet': {
      type: 'coin-magnet',
      name: 'Flux Magnet',
      description: 'Pulls nearby energy coins toward the runner.',
      duration: 8,
      colour: 0xff4fbe,
      emissiveColour: 0x8b075f,
      icon: '◎',
    },
    'energy-shield': {
      type: 'energy-shield',
      name: 'Pulse Shield',
      description: 'Absorbs one obstacle impact.',
      duration: null,
      colour: 0x43e8ff,
      emissiveColour: 0x075b8b,
      icon: '⬡',
    },
    'score-booster': {
      type: 'score-booster',
      name: 'Prism Booster',
      description: 'Temporarily doubles score gains.',
      duration: 9,
      colour: 0xffde59,
      emissiveColour: 0x8b6807,
      icon: '×2',
    },
    'sky-boots': {
      type: 'sky-boots',
      name: 'Sky Boots',
      description: 'Increases jump height for a short time.',
      duration: 9,
      colour: 0x9d7dff,
      emissiveColour: 0x392179,
      icon: '↥',
    },
    'dash-mode': {
      type: 'dash-mode',
      name: 'Nova Dash',
      description: 'Grants speed, invulnerability, and close-range coin collection.',
      duration: 5,
      colour: 0xff7043,
      emissiveColour: 0x8b2607,
      icon: '»',
    },
  },
);

export const POWER_UP_TYPES = Object.freeze(Object.keys(POWER_UP_DEFINITIONS) as PowerUpType[]);
