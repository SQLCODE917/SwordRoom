import { describe, expect, it, vi } from 'vitest';
import { buildSaveCharacterDraftEnvelope, buildShareCharacterDraftEnvelope, buildSubmitCharacterForApprovalEnvelope } from './commands.js';

describe('character wizard command builders', () => {
  it('builds a save draft envelope with wizard payload fields', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    const envelope = buildSaveCharacterDraftEnvelope({
      gameId: 'game-1',
      characterId: 'char-1',
      expectedVersion: 4,
      race: 'HUMAN',
      raisedBy: 'HUMANS',
      subAbility: { A: 6, B: 4, C: 5, D: 4, E: 4, F: 6, G: 4, H: 5 },
      backgroundRoll2dTotal: 3,
      startingMoneyRoll2dTotal: 9,
      identity: { name: 'Asha', age: 21, gender: 'F' },
      purchases: [{ skill: 'Fighter', targetLevel: 1 }],
      cart: { weapons: ['mage_staff'], armor: [], shields: [], gear: [] },
      noteToGm: 'Ready',
    });

    expect(envelope.type).toBe('SaveCharacterDraft');
    expect(envelope.gameId).toBe('game-1');
    expect(envelope.payload.characterId).toBe('char-1');
    expect(envelope.payload.expectedVersion).toBe(4);
    expect(envelope.payload.cart.weapons).toEqual(['mage_staff']);
    expect(envelope.createdAt).toBe('2026-03-01T00:00:00.000Z');

    vi.useRealTimers();
  });

  it('builds a submit-for-approval envelope with the expected version', () => {
    const envelope = buildSubmitCharacterForApprovalEnvelope({
      gameId: 'game-1',
      characterId: 'char-1',
      expectedVersion: 7,
    });

    expect(envelope.type).toBe('SubmitCharacterForApproval');
    expect(envelope.payload).toEqual({
      characterId: 'char-1',
      expectedVersion: 7,
    });
  });

  it('builds a share-draft chat envelope with an attached artifact', () => {
    const envelope = buildShareCharacterDraftEnvelope({
      gameId: 'game-1',
      body: 'Sharing Borin for party feedback.',
      artifact: {
        kind: 'CHARACTER_DRAFT',
        characterId: 'char-1',
        snapshotVersion: 4,
        characterName: 'Borin',
        race: 'HUMAN',
        status: 'DRAFT',
        abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
        skillSummary: ['Fighter 1'],
      },
    });

    expect(envelope.type).toBe('SendGameChatMessage');
    expect(envelope.payload.artifact?.snapshotVersion).toBe(4);
    expect(envelope.payload.body).toBe('Sharing Borin for party feedback.');
  });
});
