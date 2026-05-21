import { describe, expect, it } from 'vitest';
import {
  buildPregameObservationHeaders,
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
});
