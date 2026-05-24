import type { GameplayLifecycle } from '../../api/ApiClient';

export type GameLifecycleUiState =
  | {
      kind: 'loading';
      phase: null;
      shouldLoadGameplay: false;
      shouldPollGameplay: false;
      errorMessage: null;
    }
  | {
      kind: 'pregame';
      phase: 'PREGAME';
      shouldLoadGameplay: false;
      shouldPollGameplay: false;
      errorMessage: null;
    }
  | {
      kind: 'live';
      phase: 'LIVE';
      shouldLoadGameplay: true;
      shouldPollGameplay: true;
      errorMessage: null;
    }
  | {
      kind: 'forbidden';
      phase: null;
      shouldLoadGameplay: false;
      shouldPollGameplay: false;
      errorMessage: string;
    }
  | {
      kind: 'missing';
      phase: null;
      shouldLoadGameplay: false;
      shouldPollGameplay: false;
      errorMessage: string;
    }
  | {
      kind: 'error';
      phase: null;
      shouldLoadGameplay: false;
      shouldPollGameplay: false;
      errorMessage: string;
    };

export function deriveGameLifecycleUiState(input: {
  initialLoading: boolean;
  lifecycle: GameplayLifecycle | null;
  error: unknown;
}): GameLifecycleUiState {
  if (input.initialLoading) {
    return {
      kind: 'loading',
      phase: null,
      shouldLoadGameplay: false,
      shouldPollGameplay: false,
      errorMessage: null,
    };
  }

  if (input.lifecycle?.phase === 'LIVE') {
    return {
      kind: 'live',
      phase: 'LIVE',
      shouldLoadGameplay: true,
      shouldPollGameplay: true,
      errorMessage: null,
    };
  }

  if (input.lifecycle?.phase === 'PREGAME') {
    return {
      kind: 'pregame',
      phase: 'PREGAME',
      shouldLoadGameplay: false,
      shouldPollGameplay: false,
      errorMessage: null,
    };
  }

  const errorMessage = readErrorMessage(input.error);
  const statusCode = readErrorStatusCode(input.error);
  if (statusCode === 403) {
    return {
      kind: 'forbidden',
      phase: null,
      shouldLoadGameplay: false,
      shouldPollGameplay: false,
      errorMessage,
    };
  }

  if (statusCode === 404) {
    return {
      kind: 'missing',
      phase: null,
      shouldLoadGameplay: false,
      shouldPollGameplay: false,
      errorMessage,
    };
  }

  return {
    kind: 'error',
    phase: null,
    shouldLoadGameplay: false,
    shouldPollGameplay: false,
    errorMessage,
  };
}

function readErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? 'Unexpected error while loading lifecycle state.');
}
