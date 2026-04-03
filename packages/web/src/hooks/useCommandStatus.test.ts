import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProviderContext, type AuthProvider } from '../auth/AuthProvider';
import { describeFailure, useCommandWorkflow } from './useCommandStatus';

const postCommandMock = vi.fn();
const getCommandStatusMock = vi.fn();

vi.mock('../api/ApiClient', () => ({
  createApiClient: () => ({
    postCommand: postCommandMock,
    getCommandStatus: getCommandStatusMock,
  }),
}));

describe('describeFailure', () => {
  it('preserves backend code and message verbatim for duplicate create draft errors', () => {
    const message = describeFailure({
      errorCode: 'CHARACTER_ID_ALREADY_EXISTS',
      errorMessage: 'Character ID "char-human-1" already exists in game "game-1".',
    });

    expect(message).toBe(
      'Command failed (CHARACTER_ID_ALREADY_EXISTS): Character ID "char-human-1" already exists in game "game-1".'
    );
  });

  it('preserves backend context for other failures', () => {
    const message = describeFailure({
      errorCode: 'EXP_INSUFFICIENT',
      errorMessage: 'Not enough starting EXP to purchase skill bundle.',
    });

    expect(message).toBe('Command failed (EXP_INSUFFICIENT): Not enough starting EXP to purchase skill bundle.');
  });
});

describe('useCommandWorkflow', () => {
  it('submits and completes commands in React.StrictMode', async () => {
    postCommandMock.mockReset();
    getCommandStatusMock.mockReset();
    postCommandMock.mockResolvedValue({
      accepted: true,
      commandId: 'cmd-1',
      status: 'ACCEPTED',
    });
    getCommandStatusMock
      .mockResolvedValueOnce({
        commandId: 'cmd-1',
        status: 'ACCEPTED',
        errorCode: null,
        errorMessage: null,
      })
      .mockResolvedValueOnce({
        commandId: 'cmd-1',
        status: 'PROCESSED',
        errorCode: null,
        errorMessage: null,
      });

    render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          AuthProviderContext.Provider,
          { value: createAuthProvider() },
          React.createElement(WorkflowHarness)
        )
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));

    await waitFor(() => expect(screen.getByText('ok:PROCESSED')).toBeTruthy());
    expect(postCommandMock).toHaveBeenCalledTimes(1);
    expect(getCommandStatusMock).toHaveBeenCalled();
  });
});

function WorkflowHarness() {
  const { submitAndAwait } = useCommandWorkflow();
  const [result, setResult] = React.useState('idle');

  return React.createElement(
    'div',
    null,
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () => {
          void submitAndAwait({
            label: 'Test command',
            submit: async () => {
              const response = await postCommandMock();
              return response.commandId as string;
            },
          })
            .then((terminal) => setResult(`ok:${terminal.status}`))
            .catch((error) => setResult(`err:${error instanceof Error ? error.message : String(error)}`));
        },
      },
      'Run command'
    ),
    React.createElement('span', null, result)
  );
}

function createAuthProvider(): AuthProvider {
  return {
    mode: 'dev',
    actorId: 'player-aaa',
    isAuthenticated: true,
    async withAuthHeaders(headers?: HeadersInit) {
      return new Headers(headers);
    },
    withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string } {
      return { ...body, bypassActorId: 'player-aaa' };
    },
  };
}
