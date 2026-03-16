import { notifyAuthStateChanged, type AuthProvider } from './AuthProvider';

interface OidcEnv {
  VITE_OIDC_ISSUER?: string;
  VITE_OIDC_CLIENT_ID?: string;
  VITE_OIDC_REDIRECT_URI?: string;
  VITE_OIDC_SCOPE?: string;
}

interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

interface PendingLogin {
  state: string;
  codeVerifier: string;
  returnToPath: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface StoredSession {
  accessToken: string;
  expiresAtEpochMs: number;
}

const OIDC_PENDING_KEY = 'sw_oidc_pending_login';
const OIDC_SESSION_KEY = 'sw_oidc_session';
const DEFAULT_OIDC_SCOPE = 'openid profile email';
const DEFAULT_CLIENT_ID = 'swordworld-web';

export function createOidcAuthProvider(env = import.meta.env as OidcEnv): AuthProvider {
  const config = resolveConfig(env);

  return {
    mode: 'oidc',
    actorId: hasOidcSession() ? 'oidc-user' : '',
    isAuthenticated: hasOidcSession(),
    async withAuthHeaders(headers?: HeadersInit): Promise<Headers> {
      const merged = new Headers(headers ?? {});
      const token = readValidAccessToken();
      if (token) {
        merged.set('Authorization', `Bearer ${token}`);
      }
      return merged;
    },
    withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string } {
      return body;
    },
  };
}

export function hasOidcSession(): boolean {
  return readValidAccessToken() !== null;
}

export function clearOidcSession(): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.removeItem(OIDC_SESSION_KEY);
  sessionStorage.removeItem(OIDC_PENDING_KEY);
  notifyAuthStateChanged();
}

export async function beginOidcLogin(returnToPath = '/', env = import.meta.env as OidcEnv): Promise<void> {
  assertBrowser();
  const config = resolveConfig(env);
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  writeJson(sessionStorage, OIDC_PENDING_KEY, {
    state,
    codeVerifier,
    returnToPath: returnToPath || '/',
  });

  const authorizeUrl = new URL(`${config.issuer}/protocol/openid-connect/auth`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('scope', config.scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(authorizeUrl.toString());
}

export function beginOidcRegistration(returnToPath = '/', env = import.meta.env as OidcEnv): void {
  assertBrowser();
  const config = resolveConfig(env);
  const registerUrl = new URL(`${config.issuer}/protocol/openid-connect/registrations`);
  registerUrl.searchParams.set('client_id', config.clientId);
  registerUrl.searchParams.set('response_type', 'code');
  registerUrl.searchParams.set('scope', config.scope);
  registerUrl.searchParams.set('redirect_uri', config.redirectUri);
  registerUrl.searchParams.set('kc_action', 'register');
  registerUrl.searchParams.set('returnToPath', returnToPath || '/');
  window.location.assign(registerUrl.toString());
}

export function beginOidcLogout(returnToPath = '/', env = import.meta.env as OidcEnv): void {
  assertBrowser();
  const config = resolveConfig(env);
  clearOidcSession();
  const logoutUrl = new URL(`${config.issuer}/protocol/openid-connect/logout`);
  logoutUrl.searchParams.set('post_logout_redirect_uri', resolveAbsoluteReturnToPath(returnToPath));
  logoutUrl.searchParams.set('client_id', config.clientId);
  window.location.assign(logoutUrl.toString());
}

export async function completeOidcLoginFromCallback(url = window.location.href, env = import.meta.env as OidcEnv): Promise<string> {
  assertBrowser();
  const config = resolveConfig(env);
  const callbackUrl = new URL(url);
  const code = callbackUrl.searchParams.get('code');
  const state = callbackUrl.searchParams.get('state');
  const oidcError = callbackUrl.searchParams.get('error');
  const oidcErrorDescription = callbackUrl.searchParams.get('error_description');
  if (oidcError) {
    throw new Error(oidcErrorDescription ? `${oidcError}: ${oidcErrorDescription}` : oidcError);
  }
  if (!code || !state) {
    throw new Error('OIDC callback is missing code or state.');
  }

  const pending = readJson<PendingLogin>(sessionStorage, OIDC_PENDING_KEY);
  if (!pending) {
    throw new Error('OIDC login state was not found. Start login again.');
  }
  if (pending.state !== state) {
    throw new Error('OIDC state mismatch. Start login again.');
  }

  const tokenEndpoint = `${config.issuer}/protocol/openid-connect/token`;
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', config.clientId);
  body.set('code', code);
  body.set('redirect_uri', config.redirectUri);
  body.set('code_verifier', pending.codeVerifier);

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(await readOidcError(response));
  }

  const token = (await response.json()) as TokenResponse;
  if (!token.access_token) {
    throw new Error('OIDC token response missing access_token.');
  }

  const expiresIn = typeof token.expires_in === 'number' && token.expires_in > 0 ? token.expires_in : 3600;
  const expiresAtEpochMs = Date.now() + expiresIn * 1000;
  writeJson(localStorage, OIDC_SESSION_KEY, {
    accessToken: token.access_token,
    expiresAtEpochMs,
  });
  sessionStorage.removeItem(OIDC_PENDING_KEY);
  notifyAuthStateChanged();

  return pending.returnToPath || '/';
}

function resolveConfig(env: OidcEnv): OidcConfig {
  const issuer = (env.VITE_OIDC_ISSUER ?? '').trim().replace(/\/$/, '');
  if (!issuer) {
    throw new Error('VITE_OIDC_ISSUER is required when AUTH_MODE=oidc.');
  }

  const clientId = (env.VITE_OIDC_CLIENT_ID ?? DEFAULT_CLIENT_ID).trim() || DEFAULT_CLIENT_ID;
  const scope = (env.VITE_OIDC_SCOPE ?? DEFAULT_OIDC_SCOPE).trim() || DEFAULT_OIDC_SCOPE;
  const redirectUri = (env.VITE_OIDC_REDIRECT_URI ?? defaultRedirectUri()).trim();
  if (!redirectUri) {
    throw new Error('VITE_OIDC_REDIRECT_URI is required when AUTH_MODE=oidc.');
  }

  return {
    issuer,
    clientId,
    redirectUri,
    scope,
  };
}

function defaultRedirectUri(): string {
  if (typeof window === 'undefined') {
    return '/auth/callback';
  }
  return `${window.location.origin}/auth/callback`;
}

function resolveAbsoluteReturnToPath(returnToPath: string): string {
  if (typeof window === 'undefined') {
    return returnToPath;
  }
  return new URL(returnToPath || '/', window.location.origin).toString();
}

function readValidAccessToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const session = readJson<StoredSession>(localStorage, OIDC_SESSION_KEY);
  if (!session?.accessToken || typeof session.expiresAtEpochMs !== 'number') {
    return null;
  }
  if (Date.now() >= session.expiresAtEpochMs) {
    localStorage.removeItem(OIDC_SESSION_KEY);
    notifyAuthStateChanged();
    return null;
  }
  return session.accessToken;
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToBase64Url(new Uint8Array(digest));
}

function randomBase64Url(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.crypto !== 'undefined';
}

function assertBrowser(): void {
  if (!isBrowser()) {
    throw new Error('OIDC auth requires a browser environment.');
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

function readJson<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readOidcError(response: Response): Promise<string> {
  const fallback = `OIDC token exchange failed: ${response.status} ${response.statusText}`;
  try {
    const payload = (await response.json()) as TokenResponse;
    if (payload.error && payload.error_description) {
      return `${payload.error}: ${payload.error_description}`;
    }
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // ignore parse failures
  }
  return fallback;
}
