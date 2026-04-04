import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { writeDevSession } from './auth/DevAuthProvider';

describe('App shell routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('redirects unauthenticated users to the account page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Sword Room Online' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Account' })).toBeTruthy();
  });

  it('renders home page when a dev session exists', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy();
  });

  it('lets a player open GM Games before they have any GM games', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    window.history.pushState({}, '', '/gm/games');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/api/me')) {
        return new Response(
          JSON.stringify({
            playerId: 'player-aaa',
            displayName: 'Local Player',
            email: 'player@example.com',
            roles: ['PLAYER'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.endsWith('/api/gm/games')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch in App.test.tsx: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'GM Games' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Game' })).toBeTruthy();
  });
});
