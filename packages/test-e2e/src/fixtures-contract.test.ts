import { describe, expect, it } from 'vitest';
import { loadVerticalSliceFixturesYamlText } from '@starter/shared';

describe('e2e fixture contract checks', () => {
  it('contains integration command sequence for approval flow', () => {
    const text = loadVerticalSliceFixturesYamlText();

    expect(text).toContain('command_sequences_for_integration:');
    expect(text).toContain('id: e2e.good.human_rune_master_sequence');
    expect(text).toContain('type: "SaveCharacterDraft"');
    expect(text).toContain('type: "SubmitCharacterForApproval"');
    expect(text).toContain('type: "GMReviewCharacter"');
  });

  it('contains required good and bad fixtures for deterministic verification', () => {
    const text = loadVerticalSliceFixturesYamlText();

    expect(text).toContain('id: good.dwarf_race_starting_package');
    expect(text).toContain('id: bad.sorcerer_only_discount_when_neither');
    expect(text).toContain('code: "EQUIPMENT_REQ_STR_TOO_HIGH"');
  });
});
