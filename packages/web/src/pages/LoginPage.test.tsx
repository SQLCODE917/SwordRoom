import { useMemo, useSyncExternalStore } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthProviderContext,
  clearAuthUiState,
  getAuthStoreVersion,
  subscribeToAuthState,
  type AuthProvider,
} from '../auth/AuthProvider';
import { createDevAuthProvider, writeDevSession } from '../auth/DevAuthProvider';
import { LoginPage } from './LoginPage';

vi.mock('../logging/flowLog', () => ({
  logWebFlow: vi.fn(),
  summarizeError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

describe('LoginPage', () => {
  afterEach(() => {
    clearAuthUiState();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('resets the logout button state after dev logout on the account page', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });

    render(<LoginPageHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      const logoutButton = screen.getByRole('button', { name: 'Logout' }) as HTMLButtonElement;
      expect(logoutButton.disabled).toBe(true);
      expect(screen.getByTestId('location').textContent).toBe('/login');
    });

    expect(screen.queryByRole('button', { name: 'Signing Out...' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Login' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('routes OIDC logout back to /login', async () => {
    const logout = vi.fn(async () => ({ ok: true }));
    const auth: AuthProvider = {
      mode: 'oidc',
      actorId: 'player-oidc',
      isAuthenticated: true,
      pendingAction: null,
      errorMessage: null,
      withAuthHeaders: vi.fn(async () => new Headers()),
      withActor: (body) => body,
      login: vi.fn(async () => ({ ok: true })),
      register: vi.fn(async () => ({ ok: true })),
      logout,
      clearError: vi.fn(),
    };

    render(
      <AuthProviderContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProviderContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith({ returnToPath: '/login' });
    });
  });
});

function LoginPageHarness() {
  const authRevision = useSyncExternalStore(subscribeToAuthState, getAuthStoreVersion, getAuthStoreVersion);

  const authProvider = useMemo(() => createDevAuthProvider({ VITE_AUTH_MODE: 'dev' }), [authRevision]);

  return (
    <AuthProviderContext.Provider value={authProvider}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <>
                <LoginPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProviderContext.Provider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}
