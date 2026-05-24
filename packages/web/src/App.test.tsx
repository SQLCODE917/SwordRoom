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

  it('renders account page when /account is opened by an authenticated user', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    window.history.pushState({}, '', '/account');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
  });

  it('redirects a non-GM player away from /gm/games', async () => {
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

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'GM Games' })).toBeNull();
  });

  it('allows a GM to open /gm/games', async () => {
    writeDevSession({ username: 'gm-aaa', actorId: 'gm-aaa' });
    window.history.pushState({}, '', '/gm/games');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/api/me')) {
        return new Response(
          JSON.stringify({
            playerId: 'gm-aaa',
            displayName: 'Local GM',
            email: 'gm@example.com',
            roles: ['PLAYER', 'GM'],
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

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'GM Games' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Game and Open Lobby' })).toBeTruthy();
  });

  it('allows a GM to deep-link /gm/games/:gameId?mode=play and redirects to player play', async () => {
    writeDevSession({ username: 'gm-aaa', actorId: 'gm-aaa' });
    window.history.pushState({}, '', '/gm/games/game-1?mode=play');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/api/games/game-1/me')) {
        return new Response(
          JSON.stringify({
            actorId: 'gm-aaa',
            displayName: 'Local GM',
            roles: ['PLAYER', 'GM'],
            gmPlayerId: 'gm-aaa',
            isGameMaster: true,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.endsWith('/api/games/game-1/state')) {
        return new Response(
          JSON.stringify({
            gameId: 'game-1',
            phase: 'PREGAME',
            hasGameplaySession: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/api/games/game-1/chat')) {
        return new Response(
          JSON.stringify({
            gameId: 'game-1',
            gameName: 'Local Demo Game',
            participants: [],
            messages: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Player Play' })).toBeTruthy();
  });

  it('allows a GM to deep-link /gm/games/:gameId?mode=gm-play and redirects to gm play', async () => {
    writeDevSession({ username: 'gm-aaa', actorId: 'gm-aaa' });
    window.history.pushState({}, '', '/gm/games/game-1?mode=gm-play');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/api/games/game-1/me')) {
        return new Response(
          JSON.stringify({
            actorId: 'gm-aaa',
            displayName: 'Local GM',
            roles: ['PLAYER', 'GM'],
            gmPlayerId: 'gm-aaa',
            isGameMaster: true,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.endsWith('/api/games/game-1/state')) {
        return new Response(
          JSON.stringify({
            gameId: 'game-1',
            phase: 'PREGAME',
            hasGameplaySession: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/api/games/game-1/chat')) {
        return new Response(
          JSON.stringify({
            gameId: 'game-1',
            gameName: 'Local Demo Game',
            participants: [],
            messages: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'GM Play' })).toBeTruthy();
  });

  it('redirects non-GMs away from /gm/games/:gameId deep links', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    window.history.pushState({}, '', '/gm/games/game-1?mode=gm-play');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/api/games/game-1/me')) {
        return new Response(
          JSON.stringify({
            actorId: 'player-aaa',
            displayName: 'Local Player',
            roles: ['PLAYER'],
            gmPlayerId: 'gm-aaa',
            isGameMaster: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'GM Play' })).toBeNull();
  });
});
