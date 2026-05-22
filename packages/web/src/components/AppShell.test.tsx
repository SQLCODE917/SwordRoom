import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProviderContext, type AuthProvider } from '../auth/AuthProvider';
import { AppShell } from './AppShell';

const useMyProfileMock = vi.fn();

vi.mock('../hooks/useMyProfile', () => ({
  useMyProfile: () => useMyProfileMock(),
}));

describe('AppShell', () => {
  beforeEach(() => {
    useMyProfileMock.mockReset();
  });

  it('disables GM Games for non-GM players and keeps Inbox stable', () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['PLAYER'] },
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    expect(screen.getByRole('link', { name: /Sword Room Online/i }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Inbox' }).getAttribute('href')).toBe('/inbox?mode=player');
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'GM Games' })).toBeNull();
    expect(screen.getByText('GM Games').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/account');
    expect(screen.getByText('Admin').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Toggle debug widget' })).toBeTruthy();
  });

  it('enables GM nav and keeps Inbox targeting player inbox', () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['GM', 'ADMIN'] },
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    expect(screen.getByRole('link', { name: 'Inbox' }).getAttribute('href')).toBe('/inbox?mode=player');
    expect(screen.getByRole('link', { name: 'GM Games' }).getAttribute('href')).toBe('/gm/games');
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/account');
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin');
  });

  it('keeps GM Games available for a GM with no games yet', () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['GM'] },
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    expect(screen.getByRole('link', { name: 'Inbox' }).getAttribute('href')).toBe('/inbox?mode=player');
    expect(screen.getByRole('link', { name: 'GM Games' }).getAttribute('href')).toBe('/gm/games');
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/account');
  });

  it('toggles the debug widget open and closed from the bug icon button', async () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['PLAYER'] },
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    const debugToggle = screen.getByRole('button', { name: 'Toggle debug widget' });
    expect(debugToggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(debugToggle);
    expect(debugToggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Debug widget')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close debug widget' }));
    await waitFor(() => {
      expect(debugToggle.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('shows the debug button in error state when a console error is captured', async () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['PLAYER'] },
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    const debugToggle = screen.getByRole('button', { name: 'Toggle debug widget' });
    expect(debugToggle.className).not.toContain('is-error');

    console.error('debug-error-test');

    await waitFor(() => {
      expect(debugToggle.className).toContain('is-error');
    });
  });
});

function renderWithAuth(overrides?: Partial<AuthProvider>) {
  const auth: AuthProvider = {
    mode: 'dev',
    actorId: 'player-aaa',
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    async withAuthHeaders(headers?: HeadersInit) {
      return new Headers(headers);
    },
    withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string } {
      return { ...body, bypassActorId: 'player-aaa' };
    },
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
    ...overrides,
  };

  return render(
    <AuthProviderContext.Provider value={auth}>
      <MemoryRouter>
        <AppShell>
          <div>Body</div>
        </AppShell>
      </MemoryRouter>
    </AuthProviderContext.Provider>
  );
}
