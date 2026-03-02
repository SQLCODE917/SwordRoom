import { useEffect, useMemo, useState } from 'react';
import type { BackendCommandStatus } from '../api/ApiClient';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';

export type UiCommandState = 'Idle' | 'Queued' | 'Processing' | 'Processed' | 'Failed';

export interface CommandStatusViewModel {
  state: UiCommandState;
  commandId: string | null;
  message: string;
  errorCode: string | null;
  errorMessage: string | null;
}

const terminalStates: UiCommandState[] = ['Processed', 'Failed'];
const pollIntervalsMs = [400, 800, 1200, 1800, 2600];

export function useCommandStatus(commandId: string | null): CommandStatusViewModel {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [status, setStatus] = useState<CommandStatusViewModel>({
    state: 'Idle',
    commandId: null,
    message: 'No command submitted yet.',
    errorCode: null,
    errorMessage: null,
  });

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!commandId) {
      setStatus({
        state: 'Idle',
        commandId: null,
        message: 'No command submitted yet.',
        errorCode: null,
        errorMessage: null,
      });
      return () => {
        stopped = true;
      };
    }

    setStatus({
      state: 'Queued',
      commandId,
      message: 'Command accepted; waiting for worker.',
      errorCode: null,
      errorMessage: null,
    });

    const poll = async () => {
      if (stopped) {
        return;
      }

      try {
        const response = await api.getCommandStatus(commandId);
        if (!response) {
          scheduleNext();
          return;
        }

        const mappedState = mapBackendStatus(response.status);
        setStatus({
          state: mappedState,
          commandId,
          message: describeState(mappedState),
          errorCode: response.errorCode,
          errorMessage: response.errorMessage,
        });

        if (!terminalStates.includes(mappedState)) {
          scheduleNext();
        }
      } catch (error) {
        setStatus({
          state: 'Failed',
          commandId,
          message: 'Failed to poll command status.',
          errorCode: null,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const scheduleNext = () => {
      const interval = pollIntervalsMs[Math.min(attempt, pollIntervalsMs.length - 1)] ?? 2600;
      attempt += 1;
      timer = setTimeout(() => {
        void poll();
      }, interval);
    };

    void poll();

    return () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [api, commandId]);

  return status;
}

function mapBackendStatus(status: BackendCommandStatus): UiCommandState {
  if (status === 'ACCEPTED') {
    return 'Queued';
  }
  if (status === 'PROCESSING') {
    return 'Processing';
  }
  if (status === 'PROCESSED') {
    return 'Processed';
  }
  return 'Failed';
}

function describeState(state: UiCommandState): string {
  if (state === 'Queued') {
    return 'Command queued.';
  }
  if (state === 'Processing') {
    return 'Command processing.';
  }
  if (state === 'Processed') {
    return 'Command processed.';
  }
  if (state === 'Failed') {
    return 'Command failed.';
  }
  return 'No command submitted yet.';
}
