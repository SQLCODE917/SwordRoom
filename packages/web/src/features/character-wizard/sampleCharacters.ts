import type { CharacterDraft } from '@starter/shared';
import { toPlayerCharacterLibraryGameId } from '@starter/shared/contracts/db';
import { resolveEquipmentRosterItem } from '@starter/shared/rules/equipmentRoster';
import type { CharacterItem } from '../../api/ApiClient';
import { computeSkillPurchasePreview, computeStartingPackagePreview } from '../../data/characterCreationPurchasing';
import { goodHumanRuneMasterAutofill } from './commands.js';

export const DUCARD_SAMPLE_CHARACTER_ID = 'ducard-sample-ii';

export function appendBuiltInSavedCharacters(actorId: string | null, characters: CharacterItem[]): CharacterItem[] {
  if (!actorId || characters.some((item) => item.characterId === DUCARD_SAMPLE_CHARACTER_ID)) {
    return characters;
  }

  return [createDucardSampleCharacter(actorId), ...characters];
}

function createDucardSampleCharacter(actorId: string): CharacterItem {
  return {
    gameId: toPlayerCharacterLibraryGameId(actorId),
    characterId: DUCARD_SAMPLE_CHARACTER_ID,
    ownerPlayerId: actorId,
    status: 'DRAFT',
    version: 1,
    draft: buildDucardSampleDraft(),
  };
}

function buildDucardSampleDraft(): CharacterDraft {
  const sample = goodHumanRuneMasterAutofill;
  const starting = computeStartingPackagePreview({
    characterId: DUCARD_SAMPLE_CHARACTER_ID,
    race: sample.race,
    raisedBy: sample.raisedBy,
    subAbility: sample.subAbility,
    backgroundRoll2dTotal: sample.backgroundRoll2dTotal,
    startingMoneyRoll2dTotal: sample.startingMoneyRoll2dTotal,
  });
  const purchased = computeSkillPurchasePreview(starting.state, sample.purchases);
  const strength = starting.state?.ability?.str ?? 0;

  return {
    race: sample.race,
    raisedBy: null,
    subAbility: { ...sample.subAbility },
    ability: starting.state?.ability ?? zeroAbility(),
    bonus: starting.state?.bonus ?? zeroAbility(),
    background: {
      kind: 'RUNE_MASTER',
      roll2d: sample.backgroundRoll2dTotal,
    },
    starting: {
      expTotal: starting.expTotal,
      expUnspent: purchased.expUnspent,
      moneyGamels: starting.moneyGamels,
      moneyRoll2d: sample.startingMoneyRoll2dTotal,
      startingSkills: starting.startingSkills,
    },
    skills: purchased.skills,
    purchases: {
      weapons: toPurchasedItems(sample.cart.weapons, strength),
      armor: toPurchasedItems(sample.cart.armor, strength),
      shields: toPurchasedItems(sample.cart.shields, strength),
      gear: toPurchasedGear(sample.cart.gear, strength),
    },
    identity: {
      name: sample.identity.name,
      age: Number(sample.identity.age),
      gender: sample.identity.gender,
    },
    noteToGm: sample.submitNoteToGm,
    gmNote: null,
  };
}

function zeroAbility() {
  return { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 };
}

function toPurchasedItems(itemIds: string[], strength: number): CharacterDraft['purchases']['weapons'] {
  return itemIds.map((itemId) => {
    const item = resolveEquipmentRosterItem(itemId, strength);
    return {
      itemId,
      reqStr: item?.effectiveReqStr ?? 0,
      costGamels: item?.costGamels ?? 0,
    };
  });
}

function toPurchasedGear(itemIds: string[], strength: number): CharacterDraft['purchases']['gear'] {
  return itemIds.map((itemId) => {
    const item = resolveEquipmentRosterItem(itemId, strength);
    return {
      itemId,
      qty: 1,
      costGamels: item?.costGamels ?? 0,
    };
  });
}
