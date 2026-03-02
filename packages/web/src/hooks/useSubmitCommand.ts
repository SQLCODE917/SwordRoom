import { useMemo, useState } from 'react';
import type { CommandEnvelopeInput, CommandType, PostCommandResponse } from '../api/ApiClient';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';

export interface SubmitCommandResult {
  submitCommand: <T extends CommandType>(envelope: CommandEnvelopeInput<T>) => Promise<PostCommandResponse>;
  lastCommandId: string | null;
  isSubmitting: boolean;
  submitError: string | null;
}

export function useSubmitCommand(): SubmitCommandResult {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [lastCommandId, setLastCommandId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submitCommand<T extends CommandType>(envelope: CommandEnvelopeInput<T>): Promise<PostCommandResponse> {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await api.postCommand({ envelope });
      setLastCommandId(response.commandId);
      return response;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submitCommand,
    lastCommandId,
    isSubmitting,
    submitError,
  };
}
