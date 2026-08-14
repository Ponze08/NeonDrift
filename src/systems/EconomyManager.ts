import {
  CHARACTER_DEFINITIONS,
  COSMETIC_DEFINITIONS,
  type CosmeticDefinition,
} from '../data/characters';
import { SaveManager, type SaveData } from './SaveManager';

export interface EconomyResult {
  readonly ok: boolean;
  readonly reason?: 'unknown-item' | 'already-owned' | 'not-owned' | 'insufficient-coins';
  readonly data: SaveData;
}

export class EconomyManager {
  public constructor(private readonly saves: SaveManager) {}

  public purchaseCharacter(id: string): EconomyResult {
    const item = CHARACTER_DEFINITIONS.find((candidate) => candidate.id === id);
    if (item === undefined) return this.failure('unknown-item');
    const current = this.saves.data;
    if (current.ownedCharacters.includes(id)) return this.failure('already-owned');
    if (current.totalCoins < item.price) return this.failure('insufficient-coins');
    const data = this.saves.update((draft) => {
      draft.totalCoins -= item.price;
      draft.ownedCharacters = [...draft.ownedCharacters, id];
    });
    return { ok: true, data };
  }

  public equipCharacter(id: string): EconomyResult {
    if (!this.saves.data.ownedCharacters.includes(id)) return this.failure('not-owned');
    const data = this.saves.update((draft) => {
      draft.equippedCharacter = id;
    });
    return { ok: true, data };
  }

  public purchaseCosmetic(id: string): EconomyResult {
    const item = COSMETIC_DEFINITIONS.find((candidate) => candidate.id === id);
    if (item === undefined) return this.failure('unknown-item');
    const current = this.saves.data;
    if (current.ownedCosmetics.includes(id)) return this.failure('already-owned');
    if (current.totalCoins < item.price) return this.failure('insufficient-coins');
    const data = this.saves.update((draft) => {
      draft.totalCoins -= item.price;
      draft.ownedCosmetics = [...draft.ownedCosmetics, id];
    });
    return { ok: true, data };
  }

  public equipCosmetic(id: string): EconomyResult {
    const item = COSMETIC_DEFINITIONS.find((candidate) => candidate.id === id);
    if (item === undefined) return this.failure('unknown-item');
    if (!this.saves.data.ownedCosmetics.includes(id)) return this.failure('not-owned');
    const data = this.saves.update((draft) => {
      draft.equippedCosmetics = {
        ...draft.equippedCosmetics,
        [this.equippedKey(item)]: id,
      };
    });
    return { ok: true, data };
  }

  public purchaseHoverDevice(cost = 500): EconomyResult {
    const price = Math.max(0, Math.floor(cost));
    if (this.saves.data.totalCoins < price) return this.failure('insufficient-coins');
    const data = this.saves.update((draft) => {
      draft.totalCoins -= price;
      draft.hoverDeviceInventory += 1;
    });
    return { ok: true, data };
  }

  public consumeHoverDevice(): EconomyResult {
    if (this.saves.data.hoverDeviceInventory <= 0) return this.failure('not-owned');
    const data = this.saves.update((draft) => {
      draft.hoverDeviceInventory = Math.max(0, draft.hoverDeviceInventory - 1);
    });
    return { ok: true, data };
  }

  private equippedKey(item: CosmeticDefinition): 'outfit' | 'colour' | 'hoverDevice' {
    return item.category === 'hover-device' ? 'hoverDevice' : item.category;
  }

  private failure(reason: NonNullable<EconomyResult['reason']>): EconomyResult {
    return { ok: false, reason, data: this.saves.data };
  }
}
