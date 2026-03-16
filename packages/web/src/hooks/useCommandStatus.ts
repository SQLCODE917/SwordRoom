import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommandEnvelopeInput, CommandStatusResponse, CommandType, PostCommandResponse } from '../api/ApiClient';
import { createApiClient, type BackendCommandStatus } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';

export type UiCommandState = 'Idle' | 'Queued' | 'Processing' | 'Processed' | 'Failed';

export interface CommandStatusViewModel {
  state: UiCommandState;
  commandId: string | null;
  message: string;
  errorCode: string | null;
  errorMessage: string | null;
}

interface SubmitAndAwaitOptions {
  label: string;
  submit: () => Promise<string | PostCommandResponse>;
}

const pollIntervalsMs = [400, 800, 1200, 1800, 2600];

export const idleCommandStatus: CommandStatusViewModel = {
  state: 'Idle',
  commandId: null,
  message: 'No command submitted yet.',
  errorCode: null,
  errorMessage: null,
};

export function useCommandStatus(commandId: string | null): CommandStatusViewModel {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [status, setStatus] = useState<CommandStatusViewModel>(idleCommandStatus);

  useEffect(() => {
    let active = true;

    if (!commandId) {
      setStatus(idleCommandStatus);
      return () => {
        active = false;
      };
    }

    setStatus({
      state: 'Queued',
      commandId,
      message: 'Command accepted; waiting for worker.',
      errorCode: null,
      errorMessage: null,
    });

    void pollCommandUntilTerminal({
      api,
      commandId,
      isActive: () => active,
      onStatus: (nextStatus) => {
        if (active) {
          setStatus(nextStatus);
        }
      },
    }).catch((error) => {
      if (!active) {
        return;
      }
      setStatus({
        state: 'Failed',
        commandId,
        message: 'Failed to poll command status.',
        errorCode: null,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      active = false;
    };
  }, [api, commandId]);

  return status;
}

export function useCommandWorkflow(): {
  status: CommandStatusViewModel;
  isRunning: boolean;
  resetStatus: () => void;
  submitAndAwait: (options: SubmitAndAwaitOptions) => Promise<CommandStatusResponse>;
  submitEnvelopeAndAwait: <T extends CommandType>(label: string, envelope: CommandEnvelopeInput<T>) => Promise<CommandStatusResponse>;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [status, setStatus] = useState<CommandStatusViewModel>(idleCommandStatus);
  const [isRunning, setIsRunning] = useState(false);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
    };
  }, []);

  const resetStatus = useCallback(() => {
    setStatus(idleCommandStatus);
  }, []);

  const submitAndAwait = useCallback(
    async ({ label, submit }: SubmitAndAwaitOptions): Promise<CommandStatusResponse> => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const isActiveRun = () => mountedRef.current && runIdRef.current === runId;

      if (isActiveRun()) {
        setIsRunning(true);
        setStatus({
          state: 'Idle',
          commandId: null,
          message: `${label} submitting...`,
          errorCode: null,
          errorMessage: null,
        });
      }

      try {
        const submitted = await submit();
        const commandId = typeof submitted === 'string' ? submitted : submitted.commandId;
        if (!isActiveRun()) {
          throw new Error(`Command workflow "${label}" was superseded.`);
        }

        setStatus({
          state: 'Queued',
          commandId,
          message: `${label} queued.`,
          errorCode: null,
          errorMessage: null,
        });

        return await pollCommandUntilTerminal({
          api,
          commandId,
          isActive: isActiveRun,
          onStatus: (nextStatus) => {
            if (isActiveRun()) {
              setStatus(nextStatus);
            }
          },
        });
      } finally {
        if (isActiveRun()) {
          setIsRunning(false);
        }
      }
    },
    [api]
  );

  const submitEnvelopeAndAwait = useCallback(
    async <T extends CommandType>(label: string, envelope: CommandEnvelopeInput<T>): Promise<CommandStatusResponse> =>
      submitAndAwait({
        label,
        submit: () => api.postCommand({ envelope }),
      }),
    [api, submitAndAwait]
  );

  return {
    status,
    isRunning,
    resetStatus,
    submitAndAwait,
    submitEnvelopeAndAwait,
  };
}

export function mapCommandStatus(response: CommandStatusResponse): CommandStatusViewModel {
  if (response.status === 'FAILED') {
    return {
      state: 'Failed',
      commandId: response.commandId,
      message: describeFailure(response),
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
    };
  }

  return {
    state: mapBackendStatus(response.status),
    commandId: response.commandId,
    message: buildStateMessage(mapBackendStatus(response.status), response),
    errorCode: response.errorCode,
    errorMessage: response.errorMessage,
  };
}

export function describeFailure(response: Pick<CommandStatusResponse, 'errorCode' | 'errorMessage'>): string {
  const code = response.errorCode ?? 'UNKNOWN_ERROR';
  const rawMessage = response.errorMessage ?? 'No backend error message provided.';
  return `Command failed (${code}): ${rawMessage}`;
}

export function createCommandId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const nowHex = Date.now().toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${nowHex}`;
}

async function pollCommandUntilTerminal(input: {
  api: ReturnType<typeof createApiClient>;
  commandId: string;
  isActive: () => boolean;
  onStatus: (status: CommandStatusViewModel) => void;
}): Promise<CommandStatusResponse> {
  let attempt = 0;

  while (input.isActive()) {
    const response = await input.api.getCommandStatus(input.commandId);
    if (!input.isActive()) {
      break;
    }
    if (!response) {
      await sleep(pollIntervalsMs[Math.min(attempt, pollIntervalsMs.length - 1)] ?? 2600);
      attempt += 1;
      continue;
    }

    input.onStatus(mapCommandStatus(response));
    if (response.status === 'PROCESSED' || response.status === 'FAILED') {
      return response;
    }

    await sleep(pollIntervalsMs[Math.min(attempt, pollIntervalsMs.length - 1)] ?? 2600);
    attempt += 1;
  }

  throw new Error(`Command workflow for "${input.commandId}" is no longer active.`);
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

function buildStateMessage(state: UiCommandState, response: CommandStatusResponse): string {
  if (state !== 'Failed') {
    return describeState(state);
  }

  return describeFailure(response);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
