import {
  applyStartingPackage,
  computeAbilitiesAndBonuses,
  purchaseEquipment,
  spendStartingExp,
  type CharacterCreationState,
  type EquipmentCart,
  type StartingPackageTables,
} from '@starter/engine';
import {
  loadVerticalSliceFixtures,
  type CharacterDraft,
  type CharacterItem,
  type CharacterRace,
  type RaisedBy,
} from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';

export async function requireCharacter(db: DbAccess, gameId: string, characterId: string): Promise<CharacterItem> {
  const character = await db.characterRepository.getCharacter(gameId, characterId);
  if (!character) {
    throw new Error(`character not found: ${gameId}/${characterId}`);
  }
  return character;
}

export function toCharacterDraft(previous: CharacterItem, state: CharacterCreationState): CharacterDraft {
  return {
    ...previous.draft,
    race: state.race ?? previous.draft.race,
    raisedBy: state.raisedBy ?? previous.draft.raisedBy,
    subAbility: state.subAbility ?? previous.draft.subAbility,
    ability: state.ability ?? previous.draft.ability,
    bonus: state.bonus ?? previous.draft.bonus,
    starting: state.startingPackage
      ? {
          expTotal: state.startingPackage.startingExpTotal,
          expUnspent: state.startingPackage.expUnspent,
          moneyGamels: state.startingPackage.startingMoneyGamels,
          moneyRoll2d: state.startingPackage.backgroundRoll2dTotal ?? null,
          startingSkills: state.startingPackage.startingSkills,
        }
      : previous.draft.starting,
    skills: state.skills,
    purchases: state.equipmentCart
      ? toPurchaseDraft(state.equipmentCart, loadItemCatalogRaw())
      : previous.draft.purchases,
    identity: {
      ...previous.draft.identity,
      name: state.identity?.name ?? previous.draft.identity.name,
      age: state.identity?.age ?? previous.draft.identity.age,
      gender: state.identity?.gender ?? previous.draft.identity.gender,
    },
  };
}

export function toEngineState(character: CharacterItem): CharacterCreationState {
  return {
    characterId: character.characterId,
    race: character.draft.race,
    raisedBy: character.draft.raisedBy,
    subAbility: character.draft.subAbility,
    ability: character.draft.ability,
    bonus: character.draft.bonus,
    skills: character.draft.skills,
    identity: character.draft.identity,
    status: character.status,
    completeness: character.status !== 'DRAFT',
    equipmentCart: {
      weapons: character.draft.purchases.weapons.map((item) => item.itemId),
      armor: character.draft.purchases.armor.map((item) => item.itemId),
      shields: character.draft.purchases.shields.map((item) => item.itemId),
      gear: character.draft.purchases.gear.map((item) => item.itemId),
    },
    startingPackage: {
      source: 'BACKGROUND_TABLE_1_5',
      startingSkills: character.draft.starting.startingSkills,
      startingExpTotal: character.draft.starting.expTotal,
      expUnspent: character.draft.starting.expUnspent,
      startingMoneyGamels: character.draft.starting.moneyGamels,
      backgroundRoll2dTotal: character.draft.background.roll2d ?? undefined,
      backgroundName: character.draft.background.kind ?? undefined,
      restrictions: [],
    },
  };
}

export function emptyCharacterDraft(race: string, raisedBy: string | null): CharacterDraft {
  return {
    race: toRaceCode(race),
    raisedBy: toRaisedBy(raisedBy),
    subAbility: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 },
    ability: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
    bonus: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
    background: { kind: null, roll2d: null },
    starting: {
      expTotal: 0,
      expUnspent: 0,
      moneyGamels: 0,
      moneyRoll2d: null,
      startingSkills: [],
    },
    skills: [],
    purchases: { weapons: [], armor: [], shields: [], gear: [] },
    identity: { name: 'Unnamed', age: null, gender: null },
    gmNote: null,
  };
}

function toRaceCode(race: string): CharacterRace {
  if (race === 'HUMAN' || race === 'DWARF' || race === 'GRASSRUNNER' || race === 'ELF' || race === 'HALF_ELF') {
    return race;
  }
  throw new Error(`invalid race: ${race}`);
}

function toRaisedBy(raisedBy: string | null): RaisedBy {
  if (raisedBy === 'HUMANS' || raisedBy === 'ELVES' || raisedBy === null) {
    return raisedBy;
  }
  return null;
}

export function throwOnEngineErrors(errors: Array<{ code: string; message: string }>): void {
  if (errors.length > 0) {
    const first = errors[0];
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }
}

export function toEquipmentCart(cart: Record<string, unknown>): EquipmentCart {
  return {
    weapons: toStringArray(cart.weapons),
    armor: toStringArray(cart.armor),
    shields: toStringArray(cart.shields),
    gear: toStringArray(cart.gear),
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function toPurchaseDraft(
  cart: EquipmentCart,
  itemCatalog: Record<string, { req_str?: number; cost_g?: number }>
): CharacterDraft['purchases'] {
  const mapItem = (itemId: string) => ({
    itemId,
    reqStr: Number(itemCatalog[itemId]?.req_str ?? 0),
    costGamels: Number(itemCatalog[itemId]?.cost_g ?? 0),
  });

  return {
    weapons: cart.weapons.map(mapItem),
    armor: cart.armor.map(mapItem),
    shields: cart.shields.map(mapItem),
    gear: cart.gear.map((itemId) => ({ itemId, qty: 1, costGamels: Number(itemCatalog[itemId]?.cost_g ?? 0) })),
  };
}

export function loadStartingPackageTables(): StartingPackageTables {
  const fixtures = loadVerticalSliceFixtures() as Record<string, unknown>;
  const refs = fixtures.rulebook_context_refs as Record<string, any>;
  return {
    backgroundsRows: (refs.backgrounds_table_1_5?.rows ?? {}) as Record<string, any>,
    raceRows: (refs.starting_experience_by_race_table_1_6?.rows ?? {}) as Record<string, any>,
  };
}

function loadItemCatalogRaw(): Record<string, { category: string; req_str?: number; cost_g?: number; tags?: string[] }> {
  const fixtures = loadVerticalSliceFixtures() as Record<string, unknown>;
  const engineContract = fixtures.engine_contract as Record<string, any>;
  const rules = engineContract.minimal_item_catalog_rules_for_slice as Record<string, any>;
  return (rules.items ?? {}) as Record<string, { category: string; req_str?: number; cost_g?: number; tags?: string[] }>;
}

export function loadItemCatalog(): Record<string, { category: string; req_str?: number; tags?: string[] }> {
  const raw = loadItemCatalogRaw();
  const out: Record<string, { category: string; req_str?: number; tags?: string[] }> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = { category: value.category, req_str: value.req_str, tags: value.tags };
  }
  return out;
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
