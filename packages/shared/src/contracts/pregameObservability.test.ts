import { describe, expect, it } from 'vitest';
import {
  buildPregameObservationHeaders,
  parsePregameObservationSessionSummary,
  readPregameObservationContext,
} from './pregameObservability.js';

describe('pregameObservability', () => {
  it('round-trips a creator observation context through headers', () => {
    const headers = buildPregameObservationHeaders({
      surface: 'creator',
      sessionId: 'session-1',
      sessionStartedAt: '2026-05-21T18:00:00.000Z',
      sessionStart: true,
      entrySource: 'digest',
      entryFocus: 'resume',
      wizardMode: 'apply',
      draftMode: 'existing',
      gameId: 'game-1',
      characterId: 'char-1',
    });

    expect(readPregameObservationContext(headers)).toEqual({
      surface: 'creator',
      sessionId: 'session-1',
      sessionStartedAt: '2026-05-21T18:00:00.000Z',
      sessionStart: true,
      entrySource: 'digest',
      entryFocus: 'resume',
      wizardMode: 'apply',
      draftMode: 'existing',
      gameId: 'game-1',
      characterId: 'char-1',
    });
  });

  it('returns null when required creator observation fields are missing', () => {
    expect(
      readPregameObservationContext({
        'x-swordworld-pregame-surface': 'creator',
        'x-swordworld-pregame-session-id': 'session-1',
      })
    ).toBeNull();
  });

  it('parses a creator session summary payload', () => {
    expect(
      parsePregameObservationSessionSummary({
        surface: 'creator',
        sessionId: 'session-1',
        sessionStartedAt: '2026-05-21T18:00:00.000Z',
        entrySource: 'digest',
        entryFocus: 'resume',
        wizardMode: 'apply',
        draftMode: 'existing',
        gameId: 'game-1',
        characterId: 'char-1',
        completedAt: '2026-05-21T18:04:00.000Z',
        activeDurationMs: 90000.1,
        elapsedDurationMs: 240000.9,
        completionReason: 'unmount',
      })
    ).toEqual({
      surface: 'creator',
      sessionId: 'session-1',
      sessionStartedAt: '2026-05-21T18:00:00.000Z',
      entrySource: 'digest',
      entryFocus: 'resume',
      wizardMode: 'apply',
      draftMode: 'existing',
      gameId: 'game-1',
      characterId: 'char-1',
      completedAt: '2026-05-21T18:04:00.000Z',
      activeDurationMs: 90000,
      elapsedDurationMs: 240001,
      completionReason: 'unmount',
    });
  });
});
