import { describe, expect, it, vi } from 'vitest';
import { buildPostGamePromptEnvelope, buildSharePartyRoleClaimEnvelope, buildSuggestedGamePromptArtifact } from './commands.js';

describe('pregame planning command builders', () => {
  it('builds a party role claim envelope with an attached artifact', () => {
    const envelope = buildSharePartyRoleClaimEnvelope({
      gameId: 'game-1',
      body: 'Borin is claiming Frontline for the party.',
      artifact: {
        kind: 'PARTY_ROLE_CLAIM',
        claimId: 'claim-1',
        characterId: 'char-1',
        snapshotVersion: 4,
        characterName: 'Borin',
        roles: ['FRONTLINE'],
        note: 'Current plan is to cover Frontline.',
      },
    });

    expect(envelope.type).toBe('SendGameChatMessage');
    expect(envelope.payload.artifact?.kind).toBe('PARTY_ROLE_CLAIM');
    expect(envelope.payload.body).toBe('Borin is claiming Frontline for the party.');
  });

  it('builds a suggested GM prompt artifact from open roles', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    const prompt = buildSuggestedGamePromptArtifact({
      suggestedRoles: ['FRONTLINE', 'HEALER'],
    });

    expect(prompt.body).toBe('GM posted a new pregame planning prompt.');
    expect(prompt.artifact.kind).toBe('GAME_PROMPT');
    expect(prompt.artifact.title).toBe('Party needs Frontline and Healer');
    expect(prompt.artifact.suggestedRoles).toEqual(['FRONTLINE', 'HEALER']);

    const envelope = buildPostGamePromptEnvelope({
      gameId: 'game-1',
      body: prompt.body,
      artifact: prompt.artifact,
    });

    expect(envelope.type).toBe('SendGameChatMessage');
    expect(envelope.payload.artifact?.kind).toBe('GAME_PROMPT');

    vi.useRealTimers();
  });
});
