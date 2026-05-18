import { describe, expect, it } from 'vitest';
import { buildInitialState } from './state.js';
import { buildWizardSaveProgressPayload, toCharacterWizardSnapshot } from './useCharacterWizardWorkflow.js';

describe('buildWizardSaveProgressPayload', () => {
  it('includes the background roll only when the route is background-eligible', () => {
    const state = {
      ...buildInitialState('game-1', 'char-1'),
      race: 'HUMAN' as const,
      name: 'Ducard',
      age: '24',
      gender: 'M',
      backgroundRoll2dTotal: 8,
      merchantScholarChoice: 'MERCHANT' as const,
      purchases: [{ skill: 'Fighter', targetLevel: 1 }],
      submitNoteToGm: 'Ready',
    };

    const payload = buildWizardSaveProgressPayload({
      state,
      snapshot: { status: 'DRAFT', version: 3, subAbility: null, ability: null, skills: [] },
      stepKey: 'background',
      backgroundEligible: true,
      isDwarfPath: false,
      equipmentCart: { weapons: ['mage_staff'], armor: [], shields: [], gear: [] },
    });

    expect(payload.backgroundRoll2dTotal).toBe(8);
    expect(payload.identity).toEqual({
      name: 'Ducard',
      age: 24,
      gender: 'M',
    });
    expect(payload.expectedVersion).toBe(3);
  });

  it('omits the background roll for non-background-eligible routes', () => {
    const state = {
      ...buildInitialState('game-1', 'char-1'),
      race: 'DWARF' as const,
      age: 'unknown',
    };

    const payload = buildWizardSaveProgressPayload({
      state,
      snapshot: null,
      stepKey: 'background',
      backgroundEligible: false,
      isDwarfPath: true,
      equipmentCart: { weapons: [], armor: [], shields: [], gear: [] },
    });

    expect(payload.backgroundRoll2dTotal).toBeUndefined();
    expect(payload.identity.age).toBeNull();
  });
});

describe('toCharacterWizardSnapshot', () => {
  it('maps persisted character fields into the view snapshot shape', () => {
    const snapshot = toCharacterWizardSnapshot({
      gameId: 'game-1',
      characterId: 'char-1',
      status: 'PENDING',
      version: 7,
      draft: {
        subAbility: { A: 6, B: 4, C: 5, D: 4, E: 4, F: 6, G: 4, H: 5 },
        ability: { STR: 14, DEX: 10 },
        skills: [{ skill: 'Fighter', level: 1 }],
      },
    });

    expect(snapshot).toEqual({
      status: 'PENDING',
      version: 7,
      subAbility: { A: 6, B: 4, C: 5, D: 4, E: 4, F: 6, G: 4, H: 5 },
      ability: { STR: 14, DEX: 10 },
      skills: [{ skill: 'Fighter', level: 1 }],
    });
  });
});
