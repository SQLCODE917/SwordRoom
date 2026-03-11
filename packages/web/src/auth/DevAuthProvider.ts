import type { AuthMode, AuthProvider } from './AuthProvider';

interface WebEnv {
  VITE_AUTH_MODE?: string;
  VITE_DEV_ACTOR_ID?: string;
  VITE_OIDC_BEARER_TOKEN?: string;
}

export interface DevAccount {
  username: string;
  password: string;
  actorId: string;
  displayName: string;
}

interface DevSession {
  username: string;
  actorId: string;
}

const DEV_ACCOUNTS_KEY = 'sw_dev_accounts_v1';
const DEV_SESSION_KEY = 'sw_dev_session_v1';

export function createDevAuthProvider(env = import.meta.env as WebEnv): AuthProvider {
  const mode = parseMode(env.VITE_AUTH_MODE);
  const oidcToken = env.VITE_OIDC_BEARER_TOKEN;

  return {
    mode,
    get actorId() {
      return readActorId(mode, oidcToken);
    },
    get isAuthenticated() {
      return mode === 'dev' ? readActorId(mode, oidcToken).trim() !== '' : Boolean(oidcToken);
    },
    async withAuthHeaders(headers?: HeadersInit): Promise<Headers> {
      const merged = new Headers(headers ?? {});
      const actorId = readActorId(mode, oidcToken);
      if (mode === 'dev' && actorId.trim() !== '') {
        merged.set('x-dev-actor-id', actorId);
      }
      if (mode === 'oidc' && oidcToken) {
        merged.set('Authorization', `Bearer ${oidcToken}`);
      }
      return merged;
    },
    withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string } {
      const actorId = readActorId(mode, oidcToken);
      if (mode === 'dev' && actorId.trim() !== '') {
        return { ...body, bypassActorId: actorId };
      }
      return body;
    },
  };
}

function readActorId(mode: AuthMode, oidcToken?: string): string {
  if (mode === 'dev') {
    return readCurrentDevSession()?.actorId ?? '';
  }
  return oidcToken ? 'oidc-user' : '';
}

export async function registerDevAccount(username: string, password: string): Promise<DevAccount> {
  const normalizedUsername = normalizeUsername(username);
  const trimmedPassword = password.trim();
  if (!normalizedUsername || !trimmedPassword) {
    throw new Error('Username and password are required.');
  }

  const allAccounts = await loadAvailableDevAccounts();
  if (allAccounts.some((account) => account.username === normalizedUsername)) {
    throw new Error(`Account "${normalizedUsername}" already exists.`);
  }

  const nextAccount: DevAccount = {
    username: normalizedUsername,
    password: trimmedPassword,
    actorId: createActorId(normalizedUsername),
    displayName: normalizedUsername,
  };
  writeStoredDevAccounts([...readStoredDevAccounts(), nextAccount]);
  writeDevSession(nextAccount);
  return nextAccount;
}

export async function loginOrRegisterDevAccount(username: string, password: string): Promise<DevAccount> {
  const normalizedUsername = normalizeUsername(username);
  const trimmedPassword = password.trim();
  if (!normalizedUsername || !trimmedPassword) {
    throw new Error('Username and password are required.');
  }

  const allAccounts = await loadAvailableDevAccounts();
  const existing = allAccounts.find((account) => account.username === normalizedUsername);
  if (!existing) {
    return registerDevAccount(normalizedUsername, trimmedPassword);
  }
  if (existing.password !== trimmedPassword) {
    throw new Error('Invalid username or password.');
  }
  writeDevSession(existing);
  return existing;
}

export function logoutDevSession(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(DEV_SESSION_KEY);
}

export function writeDevSession(account: Pick<DevAccount, 'username' | 'actorId'>): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(account));
}

export function readCurrentDevSession(): DevSession | null {
  if (!isBrowser()) {
    return null;
  }
  return readJson<DevSession>(window.localStorage, DEV_SESSION_KEY);
}

export async function loadAvailableDevAccounts(): Promise<DevAccount[]> {
  const merged = new Map<string, DevAccount>();
  for (const account of [...builtinDevAccounts, ...readStoredDevAccounts(), ...(await loadConfiguredAdminAccounts())]) {
    merged.set(account.username, account);
  }
  return Array.from(merged.values());
}

function parseMode(rawMode: string | undefined): AuthMode {
  return rawMode === 'oidc' ? 'oidc' : 'dev';
}

const builtinDevAccounts: DevAccount[] = [
  {
    username: 'player-aaa',
    password: 'player1234',
    actorId: 'player-aaa',
    displayName: 'Local Player',
  },
  {
    username: 'gm-zzz',
    password: 'gm1234',
    actorId: 'gm-zzz',
    displayName: 'Local GM',
  },
];

function readStoredDevAccounts(): DevAccount[] {
  if (!isBrowser()) {
    return [];
  }
  return readJson<DevAccount[]>(window.localStorage, DEV_ACCOUNTS_KEY) ?? [];
}

function writeStoredDevAccounts(accounts: DevAccount[]): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(DEV_ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function loadConfiguredAdminAccounts(): Promise<DevAccount[]> {
  if (!isBrowser() || typeof fetch !== 'function') {
    return [];
  }

  try {
    const response = await fetch('/dev-admin.local.json', { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { accounts?: unknown };
    if (!Array.isArray(payload.accounts)) {
      return [];
    }
    return payload.accounts
      .map((item) => toDevAccount(item))
      .filter((item): item is DevAccount => item !== null);
  } catch {
    return [];
  }
}

function toDevAccount(value: unknown): DevAccount | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const username = normalizeUsername(record.username);
  const password = typeof record.password === 'string' ? record.password.trim() : '';
  const actorId = typeof record.actorId === 'string' ? record.actorId.trim() : '';
  const displayName =
    typeof record.displayName === 'string' && record.displayName.trim() !== '' ? record.displayName.trim() : username;

  if (!username || !password || !actorId) {
    return null;
  }

  return {
    username,
    password,
    actorId,
    displayName,
  };
}

function normalizeUsername(username: unknown): string {
  return typeof username === 'string' ? username.trim().toLowerCase() : '';
}

function createActorId(username: string): string {
  const slug = username.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'player';
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(16).slice(-8);
  return `player-${slug}-${suffix}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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
