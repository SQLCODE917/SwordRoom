import { describe, expect, it } from 'vitest';
import type { CharacterItem } from '../../api/ApiClient';
import {
  buildEquipmentCart,
  buildInitialState,
  hydrateWizardStateFromCharacter,
  serializeWizardState,
  toInventoryQuantitiesFromIds,
} from './state.js';

describe('character wizard state helpers', () => {
  it('builds a stable initial wizard state', () => {
    const state = buildInitialState('game-1', 'char-1');
    expect(state.gameId).toBe('game-1');
    expect(state.characterId).toBe('char-1');
    expect(state.submitNoteToGm).toBe('Ready for review');
  });

  it('hydrates wizard state from a saved character and preserves quantities', () => {
    const fallback = buildInitialState('game-1', 'char-1');
    const state = hydrateWizardStateFromCharacter(createCharacter(), fallback);

    expect(state.name).toBe('Asha');
    expect(state.purchases).toEqual([{ skill: 'Fighter', targetLevel: 1 }]);
    expect(state.equipment.weaponQuantities).toEqual({ mage_staff: 1 });
    expect(state.equipment.gearQuantities).toEqual({ rope_10_meters: 2 });
  });

  it('serializes and flattens equipment quantities consistently', () => {
    const state = buildInitialState('game-1', 'char-1');
    const withGear = {
      ...state,
      equipment: {
        ...state.equipment,
        gearQuantities: toInventoryQuantitiesFromIds(['rope_10_meters', 'rope_10_meters']),
      },
    };

    expect(buildEquipmentCart(withGear.equipment).gear).toEqual(['rope_10_meters', 'rope_10_meters']);
    expect(typeof serializeWizardState(withGear)).toBe('string');
  });
});

function createCharacter(): CharacterItem {
  return {
    gameId: 'game-1',
    characterId: 'char-1',
    ownerPlayerId: 'player-1',
    status: 'DRAFT',
    version: 2,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    draft: {
      race: 'HUMAN',
      raisedBy: null,
      subAbility: { A: 6, B: 4, C: 5, D: 4, E: 4, F: 6, G: 4, H: 5 },
      ability: { dex: 10, agi: 11, int: 12, str: 13, lf: 14, mp: 15 },
      bonus: { dex: 0, agi: 1, int: 1, str: 1, lf: 2, mp: 2 },
      background: { kind: 'FARMER', roll2d: 3 },
      starting: {
        expTotal: 3000,
        expUnspent: 2000,
        moneyGamels: 1200,
        moneyRoll2d: 9,
        startingSkills: [{ skill: 'Sorcerer', level: 1 }],
      },
      skills: [
        { skill: 'Sorcerer', level: 1 },
        { skill: 'Fighter', level: 1 },
      ],
      purchases: {
        weapons: [{ itemId: 'mage_staff', reqStr: 10, costGamels: 200 }],
        armor: [],
        shields: [],
        gear: [{ itemId: 'rope_10_meters', qty: 2, costGamels: 20 }],
      },
      appearance: { imageKey: null, imageUrl: null, updatedAt: null },
      identity: { name: 'Asha', age: 21, gender: 'F' },
      noteToGm: 'Ready',
      gmNote: null,
    },
  } as CharacterItem;
}
