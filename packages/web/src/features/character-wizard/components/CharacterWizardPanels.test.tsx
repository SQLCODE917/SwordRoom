import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CharacterWizardAutofillControls, ShareCheckpointPanel } from './CharacterWizardPanels.js';

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

describe('ShareCheckpointPanel', () => {
  it('disables answer-gm-prompt when no active prompt exists and forwards question edits', () => {
    const onShareIntentChange = vi.fn();
    const onShareNoteChange = vi.fn();
    const onShare = vi.fn();

    render(
      <ShareCheckpointPanel
        isExecutingCommand={false}
        shareState="idle"
        canShare={true}
        activeStepTitle="Background rolls"
        shareIntent="ASK_QUESTION"
        shareNote=""
        activePrompt={null}
        onShareIntentChange={onShareIntentChange}
        onShareNoteChange={onShareNoteChange}
        onShare={onShare}
      />
    );

    expect((screen.getByLabelText('Answer GM prompt') as HTMLInputElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Question for chat'), {
      target: { value: 'Does this cover healing well enough?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Share Update' }));

    expect(onShareNoteChange).toHaveBeenCalledWith('Does this cover healing well enough?');
    expect(onShare).toHaveBeenCalled();
  });

  it('renders compare-directions copy when that share intent is selected', () => {
    render(
      <ShareCheckpointPanel
        isExecutingCommand={false}
        shareState="idle"
        canShare={true}
        activeStepTitle="EXP spend"
        shareIntent="COMPARE_DIRECTIONS"
        shareNote="Option A keeps Priest 2, option B swaps to Fighter 1."
        activePrompt={null}
        onShareIntentChange={() => undefined}
        onShareNoteChange={() => undefined}
        onShare={() => undefined}
      />
    );

    expect(screen.getByLabelText('Directions to compare')).toBeTruthy();
    expect(screen.getByText('Describe the two directions you want feedback on, such as role, risk, or tone.')).toBeTruthy();
  });
});
