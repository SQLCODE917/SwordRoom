import { describe, expect, it } from 'vitest';
import type { CharacterItem } from '@starter/shared';
import { emptyCharacterDraft, toCharacterDraft, toEngineState, toEquipmentCart } from './mappers.js';

describe('character creation mappers', () => {
  it('maps persisted character drafts into engine state', () => {
    const character = createCharacter();

    expect(toEngineState(character)).toEqual({
      characterId: 'char-1',
      race: 'HUMAN',
      raisedBy: null,
      subAbility: character.draft.subAbility,
      ability: character.draft.ability,
      bonus: character.draft.bonus,
      skills: character.draft.skills,
      identity: character.draft.identity,
      status: 'DRAFT',
      completeness: false,
      equipmentCart: {
        weapons: ['mage_staff'],
        armor: [],
        shields: [],
        gear: ['rope_10_meters'],
      },
      startingPackage: {
        source: 'BACKGROUND_TABLE_1_5',
        startingSkills: character.draft.starting.startingSkills,
        startingExpTotal: character.draft.starting.expTotal,
        expUnspent: character.draft.starting.expUnspent,
        startingMoneyGamels: character.draft.starting.moneyGamels,
        backgroundRoll2dTotal: 5,
        backgroundName: 'FARMER',
        restrictions: [],
      },
    });
  });

  it('maps engine state back into persisted draft purchases and identity', () => {
    const character = createCharacter();
    const nextDraft = toCharacterDraft(character, {
      ...toEngineState(character),
      ability: { ...character.draft.ability, str: 16 },
      identity: { name: 'Updated Hero', age: 22, gender: 'F' },
      equipmentCart: {
        weapons: ['mage_staff'],
        armor: [],
        shields: [],
        gear: ['rope_10_meters', 'rope_10_meters'],
      },
    });

    expect(nextDraft.identity).toEqual({ name: 'Updated Hero', age: 22, gender: 'F' });
    expect(nextDraft.purchases.weapons).toEqual([{ itemId: 'mage_staff', reqStr: 10, costGamels: 200 }]);
    expect(nextDraft.purchases.gear).toEqual([{ itemId: 'rope_10_meters', qty: 2, costGamels: 20 }]);
  });

  it('builds empty drafts and equipment carts from app payload shapes', () => {
    expect(emptyCharacterDraft('HUMAN', null).identity.name).toBe('Unnamed');
    expect(
      toEquipmentCart({
        weapons: ['mage_staff'],
        gear: ['rope_10_meters', 'rope_10_meters'],
      })
    ).toEqual({
      weapons: ['mage_staff'],
      armor: [],
      shields: [],
      gear: ['rope_10_meters', 'rope_10_meters'],
    });
  });
});

function createCharacter(): CharacterItem {
  return {
    pk: 'GAME#game-1',
    sk: 'CHAR#char-1',
    type: 'Character',
    gameId: 'game-1',
    characterId: 'char-1',
    ownerPlayerId: 'player-1',
    status: 'DRAFT',
    draft: {
      race: 'HUMAN',
      raisedBy: null,
      subAbility: { A: 6, B: 8, C: 5, D: 5, E: 9, F: 7, G: 3, H: 4 },
      ability: { dex: 12, agi: 11, int: 10, str: 16, lf: 14, mp: 8 },
      bonus: { dex: 2, agi: 1, int: 1, str: 3, lf: 2, mp: 1 },
      background: { kind: 'FARMER', roll2d: 5 },
      starting: {
        expTotal: 3000,
        expUnspent: 500,
        moneyGamels: 1200,
        moneyRoll2d: 9,
        startingSkills: [{ skill: 'Fencer', level: 1 }],
      },
      skills: [{ skill: 'Fencer', level: 1 }],
      purchases: {
        weapons: [{ itemId: 'mage_staff', reqStr: 10, costGamels: 200 }],
        armor: [],
        shields: [],
        gear: [{ itemId: 'rope_10_meters', qty: 1, costGamels: 10 }],
      },
      appearance: { imageKey: null, imageUrl: null, updatedAt: null },
      identity: { name: 'Asha', age: 21, gender: 'F' },
      noteToGm: null,
      gmNote: null,
    },
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    version: 1,
  };
}
