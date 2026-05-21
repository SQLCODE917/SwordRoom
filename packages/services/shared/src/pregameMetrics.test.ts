import { describe, expect, it } from 'vitest';
import {
  buildPregameMetricsFromCommand,
  buildPregameMetricsFromObservation,
  buildPregameMetricsFromObservationSessionSummary,
} from './pregameMetrics.js';

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

  it('emits a creator session metric when a creator session first becomes observable', () => {
    const metrics = buildPregameMetricsFromObservation({
      observation: {
        surface: 'creator',
        sessionId: 'creator-session-1',
        sessionStartedAt: '2026-05-21T18:00:00.000Z',
        sessionStart: true,
        entrySource: 'chat',
        entryFocus: 'prompt',
        wizardMode: 'apply',
        draftMode: 'existing',
        gameId: 'game-1',
        characterId: 'char-1',
      },
      actorId: 'player-1',
      requestId: 'req-1',
      path: '/games/game-1/characters/char-1/edit',
    });

    expect(metrics).toEqual([
      {
        metricSchema: 'pregame.v1',
        metricKind: 'counter',
        metricName: 'CREATOR_SESSION_STARTED',
        metricValue: 1,
        metricUnit: 'Count',
        metricDimensions: {
          surface: 'creator',
          entrySource: 'chat',
          entryFocus: 'prompt',
          wizardMode: 'apply',
          draftMode: 'existing',
        },
        metricContext: {
          actorId: 'player-1',
          gameId: 'game-1',
          characterId: 'char-1',
          creatorSessionId: 'creator-session-1',
          creatorSessionStartedAt: '2026-05-21T18:00:00.000Z',
          path: '/games/game-1/characters/char-1/edit',
        },
        metricTrace: {
          requestId: 'req-1',
          commandId: null,
        },
      },
    ]);
  });

  it('emits completion and active-duration metrics for a creator session summary', () => {
    const metrics = buildPregameMetricsFromObservationSessionSummary({
      summary: {
        surface: 'creator',
        sessionId: 'creator-session-1',
        sessionStartedAt: '2026-05-21T18:00:00.000Z',
        entrySource: 'digest',
        entryFocus: 'resume',
        wizardMode: 'apply',
        draftMode: 'existing',
        gameId: 'game-1',
        characterId: 'char-1',
        completedAt: '2026-05-21T18:05:00.000Z',
        activeDurationMs: 90000,
        elapsedDurationMs: 300000,
        completionReason: 'unmount',
      },
      actorId: 'player-1',
      requestId: 'req-2',
    });

    expect(metrics).toEqual([
      {
        metricSchema: 'pregame.v1',
        metricKind: 'counter',
        metricName: 'CREATOR_SESSION_COMPLETED',
        metricValue: 1,
        metricUnit: 'Count',
        metricDimensions: {
          surface: 'creator',
          entrySource: 'digest',
          entryFocus: 'resume',
          wizardMode: 'apply',
          draftMode: 'existing',
          completionReason: 'unmount',
        },
        metricContext: {
          actorId: 'player-1',
          gameId: 'game-1',
          characterId: 'char-1',
          creatorSessionId: 'creator-session-1',
          creatorSessionStartedAt: '2026-05-21T18:00:00.000Z',
          creatorSessionCompletedAt: '2026-05-21T18:05:00.000Z',
          activeDurationMs: 90000,
          elapsedDurationMs: 300000,
        },
        metricTrace: {
          requestId: 'req-2',
          commandId: null,
        },
      },
      {
        metricSchema: 'pregame.v1',
        metricKind: 'duration',
        metricName: 'CREATOR_ACTIVE_MILLISECONDS_RECORDED',
        metricValue: 90000,
        metricUnit: 'Milliseconds',
        metricDimensions: {
          surface: 'creator',
          entrySource: 'digest',
          entryFocus: 'resume',
          wizardMode: 'apply',
          draftMode: 'existing',
        },
        metricContext: {
          actorId: 'player-1',
          gameId: 'game-1',
          characterId: 'char-1',
          creatorSessionId: 'creator-session-1',
          creatorSessionStartedAt: '2026-05-21T18:00:00.000Z',
          creatorSessionCompletedAt: '2026-05-21T18:05:00.000Z',
          elapsedDurationMs: 300000,
          completionReason: 'unmount',
        },
        metricTrace: {
          requestId: 'req-2',
          commandId: null,
        },
      },
    ]);
  });
});
