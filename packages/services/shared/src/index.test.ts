import { describe, expect, it } from 'vitest';
import { dbKeys, loadVerticalSliceFixturesText } from './index.js';

describe('services/shared', () => {
  it('provides deterministic db key helpers', () => {
    expect(dbKeys.commandLogPk('g1', 'c1')).toBe('GAME#g1#CMD#c1');
    expect(dbKeys.characterPk('g1', 'ch1')).toBe('GAME#g1#CHAR#ch1');
    expect(dbKeys.inboxPk('g1', 'p1')).toBe('GAME#g1#INBOX#p1');
  });

  it('loads source-of-truth fixtures', () => {
    const text = loadVerticalSliceFixturesText();
    expect(text).toContain('command_sequences_for_integration:');
    expect(text).toContain('e2e.good.human_rune_master_sequence');
  });
});
