import { describe, expect, it } from 'vitest';
import { deriveGameLifecycleUiState } from './lifecycleUiState';

describe('deriveGameLifecycleUiState', () => {
  it('returns loading while initial lifecycle read is in progress', () => {
    const state = deriveGameLifecycleUiState({
      initialLoading: true,
      lifecycle: null,
      error: null,
    });

    expect(state).toEqual({
      kind: 'loading',
      phase: null,
      shouldLoadGameplay: false,
      shouldPollGameplay: false,
      errorMessage: null,
    });
  });

  it('returns pregame when lifecycle phase is pregame', () => {
    const state = deriveGameLifecycleUiState({
      initialLoading: false,
      lifecycle: {
        gameId: 'game-1',
        phase: 'PREGAME',
        hasGameplaySession: false,
      },
      error: null,
    });

    expect(state).toEqual({
      kind: 'pregame',
      phase: 'PREGAME',
      shouldLoadGameplay: false,
      shouldPollGameplay: false,
      errorMessage: null,
    });
  });

  it('returns live when lifecycle phase is live', () => {
    const state = deriveGameLifecycleUiState({
      initialLoading: false,
      lifecycle: {
        gameId: 'game-1',
        phase: 'LIVE',
        hasGameplaySession: true,
      },
      error: null,
    });

    expect(state).toEqual({
      kind: 'live',
      phase: 'LIVE',
      shouldLoadGameplay: true,
      shouldPollGameplay: true,
      errorMessage: null,
    });
  });

  it('returns forbidden when lifecycle read fails with 403', () => {
    const state = deriveGameLifecycleUiState({
      initialLoading: false,
      lifecycle: null,
      error: {
        statusCode: 403,
      },
    });

    expect(state.kind).toBe('forbidden');
    expect(state.shouldLoadGameplay).toBe(false);
    expect(state.shouldPollGameplay).toBe(false);
  });

  it('returns missing when lifecycle read fails with 404', () => {
    const state = deriveGameLifecycleUiState({
      initialLoading: false,
      lifecycle: null,
      error: {
        statusCode: 404,
      },
    });

    expect(state.kind).toBe('missing');
    expect(state.shouldLoadGameplay).toBe(false);
    expect(state.shouldPollGameplay).toBe(false);
  });

  it('returns error for non-403/404 failures and preserves error message', () => {
    const state = deriveGameLifecycleUiState({
      initialLoading: false,
      lifecycle: null,
      error: new Error('Lifecycle request failed'),
    });

    expect(state).toEqual({
      kind: 'error',
      phase: null,
      shouldLoadGameplay: false,
      shouldPollGameplay: false,
      errorMessage: 'Lifecycle request failed',
    });
  });
});
