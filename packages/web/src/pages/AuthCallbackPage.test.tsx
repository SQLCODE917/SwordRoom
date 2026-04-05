import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerProfile } from '../api/ApiClient';
import { createApiClient } from '../api/ApiClient';
import { AuthProviderContext, type AuthProvider } from '../auth/AuthProvider';
import { completeOidcLoginFromCallback } from '../auth/OidcAuthProvider';
import { AuthCallbackPage } from './AuthCallbackPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/OidcAuthProvider', () => ({
  completeOidcLoginFromCallback: vi.fn(),
}));

vi.mock('../logging/flowLog', () => ({
  logWebFlow: vi.fn(),
  summarizeError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

function createAuthProvider(): AuthProvider {
  return {
    mode: 'oidc',
    actorId: '',
    isAuthenticated: false,
    pendingAction: null,
    errorMessage: null,
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => body,
    login: vi.fn(async () => ({ ok: true })),
    register: vi.fn(async () => ({ ok: true })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not restart callback completion when the auth provider instance refreshes mid-flow', async () => {
    const syncDeferred = createDeferred<PlayerProfile>();
    const syncMyProfile = vi.fn(() => syncDeferred.promise);

    vi.mocked(createApiClient).mockReturnValue({
      syncMyProfile,
    } as unknown as ReturnType<typeof createApiClient>);
    vi.mocked(completeOidcLoginFromCallback)
      .mockResolvedValueOnce('/gm/games')
      .mockRejectedValueOnce(new Error('OIDC login state was not found. Start login again.'));

    const authA = createAuthProvider();
    const authB = createAuthProvider();

    const renderTree = (auth: AuthProvider) => (
      <AuthProviderContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/auth/callback?code=abc123&state=state-1']}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/gm/games" element={<div>GM Games</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProviderContext.Provider>
    );

    const { rerender } = render(renderTree(authA));

    await waitFor(() => expect(completeOidcLoginFromCallback).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(syncMyProfile).toHaveBeenCalledTimes(1));

    rerender(renderTree(authB));

    await act(async () => {
      await Promise.resolve();
    });

    expect(completeOidcLoginFromCallback).toHaveBeenCalledTimes(1);

    await act(async () => {
      syncDeferred.resolve({
        playerId: 'player-oidc',
        displayName: 'Player Oidc',
        email: 'player@example.com',
        emailNormalized: 'player@example.com',
        emailVerified: true,
        roles: ['PLAYER'],
      });
      await syncDeferred.promise;
    });

    expect(await screen.findByText('GM Games')).toBeTruthy();
    expect(screen.queryByText(/login state was not found/i)).toBeNull();
  });
});
