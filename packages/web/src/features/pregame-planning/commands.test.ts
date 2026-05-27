import { describe, expect, it, vi } from 'vitest';
import { buildGamePromptArtifact, buildPostGamePromptEnvelope, buildSharePartyRoleClaimEnvelope } from './commands.js';

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

  it('builds a GM prompt artifact from freeform text', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    const prompt = buildGamePromptArtifact({
      prompt: 'Need a thief with city contacts and a temple tie-in for this session.',
    });

    expect(prompt.body).toBe('GM posted a new pregame planning prompt.');
    expect(prompt.artifact.kind).toBe('GAME_PROMPT');
    expect(prompt.artifact.title).toBe('Need a thief with city contacts and a temple tie-in for this session.');
    expect(prompt.artifact.suggestedRoles).toEqual([]);

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
