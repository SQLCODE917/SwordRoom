import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { type AuthProvider, useAuthProvider } from '../auth/AuthProvider';
import { AccountPage } from './AccountPage';
import { useMyProfile } from '../hooks/useMyProfile';

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../hooks/useMyProfile', () => ({
  useMyProfile: vi.fn(),
}));

describe('AccountPage', () => {
  it('shows the current profile summary', () => {
    vi.mocked(useAuthProvider).mockReturnValue(
      createAuth({
        actorId: 'player-aaa',
      })
    );
    vi.mocked(useMyProfile).mockReturnValue({
      profile: {
        playerId: 'player-aaa',
        displayName: 'Local Player',
        email: 'player@example.com',
        roles: ['PLAYER'],
      },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AccountPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Account' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Local Player | PLAYER | player@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('logs out and redirects to Login', async () => {
    const logout = vi.fn(async () => ({ ok: true, redirectTo: '/login' }));
    vi.mocked(useAuthProvider).mockReturnValue(
      createAuth({
        actorId: 'gm-zzz',
        logout,
      })
    );
    vi.mocked(useMyProfile).mockReturnValue({
      profile: {
        playerId: 'gm-zzz',
        displayName: 'Local GM',
        email: 'gm@example.com',
        roles: ['PLAYER', 'GM'],
      },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter
        initialEntries={['/account']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith({ returnToPath: '/login' });
    });
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeTruthy();
  });
});

function createAuth(overrides?: Partial<AuthProvider>): AuthProvider {
  return {
    mode: 'dev',
    actorId: 'player-aaa',
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    async withAuthHeaders(headers?: HeadersInit) {
      return new Headers(headers);
    },
    withActor<T extends Record<string, unknown>>(body: T) {
      return { ...body, bypassActorId: 'player-aaa' };
    },
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
    ...overrides,
  };
}
