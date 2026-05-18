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

export function loadItemCatalog(): Record<string, { category: string; req_str?: number; req_str_min?: number; req_str_max?: number | null; cost_g?: number; price_spec?: string | number; tags?: string[]; usage?: string; used_for?: string }> {
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
