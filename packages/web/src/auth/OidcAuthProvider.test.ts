import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthUiState } from './AuthProvider';
import {
  beginOidcLogin,
  beginOidcLogout,
  clearOidcSession,
  completeOidcLoginFromCallback,
  createOidcAuthProvider,
  resetOidcAuthTestState,
  setOidcRedirectHandlerForTests,
} from './OidcAuthProvider';

const env = {
  VITE_OIDC_DISCOVERY_URL: 'https://issuer.example/.well-known/openid-configuration',
  VITE_OIDC_CLIENT_ID: 'swordworld-web',
  VITE_OIDC_REDIRECT_URI: 'https://app.example/auth/callback',
  VITE_OIDC_SCOPE: 'openid profile email',
};

const discoveryDocument = {
  authorization_endpoint: 'https://issuer.example/oauth2/authorize',
  token_endpoint: 'https://issuer.example/oauth2/token',
  end_session_endpoint: 'https://issuer.example/logout',
};

const accessToken = [
  'header',
  btoa(JSON.stringify({ sub: 'player-oidc', exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''),
  'signature',
].join('.');

const idToken = [
  'header',
  btoa(
    JSON.stringify({
      sub: 'player-oidc',
      email: 'player@example.com',
      email_verified: true,
      name: 'Player Oidc',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''),
  'signature',
].join('.');

describe('OidcAuthProvider', () => {
  beforeEach(() => {
    resetOidcAuthTestState();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url === env.VITE_OIDC_DISCOVERY_URL) {
          return new Response(JSON.stringify(discoveryDocument), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url === discoveryDocument.token_endpoint) {
          expect(init?.method).toBe('POST');
          return new Response(JSON.stringify({ access_token: accessToken, id_token: idToken, expires_in: 3600 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        throw new Error(`unexpected fetch ${url}`);
      })
    );
  });

  afterEach(() => {
    clearAuthUiState();
    setOidcRedirectHandlerForTests(null);
    clearOidcSession();
    resetOidcAuthTestState();
    vi.unstubAllGlobals();
  });

  it('starts unauthenticated and gains an Authorization header after callback completion', async () => {
    let redirectedTo = '';
    setOidcRedirectHandlerForTests((url) => {
      redirectedTo = url;
    });
    const auth = createOidcAuthProvider(env);

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.actorId).toBe('');

    await beginOidcLogin('/gm/games', env);

    const redirectUrl = new URL(redirectedTo);
    const state = redirectUrl.searchParams.get('state');
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(discoveryDocument.authorization_endpoint);
    expect(redirectUrl.searchParams.get('client_id')).toBe(env.VITE_OIDC_CLIENT_ID);

    const returnToPath = await completeOidcLoginFromCallback(
      `https://app.example/auth/callback?code=abc123&state=${encodeURIComponent(state ?? '')}`,
      env
    );

    expect(returnToPath).toBe('/gm/games');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.actorId).toBe('player-oidc');
    expect((await auth.withAuthHeaders()).get('Authorization')).toBe(`Bearer ${idToken}`);
  });

  it('restores a valid session after an in-memory reset, like a browser reload', async () => {
    window.sessionStorage.setItem(
      'sw_oidc_pending_login',
      JSON.stringify({ state: 'state-reload', codeVerifier: 'verifier', returnToPath: '/' })
    );

    await completeOidcLoginFromCallback('https://app.example/auth/callback?code=abc123&state=state-reload', env);

    resetOidcAuthTestState({ clearStorage: false });
    const reloadedAuth = createOidcAuthProvider(env);

    expect(reloadedAuth.isAuthenticated).toBe(true);
    expect(reloadedAuth.actorId).toBe('player-oidc');
    expect((await reloadedAuth.withAuthHeaders()).get('Authorization')).toBe(`Bearer ${idToken}`);
  });

  it('drops expired persisted sessions', async () => {
    const auth = createOidcAuthProvider(env);
    const expiredIdToken = [
      'header',
      btoa(JSON.stringify({ sub: 'player-oidc', exp: Math.floor(Date.now() / 1000) - 5 }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''),
      'signature',
    ].join('.');

    window.sessionStorage.setItem(
      'sw_oidc_pending_login',
      JSON.stringify({ state: 'state-1', codeVerifier: 'verifier', returnToPath: '/' })
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url === env.VITE_OIDC_DISCOVERY_URL) {
          return new Response(JSON.stringify(discoveryDocument), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ access_token: accessToken, id_token: expiredIdToken, expires_in: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    await completeOidcLoginFromCallback('https://app.example/auth/callback?code=abc123&state=state-1', env);

    expect(auth.isAuthenticated).toBe(false);
    expect((await auth.withAuthHeaders()).get('Authorization')).toBeNull();
    expect(window.sessionStorage.getItem('sw_oidc_session_v1')).toBeNull();
  });

  it('fails the callback when the token response omits id_token', async () => {
    window.sessionStorage.setItem(
      'sw_oidc_pending_login',
      JSON.stringify({ state: 'state-3', codeVerifier: 'verifier', returnToPath: '/' })
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url === env.VITE_OIDC_DISCOVERY_URL) {
          return new Response(JSON.stringify(discoveryDocument), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ access_token: accessToken, expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    await expect(
      completeOidcLoginFromCallback('https://app.example/auth/callback?code=abc123&state=state-3', env)
    ).rejects.toThrow(/missing id_token/);
  });

  it('clears session and redirects through the discovered logout endpoint', async () => {
    let redirectedTo = '';
    setOidcRedirectHandlerForTests((url) => {
      redirectedTo = url;
    });

    window.sessionStorage.setItem(
      'sw_oidc_pending_login',
      JSON.stringify({ state: 'state-2', codeVerifier: 'verifier', returnToPath: '/' })
    );
    await completeOidcLoginFromCallback('https://app.example/auth/callback?code=abc123&state=state-2', env);

    expect(createOidcAuthProvider(env).isAuthenticated).toBe(true);

    await beginOidcLogout('/login', env);

    expect(createOidcAuthProvider(env).isAuthenticated).toBe(false);
    const logoutUrl = new URL(redirectedTo);
    expect(logoutUrl.origin + logoutUrl.pathname).toBe(discoveryDocument.end_session_endpoint);
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(`${window.location.origin}/login`);
  });
});
