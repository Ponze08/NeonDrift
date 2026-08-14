export interface CharacterDefinition {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly price: number;
  readonly unlockedByDefault: boolean;
  readonly colours: {
    readonly primary: number;
    readonly secondary: number;
    readonly accent: number;
    readonly skin: number;
  };
  readonly silhouette: 'balanced' | 'compact' | 'tall' | 'angular';
}

export const CHARACTER_DEFINITIONS: readonly CharacterDefinition[] = Object.freeze([
  {
    id: 'nova',
    name: 'Nova',
    tagline: 'Courier of the sunrise sector',
    price: 0,
    unlockedByDefault: true,
    colours: { primary: 0x26d9ff, secondary: 0x173768, accent: 0xffd84a, skin: 0xd89466 },
    silhouette: 'balanced',
  },
  {
    id: 'miko',
    name: 'Miko',
    tagline: 'Rooftop signal hacker',
    price: 1_500,
    unlockedByDefault: false,
    colours: { primary: 0xff4ca6, secondary: 0x4c1f73, accent: 0x54ffbf, skin: 0x8b543c },
    silhouette: 'compact',
  },
  {
    id: 'sol',
    name: 'Sol',
    tagline: 'District speed champion',
    price: 3_200,
    unlockedByDefault: false,
    colours: { primary: 0xff8b3d, secondary: 0x5e2430, accent: 0xffed85, skin: 0x6e3f2d },
    silhouette: 'tall',
  },
  {
    id: 'vee',
    name: 'Vee',
    tagline: 'Workshop-built synthetic runner',
    price: 5_000,
    unlockedByDefault: false,
    colours: { primary: 0x8b7cff, secondary: 0x24234d, accent: 0x59ffe1, skin: 0xbfc7d5 },
    silhouette: 'angular',
  },
]);

export const DEFAULT_CHARACTER_ID = 'nova';

export interface CosmeticDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: 'outfit' | 'colour' | 'hover-device';
  readonly price: number;
  readonly unlockedByDefault: boolean;
  readonly colour: number;
}

export const COSMETIC_DEFINITIONS: readonly CosmeticDefinition[] = Object.freeze([
  {
    id: 'outfit-streetlight',
    name: 'Streetlight Jacket',
    category: 'outfit',
    price: 0,
    unlockedByDefault: true,
    colour: 0x26d9ff,
  },
  {
    id: 'outfit-afterglow',
    name: 'Afterglow Suit',
    category: 'outfit',
    price: 1_200,
    unlockedByDefault: false,
    colour: 0xff4ca6,
  },
  {
    id: 'colour-mint',
    name: 'Mint Signal',
    category: 'colour',
    price: 600,
    unlockedByDefault: false,
    colour: 0x54ffbf,
  },
  {
    id: 'board-comet',
    name: 'Comet Board',
    category: 'hover-device',
    price: 0,
    unlockedByDefault: true,
    colour: 0xffd84a,
  },
  {
    id: 'board-orbit',
    name: 'Orbit Board',
    category: 'hover-device',
    price: 2_400,
    unlockedByDefault: false,
    colour: 0x9d7dff,
  },
]);
