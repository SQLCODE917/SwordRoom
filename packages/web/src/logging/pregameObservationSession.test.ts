import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginPregameObservationSession } from './pregameObservationSession';

describe('pregameObservationSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caps active time at the idle timeout when no further activity happens', () => {
    const onSummary = vi.fn();
    const controller = beginPregameObservationSession({
      context: {
        surface: 'creator',
        sessionId: 'creator-session-1',
        sessionStartedAt: '2026-05-21T18:00:00.000Z',
        entrySource: 'digest',
        entryFocus: 'resume',
        wizardMode: 'apply',
        draftMode: 'existing',
        gameId: 'game-1',
        characterId: 'char-1',
      },
      onSummary,
    });

    vi.advanceTimersByTime(35_000);
    const summary = controller.finish('unmount');

    expect(onSummary).not.toHaveBeenCalled();
    expect(summary).toEqual(
      expect.objectContaining({
        sessionId: 'creator-session-1',
        activeDurationMs: 30_000,
        completionReason: 'unmount',
      })
    );
  });
});
