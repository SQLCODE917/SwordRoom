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
import { GMInboxPage } from './routes/GMInboxPage';
import { GMGamesPage } from './routes/GMGamesPage';
import { GameChatPage } from './routes/GameChatPage';
import { HomePage } from './routes/HomePage';
import { LoginPage } from './routes/LoginPage';
import { PlayerInboxPage } from './routes/PlayerInboxPage';
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
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<RequireAuthRoute><HomePage /></RequireAuthRoute>} />
            <Route
              path="/games/:gameId/character/new"
              element={<RequireAuthRoute><CharacterWizardPage /></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/chat"
              element={<RequireAuthRoute><GameChatPage /></RequireAuthRoute>}
            />
            <Route
              path="/game/:gameId/chat"
              element={<RequireAuthRoute><GameChatPage /></RequireAuthRoute>}
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
            <Route path="/me/inbox" element={<RequireAuthRoute><PlayerInboxPage /></RequireAuthRoute>} />
            <Route
              path="/gm/games"
              element={<RequireAuthRoute><GMGamesPage /></RequireAuthRoute>}
            />
            <Route
              path="/admin"
              element={<RequireAuthRoute><RequireRoleRoute allowedRoles={['ADMIN']}><AdminDashboardPage /></RequireRoleRoute></RequireAuthRoute>}
            />
            <Route
              path="/games/:gameId/characters/:characterId"
              element={<RequireAuthRoute><CharacterSheetPage /></RequireAuthRoute>}
            />
            <Route
              path="/player/:playerId/characters/:characterId"
              element={<RequireAuthRoute><RequireOwnPlayerRoute><CharacterSheetPage /></RequireOwnPlayerRoute></RequireAuthRoute>}
            />
            <Route
              path="/gm/:gameId/inbox"
              element={
                <RequireAuthRoute>
                  <RequireGmRoute>
                    <GMInboxPage />
                  </RequireGmRoute>
                </RequireAuthRoute>
              }
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
