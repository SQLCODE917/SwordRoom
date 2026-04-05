import { notifyAuthStateChanged, type AuthProvider } from './AuthProvider';

interface OidcEnv {
  VITE_OIDC_DISCOVERY_URL?: string;
  VITE_OIDC_CLIENT_ID?: string;
  VITE_OIDC_REDIRECT_URI?: string;
  VITE_OIDC_SCOPE?: string;
}

interface OidcConfig {
  discoveryUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

interface OidcDiscoveryDocument {
  authorization_endpoint?: string;
  token_endpoint?: string;
  end_session_endpoint?: string;
}

interface PendingLogin {
  state: string;
  codeVerifier: string;
  returnToPath: string;
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface OidcSession {
  idToken: string;
  actorId: string;
  expiresAtEpochMs: number;
}

const OIDC_PENDING_KEY = 'sw_oidc_pending_login';
const OIDC_SESSION_KEY = 'sw_oidc_session_v1';
const DEFAULT_OIDC_SCOPE = 'openid profile email';
const DEFAULT_CLIENT_ID = 'swordworld-web';

const discoveryCache = new Map<string, Promise<OidcDiscoveryDocument>>();
let currentSession: OidcSession | null = null;
let redirectHandler: ((url: string) => void) | null = null;

export function createOidcAuthProvider(env = import.meta.env as OidcEnv): AuthProvider {
  resolveConfig(env);

  return {
    mode: 'oidc',
    get actorId() {
      return readValidSession()?.actorId ?? '';
    },
    get isAuthenticated() {
      return readValidSession() !== null;
    },
    async withAuthHeaders(headers?: HeadersInit): Promise<Headers> {
      const merged = new Headers(headers ?? {});
      const session = readValidSession();
      if (session) {
        merged.set('Authorization', `Bearer ${session.idToken}`);
      }
      return merged;
    },
    withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string } {
      return body;
    },
  };
}

export function hasOidcSession(): boolean {
  return readValidSession() !== null;
}

export function clearOidcSession(): void {
  clearPersistedOidcSession();
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(OIDC_PENDING_KEY);
  }
  notifyAuthStateChanged();
}

export async function beginOidcLogin(returnToPath = '/', env = import.meta.env as OidcEnv): Promise<void> {
  assertBrowser();
  const config = resolveConfig(env);
  const discovery = await loadDiscovery(config.discoveryUrl);
  const authorizationEndpoint = discovery.authorization_endpoint;
  if (!authorizationEndpoint) {
    throw new Error('OIDC discovery metadata is missing authorization_endpoint.');
  }

  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  writeJson(window.sessionStorage, OIDC_PENDING_KEY, {
    state,
    codeVerifier,
    returnToPath: returnToPath || '/',
  });

  const authorizeUrl = new URL(authorizationEndpoint);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('scope', config.scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  redirectTo(authorizeUrl.toString());
}

export async function beginOidcRegistration(returnToPath = '/', env = import.meta.env as OidcEnv): Promise<void> {
  await beginOidcLogin(returnToPath, env);
}

export async function beginOidcLogout(returnToPath = '/', env = import.meta.env as OidcEnv): Promise<void> {
  assertBrowser();
  const config = resolveConfig(env);
  const discovery = await loadDiscovery(config.discoveryUrl);
  clearOidcSession();

  const logoutEndpoint = discovery.end_session_endpoint;
  if (!logoutEndpoint) {
    redirectTo(resolveAbsoluteReturnToPath(returnToPath));
    return;
  }

  const logoutUrl = new URL(logoutEndpoint);
  logoutUrl.searchParams.set('post_logout_redirect_uri', resolveAbsoluteReturnToPath(returnToPath));
  logoutUrl.searchParams.set('client_id', config.clientId);
  redirectTo(logoutUrl.toString());
}

export async function completeOidcLoginFromCallback(
  url = window.location.href,
  env = import.meta.env as OidcEnv
): Promise<string> {
  assertBrowser();
  const config = resolveConfig(env);
  const discovery = await loadDiscovery(config.discoveryUrl);
  const tokenEndpoint = discovery.token_endpoint;
  if (!tokenEndpoint) {
    throw new Error('OIDC discovery metadata is missing token_endpoint.');
  }

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

  const pending = readJson<PendingLogin>(window.sessionStorage, OIDC_PENDING_KEY);
  if (!pending) {
    throw new Error('OIDC login state was not found. Start login again.');
  }
  if (pending.state !== state) {
    throw new Error('OIDC state mismatch. Start login again.');
  }

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
  if (!token.id_token) {
    throw new Error('OIDC token response missing id_token.');
  }

  currentSession = createSession(token.id_token, token.expires_in);
  persistOidcSession(currentSession);
  window.sessionStorage.removeItem(OIDC_PENDING_KEY);
  notifyAuthStateChanged();

  return pending.returnToPath || '/';
}

export function setOidcRedirectHandlerForTests(handler: ((url: string) => void) | null): void {
  redirectHandler = handler;
}

export function resetOidcAuthTestState(options?: { clearStorage?: boolean }): void {
  currentSession = null;
  redirectHandler = null;
  discoveryCache.clear();
  if (options?.clearStorage === false || typeof window === 'undefined') {
    return;
  }
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(OIDC_PENDING_KEY);
    window.sessionStorage.removeItem(OIDC_SESSION_KEY);
  }
}

function resolveConfig(env: OidcEnv): OidcConfig {
  const discoveryUrl = (env.VITE_OIDC_DISCOVERY_URL ?? '').trim();
  if (!discoveryUrl) {
    throw new Error('VITE_OIDC_DISCOVERY_URL is required when AUTH_MODE=oidc.');
  }

  const clientId = (env.VITE_OIDC_CLIENT_ID ?? DEFAULT_CLIENT_ID).trim() || DEFAULT_CLIENT_ID;
  const scope = (env.VITE_OIDC_SCOPE ?? DEFAULT_OIDC_SCOPE).trim() || DEFAULT_OIDC_SCOPE;
  const redirectUri = (env.VITE_OIDC_REDIRECT_URI ?? defaultRedirectUri()).trim();
  if (!redirectUri) {
    throw new Error('VITE_OIDC_REDIRECT_URI is required when AUTH_MODE=oidc.');
  }

  return {
    discoveryUrl,
    clientId,
    redirectUri,
    scope,
  };
}

async function loadDiscovery(discoveryUrl: string): Promise<OidcDiscoveryDocument> {
  let discovery = discoveryCache.get(discoveryUrl);
  if (!discovery) {
    discovery = fetch(discoveryUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`OIDC discovery request failed: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as OidcDiscoveryDocument;
    });
    discoveryCache.set(discoveryUrl, discovery);
  }
  return discovery;
}

function createSession(idToken: string, expiresIn?: number): OidcSession {
  const payload = decodeJwtPayload(idToken);
  const actorId = typeof payload.sub === 'string' && payload.sub.trim() !== '' ? payload.sub.trim() : 'oidc-user';
  const expiresAtEpochMs =
    typeof payload.exp === 'number'
      ? payload.exp * 1000
      : Date.now() + (typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 3600) * 1000;

  return {
    idToken,
    actorId,
    expiresAtEpochMs,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) {
    return {};
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function redirectTo(url: string): void {
  if (redirectHandler) {
    redirectHandler(url);
    return;
  }
  window.location.assign(url);
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

function readValidSession(): OidcSession | null {
  if (!currentSession) {
    currentSession = readPersistedOidcSession();
  }
  if (!currentSession) {
    return null;
  }
  if (Date.now() >= currentSession.expiresAtEpochMs) {
    clearPersistedOidcSession();
    return null;
  }
  return currentSession;
}

function persistOidcSession(session: OidcSession): void {
  if (typeof window === 'undefined') {
    return;
  }
  writeJson(window.sessionStorage, OIDC_SESSION_KEY, session);
}

function readPersistedOidcSession(): OidcSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const persisted = readJson<Partial<OidcSession>>(window.sessionStorage, OIDC_SESSION_KEY);
  if (
    !persisted ||
    typeof persisted.idToken !== 'string' ||
    typeof persisted.actorId !== 'string' ||
    typeof persisted.expiresAtEpochMs !== 'number'
  ) {
    window.sessionStorage.removeItem(OIDC_SESSION_KEY);
    return null;
  }

  return {
    idToken: persisted.idToken,
    actorId: persisted.actorId,
    expiresAtEpochMs: persisted.expiresAtEpochMs,
  };
}

function clearPersistedOidcSession(): void {
  currentSession = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(OIDC_SESSION_KEY);
  }
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

function assertBrowser(): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined' || typeof window.crypto === 'undefined') {
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
