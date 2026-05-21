import { describe, expect, it } from 'vitest';
import { buildPregameMetricsFromCommand } from './pregameMetrics.js';

describe('pregameMetrics', () => {
  it('derives semantic metrics for a shared draft publish command', () => {
    const metrics = buildPregameMetricsFromCommand({
      envelope: {
        commandId: 'cmd-share-1',
        gameId: 'game-1',
        actorId: 'player-1',
        type: 'SendGameChatMessage',
        schemaVersion: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
        payload: {
          body: 'Which direction should this go?',
          artifact: {
            kind: 'CHARACTER_DRAFT',
            characterId: 'char-1',
            snapshotVersion: 3,
            characterName: 'Borin',
            race: 'HUMAN',
            status: 'DRAFT',
            shareIntent: 'COMPARE_DIRECTIONS',
            promptId: 'prompt-1',
            contextNote: 'Fighter 1 or Priest 2?',
            abilitySummary: ['STR 16'],
            skillSummary: ['Fighter 1'],
          },
        },
      },
      effects: {
        writes: [],
      },
    });

    expect(metrics).toEqual([
      {
        metricSchema: 'pregame.v1',
        metricKind: 'counter',
        metricName: 'SHARED_CHARACTER_DRAFT_PUBLISHED',
        metricValue: 1,
        metricUnit: 'Count',
        metricDimensions: {
          artifactKind: 'CHARACTER_DRAFT',
          shareIntent: 'COMPARE_DIRECTIONS',
        },
        metricContext: {
          actorId: 'player-1',
          gameId: 'game-1',
          characterId: 'char-1',
          snapshotVersion: 3,
          promptId: 'prompt-1',
        },
        metricTrace: {
          requestId: null,
          commandId: 'cmd-share-1',
        },
      },
    ]);
  });

  it('skips persisted-save metrics for no-op draft saves', () => {
    const metrics = buildPregameMetricsFromCommand({
      envelope: {
        commandId: 'cmd-save-1',
        gameId: 'game-1',
        actorId: 'player-1',
        type: 'SaveCharacterDraft',
        schemaVersion: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
        payload: {
          characterId: 'char-1',
          race: 'HUMAN',
          raisedBy: null,
          subAbility: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 },
          identity: { name: 'Borin', age: null, gender: null },
          purchases: [],
          cart: { weapons: [], armor: [], shields: [], gear: [] },
        },
      },
      effects: {
        writes: [],
      },
    });

    expect(metrics).toEqual([]);
  });
});
