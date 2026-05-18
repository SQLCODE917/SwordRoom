import type { CharacterCreationState, EquipmentCart } from '@starter/engine';
import type { CharacterDraft, CharacterItem, CharacterRace, RaisedBy } from '@starter/shared';
import { resolveEquipmentRosterItem } from '@starter/shared';
import { loadItemCatalog } from './shared.js';

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
          moneyRoll2d: previous.draft.starting.moneyRoll2d,
          startingSkills: state.startingPackage.startingSkills,
        }
      : previous.draft.starting,
    background: state.startingPackage
      ? {
          kind: toBackgroundKind(state.startingPackage),
          roll2d: state.startingPackage.backgroundRoll2dTotal ?? null,
        }
      : previous.draft.background,
    skills: state.skills,
    purchases: state.equipmentCart
      ? toPurchaseDraft(state.equipmentCart, loadItemCatalog(), state.ability?.str ?? 0)
      : previous.draft.purchases,
    identity: {
      ...previous.draft.identity,
      name: state.identity?.name ?? previous.draft.identity.name,
      age: state.identity?.age ?? previous.draft.identity.age,
      gender: state.identity?.gender ?? previous.draft.identity.gender,
    },
    noteToGm: previous.draft.noteToGm ?? null,
    gmNote: previous.draft.gmNote ?? null,
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
    appearance: { imageKey: null, imageUrl: null, updatedAt: null },
    identity: { name: 'Unnamed', age: null, gender: null },
    noteToGm: null,
    gmNote: null,
  };
}

export function toEquipmentCart(cart: Record<string, unknown>): EquipmentCart {
  return {
    weapons: toStringArray(cart.weapons),
    armor: toStringArray(cart.armor),
    shields: toStringArray(cart.shields),
    gear: toStringArray(cart.gear),
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function toPurchaseDraft(
  cart: EquipmentCart,
  itemCatalog: ReturnType<typeof loadItemCatalog>,
  characterStrength: number
): CharacterDraft['purchases'] {
  const mapItem = (itemId: string) => {
    const resolved = resolveEquipmentRosterItem(itemId, characterStrength);
    return {
      itemId,
      reqStr: Number(resolved?.effectiveReqStr ?? itemCatalog[itemId]?.req_str ?? 0),
      costGamels: Number(resolved?.costGamels ?? itemCatalog[itemId]?.cost_g ?? 0),
    };
  };

  const aggregatedGear = new Map<string, { qty: number; costGamels: number }>();
  for (const itemId of cart.gear) {
    const resolved = resolveEquipmentRosterItem(itemId, characterStrength);
    const existing = aggregatedGear.get(itemId) ?? { qty: 0, costGamels: 0 };
    aggregatedGear.set(itemId, {
      qty: existing.qty + 1,
      costGamels: existing.costGamels + Number(resolved?.costGamels ?? itemCatalog[itemId]?.cost_g ?? 0),
    });
  }

  return {
    weapons: cart.weapons.map(mapItem),
    armor: cart.armor.map(mapItem),
    shields: cart.shields.map(mapItem),
    gear: [...aggregatedGear.entries()].map(([itemId, value]) => ({ itemId, qty: value.qty, costGamels: value.costGamels })),
  };
}

function toBackgroundKind(
  startingPackage: CharacterCreationState['startingPackage']
): CharacterDraft['background']['kind'] {
  if (!startingPackage?.backgroundName) {
    return null;
  }

  const normalized = startingPackage.backgroundName.trim().toUpperCase();
  if (normalized === 'MERCHANT / SCHOLAR' || normalized === 'MERCHANT/SCHOLAR') {
    return startingPackage.startingSkills.some((skill) => skill.skill === 'Merchant') ? 'MERCHANT' : 'SCHOLAR';
  }

  return normalized.replace(/\s+/g, '_') as CharacterDraft['background']['kind'];
}
