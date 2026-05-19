import { describe, expect, it } from 'vitest';
import { buildInitialState } from './state.js';
import { createCharacterWizardViewModel } from './viewModel.js';
import type { CharacterSnapshot } from './types.js';

describe('character wizard view model', () => {
  it('derives preview state for a draft in apply mode', () => {
    const state = {
      ...buildInitialState('game-1', 'char-1'),
      name: 'Asha',
    };

    const view = createCharacterWizardViewModel({
      state,
      snapshot: null,
      isExecutingCommand: false,
      lastSavedFingerprint: null,
      wizardMode: 'apply',
    });

    expect(view.finalActionLabel).toBe('Submit Character For Approval');
    expect(view.nameError).toBe(' ');
    expect(view.backgroundLabel.length).toBeGreaterThan(0);
  });

  it('disables editing when the snapshot is pending', () => {
    const snapshot: CharacterSnapshot = {
      status: 'PENDING',
      version: 3,
      subAbility: null,
      ability: null,
      skills: [],
    };

    const view = createCharacterWizardViewModel({
      state: buildInitialState('game-1', 'char-1'),
      snapshot,
      isExecutingCommand: false,
      lastSavedFingerprint: null,
      wizardMode: 'apply',
    });

    expect(view.canEditDraft).toBe(false);
    expect(view.finalActionLabel).toBe('Submitted For Review');
  });
});
