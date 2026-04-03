import { describe, expect, it } from 'vitest';
import { loadVerticalSliceFixturesYamlText } from '@starter/shared/fixtures';
import { commandLogKeys, gameStateKeys } from './index.js';

describe('services/shared', () => {
  it('re-exports deterministic db key helpers from @starter/shared', () => {
    expect(commandLogKeys.command('c1')).toEqual({ pk: 'COMMAND#c1', sk: 'METADATA' });
    expect(gameStateKeys.character('g1', 'ch1')).toEqual({ pk: 'GAME#g1', sk: 'CHAR#ch1' });
    expect(gameStateKeys.playerInboxItem('p1', '2026-03-01T00:00:00.000Z', 'prompt-1')).toEqual({
      pk: 'PLAYER#p1',
      sk: 'INBOX#2026-03-01T00:00:00.000Z#prompt-1',
    });
  });

  it('loads source-of-truth fixtures', () => {
    const text = loadVerticalSliceFixturesYamlText();
    expect(text).toContain('command_sequences_for_integration:');
    expect(text).toContain('e2e.good.human_rune_master_sequence');
  });
});
