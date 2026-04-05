import { createContext, useContext } from 'react';
import { logWebFlow, summarizeError } from '../logging/flowLog';

export type AuthMode = 'dev' | 'oidc';
export type AuthAction = 'login' | 'register' | 'logout';

export interface AuthActionResult {
  ok: boolean;
  redirectTo?: string;
}

export interface AuthLoginOptions {
  username?: string;
  password?: string;
  returnToPath?: string;
}

export interface AuthRegisterOptions {
  username?: string;
  password?: string;
  returnToPath?: string;
}

export interface AuthLogoutOptions {
  returnToPath?: string;
}

export interface AuthProvider {
  mode: AuthMode;
  actorId: string;
  isAuthenticated: boolean;
  pendingAction: AuthAction | null;
  errorMessage: string | null;
  withAuthHeaders(headers?: HeadersInit): Promise<Headers>;
  withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string };
  login(options?: AuthLoginOptions): Promise<AuthActionResult>;
  register(options?: AuthRegisterOptions): Promise<AuthActionResult>;
  logout(options?: AuthLogoutOptions): Promise<AuthActionResult>;
  clearError(): void;
}

export const AuthProviderContext = createContext<AuthProvider | null>(null);

const AUTH_STATE_CHANGE_EVENT = 'sw-auth-state-change';
let authStoreVersion = 0;
let authUiState: {
  pendingAction: AuthAction | null;
  errorMessage: string | null;
} = {
  pendingAction: null,
  errorMessage: null,
};

export function useAuthProvider(): AuthProvider {
  const provider = useContext(AuthProviderContext);
  if (!provider) {
    throw new Error('AuthProviderContext is missing');
  }
  return provider;
}

export function notifyAuthStateChanged(): void {
  authStoreVersion += 1;
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(AUTH_STATE_CHANGE_EVENT));
}

export function getAuthStoreVersion(): number {
  return authStoreVersion;
}

export function subscribeToAuthState(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = () => {
    authStoreVersion += 1;
    listener();
  };
  const handleCustomEvent = () => {
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleCustomEvent);
  };
}

export function getAuthUiState(): Readonly<typeof authUiState> {
  return authUiState;
}

export function clearAuthError(): void {
  setAuthUiState({ errorMessage: null });
}

export function clearAuthUiState(): void {
  setAuthUiState({
    pendingAction: null,
    errorMessage: null,
  });
}

export async function runAuthAction(
  options: {
    action: AuthAction;
    authMode: AuthMode;
    actorId: string;
    work: () => Promise<Omit<AuthActionResult, 'ok'> | void> | Omit<AuthActionResult, 'ok'> | void;
  }
): Promise<AuthActionResult> {
  const { action, authMode, actorId, work } = options;

  setAuthUiState({
    pendingAction: action,
    errorMessage: null,
  });

  logWebFlow(`WEB_ACCOUNT_${action.toUpperCase()}_START`, {
    authMode,
    actorId,
  });

  try {
    const result = await work();
    return {
      ok: true,
      redirectTo: result?.redirectTo,
    };
  } catch (actionError) {
    setAuthUiState({
      errorMessage: actionError instanceof Error ? actionError.message : String(actionError),
    });
    logWebFlow(`WEB_ACCOUNT_${action.toUpperCase()}_FAILED`, {
      authMode,
      actorId,
      ...summarizeError(actionError),
    });
    return {
      ok: false,
    };
  } finally {
    if (authUiState.pendingAction === action) {
      setAuthUiState({
        pendingAction: null,
      });
    }
  }
}

function setAuthUiState(
  nextState: Partial<{
    pendingAction: AuthAction | null;
    errorMessage: string | null;
  }>
): void {
  const updatedState = {
    ...authUiState,
    ...nextState,
  };

  if (
    updatedState.pendingAction === authUiState.pendingAction &&
    updatedState.errorMessage === authUiState.errorMessage
  ) {
    return;
  }

  authUiState = updatedState;
  notifyAuthStateChanged();
}
