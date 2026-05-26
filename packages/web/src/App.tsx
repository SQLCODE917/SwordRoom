import { type ReactNode, useMemo, useSyncExternalStore } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthProviderContext, getAuthStoreVersion, subscribeToAuthState, useAuthProvider } from './auth/AuthProvider';
import { createDevAuthProvider } from './auth/DevAuthProvider';
import { createOidcAuthProvider } from './auth/OidcAuthProvider';
import { AuthCallbackPage } from './routes/AuthCallbackPage';
import { AdminDashboardPage } from './routes/AdminDashboardPage';
import { CharacterSheetPage } from './routes/CharacterSheetPage';
import { CharacterWizardPage } from './routes/CharacterWizardPage';
import { GMGamePage } from './routes/GMGamePage';
import { GMGamesPage } from './routes/GMGamesPage';
import { GameChatPage } from './routes/GameChatPage';
import { HomePage } from './routes/HomePage';
import { AccountPage } from './routes/AccountPage';
import { LoginPage } from './routes/LoginPage';
import { InboxPage } from './routes/InboxPage';
import { PlayerGameplayPage } from './routes/PlayerGameplayPage';
import { PregameCharactersPage } from './routes/PregameCharactersPage';
import { PregameLobbyPage } from './routes/PregameLobbyPage';
import { useGameActorContext } from './hooks/useGameActorContext';
import { useMyProfile } from './hooks/useMyProfile';

export default function App() {
  const authRevision = useSyncExternalStore(subscribeToAuthState, getAuthStoreVersion, getAuthStoreVersion);

  const authProvider = useMemo(() => {
    const mode = import.meta.env.VITE_AUTH_MODE;
    return mode === 'oidc' ? createOidcAuthProvider() : createDevAuthProvider();
  }, [authRevision]);

  return (
    <AuthProviderContext.Provider value={authProvider}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell>
          <Routes>
            <Route path="/" element={<RequireAuthRoute><HomePage /></RequireAuthRoute>} />
            <Route
              path="/games/:gameId"
              element={<RequireAuthRoute><PregameLobbyPage /></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/character/new"
              element={<RequireAuthRoute><CharacterWizardPage /></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/chat"
              element={<RequireAuthRoute><GameChatPage /></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/characters"
              element={<RequireAuthRoute><PregameCharactersPage /></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/play"
              element={<RequireAuthRoute><PlayerGameplayPage /></RequireAuthRoute>}
            />
            <Route
              path="/player/:playerId/character/new"
              element={<RequireAuthRoute><RequireOwnPlayerRoute><CharacterWizardPage /></RequireOwnPlayerRoute></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/characters/:characterId/edit"
              element={<RequireAuthRoute><CharacterWizardPage /></RequireAuthRoute>}
            />
            <Route
              path="/player/:playerId/characters/:characterId/edit"
              element={<RequireAuthRoute><RequireOwnPlayerRoute><CharacterWizardPage /></RequireOwnPlayerRoute></RequireAuthRoute>}
            />
            <Route
              path="/gm/games"
              element={<RequireAuthRoute><RequireRoleRoute allowedRoles={['GM']}><GMGamesPage /></RequireRoleRoute></RequireAuthRoute>}
            />
            <Route
              path="/gm/games/:gameId"
              element={
                <RequireAuthRoute>
                  <RequireGmRoute>
                    <GMGamePage />
                  </RequireGmRoute>
                </RequireAuthRoute>
              }
            />
            <Route
              path="/admin"
              element={<RequireAuthRoute><RequireRoleRoute allowedRoles={['ADMIN']}><AdminDashboardPage /></RequireRoleRoute></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/characters/:characterId"
              element={<RequireAuthRoute><CharacterSheetPage /></RequireAuthRoute>}
            />
            <Route path="/account" element={<RequireAuthRoute><AccountPage /></RequireAuthRoute>} />
            <Route
              path="/player/:playerId/characters/:characterId"
              element={<RequireAuthRoute><RequireOwnPlayerRoute><CharacterSheetPage /></RequireOwnPlayerRoute></RequireAuthRoute>}
            />
            <Route
              path="/inbox"
              element={<RequireAuthRoute><InboxPage /></RequireAuthRoute>}
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthProviderContext.Provider>
  );
}

function RequireGmRoute({ children }: { children: ReactNode }) {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const { context, loading } = useGameActorContext(gameId);

  if (loading) {
    return null;
  }

  if (!context.isGameMaster) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RequireAuthRoute({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireOwnPlayerRoute({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  const params = useParams<{ playerId: string }>();
  if (!params.playerId || params.playerId !== auth.actorId) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireRoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: readonly string[];
  children: ReactNode;
}) {
  const { profile, loading } = useMyProfile();

  if (loading) {
    return null;
  }

  const roles = new Set(profile?.roles ?? []);
  const isAllowed = allowedRoles.some((role) => roles.has(role));
  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}
