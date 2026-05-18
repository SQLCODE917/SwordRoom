import { equipmentRosterById, resolveEquipmentRosterItem, startingPackageTables as sharedStartingPackageTables } from '@starter/shared';
import {
  applyStartingPackage,
  computeAbilitiesAndBonuses,
  purchaseEquipment,
  spendStartingExp,
  type CharacterCreationState,
  type EquipmentCart,
  type StartingPackageTables,
} from '@starter/engine';
import { isPlayerCharacterLibraryGameId, type CharacterItem } from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';

export async function requireCharacter(db: DbAccess, gameId: string, characterId: string): Promise<CharacterItem> {
  const character = await db.characterRepository.getCharacter(gameId, characterId);
  if (!character) {
    throw new Error(`character not found: ${gameId}/${characterId}`);
  }
  return character;
}

export async function assertActorCanCreateCharacterInGame(
  db: DbAccess,
  input: { gameId: string; actorId: string; existingCharacterId?: string | null }
): Promise<void> {
  if (isPlayerCharacterLibraryGameId(input.gameId)) {
    return;
  }

  const existing = await db.characterRepository.findOwnedCharacterInGame(input.gameId, input.actorId);
  if (!existing || existing.characterId === input.existingCharacterId) {
    return;
  }

  const error = new Error(
    `player "${input.actorId}" already has character "${existing.characterId}" in game "${input.gameId}"`
  );
  (error as Error & { code?: string }).code = 'PLAYER_ALREADY_HAS_CHARACTER_IN_GAME';
  throw error;
}

export function throwOnEngineErrors(errors: Array<{ code: string; message: string }>): void {
  if (errors.length > 0) {
    const first = errors[0];
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }
}

export function loadStartingPackageTables(): StartingPackageTables {
  return sharedStartingPackageTables as StartingPackageTables;
}

function loadItemCatalogRaw(): Record<string, { category: string; req_str?: number; req_str_min?: number; req_str_max?: number | null; cost_g?: number; price_spec?: string | number; tags?: string[]; usage?: string; used_for?: string }> {
  return Object.fromEntries(
    Object.values(equipmentRosterById).map((item) => {
      const resolved = resolveEquipmentRosterItem(item.itemId, 10);
      return [
        item.itemId,
        {
          category: item.category,
          req_str: resolved?.effectiveReqStr ?? 0,
          req_str_min: resolved?.reqStrMin ?? 0,
          req_str_max: resolved?.reqStrMax ?? null,
          cost_g: resolved?.costGamels ?? 0,
          price_spec: item.priceSpec,
          tags: item.tags ?? [],
          usage: item.usage,
          used_for: item.usedFor,
        },
      ];
    })
  );
}

export function loadItemCatalog(): Record<string, { category: string; req_str?: number; req_str_min?: number; req_str_max?: number | null; cost_g?: number; price_spec?: string | number; tags?: string[]; usage?: string; used_for?: string }> {
  return loadItemCatalogRaw();
}

export function computeAndValidate(state: CharacterCreationState): CharacterCreationState {
  const computed = computeAbilitiesAndBonuses(state);
  throwOnEngineErrors(computed.errors);
  return computed.state;
}

export function applyStartingAndValidate(
  state: CharacterCreationState,
  input: {
    backgroundRoll2dTotal?: number;
    startingMoneyRoll2dTotal?: number;
    useOrdinaryCitizenShortcut?: boolean;
    craftsmanSkill?: string;
    merchantScholarChoice?: 'MERCHANT' | 'SAGE';
    generalSkillName?: string;
  }
): CharacterCreationState {
  const result = applyStartingPackage(state, input, loadStartingPackageTables());
  throwOnEngineErrors(result.errors);
  return result.state;
}

export function spendExpAndValidate(
  state: CharacterCreationState,
  input: { purchases: Array<{ skill: string; targetLevel: number }> }
): CharacterCreationState {
  const result = spendStartingExp(state, input);
  throwOnEngineErrors(result.errors);
  return result.state;
}

export function purchaseAndValidate(state: CharacterCreationState, cart: EquipmentCart): CharacterCreationState {
  const result = purchaseEquipment(state, { cart }, loadItemCatalog());
  throwOnEngineErrors(result.errors);
  return result.state;
}
