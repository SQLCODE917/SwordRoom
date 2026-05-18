import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CharacterWizardAutofillControls } from './CharacterWizardPanels.js';

describe('CharacterWizardAutofillControls', () => {
  it('omits the current draft from saved-character autofill options and forwards selection', () => {
    const onSelectSavedCharacter = vi.fn();

    render(
      <CharacterWizardAutofillControls
        isExecutingCommand={false}
        savedCharacters={[
          {
            gameId: 'game-1',
            characterId: 'char-1',
            status: 'DRAFT',
            draft: { identity: { name: 'Current Draft' } },
          },
          {
            gameId: 'game-1',
            characterId: 'char-2',
            status: 'APPROVED',
            draft: { identity: { name: 'Reusable Hero' } },
          },
        ]}
        selectedSavedCharacterId=""
        currentCharacterId="char-1"
        onAutofillFixture={() => undefined}
        onSelectSavedCharacter={onSelectSavedCharacter}
      />
    );

    const select = screen.getByLabelText('Autofill from saved character');
    expect(screen.queryByRole('option', { name: 'Current Draft (DRAFT)' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Reusable Hero (APPROVED)' })).toBeTruthy();

    fireEvent.change(select, { target: { value: 'char-2' } });

    expect(onSelectSavedCharacter).toHaveBeenCalledWith('char-2');
  });
});
